'use strict';
/* Tonfunk Technisches-Englisch-Lab: Daten (Vokabeln, Aufgaben-Generatoren, Beispiele, Nachschlage-Tabellen).
   Alle Texte, Beispiele und Zahlen sind EIGENE Formulierungen für die Ausbildung (Quelle der Themen: Englischunterricht 2. und 3. Lehrjahr), keine Übernahme aus Arbeitsblättern.
   window.ENG_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, groups, vocab, ... }
   window.ENG_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'eng', Status in localStorage 'lm4.eng.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch den Fehler (Titel bleiben neutral, Fehler in Mails werden nicht angekündigt).
   Englische Texte nutzen englische Zahlenschreibweise (Dezimalpunkt, Tausenderkomma), deutsche Erklärungen deutsche. */
(function (root) {
  const C = () => root.ENG_CORE;
  const fe = (v, d) => C().fmtN(v, d == null ? 2 : d, true);     /* deutsch: 1.250,5 */
  const fen = (v, d) => C().fmtEnN(v, d == null ? 2 : d, true);  /* englisch: 1,250.5 */
  const CATS = ['Fachvokabeln', 'Datenblatt lesen', 'Warnhinweise und Anleitungen', 'Maßeinheiten und Zahlen', 'E-Mail und Anfrage', 'Telefon', 'False Friends', 'Stückliste und Lieferschein'];

  /* ============================================================ Vokabeln */
  const GROUPS = [['elek', 'Elektrik und Elektronik'], ['mech', 'Mechanik'], ['it', 'IT'], ['log', 'Logistik'], ['buero', 'Büro und Kaufmännisches'], ['sich', 'Arbeitssicherheit']];
  /* PRUEFEN P7: Welche Fachgruppe zu welchem Beruf gehört (Karten-Filter): Elektrik für Elektroniker und Industriemechaniker; Mechanik für Industriemechaniker, Produktdesigner, Elektroniker; IT für Fachinformatiker, Elektroniker, Industriekaufmann;
     Logistik für Lagerlogistik, Industriekaufmann, Industriemechaniker; Büro für Industriekaufmann, Lagerlogistik, Produktdesigner, Fachinformatiker; Arbeitssicherheit für alle. Passt das? */
  const GJ = { elek: ['egs', 'ige', 'im'], mech: ['im', 'tpd', 'egs', 'ige'], it: ['fi', 'egs', 'ik'], log: ['fll', 'ik', 'im'], buero: ['ik', 'fll', 'tpd', 'fi'], sich: ['egs', 'ige', 'im', 'tpd', 'fll', 'ik', 'fi'] };
  /* PRUEFEN P8: Fachwörter mit mehreren Übersetzungen: circuit breaker = Leitungsschutzschalter (auch Sicherungsautomat), RCD = Fehlerstrom-Schutzschalter, carrier = Frachtführer (freight forwarder = Spediteur),
     lockout = Freischalten und gegen Wiedereinschalten sichern, guard = Schutzeinrichtung, quotation = Angebot, order = Bestellung oder Auftrag. Stimmen diese Standardübersetzungen für euren Betrieb? */
  const V = {
    elek: ['resistor|Widerstand', 'capacitor|Kondensator', 'coil|Spule', 'diode|Diode', 'transistor|Transistor', 'fuse|Schmelzsicherung', 'circuit breaker|Leitungsschutzschalter', 'residual current device (RCD)|Fehlerstrom-Schutzschalter', 'switch|Schalter', 'relay|Relais', 'cable|Kabel', 'wire|Draht, Ader', 'plug|Stecker', 'socket|Steckdose, Buchse', 'terminal|Anschlussklemme', 'voltage|Spannung', 'current|Strom', 'power supply|Netzteil', 'earth (ground)|Erdung, Masse', 'soldering iron|Lötkolben', 'solder|Lot, löten', 'printed circuit board (PCB)|Leiterplatte', 'heat sink|Kühlkörper', 'oscilloscope|Oszilloskop', 'multimeter|Multimeter', 'short circuit|Kurzschluss', 'open circuit|Unterbrechung, offener Stromkreis', 'load|Last, Verbraucher', 'rated voltage|Nennspannung', 'circuit diagram|Schaltplan', 'insulation|Isolierung', 'battery|Batterie', 'rechargeable battery|Akku', 'sensor|Sensor, Fühler'],
    mech: ['screw|Schraube', 'bolt|Schraubenbolzen', 'nut|Mutter', 'washer|Unterlegscheibe', 'bearing|Lager', 'shaft|Welle', 'gear|Zahnrad', 'belt|Riemen', 'chain|Kette', 'spring|Feder', 'lathe|Drehmaschine', 'milling machine|Fräsmaschine', 'drill|Bohrer, Bohrmaschine', 'to grind|schleifen', 'to weld|schweißen', 'thread|Gewinde', 'tolerance|Toleranz', 'fit|Passung', 'hardness|Härte', 'stainless steel|Edelstahl', 'lubricant|Schmierstoff', 'seal|Dichtung', 'valve|Ventil', 'pump|Pumpe', 'cylinder|Zylinder', 'pressure|Druck', 'torque|Drehmoment', 'wrench (spanner)|Schraubenschlüssel', 'pliers|Zange', 'vice|Schraubstock', 'wear|Verschleiß', 'maintenance|Wartung, Instandhaltung', 'drawing|Zeichnung', 'assembly|Montage, Baugruppe'],
    it: ['hardware|Hardware', 'software|Software', 'network|Netzwerk', 'server|Server', 'router|Router', 'network switch|Netzwerk-Switch', 'password|Passwort', 'user account|Benutzerkonto', 'backup|Datensicherung', 'to install|installieren', 'update|Aktualisierung', 'to download|herunterladen', 'to upload|hochladen', 'memory (RAM)|Arbeitsspeicher', 'hard disk|Festplatte', 'keyboard|Tastatur', 'monitor|Bildschirm', 'firewall|Firewall', 'database|Datenbank', 'query|Abfrage', 'bug|Programmfehler', 'error message|Fehlermeldung', 'to log in|anmelden', 'to crash|abstürzen', 'bandwidth|Bandbreite', 'encryption|Verschlüsselung', 'license|Lizenz', 'data protection|Datenschutz', 'to restart|neu starten'],
    log: ['warehouse|Lagerhalle, Lager', 'pallet|Palette', 'forklift truck|Gabelstapler', 'shelf|Regal', 'goods receipt|Wareneingang', 'goods issue|Warenausgang', 'delivery note|Lieferschein', 'packing list|Packliste', 'shipment|Sendung', 'carrier|Frachtführer', 'freight forwarder|Spediteur', 'freight|Fracht', 'to load|beladen', 'to unload|entladen', 'tracking number|Sendungsnummer', 'stock|Lagerbestand', 'stocktaking|Inventur', 'order picking|Kommissionieren', 'lead time|Lieferzeit', 'dispatch|Versand', 'customs|Zoll', 'dangerous goods|Gefahrgut', 'lashing strap|Zurrgurt', 'loading ramp|Laderampe', 'damaged|beschädigt', 'shortage|Fehlmenge', 'back order|Nachlieferung', 'gross weight|Bruttogewicht', 'net weight|Nettogewicht'],
    buero: ['invoice|Rechnung', 'quotation|Angebot', 'inquiry|Anfrage', 'order|Bestellung, Auftrag', 'order confirmation|Auftragsbestätigung', 'supplier|Lieferant', 'customer|Kunde', 'price|Preis', 'discount|Rabatt', 'payment terms|Zahlungsbedingungen', 'due date|Fälligkeitsdatum', 'reminder|Mahnung', 'complaint|Reklamation, Beschwerde', 'warranty|Gewährleistung, Garantie', 'delivery date|Liefertermin', 'appointment|Termin', 'attachment|Anhang', 'to enclose|beifügen', 'deadline|Frist', 'VAT|Umsatzsteuer', 'net price|Nettopreis', 'gross price|Bruttopreis', 'contract|Vertrag', 'credit note|Gutschrift', 'to reply|antworten', 'bill of materials (BOM)|Stückliste'],
    sich: ['safety|Sicherheit', 'hazard|Gefahrenquelle', 'risk|Risiko', 'accident|Unfall', 'injury|Verletzung', 'first aid|Erste Hilfe', 'fire extinguisher|Feuerlöscher', 'emergency exit|Notausgang', 'safety goggles|Schutzbrille', 'hard hat|Schutzhelm', 'ear protection|Gehörschutz', 'protective gloves|Schutzhandschuhe', 'safety shoes|Sicherheitsschuhe', 'flammable|leicht entzündbar', 'toxic|giftig', 'corrosive|ätzend', 'high voltage|Hochspannung', 'electric shock|Stromschlag', 'lockout|Freischalten und Sichern gegen Wiedereinschalten', 'emergency stop|Not-Halt', 'guard|Schutzeinrichtung', 'slippery|rutschig', 'trip hazard|Stolpergefahr', 'assembly point|Sammelplatz', 'safety data sheet|Sicherheitsdatenblatt', 'to evacuate|räumen, evakuieren']
  };
  const VOCAB = [];
  GROUPS.forEach(g => V[g[0]].forEach(s => { const p = s.split('|'); VOCAB.push({ en: p[0], de: p[1], g: g[0], jobs: GJ[g[0]].slice() }); }));
  const groupName = k => (GROUPS.find(g => g[0] === k) || [k, k])[1];
  const cardsOf = keys => VOCAB.filter(c => keys.indexOf(c.g) >= 0);

  /* ============================================================ Bausteine für Fragen */
  const numQ = (text, value, unit, label, tol, expl, tips, doc) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, doc });
  function choiceQ(R, text, right, wrong, expl, tips, doc) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, doc };
  }
  /* Zeile für Zuordnungen/Lücken: Optionen werden gemischt, correct ist der Index der richtigen Option */
  function mrow(R, label, right, options) { const o = C().shuffle(R, options), ix = o.indexOf(right); return { label, options: o, correct: ix }; }
  const multiQ = (text, rows, expl, tips, doc) => ({ text, ask: { type: 'multi', rows }, value: rows.length, tol: 0, expl, tips, doc });
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], q[5] ? { title: q[5].title, lines: q[5].lines } : undefined); };

  /* Pool mit englischem Satz als Dokument: [Satz, Frage, richtig, falsch[], Erklärung, Tipps] */
  const pqi = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[1], q[2], q[3], q[4], q[5], { title: 'Instruction / label', lines: [q[0]] }); };

  /* ---------- Vokabel-Aufgaben ---------- */
  const vzu = (R, arg) => {
    const c = C(), pool = cardsOf(arg), seen = {}, pickd = [];
    c.shuffle(R, pool).forEach(k => { if (pickd.length < 4 && !seen[k.de]) { seen[k.de] = 1; pickd.push(k); } });
    const opts = pickd.map(k => k.de);
    return multiQ('Ordne jedem englischen Fachwort die richtige deutsche Bedeutung zu.', pickd.map(k => mrow(R, k.en, k.de, opts)),
      pickd.map(k => k.en + ' = ' + k.de).join('; ') + '.', ['Fange mit dem Wort an, das du sicher kennst, und streiche die Bedeutung gedanklich ab.', 'Manche Wörter erkennst du an deutschen Wörtern wieder (zum Beispiel „Diode“, „Relais“ oder „Hardware“).']);
  };
  const vtr = (R, arg) => {
    const c = C(), pool = cardsOf(arg), card = c.pick(R, pool), dir = R() < 0.5 ? 'en2de' : 'de2en', mc = c.makeChoices(R, VOCAB, card, dir, 4);
    const text = dir === 'en2de' ? 'Was bedeutet „' + card.en + '“ auf Deutsch (Arbeitssicherheit und Technik)?' : 'Wie heißt „' + card.de + '“ auf Englisch?';
    return { text, ask: { type: 'choice', choices: mc.choices, correct: mc.correct }, value: mc.correct, tol: 0, expl: card.en + ' = ' + card.de + '.', tips: ['Überlege, wo du das Wort in einer Anleitung oder an einem Schild schon gesehen hast.', 'Schließe zuerst die Antworten aus, die offensichtlich zu einem anderen Fachgebiet gehören.'] };
  };
  const GAPS = [
    { t: '[1] you open the housing, [2] the power cable from the socket. [3] that the device is switched off.', g: [['Before', 'After', 'Until', 'Without'], ['unplug', 'insert', 'tighten', 'print'], ['Ensure', 'Delay', 'Ignore', 'Order']], e: 'Before you open … (bevor du öffnest), unplug (Stecker ziehen), Ensure that … (stelle sicher, dass).' },
    { t: '[1] the screws with the correct torque. Do not [2] them. Check the seal [3] every use.', g: [['Tighten', 'Order', 'Delete', 'Transfer'], ['overtighten', 'overwrite', 'overpay', 'overbook'], ['after', 'since', 'until', 'against']], e: 'Tighten (festziehen), overtighten (überdrehen, zu fest anziehen), after every use (nach jeder Benutzung).' },
    { t: 'The delivery note shows 40 pieces, but only 38 [1]. Please send the [2] pieces [3] Friday.', g: [['arrived', 'arrive', 'arriving', 'are arrived'], ['missing', 'missed', 'lacking', 'mistaken'], ['by', 'since', 'for', 'during']], e: 'only 38 arrived (Vergangenheit), the missing pieces (die fehlenden Stücke), by Friday (bis spätestens Freitag).' },
    { t: 'Please [1] up your files before you [2] the new software. Then [3] the computer.', g: [['back', 'set', 'put', 'give'], ['install', 'installing', 'installed', 'to install'], ['restart', 'restarting', 'restarts', 'restarted']], e: 'back up (sichern), before you install (nach „before you“ folgt die Grundform), Then restart (Befehlsform).' }
  ];
  const vgap = (R, arg) => {
    const c = C(), tx = GAPS[arg && arg.length ? c.pick(R, arg) : c.ri(R, 0, GAPS.length - 1)], rows = tx.g.map((o, i) => mrow(R, 'Lücke ' + (i + 1), o[0], o));
    return multiQ('Ergänze den Text mit dem passenden Wort.', rows, tx.e, ['Lies den Satz mit jeder Option und achte auf die Form (Grundform, Vergangenheit, -ing).', 'Bei „before“ und „after“ gehört die Reihenfolge der Handlungen dazu.'], { title: 'Text', lines: [tx.t.replace(/\[(\d)\]/g, '[$1]')] });
  };

  /* ---------- Datenblatt ---------- */
  /* PRUEFEN P10: Der Datenblatt-Auszug (5-V-Linearregler) enthält frei gewählte Übungswerte (Eingangsspannung 30 bis 45 V, Ausgangsstrom 0,5 bis 2 A, Betriebstemperatur −40 bis 125 °C, Lagertemperatur bis −65 / 150 °C).
     "Operating temperature" wird vereinfacht als zulässige Umgebungstemperatur gelesen (nicht Sperrschichttemperatur). Passt das zum Lehrmaterial? */
  const GLOSS = [
    ['maximum ratings', 'Grenzwerte, die nie überschritten werden dürfen'], ['operating temperature', 'zulässiger Temperaturbereich im Betrieb'], ['storage temperature', 'zulässiger Temperaturbereich bei der Lagerung ohne Betrieb'],
    ['supply voltage', 'Versorgungsspannung des Bauteils'], ['forward current', 'Strom in Durchlassrichtung'], ['reverse voltage', 'Spannung in Sperrrichtung'], ['power dissipation', 'Verlustleistung, die als Wärme abgegeben wird'],
    ['tolerance', 'zulässige Abweichung vom Nennwert'], ['typical value (typ.)', 'üblicher Wert, der nicht garantiert ist'], ['rated current', 'Nennstrom, für den das Bauteil ausgelegt ist'], ['ambient temperature', 'Temperatur der Umgebung'],
    ['rise time', 'Anstiegszeit eines Signals'], ['unless otherwise specified', 'wenn nichts anderes angegeben ist'], ['ripple', 'Restwelligkeit auf einer Gleichspannung'], ['dropout voltage', 'kleinster Spannungsabstand zwischen Ein- und Ausgang eines Reglers']
  ];
  const dgloss = R => {
    const c = C(), g = c.pick(R, GLOSS), wrong = c.shuffle(R, GLOSS.filter(x => x !== g)).slice(0, 3).map(x => x[1]);
    return choiceQ(R, 'Was bedeutet „' + g[0] + '“ in einem Datenblatt?', g[1], wrong, g[0] + ' = ' + g[1] + '.', ['Zerlege den Begriff in seine Wörter und übersetze jedes einzeln.', 'Achte darauf, ob es um einen Grenzwert, einen Betriebswert oder eine Umgebungsgröße geht.']);
  };
  function sheetVals(R) {
    const c = C();
    return { vin: c.pick(R, [30, 35, 40, 45]), vmin: 4.8, vtyp: 5, vmax: 5.2, iout: c.pick(R, [0.5, 1, 1.5, 2]), ptot: c.pick(R, [1.5, 2, 5, 10]), tmin: c.pick(R, [-40, -25, 0]), tmax: c.pick(R, [70, 85, 105, 125]), smin: c.pick(R, [-65, -55, -40]), smax: c.pick(R, [125, 150]) };
  }
  function sheetDoc(v) {
    const n = x => C().fmtEn(x, 1, false), d = '–';
    return { title: 'Datasheet excerpt: linear voltage regulator, 5 V (Tamb = 25 °C unless otherwise specified)', head: ['Parameter', 'Symbol', 'Min', 'Typ', 'Max', 'Unit'], rows: [
      ['Input voltage', 'Vin', d, d, fen(v.vin, 0), 'V'], ['Output voltage', 'Vout', n(v.vmin), n(v.vtyp), n(v.vmax), 'V'], ['Output current', 'Iout', d, d, n(v.iout), 'A'], ['Power dissipation', 'Ptot', d, d, n(v.ptot), 'W'],
      ['Operating temperature', 'Topr', fen(v.tmin, 0), d, fen(v.tmax, 0), '°C'], ['Storage temperature', 'Tstg', fen(v.smin, 0), d, fen(v.smax, 0), '°C']] };
  }
  const SHEET_ASK = [
    { k: 'vin', de: 'die höchste zulässige Eingangsspannung (Input voltage, Max)', unit: 'V', get: v => v.vin, row: 'Input voltage', col: 'Max' },
    { k: 'vmax', de: 'die höchste Ausgangsspannung (Output voltage, Max)', unit: 'V', get: v => v.vmax, row: 'Output voltage', col: 'Max' },
    { k: 'iout', de: 'den höchsten Ausgangsstrom (Output current, Max)', unit: 'A', get: v => v.iout, row: 'Output current', col: 'Max' },
    { k: 'ptot', de: 'die höchste Verlustleistung (Power dissipation, Max)', unit: 'W', get: v => v.ptot, row: 'Power dissipation', col: 'Max' },
    { k: 'tmin', de: 'die niedrigste Betriebstemperatur (Operating temperature, Min)', unit: '°C', get: v => v.tmin, row: 'Operating temperature', col: 'Min' },
    { k: 'tmax', de: 'die höchste Betriebstemperatur (Operating temperature, Max)', unit: '°C', get: v => v.tmax, row: 'Operating temperature', col: 'Max' },
    { k: 'smax', de: 'die höchste Lagertemperatur (Storage temperature, Max)', unit: '°C', get: v => v.smax, row: 'Storage temperature', col: 'Max' }
  ];
  const dwert = R => {
    const c = C(), v = sheetVals(R), a = c.pick(R, SHEET_ASK), val = a.get(v);
    return numQ('Lies im Datenblatt-Auszug ' + a.de + ' ab.', val, a.unit, 'Wert', 0.01, 'In der Zeile „' + a.row + '“ steht in der Spalte „' + a.col + '“ der Wert ' + fen(val, 1) + ' ' + a.unit + ' (englische Schreibweise mit Punkt, auf Deutsch ' + fe(val, 1) + ' ' + a.unit + ').',
      ['Suche zuerst die Zeile mit dem Parameter, dann die Spalte (Min, Typ oder Max).', 'Die Einheit steht ganz rechts in der Zeile.'], sheetDoc(v));
  };
  const PNAMES = ['Input voltage', 'Output voltage', 'Output current', 'Power dissipation', 'Operating temperature', 'Storage temperature'];
  const dspalte = R => {
    const c = C(), v = sheetVals(R), t = c.ri(R, 0, 2); let text, right, why;
    if (t === 0) { text = 'Welcher Parameter wird in der Einheit A (Ampere) angegeben?'; right = 'Output current'; why = 'Nur der Ausgangsstrom hat die Einheit A.'; }
    else if (t === 1) { text = 'Welcher Parameter wird in der Einheit W (Watt) angegeben?'; right = 'Power dissipation'; why = 'Nur die Verlustleistung hat die Einheit W.'; }
    else { text = 'Für welchen Parameter gibt es einen typischen Wert (Spalte Typ)?'; right = 'Output voltage'; why = 'Nur in der Zeile Output voltage steht ein Wert in der Spalte Typ.'; }
    return choiceQ(R, text, right, c.shuffle(R, PNAMES.filter(x => x !== right)).slice(0, 3), why, ['Gehe die Spalte Unit beziehungsweise Typ von oben nach unten durch.', 'Es gibt genau eine Zeile, die passt.'], sheetDoc(v));
  };
  const TOL_NOM = [1, 2.2, 4.7, 10, 22, 47, 100, 220];
  const toler = R => {
    const c = C(); let nom, pct, mx, k = 0;
    do { nom = c.pick(R, TOL_NOM); pct = c.pick(R, [1, 2, 5, 10]); mx = nom * (1 + pct / 100); k++; } while (Math.abs(c.rd(mx, 2) - mx) > 1e-9 && k < 40);
    /* PRUEFEN P17: Toleranz als Prozent vom Nennwert (Widerstand ±5 %): größter Wert = Nennwert · (1 + p/100). Reicht das für die Ausbildung (ohne Temperaturbeiwert und Alterung)? */
    return numQ('Ein Widerstand ist mit „' + fen(nom, 1) + ' kΩ ±' + pct + ' %“ beschriftet. Wie groß kann der Widerstand höchstens sein? (Angabe in kΩ)', c.rd(mx, 2), 'kΩ', 'Größter Wert', 0.006,
      'Größter Wert = Nennwert · (1 + Toleranz / 100) = ' + fe(nom, 1) + ' kΩ · ' + fe(1 + pct / 100, 2) + ' = ' + fe(mx, 2) + ' kΩ. Der kleinste Wert wäre ' + fe(nom * (1 - pct / 100), 2) + ' kΩ.', ['±5 % heißt: bis zu 5 % darüber und bis zu 5 % darunter.', 'Rechne Nennwert mal (1 + Prozent / 100).']);
  };
  const dok = R => {
    const c = C(), v = sheetVals(R), X = c.pick(R, [v.tmin - 5, v.tmin, v.tmax - 5, v.tmax, v.tmax + 10, v.tmax + 20]), Y = c.pick(R, [v.vin - 5, v.vin, v.vin + 5, v.vin + 10]);
    const tOk = X >= v.tmin && X <= v.tmax, vOk = Y <= v.vin, ch = ['Yes, both values are within the limits.', 'No, the temperature is outside the range.', 'No, the input voltage is too high.', 'No, both values are outside the limits.'];
    const right = tOk && vOk ? ch[0] : !tOk && vOk ? ch[1] : tOk && !vOk ? ch[2] : ch[3];
    return { text: 'Du willst den Regler in einen Schaltschrank einbauen. Dort herrschen bis zu ' + fe(X, 0) + ' °C Umgebungstemperatur, und das Netzteil liefert bis zu ' + fe(Y, 0) + ' V Eingangsspannung. Darf der Regler so eingesetzt werden?',
      ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0,
      expl: 'Betriebstemperatur: ' + fe(v.tmin, 0) + ' bis ' + fe(v.tmax, 0) + ' °C, also ' + (tOk ? 'passt' : 'passt nicht') + ' für ' + fe(X, 0) + ' °C (die Grenzen selbst sind erlaubt). Höchste Eingangsspannung: ' + fe(v.vin, 0) + ' V, also ' + (vOk ? 'passt' : 'passt nicht') + ' für ' + fe(Y, 0) + ' V.',
      tips: ['Prüfe beide Werte getrennt gegen den Auszug.', 'Ein Wert genau auf der Grenze ist noch erlaubt.'], doc: sheetDoc(v) };
  };
  const DMAXQ = [
    ['Im Auszug steht unter „Maximum ratings“ eine Eingangsspannung von 35 V, empfohlen sind 7 bis 25 V. Wie nutzt du das Bauteil im normalen Betrieb?', 'Im empfohlenen Bereich; die 35 V sind eine Grenze, die nie überschritten werden darf', ['Bis 35 V, denn das ist der normale Arbeitsbereich', 'Mit mindestens 35 V, sonst arbeitet es nicht', 'Die Maximalwerte sind nur Richtwerte und dürfen kurz überschritten werden'], 'Maximum ratings sind Grenzwerte gegen Zerstörung, kein Arbeitspunkt. Im Betrieb gelten die empfohlenen Betriebsbedingungen (recommended operating conditions).', ['Ein Grenzwert ist keine Empfehlung.', 'Betrieb bedeutet: innerhalb der empfohlenen Werte.']],
    ['Für die Ausgangsspannung steht „Min 4.8 / Typ 5.0 / Max 5.2 V“. Welche Aussage stimmt?', 'Die Spannung liegt garantiert zwischen 4,8 V und 5,2 V; 5,0 V ist der übliche Wert', ['Die Spannung beträgt immer genau 5,0 V', 'Die Spannung kann bis 5,0 V sinken, dann ist das Bauteil defekt', 'Nur 5,2 V ist garantiert'], 'Min und Max sind garantierte Grenzen, Typ ist der übliche Wert, der aber nicht garantiert ist.', ['Welche Spalten sind garantiert?', 'Typ heißt „typical“, also „üblich“.']],
    ['In der Kopfzeile steht „Tamb = 25 °C unless otherwise specified“. Was heißt das?', 'Alle Werte gelten bei 25 °C Umgebungstemperatur, wenn nichts anderes dabeisteht', ['Das Bauteil darf nur bei 25 °C betrieben werden', 'Die Werte gelten nur, wenn die Temperatur nicht angegeben ist', 'Die Temperatur darf nie über 25 °C steigen'], '„Unless otherwise specified“ = „wenn nichts anderes angegeben ist“. Die Prüfbedingung steht in der Kopfzeile.', ['Übersetze „unless otherwise specified“ wörtlich.', 'Es geht um die Prüfbedingung der Tabelle, nicht um eine Betriebsgrenze.']],
    ['Unter einer Tabelle steht: „Stresses above the maximum ratings may cause permanent damage.“ Was bedeutet das?', 'Belastungen über den Grenzwerten können das Bauteil dauerhaft beschädigen', ['Über den Grenzwerten arbeitet das Bauteil nur langsamer', 'Das Bauteil erholt sich nach einer Überlastung immer wieder', 'Die Grenzwerte gelten nur für Prüfungen im Werk'], 'Stress = Belastung, permanent damage = bleibender Schaden.', ['Was heißt „permanent“?', '„May cause“ = „kann verursachen“.']],
    ['In einer Zeile steht Min „–“, Typ „10“, Max „12“. Was ist dort nicht angegeben?', 'Ein garantierter Mindestwert', ['Ein typischer Wert', 'Ein Höchstwert', 'Die Einheit'], 'Der Strich in der Spalte Min heißt: Es gibt keine Angabe für den kleinsten Wert.', ['Welche Spalte enthält den Strich?', 'Min steht für minimum, den kleinsten garantierten Wert.']],
    ['Ein Datenblatt nennt „Storage temperature −55 to 150 °C“. Du lagerst das Bauteil bei −20 °C im Karton. Wie ist das?', 'Erlaubt, −20 °C liegt im Lagerbereich', ['Nicht erlaubt, die Lagertemperatur darf nie negativ sein', 'Nur erlaubt, wenn das Bauteil dabei läuft', 'Nicht erlaubt, weil −20 °C unter der Betriebstemperatur liegt'], 'Die Lagertemperatur gilt für das ausgeschaltete Bauteil. −20 °C liegt zwischen −55 und 150 °C.', ['Storage = Lagerung, also ohne Betrieb.', 'Liegt −20 zwischen −55 und 150?']]
  ];

  /* ---------- Warnhinweise ---------- */
  /* PRUEFEN P9: Zuordnung der Beispiel-Warntexte zu den Signalwörtern nach der Regel aus engcore.js (P5): Stromschlag mit Todesfolge unmittelbar = DANGER, Quetschen/Brand/Druckluft in die Augen = WARNING,
     heißes Gehäuse/Schnittkante/Späne = CAUTION, Beschädigung des Geräts = NOTICE. Sind die Einstufungen so im Unterricht richtig? */
  const WARN = [
    { en: 'Live parts behind this cover. Touching them will cause death by electric shock.', de: 'Spannungsführende Teile hinter dieser Abdeckung. Berühren führt zum Tod durch Stromschlag.', injury: 'serious', imminent: true },
    { en: 'Moving parts can crush your hand. Switch off and lock the machine before cleaning.', de: 'Bewegte Teile können deine Hand quetschen. Vor dem Reinigen die Maschine ausschalten und sichern.', injury: 'serious', imminent: false },
    { en: 'The housing may be hot after operation. Let it cool down to avoid burns.', de: 'Das Gehäuse kann nach dem Betrieb heiß sein. Abkühlen lassen, um Verbrennungen zu vermeiden.', injury: 'minor', imminent: false },
    { en: 'Do not use cleaning agents with solvents. They can damage the plastic surface.', de: 'Keine Reinigungsmittel mit Lösungsmitteln verwenden. Lösungsmittel können die Kunststoffoberfläche beschädigen.', injury: 'none', imminent: false },
    { en: 'Overheated batteries can start a fire that may result in serious injury.', de: 'Überhitzte Akkus können einen Brand auslösen, der zu schweren Verletzungen führen kann.', injury: 'serious', imminent: false },
    { en: 'Wear safety goggles. Flying chips can cause minor eye irritation.', de: 'Schutzbrille tragen. Herumfliegende Späne können leichte Augenreizungen verursachen.', injury: 'minor', imminent: false },
    { en: 'Do not exceed 24 V. A higher voltage may destroy the device.', de: 'Keine höhere Spannung als 24 V anlegen. Eine höhere Spannung kann das Gerät zerstören.', injury: 'none', imminent: false },
    { en: 'Hazardous voltage. Contact will cause severe injury or death. Disconnect power before opening.', de: 'Gefährliche Spannung. Berührung führt zu schwerer Verletzung oder Tod. Vor dem Öffnen die Spannung abschalten.', injury: 'serious', imminent: true },
    { en: 'Sharp edges. You may cut your fingers slightly. Wear gloves.', de: 'Scharfe Kanten. Du kannst dich leicht an den Fingern schneiden. Handschuhe tragen.', injury: 'minor', imminent: false },
    { en: 'Keep the vents free. Blocked vents can cause the unit to overheat.', de: 'Lüftungsschlitze freihalten. Blockierte Schlitze können das Gerät überhitzen.', injury: 'none', imminent: false },
    { en: 'Compressed air can throw particles at high speed and may cause serious eye injury. Never point the nozzle at people.', de: 'Druckluft kann Teilchen mit hoher Geschwindigkeit wegschleudern und kann schwere Augenverletzungen verursachen. Die Düse nie auf Personen richten.', injury: 'serious', imminent: false },
    { en: 'Toxic gas escapes when the valve is opened. Breathing it causes death within minutes.', de: 'Beim Öffnen des Ventils tritt giftiges Gas aus. Einatmen führt innerhalb von Minuten zum Tod.', injury: 'serious', imminent: true }
  ];
  WARN.forEach(w => { w.sig = C().signalFor(w); });
  const SIGW = () => C().SIGNALS.map(s => s.w);
  const sigRule = w => C().SIGNALS.find(s => s.w === w).rule;
  const wsig = R => {
    const c = C(), w = c.pick(R, WARN);
    return { text: 'Welches Signalwort gehört vor diesen Warnhinweis?', ask: { type: 'choice', choices: SIGW(), correct: SIGW().indexOf(w.sig) }, value: SIGW().indexOf(w.sig), tol: 0, expl: w.sig + ' (' + c.SIGNALS.find(s => s.w === w.sig).de + '): ' + sigRule(w.sig) + ' Übersetzung des Hinweises: ' + w.de, tips: ['Frage dich: Was kann im schlimmsten Fall passieren, und wie nah ist die Gefahr?', 'Nur ein Sachschaden ohne Verletzung gehört zu NOTICE.'], doc: { title: 'Label', lines: [w.en] } };
  };
  const wtrans = R => {
    const c = C(), w = c.pick(R, WARN), wrong = c.shuffle(R, WARN.filter(x => x !== w)).slice(0, 3).map(x => x.de);
    return choiceQ(R, 'Wie lautet dieser Warnhinweis auf Deutsch?', w.de, wrong, w.en + ' = ' + w.de, ['Achte auf Wörter wie „may“ (kann), „will“ (wird) und „never“ (nie).', 'Die Zahlen und Einheiten im Text helfen dir bei der Zuordnung.'], { title: 'Label', lines: [w.en] });
  };
  const wmulti = R => {
    const c = C(), ws = c.shuffle(R, WARN).slice(0, 4);
    return multiQ('Ordne jedem Warnhinweis das passende Signalwort zu.', ws.map((w, i) => mrow(R, 'Hinweis ' + (i + 1), w.sig, SIGW())),
      ws.map((w, i) => 'Hinweis ' + (i + 1) + ': ' + w.sig + ' (' + w.de + ')').join(' '), ['Sortiere zuerst: Gibt es eine Verletzung oder nur einen Sachschaden?', 'Bei schwerer Verletzung entscheidet, ob die Gefahr unmittelbar ist (DANGER) oder nur möglich (WARNING).'], { title: 'Warnhinweise', lines: ws.map((w, i) => (i + 1) + ') ' + w.en), numbered: false });
  };
  const ANLQ = [
    ['Before cleaning, unplug the device from the mains.', 'Wann ziehst du den Netzstecker?', 'Bevor du reinigst', ['Nachdem du gereinigt hast', 'Während du reinigst', 'Nur, wenn das Gerät nass ist'], '„Before cleaning“ = vor dem Reinigen. Das Netz (the mains) wird zuerst getrennt.', ['Was heißt „before“?', 'Der Stecker kommt zuerst raus.']],
    ['Do not operate the machine until the guard is in place.', 'Wann darfst du die Maschine betreiben?', 'Erst wenn die Schutzeinrichtung montiert ist', ['Solange die Schutzeinrichtung montiert ist', 'Nur, wenn die Schutzeinrichtung fehlt', 'Sobald der Strom angeschlossen ist'], '„Do not … until …“ = nicht … bevor/solange nicht. Erst mit montierter Schutzeinrichtung (guard in place).', ['„until“ heißt „bis“.', '„in place“ = an Ort und Stelle.']],
    ['Allow the unit to cool down for at least ten minutes after use.', 'Was sollst du nach der Benutzung tun?', 'Mindestens zehn Minuten warten, bis das Gerät abgekühlt ist', ['Das Gerät sofort verpacken', 'Das Gerät höchstens zehn Minuten benutzen', 'Das Gerät zehn Minuten vorwärmen'], 'To cool down = abkühlen, at least = mindestens.', ['„cool down“ ist das Gegenteil von „heat up“.', '„at least“ heißt „mindestens“.']],
    ['Tighten the screws to 5 Nm. Do not overtighten.', 'Was ist hier verboten?', 'Die Schrauben zu fest anzuziehen', ['Die Schrauben anzuziehen', 'Die Schrauben mit 5 Nm anzuziehen', 'Die Schrauben zu lösen'], 'Overtighten = überdrehen, zu fest anziehen. 5 Nm ist das vorgegebene Anzugsdrehmoment.', ['Die Vorsilbe „over-“ bedeutet „zu viel“.', 'Wie viel Nm sollst du erreichen?']],
    ['Replace the fuse only with one of the same rating.', 'Welche Sicherung darfst du einsetzen?', 'Eine mit demselben Nennwert', ['Irgendeine, die passt', 'Eine mit höherem Nennwert', 'Gar keine'], '„Rating“ = Nennwert, „same“ = gleich.', ['Was heißt „only“?', 'Rating = Nennwert (zum Beispiel 2 A).']],
    ['If the red LED flashes, switch off the device and contact service.', 'Was tust du bei blinkender roter LED?', 'Gerät ausschalten und den Service verständigen', ['Gerät weiter benutzen und beobachten', 'Die LED abdecken', 'Gerät neu starten und den Service nur bei zweimaligem Blinken verständigen'], '„If“ leitet die Bedingung ein, die zwei Handlungen sind: switch off und contact service.', ['Welche zwei Befehle stehen hinter dem Komma?', '„contact“ = kontaktieren.']]
  ];
  const WVERB = [
    ['Never operate the machine without the guard.', 'Was bedeutet der Satz?', 'Ohne Schutzeinrichtung darf die Maschine nie laufen', ['Die Maschine darf nur ohne Schutzeinrichtung laufen', 'Die Schutzeinrichtung ist bei vorsichtigem Arbeiten nicht nötig', 'Die Schutzeinrichtung darf nachts fehlen'], '„Never … without …“ = nie … ohne …. Das Verbot gilt immer.', ['„without“ heißt „ohne“.', '„never“ lässt keine Ausnahme zu.']],
    ['Do not use if the cable is damaged.', 'Wann darfst du das Gerät nicht benutzen?', 'Wenn das Kabel beschädigt ist', ['Wenn das Kabel unbeschädigt ist', 'Wenn es kein Kabel gibt', 'Wenn das Gerät nass ist'], '„If“ nennt die Bedingung für das Verbot: kaputtes Kabel (damaged).', ['Was heißt „damaged“?', 'Lies den Satz als „Benutze nicht, wenn …“.']],
    ['Use only in dry rooms.', 'Was gilt?', 'Das Gerät darf nur in trockenen Räumen benutzt werden', ['Das Gerät darf nur in feuchten Räumen benutzt werden', 'Das Gerät darf nie in Räumen benutzt werden', 'Das Gerät muss nach dem Benutzen getrocknet werden'], '„Only“ = nur, „dry“ = trocken.', ['Das Gegenteil von „dry“ ist „wet“.', '„only“ schränkt ein.']],
    ['Do not switch on until all covers are closed.', 'Wann darfst du einschalten?', 'Erst wenn alle Abdeckungen geschlossen sind', ['Solange alle Abdeckungen geschlossen sind, aber nicht danach', 'Bevor du die Abdeckungen schließt', 'Nie, wenn Abdeckungen vorhanden sind'], '„Do not … until …“ = nicht … bevor/solange noch nicht. Erst nach dem Schließen darfst du einschalten.', ['„until“ = „bis“ oder „bevor“ in Verbindung mit „not“.', 'Was muss vor dem Einschalten passieren?']],
    ['Only qualified personnel may open this unit.', 'Wer darf das Gerät öffnen?', 'Nur Fachpersonal', ['Jeder, der Werkzeug hat', 'Niemand, auch nicht der Service', 'Nur der Hersteller darf es per Post öffnen'], 'Qualified personnel = qualifiziertes Fachpersonal. „May“ steht hier für „darf“.', ['„may“ heißt hier „darf“.', '„personnel“ = Personal.']],
    ['Failure to follow these instructions may result in injury.', 'Was bedeutet der Satz?', 'Wenn du die Anweisungen nicht befolgst, kannst du dich verletzen', ['Wenn du dich verletzt, hast du die Anweisungen befolgt', 'Die Anweisungen führen immer zu Verletzungen', 'Die Anweisungen sind nur für Verletzte'], '„Failure to follow“ = Nichtbeachtung, „may result in“ = kann zur Folge haben.', ['„failure“ heißt hier „Versäumnis“, nicht „Misserfolg“.', '„may result in“ = „kann führen zu“.']]
  ];
  /* ---------- Zahlen und Einheiten ---------- */
  const ZVALS = ['1,250.5', '2,500', '0.75', '12,345.67', '1,000,000', '3.14', '45,000', '0.005'];
  const zahlen = R => {
    const c = C(), s = c.pick(R, ZVALS), v = c.parseNum(s, 'en'), grouped = s.indexOf(',') >= 0, deg = x => c.convertNotation(c.fmtEnN(x, 6, true), 'en', 'de'), rightS = deg(v), cand = [];
    if (grouped) cand.push(v / 1000);
    [10, 0.1, 100, 0.01].forEach(m => cand.push(c.rd(v * m, 6)));
    const out = []; cand.forEach(x => { const t = deg(x); if (t !== rightS && out.indexOf(t) < 0 && out.length < 3) out.push(t); });
    return choiceQ(R, 'In einem englischen Datenblatt steht „' + s + '“. Welche Zahl ist das in deutscher Schreibweise?', rightS, out, '„' + s + '“ ist englisch geschrieben: Komma = Tausendertrenner, Punkt = Dezimalzeichen. Auf Deutsch: ' + c.convertNotation(s, 'en', 'de') + '.', ['Im Englischen trennt das Komma die Tausender.', 'Im Deutschen ist es genau umgekehrt.']);
  };
  const umr = R => {
    const c = C(), t = c.ri(R, 0, 2);
    if (t === 0) { const x = c.pick(R, [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12]), v = c.rd(x * 25.4, 1); return numQ('In einem englischen Datenblatt steht eine Länge von ' + fen(x, 1) + ' in (inch). Wie viel ist das in mm? (eine Nachkommastelle)', v, 'mm', 'Länge', 0.06, '1 in = 25,4 mm. ' + fe(x, 1) + ' · 25,4 = ' + fe(v, 1) + ' mm.', ['1 inch sind 25,4 mm.', 'Multipliziere die Zahl mit 25,4.']); }
    if (t === 1) { const x = c.pick(R, [5, 10, 20, 25, 50, 100, 150]), v = c.rd(c.conv(x, 'lb', 'kg'), 1); return numQ('Eine Verpackung wiegt ' + fen(x, 0) + ' lb (pounds). Wie viel ist das in kg? (eine Nachkommastelle)', v, 'kg', 'Masse', 0.06, '1 lb = 0,4536 kg. ' + fe(x, 0) + ' · 0,4536 = ' + fe(v, 1) + ' kg.', ['1 pound sind etwa 0,454 kg.', 'Multipliziere die Zahl mit 0,4536.']); }
    const x = c.pick(R, [15, 30, 50, 60, 100, 145]), v = c.rd(c.conv(x, 'psi', 'bar'), 2);
    return numQ('Ein Druckluftschlauch ist für ' + fen(x, 0) + ' psi zugelassen. Wie viel ist das in bar? (zwei Nachkommastellen)', v, 'bar', 'Druck', 0.02, '1 psi = 0,0689 bar. ' + fe(x, 0) + ' · 0,0689 = ' + fe(v, 2) + ' bar.', ['1 psi sind etwa 0,069 bar.', 'Multipliziere die Zahl mit 0,0689.']);
  };
  const temp = R => {
    const c = C(), cel = c.pick(R, [-40, -20, 0, 20, 25, 40, 60, 85, 100, 125]), far = c.cToF(cel);
    if (R() < 0.5) return numQ('Ein Bauteil darf bis ' + fen(cel, 0) + ' °C betrieben werden. Wie viel ist das in °F?', far, '°F', 'Temperatur', 0.5, '°F = °C · 1,8 + 32 = ' + fe(cel, 0) + ' · 1,8 + 32 = ' + fe(far, 0) + ' °F.', ['Erst mal 1,8 (oder 9/5), dann plus 32.', 'Bei 0 °C sind es 32 °F.']);
    return numQ('Ein amerikanisches Datenblatt nennt eine Betriebsgrenze von ' + fen(far, 0) + ' °F. Wie viel ist das in °C?', cel, '°C', 'Temperatur', 0.5, '°C = (°F − 32) / 1,8 = (' + fe(far, 0) + ' − 32) / 1,8 = ' + fe(cel, 0) + ' °C.', ['Erst 32 abziehen, dann durch 1,8 teilen.', '32 °F sind 0 °C.']);
  };
  const SAG = ['0.05', '3.5', '12.75', '0.005', '1,200', '2.25', '40,000', '0.6'];
  const sag = R => {
    const c = C(), s = c.pick(R, SAG), right = c.sayNumber(s), wrong = c.shuffle(R, SAG.filter(x => x !== s)).slice(0, 3).map(x => c.sayNumber(x));
    return choiceQ(R, 'Wie sprichst du „' + s + '“ am Telefon aus?', right, wrong, s + ' = „' + right + '“. Der Punkt wird „point“ gesprochen, die Nachkommastellen einzeln, die Null als „zero“.', ['Der Dezimalpunkt heißt „point“.', 'Nach dem Punkt sprichst du jede Ziffer einzeln.']);
  };
  /* PRUEFEN P16: "billion" = 10^9 (Milliarde), "trillion" = 10^12 (Billion). Dies gilt im modernen Englisch (auch britisch). Ältere britische Bücher nutzen "billion" für 10^12. Soll das erwähnt werden? */
  const ZEINHQ = [
    ['Ein englischer Text nennt „one billion euros“. Wie viel ist das?', 'Eine Milliarde Euro (1.000.000.000)', ['Eine Billion Euro (1.000.000.000.000)', 'Eine Million Euro (1.000.000)', 'Hundert Millionen Euro'], '„billion“ ist im Englischen die Milliarde, nicht die deutsche Billion. Die deutsche Billion heißt „trillion“.', ['Falsche Freunde gibt es auch bei Zahlen.', 'Die deutsche Billion hat zwölf Nullen.']],
    ['Ein Kondensator trägt die Angabe „4.7 µF“. Was bedeutet das µ (micro)?', 'Ein Millionstel (10 hoch minus 6)', ['Ein Tausendstel (10 hoch minus 3)', 'Ein Milliardstel (10 hoch minus 9)', 'Eine Million (10 hoch 6)'], 'Micro steht für 10⁻⁶. 4,7 µF sind 0,0000047 F.', ['Milli ist 10⁻³, nano ist 10⁻⁹.', 'Micro liegt dazwischen.']],
    ['Ein Datenblatt nennt einen Widerstand mit „2.2 MΩ“. Wie viel Ohm sind das?', '2.200.000 Ω', ['2.200 Ω', '22.000 Ω', '2.200.000.000 Ω'], 'Mega steht für 10⁶. 2,2 · 1.000.000 = 2.200.000 Ω.', ['Mega ist eine Million.', 'Ein Großbuchstabe M bedeutet Mega, ein kleines m bedeutet milli.']],
    ['Wie heißt die deutsche „Billion“ (10 hoch 12) auf Englisch?', 'one trillion', ['one billion', 'one million million million', 'one thousand billion billion'], 'Trillion = 10¹². Das englische „billion“ ist dagegen nur 10⁹.', ['Das englische „billion“ ist kleiner.', 'Die Reihe: million, billion, trillion.']],
    ['Auf einer Bestellung steht „half a dozen screws“. Wie viele Schrauben sind das?', '6', ['12', '3', '60'], 'A dozen = 12, half a dozen = 6.', ['Ein Dutzend sind 12.', '„half“ heißt „halb“.']],
    ['Wie schreibst du „ten thousand“ in englischer Zahlenschreibweise?', '10,000', ['10.000 (das wäre englisch zehn)', '1,000', '100,000'], 'Ten thousand = 10,000 (mit Tausenderkomma). In deutscher Schreibweise 10.000.', ['Thousand = Tausend.', 'Das Komma trennt im Englischen die Tausender.']]
  ];
  /* ---------- E-Mail ---------- */
  /* PRUEFEN P12: Britische Briefformeln: unbekannter Empfänger "Dear Sir or Madam" … "Yours faithfully"; bekannter Name "Dear Mr Brown" … "Yours sincerely" (modern auch "Kind regards"); "Mr" ohne Punkt.
     "by Friday" = bis spätestens Freitag (Frist), "until Friday" = durchgehend bis Freitag. Entspricht das dem Unterricht (oder wird amerikanisch "Sincerely" und "Mr." unterrichtet)? */
  /* PRUEFEN P13: Als Fehler gelten: "reclamation" (falscher Freund, richtig "complaint"), "actual" (richtig "current"), "became" (richtig "received"), "look forward to hear" (richtig "hearing"), "have ordered … last month" (richtig "ordered"). Gibt es weitere Fehler, die bei euren Azubis oft vorkommen? */
  const MAILS = [
    { subj: 'Request for quotation', lines: ['Dear Sir or Madam,', 'We are looking for a supplier of stainless steel screws (M6 and M8).', 'Could you please send us your actual price list?', 'We would also like a quotation for 5,000 pieces of each size.', 'Please let us know the delivery time and your payment terms.', 'Yours faithfully,'], err: 2, fix: 'Could you please send us your current price list?', why: '„actual“ heißt „tatsächlich“, nicht „aktuell“. „Aktuell“ heißt „current“.' },
    { subj: 'Defective power supplies', lines: ['Dear Mr Brown,', 'On 12 March we received your delivery of 40 power supplies (order no. 4711).', 'Unfortunately five of the units are defective and do not work.', 'We would like to make a reclamation.', 'Please send us replacement units by Friday.', 'Yours sincerely,'], err: 3, fix: 'We would like to make a complaint.', why: '„Reklamation“ heißt auf Englisch „complaint“. „Reclamation“ bedeutet etwas anderes (Rückgewinnung, zum Beispiel von Land).' },
    { subj: 'Order confirmation', lines: ['Dear Ms Taylor,', 'Thank you for your quotation of 5 June.', 'We would like to place an order for 200 pieces at the quoted price.', 'Please confirm the delivery date.', 'I look forward to hear from you.', 'Kind regards,'], err: 4, fix: 'I look forward to hearing from you.', why: 'Nach „look forward to“ steht die -ing-Form („hearing“), weil „to“ hier eine Präposition ist.' },
    { subj: 'Missing pallets', lines: ['Dear Sir or Madam,', 'We have ordered 50 pallets of cardboard boxes last month.', 'The delivery note shows 48 pallets, but only 46 arrived.', 'Could you please check this?', 'We need the missing pallets by next Monday.', 'Yours faithfully,'], err: 1, fix: 'We ordered 50 pallets of cardboard boxes last month.', why: 'Mit „last month“ (abgeschlossene Zeit) steht die einfache Vergangenheit („ordered“), nicht das Present Perfect.' },
    { subj: 'Payment reminder', lines: ['Dear Mr Hill,', 'According to our records, invoice no. 2045 of 3 May is still unpaid.', 'Please transfer the amount until the end of this week.', 'If you have already paid, please ignore this reminder.', 'Should you have any questions, do not hesitate to contact us.', 'Kind regards,'], err: 2, fix: 'Please transfer the amount by the end of this week.', why: 'Bei einer Frist („bis spätestens“) steht „by“. „Until“ bedeutet „die ganze Zeit bis“.' },
    { subj: 'Quotation for hydraulic cylinders', lines: ['Hi Mr Brown,', 'Thank you for your inquiry about our hydraulic cylinders.', 'Please find attached our quotation.', 'The prices are net, excluding VAT.', 'The delivery time is about three weeks after receipt of order.', 'Kind regards,'], err: 0, fix: 'Dear Mr Brown,', why: 'Eine geschäftliche Mail an einen Kunden beginnt formell mit „Dear …“, nicht mit „Hi“.' },
    { subj: 'Plant visit', lines: ['Dear Ms Novak,', 'I would like to arrange a visit to your plant next month.', 'Wednesday is okay for you?', 'If not, I can also come on Thursday.', 'Please send me a short confirmation by e-mail.', 'Yours sincerely,'], err: 2, fix: 'Would Wednesday be convenient for you?', why: 'Eine höfliche Frage braucht die Fragewortstellung („Would Wednesday be …?“) und eine formelle Wortwahl, nicht „okay“.' },
    { subj: 'Your offer', lines: ['Dear Sir or Madam,', 'We became your offer yesterday and thank you for it.', 'Unfortunately the price is higher than expected.', 'Could you offer us a discount for larger quantities?', 'We look forward to your reply.', 'Yours faithfully,'], err: 1, fix: 'We received your offer yesterday and thank you for it.', why: '„become“ heißt „werden“. „Bekommen“ heißt „get“ oder „receive“.' }
  ];
  const mfehl = (R, arg) => {
    const c = C(), m = MAILS[c.pick(R, arg)];
    const ch = m.lines.map((l, i) => 'Zeile ' + (i + 1) + ': ' + l);
    return { text: 'Du liest diese E-Mail vor dem Senden Korrektur. In genau einer Zeile steckt ein sprachlicher oder inhaltlicher Fehler. Welche Zeile ist es?', ask: { type: 'choice', choices: ch, correct: m.err }, value: m.err, tol: 0,
      expl: 'Fehler in Zeile ' + (m.err + 1) + ': „' + m.lines[m.err] + '“. Besser: „' + m.fix + '“. ' + m.why, tips: ['Lies jede Zeile einzeln und frage dich: Würde ein englischer Geschäftspartner das so schreiben?', 'Achte auf falsche Freunde, Zeitformen und den Ton (formell oder locker).'], doc: { title: 'E-mail, Subject: ' + m.subj, lines: m.lines, numbered: true } };
  };
  const FORMPAIRS = [
    ['I look forward to hearing from you.', "Can't wait to hear from you!"], ['Could you please send us the price list?', 'Send me the price list ASAP.'], ['Thank you for your prompt reply.', 'Thx for the quick reply.'],
    ['We regret to inform you that the item is out of stock.', 'Sorry, but we have no stock!'], ['Dear Mr Brown,', 'Hey Brown,'], ['Please find attached the drawing.', "Here's the drawing."],
    ['I would be grateful if you could confirm the date.', 'Pls confirm the date.'], ['Kind regards', 'Cheers'], ['We apologise for the delay.', 'Sorry, we are late!']
  ];
  const mform = R => {
    const c = C(), fp = c.pick(R, FORMPAIRS), wrong = c.shuffle(R, FORMPAIRS.filter(p => p !== fp)).slice(0, 3).map(p => p[1]);
    return choiceQ(R, 'Welcher Satz passt in eine formelle Geschäfts-Mail an einen Lieferanten?', fp[0], wrong, '„' + fp[0] + '“ ist höflich und formell. Die anderen Sätze sind locker (Kurzformen, Abkürzungen wie „Pls“ oder „Thx“, Ausrufezeichen, „Hey“, „Cheers“) und passen eher zu Freunden.', ['Formell: keine Kurzformen, keine Abkürzungen, keine Ausrufezeichen.', 'Höfliche Formeln wie „Could you please …“ oder „I would be grateful if …“ sind typisch.']);
  };
  const MGAP = [
    { t: 'Dear Sir or Madam, we ordered 100 relays [1] 3 March. The goods [2] a week late, and ten relays were [3]. We therefore ask you to send a [4] delivery.', g: [['on', 'in', 'at', 'by'], ['arrived', 'arrive', 'arriving', 'are arrived'], ['defective', 'defect', 'defected', 'defecting'], ['replacement', 'reclamation', 'remplacement', 'replace']], e: 'on 3 March (Datum), arrived (Vergangenheit), defective (defekt, Adjektiv), replacement delivery (Ersatzlieferung).' },
    { t: 'Dear Mr Hill, we are writing to [1] about the invoice. The amount is [2] than agreed in our order. Please send us a corrected invoice or a credit [3] as soon as [4].', g: [['complain', 'complaint', 'complained', 'reclaim'], ['higher', 'more high', 'highly', 'height'], ['note', 'card', 'bill', 'paper'], ['possible', 'possibly', 'possibility', 'possibilities']], e: 'to complain about (sich beschweren über), higher than (höher als), credit note (Gutschrift), as soon as possible (so bald wie möglich).' },
    { t: 'Dear Sir or Madam, we would [1] to receive a quotation for 50 sensors. Please [2] the price per unit and the delivery time. We [3] forward to hearing from you [4].', g: [['like', 'likes', 'liking', 'liked'], ['state', 'statement', 'stated', 'stating'], ['look', 'wait', 'hope', 'expect'], ['soon', 'early', 'fastly', 'lately']], e: 'would like to (möchten gern), state (angeben), look forward to (sich freuen auf), soon (bald).' }
  ];
  const mgap = (R, arg) => {
    const c = C(), tx = MGAP[c.pick(R, arg)], rows = tx.g.map((o, i) => mrow(R, 'Lücke ' + (i + 1), o[0], o));
    return multiQ('Ergänze die Mail mit dem passenden Wort in jeder Lücke.', rows, tx.e, ['Prüfe Präposition, Zeitform und Wortart der Lücke.', 'Falsche Freunde wie „reclamation“ sind oft als Falle dabei.'], { title: 'E-mail', lines: [tx.t] });
  };
  /* ---------- Telefon ---------- */
  /* PRUEFEN P14: Telefon-Phrasen sind neutrales, höfliches Geschäftsenglisch (britisch geprägt: "I am afraid", "put you through", "take a message"). Passen Wortwahl und Höflichkeitsgrad zu dem, was im Unterricht geübt wird? */
  const TEL = [
    ['Du meldest dich in der Firma.', 'Good morning, Technical Support, how can I help you?'], ['Du möchtest jemanden aus dem Vertrieb sprechen.', 'Could I speak to someone in the sales department, please?'], ['Du verbindest den Anrufer weiter.', 'One moment, please. I will put you through.'],
    ['Der Kollege ist nicht am Platz.', 'I am afraid he is not at his desk at the moment. Can I take a message?'], ['Du hast etwas nicht verstanden.', "Sorry, I didn't catch that. Could you repeat it, please?"], ['Der Anrufer spricht zu schnell.', 'Could you speak a little more slowly, please?'],
    ['Du versprichst einen Rückruf.', 'I will call you back tomorrow morning.'], ['Du lässt dir einen Namen buchstabieren.', 'Could you spell that, please?'], ['Du wiederholst die Angaben zur Kontrolle.', 'Let me repeat that to make sure I got it right.'], ['Du beendest das Gespräch.', 'Thank you for calling. Goodbye.']
  ];
  const tzu = R => {
    const c = C(), ps = c.shuffle(R, TEL).slice(0, 4), opts = ps.map(p => p[1]);
    return multiQ('Welche Antwort passt zu welcher Situation am Telefon?', ps.map(p => mrow(R, p[0], p[1], opts)), ps.map(p => p[0] + ' → ' + p[1]).join(' '), ['Entscheide zuerst, welche Situation die eindeutigste ist.', 'Schlüsselwörter: „put through“ (verbinden), „message“ (Nachricht), „repeat“ (wiederholen), „spell“ (buchstabieren).']);
  };
  const TREAG = [
    ['Der Anrufer fragt nach jemandem aus dem Vertrieb. Dein Kollege ist gerade nicht am Platz. Was sagst du höflich?', 'I am afraid he is not at his desk at the moment. Can I take a message?', ['He is not here. Call later.', 'I do not know where he is!', 'What do you want from him?'], 'Höflich: „I am afraid …“ (leider) und das Angebot, eine Nachricht aufzunehmen (take a message).', ['Höflich bedeutet: Entschuldigung und Hilfe anbieten.', '„take a message“ = eine Nachricht annehmen.']],
    ['Der Anrufer spricht sehr schnell. Was sagst du?', 'Could you speak a little more slowly, please?', ['Speak slower!', 'I do not understand you.', 'What?'], 'Eine höfliche Bitte beginnt mit „Could you … please?“.', ['Verwende „Could you … please?“.', 'Befehle wirken unhöflich.']],
    ['Du musst den Namen des Anrufers richtig schreiben. Was sagst du?', 'Could you spell your name, please?', ['How do you write it?', 'Spell it!', 'Your name is difficult.'], '„Could you spell … please?“ ist die übliche höfliche Bitte.', ['Das Verb für buchstabieren ist „to spell“.', 'Höflich: „Could you … please?“']],
    ['Du willst das Gespräch höflich beenden. Was sagst du?', 'Thank you for calling. Goodbye.', ['Okay, bye!', 'I must go now.', "That's all, stop."], 'Bedanke dich für den Anruf und verabschiede dich: „Thank you for calling. Goodbye.“', ['Danke zuerst, dann verabschieden.', '„Bye“ ist eher locker.']],
    ['Der Anrufer möchte mit der technischen Abteilung sprechen. Du verbindest ihn. Was sagst du?', 'One moment, please. I will put you through to the technical department.', ['Wait! I give you the technical department.', 'Stay on the line, I am telephoning you the technical department.', 'I make you to the technical department.'], '„To put someone through“ = jemanden verbinden.', ['Das Verb für „verbinden“ ist „put through“.', 'Beginne mit „One moment, please.“']],
    ['Du hast den Anrufer nicht verstanden. Was sagst du?', "Sorry, I didn't catch that. Could you repeat it, please?", ['What have you said?', 'Pardon, repeat!', "I didn't get you right? Say again!"], '„I didn’t catch that“ = „Das habe ich nicht verstanden“, danach die höfliche Bitte um Wiederholung.', ['„catch“ steht hier für „mitbekommen“.', 'Bitte um Wiederholung: „Could you repeat it, please?“']]
  ];
  const tbuch = R => {
    const c = C(), words = ['relay', 'drive', 'pump', 'valve', 'cable', 'sensor', 'router', 'fuse', 'motor', 'plug'], w = c.pick(R, words), right = c.natoSpell(w), wrong = [], L = w.toUpperCase().split('');
    let k = 0; while (wrong.length < 3 && k < 60) { k++; const i = c.ri(R, 0, L.length - 1), sw = c.pick(R, 'ABCDEFGHIKLMNOPRSTUVWY'.split('')), l2 = L.slice(); l2[i] = sw; const t = c.natoSpell(l2.join('')); if (t !== right && wrong.indexOf(t) < 0) wrong.push(t); }
    return choiceQ(R, 'Du sollst das Wort „' + w.toUpperCase() + '“ am Telefon buchstabieren. Welche Folge ist richtig (internationale Buchstabiertafel)?', right, wrong, w.toUpperCase() + ' = ' + right + '.', ['Jeder Buchstabe hat ein festes Wort (A = Alpha, B = Bravo, C = Charlie …).', 'Vergleiche Buchstabe für Buchstabe.']);
  };
  /* ---------- False Friends ---------- */
  /* PRUEFEN P15: Auswahl der False Friends (actual, eventually, sensible, gift, become, chef, fabric, brief, sympathetic, preservative, decent, ordinary, kind). Sind es die Wörter, die im Unterricht und in der Praxis wirklich Fehler verursachen? "eventually" wird als „schließlich“ geführt. */
  const FF = [
    { en: 'actual', wrong: 'aktuell', right: 'tatsächlich', ex: 'The actual price is lower. (Der tatsächliche Preis ist niedriger.) „Aktuell“ = current.' },
    { en: 'eventually', wrong: 'eventuell', right: 'schließlich', ex: 'We eventually found the error. (Wir fanden den Fehler schließlich.) „Eventuell“ = possibly oder perhaps.' },
    { en: 'sensible', wrong: 'sensibel', right: 'vernünftig', ex: 'That is a sensible solution. „Sensibel“ = sensitive.' },
    { en: 'gift', wrong: 'Gift', right: 'Geschenk', ex: 'The gift is for our customers. „Gift“ = poison.' },
    { en: 'become', wrong: 'bekommen', right: 'werden', ex: 'He wants to become a technician. „Bekommen“ = get oder receive.' },
    { en: 'chef', wrong: 'Chef', right: 'Koch', ex: 'The chef works in the canteen. „Chef“ = boss.' },
    { en: 'fabric', wrong: 'Fabrik', right: 'Stoff', ex: 'The fabric is flame resistant. „Fabrik“ = factory.' },
    { en: 'brief', wrong: 'Brief', right: 'kurz', ex: 'Please keep the report brief. „Brief“ = letter.' },
    { en: 'sympathetic', wrong: 'sympathisch', right: 'mitfühlend', ex: 'The manager was sympathetic. „Sympathisch“ = nice oder likeable.' },
    { en: 'preservative', wrong: 'Präservativ', right: 'Konservierungsmittel', ex: 'The food contains no preservatives. „Präservativ“ = condom.' },
    { en: 'decent', wrong: 'dezent', right: 'anständig', ex: 'We offer decent pay. „Dezent“ = discreet oder subtle.' },
    { en: 'ordinary', wrong: 'ordinär', right: 'gewöhnlich', ex: 'This is an ordinary screw. „Ordinär“ = vulgar.' },
    { en: 'kind', wrong: 'Kind', right: 'freundlich', ex: 'Thank you for your kind reply. „Kind“ = child.' }
  ];
  const ffz = R => {
    const c = C(), fs = c.shuffle(R, FF).slice(0, 4), opts = fs.map(f => f.right);
    return multiQ('Ordne jedem englischen Wort seine richtige deutsche Bedeutung zu (nicht die, die ähnlich klingt).', fs.map(f => mrow(R, f.en, f.right, opts)), fs.map(f => f.en + ' = ' + f.right + ' (nicht „' + f.wrong + '“)').join('; ') + '.', ['Frage dich bei jedem Wort: Ist die deutsche Bedeutung wirklich dieselbe oder nur ähnlich geschrieben?', 'Die Option, die wie das Wort klingt, ist oft die Falle.']);
  };
  const FFS = [
    ['Wir bekommen die Ware morgen.', 'We will get the goods tomorrow.', ['We will become the goods tomorrow.', 'We will bekommen the goods tomorrow.', 'We will become got the goods tomorrow.'], '„Bekommen“ heißt „get“ oder „receive“. „Become“ heißt „werden“.', ['Welches englische Verb heißt „bekommen“?', '„become“ ist ein falscher Freund.']],
    ['Bitte schick uns die aktuelle Preisliste.', 'Please send us the current price list.', ['Please send us the actual price list.', 'Please send us the aktual price list.', 'Please send us the topical price list.'], '„Aktuell“ heißt „current“. „Actual“ heißt „tatsächlich“.', ['„Current“ ist das richtige Wort.', 'Das ähnlich klingende Wort bedeutet etwas anderes.']],
    ['Eventuell liefern wir früher.', 'We may deliver earlier.', ['Eventually we deliver earlier.', 'Eventual we deliver earlier.', 'We eventually deliver earlier.'], '„Eventuell“ heißt „possibly“ oder „may“. „Eventually“ heißt „schließlich“.', ['Welches Hilfsverb drückt Möglichkeit aus?', '„eventually“ bedeutet „am Ende“.']],
    ['Er ist sehr sensibel.', 'He is very sensitive.', ['He is very sensible.', 'He is very sensibel.', 'He is very sensitiveness.'], '„Sensibel“ heißt „sensitive“. „Sensible“ heißt „vernünftig“.', ['Die Endung entscheidet: -itive oder -ible?', '„sensible“ ist das falsche Wort.']],
    ['Der Chef ist im Urlaub.', 'The boss is on holiday.', ['The chef is on holiday.', 'The chief is in vacation.', 'The cheff is on holiday.'], '„Chef“ im Sinne von Vorgesetzter heißt „boss“. „Chef“ im Englischen ist der Koch.', ['Wie heißt der Vorgesetzte auf Englisch?', 'Das englische „chef“ arbeitet in der Küche.']],
    ['Das Gift ist gefährlich.', 'The poison is dangerous.', ['The gift is dangerous.', 'The gift is danger.', 'The poison is danger.'], '„Gift“ im Sinne von Giftstoff heißt „poison“. Das englische „gift“ ist ein Geschenk.', ['Auf Englisch ist ein „gift“ etwas Schönes.', 'Welches Wort heißt „Giftstoff“?']]
  ];
  FFS.forEach(q => { q[0] = 'Wie sagst du das richtig auf Englisch? „' + q[0] + '“'; });
  /* ---------- Stückliste und Lieferschein ---------- */
  /* PRUEFEN P11: Begriffe: bill of materials (BOM) = Stückliste, Item/Pos. = Position, Qty = Menge, Part no. = Teilenummer, Unit price = Einzelpreis, delivery note = Lieferschein (auch packing slip), short delivery = Minderlieferung, over-delivery = Mehrlieferung.
     Die Teile und Preise (Schrittmotor 18,50 EUR usw.) sind frei erfunden. Stimmen die Begriffe mit euren Unterlagen überein? */
  const PARTS = [['Stepper motor', 'P-1001', 18.5], ['Control board', 'P-1002', 24.9], ['Power supply', 'P-1003', 12.4], ['Housing', 'P-1004', 6.75], ['Screw M3x10', 'P-1005', 0.08], ['Cable, 0.5 m', 'P-1006', 1.2], ['Connector, 4-pin', 'P-1007', 0.65], ['Heat sink', 'P-1008', 2.3], ['Fuse, 2 A', 'P-1009', 0.15], ['Washer M3', 'P-1010', 0.02]];
  function bomFor(R) {
    const c = C(), ps = c.shuffle(R, PARTS).slice(0, 4), lines = ps.map((p, i) => ({ pos: i + 1, qty: c.pick(R, [1, 2, 4, 6, 8]), desc: p[0], no: p[1], price: p[2] }));
    return { lines, n: c.pick(R, [5, 10, 20, 25, 50]) };
  }
  function bomDoc(b) { return { title: 'Bill of materials (BOM) for one assembly', head: ['Item', 'Qty', 'Description', 'Part no.', 'Unit price (EUR)'], rows: b.lines.map(l => [String(l.pos), String(l.qty), l.desc, l.no, C().fmtEn(l.price, 2, false)]) }; }
  const bom = R => {
    const c = C(), b = bomFor(R), doc = bomDoc(b);
    if (R() < 0.5) {
      const l = c.pick(R, b.lines), v = c.bomQty(b.lines, l.pos, b.n);
      return numQ('Du sollst ' + fen(b.n, 0) + ' Baugruppen bauen. Wie viele Stück „' + l.desc + '“ brauchst du insgesamt?', v, 'Stück', 'Gesamtmenge', 0.01, 'Menge je Baugruppe · Anzahl der Baugruppen = ' + l.qty + ' · ' + b.n + ' = ' + v + ' Stück.', ['Lies in der Zeile die Spalte Qty ab.', 'Multipliziere mit der Anzahl der Baugruppen.'], doc);
    }
    const v = c.bomTotal(b.lines, b.n), one = c.bomTotal(b.lines, 1);
    return numQ('Du sollst ' + fen(b.n, 0) + ' Baugruppen bauen. Wie hoch sind die Materialkosten der Stückliste insgesamt in EUR?', v, 'EUR', 'Materialkosten', 0.006,
      'Kosten je Baugruppe = Summe aus Menge · Einzelpreis = ' + fe(one, 2) + ' EUR. Für ' + b.n + ' Baugruppen: ' + fe(one, 2) + ' · ' + b.n + ' = ' + fe(v, 2) + ' EUR.', ['Rechne zuerst die Kosten einer Baugruppe: je Zeile Qty mal Unit price, dann addieren.', 'Dann mal Anzahl der Baugruppen.'], doc);
  };
  function liefFor(R) {
    const c = C(), ps = c.shuffle(R, PARTS).slice(0, 4), ord = ps.map((p, i) => ({ pos: i + 1, desc: p[0], qty: c.pick(R, [10, 20, 40, 50, 100, 200]) })), del = ord.map(o => ({ pos: o.pos, qty: o.qty }));
    const k = c.ri(R, 0, 3), type = c.pick(R, ['short', 'over', 'missing']);
    if (type === 'short') del[k].qty = ord[k].qty - c.pick(R, [5, 10, 20].filter(d => d < ord[k].qty));
    else if (type === 'over') del[k].qty = ord[k].qty + c.pick(R, [5, 10, 20]); else del[k].qty = 0;
    return { ord, del };
  }
  const liefDoc = l => ({ title: 'Order and delivery note', head: ['Item', 'Description', 'Ordered', 'Delivered'], rows: l.ord.map((o, i) => [String(o.pos), o.desc, String(o.qty), String(l.del[i].qty)]) });
  const stmt = d => (d.type === 'short' ? 'Item ' + d.pos + ': short delivery, ' + d.diff + ' pieces missing' : d.type === 'over' ? 'Item ' + d.pos + ': over-delivery, ' + d.diff + ' pieces too many' : 'Item ' + d.pos + ': not delivered at all');
  const lief = R => {
    const c = C(), l = liefFor(R), d = c.bomCheck(l.ord, l.del)[0], right = stmt(d), wrong = [];
    let k = 0; while (wrong.length < 3 && k < 80) { k++; const t = { pos: c.ri(R, 1, 4), type: c.pick(R, ['short', 'over', 'missing']), diff: c.pick(R, [5, 10, 20]) }, s = stmt(t); if (s !== right && wrong.indexOf(s) < 0) wrong.push(s); }
    return choiceQ(R, 'Vergleiche den Lieferschein mit der Bestellung. Welche Aussage über die Lieferung stimmt?', right, wrong, 'Der Vergleich Ordered gegen Delivered zeigt genau eine Abweichung: ' + right + '. Das gehört in die Reklamation.', ['Vergleiche Zeile für Zeile die Spalten Ordered und Delivered.', 'Delivered kleiner = short delivery, größer = over-delivery, 0 = gar nicht geliefert.'], liefDoc(l));
  };
  /* ============================================================ Generatoren und Aufgabenliste */
  const G = {
    vzu, vtr, vgap, dgloss, dwert, dspalte, toler, dok, dmaxr: pq(DMAXQ), wsig, wtrans, wmulti, anl: pqi(ANLQ), agap: vgap, wverbot: pqi(WVERB),
    zahlen, umr, temp, sag, zeinh: pq(ZEINHQ), mfehl, mform, mgap, tzu, treag: pq(TREAG), tbuch, ffz, ffs: pq(FFS), bom, lief
  };
  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    ['Fachvokabeln', 1, 'Elektrik: Begriffe zuordnen', 'vzu', ['elek']], ['Fachvokabeln', 1, 'Mechanik: Begriffe zuordnen', 'vzu', ['mech']], ['Fachvokabeln', 1, 'IT: Begriffe zuordnen', 'vzu', ['it']], ['Fachvokabeln', 1, 'Logistik und Büro: Begriffe zuordnen', 'vzu', ['log', 'buero']],
    ['Fachvokabeln', 2, 'Sicherheitswörter übersetzen', 'vtr', ['sich']], ['Fachvokabeln', 2, 'Fachwörter im Satz', 'vgap', [2, 3]],
    ['Datenblatt lesen', 1, 'Begriffe im Datenblatt', 'dgloss'], ['Datenblatt lesen', 2, 'Wert im Auszug finden', 'dwert'], ['Datenblatt lesen', 2, 'Zeile im Auszug erkennen', 'dspalte'], ['Datenblatt lesen', 2, 'Toleranz berechnen', 'toler'], ['Datenblatt lesen', 3, 'Passt das Bauteil?', 'dok'], ['Datenblatt lesen', 3, 'Grenzwerte und Angaben', 'dmaxr'],
    ['Warnhinweise und Anleitungen', 1, 'Signalwort einordnen', 'wsig'], ['Warnhinweise und Anleitungen', 1, 'Hinweis übersetzen', 'wtrans'], ['Warnhinweise und Anleitungen', 2, 'Hinweise nach Stufe sortieren', 'wmulti'], ['Warnhinweise und Anleitungen', 2, 'Schritt in der Anleitung', 'anl'], ['Warnhinweise und Anleitungen', 2, 'Anleitung vervollständigen', 'agap', [0, 1]], ['Warnhinweise und Anleitungen', 3, 'Verbote und Pflichten lesen', 'wverbot'],
    ['Maßeinheiten und Zahlen', 1, 'Zahl im Datenblatt lesen', 'zahlen'], ['Maßeinheiten und Zahlen', 2, 'Einheiten umrechnen', 'umr'], ['Maßeinheiten und Zahlen', 2, 'Temperaturangabe umrechnen', 'temp'], ['Maßeinheiten und Zahlen', 2, 'Zahl aussprechen', 'sag'], ['Maßeinheiten und Zahlen', 3, 'Große Zahlen und Vorsätze', 'zeinh'],
    ['E-Mail und Anfrage', 2, 'Mail Korrektur lesen', 'mfehl', [0, 1, 2, 3]], ['E-Mail und Anfrage', 2, 'Passender Ton', 'mform'], ['E-Mail und Anfrage', 3, 'Mail vervollständigen', 'mgap', [0, 1, 2]], ['E-Mail und Anfrage', 3, 'Mail vor dem Senden prüfen', 'mfehl', [4, 5, 6, 7]],
    ['Telefon', 1, 'Am Telefon zuordnen', 'tzu'], ['Telefon', 2, 'Telefonat führen', 'treag'], ['Telefon', 2, 'Name am Telefon buchstabieren', 'tbuch'],
    ['False Friends', 1, 'Ähnlich klingende Wörter', 'ffz'], ['False Friends', 2, 'Welcher Satz stimmt?', 'ffs'],
    ['Stückliste und Lieferschein', 2, 'Stückliste auswerten', 'bom'], ['Stückliste und Lieferschein', 3, 'Lieferung prüfen', 'lief']
  ];
  const tasks = defs.map((d, i) => ({ id: 'eng' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('eng-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ============================================================ Beispiele (Darstellung im UI aus ENG_CORE) */
  const examples = [
    { id: 'zahl1', kind: 'notation', title: 'Zahl im englischen Datenblatt', text: 'Im englischen Datenblatt steht eine Länge von „1,250.5 mm“. Das Komma trennt die Tausender, der Punkt ist das Dezimalzeichen.', p: { s: '1,250.5', from: 'en' }, task: 'eng19' },
    { id: 'zahl2', kind: 'notation', title: 'Tausenderkomma ist kein Dezimalkomma', text: 'Auf einem Lieferschein steht „2,500 pcs“. Das sind keine zweieinhalb Stück, sondern zweitausendfünfhundert.', p: { s: '2,500', from: 'en' }, task: 'eng19' },
    { id: 'einh1', kind: 'unit', title: 'Inch in Millimeter', text: 'Ein amerikanisches Datenblatt nennt eine Bohrung von 2.5 in. Wie viel ist das in Millimetern?', p: { v: 2.5, from: 'in', to: 'mm', dec: 1 }, task: 'eng20' },
    { id: 'temp1', kind: 'unit', title: 'Fahrenheit in Celsius', text: 'Ein Gerät darf bis 185 °F betrieben werden. Wie viel ist das in °C?', p: { v: 185, from: '°F', to: '°C', dec: 0 }, task: 'eng21' },
    { id: 'warn1', kind: 'signal', title: 'Welches Signalwort passt?', text: 'Du findest dieses Schild an einer Maschine. Welches Signalwort gehört davor?', p: { w: 1 }, task: 'eng13' },
    { id: 'dat1', kind: 'sheet', title: 'Wert im Datenblatt-Auszug finden', text: 'Bis zu welcher Umgebungstemperatur darf der Regler betrieben werden? Suche die Zeile „Operating temperature“ und lies die Spalte „Max“ ab.', p: { seed: 'bsp-dat1', k: 'tmax' }, task: 'eng8' },
    { id: 'tol1', kind: 'tol', title: 'Toleranz eines Widerstands', text: 'Ein Widerstand trägt die Beschriftung „4.7 kΩ ±5 %“. In welchem Bereich liegt sein tatsächlicher Wert?', p: { nom: 4.7, pct: 5, unit: 'kΩ' }, task: 'eng10' },
    { id: 'mail1', kind: 'mail', title: 'Reklamations-Mail korrigieren', text: 'Diese Mail soll an einen Lieferanten gehen. Eine Zeile enthält einen typischen Fehler von Deutschsprachigen.', p: { i: 1 }, task: 'eng24' },
    { id: 'bom1', kind: 'bom', title: 'Materialkosten aus der Stückliste', text: 'Eine Baugruppe wird mehrfach gefertigt. Wie hoch sind die Materialkosten, und wie viele Teile werden von der ersten Position gebraucht?', p: { seed: 'bsp-bom1' }, task: 'eng33' },
    { id: 'lief1', kind: 'lief', title: 'Lieferschein gegen Bestellung prüfen', text: 'Du nimmst eine Lieferung an und vergleichst Bestellung und Lieferschein. Gibt es eine Abweichung?', p: { seed: 'bsp-lief1' }, task: 'eng34' },
    { id: 'tel1', kind: 'tel', title: 'Ein kurzes Telefonat', text: 'Der Anrufer möchte jemanden aus dem Vertrieb sprechen, der Kollege ist nicht am Platz.', p: { lines: [['Du', 'Good morning, Technical Support, how can I help you?'], ['Anrufer', 'Could I speak to someone in the sales department, please?'], ['Du', 'I am afraid he is not at his desk at the moment. Can I take a message?'], ['Anrufer', 'Yes, please. Could you ask him to call me back?'], ['Du', 'Of course. Could you spell your name, please?'], ['Du', 'Let me repeat that to make sure I got it right. Thank you for calling. Goodbye.']] }, task: 'eng28' }
  ];

  /* ============================================================ Nachschlagen */
  const REF = [
    { id: 'dat', t: 'Datenblatt: Begriffe', intro: 'Typische Wörter in Datenblättern. „Max“ und „Min“ sind garantiert, „Typ“ ist nur üblich.', head: ['Englisch', 'Deutsch'], rows: GLOSS },
    { id: 'anl', t: 'Anleitungen: Befehle und Verben', intro: 'Anleitungen nutzen die Befehlsform ohne „you“.', head: ['Englisch', 'Deutsch'], rows: [['Unplug the device.', 'Ziehe den Netzstecker.'], ['Switch off / switch on', 'Ausschalten / einschalten'], ['Tighten / loosen the screw.', 'Schraube festziehen / lösen.'], ['Remove the cover.', 'Entferne die Abdeckung.'], ['Insert the plug.', 'Stecke den Stecker ein.'], ['Ensure that …', 'Stelle sicher, dass …'], ['Check the seal.', 'Prüfe die Dichtung.'], ['Replace the fuse.', 'Ersetze die Sicherung.'], ['Allow to cool down.', 'Abkühlen lassen.'], ['Do not overtighten.', 'Nicht zu fest anziehen.'], ['Keep out of reach of children.', 'Außerhalb der Reichweite von Kindern aufbewahren.'], ['Use only in dry rooms.', 'Nur in trockenen Räumen verwenden.']] },
    { id: 'zah', t: 'Zahlen und Einheiten', intro: 'Englisch: Dezimalpunkt und Tausenderkomma. Deutsch: Dezimalkomma und Tausenderpunkt.', head: ['Englisch', 'Deutsch'], rows: [['1,250.5', '1.250,5'], ['2,500 (zweitausendfünfhundert)', '2.500'], ['0.75', '0,75'], ['1 in = 25.4 mm', '1 Zoll = 25,4 mm'], ['1 lb ≈ 0.454 kg', '1 Pfund ≈ 0,454 kg'], ['1 psi ≈ 0.069 bar', '1 psi ≈ 0,069 bar'], ['°F = °C × 1.8 + 32', '°F = °C · 1,8 + 32'], ['one billion = 1,000,000,000', 'eine Milliarde'], ['µ = micro = 10⁻⁶, m = milli = 10⁻³', 'Mikro = Millionstel, Milli = Tausendstel'], ['k = kilo, M = mega, G = giga', 'Tausend, Million, Milliarde']] },
    { id: 'mail', t: 'E-Mail: Bausteine', intro: 'Formelle Mail: Anrede, Bezug, Anliegen, Bitte, Schluss. Keine Kurzformen.', head: ['Zweck', 'Englisch'], rows: [['Anrede (Name unbekannt)', 'Dear Sir or Madam, … Yours faithfully,'], ['Anrede (Name bekannt)', 'Dear Mr Brown, … Yours sincerely, oder Kind regards,'], ['Bezug', 'Thank you for your e-mail of 5 June.'], ['Anfrage', 'Could you please send us a quotation for …?'], ['Bestellung', 'We would like to place an order for …'], ['Anhang', 'Please find attached …'], ['Reklamation', 'I am writing to complain about …'], ['Ersatz verlangen', 'Please send us replacement units by Friday.'], ['Frist', 'by Friday (bis spätestens) / until Friday (durchgehend bis)'], ['Entschuldigung', 'We apologise for the inconvenience.'], ['Schluss', 'I look forward to hearing from you.']] },
    { id: 'tel', t: 'Telefon: Phrasen', intro: 'Höflich bleiben: „Could you … please?“ und „I am afraid …“.', head: ['Situation', 'Englisch'], rows: TEL },
    { id: 'ff', t: 'False Friends', intro: 'Wörter, die wie deutsche klingen, aber etwas anderes bedeuten.', head: ['Englisch', 'Nicht „…“, sondern'], rows: FF.map(f => [f.en, 'nicht „' + f.wrong + '“, sondern ' + f.right]) },
    { id: 'bom', t: 'Stückliste und Lieferschein', intro: 'Spalten und Begriffe auf englischen Stücklisten (BOM) und Lieferscheinen.', head: ['Englisch', 'Deutsch'], rows: [['bill of materials (BOM)', 'Stückliste'], ['item / pos.', 'Position'], ['qty (quantity)', 'Menge'], ['description', 'Bezeichnung'], ['part no.', 'Teilenummer'], ['unit price', 'Einzelpreis'], ['total price', 'Gesamtpreis'], ['delivery note (packing slip)', 'Lieferschein'], ['ordered / delivered', 'bestellt / geliefert'], ['short delivery', 'Minderlieferung (zu wenig geliefert)'], ['over-delivery', 'Mehrlieferung (zu viel geliefert)'], ['back order', 'Nachlieferung, offener Rückstand']] }
  ];

  root.ENG_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, groups: GROUPS, vocab: VOCAB, groupName, gloss: GLOSS, warn: WARN, mails: MAILS, tel: TEL, ff: FF, ref: REF, parts: PARTS,
    sheetVals, sheetDoc, bomFor, bomDoc, liefFor, liefDoc, stmt, sigRule, sheetAsk: SHEET_ASK, formPairs: FORMPAIRS };
  root.ENG_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.ENG_DATA, TASKS: root.ENG_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
