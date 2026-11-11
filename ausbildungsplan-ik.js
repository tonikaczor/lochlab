'use strict';
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    "beruf": "ik",
    "titel": "Industriekaufmann",
    "status": "entwurf",
    "quelle": "KMK-Rahmenlehrplan Industriekaufleute 2024 (13 Lernfelder, gültig seit 01.08.2024; ersetzt die Altordnung mit 12 Lernfeldern); Titel nach ISB Bayern (bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf) und IHK-Basisinformation Neuordnung. Jahr je Lernfeld nach IHK (LF1-5 Jahr 1, LF6-9 Jahr 2, LF10-13 Jahr 3), Bayern verteilt abweichend. AP1 nur für LF1-7 belegt (ISB Bayern: vor Teil 1 zu unterrichten); Lab-Zuordnung ist Entwurf.",
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
        "titel": "LF 1: Das Unternehmen vorstellen und die eigene Rolle mitgestalten",
        "kurz": "Du lernst, wie ein Industriebetrieb aufgebaut ist und welche Rolle du als Auszubildende oder Auszubildender darin hast. Dazu gehört auch dein Ausbildungsnachweis.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": false,
        "labs": [
          {
            "lab": "bhf",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [
          "bg-berufsausbildung",
          "bg-arbeitszeitgesetz"
        ],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF2",
        "nr": "2",
        "titel": "LF 2: Projekte planen und durchführen",
        "kurz": "Du lernst, ein Projekt zu planen, im Team umzusetzen und auszuwerten, und prüfst dabei die Qualität deiner Arbeit anhand einfacher Regeln und Kennzahlen.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [
          {
            "lab": "rec",
            "bereich": [
              "Qualität und Projekt"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-pdca-kvp"
        ],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF3",
        "nr": "3",
        "titel": "LF 3: Kundenaufträge bearbeiten und überwachen",
        "kurz": "Du lernst, wie ein Kundenauftrag von der Anfrage über den Vertrag bis zur Zahlung läuft: Vertragsarten, Fristen, Zahlungsbedingungen und Eigentumsvorbehalt.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": false,
        "labs": [
          {
            "lab": "rec",
            "bereich": [
              "Vertragsabschluss",
              "Vertragsarten",
              "Fristen",
              "Zahlung und Eigentumsvorbehalt"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-kaufvertrag",
          "bg-rechtsgeschaefte"
        ],
        "projekt": [
          {
            "pid": "kalk",
            "station": [
              "vc1",
              "vc3",
              "vc7"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF4",
        "nr": "4",
        "titel": "LF 4: Beschaffungsprozesse planen und steuern",
        "kurz": "Du lernst, Bezugsquellen und Angebote zu vergleichen, den Bezugspreis zu kalkulieren und Belege sowie Störungen im Einkauf zu bearbeiten.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [
          {
            "lab": "kal",
            "bereich": [
              "Bezug"
            ]
          },
          {
            "lab": "rec",
            "bereich": [
              "Belegkette",
              "Vertragsstörungen"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "kalk",
            "station": [
              "vc2"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz1"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF5",
        "nr": "5",
        "titel": "LF 5: Wertströme buchhalterisch dokumentieren und auswerten",
        "kurz": "Du lernst, Inventur und Bilanz zu verstehen und Geschäftsfälle mit Kontenrahmen, Umsatzsteuer und Warenkonten zu buchen.",
        "jahr": 1,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": false,
        "labs": [
          {
            "lab": "buc",
            "bereich": [
              "Inventur und Bilanz",
              "Buchungssätze",
              "Umsatzsteuer",
              "Warenkonten"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "kalk",
            "station": [
              "vc6"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz12"
            ]
          }
        ],
        "pruefung": "AP1"
      },
      {
        "id": "LF6",
        "nr": "6",
        "titel": "LF 6: Leistungserstellung planen, steuern und kontrollieren",
        "kurz": "Du lernst, wie ein Betrieb seine Produktion plant, steuert und kontrolliert. Dazu gibt es im Lab noch keine eigenen Aufgaben.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF7",
        "nr": "7",
        "titel": "LF 7: Logistik- und Lagerprozesse koordinieren, umsetzen und überwachen",
        "kurz": "Du lernst, Lager- und Transportprozesse zu koordinieren und zu überwachen. Dazu gibt es im Lab noch keine eigenen Aufgaben.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP1"
      },
      {
        "id": "LF8",
        "nr": "8",
        "titel": "LF 8: Kosten- und Leistungsrechnung zur Vorbereitung unternehmerischer Entscheidungen durchführen",
        "kurz": "Du lernst, Selbstkosten, Angebotspreis, Deckungsbeitrag und Break-even zu rechnen und daraus Entscheidungen abzuleiten.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": false,
        "labs": [
          {
            "lab": "kal",
            "bereich": [
              "Selbstkosten",
              "Angebot",
              "Rückwärts/Differenz",
              "Spanne/Faktor",
              "Deckungsbeitrag"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [
          {
            "pid": "kalk",
            "station": [
              "vc4",
              "vc5",
              "vc8"
            ]
          },
          {
            "pid": "tonfunk",
            "station": [
              "vz6"
            ]
          }
        ],
        "pruefung": "AP2"
      },
      {
        "id": "LF9",
        "nr": "9",
        "titel": "LF 9: Marketingkonzepte planen und umsetzen",
        "kurz": "Du lernst, ein Marketingkonzept für Produkte und Zielgruppen zu planen und umzusetzen. Dazu gibt es im Lab noch keine eigenen Aufgaben.",
        "jahr": 2,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF10",
        "nr": "10",
        "titel": "LF 10: Jahresabschluss vorbereiten, auswerten und für Finanzierungsentscheidungen nutzen",
        "kurz": "Du lernst, Abschreibungen zu buchen, den Jahresabschluss vorzubereiten und seine Zahlen für Finanzierungsentscheidungen zu nutzen.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [
          {
            "lab": "buc",
            "bereich": [
              "Abschreibung",
              "Abschluss"
            ]
          }
        ],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF11",
        "nr": "11",
        "titel": "LF 11: Geschäftsprozesse an gesamtwirtschaftlichen Rahmenbedingungen ausrichten",
        "kurz": "Du lernst, wie Wirtschaftslage, Märkte und rechtliche Vorgaben die Entscheidungen eines Betriebs beeinflussen. Dazu gibt es im Lab noch keine eigenen Aufgaben.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [],
        "heft": null,
        "wiki": [],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "LF12",
        "nr": "12",
        "titel": "LF 12: Personalprozesse planen, steuern und kontrollieren",
        "kurz": "Du lernst Arbeitsvertrag, Lohn und Gehalt, Abzüge sowie Personalkosten kennen und buchst Löhne und Gehälter.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": false,
        "labs": [
          {
            "lab": "rec",
            "bereich": [
              "Lohn und Arbeitsvertrag"
            ]
          },
          {
            "lab": "buc",
            "bereich": [
              "Personal"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-arbeitsvertrag",
          "bg-entgeltabrechnung",
          "bg-tarifvertrag",
          "bg-sozialversicherung",
          "bg-urlaubsanspruch",
          "bg-kuendigung",
          "bg-arbeitszeugnis",
          "fo-brutto-netto"
        ],
        "projekt": [],
        "pruefung": "AP2"
      },
      {
        "id": "LF13",
        "nr": "13",
        "titel": "LF 13: Betriebliche Problemlösungsprozesse innovativ durchführen",
        "kurz": "Du lernst, eine komplexe betriebliche Aufgabe selbst zu analysieren, Lösungen zu entwickeln und zu bewerten, auch mit Qualitätswerkzeugen.",
        "jahr": 3,
        "quelle": "KMK-Rahmenlehrplan Industriekaufleute (2024); ISB Bayern bs_lpr_industriekaufmann_industriekauffrau_24.06.pdf; IHK-Basisinformation Neuordnung",
        "entwurf": true,
        "labs": [
          {
            "lab": "kal",
            "bereich": [
              "Qualität und Projekt"
            ]
          }
        ],
        "heft": null,
        "wiki": [
          "bg-pareto",
          "bg-ishikawa"
        ],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "Z-RECHNEN",
        "nr": "",
        "titel": "Zusatzthema: Rechnen im Betrieb",
        "kurz": "Du übst Einheiten, Dreisatz, Prozentrechnung, Umstellen von Formeln und einfache Geometrie, die du in vielen Lernfeldern brauchst.",
        "jahr": 0,
        "quelle": "Entwurf",
        "entwurf": true,
        "labs": [
          {
            "lab": "mat",
            "bereich": "*"
          }
        ],
        "heft": null,
        "wiki": [
          "fo-dreisatz",
          "fo-prozentrechnung"
        ],
        "projekt": [],
        "pruefung": null
      },
      {
        "id": "Z-ENGLISCH",
        "nr": "",
        "titel": "Zusatzthema: Fachenglisch im Büro",
        "kurz": "Du trainierst Fachvokabeln, E-Mails, Telefonate, Stückliste und Lieferschein auf Englisch, wie sie im Kontakt mit Kunden und Lieferanten vorkommen.",
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
        "wiki": [
          "bg-englisch-formell"
        ],
        "projekt": [],
        "pruefung": null
      }
    ]
  };
  if (AP) AP.register('ik', plan); else queue.push(['ik', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
