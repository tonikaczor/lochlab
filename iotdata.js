'use strict';
/* Tonfunk Industrie-4.0-Lab: Daten (Aufgaben-Generatoren). Lab-Kennung 'iot'.
   ALLE Zahlen sind ÜBUNGSWERTE. Frei erfundene Firma "Modellbetrieb", keine Hersteller, keine Produktnamen. Normen und Gesetze nur beim Namen genannt.
   window.IOT_DATA  { cats, tasks, gens, make, makeTask, randomQ, pools }
   window.IOT_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.iot.done' = {id:true})
   Jede Frage q: { text, ask, value, tol, expl, tips[2], steps[] (So gehst du vor) }.
   Titel verraten weder Ergebnis noch Lösung. Eingaben nie negativ: Gesucht sind immer Beträge, Zeiten, Anzahlen.
   Datenmengen dezimal: 1 kB = 1.000 Byte, 1 MB = 1.000.000 Byte. */
(function (root) {
  const C = () => root.IOT_CORE || (typeof require === 'function' ? require('./iotcore.js') : null);
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Begriffe und Ziele', 'Datenkette vom Sensor zur Cloud', 'MQTT', 'Maschinen anbinden', 'Datenmengen rechnen', 'IT-Sicherheit in vernetzten Anlagen'];

  /* Toleranz: 0,5 % vom Wert, mindestens 0,01 (die Anzeige rundet auf 2 Stellen) */
  const tol = v => Math.max(0.01, C().rd(Math.abs(v) * 0.005, 2));
  const numQ = (text, value, unit, label, tl, expl, tips, steps, more) => Object.assign({ text, ask: { type: 'num', unit, label }, value, tol: tl, expl, tips, steps }, more || {});
  function choiceQ(R, text, right, wrong, expl, tips, steps, more) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return Object.assign({ text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps }, more || {});
  }
  /* Pool: Einträge [Text, richtig, falsch[], Erklärung, Tipps]; Schritte gelten für den ganzen Pool */
  const pq = (POOL, steps) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], steps); };
  /* Zeit lesbar: unter 1 s in ms */
  const fT = t => (t < 1 ? f(t * 1000, 0) + ' ms' : f(t, 0) + ' s');

  /* ============================================================ Begriffe und Ziele */
  const S1 = '1. Stufe: Mechanisierung (Wasser- und Dampfkraft)', S2 = '2. Stufe: Massenfertigung (Fließband, elektrische Antriebe)', S3 = '3. Stufe: Automatisierung (Elektronik, SPS, Roboter)', S4 = '4. Stufe: Vernetzung (Daten, Internet der Dinge)';
  const REVL = [S1, S2, S3, S4], REVT = [
    'Ein Webstuhl wird von einem Wasserrad oder einer Dampfmaschine angetrieben statt von Hand. Zu welcher Stufe der Industrialisierung gehört das?',
    'Ein Fließband mit elektrischen Antrieben, an dem jeder Arbeiter einen festen Handgriff macht. Zu welcher Stufe gehört das?',
    'Eine speicherprogrammierbare Steuerung (SPS) steuert einen Roboter, der Teile ohne Zutun eines Menschen verschraubt. Zu welcher Stufe gehört das?',
    'Maschinen melden ihren Zustand über ein Netz, ein digitaler Zwilling zeigt die Anlage am Bildschirm. Zu welcher Stufe gehört das?'];
  const REV = REVT.map((t, i) => [t, REVL[i], REVL.filter((_, j) => j !== i), 'Die vier Stufen: Mechanisierung (Dampfkraft), Massenfertigung (Strom, Fließband), Automatisierung (Elektronik, SPS) und Vernetzung (Daten, Internet der Dinge). Dieses Beispiel passt zur ' + REVL[i].slice(0, 8) + '.', ['Ordne nach der Zeit: erst Dampf, dann Strom, dann Elektronik, dann Netze.', 'Achte auf das Stichwort: Wasser und Dampf, Fließband, SPS oder Vernetzung.']]);
  const REV_STEPS = ['Suche im Text das Schlüsselwort: Dampf, Fließband, SPS oder Netz und Daten.', 'Ordne es einer der vier Stufen zu: Mechanisierung, Massenfertigung, Automatisierung, Vernetzung.', 'Wähle die Stufe, die zu diesem Stichwort gehört.'];
  const CPS = [
    ['Was ist ein cyber-physisches System?', 'Eine Maschine oder Anlage, die über Sensoren und Software mit der digitalen Welt verbunden ist und Daten austauscht', ['Ein Computer, der nur in der Cloud läuft und keine Hardware hat', 'Ein Schutzprogramm gegen Angriffe aus dem Netz', 'Ein Roboter, der ohne jedes Netzwerk arbeitet'], 'Cyber-physisch heißt: Die physische Welt (Maschine, Sensor, Aktor) und die digitale Welt (Software, Netz, Daten) sind eng verbunden und tauschen laufend Daten aus.', ['Cyber steht für die digitale Seite, physisch für die Maschine.', 'Gesucht ist das Zusammenspiel beider Seiten.']],
    ['Ein Förderband meldet seine Drehzahl an ein Leitsystem und bekommt von dort neue Sollwerte. Was zeigt das Beispiel?', 'Eine Anlage und ihre Software arbeiten über Sensoren, Netz und Regelung zusammen (cyber-physisches System)', ['Reine Büro-IT ohne Bezug zur Maschine', 'Ein Tabellenprogramm, das Zahlen speichert', 'Eine rein mechanische Steuerung ohne Elektronik'], 'Messwerte laufen von der Maschine in die Software, Sollwerte laufen zurück: Das ist der Kreislauf eines cyber-physischen Systems.', ['Zeigt die Daten in beide Richtungen?', 'Maschine und Software sind verbunden.']],
    ['Welche Bauteile verbinden bei einem cyber-physischen System die physische Welt mit dem Rechenteil?', 'Sensoren (Messwerte hinein) und Aktoren (Befehle hinaus)', ['Nur ein Bildschirm und eine Tastatur', 'Nur eine Cloud ohne Verbindung zur Maschine', 'Nur Papierformulare und ein Stempel'], 'Sensoren erfassen den Zustand, Aktoren verändern ihn. Dazwischen liegen Rechenteil und Netz.', ['Wie kommen Messwerte in den Rechner?', 'Wie wirkt ein Befehl auf die Maschine?']]
  ];
  const CPS_STEPS = ['Lies die Frage und denke an den Kreislauf: Messen, Übertragen, Auswerten, Handeln.', 'Streiche Antworten ohne Verbindung zwischen Maschine und Software.', 'Wähle die Antwort, in der physische und digitale Welt zusammenarbeiten.'];
  const ZWILL = [
    ['Was ist ein digitaler Zwilling?', 'Ein digitales Abbild einer Maschine, das mit ihren echten Messdaten aktuell gehalten wird', ['Eine zweite, baugleiche Maschine als Reserve', 'Eine Sicherungskopie der Steuerungssoftware', 'Ein Foto der Maschine im Wartungshandbuch'], 'Der digitale Zwilling bildet die Maschine in Software nach und bekommt laufend Daten von der echten Maschine. So zeigt er ihren aktuellen Zustand.', ['Zwilling heißt hier: ein Abbild, aber in Software.', 'Er braucht laufend Daten der echten Maschine.']],
    ['Wozu kann man einen digitalen Zwilling nutzen?', 'Änderungen und Fehler am Abbild durchspielen, ohne die echte Anlage zu stören', ['Die echte Anlage ersetzen, sodass sie nie mehr laufen muss', 'Passwörter der Anlage verwalten', 'Netzwerkkabel ersetzen'], 'Am Abbild kann man Parameter ausprobieren, Abläufe testen und Ausfälle üben. Die echte Anlage läuft währenddessen ungestört weiter.', ['Was kann man gefahrlos am Abbild tun?', 'Das Abbild ersetzt die Maschine nicht.']],
    ['Was unterscheidet einen digitalen Zwilling von einem reinen Schaltplan?', 'Er wird laufend mit Daten der echten Maschine versorgt und zeigt ihren aktuellen Zustand', ['Er hat mehr Seiten als ein Schaltplan', 'Er funktioniert nur ohne Daten', 'Er wird nur einmal beim Bau der Maschine gezeichnet'], 'Ein Schaltplan ist ein fester Stand. Der Zwilling lebt von den aktuellen Messwerten und bildet den Zustand jetzt ab.', ['Ein Schaltplan ändert sich nicht von selbst.', 'Denke an Messwerte in Echtzeit.']]
  ];
  const ZWILL_STEPS = ['Lies die Frage: Geht es um das Abbild oder um die echte Maschine?', 'Streiche Antworten, bei denen der Zwilling nur eine Kopie oder ein Foto ist.', 'Wähle die Antwort mit Abbild plus aktuellen Daten.'];
  const INSTL = ['reaktiv (erst nach dem Ausfall)', 'vorbeugend (nach festen Zeiten)', 'zustandsorientiert (bei Grenzwert)', 'vorausschauend (aus Trend und Restlaufzeit)'], INSTT = [
    'Ein Lager wird erst getauscht, wenn die Maschine stehen bleibt. Wie nennt man diese Instandhaltung?',
    'Ein Filter wird alle sechs Monate getauscht, egal in welchem Zustand er ist. Wie nennt man diese Instandhaltung?',
    'Eine Wartungsmeldung erscheint, sobald die Lagertemperatur 75 °C erreicht. Wie nennt man diese Instandhaltung?',
    'Aus dem Verlauf der Schwingung der letzten Wochen wird geschätzt, dass die Grenze in zwölf Tagen erreicht ist, und der Tausch wird im nächsten Stillstand geplant. Wie nennt man diese Instandhaltung?'];
  const INST = INSTT.map((t, i) => [t, INSTL[i], INSTL.filter((_, j) => j !== i), ['Hier wartet man erst, wenn etwas kaputt ist.', 'Hier entscheidet nur der Kalender, nicht der Zustand.', 'Hier löst ein Messwert über der Grenze die Meldung aus.', 'Hier wird aus dem Trend berechnet, wann die Grenze erreicht wird (Predictive Maintenance).'][i], ['Wer entscheidet über den Zeitpunkt: Ausfall, Kalender, Messwert oder Trend?', 'Nur beim Trend wird die Zukunft berechnet.']]);
  const INST_STEPS = ['Finde im Text, was den Zeitpunkt des Tauschs bestimmt: Ausfall, Kalender, Messwert oder Trend.', 'Ordne zu: Ausfall = reaktiv, Kalender = vorbeugend, Grenzwert = zustandsorientiert, Trend = vorausschauend.', 'Wähle die passende Bezeichnung.'];
  const EDGEC = [
    ['Ein Gateway in der Halle bildet aus 60 Messwerten je Minute einen Mittelwert und sendet nur diesen weiter. Was ist das?', 'Vorverarbeitung am Rand (Edge), die Datenmenge spart', ['Speicherung im Rechenzentrum (Cloud)', 'Eine Verschlüsselung der Leitung', 'Ein Sensorfehler'], 'Edge heißt: Rechnen nah an der Maschine. Das Gateway verdichtet die Daten, bevor sie ins Netz gehen.', ['Wo findet das Mitteln statt: bei der Maschine oder weit weg?', 'Nah an der Maschine heißt Edge.']],
    ['Eine Auswertung über die Daten von 20 Standorten soll laufen. Wo passt sie am besten hin?', 'In die Cloud oder ein zentrales Rechenzentrum, weil dort alle Standorte zusammenkommen', ['Auf den einzelnen Sensor', 'In das Netzwerkkabel', 'Nirgends, so etwas geht nicht'], 'Ein Standort sieht nur seine Daten. Für den Vergleich aller Standorte braucht man einen zentralen Ort, die Cloud.', ['Wer sieht die Daten aller Standorte?', 'Ein einzelnes Gerät kennt nur seine eigenen Werte.']],
    ['Eine Maschine muss innerhalb von 10 ms auf einen Messwert reagieren. Wo wird er ausgewertet?', 'Lokal am Rand (Steuerung oder Edge), weil der Weg in die Cloud zu lange dauert', ['In der Cloud, weil sie am schnellsten ist', 'Beim Anwender zu Hause', 'Nur nachts im Stapelbetrieb'], 'Der Weg in die Cloud und zurück dauert oft viele Millisekunden bis Sekunden und schwankt. Schnelle Regelung bleibt deshalb vor Ort.', ['Wie lang ist der Weg in die Cloud und zurück?', 'Schnelle Reaktion braucht kurze Wege.']],
    ['Das Netz zum Rechenzentrum fällt eine Stunde aus. Welche Lösung läuft trotzdem weiter?', 'Eine lokale Auswertung am Rand (Edge)', ['Eine reine Cloud-Auswertung', 'Ein Dashboard, das im Internet liegt', 'Eine Auswertung in einem anderen Land'], 'Was vor Ort rechnet, braucht das Netz nicht. Cloud-Dienste sind ohne Verbindung nicht erreichbar.', ['Was braucht keine Verbindung nach außen?', 'Edge arbeitet vor Ort.']]
  ];
  const EDGEC_STEPS = ['Lies, was gebraucht wird: schnelle Antwort, wenig Datenmenge, alle Standorte oder Ausfallsicherheit.', 'Ordne zu: schnell und lokal = Edge, standortübergreifend und viel Rechenleistung = Cloud.', 'Wähle die Antwort, die zur Anforderung passt.'];
  const ZIELE = [
    ['Welches ist ein typisches Ziel von Industrie 4.0?', 'Flexiblere Fertigung auch kleiner Stückzahlen mit kurzen Umrüstzeiten', ['Möglichst alle Mitarbeiter zu ersetzen, egal was es kostet', 'Alle Maschinen vom Netz zu trennen', 'Papier statt Datenbanken zu nutzen'], 'Typische Ziele sind Flexibilität, Transparenz, Effizienz und Rückverfolgbarkeit. Vernetzte Maschinen lassen sich schneller auf neue Aufträge einstellen.', ['Welches Ziel hat mit Vernetzung zu tun?', 'Flexibilität gehört zu den Zielen.']],
    ['Was bedeutet Transparenz in einer vernetzten Fertigung?', 'Der Zustand von Maschinen und Aufträgen ist jederzeit aktuell sichtbar', ['Die Fabrikwände sind aus Glas', 'Alle Passwörter sind öffentlich', 'Die Maschinen laufen unbeobachtet'], 'Transparenz heißt: Daten zeigen, was gerade geschieht, ohne dass man an die Maschine gehen muss.', ['Transparent bedeutet durchsichtig, hier für Daten.', 'Wer sieht den Zustand, ohne hinzugehen?']],
    ['Was bedeutet Rückverfolgbarkeit?', 'Man kann später nachweisen, welches Teil wann auf welcher Maschine mit welchen Einstellungen entstanden ist', ['Man kann Produkte zurücknehmen und neu verkaufen', 'Man betrachtet die Maschine von hinten', 'Man speichert nur den Endpreis'], 'Mit Daten zu jedem Teil lässt sich bei einem Fehler genau eingrenzen, welche Teile betroffen sind.', ['Rückwärts verfolgen: von dem Teil zu seiner Entstehung.', 'Welche Angaben gehören zu einem Teil?']]
  ];
  const ZIELE_STEPS = ['Lies die Frage und denke an die vier Ziele: Flexibilität, Transparenz, Effizienz, Rückverfolgbarkeit.', 'Streiche Antworten, die nichts mit Daten und Vernetzung zu tun haben.', 'Wähle die Antwort, die zum Ziel passt.'];
  const EDGEC2 = [
    ['Eine Kamera erzeugt 200 Mbit/s, wichtig sind nur die Fehlermeldungen. Was ist sinnvoll?', 'Die Bilder am Rand auswerten und nur die Fehlermeldung weitergeben', ['Alle Bilder in die Cloud schicken und dort auswerten', 'Die Kamera ausschalten', 'Alle Bilder ausdrucken'], 'Eine große Datenmenge schickt man nicht nutzlos durchs Netz. Die Auswertung am Rand verdichtet sie auf eine kleine Meldung.', ['Wie viel Bandbreite braucht der Rohstrom?', 'Was wird wirklich gebraucht?']],
    ['Die Messwerte enthalten Rezepturdaten, die das Werk nicht verlassen sollen. Was spricht dafür?', 'Die Auswertung im eigenen Netz, am Rand oder auf einem lokalen Server', ['Alle Rohdaten ungeprüft in die Cloud zu schicken', 'Die Daten per Funk zu verteilen', 'Die Rezeptur im Dashboard zu veröffentlichen'], 'Vertrauliche Daten bleiben besser im eigenen Netz. Nach außen geht nur, was nötig und unkritisch ist.', ['Wer darf die Daten sehen?', 'Was im Werk bleibt, kann nicht nach außen gelangen.']],
    ['Ein Dashboard für alle Standorte soll weltweit im Browser abrufbar sein. Wo läuft es am besten?', 'In der Cloud oder einem zentralen Server, auf den alle Standorte ihre Daten schicken', ['Auf dem Mikrocontroller eines Sensors', 'Im Schaltschrank einer einzelnen Maschine', 'Auf einem Datenträger, der verschickt wird'], 'Ein zentraler Dienst sammelt die Daten aller Standorte und ist von überall erreichbar.', ['Wer muss das Dashboard erreichen?', 'Ein Gerät an einer Maschine ist von außen schlecht erreichbar.']]
  ];
  const EDGEC2_STEPS = ['Lies die Anforderung: Datenmenge, Vertraulichkeit oder weltweiter Zugriff.', 'Ordne zu: große Datenmenge oder vertraulich = lokal verarbeiten, weltweit sichtbar = zentral.', 'Wähle die Lösung, die diese Anforderung am besten erfüllt.'];

  /* ============================================================ Datenkette */
  const KETTE = [
    ['Welche Reihenfolge beschreibt den Weg eines Messwerts richtig?', 'Sensor, Mikrocontroller, Gateway, Netzwerk, Server (Cloud), Dashboard', ['Dashboard, Server, Netzwerk, Gateway, Mikrocontroller, Sensor', 'Sensor, Dashboard, Gateway, Server, Netzwerk, Mikrocontroller', 'Mikrocontroller, Sensor, Server, Gateway, Netzwerk, Dashboard'], 'Der Messwert entsteht am Sensor, wird vom Mikrocontroller digitalisiert, vom Gateway gesammelt, über das Netz zum Server übertragen und im Dashboard angezeigt.', ['Wo entsteht der Wert und wo wird er gelesen?', 'Der Mensch sieht ihn ganz am Ende.']],
    ['Welche Stufe kommt in der Kette direkt nach dem Mikrocontroller, der den Sensor ausliest?', 'Das Gateway, das die Daten sammelt und weiterleitet', ['Das Dashboard', 'Der Sensor', 'Der Speicher in der Cloud'], 'Der Mikrocontroller gibt seine Daten an ein Gateway. Das Gateway verbindet das Maschinennetz mit dem übergeordneten Netz.', ['Wer sammelt Daten mehrerer Geräte?', 'Nach dem Auslesen geht es weiter ins Netz.']],
    ['An welcher Stelle der Kette sieht ein Mensch die Werte als Kurve oder Zahl?', 'Im Dashboard (Auswertung und Anzeige)', ['Im Sensor', 'Im Netzwerkkabel', 'Im Gateway-Prozessor'], 'Das Dashboard ist die letzte Stufe: Es stellt die gespeicherten Daten für Menschen dar.', ['Welche Stufe ist für Menschen gebaut?', 'Das Dashboard steht ganz am Ende der Kette.']]
  ];
  const KETTE_STEPS = ['Schreibe die Stufen als Pfeilkette auf: Sensor, Mikrocontroller, Gateway, Netzwerk, Server, Dashboard.', 'Finde in der Frage den Anfang oder das Ende der Kette.', 'Wähle die Antwort, die zur Kette passt.'];
  const STUFEN = [
    ['Welche Aufgabe hat der Sensor?', 'Eine physikalische Größe (zum Beispiel Temperatur) in ein elektrisches Signal umwandeln', ['Die Daten für das Dashboard hübsch darstellen', 'Die Nachrichten an alle Abonnenten verteilen', 'Das Netzwerk vor Angriffen schützen'], 'Der Sensor wandelt Temperatur, Druck oder Schwingung in ein elektrisches Signal um. Alles Weitere machen die nächsten Stufen.', ['Der Sensor steht ganz am Anfang.', 'Er misst, er rechnet nicht.']],
    ['Welche Aufgabe hat der Mikrocontroller am Sensor?', 'Das Signal digitalisieren, umrechnen und als Nachricht senden', ['Die Daten für Monate speichern', 'Das Dashboard anzeigen', 'Das Werksnetz mit dem Internet verbinden'], 'Der Mikrocontroller liest das Signal ein (Analog-Digital-Wandler), rechnet in eine Einheit um und sendet die Nachricht.', ['Welche Stufe macht aus Spannung eine Zahl?', 'Er liegt zwischen Sensor und Gateway.']],
    ['Welche Aufgabe hat das Gateway?', 'Daten mehrerer Geräte sammeln, Protokolle umsetzen und gesichert ins übergeordnete Netz weitergeben', ['Messwerte physikalisch erfassen', 'Die Kurve im Dashboard zeichnen', 'Das Passwort des Sensors festlegen'], 'Das Gateway sitzt zwischen Maschinennetz und übergeordnetem Netz. Es sammelt, setzt um und leitet weiter, oft verarbeitet es schon vor.', ['Gateway heißt Tor oder Übergang.', 'Es verbindet zwei Netze.']],
    ['Welche Aufgabe hat der Server in der Cloud?', 'Daten annehmen, speichern und für die Auswertung bereithalten', ['Die Temperatur messen', 'Das Signal am Sensor verstärken', 'Die Kabel zwischen den Maschinen prüfen'], 'Der Server speichert die Daten über lange Zeit und stellt sie dem Dashboard und Auswertungen zur Verfügung.', ['Wo liegen die Daten langfristig?', 'Der Server ist keine Messstelle.']],
    ['Welche Aufgabe hat das Dashboard?', 'Die Daten für Menschen übersichtlich anzeigen, mit Verlauf und Warnungen', ['Die Spannung am Sensor wandeln', 'Pakete im Netz verschlüsseln', 'Den Mikrocontroller programmieren'], 'Das Dashboard ist die Schnittstelle zum Menschen: Kurven, Zahlen, Grenzwerte und Meldungen.', ['Für wen ist das Dashboard gebaut?', 'Es zeigt, es misst nicht.']]
  ];
  const STUFEN_STEPS = ['Nenne die Stufe aus der Frage und ihren Platz in der Kette.', 'Überlege, was an dieser Stelle vorher ankommt und was danach weitergeht.', 'Wähle die Aufgabe, die dazwischen passt.'];
  const VORVER = [
    ['Ein Sensor liefert zehn Werte je Sekunde, das Dashboard braucht nur einen Wert je Minute. Wo sollte gemittelt werden?', 'Im Gateway, bevor die Daten ins Netz gehen', ['Erst im Dashboard, nachdem alle Rohwerte übertragen wurden', 'Gar nicht, Mitteln ist nicht erlaubt', 'Im Netzwerkkabel'], 'Je früher man verdichtet, desto weniger Daten belasten das Netz und den Speicher. Das Gateway ist dafür der richtige Ort.', ['Wo vermeidet man am meisten Datenverkehr?', 'Der Rand bildet den Mittelwert.']],
    ['Der Messumformer liefert 4 bis 20 mA, die Auswertung erwartet °C. Wo rechnet man sinnvoll um?', 'Nah an der Maschine (Mikrocontroller oder Gateway), damit überall dieselbe Einheit ankommt', ['Erst im Dashboard, jede Anzeige rechnet für sich', 'Gar nicht, Strom ist dasselbe wie Temperatur', 'Im Netzwerkkabel'], 'Wer zentral umrechnet, hat nur einen Ort für Skalierung und Fehler. Alle weiteren Stufen sehen schon die fertige Einheit.', ['Wer kennt den Messbereich des Sensors?', 'Einmal und möglichst früh umrechnen.']],
    ['Ein Sensor schickt nur dann einen Wert, wenn sich der Messwert um mehr als 0,5 °C geändert hat. Welchen Vorteil hat das?', 'Weniger Daten im Netz, ohne wichtige Änderungen zu verpassen', ['Der Sensor misst dadurch genauer', 'Das Netz braucht keine Verschlüsselung mehr', 'Der Sensor braucht keine Spannungsversorgung mehr'], 'Wenn sich nichts ändert, braucht man nichts zu senden. Das spart Datenmenge und Energie (Senden bei Änderung).', ['Was wird gesendet, wenn sich nichts ändert?', 'Es geht um die Menge der Daten.']]
  ];
  const VORVER_STEPS = ['Lies, was gesendet und was gebraucht wird.', 'Überlege, wo man die Datenmenge am frühesten verkleinern kann.', 'Wähle die Antwort mit dem Ort nah an der Maschine.'];
  const FEHLER = [
    ['Im Dashboard fehlen alle Werte einer Halle. Im Gateway sieht man, dass die Messwerte der Sensoren ankommen und gesendet werden. Wo sucht man als Nächstes?', 'Auf dem Weg zum Broker: Netzwerk, Firewall, Adresse und Zugangsdaten', ['Am Sensorkabel', 'Im Netzteil der Sensoren', 'Am Netzteil des Bildschirms im Büro'], 'Die Kette ist bis zum Gateway in Ordnung. Der Fehler liegt dahinter, also bei Netz, Firewall, Zugangsdaten oder Adresse des Brokers.', ['Bis wohin ist die Kette in Ordnung?', 'Suche hinter der letzten Stufe, die noch funktioniert.']],
    ['Nur ein Sensor fehlt, alle anderen Werte kommen an. Wo sucht man zuerst?', 'Am Sensor selbst: Versorgung, Anschluss, Adresse oder Topic dieses Sensors', ['Im Rechenzentrum der Cloud', 'Am Hauptschalter der ganzen Halle', 'Am Router des Betreibers'], 'Weil alle anderen Werte ankommen, funktionieren Netz und Server. Der Fehler liegt bei dem einen Sensor.', ['Was haben die funktionierenden Sensoren gemeinsam?', 'Was ist nur bei dem einen anders?']],
    ['Die Werte kommen an, aber alle zeigen genau 0,0. Ein Multimeter misst am Messumformer 12 mA. Wo liegt der Fehler wahrscheinlich?', 'Bei der Umrechnung im Mikrocontroller oder Gateway (Eingang oder Skalierung)', ['In der Farbwahl des Dashboards', 'Im Netzwerkkabel zur Cloud', 'In der Zeitzone des Servers'], 'Der Messumformer liefert einen Wert, aber nach der Umrechnung kommt 0 an. Der Fehler liegt zwischen Messumformer und Nachricht.', ['Wo ist der Wert noch richtig, wo nicht mehr?', 'Zwischen diesen beiden Punkten liegt der Fehler.']],
    ['Alle Werte kommen an, aber im Dashboard mit zwei Stunden Verspätung. Was ist die wahrscheinlichste Ursache?', 'Falsche Uhrzeit oder Zeitzone bei einem Gerät der Kette', ['Der Sensor ist zu empfindlich', 'Das Kabel ist zu dünn', 'Die Messwerte sind zu klein'], 'Wenn die Werte vollständig und richtig sind, aber die Zeit stimmt nicht, liegt es an der Uhr oder an der Zeitzone eines Gerätes.', ['Sind die Werte selbst richtig?', 'Dann stimmt etwas mit der Zeit nicht.']]
  ];
  const FEHLER_STEPS = ['Gehe die Kette von vorn durch und markiere die letzte Stufe, die noch richtige Werte hat.', 'Der Fehler liegt direkt dahinter.', 'Wähle die Antwort, die diese Stelle prüft.'];

  /* ============================================================ MQTT */
  const ROLLEN = [
    ['Welche Aufgabe hat der Broker in MQTT?', 'Er nimmt Nachrichten an und leitet sie an alle passenden Abonnenten weiter', ['Er misst die Werte an der Maschine', 'Er zeigt die Werte auf dem Bildschirm an', 'Er wandelt Analogsignale in Zahlen um'], 'Der Broker ist die Vermittlungsstelle: Sender und Empfänger kennen sich nicht, nur den Broker.', ['Broker heißt Vermittler.', 'Er steht zwischen Sender und Empfänger.']],
    ['Wie kommt ein Messwert von einem Publisher zu einem Subscriber?', 'Der Publisher sendet an den Broker, der Broker leitet an den Subscriber weiter', ['Der Publisher sendet direkt an den Subscriber', 'Der Subscriber fragt jede Sekunde direkt beim Publisher nach', 'Beide benutzen ein gemeinsames Kabel ohne Vermittler'], 'Alle Nachrichten laufen über den Broker. Publisher und Subscriber verbinden sich nur mit ihm.', ['Kennen sich Publisher und Subscriber?', 'Wer steht in der Mitte?']],
    ['Ein Sensor veröffentlicht Messwerte (publish). Was muss er dafür nicht wissen?', 'Wer die Daten abonniert hat', ['Das Topic, unter dem er sendet', 'Die Adresse des Brokers', 'Das Format der Nachricht'], 'Der Publisher kennt nur Broker, Topic und Nachricht. Wer mitliest, entscheidet der Broker anhand der Abonnements.', ['Wer sendet an wen?', 'Der Sender kennt die Empfänger nicht.']],
    ['Ein Dashboard soll alle Temperaturen der Halle 1 anzeigen. Was tut es?', 'Es abonniert (subscribe) die passenden Topics beim Broker', ['Es veröffentlicht (publish) die Temperaturen selbst', 'Es startet den Broker neu', 'Es fragt jeden Sensor einzeln mit dessen Adresse'], 'Wer Daten haben will, abonniert sie. Danach schickt der Broker jede passende Nachricht von selbst.', ['Wer will Daten, wer liefert Daten?', 'Daten haben wollen heißt abonnieren.']]
  ];
  const ROLLEN_STEPS = ['Schreibe auf: Publisher (sendet), Broker (vermittelt), Subscriber (empfängt).', 'Wer verbindet sich mit wem? Beide Seiten nur mit dem Broker.', 'Wähle die Antwort, die diese Rollen richtig verteilt.'];
  const TOPICQ = [
    ['Welches Topic darf ein Sensor zum Senden (publish) benutzen?', 'halle1/linie2/temperatur', ['halle1/+/temperatur', 'halle1/linie2/#', '#'], 'Beim Senden braucht man ein ganz bestimmtes Topic. Die Platzhalter + und # gibt es nur beim Abonnieren.', ['Platzhalter stehen nur in Filtern.', 'Welches Topic hat keine Zeichen + oder #?']],
    ['Welches Topic darf ein Feuchtesensor in der zweiten Halle zum Senden benutzen?', 'halle2/lager/feuchte', ['halle2/+/feuchte', 'halle2/#', '+/lager/feuchte'], 'Ein Topic zum Senden ist ein fester Pfad aus Ebenen, getrennt durch Schrägstriche, ohne Platzhalter.', ['Suche das Topic ohne + und #.', 'Zum Senden muss der Pfad genau feststehen.']],
    ['Welcher dieser Filter zum Abonnieren ist ungültig?', 'halle1/#/temperatur', ['halle1/+/temperatur', 'halle1/#', '+/linie2/temperatur'], 'Das Zeichen # darf nur ganz am Ende stehen, weil es alle weiteren Ebenen meint.', ['Wo darf # stehen?', 'Danach können keine Ebenen mehr folgen.']],
    ['Welcher dieser Filter zum Abonnieren ist ungültig?', 'halle1/lin+/temperatur', ['halle1/+/temperatur', 'halle1/linie2/#', '#'], 'Das Zeichen + ersetzt immer eine ganze Ebene. Es darf nicht mitten in einem Namen stehen.', ['Wofür steht +?', 'Es ersetzt die ganze Ebene, nicht nur Buchstaben.']]
  ];
  const TOPICQ_STEPS = ['Lies, ob gesendet (publish) oder abonniert (subscribe) wird.', 'Prüfe jede Antwort: Beim Senden keine Platzhalter, beim Abonnieren # nur am Ende und + nur als ganze Ebene.', 'Wähle die Antwort, die die Regel erfüllt oder verletzt, wie die Frage es verlangt.'];
  const PLATZ = [
    ['Was bedeutet das Zeichen + in einem Filter wie halle1/+/temperatur?', 'Genau eine beliebige Ebene an dieser Stelle', ['Beliebig viele Ebenen ab dieser Stelle', 'Das Wort „plus“ als Name der Ebene', 'Alle Topics, die Zahlen enthalten'], 'Das Plus ist ein Platzhalter für genau eine Ebene. Es passt zu linie1, linie2 und so weiter, aber nicht zu zwei Ebenen.', ['Eine Ebene oder mehrere?', 'Es steht für genau eine.']],
    ['Was bedeutet das Zeichen # in einem Filter wie halle1/#?', 'Beliebig viele Ebenen unterhalb von halle1', ['Genau eine Ebene unterhalb von halle1', 'Nur Topics, die mit # enden', 'Nichts, es ist ein Kommentar'], 'Die Raute ersetzt beliebig viele Ebenen und steht deshalb immer am Ende des Filters.', ['Eine oder viele Ebenen?', 'Es sammelt alles darunter ein.']],
    ['Welches dieser Topics passt zum Filter halle1/+/druck?', 'halle1/linie3/druck', ['halle1/druck', 'halle1/linie3/ofen/druck', 'halle2/linie3/druck'], 'Das Plus steht für genau eine Ebene. Nur halle1/linie3/druck hat drei Ebenen mit halle1 vorn und druck hinten.', ['Zähle die Ebenen: der Filter hat drei.', 'Das Topic muss auch drei Ebenen haben.']],
    ['Welches Topic passt zum Filter halle1/#, aber nicht zum Filter halle1/+?', 'halle1/linie2/temperatur', ['halle1/linie2', 'halle2/linie2/temperatur', 'halle2/linie2'], 'halle1/+ passt nur auf Topics mit genau zwei Ebenen. halle1/# passt auf alles unter halle1. Nur das Topic mit drei Ebenen passt zu #, aber nicht zu +.', ['Wie viele Ebenen lässt das Plus zu?', 'Das Topic muss in halle1 liegen.']],
    ['Welche Nachrichten bekommt ein Abonnent, der nur den Filter # benutzt?', 'Alle Nachrichten der normalen Topics im Broker', ['Nur Nachrichten ohne Ebenen', 'Keine, # allein ist ungültig', 'Nur die erste Nachricht nach dem Start'], 'Die Raute allein passt auf jedes Topic. Solch ein Abonnent bekommt alles und eignet sich zum Mitlesen beim Testen.', ['Welche Ebenen deckt # allein ab?', 'Es ist der weiteste Filter.']]
  ];
  const PLATZ_STEPS = ['Zähle die Ebenen des Filters (getrennt durch Schrägstriche).', 'Prüfe, ob ein Plus (genau eine Ebene) oder eine Raute (beliebig viele Ebenen) vorkommt.', 'Wähle die Antwort, die dazu passt.'];
  const QOSB = [
    ['Was bedeutet QoS 0 bei MQTT?', 'Höchstens einmal: Die Nachricht wird ohne Bestätigung gesendet und kann verloren gehen', ['Genau einmal, mit mehrstufiger Bestätigung', 'Mindestens einmal, doppelte Zustellung ist möglich', 'Die Nachricht wird verschlüsselt'], 'QoS 0 ist die einfachste Stufe: einmal senden, keine Bestätigung. Das ist schnell und sparsam, aber nicht sicher.', ['Wird bei QoS 0 bestätigt?', 'Null Aufwand heißt höchstens einmal.']],
    ['Was bedeutet QoS 1 bei MQTT?', 'Mindestens einmal: Der Empfänger bestätigt, ohne Bestätigung wird wiederholt, Duplikate sind möglich', ['Höchstens einmal ohne Bestätigung', 'Genau einmal, dafür mit mehrstufigem Austausch', 'Die Nachricht hat höchste Priorität im Broker'], 'Bei QoS 1 wird bestätigt. Kommt keine Bestätigung, wird noch einmal gesendet. Deshalb kann eine Nachricht doppelt ankommen.', ['Was passiert ohne Bestätigung?', 'Wiederholen kann Duplikate erzeugen.']],
    ['Was bedeutet QoS 2 bei MQTT?', 'Genau einmal: Durch mehrstufigen Austausch kommt die Nachricht nicht doppelt und nicht gar nicht an', ['Höchstens einmal ohne Bestätigung', 'Mindestens einmal, Duplikate sind möglich', 'Die Nachricht wird zweimal gesendet'], 'QoS 2 sichert mit einem Austausch aus mehreren Schritten, dass die Nachricht genau einmal ankommt. Das kostet die meisten Nachrichten.', ['Welche Stufe verhindert auch Duplikate?', 'Hier wird mehrfach hin und her gesprochen.']],
    ['Welche QoS-Stufe verursacht den meisten Nachrichtenaustausch?', 'QoS 2', ['QoS 0', 'QoS 1', 'Alle drei gleich viel'], 'QoS 0 braucht eine Nachricht, QoS 1 zwei (Senden und Bestätigung), QoS 2 vier Schritte.', ['Je sicherer, desto mehr Aufwand.', 'Zähle die Schritte je Stufe.']]
  ];
  const QOSB_STEPS = ['Merke die Stufen: 0 = höchstens einmal, 1 = mindestens einmal, 2 = genau einmal.', 'Prüfe die Frage: Geht es um Bestätigung, Duplikate oder Aufwand?', 'Wähle die Antwort, die zur Stufe passt.'];
  const QOSW = [
    ['Ein Temperaturwert wird jede Sekunde gesendet. Geht einer verloren, ist der nächste in einer Sekunde da. Welche Stufe ist die sparsamste, die ausreicht?', 'QoS 0', ['QoS 1', 'QoS 2', 'Keine, ohne Stufe geht gar nichts'], 'Der Wert wird ständig erneuert, ein Verlust fällt nicht ins Gewicht. QoS 0 spart Nachrichten.', ['Wie schlimm ist ein verlorener Wert?', 'Der nächste kommt in einer Sekunde.']],
    ['Ein Alarm „Behälter voll“ darf nicht verloren gehen. Eine doppelte Meldung stört nicht. Welche Stufe reicht aus und ist sparsamer als die höchste?', 'QoS 1', ['QoS 0', 'QoS 2', 'Keine, der Broker erledigt das allein'], 'Der Alarm muss ankommen, doppelt schadet nicht: Mindestens einmal reicht, also QoS 1.', ['Darf die Meldung verloren gehen?', 'Duplikate sind erlaubt.']],
    ['Ein Befehl „Ventil einmal öffnen und eine Portion dosieren“ darf nicht fehlen und auf keinen Fall zweimal ausgeführt werden. Welche Stufe?', 'QoS 2', ['QoS 0', 'QoS 1', 'Keine, die Steuerung merkt sich das selbst'], 'Weder verlieren noch doppelt: genau einmal, also QoS 2.', ['Sind Duplikate erlaubt?', 'Doppelte Ausführung wäre ein Schaden.']]
  ];
  const QOSW_STEPS = ['Frage: Darf die Nachricht verloren gehen? Darf sie doppelt ankommen?', 'Ordne zu: verlieren erlaubt = 0, nicht verlieren, doppelt erlaubt = 1, weder noch = 2.', 'Wähle die sparsamste Stufe, die das Problem löst.'];
  const RETAIN = [
    ['Was bewirkt das Retain-Flag an einer Nachricht?', 'Der Broker merkt sich die letzte Nachricht dieses Topics und gibt sie neuen Abonnenten sofort', ['Die Nachricht wird verschlüsselt', 'Die Nachricht wird an alle Topics gesendet', 'Die Nachricht wird nach der Zustellung sofort gelöscht'], 'Retain heißt zurückhalten: Der Broker speichert die letzte Nachricht je Topic und liefert sie beim Abonnieren sofort aus.', ['Retain bedeutet behalten.', 'Wer ist neu dazugekommen?']],
    ['Ein Dashboard startet neu und soll sofort den letzten Zustand der Maschine sehen, ohne auf die nächste Meldung zu warten. Was hilft?', 'Zustandsmeldungen mit Retain senden', ['Die Abtastrate auf 1 ms stellen', 'QoS 0 verwenden', 'Den Broker auf Port 8883 umstellen'], 'Mit Retain hat der Broker den letzten Wert und liefert ihn gleich nach dem Abonnieren.', ['Wer liefert den alten Wert?', 'Der Broker, wenn er ihn behalten hat.']],
    ['Wie löscht man eine zurückgehaltene Nachricht im Broker?', 'Eine leere Nachricht mit Retain auf dasselbe Topic senden', ['Den Sensor neu starten', 'Das Topic umbenennen', 'Mit QoS 2 senden'], 'Eine leere Nachricht mit gesetztem Retain ersetzt den gespeicherten Wert durch nichts. So wird er gelöscht.', ['Der gespeicherte Wert wird überschrieben.', 'Überschreibe ihn mit einer leeren Nachricht.']],
    ['Ein Subscriber abonniert halle1/+/temperatur. Im Broker sind zwei passende zurückgehaltene Nachrichten gespeichert. Was bekommt er sofort?', 'Beide zurückgehaltenen Nachrichten, je die letzte pro Topic', ['Nur die älteste', 'Keine, erst nach der nächsten Messung', 'Alle Nachrichten der letzten Stunde'], 'Der Broker speichert je Topic genau eine Nachricht, die letzte. Passen zwei Topics, kommen beide.', ['Wie viele merkt sich der Broker je Topic?', 'Es sind zwei Topics.']]
  ];
  const RETAIN_STEPS = ['Merke: Retain heißt, der Broker behält die letzte Nachricht je Topic.', 'Frage: Wer bekommt diese Nachricht, und wann?', 'Wähle die Antwort, die dazu passt.'];

  /* ============================================================ Maschinen anbinden */
  const PORTL = ['OPC UA', 'Modbus TCP', 'MQTT ohne Verschlüsselung', 'MQTT mit TLS (verschlüsselt)'];
  const PORTN = [4840, 502, 1883, 8883];
  const PORTS = PORTN.map((p, i) => ['Welches Protokoll benutzt als Standard den Port ' + p + '?', PORTL[i], PORTL.filter((_, j) => j !== i), 'Standardports: OPC UA 4840, Modbus TCP 502, MQTT 1883 (ohne Verschlüsselung) und 8883 (mit TLS).', ['Lerne die vier Ports auswendig.', 'Der Port 8883 ist die verschlüsselte Variante von 1883.']]);
  PORTS.push(['Eine Firewall soll nur verschlüsseltes MQTT zulassen. Welchen Standardport gibt man frei?', '8883', ['1883', '502', '4840'], 'MQTT mit TLS nutzt als Standard den Port 8883. Port 1883 ist unverschlüsselt, 502 gehört zu Modbus TCP, 4840 zu OPC UA.', ['Welcher MQTT-Port ist der verschlüsselte?', 'Verschlüsselt heißt TLS.']]);
  const PORTS_STEPS = ['Schreibe die vier Standardports auf: 4840, 502, 1883, 8883.', 'Ordne jedem Port sein Protokoll zu.', 'Wähle die Antwort, die zur Frage passt.'];
  const OPCQ = [
    ['Was unterscheidet OPC UA von Modbus TCP bei der Beschreibung der Daten?', 'OPC UA beschreibt Daten mit Namen, Datentyp und Einheit in einem Informationsmodell, Modbus kennt nur nummerierte Register', ['Modbus kennt ein Informationsmodell, OPC UA nicht', 'Beide beschreiben die Daten auf dieselbe Weise', 'OPC UA gibt es nur für die Geräte eines einzigen Herstellers'], 'Bei OPC UA sind Namen, Typen, Einheiten und Struktur Teil der Verbindung. Bei Modbus muss man in der Gerätedokumentation nachlesen, was Register 40001 bedeutet.', ['Wo steht bei Modbus, was ein Register bedeutet?', 'Ein Informationsmodell hat Namen und Typen.']],
    ['Was heißt herstellerunabhängig bei OPC UA?', 'Der Standard ist offen, Geräte verschiedener Hersteller sprechen dieselbe Sprache', ['Es läuft nur auf einem Betriebssystem', 'Es ist nur für Geräte eines Herstellers freigegeben', 'Es braucht keine Netzwerkverbindung'], 'OPC UA ist ein offener Standard. Dadurch lassen sich Geräte und Software verschiedener Hersteller verbinden.', ['Wer besitzt den Standard?', 'Offen heißt für alle Hersteller nutzbar.']],
    ['Wozu dient das Durchsuchen (Browse) bei OPC UA?', 'Ein Client kann die Objekte und Variablen des Servers auflisten, ohne eine Registertabelle zu brauchen', ['Es löscht alte Daten im Server', 'Es verschlüsselt die Verbindung', 'Es sucht freie IP-Adressen im Netz'], 'Durch Browse sieht ein Client, welche Daten der Server anbietet, mit Namen und Typ.', ['Was sieht ein neuer Client zuerst?', 'Er listet das Angebot des Servers auf.']],
    ['Wie ist die Sicherheit bei OPC UA vorgesehen?', 'Der Standard enthält Verschlüsselung, Signatur und Zertifikate, sie müssen aber eingerichtet werden', ['Gar nicht, dafür muss immer ein VPN her', 'Nur durch ein Passwort im Klartext', 'Nur durch einen geheimen Port'], 'OPC UA bringt Sicherheitsfunktionen von Haus aus mit. Wie bei jeder Technik müssen sie auch eingeschaltet und gepflegt werden.', ['Ist Sicherheit schon im Standard enthalten?', 'Eingebaut heißt nicht automatisch eingeschaltet.']]
  ];
  const OPCQ_STEPS = ['Merke: OPC UA hat ein Informationsmodell, Modbus nummerierte Register.', 'Prüfe, welche Antwort zu den Merkmalen von OPC UA passt.', 'Wähle die Antwort, die du begründen kannst.'];
  const MODQ = [
    ['Wie sind die Daten bei Modbus TCP abgelegt?', 'In nummerierten Registern mit 16 Bit, was ein Register bedeutet steht in der Gerätedokumentation', ['In einem Baum mit Namen und Einheiten', 'In Dateien auf dem Gerät', 'Als JSON-Text'], 'Modbus kennt nur Registernummern und Rohwerte. Die Bedeutung steht in der Registertabelle des Herstellers.', ['Wie wird ein Wert bei Modbus gefunden?', 'Über die Registernummer.']],
    ['Wer fragt bei Modbus TCP?', 'Der Client (früher Master) fragt, der Server (früher Slave) antwortet', ['Der Server meldet jede Änderung von selbst', 'Beide senden zu zufälligen Zeiten', 'Ein Broker verteilt die Daten'], 'Modbus arbeitet nach dem Frage-Antwort-Prinzip. Der Client fragt Register ab oder schreibt sie.', ['Meldet der Server von sich aus etwas?', 'Es gibt keinen Broker.']],
    ['Was fehlt Modbus TCP von Haus aus?', 'Verschlüsselung und Anmeldung', ['Die Abfrage von Registern', 'Ein Port', 'Die Übertragung über Ethernet'], 'Das Protokoll sendet im Klartext und prüft nicht, wer fragt. Schutz muss man im Netz herstellen.', ['Was ist bei Modbus nicht eingebaut?', 'Denke an Sicherheit.']],
    ['Warum fragt ein Modbus-Client regelmäßig neu ab (Polling)?', 'Weil der Server von sich aus keine Änderungen meldet', ['Weil die Verbindung sonst einschläft', 'Weil Register sonst gelöscht werden', 'Weil der Broker es verlangt'], 'Der Server wartet nur auf Fragen. Wer aktuelle Werte will, muss immer wieder fragen.', ['Wer wartet, wer fragt?', 'Kein Broker, keine Meldung von selbst.']]
  ];
  const MODQ_STEPS = ['Merke: Modbus TCP hat Port 502, 16-Bit-Register, Frage und Antwort, keinen Schutz.', 'Prüfe jede Antwort gegen diese Merkmale.', 'Wähle die Antwort, die zu Modbus TCP passt.'];
  const WANN = [
    ['Eine ältere Kleinsteuerung hat nur Modbus TCP. Ein Zähler und ein Temperaturmodul sollen schnell angebunden werden, einfache Zahlen genügen. Was ist am einfachsten?', 'Modbus TCP: Register abfragen und im Gateway umrechnen', ['OPC UA mit eigenem Informationsmodell aufbauen', 'Ein eigenes Funkprotokoll entwickeln', 'Die Werte von Hand ablesen und eintippen'], 'Das Gerät spricht Modbus TCP. Dann nimmt man das, was da ist, und rechnet die Register im Gateway um.', ['Was spricht das Gerät schon?', 'Nimm das Vorhandene.']],
    ['Anlagen mehrerer Hersteller sollen mit Namen, Einheiten und Struktur in ein Leitsystem. Was passt?', 'OPC UA, weil es Namen, Typen und Einheiten mitliefert', ['Modbus TCP, weil es ein Informationsmodell hat', 'MQTT, weil es Datentypen vorschreibt', 'Keines von beiden, das geht nur mit Papier'], 'OPC UA ist für herstellerübergreifende, selbstbeschreibende Daten gemacht.', ['Wer liefert Namen und Einheiten mit?', 'Herstellerübergreifend: offener Standard.']],
    ['Ein Gateway schickt die Messwerte von 300 Sensoren über das Internet an einen Server. Viele Abonnenten, die Verbindung schwankt. Was passt?', 'MQTT: schlank, ein Broker verteilt, kommt mit schwankenden Verbindungen zurecht', ['Modbus TCP von außen in jede Maschine', 'Für jeden Sensor eine eigene Standleitung', 'Telefonieren und Werte durchsagen'], 'MQTT entkoppelt Sender und Empfänger über einen Broker und braucht wenig Daten.', ['Viele Empfänger und Sender: wer vermittelt?', 'Ein Broker verteilt an alle.']]
  ];
  const WANN_STEPS = ['Lies, was die Geräte schon können und was gebraucht wird: einfache Zahlen, Namen und Einheiten oder viele Empfänger.', 'Ordne zu: einfache Register = Modbus TCP, Informationsmodell = OPC UA, viele Empfänger = MQTT.', 'Wähle die Lösung mit dem geringsten Aufwand, die das Ziel erreicht.'];

  /* ============================================================ IT-Sicherheit */
  const NETZE = [
    ['Warum trennt man das Netz der Büro-IT vom Netz der Maschinen (OT)?', 'Ein Problem oder ein Angriff in einem Netz erreicht das andere nicht so leicht', ['Damit die Leitungen kürzer werden', 'Damit man keine Firewall mehr braucht', 'Damit die Maschinen schneller drucken'], 'Getrennte Zonen begrenzen den Schaden: Gerät oder Schadsoftware aus dem Büro kommen nicht ungehindert zur Maschine.', ['Was passiert, wenn ein Netz befallen ist?', 'Trennung begrenzt den Schaden.']],
    ['Was ist eine DMZ in diesem Zusammenhang?', 'Eine Zone zwischen zwei Netzen, in der Übergabe-Server stehen, die beide Seiten nur eingeschränkt erreichen', ['Ein besonders schneller Switch', 'Ein Passwortspeicher in der Steuerung', 'Ein Raum mit Servern'], 'In der DMZ stehen Rechner für den Austausch. So gibt es keine direkte Verbindung zwischen Büro und Maschine.', ['DMZ heißt entmilitarisierte Zone, hier eine Pufferzone.', 'Die DMZ liegt zwischen den Netzen.']],
    ['Ein Gateway verbindet das Maschinennetz mit dem Firmennetz. Welche Regel ist sinnvoll?', 'Nur die nötigen Verbindungen und Ports erlauben, alles andere sperren', ['Alle Ports öffnen, damit nichts blockiert wird', 'Die Firewall ausschalten, solange gewartet wird', 'Die Maschinen direkt ins Internet stellen'], 'Wer nur das Nötige erlaubt, bietet Angreifern weniger Angriffsfläche.', ['Was wird gebraucht, was nicht?', 'Alles andere wird gesperrt.']],
    ['Warum sollte eine Maschinensteuerung nicht direkt aus dem Internet erreichbar sein?', 'Jeder könnte versuchen, sich anzumelden oder bekannte Schwachstellen auszunutzen', ['Das Internet ist zu langsam für Steuerungen', 'Steuerungen verstehen keine IP-Adressen', 'Die Maschine braucht dadurch mehr Strom'], 'Was aus dem Internet erreichbar ist, wird gescannt und angegriffen. Steuerungen gehören hinter Firewall und Zugangsschutz.', ['Wer kann alles darauf zugreifen?', 'Jeder, der die Adresse findet.']]
  ];
  const NETZE_STEPS = ['Überlege, was passiert, wenn ein Gerät befallen wird.', 'Streiche Antworten, die nichts mit Schutz oder Zonen zu tun haben.', 'Wähle die Antwort, die den Schaden begrenzt.'];
  const PASSW = [
    ['Ein neues Gerät hat ein Standardpasswort aus der Anleitung. Was gehört zur Inbetriebnahme?', 'Das Standardpasswort ändern und das neue Passwort sicher aufbewahren', ['Es lassen, damit der Service es kennt', 'Es auf einen Zettel am Gerät kleben', 'Das Gerät ohne Passwort betreiben'], 'Standardpasswörter stehen in den Anleitungen und sind jedem bekannt. Standardpasswörter müssen sofort geändert werden.', ['Wer kennt das Standardpasswort?', 'Es steht in der Anleitung.']],
    ['Warum sind Standardpasswörter gefährlich?', 'Standardpasswörter stehen in öffentlichen Anleitungen und werden von Angreifern zuerst probiert', ['Standardpasswörter sind immer zu kurz', 'Standardpasswörter können nur einmal benutzt werden', 'Standardpasswörter verbrauchen Speicher im Gerät'], 'Angreifer suchen automatisch nach Geräten und probieren zuerst die bekannten Standardwerte.', ['Wer liest die Anleitungen noch?', 'Angreifer probieren zuerst die Standardwerte.']],
    ['Welches Passwort ist für ein Gateway am besten?', 'Eine lange, einmalige Zeichenfolge, die für jedes Gerät anders ist', ['Der Name der Firma', 'Hallo123 für alle Geräte', 'Das Datum der Inbetriebnahme'], 'Lang und zufällig ist schwer zu erraten. Ein eigenes Passwort je Gerät verhindert, dass ein Fund alle öffnet.', ['Was lässt sich schwer erraten?', 'Jedes Gerät bekommt ein eigenes.']],
    ['Zehn Gateways teilen sich dasselbe Passwort. Was ist das Risiko?', 'Wird es bei einem bekannt, sind alle zehn offen', ['Die Geräte werden langsamer', 'Der Broker lehnt Nachrichten ab', 'Es gibt kein Risiko, wenn das Passwort lang genug ist'], 'Ein gemeinsames Passwort ist ein gemeinsamer Schwachpunkt. Es reicht, ein Gerät zu knacken.', ['Was passiert, wenn eines geknackt wird?', 'Dasselbe Passwort öffnet überall.']]
  ];
  const PASSW_STEPS = ['Überlege: Wer kennt dieses Passwort, und wie leicht lässt es sich erraten?', 'Streiche Antworten, die das Passwort gleich oder öffentlich lassen.', 'Wähle die Antwort mit einem eigenen, starken Passwort.'];
  const UPDATE = [
    ['Warum sollten Geräte im Anlagennetz Sicherheitsupdates bekommen?', 'Bekannte Sicherheitslücken werden geschlossen', ['Updates machen jedes Gerät schneller', 'Damit der Hersteller Einblick in die Anlage hat', 'Updates sind nur für neue Funktionen da'], 'Sicherheitslücken werden öffentlich bekannt. Wer nicht aktualisiert, bleibt angreifbar.', ['Was ist das Ziel eines Sicherheitsupdates?', 'Lücken schließen.']],
    ['Ein Update für ein Gateway ist verfügbar. Was ist der übliche Weg in der Anlage?', 'Erst testen, dann in einem Wartungsfenster einspielen und den Rückweg vorbereiten', ['Sofort während der Produktion einspielen', 'Nie einspielen, es läuft ja', 'Ungeprüft aus einer beliebigen Quelle laden'], 'In der Anlage soll nichts unerwartet stehen bleiben. Deshalb wird geprüft, geplant und der Rückweg bereitgehalten.', ['Darf die Produktion stehen bleiben?', 'Plane erst, dann spiele ein.']],
    ['Ein altes Gerät bekommt keine Sicherheitsupdates mehr. Was ist sinnvoll?', 'In ein abgetrenntes Netz setzen, den Zugriff stark begrenzen und Ersatz planen', ['Normal weiterbetreiben', 'Mit dem Internet verbinden, damit es sich selbst aktualisiert', 'Das Passwort entfernen'], 'Ohne Updates bleibt die Lücke offen. Dann schützt man das Gerät durch Abtrennung und plant den Austausch.', ['Die Lücke lässt sich nicht schließen.', 'Wie hält man Angreifer fern?']],
    ['Woher soll eine Firmware-Datei für ein Gerät stammen?', 'Vom Hersteller auf dem offiziellen Weg, mit Prüfung von Signatur oder Prüfsumme', ['Aus einem Forum, wenn sie neuer ist', 'Von einem Stick, der auf dem Parkplatz lag', 'Von der ersten Seite, die eine Suche anzeigt'], 'Firmware läuft mit höchsten Rechten. Eine verfälschte Datei würde das Gerät übernehmen.', ['Wem darf man die Datei glauben?', 'Prüfe Signatur oder Prüfsumme.']]
  ];
  const UPDATE_STEPS = ['Überlege: Was geschieht, wenn eine bekannte Lücke offen bleibt?', 'Streiche Antworten ohne Prüfung oder mit unbekannter Quelle.', 'Wähle die Antwort mit sicherer Quelle und geplantem Vorgehen.'];
  const VERSCHL = [
    ['Was unterscheidet MQTT auf Port 1883 von MQTT auf Port 8883?', 'Auf 8883 läuft die Verbindung mit TLS verschlüsselt, auf 1883 im Klartext', ['Auf 8883 ist MQTT langsamer, aber sonst gleich', 'Auf 1883 ist nur QoS 0 erlaubt', 'Auf 8883 darf nur ein Sensor senden'], 'Port 8883 ist der Standard für MQTT über TLS. Dort sind Inhalt und Zugangsdaten vor Mitlesen geschützt.', ['Was steht hinter 8883?', 'TLS verschlüsselt.']],
    ['Was kann ein Angreifer im Netz bei unverschlüsseltem MQTT tun?', 'Topics und Messwerte mitlesen und Nachrichten verfälschen', ['Nichts, MQTT ist immer sicher', 'Nur Netzwerkkabel abziehen', 'Nur die Uhrzeit im Gerät ändern'], 'Im Klartext kann jeder im selben Netz mitlesen, und ohne Schutz lassen sich Nachrichten ändern oder neu einspielen.', ['Wer im Netz zuhört, was sieht er?', 'Klartext kann jeder lesen.']],
    ['Wofür sind Zertifikate bei TLS gut?', 'Die Gegenstelle ist echt: Man erkennt, mit wem man verbunden ist', ['Zertifikate beschleunigen die Übertragung', 'Zertifikate ersetzen die Firewall', 'Zertifikate zählen die Nachrichten'], 'Ein Zertifikat beweist die Identität der Gegenstelle. So kann sich kein Fremder als Broker ausgeben.', ['Wer ist am anderen Ende?', 'Ein Zertifikat ist ein Echtheitsnachweis.']],
    ['Eine Maschine liefert Werte per Modbus TCP, der Weg führt durch ein Netz, dem man nicht traut. Was ist sinnvoll?', 'Den Datenweg über ein Gateway oder einen VPN-Tunnel absichern, weil Modbus TCP selbst nicht verschlüsselt', ['Den Port 502 auf einen anderen Wert ändern genügt', 'Nichts, Modbus ist immer sicher', 'Auf Port 1883 senden'], 'Ein anderer Port ändert nichts am Klartext. Echten Schutz gibt es nur durch Verschlüsselung auf dem Weg.', ['Hilft ein anderer Port gegen Mitlesen?', 'Verschlüsselung muss auf den Weg.']]
  ];
  const VERSCHL_STEPS = ['Merke: Klartext kann im Netz jeder mitlesen, TLS schützt.', 'Prüfe, ob die Antwort wirklich verschlüsselt oder nur etwas umbenennt.', 'Wähle die Antwort mit echter Verschlüsselung.'];
  const FERN = [
    ['Ein Servicetechniker soll von außen auf eine Anlage zugreifen. Welcher Weg ist üblich?', 'Über einen VPN-Zugang mit persönlichem Konto, Zeitbegrenzung und Protokoll', ['Über einen Port, der dauerhaft im Internet offen steht', 'Über ein gemeinsames Administrator-Passwort', 'Über ein Fernwartungsprogramm, das jeder ohne Anmeldung nutzen kann'], 'Ein VPN schafft einen geschützten Tunnel. Persönliches Konto, Zeitlimit und Protokoll machen den Zugriff nachvollziehbar.', ['Wie schützt man einen Zugang von außen?', 'Wer, wann, wie lange muss feststehen.']],
    ['Was gehört in das Protokoll einer Fernwartung?', 'Wer, wann, auf welches Gerät zugegriffen und was geändert hat', ['Nur die Uhrzeit', 'Nur der Gerätename', 'Nichts, Protokolle brauchen nur Platz'], 'Das Protokoll muss nachweisen, wer was getan hat. Nur so lassen sich Fehler und Missbrauch aufklären.', ['Wozu braucht man ein Protokoll?', 'Es beantwortet: Wer hat was wann getan?']],
    ['Wann sollte ein Fernwartungszugang aktiv sein?', 'Nur während der vereinbarten Wartung und danach wieder gesperrt', ['Immer, damit der Service schnell reagieren kann', 'Nur nachts, ohne Absprache', 'Dauerhaft für alle Mitarbeiter'], 'Ein offener Zugang ist ein Risiko. Deshalb wird er nur für die Wartung geöffnet und danach geschlossen.', ['Wie lange ist ein Zugang offen?', 'So kurz wie nötig.']],
    ['Warum bekommt jeder Servicetechniker ein eigenes Konto für die Fernwartung?', 'Damit nachvollziehbar ist, wer was getan hat, und einzelne Zugänge gesperrt werden können', ['Damit die Lizenz billiger wird', 'Damit Passwörter kürzer sein dürfen', 'Damit niemand sich merken muss, wie man sich anmeldet'], 'Mit eigenen Konten lässt sich jede Handlung einer Person zuordnen. Verlässt jemand die Firma, wird nur sein Zugang gesperrt.', ['Was geschieht bei einem gemeinsamen Konto?', 'Dann weiß man nicht, wer es war.']]
  ];
  const FERN_STEPS = ['Überlege: Wie wird der Zugang geschützt, begrenzt und nachvollziehbar gemacht?', 'Streiche Antworten mit dauerhaft offenen oder gemeinsamen Zugängen.', 'Wähle die Antwort, die persönlich, befristet und protokolliert ist.'];
  const DATSCH = [
    ['Der Messwert „Pressdruck, Gerät 7“ ist ein reiner Maschinenwert. Wann kann er trotzdem einen Personenbezug bekommen?', 'Wenn er mit der Kennung der Person verknüpft wird, die die Maschine bedient hat', ['Nie, Maschinenwerte sind nie personenbezogen', 'Wenn er größer als 100 ist', 'Wenn er in der Cloud gespeichert wird'], 'Ein Messwert allein sagt nichts über eine Person. Erst die Verknüpfung mit der Bedienerkennung macht ihn zum personenbezogenen Datum.', ['Wann lässt sich ein Wert einer Person zuordnen?', 'Wenn eine Kennung dabeisteht.']],
    ['Was bedeutet Datenminimierung bei Maschinendaten?', 'Nur die Daten erfassen und speichern, die für den Zweck wirklich nötig sind', ['Alle Daten erfassen, man weiß nie, wofür man sie braucht', 'Daten nach Belieben veröffentlichen', 'Alle Daten in kleinere Dateien packen'], 'Datenminimierung heißt: so wenig Daten wie nötig. Was nicht gebraucht wird, wird nicht erfasst.', ['Minimieren heißt verkleinern.', 'Wozu braucht man die Daten?']],
    ['Was bedeutet Zweckbindung bei Maschinendaten?', 'Die Daten dürfen nur für den vorher festgelegten Zweck genutzt werden, zum Beispiel Wartung statt Leistungskontrolle einzelner Personen', ['Die Daten dürfen für jeden beliebigen Zweck genutzt werden', 'Die Daten werden an den Zweck des Herstellers verkauft', 'Der Zweck steht in einer geheimen Datei'], 'Wofür die Daten erhoben werden, steht vorher fest. Für andere Zwecke ist eine neue Grundlage nötig.', ['Wofür wurden die Daten erhoben?', 'Der Zweck steht vorher fest.']],
    ['Die Betriebsleitung will die Zeit je Handgriff einer Bedienperson auswerten. Welcher Gedanke ist richtig?', 'Hier können personenbezogene Daten entstehen: Zweck prüfen und Datenschutz sowie Betriebsrat einbinden', ['Das ist wie jeder andere Maschinenwert', 'Datenschutz gilt nur für Kundendaten', 'Es genügt, die Daten nur im Ausland zu speichern'], 'Leistungsdaten einzelner Personen sind sensibel. Zweck, Notwendigkeit und Mitbestimmung müssen vorher geklärt sein.', ['Wessen Verhalten wird gemessen?', 'Dann gelten Regeln für den Schutz von Personen.']]
  ];
  const DATSCH_STEPS = ['Frage: Lässt sich der Wert einer Person zuordnen?', 'Wenn ja, gelten Zweckbindung und Datenminimierung.', 'Wähle die Antwort, die Personen schützt und den Zweck prüft.'];
  const ANGRIFF = [
    ['Ein Angreifer probiert Standardpasswörter an einem Gateway aus. Was hilft am besten?', 'Eigene starke Passwörter je Gerät und Sperre nach mehreren Fehlversuchen', ['Das Gateway öfter neu starten', 'Die Netzwerkkabel kürzen', 'Die Abtastrate senken'], 'Gegen Raten helfen Passwörter, die niemand erraten kann, und eine Sperre nach Fehlversuchen.', ['Was hält Raten ab?', 'Ein starkes Passwort, eine Sperre.']],
    ['Ein Mitarbeiter schließt einen befallenen Laptop ans Firmennetz an. Das Maschinennetz soll trotzdem sicher bleiben. Was hilft?', 'Die Trennung von IT und OT mit Firewall und eingeschränkten Übergängen', ['Ein längeres Netzwerkkabel', 'Eine andere Farbe der Kabel', 'Mehr Sensoren'], 'Getrennte Zonen halten die Schadsoftware auf. Nur die nötigen Übergänge sind offen.', ['Wie hält man einen Befall auf?', 'Mit Zonen und Firewall.']],
    ['Jemand liest im Hallennetz mit und sieht alle Messwerte im Klartext. Was verhindert das?', 'TLS (zum Beispiel MQTT auf Port 8883) und sichere Zugangsdaten', ['Eine höhere Abtastrate', 'Ein kürzerer Topic-Name', 'QoS 2'], 'Mitlesen verhindert nur Verschlüsselung. Abtastrate, Topic-Name und QoS ändern daran nichts.', ['Was schützt vor Mitlesen?', 'Verschlüsselung.']],
    ['Eine Sicherheitslücke in der Gateway-Software wird bekannt. Was ist die richtige Reaktion?', 'Das Update des Herstellers prüfen und zeitnah einspielen, bis dahin den Zugriff einschränken', ['Abwarten, bis ein Angriff passiert', 'Das Gateway ausbauen und nie wieder etwas vernetzen', 'Das Passwort jede Stunde ändern'], 'Eine bekannte Lücke wird schnell ausgenutzt. Man schließt sie durch das Update und sichert bis dahin den Zugang ab.', ['Wie schließt man eine bekannte Lücke?', 'Update und Zugriff begrenzen.']]
  ];
  const ANGRIFF_STEPS = ['Beschreibe in einem Satz, was der Angreifer ausnutzt: Passwort, Netz, Klartext oder Lücke.', 'Ordne die passende Gegenmaßnahme zu: Passwort, Zonen, TLS oder Update.', 'Wähle die Maßnahme, die genau diese Schwachstelle schließt.'];

  /* ============================================================ Rechenaufgaben */
  const TS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60];
  const A = {
    skal(R) {
      const k = C().pick(R, [0, 1]), r = k ? C().ri(R, 150, 900) : C().ri(R, 200, 950), v = k ? r / 100 : r / 10;
      return numQ(k ? 'Ein Schwingungssensor legt die Schwinggeschwindigkeit als ganze Zahl in einem Modbus-Register ab, in Hundertstel mm/s. Das Register enthält ' + f(r, 0) + '. Wie groß ist die Schwinggeschwindigkeit?'
        : 'Ein Messmodul legt die Temperatur als ganze Zahl in einem Modbus-Register ab, in Zehntelgrad. Das Register enthält ' + f(r, 0) + '. Wie groß ist die Temperatur?', v, k ? 'mm/s' : '°C', k ? 'Schwinggeschwindigkeit' : 'Temperatur', 0.01,
        k ? 'Hundertstel heißt durch 100: ' + f(r, 0) + ' / 100 = ' + f(v, 2) + ' mm/s.' : 'Zehntel heißt durch 10: ' + f(r, 0) + ' / 10 = ' + f(v, 1) + ' °C.',
        ['Ein Register enthält nur eine ganze Zahl, das Komma muss man selbst setzen.', k ? 'Hundertstel heißt: durch 100 teilen.' : 'Zehntel heißt: durch 10 teilen.'],
        ['Lies den Registerwert und die Einheit des Registers (Zehntel oder Hundertstel).', 'Teile durch 10 oder 100.', 'Gib das Ergebnis mit der Einheit an.']);
    },
    ma420(R) {
      const rg = C().pick(R, [80, 100, 150, 200]), I = C().pick(R, [6, 8, 10, 12, 14, 16, 18]), v = (I - 4) / 16 * rg;
      return numQ('Ein Temperaturfühler mit Messumformer liefert 4 mA bei 0 °C und 20 mA bei ' + f(rg, 0) + ' °C, dazwischen linear. Der Strom beträgt ' + f(I, 0) + ' mA. Welche Temperatur wird gemessen?', v, '°C', 'Temperatur', tol(v),
        'Der Strombereich ist 20 mA − 4 mA = 16 mA. Anteil: (' + f(I, 0) + ' − 4) / 16 = ' + f((I - 4) / 16, 4) + '. Temperatur = ' + f((I - 4) / 16, 4) + ' · ' + f(rg, 0) + ' °C = ' + f(v, 2) + ' °C.',
        ['Ziehe erst die 4 mA des Nullpunkts ab, dann teile durch 16 mA.', 'Der Anteil mal der Messbereich ergibt die Temperatur.'],
        ['Strom minus 4 mA ergibt den Anteil über dem Nullpunkt.', 'Teile durch den Hub 16 mA (20 mA minus 4 mA).', 'Multipliziere mit dem Messbereich.']);
    },
    adc(R) {
      const n = C().pick(R, [8, 10, 12]), u = C().pick(R, [3.3, 5, 10]), v = u * 1000 / Math.pow(2, n);
      return numQ('Ein Analog-Digital-Wandler mit ' + n + ' Bit misst eine Spannung von 0 V bis ' + f(u, 1) + ' V. Wie groß ist eine Stufe (kleinste unterscheidbare Spannungsänderung)?', v, 'mV', 'Stufe', tol(v),
        'Der Wandler kennt 2^' + n + ' = ' + f(Math.pow(2, n), 0) + ' Stufen. Stufe = ' + f(u * 1000, 0) + ' mV / ' + f(Math.pow(2, n), 0) + ' = ' + f(v, 2) + ' mV.',
        ['Mit n Bit gibt es 2^n Werte.', 'Teile den Messbereich durch die Zahl der Werte, in mV.'],
        ['Rechne die Spannung in mV um.', 'Berechne die Zahl der Stufen 2^n.', 'Teile den Messbereich durch die Zahl der Stufen.']);
    },
    latenz(R) {
      const k = C().pick(R, [1, 2, 5, 10]), x = C().pick(R, [20, 40, 80, 120]), y = C().pick(R, [10, 30, 60, 100]), v = k * 1000 + x + y;
      return numQ('Ein Gateway sammelt Messwerte und schickt alle ' + f(k, 0) + ' s einen Block. Die Übertragung dauert ' + f(x, 0) + ' ms, die Auswertung in der Cloud ' + f(y, 0) + ' ms. Wie alt ist der älteste Wert höchstens, wenn er im Dashboard erscheint?', v, 'ms', 'Alter', 0,
        'Der älteste Wert wartet im ungünstigsten Fall die ganze Blockzeit: ' + f(k, 0) + ' s = ' + f(k * 1000, 0) + ' ms. Dazu kommen ' + f(x, 0) + ' ms Netz und ' + f(y, 0) + ' ms Auswertung: ' + f(v, 0) + ' ms.',
        ['Der ungünstigste Fall: Der Wert entsteht gleich nach dem letzten Senden.', 'Addiere Wartezeit, Übertragung und Auswertung in ms.'],
        ['Bestimme die Wartezeit im Gateway in ms (Blockzeit).', 'Addiere die Übertragungszeit.', 'Addiere die Auswertungszeit.']);
    },
    wer(R) {
      const h = C().ri(R, 1, 2), l = C().ri(R, 1, 3), m = C().pick(R, ['temperatur', 'druck', 'feuchte']), o = m === 'druck' ? 'temperatur' : 'druck', ho = 3 - h;
      const topic = 'halle' + h + '/linie' + l + '/' + m, all = ['halle' + h + '/linie' + l + '/' + m, 'halle' + h + '/+/' + m, 'halle' + h + '/#', '#', '+/linie' + l + '/' + m, 'halle' + h + '/linie' + l + '/+',
        'halle' + ho + '/#', 'halle' + h + '/linie' + l + '/' + o, 'halle' + h + '/+/' + o, '+/+', 'halle' + h + '/linie' + l];
      let fl, n; do { fl = C().shuffle(R, all).slice(0, 5); n = fl.filter(x => C().match(x, topic)).length; } while (n < 1 || n > 4);
      return numQ('Der Broker bekommt die Nachricht „' + topic + '“. Fünf Abonnenten haben diese Filter eingetragen: ' + fl.map(x => '„' + x + '“').join(', ') + '. Wie viele davon bekommen die Nachricht?', n, 'Abonnenten', 'Abonnenten', 0,
        'Das Topic hat drei Ebenen. Prüfe jeden Filter Ebene für Ebene (+ = eine Ebene, # = alles darunter): ' + fl.map(x => x + ' ' + (C().match(x, topic) ? 'passt' : 'passt nicht')).join('; ') + '. Das sind ' + n + '.',
        ['Zähle zuerst die Ebenen des Topics und prüfe dann jeden Filter getrennt.', 'Ein Filter mit zwei Ebenen passt nicht auf ein Topic mit drei Ebenen (außer er endet mit #).'],
        ['Schreibe die drei Ebenen des Topics auf.', 'Vergleiche jeden Filter Ebene für Ebene (+ passt auf eine Ebene, # auf den Rest).', 'Zähle, wie viele Filter ganz passen.']);
    },
    nicht(R) {
      const h = C().ri(R, 1, 2), l = C().ri(R, 1, 3), m = C().pick(R, ['temperatur', 'druck', 'feuchte']), o = m === 'druck' ? 'temperatur' : 'druck', ho = 3 - h;
      const topic = 'halle' + h + '/linie' + l + '/' + m;
      const yes = ['halle' + h + '/+/' + m, 'halle' + h + '/#', '+/linie' + l + '/' + m, 'halle' + h + '/linie' + l + '/+', '#'], no = [['halle' + ho + '/#', 'Die erste Ebene ist halle' + ho + ' statt halle' + h + '.'], ['halle' + h + '/+/' + o, 'Die letzte Ebene ist ' + o + ' statt ' + m + '.'], ['+/+', 'Zwei Ebenen passen nicht auf ein Topic mit drei Ebenen.'], ['halle' + h + '/linie' + l, 'Der Filter hat nur zwei Ebenen, das Topic drei.']];
      const nn = C().pick(R, no), w = C().shuffle(R, yes).slice(0, 3);
      return choiceQ(R, 'Der Broker bekommt die Nachricht „' + topic + '“. Welcher dieser Filter passt NICHT dazu?', nn[0], w, nn[1] + ' Die anderen Filter passen: ' + w.join(', ') + '.',
        ['Prüfe jeden Filter Ebene für Ebene gegen das Topic.', 'Gesucht ist der eine Filter, der an einer Ebene scheitert.'], ['Schreibe die drei Ebenen des Topics auf.', 'Prüfe jeden Filter: Stimmen die Ebenen, oder steht dort + oder #?', 'Wähle den Filter, der an einer Ebene scheitert oder zu kurz ist.']);
    },
    registerz(R) {
      const n = C().ri(R, 3, 24);
      return numQ('Ein Messmodul liefert ' + n + ' Werte zu je 32 Bit. Bei Modbus ist ein Register 16 Bit groß. Wie viele Register müssen gelesen werden?', 2 * n, 'Register', 'Register', 0,
        'Ein 32-Bit-Wert belegt 2 Register zu je 16 Bit. ' + n + ' · 2 = ' + f(2 * n, 0) + ' Register.',
        ['Wie viele 16-Bit-Register passen in 32 Bit?', 'Mal die Zahl der Werte.'],
        ['Rechne: 32 Bit / 16 Bit = Register je Wert.', 'Multipliziere mit der Zahl der Werte.']);
    },
    leseabfr(R) {
      const n = C().ri(R, 60, 200), reg = 2 * n, v = Math.ceil(reg / 125);
      return numQ('Ein Gerät liefert ' + n + ' Werte zu je 32 Bit (je 2 Register). Ein Lesebefehl bei Modbus TCP kann höchstens 125 Register auf einmal holen. Wie viele Lesebefehle braucht man mindestens?', v, 'Abfragen', 'Lesebefehle', 0,
        'Register: ' + n + ' · 2 = ' + f(reg, 0) + '. Je Befehl höchstens 125: ' + f(reg, 0) + ' / 125 = ' + f(reg / 125, 2) + ', aufgerundet ' + v + ' Befehle.',
        ['Rechne erst die Zahl der Register aus, dann teile durch 125.', 'Es gibt keine halben Befehle: immer aufrunden.'],
        ['Rechne die Zahl der Register: Werte mal 2.', 'Teile durch 125 Register je Befehl.', 'Runde auf die nächste ganze Zahl auf.']);
    },
    werte(R) {
      const t = C().pick(R, TS), v = C().rd(86400 / t, 0);
      return numQ('Ein Sensor liefert alle ' + fT(t) + ' einen Messwert. Wie viele Werte sind das an einem Tag (24 Stunden)?', v, 'Werte', 'Werte je Tag', 0,
        'Ein Tag hat 86.400 s. Werte = 86.400 s / ' + f(t, 1) + ' s = ' + f(v, 0) + '.',
        ['Rechne den Tag in Sekunden: 24 · 60 · 60.', 'Teile durch das Intervall in Sekunden.'],
        ['Rechne einen Tag in Sekunden um: 86.400 s.', 'Rechne das Intervall in Sekunden (Millisekunden durch 1.000).', 'Teile die Sekunden je Tag durch das Intervall.']);
    },
    tagmb(R) {
      const t = C().pick(R, [0.1, 0.2, 0.5, 1]), b = C().pick(R, [2, 4, 8]), v = C().bytesPerDay(t, b, 1) / 1e6;
      return numQ('Ein Sensor liefert alle ' + fT(t) + ' einen Wert mit ' + b + ' Byte. Wie viele Daten entstehen an einem Tag? Rechne mit 1 MB = 1.000.000 Byte.', v, 'MB', 'Datenmenge je Tag', tol(v),
        'Werte je Tag: 86.400 s / ' + f(t, 1) + ' s = ' + f(86400 / t, 0) + '. Byte: ' + f(86400 / t, 0) + ' · ' + b + ' = ' + f(86400 / t * b, 0) + ' Byte = ' + f(v, 3) + ' MB.',
        ['Erst die Zahl der Werte je Tag, dann mal Byte je Wert.', 'Teile das Ergebnis durch 1.000.000, um MB zu bekommen.'],
        ['Werte je Tag ausrechnen (86.400 s durch das Intervall).', 'Mit den Byte je Wert malnehmen.', 'Durch 1.000.000 teilen, um MB zu erhalten.']);
    },
    viele(R) {
      const n = C().pick(R, [10, 20, 50, 100]), t = C().pick(R, [1, 2, 5, 10]), b = C().pick(R, [2, 4]), v = C().bytesPerDay(t, b, n) / 1e6;
      return numQ(f(n, 0) + ' Sensoren liefern je alle ' + f(t, 0) + ' s einen Wert mit ' + b + ' Byte. Wie viele Daten entstehen an einem Tag? Rechne mit 1 MB = 1.000.000 Byte.', v, 'MB', 'Datenmenge je Tag', tol(v),
        'Werte je Sensor und Tag: 86.400 / ' + f(t, 0) + ' = ' + f(86400 / t, 0) + '. Byte: ' + f(n, 0) + ' · ' + f(86400 / t, 0) + ' · ' + b + ' = ' + f(n * 86400 / t * b, 0) + ' Byte = ' + f(v, 2) + ' MB.',
        ['Rechne erst einen Sensor, dann mal die Zahl der Sensoren.', 'Teile am Ende durch 1.000.000 für MB.'],
        ['Werte je Sensor und Tag: 86.400 s durch das Intervall.', 'Mal Byte je Wert und mal Zahl der Sensoren.', 'In MB umrechnen (durch 1.000.000).']);
    },
    bandb(R) {
      const n = C().pick(R, [50, 100, 200, 500]), t = C().pick(R, [1, 2, 5]), b = C().pick(R, [4, 8]), v = C().bitRate(t, b, n) / 1000;
      return numQ(f(n, 0) + ' Sensoren liefern je alle ' + f(t, 0) + ' s einen Wert mit ' + b + ' Byte. Welche mittlere Datenrate entsteht (nur Nutzdaten, 1 Byte = 8 Bit)?', v, 'kbit/s', 'Datenrate', tol(v),
        'Byte je Sekunde: ' + f(n, 0) + ' · ' + b + ' / ' + f(t, 0) + ' = ' + f(n * b / t, 1) + ' Byte/s. Bit: mal 8 = ' + f(n * b / t * 8, 0) + ' bit/s = ' + f(v, 2) + ' kbit/s.',
        ['Erst Byte je Sekunde, dann mal 8 für Bit.', 'Teile durch 1.000 für kbit/s.'],
        ['Byte je Sekunde: Sensoren mal Byte durch Intervall.', 'Mal 8 ergibt bit/s.', 'Durch 1.000 teilen ergibt kbit/s.']);
    },
    anteil(R) {
      const b = C().pick(R, [2, 4, 8]), h = C().pick(R, [20, 30, 50, 60]), v = C().payloadShare(b, h);
      return numQ('Jede Nachricht eines Sensors enthält ' + b + ' Byte Messwert und zusätzlich ' + h + ' Byte für Topic und Protokollkopf. Wie viel Prozent der gesendeten Bytes sind Nutzdaten (der Messwert)?', v, '%', 'Anteil Nutzdaten', tol(v),
        'Gesamt: ' + b + ' + ' + h + ' = ' + (b + h) + ' Byte. Anteil: ' + b + ' / ' + (b + h) + ' = ' + f(v / 100, 4) + ' = ' + f(v, 2) + ' %.',
        ['Nutzdaten geteilt durch die ganze Nachricht.', 'Mal 100 für Prozent.'],
        ['Addiere Messwert und Kopf: ganze Nachricht in Byte.', 'Teile den Messwert durch die ganze Nachricht.', 'Mal 100 ergibt Prozent.']);
    },
    speicher(R) {
      const n = C().pick(R, [10, 20, 50, 100]), t = C().pick(R, [1, 2, 5]), b = C().pick(R, [4, 8]), cap = C().pick(R, [1, 2, 4, 8]), d = C().bytesPerDay(t, b, n), v = C().daysFit(cap * 1e9, d);
      return numQ(f(n, 0) + ' Sensoren liefern je alle ' + f(t, 0) + ' s einen Wert mit ' + b + ' Byte. Der Speicher fasst ' + f(cap, 0) + ' GB (1 GB = 1.000.000.000 Byte). Für wie viele volle Tage reicht er?', v, 'Tage', 'Volle Tage', 0,
        'Byte je Tag: ' + f(n, 0) + ' · 86.400 / ' + f(t, 0) + ' · ' + b + ' = ' + f(d, 0) + ' Byte. Tage: ' + f(cap * 1e9, 0) + ' / ' + f(d, 0) + ' = ' + f(cap * 1e9 / d, 2) + ', abgerundet ' + f(v, 0) + ' volle Tage.',
        ['Erst die Datenmenge je Tag ausrechnen, dann den Speicher teilen.', 'Nur volle Tage zählen: abrunden.'],
        ['Byte je Tag ausrechnen.', 'Speichergröße in Byte durch Byte je Tag teilen.', 'Auf volle Tage abrunden.']);
    },
    mittel(R) {
      const k = C().pick(R, [5, 10, 20, 60]), t = C().pick(R, [1, 2]), v = C().savedShare(k);
      return numQ('Ein Sensor liefert alle ' + f(t, 0) + ' s einen Wert. Das Gateway bildet aus je ' + f(k, 0) + ' Werten einen Mittelwert und sendet nur diesen. Um wie viel Prozent sinkt die Zahl der Nachrichten ins Netz?', v, '%', 'Einsparung', tol(v),
        'Statt ' + f(k, 0) + ' Nachrichten wird eine gesendet. Es bleiben 1 / ' + f(k, 0) + ' = ' + f(100 / k, 2) + ' %. Die Einsparung ist 100 % − ' + f(100 / k, 2) + ' % = ' + f(v, 2) + ' %.',
        ['Von k Nachrichten bleibt eine übrig.', 'Einsparung = 100 % minus verbleibender Anteil.'],
        ['Anteil, der übrig bleibt: 1 geteilt durch die Zahl der gemittelten Werte.', 'In Prozent umrechnen (mal 100).', 'Von 100 % abziehen.']);
    },
    gesamt(R) {
      const n = C().pick(R, [50, 100, 200]), t = C().pick(R, [1, 2, 5]), b = 4, h = C().pick(R, [20, 50]), av = C().pick(R, [10, 60]), c = C().chain({ t, n, b, h, av }), v = c.outBytesDay / 1e6;
      return numQ(f(n, 0) + ' Sensoren liefern je alle ' + f(t, 0) + ' s einen Wert mit ' + b + ' Byte. Das Gateway bildet aus je ' + f(av, 0) + ' Werten eines Sensors einen Mittelwert und sendet ihn mit ' + h + ' Byte Kopf in die Cloud. Wie viele Daten gehen je Tag in die Cloud? Rechne mit 1 MB = 1.000.000 Byte.', v, 'MB', 'Datenmenge je Tag', tol(v),
        'Mittelwerte je Sensor und Tag: 86.400 / (' + f(t, 0) + ' · ' + f(av, 0) + ') = ' + f(86400 / (t * av), 1) + '. Je Nachricht ' + b + ' + ' + h + ' = ' + (b + h) + ' Byte. Gesamt: ' + f(n, 0) + ' · ' + f(86400 / (t * av), 1) + ' · ' + (b + h) + ' = ' + f(c.outBytesDay, 0) + ' Byte = ' + f(v, 2) + ' MB.',
        ['Erst die Zahl der gesendeten Nachrichten je Tag, dann mal Byte je Nachricht (Wert plus Kopf).', 'Die Zahl der Sensoren nicht vergessen.'],
        ['Nachrichten je Sensor und Tag: 86.400 s durch (Intervall mal Zahl der gemittelten Werte).', 'Byte je Nachricht: Messwert plus Kopf.', 'Mal Zahl der Sensoren, dann durch 1.000.000 für MB.']);
    }
  };
  const G = Object.assign({}, A, {
    rev: pq(REV, REV_STEPS), cps: pq(CPS, CPS_STEPS), zwill: pq(ZWILL, ZWILL_STEPS), inst: pq(INST, INST_STEPS), edgec: pq(EDGEC, EDGEC_STEPS), ziele: pq(ZIELE, ZIELE_STEPS), edgec2: pq(EDGEC2, EDGEC2_STEPS),
    kette: pq(KETTE, KETTE_STEPS), stufen: pq(STUFEN, STUFEN_STEPS), vorver: pq(VORVER, VORVER_STEPS), fehler: pq(FEHLER, FEHLER_STEPS),
    rollen: pq(ROLLEN, ROLLEN_STEPS), topicq: pq(TOPICQ, TOPICQ_STEPS), platz: pq(PLATZ, PLATZ_STEPS), qosb: pq(QOSB, QOSB_STEPS), qosw: pq(QOSW, QOSW_STEPS), retain: pq(RETAIN, RETAIN_STEPS),
    ports: pq(PORTS, PORTS_STEPS), opcq: pq(OPCQ, OPCQ_STEPS), modq: pq(MODQ, MODQ_STEPS), wann: pq(WANN, WANN_STEPS),
    netze: pq(NETZE, NETZE_STEPS), passw: pq(PASSW, PASSW_STEPS), update: pq(UPDATE, UPDATE_STEPS), verschl: pq(VERSCHL, VERSCHL_STEPS), fern: pq(FERN, FERN_STEPS), datsch: pq(DATSCH, DATSCH_STEPS), angriff: pq(ANGRIFF, ANGRIFF_STEPS)
  });

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const [K1, K2, K3, K4, K5, K6] = CATS;
  const defs = [
    [K1, 1, 'Vier Stufen der Industrialisierung', 'rev', null], [K1, 1, 'Maschine und Software verbunden', 'cps', null], [K1, 2, 'Abbild einer Maschine', 'zwill', null], [K1, 2, 'Wann wird gewartet', 'inst', null],
    [K1, 2, 'Rand oder Rechenzentrum', 'edgec', null], [K1, 1, 'Wozu das Ganze', 'ziele', null], [K1, 3, 'Verarbeiten, wo es passt', 'edgec2', null],
    [K2, 1, 'Der Weg eines Messwerts', 'kette', null], [K2, 1, 'Aufgaben der Stufen', 'stufen', null], [K2, 2, 'Früh verdichten', 'vorver', null], [K2, 2, 'Wo ist der Fehler', 'fehler', null],
    [K2, 2, 'Strom wird Temperatur', 'ma420', null], [K2, 2, 'Spannung wird Zahl', 'adc', null], [K2, 3, 'Wie alt ist der Wert', 'latenz', null],
    [K3, 1, 'Wer macht was in MQTT', 'rollen', null], [K3, 1, 'Topic oder Filter gültig', 'topicq', null], [K3, 2, 'Platzhalter lesen', 'platz', null], [K3, 2, 'Wer bekommt die Nachricht', 'wer', null],
    [K3, 2, 'Welcher Filter fällt heraus', 'nicht', null], [K3, 2, 'Zustellgarantien', 'qosb', null], [K3, 3, 'Passende Zustellgarantie', 'qosw', null], [K3, 2, 'Letzten Wert merken', 'retain', null],
    [K4, 1, 'Ports zuordnen', 'ports', null], [K4, 1, 'Zahl aus dem Register', 'skal', null], [K4, 2, 'Daten mit Bedeutung', 'opcq', null], [K4, 2, 'Register und Abfragen', 'modq', null],
    [K4, 2, 'Register zählen', 'registerz', null], [K4, 3, 'Lesebefehle planen', 'leseabfr', null], [K4, 3, 'Welche Anbindung passt', 'wann', null],
    [K5, 1, 'Werte an einem Tag', 'werte', null], [K5, 1, 'Daten eines Sensors', 'tagmb', null], [K5, 2, 'Viele Sensoren', 'viele', null], [K5, 2, 'Datenrate im Netz', 'bandb', null],
    [K5, 2, 'Nutzdaten und Kopf', 'anteil', null], [K5, 2, 'Reicht der Speicher', 'speicher', null], [K5, 2, 'Mittelwert spart Nachrichten', 'mittel', null], [K5, 3, 'Von den Sensoren in die Cloud', 'gesamt', null],
    [K6, 1, 'Netze trennen', 'netze', null], [K6, 1, 'Standardpasswörter', 'passw', null], [K6, 2, 'Updates einspielen', 'update', null], [K6, 2, 'Verschlüsselung', 'verschl', null],
    [K6, 2, 'Fernwartung', 'fern', null], [K6, 3, 'Maschinendaten und Personen', 'datsch', null], [K6, 3, 'Angriff und Gegenmaßnahme', 'angriff', null]
  ];
  const tasks = defs.map((d, i) => ({ id: 'iot' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));
  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('iot-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.IOT_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { REV, CPS, ZWILL, INST, EDGEC, ZIELE, EDGEC2, KETTE, STUFEN, VORVER, FEHLER, ROLLEN, TOPICQ, PLATZ, QOSB, QOSW, RETAIN, PORTS, OPCQ, MODQ, WANN, NETZE, PASSW, UPDATE, VERSCHL, FERN, DATSCH, ANGRIFF } };
  root.IOT_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.IOT_DATA, TASKS: root.IOT_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
