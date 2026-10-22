/* elsrig-pruefplatz.js - ELS-Lab (WP2d): Pruefstand 7 `pruefplatz` - Pruefplatz Geraetepruefung (SPEC 5.7).
 * Die gemeinsame Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikel, Zeichenhuelle) liegt in elsrig-base.js: Diese Datei im Browser NACH elsrig-base.js laden
 * (in Node holt sie sich die Basis per require). Gerechnet wird NUR im Kern (ELS_CORE.device.make / measureAll / verdict, protocol.check, cls.info, limits ueber verdict);
 * hier steht keine zweite Formel. Alle Zahlen sind Uebungswerte (Katalog F14, Grenzwerte mit Status in ELS_CORE.limits): Uebungsanlage. Simulation.
 * Sicherheit (SPEC 9): Isolations- und Schutzleiterwiderstandsmessung nur am freigeschalteten, getrennten Pruefling; die Messung unter Spannung (Schutzleiterstrom)
 * wird als Messung am Pruefgeraet mit geprueftem Pruefaufbau durch die Elektrofachkraft beschrieben, nie als Handlung. Keine Anleitung an Steckdosen oder Verteilern.
 *
 * Steuerwerte: geraet (14 Pruefling, feste Reihenfolge des Katalogs), zufall + seed + anzahl (Maengel vom Seed), m_<mangel> (8 Schalter, Mehrfachwahl),
 *              schritt (Auswahl des naechsten Pruefschritts: sicht, rpe, riso, ipe, ergebnis), modus (Wiederholungspruefung | nach Instandsetzung),
 *              Tasten fire (naechster Schritt), sicht_leitung / sicht_stecker / sicht_gehaeuse (Sichtpruefung: Stelle am Geraet antippen).
 * Messgeraete: rpe (Ohm), riso (MOhm), ipe (mA; bei Schutzklasse II der Beruehrungsstrom), schritte (Anzahl durchgefuehrter Schritte), urteil (0 offen, 1 bestanden,
 *              2 nicht bestanden, 3 unvollstaendig). Nicht gemessene Schritte zeigen 0 ("nicht gemessen"); readMeters liefert immer endliche Zahlen.
 * Ablauf: Die Reihenfolge ist fest (sicht, rpe, riso, ipe; Schutzklasse II ohne rpe). Eine andere Reihenfolge wird NICHT verboten, sondern erklaert (der Lehrfehler bleibt
 *         sichtbar, das Urteil nennt ihn). "bestanden" (gruen) nur, wenn ALLE Schritte durchgefuehrt und verglichen sind, kein Schritt rot ist und die Reihenfolge stimmt.
 * Zusatzmethoden am Rig: do(name) (sicht | rpe | riso | ipe | ergebnis | sicht:<stelle> | neu; fuer Ablaufzeilen {t, do:'rpe'}), inspect(stelle), pruefling() (dev fuer
 *         protocol.check), protokollWerte() (Vorschlag fuer den Tab Pruefprotokoll aus den DURCHGEFUEHRTEN Schritten), naechsterSchritt().
 * hitTest: Schritt-Karten (key schritt, to), Weiter (fire), Stellen am Geraet (key sicht_<stelle>, kind button). Wirft nie.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./elsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('elsrig-pruefplatz.js: Die Basis elsrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum } = B;
  let C0 = null;
  try { C0 = B.core(); } catch (e) { C0 = null; }
  if (!C0 || !C0.device || !C0.protocol || !C0.cls) { if (typeof console !== 'undefined') console.warn('elsrig-pruefplatz.js: ELS_CORE Teil 2 (elscore-pruef.js: device, protocol) fehlt, der Pruefstand wird nicht registriert.'); return; }

  const CAT = C0.device.catalog, FAULTS = C0.device.faults;
  const SPOTS = ['leitung', 'stecker', 'gehaeuse'];
  const SPOT_FAULT = { leitung: 'leitung-beschaedigt', stecker: 'stecker-lose', gehaeuse: 'gehaeuse-gebrochen' };
  const SPOT_NAME = { leitung: 'Anschlussleitung', stecker: 'Stecker', gehaeuse: 'Gehäuse' };
  const STEPS = ['sicht', 'rpe', 'riso', 'ipe'];
  const STEP_NAME = { sicht: 'Sichtprüfung', rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom', ergebnis: 'Ergebnis' };
  const STEP_SHORT = { sicht: 'Sicht', rpe: 'Schutzleiter', riso: 'Isolation', ipe: 'Strom', ergebnis: 'Ergebnis' };
  const ORDER_TXT = 'Die feste Prüfreihenfolge lautet Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom (Schutzklasse II ohne Schutzleiterwiderstand).';
  const fkey = id => 'm_' + id.replace(/-/g, '_');
  const catById = {}; CAT.forEach(d => { catById[d.id] = d; });
  // Schutzebene je Mangel: Isolierung und Huellen = Basisschutz, Schutzleiter = Fehlerschutz, Ableitstrom = reine Vorgabe
  const F_EBENE = { 'leitung-beschaedigt': 'basis', 'stecker-lose': 'basis', 'gehaeuse-gebrochen': 'basis', 'pe-unterbrochen': 'fehler', 'pe-hochohmig': 'fehler', 'isolation-feucht': 'basis', 'isolation-defekt': 'basis', 'y-kondensator-alt': null };
  const F_HELP = {
    'leitung-beschaedigt': 'Mangel für die Sichtprüfung: Die Anschlussleitung ist beschädigt. Nur die Sichtprüfung findet ihn, die Messwerte bleiben unauffällig.',
    'stecker-lose': 'Mangel für die Sichtprüfung: Der Stecker ist locker oder beschädigt. Nur die Sichtprüfung findet ihn.',
    'gehaeuse-gebrochen': 'Mangel für die Sichtprüfung: Das Gehäuse ist gebrochen. Nur die Sichtprüfung findet ihn.',
    'pe-unterbrochen': 'Fehlerbild nur in der Simulation: Der Schutzleiter ist unterbrochen. Der Schutzleiterwiderstand liegt über dem Messbereich, der Schritt ist rot. Nur bei Schutzklasse I möglich.',
    'pe-hochohmig': 'Fehlerbild nur in der Simulation: Der Schutzleiter hat einen zu hohen Widerstand (Übungswert). Der Schutzleiterwiderstand liegt über dem Grenzwert. Nur bei Schutzklasse I möglich.',
    'isolation-feucht': 'Fehlerbild nur in der Simulation: Die Isolierung ist feucht (Parallelpfad, Lehrmodell). Der Isolationswiderstand sinkt unter den Grenzwert.',
    'isolation-defekt': 'Fehlerbild nur in der Simulation: Die Isolierung ist durchgeschlagen (Übungswert). Der Isolationswiderstand ist sehr klein.',
    'y-kondensator-alt': 'Fehlerbild nur in der Simulation: Der Y-Kondensator ist gealtert, der Ableitstrom wird zu groß. Nur bei Geräten mit Y-Kondensator möglich.'
  };
  const G_P = 'Prüfling', G_M = 'Mängel', G_A = 'Ablauf';
  const CONTROLS = [
    { key: 'geraet', label: 'Prüfling', type: 'select', value: 'wasserkocher', options: CAT.map(d => ({ value: d.id, label: d.name + ' (SK ' + d.sk + ')' })), ebene: null, group: G_P,
      help: 'Welches Gerät geprüft wird (14 Übungsgeräte, Reihenfolge fest). Der Katalog enthält Übungswerte (F14). Ein Wechsel setzt die Prüfung zurück.' },
    { key: 'modus', label: 'Prüfart', type: 'select', value: 'wiederholung', options: [{ value: 'wiederholung', label: 'Wiederholungsprüfung' }, { value: 'instandsetzung', label: 'nach Instandsetzung' }], ebene: null, group: G_P,
      help: 'Anlass der Prüfung. Er kommt ins Prüfprotokoll; die Prüfschritte und Grenzwerte ändern sich in der Übung nicht.' },
    { key: 'zufall', label: 'Mängel vom Zufall', type: 'switch', value: false, ebene: null, group: G_M,
      help: 'Ein: Die Mängel kommen vom Seed (deterministisch, gleicher Seed gleiche Mängel). Aus: Du wählst die Mängel mit den Schaltern darunter.' },
    { key: 'seed', label: 'Seed', type: 'slider', scale: 'lin', min: 1, max: 99, step: 1, unit: '', unitKind: '', value: 1, ebene: null, group: G_M,
      visible: st => !!st.zufall, help: 'Startwert des Zufalls für Mängel und Messrauschen (nur Darstellung, höchstens 2 Prozent). Gleicher Seed, gleiches Ergebnis.' },
    { key: 'anzahl', label: 'Anzahl Mängel', type: 'slider', scale: 'lin', min: 0, max: 3, step: 1, unit: '', unitKind: '', value: 1, ebene: null, group: G_M,
      visible: st => !!st.zufall, help: 'Wie viele Mängel der Zufall wählt (0 bis 3). Mängel, die sich ausschließen, werden nicht zusammen gewählt.' }
  ].concat(FAULTS.map(id => ({ key: fkey(id), label: C0.device.faultName[id], type: 'switch', value: false, ebene: F_EBENE[id], group: G_M, visible: st => !st.zufall, help: F_HELP[id] })))
    .concat([
      { key: 'schritt', label: 'Nächster Prüfschritt', type: 'select', value: 'sicht', options: STEPS.concat(['ergebnis']).map(s => ({ value: s, label: STEP_NAME[s] })), ebene: null, group: G_A,
        help: 'Wähle den Prüfschritt, den die Taste Weiter durchführt. Eine andere als die feste Reihenfolge ist erlaubt: Du bekommst die Erklärung und das Urteil nennt den Fehler.' },
      { key: 'fire', label: 'Weiter (Schritt durchführen)', type: 'button', ebene: null, group: G_A,
        help: 'Führt den gewählten Prüfschritt durch und wählt danach den nächsten in der festen Reihenfolge. Messung nur am freigeschalteten, getrennten Prüfling (Simulation).' },
      { key: 'sicht_leitung', label: 'Sichtprüfung: Anschlussleitung', type: 'button', ebene: null, group: G_A, help: 'Prüft die Anschlussleitung mit den Augen. Sind alle drei Stellen geprüft, ist die Sichtprüfung abgeschlossen.' },
      { key: 'sicht_stecker', label: 'Sichtprüfung: Stecker', type: 'button', ebene: null, group: G_A, help: 'Prüft den Stecker mit den Augen. Sind alle drei Stellen geprüft, ist die Sichtprüfung abgeschlossen.' },
      { key: 'sicht_gehaeuse', label: 'Sichtprüfung: Gehäuse', type: 'button', ebene: null, group: G_A, help: 'Prüft das Gehäuse mit den Augen. Sind alle drei Stellen geprüft, ist die Sichtprüfung abgeschlossen.' }
    ]);
  const METERS = [
    { key: 'rpe', label: 'Schutzleiterwiderstand R_PE', unit: 'Ω', digits: 3, min: 0, max: 2, warnAbove: 0.3, zeroIsNone: true, help: 'Wert des Prüfgeräts im Schritt Schutzleiterwiderstand. 0 heißt: nicht gemessen (oder Schutzklasse II). Grenzwert nur bis 5 m Anschlussleitung (✓ belegt).' },
    { key: 'riso', label: 'Isolationswiderstand R_iso', unit: 'MΩ', digits: 1, min: 0, max: 1000, warnBelow: 1, zeroIsNone: true, help: 'Wert im Schritt Isolationswiderstand. 0 heißt: nicht gemessen. Messung nur am freigeschalteten, getrennten Prüfling.' },
    { key: 'ipe', label: 'Schutzleiterstrom / Berührungsstrom', unit: 'mA', digits: 3, min: 0, max: 5, zeroIsNone: true, help: 'Wert im Schritt Strom: Schutzleiterstrom bei Schutzklasse I, Berührungsstrom bei Schutzklasse II. 0 heißt: nicht gemessen. Grenzwerte siehe Urteil (Übungswerte A gekennzeichnet).' },
    { key: 'schritte', label: 'Durchgeführte Schritte', unit: '', digits: 0, min: 0, max: 4, zeroIsNone: true, help: 'Anzahl der Prüfschritte, die du durchgeführt hast (Sichtprüfung gilt, wenn alle drei Stellen geprüft sind).' },
    { key: 'urteil', label: 'Urteil', unit: '', digits: 0, min: 0, max: 3, zeroIsNone: true, help: '0 = noch kein Ergebnis abgefragt, 1 = bestanden, 2 = nicht bestanden, 3 = unvollständig (es fehlen Schritte).' }
  ];
  const PRESETS = [
    { id: 'wasserkocher-ok', name: 'Wasserkocher ohne Mangel', info: 'Ein Prüfling ohne Mangel besteht, wenn alle Schritte durchgeführt sind.', params: { geraet: 'wasserkocher' } },
    { id: 'bohrmaschine-iso', name: 'Bohrmaschine mit feuchter Isolierung', info: 'Schutzklasse II: Der Isolationswiderstand fällt durch.', params: { geraet: 'bohrmaschine', m_isolation_feucht: true } },
    { id: 'verlaengerung-pe', name: 'Verlängerung mit hochohmigem Schutzleiter', info: 'Fünf Meter Leitung: Der Schutzleiterwiderstand liegt über dem Grenzwert.', params: { geraet: 'verlaengerung', m_pe_hochohmig: true } },
    { id: 'netzteil-ableit', name: 'Labornetzteil mit altem Y-Kondensator', info: 'Der Ableitstrom ist zu groß, die anderen Schritte sind in Ordnung.', params: { geraet: 'netzteil-labor', m_y_kondensator_alt: true } },
    { id: 'haartrockner-sicht', name: 'Haartrockner mit gebrochenem Gehäuse', info: 'Nur die Sichtprüfung findet den Mangel.', params: { geraet: 'haartrockner', m_gehaeuse_gebrochen: true } }
  ];
  const PFAD = { fehler: 'Mangel am Prüfling', weg: 'Vier Prüfschritte, feste Reihenfolge', schutz: 'Grenzwert, Urteil, Prüfprotokoll', art: 'messung' };
  const PARAMS = { zeigeNachlauf: 400 };

  function plant(P0) {
    const CORE = P0.CORE, D0 = CORE.device;
    const st = { done: [], inspected: [], ergebnis: false, reading: '', triedRpe: false, sicht: null };
    const clearState = () => { st.done = []; st.inspected = []; st.ergebnis = false; st.reading = ''; st.triedRpe = false; };
    let hl = [], hlW = 0, hlH = 0;

    function pickFaults(ctl, d, notes) {
      let faults = [];
      if (ctl.zufall) {
        const m = D0.make(d.id, { seed: ctl.seed, n: ctl.anzahl });
        faults = m && m.ok !== false ? m.faults.slice() : [];
        return faults;
      }
      FAULTS.forEach(id => {
        if (!ctl[fkey(id)]) return;
        if (d.defekteMoeglich.indexOf(id) < 0) notes.push({ id: 'unmoeglich-' + id, kind: 'info', text: 'Der Mangel „' + D0.faultName[id] + '“ ist beim Prüfling ' + d.name + ' nicht möglich und wird ignoriert.' });
        else faults.push(id);
      });
      [['pe-unterbrochen', 'pe-hochohmig'], ['isolation-defekt', 'isolation-feucht']].forEach(g => {
        if (faults.indexOf(g[0]) >= 0 && faults.indexOf(g[1]) >= 0) {
          faults.splice(faults.indexOf(g[1]), 1);
          notes.push({ id: 'konflikt-' + g[0], kind: 'info', text: 'Die Mängel „' + D0.faultName[g[0]] + '“ und „' + D0.faultName[g[1]] + '“ schließen sich aus: Es gilt „' + D0.faultName[g[0]] + '“.' });
        }
      });
      return faults;
    }
    function stepLine(s) {
      if (!s || s.status === 'nicht gemessen') return (s ? s.name : '') + ': nicht gemessen.';
      if (s.id === 'sicht') return s.name + ': ' + (s.ok ? 'keine Mängel gefunden.' : s.wert + ' Mangel/Mängel gefunden (' + (s.mangel || []).map(m => D0.faultName[m] || m).join('; ') + ').');
      const val = s.id === 'rpe' && s.wert >= 5e5 ? 'über dem Messbereich (Schutzleiter unterbrochen)' : CORE.fmt(s.wert, 3) + ' ' + s.einheit;
      if (s.status === 'kein Grenzwert') return s.name + ': ' + val + ', ' + s.grenzText + '.';
      return s.name + ': ' + val + ', Grenzwert ' + s.grenzText + ': ' + (s.ok ? 'eingehalten.' : 'nicht eingehalten.');
    }

    function compute(ctl) {
      const d = catById[ctl.geraet];
      if (!d) return { ok: false, text: CORE.TEXTS.eingabe };
      const notes = [];
      let faults;
      try { faults = pickFaults(ctl, d, notes); } catch (e) { return { ok: false, text: CORE.TEXTS.eingabe }; }
      const dev = { id: d.id, faults, seed: ctl.seed };
      const meas = D0.measureAll(dev, { seed: ctl.seed });
      if (!meas || meas.ok === false) return { ok: false, text: CORE.TEXTS.eingabe };
      const order = CORE.cls.info(d.sk).pruefung.slice();
      const sh = { reihenfolge: st.done.slice() };
      if (st.done.indexOf('sicht') >= 0) sh.sicht = meas.sicht.slice();
      if (st.done.indexOf('rpe') >= 0) sh.rpe = meas.rpe;
      if (st.done.indexOf('riso') >= 0) sh.riso = meas.riso;
      if (st.done.indexOf('ipe') >= 0) { if (d.sk === 'II') sh.ber = meas.ber; else sh.ipe = meas.ipe; }
      const vd = D0.verdict(sh, { id: d.id, sk: d.sk, leitungM: d.leitungM });
      if (!vd || vd.ok === false) return { ok: false, text: CORE.TEXTS.eingabe };
      const fehlendAll = order.filter(s => st.done.indexOf(s) < 0);
      return { ok: true, d, dev, faults, notes, meas, shown: sh, vd, order, fehlendAll, sk: d.sk };
    }
    const calc = () => compute(P0.ctl);
    const nextPending = r => { const p = r.order.filter(s => st.done.indexOf(s) < 0); return p.length ? p[0] : 'ergebnis'; };

    function meters(r) {
      if (!r || r.ok === false) return { rpe: 0, riso: 0, ipe: 0, schritte: 0, urteil: 0 };
      const dn = s => st.done.indexOf(s) >= 0;
      const urteil = !st.ergebnis ? 0 : r.vd.gesamt === 'bestanden' ? 1 : r.vd.gesamt === 'nicht bestanden' ? 2 : 3;
      return { rpe: dn('rpe') ? r.meas.rpe : 0, riso: dn('riso') ? r.meas.riso : 0, ipe: dn('ipe') ? (r.sk === 'II' ? r.meas.ber : r.meas.ipe) : 0, schritte: st.done.length, urteil };
    }
    function assess(r) {
      if (!r || r.ok === false) return { ok: false, ampel: 'grau', text: (r && r.text) || CORE.TEXTS.eingabe };
      const vd = r.vd;
      if (!st.done.length) return { ok: false, ampel: 'grau', text: 'Noch nichts geprüft. Beginne mit der Sichtprüfung (Stellen am Gerät antippen oder Weiter). ' + CORE.TEXTS.uebung };
      const rot = vd.steps.filter(s => s.status === 'rot');
      if (rot.length) return { ok: false, ampel: 'rot', text: vd.text, zusatz: rot.length + ' Schritt(e) nicht eingehalten' };
      if (vd.gesamt === 'bestanden') {
        if (vd.reihenfolgeOk === false) return { ok: false, ampel: 'gelb', text: 'Alle Schritte sind eingehalten, aber die Prüfreihenfolge nicht. ' + vd.text };
        return { ok: true, ampel: 'gruen', text: vd.text + ' ' + CORE.TEXTS.uebung };
      }
      return { ok: false, ampel: 'gelb', text: vd.text };
    }
    function diag(r) {
      const out = [];
      if (!r || r.ok === false) return out;
      r.notes.forEach(n => out.push(n));
      if (r.vd.reihenfolgeOk === false) out.push({ id: 'reihenfolge', kind: 'warn', text: 'Die Prüfreihenfolge wurde nicht eingehalten. ' + ORDER_TXT + ' Das Urteil nennt den Fehler.' });
      if (st.triedRpe && r.sk !== 'I') out.push({ id: 'sk2-rpe', kind: 'info', text: 'Schutzklasse ' + r.sk + ' hat keinen Schutzleiter: Der Schritt Schutzleiterwiderstand entfällt.' });
      if (st.ergebnis && r.vd.gesamt === 'unvollstaendig') out.push({ id: 'ergebnis-unvollstaendig', kind: 'warn', text: 'Noch kein Gesamturteil: Es fehlen Prüfschritte (' + r.fehlendAll.map(s => STEP_NAME[s]).join(', ') + '). Nicht gemessen heißt nicht bestanden.' });
      return out;
    }
    function curves() { return []; }

    // ---------------- Handlungen ----------------
    function say(t, k) { P0.say(t, k); }
    function markDone(step, r) {
      const pend = r.order.filter(s => st.done.indexOf(s) < 0);
      if (pend.length && pend[0] !== step && st.done.indexOf(step) < 0) say('Reihenfolge: ' + ORDER_TXT + ' Hier wurde ' + STEP_NAME[step] + ' vor ' + STEP_NAME[pend[0]] + ' durchgeführt. Die Messung läuft trotzdem, das Urteil nennt die falsche Reihenfolge.', 'warn');
      if (st.done.indexOf(step) < 0) st.done.push(step);
    }
    function inspect(spot) {
      if (SPOTS.indexOf(spot) < 0) return false;
      const r = calc(); if (!r.ok) return false;
      if (st.inspected.indexOf(spot) >= 0) return true;
      st.inspected.push(spot);
      const has = r.faults.indexOf(SPOT_FAULT[spot]) >= 0;
      say('Sichtprüfung ' + SPOT_NAME[spot] + ': ' + (has ? 'Mangel gefunden (' + D0.faultName[SPOT_FAULT[spot]] + ').' : 'keine Auffälligkeit.'), has ? 'warn' : 'info');
      if (st.inspected.length === SPOTS.length && st.done.indexOf('sicht') < 0) {
        markDone('sicht', r);
        const found = SPOTS.filter(s => r.faults.indexOf(SPOT_FAULT[s]) >= 0);
        st.reading = found.length ? found.length + ' Mangel/Mängel' : 'keine Mängel';
        say('Sichtprüfung abgeschlossen: ' + (found.length ? found.length + ' Mangel/Mängel gefunden. Ein Prüfling mit sichtbarem Mangel besteht die Sichtprüfung nicht.' : 'keine Mängel gefunden.'), found.length ? 'warn' : 'info');
      }
      P0.bump();
      return true;
    }
    function measure(step) {
      const r = calc(); if (!r.ok) return false;
      if (step === 'rpe' && r.sk !== 'I') { st.triedRpe = true; say('Schutzklasse ' + r.sk + ' hat keinen Schutzleiter: Der Schritt Schutzleiterwiderstand entfällt.', 'info'); P0.bump(); return true; }
      markDone(step, r);
      const r2 = calc(), s = r2.vd.steps.filter(q => q.id === step)[0];
      const line = stepLine(s);
      st.reading = step === 'rpe' ? (s.wert >= 5e5 ? 'über Messbereich' : CORE.fmt(s.wert, 3) + ' Ω') : step === 'riso' ? CORE.fmt(s.wert, 1) + ' MΩ' : CORE.fmt(s.wert, 3) + ' mA';
      say(line, s.status === 'rot' ? 'warn' : 'info');
      if (step === 'rpe' || step === 'riso') say(step === 'riso' ? CORE.TEXTS.isoNurFrei : 'Auch der Schutzleiterwiderstand wird nur am freigeschalteten, getrennten Prüfling gemessen.', 'info');
      if (step === 'ipe') say(CORE.TEXTS.messNurFachkraft, 'info');
      P0.bump();
      return true;
    }
    function doStep(name) {
      name = String(name);
      if (name === 'neu') { clearState(); P0.bump(); return true; }
      if (name.indexOf('sicht:') === 0) return inspect(name.slice(6));
      if (name === 'sicht') {
        const r = calc(); if (!r.ok) return false;
        SPOTS.forEach(s => inspect(s));
        return true;
      }
      if (name === 'rpe' || name === 'riso' || name === 'ipe') return measure(name);
      if (name === 'ergebnis') {
        const r = calc(); if (!r.ok) return false;
        st.ergebnis = true; P0.bump();
        const r2 = calc();
        say(r2.vd.text, r2.vd.gesamt === 'bestanden' ? 'info' : 'warn');
        return true;
      }
      return false;
    }

    // ---------------- Zeichnen ----------------
    const stSym = s => (s === 'ok' ? '✓' : (s === 'rot' || s === 'fehler') ? '✗' : s === 'entfaellt' ? '–' : '·');
    function stepStatus(r, step) {
      if (step === 'rpe' && r.sk !== 'I') return 'entfaellt';
      if (st.done.indexOf(step) < 0) return 'offen';
      const s = r.vd.steps.filter(q => q.id === step)[0];
      return !s ? 'offen' : s.status === 'ok' ? 'ok' : s.status === 'rot' ? 'fehler' : 'offen';
    }
    function layout(R0) {
      const narrow = R0.w < 560, chipH = 40, gap = 6, perRow = narrow ? 3 : 6, rows = Math.ceil(6 / perRow);
      const chipsH = rows * chipH + (rows - 1) * gap, readH = 40, bottomH = chipsH + 8 + readH;
      const top = { x: R0.x, y: R0.y, w: R0.w, h: Math.max(0, R0.h - bottomH - 6) };
      let dev = null, bench = null;
      if (!narrow) { dev = { x: top.x, y: top.y, w: Math.round(top.w * 0.36), h: top.h }; bench = { x: top.x + dev.w + 8, y: top.y, w: top.w - dev.w - 8, h: top.h }; }
      else if (top.h >= 290) { dev = { x: top.x, y: top.y, w: top.w, h: 132 }; bench = { x: top.x, y: top.y + 138, w: top.w, h: top.h - 138 }; }
      else bench = top;
      return { narrow, chipH, gap, perRow, chipsY: R0.y + R0.h - bottomH, readY: R0.y + R0.h - readH, readH, top, dev, bench };
    }
    function drawDevice(ctx, rc, r, sc) {
      const g = sc.gfx, pal = sc.pal, fs = sc.fs;
      g.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 10);
      g.text(ctx, r.d.name, rc.x + 10, rc.y + 18, { size: fs, bold: true, color: pal.fg, max: rc.w - 20 });
      g.text(ctx, 'Schutzklasse ' + r.sk + (r.sk === 'II' ? ' ▣' : ' ⏚') + ' · Tippe die Stellen an', rc.x + 10, rc.y + 18 + fs + 4, { size: fs - 1, color: pal.mute, max: rc.w - 20 });
      const by = rc.y + 18 + fs + 14, bh = rc.h - (18 + fs + 14) - 10;
      if (!(bh >= 70 && rc.w >= 150)) return;
      const bx = rc.x + rc.w * 0.42, bw = rc.w * 0.5, bt = by + bh * 0.1, bhh = bh * 0.55;
      const pos = { gehaeuse: [bx + bw / 2, bt + bhh / 2], leitung: [rc.x + rc.w * 0.24, by + bh * 0.62], stecker: [rc.x + rc.w * 0.1, by + bh * 0.9 - 14] };
      // Gehaeuse
      g.panel(ctx, bx, bt, bw, bhh, pal.panel2, pal.fg, 8);
      // Leitung
      g.line(ctx, [[bx, bt + bhh * 0.7], [rc.x + rc.w * 0.24, bt + bhh * 0.7], [rc.x + rc.w * 0.24, by + bh * 0.62], [rc.x + rc.w * 0.1 + 14, by + bh * 0.9 - 14]], pal.mute, 3);
      // Stecker
      g.panel(ctx, pos.stecker[0] - 14, pos.stecker[1] - 14, 28, 28, pal.panel2, pal.fg, 5);
      SPOTS.forEach(sp => {
        const done = st.inspected.indexOf(sp) >= 0, bad = done && r.faults.indexOf(SPOT_FAULT[sp]) >= 0;
        const cx = pos[sp][0], cy = pos[sp][1], col = !done ? pal.grau : bad ? pal.rot : pal.gruen;
        if (sp === 'gehaeuse' && bad) g.line(ctx, [[bx + bw * 0.55, bt], [bx + bw * 0.48, bt + bhh * 0.35], [bx + bw * 0.6, bt + bhh * 0.6], [bx + bw * 0.5, bt + bhh]], pal.rot, 2);
        const rr = 15;
        g.dot(ctx, cx, cy, rr, col);
        g.text(ctx, !done ? '?' : bad ? '!' : '✓', cx, cy + 1, { size: 14, bold: true, color: pal.theme === 'light' ? '#ffffff' : '#101418', align: 'center', base: 'middle' });
        const lx = sp === 'stecker' ? cx - 14 : sp === 'leitung' ? cx + 20 : bx + 6;
        const ly = sp === 'gehaeuse' ? bt + bhh + 16 : sp === 'leitung' ? cy : cy + 28;
        g.text(ctx, SPOT_NAME[sp] + (done ? (bad ? ': Mangel' : ': in Ordnung') : ''), lx, ly, { size: fs - 1, color: pal.fg, base: sp === 'leitung' ? 'middle' : 'alphabetic', max: rc.w - (lx - rc.x) - 6, bg: pal.panel });
        if (!sc.ghost) hl.push({ x: cx - 22, y: cy - 22, w: 44, h: 44, key: 'sicht_' + sp, kind: 'button' });
      });
    }
    function drawBench(ctx, rc, r, view, sc) {
      const g = sc.gfx, pal = sc.pal, fs = sc.fs, D = sc.D;
      let done = false;
      if (rc.w >= 260 && rc.h >= 140 && D && typeof D.benchScene === 'function') {
        try {
          const steps = STEPS.map(s => ({ id: s, status: stepStatus(r, s) }));
          done = !!D.benchScene(ctx, rc, { device: r.d.name, sk: r.sk, steps, reading: st.reading || '–', ampel: view.ampel.ampel }, { theme: sc.theme });
        } catch (e) { done = false; }
      }
      if (!done) {
        g.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 10);
        g.text(ctx, 'Prüfplatz: ' + r.d.name, rc.x + 10, rc.y + 20, { size: fs + 1, bold: true, color: pal.fg, max: rc.w - 20 });
        STEPS.forEach((s, i) => {
          const sts = stepStatus(r, s), col = sts === 'ok' ? pal.gruen : sts === 'fehler' ? pal.rot : pal.grau;
          g.text(ctx, (i + 1) + ' ' + STEP_NAME[s] + ': ' + (sts === 'ok' ? '✓ in Ordnung' : sts === 'fehler' ? '✗ Fehler' : sts === 'entfaellt' ? '– entfällt' : '· offen'), rc.x + 10, rc.y + 46 + i * (fs + 8), { size: fs, color: col === pal.grau ? pal.mute : col, max: rc.w - 20 });
        });
        g.text(ctx, 'Anzeige: ' + (st.reading || '–'), rc.x + 10, rc.y + 54 + 4 * (fs + 8), { size: fs, bold: true, color: pal.fg, max: rc.w - 20 });
      }
      if (rc.h >= 150) g.text(ctx, CORE.TEXTS.isoNurFrei, rc.x + 8, rc.y + rc.h - 6, { size: fs - 1, color: pal.mute, max: rc.w - 16, bg: pal.panel });
    }
    function draw(ctx, w, h, t, view, sc) {
      const R0 = sc.rect, pal = sc.pal, g = sc.gfx, r = view.res, fs = sc.fs;
      if (!sc.ghost) { hl = []; hlW = w; hlH = h; }
      if (!R0 || !(R0.w >= 220 && R0.h >= 200)) return;
      if (!r || r.ok === false) { g.text(ctx, (r && r.text) || '', R0.x + 10, R0.y + 24, { size: fs, color: pal.fg, max: R0.w - 20 }); return; }
      const L = layout(R0);
      if (L.dev && L.dev.h >= 120) drawDevice(ctx, L.dev, r, sc);
      if (L.bench && L.bench.h >= 60) drawBench(ctx, L.bench, r, view, sc);
      // Karten: Weiter + fuenf Schritte
      const cw = (R0.w - (L.perRow - 1) * L.gap) / L.perRow, sel = view.ctl.schritt;
      const items = [{ key: 'fire', label: 'Weiter: ' + STEP_SHORT[nextPending(r)], color: pal.schutz, on: false }].concat(STEPS.concat(['ergebnis']).map((s, i) => {
        const sts = s === 'ergebnis' ? (st.ergebnis ? (r.vd.gesamt === 'bestanden' ? 'ok' : r.vd.gesamt === 'nicht bestanden' ? 'fehler' : 'offen') : 'offen') : stepStatus(r, s);
        return { key: 'schritt', to: s, label: (i + 1) + ' ' + STEP_SHORT[s] + (s === 'rpe' && r.sk !== 'I' ? ' (entfällt)' : '') + ' ' + stSym(sts), color: sts === 'ok' ? pal.gruen : sts === 'fehler' ? pal.rot : pal.line, on: sel === s };
      }));
      items.forEach((it, i) => {
        const row = Math.floor(i / L.perRow), col = i % L.perRow, x = R0.x + col * (cw + L.gap), y = L.chipsY + row * (L.chipH + L.gap);
        g.chip(ctx, '', it.label, x, y, cw, L.chipH, pal, { color: it.color, on: it.on, size: fs });
        if (!sc.ghost) hl.push({ x, y, w: cw, h: L.chipH, key: it.key, to: it.to });
      });
      // Anzeigezeilen
      const dn = s => st.done.indexOf(s) >= 0, m = view.rig.readMeters();
      const parts = [];
      if (dn('rpe')) parts.push('R_PE ' + (m.rpe >= 5e5 ? 'über Messbereich' : fm(m.rpe, 3) + ' Ω'));
      if (dn('riso')) parts.push('R_iso ' + fm(m.riso, 1) + ' MΩ');
      if (dn('ipe')) parts.push((r.sk === 'II' ? 'Berührungsstrom ' : 'Schutzleiterstrom ') + fm(m.ipe, 3) + ' mA');
      g.text(ctx, r.d.name + ' · Schutzklasse ' + r.sk + ' · ' + (view.ctl.modus === 'instandsetzung' ? 'nach Instandsetzung' : 'Wiederholungsprüfung'), R0.x, L.readY + 14, { size: fs, color: pal.mute, max: R0.w });
      g.text(ctx, parts.length ? parts.join(' · ') : 'Noch keine Messwerte. ' + CORE.TEXTS.uebungProtokoll, R0.x, L.readY + 14 + fs + 6, { size: fs, bold: parts.length > 0, color: pal.fg, max: R0.w });
    }
    function hit(px, py, w, h) {
      if (!hl.length || !(hlW > 0) || !(hlH > 0)) return null;
      const qx = px * hlW / w, qy = py * hlH / h;
      for (let i = hl.length - 1; i >= 0; i--) {
        const q = hl[i];
        if (qx >= q.x && qx <= q.x + q.w && qy >= q.y && qy <= q.y + q.h) return q.to !== undefined ? { key: q.key, to: q.to } : { key: q.key, kind: q.kind || 'button' };
      }
      return null;
    }

    return {
      compute, meters, assess, diag, curves, draw, hit,
      phaseHz: () => 0.3,
      fire(r, ctl) {
        const r0 = calc(); if (!r0.ok) return false;
        const s = ctl.schritt;
        const ok = doStep(s);
        const r1 = calc();
        if (r1.ok) { const nx = nextPending(r1); if (nx !== ctl.schritt) P0.setCtl('schritt', nx); }
        return ok;
      },
      onButton(key) {
        if (key === 'fire') return false;
        const m = /^sicht_(leitung|stecker|gehaeuse)$/.exec(key);
        return m ? inspect(m[1]) : false;
      },
      onControl(key) { if (key === 'schritt' || key === 'modus' || key === '*') { if (key === '*') clearState(); return; } clearState(); P0.setCtl('schritt', 'sicht'); },
      reset() { clearState(); },
      state(r) {
        return { done: st.done.slice(), inspected: st.inspected.slice(), ergebnis: st.ergebnis, naechster: r && r.ok ? nextPending(r) : 'sicht', gesamt: r && r.ok ? r.vd.gesamt : 'unvollstaendig', rot: r && r.ok ? r.vd.steps.filter(q => q.status === 'rot').map(q => q.id) : [], faults: r && r.ok ? r.faults.slice() : [], sk: r && r.ok ? r.sk : '', anzeige: st.reading };
      },
      extend(api) {
        api.do = doStep;
        api.inspect = inspect;
        api.naechsterSchritt = () => { const r = calc(); return r.ok ? nextPending(r) : 'sicht'; };
        api.pruefling = () => { const r = calc(); return r.ok ? { id: r.dev.id, faults: r.dev.faults.slice(), seed: r.dev.seed } : null; };
        api.protokollWerte = () => {
          const r = calc(); if (!r.ok) return null;
          const mw = {};
          if (st.done.indexOf('rpe') >= 0) mw.rpe = r.meas.rpe;
          if (st.done.indexOf('riso') >= 0) mw.riso = r.meas.riso;
          if (st.done.indexOf('ipe') >= 0) mw[r.sk === 'II' ? 'ber' : 'ipe'] = r.sk === 'II' ? r.meas.ber : r.meas.ipe;
          const out = { geraet: r.d.name, schutzklasse: r.sk, pruefart: P0.ctl.modus === 'instandsetzung' ? 'nach Instandsetzung' : 'Wiederholungsprüfung', messwerte: mw,
            ergebnis: r.vd.gesamt === 'bestanden' || r.vd.gesamt === 'nicht bestanden' ? r.vd.gesamt : null, vollstaendig: r.vd.vollstaendig, dev: { id: r.dev.id, faults: r.dev.faults.slice(), seed: r.dev.seed } };
          if (st.done.indexOf('sicht') >= 0) out.sicht = r.meas.sicht.slice();
          return out;
        };
      }
    };
  }

  R.register({ id: 'pruefplatz', name: 'Prüfplatz Geräteprüfung', icon: '🧰',
    info: 'Prüfplatz für Übungsgeräte: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand und Strom in fester Reihenfolge, Urteil nach Grenzwert (Übungswerte, Status gekennzeichnet). Simulation, keine Anleitung für Arbeiten an Netzspannung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'pruefplatz', name: 'Prüfplatz Geräteprüfung', icon: '🧰', info: '', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: PARAMS, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
