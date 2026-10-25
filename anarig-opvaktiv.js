/* anarig-opvaktiv.js - ANA-Lab (WP2d): Pruefstand 8 `opv_aktiv` - Integrierer, Differenzierer, aktive Filter und realer Operationsverstaerker (SPEC 5.8).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.act.integrator / differentiator / tp / hp / response / wave, ANA_CORE.op.inv / freq / wave / grenzen, ANA_CORE.deep.bode / slew / offset / sat, ANA_CORE.limit).
 * Reine Darstellung (keine Physik): Zeitachse in Einheiten, Abschnitte "Begrenzen" und "Slew-Rate" aus den Kernkurven, Wahl des Frequenzrasters um die Knickfrequenz.
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteilwerte sind Uebungswerte (Uebungsschaltung).
 * Modell: aktive Filter erster Ordnung, invertierend, ideal; Integrierer mit optionalem Parallelwiderstand R_p, Differenzierer mit optionalem Serienwiderstand R_s (F12, F13); realer OPV (Schaltung `real`)
 *   mit einem Pol (GBW, Slew-Rate, Offsetspannung, Aussteuergrenze), ohne Eingangsstroeme. Integrierer, Differenzierer und die Filter rechnen den Operationsverstaerker ideal (nur Aussteuergrenze).
 * Steuerwerte (SI): schaltung, opv, uv (V), form, ue (V, Gleichwert bzw. Amplitude), f (Hz), r1 (Ohm), rf (Ohm; Integrierer: Parallelwiderstand R_p, oberer Anschlag 100 MOhm = ohne), c (F),
 *   rs (Ohm, nur Differenzierer, unterer Anschlag 1 Ohm = ohne), fehler, zielF (Hz), Taste fire (Start).
 *   Schaltungswechsel: waehlt man eine andere Schaltung als den Integrierer und steht rf noch am Anschlag (>= 10 MOhm), setzt die Anlage rf auf 100 kOhm (sonst wuerde das Filter in der Saettigung stehen).
 *   r1 gilt nicht fuer den Differenzierer, c nicht fuer `real`, rf als R_p nur beim Integrierer: nicht benutzte Regler sind ausgeblendet.
 * Messgeraete: ua (V, aktuell), uaPeak (V), tau (ms), slope (V/s), fg (Hz), fpb (kHz, Vollaussteuerungsbandbreite f_max = SR/(2 pi U_sat)), uosOut (mV), tsat (s), v (Verstaerkung im Durchlassbereich, negativ),
 *   hf (Betrag |V| bei f). 0 = nicht definiert (zeroIsNone), "unendlich" ab 1e11 (idealer OPV: fg bei `real`, fpb).
 * Fehlerfall-Umsetzung (vor dem Kernaufruf): c offen -> c := 1e-12 F, rp offen -> rf := R_OFFEN (ohne R_p), r1 offen -> r1 := R_OFFEN, versorgung minus fehlt -> uvn := 0, versorgung fehlt -> uv, uvn := 0;
 *   ein Fehler, den die Schaltung nicht hat (z. B. R_p beim Tiefpass), aendert nichts und sagt das.
 * Ampel (nur mit Vorgabe zielF): Grenzfrequenz (Integrierer ohne R_p und Differenzierer ohne R_s: Frequenz mit |V| = 1) innerhalb 2 % gruen, bis 5 % gelb (Operationsverstaerker-Fenster, Uebungswert F16).
 * fire(): Start - der Kondensator ist entladen, der Eingang springt an, der Ausgang laeuft los (die Kurve baut sich auf); ein zweiter Druck bricht ab.
 * Zusaetze fuer die Oberflaeche: rig.deepInfo() -> { bode, slew, offset, sat } (je { id, title, valid, text | why, ...Zahlen }) und rig.drawDeep(name, ctx, w, h, opts) fuer die vier aufklappbaren Vertiefungen.
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-opvaktiv.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, eng, val, fm } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12;
  const MINUS = '−';
  const NW = 256;                  // Punkte je Periode
  const START_S = 6;               // Dauer des Starts (s, Zeitlupe verlaengert)
  const INF = 1e12;                // "unendlich" fuer Messgeraete
  const RP_OHNE = 1e8 * (1 - 1e-9); // ab hier gilt der Parallelwiderstand des Integrierers als "ohne"
  const MODELL = 'Modell: Aktive Filter erster Ordnung, invertierend, ideal gerechnet; Integrierer mit optionalem Parallelwiderstand R_p, Differenzierer mit optionalem Serienwiderstand R_s (F12, F13). Der reale Operationsverstärker (Schaltung real) hat einen Pol mit Verstärkungs-Bandbreite-Produkt (GBW), Slew-Rate, Offsetspannung und Aussteuergrenze (Übungswerte F9, F10), ohne Eingangsströme. Die Vertiefungen Bode-Diagramm, Slew-Rate, Offsetspannung und Sättigung stehen unter dem Bild. ' + (T0.vertiefungHinweis || '');

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const when = (key, vals) => ({ visible: st => !st || vals.indexOf(st[key]) >= 0 });
  const SCH = [['integrierer', 'Integrierer'], ['differenzierer', 'Differenzierer'], ['tiefpass', 'Aktiver Tiefpass'], ['hochpass', 'Aktiver Hochpass'], ['real', 'Realer Operationsverstärker (Verstärker)']];
  const FEHLER = [['keiner', 'kein Fehler'], ['c offen', 'Kondensator C offen'], ['rp offen', 'Parallelwiderstand R_p offen'], ['r1 offen', 'R_1 offen'], ['versorgung minus fehlt', 'negative Versorgung fehlt'], ['versorgung fehlt', 'Versorgung fehlt']];
  const CONTROLS = B.fillControls([
    { key: 'schaltung', label: 'Schaltung', type: 'select', value: 'integrierer', options: opt(SCH), gruppe: 'bauteile', sicht: 'formel',
      help: 'Wählt die Schaltung: Integrierer (Rampe, Rechteck wird Dreieck), Differenzierer (Dreieck wird Rechteck, Rechteck wird Nadeln), aktiver Tiefpass oder Hochpass erster Ordnung oder der reale Operationsverstärker als Verstärker mit GBW, Slew-Rate und Offset.' },
    { key: 'opv', label: 'Operationsverstärker', type: 'select', value: 'ideal', options: opt([['ideal', 'ideal (unbegrenzt schnell)'], ['langsam', 'real, langsam (GBW 1 MHz)'], ['schnell', 'real, schnell (GBW 3 MHz)']]), gruppe: 'ziel', sicht: 'formel',
      help: 'Modell des Operationsverstärkers: ideal oder real (langsam, schnell) mit Verstärkungs-Bandbreite-Produkt, Slew-Rate, Offsetspannung und Aussteuergrenze (Übungswerte, F9, F10). Voll wirksam in der Schaltung real; bei Integrierer und Filtern wirken Aussteuergrenze und Offset.' },
    { key: 'uv', label: 'Betriebsspannung (±)', type: 'slider', scale: 'lin', min: 5, max: 18, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betrag der symmetrischen Betriebsspannung ±U_v (Kleinspannung, Übungswert F10). Sie bestimmt die Aussteuergrenze ±U_sat, bei der der Ausgang begrenzt wird, und damit die Zeit bis zur Sättigung des Integrierers.' },
    { key: 'form', label: 'Eingangsform', type: 'select', value: 'rechteck', options: opt([['gleich', 'Gleichspannung'], ['sinus', 'Sinus'], ['rechteck', 'Rechteck'], ['dreieck', 'Dreieck']]), gruppe: 'quelle', sicht: 'signal',
      help: 'Form der Eingangsspannung U_e. Der Integrierer macht aus Rechteck ein Dreieck, der Differenzierer aus Dreieck ein Rechteck; bei Gleichspannung zeigt der Integrierer die Rampe bis zur Sättigung.' },
    { key: 'ue', label: 'Eingangsspannung (Gleichwert bzw. Amplitude)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.1, unit: 'V', unitKind: 'V', value: 2, gruppe: 'quelle', sicht: 'signal',
      help: 'Eingangsspannung: bei Gleichspannung der Wert, sonst die Amplitude (Spitzenwert). Beim Integrierer bestimmt sie die Steigung −U_e/(R·C); bei U_e = 0 bleibt nur die Offset-Drift.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 0.1, max: 1e6, step: 0.1, unit: 'Hz', unitKind: 'Hz', value: 5, gruppe: 'quelle', sicht: 'signal',
      help: 'Frequenz der Eingangsspannung. Sie bestimmt den Zeitmaßstab des Verlaufs und den Betrag |V| bei dieser Frequenz im Frequenzgang; im Zeitbild ist eine Periode zu sehen.' },
    { key: 'r1', label: 'Eingangswiderstand R1', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 100000, gruppe: 'bauteile', sicht: 'formel', visible: st => !st || st.schaltung !== 'differenzierer',
      help: 'Eingangswiderstand R_1 (beim Integrierer R). Beim Integrierer bestimmt R·C die Zeitkonstante; beim Tiefpass und Verstärker bestimmt R_f/R_1 die Verstärkung, beim Hochpass auch die Grenzfrequenz. Übungswert.' },
    { key: 'rf', label: 'Rückkopplungswiderstand Rf (Integrierer: parallel zu C, oberer Anschlag = ohne)', type: 'slider', scale: 'log', min: 100, max: 1e8, step: 10, unit: 'Ω', unitKind: 'Ω', value: 1e8, gruppe: 'bauteile', sicht: 'formel',
      help: 'Rückkopplungswiderstand R_f. Beim Integrierer ist er der Parallelwiderstand R_p zum Kondensator (oberer Anschlag 100 MΩ = ohne R_p, dann driftet der Ausgang); beim Differenzierer, bei den Filtern und bei real der Rückkopplungswiderstand. Übungswert.' },
    { key: 'c', label: 'Kondensator C', type: 'slider', scale: 'log', min: 1e-10, max: 1e-4, step: 1e-10, unit: 'F', unitKind: 'F', value: 1e-6, gruppe: 'bauteile', sicht: 'signal', visible: st => !st || st.schaltung !== 'real',
      help: 'Kondensator C des Integrierers, Differenzierers oder Filters. Ein größeres C verkleinert beim Integrierer die Steigung −U_e/(R·C) und senkt beim Tiefpass die Grenzfrequenz 1/(2π·R_f·C_f). Übungswert.' },
    { key: 'rs', label: 'Serienwiderstand Rs (Differenzierer, unterer Anschlag = ohne)', type: 'slider', scale: 'log', min: 1, max: 1e5, step: 1, unit: 'Ω', unitKind: 'Ω', value: 1, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['differenzierer']),
      help: 'Serienwiderstand R_s in Reihe zum Kondensator des Differenzierers (unterer Anschlag 1 Ω = ohne R_s). Er begrenzt die Verstärkung bei hohen Frequenzen auf R_f/R_s ab f = 1/(2π·R_s·C). Übungswert.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): Kondensator, Parallelwiderstand R_p oder R_1 offen, negative Versorgung oder Versorgung fehlt. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'zielF', label: 'Vorgabe Grenzfrequenz (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 1e5, step: 1, unit: 'Hz', unitKind: 'Hz', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für die Grenzfrequenz f_g (Integrierer ohne R_p und Differenzierer ohne R_s: Frequenz mit |V| = 1). Bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16).' },
    { key: 'fire', label: 'Start', type: 'button', gruppe: 'ziel', sicht: 'signal',
      help: 'Startet die Schaltung: Der Kondensator ist entladen, der Eingang springt an und der Ausgang läuft los (Rampe, Abklingen, Begrenzen). Die Kurve baut sich in der Zeitlupe auf. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'ua', label: 'Ausgangsspannung U_a (aktuell)', unit: 'V', digits: 3, min: -20, max: 20, help: 'Aktuelle Ausgangsspannung bei der gerade gezeigten Phase des Verlaufs (Zeitlupe) oder beim Start.' },
    { key: 'uaPeak', label: 'Ausgangsspitze', unit: 'V', digits: 3, min: 0, max: 20, help: 'Größter Betrag der Ausgangsspannung im gezeigten Verlauf. Liegt er bei der Aussteuergrenze U_sat, wird der Ausgang begrenzt.' },
    { key: 'tau', label: 'Zeitkonstante τ', unit: 'ms', digits: 4, min: 0, max: 1e6, zeroIsNone: true, help: 'Zeitkonstante: Integrierer τ = R·C, Differenzierer τ = R_f·C, Filter τ = R_f·C_f bzw. R_1·C_1, real τ = 1/(2π·f_g).' },
    { key: 'slope', label: 'Steigung −U_e/(R·C)', unit: 'V/s', digits: 3, min: -1e7, max: 1e7, zeroIsNone: true, help: 'Steigung der Ausgangsspannung des Integrierers bei Gleichspannung am Eingang: −U_e/(R·C). Nur für den Integrierer definiert.' },
    { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz', digits: 4, min: 0, max: 1e7, zeroIsNone: true, help: 'Grenzfrequenz der Schaltung (−3 dB): Integrierer mit R_p, Differenzierer mit R_s, Filter, real aus GBW/V_n. Beim idealen Operationsverstärker ist sie bei real unbegrenzt (∞); ohne R_p und R_s gibt es keine.' },
    { key: 'fpb', label: 'Vollaussteuerungsbandbreite f_max', unit: 'kHz', digits: 4, min: 0, max: 1e5, zeroIsNone: true, help: 'Vollaussteuerungsbandbreite f_max = SR/(2π·U_sat): höchste Frequenz, bei der ein Sinus mit voller Ausgangsamplitude noch nicht durch die Slew-Rate verformt wird. Ideal unbegrenzt (∞).' },
    { key: 'uosOut', label: 'Offsetspannung am Ausgang U_a,off', unit: 'mV', digits: 3, min: 0, max: 5000, zeroIsNone: true, help: 'Ausgang bei U_e = 0 durch die Offsetspannung: U_a,off = U_os·(1 + R_f/R_1), beim Integrierer mit R_p der Endwert U_os·(1 + R_p/R). Ohne R_p driftet der Ausgang stattdessen (Steigung U_os/(R·C)).' },
    { key: 'tsat', label: 'Zeit bis Sättigung', unit: 's', digits: 4, min: 0, max: 1e9, zeroIsNone: true, help: 'Zeit, bis der Ausgang des Integrierers (ohne R_p) die Aussteuergrenze erreicht: U_sat/|Steigung|, bei U_e = 0 durch die Offset-Drift. 0 = erreicht den Anschlag nicht.' },
    { key: 'v', label: 'Verstärkung V (Durchlassbereich)', unit: '', digits: 4, min: -1000, max: 1000, zeroIsNone: true, help: 'Spannungsverstärkung im Durchlassbereich, negativ wegen der Invertierung: Tiefpass V_0 = −R_f/R_1, Hochpass V_∞ = −R_f/R_1, Integrierer mit R_p V_0 = −R_p/R, real die Verstärkung mit endlichem GBW. Beim Differenzierer nicht definiert.' },
    { key: 'hf', label: 'Betrag |V| bei f', unit: '', digits: 4, min: 0, max: 1e6, zeroIsNone: true, help: 'Betrag der Spannungsverstärkung bei der eingestellten Frequenz f: Integrierer 1/(2π·f·R·C), Differenzierer 2π·f·R_f·C, Filter und real aus dem Frequenzgang.' }
  ];
  const SICHT = { kennlinie: 'Frequenzgang des Betrags (Bode, Vertiefung) und Aussteuergrenzen', signal: 'Eingang und Ausgang über der Zeit', formel: 'U_a = −(1 / (R · C)) · ∫ U_e dt' };
  const INFO = 'Integrierer, Differenzierer, aktive Filter erster Ordnung und der reale Operationsverstärker mit GBW, Slew-Rate, Offsetspannung und Sättigung (vier aufklappbare Vertiefungen). ' + MODELL;

  const PRESETS = [
    { id: 'integrierer', name: 'Integrierer (Pool W2023-16)', info: 'Übungsschaltung (Pool W2023-16): ' + K(c => { const a = c.act.integrator({ r: 1e5, c: 1e-6, ue: 2, f: 5, uv: 12 }); return 'Mit R = 100 kΩ, C = 1 µF und U_e = 2 V ist die Steigung ' + val(a.slope, 'V/s', 1) + '; die Sättigung bei ±12 V ist nach ' + val(a.tSat, 's', 2) + ' erreicht.'; }),
      controls: { schaltung: 'integrierer', form: 'gleich', ue: 2, r1: 100000, c: 1e-6, rf: 1e8 } },
    { id: 'integrierer-rp', name: 'Integrierer mit Parallelwiderstand', info: 'Übungsschaltung: ' + K(c => { const a = c.act.integrator({ r: 1e5, c: 1e-6, rp: 1e6, ue: 2, f: 5, uv: 12 }); return 'Mit R_p = 1 MΩ parallel zu C hat der Integrierer unterhalb von f_g = ' + val(a.fgRp, 'Hz', 3) + ' die Gleichstromverstärkung V_0 = ' + val(a.v0, '', 1) + ' statt unbegrenzt; der Ausgang driftet nicht mehr in die Sättigung.'; }),
      controls: { schaltung: 'integrierer', form: 'rechteck', ue: 2, f: 5, rf: 1e6 } },
    { id: 'differenzierer', name: 'Differenzierer', info: 'Übungsschaltung: ' + K(c => { const d = c.act.differentiator({ rf: 1e4, c: 1e-7, rs: 100, f: 100 }); return 'Mit R_f = 10 kΩ, C = 100 nF und R_s = 100 Ω ist τ = R_f·C = ' + val(d.tau * 1000, 'ms', 2) + '; |V| bei 100 Hz ist ' + val(d.vf, '', 3) + ', die Verstärkung wird oberhalb von ' + val(d.fgRs / 1000, 'kHz', 2) + ' begrenzt.'; }),
      controls: { schaltung: 'differenzierer', form: 'dreieck', ue: 1, f: 100, r1: 10000, rf: 10000, c: 100e-9, rs: 100 } },
    { id: 'tp-1khz', name: 'Aktiver Tiefpass 1 kHz', info: 'Übungsschaltung: ' + K(c => { const t = c.act.tp({ r1: 1e4, rf: 1e5, cf: 1.59e-9 }); return 'Mit R_1 = 10 kΩ, R_f = 100 kΩ und C_f = 1,59 nF ist V_0 = ' + val(t.v0, '', 1) + ' und die Grenzfrequenz f_g = ' + val(t.fg, 'Hz', 1) + '.'; }),
      controls: { schaltung: 'tiefpass', form: 'sinus', ue: 0.5, f: 1000, r1: 10000, rf: 100000, c: 1.59e-9 } },
    { id: 'hp-1khz', name: 'Aktiver Hochpass 1 kHz', info: 'Übungsschaltung: ' + K(c => { const t = c.act.hp({ r1: 1e4, rf: 1e5, c1: 15.9e-9 }); return 'Mit R_1 = 10 kΩ, R_f = 100 kΩ und C_1 = 15,9 nF ist V_∞ = ' + val(t.vInf, '', 1) + ' und die Grenzfrequenz f_g = ' + val(t.fg, 'Hz', 1) + '.'; }),
      controls: { schaltung: 'hochpass', form: 'sinus', ue: 0.5, f: 1000, r1: 10000, rf: 100000, c: 15.9e-9 } },
    { id: 'real-gbw', name: 'Realer OPV: Bode und GBW', info: 'Vertiefung Bode (Übungswerte F9): ' + K(c => { const b = c.deep.bode({ art: 'inv', r1: 1e4, rf: 1e5, opv: 'langsam' }); return b.text; }),
      controls: { schaltung: 'real', opv: 'langsam', form: 'sinus', ue: 0.1, f: 90919, r1: 10000, rf: 100000 } },
    { id: 'real-slew', name: 'Realer OPV: Slew-Rate', info: 'Vertiefung Slew-Rate (Übungswerte F9): ' + K(c => { const s = c.deep.slew({ opv: 'langsam', uhat: 10, f: 20000 }); return s.text; }),
      controls: { schaltung: 'real', opv: 'langsam', form: 'sinus', ue: 1, f: 20000, r1: 1000, rf: 10000 } },
    { id: 'offset-drift', name: 'Offset-Drift und Sättigung', info: 'Vertiefungen Offsetspannung und Sättigung (Übungswerte F9): ' + K(c => { const a = c.act.integrator({ r: 1e5, c: 1e-6, ue: 0, f: 5, uv: 12, opv: 'langsam' }); return 'Der Integrierer ohne R_p driftet mit ' + val(a.drift, 'V/s', 3) + ' und steht nach ' + val(a.tSatOff, 's', 0) + ' in der Sättigung.'; }),
      controls: { schaltung: 'integrierer', opv: 'langsam', form: 'gleich', ue: 0, r1: 100000, c: 1e-6, rf: 1e8 } }
  ];

  const FN = { 'c offen': 'Der Kondensator ist offen', 'rp offen': 'R_p ist offen', 'r1 offen': 'R_1 ist offen', 'versorgung minus fehlt': 'Die negative Versorgung fehlt', 'versorgung fehlt': 'Die Versorgung fehlt' };
  const tScale = T => (T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : T >= 1e-6 ? { u: 'µs', k: 1e6 } : { u: 'ns', k: 1e9 });

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0 };
    let ph = 0;
    const memoW = new WeakMap(), memoC = new WeakMap(), memoD = new WeakMap();
    const wrapOk = a => a && a.ok !== false;
    const applies = (f, sch) => (f === 'c offen' ? sch !== 'real' : f === 'rp offen' ? sch === 'integrierer' : f === 'r1 offen' ? sch !== 'differenzierer' : true);
    const GBASE = ctl => ({ opv: ctl.opv });

    function compute(ctl) {
      const sch = ctl.schaltung, f = ctl.fehler, act = f !== 'keiner' && applies(f, sch);
      let uv = ctl.uv, uvn = ctl.uv;
      if (act && f === 'versorgung minus fehlt') uvn = 0;
      if (act && f === 'versorgung fehlt') { uv = 0; uvn = 0; }
      const r1 = act && f === 'r1 offen' ? OFFEN : ctl.r1, c = act && f === 'c offen' ? 1e-12 : ctl.c;
      const rpAus = act && f === 'rp offen';
      const rp = sch === 'integrierer' && !rpAus && ctl.rf < RP_OHNE ? ctl.rf : undefined;
      const rs = sch === 'differenzierer' && ctl.rs > 1 ? ctl.rs : undefined;
      const base = { opv: ctl.opv, uv, uvn };
      const g = CORE.op.grenzen(base);
      if (!wrapOk(g)) return { ok: false, why: (g && g.why) || 'Die Eingabe ist ungültig.' };
      const o = { ok: true, sch, f, act, base, g, usat: g.p, usatN: g.n, ideal: ctl.opv === 'ideal', r1, c, rp, rs, rf: ctl.rf, ctl: Object.assign({}, ctl), nosup: !(g.p > 0 || g.n > 0), core: null, resp: null, fr: null, sr: NaN };
      let cfgR = null, fc = 1000, a;
      if (sch === 'integrierer') {
        a = CORE.act.integrator(Object.assign({ r: r1, c, rp, ue: ctl.ue, f: ctl.f }, base));
        cfgR = { art: 'integrierer', r: r1, c, rp }; fc = isNum(a.fgRp) ? a.fgRp : a.fRef;
      } else if (sch === 'differenzierer') {
        a = CORE.act.differentiator({ rf: ctl.rf, c, rs, f: ctl.f });
        cfgR = { art: 'differenzierer', rf: ctl.rf, c, rs }; fc = isNum(a.fgRs) ? a.fgRs : a.fRef;
      } else if (sch === 'tiefpass') {
        a = CORE.act.tp({ r1, rf: ctl.rf, cf: c }); cfgR = { art: 'tp', r1, rf: ctl.rf, cf: c }; fc = a.fg;
      } else if (sch === 'hochpass') {
        a = CORE.act.hp({ r1, rf: ctl.rf, c1: c }); cfgR = { art: 'hp', r1, rf: ctl.rf, c1: c }; fc = a.fg;
      } else {
        a = CORE.op.inv(Object.assign({ r1, rf: ctl.rf, ue: ctl.ue, f: ctl.f }, base));
      }
      if (!wrapOk(a)) return { ok: false, why: (a && a.why) || 'Die Eingabe ist ungültig.' };
      o.core = a;
      if (cfgR) {
        if (!(fc >= 1e-3 && fc <= 1e9)) fc = 1000;
        o.fc = fc;
        o.resp = CORE.act.response(cfgR, [ctl.f]);
        o.grid = CORE.grid(fc, 61, 2, 2);
        o.curve = CORE.act.response(cfgR, o.grid);
      } else {
        o.fr = CORE.op.freq(Object.assign({ art: 'inv', r1, rf: ctl.rf }, base), [ctl.f]);
        o.bode = CORE.deep.bode(Object.assign({ art: 'inv', r1, rf: ctl.rf }, base));
      }
      const sl = CORE.deep.slew({ opv: ctl.opv, uhat: 1, f: 1 });
      o.sr = wrapOk(sl) && sl.valid !== false ? sl.sr : NaN;
      return o;
    }

    // ---------------------------------------------------------------- Kennwerte je Schaltung (alles aus dem Kern)
    function key(r) {
      const a = r.core, sch = r.sch, ok = a && a.valid !== false;
      const o = { tau: 0, slope: 0, fg: 0, v: 0, hf: 0, fgName: 'Grenzfrequenz f_g', fgVal: NaN, ideal: r.ideal };
      if (!ok) return o;
      const h = r.resp && r.resp.valid !== false ? r.resp.h[0] : (r.fr && r.fr.valid !== false ? r.fr.h[0] : NaN);
      if (sch === 'integrierer') {
        o.tau = a.tau; o.slope = a.slope; o.hf = isNum(h) ? h : a.vf;
        if (!a.rpOffen) { o.fg = a.fgRp; o.v = a.v0; o.fgVal = a.fgRp; } else { o.fgVal = a.fRef; o.fgName = 'Frequenz mit |V| = 1'; }
      } else if (sch === 'differenzierer') {
        o.tau = a.tau; o.hf = isNum(h) ? h : a.vf;
        if (isNum(a.fgRs)) { o.fg = a.fgRs; o.fgVal = a.fgRs; } else { o.fgVal = a.fRef; o.fgName = 'Frequenz mit |V| = 1'; }
      } else if (sch === 'tiefpass') { o.tau = a.tau; o.fg = a.fg; o.fgVal = a.fg; o.v = a.v0; o.hf = h; }
      else if (sch === 'hochpass') { o.tau = a.tau; o.fg = a.fg; o.fgVal = a.fg; o.v = a.vInf; o.hf = h; }
      else {
        const fr = r.fr;
        o.v = a.v; o.hf = isNum(a.hf) ? a.hf : 0;
        if (fr && fr.valid !== false && isNum(fr.fg)) { o.fg = fr.fg; o.fgVal = fr.fg; o.tau = 1 / (2 * Math.PI * fr.fg); } else { o.fg = INF; }
      }
      ['tau', 'slope', 'fg', 'v', 'hf'].forEach(k => { if (!isNum(o[k])) o[k] = 0; });
      return o;
    }
    function tsatOf(r) {
      if (r.sch !== 'integrierer' || !r.core || r.core.valid === false) return 0;
      const a = r.core;
      if (!a.rpOffen) return 0;
      if (Math.abs(a.slope) > 0) return isNum(a.tSat) ? a.tSat : 0;
      return isNum(a.tSatOff) ? a.tSatOff : 0;
    }
    function offsetOf(r) {
      let rf = 0, r1 = r.r1;
      if (r.sch === 'integrierer') { if (r.rp === undefined) return { ok: true, valid: true, uaOff: 0, none: true }; rf = r.rp; r1 = r.r1; }
      else if (r.sch === 'tiefpass' || r.sch === 'real') rf = r.rf;
      else rf = 0;
      return Object.assign({ none: false }, CORE.deep.offset({ opv: r.ctl.opv, rf, r1: r1 }));
    }
    function fpbOf(r) {
      if (r.ideal) return INF;
      if (!(r.usat > 0)) return 0;
      const s = CORE.deep.slew({ opv: r.ctl.opv, uhat: r.usat, f: Math.max(r.ctl.f, 1e-3) });
      return wrapOk(s) && isNum(s.fpb) ? s.fpb / 1000 : 0;
    }

    // ---------------------------------------------------------------- Verlauf
    function runs(t, pred) {
      const out = []; let s = -1;
      for (let i = 0; i < t.length; i++) {
        if (pred(i)) { if (s < 0) s = i; } else if (s >= 0) { out.push({ t0: t[s], t1: t[i - 1] > t[s] ? t[i - 1] : t[i] }); s = -1; }
      }
      if (s >= 0) out.push({ t0: t[s], t1: t[t.length - 1] });
      return out.filter(q => q.t1 > q.t0);
    }
    function waveOf(r, ctl) {
      if (!r || !r.ok) return null;
      if (memoW.has(r)) return memoW.get(r);
      let w = null;
      try {
        const common = Object.assign({ ue: ctl.ue, f: ctl.f, form: ctl.form }, r.base);
        let cw;
        if (r.sch === 'integrierer') cw = CORE.act.wave(Object.assign({ art: 'integrierer', r: r.r1, c: r.c, rp: r.rp }, common), NW);
        else if (r.sch === 'differenzierer') cw = CORE.act.wave(Object.assign({ art: 'differenzierer', rf: ctl.rf, c: r.c, rs: r.rs }, common), NW);
        else if (r.sch === 'tiefpass') cw = CORE.act.wave(Object.assign({ art: 'tp', r1: r.r1, rf: ctl.rf, cf: r.c }, common), NW);
        else if (r.sch === 'hochpass') cw = CORE.act.wave(Object.assign({ art: 'hp', r1: r.r1, rf: ctl.rf, c1: r.c }, common), NW);
        else cw = CORE.op.wave(Object.assign({ art: 'inv', r1: r.r1, rf: ctl.rf }, common), NW);
        if (wrapOk(cw) && Array.isArray(cw.t) && cw.t.length === NW) {
          const sc = tScale(1 / ctl.f), t = cw.t.map(x => x * sc.k), eps = 1e-9, us = r.usat, un = r.usatN;
          const clip = us > 0 || un > 0 ? runs(t, i => cw.uout[i] >= us - eps || cw.uout[i] <= -un + eps) : [];
          const dt = cw.t[1] - cw.t[0];
          const slew = r.sch === 'real' && isNum(r.sr) && cw.slew ? runs(t, i => i > 0 && Math.abs(cw.uout[i] - cw.uout[i - 1]) / dt >= r.sr * 0.999) : [];
          w = { tUnit: sc.u, t, uin: cw.uin.slice(), uout: cw.uout.slice(), uaPeak: cw.uaPeak, clip, slew, clipYes: cw.clip === 'ja', slewYes: !!cw.slew, T: 1 / ctl.f, core: cw };
        }
      } catch (e) { w = null; }
      memoW.set(r, w);
      return w;
    }
    function live(r, ctl) {
      const w = waveOf(r, ctl);
      if (!w) return { i: 0, ua: 0, ue: 0 };
      const i = sw.active ? Math.min(NW - 1, Math.floor(sw.p * (NW - 1))) : Math.floor(ph * NW) % NW;
      return { i, ua: w.uout[i], ue: w.uin[i] };
    }

    function meters(r, ctl) {
      const o = { ua: 0, uaPeak: 0, tau: 0, slope: 0, fg: 0, fpb: 0, uosOut: 0, tsat: 0, v: 0, hf: 0 };
      if (!r.ok) return o;
      const k = key(r), w = waveOf(r, ctl), lv = live(r, ctl);
      o.ua = lv.ua; o.uaPeak = w ? w.uaPeak : 0; o.tau = k.tau * 1000; o.slope = k.slope; o.fg = k.fg; o.v = k.v; o.hf = k.hf;
      o.fpb = fpbOf(r);
      const of = offsetOf(r); o.uosOut = of && isNum(of.uaOff) && !of.none ? of.uaOff * 1000 : 0;
      o.tsat = tsatOf(r);
      return o;
    }

    // ---------------------------------------------------------------- Ampel
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: Die Eingabe ist ungültig.' };
      const k = key(r), z = ctl.zielF;
      if (r.sch === 'real' && r.ideal) return { ok: false, ampel: 'grau', text: 'Beim idealen Operationsverstärker ist der Frequenzgang unbegrenzt, es gibt keine Grenzfrequenz: Wähle langsam oder schnell, dann lässt sich die Vorgabe prüfen.', ziel: { text: 'f_g = ' + val(z, 'Hz'), soll: z } };
      if (!isNum(k.fgVal) || !(k.fgVal > 0)) return { ok: false, ampel: 'rot', text: 'Die Grenzfrequenz lässt sich mit diesen Werten nicht bestimmen, die Vorgabe ' + val(z, 'Hz') + ' wird nicht erreicht.', ziel: { text: 'f_g = ' + val(z, 'Hz'), soll: z } };
      const pct = Math.abs(k.fgVal - z) / z * 100, ampel = B.devAmpel(pct, CORE, 'op');
      return { ok: ampel === 'gruen', ampel, margin: pct, text: B.devText(k.fgName, k.fgVal, z, 'Hz', pct, CORE, 'op'), ziel: { text: 'f_g = ' + val(z, 'Hz'), soll: z, ist: k.fgVal, unit: 'Hz' } };
    }

    // ---------------------------------------------------------------- Meldungen
    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [], f = ctl.fehler, k = key(r), a = r.core, w = waveOf(r, ctl), sch = r.sch;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      const ts = tsatOf(r);
      if (f !== 'keiner') {
        const cause = FN[f];
        if (!applies(f, sch)) push('fehler-wirkungslos', 'info', cause + ' (Fehlerfall der Simulation): Diese Schaltung hat hier keinen solchen Teil, der Fehlerfall ändert nichts.', true);
        else if (f === 'rp offen') {
          if (ctl.rf >= RP_OHNE) push('rp-offen', 'info', 'R_p ist offen (Fehlerfall der Simulation): Es war kein R_p eingesetzt (Anschlag), der Fehlerfall ändert nichts; der Integrierer driftet ohnehin.', true);
          else push('rp-offen', 'warn', 'R_p ist offen (Fehlerfall der Simulation): Der Integrierer hat keine Gleichstromgegenkopplung mehr und driftet in die Sättigung' + (ts > 0 ? ': Zeit bis Sättigung ' + val(ts, 's', 3) + '.' : '.'), true);
        } else if (f === 'c offen') {
          const t = sch === 'integrierer' ? 'τ = R·C ist nahezu null, der Ausgang läuft schon nach ' + val(ts * 1000, 'ms', 6) + ' in die Sättigung.' : sch === 'differenzierer' ? 'Die Verstärkung ist nahezu null, |V| bei f = ' + val(k.hf, '', 6) + '.' : sch === 'tiefpass' ? 'Die Grenzfrequenz steigt auf ' + val(k.fg / 1e6, 'MHz', 2) + ': Das Filter wirkt im Signalbereich nicht mehr.' : 'Die Grenzfrequenz steigt auf ' + val(k.fg / 1e6, 'MHz', 2) + ': Der Hochpass sperrt das Signal, |V| bei f = ' + val(k.hf, '', 6) + '.';
          push('c-offen', 'warn', cause + ' (Fehlerfall der Simulation): ' + t, true);
        } else if (f === 'r1 offen') push('r1-offen', 'warn', cause + ' (Fehlerfall der Simulation): Es fließt kein Eingangsstrom, ' + (sch === 'integrierer' ? 'die Steigung ist nahezu null (' + val(k.slope, 'V/s', 6) + ').' : 'die Verstärkung ist nahezu null (|V| bei f = ' + val(k.hf, '', 6) + ').'), true);
        else if (f === 'versorgung minus fehlt') push('versorgung-minus-fehlt', 'warn', cause + ' (Fehlerfall der Simulation): Der Ausgang kann nur zwischen +U_sat = ' + val(r.usat, 'V', 1) + ' und 0 V laufen.', true);
        else if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', cause + ' (Fehlerfall der Simulation): Der Ausgang bleibt bei 0 V.', true);
      }
      if (sch === 'integrierer' && a && a.valid !== false) {
        if (a.rpOffen) push('integrierer-ohne-rp', 'info', 'Der Integrierer hat keinen Parallelwiderstand R_p: Bei Gleichspannung am Eingang läuft der Ausgang mit ' + val(a.slope, 'V/s', 3) + (ts > 0 ? ' bis zur Aussteuergrenze (Zeit bis Sättigung ' + val(ts, 's', 3) + ').' : '.') + (a.drift ? ' Die Offsetspannung erzeugt eine Drift von ' + val(a.drift, 'V/s', 3) + '.' : ''));
        else push('integrierer-rp', 'info', 'Mit R_p = ' + eng(r.rp, 'Ω') + ' ist die Gleichstromverstärkung V_0 = ' + val(a.v0, '', 2) + ' und die Grenzfrequenz f_g = ' + val(a.fgRp, 'Hz', 3) + '; der Ausgang strebt dem Endwert ' + val(a.uaEnd, 'V', 3) + ' zu.');
      }
      if (sch === 'differenzierer' && a && a.valid !== false && r.rs === undefined) push('differenzierer-ohne-rs', 'info', 'Ohne Serienwiderstand R_s steigt die Verstärkung 2π·f·R_f·C mit der Frequenz ohne Grenze: Hochfrequentes Rauschen wird stark verstärkt.');
      if (w && w.clipYes) push('begrenzt', 'warn', 'Der Ausgang wird begrenzt: Die Ausgangsspitze erreicht die Aussteuergrenze U_sat = ' + val(r.usat, 'V', 1) + '.');
      if (w && w.slewYes) push('slew', 'warn', 'Die Slew-Rate begrenzt den Ausgang: Die Anstiegsgeschwindigkeit erreicht SR = ' + val(r.sr / 1e6, 'V/µs', 3) + ', die Spitze ' + val(w.uaPeak, 'V', 3) + ' liegt unter dem linearen Wert; das Signal wird zum Dreieck.');
      if (sch === 'real' && r.ideal) push('real-ideal', 'info', 'Idealer Operationsverstärker: Der Frequenzgang ist unbegrenzt und es gibt keine Slew-Rate; wähle langsam oder schnell für GBW, Grenzfrequenz und Slew-Rate.');
      if (sch === 'real' && !r.ideal && a && a.valid !== false && r.fr && r.fr.valid !== false) push('real-gbw', 'info', 'V_n = ' + val(a.vn, '', 3) + ', Grenzfrequenz f_g = ' + val(r.fr.fg, 'Hz', 4) + ' (≈ GBW/V_n); bei der eingestellten Frequenz ist |V| = ' + val(a.hf, '', 4) + '.');
      if (sw.active) push('start', 'info', 'Start: U_a = ' + val(live(r, ctl).ua, 'V', 2) + ' bei t = ' + val(sw.p * (w ? w.t[NW - 1] : 0), w ? w.tUnit : 's', 2) + '.');
      return out;
    }
    function befund(r, ctl) {
      if (!r.ok) return [];
      const k = key(r), w = waveOf(r, ctl);
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: U_a (Spitze) = ' + val(w ? w.uaPeak : 0, 'V', 3) + ', |V| bei f = ' + val(k.hf, '', 4) + ', U_a,off = ' + val(((offsetOf(r) || {}).none ? 0 : ((offsetOf(r) || {}).uaOff || 0)) * 1000, 'mV', 3) + (k.slope ? ', Steigung = ' + val(k.slope, 'V/s', 3) : '') + (k.fg > 0 && k.fg < INF ? ', f_g = ' + val(k.fg, 'Hz', 4) : '') + '.' }];
    }

    // ---------------------------------------------------------------- Kennlinien, Verlauf, Zustand
    function bodeData(r) {
      if (r.sch === 'real') {
        const b = r.bode;
        if (!b || b.valid === false || !Array.isArray(b.f)) return null;
        return { f: b.f, a: b.a, phi: b.phi, open: b.aOpen, fg: b.fg, gbw: b.gbw, fA: b.fA, typ: 'ver' };
      }
      const c = r.curve;
      if (!c || c.valid === false || !Array.isArray(c.f)) return null;
      const typ = { integrierer: 'int', differenzierer: 'diff', tiefpass: 'tief', hochpass: 'hoch' }[r.sch], k = key(r);
      const d = { f: c.f, a: c.a, phi: c.phi, typ };
      if (k.fg > 0 && k.fg < INF) d.fg = k.fg;
      return d;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      let c = memoC.get(r);
      if (!c) { c = curvesRaw(r, ctl); memoC.set(r, c); }
      return c;
    }
    function curvesRaw(r, ctl) {
      const d = bodeData(r);
      if (!d) return [];
      const ptsA = d.f.map((x, i) => [x, d.a[i]]), ptsP = d.f.map((x, i) => [x, d.phi[i]]);
      const k = key(r);
      const ma = isNum(k.hf) && k.hf > 0 ? 20 * Math.log10(k.hf) : NaN, ph = r.sch === 'real' && r.fr && r.fr.valid !== false ? r.fr.phi[0] : (r.resp && r.resp.valid !== false ? r.resp.phi[0] : NaN);
      const sa = [{ name: 'Betrag a', kind: 'out', points: ptsA }];
      if (d.open) sa.push({ name: 'Leerlauf (ohne Gegenkopplung)', kind: 'ref', points: d.f.map((x, i) => [x, d.open[i]]) });
      const out = [{ id: 'bode', title: 'Frequenzgang des Betrags: a = 20·lg|V| über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Verstärkungsmaß a', yUnit: 'dB', series: sa,
        marker: isNum(ma) && ctl.f >= d.f[0] && ctl.f <= d.f[d.f.length - 1] ? { x: ctl.f, y: ma, label: 'eingestellte Frequenz' } : undefined },
      { id: 'phase', title: 'Phase der Schaltung über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Phase φ', yUnit: '°', series: [{ name: 'Phase φ', kind: 'i', points: ptsP }],
        marker: isNum(ph) && ctl.f >= d.f[0] && ctl.f <= d.f[d.f.length - 1] ? { x: ctl.f, y: ph, label: 'eingestellte Frequenz' } : undefined }];
      return out;
    }
    function waveform(r, ctl) {
      const w = waveOf(r, ctl);
      if (!w) return null;
      return { tUnit: w.tUnit, t: w.t, series: [{ name: 'u_e (Eingang)', unit: 'V', kind: 'u', y: w.uin }, { name: 'u_a (Ausgang)', unit: 'V', kind: 'out', y: w.uout }], clip: w.clip, slew: w.slew,
        marks: { span: [{ t0: 0, t1: w.t[w.t.length - 1], name: 'Periode' }] } };
    }
    function state(r, ctl) {
      if (!r.ok) return { valid: false, text: 'Die Eingabe ist ungültig.', start: sw.active, startP: sw.p };
      const k = key(r), w = waveOf(r, ctl), lv = live(r, ctl), ts = tsatOf(r);
      return { valid: !!(r.core && r.core.valid !== false), text: r.sch === 'real' ? 'Verstärker: V = ' + val(k.v, '', 4) + (k.fg > 0 && k.fg < INF ? ', f_g = ' + val(k.fg, 'Hz', 4) : ', ideal unbegrenzt') + '.' : 'τ = ' + val(k.tau * 1000, 'ms', 4) + (k.fg > 0 ? ', f_g = ' + val(k.fg, 'Hz', 4) : '') + '.',
        tau: k.tau, steigung: k.slope, fg: k.fg, vDurchlass: k.v, hf: k.hf, tsat: ts, usat: r.usat, usatN: r.usatN, uaLive: lv.ua, ueLive: lv.ue, uaPeak: w ? w.uaPeak : 0, begrenzt: !!(w && w.clipYes), slewBegrenzt: !!(w && w.slewYes),
        hatRp: r.rp !== undefined, hatRs: r.rs !== undefined, fpb: fpbOf(r), start: sw.active, startP: sw.p };
    }

    // ---------------------------------------------------------------- Vertiefungen
    function deepOf(r, ctl) {
      if (!r.ok) return null;
      if (memoD.has(r)) return memoD.get(r);
      const out = {}, bad = why => ({ ok: true, valid: false, why });
      // bode
      if (r.sch === 'real' || r.sch === 'tiefpass' || r.sch === 'hochpass') {
        const b = CORE.deep.bode(Object.assign({ art: 'inv', r1: r.r1, rf: ctl.rf }, r.base));
        out.bode = Object.assign({ id: 'bode', title: 'Bode-Diagramm und GBW' }, b);
      } else out.bode = Object.assign({ id: 'bode', title: 'Bode-Diagramm und GBW' }, bad('Die Vertiefung gilt für die Verstärkerstufe mit R_1 und R_f (Schaltungen real, Tiefpass und Hochpass): Wähle eine davon.'));
      // slew
      const w = waveOf(r, ctl);
      let uhat = w && w.uaPeak > 0 ? w.uaPeak : r.usat;
      if (r.sch === 'real' && r.core && isNum(r.core.v)) uhat = Math.min(Math.abs(r.core.v * ctl.ue), r.usat) || uhat;
      const s = r.usat > 0 ? CORE.deep.slew({ opv: ctl.opv, uhat: uhat > 0 ? uhat : r.usat, f: ctl.f }) : bad('Ohne Aussteuerung (U_sat = 0 V) gibt es keine Amplitude: Prüfe die Versorgung.');
      out.slew = Object.assign({ id: 'slew', title: 'Slew-Rate', uhat }, s);
      if (s && s.valid !== false && r.sch === 'real') {
        const ideal = CORE.op.wave({ art: 'inv', r1: r.r1, rf: ctl.rf, ue: ctl.ue, f: ctl.f, form: ctl.form, opv: 'ideal', uv: r.base.uv, uvn: r.base.uvn }, NW);
        if (w && wrapOk(ideal)) out.slew.wave = { tUnit: w.tUnit, t: w.t, series: [{ name: 'u_e (Eingang)', unit: 'V', kind: 'u', y: w.uin }, { name: 'u_a mit Slew-Rate', unit: 'V', kind: 'out', y: w.uout }, { name: 'u_a ideal (ohne Begrenzung)', unit: 'V', kind: 'ref', y: ideal.uout.slice() }], clip: w.clip, slew: w.slew };
      }
      // offset
      const of = offsetOf(r);
      out.offset = Object.assign({ id: 'offset', title: 'Offsetspannung' }, of);
      if (r.sch === 'integrierer' && r.rp === undefined && r.core && r.core.valid !== false) { out.offset.drift = r.core.drift; out.offset.tSatOff = r.core.tSatOff; out.offset.text = (of.text ? of.text + ' ' : '') + 'Ohne R_p driftet der Integrierer mit ' + val(r.core.drift, 'V/s', 4) + (isNum(r.core.tSatOff) ? ' und steht nach ' + val(r.core.tSatOff, 's', 3) + ' in der Sättigung.' : '.'); }
      // sat
      const k = key(r), vsat = r.sch === 'real' ? Math.abs(k.v) : k.hf;
      const st = vsat > 0 ? CORE.deep.sat({ opv: ctl.opv, uv: r.base.uv, v: vsat }) : bad('Die Verstärkung bei der eingestellten Frequenz ist null: Es gibt keine Eingangsspannung, die den Ausgang begrenzt.');
      out.sat = Object.assign({ id: 'sat', title: 'Sättigung', vsat }, st);
      if (st && st.valid !== false) {
        const um = st.ueMax * 2, pts = [];
        for (let i = 0; i <= 80; i++) { const u = -um + 2 * um * i / 80, q = CORE.op.inv(Object.assign({ r1: 1000, rf: 1000 * vsat, ue: u }, r.base)); if (wrapOk(q) && isNum(q.ua)) pts.push([u, q.ua]); }
        out.sat.curve = { title: 'Übertragung mit Aussteuergrenze (Verstärkung ' + val(vsat, '', 3) + ')', xLabel: 'Eingangsspannung U_e', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a', yUnit: 'V', series: [{ name: 'U_a', kind: 'out', points: pts }], marker: { x: st.ueMax, y: -st.usat, label: 'U_e,max' }, limit: { y: st.usat, name: '+U_sat' } };
      }
      memoD.set(r, out);
      return out;
    }
    function drawDeep(name, ctx, w, h, o, res, ctl) {
      const r = res; o = o || {};
      if (!ctx || !isNum(w) || !isNum(h) || !(w > 0) || !(h > 0) || !r || !r.ok) return false;
      const d = deepOf(r, ctl);
      if (!d || !d[name] || d[name].valid === false) return false;
      const D = B.getDraw(), pal = B.palette(o.theme), rect = { x: 0, y: 0, w, h }, opt2 = { theme: o.theme === 'light' ? 'light' : 'dark', q: o.quality || 'hoch', reduced: !!o.reduced };
      const q = d[name];
      let data, fn;
      if (name === 'bode') { data = bodeData(r); fn = 'bode'; }
      else if (name === 'slew') { data = q.wave; fn = 'scope'; }
      else if (name === 'offset') { data = { items: [{ name: 'U_a,off', value: (q.uaOff || 0) * 1000, unit: 'mV', kind: 'err' }], label: 'Ausgang bei U_e = 0', unit: 'mV', title: 'Offsetspannung am Ausgang', dir: 'h' }; fn = 'bar'; }
      else { data = q.curve; fn = 'curve'; }
      if (!data) return false;
      let done = false;
      try { ctx.save(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h); ctx.restore(); } catch (e) { /* ignorieren */ }
      if (D && typeof D[fn] === 'function') { try { done = !!D[fn](ctx, rect, data, opt2); } catch (e) { done = false; } }
      if (!done && B.FB[fn]) { try { done = !!B.FB[fn](ctx, rect, data, pal, {}); } catch (e) { done = false; } }
      return done;
    }

    return {
      compute, meters, assess, diag, befund, curves, waveform, state,
      phaseHz: () => 0.15,
      onControl(k, old) {
        if (k === 'schaltung' && P0.ctl.schaltung !== 'integrierer' && P0.ctl.rf >= 1e7) P0.setCtl('rf', 1e5);
      },
      step(dtMs) {
        if (!P0.anim.reduced) ph = (ph + dtMs / 1000 * 0.15) % 1;
        if (!sw.active) return;
        sw.p = Math.min(1, sw.p + dtMs / (START_S * 1000));
        if (sw.p >= 1) { sw.active = false; P0.say('Der Start ist abgeschlossen: Der Verlauf ist vollständig.', 'info'); }
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 0; P0.say('Der Start wurde abgebrochen.', 'info'); return true; }
        if (!r.ok || !waveOf(r, ctl)) { P0.say('Mit diesen Werten gibt es keinen Start zu zeigen.', 'warn'); return false; }
        sw.active = true; sw.p = 0;
        P0.say('Start: Der Kondensator ist entladen und der Eingang springt an. Verfolge, wie der Ausgang losläuft.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; ph = 0; },
      extend(api, h) {
        api.deepInfo = () => { const d = deepOf(h.res(), h.ctl); return d ? JSON.parse(JSON.stringify(d, (kk, v) => (typeof v === 'number' && !isFinite(v) ? null : v))) : null; };
        api.drawDeep = (name, ctx, w, hh, o) => drawDeep(name, ctx, w, hh, o, h.res(), h.ctl);
      },
      draw: (ctx, w, h, t, view, sc) => drawRig(ctx, w, h, t, view, sc, { sw, live, waveOf, key })
    };
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
    const sch = ctl.schaltung, f = ctl.fehler;
    const ok = f === 'c offen' ? sch !== 'real' : f === 'rp offen' ? sch === 'integrierer' : f === 'r1 offen' ? sch !== 'differenzierer' : true;
    if (!ok) return {};
    const m = { 'c offen': ['c'], 'rp offen': ['rp'], 'r1 offen': ['r1'], 'versorgung minus fehlt': ['uvn'], 'versorgung fehlt': ['uv', 'uvn'] }[f];
    const nm = { 'c offen': 'Kondensator offen', 'rp offen': 'R_p offen', 'r1 offen': 'R_1 offen', 'versorgung minus fehlt': 'negative Versorgung fehlt', 'versorgung fehlt': 'Versorgung fehlt' }[f];
    return { fault: m.map(id => ({ id, type: id === 'uv' || id === 'uvn' ? 'defekt' : 'offen' })), faultText: 'Fehler (Simulation): ' + nm };
  }
  const z0 = x => (Math.abs(x) < 1e-9 ? 0 : x);
  function drawRig(ctx, w, h, t, view, sc, X) {
    const r = view.res, pal = sc.pal, R0 = sc.rect, g = sc.gfx, gap = 8, ctl = view.ctl, hid = view.verdeckt;
    if (!r || !r.ok) {
      wrapText(ctx, g, 'Die Eingabe ist ungültig.', R0.w - 16, 13, 4).forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
      return;
    }
    const chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - (chipsH ? gap : 0);
    let sch, kenn, sig, strip;
    if (R0.w >= 680) {
      const lw = Math.round(R0.w * 0.42), rw = R0.w - lw - gap, hS = Math.round(bodyH * 0.62);
      sch = { x: R0.x, y: R0.y, w: lw, h: hS }; strip = { x: R0.x, y: R0.y + hS + gap, w: lw, h: bodyH - hS - gap };
      const h0 = Math.round((bodyH - gap) * 0.5);
      kenn = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h0 }; sig = { x: kenn.x, y: R0.y + h0 + gap, w: rw, h: bodyH - h0 - gap };
    } else {
      const hh = bodyH - 3 * gap, q = [0.27, 0.32, 0.27, 0.14].map(x => Math.round(hh * x)); let y = R0.y;
      sch = { x: R0.x, y, w: R0.w, h: q[0] }; y += q[0] + gap;
      kenn = { x: R0.x, y, w: R0.w, h: q[1] }; y += q[1] + gap;
      sig = { x: R0.x, y, w: R0.w, h: q[2] }; y += q[2] + gap;
      strip = { x: R0.x, y, w: R0.w, h: R0.y + bodyH - y };
    }
    const fs = faultSpec(ctl, hid), lv = X.live(r, ctl), k = X.key(r), sh = ctl.schaltung, L = {}, vals = {};
    const showF = (id, fault, v) => (!hid && ctl.fehler === fault && fs.fault ? 'offen' : v);
    L.ue = 'U_e = ' + eng(z0(lv.ue), 'V'); L.ua = 'U_a = ' + eng(z0(lv.ua), 'V');
    if (!hid) { L.uv = '+U_v = ' + eng(ctl.fehler === 'versorgung fehlt' ? 0 : ctl.uv, 'V'); L.uvn = '−U_v = ' + eng(ctl.fehler === 'versorgung fehlt' || ctl.fehler === 'versorgung minus fehlt' ? 0 : -ctl.uv, 'V'); } else { L.uv = '+U_v'; L.uvn = '−U_v'; }
    let kind = 'integrierer';
    if (sh === 'integrierer') { vals.r = showF('r', 'r1 offen', eng(ctl.r1, 'Ω')); vals.c = showF('c', 'c offen', eng(ctl.c, 'F')); if (r.rp !== undefined || (!hid && ctl.fehler === 'rp offen' && fs.fault)) vals.rp = showF('rp', 'rp offen', eng(ctl.rf, 'Ω')); }
    else if (sh === 'differenzierer') { kind = 'differenzierer'; vals.c = showF('c', 'c offen', eng(ctl.c, 'F')); vals.rf = eng(ctl.rf, 'Ω'); }
    else if (sh === 'tiefpass') { kind = 'tp'; vals.r1 = showF('r1', 'r1 offen', eng(ctl.r1, 'Ω')); vals.rf = eng(ctl.rf, 'Ω'); vals.c = showF('c', 'c offen', eng(ctl.c, 'F')); }
    else if (sh === 'hochpass') { kind = 'hp'; vals.c = showF('c', 'c offen', eng(ctl.c, 'F')); vals.r1 = showF('r1', 'r1 offen', eng(ctl.r1, 'Ω')); vals.rf = eng(ctl.rf, 'Ω'); }
    else { kind = 'opv_inv'; vals.r1 = showF('r1', 'r1 offen', eng(ctl.r1, 'Ω')); vals.rf = eng(ctl.rf, 'Ω'); }
    const sdata = Object.assign({ kind, values: vals, labels: L }, fs);
    if (sh === 'integrierer' && r.rp === undefined && !(fs.fault)) sdata.hide = ['rp'];
    if (!sc.view('schematic', sch, sdata, {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
    // Kennlinie: Frequenzgang des Betrags
    const bd = view.rig.curves().find(c => c.id === 'bode');
    if (bd) {
      const ser = bd.series[0].points, bdata = { f: ser.map(p => p[0]), a: ser.map(p => p[1]) };
      const ph = view.rig.curves().find(c => c.id === 'phase');
      if (ph) bdata.phi = ph.series[0].points.map(p => p[1]);
      if (bd.series[1]) bdata.open = bd.series[1].points.map(p => p[1]);
      bdata.typ = { integrierer: 'int', differenzierer: 'diff', tiefpass: 'tief', hochpass: 'hoch', real: 'ver' }[sh];
      if (k.fg > 0 && k.fg < 1e11) bdata.fg = k.fg;
      if (sh === 'real' && r.bode && r.bode.valid !== false) { bdata.gbw = r.bode.gbw; bdata.fA = r.bode.fA; }
      if (!sc.view('bode', kenn, bdata, {})) noData(ctx, g, kenn, pal, 'Kein Frequenzgang für diese Werte.');
    } else noData(ctx, g, kenn, pal, sh === 'real' && r.ideal ? 'Idealer Operationsverstärker: Der Frequenzgang ist unbegrenzt, es gibt keinen Knick. Wähle langsam oder schnell.' : 'Kein Frequenzgang für diese Werte.');
    const wf = view.rig.waveform ? view.rig.waveform() : null;
    if (wf && sw0(X)) { const wv = Object.assign({}, wf, { cursor: wf.t[Math.min(wf.t.length - 1, X.live(r, ctl).i)] }); if (!sc.view('scope', sig, wv, { wipe: X.sw.active ? X.sw.p : undefined })) noData(ctx, g, sig, pal, 'Kein Verlauf für diese Werte.'); }
    else if (wf) { if (!sc.view('scope', sig, wf, {})) noData(ctx, g, sig, pal, 'Kein Verlauf für diese Werte.'); }
    else noData(ctx, g, sig, pal, 'Kein Verlauf für diese Werte.');
    if (strip.h >= 50) {
      g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
      const rows = [], a = r.core;
      if (sh === 'integrierer') {
        rows.push({ t: SICHT.formel, bold: true, color: pal.fg });
        rows.push({ t: 'τ = R·C = ' + val(k.tau * 1000, 'ms', 4) + ', Steigung = ' + val(k.slope, 'V/s', 3) + (r.rp !== undefined ? ', f_g = ' + val(k.fg, 'Hz', 3) + ', V_0 = ' + val(k.v, '', 2) : ''), color: pal.fg });
      } else if (sh === 'differenzierer') {
        rows.push({ t: 'U_a = −R_f · C · dU_e/dt', bold: true, color: pal.fg });
        rows.push({ t: 'τ = R_f·C = ' + val(k.tau * 1000, 'ms', 4) + ', |V| bei f = ' + val(k.hf, '', 3) + (r.rs !== undefined ? ', f_g = ' + val(k.fg, 'Hz', 3) : ''), color: pal.fg });
      } else if (sh === 'tiefpass') {
        rows.push({ t: 'f_g = 1/(2π · R_f · C_f), V_0 = −R_f/R_1', bold: true, color: pal.fg });
        rows.push({ t: 'f_g = ' + val(k.fg, 'Hz', 4) + ', V_0 = ' + val(k.v, '', 3) + ', |V| bei f = ' + val(k.hf, '', 3), color: pal.fg });
      } else if (sh === 'hochpass') {
        rows.push({ t: 'f_g = 1/(2π · R_1 · C_1), V_∞ = −R_f/R_1', bold: true, color: pal.fg });
        rows.push({ t: 'f_g = ' + val(k.fg, 'Hz', 4) + ', V_∞ = ' + val(k.v, '', 3) + ', |V| bei f = ' + val(k.hf, '', 3), color: pal.fg });
      } else {
        rows.push({ t: 'f_g ≈ GBW / V_n, V_n = 1 + R_f / R_1', bold: true, color: pal.fg });
        rows.push({ t: r.ideal ? 'Ideal: V_u = ' + val(k.v, '', 3) + ', f_g unbegrenzt' : 'V_u = ' + val(k.v, '', 4) + ', V_n = ' + val(a.vn, '', 3) + ', f_g = ' + val(k.fg, 'Hz', 4), color: pal.fg });
      }
      g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
    }
    if (chipsH) {
      const y = R0.y + bodyH + gap, m = view.rig.readMeters();
      const items = [['τ', val(m.tau, 'ms', 3)], ['f_g', m.fg >= 1e11 ? '∞' : (m.fg > 0 ? val(m.fg, 'Hz', 3) : '–')], ['|V| bei f', val(m.hf, '', 3)], ['U_a', val(m.ua, 'V', 2)]];
      const cw = (R0.w - gap * (items.length - 1)) / items.length;
      items.forEach((it, i) => g.chip(ctx, it[0], it[1], R0.x + i * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
    }
  }
  const sw0 = X => X.sw.active;

  R.register({ id: 'opv_aktiv', name: 'Integrierer, Differenzierer, aktive Filter und realer OPV', icon: '📈', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'opv_aktiv', name: 'Integrierer, Differenzierer, aktive Filter und realer OPV', icon: '📈', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['zielF'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
