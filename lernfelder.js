'use strict';
/* Tonfunk Lab: Lernfelder (Datenmodul, reine Funktionen, laufen im Browser und in Node; window.LERNFELDER bzw. module.exports).
   Inhalt:
   1. LF: Katalog der Lernfelder und Unterrichtseinheiten des Elektronikers für Geräte und Systeme (Kürzel, Titel, Lehrjahr, Themen in eigenen Worten).
      Die Namen stammen aus den Mitschriften der Berufsschule. Wo es zu einem Lernfeld keine eigene Mitschrift gibt (8.3, 9.3), steht mit = false.
   2. Zuordnung der Aufgaben (aufgaben.js, Zeile [id, lab, kategorie, titel, level]) zu genau einem Hauptlernfeld:
      REGELN (je Lab und Kategorie, '*' = alle übrigen Kategorien des Labs) und AUSNAHMEN (je Aufgaben-ID). null = bewusst keinem Lernfeld zugeordnet.
      Die Zuordnung ist ein Entwurf nach Inhalt, der Ausbilder darf sie ändern (nur diese Datei).
   3. Probetest je Lernfeld auf dem vorhandenen Fragenpool des Prüfungs-Labs (PR_POOL.q aus pruefpool.js und die acht Elektronik-Themen von PR_BANK.MC aus
      pruefbank*.js): Fragen werden nach Thema einem Lernfeld zugeordnet (poolLF, bankLF), gezogen (probe), bewertet (bewerte) und nach IHK-Schlüssel benotet (note).
      Es werden keine Fragen erfunden und nichts aufgefüllt: hat ein Lernfeld zu wenige passende Fragen, meldet probe() das ehrlich (ok = false, grund). */
(function (root) {
  /* ---------------------------------------------------------------- 1. Katalog */
  const LJ = [
    { lj: 1, t: '1. Lehrjahr', kurz: '1. LJ' },
    { lj: 2, t: '2. Lehrjahr', kurz: '2. LJ' },
    { lj: 3, t: '3. Lehrjahr', kurz: '3. LJ' },
    { lj: 4, t: '4. Lehrjahr', kurz: '4. LJ' },
    { lj: 0, t: 'Lernfeldübergreifend', kurz: 'alle' }
  ];
  const LF = [
    { k: 'E1', lj: 1, t: 'Grundlagen E1: Strom, Spannung, Widerstand und Messen', mit: true,
      themen: ['Ohmsches Gesetz, Reihen- und Parallelschaltung, Spannungsteiler', 'Strom und Spannung messen (Messgerät in Reihe oder parallel)', 'Rechnen mit Einheiten, Vorsätzen und Formeln umstellen'] },
    { k: 'E2', lj: 1, t: 'Grundlagen E2: Schaltzeichen, Schaltpläne und einfache Installation', mit: true,
      themen: ['Schaltzeichen nach Norm, Stromlaufplan und Übersichtsschaltplan', 'Ausschaltung, Wechselschaltung, Kreuzschaltung', 'Wechselstromkreis, Spannungserzeugung, Leiterkennzeichnung'] },
    { k: 'E3', lj: 1, t: 'Grundlagen E3: Steuerungen und Zahlensysteme', mit: true,
      themen: ['Begriffe der Steuerungstechnik (Steuerung, Regelung)', 'Schütz, Selbsthaltung, Verriegelung', 'Dual-, Hexadezimal- und Dezimalzahlen umrechnen'] },
    { k: '5.1', lj: 2, t: 'LF 5.1: Netzsysteme und Überstromschutz', mit: true,
      themen: ['TN-, TT- und IT-System, Schutzleiter und Erdung', 'Leitungsschutzschalter, Schmelzsicherung, Auslösebedingung', 'Körperstrom und Gefahren des elektrischen Stroms'] },
    { k: '5.2', lj: 2, t: 'LF 5.2: Leistungsübertragung, Drehstrom und Schutzmaßnahmen', mit: true,
      themen: ['Hausanschluss, Freileitung und Kabelnetz', 'Drehstrom: Stern- und Dreieckschaltung, Außenleiter, Neutralleiter', 'Fehlerarten, Schutzklassen und IP-Schutzarten, Wechselstromgrößen'] },
    { k: '5.3', lj: 2, t: 'LF 5.3: Blockschaltbilder und Netzgeräte', mit: true,
      themen: ['Blockschaltbild lesen und zeichnen', 'Transformator, Gleichrichtung, Siebung', 'Verlustleistung und Kühlkörper'] },
    { k: 'E6', lj: 2, t: 'LF 6 Labor: Oszilloskop und Mischspannung', mit: true,
      themen: ['Spannung und Zeit aus dem Schirmbild ablesen (Volt/div, Time/div)', 'Gleich- und Wechselanteil, Kopplung, Tastkopf', 'Effektivwert, Phasenverschiebung, Frequenzgang'] },
    { k: '6.1', lj: 2, t: 'LF 6.1: Halbleiter, Kennlinien und Arbeitspunkt', mit: true,
      themen: ['Arbeitsgerade und Arbeitspunkt, Kennlinien lesen', 'Diode, LED und Sonderdioden, p-n-Übergang', 'Bipolartransistor als Schalter und Verstärker, Basisvorwiderstand'] },
    { k: '6.2', lj: 2, t: 'LF 6.2: Elektronische Baugruppen und Operationsverstärker', mit: true,
      themen: ['Aufbau und Kennwerte des Operationsverstärkers', 'Invertierer, Nichtinvertierer, Summierer, Differenzverstärker', 'Komparator, Schmitt-Trigger, Integrierer'] },
    { k: '7.1', lj: 2, t: 'LF 7.1: Einfache IT-Systeme', mit: true,
      themen: ['EVA-Prinzip, Geräteklassen, Aufbau eines Rechners', 'Speicher, Adressbus, Adressdecoder, Rechenwerk', 'Zahlendarstellung, Zweierkomplement, Hardware im PC'] },
    { k: '7.2', lj: 2, t: 'LF 7.2: Synthese von Logikschaltungen', mit: true,
      themen: ['Wahrheitstabelle, Funktionsgleichung, Schaltung', 'Vereinfachen mit KV-Diagramm', 'Gatter, Halbaddierer, Multiplexer'] },
    { k: '8.1', lj: 2, t: 'LF 8.1: Technische Darstellungen', mit: true,
      themen: ['Zeichenblatt, Blattgrößen, Maßstab, Linien', 'Ansichten, Schnitte, Bemaßung', 'Schaltpläne, Kennbuchstaben und Installationspläne'] },
    { k: '8.2', lj: 2, t: 'LF 8.2: Signalumwandlung und Sensoren', mit: true,
      themen: ['Wandler, Quelle, Senke und Übertragungskanal', 'Analog-Digital-Umsetzer (Zählverfahren, Parallelverfahren)', 'Aktive und passive Sensoren, Normsignale'] },
    { k: '8.3', lj: 2, t: 'LF 8: Geräte herstellen und prüfen (Leiterplatte, Löten, Prüfverfahren)', mit: false,
      themen: ['Leiterplatte entwerfen, Layout und Herstellerregeln', 'Bestücken und Löten', 'Prüfverfahren und Fehlersuche an Baugruppen'] },
    { k: '9.1', lj: 3, t: 'LF 9.1: Integrierte Schaltungen', mit: true,
      themen: ['Vorteile integrierter Schaltungen, Logikfamilien und Pegel', 'Lastfaktoren, Open-Collector, Tri-State', 'Flipflops, Zähler, Zeitgeber 555'] },
    { k: '9.2', lj: 3, t: 'LF 9.2: Spannungsstabilisierung', mit: true,
      themen: ['Z-Diode: Quer- und Längsstabilisierung', 'Linearregler (7805, LM317) und Verlustleistung', 'Schaltregler und Regelschaltung mit Referenz'] },
    { k: '9.3', lj: 3, t: 'LF 9: Geräte und Systeme in Stand halten (Instandhaltung)', mit: false,
      themen: ['Instandhaltungsauftrag und Begriffe', 'Systematische Fehlersuche', 'Sicherheit nach der Reparatur'] },
    { k: '10.1', lj: 3, t: 'LF 10.1: Steuerungen, Antriebe und Kundenübergabe', mit: true,
      themen: ['Speicherprogrammierbare Steuerung (SPS), Stromlaufplan, Ablaufsteuerung', 'Motoren, Antriebe und Asynchronmotor', 'Kundenauftrag bearbeiten und übergeben'] },
    { k: '10.2', lj: 3, t: 'LF 10.2: Pneumatik und Qualitätsmanagement', mit: true,
      themen: ['Druckluft erzeugen, Ventile, Zylinder, Schaltpläne', 'Qualität und Qualitätsmanagement (Normenreihe ISO 9000)', 'Qualitätswerkzeuge'] },
    { k: '11.1', lj: 3, t: 'LF 11.1: Grundlagen der Programmierung', mit: true,
      themen: ['Phasen der Softwareentwicklung', 'Programmablaufplan und Struktogramm', 'Variablen, Verzweigungen, Schleifen, Algorithmen'] },
    { k: '11.2', lj: 3, t: 'LF 11.2: Programmieren in C++', mit: true,
      themen: ['Aufbau eines C++-Programms, Datentypen', 'Zuweisungen, Schleifen, Verzweigungen in C++', 'Mikrocontroller programmieren (Arduino, Raspberry Pi)'] },
    { k: '11.3', lj: 3, t: 'LF 11.3: Assemblerprogrammierung', mit: true,
      themen: ['Ein- und Ausgabe über Adressen', 'Befehle, Sprünge, Unterprogramme', 'Programm als Befehlsfolge auf der Mini-CPU'] },
    { k: 'E12', lj: 4, t: 'E12: Projektbearbeitung und Mikrocontroller', mit: true,
      themen: ['Projektablauf, Teamarbeit, Kreativitätsmethoden', 'Aufbau des Mikrocontrollers, Speicher, Timer, Interrupt', 'Serielle Datenübertragung, Bussysteme, Verbundprojekte'] },
    { k: 'E13', lj: 4, t: 'E13: Qualität, Messtechnik und Brandschutz', mit: true,
      themen: ['Qualität und Qualitätsmanagement', 'Messwert, Referenzwert, Auflösung, Messunsicherheit', 'Brandschutz, Sicherheitszeichen, Maschinensicherheit'] },
    { k: 'FE', lj: 0, t: 'Fachenglisch (lernfeldübergreifend)', mit: false,
      themen: ['Fachwörter, Datenblätter und Anleitungen auf Englisch', 'E-Mails und Telefon', 'Sicherheits- und Warnhinweise'] }
  ];
  const LFK = {}; LF.forEach(l => { LFK[l.k] = l; });
  const lf = k => LFK[k] || null;

  /* ---------------------------------------------------------------- 2. Zuordnung der Aufgaben */
  /* Regeln: Lab -> { Kategorie: Lernfeld, '*': Lernfeld für alle anderen Kategorien }. Kein Eintrag = nicht zugeordnet. */
  const REGELN = {
    sim: { 'Grundlagen': 'E2', 'Hausinstallation': 'E2', 'Fehlersuche': 'E2', 'Drehstrom': '5.2', 'Leitungen und Messen': '5.1' },
    haus: { 'Licht': 'E2', 'Steckdosen': 'E2', 'Verteiler': '5.1', 'Schutz': '5.2', 'Fehlersuche': 'E2', 'Büro': '5.1', 'Leitungen': '5.1', 'Gesamtaufgabe': '5.1', 'Frei gestalten': 'E2', 'Drehstrom': '5.2', 'Geschosse': 'E2', 'Hausanschluss': '5.2', 'Kundenauftrag': '10.1' },
    sch: { 'Grundlagen': 'E1', 'Transistoren': '6.1', 'Filter und Gleichrichter': 'E2', 'Fehlersuche': 'E1', 'Halbleiter': '9.2', 'Aufbau nach Plan': '6.1', 'Projekt: Ampel': '9.1', 'Projekt: Dämmerungsschalter': '6.1', 'Projekt: Netzteil': '5.3', 'Zufallsaufgaben': 'E1', 'Tagesaufgabe': null, 'Duell': null, 'Schaltungs-Detektiv': null },
    loch: { 'Aufbau': 'E1', 'Arduino und Pi': '11.2', 'Projekt Ampel': '9.1', 'Projekt Dämmerungsschalter': '6.1', 'Projekt Netzteil': '5.3', 'Fehlersuche': 'E2' },
    digi: { 'Grundgatter': '7.2', 'Schaltnetze': '7.2', 'Speicher und Zähler': '9.1', 'Fehlersuche': '7.2', 'Rechnerbausteine': '7.1', 'Zahlen und Codes': '7.1', 'Logikfamilien': '9.1', 'Mini-CPU': '11.3', 'Prozessor 8085': '11.3', 'Kundenauftrag': '10.1', 'Vereinfachen': '7.2', 'Zustandsautomaten': '9.1' },
    mess: { 'Multimeter': 'E1', 'Leistung und Kennlinien': 'E1', 'Netzgerät und Generator': 'E1', 'Oszilloskop': 'E6', 'Messfehler': 'E1', 'Frequenzgang': 'E6', 'Logik': '9.1', 'Kundenauftrag': '10.1', 'Fehlersuche': 'E1', 'Prüfung: Stromlaufplan': 'E1' },
    els: { 'Stromwirkung': '5.1', 'Prüfungsnah': '5.1', 'Schutzklassen': '5.2', 'Schutzorgane': '5.1', 'RCD': '5.1', 'Isolation und Schutzleiter': '5.2', 'Geräteprüfung': '5.2', 'Sicherheitsregeln': 'E13', 'Brandschutz': 'E13', 'Kennzeichnung': 'E13', 'Maschinensicherheit': '10.1' },
    nts: { 'Prüfungsnah': '5.3', 'Transformator': '5.3', 'Gleichrichter': '5.3', 'Z-Diode': '9.2', 'Linearregler': '9.2', 'Schaltregler': '9.2', 'Gate': '9.2', 'Regelkreis': '9.2', 'Fehlersuche': '9.2' },
    wsl: { '*': '5.2', 'Transformator': '5.3' },
    ana: { 'Prüfungsnah': '6.1', 'Fehlersuche': '6.1', 'Transistorverstärker': '6.1', 'Komparator und Schmitt-Trigger': '6.2', 'Aktive Schaltungen': '6.2', 'Diode': '6.1', 'Transistorschalter': '6.1', 'OPV-Grundschaltungen': '9.1' },
    sps: { '*': '10.1', 'Grundlagen': 'E3' },
    pcb: { '*': '8.3' },
    ant: { '*': '10.1' },
    sen: { '*': '8.2' },
    thm: { '*': '5.3' },
    enr: { 'Grundlagen': '6.1', 'Kennlinie': '6.1', 'Rechnen': '6.1', 'Verschaltung': '6.1', 'Verschattung': '6.1', 'Laderegler': '9.2', 'Wechselrichter': '5.2' },
    ds: { 'Datenblatt-Aufbau': '6.1', 'Grenzwerte und Betriebsbedingungen': '6.1', 'Kennwerte lesen': '6.1', 'Kennlinien ablesen': '6.1', 'Berechnungen': '6.1', 'Thermik und Derating': '5.3', 'Bauteilwahl': '6.1', 'Zeitdiagramm und Register': '9.1', 'Fachenglisch': 'FE', 'Fehlersuche': '6.1', 'Prüfungsstil': 'E12' },
    code: { 'Grundlagen': '11.2', 'Mehrere LEDs': '11.2', 'Fehlersuche im Code': '11.2', 'Sensoren und Töne': 'E12', 'Prüfungspraxis': 'E12' },
    pi: { 'Grundlagen': '11.2', 'Fehlersuche im Code': '11.2', 'Sensoren und Töne': 'E12', 'Analoge Sensoren (MCP3008)': '8.2', 'I²C-Sensoren': 'E12' },
    alg: { '*': '11.1' },
    vb: { '*': 'E12' },
    mat: { '*': 'E1', 'Messwerte': 'E13' },
    eng: { '*': 'FE' },
    zei: { '*': '8.1' },
    pne: { '*': '10.2' },
    ins: { '*': '9.3' },
    hwl: { '*': '7.1' },
    sys: { '*': '7.1' },
    ssl: { 'Schutzorgane wählen': '5.1', 'Strom und Querschnitt': '5.1', 'Netzteil und Wärme': '5.3', '*': '10.1' }
  };
  /* Ausnahmen je Aufgaben-ID (gehen den Regeln vor) */
  const AUSNAHMEN = {
    // SimLab, HausLab
    schutz: '5.1', fi: '5.2', pe1: '5.2', vt1: '5.1', schuetz: 'E3', selbst: 'E3', zh: 'E3', f3: 'E3', f2: '5.1', sl3: '5.2', sl5: '5.2', sl6: '5.2', ha9: '5.2',
    // SchaltLab
    s5: '5.3', sf1: '6.1', sf2: '5.3', sf4: '9.2', sf5: 'E2', s11: '5.3', s12: '9.1', s15: '6.2', s16: '9.2', r4: 'E2',
    // LochLab
    l4: '6.1', l5: '6.1', l6: '6.1', l13: '6.1', l14: '6.1', l7: '5.3', l19: '5.3', l8: '9.1', l22: '9.1', l18: 'E2', l20: '9.2', l21: 'E2',
    l11: 'E12', l12: 'E12', lf3: '5.3', lf5: '5.3', lf6: '6.1', lf7: '9.1', lf8: '9.1', lf4: 'E12',
    // DigiLab
    df2: '9.1', df4: '7.1', df5: '7.1', df6: '11.3', df7: '11.3',
    // MessLab
    m13: '6.1', m23: '6.1', m14: '9.2', m20: 'E6', m40: 'E13', m24: 'E13', mf3: '9.2', mf4: 'E6', mf5: 'E6', mpf1: '6.1', mpf2: '6.2', mpf3: '6.2',
    mp3: '6.2', mp4: '6.2', mp5: '6.1', mp6: '9.2', mp7: '9.2', mp8: '6.1',
    // Netzteil-Lab
    nt9: '9.2', nt10: '9.2', nt12: '9.2', nt14: '9.2', nt15: '9.2', nt16: '9.2', nt17: '9.2', nt18: '9.2', nt19: '9.2', nt28: '9.2',
    // Wechselstrom-Lab
    ws26: '5.3', ws28: '5.3', ws29: '5.3',
    // Analogtechnik-Lab
    ae2: '9.2', ae15: '9.2', ae17: '6.2', ae18: '6.2', ae19: '6.2', ae20: '6.2', ae21: '6.2', ae22: '6.2', ae23: '6.2', ae24: '6.2', ae25: '6.2', ae26: '6.2', ae28: '6.2', ae29: '6.2', ae32: '6.2',
    // Leiterplatten-Lab, Sensorik-Lab, Energie-Lab, Datenblatt-Lab
    pb44: '5.3', pb45: '5.3', pb46: '9.2', pb47: '9.2', pb48: '6.2', pb49: '6.2',
    se41: '6.2', se42: '6.2',
    en32: '5.2', en34: '5.2', en35: '5.2',
    ds4: '6.2', ds10: '9.2', ds11: '9.1', ds14: '9.2', ds15: '9.2', ds21: '5.3', ds24: 'E12', ds25: 'E12', ds32: '9.2',
    // Algorithmen-Lab: C++ und Mikrocontroller (Mitschriften 11.2 und E12.3)
    alg39: '11.2', alg40: '11.2', alg41: '11.2', alg42: '11.2', alg43: 'E12', alg44: 'E12', alg45: 'E12', alg46: 'E12', alg47: 'E12', alg48: 'E12',
    // Prüfungs-Lab: die acht Themen-Aufgaben; Probeprüfungen und Prüfungsaufbau sind lernfeldübergreifend und bleiben ohne Zuordnung
    pr1: 'E1', pr2: '6.1', pr3: '5.2', pr4: '7.2', pr5: 'E1', pr6: '5.3', pr7: 'E12', pr8: '5.1'
  };
  /* Aufgaben, die in v48.163 neu hinzugekommen sind (Differenz aufgaben.js zu release-v48.162; gezielt in AUSNAHMEN/REGELN eingeordnet) */
  const NEU_V48_163 = ['d28', 'df4', 'd29', 'd30', 'd31', 'd32', 'd33', 'd34', 'd35', 'd36', 'd37', 'df5', 'dc7', 'dc8', 'dc9', 'm30', 'm31', 'm32', 'm33', 'm34', 'm35', 'm36', 'm37', 'm38', 'm39', 'm40', 'm41', 'm42', 'mf4', 'mf5', 'mf6', 'mf7', 'sp33', 'sp34', 'sp35', 'sp36', 'sp37', 'pb44', 'pb45', 'pb46', 'pb47', 'pb48', 'pb49', 'an39', 'an40', 'an41', 'an42', 'an43', 'an44', 'an45', 'se41', 'se42', 'se37', 'se38', 'se39', 'se40', 'se43', 'en31', 'en32', 'en33', 'en34', 'en35', 'en36', 'el33', 'el34', 'el35', 'el36', 'el37', 'el38', 'nt33', 'nt34', 'nt35', 'nt36', 'nt37', 'nt38', 'ws33', 'ws34', 'ws35', 'ws36', 'ws37', 'ws38', 'ws39', 'ws40', 'ws41', 'ws42', 'ws43', 'ws44', 'ws45', 'ws46', 'ws47', 'ae33', 'ae34', 'ae35', 'ae36', 'ae37', 'ae38', 'ae39', 'ae40', 'pne33', 'pne34', 'pne35', 'pne36', 'pne37', 'pne38', 'pne39', 'pne40', 'ins41', 'ins42', 'ins43', 'ins44', 'ins45', 'ins46', 'zei37', 'zei38', 'zei39', 'zei40', 'zei41', 'zei42', 'zei43', 'zei44', 'zei45', 'zei46', 'zei47', 'zei48', 'zei49', 'zei50', 'zei51', 'zei52', 'mat36', 'mat37', 'mat38', 'mat39', 'mat40', 'mat41', 'mat42', 'mat43', 'eng35', 'eng36', 'eng37', 'eng38', 'eng39', 'eng40', 'eng41', 'eng42', 'eng43', 'eng44', 'alg35', 'alg36', 'alg37', 'alg38', 'alg39', 'alg40', 'alg41', 'alg42', 'alg43', 'alg44', 'alg45', 'alg46', 'alg47', 'alg48'];

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /* Hauptlernfeld einer Aufgabenzeile [id, lab, kategorie, titel, level]; null = keinem Lernfeld zugeordnet */
  function lfOf(row) {
    if (!row) return null;
    if (has(AUSNAHMEN, row[0])) return AUSNAHMEN[row[0]];
    const R = REGELN[row[1]]; if (!R) return null;
    if (has(R, row[2])) return R[row[2]];
    return has(R, '*') ? R['*'] : null;
  }
  /* rows (aufgaben.js) -> { byId: { id: lfKey|null }, byLf: { lfKey: [Zeilen] }, ohne: [Zeilen ohne Lernfeld] } */
  function zuordnung(rows) {
    const byId = {}, byLf = {}, ohne = []; LF.forEach(l => { byLf[l.k] = []; });
    (rows || []).forEach(r => { const k = lfOf(r); byId[r[0]] = k; if (k && byLf[k]) byLf[k].push(r); else ohne.push(r); });
    return { byId, byLf, ohne };
  }
  /* Abdeckung je Lab: { lab: { n, z, pct } } (z = einem Lernfeld zugeordnet) */
  function abdeckung(rows) {
    const o = {};
    (rows || []).forEach(r => { const a = o[r[1]] = o[r[1]] || { n: 0, z: 0, pct: 0 }; a.n++; if (lfOf(r)) a.z++; });
    Object.keys(o).forEach(k => { o[k].pct = o[k].n ? Math.round(100 * o[k].z / o[k].n) : 0; });
    return o;
  }
  /* Lernstand: res = { id: Prozent } (sim.done und lm4.tdone gemischt, höchster Wert); gelöst = 100 */
  function stand(rows, res) {
    res = res || {}; const n = rows.length, done = rows.filter(r => (+res[r[0]] || 0) >= 100).length, begun = rows.filter(r => (+res[r[0]] || 0) > 0 && (+res[r[0]] || 0) < 100).length;
    return { n, done, begun, open: n - done, pct: n ? Math.round(100 * done / n) : 0 };
  }

  /* ---------------------------------------------------------------- 3. Probetest */
  const MIN_FRAGEN = 8, STD_FRAGEN = 12, MIN_JE_A = 2.5, MIN_JE_B = 6;   // Minuten je Mehrfachwahl-Frage / je Rechenaufgabe wie im Prüfungsmodus (pruefexam.js)
  const PTS_A = 2, PTS_B = 4;                                            // Punkte wie PR_BANK (Mehrfachwahl 2, Rechnen 4)
  /* IHK-Notenschlüssel, identisch zu NOTE in pruefwerk.js (ab 92 % sehr gut, 81 gut, 67 befriedigend, 50 ausreichend, 30 mangelhaft) */
  const note = p => (p >= 92 ? [1, 'sehr gut'] : p >= 81 ? [2, 'gut'] : p >= 67 ? [3, 'befriedigend'] : p >= 50 ? [4, 'ausreichend'] : p >= 30 ? [5, 'mangelhaft'] : [6, 'ungenügend']);
  const BESTEHT = 50;

  /* Themen des Prüfungs-Pools (PR_POOL.q: g = Gruppe, th = Thema) -> Lernfeld. Die erste passende Regel gewinnt. */
  const POOL_RE = [
    [/Daten(schutz|sicherheit|sicherung)|Netzwerk|IT-Sicherheit|Betriebssystem|Computer|Rechnertechnik|SSD|USB|Datenträger|Displaytechnik|Kommunikation|im PC|Datenbus/, '7.1'],
    [/Qualit/, '10.2'],
    [/Prüfung elektrischer|Prüfen von Anlagen|Normen und Vorschriften|Induktion/, '5.2'],
    [/RFID|Identifikation/, '8.2'],
    [/Energieversorgung|Stromversorgung/, '5.3'],
    [/Projekt|Lasten|Pflichtenheft/, 'E12'],
    [/Fachenglisch/, 'FE'],
    [/Instandhaltung/, '9.3'],
    [/Z-Diode|Spannungsregler|LM317|Linearregler|Schaltregler|Schaltwandler|MC34063|Stabilisierung|Strombegrenzung|7805|Spannungsversorgung|Netzteil \/ Schutzbeschaltung/, '9.2'],
    [/Kühlkörper|Sperrschichttemperatur|Verlustleistung|Thermik/, '5.3'],
    [/Analog.?Digital|A\/D|D\/A|Umsetz|Sensorik|Messumformer|4.{1,4}20 ?mA|Pt ?100|Pt ?1000|Näherungssensor|Stromschnittstelle|Einheitssignal|Messbrücke|Signal-Rauschabstand|Signaltechnik|Dämpfung|Dezibel|Pegel|Filter \/ Dezibel/, '8.2'],
    [/Operationsverstärker|Summierverstärker|Verstärker|Integrierer|Schmitt/, '6.2'],
    [/Zahlensysteme|Speicher|Adressbus|Adressbereich|Multiplexer|Dekoder|Decoder|Tri-State|Datenblatt lesen/, '7.1'],
    [/Open-Collector|Open-Drain|Fan-out|[Zz]ähler|Flipflop|Latch|Kipp|555|Zeitgeber|Timer|Signalaufbereitung|Treiber/, '9.1'],
    [/Mikrocontroller|Watchdog|Interrupt|PWM|Bussystem|I2C|SPI|UART|Serielle|Datenübertragung|Port-Expander|Digitalpot|Schieberegister|7-Segment|Eingang beschalten|LM3914|Bauelement-Ersatz|Schrittmotor/, 'E12'],
    [/Programmablaufplan|PAP/, '11.1'],
    [/SPS|GRAFCET|Steuerungstechnik|Not-Halt|Regelungstechnik|Zweipunktregler|Aktorik|Freilaufdiode/, '10.1'],
    [/Wechselstrom|Blindleistung|Blindwiderstand|Spule|Schwingkreis|Resonanz|Filter|RC-Tiefpass|RC-Glied|Kondensator|Transformator|EMV/, '5.2'],
    [/Siebglied/, '5.3'],
    [/Schutzklassen|Schutzart|Schutzisolierung|Geräteprüfung|Prüfung nach DIN|Typenschild|Fehlerarten/, '5.2'],
    [/Messtechnik|Messfehler|Messunsicherheit|Genauigkeit|Fehlergrenze|Leistungsanpassung/, 'E1'],
    [/Transistor|LED|Leuchtdiode|Optokoppler|Bauelement|Schaltungstechnik|Grundschaltungen|Halbleiter|Relais/, '6.1']
  ];
  const POOL_G = { sich: '5.1', steu: '10.1', opv: '6.2', netz: '5.3', bus: 'E12', digi: '7.2', halb: '6.1', mcu: 'E12', mess: '8.2', qm: '10.2', grund: 'E1', wiso: null };
  function poolLF(q) {
    if (!q || q.g === 'wiso') return null;   // Wirtschafts- und Sozialkunde gehört zu keinem Lernfeld
    const th = String(q.th || '');
    for (let i = 0; i < POOL_RE.length; i++) if (POOL_RE[i][0].test(th)) return POOL_RE[i][1];
    return has(POOL_G, q.g) ? POOL_G[q.g] : null;
  }
  /* PR_BANK.MC-Eintrag [Thema, Frage, richtig, falsch1, falsch2, falsch3, Erklärung]; nur die acht Elektronik-Themen (Berufsthemen haben Präfix, z. B. im_) */
  const BANK_T = { grund: 'E1', bauteile: '6.1', wechsel: '5.2', digital: '7.2', messen: 'E1', strom: '5.3', mcu: 'E12', sicher: '5.1' };
  const BANK_RE = [
    [/Oszilloskop|Zeitbasis|Tastkopf/, 'E6'],
    [/Operationsverstärker|\bOPV\b|Schmitt|Komparator/, '6.2'],
    [/Z-Diode|Linearregler|Schaltregler|LM317|7805|Spannungsregler|stabilis/i, '9.2'],
    [/Flipflop|Zähler|Schieberegister|\b555\b/, '9.1'],
    [/Zahlensystem|hexadezimal|Zweierkomplement|Dualzahl|binär/i, '7.1'],
    [/Brandklasse|Löschmittel|Feuerlöscher|Brandschutz|Sicherheitszeichen/, 'E13'],
    [/Schutzklasse|Schutzart|IP\d\d|Typenschild/, '5.2'],
    [/\bSPS\b|Schütz|Selbsthaltung|GRAFCET/, '10.1'],
    [/Sensor|Pt100|Analog-Digital|Normsignal|4.{1,4}20 ?mA/, '8.2'],
    [/Kühlkörper|Wärmewiderstand|Sperrschichttemperatur/, '5.3'],
    [/Arbeitspunkt|Kennlinie/, '6.1']
  ];
  function bankLF(m) {
    if (!m || !has(BANK_T, m[0])) return null;
    const txt = String(m[1] || '') + ' ' + String(m[2] || '');
    for (let i = 0; i < BANK_RE.length; i++) if (BANK_RE[i][0].test(txt)) return BANK_RE[i][1];
    return BANK_T[m[0]];
  }

  /* Alle Fragen des Lernfelds im Einheitsformat von PrWerk: { id, k, src, type:'mc'|'num', q, opts, r, ans, unit, tol, w, pts, n }.
     pool = PR_POOL (oder dessen .q), bank = PR_BANK.MC. Die Optionen stehen noch in der Quellreihenfolge (gemischt wird in probe()). */
  function fragen(lfKey, pool, bank) {
    const out = [], P = Array.isArray(pool) ? pool : (pool && pool.q) || [], B = Array.isArray(bank) ? bank : [];
    P.forEach(q => {
      if (poolLF(q) !== lfKey) return;
      if (q.o) out.push({ id: q.id, k: q.g, src: 'pool', type: 'mc', q: q.q, opts: q.o.slice(), r: q.r, w: q.w || '', pts: PTS_A, n: q.n || 2 });
      else if (isFinite(+q.ans)) out.push({ id: q.id, k: q.g, src: 'pool', type: 'num', q: q.q, ans: +q.ans, unit: q.u || '', tol: q.tol == null ? 0.02 : q.tol, w: q.w || '', pts: PTS_B, n: q.n || 2 });
    });
    B.forEach((m, i) => {
      if (bankLF(m) !== lfKey) return;
      out.push({ id: 'mc' + i, k: m[0], src: 'bank', type: 'mc', q: m[1], opts: [m[2], m[3], m[4], m[5]], r: 0, w: m[6] || '', pts: PTS_A, n: 2 });
    });
    return out;
  }
  /* Anzahl passender Fragen je Lernfeld: { lfKey: { n, mc, num } } */
  function fragenZahl(pool, bank) {
    const o = {}; LF.forEach(l => { o[l.k] = { n: 0, mc: 0, num: 0 }; });
    const P = Array.isArray(pool) ? pool : (pool && pool.q) || [], B = Array.isArray(bank) ? bank : [];
    P.forEach(q => { const k = poolLF(q); if (!k || !o[k]) return; if (q.o) { o[k].mc++; o[k].n++; } else if (isFinite(+q.ans)) { o[k].num++; o[k].n++; } });
    B.forEach(m => { const k = bankLF(m); if (!k || !o[k]) return; o[k].mc++; o[k].n++; });
    return o;
  }
  const seeded = seed => { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return { f, shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t2 = x[i]; x[i] = x[j]; x[j] = t2; } return x; } }; };
  const minuten = items => Math.ceil(items.reduce((s, q) => s + (q.type === 'num' ? MIN_JE_B : MIN_JE_A), 0));
  /* Probetest ziehen. cfg = { n: Wunschzahl (Standard 12), seed }. Rückgabe { ok, grund, verfuegbar, items, minuten, n }.
     Rechenaufgaben höchstens ein Viertel; fehlen sie, kommen keine dazu, fehlen Mehrfachwahl-Fragen, werden nur die vorhandenen genommen. */
  function probe(lfKey, pool, bank, cfg) {
    cfg = cfg || {}; const all = fragen(lfKey, pool, bank), n0 = Math.max(1, Math.floor(+cfg.n || STD_FRAGEN)), seed = cfg.seed == null ? 1 : cfg.seed;
    if (!LFK[lfKey]) return { ok: false, grund: 'Unbekanntes Lernfeld.', verfuegbar: 0, items: [], minuten: 0, n: 0 };
    if (all.length < MIN_FRAGEN) return { ok: false, grund: 'Für dieses Lernfeld gibt es noch zu wenige passende Fragen (' + all.length + ' vorhanden, mindestens ' + MIN_FRAGEN + ' nötig). Es wird nichts aufgefüllt. Übe stattdessen die Aufgaben des Lernfelds.', verfuegbar: all.length, items: [], minuten: 0, n: 0 };
    const r = seeded(seed), mc = r.shuffle(all.filter(q => q.type === 'mc')), nu = r.shuffle(all.filter(q => q.type === 'num'));
    const n = Math.min(n0, all.length), nNum0 = Math.min(nu.length, Math.floor(n / 4)), nMc = Math.min(mc.length, n - nNum0), nNum = Math.min(nu.length, n - nMc);
    const pick = mc.slice(0, nMc).concat(nu.slice(0, nNum));
    const items = r.shuffle(pick).map(q => {
      if (q.type !== 'mc') return Object.assign({}, q);
      const idx = r.shuffle(q.opts.map((_, i) => i)); return Object.assign({}, q, { opts: idx.map(i => q.opts[i]), r: idx.indexOf(q.r) });
    });
    return { ok: true, grund: '', verfuegbar: all.length, items, minuten: minuten(items), n: items.length, kurz: items.length < n0 };
  }
  const zahl = v => { const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function isRight(q, a) {   // wie PrWerk.isRight
    if (a == null || a === '') return false;
    if (q.type === 'mc') return a === q.r;
    const x = zahl(a); if (isNaN(x)) return false;
    return q.tol === 0 ? Math.abs(x - q.ans) < 0.5 : Math.abs(x - q.ans) <= Math.max(q.tol * Math.abs(q.ans), 1e-9);
  }
  /* Auswertung: ans = { id: Antwort (Index bei Mehrfachwahl, Zahl oder Text bei Rechnen) } -> { pts, max, pct, note: [Zahl, Text], richtig, n, bestanden } */
  function bewerte(items, ans) {
    ans = ans || {}; let pts = 0, max = 0, richtig = 0;
    items.forEach(q => { max += q.pts; if (isRight(q, ans[q.id])) { pts += q.pts; richtig++; } });
    const pct = max ? Math.round(100 * pts / max) : 0, nt = note(pct);
    return { pts, max, pct, note: nt, richtig, n: items.length, bestanden: pct >= BESTEHT };
  }

  const API = { LJ, LF, lf, REGELN, AUSNAHMEN, NEU_V48_163, lfOf, zuordnung, abdeckung, stand,
    MIN_FRAGEN, STD_FRAGEN, MIN_JE_A, MIN_JE_B, PTS_A, PTS_B, BESTEHT, note, poolLF, bankLF, fragen, fragenZahl, probe, isRight, bewerte, minuten, seeded };
  root.LERNFELDER = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
