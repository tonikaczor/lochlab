/* anarig-emitter.js - ANA-Lab (WP2b): Pruefstand 3 `emitter` - Emitterschaltung (SPEC 5.3).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.emit.ac / large / line, ANA_CORE.tr.dc / family, ANA_CORE.cx, ANA_CORE.grid); hier steht keine zweite Transistorformel.
 * Einzige Anzeigehilfe im Rig: das Durchlassverhalten der beiden Koppel-Hochpaesse bei der eingestellten Frequenz (Betrag ueber ANA_CORE.cx aus den
 * Eckfrequenzen f1 und f2 des Kerns) skaliert Eingangs- und Ausgangsamplitude im Zeitbild; die Messgeraete vu und vus zeigen den Kernwert (Durchlassbereich).
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteilwerte sind Uebungswerte (Uebungsschaltung).
 * Fehlerfaelle (nur Simulation) setzen die Eingaben VOR dem Kernaufruf um (SPEC 5.3):
 *   r1/r2/rc offen -> R_OFFEN, re offen -> re1 und re2 R_OFFEN, ce offen -> ohne C_E, c1 offen -> 1 pF, transistor defekt -> defekt:'be_offen', versorgung fehlt -> ub = 1 mV.
 * Verdeckter Fehler (Fehlersuche): Meldungen, die die Ursache nennen, tragen verraet:true; Messbefunde (befund) nennen nur Zahlen; Ampeltext, Bild und state-Text sind ursachenfrei.
 * Steuerwerte (SI): ub (V), ue (V, Amplitude), f (Hz), rg, r1, r2, rc, re1, re2 (Ohm), ce (Schalter), c1, c2 (F), b, rl (Ohm, oberer Anschlag = Leerlauf), fehler, zielUce (V, 0 = keine),
 *   zielVu (Betrag, 0 = keine), ansicht, Taste fire (Aussteuerungsdurchlauf: die Eingangsamplitude steigt von 1 mV auf die Einstellung).
 * Messgeraete: ic (mA), ib (uA), uce, ues, ube (V), vu, vus (mit Vorzeichen), rin, ra (kOhm), fu (Hz), uaus (V, Spitze), klirr (%), uaMax (V), gm (mS), rbe (kOhm).
 * Ampel (nur mit Vorgabe): gruen = Arbeitspunkt im Fenster ap_fenster*U_B (falls gesetzt), |V_u| auf 5 % (falls gesetzt), kein Begrenzen; gelb = Arbeitspunkt bis 2 Fenster bzw. V_u 5-10 %;
 *   rot = Sperren, Saettigung, defekt, Begrenzen oder Vorgabe verfehlt. Fenster sind Lehrfaustwerte (Uebungswerte, F6, F16).
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-emitter.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = 'Modell: Kleinsignal-Hybrid-π und Großsignal-Exponentialkennlinie, kein Early-Effekt, keine Transistorkapazitäten, C_E ideal; der obere Frequenzgang entfällt (bis zur Transitfrequenz ideal). ' + (T0.modellEmitter || '');
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12;
  const SWEEP_S = 8;                                      // Dauer des Aussteuerungsdurchlaufs (s, Zeitlupe verlaengert)
  const MINUS = '−';

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const FEHLER = [['keiner', 'kein Fehler'], ['r1 offen', 'R_1 offen'], ['r2 offen', 'R_2 offen'], ['rc offen', 'R_C offen'], ['re offen', 'R_E offen'], ['ce offen', 'C_E offen'],
    ['c1 offen', 'C_1 offen'], ['transistor defekt', 'Transistor defekt'], ['versorgung fehlt', 'Versorgung fehlt']];
  const CONTROLS = B.fillControls([
    { key: 'ub', label: 'Betriebsspannung', type: 'slider', scale: 'lin', min: 5, max: 30, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betriebsspannung U_B der Übungsschaltung (Kleinspannung). Die Betriebsspannung bestimmt Arbeitsgerade und Aussteuerung; der Arbeitspunkt U_CE verschiebt sich mit ihr.' },
    { key: 'ue', label: 'Eingangsamplitude', type: 'slider', scale: 'log', min: 1e-3, max: 2, step: 1e-3, unit: 'V', unitKind: 'V', value: 0.02, gruppe: 'quelle', sicht: 'signal',
      help: 'Amplitude der Quellenspannung (Spitzenwert). Bei kleiner Amplitude gilt das Kleinsignalmodell; bei großer Amplitude begrenzt der Ausgang und der Klirrfaktor steigt. Die Taste Aussteuerungsdurchlauf zeigt den Übergang.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 10, max: 1e6, step: 1, unit: 'Hz', unitKind: 'Hz', value: 1000, gruppe: 'quelle', sicht: 'signal',
      help: 'Frequenz der Quelle. Unterhalb der unteren Grenzfrequenz f_u sperren die Koppelkondensatoren und der Ausgang wird kleiner; nach oben gilt das Modell bis zur Transitfrequenz ideal.' },
    { key: 'rg', label: 'Quellenwiderstand', type: 'slider', scale: 'log', min: 10, max: 1e5, step: 1, unit: 'Ω', unitKind: 'Ω', value: 600, gruppe: 'quelle', sicht: 'formel',
      help: 'Innenwiderstand R_G der Signalquelle. Er bildet mit dem Eingangswiderstand der Stufe einen Spannungsteiler: Je größer R_G, desto kleiner V_u,Quelle gegenüber V_u. Übungswert.' },
    { key: 'r1', label: 'Basisspannungsteiler R1', type: 'slider', scale: 'log', min: 1e3, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel',
      help: 'Oberer Widerstand des Basisspannungsteilers. Ein kleineres R_1 hebt die Basisspannung und den Kollektorstrom: U_CE sinkt, bis der Transistor in die Sättigung geht (die negative Ausgangshalbwelle wird flach). Übungswert.' },
    { key: 'r2', label: 'Basisspannungsteiler R2', type: 'slider', scale: 'log', min: 1e3, max: 1e5, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel',
      help: 'Unterer Widerstand des Basisspannungsteilers. Ein größeres R_2 hebt die Basisspannung und den Kollektorstrom: U_CE sinkt. Übungswert.' },
    { key: 'rc', label: 'Kollektorwiderstand', type: 'slider', scale: 'log', min: 100, max: 1e5, step: 10, unit: 'Ω', unitKind: 'Ω', value: 2200, gruppe: 'bauteile', sicht: 'formel',
      help: 'Kollektorwiderstand R_C. Er bestimmt die Steigung der Arbeitsgeraden, die Spannungsverstärkung und den Ausgangswiderstand r_aus. Übungswert.' },
    { key: 're1', label: 'Emitterwiderstand ungebrückt', type: 'slider', scale: 'log', min: 1, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 100, gruppe: 'bauteile', sicht: 'formel',
      help: 'Emitterwiderstand R_E1, der für das Signal immer wirkt (Gegenkopplung). Er macht die Verstärkung stabiler, aber kleiner. Übungswert.' },
    { key: 're2', label: 'Emitterwiderstand gebrückt', type: 'slider', scale: 'log', min: 1, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 470, gruppe: 'bauteile', sicht: 'formel',
      help: 'Emitterwiderstand R_E2, der für das Signal vom Emitterkondensator überbrückt wird. Für den Gleichstrom wirkt er zusammen mit R_E1. Übungswert.' },
    { key: 'ce', label: 'Emitterkondensator (überbrückt RE2)', type: 'switch', min: 0, max: 1, step: 1, unit: '', unitKind: '', value: true, gruppe: 'bauteile', sicht: 'signal',
      help: 'Mit Emitterkondensator C_E ist R_E2 für das Signal überbrückt und V_u groß; ohne C_E wirkt auch R_E2 als Gegenkopplung und |V_u| sinkt, dafür wird die Stufe linearer.' },
    { key: 'c1', label: 'Koppelkondensator Eingang', type: 'slider', scale: 'log', min: 1e-8, max: 1e-3, step: 1e-8, unit: 'F', unitKind: 'F', value: 10e-6, gruppe: 'bauteile', sicht: 'signal',
      help: 'Koppelkondensator C_1 am Eingang. Er bildet mit R_G und dem Eingangswiderstand einen Hochpass mit der Eckfrequenz f_1. Übungswert.' },
    { key: 'c2', label: 'Koppelkondensator Ausgang', type: 'slider', scale: 'log', min: 1e-8, max: 1e-3, step: 1e-8, unit: 'F', unitKind: 'F', value: 10e-6, gruppe: 'bauteile', sicht: 'signal',
      help: 'Koppelkondensator C_2 am Ausgang. Er bildet mit R_C und R_L einen Hochpass mit der Eckfrequenz f_2; ohne Last (Leerlauf) entfällt er. Übungswert.' },
    { key: 'b', label: 'Gleichstromverstärkung B', type: 'slider', scale: 'lin', min: 20, max: 400, step: 1, unit: '', unitKind: '', value: 100, gruppe: 'bauteile', sicht: 'formel',
      help: 'Gleichstromverstärkung B des Transistors (Übungswert, F4). Die Gleichstromverstärkung streut in der Praxis stark; der Arbeitspunkt hängt davon ab, wenn der Basisspannungsteiler hochohmig ist.' },
    { key: 'rl', label: 'Lastwiderstand (oberer Anschlag = Leerlauf)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'last', sicht: 'formel',
      help: 'Lastwiderstand R_L am Ausgang. Er liegt für das Signal parallel zu R_C und senkt |V_u|. Am oberen Anschlag (1 MΩ) gilt die Stufe als unbelastet (Leerlauf). Übungswert.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): R_1, R_2, R_C oder R_E offen, C_E oder C_1 offen, Transistor defekt oder Versorgung fehlt. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'zielUce', label: 'Vorgabe U_CE im Arbeitspunkt (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 30, step: 0.1, unit: 'V', unitKind: 'V', value: 0, gruppe: 'ziel', sicht: 'kennlinie',
      help: 'Vorgabe für U_CE im Arbeitspunkt. Bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Grün gilt im Fenster um die Vorgabe (Übungswert, F6): Der Arbeitspunkt soll in der Mitte der Aussteuerung liegen.' },
    { key: 'zielVu', label: 'Vorgabe Betrag von V_u (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 500, step: 0.5, unit: '', unitKind: '', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für den Betrag der Spannungsverstärkung |V_u| (belastet, von der Basis zum Ausgang). Bei 0 ist keine Vorgabe gesetzt. Grün bei Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16).' },
    { key: 'ansicht', label: 'Ansicht', type: 'select', value: 'signal', options: opt([['signal', 'Signal im Vordergrund'], ['ausgangskennlinie', 'Ausgangskennlinienfeld im Vordergrund'], ['uebertragung', 'Übertragungskennlinie im Vordergrund']]), gruppe: 'ziel', sicht: 'kennlinie',
      help: 'Wählt, welches Bild den meisten Platz bekommt: das Signal, das Ausgangskennlinienfeld mit Arbeitsgerade und Wechselstrom-Arbeitsgerade oder die Übertragungskennlinie U_a über U_e mit den Aussteuergrenzen. Die Rechnung bleibt gleich.' },
    { key: 'fire', label: 'Aussteuerungsdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'signal',
      help: 'Startet den Aussteuerungsdurchlauf: Die Eingangsamplitude steigt von 1 mV bis auf die Einstellung. Du siehst Ausgang, Klirrfaktor und das Begrenzen live. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'ic', label: 'Kollektorstrom I_C', unit: 'mA', digits: 3, min: 0, max: 30, help: 'Kollektorstrom im Arbeitspunkt, aus dem vollständigen Gleichungssystem des Transistors (mit Sättigung).' },
    { key: 'ib', label: 'Basisstrom I_B', unit: 'µA', digits: 2, min: 0, max: 300, help: 'Basisstrom im Arbeitspunkt. Im aktiven Bereich ist I_C = B · I_B.' },
    { key: 'uce', label: 'Spannung U_CE', unit: 'V', digits: 3, min: 0, max: 30, help: 'Kollektor-Emitter-Spannung im Arbeitspunkt. Unter U_CE,sat (Übungswert, F4) ist der Transistor gesättigt.' },
    { key: 'ues', label: 'Emitterspannung U_E', unit: 'V', digits: 3, min: 0, max: 30, help: 'Spannung am Emitter gegen Masse, U_E = I_E · (R_E1 + R_E2).' },
    { key: 'ube', label: 'Spannung U_BE', unit: 'V', digits: 3, min: 0, max: 1, help: 'Basis-Emitter-Spannung (0,7 V im leitenden Zustand, belegt).' },
    { key: 'vu', label: 'Spannungsverstärkung V_u', unit: '', digits: 2, min: -500, max: 500, zeroIsNone: true, help: 'Spannungsverstärkung belastet, von der Basis zum Ausgang, mit Vorzeichen: negativ heißt, der Ausgang ist gegenüber dem Eingang um 180° gedreht. Gilt im Durchlassbereich; die Zahl hängt nicht von der Frequenz ab.' },
    { key: 'vus', label: 'Spannungsverstärkung mit Quelle V_u,Quelle', unit: '', digits: 2, min: -500, max: 500, zeroIsNone: true, help: 'Spannungsverstärkung von der Quelle zum Ausgang: V_u mal der Spannungsteiler aus Quellenwiderstand R_G und Eingangswiderstand. Gilt im Durchlassbereich.' },
    { key: 'rin', label: 'Eingangswiderstand r_ein', unit: 'kΩ', digits: 2, min: 0, max: 100, infAbove: 1e6, zeroIsNone: true, help: 'Eingangswiderstand der Stufe: R_1 parallel R_2 parallel Eingangswiderstand des Transistors.' },
    { key: 'ra', label: 'Ausgangswiderstand r_aus', unit: 'kΩ', digits: 2, min: 0, max: 100, infAbove: 1e6, zeroIsNone: true, help: 'Ausgangswiderstand der Stufe, hier gleich dem Kollektorwiderstand R_C.' },
    { key: 'fu', label: 'Untere Grenzfrequenz f_u', unit: 'Hz', digits: 1, min: 0, max: 1e6, zeroIsNone: true, help: 'Untere Grenzfrequenz aus den beiden Koppel-Hochpässen (exakt aus f_1 und f_2). Unter f_u fällt die Verstärkung ab.' },
    { key: 'uaus', label: 'Ausgangsspannung U_a (Spitze)', unit: 'V', digits: 3, min: 0, max: 15, help: 'Spitzenwert der Ausgangsspannung bei der eingestellten Amplitude und Frequenz, aus der Großsignalrechnung (mit Begrenzen) und mit der Wirkung der Koppelkondensatoren.' },
    { key: 'klirr', label: 'Klirrfaktor', unit: '%', digits: 2, min: 0, max: 100, help: 'Klirrfaktor aus den Oberwellen 2 bis 10 der Großsignalrechnung über genau eine Periode. Die Meldegrenze ist ein Übungswert (F6).' },
    { key: 'uaMax', label: 'Aussteuergrenze U_a,max', unit: 'V', digits: 3, min: 0, max: 15, zeroIsNone: true, help: 'Größte Ausgangsspitze ohne Begrenzen: das Kleinere aus Sperrgrenze und Sättigungsgrenze.' },
    { key: 'gm', label: 'Steilheit g_m', unit: 'mS', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Steilheit g_m = I_C / U_T (U_T = 26 mV, Übungswert, F3).' },
    { key: 'rbe', label: 'Eingangswiderstand der Basis r_BE', unit: 'kΩ', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Kleinsignal-Eingangswiderstand der Basis, r_BE = B / g_m.' }
  ];
  const SICHT = { kennlinie: 'Ausgangskennlinienfeld mit Arbeitsgerade und Arbeitspunkt', signal: 'Eingangs- und Ausgangsspannung über der Zeit (Phase 180°)', formel: 'V_u = −B · (R_C ∥ R_L) / (r_BE + (B + 1) · R_E1)' };
  const INFO = 'Emitterschaltung mit Basisspannungsteiler, Emitterkondensator und Koppelkondensatoren: Arbeitspunkt, Ausgangskennlinienfeld mit Arbeitsgerade und Wechselstrom-Arbeitsgerade, Spannungsverstärkung mit Phase 180°, Eingangs- und Ausgangswiderstand, Begrenzen und Klirrfaktor. ' + MODELL;

  const CL = c => (c === 'beide' ? 'oben und unten' : c || 'keines');
  const BASE_CTL = { ub: 12, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: true, b: 100, rg: 600, rl: 10000, c1: 10e-6, c2: 10e-6 };
  const PRESETS = [
    { id: 'standard', name: 'Standard (Referenz)', info: 'Übungsschaltung: ' + K(c => { const a = c.emit.ac(Object.assign({}, BASE_CTL, { c1: 10e-6, c2: 10e-6 })); return 'U_CE = ' + val(a.uce, 'V', 2) + ', I_C = ' + val(a.ic * 1000, 'mA', 2) + ', V_u = ' + val(a.vu, '', 2).replace('-', MINUS) + ' (Ausgang um ' + fm(a.phase, 0) + '° gedreht), V_u,Quelle = ' + val(a.vus, '', 2).replace('-', MINUS) + '.'; }),
      controls: {} },
    { id: 'gegenkopplung', name: 'Gegenkopplung (ohne C_E)', info: 'Übungsschaltung ohne Emitterkondensator: ' + K(c => { const a = c.emit.ac(Object.assign({}, BASE_CTL, { ce: false })), b = c.emit.ac(BASE_CTL); return 'Der Emitterwiderstand wirkt auch für das Signal als Gegenkopplung, |V_u| sinkt von ' + val(Math.abs(b.vu), '', 2) + ' auf ' + val(Math.abs(a.vu), '', 2) + ', der Eingangswiderstand steigt von ' + eng(b.rin, 'Ω') + ' auf ' + eng(a.rin, 'Ω') + '.'; }),
      controls: { ce: false } },
    { id: 'ap-unten', name: 'Arbeitspunkt zu tief (Pool S2025-21)', info: 'Fehlbild (Pool S2025-21: R_1 zu klein): ' + K(c => { const g = Object.assign({}, BASE_CTL, { r1: 27000, ue: 0.1, f: 1000 }), a = c.emit.ac(g), l = c.emit.large(g, 128); return 'Mit R_1 = 27 kΩ sinkt U_CE auf ' + val(a.uce, 'V', 2) + '; die Grenze nach unten liegt bei U_a = ' + val(a.uaMaxUnten, 'V', 2) + '. Bei ' + val(g.ue * 1000, 'mV', 0) + ' Amplitude wird die negative Halbwelle am Ausgang flach (Begrenzen ' + CL(l.clip) + ').'; }),
      controls: { r1: 27000, ue: 0.1 } },
    { id: 'ap-oben', name: 'Arbeitspunkt zu hoch', info: 'Fehlbild: ' + K(c => { const g = Object.assign({}, BASE_CTL, { r1: 100000, ue: 0.2, f: 1000 }), a = c.emit.ac(g), l = c.emit.large(g, 128); return 'Mit R_1 = 100 kΩ steigt U_CE auf ' + val(a.uce, 'V', 2) + ' bei nur ' + val(a.ic * 1000, 'mA', 2) + ' Kollektorstrom; die Grenze nach oben liegt bei U_a = ' + val(a.uaMaxOben, 'V', 2) + '. Bei ' + val(g.ue * 1000, 'mV', 0) + ' Amplitude wird die positive Halbwelle flach (Begrenzen ' + CL(l.clip) + ').'; }),
      controls: { r1: 100000, ue: 0.2 } },
    { id: 'uebersteuert', name: 'Übersteuert', info: 'Fehlbild: ' + K(c => { const g = Object.assign({}, BASE_CTL, { ue: 0.4, f: 1000 }), l = c.emit.large(g, 128); return 'Bei ' + val(g.ue * 1000, 'mV', 0) + ' Amplitude werden beide Halbwellen am Ausgang flach (Begrenzen ' + CL(l.clip) + '), der Klirrfaktor steigt auf ' + val(l.thdProzent, '%', 1) + '.'; }),
      controls: { ue: 0.4 } },
    { id: 'r2-offen', name: 'Fehlerbild: R2 offen', info: 'Fehlerbild der Simulation (nicht nachbauen): ' + K(c => { const a = c.emit.ac(Object.assign({}, BASE_CTL, { r2: OFFEN })); return 'Ohne R_2 steigt die Basisspannung auf fast U_B, der Transistor ist gesättigt (U_CE = ' + val(a.uce, 'V', 2) + ', I_C = ' + val(a.ic * 1000, 'mA', 2) + '), die Stufe verstärkt nicht mehr.'; }),
      controls: { fehler: 'r2 offen' } }
  ];


  function plant(P0) {
    const CORE = P0.CORE, CX = CORE.cx;
    const sw = { active: false, p: 0, prevClip: null };
    const okAc = a => a && a.ok !== false && a.valid !== false;
    const fw = CORE.limit && CORE.limit('ap_fenster') ? CORE.limit('ap_fenster').value : 0.15;
    const kg = CORE.limit && CORE.limit('klirr_grenze') ? CORE.limit('klirr_grenze').value : 0.05;
    const hp = (f, fc) => (fc > 0 && f > 0 ? CX.abs(CX.div(CX.make(1, 0), CX.make(1, -fc / f))) : 1);
    const ueRunOf = ctl => (sw.active && ctl.ue > 1e-3 ? 1e-3 * Math.pow(ctl.ue / 1e-3, sw.p) : ctl.ue);

    /** Fehlerfall -> Eingaben fuer den Kern (SPEC 5.3). */
    function cfgOf(ctl) {
      const cfg = { ub: ctl.ub, r1: ctl.r1, r2: ctl.r2, rc: ctl.rc, re1: ctl.re1, re2: ctl.re2, ce: !!ctl.ce, b: ctl.b, rg: ctl.rg, rl: ctl.rl >= 1e6 ? OFFEN : ctl.rl, c1: ctl.c1, c2: ctl.c2 };
      switch (ctl.fehler) {
        case 'r1 offen': cfg.r1 = OFFEN; break;
        case 'r2 offen': cfg.r2 = OFFEN; break;
        case 'rc offen': cfg.rc = OFFEN; break;
        case 're offen': cfg.re1 = OFFEN; cfg.re2 = OFFEN; break;
        case 'ce offen': cfg.ce = false; break;
        case 'c1 offen': cfg.c1 = 1e-12; break;
        case 'transistor defekt': cfg.defekt = 'be_offen'; break;
        case 'versorgung fehlt': cfg.ub = 1e-3; break;
        default: break;
      }
      return cfg;
    }
    const sineT = (t, ampl, f) => t.map(x => ampl * Math.sin(2 * Math.PI * f * x));

    function compute(ctl) {
      const cfg = cfgOf(ctl);
      const ac = CORE.emit.ac(cfg);
      if (!ac || ac.ok === false) return { ok: false, why: (ac && ac.why) || 'Die Eingabe ist ungültig.', cfg };
      const dc = CORE.tr.dc({ ub: cfg.ub, rc: cfg.rc, re: cfg.re1 + cfg.re2, b: cfg.b, basis: 'teiler', r1: cfg.r1, r2: cfg.r2, defekt: cfg.defekt });
      const line = CORE.emit.line(cfg);
      const valid = okAc(ac);
      const f1 = valid ? ac.f1 : 0, f2 = valid ? ac.f2 : 0;
      const h1 = valid ? hp(ctl.f, f1) : 0, h2 = valid ? hp(ctl.f, f2) : 0;
      const ueRun = ueRunOf(ctl);
      const mk = ue => { if (!valid) return null; const l = CORE.emit.large(Object.assign({}, cfg, { ue: ue * h1, f: ctl.f }), 128); return l && l.ok !== false && l.valid !== false ? l : null; };
      const largeRun = mk(ueRun), largeSet = sw.active ? mk(ctl.ue) : largeRun;
      return { ok: true, cfg, ac, dc, line, valid, f1, f2, h1, h2, ueRun, largeRun, largeSet, ctl: Object.assign({}, ctl) };
    }

    const zustandOf = r => { const z = r.ac.zustand || (r.dc && r.dc.zustand) || 'aktiv'; return z === 'defekt' ? 'sperrt' : z; };
    const zustandCode = z => (z === 'aktiv' ? 0 : z === 'sperrt' ? 1 : 2);
    function meters(r, ctl) {
      if (!r.ok) return { ic: 0, ib: 0, uce: 0, ues: 0, ube: 0, vu: 0, vus: 0, rin: 0, ra: 0, fu: 0, uaus: 0, klirr: 0, uaMax: 0, gm: 0, rbe: 0 };
      const a = r.ac, v = r.valid, l = r.largeRun;
      return { ic: a.ic * 1000, ib: (isNum(a.ib) ? a.ib : (r.dc && isNum(r.dc.ib) ? r.dc.ib : 0)) * 1000000, uce: a.uce, ues: a.ue, ube: r.dc && isNum(r.dc.ube) ? r.dc.ube : 0,
        vu: v ? a.vu : 0, vus: v ? a.vus : 0, rin: v ? a.rin / 1000 : 0, ra: v ? a.rout / 1000 : 0, fu: v ? a.fu : 0,
        uaus: l ? l.uaPeak * r.h2 : 0, klirr: l ? l.thdProzent : 0, uaMax: v ? a.uaMax : 0, gm: v ? a.gm * 1000 : 0, rbe: v ? a.rbe / 1000 : 0 };
    }

    function apRow(r, soll) {
      const d = Math.abs(r.ac.uce - soll), win = fw * r.cfg.ub;
      const ampel = d <= win + 1e-9 ? 'gruen' : d <= 2 * win + 1e-9 ? 'gelb' : 'rot';
      return { id: 'ap', ampel, margin: d / (r.cfg.ub || 1) * 100, text: 'Arbeitspunkt: U_CE = ' + val(r.ac.uce, 'V') + ', Vorgabe ' + val(soll, 'V') + ', Abweichung ' + val(d, 'V') + ' (grün bis ±' + fm(fw * 100, 0) + ' % von U_B = ±' + val(win, 'V') + ', gelb bis ±' + fm(2 * fw * 100, 0) + ' %; Lehrfaustwert, Übungswert F6).' };
    }
    function assess(r, ctl, o) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: ' + (o && o.verdeckt ? 'die Eingabe ist ungültig.' : r.why) };
      const z = zustandOf(r), rows = [];
      if (z !== 'aktiv') {
        const t = z === 'sperrt' ? 'Der Transistor leitet nicht: I_C = ' + val(r.ac.ic * 1000, 'mA', 2) + ', U_CE = ' + val(r.ac.uce, 'V', 2) + '.' : 'Der Transistor ist in der Sättigung: U_CE = ' + val(r.ac.uce, 'V', 2) + ', I_C = ' + val(r.ac.ic * 1000, 'mA', 2) + '.';
        const out = { ok: false, ampel: 'rot', text: t + ' Die Vorgabe ist so nicht erreichbar.', ziel: { uce: ctl.zielUce, vu: ctl.zielVu } };
        if (ctl.zielUce > 0) out.margin = Math.abs(r.ac.uce - ctl.zielUce);
        return out;
      }
      if (ctl.zielUce > 0) rows.push(apRow(r, ctl.zielUce));
      if (ctl.zielVu > 0) {
        const ist = Math.abs(r.ac.vu), pct = Math.abs(ist - ctl.zielVu) / ctl.zielVu * 100;
        rows.push({ id: 'vu', ampel: B.devAmpel(pct, CORE), margin: pct, text: B.devText('|V_u|', ist, ctl.zielVu, '', pct, CORE) });
      }
      const l = r.largeSet;
      if (l && l.clip) rows.push({ id: 'clip', ampel: 'rot', text: 'Der Ausgang wird begrenzt (' + l.clip + '): Die Aussteuerung ist zu groß oder der Arbeitspunkt liegt nicht in der Mitte.' });
      const order = { gruen: 0, gelb: 1, rot: 2 };
      let worst = 'gruen'; rows.forEach(x => { if (order[x.ampel] > order[worst]) worst = x.ampel; });
      const text = rows.map(x => x.text).join(' ');
      const m = rows.filter(x => isNum(x.margin)).map(x => x.margin);
      return { ok: worst === 'gruen', ampel: worst, text, margin: m.length ? Math.max.apply(null, m) : 0, ziel: { uce: ctl.zielUce, vu: ctl.zielVu }, rows: rows.map(x => ({ id: x.id, ampel: x.ampel, text: x.text })) };
    }

    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [], a = r.ac, z = zustandOf(r), ub = r.cfg.ub;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      const f = ctl.fehler;
      if (z === 'sperrt') push('sperrt', 'warn', 'Der Transistor leitet nicht: I_C = ' + val(a.ic * 1000, 'mA', 2) + ', U_CE = ' + val(a.uce, 'V', 2) + ' (gleich der Betriebsspannung). Es gibt keine Verstärkung.');
      if (z === 'saettigung') push('saettigung', 'warn', 'Der Transistor ist in der Sättigung: U_CE = ' + val(a.uce, 'V', 2) + ' (U_CE,sat), I_C = ' + val(a.ic * 1000, 'mA', 2) + '. Die Stufe verstärkt nicht mehr.');
      if (z === 'aktiv') {
        const l = r.largeSet;
        const oben = a.uce > ub * (0.5 + fw), unten = a.uce < ub * (0.5 - fw);
        if (unten) push('ap-unten', 'warn', 'Der Arbeitspunkt liegt zu tief: U_CE = ' + val(a.uce, 'V', 2) + ' bei U_B/2 = ' + val(ub / 2, 'V', 2) + ' (Fenster ±' + fm(fw * 100, 0) + ' % von U_B, Übungswert F6). Die Grenze nach unten liegt bei U_a = ' + val(a.uaMaxUnten, 'V', 2) + '.');
        if (oben) push('ap-oben', 'warn', 'Der Arbeitspunkt liegt zu hoch: U_CE = ' + val(a.uce, 'V', 2) + ' bei U_B/2 = ' + val(ub / 2, 'V', 2) + ' (Fenster ±' + fm(fw * 100, 0) + ' % von U_B, Übungswert F6). Die Grenze nach oben liegt bei U_a = ' + val(a.uaMaxOben, 'V', 2) + '.');
        if (l && (l.clip === 'unten' || l.clip === 'beide')) push('clip-unten', 'warn', 'Die negative Halbwelle am Ausgang ist flach: Der Transistor geht in die Sättigung (Begrenzen unten). Ausgangsspitze ' + val(l.uaPeak, 'V', 2) + ', Grenze nach unten ' + val(a.uaMaxUnten, 'V', 2) + '.');
        if (l && (l.clip === 'oben' || l.clip === 'beide')) push('clip-oben', 'warn', 'Die positive Halbwelle am Ausgang ist flach: Der Transistor sperrt (Begrenzen oben). Ausgangsspitze ' + val(l.uaPeak, 'V', 2) + ', Grenze nach oben ' + val(a.uaMaxOben, 'V', 2) + '.');
        if (l && l.thdProzent > kg * 100 && !l.clip) push('klirr-hoch', 'warn', 'Der Klirrfaktor ' + val(l.thdProzent, '%', 1) + ' liegt über der Meldegrenze ' + val(kg * 100, '%', 0) + ' (Übungswert, F6): Verringere die Eingangsamplitude.');
        else if (l && l.thdProzent > kg * 100 && l.clip) push('klirr-hoch', 'warn', 'Der Klirrfaktor beträgt ' + val(l.thdProzent, '%', 1) + ' (Meldegrenze ' + val(kg * 100, '%', 0) + ', Übungswert F6).');
        if (isNum(a.vuLeer) && Math.abs(a.vu) < Math.abs(a.vuLeer) * (1 - 1e-6)) push('vu-ohne-last', 'info', 'Die Last senkt die Verstärkung: unbelastet |V_u| = ' + val(Math.abs(a.vuLeer), '', 2) + ', belastet ' + val(Math.abs(a.vu), '', 2) + ' (R_C parallel R_L = ' + eng(a.rcl, 'Ω') + ').');
        if (ctl.f < a.fu) push('unter-fu', 'info', 'Die Frequenz ' + eng(ctl.f, 'Hz') + ' liegt unter f_u = ' + eng(a.fu, 'Hz') + ': Die Koppelkondensatoren dämpfen, U_a ist kleiner als im Durchlassbereich (U_a = ' + val(r.largeRun ? r.largeRun.uaPeak * r.h2 : 0, 'V', 3) + ').');
      }
      if (sw.active) push('durchlauf', 'info', 'Aussteuerungsdurchlauf: Die Eingangsamplitude beträgt jetzt ' + eng(r.ueRun, 'V') + '.');
      // Ursachen (nur wenn der Fehlerfall gesetzt ist; bei verdecktem Fehler unterdrueckt)
      const ce1 = f === 'ce offen' && CORE.emit.ac(Object.assign({}, r.cfg, { ce: true }));
      if (f === 'r1 offen') push('r1-offen', 'warn', 'R_1 ist offen (Fehlerfall der Simulation): Die Basisspannung fällt auf ' + val(r.dc.ubb, 'V', 3) + ' (unter U_BE), der Transistor sperrt, I_C = ' + val(a.ic * 1000, 'mA', 2) + '.', true);
      if (f === 'r2 offen') push('r2-offen', 'warn', 'R_2 ist offen (Fehlerfall der Simulation): Die Basisspannung steigt auf ' + val(r.dc.ubb, 'V', 2) + ', der Transistor geht in die Sättigung (U_CE = ' + val(a.uce, 'V', 2) + ').', true);
      if (f === 'rc offen') push('rc-offen', 'warn', 'R_C ist offen (Fehlerfall der Simulation): Es fließt kein Kollektorstrom, I_C = ' + val(a.ic * 1000, 'mA', 3) + ', der Ausgang liefert kein Signal.', true);
      if (f === 're offen') push('re-offen', 'warn', 'R_E ist offen (Fehlerfall der Simulation): Der Emitter hat keinen Weg nach Masse, I_C = ' + val(a.ic * 1000, 'mA', 3) + ', U_E steigt auf ' + val(a.ue, 'V', 2) + '.', true);
      if (f === 'ce offen' && ce1 && okAc(ce1)) push('ce-offen', 'warn', 'C_E ist offen (Fehlerfall der Simulation): R_E2 wirkt auch für das Signal als Gegenkopplung, |V_u| sinkt von ' + val(Math.abs(ce1.vu), '', 2) + ' auf ' + val(Math.abs(a.vu), '', 2) + '.', true);
      if (f === 'c1 offen') push('c1-offen', 'warn', 'C_1 ist offen (Fehlerfall der Simulation, 1 pF): Das Eingangssignal kommt nicht an die Basis, f_u steigt auf ' + eng(a.fu, 'Hz') + '; bei ' + eng(ctl.f, 'Hz') + ' ist U_a = ' + val(r.largeRun ? r.largeRun.uaPeak * r.h2 : 0, 'V', 4) + '.', true);
      if (f === 'transistor defekt') push('defekt', 'error', 'Der Transistor ist defekt (Fehlerfall der Simulation, nur Übung): I_C = ' + val(a.ic * 1000, 'mA', 2) + ', U_CE = ' + val(a.uce, 'V', 2) + '. Ein defekter Transistor wird ersetzt; hier wird nur das Messbild gelesen.', true);
      if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', 'Die Versorgung fehlt (Fehlerfall der Simulation): U_B ist nur ' + val(r.cfg.ub * 1000, 'mV', 0) + ', alle Spannungen und Ströme sind null.', true);
      return out;
    }
    /** Nur Messbefunde (bei verdecktem Fehler): nennen nie die Ursache. */
    function befund(r) {
      if (!r.ok) return [];
      const a = r.ac, z = zustandOf(r), out = [];
      out.push({ id: 'befund-ap', kind: 'info', text: 'Messbefund: U_CE = ' + val(a.uce, 'V', 3) + ', I_C = ' + val(a.ic * 1000, 'mA', 3) + ', U_E = ' + val(a.ue, 'V', 3) + (z === 'aktiv' ? ', |V_u| = ' + val(Math.abs(a.vu), '', 2) : '') + '.' });
      if (z === 'aktiv' && r.largeRun) out.push({ id: 'befund-ua', kind: 'info', text: 'Messbefund: U_a (Spitze) = ' + val(r.largeRun.uaPeak * r.h2, 'V', 4) + ' bei U_e = ' + eng(r.ueRun, 'V') + ' und f = ' + eng(r.ctl.f, 'Hz') + '; f_u = ' + eng(a.fu, 'Hz') + '.' });
      return out;
    }

    function waveform(r, ctl) {
      if (!r.ok) return null;
      const f = ctl.f, T = 1 / f, k = T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 };
      const l = r.largeRun;
      let t, ya, clip = [];
      if (l) {
        const n = l.t.length, tt = [], ua = [];
        for (let p = 0; p < 2; p++) for (let i = 0; i < n; i++) { tt.push(l.t[i] + p * T); ua.push(l.uout[i] * r.h2); }
        t = tt; ya = ua;
        const lo = r.ac.uaMaxUnten, hi = r.ac.uaMaxOben;
        let run = null;
        const flag = (x, i) => {
          const c = (isNum(lo) && x <= -lo * 0.995 && l.clip && l.clip !== 'oben') || (isNum(hi) && x >= hi * 0.995 && l.clip && l.clip !== 'unten');
          if (c && !run) run = { t0: t[i] * k.k, t1: t[i] * k.k };
          else if (c && run) run.t1 = t[i] * k.k;
          else if (!c && run) { clip.push(run); run = null; }
        };
        ya.forEach((x, i) => flag(x / (r.h2 || 1), i)); if (run) clip.push(run);
      } else {
        t = []; ya = [];
        for (let i = 0; i <= 128; i++) { t.push(2 * T * i / 128); ya.push(0); }
      }
      const yq = sineT(t, r.ueRun, f);
      const out = { tUnit: k.u, t: t.map(x => x * k.k), series: [{ name: 'u_e (Quelle)', unit: 'V', kind: 'u', y: yq }, { name: 'u_a', unit: 'V', kind: 'out', y: ya }], marks: { span: [{ t0: 0, t1: T * k.k, name: 'T' }] } };
      if (clip.length) out.clip = clip.map(c => ({ t0: c.t0, t1: c.t1, name: 'Begrenzen' }));
      return out;
    }

    function famOf(r) {
      const a = r.ac, ib0 = isNum(a.ib) && a.ib > 0 ? a.ib : (r.dc && r.dc.ib > 0 ? r.dc.ib : 2e-5), uces = [];
      for (let i = 0; i <= 60; i++) uces.push(r.cfg.ub * i / 60);
      return { ib0, fam: CORE.tr.family({ b: r.cfg.b, ub: r.cfg.ub }, [0.25, 0.5, 0.75, 1, 1.25, 1.5].map(q => q * ib0), uces) };
    }
    const memo = new WeakMap();
    function curves(r, ctl) {
      if (!r.ok) return [];
      if (memo.has(r)) return memo.get(r);
      const out = curvesRaw(r, ctl); memo.set(r, out); return out;
    }
    function curvesRaw(r, ctl) {
      const a = r.ac, out = [];
      const F0 = famOf(r), ib0 = F0.ib0, fam = F0.fam;
      if (fam && fam.ok !== false && r.line && r.line.ok !== false) {
        const ser = [];
        const ap = [a.uce, a.ic];
        fam.series.forEach(s => ser.push({ name: 'I_B = ' + eng(s.ib, 'A'), kind: Math.abs(s.ib - ib0) < 1e-12 * Math.max(1, ib0) ? 'i' : 'ghost', points: fam.uce.map((u, i) => [u, s.ic[i] * 1000]) }));
        const dcS = { name: 'Arbeitsgerade (Gleichstrom)', kind: 'line', points: r.line.dc.map(p => [p[0], p[1] * 1000]) };
        const acS = valid2(r) ? { name: 'Wechselstrom-Arbeitsgerade', kind: 'tangent', points: r.line.ac.map(p => [p[0], p[1] * 1000]) } : null;
        const series = [ser.find(s => s.kind === 'i') || ser[0], dcS].concat(acS ? [acS] : []).concat(ser.filter(s => s.kind === 'ghost'));
        out.push({ id: 'ausgang', title: 'Ausgangskennlinienfeld I_C über U_CE', xLabel: 'Spannung U_CE', xUnit: 'V', xScale: 'lin', yLabel: 'Kollektorstrom I_C', yUnit: 'mA', series, marker: { x: ap[0], y: ap[1] * 1000, label: 'Arbeitspunkt' },
          zones: [{ x0: 0, x1: CORE.limit('ucesat').value, name: 'Sättigungsbereich', kind: 'saett' }] });
      }
      if (valid2(r)) {
        const g = Object.assign({}, r.cfg, { f: 1000 }), ueM = Math.min(2, Math.max(a.ueMax * 3 * (a.rin + r.cfg.rg) / Math.max(a.rin, 1e-9), 1e-3));
        const l = CORE.emit.large(Object.assign({}, g, { ue: ueM }), 128);
        if (l && l.ok !== false && l.valid !== false) {
          const pts = l.uin.map((x, i) => [x, l.uout[i]]).sort((p, q) => p[0] - q[0]);
          const lim = a.uaMaxUnten < a.uaMaxOben ? { y: -a.uaMaxUnten, name: 'Aussteuergrenze unten' } : { y: a.uaMaxOben, name: 'Aussteuergrenze oben' };
          out.push({ id: 'uebertragung', title: 'Übertragungskennlinie U_a über U_e (Großsignal)', xLabel: 'Eingangsspannung U_e', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a', yUnit: 'V', series: [{ name: 'U_a', kind: 'out', points: pts }],
            marker: { x: 0, y: 0, label: 'Arbeitspunkt (Wechselanteil null)' }, limit: lim });
        }
        // Frequenzgang: Betrag von V_u,Quelle ueber der Frequenz (nur der untere Teil; oben gilt das Modell ideal)
        const fl = CORE.grid(Math.max(a.fu, 10), 61, 2, 3).filter(x => x > 0);
        if (fl.length > 2) {
          const pts = fl.map(x => [x, Math.abs(a.vus) * hp(x, r.f1) * hp(x, r.f2)]);
          out.push({ id: 'frequenzgang', title: 'Betrag der Spannungsverstärkung |V_u,Quelle| über der Frequenz', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Betrag |V_u,Quelle|', yUnit: '–', series: [{ name: '|V_u,Quelle|', kind: 'out', points: pts }],
            marker: { x: ctl.f, y: Math.abs(a.vus) * hp(ctl.f, r.f1) * hp(ctl.f, r.f2), label: 'eingestellte Frequenz' } });
        }
      }
      return out;
    }
    function valid2(r) { return r.ok && r.valid; }

    function state(r, ctl) {
      if (!r.ok) return { valid: false, zustand: '', zustandCode: 0, text: 'Die Eingabe ist ungültig.', ap: 0, clip: '', sweep: sw.active, sweepP: sw.p };
      const z = zustandOf(r), l = r.largeSet, a = r.ac;
      return { valid: r.valid, zustand: z, zustandCode: zustandCode(z), text: z === 'aktiv' ? 'Transistor aktiv: U_CE = ' + val(a.uce, 'V', 2) + ', I_C = ' + val(a.ic * 1000, 'mA', 2) + '.' : (z === 'sperrt' ? 'Kein Kollektorstrom: I_C = ' + val(a.ic * 1000, 'mA', 2) + ', U_CE = ' + val(a.uce, 'V', 2) + '.' : 'Sättigung: U_CE = ' + val(a.uce, 'V', 2) + ', I_C = ' + val(a.ic * 1000, 'mA', 2) + '.'),
        uce: a.uce, ic: a.ic, ib: isNum(a.ib) ? a.ib : 0, ue: a.ue, vu: r.valid ? a.vu : 0, vus: r.valid ? a.vus : 0, fu: r.valid ? a.fu : 0, f1: r.f1, f2: r.f2, h1: r.h1, h2: r.h2,
        clip: l && l.clip ? l.clip : '', uaPeak: l ? l.uaPeak * r.h2 : 0, thd: l ? l.thdProzent : 0, ueRun: r.ueRun, sweep: sw.active, sweepP: sw.p,
        apOben: r.valid ? a.uaMaxOben : 0, apUnten: r.valid ? a.uaMaxUnten : 0, ap: a.uce / (r.cfg.ub || 1) };
    }

    // ------------------------------------------------------------------- Zeichnen
    function wrapText(ctx, g, text, maxW, size, maxLines) {
      const words = String(text).split(' '), lines = []; let cur = '';
      ctx.font = g.font(size, false);
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines || 4);
    }
    function faultSpec(ctl, verdeckt) {
      if (verdeckt || ctl.fehler === 'keiner') return {};
      const m = { 'r1 offen': ['r1'], 'r2 offen': ['r2'], 'rc offen': ['rc'], 're offen': ['re1', 're2'], 'ce offen': ['ce'], 'c1 offen': ['c1'], 'transistor defekt': ['q'], 'versorgung fehlt': ['ub'] }[ctl.fehler];
      if (!m) return {};
      const nm = { 'r1 offen': 'R_1 offen', 'r2 offen': 'R_2 offen', 'rc offen': 'R_C offen', 're offen': 'R_E offen', 'ce offen': 'C_E offen', 'c1 offen': 'C_1 offen', 'transistor defekt': 'Transistor defekt', 'versorgung fehlt': 'Versorgung fehlt' }[ctl.fehler];
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
        wrapText(ctx, g, 'Die Eingabe ist ungültig.', R0.w - 16, 13, 4).forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const a = r.ac, chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - (chipsH ? gap : 0);
      const emph = ctl.ansicht, pk = emph === 'signal' ? 3 : 2, ps = emph === 'signal' ? 2 : 3;
      let P;
      if (R0.w >= 680) {
        const lw = Math.round(R0.w * 0.42), rw = R0.w - lw - gap;
        P = Object.assign(stackFit(R0.x, R0.y, lw, bodyH, [{ key: 'sch', min: 110, w: 0.62, p: 1 }, { key: 'strip', min: 56, w: 0.38, p: 2 }], gap),
          stackFit(R0.x + lw + gap, R0.y, rw, bodyH, [{ key: 'kenn', min: 140, w: emph === 'signal' ? 0.3 : 0.46, p: pk }, { key: 'sig', min: 140, w: emph === 'signal' ? 0.46 : 0.3, p: ps }, { key: 'spec', min: 110, w: 0.24, p: 4 }], gap));
      } else {
        P = stackFit(R0.x, R0.y, R0.w, bodyH, [{ key: 'sch', min: 110, w: 0.27, p: 1 }, { key: 'kenn', min: 140, w: 0.27, p: pk }, { key: 'sig', min: 140, w: 0.27, p: ps }, { key: 'strip', min: 56, w: 0.15, p: 4 }, { key: 'spec', min: 110, w: 0.12, p: 5 }], gap);
      }
      const sch = P.sch, kenn = P.kenn, sig = P.sig, spec = P.spec, strip = P.strip;
      // Schaltbild
      const L = {};
      L.ub = 'U_B = ' + val(r.cfg.ub, 'V', 1); L.ue = 'U_e = ' + eng(r.ueRun, 'V'); L.ib = 'I_B = ' + eng(isNum(a.ib) ? a.ib : 0, 'A'); L.ic = 'I_C = ' + eng(a.ic, 'A'); L.uce = 'U_CE = ' + val(a.uce, 'V', 2);
      L.ua = 'U_a = ' + eng(r.largeRun ? r.largeRun.uaPeak * r.h2 : 0, 'V');
      const vals = { r1: eng(ctl.r1, 'Ω'), r2: eng(ctl.r2, 'Ω'), rc: eng(ctl.rc, 'Ω'), re1: eng(ctl.re1, 'Ω'), re2: eng(ctl.re2, 'Ω'), rg: eng(ctl.rg, 'Ω'), rl: ctl.rl >= 1e6 ? 'offen' : eng(ctl.rl, 'Ω'), c1: eng(ctl.c1, 'F'), c2: eng(ctl.c2, 'F'), ce: 'C_E' };
      if (sch && !sc.view('schematic', sch, Object.assign({ kind: 'emitter', values: vals, labels: L, ce: !!ctl.ce }, faultSpec(ctl, hid)), {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
      // Kennlinie (Ausgangskennlinienfeld oder Uebertragung)
      const cv = view.rig.curves();
      if (!kenn) { /* kein Platz */ } else if (emph === 'uebertragung') {
        const c = cv.find(x => x.id === 'uebertragung');
        if (c) sc.view('curve', kenn, c, {}); else noData(ctx, g, kenn, pal, 'Keine Übertragungskennlinie: Der Transistor ist nicht aktiv.');
      } else {
        const c = cv.find(x => x.id === 'ausgang'), fam = famOf(r).fam;
        let done = false;
        if (fam && fam.ok !== false && r.line && r.line.ok !== false) {
          const lines = [{ name: 'Arbeitsgerade', kind: 'dc', points: r.line.dc }].concat(r.valid ? [{ name: 'Wechselstrom-Arbeitsgerade', kind: 'ac', points: r.line.ac }] : []);
          done = sc.view('family', kenn, { uce: fam.uce, series: fam.series, ucesat: CORE.limit('ucesat').value, lines, marker: { x: a.uce, y: a.ic, label: 'Arbeitspunkt' } }, {});
        }
        if (!done && c) sc.view('curve', kenn, c, {});
      }
      // Signal
      const wf = view.rig.waveform ? view.rig.waveform() : null;
      if (!sig) { /* kein Platz */ } else if (wf) sc.view('scope', sig, wf, {}); else noData(ctx, g, sig, pal, 'Kein Zeitverlauf.');
      // Klirr-Spektrum
      if (!spec) { /* kein Platz */ } else if (r.largeRun && spec.h >= 50) {
        const hm = r.largeRun.harm, items = [];
        for (let k = 1; k < hm.length; k++) items.push({ name: String(k + 1) + '.', value: hm[0] > 0 ? hm[k] / hm[0] * 100 : 0, unit: '%', kind: 'err' });
        const klirrTxt = 'Klirrfaktor ' + val(r.largeRun.thdProzent, '%', 2);
        if (!sc.view('bar', spec, { items, label: 'Oberwelle (Ordnung)', unit: '%', title: 'Oberwellen 2 bis 10, ' + klirrTxt, mark: { value: kg * 100, name: 'Meldegrenze' } }, {})) noData(ctx, g, spec, pal, klirrTxt);
      } else noData(ctx, g, spec, pal, 'Kein Klirrspektrum: kein Wechselsignal am Ausgang.');
      // Formel
      if (strip) {
        g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
        const reac = r.cfg.ce ? r.cfg.re1 : r.cfg.re1 + r.cfg.re2;
        const rows = [{ t: 'V_u = −B · (R_C ∥ R_L) / (r_BE + (B + 1) · R_E,ac)', bold: true, color: pal.fg }];
        if (r.valid) {
          rows.push({ t: '= −' + fm(r.cfg.b, 0) + ' · ' + eng(a.rcl, 'Ω') + ' / (' + eng(a.rbe, 'Ω') + ' + ' + fm(r.cfg.b + 1, 0) + ' · ' + eng(reac, 'Ω') + ') = ' + val(a.vu, '', 2), color: pal.fg });
          rows.push({ t: 'r_BE = B / g_m, g_m = ' + val(a.gm * 1000, 'mS', 1) + ', V_u,Quelle = ' + val(a.vus, '', 2) + ', Phase ' + fm(a.phase, 0) + '°', color: pal.mute });
        } else {
          rows.push({ t: 'Die Formel gilt nur im aktiven Bereich: ' + (zustandOf(r) === 'sperrt' ? 'Der Transistor leitet nicht (I_C = ' + val(a.ic * 1000, 'mA', 2) + ').' : 'Der Transistor ist gesättigt (U_CE = ' + val(a.uce, 'V', 2) + ').'), color: pal.mute });
        }
        g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
      }
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = [['U_CE', val(a.uce, 'V', 2)], ['I_C', val(a.ic * 1000, 'mA', 2)], ['V_u', r.valid ? val(a.vu, '', 2) : '–'], ['U_a', val(r.largeRun ? r.largeRun.uaPeak * r.h2 : 0, 'V', 2)]];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    function noData(ctx, g, rc, pal, msg) {
      g.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 6);
      wrapText(ctx, g, msg, rc.w - 16, 12, 3).forEach((ln, k) => g.text(ctx, ln, rc.x + 8, rc.y + 18 + k * 16, { size: 12, color: pal.mute, max: rc.w - 16 }));
    }

    return {
      compute, meters, assess, diag, befund, curves, waveform, state, draw,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        sw.p += dtMs / (SWEEP_S * 1000);
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say('Der Aussteuerungsdurchlauf ist beendet: Die Eingangsamplitude hat die Einstellung ' + eng(ctl.ue, 'V') + ' erreicht.', 'info'); P0.bump(); return; }
        const l = r && r.largeRun;
        const cl = l ? (l.clip || null) : null;
        if (cl !== sw.prevClip) {
          if (cl) P0.say('Ab U_e = ' + eng(r.ueRun, 'V') + ' wird der Ausgang begrenzt (' + cl + ').', 'warn');
          sw.prevClip = cl;
        }
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 0; P0.say('Der Aussteuerungsdurchlauf wurde abgebrochen.', 'info'); P0.bump(); return true; }
        if (!r.ok || !r.valid) { P0.say('Mit diesen Werten gibt es nichts auszusteuern: Der Transistor ist nicht im aktiven Bereich.', 'warn'); return false; }
        if (!(ctl.ue > 1e-3)) { P0.say('Die Eingangsamplitude steht schon auf dem Minimum von 1 mV.', 'info'); return true; }
        sw.active = true; sw.p = 0; sw.prevClip = null;
        P0.say('Aussteuerungsdurchlauf: Die Eingangsamplitude steigt von 1 mV auf ' + eng(ctl.ue, 'V') + '. Beobachte Ausgang, Klirrfaktor und das Begrenzen.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; sw.prevClip = null; }
    };
  }

  R.register({ id: 'emitter', name: 'Emitterschaltung', icon: '📶', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'emitter', name: 'Emitterschaltung', icon: '📶', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['zielUce', 'zielVu'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
