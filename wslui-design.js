'use strict';
/* Tonfunk Wechselstrom-Lab: Tab "Auslegen" (WP3c, SPEC 6.4).
   Assistent in vier Schritten, jeder mit Häkchen: (1) Aufgabe wählen (Kompensation, Schwingkreis auf Frequenz, Filter auf Grenzfrequenz, Trafo-Übersetzung),
   (2) Vorgaben, (3) Bauteile (genauer Wert aus dem Kern, Vorschlag aus der E6-/E12-Reihe mit Abweichung, Rechenweg), (4) Ergebnis (Ampel aus assess, Gegenprobe über den Kern).
   ALLE Rechnungen und Texte kommen aus WSL_CORE (comp.need/after/state, res.tune/series/parallel, filter.design/rc/rl, trafo.ideal, formulas[id].calc, assess, TEXTS, limits);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Gesuchte Größen, für die der Kern keine Umkehrfunktion hat (Verlustwiderstand zur Güte, Windungszahl zur Spannung),
   werden durch Halbieren über dieselbe Kernfunktion gefunden (Hilfsroutine bisect), nicht durch eine eigene Formel. Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen.
   Alle Vorgaben sind Übungswerte (A); die Reihen E6 und E12 sind Wertetabellen, keine Physik.
   Speichern: lsSet('wsl.design', { v, st, step }); getState()/setState(o) für Speichern und Teilen.
   Schnittstelle (VERTRAG 6.5): window.WSL_UI_EXT.design.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter WSL_UI_EXT.design.fn
   und werden von quelle/wsllab/test_wslui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.WSL_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (wslcore.js und wslcore-res.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (wslcore.js oder wslcore-res.js ist nicht vollständig geladen). Dieser Assistent liefert deshalb keine Zahlen.';
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limV = (id, d) => { const C = CORE(); const l = C && typeof C.limit === 'function' ? tryf(() => C.limit(id), null) : null; return l && fin(l.value) ? l.value : d; };
  const limT = id => { const C = CORE(); return C && typeof C.limitText === 'function' ? tryf(() => C.limitText(id), '') : ''; };
  const dnum = x => (fin(x) ? fm(Number(Number(x).toPrecision(6)), 6).replace(/,?0+$/, '') : '');
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben */
  const TASKS = [['komp', 'Kompensation: Kondensator für den Ziel-cos φ'], ['schwing', 'Schwingkreis auf eine Resonanzfrequenz'], ['filter', 'Filter auf eine Grenzfrequenz'], ['trafo', 'Trafo-Übersetzung für eine Sekundärspannung']];
  const STEPS = [[1, '🎯', 'Aufgabe'], [2, '📝', 'Vorgaben'], [3, '🔧', 'Bauteile'], [4, '✅', 'Ergebnis']];
  const TITLES = ['Aufgabe: Was soll ausgelegt werden?', 'Vorgaben: Was ist verlangt?', 'Bauteile: Genauer Wert und Vorschlag aus der Reihe', 'Ergebnis und Gegenprobe'];
  const RIGOF = { komp: 'kompens', schwing: 'schwing', filter: 'filter', trafo: 'trafo' };
  /* Felder je Aufgabe: key, Beschriftung, Anzeigeeinheit, Skalierung auf SI, Vorgabe (Übungswert) oder select */
  const FIELDS = () => ({
    komp: [{ key: 'p', label: 'Wirkleistung P', unit: 'W', scale: 1, def: '3200' }, { key: 'cos1', label: 'cos φ vorher', unit: '', scale: 1, def: '0,8' },
      { key: 'cos2', label: 'cos φ Ziel', unit: '', scale: 1, def: dnum(limV('cos_ziel', 0.95)) }, { key: 'u', label: 'Spannung U', unit: 'V', scale: 1, def: dnum(limV('u_netz', 230)) }, { key: 'f', label: 'Frequenz f', unit: 'Hz', scale: 1, def: dnum(limV('f_netz', 50)) }],
    schwing: [{ key: 'art', label: 'Schaltung', select: [['reihe', 'Reihenschwingkreis'], ['parallel', 'Parallelschwingkreis']], def: 'reihe' }, { key: 'f0', label: 'Resonanzfrequenz f₀', unit: 'Hz', scale: 1, def: '15915' },
      { key: 'qg', label: 'Güte Q_G', unit: '', scale: 1, def: '10' }, { key: 'l', label: 'Induktivität L (gewählt)', unit: 'mH', scale: 1e-3, def: '1' }],
    filter: [{ key: 'art', label: 'Glied', select: [['RC', 'RC-Glied'], ['RL', 'RL-Glied']], def: 'RC' }, { key: 'typ', label: 'Typ', select: [['tief', 'Tiefpass'], ['hoch', 'Hochpass']], def: 'tief' },
      { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz', scale: 1, def: '1600' }, { key: 'r', label: 'Widerstand R (gewählt)', unit: 'Ω', scale: 1, def: '1000' }],
    trafo: [{ key: 'u1', label: 'Primärspannung U₁', unit: 'V', scale: 1, def: dnum(limV('u_netz', 230)) }, { key: 'u2', label: 'Sekundärspannung U₂ (Vorgabe)', unit: 'V', scale: 1, def: '13,8' },
      { key: 'n1', label: 'Windungen Primärseite N₁ (gewählt)', unit: '', scale: 1, def: '1150' }, { key: 'rlast', label: 'Lastwiderstand', unit: 'Ω', scale: 1, def: '10' }]
  });
  const REIHEN = [['E12', 'E12 (zwölf Werte je Dekade)'], ['E6', 'E6 (sechs Werte je Dekade)']];
  const E_SERIES = { E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8], E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2] };
  function defaults() { const st = { task: 'komp', reihe: 'E12' }; const F = FIELDS(); Object.keys(F).forEach(t => { st[t] = {}; F[t].forEach(f => { st[t][f.key] = f.def; }); }); return st; }
  const ST = { st: defaults(), step: 1 };

  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1;
    if (typeof txt === 'number') return fin(txt) ? txt * sc : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    let q = null; if (C && typeof C.parseQty === 'function') q = tryf(() => C.parseQty(t), null);
    if (q && fin(q.v)) return q.hasUnit ? q.v : q.raw * sc;
    const v = C && typeof C.parseNum === 'function' ? tryf(() => C.parseNum(t), NaN) : parseFloat(t.replace(/\s/g, '').replace(',', '.'));
    return fin(v) ? v * sc : NaN;
  }
  /* Vorgaben des gewählten Falls in SI lesen: { v:{key:Zahl}, bad:[Labels] } */
  function read(st) {
    const F = FIELDS()[st.task] || [], src = st[st.task] || {}, v = {}, bad = [];
    F.forEach(f => {
      const raw = src[f.key] != null ? src[f.key] : f.def;
      if (f.select) { if (!f.select.some(o => o[0] === String(raw))) bad.push(f.label); v[f.key] = String(raw); return; }
      const x = readNum(raw, f); if (!fin(x)) bad.push(f.label); v[f.key] = x;
    });
    return { v, bad };
  }

  /* ============================================================ Hilfen: Reihe und Suche (keine Physik) */
  /* größter Reihenwert-Kandidat unter/über dem Sollwert: Liste aller Reihenwerte in vier Dekaden um das Soll, sortiert */
  function seriesAround(target, name) {
    const base = E_SERIES[name] || E_SERIES.E12, out = [];
    if (!(target > 0) || !fin(target)) return out;
    const d0 = Math.floor(Math.log10(target));
    for (let d = d0 - 1; d <= d0 + 1; d++) base.forEach(b => out.push(Number((b * Math.pow(10, d)).toPrecision(12))));
    return out.sort((a, b) => a - b);
  }
  /* nächster Reihenwert (Abstand im Verhältnis); accept(w) filtert unzulässige Werte (z. B. Überkompensation) */
  function nearest(target, name, accept) {
    const L = seriesAround(target, name).filter(w => !accept || accept(w));
    let best = null, bd = Infinity;
    L.forEach(w => { const d = Math.abs(Math.log(w / target)); if (d < bd) { bd = d; best = w; } });
    return best;
  }
  /* Halbieren (logarithmisch) einer monotonen Kernfunktion g(x) auf den Zielwert; liefert x oder NaN */
  function bisect(g, target, lo, hi) {
    const a0 = g(lo), b0 = g(hi); if (!fin(a0) || !fin(b0) || a0 === b0) return NaN;
    const up = b0 > a0; if ((up && (target < a0 || target > b0)) || (!up && (target > a0 || target < b0))) return NaN;
    let a = lo, b = hi;
    for (let i = 0; i < 200; i++) { const m = Math.sqrt(a * b), y = g(m); if (!fin(y)) return NaN; if ((y < target) === up) a = m; else b = m; if (b / a < 1 + 1e-13) break; }
    return Math.sqrt(a * b);
  }
  const devPct = (e, x) => (x ? (e - x) / x * 100 : NaN);       /* Abweichung des Reihenwerts vom genauen Wert, nur Anzeige */
  const devTxt = d => (fin(d) ? (d >= 0 ? '+' : '−') + fm(Math.abs(d), 1) + ' %' : '–');

  /* ============================================================ Rechenfunktionen der vier Fälle (alle rufen WSL_CORE) */
  const need = (C, path) => { const p = path.split('.'); let o = C; for (let i = 0; i < p.length; i++) { o = o && o[p[i]]; } return typeof o === 'function' ? null : NOFN(path); };
  const okr = r => r && r.ok !== false && r.valid !== false;
  const why = r => (r && r.why) || (r && r.text) || 'Mit diesen Werten gibt es kein Ergebnis.';
  function fcalc(id, o) { const C = CORE(), f = C && C.formulas && typeof C.formulas.get === 'function' ? tryf(() => C.formulas.get(id), null) : null; const r = f ? tryf(() => f.calc(o), null) : null; return r && r.ok !== false ? r : null; }

  function evalKomp(C, v, red) {
    const m = ['comp.need', 'comp.after', 'comp.state', 'comp.cMax', 'assess'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const o = { p: v.p, cos1: v.cos1, cos2: v.cos2, u: v.u, f: v.f }, nd = tryf(() => C.comp.need(o), null);
    if (!okr(nd)) return { ok: false, why: why(nd) };
    const s2 = { lines: [], ok: true };
    [['qc', { p: v.p, cos1: v.cos1, cos2: v.cos2 }], ['cKomp', o]].forEach(([id, a]) => { const r = fcalc(id, a); if (r) s2.lines.push(r.text); });
    s2.lines.push('Leistungsfaktor ' + limT('cos_ziel'));
    const cm = tryf(() => C.comp.cMax({ p: v.p, cos1: v.cos1, u: v.u, f: v.f }), NaN);
    const okC = w => { const s = tryf(() => C.comp.state({ p: v.p, cos1: v.cos1, cos2: v.cos2, u: v.u, f: v.f, c: w }), null); return okr(s) && s.state !== 'ueber'; };
    const ce = nearest(nd.c, red, okC);
    const s3 = { ok: !!ce, lines: [], why: ce ? '' : 'Es gibt keinen Reihenwert, der nicht überkompensiert.' };
    if (ce) {
      s3.lines.push('Genauer Wert: C = ' + eng(nd.c, 'F') + ' (aus comp.need); größtes C ohne Überkompensation: ' + eng(cm, 'F') + '.');
      s3.lines.push('Vorschlag aus ' + red + ': C = ' + eng(ce, 'F') + ' (Abweichung ' + devTxt(devPct(ce, nd.c)) + ').');
    }
    if (!ce) return { ok: true, steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [], why: s3.why }], comp: { c: nd.c }, task: 'komp' };
    const a = tryf(() => C.assess('kompens', { p: v.p, cos1: v.cos1, u: v.u, f: v.f, c: ce, ziel: { cos2: v.cos2 } }), null);
    const stt = tryf(() => C.comp.state({ p: v.p, cos1: v.cos1, cos2: v.cos2, u: v.u, f: v.f, c: ce }), null);
    const s4 = { ok: !!(a && a.ok !== false && a.ampel), lines: [], why: a && a.ok === false ? why(a) : '' };
    if (okr(stt)) s4.lines.push(stt.text, 'Strom vorher I₁ = ' + eng(nd.i1, 'A') + ', nachher I = ' + eng(stt.i, 'A') + ' (Wirkleistung P bleibt ' + eng(v.p, 'W') + ').');
    return { ok: true, task: 'komp', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: nd.c, wert: ce, rig: { u: v.u, p: v.p, cos1: v.cos1, c: ce, ziel: v.cos2 }, einheit: 'F' };
  }

  function evalSchwing(C, v, red) {
    const m = ['res.tune', 'res.series', 'res.parallel', 'assess'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const par = v.art === 'parallel', fn = par ? C.res.parallel : C.res.series;
    const tu = tryf(() => C.res.tune({ l: v.l, f0: v.f0 }), null);
    if (!okr(tu)) return { ok: false, why: why(tu) };
    const s2 = { ok: true, lines: ['Gewählt: L = ' + eng(v.l, 'H') + '. Gesucht: C und ' + (par ? 'R_p' : 'R') + ' für f₀ = ' + eng(v.f0, 'Hz') + ' und Q_G = ' + fm(v.qg, 2) + '.', textOf('ueberhoehung')].filter(t => t) };
    const fr = fcalc('f0', { l: v.l, c: tu.c }), z0 = fcalc('z0', { l: v.l, c: tu.c });
    const cE = nearest(tu.c, red);
    const qOf = r => { const x = tryf(() => fn({ l: v.l, c: tu.c, [par ? 'rp' : 'r']: r }), null); return okr(x) ? x.qg : NaN; };
    const rx = bisect(qOf, v.qg, 1e-6, 1e9);
    if (!fin(rx) || !cE) return { ok: true, task: 'schwing', steps: [{ ok: true, lines: [] }, s2, { ok: false, lines: [], why: 'Mit diesen Vorgaben (Güte, Frequenz, L) gibt es keinen Verlustwiderstand im Rechenbereich.' }, { ok: false, lines: [], why: '' }] };
    const rE = nearest(rx, red);
    const s3 = { ok: true, lines: [] };
    if (fr) s3.lines.push(fr.text + ' (mit genauem C)');
    if (z0) s3.lines.push(z0.text);
    s3.lines.push('Genauer Wert: C = ' + eng(tu.c, 'F') + ' (aus res.tune); Vorschlag aus ' + red + ': C = ' + eng(cE, 'F') + ' (Abweichung ' + devTxt(devPct(cE, tu.c)) + ').');
    s3.lines.push('Genauer Wert: ' + (par ? 'R_p' : 'R') + ' = ' + eng(rx, 'Ω') + ' (gesucht über ' + (par ? 'res.parallel' : 'res.series') + ' auf Q_G); Vorschlag aus ' + red + ': ' + eng(rE, 'Ω') + ' (Abweichung ' + devTxt(devPct(rE, rx)) + ').');
    const chk = tryf(() => fn({ l: v.l, c: cE, [par ? 'rp' : 'r']: rE, u: 1 }), null);
    const a = tryf(() => C.assess('schwing', { art: v.art, l: v.l, c: cE, r: rE, u: 1, ziel: { f0: v.f0, qg: v.qg } }), null);
    const s4 = { ok: !!(a && a.ok !== false && a.ampel), lines: [], why: a && a.ok === false ? why(a) : '' };
    if (okr(chk)) { s4.lines.push(chk.text); if (chk.ueberhoehungText) s4.lines.push(chk.ueberhoehungText); }
    return { ok: true, task: 'schwing', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: tu.c, wert: cE, rig: { art: v.art, l: v.l, c: cE, [par ? 'rp' : 'r']: rE, f: v.f0, ziel: v.f0, zielQ: v.qg }, einheit: 'F' };
  }

  function evalFilter(C, v, red) {
    const m = ['filter.design', 'filter.rc', 'filter.rl', 'assess'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const rl = v.art === 'RL', key = rl ? 'l' : 'c', fn = rl ? C.filter.rl : C.filter.rc;
    const d = tryf(() => C.filter.design({ fg: v.fg, r: v.r, art: v.art }), null);
    if (!okr(d) || !fin(d[key])) return { ok: false, why: why(d) };
    const s2 = { ok: true, lines: ['Gewählt: R = ' + eng(v.r, 'Ω') + '. Gesucht: ' + (rl ? 'L' : 'C') + ' für f_g = ' + eng(v.fg, 'Hz') + ' als ' + (v.typ === 'hoch' ? 'Hochpass' : 'Tiefpass') + '.', textOf('filterNurErsteOrdnung'), rl ? textOf('rlIdeal') : ''].filter(t => t) };
    const fr = fcalc(rl ? 'fgRL' : 'fgRC', rl ? { r: v.r, l: d.l } : { r: v.r, c: d.c });
    const xE = nearest(d[key], red), unit = rl ? 'H' : 'F';
    const s3 = { ok: !!xE, lines: [] };
    if (fr) s3.lines.push(fr.text + ' (mit genauem ' + (rl ? 'L' : 'C') + ')');
    if (xE) s3.lines.push('Genauer Wert: ' + (rl ? 'L' : 'C') + ' = ' + eng(d[key], unit) + ' (aus filter.design); Vorschlag aus ' + red + ': ' + eng(xE, unit) + ' (Abweichung ' + devTxt(devPct(xE, d[key])) + ').');
    if (!xE) return { ok: true, task: 'filter', steps: [{ ok: true, lines: [] }, s2, s3, { ok: false, lines: [], why: '' }] };
    const cfg = { typ: v.typ, r: v.r, [key]: xE };
    const chk = tryf(() => fn(cfg), null);
    const a = tryf(() => C.assess('filter', { art: v.art, typ: v.typ, r: v.r, [key]: xE, ziel: { fg: v.fg, typ: v.typ } }), null);
    const s4 = { ok: !!(a && a.ok !== false && a.ampel), lines: [], why: a && a.ok === false ? why(a) : '' };
    if (okr(chk)) s4.lines.push(chk.text);
    return { ok: true, task: 'filter', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: d[key], wert: xE, rig: { art: v.art, typ: v.typ, r: v.r, [key]: xE, ziel: v.fg }, einheit: unit };
  }

  function evalTrafo(C, v) {
    const m = ['trafo.ideal', 'assess'].map(p => need(C, p)).find(x => x); if (m) return { ok: false, why: m };
    const n1 = Math.round(v.n1);
    if (!(n1 >= 1)) return { ok: false, why: 'Die Windungszahl N₁ muss eine ganze Zahl größer als 0 sein.' };
    const u2Of = n2 => { const r = tryf(() => C.trafo.ideal({ u1: v.u1, n1, n2, rlast: v.rlast }), null); return okr(r) ? r.u2 : NaN; };
    const nx = bisect(u2Of, v.u2, 1, 1e7);
    const s2 = { ok: true, lines: ['Gewählt: N₁ = ' + n1 + ', Lastwiderstand ' + eng(v.rlast, 'Ω') + '. Gesucht: Windungszahl N₂ für U₂ = ' + eng(v.u2, 'V') + ' bei U₁ = ' + eng(v.u1, 'V') + '.', limT('trafo_ueb')].filter(t => t) };
    if (!fin(nx)) return { ok: true, task: 'trafo', steps: [{ ok: true, lines: [] }, s2, { ok: false, lines: [], why: 'Mit diesen Vorgaben gibt es keine Windungszahl im Rechenbereich (zum Beispiel U₂ größer als das Zehnmillionenfache von U₁).' }, { ok: false, lines: [], why: '' }] };
    const lo = Math.max(1, Math.floor(nx)), hi = lo + 1;
    const n2 = Math.abs(u2Of(lo) - v.u2) <= Math.abs(u2Of(hi) - v.u2) ? lo : hi;
    const id = tryf(() => C.trafo.ideal({ u1: v.u1, n1, n2, rlast: v.rlast }), null);
    const s3 = { ok: okr(id), lines: [] };
    if (okr(id)) s3.lines.push('Genauer Wert (Halbieren über trafo.ideal): N₂ = ' + fm(nx, 2) + '; Vorschlag: ganze Windungszahl N₂ = ' + n2 + ' (Abweichung ' + devTxt(devPct(n2, nx)) + ').', id.text);
    const a = tryf(() => C.assess('trafo', { u1: v.u1, n1, n2, rlast: v.rlast, modus: 'ideal', ziel: { u2: v.u2 } }), null);
    const s4 = { ok: !!(a && a.ok !== false && a.ampel), lines: [], why: a && a.ok === false ? why(a) : '' };
    if (okr(id)) s4.lines.push('Primärstrom I₁ = ' + eng(id.i1, 'A') + ' bei Sekundärstrom I₂ = ' + eng(id.i2, 'A') + ' (Gegenprobe aus trafo.ideal).');
    return { ok: true, task: 'trafo', steps: [{ ok: true, lines: [] }, s2, s3, s4], ampel: a && a.ampel, atext: a && a.text, exakt: nx, wert: n2, rig: { u1: v.u1, n1, n2, rlast: v.rlast, modus: 'ideal', ziel: v.u2 }, einheit: '' };
  }

  /* Gesamtauswertung des Zustands: { ok, why? , steps[4], ampel, atext, rig, ... } */
  function evaluate(st) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    if (!st || !FIELDS()[st.task]) return { ok: false, why: 'Diese Aufgabe gibt es nicht.' };
    const red = E_SERIES[st.reihe] ? st.reihe : 'E12', rd = read(st);
    const none = [{ ok: true, lines: [] }, { ok: false, lines: [], why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt): ' + rd.bad.join(', ') + '.' }, { ok: false, lines: [] }, { ok: false, lines: [] }];
    if (rd.bad.length) return { ok: true, task: st.task, steps: none, ampel: 'grau', atext: '', blank: true };
    const run = { komp: evalKomp, schwing: evalSchwing, filter: evalFilter, trafo: evalTrafo }[st.task];
    let r = null; try { r = run(C, rd.v, red); } catch (e) { r = { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' }; }
    if (!r) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    if (r.ok === false) return { ok: true, task: st.task, blank: true, ampel: 'grau', atext: '', steps: [{ ok: true, lines: [] }, { ok: false, lines: [], why: r.why }, { ok: false, lines: [] }, { ok: false, lines: [] }] };
    return Object.assign({ symbol: SYM[r.ampel] || '' }, r);
  }
  const SYM = { gruen: '●', gelb: '▲', rot: '■', grau: '○' };
  const ampName = a => ({ gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' }[a] || 'grau');
  /* Werte für den Prüfstand (Schlüssel wie controls der Rigs, SI) */
  function rigControls(st) { const e = evaluate(st); return e && e.rig ? Object.assign({}, e.rig) : null; }
  function getState() { return { v: 1, st: JSON.parse(JSON.stringify(ST.st)), step: ST.step }; }
  function setState(o) {
    if (!o || typeof o !== 'object' || !o.st || typeof o.st !== 'object') return false;
    const d = defaults(), s = o.st;
    if (typeof s.task === 'string' && d[s.task] && typeof d[s.task] === 'object') d.task = s.task;
    if (E_SERIES[s.reihe]) d.reihe = s.reihe;
    Object.keys(FIELDS()).forEach(t => { if (s[t] && typeof s[t] === 'object') Object.keys(d[t]).forEach(k => { if (s[t][k] != null && (typeof s[t][k] === 'string' || typeof s[t][k] === 'number')) d[t][k] = String(s[t][k]); }); });
    ST.st = d; ST.step = Math.min(4, Math.max(1, Math.floor(Number(o.step)) || 1)); return true;
  }

  /* ============================================================ Oberfläche */
  const CSS = '<style>.wd-bar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.wd-bar button{flex:1 1 120px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:inherit;font:inherit}.wd-bar button.on{border-color:var(--accent);font-weight:600}.wd-bar button.ok{border-color:var(--ok)}.wd-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.wd-g label{flex:1 1 170px;min-width:140px;font-size:12.5px;color:var(--mute)}.wd-g input,.wd-g select{margin-top:3px;min-height:42px}.wd-res{margin-top:10px}.wd-why{color:var(--danger);font-size:13.5px;margin:6px 0 0}</style>';
  function fieldHtml(f, val) {
    const id = 'wd_' + f.key, lbl = esc(f.label) + (f.unit ? ' in ' + esc(f.unit) : '');
    if (f.select) return `<label for="${id}">${lbl}<select id="${id}" data-k="${esc(f.key)}">${f.select.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
    return `<label for="${id}">${lbl}<input id="${id}" data-k="${esc(f.key)}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  }
  function stepFields(n, st) {
    if (n === 1) return `<div class="wd-g"><label for="wd_task">Aufgabe<select id="wd_task" data-k="task">${TASKS.map(t => `<option value="${t[0]}"${t[0] === st.task ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></label></div><p class="hint2">Alle Vorgaben sind Übungswerte (A). ${esc(textOf('uebung'))}</p>`;
    if (n === 2) return `<div class="wd-g">${FIELDS()[st.task].map(f => fieldHtml(f, st[st.task][f.key] != null ? st[st.task][f.key] : f.def)).join('')}</div>`;
    if (n === 3) return `<div class="wd-g"><label for="wd_reihe">Wertereihe für den Vorschlag<select id="wd_reihe" data-k="reihe">${REIHEN.map(o => `<option value="${o[0]}"${o[0] === st.reihe ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label></div>`;
    return '';
  }
  function resHtml(ev, n) {
    if (ev.ok === false) return `<p class="wd-why" role="status">${esc(ev.why)}</p>`;
    const s = ev.steps[n - 1] || { lines: [] };
    let h = '';
    if (s.lines.length) h += `<ol>${s.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
    if (s.why) h += `<p class="wd-why" role="status">${esc(s.why)}</p>`;
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
    return `<div class="card pl"><h4>Schritt ${n} von 4</h4><p class="big">${esc(TITLES[n - 1])}</p>${stepFields(n, st)}<div class="wd-res" data-dres aria-live="polite">${resHtml(ev, n)}</div>${nav}</div>`;
  }
  function renderAll() {
    const C = CORE(), ev = evaluate(ST.st);
    const top = `<div class="card pl"><h4>Auslegen</h4><p class="big">Bauteile auslegen in vier Schritten</p><p class="hint2" style="margin:0">Jeder Schritt rechnet mit demselben Kern wie die Prüfstände. Die Vorgaben sind Übungswerte, die Reihenwerte sind ein Vorschlag mit Abweichung. Übungsschaltung, keine Anleitung für Arbeiten an Netzspannung. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="wd-why">${esc(NOCORE)}</p></div>`;
    if (ev.ok === false) return CSS + top + `<div class="card pl"><p class="wd-why">${esc(ev.why)}</p></div>`;
    return CSS + top + `<div class="wd-bar" data-dbar role="group" aria-label="Schritte">${barHtml(ev)}</div><div data-dpanel>${panelHtml(ev)}</div>`;
  }
  function save() { try { if (A && typeof A.lsSet === 'function') A.lsSet('wsl.design', getState()); } catch (e) {} }
  function stat() { try { if (A && typeof A.stat === 'function') A.stat('wsldesign', 1); } catch (e) {} }
  function redraw(host) { host.innerHTML = renderAll(); }
  function reached(ev) { return ev && ev.steps && ev.steps[3] && ev.steps[3].ok && !ev.blank; }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset || !t.dataset.k) return;
    const k = t.dataset.k;
    if (k === 'task') { if (FIELDS()[t.value]) ST.st.task = t.value; save(); redraw(host); return; }
    if (k === 'reihe') { if (E_SERIES[t.value]) ST.st.reihe = t.value; save(); redraw(host); return; }
    if (!ST.st[ST.st.task]) return;
    ST.st[ST.st.task][k] = String(t.value); save();
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
      if (A && typeof A.loadRig === 'function') A.loadRig({ rig: RIGOF[ST.st.task], name: 'Auslegung', controls: Object.assign({}, ev.rig), toast: 'Die Auslegung steht im Prüfstand ' + (A.rigName ? A.rigName(RIGOF[ST.st.task]) : RIGOF[ST.st.task]) });
      else if (A && typeof A.setTab === 'function') A.setTab('rig');
    }
  }
  function render(host, api) {
    A = api || A;
    if (!ST.A) { ST.A = true; const o = A && typeof A.lsGet === 'function' ? tryf(() => A.lsGet('wsl.design', null), null) : null; if (o) setState(o); }
    host.innerHTML = renderAll();
    if (!host._wslDesign) { host._wslDesign = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, getState, setState, fn: { defaults, evaluate, rigControls, read, readNum, nearest, bisect, series: E_SERIES, fields: FIELDS, tasks: TASKS }, _st: ST };
  root.WSL_UI_EXT = root.WSL_UI_EXT || {}; root.WSL_UI_EXT.design = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
