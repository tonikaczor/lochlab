'use strict';
/* Tonfunk Lab: „Neu in dieser Version“. Stichpunkte je Version mit Fundort. Bei jedem Release hier oben einen Block ergänzen. */
(function (root) {
  const LOG = [
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
    w.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px';
    const oldBlock = (b) => `<details style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(b.v)}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.old.map(o => `<li style="margin:5px 0"><b>${esc(o[0])}</b>: ${esc(o[1])}</li>`).join('')}</ul></details>`;
    const block = (b, open) => `<details${open ? ' open' : ''} style="margin:8px 0;border:1px solid #38424d;border-radius:10px;padding:8px 12px;background:#252d36"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(b.v)}${b.v === cur ? ' <span style="background:#2fae45;color:#fff;border-radius:8px;padding:1px 8px;font-size:12px;margin-left:6px">aktuell</span>' : ''}</summary><ul style="margin:8px 0 2px;padding-left:20px">${b.items.map(i => `<li style="margin:7px 0"><b>${esc(i[0])}</b>: ${esc(i[1])}<br><span style="color:#6cb8ff;font-size:13px">Fundort: ${esc(i[2])}</span></li>`).join('')}</ul></details>`;
    w.innerHTML = `<div style="background:#1f262e;color:#e8eaed;border:1px solid #38424d;border-radius:14px;padding:16px;max-width:640px;width:100%;font:15px system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">Neu in Tonfunk Lab ${esc(cur)}</b><button id="neuX" style="background:none;border:0;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div><p style="color:#9aa6b2;margin:6px 0 4px">Das ist zuletzt dazugekommen und so findest du es.</p>${LOG.map((b, i) => b.old ? oldBlock(b) : block(b, i < 2)).join('')}</div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('#neuX').onclick = close; w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  }
  root.WhatsNew = { open, LOG };
})(typeof window !== 'undefined' ? window : globalThis);
