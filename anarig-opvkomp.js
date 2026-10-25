/* anarig-opvkomp.js - ANA-Lab (WP2d): Pruefstand 7 `opv_komp` - Komparator, Schmitt-Trigger und Rechteckgenerator (SPEC 5.7).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.komp.schmitt / osc / sweep, ANA_CORE.op.open / grenzen, ANA_CORE.limit); hier steht keine zweite Formel.
 * Einzige eigene Rechenzeilen sind reine Darstellung: Eingangsform (dreieck, sinus, rampe), Exponentialverlauf der Kondensatorspannung des Rechteckgenerators
 * aus den Kernwerten (tau, U_o, U_u, t_1, t_2, +-U_sat) und der Anteil "hoch" am Ausgang.
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteilwerte sind Uebungswerte (Uebungsschaltung).
 * Modell: siehe MODELL unten (ideal oder realer OPV mit Aussteuergrenze, Beharrungszustand, keine Eingangsstroeme, kein Offset, keine Laufzeit).
 * Steuerwerte (SI): schaltung, opv, uv (V), uref (V), form, ue (V, Amplitude), f (Hz), uoff (V), r1, r2, r3, rt (Ohm), c (F), fehler, zielUh (V), zielF (Hz), Taste fire (Eingangsdurchlauf).
 * Eingang der Schaltungen: Komparator mit U_e am nichtinvertierenden Eingang und U_ref am invertierenden (Ausgang hoch fuer U_e > U_ref); invertierender Schmitt-Trigger mit U_e am
 *   invertierenden Eingang, nichtinvertierender mit U_e ueber R_1 am nichtinvertierenden Eingang (SPEC 4.6); Rechteckgenerator ohne Eingang (R und C am invertierenden Eingang).
 * Messgeraete: uo, uu, uh (V), ua (V, aktuell), T (ms), fosz (Hz), tastgrad (%), uein (V, aktuell; beim Rechteckgenerator die Kondensatorspannung). T, fosz, tastgrad: beim Rechteckgenerator
 *   aus komp.osc, sonst Periodendauer und Frequenz des Eingangs und Anteil "hoch" des Ausgangs. "Aktuell" = Phase der Zeitlupe (Verlaeufe sind periodisch) oder Stand des Eingangsdurchlaufs.
 * Fehlerfall-Umsetzung (vor dem Kernaufruf): r2 offen -> r2 := R_OFFEN, r3 offen -> r3 := R_OFFEN, c offen -> c := 1e-12 F, versorgung minus fehlt -> uvn := 0, versorgung fehlt -> uv, uvn := 0;
 *   ein Fehler, den die gewaehlte Schaltung nicht hat (z. B. R_3 beim nichtinvertierenden Schmitt-Trigger), aendert nichts und sagt das.
 * Ampel (nur mit Vorgabe): U_H bzw. f innerhalb 2 % gruen, bis 5 % gelb (Operationsverstaerker-Fenster, Uebungswert F16), sonst rot; die Vorgabe Frequenz gilt nur fuer den Rechteckgenerator.
 * fire(): Eingangsdurchlauf (Komparator, Schmitt-Trigger): U_e laeuft von -U_max bis +U_max und zurueck, die Kippstellen werden gemeldet und im Bild als Arbeitspunkt verfolgt.
 * Zusatz fuer die Oberflaeche: rig.sweepInfo() liefert { active, p, ue, ua, kipp:[{ue, von, nach}] }.
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-opvkomp.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12;
  const MINUS = '−';
  const NP = 256;                 // Abtastwerte je Periode (Schmitt-Trigger, Komparator)
  const NL = 128;                 // Stuetzstellen der "aktuellen" Werte (Zeitlupenphase)
  const SWEEP_S = 8;              // Dauer des Eingangsdurchlaufs (s, Zeitlupe verlaengert)
  const MODELL = 'Modell: Operationsverstärker ideal (Ausgang bis ±U_v) oder real mit Aussteuergrenze U_sat = U_v − 1,5 V (Übungswert F9, F10); Beharrungszustand ohne Eingangsströme, Offset und Laufzeit. Der Schmitt-Trigger hat zwei Schaltschwellen aus der Mitkopplung, der Komparator keine Hysterese, der Rechteckgenerator schwingt zwischen seinen beiden Schwellen (Zeitglied R·C, Kondensatorverlauf als Exponentialkurve aus den Kernwerten). Bei realem Operationsverstärker bleiben Slew-Rate und Laufzeit unberücksichtigt, hohe Schwingfrequenzen gelten nur im Lehrmodell. ' + (T0.mitkopplung || '');

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const when = (key, vals) => ({ visible: st => !st || vals.indexOf(st[key]) >= 0 });
  const SCH = ['komparator', 'schmitt_inv', 'schmitt_nin', 'rechteck'];
  const SCH_NAME = { komparator: 'Komparator', schmitt_inv: 'Schmitt-Trigger invertierend', schmitt_nin: 'Schmitt-Trigger nichtinvertierend', rechteck: 'Rechteckgenerator' };
  const FEHLER = [['keiner', 'kein Fehler'], ['r2 offen', 'R_2 offen (Mitkopplung)'], ['r3 offen', 'R_3 offen'], ['c offen', 'Kondensator C offen'], ['versorgung minus fehlt', 'negative Versorgung fehlt'], ['versorgung fehlt', 'Versorgung fehlt']];
  const CONTROLS = B.fillControls([
    { key: 'schaltung', label: 'Schaltung', type: 'select', value: 'schmitt_inv', options: opt(SCH.map(s => [s, SCH_NAME[s]])), gruppe: 'bauteile', sicht: 'kennlinie',
      help: 'Wählt die Schaltung: Komparator ohne Gegenkopplung, Schmitt-Trigger mit Mitkopplung (invertierend oder nichtinvertierend) oder Rechteckgenerator, der von selbst zwischen zwei Schwellen kippt.' },
    { key: 'opv', label: 'Operationsverstärker', type: 'select', value: 'ideal', options: opt([['ideal', 'ideal (Ausgang bis ±U_v)'], ['langsam', 'real, langsam'], ['schnell', 'real, schnell']]), gruppe: 'ziel', sicht: 'formel',
      help: 'Modell des Operationsverstärkers: ideal (Ausgang geht bis zur Betriebsspannung) oder real mit Aussteuergrenze U_sat = U_v − 1,5 V (Übungswert, F9, F10). Die Aussteuergrenze bestimmt die Schaltschwellen.' },
    { key: 'uv', label: 'Betriebsspannung (±)', type: 'slider', scale: 'lin', min: 5, max: 18, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betrag der symmetrischen Betriebsspannung ±U_v des Operationsverstärkers (Kleinspannung, Übungswert F10). Die Ausgangsspannung kippt zwischen +U_sat und −U_sat; die Schaltschwellen wachsen mit U_sat.' },
    { key: 'uref', label: 'Bezugsspannung', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.1, unit: 'V', unitKind: 'V', value: 0, gruppe: 'quelle', sicht: 'kennlinie',
      help: 'Bezugsspannung U_ref: beim Komparator die Schaltschwelle, beim Schmitt-Trigger die Mitte der Hysterese-Schleife (bei nichtinvertierendem mit Faktor 1 + R_1/R_2), beim Rechteckgenerator die Mitte der beiden Schwellen.' },
    { key: 'form', label: 'Eingangsform', type: 'select', value: 'dreieck', options: opt([['dreieck', 'Dreieck'], ['sinus', 'Sinus'], ['rampe', 'Rampe (Sägezahn)']]), gruppe: 'quelle', sicht: 'signal', visible: st => !st || st.schaltung !== 'rechteck',
      help: 'Form der Eingangsspannung U_e. Beim Rechteckgenerator gibt es keinen Eingang: Die Schaltung erzeugt ihre Spannung selbst.' },
    { key: 'ue', label: 'Eingangsamplitude', type: 'slider', scale: 'lin', min: 0.1, max: 12, step: 0.1, unit: 'V', unitKind: 'V', value: 8, gruppe: 'quelle', sicht: 'signal', visible: st => !st || st.schaltung !== 'rechteck',
      help: 'Amplitude (Spitzenwert) der Eingangsspannung um den Gleichanteil. Der Ausgang kippt nur, wenn der Eingang die Schaltschwellen erreicht; eine kleinere Amplitude zeigt, dass er stehen bleibt.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 0.1, max: 1e5, step: 0.1, unit: 'Hz', unitKind: 'Hz', value: 100, gruppe: 'quelle', sicht: 'signal', visible: st => !st || st.schaltung !== 'rechteck',
      help: 'Frequenz der Eingangsspannung. Sie bestimmt nur den Zeitmaßstab des Verlaufs; die Schaltschwellen hängen nicht von ihr ab (Lehrmodell ohne Laufzeit).' },
    { key: 'uoff', label: 'Gleichanteil des Eingangs', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.1, unit: 'V', unitKind: 'V', value: 0, gruppe: 'quelle', sicht: 'signal', visible: st => !st || st.schaltung !== 'rechteck',
      help: 'Gleichanteil der Eingangsspannung. Er verschiebt den Verlauf gegen die Schwellen: Liegt er weit neben der Mitte der Hysterese, kippt der Ausgang nur noch selten oder gar nicht.' },
    { key: 'r1', label: 'R1 (Eingang, nichtinvertierender Schmitt-Trigger)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['schmitt_nin']),
      help: 'Eingangswiderstand R_1 des nichtinvertierenden Schmitt-Triggers. Ein größeres R_1 gegenüber R_2 vergrößert die Hysterese: U_o = U_ref·(1 + R_1/R_2) + U_sat·R_1/R_2. Übungswert.' },
    { key: 'r2', label: 'R2 (Mitkopplung)', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 20000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['schmitt_inv', 'schmitt_nin', 'rechteck']),
      help: 'Mitkopplungswiderstand R_2 vom Ausgang auf den nichtinvertierenden Eingang. Ein größeres R_2 verkleinert beim invertierenden Schmitt-Trigger die Schaltschwellen: U_o = U_sat·R_3/(R_2 + R_3). Übungswert.' },
    { key: 'r3', label: 'R3 (nach Bezugsspannung)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['schmitt_inv', 'rechteck']),
      help: 'Widerstand R_3 vom nichtinvertierenden Eingang nach U_ref (Masse). Ein größeres R_3 vergrößert beim invertierenden Schmitt-Trigger die Schaltschwellen: Mit ihm bildet R_2 den Spannungsteiler der Mitkopplung. Übungswert.' },
    { key: 'rt', label: 'Zeitglied-Widerstand R', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'signal', ...when('schaltung', ['rechteck']),
      help: 'Widerstand R des Zeitglieds vom Ausgang auf den invertierenden Eingang. Ein größeres R verlängert die Periodendauer: T = 2·R·C·ln((1 + β)/(1 − β)) bei symmetrischen Schwellen. Übungswert.' },
    { key: 'c', label: 'Zeitglied-Kondensator C', type: 'slider', scale: 'log', min: 1e-9, max: 1e-4, step: 1e-9, unit: 'F', unitKind: 'F', value: 1e-7, gruppe: 'bauteile', sicht: 'signal', ...when('schaltung', ['rechteck']),
      help: 'Kondensator C des Zeitglieds am invertierenden Eingang. Ein größeres C verlängert die Periodendauer des Rechteckgenerators, weil es länger dauert, bis die Kondensatorspannung die Schwelle erreicht. Übungswert.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): R_2 oder R_3 offen, Kondensator offen, negative Versorgung oder Versorgung fehlt. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'zielUh', label: 'Vorgabe Hysterese (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 24, step: 0.1, unit: 'V', unitKind: 'V', value: 0, gruppe: 'ziel', sicht: 'kennlinie',
      help: 'Vorgabe für die Hysterese U_H = U_o − U_u. Bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Treffer innerhalb des Fensters des Operationsverstärkers (Lehrfaustwert, Übungswert F16).' },
    { key: 'zielF', label: 'Vorgabe Frequenz (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 1e5, step: 1, unit: 'Hz', unitKind: 'Hz', value: 0, gruppe: 'ziel', sicht: 'signal',
      help: 'Vorgabe für die Schwingfrequenz des Rechteckgenerators. Bei 0 ist keine Vorgabe gesetzt; bei den anderen Schaltungen gilt sie nicht. Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16).' },
    { key: 'fire', label: 'Eingangsdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'kennlinie',
      help: 'Startet den Eingangsdurchlauf (Komparator, Schmitt-Trigger): U_e läuft langsam von −U_max bis +U_max und zurück, der Arbeitspunkt wandert auf der Hysterese-Schleife, die Kippstellen werden gemeldet. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'uo', label: 'Obere Schaltschwelle U_o', unit: 'V', digits: 3, min: -24, max: 24, help: 'Obere Schaltschwelle U_o: Eingangsspannung, bei der der Ausgang beim Steigen (invertierend: auf −U_sat, nichtinvertierend: auf +U_sat) kippt. Beim Komparator gleich U_u.' },
    { key: 'uu', label: 'Untere Schaltschwelle U_u', unit: 'V', digits: 3, min: -24, max: 24, help: 'Untere Schaltschwelle U_u: Eingangsspannung, bei der der Ausgang beim Fallen kippt. Beim Komparator gleich U_o, weil es keine Hysterese gibt.' },
    { key: 'uh', label: 'Hysterese U_H', unit: 'V', digits: 3, min: 0, max: 48, zeroIsNone: true, help: 'Hysterese U_H = U_o − U_u: der Spannungsbereich, in dem der Ausgang seinen Zustand behält. Ohne Mitkopplung ist sie null.' },
    { key: 'ua', label: 'Ausgangsspannung U_a (aktuell)', unit: 'V', digits: 3, min: -20, max: 20, help: 'Aktuelle Ausgangsspannung bei der gerade gezeigten Eingangsspannung (Phase der Zeitlupe oder Stand des Eingangsdurchlaufs).' },
    { key: 'T', label: 'Periodendauer T', unit: 'ms', digits: 4, min: 0, max: 2000, zeroIsNone: true, help: 'Periodendauer: beim Rechteckgenerator die Schwingung aus dem Kern, sonst die Periodendauer des Eingangs. Null, wenn der Rechteckgenerator nicht schwingt.' },
    { key: 'fosz', label: 'Frequenz f', unit: 'Hz', digits: 3, min: 0, max: 1e5, zeroIsNone: true, help: 'Frequenz: beim Rechteckgenerator die Schwingfrequenz, sonst die Frequenz des Eingangs. Hohe Werte gelten nur im Lehrmodell ohne Laufzeit des Operationsverstärkers.' },
    { key: 'tastgrad', label: 'Tastgrad', unit: '%', digits: 1, min: 0, max: 100, zeroIsNone: true, help: 'Tastgrad: Anteil der Periode, in dem der Ausgang hoch liegt. Symmetrische Schwellen und gleiche Aussteuergrenzen ergeben 50 %.' },
    { key: 'uein', label: 'Eingangsspannung U_e (aktuell)', unit: 'V', digits: 3, min: -24, max: 24, help: 'Aktuelle Eingangsspannung (beim Rechteckgenerator die Kondensatorspannung am invertierenden Eingang) bei der gerade gezeigten Phase oder dem Stand des Durchlaufs.' }
  ];
  const SICHT = { kennlinie: 'Übertragungskennlinie U_a(U_e) mit Hysterese-Schleife', signal: 'Eingang, Schwellen und Ausgang über der Zeit', formel: 'U_o = U_sat · R_3 / (R_2 + R_3)' };
  const INFO = 'Komparator ohne Gegenkopplung, Schmitt-Trigger mit Mitkopplung (zwei Schaltschwellen, Hysterese) und Rechteckgenerator (Relaxationsoszillator mit Zeitglied R·C). ' + MODELL;

  const PRESETS = [
    { id: 'komparator', name: 'Komparator', info: 'Übungsschaltung: Der Komparator hat keine Hysterese; der Ausgang kippt bei U_e = U_ref. ' + K(c => { const o = c.komp.comparator({ up: 1, un: 0, uv: 12 }); return 'Für U_e = 1 V über U_ref liegt U_a bei ' + val(o.ua, 'V', 1) + '.'; }),
      controls: { schaltung: 'komparator', uref: 0 } },
    { id: 'schmitt-inv', name: 'Schmitt-Trigger invertierend (Pool S2023-N10)', info: 'Übungsschaltung (Pool S2023-N10): ' + K(c => { const s = c.komp.schmitt({ art: 'inv', r2: 20000, r3: 10000, uv: 12 }); return 'Mit R_2 = 20 kΩ, R_3 = 10 kΩ und U_sat = 12 V sind die Schaltschwellen U_o = ' + val(s.uo, 'V', 1) + ' und U_u = ' + val(s.uu, 'V', 1) + ', die Hysterese ist ' + val(s.uh, 'V', 1) + '.'; }),
      controls: { schaltung: 'schmitt_inv', r2: 20000, r3: 10000 } },
    { id: 'schmitt-nin', name: 'Schmitt-Trigger nichtinvertierend (Pool W2023-12)', info: 'Übungsschaltung (Pool W2023-12): ' + K(c => { const s = c.komp.schmitt({ art: 'nin', r1: 10000, r2: 47000, uv: 12 }); return 'Mit R_1 = 10 kΩ, R_2 = 47 kΩ und U_sat = 12 V ist U_o = ' + val(s.uo, 'V', 2) + ' und U_u = ' + val(s.uu, 'V', 2) + '.'; }),
      controls: { schaltung: 'schmitt_nin', r1: 10000, r2: 47000 } },
    { id: 'rechteck', name: 'Rechteckgenerator', info: 'Übungsschaltung: ' + K(c => { const o = c.komp.osc({ r: 10000, c: 1e-7, r2: 10000, r3: 10000, uv: 12 }); return 'Mit R = 10 kΩ, C = 100 nF und R_2 = R_3 = 10 kΩ schwingt der Ausgang zwischen ±12 V; die Schwellen sind ±' + val(o.uo, 'V', 1) + ', die Periodendauer ist T = ' + val(o.T * 1000, 'ms', 4) + ' (f = ' + val(o.f, 'Hz', 1) + ').'; }),
      controls: { schaltung: 'rechteck', r2: 10000, r3: 10000, rt: 10000, c: 100e-9 } },
    { id: 'ohne-hysterese', name: 'Ohne Hysterese (Fehlerbild)', info: 'Fehlerbild der Simulation: Ohne Mitkopplung (R_2 offen) bleibt vom Schmitt-Trigger nur ein Komparator ohne Hysterese; U_H ist praktisch null und der Ausgang flattert bei verrauschtem Eingang.',
      controls: { schaltung: 'schmitt_inv', fehler: 'r2 offen' } }
  ];

  const FN = { 'r2 offen': 'R_2 ist offen', 'r3 offen': 'R_3 ist offen', 'c offen': 'Der Kondensator C ist offen', 'versorgung minus fehlt': 'Die negative Versorgung fehlt', 'versorgung fehlt': 'Die Versorgung fehlt' };

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0, ue: 0, ua: 0, hoch: true, kipp: [] };
    let ph = 0;
    const memoW = new WeakMap(), memoC = new WeakMap();
    const wrapOk = a => a && a.ok !== false;

    // ---------------------------------------------------------------- Eingaben (Fehlerfall -> Eingabewerte), Kernaufrufe
    function applies(f, sch) {
      if (f === 'r2 offen') return sch !== 'komparator';
      if (f === 'r3 offen') return sch === 'schmitt_inv' || sch === 'rechteck';
      if (f === 'c offen') return sch === 'rechteck';
      return true;
    }
    function compute(ctl) {
      const sch = ctl.schaltung, f = ctl.fehler, act = f !== 'keiner' && applies(f, sch);
      let uv = ctl.uv, uvn = ctl.uv;
      if (act && f === 'versorgung minus fehlt') uvn = 0;
      if (act && f === 'versorgung fehlt') { uv = 0; uvn = 0; }
      const r2 = act && f === 'r2 offen' ? OFFEN : ctl.r2, r3 = act && f === 'r3 offen' ? OFFEN : ctl.r3, c = act && f === 'c offen' ? 1e-12 : ctl.c;
      const base = { opv: ctl.opv, uv, uvn };
      const g = CORE.op.grenzen(base);
      if (!wrapOk(g)) return { ok: false, why: (g && g.why) || 'Die Eingabe ist ungültig.' };
      const o = { ok: true, sch, f, act, base, g, usat: g.p, usatN: g.n, nosup: !(g.p > 0 || g.n > 0), noNeg: !(g.n > 0), ctl: Object.assign({}, ctl), os: null, sm: null, cfg: null };
      if (sch === 'komparator') {
        o.sm = { valid: true, uo: ctl.uref, uu: ctl.uref, uh: 0, usat: g.p, usatN: g.n, art: 'nin' };
      } else if (sch === 'schmitt_inv' || sch === 'schmitt_nin') {
        o.cfg = sch === 'schmitt_inv' ? { art: 'inv', r2, r3, uref: ctl.uref } : { art: 'nin', r1: ctl.r1, r2, uref: ctl.uref };
        const s = CORE.komp.schmitt(Object.assign({}, o.cfg, base));
        if (!wrapOk(s)) return { ok: false, why: (s && s.why) || 'Die Eingabe ist ungültig.' };
        o.sm = { valid: s.valid !== false, why: s.why, uo: s.uo, uu: s.uu, uh: isNum(s.uh) ? s.uh : s.uo - s.uu, usat: s.usat, usatN: s.usatN, art: s.art };
        o.cfg = Object.assign({}, o.cfg, base);
      } else {
        const s = CORE.komp.osc({ r: ctl.rt, c, r2, r3, uref: ctl.uref, opv: ctl.opv, uv, uvn });
        if (!wrapOk(s)) return { ok: false, why: (s && s.why) || 'Die Eingabe ist ungültig.' };
        o.os = s;
        o.cfg = Object.assign({ art: 'inv', r2, r3, uref: ctl.uref }, base);
        o.sm = { valid: s.valid !== false, why: s.why, uo: s.uo, uu: s.uu, uh: isNum(s.uh) ? s.uh : s.uo - s.uu, usat: g.p, usatN: g.n, art: 'inv' };
      }
      const sm = o.sm;
      if (![sm.uo, sm.uu, sm.uh].every(isNum)) { sm.uo = isNum(sm.uo) ? sm.uo : 0; sm.uu = isNum(sm.uu) ? sm.uu : 0; sm.uh = sm.uo - sm.uu; }
      o.uemax = Math.max(Math.max(Math.abs(sm.uo), Math.abs(sm.uu), 2) * 1.5, 3);
      o.keineHyst = sch !== 'komparator' && sm.valid && sm.uh < 1e-3;
      o.nahUsat = sch !== 'komparator' && sm.valid && sm.uh >= 1e-3 && (Math.max(sm.uo, sm.uu) >= o.usat * (1 - 1e-3) || Math.min(sm.uo, sm.uu) <= -o.usatN * (1 - 1e-3)) && o.usat > 0;
      return o;
    }

    // ---------------------------------------------------------------- Verlaeufe (Darstellung aus Kernwerten)
    const tScale = T => (T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : T >= 1e-6 ? { u: 'µs', k: 1e6 } : { u: 'ns', k: 1e9 });
    function shape(form, x) {
      x -= Math.floor(x);
      if (form === 'sinus') return Math.sin(2 * Math.PI * x);
      if (form === 'rampe') return 2 * x - 1;
      return x < 0.25 ? 4 * x : (x < 0.75 ? 2 - 4 * x : 4 * x - 4);
    }
    function schmittWave(r, ctl) {
      const f = ctl.f, T = 1 / f, dt = T / NP, N = 3 * NP, uin = [];
      for (let i = 0; i <= N; i++) uin.push(ctl.uoff + ctl.ue * shape(ctl.form, f * i * dt));
      let ua;
      if (r.sch === 'komparator') {
        ua = uin.map(u => { const o = CORE.op.open(Object.assign({ up: u, un: ctl.uref }, r.base)); return wrapOk(o) && isNum(o.ua) ? o.ua : 0; });
      } else {
        const s = CORE.komp.sweep(r.cfg, uin, r.cfg.art === 'inv');
        ua = wrapOk(s) && Array.isArray(s.ua) && s.ua.length === uin.length ? s.ua : uin.map(() => 0);
      }
      const sc = tScale(2 * T), t = [], yi = [], yo = [];
      for (let i = NP; i <= N; i++) { t.push((i - NP) * dt * sc.k); yi.push(uin[i]); yo.push(ua[i]); }
      const liveUe = [], liveUa = [], st = NP / NL;
      for (let i = 0; i < NL; i++) { liveUe.push(yi[Math.round(i * st)]); liveUa.push(yo[Math.round(i * st)]); }
      let flips = 0, hi = 0;
      for (let i = 1; i <= NP; i++) { if ((yo[i] > 0) !== (yo[i - 1] > 0)) flips++; if (yo[i - 1] > 0) hi++; }
      return { tUnit: sc.u, t, uin: yi, uout: yo, liveUe, liveUa, flips, hiFrac: hi / NP, uinMax: Math.max.apply(null, uin.map(Math.abs)), T };
    }
    function oscWave(r) {
      const os = r.os;
      if (!os || os.valid === false || !(os.T > 0)) return null;
      const T = os.T, sc = tScale(2 * T), M = 48, t = [], uc = [], ua = [], us = r.usat, un = r.usatN, tau = os.tau;
      const seg = (t0, dur, up) => { for (let j = 0; j <= M; j++) { const tt = dur * j / M; t.push((t0 + tt) * sc.k); uc.push(up ? us + (os.uu - us) * Math.exp(-tt / tau) : -un + (os.uo + un) * Math.exp(-tt / tau)); ua.push(up ? us : -un); } };
      for (let p = 0; p < 2; p++) { seg(p * T, os.t1, true); seg(p * T + os.t1, os.t2, false); }
      const liveUe = [], liveUa = [];
      for (let i = 0; i < NL; i++) {
        const tt = T * i / NL, up = tt < os.t1;
        liveUe.push(up ? us + (os.uu - us) * Math.exp(-tt / tau) : -un + (os.uo + un) * Math.exp(-(tt - os.t1) / tau)); liveUa.push(up ? us : -un);
      }
      return { tUnit: sc.u, t, uin: uc, uout: ua, liveUe, liveUa, flips: 2, hiFrac: os.t1 / T, uinMax: Math.max(Math.abs(os.uo), Math.abs(os.uu)), T, span: [0, T * sc.k] };
    }
    function wfOf(r, ctl) {
      if (!r || !r.ok) return null;
      if (memoW.has(r)) return memoW.get(r);
      let w = null;
      try { w = r.sch === 'rechteck' ? oscWave(r) : schmittWave(r, ctl); } catch (e) { w = null; }
      memoW.set(r, w);
      return w;
    }

    // ---------------------------------------------------------------- "aktuelle" Werte
    function live(r, ctl) {
      if (sw.active) return { ue: sw.ue, ua: sw.ua };
      const w = wfOf(r, ctl);
      if (!w) return { ue: 0, ua: 0 };
      const i = Math.floor(ph * NL) % NL;
      return { ue: w.liveUe[i], ua: w.liveUa[i] };
    }

    function meters(r, ctl) {
      const o = { uo: 0, uu: 0, uh: 0, ua: 0, T: 0, fosz: 0, tastgrad: 0, uein: 0 };
      if (!r.ok) return o;
      const sm = r.sm, lv = live(r, ctl), w = wfOf(r, ctl);
      o.uo = sm.uo; o.uu = sm.uu; o.uh = Math.max(0, sm.uh); o.ua = lv.ua; o.uein = lv.ue;
      if (r.sch === 'rechteck') {
        if (r.os && r.os.valid !== false) { o.T = r.os.T * 1000; o.fosz = r.os.f; o.tastgrad = r.os.tastgrad * 100; }
      } else { o.T = 1000 / ctl.f; o.fosz = ctl.f; o.tastgrad = w ? w.hiFrac * 100 : 0; }
      return o;
    }

    // ---------------------------------------------------------------- Ampel
    function pctRow(id, name, ist, soll, unit) {
      const pct = Math.abs(ist - soll) / soll * 100;
      return { id, ampel: B.devAmpel(pct, CORE, 'op'), margin: pct, text: B.devText(name, ist, soll, unit, pct, CORE, 'op') };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: Die Eingabe ist ungültig.' };
      const rows = [], zt = [];
      if (ctl.zielUh > 0) {
        const ist = r.sm.valid ? Math.max(0, r.sm.uh) : 0;
        rows.push(pctRow('uh', 'Hysterese U_H', ist, ctl.zielUh, 'V')); zt.push('U_H = ' + val(ctl.zielUh, 'V'));
      }
      if (ctl.zielF > 0) {
        zt.push('f = ' + val(ctl.zielF, 'Hz'));
        if (r.sch !== 'rechteck') rows.push({ id: 'f', ampel: 'grau', text: 'Die Vorgabe Frequenz gilt für den Rechteckgenerator; die gewählte Schaltung schwingt nicht von selbst.' });
        else if (!r.os || r.os.valid === false) rows.push({ id: 'f', ampel: 'rot', margin: 100, text: 'Frequenz: Der Rechteckgenerator schwingt nicht, die Vorgabe ' + val(ctl.zielF, 'Hz') + ' wird nicht erreicht (Ausgang bei ' + val(live(r, ctl).ua, 'V', 2) + ').' });
        else rows.push(pctRow('f', 'Frequenz f', r.os.f, ctl.zielF, 'Hz'));
      }
      const real = rows.filter(q => q.ampel !== 'grau');
      if (!real.length) return { ok: false, ampel: 'grau', text: rows.map(q => q.text).join(' ') || 'Keine Vorgabe gesetzt.', ziel: { text: zt.join(', ') } };
      const order = { gruen: 0, gelb: 1, rot: 2 };
      const worst = real.reduce((m, q) => (order[q.ampel] > order[m] ? q.ampel : m), 'gruen');
      const margin = Math.max.apply(null, real.map(q => q.margin));
      return { ok: worst === 'gruen' && real.length === rows.length, ampel: worst, margin, text: rows.map(q => q.text).join(' '), ziel: { text: zt.join(', ') }, rows: rows.map(q => ({ id: q.id, ampel: q.ampel, text: q.text })) };
    }

    // ---------------------------------------------------------------- Meldungen
    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [], f = ctl.fehler, sm = r.sm;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      const w = wfOf(r, ctl), real = ctl.opv !== 'ideal';
      if (f !== 'keiner') {
        const cause = FN[f];
        if (!applies(f, r.sch)) push('fehler-wirkungslos', 'info', cause + ' (Fehlerfall der Simulation): Diese Schaltung hat hier keinen solchen Teil, der Fehlerfall ändert nichts.', true);
        else if (f === 'r2 offen') push('r2-offen', 'warn', cause + ' (Fehlerfall der Simulation): Die Mitkopplung fehlt, die Hysterese ist U_H = ' + val(Math.max(0, sm.uh), 'V', 6) + (r.sch === 'rechteck' ? ' und die Schwellen liegen praktisch bei U_ref: Der Rechteckgenerator schwingt nicht sinnvoll.' : ': Es bleibt ein Komparator ohne Hysterese.'), true);
        else if (f === 'r3 offen') push('r3-offen', 'warn', cause + ' (Fehlerfall der Simulation): Der Spannungsteiler der Mitkopplung fehlt, die Schwellen liegen mit U_o = ' + val(sm.uo, 'V', 3) + ' und U_u = ' + val(sm.uu, 'V', 3) + ' fast an ±U_sat.', true);
        else if (f === 'c offen') push('c-offen', 'warn', cause + ' (Fehlerfall der Simulation): Das Zeitglied fehlt, die Schwingfrequenz steigt auf ' + (r.os && r.os.valid !== false ? val(r.os.f / 1e6, 'MHz', 1) : '–') + '.', true);
        else if (f === 'versorgung minus fehlt') push('versorgung-minus-fehlt', 'warn', cause + ' (Fehlerfall der Simulation): Der Ausgang kann nur zwischen +U_sat = ' + val(r.usat, 'V', 1) + ' und 0 V kippen' + (r.sch === 'rechteck' ? '; der Rechteckgenerator schwingt nicht.' : '.'), true);
        else if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', cause + ' (Fehlerfall der Simulation): Der Ausgang bleibt bei 0 V, nichts kippt.', true);
      }
      if (r.sch === 'komparator') push('komparator', 'info', 'Der Komparator hat keine Hysterese: Der Ausgang kippt bei U_e = U_ref = ' + val(ctl.uref, 'V', 1) + ' zwischen +U_sat = ' + val(r.usat, 'V', 1) + ' und −U_sat = ' + val(-r.usatN, 'V', 1) + '.');
      else if (r.sm.valid && r.keineHyst) push('keine-hysterese', 'warn', 'U_H = ' + val(Math.max(0, sm.uh), 'V', 6) + ': Es gibt praktisch keine Hysterese. Bei langsamem oder verrauschtem Eingang flattert der Ausgang an der Schwelle.');
      else if (sm.valid && r.nahUsat) push('schwellen-nahe-usat', 'warn', 'Die Schwellen U_o = ' + val(sm.uo, 'V', 3) + ' und U_u = ' + val(sm.uu, 'V', 3) + ' liegen fast an ±U_sat = ' + val(r.usat, 'V', 1) + ': Der Eingang erreicht sie nur bei fast voller Aussteuerung.');
      else if (sm.valid && r.sch !== 'rechteck') push('hysterese', 'info', 'Mitkopplung: U_o = ' + val(sm.uo, 'V', 3) + ', U_u = ' + val(sm.uu, 'V', 3) + ', Hysterese U_H = ' + val(sm.uh, 'V', 3) + '. Der Ausgang behält seinen Zustand, solange U_e zwischen den Schwellen liegt.');
      if (r.sch === 'rechteck') {
        if (!r.os || r.os.valid === false) push('schwingt-nicht', 'error', 'Der Rechteckgenerator schwingt nicht: Die Schwellen U_o = ' + val(sm.uo, 'V', 3) + ' und U_u = ' + val(sm.uu, 'V', 3) + ' liegen außerhalb der Aussteuergrenzen +' + val(r.usat, 'V', 1) + ' / −' + val(r.usatN, 'V', 1) + '.', f !== 'keiner');
        else {
          push('schwingt', 'info', 'Der Kondensator lädt zwischen U_u = ' + val(r.os.uu, 'V', 3) + ' und U_o = ' + val(r.os.uo, 'V', 3) + ': T = ' + val(r.os.T * 1000, 'ms', 4) + ', f = ' + val(r.os.f, 'Hz', 1) + ', Tastgrad ' + val(r.os.tastgrad * 100, '%', 1) + '.');
          if (r.os.f > 1e5) push('f-sehr-hoch', 'warn', 'Die Schwingfrequenz ' + val(r.os.f / 1000, 'kHz', 1) + ' liegt weit über dem, was ein Operationsverstärker schafft (Laufzeit, Slew-Rate): Das Ergebnis gilt nur im Lehrmodell.');
        }
      } else if (w && sm.valid && w.flips === 0) push('kippt-nicht', 'warn', 'Der Ausgang kippt nicht: Der Eingang (Spitze ' + val(w.uinMax, 'V', 2) + ') erreicht die Schwellen U_o = ' + val(sm.uo, 'V', 3) + ' und U_u = ' + val(sm.uu, 'V', 3) + ' nicht in beiden Richtungen.');
      if (real) push('real-opv', 'info', 'Realer Operationsverstärker: Aussteuergrenze U_sat = ' + val(r.usat, 'V', 1) + ' (U_v abzüglich 1,5 V, Übungswert), Slew-Rate und Laufzeit sind in dieser Anlage nicht gerechnet.');
      if (sw.active) push('durchlauf', 'info', 'Eingangsdurchlauf: U_e = ' + val(sw.ue, 'V', 2) + ', U_a = ' + val(sw.ua, 'V', 2) + '.');
      return out;
    }
    function befund(r, ctl) {
      if (!r.ok) return [];
      const lv = live(r, ctl);
      let t;
      if (r.sch === 'rechteck') t = r.os && r.os.valid !== false ? 'Messbefund: T = ' + val(r.os.T * 1000, 'ms', 4) + ', f = ' + val(r.os.f, 'Hz', 1) + ', Schwellen U_o = ' + val(r.os.uo, 'V', 3) + ' und U_u = ' + val(r.os.uu, 'V', 3) + '.' : 'Messbefund: Der Ausgang schwingt nicht, U_a = ' + val(lv.ua, 'V', 2) + ', Schwellen U_o = ' + val(r.sm.uo, 'V', 3) + ' und U_u = ' + val(r.sm.uu, 'V', 3) + '.';
      else t = 'Messbefund: U_o = ' + val(r.sm.uo, 'V', 3) + ', U_u = ' + val(r.sm.uu, 'V', 3) + ', U_H = ' + val(Math.max(0, r.sm.uh), 'V', 3) + '; Ausgang zwischen +' + val(r.usat, 'V', 2) + ' und −' + val(r.usatN, 'V', 2) + ', jetzt U_e = ' + val(lv.ue, 'V', 2) + ' und U_a = ' + val(lv.ua, 'V', 2) + '.';
      return [{ id: 'befund', kind: 'info', text: t }];
    }

    // ---------------------------------------------------------------- Kennlinien, Verlauf, Zustand
    function curves(r, ctl) {
      if (!r.ok || r.nosup || (!r.sm.valid && r.sch !== 'rechteck')) return [];
      let c = memoC.get(r);
      if (!c) { c = curvesRaw(r, ctl); memoC.set(r, c); }
      if (!c.length) return [];
      const lv = live(r, ctl);
      return c.map(cv => Object.assign({}, cv, { marker: { x: lv.ue, y: lv.ua, label: 'Arbeitspunkt' } }));
    }
    function curvesRaw(r, ctl) {
      const um = r.uemax, up = [], dn = [];
      for (let i = 0; i <= 120; i++) { const u = -um + 2 * um * i / 120; up.push(u); dn.push(um - 2 * um * i / 120); }
      let a, b;
      if (r.sch === 'komparator') {
        const f = u => { const o = CORE.op.open(Object.assign({ up: u, un: ctl.uref }, r.base)); return wrapOk(o) && isNum(o.ua) ? o.ua : 0; };
        a = up.map(f); b = null;
      } else {
        const cfg = r.cfg;
        const s1 = CORE.komp.sweep(cfg, up, cfg.art === 'inv');
        if (!wrapOk(s1)) return [];
        const s2 = CORE.komp.sweep(cfg, dn, s1.hochEnde);
        if (!wrapOk(s2)) return [];
        a = s1.ua; b = s2.ua;
      }
      const series = [{ name: 'U_a bei steigendem U_e', kind: 'out', points: up.map((u, i) => [u, a[i]]) }];
      if (b) series.push({ name: 'U_a bei fallendem U_e', kind: 'i', points: dn.map((u, i) => [u, b[i]]) });
      return [{ id: 'hysterese', title: r.sch === 'komparator' ? 'Übertragungskennlinie des Komparators' : (r.sch === 'rechteck' ? 'Schmitt-Trigger im Rechteckgenerator: U_a über der Kondensatorspannung' : 'Hysterese-Schleife des Schmitt-Triggers'),
        xLabel: r.sch === 'rechteck' ? 'Kondensatorspannung U_C' : 'Eingangsspannung U_e', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a', yUnit: 'V', series, limit: { y: r.usat, name: '+U_sat' } }];
    }
    function waveform(r, ctl) {
      const w = wfOf(r, ctl);
      if (!w) return null;
      const marks = { h: [] };
      if (r.sch === 'komparator') marks.h.push({ y: ctl.uref, name: 'U_ref' });
      else { marks.h.push({ y: r.sm.uo, name: 'U_o' }); if (Math.abs(r.sm.uo - r.sm.uu) > 1e-9) marks.h.push({ y: r.sm.uu, name: 'U_u' }); }
      if (w.span) marks.span = [{ t0: w.span[0], t1: w.span[1], name: 'T' }];
      return { tUnit: w.tUnit, t: w.t, series: [{ name: r.sch === 'rechteck' ? 'u_C (Kondensator)' : 'u_e (Eingang)', unit: 'V', kind: 'u', y: w.uin }, { name: 'u_a (Ausgang)', unit: 'V', kind: 'out', y: w.uout }], marks };
    }
    function state(r, ctl) {
      if (!r.ok) return { valid: false, text: 'Die Eingabe ist ungültig.', schwelleO: 0, schwelleU: 0, hysterese: 0, usat: 0, usatN: 0, ueLive: 0, uaLive: 0, sweep: sw.active, sweepP: sw.p, zustand: '' };
      const lv = live(r, ctl), w = wfOf(r, ctl);
      return { valid: r.sm.valid && (r.sch !== 'rechteck' || !!(r.os && r.os.valid !== false)), text: r.sch === 'rechteck' ? (r.os && r.os.valid !== false ? 'Rechteckgenerator: T = ' + val(r.os.T * 1000, 'ms', 4) + ', f = ' + val(r.os.f, 'Hz', 1) + '.' : 'Der Rechteckgenerator schwingt nicht.') : 'Schwellen U_o = ' + val(r.sm.uo, 'V', 3) + ', U_u = ' + val(r.sm.uu, 'V', 3) + '.',
        schwelleO: r.sm.uo, schwelleU: r.sm.uu, hysterese: Math.max(0, r.sm.uh), usat: r.usat, usatN: r.usatN, ueLive: lv.ue, uaLive: lv.ua, kippt: !!(w && w.flips > 0), flips: w ? w.flips : 0,
        zustand: lv.ua > 0 ? 'hoch' : lv.ua < 0 ? 'tief' : 'null', sweep: sw.active, sweepP: sw.p, T: r.sch === 'rechteck' ? (r.os && r.os.valid !== false ? r.os.T : 0) : 1 / ctl.f, fosz: r.sch === 'rechteck' ? (r.os && r.os.valid !== false ? r.os.f : 0) : ctl.f };
    }

    // ---------------------------------------------------------------- Eingangsdurchlauf
    const swUe = (p, um) => -um + 2 * um * (p < 0.5 ? 2 * p : 2 * (1 - p));
    function swStep(r, ctl, p0, p1) {
      const k = Math.max(2, Math.ceil((p1 - p0) * 600)), list = [];
      for (let i = 1; i <= k; i++) list.push(swUe(p0 + (p1 - p0) * i / k, r.uemax));
      let ua;
      if (r.sch === 'komparator') ua = list.map(u => { const o = CORE.op.open(Object.assign({ up: u, un: ctl.uref }, r.base)); return wrapOk(o) && isNum(o.ua) ? o.ua : 0; });
      else {
        const s = CORE.komp.sweep(r.cfg, list, sw.hoch);
        ua = wrapOk(s) && Array.isArray(s.ua) && s.ua.length === list.length ? s.ua : list.map(() => sw.ua);
        if (wrapOk(s) && typeof s.hochEnde === 'boolean') sw.hoch = s.hochEnde;
      }
      for (let i = 0; i < list.length; i++) {
        const prev = i === 0 ? sw.ua : ua[i - 1];
        if (sw.started && (ua[i] > 0) !== (prev > 0) && (i > 0 || sw.ua !== 0)) {
          const von = prev > 0 ? '+U_sat' : (prev < 0 ? '−U_sat' : '0 V'), nach = ua[i] > 0 ? '+U_sat' : (ua[i] < 0 ? '−U_sat' : '0 V');
          sw.kipp.push({ ue: list[i], von, nach });
          P0.say('Kippstelle bei U_e = ' + val(list[i], 'V', 3) + ': Der Ausgang springt von ' + von + ' auf ' + nach + ' (' + (list[i] > (i === 0 ? sw.ue : list[i - 1]) ? 'U_e steigt' : 'U_e fällt') + ').', 'info');
        }
      }
      sw.ue = list[list.length - 1]; sw.ua = ua[ua.length - 1]; sw.started = true;
    }

    return {
      compute, meters, assess, diag, befund, curves, waveform, state,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!P0.anim.reduced) ph = (ph + dtMs / 1000 * 0.15) % 1;
        if (!sw.active || !r.ok) return;
        const p0 = sw.p;
        sw.p = Math.min(1, sw.p + dtMs / (SWEEP_S * 1000));
        swStep(r, ctl, p0, sw.p);
        if (sw.p >= 1) { sw.active = false; P0.say('Der Eingangsdurchlauf ist beendet' + (sw.kipp.length ? ': ' + sw.kipp.length + ' Kippstelle(n) gefunden.' : ': Der Ausgang ist nicht gekippt.'), 'info'); }
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 0; P0.say('Der Eingangsdurchlauf wurde abgebrochen.', 'info'); return true; }
        if (!r.ok) { P0.say('Mit diesen Werten gibt es keinen Durchlauf zu zeigen.', 'warn'); return false; }
        if (r.sch === 'rechteck') { P0.say('Der Eingangsdurchlauf gehört zu Komparator und Schmitt-Trigger; der Rechteckgenerator hat keinen Eingang. Wähle eine andere Schaltung.', 'warn'); return false; }
        if (r.sm.valid === false) { P0.say('Mit diesen Werten gibt es keinen Durchlauf zu zeigen: Der Ausgang kann nicht kippen.', 'warn'); return false; }
        sw.active = true; sw.p = 0; sw.kipp = []; sw.started = false;
        sw.ue = swUe(0, r.uemax);
        if (r.sch === 'komparator') { const o = CORE.op.open(Object.assign({ up: sw.ue, un: ctl.uref }, r.base)); sw.ua = wrapOk(o) && isNum(o.ua) ? o.ua : 0; sw.hoch = sw.ua > 0; }
        else { sw.hoch = r.cfg.art === 'inv'; const s = CORE.komp.sweep(r.cfg, [sw.ue], sw.hoch); sw.ua = wrapOk(s) && s.ua.length ? s.ua[0] : 0; if (wrapOk(s) && typeof s.hochEnde === 'boolean') sw.hoch = s.hochEnde; }
        sw.started = true;
        P0.say('Eingangsdurchlauf: U_e läuft von ' + val(sw.ue, 'V', 1) + ' bis ' + val(-sw.ue, 'V', 1) + ' und zurück. Beobachte, bei welchen Spannungen der Ausgang kippt.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; sw.kipp = []; sw.ue = 0; sw.ua = 0; sw.started = false; ph = 0; },
      extend(api) { api.sweepInfo = () => ({ active: sw.active, p: sw.p, ue: sw.ue, ua: sw.ua, kipp: sw.kipp.map(k => Object.assign({}, k)) }); },
      draw: (ctx, w, h, t, view, sc) => drawRig(ctx, w, h, t, view, sc, { sw, live, wfOf })
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
    const sch = ctl.schaltung;
    const m = { 'r2 offen': sch !== 'komparator' ? ['r2'] : [], 'r3 offen': sch === 'schmitt_inv' || sch === 'rechteck' ? ['r3'] : [], 'c offen': sch === 'rechteck' ? ['c'] : [], 'versorgung minus fehlt': ['uvn'], 'versorgung fehlt': ['uv', 'uvn'] }[ctl.fehler];
    if (!m || !m.length) return {};
    const nm = { 'r2 offen': 'R_2 offen', 'r3 offen': 'R_3 offen', 'c offen': 'Kondensator offen', 'versorgung minus fehlt': 'negative Versorgung fehlt', 'versorgung fehlt': 'Versorgung fehlt' }[ctl.fehler];
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
      const h0 = Math.round((bodyH - gap) * 0.52);
      kenn = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h0 }; sig = { x: kenn.x, y: R0.y + h0 + gap, w: rw, h: bodyH - h0 - gap };
    } else {
      const hh = bodyH - 3 * gap, q = [0.27, 0.32, 0.27, 0.14].map(x => Math.round(hh * x)); let y = R0.y;
      sch = { x: R0.x, y, w: R0.w, h: q[0] }; y += q[0] + gap;
      kenn = { x: R0.x, y, w: R0.w, h: q[1] }; y += q[1] + gap;
      sig = { x: R0.x, y, w: R0.w, h: q[2] }; y += q[2] + gap;
      strip = { x: R0.x, y, w: R0.w, h: R0.y + bodyH - y };
    }
    const fs = faultSpec(ctl, hid), lv = X.live(r, ctl), sm = r.sm, L = {}, vals = {};
    const sh = ctl.schaltung;
    const nomOr = (key, v, fault) => (!hid && ctl.fehler === fault && fs.fault ? 'offen' : eng(v, 'Ω'));
    L.ua = 'U_a = ' + eng(z0(lv.ua), 'V');
    if (sh === 'rechteck') {
      vals.r = eng(ctl.rt, 'Ω'); vals.c = !hid && ctl.fehler === 'c offen' ? 'offen' : eng(ctl.c, 'F'); vals.r2 = nomOr('r2', ctl.r2, 'r2 offen'); vals.r3 = nomOr('r3', ctl.r3, 'r3 offen');
    } else {
      L.ue = 'U_e = ' + eng(z0(lv.ue), 'V'); L.uref = 'U_ref = ' + eng(ctl.uref, 'V');
      if (sh === 'schmitt_inv') { vals.r2 = nomOr('r2', ctl.r2, 'r2 offen'); vals.r3 = nomOr('r3', ctl.r3, 'r3 offen'); }
      if (sh === 'schmitt_nin') { vals.r1 = eng(ctl.r1, 'Ω'); vals.r2 = nomOr('r2', ctl.r2, 'r2 offen'); }
    }
    if (!hid) { L.uv = '+U_v = ' + eng(ctl.fehler === 'versorgung fehlt' ? 0 : ctl.uv, 'V'); L.uvn = '−U_v = ' + eng(ctl.fehler === 'versorgung fehlt' || ctl.fehler === 'versorgung minus fehlt' ? 0 : -ctl.uv, 'V'); }
    else { L.uv = '+U_v'; L.uvn = '−U_v'; }
    const sdata = Object.assign({ kind: sh === 'rechteck' ? 'osc' : 'schmitt', art: sh === 'schmitt_nin' || sh === 'komparator' ? 'nin' : 'inv', values: vals, labels: L }, fs);
    if (sh === 'komparator') sdata.hide = ['r1', 'r2', 'r3'];
    if (!sc.view('schematic', sch, sdata, {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
    // Kennlinie (Hysterese-Schleife)
    const hd = { uo: sm.uo, uu: sm.uu, usat: r.usat, usatN: r.usatN, art: sh === 'schmitt_inv' || sh === 'rechteck' ? 'inv' : 'nin', uemax: r.uemax, ue: lv.ue, ua: lv.ua, uh: Math.max(0, sm.uh) };
    if (!(r.usat > 0) || !sm.valid && sh !== 'rechteck' || !sc.view('hyst', kenn, hd, {})) noData(ctx, g, kenn, pal, 'Keine Kennlinie: Der Ausgang kann mit diesen Werten nicht zwischen zwei Zuständen kippen (U_sat = ' + val(r.usat, 'V', 1) + ').');
    const wf = view.rig.waveform ? view.rig.waveform() : null;
    if (!wf || !sc.view('scope', sig, wf, {})) noData(ctx, g, sig, pal, sh === 'rechteck' ? 'Kein Verlauf: Der Rechteckgenerator schwingt mit diesen Werten nicht.' : 'Kein Verlauf für diese Werte.');
    if (strip.h >= 50) {
      g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
      const rows = [];
      if (sh === 'schmitt_inv') rows.push({ t: SICHT.formel, bold: true, color: pal.fg });
      else if (sh === 'schmitt_nin') rows.push({ t: 'U_o = U_ref · (1 + R_1/R_2) + U_sat · R_1/R_2', bold: true, color: pal.fg });
      else if (sh === 'rechteck') rows.push({ t: 'T = 2 · R · C · ln((1 + β)/(1 − β)), β = R_3/(R_2 + R_3)', bold: true, color: pal.fg });
      else rows.push({ t: 'U_a = +U_sat für U_e > U_ref, sonst −U_sat', bold: true, color: pal.fg });
      if (sh === 'rechteck') rows.push({ t: r.os && r.os.valid !== false ? 'T = ' + val(r.os.T * 1000, 'ms', 4) + ', f = ' + val(r.os.f, 'Hz', 1) + ', U_o = ' + val(r.os.uo, 'V', 2) + ', U_u = ' + val(r.os.uu, 'V', 2) : 'Der Rechteckgenerator schwingt mit diesen Werten nicht.', color: pal.fg });
      else rows.push({ t: 'U_o = ' + val(sm.uo, 'V', 3) + ', U_u = ' + val(sm.uu, 'V', 3) + ', U_H = ' + val(Math.max(0, sm.uh), 'V', 3), color: pal.fg });
      if (X.sw.kipp.length) { const k = X.sw.kipp[X.sw.kipp.length - 1]; rows.push({ t: 'Letzte Kippstelle: U_e = ' + val(k.ue, 'V', 3) + ' (' + k.von + ' → ' + k.nach + ')', color: pal.mute }); }
      g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
    }
    if (chipsH) {
      const y = R0.y + bodyH + gap, m = view.rig.readMeters();
      const items = [['U_o', val(m.uo, 'V', 2)], ['U_u', val(m.uu, 'V', 2)], ['U_H', val(m.uh, 'V', 2)], [sh === 'rechteck' ? 'f' : 'U_a', sh === 'rechteck' ? val(m.fosz, 'Hz', 1) : val(m.ua, 'V', 2)]];
      const cw = (R0.w - gap * (items.length - 1)) / items.length;
      items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
    }
  }

  R.register({ id: 'opv_komp', name: 'Komparator, Schmitt-Trigger und Rechteckgenerator', icon: '🔔', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'opv_komp', name: 'Komparator, Schmitt-Trigger und Rechteckgenerator', icon: '🔔', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['zielUh', 'zielF'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
