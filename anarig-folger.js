/* anarig-folger.js - ANA-Lab (WP2b): Pruefstand 4 `folger` - Kollektorschaltung, Grundschaltungen, Z-Folger, Konstantstromquelle (SPEC 5.4).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.grund.compare, ANA_CORE.tr.zfolger / cs / dc, ANA_CORE.limit); hier steht keine zweite Transistorformel.
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteilwerte sind Uebungswerte (Uebungsschaltung).
 * Modell wie `emitter` (Kleinsignal-Hybrid-pi, kein Early-Effekt, keine Kapazitaeten, Koppelkondensatoren als ideal); die Basisschaltung gibt es nur als Vergleich (F8).
 * Betriebsarten: signal (Kollektor-, Emitter- oder Basisschaltung mit Vergleich), zener (Z-Folger: R1 = (U_B - U_Z) / (I_Z + I_C/B), U_E = U_Z - U_BE), konstantstrom (R_E = (n_D * U_D - U_BE) / I_C).
 * Grundschaltung `kollektor` rechnet mit R_C = R_KURZ (Kollektor an U_B), die beiden anderen mit dem eingestellten R_C; der Vergleich vuE/vuK/vuB nutzt den Arbeitspunkt der Emitterschaltung (SPEC 4.4).
 * Fehlerfaelle (nur Simulation), Umsetzung VOR dem Kernaufruf: r1 offen / r2 offen -> R_OFFEN, re offen -> re1 und re2 R_OFFEN, transistor defekt -> defekt:'be_offen', versorgung fehlt -> ub = 1 mV,
 *   koppel-c offen -> ue = 0. In den Betriebsarten zener und konstantstrom gibt es keinen Kern fuer Fehler: dort fallen Ausgangsspannung und Strom auf null (r1 offen, re offen, transistor defekt, versorgung fehlt);
 *   die uebrigen Fehler wirken dort nicht (die Bauteile fehlen in der Schaltung).
 * Steuerwerte (SI): betrieb, schaltung, ub, ue (V), f (Hz), rg, r1, r2, rc, re1, re2 (Ohm), b, rl (Ohm), uz (V), iz, ic (A), nd, ud (V), fehler, ziel (je Betriebsart: Ohm | V | mA; 0 = keine), Taste fire (Lastwechsel).
 * Messgeraete: vu, vus, rin, rout (Ohm), direkt, mit (mV, Spitze), vuE, vuK, vuB, ues (V), r1z (Ohm), ibz (uA), reK (Ohm), ic (mA).
 * Ampel (nur mit Vorgabe): signal gruen = r_aus hoechstens Vorgabe + 5 %, gelb bis + 10 %; zener gruen = U_E auf 5 %, gelb 5-10 %; konstantstrom gruen = I_C auf 5 %, gelb 5-10 %; rot = verfehlt oder Transistor nicht aktiv.
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-folger.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = 'Modell: Kleinsignal-Hybrid-π wie bei der Emitterschaltung, kein Early-Effekt, keine Transistorkapazitäten, Koppelkondensatoren ideal; die Basisschaltung gibt es nur als Vergleich bei gleichem Arbeitspunkt (F8). ' + (T0.modellTransistor || '');
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12, KURZ = (C0 && C0.R_KURZ) || 1e-3;
  const SWEEP_S = 6;                                      // Dauer des Lastwechsels (s, Zeitlupe verlaengert)
  const MINUS = '−';
  const SW = ['signal'];

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const when = (key, vals) => ({ visible: st => !st || vals.indexOf(st[key]) >= 0 });
  const FEHLER = [['keiner', 'kein Fehler'], ['r1 offen', 'R_1 offen'], ['r2 offen', 'R_2 offen'], ['re offen', 'R_E offen'], ['transistor defekt', 'Transistor defekt'], ['versorgung fehlt', 'Versorgung fehlt'], ['koppel-c offen', 'Koppelkondensator offen']];
  const CONTROLS = B.fillControls([
    { key: 'betrieb', label: 'Betriebsart', type: 'select', value: 'signal', options: opt([['signal', 'Signalverstärkung (Grundschaltungen)'], ['zener', 'Z-Folger (Spannungsreferenz)'], ['konstantstrom', 'Konstantstromquelle']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Wählt die Betriebsart: Signalverstärkung mit Kollektor-, Emitter- oder Basisschaltung, den Z-Folger mit Z-Diode an der Basis oder die Konstantstromquelle mit Dioden an der Basis.' },
    { key: 'schaltung', label: 'Grundschaltung', type: 'select', value: 'kollektor', options: opt([['kollektor', 'Kollektorschaltung (Emitterfolger)'], ['emitter', 'Emitterschaltung'], ['basis', 'Basisschaltung (nur Vergleich)']]), gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', SW),
      help: 'Wählt die Grundschaltung der Signalverstärkung. Die Kollektorschaltung (Emitterfolger) hat V_u knapp unter 1 und ist ein Impedanzwandler; die Basisschaltung wird nur als Vergleichszeile gerechnet.' },
    { key: 'ub', label: 'Betriebsspannung', type: 'slider', scale: 'lin', min: 5, max: 30, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betriebsspannung U_B der Übungsschaltung (Kleinspannung). Beim Z-Folger muss sie über der Z-Spannung liegen, sonst gibt es keinen Z-Strom.' },
    { key: 'ue', label: 'Eingangsamplitude', type: 'slider', scale: 'log', min: 1e-3, max: 2, step: 1e-3, unit: 'V', unitKind: 'V', value: 0.1, gruppe: 'quelle', sicht: 'signal', ...when('betrieb', SW),
      help: 'Amplitude der Quellenspannung (Spitzenwert). Gerechnet wird das Kleinsignal; bei großer Amplitude gilt das Modell nur in der Näherung. Übungswert.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 10, max: 1e6, step: 1, unit: 'Hz', unitKind: 'Hz', value: 1000, gruppe: 'quelle', sicht: 'signal', ...when('betrieb', SW),
      help: 'Frequenz der Quelle. Die Amplituden hängen im Modell nicht von der Frequenz ab (bis zur Transitfrequenz ideal); sie bestimmt nur das Zeitbild.' },
    { key: 'rg', label: 'Quellenwiderstand', type: 'slider', scale: 'log', min: 10, max: 1e5, step: 1, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'quelle', sicht: 'formel', ...when('betrieb', SW),
      help: 'Innenwiderstand R_G der Signalquelle. Je größer R_G, desto weniger Spannung kommt an der Last an; der Folger behält trotzdem mehr als der direkte Anschluss. Übungswert.' },
    { key: 'r1', label: 'Basisspannungsteiler R1', type: 'slider', scale: 'log', min: 1e3, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', SW),
      help: 'Oberer Widerstand des Basisspannungsteilers. Er legt zusammen mit R_2 die Basisspannung und damit den Arbeitspunkt fest. Übungswert.' },
    { key: 'r2', label: 'Basisspannungsteiler R2', type: 'slider', scale: 'log', min: 1e3, max: 1e5, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', SW),
      help: 'Unterer Widerstand des Basisspannungsteilers. Ein größeres R_2 hebt die Basisspannung und den Emitterstrom. Übungswert.' },
    { key: 'rc', label: 'Kollektorwiderstand (nur Emitter- und Basisschaltung)', type: 'slider', scale: 'log', min: 100, max: 1e5, step: 10, unit: 'Ω', unitKind: 'Ω', value: 2200, gruppe: 'bauteile', sicht: 'formel', visible: st => !st || (st.betrieb === 'signal' && st.schaltung !== 'kollektor'),
      help: 'Kollektorwiderstand R_C, nur für die Emitter- und die Basisschaltung. Bei der Kollektorschaltung liegt der Kollektor an der Betriebsspannung. Übungswert.' },
    { key: 're1', label: 'Emitterwiderstand ungebrückt', type: 'slider', scale: 'log', min: 1, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 100, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', SW),
      help: 'Emitterwiderstand R_E1. Bei der Kollektorschaltung ist er mit R_E2 zusammen der Arbeitswiderstand, an dem der Ausgang abgegriffen wird. Übungswert.' },
    { key: 're2', label: 'Emitterwiderstand zusätzlich', type: 'slider', scale: 'log', min: 1, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 470, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', SW),
      help: 'Zusätzlicher Emitterwiderstand R_E2 in Reihe zu R_E1, hier ohne Emitterkondensator (er wirkt auch für das Signal). Übungswert.' },
    { key: 'b', label: 'Gleichstromverstärkung B', type: 'slider', scale: 'lin', min: 20, max: 400, step: 1, unit: '', unitKind: '', value: 100, gruppe: 'bauteile', sicht: 'formel',
      help: 'Gleichstromverstärkung B des Transistors (Übungswert, F4). Beim Z-Folger bestimmt sie den Basisstrom I_C / B, der zum Z-Strom hinzukommt.' },
    { key: 'rl', label: 'Lastwiderstand (oberer Anschlag = Leerlauf)', type: 'slider', scale: 'log', min: 10, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 220, gruppe: 'last', sicht: 'formel', ...when('betrieb', SW),
      help: 'Lastwiderstand R_L am Ausgang. Ein kleiner Wert belastet die Quelle stark; der Folger entlastet sie. Am oberen Anschlag (1 MΩ) gilt die Stufe als unbelastet (Leerlauf). Übungswert.' },
    { key: 'uz', label: 'Z-Spannung', type: 'slider', scale: 'lin', min: 2.4, max: 15, step: 0.1, unit: 'V', unitKind: 'V', value: 6, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', ['zener']),
      help: 'Z-Spannung U_Z der Z-Diode an der Basis (Übungswert). Die Emitterspannung ist U_E = U_Z − U_BE mit U_BE = 0,7 V (belegt).' },
    { key: 'iz', label: 'Z-Strom', type: 'slider', scale: 'log', min: 1e-3, max: 0.03, step: 1e-4, unit: 'A', unitKind: 'A', value: 0.012, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', ['zener']),
      help: 'Strom I_Z durch die Z-Diode (Übungswert). Der Vorwiderstand R_1 führt I_Z plus den Basisstrom; ist I_Z kleiner als der Basisstrom, wird die Referenz weich.' },
    { key: 'ic', label: 'Kollektorstrom', type: 'slider', scale: 'log', min: 1e-3, max: 0.5, step: 1e-3, unit: 'A', unitKind: 'A', value: 0.09, gruppe: 'last', sicht: 'formel', ...when('betrieb', ['zener', 'konstantstrom']),
      help: 'Kollektorstrom I_C: beim Z-Folger der Laststrom, bei der Konstantstromquelle der einzustellende Strom. Übungswert; die Grenze I_C,max ist ein Übungswert (F4).' },
    { key: 'nd', label: 'Anzahl Dioden in Reihe', type: 'slider', scale: 'lin', min: 1, max: 4, step: 1, unit: '', unitKind: '', value: 3, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', ['konstantstrom']),
      help: 'Zahl der Dioden in Reihe an der Basis der Konstantstromquelle. Die Summenspannung der Reihe muss über U_BE liegen, sonst entsteht keine Spannung am Emitterwiderstand.' },
    { key: 'ud', label: 'Flussspannung je Diode', type: 'slider', scale: 'lin', min: 0.5, max: 0.9, step: 0.01, unit: 'V', unitKind: 'V', value: 0.7, gruppe: 'bauteile', sicht: 'formel', ...when('betrieb', ['konstantstrom']),
      help: 'Flussspannung U_D jeder Diode der Reihe (Siliziumdiode 0,7 V, belegt). Aus n_D · U_D − U_BE ergibt sich die Spannung am Emitterwiderstand.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): R_1, R_2 oder R_E offen, Transistor defekt, Versorgung fehlt oder Koppelkondensator offen. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'ziel', label: 'Vorgabe (je Betriebsart, 0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 100, step: 0.1, unit: '', unitKind: '', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe je Betriebsart; bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Signalverstärkung: größter Ausgangswiderstand in Ω; Z-Folger: Emitterspannung U_E in V; Konstantstromquelle: Strom I_C in mA. Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16).' },
    { key: 'fire', label: 'Lastwechsel', type: 'button', gruppe: 'ziel', sicht: 'signal',
      help: 'Startet den Lastwechsel (Betriebsart Signalverstärkung): R_L fällt von 10 kΩ auf den eingestellten Wert. Die Spannung an der Last bricht beim direkten Anschluss ein, am Folger viel weniger. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'vu', label: 'Spannungsverstärkung V_u', unit: '', digits: 3, min: -500, max: 500, zeroIsNone: true, fuer: ['signal'], help: 'Spannungsverstärkung der gewählten Grundschaltung, belastet. Bei der Kollektorschaltung liegt sie knapp unter 1 und nie darüber; bei der Emitterschaltung ist sie negativ (Phase 180°).' },
    { key: 'vus', label: 'Spannungsverstärkung mit Quelle V_u,Quelle', unit: '', digits: 3, min: -500, max: 500, zeroIsNone: true, fuer: ['signal'], help: 'Spannungsverstärkung von der Quelle zur Last: V_u mal der Spannungsteiler aus Quellenwiderstand R_G und Eingangswiderstand der Stufe.' },
    { key: 'rin', label: 'Eingangswiderstand r_ein', unit: 'Ω', digits: 1, min: 0, max: 1e5, infAbove: 1e9, zeroIsNone: true, fuer: ['signal'], help: 'Eingangswiderstand der gewählten Grundschaltung: R_1 parallel R_2 parallel Eingangswiderstand des Transistors (Basisschaltung: am Emitter).' },
    { key: 'rout', label: 'Ausgangswiderstand r_aus', unit: 'Ω', digits: 1, min: 0, max: 1e4, infAbove: 1e9, zeroIsNone: true, fuer: ['signal'], help: 'Ausgangswiderstand der gewählten Grundschaltung. Die Kollektorschaltung hat einen kleinen Ausgangswiderstand und eignet sich als Impedanzwandler.' },
    { key: 'direkt', label: 'Last direkt an der Quelle', unit: 'mV', digits: 2, min: 0, max: 2000, zeroIsNone: true, fuer: ['signal'], help: 'Spitzenwert der Spannung an der Last, wenn die Quelle direkt angeschlossen ist: U_e · R_L / (R_G + R_L).' },
    { key: 'mit', label: 'Last mit Schaltung', unit: 'mV', digits: 2, min: 0, max: 2000, zeroIsNone: true, fuer: ['signal'], help: 'Spitzenwert der Spannung an der Last mit der gewählten Grundschaltung: U_e mal Betrag von V_u,Quelle.' },
    { key: 'vuE', label: 'V_u der Emitterschaltung', unit: '', digits: 3, min: -500, max: 500, zeroIsNone: true, fuer: ['signal'], help: 'Spannungsverstärkung der Emitterschaltung im Vergleich, ohne Emitterkondensator, bei gleichem Arbeitspunkt.' },
    { key: 'vuK', label: 'V_u der Kollektorschaltung', unit: '', digits: 3, min: -500, max: 500, zeroIsNone: true, fuer: ['signal'], help: 'Spannungsverstärkung der Kollektorschaltung im Vergleich, bei gleichem Arbeitspunkt: knapp unter 1.' },
    { key: 'vuB', label: 'V_u der Basisschaltung', unit: '', digits: 3, min: -500, max: 500, zeroIsNone: true, fuer: ['signal'], help: 'Spannungsverstärkung der Basisschaltung im Vergleich, bei gleichem Arbeitspunkt: gleichphasig, mit niedrigem Eingangswiderstand.' },
    { key: 'ues', label: 'Emitterspannung U_E', unit: 'V', digits: 3, min: 0, max: 30, zeroIsNone: true, fuer: ['zener'], help: 'Emitterspannung des Z-Folgers: U_Z − U_BE. Die Z-Diode legt die Basisspannung fest, der Emitter folgt um U_BE tiefer.' },
    { key: 'r1z', label: 'Vorwiderstand R_1', unit: 'Ω', digits: 1, min: 0, max: 5000, zeroIsNone: true, fuer: ['zener'], help: 'Vorwiderstand der Z-Diode am Z-Folger: R_1 = (U_B − U_Z) / (I_Z + I_C / B). Auslegungswert aus dem Kern.' },
    { key: 'ibz', label: 'Basisstrom I_B', unit: 'µA', digits: 1, min: 0, max: 30000, zeroIsNone: true, fuer: ['zener'], help: 'Basisstrom des Z-Folgers, I_C / B. Er fließt zusätzlich zum Z-Strom durch R_1.' },
    { key: 'reK', label: 'Emitterwiderstand R_E', unit: 'Ω', digits: 2, min: 0, max: 500, zeroIsNone: true, fuer: ['konstantstrom'], help: 'Emitterwiderstand der Konstantstromquelle: R_E = (n_D · U_D − U_BE) / I_C. Auslegungswert aus dem Kern.' },
    { key: 'ic', label: 'Kollektorstrom I_C', unit: 'mA', digits: 2, min: 0, max: 500, fuer: ['zener', 'konstantstrom'], help: 'Kollektorstrom: beim Z-Folger der Laststrom, bei der Konstantstromquelle der Strom, den die Quelle einprägt.' }
  ];
  const SICHT = { kennlinie: 'Arbeitspunkt und Übertragung: Ausgang folgt dem Eingang', signal: 'Eingang, Ausgang und Ausgang ohne Folger über der Zeit', formel: 'V_u = (B + 1) · R_E / (r_BE + (B + 1) · R_E)' };
  const INFO = 'Kollektorschaltung (Emitterfolger) als Impedanzwandler, Vergleich der drei Grundschaltungen, Z-Folger mit Vorwiderstand und Konstantstromquelle mit Dioden an der Basis. ' + MODELL;

  const PRESETS = [
    { id: 'emitterfolger', name: 'Emitterfolger', info: 'Übungsschaltung: ' + K(c => { const g = c.grund.compare({ ub: 12, r1: 47000, r2: 10000, rc: KURZ, re1: 100, re2: 470, ce: false, b: 100, rg: 10000, rl: 220 }); return 'Die Kollektorschaltung hat V_u = ' + val(g.kollektor.vu, '', 4) + ' (knapp unter 1, nie darüber) und r_aus = ' + eng(g.kollektor.rout, 'Ω') + ', der Eingangswiderstand ist ' + eng(g.kollektor.rin, 'Ω') + '.'; }),
      controls: { betrieb: 'signal', schaltung: 'kollektor' } },
    { id: 'vergleich', name: 'Vergleich der Grundschaltungen', info: 'Übungsschaltung: ' + K(c => { const g = c.grund.compare({ ub: 12, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: false, b: 100, rg: 600, rl: 10000 }); return 'Bei gleichem Arbeitspunkt ist V_u = ' + val(g.emitter.vu, '', 2).replace('-', MINUS) + ' (Emitter), ' + val(g.kollektor.vu, '', 3) + ' (Kollektor) und ' + val(g.basis.vu, '', 1) + ' (Basis); r_ein = ' + eng(g.emitter.rin, 'Ω') + ', ' + eng(g.kollektor.rin, 'Ω') + ' und ' + eng(g.basis.rin, 'Ω') + '.'; }),
      controls: { betrieb: 'signal', schaltung: 'emitter', rg: 600, rl: 10000 } },
    { id: 'z-folger', name: 'Z-Folger (Pool F2022-N08)', info: 'Übungsschaltung (Pool F2022-N08): ' + K(c => { const z = c.tr.zfolger({ ub: 15, uz: 6, ic: 0.09, b: 30, iz: 0.012 }); return 'Für U_Z = 6 V, I_Z = 12 mA, I_C = 90 mA und B = 30 ist R_1 = ' + eng(z.r1, 'Ω') + ' (I_B = ' + val(z.ib * 1000, 'mA', 1) + '), die Emitterspannung ist U_E = ' + val(z.ue, 'V', 1) + '.'; }),
      controls: { betrieb: 'zener', ub: 15, uz: 6, iz: 0.012, ic: 0.09, b: 30 } },
    { id: 'konstantstrom', name: 'Konstantstromquelle (Pool W2022-N38)', info: 'Übungsschaltung (Pool W2022-N38): ' + K(c => { const s = c.tr.cs({ nd: 3, ud: 0.7, ic: 0.04 }); return 'Mit drei Dioden (je 0,7 V) und I_C = 40 mA ist R_E = ' + eng(s.re, 'Ω') + ' (U_RE = ' + val(s.ure, 'V', 2) + ').'; }),
      controls: { betrieb: 'konstantstrom', ub: 12, nd: 3, ud: 0.7, ic: 0.04 } },
    { id: 'quelle-hochohmig', name: 'Hochohmige Quelle (Impedanzwandler)', info: 'Übungsschaltung: ' + K(c => { const g = c.grund.compare({ ub: 12, r1: 47000, r2: 10000, rc: KURZ, re1: 100, re2: 470, ce: false, b: 100, rg: 100000, rl: 100 }); return 'Bei R_G = 100 kΩ und R_L = 100 Ω liefert der direkte Anschluss nur ' + val(g.direkt * 100, '%', 2) + ' der Quellenspannung, die Kollektorschaltung ' + val(Math.abs(g.kollektor.vus) * 100, '%', 2) + '.'; }),
      controls: { betrieb: 'signal', schaltung: 'kollektor', rg: 100000, rl: 100 } }
  ];

  const FN = { 'r1 offen': 'R_1 ist offen', 'r2 offen': 'R_2 ist offen', 're offen': 'R_E ist offen', 'koppel-c offen': 'Der Koppelkondensator ist offen' };

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0 };
    const okc = a => a && a.ok !== false && a.valid !== false;
    const rlOf = (ctl) => { const rl = ctl.rl >= 1e6 ? OFFEN : ctl.rl; return sw.active && ctl.rl < 1e4 ? 1e4 * Math.pow(ctl.rl / 1e4, sw.p) : rl; };

    function sigCfg(ctl, rcOverride) {
      const cfg = { ub: ctl.ub, r1: ctl.r1, r2: ctl.r2, rc: rcOverride !== undefined ? rcOverride : ctl.rc, re1: ctl.re1, re2: ctl.re2, ce: false, b: ctl.b, rg: ctl.rg, rl: rlOf(ctl) };
      switch (ctl.fehler) {
        case 'r1 offen': cfg.r1 = OFFEN; break;
        case 'r2 offen': cfg.r2 = OFFEN; break;
        case 're offen': cfg.re1 = OFFEN; cfg.re2 = OFFEN; break;
        case 'transistor defekt': cfg.defekt = 'be_offen'; break;
        case 'versorgung fehlt': cfg.ub = 1e-3; break;
        default: break;
      }
      return cfg;
    }
    const zustandOf = c => { const z = c && c.zustand ? c.zustand : 'aktiv'; return z === 'defekt' ? 'sperrt' : z; };

    function compute(ctl) {
      const mode = ctl.betrieb, f = ctl.fehler;
      if (mode === 'signal') {
        const cfgA = sigCfg(ctl, ctl.schaltung === 'kollektor' ? KURZ : ctl.rc), cfgE = sigCfg(ctl, ctl.rc);
        const cmp = CORE.grund.compare(cfgA), cmpE = ctl.schaltung === 'kollektor' ? CORE.grund.compare(cfgE) : cmp;
        if (!cmp || cmp.ok === false) return { ok: false, mode, why: (cmp && cmp.why) || 'Die Eingabe ist ungültig.' };
        const cfgN = Object.assign({}, cfgA); delete cfgN.defekt; cfgN.ub = ctl.ub; cfgN.r1 = ctl.r1; cfgN.r2 = ctl.r2; cfgN.re1 = ctl.re1; cfgN.re2 = ctl.re2;
        const nf = CORE.grund.compare(cfgN);
        const valid = okc(cmp), sel = valid ? cmp[ctl.schaltung] : null;
        const ue = f === 'koppel-c offen' ? 0 : ctl.ue;
        const direktF = nf && nf.ok !== false && isNum(nf.direkt) ? nf.direkt : NaN;
        return { ok: true, mode, cfg: cfgA, cmp, cmpE, valid, sel, ue, direktF, rlEff: cfgA.rl, zustand: zustandOf(cmp), ctl: Object.assign({}, ctl) };
      }
      if (mode === 'zener') {
        const z = CORE.tr.zfolger({ ub: ctl.ub, uz: ctl.uz, ic: ctl.ic, b: ctl.b, iz: ctl.iz });
        if (!z || z.ok === false) return { ok: false, mode, why: (z && z.why) || 'Die Eingabe ist ungültig.' };
        const dead = f === 'r1 offen' || f === 'transistor defekt' || f === 'versorgung fehlt';
        const noLoad = f === 're offen';
        return { ok: true, mode, z, valid: true, ueOut: dead ? 0 : z.ue, icOut: dead || noLoad ? 0 : z.ic, ibOut: dead || noLoad ? 0 : z.ib, dead, noLoad, ctl: Object.assign({}, ctl) };
      }
      const s = CORE.tr.cs({ nd: ctl.nd, ud: ctl.ud, ic: ctl.ic });
      if (!s || s.ok === false) return { ok: false, mode, why: (s && s.why) || 'Die Eingabe ist ungültig.' };
      const dead = f === 'r1 offen' || f === 're offen' || f === 'transistor defekt' || f === 'versorgung fehlt';
      return { ok: true, mode, s, valid: true, icOut: dead ? 0 : s.ic, dead, ctl: Object.assign({}, ctl) };
    }

    function meters(r, ctl) {
      const o = { vu: 0, vus: 0, rin: 0, rout: 0, direkt: 0, mit: 0, vuE: 0, vuK: 0, vuB: 0, ues: 0, r1z: 0, ibz: 0, reK: 0, ic: 0 };
      if (!r.ok) return o;
      if (r.mode === 'signal') {
        if (isNum(r.direktF)) o.direkt = r.ue * r.direktF * 1000;
        if (r.valid) {
          o.vu = r.sel.vu; o.vus = r.sel.vus; o.rin = r.sel.rin; o.rout = r.sel.rout; o.mit = r.ue * Math.abs(r.sel.vus) * 1000;
          if (okc(r.cmpE)) { o.vuE = r.cmpE.emitter.vu; o.vuK = r.cmpE.kollektor.vu; o.vuB = r.cmpE.basis.vu; }
          else { o.vuK = r.cmp.kollektor.vu; }
        }
        o.ic = isNum(r.cmp.ic) ? r.cmp.ic * 1000 : 0;
      } else if (r.mode === 'zener') {
        o.ues = r.ueOut; o.r1z = r.z.r1; o.ibz = r.ibOut * 1e6; o.ic = r.icOut * 1000;
      } else { o.reK = r.s.re; o.ic = r.icOut * 1000; }
      return o;
    }

    function pctRow(id, name, ist, soll, unit) {
      const pct = Math.abs(ist - soll) / soll * 100;
      return { id, ampel: B.devAmpel(pct, CORE), margin: pct, text: B.devText(name, ist, soll, unit, pct, CORE) };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: ' + r.why };
      const z = ctl.ziel;
      if (r.mode === 'signal') {
        if (!r.valid || r.zustand !== 'aktiv') return { ok: false, ampel: 'rot', text: 'Der Transistor ist nicht aktiv (I_C = ' + val(r.cmp.ic * 1000, 'mA', 2) + '): Die Vorgabe für r_aus ist so nicht erreichbar.', ziel: { text: 'r_aus ≤ ' + val(z, 'Ω'), soll: z } };
        const ist = r.sel.rout, g = B.fenster(CORE).g, y = B.fenster(CORE).y;
        const pct = ist <= z ? 0 : (ist - z) / z * 100;
        const ampel = pct <= g + 1e-9 ? 'gruen' : pct <= y + 1e-9 ? 'gelb' : 'rot';
        return { ok: ampel === 'gruen', ampel, margin: pct, ziel: { text: 'r_aus ≤ ' + val(z, 'Ω'), soll: z, ist, unit: 'Ω' },
          text: 'Ausgangswiderstand: ist ' + val(ist, 'Ω') + ', Vorgabe höchstens ' + val(z, 'Ω') + ', Überschreitung ' + fm(pct, 1) + ' % (grün bis ' + fm(g, 0) + ' %, gelb bis ' + fm(y, 0) + ' %; Lehrfaustwert, Übungswert F16).' };
      }
      if (r.mode === 'zener') {
        const row = pctRow('ue', 'Emitterspannung U_E', r.ueOut, z, 'V');
        return { ok: row.ampel === 'gruen', ampel: row.ampel, margin: row.margin, text: row.text, ziel: { text: 'U_E = ' + val(z, 'V'), soll: z, ist: r.ueOut, unit: 'V' } };
      }
      const ic = r.icOut * 1000, row = pctRow('ic', 'Strom I_C', ic, z, 'mA');
      return { ok: row.ampel === 'gruen', ampel: row.ampel, margin: row.margin, text: row.text, ziel: { text: 'I_C = ' + val(z, 'mA'), soll: z, ist: ic, unit: 'mA' } };
    }

    function diag(r, ctl) {
      if (!r.ok) {
        const id = r.mode === 'konstantstrom' ? 'cs-zu-wenig-dioden' : r.mode === 'zener' ? 'zener-ub-klein' : 'ungueltig';
        return [{ id, kind: 'error', text: r.why }];
      }
      const out = [], f = ctl.fehler;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      if (r.mode === 'signal') {
        const c = r.cmp, sel = r.sel;
        if (r.zustand === 'sperrt') push('sperrt', 'warn', 'Der Transistor leitet nicht: I_C = ' + val(c.ic * 1000, 'mA', 2) + '. Es gibt keine Verstärkung.');
        else if (r.zustand === 'saettigung') push('saettigung', 'warn', 'Der Transistor ist in der Sättigung: I_C = ' + val(c.ic * 1000, 'mA', 2) + '. Es gibt keine Verstärkung.');
        if (r.valid) {
          if (ctl.schaltung === 'kollektor' && sel.vu < 1) push('vu-kleiner-1', 'info', 'V_u = ' + val(sel.vu, '', 4) + ': knapp unter 1, nie darüber. Der Ausgang folgt dem Eingang, um U_BE = ' + val(CORE.limit('ube').value, 'V', 1) + ' tiefer im Gleichanteil.');
          if (sel.rout >= r.rlEff) push('rout-hoch', 'warn', 'Der Ausgangswiderstand r_aus = ' + eng(sel.rout, 'Ω') + ' ist nicht kleiner als R_L = ' + eng(r.rlEff, 'Ω') + ': Die Last erhält weniger als die Hälfte der Leerlaufspannung.');
          if (isNum(r.direktF) && r.direktF < 0.5 && Math.abs(sel.vus) > r.direktF) push('quelle-hochohmig', 'info', 'Die Quelle ist hochohmig gegen die Last: Der direkte Anschluss liefert nur ' + val(r.ue * r.direktF * 1000, 'mV', 2) + ' (' + val(r.direktF * 100, '%', 2) + ' der Quellenspannung), mit der Schaltung sind es ' + val(r.ue * Math.abs(sel.vus) * 1000, 'mV', 2) + '.');
        }
        if (sw.active) push('lastwechsel', 'info', 'Lastwechsel: R_L beträgt jetzt ' + eng(r.rlEff, 'Ω') + '; direkt an der Quelle liegen ' + val(r.ue * r.direktF * 1000, 'mV', 2) + ' an der Last.');
        if (f === 'r1 offen' || f === 'r2 offen') push(f === 'r1 offen' ? 'r1-offen' : 'r2-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): Die Basisspannung beträgt ' + val(CORE.tr.dc({ ub: r.cfg.ub, rc: KURZ, re: r.cfg.re1 + r.cfg.re2, b: r.cfg.b, basis: 'teiler', r1: r.cfg.r1, r2: r.cfg.r2 }).ubb, 'V', 2) + ' (' + (f === 'r1 offen' ? 'der Transistor sperrt' : 'die Basis liegt fast an U_B') + ').', true);
        if (f === 're offen') push('re-offen', 'warn', 'R_E ist offen (Fehlerfall der Simulation): Der Emitter hat keinen Weg nach Masse, I_C = ' + val(c.ic * 1000, 'mA', 3) + ', am Ausgang liegt kein Signal.', true);
        if (f === 'transistor defekt') push('defekt', 'error', 'Der Transistor ist defekt (Fehlerfall der Simulation, nur Übung): I_C = ' + val(c.ic * 1000, 'mA', 2) + '. Ein defekter Transistor wird ersetzt; hier wird nur das Messbild gelesen.', true);
        if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', 'Die Versorgung fehlt (Fehlerfall der Simulation): U_B ist nur ' + val(r.cfg.ub * 1000, 'mV', 0) + ', der Ausgang bleibt ohne Spannung.', true);
        if (f === 'koppel-c offen') push('koppel-c-offen', 'warn', 'Der Koppelkondensator ist offen (Fehlerfall der Simulation): Das Eingangssignal erreicht die Basis nicht, U_a ist null.', true);
        return out;
      }
      if (r.mode === 'zener') {
        if (r.ibOut > ctl.iz) push('z-iz-klein', 'warn', 'I_Z = ' + val(ctl.iz * 1000, 'mA', 1) + ' ist kleiner als der Basisstrom I_B = ' + val(r.ibOut * 1000, 'mA', 1) + ': Die Z-Diode hat nur wenig Strom, die Referenz wird weich.');
        if (f === 'r1 offen') push('r1-offen', 'warn', 'R_1 ist offen (Fehlerfall der Simulation): Die Z-Diode und die Basis erhalten keinen Strom, U_E = ' + val(0, 'V', 2) + ', I_C = 0 mA.', true);
        if (f === 're offen') push('re-offen', 'warn', 'R_E ist offen (Fehlerfall der Simulation): Es fließt kein Laststrom, I_C = 0 mA.', true);
        if (f === 'transistor defekt') push('defekt', 'error', 'Der Transistor ist defekt (Fehlerfall der Simulation, nur Übung): U_E = 0 V, I_C = 0 mA.', true);
        if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', 'Die Versorgung fehlt (Fehlerfall der Simulation): Alle Spannungen und Ströme sind null.', true);
        if (f === 'r2 offen' || f === 'koppel-c offen') push(f === 'r2 offen' ? 'r2-offen' : 'koppel-c-offen', 'info', 'Diese Schaltung hat hier kein ' + (f === 'r2 offen' ? 'R_2' : 'Koppelkondensator') + ': Der Fehlerfall ändert nichts.', true);
        return out;
      }
      if (f === 'r1 offen') push('r1-offen', 'warn', 'Der Widerstand der Diodenreihe ist offen (Fehlerfall der Simulation): Die Basis erhält keine Spannung, I_C = 0 mA.', true);
      if (f === 're offen') push('re-offen', 'warn', 'R_E ist offen (Fehlerfall der Simulation): Es fließt kein Strom, I_C = 0 mA.', true);
      if (f === 'transistor defekt') push('defekt', 'error', 'Der Transistor ist defekt (Fehlerfall der Simulation, nur Übung): I_C = 0 mA.', true);
      if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', 'Die Versorgung fehlt (Fehlerfall der Simulation): I_C = 0 mA.', true);
      if (f === 'r2 offen' || f === 'koppel-c offen') push(f === 'r2 offen' ? 'r2-offen' : 'koppel-c-offen', 'info', 'Diese Schaltung hat hier kein ' + (f === 'r2 offen' ? 'R_2' : 'Koppelkondensator') + ': Der Fehlerfall ändert nichts.', true);
      return out;
    }
    function befund(r, ctl) {
      if (!r.ok) return [];
      if (r.mode === 'signal') {
        const t = 'Messbefund: I_C = ' + val(r.cmp.ic * 1000, 'mA', 3) + (r.valid ? ', V_u = ' + val(r.sel.vu, '', 3) + ', U_a (Spitze) = ' + val(r.ue * Math.abs(r.sel.vus) * 1000, 'mV', 3) + ' bei U_e = ' + eng(r.ue, 'V') : ', keine Verstärkung messbar') + '; direkt an der Quelle: ' + (isNum(r.direktF) ? val(r.ue * r.direktF * 1000, 'mV', 3) : '–') + '.';
        return [{ id: 'befund', kind: 'info', text: t }];
      }
      if (r.mode === 'zener') return [{ id: 'befund', kind: 'info', text: 'Messbefund: U_E = ' + val(r.ueOut, 'V', 3) + ', I_C = ' + val(r.icOut * 1000, 'mA', 3) + ', I_B = ' + val(r.ibOut * 1e6, 'µA', 1) + '.' }];
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: I_C = ' + val(r.icOut * 1000, 'mA', 3) + '.' }];
    }

    const memo = new WeakMap();
    function curves(r, ctl) {
      if (!r.ok) return [];
      if (memo.has(r)) return memo.get(r);
      const out = curvesRaw(r, ctl); memo.set(r, out); return out;
    }
    function curvesRaw(r, ctl) {
      if (r.mode === 'signal') {
        if (ctl.schaltung !== 'kollektor' || !r.valid) return [];
        const c = r.cfg, dcr = CORE.tr.dc({ ub: c.ub, rc: KURZ, re: c.re1 + c.re2, b: c.b, basis: 'teiler', r1: c.r1, r2: c.r2, defekt: c.defekt });
        if (!dcr || dcr.ok === false) return [];
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const u = c.ub * i / 48, d = CORE.tr.dc({ ub: c.ub, rc: KURZ, re: c.re1 + c.re2, b: c.b, basis: 'rb', ubase: u, rb: dcr.rbth });
          if (d && d.ok !== false && isNum(d.ue)) pts.push([u, d.ue]);
        }
        const ref = [[0, 0], [c.ub, c.ub]];
        return [{ id: 'uebertragung', title: 'Übertragung des Emitterfolgers: U_E über der Basisspannung', xLabel: 'Basisspannung U_B,Basis', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a = U_E', yUnit: 'V',
          series: [{ name: 'U_a des Folgers', kind: 'out', points: pts }, { name: 'U_a = U_e (Vergleich)', kind: 'ref', points: ref }], marker: { x: dcr.ubb, y: dcr.ue, label: 'Arbeitspunkt' } }];
      }
      if (r.mode === 'zener') {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const uz = 2.4 + (Math.min(15, ctl.ub - 0.5) - 2.4) * i / 24;
          if (!(uz > 2.4 - 1e-9)) continue;
          const z = CORE.tr.zfolger({ ub: ctl.ub, uz, ic: ctl.ic, b: ctl.b, iz: ctl.iz });
          if (z && z.ok !== false) pts.push([uz, z.ue]);
        }
        if (pts.length < 2) return [];
        return [{ id: 'zener', title: 'Emitterspannung U_E über der Z-Spannung', xLabel: 'Z-Spannung U_Z', xUnit: 'V', xScale: 'lin', yLabel: 'Emitterspannung U_E', yUnit: 'V', series: [{ name: 'U_E', kind: 'out', points: pts }], marker: { x: ctl.uz, y: r.z.ue, label: 'Arbeitspunkt' } }];
      }
      const pts = [], ics = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
      ics.forEach(ic => { const s = CORE.tr.cs({ nd: ctl.nd, ud: ctl.ud, ic }); if (s && s.ok !== false) pts.push([s.re, ic * 1000]); });
      pts.sort((a, b) => a[0] - b[0]);
      if (pts.length < 2) return [];
      return [{ id: 'konstantstrom', title: 'Konstantstrom I_C über dem Emitterwiderstand R_E', xLabel: 'Emitterwiderstand R_E', xUnit: 'Ω', xScale: 'log', yLabel: 'Kollektorstrom I_C', yUnit: 'mA', series: [{ name: 'I_C', kind: 'i', points: pts }], marker: { x: r.s.re, y: ctl.ic * 1000, label: 'Arbeitspunkt' } }];
    }

    function waveform(r, ctl) {
      if (!r.ok || r.mode !== 'signal') return null;
      const f = ctl.f, T = 1 / f, k = T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 };
      const t = [], yq = [], ym = [], yd = [], N = 128;
      const gm = r.valid ? r.sel.vus : 0, gd = isNum(r.direktF) ? r.direktF : 0;
      for (let i = 0; i <= 2 * N; i++) {
        const ts = T * i / N, s = Math.sin(2 * Math.PI * f * ts);
        t.push(ts * k.k); yq.push(r.ue * s); ym.push(r.ue * gm * s); yd.push(r.ue * gd * s);
      }
      return { tUnit: k.u, t, series: [{ name: 'u_e (Quelle)', unit: 'V', kind: 'u', y: yq }, { name: 'u_a mit Schaltung', unit: 'V', kind: 'out', y: ym }, { name: 'u_a direkt', unit: 'V', kind: 'ref', y: yd }], marks: { span: [{ t0: 0, t1: T * k.k, name: 'T' }] } };
    }

    function state(r, ctl) {
      const zielEinheit = ctl.betrieb === 'signal' ? 'Ω' : ctl.betrieb === 'zener' ? 'V' : 'mA';
      if (!r.ok) return { valid: false, zustand: '', zustandCode: 0, text: 'Die Eingabe ist ungültig.', zielEinheit, sweep: sw.active, sweepP: sw.p };
      if (r.mode === 'signal') {
        const z = r.zustand;
        return { valid: r.valid, zustand: z, zustandCode: z === 'aktiv' ? 0 : z === 'sperrt' ? 1 : 2, text: r.valid ? 'Transistor aktiv: V_u = ' + val(r.sel.vu, '', 3) + ', r_aus = ' + eng(r.sel.rout, 'Ω') + '.' : 'Kein Kollektorstrom oder Sättigung: I_C = ' + val(r.cmp.ic * 1000, 'mA', 2) + '.',
          vu: r.valid ? r.sel.vu : 0, vus: r.valid ? r.sel.vus : 0, rin: r.valid ? r.sel.rin : 0, rout: r.valid ? r.sel.rout : 0, phase: r.valid ? r.sel.phase : 0, direktAnteil: isNum(r.direktF) ? r.direktF : 0, rlEff: r.rlEff, ic: r.cmp.ic, sweep: sw.active, sweepP: sw.p, zielEinheit };
      }
      if (r.mode === 'zener') return { valid: true, zustand: 'aktiv', zustandCode: 0, text: 'Z-Folger: U_E = ' + val(r.ueOut, 'V', 2) + ', I_C = ' + val(r.icOut * 1000, 'mA', 1) + '.', ue: r.ueOut, ic: r.icOut, r1: r.z.r1, ib: r.ibOut, sweep: false, sweepP: 0, zielEinheit };
      return { valid: true, zustand: 'aktiv', zustandCode: 0, text: 'Konstantstromquelle: I_C = ' + val(r.icOut * 1000, 'mA', 1) + ', R_E = ' + eng(r.s.re, 'Ω') + '.', ic: r.icOut, re: r.s.re, ure: r.s.ure, sweep: false, sweepP: 0, zielEinheit };
    }

    // ------------------------------------------------------------------- Zeichnen
    function wrapText(ctx, g, text, maxW, size, maxLines) {
      const words = String(text).split(' '), lines = []; let cur = '';
      ctx.font = g.font(size, false);
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines || 4);
    }
    function noData(ctx, g, rc, pal, msg) {
      g.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 6);
      wrapText(ctx, g, msg, rc.w - 16, 12, 3).forEach((ln, k) => g.text(ctx, ln, rc.x + 8, rc.y + 18 + k * 16, { size: 12, color: pal.mute, max: rc.w - 16 }));
    }
    function faultSpec(ctl, verdeckt) {
      if (verdeckt || ctl.fehler === 'keiner') return {};
      const sg = ctl.betrieb === 'signal';
      const m = { 'r1 offen': [sg ? 'r1' : 'rv'], 'r2 offen': sg ? ['r2'] : [], 're offen': sg ? ['re1', 're2'] : ['re'], 'transistor defekt': ['q'], 'versorgung fehlt': ['ub'], 'koppel-c offen': sg ? ['c1'] : [] }[ctl.fehler];
      if (!m || !m.length) return {};
      const nm = { 'r1 offen': 'R_1 offen', 'r2 offen': 'R_2 offen', 're offen': 'R_E offen', 'transistor defekt': 'Transistor defekt', 'versorgung fehlt': 'Versorgung fehlt', 'koppel-c offen': 'Koppelkondensator offen' }[ctl.fehler];
      return { fault: m.map(id => ({ id, type: id === 'q' || id === 'ub' ? 'defekt' : 'offen' })), faultText: 'Fehler (Simulation): ' + nm };
    }
    /** Verteilt die Hoehe auf Bilder: je Bild Mindesthoehe `min`, Gewicht `w`, Rang `p` (kleiner = wichtiger); was nicht passt, entfaellt. */
    function stackFit(x, y, wd, hh, items, gap) {
      const inc = []; let used = 0;
      items.slice().sort((a, b) => a.p - b.p).forEach(it => { const need = it.min + (inc.length ? gap : 0); if (used + need <= hh) { inc.push(it); used += need; } });
      const vis = items.filter(it => inc.indexOf(it) >= 0), extra = hh - used, tw = vis.reduce((q, it) => q + it.w, 0) || 1, out = {};
      let cy = y;
      vis.forEach((it, i) => { const h0 = it.min + (i === vis.length - 1 ? 0 : Math.floor(extra * it.w / tw)); out[it.key] = { x, y: cy, w: wd, h: i === vis.length - 1 ? y + hh - cy : h0 }; cy += h0 + gap; });
      return out;
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, g = sc.gfx, gap = 8, ctl = view.ctl, hid = view.verdeckt;
      if (!r || !r.ok) {
        wrapText(ctx, g, (r && r.why && !hid ? r.why : 'Die Eingabe ist ungültig.'), R0.w - 16, 13, 4).forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - (chipsH ? gap : 0), sg = r.mode === 'signal';
      let P;
      if (R0.w >= 680) {
        const lw = Math.round(R0.w * 0.42), rw = R0.w - lw - gap;
        P = Object.assign(stackFit(R0.x, R0.y, lw, bodyH, [{ key: 'sch', min: 110, w: 0.62, p: 1 }, { key: 'strip', min: 56, w: 0.38, p: 2 }], gap),
          stackFit(R0.x + lw + gap, R0.y, rw, bodyH, sg ? [{ key: 'kenn', min: 140, w: 0.4, p: 2 }, { key: 'sig', min: 140, w: 0.34, p: 3 }, { key: 'cmpR', min: 110, w: 0.26, p: 4 }] : [{ key: 'kenn', min: 140, w: 0.7, p: 2 }, { key: 'sig', min: 60, w: 0.3, p: 3 }], gap));
      } else {
        P = stackFit(R0.x, R0.y, R0.w, bodyH, sg ? [{ key: 'sch', min: 110, w: 0.27, p: 1 }, { key: 'kenn', min: 140, w: 0.25, p: 2 }, { key: 'sig', min: 140, w: 0.22, p: 3 }, { key: 'cmpR', min: 110, w: 0.14, p: 5 }, { key: 'strip', min: 56, w: 0.12, p: 4 }]
          : [{ key: 'sch', min: 110, w: 0.32, p: 1 }, { key: 'kenn', min: 140, w: 0.36, p: 2 }, { key: 'strip', min: 56, w: 0.32, p: 3 }], gap);
      }
      const sch = P.sch, kenn = P.kenn, sig = P.sig, cmpR = P.cmpR, strip = P.strip;
      const fs = faultSpec(ctl, hid);
      const L = {}, vals = {};
      let kind = 'kollektor';
      if (sg) {
        kind = ctl.schaltung;
        vals.r1 = eng(ctl.r1, 'Ω'); vals.r2 = eng(ctl.r2, 'Ω'); vals.rc = eng(ctl.rc, 'Ω'); vals.re1 = eng(ctl.re1, 'Ω'); vals.re2 = eng(ctl.re2, 'Ω'); vals.rg = eng(ctl.rg, 'Ω'); vals.rl = ctl.rl >= 1e6 ? 'offen' : eng(r.rlEff, 'Ω');
        L.ub = 'U_B = ' + val(ctl.ub, 'V', 1); L.ue = 'U_e = ' + eng(r.ue, 'V'); L.ua = 'U_a = ' + eng(r.valid ? r.ue * Math.abs(r.sel.vus) : 0, 'V'); L.ic = 'I_C = ' + eng(r.cmp.ic, 'A');
      } else if (r.mode === 'zener') {
        kind = 'zfolger'; vals.rv = eng(r.z.r1, 'Ω'); vals.uz = 'U_Z = ' + val(ctl.uz, 'V', 1); vals.rl = 'Last';
        L.ub = 'U_B = ' + val(ctl.ub, 'V', 1); L.ib = 'I_B = ' + eng(r.ibOut, 'A'); L.ua = 'U_E = ' + val(r.ueOut, 'V', 2); L.ube = 'U_BE = ' + val(CORE.limit('ube').value, 'V', 1);
      } else {
        kind = 'konstantstrom'; vals.rv = 'R_V'; vals.re = eng(r.s.re, 'Ω'); vals.rl = 'Last';
        L.ub = 'U_B = ' + val(ctl.ub, 'V', 1); L.ic = 'I_C = ' + eng(r.icOut, 'A'); L.ure = 'U_RE = ' + val(r.s.ure, 'V', 2);
      }
      if (sch && !sc.view('schematic', sch, Object.assign({ kind, values: vals, labels: L }, fs), {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
      const cv = view.rig.curves();
      if (!kenn) { /* kein Platz */ } else if (cv.length) sc.view('curve', kenn, cv[0], {}); else noData(ctx, g, kenn, pal, sg ? (r.valid ? 'Für die Basisschaltung und die Emitterschaltung zeigt das Bild nur den Vergleich (F8).' : 'Keine Kennlinie: Der Transistor ist nicht aktiv.') : 'Keine Kennlinie für diese Werte.');
      if (sg) {
        const wf = view.rig.waveform ? view.rig.waveform() : null;
        if (wf && sig) sc.view('scope', sig, wf, {});
        if (cmpR) {
          const items = []; const m = view.rig.readMeters();
          if (r.valid && okc(r.cmpE) || r.valid) { items.push({ name: 'Emitter', value: Math.abs(m.vuE), unit: '', kind: 'u' }, { name: 'Kollektor', value: Math.abs(m.vuK), unit: '', kind: 'out' }, { name: 'Basis', value: Math.abs(m.vuB), unit: '', kind: 'i' }); }
          if (items.length && !sc.view('bar', cmpR, { items, label: 'Grundschaltung', unit: '', title: 'Betrag |V_u| der drei Grundschaltungen (gleicher Arbeitspunkt)' }, {})) noData(ctx, g, cmpR, pal, 'Vergleich der Grundschaltungen.');
          else if (!items.length) noData(ctx, g, cmpR, pal, 'Kein Vergleich: Der Transistor ist nicht aktiv.');
        }
      } else if (sig && sig.h >= 30) noData(ctx, g, sig, pal, r.mode === 'zener' ? 'Kein Zeitverlauf: Gleichgrößen. Die Z-Diode hält die Basisspannung, der Emitter folgt um U_BE tiefer.' : 'Kein Zeitverlauf: Gleichgrößen. Der Strom ist durch die Diodenreihe und R_E eingeprägt.');
      if (strip) {
        g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
        const rows = [];
        if (sg) {
          rows.push({ t: SICHT.formel, bold: true, color: pal.fg });
          if (r.valid) {
            rows.push({ t: ctl.schaltung === 'kollektor' ? 'V_u = ' + val(r.sel.vu, '', 4) + ' (knapp unter 1), r_ein = ' + eng(r.sel.rin, 'Ω') + ', r_aus = ' + eng(r.sel.rout, 'Ω') : 'V_u = ' + val(r.sel.vu, '', 2).replace('-', MINUS) + ', r_ein = ' + eng(r.sel.rin, 'Ω') + ', r_aus = ' + eng(r.sel.rout, 'Ω'), color: pal.fg });
            rows.push({ t: 'Last: direkt ' + val(r.ue * r.direktF * 1000, 'mV', 2) + ', mit Schaltung ' + val(r.ue * Math.abs(r.sel.vus) * 1000, 'mV', 2), color: pal.mute });
          } else rows.push({ t: 'Die Formel gilt nur im aktiven Bereich: I_C = ' + val(r.cmp.ic * 1000, 'mA', 2) + '.', color: pal.mute });
        } else if (r.mode === 'zener') {
          rows.push({ t: 'R_1 = (U_B − U_Z) / (I_Z + I_C / B), U_E = U_Z − U_BE', bold: true, color: pal.fg });
          rows.push({ t: 'R_1 = ' + eng(r.z.r1, 'Ω') + ', I_B = ' + val(r.z.ib * 1000, 'mA', 2) + ', U_E = ' + val(r.z.ue, 'V', 2), color: pal.fg });
        } else {
          rows.push({ t: 'R_E = (n_D · U_D − U_BE) / I_C', bold: true, color: pal.fg });
          rows.push({ t: 'R_E = ' + eng(r.s.re, 'Ω') + ' bei U_RE = ' + val(r.s.ure, 'V', 2) + ' und I_C = ' + val(ctl.ic * 1000, 'mA', 1), color: pal.fg });
        }
        g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
      }
      if (chipsH) {
        const y = R0.y + bodyH + gap, m = view.rig.readMeters();
        const items = sg ? [['V_u', r.valid ? val(m.vu, '', 3) : '–'], ['r_aus', r.valid ? eng(m.rout, 'Ω') : '–'], ['direkt', val(m.direkt, 'mV', 1)], ['mit', val(m.mit, 'mV', 1)]]
          : r.mode === 'zener' ? [['U_E', val(m.ues, 'V', 2)], ['R_1', eng(m.r1z, 'Ω')], ['I_B', val(m.ibz / 1000, 'mA', 2)], ['I_C', val(m.ic, 'mA', 1)]] : [['R_E', eng(m.reK, 'Ω')], ['I_C', val(m.ic, 'mA', 2)], ['U_RE', val(r.s.ure, 'V', 2)], ['n_D', fm(ctl.nd, 0)]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }

    return {
      compute, meters, assess, diag, befund, curves, waveform, state, draw,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say('Der Lastwechsel ist beendet: R_L = ' + eng(ctl.rl, 'Ω') + '.', 'info'); P0.bump(); return; }
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 0; P0.say('Der Lastwechsel wurde abgebrochen.', 'info'); P0.bump(); return true; }
        if (ctl.betrieb !== 'signal') { P0.say('Der Lastwechsel gehört zur Betriebsart Signalverstärkung; wähle sie zuerst.', 'warn'); return false; }
        if (!r.ok || !r.valid) { P0.say('Mit diesen Werten gibt es keinen Lastwechsel zu zeigen: Der Transistor ist nicht im aktiven Bereich.', 'warn'); return false; }
        if (!(ctl.rl < 1e4)) { P0.say('Der eingestellte Lastwiderstand ' + eng(ctl.rl >= 1e6 ? OFFEN : ctl.rl, 'Ω') + ' ist nicht kleiner als 10 kΩ: Es gibt keinen Lastwechsel.', 'info'); return true; }
        sw.active = true; sw.p = 0;
        P0.say('Lastwechsel: R_L fällt von 10 kΩ auf ' + eng(ctl.rl, 'Ω') + '. Vergleiche die Spannung an der Last direkt und mit dem Folger.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; }
    };
  }

  R.register({ id: 'folger', name: 'Kollektorschaltung und Grundschaltungen', icon: '🔁', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'folger', name: 'Kollektorschaltung und Grundschaltungen', icon: '🔁', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
