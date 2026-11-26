'use strict';
/* Tonfunk Lab: Einordnung "Warum brauche ich das?", Texte für die Elektronik-/Elektrik-Labs (Elektroniker/in Geräte und Systeme, Industrieelektriker/in).
   Format: Einordnung.register({ lab, betrieb (<= 240 Zeichen), pruefung (<= 160 Zeichen, nur wenn sicher, sonst weglassen) }). Modul: einordnung.js.
   Eigene Worte, Du-Form, keine Normwerte und keine Namen. Der Projekte-Hub (vb) hat bewusst keinen Text. Das Arbeitsschutz-Lab (arb) und das EMS-Lab (ems, beide für alle Berufe) stehen hier für alle. */
(function (root) {
  var R = function (o) { if (root.Einordnung) root.Einordnung.register(o); else (root.__einQueue = root.__einQueue || []).push(o); };

  R({ lab: 'loch', betrieb: 'Bevor du einen Prototyp oder eine Reparaturschaltung lötest, planst du die Anordnung der Bauteile und die Drahtbrücken auf Lochraster. Das spart Fehler, Lötzeit und Material.',
      pruefung: 'Aus einem Stromlaufplan einen Aufbau planen: Bauteile anordnen und Verbindungen sowie Brücken festlegen.' });
  R({ lab: 'sch', betrieb: 'Der Stromlaufplan ist die gemeinsame Sprache von Entwicklung, Fertigung und Service: Danach baust du auf, prüfst und suchst Fehler, zum Beispiel wenn eine Baugruppe nicht anläuft.',
      pruefung: 'Einen Stromlaufplan lesen, Ströme und Spannungen bestimmen oder die Ursache eines Fehlers aus dem Plan ableiten.' });
  R({ lab: 'sim', betrieb: 'Eine Wechselschaltung oder ein Motor mit Relais: Hier probierst du solche Schaltungen gefahrlos aus, bevor du sie an einer echten Anlage unter Aufsicht einer Elektrofachkraft verdrahtest. Aderfarben und Schutzeinrichtungen siehst du mit.',
      pruefung: 'Eine Installationsschaltung wie die Wechselschaltung erklären oder ihren Stromweg im Schaltplan nachverfolgen.' });
  R({ lab: 'digi', betrieb: 'In fast jedem Gerät steckt Digitaltechnik. Bei der Fehlersuche an einer Steuerung oder einem Rechner prüfst du Pegel und Verknüpfungen, und Zähler, Speicher und Zahlensysteme begegnen dir bei Mikrocontrollern ständig.',
      pruefung: 'Eine Wahrheitstabelle aufstellen, ein Gatter-Netz lesen oder Zahlen zwischen Dezimal, Dual und Hexadezimal umrechnen.' });
  R({ lab: 'mess', betrieb: 'Jede Inbetriebnahme und jede Fehlersuche beginnt mit Messen: Spannung am Prüfpunkt, Strom einer Baugruppe, Signal am Oszilloskop. Wer richtig misst, findet Fehler schneller und beschädigt nichts.',
      pruefung: 'Die richtige Messschaltung wählen (Strom in Reihe, Spannung parallel), Messwerte ablesen und Messfehler bewerten.' });
  R({ lab: 'arb', betrieb: 'Ab dem ersten Tag im Betrieb: Du erkennst Sicherheitszeichen, weißt, wo Feuerlöscher und Verbandkasten sind, trägst die passende Schutzausrüstung und gehst sicher mit Gefahrstoffen um.',
      pruefung: 'Sicherheitszeichen und Gefahrstoff-Symbole deuten, die passende Schutzausrüstung wählen oder die Rettungskette bei einem Unfall nennen.' });
  R({ lab: 'ems', betrieb: 'Tonfunk fertigt Elektronik im Auftrag von Kunden. Du siehst den ganzen Weg einer Baugruppe vom Wareneingang über Bestücken, Löten und Prüfen bis zum Versand und weißt, an welchen Stellen du selbst mitarbeitest.',
      pruefung: 'Den Ablauf einer Fertigung beschreiben, Prüfverfahren wie AOI und ICT einordnen und erklären, warum ein früh gefundener Fehler weniger kostet.' });
  R({ lab: 'els', betrieb: 'Bevor ein repariertes Gerät zurückgeht oder eine Anlage wieder läuft, wird geprüft und protokolliert. Hier lernst du, wie Schutzmaßnahmen wirken. Arbeiten an Netzspannung gehören in die Hände von Elektrofachkräften.',
      pruefung: 'Die Wirkung von Sicherung und RCD erklären und Schutzklasse oder Schutzart eines Geräts richtig einordnen.' });
  R({ lab: 'nts', betrieb: 'Netzteile stecken in fast jedem Gerät. Fällt eines aus oder wird zu heiß, grenzt du den Fehler ein, schätzt Verlustleistung und Kühlung ab und wählst ein passendes Ersatzteil, etwa im Schaltschrank.',
      pruefung: 'Das Blockschaltbild eines Netzteils beschreiben oder Verlustleistung und Wirkungsgrad berechnen.' });
  R({ lab: 'wsl', betrieb: 'In Netzteilen, Filtern und Motoranlagen hast du es mit Wechselstrom zu tun. Blindleistung belastet Leitungen, Kompensation hilft, und Schwingkreise und Filter brauchst du in Signal- und Funkschaltungen.',
      pruefung: 'Impedanz oder Scheinleistung einer R-L-C-Schaltung berechnen und ein Zeigerdiagramm deuten.' });
  R({ lab: 'ana', betrieb: 'Dioden, Transistoren und Operationsverstärker sind die Bausteine der Geräteelektronik. Bei der Fehlersuche an einer Baugruppe prüfst du, ob Vorwiderstand, Arbeitspunkt und Verstärkung noch stimmen.',
      pruefung: 'Den Vorwiderstand einer LED berechnen, einen Transistor als Schalter beschreiben oder die Verstärkung einer Operationsverstärker-Schaltung bestimmen.' });
  R({ lab: 'haus', betrieb: 'Du lernst, wie Räume, Steckdosen, Schalter und Leitungen bis zum Verteiler zusammenhängen. Das brauchst du für Gespräche mit der Gebäudetechnik und zum Verstehen von Installationen in Büro und Werkstatt.' });
  R({ lab: 'app', betrieb: 'Kleine eigene Rechner oder Checklisten sparen im Alltag Zeit, etwa ein Rechner für Vorwiderstände. Du lernst dabei, Ergebnisse einer KI zu prüfen, statt ihnen blind zu glauben.' });
  R({ lab: 'sps', betrieb: 'In Anlagen steuern SPSen Förderbänder, Ampeln und Tore. Steht eine Anlage still, liest du das Programm, findest die Bedingung, die nicht erfüllt ist, und änderst die Steuerung nachvollziehbar.',
      pruefung: 'Ein einfaches Steuerungsprogramm lesen oder ergänzen, zum Beispiel eine Selbsthaltung.' });
  R({ lab: 'pcb', betrieb: 'Bevor eine Baugruppe in Serie geht, wird die Leiterplatte entworfen, bestückt, gelötet und geprüft. Mit Lagenaufbau, Gerber-Daten und Prüfverfahren verstehst du Gespräche mit Entwicklung und Fertigung.' });
  R({ lab: 'ant', betrieb: 'Antriebe bewegen Förderbänder, Pumpen und Tore. Du wählst die passende Motorart, steuerst Drehzahl und Richtung und erkennst, warum ein Antrieb zu heiß wird oder nicht anläuft.',
      pruefung: 'Die passende Motorart für eine Aufgabe wählen oder die Schaltung eines Drehstrommotors beschreiben.' });
  R({ lab: 'sen', betrieb: 'Sensoren melden Temperatur, Druck, Licht oder Position an die Steuerung. Beim Austausch eines defekten Sensors achtest du auf Messbereich, Ausgangssignal wie 4–20 mA und den richtigen Anschluss.',
      pruefung: 'Ein Normsignal in einen Messwert umrechnen oder einen passenden Sensor für eine Messaufgabe auswählen.' });
  R({ lab: 'reg', betrieb: 'Heizung, Klimaanlage, Füllstand oder Drehzahl: Überall hält eine Regelung einen Wert konstant. Schwingt ein Regelkreis oder reagiert er zu langsam, stellst du Regler und Parameter neu ein.' });
  R({ lab: 'thm', betrieb: 'Hitze ist ein häufiger Grund für ausfallende Elektronik. Du rechnest die Verlustleistung aus und wählst Kühlkörper und Wärmeleitpaste, damit Bauteile im Gerät oder Schaltschrank nicht überhitzen.',
      pruefung: 'Die Verlustleistung eines Bauteils berechnen und beurteilen, ob ein Kühlkörper nötig ist.' });
  R({ lab: 'emv', betrieb: 'Ein Gerät, das Störungen aussendet oder durch Störungen ausfällt, besteht die EMV-Prüfung nicht. Du erkennst Störquellen und wählst Filter, Schirmung und Layout-Maßnahmen, bevor das Gerät zur Prüfung geht.' });
  R({ lab: 'hf', betrieb: 'Funkgeräte, Antennen und Sensoren mit Funk arbeiten mit Hochfrequenz. Du rechnest mit Pegeln in dB, passt Leitungen an und schätzt ab, ob eine Funkstrecke reicht. So verstehst du Messwerte am HF-Prüfplatz.',
      lernfelder: ['Z-HF'] });   /* freiwilliges Zusatzthema: steht in keinem Pflicht-Lernfeld, deshalb hier fest genannt */
  R({ lab: 'enr', betrieb: 'Solaranlagen mit Akku oder Netzeinspeisung gehören zum Berufsalltag. Du dimensionierst Modul, Laderegler, Kabel und Sicherung. Ein Solarmodul liefert bei Licht immer Spannung: Arbeiten daran nur durch Elektrofachkräfte.',
      pruefung: 'Leistung und Ertrag einer kleinen Anlage berechnen oder den Aufbau einer Inselanlage erklären.' });
  R({ lab: 'code', betrieb: 'Mikrocontroller wie der Arduino steuern LEDs, Motoren und Sensoren in vielen Geräten und Prototypen. Mit eigenen Programmen testest du Schaltungen schnell und liest fremde Programme leichter.' });
  R({ lab: 'pi', betrieb: 'Ein Raspberry Pi übernimmt in Prototypen und kleinen Anlagen Steuerung, Messdatenerfassung oder Anzeige. Du verdrahtest die Pins richtig (3,3 V), schreibst Python und prüfst alles vorher in der Simulation.' });
  R({ lab: 'ds', betrieb: 'Beim Ersatzteil oder Neuentwurf entscheidet das Datenblatt: Grenzwerte, Kennlinien, Gehäuse. Du suchst die Angaben, die zum Einsatz passen, und liest auch englische Datenblätter sicher.',
      pruefung: 'Aus einem Datenblattauszug Grenzwerte und typische Werte herauslesen und ein passendes Bauteil auswählen.' });
  R({ lab: 'pr', betrieb: 'In der Abschlussprüfung zeigst du, was du im Betrieb täglich brauchst. Hier übst du Rechenaufgaben und Mehrfachwahl unter Zeitdruck und siehst, welche Themen noch Lücken haben.',
      pruefung: 'Aufgaben mit Rechnen und Mehrfachwahl in begrenzter Zeit, bewertet nach dem IHK-Notenschlüssel.' });
  R({ lab: 'ssl', betrieb: 'Beim Bau oder Umbau eines Schaltschranks wählst du Schutzorgane und Leitungen, ordnest Bauteile auf der Hutschiene und prüfst vor der Inbetriebnahme. Arbeiten im Schrank sind Sache von Elektrofachkräften.',
      pruefung: 'Schutzorgan und Leitung zu einer Last auswählen oder die Prüfschritte vor der ersten Inbetriebnahme nennen.' });
  R({ lab: 'sys', betrieb: 'Wer Geräte mit Mikroprozessor oder Bus wartet, muss wissen, wie CPU, Speicher und Ein- und Ausgänge zusammenarbeiten. Das hilft bei der Fehlersuche und bei der Auswahl von Speicher und Schnittstellen.' });
  R({ lab: 'alg', betrieb: 'Bevor du programmierst oder eine Steuerung festlegst, skizzierst du den Ablauf. Mit Ablaufplan und Struktogramm erklärst du anderen, was ein Programm tut, und suchst Fehler im Einzelschritt.',
      pruefung: 'Einen Programmablaufplan oder ein Struktogramm lesen und eine Schleife von Hand nachvollziehen.' });
  R({ lab: 'mat', betrieb: 'Ob Vorwiderstand, Kabelquerschnitt oder Übersetzung: Im Betrieb rechnest du ständig mit Einheiten, Dreisatz und Prozent. Sicheres Umstellen von Formeln verhindert Fehler in jeder Fachaufgabe.',
      pruefung: 'Formeln umstellen, Einheiten umrechnen und mit Dreisatz oder Prozentrechnung eine Fachaufgabe lösen.' });
  R({ lab: 'eng', betrieb: 'Datenblätter, Warnhinweise und Servicemails sind oft englisch. Wer die Fachwörter kennt, erkennt Gefahrhinweise sofort und versteht Anleitungen für Geräte und Ersatzteile.' });
  R({ lab: 'bhf', betrieb: 'Im Berichtsheft hältst du fest, was du im Betrieb gemacht hast. Klare, sachliche Tagesberichte zeigen, was du gelernt hast, und helfen dir später bei Gesprächen mit der Ausbilderin oder dem Ausbilder.',
      pruefung: 'Kein Prüfungsteil, aber ein ordentlich geführtes Berichtsheft ist Voraussetzung für die Zulassung zur Abschlussprüfung.' });
  /* Labs für Technikerschule und Studium */
  R({ lab: 'mat2', betrieb: 'Wechselstrom, Regelkreise und Signale rechnest du in Technikerschule und Studium mit komplexen Zahlen, Matrizen und Differentialgleichungen. Für Dreisatz, Prozent und Formeln umstellen gibt es das Rechen-Lab.' });
  R({ lab: 'sig', betrieb: 'Jeder Messwert und jedes Audiosignal wird abgetastet, gefiltert und übertragen. Wer Spektrum, Abtastung und Filter versteht, erkennt, warum ein Signal verfälscht ankommt, und legt die Kette richtig aus.' });
  R({ lab: 'rg2', betrieb: 'Schwingt eine Regelung oder ist sie zu träge, hilft Probieren nur begrenzt. Mit Übertragungsfunktion und Bode-Diagramm siehst du vorher, ob ein Kreis stabil bleibt. Den Einstieg findest du im Regelungstechnik-Lab.' });
  R({ lab: 'emb', betrieb: 'In fast jedem Gerät arbeitet ein Mikrocontroller. Wer Geräte entwickelt oder Fehler in der Firmware sucht, muss wissen, wie Timer, Wandler, serielle Busse und Zustandsautomaten zusammenspielen.' });
  R({ lab: 'nrm', betrieb: 'Bevor ein Gerät verkauft werden darf, muss feststehen, welche Vorschriften gelten und wie ihre Einhaltung nachgewiesen wird. Das planst du von Anfang an ein, damit es am Ende keine teuren Änderungen gibt.' });
  R({ lab: 'prj', betrieb: 'Technische Projekte scheitern oft an Terminen, Kosten und unklaren Anforderungen. Mit Lastenheft, Netzplan und Investitionsrechnung planst du ein Vorhaben so, dass es sich rechnet und fertig wird.' });
  R({ lab: 'sya', betrieb: 'Kommt ein Gerät aus dem Prüffeld zurück, suchst du den Fehler nicht durch Raten. Du gehst am Blockschaltbild entlang, misst an den Messpunkten und grenzt den Block ein. Nach der Reparatur prüfst du das Gerät, bevor es wieder rausgeht.',
    pruefung: 'Abschlussprüfung Teil 2, Systemanalyse: Schaltungsunterlagen auswerten, Fehler eingrenzen, Bauteile auslegen, Instandsetzung dokumentieren.' });
  R({ lab: 'lot', betrieb: 'In der Fertigung lötest du von Hand nach und beurteilst Lötstellen nach Vorgabe. Du erkennst kalte Lötstellen, Brücken und Grabsteine, weißt, was zum Fehler führt, und arbeitest im ESD-Bereich richtig.',
    pruefung: 'Lötprüfung Modul 1 (THT) und Modul 2 (SMD), Abschlussprüfung Teil 1: Lötstellen herstellen und beurteilen, ESD-Schutz.' });
  R({ lab: 'bus', betrieb: 'Geräte und Anlagen tauschen Daten über serielle Busse aus. Bei der Inbetriebnahme stellst du Baudrate und Adresse ein, prüfst Abschlusswiderstände und erkennst am Oszilloskop, ob ein Rahmen sauber ankommt.',
    pruefung: 'Abschlussprüfung Teil 2, Systementwurf und Funktionsanalyse: Schnittstellen auswählen, Datenübertragung berechnen, Busfehler eingrenzen.' });
  R({ lab: 'mik', betrieb: 'Viele Geräte haben einen Mikrocontroller. Du liest Programme, stellst Zeiten über Timer ein, prüfst Messwerte vom AD-Wandler und findest heraus, warum ein Gerät zu viel Strom zieht.',
    pruefung: 'Abschlussprüfung Teil 2, Systementwurf: Timer und AD-Wandler berechnen, Programmabläufe lesen, Zustandsautomaten entwerfen.' });
  R({ lab: 'pne', betrieb: 'Viele Anlagen bewegen Teile mit Druckluft. Du liest Pneumatikpläne, erkennst Ventile und Zylinder, schließt Schläuche richtig an und findest Lecks.',
    pruefung: 'Abschlussprüfung Teil 2: Pneumatik- und Elektropneumatikpläne lesen, Ventile und Zylinder auswählen, Luftverbrauch abschätzen.' });
  R({ lab: 'drk', betrieb: 'In der Werkstatt druckst du Halter, Gehäuse und Prüfmittel selbst. Du bereitest das Modell im Slicer vor, wählst das Filament und erkennst Druckfehler früh.',
    pruefung: 'Abschlussprüfung Teil 1 und Projektarbeit: Gehäuse und Halter fertigen, Fertigungsverfahren auswählen, Materialkosten berechnen.' });
  R({ lab: 'cad', betrieb: 'Halter, Gehäuse und Frontplatten konstruierst du am Rechner. Du zeichnest saubere Skizzen, baust den Körper aus Features auf und gibst die Datei an den 3D-Drucker oder die Fertigung weiter.',
    pruefung: 'Abschlussprüfung Teil 1 und Projektarbeit: technische Unterlagen erstellen, Gehäuse konstruieren, Daten für die Fertigung bereitstellen.' });
  R({ lab: 'ksp', betrieb: 'Prüfplätze, Vorrichtungen und kleine Anlagen werden oft mit Kleinsteuerung, Schützen und Magnetventilen gesteuert. Du schließt Sensoren richtig an und findest Fehler an Ein- und Ausgängen.',
    pruefung: 'Abschlussprüfung Teil 1 und 2: Steuerungen mit Schütz und Kleinsteuerung lesen, Sensoren anschließen, elektropneumatische Abläufe prüfen.' });
  R({ lab: 'eda', betrieb: 'Bevor eine Platine bestellt wird, prüfst du die Schaltung in der Simulation, beseitigst die Meldungen der Regelprüfung und kontrollierst die Fertigungsdaten.',
    pruefung: 'Abschlussprüfung Teil 1 und 2: Schaltungsunterlagen auswerten, Simulationsergebnisse bewerten, Fertigungsdaten für eine Leiterplatte prüfen.' });
  R({ lab: 'bmk', betrieb: 'Bei Prüfung, Wartung und Fehlersuche arbeitest du mit Stromlaufplan, Klemmenplan und Verdrahtungsliste. Du findest jedes Betriebsmittel über sein Kennzeichen.',
    pruefung: 'Abschlussprüfung Teil 1 und 2: Stromlaufplan, Klemmenplan und Verdrahtungsliste lesen und ergänzen, Betriebsmittel richtig kennzeichnen.' });
  R({ lab: 'iot', betrieb: 'Prüfplätze und Fertigungslinien melden Messwerte und Zustände an ein Leitsystem. Du verstehst die Datenkette, liest Topics und achtest auf die IT-Sicherheit der Anlage.',
    pruefung: 'Abschlussprüfung Teil 2: Datenfluss vom Sensor bis zur Auswertung beschreiben, Schnittstellen zuordnen, IT-Sicherheit vernetzter Anlagen bewerten.' });
  R({ lab: 'fgs', betrieb: 'Jeden Auftrag planst du, dokumentierst ihn und erklärst ihn deinem Ausbilder. Unterweisungen und Berichtsheft gehören zum Alltag der Ausbildung.',
    pruefung: 'Abschlussprüfung Teil 2: Arbeitsauftrag planen und dokumentieren, Ergebnis vorstellen, im Fachgespräch fachlich begründen.' });
  R({ lab: 'fli', betrieb: 'In der Fertigung bestimmt die langsamste Station, wie viele Baugruppen die Linie schafft. Wer Takt, Engpass und Ausschuss lesen kann, findet die Stelle, an der sich eine Verbesserung lohnt.' });
})(typeof window !== 'undefined' ? window : globalThis);
