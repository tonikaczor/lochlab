/* mkplan:generiert (quelle/gen/mkplan.js aus lernfelder.js, aufgaben.js, wiki-index.js). Von Hand weiterpflegen: diese erste Zeile löschen, sonst überschreibt der Generator die Änderungen. Prüfung: node quelle/lernfaden/validate_plan.js egs */
'use strict';
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    beruf: "egs",
    titel: "Elektroniker für Geräte und Systeme",
    status: "entwurf",
    quelle: "Schulmitschriften der Berufsschule (lernfelder.js); Aufgaben-Zuordnung aus lernfelder.js, Lücken als Entwurf (Zusatz-Lernfelder Z-…); Prüfungsbezug AP1/AP2 aus dem Ausbildungsjahr abgeleitet",
    jahre: [
      { j: 1, t: "1. Ausbildungsjahr" },
      { j: 2, t: "2. Ausbildungsjahr" },
      { j: 3, t: "3. Ausbildungsjahr" },
      { j: 4, t: "4. Ausbildungsjahr" },
      { j: 0, t: "Übergreifend" }
    ],
    lernfelder: [
      {
        id: "E1",
        nr: "E1",
        titel: "Grundlagen E1: Strom, Spannung, Widerstand und Messen",
        kurz: "Du lernst: Ohmsches Gesetz, Reihen- und Parallelschaltung, Spannungsteiler; Strom und Spannung messen (Messgerät in Reihe oder parallel); Rechnen mit Einheiten, Vorsätzen und Formeln umstellen.",
        themen: [
          "Ohmsches Gesetz, Reihen- und Parallelschaltung, Spannungsteiler",
          "Strom und Spannung messen (Messgerät in Reihe oder parallel)",
          "Rechnen mit Einheiten, Vorsätzen und Formeln umstellen"
        ],
        jahr: 1,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", aufgaben: ["l1", "l2", "l3"] },
          { lab: "sch", bereich: ["Grundlagen", "Fehlersuche", "Zufallsaufgaben"] },
          {
            lab: "mess",
            bereich: [
              "Multimeter",
              "Leistung und Kennlinien",
              "Netzgerät und Generator",
              "Messfehler",
              "Fehlersuche",
              "Prüfung: Stromlaufplan"
            ]
          },
          { lab: "emv", bereich: ["Grundwissen"] },
          { lab: "pr", bereich: ["Stufe 1: Themen üben"] },
          { lab: "mat", bereich: ["Einheiten", "Dreisatz", "Prozent", "Umstellen", "Geometrie"] }
        ],
        heft: "lernen-mess.html",
        wiki: [
          "bd-oszi-lage",
          "fo-reihe-parallel",
          "bd-dmm-genauigkeit",
          "bd-dmm-sicherung",
          "bd-fgen-amplitude",
          "bd-fgen-frequenz"
        ],
        projekt: [
          { pid: "garage", station: ["vg3", "vg5"] },
          { pid: "ampel", station: ["va2", "va4"] },
          { pid: "uhr", station: ["vu3", "vu6"] },
          { pid: "giess", station: ["vw4", "vw6"] },
          { pid: "foerder", station: ["vf5", "vf7", "vf10"] },
          { pid: "netzteil", station: ["vl6", "vl8"] },
          { pid: "heizung", station: ["vh3", "vh9"] }
        ],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "E2",
        nr: "E2",
        titel: "Grundlagen E2: Schaltzeichen, Schaltpläne und einfache Installation",
        kurz: "Du lernst: Schaltzeichen nach Norm, Stromlaufplan und Übersichtsschaltplan; Ausschaltung, Wechselschaltung, Kreuzschaltung; Wechselstromkreis, Spannungserzeugung, Leiterkennzeichnung.",
        themen: [
          "Schaltzeichen nach Norm, Stromlaufplan und Übersichtsschaltplan",
          "Ausschaltung, Wechselschaltung, Kreuzschaltung",
          "Wechselstromkreis, Spannungserzeugung, Leiterkennzeichnung"
        ],
        jahr: 1,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", bereich: ["Fehlersuche"], aufgaben: ["l18", "l21"] },
          { lab: "sch", bereich: ["Filter und Gleichrichter"], aufgaben: ["sf5", "r4"] },
          { lab: "sim", bereich: ["Grundlagen", "Hausinstallation", "Fehlersuche"] },
          { lab: "haus", bereich: ["Licht", "Steckdosen", "Fehlersuche", "Frei gestalten", "Geschosse"] },
          { lab: "zei", fremd: true, aufgaben: ["zei56"] }
        ],
        heft: "lernen-haus.html",
        wiki: [
          "bt-spst",
          "nw-leiterfarben",
          "bg-messtechnik-begriffe",
          "bg-spannungserzeugung",
          "fo-energiekosten",
          "fo-widerstand-leiter"
        ],
        projekt: [
          { pid: "giess", station: ["vw1"] },
          { pid: "foerder", station: ["vf2"] },
          { pid: "heizung", station: ["vh1"] }
        ],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "E3",
        nr: "E3",
        titel: "Grundlagen E3: Steuerungen und Zahlensysteme",
        kurz: "Du lernst: Begriffe der Steuerungstechnik (Steuerung, Regelung); Schütz, Selbsthaltung, Verriegelung; Dual-, Hexadezimal- und Dezimalzahlen umrechnen.",
        themen: [
          "Begriffe der Steuerungstechnik (Steuerung, Regelung)",
          "Schütz, Selbsthaltung, Verriegelung",
          "Dual-, Hexadezimal- und Dezimalzahlen umrechnen"
        ],
        jahr: 1,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "sim", bereich: ["Steuerungstechnik"], aufgaben: ["zh", "schuetz", "selbst", "f3", "f10"] },
          { lab: "sps", bereich: ["Grundlagen"] }
        ],
        heft: "lernen-sim.html",
        wiki: ["bt-rly", "bt-thy", "bg-schuetz-steuerung", "bg-steuern-regeln", "bg-zahlensysteme", "bg-logikgatter"],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "5.1",
        nr: "5.1",
        titel: "LF 5.1: Netzsysteme und Überstromschutz",
        kurz: "Du lernst: TN-, TT- und IT-System, Schutzleiter und Erdung; Leitungsschutzschalter, Schmelzsicherung, Auslösebedingung; Körperstrom und Gefahren des elektrischen Stroms.",
        themen: [
          "TN-, TT- und IT-System, Schutzleiter und Erdung",
          "Leitungsschutzschalter, Schmelzsicherung, Auslösebedingung",
          "Körperstrom und Gefahren des elektrischen Stroms"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "sim", bereich: ["Leitungen und Messen"], aufgaben: ["schutz", "vt1", "f2"] },
          {
            lab: "els",
            bereich: ["Stromwirkung", "Prüfungsnah", "Schutzorgane", "RCD", "TT-System", "Schmelzsicherung"]
          },
          { lab: "haus", bereich: ["Verteiler", "Büro", "Leitungen", "Gesamtaufgabe"] },
          { lab: "pr", aufgaben: ["pr8"] },
          { lab: "ssl", bereich: ["Schutzorgane wählen", "Strom und Querschnitt"] }
        ],
        heft: "lernen-els.html",
        wiki: [
          "fo-koerperstrom",
          "bg-beruehrungsspannung",
          "bg-leiterarten",
          "bg-netzsysteme",
          "bg-ueberstromschutz",
          "bt-lss"
        ],
        projekt: [{ pid: "netzteil", station: ["vl10"] }],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "5.2",
        nr: "5.2",
        titel: "LF 5.2: Leistungsübertragung, Drehstrom und Schutzmaßnahmen",
        kurz: "Du lernst: Hausanschluss, Freileitung und Kabelnetz; Drehstrom: Stern- und Dreieckschaltung, Außenleiter, Neutralleiter; Fehlerarten, Schutzklassen und IP-Schutzarten, Wechselstromgrößen.",
        themen: [
          "Hausanschluss, Freileitung und Kabelnetz",
          "Drehstrom: Stern- und Dreieckschaltung, Außenleiter, Neutralleiter",
          "Fehlerarten, Schutzklassen und IP-Schutzarten, Wechselstromgrößen"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "sim", bereich: ["Drehstrom"], aufgaben: ["fi", "pe1", "sl3", "sl5", "sl6"] },
          { lab: "els", bereich: ["Schutzklassen", "Isolation und Schutzleiter", "Geräteprüfung", "Schutzmaßnahmen"] },
          {
            lab: "wsl",
            bereich: [
              "Prüfungsnah",
              "Sinus",
              "R, L, C",
              "Leistung",
              "Kompensation",
              "Schwingkreis",
              "Drehstrom",
              "Meisterstück",
              "Leistungsübertragung",
              "Induktion",
              "Wechselspannung"
            ]
          },
          { lab: "haus", bereich: ["Schutz", "Drehstrom", "Hausanschluss"], aufgaben: ["ha9"] },
          { lab: "enr", bereich: ["Grundlagen", "Wechselrichter"], aufgaben: ["en32", "en35"] },
          { lab: "pr", aufgaben: ["pr3"] }
        ],
        heft: "lernen-wsl.html",
        wiki: ["ger-leistung", "ger-fgen", "bg-drehstrom", "bt-netz", "bt-lamp", "ger-bode"],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "5.3",
        nr: "5.3",
        titel: "LF 5.3: Blockschaltbilder und Netzgeräte",
        kurz: "Du lernst: Blockschaltbild lesen und zeichnen; Transformator, Gleichrichtung, Siebung; Verlustleistung und Kühlkörper.",
        themen: [
          "Blockschaltbild lesen und zeichnen",
          "Transformator, Gleichrichtung, Siebung",
          "Verlustleistung und Kühlkörper"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", bereich: ["Projekt Netzteil"], aufgaben: ["l7", "l19", "lf3", "lf5"] },
          { lab: "sch", bereich: ["Projekt: Netzteil"], aufgaben: ["s5", "sf2", "s11"] },
          { lab: "nts", bereich: ["Transformator", "Gleichrichter"], aufgaben: ["nt1", "nt2", "nt4", "nt5", "nt8"] },
          { lab: "wsl", bereich: ["Transformator"], aufgaben: ["ws26", "ws28", "ws29"] },
          { lab: "pcb", bereich: ["Prüfungsstil"] },
          { lab: "thm", bereich: "*" },
          { lab: "enr", aufgaben: ["en42", "en37", "en38"] },
          { lab: "ds", bereich: ["Thermik und Derating", "Bauteilwahl"] },
          { lab: "pr", aufgaben: ["pr6"] },
          { lab: "ssl", bereich: ["Netzteil und Wärme"] }
        ],
        heft: "lernen-thm.html",
        wiki: [
          "bg-kuehlung-halbleiter",
          "fo-sperrschichttemperatur",
          "bg-netzteilarten",
          "bt-u",
          "fo-zener-vorwiderstand",
          "bg-blockschaltbild"
        ],
        projekt: [{ pid: "netzteil", station: ["vl5"] }, { pid: "tonfunk", station: ["vz7"] }],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "E6",
        nr: "E6",
        titel: "LF 6 Labor: Oszilloskop und Mischspannung",
        kurz: "Du lernst: Spannung und Zeit aus dem Schirmbild ablesen (Volt/div, Time/div); Gleich- und Wechselanteil, Kopplung, Tastkopf; Effektivwert, Phasenverschiebung, Frequenzgang.",
        themen: [
          "Spannung und Zeit aus dem Schirmbild ablesen (Volt/div, Time/div)",
          "Gleich- und Wechselanteil, Kopplung, Tastkopf",
          "Effektivwert, Phasenverschiebung, Frequenzgang"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "mess", bereich: ["Oszilloskop", "Frequenzgang"], aufgaben: ["m20", "mf4", "mf5"] },
          { lab: "wsl", bereich: ["Filter"] }
        ],
        heft: "lernen-mess.html",
        wiki: [
          "bd-fgen-amplitude",
          "bd-fgen-frequenz",
          "bd-oszi-cursor",
          "bd-oszi-kopplung",
          "bd-oszi-lage",
          "bd-oszi-tastkopf"
        ],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "6.1",
        nr: "6.1",
        titel: "LF 6.1: Halbleiter, Kennlinien und Arbeitspunkt",
        kurz: "Du lernst: Arbeitsgerade und Arbeitspunkt, Kennlinien lesen; Diode, LED und Sonderdioden, p-n-Übergang; Bipolartransistor als Schalter und Verstärker, Basisvorwiderstand.",
        themen: [
          "Arbeitsgerade und Arbeitspunkt, Kennlinien lesen",
          "Diode, LED und Sonderdioden, p-n-Übergang",
          "Bipolartransistor als Schalter und Verstärker, Basisvorwiderstand"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", bereich: ["Aufbau", "Projekt Dämmerungsschalter"], aufgaben: ["lf6"] },
          {
            lab: "sch",
            bereich: ["Transistoren", "Aufbau nach Plan", "Projekt: Dämmerungsschalter"],
            aufgaben: ["sf1"]
          },
          { lab: "mess", aufgaben: ["m13", "m23", "mpf1", "mp5", "mp8"] },
          {
            lab: "ana",
            bereich: ["Fehlersuche", "Transistorverstärker", "Diode", "Transistorschalter"],
            aufgaben: ["ae1", "ae4", "ae5", "ae6", "ae7", "ae9", "ae10", "ae12", "ae14", "ae16"]
          },
          { lab: "enr", bereich: ["Kennlinie", "Rechnen", "Verschaltung", "Verschattung", "Akku"], aufgaben: ["en1"] },
          {
            lab: "ds",
            bereich: [
              "Datenblatt-Aufbau",
              "Grenzwerte und Betriebsbedingungen",
              "Kennwerte lesen",
              "Kennlinien ablesen",
              "Berechnungen",
              "Fehlersuche"
            ],
            aufgaben: ["ds20"]
          },
          { lab: "pr", aufgaben: ["pr2"] }
        ],
        heft: "lernen-ana.html",
        wiki: ["ger-kennlinie", "bg-arbeitspunkt", "bg-arbeitspunkteinstellung", "bt-d", "bt-npn", "bg-englisch-bauteile"],
        projekt: [
          { pid: "garage", station: ["vg2"] },
          { pid: "ampel", station: ["va1", "va3"] },
          { pid: "uhr", station: ["vu1", "vu4"] },
          { pid: "giess", station: ["vw3"] },
          { pid: "foerder", station: ["vf4"] },
          { pid: "netzteil", station: ["vl3"] },
          { pid: "heizung", station: ["vh6"] }
        ],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "6.2",
        nr: "6.2",
        titel: "LF 6.2: Elektronische Baugruppen und Operationsverstärker",
        kurz: "Du lernst: Aufbau und Kennwerte des Operationsverstärkers; Invertierer, Nichtinvertierer, Summierer, Differenzverstärker; Komparator, Schmitt-Trigger, Integrierer.",
        themen: [
          "Aufbau und Kennwerte des Operationsverstärkers",
          "Invertierer, Nichtinvertierer, Summierer, Differenzverstärker",
          "Komparator, Schmitt-Trigger, Integrierer"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "sch", aufgaben: ["s15"] },
          { lab: "mess", aufgaben: ["mpf2", "mpf3", "mp3", "mp4"] },
          {
            lab: "ana",
            bereich: ["Prüfungsnah", "Komparator und Schmitt-Trigger", "Aktive Schaltungen", "OPV-Grundschaltungen"],
            aufgaben: ["ae24", "ae32"]
          },
          { lab: "pcb", aufgaben: ["pb48", "pb49"] },
          { lab: "sen", aufgaben: ["se41", "se42"] },
          { lab: "ds", aufgaben: ["ds4"] }
        ],
        heft: "lernen-ana.html",
        wiki: [
          "bg-opv-grundlagen",
          "bg-gegenkopplung",
          "bt-npn",
          "bt-opa",
          "bg-arbeitspunkteinstellung",
          "bg-opv-schaltungen"
        ],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "7.1",
        nr: "7.1",
        titel: "LF 7.1: Einfache IT-Systeme",
        kurz: "Du lernst: EVA-Prinzip, Geräteklassen, Aufbau eines Rechners; Speicher, Adressbus, Adressdecoder, Rechenwerk; Zahlendarstellung, Zweierkomplement, Hardware im PC.",
        themen: [
          "EVA-Prinzip, Geräteklassen, Aufbau eines Rechners",
          "Speicher, Adressbus, Adressdecoder, Rechenwerk",
          "Zahlendarstellung, Zweierkomplement, Hardware im PC"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "digi", bereich: ["Rechnerbausteine", "Zahlen und Codes"], aufgaben: ["df4", "df5"] },
          { lab: "hwl", fremd: true, bereich: "*" },
          { lab: "sys", bereich: "*" }
        ],
        heft: "lernen-digi.html",
        wiki: [],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "7.2",
        nr: "7.2",
        titel: "LF 7.2: Synthese von Logikschaltungen",
        kurz: "Du lernst: Wahrheitstabelle, Funktionsgleichung, Schaltung; Vereinfachen mit KV-Diagramm; Gatter, Halbaddierer, Multiplexer.",
        themen: [
          "Wahrheitstabelle, Funktionsgleichung, Schaltung",
          "Vereinfachen mit KV-Diagramm",
          "Gatter, Halbaddierer, Multiplexer"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "digi", bereich: ["Grundgatter", "Schaltnetze", "Fehlersuche", "Vereinfachen"] },
          { lab: "pr", aufgaben: ["pr4"] }
        ],
        heft: "lernen-digi.html",
        wiki: ["bg-kv-diagramm", "bg-logiksynthese", "fo-kv-bloecke", "bg-logikgatter", "bg-bussystem", "bg-ff-typen"],
        projekt: [{ pid: "garage", station: ["vg1"] }, { pid: "uhr", station: ["vu2"] }],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "8.1",
        nr: "8.1",
        titel: "LF 8.1: Technische Darstellungen",
        kurz: "Du lernst: Zeichenblatt, Blattgrößen, Maßstab, Linien; Ansichten, Schnitte, Bemaßung; Schaltpläne, Kennbuchstaben und Installationspläne.",
        themen: [
          "Zeichenblatt, Blattgrößen, Maßstab, Linien",
          "Ansichten, Schnitte, Bemaßung",
          "Schaltpläne, Kennbuchstaben und Installationspläne"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [{ lab: "zei", fremd: true, bereich: "*" }],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "8.2",
        nr: "8.2",
        titel: "LF 8.2: Signalumwandlung und Sensoren",
        kurz: "Du lernst: Wandler, Quelle, Senke und Übertragungskanal; Analog-Digital-Umsetzer (Zählverfahren, Parallelverfahren); Aktive und passive Sensoren, Normsignale.",
        themen: [
          "Wandler, Quelle, Senke und Übertragungskanal",
          "Analog-Digital-Umsetzer (Zählverfahren, Parallelverfahren)",
          "Aktive und passive Sensoren, Normsignale"
        ],
        jahr: 2,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [{ lab: "sen", bereich: "*" }, { lab: "pi", bereich: ["Analoge Sensoren (MCP3008)"] }],
        heft: "lernen-sen.html",
        wiki: [
          "bg-adu-dau",
          "bg-signalarten",
          "bg-steuern-regeln",
          "bg-zweiflankenverfahren",
          "fo-adu-dau",
          "bg-sonderdioden"
        ],
        projekt: [
          { pid: "garage", station: ["vg6"] },
          { pid: "ampel", station: ["va5"] },
          { pid: "giess", station: ["vw7"] },
          { pid: "foerder", station: ["vf3"] },
          { pid: "heizung", station: ["vh2"] }
        ],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "8.3",
        nr: "8.3",
        titel: "LF 8: Geräte herstellen und prüfen (Leiterplatte, Löten, Prüfverfahren)",
        kurz: "Du lernst: Leiterplatte entwerfen, Layout und Herstellerregeln; Bestücken und Löten; Prüfverfahren und Fehlersuche an Baugruppen.",
        themen: [
          "Leiterplatte entwerfen, Layout und Herstellerregeln",
          "Bestücken und Löten",
          "Prüfverfahren und Fehlersuche an Baugruppen"
        ],
        jahr: 2,
        quelle: "Entwurf: keine eigene Schulmitschrift vorhanden",
        entwurf: true,
        labs: [
          {
            lab: "pcb",
            bereich: [
              "Grundlagen",
              "Leiterbahnen",
              "Mehrlagen",
              "Layout",
              "DRC beheben",
              "Fertigung",
              "Bestückung",
              "Löten",
              "Fehlersuche",
              "Prüfverfahren"
            ],
            aufgaben: ["pb42", "pb43"]
          }
        ],
        heft: "lernen-pcb.html",
        wiki: ["bg-englisch-werkzeug", "bg-gefahrstoffe", "bg-psa", "bg-ip-schutzart", "nw-ip-kennziffern", "bt-ce"],
        projekt: [
          { pid: "garage", station: ["vg4"] },
          { pid: "uhr", station: ["vu5"] },
          { pid: "giess", station: ["vw5"] },
          { pid: "foerder", station: ["vf6"] },
          { pid: "netzteil", station: ["vl7"] }
        ],
        pruefung: "AP1",
        pruefungAbgeleitet: true
      },
      {
        id: "9.1",
        nr: "9.1",
        titel: "LF 9.1: Integrierte Schaltungen",
        kurz: "Du lernst: Vorteile integrierter Schaltungen, Logikfamilien und Pegel; Lastfaktoren, Open-Collector, Tri-State; Flipflops, Zähler, Zeitgeber 555.",
        themen: [
          "Vorteile integrierter Schaltungen, Logikfamilien und Pegel",
          "Lastfaktoren, Open-Collector, Tri-State",
          "Flipflops, Zähler, Zeitgeber 555"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", bereich: ["Projekt Ampel"], aufgaben: ["l8", "l22", "lf7", "lf8"] },
          { lab: "sch", bereich: ["Projekt: Ampel"], aufgaben: ["s12"] },
          {
            lab: "digi",
            bereich: ["Speicher und Zähler", "Logikfamilien", "Zustandsautomaten"],
            aufgaben: ["df2", "df8"]
          },
          { lab: "mess", bereich: ["Logik"] },
          { lab: "ana", aufgaben: ["ae40"] },
          { lab: "ds", bereich: ["Zeitdiagramm und Register"], aufgaben: ["ds11", "ds35"] }
        ],
        heft: "lernen-digi.html",
        wiki: ["bg-flipflop", "bg-lastfaktoren", "bg-pos-neg-logik", "bg-tristate", "bg-zaehler", "fo-fan-out"],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "9.2",
        nr: "9.2",
        titel: "LF 9.2: Spannungsstabilisierung",
        kurz: "Du lernst: Z-Diode: Quer- und Längsstabilisierung; Linearregler (7805, LM317) und Verlustleistung; Schaltregler und Regelschaltung mit Referenz.",
        themen: [
          "Z-Diode: Quer- und Längsstabilisierung",
          "Linearregler (7805, LM317) und Verlustleistung",
          "Schaltregler und Regelschaltung mit Referenz"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", aufgaben: ["l20"] },
          { lab: "sch", bereich: ["Halbleiter"], aufgaben: ["sf4", "s16"] },
          { lab: "mess", aufgaben: ["m14", "mf3", "mp6", "mp7"] },
          {
            lab: "nts",
            bereich: ["Prüfungsnah", "Z-Diode", "Linearregler", "Schaltregler", "Gate", "Regelkreis", "Fehlersuche"]
          },
          { lab: "ana", aufgaben: ["ae2", "ae15"] },
          { lab: "pcb", aufgaben: ["pb46", "pb47"] },
          { lab: "enr", bereich: ["Laderegler"] },
          { lab: "ds", aufgaben: ["ds10", "ds14", "ds15", "ds32"] }
        ],
        heft: "lernen-nts.html",
        wiki: [
          "bg-spannungsstabilisierung",
          "bg-z-dioden-stabilisierung",
          "fo-zener-vorwiderstand",
          "bg-kuehlung-halbleiter",
          "bg-z-diode",
          "fo-sperrschichttemperatur"
        ],
        projekt: [{ pid: "netzteil", station: ["vl1", "vl2", "vl4", "vl9"] }],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "9.3",
        nr: "9.3",
        titel: "LF 9: Geräte und Systeme in Stand halten (Instandhaltung)",
        kurz: "Du lernst: Instandhaltungsauftrag und Begriffe; Systematische Fehlersuche; Sicherheit nach der Reparatur.",
        themen: ["Instandhaltungsauftrag und Begriffe", "Systematische Fehlersuche", "Sicherheit nach der Reparatur"],
        jahr: 3,
        quelle: "Entwurf: keine eigene Schulmitschrift vorhanden",
        entwurf: true,
        labs: [
          {
            lab: "ins",
            fremd: true,
            bereich: [
              "Begriffe",
              "Fehlersuche",
              "Schmierung",
              "Schäden",
              "Kennzahlen",
              "Sicherheit",
              "Lager und Schadensanalyse",
              "Planung und TPM"
            ]
          }
        ],
        heft: "lernen-ins.html",
        wiki: [],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "10.1",
        nr: "10.1",
        titel: "LF 10.1: Steuerungen, Antriebe und Kundenübergabe",
        kurz: "Du lernst: Speicherprogrammierbare Steuerung (SPS), Stromlaufplan, Ablaufsteuerung; Motoren, Antriebe und Asynchronmotor; Kundenauftrag bearbeiten und übergeben.",
        themen: [
          "Speicherprogrammierbare Steuerung (SPS), Stromlaufplan, Ablaufsteuerung",
          "Motoren, Antriebe und Asynchronmotor",
          "Kundenauftrag bearbeiten und übergeben"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "digi", bereich: ["Kundenauftrag"] },
          { lab: "mess", bereich: ["Kundenauftrag"] },
          { lab: "els", bereich: ["Maschinensicherheit"] },
          { lab: "haus", bereich: ["Kundenauftrag"] },
          {
            lab: "sps",
            bereich: [
              "Zeit und Zählen",
              "Ampel",
              "Förderband",
              "Tank",
              "Garagentor",
              "GRAFCET",
              "Fehlersuche",
              "Prüfungsstil",
              "Vertiefung"
            ]
          },
          { lab: "ant", bereich: "*" },
          { lab: "emv", aufgaben: ["em35"] },
          { lab: "code", aufgaben: ["c26"] },
          { lab: "ins", fremd: true, bereich: ["Motor und Typenschild"] },
          {
            lab: "ssl",
            bereich: ["Layout im Schrank", "Verdrahtung und Klemmen", "Prüfen vor Inbetriebnahme", "Fehlersuche"]
          }
        ],
        heft: "lernen-ant.html",
        wiki: [
          "bt-motor",
          "bg-asynchronmotor",
          "bg-steuern-regeln",
          "bg-schuetz-steuerung",
          "bg-rampe-pwm",
          "fo-schlupf-drehzahl"
        ],
        projekt: [
          { pid: "garage", station: ["vg7", "vg8"] },
          { pid: "ampel", station: ["va7"] },
          { pid: "giess", station: ["vw2", "vw10"] },
          { pid: "foerder", station: ["vf1", "vf8"] },
          { pid: "tonfunk", station: ["vz8"] }
        ],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "10.2",
        nr: "10.2",
        titel: "LF 10.2: Pneumatik und Qualitätsmanagement",
        kurz: "Du lernst: Druckluft erzeugen, Ventile, Zylinder, Schaltpläne; Qualität und Qualitätsmanagement (Normenreihe ISO 9000); Qualitätswerkzeuge.",
        themen: [
          "Druckluft erzeugen, Ventile, Zylinder, Schaltpläne",
          "Qualität und Qualitätsmanagement (Normenreihe ISO 9000)",
          "Qualitätswerkzeuge"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [{ lab: "pne", fremd: true, bereich: "*" }],
        heft: "lernen-pne.html",
        wiki: [],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "11.1",
        nr: "11.1",
        titel: "LF 11.1: Grundlagen der Programmierung",
        kurz: "Du lernst: Phasen der Softwareentwicklung; Programmablaufplan und Struktogramm; Variablen, Verzweigungen, Schleifen, Algorithmen.",
        themen: [
          "Phasen der Softwareentwicklung",
          "Programmablaufplan und Struktogramm",
          "Variablen, Verzweigungen, Schleifen, Algorithmen"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [{ lab: "alg", bereich: "*" }],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "11.2",
        nr: "11.2",
        titel: "LF 11.2: Programmieren in C++",
        kurz: "Du lernst: Aufbau eines C++-Programms, Datentypen; Zuweisungen, Schleifen, Verzweigungen in C++; Mikrocontroller programmieren (Arduino, Raspberry Pi).",
        themen: [
          "Aufbau eines C++-Programms, Datentypen",
          "Zuweisungen, Schleifen, Verzweigungen in C++",
          "Mikrocontroller programmieren (Arduino, Raspberry Pi)"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", bereich: ["Arduino und Pi"] },
          { lab: "code", bereich: ["Grundlagen", "Fehlersuche im Code", "Mehrere LEDs"] },
          { lab: "pi", bereich: ["Grundlagen", "Fehlersuche im Code"] },
          { lab: "alg", aufgaben: ["alg39", "alg40", "alg41", "alg42", "alg52", "alg53", "alg54"] }
        ],
        heft: "lernen-arduino.html",
        wiki: [
          "bg-cpp-grundaufbau",
          "bg-mc-begriffe",
          "bg-schleifen",
          "bg-variablen-datentypen",
          "fo-schleifendurchlaeufe",
          "bt-pi"
        ],
        projekt: [
          { pid: "ampel", station: ["va6", "va8"] },
          { pid: "uhr", station: ["vu7"] },
          { pid: "giess", station: ["vw8", "vw9"] },
          { pid: "foerder", station: ["vf9"] },
          { pid: "heizung", station: ["vh7", "vh8"] }
        ],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "11.3",
        nr: "11.3",
        titel: "LF 11.3: Assemblerprogrammierung",
        kurz: "Du lernst: Ein- und Ausgabe über Adressen; Befehle, Sprünge, Unterprogramme; Programm als Befehlsfolge auf der Mini-CPU.",
        themen: [
          "Ein- und Ausgabe über Adressen",
          "Befehle, Sprünge, Unterprogramme",
          "Programm als Befehlsfolge auf der Mini-CPU"
        ],
        jahr: 3,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [{ lab: "digi", bereich: ["Mini-CPU", "Prozessor 8085"], aufgaben: ["df6", "df7"] }],
        heft: "lernen-digi.html",
        wiki: ["bg-assembler", "bg-eva-prinzip", "nw-8085-befehle", "bg-bussystem", "bg-ff-typen", "bg-flipflop"],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "E12",
        nr: "E12",
        titel: "E12: Projektbearbeitung und Mikrocontroller",
        kurz: "Du lernst: Projektablauf, Teamarbeit, Kreativitätsmethoden; Aufbau des Mikrocontrollers, Speicher, Timer, Interrupt; Serielle Datenübertragung, Bussysteme, Verbundprojekte.",
        themen: [
          "Projektablauf, Teamarbeit, Kreativitätsmethoden",
          "Aufbau des Mikrocontrollers, Speicher, Timer, Interrupt",
          "Serielle Datenübertragung, Bussysteme, Verbundprojekte"
        ],
        jahr: 4,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "loch", aufgaben: ["l11", "l12", "lf4"] },
          { lab: "ana", aufgaben: ["ae48"] },
          { lab: "code", bereich: ["Sensoren und Töne", "Prüfungspraxis"], aufgaben: ["c24"] },
          { lab: "pi", bereich: ["Sensoren und Töne", "I²C-Sensoren"] },
          { lab: "ds", bereich: ["Prüfungsstil"], aufgaben: ["ds24", "ds25"] },
          { lab: "pr", aufgaben: ["pr7"] },
          { lab: "kal", fremd: true, aufgaben: ["kal40", "kal41"] },
          { lab: "rec", fremd: true, aufgaben: ["rec43", "rec44"] },
          { lab: "alg", aufgaben: ["alg43", "alg44", "alg45", "alg46", "alg47", "alg48"] }
        ],
        heft: "lernen-arduino.html",
        wiki: [
          "bg-interrupt",
          "bg-mc-begriffe",
          "bg-flags",
          "bg-mikrocontroller",
          "bg-schieberegister",
          "bg-serielle-uebertragung"
        ],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "E13",
        nr: "E13",
        titel: "E13: Qualität, Messtechnik und Brandschutz",
        kurz: "Du lernst: Qualität und Qualitätsmanagement; Messwert, Referenzwert, Auflösung, Messunsicherheit; Brandschutz, Sicherheitszeichen, Maschinensicherheit.",
        themen: [
          "Qualität und Qualitätsmanagement",
          "Messwert, Referenzwert, Auflösung, Messunsicherheit",
          "Brandschutz, Sicherheitszeichen, Maschinensicherheit"
        ],
        jahr: 4,
        quelle: "Schulmitschriften der Berufsschule",
        entwurf: false,
        labs: [
          { lab: "mess", aufgaben: ["m24", "m40"] },
          { lab: "els", bereich: ["Sicherheitsregeln", "Brandschutz", "Kennzeichnung"] },
          { lab: "haus", aufgaben: ["ha38"] },
          { lab: "emv", aufgaben: ["em33"] },
          { lab: "net", fremd: true, bereich: "*" },
          { lab: "kal", fremd: true, bereich: "*" },
          { lab: "mat", bereich: ["Messwerte"] },
          { lab: "rec", fremd: true, bereich: "*" }
        ],
        heft: "lernen-els.html",
        wiki: [
          "bg-messtechnik-begriffe",
          "bd-iso-leiter",
          "bd-iso-messung",
          "bd-iso-pruefspannung",
          "ger-iso",
          "bg-brandklassen"
        ],
        projekt: [],
        pruefung: "AP2",
        pruefungAbgeleitet: true
      },
      {
        id: "FE",
        nr: "FE",
        titel: "Fachenglisch (lernfeldübergreifend)",
        kurz: "Du lernst: Fachwörter, Datenblätter und Anleitungen auf Englisch; E-Mails und Telefon; Sicherheits- und Warnhinweise.",
        themen: [
          "Fachwörter, Datenblätter und Anleitungen auf Englisch",
          "E-Mails und Telefon",
          "Sicherheits- und Warnhinweise"
        ],
        jahr: 0,
        quelle: "Entwurf: keine eigene Schulmitschrift vorhanden",
        entwurf: true,
        labs: [{ lab: "ds", bereich: ["Fachenglisch"] }, { lab: "eng", bereich: "*" }],
        heft: "lernen-ds.html",
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "Z-REG",
        nr: "",
        titel: "Zusatzthema Regelungstechnik",
        kurz: "Du lernst, wie ein Regler eine Größe auf dem Sollwert hält: Regelstrecke messen, Regler einstellen und Stabilität beurteilen.",
        jahr: 3,
        block: "Vertiefung",
        quelle: "Entwurf",
        entwurf: true,
        labs: [{ lab: "reg", bereich: "*" }],
        heft: "lernen-reg.html",
        wiki: [
          "bg-steuern-regeln",
          "fo-gleichstrommotor",
          "bg-blockschaltbild",
          "bg-gegenkopplung",
          "fo-pwm-tastgrad",
          "bt-ntc"
        ],
        projekt: [{ pid: "heizung", station: ["vh4", "vh5"] }],
        pruefung: null
      },
      {
        id: "Z-EMV",
        nr: "",
        titel: "Zusatzthema Elektromagnetische Verträglichkeit",
        kurz: "Du lernst, wie Störungen entstehen und sich ausbreiten und wie du sie mit Filter, Schirmung und gutem Layout dämpfst.",
        jahr: 2,
        block: "Vertiefung",
        quelle: "Entwurf",
        entwurf: true,
        labs: [
          {
            lab: "emv",
            bereich: [
              "Grundlagen",
              "Kopplung",
              "Spektrum",
              "Abstrahlung",
              "Filter",
              "Schirmung",
              "Layout",
              "Impulse",
              "Messen",
              "Normen",
              "Fehlersuche",
              "Prüfungsstil"
            ]
          }
        ],
        heft: "lernen-emv.html",
        wiki: ["bd-oszi-tastkopf", "bg-elektrisches-feld", "bt-triac", "bt-vdr", "bt-ac", "bt-c"],
        projekt: [],
        pruefung: null
      },
      {
        id: "Z-APP",
        nr: "",
        titel: "Zusatzthema App-Werkstatt",
        kurz: "Du baust in Stufen eigene Lernapps: vom ersten Programm über Prüfen und Verbessern bis zum Teilen deines Projekts.",
        jahr: 3,
        block: "Vertiefung",
        quelle: "Entwurf",
        entwurf: true,
        labs: [{ lab: "app", bereich: "*" }],
        heft: "lernen-app.html",
        wiki: ["bt-pi", "bt-uno"],
        projekt: [{ pid: "garage", station: ["vg9"] }, { pid: "uhr", station: ["vu8"] }],
        pruefung: null
      },
      {
        id: "Z-ENR",
        nr: "",
        titel: "Zusatzthema Energieversorgung: Auslegung und Fehlersuche",
        kurz: "Du legst Energieanlagen aus, suchst Fehler und übst Aufgaben im Stil der Prüfung.",
        jahr: 2,
        block: "Vertiefung",
        quelle: "Entwurf",
        entwurf: true,
        labs: [{ lab: "enr", bereich: ["Fehlersuche", "Auslegung", "Prüfungsstil"] }],
        heft: "lernen-enr.html",
        wiki: [
          "bg-englisch-batterie",
          "fo-schlupf-drehzahl",
          "bg-asynchronmotor",
          "bg-dreieckschaltung",
          "bg-hausanschluss",
          "bg-induktion"
        ],
        projekt: [],
        pruefung: null
      },
      {
        id: "Z-PRF",
        nr: "",
        titel: "Prüfungsvorbereitung und Rätselaufgaben",
        kurz: "Du übst lernfeldübergreifend: Probeprüfungen, Prüfungsaufbau, Schaltungs-Detektiv, Tagesaufgabe und Duell.",
        jahr: 0,
        block: "Prüfungsvorbereitung",
        quelle: "Entwurf",
        entwurf: true,
        labs: [
          { lab: "sch", bereich: ["Tagesaufgabe", "Duell", "Schaltungs-Detektiv"] },
          {
            lab: "pr",
            bereich: ["Stufe 2: Rechnen", "Stufe 3: Probeprüfung", "Stufe 4: Prüfungsaufbau Teil 1 und Teil 2"]
          }
        ],
        heft: "lernen-schalt.html",
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "Z-BHF",
        nr: "",
        titel: "Berichtsheft und Ausbildungsnachweis",
        kurz: "Du übst, Tätigkeiten und Lernerträge sauber zu formulieren und deinen Ausbildungsnachweis zu führen.",
        jahr: 0,
        block: "Übergreifend",
        quelle: "Entwurf",
        entwurf: true,
        labs: [{ lab: "bhf", bereich: "*" }],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      }
    ]
  };
  if (AP) AP.register('egs', plan); else queue.push(['egs', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
