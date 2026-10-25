/* anarig-opvinv.js - ANA-Lab (WP2c): Pruefstand 5 `opv_inv` - Invertierender Verstaerker und Summierer (SPEC 5.5).
 * Die gemeinsame Huelle liegt in anarig-base.js: Diese Datei im Browser NACH anarig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (ANA_CORE.op.inv / sum / freq / wave / fpb, ANA_CORE.limit); hier steht keine zweite Verstaerkerformel.
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteil- und OPV-Werte sind Uebungswerte (F9).
 * Modell: Operationsverstaerker ideal (Standard) oder real mit einem Pol (langsam, schnell), Offsetspannung nur als Spannung, keine Eingangsstroeme; die Last aendert U_a nicht
 *   (der Ausgang ist eine Spannungsquelle mit kleinem r_aus), sie bestimmt nur den Ausgangsstrom I_a (Anzeige, F21).
 * Schaltungen: invertierer (V_u = -R_f / R_1) und summierer (U_a = -R_f * Summe(U_k / R_k), drei Eingaenge; alle Eingaenge sind Gleichspannungen, `form` und `f` wirken nur beim Invertierer).
 *   V_u des Summierers = Verstaerkung von Eingang 1 (-R_f / R_1, real mit Verstaerkungsfehler); Vorgabe zielV = Betrag davon.
 * Fehlerfaelle (nur Simulation), Umsetzung VOR dem Kernaufruf: rf offen -> R_f = R_OFFEN (keine Gegenkopplung, Komparatorverhalten), r1 offen -> R_1 = R_OFFEN (beim Summierer Eingang 1),
 *   rf kurz -> R_f = R_KURZ, versorgung minus fehlt -> uvn = 0, versorgung fehlt -> uv = 0 und uvn = 0; ausgang defekt: Lehrmodell, der Ausgang haengt an +U_sat (unabhaengig vom Eingang).
 * Steuerwerte (SI): schaltung, opv, uv (V), form, ue (V; Gleichwert bzw. Amplitude), f (Hz), r1, rf (Ohm), ue2, ue3 (V), r2, r3 (Ohm), rl (Ohm, 1 MOhm = Leerlauf), fehler,
 *   zielV (Betrag von V_u, 0 = keine), Taste fire (Frequenzdurchlauf 10 Hz bis 10 MHz).
 * Messgeraete: v, vId, ua, uaPeak, ri (Ohm), ra (Ohm), fg (Hz; ideal: unbegrenzt), usat, sat (0 nein, 1 ja), uosOut (mV).
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
  if (!B) { if (typeof console !== 'undefined') console.warn('anarig-opvinv.js: Die Basis anarig-base.js fehlt (bitte davor laden).'); return; }
  const { fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const MODELL = 'Modell: Operationsverstärker ideal (Standard) oder real mit einem Pol (langsam, schnell; Übungswerte, F9); Offsetspannung nur als Spannung, keine Eingangsströme, Last ändert U_a nicht. ' + (T0.opvModell || '') + ' ' + (T0.gegenkopplung || '');
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const OFFEN = (C0 && C0.R_OFFEN) || 1e12, KURZ = (C0 && C0.R_KURZ) || 1e-3;
  const SWEEP_S = 6;                                      // Dauer des Frequenzdurchlaufs (s, Zeitlupe verlaengert)
  const MINUS = '−';
  const N_WAVE = 256, N_CURVE = 40;

  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const when = (key, vals) => ({ visible: st => !st || vals.indexOf(st[key]) >= 0 });
  const FEHLER = [['keiner', 'kein Fehler'], ['rf offen', 'R_f offen'], ['r1 offen', 'R_1 offen'], ['rf kurz', 'R_f kurzgeschlossen'], ['versorgung minus fehlt', 'negative Versorgung fehlt'], ['versorgung fehlt', 'Versorgung fehlt'], ['ausgang defekt', 'Ausgang defekt']];
  const OPVS = [['ideal', 'ideal'], ['langsam', 'real, langsam'], ['schnell', 'real, schnell']];
  const FORMEN = [['gleich', 'Gleichspannung'], ['sinus', 'Sinus'], ['rechteck', 'Rechteck'], ['dreieck', 'Dreieck']];
  const CONTROLS = B.fillControls([
    { key: 'schaltung', label: 'Schaltung', type: 'select', value: 'invertierer', options: opt([['invertierer', 'Invertierer'], ['summierer', 'Summierer']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Wählt die Schaltung: Der Invertierer verstärkt mit V_u = −R_f / R_1 und dreht die Phase um 180°; der Summierer addiert drei Eingangsspannungen gewichtet mit U_a = −R_f · Σ(U_k / R_k).' },
    { key: 'opv', label: 'Operationsverstärker', type: 'select', value: 'ideal', options: opt(OPVS), gruppe: 'ziel', sicht: 'formel',
      help: 'Wählt das Lehrmodell: ideal (kein Frequenzgang, Aussteuergrenze gleich der Betriebsspannung) oder real mit Verstärkungs-Bandbreite-Produkt, Slew-Rate, Offsetspannung und Aussteuergrenze unter der Betriebsspannung (Übungswerte, F9).' },
    { key: 'uv', label: 'Betriebsspannung (±)', type: 'slider', scale: 'lin', min: 5, max: 18, step: 0.5, unit: 'V', unitKind: 'V', value: 12, gruppe: 'quelle', sicht: 'formel',
      help: 'Betrag der symmetrischen Betriebsspannung ±U_v (Kleinspannung, Übungswert F10). Der Ausgang kann nie über diese Spannung hinaus steuern; real bleibt er noch etwas darunter.' },
    { key: 'form', label: 'Eingangsform', type: 'select', value: 'sinus', options: opt(FORMEN), gruppe: 'quelle', sicht: 'signal', ...when('schaltung', ['invertierer']),
      help: 'Form der Eingangsspannung für das Zeitbild: Gleichspannung, Sinus, Rechteck oder Dreieck. Beim Summierer sind alle Eingänge Gleichspannungen.' },
    { key: 'ue', label: 'Eingangsspannung (Gleichwert bzw. Amplitude)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 0.5, gruppe: 'quelle', sicht: 'signal',
      help: 'Eingangsspannung: bei Gleichspannung der Wert, sonst die Amplitude (Spitzenwert). Beim Summierer ist es die Spannung U_1 an R_1. Über U_sat / |V_u| läuft der Ausgang in die Sättigung.' },
    { key: 'f', label: 'Frequenz', type: 'slider', scale: 'log', min: 1, max: 1e6, step: 1, unit: 'Hz', unitKind: 'Hz', value: 1000, gruppe: 'quelle', sicht: 'signal', ...when('schaltung', ['invertierer']),
      help: 'Frequenz der Eingangsspannung. Der ideale Operationsverstärker hat keinen Frequenzgang; der reale verstärkt ab der Grenzfrequenz f_g weniger und ist durch die Slew-Rate bei großer Amplitude begrenzt.' },
    { key: 'r1', label: 'Eingangswiderstand R1', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'bauteile', sicht: 'formel',
      help: 'Eingangswiderstand R_1. Der −Eingang liegt auf virtuellem Nullpunkt, deshalb ist r_ein = R_1. Ein kleineres R_1 vergrößert |V_u| = R_f / R_1. Übungswert.' },
    { key: 'rf', label: 'Rückkopplungswiderstand Rf', type: 'slider', scale: 'log', min: 100, max: 1e7, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel',
      help: 'Rückkopplungswiderstand R_f vom Ausgang zum −Eingang. Ein größeres R_f vergrößert |V_u| = R_f / R_1. Ohne R_f (offen) fehlt die Gegenkopplung. Übungswert.' },
    { key: 'ue2', label: 'Eingang 2 (Gleichwert)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 0, gruppe: 'quelle', sicht: 'formel', ...when('schaltung', ['summierer']),
      help: 'Gleichspannung U_2 am zweiten Eingang des Summierers, über R_2 an den −Eingang. 0 V heißt: R_2 liegt an Masse und trägt zur Summe nichts bei.' },
    { key: 'r2', label: 'Eingangswiderstand R2', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 22000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['summierer']),
      help: 'Widerstand R_2 des zweiten Eingangs des Summierers. Sein Beitrag zur Summe ist U_2 / R_2; ein kleineres R_2 gibt dem Eingang mehr Gewicht.' },
    { key: 'ue3', label: 'Eingang 3 (Gleichwert)', type: 'slider', scale: 'lin', min: -10, max: 10, step: 0.01, unit: 'V', unitKind: 'V', value: 0, gruppe: 'quelle', sicht: 'formel', ...when('schaltung', ['summierer']),
      help: 'Gleichspannung U_3 am dritten Eingang des Summierers, über R_3 an den −Eingang. 0 V heißt: R_3 liegt an Masse.' },
    { key: 'r3', label: 'Eingangswiderstand R3', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 47000, gruppe: 'bauteile', sicht: 'formel', ...when('schaltung', ['summierer']),
      help: 'Widerstand R_3 des dritten Eingangs des Summierers. Sein Beitrag zur Summe ist U_3 / R_3.' },
    { key: 'rl', label: 'Lastwiderstand (oberer Anschlag = Leerlauf)', type: 'slider', scale: 'log', min: 100, max: 1e6, step: 10, unit: 'Ω', unitKind: 'Ω', value: 10000, gruppe: 'last', sicht: 'formel',
      help: 'Lastwiderstand R_L am Ausgang. Im Lehrmodell ändert er U_a nicht (kleiner Ausgangswiderstand); er bestimmt den Ausgangsstrom I_a = U_a / R_L. Am oberen Anschlag (1 MΩ) gilt der Ausgang als unbelastet (Leerlauf). Übungswert, F21.' },
    { key: 'fehler', label: 'Fehlerfall', type: 'select', value: 'keiner', options: opt(FEHLER), gruppe: 'fehler', sicht: 'formel',
      help: 'Fehlerfall der Simulation (nur Übung, kein Hinweis zum Reparieren): R_f oder R_1 offen, R_f kurzgeschlossen, negative oder ganze Versorgung fehlt, Ausgang defekt. Der Kern rechnet das Ergebnis physikalisch richtig; bei der Fehlersuche ist das Feld gesperrt und verdeckt.' },
    { key: 'zielV', label: 'Vorgabe Betrag von V_u (0 = keine)', type: 'slider', scale: 'lin', min: 0, max: 1000, step: 0.1, unit: '', unitKind: '', value: 0, gruppe: 'ziel', sicht: 'formel',
      help: 'Vorgabe für den Betrag der Spannungsverstärkung |V_u|; bei 0 ist keine Vorgabe gesetzt und die Ampel bleibt grau. Treffer innerhalb des Fensters (Lehrfaustwert, Übungswert F16), der Ausgang darf nicht begrenzt sein.' },
    { key: 'fire', label: 'Frequenzdurchlauf', type: 'button', gruppe: 'ziel', sicht: 'signal',
      help: 'Startet den Frequenzdurchlauf: f läuft von 10 Hz bis 10 MHz. Beim realen Operationsverstärker fällt die Verstärkung ab f_g, Phase und Slew-Rate werden sichtbar; der ideale hat keinen Frequenzgang. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'v', label: 'Spannungsverstärkung V_u', unit: '', digits: 3, min: -1000, max: 1000, help: 'Spannungsverstärkung mit Vorzeichen (negativ: Phase um 180° gedreht), real mit Verstärkungsfehler; beim Summierer die Verstärkung von Eingang 1.' },
    { key: 'vId', label: 'Ideale Verstärkung', unit: '', digits: 3, min: -1000, max: 1000, help: 'Verstärkung des idealen Operationsverstärkers: V_u = −R_f / R_1 (beim Summierer für Eingang 1).' },
    { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V', digits: 3, min: -20, max: 20, help: 'Ausgangsspannung (bei Wechselgrößen der Spitzenwert), auf die Aussteuergrenzen begrenzt.' },
    { key: 'uaPeak', label: 'Spitzenwert U_a (Zeitbild)', unit: 'V', digits: 3, min: 0, max: 20, help: 'Größter Betrag der Ausgangsspannung im Zeitbild; real mit Frequenzgang, Slew-Rate und Begrenzen.' },
    { key: 'ri', label: 'Eingangswiderstand r_ein', unit: 'Ω', digits: 1, min: 0, max: 1e6, infAbove: 1e11, help: 'Eingangswiderstand der Schaltung: wegen des virtuellen Nullpunkts am −Eingang gleich R_1 (beim Summierer R_1 für Eingang 1).' },
    { key: 'ra', label: 'Ausgangswiderstand r_aus', unit: 'Ω', digits: 4, min: 0, max: 100, help: 'Ausgangswiderstand der gegengekoppelten Schaltung: beim idealen Operationsverstärker 0, real R_o / (1 + A_0 · β), sehr klein.' },
    { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz', digits: 0, min: 0, max: 1e7, infAbove: 1e11, infText: 'unbegrenzt', help: 'Grenzfrequenz der Schaltung (−3 dB) beim realen Operationsverstärker; beim idealen ist der Frequenzgang unbegrenzt (Anzeige ∞).' },
    { key: 'usat', label: 'Aussteuergrenze U_sat', unit: 'V', digits: 2, min: 0, max: 20, help: 'Größte positive Ausgangsspannung: ideal gleich der Betriebsspannung, real 1,5 V darunter (Übungswert, F9).' },
    { key: 'sat', label: 'Begrenzen', unit: '', digits: 0, min: 0, max: 1, texts: ['nein', 'ja'], help: 'Ja, wenn der Ausgang an der Aussteuergrenze liegt: Die lineare Verstärkung gilt dann nicht mehr.' },
    { key: 'uosOut', label: 'Offsetspannung am Ausgang U_a,off', unit: 'mV', digits: 2, min: 0, max: 5000, help: 'Ausgangsfehler durch die Offsetspannung des realen Operationsverstärkers bei U_e = 0: U_os · V_n mit V_n = 1 + R_f / R_1. Ideal 0.' }
  ];
  const SICHT = { kennlinie: 'Übertragungskennlinie U_a(U_e) mit Aussteuergrenzen', signal: 'Eingang und Ausgang über der Zeit (Phase 180°)', formel: 'V_u = −R_f / R_1' };
  const INFO = 'Invertierender Verstärker mit virtuellem Nullpunkt am −Eingang und Summierer mit drei Eingängen; ideal oder real (Frequenzgang, Slew-Rate, Aussteuergrenze, Offset). ' + MODELL;

  const PRESETS = [
    { id: 'v-10', name: 'Verstärkung −10 (Pool F2025-17)', info: 'Übungsschaltung (Pool F2025-17): ' + K(c => { const q = c.op.inv({ r1: 4700, rf: 47000, ue: 0.5 }); return 'Mit R_1 = 4,7 kΩ und R_f = 47 kΩ ist V_u = ' + val(q.v, '', 3) + ', bei U_e = ' + val(0.5, 'V', 1) + ' ist U_a = ' + val(q.ua, 'V', 2) + '.'; }),
      controls: { schaltung: 'invertierer', r1: 4700, rf: 47000, form: 'sinus', ue: 0.5 } },
    { id: 'summierer', name: 'Summierer (Pool W2025-11)', info: 'Übungsschaltung (Pool W2025-11): ' + K(c => { const q = c.op.sum({ rf: 47000, r: [10000, 22000, 47000], u: [0.5, 1.1, 0] }); return 'Mit R_f = 47 kΩ, U_1 = 0,5 V an 10 kΩ und U_2 = 1,1 V an 22 kΩ ist U_a = ' + val(q.ua, 'V', 2) + '.'; }),
      controls: { schaltung: 'summierer', form: 'gleich', ue: 0.5, r1: 10000, rf: 47000, ue2: 1.1, r2: 22000 } },
    { id: 'saettigung', name: 'Sättigung (Stil H2024-13)', info: 'Übungsschaltung: ' + K(c => { const q = c.op.inv({ r1: 10000, rf: 100000, ue: 2 }); return 'Mit V_u = ' + val(q.v, '', 2) + ' wäre U_a,lin = ' + val(q.ualin, 'V', 1) + ', der Ausgang bleibt bei ' + val(q.ua, 'V', 1) + ' (Aussteuergrenze). Größte Eingangsspannung ohne Begrenzen: ' + val(q.ueMax, 'V', 2) + '.'; }),
      controls: { schaltung: 'invertierer', form: 'gleich', ue: 2, r1: 10000, rf: 100000 } },
    { id: 'real-schnell', name: 'Realer schneller Operationsverstärker', info: 'Übungsschaltung: ' + K(c => { const q = c.op.inv({ r1: 1000, rf: 100000, ue: 0.01, f: 20000, opv: 'schnell' }); return 'Mit V_u ≈ ' + val(q.v, '', 2) + ' ist die Grenzfrequenz f_g = ' + eng(q.fg, 'Hz') + '; bei 20 kHz ist der Betrag nur noch ' + val(q.hf, '', 2) + '.'; }),
      controls: { schaltung: 'invertierer', opv: 'schnell', r1: 1000, rf: 100000, f: 20000, ue: 0.01 } },
    { id: 'rf-offen', name: 'Fehlerbild: R_f offen', info: 'Fehlerbild der Simulation: Ohne R_f fehlt die Gegenkopplung, der Operationsverstärker arbeitet als Komparator und läuft in die Sättigung. ' + (T0.gegenkopplung || ''),
      controls: { fehler: 'rf offen' } }
  ];

  const FN = { 'rf offen': 'R_f ist offen', 'r1 offen': 'R_1 ist offen', 'rf kurz': 'R_f ist kurzgeschlossen', 'versorgung minus fehlt': 'Die negative Versorgung fehlt', 'versorgung fehlt': 'Die Versorgung fehlt', 'ausgang defekt': 'Der Ausgang ist defekt' };

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 0 };
    const lim = (id, d) => { try { const l = CORE.limit(id); return l && isNum(l.value) ? l.value : d; } catch (e) { return d; } };
    const srOf = opv => (opv === 'langsam' ? lim('sr_langsam', 5e5) : opv === 'schnell' ? lim('sr_schnell', 1.3e7) : NaN);
    const fEffOf = ctl => (sw.active ? 10 * Math.pow(1e6, sw.p) : ctl.f);

    /* Fehlerfall -> Eingaben des Kerns (VOR dem Kernaufruf) */
    function inputs(ctl) {
      const f = ctl.fehler, o = { r1: ctl.r1, rf: ctl.rf, r2: ctl.r2, r3: ctl.r3, uv: ctl.uv, uvn: ctl.uv };
      if (f === 'rf offen') o.rf = OFFEN;
      else if (f === 'r1 offen') o.r1 = OFFEN;
      else if (f === 'rf kurz') o.rf = KURZ;
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
      const sum = ctl.schaltung === 'summierer', fe = ctl.fehler, fEff = fEffOf(ctl), inp = inputs(ctl);
      const base = { opv: ctl.opv, uv: inp.uv, uvn: inp.uvn };
      let q, id, wave = null, fr = null, open = null, hf = NaN, phiF = NaN, vn;
      if (!sum) {
        const cfg = Object.assign({ r1: inp.r1, rf: inp.rf, ue: ctl.ue, f: fEff }, base);
        q = CORE.op.inv(cfg);
        if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Die Eingabe ist ungültig.' };
        id = CORE.op.inv(Object.assign({}, cfg, { opv: 'ideal' }));
        wave = CORE.op.wave(Object.assign({ art: 'inv', r1: inp.r1, rf: inp.rf, ue: ctl.ue, f: fEff, form: ctl.form }, base), N_WAVE);
        hf = q.hf; phiF = q.phiF; vn = q.vn;
      } else {
        const cfg = Object.assign({ rf: inp.rf, r: [inp.r1, inp.r2, inp.r3], u: [ctl.ue, ctl.ue2, ctl.ue3] }, base);
        q = CORE.op.sum(cfg);
        if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Die Eingabe ist ungültig.' };
        id = CORE.op.sum(Object.assign({}, cfg, { opv: 'ideal' }));
        vn = q.vn;
      }
      const ideal = ctl.opv === 'ideal';
      if (!ideal) {   // Frequenzgang: Summierer als Ersatz-Invertierer mit gleichem V_n (R_ers = Parallelschaltung der Eingangswiderstaende)
        const rEq = sum ? 1 / (1 / inp.r1 + 1 / inp.r2 + 1 / inp.r3) : inp.r1;
        const fl = CORE.grid(1000, 57, 3, 4), c = Object.assign({ art: 'inv', r1: rEq, rf: inp.rf }, base);
        fr = CORE.op.freq(c, fl); open = CORE.op.freq(Object.assign({}, c, { art: 'offen' }), fl);
        const at = CORE.op.freq(c, [Math.max(1, Math.min(1e7, fEff))]);
        if (fr && fr.ok !== false && open && open.ok !== false && at && at.ok !== false) fr = Object.assign({}, fr, { open: open.a, openFg: open.fg, aAt: at.a[0], fAt: at.f[0] }); else fr = null;
      }
      // Ergebnis ableiten (Messwerte der Schaltung, Defekt als Ueberschreibung des Ausgangs)
      const defekt = fe === 'ausgang defekt';
      const w = wave && wave.ok !== false ? wave : null;
      const v0 = sum ? q.vk[0] : q.v, vId = sum ? id.vk[0] : id.vId;
      let ua = q.ua, sat = q.sat, uaPeak = w ? w.uaPeak : Math.abs(q.ua);
      if (defekt) { ua = q.usat; sat = true; uaPeak = q.usat; }
      const ue = ctl.ue;
      const v = defekt ? (Math.abs(ue) > 1e-9 ? ua / ue : 0) : v0;
      const ia = ua / ctl.rl;
      return { ok: true, sum, fe, defekt, q, id, w, fr, fEff, ideal, v, v0, vId, ua, sat, uaPeak, hf, phiF, vn, ri: inp.r1, ra: q.ra, fg: q.fg, usat: q.usat, usatN: q.usatN, uosOut: q.uosOut, ia, inp, cfgBase: base, ue, ctl: Object.assign({}, ctl) };
    }

    function meters(r) {
      const o = { v: 0, vId: 0, ua: 0, uaPeak: 0, ri: 0, ra: 0, fg: 0, usat: 0, sat: 0, uosOut: 0 };
      if (!r.ok) return o;
      o.v = r.v; o.vId = r.vId; o.ua = r.ua; o.uaPeak = r.uaPeak; o.ri = r.ri; o.ra = r.ra; o.fg = isNum(r.fg) ? r.fg : 1e12; o.usat = r.usat; o.sat = r.sat ? 1 : 0; o.uosOut = r.uosOut * 1000;
      return o;
    }

    function assess(r, ctl, o) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: 'Die Prüfung ist nicht möglich: ' + r.why };
      const z = ctl.zielV, ist = Math.abs(r.v);
      const ziel = { text: '|V_u| = ' + val(z, ''), soll: z, ist, unit: '' };
      if (r.sat) return { ok: false, ampel: 'rot', ziel, text: 'Der Ausgang liegt an der Aussteuergrenze (U_a = ' + val(r.ua, 'V', 2) + ', U_sat = ' + val(r.usat, 'V', 2) + '): Die Vorgabe |V_u| = ' + val(z, '') + ' ist so nicht erreicht.' };
      const pct = Math.abs(ist - z) / z * 100, ampel = B.devAmpel(pct, CORE, 'op');
      return { ok: ampel === 'gruen', ampel, margin: pct, ziel, text: B.devText('Verstärkung |V_u|', ist, z, '', pct, CORE, 'op') };
    }

    function diag(r, ctl) {
      if (!r.ok) return [{ id: 'ungueltig', kind: 'error', text: r.why }];
      const out = [], f = ctl.fehler, q = r.q;
      const push = (id, kind, text, verraet) => out.push(verraet ? { id, kind, text, verraet: true } : { id, kind, text });
      const ue = ctl.ue, ueTxt = val(ue, 'V', 3);
      if (f === 'rf offen') {
        push('rf-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): Es gibt keine Rückkopplung vom Ausgang zum −Eingang. U_a = ' + val(r.ua, 'V', 2) + ' bei U_e = ' + ueTxt + '.', true);
        push('ohne-gegenkopplung', 'warn', (T0.gegenkopplung || 'Ohne Gegenkopplung arbeitet der Operationsverstärker als Komparator und läuft in die Sättigung.') + ' Hier: U_a = ' + val(r.ua, 'V', 2) + ', Aussteuergrenze U_sat = ' + val(r.usat, 'V', 2) + '.', true);
      }
      if (f === 'r1 offen') push('r1-offen', 'warn', FN[f] + ' (Fehlerfall der Simulation): ' + (r.sum ? 'Eingang 1 trägt zur Summe nichts bei, ' : 'Es fließt kein Eingangsstrom, ') + 'U_a = ' + val(r.ua, 'V', 3) + ' bei U_e = ' + ueTxt + '.', true);
      if (f === 'rf kurz') push('rf-kurz', 'warn', FN[f] + ' (Fehlerfall der Simulation, R_f = ' + eng(KURZ, 'Ω') + '): V_u = ' + val(r.v, '', 6) + ', der Ausgang bleibt bei U_a = ' + val(r.ua, 'V', 4) + '.', true);
      if (f === 'versorgung fehlt') push('versorgung-fehlt', 'error', FN[f] + ' (Fehlerfall der Simulation): U_sat = ' + val(r.usat, 'V', 2) + ', der Ausgang bleibt bei U_a = ' + val(r.ua, 'V', 2) + '.', true);
      if (f === 'versorgung minus fehlt') push('versorgung-minus-fehlt', 'warn', FN[f] + ' (Fehlerfall der Simulation): Der Ausgang kann nicht unter −' + val(r.usatN, 'V', 2) + ' gehen; U_a,lin = ' + val(q.ualin, 'V', 2) + ', U_a = ' + val(r.ua, 'V', 2) + '.', true);
      if (f === 'ausgang defekt') push('ausgang-defekt', 'error', FN[f] + ' (Fehlerfall der Simulation, Lehrmodell): Der Ausgang hängt an +U_sat = ' + val(r.usat, 'V', 2) + ' und folgt dem Eingang nicht, U_a = ' + val(r.ua, 'V', 2) + '. Ein defekter Operationsverstärker wird ersetzt; hier wird nur das Messbild gelesen.', true);
      if (q.sat) push('saettigung', 'warn', 'Der Ausgang ist in der Sättigung: U_a,lin = ' + val(q.ualin, 'V', 2) + ' läge außerhalb der Aussteuergrenzen (+' + val(q.usat, 'V', 2) + ' / −' + val(q.usatN, 'V', 2) + '), U_a = ' + val(q.ua, 'V', 2) + '. Größte Eingangsspannung ohne Begrenzen: U_e,max = ' + val(q.ueMax, 'V', 3) + '.');
      if (!r.sum && !r.ideal && isNum(q.fg) && r.fEff > 0.5 * q.fg) push('gbw-grenze', 'info', 'Bei f = ' + eng(r.fEff, 'Hz') + ' (über der halben Grenzfrequenz f_g = ' + eng(q.fg, 'Hz') + ') ist die Verstärkung auf ' + val(r.hf / Math.abs(q.v) * 100, '%', 1) + ' gefallen: |V_u| = ' + val(r.hf, '', 3) + ' statt ' + val(Math.abs(q.v), '', 3) + '.');
      if (!r.sum && r.w && r.w.slew) {
        const sr = srOf(ctl.opv), fmax = CORE.op.fpb({ sr, uhat: Math.max(r.w.uaPeak, 1e-9) });
        push('slew', 'warn', 'Die Slew-Rate ist erreicht: Der Ausgang kann höchstens mit SR = ' + val(sr / 1e6, 'V/µs', 2) + ' steigen (Übungswert, F9). Bei û = ' + val(r.w.uaPeak, 'V', 2) + ' wäre die größte Frequenz f_max = ' + eng(fmax, 'Hz') + ', hier f = ' + eng(r.fEff, 'Hz') + '.');
      }
      if (!r.ideal && Math.abs(ue) < 1e-12) push('offset', 'info', 'Offsetspannung: Bei U_e = 0 liegt am Ausgang U_a,off = ' + val(q.uosOut * 1000, 'mV', 2) + ' (U_os mal V_n mit V_n = ' + val(q.vn, '', 2) + '; Übungswert, F9).');
      if (!r.sum && Math.abs(ue) > 0 && q.v < 0 && f === 'keiner') push('v-vorzeichen', 'info', 'V_u = ' + val(q.v, '', 3) + ' ist negativ: Der Invertierer dreht die Phase um ' + fm(lim('opv_inv_phase', 180), 0) + '°' + ', u_a ist gegen u_e gespiegelt. Der nichtinvertierende Verstärker hat dagegen V_u ≥ 1.');
      if (r.sum && f === 'keiner') push('summierer-vorzeichen', 'info', 'Summierer: Die Eingangsströme addieren sich zu I_ges = ' + val(q.i.reduce((s, x) => s + x, 0) * 1e6, 'µA', 2) + '; U_a = −R_f · I_ges = ' + val(q.ualin, 'V', 3) + ' (das Minuszeichen steht vor der ganzen Summe).');
      return out;
    }
    function befund(r, ctl) {
      if (!r.ok) return [];
      return [{ id: 'befund', kind: 'info', text: 'Messbefund: U_e = ' + val(ctl.ue, 'V', 3) + ', U_a = ' + val(r.ua, 'V', 3) + ', U_a (Spitze im Zeitbild) = ' + val(r.uaPeak, 'V', 3) + ', Aussteuergrenze ±' + val(r.usat, 'V', 2) + ', Ausgang ' + (r.sat ? 'an der Aussteuergrenze' : 'nicht begrenzt') + '.' }];
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
      const q = r.sum ? CORE.op.sum(Object.assign({ rf: inp.rf, r: [inp.r1, inp.r2, inp.r3], u: [x, ctl.ue2, ctl.ue3] }, base)) : CORE.op.inv(Object.assign({ r1: inp.r1, rf: inp.rf, ue: x }, base));
      if (!q || q.ok === false || !isNum(q.ua)) return NaN;
      return r.defekt ? q.usat : q.ua;
    }
    function curvesRaw(r, ctl) {
      const xs = [];
      for (let i = 0; i <= N_CURVE; i++) xs.push(-10 + 20 * i / N_CURVE);
      if (isNum(r.q.ueMax) && r.q.ueMax > 0 && r.q.ueMax < 10 && !r.sum) { xs.push(r.q.ueMax, -r.q.ueMax); }
      xs.sort((a, b) => a - b);
      const pts = []; xs.forEach((x, i) => { if (i && x === xs[i - 1]) return; const y = uaAt(r, ctl, x); if (isNum(y)) pts.push([x, y]); });
      if (pts.length < 2) return [];
      const c1 = { id: 'uebertragung', title: 'Übertragungskennlinie U_a über U_e', xLabel: r.sum ? 'Eingangsspannung U_1' : 'Eingangsspannung U_e', xUnit: 'V', xScale: 'lin', yLabel: 'Ausgangsspannung U_a', yUnit: 'V',
        series: [{ name: 'U_a', kind: 'out', points: pts }], marker: { x: ctl.ue, y: r.ua, label: ctl.form === 'gleich' || r.sum ? 'Arbeitspunkt' : 'Spitze' }, limit: { y: r.usat, name: 'U_sat', sym: Math.abs(r.usat - r.usatN) < 1e-12 } };
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
      if (r.sum) {
        const nn = 33; for (let i = 0; i < nn; i++) tt.push(2 * T * i / (nn - 1) * tu.k);
        const c = a => tt.map(() => a);
        return { tUnit: tu.u, t: tt, series: [{ name: 'U_1', unit: 'V', kind: 'u', y: c(ctl.ue) }, { name: 'U_2', unit: 'V', kind: 'ref', y: c(ctl.ue2) }, { name: 'U_3', unit: 'V', kind: 'line', y: c(ctl.ue3) }, { name: 'u_a', unit: 'V', kind: 'out', y: c(r.ua) }], marks: { span: [{ t0: 0, t1: T * tu.k, name: 'T' }] }, clip: [], slew: [] };
      }
      const w = r.w; if (!w || !w.uin || w.uin.length < 4) return null;
      const dt = T / n, yin = [], yout = [];
      for (let p = 0; p < 2; p++) for (let i = 0; i < n; i++) { tt.push((p * n + i) * dt * tu.k); yin.push(w.uin[i]); yout.push(r.defekt ? r.usat : w.uout[i]); }
      const eps = 1e-9 * Math.max(1, r.usat, r.usatN), sr = srOf(ctl.opv), mx = isNum(sr) ? sr * dt * (1 - 1e-6) : Infinity;
      const clip = band(tt, i => yout[i] >= r.usat - eps || yout[i] <= -r.usatN + eps), slew = isNum(sr) && !r.defekt ? band(tt, i => i > 0 && Math.abs(yout[i] - yout[i - 1]) >= mx) : [];
      return { tUnit: tu.u, t: tt, series: [{ name: 'u_e', unit: 'V', kind: 'u', y: yin }, { name: 'u_a', unit: 'V', kind: 'out', y: yout }], marks: { span: [{ t0: 0, t1: T * tu.k, name: 'T' }] }, clip: r.defekt ? [] : clip, slew };
    }

    function state(r, ctl) {
      if (!r.ok) return { valid: false, zustand: '', zustandCode: 0, text: 'Die Eingabe ist ungültig.', sweep: sw.active, sweepP: sw.p };
      const z = r.sat ? 'begrenzt' : 'linear';
      return { valid: true, zustand: z, zustandCode: r.sat ? 1 : 0, text: 'V_u = ' + val(r.v, '', 3) + ', U_a = ' + val(r.ua, 'V', 3) + (r.sat ? ' (an der Aussteuergrenze)' : '') + '.',
        v: r.v, vId: r.vId, ua: r.ua, uaPeak: r.uaPeak, sat: r.sat ? 1 : 0, usat: r.usat, usatN: r.usatN, fg: isNum(r.fg) ? r.fg : 0, ri: r.ri, ra: r.ra, uosOut: r.uosOut, vn: r.vn, hf: isNum(r.hf) ? r.hf : 0, phiF: isNum(r.phiF) ? r.phiF : 0,
        fEff: r.fEff, ia: r.ia, ideal: r.ideal ? 1 : 0, sweep: sw.active, sweepP: sw.p };
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
      const sg = { 'rf offen': [['rf', 'offen']], 'r1 offen': [['r1', 'offen']], 'rf kurz': [['rf', 'kurz']], 'versorgung minus fehlt': [['uvn', 'defekt']], 'versorgung fehlt': [['uv', 'defekt'], ['uvn', 'defekt']], 'ausgang defekt': [['op', 'defekt']] }[ctl.fehler];
      if (!sg) return {};
      return { fault: sg.map(a => ({ id: a[0], type: a[1] })), faultText: 'Fehler (Simulation): ' + (FN[ctl.fehler] || '') };
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
      const fs = faultSpec(ctl, hid), inp = r.inp, vals = {}, L = {};
      vals.rf = eng(ctl.rf, 'Ω'); vals.r1 = eng(ctl.r1, 'Ω');
      if (r.sum) { vals.r2 = eng(ctl.r2, 'Ω'); vals.r3 = eng(ctl.r3, 'Ω'); }
      vals.rl = ctl.rl >= 1e6 ? 'offen' : eng(ctl.rl, 'Ω');
      L.ua = 'U_a = ' + eng(r.ua, 'V'); L.uv = '+U_v = ' + val(ctl.uv, 'V', 1); L.uvn = '−U_v = −' + val(ctl.uv, 'V', 1);
      if (r.sum) { L.u1 = 'U_1 = ' + eng(ctl.ue, 'V'); L.u2 = 'U_2 = ' + eng(ctl.ue2, 'V'); L.u3 = 'U_3 = ' + eng(ctl.ue3, 'V'); }
      else {
        L.ue = (ctl.form === 'gleich' ? 'U_e = ' : 'û_e = ') + eng(ctl.ue, 'V');
        const i1 = CORE.op.sum({ rf: inp.rf, r: [inp.r1], u: [ctl.ue], opv: 'ideal' });
        if (i1 && i1.ok !== false) { L.i1 = 'I_1 = ' + eng(i1.i[0], 'A'); L.if = 'I_f = ' + eng(i1.i[0], 'A'); }
      }
      const sd = Object.assign({ kind: r.sum ? 'summierer' : 'opv_inv', values: vals, labels: L }, fs);
      if (ctl.rl >= 1e6) sd.hide = ['rl'];
      if (!sc.view('schematic', sch, sd, {})) g.panel(ctx, sch.x, sch.y, sch.w, sch.h, pal.panel, pal.line, 6);
      const cv = view.rig.curves();
      if (cv.length) sc.view('curve', kenn, cv[0], {}); else noData(ctx, g, kenn, pal, 'Keine Kennlinie für diese Werte.');
      const wf = view.rig.waveform ? view.rig.waveform() : null;
      if (wf && sig.h > 0) { if (!sc.view('scope', sig, wf, {})) noData(ctx, g, sig, pal, 'Das Zeitbild passt nicht in diese Größe.'); } else noData(ctx, g, sig, pal, 'Kein Zeitverlauf für diese Werte.');
      const fr = r.fr;
      if (fr && bod.h > 0) {
        const bd = { f: fr.f, a: fr.a, phi: fr.phi, open: fr.open, fg: fr.fg, fA: fr.openFg, gbw: r.ctl.opv === 'langsam' ? CORE.limit('gbw_langsam').value : CORE.limit('gbw_schnell').value, typ: 'ver' };
        if (!sc.view('bode', bod, bd, sw.active ? { wipe: sw.p } : {})) noData(ctx, g, bod, pal, 'Das Bode-Diagramm passt nicht in diese Größe.');
      } else if (bod.h > 0) noData(ctx, g, bod, pal, 'Idealer Operationsverstärker: Der Frequenzgang ist unbegrenzt (kein Bode-Diagramm). Wähle „real, langsam“ oder „real, schnell“.');
      if (strip.h >= 50) {
        g.panel(ctx, strip.x, strip.y, strip.w, strip.h, pal.panel, pal.line, 6);
        const rows = [];
        if (r.sum) {
          rows.push({ t: 'U_a = −R_f · Σ(U_k / R_k)', bold: true, color: pal.fg });
          rows.push({ t: 'Σ I_k = ' + eng(r.q.i.reduce((s, x) => s + x, 0), 'A') + ', U_a = ' + val(r.q.ualin, 'V', 3) + (r.q.sat ? ' (begrenzt auf ' + val(r.ua, 'V', 2) + ')' : ''), color: pal.fg });
          rows.push({ t: 'V_u (Eingang 1) = ' + val(r.v, '', 3) + ', V_n = ' + val(r.vn, '', 3), color: pal.mute });
        } else {
          rows.push({ t: SICHT.formel, bold: true, color: pal.fg });
          rows.push({ t: 'V_u = −' + eng(ctl.rf, 'Ω') + ' / ' + eng(ctl.r1, 'Ω') + ' = ' + val(r.vId, '', 4) + (r.ideal ? '' : ', real ' + val(r.v0, '', 4)), color: pal.fg });
          rows.push({ t: 'U_a = ' + val(r.q.ualin, 'V', 3) + (r.q.sat ? ' (begrenzt auf ' + val(r.ua, 'V', 2) + ')' : '') + (r.ideal ? '' : ', f_g = ' + eng(r.fg, 'Hz')), color: pal.mute });
        }
        rows.push({ t: ctl.rl >= 1e6 ? 'Ausgang im Leerlauf (I_a = 0)' : 'I_a = U_a / R_L = ' + eng(r.ia, 'A'), color: pal.mute });
        if (sw.active) rows.push({ t: 'Frequenzdurchlauf: f = ' + eng(r.fEff, 'Hz'), bold: true, color: pal.fg });
        g.lines(ctx, strip, rows, pal, { size: g.fz(w), lh: g.fz(w) + 6 });
      }
      if (chipsH) {
        const y = R0.y + bodyH + gap, m = view.rig.readMeters();
        const items = [['V_u', val(m.v, '', 3)], ['U_a', val(m.ua, 'V', 2)], ['r_ein', eng(m.ri, 'Ω')], ['f_g', r.ideal ? '∞' : eng(m.fg, 'Hz')]];
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
        if (ctl.schaltung !== 'invertierer') { P0.say('Der Frequenzdurchlauf zeigt das Zeitbild des Invertierers; wähle ihn zuerst (der Summierer hat Gleichspannungen am Eingang).', 'warn'); return false; }
        sw.active = true; sw.p = 0;
        P0.say('Frequenzdurchlauf: f läuft von 10 Hz bis 10 MHz. ' + (ctl.opv === 'ideal' ? 'Der ideale Operationsverstärker hat keinen Frequenzgang: Die Verstärkung bleibt gleich.' : 'Beobachte, wie die Verstärkung ab f_g fällt und wann die Slew-Rate den Ausgang begrenzt.'), 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 0; }
    };
  }

  R.register({ id: 'opv_inv', name: 'Invertierender Verstärker und Summierer', icon: '➖', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'opv_inv', name: 'Invertierender Verstärker und Summierer', icon: '➖', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['zielV'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
