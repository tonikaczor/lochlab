'use strict';
/* ausbildungsplan-stu.js - Lernpfad "Studium Elektrotechnik" (Weg Studium/Technik, v55.174). ERZEUGT von quelle/gen/mkplan_wege.js, nicht von Hand ändern. */
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    beruf: "stu",
    titel: "Studium Elektrotechnik",
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
        kurz: "Du übst die Mathematik des Studiums direkt an Schaltungen und frischst das Rechnen aus der Schule auf. Zu Beginn: Arbeitsschutz und Erste Hilfe.",
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
        titel: "Modul 2: Netzwerke, Signale und Messtechnik",
        kurz: "Du rechnest Wechselstromnetze, analysierst Spektren, Abtastung und Filter und misst mit Verstand.",
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
        titel: "Modul 3: Elektronik",
        kurz: "Du untersuchst Halbleiter und Verstärker, rechnest Netzteile, baust Digitaltechnik, liest Datenblätter und gestaltest Leiterplatten.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"ana","bereich":"*"},{"lab":"nts","bereich":"*"},{"lab":"digi","bereich":"*"},{"lab":"ds","bereich":"*"},{"lab":"pcb","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M4",
        nr: "4",
        titel: "Modul 4: Regelung und Systeme",
        kurz: "Du entwirfst Regelkreise und beurteilst ihre Stabilität, dazu Sensoren und Antriebe.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"reg","bereich":"*"},{"lab":"rg2","bereich":"*"},{"lab":"sen","bereich":"*"},{"lab":"ant","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M5",
        nr: "5",
        titel: "Modul 5: Eingebettete Systeme und Programmieren",
        kurz: "Du programmierst Mikrocontroller, rechnest Echtzeit nach, entwickelst Algorithmen und arbeitest mit dem Raspberry Pi.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"code","bereich":"*"},{"lab":"emb","bereich":"*"},{"lab":"alg","bereich":"*"},{"lab":"pi","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M6",
        nr: "6",
        titel: "Modul 6: Energie, EMV und Wärme",
        kurz: "Du bewertest Energiesysteme, elektromagnetische Verträglichkeit und die Wärmeabfuhr.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"enr","bereich":"*"},{"lab":"emv","bereich":"*"},{"lab":"thm","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M7",
        nr: "7",
        titel: "Modul 7: Projekt, Normen und Fachenglisch",
        kurz: "Du planst und bewertest Projekte, wendest Normen an und liest englische Fachtexte.",
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
  if (AP) AP.register('stu', plan); else queue.push(['stu', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
