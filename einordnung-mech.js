/* Einordnung "Warum brauche ich das?" für Mechanik, Fertigung, Konstruktion (Industriemechaniker, Produktdesigner). Handgepflegt.
   pruefung (v63.187): ein Satz, wofür du das Thema in der Abschlussprüfung Teil 1 oder Teil 2 brauchst (höchstens 160 Zeichen, nur allgemein Bekanntes, keine Versprechen). */
'use strict';
(function (root) {
  var E = [
    { lab: 'tol', betrieb: 'Mit jeder Messung am Bauteil prüfst du, ob das Maß noch im Toleranzfeld liegt. So entscheidest du, ob ein Teil in die Baugruppe passt oder Ausschuss ist.',
      pruefung: 'In Teil 1 prüfst du deine gefertigten Maße selbst. Du bestimmst Grenzmaße, Toleranz und Passungsart aus der Zeichnung.' },
    { lab: 'zer', betrieb: 'Beim Einrichten von Drehmaschine, Fräse oder Bohrmaschine wählst du Drehzahl und Vorschub passend zu Werkstoff und Werkzeug. Das schont das Werkzeug, verlängert die Standzeit und sichert eine saubere Oberfläche.',
      pruefung: 'Drehzahl, Vorschub und Hauptnutzungszeit für Drehen, Fräsen und Bohren berechnen und passende Schnittwerte aus der Tabelle wählen.' },
    { lab: 'fer', betrieb: 'In der Werkstatt planst du, mit welchem Verfahren du ein Teil fertigst, rechnest die Zuschnittlänge und kontrollierst die Qualität. So werden Biegeteile, Gewinde und Serien maßhaltig.',
      pruefung: 'In Teil 1 fertigst du ein Werkstück von Hand und an Maschinen nach Zeichnung. Dazu planst du die Arbeitsschritte und wählst das Verfahren.' },
    { lab: 'pne', betrieb: 'Druckluftzylinder spannen, schieben und sortieren in vielen Anlagen. Wenn du Schaltpläne lesen und verschlauchen kannst, findest du Fehler schneller und baust Steuerungen sauber auf.',
      pruefung: 'Einen pneumatischen Schaltplan lesen, Bauteile und Anschlüsse benennen, die Kolbenkraft berechnen und einen Fehler in der Steuerung eingrenzen.' },
    { lab: 'hyd', betrieb: 'Pressen, Hebebühnen und Bagger arbeiten mit Hydraulik. Du berechnest Kraft und Geschwindigkeit der Zylinder und liest Schaltpläne, um Anlagen einzustellen oder Störungen einzugrenzen.',
      pruefung: 'Einen Hydraulikplan lesen, Ventile und Anschlüsse benennen und Druck, Kolbenkraft oder Volumenstrom eines Zylinders berechnen.' },
    { lab: 'mas', betrieb: 'Getriebe, Riemen, Lager und Kupplungen stecken in fast jeder Maschine. Du erkennst, welches Element wo wirkt, und tauschst Verschleißteile gezielt statt zu raten.',
      pruefung: 'Übersetzung, Drehzahl und Drehmoment eines Getriebes berechnen und Lager, Kupplungen oder Dichtungen in einer Gesamtzeichnung benennen.' },
    { lab: 'cnc', betrieb: 'An CNC-Drehmaschinen und Fräsmaschinen liest und prüfst du G-Code-Programme, bevor die Maschine anläuft. So erkennst du Fehler in der Werkzeugbahn schon vorher und vermeidest Crashs.',
      pruefung: 'Ein CNC-Programm lesen: Wegbedingungen und Koordinaten deuten, fehlende Sätze ergänzen oder einen Fehler im Programm finden.' },
    { lab: 'fug', betrieb: 'Schrauben mit richtigem Anzugsmoment, Schweißnähte, Löt- und Klebstellen halten Baugruppen zusammen. Du wählst das passende Fügeverfahren und beurteilst, ob eine Verbindung belastbar ist.',
      pruefung: 'Das passende Fügeverfahren begründen, Schweißnaht-Angaben in der Zeichnung lesen und Schrauben nach Festigkeitsklasse und Anzugsmoment auswählen.' },
    { lab: 'mak', betrieb: 'Bevor du an Drehmaschine, Fräse oder Säge arbeitest, musst du Hebel, Drehzahltafeln und Spannmittel sicher bedienen. Das Lab übt Maschinenwahl, Einstellung und Sicherheitsregeln.',
      pruefung: 'Für einen Arbeitsschritt die passende Maschine und das Spannmittel wählen und die Sicherheitsregeln an Dreh-, Fräs- und Bohrmaschine nennen.' },
    { lab: 'wer', betrieb: 'Ob Stahl, Aluminium oder Kunststoff: Du wählst den Werkstoff nach Belastung und Bearbeitung und liest Werkstoffbezeichnungen. Härte- und Zugversuch zeigen dir, was ein Material wirklich aushält.',
      pruefung: 'Werkstoffbezeichnungen entschlüsseln, Kennwerte aus dem Zugversuch ablesen und den Werkstoff für ein Bauteil begründet auswählen.' },
    { lab: 'mch', betrieb: 'Du rechnest, welche Kräfte an Hebeln, Trägern und Schraubverbindungen wirken. So beurteilst du, ob ein Bauteil hält oder verformt wird, bevor du es baust oder belastest.',
      pruefung: 'Kräfte und Drehmomente an Hebeln berechnen, Auflagerkräfte bestimmen und prüfen, ob die Spannung im Bauteil zulässig ist.' },
    { lab: 'ins', betrieb: 'Steht eine Maschine still, kostet jede Minute Geld. Du gehst Schritt für Schritt vor: Ursache eingrenzen, sicher beheben und mit Wartungsplan und Schmierplan Ausfällen vorbeugen.',
      pruefung: 'In Teil 2 planst du zu einem Auftrag Wartung oder Instandsetzung: Fehler eingrenzen, Arbeitsschritte festlegen, Anlage sichern und übergeben.' },
    { lab: 'zei', betrieb: 'Die Zeichnung ist die Sprache der Werkstatt. Du liest Ansichten, Maße und Schnitte, um ein Teil richtig zu fertigen, und zeichnest so, dass andere dich eindeutig verstehen.',
      pruefung: 'Aus einer Gesamtzeichnung Maße, Toleranzen und Angaben der Stückliste entnehmen, Ansichten zuordnen und Schnitte richtig lesen.' },
    { lab: 'kon', betrieb: 'Beim Konstruieren wählst du Normteile, trägst Toleranzen ein und gestaltest Teile so, dass sie sich gut fertigen lassen. Das spart in der Werkstatt Rückfragen und Nacharbeit.',
      pruefung: 'Normteile in der Stückliste bestimmen, Gewinde- und Oberflächenangaben lesen und Form- und Lagetoleranzen in der Zeichnung deuten.' }
  ];
  var R = root.Einordnung;
  for (var i = 0; i < E.length; i++) {
    if (R && R.register) R.register(E[i]);
    else (root.__einQueue = root.__einQueue || []).push(E[i]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
