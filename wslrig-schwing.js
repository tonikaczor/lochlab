/* wslrig-schwing.js - WSL-Lab (WP2c): Pruefstand 5 `schwing` - Reihen- und Parallelschwingkreis (SPEC 5.5).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.res.series / parallel / curve / ring, WSL_CORE.rlc.phasors); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung). Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Modell: ideale L und C,
 * Verlustwiderstand beim Reihenkreis in Reihe (r), beim Parallelkreis PARALLEL (rp, Lehrmodell F5), Beharrungszustand.
 * Steuerwerte: art (reihe, parallel), l (H, log), c (F, log), r (Ohm, log, 0 erlaubt = ideal, nur Reihe), rp (Ohm, log, nur Parallel), u (V, Effektivwert),
 *   f (Hz, log), modus (durchlauf, einschwingen: was die Taste fire zeigt), Vorgaben ziel (f0 in Hz), zielQ (Guete Q_G), zielB (Bandbreite B in Hz); 0 = keine Vorgabe.
 * Messgeraete: f0, z0, qg, b, fu, fo, z, i, ul, uc (Parallel: ul und uc zeigen die Quellenspannung), il, ic (Reihe: der Gesamtstrom, Parallel: die Zweigstroeme). Wirft nie.
 * fire(): modus durchlauf = Frequenzdurchlauf f0/10 bis 10 f0 (Resonanzkurve mit Cursor, Meldung beim Erreichen von f0);
 *         modus einschwingen = Einschwing-Huellkurve nach einem Impuls (e^(-delta t) aus dem Kern) wird gezeichnet.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-schwing.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = T0.modell || 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.';
  const KONV = T0.konvention || 'Bezug ist bei der Reihenschaltung der Strom, bei der Parallelschaltung die Spannung. φ = φ_u − φ_i: induktiv ist φ positiv, kapazitiv negativ.';
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const SWEEP_S = 10;                                     // Dauer des Frequenzdurchlaufs bzw. Einschwingbildes (s, Zeitlupe verlaengert)
  const WARN = 'Spannungsüberhöhung kann ein Bauteil zerstören (Lehrbeispiel, nicht nachbauen).';

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const isPar = ctl => ctl && ctl.art === 'parallel';
  const CONTROLS = B.fillControls([
    { key: 'art', label: 'Schwingkreis', type: 'select', value: 'reihe', options: opt([['reihe', 'Reihenschwingkreis'], ['parallel', 'Parallelschwingkreis']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Reihenschwingkreis: Spule, Kondensator und Verlustwiderstand in Reihe, bei Resonanz ist der Scheinwiderstand am kleinsten und der Strom am größten. Parallelschwingkreis: bei Resonanz ist der Scheinwiderstand am größten und der Strom aus der Quelle am kleinsten (Sperrkreis).' },
    { key: 'u', label: 'Spannung U', type: 'slider', scale: 'lin', min: 0.1, max: 400, step: 0.1, unit: 'V', unitKind: 'volt', value: 10, gruppe: 'quelle', sicht: 'zeit',
      help: 'Effektivwert der Quellenspannung. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'f', label: 'Frequenz f', type: 'slider', scale: 'log', min: 1, max: 10000000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 15000, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Frequenz der Quelle. Nahe der Resonanzfrequenz f₀ ändert sich der Scheinwiderstand besonders stark; stelle f auf f₀ und beobachte Strom und Spannungen.' },
    { key: 'l', label: 'Induktivität L', type: 'slider', scale: 'log', min: 0.000001, max: 10, step: 0.000001, unit: 'H', unitKind: 'ind', value: 0.001, gruppe: 'bauteile', sicht: 'formel',
      help: 'Induktivität der Spule. Größeres L ergibt eine kleinere Resonanzfrequenz f₀ und einen größeren Kennwiderstand Z₀.' },
    { key: 'c', label: 'Kapazität C', type: 'slider', scale: 'log', min: 1e-12, max: 0.001, step: 1e-12, unit: 'F', unitKind: 'cap', value: 1e-7, gruppe: 'bauteile', sicht: 'formel',
      help: 'Kapazität des Kondensators. Größeres C ergibt eine kleinere Resonanzfrequenz f₀ und einen kleineren Kennwiderstand Z₀.' },
    { key: 'r', label: 'Verlustwiderstand R (in Reihe)', type: 'slider', scale: 'log', logZero: true, min: 0, max: 100000, step: 0.01, unit: 'Ω', unitKind: 'res', value: 10, gruppe: 'bauteile', sicht: 'formel',
      visible: s => !isPar(s), help: 'Verlustwiderstand des Reihenkreises. Größeres R ergibt eine kleinere Güte Q_G = Z₀ / R und eine größere Bandbreite. Bei 0 Ω wäre der Kreis ideal: Die Güte wäre unendlich, das gibt es in der Wirklichkeit nie.' },
    { key: 'rp', label: 'Verlustwiderstand R_p (parallel)', type: 'slider', scale: 'log', min: 1, max: 10000000, step: 0.1, unit: 'Ω', unitKind: 'res', value: 1000, gruppe: 'bauteile', sicht: 'formel',
      visible: s => isPar(s), help: 'Verlustwiderstand des Parallelkreises (Lehrmodell: parallel zu L und C). Größeres R_p ergibt eine größere Güte Q_G = R_p / Z₀ und eine kleinere Bandbreite. Eine reale Spule mit R_L in Reihe lässt sich näherungsweise durch R_p ≈ Z₀² / R_L ersetzen (Näherung).' },
    { key: 'modus', label: 'Taste zeigt', type: 'select', value: 'durchlauf', options: opt([['durchlauf', 'Frequenzdurchlauf'], ['einschwingen', 'Einschwingvorgang']]), gruppe: 'ziel', sicht: 'zeit',
      help: 'Was die Taste unten vorführt: den Frequenzdurchlauf mit der Resonanzkurve oder den Einschwingvorgang (Hüllkurve nach einem Impuls).' },
    { key: 'ziel', label: 'Vorgabe Resonanzfrequenz f₀', type: 'slider', scale: 'log', logZero: true, min: 0, max: 10000000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Resonanzfrequenz f₀. Bei 0 Hz ist keine Vorgabe gesetzt. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'zielQ', label: 'Vorgabe Güte Q_G', type: 'slider', scale: 'lin', min: 0, max: 1000, step: 0.1, unit: '', unitKind: 'plain', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Güte Q_G. Bei 0 ist keine Vorgabe gesetzt. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'zielB', label: 'Vorgabe Bandbreite B', type: 'slider', scale: 'log', logZero: true, min: 0, max: 10000000, step: 0.1, unit: 'Hz', unitKind: 'freq', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Bandbreite B = f_o − f_u. Bei 0 Hz ist keine Vorgabe gesetzt. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Frequenzdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'zeit',
      help: 'Startet den Frequenzdurchlauf (Resonanzkurve wird durchfahren, Marken f_u, f₀, f_o) oder, wenn „Taste zeigt“ auf Einschwingvorgang steht, die Hüllkurve nach einem Impuls. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'f0', label: 'Resonanzfrequenz f₀', unit: 'Hz', digits: 1, min: 0, max: 10000000, help: 'Resonanzfrequenz f₀ = 1 / (2π · √(L · C)), aus dem Kern gerechnet; sie hängt nicht vom Verlustwiderstand ab.' },
    { key: 'z0', label: 'Kennwiderstand Z₀', unit: 'Ω', digits: 2, min: 0, max: 10000, help: 'Kennwiderstand Z₀ = √(L / C); bei f₀ sind X_L und X_C beide gleich Z₀.' },
    { key: 'qg', label: 'Güte Q_G', unit: '', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Güte Q_G: Reihenkreis Z₀ / R, Parallelkreis R_p / Z₀. Je größer die Güte, desto schmaler die Resonanzkurve.' },
    { key: 'b', label: 'Bandbreite B', unit: 'Hz', digits: 1, min: 0, max: 10000000, zeroIsNone: true, help: 'Bandbreite B = f_o − f_u = f₀ / Q_G, gemessen zwischen den Grenzfrequenzen bei 1/√2 (−3 dB).' },
    { key: 'fu', label: 'Untere Grenzfrequenz f_u', unit: 'Hz', digits: 1, min: 0, max: 10000000, zeroIsNone: true, help: 'Untere Grenzfrequenz, bei der Strom (Reihe) bzw. Scheinwiderstand (Parallel) auf das 1/√2-fache des Maximalwerts gefallen ist.' },
    { key: 'fo', label: 'Obere Grenzfrequenz f_o', unit: 'Hz', digits: 1, min: 0, max: 10000000, zeroIsNone: true, help: 'Obere Grenzfrequenz, bei der Strom (Reihe) bzw. Scheinwiderstand (Parallel) auf das 1/√2-fache des Maximalwerts gefallen ist.' },
    { key: 'z', label: 'Scheinwiderstand Z', unit: 'Ω', digits: 2, min: 0, max: 100000, help: 'Scheinwiderstand (Impedanz) des Kreises bei der eingestellten Frequenz. Reihe: bei f₀ am kleinsten. Parallel: bei f₀ am größten.' },
    { key: 'i', label: 'Strom I', unit: 'A', digits: 4, min: 0, max: 100, help: 'Effektivwert des Stroms aus der Quelle. Reihe: bei f₀ am größten. Parallel: bei f₀ am kleinsten.' },
    { key: 'ul', label: 'Spannung U_L', unit: 'V', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Spannung an der Spule. Im Reihenkreis kann sie bei Resonanz das Q_G-fache der Quellenspannung erreichen (Überhöhung). Im Parallelkreis liegt an der Spule die Quellenspannung.' },
    { key: 'uc', label: 'Spannung U_C', unit: 'V', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Spannung am Kondensator. Im Reihenkreis kann sie bei Resonanz das Q_G-fache der Quellenspannung erreichen (Überhöhung). Im Parallelkreis liegt am Kondensator die Quellenspannung.' },
    { key: 'il', label: 'Strom durch L', unit: 'A', digits: 4, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch die Spule (Reihe: der Gesamtstrom, Parallel: der Zweigstrom, bei Resonanz das Q_G-fache des Quellenstroms).' },
    { key: 'ic', label: 'Strom durch C', unit: 'A', digits: 4, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch den Kondensator (Reihe: der Gesamtstrom, Parallel: der Zweigstrom, bei Resonanz das Q_G-fache des Quellenstroms).' }
  ];
  const RES_S = cfg => (C0 ? C0.res.series(cfg) : null), RES_P = cfg => (C0 ? C0.res.parallel(cfg) : null);
  const PRESETS = [
    { id: 'reihe-10', name: 'Reihenkreis Güte 10', info: 'Übungsschaltung: ' + K(c => { const s = RES_S({ u: 10, l: 1e-3, c: 1e-7, r: 10 }); return 'L = 1 mH, C = 100 nF und R = 10 Ω ergeben f₀ = ' + eng(s.f0, 'Hz') + ', Q_G = ' + fm(s.qg, 1) + ' und B = ' + eng(s.b, 'Hz') + '; bei Resonanz liegen an L und C je ' + val(s.resonanz.ul, 'V') + ' bei ' + val(10, 'V') + ' Quellenspannung.'; }),
      controls: { art: 'reihe', u: 10, l: 1e-3, c: 1e-7, r: 10, f: 15915.5 } },
    { id: 'parallel-sperr', name: 'Parallelkreis als Sperrkreis', info: 'Übungsschaltung: ' + K(c => { const s = RES_P({ u: 10, l: 1e-3, c: 1e-7, rp: 1000 }); return 'L = 1 mH, C = 100 nF und R_p = 1 kΩ ergeben f₀ = ' + eng(s.f0, 'Hz') + ' und Q_G = ' + fm(s.qg, 1) + '; bei Resonanz ist Z = ' + val(s.resonanz.z, 'Ω') + ' am größten, der Quellenstrom ' + eng(s.resonanz.i, 'A') + ' am kleinsten, der Kreisstrom ' + eng(s.resonanz.kreisstrom, 'A') + '.'; }),
      controls: { art: 'parallel', u: 10, l: 1e-3, c: 1e-7, rp: 1000, f: 15915.5 } },
    { id: 'hohe-guete', name: 'Hohe Güte', info: 'Übungsschaltung: ' + K(c => { const s = RES_S({ u: 5, l: 1e-3, c: 1e-7, r: 1 }); return 'Mit R = 1 Ω steigt die Güte auf Q_G = ' + fm(s.qg, 1) + '; die Bandbreite sinkt auf B = ' + eng(s.b, 'Hz') + ', bei Resonanz liegen an L und C je ' + val(s.resonanz.ul, 'V') + ' bei ' + val(5, 'V') + ' Quellenspannung (Überhöhung).'; }),
      controls: { art: 'reihe', u: 5, l: 1e-3, c: 1e-7, r: 1, f: 15915.5 } },
    { id: 'niedrige-guete', name: 'Niedrige Güte', info: 'Übungsschaltung: ' + K(c => { const s = RES_S({ u: 10, l: 1e-3, c: 1e-7, r: 200 }); return 'Mit R = 200 Ω sinkt die Güte auf Q_G = ' + fm(s.qg, 2) + '; die Resonanzkurve wird flach, die Bandbreite beträgt B = ' + eng(s.b, 'Hz') + ' und die Überhöhung verschwindet.'; }),
      controls: { art: 'reihe', u: 10, l: 1e-3, c: 1e-7, r: 200, f: 15915.5 } },
    { id: 'radio-495k', name: 'Radio-Kreis 495 kHz', info: 'Übungsschaltung (Pool W2023-15): ' + K(c => { const s = RES_P({ u: 1, l: 220e-6, c: 470e-12, rp: 68000 }); return 'L = 220 µH und C = 470 pF ergeben f₀ = ' + val(s.f0 / 1000, 'kHz', 1) + ' (im Pool „ca. 495 kHz“); mit R_p = 68 kΩ ist Q_G = ' + fm(s.qg, 1) + ' und B = ' + eng(s.b, 'Hz') + '.'; }),
      controls: { art: 'parallel', u: 1, l: 220e-6, c: 470e-12, rp: 68000, f: 494900 } }
  ];
  const SICHT = { zeit: 'Resonanzkurve über f mit f_u, f₀, f_o und Einschwing-Hüllkurve', zeiger: 'Zeigerbild bei f: Reihe U_R, U_L, U_C, U; Parallel I_R, I_L, I_C, I', formel: 'f₀ = 1 / (2π · √(L · C)), Q_G = Z₀ / R (Reihe) bzw. R_p / Z₀ (Parallel), B = f₀ / Q_G' };
  const INFO = 'Reihen- und Parallelschwingkreis: Resonanzkurve, Güte, Bandbreite und Überhöhung. ' + KONV + ' ' + MODELL;

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0, mode: 'durchlauf', fa: 1, fb: 1e7, f0: 0 };
    const cmem = { key: '', val: null };
    const lim = (id, d) => B.limV(CORE, id, d);
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const artOf = ctl => (isPar(ctl) ? 'parallel' : 'reihe');
    const cfgOf = (ctl, f) => { const c = { u: ctl.u, l: ctl.l, c: ctl.c }; if (f !== undefined) c.f = f; if (isPar(ctl)) c.rp = ctl.rp; else c.r = ctl.r; return c; };
    const call = (ctl, f) => (isPar(ctl) ? CORE.res.parallel(cfgOf(ctl, f)) : CORE.res.series(cfgOf(ctl, f)));
    const fEffOf = ctl => (sw.active && sw.mode === 'durchlauf' ? sw.fa * Math.pow(sw.fb / sw.fa, sw.p) : ctl.f);
    function rangeOf(ctl) {
      const s = call(ctl), f0 = s && isNum(s.f0) ? s.f0 : 0;
      let fa = 1, fb = 1e7;
      if (f0 > 0) { fa = Math.max(1, f0 / 10); fb = Math.min(1e7, f0 * 10); if (!(fb > fa * 1.0001)) { fa = 1; fb = 1e7; } }
      return { fa, fb, f0 };
    }
    /** Kurvendaten (Resonanzkurve und Hilfskurven) aus dem Kern; nur bei geaenderten Bauteilwerten neu gerechnet. */
    function curveData(ctl) {
      const key = [ctl.art, ctl.u, ctl.l, ctl.c, ctl.r, ctl.rp].join('|');
      if (cmem.key === key) return cmem.val;
      let cv = null;
      try { cv = CORE.res.curve(Object.assign({ art: artOf(ctl) }, cfgOf(ctl)), 81); } catch (e) { cv = null; }
      if (!cv || cv.ok === false || !Array.isArray(cv.f)) cv = null;
      cmem.key = key; cmem.val = cv;
      return cv;
    }

    function compute(ctl) {
      const par = isPar(ctl), f = fEffOf(ctl), s = call(ctl, f);
      if (!s || s.ok === false) return { ok: false, valid: false, par, f, f0: 0, why: (s && (s.why || s.text)) || CORE.TEXTS.eingabe };
      const out = { ok: true, valid: s.valid !== false, par, s, f, f0: isNum(s.f0) ? s.f0 : 0, why: s.valid === false ? (s.why || CORE.TEXTS.eingabe) : '' };
      if (out.valid) {
        const p = CORE.rlc.phasors({ u: ctl.u, f, r: par ? ctl.rp : ctl.r, l: ctl.l, c: ctl.c, aufbau: 'RLC', art: par ? 'parallel' : 'reihe' });
        out.ph = p && p.ok !== false && p.valid !== false ? p : null;
        const rg = CORE.res.ring(Object.assign({ art: artOf(ctl) }, par ? { l: ctl.l, c: ctl.c, rp: ctl.rp } : { l: ctl.l, c: ctl.c, r: ctl.r }), 100);
        out.ring = rg && rg.ok !== false && rg.valid !== false && Array.isArray(rg.t) ? rg : null;
      }
      return out;
    }
    function meters(r, ctl) {
      const z = { f0: 0, z0: 0, qg: 0, b: 0, fu: 0, fo: 0, z: 0, i: 0, ul: 0, uc: 0, il: 0, ic: 0 };
      if (!r.ok) return z;
      const s = r.s;
      z.f0 = s.f0; z.z0 = s.z0;
      if (!r.valid) return z;
      if (r.par) return { f0: s.f0, z0: s.z0, qg: s.qg, b: s.b, fu: s.fu, fo: s.fo, z: s.z, i: s.i, ul: ctl.u, uc: ctl.u, il: s.il, ic: s.ic };
      return { f0: s.f0, z0: s.z0, qg: s.qg, b: s.b, fu: s.fu, fo: s.fo, z: s.z, i: s.i, ul: s.ul, uc: s.uc, il: s.i, ic: s.i };
    }
    const RANK = { gruen: 0, gelb: 1, rot: 2 };
    function assess(r, ctl) {
      if (!r.ok || !r.valid) return { ok: false, ampel: 'rot', text: r.why };
      const s = r.s;
      const items = [['f0', 'Resonanzfrequenz', s.f0, ctl.ziel, 'Hz'], ['qg', 'Güte Q_G', s.qg, ctl.zielQ, ''], ['b', 'Bandbreite', s.b, ctl.zielB, 'Hz']].filter(q => q[3] > 0);
      const rows = items.map(q => {
        const pct = Math.abs(q[2] - q[3]) / q[3] * 100, amp = B.devAmpel(pct, CORE);
        let text = B.devText(q[1], q[2], q[3], q[4], pct, CORE);
        text += amp === 'gruen' ? ' Stimmt mit der Vorgabe überein.' : (q[2] < q[3] ? ' Der Wert ist zu klein.' : ' Der Wert ist zu groß.');
        return { id: q[0], ampel: amp, text, pct, soll: q[3], ist: q[2], unit: q[4], name: q[1] };
      });
      let worst = 'gruen', pmax = 0;
      rows.forEach(w => { if (RANK[w.ampel] > RANK[worst]) worst = w.ampel; if (w.pct > pmax) pmax = w.pct; });
      const text = rows.map(w => w.text).join(' ') + (worst === 'gruen' ? ' Die Vorgabe ist erreicht.' : '');
      const w0 = rows[0];
      return { ok: worst === 'gruen', ampel: worst, text, margin: pmax, ziel: { text: w0.name + ' ' + val(w0.soll, w0.unit), soll: w0.soll, ist: w0.ist, unit: w0.unit },
        rows: rows.map(w => ({ id: w.id, ampel: w.ampel, text: w.text })) };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      if (!r.valid) { out.push({ id: 'ideal', kind: 'error', text: r.why }); return out; }
      const s = r.s, dev = Math.abs(r.f - s.f0) / s.f0 * 100, fw = lim('res_fenster', 2);
      if (dev <= fw + 1e-9) out.push({ id: 'resonanz', kind: 'info', text: 'Resonanz getroffen: f = ' + val(r.f, 'Hz') + ' weicht um ' + fm(dev, 2) + ' % von f₀ = ' + val(s.f0, 'Hz') + ' ab (Fenster ' + fm(fw, 0) + ' %, Lehrfaustwert).' });
      if (r.par) {
        if (Math.max(s.il, s.ic) > s.i * (1 + 1e-9)) out.push({ id: 'kreisstrom', kind: 'info', text: 'Der Kreisstrom I_L = ' + val(s.il, 'A') + ' und I_C = ' + val(s.ic, 'A') + ' ist größer als der Strom aus der Quelle I = ' + val(s.i, 'A') + ': Die Blindströme pendeln im Kreis.' });
      } else if (Math.max(s.ul, s.uc) > ctl.u * (1 + 1e-9)) {
        out.push({ id: 'ueberhoehung', kind: 'warn', text: 'U_L = ' + val(s.ul, 'V') + ' und U_C = ' + val(s.uc, 'V') + ' sind größer als die Quellenspannung ' + val(ctl.u, 'V') + '. ' + CORE.TEXTS.ueberhoehung });
      }
      if (s.imBand === true) out.push({ id: 'imband', kind: 'info', text: 'Die Frequenz liegt im Durchlassbereich zwischen f_u = ' + val(s.fu, 'Hz') + ' und f_o = ' + val(s.fo, 'Hz') + ' (Bandbreite B = ' + val(s.b, 'Hz') + ').' });
      if (s.qg < 1) out.push({ id: 'guete-klein', kind: 'info', text: 'Die Güte Q_G = ' + fm(s.qg, 2) + ' ist kleiner als 1: Der Kreis ist stark gedämpft, die Resonanzkurve ist flach; die Rechnung bleibt exakt.' });
      if (r.ring && r.ring.schwingt === false) out.push({ id: 'aperiodisch', kind: 'info', text: r.ring.hinweis || 'Die Dämpfung ist so groß, dass der Kreis nicht mehr schwingt.' });
      if (sw.active) out.push({ id: 'durchlauf', kind: 'info', text: sw.mode === 'durchlauf' ? 'Frequenzdurchlauf läuft: aktuell f = ' + val(r.f, 'Hz') + '.' : 'Einschwingvorgang wird gezeichnet.' });
      return out;
    }
    /** Phasoren aus dem Kern (rlc.phasors); der Bezugszeiger (Reihe I, Parallel U) bleibt Bezug, gezeigt werden nur Groessen EINER Einheit. */
    function phasors(r, ctl) {
      if (!r.ok) return { ok: false, why: r.why };
      if (!r.valid) return { ok: false, why: r.why };
      if (!r.ph) return { ok: false, why: CORE.TEXTS.eingabe };
      const bez = r.par ? 'spannung' : 'strom';
      return { ok: true, art: r.ph.art, bezug: bez, f: r.ph.f, omega: r.ph.omega, phi: r.ph.phi, effektiv: r.ph.effektiv !== false, unit: r.par ? 'A' : 'V',
        list: r.ph.list.filter(z => z.unit === (r.par ? 'A' : 'V')).map(z => Object.assign({}, z)), bezugList: r.ph.list.map(z => Object.assign({}, z)) };
    }
    const tscale = tmax => (tmax >= 1 ? { u: 's', k: 1 } : tmax >= 1e-3 ? { u: 'ms', k: 1e3 } : tmax >= 1e-6 ? { u: 'µs', k: 1e6 } : { u: 'ns', k: 1e9 });
    function curves(r, ctl) {
      if (!r.ok || !r.valid) return [];
      const cv = curveData(ctl), par = r.par, out = [];
      if (cv) {
        const pts = arr => cv.f.map((f, k) => [f, arr[k]]);
        const mk = (y, lab) => ({ x: r.f, y, label: lab });
        const marks = [{ x: cv.fu, label: 'f_u' }, { x: cv.f0, label: 'f₀' }, { x: cv.fo, label: 'f_o' }];
        const yMain = par ? cv.z : cv.i, yMax = Math.max.apply(null, yMain);
        const cur = call(ctl, r.f), jetzt = par ? cur.z : cur.i;
        out.push({ id: 'resonanz', title: par ? 'Resonanzkurve: Scheinwiderstand über der Frequenz' : 'Resonanzkurve: Strom über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: par ? 'Scheinwiderstand Z' : 'Strom I', yUnit: par ? 'Ω' : 'A',
          series: [{ name: par ? 'Z' : 'I', points: pts(yMain) }], marker: mk(jetzt, 'jetzt'), marks, limit: { y: yMax / Math.SQRT2, label: 'Maximum / √2 (−3 dB)' } });
        if (par) out.push({ id: 'strom', title: 'Ströme über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Strom', yUnit: 'A', series: [{ name: 'I', points: pts(cv.i) }, { name: 'I_L', points: pts(cv.il) }, { name: 'I_C', points: pts(cv.ic) }], marker: mk(cur.i, 'jetzt'), marks });
        else {
          out.push({ id: 'z', title: 'Scheinwiderstand über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Scheinwiderstand Z', yUnit: 'Ω', series: [{ name: 'Z', points: pts(cv.z) }], marker: mk(cur.z, 'jetzt'), marks });
          out.push({ id: 'uluc', title: 'Spannungen an L und C über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'U_L', points: pts(cv.ul) }, { name: 'U_C', points: pts(cv.uc) }], marker: mk(cur.ul, 'jetzt'), marks });
        }
        out.push({ id: 'phi', title: 'Phasenwinkel über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Phasenwinkel φ', yUnit: '°', series: [{ name: 'φ', points: pts(cv.phi) }], marker: mk(cur.phi, 'jetzt'), marks });
      }
      const rg = r.ring;
      if (rg && rg.t.length > 2) {
        const ts = tscale(rg.t[rg.t.length - 1]);
        const one = CORE.res.ring(Object.assign({ art: artOf(ctl) }, par ? { l: ctl.l, c: ctl.c, rp: ctl.rp } : { l: ctl.l, c: ctl.c, r: ctl.r }), [rg.tau]);
        out.push({ id: 'einschwing', title: 'Einschwingvorgang: Hüllkurve nach einem Impuls', xLabel: 'Zeit t', xUnit: ts.u, xScale: 'lin', yLabel: 'Hüllkurve (bezogen auf Anfangswert)', yUnit: '',
          series: [{ name: 'Hülle +', points: rg.t.map((t, k) => [t * ts.k, rg.env[k]]) }, { name: 'Hülle −', points: rg.t.map((t, k) => [t * ts.k, -rg.env[k]]) }],
          marker: one && one.env && isNum(one.env[0]) ? { x: rg.tau * ts.k, y: one.env[0], label: 'nach τ' } : undefined });
      }
      return out;
    }
    function state(r, ctl) {
      const base = { art: ctl.art, parallel: isPar(ctl), sweep: sw.active, sweepP: sw.p, modus: sw.active ? sw.mode : ctl.modus, fEff: r.f, f0: r.f0 || 0 };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, text: r.why });
      const s = r.s;
      if (!r.valid) return Object.assign(base, { valid: false, why: r.why, text: r.why, z0: s.z0, ideal: true });
      const dev = Math.abs(r.f - s.f0) / s.f0 * 100;
      const o = Object.assign(base, { valid: true, text: s.text, z0: s.z0, qg: s.qg, d: s.d, b: s.b, fu: s.fu, fo: s.fo, z: s.z, i: s.i, phi: s.phi, imBand: s.imBand === true, aufResonanz: dev <= lim('res_fenster', 2) + 1e-9, abwF0: dev,
        bezug: r.par ? 'spannung' : 'strom', ringP: sw.active && sw.mode === 'einschwingen' ? sw.p : 1 });
      if (s.resonanz) Object.assign(o, { resZ: s.resonanz.z, resI: s.resonanz.i, ueberhoehung: s.resonanz.ueberhoehung || 0, kreisstrom: s.resonanz.kreisstrom || 0 });
      if (r.ring) Object.assign(o, { tau: r.ring.tau, delta: r.ring.delta, schwingt: r.ring.schwingt === true, fd: r.ring.fd || 0 });
      if (r.par) Object.assign(o, { ul: ctl.u, uc: ctl.u, il: s.il, ic: s.ic, ir: s.ir }); else Object.assign(o, { ul: s.ul, uc: s.uc, ur: s.ur });
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
      if (c < 0 && e > 0) { ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke(); }
      g.text(ctx, o.yl + (o.yu ? ' in ' + o.yu : ''), Rc.x + 8, Rc.y + 4, { size: 11, color: pal.mute, base: 'top', max: Rc.w - 16 });
      g.text(ctx, fm(e, e >= 100 ? 0 : e >= 10 ? 1 : 2), x0 - 4, y0 + 4, { size: 11, color: pal.mute, align: 'right', max: ml - 6 });
      g.text(ctx, fm(c, c <= -100 ? 0 : 1), x0 - 4, y1, { size: 11, color: pal.mute, align: 'right', max: ml - 6 });
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
      if (!r || !r.ok || !r.valid) {
        const msg = (r && r.why) || '', words = String(msg).split(' ');
        ctx.font = g.font(13); let line = '', y = R0.y + 20;
        words.forEach(wd => { const tr = line ? line + ' ' + wd : wd; if (ctx.measureText(tr).width > R0.w - 16 && line) { g.text(ctx, line, R0.x + 8, y, { size: 13, color: pal.fg, max: R0.w - 16 }); y += 18; line = wd; } else line = tr; });
        if (line) g.text(ctx, line, R0.x + 8, y, { size: 13, color: pal.fg, max: R0.w - 16 });
        return;
      }
      const ctl = view.ctl, s = r.s, par = r.par;
      const ueh = !par && Math.max(s.ul, s.uc) > ctl.u * (1 + 1e-9);
      let warnLines = [];
      if (ueh && R0.h >= 330) {
        ctx.font = g.font(11, true);
        const words = WARN.split(' '); let line = '';
        words.forEach(wd => { const tr = line ? line + ' ' + wd : wd; if (ctx.measureText(tr).width > R0.w - 10 && line) { warnLines.push(line); line = wd; } else line = tr; });
        if (line) warnLines.push(line);
        warnLines = warnLines.slice(0, 3);
      }
      const chipsH = R0.h >= 330 ? 30 : 0, warnH = warnLines.length ? warnLines.length * 14 + 2 : 0, bodyH = R0.h - chipsH - warnH - gap;
      const wide = R0.w >= 680;
      let sR, cR, pR, eR;
      if (wide) {
        const lw = Math.round(R0.w * 0.4) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.38), h2 = Math.round(bodyH * 0.6);
        sR = { x: R0.x, y: R0.y, w: lw, h: h1 }; pR = { x: R0.x, y: R0.y + h1 + gap, w: lw, h: bodyH - h1 - gap };
        cR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h2 }; eR = { x: R0.x + lw + gap, y: R0.y + h2 + gap, w: rw, h: bodyH - h2 - gap };
      } else {
        const hs = [0.14, 0.31, 0.28, 0.27].map(q => Math.round(bodyH * q) - gap);
        let y = R0.y;
        sR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; cR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap;
        pR = { x: R0.x, y, w: R0.w, h: hs[2] }; y += hs[2] + gap; eR = { x: R0.x, y, w: R0.w, h: hs[3] };
      }
      const labels = { u: 'u = ' + val(ctl.u, 'V'), l: 'L = ' + eng(ctl.l, 'H'), c: 'C = ' + eng(ctl.c, 'F') };
      labels[par ? 'rp' : 'r'] = (par ? 'R_p = ' : 'R = ') + eng(par ? ctl.rp : ctl.r, 'Ω');
      if (par) labels.r = labels.rp;
      sc.view('schematic', sR, { kind: par ? 'parallelkreis' : 'reihenkreis', labels }, {});
      const cv = curveData(ctl);
      if (cv) {
        const yMain = par ? cv.z : cv.i, pts = cv.f.map((f, k) => [f, yMain[k]]);
        let done = sc.view('resCurve', cR, { points: pts, f0: cv.f0, fu: cv.fu, fo: cv.fo, art: par ? 'parallel' : 'reihe', yLabel: par ? 'Scheinwiderstand Z' : 'Strom I', yUnit: par ? 'Ω' : 'A', fCursor: r.f, xlog: true }, {});
        if (!done) {
          const mx = Math.max.apply(null, yMain);
          plot(ctx, g, pal, cR, { xlog: true, xl: 'f', xu: 'Hz', yl: par ? 'Scheinwiderstand Z' : 'Strom I', yu: par ? 'Ω' : 'A', ymin: 0, ymax: mx * 1.1,
            series: [{ pts, col: pal.u, name: par ? 'Z' : 'I' }], vlines: [{ x: cv.fu, label: 'f_u', col: pal.q, left: true, row: 1 }, { x: cv.f0, label: 'f₀', col: pal.fg }, { x: cv.fo, label: 'f_o', col: pal.q, row: 1 }, { x: r.f, label: 'f', col: pal.i, dash: [2, 3], row: 2 }],
            hlines: [{ y: mx / Math.SQRT2, label: 'Maximum / √2' }], dots: [{ x: r.f, y: par ? s.z : s.i, col: pal.i }] });
        }
      }
      const ph = phasors(r, ctl);
      if (ph.ok && ph.list.length) {
        sc.view('phasor', pR, { list: ph.list, unit: ph.unit, bezug: ph.bezug, arc: Math.abs(s.phi) > 0.5 ? { a: par ? 'I' : 'U', b: par ? 'U' : 'I', label: 'φ = ' + fmt(s.phi, 1) + '°' } : null, rotate: true, project: false }, {});
      } else { g.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6); g.text(ctx, ph.why || '', pR.x + 10, pR.y + 24, { size: 12, color: pal.mute, max: pR.w - 20 }); }
      const rg = r.ring;
      if (rg && rg.t.length > 2) {
        const tmax = rg.t[rg.t.length - 1], ts = tscale(tmax), prog = sw.active && sw.mode === 'einschwingen' ? sw.p : 1, n = rg.t.length;
        const upto = Math.max(2, Math.round(prog * (n - 1)) + 1);
        const hp = rg.t.slice(0, upto).map((tt, k) => [tt * ts.k, rg.env[k]]), hm = hp.map(q => [q[0], -q[1]]);
        const full = rg.t.map((tt, k) => [tt * ts.k, rg.env[k]]);
        const sers = [{ pts: hp, col: pal.u, name: 'Hülle +' }, { pts: hm, col: pal.u, name: 'Hülle −', dash: [6, 4] }];
        if (prog < 1) sers.unshift({ pts: full.concat(full.map(q => [q[0], -q[1]]).reverse()), col: pal.grid, w: 1 });
        plot(ctx, g, pal, eR, { xl: 't', xu: ts.u, yl: 'Einschwing-Hüllkurve e^(−δ·t)', yu: '', ymin: -1.05, ymax: 1.05, series: sers,
          vlines: [{ x: rg.tau * ts.k, label: 'τ', col: pal.i, dash: [2, 3] }] });
      }
      warnLines.forEach((ln, k) => g.text(ctx, ln, R0.x + 4, R0.y + bodyH + gap + 11 + k * 14, { size: 11, color: pal.warn || pal.fg, bold: true, max: R0.w - 8 }));
      if (chipsH) {
        const y = R0.y + R0.h - chipsH + 2;
        const items = [['f₀', eng(s.f0, 'Hz')], ['Q_G', fm(s.qg, 1)], ['B', eng(s.b, 'Hz')], [sw.active && sw.mode === 'durchlauf' ? 'f (Durchlauf)' : 'f', eng(r.f, 'Hz')]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    return {
      compute, meters, assess, diag, curves, phasors, state, draw,
      phaseHz: () => 0.15,
      onControl(key) { if (key === 'modus' && sw.active) sw.active = false; },
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        const prev = fEffOf(ctl);
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say(sw.mode === 'durchlauf' ? 'Der Frequenzdurchlauf ist beendet.' : 'Der Einschwingvorgang ist gezeichnet.', 'info'); P0.bump(); return; }
        const cur = fEffOf(ctl);
        if (sw.mode === 'durchlauf' && sw.f0 > 0 && prev < sw.f0 && cur >= sw.f0) P0.say('Resonanzstelle erreicht: Bei f₀ = ' + val(sw.f0, 'Hz') + (isPar(ctl) ? ' ist der Scheinwiderstand am größten.' : ' ist der Scheinwiderstand am kleinsten.'), 'info');
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; P0.say(sw.mode === 'durchlauf' ? 'Der Frequenzdurchlauf wurde abgebrochen.' : 'Der Einschwingvorgang wurde abgebrochen.', 'info'); return true; }
        const rg = rangeOf(ctl);
        sw.mode = ctl.modus === 'einschwingen' ? 'einschwingen' : 'durchlauf';
        sw.fa = rg.fa; sw.fb = rg.fb; sw.f0 = rg.f0; sw.p = 0; sw.active = true;
        if (sw.mode === 'durchlauf') P0.say('Frequenzdurchlauf von ' + val(rg.fa, 'Hz') + ' bis ' + val(rg.fb, 'Hz') + ': Die Resonanzkurve wird durchfahren.', 'info');
        else P0.say('Einschwingvorgang: Die Hüllkurve nach einem Impuls wird gezeichnet.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; sw.mode = 'durchlauf'; cmem.key = ''; cmem.val = null; }
    };
  }

  R.register({ id: 'schwing', name: 'Reihen- und Parallelschwingkreis', icon: '🔔', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'schwing', name: 'Reihen- und Parallelschwingkreis', icon: '🔔', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel', 'zielQ', 'zielB'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
