'use strict';
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    "beruf": "im",
    "titel": "Industriemechaniker",
    "status": "entwurf",
    "quelle": "Lernfeld-Titel und Zeitrahmen: KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023. Jahr je Lernfeld nach BBS-Gliederung; Zuordnung der Labs fachlich begründet, unsichere Zuordnungen als Entwurf.",
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
        "j": 4,
        "t": "4. Ausbildungsjahr"
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
        "titel": "LF 1: Fertigen von Bauelementen mit handgeführten Werkzeugen",
        "kurz": "Du lernst, Bauteile von Hand zu sägen, feilen, biegen und anzureißen, Maße und Toleranzen zu lesen, zu messen und zu prüfen und Werkstoffe zu erkennen.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": false,
        "labs": [
          {
            "lab": "arb",
            "bereich": "*"
          },
          {
            "lab": "ems",
            "bereich": [
              "Wertstrom",
              "Fertigung",
              "Qualität",
              "Montage und Gehäuse"
            ]
          },
          {
            "lab": "fer",
            "bereich": [
              "Fertigungsverfahren (DIN 8580)",
              "Handfertigung",
              "Biegen und Richten",
              "Werkbank-Praxis"
            ]
          },
          {
            "lab": "tol",
            "bereich": [
              "Ablesen",
              "Messmittel wählen",
              "Toleranzen",
              "Prüfen in der Werkstatt"
            ]
          },
          {
            "lab": "wer",
            "bereich": [
              "Werkstoffe erkennen"
            ]
          },
          {
            "lab": "zer",
            "bereich": [
              "Schneide und Verfahren"
            ]
          }
        ],
        "heft": "lernen-fer.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "tonfunk",
            "station": [
              "vz3"
            ]
          }
        ],
        "pruefung": "AP1",
        "heftMehr": [
          {
            "heft": "lernen-tol.html",
            "t": "Heft Messen"
          }
        ]
      },
      {
        "id": "LF2",
        "nr": "2",
        "titel": "LF 2: Fertigen von Bauelementen mit Maschinen",
        "kurz": "Du lernst, Bohr-, Dreh- und Fräsmaschinen sicher zu bedienen, Drehzahlen und Werkzeuge zu wählen, Passungen einzuhalten und Werkstoffe einzuordnen.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "mak",
            "bereich": [
              "Maschinenkunde",
              "Bedienelemente",
              "Tafeln lesen",
              "Sicherheit an Maschinen",
              "Spannen und Werkzeuge",
              "Maschinenwahl"
            ]
          },
          {
            "lab": "zer",
            "bereich": [
              "Drehzahl und vc",
              "Bohren"
            ]
          },
          {
            "lab": "fer",
            "bereich": [
              "Vorrichtungen und Spannmittel"
            ]
          },
          {
            "lab": "tol",
            "bereich": [
              "Passungen"
            ]
          },
          {
            "lab": "wer",
            "bereich": [
              "Zugversuch",
              "Härte",
              "Bezeichnungen",
              "Eisen und Kohlenstoff",
              "Kennwerte und Prüfung"
            ]
          }
        ],
        "heft": "lernen-mak.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp5"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF3",
        "nr": "3",
        "titel": "LF 3: Herstellen von einfachen Baugruppen",
        "kurz": "Du lernst, technische Zeichnungen zu lesen, Toleranzen zu verstehen und Bauteile durch Schrauben, Nieten oder Kleben zu verbinden; dazu gehören Kräfte und Reibung.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "zei",
            "bereich": "*"
          },
          {
            "lab": "tol",
            "bereich": [
              "Form- und Lagetoleranz"
            ]
          },
          {
            "lab": "fug",
            "bereich": [
              "Fügen im System",
              "Schraubverbindungen",
              "Nieten, Klemmen, Stecken",
              "Welle-Nabe-Verbindungen",
              "Kleben"
            ]
          },
          {
            "lab": "kon",
            "bereich": [
              "Schrauben und Gewinde",
              "Oberflächenangaben",
              "Form- und Lagetoleranzen"
            ]
          },
          {
            "lab": "mch",
            "bereich": [
              "Kräfte als Vektor",
              "Hebel und Drehmoment",
              "Reibung",
              "Schwerpunkt"
            ]
          }
        ],
        "heft": "lernen-fug.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp4"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz2",
              "vz4"
            ]
          }
        ],
        "pruefung": "AP1",
        "heftMehr": [
          {
            "heft": "lernen-zei.html",
            "t": "Heft Technische Zeichnung"
          },
          {
            "heft": "lernen-kon.html",
            "t": "Heft Konstruktion"
          }
        ]
      },
      {
        "id": "LF4",
        "nr": "4",
        "titel": "LF 4: Warten technischer Systeme",
        "kurz": "Du lernst, Anlagen zu warten, richtig zu schmieren, Verschleiß und Korrosion zu erkennen und sicher mit Strom umzugehen: Gefahren, Schutzmaßnahmen, Multimeter und Leistung.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "ins",
            "bereich": [
              "Begriffe",
              "Schmierung",
              "Sicherheit",
              "Schäden"
            ]
          },
          {
            "lab": "wer",
            "bereich": [
              "Korrosion und Kunststoffe"
            ]
          },
          {
            "lab": "els",
            "bereich": [
              "Stromwirkung",
              "Sicherheitsregeln",
              "Schutzklassen",
              "Schutzorgane",
              "RCD",
              "Schutzmaßnahmen",
              "Brandschutz",
              "Kennzeichnung",
              "Maschinensicherheit"
            ]
          },
          {
            "lab": "mess",
            "bereich": [
              "Multimeter",
              "Leistung und Kennlinien",
              "Netzgerät und Generator"
            ]
          }
        ],
        "heft": "lernen-ins.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF5",
        "nr": "5",
        "titel": "LF 5: Fertigen von Einzelteilen mit Werkzeugmaschinen",
        "kurz": "Du lernst, Dreh- und Fräsarbeiten zu planen: Schnittdaten, Vorschub, Hauptzeit und Werkstoffwahl für das Einzelteil.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "zer",
            "bereich": [
              "Vorschub und Zeit",
              "Fräsen",
              "Praxisfälle"
            ]
          },
          {
            "lab": "fer",
            "bereich": [
              "Fertigungsplanung"
            ]
          },
          {
            "lab": "wer",
            "bereich": [
              "Werkstoffwahl"
            ]
          }
        ],
        "heft": "lernen-zer.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp6"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz5"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF6",
        "nr": "6",
        "titel": "LF 6: Installieren und Inbetriebnehmen steuerungstechnischer Systeme",
        "kurz": "Du lernst Steuerungen kennen: Pneumatik und Hydraulik, Sensoren und SPS-Programme.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "sps",
            "bereich": [
              "Grundlagen",
              "Zeit und Zählen",
              "Ampel",
              "Förderband",
              "Tank",
              "Garagentor",
              "GRAFCET",
              "Fehlersuche",
              "Prüfungsstil"
            ]
          },
          {
            "lab": "sen",
            "bereich": [
              "Grundlagen",
              "Temperatur",
              "Licht und Näherung",
              "Kraft und Druck",
              "Beschleunigung",
              "Digitale Sensoren",
              "Fehlersuche",
              "Prüfungsstil"
            ]
          },
          {
            "lab": "pne",
            "bereich": "*"
          },
          {
            "lab": "hyd",
            "bereich": "*"
          }
        ],
        "heft": "lernen-sps.html",
        "wiki": [
          "bg-steuern-regeln",
          "bg-signalarten",
          "bg-schuetz-steuerung",
          "bg-sicherheitsregeln",
          "bg-maschinensicherheit",
          "bg-pneumatik",
          "fo-pneumatik"
        ],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp3",
              "vp8"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF7",
        "nr": "7",
        "titel": "LF 7: Montieren von technischen Teilsystemen",
        "kurz": "Du lernst, Lager, Wellen, Kupplungen, Federn und Getriebe auszuwählen und zu montieren und die Belastung von Bauteilen mit Spannung und Pressung zu beurteilen.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "mas",
            "bereich": [
              "Zahnräder und Maße",
              "Übersetzung und Leistung",
              "Lager und Wellen",
              "Kupplungen, Bremsen, Dichtungen",
              "Federn",
              "Kupplung ausrichten"
            ]
          },
          {
            "lab": "kon",
            "bereich": [
              "Welle-Nabe-Verbindungen",
              "Wälzlager und Federn"
            ]
          },
          {
            "lab": "mch",
            "bereich": [
              "Träger und Auflager",
              "Spannung und Dehnung",
              "Pressung und Abscheren",
              "Biegung und Sicherheit",
              "Arbeit und Leistung",
              "Torsion und Knickung",
              "Bewegung"
            ]
          }
        ],
        "heft": "lernen-mas.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF8",
        "nr": "8",
        "titel": "LF 8: Fertigen auf numerisch gesteuerten Werkzeugmaschinen",
        "kurz": "Du lernst, CNC-Programme (G-Code) zu lesen, zu ergänzen und Fehler darin zu finden, Koordinaten zu setzen und Bearbeitungszeiten zu berechnen.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": false,
        "labs": [
          {
            "lab": "cnc",
            "bereich": "*"
          },
          {
            "lab": "mak",
            "bereich": [
              "CNC-Bedienung"
            ]
          }
        ],
        "heft": "lernen-cnc.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp7"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF9",
        "nr": "9",
        "titel": "LF 9: Instandsetzen von technischen Systemen",
        "kurz": "Du lernst, Störungen systematisch einzugrenzen, Schäden an Lagern und Motoren zu analysieren und defekte Teile instand zu setzen.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "ins",
            "bereich": [
              "Fehlersuche",
              "Lager und Schadensanalyse",
              "Motor und Typenschild",
              "Riemen, Ketten und Dichtungen"
            ]
          },
          {
            "lab": "fug",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "mas",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "mak",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "mch",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "fer",
            "bereich": [
              "Fehlersuche"
            ]
          },
          {
            "lab": "pne",
            "bereich": [
              "Wartung und Fehlersuche"
            ]
          },
          {
            "lab": "hyd",
            "bereich": [
              "Wartung und Fehlersuche"
            ]
          }
        ],
        "heft": "lernen-ins.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF10",
        "nr": "10",
        "titel": "LF 10: Herstellen und Inbetriebnehmen von technischen Systemen",
        "kurz": "Du lernst Riemen- und Kettentriebe, Schweißen und Löten, Wärmebehandlung und elektrische Antriebe kennen und ein System in Betrieb zu nehmen.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "fug",
            "bereich": [
              "Schweißen",
              "Löten"
            ]
          },
          {
            "lab": "mas",
            "bereich": [
              "Riemen und Ketten"
            ]
          },
          {
            "lab": "wer",
            "bereich": [
              "Gefüge und Wärmebehandlung",
              "Wärmebehandlung in der Praxis"
            ]
          },
          {
            "lab": "ant",
            "bereich": [
              "Grundlagen",
              "Drehstrom",
              "Getriebe",
              "Asynchronmotor",
              "Typenschild und Betrieb"
            ]
          }
        ],
        "heft": "lernen-ant.html",
        "wiki": [
          "bg-asynchronmotor",
          "bg-drehstrom"
        ],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp2"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF11",
        "nr": "11",
        "titel": "LF 11: Überwachen der Produkt- und Prozessqualität",
        "kurz": "Du lernst, Messmittel auszuwählen, Messabweichungen zu beurteilen, Prüfmerkmale mit Lehren zu kontrollieren und Qualität zu sichern.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "tol",
            "bereich": [
              "Messabweichung und Prüfmittel",
              "Lehren und Oberfläche"
            ]
          },
          {
            "lab": "fer",
            "bereich": [
              "Qualitätssicherung"
            ]
          },
          {
            "lab": "mess",
            "bereich": [
              "Messfehler"
            ]
          }
        ],
        "heft": "lernen-tol.html",
        "wiki": [
          "bg-qualitaet",
          "bg-pruefmittel",
          "bg-messtechnik-begriffe",
          "bg-pruefarten",
          "bg-qualitaetswerkzeuge",
          "fo-messabweichung"
        ],
        "projekt": [
          {
            "pid": "tonfunk",
            "station": [
              "vz8",
              "vz9"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF12",
        "nr": "12",
        "titel": "LF 12: Instandhalten von technischen Systemen",
        "kurz": "Du lernst, Instandhaltung zu planen: Kennzahlen wie Verfügbarkeit, Wartungsstrategien und vorbeugende Instandhaltung nach TPM.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": false,
        "labs": [
          {
            "lab": "ins",
            "bereich": [
              "Kennzahlen",
              "Planung und TPM"
            ]
          }
        ],
        "heft": "lernen-ins.html",
        "wiki": [
          "bg-pdca-kvp"
        ],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp9"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF13",
        "nr": "13",
        "titel": "LF 13: Sicherstellen der Betriebsfähigkeit automatisierter Systeme",
        "kurz": "Du lernst, Regelungen mit Normsignalen, Reglern und Servoantrieben zu verstehen und einzustellen; die Hydraulik als Steuerung steht bei den Steuerungen in LF 6.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": false,
        "labs": [
          {
            "lab": "reg",
            "bereich": [
              "Grundlagen",
              "Regler verstehen",
              "Zweipunkt",
              "Strecke messen"
            ]
          },
          {
            "lab": "sen",
            "bereich": [
              "Normsignale"
            ]
          },
          {
            "lab": "ant",
            "bereich": [
              "Servo und Regelung"
            ]
          }
        ],
        "heft": "lernen-reg.html",
        "wiki": [
          "bg-adu-dau"
        ],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "E-INST",
        "nr": "",
        "titel": "Einsatzgebiet Instandhaltung",
        "kurz": "Du übst den ganzen Instandhaltungsauftrag: von der Störmeldung über Planen, Sichern und Instandsetzen bis zur Übergabe. Dazu Wartungsplanung, Zustandsüberwachung, Ersatzteile und Schwachstellen.",
        "jahr": 3,
        "quelle": "Einsatzgebiet nach Ausbildungsordnung Industriemechaniker/-in; Zuordnung der Aufgaben als Entwurf.",
        "entwurf": true,
        "labs": [
          {
            "lab": "ins",
            "bereich": [
              "Einsatzgebiet Instandhaltung"
            ]
          }
        ],
        "heft": "lernen-ins.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "E-PROD",
        "nr": "",
        "titel": "Einsatzgebiet Produktionstechnik",
        "kurz": "Du lernst, für die Produktion zu bauen: Vorrichtungen und Betriebsmittel, Auftragszeit und Taktzeit, Prüfplan und Erstteilfreigabe, Arbeitsplatz und die Übergabe an die Produktion.",
        "jahr": 3,
        "quelle": "Einsatzgebiet nach Ausbildungsordnung Industriemechaniker/-in; Zuordnung der Aufgaben als Entwurf.",
        "entwurf": true,
        "labs": [
          {
            "lab": "fer",
            "bereich": [
              "Einsatzgebiet Produktionstechnik"
            ]
          }
        ],
        "heft": "lernen-fer.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF14",
        "nr": "14",
        "titel": "LF 14: Planen und Realisieren technischer Systeme",
        "kurz": "Du lernst, ein Projekt von der Anforderung bis zur Stückliste zu planen und dafür Normteile, Zeichnungen und fertigungsgerechte Konstruktion zu nutzen.",
        "jahr": 4,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "kon",
            "bereich": [
              "Normteile und Stücklisten",
              "Fertigungsgerecht konstruieren"
            ]
          }
        ],
        "heft": "lernen-kon.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "presse",
            "station": [
              "vp1"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF15",
        "nr": "15",
        "titel": "LF 15: Optimieren von technischen Systemen",
        "kurz": "Du lernst, Anlagen zu verbessern: Regelkreis einstellen und optimieren, Antriebe beurteilen und Verbesserungen absichern.",
        "jahr": 4,
        "quelle": "KMK-Rahmenlehrplan Industriemechaniker/-in (Lernfeldtitel, Stand Änderung 2018); ZVEI/BIBB Zeitrahmen und Lernfelder, Stand 16.05.2018; BBS Osnabrück Gliederung Industriemechanik, Stand 15.02.2023",
        "entwurf": true,
        "labs": [
          {
            "lab": "reg",
            "bereich": "*"
          },
          {
            "lab": "ant",
            "bereich": [
              "Fehlersuche",
              "Prüfungsstil"
            ]
          }
        ],
        "heft": "lernen-reg.html",
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "Z-RECH",
        "nr": "",
        "titel": "Technisches Rechnen",
        "kurz": "Du lernst Einheiten umrechnen, Dreisatz, Prozent, Formeln umstellen und Flächen und Volumen berechnen, die du in allen Lernfeldern brauchst.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "mat",
            "bereich": [
              "Einheiten",
              "Dreisatz",
              "Prozent",
              "Bruchrechnung",
              "Klammern",
              "Umstellen",
              "Geometrie",
              "Messwerte"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "Z-THM",
        "nr": "",
        "titel": "Zusatzthema: Wärme und Kühlung (Elektronik)",
        "kurz": "Du lernst, wie sich Bauteile erwärmen und wie ein Kühlkörper die Wärme abführt; ein Zusatzthema aus der Elektronik, das hier keinem Lernfeld zugeordnet ist.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "thm",
            "bereich": "*"
          }
        ],
        "heft": "lernen-thm.html",
        "wiki": [
          "bg-kuehlung-halbleiter"
        ],
        "projekt": [],
        "pruefung": null,
        "optional": true,
        "block": "Zusatzthemen"
      },
      {
        "id": "Z-ENG",
        "nr": "",
        "titel": "Technisches Englisch",
        "kurz": "Du lernst Fachvokabeln, Datenblätter, Warnhinweise und Anleitungen auf Englisch zu verstehen und einfache E-Mails zu schreiben.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "eng",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "Z-BHF",
        "nr": "",
        "titel": "Berichtsheft führen",
        "kurz": "Du lernst, Tätigkeiten und Lernertrag im Ausbildungsnachweis verständlich und vollständig zu beschreiben.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "bhf",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "Z-ELEK",
        "nr": "",
        "titel": "Zusatzthema: Elektrotechnik rechnen",
        "kurz": "Freiwillig, für alle, die über den eigenen Beruf hinaus Elektrotechnik rechnen wollen: Wechselstrom, Drehstrom, Messen und Prüfen, dazu Pegel, Wandler und Schaltregler.",
        "jahr": 0,
        "block": "Zusatzthemen",
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "mat",
            "bereich": [
              "Elektrotechnik",
              "Elektronik vertieft",
              "Prüfung Teil 1"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null,
        "optional": true
      },
      {
        "id": "Z-ELV",
        "nr": "",
        "titel": "Zusatzthema: Elektrotechnik vertieft",
        "kurz": "Freiwillig, für alle, die tiefer einsteigen wollen: Anlagen und Geräte prüfen, Netzformen, Oszilloskop, Wandler, Kleinmotoren und SPS-Vertiefung. Elektrische Arbeiten macht die Elektrofachkraft.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "els",
            "bereich": [
              "Prüfungsnah",
              "Isolation und Schutzleiter",
              "Geräteprüfung",
              "TT-System",
              "Schmelzsicherung",
              "IT-System",
              "Anlagenprüfung"
            ]
          },
          {
            "lab": "mess",
            "bereich": [
              "Oszilloskop",
              "Frequenzgang",
              "Logik",
              "Kundenauftrag",
              "Fehlersuche",
              "Prüfung: Stromlaufplan"
            ]
          },
          {
            "lab": "sen",
            "bereich": [
              "ADU"
            ]
          },
          {
            "lab": "ant",
            "bereich": [
              "Gleichstrom und H-Brücke",
              "Schrittmotor",
              "Gleichstrom- und Schrittmotor",
              "Vertiefung"
            ]
          },
          {
            "lab": "sps",
            "bereich": [
              "Vertiefung"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null,
        "block": "Zusatzthemen",
        "optional": true
      },
      {
        "id": "Z-EMS",
        "nr": "",
        "titel": "Zusatzthema: Die ganze Fertigung",
        "kurz": "Freiwillig, für alle, die den ganzen Weg einer Baugruppe kennenlernen wollen: die Themen aus dem EMS-Lab, die nicht zum eigenen Beruf gehören.",
        "jahr": 0,
        "block": "Übergreifend",
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [{"lab": "cad", "bereich": "*"}, {"lab": "drk", "bereich": "*"}, 
          {
            "lab": "ems",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null,
        "optional": true
      }
    ]
  };
  if (AP) AP.register('im', plan); else queue.push(['im', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
