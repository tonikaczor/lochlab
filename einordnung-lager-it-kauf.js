/* Einordnung "Warum brauche ich das?" für Lagerlogistik, Fachinformatiker und Industriekaufleute. Von Hand gepflegt; Format: Einordnung.register({lab, betrieb, pruefung?}) */
'use strict';
(function (root) {
  var queue = root.__einQueue = root.__einQueue || [];
  var E = [
    { lab: 'lag', betrieb: 'Im Lager entscheidest du ständig: Wann bestellen wir nach, wie viel, und welche Artikel brauchen die meiste Aufmerksamkeit? Kennzahlen, Meldebestand und ABC-Analyse liefern dafür die Zahlen.' },
    { lab: 'lad', betrieb: 'Vor jeder Abfahrt muss die Ladung so stehen und gesichert sein, dass nichts rutscht oder kippt. Das gilt auch für Gefahrgut: Bei Gefahrgut zeigen dir die Kennzeichen, was zusammen geladen werden darf und worauf du achten musst.' },
    { lab: 'wfl', betrieb: 'Jede Lieferung beginnt am Wareneingang: Lieferschein gegen Zählung prüfen, Mängel melden, einlagern, später kommissionieren. Einen Stapler darfst du nur mit Ausbildung und schriftlicher Beauftragung fahren. Das Traglastdiagramm zeigt dir, wie viel er bei welchem Lastschwerpunkt heben darf.' },
    { lab: 'buc', betrieb: 'Jeder Beleg im Büro wird irgendwann zu einem Buchungssatz. Wer versteht, wie Geschäftsfälle auf Konten landen, erkennt Fehler früh und kann Zahlen im Abschluss nachvollziehen.' },
    { lab: 'kal', betrieb: 'Bevor ein Angebot rausgeht, muss klar sein, was ein Artikel wirklich kostet und welchen Preis du mindestens verlangen musst. Die Kalkulation zeigt, ab wann sich ein Auftrag lohnt.' },
    { lab: 'rec', betrieb: 'Hinter jeder Bestellung steckt ein Kaufvertrag mit Fristen und Zahlungsbedingungen. Wenn Ware fehlerhaft ankommt oder zu spät kommt, musst du wissen, was gilt und welcher Beleg dazugehört.' },
    { lab: 'net', betrieb: 'Im Netzwerk bekommt jedes Gerät eine Adresse, und jedes Teilnetz braucht den passenden Adressbereich. Bei Einrichtung und Fehlersuche rechnest du genau damit: Subnetze planen und Protokolle einordnen.' },
    { lab: 'its', betrieb: 'Ob Passwortregeln, Verschlüsselung, Firewall-Freigaben oder Backups: Im Betrieb schützt du damit Daten und Systeme. Hier übst du, Risiken zu erkennen und Schutzmaßnahmen sinnvoll auszuwählen.' },
    { lab: 'sql', betrieb: 'Kundendaten, Aufträge und Lagerbestände liegen in Datenbanken. Mit SQL holst du genau die Daten heraus, die jemand braucht, und mit sauberem Tabellenaufbau vermeidest du doppelte und widersprüchliche Einträge.' },
    { lab: 'lin', betrieb: 'Server laufen oft unter Linux, meist ohne Oberfläche. Dort legst du Dateirechte fest und liest Logdateien, um Fehler zu finden. Das Terminal ist dann dein wichtigstes Werkzeug.' },
    { lab: 'hwl', betrieb: 'Bei Beschaffung, Aufbau und Reparatur von PCs prüfst du, ob Bauteile zusammenpassen, ob das Netzteil reicht und wie Daten per RAID abgesichert sind. Bei Störungen grenzt du den Fehler Schritt für Schritt ein.' }
  ];
  for (var i = 0; i < E.length; i++) {
    if (root.Einordnung && root.Einordnung.register) root.Einordnung.register(E[i]);
    else queue.push(E[i]);
  }
})(typeof window !== 'undefined' ? window : this);
