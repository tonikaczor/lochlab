'use strict';
/* Tonfunk Analogtechnik-Lab: Tab "Auslegen" (WP3c, SPEC 6.4).
   Assistent in vier Schritten, jeder mit Häkchen: (1) Aufgabe wählen (LED-Vorwiderstand, Transistorschalter mit Basisvorwiderstand, Arbeitspunkt der Emitterschaltung,
   Operationsverstärker auf Verstärkung, Schmitt-Trigger auf Schaltschwellen, Filter und Integrierer auf Grenzfrequenz), (2) Vorgaben, (3) Bauteile (genauer Wert aus dem Kern,
   Vorschlag aus der E12-/E24-Reihe mit Abweichung, Rechenweg), (4) Ergebnis (Ampel aus assess, Gegenprobe über den Kern).
   ALLE Rechnungen und Texte kommen aus ANA_CORE (diode.rvFor/operating/types, tr.rbFor/switch/dc, op.inv/nin, komp.schmitt, act.tp/hp/integrator, formulas.get(id).calc, assess, TEXTS, limits);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Gesuchte Größen, für die der Kern keine Umkehrfunktion hat (Widerstand zur Grenzfrequenz, Schwellenwiderstand,
   Arbeitspunkt-Spannung), werden durch Halbieren über dieselbe Kernfunktion gefunden (Hilfsroutine bisect), nicht durch eine eigene Formel. Fehlt der Kern oder eine Funktion,
   erscheint ein deutscher Hinweis statt Zahlen. Alle Vorgaben sind Übungswerte (A); die Reihen E12 und E24 sind Wertetabellen, keine Physik.
   Speichern: lsSet('ana.design', { v, st, step }); getState()/setState(o) für Speichern und Teilen.
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.design.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter ANA_UI_EXT.design.fn
   und werden von quelle/analab/test_anaui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ANA_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (anacore.js, anacore-op.js und anacore-res.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (anacore.js, anacore-op.js oder anacore-res.js ist nicht vollständig geladen). Dieser Assistent liefert deshalb keine Zahlen.';
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limV = (id, d) => { const C = CORE(); const l = C && typeof C.limit === 'function' ? tryf(() => C.limit(id), null) : null; return l && fin(l.value) ? l.value : d; };
  const limT = id => { const C = CORE(); return C && typeof C.limitText === 'function' ? tryf(() => C.limitText(id), '') : ''; };
  const dnum = x => { if (!fin(x)) return ''; const s = String(Number(Number(x).toPrecision(6))); return /e/.test(s) ? fm(Number(Number(x).toPrecision(6)), 6) : s.replace('.', ','); };
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben */
  const TASKS = [['led', 'LED: Vorwiderstand'], ['schalter', 'Transistorschalter: Basisvorwiderstand'], ['emitter', 'Emitterschaltung: Arbeitspunkt'],
    ['opv', 'Operationsverstärker auf eine Verstärkung'], ['schmitt', 'Schmitt-Trigger auf Schaltschwellen'], ['aktiv', 'Filter und Integrierer auf eine Grenzfrequenz']];
  const STEPS = [[1, '🎯', 'Aufgabe'], [2, '📝', 'Vorgaben'], [3, '🔧', 'Bauteile'], [4, '✅', 'Ergebnis']];
  const TITLES = ['Aufgabe: Was soll ausgelegt werden?', 'Vorgaben: Was ist verlangt?', 'Bauteile: Genauer Wert und Vorschlag aus der Reihe', 'Ergebnis und Gegenprobe'];
  /* Prüfstand je Aufgabe (opv und schmitt hängen von der Wahl ab) */
  const rigOf = st => ({ led: 'diode', schalter: 'schalter', emitter: 'emitter', opv: st && st.opv && st.opv.art === 'nin' ? 'opv_nin' : 'opv_inv', schmitt: 'opv_komp', aktiv: 'opv_aktiv' }[st && st.task] || '');
  /* Felder je Aufgabe: key, Beschriftung (oder labels je Wert des Feldes "by"), Anzeigeeinheit, Skalierung auf SI, Vorgabe (Übungswert) oder select; when = nur anzeigen/lesen, wenn das andere Feld diesen Wert hat */
  const FIELDS = () => ({
    led: [{ key: 'typ', label: 'Bauteil', select: [['led_rot', 'LED rot'], ['led_gelb', 'LED gelb'], ['led_gruen', 'LED grün'], ['led_blau', 'LED blau'], ['si', 'Silizium-Diode'], ['schottky', 'Schottky-Diode']], def: 'led_rot' },
      { key: 'uq', label: 'Quellenspannung U_q', unit: 'V', scale: 1, def: '24' }, { key: 'i', label: 'Gewünschter Strom I', unit: 'mA', scale: 1e-3, def: '12' }],
    schalter: [{ key: 'ub', label: 'Betriebsspannung U_B', unit: 'V', scale: 1, def: '5' }, { key: 'ust', label: 'Steuerspannung U_St', unit: 'V', scale: 1, def: '5' },
      { key: 'last', label: 'Last', select: [['led', 'LED mit Vorwiderstand'], ['ohm', 'Ohmsche Last']], def: 'led' },
      { key: 'uf', label: 'Flussspannung der LED U_F', unit: 'V', scale: 1, def: '2', when: ['last', 'led'] }, { key: 'rv', label: 'LED-Vorwiderstand R_V', unit: 'Ω', scale: 1, def: '330', when: ['last', 'led'] },
      { key: 'rlast', label: 'Lastwiderstand', unit: 'Ω', scale: 1, def: '100', when: ['last', 'ohm'] },
      { key: 'b', label: 'Gleichstromverstärkung B', unit: '', scale: 1, def: dnum(limV('b_std', 100)) }, { key: 'ueb', label: 'Übersteuerungsfaktor ü (Vorgabe)', unit: '', scale: 1, def: dnum(limV('ue_typ', 3)) }],
    emitter: [{ key: 'ub', label: 'Betriebsspannung U_B', unit: 'V', scale: 1, def: '12' }, { key: 'ic', label: 'Kollektorstrom I_C im Arbeitspunkt', unit: 'mA', scale: 1e-3, def: '2' },
      { key: 'uce', label: 'Kollektor-Emitter-Spannung U_CE im Arbeitspunkt', unit: 'V', scale: 1, def: '6' }, { key: 're1', label: 'Emitterwiderstand R_E1 (ungebrückt)', unit: 'Ω', scale: 1, def: '100' },
      { key: 're2', label: 'Emitterwiderstand R_E2 (gebrückt)', unit: 'Ω', scale: 1, def: '470' }, { key: 'b', label: 'Gleichstromverstärkung B', unit: '', scale: 1, def: dnum(limV('b_std', 100)) },
      { key: 'i1', label: 'Querstrom I_1 im Basisspannungsteiler', unit: 'mA', scale: 1e-3, def: '0,5' }],
    opv: [{ key: 'art', label: 'Schaltung', select: [['inv', 'Invertierender Verstärker'], ['nin', 'Nichtinvertierender Verstärker']], def: 'inv' },
      { key: 'v', by: 'art', labels: { inv: 'Verstärkung |V_u| (das Minuszeichen ergibt die Schaltung)', nin: 'Verstärkung V_u (mindestens 1)' }, unit: '', scale: 1, def: '10' },
      { key: 'r', by: 'art', labels: { inv: 'Eingangswiderstand R_1 (gewählt)', nin: 'Widerstand nach Masse R_g (gewählt)' }, unit: 'kΩ', scale: 1e3, def: '10' },
      { key: 'ue', label: 'Eingangsspannung U_e (Gleichwert)', unit: 'V', scale: 1, def: '0,5' }, { key: 'uv', label: 'Betriebsspannung ± U_B', unit: 'V', scale: 1, def: dnum(limV('uv_std', 12)) },
      { key: 'opv', label: 'Operationsverstärker', select: [['ideal', 'ideal'], ['langsam', 'Lehrmodell langsam (Übungswerte)'], ['schnell', 'Lehrmodell schnell (Übungswerte)']], def: 'ideal' }],
    schmitt: [{ key: 'art', label: 'Schaltung', select: [['inv', 'Invertierender Schmitt-Trigger'], ['nin', 'Nichtinvertierender Schmitt-Trigger']], def: 'inv' },
      { key: 'uo', label: 'Obere Schaltschwelle U_o (die untere liegt bei −U_o)', unit: 'V', scale: 1, def: '4' }, { key: 'uv', label: 'Betriebsspannung ± U_B', unit: 'V', scale: 1, def: dnum(limV('uv_std', 12)) },
      { key: 'r', by: 'art', labels: { inv: 'Mitkopplungswiderstand R_2 (gewählt)', nin: 'Eingangswiderstand R_1 (gewählt)' }, unit: 'kΩ', scale: 1e3, def: '20' }],
    aktiv: [{ key: 'art', label: 'Schaltung', select: [['tiefpass', 'Aktiver Tiefpass (invertierend)'], ['hochpass', 'Aktiver Hochpass (invertierend)'], ['integrierer', 'Integrierer']], def: 'tiefpass' },
      { key: 'fg', by: 'art', labels: { tiefpass: 'Grenzfrequenz f_g', hochpass: 'Grenzfrequenz f_g', integrierer: 'Frequenz f_ref mit |V| = 1' }, unit: 'Hz', scale: 1, def: '1000' },
      { key: 'c', label: 'Kondensator C (gewählt)', unit: 'nF', scale: 1e-9, def: '10' }, { key: 'v', label: 'Verstärkung |V| im Durchlassbereich', unit: '', scale: 1, def: '10', whenNot: ['art', 'integrierer'] },
      { key: 'ue', label: 'Eingangsamplitude U_e (Sinus)', unit: 'V', scale: 1, def: '0,5' }, { key: 'uv', label: 'Betriebsspannung ± U_B', unit: 'V', scale: 1, def: dnum(limV('uv_std', 12)) }]
  });
  const REIHEN = [['E12', 'E12 (zwölf Werte je Dekade)'], ['E24', 'E24 (vierundzwanzig Werte je Dekade)']];
  const E_SERIES = { E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2], E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1] };
  function defaults() { const st = { task: 'led', reihe: 'E12' }; const F = FIELDS(); Object.keys(F).forEach(t => { st[t] = {}; F[t].forEach(f => { st[t][f.key] = f.def; }); }); return st; }
  const ST = { st: defaults(), step: 1 };

  /* reine Zahl gilt in der Anzeigeeinheit des Feldes, mit Vorsatz/Einheit ("4,7 kΩ", "12 mA", "4k7") nimmt der Kern sie in SI */
  const PLAIN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i;
  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1;
    if (typeof txt === 'number') return fin(txt) ? Number((txt * sc).toPrecision(12)) : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    if (PLAIN.test(t)) { const x = Number(t.replace(',', '.')); return fin(x) ? Number((x * sc).toPrecision(12)) : NaN; }
    const q = C && typeof C.parseQty === 'function' ? tryf(() => C.parseQty(t), NaN) : NaN;
    return fin(q) ? q : NaN;
  }
  /* Feld gilt für den aktuellen Zustand? (when/whenNot gegen ein anderes Feld derselben Aufgabe) */
  function relevant(f, src, all) {
    const cur = k => { const d = all.find(x => x.key === k); return src[k] != null ? String(src[k]) : (d ? String(d.def) : ''); };
    if (f.when) return cur(f.when[0]) === f.when[1];
    if (f.whenNot) return cur(f.whenNot[0]) !== f.whenNot[1];
    return true;
  }
  const labelOf = (f, src) => { if (f.labels) { const k = src && src[f.by] != null ? String(src[f.by]) : ''; return f.labels[k] || f.labels[Object.keys(f.labels)[0]]; } return f.label; };
  /* Vorgaben des gewählten Falls in SI lesen: { v:{key:Zahl}, bad:[Labels] } */
  function read(st) {
    const F = FIELDS()[st.task] || [], src = st[st.task] || {}, v = {}, bad = [];
    F.forEach(f => {
      if (!relevant(f, src, F)) return;
      const raw = src[f.key] != null ? src[f.key] : f.def;
      if (f.select) { if (!f.select.some(o => o[0] === String(raw))) bad.push(labelOf(f, src)); v[f.key] = String(raw); return; }
      const x = readNum(raw, f); if (!fin(x)) bad.push(labelOf(f, src)); v[f.key] = x;
    });
    return { v, bad };
  }

  /* ============================================================ Hilfen: Reihe und Suche (keine Physik) */
  function seriesAround(target, name) {
    const base = E_SERIES[name] || E_SERIES.E12, out = [];
    if (!(target > 0) || !fin(target)) return out;
    const d0 = Math.floor(Math.log10(target));
    for (let d = d0 - 1; d <= d0 + 1; d++) base.forEach(b => out.push(Number((b * Math.pow(10, d)).toPrecision(12))));
    return out.sort((a, b) => a - b);
  }
  /* nächster Reihenwert (Abstand im Verhältnis); accept(w) filtert unzulässige Werte */
  function nearest(target, name, accept) {
    const L = seriesAround(target, name).filter(w => !accept || accept(w));
    let best = null, bd = Infinity;
    L.forEach(w => { const d = Math.abs(Math.log(w / target)); if (d < bd) { bd = d; best = w; } });
    return best;
  }
  /* Halbieren (geometrisch) einer monotonen Kernfunktion g(x) auf den Zielwert; liefert x oder NaN */
  function bisect(g, target, lo, hi) {
    const a0 = g(lo), b0 = g(hi); if (!fin(a0) || !fin(b0) || a0 === b0 || !fin(target)) return NaN;
    const up = b0 > a0; if ((up && (target < a0 || target > b0)) || (!up && (target > a0 || target < b0))) return NaN;
    let a = lo, b = hi;
    for (let i = 0; i < 200; i++) { const m = Math.sqrt(a * b), y = g(m); if (!fin(y)) return NaN; if ((y < target) === up) a = m; else b = m; if (b / a < 1 + 1e-13) break; }
    return Math.sqrt(a * b);
  }
  const devPct = (e, x) => (x ? (e - x) / x * 100 : NaN);       /* Abweichung des Reihenwerts vom genauen Wert, nur Anzeige */
  const devTxt = d => (fin(d) ? (d >= 0 ? '+' : '−') + fm(Math.abs(d), 1) + ' %' : '–');

  /* ============================================================ Rechenfunktionen der sechs Fälle (alle rufen ANA_CORE) */
  const need = (C, path) => { const p = path.split('.'); let o = C; for (let i = 0; i < p.length; i++) { o = o && o[p[i]]; } return typeof o === 'function' ? null : NOFN(path); };
  const missing = (C, list) => list.map(p => need(C, p)).find(x => x) || '';
  const okr = r => r && r.ok !== false && r.valid !== false;
  const why = r => (r && r.why) || (r && r.text) || 'Mit diesen Werten gibt es kein Ergebnis.';
  /* Kernformel aus formulas rechnen: { ok, value, text } oder null */
  function fcalc(id, o) { const C = CORE(), f = C && C.formulas && typeof C.formulas.get === 'function' ? tryf(() => C.formulas.get(id), null) : null; const r = f ? tryf(() => f.calc(o), null) : null; return r && r.ok !== false && r.valid !== false && fin(r.value) ? r : null; }
  const fval = (id, o) => { const r = fcalc(id, o); return r ? r.value : NaN; };
  const blank = (s2why, s3why) => [{ ok: true, lines: [] }, { ok: !s2why, lines: [], why: s2why || '' }, { ok: false, lines: [], why: s3why || '' }, { ok: false, lines: [] }];
  const ampelStep = a => ({ ok: !!(a && a.ok !== false && a.ampel), lines: [], why: a && a.ok === false ? why(a) : '' });
  const OPVNAME = { ideal: 'idealer Operationsverstärker', langsam: 'Lehrmodell langsam (Übungswerte)', schnell: 'Lehrmodell schnell (Übungswerte)' };

  function evalLed(C, v, red) {
    const m = missing(C, ['diode.rvFor', 'diode.operating', 'assess']); if (m) return { ok: false, why: m };
    const t = (C.diode.types || []).find(x => x.id === v.typ); if (!t || !fin(t.uf)) return { ok: false, why: 'Dieses Bauteil kennt der Kern nicht.' };
    const uf = t.uf, ex = tryf(() => C.diode.rvFor({ uq: v.uq, uf, i: v.i }), NaN);
    if (!fin(ex)) return { ok: true, task: 'led', steps: blank('Die Quellenspannung muss über der Flussspannung U_F = ' + eng(uf, 'V') + ' liegen, und der Strom muss größer als 0 sein.') };
    const s2 = { ok: true, lines: [] };
    [fcalc('rvLed', { ub: v.uq, uf, i: v.i }), fcalc('pRv', { ub: v.uq, uf, r: ex })].forEach(r => { if (r) s2.lines.push(r.text); });
    s2.lines.push('Flussspannung ' + t.name + ': U_F = ' + eng(uf, 'V') + ' (Übungswert). Zulässiger LED-Strom ' + limT('led_imax') + '.');
    const e = nearest(ex, red);
    const s3 = { ok: !!e, lines: [], why: e ? '' : 'Es gibt keinen Reihenwert zu diesem Widerstand.' };
    if (e) s3.lines.push('Genauer Wert: R_V = ' + eng(ex, 'Ω') + ' (aus diode.rvFor); Vorschlag aus ' + red + ': R_V = ' + eng(e, 'Ω') + ' (Abweichung ' + devTxt(devPct(e, ex)) + ').');
    if (!e) return { ok: true, task: 'led', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const cfg = { typ: v.typ, modell: 'konstant', uq: v.uq, rv: e }, op = tryf(() => C.diode.operating(cfg), null), op2 = tryf(() => C.diode.operating({ typ: v.typ, modell: 'kennlinie', uq: v.uq, rv: e }), null);
    const a = tryf(() => C.assess('diode', Object.assign({}, cfg, { ziel: v.i })), null), s4 = ampelStep(a);
    if (okr(op)) s4.lines.push('Gegenprobe mit R_V = ' + eng(e, 'Ω') + ' und konstanter U_F: I = ' + eng(op.id, 'A') + ', U_R = ' + eng(op.ur, 'V') + ', P_R = ' + eng(op.pr, 'W') + ', P_LED = ' + eng(op.pd, 'W') + '.');
    if (okr(op2)) s4.lines.push('Mit der Kennlinie statt der konstanten U_F: I = ' + eng(op2.id, 'A') + ', U_D = ' + eng(op2.ud, 'V') + '.');
    return { ok: true, task: 'led', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: ex, wert: e, rig: { typ: v.typ, modell: 'konstant', uq: v.uq, rv: e, ziel: v.i }, einheit: 'Ω' };
  }

  function evalSchalter(C, v, red) {
    const m = missing(C, ['tr.rbFor', 'tr.switch', 'assess']); if (m) return { ok: false, why: m };
    const led = v.last === 'led', load = led ? { last: 'led', rv: v.rv, uf: v.uf } : { last: 'ohm', rlast: v.rlast };
    const sw = (rb) => tryf(() => C.tr.switch(Object.assign({ ub: v.ub, ust: v.ust, rb, b: v.b }, load)), null);
    const s0 = sw(1000);
    if (!okr(s0) || !(s0.icSat > 0)) return { ok: true, task: 'schalter', steps: blank(why(s0)) };
    const ex = tryf(() => C.tr.rbFor({ ust: v.ust, ic: s0.icSat, b: v.b, ueb: v.ueb }), null);
    if (!okr(ex)) return { ok: true, task: 'schalter', steps: blank(why(ex)) };
    const s2 = { ok: true, lines: [] };
    [fcalc('icSat', { ub: v.ub, ucesat: limV('ucesat', 0.2), uf: led ? v.uf : 0, rv: led ? v.rv : v.rlast }), fcalc('ibSchalter', { ueb: v.ueb, ic: s0.icSat, b: v.b }),
      fcalc('rbSchalter', { ust: v.ust, ube: limV('ube', 0.7), ib: ex.ib })].forEach(r => { if (r) s2.lines.push(r.text); });
    s2.lines.push('Übersteuerung ü = ' + dnum(v.ueb) + ' (Vorgabe); mindestens ü ' + limT('ue_min') + '.');
    const ueMin = limV('ue_min', 1.5);
    const e = nearest(ex.rb, red, w => { const s = sw(w); return okr(s) && s.zustand === 'saettigung' && s.ueb >= ueMin; });
    const s3 = { ok: !!e, lines: [], why: e ? '' : 'Es gibt keinen Reihenwert, der den Transistor sicher in die Sättigung bringt.' };
    if (e) {
      s3.lines.push('Genauer Wert: R_B = ' + eng(ex.rb, 'Ω') + ' (aus tr.rbFor); größter R_B für gerade eben Sättigung: R_B,max = ' + eng(s0.rbMax, 'Ω') + '.');
      s3.lines.push('Vorschlag aus ' + red + ': R_B = ' + eng(e, 'Ω') + ' (Abweichung ' + devTxt(devPct(e, ex.rb)) + '); gewählt wird nur ein Wert, bei dem ü mindestens ' + fm(ueMin, 2) + ' bleibt (Übungswert).');
    }
    if (!e) return { ok: true, task: 'schalter', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const st = sw(e), cfg = Object.assign({ ub: v.ub, ust: v.ust, rb: e, b: v.b, eingang: 'dauer-ein' }, load);
    const a = tryf(() => C.assess('schalter', Object.assign({}, cfg, { ziel: s0.icSat })), null), s4 = ampelStep(a);
    if (okr(st)) s4.lines.push('Gegenprobe mit R_B = ' + eng(e, 'Ω') + ': I_C = ' + eng(st.ic, 'A') + ', I_B = ' + eng(st.ib, 'A') + ', ü = ' + fm(st.ueb, 2) + ', U_CE = ' + eng(st.uce, 'V') + ', P_V = ' + eng(st.pv, 'W') + '. ' + ({ saettigung: 'Der Transistor ist gesättigt.', aktiv: 'Der Transistor ist aktiv, nicht gesättigt.', sperrt: 'Der Transistor sperrt.' }[st.zustand] || ''));
    return { ok: true, task: 'schalter', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: ex.rb, wert: e, rig: Object.assign({ ub: v.ub, ust: v.ust, rb: e, b: v.b, eingang: 'dauer-ein', ziel: s0.icSat }, load), einheit: 'Ω' };
  }

  function evalEmitter(C, v, red) {
    const m = missing(C, ['tr.dc', 'assess', 'formulas.get']); if (m) return { ok: false, why: m };
    const re = v.re1 + v.re2, base = { ub: v.ub, re, b: v.b, basis: 'rb', rb: C.R_KURZ || 1e-3 };
    const dc = (ubase, rc) => { const r = tryf(() => C.tr.dc(Object.assign({}, base, { ubase, rc })), null); return okr(r) ? r : null; };
    /* Basisspannung so, dass der Kollektorstrom stimmt (Halbieren über tr.dc), dann R_C so, dass U_CE stimmt */
    const ubase = bisect(x => { const r = dc(x, 0); return r ? r.ic : NaN; }, v.ic, 0.5, v.ub);
    if (!fin(ubase)) return { ok: true, task: 'emitter', steps: blank('Mit diesen Werten ist der Kollektorstrom I_C = ' + eng(v.ic, 'A') + ' nicht erreichbar (Betriebsspannung, R_E und B prüfen).') };
    const rc = bisect(x => { const r = dc(ubase, x); return r ? r.uce : NaN; }, v.uce, 1e-3, 1e9);
    if (!fin(rc)) return { ok: true, task: 'emitter', steps: blank('Mit R_E = ' + eng(re, 'Ω') + ' und I_C = ' + eng(v.ic, 'A') + ' ist U_CE = ' + eng(v.uce, 'V') + ' nicht erreichbar: U_CE muss zwischen der Sättigungsspannung und U_B − I_E·R_E liegen.') };
    const d0 = dc(ubase, rc), vb = d0.ube + d0.ue;
    const r2x = fval('r2Teiler', { u2: vb, i1: v.i1, ib: d0.ib });
    if (!fin(r2x)) return { ok: true, task: 'emitter', steps: blank('Der Querstrom I_1 = ' + eng(v.i1, 'A') + ' muss größer sein als der Basisstrom I_B = ' + eng(d0.ib, 'A') + '.') };
    const r1x = bisect(x => fval('iKette', { ub: v.ub, usum: vb, r: x }), v.i1, 1e-3, 1e13);
    if (!fin(r1x)) return { ok: true, task: 'emitter', steps: blank('Mit diesen Werten gibt es keinen Basisspannungsteiler (die Basisspannung ' + eng(vb, 'V') + ' muss unter U_B liegen).') };
    const s2 = { ok: true, lines: ['Aus U_B, I_C, R_E und B (Halbieren über tr.dc): Spannung der Basis gegen Masse U_BE + U_E = ' + eng(vb, 'V') + ', I_B = ' + eng(d0.ib, 'A') + ', U_E = ' + eng(d0.ue, 'V') + '.', textOf('modellTransistor')].filter(t => t) };
    const rcE = nearest(rc, red), r1E = nearest(r1x, red), r2E = nearest(r2x, red);
    const s3 = { ok: !!(rcE && r1E && r2E), lines: [], why: rcE && r1E && r2E ? '' : 'Es gibt keinen Reihenwert zu diesen Widerständen.' };
    if (!s3.ok) return { ok: true, task: 'emitter', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const ru = fcalc('r2Teiler', { u2: vb, i1: v.i1, ib: d0.ib });
    if (ru) s3.lines.push(ru.text + ' (Querstrom I_1 durch R_1 und R_2, Basisstrom I_B abgezogen)');
    s3.lines.push('Genaue Werte: R_C = ' + eng(rc, 'Ω') + ', R_1 = ' + eng(r1x, 'Ω') + ' (gesucht über formulas.iKette auf I_1), R_2 = ' + eng(r2x, 'Ω') + '.');
    s3.lines.push('Vorschlag aus ' + red + ': R_C = ' + eng(rcE, 'Ω') + ' (' + devTxt(devPct(rcE, rc)) + '), R_1 = ' + eng(r1E, 'Ω') + ' (' + devTxt(devPct(r1E, r1x)) + '), R_2 = ' + eng(r2E, 'Ω') + ' (' + devTxt(devPct(r2E, r2x)) + ').');
    const chk = tryf(() => C.tr.dc({ ub: v.ub, r1: r1E, r2: r2E, rc: rcE, re, b: v.b }), null);
    const ctl = { ub: v.ub, r1: r1E, r2: r2E, rc: rcE, re1: v.re1, re2: v.re2, b: v.b };
    const a = tryf(() => C.assess('emitter', Object.assign({}, ctl, { zielUce: v.uce })), null), s4 = ampelStep(a);
    if (okr(chk)) s4.lines.push('Gegenprobe mit den Reihenwerten (tr.dc): I_C = ' + eng(chk.ic, 'A') + ', U_CE = ' + eng(chk.uce, 'V') + ', Spannung der Basis gegen Masse = ' + eng(chk.ube + chk.ue, 'V') + '. ' + ({ aktiv: 'Der Transistor ist aktiv.', saettigung: 'Der Transistor ist gesättigt.', sperrt: 'Der Transistor sperrt.' }[chk.zustand] || ''));
    const rig = Object.assign({}, ctl, { zielUce: v.uce });
    return { ok: true, task: 'emitter', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: rc, wert: rcE, rig, einheit: 'Ω', extra: { r1: r1E, r2: r2E, rc: rcE, r1x, r2x, rcx: rc } };
  }

  function evalOpv(C, v, red) {
    const inv = v.art === 'inv', m = missing(C, [inv ? 'op.inv' : 'op.nin', 'assess']); if (m) return { ok: false, why: m };
    if (!inv && !(v.v >= 1)) return { ok: true, task: 'opv', steps: blank('Der nichtinvertierende Verstärker hat mindestens V_u = 1 (' + limT('opv_nin_vmin') + ').') };
    if (inv && !(v.v > 0)) return { ok: true, task: 'opv', steps: blank('Die Verstärkung |V_u| muss größer als 0 sein.') };
    const ex = inv ? fval('rfInv', { v: v.v, r1: v.r }) : fval('rfNin', { v: v.v, rg: v.r });
    const s2 = { ok: true, lines: ['Gewählt: ' + (inv ? 'R_1' : 'R_g') + ' = ' + eng(v.r, 'Ω') + '. Gesucht: R_f für ' + (inv ? 'V_u = −' + dnum(v.v) : 'V_u = ' + dnum(v.v)) + '.', textOf('opvModell'), textOf('gegenkopplung')].filter(t => t) };
    if (!(ex > 0)) return { ok: true, task: 'opv', steps: [{ ok: true, lines: [] }, s2, { ok: false, lines: [], why: inv ? 'Mit diesen Werten gibt es keinen Rückkopplungswiderstand.' : 'Bei V_u = 1 braucht der Nichtinvertierer keinen Rückkopplungswiderstand: Das ist der Spannungsfolger (R_f = 0).' }, { ok: false, lines: [] }] };
    const e = nearest(ex, red);
    const fr = inv ? fcalc('rfInv', { v: v.v, r1: v.r }) : fcalc('rfNin', { v: v.v, rg: v.r });
    const s3 = { ok: !!e, lines: [], why: e ? '' : 'Es gibt keinen Reihenwert zu diesem Widerstand.' };
    if (fr) s3.lines.push(fr.text + ' (genauer Wert)');
    if (e) {
      s3.lines.push('Vorschlag aus ' + red + ': R_f = ' + eng(e, 'Ω') + ' (Abweichung ' + devTxt(devPct(e, ex)) + ').');
      const vv = inv ? fcalc('vInv', { r1: v.r, rf: e }) : fcalc('vNin', { rg: v.r, rf: e }); if (vv) s3.lines.push('Mit dem Reihenwert: ' + vv.text + '.');
    }
    if (!e) return { ok: true, task: 'opv', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const cfg = inv ? { r1: v.r, rf: e, ue: v.ue, uv: v.uv, opv: v.opv } : { rg: v.r, rf: e, ue: v.ue, uv: v.uv, opv: v.opv };
    const res = tryf(() => (inv ? C.op.inv(cfg) : C.op.nin(cfg)), null);
    const ctl = inv ? { schaltung: 'invertierer', opv: v.opv, uv: v.uv, form: 'gleich', ue: v.ue, r1: v.r, rf: e, zielV: v.v } : { schaltung: 'nichtinvertierend', opv: v.opv, uv: v.uv, form: 'gleich', ue: v.ue, rg: v.r, rf: e, zielV: v.v };
    const a = tryf(() => C.assess(inv ? 'opv_inv' : 'opv_nin', ctl), null), s4 = ampelStep(a);
    if (okr(res)) {
      s4.lines.push('Gegenprobe (' + OPVNAME[v.opv] + '): V_u = ' + dnum(res.v) + ', U_a = ' + eng(res.ua, 'V') + (res.sat ? ' (begrenzt auf die Aussteuergrenze)' : '') + '; größte Eingangsspannung ohne Begrenzen U_e,max = ' + eng(res.ueMax, 'V') + '.');
      if (fin(res.fg)) s4.lines.push('Grenzfrequenz f_g = ' + eng(res.fg, 'Hz') + ' (V_u fällt dort auf das 0,707-Fache; ' + limT('gbw_langsam') + ' beim langsamen Lehrmodell).');
    }
    return { ok: true, task: 'opv', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: ex, wert: e, rig: ctl, einheit: 'Ω' };
  }

  function evalSchmitt(C, v, red) {
    const inv = v.art === 'inv', m = missing(C, ['komp.schmitt', 'assess', 'formulas.get']); if (m) return { ok: false, why: m };
    const sat = C.op && typeof C.op.usat === 'function' ? tryf(() => C.op.usat('ideal', v.uv), NaN) : NaN, us = fin(sat) ? sat : v.uv;
    if (!(v.uo > 0) || !(v.uo < us)) return { ok: true, task: 'schmitt', steps: blank('Die Schaltschwelle U_o muss größer als 0 und kleiner als die Aussteuergrenze U_sat = ' + eng(us, 'V') + ' sein.') };
    const ex = inv ? bisect(x => fval('schmittInv', { usat: us, r2: v.r, r3: x }), v.uo, 1e-3, 1e12) : bisect(x => fval('schmittNin', { usat: us, r1: v.r, r2: x }), v.uo, v.r * 1e-3, 1e12);
    const s2 = { ok: true, lines: ['Gewählt: ' + (inv ? 'R_2' : 'R_1') + ' = ' + eng(v.r, 'Ω') + '. Gesucht: ' + (inv ? 'R_3' : 'R_2') + ' für die Schwellen ±' + eng(v.uo, 'V') + ' bei U_sat = ' + eng(us, 'V') + '.', textOf('mitkopplung')].filter(t => t) };
    if (!fin(ex)) return { ok: true, task: 'schmitt', steps: [{ ok: true, lines: [] }, s2, { ok: false, lines: [], why: 'Mit diesen Vorgaben gibt es keinen Widerstand im Rechenbereich.' }, { ok: false, lines: [] }] };
    const e = nearest(ex, red), fr = inv ? fcalc('schmittInv', { usat: us, r2: v.r, r3: ex }) : fcalc('schmittNin', { usat: us, r1: v.r, r2: ex });
    const s3 = { ok: !!e, lines: [], why: e ? '' : 'Es gibt keinen Reihenwert zu diesem Widerstand.' };
    if (fr) s3.lines.push(fr.text + ' (mit dem genauen Widerstand)');
    if (e) s3.lines.push('Genauer Wert: ' + (inv ? 'R_3' : 'R_2') + ' = ' + eng(ex, 'Ω') + ' (gesucht über formulas.' + (inv ? 'schmittInv' : 'schmittNin') + '); Vorschlag aus ' + red + ': ' + eng(e, 'Ω') + ' (Abweichung ' + devTxt(devPct(e, ex)) + ').');
    if (!e) return { ok: true, task: 'schmitt', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const r1 = inv ? 10000 : v.r, r2 = inv ? v.r : e, r3 = inv ? e : 10000;
    const sc = tryf(() => C.komp.schmitt({ art: v.art, r1, r2, r3, uref: 0, uv: v.uv, opv: 'ideal' }), null);
    const uhZ = fval('uh', { uo: v.uo, uu: -v.uo });
    const ctl = { schaltung: inv ? 'schmitt_inv' : 'schmitt_nin', opv: 'ideal', uv: v.uv, uref: 0, r1, r2, r3, zielUh: uhZ };
    const a = tryf(() => C.assess('opv_komp', ctl), null), s4 = ampelStep(a);
    if (okr(sc)) { const uh = fcalc('uh', { uo: sc.uo, uu: sc.uu }); s4.lines.push('Gegenprobe (komp.schmitt): U_o = ' + eng(sc.uo, 'V') + ', U_u = ' + eng(sc.uu, 'V') + (uh ? '; ' + uh.text : '') + '.'); }
    return { ok: true, task: 'schmitt', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: ex, wert: e, rig: ctl, einheit: 'Ω' };
  }

  function evalAktiv(C, v, red) {
    const art = v.art, ints = art === 'integrierer';
    const m = missing(C, [ints ? 'act.integrator' : art === 'tiefpass' ? 'act.tp' : 'act.hp', 'assess', 'formulas.get']); if (m) return { ok: false, why: m };
    if (!(v.fg > 0) || !(v.c > 0)) return { ok: true, task: 'aktiv', steps: blank('Die Frequenz und der Kondensator C müssen größer als 0 sein.') };
    if (!ints && !(v.v > 0)) return { ok: true, task: 'aktiv', steps: blank('Die Verstärkung |V| muss größer als 0 sein.') };
    const rfOf = r => fval('fgAktiv', { r, c: v.c });
    let ex1, ex2, lines2;
    if (ints) { ex1 = fval('rInt', { f: v.fg, c: v.c }); lines2 = 'Gewählt: C = ' + eng(v.c, 'F') + '. Gesucht: R für |V| = 1 bei f_ref = ' + eng(v.fg, 'Hz') + '.'; }
    else if (art === 'tiefpass') { ex1 = bisect(rfOf, v.fg, 1e-3, 1e13); ex2 = fin(ex1) ? fval('r1Inv', { v: v.v, rf: ex1 }) : NaN; lines2 = 'Gewählt: C = ' + eng(v.c, 'F') + '. Gesucht: R_f für f_g = ' + eng(v.fg, 'Hz') + ' und R_1 für |V| = ' + dnum(v.v) + '.'; }
    else { ex1 = bisect(rfOf, v.fg, 1e-3, 1e13); ex2 = fin(ex1) ? fval('rfInv', { v: v.v, r1: ex1 }) : NaN; lines2 = 'Gewählt: C = ' + eng(v.c, 'F') + '. Gesucht: R_1 für f_g = ' + eng(v.fg, 'Hz') + ' und R_f für |V| = ' + dnum(v.v) + '.'; }
    const s2 = { ok: true, lines: [lines2, textOf('opvModell')].filter(t => t) };
    if (!fin(ex1) || (!ints && !fin(ex2))) return { ok: true, task: 'aktiv', steps: [{ ok: true, lines: [] }, s2, { ok: false, lines: [], why: 'Mit diesen Vorgaben (Frequenz, C, Verstärkung) gibt es keinen Widerstand im Rechenbereich.' }, { ok: false, lines: [] }] };
    const e1 = nearest(ex1, red), e2 = ints ? 0 : nearest(ex2, red);
    const s3 = { ok: !!(e1 && (ints || e2)), lines: [], why: e1 && (ints || e2) ? '' : 'Es gibt keinen Reihenwert zu diesen Widerständen.' };
    if (!s3.ok) return { ok: true, task: 'aktiv', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [] }] };
    const fr = fcalc(ints ? 'rInt' : 'fgAktiv', ints ? { f: v.fg, c: v.c } : { r: ex1, c: v.c });
    if (fr && !ints) s3.lines.push(fr.text + ' (mit dem genauen Widerstand)');
    if (ints) { s3.lines.push('Genauer Wert: R = ' + eng(ex1, 'Ω') + ' (aus formulas.rInt); Vorschlag aus ' + red + ': R = ' + eng(e1, 'Ω') + ' (Abweichung ' + devTxt(devPct(e1, ex1)) + ').'); }
    else {
      const n1 = art === 'tiefpass' ? ['R_f', 'R_1'] : ['R_1', 'R_f'];
      s3.lines.push('Genaue Werte: ' + n1[0] + ' = ' + eng(ex1, 'Ω') + ' (gesucht über formulas.fgAktiv auf f_g), ' + n1[1] + ' = ' + eng(ex2, 'Ω') + '.');
      s3.lines.push('Vorschlag aus ' + red + ': ' + n1[0] + ' = ' + eng(e1, 'Ω') + ' (' + devTxt(devPct(e1, ex1)) + '), ' + n1[1] + ' = ' + eng(e2, 'Ω') + ' (' + devTxt(devPct(e2, ex2)) + ').');
    }
    const r1 = ints ? e1 : (art === 'tiefpass' ? e2 : e1), rf = ints ? undefined : (art === 'tiefpass' ? e1 : e2);
    const chk = ints ? tryf(() => C.act.integrator({ r: e1, c: v.c }), null) : art === 'tiefpass' ? tryf(() => C.act.tp({ r1, rf, cf: v.c }), null) : tryf(() => C.act.hp({ r1, rf, c1: v.c }), null);
    const ft = Math.min(1e6, Math.max(0.1, ints ? v.fg : art === 'tiefpass' ? v.fg / 10 : v.fg * 10));
    const ctl = { schaltung: art, opv: 'ideal', uv: v.uv, form: 'sinus', ue: v.ue, f: ft, r1, c: v.c, zielF: v.fg };
    if (!ints) ctl.rf = rf;
    const a = tryf(() => C.assess('opv_aktiv', ctl), null), s4 = ampelStep(a);
    if (okr(chk)) {
      if (ints) s4.lines.push('Gegenprobe (act.integrator): |V| = 1 bei f_ref = ' + eng(chk.fRef, 'Hz') + ', Zeitkonstante τ = R·C = ' + eng(chk.tau, 's') + '.');
      else s4.lines.push('Gegenprobe (' + (art === 'tiefpass' ? 'act.tp' : 'act.hp') + '): f_g = ' + eng(chk.fg, 'Hz') + ', |V| im Durchlassbereich = ' + dnum(Math.abs(art === 'tiefpass' ? chk.v0 : chk.vInf)) + '.');
    }
    s4.lines.push('Prüfsignal im Durchlassbereich: Sinus, ' + eng(v.ue, 'V') + ', ' + eng(ft, 'Hz') + '.');
    return { ok: true, task: 'aktiv', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: ex1, wert: e1, rig: ctl, einheit: 'Ω' };
  }

  /* Gesamtauswertung des Zustands: { ok, why? , steps[4], ampel, atext, rig, ... } */
  const SYM = { gruen: '●', gelb: '▲', rot: '■', grau: '○' };
  function evaluate(st) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    if (!st || !FIELDS()[st.task]) return { ok: false, why: 'Diese Aufgabe gibt es nicht.' };
    const red = E_SERIES[st.reihe] ? st.reihe : 'E12', rd = read(st);
    const none = [{ ok: true, lines: [] }, { ok: false, lines: [], why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt, Vorsätze wie k, m, µ sind erlaubt): ' + rd.bad.join(', ') + '.' }, { ok: false, lines: [] }, { ok: false, lines: [] }];
    if (rd.bad.length) return { ok: true, task: st.task, steps: none, ampel: 'grau', atext: '', blank: true };
    const run = { led: evalLed, schalter: evalSchalter, emitter: evalEmitter, opv: evalOpv, schmitt: evalSchmitt, aktiv: evalAktiv }[st.task];
    let r = null; try { r = run(C, rd.v, red); } catch (e) { r = { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' }; }
    if (!r) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    if (r.ok === false) return { ok: true, task: st.task, blank: true, ampel: 'grau', atext: '', steps: [{ ok: true, lines: [] }, { ok: false, lines: [], why: r.why }, { ok: false, lines: [] }, { ok: false, lines: [] }] };
    if (!r.ampel || !r.rig) { r.blank = true; r.ampel = 'grau'; r.atext = ''; }
    return Object.assign({ symbol: SYM[r.ampel] || '' }, r);
  }
  const ampName = a => ({ gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' }[a] || 'grau');
  /* Werte für den Prüfstand (Schlüssel wie controls der Rigs, SI) */
  function rigControls(st) { const e = evaluate(st); return e && e.rig ? Object.assign({}, e.rig) : null; }
  function getState() { return { v: 1, st: JSON.parse(JSON.stringify(ST.st)), step: ST.step }; }
  function setState(o) {
    if (!o || typeof o !== 'object' || !o.st || typeof o.st !== 'object') return false;
    const d = defaults(), s = o.st, F = FIELDS();
    if (typeof s.task === 'string' && F[s.task]) d.task = s.task;
    if (E_SERIES[s.reihe]) d.reihe = s.reihe;
    Object.keys(F).forEach(t => { if (s[t] && typeof s[t] === 'object') Object.keys(d[t]).forEach(k => { const f = F[t].find(x => x.key === k); const x = s[t][k]; if (x != null && (typeof x === 'string' || typeof x === 'number') && (!f.select || f.select.some(op => op[0] === String(x)))) d[t][k] = String(x); }); });
    ST.st = d; ST.step = Math.min(4, Math.max(1, Math.floor(Number(o.step)) || 1)); return true;
  }

  /* ============================================================ Oberfläche */
  const CSS = '<style>.ana-dbar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.ana-dbar button{flex:1 1 120px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:inherit;font:inherit}.ana-dbar button.on{border-color:var(--accent);font-weight:600}.ana-dbar button.ok{border-color:var(--ok)}.ana-dg{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.ana-dg label{flex:1 1 170px;min-width:140px;font-size:12.5px;color:var(--mute)}.ana-dg input,.ana-dg select{margin-top:3px;min-height:42px}.ana-dres{margin-top:10px}.ana-dwhy{color:var(--danger);font-size:13.5px;margin:6px 0 0}</style>';
  function fieldHtml(f, val, src) {
    const id = 'ana_d_' + f.key, lbl = esc(labelOf(f, src)) + (f.unit ? ' in ' + esc(f.unit) : '');
    if (f.select) return `<label for="${id}">${lbl}<select id="${id}" data-k="${esc(f.key)}">${f.select.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
    return `<label for="${id}">${lbl}<input id="${id}" data-k="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  }
  function stepFields(n, st) {
    if (n === 1) return `<div class="ana-dg"><label for="ana_d_task">Aufgabe<select id="ana_d_task" data-k="task">${TASKS.map(t => `<option value="${t[0]}"${t[0] === st.task ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></label></div><p class="hint2">Alle Vorgaben sind Übungswerte (A). ${esc(textOf('uebungswert'))}</p>`;
    if (n === 2) { const F = FIELDS()[st.task], src = st[st.task]; return `<div class="ana-dg">${F.filter(f => relevant(f, src, F)).map(f => fieldHtml(f, src[f.key] != null ? src[f.key] : f.def, src)).join('')}</div>`; }
    if (n === 3) return `<div class="ana-dg"><label for="ana_d_reihe">Wertereihe für den Vorschlag<select id="ana_d_reihe" data-k="reihe">${REIHEN.map(o => `<option value="${o[0]}"${o[0] === st.reihe ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label></div>`;
    return '';
  }
  function resHtml(ev, n) {
    if (ev.ok === false) return `<p class="ana-dwhy" role="status">${esc(ev.why)}</p>`;
    const s = ev.steps[n - 1] || { lines: [] };
    let h = '';
    if (s.lines.length) h += `<ol>${s.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (s.why) h += `<p class="ana-dwhy" role="status">${esc(s.why)}</p>`;
    if (n === 4 && ev.ampel && !ev.blank) {
      const k = { gruen: 'ok', gelb: 'warnc', rot: 'bad', grau: '' }[ev.ampel] || '';
      h = `<div class="amprow ${k}" role="status"><span class="asym" aria-hidden="true">${esc(SYM[ev.ampel] || '')}</span><div class="atx"><b>Ampel: ${esc(ampName(ev.ampel))}</b><small>${esc(ev.atext)}</small><small class="nt">${esc(textOf('ampelHinweis'))}</small></div></div>` + h;
    }
    return h;
  }
  function barHtml(ev) {
    return STEPS.map(([n, ic, name]) => { const ok = ev.steps && ev.steps[n - 1] && ev.steps[n - 1].ok && !(n === 4 && ev.blank); return `<button data-step="${n}" class="${ST.step === n ? 'on' : ''}${ok ? ' ok' : ''}" aria-label="Schritt ${n} ${name}${ok ? ', geprüft' : ', noch nicht geprüft'}"${ST.step === n ? ' aria-current="step"' : ''}>${ok ? '✓' : ic} ${n} ${name}</button>`; }).join('');
  }
  function panelHtml(ev) {
    const n = ST.step, st = ST.st;
    const nav = `<div class="btns">${n > 1 ? '<button class="btn" data-nav="-1">Zurück</button>' : ''}${n < 4 ? '<button class="btn pri" data-nav="1">Weiter</button>' : '<button class="btn pri" data-act="rig">Im Prüfstand ansehen</button><button class="btn" data-act="reset">Neu beginnen</button>'}</div>`;
    return `<div class="card pl"><h4>Schritt ${n} von 4</h4><p class="big">${esc(TITLES[n - 1])}</p>${stepFields(n, st)}<div class="ana-dres" data-dres aria-live="polite">${resHtml(ev, n)}</div>${nav}</div>`;
  }
  function renderAll() {
    const C = CORE(), ev = evaluate(ST.st);
    const top = `<div class="card pl"><h4>Auslegen</h4><p class="big">Bauteile auslegen in vier Schritten</p><p class="hint2" style="margin:0">Jeder Schritt rechnet mit demselben Kern wie die Prüfstände. Die Vorgaben sind Übungswerte, die Reihenwerte sind ein Vorschlag mit Abweichung. Übungsschaltung für Kleinspannung. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="ana-dwhy">${esc(NOCORE)}</p></div>`;
    if (ev.ok === false) return CSS + top + `<div class="card pl"><p class="ana-dwhy">${esc(ev.why)}</p></div>`;
    return CSS + top + `<div class="ana-dbar" data-dbar role="group" aria-label="Schritte">${barHtml(ev)}</div><div data-dpanel>${panelHtml(ev)}</div>`;
  }
  function save() { try { if (A && typeof A.lsSet === 'function') A.lsSet('ana.design', getState()); } catch (e) {} }
  function stat() { try { if (A && typeof A.stat === 'function') A.stat('anadesign', 1); } catch (e) {} }
  function redraw(host) { host.innerHTML = renderAll(); }
  function reached(ev) { return ev && ev.steps && ev.steps[3] && ev.steps[3].ok && !ev.blank; }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset || !t.dataset.k) return;
    const k = t.dataset.k;
    if (k === 'task') { if (FIELDS()[t.value]) ST.st.task = t.value; save(); redraw(host); return; }
    if (k === 'reihe') { if (E_SERIES[t.value]) ST.st.reihe = t.value; save(); redraw(host); return; }
    if (!ST.st[ST.st.task]) return;
    const f = (FIELDS()[ST.st.task] || []).find(x => x.key === k); if (!f) return;
    ST.st[ST.st.task][k] = String(t.value); save();
    if (f.select) { redraw(host); return; }
    const ev = evaluate(ST.st), r = host.querySelector('[data-dres]'), b = host.querySelector('[data-dbar]');
    if (r) r.innerHTML = resHtml(ev, ST.step); if (b) b.innerHTML = barHtml(ev);
    if (e.type === 'change' && ST.step === 4 && reached(ev)) stat();
  }
  function onClick(host, e) {
    const t = e && e.target && e.target.closest ? e.target : null; if (!t) return;
    const sb = t.closest('[data-step]'), nb = t.closest('[data-nav]'), ab = t.closest('[data-act]');
    const go = n => { ST.step = Math.min(4, Math.max(1, n)); save(); redraw(host); if (ST.step === 4 && reached(evaluate(ST.st))) stat(); };
    if (sb) go(+sb.dataset.step);
    else if (nb) go(ST.step + (+nb.dataset.nav));
    else if (ab && ab.dataset.act === 'reset') { ST.st = defaults(); ST.step = 1; save(); redraw(host); }
    else if (ab && ab.dataset.act === 'rig') {
      const ev = evaluate(ST.st); if (!ev.rig) { if (A && A.toast) A.toast('Erst eine gültige Auslegung eingeben.'); return; }
      const id = rigOf(ST.st);
      if (A && typeof A.loadRig === 'function') A.loadRig({ rig: id, name: 'Auslegung', controls: Object.assign({}, ev.rig), toast: 'Die Auslegung steht im Prüfstand ' + (A.rigName ? A.rigName(id) : id) });
      else if (A && typeof A.setTab === 'function') A.setTab('rig');
    }
  }
  function render(host, api) {
    A = api || A;
    if (!ST.A) { ST.A = true; const o = A && typeof A.lsGet === 'function' ? tryf(() => A.lsGet('ana.design', null), null) : null; if (o) setState(o); }
    host.innerHTML = renderAll();
    if (!host._anaDesign) { host._anaDesign = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, getState, setState, fn: { defaults, evaluate, rigControls, rigOf, read, readNum, nearest, bisect, series: E_SERIES, fields: FIELDS, tasks: TASKS }, _st: ST };
  root.ANA_UI_EXT = root.ANA_UI_EXT || {}; root.ANA_UI_EXT.design = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
