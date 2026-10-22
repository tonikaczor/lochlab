/* emvrig-layout.js - EMV-Lab, Prüfstand `layout` (Leiterplatten-Layout: zwölf Fälle, Rückstrom, Schleifenfläche, Abblock-C), Paket WP2c.
 *
 * Laden: im Browser NACH emvcore.js, emvcore-lay.js, emvdraw.js und emvrig-base.js; in Node holt sich die Datei Kern und Basis per require.
 * Fehlt die Basis (emvrig-base.js) oder EMV_CORE.layout (emvcore-lay.js), meldet sie console.warn und registriert nichts.
 * Übungsanlage: alle Zahlen kommen aus EMV_CORE.layout (solve, pdnCurve, returnSplit) und sind Übungswerte, keine Vorhersage einer echten Platine.
 * Herstellerdokumentation und aktuelle Norm maßgeblich. Deterministisch (Seed), setControl/step/draw werfen nie.
 *
 * Schnittstelle: SPEC 5.0 und 5.6; Steuerwerte fall, fix1..3, stack, f (Hz), i (mA), view. Wirkungskette Quelle (Signal- oder Schaltstrom),
 * Pfad (Schleife aus Hin- und Rückpfad), Senke (Abstrahlung). Partikelanteile = EMV_CORE.layout.returnSplit (exakt, ganze Zahlen, Test).
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;

  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  if (!R.base) tryRequire('./emvrig-base.js');
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('emvrig-layout.js: emvrig-base.js fehlt - Prüfstand layout nicht registriert.'); return; }
  if (!root.EMV_CORE || !root.EMV_CORE.layout) { tryRequire('./emvcore.js'); tryRequire('./emvcore-lay.js'); }
  const CORE0 = root.EMV_CORE;
  if (!CORE0 || !CORE0.layout || typeof CORE0.layout.solve !== 'function' || !Array.isArray(CORE0.layout.cases) || !CORE0.layout.cases.length) {
    if (typeof console !== 'undefined') console.warn('emvrig-layout.js: EMV_CORE.layout (emvcore-lay.js) fehlt - Prüfstand layout nicht registriert.');
    return;
  }

  const { clamp, num, isNum, fm, fn, eng, gfx, okv } = B;
  const CASES = CORE0.layout.cases;
  const caseOf = id => CASES.find(c => c.id === id) || CASES[0];
  const C1 = CASES[0];
  const nFix = c => (c && c.fixes ? Math.min(3, c.fixes.length) : 0);
  const hasFix = (s, n) => !!s && nFix(caseOf(s.fall)) >= n;
  const fixText = (s, n) => { const c = caseOf(s && s.fall), f = c.fixes && c.fixes[n - 1]; return f ? f.text : 'Maßnahme ' + n; };
  const hasPdnCase = c => /^abblock/.test(c.id);
  const FREQ_SNAP = [50, 150e3, 1e6, 30e6, 100e6, 1e9];
  const STACKS = [
    { value: '2', label: '2 Lagen ohne Fläche' },
    { value: '2gnd', label: '2 Lagen, Massefläche auf der Gegenseite (1,5 mm)' },
    { value: '4', label: '4 Lagen, Massefläche unter der Signallage (0,2 mm)' }
  ];

  const TX = {
    info: 'Zwölf vorgegebene Fälle einer Leiterplatte, jeder mit Ausgangszustand, bis zu drei Maßnahmen und wählbarem Lagenaufbau. Du siehst von oben, wo der Hinstrom (rot) und der Rückstrom (blau) fließen, wie groß die Schleifenfläche wird und was das für die Abstrahlung heißt. Übungsanlage: Die Zahlen sind Übungswerte, keine Vorhersage einer echten Platine. Herstellerdokumentation und aktuelle Norm maßgeblich.',
    umweg: (x, y, z) => 'Der Rückstrom muss einen Umweg von ' + fm(x, 1) + ' mm nehmen: Schleifenfläche ' + fm(y, 1) + ' mm² statt ' + fm(z, 1) + ' mm².',
    abblWeit: (x, y) => 'Der Kondensator ist ' + fm(x, 1) + ' nH vom Pin entfernt: Seine Wirkung endet bei ' + eng(y, 'Hz') + '.',
    antires: (f, z) => 'Antiresonanz bei ' + eng(f, 'Hz') + ': Die Impedanz steigt auf ' + fm(z, 2) + ' Ω.',
    retHf: (f, hf, ft) => 'Bei f = ' + eng(f, 'Hz') + ' fließen ' + fm(hf, 0) + ' % des Rückstroms unter dem Hinleiter (Übergangsfrequenz ft = ' + eng(ft, 'Hz') + '). Unterhalb von ft sucht sich der Rückstrom den Weg des kleinsten Widerstands, oberhalb folgt er dem Hinleiter.',
    xtalk: k => 'Übersprechen auf die Nachbarleitung: ' + fm(k, 1) + ' dB (Verhältnis der Störspannung zur Signalspannung).',
    bad: 'Rechnung nicht möglich: Der Fall liefert keine gültigen Werte.',
    keinGrenzwert: (root.EMV_CORE && root.EMV_CORE.TEXTS && root.EMV_CORE.TEXTS.lay && root.EMV_CORE.TEXTS.lay.keinGrenzwert) || 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert: Die Ampel bleibt grau.',
    help: {
      fall: 'Wähle einen der zwölf Fälle. Beim Wechsel gehen die Maßnahmen aus, Lagenaufbau, Frequenz und Strom stellen sich auf die Werte des Falls.',
      fix: 'Schaltet die Maßnahme des gewählten Falls ein (die Beschriftung hängt vom Fall ab). Jede Maßnahme verkleinert die Schleifenfläche oder verbessert die Impedanz bzw. das Übersprechen.',
      stack: 'Lagenaufbau: 2 Lagen ohne Fläche, 2 Lagen mit Massefläche auf der Gegenseite (Abstand 1,5 mm) oder 4 Lagen mit Massefläche direkt unter der Signallage (0,2 mm). Je dichter die Fläche, desto kleiner die Schleife.',
      f: 'Frequenz des Signals. Bei der Übergangsfrequenz ft wechselt der Rückstrom vom Weg des kleinsten Widerstands auf den Weg unter dem Hinleiter.',
      i: 'Strom im Hinleiter (Spitzenwert). Die Abstrahlung steigt mit dem Strom, mit der Schleifenfläche und mit dem Quadrat der Frequenz.',
      view: 'Ansicht: Strom (Partikel), Feld (Wellenringe um die Schleife) oder Impedanz |Z|(f) der Abblockkondensatoren.'
    }
  };

  const CONTROLS = [
    { key: 'fall', label: 'Fall', type: 'select', value: C1.id, options: CASES.map((c, i) => ({ value: c.id, label: (i + 1) + ' ' + c.title })), group: 'Fall', lever: null, help: TX.help.fall },
    { key: 'fix1', label: 'Maßnahme 1', labelOf: s => fixText(s, 1), type: 'switch', value: false, group: 'Maßnahmen', lever: 'pfad', visible: s => hasFix(s, 1), help: TX.help.fix, helpOf: s => fixText(s, 1) + '. ' + TX.help.fix },
    { key: 'fix2', label: 'Maßnahme 2', labelOf: s => fixText(s, 2), type: 'switch', value: false, group: 'Maßnahmen', lever: 'pfad', visible: s => hasFix(s, 2), help: TX.help.fix, helpOf: s => fixText(s, 2) + '. ' + TX.help.fix },
    { key: 'fix3', label: 'Maßnahme 3', labelOf: s => fixText(s, 3), type: 'switch', value: false, group: 'Maßnahmen', lever: 'pfad', visible: s => hasFix(s, 3), help: TX.help.fix, helpOf: s => fixText(s, 3) + '. ' + TX.help.fix },
    { key: 'stack', label: 'Lagenaufbau', type: 'select', value: C1.stackDefault || '2gnd', options: STACKS, group: 'Maßnahmen', lever: 'pfad', help: TX.help.stack },
    { key: 'f', label: 'Frequenz f', type: 'slider', scale: 'log', unitKind: 'freq', min: 1e4, max: 1e9, step: 1e4, unit: 'Hz', value: clamp(C1.f0 || 1e8, 1e4, 1e9), snap: FREQ_SNAP, group: 'Signal', lever: 'quelle', help: TX.help.f },
    { key: 'i', label: 'Strom i (Spitze)', type: 'slider', scale: 'log', min: 0.1, max: 1000, step: 0.1, unit: 'mA', unitKind: 'cur', value: clamp((C1.i0 || 0.01) * 1000, 0.1, 1000), group: 'Signal', lever: 'quelle', help: TX.help.i },
    { key: 'view', label: 'Ansicht', type: 'select', value: 'strom', options: [{ value: 'strom', label: 'Strom (Partikel)' }, { value: 'feld', label: 'Feld (Wellenringe)' }, { value: 'z', label: 'Impedanz |Z|(f)' }], group: 'Anzeige und Vorgaben', lever: null, help: TX.help.view }
  ];
  const METERS = [
    { key: 'area', label: 'Schleifenfläche A', unit: 'mm²', digits: 1, min: 0, max: 1000 },
    { key: 'lloop', label: 'Schleifeninduktivität', unit: 'nH', digits: 1, min: 0, max: 200 },
    { key: 'ft', label: 'Übergangsfrequenz ft', unit: 'kHz', digits: 1, min: 0, max: 1000 },
    { key: 'hf', label: 'Rückstrom unter dem Hinleiter', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'eDb', label: 'Abstrahlung bei 3 m', unit: 'dBµV/m', digits: 1, min: -40, max: 80 },
    { key: 'eRel', label: 'gegen Ausgangszustand', unit: 'dB', digits: 1, min: -60, max: 20 },
    { key: 'margin', label: 'Marge zur Übungsgrenzlinie (A)', unit: 'dB', digits: 1, min: -40, max: 40, warnBelow: 0 },
    { key: 'z100', label: 'Impedanz bei 100 MHz', unit: 'Ω', digits: 2, min: 0, max: 20, visible: s => !!s && hasPdnCase(caseOf(s.fall)) },
    { key: 'zpeak', label: 'Antiresonanz-Spitze', unit: 'Ω', digits: 2, min: 0, max: 50, visible: s => !!s && hasPdnCase(caseOf(s.fall)) },
    { key: 'xtalk', label: 'Übersprechen', unit: 'dB', digits: 1, min: -80, max: 0, visible: s => !!s && s.fall === 'parallel' }
  ];

  function presets() {
    const out = [];
    CASES.forEach((c, i) => {
      const base = { fall: c.id, stack: c.stackDefault || '2gnd', f: clamp(c.f0 || 1e8, 1e4, 1e9), i: clamp((c.i0 || 0.01) * 1000, 0.1, 1000), fix1: false, fix2: false, fix3: false, view: 'strom' };
      out.push({ id: c.id, name: (i + 1) + ' ' + c.title + ' (Ausgangszustand)', params: Object.assign({}, base) });
      if (nFix(c)) { const p = Object.assign({}, base); for (let n = 1; n <= nFix(c); n++) p['fix' + n] = true; out.push({ id: c.id + '-ok', name: (i + 1) + ' ' + c.title + ' (alle Maßnahmen)', params: p }); }
    });
    return out;
  }

  // ---------------------------------------------------------------------------------------------------- Geometrie (mm)
  const plen = pts => { let l = 0; for (let i = 1; i < (pts || []).length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
  const hOfStack = st => (st === '4' ? 0.2 : st === '2gnd' ? 1.5 : 0);
  function segCross(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  const crossesSlits = (a, b, slits) => (slits || []).some(s => segCross(a, b, [s.x0, s.y0], [s.x1, s.y1]));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Schleifenpolygon: Hinleiter plus umgekehrter Rückpfad (EMV_CORE.layout speichert `ret` wie `forward` von Start nach Ende, der Rückstrom läuft entgegen)
  function loopPoly(fwd, ret) { fwd = fwd || []; ret = ret || []; return fwd.concat(ret.slice().reverse()); }
  // Weg des kleinsten Widerstands (niedrige Frequenz): geradeaus zurück, wenn kein Schlitz im Weg liegt, sonst der Weg des Hochfrequenz-Rückstroms
  function lfPathOf(res) {
    const f = res.forward || [], r = res.ret || [];
    if (f.length < 2) return r;
    const a = f[f.length - 1], b = f[0];
    if (!res.plane || crossesSlits(a, b, res.slits)) return r;
    return [a, b];
  }
  const centroid = pts => { let sx = 0, sy = 0; (pts || []).forEach(p => { sx += p[0]; sy += p[1]; }); const n = Math.max(1, (pts || []).length); return [sx / n, sy / n]; };
  function tint(col, k) {   // Farbe zum Weiß hin aufhellen (Kern der Partikel hebt sich von der Leiterbahn ab)
    const m = /^#([0-9a-f]{6})$/i.exec(String(col)); if (!m) return col; const v = parseInt(m[1], 16), c = [v >> 16, (v >> 8) & 255, v & 255].map(x => Math.round(x + (255 - x) * k));
    return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function share(total, fr) {   // ganze Zahlen, Summe exakt = total (größter Rest)
    const s = fr.reduce((a, b) => a + b, 0) || 1, ex = fr.map(f => f / s * total), out = ex.map(Math.floor); let rest = total - out.reduce((a, b) => a + b, 0);
    const ord = ex.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0]);
    for (let i = 0; rest > 0 && i < ord.length; i++, rest--) out[ord[i][1]]++;
    return out;
  }
  // Partikelzahlen: Dichte wächst mit dem Strom (logarithmisch, Normalbereich 0,1 ... 1000 mA); Hin- und Rückleiter führen denselben Strom,
  // der Rückstrom teilt sich nach EMV_CORE.layout.returnSplit auf (hf unter dem Hinleiter, lf auf dem Weg des kleinsten Widerstands).
  function partCounts(iMa, split, pool) {
    const frac = clamp((Math.log10(Math.max(0.1, iMa)) + 1) / 4, 0, 1);
    const N = Math.round(10 + frac * (Math.max(40, pool) / 2 - 10));
    const sp = share(N, [split.hf, split.lf]);
    return { forward: N, hf: sp[0], lf: sp[1], total: N + sp[0] + sp[1] };
  }

  // ---------------------------------------------------------------------------------------------------- Rechnung
  const memo = new WeakMap();
  function compute(ctl, params, CORE) {
    const L = CORE.layout, cs = caseOf(ctl.fall);
    const fixes = { fix1: !!ctl.fix1 && nFix(cs) >= 1, fix2: !!ctl.fix2 && nFix(cs) >= 2, fix3: !!ctl.fix3 && nFix(cs) >= 3 };
    const res = L.solve(cs.id, { fixes: fixes, stack: ctl.stack, f: ctl.f, i: ctl.i / 1000 });
    const m0 = { area: 0, lloop: 0, ft: 0, hf: 0, eDb: 0, eRel: 0, margin: 0, z100: 0, zpeak: 0, xtalk: 0 };
    if (!res || res.ok === false) return { ok: false, why: (res && res.why) || TX.bad, cs: cs, m: m0, fixes: fixes };
    const ft = isNum(res.ft) ? res.ft : 0;
    const split = res.split && isNum(res.split.hf) ? { hf: res.split.hf, lf: isNum(res.split.lf) ? res.split.lf : 1 - res.split.hf } : (typeof L.returnSplit === 'function' ? L.returnSplit(ctl.f, ft) : { hf: 1, lf: 0 });
    const free = !isNum(res.margin) || res.limitFree === true, margin = free ? 0 : res.margin;
    let ampel = free ? 'grau' : B.ampelNorm(res.ampel);
    if (!free) try { const a = CORE.assess && typeof CORE.assess.margin === 'function' ? CORE.assess.margin(margin) : null; if (a && a.ampel) ampel = B.ampelNorm(a.ampel); else if (typeof a === 'string') ampel = B.ampelNorm(a); } catch (e) { /* Kern-Ampel bleibt */ }
    if (!free && ampel === 'grau') ampel = B.ampelFromMargin(margin);
    const detour = Math.max(0, plen(res.ret) - plen(res.forward));
    const m = {
      area: isNum(res.area) ? res.area : 0, lloop: isNum(res.lloop) ? res.lloop : 0, ft: ft / 1000, hf: split.hf * 100, eDb: isNum(res.eDb) ? res.eDb : 0,
      eRel: isNum(res.eRel) ? res.eRel : 0, margin: margin, z100: res.pdn && isNum(res.pdn.z100) ? res.pdn.z100 : 0, zpeak: res.pdn && isNum(res.pdn.zPeak) ? res.pdn.zPeak : 0, xtalk: res.xtalk && isNum(res.xtalk.kdB) ? res.xtalk.kdB : 0
    };
    return { ok: true, free: free, cs: cs, res: res, split: split, ampel: ampel, detour: detour, lf: lfPathOf(res), m: m, ft: ft, fixes: fixes, f: ctl.f, i: ctl.i, stack: ctl.stack, hStack: hOfStack(ctl.stack), slits: res.slits || (res.plane && res.plane.slits) || [] };
  }
  const FZ = (function () { const a = []; for (let k = 0; k <= 80; k++) a.push(1e6 * Math.pow(10, k * 3 / 80)); return a; })();   // 1 MHz ... 1 GHz
  const FE = (function () { const a = []; for (let k = 0; k <= 40; k++) a.push(1e4 * Math.pow(10, k * 5 / 40)); return a; })();   // 10 kHz ... 1 GHz
  function branchesOf(v) {
    const r = v.res, p = r.pdn || {};
    if (Array.isArray(p.branches)) return p.branches;
    if (Array.isArray(r.branches)) return r.branches;
    const caps = (r.parts || []).filter(q => q && (q.C || q.c) && /cap|kond|c/i.test(String(q.kind || q.type || 'cap')));
    return caps.length ? caps.map(q => ({ C: q.C || q.c, ESR: q.ESR || q.esr || 0.03, ESL: q.ESL || q.esl || 1e-9, Lmount: q.Lmount || q.lMount || 0, nVia: q.nVia || 1 })) : null;
  }
  function zCurve(v, CORE) {
    const br = branchesOf(v); if (!br || typeof CORE.layout.pdnCurve !== 'function') return null;
    const r = CORE.layout.pdnCurve(br, FZ); if (!r) return null;
    let pts = null;
    if (Array.isArray(r)) pts = r.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.f, p.z !== undefined ? p.z : p.y]);
    else if (Array.isArray(r.points)) pts = r.points;
    else if (Array.isArray(r.z) && Array.isArray(r.f)) pts = r.f.map((f, k) => [f, r.z[k]]);
    else if (Array.isArray(r.z)) pts = FZ.map((f, k) => [f, r.z[k]]);
    return pts ? pts.filter(p => isNum(p[0]) && isNum(p[1])) : null;
  }
  function antiRes(pts) {   // lokales Maximum im Inneren der Kurve (Antiresonanz zwischen zwei Kondensatoren)
    if (!pts || pts.length < 5) return null; let best = null;
    for (let k = 2; k < pts.length - 2; k++) if (pts[k][1] > pts[k - 1][1] && pts[k][1] >= pts[k + 1][1] && pts[k][1] > pts[k - 2][1] && pts[k][1] > pts[k + 2][1]) { if (!best || pts[k][1] > best[1]) best = pts[k]; }
    return best;
  }
  function memoOf(v, key, fnc) { if (!v || typeof v !== 'object') return fnc(); let m = memo.get(v); if (!m) { m = {}; memo.set(v, m); } if (!(key in m)) m[key] = fnc(); return m[key]; }

  function assess(v, ctl) {
    if (!v || !v.ok) return { ok: false, ampel: 'grau', text: (v && v.why) || TX.bad };
    const cs = v.cs, mg = v.m.margin, key = v.ampel, sym = B.AMP[key].sym;
    if (v.free) return { ok: false, ampel: 'grau', freq: v.f, text: sym + ' ' + cs.title + ': Abstrahlung ' + fm(v.res.eDb, 1) + ' dBµV/m bei 3 m. ' + TX.keinGrenzwert };
    return { ok: key !== 'rot', ampel: key, margin: mg, freq: v.f, text: sym + ' ' + cs.title + ': Abstrahlung ' + fm(v.res.eDb, 1) + ' dBµV/m bei 3 m, Marge ' + fm(mg, 1) + ' dB gegen die Übungsgrenzlinie (A) bei f = ' + eng(v.f, 'Hz') + '.' };
  }

  // Die Meldungstexte stammen aus EMV_CORE.diagnose (einzige Quelle); ohne diagnose (alter Kern) gelten die kurzen Hilfstexte TX.
  function coreList(ctx) {
    try { const D = root.EMV_CORE && root.EMV_CORE.diagnose; if (typeof D !== 'function') return null; const r = D(ctx); return Array.isArray(r) ? r : null; } catch (e) { return null; }
  }
  function diag(v, ctl) {
    const out = []; if (!v || !v.ok) return out; const res = v.res, CORE = root.EMV_CORE, cx = {};
    const pdn = res.pdn || null, direct = isNum(res.areaDirectMm2) ? res.areaDirectMm2 : (plen(res.forward) * v.hStack || res.area), detour = isNum(res.detourMm) ? res.detourMm : v.detour;
    cx.layout = { detourMm: detour, areaMm2: res.area, areaDirectMm2: direct };
    let zc = null;
    if (pdn) { cx.abbl = pdn.abbl || { c: ((branchesOf(v) || [])[0] || {}).C, lmountH: (pdn.lMount || 0) * 1e-9, eslH: ((branchesOf(v) || [])[0] || {}).esl }; zc = memoOf(v, 'z', () => zCurve(v, CORE)); if (zc) cx.pdnCurve = zc.map(p => ({ f: p[0], z: p[1] })); }
    if (v.free) cx.noLimit = { id: 'str-B-10m', f: v.f };
    const list = coreList(cx);
    if (list) list.forEach(d => { if (d && d.id && d.text) out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }); });
    else {   // Notfall ohne EMV_CORE.diagnose: nur Meldungen, deren Bedingung hier geprüft ist
      if (detour > 1 && res.area > direct) out.push({ id: 'rueck-umweg', kind: 'warn', text: TX.umweg(detour, res.area, direct) });
      if (pdn) {
        const lm = isNum(pdn.lMount) ? pdn.lMount : (isNum(pdn.lTot) ? pdn.lTot : 0);
        if (lm > 3) out.push({ id: 'abbl-weit', kind: 'warn', text: TX.abblWeit(lm, pdn.fres) });
        const ar = antiRes(zc); if (ar) out.push({ id: 'antires', kind: 'warn', text: TX.antires(ar[0], ar[1]) });
      }
      if (v.free) out.push({ id: 'limit-frei', kind: 'info', text: TX.keinGrenzwert });
    }
    if (res.xtalk && isNum(res.xtalk.kdB)) out.push({ id: 'xtalk', kind: 'info', text: TX.xtalk(res.xtalk.kdB) });
    out.push({ id: 'ret-hf', kind: 'info', text: TX.retHf(v.f, v.split.hf * 100, v.ft) });
    return out;
  }

  function curves(v, ctl) {
    const CORE = root.EMV_CORE;
    if (!v || !v.ok) return [{ id: 'e', title: 'Abstrahlung', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV/m', series: [{ name: 'keine Rechnung', points: [[1e4, 0], [1e9, 0]] }], marker: { x: 1e6, y: 0 } }];
    return memoOf(v, 'curves', () => {
      const L = CORE.layout, cs = v.cs, out = [], base = { fixes: v.fixes, stack: v.stack, i: v.i / 1000 };
      const pts = FE.map(f => { const r = L.solve(cs.id, Object.assign({ f: f }, base)); return [f, r && isNum(r.eDb) ? r.eDb : 0]; });
      const e = { id: 'e', title: 'Abstrahlung der Schleife bei 3 m', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV/m', series: [{ name: 'aktueller Zustand', points: pts }], marker: { x: v.f, y: v.res.eDb, text: fm(v.res.eDb, 1) + ' dBµV/m' } };
      if (CORE.limits && typeof CORE.limits.at === 'function') {
        const lp = FE.map(f => { const g = CORE.limits.at('str-B-10m', f); return g !== null && isNum(g) ? [f, g + 20 * Math.log10(10 / 3)] : null; }).filter(Boolean);
        if (lp.length > 1) e.limit = { name: 'Übungsgrenzlinie (A), 3 m', pts: lp };
      }
      out.push(e);
      const sp = FE.map(f => [f, 100 * (typeof L.returnSplit === 'function' ? L.returnSplit(f, v.ft).hf : (f * f) / (f * f + v.ft * v.ft))]);
      out.push({ id: 'split', title: 'Rückstrom unter dem Hinleiter', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Anteil', yUnit: '%', series: [{ name: 'unter dem Hinleiter', points: sp }], marker: { x: v.f, y: v.split.hf * 100, text: fm(v.split.hf * 100, 0) + ' %' } });
      const zp = v.res.pdn ? zCurve(v, CORE) : null;
      if (zp && zp.length > 1) {
        const nearest = zp.reduce((b, p) => Math.abs(Math.log(p[0] / v.f)) < Math.abs(Math.log(b[0] / v.f)) ? p : b, zp[0]);
        out.push({ id: 'z', title: 'Impedanz der Abblockkondensatoren', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Impedanz', yUnit: 'Ω', series: [{ name: '|Z|', points: zp }], marker: { x: nearest[0], y: nearest[1], text: fm(nearest[1], 2) + ' Ω' } });
      }
      return out;
    });
  }

  // Die Zeichenhelfer der Basis verwerfen Zahlen ab 1e7: Kurven über der Frequenz werden zum Zeichnen in MHz umgerechnet (curves() bleibt in Hz).
  function chartCopy(cv) {
    if (!cv || cv.xUnit !== 'Hz') return cv;
    const sc = p => [p[0] / 1e6, p[1]], ser = cv.series.map(s => Object.assign({}, s, { points: s.points.map(sc) }));
    if (cv.limit && cv.limit.pts) ser.push({ name: cv.limit.name || 'Grenzlinie', points: cv.limit.pts.map(sc) });
    return Object.assign({}, cv, { xUnit: 'MHz', series: ser, limit: undefined, marker: cv.marker ? Object.assign({}, cv.marker, { x: cv.marker.x / 1e6 }) : cv.marker });
  }
  // Kurven zeichnen: bevorzugt EMV_DRAW.curveChart (Frequenzachse, Grenzlinie, Marker), sonst der Notfall der Basis
  function chartIn(ctx, x, y, w, h, cv, sc) {
    const D = B.getDraw();
    if (D && typeof D.curveChart === 'function') { let r = false; try { r = D.curveChart(ctx, { x: x, y: y, w: w, h: h }, [cv], { palette: sc.pal, quality: sc.quality, theme: sc.theme }); } catch (e) { r = false; } if (r) return true; }
    return !!gfx.curveChart(ctx, x, y, w, h, chartCopy(cv), { pal: sc.pal, size: sc.fs + 1 });
  }

  // ---------------------------------------------------------------------------------------------------- Partikelpool (fester Pool, kein new je Bild)
  function makePool(max, seed) {
    const pool = { max: max, n: 0, path: new Int16Array(max), u: new Float32Array(max), paths: [], cnt: [] };
    const rnd = B.mulberry32(seed || 1);
    pool.setPaths = function (paths) {
      pool.paths = paths.map(p => {
        const pts = (p.pts && p.pts.length > 1 ? p.pts : [[0, 0], [1, 0]]).filter(q => okv(q[0], q[1])), cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts: pts, cum: cum, len: cum[cum.length - 1] || 1, color: p.color, dir: p.dir === -1 ? -1 : 1, speed: p.speed || 30, key: p.key };
      });
      pool.cnt = pool.paths.map(() => 0);
    };
    pool.assign = function (counts) {
      let k = 0; pool.cnt = pool.paths.map(() => 0);
      for (let p = 0; p < pool.paths.length; p++) {
        const c = Math.max(0, Math.floor(counts[p] || 0));
        for (let j = 0; j < c && k < pool.max; j++, k++) { pool.path[k] = p; pool.u[k] = ((j + 0.5) / c + 0.15 * (rnd() - 0.5) / Math.max(1, c)) % 1; pool.cnt[p]++; }
      }
      pool.n = k;
    };
    pool.step = function (dtS) {
      for (let i = 0; i < pool.n; i++) { const p = pool.paths[pool.path[i]]; let u = pool.u[i] + p.dir * p.speed * dtS / p.len; u -= Math.floor(u); pool.u[i] = u; }
    };
    pool.pos = function (p, u, out) {
      const P0 = pool.paths[p], d = u * P0.len, c = P0.cum; let lo = 0, hi = c.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
      const seg = (c[hi] - c[lo]) || 1, f = (d - c[lo]) / seg, a = P0.pts[lo], b = P0.pts[hi];
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = (b[0] - a[0]) / seg; out[3] = (b[1] - a[1]) / seg;
    };
    return pool;
  }

  // ---------------------------------------------------------------------------------------------------- Zeichnung
  const PCB = { dark: { board: '#0f3b2e', plane: 'rgba(52,214,164,0.17)', copper: '#e0a840', via: '#e0a840' }, light: { board: '#bfe3d4', plane: 'rgba(15,118,110,0.18)', copper: '#a8741a', via: '#a8741a' } };
  function drawPartShape(ctx, p, tr, sc, pal) {
    if (!p) return; const kind = String(p.kind || p.type || p.t || ''), x = isNum(p.x) ? p.x : (Array.isArray(p) ? p[0] : 0), y = isNum(p.y) ? p.y : (Array.isArray(p) ? p[1] : 0);
    const w = isNum(p.w) ? p.w : kind === 'ic' ? 12 : 4, h = isNum(p.h) ? p.h : kind === 'ic' ? 12 : 2.4, name = p.label || p.name || p.id || '';
    const cx = p.cx !== undefined ? p.cx : x + w / 2, cy = p.cy !== undefined ? p.cy : y + h / 2;
    const px = tr.x(cx - w / 2), py = tr.y(cy - h / 2), pw = w * sc, ph = h * sc;
    gfx.rr(ctx, px, py, pw, ph, 3); ctx.fillStyle = kind === 'ic' ? '#2b3340' : /xtal|quarz/.test(kind) ? '#9aa5b1' : /conn|stecker/.test(kind) ? '#5a6572' : pal.schutz; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.lineWidth = 1; ctx.stroke();
    if (name && pw > 22) gfx.text(ctx, String(name), px + pw / 2, py + ph / 2, { align: 'center', base: 'middle', size: 11, color: '#fff', max: pw - 2 });
  }
  const fpath = (ctx, pts, tr) => { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(tr.x(p[0]), tr.y(p[1])) : ctx.moveTo(tr.x(p[0]), tr.y(p[1])))); };

  function header(ctx, w, sc, view, rigChain) {
    const pal = sc.pal, narrow = w < 640, a = view.ampel;
    const cw = narrow ? w - 8 : Math.max(240, w - Math.min(300, w * 0.4) - 8);
    gfx.chainBar(ctx, 4, 3, cw, 44, rigChain, sc.active, { pal: pal, size: sc.fs });
    if (narrow) { gfx.ampelRow(ctx, 8, 62, a, { pal: pal, size: sc.fs + 1, max: w - 16 }); return 80; }
    gfx.ampelRow(ctx, cw + 14, 25, a, { pal: pal, size: sc.fs + 1, max: w - cw - 20 });
    return 52;
  }

  const CHAIN = { quelle: 'Signal- oder Schaltstrom', pfad: 'Schleife aus Hin- und Rückpfad (Fläche, Induktivität)', senke: 'Abstrahlung, Nachbarleitung, Versorgungseinbruch', art: 'gestrahlt', kopplung: ['induktiv', 'strahlung'] };

  function plant(P0) {
    const S = { pool: null, poolKey: '', counts: null, geo: null, areaRef: {}, dt: 0, anim: 0 };
    function areaRefOf(v) {
      if (isNum(v.res.areaRef) && v.res.areaRef > 0) return v.res.areaRef;
      const k = v.cs.id; if (S.areaRef[k]) return S.areaRef[k];
      let a = v.res.area || 1;
      try { const r = P0.CORE.layout.solve(k, { fixes: { fix1: false, fix2: false, fix3: false }, stack: v.cs.stackDefault || v.stack, f: v.cs.f0 || v.f, i: v.cs.i0 || v.i / 1000 }); if (r && isNum(r.area) && r.area > 0) a = r.area; } catch (e) { /* Bezug = aktuelle Fläche */ }
      return (S.areaRef[k] = a);
    }
    function ensurePool(v, sc, pal, scale) {
      const spacing = sc.quality === 'hoch' ? 6 : sc.quality === 'mittel' ? 9 : 14, lenPx = Math.max(60, plen(v.res.forward) * (scale || 4)), cap = Math.max(12, Math.min(sc.qp.particles, 2 * Math.round(lenPx / spacing))), sig = [sc.quality, v.cs.id, JSON.stringify(v.fixes), v.stack, Math.round(v.f), v.i.toFixed(3), pal.quelle].join('|');
      if (S.poolKey === sig && S.pool) return S.pool;
      const pool = makePool(cap, 1), r = v.res, fw = r.forward || [], rt = r.ret || [];
      pool.setPaths([{ pts: fw, color: pal.quelle, dir: 1, speed: 36, key: 'hin' }, { pts: rt, color: pal.senke, dir: -1, speed: 36, key: 'hf' }, { pts: v.lf, color: pal.masse, dir: -1, speed: 36, key: 'lf' }]);
      const c = partCounts(v.i, v.split, cap); pool.assign([c.forward, c.hf, c.lf]); pool.counts = c;
      S.pool = pool; S.poolKey = sig; S.counts = c; return pool;
    }
    function drawBoard(ctx, bx, by, bw, bh, v, ctl, t, sc, view) {
      const pal = sc.pal, qp = sc.qp, ghost = sc.ghost, cs = v.cs, res = v.res, th = PCB[sc.theme] || PCB.dark;
      const W = (cs.world && cs.world.w) || 100, H = (cs.world && cs.world.h) || 70, pad = 8;
      const s = Math.min((bw - 2 * pad) / W, (bh - 2 * pad - 20) / H), ox = bx + (bw - W * s) / 2, oy = by + 20 + (bh - 20 - H * s) / 2;
      const tr = { x: x => ox + x * s, y: y => oy + y * s };
      S.geo = { x: ox, y: oy, w: W * s, h: H * s, s: s, tr: tr };
      gfx.text(ctx, (CASES.indexOf(cs) + 1) + ' ' + cs.title, ox, by + 12, { size: sc.fs + 1, bold: true, color: pal.fg, max: Math.max(80, W * s) });
      gfx.rr(ctx, ox, oy, W * s, H * s, 6); ctx.fillStyle = th.board; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pal.line; ctx.stroke();
      const pl = res.plane || cs.plane;
      if (pl && pl.rect) { const r = pl.rect; ctx.fillStyle = th.plane; ctx.fillRect(tr.x(r[0]), tr.y(r[1]), r[2] * s, r[3] * s); ctx.strokeStyle = pal.masse; ctx.lineWidth = 1; ctx.strokeRect(tr.x(r[0]), tr.y(r[1]), r[2] * s, r[3] * s); }
      else if (v.stack !== '2') { ctx.fillStyle = th.plane; ctx.fillRect(tr.x(1), tr.y(1), (W - 2) * s, (H - 2) * s); }
      v.slits.forEach(sl => { ctx.strokeStyle = pal.bg; ctx.lineWidth = Math.max(4, 2 * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tr.x(sl.x0), tr.y(sl.y0)); ctx.lineTo(tr.x(sl.x1), tr.y(sl.y1)); ctx.stroke(); ctx.lineCap = 'butt'; });
      const fw = res.forward || [], rt = res.ret || [], poly = loopPoly(fw, rt);
      // Rückstromverteilung unter dem Hinleiter: weiches Band, Breite ~ Lagenabstand, Deckkraft ~ Anteil unter dem Hinleiter
      if (fw.length > 1 && !ghost && v.split.hf > 0.02 && v.hStack > 0) {
        const bwid = clamp(v.hStack * 2 * s * 3, 5, 28);
        [1, 0.62, 0.3].forEach((k, q) => { ctx.strokeStyle = pal.senke; ctx.globalAlpha = 0.10 + 0.12 * v.split.hf * (3 - q) / 3; ctx.lineWidth = bwid * k + 2; ctx.lineCap = 'round'; fpath(ctx, fw, tr); ctx.stroke(); });
        ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      }
      // Schleifenfläche: gefülltes Polygon, pulsierend (höchstens 2,5 Hz), Helligkeit ~ Fläche / Fläche im Ausgangszustand
      const rel = clamp(res.area / Math.max(1e-9, areaRefOf(v)), 0, 1.5);
      const pulse = sc.reduced || ghost ? 0.5 : 0.5 + 0.5 * Math.sin((view.phase || 0) * Math.PI * 2);
      if (poly.length >= 3) {
        fpath(ctx, poly, tr); ctx.closePath(); ctx.fillStyle = pal.quelle; ctx.globalAlpha = clamp(0.10 + 0.40 * rel * (0.7 + 0.3 * pulse), 0.05, 0.6); ctx.fill(); ctx.globalAlpha = 1;
        ctx.setLineDash && ctx.setLineDash([5, 4]); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
      }
      (res.parts || cs.parts || []).forEach(p => drawPartShape(ctx, p, tr, s, pal));
      (res.vias || []).forEach(p => { const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y; ctx.beginPath(); ctx.arc(tr.x(x), tr.y(y), Math.max(3, 1.1 * s), 0, Math.PI * 2); ctx.fillStyle = th.via; ctx.fill(); ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.5; ctx.stroke(); });
      ctx.lineJoin = 'round';
      if (rt.length > 1) { ctx.strokeStyle = pal.masse; ctx.lineWidth = 1.5; ctx.setLineDash && ctx.setLineDash([6, 4]); fpath(ctx, rt, tr); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]); }
      if (fw.length > 1) { ctx.strokeStyle = th.copper; ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(2.5, 0.8 * s); fpath(ctx, fw, tr); ctx.stroke(); ctx.globalAlpha = 1; }
      // Ansichten
      if (ctl.view === 'feld') drawRings(ctx, tr, poly, v, t, sc, view);
      else if (ctl.view !== 'z' && !ghost) {
        const pool = ensurePool(v, sc, pal, s);
        const prev = ctx.globalCompositeOperation, tmp = [0, 0, 0, 0], rsz = sc.quality === 'niedrig' ? 3.2 : 3.8;
        [qp.glow ? 2.3 : 0, 1].forEach((grow, pass) => {
          if (!grow) return; if (pass === 0) ctx.globalCompositeOperation = 'lighter'; else ctx.globalCompositeOperation = prev;
          pool.paths.forEach((pp, k) => {
            ctx.fillStyle = pass === 0 ? pp.color : tint(pp.color, 0.62); ctx.globalAlpha = pass === 0 ? 0.30 : 1; ctx.beginPath(); const sz = rsz * grow * (pass === 0 ? 1 : 0.9);
            for (let i = 0; i < pool.n; i++) { if (pool.path[i] !== k) continue; pool.pos(k, pool.u[i], tmp); const x = tr.x(tmp[0]), y = tr.y(tmp[1]); ctx.rect(x - sz / 2, y - sz / 2, sz, sz); }
            ctx.fill();
          });
        });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = prev;
        // Richtungspfeile (statisch, auch bei reduzierter Bewegung)
        pool.paths.forEach(pp => { if (pp.pts.length < 2) return; pool.pos(pool.paths.indexOf(pp), 0.5, tmp); const ux = tmp[2] * pp.dir, uy = tmp[3] * pp.dir, x = tr.x(tmp[0]), y = tr.y(tmp[1]); ctx.fillStyle = pp.color; ctx.beginPath(); ctx.moveTo(x + ux * 7, y + uy * 7); ctx.lineTo(x - ux * 3 - uy * 5, y - uy * 3 + ux * 5); ctx.lineTo(x - ux * 3 + uy * 5, y - uy * 3 - ux * 5); ctx.closePath(); ctx.fill(); });
      }
      // Fehlermarken (nur wenn die Oberfläche sie verlangt)
      if (view.defects && !ghost) (res.defectsActive || []).forEach(id => { const d = (cs.defects || []).find(q => q.id === id); if (!d) return; const r = d.rect; ctx.strokeStyle = pal.rot; ctx.lineWidth = 2; ctx.setLineDash && ctx.setLineDash([4, 3]); ctx.strokeRect(tr.x(r[0]), tr.y(r[1]), r[2] * s, r[3] * s); ctx.setLineDash && ctx.setLineDash([]); });
      // Messmarken an den Stellen, an denen sie entstehen
      const cen = centroid(poly.length ? poly : fw), lx = clamp(tr.x(cen[0]), ox + 56, ox + W * s - 56), ly = clamp(tr.y(cen[1]), oy + 16, oy + H * s - 16);
      gfx.text(ctx, 'A = ' + fm(res.area, 1) + ' mm²', lx, ly - 7, { align: 'center', base: 'middle', bold: true, size: sc.fs, color: pal.fg, bg: pal.panel, pad: 2 });
      gfx.text(ctx, 'L = ' + fm(res.lloop, 1) + ' nH', lx, ly + 11, { align: 'center', base: 'middle', size: sc.fs, color: pal.fg, bg: pal.panel, pad: 2 });
      if (res.pdn) gfx.text(ctx, '|Z| bei 100 MHz = ' + fm(res.pdn.z100, 2) + ' Ω', ox + 8, oy + H * s - 12, { base: 'middle', size: sc.fs, color: pal.fg, bg: pal.panel, pad: 2 });
      if (res.xtalk) gfx.text(ctx, 'Übersprechen ' + fm(res.xtalk.kdB, 1) + ' dB', ox + 8, oy + H * s - 12, { base: 'middle', size: sc.fs, color: pal.fg, bg: pal.panel, pad: 2 });
      return tr;
    }
    function drawRings(ctx, tr, poly, v, t, sc, view) {   // Feldansicht: Wellenringe um die Schleife (Symbolik; Abstand ~ Wellenlänge, logarithmisch skaliert, höchstens 8 Ringe)
      const pal = sc.pal, cen = centroid(poly), cx = tr.x(cen[0]), cy = tr.y(cen[1]), n = sc.quality === 'niedrig' ? 3 : 6;
      const lam = 299792458 / Math.max(1e4, v.f), spacing = clamp(8 + 14 * (Math.log10(lam) + 1), 8, 64), mg = v.free ? NaN : v.res.margin;
      const key = v.free ? 'grau' : mg < 0 ? 'rot' : mg < 6 ? 'gelb' : 'gruen', col = pal[key];
      const D = B.getDraw();
      if (D && typeof D.waves === 'function') {
        let ok = false; try { ok = D.waves(ctx, cx, cy, { t: (view.simT || 0) * 1000, lambda: lam, margin: mg, rings: n, maxR: Math.min(190, Math.max(40, S.geo ? S.geo.w / 2 : 120)), quarter: false, quality: sc.quality, reduced: sc.reduced, palette: pal }); } catch (e) { ok = false; }
        if (ok) { gfx.text(ctx, (v.free ? '– kein Grenzwert bei dieser Frequenz' : mg < 0 ? '✗ über der Grenzlinie' : mg < 6 ? '! knapp unter der Grenzlinie' : '✓ unter der Grenzlinie') + ', λ = ' + eng(lam, 'm'), cx, clamp(cy + 70, 30, 1e5), { align: 'center', size: sc.fs, color: pal.fg, bg: pal.panel, pad: 3 }); return; }
      }
      const ph = sc.reduced ? 0 : (view.phase || 0) % 1;
      for (let k = 0; k < n; k++) { const r = (k + ph) * spacing + 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.globalAlpha = clamp((1 - (k + ph) / n) * (0.25 + 0.5 * (20 - clamp(mg, -20, 20)) / 40), 0.05, 0.9); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.globalAlpha = 1;
      gfx.text(ctx, (v.free ? '– kein Grenzwert bei dieser Frequenz' : mg < 0 ? '✗ über der Grenzlinie' : mg < 6 ? '! knapp unter der Grenzlinie' : '✓ unter der Grenzlinie') + ', λ = ' + eng(lam, 'm'), cx, clamp(cy + spacing * n * 0.35 + 26, 30, 1e5), { align: 'center', size: sc.fs, color: pal.fg, bg: pal.panel, pad: 3 });
    }
    function side(ctx, x, y, w, h, v, ctl, sc) {
      const pal = sc.pal; if (w < 160 || h < 60) return;
      gfx.panel(ctx, x, y, w, h, pal.panel, pal.line, 8);
      const fs = sc.fs; let yy = y + 18;
      gfx.text(ctx, 'Rückstrom bei f = ' + eng(v.f, 'Hz'), x + 10, yy, { size: fs, bold: true, color: pal.fg, max: w - 20 }); yy += 12;
      const bw = w - 20, hf = v.split.hf; ctx.fillStyle = pal.senke; ctx.fillRect(x + 10, yy, bw * hf, 14); ctx.fillStyle = pal.masse; ctx.fillRect(x + 10 + bw * hf, yy, bw * (1 - hf), 14);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; for (let k = Math.ceil(bw * hf / 6) * 6; k < bw; k += 6) ctx.fillRect(x + 10 + k, yy, 2, 14);   // Schraffur des anderen Anteils (nie nur Farbe)
      yy += 30; gfx.text(ctx, fm(hf * 100, 0) + ' % unter dem Hinleiter', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 }); yy += 16;
      gfx.text(ctx, fm(v.split.lf * 100, 0) + ' % auf dem Weg des kleinsten Widerstands', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 }); yy += 16;
      gfx.text(ctx, 'ft = ' + eng(v.ft, 'Hz') + ' (Lagenaufbau ' + v.stack + ')', x + 10, yy, { size: fs, color: pal.mute, max: w - 20 }); yy += 20;
      gfx.text(ctx, 'E = ' + fm(v.res.eDb, 1) + ' dBµV/m bei 3 m', x + 10, yy, { size: fs + 1, bold: true, color: pal.fg, max: w - 20 }); yy += 16;
      gfx.text(ctx, (v.res.eRel >= 0 ? '+' : '') + fm(v.res.eRel, 1) + ' dB gegen den Ausgangszustand', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 }); yy += 16;
      gfx.text(ctx, v.free ? 'kein Grenzwert unter 30 MHz (Ampel grau)' : 'Marge ' + fm(v.res.margin, 1) + ' dB zur Übungsgrenzlinie (A)', x + 10, yy, { size: fs, color: pal.fg, max: w - 20 }); yy += 8;
      const ch = Math.min(190, y + h - yy - 6);
      if (ch >= 120 && w >= 200 && !sc.ghost) {
        const cvs = curves(v, ctl), cv = ctl.view === 'z' && cvs[2] ? cvs[2] : cvs[0];
        chartIn(ctx, x + 2, yy, w - 4, ch, cv, sc);
      }
    }
    return {
      compute, assess, diag, curves,
      meters: v => (v && v.m) || {},
      state(v, ctl) {
        const sp = v && v.ok ? v.split : { hf: 0, lf: 0 };
        return { ft: v && v.ok ? v.ft : 0, hf: sp.hf, lf: sp.lf, area: v && v.ok ? v.res.area : 0, animSlow: true, phaseHz: Math.min(2.5, 0.5 * Math.log10(Math.max(10, ctl.f))), fixLabels: [1, 2, 3].map(n => fixText(ctl, n)), nFix: nFix(caseOf(ctl.fall)),
          partikel: S.counts || (v && v.ok ? partCounts(v.i, v.split, B.QUAL.hoch.particles) : null) };
      },
      phaseHz(v, ctl) { return Math.min(2.5, 0.5 * Math.log10(Math.max(10, ctl.f))); },
      step(dtMs) { S.dt += dtMs / 1000; if (S.pool && S.pool.n) S.pool.step(Math.min(0.25, dtMs / 1000)); },
      onControl(key, old) {
        if (key === 'fall') {
          const c = caseOf(P0.ctl.fall);
          P0.setCtl('fix1', false); P0.setCtl('fix2', false); P0.setCtl('fix3', false);
          P0.setCtl('stack', c.stackDefault || '2gnd'); P0.setCtl('f', clamp(c.f0 || P0.ctl.f, 1e4, 1e9)); P0.setCtl('i', clamp((c.i0 || P0.ctl.i / 1000) * 1000, 0.1, 1000));
          S.pool = null; S.poolKey = '';
        } else if (/^fix[123]$/.test(key) && !hasFix(P0.ctl, +key.slice(3))) P0.setCtl(key, false);
        else if (key === '*') { S.pool = null; S.poolKey = ''; }
      },
      reset() { S.pool = null; S.poolKey = ''; S.counts = null; S.dt = 0; },
      hit(px, py, w, h, view) {
        const g = S.geo; if (!g || !(px >= g.x && px <= g.x + g.w && py >= g.y && py <= g.y + g.h)) return null;
        const r = view.res && view.res.res; if (!r) return { key: 'fall' };
        const fwd = r.forward || [], x = (px - g.x) / g.s, y = (py - g.y) / g.s;
        const nearFwd = fwd.length > 1 && fwd.some((p, k) => k && distSeg(x, y, fwd[k - 1], p) < 3.5);
        if (nearFwd) return { key: 'f' };
        const ret = r.ret || []; if (ret.length > 1 && ret.some((p, k) => k && distSeg(x, y, ret[k - 1], p) < 3.5)) return { key: 'stack' };
        return { key: 'fall' };
      },
      draw(ctx, w, h, t, view, sc) {
        const v = view.res, ctl = view.ctl, pal = sc.pal;
        if (!sc.ghost) { const top = header(ctx, w, sc, view, CHAIN); S.top = top; }
        const top = S.top || 52;
        if (!v || !v.ok) { gfx.text(ctx, (v && v.why) || TX.bad, w / 2, h / 2, { align: 'center', size: 14, color: pal.fg, max: w - 20 }); return; }
        const wide = w >= 640, bw = wide ? Math.round(w * 0.62) : w, bh = wide ? h - top : Math.round((h - top) * 0.60);
        if (ctl.view === 'z' && v.res.pdn && !sc.ghost) {
          const cvs = curves(v, ctl), cv = cvs[2];
          if (cv && bw >= 200 && bh >= 120) { chartIn(ctx, 4, top, bw - 8, bh - 4, cv, sc); }
          else drawBoard(ctx, 0, top, bw, bh, v, ctl, t, sc, view);
        } else drawBoard(ctx, 0, top, bw, bh, v, ctl, t, sc, view);
        if (ctl.view === 'z' && !v.res.pdn) gfx.text(ctx, 'Dieser Fall hat keine Abblockkondensatoren: Wähle Fall 5 oder 6 für die Impedanzkurve.', 8, top + bh - 8, { size: sc.fs, color: pal.fg, bg: pal.panel, pad: 3, max: bw - 16 });
        const sx = wide ? bw + 6 : 6, sy = wide ? top + 2 : top + bh + 4, sw = wide ? w - bw - 12 : w - 12, shh = wide ? h - top - 6 : h - top - bh - 8;
        side(ctx, sx, sy, sw, shh, v, ctl, sc);
        gfx.text(ctx, 'Animation verlangsamt (Symbolik, Übungsanlage)', w - 8, h - 6, { align: 'right', size: Math.max(11, sc.fs - 1), color: pal.mute, max: w - 16 });
      }
    };
  }
  function distSeg(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let u = l2 > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; u = clamp(u, 0, 1);
    return Math.hypot(x - (a[0] + u * dx), y - (a[1] + u * dy));
  }

  const SPEC = {
    id: 'layout', name: 'Leiterplatten-Layout', icon: '🧩', info: TX.info, world: { w: 100, h: 70 }, chain: CHAIN,
    controls: CONTROLS, noLever: ['fall', 'view'], meters: METERS, presets: presets(), params: { rTest: 3 },
    plant
  };
  R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, create: opts => B.makeRig(SPEC, opts) });
  R.layoutHelpers = { loopPoly, partCounts, share, lfPathOf, plen };
})(typeof window !== 'undefined' ? window : globalThis);
