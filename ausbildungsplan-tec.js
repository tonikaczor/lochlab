'use strict';
/* ausbildungsplan-tec.js - Lernpfad "Techniker Elektrotechnik" (Weg Studium/Technik, v55.174). ERZEUGT von quelle/gen/mkplan_wege.js, nicht von Hand ändern. */
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    beruf: "tec",
    titel: "Techniker Elektrotechnik",
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
        titel: "Modul 1: Mathematik für die Technik",
        kurz: "Du frischst das Rechnen auf und übst komplexe Zahlen, Matrizen, Differenzialgleichungen, Laplace und Fourier an Schaltungen. Zu Beginn: Arbeitsschutz, Erste Hilfe und wie Tonfunk fertigt.",
        jahr: 1,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"arb","bereich":"*"},{"lab":"ems","bereich":"*"},{"lab":"mat","bereich":"*"},{"lab":"mat2","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M2",
        nr: "2",
        titel: "Modul 2: Wechselstrom, Signale und Messtechnik",
        kurz: "Du rechnest Wechselstromnetze, liest Spektren, tastest Signale ab, entwirfst Filter und misst sicher und genau.",
        jahr: 1,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"wsl","bereich":"*"},{"lab":"sig","bereich":"*"},{"lab":"hf","bereich":"*"},{"lab":"mess","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M3",
        nr: "3",
        titel: "Modul 3: Elektronik und Digitaltechnik",
        kurz: "Du untersuchst Dioden, Transistoren und Operationsverstärker, rechnest Netzteile, baust Logikschaltungen und liest Datenblätter.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"ana","bereich":"*"},{"lab":"nts","bereich":"*"},{"lab":"digi","bereich":"*"},{"lab":"ds","bereich":"*"},{"lab":"eda","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M4",
        nr: "4",
        titel: "Modul 4: Automatisierung und Antriebe",
        kurz: "Du programmierst Steuerungen, liest Schaltschrank-Pläne und wählst Motoren und Sensoren aus.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"sps","bereich":"*"},{"lab":"ssl","bereich":"*"},{"lab":"ant","bereich":"*"},{"lab":"sen","bereich":"*"},{"lab":"iot","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M5",
        nr: "5",
        titel: "Modul 5: Regelungstechnik",
        kurz: "Du verstehst Regelkreise und entwirfst Regler mit Bode-Diagramm, Stabilitätskriterien und Wurzelortskurve.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"reg","bereich":"*"},{"lab":"rg2","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M6",
        nr: "6",
        titel: "Modul 6: Mikrocontroller",
        kurz: "Du programmierst den Arduino und rechnest Timer, Analog-Digital-Wandlung, serielle Busse und Echtzeit nach.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"code","bereich":"*"},{"lab":"emb","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M7",
        nr: "7",
        titel: "Modul 7: Energie, Sicherheit und Verträglichkeit",
        kurz: "Du bewertest Energieanlagen, elektrische Sicherheit, elektromagnetische Verträglichkeit und die Wärmeabfuhr.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"enr","bereich":"*"},{"lab":"els","bereich":"*"},{"lab":"emv","bereich":"*"},{"lab":"thm","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M8",
        nr: "8",
        titel: "Modul 8: Konstruieren und 3D-Druck",
        kurz: "Du konstruierst Bauteile und Gehäuse am Rechner und bereitest sie im Slicer für den 3D-Druck vor.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"cad","bereich":"*"},{"lab":"drk","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M9",
        nr: "9",
        titel: "Modul 9: Normen, Projekt und Betrieb",
        kurz: "Du wendest Normen an, planst und bewertest Projekte, kalkulierst Kosten und liest englische Fachtexte.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"bmk","bereich":"*"},{"lab":"nrm","bereich":"*"},{"lab":"prj","bereich":"*"},{"lab":"fli","bereich":"*"},{"lab":"kal","bereich":"*"},{"lab":"eng","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      }
    ]
  };
  if (AP) AP.register('tec', plan); else queue.push(['tec', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
