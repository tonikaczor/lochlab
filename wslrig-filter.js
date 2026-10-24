/* wslrig-filter.js - WSL-Lab (WP2c): Pruefstand 6 `filter` - RC-/RL-Hoch- und Tiefpass (SPEC 5.6).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.filter.response / bode / square / sieve, WSL_CORE.cx, WSL_CORE.sine.at, WSL_CORE.grid); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung). Simulation. Modell: unbelastetes Glied erster Ordnung, ideale Bauteile (RL mit idealer Spule, F10), Beharrungszustand.
 * Steuerwerte: art (RC, RL), typ (tief, hoch), r (Ohm, log), c (F, log, nur RC), l (H, log, nur RL), ue (V, Effektivwert Eingang), f (Hz, log),
 *   eingang (sinus, rechteck), ziel (Vorgabe Grenzfrequenz f_g in Hz; 0 = keine Vorgabe, Ampel dann grau), Taste fire.
 * Messgeraete: fg, tau (in us), h, a (dB), phi (Grad, Ausgang gegen Eingang), ua (Effektivwert Ausgang). Wirft nie.
 * fire(): eingang sinus = Frequenzdurchlauf (f_g/100 bis 100 f_g, Meldung beim Erreichen von f_g); eingang rechteck = der Rechteckvorgang wird gezeichnet.
 * Zusatzmethoden (nur dieses Rig): zeitbild() = Zeitverlauf Ein- und Ausgang, bode() = Bode-Daten der Vertiefung (nur Lesen, aus dem Kern).
 * Bode-Vertiefung: Die Kurven 'bode-a' und 'bode-phi' tragen `vertiefung: true`; Aufklappen und Zeichnen macht die Oberflaeche (wsl.deep). Nur unbelastete Glieder 1. Ordnung (F9).
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-filter.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = T0.modell || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const SWEEP_S = 10;

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const isRL = ctl => ctl && ctl.art === 'RL';
  const CONTROLS = B.fillControls([
    { key: 'art', label: 'Bauteile', type: 'select', value: 'RC', options: opt([['RC', 'RC-Glied (Widerstand und Kondensator)'], ['RL', 'RL-Glied (Widerstand und Spule)']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'RC-Glied: Grenzfrequenz f_g = 1 / (2π · R · C). RL-Glied: f_g = R / (2π · L). Das RL-Glied rechnet mit einer idealen Spule ohne Wicklungswiderstand (Übungsmodell).' },
    { key: 'typ', label: 'Filterart', type: 'select', value: 'tief', options: opt([['tief', 'Tiefpass'], ['hoch', 'Hochpass']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Tiefpass: Tiefe Frequenzen kommen durch, hohe werden gedämpft. Hochpass: Hohe Frequenzen kommen durch, tiefe werden gedämpft. Bei der Grenzfrequenz ist das Übertragungsverhältnis auf 70,7 % gefallen.' },
    { key: 'ue', label: 'Eingangsspannung U_e', type: 'slider', scale: 'lin', min: 0.1, max: 400, step: 0.1, unit: 'V', unitKind: 'volt', value: 5, gruppe: 'quelle', sicht: 'zeit',
      help: 'Effektivwert der Eingangsspannung. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'f', label: 'Frequenz f', type: 'slider', scale: 'log', min: 1, max: 10000000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 1000, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Frequenz des Eingangssignals (beim Rechteck die Wiederholfrequenz, T = 1 / f). Bei der Grenzfrequenz f_g beträgt die Phasenverschiebung 45°.' },
    { key: 'eingang', label: 'Eingangssignal', type: 'select', value: 'sinus', options: opt([['sinus', 'Sinus'], ['rechteck', 'Rechteck']]), gruppe: 'quelle', sicht: 'zeit',
      help: 'Sinus zeigt Amplituden- und Phasenverhalten bei einer Frequenz. Rechteck zeigt den Zeitverlauf: Der Tiefpass verschleift die Flanken, der Hochpass macht an den Flanken Nadelimpulse.' },
    { key: 'r', label: 'Wirkwiderstand R', type: 'slider', scale: 'log', min: 1, max: 1000000, step: 0.1, unit: 'Ω', unitKind: 'res', value: 1000, gruppe: 'bauteile', sicht: 'formel',
      help: 'Wirkwiderstand des Glieds. Größeres R ergibt beim RC-Glied eine kleinere Grenzfrequenz, beim RL-Glied eine größere.' },
    { key: 'c', label: 'Kapazität C', type: 'slider', scale: 'log', min: 1e-12, max: 0.001, step: 1e-12, unit: 'F', unitKind: 'cap', value: 1e-7, gruppe: 'bauteile', sicht: 'formel',
      visible: s => !isRL(s), help: 'Kapazität des Kondensators. Größeres C ergibt eine kleinere Grenzfrequenz f_g und eine größere Zeitkonstante τ = R · C.' },
    { key: 'l', label: 'Induktivität L', type: 'slider', scale: 'log', min: 0.000001, max: 10, step: 0.000001, unit: 'H', unitKind: 'ind', value: 0.1, gruppe: 'bauteile', sicht: 'formel',
      visible: s => isRL(s), help: 'Induktivität der Spule. Größeres L ergibt eine kleinere Grenzfrequenz f_g und eine größere Zeitkonstante τ = L / R.' },
    { key: 'ziel', label: 'Vorgabe Grenzfrequenz f_g', type: 'slider', scale: 'log', logZero: true, min: 0, max: 10000000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Grenzfrequenz f_g. Bei 0 Hz ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Durchlauf / Rechteck', type: 'button', gruppe: 'ziel', sicht: 'zeit',
      help: 'Beim Sinus startet ein Frequenzdurchlauf: Das Übertragungsverhältnis und die Phase wandern, bei f_g wird die Grenzfrequenz gemeldet. Beim Rechteck wird der Zeitverlauf am Ausgang gezeichnet. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz', digits: 1, min: 0, max: 10000000, help: 'Grenzfrequenz: RC f_g = 1 / (2π · R · C), RL f_g = R / (2π · L), aus dem Kern gerechnet. Bei f_g ist |H| = 0,7071, a = −3 dB und die Phase ±45°.' },
    { key: 'tau', label: 'Zeitkonstante τ', unit: 'µs', digits: 2, min: 0, max: 100000, help: 'Zeitkonstante τ = R · C (RC) bzw. L / R (RL), in Mikrosekunden. Nach fünf τ gilt der Ausgleichsvorgang als abgeschlossen (Lehrfaustwert).' },
    { key: 'h', label: 'Übertragung |H|', unit: '', digits: 4, min: 0, max: 1, help: 'Übertragungsverhältnis |H| = U_a / U_e bei der eingestellten Frequenz; bei f_g genau 0,7071.' },
    { key: 'a', label: 'Dämpfungsmaß a', unit: 'dB', digits: 2, min: -60, max: 0, help: 'Dämpfungsmaß a = 20 · lg |H| in Dezibel; bei f_g −3 dB. Ein negativer Wert bedeutet Dämpfung.' },
    { key: 'phi', label: 'Phasenwinkel φ', unit: '°', digits: 1, min: -90, max: 90, help: 'Phasenwinkel des Ausgangs gegen den Eingang. Tiefpass: 0° bis −90° (Ausgang eilt nach), Hochpass: +90° bis 0° (Ausgang eilt vor); bei f_g ∓45°.' },
    { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V', digits: 3, min: 0, max: 400, help: 'Effektivwert der Ausgangsspannung bei Sinus: U_a = |H| · U_e (unbelastet).' }
  ];
  const SIEVE = K(c => { const s = c.filter.sieve({ r: 470, c: 2.2e-6, f: 100, u1: 4 }); return 'Siebglied (Pool S2024-28): R = 470 Ω und C = 2,2 µF bei 4 V und 100 Hz ergeben X_C = ' + val(s.xc, 'Ω', 1) + ', Z = ' + val(s.z, 'Ω', 1) + ' und U₂ = ' + val(s.u2, 'V', 3) + '.'; });
  const FRC = (typ, r, c, f) => (C0 ? C0.filter.response({ art: 'RC', typ, r, c, f }, f) : null);
  const PRESETS = [
    { id: 'tiefpass-rc', name: 'RC-Tiefpass', info: 'Übungsschaltung: ' + K(c => { const s = FRC('tief', 1000, 1e-7, 1591.5); return 'R = 1 kΩ und C = 100 nF ergeben f_g = ' + val(s.fg, 'Hz', 1) + ' und τ = ' + val(s.tau * 1e6, 'µs', 1) + '; bei f_g ist |H| = ' + fm(s.h, 4) + ' (' + fm(s.a, 2) + ' dB) und die Phase ' + fm(s.phi, 1) + '°.'; }),
      controls: { art: 'RC', typ: 'tief', r: 1000, c: 1e-7, f: 1591.5, ue: 5, eingang: 'sinus' } },
    { id: 'hochpass-rc', name: 'RC-Hochpass', info: 'Übungsschaltung (Pool H2026-22): ' + K(c => { const s = FRC('hoch', 15000, 1e-7, 106.1); return 'R = 15 kΩ und C = 100 nF ergeben f_g = ' + val(s.fg, 'Hz', 1) + '; bei dieser Frequenz ist |H| = ' + fm(s.h, 4) + ' und die Phase ' + fm(s.phi, 1) + '°.'; }),
      controls: { art: 'RC', typ: 'hoch', r: 15000, c: 1e-7, f: 106.1, ue: 5, eingang: 'sinus' } },
    { id: 'siebglied', name: 'Siebglied', info: 'Übungsschaltung: ' + SIEVE + ' Das ist hier nur ein Tiefpass; Gleichrichter und Brummspannung gehören ins Netzteile-Lab.',
      controls: { art: 'RC', typ: 'tief', r: 470, c: 2.2e-6, f: 100, ue: 4, eingang: 'sinus' } },
    { id: 'rl-tief', name: 'RL-Tiefpass', info: 'Übungsschaltung: ' + K(c => { const s = c.filter.response({ art: 'RL', typ: 'tief', r: 1000, l: 0.1 }, 1000); return 'R = 1 kΩ und L = 0,1 H ergeben f_g = ' + val(s.fg, 'Hz', 1) + ' und τ = ' + val(s.tau * 1e6, 'µs', 1) + '; die Spule ist ideal gerechnet, eine reale Spule hat zusätzlich einen Wicklungswiderstand R_L.'; }),
      controls: { art: 'RL', typ: 'tief', r: 1000, l: 0.1, f: 1000, ue: 5, eingang: 'sinus' } },
    { id: 'rechteck-hp', name: 'Rechteck am Hochpass', info: 'Übungsschaltung (Pool S2023-N31): ' + K(c => { const q = c.filter.square({ art: 'RC', typ: 'hoch', r: 1000, c: 1e-7, ue: 5 }, 1e-3, 8); return 'R = 1 kΩ, C = 100 nF und Rechteck 1 kHz: ' + (q && q.text ? q.text : ''); }),
      controls: { art: 'RC', typ: 'hoch', r: 1000, c: 1e-7, f: 1000, ue: 5, eingang: 'rechteck' } }
  ];
  const SICHT = { zeit: 'Zeitbild von Eingang und Ausgang (Rechteck: verschliffene Flanken beim Tiefpass, Nadelimpulse beim Hochpass)', zeiger: 'Zeigerbild: U_e, U_a und die Teilspannung am anderen Bauteil, geometrisch', formel: 'f_g = 1 / (2π · R · C) bzw. R / (2π · L), |H| = 1 / √(1 + (f / f_g)²) beim Tiefpass, a = 20 · lg |H|' };
  const INFO = 'RC- und RL-Hoch- und Tiefpass: Grenzfrequenz, Zeitkonstante, Frequenzgang und Rechteckantwort; das Bode-Diagramm gibt es als aufklappbare Vertiefung. ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0, mode: 'durchlauf', fa: 1, fb: 1e7, fg: 0 };
    const cmem = { key: '', val: null };
    const lim = (id, d) => B.limV(CORE, id, d);
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const cfgOf = (ctl, f) => { const c = { art: isRL(ctl) ? 'RL' : 'RC', typ: ctl.typ === 'hoch' ? 'hoch' : 'tief', r: ctl.r, ue: ctl.ue }; if (isRL(ctl)) c.l = ctl.l; else c.c = ctl.c; if (f !== undefined) c.f = f; return c; };
    const sweeping = () => sw.active && sw.mode === 'durchlauf';
    const fEffOf = ctl => (sweeping() ? sw.fa * Math.pow(sw.fb / sw.fa, sw.p) : ctl.f);
    const names = ctl => {
      const rl = isRL(ctl), tief = ctl.typ !== 'hoch';
      return rl ? (tief ? { aus: 'U_R', anders: 'U_L' } : { aus: 'U_L', anders: 'U_R' }) : (tief ? { aus: 'U_C', anders: 'U_R' } : { aus: 'U_R', anders: 'U_C' });
    };
    /** Bode-Daten aus dem Kern (Raster f_g/100 bis 100 f_g), nur bei geaenderten Bauteilwerten neu gerechnet. */
    function bodeData(ctl, fg) {
      const key = [ctl.art, ctl.typ, ctl.r, ctl.c, ctl.l].join('|');
      if (cmem.key === key) return cmem.val;
      let b = null;
      try { b = CORE.filter.bode(cfgOf(ctl), CORE.grid(fg, 81, 2, 2)); } catch (e) { b = null; }
      if (!b || b.ok === false || !Array.isArray(b.f) || !Array.isArray(b.a)) b = null;
      cmem.key = key; cmem.val = b;
      return b;
    }

    function compute(ctl) {
      const f = fEffOf(ctl), s = CORE.filter.response(cfgOf(ctl, f), f);
      if (!s || s.ok === false || s.valid === false) return { ok: false, f, why: (s && (s.why || s.text)) || CORE.TEXTS.eingabe };
      const out = { ok: true, f, s, fg: s.fg };
      if (ctl.eingang === 'rechteck') {
        const T = 1 / f, n = 241, tl = [];
        for (let k = 0; k < n; k++) tl.push(2 * T * k / (n - 1));
        const q = CORE.filter.square(cfgOf(ctl, f), T, tl);
        out.sq = q && q.ok !== false && Array.isArray(q.t) ? q : null;
      }
      return out;
    }
    function meters(r) {
      if (!r.ok) return { fg: 0, tau: 0, h: 0, a: 0, phi: 0, ua: 0 };
      const s = r.s;
      return { fg: s.fg, tau: s.tau * 1e6, h: s.h, a: s.a, phi: s.phi, ua: s.ua };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.s.fg, pct = Math.abs(ist - soll) / soll * 100, amp = B.devAmpel(pct, CORE);
      let text = B.devText('Grenzfrequenz', ist, soll, 'Hz', pct, CORE);
      text += amp === 'gruen' ? ' Die Grenzfrequenz stimmt mit der Vorgabe überein.' : (ist < soll ? ' Die Grenzfrequenz ist zu klein.' : ' Die Grenzfrequenz ist zu groß.');
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Grenzfrequenz ' + val(soll, 'Hz'), soll, ist, unit: 'Hz' } };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      const s = r.s;
      if (s.imFg === true) out.push({ id: 'bei-fg', kind: 'info', text: 'Bei der Grenzfrequenz f_g = ' + val(s.fg, 'Hz') + ': |H| = ' + fm(s.h, 4) + ', a = ' + fm(s.a, 2) + ' dB, φ = ' + fm(s.phi, 1) + '°.' });
      if (isRL(ctl)) out.push({ id: 'rl-ideal', kind: 'info', text: CORE.TEXTS.rlIdeal });
      if (r.sq && r.sq.randfall && r.sq.randfall !== 'normal') out.push({ id: 'randfall', kind: 'info', text: r.sq.text });
      if (sw.active) out.push({ id: 'durchlauf', kind: 'info', text: sweeping() ? 'Frequenzdurchlauf läuft: aktuell f = ' + val(r.f, 'Hz') + '.' : 'Der Rechteckvorgang wird gezeichnet.' });
      return out;
    }
    /** Zeitbild aus dem Kern: Sinus ueber sine.at mit |H| und Phase, Rechteck ueber filter.square. */
    function zeitbild(r, ctl) {
      if (!r.ok) return null;
      const s = r.s, f = r.f, T = 1 / f, k = T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : T >= 1e-6 ? { u: 'µs', k: 1e6 } : { u: 'ns', k: 1e9 };
      if (ctl.eingang === 'rechteck') {
        if (!r.sq) return null;
        const q = r.sq;
        return { mode: 'rechteck', tUnit: k.u, t: q.t.map(t => t * k.k), series: [{ name: 'u_e', unit: 'V', kind: 'u', y: q.uin.slice() }, { name: 'u_a', unit: 'V', kind: 'i', y: q.y.slice() }], marks: { span: [{ t0: 0, t1: T * k.k, name: 'T' }] }, T, tau: q.tau, randfall: q.randfall, nadel: q.nadel === true };
      }
      const n = 360, per = 2, cu = { ampl: ctl.ue * Math.SQRT2, f, phi: 0 }, ca = { ampl: s.ua * Math.SQRT2, f, phi: s.phi };
      const t = [], yu = [], ya = [];
      for (let q = 0; q < n; q++) { const ts = q * per * T / (n - 1); t.push(ts * k.k); yu.push(CORE.sine.at(cu, ts)); ya.push(CORE.sine.at(ca, ts)); }
      return { mode: 'sinus', tUnit: k.u, t, series: [{ name: 'u_e', unit: 'V', kind: 'u', y: yu }, { name: 'u_a', unit: 'V', kind: 'i', y: ya }], marks: { h: [{ y: cu.ampl, name: 'û_e', series: 0 }, { y: ca.ampl, name: 'û_a', series: 1 }], span: [{ t0: 0, t1: T * k.k, name: 'T' }] }, T };
    }
    function phasors(r, ctl) {
      if (!r.ok) return { ok: false, why: r.why };
      const s = r.s, nm = names(ctl), hc = s.hc, cx = CORE.cx;
      if (!hc || !cx) return { ok: false, why: CORE.TEXTS.eingabe };
      const rest = cx.sub({ re: 1, im: 0 }, hc), deg = 180 / Math.PI;
      const list = [{ name: 'U_e', len: ctl.ue, angle: 0, unit: 'V' }, { name: 'U_a', len: ctl.ue * s.h, angle: s.phi, unit: 'V' }, { name: nm.anders, len: ctl.ue * cx.abs(rest), angle: cx.arg(rest) * deg, unit: 'V' }];
      return { ok: true, art: 'filter', bezug: 'spannung', f: r.f, phi: s.phi, effektiv: true, unit: 'V', ausgang: nm.aus, anders: nm.anders, list };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const b = bodeData(ctl, r.fg);
      if (!b) return [];
      const s = r.s, pts = arr => b.f.map((f, k) => [f, arr[k]]), mk = y => ({ x: r.f, y, label: 'jetzt' }), marks = [{ x: b.fg, label: 'f_g' }];
      const hg = lim('fg_betrag', 0.7071);
      return [
        { id: 'betrag', title: 'Übertragungsverhältnis über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Übertragungsverhältnis |H|', yUnit: '', series: [{ name: '|H|', points: pts(b.h) }], marker: mk(s.h), marks, limit: { y: hg, label: '70,7 % bei f_g' } },
        { id: 'bode-a', title: 'Bode-Diagramm: Dämpfungsmaß über der Frequenz (Vertiefung)', vertiefung: true, xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Dämpfungsmaß a', yUnit: 'dB',
          series: [{ name: 'a (Kurve)', points: pts(b.a) }, { name: 'Asymptoten', points: pts(b.asymp) }], marker: mk(s.a), marks: [{ x: b.fg, label: 'Knick f_g' }], limit: { y: b.knick.aKurve, label: '−3 dB bei f_g' } },
        { id: 'bode-phi', title: 'Bode-Diagramm: Phase über der Frequenz (Vertiefung)', vertiefung: true, xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Phasenwinkel φ', yUnit: '°', series: [{ name: 'φ', points: pts(b.phi) }], marker: mk(s.phi), marks: [{ x: b.fg, label: 'f_g' }] }
      ];
    }
    function state(r, ctl) {
      const base = { art: ctl.art, typ: ctl.typ, eingang: ctl.eingang, sweep: sw.active, modus: sw.active ? sw.mode : (ctl.eingang === 'rechteck' ? 'rechteck' : 'durchlauf'), sweepP: sw.p, rechteckP: sw.active && sw.mode === 'rechteck' ? sw.p : 1, fEff: r.f, fg: r.fg || 0, ausgang: names(ctl).aus, anders: names(ctl).anders };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, text: r.why });
      const s = r.s, dev = Math.abs(r.f - s.fg) / s.fg * 100;
      const o = Object.assign(base, { valid: true, text: s.text, tau: s.tau, x: s.x, h: s.h, a: s.a, phi: s.phi, ua: s.ua, xc: s.xc || 0, xl: s.xl || 0, z: s.z || 0, imFg: s.imFg === true, abwFg: dev, bodeHinweis: CORE.TEXTS.filterNurErsteOrdnung });
      if (r.sq) Object.assign(o, { T: r.sq.T, verhaeltnis: r.sq.verhaeltnis, randfall: r.sq.randfall, nadel: r.sq.nadel === true, hub: r.sq.hub, sqText: r.sq.text });
      const b = bodeData(ctl, r.fg);
      if (b) Object.assign(o, { steigung: b.steigung, steigungText: b.steigungText, knickDiff: b.knick.diff, knickPhi: b.knick.phi, dekadeF: b.dekade.f, dekadeA: b.dekade.a, dekadeAbw: b.dekade.abweichung });
      return o;
    }

    /* ------------------------------------------------------------------ Zeichnen */
    function plot(ctx, g, pal, Rc, o) {
      if (!Rc || Rc.w < 120 || Rc.h < 80) return false;
      g.panel(ctx, Rc.x, Rc.y, Rc.w, Rc.h, pal.panel, pal.line, 6);
      const all = [].concat.apply([], o.series.map(s => s.pts));
      if (all.length < 2) return false;
      const xl = o.xlog === true, fx = v => (xl ? Math.log10(Math.max(v, 1e-300)) : v);
      const xs = all.map(p => fx(p[0])), ys = all.map(p => p[1]);
      const a = Math.min.apply(null, xs), b = Math.max.apply(null, xs);
      let c = o.ymin !== undefined ? o.ymin : Math.min.apply(null, ys), e = o.ymax !== undefined ? o.ymax : Math.max.apply(null, ys);
      if (!(b > a)) return false;
      if (!(e > c)) e = c + 1;
      const ml = 50, x0 = Rc.x + ml, x1 = Rc.x + Rc.w - 10, y0 = Rc.y + 22, y1 = Rc.y + Rc.h - 30;
      const X = v => x0 + (x1 - x0) * (fx(v) - a) / (b - a), Y = v => y1 - (y1 - y0) * (v - c) / (e - c);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      g.text(ctx, o.yl + (o.yu ? ' in ' + o.yu : ''), Rc.x + 8, Rc.y + 4, { size: 11, color: pal.mute, base: 'top', max: Rc.w - 16 });
      g.text(ctx, fm(e, e >= 100 ? 0 : e >= 10 ? 1 : 2), x0 - 4, y0 + 4, { size: 11, color: pal.mute, align: 'right', max: ml - 6 });
      g.text(ctx, fm(c, 1), x0 - 4, y1, { size: 11, color: pal.mute, align: 'right', max: ml - 6 });
      g.text(ctx, o.xl + (o.xu ? ' in ' + o.xu : ''), x1, Rc.y + Rc.h - 6, { size: 11, color: pal.mute, align: 'right', max: Rc.w * 0.5 });
      const xa = xl ? Math.pow(10, a) : a, xb = xl ? Math.pow(10, b) : b;
      g.text(ctx, xl ? eng(xa, '') : fm(xa, 2), x0, y1 + 14, { size: 11, color: pal.mute, max: Rc.w * 0.3 });
      g.text(ctx, xl ? eng(xb, '') : fm(xb, 2), x1, y1 + 14, { size: 11, color: pal.mute, align: 'right', max: Rc.w * 0.3 });
      (o.hlines || []).forEach(h => { if (h.y >= c && h.y <= e) { g.line(ctx, [[x0, Y(h.y)], [x1, Y(h.y)]], pal.mute, 1, [5, 4]); g.text(ctx, h.label, x1 - 2, Y(h.y) - 3, { size: 11, color: pal.mute, align: 'right', max: (x1 - x0) * 0.7 }); } });
      o.series.forEach(s => { g.line(ctx, s.pts.map(p => [X(p[0]), Y(p[1])]), s.col, s.w || 2.5, s.dash); });
      (o.vlines || []).forEach(v => {
        if (!(fx(v.x) >= a && fx(v.x) <= b)) return;
        g.line(ctx, [[X(v.x), y0], [X(v.x), y1]], v.col || pal.fg, 1.5, v.dash || [6, 3]);
        if (v.label) g.text(ctx, v.label, X(v.x) + (v.left ? -3 : 3), y0 + 8 + (v.row || 0) * 13, { size: 11, color: v.col || pal.fg, align: v.left ? 'right' : 'left', max: (x1 - x0) * 0.4 });
      });
      (o.dots || []).forEach(d => { if (fx(d.x) >= a && fx(d.x) <= b && d.y >= c && d.y <= e) g.dot(ctx, X(d.x), Y(d.y), 4, d.col || pal.fg); });
      let lx = x0 + 6; const ly = y0 - 6;
      o.series.forEach(s => { if (s.name) { const wd = g.text(ctx, s.name, lx, ly, { size: 11, color: s.col, bold: true, max: Rc.w * 0.3 }); lx += wd + 14; } });
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, g = sc.gfx, gap = 8;
      if (!R0 || R0.w < 60 || R0.h < 40) return;
      if (!r || !r.ok) { g.text(ctx, (r && r.why) || '', R0.x + 8, R0.y + 20, { size: 13, color: pal.fg, max: R0.w - 16 }); return; }
      const ctl = view.ctl, s = r.s, rl = isRL(ctl), tief = ctl.typ !== 'hoch';
      const chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - gap;
      const wide = R0.w >= 680;
      let sR, zR, bR, pR;
      if (wide) {
        const lw = Math.round(R0.w * 0.4) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.38), h2 = Math.round(bodyH * 0.56);
        sR = { x: R0.x, y: R0.y, w: lw, h: h1 }; pR = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: bodyH - h1 - gap };
        zR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h2 }; bR = { x: R0.x + lw + gap, y: R0.y + h2 + gap, w: rw, h: bodyH - h2 - gap };
      } else {
        const hs = [0.14, 0.3, 0.28, 0.28].map(q => Math.round(bodyH * q) - gap);
        let y = R0.y;
        sR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; zR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap;
        bR = { x: R0.x, y, w: R0.w, h: hs[2] }; y += hs[2] + gap; pR = { x: R0.x, y, w: R0.w, h: hs[3] };
      }
      const labels = { u: 'u_e = ' + val(ctl.ue, 'V'), r: 'R = ' + eng(ctl.r, 'Ω') };
      if (rl) labels.l = 'L = ' + eng(ctl.l, 'H'); else labels.c = 'C = ' + eng(ctl.c, 'F');
      sc.view('schematic', sR, { kind: 'filter', art: rl ? 'RL' : 'RC', typ: tief ? 'tief' : 'hoch', labels }, {});
      const zb = zeitbild(r, ctl);
      if (zb) {
        let d = zb;
        if (sw.active && sw.mode === 'rechteck') {
          const upto = Math.max(3, Math.round(sw.p * (zb.t.length - 1)) + 1);
          d = Object.assign({}, zb, { t: zb.t.slice(0, upto), series: zb.series.map(q => Object.assign({}, q, { y: q.y.slice(0, upto) })), cursor: zb.t[upto - 1] });
        }
        if (!sc.view('scope', zR, d, {})) {
          plot(ctx, g, pal, zR, { xl: 't', xu: zb.tUnit, yl: 'Spannung', yu: 'V', series: [{ pts: d.t.map((tt, k) => [tt, d.series[0].y[k]]), col: pal.u, name: 'u_e' }, { pts: d.t.map((tt, k) => [tt, d.series[1].y[k]]), col: pal.i, name: 'u_a', dash: [6, 4] }] });
        }
      }
      const b = bodeData(ctl, r.fg);
      if (b) {
        const hg = B.limV(CORE, 'fg_betrag', 0.7071);
        plot(ctx, g, pal, bR, { xlog: true, xl: 'f', xu: 'Hz', yl: 'Übertragungsverhältnis |H|', yu: '', ymin: 0, ymax: 1.1, series: [{ pts: b.f.map((f, k) => [f, b.h[k]]), col: pal.u, name: '|H|' }],
          vlines: [{ x: b.fg, label: 'f_g', col: pal.fg, row: 1 }, { x: r.f, label: 'f', col: pal.i, dash: [2, 3], left: true, row: 2 }], hlines: [{ y: hg, label: fm(hg, 4) + ' bei f_g' }], dots: [{ x: r.f, y: s.h, col: pal.i }] });
      }
      const ph = phasors(r, ctl);
      if (ph.ok) sc.view('phasor', pR, { list: ph.list, unit: 'V', bezug: ph.bezug, arc: Math.abs(s.phi) > 0.5 ? { a: 'U_a', b: 'U_e', label: 'φ = ' + fmt(s.phi, 1) + '°' } : null, rotate: true, project: false }, {});
      else { g.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6); g.text(ctx, ph.why || '', pR.x + 10, pR.y + 24, { size: 12, color: pal.mute, max: pR.w - 20 }); }
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = [['f_g', eng(s.fg, 'Hz')], ['τ', eng(s.tau, 's')], ['|H|', fm(s.h, 4)], [sweeping() ? 'f (Durchlauf)' : 'f', eng(r.f, 'Hz')]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    return {
      compute, meters, assess, diag, curves, phasors, state, draw,
      phaseHz: () => 0.15,
      onControl(key) { if ((key === 'eingang' || key === 'art' || key === 'typ') && sw.active) sw.active = false; },
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        const prev = fEffOf(ctl);
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say(sw.mode === 'durchlauf' ? 'Der Frequenzdurchlauf ist beendet.' : 'Der Rechteckvorgang ist gezeichnet.', 'info'); P0.bump(); return; }
        const cur = fEffOf(ctl);
        if (sw.mode === 'durchlauf' && sw.fg > 0 && prev < sw.fg && cur >= sw.fg) P0.say('Grenzfrequenz erreicht: Bei f_g = ' + val(sw.fg, 'Hz') + ' ist |H| = 0,7071 (−3 dB) und die Phase beträgt ±45°.', 'info');
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; P0.say(sw.mode === 'durchlauf' ? 'Der Frequenzdurchlauf wurde abgebrochen.' : 'Der Rechteckvorgang wurde abgebrochen.', 'info'); return true; }
        const fg = r && r.ok && isNum(r.fg) ? r.fg : 0;
        sw.mode = ctl.eingang === 'rechteck' ? 'rechteck' : 'durchlauf';
        sw.fg = fg; sw.fa = 1; sw.fb = 1e7;
        if (fg > 0) { const a = Math.max(1, fg / 100), z = Math.min(1e7, fg * 100); if (z > a * 1.0001) { sw.fa = a; sw.fb = z; } }
        sw.p = 0; sw.active = true;
        if (sw.mode === 'durchlauf') P0.say('Frequenzdurchlauf von ' + val(sw.fa, 'Hz') + ' bis ' + val(sw.fb, 'Hz') + ': Das Übertragungsverhältnis und die Phase wandern.', 'info');
        else P0.say('Rechteckvorgang: Der Zeitverlauf am Ausgang wird gezeichnet.', 'info');
        return true;
      },
      extend(api) {
        api.zeitbild = () => { try { return zeitbild(api._view().res, api._view().ctl); } catch (e) { return null; } };
        api.bode = () => {
          try { const v = api._view(), r = v.res; if (!r.ok) return null; const b = bodeData(v.ctl, r.fg); return b ? JSON.parse(JSON.stringify(b)) : null; } catch (e) { return null; }
        };
      },
      reset() { sw.active = false; sw.p = 0; sw.mode = 'durchlauf'; cmem.key = ''; cmem.val = null; }
    };
  }

  R.register({ id: 'filter', name: 'Hoch- und Tiefpass', icon: '🎚️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'filter', name: 'Hoch- und Tiefpass', icon: '🎚️', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
