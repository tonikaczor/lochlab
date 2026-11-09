'use strict';
/* Tonfunk IT-Systeme-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Zuordnungen, Beispiele).
   ALLE Zahlen (Adressbreiten, Speichergrößen, Taktraten) sind ÜBUNGSWERTE, nicht für die Auswahl echter Bauteile.
   window.SYS_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, sets, scen }
   window.SYS_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'sys', Status in localStorage 'lm4.sys.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Antwortarten: num (Zahl), base (Hex- oder Dualzahl), choice (Auswahl), match (Zuordnung je Zeile), order (Reihenfolge).
   Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder das Ergebnis noch die Fehlerursache (die Fehlersuche heißt "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, die Reihenfolge der Antworten wird gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.SYS_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const hx = (n, d) => C().hex(n, d);
  const CATS = ['IT-Systeme und EVA', 'Geräteklassen', 'System konfigurieren', 'Busse', 'Speicherarten', 'Adressraum und Speichergröße', 'Zahlensysteme im Rechner', 'Mikroprozessorsystem', 'Fehlersuche'];

  /* ---------- Frage-Bausteine ---------- */
  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  const baseQ = (text, value, base, bits, label, expl, tips) => ({ text, ask: { type: 'base', base, bits, unit: base === 16 ? 'hex' : 'dual', label }, value, tol: 0, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  /* Zuordnung: Gruppen { cats, groups: [[Kategorieindex, [Texte]]] }; distinct: je Kategorie genau eine Zeile */
  function matchQ(R, text, set, n, distinct, tips) {
    const c = C(); let rows = [];
    if (distinct) rows = c.shuffle(R, set.groups).slice(0, n).map(g => [g[0], c.pick(R, g[1])]);
    else { const all = []; set.groups.forEach(g => g[1].forEach(t => all.push([g[0], t]))); for (let i = 0; i < 40 && (rows.length < n || new Set(rows.map(x => x[0])).size < 2); i++) rows = c.shuffle(R, all).slice(0, n); }
    const items = rows.map(r => r[1]), correct = rows.map(r => r[0]);
    return { text, ask: { type: 'match', items, cats: set.cats.slice(), correct }, value: correct.join(','), tol: 0, tips,
      expl: rows.map(r => '„' + r[1] + '“ gehört zu ' + set.cats[r[0]] + '.').join(' ') };
  }
  function orderQ(R, text, steps, expl, tips) {
    const c = C(); let items = c.shuffle(R, steps);
    for (let i = 0; i < 20 && items.every((t, k) => t === steps[k]); i++) items = c.shuffle(R, steps);
    const correct = steps.map(s => items.indexOf(s));
    return { text, ask: { type: 'order', items, correct }, value: correct.join(','), tol: 0, expl, tips };
  }

  /* ---------- Zuordnungs-Mengen ---------- */
  /* PRUEFEN P7: Alle Zuordnungen und Fragen stammen aus der Mitschrift Lernfeld 7.1 (in eigenen Worten); wo die Handschrift unleserlich war (OCR), sind nur gesicherte Aussagen übernommen. Fehlt etwas, was im Unterricht Pflicht ist (z. B. USB-Ports, Chipsatz, Netzteil im IT-System)? */
  const SETS = {
    eva: { cats: ['Eingabe', 'Verarbeitung', 'Ausgabe'], groups: [
      [0, ['Tastatur', 'Barcode-Scanner', 'Mikrofon', 'Temperaturfühler']],
      [1, ['Prozessor (CPU)', 'Rechenwerk, das Zahlen addiert', 'Programm, das Messwerte auswertet']],
      [2, ['Monitor', 'Drucker', 'Lautsprecher', 'Signalleuchte']]] },
    dev: { cats: ['Desktop-PC', 'Notebook', 'Tablet', 'Smartphone', 'Barebone-PC', 'Industrie-PC'], groups: [
      [0, ['Hauptplatine mit den wichtigsten Verarbeitungseinheiten und Anschlüssen; Monitor und Tastatur sind getrennte Geräte', 'Steht fest am Platz und lässt sich mit Steckkarten erweitern']],
      [1, ['Tragbar, Tastatur, Bildschirm und Laufwerke sind im Gehäuse untergebracht', 'Kann an einer Dockingstation weitere Anschlüsse bekommen']],
      [2, ['Mobil, in einem sehr flachen Gehäuse und ohne Maus und Tastatur', 'Wird mit dem Finger auf dem Bildschirm bedient']],
      [3, ['Kleinstcomputer, auf dem man eigene Anwendungen installiert, mit Telefon- und Sensorfunktion', 'Hat GPS, Bewegungs- und Fingerabdrucksensor eingebaut']],
      [4, ['Rechner im würfelförmigen Gehäuse', 'Kompakter Würfel, der wenig Platz braucht']],
      [5, ['Muss Hitze, Stöße und Wasser vertragen und lange lieferbar bleiben', 'Rechner für Aufgaben im industriellen Bereich']]] },
    phone: { cats: ['Kommunikation', 'Datenverbindung', 'Sensoren', 'Organizer-Funktionen', 'Navigation'], groups: [
      [0, ['Telefonanruf', 'SMS', 'E-Mail']],
      [1, ['Bluetooth', 'WLAN', 'USB', '5G']],
      [2, ['Lichtsensor', 'Bewegungssensor', 'Fingerabdrucksensor', 'Temperatursensor']],
      [3, ['Kalender', 'Uhr', 'Kontaktliste']],
      [4, ['GPS-Empfänger', 'Routenanzeige auf der Karte']]] },
    /* PRUEFEN P15: Die Zuordnung Situation -> Anforderung beim Industrie-PC (Brennofen = Temperatur, Presse = Schock, Hochdruckreiniger = Wasser, Frequenzumrichter = EMV, Dauerbetrieb = Ausfallsicherheit, 15 Jahre = Langzeitverfügbarkeit) ist von mir formuliert, nur die sechs Anforderungen stehen in der Mitschrift. Sind die Situationen eindeutig genug, oder kommen aus eurer Werkstatt bessere Beispiele? */
    ind: { cats: ['Temperaturresistenz', 'Schockresistenz', 'Wasserdichtheit', 'EMV-Schutz', 'Ausfallsicherheit', 'Langzeitverfügbarkeit'], groups: [
      [0, ['Der Rechner steht neben einem Brennofen und im Winter in einer ungeheizten Halle', 'Im Schaltschrank wird es im Sommer weit über 50 °C heiß']],
      [1, ['Eine Presse erschüttert bei jedem Hub den Boden', 'Ein Gabelstapler rempelt ab und zu den Schrank an']],
      [2, ['Die Halle wird mit dem Hochdruckreiniger gesäubert', 'Kühlschmierstoff spritzt auf das Gerät']],
      [3, ['Direkt daneben läuft ein großer Frequenzumrichter mit starker Störstrahlung', 'Ein Schweißroboter erzeugt starke elektromagnetische Felder']],
      [4, ['Fällt der Rechner aus, steht die ganze Fertigungslinie still', 'Die Anlage läuft rund um die Uhr ohne Pause']],
      [5, ['Die Anlage soll 15 Jahre laufen und der gleiche Rechner muss im Schadensfall noch lieferbar sein', 'Der Hersteller soll das Modell viele Jahre unverändert weiter anbieten']]] },
    bus: { cats: ['Adressbus', 'Datenbus', 'Steuerbus'], groups: [
      [0, ['Trägt die Adresse einer Speicherzelle oder einer Ein-/Ausgabeschaltung', 'Bei 16 Leitungen lassen sich 65.536 Adressen unterscheiden']],
      [1, ['Arbeitet in beide Richtungen (bidirektional)', 'Hier schalten Bausteine mit Tri-State-Ausgängen ihre Information durch', 'Hier steht beim Schreiben das Datenwort, das der Speicher übernimmt']],
      [2, ['Führt Signale wie MEMR, MEMW, IOR und IOW', 'Legt fest, ob gelesen oder geschrieben wird und ob Speicher oder Ein-/Ausgabe gemeint ist']]] },
    ctrl: { cats: ['MEMR', 'MEMW', 'IOR', 'IOW'], groups: [
      [0, ['Der Speicher schaltet seine Information auf den Datenbus']],
      [1, ['Der Speicher übernimmt die Information vom Datenbus']],
      [2, ['Die Eingabeeinheit schaltet ihre Information auf den Datenbus']],
      [3, ['Die Ausgabeeinheit übernimmt die Information vom Datenbus und gibt sie an ihre Ausgangsleitungen']]] },
    mem: { cats: ['Schreib-Lese-Speicher (RAM)', 'Festwertspeicher, einmal programmierbar', 'Festwertspeicher, mehrfach programmierbar'], groups: [
      [0, ['SRAM (statischer RAM)', 'DRAM (dynamischer RAM)']],
      [1, ['PROM', 'ROM']],
      [2, ['EPROM', 'EEPROM']]] },
    comp: { cats: ['CPU', 'ROM', 'RAM', 'Ein-/Ausgabe (I/O)', 'Adressdecoder', 'Bus'], groups: [
      [0, ['Verarbeitet die im Programmspeicher stehenden Befehle', 'Führt mathematische, logische und Ein-/Ausgabeoperationen aus']],
      [1, ['Nur-Lese-Speicher mit festem Inhalt für Programm und feste Daten', 'Behält seinen Inhalt auch ohne Betriebsspannung']],
      [2, ['Schreib-Lese-Speicher für Daten und Zwischenergebnisse', 'Verliert beim Ausschalten seinen Inhalt']],
      [3, ['Schaltungen, über die der Rechner mit peripheren Geräten Daten austauscht', 'Hier hängen zum Beispiel Schalter und Anzeigen an']],
      [4, ['Wählt anhand der Adressleitungen genau einen Baustein aus', 'Macht aus den oberen Adressbits ein Auswahlsignal für einen Baustein']],
      [5, ['Leitungsbündel, an dem alle Funktionseinheiten parallel angeschlossen sind', 'Sammelleitungen für Adressen, Daten und Steuersignale']]] },
    cpu: { cats: ['ALU', 'Steuerwerk', 'Registersatz', 'Adresswerk', 'Stapelspeicher (Stack)', 'Systembusschnittstelle'], groups: [
      [0, ['Führt arithmetische, logische und Schiebeoperationen aus', 'Rechnet mit dem Akkumulator und liefert das Ergebnis dorthin zurück']],
      [1, ['Regelt, in welcher Reihenfolge Befehle geholt und decodiert werden', 'Sorgt dafür, dass eine Funktionseinheit nur eine Aufgabe zur Zeit ausübt']],
      [2, ['Speichert kurzzeitig Ergebnisse, Adressen und Operanden', 'Kurzzeitspeicher für Zwischenwerte bei Rechnungen']],
      [3, ['Berechnet die Adresse eines Operanden oder Befehls im Speicher', 'Liefert nach Vorgabe des Steuerwerks die Speicheradresse']],
      [4, ['Das zuletzt eingeschriebene Datum wird als erstes wieder ausgelesen', 'Ein Stackpointer zeigt auf seine aktuelle Position']],
      [5, ['Puffert Adressen und Daten und passt die Signale elektrisch an die äußeren Bausteine an', 'Verbindung zwischen dem Prozessorinneren und den Systembussen']]] },
    cmd: { cats: ['Datentransport', 'Arithmetik', 'Logik', 'Schieben', 'Sprung', 'Ein-/Ausgabe', 'Sonstiges'], groups: [
      [0, ['MOV B, A', 'MVI A, 00']],
      [1, ['ADD B', 'INR C', 'DCR A']],
      [2, ['ANA B', 'ORA C']],
      [3, ['RAL', 'RLC']],
      [4, ['JMP 0009', 'JZ 0000']],
      [5, ['IN 00', 'OUT 01']],
      [6, ['NOP', 'HLT']]] }
  };

  /* ---------- Reihenfolgen ---------- */
  const ORD = {
    eva: [
      ['Ein Taschenrechner soll 3 + 4 berechnen.', ['Du tippst 3, +, 4 und die Ergebnistaste.', 'Der Prozessor addiert die beiden Zahlen.', 'Die Anzeige zeigt das Ergebnis 7.']],
      ['Ein Heizungsregler arbeitet nach dem EVA-Prinzip.', ['Ein Fühler misst die Raumtemperatur.', 'Der Regler vergleicht den Messwert mit dem Sollwert.', 'Der Regler öffnet das Heizventil.']],
      ['Ein Geldautomat bearbeitet eine Auszahlung.', ['Der Kunde gibt den Betrag über die Tasten ein.', 'Das System prüft das Guthaben und bucht den Betrag.', 'Der Automat gibt die Scheine aus.']],
      ['Eine Kasse bearbeitet einen Artikel.', ['Der Scanner liest den Strichcode ein.', 'Die Kasse sucht den Preis zur Artikelnummer.', 'Der Preis erscheint auf dem Display.']]],
    bus: [
      ['Eine Zahl soll an eine Ausgabeeinheit ausgegeben werden (Schreibzugriff).', ['Die CPU legt die Adresse der Ausgabeeinheit auf den Adressbus.', 'Die CPU legt das Datenwort auf den Datenbus.', 'Die CPU gibt das Steuersignal IOW aus.']],
      ['Die CPU liest ein Datenwort aus einem Baustein (Lesezugriff).', ['Die CPU legt die Adresse des Bausteins auf den Adressbus.', 'Die CPU gibt das Steuersignal zum Lesen aus.', 'Der Baustein legt sein Datenwort auf den Datenbus.', 'Die CPU übernimmt das Datenwort vom Datenbus.']],
      ['Der Befehl IN 09 (Eingabegruppe mit der Adresse 09 in den Akkumulator einlesen) läuft in drei Maschinenzyklen ab.', ['M1: Der Operationscode IN wird aus dem Speicher gelesen und entschlüsselt.', 'M2: Die Portadresse 09 wird aus dem Speicher geholt.', 'M3: Die Eingabedaten werden gelesen und in den Akkumulator übertragen.']]]
  };
  const orderGen = (R, arg) => {
    const c = C(), set = ORD[arg.set], i = arg.idx && arg.idx.length ? c.pick(R, arg.idx) : c.ri(R, 0, set.length - 1), s = set[i];
    return orderQ(R, s[0] + ' Bringe die Schritte in die richtige Reihenfolge: Tippe sie nacheinander an, beginnend mit dem ersten Schritt.', s[1], 'Die richtige Reihenfolge: ' + s[1].map((t, k) => (k + 1) + '. ' + t).join(' '),
      arg.set === 'eva' ? ['Zuerst kommt immer die Eingabe, am Ende die Ausgabe.', 'Dazwischen liegt die Verarbeitung der eingegebenen Werte.'] : ['Ohne Adresse weiß kein Baustein, dass er gemeint ist.', 'Die Daten werden erst übernommen, wenn das Steuersignal sagt, was passieren soll bzw. wer sendet.']);
  };

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P8: Fragen zu einfachen und vernetzten IT-Systemen, EVA-Prinzip und Stand-alone-Betrieb nach der Mitschrift (einfaches System: alle Ein- und Ausgabegeräte in unmittelbarer Nähe der verarbeitenden Komponente). Die Beschreibung des vernetzten Systems ist ergänzt, weil sie in der Mitschrift nicht ausgeführt ist. Passt das? */
  const EVQ = [
    ['Was bedeutet das EVA-Prinzip?', 'Eingabe, Verarbeitung, Ausgabe', ['Energie, Verbrauch, Abschaltung', 'Erfassen, Verteilen, Archivieren', 'Einschalten, Verbinden, Anmelden'], 'Ein IT-System nimmt Informationen entgegen (Eingabe), verarbeitet sie und gibt das Ergebnis aus.', ['Es beschreibt den Weg der Informationen durch das System.', 'Die drei Buchstaben stehen für drei Schritte.']],
    ['Woran erkennst du ein einfaches IT-System?', 'Alle Ein- und Ausgabegeräte stehen unmittelbar bei der verarbeitenden Komponente', ['Mehrere Rechner tauschen über ein Netz laufend Daten mit einer Zentrale aus', 'Es besteht ausschließlich aus Speicherbausteinen und führt keinerlei Verarbeitung durch', 'Es kann Daten nur ausgeben, aber niemals Eingaben von außen entgegennehmen'], 'Beim einfachen IT-System sind Eingabe, Verarbeitung und Ausgabe räumlich zusammen. Daher spricht man vom Stand-alone-Betrieb.', ['Denk an den Abstand zwischen Tastatur, Rechner und Bildschirm.', 'Es kommt ohne Verbindung zu anderen Systemen aus.']],
    ['Was bedeutet Stand-alone-Betrieb?', 'Das System arbeitet für sich allein und ohne Verbindung zu anderen Systemen', ['Das System läuft ausschließlich mit Akku und wird nie am Netzstecker betrieben', 'Das System darf immer nur von einem einzigen angemeldeten Benutzer bedient werden', 'Das System steckt in einem geschlossenen Gehäuse ohne irgendwelche Anschlüsse nach außen'], 'Stand alone heißt: allein stehend. Alle Geräte, die das System braucht, sind direkt bei ihm.', ['Übersetze den englischen Begriff.', 'Es geht um die Verbindung zu anderen Systemen, nicht um die Stromversorgung.']],
    ['Ein Heim-PC mit Monitor, Tastatur und Drucker steht am selben Tisch und hat keinen Netzwerkanschluss. Welche Art von System ist das?', 'Ein einfaches IT-System', ['Ein vernetztes IT-System', 'Ein verteiltes System mit Server', 'Ein reines Ausgabesystem'], 'Alle Geräte sind in unmittelbarer Nähe und es gibt keine Verbindung nach außen, damit ist es ein einfaches System im Stand-alone-Betrieb.', ['Achte darauf, was im Text über das Netz steht.', 'Alle Geräte stehen am selben Tisch.']],
    ['Welcher Vorgang gehört zur Verarbeitung?', 'Der Prozessor addiert zwei Zahlen', ['Der Benutzer tippt eine Zahl ein', 'Der Bildschirm zeigt das Ergebnis an', 'Der Scanner liest ein Blatt ein'], 'Rechnen und Auswerten ist Verarbeitung. Tippen und Scannen sind Eingaben, die Anzeige ist eine Ausgabe.', ['Wer rechnet in einem IT-System?', 'Eingabe und Ausgabe sind die Geräte an den Enden.']],
    ['Was unterscheidet ein vernetztes IT-System von einem einfachen?', 'Die Komponenten sind über ein Netz verbunden und können räumlich verteilt sein', ['Es hat keinen eigenen Prozessor und arbeitet ausschließlich mit Speicherbausteinen', 'Es verarbeitet Informationen vollständig ohne jede Ein- oder Ausgabe von Daten', 'Es besteht immer aus genau einem einzigen Gerät, das alle Aufgaben allein erledigt'], 'Im vernetzten System arbeiten mehrere Geräte über Leitungen oder Funk zusammen, auch wenn sie weit auseinander stehen.', ['Das Gegenstück zu Stand alone.', 'Das Wort steckt im Namen: Netz.']]
  ];
  /* PRUEFEN P9: Beschreibungen der Geräteklassen (Desktop, Notebook, Dockingstation, Tablet, Netbook, Smartphone, Barebone, Industrie-PC, Small-Form-Factor-PCs) stehen so in der Mitschrift; Nettop als "kleiner, sparsamer Rechner für einfache Aufgaben" ist allgemeines Wissen. Stimmt das, oder soll der Barebone als "Gehäuse mit Netzteil und Mainboard zum Selbstbestücken" beschrieben werden? */
  const DEVQ = [
    ['Welche Geräteklasse ist ein tragbarer PC, in dessen Gehäuse Tastatur, Bildschirm und Laufwerke untergebracht sind?', 'Notebook', ['Desktop-PC', 'Tablet', 'Barebone-PC'], 'Beim Notebook ist alles, was zum Arbeiten nötig ist, im tragbaren Gehäuse vereint.', ['Er ist tragbar und hat die Tastatur eingebaut.', 'Er braucht keinen getrennten Monitor.']],
    ['Welche Geräteklasse ist ein mobiler PC in einem sehr flachen Gehäuse ohne Maus und Tastatur?', 'Tablet', ['Notebook', 'Small-Form-Factor-PC', 'Netbook'], 'Das Tablet wird über den Touchscreen bedient. Konvertible Tablets (Two-in-One) bekommen bei Bedarf eine Tastatur.', ['Die Bedienung geschieht mit dem Finger.', 'Das Gehäuse ist besonders flach.']],
    ['Welche Geräteklasse ist für Aufgaben im industriellen Bereich gebaut und muss zum Beispiel Stöße und Wasser vertragen?', 'Industrie-PC', ['Desktop-PC', 'Small-Form-Factor-PC', 'Barebone-PC'], 'Typische Anforderungen sind Temperatur-, Schock- und Wasserfestigkeit, EMV-Schutz, Ausfallsicherheit und Langzeitverfügbarkeit.', ['Denk an die Umgebung in der Werkhalle.', 'Es geht um raue Umgebungsbedingungen.']],
    ['Welche Geräteklasse steckt in einem würfelförmigen Gehäuse?', 'Barebone-PC', ['Desktop-PC im Tower', 'Notebook mit Dockingstation', 'Tablet mit Hülle'], 'Der Barebone ist ein kleiner, würfelförmiger PC, der wenig Platz braucht.', ['Die Form gibt den Hinweis.', 'Es ist ein Kompakt-PC.']],
    ['Wie heißt die Zusatzeinrichtung, die einem Notebook Erweiterungssteckplätze und Anschlüsse für weitere Peripheriegeräte bietet?', 'Dockingstation', ['Hauptplatine', 'Netzfilter', 'Barebone-Gehäuse'], 'Das Notebook wird in die Dockingstation gesteckt oder an sie angeschlossen und bekommt so zusätzliche Anschlüsse.', ['Das Notebook wird dort „angedockt“.', 'Es ist ein Zubehör, kein Rechner.']],
    ['Welche Geräteklasse ist ein Kleinstcomputer, auf dem der Benutzer eigene Anwendungen installieren kann?', 'Smartphone', ['Netbook', 'Industrie-PC', 'E-Book-Reader'], 'Das Betriebssystem erlaubt die Installation individueller Anwendungen. Dazu kommen Telefon, Sensoren und Navigation.', ['Er passt in die Hosentasche.', 'Er kann telefonieren.']],
    ['Welche Geräteklasse hat deutlich weniger Ausstattung und Rechenleistung als ein Notebook?', 'Netbook', ['Tablet', 'Desktop-PC', 'Industrie-PC'], 'Das Netbook ist eine abgespeckte, kleine Notebook-Bauart für einfache Aufgaben.', ['Es ist ein „Notebook light“.', 'Rechenleistung und Ausstattung sind geringer.']],
    ['Auf welcher Platine sitzen beim Desktop-PC die wichtigsten Verarbeitungseinheiten und Anschlüsse?', 'Hauptplatine', ['Netzteilplatine', 'Anzeigeplatine', 'Dockingplatine'], 'Die Hauptplatine (Mainboard) trägt Prozessor, Speicher und die Anschlüsse und verbindet sie.', ['Der Name sagt, dass sie die wichtigste Platine ist.', 'Auf Englisch heißt sie Mainboard.']],
    ['Welcher Rechner gehört zu den Small-Form-Factor-PCs, weil der Rechner im Bildschirmgehäuse steckt?', 'All-in-One-PC', ['Desktop-PC im Tower', 'Industrie-PC im Schaltschrank', 'Notebook mit Dockingstation'], 'Zu den kleinen Bauformen zählen Nettop, All-in-One-PC, Ultra-Mobile-PC, E-Book-Reader und Wearable-Computer.', ['Alles in einem Gerät.', 'Der Bildschirm ist zugleich das Gehäuse.']],
    ['Welches Gerät gehört als Wearable-Computer zu den Small-Form-Factor-PCs?', 'Ein Fitnessarmband mit Prozessor und Sensoren', ['Ein Rechner im Schaltschrank neben der Maschine', 'Ein Tower mit drei Festplatten und Grafikkarte', 'Ein Notebook mit Dockingstation am Schreibtisch'], 'Wearable bedeutet am Körper getragen. Solche Kleinstrechner stecken in Armbändern oder Uhren.', ['Wearable lässt sich von „tragen“ ableiten.', 'Gemeint ist ein Gerät, das du am Körper trägst.']]
  ];
  /* PRUEFEN P10: Busse nach der Mitschrift: Datenbus bidirektional mit Tri-State-Ausgängen, Adress- und Steuerbus unidirektional, Datenverkehr immer zwischen CPU und einer von ihr ausgewählten Funktionseinheit, Vorteil wenige Leitungen, Nachteil nur nacheinander (sequenziell). In der Mitschrift steht "Adressbuch" (Schreibfehler für Adressbus). Passt das? */
  const BUSQ = [
    ['Was ist ein Bus im Rechner?', 'Ein Leitungsbündel, an das alle Funktionseinheiten parallel angeschlossen sind', ['Ein Speicherbaustein, der Daten auch ohne Betriebsspannung dauerhaft speichert', 'Ein Programm im Betriebssystem, das Eingaben auswertet und weiterleitet', 'Ein Schaltkreis im Netzteil, der die Netzspannung gleichrichtet und glättet'], 'Der Bus fasst mehrere Verbindungsleitungen mit gleichartigen Signalen zusammen. Alle Bausteine hängen parallel daran.', ['Er ist eine Sammelleitung.', 'Er überträgt Signale, er speichert nicht.']],
    ['Was ist ein Vorteil der Bus-Technik?', 'Mit verhältnismäßig wenigen Leitungen tauschen viele Bausteine Informationen aus', ['Mehrere Bausteine können gleichzeitig senden, ohne sich dabei gegenseitig zu stören', 'Es werden keine Adressen mehr gebraucht, weil alle Bausteine alles mitlesen', 'Die Übertragung ist stets um ein Vielfaches schneller als mit Einzelleitungen'], 'Alle Bausteine teilen sich dieselben Leitungen. Das spart Leitungen, aber die Bausteine müssen sich abwechseln.', ['Es geht um die Zahl der Leitungen.', 'Denk daran, wie viele Leitungen ohne Bus nötig wären.']],
    ['Was ist ein Nachteil der Bus-Technik?', 'Der Austausch zwischen mehreren Bausteinen kann nur nacheinander erfolgen', ['Jeder Baustein braucht für sich eine eigene, von allen anderen getrennte Sammelleitung', 'Die Leitungen können ausschließlich Adressen und keine Daten übertragen', 'Es lassen sich höchstens zwei Bausteine gleichzeitig am Bus anschließen'], 'Weil sich alle die Leitungen teilen, kann zu einem Zeitpunkt immer nur ein Baustein senden (sequenziell).', ['Alle benutzen dieselben Leitungen.', 'Das Wort lautet „sequenziell“.']],
    ['Warum haben die am Datenbus angeschlossenen Schaltungen meist Tri-State-Ausgänge?', 'Ein nicht angesprochener Baustein wird hochohmig und stört den Bus nicht', ['Sie können dadurch drei verschiedene Spannungen gleichzeitig am Ausgang liefern', 'Sie arbeiten dadurch mit drei verschiedenen Taktsignalen zugleich', 'Sie können Daten dadurch gleichzeitig in drei Richtungen übertragen'], 'Der dritte Zustand ist hochohmig: Der Ausgang ist vom Bus getrennt. Nur der ausgewählte Baustein treibt die Leitung.', ['Zwei Ausgänge dürfen nie gleichzeitig gegeneinander treiben.', 'Der dritte Zustand ist weder 0 noch 1.']],
    ['Welchen Zustand hat ein Tri-State-Ausgang, wenn beide Ausgangstransistoren sperren?', 'Hochohmig (weder 0 noch 1)', ['Logisch 1 (High-Pegel am Ausgang)', 'Logisch 0 (Low-Pegel am Ausgang)', 'Kurzgeschlossen mit der Masse'], 'Leitet T1, ist A = 1; leitet T2, ist A = 0; sperren beide, ist der Ausgang hochohmig.', ['Es leitet gar kein Transistor.', 'Ohne Verbindung nach oben oder unten.']],
    ['Zwischen welchen Teilen läuft der Datenverkehr auf dem Bus?', 'Immer zwischen der CPU und einer von ihr ausgewählten Funktionseinheit', ['Zwischen allen angeschlossenen Bausteinen gleichzeitig und ohne Steuerung', 'Nur zwischen dem Speicher und den Ein-/Ausgabebausteinen, nie mit der CPU', 'Nur zwischen jeweils zwei Speicherbausteinen, ohne Beteiligung der CPU'], 'Die CPU steuert den Bus. Sie wählt per Adresse einen Baustein aus, mit dem sie dann Daten austauscht.', ['Wer steuert den Bus?', 'Es ist immer genau ein Partner der CPU beteiligt.']],
    ['Wie arbeitet der Adressbus?', 'In einer Richtung, von der CPU zu den Bausteinen', ['In beide Richtungen, genau wie der Datenbus auch', 'Nur in Richtung von den Bausteinen zur CPU hin', 'Gar nicht, er ist nur als Bezeichnung für den Speicher da'], 'Die CPU gibt die Adresse aus, die Bausteine liefern keine Adressen zurück. Der Adressbus ist unidirektional.', ['Wer nennt die Adresse: CPU oder Baustein?', 'Ein Pfeil genügt in der Zeichnung.']]
  ];
  /* PRUEFEN P11: Speicherarten nach der Mitschrift (Halbleiterspeicher: RAM mit statischem und dynamischem RAM, Festwertspeicher einmal programmierbar ROM/PROM und mehrfach programmierbar EPROM/EEPROM). Der Satz "DRAM muss regelmäßig aufgefrischt werden" ist allgemeines Wissen und nicht in der Mitschrift. Passt das? */
  const MEMQ = [
    ['Welcher Speicher behält seinen Inhalt ohne Betriebsspannung?', 'ROM (Festwertspeicher)', ['Statischer RAM (SRAM)', 'Dynamischer RAM (DRAM)', 'Der Cache der CPU'], 'RAM verliert seinen Inhalt beim Abschalten, ein Festwertspeicher behält ihn.', ['Welche Speicherfamilie heißt „fest“?', 'RAM ist flüchtig.']],
    ['Wofür steht die Abkürzung RAM?', 'Random Access Memory, ein Schreib-Lese-Speicher', ['Read Access Module, ein reiner Lesespeicher', 'Rapid Allocation Memory, ein Festwertspeicher', 'Random Address Machine, ein schnelles Rechenwerk'], 'Auf RAM kann man wahlfrei lesen und schreiben.', ['Das M steht für Memory.', 'Es kann beschrieben werden.']],
    ['Wofür steht die Abkürzung ROM?', 'Read Only Memory, ein Nur-Lese-Speicher', ['Random Operating Module, ein Schreibspeicher', 'Rapid Output Memory, ein Zwischenspeicher', 'Read Order Machine, ein Befehlszähler'], 'Ein ROM kann im Betrieb nur gelesen werden.', ['Only heißt nur.', 'Er hält feste Programme und Daten.']],
    ['Wozu braucht der Rechner einen Speicher?', 'Er hält Arbeitsanweisungen, zu verarbeitende Daten und Zwischenergebnisse', ['Er wandelt die Netzspannung in die für den Rechner benötigten Betriebsspannungen um', 'Er wählt über die Adressen die jeweils richtige Baugruppe aus', 'Er verbindet alle Baugruppen über gemeinsame Sammelleitungen miteinander'], 'Programme (Arbeitsanweisungen), Daten und Zwischenergebnisse müssen irgendwo stehen, bis der Prozessor sie braucht.', ['Es geht um das Aufbewahren.', 'Was muss die CPU nachlesen können?']],
    ['Welche Kennwerte beschreiben einen Speicher vor allem?', 'Speicherkapazität und Zugriffszeit', ['Taktfrequenz, Kernzahl und Cache-Größe', 'Bauform, Gehäusefarbe und Gewicht', 'Netzfrequenz, Busbreite und Leitungslänge'], 'Wie viel hineinpasst (Kapazität) und wie schnell man herankommt (Zugriffszeit).', ['Eine Größe sagt „wie viel“, die andere „wie schnell“.', 'Takt und Kerne beschreiben den Prozessor.']],
    ['Wie wird auf einzelne Speicherplätze zugegriffen?', 'Über Adressen', ['Über die Reihenfolge, in der sie beschrieben wurden', 'Über die Namen der Dateien', 'Über die Farbe der Leitungen'], 'Jeder Speicherplatz hat eine eigene Adresse; die CPU nennt sie auf dem Adressbus.', ['Jeder Platz muss eindeutig ansprechbar sein.', 'Der Adressbus wird dafür gebraucht.']],
    ['Was unterscheidet statischen und dynamischen RAM?', 'Dynamischer RAM muss regelmäßig aufgefrischt werden, statischer nicht', ['Statischer RAM behält seinen Inhalt auch ohne Betriebsspannung, dynamischer nicht', 'Dynamischer RAM kann nur gelesen werden, statischer auch beschrieben', 'Statischer RAM wird nur innerhalb von Festwertspeichern als Zelle verwendet'], 'Beim DRAM verliert die Zelle ihre Ladung und wird deshalb immer wieder aufgefrischt. SRAM braucht das nicht.', ['Die Ladung in der Zelle verschwindet mit der Zeit.', 'Beide gehören zur Gruppe der Schreib-Lese-Speicher.']]
  ];
  /* PRUEFEN P12: Fragen zum Prozessor (Cache, Akkumulator, CISC/RISC, Takt, Zyklen, Neumann-Architektur) in eigenen Worten; der Satz zur Neumann-Architektur (Befehle und Daten im gleichen Speicher) ist allgemeines Wissen, in der Mitschrift steht nur "Bau der CPUs nach der Neumann-Architektur". Passt das? */
  const CPUQ = [
    ['Welche Aufgabe hat der L1-Cache?', 'Er hält Befehle und Daten bereit, die der Prozessor als Nächstes braucht', ['Er verbindet den Prozessor direkt mit der Festplatte und dem Netzwerk', 'Er speichert das Programm dauerhaft auch ohne Betriebsspannung im Rechner', 'Er wandelt die Adressen in Auswahlsignale für die Speicherbausteine um'], 'Der L1-Cache ist ein sehr schneller Zwischenspeicher direkt im Prozessor.', ['Es ist ein Zwischenspeicher.', 'Er sitzt ganz nah an der CPU.']],
    ['Welche Aufgabe hat der L2-Cache?', 'Er ist das Bindeglied zwischen Prozessor und Arbeitsspeicher', ['Er ersetzt den Arbeitsspeicher vollständig und macht ihn überflüssig', 'Er steuert alle angeschlossenen Ein- und Ausgabegeräte des Systems', 'Er berechnet die Adressen der Operanden und der nächsten Befehle'], 'Der L2-Cache ist größer und etwas langsamer als der L1-Cache und vermittelt zum Arbeitsspeicher.', ['Er liegt zwischen CPU und RAM.', 'Er ist die zweite Stufe.']],
    ['Wozu dient der Akkumulator?', 'Er nimmt Daten für die ALU auf und das Ergebnis der Operation', ['Er zählt mit, wie viele Befehle bereits abgearbeitet worden sind', 'Er speichert dauerhaft die Adresse des nächsten Befehls im ROM', 'Er legt anhand der Adresse fest, welcher Baustein ausgewählt wird'], 'Der Akkumulator (Register A) ist das zentrale Arbeitsregister der ALU.', ['Er steht neben der ALU.', 'Ein Operand und das Ergebnis liegen dort.']],
    ['Wofür steht CISC?', 'Computer mit umfangreichem Befehlssatz', ['Computer mit besonders einfachem Befehlssatz', 'Computer mit mehreren gleichzeitig laufenden Prozessorkernen', 'Computer mit einem besonders schnellen Prozessortakt'], 'Complex Instruction Set Computer: viele, auch mächtige Befehle. RISC ist das Gegenstück mit wenigen einfachen Befehlen.', ['Das C steht für „complex“.', 'RISC bedeutet reduziert.']],
    ['Wofür steht RISC?', 'Computer mit einfachem (reduziertem) Befehlssatz', ['Computer mit besonders umfangreichem Befehlssatz', 'Computer mit mehreren getrennten Befehlsspeichern', 'Computer mit besonders vielen internen Registern'], 'Reduced Instruction Set Computer: wenige, einfache Befehle.', ['Das R steht für „reduced“.', 'CISC ist das Gegenstück.']],
    ['Was beschreibt der Befehlszyklus?', 'Die Gesamtzeit zum Bearbeiten eines Befehls', ['Die Periodendauer des Prozessortaktes', 'Eine einzelne Schreib- oder Leseoperation des Prozessors', 'Die Zeit zwischen zwei Einschaltvorgängen'], 'Ein Befehlszyklus besteht aus mehreren Maschinenzyklen; jeder Maschinenzyklus dauert mehrere Taktzyklen.', ['Er ist der größte der drei Zyklen.', 'Maschinenzyklus und Taktzyklus sind kleiner.']],
    ['Was ist ein Taktzyklus?', 'Die Periodendauer des Prozessortaktes', ['Die Gesamtzeit für einen Befehl', 'Eine Schreib- oder Leseoperation', 'Die Zeit für einen Speicherzugriff auf der Festplatte'], 'Ein Takt ist eine Periode des Taktsignals; mehrere Takte bilden einen Maschinenzyklus.', ['Er ist der kleinste der drei Zyklen.', 'Die Frequenz ist der Kehrwert.']],
    ['Was gibt die Taktrate eines Prozessors an?', 'Mit welcher Frequenz er höchstens getaktet werden kann', ['Wie viele Rechenkerne er insgesamt in sich enthält', 'Wie viele Transistoren er auf dem Chip insgesamt enthält', 'Wie breit sein Bussystem für Adressen und Daten ist'], 'Die Taktrate ist ein Maß dafür, wie schnell der Prozessor Anweisungen abarbeiten kann. Kerne, Transistoren und Busbreite sind andere Merkmale.', ['Die Einheit ist Hertz.', 'Andere Merkmale sind Kernzahl und Busbreite.']],
    ['Was kennzeichnet die Neumann-Architektur?', 'Befehle und Daten liegen im gleichen Speicher', ['Jeder Befehl hat eine eigene Leitung direkt zur CPU', 'Der Prozessor kommt ganz ohne Arbeitsspeicher aus', 'Ein- und Ausgabe sind fest im Prozessor eingebaut'], 'Beim Von-Neumann-Rechner holt die CPU Programm und Daten über dieselben Busse aus demselben Speicher.', ['Es geht um die Aufteilung des Speichers.', 'Programm und Daten sehen im Speicher gleich aus.']]
  ];

  /* ---------- Konfigurator-Szenarien ---------- */
  /* PRUEFEN P13: Szenarien und die Zuordnung "Anforderung -> Gerät" sind vereinfacht und eindeutig gebaut (genau ein Gerät erfüllt alle genannten Anforderungen); die Tabelle steht in syscore.js (DEVICES). In der Praxis gibt es Zwischenformen (Konvertibles, Mini-PC). Soll das so bleiben? */
  const SCEN = [
    { lv: 1, req: ['ind'], t: 'In einer Gießerei soll eine Anlage mit einem Rechner gesteuert werden, der direkt neben dem Ofen steht.', ans: 'indu' },
    { lv: 1, req: ['klein'], t: 'Im Empfangsbereich ist nur ein winziger Platz hinter dem Tresen frei. Dort soll ein einfacher Rechner stehen, der am Netz hängt.', ans: 'bare' },
    { lv: 1, req: ['erw'], t: 'In der Werkstatt soll ein Arbeitsplatz entstehen, in den man später Steckkarten einbauen kann.', ans: 'desk' },
    { lv: 1, req: ['aio'], t: 'An der Rezeption soll ein platzsparender Rechner stehen, bei dem Bildschirm und Rechner ein einziges Gerät sind.', ans: 'sff' },
    { lv: 2, req: ['mob', 'tast', 'dock'], t: 'Ein Servicetechniker schreibt unterwegs Berichte und soll im Büro an einem festen Platz mit weiteren Anschlüssen weiterarbeiten.', ans: 'note' },
    { lv: 2, req: ['mob', 'touch', 'tel'], t: 'Ein Außendienstmitarbeiter braucht für unterwegs Telefon, Navigation und Anmeldung per Fingerabdruck in einem Gerät für die Hosentasche.', ans: 'phone' },
    { lv: 2, req: ['gross', 'aio'], t: 'Im Empfang soll ein Gerät mit großem Bildschirm stehen, das nur einen einzigen Block auf dem Tresen belegt.', ans: 'sff' },
    { lv: 2, req: ['mob', 'tel'], t: 'Eine Monteurin soll bei Einsätzen erreichbar sein und ihren Standort melden können.', ans: 'phone' },
    { lv: 3, req: ['mob', 'touch', 'gross'], t: 'Ein Lagerist hakt den ganzen Tag Lieferscheine auf einer Liste ab. Er trägt das Gerät mit sich und bedient es nur mit dem Finger.', ans: 'tab' },
    { lv: 3, req: ['mob', 'tast', 'gross'], t: 'Eine Ausbilderin schreibt Beurteilungen auf Reisen und braucht dafür eine feste Tastatur und einen Bildschirm in Heftgröße im selben Gerät.', ans: 'note' },
    { lv: 3, req: ['mob', 'tast', 'gross', 'dock'], t: 'Ein Entwickler arbeitet abwechselnd im Zug und an seinem Schreibtisch, wo er Monitor, Netzwerk und weitere Geräte über eine Station nutzt.', ans: 'note' },
    { lv: 2, req: ['gross', 'erw'], t: 'In der Konstruktion soll ein stationärer Arbeitsplatz mit großem Bildschirm entstehen, der später mit weiteren Karten aufgerüstet wird.', ans: 'desk' }
  ];
  const reqTxt = ids => ids.map(id => '• ' + C().REQS.find(r => r.id === id).t).join('\n');

  const G = {
    evq: pq(EVQ), devq: pq(DEVQ), busq: pq(BUSQ), memq: pq(MEMQ), cpuq: pq(CPUQ),
    match: (R, a) => matchQ(R, a.text, SETS[a.set], a.n, !!a.distinct, a.tips),
    order: orderGen,
    conf: (R, arg) => {
      const c = C(), pool = SCEN.filter(s => !arg || !arg.length || arg.indexOf(s.lv) >= 0), s = c.pick(R, pool), dev = c.deviceOf(s.ans);
      const wrong = c.shuffle(R, c.DEVICES.filter(d => d.id !== s.ans)).slice(0, 3).map(d => d.n);
      const fit = c.fitting(s.req);
      const q = choiceQ(R, 'Situation: ' + s.t + '\nAnforderungen:\n' + reqTxt(s.req) + '\nWelches Gerät passt am besten?', dev.n, wrong,
        'Gesucht ist das Gerät, das alle genannten Anforderungen erfüllt: ' + dev.n + '. ' + dev.d,
        ['Prüfe jede Anforderung einzeln und streiche Geräte, die sie nicht erfüllen.', 'Es bleibt genau ein Gerät übrig, das alles erfüllt.']);
      q.meta = { scen: SCEN.indexOf(s), fit }; return q;
    },
    addrcount: R => {
      const c = C(), n = c.ri(R, 3, 12), v = c.addrCount(n);
      return numQ('Ein Speicherbaustein hat ' + n + ' Adressleitungen (A0 bis A' + (n - 1) + '). Wie viele verschiedene Speicherplätze kann er ansprechen?', v, 'Adressen', 'Anzahl der Adressen', 0,
        'Jede Adressleitung kann 0 oder 1 sein. Bei ' + n + ' Leitungen sind das 2^' + n + ' = ' + f(v, 0) + ' Adressen.', ['Jede zusätzliche Leitung verdoppelt die Zahl der Adressen.', 'Rechne mit Zweierpotenzen.']);
    },
    addrkib: R => {
      const c = C(), n = c.ri(R, 10, 18), kib = c.pow2(n - 10);
      return numQ('Eine CPU hat ' + n + ' Adressleitungen. An jeder Adresse liegt 1 Byte. Wie groß ist der Adressraum in KiB (1 KiB = 1.024 Byte)?', kib, 'KiB', 'Adressraum', 0,
        '2^' + n + ' = ' + f(c.pow2(n), 0) + ' Byte. Geteilt durch 1.024 sind das ' + f(kib, 0) + ' KiB. Kurz: 2^' + n + ' = 2^10 · 2^' + (n - 10) + ' = 1 KiB · ' + f(kib, 0) + '.', ['Erst die Zahl der Adressen ausrechnen, dann durch 1.024 teilen.', '2^10 sind genau 1 KiB.']);
    },
    addrlines: R => {
      const c = C(), inKiB = R() < 0.5;
      if (inKiB) { const j = c.ri(R, 0, 7), kib = c.pow2(j);
        return numQ('Ein Speicher mit ' + f(kib, 0) + ' KiB soll an einer CPU betrieben werden, jede Adresse enthält 1 Byte (1 KiB = 1.024 Byte). Wie viele Adressleitungen werden mindestens gebraucht?', j + 10, 'Leitungen', 'Adressleitungen', 0,
          f(kib, 0) + ' KiB = ' + f(kib * 1024, 0) + ' Byte = 2^' + (j + 10) + ' Byte. Es werden ' + (j + 10) + ' Adressleitungen gebraucht.', ['Rechne die Größe in Byte um und suche die passende Zweierpotenz.', 'Die Zahl der Leitungen ist der Exponent der Zweierpotenz.']); }
      const j = c.ri(R, 5, 9), by = c.pow2(j);
      return numQ('Ein kleiner Speicherbaustein fasst ' + f(by, 0) + ' Byte, jede Adresse enthält 1 Byte. Wie viele Adressleitungen braucht er mindestens?', j, 'Leitungen', 'Adressleitungen', 0,
        f(by, 0) + ' = 2^' + j + '. Es werden ' + j + ' Adressleitungen gebraucht.', ['Suche die Zweierpotenz, die der Byte-Zahl entspricht.', 'Der Exponent ist die gesuchte Zahl.']);
    },
    memcap: R => {
      const c = C(), a = c.ri(R, 8, 14), d = c.pick(R, [1, 4, 8, 16]), bits = c.memBits(a, d);
      return numQ('Ein Speicherbaustein hat ' + a + ' Adressleitungen und ' + d + ' Datenleitungen (je Adresse ein Datenwort mit ' + d + ' Bit). Wie groß ist seine Speicherkapazität in Bit?', bits, 'Bit', 'Speicherkapazität', 0,
        'Anzahl der Adressen: 2^' + a + ' = ' + f(c.pow2(a), 0) + '. Je Adresse ' + d + ' Bit: ' + f(c.pow2(a), 0) + ' · ' + d + ' = ' + f(bits, 0) + ' Bit.', ['Zuerst die Zahl der Speicherplätze, dann die Bits je Platz.', 'Die Datenleitungen geben an, wie breit ein Speicherplatz ist.']);
    },
    endaddr: R => {
      const c = C(), kib = c.pick(R, [1, 2, 4, 8, 16]), size = kib * 1024, m = c.ri(R, 1, 65536 / size - 1), start = m * size, end = c.lastAddr(start, size);
      return baseQ('Ein Speicherbaustein mit ' + kib + ' KiB (1 KiB = 1.024 Byte, ein Byte je Adresse) beginnt bei der Adresse ' + hx(start, 4) + ' (hex). Wie lautet seine letzte Adresse (hex, vierstellig)?', end, 16, 16, 'Letzte Adresse',
        'Größe ' + kib + ' KiB = ' + f(size, 0) + ' Byte = ' + hx(size, 4) + ' hex. Letzte Adresse = Anfang + Größe − 1 = ' + hx(start, 4) + ' + ' + hx(size, 4) + ' − 1 = ' + hx(end, 4) + ' hex.', ['Die letzte Adresse liegt genau ein Byte vor dem Ende des Bereichs.', 'Rechne die Größe in Hexadezimal oder dezimal und wandle zurück.']);
    },
    declines: R => {
      const c = C(), kib = c.pick(R, [1, 2, 4, 8]), j = 10 + Math.log2(kib), A = c.ri(R, j + 1, 16), ans = A - j;
      return numQ('Die CPU hat ' + A + ' Adressleitungen (A0 bis A' + (A - 1) + '). Jeder Speicherbaustein fasst ' + kib + ' KiB und wird mit seinen Adressanschlüssen direkt an die niederwertigen Adressleitungen gehängt. Die übrigen, höherwertigen Leitungen gehen an den Adressdecoder. Wie viele Adressleitungen führen zum Adressdecoder?', ans, 'Leitungen', 'Leitungen zum Decoder', 0,
        'Ein Baustein mit ' + kib + ' KiB = 2^' + j + ' Byte braucht ' + j + ' Adressleitungen direkt. Von den ' + A + ' Leitungen bleiben ' + A + ' − ' + j + ' = ' + ans + ' für den Decoder. Damit lassen sich 2^' + ans + ' = ' + c.pow2(ans) + ' Bausteine auswählen.', ['Ein Baustein braucht so viele Leitungen, wie sein Adressbereich Bits hat.', 'Den Rest übernimmt der Decoder.']);
    },
    /* PRUEFEN P16: Datenrate = Busbreite in Byte mal Takt, eine Übertragung je Takt, 1 MB = 10^6 Byte, ohne Wartezyklen, Burst oder DDR. Bustakt und Breite des Bussystems nennt die Mitschrift als Prozessormerkmale, die Rechnung ist ergänzt. Soll sie bleiben, oder zu weit weg vom Unterricht? */
    busrate: R => {
      const c = C(), w = c.pick(R, [8, 16, 32, 64]), mhz = c.pick(R, [10, 20, 25, 33, 50, 66, 100, 133, 200]), v = c.busMBs(w, mhz);
      return numQ('Ein Datenbus ist ' + w + ' Bit breit und überträgt bei jedem Takt ein Datenwort. Der Bustakt beträgt ' + mhz + ' MHz. Wie viele Megabyte je Sekunde sind höchstens möglich (1 MB = 10^6 Byte, ohne Wartezeiten)?', v, 'MB/s', 'Höchste Datenrate', 0.01,
        'Ein Datenwort hat ' + w + ' Bit = ' + (w / 8) + ' Byte. Bei ' + mhz + ' Millionen Takten je Sekunde sind das ' + (w / 8) + ' · ' + mhz + ' = ' + f(v, 0) + ' MB/s.', ['Rechne die Breite von Bit in Byte um.', 'Ein Takt überträgt ein Datenwort, der Takt gibt die Zahl der Übertragungen an.']);
    },
    /* PRUEFEN P17: Stapelspeicher (LIFO) und FIFO nach der Mitschrift; die Rechenaufgabe (welcher Wert kommt zuerst oder zuletzt heraus) ist ergänzt und rechnet mit PUSH und POP ohne Stackpointer-Adressen. Passt das? */
    stack: R => {
      const c = C(), n = c.ri(R, 3, 4), vals = c.shuffle(R, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n), fifo = R() < 0.5, first = R() < 0.5;
      const mem = fifo ? 'In einen FIFO-Speicher (First In First Out)' : 'Auf einen Stapelspeicher (Stack, LIFO)', act = fifo ? 'eingeschrieben' : 'abgelegt';
      const ans = fifo ? (first ? vals[0] : vals[n - 1]) : (first ? vals[n - 1] : vals[0]);
      return numQ(mem + ' werden nacheinander die Werte ' + vals.join(', ') + ' ' + act + ' (in dieser Reihenfolge). Welcher Wert kommt beim ' + (first ? 'ersten' : 'letzten') + ' Auslesen heraus?', ans, '', 'Wert', 0,
        (fifo ? 'FIFO: Was zuerst hinein kam, kommt zuerst heraus. Reihenfolge beim Auslesen: ' + vals.join(', ') : 'LIFO: Was zuletzt hinein kam, kommt zuerst heraus. Reihenfolge beim Auslesen: ' + vals.slice().reverse().join(', ')) + '. Der ' + (first ? 'erste' : 'letzte') + ' Wert ist ' + ans + '.',
        ['Schreibe dir die Reihenfolge beim Auslesen einmal auf.', 'FIFO und LIFO unterscheiden sich in genau dieser Reihenfolge.']);
    },
    b2d: R => {
      const c = C(), bits = c.ri(R, 4, 8), v = c.ri(R, 5, c.maxVal(bits));
      return numQ('Wandle die Dualzahl ' + c.bin(v, bits) + ' in eine Dezimalzahl um.', v, '', 'Dezimalzahl', 0,
        'Stellenwerte von rechts: 1, 2, 4, 8, 16, 32, 64, 128. Addiere die Werte der Stellen mit einer 1: ' + c.binRaw(v, bits).split('').reverse().map((b, i) => b === '1' ? c.pow2(i) : null).filter(x => x != null).reverse().join(' + ') + ' = ' + v + '.', ['Rechts steht die 1, dann die 2, 4, 8 und so weiter.', 'Nur die Stellen mit einer 1 zählen.']);
    },
    d2h: R => {
      const c = C(), v = c.ri(R, 17, 254);
      return baseQ('Wandle die Dezimalzahl ' + v + ' in eine zweistellige Hexadezimalzahl um.', v, 16, 8, 'Hexadezimalzahl',
        v + ' : 16 = ' + Math.floor(v / 16) + ' Rest ' + (v % 16) + '. Die Ziffern: ' + c.toBase(Math.floor(v / 16), 16) + ' und ' + c.toBase(v % 16, 16) + ' (A = 10 bis F = 15). Ergebnis: ' + hx(v, 2) + ' hex.', ['Teile durch 16, der Rest ist die niederwertige Stelle.', 'Reste von 10 bis 15 schreibst du als A bis F.']);
    },
    h2b: R => {
      const c = C(), v = c.ri(R, 16, 255);
      return baseQ('Wandle die Hexadezimalzahl ' + hx(v, 2) + ' in eine achtstellige Dualzahl um (Leerzeichen sind erlaubt).', v, 2, 8, 'Dualzahl',
        'Jede Hexadezimalziffer ergibt vier Bit: ' + hx(v, 2).split('').map(h => h + ' = ' + c.bin(parseInt(h, 16), 4)).join(' und ') + '. Zusammen: ' + c.bin(v, 8) + '.', ['Jede Hex-Ziffer entspricht genau vier Bit.', 'A = 1010, B = 1011, ... F = 1111.']);
    },
    /* PRUEFEN P18: Zweierkomplement mit 8 Bit: -n wird als 256 - n dargestellt, die Aufgabe fragt nur das Bitmuster (hex) nach A - B mit B größer als A. Die Mitschrift zeigt die Rechnung A - B = A + Zweierkomplement von B (OCR unsicher). Reicht diese Form? */
    sub2: R => {
      const c = C(), a = c.ri(R, 1, 120), b = c.ri(R, a + 1, 130), r = (a - b + 256) & 255;
      return baseQ('Im Akkumulator steht ' + hx(a, 2) + ' hex. Davon wird ' + hx(b, 2) + ' hex abgezogen (8 Bit). Das Ergebnis ist negativ und steht als Zweierkomplement im Akkumulator. Welches Bitmuster steht danach im Akkumulator (hex)?', r, 16, 8, 'Inhalt des Akkumulators',
        a + ' − ' + b + ' = ' + (a - b) + '. Das negative Ergebnis steht als Zweierkomplement: 256 − ' + (b - a) + ' = ' + r + ' = ' + hx(r, 2) + ' hex (' + c.bin(r, 8) + ').', ['Das Ergebnis der Subtraktion ist negativ. Wie wird −n in 8 Bit dargestellt?', 'Zweierkomplement: 256 minus den Betrag.']);
    },
    /* PRUEFEN P19: In der Mitschrift steht "Inhalt der 100sten Speicherstelle" mit Adresse 64 hex; die Aufgaben sagen deshalb ausdrücklich "Adresse 100 (dezimal)", damit nicht die Zählweise ab 0 oder ab 1 verwirrt. Wie wird im Unterricht gezählt? */
    busval: R => {
      const c = C(), kind = c.ri(R, 0, 2);
      if (kind === 0) { const v = c.ri(R, 20, 250), ad = c.ri(R, 16, 255);
        return baseQ('Die Zahl ' + v + ' (dezimal) soll zur Ausgabeeinheit mit der Adresse ' + hx(ad, 2) + ' hex ausgegeben werden. Welches Datenwort (hex, zweistellig) legt die CPU dazu auf den Datenbus?', v, 16, 8, 'Datenwort',
          'Der Datenbus trägt den Wert, nicht die Adresse. ' + v + ' dezimal = ' + hx(v, 2) + ' hex (' + c.bin(v, 8) + '). Die Adresse ' + hx(ad, 2) + ' hex geht auf den Adressbus, das Steuersignal ist IOW.', ['Welche Information läuft auf dem Datenbus, welche auf dem Adressbus?', 'Rechne den Wert dezimal nach hexadezimal um.']); }
      if (kind === 1) { const ad = c.ri(R, 33, 250);
        return baseQ('Der Inhalt der Speicherstelle mit der Adresse ' + ad + ' (dezimal) soll gelesen werden. Welches Bitmuster (hex, zweistellig) legt die CPU dazu auf den Adressbus (8 Adressleitungen)?', ad, 16, 8, 'Adresse',
          'Auf den Adressbus kommt die Adresse der Speicherstelle: ' + ad + ' dezimal = ' + hx(ad, 2) + ' hex (' + c.bin(ad, 8) + '). Danach folgen das Steuersignal MEMR und das Datenwort vom Speicher.', ['Die Adresse geht auf den Adressbus, der Inhalt später auf den Datenbus.', 'Rechne die Adresse von dezimal nach hexadezimal um.']); }
      const ad = c.ri(R, 20, 250);
      return baseQ('Der Adressbus ist 8 Bit breit. Die CPU spricht die Adresse ' + hx(ad, 2) + ' hex an. Welches Bitmuster liegt dabei auf den Adressleitungen (A7 bis A0, Leerzeichen sind erlaubt)?', ad, 2, 8, 'Bitmuster',
        hx(ad, 2).split('').map(h => h + ' = ' + c.bin(parseInt(h, 16), 4)).join(', ') + '. Zusammen A7 bis A0: ' + c.bin(ad, 8) + '.', ['A7 ist das höchstwertige Bit ganz links.', 'Wandle jede Hex-Ziffer in vier Bit um.']);
    },
    decout: R => {
      const c = C(), k = c.pick(R, [2, 3]), n = c.pow2(k), v = c.ri(R, 0, n - 1), bits = c.binRaw(v, k).split('');
      const inp = bits.map((b, i) => 'A' + (k - 1 - i) + ' = ' + b).join(', ');
      return numQ('Ein Adressdecoder mit ' + k + ' Eingängen (A' + (k - 1) + ' bis A0) hat ' + n + ' Ausgänge Z0 bis Z' + (n - 1) + '. Ein Ausgang Zn ist aktiv, wenn die Eingänge als Dualzahl den Wert n bilden (A0 ist die niederwertigste Stelle). Es liegt an: ' + inp + '. Welcher Ausgang Zn ist aktiv? Gib n an.', v, '', 'Nummer n des aktiven Ausgangs', 0,
        'Die Eingänge bilden die Dualzahl ' + c.binRaw(v, k) + ' = ' + v + ', also ist Z' + v + ' aktiv. Alle anderen Ausgänge sind inaktiv.', ['Lies die Eingänge von A' + (k - 1) + ' bis A0 als Dualzahl.', 'Rechne die Dualzahl in eine Dezimalzahl um.']);
    },
    decaddr: R => {
      const c = C(), names = c.shuffle(R, ['dem Festwertspeicher (ROM)', 'dem Arbeitsspeicher (RAM)', 'der Ein-/Ausgabeschaltung', 'keinem Baustein (nicht belegt)']), addr = c.ri(R, 0x0100, 0xFFFF), z = c.blockOf(addr, 16, 2);
      const label = n => n.indexOf('ROM') >= 0 ? 'ROM' : n.indexOf('RAM') >= 0 ? 'RAM' : n.indexOf('Ein-') >= 0 ? 'Ein-/Ausgabe' : 'nicht belegt';
      const q = choiceQ(R, 'Der Adressbus hat 16 Leitungen. Die beiden höchsten Leitungen A15 und A14 gehen an einen Adressdecoder (1 aus 4), alle anderen Leitungen laufen direkt zu den Bausteinen. Ausgang Zn ist aktiv, wenn A15 A14 als Dualzahl den Wert n bilden. Belegung: ' + names.map((n, i) => 'Z' + i + ' → ' + label(n)).join('; ') + '. Die CPU legt die Adresse ' + hx(addr, 4) + ' hex an. Welcher Baustein antwortet?', label(names[z]), names.filter((n, i) => i !== z).map(label),
        'Die Adresse ' + hx(addr, 4) + ' hex = ' + c.bin(addr, 16) + '. A15 und A14 sind ' + c.binRaw(addr, 16).slice(0, 2) + ' = ' + z + ', also ist Z' + z + ' aktiv: ' + label(names[z]) + '.', ['Wandle die Adresse in Dualschreibweise um, nur die ersten beiden Stellen zählen.', 'Die ersten beiden Bit bilden die Nummer des aktiven Ausgangs.']);
      q.meta = { addr, z }; return q;
    },
    add8: R => {
      const c = C(); let a, b;
      if (R() < 0.5) { a = c.ri(R, 100, 250); b = c.ri(R, 256 - a, 255); } else { a = c.ri(R, 1, 120); b = c.ri(R, 1, 120); }
      const r = c.add8(a, b);
      return baseQ('Der Akkumulator enthält ' + hx(a, 2) + ' hex, das Register B enthält ' + hx(b, 2) + ' hex. Der Befehl ADD B wird ausgeführt (8 Bit, Überträge über Bit 7 gehen nicht in den Akkumulator). Welcher Wert (hex, zweistellig) steht danach im Akkumulator?', r.r, 16, 8, 'Inhalt des Akkumulators',
        a + ' + ' + b + ' = ' + (a + b) + (a + b > 255 ? ', das sind mehr als 255: der Übertrag (Carry) geht verloren und das Carry-Flag wird 1. In den Akkumulator kommen nur die unteren 8 Bit: ' + (a + b) + ' − 256 = ' + r.r : '') + '. Ergebnis ' + hx(r.r, 2) + ' hex (' + c.bin(r.r, 8) + ').', ['Rechne dezimal oder in Hexadezimal, aber nur 8 Bit passen in den Akkumulator.', 'Ein Ergebnis über 255 läuft über: die oberen Bit gehen verloren.']);
    },
    flags: R => {
      const c = C(); let a, b;
      if (R() < 0.5) { a = c.ri(R, 100, 250); b = c.ri(R, 256 - a, 255); } else { a = c.ri(R, 1, 200); b = c.ri(R, 1, 255 - a); }
      const r = c.add8(a, b), right = c.flagText(r), seen = new Set([right]), wrong = [];
      for (let i = 0; i < 80 && wrong.length < 3; i++) {
        const g = Object.assign({}, r); ['cy', 'ac', 'z', 's', 'p'].forEach(k => { if (R() < 0.4) g[k] = 1 - g[k]; });
        const t = c.flagText(g); if (!seen.has(t)) { seen.add(t); wrong.push(t); }
      }
      const q = choiceQ(R, 'Nach dem Befehl ADD B steht im Akkumulator zuvor ' + hx(a, 2) + ' hex und im Register B ' + hx(b, 2) + ' hex. Welche Flags sind danach gesetzt (= 1)? Regeln: CY = Übertrag aus Bit 7, AC = Übertrag von Bit 3 nach Bit 4, Z = Ergebnis ist 0, S = Bit 7 des Ergebnisses, P = 1 bei gerader Anzahl von Einsen im Ergebnis.', right, wrong,
        'Summe: ' + c.bin(a, 8) + ' + ' + c.bin(b, 8) + ' = ' + (a + b > 255 ? '1 ' : '') + c.bin(r.r, 8) + ' (' + hx(r.r, 2) + ' hex). CY = ' + r.cy + ' (Summe ' + (r.cy ? 'über' : 'nicht über') + ' 255), AC = ' + r.ac + ' (untere Hälften ' + (a & 15) + ' + ' + (b & 15) + (r.ac ? ' über 15' : ' nicht über 15') + '), Z = ' + r.z + ', S = ' + r.s + ' (Bit 7), P = ' + r.p + ' (' + c.ones(r.r) + ' Einsen, ' + (r.p ? 'gerade' : 'ungerade') + '). Gesetzt: ' + right + '.',
        ['Rechne die Summe in Dualschreibweise und achte auf die Überträge.', 'Zähle die Einsen im Ergebnis für das Parity-Flag.']);
      q.meta = { a, b }; return q;
    },
    /* PRUEFEN P20: Fehlerbild A: zwei Bausteine mit überlappenden Adressbereichen treiben den Datenbus gegeneinander (Busstreit); die Bereiche sind in Schritten von 1 KiB zufällig überlappend. Echte Fehlerbilder (Wackelkontakt, kalte Lötstelle) kommen nicht vor. Soll das so bleiben? */
    /* Fehlerbild A: Speicherplan mit versteckter Überlappung */
    ovl: R => {
      const c = C(), NAMES = ['Programmspeicher (ROM)', 'Arbeitsspeicher RAM 1', 'Arbeitsspeicher RAM 2', 'Eingabebaustein', 'Ausgabebaustein', 'Anzeigespeicher'];
      for (let t = 0; t < 400; t++) {
        const names = c.shuffle(R, NAMES).slice(0, 4), sizes = names.map(() => c.pick(R, [4, 8, 16]) * 1024), gaps = names.map(() => c.pick(R, [0, 0, 0x1000]));
        let pos = c.pick(R, [0, 0x1000, 0x2000]); const map = names.map((n, i) => { pos += gaps[i]; const e = { n, start: pos, size: sizes[i] }; pos += sizes[i]; return e; });
        if (pos > 0x10000) continue;
        const j = c.ri(R, 0, 2), nxt = map[j + 1], maxExt = nxt.size / 1024 - 1, ext = 0x400 * c.ri(R, 1, Math.max(1, maxExt));
        map[j] = { n: map[j].n, start: map[j].start, size: nxt.start - map[j].start + ext };
        const ov = c.overlaps(map); if (ov.length !== 1) continue;
        const pair = [ov[0].a, ov[0].b].sort(), ptxt = p => p[0] + ' und ' + p[1];
        const all = []; for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) all.push([map[x].n, map[y].n].sort());
        const others = c.shuffle(R, all.filter(p => ptxt(p) !== ptxt(pair))).slice(0, 3).map(ptxt);
        const shown = c.shuffle(R, map).map(m => '• ' + m.n + ': von ' + hx(m.start, 4) + ' bis ' + hx(m.start + m.size - 1, 4) + ' (hex)').join('\n');
        const q = choiceQ(R, 'Ein Rechner mit 16 Adressleitungen liefert beim Lesen bestimmter Adressen wechselnde, falsche Werte, mal mit gesetzten, mal mit gelöschten Bits. Der Speicherplan wurde zuletzt geändert und sieht so aus:\n' + shown + '\nWelche beiden Bausteine sind falsch eingeplant?', ptxt(pair), others,
          'Zwei Bausteine überlappen sich: ' + ov[0].a + ' und ' + ov[0].b + ' teilen sich die Adressen ' + hx(ov[0].from, 4) + ' bis ' + hx(ov[0].to, 4) + ' hex. Dort antworten beide gleichzeitig; ihre Tri-State-Ausgänge treiben den Datenbus gegeneinander. Das Ergebnis sind wechselnde, falsche Werte.', ['Sortiere die Bereiche im Kopf nach der Anfangsadresse.', 'Prüfe, ob das Ende eines Bereichs hinter dem Anfang des nächsten liegt.']);
        q.meta = { map }; return q;
      }
      throw new Error('ovl: kein Speicherplan erzeugt');
    },
    /* Fehlerbild B: Datenleitung hängt fest */
    dline: R => {
      const c = C(), k = c.ri(R, 0, 7), lvl = c.ri(R, 0, 1); let vals, outs;
      for (let t = 0; t < 200; t++) {
        vals = [c.ri(R, 1, 254), c.ri(R, 1, 254), c.ri(R, 1, 254)]; outs = vals.map(v => c.stuckData(v, k, lvl));
        if (outs.some((o, i) => o !== vals[i]) && new Set(vals).size === 3) break;
      }
      const lt = (kk, l) => 'Datenleitung D' + kk + ' hängt dauerhaft auf ' + l, right = lt(k, lvl), seen = new Set([right]), wrong = [];
      [[k, 1 - lvl], [(k + c.ri(R, 1, 3)) % 8, lvl], [(k + c.ri(R, 4, 7)) % 8, 1 - lvl], [(k + 1) % 8, lvl], [(k + 7) % 8, 1 - lvl]].forEach(x => { const t = lt(x[0], x[1]); if (wrong.length < 3 && !seen.has(t)) { seen.add(t); wrong.push(t); } });
      const rows = vals.map((v, i) => '• geschrieben ' + hx(v, 2) + ' hex, gelesen ' + hx(outs[i], 2) + ' hex').join('\n');
      const diff = vals.map((v, i) => outs[i] !== v ? hx(v, 2) + ' (' + c.bin(v, 8) + ') wird zu ' + hx(outs[i], 2) + ' (' + c.bin(outs[i], 8) + ')' : null).filter(x => x);
      return choiceQ(R, 'Beim Test eines Speicherbausteins mit 8 Datenleitungen (D7 bis D0, D0 ist das niederwertigste Bit) wird jeweils ein Wert auf dieselbe Speicherzelle geschrieben und sofort zurückgelesen:\n' + rows + '\nWelcher Fehler liegt vor?', right, wrong,
        'Vergleiche geschrieben und gelesen Bit für Bit: ' + diff.join('; ') + '. Es ändert sich immer nur Bit ' + k + ', und zwar immer zum Wert ' + lvl + '. Also hängt D' + k + ' fest auf ' + lvl + '. Bei Werten, die dort schon ' + lvl + ' haben, fällt der Fehler nicht auf.', ['Schreibe geschriebenen und gelesenen Wert untereinander in Dualschreibweise.', 'Welches Bit ist in allen abweichenden Fällen anders, und in welche Richtung?']);
    },
    /* Fehlerbild C: Adressleitung hängt fest (Spiegelung) */
    aline: R => {
      const c = C(), k = c.ri(R, 2, 9), lvl = c.ri(R, 0, 1); let x;
      for (let t = 0; t < 100; t++) { x = c.ri(R, 0x010, 0xFFF); if (((x >> k) & 1) === 1 - lvl) break; }
      const y = lvl ? (x | (1 << k)) : c.stuckAddr(x, k), v = c.pick(R, [0x55, 0xAA, 0x3C, 0xC3]);
      const lt = (kk, l) => 'Adressleitung A' + kk + ' hängt dauerhaft auf ' + l, right = lt(k, lvl), seen = new Set([right]), wrong = [];
      [[k, 1 - lvl], [k + 1, lvl], [k - 1, 1 - lvl], [k + 2, lvl], [k - 2, lvl]].forEach(z => { const t = lt(z[0], z[1]); if (wrong.length < 3 && z[0] >= 0 && z[0] <= 11 && !seen.has(t)) { seen.add(t); wrong.push(t); } });
      return choiceQ(R, 'Ein Speicher hat 12 Adressleitungen (A0 bis A11, A0 ist die niederwertigste). Bei einem Speichertest wird zuerst die Adresse ' + hx(y, 3) + ' hex mit 00 beschrieben. Dann wird auf die Adresse ' + hx(x, 3) + ' hex der Wert ' + hx(v, 2) + ' hex geschrieben. Beim Zurücklesen der Adresse ' + hx(y, 3) + ' hex steht dort ebenfalls ' + hx(v, 2) + ' hex. Welcher Fehler liegt vor?', right, wrong,
        'Die beiden Adressen ' + hx(x, 3) + ' (' + c.bin(x, 12) + ') und ' + hx(y, 3) + ' (' + c.bin(y, 12) + ') unterscheiden sich nur in Bit ' + k + '. Beim Zugriff auf ' + hx(x, 3) + ' landet der Wert auf ' + hx(y, 3) + ', weil A' + k + ' immer ' + lvl + ' ist. Dadurch erscheint jede Zelle doppelt (Spiegelung), und die Hälfte des Speichers ist nicht erreichbar.', ['Vergleiche die beiden Adressen in Dualschreibweise.', 'In welcher Stelle unterscheiden sie sich, und welchen Wert hat diese Stelle bei der Adresse, auf der der Wert wirklich landet?']);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const M = (set, n, distinct, text, tips) => ({ set, n, distinct, text, tips });
  const defs = [
    [CATS[0], 1, 'Eingabe, Verarbeitung, Ausgabe', 'match', M('eva', 5, false, 'Ordne jede Zeile dem Schritt Eingabe, Verarbeitung oder Ausgabe nach dem EVA-Prinzip zu.', ['Was geht in das System hinein, was geschieht darin, was kommt heraus?', 'Der Prozessor rechnet, er ist weder Ein- noch Ausgabe.'])],
    [CATS[0], 1, 'Einfach oder vernetzt', 'evq'],
    [CATS[0], 2, 'Ablauf im System', 'order', { set: 'eva' }],
    [CATS[1], 1, 'Gerät und Merkmal', 'match', M('dev', 4, true, 'Ordne jedem Merkmal die passende Geräteklasse zu.', ['Lies zuerst die Merkmale, die nur zu einem einzigen Gerät passen.', 'Streiche Geräte, die du schon vergeben hast.'])],
    [CATS[1], 1, 'Geräteklasse erkennen', 'devq', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    [CATS[1], 2, 'Ausstattung eines Smartphones', 'match', M('phone', 5, false, 'Ordne jede Funktion der passenden Ausstattungsgruppe eines Smartphones zu.', ['Eine Gruppe beschreibt, wie das Gerät mit der Außenwelt Daten austauscht.', 'Sensoren messen etwas an oder um das Gerät herum.'])],
    [CATS[1], 2, 'Anforderungen im Betrieb', 'match', M('ind', 4, true, 'Ein Industrie-PC muss besondere Anforderungen erfüllen. Welche Anforderung gehört zu welcher Situation?', ['Überlege, was in der Situation dem Rechner schaden würde.', 'Jede Anforderung kommt nur einmal vor.'])],
    [CATS[2], 1, 'Passendes Gerät A', 'conf', [1]],
    [CATS[2], 2, 'Passendes Gerät B', 'conf', [2]],
    [CATS[2], 3, 'Passendes Gerät C', 'conf', [3]],
    [CATS[3], 1, 'Leitungen im Rechner', 'match', M('bus', 5, false, 'Ordne jede Aussage dem Adressbus, dem Datenbus oder dem Steuerbus zu.', ['Welcher Bus überträgt, wohin gelesen oder geschrieben wird?', 'Beim Datenbus laufen die Informationen in beide Richtungen.'])],
    [CATS[3], 2, 'Steuersignale', 'match', M('ctrl', 4, true, 'Ordne jedem Vorgang das Steuersignal zu, das ihn auslöst.', ['MEM steht für Speicher, IO für Ein-/Ausgabe.', 'R steht für Read (lesen), W für Write (schreiben).'])],
    [CATS[3], 2, 'Eigenschaften des Busses', 'busq'],
    [CATS[3], 2, 'Ablauf eines Buszugriffs', 'order', { set: 'bus', idx: [0, 1, 2] }],
    [CATS[3], 3, 'Wert auf dem Bus', 'busval'],
    [CATS[3], 2, 'Datenrate des Busses', 'busrate'],
    [CATS[4], 1, 'Merkmale von Speichern', 'memq'],
    [CATS[4], 2, 'Speicherarten zuordnen', 'match', M('mem', 6, false, 'Ordne jede Speicherart ihrer Gruppe zu.', ['Eine Gruppe verliert ihren Inhalt beim Ausschalten.', 'Die „E“ in EPROM und EEPROM steht für löschbar.'])],
    [CATS[4], 2, 'Stapel und Warteschlange', 'stack'],
    [CATS[5], 1, 'Adressen zählen', 'addrcount'],
    [CATS[5], 2, 'Adressraum', 'addrkib'],
    [CATS[5], 2, 'Leitungen bestimmen', 'addrlines'],
    [CATS[5], 2, 'Speicherkapazität', 'memcap'],
    [CATS[5], 3, 'Bereich im Speicherplan', 'endaddr'],
    [CATS[5], 3, 'Auswahl der Bausteine', 'declines'],
    [CATS[6], 1, 'Dual nach Dezimal', 'b2d'],
    [CATS[6], 2, 'Dezimal nach Hex', 'd2h'],
    [CATS[6], 2, 'Hex nach Dual', 'h2b'],
    [CATS[6], 3, 'Zweierkomplement', 'sub2'],
    [CATS[7], 1, 'Bausteine im System', 'match', M('comp', 5, true, 'Ordne jede Beschreibung dem passenden Teil eines Mikroprozessorsystems zu.', ['Überlege, welcher Baustein Befehle ausführt und welche nur speichern.', 'Der Adressdecoder wählt aus, die Busse verbinden.'])],
    [CATS[7], 2, 'Teile des Prozessors', 'match', M('cpu', 5, true, 'Ordne jede Aufgabe dem passenden Teil im Inneren der CPU zu.', ['Die ALU rechnet, das Steuerwerk ordnet den Ablauf.', 'Register sind sehr kleine, schnelle Speicher in der CPU.'])],
    [CATS[7], 2, 'Befehlsgruppen', 'match', M('cmd', 6, false, 'Ordne jeden 8085-Befehl seiner Befehlsgruppe zu.', ['Die Kürzel kommen aus dem Englischen: MOV = move, ADD = add, JMP = jump.', 'IN und OUT haben eine eigene Gruppe.'])],
    [CATS[7], 2, 'Adressdecoder', 'decout'],
    [CATS[7], 2, 'Baustein ausgewählt', 'decaddr'],
    [CATS[7], 2, 'Addition im Akkumulator', 'add8'],
    [CATS[7], 3, 'Flags nach der Addition', 'flags'],
    [CATS[7], 3, 'Prozessor und Speicher', 'cpuq'],
    [CATS[8], 2, 'Fehlerbild A', 'ovl'],
    [CATS[8], 3, 'Fehlerbild B', 'dline'],
    [CATS[8], 3, 'Fehlerbild C', 'aline']
  ];
  const tasks = defs.map((d, i) => ({ id: 'sys' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title;
    if (t.gen === 'match' && t.arg && t.arg.tips) q.tips = t.arg.tips;
    return q;
  }
  function makeTask(t) { return make(t, C().rng('sys-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus SYS_CORE) ---------- */
  const examples = [
    { id: 'sys1', tab: 'sys', title: 'Gerät für die Werkhalle', text: 'Ein Rechner soll neben einem Ofen stehen, wird abgespritzt und muss zehn Jahre lieferbar sein. Welches Gerät passt?', p: { req: ['ind'] } },
    { id: 'sys2', tab: 'sys', title: 'Unterwegs und am Schreibtisch', text: 'Ein Techniker braucht unterwegs Tastatur und Bildschirm im Gerät und am Schreibtisch weitere Anschlüsse. Welches Gerät passt?', p: { req: ['mob', 'tast', 'dock'] } },
    { id: 'sys3', tab: 'sys', title: 'Nur mit dem Finger bedienen', text: 'Ein Gerät soll getragen, nur per Touch bedient werden und eine große Anzeige haben. Passt ein Smartphone?', p: { req: ['mob', 'touch', 'gross'] } },
    { id: 'adr1', tab: 'bus', title: 'Adressraum bei 16 Adressleitungen', text: 'Eine CPU hat 16 Adressleitungen und 8 Datenleitungen. Wie viele Adressen und wie viel Speicher kann sie ansprechen?', p: { n: 16, d: 8 } },
    { id: 'adr2', tab: 'bus', title: 'Kleiner Speicherbaustein', text: 'Ein Baustein hat 12 Adressleitungen und 4 Datenleitungen. Wie groß ist seine Kapazität?', p: { n: 12, d: 4 } },
    { id: 'adr3', tab: 'bus', title: '32 KiB brauchen 15 Leitungen', text: 'Ein Speicher mit 32 KiB soll angeschlossen werden. Wie viele Adressleitungen braucht er bei einem Byte je Adresse?', p: { n: 15, d: 8, rev: 32768 } },
    { id: 'bus1', tab: 'bus', title: 'Zahl 14 an die Ausgabeeinheit 5B', text: 'Die Zahl 14 (dezimal) soll zur Ausgabeeinheit mit der Adresse 5B (hex) ausgegeben werden. Was liegt nacheinander auf den Bussen?', p: { sig: 'IOW', addr: '5B', data: '0E', bits: 8 } },
    { id: 'bus2', tab: 'bus', title: 'Speicherstelle 100 lesen', text: 'Aus der Speicherstelle mit der Adresse 100 (dezimal, 64 hex) soll das Datenwort 11 (dezimal) gelesen werden.', p: { sig: 'MEMR', addr: '0064', data: '0B', bits: 16 } },
    { id: 'zs1', tab: 'zs', title: 'Dual, Hex und Dezimal: 0101 1011', text: 'Das Bitmuster 0101 1011 steht auf dem Adressbus. Wie lautet die Zahl in hexadezimal und dezimal?', p: { v: 91 } },
    { id: 'zs2', tab: 'zs', title: 'Adresse 100 dezimal', text: 'Die Speicherstelle 100 (dezimal) soll angesprochen werden. Wie sieht die Adresse binär und hexadezimal aus?', p: { v: 100 } },
    { id: 'rech1', tab: 'zs', title: 'Addition mit Übertrag', text: 'Zu C6 hex wird 61 hex addiert. Was steht im Akkumulator, und welche Flags sind gesetzt?', p: { a: 'C6', b: '61', op: '+' } },
    { id: 'rech2', tab: 'zs', title: 'Negatives Ergebnis als Zweierkomplement', text: '03 hex minus 05 hex: Das Ergebnis ist negativ. Wie steht es im Akkumulator?', p: { a: '03', b: '05', op: '-' } },
    { id: 'mps1', tab: 'mps', title: 'Welcher Baustein antwortet auf 5A00?', text: 'Vier Blöcke zu je 16 KiB: ROM, RAM, Ein-/Ausgabe, frei. Die CPU legt die Adresse 5A00 hex auf den Adressbus.', p: { k: 2, map: ['ROM', 'RAM', 'E/A', 'frei'], addr: '5A00' } },
    { id: 'mps2', tab: 'mps', title: 'Acht Blöcke zu je 8 KiB', text: 'Drei Adressleitungen gehen an den Decoder. Die Blöcke sind ROM, ROM, RAM, RAM, E/A und drei weitere Blöcke frei. Adresse 8001 hex.', p: { k: 3, map: ['ROM', 'ROM', 'RAM', 'RAM', 'E/A', 'frei', 'frei', 'frei'], addr: '8001' } }
  ];

  root.SYS_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sets: SETS, scen: SCEN, ord: ORD, pools: { EVQ, DEVQ, BUSQ, MEMQ, CPUQ } };
  root.SYS_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.SYS_DATA, TASKS: root.SYS_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
