/* anarig-opvnin.js - ANA-Lab (WP2c): Pruefstand 6 `opv_nin` - Nichtinvertierender Verstaerker, Spannungsfolger, Differenzverstaerker (SPEC 5.6).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.op.nin / folger / diff / freq / wave / fpb, ANA_CORE.limit); hier steht keine zweite Verstaerkerformel.
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteil- und OPV-Werte sind Uebungswerte (F9).
 * Modell: Operationsverstaerker ideal (Standard) oder real mit einem Pol (langsam, schnell), Offsetspannung nur als Spannung, keine Eingangsstroeme; die Last aendert U_a nicht
 *   (der Ausgang ist eine Spannungsquelle mit kleinem r_aus), sie bestimmt nur den Ausgangsstrom I_a (Anzeige, F21).
 * Schaltungen: nichtinvertierend (V_u = 1 + R_f / R_g, nie unter 1), folger (V_u = 1, belegt) und differenz (U_a = U_2 * R_4/(R_2+R_4) * (1 + R_3/R_1) - U_1 * R_3/R_1;
 *   Namen wie im Pool: R_1 von U_1 zum -Eingang, R_2 von U_2 zum +Eingang, R_3 Rueckkopplung, R_4 vom +Eingang nach Masse). Beim Differenzverstaerker sind U_1 und U_2 Gleichspannungen,
 *   V_u (Messgeraet v, Vorgabe zielV) ist dort die Verstaerkung a2 von U_2.
 * Fehlerfaelle (nur Simulation), Umsetzung VOR dem Kernaufruf: rf offen -> R_f = R_OFFEN (beim Differenzverstaerker R_3), rg offen -> R_g = R_OFFEN (V_u = 1; beim Differenzverstaerker R_4),
 *   versorgung minus fehlt -> uvn = 0, versorgung fehlt -> uv = 0 und uvn = 0, versorgung verpolt -> Lehrmodell: Operationsverstaerker zerstoert, Ausgang 0 V (nur Simulation),
 *   eingang offen -> U_e = 0 (beim Differenzverstaerker U_2 = 0). Beim Folger haben rf offen und rg offen keine Wirkung (die Bauteile fehlen).
 * Steuerwerte (SI): schaltung, opv, uv (V), form, ue (V; Gleichwert bzw. Amplitude), f (Hz), rg, rf (Ohm), u1, u2 (V), r1, r2, r3, r4 (Ohm), rl (Ohm, 1 MOhm = Leerlauf), fehler,
 *   zielV (V_u, 0 = keine), Taste fire (Frequenzdurchlauf 10 Hz bis 10 MHz).
 * Messgeraete: v, vId, ua, uaPeak, ri (Ohm), ra (Ohm), fg (Hz; ideal: unbegrenzt), usat, sat (0 nein, 1 ja), up (V am +Eingang), a1, a2, vgl (nur Differenzverstaerker, sonst 0).
 * Ampel (nur mit Vorgabe): gruen = |V_u| auf 2 % getroffen und nicht begrenzt, gelb 2-5 %, rot = verfehlt oder Ausgang an der Aussteuergrenze (Fenster aus ANA_CORE.limits, Uebungswert F16).
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-opvnin.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = 'Modell: Operationsverstärker ideal (Standard) oder real mit einem Pol (langsam, schnell; Übungswerte, F9); Offsetspannung nur als Spannung, keine Eingangsströme, Last ändert U_a nicht. ' + (T0.opvModell || '') + ' ' + (T0.gegenkopplung || '');
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12;
  const SWEEP_S = 6;                                      // Dauer des Frequenzdurchlaufs (s, Zeitlupe verlaengert)
  const N_WAVE = 256, N_CURVE = 40;

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const when = (key, vals) => ({ visible: st => !st || vals.indexOf(st[key]) >= 0 });
  const FEHLER = [['keiner', 'kein Fehler'], ['rf offen', 'R_f offen'], ['rg offen', 'R_g offen'], ['versorgung minus fehlt', 'negative Versorgung fehlt'], ['versorgung fehlt', 'Versorgung fehlt'], ['versorgung verpolt', 'Versorgung verpolt'], ['eingang offen', 'Eingang offen']];
  const OPVS = [['ideal', 'ideal'], ['langsam', 'real, langsam'], ['schnell', 'real, schnell']];
  const FORMEN = [['gleich', 'Gleichspannung'], ['sinus', 'Sinus'], ['rechteck', 'Rechteck'], ['dreieck', 'Dreieck']];
  const SIG = ['nichtinvertierend', 'folger'];
  const CONTROLS = B.fillControls([
    { key: 'schaltung', label: 'Schaltung', type: 'select', value: 'nichtinvertierend', options: opt([['nichtinvertierend', 'Nichtinvertierender Verstärker'], ['folger', 'Spannungsfolger'], ['differenz', 'Differenzverstärker']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Wählt die Schaltung: Der nichtinvertierende Verstärker hat V_u = 1 + R_f / R_g (nie unter 1, gleichphasig), der Spannungsfolger V_u = 1, der Differenzverstärker verstärkt die Differenz von U_2 und U_1.' },
    { key: 'opv', label: 'Operationsverstärker', type: 'select', value: 'ideal', options: opt(OPVS), gruppe: 'ziel', sicht: 'formel',
      help: 'Wählt das Lehrmodell: ideal (kein Frequenzgang, Aussteuergrenze gleich der Betriebsspannung) oder real mit Verstärkungs-Bandbreite-Produkt, Slew-Rate, Offsetspannung und Aussteuergrenze unter der Betriebsspannung (Übungswerte, F9).' },
    { key: 'uv', label: 'Betriebsspannung (±)', type: 'slider', scale: 'lin', min: 5, max: 18, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betrag der symmetrischen Betriebsspannung ±U_v (Kleinspannung, Übungswert F10). Der Ausgang kann nie über diese Spannung hinaus steuern; real bleibt er noch etwas darunter.' },
    { key: 'form', label: 'Eingangsform', type: 'select', value: 'sinus', options: opt(FORMEN), gruppe: 'quelle', sicht: 'signal', ...when('schaltung', SIG),
      help: 'Form der Eingangsspannung für das Zeitbild: Gleichspannung, Sinus, Rechteck oder Dreieck. Beim Differenzverstärker sind U_1 und U_2 Gleichspannungen.' },
    { key: 'ue', label: 'Eingangsspannung (Gleichwert bzw. Amplitude)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 0.25, gruppe: 'quelle', sicht: 'signal', ...when('schaltung', SIG),
      help: 'Eingangsspannung am +Eingang: bei Gleichspannung der Wert, sonst die Amplitude (Spitzenwert). Über U_sat / V_u läuft der Ausgang in die Sättigung.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 1, max: 1e6, step: 1, unit: 'Hz', unitKind: 'Hz', value: 1000, gruppe: 'quelle', sicht: 'signal', ...when('schaltung', SIG),
      help: 'Frequenz der Eingangsspannung. Der ideale Operationsverstärker hat keinen Frequenzgang; der reale verstärkt ab der Grenzfrequenz f_g weniger und ist durch die Slew-Rate bei großer Amplitude begrenzt.' },
    { key: 'rg', label: 'Widerstand nach Masse Rg', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['nichtinvertierend']),
      help: 'Widerstand R_g vom −Eingang nach Masse. Ein kleineres R_g vergrößert V_u = 1 + R_f / R_g. Ist R_g offen, ist V_u = 1 (Folger). Übungswert.' },
    { key: 'rf', label: 'Rückkopplungswiderstand Rf', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['nichtinvertierend']),
      help: 'Rückkopplungswiderstand R_f vom Ausgang zum −Eingang. Ein größeres R_f vergrößert V_u = 1 + R_f / R_g. Ohne R_f (offen) fehlt die Gegenkopplung. Übungswert.' },
    { key: 'u1', label: 'Spannung U1 (an den invertierenden Eingang)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 1.6, gruppe: 'quelle', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Gleichspannung U_1 am Eingang des Differenzverstärkers, über R_1 an den −Eingang; sie wird mit −R_3 / R_1 verstärkt.' },
    { key: 'u2', label: 'Spannung U2 (an den nichtinvertierenden Eingang)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 2.1, gruppe: 'quelle', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Gleichspannung U_2 am Eingang des Differenzverstärkers, über R_2 an den +Eingang; sie wird mit R_4 / (R_2 + R_4) · (1 + R_3 / R_1) verstärkt.' },
    { key: 'r1', label: 'R1 (U1 zum invertierenden Eingang)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Widerstand R_1 von U_1 zum −Eingang. Ein kleineres R_1 vergrößert die Verstärkung −R_3 / R_1 von U_1. Übungswert.' },
    { key: 'r2', label: 'R2 (U2 zum nichtinvertierenden Eingang)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Widerstand R_2 von U_2 zum +Eingang; mit R_4 bildet er den Spannungsteiler am +Eingang. Übungswert.' },
    { key: 'r3', label: 'R3 (Rückkopplung)', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Rückkopplungswiderstand R_3 vom Ausgang zum −Eingang. Gleichtaktfrei (abgeglichen) ist die Schaltung, wenn R_4 / R_2 = R_3 / R_1 gilt. Übungswert.' },
    { key: 'r4', label: 'R4 (nichtinvertierender Eingang nach Masse)', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['differenz']),
      help: 'Widerstand R_4 vom +Eingang nach Masse. Stimmt R_4 / R_2 nicht mit R_3 / R_1 überein, erscheint ein Gleichtaktanteil am Ausgang. Übungswert.' },
    { key: 'rl', label: 'Lastwiderstand (oberer Anschlag = Leerlauf)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'last', sicht: 'formel',
      help: 'Lastwiderstand R_L am Ausgang. Im Lehrmodell ändert er U_a nicht (kleiner Ausgangswiderstand); er bestimmt den Ausgangsstrom I_a = U_a / R_L. Am oberen Anschlag (1 MΩ) gilt der Ausgang als unbelastet (Leerlauf). Übungswert, F21.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): R_f oder R_g offen, negative oder ganze Versorgung fehlt oder verpolt, Eingang offen. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'zielV', label: 'Vorgabe V_u (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 1000, step: 0.1, unit: '', unitKind: '', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für die Spannungsverstärkung V_u (beim Differenzverstärker die Verstärkung von U_2); bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16), der Ausgang darf nicht begrenzt sein.' },
    { key: 'fire', label: 'Frequenzdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'signal',
      help: 'Startet den Frequenzdurchlauf: f läuft von 10 Hz bis 10 MHz. Beim realen Operationsverstärker fällt die Verstärkung ab f_g, Phase und Slew-Rate werden sichtbar; der ideale hat keinen Frequenzgang. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'v', label: 'Spannungsverstärkung V_u', unit: '', digits: 3, min: -1000, max: 1000, help: 'Spannungsverstärkung mit Vorzeichen, real mit Verstärkungsfehler; beim nichtinvertierenden Verstärker nie unter 1, beim Differenzverstärker die Verstärkung von U_2.' },
    { key: 'vId', label: 'Ideale Verstärkung', unit: '', digits: 3, min: -1000, max: 1000, help: 'Verstärkung des idealen Operationsverstärkers: V_u = 1 + R_f / R_g (Folger 1, Differenzverstärker a2).' },
    { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V', digits: 3, min: -20, max: 20, help: 'Ausgangsspannung (bei Wechselgrößen der Spitzenwert), auf die Aussteuergrenzen begrenzt.' },
    { key: 'uaPeak', label: 'Spitzenwert U_a (Zeitbild)', unit: 'V', digits: 3, min: 0, max: 20, help: 'Größter Betrag der Ausgangsspannung im Zeitbild; real mit Frequenzgang, Slew-Rate und Begrenzen.' },
    { key: 'ri', label: 'Eingangswiderstand r_ein', unit: 'Ω', digits: 1, min: 0, max: 1e12, infAbove: 1e11, zeroIsNone: true, help: 'Eingangswiderstand am +Eingang: ideal unendlich (Anzeige ∞), real R_id · (1 + A_0 · β), sehr groß. Beim Differenzverstärker nicht angegeben.' },
    { key: 'ra', label: 'Ausgangswiderstand r_aus', unit: 'Ω', digits: 4, min: 0, max: 100, help: 'Ausgangswiderstand der gegengekoppelten Schaltung: beim idealen Operationsverstärker 0, real R_o / (1 + A_0 · β), sehr klein.' },
    { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz', digits: 0, min: 0, max: 1e7, infAbove: 1e11, infText: 'unbegrenzt', help: 'Grenzfrequenz der Schaltung (−3 dB) beim realen Operationsverstärker; beim idealen ist der Frequenzgang unbegrenzt (Anzeige ∞).' },
    { key: 'usat', label: 'Aussteuergrenze U_sat', unit: 'V', digits: 2, min: 0, max: 20, help: 'Größte positive Ausgangsspannung: ideal gleich der Betriebsspannung, real 1,5 V darunter (Übungswert, F9).' },
    { key: 'sat', label: 'Begrenzen', unit: '', digits: 0, min: 0, max: 1, texts: ['nein', 'ja'], help: 'Ja, wenn der Ausgang an der Aussteuergrenze liegt: Die lineare Verstärkung gilt dann nicht mehr.' },
    { key: 'up', label: 'Spannung am +Eingang U_+', unit: 'V', digits: 3, min: -20, max: 20, help: 'Spannung am nichtinvertierenden Eingang: beim Verstärker und Folger die Eingangsspannung, beim Differenzverstärker U_2 · R_4 / (R_2 + R_4).' },
    { key: 'a1', label: 'Verstärkung von U_1', unit: '', digits: 3, min: -1000, max: 1000, zeroIsNone: true, help: 'Nur Differenzverstärker: Verstärkung von U_1, a1 = −R_3 / R_1 (negativ, real mit Verstärkungsfehler).' },
    { key: 'a2', label: 'Verstärkung von U_2', unit: '', digits: 3, min: -1000, max: 1000, zeroIsNone: true, help: 'Nur Differenzverstärker: Verstärkung von U_2, a2 = R_4 / (R_2 + R_4) · (1 + R_3 / R_1).' },
    { key: 'vgl', label: 'Gleichtaktverstärkung V_gl', unit: '', digits: 4, min: -1000, max: 1000, zeroIsNone: true, help: 'Nur Differenzverstärker: Gleichtaktverstärkung a1 + a2. Null ergibt sich, wenn R_4 / R_2 = R_3 / R_1 gilt (abgeglichen).' }
  ];
  const SICHT = { kennlinie: 'Übertragungskennlinie U_a(U_e) mit Aussteuergrenzen', signal: 'Eingang und Ausgang über der Zeit (gleichphasig)', formel: 'V_u = 1 + R_f / R_g' };
  const INFO = 'Nichtinvertierender Verstärker, Spannungsfolger (Impedanzwandler) und Differenzverstärker; ideal oder real (Frequenzgang, Slew-Rate, Aussteuergrenze, Offset). ' + MODELL;

  const PRESETS = [
    { id: 'v-5-7', name: 'Verstärkung 5,7 (Pool H2024-19)', info: 'Übungsschaltung (Pool H2024-19): ' + K(c => { const q = c.op.nin({ rg: 10000, rf: 47000, ue: 0.25 }); return 'Mit R_g = 10 kΩ und R_f = 47 kΩ ist V_u = ' + val(q.v, '', 3) + ', bei U_e = 0,25 V ist U_a = ' + val(q.ua, 'V', 3) + '.'; }),
      controls: { schaltung: 'nichtinvertierend', rg: 10000, rf: 47000, form: 'gleich', ue: 0.25 } },
    { id: 'folger', name: 'Spannungsfolger (Pool F2025-11)', info: 'Übungsschaltung (Pool F2025-11): ' + K(c => { const q = c.op.folger({ ue: 0.25 }); return 'Der Spannungsfolger hat V_u = ' + val(q.v, '', 1) + ' (belegt), U_a = U_e = ' + val(q.ua, 'V', 2) + '; er trennt Quelle und Last (Impedanzwandler): r_ein sehr groß, r_aus klein.'; }),
      controls: { schaltung: 'folger' } },
    { id: 'differenz', name: 'Differenzverstärker (Pool W2025-29)', info: 'Übungsschaltung (Pool W2025-29): ' + K(c => { const q = c.op.diff({ r1: 10000, r2: 10000, r3: 47000, r4: 47000, u1: 1.6, u2: 2.1 }); return 'Mit R_1 = R_2 = 10 kΩ, R_3 = R_4 = 47 kΩ, U_1 = 1,6 V und U_2 = 2,1 V ist U_a = ' + val(q.ua, 'V', 2) + '; die Gleichtaktverstärkung ist ' + val(q.vgl, '', 2) + ' (abgeglichen).'; }),
      controls: { schaltung: 'differenz', u1: 1.6, u2: 2.1, r1: 10000, r2: 10000, r3: 47000, r4: 47000 } },
    { id: 'v-11-real', name: 'Realer Verstärker, Grenzfrequenz', info: 'Übungsschaltung: ' + K(c => { const q = c.op.nin({ rg: 10000, rf: 100000, ue: 0.25, f: 90919, opv: 'langsam' }); return 'Mit V_n = 11 ist die Grenzfrequenz des langsamen Operationsverstärkers f_g = ' + eng(q.fg, 'Hz') + '; bei f = 90,919 kHz ist der Betrag auf ' + val(q.hf, '', 3) + ' von ' + val(q.v, '', 3) + ' gefallen.'; }),
      controls: { schaltung: 'nichtinvertierend', opv: 'langsam', rg: 10000, rf: 100000, f: 90919 } },
    { id: 'rg-offen', name: 'Fehlerbild: R_g offen', info: 'Fehlerbild der Simulation: Ist R_g offen, fließt kein Strom durch R_f, die Rückkopplung ist ein Draht und V_u = 1 (Folger).',
      controls: { fehler: 'rg offen' } }
  ];

  const FN = { 'rf offen': 'R_f ist offen', 'rg offen': 'R_g ist offen', 'versorgung minus fehlt': 'Die negative Versorgung fehlt', 'versorgung fehlt': 'Die Versorgung fehlt', 'versorgung verpolt': 'Die Versorgung ist verpolt', 'eingang offen': 'Der Eingang ist offen' };

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0 };
    const lim = (id, d) => { try { const l = CORE.limit(id); return l && isNum(l.value) ? l.value : d; } catch (e) { return d; } };
    const srOf = opv => (opv === 'langsam' ? lim('sr_langsam', 5e5) : opv === 'schnell' ? lim('sr_schnell', 1.3e7) : NaN);
    const fEffOf = ctl => (sw.active ? 10 * Math.pow(1e6, sw.p) : ctl.f);

    /* Fehlerfall -> Eingaben des Kerns (VOR dem Kernaufruf) */
    function inputs(ctl) {
      const f = ctl.fehler, m = ctl.schaltung, o = { rg: ctl.rg, rf: ctl.rf, r1: ctl.r1, r2: ctl.r2, r3: ctl.r3, r4: ctl.r4, ue: ctl.ue, u1: ctl.u1, u2: ctl.u2, uv: ctl.uv, uvn: ctl.uv, wirkt: true };
      if (f === 'rf offen') { if (m === 'nichtinvertierend') o.rf = OFFEN; else if (m === 'differenz') o.r3 = OFFEN; else o.wirkt = false; }
      else if (f === 'rg offen') { if (m === 'nichtinvertierend') o.rg = OFFEN; else if (m === 'differenz') o.r4 = OFFEN; else o.wirkt = false; }
      else if (f === 'eingang offen') { if (m === 'differenz') o.u2 = 0; else o.ue = 0; }
      else if (f === 'versorgung minus fehlt') o.uvn = 0;
      else if (f === 'versorgung fehlt') { o.uv = 0; o.uvn = 0; }
      return o;
    }
    const band = (t, on) => {   // zusammenhaengende Abschnitte, in denen on(i) gilt, als { t0, t1 }
      const out = [], n = t.length; let a = -1;
      for (let i = 0; i < n; i++) {
        const o = on(i);
        if (o && a < 0) a = i;
        if (a >= 0 && (!o || i === n - 1)) { const e = o ? i : i - 1; out.push({ t0: t[a], t1: e > a ? t[e] : t[Math.min(a + 1, n - 1)] }); a = -1; }
      }
      return out;
    };

    function compute(ctl) {
      const m = ctl.schaltung, diff = m === 'differenz', fold = m === 'folger', fe = ctl.fehler, fEff = fEffOf(ctl), inp = inputs(ctl);
      const base = { opv: ctl.opv, uv: inp.uv, uvn: inp.uvn };
      let q, id, wave = null, hf = NaN, phiF = NaN, vn, rEqF;
      if (diff) {
        const cfg = Object.assign({ r1: inp.r1, r2: inp.r2, r3: inp.r3, r4: inp.r4, u1: inp.u1, u2: inp.u2 }, base);
        q = CORE.op.diff(cfg);
        if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Die Eingabe ist ungültig.' };
        id = CORE.op.diff(Object.assign({}, cfg, { opv: 'ideal' }));
        vn = q.vn; rEqF = { art: 'inv', r1: inp.r1, rf: inp.r3 };
      } else {
        const cfg = Object.assign({ rg: inp.rg, rf: inp.rf, ue: inp.ue, f: fEff }, base);
        q = fold ? CORE.op.folger(cfg) : CORE.op.nin(cfg);
        if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Die Eingabe ist ungültig.' };
        id = fold ? CORE.op.folger(Object.assign({}, cfg, { opv: 'ideal' })) : CORE.op.nin(Object.assign({}, cfg, { opv: 'ideal' }));
        wave = CORE.op.wave(Object.assign({ art: fold ? 'folger' : 'nin', rg: inp.rg, rf: inp.rf, ue: inp.ue, f: fEff, form: ctl.form }, base), N_WAVE);
        hf = q.hf; phiF = q.phiF; vn = q.vn; rEqF = { art: 'nin', rg: inp.rg, rf: fold ? 0 : inp.rf };
      }
      const ideal = ctl.opv === 'ideal';
      let fr = null;
      if (!ideal) {
        const fl = CORE.grid(1000, 57, 3, 4), c = Object.assign({}, rEqF, base);
        fr = CORE.op.freq(c, fl);
        const open = CORE.op.freq(Object.assign({}, c, { art: 'offen' }), fl), at = CORE.op.freq(c, [Math.max(1, Math.min(1e7, fEff))]);
        if (fr && fr.ok !== false && open && open.ok !== false && at && at.ok !== false) fr = Object.assign({}, fr, { open: open.a, openFg: open.fg, aAt: at.a[0], fAt: at.f[0] }); else fr = null;
      }
      const defekt = fe === 'versorgung verpolt', w = wave && wave.ok !== false ? wave : null;
      const v0 = diff ? q.a2 : q.v, vId = diff ? id.a2 : id.vId;
      let ua = q.ua, sat = q.sat, uaPeak = w ? w.uaPeak : Math.abs(q.ua), v = v0;
      if (defekt) { ua = 0; sat = false; uaPeak = 0; v = 0; }   // Lehrmodell: Operationsverstaerker zerstoert, Ausgang 0 V
      const ia = ua / ctl.rl;
      return { ok: true, mode: m, diff, fold, fe, defekt, wirkt: inp.wirkt, q, id, w, fr, fEff, ideal, v, v0, vId, ua, sat, uaPeak, hf, phiF, vn, ri: diff ? 0 : q.ri, ra: q.ra, fg: q.fg, usat: q.usat, usatN: q.usatN,
        up: diff ? q.up : inp.ue, a1: diff ? q.a1 : 0, a2: diff ? q.a2 : 0, vgl: diff ? q.vgl : 0, ia, inp, cfgBase: base, ctl: Object.assign({}, ctl) };
    }

    function meters(r) {
      const o = { v: 0, vId: 0, ua: 0, uaPeak: 0, ri: 0, ra: 0, fg: 0, usat: 0, sat: 0, up: 0, a1: 0, a2: 0, vgl: 0 };
      if (!r.ok) return o;
      o.v = r.v; o.vId = r.vId; o.ua = r.ua; o.uaPeak = r.uaPeak; o.ri = r.ri; o.ra = r.ra; o.fg = isNum(r.fg) ? r.fg : 1e12; o.usat = r.usat; o.sat = r.sat ? 1 : 0;
      o.up = r.up; o.a1 = r.a1; o.a2 = r.a2; o.vgl = r.vgl;
      return o;
    }

    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: ' + r.why };
      const z = ctl.zielV, ist = Math.abs(r.v);
      const ziel = { text: 'V_u = ' + val(z, ''), soll: z, ist, unit: '' };
      if (r.sat) return { ok: false, ampel: 'rot', ziel, text: 'Der Ausgang liegt an der Aussteuergrenze (U_a = ' + val(r.ua, 'V', 2) + ', U_sat = ' + val(r.usat, 'V', 2) + '): Die Vorgabe V_u = ' + val(z, '') + ' ist so nicht erreicht.' };
      const pct = Math.abs(ist - z) / z * 100, ampel = B.devAmpel(pct, CORE, 'op');
      return { ok: ampel === 'gruen', ampel, margin: pct, ziel, text: B.devText('Verstärkung V_u', ist, z, '', pct, CORE, 'op') };
    }

    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [], f = ctl.fehler, q = r.q;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      const ue = r.diff ? NaN : r.inp.ue, ueTxt = r.diff ? 'U_1 = ' + val(ctl.u1, 'V', 2) + ', U_2 = ' + val(ctl.u2, 'V', 2) : 'U_e = ' + val(ctl.ue, 'V', 3);
      if (f === 'rf offen') {
        if (!r.wirkt) push('rf-offen', 'info', 'Der Spannungsfolger hat kein R_f: Der Fehlerfall ändert nichts.', true);
        else {
          push('rf-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): Es gibt keine Rückkopplung vom Ausgang zum −Eingang. U_a = ' + val(r.ua, 'V', 2) + ' bei ' + ueTxt + '.', true);
          push('ohne-gegenkopplung', 'warn', (T0.gegenkopplung || 'Ohne Gegenkopplung arbeitet der Operationsverstärker als Komparator und läuft in die Sättigung.') + ' Hier: U_a = ' + val(r.ua, 'V', 2) + ', Aussteuergrenze U_sat = ' + val(r.usat, 'V', 2) + '.', true);
        }
      }
      if (f === 'rg offen') {
        if (!r.wirkt) push('rg-offen', 'info', 'Der Spannungsfolger hat kein R_g: Der Fehlerfall ändert nichts.', true);
        else push('rg-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): ' + (r.diff ? 'R_4 fehlt, der +Eingang hängt nur an R_2, a2 = ' + val(q.a2, '', 3) + ', U_a = ' + val(r.ua, 'V', 3) : 'Durch R_f fließt kein Strom, V_u = ' + val(q.v, '', 3) + ' (Folger), U_a = ' + val(r.ua, 'V', 3) + ' bei ' + ueTxt) + '.', true);
      }
      if (f === 'eingang offen') push('eingang-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): ' + (r.diff ? 'U_2 erreicht den +Eingang nicht, U_a = ' + val(r.ua, 'V', 3) : 'Das Signal erreicht den +Eingang nicht (U_e = ' + val(r.inp.ue, 'V', 3) + '), U_a = ' + val(r.ua, 'V', 3)) + '.', true);
      if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', FN[f] + ' (Fehlerfall der Simulation): U_sat = ' + val(r.usat, 'V', 2) + ', der Ausgang bleibt bei U_a = ' + val(r.ua, 'V', 2) + '.', true);
      if (f === 'versorgung minus fehlt') push('versorgung-minus-fehlt', 'warn', FN[f] + ' (Fehlerfall der Simulation): Der Ausgang kann nicht unter −' + val(r.usatN, 'V', 2) + ' gehen; U_a,lin = ' + val(q.ualin, 'V', 2) + ', U_a = ' + val(r.ua, 'V', 2) + '.', true);
      if (f === 'versorgung verpolt') push('versorgung-verpolt', 'error', FN[f] + ' (Fehlerfall der Simulation, nur Übung): Im Lehrmodell ist der Operationsverstärker zerstört, U_a = ' + val(r.ua, 'V', 2) + '. Ein zerstörter Operationsverstärker wird ersetzt; hier wird nur das Messbild gelesen.', true);
      if (q.sat && !r.defekt) push('saettigung', 'warn', 'Der Ausgang ist in der Sättigung: U_a,lin = ' + val(q.ualin, 'V', 2) + ' läge außerhalb der Aussteuergrenzen (+' + val(q.usat, 'V', 2) + ' / −' + val(q.usatN, 'V', 2) + '), U_a = ' + val(q.ua, 'V', 2) + '. Größte Eingangsspannung ohne Begrenzen: U_e,max = ' + val(q.ueMax, 'V', 3) + '.');
      if (!r.diff && !r.ideal && isNum(q.fg) && r.fEff > 0.5 * q.fg) push('gbw-grenze', 'info', 'Bei f = ' + eng(r.fEff, 'Hz') + ' (über der halben Grenzfrequenz f_g = ' + eng(q.fg, 'Hz') + ') ist die Verstärkung auf ' + val(r.hf / Math.abs(q.v) * 100, '%', 1) + ' gefallen: V_u = ' + val(r.hf, '', 3) + ' statt ' + val(q.v, '', 3) + '.');
      if (!r.diff && r.w && r.w.slew && !r.defekt) {
        const sr = srOf(ctl.opv), fmax = CORE.op.fpb({ sr, uhat: Math.max(r.w.uaPeak, 1e-9) });
        push('slew', 'warn', 'Die Slew-Rate ist erreicht: Der Ausgang kann höchstens mit SR = ' + val(sr / 1e6, 'V/µs', 2) + ' steigen (Übungswert, F9). Bei û = ' + val(r.w.uaPeak, 'V', 2) + ' wäre die größte Frequenz f_max = ' + eng(fmax, 'Hz') + ', hier f = ' + eng(r.fEff, 'Hz') + '.');
      }
      if (!r.diff && !r.ideal && Math.abs(r.inp.ue) < 1e-12) push('offset', 'info', 'Offsetspannung: Bei U_e = 0 liegt am Ausgang U_a,off = ' + val(q.uosOut * 1000, 'mV', 2) + ' (U_os mal V_n mit V_n = ' + val(q.vn, '', 2) + '; Übungswert, F9).');
      if (r.diff && !r.defekt) {
        const ab = q.abgleich;
        if (isNum(ab) && Math.abs(ab - 1) > 1e-6) push('diff-abgleich', 'info', 'Nicht abgeglichen: R_4 / R_2 = ' + val(ctl.r4 / ctl.r2, '', 3) + ' ist ungleich R_3 / R_1 = ' + val(ctl.r3 / ctl.r1, '', 3) + '. Die Gleichtaktverstärkung ist V_gl = a1 + a2 = ' + val(q.vgl, '', 4) + ': Ein Gleichtaktanteil erscheint am Ausgang.');
      }
      if (r.fold && f === 'keiner') push('folger-info', 'info', 'Spannungsfolger: V_u = ' + val(q.v, '', 3) + ' (belegt), U_a folgt U_e. Der Eingangswiderstand ist sehr groß und der Ausgangswiderstand klein: Der Folger trennt Quelle und Last (Impedanzwandler).');
      if (!r.diff && !r.fold && Math.abs(ue) > 0 && f === 'keiner') push('v-vorzeichen', 'info', 'V_u = ' + val(q.v, '', 3) + ' ist nie kleiner als 1 und positiv: Der nichtinvertierende Verstärker ist gleichphasig, der Invertierer dagegen dreht die Phase um 180°.');
      return out;
    }
    function befund(r, ctl) {
      if (!r.ok) return [];
      const ein = r.diff ? 'U_1 = ' + val(ctl.u1, 'V', 3) + ', U_2 = ' + val(ctl.u2, 'V', 3) : 'U_e = ' + val(ctl.ue, 'V', 3);
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: ' + ein + ', U_a = ' + val(r.ua, 'V', 3) + ', U_a (Spitze im Zeitbild) = ' + val(r.uaPeak, 'V', 3) + ', Aussteuergrenze ±' + val(r.usat, 'V', 2) + ', Ausgang ' + (r.sat ? 'an der Aussteuergrenze' : 'nicht begrenzt') + '.' }];
    }

    // ------------------------------------------------------------------- Kennlinien
    const memo = new WeakMap();
    function curves(r, ctl) {
      if (!r.ok) return [];
      if (memo.has(r)) return memo.get(r);
      const out = curvesRaw(r, ctl); memo.set(r, out); return out;
    }
    function uaAt(r, ctl, x) {
      const inp = r.inp, base = r.cfgBase;
      let q;
      if (r.diff) { const uc = (inp.u1 + inp.u2) / 2; q = CORE.op.diff(Object.assign({ r1: inp.r1, r2: inp.r2, r3: inp.r3, r4: inp.r4, u1: uc - x / 2, u2: uc + x / 2 }, base)); }
      else { const cfg = Object.assign({ rg: inp.rg, rf: inp.rf, ue: x }, base); q = r.fold ? CORE.op.folger(cfg) : CORE.op.nin(cfg); }
      if (!q || q.ok === false || !isNum(q.ua)) return NaN;
      return r.defekt ? 0 : q.ua;
    }
    function curvesRaw(r, ctl) {
      const xs = [], N = r.diff ? 80 : N_CURVE;
      for (let i = 0; i <= N; i++) xs.push(-10 + 20 * i / N);
      if (!r.diff && isNum(r.q.ueMax) && r.q.ueMax > 0 && r.q.ueMax < 10) xs.push(r.q.ueMax, -r.q.ueMax);
      xs.sort((a, b) => a - b);
      const pts = []; xs.forEach((x, i) => { if (i && x === xs[i - 1]) return; const y = uaAt(r, ctl, x); if (isNum(y)) pts.push([x, y]); });
      if (pts.length < 2) return [];
      const mk = r.diff ? { x: ctl.u2 - ctl.u1, y: r.ua, label: 'Arbeitspunkt' } : { x: r.inp.ue, y: r.ua, label: ctl.form === 'gleich' ? 'Arbeitspunkt' : 'Spitze' };
      const c1 = { id: 'uebertragung', title: r.diff ? 'Übertragungskennlinie U_a über U_2 − U_1 (Gleichtakt fest)' : 'Übertragungskennlinie U_a über U_e', xLabel: r.diff ? 'Differenzspannung U_2 − U_1' : 'Eingangsspannung U_e', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a', yUnit: 'V',
        series: [{ name: 'U_a', kind: 'out', points: pts }], marker: mk, limit: { y: r.usat, name: 'U_sat', sym: Math.abs(r.usat - r.usatN) < 1e-12 } };
      const out = [c1];
      if (r.fr) {
        const fr = r.fr;
        out.push({ id: 'frequenzgang', title: 'Frequenzgang der Verstärkung (Betrag in dB)', xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Verstärkung a', yUnit: 'dB',
          series: [{ name: 'a (mit Gegenkopplung)', kind: 'u', points: fr.f.map((f, i) => [f, fr.a[i]]) }, { name: 'a (Leerlauf)', kind: 'ref', points: fr.f.map((f, i) => [f, fr.open[i]]) }], marker: { x: fr.fAt, y: fr.aAt, label: 'f = ' + eng(fr.fAt, 'Hz') } });
      }
      return out;
    }

    // ------------------------------------------------------------------- Zeitbild
    const tUnitOf = T => (T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 });
    function waveform(r, ctl) {
      if (!r.ok) return null;
      const T = 1 / r.fEff, tu = tUnitOf(T), tt = [], n = N_WAVE;
      if (r.diff) {
        const nn = 33; for (let i = 0; i < nn; i++) tt.push(2 * T * i / (nn - 1) * tu.k);
        const c = a => tt.map(() => a);
        return { tUnit: tu.u, t: tt, series: [{ name: 'U_1', unit: 'V', kind: 'u', y: c(r.inp.u1) }, { name: 'U_2', unit: 'V', kind: 'ref', y: c(r.inp.u2) }, { name: 'u_a', unit: 'V', kind: 'out', y: c(r.ua) }], marks: { span: [{ t0: 0, t1: T * tu.k, name: 'T' }] }, clip: [], slew: [] };
      }
      const w = r.w; if (!w || !w.uin || w.uin.length < 4) return null;
      const dt = T / n, yin = [], yout = [];
      for (let p = 0; p < 2; p++) for (let i = 0; i < n; i++) { tt.push((p * n + i) * dt * tu.k); yin.push(w.uin[i]); yout.push(r.defekt ? 0 : w.uout[i]); }
      const eps = 1e-9 * Math.max(1, r.usat, r.usatN), sr = srOf(ctl.opv), mx = isNum(sr) ? sr * dt * (1 - 1e-6) : Infinity;
      const clip = band(tt, i => yout[i] >= r.usat - eps || yout[i] <= -r.usatN + eps), slew = isNum(sr) ? band(tt, i => i > 0 && Math.abs(yout[i] - yout[i - 1]) >= mx) : [];
      return { tUnit: tu.u, t: tt, series: [{ name: 'u_e', unit: 'V', kind: 'u', y: yin }, { name: 'u_a', unit: 'V', kind: 'out', y: yout }], marks: { span: [{ t0: 0, t1: T * tu.k, name: 'T' }] }, clip: r.defekt ? [] : clip, slew: r.defekt ? [] : slew };
    }

    function state(r, ctl) {
      if (!r.ok) return { valid: false, zustand: '', zustandCode: 0, text: 'Die Eingabe ist ungültig.', sweep: sw.active, sweepP: sw.p };
      const z = r.sat ? 'begrenzt' : 'linear';
      return { valid: true, zustand: z, zustandCode: r.sat ? 1 : 0, text: 'V_u = ' + val(r.v, '', 3) + ', U_a = ' + val(r.ua, 'V', 3) + (r.sat ? ' (an der Aussteuergrenze)' : '') + '.',
        v: r.v, vId: r.vId, ua: r.ua, uaPeak: r.uaPeak, sat: r.sat ? 1 : 0, usat: r.usat, usatN: r.usatN, fg: isNum(r.fg) ? r.fg : 0, ri: r.ri, ra: r.ra, vn: r.vn, hf: isNum(r.hf) ? r.hf : 0, phiF: isNum(r.phiF) ? r.phiF : 0,
        up: r.up, a1: r.a1, a2: r.a2, vgl: r.vgl, fEff: r.fEff, ia: r.ia, ideal: r.ideal ? 1 : 0, sweep: sw.active, sweepP: sw.p };
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
      const d = ctl.schaltung === 'differenz', fo = ctl.schaltung === 'folger';
      const t = { 'rf offen': fo ? [] : [[d ? 'r3' : 'rf', 'offen']], 'rg offen': fo ? [] : [[d ? 'r4' : 'rg', 'offen']], 'versorgung minus fehlt': [['uvn', 'defekt']], 'versorgung fehlt': [['uv', 'defekt'], ['uvn', 'defekt']],
        'versorgung verpolt': [['op', 'defekt'], ['uv', 'defekt'], ['uvn', 'defekt']], 'eingang offen': [[d ? 'r2' : 'ue', 'offen']] }[ctl.fehler];
      if (!t || !t.length) return {};
      return { fault: t.map(a => ({ id: a[0], type: a[1] })), faultText: 'Fehler (Simulation): ' + (FN[ctl.fehler] || '') };
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, g = sc.gfx, gap = 8, ctl = view.ctl, hid = view.verdeckt;
      if (!r || !r.ok) {
        wrapText(ctx, g, (r && r.why && !hid ? r.why : 'Die Eingabe ist ungültig.'), R0.w - 16, 13, 4).forEach((ln, k) => g.text(ctx, ln, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - (chipsH ? gap : 0);
      let sch, kenn, sig, bod, strip;
      if (R0.w >= 680) {
        const lw = Math.round(R0.w * 0.42), rw = R0.w - lw - gap, hS = Math.round(bodyH * 0.62);
        sch = { x: R0.x, y: R0.y, w: lw, h: hS }; strip = { x: R0.x, y: R0.y + hS + gap, w: lw, h: bodyH - hS - gap };
        const hh = bodyH - 2 * gap, h0 = Math.round(hh * 0.36), h1 = Math.round(hh * 0.34);
        kenn = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h0 }; sig = { x: kenn.x, y: R0.y + h0 + gap, w: rw, h: h1 }; bod = { x: kenn.x, y: R0.y + h0 + h1 + 2 * gap, w: rw, h: hh - h0 - h1 };
      } else {
        const hh = bodyH - 4 * gap, q = [0.24, 0.22, 0.2, 0.2, 0.14].map(x => Math.round(hh * x)); let y = R0.y;
        sch = { x: R0.x, y, w: R0.w, h: q[0] }; y += q[0] + gap;
        kenn = { x: R0.x, y, w: R0.w, h: q[1] }; y += q[1] + gap;
        sig = { x: R0.x, y, w: R0.w, h: q[2] }; y += q[2] + gap;
        bod = { x: R0.x, y, w: R0.w, h: q[3] }; y += q[3] + gap;
        strip = { x: R0.x, y, w: R0.w, h: R0.y + bodyH - y };
      }
      const fs = faultSpec(ctl, hid), vals = {}, L = {};
      vals.rl = ctl.rl >= 1e6 ? 'offen' : eng(ctl.rl, 'Ω');
      L.ua = 'U_a = ' + eng(r.ua, 'V'); L.uv = '+U_v = ' + val(ctl.uv, 'V', 1); L.uvn = '−U_v = −' + val(ctl.uv, 'V', 1);
      let kind = 'opv_nin';
      if (r.diff) { kind = 'differenz'; vals.r1 = eng(ctl.r1, 'Ω'); vals.r2 = eng(ctl.r2, 'Ω'); vals.r3 = eng(ctl.r3, 'Ω'); vals.r4 = eng(ctl.r4, 'Ω'); L.u1 = 'U_1 = ' + eng(ctl.u1, 'V'); L.u2 = 'U_2 = ' + eng(ctl.u2, 'V'); }
      else { L.ue = (ctl.form === 'gleich' ? 'U_e = ' : 'û_e = ') + eng(ctl.ue, 'V'); if (r.fold) kind = 'opv_folger'; else { vals.rg = eng(ctl.rg, 'Ω'); vals.rf = eng(ctl.rf, 'Ω'); } }
      const sd = Object.assign({ kind, values: vals, labels: L }, fs);
      if (ctl.rl >= 1e6) sd.hide = ['rl'];
      if (!sc.view('schematic', sch, sd, {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
      const cv = view.rig.curves();
      if (cv.length) sc.view('curve', kenn, cv[0], {}); else noData(ctx, g, kenn, pal, 'Keine Kennlinie für diese Werte.');
      const wf = view.rig.waveform ? view.rig.waveform() : null;
      if (wf && sig.h > 0) { if (!sc.view('scope', sig, wf, {})) noData(ctx, g, sig, pal, 'Das Zeitbild passt nicht in diese Größe.'); } else noData(ctx, g, sig, pal, 'Kein Zeitverlauf für diese Werte.');
      const fr = r.fr;
      if (fr && bod.h > 0) {
        const bd = { f: fr.f, a: fr.a, phi: fr.phi, open: fr.open, fg: fr.fg, fA: fr.openFg, gbw: ctl.opv === 'langsam' ? CORE.limit('gbw_langsam').value : CORE.limit('gbw_schnell').value, typ: 'ver' };
        if (!sc.view('bode', bod, bd, sw.active ? { wipe: sw.p } : {})) noData(ctx, g, bod, pal, 'Das Bode-Diagramm passt nicht in diese Größe.');
      } else if (bod.h > 0) noData(ctx, g, bod, pal, 'Idealer Operationsverstärker: Der Frequenzgang ist unbegrenzt (kein Bode-Diagramm). Wähle „real, langsam“ oder „real, schnell“.');
      if (strip.h >= 50) {
        g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
        const rows = [];
        if (r.diff) {
          rows.push({ t: 'U_a = U_2 · R_4 / (R_2 + R_4) · (1 + R_3 / R_1) − U_1 · R_3 / R_1', bold: true, color: pal.fg });
          rows.push({ t: 'a1 = ' + val(r.a1, '', 4) + ', a2 = ' + val(r.a2, '', 4) + ', V_gl = ' + val(r.vgl, '', 4), color: pal.fg });
          rows.push({ t: 'U_a = ' + val(r.q.ualin, 'V', 3) + (r.q.sat ? ' (begrenzt auf ' + val(r.ua, 'V', 2) + ')' : '') + ', U_+ = ' + val(r.up, 'V', 3), color: pal.mute });
        } else if (r.fold) {
          rows.push({ t: 'V_u = 1, U_a = U_e', bold: true, color: pal.fg });
          rows.push({ t: 'U_a = ' + val(r.q.ualin, 'V', 3) + (r.q.sat ? ' (begrenzt auf ' + val(r.ua, 'V', 2) + ')' : '') + (r.ideal ? '' : ', f_g = ' + eng(r.fg, 'Hz')), color: pal.fg });
        } else {
          rows.push({ t: SICHT.formel, bold: true, color: pal.fg });
          rows.push({ t: 'V_u = 1 + ' + eng(ctl.rf, 'Ω') + ' / ' + eng(ctl.rg, 'Ω') + ' = ' + val(r.vId, '', 4) + (r.ideal ? '' : ', real ' + val(r.v0, '', 4)), color: pal.fg });
          rows.push({ t: 'U_a = ' + val(r.q.ualin, 'V', 3) + (r.q.sat ? ' (begrenzt auf ' + val(r.ua, 'V', 2) + ')' : '') + (r.ideal ? '' : ', f_g = ' + eng(r.fg, 'Hz')), color: pal.mute });
        }
        rows.push({ t: ctl.rl >= 1e6 ? 'Ausgang im Leerlauf (I_a = 0)' : 'I_a = U_a / R_L = ' + eng(r.ia, 'A'), color: pal.mute });
        if (r.diff && r.fr) rows.push({ t: 'Frequenzgang: Zweig von U_1 (gleiche f_g für beide Eingänge)', color: pal.mute });
        if (sw.active) rows.push({ t: 'Frequenzdurchlauf: f = ' + eng(r.fEff, 'Hz'), bold: true, color: pal.fg });
        g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
      }
      if (chipsH) {
        const y = R0.y + bodyH + gap, m = view.rig.readMeters();
        const items = [['V_u', val(m.v, '', 3)], ['U_a', val(m.ua, 'V', 2)], [r.diff ? 'V_gl' : 'r_ein', r.diff ? val(m.vgl, '', 3) : (m.ri >= 1e11 ? '∞' : eng(m.ri, 'Ω'))], ['f_g', r.ideal ? '∞' : eng(m.fg, 'Hz')]];
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
        if (sw.p >= 1) { sw.p = 1; sw.active = false; P0.say('Der Frequenzdurchlauf ist beendet.', 'info'); P0.bump(); return; }
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 0; P0.say('Der Frequenzdurchlauf wurde abgebrochen.', 'info'); P0.bump(); return true; }
        if (ctl.schaltung === 'differenz') { P0.say('Der Frequenzdurchlauf zeigt das Zeitbild des Verstärkers oder Folgers; wähle eine dieser Schaltungen zuerst (der Differenzverstärker hat Gleichspannungen am Eingang).', 'warn'); return false; }
        sw.active = true; sw.p = 0;
        P0.say('Frequenzdurchlauf: f läuft von 10 Hz bis 10 MHz. ' + (ctl.opv === 'ideal' ? 'Der ideale Operationsverstärker hat keinen Frequenzgang: Die Verstärkung bleibt gleich.' : 'Beobachte, wie die Verstärkung ab f_g fällt und wann die Slew-Rate den Ausgang begrenzt.'), 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; }
    };
  }

  R.register({ id: 'opv_nin', name: 'Nichtinvertierender Verstärker, Folger und Differenzverstärker', icon: '➕', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'opv_nin', name: 'Nichtinvertierender Verstärker, Folger und Differenzverstärker', icon: '➕', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['zielV'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
