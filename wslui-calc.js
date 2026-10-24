'use strict';
/* Tonfunk Wechselstrom-Lab: Tab "Rechnen" (WP3c, SPEC 6.4).
   Acht Karten aus WSL_CORE.formulas (alle 41 Einträge, Rechenweg = expr + Kerntext) plus Prüfung der Überkompensation (comp.state);
   dazu der Übungsgenerator ("Neue Aufgabe") für alle WSL_CORE.exercise-Arten (Prüfung mit exercise.check, Zähler wslcalc).
   ALLE Zahlen kommen aus WSL_CORE (formulas[id].calc/fn, comp.state, TEXTS, limitText, exercise); hier steht keine zweite Formelimplementierung
   (SPEC Regel 7). Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen. Alle Beispielwerte in den Feldern sind Übungswerte.
   Schnittstelle (VERTRAG 6.5): window.WSL_UI_EXT.calc.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter WSL_UI_EXT.calc.fn
   und werden von quelle/wsllab/test_wslui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.WSL_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (wslcore.js und wslcore-res.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (wslcore.js oder wslcore-res.js ist nicht vollständig geladen). Dieser Rechner liefert deshalb keine Zahlen.';
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben lesen */
  /* Text -> SI-Zahl: mit Einheit im Text (z. B. "100 nF") nimmt der Kern sie, ohne Einheit gilt die Anzeigeeinheit des Feldes (f.scale) */
  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1;
    if (typeof txt === 'number') return fin(txt) ? txt * sc : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    let q = null; if (C && typeof C.parseQty === 'function') q = tryf(() => C.parseQty(t), null);
    if (q && fin(q.v)) return q.hasUnit ? q.v : q.raw * sc;
    const v = C && typeof C.parseNum === 'function' ? tryf(() => C.parseNum(t), NaN) : parseFloat(t.replace(/\s/g, '').replace(',', '.'));
    return fin(v) ? v * sc : NaN;
  }
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limT = id => { const C = CORE(); return C && typeof C.limitText === 'function' ? tryf(() => C.limitText(id), '') : ''; };

  /* ============================================================ Karten (Daten, keine Formeln) */
  const CARDS = [
    { id: 'c1', icon: '〰️', title: '1 Sinusgrößen und Phase', rows: ['omega', 'periode', 'eff', 'gleichricht', 'formfaktor', 'zeitversatz'] },
    { id: 'c2', icon: '🌀', title: '2 Blindwiderstand, Scheinwiderstand, Strom und Phasenwinkel', rows: ['xl', 'xc', 'zReihe', 'phiReihe', 'iReihe', 'uGeom', 'yParallel'] },
    { id: 'c3', icon: '🧲', title: '3 Spule aus Messwerten', rows: ['spule'] },
    { id: 'c4', icon: '⚡', title: '4 Wirkleistung, Blindleistung, Scheinleistung und cos φ', rows: ['pUIphi', 'qUIphi', 'sUI', 'cosphi', 'qAusSP'] },
    { id: 'c5', icon: '⚖️', title: '5 Kompensation', rows: ['qc', 'cKomp', 'kompState'] },
    { id: 'c6', icon: '🔔', title: '6 Resonanzfrequenz, Güte und Bandbreite', rows: ['f0', 'cAusF0', 'lAusF0', 'z0', 'gueteReihe', 'gueteParallel', 'bandbreite', 'uLReso'] },
    { id: 'c7', icon: '🎚️', title: '7 Grenzfrequenz und Dämpfungsmaß', rows: ['fgRC', 'fgRL', 'hBetrag', 'dB', 'dekade', 'tau'] },
    { id: 'c8', icon: '🔄', title: '8 Transformator und Drehstrom', rows: ['ueb', 'i1', 'etaTrafo', 'uAussen', 'pDrehstrom', 'sternDreieck'] }
  ];
  /* Anzeigeeinheit je Argument-Schlüssel (Eingabe in dieser Einheit, wenn kein Einheitenzusatz getippt wird) */
  const UNITS = { l: ['mH', 1e-3], c: ['nF', 1e-9] };
  const UNITS_ROW = { xc: { c: ['µF', 1e-6] }, kompState: { c: ['µF', 1e-6] } };
  /* Übungswerte (Anzeigeeinheit des Feldes) */
  const DEF = {
    omega: { f: '50' }, periode: { f: '50' }, eff: { ampl: '325' }, gleichricht: { ampl: '325' }, formfaktor: { ampl: '325' }, zeitversatz: { f: '50', phi: '45' },
    xl: { f: '50', l: '100' }, xc: { f: '50', c: '100' }, zReihe: { r: '22', xl: '31,4', xc: '20' }, phiReihe: { r: '22', xl: '31,4', xc: '20' }, iReihe: { u: '230', r: '22', xl: '31,4', xc: '0' },
    uGeom: { ur: '20', ul: '30', uc: '10' }, yParallel: { r: '100', xl: '50', xc: '80' },
    spule: { u: '230', i: '6', p: '792' },
    pUIphi: { u: '230', i: '10', phi: '30' }, qUIphi: { u: '230', i: '10', phi: '30' }, sUI: { u: '230', i: '10' }, cosphi: { p: '3200', s: '4000' }, qAusSP: { s: '4000', p: '3200' },
    qc: { p: '3200', cos1: '0,8', cos2: '0,95' }, cKomp: { p: '3200', cos1: '0,8', cos2: '0,95', u: '230', f: '50' }, kompState: { p: '3200', cos1: '0,8', cos2: '0,95', u: '230', f: '50', c: '82' },
    f0: { l: '1', c: '100' }, cAusF0: { l: '1', f0: '15915' }, lAusF0: { c: '100', f0: '15915' }, z0: { l: '1', c: '100' }, gueteReihe: { l: '1', c: '100', r: '10' }, gueteParallel: { l: '1', c: '100', rp: '1000' },
    bandbreite: { f0: '15915', qg: '10' }, uLReso: { u: '24', r: '10', xl: '100' },
    fgRC: { r: '1000', c: '100' }, fgRL: { r: '100', l: '16' }, hBetrag: { f: '1000', fg: '1591' }, dB: { h: '0,7071' }, dekade: { x: '10' }, tau: { r: '1000', c: '100' },
    ueb: { n1: '1150', n2: '69' }, i1: { i2: '2,5', n1: '1150', n2: '69' }, etaTrafo: { p2: '100', pcu: '3', pfe: '2' }, uAussen: { ustr: '230' }, pDrehstrom: { ul: '400', il: '10', cosphi: '0,8' }, sternDreieck: { ul: '400', zstr: '40' }
  };
  /* Zusatzfelder der Zeile "kompState" (kein Eintrag in formulas; Aussage von comp.state) */
  const KS_ARGS = [{ key: 'p', label: 'Wirkleistung', unit: 'W' }, { key: 'cos1', label: 'cos φ vorher', unit: '' }, { key: 'cos2', label: 'cos φ Ziel', unit: '' }, { key: 'u', label: 'Spannung', unit: 'V' }, { key: 'f', label: 'Frequenz', unit: 'Hz' }, { key: 'c', label: 'Kondensator', unit: 'F' }];
  /* Hinweise je Zeile: nur Texte aus TEXTS/limits (Regel 1, 2) */
  const NOTES = {
    phiReihe: () => [textOf('konvention')], zReihe: () => [textOf('konvention')],
    qc: () => [limT('cos_ziel'), textOf('kompNurParallel')], cKomp: () => [limT('cos_ziel'), textOf('kompNurParallel')], kompState: () => [limT('cos_ziel'), textOf('kompNurParallel')],
    gueteReihe: () => [textOf('ueberhoehung')], uLReso: () => [textOf('ueberhoehung')], gueteParallel: () => [textOf('parallelIdeal')],
    dekade: () => [textOf('filterNurErsteOrdnung')], dB: () => [limT('fg_db')], hBetrag: () => [limT('fg_betrag')],
    etaTrafo: () => [textOf('trafoModell')], ueb: () => [limT('trafo_ueb')],
    uAussen: () => [limT('u_aussen'), textOf('dreiOhne')], pDrehstrom: () => [limT('u_aussen'), textOf('dreiOhne')], sternDreieck: () => [limT('u_aussen'), textOf('dreiOhne')]
  };
  const EXLABEL = {
    eff: 'Effektivwert aus Scheitelwert', zeitversatz: 'Zeitversatz aus Phasenwinkel', xl: 'Blindwiderstand der Spule', xc: 'Blindwiderstand des Kondensators', zReihe: 'Scheinwiderstand der Reihenschaltung',
    iReihe: 'Strom an Spule mit Widerstand', uGeom: 'Gesamtspannung (geometrisch)', spule: 'Blindwiderstand der Spule aus Messwerten', qUIphi: 'Blindleistung aus U, I und φ', qAusSP: 'Blindleistung aus S und P',
    sAusPcos: 'Scheinleistung aus P und cos φ', cKomp: 'Kompensationskapazität', f0: 'Resonanzfrequenz', cAusF0: 'Kapazität für f₀', lAusF0: 'Induktivität für f₀', gueteBandbreite: 'Güte und Bandbreite',
    uLReso: 'Spulenspannung bei Resonanz', fgRC: 'Grenzfrequenz RC-Glied', cFuerFg: 'Kapazität für f_g', siebglied: 'Siebglied', dbDekade: 'Dämpfungsmaß im Abstand von f_g', ueb: 'Übersetzungsverhältnis',
    i1: 'Primärstrom (ideal)', pDrehstrom: 'Leistung im Drehstromnetz'
  };

  /* ============================================================ reine Rechenfunktionen (alle rufen WSL_CORE) */
  function formulaList() { const C = CORE(), f = C && C.formulas; if (!f || typeof f.list !== 'function') return []; return tryf(() => f.list(), []); }
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!f || typeof f.get !== 'function') return null; const e = tryf(() => f.get(id), null); return e && typeof e.calc === 'function' ? e : null; }
  /* Zeilen-Beschreibung: Felder aus den Argumenten der Kernformel (Label, Einheit), Anzeigeeinheit und Vorgabe aus den Tabellen oben */
  function rowById(id) {
    if (!CARDS.some(c => c.rows.indexOf(id) >= 0)) return null;
    const isState = id === 'kompState', fo = isState ? null : formulaById(id);
    if (!isState && !fo) return null;
    const args = isState ? KS_ARGS : fo.args;
    const fields = args.map(a => {
      const uo = (UNITS_ROW[id] && UNITS_ROW[id][a.key]) || ((a.unit === 'F' || a.unit === 'H') && UNITS[a.key]) || null;
      const unit = uo ? uo[0] : a.unit, scale = uo ? uo[1] : 1;
      return { key: a.key, label: a.label, unit, scale, def: (DEF[id] && DEF[id][a.key] != null) ? DEF[id][a.key] : '' };
    });
    return { id, formula: isState ? null : id, title: isState ? 'Überkompensation prüfen (Kern: comp.state)' : fo.name + (fo.symbol ? ' (' + fo.symbol + ')' : ''), expr: isState ? 'cos φ und Q mit C aus comp.after, Zustand aus comp.state' : fo.expr, fields };
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
  /* Eine Zeile rechnen: Ergebnis genau aus formulas[id].calc (Text und Zahl vom Kern) */
  function calc(rowId, vals) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    const r = rowById(rowId); if (!r) return { ok: false, why: C.formulas ? 'Diesen Rechner gibt es nicht.' : NOFN('formulas') };
    const { args, bad } = argsOf(r, vals);
    if (bad.length) return { ok: false, why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt): ' + bad.join(', ') + '.' };
    const notes = (NOTES[rowId] ? NOTES[rowId]() : []).filter(t => t);
    if (rowId === 'kompState') return stateCalc(C, r, args, notes);
    const f = formulaById(rowId); if (!f) return { ok: false, why: NOFN('formulas') };
    const e = tryf(() => f.calc(args), null);
    if (!e || e.ok === false || !fin(e.value)) return { ok: false, why: (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0 oder ein Wert kleiner oder gleich 0).' };
    return { ok: true, id: rowId, row: rowId, value: e.value, unit: e.unit != null ? e.unit : '', shown: e.text, text: e.text, steps: [f.expr, e.text], explain: f.explain || '', args, notes };
  }
  function stateCalc(C, r, a, notes) {
    if (!C.comp || typeof C.comp.state !== 'function') return { ok: false, why: NOFN('comp.state') };
    const s = tryf(() => C.comp.state({ p: a.p, cos1: a.cos1, cos2: a.cos2, u: a.u, f: a.f, c: a.c }), null);
    if (!s || s.ok === false || s.valid === false || !s.text) return { ok: false, why: (s && s.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, id: 'kompState', row: 'kompState', value: s.cos, unit: '', zustand: s.state, ueber: !!s.ueber, shown: s.text, text: s.text, steps: [r.expr, s.text], explain: '', args: a, notes };
  }
  function exKinds() { const C = CORE(); return C && C.exercise && Array.isArray(C.exercise.kinds) ? C.exercise.kinds.slice() : []; }
  function exLabel(k) { return EXLABEL[k] || (formulaById(k) ? formulaById(k).name : k); }
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
  const CSS = '<style>.wc-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.wc-g label{flex:1 1 150px;min-width:130px;font-size:12.5px;color:var(--mute)}.wc-g input,.wc-g select{margin-top:3px;min-height:42px}.wc-row{padding:10px 12px;border-top:1px solid var(--line)}.wc-row:first-child{border-top:0}.wc-row h5{margin:0;font-size:14px}.wc-res{margin-top:8px}.wc-bad{color:var(--danger);font-size:13.5px;margin:6px 0 0}.wc-q{font-size:15px;line-height:1.5;margin:6px 0}</style>';
  function fieldHtml(rowId, f) {
    const k = rowId + '.' + f.key, v = ST.vals[k] != null ? ST.vals[k] : f.def, id = 'wc_' + rowId + '_' + f.key;
    return `<label for="${id}">${esc(f.label)}${f.unit ? ' in ' + esc(f.unit) : ''}<input id="${id}" data-f="${esc(k)}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`;
  }
  function resHtml(res) {
    if (!res) return '';
    if (!res.ok) return `<p class="wc-bad" role="status">${esc(res.why)}</p>`;
    return `<div class="res"><div class="big2">${esc(res.shown)}</div><ol>${res.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${res.explain ? `<p class="hint2">${esc(res.explain)}</p>` : ''}${res.notes.map(t => `<p class="hint2">${esc(t)}</p>`).join('')}</div>`;
  }
  function rowVals(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { const k = rowId + '.' + f.key; o[f.key] = ST.vals[k] != null ? ST.vals[k] : f.def; }); return o; }
  function rowHtml(rowId) {
    const r = rowById(rowId); if (!r) return `<div class="wc-row"><p class="wc-bad">${esc(CORE() ? NOFN('formulas.' + rowId) : NOCORE)}</p></div>`;
    return `<div class="wc-row" data-row="${esc(rowId)}"><h5>${esc(r.title)}</h5><p class="hint2" style="margin:2px 0 0">${esc(r.expr)}</p><div class="wc-g">${r.fields.map(f => fieldHtml(rowId, f)).join('')}</div><div class="wc-res" data-res="${esc(rowId)}" aria-live="polite">${resHtml(calc(rowId, rowVals(rowId)))}</div></div>`;
  }
  function cardHtml(c, open) {
    return `<details class="card" data-card="${esc(c.id)}"${open ? ' open' : ''}><summary>${c.icon} ${esc(c.title)}</summary><div class="cb">${c.rows.map(rowHtml).join('')}</div></details>`;
  }
  function exHtml() {
    const kinds = exKinds(), ex = ST.ex;
    const sel = `<label for="wc_kind">Art der Aufgabe<select id="wc_kind" data-act-sel="kind">${kinds.map(k => `<option value="${esc(k)}"${k === ST.kind ? ' selected' : ''}>${esc(exLabel(k))}</option>`).join('')}</select></label>`;
    let body = '';
    if (!kinds.length) body = `<p class="wc-bad">${esc(CORE() ? NOFN('exercise') : NOCORE)}</p>`;
    else if (ex && ex.ok === false) body = `<p class="wc-bad">${esc(ex.why)}</p>`;
    else if (ex) {
      const res = ST.res, du = ex.answer && ex.answer.disp && ex.answer.disp.unit ? ex.answer.disp.unit : ex.answer.unit;
      body = `<p class="wc-q" data-ex="q">${esc(ex.question)}</p><label for="wc_ans">Deine Antwort (Einheit: ${esc(du)}${du !== ex.answer.unit && ex.answer.unit ? ' oder ' + esc(ex.answer.unit) : ''})<input id="wc_ans" data-ans="1" inputmode="decimal" autocomplete="off" value="${esc(ST.ans)}"></label>
        <div class="btns"><button class="btn pri" data-act="check">Prüfen</button><button class="btn" data-act="steps">Rechenweg zeigen</button><button class="btn" data-act="newex">Neue Aufgabe</button></div>
        <div data-ex="res" aria-live="polite">${res ? `<div class="ex ${res.ok ? 'ok' : 'bad'}"><b>${res.ok ? 'Richtig. ' : ''}</b>${esc(res.text)}${!res.ok && res.why ? `<details><summary>Warum?</summary>${esc(res.why)}</details>` : ''}</div>` : ''}${ST.show ? `<div class="ex"><b>Rechenweg</b><ol>${(ex.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="hint2">Ergebnis: ${esc(ex.answer.disp && ex.answer.disp.value != null ? fm(ex.answer.disp.value, 4) + ' ' + du : fm(ex.answer.value, 4) + ' ' + ex.answer.unit)}</p></div>` : ''}</div><p class="hint2">${esc(textOf('uebung'))}</p>`;
    } else body = `<div class="btns"><button class="btn pri" data-act="newex">Neue Aufgabe</button></div>`;
    return `<details class="card" data-card="ex" open><summary>🎯 Übungsgenerator: Neue Aufgabe</summary><div class="cb"><div class="wc-row"><div class="wc-g">${sel}</div>${body}</div></div></details>`;
  }
  function renderAll() {
    const C = CORE();
    const top = `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für das Wechselstrom-Lab</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, Zahlen mit Komma, Rechenweg zum Nachvollziehen. Die Werte in den Feldern sind Übungswerte; einen Einheitenzusatz wie 100 nF oder 15,9 kHz darfst du mittippen. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="wc-bad">${esc(NOCORE)}</p></div>`;
    return CSS + top + CARDS.map((c, i) => cardHtml(c, i === 0)).join('') + exHtml();
  }
  function newEx(newSeed) {
    const kinds = exKinds(); if (!kinds.length) { ST.ex = null; return; }
    if (!ST.kind || kinds.indexOf(ST.kind) < 0) ST.kind = kinds[0];
    if (!ST.seed) ST.seed = 1 + Math.floor(Date.now() / 1000) % 100000; else if (newSeed) ST.seed += 1;
    ST.ex = exNew(ST.kind, ST.seed); ST.ans = ''; ST.res = null; ST.show = false;
  }
  function stat(n) { try { if (A && typeof A.stat === 'function') A.stat('wslcalc', n == null ? 1 : n); } catch (e) {} }
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
    if (!host._wslCalc) { host._wslCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, fn: { cardList, rowById, defaultsOf, calc, formulaList, formulaById, readNum, exKinds, exLabel, exNew, exCheck }, _st: ST };
  root.WSL_UI_EXT = root.WSL_UI_EXT || {}; root.WSL_UI_EXT.calc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
