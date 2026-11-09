'use strict';
/* Tonfunk Berichtsheft-Helfer: Daten (Aufgaben-Generatoren, Beispiele, Tätigkeitsbausteine je Beruf).
   Alle Texte sind frei erfunden: keine realen Namen, keine Noten, keine Berichtsheft-Inhalte echter Azubis.
   window.BHF_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, T, ARTQ }
   window.BHF_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'bhf', Status in localStorage 'lm4.bhf.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Texte bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder die Lösung noch die Art des Fehlers (Titel bleiben neutral). */
(function (root) {
  const C = () => root.BHF_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Sätze bewerten', 'Sätze verbessern', 'Tätigkeit und Lernertrag', 'Ausbildungsnachweis', 'Wochenbericht'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }

  /* ---------- Tätigkeitsbausteine je Beruf ----------
     nom = Nominalstil, pret = Präteritum ohne Subjekt ("Ich " + pret), perf = Perfekt ohne "habe" ("Ich habe " + perf), fach = Fachbegriff (Substantiv, steht in nom und perf),
     lern = ein sachlicher Lernsatz (ohne Wertung, ohne Zeitform) */
  /* PRUEFEN P8: Die Tätigkeiten, Fachbegriffe und Lernsätze (6 Berufe mal 8 Bausteine) sind frei erfundene, typische Beispiele. Fachlich richtig und passend zum 1.-3. Lehrjahr? Welche Tätigkeiten fehlen in eurem Ausbildungsplan? */
  const T = {
    egs: [
      { nom: 'Löten von Widerständen und Kondensatoren auf eine Lochrasterplatine', pret: 'lötete Widerstände und Kondensatoren auf eine Lochrasterplatine', perf: 'Widerstände und Kondensatoren auf eine Lochrasterplatine gelötet', fach: 'Lochrasterplatine', lern: 'Eine Lötstelle muss glänzen und den Anschluss vollständig umschließen, sonst entsteht eine unsichere Verbindung.' },
      { nom: 'Messen der Ausgangsspannung am Netzteil mit dem Multimeter', pret: 'maß die Ausgangsspannung am Netzteil mit dem Multimeter', perf: 'die Ausgangsspannung am Netzteil mit dem Multimeter gemessen', fach: 'Multimeter', lern: 'Das Multimeter muss für Spannungsmessungen parallel zum Bauteil angeschlossen werden.' },
      { nom: 'Zeichnen des Schaltplans einer Taschenlampenschaltung', pret: 'zeichnete den Schaltplan einer Taschenlampenschaltung', perf: 'den Schaltplan einer Taschenlampenschaltung gezeichnet', fach: 'Schaltplan', lern: 'Im Schaltplan steht jedes Symbol für ein Bauteil, die Linien zeigen die Leitungen dazwischen.' },
      { nom: 'Bestücken einer Leiterplatte mit SMD-Bauteilen', pret: 'bestückte eine Leiterplatte mit SMD-Bauteilen', perf: 'eine Leiterplatte mit SMD-Bauteilen bestückt', fach: 'Leiterplatte', lern: 'Leiterplatten bestückt man von der niedrigsten Bauteilhöhe zur höchsten, damit nichts im Weg steht.' },
      { nom: 'Prüfen eines Kabelbaums auf Durchgang', pret: 'prüfte einen Kabelbaum auf Durchgang', perf: 'einen Kabelbaum auf Durchgang geprüft', fach: 'Kabelbaum', lern: 'Mit einem Durchgangsprüfer lässt sich eine Leitung auf Unterbrechung prüfen, ohne dass Spannung anliegt.' },
      { nom: 'Anschließen eines Relais an die Steuerung', pret: 'schloss ein Relais an die Steuerung an', perf: 'ein Relais an die Steuerung angeschlossen', fach: 'Relais', lern: 'Ein Relais schaltet einen großen Laststrom mit einem kleinen Steuerstrom und trennt beide Stromkreise galvanisch.' },
      { nom: 'Einstellen der Zeitbasis am Oszilloskop', pret: 'stellte die Zeitbasis am Oszilloskop ein', perf: 'die Zeitbasis am Oszilloskop eingestellt', fach: 'Oszilloskop', lern: 'Die Zeitbasis bestimmt, wie viel Zeit ein Kästchen auf dem Bildschirm darstellt.' },
      { nom: 'Programmieren eines Arduino zur LED-Ansteuerung', pret: 'programmierte einen Arduino zur LED-Ansteuerung', perf: 'einen Arduino zur LED-Ansteuerung programmiert', fach: 'Arduino', lern: 'Ein Arduino-Programm besteht aus setup für die Einstellungen und loop für den Dauerbetrieb.' }
    ],
    ige: [
      { nom: 'Verdrahten eines Schaltschranks nach Stromlaufplan', pret: 'verdrahtete einen Schaltschrank nach Stromlaufplan', perf: 'einen Schaltschrank nach Stromlaufplan verdrahtet', fach: 'Schaltschrank', lern: 'Im Schaltschrank bekommt jede Leitung ein Beschriftungsschild, damit sie sich beim Prüfen und bei Reparaturen schnell finden lässt.' },
      { nom: 'Einbauen eines Leitungsschutzschalters auf der Hutschiene', pret: 'baute einen Leitungsschutzschalter auf der Hutschiene ein', perf: 'einen Leitungsschutzschalter auf der Hutschiene eingebaut', fach: 'Leitungsschutzschalter', lern: 'Der Nennstrom des Leitungsschutzschalters muss zum Querschnitt der Leitung passen, damit die Leitung nicht überlastet wird.' },
      { nom: 'Anschließen einer Steckdose an der Übungswand', pret: 'schloss eine Steckdose an der Übungswand an', perf: 'eine Steckdose an der Übungswand angeschlossen', fach: 'Steckdose', lern: 'Der grün-gelbe Schutzleiter hat an der Steckdose seinen festen Platz am Schutzkontakt.' },
      { nom: 'Aufbauen einer Wechselschaltung auf dem Übungsbrett', pret: 'baute eine Wechselschaltung auf dem Übungsbrett auf', perf: 'eine Wechselschaltung auf dem Übungsbrett aufgebaut', fach: 'Wechselschaltung', lern: 'Mit einer Wechselschaltung lässt sich eine Lampe von zwei Stellen aus ein- und ausschalten.' },
      { nom: 'Messen des Isolationswiderstands an einer Leitung', pret: 'maß den Isolationswiderstand an einer Leitung', perf: 'den Isolationswiderstand an einer Leitung gemessen', fach: 'Isolationswiderstand', lern: 'Der Isolationswiderstand wird nur an spannungsfreien Leitungen gemessen, sonst kann das Messgerät beschädigt werden.' },
      { nom: 'Programmieren einer Selbsthaltung an einer Kleinsteuerung', pret: 'programmierte eine Selbsthaltung an einer Kleinsteuerung', perf: 'eine Selbsthaltung an einer Kleinsteuerung programmiert', fach: 'Selbsthaltung', lern: 'Eine Selbsthaltung hält ein Schütz nach dem Tastendruck eingeschaltet, bis ein Öffner den Stromkreis wieder unterbricht.' },
      { nom: 'Anschließen eines Schützes an die Steuerspannung', pret: 'schloss ein Schütz an die Steuerspannung an', perf: 'ein Schütz an die Steuerspannung angeschlossen', fach: 'Schütz', lern: 'Ein Schütz schaltet mit einem kleinen Steuerstrom die Hauptkontakte für den großen Laststrom, Steuer- und Lastkreis haben keine Verbindung.' },
      { nom: 'Crimpen von Aderendhülsen an flexiblen Leitungen', pret: 'crimpte Aderendhülsen an flexible Leitungen', perf: 'Aderendhülsen an flexible Leitungen gecrimpt', fach: 'Aderendhülsen', lern: 'Aderendhülsen halten die einzelnen Drähte einer flexiblen Leitung zusammen und geben der Klemme sicheren Halt.' }
    ],
    im: [
      { nom: 'Drehen einer Welle auf Ø 25 mm an der Drehmaschine', pret: 'drehte eine Welle auf Ø 25 mm an der Drehmaschine', perf: 'eine Welle auf Ø 25 mm an der Drehmaschine gedreht', fach: 'Drehmaschine', lern: 'Die Drehzahl richtet sich nach dem Werkstoff und dem Durchmesser des Werkstücks.' },
      { nom: 'Messen von Bohrungen mit dem Messschieber', pret: 'maß Bohrungen mit dem Messschieber', perf: 'Bohrungen mit dem Messschieber gemessen', fach: 'Messschieber', lern: 'Ein Messschieber wird senkrecht an die Bohrung gelegt, sonst zeigt er einen zu großen Wert.' },
      { nom: 'Feilen und Entgraten eines Stahlwinkels', pret: 'feilte und entgratete einen Stahlwinkel', perf: 'einen Stahlwinkel gefeilt und entgratet', fach: 'Stahlwinkel', lern: 'Beim Feilen übt man nur auf dem Vorwärtshub Druck aus, beim Zurückziehen hebt man die Feile leicht an.' },
      { nom: 'Montieren eines Pneumatikzylinders mit Wegeventil', pret: 'montierte einen Pneumatikzylinder mit Wegeventil', perf: 'einen Pneumatikzylinder mit Wegeventil montiert', fach: 'Pneumatikzylinder', lern: 'Eine Pneumatik-Steuerung braucht saubere Druckluft, deshalb gehören Filter und Druckregler davor.' },
      { nom: 'Fräsen einer Nut in ein Aluminiumteil', pret: 'fräste eine Nut in ein Aluminiumteil', perf: 'eine Nut in ein Aluminiumteil gefräst', fach: 'Nut', lern: 'Beim Fräsen unterscheidet man Gleichlauf und Gegenlauf nach der Drehrichtung des Fräsers zum Vorschub.' },
      { nom: 'Schmieren der Führungen an der Säulenbohrmaschine', pret: 'schmierte die Führungen an der Säulenbohrmaschine', perf: 'die Führungen an der Säulenbohrmaschine geschmiert', fach: 'Säulenbohrmaschine', lern: 'Führungen an Bohrmaschinen brauchen regelmäßig Schmierstoff, sonst steigt der Verschleiß.' },
      { nom: 'Schneiden eines Gewindes M8 mit dem Gewindebohrer', pret: 'schnitt ein Gewinde M8 mit dem Gewindebohrer', perf: 'ein Gewinde M8 mit dem Gewindebohrer geschnitten', fach: 'Gewindebohrer', lern: 'Für ein Gewinde M8 bohrt man vorher mit 6,8 mm Durchmesser, dem Kernlochdurchmesser.' },
      { nom: 'Wechseln eines Lagers an einer Welle', pret: 'wechselte ein Lager an einer Welle', perf: 'ein Lager an einer Welle gewechselt', fach: 'Lager', lern: 'Ein Lager braucht passende Schmierung und muss vor dem Einbau sauber sein.' }
    ],
    tpd: [
      { nom: 'Zeichnen einer Welle in der Vorderansicht im CAD-Programm', pret: 'zeichnete eine Welle in der Vorderansicht im CAD-Programm', perf: 'eine Welle in der Vorderansicht im CAD-Programm gezeichnet', fach: 'CAD', lern: 'Sichtbare Kanten zeichnet man mit breiten Volllinien, Mittellinien mit schmalen Strichpunktlinien.' },
      { nom: 'Bemaßen eines Flansches nach Normvorgabe', pret: 'bemaßte einen Flansch nach Normvorgabe', perf: 'einen Flansch nach Normvorgabe bemaßt', fach: 'Flansch', lern: 'Maße stehen nur einmal in der Zeichnung, und zwar dort, wo die Form am besten erkennbar ist.' },
      { nom: 'Erstellen einer Stückliste für eine Baugruppe', pret: 'erstellte eine Stückliste für eine Baugruppe', perf: 'eine Stückliste für eine Baugruppe erstellt', fach: 'Stückliste', lern: 'Eine Stückliste verbindet jede Positionsnummer der Zeichnung mit Benennung, Menge und Werkstoff.' },
      { nom: 'Eintragen von Toleranzen und Passungen in eine Fertigungszeichnung', pret: 'trug Toleranzen und Passungen in eine Fertigungszeichnung ein', perf: 'Toleranzen und Passungen in eine Fertigungszeichnung eingetragen', fach: 'Toleranzen', lern: 'Toleranzen begrenzen, wie stark ein Maß vom Nennmaß abweichen darf.' },
      { nom: 'Skizzieren eines Gehäuses von Hand im Maßstab 1:2', pret: 'skizzierte ein Gehäuse von Hand im Maßstab 1:2', perf: 'ein Gehäuse von Hand im Maßstab 1:2 skizziert', fach: 'Maßstab', lern: 'Eine Skizze braucht kein Lineal, aber die Proportionen müssen stimmen.' },
      { nom: 'Modellieren eines Winkelblechs als 3D-Volumenmodell', pret: 'modellierte ein Winkelblech als 3D-Volumenmodell', perf: 'ein Winkelblech als 3D-Volumenmodell modelliert', fach: 'Volumenmodell', lern: 'Ein Volumenmodell enthält alle Körperinformationen, aus ihm lassen sich Ansichten und Schnitte ableiten.' },
      { nom: 'Auswählen von Normteilen für eine Schraubenverbindung', pret: 'wählte Normteile für eine Schraubenverbindung aus', perf: 'Normteile für eine Schraubenverbindung ausgewählt', fach: 'Normteile', lern: 'Normteile wie Schrauben und Muttern müssen nicht gezeichnet werden, es genügt die Normbezeichnung in der Stückliste.' },
      { nom: 'Anlegen eines Schnitts durch eine Lagerbuchse', pret: 'legte einen Schnitt durch eine Lagerbuchse an', perf: 'einen Schnitt durch eine Lagerbuchse angelegt', fach: 'Schnitt', lern: 'Ein Schnitt macht Innenformen sichtbar, die in der Ansicht nur gestrichelt erscheinen, und die Schnittflächen erhalten eine Schraffur.' }
    ],
    fll: [
      { nom: 'Prüfen der Lieferung am Wareneingang anhand des Lieferscheins', pret: 'prüfte die Lieferung am Wareneingang anhand des Lieferscheins', perf: 'die Lieferung am Wareneingang anhand des Lieferscheins geprüft', fach: 'Lieferschein', lern: 'Vor dem Quittieren gleicht man beim Wareneingang Lieferschein, Bestellung und Ware miteinander ab.' },
      { nom: 'Einlagern von Paletten im Hochregal mit dem Gabelstapler', pret: 'lagerte Paletten im Hochregal mit dem Gabelstapler ein', perf: 'Paletten im Hochregal mit dem Gabelstapler eingelagert', fach: 'Gabelstapler', lern: 'Auf einem Gabelstapler beeinflusst der Lastschwerpunkt, wie viel Last angehoben werden darf.' },
      { nom: 'Kommissionieren eines Kundenauftrags mit dem Handscanner', pret: 'kommissionierte einen Kundenauftrag mit dem Handscanner', perf: 'einen Kundenauftrag mit dem Handscanner kommissioniert', fach: 'Handscanner', lern: 'Beim Kommissionieren spart ein fester Laufweg durch das Lager Zeit und Fehler.' },
      { nom: 'Verpacken von Ersatzteilen und Beschriften der Versandkartons', pret: 'verpackte Ersatzteile und beschriftete die Versandkartons', perf: 'Ersatzteile verpackt und die Versandkartons beschriftet', fach: 'Versandkartons', lern: 'Versandkartons brauchen Absender, Empfänger und Inhaltsangabe auf dem Etikett.' },
      { nom: 'Sichern einer Ladung auf dem Lkw mit Zurrgurten', pret: 'sicherte eine Ladung auf dem Lkw mit Zurrgurten', perf: 'eine Ladung auf dem Lkw mit Zurrgurten gesichert', fach: 'Zurrgurten', lern: 'Zurrgurte dürfen nicht über scharfe Kanten laufen, Kantenschutz verhindert Beschädigungen.' },
      { nom: 'Zählen des Bestands bei der Inventur im Regalbereich B', pret: 'zählte den Bestand bei der Inventur im Regalbereich B', perf: 'den Bestand bei der Inventur im Regalbereich B gezählt', fach: 'Inventur', lern: 'Bei der Inventur wird der Istbestand mit dem Buchbestand verglichen, Abweichungen müssen geklärt werden.' },
      { nom: 'Erfassen von Retouren im Lagerverwaltungssystem', pret: 'erfasste Retouren im Lagerverwaltungssystem', perf: 'Retouren im Lagerverwaltungssystem erfasst', fach: 'Retouren', lern: 'Retouren müssen erfasst werden, damit der Bestand im System wieder stimmt.' },
      { nom: 'Kontrollieren der Gefahrgutkennzeichnung an einer Lieferung', pret: 'kontrollierte die Gefahrgutkennzeichnung an einer Lieferung', perf: 'die Gefahrgutkennzeichnung an einer Lieferung kontrolliert', fach: 'Gefahrgutkennzeichnung', lern: 'Auf Gefahrgutverpackungen zeigen Gefahrzettel und UN-Nummer, welcher Stoff darin steckt.' }
    ],
    ik: [
      { nom: 'Kontieren und Buchen von Eingangsrechnungen', pret: 'kontierte und buchte Eingangsrechnungen', perf: 'Eingangsrechnungen kontiert und gebucht', fach: 'Eingangsrechnungen', lern: 'Jeder Buchung liegt ein Beleg zugrunde, ohne Beleg keine Buchung.' },
      { nom: 'Einholen und Vergleichen von drei Angeboten für Büromaterial', pret: 'holte drei Angebote für Büromaterial ein und verglich sie', perf: 'drei Angebote für Büromaterial eingeholt und verglichen', fach: 'Angebot', lern: 'Ein Angebotsvergleich berücksichtigt außer dem Preis auch Lieferzeit, Zahlungsbedingungen und Qualität.' },
      { nom: 'Erfassen einer Bestellung im ERP-System', pret: 'erfasste eine Bestellung im ERP-System', perf: 'eine Bestellung im ERP-System erfasst', fach: 'Bestellung', lern: 'Im ERP-System hängen Bestellung, Wareneingang und Rechnung zusammen und lassen sich zuordnen.' },
      { nom: 'Berechnen des Bezugspreises mit Rabatt und Skonto', pret: 'berechnete den Bezugspreis mit Rabatt und Skonto', perf: 'den Bezugspreis mit Rabatt und Skonto berechnet', fach: 'Bezugspreis', lern: 'Der Bezugspreis ergibt sich aus Listenpreis, Rabatt, Skonto und Bezugskosten.' },
      { nom: 'Schreiben einer Mahnung wegen einer überfälligen Rechnung', pret: 'schrieb eine Mahnung wegen einer überfälligen Rechnung', perf: 'eine Mahnung wegen einer überfälligen Rechnung geschrieben', fach: 'Mahnung', lern: 'Eine Mahnung folgt erst nach Ablauf der Zahlungsfrist und bei fehlendem Zahlungseingang.' },
      { nom: 'Sortieren und Ablegen von Buchungsbelegen', pret: 'sortierte und legte Buchungsbelege ab', perf: 'Buchungsbelege sortiert und abgelegt', fach: 'Buchungsbelege', lern: 'Belege müssen geordnet und nachvollziehbar aufbewahrt werden, damit eine Prüfung sie findet.' },
      { nom: 'Abstimmen des Kassenbuchs mit dem Kassenbestand', pret: 'stimmte das Kassenbuch mit dem Kassenbestand ab', perf: 'das Kassenbuch mit dem Kassenbestand abgestimmt', fach: 'Kassenbuch', lern: 'Das Kassenbuch muss täglich mit dem tatsächlichen Bargeldbestand übereinstimmen.' },
      { nom: 'Prüfen einer Auftragsbestätigung auf Menge und Liefertermin', pret: 'prüfte eine Auftragsbestätigung auf Menge und Liefertermin', perf: 'eine Auftragsbestätigung auf Menge und Liefertermin geprüft', fach: 'Auftragsbestätigung', lern: 'Eine Auftragsbestätigung hält Menge, Preis und Liefertermin schriftlich fest.' }
    ],
    fi: [
      { nom: 'Einrichten eines Benutzerkontos im Active Directory', pret: 'richtete ein Benutzerkonto im Active Directory ein', perf: 'ein Benutzerkonto im Active Directory eingerichtet', fach: 'Benutzerkonto', lern: 'Ein Benutzerkonto braucht nur die Rechte, die für die Aufgabe nötig sind.' },
      { nom: 'Crimpen und Testen eines Patchkabels', pret: 'crimpte und testete ein Patchkabel', perf: 'ein Patchkabel gecrimpt und getestet', fach: 'Patchkabel', lern: 'Beim Crimpen muss die Aderfolge nach dem Standard stimmen, sonst funktioniert das Kabel nicht.' },
      { nom: 'Installieren von Windows-Updates auf einem Testrechner', pret: 'installierte Windows-Updates auf einem Testrechner', perf: 'Windows-Updates auf einem Testrechner installiert', fach: 'Windows', lern: 'Updates schließen Sicherheitslücken und müssen deshalb zeitnah eingespielt werden.' },
      { nom: 'Berechnen von Subnetzen für ein Netz mit 50 Geräten', pret: 'berechnete Subnetze für ein Netz mit 50 Geräten', perf: 'Subnetze für ein Netz mit 50 Geräten berechnet', fach: 'Subnetze', lern: 'Ein Subnetz mit 50 Geräten braucht mindestens 52 Adressen, daher passt ein Netz mit 64 Adressen.' },
      { nom: 'Schreiben einer SQL-Abfrage auf die Kundentabelle der Übungsdatenbank', pret: 'schrieb eine SQL-Abfrage auf die Kundentabelle der Übungsdatenbank', perf: 'eine SQL-Abfrage auf die Kundentabelle der Übungsdatenbank geschrieben', fach: 'SQL', lern: 'Eine SQL-Abfrage beginnt mit SELECT, FROM nennt die Tabelle und WHERE filtert die Zeilen.' },
      { nom: 'Bearbeiten eines Support-Tickets zu einem Druckerproblem', pret: 'bearbeitete ein Support-Ticket zu einem Druckerproblem', perf: 'ein Support-Ticket zu einem Druckerproblem bearbeitet', fach: 'Support', lern: 'Ein Support-Ticket braucht eine klare Fehlerbeschreibung, den Zeitpunkt und den betroffenen Arbeitsplatz.' },
      { nom: 'Einrichten einer Datensicherung auf dem Testserver', pret: 'richtete eine Datensicherung auf dem Testserver ein', perf: 'eine Datensicherung auf dem Testserver eingerichtet', fach: 'Datensicherung', lern: 'Ein Backup hilft nur, wenn man die Wiederherstellung regelmäßig testet.' },
      { nom: 'Konfigurieren einer VLAN-Trennung am Switch', pret: 'konfigurierte eine VLAN-Trennung am Switch', perf: 'eine VLAN-Trennung am Switch konfiguriert', fach: 'VLAN', lern: 'Ein VLAN trennt Netze logisch voneinander, obwohl sie dieselben Switches nutzen.' }
    ]
  };

  /* Dauer-Bausteine [Minuten, Text] */
  const DAU = [[30, '30 Minuten'], [45, '45 Minuten'], [60, '1 Stunde'], [90, '1,5 Stunden'], [120, '2 Stunden'], [150, '2,5 Stunden'], [180, '3 Stunden']];
  /* Allgemeine Tätigkeiten ohne Fachbegriff (für Aufgabe "Begriffe im Eintrag") */
  const ALLG = ['Teile sortiert', 'Das Gerät bedient', 'Material geholt', 'Unterlagen sortiert', 'Den Arbeitsplatz aufgeräumt', 'Eine Maschine eingestellt', 'Werkzeug gereinigt'];

  const pick = (R, a) => C().pick(R, a), shuffle = (R, a) => C().shuffle(R, a), cap = s => C().cap(s);
  const par = d => (d ? ' (' + d[1] + ')' : '');
  const part = (t, d) => cap(t.perf) + par(d) + '.';
  const ichP = (t, d) => 'Ich habe ' + t.perf + par(d) + '.';
  const ichPr = (t, d) => 'Ich ' + t.pret + par(d) + '.';
  const nomS = (t, d) => t.nom + par(d) + '.';
  const q = s => '„' + s + '“';
  const clock = m => Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2);
  const rangeTxt = (start, min) => 'von ' + clock(start) + ' bis ' + clock(start + min) + ' Uhr';
  const bOf = R => pick(R, C().BERUFE);
  const twoT = (R, b, n) => shuffle(R, T[b.k]).slice(0, n);
  const lernS = (R, t) => pick(R, ['Gelernt: ', 'Dabei habe ich gelernt: ', 'Mir ist klar geworden: ', 'Erkenntnis: ']) + t.lern;
  const numbered = arr => arr.map((s, i) => '(' + (i + 1) + ') ' + s).join(' ');

  /* ---------- Generatoren ---------- */
  const G = {
    /* ===== Sätze bewerten ===== */
    satz: R => {
      const b = bOf(R), t = pick(R, T[b.k]), o = pick(R, b.ort), d = pick(R, DAU), typ = pick(R, ['vage', 'wertung', 'ich', 'dauer']);
      const S = {
        vage: pick(R, ['Hilfestellung ' + o.in + par(d) + '.', 'Bei verschiedenen Arbeiten ' + o.in + ' zugeschaut' + par(d) + '.', 'Diverse Aufgaben erledigt' + par(d) + '.', 'Mitgeholfen' + par(d) + '.', 'Gearbeitet ' + o.in + par(d) + '.']),
        wertung: pick(R, ['Der Tag ' + o.in + ' war stressig und anstrengend' + par(d) + '.', 'Die Arbeit ' + o.in + ' hat richtig Spaß gemacht' + par(d) + '.', 'Das war alles ziemlich langweilig' + par(d) + '.']),
        ich: ichP(t, d), dauer: part(t, null)
      };
      const OPT = { vage: 'Er ist zu vage: Es wird nicht klar, was konkret getan wurde.', wertung: 'Er enthält eine Wertung statt einer Tätigkeit.', ich: 'Er ist in Ich-Form statt sachlich geschrieben.', dauer: 'Es fehlt die Dauer der Tätigkeit.' };
      const EX = { vage: 'Wörter wie „geholfen“, „mitgeholfen“, „zugeschaut“, „diverse“ oder „gearbeitet“ sagen nicht, welches Bauteil und welcher Vorgang gemeint ist. Ein Stichpunkt braucht eine konkrete Tätigkeit, zum Beispiel „' + t.perf + '“.', wertung: 'Wörter wie „stressig“, „langweilig“ oder „Spaß“ beschreiben ein Gefühl. Im Bericht steht, was du getan hast, zum Beispiel „' + t.perf + '“.', ich: 'Die Tätigkeit, die Dauer und der Fachbegriff sind vorhanden, aber der Satz ist in der Ich-Form geschrieben. Sachlich genügt „' + cap(t.perf) + '“. Ob bei euch die Ich-Form erlaubt ist, sagt dir dein Ausbilder.', dauer: 'Tätigkeit und Fachbegriff stehen da, es fehlt aber, wie lange die Tätigkeit dauerte (zum Beispiel „2 Stunden“ oder „von 8:00 bis 10:00 Uhr“).' };
      const o2 = shuffle(R, Object.keys(OPT)).filter(k => k !== typ);
      const r = choiceQ(R, 'Ein Azubi (' + b.s + ') schreibt in den Tagesbericht: ' + q(S[typ]) + ' Was ist hier das Hauptproblem?', OPT[typ], o2.map(k => OPT[k]), EX[typ], ['Frage dich bei jedem Satz: Was genau wurde getan? Wie lange? Ist der Satz sachlich?', 'Suche im Satz nach einer Dauer, nach „ich“ oder „mir“ und nach Bewertungen wie „langweilig“.']);
      r.meta = { typ, sentence: S[typ], beruf: b.k }; return r;
    },
    satzbest: R => {
      const b = bOf(R), ts = twoT(R, b, 2), t = ts[0], d1 = pick(R, DAU), d2 = pick(R, DAU);
      const good = part(t, d1), w1 = 'Ich habe ' + t.perf + ' und fand es richtig toll.', w2 = 'Bei den Arbeiten mitgeholfen' + par(d2) + '.', w3 = nomS(ts[1], null);
      const r = choiceQ(R, 'Welcher Stichpunkt gehört am ehesten so in einen sachlichen Tagesbericht (' + b.s + ')?', good, [w1, w2, w3],
        'Der richtige Stichpunkt nennt die konkrete Tätigkeit mit Fachbegriff „' + t.fach + '“ und eine Dauer, ohne Ich und ohne Wertung. Der Satz mit „fand es richtig toll“ bewertet und hat keine Dauer, „mitgeholfen“ ist zu vage, und beim Satz ohne Klammer fehlt die Dauer.',
        ['Prüfe jeden Stichpunkt auf drei Dinge: konkrete Tätigkeit, Dauer, sachlicher Ton.', 'Nur ein Stichpunkt besteht alle drei Prüfungen.']);
      r.meta = { good, wrong: [w1, w2, w3], beruf: b.k }; return r;
    },
    dauerwahl: R => {
      const b = bOf(R), t = pick(R, T[b.k]), d = pick(R, DAU), st = pick(R, [450, 480, 540, 780]);
      const good = R() < 0.5 ? nomS(t, d) : t.nom + ', ' + rangeTxt(st, d[0]) + '.';
      const wr = [t.nom + ' (den ganzen Vormittag).', t.nom + ' (lange).', t.nom + ' (nachmittags).'];
      const r = choiceQ(R, 'Welcher Stichpunkt enthält eine Dauer, die du für das Tagesbericht-Gerüst übernehmen kannst?', good, wr,
        'Eine brauchbare Dauer nennt Stunden oder Minuten oder Anfang und Ende mit Uhrzeit (hier: „' + (good.indexOf('Uhr') >= 0 ? rangeTxt(st, d[0]) : d[1]) + '“, das sind ' + C().fmtDauer(d[0]) + '). „Den ganzen Vormittag“, „lange“ und „nachmittags“ lassen sich nicht in eine Zeit umrechnen.',
        ['Eine Dauer lässt sich in Minuten umrechnen.', 'Stunden- oder Minutenangaben und „von … bis … Uhr“ zählen, Tageszeiten nicht.']);
      r.meta = { good, wrong: wr, beruf: b.k }; return r;
    },
    zeit: R => {
      const b = bOf(R), ts = twoT(R, b, 3), major = pick(R, ['perf', 'praet']), pos = C().ri(R, 0, 2);
      const mk = (t, k) => (k === 'perf' ? 'Ich habe ' + t.perf + '.' : 'Ich ' + t.pret + '.');
      const odd = major === 'perf' ? 'praet' : 'perf', sents = ts.map((t, i) => mk(t, i === pos ? odd : major));
      const NONE = 'Alle drei Sätze passen zeitlich zusammen.';
      const r = choiceQ(R, 'Drei Stichpunkte aus einem Tagesbericht (' + b.s + '): ' + numbered(sents) + ' Welcher Satz passt zeitlich nicht zu den anderen?', sents[pos], sents.filter((s, i) => i !== pos).concat([NONE]),
        'Zwei Sätze stehen im ' + (major === 'perf' ? 'Perfekt („Ich habe … gemacht“)' : 'Präteritum („Ich machte …“)') + ', Satz ' + (pos + 1) + ' im ' + (odd === 'perf' ? 'Perfekt' : 'Präteritum') + '. Im Bericht bleibst du bei einer Zeitform.',
        ['Achte auf das Verb: Steht „habe … gemacht“ oder eine Form wie „machte“?', 'Zwei Sätze haben dieselbe Bauweise, einer weicht ab.']);
      r.meta = { sents, pos, odd, major }; return r;
    },
    anfang: R => {
      const b = bOf(R), w = pick(R, ['ich', 'dann', 'danach']), k = C().ri(R, 2, 4);
      let ts, tries = 0;
      do { ts = twoT(R, b, 5); tries++; } while (tries < 40 && new Set(ts.slice(k).map(t => C().firstWord(part(t, null)))).size < 5 - k);
      const head = { ich: 'Ich habe ', dann: 'Dann habe ich ', danach: 'Danach habe ich ' }[w];
      const items = shuffle(R, ts.map((t, i) => (i < k ? head + t.perf + '.' : part(t, null))));
      const v = C().maxStart(items);
      const r = numQ('Ein Azubi schreibt diese Stichpunkte: ' + numbered(items) + ' Wie oft kommt das am häufigsten verwendete Anfangswort vor?', v, 'Mal', 'Häufigstes Anfangswort, Anzahl', 0.01,
        'Das Wort „' + cap(w) + '“ steht bei ' + v + ' Stichpunkten am Anfang. Die übrigen Stichpunkte beginnen alle verschieden. Wiederholte Satzanfänge wirken eintönig, beginne lieber mit der Tätigkeit.',
        ['Lies nur das erste Wort jedes Stichpunkts und zähle gleiche Wörter.', 'Es gibt ein Wort, das mehrfach vorn steht, alle anderen kommen nur einmal vor.']);
      r.meta = { items, word: w, k }; return r;
    },
    fachzahl: R => {
      const b = bOf(R), n = C().ri(R, 4, 5), k = C().ri(R, 1, n - 1), ts = twoT(R, b, k), gen = shuffle(R, ALLG).slice(0, n - k);
      const items = shuffle(R, ts.map(t => part(t, null)).concat(gen.map(x => x + '.')));
      const r = numQ('Ein Tagesbericht soll Fachbegriffe enthalten, also Bauteile, Werkzeuge oder Verfahren beim Namen nennen. Stichpunkte: ' + numbered(items) + ' Wie viele davon enthalten einen Fachbegriff?', k, 'Stichpunkte', 'Stichpunkte mit Fachbegriff', 0.01,
        'Einen Fachbegriff enthalten die Stichpunkte mit ' + ts.map(t => '„' + t.fach + '“').join(', ') + ' (' + k + ' Stück). „Teile“, „Gerät“, „Material“, „Maschine“ oder „Werkzeug“ sind zu allgemein.',
        ['Fachbegriff heißt: ein Wort, das nur zu deinem Beruf passt.', 'Allgemeine Wörter wie „Teile“ oder „Gerät“ zählen nicht.']);
      r.meta = { items, k, beruf: b.k }; return r;
    },

    /* ===== Sätze verbessern ===== */
    ersetzen: R => {
      const b = bOf(R), t = pick(R, T[b.k]), o = pick(R, b.ort), d = pick(R, DAU);
      const good = part(t, d), wr = ['Ich habe ' + o.in + ' bei verschiedenen Arbeiten geholfen' + par(d) + '.', 'Heute war ich bei ' + t.fach + ' dabei' + par(d) + '.', part(t, null)];
      const r = choiceQ(R, 'Du hast heute Folgendes gemacht: ' + t.nom + ' (' + d[1] + '). Dein erster Entwurf lautet: „Ich habe geholfen.“ Welche Fassung ist besser?', good, wr,
        'Die beste Fassung nennt die Tätigkeit konkret mit Fachbegriff und Dauer und ist sachlich. Die beiden Sätze mit „geholfen“ und „dabei“ sind weiter zu vage (und in Ich-Form), der letzte Satz nennt keine Dauer.',
        ['Ersetze das vage Wort durch das, was du konkret getan hast.', 'Die richtige Fassung enthält Tätigkeit, Fachbegriff und Dauer.']);
      r.meta = { good, wrong: wr, beruf: b.k }; return r;
    },
    wertung: R => {
      const b = bOf(R), t = pick(R, T[b.k]), d = pick(R, DAU), w = pick(R, ['total langweilig', 'richtig anstrengend', 'ziemlich nervig']);
      const bad = 'Das ' + t.nom + ' war ' + w + par(d) + '.', good = part(t, d);
      const wr = ['Das ' + t.nom + ' war anstrengend, aber hat sich gelohnt' + par(d) + '.', 'Ich fand ' + t.nom + ' nicht so schlimm' + par(d) + '.', 'Ich habe etwas gemacht' + par(d) + '.'];
      const r = choiceQ(R, 'Ein Azubi hat geschrieben: ' + q(bad) + ' Wie formulierst du den Stichpunkt sachlich?', good, wr,
        'Sachlich beschreibst du, was du getan hast, ohne Gefühle: ' + q(good) + ' Die anderen Fassungen bewerten weiter („anstrengend“, „nicht so schlimm“) oder sind zu vage („etwas gemacht“). Was du empfunden hast oder mitnimmst, kann in das Feld „Gelernt“.',
        ['Lasse Wörter wie „langweilig“ oder „anstrengend“ weg und beschreibe stattdessen die Tätigkeit.', 'Die sachliche Fassung enthält weder „ich“ noch ein Urteil.']);
      r.meta = { bad, good, wrong: wr, beruf: b.k }; return r;
    },
    ichform: R => {
      const b = bOf(R), t = pick(R, T[b.k]), d = pick(R, DAU), given = ichP(t, d), good = part(t, d);
      const wr = ['Mir hat ' + t.nom + ' Spaß gemacht' + par(d) + '.', 'Ich habe ' + t.perf + ' und fand das toll' + par(d) + '.', part(t, null)];
      const r = choiceQ(R, 'Du willst diesen Stichpunkt sachlich ohne Ich-Form schreiben: ' + q(given) + ' Welche Fassung ist am besten?', good, wr,
        'Ohne „ich“ steht die Tätigkeit vorn: ' + q(good) + ' Die Fassungen mit „Mir hat …“ und „fand das toll“ bleiben persönlich und bewerten, die letzte lässt die Dauer weg. Frag deinen Ausbilder, ob bei euch auch die Ich-Form erlaubt ist.',
        ['Streiche „Ich habe“ und beginne mit dem Gegenstand der Arbeit.', 'Die Dauer soll erhalten bleiben.']);
      r.meta = { given, good, wrong: wr, beruf: b.k }; return r;
    },
    zeitraum: R => {
      const b = bOf(R), t = pick(R, T[b.k]), st = pick(R, [420, 450, 480, 540, 600]), du = pick(R, [60, 90, 120, 150, 180, 210, 240]);
      const entry = part(t, null).replace(/\.$/, '') + ', ' + rangeTxt(st, du) + '.';
      const r = numQ('Im Stichpunkt steht ein Zeitraum: ' + q(entry) + ' Welche Dauer trägst du in die Spalte „Dauer“ des Gerüsts ein?', du, 'min', 'Dauer in Minuten', 0.01,
        'Von ' + clock(st) + ' bis ' + clock(st + du) + ' Uhr sind ' + C().fmtDauer(du) + ', das sind ' + du + ' Minuten (' + f(du / 60, 2) + ' Stunden).',
        ['Rechne Ende minus Anfang.', 'Stunden mal 60 plus Minuten ergibt die Minuten.']);
      r.meta = { entry, min: du }; return r;
    },
    zwei: R => {
      const b = bOf(R), t = pick(R, T[b.k]), o = pick(R, b.ort), d = pick(R, DAU), bad = 'Ich habe ' + o.in + ' geholfen.', good = part(t, d);
      const wr = [pick(R, [o.in.charAt(0).toUpperCase() + o.in.slice(1) + ' geholfen' + par(d) + '.', 'Mitgeholfen' + par(d) + '.']), ichP(t, d), part(t, null)];
      const r = choiceQ(R, 'Der Stichpunkt ' + q(bad) + ' hat mehrere Schwächen. Welche Fassung behebt alle?', good, wr,
        'Nötig sind eine konkrete Tätigkeit mit Fachbegriff, eine Dauer und ein sachlicher Ton ohne Ich: ' + q(good) + ' In den anderen Fassungen bleibt ' + 'das vage „geholfen“, die Ich-Form oder die fehlende Dauer übrig.',
        ['Prüfe nach jeder Fassung: Ist die Tätigkeit konkret, steht eine Dauer da, fehlt das „ich“?', 'Nur eine Fassung hat alle drei Verbesserungen.']);
      r.meta = { bad, good, wrong: wr, beruf: b.k }; return r;
    },
    zeitein: R => {
      const b = bOf(R), ts = twoT(R, b, 3), pos = C().ri(R, 0, 2), major = pick(R, ['perf', 'praet']), odd = major === 'perf' ? 'praet' : 'perf';
      const mk = (t, k) => (k === 'perf' ? 'Ich habe ' + t.perf + '.' : 'Ich ' + t.pret + '.');
      const bad = ts.map((t, i) => mk(t, i === pos ? odd : major)), mkAll = k => ts.map(t => mk(t, k)).join(' | ');
      const good = mkAll(major);
      const mixed = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]].map(p => ts.map((t, i) => mk(t, p[i] ? 'perf' : 'praet')).join(' | '));
      const wr = shuffle(R, mixed).slice(0, 3);
      const r = choiceQ(R, 'Die Stichpunkte ' + numbered(bad) + ' sind zeitlich gemischt. In welcher Fassung steht alles in derselben Zeitform (die Sätze sind jeweils mit | getrennt)?', good, wr,
        'Es gibt zwei Möglichkeiten: alles im Perfekt oder alles im Präteritum. In der richtigen Fassung ist der abweichende Satz angeglichen. Die anderen Fassungen mischen weiterhin beide Zeitformen.',
        ['Suche den Satz, der aus der Reihe fällt, und gleiche ihn an die anderen an.', 'In der richtigen Fassung hat jeder Satz die gleiche Bauweise.']);
      r.meta = { bad, good, wrong: wr, beruf: b.k }; return r;
    },

    /* ===== Tätigkeit und Lernertrag ===== */
    wasgetan: R => {
      const b = bOf(R), ts = twoT(R, b, 4), d = pick(R, DAU);
      const good = part(ts[0], d), wr = ts.slice(1).map(t => lernS(R, t));
      const r = choiceQ(R, 'Welcher dieser Sätze beschreibt eine Tätigkeit (was du getan hast) und keinen Lernertrag?', good, wr,
        'Eine Tätigkeit beschreibt, was gemacht wurde: ' + q(good) + ' Die anderen Sätze halten fest, was man daraus mitnimmt („Gelernt“, „Erkenntnis“, „klar geworden“). Das gehört in das Feld „Gelernt“.',
        ['Eine Tätigkeit antwortet auf die Frage „Was hast du getan?“.', 'Ein Lernertrag beginnt oft mit Wörtern wie „Gelernt“, „Erkenntnis“ oder „klar geworden“.']);
      r.meta = { good, wrong: wr, beruf: b.k }; return r;
    },
    wasmit: R => {
      const b = bOf(R), ts = twoT(R, b, 4), t0 = ts[0], good = lernS(R, t0), wr = ts.slice(1).map(t => part(t, pick(R, DAU)));
      const r = choiceQ(R, 'Welcher dieser Sätze ist ein Lernertrag (was du verstanden oder mitgenommen hast)?', good, wr,
        'Ein Lernertrag hält eine Erkenntnis fest: ' + q(good) + ' Die anderen Sätze beschreiben Tätigkeiten mit Dauer.',
        ['Ein Lernertrag antwortet auf die Frage „Was weiß oder kann ich jetzt?“.', 'Achte auf Wörter wie „Gelernt“ oder „klar geworden“.']);
      r.meta = { good, wrong: wr, beruf: b.k }; return r;
    },
    lernfeld: R => {
      const b = bOf(R), t = pick(R, T[b.k]), d = pick(R, DAU);
      const wr = ['Ich habe viel gelernt.', 'Es hat Spaß gemacht und war interessant.', 'Ich habe ' + t.perf + '.'];
      const r = choiceQ(R, 'Du hast heute Folgendes getan: ' + t.nom + ' (' + d[1] + '). Welcher Eintrag im Feld „Gelernt“ ist am hilfreichsten?', t.lern, wr,
        'Hilfreich ist eine konkrete, überprüfbare Erkenntnis: ' + q(t.lern) + ' „Viel gelernt“ sagt nichts, „Spaß gemacht“ ist eine Wertung, und der letzte Satz wiederholt nur die Tätigkeit.',
        ['Das Feld „Gelernt“ soll etwas enthalten, das du nächstes Mal anwenden kannst.', 'Wiederholungen der Tätigkeit und Gefühle gehören nicht hinein.']);
      r.meta = { good: t.lern, wrong: wr, beruf: b.k }; return r;
    },
    sortieren: R => {
      const b = bOf(R), n = 6, k = C().ri(R, 2, 4), ts = twoT(R, b, n);
      const items = shuffle(R, ts.map((t, i) => (i < k ? part(t, pick(R, DAU)) : lernS(R, t))));
      const r = numQ('Ein Azubi hat alles in eine Liste geschrieben: ' + numbered(items) + ' Wie viele davon sind Tätigkeiten, die in das Gerüst gehören (nicht in „Gelernt“)?', k, 'Tätigkeiten', 'Anzahl der Tätigkeiten', 0.01,
        k + ' Stichpunkte beschreiben, was getan wurde. Die übrigen ' + (n - k) + ' sind Lernerträge und gehören in das Feld „Gelernt“.',
        ['Sortiere jeden Satz: Tätigkeit oder Erkenntnis?', 'Lernerträge erkennst du an Wörtern wie „Gelernt“, „Erkenntnis“ oder „klar geworden“.']);
      r.meta = { items, k }; return r;
    },

    /* ===== Ausbildungsnachweis (ohne Rechtsberatung) ===== */
    art: (R, arg) => { const i = (arg && arg.length) ? pick(R, arg) : C().ri(R, 0, ARTQ.length - 1), x = ARTQ[i]; return choiceQ(R, x[0], x[1], x[2], x[3], x[4]); },

    /* ===== Wochenbericht ===== */
    woche: R => {
      const b = bOf(R), days = [];
      let sum = 0;
      for (let i = 0; i < 5; i++) {
        const n = C().ri(R, 1, 2), ts = twoT(R, b, n), es = ts.map(t => { const d = pick(R, DAU); sum += d[0]; return part(t, d); });
        days.push(es.join(' '));
      }
      const txt = days.map((x, i) => C().TAGE[i].slice(0, 2) + ': ' + x).join(' · ');
      const r = numQ('Wochenbericht eines Azubis (' + b.s + '): ' + txt + ' Wie viele Stunden Arbeitszeit sind insgesamt eingetragen?', sum / 60, 'h', 'Gesamtdauer', 0.01,
        'Alle Dauern zusammen sind ' + sum + ' Minuten, das sind ' + sum + ' / 60 = ' + f(sum / 60, 2) + ' Stunden.',
        ['Rechne alle Angaben in Minuten um und addiere sie.', 'Teile die Summe der Minuten durch 60.']);
      r.meta = { days, minutes: sum, beruf: b.k }; return r;
    },
    schwerpunkt: R => {
      const b = bOf(R); let ts, entries, tot, best = -1, tries = 0;
      do {
        ts = twoT(R, b, 4); entries = []; tot = [0, 0, 0, 0];
        for (let i = 0; i < 6; i++) { const j = C().ri(R, 0, 3), d = pick(R, DAU); entries.push({ day: Math.min(4, Math.floor(i * 5 / 6)), j, d }); tot[j] += d[0]; }
        const s = tot.slice().sort((x, y) => y - x); best = s[0] - s[1] >= 30 && s[3] > 0 ? tot.indexOf(s[0]) : -1; tries++;
      } while (best < 0 && tries < 200);
      const days = [[], [], [], [], []]; entries.forEach(e => days[e.day].push(part(ts[e.j], e.d)));
      const txt = days.map((x, i) => C().TAGE[i].slice(0, 2) + ': ' + (x.length ? x.join(' ') : '–')).join(' · ');
      const names = ts.map(t => t.fach), rr = choiceQ(R, 'Wochenbericht eines Azubis (' + b.s + '): ' + txt + ' Mit welchem Gegenstand hat der Azubi insgesamt die meiste Zeit verbracht? (Zähle die Dauer aller Einträge, die den Begriff nennen.)', names[best], names.filter((x, i) => i !== best),
        'Zusammengerechnet: ' + ts.map((t, i) => t.fach + ' ' + C().fmtDauer(tot[i])).join(', ') + '. Die meiste Zeit entfällt auf „' + names[best] + '“.',
        ['Addiere die Dauer pro Begriff, nicht pro Tag.', 'Der Unterschied zwischen dem größten und dem zweitgrößten Wert ist mindestens eine halbe Stunde.']);
      rr.meta = { days, ts: ts.map(t => t.fach), totals: tot, best, beruf: b.k }; return rr;
    },
    zusammen: R => {
      const b = bOf(R), ts = twoT(R, b, 2); let d1, d2, d3, tries = 0;
      do { d1 = pick(R, DAU); d2 = pick(R, DAU); d3 = pick(R, DAU); tries++; } while (tries < 40 && (d1[0] + d3[0] === d2[0] || d1[0] === d3[0]));
      const A = ts[0], B = ts[1], sa = d1[0] + d3[0], sb = d2[0], total = sa + sb;
      const txt = 'Mo: ' + part(A, d1) + ' · Di: ' + part(B, d2) + ' · Mi: ' + part(A, d3);
      const sm = (x, y, z) => 'In dieser Woche lag der Schwerpunkt bei „' + A.fach + '“ (' + C().fmtStd(x) + '), außerdem „' + B.fach + '“ (' + C().fmtStd(y) + '), insgesamt ' + C().fmtStd(z) + '.';
      const good = sm(sa, sb, total);
      const wr = [sm(sa, sb, total + 90), sm(sb, sa, total), 'In dieser Woche war viel los, ich habe bei vielen Sachen geholfen und viel gelernt.'];
      const r = choiceQ(R, 'Aus diesen Tageseinträgen soll eine Wochenzusammenfassung entstehen: ' + txt + ' Welche Zusammenfassung stimmt und ist sachlich?', good, wr,
        '„' + A.fach + '“ kommt zweimal vor (' + d1[1] + ' und ' + d3[1] + ' = ' + C().fmtStd(sa) + '), „' + B.fach + '“ einmal (' + C().fmtStd(sb) + '), zusammen ' + C().fmtStd(total) + '. Die erste falsche Fassung hat eine falsche Summe, die zweite vertauscht die Zeiten, die dritte ist vage und enthält „viele Sachen“.',
        ['Addiere zuerst die Dauer für jeden Begriff, dann alles zusammen.', 'Eine Fassung hat falsche Zahlen, eine ist zu vage.']);
      r.meta = { txt, good, wrong: wr, sa, sb, total, beruf: b.k }; return r;
    },
    luecken: R => {
      const b = bOf(R), ts = twoT(R, b, 5), miss = [];
      const es = ts.map((t, i) => {
        const kind = pick(R, ['ok', 'ok', 'none', 'vague']);
        if (kind === 'ok') return part(t, pick(R, DAU));
        miss.push(i);
        return kind === 'none' ? part(t, null) : part(t, null).replace(/\.$/, '') + ' (' + pick(R, ['den ganzen Vormittag', 'nachmittags', 'lange']) + ').';
      });
      if (!miss.length) { const i = C().ri(R, 0, 4); miss.push(i); es[i] = part(ts[i], null); }
      const txt = es.map((x, i) => C().TAGE[i].slice(0, 2) + ': ' + x).join(' · ');
      const r = numQ('Fünf Tageseinträge: ' + txt + ' Bei wie vielen Einträgen fehlt eine verwertbare Dauer?', miss.length, 'Einträge', 'Einträge ohne brauchbare Dauer', 0.01,
        'Ohne verwertbare Dauer sind ' + miss.length + ' Einträge (Tag ' + miss.map(i => C().TAGE[i].slice(0, 2)).join(', ') + '). „Den ganzen Vormittag“, „nachmittags“ und „lange“ zählen nicht als Dauer.',
        ['Suche in jedem Eintrag nach Stunden, Minuten oder „von … bis … Uhr“.', 'Tageszeiten wie „nachmittags“ sind keine Dauer.']);
      r.meta = { days: es, k: miss.length, beruf: b.k }; return r;
    }
  };

  /* PRUEFEN P9: Die Fragen zum Ausbildungsnachweis (Zweck, Rhythmus und Form, Datenschutz) sind bewusst allgemein gehalten und geben keine Rechtsauskunft; sie verweisen auf den Ausbilder. Stimmen die Aussagen zu eurem Betrieb, oder soll konkret auf eure Vorgaben verwiesen werden? */
  const ARTQ = [
    ['Wozu dient der Ausbildungsnachweis (das Berichtsheft) in erster Linie?', 'Er dokumentiert nachvollziehbar, was du im Betrieb gemacht und gelernt hast.', ['Er ist ein Tagebuch für persönliche Erlebnisse und Meinungen.', 'Er ersetzt das Zeugnis der Berufsschule.', 'Er dient dem Betrieb nur zur Kontrolle der Anwesenheit.'], 'Der Nachweis zeigt den Ablauf deiner Ausbildung und was du dabei gelernt hast. Welche Vorgaben dein Betrieb dazu hat, erfährst du von deinem Ausbilder.', ['Es geht um die Ausbildung, nicht um Persönliches.', 'Der Nachweis zeigt Tätigkeiten und Lernerfolge.']],
    ['Wer liest den Ausbildungsnachweis normalerweise durch und zeichnet ihn ab?', 'Dein Ausbilder oder deine Ausbilderin', ['Der Kunde, für den du gearbeitet hast', 'Die Kolleginnen und Kollegen deiner Abteilung der Reihe nach', 'Niemand, der Nachweis wird nur abgelegt'], 'Meist sieht der Ausbilder den Nachweis durch und zeichnet ihn ab. Wie das bei euch genau läuft, frag deinen Ausbilder.', ['Wer ist für deine Ausbildung im Betrieb zuständig?', 'Der Kunde hat mit deinem Nachweis nichts zu tun.']],
    ['Ob du den Bericht täglich oder wöchentlich schreibst und ob auf Papier oder digital, ist je nach Betrieb geregelt. Wen fragst du im Zweifel?', 'Deinen Ausbilder oder deine Ausbilderin', ['Einen Mitschüler aus einem anderen Betrieb, dort läuft es bestimmt genauso', 'Niemanden, die Form darfst du frei wählen', 'Den Pförtner'], 'Der Betrieb legt Rhythmus und Form fest. Dein Ausbilder kennt die Regeln für dich, andere Betriebe können es anders handhaben.', ['Wer legt die Form in deinem Betrieb fest?', 'Andere Betriebe können andere Regeln haben.']],
    ['Dein Ausbilder verlangt eine bestimmte Form für den Nachweis. Was tust du?', 'Du hältst dich an die Vorgabe deines Betriebs und fragst bei Unklarheiten nach.', ['Du wählst die Form, die dir am wenigsten Arbeit macht.', 'Du schreibst alles zu Hause irgendwie nach und gibst es am Ende ab.', 'Du ignorierst die Vorgabe, wenn eine Internetseite etwas anderes zeigt.'], 'Die Vorgabe deines Betriebs gilt für dich. Bei Unklarheiten fragst du deinen Ausbilder, bevor du etwas anders machst.', ['Vorgaben des Betriebs gelten für deinen Nachweis.', 'Fragen ist besser als raten.']],
    ['Wie oft solltest du den Ausbildungsnachweis führen?', 'So regelmäßig, wie es dein Betrieb vorgibt, am besten zeitnah und nicht erst am Ende.', ['Einmal kurz vor der Prüfung für alle Wochen gemeinsam.', 'Nur wenn etwas Besonderes passiert ist.', 'Nur wenn dein Ausbilder dich daran erinnert.'], 'Je zeitnaher du schreibst, desto genauer erinnerst du dich an Tätigkeiten und Dauer. Den Rhythmus legt dein Betrieb fest, frag deinen Ausbilder.', ['Was vergisst man schneller: gestern oder vor drei Monaten?', 'Den Rhythmus gibt der Betrieb vor.']],
    ['Was gehört in den Tagesbericht?', 'Die Tätigkeit mit Ort oder Abteilung, Dauer und Fachbegriffen, dazu was du gelernt hast.', ['Streit mit Kollegen und persönliche Meinungen über Vorgesetzte.', 'Nur Urlaubs- und Krankheitstage.', 'Eine Bewertung jeder Tätigkeit nach dem Spaßfaktor.'], 'Der Tagesbericht beschreibt sachlich, was du gemacht hast, wo und wie lange, mit Fachbegriffen, und was du gelernt hast. Meinungen und Streit gehören nicht hinein.', ['Denke an die Spalten des Gerüsts.', 'Es geht um Arbeit und Lernen, nicht um Stimmung.']],
    ['Was gehört nicht in den Ausbildungsnachweis?', 'Persönliche Bewertungen von Kollegen und Privates.', ['Die Dauer der Tätigkeiten.', 'Fachbegriffe der Tätigkeit.', 'Was du Neues gelernt hast.'], 'Der Nachweis ist sachlich. Dauer, Fachbegriffe und Gelerntes gehören hinein, persönliche Urteile und Privates nicht.', ['Welche Angaben helfen, die Ausbildung nachzuvollziehen?', 'Sachlich heißt ohne Urteile über Personen.']],
    ['Du warst einen Tag in der Berufsschule. Wie gehst du mit dem Eintrag um?', 'Du schreibst auf, welche Themen behandelt wurden; ob und wie das bei euch verlangt wird, sagt dir dein Ausbilder.', ['Du lässt den Tag leer, weil du nicht im Betrieb warst.', 'Du schreibst, dass die Schule langweilig war.', 'Du kopierst den Eintrag eines Mitschülers.'], 'Berufsschultage werden meist mit den Themen festgehalten. Wie das in deinem Betrieb gehandhabt wird, frag deinen Ausbilder. Bewertungen und Abschreiben helfen nicht.', ['Welche Themen standen auf dem Stundenplan?', 'Kopieren ist keine eigene Dokumentation.']],
    ['Welche Angabe im Bericht ist unproblematisch?', 'Angebot für einen Kunden erstellt (2 Stunden).', ['Angebot mit Kundenname, Anschrift und Preis wörtlich abgeschrieben.', 'Interne Konstruktionsdaten eines neuen Produkts im Wortlaut.', 'Zugangsdaten des Serverraums für den nächsten Eintrag notiert.'], 'Kundendaten, Preise, interne Konstruktionsdaten und Zugangsdaten gehören nicht in den Bericht. Was ihr im Zweifel weglasst, klärt dein Ausbilder.', ['Der Bericht wird weitergegeben und kann gelesen werden.', 'Nur die Tätigkeit ist wichtig, nicht die Inhalte.']],
    ['Du bist unsicher, ob du eine Information in den Bericht schreiben darfst, zum Beispiel eine Kundenliste. Was tust du?', 'Du lässt sie weg und fragst deinen Ausbilder.', ['Du schreibst sie hinein, den Bericht liest ja niemand außer dir.', 'Du fotografierst die Liste und klebst sie ein.', 'Du fragst einen Freund außerhalb des Betriebs.'], 'Im Zweifel bleibt die Information draußen und du fragst deinen Ausbilder. Außenstehende sollen keine Betriebsinterna erhalten.', ['Wer entscheidet, was aus dem Betrieb heraus darf?', 'Im Zweifel weglassen und fragen.']]
  ];

  /* ---------- Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument ---------- */
  const defs = [
    ['Sätze bewerten', 1, 'Satz lesen', 'satz'], ['Sätze bewerten', 1, 'Stichpunkte vergleichen', 'satzbest'], ['Sätze bewerten', 2, 'Zeitangaben prüfen', 'dauerwahl'], ['Sätze bewerten', 2, 'Sätze nebeneinander', 'zeit'], ['Sätze bewerten', 2, 'Anfang der Sätze', 'anfang'], ['Sätze bewerten', 3, 'Begriffe im Eintrag', 'fachzahl'],
    ['Sätze verbessern', 1, 'Entwurf überarbeiten', 'ersetzen'], ['Sätze verbessern', 1, 'Eintrag sachlich fassen', 'wertung'], ['Sätze verbessern', 2, 'Eintrag umschreiben', 'ichform'], ['Sätze verbessern', 2, 'Zeitraum eintragen', 'zeitraum'], ['Sätze verbessern', 3, 'Entwurf mit Lücken', 'zwei'], ['Sätze verbessern', 3, 'Eintrag angleichen', 'zeitein'],
    ['Tätigkeit und Lernertrag', 1, 'Was wurde gemacht?', 'wasgetan'], ['Tätigkeit und Lernertrag', 1, 'Was nimmst du mit?', 'wasmit'], ['Tätigkeit und Lernertrag', 2, 'Feld Gelernt füllen', 'lernfeld'], ['Tätigkeit und Lernertrag', 3, 'Eintrag sortieren', 'sortieren'],
    ['Ausbildungsnachweis', 1, 'Wozu ein Nachweis?', 'art', [0, 1]], ['Ausbildungsnachweis', 1, 'Wer legt fest?', 'art', [2, 3, 4]], ['Ausbildungsnachweis', 2, 'Inhalt des Tagesberichts', 'art', [5, 6, 7]], ['Ausbildungsnachweis', 3, 'Was darf hinein?', 'art', [8, 9]],
    ['Wochenbericht', 2, 'Stunden der Woche', 'woche'], ['Wochenbericht', 2, 'Schwerpunkt der Woche', 'schwerpunkt'], ['Wochenbericht', 3, 'Woche in Worten', 'zusammen'], ['Wochenbericht', 3, 'Lücken in der Woche', 'luecken']
  ];
  const tasks = defs.map((d, i) => ({ id: 'bhf' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('bhf-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (frei erfundene Tage; der Helfer analysiert sie im Reiter "Beispiele") ---------- */
  /* PRUEFEN P10: Die acht Beispieltage sind frei erfunden und bewusst mit typischen Schwächen versehen. Passen Tätigkeiten, Orte und Dauern zum Alltag eurer Azubis? */
  const examples = [
    { id: 'egs1', beruf: 'egs', title: 'Ein Tag in der Lehrwerkstatt Elektronik', ort: 'Lehrwerkstatt Elektronik', text: 'Vier Stichpunkte nach einem Werkstatttag. Schau dir an, welche Schwächen der Helfer findet und wie das Gerüst daraus entsteht.', stich: 'Ich habe in der Werkstatt geholfen.\nLöten von Widerständen auf eine Lochrasterplatine, 2 Stunden\nDas Messen mit dem Multimeter war langweilig (1 Stunde).\nSchaltplan gezeichnet', gelernt: 'Viel gelernt.' },
    { id: 'ige1', beruf: 'ige', title: 'Ein Tag im Schaltschrankbau', ort: 'Schaltschrankbau', text: 'Verdrahten und Anschließen. Ein Eintrag ist sehr allgemein.', stich: 'Schaltschrank nach Stromlaufplan verdrahtet (2 Stunden)\nLeitungsschutzschalter auf der Hutschiene montiert (45 Minuten)\nIch habe die Steckdose angeschlossen (30 Minuten)\nIch habe verschiedene Aufgaben erledigt.', gelernt: 'Der Schutzleiter hat an der Steckdose seinen festen Platz am Schutzkontakt.' },
    { id: 'im1', beruf: 'im', title: 'Ein Tag in der Lehrwerkstatt Metall', ort: 'Lehrwerkstatt Metall', text: 'Dreh- und Feilarbeiten, aber auch ein sehr allgemeiner Satz. Der Helfer zeigt, was fehlt.', stich: 'Drehen einer Welle auf Ø 25 mm an der Drehmaschine, von 7:30 bis 10:00 Uhr\nWir haben diverse Sachen gemacht.\nFeilen und Entgraten eines Stahlwinkels (45 Minuten)\nIch fand das Fräsen richtig toll, 1,5 Stunden.', gelernt: 'Beim Drehen muss die Drehzahl zum Werkstoff und zum Durchmesser passen, sonst überhitzt die Schneide.' },
    { id: 'tpd1', beruf: 'tpd', title: 'Ein Tag im Konstruktionsbüro', ort: 'Konstruktionsbüro', text: 'Zeichnen und Bemaßen. Achte auf die Satzanfänge.', stich: 'Welle in der Vorderansicht im CAD-Programm gezeichnet (2 Stunden)\nStückliste für eine Baugruppe erstellt (1 Stunde)\nIch habe Toleranzen in die Zeichnung eingetragen (45 Minuten)\nIch habe das Gehäuse skizziert (30 Minuten)', gelernt: 'Toleranzen begrenzen, wie stark ein Maß vom Nennmaß abweichen darf.' },
    { id: 'fll1', beruf: 'fll', title: 'Ein Tag im Wareneingang', ort: 'Wareneingang', text: 'Prüfen und Einlagern. Ein Satz fällt aus der Reihe.', stich: 'Ich war beim Wareneingang dabei.\nLieferung am Wareneingang anhand des Lieferscheins geprüft (1 Stunde)\nPaletten im Hochregal mit dem Gabelstapler eingelagert (2 Stunden)\nPaletten kontrolliert (30 Minuten)', gelernt: 'Vor dem Quittieren gleicht man Lieferschein, Bestellung und Ware miteinander ab.' },
    { id: 'ik1', beruf: 'ik', title: 'Ein Tag im Einkauf', ort: 'Einkauf', text: 'Belege, Angebote und ein Eintrag ohne Zeitangabe. Das Feld „Gelernt“ bleibt leer.', stich: 'Eingangsrechnungen kontiert und gebucht (2 Stunden)\nDrei Angebote für Büromaterial eingeholt und verglichen (1,5 Stunden)\nTelefonate geführt\nBestellung im ERP-System erfasst, 8:00 bis 9:30 Uhr', gelernt: '' },
    { id: 'fi1', beruf: 'fi', title: 'Ein Tag in der IT-Abteilung', ort: 'IT-Abteilung', text: 'Konten, Kabel und Subnetze, dazu ein vager Eintrag.', stich: 'Benutzerkonto im Active Directory eingerichtet (1 Stunde)\nPatchkabel gecrimpt und getestet (45 Minuten)\nIch habe verschiedene Aufgaben erledigt.\nIch habe Subnetze berechnet (30 Minuten)', gelernt: 'Ein Backup hilft nur, wenn man die Wiederherstellung regelmäßig testet.' },
    { id: 'vage1', beruf: 'egs', title: 'Ein Tag nur aus knappen Sätzen', ort: '', text: 'Vier sehr kurze Sätze. Was fällt dem Helfer auf?', stich: 'Habe geholfen.\nWar dabei.\nHabe zugeschaut.\nHabe Aufgaben erledigt.', gelernt: 'Viel gelernt.' },
    { id: 'zeit1', beruf: 'egs', title: 'Ein Tag mit wechselnden Zeitformen', ort: 'Prüffeld', text: 'Vier Stichpunkte, die Dauer und Fachbegriffe nennen. Achte auf die Zeitform.', stich: 'Ich habe die Ausgangsspannung am Netzteil mit dem Multimeter gemessen (1 Stunde).\nDanach prüfte ich die Sicherung (30 Minuten).\nDann habe ich den Schaltplan ergänzt (45 Minuten).\nZuletzt lötete ich ein Kabel an die Platine (45 Minuten).', gelernt: 'Ein Netzteil prüft man erst unter Last auf seine Ausgangsspannung.' }
  ];

  root.BHF_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, T, ARTQ, DAU, ALLG };
  root.BHF_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.BHF_DATA, TASKS: root.BHF_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
