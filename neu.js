'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release hier oben einen Block ergänzen. */
(function (root) {
  const LOG = [
    { v: 'v17.138', items: [
      ['Neues Thermik-Lab', 'Das 17. Lab. Du lernst, wo im Gerät die Wärme entsteht und wie man sie abführt. An fünf animierten Prüfständen siehst du, wie heiß Linearregler, Transistor, MOSFET, Diode, Widerstand und LED werden. Die Bauteile sind Übungsbauteile mit Übungswerten.', 'Startseite ▸ Thermik-Lab'],
      ['Verlustleistung und Wärmewiderstandskette', 'Das Lab zeigt, wie aus der Verlustleistung die Temperaturen werden: Sperrschicht, Gehäuse, Kühlkörper und Umgebung hängen an einer Kette von Wärmewiderständen. Im Ersatzschaltbild und im Balkenbild siehst du, welches Glied wie viel Temperaturunterschied verbraucht.', 'Thermik-Lab ▸ Prüfstand ▸ Ansicht Ersatzschaltbild, Balken'],
      ['Kühlkörper, Wärmeleitpaste und Glimmerscheibe', 'Wähle einen Kühlkörper, setze Paste und Isolierscheibe ein, schalte den Lüfter dazu und drehe den Kühlkörper in die Waagrechte. Du siehst sofort, wie sich die Wärmewiderstände und die Sperrschichttemperatur ändern. Fehler wie vergessene Paste, lockere Schraube oder fehlende Isolierbuchse lassen sich auswürfeln.', 'Thermik-Lab ▸ Prüfstand ▸ Montage und Umgebung, Menü ▸ Fehler-Würfel'],
      ['7805 und LM317 mit Last', 'Der Linearregler macht aus der Spannungsdifferenz Wärme. Ändere Eingangsspannung und Laststrom und sieh, wie P und Tj wachsen. Ohne Kühlkörper schaltet der Regler thermisch ab und läuft nach dem Abkühlen wieder an.', 'Thermik-Lab ▸ Prüfstand Linearregler'],
      ['Wärmebild und Vergleich', 'Im Wärmebild zeigt die Falschfarbenskala, wo es heiß ist. Im Vergleich laufen drei Aufbauten nebeneinander (zum Beispiel ohne Paste, mit Paste, mit größerem Kühlkörper), und du siehst, welche Maßnahme am meisten bringt.', 'Thermik-Lab ▸ Ansicht Wärmebild, Tab Vergleichen'],
      ['Rechner, Aufgaben und Lernheft', 'Der Rechner führt Schritt für Schritt von der Verlustleistung über die Kette der Wärmewiderstände bis zum nötigen Kühlkörper. 30 Aufgaben mit automatischer Prüfung und Tipps in drei Stufen, 24 Beispiele, Lernheft mit Arbeitsblatt, Trainer, Kampagne „Die Wärme“ und 15 neue Abzeichen.', 'Thermik-Lab ▸ Rechnen, Aufgaben, Lernen'],
      ['Regelungstechnik: alles auf einer Seite', 'Die Messgeräte stehen jetzt direkt unter der Anlage, der Messschreiber ist kleiner, und alles passt auf eine Seite. Ein Blick genügt, um Anlage, Werte und Verlauf zu sehen.', 'Regelungstechnik-Lab ▸ Prüfstand'],
      ['Datenblatt-Lab: Derating mit Kühlkörper', 'Die Rechnung der zulässigen Verlustleistung mit Kühlkörper stimmt jetzt: Sie ergibt sich aus der Reihenschaltung der Wärmewiderstände (Sperrschicht–Gehäuse, Gehäuse–Kühlkörper, Kühlkörper–Umgebung). Der Datenblattwert für den freistehenden Fall deckelt dann nicht mehr, er erscheint nur noch als Hinweis.', 'Datenblatt-Lab ▸ Aufgaben zur Thermik (zum Beispiel ds19)'],
    ] },
    { v: 'v16.137', items: [
      ['Neues Regelungstechnik-Lab', 'Das 16. Lab. Du lernst, wie ein Regler eine Größe auf dem Sollwert hält: Füllstand, Durchfluss, Raumtemperatur, Thermostat, Drehzahl und Lage an sieben animierten Prüfständen. Du nimmst Sprungantworten auf, stellst P-, I- und D-Anteil ein und siehst im Messschreiber, ob der Kreis ruhig regelt oder schwingt. Die Anlagen sind Übungsanlagen.', 'Startseite ▸ Regelungstechnik-Lab'],
      ['Strecke messen und Regler einstellen', 'Nimm die Sprungantwort auf und lies Verstärkung, Verzugszeit und Ausgleichszeit ab. Die Einstellhilfe rechnet daraus Kp, Tn und Tv nach Ziegler-Nichols, Chien-Hrones-Reswick oder der T-Summen-Regel. Dazu gibt es den Schwingversuch und als Vertiefung das Bode-Diagramm.', 'Regelungstechnik-Lab ▸ Strecke messen, Regler einstellen'],
      ['Zweipunktregler und Thermostat', 'Bügeleisen, Kühlschrank und Klimagerät schalten mit Schaltdifferenz. Du siehst, warum die Temperatur schwankt, wie oft geschaltet wird und was eine Totzone beim Dreipunktregler bringt.', 'Regelungstechnik-Lab ▸ Thermostat'],
      ['Fehler-Würfel und Ablauf', 'Würfle eine Störung aus (zum Beispiel Fenster auf, Sensor driftet oder Stellglied klemmt) und behebe sie. Im Ablauf legst du Sprünge nach Zeitplan an.', 'Regelungstechnik-Lab ▸ Menü, Ablauf'],
      ['Rechner, Aufgaben und Lernheft', 'Der Rechner zeigt den Rechenweg für Proportionalbereich, bleibende Abweichung, Einstellregeln, Normsignale und mehr. 30 Aufgaben mit automatischer Prüfung und Tipps in drei Stufen, 24 Beispiele, Lernheft mit Arbeitsblatt, Trainer, Kampagne „Der Regelkreis“ und 16 neue Abzeichen.', 'Regelungstechnik-Lab ▸ Rechnen, Aufgaben, Lernen'],
      ['Pins anzeigen', 'In der rechten Leiste gibt es jetzt einen Schalter, der an jedem Bauteil zeigt, welcher Anschluss welcher ist, zum Beispiel B, C, E am Transistor oder A1, A2, COM, NO, NC am Relais. Im Stromlaufplan und im Lochrasterplan. Die Einstellung bleibt gespeichert. Im Ausdruck erscheinen die Pins nicht.', 'SchaltLab, SimLab, DigiLab, MessLab, LochLab ▸ rechte Leiste ▸ Pins anzeigen'],
      ['Dämmerungsschalter und zwei Batterien', 'Bei den Aufgaben zum Dämmerungsschalter mit Relais (L16, L6, S18, S14) zählt jetzt beides als richtig: Der Laststromkreis hat eine eigene, getrennte Masse oder er teilt sich die Masse mit der Steuerung. Die Tipps sagen genauer, worauf es ankommt.', 'LochLab ▸ Aufgaben L6, L16; SchaltLab ▸ Aufgaben S14, S18'],
    ] },
    { v: 'v15.136', items: [
      ['Datenblatt-Lab: Prüfung genauer', 'Die Prüfung der Betriebsbedingungen vergleicht jetzt auch Werte, die im Datenblatt anders heißen als der Grenzwert (zum Beispiel VCE gegen VCEO). Wird der Grenzwert überschritten, steht „nicht bestanden“ mit dem geprüften Wert. Der Satz „noch unter dem Grenzwert“ erscheint nur noch, wenn wirklich verglichen wurde.', 'Datenblatt-Lab ▸ Aufgaben'],
      ['Datenblatt-Lab: Netzgleichrichter und Begriffe', 'Beim Szenario Netzgleichrichter sind jetzt 650 V Sperrspannung gefordert, weil der Einweggleichrichter mit Ladekondensator etwa das Doppelte des Spitzenwerts sieht. Das Fachwort heißt durchgehend Abfallzeit. Der Tipp zur 555-Aufgabe rechnet richtig vor.', 'Datenblatt-Lab ▸ Bauteilwahl, Fachenglisch'],
      ['Leiterplatten-Lab: Hilfe und Rückmeldung', 'Die Tastenhilfe zeigt jetzt die Tasten, die der Editor wirklich benutzt. Bei der 50-Ohm-Leitung bekommst du eine Rückmeldung, wenn die Bahn zu breit ist, mit dem Hinweis, sie zu verschmälern. Im Lernen-Tab zeigt der IPC-Rechner auch, wie viel Strom 1 mm Bahn trägt.', 'Leiterplatten-Lab ▸ Lernen, Aufgabe 15'],
      ['Leiterplatten-Lab: Rechenweg mit Tabellenbuch', 'Die Heizungsaufgabe nimmt Ergebnisse mit dem Kupferwert 1,72·10⁻⁸ Ωm und mit dem Tabellenbuchwert 0,0178 Ω·mm²/m an. Beide Rechenwege bestehen. Das Via heißt jetzt überall „das Via“.', 'Leiterplatten-Lab ▸ Aufgabe 42'],
      ['Sensorik-Lab', 'Die Hilfe zum Pt100 in Zweileitertechnik nennt jetzt den richtigen Messfehler (2 Ω je Ader ergeben rund 10 K). Die Meldung „Bürde zu groß“ erscheint jetzt wirklich. Das Foto-Sensor-Bild zeigt den Lastwiderstand oben am Kollektor, und der Reflextaster heißt Reflexionslichttaster.', 'Sensorik-Lab'],
      ['Antriebs-Lab', 'Der Drehpfeil zeigt jetzt bei Rechts- und Linkslauf die Pfeilspitze am richtigen Ende. Beim Stern-Dreieck-Anlauf steht, dass der Strom auf ein Drittel sinkt.', 'Antriebs-Lab'],
      ['Simulation: Werteingabe exakt', 'Eingaben wie 100n oder 10µ werden jetzt exakt umgerechnet, ohne winzige Rundungsreste. Das gilt in allen Labs, die mit dem Schaltplan arbeiten.', 'SchaltLab, SimLab, DigiLab, MessLab'],
      ['Texte und Fehler in weiteren Labs', 'DigiLab: Die Mehrheitsfunktion heißt jetzt „2 aus 3“, und beim 7474 ist PRE der Setz-Eingang. MessLab: Die Aufgabe zum Innenwiderstand ist sauber in Du-Form formuliert. SPS-Lab: Zeiten gehen auch in der Schreibweise 3s/S1. Arduino-Lab: char gibt den Buchstaben aus. LochLab: Escape schließt Fenster, und Tippen in Feldern löscht nichts mehr auf der Platine.', 'MessLab, DigiLab, SPS-Lab, Arduino-Lab, LochLab'],
    ] },
    { v: 'v15.135', items: [
      ['Verbundprojekte', 'Fünf Projekte, in denen alle Labs zusammen ein Gerät fertigstellen: Garagentor mit Funköffner, Ampelanlage, Digitale Uhr mit Wecker, Gartenbewässerung und Förder- und Sortieranlage. Jedes Projekt hat ein Lastenheft mit eigenen Zahlen und bis zu zehn Stationen. Jede Station arbeitet in einem Lab (Datenblatt, Schaltplan, Leiterplatte, Messen, Antrieb, Sensorik, SPS, Arduino, Pi, App-Werkstatt) und gibt ihr Ergebnis an die nächste weiter. Der Verbund ist kein 16. Lab, sondern eine eigene Übersicht.', 'Startseite ▸ Projekte'],
      ['Leiste im Lab', 'Öffnest du eine Station, erscheint im Lab oben eine Leiste mit Auftrag und den Knöpfen Prüfen, Übergeben und Tipp. Die Daten der Vorstationen werden von allein geladen. Ohne Projekt bleibt die Leiste unsichtbar und das Lab arbeitet wie immer.', 'Projekte ▸ Station öffnen'],
      ['Stufen und Gesamttest', 'Einsteiger mit Starthilfen, Standard und Profi mit engeren Toleranzen. Sind alle Stationen bestanden, prüft der Gesamttest das fertige Gerät mit Kennzahlen. Hat sich der Eingang einer Station geändert, wird sie gelb markiert und du übergibst neu.', 'Projekte ▸ Gesamttest'],
      ['Zertifikat und Bericht', 'Nach bestandenem Gesamttest gibt es ein Zertifikat mit Medaille (Bronze, Silber, Gold) und einen Abschlussbericht mit allen Stationen, Messwerten und Kennzahlen als A4-Seite zum Drucken. Das Messprotokoll gibt es auch als CSV.', 'Projekte ▸ Menü ▸ Drucken'],
      ['Teamarbeit per Code', 'Wer mit demselben Teamnamen und derselben Stufe startet, bekommt dasselbe Lastenheft. Stationen lassen sich als Code, Link, QR oder Datei teilen und beim Partner laden. Das dient auch als Sicherung.', 'Projekte ▸ Teilen'],
      ['Neue Anlagenoptionen', 'Die SPS-Anlagen (Garagentor, Tank, Förderband) nehmen für die Projekte zusätzliche Einstellungen an, zum Beispiel Torlaufzeit, Bandgeschwindigkeit oder Pumpenleistung. Die bisherigen Aufgaben im SPS-Lab bleiben unverändert.', 'SPS-Lab, Projekte'],
      ['Kampagne, Abzeichen und Trainer', 'Neuer Epilog „Das Verbundprojekt“ am Ende der Kampagne, zehn neue Abzeichen (Torbauer, Verkehrsplaner, Uhrmacher, Gartenmeister, Anlagenbauer, Goldmedaille, Projektprofi und mehr) und der Trainer „Erste Schritte“ für die Projekte. Die Startseite hat dafür eine eigene Zeile.', 'Menü ▸ Kampagne, Abzeichen, Trainer'],
      ['Neues Projektheft', 'Einführung, Ablauf, die fünf Projekte mit Lastenheft-Beispielen, Datenübergabe, Tipps, Abschlussbericht und Hinweise für die Gruppenarbeit. Lösungen gibt es für Ausbilder.', 'Lernhefte ▸ Projekte'],
    ] },
    { v: 'v14.134', items: [
      ['Neues Datenblatt-Lab', 'Das 15. Lab. Du lernst, Datenblätter zu lesen: Grenzwerte und Betriebswerte unterscheiden, Min, Typ und Max mit Testbedingungen lesen, Kennlinien mit logarithmischer Achse ablesen, Thermik und Derating rechnen. In den Abschlussprüfungen ein Dauerbrenner.', 'Startseite ▸ Datenblatt-Lab'],
      ['16 Übungsdatenblätter', 'Von der Signaldiode und dem BC547 über MOSFET, Spannungsregler und NE555 bis zu Port-Expander, Digitalpoti und Temperatursensor. Es sind eigene Übungsdatenblätter in der Form echter Datenblätter, angelehnt an bekannte Bauteile. Maßgeblich sind immer die Datenblätter der Hersteller.', 'Datenblatt-Lab ▸ Bibliothek'],
      ['Betrachter wie ein Datenblatt', 'Seiten mit Pinbelegung, Absolute Maximum Ratings, Betriebsbedingungen, Kennwerten, Kennlinien, Thermik, Gehäusezeichnung, Zeitdiagramm, Registertabelle und Anwendung. Zeilen lassen sich markieren, die Suche springt zur Textstelle, Fachbegriffe übersetzt ein Tipp.', 'Datenblatt-Lab ▸ Bibliothek'],
      ['Kennlinien ablesen', 'Mit dem Fadenkreuz liest du Werte aus linearen und logarithmischen Kennlinien ab und übernimmst sie mit einem Tipp als Antwort.', 'Datenblatt-Lab ▸ Lesen üben'],
      ['Fachenglisch mit Karteikarten', 'Über 120 Begriffe aus Datenblättern lernst du mit Karteikarten, Quiz und Lückentexten. Karten, die du kannst, kommen seltener.', 'Datenblatt-Lab ▸ Fachenglisch'],
      ['Bauteilwahl und Rechner', 'Zu Anforderungen wie Spannung, Strom und Gehäuse wählst du das passende Bauteil und bekommst eine Begründung. Der Rechner zeigt den Rechenweg für LED-Vorwiderstand, Verlustleistung, Derating, E-Reihen und Toleranzen.', 'Datenblatt-Lab ▸ Bauteilwahl, Rechnen'],
      ['34 Aufgaben und 14 Beispiele', 'Von Grenzwerten und Kennwerten über Kennlinien, Thermik, Bauteilwahl, Zeitdiagramm und Register bis zu Fachenglisch, Fehlersuche und Aufgaben im Prüfungsstil. Die Prüfung rechnet automatisch, Tipps gibt es in drei Stufen.', 'Datenblatt-Lab ▸ Aufgaben'],
      ['Kampagne, Abzeichen und Trainer', 'Neues Kampagnenkapitel „Das Datenblatt“, zwölf neue Abzeichen und der Trainer „Erste Schritte“ für das Datenblatt-Lab.', 'Menü ▸ Kampagne, Abzeichen, Trainer'],
      ['Neues Lernheft Datenblatt-Lab', 'Aufbau eines Datenblatts, Grenzwerte und Betriebswerte, Min, Typ und Max, Kennlinien lesen, Thermik und Derating, LED-Vorwiderstand und E-Reihen, Bauteilwahl, Zeitdiagramme und Register sowie eine Fachenglisch-Vokabelliste. Lösungsblätter gibt es für Ausbilder.', 'Lernhefte ▸ Datenblatt-Lab'],
    ] },
    { v: 'v14.133', items: [
      ['Neues Sensorik-Lab', 'Das 14. Lab. Sieben animierte Prüfstände zeigen die ganze Messkette vom Sensor über die Signalaufbereitung bis zur Anzeige: Temperatur (NTC, Pt100, Pt1000, LM35, Thermoelement, 2-, 3- und 4-Leiter), Licht und Näherung, Kraft und Druck mit DMS-Brücke, Beschleunigung und Neigung, Normsignale 4…20 mA, digitale Sensoren per I²C sowie ADU und Abtastung.', 'Startseite ▸ Sensorik-Lab'],
      ['Fehler mit Folgen', 'Selbsterwärmung, Leitungswiderstand, Fremdlicht, Drift, Drahtbruch, Übersteuerung, zu großer Pull-up und Aliasing zeigen sich mit Funken, Rauch und Ton. Du siehst, warum ein Messwert falsch ist.', 'Sensorik-Lab ▸ Prüfstand'],
      ['Kennlinien und Zeitschreiber', 'Sensorkennlinien, Hysterese-Schleifen, Bürden-Arbeitsbereich und Spektrum werden aus dem Modell berechnet. Dein Betriebspunkt wandert als Marker mit. Aufzeichnungen lassen sich als CSV speichern.', 'Sensorik-Lab ▸ Kennlinien'],
      ['Ablaufprogramm', 'Temperatursprung, Hysterese-Schleife oder Drahtbruch zu einem bestimmten Zeitpunkt programmierst du als Tabelle. Das Ergebnis erscheint als Diagramm.', 'Sensorik-Lab ▸ Ablauf'],
      ['Rechner für Messketten', 'NTC und Pt100, Brückenspannung, Verstärkung, Bürde, ADU-Stufe, Rauschabstand und Aliasing mit Rechenweg, dazu ein Übungsgenerator mit sofortiger Prüfung.', 'Sensorik-Lab ▸ Rechnen'],
      ['28 Aufgaben und 27 Beispiele', 'Von der DMS-Vollbrücke über Pt100 in 2-Leiter-Technik, Schaltabstand und Hysterese, Kalibrierung, I²C-Register und Drahtbruch bis zur Fehlersuche und Aufgaben im Prüfungsstil. Die Prüfung rechnet automatisch, Tipps gibt es in drei Stufen.', 'Sensorik-Lab ▸ Aufgaben'],
      ['Kampagne, Abzeichen und Trainer', 'Neues Kampagnenkapitel „Die Messkette“, neue Abzeichen und der Trainer „Erste Schritte“ für das Sensorik-Lab.', 'Menü ▸ Kampagne, Abzeichen, Trainer'],
      ['Neues Lernheft Sensorik-Lab', 'Arbeitsblätter zu allen Prüfständen und ausführliche Erklärungen zu Temperaturfühlern, Brückenschaltung und DMS, Normsignalen, ADU und Abtastung sowie I²C. Lösungsblätter gibt es für Ausbilder.', 'Lernhefte ▸ Sensorik-Lab'],
    ] },
    { v: 'v13.132', items: [
      ['Neues Antriebs-Lab', 'Das 13. Lab. Fünf animierte Prüfstände: Gleichstrommotor mit H-Brücke und PWM, Servo mit Lageregelung, Schrittmotor, Drehstrom-Asynchronmotor mit Stern-Dreieck-Anlauf und Frequenzumrichter sowie Getriebe. Du bedienst Schalter und Regler und liest Messgeräte ab.', 'Startseite ▸ Antriebs-Lab'],
      ['Fehler mit Folgen', 'Brückenkurzschluss, überhitzte Wicklung, verlorene Schritte, Kippmoment und Zahnbruch zeigen sich mit Funken, Rauch und Ton. Du siehst, warum ein Antrieb sich so verhält.', 'Antriebs-Lab ▸ Prüfstand'],
      ['Kennlinien und Zeitschreiber', 'Drehmoment-Drehzahl-Kennlinien, Pull-out-Kurve, Sprungantwort und Wirkungsgrad werden aus dem Modell berechnet. Dein Betriebspunkt wandert als Marker mit. Aufzeichnungen lassen sich als CSV speichern.', 'Antriebs-Lab ▸ Kennlinien'],
      ['Ablaufprogramm', 'Stern-Dreieck-Anlauf, Rampen und Richtungsumkehr programmierst du als Tabelle: nach so vielen Sekunden setze diesen Wert. Das Ergebnis erscheint als Diagramm.', 'Antriebs-Lab ▸ Ablauf'],
      ['Rechner für Typenschild und Getriebe', 'Drehzahl, Moment, Leistung, Wirkungsgrad, Schlupf und Übersetzung mit Rechenweg, dazu ein Übungsgenerator mit sofortiger Prüfung.', 'Antriebs-Lab ▸ Rechnen'],
      ['30 Aufgaben und 22 Beispiele', 'Von Leistung aus Moment und Drehzahl über PWM, Servo-Regler, Schrittmotor, Stern-Dreieck und Getriebe bis zur Fehlersuche und Aufgaben im Prüfungsstil. Die Prüfung rechnet automatisch, Tipps gibt es in drei Stufen.', 'Antriebs-Lab ▸ Aufgaben'],
      ['Kampagne, Abzeichen und Trainer', 'Neues Kampagnenkapitel „Der Antrieb“, neue Abzeichen und der Trainer „Erste Schritte“ für das Antriebs-Lab.', 'Menü ▸ Kampagne, Abzeichen, Trainer'],
      ['Neues Lernheft Antriebs-Lab', 'Arbeitsblätter zu allen Prüfständen und ausführliche Erklärungen zu H-Brücke, Servo, Schrittmotor, Drehstrom, Getriebe und Typenschild. Lösungsblätter gibt es für Ausbilder.', 'Lernhefte ▸ Antriebs-Lab'],
    ] },
    { v: 'v12.131', items: [
      ['Neues Leiterplatten-Lab', 'Das 12. Lab. Du entwirfst echte Leiterplatten mit 1, 2, 4 oder 6 Lagen: Bauteile setzen, Leiterbahnen ziehen, Vias und Kupferflächen anlegen. Der Prüfer (DRC) meldet zu enge Abstände, zu dünne Bahnen und offene Verbindungen sofort.', 'Startseite ▸ Leiterplatten-Lab'],
      ['Lagen, Bestückung und Löten', 'Im Reiter Lagen siehst du den Lagenaufbau im Querschnitt. Unter Bestückung stehen Bestückungsplan, Stückliste, Reflow-Ofen und Handlöten zum Üben.', 'Leiterplatten-Lab ▸ Lagen und Bestückung'],
      ['Fertigung und Gerber-Daten', 'Du siehst die Gerber-Dateien Lage für Lage, die Bohrdatei, die Herstellungsschritte als Animation und den Preis je Platine.', 'Leiterplatten-Lab ▸ Fertigung'],
      ['Fehlersuche an defekten Platinen', 'Mit Multimeter und Lupe findest du Haarrisse, Lötbrücken, kalte Lötstellen, verpolte Bauteile und falsche Werte und behebst sie mit Lötkolben und Draht.', 'Leiterplatten-Lab ▸ Fehlersuche'],
      ['Prüfverfahren: Flying Probe, ICT, AOI, SPI, AXI, Boundary Scan', 'So wird eine Platine in der Fertigung geprüft. Du siehst, was jedes Verfahren findet und was nicht, und vergleichst Kosten und Zeit.', 'Leiterplatten-Lab ▸ Fertigung ▸ Prüfen'],
      ['43 Aufgaben und 21 Beispiele', 'Von Pads und Rastern über Leiterbahnbreite, Mehrlagen, Layout und Fehlersuche bis zu Prüfungsaufgaben. Die Prüfung rechnet automatisch, Tipps gibt es in drei Stufen. Bei Rechenaufgaben trägst du die Antworten in ein Antwortblatt ein.', 'Leiterplatten-Lab ▸ Aufgaben'],
      ['Startseite anpassen', 'Du kannst Lab-Karten ausblenden und umsortieren, auch mit Pfeilen oder Tastatur. Das gilt nur auf deinem Gerät.', 'Startseite ▸ Startseite anpassen'],
      ['Klassen-Dashboard für Ausbilder', 'Ergebnis-Codes einer Klasse zusammenfassen: wer hat was geschafft, wo hakt es, wer braucht Hilfe. Alles bleibt in diesem Browser.', 'Auswertung ▸ Klassen-Dashboard'],
      ['SPS-Lab: Hinweis bei Leerlauf', 'Schaltet dein Programm einige Sekunden keinen Ausgang, erinnert dich das SPS-Lab daran, dass die Anlage nur tut, was das Programm vorgibt. Am Förderband verweist der Hinweis auf das Beispiel „Sortieren“.', 'SPS-Lab ▸ Simulation'],
      ['Neues Lernheft Leiterplatten-Lab', 'Arbeitsblätter zu allen Aufgaben und ausführliche Erklärungen zu Flying Probe, ICT, AOI, SPI, AXI und Boundary Scan. Lösungsblätter gibt es für Ausbilder.', 'Lernhefte ▸ Leiterplatten-Lab'],
    ] },
    { v: 'v11.130', items: [
      ['Neues SPS-Lab: speicherprogrammierbare Steuerung', 'Das 11. Lab. Du programmierst eine SPS in den Sprachen KOP (Kontaktplan), FUP (Funktionsplan) und GRAFCET (Ablaufsprache) und siehst, wie das Programm zyklisch abläuft. Adressen und Befehle lassen sich zwischen IEC (%IX0.0, AND) und Siemens (E0.0, U) umschalten.', 'Startseite ▸ SPS-Lab'],
      ['Vier animierte Anlagen', 'Förderband mit Sortierung, Ampel, Tank mit Pumpe und Garagentor laufen als Animation. Taster und Sensoren bedienst du per Fingertipp, Fehler wie überlaufender Tank oder eingeklemmtes Auto sind sichtbar.', 'SPS-Lab ▸ Anlage wählen'],
      ['24 Aufgaben mit Prüfung und 18 Beispiele', 'Von der Selbsthaltung über Zeitglieder und Zähler bis zu GRAFCET, Fehlersuche und Aufgaben im Prüfungsstil. Die Prüfung läuft die Anlage automatisch durch. Tipp-Stufen und Musterlösung wie in den anderen Labs.', 'SPS-Lab ▸ Menü ▸ Aufgaben'],
      ['Lustige Effekte und Töne in allen Labs', 'Funken, Sprechblasen, Konfetti und kleine Töne begleiten Erfolge und Pannen. Wer es ruhig mag, schaltet sie aus.', 'Menü ▸ Effekte (im SPS-Lab als Knopf „Effekte“)'],
      ['Neues Lernheft SPS-Lab', 'Arbeitsblätter zu allen 24 Aufgaben, vom Zyklus einer SPS bis zur Prüfung. Lösungsblätter gibt es für Ausbilder.', 'Lernhefte ▸ SPS-Lab'],
    ] },
    { v: 'v10.129', items: [
      ['Prüfungs-Lab: Teil 1 und Teil 2 getrennt', 'Oben im Prüfungs-Lab wählst du den Bereich Teil 1 oder Teil 2. Probeprüfungen, Training mit Prüfungs-Pool und Auswertung sind pro Bereich getrennt. Teil 2 enthält Systementwurf und Funktions- und Systemanalyse.', 'Prüfungs-Lab ▸ Bereich'],
      ['Prüfungs-Pool deutlich größer', 'Der Pool umfasst jetzt rund 950 eigene Übungsfragen im Stil der Kammerprüfungen von 2020 bis 2025, darunter Fragen zur Schaltung der Praxisprüfung Winter 2024. Alles sind eigene Formulierungen, keine Originalaufgaben.', 'Prüfungs-Lab ▸ Training und Probeprüfung']
    ] },
    { v: 'v10.128', items: [
      ['Wecker in der Quarzuhr (Ausbilder-Beispiel)', 'Die digitale Quarzuhr hat jetzt einen Wecker mit Summer: Weckzeit einstellen, bei Gleichstand schaltet der Summer. Als gesperrtes Ausbilder-Beispiel in SchaltLab und LochLab (Freigabe nur für Ausbilder).', 'SchaltLab und LochLab ▸ Beispiele ▸ Quarzuhr'],
      ['Mehrere Platinen und Flachbandkabel im LochLab', 'Große Schaltungen passen auf mehrere Platinen, verbunden durch ein Flachbandkabel. Menü „Platine hinzufügen“, das Kabel führt alle Adern von Platine zu Platine.', 'LochLab ▸ Menü ▸ Platine hinzufügen'],
      ['Elko-Polung wird simuliert', 'Gepolte Kondensatoren (Elko) werden jetzt richtig simuliert: Wer den Elko verkehrt herum einbaut (Plus am niedrigeren Potential), zerstört ihn, und die Simulation meldet es. Ungepolte Kondensatoren und Folienkondensatoren dürfen in beide Richtungen betrieben werden. Gilt in allen Labs mit Simulation.', 'SchaltLab, SimLab, LochLab, DigiLab, MessLab ▸ Elko'],
      ['Aufgaben-Prüfung zeigt den Fortschritt', 'Bei Verdrahtungsaufgaben im SimLab (zum Beispiel Schütz-Steuerung, Selbsthaltung, Motor) zeigt die Prüfung jetzt, wie viele Verbindungen der Musterlösung schon stehen und welche noch fehlen, statt nur „Lampe ist aus“.', 'SimLab ▸ Aufgabe ▸ Prüfen'],
      ['Zweistufiges Absetzen im SchaltLab', 'Bauteile werden in zwei Schritten gesetzt: erst das erste Bein fixieren, dann ausrichten und die Beine in der Länge ziehen, dann das zweite Bein absetzen. Der Körper bleibt gleich, nur die Anschlussdrähte werden länger. In der rechten Seitenleiste lässt sich das Ziehen ein- und ausschalten, dort gibt es auch einen Knopf zu den Tastenkürzeln.', 'SchaltLab ▸ Bauteil setzen, rechte Seitenleiste'],
      ['Datenblatt-Link bei ICs', 'Bei jedem IC führt ein Link zum Datenblatt des Bausteins.', 'SchaltLab, LochLab ▸ IC antippen'],
      ['Neue IC-Modelle', '4070, 4002, 4082, 4585, 4060, 4518, 4543 und 74138 sind jetzt in der Simulation.', 'SchaltLab, LochLab ▸ Bauteile ▸ ICs'],
      ['Auswahlfragen-Prüfung im Selbsttest', 'Der Selbsttest prüft jetzt auch die Auswahlfragen (Antwortmöglichkeiten und richtige Antwort) des Prüfungs-Labs.', 'selftest.html'],
      ['Neue Prüfungsfragen', 'Weitere Aufgaben im Prüfungs-Pool aus der Auswertung der Prüfungen Sommer 2025 und Winter 2025 (eigene Formulierungen, KI-Entwurf).', 'Prüfungs-Lab ▸ Prüfungs-Pool'] ] },
    { v: 'v10.127', items: [
      ['Neues Lab: Prüfungs-Lab', 'Für die Abschlussprüfung üben (Elektroniker/in für Geräte und Systeme): Training in acht Themen, Rechenserie, Probeprüfung mit 20 Aufgaben und Zeitlimit, Note nach IHK-Schlüssel, Auswertung mit Lernplan. 81 Fragen und 40 Rechengeneratoren mit zufälligen Werten, alle selbst formuliert.', 'Prüfungs-Lab'],
      ['Formelsammlung und Fragenbank', 'Alle Formeln nach Themen im Tab „Formeln“. Im Menü steht die Fragenbank zum Gegenlesen.', 'Prüfungs-Lab ▸ Formeln'],
      ['Teil 1 und Teil 2 im Prüfungsaufbau', 'Neue Probeprüfungen nach dem Aufbau der Kammerprüfung: Teil 1 (90 Minuten), Systementwurf und Funktions- und Systemanalyse (je 105 Minuten) mit Abwahl von Aufgaben, Rechenaufgaben zu je 10 Punkten und Gewichtung 50 : 50. Dazu ein Prüfungs-Pool mit 287 Aufgaben im Stil der letzten Prüfungen, nach Themen trainierbar (KI-Entwurf, noch nicht freigegeben).', 'Prüfungs-Lab ▸ Probeprüfung'],
      ['Praxis für die Prüfung', 'Neue Aufgaben im Stil der praktischen Prüfung und von Teil B: neun Prüfungsschaltungen im MessLab (LED, Poti, Operationsverstärker, Transistor, Z-Diode, Regler, Schutzdiode, Batterie-Innenwiderstand) mit drei Fehlersuchen, vier Programmieraufgaben im Arduino-Lab (Countdown, Luftampel, Heizstufen, Würfel-Fehlersuche) und drei Fehlersuchen im LochLab. Außerdem ist der Zufallsgenerator des Arduino-Simulators korrigiert (random lieferte nur ungerade Zahlen).', 'MessLab, Arduino-Lab, LochLab'],
      ['Aufgaben, Abzeichen, Kampagne', '16 neue Aufgaben, sieben Abzeichen, Trainer, Kampagnenkapitel „Die Abschlussprüfung“, Lernpfad-Spur „Prüfungsvorbereitung“ und Lernheft mit Arbeitsblatt.', 'Prüfungs-Lab ▸ Aufgaben'],
      ['KI-Führerschein', 'Sechs kurze Lektionen zum sicheren Umgang mit KI: Wohin gehen deine Eingaben, Daten-Ampel, Schwärzen üben, Antworten prüfen, fremden Code und Nachrichten prüfen, Regeln im Betrieb. Mit Abzeichen und Nachweis.', 'App-Werkstatt ▸ KI-Führerschein'] ] },
    { v: 'v9.126', items: [
      ['Neues Lab: App-Werkstatt', 'Eigene Apps mit einer KI bauen (Claude, ChatGPT oder andere), prüfen, verbessern und weitergeben, dazu ein eigener Wissensspeicher im Obsidian-Format. Ohne Vorkenntnisse. Der Auftrag-Baukasten schreibt gute Eingaben für dich, die Werkstatt startet fremden Code abgeschottet (kein Internet, kein Zugriff auf deinen Fortschritt).', 'Startseite ▸ App-Werkstatt'],
      ['Aufgaben in sechs Stufen', '17 Aufgaben vom ersten Start über Lernapps, KI-Antworten prüfen, Notizen und Datenschutz bis zur eigenen Lernapp für die Klasse. Das Lab prüft den Code automatisch.', 'App-Werkstatt ▸ Aufgaben'],
      ['Notizen für Obsidian', 'Notizen mit [[Verknüpfungen]] und #Schlagwörtern, Übersichtskarte, Export als ZIP für Obsidian, Import von Markdown-Dateien.', 'App-Werkstatt ▸ Notizen'],
      ['Bibliothek und Klassenbibliothek', 'Apps speichern, als Code oder Datei weitergeben, einlesen. Der Ausbilder kann geprüfte Apps für die ganze Klasse freigeben.', 'App-Werkstatt ▸ Bibliothek'],
      ['Lernheft, Abzeichen, Kampagne', 'Neues Lernheft „App-Werkstatt“ mit Arbeitsblatt, sechs Abzeichen, Trainer und ein Kampagnenkapitel „Die eigene Lernapp“.', 'Lernhefte'] ] },
    { v: 'v8.125', items: [
      ['Kundenaufträge', 'Neue Aufgaben, die mehrere Themen verbinden: Gartenhaus mit langer Leitung (Querschnitt, Spannungsfall, FI), Schranke mit Münzeinwurf als Zustandsautomat, Trittschallfilter mit 100 Hz im MessLab.', 'HausLab, DigiLab, MessLab ▸ Aufgaben'],
      ['Mehr Denkfragen', 'Vor fast jeder Aufgabe in allen Labs steht jetzt eine kurze Denkfrage: Was erwartest du? Mit sofortiger Erklärung.', 'Aufgabenkarte'],
      ['Prüfliste für Ausbilder', 'Alle fachlichen Aussagen des Labs (Querschnitte, FI, Schutzbereiche, Grenzwerte) stehen gesammelt zum Gegenlesen bereit.', 'Hinweise für Ausbilder'],
      ['Angeglichene Werte', 'Die Tabelle der Strombelastbarkeit im Heft passt jetzt zu den Werten des Labs (1,5 mm² 16,5 A, 2,5 mm² 23 A, 4 mm² 30 A, 6 mm² 38 A).', 'Lernheft HausLab'] ] },
    { v: 'v8.124', items: [
      ['Projekte für zuhause', 'Neue Seite mit Anleitungen zum Selbermachen, ohne Abgabe. Erstes Projekt: Pi-hole, Werbung im ganzen Heimnetz blocken, in 14 Schritten mit Übungsumgebung im Browser (Imager, Router, SSH-Terminal, Installer, Dashboard). Dazu drei Arduino-Projekte „Licht am Fahrzeug“ als Modell mit Hinweis auf Prüfzeichen und Betriebserlaubnis.', 'Startseite unten ▸ Projekte für zuhause'],
      ['HausLab: Obergeschoss und Treppenhaus', 'Häuser mit mehreren Geschossen. Mit „EG“ und „OG“ unten wechselst du die Ebene, das Treppenhaus verbindet beide. Neues Haus mit Obergeschoss, dazu Aufgaben.', 'HausLab ▸ Beispiele und Aufgaben'],
      ['HausLab: Kreuzschalter, Stromstoßschalter, Dusche', 'Kreuzschaltung für drei und mehr Orte, Stromstoßschalter mit Tastern, Dusche mit 60-cm-Schutzbereich im Bad.', 'HausLab ▸ Palette unten'],
      ['HausLab: Hauptsicherung, Zähler und Leitungen prüfen', 'Hauptsicherung im Verteiler, Zähler mit Zeitraffer im Bedienfeld, Tabelle mit Strombelastbarkeit und Spannungsfall je Stromkreis, Multimeter im Haus, eigene Häuser als Code teilen.', 'HausLab ▸ Verteiler, Bedienfeld, Menü'],
      ['MessLab: Frequenzgang, Logikanalysator, Messprotokoll', 'Neue Geräte in der Werkbank: Bode-Messplatz mit Grenzfrequenz, Logikanalysator mit Buswert und das Messprotokoll zum Drucken. Das Multimeter zeigt seine Genauigkeit. Beispiele zu Tastkopf-Kompensation und Filtern, fünf neue Aufgaben.', 'MessLab ▸ Werkbank'],
      ['DigiLab: KV-Diagramm, Zustandsautomaten, Unterprogramme', 'KV-Diagramm mit Don’t-Care, Werkzeug Zustandsautomat (bis zur gebauten Schaltung mit Reset), Fehler-Würfel für Gatter, IC-Beispiele mit Clear, Preset und Reset-Rückführung, Mini-CPU mit CALL und RET. Sieben neue Aufgaben.', 'DigiLab ▸ Menü'],
      ['Startseite', 'Die Vorschaubilder von DigiLab, MessLab und HausLab sind animiert, auch am Handy. „Neu“ zeigt die letzten 30 Versionen: zehn offen, 20 unter „Früher“.', 'Startseite'] ] },
    { v: 'v8.123', items: [
      ['Kompaktere Startseite', 'Die acht Labs stehen in vier Spalten und zwei Reihen mit kleineren Bildern, damit mehr auf einen Bildschirm passt.', 'Startseite'],
      ['„Warum?“ auch in SchaltLab, SimLab und DigiLab', 'Bei fehlgeschlagenen Prüfzeilen steht jetzt in allen Labs eine Erklärung: Ursache, Formel oder der Weg zur Lösung.', 'Aufgabe prüfen ▸ Warum?'],
      ['Denkfragen vor dem Start', 'Bei ausgewählten Aufgaben aller Labs beantwortest du vor dem Bauen eine Frage: Was erwartest du? Du bekommst sofort die Erklärung. Dazu das Abzeichen Vorausdenker.', 'Aufgabenkarte'],
      ['Lernstand sichern und mitnehmen', 'Dein Fortschritt liegt nur auf diesem Gerät. Jetzt kannst du ihn als Code, QR oder Datei sichern und auf einem anderen Gerät wieder einlesen (zusammenführen oder ersetzen).', 'Menü ▸ Lernstand sichern oder laden, Startseite unten'],
      ['HausLab und MessLab bedienen wie die anderen', 'Esc und Rechtsklick beenden das Werkzeug, Entf löscht, im HausLab drehen die Pfeiltasten das Haus. Beide Labs haben eigene Hilfetexte.', 'Menü ▸ Hilfe'] ] },
    { v: 'v8.122', items: [
      ['Lernpfad zum Aufklappen', 'Auf der Startseite ist der Lernpfad zugeklappt und zeigt nur eine Zeile: Fortschritt, Kampagne und ein Knopf zur nächsten Aufgabe. Antippen klappt Spuren und Kampagne auf, die Wahl wird gemerkt.', 'Startseite ganz oben'] ] },
    { v: 'v8.121', items: [
      ['Neue Reihenfolge der Labs', 'Digitaltechnik, Messtechnik und Hausinstallation stehen jetzt vor Arduino-Lab und Pi-Lab. Arduino-Lab und Pi-Lab sind die letzten Labs: Startseite, Lernpfad, Kampagne (neue Kapitelreihenfolge), Auswertung und Anleitung folgen dieser Reihenfolge.', 'Startseite, Kampagne'] ] },
    { v: 'v8.120', items: [
      ['Lernpfad auf der Startseite', 'Drei Spuren (Elektronik, Installation, Programmieren) mit empfohlener Reihenfolge. Jedes Lab zeigt Schwierigkeit, Fortschritt und einen Knopf „Weiter“ zur nächsten offenen Aufgabe, neue Labs „Einführung starten“. Die Kampagne steht ganz oben.', 'Startseite ganz oben'],
      ['„Warum?“ bei falschen Antworten', 'Bei fehlgeschlagenen Prüfzeilen im HausLab und MessLab steht jetzt eine Erklärung: Ursache, Formel oder der Weg zum Messen. Tippe auf „Warum?“ unter der Zeile.', 'HausLab und MessLab ▸ Aufgabe prüfen'],
      ['Korrigiert: Querschnitt bei Steckdosen', 'Für Steckdosen sind 2,5 mm² üblich und empfohlen, nicht zwingend. Die Texte sagen das jetzt. Außerdem erwähnt das Lernheft, dass der FI-Schutz auch für Lichtkreise gilt.', 'HausLab ▸ Aufgaben, Lernheft'],
      ['Bedienfeld im HausLab', 'Im Betrieb steht links ein Bedienfeld: alle Lichtschalter nach Raum, alle Geräte, FI und Automaten. Mit „Alle an“ und „Alle aus“ schaltest du das ganze Licht oder alle Geräte auf einmal. Die Wasser-Ansicht gibt es im HausLab nicht mehr.', 'HausLab ▸ Sim ▸ linke Leiste'],
      ['Selbsttest für Entwickler', 'Die Seite selftest.html prüft alle Aufgaben aller Labs in einem Rutsch.', 'selftest.html'] ] },
    { v: 'v8.119', items: [
      ['Drehstrom im HausLab', 'Die Häuser haben jetzt drei Phasen (L1, L2, L3). Neu: Drehstromgeräte (Herd, Wallbox, Durchlauferhitzer, Klimagerät, Motoren), CEE-Steckdose 400 V, dreipolige Automaten, fünfadrige Drehstromleitungen und ein vierpoliger FI. Einphasige Stromkreise bekommen ihre Phase im Verteiler.', 'HausLab ▸ Drehstromgerät, Verteiler'],
      ['Phasen verteilen', 'Im Verteilerkasten stellst du je Automat die Phase ein. Die Last je Phase wird berechnet, Schieflast fällt auf.', 'HausLab ▸ Verteiler ▸ Phase'],
      ['Vier neue Aufgaben', 'Herd anschließen, Wallbox und Durchlauferhitzer absichern, Phasen gleichmäßig belasten, Körperschluss am Herd mit vierpoligem FI. Das Einfamilienhaus hat jetzt Garage mit Wallbox, der Bürokomplex einen Technikraum.', 'HausLab ▸ Aufgaben ▸ Drehstrom'] ] },
    { v: 'v8.118', items: [
      ['HausLab: das achte Lab', 'Elektroinstallation im 3D-Haus: Drei Häuser (Einfamilienhaus, Altbau-Wohnung, Bürokomplex) und freies Gestalten mit eigenen Räumen. Du setzt Steckdosen, Schalter, Lampen und Geräte, ziehst Leitungen an Wänden und Decke und bestückst den Verteilerkasten. 14 Aufgaben, Trainer, Lernheft und Kampagnenkapitel.', 'Startseite ▸ HausLab'],
      ['Leitungen in den Installationszonen', 'Leitungen laufen nur an Wänden und Decke entlang, nie quer durch den Raum. Das Lab zeigt die Länge, du wählst den Querschnitt. Zwischen Räumen geht es nur durch die gemeinsame Wand, sonst über eine Abzweigdose.', 'HausLab ▸ Leitung'],
      ['Verteilerkasten bestücken', 'Setze FI-Schutzschalter und Sicherungsautomaten ein und verdrahte die Abgänge im Haus. Im Betrieb lösen Automaten und FI wirklich aus.', 'HausLab ▸ Verteiler'],
      ['Drehen, kippen, von oben sehen', 'Das Haus lässt sich in 90-Grad-Schritten drehen, von oben ansehen und zoomen. Im Betrieb leuchten Lampen, Geräte zeigen ihre Spannung und die Leitungen färben sich nach der Last.', 'HausLab ▸ Pfeile unten'],
      ['Wechselschaltung und Abzweigdosen', 'Wechselschalter lassen sich zu Paaren verdrahten, Abzweigdosen verteilen Leitungen auf mehrere Räume.', 'HausLab ▸ Beispiele ▸ Einfamilienhaus'] ] },
    { v: 'v7.117', items: [
      ['MessLab: das siebte Lab', 'Messtechnik mit Werkbank: Netzgerät mit Strombegrenzung, Funktionsgenerator, Multimeter, Oszilloskop, Frequenzzähler, Leistungsmesser und Kennlinienschreiber. 20 Beispiele, 26 Aufgaben mit Zahlenfeldern, Messfehler und Fehlersuche, Trainer, Lernheft und Kampagnenkapitel.', 'Startseite ▸ MessLab'],
      ['Werkbank fest oder frei', 'Die Geräte sitzen fest in einer Leiste unten oder als frei verschiebbare Fenster. Jedes Gerät lässt sich einzeln ein- und ausschalten.', 'MessLab ▸ Karte „Werkbank“ oder Menü ▸ Werkbank'],
      ['Messaufgaben mit Zahlenfeldern', 'Du misst, trägst die Zahl ein, das Lab prüft sie gegen den simulierten Wert. Einheit und Zehnerpotenz werden mitgeprüft.', 'MessLab ▸ Menü ▸ Aufgaben'],
      ['Messfehler-Aufgaben', 'Falsche Buchse, falscher Bereich, Strommesser parallel, Voltmeter belastet den Kreis, Tastkopf ×10: Finde den Fehler und behebe ihn.', 'MessLab ▸ Aufgaben ▸ Messfehler'],
      ['Neue Teile für alle Labs', 'Aufgaben können jetzt Zahlenfelder und Auswahlfragen enthalten.', 'Aufgabenkarte in jedem Lab'] ] },
    { v: 'v6.116', items: [
      ['DigiLab: das sechste Lab', 'Digitaltechnik zum Ausprobieren: Gatter, Flipflops, Zähler, echte ICs (CD4011, 4017, 7490, 4511) und eine kleine Mini-CPU zum Programmieren. 17 Beispiele, 20 Aufgaben mit Prüfung, Trainer, Lernheft mit Arbeitsblatt, Kampagnenkapitel und neue Abzeichen.', 'Startseite ▸ DigiLab'],
      ['Wahrheitstabelle und Schaltung aus Tabelle', 'Das Lab probiert alle Schalterkombinationen durch und zeigt Tabelle und kürzeste Gleichung. Umgekehrt trägst du eine Tabelle ein, das Lab baut die Gatterschaltung samt Verdrahtung.', 'DigiLab ▸ Menü oder Karte „Digitaltechnik“'],
      ['Zeitdiagramm (Logikanalysator)', 'Mehrere Messpunkte als Spuren mit gemeinsamer Zeitachse: Taktteiler, Zähler und Schieberegister sieht man auf einen Blick.', 'DigiLab ▸ Simulation, Messpunkte setzen'],
      ['Mini-CPU TF-4', 'Vier Bit, Assembler mit 33 Befehlen, Registeranzeige, Flags, RAM und Einzelschritt. Vier Beispielprogramme und vier Programmieraufgaben.', 'DigiLab ▸ Menü ▸ Mini-CPU: Programm'],
      ['Zahlenumrechner', 'Dezimal, Binär, Hex, BCD, Gray-Code und Zweierkomplement umrechnen, dazu Übungsaufgaben.', 'DigiLab ▸ Menü ▸ Zahlenumrechner'],
      ['Flipflops und Taktgeber', 'Neue Bausteine JK-Flipflop, T-Flipflop und Taktgeber. Fehler im 7490 behoben (Dezimalzähler zählte nicht).', 'DigiLab ▸ Bauteilliste'] ] },
    { v: 'v5.115', items: [
      ['Kampagne: Das Abschlussgerät', 'Ein Lernpfad mit Geschichte über alle Labs: neun Kapitel mit Meister Funk, Missionen aus Aufgaben, Trainern, Messen, Löten und Programmieren. Dein Fortschritt zählt von selbst, Kapitel schalten nacheinander frei. Zwei neue Abzeichen.', 'Menü ▸ Kampagne, außerdem Karte auf der Startseite'],
      ['Kopfleiste nur mit Symbolen', 'Beschriftungen sind weg, es bleibt mehr Platz. Der Name erscheint beim Zeigen mit der Maus und beim Antippen. „Aufgaben“, „Öffnen“ und „Drucken“ stehen jetzt ganz oben im Menü.', 'Oben in jedem Lab, Menü ▸ oberste Einträge'] ] },
    { v: 'v5.114', items: [
      ['Bauteile fühlen', 'Das Relais klackt, Schalter rasten, der Motor läuft mit Brummen an und aus, Sicherungen und Automaten lösen mit Ruck aus, ein Kurzschluss rüttelt. Vibration am Handy und passende Klicks. Abschaltbar.', 'Menü ▸ Bauteile fühlen an/aus'],
      ['Nachbesprechung auf Wunsch', 'Nach Durchbrennen, Auslösen oder Schlag erscheint ein kleiner Hinweis. Erst auf „Warum? Erkläre mir das“ gibt es die Erklärung mit Zahlen und Abhilfe. Bei Detektiv-Fällen bleibt sie bis zur Lösung zu.', 'Seitenleiste in der Simulation (SchaltLab, SimLab, Arduino-, Pi-Lab)'] ] },
    { v: 'v5.113', items: [
      ['Versionsliste mit 50 Einträgen', 'Unter „Früher“ stehen jetzt die 50 Versionen vor v5.103 in einer Zeile je Version.', 'Menü ▸ Neu in dieser Version ▸ Früher'] ] },
    { v: 'v5.112', items: [
      ['Sprachsteuerung', 'Mit dem Mikrofon-Knopf kurze Befehle geben: „Starte Simulation“, „Setze einen Widerstand“, „Wert 4,7 Kiloohm“, „Wasser-Ansicht“, „Rückgängig“, „Trainer“. Nur nach Zustimmung, die Erkennung macht der Browser deines Geräts.', 'Menü ▸ Sprachsteuerung an/aus, danach Knopf 🎤 unten links'] ] },
    { v: 'v5.111', items: [
      ['Lötübung', 'Löten üben mit Hitze und Zinn (sechs Lötstellen) und Lupen-Prüfung: schlechte Lötstellen auf einer Reihe erkennen.', 'Menü ▸ Lötübung (alle Labs)'],
      ['Oszilloskop-Trainer', 'Übungsgerät mit Zeitbasis, Volt je Kästchen und Trigger, fünf Ableseaufgaben mit Zufallszahlen und ein Kurven-Rätsel (welche Schaltung macht diese Kurve?).', 'Menü ▸ Oszilloskop-Trainer (alle Labs)'],
      ['Rangliste und Wochenwertung', 'Punkte pro Azubi, „Woche starten“ merkt den Stand, die Spalte „diese Woche“ zeigt den Zuwachs. Wochenpreis kopieren und Urkunde drucken.', 'Ausbilder: Auswertung (auswertung.html)'] ] },
    { v: 'v5.110', items: [
      ['Schaltungs-Detektiv', 'Acht Fälle mit Geschichte: In jeder Schaltung steckt ein versteckter Fehler. Du misst, findest Bauteil und Fehlerart und sammelst Punkte. Jeder falsche Versuch kostet Punkte.', 'Menü ▸ Schaltungs-Detektiv (SchaltLab)'],
      ['Multimeter wie echt', 'Drehschalter (V Gleich, V Wechsel, A, Ω), Buchsen (VΩ, mA, 10 A) und eine Messgerätesicherung. Wer falsch einstellt, bekommt die Folgen zu spüren: Spannung in der Strombuchse brennt die Sicherung durch, Widerstand misst man nur spannungsfrei.', 'Simulation ▸ Messen (SchaltLab, SimLab, Arduino-, Pi-Lab)'],
      ['Zeitreise und Wasser-Ansicht im LochLab', 'In der Simulation: ⏪ Zurück und ⏩ Schritt spulen die Zeit, 💧 Wasser zeigt Druck, Engstelle, Tank, Pumpe und Rad.', 'LochLab: Simulation an, Leiste unten'] ] },
    { v: 'v5.109', items: [
      ['Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen in jedem Lab: Scheinwerfer auf die Stelle, Erklärung in der Sprechblase, bei manchen Schritten wartet der Trainer, bis du es selbst gemacht hast. Beim ersten Besuch eines Labs wird er angeboten. Zwei neue Abzeichen.', 'Menü ▸ Trainer: Erste Schritte (alle Labs)'] ] },
    { v: 'v5.108', items: [
      ['Neu in dieser Version', 'Diese Übersicht: Stichpunkte je Version mit Fundort. Auch per Tipp auf die Versionsanzeige unten rechts.', 'Menü ▸ Neu in dieser Version'] ] },
    { v: 'v5.107', items: [
      ['Spule als Schwungrad', 'In der Wasser-Ansicht dreht sich ein Rad mit dem Spulenstrom, es läuft träge an und aus.', 'Simulation an, blauer Wasser-Schalter oben'] ] },
    { v: 'v5.106', items: [
      ['Wasser-Schalter oben', 'Blauer Schalter neben dem grünen Sim-Schalter, merkt sich den Zustand.', 'Kopfleiste, nur bei eingeschalteter Simulation'] ] },
    { v: 'v5.105', items: [
      ['Kein Flackern mehr', 'Beim Absetzen, Verschieben und Rechtsklick bleibt das Bild ruhig, Kurven werden nicht mehr geleert.', 'überall'] ] },
    { v: 'v5.104', items: [
      ['Bauteile sprechen', 'Bauteil antippen, dann erklärt es sich selbst per Sprachausgabe mit Sprechblase. Automatisch an oder aus schaltbar.', 'Bauteilkarte „Erkläre dich“, Menü ▸ Bauteile sprechen automatisch'],
      ['Wasser-Ansicht', 'Strom als Wasser, Spannung als Druck. Widerstand = Engstelle, Kondensator = Tank, Batterie = Pumpe, Spule = Rad.', 'Kopfleiste (blauer Schalter), Simulationskarte, Menü'],
      ['Zeitreise', 'Simulation zurückspulen und Schritt für Schritt ansehen.', 'Simulationskarte in der Seitenleiste (Regler, Schritt, Live)'],
      ['Tagesaufgabe', 'Jeden Tag neue Zahlen, für alle gleich, mit Serie und Kalender.', 'Menü ▸ Tagesaufgabe (SchaltLab)'],
      ['Duell', 'Gleiche Aufgabe, schnellste Zeit gewinnt. Zeiten gehen in die Rangliste der Auswertung.', 'Menü ▸ Duell (SchaltLab), Ausbilder: Auswertung'],
      ['Escape-Room', 'Vier Räume, jede gelöste Aufgabe verrät eine Ziffer des Türcodes.', 'Menü ▸ Escape-Room (SchaltLab)'],
      ['Tonwerkstatt', 'Klaviertasten mit echten Tönen, fertiger tone()-Code, 555-Sirenenrechner.', 'Menü ▸ Tonwerkstatt (alle Labs)'] ] },
    { v: 'v5.103', items: [
      ['Abzeichen und Konfetti', 'Für Erfolge, Serien und Projekte.', 'Menü ▸ Abzeichen'],
      ['Fehler-Würfel', 'Würfelt einen versteckten Fehler in die Schaltung, den du finden musst.', 'Menü ▸ Fehler-Würfel'],
      ['Zufallsaufgaben', 'Eigene Zahlen für jeden Azubi, „Neue Zahlen würfeln“.', 'Menü ▸ Aufgaben (SchaltLab)'],
      ['Vorhersage-Modus', 'Vor dem Start tippen, was passiert.', 'Menü ▸ Vorhersage-Modus'],
      ['Spannungsquelle live ändern', 'Volt, bei Wechselspannung auch Frequenz, ohne Neustart.', 'Bedienfeld (Simulation), LochLab: Quelle antippen'],
      ['Export', 'Bild (PNG), Animation (GIF), Messkurven (CSV).', 'Menü ▸ Bild speichern, Animation als GIF, Oszilloskop-Daten'] ] },
    { v: 'Früher: die 50 Versionen davor (v5.53 bis v5.102)', old: [
      ['v5.102', 'Export: Bild (PNG), Animation (GIF), Messkurven als CSV.'],
      ['v5.101', 'Seitenleisten lassen sich höchstens so weit aufziehen, wie der längste Text breit ist.'],
      ['v5.100', 'Seitenleisten ein- und ausklappen und in der Breite ziehen (alle Labs).'],
      ['v5.99', 'Kopfzeile in allen Labs besser lesbar; die SimLab-Kopfzeile läuft am iPad quer nicht mehr über.'],
      ['v5.98', 'LochLab-Kopfzeile und Versionsanzeige besser lesbar (nach dem ersten iPad-Test).'],
      ['v5.97', 'Projekt Netzteil 5 V: Plan im SchaltLab, Aufbau im LochLab.'],
      ['v5.96', 'Projekt Dämmerungsschalter mit Relais (Plan, dann Aufbau).'],
      ['v5.95', 'Vorschau beim Auto-Weg: gestrichelter Weg bis zum Finger oder Mauszeiger.'],
      ['v5.94', 'Regler in echten Einheiten (°C, cm, lx, V, Ω) mit Zahleneingabe.'],
      ['v5.93', 'Auto-Weg: Drähte suchen sich selbst den Weg mit 90°-Knicken.'],
      ['v5.92', 'Spannungsquellen und Masse stehen ganz oben in der Bauteilliste.'],
      ['v5.91', 'Projekt Ampel mit 555 und CD4017: Plan im SchaltLab, Aufbau im LochLab.'],
      ['v5.90', 'LochLab: Beispiele und Aufgaben MOSFET und Duo-LED; Hinweis „Schneller stellen“ bei niedrigem Tempo.'],
      ['v5.89', 'Tipp-Stufen: Tipp, konkreter Hinweis, Lösung.'],
      ['v5.88', 'Lernhefte mit Arbeitsblättern für LochLab, SchaltLab und SimLab.'],
      ['v5.87', 'Auswertung: Scanner-Übersicht und Datenübertragung auf ein anderes Gerät.'],
      ['v5.86', 'QR-Codes: Aufgaben verteilen, Ergebnisse per QR abgeben und einscannen.'],
      ['v5.85', 'Auswertung für Ausbilder: Ergebnis-Code, Tabelle, CSV.'],
      ['v5.84', 'LochLab am Handy: Knopf „Bauteil“ wieder da.'],
      ['v5.83', 'Treppenhaus-Fehler behoben (Taster mindestens 0,1 s gedrückt); neue Bauteile (Schottky, MOSFET, DIAC, TRIAC, Varistor, Duo-LED, Duo-7-Segment, RGB-LED), Rechner, Aufgaben s6 bis s16.'],
      ['v5.82', 'SimLab: Prüfplatz VDE 0701/0702, Leitungen und Messgeräte; Tastenkürzel in allen Editoren.'],
      ['v5.81', 'LochLab: 16 Aufgaben (Aufbau und Fehlersuche) mit Prüfung.'],
      ['v5.80', 'SimLab: Netz mit Massebezug, kein Blinken mehr hinter offenen Schaltern.'],
      ['v5.79', 'SimLab: Körperschluss löst Automat oder FI aus; Überlast-Beispiel mit vier Oszilloskopen.'],
      ['v5.78', 'LochLab simuliert Arduino Uno und Raspberry Pi samt Programm.'],
      ['v5.77', 'LochLab: Raspberry Pi als Bauteil, sechs Pi-Layoutbeispiele.'],
      ['v5.76', 'Versionsanzeige; Durchsicht aller Beispiele (drei Fehler behoben); Debug-Hilfen.'],
      ['v5.75', 'Prüfhilfe für den Schutzleiter in allen SimLab-Beispielen.'],
      ['v5.74', 'Pi-Lab: eigene Klassen und I²C (Sensoren LM75 und BH1750).'],
      ['v5.73', 'Slogan mit Punkt am Ende.'],
      ['v5.72', 'Neuer Slogan: „… es gibt immer eine Schaltung, die noch fehlt.“'],
      ['v5.71', 'Slogan auf der Startseite.'],
      ['v5.70', 'Star-Wars-Beispiel für Arduino und Pi; animierte Vorschaubilder auf der Startseite.'],
      ['v5.69', 'Anleitung und Ausbilder-Hinweise um den Schutzleiter ergänzt.'],
      ['v5.68', 'Schutzleiter PE an Hausverbrauchern, Körperschluss einschaltbar.'],
      ['v5.67', 'Pi-Lab: Wandler MCP3008, TMP36, vier neue Aufgaben (jetzt 16).'],
      ['v5.66', 'LochLab: Spannungsquelle und Signalgenerator werden gezeichnet; zweiter Stromkreis bekommt Massebezug.'],
      ['v5.65', 'Pi-Lab als fünftes Lab mit Python; das CodeLab heißt jetzt Arduino-Lab.'],
      ['v5.64', 'Seite „SD-Karte vorbereiten“ für den Raspberry Pi.'],
      ['v5.63', 'Lernbereich mit Heften für Arduino und Pi.'],
      ['v5.62', 'Anleitung für Azubis und Seite für Ausbilder (mit PDFs).'],
      ['v5.61', 'Arduino-Lab: zehn weitere Aufgaben (jetzt 23); Phantom-Tastendruck beim Start behoben.'],
      ['v5.60', 'Layout-Automat kennt den Arduino (Uno, Servo, Sensoren); LochLab-Beispiele für Arduino.'],
      ['v5.59', 'Arduino-Lab am Handy: Aufgabenkarte steht oben.'],
      ['v5.58', 'LochLab-Bauteilliste mit Suchlinks zu Reichelt und Conrad.'],
      ['v5.57', 'Layout-Automat: Batterie und Wechselspannung als Quellen im LochLab, die Simulation läuft dort.'],
      ['v5.56', 'Aufgaben mit automatischer Prüfung in allen drei Labs.'],
      ['v5.55', 'Handyansicht: zweizeilige Kopfleiste.'],
      ['v5.54', 'Bauteilliste links mit Lupen-Suche in allen Labs; Kippschalter und Glühlampe im Layout-Automaten.'],
      ['v5.53', 'Zusätzliche Beispiele: SchaltLab plus zehn, SimLab plus drei, Arduino-Lab.']] }
  ];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function open() {
    if (document.getElementById('neuBox')) return;
    const cur = root.LAB_VERSION || LOG[0].v;
    const w = document.createElement('div'); w.id = 'neuBox';
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom)) 16px;-webkit-overflow-scrolling:touch';
    const oldBlock = (b) => `<details style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(b.v)}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.old.map(o => `<li style="margin:5px 0"><b>${esc(o[0])}</b>: ${esc(o[1])}</li>`).join('')}</ul></details>`;
    const block = (b, open) => `<details${open ? ' open' : ''} style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(b.v)}${b.v === cur ? ' <span style="background:#2fae45;color:#fff;border-radius:8px;padding:1px 8px;font-size:12px;margin-left:6px">aktuell</span>' : ''}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.items.map(i => `<li style="margin:7px 0"><b>${esc(i[0])}</b>: ${esc(i[1])}<br><span style="color:#6cb8ff;font-size:13px">Fundort: ${esc(i[2])}</span></li>`).join('')}</ul></details>`;
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:640px;width:100%;font:15px system-ui,sans-serif"><div style="position:sticky;top:-16px;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:8px;background:#1f262e;padding:6px 0 8px;margin-top:-6px"><b style="font-size:19px">Neu in Tonfunk Lab ${esc(cur)}</b><button id="neuX" style="flex:none;min-width:48px;height:44px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div><p style="color:#9aa6b2;margin:6px 0 4px">Das ist zuletzt dazugekommen und so findest du es.</p>${LOG.slice(0, 10).map((b, i) => b.old ? oldBlock(b) : block(b, i < 2)).join('')}${LOG.length > 10 ? `<details style="margin:12px 0 0;border:1px dashed #38424d;border-radius:10px;padding:8px 12px"><summary style="cursor:pointer;font-weight:700;font-size:16px;color:#6cb8ff">Früher (die 20 Versionen davor)</summary>${LOG.slice(10, 30).map(b => b.old ? oldBlock(b) : block(b, false)).join('')}</details>` : ''}<button id="neuX2" style="display:block;width:100%;height:46px;margin-top:14px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font:600 15px system-ui;cursor:pointer">Schließen</button></div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('#neuX').onclick = close; w.querySelector('#neuX2').onclick = close; document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } }); w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  }
  root.WhatsNew = { open, LOG };
})(typeof window !== 'undefined' ? window : globalThis);
