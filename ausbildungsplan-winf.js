'use strict';
/* ausbildungsplan-winf.js - Lernpfad "Wirtschaftsinformatik" (Weg Studium/Technik, v55.174). ERZEUGT von quelle/gen/mkplan_wege.js, nicht von Hand ändern. */
(function (root) {
  var AP = root.AusbildungsPlan, queue = root.__apQueue = root.__apQueue || [];
  var plan = {
    beruf: "winf",
    titel: "Wirtschaftsinformatik",
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
        kurz: "Du übst die mathematischen Grundlagen für Signale und Systeme und frischst das Rechnen auf. Zu Beginn: Arbeitsschutz und Erste Hilfe.",
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
        titel: "Modul 2: Logik und Programmieren",
        kurz: "Du arbeitest mit digitaler Logik, entwickelst Algorithmen, baust eigene Apps und programmierst den Arduino.",
        jahr: 1,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"digi","bereich":"*"},{"lab":"alg","bereich":"*"},{"lab":"app","bereich":"*"},{"lab":"code","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M3",
        nr: "3",
        titel: "Modul 3: Datenbanken",
        kurz: "Du fragst Daten mit SQL ab, verknüpfst Tabellen und wertest die Ergebnisse aus.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"sql","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M4",
        nr: "4",
        titel: "Modul 4: Systeme und Netze",
        kurz: "Du kennst PC-Hardware und IT-Systeme, arbeitest im Linux-Terminal, planst Netzwerke und nutzt den Raspberry Pi.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"hwl","bereich":"*"},{"lab":"sys","bereich":"*"},{"lab":"lin","bereich":"*"},{"lab":"net","bereich":"*"},{"lab":"pi","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M5",
        nr: "5",
        titel: "Modul 5: IT-Sicherheit",
        kurz: "Du erkennst Gefahren in IT-Systemen und wählst passende Schutzmaßnahmen aus.",
        jahr: 2,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"its","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M6",
        nr: "6",
        titel: "Modul 6: Signale und Embedded",
        kurz: "Du analysierst Signale und Spektren und rechnest Timer, Schnittstellen und Echtzeit von Mikrocontrollern nach.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"sig","bereich":"*"},{"lab":"emb","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M7",
        nr: "7",
        titel: "Modul 7: Betriebswirtschaft und Prozesse",
        kurz: "Du kalkulierst, buchst, planst den Warenfluss und kennst die Regeln der Auftragsabwicklung.",
        jahr: 3,
        quelle: "Entwurf: eigene Zusammenstellung nach dem Inhalt der Labs, kein amtlicher Lehrplan",
        entwurf: true,
        labs: [{"lab":"kal","bereich":"*"},{"lab":"buc","bereich":"*"},{"lab":"wfl","bereich":"*"},{"lab":"rec","bereich":"*"}],
        heft: null,
        wiki: [],
        projekt: [],
        pruefung: null
      },
      {
        id: "M8",
        nr: "8",
        titel: "Modul 8: Projekt, Normen und Fachenglisch",
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
  if (AP) AP.register('winf', plan); else queue.push(['winf', plan]);
})(typeof window !== 'undefined' ? window : globalThis);
