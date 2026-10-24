/* wslrig-leistung.js - WSL-Lab (WP2b): Pruefstand 3 `leistung` - Wirk-, Blind- und Scheinleistung, cos phi (SPEC 5.3).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.power.fromPcos / fromUIphi / fromMeasure / triangle / line, WSL_CORE.sine.at / shift); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung). Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Modell: ideale Last, Beharrungszustand, 50 Hz (limits f_netz).
 * Steuerwerte: u (V, Effektivwert), gib (p = Wirkleistung gegeben, i = Strom gegeben), p (W, log), i (A, log), cosphi (0 bis 1), art (induktiv, kapazitiv),
 *   rl (Ohm, Leitungswiderstand, Uebungswert), ansicht (zeit, zeiger), ziel (var, Vorgabe |Q|, 0 = keine Vorgabe, Ampel dann grau), Taste fire (Messung mit drei Geraeten).
 * Messgeraete: p (W), q (var, kapazitiv negativ, F2), s (VA), cosphi, i (A), pv (W, Leitungsverlust I^2 * R_L).
 * Zeigerbild (phasors): die Leistungszeiger P, Q, S mit gemeinsamem Massstab (Bezug Spannung, phi = phi_u - phi_i, induktiv phi > 0).
 * Zeitbild (waveform): u, i und p = u * i ueber ganze Perioden; marks.nulls = Nulldurchgaenge von p(t), pMean = Mittelwert = P.
 * state().rechenweg: nach der Taste fire die Zeilen der Messung aus WSL_CORE.power.fromMeasure (Pool S2022-N18).
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-leistung.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = T0.modell || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  const KONV = T0.konvention || 'Bezug ist bei der Reihenschaltung der Strom, bei der Parallelschaltung die Spannung. φ = φ_u − φ_i: induktiv ist φ positiv, kapazitiv negativ.';
  const AM = x => (Math.abs(x) >= 1 ? fm(x, 2) : fm(x, 3)) + ' A';
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const niceMax = v => { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; };

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = B.fillControls([
    { key: 'u', label: 'Spannung U', type: 'slider', scale: 'lin', min: 1, max: 400, step: 1, unit: 'V', unitKind: 'volt', value: 230, gruppe: 'quelle', sicht: 'zeit',
      help: 'Effektivwert der Spannung an der Last. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'gib', label: 'Gegeben ist', type: 'select', value: 'p', options: opt([['p', 'Wirkleistung P (mit cos φ)'], ['i', 'Strom I (mit cos φ)']]), gruppe: 'last', sicht: 'formel',
      help: 'Welche Größe du vorgibst: die Wirkleistung P oder den Strom I. Der Leistungsfaktor cos φ kommt immer dazu; die übrigen Leistungen und der Strom folgen aus der Rechnung.' },
    { key: 'p', label: 'Wirkleistung P', type: 'slider', scale: 'log', min: 10, max: 100000, step: 1, unit: 'W', unitKind: 'watt', value: 3200, gruppe: 'last', sicht: 'zeiger',
      visible: s => s.gib === 'p', help: 'Wirkleistung der Last in W: der Teil der Leistung, der in Wärme oder Arbeit umgesetzt wird. Übungswert.' },
    { key: 'i', label: 'Strom I', type: 'slider', scale: 'log', min: 0.01, max: 100, step: 0.01, unit: 'A', unitKind: 'amp', value: 10, gruppe: 'last', sicht: 'zeiger',
      visible: s => s.gib === 'i', help: 'Effektivwert des Stroms durch die Last. Aus U und I folgt die Scheinleistung S = U · I. Übungswert.' },
    { key: 'cosphi', label: 'Leistungsfaktor cos φ', type: 'slider', scale: 'lin', min: 0, max: 1, step: 0.01, unit: '', unitKind: 'plain', value: 0.8, gruppe: 'last', sicht: 'zeiger',
      help: 'Verhältnis von Wirkleistung zu Scheinleistung, cos φ = P / S. Bei 1 ist die Last rein ohmsch. Bei 0 ist die Wirkleistung null (reine Blindlast): Mit der Vorgabe P lässt sich dann nichts berechnen.' },
    { key: 'art', label: 'Art der Last', type: 'select', value: 'induktiv', options: opt([['induktiv', 'induktiv (Q positiv)'], ['kapazitiv', 'kapazitiv (Q negativ)']]), gruppe: 'last', sicht: 'zeiger',
      help: 'Induktive Last: Der Strom eilt der Spannung nach, Q ist positiv. Kapazitive Last: Der Strom eilt der Spannung vor, Q ist negativ.' },
    { key: 'rl', label: 'Leitungswiderstand R_L', type: 'slider', scale: 'lin', min: 0, max: 10, step: 0.01, unit: 'Ω', unitKind: 'res', value: 0.5, gruppe: 'bauteile', sicht: 'formel',
      help: 'Widerstand der Zuleitung für die Verlustrechnung P_V = I² · R_L. Übungswert (Übungsleitung), kein Leitungsquerschnitt.' },
    { key: 'ansicht', label: 'Ansicht', type: 'select', value: 'zeit', options: opt([['zeit', 'Zeit: p(t) und u, i'], ['zeiger', 'Zeiger: Leistungsdreieck']]), gruppe: 'ziel', sicht: 'zeit',
      help: 'Welches Bild groß zu sehen ist: der Verlauf p(t) = u · i über der Zeit oder das Leistungsdreieck mit den Zeigern. Die Rechnung ist in beiden Ansichten dieselbe.' },
    { key: 'ziel', label: 'Vorgabe Blindleistung |Q|', type: 'slider', scale: 'log', logZero: true, min: 0, max: 100000, step: 1, unit: 'var', unitKind: 'var', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für den Betrag der Blindleistung Q in var. Bei 0 var ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Messung starten', type: 'button', gruppe: 'ziel', sicht: 'formel',
      help: 'Misst mit Spannungs-, Strom- und Leistungsmesser und zeigt den Rechenweg: S = U · I, cos φ = P / S, Q = √(S² − P²). Die Art der Last (induktiv oder kapazitiv) ist aus diesen drei Messwerten allein nicht erkennbar.' }
  ]);
  const METERS = [
    { key: 'p', label: 'Wirkleistung P', unit: 'W', digits: 1, min: 0, max: 100000, help: 'Wirkleistung in W, der Mittelwert von p(t) = u · i.' },
    { key: 'q', label: 'Blindleistung Q', unit: 'var', digits: 1, min: -100000, max: 100000, help: 'Blindleistung in var. Induktiv positiv, kapazitiv negativ. Sie pendelt zwischen Quelle und Last hin und her.' },
    { key: 's', label: 'Scheinleistung S', unit: 'VA', digits: 1, min: 0, max: 100000, help: 'Scheinleistung in VA, S = U · I. Sie ist die Hypotenuse des Leistungsdreiecks aus P und Q.' },
    { key: 'cosphi', label: 'Leistungsfaktor cos φ', unit: '', digits: 3, min: 0, max: 1, help: 'Leistungsfaktor cos φ = P / S.' },
    { key: 'i', label: 'Strom I', unit: 'A', digits: 3, min: 0, max: 100, help: 'Effektivwert des Stroms, I = S / U.' },
    { key: 'pv', label: 'Leitungsverlust P_V', unit: 'W', digits: 2, min: 0, max: 10000, help: 'Verlustleistung in der Zuleitung, P_V = I² · R_L. Bei kleinem cos φ fließt für dieselbe Wirkleistung mehr Strom.' }
  ];
  const PRESETS = [
    { id: 'motor', name: 'Motor', info: 'Übungsschaltung (Pool S2023-N05): ' + K(c => { const q = c.power.fromPcos(3200, 0.8, 230); return 'P = 3,2 kW und cos φ = 0,8 bei 230 V ergeben S = ' + val(q.s / 1000, 'kVA', 2) + ', Q = ' + val(q.q / 1000, 'kvar', 2) + ' und I = ' + AM(q.i) + '.'; }),
      controls: { gib: 'p', u: 230, p: 3200, cosphi: 0.8, art: 'induktiv' } },
    { id: 'spule-messen', name: 'Spule messen', info: 'Übungsschaltung (Pool S2022-N18): ' + K(c => { const m = c.power.fromMeasure(100, 0.25, 12); return 'Spannungs-, Strom- und Leistungsmesser zeigen 100 V, 0,25 A und 12 W; daraus folgen S = ' + val(m.s, 'VA') + ', cos φ = ' + fm(m.cosphi, 2) + ' und Q = ' + val(m.q, 'var', 1) + '.'; }),
      controls: { gib: 'i', u: 100, i: 0.25, cosphi: 0.48, art: 'induktiv' } },
    { id: 'leuchtstoffampel', name: 'Leuchtstofflampe (Übungswert)', info: 'Übungswerte (F17): ' + K(c => { const q = c.power.fromPcos(36, 0.5, 230); return 'P = 36 W und cos φ = 0,5 bei 230 V ergeben S = ' + val(q.s, 'VA') + ', Q = ' + val(q.q, 'var', 1) + ' und I = ' + AM(q.i) + '.'; }),
      controls: { gib: 'p', u: 230, p: 36, cosphi: 0.5, art: 'induktiv' } },
    { id: 'ohmsch', name: 'Ohmsche Last', info: 'Übungsschaltung: ' + K(c => { const q = c.power.fromPcos(2000, 1, 230); return 'Bei cos φ = 1 gilt S = P = ' + val(q.s, 'VA') + ', Q = ' + val(q.q, 'var') + '; der Strom beträgt ' + AM(q.i) + '.'; }),
      controls: { gib: 'p', u: 230, p: 2000, cosphi: 1, art: 'induktiv' } },
    { id: 'kapazitiv', name: 'Kapazitive Last', info: 'Übungsschaltung: ' + K(c => { const q = c.power.fromPcos(3200, 0.8, 230, 'kapazitiv'); return 'Dieselbe Wirkleistung wie beim Motor, aber kapazitiv: Q = ' + val(q.q / 1000, 'kvar', 2).replace('-', '−') + ' ist negativ, der Strom ' + AM(q.i) + ' eilt der Spannung vor.'; }),
      controls: { gib: 'p', u: 230, p: 3200, cosphi: 0.8, art: 'kapazitiv' } }
  ];
  const SICHT = { zeit: 'Zeitbild: p(t) = u · i, über null fließt Energie zur Last, unter null zurück', zeiger: 'Leistungsdreieck mit P, Q, S und dem Winkel φ', formel: 'S = √(P² + Q²), cos φ = P / S, Q = P · tan φ' };
  const INFO = 'Wirk-, Blind- und Scheinleistung mit Leistungsdreieck, cos φ und Leitungsverlust. ' + KONV + ' ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE, PW = CORE.power;
    const F = B.limV(CORE, 'f_netz', 50);
    const mem = { meas: false };

    function compute(ctl) {
      let r;
      if (ctl.gib === 'p') r = PW.fromPcos(ctl.p, ctl.cosphi, ctl.u, ctl.art);
      else {
        let phi;
        if (ctl.cosphi > 0) { const t = PW.fromPcos(1, ctl.cosphi, ctl.u, ctl.art); phi = t && t.ok !== false && t.valid !== false ? t.phi : NaN; }
        else phi = ctl.art === 'kapazitiv' ? -90 : 90;
        r = PW.fromUIphi(ctl.u, ctl.i, phi);
      }
      if (!r || r.ok === false || r.valid === false) return { ok: false, why: (r && (r.why || r.text)) || CORE.TEXTS.eingabe, gib: ctl.gib };
      const tri = PW.triangle(r);
      let L, L1 = null;
      const useP = r.p > 0 && r.cosphi > 0;
      L = useP ? PW.line({ p: r.p, cosphi: r.cosphi, u: ctl.u, rl: ctl.rl }) : PW.line({ p: r.s, cosphi: 1, u: ctl.u, rl: ctl.rl });
      if (useP) L1 = PW.line({ p: r.p, cosphi: 1, u: ctl.u, rl: ctl.rl });
      if (!L || L.ok === false) return { ok: false, why: (L && L.why) || CORE.TEXTS.eingabe, gib: ctl.gib };
      if (L1 && L1.ok === false) L1 = null;
      return { ok: true, r, tri, L, L1, art: tri && tri.ok !== false ? tri.art : 'ohmsch', u: ctl.u, f: F };
    }
    function meters(res) {
      if (!res.ok) return { p: 0, q: 0, s: 0, cosphi: 0, i: 0, pv: 0 };
      const r = res.r;
      return { p: r.p, q: r.q, s: r.s, cosphi: r.cosphi, i: r.i, pv: res.L.pv };
    }
    function assess(res, ctl) {
      if (!res.ok) return { ok: false, ampel: 'rot', text: res.why };
      const soll = ctl.ziel, ist = Math.abs(res.r.q), pct = Math.abs(ist - soll) / soll * 100;
      const amp = B.devAmpel(pct, CORE);
      let text = B.devText('Blindleistung |Q|', ist, soll, 'var', pct, CORE);
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Die Blindleistung ist zu klein.' : ' Die Blindleistung ist zu groß.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Blindleistung |Q| ' + val(soll, 'var'), soll, ist, unit: 'var' } };
    }
    function rechenweg(res) {
      if (!res.ok || !mem.meas) return [];
      let m = null;
      try { m = PW.fromMeasure(res.r.u, res.r.i, res.r.p); } catch (e) { m = null; }
      if (!m || m.ok === false || m.valid === false) return [];
      return ['Gemessen: U = ' + val(res.r.u, 'V') + ', I = ' + AM(res.r.i) + ', P = ' + val(res.r.p, 'W') + '.',
        'S = U · I = ' + val(m.s, 'VA') + '.',
        'cos φ = P / S = ' + fm(m.cosphi, 3) + '.',
        'Q = √(S² − P²) = ' + val(m.q, 'var', 1) + '. Ob die Last induktiv oder kapazitiv ist, zeigt die Messung allein nicht.'];
    }
    function diag(res, ctl) {
      if (!res.ok) return [{ id: 'ungueltig', kind: 'error', text: res.why }];
      const out = [], r = res.r;
      if (r.reinBlind) out.push({ id: 'rein-blind', kind: 'info', text: CORE.TEXTS.blindLast });
      if (res.art === 'induktiv') out.push({ id: 'art', kind: 'info', text: 'Induktive Last: Q ist positiv, der Strom eilt der Spannung nach.' });
      else if (res.art === 'kapazitiv') out.push({ id: 'art', kind: 'info', text: 'Kapazitive Last: Q ist negativ, der Strom eilt der Spannung vor.' });
      if (res.L1 && res.L.pv > res.L1.pv * (1 + 1e-9)) out.push({ id: 'verlust', kind: 'info', text: 'Bei cos φ = ' + fm(r.cosphi, 3) + ' fließt ' + AM(r.i) + ' statt ' + AM(res.L1.i) + ': Der Leitungsverlust ' + val(res.L.pv, 'W') + ' ist das ' + fm(res.L.pv / res.L1.pv, 2) + '-Fache des Verlusts bei cos φ = 1 (' + val(res.L1.pv, 'W') + ', gleiche Wirkleistung).' });
      return out;
    }
    function waveform(res, ctl, o) {
      if (!res.ok) return null;
      o = o || {};
      const s = res.r, f = F, T = 1 / f, n = clamp(Math.floor(num(o.n, 360)), 24, 4000), per = clamp(Math.floor(num(o.periods, 2)), 1, 20);
      const k = T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 };
      const uh = ctl.u * Math.SQRT2, ih = s.i * Math.SQRT2;
      const cu = { ampl: uh, f, phi: 0 }, ci = { ampl: ih, f, phi: -s.phi };      // i = î · sin(ωt − φ) bei φ = φ_u − φ_i
      const t = [], yu = [], yi = [], yp = [], nulls = [];
      for (let q = 0; q < n; q++) {
        const ts = -T / 2 + q * (per * T) / (n - 1), a = CORE.sine.at(cu, ts), b = CORE.sine.at(ci, ts);
        t.push(ts * k.k); yu.push(a); yi.push(b); yp.push(a * b);
      }
      for (let q = 1; q < n; q++) {
        const a = yp[q - 1], b = yp[q];
        if ((a < 0 && b > 0) || (a > 0 && b < 0)) nulls.push(t[q - 1] + (t[q] - t[q - 1]) * a / (a - b));
      }
      const span = [{ t0: 0, t1: T * k.k, name: 'T' }];
      const sh = CORE.sine.shift({ f, phi: s.phi });
      if (sh && sh.ok !== false && sh.dir !== 'gleich' && Math.abs(s.phi) > 1e-9 && Math.abs(s.phi) < 180) { const t1 = s.phi / 360 * T; span.push({ t0: Math.min(0, t1) * k.k, t1: Math.max(0, t1) * k.k, name: 'Δt' }); }
      return { tUnit: k.u, t, series: [{ name: 'u', unit: 'V', kind: 'u', y: yu }, { name: 'i', unit: 'A', kind: 'i', y: yi }, { name: 'p', unit: 'W', kind: 'p', y: yp }],
        marks: { h: [{ y: uh, name: 'û', series: 0 }, { y: ih, name: 'î', series: 1 }], span, nulls }, periods: per, T, pMean: s.p };
    }
    function phasors(res) {
      if (!res.ok) return { ok: false, why: res.why };
      const r = res.r, tri = res.tri;
      if (!tri || tri.ok === false) return { ok: false, why: CORE.TEXTS.eingabe };
      const sgn = tri.q < 0 ? -1 : 1;
      return { ok: true, art: res.art, bezug: 'spannung', phi: r.phi, effektiv: true, unit: 'VA',
        list: [{ name: 'P', len: r.p, angle: 0, kind: 'p', unit: 'W' }, { name: 'Q', len: Math.abs(r.q), angle: sgn * 90, kind: 'q', unit: 'var' }, { name: 'S', len: r.s, angle: r.phi, kind: 's', unit: 'VA' }] };
    }
    function curves(res, ctl) {
      if (!res.ok) return [];
      const r = res.r, out = [], wf = waveform(res, ctl, { n: 240, periods: 1 });
      if (wf) {
        out.push({ id: 'pt', title: 'Augenblicksleistung p(t) = u · i über der Zeit', xLabel: 'Zeit t', xUnit: wf.tUnit, xScale: 'lin', yLabel: 'Leistung p', yUnit: 'W', series: [{ name: 'p(t)', points: wf.t.map((x, k) => [x, wf.series[2].y[k]]) }], limit: { y: r.p, label: 'P (Mittelwert)' } });
      }
      if (!(r.p > 0)) return out;
      const xs = [], qq = [], ii = [], vv = [];
      const N = 60;
      for (let k = 0; k <= N; k++) {
        const c = 0.1 + 0.9 * k / N, a = PW.fromPcos(r.p, c, ctl.u, ctl.art), l = PW.line({ p: r.p, cosphi: c, u: ctl.u, rl: ctl.rl });
        if (!a || a.ok === false || a.valid === false || !l || l.ok === false) continue;
        xs.push(c); qq.push([c, a.q]); ii.push([c, a.i]); vv.push([c, l.pv]);
      }
      const mk = y => ({ x: r.cosphi, y, label: 'jetzt' });
      const X = { xLabel: 'Leistungsfaktor cos φ', xUnit: '–', xScale: 'lin' };
      out.push(Object.assign({ id: 'blind', title: 'Blindleistung Q über cos φ bei gleicher Wirkleistung', yLabel: 'Blindleistung Q', yUnit: 'var', series: [{ name: 'Q', points: qq }], marker: mk(r.q) }, X));
      out.push(Object.assign({ id: 'strom', title: 'Strom I über cos φ bei gleicher Wirkleistung', yLabel: 'Strom I', yUnit: 'A', series: [{ name: 'I', points: ii }], marker: mk(r.i) }, X));
      out.push(Object.assign({ id: 'verlust', title: 'Leitungsverlust P_V über cos φ bei gleicher Wirkleistung', yLabel: 'Verlust P_V', yUnit: 'W', series: [{ name: 'P_V', points: vv }], marker: mk(res.L.pv) }, X));
      return out;
    }
    function state(res, ctl) {
      const base = { ansicht: ctl.ansicht, gib: ctl.gib, messung: mem.meas, f: F };
      if (!res.ok) return Object.assign(base, { valid: false, why: res.why, art: '', text: res.why, rechenweg: [] });
      const r = res.r;
      return Object.assign(base, { valid: true, art: res.art, text: r.reinBlind ? CORE.TEXTS.blindLast : '', p: r.p, q: r.q, s: r.s, i: r.i, cosphi: r.cosphi, phi: r.phi, pv: res.L.pv, pv1: res.L1 ? res.L1.pv : 0,
        ratio: res.L1 && res.L1.pv > 0 ? res.L.pv / res.L1.pv : 1, reinBlind: !!r.reinBlind, rechenweg: rechenweg(res) });
    }

    function wrap(ctx, g, text, maxW, size, maxLines) {
      const words = String(text).split(' '), lines = []; let cur = '';
      ctx.font = g.font(size, false);
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines || 4);
    }
    function lossPanel(ctx, rect, res, ctl, sc) {
      const g = sc.gfx, pal = sc.pal;
      if (!(rect.w > 60 && rect.h > 30)) return false;
      g.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 6);
      const x = rect.x + 10, w = rect.w - 20;
      let y = rect.y + 14;
      g.text(ctx, 'Leitungsverlust P_V = I² · R_L, R_L = ' + eng(ctl.rl, 'Ω'), x, y, { size: 11, bold: true, color: pal.fg, max: w });
      y += 6;
      const rows = [['jetzt, cos φ = ' + fm(res.r.cosphi, 3) + ': ' + val(res.L.pv, 'W'), res.L.pv, pal.loss]];
      if (res.L1) rows.push(['bei cos φ = 1: ' + val(res.L1.pv, 'W'), res.L1.pv, pal.p]);
      const mx = Math.max(res.L.pv, res.L1 ? res.L1.pv : 0) * 1.15 || 1;
      rows.forEach(rw => {
        if (y + 26 > rect.y + rect.h) return;
        g.text(ctx, rw[0], x, y + 12, { size: 11, color: pal.fg, max: w });
        g.bar(ctx, x, y + 16, w, 9, rw[1], mx, rw[2], pal);
        y += 30;
      });
      return true;
    }
    function metersRow(ctx, rect, res, sc, gap) {
      const r = res.r, g = sc.gfx, pal = sc.pal;
      const items = [['Spannungsmesser', r.u, 'V'], ['Strommesser', r.i, 'A'], ['Leistungsmesser', r.p, 'W']];
      const cw = (rect.w - gap * 2) / 3;
      items.forEach((it, k) => {
        const rr = { x: rect.x + k * (cw + gap), y: rect.y, w: cw, h: rect.h };
        const done = sc.view('meter', rr, { value: it[1], min: 0, max: niceMax(it[1] * 1.1), unit: it[2], label: it[0], kind: rr.h >= 110 && cw >= 100 ? 'zeiger' : 'digital' }, {});
        if (!done) g.chip(ctx, it[0], val(it[1], it[2]), rr.x, rr.y, rr.w, Math.min(rr.h, 30), pal, { size: 11 });
      });
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, g = sc.gfx;
      if (!r || !r.ok) {
        const lines = wrap(ctx, g, (r && r.why) || '', R0.w - 16, 13, 4);
        lines.forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const ctl = view.ctl, s = r.r, zeit = ctl.ansicht !== 'zeiger', H = R0.h;
      const wf = waveform(r, ctl, { n: sc.quality === 'niedrig' ? 160 : 360 });
      const ph = phasors(r);
      const R = {};
      if (R0.w >= 680) {
        const lw = Math.round(R0.w * 0.55) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(H * 0.58), h3 = Math.round(H * 0.26), h4 = Math.round(H * 0.3);
        R.main = { x: R0.x, y: R0.y, w: lw, h: h1 }; R.second = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: H - h1 - gap };
        R.sch = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h3 }; R.met = { x: R0.x + lw + gap, y: R0.y + h3 + gap, w: rw, h: h4 };
        R.loss = { x: R0.x + lw + gap, y: R0.y + h3 + h4 + 2 * gap, w: rw, h: H - h3 - h4 - 2 * gap };
      } else {
        const hs = [0.28, 0.21, 0.17, 0.14, 0.2].map(q => Math.round((H - 4 * gap) * q));
        let y = R0.y;
        ['main', 'second', 'met', 'loss', 'sch'].forEach((k, n) => { R[k] = { x: R0.x, y, w: R0.w, h: hs[n] }; y += hs[n] + gap; });
      }
      const drawTime = rect => {
        if (!wf) return;
        const done = sc.view('powerWave', rect, { t: wf.t, p: wf.series[2].y, pMean: wf.pMean, tUnit: wf.tUnit, unit: 'W' }, {});
        if (!done) sc.view('scope', rect, { t: wf.t, tUnit: wf.tUnit, series: [wf.series[2]] }, {});
      };
      const drawScope = rect => { if (wf) sc.view('scope', rect, { t: wf.t, tUnit: wf.tUnit, series: wf.series.slice(0, 2), marks: wf.marks }, {}); };
      const drawTri = rect => sc.view('triangle', rect, { kind: 'leistung', a: s.p, b: s.q }, {});
      const drawPh = rect => {
        if (!ph.ok) { g.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 6); g.text(ctx, ph.why || '', rect.x + 10, rect.y + 24, { size: 12, color: pal.mute, max: rect.w - 20 }); return; }
        sc.view('phasor', rect, { list: ph.list.map(z => Object.assign({}, z, { name: z.name + ' in ' + z.unit })), bezug: ph.bezug, arc: Math.abs(s.phi) > 0.5 && s.p > 0 ? { a: 'S in VA', b: 'P in W', label: 'φ' } : null, rotate: false, project: false }, {});
      };
      if (zeit) { drawTime(R.main); drawScope(R.second); } else { drawTri(R.main); drawPh(R.second); }
      sc.hit('ansicht', R.second.x, R.second.y, R.second.w, R.second.h);
      sc.view('schematic', R.sch, { kind: 'reihe', elems: ['Z'], labels: { u: 'U = ' + val(ctl.u, 'V'), z: ctl.art === 'kapazitiv' ? 'Last kapazitiv' : 'Last', i: 'I' } }, {});
      metersRow(ctx, R.met, r, sc, gap);
      lossPanel(ctx, R.loss, r, ctl, sc);
    }
    return {
      compute, meters, assess, diag, curves, waveform, phasors, state, draw,
      phaseHz: () => 0.15,
      fire(res) {
        if (!res.ok) { P0.say('Mit diesen Werten gibt es keine Messung: ' + res.why, 'warn'); return false; }
        mem.meas = true;
        P0.bump();
        rechenweg(res).forEach(l => P0.say(l, 'info'));
        return true;
      },
      reset() { mem.meas = false; }
    };
  }

  R.register({ id: 'leistung', name: 'Wirk-, Blind- und Scheinleistung', icon: '⚡', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'leistung', name: 'Wirk-, Blind- und Scheinleistung', icon: '⚡', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
