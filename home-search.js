'use strict';
/* Tonfunk Lab: Suche auf der Startseite (SPEC-STARTSEITE-FABLE.md, Abschnitt 6.3). Offline, ohne Bibliothek.
   Indexiert Lab-Karten (aus dem DOM, dazu die Stichwörter in data-such), Reiter in Labs (statische Liste REITER), alle Lernhefte (statische Liste HEFTE, aus lernen.html abgeleitet)
   und alle Aufgaben (AUFGABEN aus aufgaben.js).
   Seit dem Umbau in fünf Ansichten (S1) steht die Suche oben in der Ansicht "Labs". Die Trefferliste nennt zuerst die Labs (S-21), dann Lab-Reiter, Hefte, Wiki und Aufgaben;
   das Raster dahinter wird nicht mehr gefiltert. Die Liste steht im Seitenfluss (kein eigener Rollbereich, S-22).
   Tastatur: / oder Strg+K fokussiert, Esc leert, Pfeil auf/ab wählt, Enter öffnet. Die reine Suchlogik (norm, fold, search) wird in Node getestet.
   W12a Wiki: Treffer aus dem Wiki (Bauteile, Geräte, Begriffe, höchstens 2 Regler/Messwerte) als Gruppe "Im Wiki", Link wiki.html#e=<id>. Die Wiki-Skripte
   (wiki.js, wiki-suche.js, wiki-index.js) werden erst beim Fokus ins Suchfeld nachgeladen, der Regler-Index (wiki-index-regler.js) erst nach dem ersten Tastendruck;
   beim Start der Startseite wird nichts vom Wiki geladen. */
(function (root) {
  // [Datei, Titel, Kurztext]; Test test_home.js prüft, dass jede lernen-*.html (außer lernen.html) hier vorkommt
  const HEFTE = [
    ["lernen-loch.html", "Löten und Lochraster", "Bauteile, Löttechnik, Bestückung, typische Fehler. Mit Arbeitsblatt."],
    ["lernen-schalt.html", "Elektronikgrundlagen", "Ohmsches Gesetz, Teiler, Dioden, RC, Transistor und MOSFET, Netzteile, 555. Mit Rechenaufgaben."],
    ["lernen-sim.html", "Hausinstallation und Prüfung", "Schaltungen, Schutzmaßnahmen, Leitungen, Messen und DIN VDE 0701/0702. Mit Arbeitsblatt."],
    ["lernen-digi.html", "Digitaltechnik", "Zahlensysteme, Gatter, Wahrheitstabellen, Addierer, Flipflops, Zähler, echte ICs und eine kleine CPU. Mit Arbeitsblatt."],
    ["lernen-mess.html", "Messtechnik", "Multimeter, Messfehler, Netzgerät, Oszilloskop, Leistung und Kennlinien. Mit Arbeitsblatt."],
    ["lernen-els.html", "Sicherheits-Lab: Schutz, Prüfung, Rettung", "Gefährdung und Schutzebenen, Stromwirkung auf den Körper, Schutzklassen und Schutzart, Netzformen und Abschaltbedingung, LS-Schalter und Sicherungen, RCD, Isolations- und Schutzleiterwiderstand, Geräteprüfung nach VDE 0701-0702 mit Protokoll, Sicherheitsregeln und Rettungskette. Alle Werte außer…"],
    ["lernen-nts.html", "Netzteil-Lab: Netzteile und Schaltregler", "Funktionsblöcke und Leistungsbilanz, Transformator, Gleichrichter und Siebung mit Brummspannung, Z-Diode, Linearregler (7805, LM317) mit Verlustleistung, Schaltregler (Tiefsetzsteller, Hochsetzsteller, Inverswandler, Sperrwandler), Gate-Ansteuerung und Schaltverluste, Rückkopplung und…"],
    ["lernen-wsl.html", "Wechselstrom-Lab: Wechselstrom und Schwingkreise", "Sinusgrößen mit Effektivwert, Phase und Zeigerbild, Spule und Kondensator mit Blindwiderstand, Reihen- und Parallelschaltung mit Impedanz, Wirk-, Blind- und Scheinleistung, Blindleistungskompensation, Reihen- und Parallelschwingkreis mit Resonanz, Güte und Bandbreite, RC- und RL-Filter mit…"],
    ["lernen-ana.html", "Analogtechnik-Lab: Halbleiter und Verstärker", "Diode, LED und Z-Diode mit Vorwiderstand, Transistor als Schalter mit Relais und Freilaufdiode, Arbeitspunkt und Emitterschaltung, Emitterfolger und Stromquellen, Operationsverstärker als Invertierer, Nichtinvertierer, Komparator und Schmitt-Trigger sowie Integrierer, Filter und der reale…"],
    ["lernen-haus.html", "Elektroinstallation", "Stromkreise, Verteilerkasten, Leitungen, Schalten, Last verteilen und Fehlersuche im 3D-Haus. Mit Arbeitsblatt."],
    ["lernen-app.html", "App-Werkstatt: Eigene Apps mit KI", "Aufträge an eine KI schreiben, Apps prüfen und weitergeben, Notizen im Obsidian-Format. Mit Arbeitsblatt, ohne Vorkenntnisse."],
    ["lernen-sps.html", "SPS-Lab: Steuerungen programmieren", "Zyklus einer SPS, Adressen in IEC und Siemens, KOP, FUP und GRAFCET, Zeitglieder, Zähler, vier Anlagen und Fehlersuche. Mit Arbeitsblatt zu allen 43 Aufgaben."],
    ["lernen-pcb.html", "Leiterplatten-Lab: Entwurf, Fertigung und Prüfung", "Lagen und Vias, Bahnbreite nach IPC, Masse und Rückstrom, DRC, Gerber-Daten, Bestücken und Löten, Fehlersuche und die Prüfverfahren SPI, AOI, AXI, ICT, Flying Probe und Boundary Scan. Mit Arbeitsblatt zu allen 49 Aufgaben."],
    ["lernen-ant.html", "Antriebs-Lab: Motoren, Regelung und Getriebe", "Drehzahl, Moment und Wirkungsgrad, Gleichstrommotor mit H-Brücke und PWM, Servo und Regelung, Schrittmotor, Drehstrom mit Typenschild und Stern-Dreieck, Frequenzumrichter, Getriebe und Fehlersuche. Mit Arbeitsblatt zu allen 54 Aufgaben."],
    ["lernen-sen.html", "Sensorik-Lab: Sensoren, Messketten und Normsignale", "Messkette vom Sensor bis zur Anzeige, Temperaturfühler (NTC, Pt100, Thermoelement) mit 2-, 3- und 4-Leiter-Technik, Licht und Näherungsschalter, DMS-Brücke und Kalibrierung, Beschleunigung, Normsignale 4…20 mA mit Drahtbruch, ADU und Aliasing sowie I²C-Sensoren. Mit Arbeitsblatt zu allen 49 Aufgaben."],
    ["lernen-reg.html", "Regelungstechnik-Lab: Regelkreis, Regler und Einstellen", "Wirkungsplan und Begriffe nach DIN 19226, Regelstrecken und Sprungantwort, P-, I- und D-Anteil, Stabilität und Schwingversuch, Einstellregeln nach Ziegler-Nichols, Chien-Hrones-Reswick und T-Summe, Zweipunktregler am Bügeleisen und Kühlschrank, Heizung, Tank, Drehzahl und Lage in der Praxis,…"],
    ["lernen-thm.html", "Thermik-Lab: Wärme, Kühlkörper und Wärmewiderstand", "Verlustleistung berechnen (Linearregler, Transistor, MOSFET, Diode, Widerstand), thermisches Ersatzschaltbild mit der Kette Rth_JC, Rth_CK und Rth_K, Wärmeleitpaste, Glimmerscheibe und Isolierbuchse, Kühlkörper mit Lüfter und Einbaulage, der Berechnungsgang für den erforderlichen Kühlkörper,…"],
    ["lernen-emv.html", "EMV-Lab: Störungen erkennen und beseitigen", "Störquelle, Kopplungspfad und Störsenke mit den drei Hebeln der Entstörung, Pegel und dB, Kopplungsarten, Spektrum und Oberwellen, Filter, Schirmung, Leitungen und Layout, ESD, Burst und Surge, Messen mit Tastkopf, Vorprüfung und ein Überblick über CE und Normen. Alle Grenzlinien und Prüfpegel…"],
    ["lernen-enr.html", "Energie-Lab: Solar, Akku, Wechselrichter", "Solarmodul-Kennlinie, Verschattung mit Bypassdioden, Laderegler mit Akku, Inselanlage und Netzeinspeisung. Mit Arbeitsblatt."],
    ["lernen-hf.html", "Funk- und HF-Lab: Hochfrequenz verstehen", "Dezibel, Pegel in dBm und dBµV, Pegelplan und Signal-Rausch-Abstand, Wellenlänge, Leitung und Kabeldämpfung, Anpassung mit Reflexionsfaktor, Stehwellenverhältnis und Rückflussdämpfung, Dipol, Antennengewinn und EIRP, Freiraumdämpfung und Streckenreserve, Modulation AM und FM, Empfänger und Rauschen, HF-Messtechnik. Alle Werte sind Übungswerte. Mit Arbeitsblatt."],
    ["lernen-arduino.html", "Arduino verstehen", "Vom ersten Blinken zu Sensoren und Servo: 11 Kapitel mit Probier es aus-Knöpfen und Aufgaben mit automatischer Prüfung im Arduino-Lab."],
    ["lernen-pi.html", "Raspberry Pi verstehen", "Was ist ein Pi, Inbetriebnahme (auch ohne Monitor), die GPIO-Leiste, Python, LED, Taster, Sensoren und sicheres Arbeiten."],
    ["lernen-tol.html", "Toleranz-Lab: Messen, Toleranzen und Passungen", "Messen, Toleranzfelder, Passungen, Form- und Lagetoleranzen und Oberflächen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-zer.html", "Zerspan-Lab: Schnittwerte, Kräfte und Hauptzeit", "Schnittgeschwindigkeit, Drehzahl, Vorschub, Schnittkraft und Hauptzeit berechnen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-hyd.html", "Hydraulik-Lab: Druck, Kraft und Schaltungen", "Druck, Kraft, Volumenstrom, Zylinder, Ventile und Schaltungen lesen und rechnen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-cnc.html", "CNC-Lab: Programmieren nach DIN 66025", "Koordinaten, Wegbedingungen, Korrekturen und Zyklen, Programme lesen und schreiben. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-wer.html", "Werkstoff-Lab: Kennwerte, Härte und Wärmebehandlung", "Zugversuch, Härteprüfung, Eisen und Stahl, Wärmebehandlung und Werkstoffwahl. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-ins.html", "Instandhaltungs-Lab: Warten, Prüfen und Fehler suchen", "Wartung, Inspektion, Instandsetzung, Verschleiß und systematische Fehlersuche. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-pne.html", "Pneumatik-Lab: Druckluft, Ventile und Schaltungen", "Druckluft, Zylinder, Ventile, Steuerungen und Schaltpläne lesen und rechnen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-fug.html", "Füge-Lab: Schweißen, Löten, Kleben, Schrauben", "Fügeverfahren richtig wählen und rechnen: Naht, Lötspalt, Klebfläche, Schraube, Passfeder. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-mas.html", "Maschinenelemente-Lab: Getriebe, Lager, Kupplungen, Federn", "Zahnräder, Riemen, Ketten, Wälzlager, Kupplungen, Bremsen, Dichtungen und Federn. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-mch.html", "Mechanik-Lab: Kräfte, Momente, Festigkeit", "Kräfte zerlegen, Hebel, Auflagerkräfte, Reibung, Spannung und Dehnung. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-fer.html", "Fertigungs-Lab: Verfahren, Handfertigung, Planung und Qualität", "Fertigungsverfahren, Biegen, Gewinde, Zuschnitt, Qualitätsregelkarte und Vorrichtungen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-mak.html", "Maschinen-Lab: Bohren, Drehen, Fräsen, Sägen und CNC-Bedienung", "Die Werkstattmaschinen sicher bedienen, Drehzahlen lesen und berechnen, spannen und Maschine wählen. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-zei.html", "Zeichnungs-Lab: Ansichten, Linien, Bemaßung und Schnitte", "Blattformate und Normschrift, Linienarten, drei Ansichten nach Projektionsmethode 1, verdeckte Kanten, Bemaßung, Maßstab, Schnitte, Schrägbilder und Pläne der Elektrotechnik. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-kon.html", "Konstruktions-Lab: Normteile, Schrauben, Lager und Toleranzen", "Normteile und Stücklisten, Gewinde und Schraubenverbindungen, Passfeder und Schrumpfverband, Wälzlager, Federn, Form- und Lagetoleranzen, Oberflächenangaben und fertigungsgerechtes Konstruieren. Mit Arbeitsblatt zu allen Aufgaben."],
    ["lernen-ds.html", "Datenblatt-Lab: Datenblätter lesen und verstehen", "Aufbau eines Datenblatts, Grenzwerte und Betriebswerte, Min, Typ und Max, Kennlinien mit logarithmischer Achse, Thermik und Derating, Auslegung mit LED, Transistor und Regler, Bauteilwahl, Zeitdiagramme und Register sowie Fachenglisch. Die Datenblätter im Lab sind fiktive Übungsdatenblätter. Mit…"],
    ["lernen-pr.html", "Prüfungs-Lab: Für die Abschlussprüfung üben", "Aufbau der Prüfung, sicher rechnen, die acht Themen, Lernplan und Strategie. Mit Arbeitsblatt."],
    ["lernen-w24.html", "Praxisschaltung W-2024 verstehen", "Die Schaltung der Praxisprüfung W-2024 Schritt für Schritt: Aufbau, Bauteile, Wirkungsweise und Fehlersuche, mit sieben Arbeitsblättern und einer Probeprüfung zum Ausdrucken. Die Lösungen sind für Ausbilder gedacht und liegen verschlüsselt im Lab."],
    ["lernen-vb.html", "Projekte: Verbundprojekte", "Projekte für alle Berufe, in denen mehrere Labs an einem Auftrag zusammenarbeiten: von Garagentor, Ampelanlage und Heizungsregelung über die Pneumatische Presse und den Kundenauftrag im Lager bis zur Kalkulation, zum Werkstatt-Netz und zum Gehäuse für das Labornetzteil, dazu der Tonfunk-Auftrag, der alle Berufe verbindet. Ablauf, Stufen und Punkte, Datenübergabe, die Projekte mit Beispiel-Lastenheft, Formeln, Tipps, Abschlussbericht und Hinweise für die Gruppenarbeit. Mit…"]
  ];
  // Seiten, die kein Heft und kein Lab sind: erscheinen in der Gruppe der Hefte mit eigener Marke [Datei, Titel, Stichwörter]
  const SEITEN = [['ausbildungsplan.html', 'Ausbildungsplan: Lernfelder deines Berufs', 'Lernfeld Lernfelder Ausbildungsjahr Berufsschule Fortschritt Als Nächstes Prüfung AP1 AP2 Plan Heft Projekt']];
  /* Reiter in Labs, deren Inhalt nicht im Aufgabenverzeichnis steht (v62.173): eigene Gruppe „In den Labs“ mit der Marke „Reiter“ [Ziel, Lab, Reiter, Stichwörter].
     Die Adresse nennt den Reiter (?tab=…). Labs, die den Parameter noch nicht auswerten, öffnen sich normal; der Treffer nennt den Reiter deshalb auch im Text. Test: test_home.js */
  const REITER = [
    ['pcblab.html?tab=esd', 'Leiterplatten-Lab', 'ESD', 'ESD-Schutz EPA elektrostatisch geschützter Bereich elektrostatische Entladung Aufladung Erdung Erdungspunkt Handgelenkband ESD-Schuhe Fußboden ableitfähig Ionisator Offset-Spannung Verpackung Abschirmbeutel Körpermodell HBM CDM Begehtest'],
    ['pcblab.html?tab=fehler', 'Leiterplatten-Lab', 'Fehlerbild', 'Fehlerbilder Lötfehler Lötbrücke kalte Lötstelle Tombstone Grabstein Voids Lunker Pseudofehler AOI Benetzung Schutzlack Lackierung Verguss Von Symptom zur Ursache Ausbeute First Pass Yield RTY Rückverfolgung Rückverfolgbarkeit Charge Seriennummer Linie A'],
    ['toulab.html?tab=plan', 'Touren-Lab', 'Tourenplaner', 'Touren Tour Tourenplanung Rundtour Nächster Nachbar kürzeste Strecke Zeitfenster Kunden Lkw Karte'],
    ['toulab.html?tab=fzg', 'Touren-Lab', 'Fahrzeug', 'Touren Fahrzeugwahl Nutzlast Stellplätze Lademeter Europalette Ladevolumen Auslastung Ladereihenfolge Last In First Out'],
    ['toulab.html?tab=zeit', 'Touren-Lab', 'Lenkzeiten', 'Touren Lenkzeit Ruhezeit Fahrtunterbrechung Pause Tageslenkzeit Wochenlenkzeit Doppelwoche'],
    ['toulab.html?tab=kost', 'Touren-Lab', 'Kosten', 'Touren Tourkosten Kilometersatz Stundensatz Kosten je Palette Leerfahrt Spedition'],
    ['syalab.html?tab=geraet', 'Systemanalyse-Lab', 'Gerät', 'Systemanalyse Fehlersuche Blockschaltbild Messpunkt Messprotokoll Halbierungsmethode Netzteil Brummspannung Festspannungsregler Relaistreiber'],
    ['syalab.html?tab=vde', 'Systemanalyse-Lab', 'Geräteprüfung', 'Systemanalyse Prüfung nach Instandsetzung Schutzleiterwiderstand Isolationswiderstand Schutzleiterstrom Berührungsstrom Sichtprüfung'],
    ['syalab.html?tab=dim', 'Systemanalyse-Lab', 'Bauteile', 'Systemanalyse dimensionieren Ladeelko Kühlkörper Wärmewiderstand Basiswiderstand Freilaufdiode Kostenvoranschlag Abschlussprüfung Teil 2'],
    ['kunlab.html?tab=stoff', 'Kunststoff-Lab', 'Kunststoffe', 'Kunststoff Thermoplast Duroplast Elastomer amorph teilkristallin Recycling-Code'],
    ['kunlab.html?tab=verf', 'Kunststoff-Lab', 'Verfahren', 'Kunststoff Spritzgießen Spritzguss Zykluszeit Kühlzeit Nachdruck Auswerfer Extrudieren Blasformen Tiefziehen 3D-Druck Urformen'],
    ['kunlab.html?tab=gest', 'Kunststoff-Lab', 'Gestalten', 'Kunststoff spritzgussgerecht Wanddicke Rippe Einfallstelle Entformungsschräge Radius Kerbe Hinterschnitt Anguss Bindenaht Schraubdom'],
    ['kunlab.html?tab=mass', 'Kunststoff-Lab', 'Schwindung', 'Kunststoff Schwindung Werkzeugmaß Formnest'],
    ['kunlab.html?tab=verb', 'Kunststoff-Lab', 'Verbindungen', 'Kunststoff Schnapphaken Filmscharnier Ultraschallschweißen'],
    ['kunlab.html?tab=kost', 'Kunststoff-Lab', 'Kosten', 'Kunststoff Werkzeugkosten Stückkosten Break-even 3D-Druck'],
    ['prdlab.html?tab=fer', 'Produktions-Lab', 'Fertigung', 'Produktion Fertigungsarten Werkstattfertigung Fließfertigung Gruppenfertigung Einzelfertigung Serienfertigung Massenfertigung'],
    ['prdlab.html?tab=kap', 'Produktions-Lab', 'Kapazität', 'Produktion Kapazität Beschäftigungsgrad Auslastung Engpass'],
    ['prdlab.html?tab=los', 'Produktions-Lab', 'Losgröße', 'Produktion optimale Losgröße Andler Rüstkosten Lagerkosten'],
    ['prdlab.html?tab=ter', 'Produktions-Lab', 'Termine', 'Produktion Durchlaufzeit Auftragszeit Vorwärtsterminierung Rückwärtsterminierung Puffer Balkendiagramm'],
    ['prdlab.html?tab=kan', 'Produktions-Lab', 'Lean', 'Produktion Kanban Just in Time Lean PDCA Ausschussquote Stückliste Bruttobedarf Nettobedarf Produktivität Wirtschaftlichkeit'],
    ['mktlab.html?tab=mf', 'Marketing-Lab', 'Markt', 'Marketing Marktforschung Primärforschung Sekundärforschung Marktanteil Marktvolumen Marktpotenzial Zielgruppe Befragung'],
    ['mktlab.html?tab=mix', 'Marketing-Lab', 'Zyklus', 'Marketing Marketing-Mix Produktlebenszyklus Portfolio Produktpolitik Sortiment'],
    ['mktlab.html?tab=pre', 'Marketing-Lab', 'Preis', 'Marketing Preispolitik Preisdifferenzierung Preiselastizität Rabatt Skonto Deckungsbeitrag'],
    ['mktlab.html?tab=wer', 'Marketing-Lab', 'Werbung', 'Marketing Kommunikationspolitik Werbung AIDA Werbeplan Werbeerfolg Tausenderkontaktpreis'],
    ['mktlab.html?tab=bud', 'Marketing-Lab', 'Budget', 'Marketing Werbebudget Werbeerfolgskontrolle Wettbewerbsrecht unlauterer Wettbewerb'],
    ['lotlab.html?tab=loet', 'Löt-Lab', 'Lötstelle', 'Löten Lötstelle Lot Flussmittel Benetzung Benetzungswinkel Hohlkehle Lötauge Lötkolben Temperatur bleifrei THT Durchsteckmontage'],
    ['lotlab.html?tab=reflow', 'Löt-Lab', 'Reflow', 'Löten Reflow Lötprofil Lotpaste SMD Vorwärmen Peak TAL Schmelzpunkt Ofen'],
    ['lotlab.html?tab=fehler', 'Löt-Lab', 'Fehlerbilder', 'Löten Fehlerbild kalte Lötstelle Lötbrücke Lunker Grabstein Lotkugel zu wenig Lot IPC-A-610 Klasse Prozessindikator ESD Entlöten Nacharbeit Lötprüfung'],
    ['buslab.html?tab=uart', 'Bus-Lab', 'UART', 'Bus UART serielle Schnittstelle Baudrate Bitzeit Startbit Stoppbit Parität Rahmen 8N1 Übertragungszeit'],
    ['buslab.html?tab=can', 'Bus-Lab', 'CAN', 'Bus CAN CAN-Bus Arbitrierung dominant rezessiv Kennung Identifier Priorität Bitrate Leitungslänge'],
    ['buslab.html?tab=rs', 'Bus-Lab', 'RS-485', 'Bus RS-232 RS-485 differenziell Abschlusswiderstand 120 Ohm Reflexion Halbduplex Linie Modbus USB Ethernet Funk dBm CRC Hamming Feldbus'],
    ['miklab.html?tab=tim', 'Mikrocontroller-Lab', 'Timer', 'Mikrocontroller Timer Vorteiler Vergleichswert OCR CTC PWM Fast-PWM Tastgrad Überlauf Register Takt'],
    ['miklab.html?tab=adc', 'Mikrocontroller-Lab', 'AD-Wandler', 'Mikrocontroller AD-Wandler ADC LSB Auflösung Referenzspannung Spannungsteiler Messwert'],
    ['miklab.html?tab=zus', 'Mikrocontroller-Lab', 'Zustandsautomat', 'Mikrocontroller Zustandsautomat Ampel millis Interrupt ISR volatile Entprellen Arduino'],
    ['miklab.html?tab=slp', 'Mikrocontroller-Lab', 'Schlafmodus', 'Mikrocontroller Schlafmodus Sleep Energiesparen Batterielaufzeit mittlerer Strom'],
    ['drklab.html?tab=vor', '3D-Druck-Lab', 'Slicer-Vorschau', '3D-Druck FDM Slicer Schichthöhe Wände Füllung Druckzeit Materialkosten Masse Bambu Studio Bambu Lab'],
    ['drklab.html?tab=feh', '3D-Druck-Lab', 'Fehlerbilder', '3D-Druck Fehlerbild Warping Stringing Elefantenfuß Unterextrusion Düse Heizbett Bauplatte Rückzug Lüfter'],
    ['drklab.html?tab=aus', '3D-Druck-Lab', 'Überhang', '3D-Druck Überhang Stützen Brim Ausrichtung Brücke 45 Grad'],
    ['drklab.html?tab=fil', '3D-Druck-Lab', 'Filamente', '3D-Druck Filament PLA PETG ABS TPU Trocknung Temperatur Dichte'],
    ['cadlab.html?tab=sk', '3D-Modellierungs-Lab', 'Skizze', '3D-Modellierung CAD parametrisch Skizze Bedingung Freiheitsgrad voll bestimmt Bemaßung SolidCraft'],
    ['cadlab.html?tab=ft', '3D-Modellierungs-Lab', 'Zeitleiste', '3D-Modellierung CAD Extrusion Rotation Rundung Fase Schale Bohrung Muster Spiegeln Feature-Baum Zeitleiste Parameter'],
    ['cadlab.html?tab=bo', '3D-Modellierungs-Lab', 'Boolesch', '3D-Modellierung CAD boolesche Operation Vereinigung Differenz Schnittmenge Baugruppe Zusammenbau STL STEP 3MF'],
    ['flilab.html?tab=li', 'Linien-Lab', 'Linie', 'Linien Fertigungslinie Takt Taktzeit Kundentakt Engpass Durchsatz Durchlaufzeit Puffer Bestand Little Ausschuss Ausbeute Gesamtausbeute RTY Störung'],
    ['flilab.html?tab=rv', 'Linien-Lab', 'Rückverfolgung', 'Linien Rückverfolgbarkeit Charge Verpackungs-Kennung Seriennummer Rückruf Los eingrenzen'],
    ['flilab.html?tab=lv', 'Linien-Lab', 'Lack und Verguss', 'Linien Lackieren Lackierung Schutzlack Maskieren Ablüften Aushärten Verguss Vergussmasse Topfzeit Mischungsverhältnis Harz Härter'],
    ['ksplab.html?tab=sh', 'Kleinsteuerungs-Lab', 'Selbsthaltung', 'Kleinsteuerung Selbsthaltung Schütz Relais Wendeschaltung Verriegelung Stromlaufplan Taster Öffner Schließer'],
    ['ksplab.html?tab=fup', 'Kleinsteuerungs-Lab', 'Funktionsplan', 'Kleinsteuerung Funktionsplan FUP UND ODER NICHT Einschaltverzögerung Ausschaltverzögerung Wischer Zähler Speicher'],
    ['ksplab.html?tab=ep', 'Kleinsteuerungs-Lab', 'Elektropneumatik', 'Elektropneumatik Magnetventil 5/2-Ventil monostabil bistabil Zylinder Endlage Reedkontakt Endschalter Ablauf'],
    ['ksplab.html?tab=sen', 'Kleinsteuerungs-Lab', 'Sensor', 'Kleinsteuerung Sensor induktiv kapazitiv optisch Schaltabstand Hysterese PNP NPN Drahtbruch Status-LED 24 V'],
    ['edalab.html?tab=sim', 'Simulations- und EDA-Lab', 'Simulation', 'Simulation Arbeitspunkt Zeitverlauf Transientenanalyse Frequenzgang AC-Analyse Bode Grenzfrequenz Parameter-Sweep Brummspannung Toleranz'],
    ['edalab.html?tab=erc', 'Simulations- und EDA-Lab', 'ERC', 'EDA Schaltplan ERC elektrische Regelprüfung Netzliste Netzname Pin Treiber Versorgung Footprint Zuordnung'],
    ['edalab.html?tab=ger', 'Simulations- und EDA-Lab', 'Gerber', 'EDA Gerber Fertigungsdaten Bohrdatei Lötstoppmaske Bestückungsdruck Pastenlage Kontur DFM Restring Stückliste BOM Nutzen'],
    ['bmklab.html?tab=plan', 'Plan-Lab', 'Stromlaufplan', 'Plan lesen Stromlaufplan Schaltplan Strompfad Kontaktspiegel Querverweis Übersichtsplan Plantypen Schaltzeichen'],
    ['bmklab.html?tab=kz', 'Plan-Lab', 'Kennzeichen', 'Betriebsmittelkennzeichnung BMK Kennbuchstabe Referenzkennzeichen Funktion Ort Produkt Anschluss Schütz Relais'],
    ['bmklab.html?tab=klem', 'Plan-Lab', 'Klemmenplan', 'Klemmenplan Klemmleiste Verdrahtungsliste Anschlussplan Anschlussbezeichnung Hilfskontakt Leiterfarben Klemme'],
    ['iotlab.html?tab=dk', 'Industrie-4.0-Lab', 'Datenkette', 'Industrie 4.0 IIoT Datenkette Sensor Gateway Edge Cloud Dashboard Datenmenge Datenrate Abtastintervall'],
    ['iotlab.html?tab=mq', 'Industrie-4.0-Lab', 'MQTT', 'Industrie 4.0 MQTT Broker Topic Publish Subscribe Platzhalter QoS Retain Port 1883 8883'],
    ['iotlab.html?tab=zu', 'Industrie-4.0-Lab', 'Zustand', 'Industrie 4.0 Zustandsüberwachung vorausschauende Wartung Predictive Maintenance Grenzwert Trend digitaler Zwilling OPC UA Modbus TCP']
  ];
  const toStr = s => String(s == null ? '' : s);
  // Umlaute zu ae/oe/ue/ss (Eingabe "waerme" findet "Wärme"); fold: zusätzlich Akzente weg ("warme" findet auch "Wärme")
  const norm = s => toStr(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const fold = s => toStr(s).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const toks = s => toStr(s).trim().split(/\s+/).filter(Boolean);
  const MIN = 2, MAX_LAB = 8, MAX_HEFT = 6, MAX_AUFG = 10, MAX_ORT = 4, MAX_WIKI = 4, MAX_WIKI_REGLER = 2;
  // Wiki-Treffer ({id, kat, titel, labs}) in Eintraege (Bauteile, Geraete, Begriffe ...) und Regler/Messwerte trennen; Regler hoechstens 2, nie vor den Eintraegen
  const isReg = e => e && (e.kat === 'regler' || e.kat === 'messwert');
  function wikiSplit(hits) {
    const a = (hits || []).filter(e => e && e.id && e.titel);
    return { wiki: a.filter(e => !isReg(e)).slice(0, MAX_WIKI), reg: a.filter(isReg).slice(0, MAX_WIKI_REGLER) };
  }
  const wikiHref = id => 'wiki.html#e=' + encodeURIComponent(id);
  function prep(e) { const t = e.text || ''; e._n = norm(t); e._f = fold(t); e._nn = norm(e.name); e._nf = fold(e.name); return e; }
  const hit = (n, f, tn, tf) => tn.every((t, i) => n.indexOf(t) >= 0 || f.indexOf(tf[i]) >= 0);
  // Eintrag passt, wenn jedes Wort der Eingabe im Text vorkommt; Rang: Name vor Text, Labs vor Lab-Reitern vor Heften vor Aufgaben
  function search(idx, q) {
    const qq = toStr(q).trim(); if (qq.length < MIN) return { active: false, labs: [], orte: [], hefte: [], aufg: [], n: { lab: 0, ort: 0, heft: 0, aufg: 0 } };
    const tn = toks(norm(qq)), tf = toks(fold(qq)), out = { lab: [], ort: [], heft: [], aufg: [] };
    idx.forEach((e, i) => {
      if (!hit(e._n, e._f, tn, tf)) return;
      out[e.typ === 'aufg' ? 'aufg' : e.typ === 'heft' ? 'heft' : e.typ === 'ort' ? 'ort' : 'lab'].push({ e, nm: hit(e._nn, e._nf, tn, tf) ? 0 : 1, i });
    });
    const srt = a => a.sort((x, y) => x.nm - y.nm || x.i - y.i).map(x => x.e);
    const labs = srt(out.lab), orte = srt(out.ort), hefte = srt(out.heft), aufg = srt(out.aufg);
    return { active: true, labs, orte: orte.slice(0, MAX_ORT), hefte: hefte.slice(0, MAX_HEFT), aufg: aufg.slice(0, MAX_AUFG), n: { lab: labs.length, ort: orte.length, heft: hefte.length, aufg: aufg.length } };
  }
  const countText = n => {
    const p = []; if (n.lab) p.push(n.lab + (n.lab === 1 ? ' Lab' : ' Labs')); if (n.ort) p.push(n.ort + ' Lab-Reiter'); if (n.heft) p.push(n.heft + (n.heft === 1 ? ' Heft' : ' Hefte')); if (n.aufg) p.push(n.aufg + (n.aufg === 1 ? ' Aufgabe' : ' Aufgaben')); if (n.wiki) p.push(n.wiki + (n.wiki === 1 ? ' Wiki-Eintrag' : ' Wiki-Einträge'));
    return p.length ? p.join(', ') : 'Nichts gefunden';
  };
  function buildIndex(REG, ROWS, labEntries) {
    const idx = [];
    (labEntries || []).forEach(l => idx.push(prep(Object.assign({ typ: 'lab' }, l))));
    REITER.forEach(o => idx.push(prep({ typ: 'ort', key: o[0], name: o[1] + ': Reiter „' + o[2] + '“', text: o[1] + ' Reiter ' + o[2] + ' ' + o[3], href: o[0], lab: o[1], reiter: o[2] })));
    SEITEN.forEach(h => idx.push(prep({ typ: 'heft', ty: 'Plan', key: h[0].replace(/\.html$/, ''), name: h[1], text: h[1] + ' ' + h[2], href: h[0] })));
    HEFTE.forEach(h => idx.push(prep({ typ: 'heft', key: h[0].replace(/\.html$/, ''), name: h[1], text: h[1] + ' ' + h[2] + ' Lernheft', href: h[0] })));
    (ROWS || []).forEach(r => { const R = REG[r[1]]; if (!R) return; idx.push(prep({ typ: 'aufg', key: r[0], name: r[3], text: r[2] + ' ' + r[3] + ' ' + R.name + ' ' + (R.short || ''), href: R.file + '?aufgabe=' + r[0], lab: R.short || R.name, thema: r[2] })); });
    return idx;
  }
  if (typeof module === 'object' && module.exports) module.exports = { norm, fold, search, countText, buildIndex, wikiSplit, wikiHref, HEFTE, SEITEN, REITER, MIN, MAX_HEFT, MAX_AUFG, MAX_ORT, MAX_WIKI, MAX_WIKI_REGLER };
  if (typeof document === 'undefined') return;

  const doc = document, esc = s => toStr(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const form = doc.getElementById('srch'), input = doc.getElementById('srchIn'), res = doc.getElementById('srchRes'), clr = doc.getElementById('srchClr'), live = doc.getElementById('srchLive');
  if (!form || !input || !res) return;
  form.hidden = false;
  let idx = null, cards = [], active = -1, lastQ = '', tmr = 0;

  /* ---- Wiki (W12a): Skripte lazy, nur auf Suchfokus bzw. ersten Tastendruck ---- */
  const inj = {}, WBASE = ['wiki.js', 'wiki-suche.js', 'wiki-index.js'];
  let wikiOk = false, wikiBaseP = null, wikiRegP = null;
  const inject = src => inj[src] || (inj[src] = new Promise(res => { const sc = doc.createElement('script'); sc.src = src; sc.async = true; sc.onload = () => res(true); sc.onerror = () => res(false); doc.head.appendChild(sc); }));
  function wikiBase() {
    if (!wikiBaseP) wikiBaseP = Promise.all(WBASE.map(inject)).then(r => { wikiOk = r.every(Boolean) && !!(root.Wiki && root.Wiki.search && root.WikiSuche && root.WikiIndex); if (wikiOk && input.value.trim().length >= MIN) update(); return wikiOk; });
    return wikiBaseP;
  }
  function wikiReg() {   // Regler-Index (195 KB) erst nach dem ersten Tastendruck
    if (!wikiRegP) wikiRegP = wikiBase().then(ok => ok ? inject('wiki-index-regler.js') : false).then(ok => { if (ok && input.value.trim().length >= MIN) update(); return ok; });
    return wikiRegP;
  }
  function wikiHits(q) {
    if (!wikiOk) return { wiki: [], reg: [] };
    try { return wikiSplit(root.Wiki.search(q)); } catch (e) { return { wiki: [], reg: [] }; }
  }

  function init() {
    if (idx) return;
    cards = Array.from(doc.querySelectorAll('.card')).filter(c => !c.classList.contains('hm-ghost'));
    // Die Wiki-Kachel ist kein Lab: nicht im Suchindex (zählt nicht als "Lab"-Treffer), sie wird bei aktiver Suche ausgeblendet; Wiki-Treffer stehen in der Gruppe "Im Wiki"
    const labs = cards.filter(c => !c.classList.contains('wikirow')).map(c => {
      const tag = c.querySelector('.tag'), h = c.querySelector('h3');
      const text = Array.from(c.querySelectorAll('.tag,h3,p,.steps span')).map(x => x.textContent).join(' ') + ' ' + (c.dataset.such || '');   // data-such: Stichwörter, die nicht auf der Karte stehen (Reiter im Lab)
      return { key: c.dataset.lab || c.dataset.hub || '', name: (tag ? tag.textContent : '') + ' ' + (h ? h.textContent : ''), text, el: c };
    });
    idx = buildIndex(root.LAB_REG || {}, root.AUFGABEN || [], labs);
  }
  const opts = () => Array.from(res.querySelectorAll('[role=option]'));
  function setActive(i) {
    const o = opts(); if (!o.length) { active = -1; input.removeAttribute('aria-activedescendant'); return; }
    active = (i + o.length) % o.length;
    o.forEach((a, k) => a.setAttribute('aria-selected', k === active ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', o[active].id); o[active].scrollIntoView({ block: 'nearest' });
  }
  function showRes(on) { res.hidden = !on; input.setAttribute('aria-expanded', on ? 'true' : 'false'); if (!on) { active = -1; input.removeAttribute('aria-activedescendant'); } }
  function say(msg) { clearTimeout(tmr); tmr = setTimeout(() => { live.textContent = msg; }, 450); }

  function update() {
    init();
    const q = input.value; lastQ = q; clr.hidden = !q;
    const r = search(idx, q);
    const wh = r.active ? wikiHits(q) : { wiki: [], reg: [] }, wl = wh.wiki.concat(wh.reg); r.n.wiki = wl.length;
    doc.documentElement.classList.toggle('srch-on', r.active);
    if (!r.active) { res.innerHTML = ''; showRes(false); live.textContent = ''; return; }
    let h = '', n = 0;
    const row = (e, ty, meta) => '<a role="option" id="srchO' + (n++) + '" href="' + esc(e.href) + '" tabindex="-1" aria-selected="false"><span class="ty">' + ty + '</span><span class="nm">' + esc(e.name) + '</span>' + (meta ? '<span class="sb">' + esc(meta) + '</span>' : '') + '</a>';
    /* Labs zuerst (S-21): Ziel ist der Hauptknopf der Karte; Labs, die nicht zum gewählten Beruf gehören, tragen einen Hinweis */
    const labRows = r.labs.filter(e => e.el && !e.el.classList.contains('lb-nie')).slice(0, MAX_LAB).map(e => { const a = e.el.querySelector('.btns a.btn.pri') || e.el.querySelector('.btns a'); return row({ href: a ? a.getAttribute('href') : '#', name: e.name.trim() }, 'Lab', e.el.classList.contains('be-out') ? 'gehört zu einem anderen Beruf' : ''); });
    if (labRows.length) h += '<div role="group" aria-label="Labs"><div class="ghd" aria-hidden="true">Labs</div>' + labRows.join('') + '</div>';
    if (r.orte.length) h += '<div role="group" aria-label="In den Labs"><div class="ghd" aria-hidden="true">In den Labs</div>' + r.orte.map(e => row(e, 'Reiter', 'Reiter „' + e.reiter + '“ in der Reiterleiste oben im ' + e.lab)).join('') + '</div>';
    if (r.hefte.length) h += '<div role="group" aria-label="Lernhefte"><div class="ghd" aria-hidden="true">Lernhefte</div>' + r.hefte.map(e => row(e, e.ty || 'Heft', '')).join('') + '</div>';
    // W9 (Design-Review P2-8): Wiki-Treffer zweizeilig wie im Wiki selbst (Icon, Titel mit Indizes, Pille Kategorie, Lab darunter) + Zeile "Alle Wiki-Treffer"
    const wrow = e => { const W = root.Wiki, reg = /^(regler|messwert)$/.test(e.kat), lab = reg && e.labs && e.labs[0] && W.LABS[e.labs[0]] ? W.LABS[e.labs[0]][0] : '';
      return '<a role="option" class="wkr" id="srchO' + (n++) + '" href="' + esc(wikiHref(e.id)) + '" tabindex="-1" aria-selected="false"><svg class="ri" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/><path d="M9 7h7M9 10.5h7"/></svg><span class="nm">' + (W.formel ? W.formel(e.titel) : esc(e.titel)) + '</span><span class="ty">' + esc(W.KAT && W.KAT[e.kat] ? W.KAT[e.kat][0] : e.kat) + '</span>' + (lab ? '<span class="sb">' + esc(lab) + '</span>' : '') + '</a>'; };
    if (wl.length) h += '<div role="group" aria-label="Im Wiki"><div class="ghd" aria-hidden="true">Im Wiki</div>' + wl.map(wrow).join('') + '<a role="option" class="wkr more" id="srchO' + (n++) + '" href="wiki.html#q=' + encodeURIComponent(q.trim()) + '" tabindex="-1" aria-selected="false"><span class="nm">Alle Wiki-Treffer für „' + esc(q.trim()) + '“ →</span></a></div>';
    if (r.aufg.length) h += '<div role="group" aria-label="Aufgaben"><div class="ghd" aria-hidden="true">Aufgaben</div>' + r.aufg.map(e => row(e, 'Aufgabe', e.lab + ' · ' + e.thema)).join('') + '</div>';
    const ct = countText(r.n);
    if (!labRows.length && !r.n.ort && !r.n.heft && !r.n.aufg && !wl.length) h = '<p class="none">Nichts gefunden. Versuch einen kürzeren Begriff.</p>';
    else h = '<p class="cnt" aria-hidden="true">' + esc(ct) + (r.n.lab > labRows.length || r.n.heft > r.hefte.length || r.n.aufg > r.aufg.length ? ' (die besten stehen hier)' : '') + '</p>' + h;
    res.innerHTML = h; showRes(true); active = -1; say(ct);
  }
  function clear() { input.value = ''; update(); }
  function go(a) { if (a && a.href) location.href = a.href; }

  input.addEventListener('input', () => { if (input.value.trim().length >= 1) wikiReg(); update(); });
  input.addEventListener('focus', () => { wikiBase(); if (input.value.trim().length >= MIN && res.innerHTML) showRes(true); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { if (res.hidden && res.innerHTML) showRes(true); e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active < 0 ? -1 : active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault(); const o = opts();
      if (active >= 0 && o[active]) go(o[active]); else if (o.length) go(o[0]);
      else { const c = cards.find(x => !x.classList.contains('hm-hid') && x.offsetParent !== null), b = c && c.querySelector('.btns a'); if (b) b.focus(); }
    } else if (e.key === 'Escape') { if (input.value || !res.hidden) { e.preventDefault(); clear(); } }
  });
  clr.addEventListener('click', () => { clear(); input.focus(); });
  res.addEventListener('mousedown', e => e.preventDefault());       // Fokus bleibt im Feld, der Klick auf einen Treffer geht nicht verloren
  doc.addEventListener('pointerdown', e => { if (!form.contains(e.target)) showRes(false); });
  form.addEventListener('focusout', () => setTimeout(() => { if (!form.contains(doc.activeElement)) showRes(false); }, 150));
  doc.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey)) { e.preventDefault(); input.focus(); input.select(); }
  });
  root.HomeSearch = { search: q => { init(); return search(idx, q); }, update };
})(typeof window !== 'undefined' ? window : this);
