'use strict';
/* Leiterplatten-Lab: Fertigungsbezug "Fehlerbild" mit der allgemeinen Modell-Linie "Linie A" (View-Id 'fehler').
   Teil A (Daten und Logik, ohne DOM, auch mit Node ladbar): window.PCB_FEHLER / module.exports
     PCB_FEHLER.STATIONEN                      die 9 Stationen der Linie A in fester Reihenfolge
     PCB_FEHLER.URSACHEN                       Katalog der Ursachen { schluessel: { t, st } } (st = Station, an der die Ursache liegt)
     PCB_FEHLER.FEHLER                         20 Fehlerbilder { id, st, gruppe, titel, symptom, ursache[], pruef[], gegen[], merk, findet[] }
     PCB_FEHLER.QUIZ                           10 Aufgaben "Von Symptom zur Ursache" (Zuordnung und Mehrfachwahl) mit Tipps und Lösungsweg
     PCB_FEHLER.pruefeQuiz(task, antwort)      -> { pct, ok, zeilen }
     PCB_FEHLER.bandDaten(aktiv, markiert)     -> Mini-Ablaufband "Station in Linie A"
     PCB_FEHLER.ausbeute(stufen)               -> Ausbeute je Stufe, kumuliert, Rolled Throughput Yield (RTY), schwächste Stufe
     PCB_FEHLER.ausbeuteStufe(gut, geprueft)   -> First-Pass-Yield einer Station aus Stückzahlen
     PCB_FEHLER.hebel(stufen)                  -> Stufe, bei der +1 Prozentpunkt den RTY am meisten hebt
     PCB_FEHLER.RUECK, betroffen(), gemeinsam() Rückverfolgbarkeit: Charge oder Seriennummer -> betroffene Baugruppen
   Teil B (Oberfläche) registriert PCB_VIEWS 'fehler' mit den Reitern Fehlerbilder, Quiz, Ausbeute, Rückverfolgung.
   WICHTIG zum Datenschutz: "Linie A" ist ein frei erfundenes Modell. Alle Zahlen sind Übungswerte, keine Werte eines Betriebs.
   Es kommen keine Namen von Firmen, Auftraggebern, Personen, Produkten oder Maschinen vor. Grenzwerte und Rezepte stehen immer in der
   jeweiligen Prüfanweisung und werden hier nicht genannt (nur qualitative Aussagen). */
(function (root) {
  /* ====================================================================================
     TEIL A: DATEN UND LOGIK (ohne DOM)
     ==================================================================================== */

  /* ---------- Die Linie A: neun Stationen, Reihenfolge fest ---------- */
  const STATIONEN = [
    { id: 'we', nr: 1, name: 'Wareneingang', kurz: 'Wareneingang', was: 'Material, Menge und Charge prüfen, Verpackung kennzeichnen, einlagern.' },
    { id: 'druck', nr: 2, name: 'Lotpastendruck', kurz: 'Druck', was: 'Lotpaste wird durch die Schablone auf die Pads gedruckt.' },
    { id: 'best', nr: 3, name: 'Bestücken', kurz: 'Bestücken', was: 'Der Automat setzt die SMD-Bauteile auf die Paste.' },
    { id: 'reflow', nr: 4, name: 'Reflow', kurz: 'Reflow', was: 'Im Ofen schmilzt die Paste, die Lötstellen entstehen.' },
    { id: 'pruef', nr: 5, name: 'Prüfen (AOI/ICT)', kurz: 'Prüfen', was: 'Kamera und Nadelbett suchen Fehler; Menschen bewerten die Meldungen nach.' },
    { id: 'lack', nr: 6, name: 'Lackieren (Schutzlack)', kurz: 'Lackieren', was: 'Abdecken, Lack auftragen, ablüften, aushärten, Sichtkontrolle.' },
    { id: 'verguss', nr: 7, name: 'Verguss (wo nötig)', kurz: 'Verguss', optional: true, was: 'Nur bei Baugruppen, die es brauchen: Vergussmasse füllen und aushärten.' },
    { id: 'end', nr: 8, name: 'Endprüfung', kurz: 'Endprüfung', was: 'Funktion und Aussehen der fertigen Baugruppe prüfen, Ergebnis dokumentieren.' },
    { id: 'versand', nr: 9, name: 'Versand', kurz: 'Versand', was: 'Freigabe prüfen, verpacken, Papiere und Kennzeichnung beilegen.' }
  ];
  const ST = {}; STATIONEN.forEach(s => { ST[s.id] = s; });
  const stationById = id => ST[id] || null;

  /* ---------- Ursachen-Katalog (Schlüssel -> Text, Station) ---------- */
  const URSACHEN = {
    /* Wareneingang */
    lager_alt: { st: 'we', t: 'Leiterplatten oder Bauteile zu lange oder ungünstig gelagert' },
    pad_oxid: { st: 'we', t: 'Lötoberfläche der Pads oxidiert oder verschmutzt' },
    lp_schicht: { st: 'we', t: 'Lötoberfläche schon fehlerhaft geliefert (zum Beispiel Schicht zu dünn oder fleckig)' },
    /* Lotpastendruck */
    schab_verstopft: { st: 'druck', t: 'Schablonenöffnung teilweise verstopft' },
    paste_trocken: { st: 'druck', t: 'Paste zu trocken oder zu lange offen auf der Schablone gestanden. Trockene Paste bleibt zuerst in den kleinsten Öffnungen hängen' },
    rakel: { st: 'druck', t: 'Rakeldruck oder Rakelgeschwindigkeit passen nicht zum Rezept' },
    schab_unten: { st: 'druck', t: 'Schablonenunterseite verschmutzt, die Schablone liegt nicht dicht auf' },
    ausricht: { st: 'druck', t: 'Platine und Schablone nicht sauber an den Passmarken ausgerichtet' },
    zuviel_paste: { st: 'druck', t: 'Schablone zu dick oder Öffnung größer als nötig, es kommt zu viel Paste auf das Pad' },
    /* Bestücken */
    pipette: { st: 'best', t: 'Pipette verschmutzt oder Unterdruck zu schwach, das Bauteil geht beim Transport verloren' },
    gurt_klemmt: { st: 'best', t: 'Bauteil sitzt im Gurtfach schief und wird nicht richtig aufgenommen' },
    rolle_leer: { st: 'best', t: 'Rolle war leer oder der Gurt gerissen, und der Platz wurde übersprungen statt nachgefüllt' },
    drehung_prog: { st: 'best', t: 'Drehwinkel im Bestückprogramm passt nicht zur Lage des Bauteils in der Zuführung' },
    gurt_lage: { st: 'best', t: 'Lieferant liefert die Bauteile im Gurt in anderer Lage als bisher' },
    pol_deutung: { st: 'best', t: 'Polaritätsmarke in den Bestückdaten falsch gedeutet' },
    bauteil_versetzt: { st: 'best', t: 'Bauteil sitzt schon vor dem Ofen außermittig auf der Paste' },
    best_druck: { st: 'best', t: 'Bauteil wird beim Aufsetzen zu tief in die Paste gedrückt (Aufsetzkraft zu hoch)' },
    bauteil_verbogen: { st: 'best', t: 'Bauteil versetzt bestückt oder Anschlüsse verbogen: Ein Anschluss liegt zwischen zwei Pads' },
    /* Reflow */
    pad_ungleich: { st: 'reflow', t: 'Beide Pads erwärmen sich ungleich (verschieden große Pads oder Kupferflächen)' },
    aufheiz_steil: { st: 'reflow', t: 'Aufheizrampe im Ofenprofil zu steil eingestellt' },
    zeit_ueber: { st: 'reflow', t: 'Zu lange oberhalb der Schmelztemperatur des Lots' },
    spitze_niedrig: { st: 'reflow', t: 'Spitzentemperatur oder Zeit über der Schmelztemperatur zu gering' },
    waermemasse: { st: 'reflow', t: 'Großes Bauteil oder Massefläche erwärmt sich langsamer als der Rest' },
    bewegt: { st: 'reflow', t: 'Baugruppe wird beim Erstarren des Lots bewegt oder erschüttert' },
    gas_flussmittel: { st: 'reflow', t: 'Gase aus dem Flussmittel können nicht rechtzeitig entweichen' },
    grosse_flaeche: { st: 'reflow', t: 'Große Lötfläche unter dem Bauteil: Das Gas hat einen langen Weg nach draußen' },
    paste_profil: { st: 'reflow', t: 'Paste und Ofenprofil passen nicht zusammen (zum Beispiel Vorwärmen zu kurz)' },
    /* Prüfen */
    aoi_streng: { st: 'pruef', t: 'Toleranzfenster im AOI-Programm zu eng eingestellt' },
    neuer_aufdruck: { st: 'pruef', t: 'Bauteil eines neuen Lieferanten hat anderen Aufdruck oder andere Farbe, das Programm kennt ihn nicht' },
    licht: { st: 'pruef', t: 'Beleuchtung oder Kamera verschmutzt oder nicht kalibriert' },
    nadel_schlecht: { st: 'pruef', t: 'Prüfnadel verbraucht oder verschmutzt' },
    flussrest: { st: 'pruef', t: 'Flussmittelrest oder Schmutz auf dem Testpunkt isoliert' },
    adapter_wackel: { st: 'pruef', t: 'Platine liegt nicht plan im Adapter, der Kontaktdruck schwankt' },
    /* Lackieren */
    lack_zu_dick: { st: 'lack', t: 'Lack in einem Durchgang zu dick aufgetragen' },
    abluft: { st: 'lack', t: 'Lösemittel konnte vor dem Aushärten nicht ausreichend ablüften' },
    lack_feuchte: { st: 'lack', t: 'Baugruppe war vor dem Lackieren noch feucht' },
    rueckstand: { st: 'lack', t: 'Fett, Silikon oder Flussmittelreste auf der Oberfläche' },
    nicht_gereinigt: { st: 'lack', t: 'Baugruppe vor dem Lackieren nicht ausreichend gereinigt oder mit bloßen Fingern angefasst' },
    lack_passt_nicht: { st: 'lack', t: 'Lack und Oberfläche vertragen sich nicht (zum Beispiel Lötstopplack oder Flussmittelrest, auf dem dieser Lack nicht hält)' },
    abdeck_fehlt: { st: 'lack', t: 'Abdeckung (Kappe, Klebeband oder Maskierlack) wurde nicht aufgebracht' },
    variante_programm: { st: 'lack', t: 'Lackierprogramm oder Maske gehört zu einer anderen Variante der Baugruppe' },
    abdeck_verrutscht: { st: 'lack', t: 'Abdeckung ist beim Auftrag verrutscht oder undicht' },
    abschatten: { st: 'lack', t: 'Hohe Bauteile schatten den Auftrag ab, Stellen dahinter bekommen zu wenig' },
    menge_gering: { st: 'lack', t: 'Auftragsmenge zu gering oder Verfahrgeschwindigkeit zu hoch' },
    lack_duenn: { st: 'lack', t: 'Lack zu dünnflüssig angesetzt, er läuft von Kanten ab' },
    menge_hoch: { st: 'lack', t: 'Auftragsmenge zu hoch oder Verfahrgeschwindigkeit zu niedrig' },
    mehrfach: { st: 'lack', t: 'Baugruppe ist zweimal durch die Anlage gelaufen' },
    lack_zaeh: { st: 'lack', t: 'Lack zu zähflüssig angesetzt' },
    mikroblasen: { st: 'lack', t: 'Winzige Luftbläschen im Lack platzen beim Aushärten auf' },
    partikel: { st: 'lack', t: 'Staub oder Partikel auf der Oberfläche verdrängen den Lack punktuell' },
    lack_nicht_ruhe: { st: 'lack', t: 'Lack nach dem Rühren oder Verdünnen nicht zur Ruhe gekommen, Bläschen schwimmen mit' },
    /* Verguss */
    hinterschnitt: { st: 'verguss', t: 'Enge Stellen unter Bauteilen: Die Masse kommt nicht überall hin' },
    fuell_schnell: { st: 'verguss', t: 'Zu schnell oder von der falschen Stelle gefüllt, die Luft kann nicht entweichen' },
    schrumpf: { st: 'verguss', t: 'Masse schrumpft beim Aushärten und zieht sich von Bauteilen zurück' },
    luft_gemischt: { st: 'verguss', t: 'Beim Mischen der Komponenten Luft eingerührt' },
    kein_vakuum: { st: 'verguss', t: 'Masse nicht entgast (kein Vakuum, zu kurze Standzeit)' },
    topfzeit: { st: 'verguss', t: 'Masse schon zu weit angezogen (Topfzeit überschritten), Bläschen steigen nicht mehr auf' },
    aushaert_heiss: { st: 'verguss', t: 'Aushärtung zu schnell oder zu heiß' },
    temp_wechsel: { st: 'verguss', t: 'Starke Temperaturwechsel: Masse und Bauteile dehnen sich verschieden stark' },
    misch_falsch: { st: 'verguss', t: 'Mischungsverhältnis der Komponenten nicht eingehalten' }
  };

  /* ---------- 20 Fehlerbilder ----------
     st = wahrscheinlichste Station, an der der Fehler entsteht (einzelne Ursachen können weiter vorn in der Linie liegen).
     findet = Stationen, an denen er üblicherweise auffällt. */
  const FEHLER = [
    { id: 'f01', st: 'we', gruppe: 'Wareneingang und Lager', titel: 'Lot benetzt schlecht, nur bei einer Charge', findet: ['pruef', 'end'],
      symptom: 'Nach dem Reflow zieht sich das Lot von einzelnen Pads zurück. Teile der Pads bleiben frei. Auffällig: Es betrifft fast nur Platinen aus einer bestimmten Leiterplatten-Charge.',
      ursache: ['lager_alt', 'pad_oxid', 'lp_schicht'],
      pruef: ['Eingangskontrolle: Verpackung, Pad-Oberfläche und Haltbarkeitsdatum ansehen.', 'Chargenvergleich: Sind nur Baugruppen mit derselben Leiterplatten-Charge betroffen?', 'Lötprobe an einer unbestückten Platine der Charge, wenn die Prüfanweisung sie vorsieht.'],
      gegen: ['Betroffene Charge sperren und beim Lieferanten reklamieren.', 'Lagern nach Vorgabe: trocken, in der Originalverpackung, älteste Ware zuerst verbrauchen.', 'Prüfumfang im Wareneingang für kritische Teile festlegen.'],
      merk: 'Tritt ein Fehler nur bei einer Charge auf, schau zuerst auf Material und Lagerung, nicht in den Ofen.' },
    { id: 'f02', st: 'druck', gruppe: 'Lotpaste und Druck', titel: 'Zu wenig Paste an einzelnen Pads', findet: ['druck', 'pruef'],
      symptom: 'Die Pastenmessung zeigt über mehrere Platinen hinweg zu wenig Volumen an denselben Pads. Später wären dort schwache oder offene Lötstellen zu erwarten.',
      ursache: ['schab_verstopft', 'paste_trocken', 'rakel'],
      pruef: ['Messdaten der Pasteninspektion (falls die Linie eine hat): Wiederholt sich die Abweichung an denselben Pads oder wandert sie?', 'Schablonenöffnungen gegen das Licht ansehen.'],
      gegen: ['Schablone reinigen und einen festen Reinigungsrhythmus einführen.', 'Paste nach Vorgabe lagern und nicht zu lange auf der Schablone stehen lassen.', 'Rakeldruck und Geschwindigkeit gegen das Rezept prüfen.'],
      merk: 'Immer dieselben Pads: Schablone. Mal hier, mal dort: Paste oder Rakel.' },
    { id: 'f03', st: 'druck', gruppe: 'Lotpaste und Druck', titel: 'Paste verschmiert, Stege zwischen Pads', findet: ['druck', 'pruef'],
      symptom: 'Zwischen eng stehenden Pads liegt Paste als Steg, die Ränder der Depots sind verschmiert. Die Platine ist noch nicht bestückt.',
      ursache: ['schab_unten', 'ausricht', 'zuviel_paste'],
      pruef: ['Sichtprüfung mit Lupe oder Bild der Pasteninspektion: Liegt der Steg immer in dieselbe Richtung? Dann spricht das für Versatz.', 'Schablonenunterseite ansehen.'],
      gegen: ['Schablonenunterseite in kurzen Abständen reinigen.', 'Ausrichtung an den Passmarken kontrollieren.', 'Bei wiederkehrendem Problem Schablonendicke und Öffnungsform mit der Entwicklung klären.'],
      merk: 'Der Druck ist nur so gut wie der Kontakt zwischen Schablone und Platine.' },
    { id: 'f04', st: 'best', gruppe: 'Bestücken', titel: 'Bauteil fehlt, Paste liegt unberührt', findet: ['pruef'],
      symptom: 'Auf einem Platz fehlt das Bauteil, die Paste liegt unberührt da. Es passiert gelegentlich und immer bei demselben Bauteiltyp.',
      ursache: ['pipette', 'gurt_klemmt', 'rolle_leer'],
      pruef: ['Fehlerprotokoll der Maschine: Welcher Zuführplatz, welche Pipette?', 'Kamera oder Sichtprüfung nach dem Bestücken meldet fehlende Teile.'],
      gegen: ['Pipetten nach Plan reinigen oder tauschen.', 'Gurte und Zuführungen kontrollieren (Abdeckfolie, Gurt richtig eingelegt).', 'Betroffene Platinen gezielt nacharbeiten.'],
      merk: 'Fehlt immer derselbe Typ, schau auf Zuführplatz und Pipette. Unberührte Paste heißt: Das Bauteil war nie da.' },
    { id: 'f05', st: 'best', gruppe: 'Bestücken', titel: 'Gepoltes Bauteil verdreht', findet: ['pruef', 'end'],
      symptom: 'Ein gepoltes Bauteil (Elko, Diode oder IC) sitzt um 90 oder 180 Grad gedreht. Die Lötstelle sieht in Ordnung aus. Alle Platinen des Auftrags haben den Fehler an derselben Stelle.',
      ursache: ['drehung_prog', 'gurt_lage', 'pol_deutung'],
      pruef: ['Optische Prüfung oder Sichtkontrolle gegen den Bestückungsdruck.', 'Bei jedem neuen Auftrag das erste Exemplar auf die Lage aller gepolten Teile prüfen.'],
      gegen: ['Drehung im Programm korrigieren, alle Platinen mit diesem Teil nacharbeiten.', 'Bei Lieferantenwechsel Erstmuster prüfen.', 'Polarität im Layout und im Bestückungsdruck eindeutig markieren.', 'Baugruppen mit verdrehten gepolten Teilen nicht einschalten. Ein verpolter Elko kann platzen.'],
      merk: 'Gleicher Fehler an gleicher Stelle auf jeder Platine: Programm oder Gurt, kein Zufall.' },
    { id: 'f06', st: 'reflow', gruppe: 'Reflow', titel: 'Tombstone (Grabstein)', findet: ['pruef'],
      symptom: 'Ein kleines Chip-Bauteil (Widerstand oder Kondensator) steht an einem Ende senkrecht oder schräg, das andere Ende ist nicht verlötet.',
      ursache: ['pad_ungleich', 'aufheiz_steil', 'bauteil_versetzt'],
      pruef: ['Optische Prüfung findet schräg stehende Teile, die Lupe bestätigt es.', 'Verteilung ansehen: Immer derselbe Bauteilplatz? Dann liegt es am Layout, am Druck oder an der Bestückung dieser Stelle. Verstreut bei vielen kleinen Bauteilen? Dann sieh dir das Ofenprofil an.'],
      gegen: ['Profil mit flacherer Rampe und ausreichender Haltephase prüfen.', 'Pads symmetrisch und thermisch gleichmäßig anbinden (Rückmeldung an die Entwicklung).', 'Pastenmenge und Bauteillage vor dem Ofen kontrollieren.'],
      merk: 'Das Ende, das zuerst schmilzt, gewinnt und zieht das Bauteil hoch.' },
    { id: 'f07', st: 'reflow', gruppe: 'Reflow', titel: 'Lötbrücke nach dem Ofen', findet: ['pruef'],
      symptom: 'Zwei benachbarte Anschlüsse eines ICs sind durch Lot verbunden. Die Pastenmessung vor dem Bestücken war unauffällig.',
      ursache: ['aufheiz_steil', 'bauteil_verbogen', 'best_druck'],
      pruef: ['Optische Prüfung; bei verdeckten Anschlüssen (unter dem Gehäuse) Röntgen, falls die Linie es hat.', 'Messdaten der Pastenmessung gegenlesen: War die Paste in Ordnung, liegt die Ursache hinter dem Druck.', 'Ofenprofil gegen das Rezept prüfen.'],
      gegen: ['Profil nachstellen und mit einer Messplatine nachmessen.', 'Aufsetzkraft des Automaten prüfen.', 'Brücke nach Nacharbeitsanweisung entfernen (zum Beispiel mit Flussmittel und Entlötlitze), danach Sichtprüfung.'],
      merk: 'War die Paste in Ordnung, ist die Brücke im Ofen oder beim Bestücken entstanden.' },
    { id: 'f08', st: 'reflow', gruppe: 'Reflow', titel: 'Kalte Lötstelle', findet: ['pruef', 'end'],
      symptom: 'Das Lot ist nicht richtig verflossen. Es sitzt wie aufgesetzt auf Pad oder Anschluss, statt eine flache Kehle zu bilden. Manchmal siehst du noch einzelne Pastenkügelchen. Elektrisch fällt die Stelle oft erst durch Wackeln oder Erwärmen auf.',
      ursache: ['spitze_niedrig', 'waermemasse', 'bewegt'],
      pruef: ['Sichtprüfung oder optische Prüfung: Oberfläche und Form der Lötstelle.', 'Messplatine mit Temperaturfühlern durch den Ofen schicken und die kälteste Stelle ansehen.'],
      gegen: ['Profil so anpassen, dass auch die langsamste Stelle genug Wärme bekommt.', 'Transport und Auslauf des Ofens ruhig halten.', 'Stelle nach Nacharbeitsanweisung nachlöten und mit der Lupe prüfen.'],
      merk: 'Schau auf Benetzung und Form, nicht auf den Glanz. Bleifreies Lot ist auch bei guten Lötstellen matt. Nicht verflossen heißt: nicht heiß genug, nicht lange genug oder beim Erstarren bewegt.' },
    { id: 'f09', st: 'reflow', gruppe: 'Reflow', titel: 'Voids (Gaseinschlüsse) in der Lötstelle', findet: ['pruef'],
      symptom: 'Im Röntgenbild zeigen sich Blasen (meist hell dargestellt) in der Lötfläche unter einem Bauteil mit großer Lötfläche. Von außen sieht die Lötstelle in Ordnung aus.',
      ursache: ['gas_flussmittel', 'grosse_flaeche', 'paste_profil'],
      pruef: ['Röntgenprüfung, wenn die Linie sie hat (meist für verdeckte oder wärmekritische Stellen).', 'Den Void-Anteil mit dem Wert aus der Prüfanweisung vergleichen: Einen allgemeinen Grenzwert gibt es hier nicht.'],
      gegen: ['Paste und Ofenprofil aufeinander abstimmen.', 'Bei großen Flächen die Aufteilung des Pads mit der Entwicklung klären.', 'Je nach Anlage kann ein Reflow unter Vakuum Gaseinschlüsse verringern.'],
      merk: 'Voids siehst du nur im Röntgenbild. Wie viele erlaubt sind, steht in der Prüfanweisung.' },
    { id: 'f10', st: 'pruef', gruppe: 'Prüfen', titel: 'Pseudofehler an der AOI', findet: ['pruef'],
      symptom: 'Die AOI meldet auf vielen Platinen dieselbe Stelle als Fehler. Der Mensch am Nachprüfplatz bewertet sie jedes Mal als in Ordnung.',
      ursache: ['aoi_streng', 'neuer_aufdruck', 'licht'],
      pruef: ['Gemeldete Stellen am Nachprüfplatz ansehen: Wie viele sind echte Fehler?', 'Vergleich mit einer Referenzplatine (Golden Board).'],
      gegen: ['Programm mit gut bewerteten Stellen nachlernen.', 'Kamera und Beleuchtung nach Plan reinigen und kalibrieren.', 'Nicht blind lockern: Echte Fehler dürfen nicht durchrutschen.', 'Viele Pseudofehler machen müde: Dann wird auch ein echter Fehler schnell durchgewinkt.'],
      merk: 'Viele Meldungen, kaum echte Fehler: Erst das Prüfprogramm ansehen, nicht den Prozess.' },
    { id: 'f11', st: 'pruef', gruppe: 'Prüfen', titel: 'Pseudofehler im elektrischen Test', findet: ['pruef'],
      symptom: 'Der Nadelbetttest meldet ein Netz als offen. Nach erneutem Einlegen derselben Platine ist alles in Ordnung.',
      ursache: ['nadel_schlecht', 'flussrest', 'adapter_wackel'],
      pruef: ['Wiederholmessung: Ist das Ergebnis nicht reproduzierbar, prüfe zuerst die Kontaktierung.', 'Meldungen nach Nadel oder Testpunkt auswerten: Immer dieselbe Nadel?', 'Fällt dieselbe Platine wieder am selben Netz auf, sieh dir die Lötstellen dieses Netzes mit der Lupe an.'],
      gegen: ['Nadeln nach Zählerstand tauschen und reinigen.', 'Testpunkte sauber halten (im Layout mit ausreichend Fläche vorsehen).', 'Auflage und Niederhalter des Adapters prüfen.', 'Wiederholungen zählen und dokumentieren. Wie oft du neu einlegen darfst, steht in der Prüfanweisung.'],
      merk: 'Nicht reproduzierbar: zuerst den Kontakt verdächtigen. Kommt der Fehler bei derselben Platine wieder, ist es die Lötstelle.' },
    { id: 'f12', st: 'lack', gruppe: 'Lackierung', titel: 'Blasen und Bläschen im Schutzlack', findet: ['lack', 'end'],
      symptom: 'Im ausgehärteten Lack sind Blasen sichtbar, besonders an Bauteilkanten und unter Bauteilen.',
      ursache: ['lack_zu_dick', 'abluft', 'lack_feuchte'],
      pruef: ['Sichtprüfung mit Lupe, bei Bedarf im Schräglicht.', 'Schichtdicke an der Stelle mit dem Verfahren der Prüfanweisung vergleichen.'],
      gegen: ['Auftragsmenge senken oder in zwei dünnen Durchgängen arbeiten.', 'Ablüft- und Trockenzeit nach dem Datenblatt des Lacks einhalten.', 'Baugruppen vor dem Lackieren trocknen.'],
      merk: 'Blasen: Etwas wollte entweichen, und der Lack war schon zu.' },
    { id: 'f13', st: 'lack', gruppe: 'Lackierung', titel: 'Benetzungsfehler, Lack zieht sich zurück', findet: ['lack', 'end'],
      symptom: 'Der Lack zieht sich an einzelnen Stellen zusammen und lässt runde oder unregelmäßige freie Flecken (Krater) zurück.',
      ursache: ['rueckstand', 'nicht_gereinigt', 'lack_passt_nicht'],
      pruef: ['Sichtprüfung: Tritt es nur auf einer Baugruppe auf oder auf der ganzen Charge?', 'Benetzungsprobe an einer Probeplatine, wenn die Prüfanweisung sie vorsieht.'],
      gegen: ['Oberfläche vor dem Lackieren reinigen und sauber handhaben (Handschuhe).', 'Silikonhaltige Stoffe aus der Nähe des Lackierbereichs fernhalten.', 'Verträglichkeit von Lack-Charge und Oberfläche klären.'],
      merk: 'Zieht sich der Lack zurück, war die Oberfläche meist nicht sauber.' },
    { id: 'f14', st: 'lack', gruppe: 'Lackierung', titel: 'Abdeckung vergessen, Steckerbereich verlackt', findet: ['lack', 'end'],
      symptom: 'Kontakte eines Steckers oder ein Testpunkt sind mit Lack überzogen. Im Funktionstest fällt die Verbindung aus oder sie wackelt.',
      ursache: ['abdeck_fehlt', 'variante_programm', 'abdeck_verrutscht'],
      pruef: ['Sichtkontrolle der Sperrzonen nach dem Lackieren mit Checkliste (Stecker, Taster, Messpunkte).', 'Funktionstest an den Steckern.'],
      gegen: ['Abdecken als eigenen Prüfpunkt in den Laufzettel aufnehmen.', 'Programm und Variante beim Start per Scan abgleichen.', 'Verlackte Kontakte nach Vorgabe nacharbeiten oder aussondern.'],
      merk: 'Alles, was später kontaktieren soll, wird vor dem Lack abgedeckt.' },
    { id: 'f15', st: 'lack', gruppe: 'Lackierung', titel: 'Schicht zu dünn', findet: ['lack'],
      symptom: 'An Bauteilkanten, Pin-Spitzen oder hinter hohen Bauteilen ist der Lack kaum zu sehen oder fehlt. Die Schicht wirkt ungleichmäßig.',
      ursache: ['abschatten', 'menge_gering', 'lack_duenn'],
      pruef: ['Schichtdicke an den kritischen Stellen nach der Prüfanweisung messen.', 'Kanten und Stellen hinter hohen Bauteilen gezielt ansehen.'],
      gegen: ['Auftragsweg und Winkel anpassen, bei Bedarf in zwei Richtungen auftragen.', 'Menge und Geschwindigkeit gegen das Rezept prüfen.', 'Zustand und Mischung des Lacks nach Datenblatt kontrollieren.'],
      merk: 'Kanten sind die Schwachstelle: Dort läuft der Lack ab und dort fehlt er zuerst.' },
    { id: 'f16', st: 'lack', gruppe: 'Lackierung', titel: 'Schicht zu dick', findet: ['lack', 'end'],
      symptom: 'Der Lack bildet Pfützen oder Läufer, füllt Spalten und verklebt Bereiche, die frei bleiben sollen. Nach dem Aushärten kann er aufreißen. Dicker Lack kann bei Temperaturwechsel auch Bauteile und Lötstellen belasten.',
      ursache: ['menge_hoch', 'mehrfach', 'lack_zaeh'],
      pruef: ['Schichtdicke messen und Bereiche prüfen, die frei bleiben sollen.', 'Laufzettel ansehen: Gab es einen zweiten Durchlauf?'],
      gegen: ['Menge und Geschwindigkeit gegen das Rezept prüfen.', 'Doppelte Durchläufe durch einen Scan am Anlageneingang verhindern.', 'Lack nach Datenblatt ansetzen.'],
      merk: 'Mehr Lack ist nicht mehr Schutz: Zu dick reißt und verklebt Spalten.' },
    { id: 'f17', st: 'lack', gruppe: 'Lackierung', titel: 'Nadellöcher (Pinholes) im Lack', findet: ['lack', 'end'],
      symptom: 'Winzige punktförmige Löcher im Lack, oft in kleinen Gruppen. Mit bloßem Auge kaum zu sehen, unter Lupe oder im Schräglicht erkennbar.',
      ursache: ['mikroblasen', 'partikel', 'lack_nicht_ruhe'],
      pruef: ['Lupe und Schräglicht; weitere Prüfungen der Isolation nur nach Prüfanweisung.', 'Prüfen, ob die Löcher an die gleichen Stellen oder zufällig verteilt auftreten.'],
      gegen: ['Lack nach dem Rühren ruhen lassen.', 'Staubarm arbeiten. Oberfläche vor dem Auftrag reinigen oder nur mit ölfreier, ionisierter Luft abblasen.', 'Düse und Auftragsdruck prüfen.'],
      merk: 'Nadellöcher sind Lücken im Schutz: Feuchtigkeit kann sie nutzen.' },
    { id: 'f18', st: 'verguss', gruppe: 'Verguss', titel: 'Lunker (Hohlräume) in der Vergussmasse', findet: ['verguss', 'end'],
      symptom: 'Beim Aufschneiden einer Stichprobe oder im Röntgenbild zeigt sich ein Hohlraum unter einem Bauteil oder in einer Ecke des Gehäuses.',
      ursache: ['hinterschnitt', 'fuell_schnell', 'schrumpf'],
      pruef: ['Sichtprüfung durch die Gehäuseöffnung (Füllstand, Oberfläche).', 'Stichprobe nach Prüfanweisung: Schnitt oder Röntgenbild; Gewicht je Baugruppe vergleichen.'],
      gegen: ['Füllweg und Füllgeschwindigkeit anpassen (langsam, von der tiefsten Stelle aus).', 'Mit der Entwicklung klären, ob Kanäle für die Masse vorgesehen werden können.', 'Falls die Anlage es kann, unter Vakuum vergießen.'],
      merk: 'Lunker entstehen dort, wo die Masse nicht hinfließt oder sich zurückzieht.' },
    { id: 'f19', st: 'verguss', gruppe: 'Verguss', titel: 'Luftblasen in der Vergussmasse', findet: ['verguss'],
      symptom: 'Die Masse enthält viele kleine Bläschen, oft schon beim Einfüllen sichtbar. In durchsichtiger Masse sehen sie aus wie Perlen.',
      ursache: ['luft_gemischt', 'kein_vakuum', 'topfzeit'],
      pruef: ['Sichtprüfung beim Füllen und nach dem Aushärten.', 'Probeverguss in einem durchsichtigen Gefäß.', 'Entstehen die Blasen erst beim Aushärten: Feuchte in der Masse oder auf der Baugruppe? Manche Massen (zum Beispiel Polyurethan) bilden damit beim Aushärten Gas.'],
      gegen: ['Langsam mischen und nach Datenblatt entgasen.', 'Die Topfzeit der angesetzten Masse beachten.', 'Fülldüse und Schlauch auf Lufteinzug prüfen.', 'Gebinde nach dem Entnehmen sofort verschließen. Baugruppen trocken vergießen.'],
      merk: 'Luftblasen stammen meist vom Mischen und Füllen. Entstehen sie erst beim Aushärten, denk an Feuchtigkeit.' },
    { id: 'f20', st: 'verguss', gruppe: 'Verguss', titel: 'Risse in der Vergussmasse', findet: ['verguss', 'end'],
      symptom: 'Nach dem Aushärten oder nach einem Temperaturwechsel verläuft ein Riss durch die Masse, oft von einer Bauteilkante aus.',
      ursache: ['aushaert_heiss', 'temp_wechsel', 'misch_falsch'],
      pruef: ['Sichtprüfung; den Zeitpunkt notieren (direkt nach dem Aushärten oder erst nach Temperaturbelastung).', 'Mischungsverhältnis und Chargen der Komponenten im Laufzettel prüfen.'],
      gegen: ['Aushärteprofil (Temperatur und Zeit) nach Datenblatt einhalten.', 'Mit der Entwicklung klären, ob eine elastischere Masse besser passt.', 'Komponenten genau dosieren.'],
      merk: 'Risse sind Spannungen: Die schwächste Stelle gibt beim Aushärten oder bei Wärmeausdehnung nach.' }
  ];
  /* Arbeitsschutz-Hinweis, wird bei den Gruppen Lackierung und Verguss angezeigt (keine Grenzwerte, keine Produktnamen) */
  const ARBEITSSCHUTZ = 'Arbeitsschutz: Lacke, Lösemittel und Vergussmassen sind Gefahrstoffe. Arbeite nur mit eingeschalteter Absaugung. Trage Handschuhe und Schutzbrille nach Betriebsanweisung. Viele Lösemittel sind brennbar: keine Zündquellen. Harze und Härter können Allergien auslösen: kein Hautkontakt. Lies vorher die Betriebsanweisung und frag deinen Ausbilder.';
  const FB = {}; FEHLER.forEach(f => { FB[f.id] = f; });
  const fehlerBild = id => FB[id] || null;
  const nachStation = st => FEHLER.filter(f => f.st === st);

  /* ---------- Mini-Ablaufband "Station in Linie A" ----------
     aktiv: Stationen-Id oder Array (hervorgehoben), markiert: Array (zusätzlich markiert, zum Beispiel "hier fällt es auf") */
  function bandDaten(aktiv, markiert) {
    const a = Array.isArray(aktiv) ? aktiv : aktiv ? [aktiv] : [], m = Array.isArray(markiert) ? markiert : markiert ? [markiert] : [];
    return STATIONEN.map(s => ({ id: s.id, nr: s.nr, name: s.name, kurz: s.kurz, optional: !!s.optional, aktiv: a.indexOf(s.id) >= 0, markiert: m.indexOf(s.id) >= 0 }));
  }

  /* ---------- Quiz "Von Symptom zur Ursache" ---------- */
  const STAGE = 'Von Symptom zur Ursache';
  const MATCH_HINT1 = 'Gehe die Linie A von vorn nach hinten durch: Ein Fehler kann nur dort entstehen, wo die Baugruppe bearbeitet wird. Was geschieht an welcher Station?';
  const MULTI_HINT1 = 'Frage dich zuerst: Was geschieht an dieser Stelle physikalisch, und welche Station der Linie beeinflusst das? Streiche zuerst alles, was zu einer ganz anderen Station gehört.';
  const stText = id => (ST[id] ? ST[id].name : id);
  function mkMatch(id, level, title, fids, pool, extra) {
    const sol = {}; fids.forEach(f => { sol[f] = FB[f].st; });
    const first = fids[0];
    return Object.assign({
      id, cat: STAGE, art: 'match', title, level, items: fids.slice(), pool: pool.slice(), sol,
      text: 'Ordne jedem Symptom die Station zu, an der der Fehler wahrscheinlich entsteht. Ein Fehler kann später auffallen als er entsteht: Frage nach der Entstehung.',
      hint: [MATCH_HINT1, 'Stichworte zum Nachdenken: ' + fids.map(f => FB[f].titel).join(' / ') + '. Zu welcher Tätigkeit der Linie gehört jedes davon?', 'Das Symptom „' + FB[first].titel + '“ gehört zur Station „' + stText(FB[first].st) + '“. Mit diesem Anker findest du die Reihenfolge der übrigen.'],
      weg: fids.map(f => FB[f].titel + ' → ' + stText(FB[f].st) + '. ' + FB[f].merk)
    }, extra || {});
  }
  function mkMulti(id, level, title, fid, options, extra) {
    const f = FB[fid], sol = options.filter(k => f.ursache.indexOf(k) >= 0), good = sol[0];
    return Object.assign({
      id, cat: STAGE, art: 'multi', title, level, fault: fid, options: options.slice(), sol,
      text: 'Fehlerbild: „' + f.titel + '“. ' + f.symptom + ' Welche der folgenden Ursachen können dafür in Frage kommen? Wähle alle zutreffenden.',
      hint: [MULTI_HINT1, 'Merkregel zu diesem Fehlerbild: ' + f.merk, 'Eine der richtigen Antworten lautet: „' + URSACHEN[good].t + '“. Die übrigen findest du im selben Umfeld.'],
      weg: options.map(k => (sol.indexOf(k) >= 0 ? 'Richtig: ' : 'Passt nicht: ') + URSACHEN[k].t + (sol.indexOf(k) >= 0 ? '.' : URSACHEN[k].st === f.st ? '. Das gehört zwar zur selben Station, führt aber zu einem anderen Fehlerbild.' : '. Das gehört zur Station „' + stText(URSACHEN[k].st) + '“ und erklärt dieses Fehlerbild nicht.'))
    }, extra || {});
  }
  /* fq3: Jede Station genau einmal. Die Lötbrücke (f07) kann auch beim Bestücken entstehen; hier gehört das verdrehte Bauteil (f05) eindeutig dorthin. */
  const FQ3 = {
    text: 'Ordne jedem Symptom die Station zu, an der der Fehler wahrscheinlich entsteht. Ein Fehler kann später auffallen als er entsteht: Frage nach der Entstehung. Jede Station kommt genau einmal vor.',
    weg: ['f03', 'f07', 'f10', 'f05'].map(f => FB[f].titel + ' → ' + stText(FB[f].st) + '. ' + FB[f].merk + (f === 'f07' ? ' Die Brücke kann auch beim Bestücken entstehen. Hier bleibt für sie nur der Ofen, weil das verdrehte Bauteil eindeutig zum Bestücken gehört.' : ''))
  };
  const QUIZ = [
    mkMatch('fq1', 1, 'Drei Symptome, drei Stationen', ['f02', 'f04', 'f08'], ['druck', 'best', 'reflow']),
    mkMatch('fq2', 1, 'Vom Lager bis zum Verguss', ['f06', 'f12', 'f19', 'f01'], ['we', 'reflow', 'lack', 'verguss']),
    mkMatch('fq3', 2, 'Brücke ist nicht gleich Brücke', ['f03', 'f07', 'f10', 'f05'], ['druck', 'best', 'reflow', 'pruef'], FQ3),
    mkMatch('fq4', 2, 'Vor und hinter dem Ofen', ['f14', 'f20', 'f11', 'f04'], ['best', 'pruef', 'lack', 'verguss']),
    mkMatch('fq5', 3, 'Alle neun Stationen im Blick', ['f01', 'f02', 'f09', 'f17', 'f18'], STATIONEN.map(s => s.id)),
    mkMulti('fq6', 1, 'Ursachen für den Grabstein', 'f06', ['pad_ungleich', 'aufheiz_steil', 'abluft', 'kein_vakuum', 'nadel_schlecht']),
    mkMulti('fq7', 2, 'Ursachen für den Benetzungsfehler im Lack', 'f13', ['rueckstand', 'nicht_gereinigt', 'lack_zu_dick', 'abschatten', 'fuell_schnell', 'pipette']),
    mkMulti('fq8', 2, 'Ursachen für die kalte Lötstelle', 'f08', ['spitze_niedrig', 'waermemasse', 'bewegt', 'zeit_ueber', 'lack_zu_dick', 'mikroblasen']),
    mkMulti('fq9', 3, 'Ursachen für Risse im Verguss', 'f20', ['aushaert_heiss', 'temp_wechsel', 'misch_falsch', 'luft_gemischt', 'rueckstand', 'pipette']),
    mkMulti('fq10', 2, 'Ursachen für Pseudofehler der AOI', 'f10', ['aoi_streng', 'neuer_aufdruck', 'licht', 'nadel_schlecht', 'schab_verstopft', 'aufheiz_steil'])
  ];
  const quizById = id => QUIZ.find(q => q.id === id) || null;

  /* antwort: match -> { fehlerId: stationId }, multi -> [schlüssel] ; liefert { pct, ok, zeilen:[{ok,text}] } */
  function pruefeQuiz(task, antwort) {
    if (!task) return { pct: 0, ok: false, zeilen: [] };
    const zeilen = [];
    if (task.art === 'match') {
      const a = antwort && typeof antwort === 'object' ? antwort : {};
      task.items.forEach(f => { const ok = a[f] === task.sol[f]; zeilen.push({ ok, text: FB[f].titel + ': ' + (a[f] ? stText(a[f]) : 'keine Antwort') }); });
      const n = zeilen.filter(z => z.ok).length, pct = Math.round(100 * n / task.items.length);
      return { pct, ok: pct === 100, zeilen };
    }
    const a = Array.isArray(antwort) ? antwort : [];
    let hit = 0, wrong = 0;
    task.options.forEach(k => { const want = task.sol.indexOf(k) >= 0, got = a.indexOf(k) >= 0; if (want && got) hit++; if (!want && got) wrong++; zeilen.push({ ok: want === got, text: URSACHEN[k].t }); });
    const pct = Math.max(0, Math.round(100 * (hit - wrong) / task.sol.length));
    return { pct, ok: hit === task.sol.length && wrong === 0, zeilen };
  }

  /* ---------- Ausbeute (First-Pass-Yield je Station, Rolled Throughput Yield der Linie) ---------- */
  const round = (v, d) => { const p = Math.pow(10, d == null ? 0 : d); return Math.round(v * p) / p; };
  const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
  function ausbeuteStufe(gut, geprueft) { return geprueft > 0 ? clamp01(gut / geprueft) : 0; }
  /* Übungswerte (Modell, keine Betriebsdaten): Anteil, der die Station beim ersten Durchlauf besteht */
  const UEBUNG_AUSBEUTE = [
    { id: 'druck', y: 0.992 }, { id: 'best', y: 0.995 }, { id: 'reflow', y: 0.99 }, { id: 'pruef', y: 0.98 },
    { id: 'lack', y: 0.99 }, { id: 'verguss', y: 0.985, optional: true }, { id: 'end', y: 0.993 }
  ];
  /* stufen: [{ id, y (0..1), aus (true = Station wird nicht durchlaufen) }] */
  function ausbeute(stufen, start) {
    const n0 = start == null ? 1000 : start;
    let kum = 1; const zeilen = [];
    (stufen || []).forEach(s => {
      const y = clamp01(s.y), aktiv = !s.aus;
      if (aktiv) kum *= y;
      zeilen.push({ id: s.id, y, aktiv, kum, stueck: n0 * kum, nacharbeit: aktiv ? n0 * kum / y * (1 - y) : 0 });
    });
    const akt = zeilen.filter(z => z.aktiv);
    let schwach = null; akt.forEach(z => { if (!schwach || z.y < schwach.y) schwach = z; });
    return { zeilen, rty: kum, ohneNacharbeit: n0 * kum, nacharbeit: n0 * (1 - kum), start: n0, schwaechste: schwach ? schwach.id : null };
  }
  /* Hebel: Welche Station verbessert den RTY bei +1 Prozentpunkt am meisten? (nur aktive Stufen, y wird auf 1 begrenzt) */
  function hebel(stufen) {
    const base = ausbeute(stufen).rty; let best = null;
    (stufen || []).forEach((s, i) => {
      if (s.aus) return;
      const copy = stufen.map((t, j) => (j === i ? Object.assign({}, t, { y: Math.min(1, clamp01(t.y) + 0.01) }) : t)), gain = ausbeute(copy).rty - base;
      if (!best || gain > best.gain + 1e-12) best = { id: s.id, gain };
    });
    return best;
  }
  /* feste Übung: fünf Stufen */
  const UEBUNG_RTY = { stufen: [{ id: 'druck', y: 0.98 }, { id: 'best', y: 0.99 }, { id: 'reflow', y: 0.97 }, { id: 'pruef', y: 0.995 }, { id: 'lack', y: 0.985 }], tol: 0.1 };

  /* ---------- Rückverfolgbarkeit (Übungsdaten, frei erfunden) ----------
     Drei Ebenen nicht vermischen: Charge (Los, vom Hersteller unter gleichen Bedingungen gefertigt), Verpackungs-ID (Gebinde), Seriennummer (einzelne Baugruppe). */
  const RUECK = {
    felder: [
      { k: 'lp', name: 'Leiterplatten-Charge', kurz: 'LP', st: 'we' },
      { k: 'pa', name: 'Pasten-Charge', kurz: 'Paste', st: 'druck' },
      { k: 'ko', name: 'Kondensator-Charge', kurz: 'Kond.', st: 'we' },
      { k: 'of', name: 'Ofenlauf (Los)', kurz: 'Ofen', st: 'reflow' },
      { k: 'lk', name: 'Lack-Charge', kurz: 'Lack', st: 'lack' },
      { k: 'vg', name: 'Vergussmasse-Charge', kurz: 'Verg.', st: 'verguss' }
    ],
    zeilen: [
      { sn: '1001', lp: 'LP1', pa: 'PA1', ko: 'KO1', of: 'R1', lk: 'LK1', vg: null },
      { sn: '1002', lp: 'LP1', pa: 'PA1', ko: 'KO2', of: 'R1', lk: 'LK1', vg: null },
      { sn: '1003', lp: 'LP1', pa: 'PA1', ko: 'KO2', of: 'R1', lk: 'LK2', vg: 'V1' },
      { sn: '1004', lp: 'LP1', pa: 'PA2', ko: 'KO1', of: 'R2', lk: 'LK2', vg: 'V1' },
      { sn: '1005', lp: 'LP2', pa: 'PA2', ko: 'KO1', of: 'R2', lk: 'LK2', vg: 'V1' },
      { sn: '1006', lp: 'LP2', pa: 'PA2', ko: 'KO2', of: 'R2', lk: 'LK1', vg: 'V2' },
      { sn: '1007', lp: 'LP2', pa: 'PA2', ko: 'KO3', of: 'R3', lk: 'LK1', vg: 'V2' },
      { sn: '1008', lp: 'LP2', pa: 'PA3', ko: 'KO3', of: 'R3', lk: 'LK3', vg: null },
      { sn: '1009', lp: 'LP3', pa: 'PA3', ko: 'KO3', of: 'R3', lk: 'LK3', vg: null },
      { sn: '1010', lp: 'LP3', pa: 'PA3', ko: 'KO1', of: 'R4', lk: 'LK3', vg: 'V2' },
      { sn: '1011', lp: 'LP3', pa: 'PA3', ko: 'KO2', of: 'R4', lk: 'LK2', vg: 'V2' },
      { sn: '1012', lp: 'LP3', pa: 'PA1', ko: 'KO3', of: 'R4', lk: 'LK1', vg: 'V1' }
    ],
    /* Übung: Bei diesen vier Baugruppen sind Blasen im Lack aufgefallen. Welches Merkmal haben alle gemeinsam? */
    uebung: { auffaellig: ['1003', '1004', '1005', '1011'], antwort: { k: 'lk', wert: 'LK2' } }
  };
  /* Welche Baugruppen tragen Merkmal k = wert? (Rückruf-Richtung: von der Charge zu den Seriennummern) */
  function betroffen(daten, k, wert) { return (daten.zeilen || []).filter(z => z[k] === wert).map(z => z.sn); }
  /* Welche Merkmale haben alle auffälligen Baugruppen gemeinsam? (Eingrenzen: von den Seriennummern zur Charge) */
  function gemeinsam(daten, snListe) {
    const rows = (daten.zeilen || []).filter(z => (snListe || []).indexOf(z.sn) >= 0), out = [];
    if (!rows.length) return out;
    (daten.felder || []).forEach(f => { const v = rows[0][f.k]; if (v != null && rows.every(r => r[f.k] === v)) out.push({ k: f.k, wert: v, name: f.name }); });
    return out;
  }
  /* Merkmalswerte eines Feldes */
  const werte = (daten, k) => { const s = []; (daten.zeilen || []).forEach(z => { if (z[k] != null && s.indexOf(z[k]) < 0) s.push(z[k]); }); return s.sort(); };

  /* ---------- Quiz-Stand ----------
     Der Stand liegt in lm4.pcbquiz = { fq1: 100, eq3: 67, ... } (gemeinsam mit dem ESD-Quiz). Das Präfix lm4. gehört zur Lernstand-Sicherung der App
     (lernstand.js, Datei-Sicherung; Zahlen werden beim Einlesen mit dem höchsten Wert zusammengeführt). Der alte Schlüssel pcb.fehler.quiz wurde nicht
     gesichert: Er wird einmal übernommen (höchster Wert zählt) und erst gelöscht, wenn der neue Stand sicher geschrieben ist. speicher = localStorage oder Ersatz. */
  const QUIZ_KEY = 'lm4.pcbquiz', QUIZ_ALT = 'pcb.fehler.quiz', QUIZ_ID = /^fq\d+$/;
  function standRoh(speicher) {
    let d = null; try { d = JSON.parse(speicher.getItem(QUIZ_KEY) || '{}'); } catch (e) { d = null; }
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  }
  function quizUebernehmen(speicher) {
    try {
      const alt = speicher.getItem(QUIZ_ALT); if (alt == null) return false;
      let a = null; try { a = JSON.parse(alt); } catch (e) { a = null; }
      const d = standRoh(speicher); let neu = false;
      if (a && typeof a === 'object' && !Array.isArray(a)) Object.keys(a).forEach(k => { const v = +a[k]; if (QUIZ_ID.test(k) && isFinite(v) && v > (+d[k] || 0)) { d[k] = Math.min(100, Math.round(v)); neu = true; } });
      if (neu) { const txt = JSON.stringify(d); speicher.setItem(QUIZ_KEY, txt); if (speicher.getItem(QUIZ_KEY) !== txt) return false; }
      speicher.removeItem(QUIZ_ALT); return true;
    } catch (e) { return false; }
  }
  /* liefert { fq1: pct, ... } nur für die Fragen dieses Quiz */
  function quizStand(speicher) {
    const out = {}; if (!speicher) return out;
    quizUebernehmen(speicher);
    const d = standRoh(speicher); QUIZ.forEach(q => { const v = +d[q.id]; if (isFinite(v) && v > 0) out[q.id] = v; });
    return out;
  }
  function quizMerken(speicher, id, pct) {
    if (!speicher || !quizById(id) || !(pct > 0)) return false;
    try { const d = standRoh(speicher); if ((+d[id] || 0) >= pct) return false; d[id] = Math.min(100, Math.round(pct)); speicher.setItem(QUIZ_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  function quizLeeren(speicher) {
    if (!speicher) return;
    try { const d = standRoh(speicher); QUIZ.forEach(q => { delete d[q.id]; }); speicher.setItem(QUIZ_KEY, JSON.stringify(d)); } catch (e) { /* egal */ }
  }
  /* Lösung zeigen (wie im Linien-Lab, fliui.js): Wer die Lösung aufdeckt, bevor die Frage voll gelöst ist, bekommt für das nächste richtige Lösen
     AUF_PCT Prozent. Der Merker lm4.pcbquiz.auf = { id: 1 } wird nur gesetzt, solange der beste Wert unter 100 liegt, und beim nächsten richtigen Lösen
     gelöscht (danach zählt die Frage wieder voll). Der beste Wert bleibt immer erhalten. Tipps kosten im Quiz nichts. */
  const AUF_KEY = 'lm4.pcbquiz.auf', AUF_PCT = 25;
  function aufRoh(speicher) {
    let d = null; try { d = JSON.parse(speicher.getItem(AUF_KEY) || '{}'); } catch (e) { d = null; }
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  }
  const quizAufgedeckt = (speicher, id) => { try { return !!(speicher && aufRoh(speicher)[id]); } catch (e) { return false; } };
  function quizAufdecken(speicher, id) {
    if (!speicher || !quizById(id)) return false;
    try { if ((+standRoh(speicher)[id] || 0) >= 100) return false; const m = aufRoh(speicher); m[id] = 1; speicher.setItem(AUF_KEY, JSON.stringify(m)); return true; } catch (e) { return false; }
  }
  /* Ergebnis r = pruefeQuiz(...) werten: liefert { pct (gezählter Wert), auf (Lösung war aufgedeckt) } und speichert den besten Wert */
  function quizZaehlen(speicher, id, r) {
    const auf = quizAufgedeckt(speicher, id), pct = auf ? Math.min(r.pct, AUF_PCT) : r.pct;
    if (pct > 0) quizMerken(speicher, id, pct);
    if (auf && r.ok) { try { const m = aufRoh(speicher); delete m[id]; speicher.setItem(AUF_KEY, JSON.stringify(m)); } catch (e) { /* egal */ } }
    return { pct, auf };
  }
  /* nächste noch nicht gelöste Frage nach id (am Ende wieder von vorn), sonst null */
  function quizNaechste(stand, id) {
    const i = QUIZ.findIndex(q => q.id === id);
    for (let k = 1; k < QUIZ.length; k++) { const q = QUIZ[(i + k) % QUIZ.length]; if (!((stand && stand[q.id]) >= 100)) return q.id; }
    return null;
  }
  /* Sprechtext einer Frage wie bei den Aufgabenkarten (Vorlesen.Texte.au): Titel und Auftrag, ohne Antworten, Tipps und Lösungsweg. Schlüssel AU_pcb_<id>. */
  const sprechKey = id => 'AU_pcb_' + id;

  const api = {
    version: '1.1', QUIZ_KEY, QUIZ_ALT, quizStand, quizMerken, quizLeeren, quizUebernehmen, quizNaechste, sprechKey, AUF_KEY, AUF_PCT, quizAufgedeckt, quizAufdecken, quizZaehlen, ARBEITSSCHUTZ, STATIONEN, URSACHEN, FEHLER, QUIZ, STAGE, stationById, fehlerBild, nachStation, quizById, bandDaten, pruefeQuiz,
    ausbeute, ausbeuteStufe, hebel, UEBUNG_AUSBEUTE, UEBUNG_RTY, RUECK, betroffen, gemeinsam, werte
  };
  root.PCB_FEHLER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ====================================================================================
     TEIL B: OBERFLÄCHE (nur im Browser)
     ==================================================================================== */
  function installUi() {
    root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
    const doc = root.document;
    const lsGet = (k, d) => { try { const v = root.localStorage.getItem('pcb.fehler.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
    const lsSet = (k, v) => { try { root.localStorage.setItem('pcb.fehler.' + k, JSON.stringify(v)); } catch (e) { /* egal */ } };
    const fm = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
    function h(tag, attrs, kids) {
      const e = doc.createElement(tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k]; if (v == null || v === false) continue;
        if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
      }
      (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
      return e;
    }
    /* Farben aus den Variablen der Seite (dunkel und hell), mit festen Rückfallwerten */
    const CSS = `
.pfb{position:relative;display:flex;flex-direction:column;height:100%;min-height:380px;background:var(--bg,#14181c);color:var(--fg,#e8ecf0);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;-webkit-user-select:text;user-select:text}
.pfb *{box-sizing:border-box}
.pfb-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:6px;padding:8px;background:var(--panel,#222830);border-bottom:1px solid var(--line,#38424d);flex:0 0 auto}
.pfb-tab{flex:0 0 auto;min-height:44px;padding:0 16px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:22px;font-weight:600;font-size:15px;line-height:1.2;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pfb-tabs::-webkit-scrollbar{display:none}
.pfb-tab{white-space:nowrap}
.pfb-vl{min-height:56px;display:flex;align-items:center}
.pfb-vl[hidden],.pfb-btn[hidden]{display:none}
.pfb-vl .vl-btn{margin:6px 0}
.pfb-opts{margin:0;padding:0;border:0}
.pfb-tab.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pfb-body{flex:1 1 auto;overflow:auto;overflow-x:hidden;padding:10px 12px 28px;-webkit-overflow-scrolling:touch}
.pfb-wrap{width:100%;max-width:980px;margin:0 auto}
.pfb-card{background:var(--panel,#222830);border:1px solid var(--line,#38424d);border-radius:12px;padding:12px 14px;margin-bottom:12px;min-width:0}
.pfb-card h3{margin:0 0 6px;font-size:17px;line-height:1.3}
.pfb-card h4{margin:12px 0 4px;font-size:15px;color:var(--mute,#8d99a6)}
.pfb-card p{margin:0 0 8px}
.pfb-card ul{margin:0 0 8px;padding-left:20px}
.pfb-card li{margin:2px 0}
.pfb-mute{color:var(--mute,#8d99a6);font-size:14px}
.pfb-note{border-left:4px solid var(--accent-bg,#1a6fd4);background:var(--panel2,#2c343e);padding:8px 12px;border-radius:0 8px 8px 0;margin:8px 0}
.pfb-note.ok{border-color:var(--ok,#4cd964)}.pfb-note.warn{border-color:var(--warn,#ffb340)}.pfb-note.err{border-color:var(--danger,#ff5c5c)}
.pfb-band{list-style:none;margin:6px 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pfb-band li,.pfb-band button{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:2px 10px;border:1px solid var(--line,#38424d);border-radius:17px;background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);font-size:14px;line-height:1.2;font-family:inherit;white-space:nowrap}
.pfb-band .nr{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:11px;background:var(--bg,#14181c);font-weight:700;font-size:14px}
.pfb-band .on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff;font-weight:700}
.pfb-band .on .nr{background:var(--pfb-nr-on,rgba(0,0,0,.28))}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]) .pfb{--pfb-nr-on:rgba(255,255,255,.14)}}
:root[data-theme=light] .pfb{--pfb-nr-on:rgba(255,255,255,.14)}
.pfb-band .mk{border-color:var(--warn,#ffb340);box-shadow:inset 0 0 0 1px var(--warn,#ffb340)}
.pfb-band .opt{border-style:dashed}
.pfb-band button{min-height:44px;cursor:pointer;touch-action:manipulation}
.pfb-legend{font-size:14px;color:var(--mute,#8d99a6);margin:2px 0 8px}
.pfb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 16px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:12px;font-weight:600;font-size:15px;line-height:1.2;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pfb-btn.pri{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pfb-btn:disabled{opacity:1;cursor:default;background:transparent;color:var(--mute,#8d99a6);border-style:dashed}
.pfb-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.pfb-acc{border:1px solid var(--line,#38424d);border-radius:12px;background:var(--panel,#222830);margin-bottom:10px}
.pfb-acc>summary{min-height:48px;display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;padding:6px 12px;font-weight:700}
.pfb-acc>summary::-webkit-details-marker{display:none}
.pfb-acc>summary::before{content:"\\203A";font-size:22px;width:14px;text-align:center;color:var(--accent,#3b9eff);transition:transform .15s;flex:none}
.pfb-acc[open]>summary::before{transform:rotate(90deg)}
.pfb-acc .sum{flex:1;min-width:0}
.pfb-acc .sum small{display:block;font-weight:500;color:var(--mute,#8d99a6);font-size:14px}
.pfb-acc>.in{padding:0 14px 12px}
.pfb-acc h4{margin:12px 0 4px;font-size:15px;color:var(--mute,#8d99a6)}
.pfb-acc ul{margin:0 0 6px;padding-left:20px}
.pfb-acc li{margin:2px 0}
.pfb-pill{display:inline-block;border-radius:12px;padding:1px 10px;font-size:14px;font-weight:700;background:var(--panel2,#2c343e);border:1px solid var(--line,#38424d);color:var(--fg,#e8ecf0);flex:none}
.pfb-pill.ok{color:var(--ok,#4cd964);border-color:var(--ok,#4cd964)}
.pfb-q select,.pfb-in{width:100%;min-height:44px;font-size:16px;font-family:inherit;color:var(--fg,#e8ecf0);background:var(--bg,#14181c);border:1px solid var(--line,#38424d);border-radius:10px;padding:6px 10px}
.pfb-it{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:8px 0;border-top:1px solid var(--line,#38424d)}
.pfb-it:first-of-type{border-top:0}
.pfb-opt{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;min-height:44px;margin:6px 0 0;padding:8px 12px;border:1px solid var(--line,#38424d);background:var(--panel2,#2c343e);color:var(--fg,#e8ecf0);border-radius:10px;font-size:15px;line-height:1.4;font-family:inherit;cursor:pointer;touch-action:manipulation}
.pfb-opt .bx{flex:none;width:22px;height:22px;border:2px solid var(--mute,#8d99a6);border-radius:6px;display:inline-grid;place-items:center;font-size:15px;line-height:1;margin-top:1px}
.pfb-opt.sel{border-color:var(--accent-bg,#1a6fd4);background:var(--panel,#222830)}
.pfb-opt.sel .bx{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.pfb-mark{font-weight:700}.pfb-mark.ok{color:var(--ok,#4cd964)}.pfb-mark.bad{color:var(--danger,#ff5c5c)}
.pfb-sl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#38424d)}
.pfb-sl:first-of-type{border-top:0}
.pfb-sl label{font-weight:600}
.pfb-sl output{font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent,#3b9eff);min-width:64px;text-align:right}
.pfb-sl input[type=range]{grid-column:1/3;width:100%;height:44px;margin:0;touch-action:pan-y;accent-color:var(--accent-bg,#1a6fd4)}
.pfb-chk{display:inline-flex;align-items:center;gap:8px;min-height:44px}
.pfb-chk input{width:24px;height:24px;accent-color:var(--accent-bg,#1a6fd4)}
.pfb-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;margin:8px 0}
.pfb-k{background:var(--bg,#14181c);border:1px solid var(--line,#38424d);border-radius:10px;padding:8px 10px}
.pfb-k b{display:block;font-size:22px;color:var(--accent,#3b9eff);font-variant-numeric:tabular-nums}
.pfb-k span{font-size:14px;color:var(--mute,#8d99a6)}
.pfb-bar{height:12px;border-radius:6px;background:var(--bg,#14181c);overflow:hidden;border:1px solid var(--line,#38424d)}
.pfb-bar i{display:block;height:100%;background:var(--accent-bg,#1a6fd4)}
.pfb-tbl{width:100%;border-collapse:collapse;font-size:14px}
.pfb-tbl th,.pfb-tbl td{text-align:left;padding:6px 6px;border-top:1px solid var(--line,#38424d);vertical-align:middle}
.pfb-tbl th{color:var(--mute,#8d99a6);font-weight:700}
.pfb-tbl td.n,.pfb-tbl th.n{text-align:right;font-variant-numeric:tabular-nums}
.pfb-rt{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed}
.pfb-rt th,.pfb-rt td{padding:0 2px;text-align:center;border-top:1px solid var(--line,#38424d)}
.pfb-rt th{color:var(--mute,#8d99a6);font-weight:700;border-top:0;height:36px}
.pfb-rt td.sn{font-weight:700;width:52px}
.pfb-rt tr.row{cursor:pointer}
.pfb-rt tr.row td{height:44px}
.pfb-rt tr.bad td{background:rgba(255,92,92,.16)}
.pfb-rt td.cm{background:rgba(76,217,100,.22);font-weight:700}
.pfb-rt td.hit{background:rgba(59,158,255,.25);font-weight:700}
.pfb-rt button.rowb{all:unset;display:block;width:100%;min-height:44px;line-height:44px;cursor:pointer;font-weight:700}
@media (max-width:480px){.pfb-tabs{padding:6px 8px}.pfb-body{padding:8px 8px 24px}.pfb-card{padding:10px 10px}.pfb-acc>.in{padding:0 10px 10px}}
`;
    function ensureCss() { if (doc.getElementById('pcbfehler-css')) return; const st = doc.createElement('style'); st.id = 'pcbfehler-css'; st.textContent = CSS; doc.head.appendChild(st); }

    /* ---------- Vorlesen (vorlesen.js: Aufnahme AU_pcb_<id>, wenn ihr Hash zum Text passt, sonst Gerätestimme) ----------
       Der Platz für den Knopf ist fest reserviert (.pfb-vl), damit beim Nachladen von vorlesen.js nichts springt. */
    const vlWarten = []; let vlLaedt = false, vlTakt = 0;
    function vlFuellen() {
      /* Wie bei den Aufgabenkarten (aufgabe-vorlesen.js): Knopf nur, wenn es zu AU_pcb_<id> eine Aufnahme gibt UND ihr Hash zum heutigen Text passt
         (nurAufnahme: nie die Gerätestimme). Ohne Aufnahme bleibt der Platz ausgeblendet, es gibt keinen leeren Raum. */
      const V = root.Vorlesen, A = root.SpeakAudio; if (!V || !V.knopf || !V.Texte || !A) return false;
      while (vlWarten.length) {
        const w = vlWarten.shift(); if (w.slot.firstChild) continue;
        const basis = V.Texte.au(w.q.title, w.q.text), key = sprechKey(w.q.id), auf = A[key];
        if (!basis || !auf || auf.h !== V.Texte.hash(basis)) continue;
        try { w.slot.appendChild(V.knopf(doc, key, basis, { nurAufnahme: true, vorladen: false, titel: 'Frage vorlesen' })); w.slot.hidden = false; } catch (e) { /* ohne Knopf weiter */ }
      }
      return true;
    }
    function vlSlot(q) {
      const slot = h('div', { class: 'pfb-vl vl-wrap', 'data-key': sprechKey(q.id) }); slot.hidden = true;
      vlWarten.push({ slot, q });
      if (vlFuellen()) return slot;
      if (!vlLaedt) {
        vlLaedt = true;
        const laden = () => { try { if (root.Vorlesen && root.Vorlesen.vorladen) root.Vorlesen.vorladen(doc); } catch (e) { /* egal */ } };   // lädt sprache/index.js (Aufnahmen-Index) und speak.js nach
        try { if (root.Vorlesen) laden(); else if (!doc.querySelector('script[src="vorlesen.js"]')) { const sc = doc.createElement('script'); sc.src = 'vorlesen.js'; sc.async = true; sc.onload = () => { laden(); vlFuellen(); }; doc.head.appendChild(sc); } } catch (e) { /* egal */ }
        let n = 0; vlTakt = root.setInterval(() => { if (root.Vorlesen && !root.SpeakAudio && n === 2) laden(); if (vlFuellen() || ++n > 80) root.clearInterval(vlTakt); }, 250);
      }
      return slot;
    }

    /* ---------- Band als DOM ---------- */
    function bandEl(aktiv, markiert, opts) {
      opts = opts || {};
      const d = bandDaten(aktiv, markiert), pick = opts.onPick;
      const ul = h('ol', { class: 'pfb-band', 'aria-label': 'Linie A: Stationen in Reihenfolge' });
      d.forEach(s => {
        const cls = (s.aktiv ? 'on' : '') + (s.markiert ? ' mk' : '') + (s.optional ? ' opt' : '');
        const inner = [h('span', { class: 'nr', text: String(s.nr) }), s.kurz];
        if (pick) ul.appendChild(h('li', { style: 'padding:0;border:0;background:none;min-height:0' }, h('button', { class: cls.trim(), 'aria-pressed': s.aktiv ? 'true' : 'false', 'aria-label': 'Station ' + s.nr + ' ' + s.name, onclick: () => pick(s.id) }, inner)));
        else ul.appendChild(h('li', Object.assign({ class: cls.trim() }, s.aktiv ? { 'aria-current': 'step' } : {}), inner));
      });
      return ul;
    }
    const bandLegende = (txt) => h('p', { class: 'pfb-legend', text: txt });
    const kinderListe = arr => h('ul', null, arr.map(t => h('li', { text: t })));

    /* ---------- Reiter 1: Fehlerbilder ---------- */
    function viewFehler(host, env) {
      const st = Object.assign({ filter: null, open: null }, lsGet('fb', {}));
      if (st.filter && !ST[st.filter]) st.filter = null;
      const save = () => lsSet('fb', { filter: st.filter, open: st.open });
      const intro = h('div', { class: 'pfb-card' }, [
        h('h3', { text: 'Fehlerbilder aus der Linie A' }),
        h('p', { text: 'Linie A ist ein Modell: Wareneingang, Lotpastendruck, Bestücken, Reflow, Prüfen, Lackieren, Verguss (wo nötig), Endprüfung, Versand. Eine echte Linie sieht je nach Baugruppe anders aus. Die Zahlen in diesem Lab sind Übungswerte; Grenzwerte und Rezepte stehen immer in der Prüfanweisung deines Betriebs.' }),
        h('p', { class: 'pfb-mute', text: 'Gehe von der Beobachtung zur Ursache: Was siehst du, an welcher Station ist es wahrscheinlich entstanden, wie prüfst du es, und was änderst du? Tippe eine Station an, um die Liste zu filtern.' })
      ]);
      const bandHost = h('div'), listHost = h('div');
      host.appendChild(intro); const bandCard = h('div', { class: 'pfb-card' }, [h('h3', { text: 'Station in Linie A' }), bandHost, h('p', { class: 'pfb-legend', id: 'pfb-filter-info' })]); host.appendChild(bandCard); host.appendChild(listHost);
      function renderBand() {
        bandHost.innerHTML = '';
        bandHost.appendChild(bandEl(st.filter, null, { onPick: id => { st.filter = st.filter === id ? null : id; save(); renderBand(); renderList(); } }));
        bandCard.querySelector('#pfb-filter-info').textContent = st.filter ? 'Gefiltert auf: ' + ST[st.filter].name + '. Tippe die Station noch einmal an, um alle Fehlerbilder zu sehen.' : 'Alle 9 Stationen. Das gestrichelte Feld (Verguss) wird nur bei Baugruppen durchlaufen, die es brauchen.';
      }
      function card(f) {
        const d = h('details', { class: 'pfb-acc', 'data-f': f.id });
        if (st.open === f.id) d.open = true;
        d.addEventListener('toggle', () => { if (d.open) { st.open = f.id; save(); } else if (st.open === f.id) { st.open = null; save(); } });
        const sum = h('summary', null, [h('span', { class: 'sum' }, [f.titel, h('small', { text: f.gruppe + ' · Station ' + ST[f.st].nr + ': ' + ST[f.st].kurz })])]);
        const inn = h('div', { class: 'in' }, [
          (f.st === 'lack' || f.st === 'verguss') ? h('div', { class: 'pfb-note warn' }, [h('b', { text: 'Arbeitsschutz: ' }), ARBEITSSCHUTZ.replace(/^Arbeitsschutz: /, '')]) : null,
          h('h4', { text: 'Beobachtung (Symptom)' }), h('p', { text: f.symptom }),
          h('h4', { text: 'Wahrscheinliche Station und Ursache' }), h('p', { text: 'Wahrscheinlich entstanden an: ' + ST[f.st].name + '.' }),
          kinderListe(f.ursache.map(k => URSACHEN[k].t)),
          h('h4', { text: 'Prüfweg' }), kinderListe(f.pruef),
          h('h4', { text: 'Gegenmaßnahme' }), kinderListe(f.gegen),
          h('div', { class: 'pfb-note ok' }, [h('b', { text: 'Merkregel: ' }), f.merk]),
          h('h4', { text: 'Station in Linie A' }), bandEl(f.st, f.findet.filter(x => x !== f.st)),
          h('p', { class: 'pfb-legend', text: 'Blau: hier entsteht der Fehler wahrscheinlich. Orange Rand: hier fällt er üblicherweise auf.' })
        ]);
        d.appendChild(sum); d.appendChild(inn); return d;
      }
      function renderList() {
        listHost.innerHTML = '';
        const l = FEHLER.filter(f => !st.filter || f.st === st.filter || f.findet.indexOf(st.filter) >= 0);
        if (!l.length) { listHost.appendChild(h('div', { class: 'pfb-note', text: 'Zu dieser Station gibt es kein eigenes Fehlerbild. Wähle eine andere oder tippe die Station noch einmal an.' })); return; }
        listHost.appendChild(h('p', { class: 'pfb-mute', text: l.length + (l.length === 1 ? ' Fehlerbild' : ' Fehlerbilder') + (st.filter ? ' (entstehen oder fallen hier auf)' : '') }));
        l.forEach(f => listHost.appendChild(card(f)));
      }
      renderBand(); renderList();
      return {};
    }

    /* ---------- Reiter 2: Quiz ---------- */
    function viewQuiz(host, env) {
      const speicher = (() => { try { return root.localStorage; } catch (e) { return null; } })();
      const done = quizStand(speicher), tips = {}, karten = {};
      const melde = () => { try { if (env.ctx && env.ctx.quizChanged) env.ctx.quizChanged(); } catch (e) { /* egal */ } };
      const head = h('div', { class: 'pfb-card' }), listHost = h('div');
      host.appendChild(head); host.appendChild(listHost);
      function heads() {
        const n = QUIZ.filter(q => (done[q.id] || 0) >= 100).length;
        head.innerHTML = '';
        head.appendChild(h('h3', { text: 'Von Symptom zur Ursache' }));
        head.appendChild(h('p', { text: 'Zehn Aufgaben: Ordne Symptome der Station zu oder wähle alle passenden Ursachen. Jede Aufgabe hat drei Tipps. Den Lösungsweg siehst du nach dem Lösen. Gelöst: ' + n + ' von ' + QUIZ.length + '.' }));
        head.appendChild(h('div', { class: 'pfb-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(QUIZ.length), 'aria-valuenow': String(n) }, h('i', { style: 'width:' + Math.round(100 * n / QUIZ.length) + '%' })));
        head.appendChild(h('div', { class: 'pfb-row' }, h('button', { class: 'pfb-btn', text: 'Fortschritt zurücksetzen', onclick: () => { Object.keys(done).forEach(k => delete done[k]); quizLeeren(speicher); melde(); heads(); build(); } })));
      }
      function oeffne(id) {
        const d = karten[id]; if (!d) return false;
        Object.keys(karten).forEach(k => { if (k !== id) karten[k].open = false; });
        d.open = true;
        try { d.scrollIntoView({ block: 'start' }); const su = d.querySelector('summary'); if (su) su.focus({ preventScroll: true }); } catch (e) { /* egal */ }
        return true;
      }
      function taskCard(q) {
        const ans = q.art === 'match' ? {} : [];
        const d = h('details', { class: 'pfb-acc pfb-q', 'data-q': q.id }); karten[q.id] = d;
        const stars = '★'.repeat(q.level) + '☆'.repeat(3 - q.level);
        const pill = () => (done[q.id] >= 100 ? h('span', { class: 'pfb-pill ok', text: 'gelöst' }) : null);
        d.appendChild(h('summary', null, [h('span', { class: 'sum' }, [q.id.replace('fq', '') + ' · ' + q.title, h('small', { text: (q.art === 'match' ? 'Zuordnung' : 'Mehrfachwahl') + ' · Stufe ' + stars })]), pill()]));
        const inn = h('div', { class: 'in' }); d.appendChild(inn);
        const res = h('div', { 'aria-live': 'polite' }), tip = h('div'), weg = h('div');
        inn.appendChild(h('p', { text: q.text }));
        inn.appendChild(vlSlot(q));
        const sel = [];
        if (q.art === 'match') {
          q.items.forEach(f => {
            const s = h('select', { 'aria-label': 'Station für: ' + FB[f].titel }, [h('option', { value: '', text: '– bitte wählen –' })].concat(q.pool.map(id => h('option', { value: id, text: ST[id].nr + ' ' + ST[id].name }))));
            s.addEventListener('change', () => { ans[f] = s.value; });
            const mk = h('span', { class: 'pfb-mark' });
            inn.appendChild(h('div', { class: 'pfb-it' }, [h('div', null, [h('b', { text: FB[f].titel + ': ' }), FB[f].symptom]), s, mk])); sel.push({ f, s, mk });
          });
        } else {
          const grp = h('div', { class: 'pfb-opts', role: 'group', 'aria-label': 'Antworten, mehrere können richtig sein' }); inn.appendChild(grp);
          q.options.forEach(k => {
            const bx = h('span', { class: 'bx', 'aria-hidden': 'true' }), b = h('button', { type: 'button', class: 'pfb-opt', role: 'checkbox', 'aria-checked': 'false', 'data-k': k }, [bx, h('span', { text: URSACHEN[k].t })]);
            b.addEventListener('click', () => { const i = ans.indexOf(k); if (i >= 0) ans.splice(i, 1); else ans.push(k); const on = ans.indexOf(k) >= 0; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); bx.textContent = on ? '✓' : ''; });
            grp.appendChild(b); sel.push({ k, b });
          });
        }
        const bCheck = h('button', { class: 'pfb-btn pri', text: 'Prüfen', onclick: () => {
          const r = pruefeQuiz(q, ans), rect = bCheck.getBoundingClientRect();
          if (q.art === 'match') sel.forEach(o => { const z = r.zeilen[q.items.indexOf(o.f)]; o.mk.textContent = z.ok ? '✓ richtig' : '✗ noch nicht'; o.mk.className = 'pfb-mark ' + (z.ok ? 'ok' : 'bad'); });
          res.innerHTML = '';
          const z = quizZaehlen(speicher, q.id, r);
          res.appendChild(h('div', { class: 'pfb-note ' + (r.ok ? 'ok' : 'warn'), text: r.ok ? (z.auf ? 'Richtig! Gezählt: ' + z.pct + ' %, weil die Lösung aufgedeckt war. Löse die Frage später noch einmal ohne Lösung, dann zählt sie voll.' : 'Richtig! 100 %') : 'Noch nicht ganz: ' + r.pct + ' %. Nutze einen Tipp oder versuche es noch einmal. Kommst du gar nicht weiter, kannst du dir die Lösung zeigen lassen. Dann zählt die Frage in dieser Runde nur ' + AUF_PCT + ' %.' }));
          if ((done[q.id] || 0) < z.pct) { done[q.id] = z.pct; melde(); }
          if (r.ok) { bWeg.hidden = true; zeigeWeg(''); } else if (!weg.firstChild) bWeg.hidden = false;
          if (r.ok) {
            const nx = quizNaechste(done, q.id);
            if (nx) res.appendChild(h('div', { class: 'pfb-row' }, h('button', { type: 'button', class: 'pfb-btn pri', 'data-weiter': nx, text: 'Weiter →', 'aria-label': 'Weiter zur nächsten offenen Frage', onclick: () => oeffne(nx) })));
            else res.appendChild(h('p', { class: 'pfb-mute', text: 'Alle zehn Fragen sind gelöst.' }));
          }
          if (r.ok) env.fx('ding', rect.left + rect.width / 2, rect.top, 'Richtig!'); else env.fx('sad', rect.left + rect.width / 2, rect.top, 'Fast');
          const ps = d.querySelector('summary .pfb-pill'); if (r.ok && !ps) d.querySelector('summary').appendChild(pill()); heads();
        } });
        const bTip = h('button', { class: 'pfb-btn', text: 'Tipp (0/3)', onclick: () => {
          tips[q.id] = Math.min(3, (tips[q.id] || 0) + 1); tip.innerHTML = '';
          for (let i = 0; i < tips[q.id]; i++) tip.appendChild(h('div', { class: 'pfb-note', text: 'Tipp ' + (i + 1) + ': ' + q.hint[i] }));
          bTip.textContent = 'Tipp (' + tips[q.id] + '/3)'; if (tips[q.id] >= 3) bTip.disabled = true;
        } });
        const zeigeWeg = zusatz => { weg.innerHTML = ''; weg.appendChild(h('div', { class: 'pfb-note' }, [h('b', { text: 'Lösungsweg' })].concat(q.weg.map(t => h('p', { style: 'margin:4px 0', text: t })), zusatz ? [h('p', { class: 'pfb-mute', style: 'margin:8px 0 0', text: zusatz })] : []))); };
        /* Lösung zeigen: erst nach einer falschen Antwort sichtbar (wie im Linien-Lab) */
        const bWeg = h('button', { type: 'button', class: 'pfb-btn', 'data-sol': q.id, text: 'Lösung zeigen', onclick: () => {
          const neu = quizAufdecken(speicher, q.id); bWeg.hidden = true;
          zeigeWeg(neu || quizAufgedeckt(speicher, q.id) ? 'Lösung aufgedeckt: Löst du die Frage jetzt, zählt sie ' + AUF_PCT + ' %. Löse sie später noch einmal ohne Lösung, dann zählt sie voll.' : 'Lösung aufgedeckt. Diese Frage hast du schon einmal voll gelöst, dein bester Wert bleibt.');
        } });
        bWeg.hidden = true;
        inn.appendChild(h('div', { class: 'pfb-row' }, [bCheck, bTip, bWeg])); inn.appendChild(res); inn.appendChild(tip); inn.appendChild(weg);
        return d;
      }
      function build() { listHost.innerHTML = ''; QUIZ.forEach(q => listHost.appendChild(taskCard(q))); }
      heads(); build();
      return { oeffne };
    }

    /* ---------- Reiter 3: Ausbeute ---------- */
    function viewAusbeute(host, env) {
      const st = Object.assign({ y: {}, verguss: true }, lsGet('ausb', {}));
      const yOf = id => { const v = st.y[id]; return typeof v === 'number' && v >= 0.9 && v <= 1 ? v : UEBUNG_AUSBEUTE.find(s => s.id === id).y; };
      const save = () => lsSet('ausb', { y: st.y, verguss: st.verguss });
      host.appendChild(h('div', { class: 'pfb-card' }, [
        h('h3', { text: 'Ausbeute der Linie A (Übungswerte)' }),
        h('p', { text: 'Die Ausbeute einer Station (First-Pass-Yield, FPY) ist der Anteil der Baugruppen, die sie beim ersten Durchlauf bestehen, ohne Nacharbeit. Multiplizierst du die Ausbeuten aller Stationen, erhältst du den Rolled Throughput Yield (RTY): den Anteil, der die ganze Linie ohne Nacharbeit schafft. In diesem Modell zählt beim Prüfen auch ein Pseudofehler als „nicht bestanden“, weil die Baugruppe nicht im ersten Anlauf durchläuft. Ob dein Betrieb so zählt, steht in seiner Kennzahl-Definition. Die Ausbeute der Station Prüfen steht hier nur für Pseudofehler und Fehler durch das Prüfen selbst. Echte Löt- und Bestückfehler stecken schon in den Stationen davor.' }),
        h('p', { class: 'pfb-mute', text: 'Die Werte unten sind frei gewählte Übungswerte, keine Werte eines Betriebs. Stelle sie mit den Reglern selbst ein.' })
      ]));
      const bandHost = h('div'), ctl = h('div', { class: 'pfb-card' }), out = h('div', { class: 'pfb-card' });
      host.appendChild(h('div', { class: 'pfb-card' }, [h('h3', { text: 'Station in Linie A' }), bandHost, h('p', { class: 'pfb-legend', text: 'Blau: die Station mit der niedrigsten Ausbeute in deiner Einstellung.' })]));
      host.appendChild(ctl); host.appendChild(out);
      const outs = {};
      ctl.appendChild(h('h3', { text: 'Ausbeute je Station einstellen' }));
      UEBUNG_AUSBEUTE.forEach(s => {
        const o = h('output', { 'for': 'pfb-y-' + s.id }), i = h('input', { type: 'range', id: 'pfb-y-' + s.id, min: '90', max: '100', step: '0.1', 'aria-label': 'Ausbeute ' + ST[s.id].name });
        i.value = String(Math.round(yOf(s.id) * 1000) / 10);
        i.addEventListener('input', () => { st.y[s.id] = Math.round(parseFloat(i.value) * 10) / 1000; save(); calc(); });
        outs[s.id] = { o, i }; ctl.appendChild(h('div', { class: 'pfb-sl' }, [h('label', { 'for': 'pfb-y-' + s.id, text: ST[s.id].nr + ' ' + ST[s.id].name }), o, i]));
      });
      const cb = h('input', { type: 'checkbox', id: 'pfb-verg' }); cb.checked = !!st.verguss;
      cb.addEventListener('change', () => { st.verguss = cb.checked; save(); calc(); });
      ctl.appendChild(h('label', { class: 'pfb-chk', 'for': 'pfb-verg' }, [cb, 'Verguss wird bei dieser Baugruppe durchlaufen']));
      ctl.appendChild(h('div', { class: 'pfb-row' }, h('button', { class: 'pfb-btn', text: 'Übungswerte zurücksetzen', onclick: () => { st.y = {}; st.verguss = true; save(); UEBUNG_AUSBEUTE.forEach(s => { outs[s.id].i.value = String(Math.round(s.y * 1000) / 10); }); cb.checked = true; calc(); } })));
      function stufen() { return UEBUNG_AUSBEUTE.map(s => ({ id: s.id, y: yOf(s.id), aus: s.id === 'verguss' && !st.verguss })); }
      function calc() {
        const sf = stufen(), r = ausbeute(sf, 1000), hb = hebel(sf);
        UEBUNG_AUSBEUTE.forEach(s => { outs[s.id].o.textContent = fm(yOf(s.id) * 100, 1) + ' %'; });
        bandHost.innerHTML = ''; bandHost.appendChild(bandEl(r.schwaechste, null));
        out.innerHTML = '';
        out.appendChild(h('h3', { text: 'Ergebnis' }));
        out.appendChild(h('div', { class: 'pfb-kpi' }, [
          h('div', { class: 'pfb-k' }, [h('b', { text: fm(r.rty * 100, 1) + ' %' }), h('span', { text: 'RTY der Linie' })]),
          h('div', { class: 'pfb-k' }, [h('b', { text: String(Math.round(r.ohneNacharbeit)) }), h('span', { text: 'von 1000 im ersten Durchlauf bestanden' })]),
          h('div', { class: 'pfb-k' }, [h('b', { text: String(Math.round(r.nacharbeit)) }), h('span', { text: 'von 1000 nicht im ersten Durchlauf bestanden' })])
        ]));
        const tb = h('table', { class: 'pfb-tbl' }, [h('thead', null, h('tr', null, [h('th', { text: 'Station' }), h('th', { class: 'n', text: 'FPY' }), h('th', { class: 'n', text: 'im ersten Durchlauf gut' })])),
          h('tbody', null, r.zeilen.map(z => h('tr', null, [h('td', { text: ST[z.id].nr + ' ' + ST[z.id].kurz + (z.aktiv ? '' : ' (entfällt)') }), h('td', { class: 'n', text: z.aktiv ? fm(z.y * 100, 1) + ' %' : '–' }), h('td', { class: 'n', text: Math.round(z.stueck) + ' von 1000' })])))]);
        out.appendChild(tb);
        out.appendChild(h('div', { class: 'pfb-note', text: 'Schwächste Station: ' + (r.schwaechste ? ST[r.schwaechste].kurz : '–') + '. Hebel: Verbesserst du ' + (hb ? ST[hb.id].kurz : '–') + ' um einen Prozentpunkt, steigt der RTY am meisten (um ' + (hb ? fm(hb.gain * 100, 2) : '0') + ' Prozentpunkte). Die Station mit der niedrigsten Ausbeute hat den größten Hebel, weil du durch ihren kleinen Wert teilst. Der Unterschied zwischen den Stationen ist klein. Wichtiger ist: Bei der schwächsten Station ist am meisten Luft nach oben.' }));
        out.appendChild(h('p', { class: 'pfb-mute', text: 'Modellgrenze: Die Rechnung nimmt an, dass die Stationen unabhängig voneinander ausfallen. In einer echten Linie hängen sie zusammen (schlechter Druck führt zu schlechter Lötstelle).' }));
      }
      calc();
      /* Übung */
      const ux = UEBUNG_RTY, uCard = h('div', { class: 'pfb-card' }), uIn = h('input', { class: 'pfb-in', type: 'text', inputmode: 'decimal', 'aria-label': 'RTY in Prozent', placeholder: 'RTY in %, zum Beispiel 90,5' }), uSel = h('select', { class: 'pfb-in', 'aria-label': 'Station mit dem größten Hebel' }, [h('option', { value: '', text: '– bitte wählen –' })].concat(ux.stufen.map(s => h('option', { value: s.id, text: ST[s.id].name })))), uRes = h('div', { 'aria-live': 'polite' }), uTip = h('div');
      uCard.appendChild(h('h3', { text: 'Übung: Rolled Throughput Yield' }));
      uCard.appendChild(h('p', { text: 'Eine Modell-Linie hat fünf Stationen mit diesen Ausbeuten: ' + ux.stufen.map(s => ST[s.id].kurz + ' ' + fm(s.y * 100, 1) + ' %').join(', ') + '. (a) Wie groß ist der RTY in Prozent? (b) Bei welcher Station bringt ein Prozentpunkt mehr Ausbeute am meisten?' }));
      uCard.appendChild(h('div', { class: 'pfb-row' }, [h('div', { style: 'flex:1 1 200px' }, uIn), h('div', { style: 'flex:1 1 200px' }, uSel)]));
      uCard.appendChild(h('div', { class: 'pfb-row' }, [
        h('button', { class: 'pfb-btn pri', text: 'Prüfen', onclick: () => {
          const r = ausbeute(ux.stufen), ziel = r.rty * 100, hb = hebel(ux.stufen), roh = String(uIn.value).replace(/\s/g, '').replace(',', '.'), v = /^[-+]?\d+(\.\d+)?$/.test(roh) ? Number(roh) : NaN;
          if (!isFinite(v)) { uRes.innerHTML = ''; uRes.appendChild(h('div', { class: 'pfb-note warn', text: 'Bitte eine Zahl eingeben, zum Beispiel 90,5.' })); try { uIn.focus(); } catch (e) { /* egal */ } return; }
          const ok1 = isFinite(v) && Math.abs(v - ziel) <= ux.tol, ok2 = uSel.value === hb.id;
          uRes.innerHTML = ''; uRes.appendChild(h('div', { class: 'pfb-note ' + (ok1 && ok2 ? 'ok' : 'warn'), text: (ok1 ? '(a) richtig. ' : '(a) noch nicht. ') + (ok2 ? '(b) richtig.' : '(b) noch nicht.') }));
          const b = uCard.getBoundingClientRect(); env.fx(ok1 && ok2 ? 'ding' : 'sad', b.left + b.width / 2, b.top + 40, ok1 && ok2 ? 'Richtig!' : 'Fast');
        } }),
        h('button', { class: 'pfb-btn', text: 'Tipp', onclick: () => { uTip.innerHTML = ''; uTip.appendChild(h('div', { class: 'pfb-note', text: 'Multipliziere die Ausbeuten als Dezimalzahlen (98 % = 0,98). Für (b): Wenn du einen Wert durch einen kleineren Faktor teilst, wird das Ergebnis größer.' })); } }),
        h('button', { class: 'pfb-btn', text: 'Lösungsweg', onclick: () => {
          const r = ausbeute(ux.stufen), hb = hebel(ux.stufen); let run = 1; const steps = ux.stufen.map(s => { run *= s.y; return ST[s.id].kurz + ': ' + fm(run * 100, 2) + ' %'; });
          uTip.innerHTML = ''; uTip.appendChild(h('div', { class: 'pfb-note' }, [h('b', { text: 'Lösungsweg' }), h('p', { style: 'margin:4px 0', text: 'Schritt für Schritt multipliziert: ' + steps.join(' → ') + '.' }), h('p', { style: 'margin:4px 0', text: 'RTY = ' + fm(r.rty * 100, 1) + ' % (von 1000 Baugruppen kommen etwa ' + Math.round(r.ohneNacharbeit) + ' im ersten Durchlauf ohne Nacharbeit durch).' }), h('p', { style: 'margin:4px 0', text: '(b) ' + ST[hb.id].name + ': Die Station mit der kleinsten Ausbeute hat den größten Hebel (RTY geteilt durch ihre Ausbeute).' })]));
        } })
      ]));
      uCard.appendChild(uRes); uCard.appendChild(uTip); host.appendChild(uCard);
      return {};
    }

    /* ---------- Reiter 4: Rückverfolgung ---------- */
    function viewRueck(host, env) {
      const D = RUECK, st = Object.assign({ bad: D.uebung.auffaellig.slice(), k: 'ko', w: 'KO2' }, lsGet('rueck', {}));
      if (!Array.isArray(st.bad)) st.bad = []; if (!D.felder.some(f => f.k === st.k)) st.k = 'ko';
      const save = () => lsSet('rueck', { bad: st.bad, k: st.k, w: st.w });
      host.appendChild(h('div', { class: 'pfb-card' }, [
        h('h3', { text: 'Rückverfolgbarkeit: von der Charge zur Baugruppe' }),
        h('p', { text: 'Drei Ebenen nicht vermischen: Eine Charge (Los) ist Material, das der Hersteller unter gleichen Bedingungen gefertigt hat. Eine Lieferung kann mehrere Chargen enthalten. Die Verpackungs-ID gehört zu einem Gebinde, die Seriennummer zu einer einzelnen Baugruppe. Erst die Verknüpfung (zum Beispiel Seriennummer zu Chargen und Ofenlauf) beantwortet zwei Fragen: Von der fehlerhaften Charge aus: Welche Baugruppen sind betroffen? Von den auffälligen Baugruppen aus: Welche Charge haben alle gemeinsam?' }),
        h('p', { class: 'pfb-mute', text: 'Die Tabelle ist ein frei erfundenes Übungsbeispiel mit zwölf Baugruppen. Welche Daten eine echte Linie je Baugruppe speichert, ist von Produkt zu Produkt verschieden.' })
      ]));
      const bandCard = h('div', { class: 'pfb-card' }, [h('h3', { text: 'Station in Linie A' }), bandEl(null, D.felder.map(f => f.st)), h('p', { class: 'pfb-legend', text: 'Orange Rand: Stationen, die in der Übungstabelle ein Merkmal beisteuern.' })]);
      host.appendChild(bandCard);
      /* Tabelle */
      const tableCard = h('div', { class: 'pfb-card' }), tbl = h('table', { class: 'pfb-rt' }), info = h('div', { 'aria-live': 'polite' });
      tableCard.appendChild(h('h3', { text: 'Eingrenzen: Welche Merkmale haben die auffälligen Baugruppen gemeinsam?' }));
      tableCard.appendChild(h('p', { text: 'Tippe auf eine Seriennummer, um die Baugruppe als auffällig zu markieren (rot). Grün hinterlegt sind Merkmale, die alle markierten Baugruppen teilen.' }));
      tableCard.appendChild(tbl); tableCard.appendChild(info);
      const uBtn = h('button', { class: 'pfb-btn', text: 'Übung laden', onclick: () => { st.bad = D.uebung.auffaellig.slice(); save(); renderTable(); } });
      const cBtn = h('button', { class: 'pfb-btn', text: 'Markierung löschen', onclick: () => { st.bad = []; save(); renderTable(); } });
      tableCard.appendChild(h('div', { class: 'pfb-row' }, [uBtn, cBtn]));
      const uSel = h('select', { class: 'pfb-in', 'aria-label': 'Verursachendes Merkmal' }, [h('option', { value: '', text: '– Merkmal wählen –' })].concat(D.felder.map(f => h('optgroup', { label: f.name }, werte(D, f.k).map(w => h('option', { value: f.k + ':' + w, text: f.kurz + ' ' + w }))))));
      const uRes = h('div', { 'aria-live': 'polite' }), uTip = h('div');
      tableCard.appendChild(h('h4', { style: 'margin:12px 0 4px;color:var(--mute,#8d99a6)', text: 'Übung' }));
      tableCard.appendChild(h('p', { text: 'Bei den Baugruppen ' + D.uebung.auffaellig.join(', ') + ' sind Blasen im Schutzlack aufgefallen. Markiere sie (Kn.pfb „Übung laden“) und wähle dann das Merkmal, das alle gemeinsam haben und das als Ursache in Frage kommt.' }));
      tableCard.appendChild(uSel);
      tableCard.appendChild(h('div', { class: 'pfb-row' }, [
        h('button', { class: 'pfb-btn pri', text: 'Prüfen', onclick: () => {
          const g = gemeinsam(D, D.uebung.auffaellig), want = D.uebung.antwort, ok = uSel.value === want.k + ':' + want.wert, one = g.length === 1;
          uRes.innerHTML = ''; uRes.appendChild(h('div', { class: 'pfb-note ' + (ok && one ? 'ok' : 'warn'), text: ok && one ? 'Richtig: Nur dieses Merkmal ist allen vier Baugruppen gemeinsam.' : 'Noch nicht. Prüfe Spalte für Spalte: Welcher Wert steht bei allen vier Baugruppen?' }));
          const b = tableCard.getBoundingClientRect(); env.fx(ok ? 'ding' : 'sad', b.left + b.width / 2, b.top + 40, ok ? 'Richtig!' : 'Fast');
        } }),
        h('button', { class: 'pfb-btn', text: 'Lösungsweg', onclick: () => {
          const g = gemeinsam(D, D.uebung.auffaellig), rows = D.zeilen.filter(z => D.uebung.auffaellig.indexOf(z.sn) >= 0);
          uTip.innerHTML = ''; uTip.appendChild(h('div', { class: 'pfb-note' }, [h('b', { text: 'Lösungsweg' })].concat(D.felder.map(f => h('p', { style: 'margin:4px 0', text: f.kurz + ': ' + rows.map(r => r[f.k] == null ? '–' : r[f.k]).join(', ') + (g.some(x => x.k === f.k) ? '  → überall gleich' : '  → verschieden') })), [h('p', { style: 'margin:4px 0', text: 'Nur beim Lack ist der Wert bei allen vier gleich: ' + g.map(x => x.wert).join(', ') + '. Das passt zum Fehlerbild „Blasen im Schutzlack“. Gegenprobe: Gibt es Baugruppen mit ' + g.map(x => x.wert).join(', ') + ' ohne Blasen? Hier nicht. Das stärkt den Verdacht, ist aber noch kein Beweis.' })])));
        } })
      ]));
      tableCard.appendChild(uRes); tableCard.appendChild(uTip);
      host.appendChild(tableCard);
      function renderTable() {
        const g = gemeinsam(D, st.bad), cm = {}; g.forEach(x => { cm[x.k] = x.wert; });
        tbl.innerHTML = '';
        tbl.appendChild(h('thead', null, h('tr', null, [h('th', { class: 'sn', text: 'SN' })].concat(D.felder.map(f => h('th', { text: f.kurz }))))));
        const tb = h('tbody');
        D.zeilen.forEach(z => {
          const bad = st.bad.indexOf(z.sn) >= 0;
          const tr = h('tr', { class: 'row' + (bad ? ' bad' : ''), 'aria-pressed': bad ? 'true' : 'false', tabindex: '0', role: 'button', 'aria-label': 'Seriennummer ' + z.sn + (bad ? ', auffällig' : '') });
          const flip = () => { const i = st.bad.indexOf(z.sn); if (i >= 0) st.bad.splice(i, 1); else st.bad.push(z.sn); save(); renderTable(); };
          tr.addEventListener('click', flip); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
          tr.appendChild(h('td', { class: 'sn', text: z.sn }));
          D.felder.forEach(f => tr.appendChild(h('td', { class: bad && cm[f.k] != null && cm[f.k] === z[f.k] ? 'cm' : '', text: z[f.k] == null ? '–' : z[f.k] })));
          tb.appendChild(tr);
        });
        tbl.appendChild(tb);
        info.innerHTML = '';
        info.appendChild(h('div', { class: 'pfb-note ' + (g.length === 1 ? 'ok' : ''), text: !st.bad.length ? 'Noch keine Baugruppe markiert.' : st.bad.length + ' Baugruppe(n) markiert. ' + (g.length === 0 ? 'Kein Merkmal ist allen gemeinsam: Wahrscheinlich sind mehrere Ursachen im Spiel, oder eine markierte Baugruppe gehört nicht zum Fehlerbild.' : g.length === 1 ? 'Gemeinsames Merkmal: ' + g[0].name + ' = ' + g[0].wert + '. Das ist der erste Verdacht.' : 'Gemeinsame Merkmale: ' + g.map(x => x.name + ' = ' + x.wert).join('; ') + '. Mehrere Verdächtige: Markiere weitere Baugruppen, um einzugrenzen.') }));
      }
      renderTable();
      /* Rückruf: von der Charge zu den Baugruppen */
      const rc = h('div', { class: 'pfb-card' }), selK = h('select', { class: 'pfb-in', 'aria-label': 'Merkmal' }, D.felder.map(f => h('option', { value: f.k, text: f.name }))), selW = h('select', { class: 'pfb-in', 'aria-label': 'Wert' }), rOut = h('div', { 'aria-live': 'polite' });
      selK.value = st.k;
      function fillW() { selW.innerHTML = ''; werte(D, selK.value).forEach(w => selW.appendChild(h('option', { value: w, text: w }))); if (werte(D, selK.value).indexOf(st.w) >= 0) selW.value = st.w; else st.w = selW.value; }
      function renderR() {
        const l = betroffen(D, selK.value, selW.value), mitV = l.filter(sn => D.zeilen.find(z => z.sn === sn).vg != null);
        rOut.innerHTML = '';
        rOut.appendChild(h('div', { class: 'pfb-note ' + (l.length ? 'warn' : ''), text: l.length + ' von ' + D.zeilen.length + ' Baugruppen tragen ' + selW.value + ': ' + (l.length ? l.join(', ') : 'keine') + '.' + (mitV.length ? ' Davon sind ' + mitV.length + ' vergossen: Dort ist Nacharbeit oder Austausch schwieriger, das spricht für schnelle Eingrenzung.' : '') }));
      }
      selK.addEventListener('change', () => { st.k = selK.value; fillW(); save(); renderR(); });
      selW.addEventListener('change', () => { st.w = selW.value; save(); renderR(); });
      fillW(); renderR();
      rc.appendChild(h('h3', { text: 'Rückruf: Welche Baugruppen sind betroffen?' }));
      rc.appendChild(h('p', { text: 'Angenommen, der Lieferant meldet eine Charge als fehlerhaft. Wähle Merkmal und Wert: Die Tabelle liefert dir alle betroffenen Seriennummern. Mit sauberer Rückverfolgbarkeit musst du nur diese Baugruppen sperren, nicht die ganze Produktion.' }));
      rc.appendChild(h('div', { class: 'pfb-row' }, [h('div', { style: 'flex:1 1 220px' }, selK), h('div', { style: 'flex:1 1 140px' }, selW)])); rc.appendChild(rOut);
      host.appendChild(rc);
      return {};
    }

    /* ====================================================================================
       Mount: Reiter innerhalb der Ansicht
       ==================================================================================== */
    function mountFehler(el, ctx) {
      ensureCss();
      const fx = (k, x, y, t) => { try { if (ctx && ctx.fx) ctx.fx(k, x, y, t); } catch (e) { /* egal */ } };
      const TABS = [['fb', 'Fehlerbilder'], ['quiz', 'Quiz'], ['ausb', 'Ausbeute'], ['rueck', 'Rückverfolgung']];
      let tab = lsGet('tab', 'fb'); if (!TABS.some(t => t[0] === tab)) tab = 'fb';
      const rootEl = h('div', { class: 'pfb' }), tabsEl = h('div', { class: 'pfb-tabs', role: 'tablist' }), body = h('div', { class: 'pfb-body' }), wrap = h('div', { class: 'pfb-wrap' });
      body.appendChild(wrap); rootEl.appendChild(tabsEl); rootEl.appendChild(body); el.innerHTML = ''; el.appendChild(rootEl);
      const env = { ctx, fx };
      let sicht = null;
      function tabs() { tabsEl.innerHTML = ''; TABS.forEach(t => tabsEl.appendChild(h('button', { type: 'button', class: 'pfb-tab' + (tab === t[0] ? ' on' : ''), role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', 'data-pt': t[0], text: t[1], onclick: () => { tab = t[0]; lsSet('tab', tab); render(); } }))); }
      function render() {
        tabs(); wrap.innerHTML = ''; body.scrollTop = 0;
        try { const on = tabsEl.querySelector('.pfb-tab.on'); if (on && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollLeft = Math.max(0, on.offsetLeft - 8); } catch (e) { /* egal */ }
        sicht = null;
        try { sicht = ({ fb: viewFehler, quiz: viewQuiz, ausb: viewAusbeute, rueck: viewRueck })[tab](wrap, env) || null; }
        catch (e) { console.error('Fehlerbild:', e); wrap.innerHTML = ''; wrap.appendChild(h('div', { class: 'pfb-note err', text: 'Dieser Reiter konnte nicht gestartet werden: ' + (e && e.message || e) })); }
      }
      render();
      /* zeigeFrage('fq3'): Reiter Quiz öffnen und die Frage aufklappen (Aufgabenliste des Labs, Aufruf ?aufgabe=fq3) */
      return { refresh() {}, onShow() {}, onResize() {}, destroy() { rootEl.remove(); }, zeigeFrage(id) { if (!quizById(id)) return false; if (tab !== 'quiz') { tab = 'quiz'; lsSet('tab', tab); render(); } return !!(sicht && sicht.oeffne && sicht.oeffne(id)); } };
    }
    quizUebernehmen((() => { try { return root.localStorage; } catch (e) { return { getItem() { return null; } }; } })());
    root.PCB_VIEWS.register('fehler', { title: 'Fehlerbild', mount: mountFehler });
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') installUi();
})(typeof window !== 'undefined' ? window : globalThis);
