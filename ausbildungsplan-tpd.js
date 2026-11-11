'use strict';
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    "beruf": "tpd",
    "titel": "Technischer Produktdesigner",
    "status": "entwurf",
    "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf. Fachrichtungen MAK und PGK ab dem 3. Ausbildungsjahr (LF 9 bis 13); Lab-Zuordnung teils als Entwurf.",
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
        "id": "1",
        "nr": "1",
        "titel": "LF 1: Technische Systeme analysieren und erfassen",
        "kurz": "Du liest Zeichnungen in Ansichten, bemaßt sauber, liest Toleranzen ab und arbeitest mit Stücklisten, Normteilen und Fachbegriffen auf Englisch.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder",
        "entwurf": false,
        "labs": [
          {
            "lab": "zei",
            "bereich": [
              "Ansichten",
              "Ansichten ergänzen",
              "Linien und Bemaßung",
              "Maßstab"
            ]
          },
          {
            "lab": "tol",
            "bereich": [
              "Ablesen",
              "Toleranzen"
            ]
          },
          {
            "lab": "kon",
            "bereich": [
              "Normteile und Stücklisten"
            ]
          },
          {
            "lab": "eng",
            "bereich": [
              "Fachvokabeln",
              "Datenblatt lesen",
              "Maßeinheiten und Zahlen",
              "Warnhinweise und Anleitungen"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-englisch-werkzeug"
        ],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd2",
              "vd8"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "2",
        "nr": "2",
        "titel": "LF 2: Bauteile und Baugruppen nach Vorgabe computerunterstützt erstellen",
        "kurz": "Du erzeugst Bauteile und einfache Baugruppen als Datensatz und leitest Zeichnungen mit Schnitten, Einzelheiten und Toleranzangaben ab. Passungen und Form- und Lagetoleranzen gehören dazu.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder",
        "entwurf": true,
        "labs": [
          {
            "lab": "zei",
            "bereich": [
              "Schnitt",
              "Blatt und Schrift",
              "Darstellungsarten"
            ]
          },
          {
            "lab": "tol",
            "bereich": [
              "Passungen",
              "Form- und Lagetoleranz"
            ]
          },
          {
            "lab": "kon",
            "bereich": [
              "Form- und Lagetoleranzen"
            ]
          }
        ],
        "heft": "lernen-tol.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd5"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz2",
              "vz3"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "3",
        "nr": "3",
        "titel": "LF 3: Auswirkungen ausgewählter Fertigungsverfahren und Werkstoffe auf die Bauteilkonstruktion berücksichtigen",
        "kurz": "Du lernst, wie Werkstoffe, Oberflächen und Fertigungsverfahren die Gestaltung eines Bauteils beeinflussen. Dazu wählst du Messmittel und prüfst Maße und Oberflächen.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder",
        "entwurf": true,
        "labs": [
          {
            "lab": "tol",
            "bereich": [
              "Messmittel wählen",
              "Messabweichung und Prüfmittel",
              "Lehren und Oberfläche"
            ]
          },
          {
            "lab": "kon",
            "bereich": [
              "Oberflächenangaben",
              "Fertigungsgerecht konstruieren"
            ]
          }
        ],
        "heft": "lernen-wer.html",
        "wiki": [
          "bg-pruefmittel"
        ],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd3"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "4",
        "nr": "4",
        "titel": "LF 4: Aufträge kundenorientiert ausführen",
        "kurz": "Du bearbeitest einen Kundenauftrag von Lastenheft bis Ergebnis, planst Zeit und Kosten und holst Informationen auch auf Englisch ein. E-Mails, Anfragen und Lieferscheine übst du im Englisch-Lab.",
        "jahr": 1,
        "block": "Gemeinsame Lernfelder",
        "entwurf": true,
        "labs": [
          {
            "lab": "eng",
            "bereich": [
              "E-Mail und Anfrage",
              "Telefon",
              "Stückliste und Lieferschein",
              "Formell und locker"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-iso-9001"
        ],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd1"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "5",
        "nr": "5",
        "titel": "LF 5: Bauteile aus metallischen Werkstoffen unter Berücksichtigung von Umformverfahren im Kontext von Baugruppen entwickeln",
        "kurz": "Du gestaltest Blechteile nach den Regeln fürs Biegen und Tiefziehen und rechnest Biegelängen. Stahl, Nichteisenmetalle und Wirtschaftlichkeit spielen mit.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder",
        "entwurf": false,
        "labs": [],
        "heft": "lernen-fer.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd4"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "6",
        "nr": "6",
        "titel": "LF 6: Bauteile aus Kunststoffen unter Berücksichtigung von Ur- und Umformverfahren im Kontext von Baugruppen entwickeln",
        "kurz": "Du lernst Thermoplaste, Duroplaste und Elastomere kennen und gestaltest Bauteile passend zu Spritzgießen, Thermoformen und anderen Verfahren. Rapid Prototyping gehört dazu.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "7",
        "nr": "7",
        "titel": "LF 7: Bauteile unter Berücksichtigung von trennenden Fertigungsverfahren im Kontext von Baugruppen entwickeln",
        "kurz": "Du gestaltest Bauteile so, dass sie sich zerspanen lassen, und leitest fertigungsgerechte Zeichnungen mit Maß-, Form- und Oberflächenangaben ab. CNC- und CAM-Daten bereitest du vor.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder",
        "entwurf": false,
        "labs": [],
        "heft": "lernen-zer.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd7"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "8",
        "nr": "8",
        "titel": "LF 8: Bauteile aus metallischen Werkstoffen unter Berücksichtigung von Urformverfahren im Kontext von Baugruppen entwickeln",
        "kurz": "Du gestaltest Gussteile und andere urgeformte Metallbauteile nach den passenden Regeln. Werkstoffwahl, Kosten und Umweltaspekte beziehst du in die Entscheidung ein.",
        "jahr": 2,
        "block": "Gemeinsame Lernfelder",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "9",
        "nr": "9",
        "titel": "LF 9: 3D-Datensätze von Baugruppen unter Berücksichtigung von Fügeverfahren und Montagetechniken erstellen und modifizieren (beide Fachrichtungen)",
        "kurz": "Du baust Baugruppen mit lösbaren und unlösbaren Verbindungen auf und achtest auf Montierbarkeit. Schrauben und Gewinde, Normteile und Stücklisten gehören zu deinem Handwerkszeug.",
        "jahr": 3,
        "block": "Gemeinsame Lernfelder, beide Fachrichtungen",
        "entwurf": true,
        "labs": [
          {
            "lab": "kon",
            "bereich": [
              "Schrauben und Gewinde"
            ]
          }
        ],
        "heft": "lernen-fug.html",
        "wiki": [],
        "projekt": [
          {
            "pid": "gehaeuse",
            "station": [
              "vd6"
            ]
          }
        ],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "10-MAK",
        "nr": "10 MAK",
        "titel": "LF 10 MAK: Datensätze und Dokumentationen für technische Systeme der automatisierten Fertigung erstellen und modifizieren",
        "kurz": "Fachrichtung Maschinen- und Anlagenkonstruktion: Du erstellst Datensätze und Unterlagen für automatisierte Fertigungsanlagen und passt sie bei Änderungen an.",
        "jahr": 3,
        "block": "Fachrichtung Maschinen- und Anlagenkonstruktion (MAK)",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "11-MAK",
        "nr": "11 MAK",
        "titel": "LF 11 MAK: 3D-Datensätze von Baugruppen unter Verwendung von Maschinenelementen sowie Kaufteilen erstellen und modifizieren",
        "kurz": "Fachrichtung Maschinen- und Anlagenkonstruktion: Du setzt Maschinenelemente wie Welle-Nabe-Verbindungen, Wälzlager und Federn sowie Kaufteile in Baugruppen ein.",
        "jahr": 3,
        "block": "Fachrichtung Maschinen- und Anlagenkonstruktion (MAK)",
        "entwurf": true,
        "labs": [
          {
            "lab": "kon",
            "bereich": "*"
          }
        ],
        "heft": "lernen-mas.html",
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "12-MAK",
        "nr": "12 MAK",
        "titel": "LF 12 MAK: 3D-Datensätze von Bauteilen und Baugruppen nach gestaltungstechnischen Vorgaben erstellen und modifizieren",
        "kurz": "Fachrichtung Maschinen- und Anlagenkonstruktion: Du setzt gestalterische Vorgaben in Bauteile und Baugruppen um und änderst die Datensätze passend.",
        "jahr": 4,
        "block": "Fachrichtung Maschinen- und Anlagenkonstruktion (MAK)",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "10-PGK",
        "nr": "10 PGK",
        "titel": "LF 10 PGK: 3D-Datensätze von Bauteilen nach Designvorgaben erstellen und modifizieren",
        "kurz": "Fachrichtung Produktgestaltung und -konstruktion: Du modellierst Bauteile nach Designvorgaben und änderst sie, wenn sich Vorgaben ändern.",
        "jahr": 3,
        "block": "Fachrichtung Produktgestaltung und -konstruktion (PGK)",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "11-PGK",
        "nr": "11 PGK",
        "titel": "LF 11 PGK: 3D-Datensätze von Baugruppen unter Verwendung von Normteilen sowie Kaufteilen erstellen und modifizieren",
        "kurz": "Fachrichtung Produktgestaltung und -konstruktion: Du baust Baugruppen mit Normteilen und Kaufteilen auf und passt sie an neue Anforderungen an.",
        "jahr": 3,
        "block": "Fachrichtung Produktgestaltung und -konstruktion (PGK)",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "12-PGK",
        "nr": "12 PGK",
        "titel": "LF 12 PGK: 3D-Datensätze von komplex aufgebauten Baugruppen aus Designideen erstellen und modifizieren",
        "kurz": "Fachrichtung Produktgestaltung und -konstruktion: Du machst aus Designideen komplexe Baugruppen als 3D-Datensatz und überarbeitest sie.",
        "jahr": 4,
        "block": "Fachrichtung Produktgestaltung und -konstruktion (PGK)",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "13",
        "nr": "13",
        "titel": "LF 13: Produktentwicklung kundenorientiert ausführen (beide Fachrichtungen)",
        "kurz": "Du führst eine Produktentwicklung von der Kundenanforderung bis zur fertigen Dokumentation durch. Dabei verbindest du alles aus den früheren Lernfeldern.",
        "jahr": 4,
        "block": "Gemeinsame Lernfelder, beide Fachrichtungen",
        "entwurf": false,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "KMK-Rahmenlehrplan Technischer Produktdesigner (Beschluss 27.05.2011); BIBB Ausbildung gestalten, Technischer Produktdesigner/Systemplaner, Abschnitt Lernfelder; ISB Bayern bs_lpr_technischer_produktdesigner.pdf",
        "pruefung": null
      },
      {
        "id": "Z-RECH",
        "nr": "",
        "titel": "Zusatzthema: Technisches Rechnen",
        "kurz": "Du übst das Rechnen, das in der Konstruktion ständig vorkommt: Einheiten umrechnen, Dreisatz, Prozent sowie Länge, Fläche, Volumen und Masse.",
        "jahr": 0,
        "block": "Übergreifend",
        "entwurf": true,
        "labs": [
          {
            "lab": "mat",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "Entwurf",
        "pruefung": null
      },
      {
        "id": "Z-ENG-BHF",
        "nr": "",
        "titel": "Zusatzthema: Technisches Englisch und Berichtsheft",
        "kurz": "Du übst Fachenglisch rund um Batterien, Geräte und Automatisierung und formulierst Tätigkeiten und Lernertrag im Ausbildungsnachweis verständlich.",
        "jahr": 0,
        "block": "Übergreifend",
        "entwurf": true,
        "labs": [
          {
            "lab": "eng",
            "bereich": "*"
          },
          {
            "lab": "bhf",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "quelle": "Entwurf",
        "pruefung": null
      }
    ]
  };
  if (AP) AP.register('tpd', plan); else queue.push(['tpd', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
