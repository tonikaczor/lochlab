/* ntsrig-regel.js - Netzteil-Lab (WP2d): Pruefstand 7 `regel` - Regelkreis und Labornetzteil (SPEC 5.7).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js (und ntscore-sw.js, ntscore-diag.js) laden (in Node holt sie sich alles per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.loop.divider / step / stability, NTS_CORE.lab.cvcc / ilim / short); hier steht keine zweite Formel.
 * Zwei Betriebsarten (Steuerwert `modus`): "regelung" = Spannungsregelung mit Teiler R1/R2 und Lastsprung (Lehrmodell zweiter Ordnung, Uebungswerte aus limits loop_*),
 * "labor" = Labornetzteil mit Spannungsregelung (CV) und Strombegrenzung (CC). Eingang Gleichspannung bis 60 V (Kleinspannung, limits u_dc_max).
 *
 * Schluessel fuer NTS_CORE.assess('regel', state) (ABWEICHUNGEN WP1c Punkt 4): modus, uref, r1, r2, vr, kompensation, lastsprung, uset, iset, rlast, rs,
 *   offen ('', 'R1', 'R2'), erwartet ('', 'CV', 'CC'), tAusMax (s). R1 gilt ab limits r1_offen (1 MOhm) als offen (WP3a setzt r1 auf das Maximum).
 * Einheiten: SI (V, A, Ohm, s), Ausnahmen gibt es nicht. Die Spannung U_set dient im Modus "regelung" bei offenem R2 als Anschlag.
 * Messgeraete: uaus (V), iaus (A), modus (1 = CV, 0 = CC), tAus (µs), ueber (%), pm (Grad), dUmax (mV); wirft nie. Taste fire = Lastsprung (regelung) oder Kurzschluss (labor).
 * Neue Uebungswerte (A, F45), von dieser Datei in NTS_CORE.limits eingetragen: lab_uin (24 V, Eingang des Labornetzteil-Modells), taus_vorgabe (500 µs, Vorgabe der Ausregelzeit).
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-regel.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, fm, eng, clamp } = B;

  /* Neue Grenzwerte (Uebungswerte, Frage F45): gemeinsame Konstanten, einzige Quelle fuer Vorgabe und limits */
  const LAB_UIN = 24, TAUS_VORGABE = 5e-4;
  (function () {
    let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
    if (C0 && Array.isArray(C0.limits)) {
      if (!C0.limits.some(l => l.id === 'lab_uin')) C0.limits.push({ id: 'lab_uin', value: LAB_UIN, unit: 'V', cmp: '=', status: 'A', quelle: '—', frage: 'F45', text: 'Eingangsspannung des Labornetzteil-Modells (Linearregler) im Prüfstand Regelkreis (Übungswert).' });
      if (!C0.limits.some(l => l.id === 'taus_vorgabe')) C0.limits.push({ id: 'taus_vorgabe', value: TAUS_VORGABE, unit: 's', cmp: '<=', status: 'A', quelle: '—', frage: 'F45', text: 'Vorgabe der Ausregelzeit im Prüfstand Regelkreis (Übungswert, die Aufgabe nennt die echte Vorgabe).' });
    }
  })();

  const G_E = 'Eingang und Transformator', G_R = 'Regelung', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const labor = s => s.modus === 'labor', regelung = s => s.modus !== 'labor';
  const CONTROLS = [
    { key: 'modus', label: 'Betriebsart', type: 'select', value: 'regelung', options: opt([['regelung', 'Spannungsregelung mit Teiler'], ['labor', 'Labornetzteil (CV und CC)']]), stufe: 'regel', group: G_R,
      help: 'Spannungsregelung: Teiler R1 und R2, Referenz und Fehlerverstärker halten die Ausgangsspannung, du prüfst Lastsprung, Überschwingen und Schwingen. Labornetzteil: Spannung und Strom sind einstellbar, die Last entscheidet, welche Regelung (CV oder CC) arbeitet.' },
    { key: 'uref', label: 'Referenzspannung U_ref', type: 'slider', scale: 'lin', min: 0.5, max: 5, step: 0.05, unit: 'V', unitKind: 'volt', value: 1.25, stufe: 'regel', group: G_R, visible: regelung,
      help: 'Referenzspannung des Reglers (LM317 und MC34063: 1,25 V, belegt). Die Regelung hält die Rückkopplungsspannung gleich dieser Referenz, deshalb ist U_aus = U_ref · (1 + R2 / R1).' },
    { key: 'r1', label: 'Teilerwiderstand R1 (nach Masse)', type: 'slider', scale: 'log', min: 100, max: 1000000, step: 1, unit: 'Ω', unitKind: 'res', value: 1000, stufe: 'regel', group: G_R, visible: regelung,
      help: 'R1 liegt wie im Pool (W2023-07) nach Masse. Ein größeres R1 senkt die Ausgangsspannung. Ab 1 MΩ gilt R1 als offen: Dann fehlt der Teiler nach Masse, die Rückkopplung sieht den Ausgang selbst, und U_aus fällt auf U_ref.' },
    { key: 'r2', label: 'Teilerwiderstand R2 (zum Ausgang)', type: 'slider', scale: 'lin', min: 0, max: 50000, step: 50, unit: 'Ω', unitKind: 'res', value: 6200, stufe: 'regel', group: G_R, visible: regelung,
      help: 'R2 liegt zwischen Ausgang und Rückkopplungseingang. Ein größeres R2 erhöht die Ausgangsspannung: U_aus = U_ref · (1 + R2 / R1). Mit R1 1 kΩ und U_aus 9,0 V ist R2 6,2 kΩ (Pool W2023-07).' },
    { key: 'offen', label: 'Lehrfehler am Teiler', type: 'select', value: '', options: opt([['', 'Kein Fehler'], ['R1', 'R1 offen'], ['R2', 'R2 offen']]), stufe: 'regel', group: G_R, visible: regelung,
      help: 'Simuliert einen unterbrochenen Teilerwiderstand. R1 offen: Der Ausgang liegt bei der Referenzspannung (zu niedrig). R2 offen: Die Rückkopplung sieht 0 V, der Ausgang steigt bis zum Anschlag (zu hoch).' },
    { key: 'vr', label: 'Regelverstärkung V_r', type: 'slider', scale: 'log', min: 1, max: 500, step: 1, unit: '', unitKind: 'ratio', value: 10, stufe: 'regel', group: G_R, visible: regelung,
      help: 'Verstärkung des Fehlerverstärkers (Übungswert 10). Eine größere Verstärkung verkleinert die bleibende Abweichung nach einem Lastsprung, verkleinert aber die Phasenreserve: Zu viel Verstärkung lässt den Regelkreis schwingen (Lehrmodell, F11).' },
    { key: 'kompensation', label: 'Kompensation', type: 'switch', value: false, stufe: 'regel', group: G_R, visible: regelung,
      help: 'Die Kompensation senkt die Schleifenverstärkung um den Faktor 10 (Übungswert). Das vergrößert die Phasenreserve und beruhigt das Schwingen, macht die Ausregelung aber langsamer und die bleibende Abweichung größer.' },
    { key: 'lastsprung', label: 'Laststromsprung ΔI', type: 'slider', scale: 'lin', min: 0.05, max: 2, step: 0.05, unit: 'A', unitKind: 'amp', value: 0.5, stufe: 'last', group: G_L, visible: regelung,
      help: 'Sprung des Laststroms (Übungswert 0,5 A). Ein größerer Sprung vergrößert die Abweichung der Ausgangsspannung im selben Verhältnis (lineares Lehrmodell).' },
    { key: 'tAusMax', label: 'Vorgabe der Ausregelzeit', type: 'slider', scale: 'log', min: 1e-5, max: 1e-2, step: 1e-6, unit: 's', unitKind: 'time', value: TAUS_VORGABE, stufe: null, group: G_L, visible: regelung,
      help: 'Vorgabe der Aufgabe (Übungswert 500 µs, kein Fachwert): Braucht die Ausgangsspannung nach dem Lastsprung länger als diese Zeit, um in das Band von 2 % um den Endwert zu kommen, steht die Ampel auf gelb.' },
    { key: 'erwartet', label: 'Erwarteter Modus (Aufgabe)', type: 'select', value: '', options: opt([['', 'Keine Vorgabe'], ['CV', 'CV erwartet'], ['CC', 'CC erwartet']]), stufe: null, group: G_L, visible: labor,
      help: 'Wenn die Aufgabe den erwarteten Modus nennt, prüft die Ampel ihn: Arbeitet das Labornetzteil im anderen Modus (CV oder CC), steht sie auf rot. Ohne Vorgabe gibt es kein "CV/CC falsch" (F44).' },
    { key: 'uin', label: 'Eingangsspannung U_ein (Labornetzteil)', type: 'slider', scale: 'lin', min: 6, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: LAB_UIN, stufe: 'trafo', group: G_E, visible: labor,
      help: 'Gleichspannung am Eingang des Labornetzteils (Kleinspannung bis 60 V, Übungswert 24 V). Die Eingangsspannung bestimmt, wie viel Verlustleistung ein Linearregler als Wärme umsetzt: P_V = (U_ein − U_aus) · I_aus.' },
    { key: 'uset', label: 'Sollspannung U_set (Anschlag bei offenem R2)', type: 'slider', scale: 'lin', min: 1, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: 12, stufe: 'regel', group: G_R, visible: s => labor(s) || s.offen === 'R2',
      help: 'Labornetzteil: eingestellte Ausgangsspannung (CV-Grenze). Spannungsregelung mit offenem R2: Spannung, bis zu der der Ausgang ansteigt (Anschlag im Modell). Kleinspannung, höchstens 60 V.' },
    { key: 'iset', label: 'Stromgrenze I_set', type: 'slider', scale: 'lin', min: 0.1, max: 3, step: 0.05, unit: 'A', unitKind: 'amp', value: 1, stufe: 'regel', group: G_R, visible: labor,
      help: 'Eingestellter Grenzstrom des Labornetzteils. Fordert die Last mehr Strom, begrenzt die Strombegrenzung (CC) und die Ausgangsspannung sinkt. Der Grenzwiderstand ist R_krit = U_set / I_set.' },
    { key: 'rs', label: 'Messwiderstand R_s', type: 'slider', scale: 'lin', min: 0.1, max: 2, step: 0.05, unit: 'Ω', unitKind: 'res', value: 0.6, stufe: 'regel', group: G_R, visible: labor,
      help: 'Messwiderstand der Strombegrenzung mit zweitem Transistor: I_lim = U_BE / R_s (U_BE 0,7 V, belegt, Pool W2024-23). Ein größerer Messwiderstand begrenzt früher. Am Widerstand fällt die Leistung P = I² · R_s ab.' },
    { key: 'rlast', label: 'Lastwiderstand R_last', type: 'slider', scale: 'lin', min: 0, max: 100, step: 0.5, unit: 'Ω', unitKind: 'res', value: 20, stufe: 'last', group: G_L, visible: labor,
      help: 'Lastwiderstand am Ausgang. Über dem Grenzwiderstand R_krit regelt die Spannung (CV), darunter begrenzt der Strom (CC). 0 Ω ist der Kurzschluss: Im CC-Betrieb fließt dann I_set bei 0 V.' },
    { key: 'fire', label: 'Lastsprung / Kurzschluss', type: 'button', stufe: null, group: G_L, help: 'Spannungsregelung: Lastsprung um ΔI und Ergebnis der Ausregelung melden. Labornetzteil: Kurzschluss am Ausgang und Verhalten im CC-Betrieb melden (nur Simulation, die Anzeige bleibt auf dem eingestellten Stand).' }
  ];
  const METERS = [
    { key: 'uaus', label: 'Ausgangsspannung U_aus', unit: 'V', digits: 3, min: 0, max: 60, help: 'Spannungsregelung: U_ref · (1 + R2 / R1) (bei offenem Teiler Referenz oder Anschlag). Labornetzteil: U_set im CV-Betrieb, I_set · R_last im CC-Betrieb.' },
    { key: 'iaus', label: 'Ausgangsstrom I_aus', unit: 'A', digits: 3, min: 0, max: 3, zeroIsNone: true, help: 'Nur im Labornetzteil: U_set / R_last im CV-Betrieb, I_set im CC-Betrieb. Die Spannungsregelung hat keinen Laststrom, nur den Sprung ΔI.' },
    { key: 'modus', label: 'Regelung (Code)', unit: '', digits: 0, min: 0, max: 1, texts: { 0: 'CC (Strom begrenzt)', 1: 'CV (Spannung geregelt)' },
      help: 'Code: 1 = CV (die Spannung ist geregelt), 0 = CC (der Strom ist begrenzt). Entscheidend ist der Vergleich von R_last mit R_krit = U_set / I_set; bei Gleichheit gilt CV.' },
    { key: 'tAus', label: 'Ausregelzeit', unit: 'µs', digits: 1, min: 0, max: 5000, zeroIsNone: true, help: 'Zeit, bis die Ausgangsspannung nach dem Lastsprung dauerhaft im Band von 2 % um den Endwert liegt (Zeitschrittrechnung des Lehrmodells). Nur in der Spannungsregelung.' },
    { key: 'ueber', label: 'Überschwingen', unit: '%', digits: 1, min: 0, max: 500, zeroIsNone: true, help: 'Spitze der Abweichung über die bleibende Abweichung hinaus, bezogen auf die bleibende Abweichung. Über 10 % (Lehrfaustwert) steht die Ampel auf gelb. Nur in der Spannungsregelung.' },
    { key: 'pm', label: 'Phasenreserve', unit: '°', digits: 0, min: 0, max: 180, zeroIsNone: true, help: 'Abstand der Phase von −180° bei der Durchtrittsfrequenz (Lehrmodell). Unter 45° (Lehrfaustwert) schwingt der Regelkreis, unter 30° ist es deutlich. Nur in der Spannungsregelung.' },
    { key: 'dUmax', label: 'Größte Abweichung nach dem Sprung', unit: 'mV', digits: 1, min: 0, max: 10000, zeroIsNone: true, help: 'Größte Abweichung der Ausgangsspannung vom Sollwert nach dem Lastsprung (Zeitschrittrechnung). Die bleibende Abweichung ist ΔI · R_aus / (1 + V_r).' }
  ];
  const PRESETS = [
    { id: 'teiler-5v', name: 'Teiler 5 V', info: 'Mit R1 1 kΩ und R2 3 kΩ stellt sich U_aus = 1,25 V · (1 + 3) = 5,0 V ein (Referenz LM317, belegt).', params: { modus: 'regelung', uref: 1.25, r1: 1000, r2: 3000, vr: 10, kompensation: false, lastsprung: 0.5, offen: '' } },
    { id: 'lastsprung', name: 'Lastsprung', info: 'Mit 9,0 V (R2 6,2 kΩ) und einem Lastsprung von 1 A: größere Abweichung, kein Schwingen (Lehrmodell, Übungswerte).', params: { modus: 'regelung', uref: 1.25, r1: 1000, r2: 6200, vr: 10, kompensation: false, lastsprung: 1, offen: '' } },
    { id: 'schwingt', name: 'Regelkreis schwingt', info: 'Mit Verstärkung 200 und ohne Kompensation ist die Phasenreserve zu klein: Der Ausgang schwingt nach. Mit Kompensation wird es deutlich ruhiger.', params: { modus: 'regelung', uref: 1.25, r1: 1000, r2: 6200, vr: 200, kompensation: false, lastsprung: 0.5, offen: '' } },
    { id: 'lab-cv', name: 'Labornetzteil: CV', info: '12 V und 1 A mit 20 Ω Last: R_krit ist 12 Ω, die Last liegt darüber, die Spannung ist geregelt (CV, 600 mA).', params: { modus: 'labor', uset: 12, iset: 1, rlast: 20, rs: 0.6, uin: LAB_UIN, erwartet: '' } },
    { id: 'lab-cc', name: 'Labornetzteil: CC', info: '12 V und 1 A mit 8 Ω Last: Die Last liegt unter R_krit 12 Ω, der Strom ist begrenzt (CC), die Spannung sinkt auf 8,0 V.', params: { modus: 'labor', uset: 12, iset: 1, rlast: 8, rs: 0.6, uin: LAB_UIN, erwartet: '' } },
    { id: 'lab-kurzschluss', name: 'Labornetzteil: Kurzschluss', info: 'Mit 0 Ω Last fließt im CC-Betrieb I_set bei 0 V. Beim Linearregler setzt der Regler dabei U_ein · I_set in Wärme um.', params: { modus: 'labor', uset: 12, iset: 1, rlast: 0, rs: 0.6, uin: LAB_UIN, erwartet: '' } }
  ];
  const PFAD = { quelle: 'Gleichspannung bis 60 V (Kleinspannung) am Eingang des Reglers oder des Labornetzteils', wandlung: 'Regelkreis: Teiler, Referenz und Fehlerverstärker steuern das Stellglied; im Labornetzteil begrenzt eine zweite Regelung den Strom', senke: 'Last mit geregelter Ausgangsspannung', art: 'getaktet' };

  /* Text umbrechen (Breite aus measureText); gibt hoechstens maxLines Zeilen zurueck, die letzte endet bei Platzmangel mit einem Auslassungszeichen */
  function wrap(ctx, s, maxW, size, maxLines) {
    ctx.font = B.gfx.font(size, false);
    const words = String(s).split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    const wd = x => (ctx.measureText ? ctx.measureText(x).width : x.length * size * 0.55);
    words.forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (wd(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);
    function compute(ctl) {
      const cv = CORE.lab.cvcc({ Uset: ctl.uset, Iset: ctl.iset, Rlast: ctl.rlast, Uin: ctl.uin });
      const il = CORE.lab.ilim({ Rs: ctl.rs });
      const sh = CORE.lab.short({ Uin: ctl.uin, Iset: ctl.iset, typ: 'linear' });
      const offenR1 = ctl.offen === 'R1' || ctl.r1 >= L('r1_offen');
      const offen = offenR1 ? 'R1' : (ctl.offen === 'R2' ? 'R2' : null);
      const r1eff = offenR1 ? Math.min(Math.max(ctl.r1, 1), 1e12) : ctl.r1;
      const dv = CORE.loop.divider({ Uref: ctl.uref, R1: r1eff, R2: ctl.r2, offen: offen || undefined, Uanschlag: ctl.uset });
      const Vr = ctl.vr, dI = ctl.lastsprung, tau = L('loop_tau'), VrEff = ctl.kompensation ? Vr / L('loop_komp') : Vr;
      const uset = dv && isNum(dv.Uaus) && dv.Uaus >= 0 ? dv.Uaus : 0;
      const st = CORE.loop.step({ C: L('loop_c'), Raus: L('loop_raus'), Vr: VrEff, tau, dI, Uset: uset });
      const out = { cv, il, sh, dv, st, offen, Vr, VrEff, dI, uset, pmMin: L('pm_min'), ueberG: L('ueberschwing'), iUnit: ctl.iset };
      if (labor(ctl)) { if (!cv || cv.ok === false) return { ok: false, error: cv && cv.why || 'Eingabe' }; } else {
        if (!dv || dv.ok === false) return { ok: false, error: dv && dv.why || 'Eingabe' };
        if (!st || st.ok === false) return { ok: false, error: st && st.why || 'Eingabe' };
      }
      out.ok = true; return out;
    }
    function meters(r, ctl) {
      if (!r.ok) return { uaus: 0, iaus: 0, modus: 0, tAus: 0, ueber: 0, pm: 0, dUmax: 0 };
      if (labor(ctl)) return { uaus: r.cv.Uout, iaus: r.cv.Iout, modus: r.cv.modus === 'CV' ? 1 : 0, tAus: 0, ueber: 0, pm: 0, dUmax: 0 };
      return { uaus: isNum(r.dv.Uaus) ? r.dv.Uaus : 0, iaus: 0, modus: 1, tAus: isNum(r.st.tAus) ? r.st.tAus * 1e6 : 0, ueber: r.st.ueber * 100, pm: r.st.pm, dUmax: r.st.dUmax * 1000 };
    }
    /* Bilanz nur im Labornetzteil (Linearregler: P_V = (U_ein - U_aus) · I_aus aus lab.cvcc); die Spannungsregelung hat keine Leistungsbilanz */
    function bilanz(r, ctl) {
      if (!r.ok || !labor(ctl)) return null;
      const pab = r.cv.Pout, pv = isNum(r.cv.PvLinear) ? r.cv.PvLinear : 0;
      return { pzu: pab + pv, pab, pv: pv > 0 ? [{ stufe: 'regel', w: pv }] : [] };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'grau', text: String(r.error || '') || 'Die Anlage ist mit diesen Werten nicht rechenbar.' };
      if (labor(ctl)) {
        const cv = r.cv;
        if (ctl.erwartet && ctl.erwartet !== cv.modus) return { ok: false, ampel: 'rot', text: 'Falsch gesetzt: Erwartet ist ' + ctl.erwartet + ', das Labornetzteil arbeitet in ' + cv.modus + ' (R_last = ' + eng(ctl.rlast, 'Ω') + ', R_krit = ' + eng(cv.Rkrit, 'Ω') + ').' };
        if (ctl.rlast === 0) return { ok: false, ampel: 'gelb', text: 'Kurzschluss am Ausgang: Das Labornetzteil arbeitet in CC und liefert I_set = ' + eng(ctl.iset, 'A') + ' bei 0 V. Beim Linearregler setzt der Regler dabei U_ein · I_set in Wärme um (Thermik-Lab).' };
        return { ok: true, ampel: 'gruen', text: cv.modus + ': R_last = ' + eng(ctl.rlast, 'Ω') + ' ' + (cv.modus === 'CC' ? 'unter' : 'über') + ' R_krit = ' + eng(cv.Rkrit, 'Ω') + ', U_aus = ' + eng(cv.Uout, 'V') + ', I_aus = ' + eng(cv.Iout, 'A') + '.' };
      }
      const st = r.st, ue = st.ueber * 100, tAusMax = ctl.tAusMax;
      if (r.offen) return { ok: false, ampel: 'rot', text: 'Der Teilerwiderstand ' + r.offen + ' ist offen: ' + (r.offen === 'R1' ? 'Der Ausgang liegt bei der Referenzspannung ' + eng(ctl.uref, 'V') + ' (zu niedrig).' : 'Der Ausgang steigt bis zum Anschlag (zu hoch).') };
      if (st.schwingt) return { ok: false, ampel: 'rot', text: 'Der Regelkreis schwingt: Phasenreserve ' + fm(st.pm, 0) + '° unter ' + fm(r.pmMin, 0) + '° (Lehrfaustwert).', margin: st.pm / r.pmMin };
      if (ue > r.ueberG + 1e-9) return { ok: false, ampel: 'gelb', text: 'Überschwingen ' + fm(ue, 1) + ' % liegt über ' + fm(r.ueberG, 0) + ' % (Lehrfaustwert).', margin: r.ueberG / ue };
      if (isFinite(tAusMax) && !(st.tAus <= tAusMax)) return { ok: false, ampel: 'gelb', text: 'Ausregelzeit ' + (isNum(st.tAus) ? eng(st.tAus, 's') : 'länger als die Rechenzeit') + ' liegt über der Vorgabe ' + eng(tAusMax, 's') + ' (Übungswert).' };
      return { ok: true, ampel: 'gruen', text: 'Kein Schwingen (Phasenreserve ' + fm(st.pm, 0) + '°), Überschwingen ' + fm(ue, 1) + ' %, Ausregelzeit ' + eng(st.tAus, 's') + ', U_aus = ' + eng(r.dv.Uaus, 'V') + ' (Lehrmodell, Übungswerte).', margin: st.pm / r.pmMin };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) return out;
      out.push({ id: 'regel-modell', kind: 'info', text: 'Lehrmodell: Der Regelkreis ist ein lineares Modell zweiter Ordnung mit Übungswerten (Datenblatt maßgeblich); eine Bode-Auslegung gibt es nicht (Regelungstechnik-Lab).', link: 'reglab.html' });
      let list = [];
      try { list = CORE.diagnose({ rigId: 'regel', state: Object.assign({}, ctl) }) || []; } catch (e) { list = []; }
      list.forEach(d => { const o = { id: d.id, kind: d.kind || 'info', text: d.text + (d.gegenprobe ? ' ' + d.gegenprobe : '') }; if (d.link) o.link = d.link; if (d.fx) o.fx = d.fx; out.push(o); });
      if (labor(ctl)) {
        if (isNum(r.il.Ilim) && ctl.iset > r.il.Ilim + 1e-9) out.push({ id: 'rs-begrenzt', kind: 'info', text: 'Der Messwiderstand ' + eng(ctl.rs, 'Ω') + ' begrenzt bei I_lim = U_BE / R_s = ' + eng(r.il.Ilim, 'A') + ', also früher als der eingestellte Strom ' + eng(ctl.iset, 'A') + '.' });
        if (ctl.uset > ctl.uin + 1e-9) out.push({ id: 'uin-zu-klein', kind: 'warn', text: 'Die Sollspannung ' + eng(ctl.uset, 'V') + ' liegt über der Eingangsspannung ' + eng(ctl.uin, 'V') + ': Ein Linearregler kann die Spannung nur verkleinern.' });
      }
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const pt = (arr, x, y) => { if (isNum(x) && isNum(y)) arr.push([x, y]); };
      if (labor(ctl)) {
        const A = [], Rk = r.cv.Rkrit, E2 = [];
        for (let k = 0; k <= 40; k++) { const rl = 3 * Rk * k / 40, q = CORE.lab.cvcc({ Uset: ctl.uset, Iset: ctl.iset, Rlast: rl }); if (q && q.ok !== false) pt(A, q.Iout, q.Uout); }
        for (let k = 0; k <= 40; k++) { const rs = 0.1 + 1.9 * k / 40, q = CORE.lab.ilim({ Rs: rs }); if (q && q.ok !== false) pt(E2, rs, q.Ilim); }
        return [{ id: 'cvcc', title: 'Kennlinie des Labornetzteils: Spannung über Strom', xLabel: 'Ausgangsstrom I_aus', xUnit: 'A', xScale: 'lin', yLabel: 'Ausgangsspannung U_aus', yUnit: 'V',
          series: [{ name: 'U_aus über I_aus (R_last von 0 Ω bis 3 · R_krit)', points: A }], marker: { x: r.cv.Iout, y: r.cv.Uout, label: 'jetzt ' + r.cv.modus + ': ' + eng(r.cv.Uout, 'V') + ' bei ' + eng(r.cv.Iout, 'A') } },
        { id: 'ilim-rs', title: 'Strombegrenzung über dem Messwiderstand', xLabel: 'Messwiderstand R_s', xUnit: 'Ω', xScale: 'lin', yLabel: 'Begrenzungsstrom I_lim = U_BE / R_s', yUnit: 'A',
          series: [{ name: 'I_lim', points: E2 }], marker: { x: ctl.rs, y: r.il.Ilim, label: 'jetzt ' + eng(r.il.Ilim, 'A') } }];
      }
      const T = [], M = [];
      if (r.st.verlauf) r.st.verlauf.t.forEach((t, i) => pt(T, t * 1e6, r.st.verlauf.u[i]));
      for (let k = 0; k <= 40; k++) { const r2 = 50000 * k / 40, q = CORE.loop.divider({ Uref: ctl.uref, R1: ctl.r1 >= L('r1_offen') ? L('r1_offen') : ctl.r1, R2: r2 }); if (q && q.ok !== false) pt(M, r2, q.Uaus); }
      const out = [{ id: 'sprung', title: 'Sprungantwort der Ausgangsspannung nach dem Lastsprung (Lehrmodell)', xLabel: 'Zeit nach dem Sprung', xUnit: 'µs', xScale: 'lin', yLabel: 'Ausgangsspannung U_aus', yUnit: 'V',
        series: [{ name: 'U_aus', points: T }], marker: { x: r.st.tMin * 1e6, y: r.uset - r.st.dUmax, label: 'größte Abweichung ' + eng(r.st.dUmax, 'V') } },
      { id: 'teiler', title: 'Ausgangsspannung über R2 (Teilerformel)', xLabel: 'Teilerwiderstand R2', xUnit: 'Ω', xScale: 'lin', yLabel: 'Ausgangsspannung U_aus', yUnit: 'V',
        series: [{ name: 'U_aus = U_ref · (1 + R2 / R1)', points: M }], marker: r.offen ? undefined : { x: ctl.r2, y: r.dv.Uaus, label: 'jetzt ' + eng(r.dv.Uaus, 'V') } }];
      const P2 = [];
      for (let k = 0; k <= 40; k++) { const vr = Math.pow(500, k / 40), q = CORE.loop.stability({ C: L('loop_c'), Raus: L('loop_raus'), Vr: vr, tau: L('loop_tau') }); if (q && q.ok !== false) pt(P2, vr, q.pm); }
      const q0 = CORE.loop.stability({ C: L('loop_c'), Raus: L('loop_raus'), Vr: r.VrEff, tau: L('loop_tau') });
      out.push({ id: 'pm-vr', title: 'Phasenreserve über der Schleifenverstärkung (Lehrmodell)', xLabel: 'Wirksame Verstärkung', xUnit: '', xScale: 'log', yLabel: 'Phasenreserve', yUnit: '°',
        series: [{ name: 'Phasenreserve', points: P2 }], marker: q0 && q0.ok !== false ? { x: r.VrEff, y: q0.pm, label: 'jetzt ' + fm(q0.pm, 0) + '°' } : undefined, limit: { y: r.pmMin, label: 'Lehrfaustwert ' + fm(r.pmMin, 0) + '° (Übungswert)' } });
      return out;
    }
    function waveform(r, ctl) {
      if (!r.ok || labor(ctl) || !r.st.verlauf) return null;
      const v = r.st.verlauf, marks = [{ name: 't_Min', value: r.st.tMin * 1e6, unit: 'µs' }];
      if (isNum(r.st.tAus)) marks.push({ name: 't_Aus', value: r.st.tAus * 1e6, unit: 'µs' });
      return { tUnit: 'µs', t: v.t.map(x => x * 1e6), series: [{ name: 'u_aus', y: v.u.slice(), unit: 'V' }, { name: 'i_last', y: v.t.map(() => r.dI), unit: 'A' }], marks };
    }
    function state(r, ctl) {
      if (!r.ok) return { betrieb: '', modusText: '', offenEff: '' };
      if (labor(ctl)) return { betrieb: r.cv.modus, modusText: r.cv.modus === 'CV' ? METERS[2].texts[1] : METERS[2].texts[0], offenEff: '', rkrit: r.cv.Rkrit, ilim: r.il.Ilim || 0, pvRegler: r.cv.PvLinear || 0 };
      return { betrieb: 'regelung', modusText: 'Spannungsregelung', offenEff: r.offen || '', pm: r.st.pm, dUmax: r.st.dUmax, dUstat: r.st.dUstat, ueber: r.st.ueber * 100, tAus: isNum(r.st.tAus) ? r.st.tAus : 0, schwingt: r.st.schwingt === true, uaus: r.dv.Uaus };
    }
    function fire(r, ctl) {
      if (!r.ok) { P0.say('Auslösen nicht möglich: ' + (r.error || 'Eingabe prüfen') + '.', 'warn'); return false; }
      if (labor(ctl)) {
        const k = CORE.lab.cvcc({ Uset: ctl.uset, Iset: ctl.iset, Rlast: 0, Uin: ctl.uin }), sh = CORE.lab.short({ Uin: ctl.uin, Iset: ctl.iset, typ: 'linear' });
        if (!k || k.ok === false) { P0.say('Kurzschluss: nicht rechenbar.', 'warn'); return false; }
        P0.say('Kurzschluss am Ausgang: ' + k.modus + ' mit ' + eng(k.Iout, 'A') + ' bei ' + eng(k.Uout, 'V') + (sh && sh.ok !== false && isNum(sh.PvRegler) ? '; beim Linearregler setzt der Regler U_ein · I_set = ' + eng(sh.PvRegler, 'W') + ' in Wärme um (Kühlung im Thermik-Lab).' : '.'), 'warn');
        return true;
      }
      const s = r.st;
      P0.say('Lastsprung um ' + eng(r.dI, 'A') + ': größte Abweichung ' + eng(s.dUmax, 'V') + ', bleibend ' + eng(Math.abs(s.dUstat), 'V') + ', Überschwingen ' + fm(s.ueber * 100, 1) + ' %, Ausregelzeit ' + (isNum(s.tAus) ? eng(s.tAus, 's') : 'länger als die Rechenzeit') + ', Phasenreserve ' + fm(s.pm, 0) + '°' + (s.schwingt ? ' (schwingt)' : '') + '.', s.schwingt ? 'warn' : 'info');
      return true;
    }
    function infoLines(r, ctl) {
      const o = [];
      if (labor(ctl)) {
        const cv = r.cv;
        o.push('R_krit = U_set / I_set = ' + eng(cv.Rkrit, 'Ω'));
        o.push('R_last = ' + eng(ctl.rlast, 'Ω') + (ctl.rlast >= cv.Rkrit ? ' ≥ R_krit: CV' : ' < R_krit: CC') + ', ' + eng(cv.Uout, 'V') + ' und ' + eng(cv.Iout, 'A'));
        if (isNum(r.il.Ilim)) o.push('Messwiderstand ' + eng(ctl.rs, 'Ω') + ': I_lim = U_BE / R_s = ' + eng(r.il.Ilim, 'A') + ', P = ' + eng(r.il.P, 'W'));
        if (isNum(cv.PvLinear)) o.push('Linearregler: P_V = (U_ein − U_aus) · I_aus = ' + eng(cv.PvLinear, 'W'));
        return o;
      }
      o.push(r.offen === 'R1' ? 'R1 offen: U_aus = U_ref = ' + eng(ctl.uref, 'V') : r.offen === 'R2' ? 'R2 offen: U_aus am Anschlag ' + eng(r.dv.Uaus, 'V') : 'U_aus = U_ref · (1 + R2 / R1) = ' + eng(r.dv.Uaus, 'V'));
      o.push('Lastsprung ' + eng(r.dI, 'A') + ': größte Abweichung ' + eng(r.st.dUmax, 'V') + ', bleibend ' + eng(Math.abs(r.st.dUstat), 'V'));
      o.push('Phasenreserve ' + fm(r.st.pm, 0) + '° (Lehrfaustwert: mindestens ' + fm(r.pmMin, 0) + '°), Überschwingen ' + fm(r.st.ueber * 100, 1) + ' %');
      o.push('Ausregelzeit ' + (isNum(r.st.tAus) ? eng(r.st.tAus, 's') : 'länger als die Rechenzeit') + ', Verstärkung ' + fm(r.VrEff, 1) + (ctl.kompensation ? ' (kompensiert)' : ''));
      return o;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal, ctl = view.ctl, D = sc.D, fs = sc.fs;
      if (!rc || rc.w < 140 || rc.h < 100 || !r.ok) {
        if (rc && rc.w >= 140 && !r.ok) B.gfx.text(ctx, String(r.error || 'Die Anlage ist mit diesen Werten nicht rechenbar.'), rc.x + 4, rc.y + 20, { size: fs, color: pal.fg, max: rc.w - 8 });
        return;
      }
      const wide = rc.w >= 640, gap = 8, o2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false };
      let main, side;
      if (wide) { const mw = Math.floor(rc.w * 0.62); main = { x: rc.x, y: rc.y, w: mw - gap, h: rc.h }; side = { x: rc.x + mw, y: rc.y, w: rc.w - mw, h: rc.h }; }
      else { const mh = Math.floor(rc.h * 0.62); main = { x: rc.x, y: rc.y, w: rc.w, h: mh - gap }; side = { x: rc.x, y: rc.y + mh, w: rc.w, h: rc.h - mh }; }
      let ok = false;
      if (labor(ctl)) {
        if (D && D.cvccChart) ok = !!D.cvccChart(ctx, main, { uSet: ctl.uset, iSet: ctl.iset, rLoad: ctl.rlast > 0 ? ctl.rlast : undefined, op: { u: r.cv.Uout, i: r.cv.Iout, mode: r.cv.modus === 'CV' ? 'cv' : 'cc' } }, o2);
      } else if (D && D.loopBlock) {
        const sv = r.st.verlauf, step = sv ? { t: sv.t.slice(), u: sv.u.slice() } : undefined;
        ok = !!D.loopBlock(ctx, main, { uRef: ctl.uref, r1: Math.min(ctl.r1, 1e12), r2: ctl.r2, uOut: isNum(r.dv.Uaus) ? r.dv.Uaus : undefined, step, state: r.offen ? 'Teilerwiderstand ' + r.offen + ' offen' : (r.st.schwingt ? 'schwingt' : undefined) }, o2);
      }
      if (!ok) B.gfx.text(ctx, labor(ctl) ? 'Labornetzteil: ' + r.cv.modus + ', ' + eng(r.cv.Uout, 'V') + ' bei ' + eng(r.cv.Iout, 'A') : 'Regelkreis: U_aus = ' + eng(r.dv.Uaus, 'V'), main.x + 4, main.y + 20, { size: fs, color: pal.fg, max: main.w - 8 });
      /* Seitenfeld: Zahlen aus dem Kern, umgebrochen */
      B.gfx.panel(ctx, side.x, side.y, side.w, side.h, pal.panel, pal.line, 8);
      let y = side.y + fs + 8;
      B.gfx.text(ctx, labor(ctl) ? 'Labornetzteil' : 'Regelkreis', side.x + 8, y, { size: fs + 1, bold: true, color: pal.fg, max: side.w - 16 });
      y += fs + 8;
      const lh = fs + 4;
      infoLines(r, ctl).forEach(s => {
        const room = Math.floor((side.y + side.h - y - 4) / lh);
        if (room < 1) return;
        const ls = wrap(ctx, s, side.w - 16, fs, Math.min(room, 3));
        ls.forEach(l => { B.gfx.text(ctx, l, side.x + 8, y, { size: fs, color: pal.mute, max: side.w - 16 }); y += lh; });
        y += 2;
      });
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, state, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'regel', name: 'Regelkreis und Labornetzteil', icon: '🎛️', info: 'Teiler, Referenz und Fehlerverstärker: Lastsprung, Überschwingen und Schwingen; dazu das Labornetzteil mit CV und CC.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'regel', name: 'Regelkreis und Labornetzteil', icon: '🎛️', info: 'Regelkreis und Labornetzteil', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
