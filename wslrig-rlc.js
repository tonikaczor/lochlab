/* wslrig-rlc.js - WSL-Lab (WP2a): Pruefstand 2 `rlc` - R, L, C im Wechselstromkreis und Zeigerdiagramm (SPEC 5.2).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.rlc.series / parallel / phasors / reactance, WSL_CORE.sine.at / shift); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung). Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Modell: ideale Bauteile, Beharrungszustand.
 * Steuerwerte: aufbau (R, L, C, RL, RC, RLC, parallel), u (V, Effektivwert), f (Hz, log), r (Ohm, log, 0 erlaubt), l (H, log), c (F, log), bezug (auto, strom, spannung),
 *   wert (effektiv, scheitel), ziel (A, Vorgabe Strom, 0 = keine Vorgabe), Taste fire (Frequenzdurchlauf).
 * Messgeraete: xl, xc, z, i, phi, ur, ul, uc, art (Code: 0 ohmsch, 1 induktiv, 2 kapazitiv; Texte in meters[].texts), ir, il, ic (Strom durch R, L, C). Wirft nie.
 * Reihe: Bezugszeiger ist der Strom; Parallel: die Spannung (F2, Standard `auto`); phi = phi_u - phi_i; induktiv phi > 0.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-rlc.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = T0.modell || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  const KONV = T0.konvention || 'Bezug ist bei der Reihenschaltung der Strom, bei der Parallelschaltung die Spannung. φ = φ_u − φ_i: induktiv ist φ positiv, kapazitiv negativ.';
  const AM = x => (Math.abs(x) >= 1 ? fm(x, 2) : fm(x, 3)) + ' A';
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const SWEEP_S = 10;                                     // Dauer des Frequenzdurchlaufs (s, Zeitlupe verlaengert)

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const hasEl = (aufbau, e) => aufbau === 'parallel' || aufbau.indexOf(e) >= 0;
  const CONTROLS = B.fillControls([
    { key: 'aufbau', label: 'Aufbau', type: 'select', value: 'RLC', options: opt([['R', 'R'], ['L', 'L'], ['C', 'C'], ['RL', 'R und L in Reihe'], ['RC', 'R und C in Reihe'], ['RLC', 'R, L und C in Reihe'], ['parallel', 'R, L und C parallel']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Welche Bauteile im Kreis liegen. Bei der Reihenschaltung fließt überall derselbe Strom, bei der Parallelschaltung liegt an allen Zweigen dieselbe Spannung. Modell: ideale Bauteile.' },
    { key: 'u', label: 'Spannung U', type: 'slider', scale: 'lin', min: 1, max: 400, step: 1, unit: 'V', unitKind: 'volt', value: 230, gruppe: 'quelle', sicht: 'zeit',
      help: 'Effektivwert der Quellenspannung. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'f', label: 'Frequenz f', type: 'slider', scale: 'log', min: 1, max: 100000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 50, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Frequenz der Quelle. Mit größerem f steigt der Blindwiderstand X_L = 2π · f · L der Spule, und der Blindwiderstand X_C = 1 / (2π · f · C) des Kondensators fällt.' },
    { key: 'r', label: 'Wirkwiderstand R', type: 'slider', scale: 'log', logZero: true, min: 0, max: 100000, step: 0.1, unit: 'Ω', unitKind: 'res', value: 100, gruppe: 'bauteile', sicht: 'formel',
      visible: s => hasEl(s.aufbau, 'R'), help: 'Wirkwiderstand. Er verbraucht Wirkleistung; Strom und Spannung am Wirkwiderstand sind in Phase. Bei 0 Ω ist im Reihenkreis nur noch der Blindwiderstand wirksam.' },
    { key: 'l', label: 'Induktivität L', type: 'slider', scale: 'log', min: 0.000001, max: 10, step: 0.000001, unit: 'H', unitKind: 'ind', value: 0.25, gruppe: 'bauteile', sicht: 'formel',
      visible: s => hasEl(s.aufbau, 'L'), help: 'Induktivität der Spule. Größeres L ergibt einen größeren Blindwiderstand X_L; der Strom eilt der Spannung nach.' },
    { key: 'c', label: 'Kapazität C', type: 'slider', scale: 'log', min: 1e-10, max: 0.001, step: 1e-10, unit: 'F', unitKind: 'cap', value: 4.7e-6, gruppe: 'bauteile', sicht: 'formel',
      visible: s => hasEl(s.aufbau, 'C'), help: 'Kapazität des Kondensators. Größeres C ergibt einen kleineren Blindwiderstand X_C; der Strom eilt der Spannung vor.' },
    { key: 'bezug', label: 'Bezugszeiger', type: 'select', value: 'auto', options: opt([['auto', 'Standard (Reihe: Strom, Parallel: Spannung)'], ['strom', 'Strom'], ['spannung', 'Spannung']]), gruppe: 'ziel', sicht: 'zeiger',
      help: 'Welcher Zeiger waagerecht liegt. Das ändert nur die Drehung des Zeigerbildes, nicht den Winkel φ zwischen Spannung und Strom.' },
    { key: 'wert', label: 'Zeigerlänge', type: 'select', value: 'effektiv', options: opt([['effektiv', 'Effektivwert'], ['scheitel', 'Scheitelwert']]), gruppe: 'ziel', sicht: 'zeiger',
      help: 'Ob die Zeiger Effektivwerte oder Scheitelwerte darstellen (Faktor √2). Die Winkel bleiben gleich.' },
    { key: 'ziel', label: 'Vorgabe Strom I', type: 'slider', scale: 'lin', min: 0, max: 100, step: 0.001, unit: 'A', unitKind: 'amp', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für den Strom I aus der Quelle. Bei 0 A ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Frequenzdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'zeiger',
      help: 'Startet einen Durchlauf der Frequenz: X_L steigt, X_C fällt, die Zeiger wandern. Beim Reihen- und Parallelkreis mit L und C wird die Resonanzstelle gemeldet, an der X_L = X_C ist. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'xl', label: 'Blindwiderstand X_L', unit: 'Ω', digits: 2, min: 0, max: 10000, zeroIsNone: true, help: 'Blindwiderstand der Spule, X_L = 2π · f · L.' },
    { key: 'xc', label: 'Blindwiderstand X_C', unit: 'Ω', digits: 2, min: 0, max: 10000, zeroIsNone: true, help: 'Blindwiderstand des Kondensators, X_C = 1 / (2π · f · C).' },
    { key: 'z', label: 'Scheinwiderstand Z', unit: 'Ω', digits: 2, min: 0, max: 10000, help: 'Scheinwiderstand (Impedanz) des ganzen Kreises, aus Pythagoras gerechnet, nicht als Summe.' },
    { key: 'i', label: 'Strom I', unit: 'A', digits: 3, min: 0, max: 100, help: 'Effektivwert des Stroms aus der Quelle.' },
    { key: 'phi', label: 'Phasenwinkel φ', unit: '°', digits: 1, min: -90, max: 90, help: 'φ = φ_u − φ_i. Positiv heißt: Die Spannung eilt dem Strom vor (induktiv), negativ: Sie eilt nach (kapazitiv).' },
    { key: 'ur', label: 'Spannung U_R', unit: 'V', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Spannung am Wirkwiderstand. Bei der Reihenschaltung geometrisch mit U_L und U_C zur Quellenspannung zusammengesetzt.' },
    { key: 'ul', label: 'Spannung U_L', unit: 'V', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Spannung an der Spule. Sie kann bei Resonanz größer als die Quellenspannung sein.' },
    { key: 'uc', label: 'Spannung U_C', unit: 'V', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Spannung am Kondensator. Sie kann bei Resonanz größer als die Quellenspannung sein.' },
    { key: 'art', label: 'Art', unit: '', digits: 0, min: 0, max: 2, texts: ['ohmsch', 'induktiv', 'kapazitiv'], help: 'Art der Last aus dem Vorzeichen des Blindanteils: ohmsch (0), induktiv (1) oder kapazitiv (2).' },
    { key: 'ir', label: 'Strom durch R', unit: 'A', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch den Wirkwiderstand (Reihe: der Gesamtstrom, Parallel: der Zweigstrom).' },
    { key: 'il', label: 'Strom durch L', unit: 'A', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch die Spule (Reihe: der Gesamtstrom, Parallel: der Zweigstrom).' },
    { key: 'ic', label: 'Strom durch C', unit: 'A', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch den Kondensator (Reihe: der Gesamtstrom, Parallel: der Zweigstrom).' }
  ];
  const ser = cfg => (C0 ? C0.rlc.series(cfg) : null);
  const COIL = (function () { try { return C0 ? C0.rlc.coil({ u: 230, i: 2.5, p: 150 }) : null; } catch (e) { return null; } })();
  const PRESETS = [
    { id: 'spule', name: 'Spule', info: 'Übungsschaltung: ' + K(c => { const s = ser({ aufbau: 'L', u: 230, f: 50, l: 0.1 }); return 'Eine Spule mit 0,1 H bei 50 Hz hat X_L = ' + val(s.xl, 'Ω', 2) + '; der Strom beträgt ' + AM(s.i) + ' und eilt nach.'; }),
      controls: { aufbau: 'L', u: 230, f: 50, l: 0.1 } },
    { id: 'kondensator', name: 'Kondensator', info: 'Übungsschaltung: ' + K(c => { const s = ser({ aufbau: 'C', u: 230, f: 50, c: 4.7e-6 }); return 'Ein Kondensator mit 4,7 µF bei 50 Hz hat X_C = ' + val(s.xc, 'Ω', 1) + '; der Strom beträgt ' + AM(s.i) + ' und eilt vor.'; }),
      controls: { aufbau: 'C', u: 230, f: 50, c: 4.7e-6 } },
    { id: 'rl-reihe', name: 'R und L in Reihe', info: 'Übungsschaltung (Pool W2024-10): ' + K(c => { const s = ser({ aufbau: 'RL', u: 230, f: 50, r: 22, l: 0.1 }); return 'R = 22 Ω und L = 0,1 H ergeben Z = ' + val(s.z, 'Ω', 2) + ' und I = ' + AM(s.i) + '.'; }),
      controls: { aufbau: 'RL', u: 230, f: 50, r: 22, l: 0.1 } },
    { id: 'rlc-reihe', name: 'R, L und C in Reihe', info: 'Übungsschaltung (Pool W2020-N07): ' + K(c => { const s = ser({ aufbau: 'RLC', u: 230, f: 50, r: 100, l: 0.25, c: 4.7e-6 }); return 'X_L = ' + val(s.xl, 'Ω', 2) + ', X_C = ' + val(s.xc, 'Ω', 1) + ', Z = ' + val(s.z, 'Ω', 1) + ', I = ' + AM(s.i) + '; der Kreis ist kapazitiv.'; }),
      controls: { aufbau: 'RLC', u: 230, f: 50, r: 100, l: 0.25, c: 4.7e-6 } },
    { id: 'parallel', name: 'R, L und C parallel', info: 'Übungsschaltung: ' + K(c => { const s = C0.rlc.parallel({ aufbau: 'RLC', u: 230, f: 50, r: 100, l: 0.25, c: 4.7e-6 }); return 'An allen Zweigen liegen 230 V; der Strom aus der Quelle beträgt ' + AM(s.i) + ', cos φ = ' + fm(s.cosphi, 3) + '.'; }),
      controls: { aufbau: 'parallel', u: 230, f: 50, r: 100, l: 0.25, c: 4.7e-6 } },
    { id: 'reale-spule', name: 'Reale Spule', info: 'Übungsschaltung (Pool S2025-31): ' + (COIL && COIL.ok ? 'Aus 230 V, 2,5 A und 150 W folgen R = ' + val(COIL.r, 'Ω', 1) + ', X_L = ' + val(COIL.xl, 'Ω', 1) + ' und L = ' + val(COIL.l * 1000, 'mH', 1) + '.' : ''),
      controls: { aufbau: 'RL', u: 230, f: 50, r: COIL && COIL.ok ? COIL.r : 24, l: COIL && COIL.ok ? COIL.l : 0.2827 } }
  ];
  const SICHT = { zeit: 'Zeitbild: u und i über t, der Strom eilt vor oder nach', zeiger: 'Zeigerbild mit Spannungsdreieck: U_R, U_L und U_C geometrisch, U_X, U', formel: 'Z = √(R² + (X_L − X_C)²), tan φ = (X_L − X_C) / R' };
  const INFO = 'R, L und C im Wechselstromkreis mit Zeigerdiagramm. ' + KONV + ' ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0, fa: 1, fb: 1e5, f0: 0, from: 0 };
    const f0cache = {};
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };

    /** Resonanzstelle X_L = X_C: Halbierung ueber WSL_CORE.rlc.reactance (keine zweite Formel). 0, wenn L oder C fehlt. */
    function f0Of(l, c) {
      const key = l + '|' + c;
      if (f0cache[key] !== undefined) return f0cache[key];
      let lo = 1e-3, hi = 1e9, out = 0;
      const xs = f => { const r = CORE.rlc.reactance({ l, c, f }); return r && r.ok !== false && isNum(r.x) ? r.x : NaN; };
      const a = xs(lo), b = xs(hi);
      if (a < 0 && b > 0) {
        for (let k = 0; k < 90; k++) { const m = Math.sqrt(lo * hi); const x = xs(m); if (!isNum(x)) break; if (x < 0) lo = m; else hi = m; }
        out = Math.sqrt(lo * hi);
      }
      if (Object.keys(f0cache).length > 200) { Object.keys(f0cache).forEach(k => { delete f0cache[k]; }); }
      f0cache[key] = out;
      return out;
    }
    const fEffOf = ctl => (sw.active ? sw.fa * Math.pow(sw.fb / sw.fa, sw.p) : ctl.f);
    function rangeOf(ctl) {
      const par = ctl.aufbau === 'parallel', both = par || ctl.aufbau === 'RLC';
      const f0 = both ? f0Of(ctl.l, ctl.c) : 0;
      let fa = 1, fb = 1e5;
      if (f0 > 0) { fa = Math.max(1, f0 / 10); fb = Math.min(1e5, f0 * 10); if (!(fb > fa * 1.0001)) { fa = 1; fb = 1e5; } }
      return { fa, fb, f0 };
    }

    function calc(ctl, f) {
      const par = ctl.aufbau === 'parallel';
      const cfg = { u: ctl.u, f, r: ctl.r, l: ctl.l, c: ctl.c, aufbau: par ? 'RLC' : ctl.aufbau };
      const s = par ? CORE.rlc.parallel(cfg) : CORE.rlc.series(cfg);
      if (!s || s.ok === false || s.valid === false) return { ok: false, why: (s && (s.why || s.text)) || CORE.TEXTS.eingabe, cfg, par };
      const p = CORE.rlc.phasors(Object.assign({}, cfg, { art: par ? 'parallel' : 'reihe' }));
      return { ok: true, par, cfg, s, ph: p && p.ok !== false && p.valid !== false ? p : null, f };
    }
    function compute(ctl) {
      const f = fEffOf(ctl), r = calc(ctl, f);
      r.f = f; r.aufbau = ctl.aufbau;
      r.f0 = (ctl.aufbau === 'parallel' || ctl.aufbau === 'RLC') ? f0Of(ctl.l, ctl.c) : 0;
      return r;
    }
    const artCode = s => (s.art === 'induktiv' ? 1 : s.art === 'kapazitiv' ? 2 : 0);
    function meters(r, ctl) {
      const z = { xl: 0, xc: 0, z: 0, i: 0, phi: 0, ur: 0, ul: 0, uc: 0, art: 0, ir: 0, il: 0, ic: 0 };
      if (!r.ok) return z;
      const s = r.s, a = ctl.aufbau;
      if (r.par) return { xl: s.xl, xc: s.xc, z: s.z, i: s.i, phi: s.phi, ur: ctl.u, ul: ctl.u, uc: ctl.u, art: artCode(s), ir: s.ir, il: s.il, ic: s.ic };
      return { xl: s.xl, xc: s.xc, z: s.z, i: s.i, phi: s.phi, ur: hasEl(a, 'R') ? s.ur : 0, ul: hasEl(a, 'L') ? s.ul : 0, uc: hasEl(a, 'C') ? s.uc : 0, art: artCode(s),
        ir: hasEl(a, 'R') ? s.i : 0, il: hasEl(a, 'L') ? s.i : 0, ic: hasEl(a, 'C') ? s.i : 0 };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.s.i, pct = Math.abs(ist - soll) / soll * 100;
      const amp = B.devAmpel(pct, CORE);
      let text = B.devText('Strom', ist, soll, 'A', pct, CORE);
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Der Strom ist zu klein.' : ' Der Strom ist zu groß.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Strom ' + val(soll, 'A'), soll, ist, unit: 'A' } };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      const s = r.s;
      if (r.par && ctl.aufbau === 'parallel') {
        const bm = Math.max(s.bl, s.bc);
        if (bm > 0 && Math.abs(s.bl - s.bc) <= 0.01 * bm) out.push({ id: 'resonanz', kind: 'info', text: 'Nahe der Resonanz: Die Blindströme I_L und I_C unterscheiden sich um weniger als 1 % und heben sich fast auf.' });
      } else if (ctl.aufbau === 'RLC') {
        const xm = Math.max(s.xl, s.xc);
        if (xm > 0 && Math.abs(s.xl - s.xc) <= 0.01 * xm) out.push({ id: 'resonanz', kind: 'info', text: 'Nahe der Resonanz: X_L und X_C unterscheiden sich um weniger als 1 %, die Blindwiderstände heben sich fast auf.' });
        if (Math.max(s.ul, s.uc) > ctl.u * (1 + 1e-9)) out.push({ id: 'ueberhoehung', kind: 'warn', text: 'U_L = ' + val(s.ul, 'V') + ' und U_C = ' + val(s.uc, 'V') + ' sind größer als die Quellenspannung ' + val(ctl.u, 'V') + '. ' + CORE.TEXTS.ueberhoehung });
      }
      if (sw.active) out.push({ id: 'durchlauf', kind: 'info', text: 'Frequenzdurchlauf läuft: aktuell f = ' + val(r.f, 'Hz') + '.' });
      return out;
    }
    function waveform(r, ctl, o) {
      if (!r.ok) return null;
      o = o || {};
      const s = r.s, f = r.f, T = 1 / f, n = clamp(Math.floor(num(o.n, 360)), 24, 4000), per = clamp(Math.floor(num(o.periods, 2)), 1, 20);
      const k = T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 };
      const uh = ctl.u * Math.SQRT2, ih = s.i * Math.SQRT2;
      const cu = { ampl: uh, f, phi: 0 }, ci = { ampl: ih, f, phi: -s.phi };    // i = î · sin(ωt − φ) bei φ = φ_u − φ_i
      const t = [], yu = [], yi = [];
      for (let q = 0; q < n; q++) { const ts = -T / 2 + q * (per * T) / (n - 1); t.push(ts * k.k); yu.push(CORE.sine.at(cu, ts)); yi.push(CORE.sine.at(ci, ts)); }
      const span = [{ t0: 0, t1: T * k.k, name: 'T' }];
      const sh = CORE.sine.shift({ f, phi: s.phi });
      if (sh && sh.ok !== false && sh.dir !== 'gleich') { const t1 = s.phi / 360 * T; span.push({ t0: Math.min(0, t1) * k.k, t1: Math.max(0, t1) * k.k, name: 'Δt' }); }
      return { tUnit: k.u, t, series: [{ name: 'u', unit: 'V', kind: 'u', y: yu }, { name: 'i', unit: 'A', kind: 'i', y: yi }], marks: { h: [{ y: uh, name: 'û', series: 0 }, { y: ih, name: 'î', series: 1 }], span }, periods: per, T };
    }
    function phasors(r, ctl) {
      if (!r.ok) return { ok: false, why: r.why };
      if (!r.ph) return { ok: false, why: CORE.TEXTS.eingabe };
      const natural = r.par ? 'spannung' : 'strom', bez = ctl.bezug === 'auto' ? natural : ctl.bezug;
      let list = r.ph.list.map(z => Object.assign({}, z)), effektiv = r.ph.effektiv !== false;
      if (bez !== natural) {
        const ref = list.find(z => z.name === (bez === 'strom' ? 'I' : 'U'));
        if (ref) { const rot = -ref.angle; list = list.map(z => Object.assign({}, z, { angle: z.angle + rot })); }
      }
      if (ctl.wert === 'scheitel') { list = list.map(z => Object.assign({}, z, { len: z.len * Math.SQRT2 })); effektiv = false; }
      return { ok: true, art: r.ph.art, bezug: bez, f: r.ph.f, omega: r.ph.omega, phi: r.ph.phi, effektiv, wert: ctl.wert, list };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const rg = rangeOf(ctl), xs = [], xl = [], xc = [], zz = [], ii = [], ph = [];
      const N = 80;
      for (let k = 0; k <= N; k++) {
        const f = rg.fa * Math.pow(rg.fb / rg.fa, k / N), q = calc(ctl, f);
        if (!q.ok) continue;
        xs.push(f); xl.push([f, q.s.xl]); xc.push([f, q.s.xc]); zz.push([f, q.s.z]); ii.push([f, q.s.i]); ph.push([f, q.s.phi]);
      }
      const mk = (y, lab) => ({ x: r.f, y, label: lab });
      const marks = rg.f0 > 0 ? [{ x: rg.f0, label: 'f₀ (X_L = X_C)' }] : [];
      return [
        { id: 'blind', title: 'Blindwiderstände und Scheinwiderstand über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Widerstand', yUnit: 'Ω', series: [{ name: 'X_L', points: xl }, { name: 'X_C', points: xc }, { name: 'Z', points: zz }], marker: mk(r.s.z, 'jetzt'), marks },
        { id: 'strom', title: 'Strom über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Strom I', yUnit: 'A', series: [{ name: 'I', points: ii }], marker: mk(r.s.i, 'jetzt'), marks },
        { id: 'phi', title: 'Phasenwinkel über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Phasenwinkel φ', yUnit: '°', series: [{ name: 'φ', points: ph }], marker: mk(r.s.phi, 'jetzt'), marks }
      ];
    }
    function state(r, ctl) {
      const base = { aufbau: ctl.aufbau, sweep: sw.active, sweepP: sw.p, fEff: r.f, f0: r.f0 || 0, parallel: ctl.aufbau === 'parallel' };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, art: '', text: r.why });
      const s = r.s;
      return Object.assign(base, { valid: true, art: s.art, artCode: artCode(s), text: s.text, z: s.z, i: s.i, phi: s.phi, cosphi: s.cosphi, p: s.p, q: s.q, s_va: s.s,
        ux: r.par ? 0 : s.ux, uGeom: r.par ? ctl.u : s.uGeom, bezug: ctl.bezug === 'auto' ? (r.par ? 'spannung' : 'strom') : ctl.bezug, ir: r.par ? s.ir : 0, il: r.par ? s.il : 0, ic: r.par ? s.ic : 0 });
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, g = sc.gfx;
      if (!r || !r.ok) { g.text(ctx, (r && r.why) || '', R0.x + 8, R0.y + 20, { size: 13, color: pal.fg, max: R0.w - 16 }); return; }
      const ctl = view.ctl, s = r.s, chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - gap;
      const wide = R0.w >= 680;
      let sR, wR, pR, tR;
      if (wide) {
        const lw = Math.round(R0.w * 0.46) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.42), h2 = Math.round(bodyH * 0.62);
        sR = { x: R0.x, y: R0.y, w: lw, h: h1 }; wR = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: bodyH - h1 - gap };
        pR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h2 }; tR = { x: R0.x + lw + gap, y: R0.y + h2 + gap, w: rw, h: bodyH - h2 - gap };
      } else {
        const hs = [0.16, 0.28, 0.36, 0.2].map(q => Math.round(bodyH * q) - gap);
        let y = R0.y;
        sR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; wR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap;
        pR = { x: R0.x, y, w: R0.w, h: hs[2] }; y += hs[2] + gap; tR = { x: R0.x, y, w: R0.w, h: hs[3] };
      }
      const a = ctl.aufbau, labels = { u: 'u = ' + val(ctl.u, 'V') };
      if (hasEl(a, 'R')) labels.r = 'R = ' + eng(ctl.r, 'Ω'); if (hasEl(a, 'L')) labels.l = 'L = ' + eng(ctl.l, 'H'); if (hasEl(a, 'C')) labels.c = 'C = ' + eng(ctl.c, 'F');
      labels.i = 'i';
      sc.view('schematic', sR, { kind: r.par ? 'parRLC' : a, labels }, {});
      const wf = waveform(r, ctl, { n: sc.quality === 'niedrig' ? 160 : 360 });
      if (wf) sc.view('scope', wR, wf, {});
      const ph = phasors(r, ctl);
      if (ph.ok) sc.view('phasor', pR, { list: ph.list, unit: ph.list[0] && ph.list[0].unit, bezug: ph.bezug, arc: Math.abs(s.phi) > 0.5 ? { a: 'U', b: 'I', label: 'φ = ' + fmt(s.phi, 1) + '°' } : null, rotate: true, project: false }, {});
      else { g.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6); g.text(ctx, ph.why || '', pR.x + 10, pR.y + 24, { size: 12, color: pal.mute, max: pR.w - 20 }); }
      if (r.par) sc.view('triangle', tR, { kind: 'leistung', a: s.p, b: s.q }, {});
      else sc.view('triangle', tR, { kind: 'spannung', a: s.ur, b: s.ul - s.uc }, {});
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = [['Z', val(s.z, 'Ω')], ['I', val(s.i, 'A')], ['φ', fmt(s.phi, 1) + '°'], [sw.active ? 'f (Durchlauf)' : 'f', val(r.f, 'Hz')]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    return {
      compute, meters, assess, diag, curves, waveform, phasors, state, draw,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        const prev = fEffOf(ctl);
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say('Der Frequenzdurchlauf ist beendet.', 'info'); P0.bump(); return; }
        const cur = fEffOf(ctl);
        if (sw.f0 > 0 && prev < sw.f0 && cur >= sw.f0) P0.say('Resonanzstelle erreicht: Bei f₀ = ' + val(sw.f0, 'Hz') + ' ist X_L = X_C.', 'info');
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; P0.say('Der Frequenzdurchlauf wurde abgebrochen.', 'info'); return true; }
        const rg = rangeOf(ctl);
        sw.fa = rg.fa; sw.fb = rg.fb; sw.f0 = rg.f0; sw.p = 0; sw.active = true;
        P0.say('Frequenzdurchlauf von ' + val(rg.fa, 'Hz') + ' bis ' + val(rg.fb, 'Hz') + ': X_L steigt, X_C fällt.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; }
    };
  }

  R.register({ id: 'rlc', name: 'R, L, C im Wechselstromkreis', icon: '🌀', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'rlc', name: 'R, L, C im Wechselstromkreis', icon: '🌀', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
