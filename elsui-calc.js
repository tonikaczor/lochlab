'use strict';
/* Tonfunk Sicherheits-Lab: Tab "Rechnen" (WP3c, SPEC 6.4).
   Sieben Karten: (1) Ohm und Körperstrom, (2) Leitungswiderstand und Spannung, (3) Schleifenimpedanz und Abschaltbedingung (Zs, Ia, Zs_max, größte Länge),
   (4) TT (R_A), (5) RCD (Summenstrom, Ableitströme, Verhältnis), (6) Ableitstrom aus Kapazität, Grenzstrom, größtes C, (7) Isolation und Parallelwiderstand;
   dazu der Übungsgenerator ("Neue Aufgabe") für alle ELS_CORE.exercise-Arten (Prüfung mit exercise.check, Zähler elscalc).
   ALLE Zahlen kommen aus ELS_CORE (formulas[id].explain, grid.condition, body.zone, leak.touch, limit/limitText/limitOK, exercise); hier steht keine zweite Formelimplementierung
   (SPEC Regel 7). Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen. Alle Beispielwerte in den Feldern sind Übungswerte, Grenzwerte tragen ihren Status aus ELS_CORE.limits.
   Schnittstelle (VERTRAG 6.5): window.ELS_UI_EXT.calc.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter ELS_UI_EXT.calc.fn und werden von test_elsui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ELS_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { if (!u) return fm(v, 2); const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (elscore.js und elscore-pruef.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (elscore.js oder elscore-pruef.js ist nicht vollständig geladen). Dieser Rechner liefert deshalb keine Zahlen.';
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben lesen */
  /* Text -> SI-Zahl: mit Einheit im Text (z. B. "30 mA") nimmt der Kern sie, ohne Einheit gilt die Anzeigeeinheit des Feldes (f.scale) */
  function readNum(txt, f) {
    const C = CORE(); if (typeof txt === 'number') return fin(txt) ? txt * (f && f.scale && f.numIsDisplay ? f.scale : 1) : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    let q = null; if (C && typeof C.parseQty === 'function') q = tryf(() => C.parseQty(t), null);
    if (q && fin(q.v)) return q.hasUnit ? q.v : q.raw * ((f && f.scale) || 1);
    const v = C && typeof C.parseNum === 'function' ? tryf(() => C.parseNum(t), NaN) : parseFloat(t.replace(/\s/g, '').replace(',', '.'));
    return fin(v) ? v * ((f && f.scale) || 1) : NaN;
  }
  const lim = id => { const C = CORE(); return C && typeof C.limit === 'function' ? tryf(() => C.limit(id), null) : null; };
  const limV = (id, d) => { const l = lim(id); return l && fin(l.value) ? l.value : d; };
  const limT = id => { const C = CORE(); return C && typeof C.limitText === 'function' ? tryf(() => C.limitText(id), '') : ''; };
  const cst = k => { const C = CORE(); return C && C.const && fin(C.const[k]) ? C.const[k] : undefined; };
  const dnum = x => (fin(x) ? fm(Number(Number(x).toPrecision(6)), 6).replace(/,?0+$/, '') : '');

  /* ============================================================ Karten und Zeilen (Daten, keine Formeln) */
  const F = (key, label, unit, scale, def, o) => Object.assign({ key, label, unit, scale: scale || 1, def }, o || {});
  const SEL = (key, label, options, def, text) => ({ key, label, select: options, def, unit: '', text: !!text });
  const RHOS = () => [[dnum(cst('rho') != null ? cst('rho') : 0.0178), 'Kupfer neu'], [dnum(cst('rhoAlt') != null ? cst('rhoAlt') : 0.0172), 'Kupfer alt (ebenfalls zulässig)']];
  const CARDS = [
    { id: 'c1', icon: '⚡', title: '1 Ohm und Körperstrom', rows: ['ohm', 'koerperStrom'] },
    { id: 'c2', icon: '📏', title: '2 Leitungswiderstand, Spannung und Betriebsstrom', rows: ['rLeiter', 'ohmL', 'ibNenn'] },
    { id: 'c3', icon: '🔁', title: '3 Schleifenimpedanz und Abschaltbedingung', rows: ['zs', 'iF', 'ia', 'zsMax', 'maxL', 'uB', 'cond'] },
    { id: 'c4', icon: '🌍', title: '4 TT-System: Erdungswiderstand R_A', rows: ['raTT'] },
    { id: 'c5', icon: '🛡️', title: '5 RCD: Summenstrom und Ableitströme', rows: ['rcdSum', 'rcdRatio'] },
    { id: 'c6', icon: '〰️', title: '6 Ableitstrom aus der Kapazität', rows: ['ableit', 'cMax'] },
    { id: 'c7', icon: '🧱', title: '7 Isolation und Parallelwiderstand', rows: ['iIso', 'rParallel'] }
  ];
  /* row: id, formula (Kern-Id), title, fields (Reihenfolge = Argumente von formulas[formula].explain), extra */
  const ROWS = () => ({
    ohm: { formula: 'ohm', title: 'Spannung aus Widerstand und Strom', fields: [F('R', 'Widerstand R', 'Ω', 1, '230'), F('I', 'Strom I', 'mA', 1e-3, '30')], extra: 'ohm' },
    koerperStrom: { formula: 'koerperStrom', title: 'Körperstrom', fields: [F('U', 'Spannung U', 'V', 1, '230'), F('Rk', 'Körperwiderstand R_K (Rechenwert)', 'Ω', 1, '1000'), F('Rv', 'Übergangswiderstand R_v', 'Ω', 1, '0')], extra: 'zone' },
    rLeiter: { formula: 'rLeiter', title: 'Leitungswiderstand', fields: [F('l', 'Länge l', 'm', 1, '20'), F('q', 'Querschnitt q', 'mm²', 1, '2,5'), SEL('rho', 'Spezifischer Widerstand ρ in Ω·mm²/m', RHOS(), dnum(cst('rho') != null ? cst('rho') : 0.0178))] },
    ohmL: { formula: 'ohm', title: 'Spannungsfall an der Leitung (U = R · I)', fields: [F('R', 'Widerstand R', 'Ω', 1, '0,142'), F('I', 'Strom I', 'A', 1, '16')] },
    ibNenn: { formula: 'ibNenn', title: 'Betriebsstrom aus der Leistung', fields: [F('P', 'Leistung P', 'W', 1, '2300'), F('U', 'Spannung U', 'V', 1, dnum(cst('U0') != null ? cst('U0') : 230)), F('cos', 'cos φ', '', 1, '1')] },
    zs: { formula: 'zs', title: 'Schleifenimpedanz Zs', fields: [F('Zv', 'Netzimpedanz Zv', 'Ω', 1, '0,4'), F('Rl', 'Leiterwiderstand R_L', 'Ω', 1, '0,142'), F('Rpe', 'Schutzleiterwiderstand R_PE', 'Ω', 1, '0,142')] },
    iF: { formula: 'iF', title: 'Fehlerstrom I_F', fields: [F('U0', 'Spannung U0', 'V', 1, dnum(cst('U0') != null ? cst('U0') : 230)), F('Zs', 'Schleifenimpedanz Zs', 'Ω', 1, '0,6848')] },
    ia: { formula: 'ia', title: 'Auslösestrom Ia', fields: [F('k', 'Faktor (B: 5, C: 10, D: 20)', '', 1, '5'), F('In', 'Nennstrom In', 'A', 1, '16')], note: () => 'Faktor Typ B: ' + limT('faktor_b') + '; Typ C und D: ' + limT('ls_bcd') + '.' },
    zsMax: { formula: 'zsMax', title: 'Größte Schleifenimpedanz Zs_max', fields: [F('U0', 'Spannung U0', 'V', 1, dnum(cst('U0') != null ? cst('U0') : 230)), F('Ia', 'Auslösestrom Ia', 'A', 1, '80')] },
    maxL: { formula: 'maxL', title: 'Größte Leitungslänge', fields: [F('Zm', 'Zs_max', 'Ω', 1, '2,875'), F('Zv', 'Netzimpedanz Zv', 'Ω', 1, '0,4'), F('q', 'Querschnitt Außenleiter q', 'mm²', 1, '2,5'), F('qpe', 'Querschnitt Schutzleiter q_PE', 'mm²', 1, '2,5'), SEL('rho', 'Spezifischer Widerstand ρ in Ω·mm²/m', RHOS(), dnum(cst('rho') != null ? cst('rho') : 0.0178))] },
    uB: { formula: 'uB', title: 'Berührungsspannung U_B', fields: [F('I', 'Fehlerstrom I_F', 'A', 1, '336'), F('Rpe', 'Schutzleiterwiderstand R_PE', 'Ω', 1, '0,142')], extra: 'ub' },
    cond: { formula: null, title: 'Abschaltbedingung komplett prüfen (Kern: grid.condition)', fields: [SEL('form', 'Netzform', [['TN-S', 'TN-S'], ['TN-C-S', 'TN-C-S']], 'TN-S', true), SEL('dev', 'Schutzorgan', [['LS-B', 'LS-Schalter B'], ['LS-C', 'LS-Schalter C'], ['LS-D', 'LS-Schalter D'], ['gG', 'Sicherung gG']], 'LS-B', true), F('In', 'Nennstrom In', 'A', 1, '16'), F('l', 'Länge l', 'm', 1, '20'), SEL('q', 'Querschnitt (Außen- und Schutzleiter)', [['1,5', '1,5 mm²'], ['2,5', '2,5 mm²'], ['4', '4 mm²'], ['6', '6 mm²']], '2,5'), F('Zv', 'Netzimpedanz Zv', 'Ω', 1, '0,4')] },
    raTT: { formula: 'raTT', title: 'Größter Erdungswiderstand R_A,max', fields: [F('UL', 'Grenzspannung U_L', 'V', 1, dnum(limV('ul_ac', 50))), F('Idn', 'Nennfehlerstrom IΔn', 'mA', 1e-3, '30')], extra: 'ultrocken', note: () => 'U_L: ' + limT('ul_ac') + '.' },
    rcdSum: { formula: 'rcdSum', title: 'Summe der Ableitströme', fields: [F('I1', 'Ableitstrom 1', 'mA', 1e-3, '1'), F('I2', 'Ableitstrom 2', 'mA', 1e-3, '0,5'), F('I3', 'Ableitstrom 3 (leer = 0)', 'mA', 1e-3, '', { opt: 'zero' })] },
    rcdRatio: { formula: 'rcdRatio', title: 'Verhältnis zum Nennfehlerstrom', fields: [F('Iab', 'Summe der Ableitströme', 'mA', 1e-3, '15'), F('Idn', 'Nennfehlerstrom IΔn', 'mA', 1e-3, '30')], extra: 'ratio', note: () => 'Schwelle für "Fehlauslösung nahe": ' + limT('rcd_bereich') + '.' },
    ableit: { formula: 'ableit', title: 'Ableitstrom über einen Kondensator', fields: [F('C', 'Kapazität C', 'nF', 1e-9, '2,2'), F('U', 'Spannung U', 'V', 1, dnum(cst('U0') != null ? cst('U0') : 230)), F('f', 'Frequenz f', 'Hz', 1, dnum(cst('f') != null ? cst('f') : 50))], extra: 'touch' },
    cMax: { formula: 'cMax', title: 'Größte Kapazität bei Grenzstrom', fields: [F('I', 'Grenzstrom I', 'mA', 1e-3, dnum(limV('ber_sk2', 0.5))), F('U', 'Spannung U', 'V', 1, dnum(cst('U0') != null ? cst('U0') : 230)), F('f', 'Frequenz f', 'Hz', 1, dnum(cst('f') != null ? cst('f') : 50))], note: () => 'Vorbelegt mit dem Berührungsstrom-Grenzwert SK II: ' + limT('ber_sk2') + '.' },
    iIso: { formula: 'iIso', title: 'Strom durch die Isolation', fields: [F('U', 'Prüfspannung U_prüf', 'V', 1, dnum(limV('upruef_iso', 500))), F('R', 'Isolationswiderstand R_iso', 'MΩ', 1e6, '2')], note: () => 'Prüfspannung: ' + limT('upruef_iso') + '.' },
    rParallel: { formula: 'rParallel', title: 'Parallelschaltung von Isolationswiderständen', fields: [F('R1', 'R1', 'MΩ', 1e6, '4'), F('R2', 'R2', 'MΩ', 1e6, '4'), F('R3', 'R3 (leer = nicht vorhanden)', 'MΩ', 1e6, '', { opt: 'skip' })], extra: 'riso' }
  });
  let _rows = null; const rows = () => (_rows = ROWS());
  const rowById = id => rows()[id] || null;
  function cardList() { return CARDS.map(c => ({ id: c.id, icon: c.icon, title: c.title, rows: c.rows.slice() })); }

  /* ============================================================ reine Rechenfunktionen (alle rufen ELS_CORE) */
  function formulaList() { const C = CORE(), f = C && C.formulas; if (!f || typeof f.list !== 'function') return []; return tryf(() => f.list(), []); }
  function formulaById(id) { const C = CORE(), f = C && C.formulas; return f && Object.prototype.hasOwnProperty.call(f, id) && f[id] && typeof f[id].explain === 'function' ? f[id] : null; }
  function defaultsOf(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { o[f.key] = f.def; }); return o; }
  function argsOf(r, vals) {
    const out = [], bad = [];
    r.fields.forEach(f => {
      const raw = vals && vals[f.key] != null ? vals[f.key] : f.def, blank = String(raw == null ? '' : raw).trim() === '';
      if (f.opt && blank) { if (f.opt === 'zero') out.push(0); return; }
      if (f.text) { if (!f.select.some(o => o[0] === String(raw))) bad.push(f.label); out.push(String(raw)); return; }
      const v = readNum(raw, f);
      if (!fin(v)) bad.push(f.label); out.push(v);
    });
    return { args: out, bad };
  }
  /* Zusatzzeilen: nur Aussagen, die der Kern vergleicht (Regel 2) */
  function extraLines(kind, res, args, C) {
    const out = [];
    if (kind === 'zone' && C.body && typeof C.body.zone === 'function') { const z = tryf(() => C.body.zone(res.value, 1000), null); if (z && z.ok !== false && z.text) out.push(z.text + ' ' + (C.TEXTS && C.TEXTS.rkRechenwert ? C.TEXTS.rkRechenwert : '')); }
    if (kind === 'ultrocken' && C.TEXTS && C.TEXTS.ulTrocken) out.push(C.TEXTS.ulTrocken);
    if (kind === 'ub' && typeof C.limitOK === 'function') { const ul = limV('ul_ac', NaN); if (fin(ul)) out.push('U_B = ' + eng(res.value, 'V') + (res.value <= ul ? ' liegt nicht über ' : ' liegt über ') + 'U_L: ' + limT('ul_ac') + '.'); }
    if (kind === 'ratio') { const l = lim('rcd_bereich'); if (l && fin(l.value)) out.push('Verhältnis ' + fm(res.value, 2) + (res.value >= l.value ? ' erreicht oder überschreitet ' : ' liegt unter ') + limT('rcd_bereich') + ': ' + (res.value >= l.value ? 'Fehlauslösung nahe.' : 'noch kein Hinweis auf Fehlauslösung.')); }
    if (kind === 'touch' && C.leak && typeof C.leak.touch === 'function') { const t = tryf(() => C.leak.touch({ C: args[0], U: args[1], f: args[2], sk: 'II' }), null); if (t && t.ok !== false && t.text) out.push(t.text); }
    if (kind === 'riso' && typeof C.limitOK === 'function') {
      const mo = res.value / 1e6, a = tryf(() => C.limitOK('riso_sk1', mo), null), b = tryf(() => C.limitOK('riso_sk2', mo), null);
      if (typeof a === 'boolean' && typeof b === 'boolean') out.push('R = ' + fm(mo, 3) + ' MΩ: Schutzklasse I (' + limT('riso_sk1') + ') ' + (a ? 'eingehalten' : 'nicht eingehalten') + ', Schutzklasse II (' + limT('riso_sk2') + ') ' + (b ? 'eingehalten' : 'nicht eingehalten') + '.');
    }
    if (kind === 'ohm') { /* keine Zusatzaussage */ }
    return out;
  }
  /* Eine Zeile rechnen: Ergebnis genau aus formulas[id].explain (oder grid.condition) */
  function calc(rowId, vals) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    const r = rowById(rowId); if (!r) return { ok: false, why: 'Diesen Rechner gibt es nicht.' };
    const { args, bad } = argsOf(r, vals);
    if (bad.length) return { ok: false, why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt): ' + bad.join(', ') + '.' };
    if (r.formula === null) return condCalc(C, r, args);
    const f = formulaById(r.formula); if (!f) return { ok: false, why: NOFN('formulas.' + r.formula + '.explain') };
    let e = null; try { e = f.explain.apply(null, args); } catch (x) { e = null; }
    if (!e || e.ok === false || !fin(e.value)) return { ok: false, why: (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0 oder ein Wert kleiner oder gleich 0).' };
    const unit = e.unit != null ? e.unit : (f.unit || '');
    const res = { ok: true, id: r.formula, row: rowId, value: e.value, unit, shown: eng(e.value, unit), steps: [e.text], text: e.text, args, extra: [], note: r.note ? r.note() : '' };
    if (r.extra) res.extra = extraLines(r.extra, res, args, C);
    return res;
  }
  function condCalc(C, r, a) {
    if (!C.grid || typeof C.grid.condition !== 'function') return { ok: false, why: NOFN('grid.condition') };
    const cfg = { form: String(argsRaw(r, a, 'form')), dev: String(argsRaw(r, a, 'dev')), In: argsRaw(r, a, 'In'), l: argsRaw(r, a, 'l'), q: argsRaw(r, a, 'q'), zv: argsRaw(r, a, 'Zv') };
    cfg.qpe = cfg.q;
    const c = tryf(() => C.grid.condition(cfg), null);
    if (!c || c.ok === false) return { ok: false, why: (c && c.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, id: 'cond', row: 'cond', value: c.erfuellt === true ? 1 : c.erfuellt === false ? 0 : NaN, erfuellt: c.erfuellt, unit: '', shown: c.erfuellt === true ? 'erfüllt' : c.erfuellt === false ? 'nicht erfüllt' : 'keine Aussage', steps: [c.text], text: c.text, zs: c.zs, zsMax: c.zsMax, args: a, extra: [], note: '' };
  }
  function argsRaw(r, a, key) { const i = r.fields.findIndex(f => f.key === key); return a[i]; }
  function exKinds() { const C = CORE(); return C && C.exercise && Array.isArray(C.exercise.kinds) ? C.exercise.kinds.slice() : []; }
  function exLabel(k) { const f = formulaById(k); return f ? f.name + (f.symbol ? ' (' + f.symbol + ')' : '') : k; }
  function exNew(kind, seed) {
    const C = CORE(); if (!C || !C.exercise) return { ok: false, why: NOCORE };
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
  const CSS = '<style>.ec-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.ec-g label{flex:1 1 150px;min-width:130px;font-size:12.5px;color:var(--mute)}.ec-g input,.ec-g select{margin-top:3px;min-height:42px}.ec-row{padding:10px 12px;border-top:1px solid var(--line)}.ec-row:first-child{border-top:0}.ec-row h5{margin:0;font-size:14px}.ec-res{margin-top:8px}.ec-bad{color:var(--danger);font-size:13.5px;margin:6px 0 0}.ec-q{font-size:15px;line-height:1.5;margin:6px 0}</style>';
  function fieldHtml(rowId, f) {
    const k = rowId + '.' + f.key, v = ST.vals[k] != null ? ST.vals[k] : f.def, id = 'ec_' + rowId + '_' + f.key;
    const lbl = esc(f.label) + (f.unit ? ' in ' + esc(f.unit) : '');
    if (f.select) return `<label for="${id}">${lbl}<select id="${id}" data-f="${esc(k)}">${f.select.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
    return `<label for="${id}">${lbl}<input id="${id}" data-f="${esc(k)}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`;
  }
  function resHtml(res) {
    if (!res) return '';
    if (!res.ok) return `<p class="ec-bad" role="status">${esc(res.why)}</p>`;
    return `<div class="res"><div class="big2">${esc(res.shown)}</div><ol><li>${esc(res.text)}</li></ol>${res.extra.map(t => `<p class="hint2">${esc(t)}</p>`).join('')}${res.note ? `<p class="hint2">${esc(res.note)}</p>` : ''}</div>`;
  }
  function rowVals(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { const k = rowId + '.' + f.key; o[f.key] = ST.vals[k] != null ? ST.vals[k] : f.def; }); return o; }
  function rowHtml(rowId) {
    const r = rowById(rowId); if (!r) return '';
    return `<div class="ec-row" data-row="${esc(rowId)}"><h5>${esc(r.title)}</h5>${r.formula && formulaById(r.formula) ? `<p class="hint2" style="margin:2px 0 0">${esc(formulaById(r.formula).expr)}</p>` : ''}<div class="ec-g">${r.fields.map(f => fieldHtml(rowId, f)).join('')}</div><div class="ec-res" data-res="${esc(rowId)}" aria-live="polite">${resHtml(calc(rowId, rowVals(rowId)))}</div></div>`;
  }
  function cardHtml(c, open) {
    return `<details class="card" data-card="${esc(c.id)}"${open ? ' open' : ''}><summary>${c.icon} ${esc(c.title)}</summary><div class="cb">${c.rows.map(rowHtml).join('')}</div></details>`;
  }
  function exHtml() {
    const kinds = exKinds(), ex = ST.ex;
    const sel = `<label for="ec_kind">Art der Aufgabe<select id="ec_kind" data-act-sel="kind">${kinds.map(k => `<option value="${esc(k)}"${k === ST.kind ? ' selected' : ''}>${esc(exLabel(k))}</option>`).join('')}</select></label>`;
    let body = '';
    if (!kinds.length) body = `<p class="ec-bad">${esc(CORE() ? NOFN('exercise') : NOCORE)}</p>`;
    else if (ex && ex.ok === false) body = `<p class="ec-bad">${esc(ex.why)}</p>`;
    else if (ex) {
      const res = ST.res;
      body = `<p class="ec-q" data-ex="q">${esc(ex.question)}</p><label for="ec_ans">Deine Antwort (Einheit: ${esc(ex.answer.unit)})<input id="ec_ans" data-ans="1" inputmode="decimal" autocomplete="off" value="${esc(ST.ans)}"></label>
        <div class="btns"><button class="btn pri" data-act="check">Prüfen</button><button class="btn" data-act="steps">Rechenweg zeigen</button><button class="btn" data-act="newex">Neue Aufgabe</button></div>
        <div data-ex="res" aria-live="polite">${res ? `<div class="ex ${res.ok ? 'ok' : 'bad'}"><b>${res.ok ? 'Richtig. ' : ''}</b>${esc(res.text)}${!res.ok && res.why ? `<details><summary>Warum?</summary>${esc(res.why)}</details>` : ''}</div>` : ''}${ST.show ? `<div class="ex"><b>Rechenweg</b><ol>${(ex.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="hint2">Ergebnis: ${esc(fm(ex.answer.value, 4))} ${esc(ex.answer.unit)}</p></div>` : ''}</div>`;
    } else body = `<div class="btns"><button class="btn pri" data-act="newex">Neue Aufgabe</button></div>`;
    return `<details class="card" data-card="ex" open><summary>🎯 Übungsgenerator: Neue Aufgabe</summary><div class="cb"><div class="ec-row"><div class="ec-g">${sel}</div>${body}</div></div></details>`;
  }
  function renderAll() {
    const C = CORE();
    const top = `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für das Sicherheits-Lab</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, Zahlen mit Komma, Rechenweg zum Nachvollziehen. Die Vorgaben in den Feldern sind Übungswerte; Grenzwerte tragen ihren Status (✓ belegt oder Übungswert (A)). ${esc(C && C.TEXTS && C.TEXTS.simOnly ? C.TEXTS.simOnly : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="ec-bad">${esc(NOCORE)}</p></div>`;
    return CSS + top + CARDS.map((c, i) => cardHtml(c, i === 0)).join('') + exHtml();
  }
  function newEx(newSeed) {
    const kinds = exKinds(); if (!kinds.length) { ST.ex = null; return; }
    if (!ST.kind || kinds.indexOf(ST.kind) < 0) ST.kind = kinds[0];
    if (!ST.seed) ST.seed = 1 + Math.floor(Date.now() / 1000) % 100000; else if (newSeed) ST.seed += 1;
    ST.ex = exNew(ST.kind, ST.seed); ST.ans = ''; ST.res = null; ST.show = false;
  }
  function stat(n) { try { if (A && typeof A.stat === 'function') A.stat('elscalc', n == null ? 1 : n); } catch (e) {} }
  function redrawEx(host) { const card = host.querySelector('[data-card="ex"]'); if (card) card.outerHTML = exHtml(); else host.innerHTML = renderAll(); }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset) return;
    if (t.dataset.f) {
      ST.vals[t.dataset.f] = t.value; const rowId = t.dataset.f.split('.')[0], el = host.querySelector('[data-res="' + rowId + '"]');
      if (el) el.innerHTML = resHtml(calc(rowId, rowVals(rowId)));
      if (e.type === 'change') { const r = calc(rowId, rowVals(rowId)); if (r && r.ok) stat(); }
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
    A = api || A; ST.ex = null; const kinds = exKinds(); if (kinds.length) { if (!ST.kind) ST.kind = kinds[0]; if (!ST.ex) newEx(false); }
    host.innerHTML = renderAll();
    if (!host._elsCalc) { host._elsCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, fn: { cardList, rowById, defaultsOf, calc, formulaList, formulaById, readNum, exKinds, exLabel, exNew, exCheck, extraLines }, _st: ST };
  root.ELS_UI_EXT = root.ELS_UI_EXT || {}; root.ELS_UI_EXT.calc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
