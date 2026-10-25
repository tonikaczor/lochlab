/* anarig-schalter.js - ANA-Lab (WP2a): Pruefstand 2 `schalter` - Transistor als Schalter (SPEC 5.2).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Zeitlupe, Zeichenhuelle, verdeckter Fehler) liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ANA_CORE.tr.switch / relais / dc / family); hier steht keine zweite Formel.
 * Das Zeitbild (waveform) tastet die analytischen Kernergebnisse ab (Relais: Anstieg mit tau = L/R, Abklingen ueber die Freilaufdiode, Spannungsspitze), siehe waveform().
 * Alle Zahlen sind Uebungswerte. Simulation fuer Kleinspannung, kein Hinweis fuer Arbeiten an Netzspannung.
 * Modell: B und U_CE,sat konstant (F4), keine Schaltzeiten (Speicherzeit nur Begriff), Relais als Spule L in Reihe mit R, Lehrmodell.
 * Steuerwerte: ub (V), ust (V), last ('led'|'relais'|'ohm'), uf (V, LED), rv (Ohm, LED), rspule (Ohm), lspule (H), rlast (Ohm), rb (Ohm), b, freilauf (Relais),
 *   eingang ('dauer-ein'|'dauer-aus'|'takt'), ftakt (Hz), fehler, ziel (A, Vorgabe Laststrom, 0 = keine).
 * Messgeraete: ic (mA), ib (µA), uce (V), ube (V), ubm (V, Betriebsspannung gemessen, gegen Masse am Lastanschluss), ueb (ü, Zahl), ibmin (µA), rbmax (kOhm), plast (mW), pv (mW), tau (ms).
 * Fehlerfall-Umsetzung (vor dem Kernaufruf): rb offen -> rb := R_OFFEN; ce schluss / ce offen / be offen -> tr.dc mit defekt (LED: Quellenspannung um U_F verringert);
 *   last offen -> Widerstand der gewaehlten Last := R_OFFEN; versorgung fehlt -> ub := 1 mV (am Messgeraet ubm als 0 V sichtbar, bei den anderen Fehlern bleibt ubm = U_B).
 *   ce offen: B-E-Diode intakt, I_B fliesst weiter (Kern tr.dc, Review v23 Fach 1); be offen und rb offen: I_B = 0.
 * fire(): schaltet das Steuersignal einmal ein und aus (Einzelvorgang im Zeitbild, Zeitlupe beachtet).
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./anarig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-schalter.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const LT = id => K(c => c.limitText(id));
  const MODELL = 'Modell: ' + (((C0 && C0.TEXTS && C0.TEXTS.modellTransistor) || 'konstante Gleichstromverstärkung B, Sättigung bei U_CE,sat.').replace(/^Lehrmodell [^:]*: /, '')) + ' Keine Schaltzeiten (die Speicherzeit ist nur ein Begriff), das Relais ist eine Spule L in Reihe mit einem Widerstand. Alle Werte sind Übungswerte (F4, F5).';
  const OFFEN = K(c => c.R_OFFEN) || 1e12;
  const UB_FEHLT = 1e-3;

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const CONTROLS = B.fillControls([
    { key: 'ub', label: 'Betriebsspannung U_B', type: 'slider', scale: 'lin', min: 3, max: 30, step: 0.1, unit: 'V', unitKind: 'V', value: 5, gruppe: 'quelle', sicht: 'formel',
      help: 'Betriebsspannung der Last. Kleinspannung (' + LT('u_klein') + '). Übungswert. Reicht sie nicht für U_CE,sat und die Flussspannung der LED, bekommt die Last keinen Strom.' },
    { key: 'ust', label: 'Steuerspannung U_St (High)', type: 'slider', scale: 'lin', min: 0, max: 30, step: 0.1, unit: 'V', unitKind: 'V', value: 5, gruppe: 'quelle', sicht: 'signal',
      help: 'Spannung des Steuersignals im Zustand High, zum Beispiel ein Ausgang einer Steuerung. Liegt sie nicht über U_BE (' + LT('ube') + ' belegt), sperrt der Transistor. Übungswert.' },
    { key: 'last', label: 'Last', type: 'select', value: 'led', options: opt([['led', 'LED mit Vorwiderstand'], ['relais', 'Relais (Spule)'], ['ohm', 'Ohmscher Verbraucher']]), gruppe: 'last', sicht: 'formel',
      help: 'Die Last im Kollektorkreis: LED mit Vorwiderstand, Relaisspule (Induktivität mit Widerstand) oder ein ohmscher Verbraucher. Die Wahl blendet die passenden Regler ein.' },
    { key: 'uf', label: 'Flussspannung der LED U_F', type: 'slider', scale: 'lin', min: 1.6, max: 3.4, step: 0.1, unit: 'V', unitKind: 'V', value: 2, gruppe: 'last', sicht: 'formel', visible: s => s.last === 'led',
      help: 'Flussspannung der LED, Übungswert (rot: ' + LT('uf_led_rot') + ', F2). Sie geht in den Sättigungsstrom ein: I_C,sat = (U_B − U_CE,sat − U_F) / R_V.' },
    { key: 'rv', label: 'LED-Vorwiderstand R_V', type: 'slider', scale: 'log', min: 10, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 330, gruppe: 'last', sicht: 'formel', visible: s => s.last === 'led',
      help: 'Vorwiderstand der LED im Kollektorkreis. Er legt den Laststrom fest: Ein größerer Vorwiderstand ergibt einen kleineren Strom. Übungswert.' },
    { key: 'rspule', label: 'Spulenwiderstand R_Spule', type: 'slider', scale: 'log', min: 20, max: 2000, step: 1, unit: 'Ω', unitKind: 'Ω', value: 240, gruppe: 'last', sicht: 'formel', visible: s => s.last === 'relais',
      help: 'Widerstand der Relaisspule. Der Strom im Beharrungszustand ist I = U_B / R_Spule, die Zeitkonstante τ = L / R. Übungswert.' },
    { key: 'lspule', label: 'Spuleninduktivität L', type: 'slider', scale: 'log', min: 0.01, max: 2, step: 0.01, unit: 'H', unitKind: 'H', value: 0.3, gruppe: 'last', sicht: 'signal', visible: s => s.last === 'relais',
      help: 'Induktivität der Relaisspule. Eine größere Induktivität verlängert den Stromanstieg (τ = L / R) und erhöht die Energie, die beim Abschalten abgebaut werden muss. Übungswert.' },
    { key: 'rlast', label: 'Lastwiderstand R_L', type: 'slider', scale: 'log', min: 5, max: 1e4, step: 1, unit: 'Ω', unitKind: 'Ω', value: 100, gruppe: 'last', sicht: 'formel', visible: s => s.last === 'ohm',
      help: 'Widerstand des ohmschen Verbrauchers, zum Beispiel einer Lampe. I_C,sat = (U_B − U_CE,sat) / R_L. Übungswert.' },
    { key: 'rb', label: 'Basisvorwiderstand R_B', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 4700, gruppe: 'bauteile', sicht: 'formel',
      help: 'Vorwiderstand in der Basisleitung: R_B = (U_St − U_BE) / (ü · I_C / B). Ein größerer Basisvorwiderstand ergibt einen kleineren Basisstrom und damit eine kleinere Übersteuerung ü. Übungswert.' },
    { key: 'b', label: 'Gleichstromverstärkung B', type: 'slider', scale: 'lin', min: 20, max: 400, step: 1, unit: '', unitKind: '', value: 100, gruppe: 'bauteile', sicht: 'formel',
      help: 'Gleichstromverstärkung des Transistors, I_C = B · I_B im aktiven Bereich. Sie streut in der Praxis stark, deshalb wird mit Übersteuerung gerechnet. Übungswert (' + LT('b_std') + ', F4).' },
    { key: 'freilauf', label: 'Freilaufdiode', type: 'switch', value: true, gruppe: 'last', sicht: 'signal', visible: s => s.last === 'relais',
      help: 'Freilaufdiode parallel zur Relaisspule. Mit ihr klingt der Spulenstrom beim Abschalten ab und die Spannung am Transistor bleibt bei etwa U_B + 0,7 V (belegt). Ohne sie steigt die Spannung bis zur Durchbruchspannung (Fehlerbild, nur Simulation).' },
    { key: 'eingang', label: 'Steuersignal', type: 'select', value: 'takt', options: opt([['dauer-ein', 'dauernd ein'], ['dauer-aus', 'dauernd aus'], ['takt', 'Takt']]), gruppe: 'quelle', sicht: 'signal',
      help: 'Verlauf des Steuersignals im Zeitbild: dauernd ein, dauernd aus oder ein Takt mit gleich langen Ein- und Ausphasen. Das Zeitbild ist die Darstellung des Rechenergebnisses, kein Schaltungssimulator.' },
    { key: 'ftakt', label: 'Taktfrequenz', type: 'slider', scale: 'log', min: 0.1, max: 1e4, step: 0.1, unit: 'Hz', unitKind: 'Hz', value: 100, gruppe: 'quelle', sicht: 'signal',
      help: 'Frequenz des Takts im Zeitbild. Bei hoher Frequenz kann ein Relais wegen τ = L / R dem Takt nicht mehr folgen. Die Anzeige läuft in Zeitlupe, nichts blinkt häufiger als 3 Hz.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt([['keiner', 'kein Fehler'], ['rb offen', 'Basisvorwiderstand offen'], ['ce schluss', 'Kollektor-Emitter-Schluss'], ['ce offen', 'Kollektor-Emitter offen'], ['be offen', 'Basis-Emitter offen'], ['last offen', 'Last offen'], ['versorgung fehlt', 'Versorgung fehlt']]), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall für die Fehlersuche (nur Simulation): Basisvorwiderstand offen, Transistor defekt (Schluss oder offen), Last offen oder Versorgung fehlt. Die Messwerte zeigen den Fehler sofort; erkläre ihn aus I_C, U_CE und I_B.' },
    { key: 'ziel', label: 'Vorgabe Laststrom (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 0.5, step: 0.001, unit: 'A', unitKind: 'A', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für den Laststrom I_C. Bei 0 A ist keine Vorgabe gesetzt und die Ampel bleibt grau. Grün verlangt den Strom im Fenster, Sättigung mit ausreichender Übersteuerung und keine Überlast. Die Ampelfenster sind Lehrfaustwerte (Übungswerte, F5, F16).' }
  ]);
  const METERS = [
    { key: 'ic', label: 'Laststrom I_C', unit: 'mA', digits: 3, min: 0, max: 500, help: 'Kollektorstrom, im Schalterbetrieb der Laststrom. In der Sättigung wird er von der Last bestimmt, nicht vom Transistor.' },
    { key: 'ib', label: 'Basisstrom I_B', unit: 'µA', digits: 1, min: 0, max: 5000, help: 'Basisstrom: I_B = (U_St − U_BE) / R_B. Er schaltet den Transistor, bestimmt aber nur im aktiven Bereich den Kollektorstrom.' },
    { key: 'uce', label: 'Spannung U_CE', unit: 'V', digits: 3, min: 0, max: 30, help: 'Spannung zwischen Kollektor und Emitter. In der Sättigung nahe U_CE,sat (Übungswert), im Sperrbereich gleich der Betriebsspannung.' },
    { key: 'ube', label: 'Spannung U_BE', unit: 'V', digits: 3, min: 0, max: 1, help: 'Spannung zwischen Basis und Emitter, bei leitender Basis-Emitter-Strecke ' + LT('ube') + ' (belegt).' },
    { key: 'ubm', label: 'Betriebsspannung U_B (gemessen)', unit: 'V', digits: 3, min: 0, max: 30, help: 'Spannung der Versorgung am Lastanschluss gegen Masse, mit dem Messgerät gemessen. Sie sollte der eingestellten Betriebsspannung entsprechen; liegt sie darunter, kommt die Last nicht aus der Versorgung.' },
    { key: 'ueb', label: 'Übersteuerung ü', unit: '', digits: 2, min: 0, max: 20, infAbove: 1e6, help: 'Übersteuerungsfaktor ü = I_B / I_B,min. Unter 1 ist der Transistor nicht gesättigt (halb offen, hohe Verlustleistung); üblich ist ein Wert um ' + LT('ue_typ') + ' (Übungswert, F5).' },
    { key: 'ibmin', label: 'Mindest-Basisstrom I_B,min', unit: 'µA', digits: 1, min: 0, max: 5000, help: 'Kleinster Basisstrom, der den Transistor gerade sättigt: I_B,min = I_C,sat / B.' },
    { key: 'rbmax', label: 'Größter Basisvorwiderstand R_B,max', unit: 'kΩ', digits: 2, min: 0, max: 1000, help: 'Größter Basisvorwiderstand, bei dem die Sättigung gerade erreicht wird (ü = 1). Ohne Reserve; rechne mit einer Übersteuerung.' },
    { key: 'plast', label: 'Leistung in der Last', unit: 'mW', digits: 2, min: 0, max: 5000, help: 'Leistung, die in der Last umgesetzt wird.' },
    { key: 'pv', label: 'Verlustleistung Transistor', unit: 'mW', digits: 2, min: 0, max: 1000, warnAbove: 500, help: 'Elektrische Verlustleistung im Transistor, P_V = U_CE · I_C + U_BE · I_B. Die Warnmarke ist P_tot (Übungswert).' },
    { key: 'tau', label: 'Zeitkonstante τ (Relais)', unit: 'ms', digits: 3, min: 0, max: 1000, help: 'Zeitkonstante der Relaisspule, τ = L / R_Spule. Nur bei der Last Relais; sonst 0.' }
  ];
  const PRESETS = [
    { id: 'led-5v', name: 'LED an 5 V',
      info: K(c => { const q = c.tr.switch({ ub: 5, last: 'led', uf: 2, rv: 330, ust: 5, rb: 4700, b: 100 }); return 'Übungsschaltung: LED an 5 V, R_B = 4,7 kΩ: gesättigt mit I_C = ' + val(q.ic * 1000, 'mA') + ' und ü = ' + val(q.ueb, '', 2) + '.'; }),
      controls: { ub: 5, ust: 5, last: 'led', uf: 2, rv: 330, rb: 4700, b: 100 } },
    { id: 'mcu-relais', name: 'Relais an einem 3,3-V-Ausgang',
      info: K(c => { const q = c.tr.switch({ ub: 12, last: 'relais', rspule: 240, ust: 3.3, rb: 2200, b: 100 }), t = c.tr.relais({ ub: 12, rspule: 240, lspule: 0.3, freilauf: true }); return 'Übungsschaltung: 12-V-Relais, Steuerspannung 3,3 V: I_C = ' + val(q.ic * 1000, 'mA') + ', ü = ' + val(q.ueb, '', 2) + ', τ = ' + val(t.tau * 1000, 'ms') + '.'; }),
      controls: { ub: 12, ust: 3.3, last: 'relais', rspule: 240, lspule: 0.3, rb: 2200, b: 100, freilauf: true } },
    { id: 'ueb-1', name: 'Gerade gesättigt (ü = 1)',
      info: K(c => { const q = c.tr.switch({ ub: 5, last: 'led', uf: 2, rv: 330, ust: 5, rb: 50000, b: 100 }); return 'Mit R_B = 50 kΩ ist ü = ' + val(q.ueb, '', 3) + ': gerade noch gesättigt, ohne Reserve (R_B,max = ' + val(q.rbMax / 1000, 'kΩ', 2) + ').'; }),
      controls: { ub: 5, ust: 5, last: 'led', uf: 2, rv: 330, rb: 50000, b: 100 } },
    { id: 'ueb-3', name: 'Dreifache Übersteuerung (ü = 3)',
      info: K(c => { const q = c.tr.switch({ ub: 5, last: 'led', uf: 2, rv: 330, ust: 5, rb: 17000, b: 100 }); return 'Mit R_B = 17 kΩ ist ü = ' + val(q.ueb, '', 3) + ' (Soll ' + c.limitText('ue_typ') + '): sicher gesättigt, auch wenn B streut.'; }),
      controls: { ub: 5, ust: 5, last: 'led', uf: 2, rv: 330, rb: 17000, b: 100 } },
    { id: 'freilauf-aus', name: 'Relais ohne Freilaufdiode (Fehlerbild)',
      info: K(c => { const t = c.tr.relais({ ub: 12, rspule: 240, lspule: 0.3, freilauf: false }); return 'Fehlerbild, nur Simulation: Ohne Freilaufdiode steigt die Spannung am Transistor beim Abschalten bis ' + val(t.ucePeak, 'V') + ' (Durchbruchspannung, Übungswert).'; }),
      controls: { ub: 12, ust: 3.3, last: 'relais', rspule: 240, lspule: 0.3, rb: 2200, b: 100, freilauf: false } },
    { id: 'rb-offen', name: 'Basisvorwiderstand offen (Fehlerbild)',
      info: 'Fehlerbild, nur Simulation: Ohne Basisstrom bleibt der Transistor gesperrt, die Last bekommt keinen Strom.',
      controls: { fehler: 'rb offen' } }
  ];
  const SICHT = { kennlinie: 'Ausgangskennlinienfeld mit Arbeitsgerade, Sperren und Sättigung', signal: 'Steuerspannung, Laststrom und Kollektorspannung über der Zeit', formel: 'R_B = (U_St − U_BE) / (ü · I_C / B)' };
  const INFO = 'Der Transistor als Schalter: Er soll entweder sperren oder sicher sättigen. Ausgangskennlinienfeld mit Arbeitsgerade, Zeitverlauf und Rechenweg zeigen dieselbe Schaltung. ' + MODELL;
  const FEHLER_TEXT = { 'rb offen': 'Basisvorwiderstand offen', 'ce schluss': 'Transistor defekt (Schluss)', 'ce offen': 'Transistor defekt (offen)', 'be offen': 'Transistor defekt (Basis offen)', 'last offen': 'Last offen', 'versorgung fehlt': 'Versorgung fehlt' };
  const DEF = { 'ce schluss': 'ce_schluss', 'ce offen': 'ce_offen', 'be offen': 'be_offen' };

  function plant(P0) {
    const CORE = P0.CORE;
    let einzel = false, fireP = 1, firing = false;
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };
    const engF = (x, u) => { try { return CORE.fmtEng(x, u); } catch (e) { return eng(x, u); } };
    const lim = id => B.limV(CORE, id, NaN);
    const mA = x => val(x * 1000, 'mA');
    const LV = (id, k, u) => val(lim(id) * k, u) + ' (Übungswert)';
    const uA = x => val(x * 1e6, 'µA');

    function compute(ctl) {
      const e = { ub: ctl.ub, ust: ctl.ust, last: ctl.last, uf: ctl.uf, rv: ctl.rv, rspule: ctl.rspule, rlast: ctl.rlast, rb: ctl.rb, b: ctl.b };
      const f = ctl.fehler, defekt = DEF[f] || '';
      if (f === 'rb offen') e.rb = OFFEN;
      else if (f === 'last offen') { if (e.last === 'led') e.rv = OFFEN; else if (e.last === 'relais') e.rspule = OFFEN; else e.rlast = OFFEN; }
      else if (f === 'versorgung fehlt') e.ub = UB_FEHLT;
      const swIn = { ub: e.ub, last: e.last, uf: e.uf, rv: e.rv, rspule: e.rspule, rlast: e.rlast, ust: e.ust, rb: e.rb, b: e.b };
      const sw = CORE.tr.switch(swIn);
      if (!sw || sw.ok === false) return { ok: false, why: (sw && sw.why) || 'Die Eingaben sind ungültig.' };
      const led = e.last === 'led', rl = led ? e.rv : e.last === 'relais' ? e.rspule : e.rlast, uf = led ? e.uf : 0;
      const o = { ok: true, valid: sw.valid !== false, why: sw.why || '', zustand: sw.zustand, ic: sw.ic, ib: sw.ib, uce: sw.uce, ube: sw.ube, ueb: isNum(sw.ueb) ? sw.ueb : 0, ibmin: sw.ibmin, icSat: sw.icSat,
        rbMax: isNum(sw.rbMax) ? sw.rbMax : 0, rbSoll: isNum(sw.rbSoll) ? sw.rbSoll : 0, plast: sw.plast, pv: sw.pv, defekt: '', e, led, rl, uf, sw };
      if (defekt && o.valid) {
        const ubEff = defekt === 'ce_schluss' && uf > 0 ? e.ub - uf : e.ub;
        const kurzOhneStrom = defekt === 'ce_schluss' && !(ubEff > 0);
        const dc = CORE.tr.dc({ ub: kurzOhneStrom ? e.ub : ubEff, rc: rl, re: 0, b: e.b, basis: 'rb', ubase: e.ust, rb: e.rb, defekt: kurzOhneStrom ? 'ce_offen' : defekt });
        if (dc && dc.ok !== false) {
          o.defekt = defekt; o.zustand = 'defekt'; o.ic = dc.ic; o.uce = kurzOhneStrom ? 0 : dc.uce; o.ube = dc.ube; o.pv = dc.pv;
          o.ib = defekt === 'be_offen' ? 0 : (isNum(dc.ib) ? dc.ib : sw.ib);
          o.plast = dc.ic > 0 ? dc.prc + uf * dc.ic : 0;
          o.ueb = defekt === 'ce_schluss' ? o.ueb : 0;
        }
      }
      o.rel = null; o.tAus = 0; o.sw2 = null;
      if (e.last === 'relais') {
        const rel = CORE.tr.relais({ ub: e.ub, rspule: e.rspule, lspule: ctl.lspule, freilauf: !!ctl.freilauf });
        if (rel && rel.ok !== false) {
          o.rel = rel;
          if (o.ic > 0) { const q = CORE.tr.relais({ ub: o.ic * e.rspule, rspule: e.rspule, lspule: ctl.lspule, freilauf: !!ctl.freilauf }); if (q && q.ok !== false) o.tAus = q.tAus; }
        }
      }
      if (o.valid && !o.defekt && o.zustand === 'saettigung') { const s2 = CORE.tr.switch(Object.assign({}, swIn, { b: e.b / 2 })); if (s2 && s2.ok !== false) o.sw2 = s2; }
      return o;
    }

    function meters(r) {
      if (!r.ok) return { ic: 0, ib: 0, uce: 0, ube: 0, ubm: 0, ueb: 0, ibmin: 0, rbmax: 0, plast: 0, pv: 0, tau: 0 };
      const lastOffen = r.rl >= OFFEN / 10;
      return { ic: r.ic * 1000, ib: r.ib * 1e6, uce: r.uce, ube: r.ube, ubm: r.e.ub, ueb: lastOffen && r.ib > 0 ? 1e12 : r.ueb, ibmin: r.ibmin * 1e6, rbmax: r.rbMax / 1000, plast: r.plast * 1000, pv: r.pv * 1000, tau: r.rel ? r.rel.tau * 1000 : 0 };
    }

    function assess(r, ctl, o) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      const soll = ctl.ziel, ist = r.ic, pct = Math.abs(ist - soll) / soll * 100, verd = !!(o && o.verdeckt);
      const base = B.devText('Laststrom', ist, soll, 'A', pct, CORE);
      const zi = { text: 'Laststrom ' + val(soll, 'A'), soll, ist, unit: 'A' };
      const rot = t => ({ ok: false, ampel: 'rot', text: t + ' ' + base, margin: pct, ziel: zi });
      if (!r.valid) return rot('Die Last bekommt keinen Strom: ' + r.why);
      if (r.zustand === 'defekt') return rot(verd ? 'Der Laststrom folgt nicht der Steuerung.' : 'Der Transistor ist defekt (nur Simulation).');
      if (r.zustand === 'sperrt') return rot('Der Transistor sperrt: I_C = ' + mA(r.ic) + ', U_CE = ' + val(r.uce, 'V') + '.');
      if (r.ic > lim('icmax')) return rot('Überlast: I_C = ' + mA(r.ic) + ' liegt über ' + LV('icmax', 1000, 'mA') + '.');
      if (r.pv > lim('ptot')) return rot('Überlast: P_V = ' + val(r.pv * 1000, 'mW') + ' liegt über ' + LV('ptot', 1000, 'mW') + '.');
      if (r.zustand === 'aktiv') return rot('Der Transistor ist nur aktiv, nicht gesättigt (ü = ' + val(r.ueb, '', 2) + ' unter 1, halb offen): U_CE = ' + val(r.uce, 'V') + ', P_V = ' + val(r.pv * 1000, 'mW') + '.');
      if (r.rel && ctl.last === 'relais' && r.rel.ueberUceo) return rot('Die Spannungsspitze beim Abschalten erreicht U_CEO = ' + val(r.rel.ucePeak, 'V') + ' (ohne Freilaufdiode).');
      const ampI = B.devAmpel(pct, CORE), ueMin = lim('ue_min');
      const ampU = r.ueb >= ueMin ? 'gruen' : 'gelb';
      const amp = ampI === 'rot' ? 'rot' : (ampI === 'gelb' || ampU === 'gelb') ? 'gelb' : 'gruen';
      let text = base + ' Sättigung mit ü = ' + val(r.ueb, '', 2) + ' (verlangt wird ' + LT('ue_min') + ').';
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else if (ampI !== 'gruen') text += ist < soll ? ' Der Laststrom ist zu klein.' : ' Der Laststrom ist zu groß.';
      else text += ' Die Übersteuerung ist knapp.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: zi };
    }

    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      const f = ctl.fehler;
      if (!r.valid) { out.push({ id: 'ungueltig', kind: 'error', text: r.why, verraet: f === 'versorgung fehlt' }); }
      if (r.valid && !r.defekt) {
        if (r.zustand === 'sperrt') out.push({ id: 'sperrt', kind: 'warn', text: 'Die Steuerspannung U_St = ' + val(r.e.ust, 'V') + ' liegt nicht über U_BE = ' + LT('ube') + ': Der Transistor sperrt (I_C = ' + mA(r.ic) + ', U_CE = ' + val(r.uce, 'V') + ').' });
        if (r.zustand === 'aktiv') out.push({ id: 'halb-offen', kind: 'warn', text: 'Der Transistor ist nur aktiv, nicht gesättigt (ü = ' + val(r.ueb, '', 3) + ' unter 1): U_CE = ' + val(r.uce, 'V') + ', P_V = ' + val(r.pv * 1000, 'mW') + '. Die Last bekommt nicht den vollen Strom (halb offen).' });
        if (r.zustand === 'saettigung' && r.ueb > 10 && r.rl < OFFEN / 10) out.push({ id: 'uebersteuert-stark', kind: 'info', text: 'Starke Übersteuerung (ü = ' + val(r.ueb, '', 1) + '): Der Transistor wird tief gesättigt. Als Begriff: Das kann das Ausschalten verzögern (Ausschaltverzögerung).' });
        if (r.sw2 && r.sw2.ueb < 1) out.push({ id: 'b-streuung', kind: 'warn', text: 'Mit halber Gleichstromverstärkung (B/2 = ' + val(r.e.b / 2, '') + ') wäre ü nur noch ' + val(r.sw2.ueb, '', 2) + ' unter 1: Der Transistor wäre nicht mehr gesättigt. B streut, plane Reserve ein.' });
      }
      if (r.valid && r.rel && ctl.last === 'relais' && !ctl.freilauf && r.ic > 0) out.push({ id: 'freilauf-fehlt', kind: 'error', text: 'Ohne Freilaufdiode erreicht die Spannungsspitze beim Abschalten U_CEO = ' + val(r.rel.ucePeak, 'V') + ' (Übungswert): Überlast für den Transistor, nur Simulation.' });
      if (r.valid && r.pv > lim('ptot')) out.push({ id: 'pv-hoch', kind: 'warn', text: 'Die Verlustleistung P_V = ' + val(r.pv * 1000, 'mW') + ' liegt über P_tot = ' + LV('ptot', 1000, 'mW') + ': Überlast für den Transistor.' });
      if (f === 'rb offen') out.push({ id: 'rb-offen', kind: 'error', text: 'Der Basisstrom ist null (I_B = ' + uA(r.ib) + '): Der Basisvorwiderstand ist offen, der Transistor schaltet nicht durch (I_C = ' + mA(r.ic) + ').', verraet: true });
      if (f === 'ce schluss') out.push({ id: 'ce-schluss', kind: 'error', text: 'U_CE = ' + val(r.uce, 'V') + ' bei I_C = ' + mA(r.ic) + ', unabhängig von der Steuerung: Die Kollektor-Emitter-Strecke hat einen Schluss, der Transistor ist defekt (nur Simulation).', verraet: true });
      if (f === 'ce offen') out.push({ id: 'ce-offen', kind: 'error', text: 'I_C = ' + mA(r.ic) + ' und U_CE = ' + val(r.uce, 'V') + ' trotz Steuerspannung: Die Kollektor-Emitter-Strecke ist offen, der Transistor ist defekt (nur Simulation).', verraet: true });
      if (f === 'be offen') out.push({ id: 'be-offen', kind: 'error', text: 'Es fließt kein Basisstrom (I_B = ' + uA(r.ib) + ') trotz Steuerspannung: Die Basis-Emitter-Strecke ist offen, der Transistor ist defekt (nur Simulation).', verraet: true });
      if (f === 'last offen') out.push({ id: 'last-offen', kind: 'error', text: 'Der Laststrom ist null (I_C = ' + mA(r.ic) + ') bei durchgesteuertem Transistor: Die Last ist offen.', verraet: true });
      if (f === 'versorgung fehlt') out.push({ id: 'versorgung-fehlt', kind: 'error', text: 'Die Betriebsspannung ist nur ' + val(r.e.ub * 1000, 'mV') + ': Die Versorgung fehlt, die Last bekommt keinen Strom.', verraet: true });
      return out;
    }
    function befund(r) {
      if (!r.ok) return [];
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: I_C = ' + mA(r.ic) + ', I_B = ' + uA(r.ib) + ', U_CE = ' + val(r.uce, 'V') + ', U_BE = ' + val(r.ube, 'V') + '.' }];
    }

    // ---- Kennlinien ----
    function lin(a, b, n) { const o = []; for (let k = 0; k < n; k++) o.push(a + (b - a) * k / (n - 1)); return o; }
    function fieldData(r, ctl) {
      const ub = r.e.ub, ucesat = lim('ucesat'), uf = r.uf;
      const uce = lin(0, Math.max(ub, ucesat * 2), 60);
      let ibs = [];
      if (r.ibmin > 0) ibs = [0.5, 1, 2].map(k => k * r.ibmin);
      if (r.ib > 0 && ibs.every(v => Math.abs(v - r.ib) > 1e-12)) ibs.push(r.ib);
      if (!ibs.length) ibs = [1e-5, 2e-5];
      ibs.sort((a, b) => a - b);
      const fam = CORE.tr.family({ b: r.e.b, ucesat }, ibs, uce);
      const iEnd = r.icSat > 0 ? r.icSat : 0, xEnd = Math.max(ub - uf, ucesat * 1.01);
      const lineP = iEnd > 0 ? [[ucesat, iEnd], [xEnd, 0]] : null;
      return { fam, lineP, ucesat, uce, ibs };
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const d = fieldData(r, ctl), out = [];
      if (d.fam && d.fam.ok !== false) {
        const series = d.fam.series.map(s => ({ name: 'I_B = ' + uA(s.ib), points: d.fam.uce.map((u, k) => [u, s.ic[k] * 1000]), kind: 'i' }));
        if (d.lineP) series.push({ name: 'Arbeitsgerade', points: d.lineP.map(p => [p[0], p[1] * 1000]), kind: 'line' });
        const c1 = { id: 'ausgang', title: 'Ausgangskennlinienfeld mit Arbeitsgerade', xLabel: 'Spannung U_CE', xUnit: 'V', xScale: 'lin', yLabel: 'Kollektorstrom I_C', yUnit: 'mA', series,
          marker: { x: r.uce, y: r.ic * 1000, label: 'Arbeitspunkt: ' + val(r.uce, 'V') + ' | ' + val(r.ic * 1000, 'mA') }, zones: [{ x0: 0, x1: d.ucesat, name: 'Sättigung', kind: 'saett' }] };
        const ymax = Math.max(r.ic * 1000, d.lineP ? d.lineP[0][1] * 1000 : 0, 1e-6);
        if (lim('icmax') * 1000 <= ymax * 1.6) c1.limit = { y: lim('icmax') * 1000, name: 'I_C,max', sym: false };
        out.push(c1);
      }
      // Uebersteuerung ueber dem Basisvorwiderstand (aus dem Kern gerechnet)
      const rbs = [], pts = [];
      for (let k = 0; k < 41; k++) rbs.push(100 * Math.pow(1e6 / 100, k / 40));
      rbs.forEach(rb => { const q = CORE.tr.switch({ ub: r.e.ub, last: r.e.last, uf: r.e.uf, rv: r.e.rv, rspule: r.e.rspule, rlast: r.e.rlast, ust: r.e.ust, rb, b: r.e.b }); if (q && q.ok !== false && q.valid !== false && isNum(q.ueb)) pts.push([rb, q.ueb]); });
      if (pts.length >= 2) {
        const rbNow = clamp(r.e.rb, 100, 1e6);
        out.push({ id: 'ueb', title: 'Übersteuerung über dem Basisvorwiderstand', xLabel: 'Basisvorwiderstand R_B', xUnit: 'Ω', xScale: 'log', yLabel: 'Übersteuerung ü', yUnit: '', series: [{ name: 'ü', points: pts, kind: 'out' }],
          marker: { x: rbNow, y: r.ueb, label: 'jetzt: R_B = ' + engF(rbNow, 'Ω') + ', ü = ' + val(r.ueb, '', 2) }, limit: { y: 1, name: 'ü = 1 (gerade gesättigt)', sym: false } });
      }
      return out;
    }

    // ---- Zeitbild: Abtastung der Kernergebnisse ----
    function tUnitOf(W) { return W >= 1 ? { u: 's', k: 1 } : W >= 1e-3 ? { u: 'ms', k: 1e3 } : { u: 'µs', k: 1e6 }; }
    function waveform(r, ctl, o) {
      if (!r.ok || !r.valid) return null;
      o = o || {};
      const n = clamp(Math.floor(num(o.n, 240)), 24, 2000), single = o.einzel === true || (o.einzel !== false && einzel);
      const relais = ctl.last === 'relais' && r.rel, tau = relais ? r.rel.tau : 0, ub = r.e.ub, ufd = lim('ufd_freilauf');
      let ton, toff, pre = 0, mode = ctl.eingang;
      const T = 1 / ctl.ftakt;
      if (single) { ton = relais ? 6 * tau : T / 2; toff = relais ? Math.max(6 * tau, r.tAus * 1.5) : T / 2; pre = ton * 0.12; mode = 'einzel'; }
      else { ton = T / 2; toff = T / 2; }
      const W = single ? pre + ton + toff : 2 * T, tu = tUnitOf(W);
      const high = ts => {
        if (mode === 'dauer-ein') return true; if (mode === 'dauer-aus') return false;
        if (mode === 'einzel') return ts >= pre && ts < pre + ton;
        return (ts % T) < T / 2;
      };
      const t = [], us = [], ic = [], uce = [];
      let cur = mode === 'dauer-ein' ? r.ic : 0, prevHigh = high(0), tPrev = 0, spikeFrom = -1;
      const spike = [];
      for (let k = 0; k < n; k++) {
        const ts = W * k / (n - 1), h = high(ts), dt = ts - tPrev;
        if (relais) {
          if (dt > 0) {
            const hh = prevHigh;     // Zustand im Intervall: der des Intervallanfangs (Abtastung fein genug)
            if (hh) cur = r.ic + (cur - r.ic) * Math.exp(-dt / tau);
            else if (ctl.freilauf) { const R = r.e.rspule; cur = Math.max(0, (cur + ufd / R) * Math.exp(-dt / tau) - ufd / R); }
            else cur = 0;
          }
        } else cur = h ? r.ic : 0;
        let uc;
        if (h) uc = r.uce;
        else if (relais && ctl.freilauf && cur > 0) uc = ub + ufd;
        else uc = ub;
        if (relais && !ctl.freilauf && prevHigh && !h) { uc = r.rel.ucePeak; spikeFrom = ts; spike.push([ts, ts + tau * 0.08]); }
        if (spike.length && ts <= spike[spike.length - 1][1] && ts >= spike[spike.length - 1][0] && !(prevHigh && !h)) uc = r.rel.ucePeak;
        t.push(ts * tu.k); us.push(h ? ctl.ust : 0); ic.push(cur * 1000); uce.push(uc);
        prevHigh = h; tPrev = ts;
      }
      void spikeFrom;
      const series = [{ name: 'U_St', unit: 'V', kind: 'u', y: us }, { name: 'I_C', unit: 'mA', kind: 'i', y: ic }, { name: 'U_CE', unit: 'V', kind: 'out', y: uce }];
      const marks = { h: [{ y: r.ic * 1000, name: 'I_C', series: 1 }] };
      if (relais) marks.span = [{ t0: (single ? pre : 0) * tu.k, t1: ((single ? pre : 0) + r.rel.tAn90) * tu.k, name: 't₉₀' }];
      const w = { tUnit: tu.u, t, series, marks, einzel: single, T };
      if (relais && !ctl.freilauf && spike.length) w.clip = spike.slice(0, 4).map(s => ({ t0: s[0] * tu.k, t1: Math.max(s[1], s[0] + W / (n - 1) * 2) * tu.k, name: 'Spannungsspitze (Fehlerbild)' }));
      return w;
    }

    // ---- Zeichnen ----
    function labelsFor(r) {
      return { ub: 'U_B = ' + val(r.e.ub, 'V'), ust: 'U_St = ' + val(r.e.ust, 'V'), ib: 'I_B = ' + uA(r.ib), ic: 'I_C = ' + mA(r.ic), uce: 'U_CE = ' + val(r.uce, 'V'), ube: 'U_BE = ' + val(r.ube, 'V') };
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, ctl = view.ctl;
      if (!r || !r.ok) { sc.gfx.text(ctx, (r && r.why) || '', R0.x + 8, R0.y + 20, { size: 13, color: pal.fg, max: R0.w - 16 }); return; }
      const wide = R0.w >= 640;
      let kR, wR, sR, fR;
      if (wide) {
        const lw = Math.round(R0.w * 0.5) - gap / 2, rw = R0.w - lw - gap, kh = Math.round(R0.h * 0.55), sh = Math.round(R0.h * 0.52);
        kR = { x: R0.x, y: R0.y, w: lw, h: kh - gap / 2 }; wR = { x: R0.x, y: R0.y + kh + gap / 2, w: lw, h: R0.h - kh - gap / 2 };
        sR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: sh - gap / 2 }; fR = { x: R0.x + lw + gap, y: R0.y + sh + gap / 2, w: rw, h: R0.h - sh - gap / 2 };
      } else {
        const hs = [0.29, 0.24, 0.26, 0.21].map(p => Math.round(R0.h * p));
        let y = R0.y;
        kR = { x: R0.x, y, w: R0.w, h: hs[0] - gap }; y += hs[0];
        wR = { x: R0.x, y, w: R0.w, h: hs[1] - gap }; y += hs[1];
        sR = { x: R0.x, y, w: R0.w, h: hs[2] - gap }; y += hs[2];
        fR = { x: R0.x, y, w: R0.w, h: Math.max(0, R0.y + R0.h - y) };
      }
      const empty = (rect, txt) => { sc.gfx.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 6); sc.gfx.text(ctx, txt, rect.x + 8, rect.y + 22, { size: 12, color: pal.mute, max: rect.w - 16 }); };
      // Kennlinie: Ausgangskennlinienfeld
      const d = fieldData(r, ctl);
      let ok = false;
      if (d.fam && d.fam.ok !== false) {
        const fd = { uce: d.fam.uce, series: d.fam.series, ucesat: d.ucesat, sperr: true, marker: { x: r.uce, y: r.ic, label: 'AP: ' + val(r.uce, 'V') + ' | ' + val(r.ic * 1000, 'mA') } };
        if (d.lineP) fd.lines = [{ name: 'Arbeitsgerade', kind: 'dc', points: d.lineP }];
        ok = sc.view('family', kR, fd, {});
      }
      if (!ok) empty(kR, 'Kennlinienfeld nicht darstellbar');
      // Signal: Zeitverlauf
      const wf = r.valid ? waveform(r, ctl, { n: sc.quality === 'niedrig' ? 120 : 240 }) : null;
      if (wf) { const o2 = {}; if (firing) o2.wipe = fireP; if (!sc.view('scope', wR, wf, o2)) empty(wR, 'Zeitbild nicht darstellbar'); }
      else empty(wR, r.valid ? 'Kein Zeitbild' : r.why);
      // Schaltbild
      const verd = view.verdeckt, f = ctl.fehler;
      const values = { ub: val(r.e.ub, 'V'), ust: val(r.e.ust, 'V'), rb: engF(ctl.rb, 'Ω') };
      if (ctl.last === 'led') { values.rv = engF(ctl.rv, 'Ω'); values.uf = 'U_F = ' + val(ctl.uf, 'V'); } else if (ctl.last === 'relais') { values.rspule = engF(ctl.rspule, 'Ω'); values.lspule = engF(ctl.lspule, 'H'); } else values.rlast = engF(ctl.rlast, 'Ω');
      const data = { kind: 'schalter', last: ctl.last, freilauf: !!ctl.freilauf, values, labels: labelsFor(r) };
      if (!verd && f !== 'keiner') {
        const fid = f === 'rb offen' ? 'rb' : (DEF[f] ? 'q' : f === 'last offen' ? (ctl.last === 'led' ? 'rv' : ctl.last === 'relais' ? 'rspule' : 'rlast') : 'ub');
        data.fault = fid; data.faultText = 'Fehlerstelle: ' + FEHLER_TEXT[f];
      }
      if (!sc.view('schematic', sR, data, {})) empty(sR, 'Schaltbild nicht darstellbar');
      // Formel mit Zahlen
      sc.gfx.panel(ctx, fR.x, fR.y, fR.w, fR.h, pal.panel, pal.line, 6);
      const lastF = ctl.last === 'led' ? 'I_C,sat = (U_B − U_CE,sat − U_F) / R_V' : ctl.last === 'relais' ? 'I_C,sat = (U_B − U_CE,sat) / R_Spule' : 'I_C,sat = (U_B − U_CE,sat) / R_L';
      const rows = [{ t: 'R_B = (U_St − U_BE) / (ü · I_C / B)', bold: true, color: pal.u }];
      if (r.valid) {
        rows.push({ t: lastF + ' = ' + mA(r.icSat) });
        rows.push({ t: 'I_B,min = I_C,sat / B = ' + uA(r.ibmin) + ',  I_B = (U_St − U_BE) / R_B = ' + uA(r.ib) });
        rows.push({ t: 'ü = I_B / I_B,min = ' + val(r.ueb, '', 2) + ' (' + (r.zustand === 'saettigung' ? 'gesättigt' : r.zustand === 'aktiv' ? 'nur aktiv' : r.zustand === 'sperrt' ? 'sperrt' : (view.verdeckt ? 'nicht durchgesteuert' : 'defekt')) + ')', bold: true });
        if (r.rbMax > 0) rows.push({ t: 'R_B,max (ü = 1) = ' + engF(r.rbMax, 'Ω') + ',  R_B für ü = ' + val(lim('ue_typ'), '') + ': ' + engF(r.rbSoll, 'Ω'), color: pal.out });
        rows.push({ t: 'U_CE,sat = ' + LT('ucesat'), color: pal.mute });
      } else rows.push({ t: r.why, color: pal.mute });
      sc.gfx.lines(ctx, fR, rows, pal, { size: sc.fs, lh: sc.fs + 5 });
      if (firing) sc.gfx.text(ctx, 'Schaltvorgang läuft', wR.x + wR.w - 8, wR.y + wR.h - 8, { size: 11, color: pal.fg, bg: pal.panel, align: 'right', max: wR.w - 16 });
    }

    function state(r, ctl) {
      if (!r.ok) return { valid: false, why: r.why, einzel, firing, fireP };
      return { valid: r.valid, why: r.why, zustand: r.zustand, ic: r.ic, ib: r.ib, uce: r.uce, ube: r.ube, ueb: r.ueb, ibmin: r.ibmin, icSat: r.icSat, rbMax: r.rbMax, rbSoll: r.rbSoll, plast: r.plast, pv: r.pv,
        tau: r.rel ? r.rel.tau : 0, tAn90: r.rel ? r.rel.tAn90 : 0, tAus: r.tAus, ucePeak: r.rel ? r.rel.ucePeak : 0, ueberUceo: r.rel ? !!r.rel.ueberUceo : false, defekt: r.defekt, einzel, firing, fireP };
    }
    return {
      compute, meters, assess, diag, befund, curves, waveform, state, draw,
      phaseHz: () => 0,
      onControl(key) { if (key === 'eingang' || key === 'ftakt' || key === '*') { einzel = false; firing = false; fireP = 1; } },
      fire() {
        if (firing) { firing = false; fireP = 1; P0.say('Schaltvorgang abgebrochen.', 'info'); P0.bump(); return true; }
        einzel = true; firing = true; fireP = 0;
        P0.say('Schaltvorgang: Das Steuersignal wird einmal ein- und ausgeschaltet; das Zeitbild zeigt Laststrom und Kollektorspannung.', 'info');
        P0.bump(); return true;
      },
      step(dtMs) {
        if (!firing) return;
        fireP = Math.min(1, fireP + dtMs / 5000);
        if (fireP >= 1) { firing = false; fireP = 1; P0.say('Schaltvorgang beendet.', 'info'); P0.bump(); }
      },
      reset() { einzel = false; firing = false; fireP = 1; }
    };
  }

  R.register({ id: 'schalter', name: 'Transistor als Schalter', icon: '🔀', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'schalter', name: 'Transistor als Schalter', icon: '🔀', info: INFO, world: { w: 960, h: 600 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
