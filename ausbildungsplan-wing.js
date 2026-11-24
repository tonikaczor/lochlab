'use strict';
/* ausbildungsplan-wing.js - Lernpfad "Wirtschaftsingenieur" (Weg Studium/Technik, v55.174). ERZEUGT von quelle/gen/mkplan_wege.js, nicht von Hand ändern. */
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    beruf: "wing",
    titel: "Wirtschaftsingenieur",
    status: "entwurf",
    quelle: "Entwurf: Lernpfad aus Modulen (eigene Zusammenstellung nach dem Inhalt der Labs). Module statt Lernfelder, Stufen statt Ausbildungsjahre; kein amtlicher Lehrplan.",
    jahre: [
      {"j":1,"t":"Stufe 1: Grundlagen"},
      {"j":2,"t":"Stufe 2: Vertiefung"},
      {"j":3,"t":"Stufe 3: Anwendung und Projekt"},
      {"j":0,"t":"Übergreifend"}
    ],
    lernfelder: [
      {
        id: "M1",
        nr: "1",
        titel: "Modul 1: Mathematik",
        kurz: "Du übst komplexe Zahlen, Matrizen und Differenzialgleichungen und frischst das Rechnen auf. Zu Beginn: Arbeitsschutz und Erste Hilfe.",
        jahr: 1,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"arb","bereich":"*"},{"lab":"mat","bereich":"*"},{"lab":"mat2","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M2",
        nr: "2",
        titel: "Modul 2: Technikgrundlagen",
        kurz: "Du lernst Wechselstrom, Signale und Messtechnik als gemeinsame Sprache mit den Technikern.",
        jahr: 1,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"wsl","bereich":"*"},{"lab":"sig","bereich":"*"},{"lab":"mess","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M3",
        nr: "3",
        titel: "Modul 3: Werkstoffe und Fertigung",
        kurz: "Du wählst Werkstoffe, rechnest Mechanik und Toleranzen und beurteilst Fertigungsverfahren.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"wer","bereich":"*"},{"lab":"mch","bereich":"*"},{"lab":"tol","bereich":"*"},{"lab":"fer","bereich":"*"},{"lab":"fli","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M4",
        nr: "4",
        titel: "Modul 4: Automatisierung und Energie",
        kurz: "Du verstehst Steuerung, Sensoren, Antriebe und Regelung und bewertest die Energieversorgung.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"sps","bereich":"*"},{"lab":"sen","bereich":"*"},{"lab":"ant","bereich":"*"},{"lab":"reg","bereich":"*"},{"lab":"rg2","bereich":"*"},{"lab":"enr","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M5",
        nr: "5",
        titel: "Modul 5: Rechnungswesen",
        kurz: "Du kalkulierst Kosten, buchst Geschäftsfälle und wertest sie aus.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"kal","bereich":"*"},{"lab":"buc","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M6",
        nr: "6",
        titel: "Modul 6: Logistik und Recht",
        kurz: "Du planst den Warenfluss und das Lager und kennst die Regeln der Auftragsabwicklung.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"wfl","bereich":"*"},{"lab":"lag","bereich":"*"},{"lab":"rec","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M7",
        nr: "7",
        titel: "Modul 7: Projekt, Normen und Fachenglisch",
        kurz: "Du planst Projekte, bewertest sie wirtschaftlich, wendest Normen an und liest englische Fachtexte.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"prj","bereich":"*"},{"lab":"nrm","bereich":"*"},{"lab":"eng","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      }
    ]
  };
  if (AP) AP.register('wing', plan); else queue.push(['wing', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
