/* ntsrig-stabil.js - Netzteil-Lab (WP2b): Pruefstand 3 `stabil` - Z-Diode und Linearregler (SPEC 5.3).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.zener.stage / rvMin / regulation, NTS_CORE.lin.fixed / lm317 / limitT2); hier steht keine zweite Formel.
 * Ausnahmen (Produkte aus Kernwerten, siehe ABWEICHUNGEN WP2b): Leistungsbilanz der Z-Stufe bei nicht leitender Diode (Spannungsteiler) und
 * Lastwiderstands-Modell in der Strombegrenzung (U = I_lim * U_aus / I_last).
 * Eingang Gleichspannung 5..40 V (Kleinspannung, unter limits u_dc_max). Dies ist ein Simulationslabor, keine Anleitung fuer Arbeiten an Netzspannung.
 * Steuerwerte: art (zener/7805/lm317), ue (V), uz (V), rv (Ohm), rlast (Ohm, nur Z-Diode), r1, r2 (Ohm, LM317), iLast (A, 7805/LM317), t2 (Strombegrenzung), r3 (Ohm), kurz (Ausgang kurzgeschlossen), Taste fire (Last anlegen).
 * Messgeraete: uaus (V), iz (mA), iaus (A), pv (W), eta (%), modus (Zahlencode, siehe Messgeraet). Wirft nie.
 * Uebungswerte: P_max der Z-Diode (limits pz_max, F32), Dropout, I_Z,min, r_z, Mindestlast (alle aus NTS_CORE.limits, Status A).
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-stabil.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, isNum, fm, eng } = B;

  /* Uebungswert in die einzige Quelle `limits` eintragen (einmalig) */
  try {
    const C0 = B.core();
    if (C0 && Array.isArray(C0.limits) && !C0.limits.some(l => l.id === 'pz_max')) {
      C0.limits.push({ id: 'pz_max', value: 0.5, unit: 'W', cmp: '<=', status: 'A', quelle: '—', frage: 'F32', text: 'Zulässige Verlustleistung der Z-Diode im Prüfstand Stabilisieren (Übungswert, Datenblatt maßgeblich).' });
    }
  } catch (e) { /* ohne Kern keine Grenzwerte */ }

  const G_E = 'Eingang und Transformator', G_R = 'Regelung', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const isZ = s => s.art === 'zener', isReg = s => s.art !== 'zener', is317 = s => s.art === 'lm317';
  const CONTROLS = [
    { key: 'art', label: 'Schaltung', type: 'select', value: '7805', options: opt([['zener', 'Z-Diode mit Vorwiderstand'], ['7805', 'Festspannungsregler 7805 (5 V)'], ['lm317', 'LM317 (einstellbar)']]), stufe: 'regel', group: G_R,
      help: 'Wählt die Stabilisierung: Die Z-Diode mit Vorwiderstand klemmt die Spannung, der 7805 liefert fest 5 V, der LM317 stellt die Spannung mit R1 und R2 ein. Der Linearregler setzt die Differenz zwischen Eingang und Ausgang in Wärme um.' },
    { key: 'ue', label: 'Eingangsspannung U_ein', type: 'slider', scale: 'lin', min: 5, max: 40, step: 0.5, unit: 'V', unitKind: 'volt', value: 14, stufe: 'trafo', group: G_E,
      help: 'Gleichspannung am Eingang der Stabilisierung (zum Beispiel hinter Gleichrichter und Ladekondensator). Das Modell rechnet nur mit Kleinspannung. Eine höhere Eingangsspannung erhöht bei gleichem Strom die Verlustleistung des Linearreglers.' },
    { key: 'uz', label: 'Z-Spannung U_Z', type: 'slider', scale: 'lin', min: 2.4, max: 30, step: 0.1, unit: 'V', unitKind: 'volt', value: 5.1, stufe: 'regel', group: G_R, visible: isZ,
      help: 'Z-Spannung der Diode (nur Schaltung Z-Diode). Bei ausreichendem Z-Strom hält die Diode die Ausgangsspannung auf diesem Wert. Liegt die Eingangsspannung darunter, sperrt die Diode.' },
    { key: 'rv', label: 'Vorwiderstand R_V', type: 'slider', scale: 'log', min: 22, max: 5000, step: 1, unit: 'Ω', unitKind: 'res', value: 470, stufe: 'regel', group: G_R, visible: isZ,
      help: 'Vorwiderstand vor der Z-Diode (nur Schaltung Z-Diode). Er bestimmt den Gesamtstrom (U_ein minus U_Z) geteilt durch R_V. Ein zu kleiner Wert überlastet die Diode im Leerlauf, ein zu großer lässt bei Last den Z-Strom unter I_Z,min fallen.' },
    { key: 'r1', label: 'Widerstand R1 (LM317)', type: 'slider', scale: 'lin', min: 100, max: 1000, step: 1, unit: 'Ω', unitKind: 'res', value: 240, stufe: 'regel', group: G_R, visible: is317,
      help: 'Widerstand zwischen Ausgang und Adjust-Anschluss (nur LM317), Vorgabe 240 Ω wie in der Pool-Aufgabe. U_aus = U_ref · (1 + R2/R1) mit U_ref = 1,25 V; der Adjust-Strom wird vernachlässigt.' },
    { key: 'r2', label: 'Widerstand R2 (LM317)', type: 'slider', scale: 'lin', min: 0, max: 5000, step: 1, unit: 'Ω', unitKind: 'res', value: 970, stufe: 'regel', group: G_R, visible: is317,
      help: 'Widerstand zwischen Adjust-Anschluss und Masse (nur LM317). Ein größeres R2 erhöht die Ausgangsspannung. Mit R2 = 970 Ω und R1 = 240 Ω ergeben sich 6,302 V (Pool-Aufgabe).' },
    { key: 't2', label: 'Strombegrenzung (Transistor T2)', type: 'switch', value: false, stufe: 'regel', group: G_R, visible: isReg,
      help: 'Schaltet die Strombegrenzung mit Messwiderstand R3 zu (nur 7805 und LM317). Der Strom wird auf I_lim = U_BE / R3 begrenzt, mit U_BE = 0,7 V. Über I_lim sinkt die Ausgangsspannung.' },
    { key: 'r3', label: 'Messwiderstand R3', type: 'slider', scale: 'lin', min: 0.3, max: 3, step: 0.1, unit: 'Ω', unitKind: 'res', value: 0.6, stufe: 'regel', group: G_R, visible: isReg,
      help: 'Messwiderstand der Strombegrenzung. Ein größeres R3 begrenzt früher: I_lim = 0,7 V / R3. Mit 0,6 Ω ergeben sich 1,17 A (Pool-Aufgabe W2024-23). Wirkt nur bei eingeschalteter Strombegrenzung.' },
    { key: 'rlast', label: 'Lastwiderstand R_last', type: 'slider', scale: 'log', min: 10, max: 47000, step: 1, unit: 'Ω', unitKind: 'res', value: 4700, stufe: 'last', group: G_L, visible: isZ,
      help: 'Lastwiderstand am Ausgang der Z-Diode-Schaltung (nur Schaltung Z-Diode), Vorgabe 4,7 kΩ wie in der Pool-Aufgabe. Ein kleinerer Widerstand zieht mehr Laststrom und lässt weniger Strom durch die Diode.' },
    { key: 'iLast', label: 'Laststrom I', type: 'slider', scale: 'lin', min: 0, max: 1.5, step: 0.01, unit: 'A', unitKind: 'amp', value: 0.6, stufe: 'last', group: G_L, visible: isReg,
      help: 'Laststrom am Ausgang des Linearreglers (nur 7805 und LM317). Bei der Verlustleistung zählt der Strom mal die Spannungsdifferenz: (U_ein minus U_aus) mal I. Vorgabe 0,6 A bei 14 V wie in der Pool-Aufgabe.' },
    { key: 'kurz', label: 'Ausgang kurzgeschlossen (nur Modell)', type: 'switch', value: false, stufe: 'last', group: G_L, visible: isReg,
      help: 'Setzt im Modell den Ausgang des Linearreglers auf 0 V (nur 7805 und LM317). Ohne Strombegrenzung ist der Strom im Modell nicht begrenzt (Ampel rot), mit Strombegrenzung fließt I_lim und der Regler setzt U_ein mal I_lim in Wärme um. Reine Simulation.' },
    { key: 'fire', label: 'Last anlegen', type: 'button', stufe: null, group: G_L, help: 'Legt die Last im Modell an und meldet, was sich gegenüber dem Leerlauf ändert (nur Simulation).' }
  ];
  const METERS = [
    { key: 'uaus', label: 'Ausgangsspannung U_aus', unit: 'V', digits: 2, min: 0, max: 40, help: 'Ausgangsspannung aus dem Kern: Z-Diode klemmt auf U_Z, der 7805 liefert 5 V, der LM317 U_ref · (1 + R2/R1). Bei Dropout, nicht leitender Diode oder Strombegrenzung steht hier der gerechnete kleinere Wert.' },
    { key: 'iz', label: 'Z-Strom I_Z', unit: 'mA', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Strom durch die Z-Diode: Gesamtstrom minus Laststrom. 0 heißt: keine Z-Diode in der Schaltung oder die Diode leitet nicht.' },
    { key: 'iaus', label: 'Ausgangsstrom I_aus', unit: 'A', digits: 3, min: 0, max: 1.5, zeroIsNone: true, help: 'Strom, den die Last aufnimmt. Bei Strombegrenzung der Wert I_lim. 0 heißt: ohne Last oder Kurzschluss ohne Strombegrenzung (im Modell nicht begrenzt, nicht gerechnet).' },
    { key: 'pv', label: 'Verlustleistung P_V', unit: 'W', digits: 2, min: 0, max: 60, zeroIsNone: true, warnAbove: 1, help: 'Verlustleistung als Wärme: beim Linearregler (U_ein minus U_aus) mal I, bei der Z-Diode-Schaltung Vorwiderstand plus Z-Diode. Das Lab zeigt nur die Leistung, keine Temperatur (Kühlung im Thermik-Lab).' },
    { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 100, help: 'Verhältnis von abgegebener zu zugeführter Leistung. Beim Linearregler etwa U_aus / U_ein, bei der Z-Diode-Schaltung deutlich schlechter, weil der Vorwiderstand und die Diode dauernd Leistung aufnehmen.' },
    { key: 'modus', label: 'Betriebszustand (Code)', unit: '', digits: 0, min: 0, max: 2, texts: { 0: 'nicht stabilisierend (Dropout, Diode nicht aktiv oder Kurzschluss)', 1: 'im Regelbetrieb', 2: 'Strombegrenzung aktiv' },
      help: 'Code: 1 = im Regelbetrieb (Regler über dem Dropout, Z-Strom über I_Z,min), 0 = nicht stabilisierend (Dropout verletzt, Z-Strom unter I_Z,min, Diode sperrt oder Kurzschluss ohne Begrenzung), 2 = Strombegrenzung aktiv.' }
  ];
  const PRESETS = [
    { id: 'z-5v1', name: 'Z-Diode 5,1 V', info: 'Z-Diode 5,1 V aus 12 V mit 470 Ω Vorwiderstand und 4,7 kΩ Last: Z-Strom 13,60 mA (Pool-Aufgabe).', params: { art: 'zener', ue: 12, uz: 5.1, rv: 470, rlast: 4700 } },
    { id: '7805-14v', name: '7805 aus 14 V', info: '7805 aus 14 V bei 0,6 A: Verlustleistung 5,4 W (Pool-Aufgabe), Kühlung ist ein Thema.', params: { art: '7805', ue: 14, iLast: 0.6 } },
    { id: 'lm317-9v', name: 'LM317 auf 9 V', info: 'LM317 mit R1 240 Ω und R2 1488 Ω aus 14 V bei 0,3 A: Ausgang 9,0 V (Pool-Aufgabe).', params: { art: 'lm317', ue: 14, r1: 240, r2: 1488, iLast: 0.3 } },
    { id: 'kurzschluss-t2', name: 'Kurzschluss mit Strombegrenzung', info: 'Ausgang kurzgeschlossen, Strombegrenzung mit 0,6 Ω: Es fließt I_lim und der Regler setzt U_ein mal I_lim in Wärme um.', params: { art: '7805', ue: 12, iLast: 0.6, t2: true, r3: 0.6, kurz: true } }
  ];
  const PFAD = { quelle: 'Gleichspannung bis 40 V (Kleinspannung), zum Beispiel hinter Gleichrichter und Ladekondensator', wandlung: 'Linear: Z-Diode mit Vorwiderstand oder Linearregler setzt die Spannungsdifferenz in Wärme um', senke: 'Last mit konstanter Ausgangsspannung', art: 'linear' };

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);
    const rzName = { zener: 'Z-Diode', '7805': '7805', lm317: 'LM317' };
    /* gemeinsame Auswertung der Regler (7805, LM317) inkl. Strombegrenzung und Kurzschluss */
    function regler(ctl) {
      const base = ctl.art === 'lm317' ? CORE.lin.lm317({ R1: ctl.r1, R2: ctl.r2, Uein: ctl.ue, I: ctl.iLast }) : CORE.lin.fixed({ typ: '7805', Uein: ctl.ue, I: ctl.iLast });
      if (!base || !base.ok) return { ok: false, error: base && base.why || 'Eingabe' };
      const lim = ctl.t2 ? CORE.lin.limitT2({ R3: ctl.r3, Uein: ctl.ue }) : null;
      if (ctl.t2 && (!lim || !lim.ok)) return { ok: false, error: lim && lim.why || 'Eingabe' };
      const begrenzt = !!lim && (ctl.kurz || ctl.iLast > lim.Ilim + 1e-12);
      const e = { ok: true, base, lim, begrenzt, kurzFrei: !!ctl.kurz && !lim, betrieb: base.betrieb };
      if (e.kurzFrei) { Object.assign(e, { mode: 'kurz-frei', Uaus: 0, I: 0, PV: 0, Pab: 0, Pzu: 0, eta: 0 }); }
      else if (begrenzt) {
        const I = lim.Ilim, U = ctl.kurz ? 0 : base.UausIst * lim.Ilim / ctl.iLast;
        Object.assign(e, { mode: 'begrenzt', Uaus: U, I, PV: (ctl.ue - U) * I, Pab: U * I, Pzu: ctl.ue * I });
        e.eta = e.Pzu > 0 ? e.Pab / e.Pzu : 0;
      } else {
        Object.assign(e, { mode: base.betrieb ? 'betrieb' : 'dropout', Uaus: base.UausIst, I: ctl.iLast, PV: base.P_V, Pab: base.Pab, Pzu: base.Pzu, eta: isNum(base.eta) ? base.eta : 0 });
      }
      return e;
    }
    function compute(ctl) {
      if (ctl.art === 'zener') {
        const z = CORE.zener.stage({ Ue: ctl.ue, Uz: ctl.uz, Rv: ctl.rv, Rlast: ctl.rlast, Pmax: L('pz_max') });
        if (!z || !z.ok) return { ok: false, error: z && z.why || 'Eingabe' };
        const leer = CORE.zener.stage({ Ue: ctl.ue, Uz: ctl.uz, Rv: ctl.rv, Ilast: 0, Pmax: L('pz_max') });
        const rvmin = CORE.zener.rvMin({ Ue: ctl.ue, Uz: ctl.uz, Pmax: L('pz_max') });
        const reg = z.leitet && z.aktiv ? CORE.zener.regulation({ dUe: 1, Rv: ctl.rv }) : null;
        /* Bilanz: leitende Diode aus dem Kern; sperrt oder leitet die Diode nicht, arbeitet nur der Spannungsteiler aus R_V und R_last. */
        let pzu, pab, pr, pz;
        if (z.leitet) { pzu = ctl.ue * z.Iges; pab = z.Uz * z.Ilast; pr = z.Pr; pz = z.Pz; }
        else { const I = ctl.ue / (ctl.rv + ctl.rlast); pzu = ctl.ue * I; pab = z.Uaus * I; pr = I * I * ctl.rv; pz = 0; }
        const mode = z.leitet && z.aktiv && !z.ueberlast ? 'betrieb' : 'aus';
        return { ok: true, z, leer, rvmin, reg, pzu, pab, pr, pz, PV: pr + pz, eta: pzu > 0 ? pab / pzu : 0, Uaus: z.Uaus, mode, pmax: L('pz_max'), izmin: z.izmin,
          pvTherm: L('pv_therm'), kind: 'zener' };
      }
      const e = regler(ctl);
      if (!e.ok) return e;
      return Object.assign(e, { ok: true, kind: 'regler', pvTherm: L('pv_therm') });
    }
    function meters(r, ctl) {
      if (!r.ok) return { uaus: 0, iz: 0, iaus: 0, pv: 0, eta: 0, modus: 0 };
      if (r.kind === 'zener') {
        const iaus = r.z.leitet ? r.z.Ilast : r.Uaus / ctl.rlast;
        return { uaus: r.Uaus, iz: r.z.Iz * 1000, iaus, pv: r.PV, eta: r.eta * 100, modus: r.mode === 'betrieb' ? 1 : 0 };
      }
      return { uaus: r.Uaus, iz: 0, iaus: r.I, pv: r.PV, eta: r.eta * 100, modus: r.mode === 'betrieb' ? 1 : r.mode === 'begrenzt' ? 2 : 0 };
    }
    function bilanz(r) {
      if (!r.ok) return null;
      if (r.kind === 'zener') return { pzu: r.pzu, pab: r.pab, pv: [{ stufe: 'regel', w: r.PV }] };
      return { pzu: r.Pzu, pab: r.Pab, pv: [{ stufe: 'regel', w: r.PV }] };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'grau', text: 'Die Schaltung ist mit diesen Werten nicht rechenbar.' };
      const pvT = eng(r.pvTherm, 'W'), pvS = eng(r.PV, 'W');
      if (r.kind === 'zener') {
        const z = r.z;
        if (z.Ue <= z.Uz) return { ok: false, ampel: 'rot', text: 'U_ein = ' + eng(z.Ue, 'V') + ' liegt nicht über U_Z = ' + eng(z.Uz, 'V') + ': Die Z-Diode sperrt, am Ausgang liegt nur der Spannungsteiler (' + eng(z.Uaus, 'V') + ').' };
        if (!z.leitet || !z.aktiv) return { ok: false, ampel: 'rot', text: 'Z-Strom I_Z = ' + eng(Math.max(0, z.IzRoh), 'A') + ' liegt unter I_Z,min = ' + eng(z.izmin, 'A') + ' (Übungswert): Die Z-Diode stabilisiert nicht, die Ausgangsspannung bricht ein.', margin: z.izmin > 0 ? Math.max(0, z.IzRoh) / z.izmin : 0 };
        if (z.ueberlast) return { ok: false, ampel: 'rot', text: 'P_Z = ' + eng(z.Pz, 'W') + ' liegt über P_max = ' + eng(r.pmax, 'W') + ' (Übungswert, Datenblatt maßgeblich): Die Z-Diode ist überlastet.', margin: r.pmax / z.Pz };
        if (r.PV >= r.pvTherm - 1e-12) return { ok: false, ampel: 'gelb', text: 'P_V = ' + pvS + ' erreicht die Schwelle ' + pvT + ' (Übungswert): Die Schaltung wird warm, Kühlung ist ein Thema (Thermik-Lab).', margin: z.Iz / z.izmin };
        return { ok: true, ampel: 'gruen', text: 'I_Z = ' + eng(z.Iz, 'A') + ' liegt über I_Z,min = ' + eng(z.izmin, 'A') + ', P_Z = ' + eng(z.Pz, 'W') + ' unter P_max = ' + eng(r.pmax, 'W') + ' und P_V = ' + pvS + ' unter ' + pvT + ' (Übungswerte).', margin: z.Iz / z.izmin };
      }
      const b = r.base, nm = rzName[ctl.art];
      if (r.mode === 'kurz-frei') return { ok: false, ampel: 'rot', text: 'Ausgang kurzgeschlossen ohne Strombegrenzung: Der Strom ist im Modell nicht begrenzt und wird nicht gerechnet. Ein Linearregler setzt dann U_ein mal I in Wärme um (Strombegrenzung T2 zuschalten).' };
      if (r.mode === 'dropout') return { ok: false, ampel: 'rot', text: nm + ' im Dropout: U_ein = ' + eng(ctl.ue, 'V') + ' liegt unter der Mindest-Eingangsspannung ' + eng(b.UeinMin, 'V') + ' (Übungswert, Datenblatt maßgeblich). Die Ausgangsspannung folgt dem Eingang nach unten.', margin: b.UeinMin > 0 ? ctl.ue / b.UeinMin : 0 };
      const margin = b.UeinMin > 0 ? ctl.ue / b.UeinMin : undefined;
      if (r.mode === 'begrenzt') return { ok: false, ampel: 'gelb', text: 'Strombegrenzung aktiv: I_lim = ' + eng(r.lim.Ilim, 'A') + ' (' + eng(r.lim.Ube, 'V') + ' / R3), U_aus fällt auf ' + eng(r.Uaus, 'V') + ', P_V = ' + pvS + (r.PV >= r.pvTherm - 1e-12 ? ' (Schwelle ' + pvT + ' erreicht, Kühlung ist ein Thema).' : '.'), margin };
      if (r.PV >= r.pvTherm - 1e-12) return { ok: false, ampel: 'gelb', text: nm + ' im Betrieb, aber P_V = ' + pvS + ' erreicht die Schwelle ' + pvT + ' (Übungswert): Kühlung ist ein Thema (Thermik-Lab).', margin };
      if (ctl.art === 'lm317' && b.minlastOk === false) return { ok: false, ampel: 'gelb', text: 'Laststrom ' + eng(ctl.iLast, 'A') + ' liegt unter der Mindestlast ' + eng(b.imin, 'A') + ' (Übungswert): Die Ausgangsspannung ist nicht gesichert.', margin };
      return { ok: true, ampel: 'gruen', text: nm + ' im Regelbetrieb: U_ein = ' + eng(ctl.ue, 'V') + ' liegt über ' + eng(b.UeinMin, 'V') + ' (Übungswert) und P_V = ' + pvS + ' unter ' + pvT + '.', margin };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) return out;
      out.push({ id: 'stabil-linear', kind: 'info', text: 'Der Linearregler und die Z-Diode-Schaltung wandeln die Spannungsdifferenz in Wärme um; das Lab zeigt nur die Verlustleistung, keine Temperatur.' });
      if (r.kind === 'zener') {
        const z = r.z;
        (z.diag || []).forEach(d => { if (d.id !== 'modellgrenze') out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }); });
        if (isNum(r.rvmin) && ctl.rv < r.rvmin - 1e-9) out.push({ id: 'rv-zu-klein', kind: 'warn', text: B.msg(CORE, 'rv-zu-klein', { rv: eng(ctl.rv, 'Ω'), rvmin: eng(r.rvmin, 'Ω'), pmax: eng(r.pmax, 'W'), pz: eng(r.leer.Pz, 'W') },
          'Im Leerlauf nähme die Z-Diode {pz} auf, mehr als P_max = {pmax} (Übungswert). Der Vorwiderstand müsste mindestens {rvmin} haben, eingestellt sind {rv}.') });
        if (r.reg) out.push({ id: 'z-regelung', kind: 'info', text: 'Ändert sich U_ein um 1 V, ändert sich U_aus nur um ' + eng(r.reg.dUa, 'V') + ' (Lehrmodell mit r_z = ' + eng(r.reg.rz, 'Ω') + ', Übungswert).' });
        return out;
      }
      const b = r.base;
      (b.diag || []).forEach(d => { if (d.id !== 'therm' && d.id !== 'modellgrenze' && d.id !== 'regler-ok') out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }); });
      if (r.mode === 'betrieb' || r.mode === 'begrenzt') out.push({ id: 'regler-ok', kind: 'info', text: (b.diag.find(d => d.id === 'regler-ok') || {}).text || ('Der Eingang liegt über der Mindest-Eingangsspannung (' + eng(b.UeinMin, 'V') + ').') });
      if (r.PV >= r.pvTherm - 1e-12) out.push({ id: 'regler-heiss', kind: 'warn', link: 'thmlab.html', text: B.msg(CORE, 'therm', { p: eng(r.PV, 'W') }, 'Verlustleistung {p}: Kühlung und Sperrschichttemperatur rechnest du im Thermik-Lab, nicht hier.') });
      if (r.begrenzt) out.push({ id: 'strombegrenzung', kind: 'info', text: 'Die Strombegrenzung greift bei I_lim = ' + eng(r.lim.Ilim, 'A') + ' (U_BE / R3); die Last würde ' + eng(ctl.iLast, 'A') + ' ziehen. Im Kurzschluss setzt der Regler U_ein mal I_lim = ' + eng(r.lim.PvKurz, 'W') + ' um.' });
      if (r.mode === 'kurz-frei') out.push({ id: 'kurz-frei', kind: 'error', text: 'Kurzschluss ohne Strombegrenzung: Der Strom ist im Modell nicht begrenzt (nicht gerechnet).' });
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const A = [], B2 = [], ueMax = 40;
      const pt = (arr, x, y) => { if (isNum(x) && isNum(y)) arr.push([x, y]); };
      if (r.kind === 'zener') {
        const I2 = [];
        for (let k = 0; k <= 70; k++) {
          const ue = 5 + 35 * k / 70, q = CORE.zener.stage({ Ue: ue, Uz: ctl.uz, Rv: ctl.rv, Rlast: ctl.rlast });
          if (q && q.ok) { pt(A, ue, q.Uaus); pt(I2, ue, q.Iz * 1000); }
        }
        return [{ id: 'z-uaus-ue', title: 'Ausgangsspannung über der Eingangsspannung (Z-Diode)', xLabel: 'Eingangsspannung U_ein', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_aus', yUnit: 'V',
          series: [{ name: 'U_aus', points: A }], marker: { x: ctl.ue, y: r.Uaus, label: 'jetzt ' + eng(r.Uaus, 'V') } },
        { id: 'z-iz-ue', title: 'Z-Strom über der Eingangsspannung', xLabel: 'Eingangsspannung U_ein', xUnit: 'V', xScale: 'lin', yLabel: 'Z-Strom I_Z', yUnit: 'mA',
          series: [{ name: 'I_Z', points: I2 }], marker: { x: ctl.ue, y: r.z.Iz * 1000, label: 'jetzt ' + eng(r.z.Iz, 'A') }, limit: { y: r.izmin * 1000, label: 'I_Z,min (Übungswert)' } }];
      }
      for (let k = 0; k <= 70; k++) {
        const ue = 5 + (ueMax - 5) * k / 70, q = ctl.art === 'lm317' ? CORE.lin.lm317({ R1: ctl.r1, R2: ctl.r2, Uein: ue, I: ctl.iLast }) : CORE.lin.fixed({ typ: '7805', Uein: ue, I: ctl.iLast });
        if (q && q.ok) pt(A, ue, q.UausIst);
      }
      for (let k = 0; k <= 60; k++) {
        const i = 1.5 * k / 60, q = ctl.art === 'lm317' ? CORE.lin.lm317({ R1: ctl.r1, R2: ctl.r2, Uein: ctl.ue, I: i }) : CORE.lin.fixed({ typ: '7805', Uein: ctl.ue, I: i });
        if (q && q.ok) pt(B2, i, q.P_V);
      }
      return [{ id: 'reg-uaus-ue', title: 'Ausgangsspannung über der Eingangsspannung (Dropout-Knick)', xLabel: 'Eingangsspannung U_ein', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_aus', yUnit: 'V',
        series: [{ name: 'U_aus', points: A }], marker: { x: ctl.ue, y: r.base.UausIst, label: 'jetzt ' + eng(r.base.UausIst, 'V') } },
      { id: 'reg-pv-i', title: 'Verlustleistung über dem Laststrom', xLabel: 'Laststrom I', xUnit: 'A', xScale: 'lin', yLabel: 'Verlustleistung P_V', yUnit: 'W',
        series: [{ name: 'P_V = (U_ein − U_aus) · I', points: B2 }], marker: ctl.iLast > 0 ? { x: ctl.iLast, y: r.base.P_V, label: 'jetzt ' + eng(r.base.P_V, 'W') } : undefined, limit: { y: r.pvTherm, label: 'Kühlungshinweis ab ' + eng(r.pvTherm, 'W') + ' (Übungswert)' } }];
    }
    function state(r, ctl) {
      if (!r.ok) return { modusText: '' };
      const m = meters(r, ctl).modus, t = (METERS[5].texts || {})[m] || '';
      return { modusText: t, thermLink: r.PV >= r.pvTherm - 1e-12 ? 'thmlab.html' : '' };
    }
    function fire(r, ctl) {
      if (!r.ok) { P0.say('Last anlegen nicht möglich: ' + (r.error || 'Eingabe prüfen') + '.', 'warn'); return false; }
      if (r.kind === 'zener') {
        P0.say('Last angelegt: Ohne Last fließen ' + eng(r.leer.Iz, 'A') + ' durch die Z-Diode (P_Z = ' + eng(r.leer.Pz, 'W') + '), mit Last noch ' + eng(r.z.Iz, 'A') + ' (P_Z = ' + eng(r.z.Pz, 'W') + '); U_aus = ' + eng(r.Uaus, 'V') + '.', r.mode === 'betrieb' ? 'info' : 'warn');
        return true;
      }
      if (r.mode === 'kurz-frei') { P0.say('Kurzschluss ohne Strombegrenzung: Der Strom ist im Modell nicht begrenzt und wird nicht gerechnet.', 'warn'); return true; }
      P0.say('Last angelegt: I = ' + eng(r.I, 'A') + ', U_aus = ' + eng(r.Uaus, 'V') + ', P_V = ' + eng(r.PV, 'W') + (r.mode === 'begrenzt' ? ' (Strombegrenzung aktiv)' : r.mode === 'dropout' ? ' (Regler im Dropout)' : '') + '.', r.mode === 'betrieb' ? 'info' : 'warn');
      return true;
    }
    /* --- Zeichnen --- */
    function rows(ctx, rc, list, sc) {
      const pal = sc.pal, fs = sc.fs, rowH = Math.max(fs + 12, Math.min(34, rc.h / Math.max(1, list.length)));
      list.forEach((q, i) => {
        const y = rc.y + 4 + i * rowH;
        if (y + rowH > rc.y + rc.h + 1) return;
        B.gfx.text(ctx, q.label, rc.x + 4, y + fs, { size: fs, color: pal.mute, max: rc.w * 0.3 });
        B.gfx.bar(ctx, rc.x + rc.w * 0.32, y + 2, rc.w * 0.4, fs + 2, q.v, q.max, q.col, pal);
        B.gfx.text(ctx, q.text, rc.x + rc.w * 0.74, y + fs, { size: fs, color: pal.fg, max: rc.w * 0.26 - 4 });
      });
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal, ctl = view.ctl;
      if (!rc || rc.w < 140 || rc.h < 100 || !r.ok) return;
      const wide = rc.w >= 640, gap = 8;
      let a, s, b;
      if (wide) {
        const th = Math.floor(rc.h * 0.58) - gap / 2;
        a = { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.5) - gap, h: th };
        s = { x: a.x + a.w + gap, y: rc.y, w: rc.w - a.w - gap, h: th };
        b = { x: rc.x, y: rc.y + th + gap, w: rc.w, h: rc.h - th - gap };
      } else {
        const h1 = Math.floor(rc.h * 0.36), h2 = Math.floor(rc.h * 0.26);
        a = { x: rc.x, y: rc.y, w: rc.w, h: h1 - gap };
        s = { x: rc.x, y: rc.y + h1, w: rc.w, h: h2 - gap };
        b = { x: rc.x, y: rc.y + h1 + h2, w: rc.w, h: rc.h - h1 - h2 };
      }
      const opts2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false }, D = sc.D;
      let ok = false;
      if (r.kind === 'zener') {
        if (D && D.zenerChart) ok = !!D.zenerChart(ctx, a, { uz: ctl.uz, rz: r.z.rz, iz: r.z.Iz, izMin: r.izmin, izMax: r.pmax / ctl.uz }, opts2);
        if (!ok) B.gfx.text(ctx, 'Z-Diode ' + eng(ctl.uz, 'V') + ' · I_Z ' + eng(r.z.Iz, 'A'), a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
        rows(ctx, s, [
          { label: 'I_ges', v: r.z.Iges, max: Math.max(r.z.Iges, 1e-9), col: pal.in, text: eng(r.z.Iges, 'A') },
          { label: 'I_Z', v: r.z.Iz, max: Math.max(r.z.Iges, 1e-9), col: pal.sw, text: eng(r.z.Iz, 'A') },
          { label: 'I_last', v: r.z.Ilast, max: Math.max(r.z.Iges, 1e-9), col: pal.out, text: eng(r.z.Ilast, 'A') },
          { label: 'P_Z', v: r.z.Pz, max: r.pmax, col: pal.loss, text: eng(r.z.Pz, 'W') + ' von ' + eng(r.pmax, 'W') }
        ], sc);
      } else {
        const e = r;
        if (D && D.linearReg) ok = !!D.linearReg(ctx, a, { uIn: ctl.ue, uOut: e.Uaus, i: e.I, pV: e.PV, eta: e.eta, name: rzName[ctl.art], dropout: e.mode === 'dropout' || e.mode === 'betrieb' ? e.base.dropout : undefined, cool: e.PV >= r.pvTherm - 1e-12 }, opts2);
        if (!ok) B.gfx.text(ctx, rzName[ctl.art] + ' · U_aus ' + eng(e.Uaus, 'V') + ' · P_V ' + eng(e.PV, 'W'), a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
        rows(ctx, s, [
          { label: 'U_ein', v: ctl.ue, max: 40, col: pal.in, text: eng(ctl.ue, 'V') },
          { label: 'U_min', v: e.base.UeinMin, max: 40, col: pal.mute, text: eng(e.base.UeinMin, 'V') },
          { label: 'U_aus', v: e.Uaus, max: 40, col: pal.out, text: eng(e.Uaus, 'V') },
          { label: 'P_V', v: e.PV, max: Math.max(r.pvTherm * 2, e.PV), col: pal.loss, text: eng(e.PV, 'W') }
        ], sc);
      }
      sc.block(b);
    }
    return { compute, meters, bilanz, assess, diag, curves, state, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'stabil', name: 'Z-Diode und Linearregler', icon: '⚓', info: 'Z-Diode mit Vorwiderstand, 7805 und LM317: Ausgangsspannung, Z-Strom, Verlustleistung und Wirkungsgrad.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'stabil', name: 'Z-Diode und Linearregler', icon: '⚓', info: 'Z-Diode und Linearregler', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
