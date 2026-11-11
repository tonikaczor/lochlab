/* Einordnung "Warum brauche ich das?" für Mechanik, Fertigung, Konstruktion (Industriemechaniker, Produktdesigner). Handgepflegt. */
'use strict';
(function (root) {
  var E = [
    { lab: 'tol', betrieb: 'Mit jeder Messung am Bauteil prüfst du, ob das Maß noch im Toleranzfeld liegt. So entscheidest du, ob ein Teil in die Baugruppe passt oder Ausschuss ist.' },
    { lab: 'zer', betrieb: 'Beim Einrichten von Drehmaschine, Fräse oder Bohrmaschine wählst du Drehzahl und Vorschub passend zu Werkstoff und Werkzeug. Das schont das Werkzeug, verlängert die Standzeit und sichert eine saubere Oberfläche.' },
    { lab: 'fer', betrieb: 'In der Werkstatt planst du, mit welchem Verfahren du ein Teil fertigst, rechnest die Zuschnittlänge und kontrollierst die Qualität. So werden Biegeteile, Gewinde und Serien maßhaltig.' },
    { lab: 'pne', betrieb: 'Druckluftzylinder spannen, schieben und sortieren in vielen Anlagen. Wenn du Schaltpläne lesen und verschlauchen kannst, findest du Fehler schneller und baust Steuerungen sauber auf.' },
    { lab: 'hyd', betrieb: 'Pressen, Hebebühnen und Bagger arbeiten mit Hydraulik. Du berechnest Kraft und Geschwindigkeit der Zylinder und liest Schaltpläne, um Anlagen einzustellen oder Störungen einzugrenzen.' },
    { lab: 'mas', betrieb: 'Getriebe, Riemen, Lager und Kupplungen stecken in fast jeder Maschine. Du erkennst, welches Element wo wirkt, und tauschst Verschleißteile gezielt statt zu raten.' },
    { lab: 'cnc', betrieb: 'An CNC-Drehmaschinen und Fräsmaschinen liest und prüfst du G-Code-Programme, bevor die Maschine anläuft. So erkennst du Fehler in der Werkzeugbahn schon vorher und vermeidest Crashs.' },
    { lab: 'fug', betrieb: 'Schrauben mit richtigem Anzugsmoment, Schweißnähte, Löt- und Klebstellen halten Baugruppen zusammen. Du wählst das passende Fügeverfahren und beurteilst, ob eine Verbindung belastbar ist.' },
    { lab: 'mak', betrieb: 'Bevor du an Drehmaschine, Fräse oder Säge arbeitest, musst du Hebel, Drehzahltafeln und Spannmittel sicher bedienen. Das Lab übt Maschinenwahl, Einstellung und Sicherheitsregeln.' },
    { lab: 'wer', betrieb: 'Ob Stahl, Aluminium oder Kunststoff: Du wählst den Werkstoff nach Belastung und Bearbeitung und liest Werkstoffbezeichnungen. Härte- und Zugversuch zeigen dir, was ein Material wirklich aushält.' },
    { lab: 'mch', betrieb: 'Du rechnest, welche Kräfte an Hebeln, Trägern und Schraubverbindungen wirken. So beurteilst du, ob ein Bauteil hält oder verformt wird, bevor du es baust oder belastest.' },
    { lab: 'ins', betrieb: 'Steht eine Maschine still, kostet jede Minute Geld. Du gehst Schritt für Schritt vor: Ursache eingrenzen, sicher beheben und mit Wartungsplan und Schmierplan Ausfällen vorbeugen.' },
    { lab: 'zei', betrieb: 'Die Zeichnung ist die Sprache der Werkstatt. Du liest Ansichten, Maße und Schnitte, um ein Teil richtig zu fertigen, und zeichnest so, dass andere dich eindeutig verstehen.' },
    { lab: 'kon', betrieb: 'Beim Konstruieren wählst du Normteile, trägst Toleranzen ein und gestaltest Teile so, dass sie sich gut fertigen lassen. Das spart in der Werkstatt Rückfragen und Nacharbeit.' }
  ];
  var R = root.Einordnung;
  for (var i = 0; i < E.length; i++) {
    if (R && R.register) R.register(E[i]);
    else (root.__einQueue = root.__einQueue || []).push(E[i]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
