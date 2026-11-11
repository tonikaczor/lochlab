/* Ausbildungsplan Fachinformatiker: von Hand gepflegt (nicht vom Generator). Prüfung: node quelle/lernfaden/validate_plan.js fi */
'use strict';
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    "beruf": "fi",
    "titel": "Fachinformatiker",
    "status": "entwurf",
    "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf. Lernfeld-Titel und Jahre aus dem KMK-Rahmenlehrplan, Zuordnung der Labs ist ein Entwurf; AP1 (Teil 1 der gestreckten Abschlussprüfung, Einrichten eines IT-gestützten Arbeitsplatzes) und AP2 nach der IHK-Prüfungsstruktur.",
    "jahre": [
      {
        "j": 1,
        "t": "1. Ausbildungsjahr"
      },
      {
        "j": 2,
        "t": "2. Ausbildungsjahr"
      },
      {
        "j": 3,
        "t": "3. Ausbildungsjahr"
      },
      {
        "j": 0,
        "t": "Übergreifend"
      }
    ],
    "lernfelder": [
      {
        "id": "LF1",
        "nr": "1",
        "titel": "LF 1: Das Unternehmen und die eigene Rolle im Betrieb beschreiben",
        "kurz": "Du lernst, wie ein Betrieb aufgebaut ist und wie du deine Ausbildung nachweist. Dazu übst du Berichtsheft-Einträge und Fachwörter.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "bhf",
            "bereich": "*"
          },
          {
            "lab": "eng",
            "bereich": [
              "Fachvokabeln"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF2",
        "nr": "2",
        "titel": "LF 2: Arbeitsplätze nach Kundenwunsch ausstatten",
        "kurz": "Du lernst, wie ein PC aufgebaut ist, welche Teile zusammenpassen und was Betrieb und Strom kosten. Du liest Datenblätter und übst Rechnerbausteine, Zahlensysteme und Codes.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": false,
        "labs": [
          {
            "lab": "hwl",
            "bereich": "*"
          },
          {
            "lab": "eng",
            "bereich": [
              "Datenblatt lesen",
              "Stückliste und Lieferschein",
              "Maßeinheiten und Zahlen",
              "Warnhinweise und Anleitungen",
              "Geräte im Alltag"
            ]
          },
          {
            "lab": "digi",
            "bereich": [
              "Rechnerbausteine",
              "Zahlen und Codes"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-speicherarten",
          "bg-zahlensysteme",
          "fo-hex-dual"
        ],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn1",
              "vn2"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF3",
        "nr": "3",
        "titel": "LF 3: Clients in Netzwerke einbinden",
        "kurz": "Du lernst Binärzahlen, IP-Adressen, Schichtenmodell und Ports kennen und siehst, wie Störungen auf Leitungen entstehen. Mit Linux übst du Dateisystem, Rechte und Prozesse auf dem Client.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "net",
            "bereich": [
              "Binär",
              "Adressierung",
              "Schichten/Ports",
              "Übertragungstechnik"
            ]
          },
          {
            "lab": "lin",
            "bereich": [
              "Dateisystem und Pfade",
              "Dateirechte",
              "Textwerkzeuge und Pipes",
              "Prozesse"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-serielle-uebertragung",
          "bg-signalarten"
        ],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF4",
        "nr": "4",
        "titel": "LF 4: Schutzbedarfsanalyse im eigenen Arbeitsbereich durchführen",
        "kurz": "Du lernst, was Daten schützenswert macht: Schutzziele, sichere Passwörter, Phishing, Ausfallsicherheit und Datensicherung. So kannst du den Schutzbedarf an deinem Arbeitsplatz einschätzen.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "its",
            "bereich": [
              "Schutzziele und Recht",
              "Passwörter",
              "Phishing und Social Engineering",
              "Verfügbarkeit",
              "Backup"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn8"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF5",
        "nr": "5",
        "titel": "LF 5: Software zur Verwaltung von Daten anpassen",
        "kurz": "Du lernst, wie Daten in Tabellen gespeichert und mit SQL abgefragt werden. Dazu kommen die Grundlagen des Programmierens: Variablen, Verzweigungen, Schleifen, Ablaufpläne und Schreibtischtests.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "sql",
            "bereich": [
              "Tabellen, Schlüssel und ER-Modell",
              "Normalisierung",
              "SELECT, WHERE und Sortieren",
              "Aggregatfunktionen und GROUP BY",
              "Daten ändern"
            ]
          },
          {
            "lab": "alg",
            "bereich": [
              "Variablen und Verzweigung",
              "Schleifen",
              "Ablaufplan und Struktogramm",
              "Schreibtischtest und Fehlersuche"
            ],
            "aufgaben": [
              "alg38",
              "alg49",
              "alg50",
              "alg51",
              "alg52",
              "alg53",
              "alg54",
              "alg55"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-pap-struktogramm",
          "bg-variablen-datentypen",
          "bg-schleifen",
          "fo-schleifendurchlaeufe",
          "bg-eva-prinzip"
        ],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF6",
        "nr": "6",
        "titel": "LF 6: Serviceanfragen bearbeiten",
        "kurz": "Du lernst, wie du Fehler am PC systematisch eingrenzt und Kundenanfragen höflich beantwortest, per Mail und am Telefon, auch auf Englisch.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "hwl",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "eng",
            "bereich": [
              "E-Mail und Anfrage",
              "Telefon",
              "Formell und locker",
              "False Friends"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-englisch-formell"
        ],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF7",
        "nr": "7",
        "titel": "LF 7: Cyber-physische Systeme ergänzen",
        "kurz": "Du bringst Hardware und Software zusammen: Mikrocontroller und Raspberry Pi lesen Sensoren und steuern LEDs, Servos und Töne. Dazu gehören Prozessor mit Assembler, Digitaltechnik und Fehlersuche.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "code",
            "bereich": "*"
          },
          {
            "lab": "pi",
            "bereich": "*"
          },
          {
            "lab": "ds",
            "bereich": "*"
          },
          {
            "lab": "digi",
            "bereich": "*"
          },
          {
            "lab": "eng",
            "bereich": "*"
          },
          {
            "lab": "alg",
            "aufgaben": [
              "alg43",
              "alg44",
              "alg45",
              "alg46",
              "alg47"
            ]
          }
        ],
        "heft": "lernen-arduino.html",
        "wiki": [
          "bt-uno",
          "bt-pi",
          "bg-mikrocontroller",
          "bg-mc-begriffe",
          "bg-adu-dau",
          "bg-interrupt",
          "bg-logikgatter",
          "bg-englisch-datenblatt",
          "bg-cpu-aufbau",
          "bg-von-neumann-harvard"
        ],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF8",
        "nr": "8",
        "titel": "LF 8: Daten systemübergreifend bereitstellen",
        "kurz": "Du verknüpfst Daten aus mehreren Tabellen mit JOIN und Unterabfragen und lernst typische Fehler in SQL zu vermeiden. So stellst du Daten für andere Systeme bereit.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "sql",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn5"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz9"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF9",
        "nr": "9",
        "titel": "LF 9: Netzwerke und Dienste bereitstellen",
        "kurz": "Du teilst Netze mit Subnetting und VLSM sinnvoll auf und liest unter Linux Netzwerkeinstellungen und Logdateien aus.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder 1 bis 9",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": false,
        "labs": [
          {
            "lab": "net",
            "bereich": "*"
          },
          {
            "lab": "lin",
            "bereich": [
              "Netzwerk und Logdateien"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn3"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF10a",
        "nr": "10a",
        "titel": "LF 10a (Anwendungsentwicklung): Benutzerschnittstellen gestalten und entwickeln",
        "kurz": "Du baust kleine Apps mit Oberfläche, prüfst sie, meldest Fehler und sammelst Wissen in Notizen. Dabei lernst du, gute Aufträge zu formulieren und Ergebnisse kritisch zu prüfen.",
        "jahr": 3,
        "block": "Fachrichtung Anwendungsentwicklung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "app",
            "bereich": [
              "Stufe 1: Los geht’s",
              "Stufe 2: Lernapps bauen",
              "Stufe 3: Prüfen und verbessern",
              "Stufe 4: Wissen sammeln"
            ]
          }
        ],
        "heft": "lernen-app.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn7"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF11a",
        "nr": "11a",
        "titel": "LF 11a (Anwendungsentwicklung): Funktionalität in Anwendungen realisieren",
        "kurz": "Du setzt Algorithmen um: Suchen, Sortieren, Rekursion, Zahlenverfahren und Programme in C++. Du schätzt auch den Aufwand eines Verfahrens ab.",
        "jahr": 3,
        "block": "Fachrichtung Anwendungsentwicklung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "alg",
            "bereich": [
              "Suchen und Sortieren",
              "Rekursion und Aufwand",
              "Zahlenalgorithmen"
            ],
            "aufgaben": [
              "alg39",
              "alg40",
              "alg41",
              "alg42"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-cpp-grundaufbau",
          "bg-funktionen"
        ],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn6"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF12a",
        "nr": "12a",
        "titel": "LF 12a (Anwendungsentwicklung): Kundenspezifische Anwendungsentwicklung durchführen",
        "kurz": "Du führst ein Softwareprojekt von der Planung bis zur Übergabe: Projektphasen, Entwurf, Unterlagen, Datenschutz und Sicherheit. Mit einer eigenen Lernapp übst du das im Kleinen.",
        "jahr": 3,
        "block": "Fachrichtung Anwendungsentwicklung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "app",
            "bereich": [
              "Stufe 5: Teilen und Sicherheit",
              "Stufe 6: Projekt"
            ]
          },
          {
            "lab": "alg",
            "aufgaben": [
              "alg35",
              "alg36",
              "alg37",
              "alg48",
              "alg56"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-softwareentwicklung"
        ],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF10b",
        "nr": "10b",
        "titel": "LF 10b (Systemintegration): Serverdienste bereitstellen und Administrationsaufgaben automatisieren",
        "kurz": "Du richtest unter Linux Benutzer und Pakete ein, schreibst Shell-Skripte, planst Aufgaben mit Cron und wertest Dienste und Logs aus.",
        "jahr": 3,
        "block": "Fachrichtung Systemintegration",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "lin",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "werknetz",
            "station": [
              "vn4"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF11b",
        "nr": "11b",
        "titel": "LF 11b (Systemintegration): Betrieb und Sicherheit vernetzter Systeme gewährleisten",
        "kurz": "Du lernst, wie Verschlüsselung und Hashwerte funktionieren und wie Rechte und Firewall ein Netz schützen.",
        "jahr": 3,
        "block": "Fachrichtung Systemintegration",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [
          {
            "lab": "its",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF12b",
        "nr": "12b",
        "titel": "LF 12b (Systemintegration): Kundenspezifische Systemintegration durchführen",
        "kurz": "Du planst und setzt ein Systemintegrationsprojekt um und nutzt, was du zu Netz, Linux und Sicherheit gelernt hast. Eigene Aufgaben gibt es hier nicht, das Werkstatt-Netz-Projekt übt es.",
        "jahr": 3,
        "block": "Fachrichtung Systemintegration",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF10c",
        "nr": "10c",
        "titel": "LF 10c (Daten- und Prozessanalyse): Werkzeuge des maschinellen Lernens einsetzen",
        "kurz": "Du setzt Werkzeuge des maschinellen Lernens ein. Dafür gibt es hier noch keine eigenen Aufgaben, SQL und Algorithmen aus den gemeinsamen Lernfeldern bereiten dich vor.",
        "jahr": 3,
        "block": "Fachrichtung Daten- und Prozessanalyse",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF11c",
        "nr": "11c",
        "titel": "LF 11c (Daten- und Prozessanalyse): Prozesse analysieren und gestalten",
        "kurz": "Du analysierst Abläufe und gestaltest sie neu. Eigene Aufgaben gibt es hier noch nicht, Ablaufpläne und Datenabfragen aus LF 5 und LF 8 sind die Grundlage.",
        "jahr": 3,
        "block": "Fachrichtung Daten- und Prozessanalyse",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF12c",
        "nr": "12c",
        "titel": "LF 12c (Daten- und Prozessanalyse): Kundenspezifische Prozess- und Datenanalyse durchführen",
        "kurz": "Du führst ein Analyseprojekt für einen Kunden durch. Eigene Aufgaben gibt es hier noch nicht, das Projekt Prüfdaten auswerten übt einen Teil davon.",
        "jahr": 3,
        "block": "Fachrichtung Daten- und Prozessanalyse",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF10d",
        "nr": "10d",
        "titel": "LF 10d (Digitale Vernetzung): Cyber-physische Systeme entwickeln",
        "kurz": "Du entwickelst vernetzte Geräte mit Sensoren und Steuerung. Die Aufgaben dazu liegen in LF 7: Mikrocontroller, Raspberry Pi und Datenblätter.",
        "jahr": 3,
        "block": "Fachrichtung Digitale Vernetzung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF11d",
        "nr": "11d",
        "titel": "LF 11d (Digitale Vernetzung): Betrieb und Sicherheit vernetzter Systeme gewährleisten",
        "kurz": "Du hältst vernetzte Systeme sicher und im Betrieb. Dieses Lernfeld hat denselben Titel wie LF 11b, Aufgaben dazu findest du dort.",
        "jahr": 3,
        "block": "Fachrichtung Digitale Vernetzung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF12d",
        "nr": "12d",
        "titel": "LF 12d (Digitale Vernetzung): Kundenspezifisches cyber-physisches System optimieren",
        "kurz": "Du optimierst ein cyber-physisches System für einen Kunden. Eigene Aufgaben gibt es hier noch nicht, die Labs aus LF 7 sind die Grundlage.",
        "jahr": 3,
        "block": "Fachrichtung Digitale Vernetzung",
        "quelle": "KMK-Rahmenlehrplan Fachinformatiker/-in (Beschluss 13.12.2019, in Kraft 1.8.2020); IHK-Basisinformationen Fachinformatiker 01.08.2020; Lehrplanrichtlinien ISB Bayern bs_lpr_fachinformatiker.pdf",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "Z-RECH",
        "nr": "",
        "titel": "Zusatzthema: Rechnen in der IT",
        "kurz": "Du übst das Rechnen, das in der IT ständig vorkommt: Einheiten umrechnen, Dreisatz, Prozent, Speichergrößen und Datenraten.",
        "jahr": 0,
        "block": "Zusatzthemen",
        "entwurf": true,
        "labs": [
          {
            "lab": "mat",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [
          "fo-speicherkapazitaet"
        ],
        "projekt": [],
        "quelle": "Entwurf",
        "pruefung": null
      }
    ]
  };
  if (AP) AP.register('fi', plan); else queue.push(['fi', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
