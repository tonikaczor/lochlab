'use strict';
/* Tonfunk CNC-Lab: Daten (Lab-Kennung 'cnc'): Beispielprogramme, Aufgaben, Zufallsgeneratoren, Prüfung.
   window.CNC_DATA = {examples, tasks, cats, check, gen, checkItem}; window.CNC_TASKS = [{id, cat, title, level}] (Kurzliste für Karriere/Lernpfad)
   Status gelöster Aufgaben: localStorage 'lm4.cnc.done' = {id:true}.
   Jede Aufgabe: id, cat, level 1-3, title, text, machine, setup, ask {type:'num'|'choice'|'prog'}, solve(C) (Referenz), expl, tips[2], bad (typischer Fehlerfall für die Tests).
   Prüfung durch Ausführung: Zahlen werden aus dem Programmlauf gewonnen, Programmaufgaben durch Vergleich von Bahn und abgetragenem Material mit der Referenz. */
(function (root) {
  const C = root.CNC_CORE || (typeof require !== 'undefined' ? require('./cnccore.js') : null);
  const L = (...a) => a.join('\n');
  const posAfter = (res, n) => { let s = null; res.steps.forEach(x => { if (x.n === n) s = x; }); return s ? [s.state.pos.x, s.state.pos.y, s.state.pos.z] : null; };

  /* ============================================================ Beispielprogramme (Editor) */
  const examples = [
    { id: 'absatz', machine: 'turn', title: 'Drehen: Absatzwelle Ø40', note: 'Plandrehen, Schruppen in Stufen, Schlichten der Kontur mit Fase 2×45°. X ist der Durchmesser.', src: L(
      '(ABSATZWELLE Ø40 - DREHEN)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1200 M8', 'N40 G0 X42 Z0', 'N50 G1 X-1 F0.15 (PLANDREHEN)', 'N60 G0 X42 Z2',
      '(SCHRUPPEN)', 'N70 G0 X36', 'N80 G1 Z-35 F0.25', 'N90 G0 X42 Z2', 'N100 G0 X32', 'N110 G1 Z-35', 'N120 G0 X42 Z2', 'N130 G0 X26', 'N140 G1 Z-20', 'N150 G0 X42 Z2', 'N160 G0 X22', 'N170 G1 Z-20', 'N180 G0 X42 Z2',
      '(SCHLICHTEN)', 'N190 G0 X16 Z2', 'N200 G1 Z0 F0.1', 'N210 X20 Z-2 (FASE 2X45)', 'N220 Z-20', 'N230 X30', 'N240 Z-35', 'N250 X40', 'N260 Z-50',
      'N270 G0 X100 Z50', 'N280 M5 M9', 'N290 M30') },
    { id: 'rundung', machine: 'turn', title: 'Drehen: Wellenende mit Radius R5', note: 'Kreisbogen G3 beim Drehen: I ist der Mittelpunktabstand in X (als Radius), K in Z.', src: L(
      '(RUNDUNG R5 - DREHEN)', 'N10 G54 G90 G95 G18', 'N20 T2', 'N30 M3 S1500 M8', 'N40 G0 X42 Z0', 'N50 G1 X-1 F0.12', 'N60 G0 X42 Z2', 'N70 G0 X0', 'N80 G1 Z0 F0.1', 'N90 G1 X20 (STIRNFLAECHE BIS R10)',
      'N100 G3 X30 Z-5 I0 K-5 (RADIUS R5)', 'N110 G1 Z-30', 'N120 G1 X40', 'N130 G1 Z-50', 'N140 G0 X100 Z50', 'N150 M5 M9', 'N160 M30') },
    { id: 'tasche', machine: 'mill', title: 'Fräsen: Rechtecktasche 40×30, 3 tief', note: 'Taschenmitte X40 Y30. Fräser Ø10 (T1): Die Werkzeugmitte fährt Zeilen im Abstand 5 mm.', src: L(
      '(RECHTECKTASCHE 40X30 TIEF 3 - FRAESEN)', 'N10 G54 G90 G94 G17 G40', 'N20 T1 M6', 'N30 M3 S3000 M8', 'N40 G0 X25 Y20', 'N50 G0 Z2', 'N60 G1 Z-3 F100',
      'N70 G1 X55 F300', 'N80 Y25', 'N90 X25', 'N100 Y30', 'N110 X55', 'N120 Y35', 'N130 X25', 'N140 Y40', 'N150 X55',
      '(KONTUR NACHFAHREN)', 'N160 Y20', 'N170 X25', 'N180 Y40', 'N190 X55', 'N200 G0 Z50', 'N210 M5 M9', 'N220 M30') },
    { id: 'bohr', machine: 'mill', title: 'Fräsen: Bohrbild 4 Bohrungen Ø8', note: 'Vier Bohrungen mit dem Bohrzyklus G81 (T3, Tiefe 10, Rückzugsebene R2).', src: L(
      '(BOHRBILD 4X D8 TIEF 10)', 'N10 G54 G90 G94 G17 G40 G80', 'N20 T3 M6', 'N30 M3 S1500 M8', 'N40 G0 Z5', 'N50 G0 X15 Y15', 'N60 G99 G81 X15 Y15 Z-10 R2 F120 (ERSTE BOHRUNG)',
      'N70 X65', 'N80 Y45', 'N90 X15', 'N100 G80', 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30') },
    { id: 'nut', machine: 'mill', title: 'Fräsen: Nut mit Eckenradien R5', note: 'Geschlossene Nut mit vier Viertelkreisen (G3, Mittelpunkt mit I/J). Fräser Ø6 (T2).', src: L(
      '(NUT MIT ECKENRADIEN R5 - T2)', 'N10 G54 G90 G94 G17 G40', 'N20 T2 M6', 'N30 M3 S4000 M8', 'N40 G0 X25 Y15', 'N50 G0 Z2', 'N60 G1 Z-2 F80', 'N70 G1 X55 F250', 'N80 G3 X60 Y20 I0 J5',
      'N90 G1 Y40', 'N100 G3 X55 Y45 I-5 J0', 'N110 G1 X25', 'N120 G3 X20 Y40 I0 J-5', 'N130 G1 Y20', 'N140 G3 X25 Y15 I5 J0', 'N150 G0 Z50', 'N160 M5 M9', 'N170 M30') }
  ];

  /* ============================================================ Aufgaben */
  const choice = (choices, correct) => ({ type: 'choice', choices, correct });
  const nums = (...f) => ({ type: 'num', fields: f.map(x => ({ label: x[0], unit: x[1] || 'mm' })) });
  const tasks = [];
  const add = o => { o.setup = Object.assign({ machine: o.machine }, o.setup || {}); tasks.push(o); };

  /* ---------- G-Code lesen ---------- */
  const P1 = L('(KONTUR 1)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2000', 'N40 G0 X10 Y10 Z5', 'N50 G1 Z-2 F150', 'N60 G1 X50 F300', 'N70 G1 Y30', 'N80 G0 Z50', 'N90 M5', 'N100 M30');
  add({ id: 'cnc1', cat: 'G-Code lesen', level: 1, title: 'Position nach Satz N70', machine: 'mill', prog: P1, progMode: 'show',
    text: 'Lies das Programm. Beim Fräsen liegt Z0 auf der Oberseite des Rohteils. Wo steht die Werkzeugspitze, nachdem Satz N70 ausgeführt wurde?',
    ask: nums(['X'], ['Y'], ['Z']), solve: Cc => ({ values: posAfter(Cc.run(P1, { machine: 'mill' }), 70), tol: 0.01 }), bad: [[50, 10, -2]],
    expl: 'N40 fährt im Eilgang auf X10 Y10 Z5. N50 taucht mit Vorschub auf Z-2 ein. N60 fährt auf X50, N70 auf Y30. X, Y und Z bleiben stehen, wenn sie nicht neu programmiert werden (modal). Ergebnis: X50 Y30 Z-2.',
    tips: ['Gehe Satz für Satz durch und schreibe dir nach jedem Satz X, Y und Z auf.', 'Achsen, die in einem Satz nicht stehen, behalten ihren letzten Wert.'] });
  const P2 = L('N40 G0 X10 Y10 Z5', 'N50 G1 Z-2 F150', 'N60 G1 X50 F300');
  add({ id: 'cnc2', cat: 'G-Code lesen', level: 1, title: 'Was bedeutet G0?', machine: 'mill', prog: P2, progMode: 'show',
    text: 'Im Satz N40 steht G0. Was macht die Steuerung?',
    ask: choice(['Eilgang: Das Werkzeug fährt ohne zu zerspanen auf geradem Weg zum Ziel.', 'Das Werkzeug fährt eine gerade Bahn mit Arbeitsvorschub F.', 'Das Werkzeug fährt einen Kreisbogen im Uhrzeigersinn.', 'Die Spindel wird eingeschaltet.'], 0), solve: () => ({ correct: 0 }), bad: [1],
    expl: 'G0 ist der Eilgang (Positionieren). Er ist nur für freie Wege gedacht, nie im Material. Die Bearbeitung mit Vorschub steht unter G1 (gerade) oder G2/G3 (Kreis). Die Spindel schaltet M3 ein.',
    tips: ['Die Null in G0 steht für „keine Bearbeitung“.', 'Vergleiche mit N50: Dort steht G1 und ein Vorschub F.'] });
  const P3 = L('(WELLE)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000', 'N40 G0 X40 Z2', 'N50 G1 Z-10 F0.2', 'N60 G91 G1 X-10 Z-5', 'N70 G1 Z-15', 'N80 G90 G1 X40', 'N90 G0 X100 Z50', 'N100 M5', 'N110 M30');
  add({ id: 'cnc3', cat: 'G-Code lesen', level: 2, title: 'Kettenmaß beim Drehen', machine: 'turn', prog: P3, progMode: 'show',
    text: 'Beim Drehen ist X der Durchmesser. Wo steht das Werkzeug nach Satz N70? Gib X als Durchmesser und Z an.',
    ask: nums(['X (Durchmesser)'], ['Z']), solve: Cc => { const p = posAfter(Cc.run(P3, { machine: 'turn' }), 70); return { values: [p[0], p[2]], tol: 0.01 }; }, bad: [[35, -30], [30, -25]],
    expl: 'N50 fährt auf Z-10 (X40 bleibt). N60 ist inkremental (G91): X-10 ändert den Durchmesser um 10 mm (also 5 mm Radius) auf X30, Z-5 gibt Z-15. N70 fährt noch 15 mm weiter: Z-30. Ergebnis: X30, Z-30.',
    tips: ['Merke dir den Schaltzustand: Ab N60 gilt G91 (Kettenmaß), die Werte sind Wege.', 'X-10 im Kettenmaß ändert den Durchmesser um 10 mm, weil X ein Durchmesser ist.'] });
  const P4 = L('(BOGEN)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500', 'N40 G0 X0 Y20 Z2', 'N50 G1 Z-1 F100', 'N60 G1 X20 F300', 'N70 G3 X30 Y30 I0 J10', 'N80 G1 X50', 'N90 G0 Z50', 'N100 M5', 'N110 M30');
  add({ id: 'cnc4', cat: 'G-Code lesen', level: 2, title: 'Kreismittelpunkt mit I und J', machine: 'mill', prog: P4, progMode: 'show',
    text: 'Im Satz N70 steht ein Kreisbogen mit I0 J10. Wo liegt der Kreismittelpunkt in absoluten Koordinaten?',
    ask: nums(['Mittelpunkt X'], ['Mittelpunkt Y']), solve: Cc => { const r = Cc.run(P4, { machine: 'mill' }), m = r.moves.find(x => x.g === 3); return { values: [m.arc.center.x, m.arc.center.y], tol: 0.01 }; }, bad: [[0, 10], [30, 30]],
    expl: 'I und J sind Abstände vom STARTPUNKT des Bogens zum Mittelpunkt (nicht vom Nullpunkt). Der Bogen startet bei X20 Y20 (Ende von N60). Mittelpunkt: X20+0 = 20, Y20+10 = 30. Probe: Abstand zum Endpunkt X30 Y30 ist 10, gleich dem Radius.',
    tips: ['Wo steht das Werkzeug zu Beginn von N70? Das ist der Startpunkt des Bogens.', 'Addiere I zur X-Position und J zur Y-Position des Startpunkts.'] });
  const P5 = L('N50 G1 Z-1 F100', 'N60 G1 X20 F300', 'N70 G3 X30 Y20 R-10');
  /* PRUEFEN: negatives R = Bogen größer als 180 Grad (Vorzeichenregel DIN-naher Steuerungen, Hersteller können abweichen) */
  add({ id: 'cnc5', cat: 'G-Code lesen', level: 3, title: 'Negatives R beim Kreis', machine: 'mill', prog: P5, progMode: 'show',
    text: 'Im Satz N70 steht ein Kreisbogen mit R-10. Was bedeutet das negative Vorzeichen?',
    ask: choice(['Der Bogen ist größer als ein Halbkreis (mehr als 180°).', 'Der Bogen läuft im Uhrzeigersinn.', 'Das Werkzeug fährt rückwärts.', 'Die Steuerung meldet einen Fehler, denn R darf nicht negativ sein.'], 0), solve: () => ({ correct: 0 }), bad: [3],
    expl: 'Bei der Radiusangabe gibt es zu Start- und Endpunkt zwei Kreise, die passen. Positives R wählt den kleinen Bogen (höchstens 180°), negatives R den großen Bogen (mehr als 180°). Die Drehrichtung bestimmt allein G2 oder G3.',
    tips: ['Die Drehrichtung steckt schon in G3. Das Vorzeichen muss etwas anderes regeln.', 'Zwischen zwei Punkten gibt es bei gegebenem Radius einen kurzen und einen langen Bogen.'] });
  const P6 = L('(STUFENWELLE)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000', 'N40 G0 X20 Z2', 'N50 G1 Z-15 F0.2', 'N60 G1 X30', 'N70 G1 Z-30', 'N80 G0 X100 Z50', 'N90 M5', 'N100 M30');
  add({ id: 'cnc6', cat: 'G-Code lesen', level: 2, title: 'Durchmesser nach dem Lauf', machine: 'turn', prog: P6, progMode: 'show',
    text: 'Das Rohteil ist ein Zylinder Ø40. Das Programm läuft komplett durch. Welchen Durchmesser hat das Werkstück danach bei Z-10 und bei Z-25?',
    ask: nums(['Durchmesser bei Z-10'], ['Durchmesser bei Z-25']), solve: Cc => { const r = Cc.run(P6, { machine: 'turn' }); return { values: [r.stock.diaAt(-10), r.stock.diaAt(-25)], tol: 0.1 }; }, bad: [[40, 40], [30, 20]],
    expl: 'N50 dreht von Z2 bis Z-15 auf Ø20 (X20). N60 fährt bei Z-15 auf Ø30, N70 dreht Ø30 bis Z-30. Bei Z-10 steht also Ø20, bei Z-25 Ø30. Der Rest bei Z kleiner als -30 bleibt Ø40.',
    tips: ['Zeichne dir die Kontur: Wohin fährt das Werkzeug mit G1?', 'Bis Z-15 gilt der erste Durchmesser, danach der zweite bis Z-30.'] });
  /* PRUEFEN: G41 = Werkzeug links der Kontur = Gleichlauf bei M3 (Außen- und Innenkontur, Standard-Spindelrichtung) */
  add({ id: 'cnc7', cat: 'G-Code lesen', level: 2, title: 'Radiuskorrektur wählen', machine: 'mill', progMode: 'none',
    text: 'Du fräst eine Kontur im Gleichlauf bei Spindeldrehrichtung M3. Das Werkzeug soll in Vorschubrichtung links von der Kontur laufen. Welchen Befehl schaltest du vor dem Anfahren ein?',
    ask: choice(['G40', 'G41', 'G42', 'G17'], 1), solve: () => ({ correct: 1 }), bad: [2],
    expl: 'G41 schaltet die Werkzeugradiuskorrektur links der Kontur ein (in Vorschubrichtung gesehen), bei M3 ergibt das Gleichlauf. G42 ist rechts, G40 schaltet die Korrektur aus, G17 wählt nur die Ebene. In diesem Lab wird die Korrektur nur erklärt, die Simulation fährt die programmierte Bahn.',
    tips: ['Links und rechts gelten in Vorschubrichtung gesehen.', 'Es gibt G41 für links und G42 für rechts. G40 schaltet aus.'] });
  /* Neue Aufgaben (cnc30 bis cnc38): stehen in ihrer Kategorie, die Nummern setzen die Liste fort */
  const P30 = L('N80 G0 Z50', 'N90 M5 M9', 'N100 M30');
  add({ id: 'cnc30', cat: 'G-Code lesen', level: 1, title: 'Was bedeutet M30?', machine: 'mill', prog: P30, progMode: 'show',
    text: 'Im letzten Satz steht M30. Was bewirkt dieser Befehl?',
    ask: choice(['Das Kühlmittel wird ausgeschaltet, die Spindel läuft aber weiter.', 'Das Werkzeug mit der Nummer 30 wird in die Spindel eingewechselt.', 'Das Programm ist beendet, die Steuerung springt zum Anfang zurück.', 'Die Spindel wird mit einer Drehzahl von 30 Umdrehungen pro Minute eingeschaltet.'], 2), solve: () => ({ correct: 2 }), bad: [1],
    expl: 'M30 ist das Programmende mit Rücksprung auf den Programmanfang. Die Spindel und das Kühlmittel schaltest du vorher aus (M5 und M9, wie im Satz davor). Ein Werkzeug wird mit T und M6 gewechselt, die Spindel läuft mit M3 und einer Drehzahl S.',
    tips: ['Mit M-Befehlen werden Schaltfunktionen der Maschine gesteuert. Schau dir die Sätze davor an: Was ist dort schon abgeschaltet?', 'Am Ende eines Programms muss die Steuerung wissen, dass nichts mehr folgt.'] });
  /* PRUEFEN: U und W als inkrementale X/Z-Adressen beim Drehen (Schreibweise Typ A, z. B. Fanuc-nah); andere Steuerungen (z. B. Siemens) nutzen dafür G91 oder IC. Passt das zum Unterricht? */
  const P31 = L('(WELLE MIT U UND W)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000', 'N40 G0 X30 Z2', 'N50 G1 Z-10 F0.2', 'N60 G1 U6 W-4', 'N70 G1 W-16', 'N80 G0 X100 Z50', 'N90 M5', 'N100 M30');
  add({ id: 'cnc31', cat: 'G-Code lesen', level: 3, title: 'Position mit U und W', machine: 'turn', prog: P31, progMode: 'show',
    text: 'In diesem Drehprogramm stehen die Adressen U und W. Das Programm ist insgesamt im Maßsystem G90 geschrieben. Wo steht das Werkzeug nach Satz N70? Gib X als Durchmesser und Z an.',
    ask: nums(['X (Durchmesser)'], ['Z']), solve: Cc => { const p = posAfter(Cc.run(P31, { machine: 'turn' }), 70); return { values: [p[0], p[2]], tol: 0.01 }; }, bad: [[33, -30], [36, -26]],
    expl: 'U und W sind beim Drehen inkrementale Werte (Wege), egal ob G90 oder G91 gilt: U ist die Änderung des Durchmessers, W die Änderung in Z. N50 fährt auf X30 Z-10. N60: U6 macht den Durchmesser 36 (nicht 33), W-4 gibt Z-14. N70: W-16 fährt weitere 16 mm: Z-30. Ergebnis: X36 Z-30.',
    tips: ['U gehört zu X, W gehört zu Z. Es sind Wege, keine Zielpunkte.', 'X ist ein Durchmesser: Rechne die Änderung U auf den Durchmesser auf, nicht auf den Radius.'] });

  /* Neue Aufgaben cnc39 bis cnc48 (Industriemechaniker: CNC-Fertigung): stehen in ihrer Kategorie, die Nummern setzen die Liste fort. PRUEFEN Pn: quelle/cnc/PRUEFEN.md */
  const P39 = L('(WERKZEUG 2)', 'N10 G54 G90 G94 G17', 'N20 T2 M6', 'N30 M3 S2500 M8', 'N40 G0 X20 Y20 Z5', 'N50 G1 Z-2 F120', 'N60 G1 X60 F300', 'N70 G0 Z50', 'N80 M5 M9', 'N90 M30');
  add({ id: 'cnc39', cat: 'G-Code lesen', level: 1, title: 'Die Adressen S, F und T', machine: 'mill', prog: P39, progMode: 'show',
    text: 'In diesem Fräsprogramm stehen die Adressen S, F und T mit Zahlenwerten (S2500, F300 und T2). Welche Zuordnung stimmt?',
    ask: choice(['S ist der Vorschub, F die Spindeldrehzahl und T die Zeit in Sekunden', 'S ist die Schnitttiefe, F die Länge des Fräsers und T die Nummer des Teils', 'S ist die Drehzahl der Spindel, F der Vorschub und T die Nummer des Werkzeugs', 'S ist die Spindelrichtung, F die Kühlmittelmenge und T die Dauer des Programms'], 2), solve: () => ({ correct: 2 }), bad: [0],
    expl: 'S gibt die Spindeldrehzahl an (S2500 = 2500 1/min), F den Vorschub (beim Fräsen in mm/min, F300 = 300 mm/min) und T die Nummer des Werkzeugs im Magazin (T2 = Werkzeug 2). Eingewechselt wird es mit M6.',
    tips: ['Die Buchstaben sind Abkürzungen: Spindel, Feed (englisch für Vorschub), Tool.', 'Schau dir an, in welchen Sätzen die Buchstaben stehen: S neben dem Einschalten der Spindel, F neben einer Fahrbewegung.'] });
  const P40 = L('(WERKZEUGWECHSEL)', 'N10 G54 G90 G94 G17', 'N20 T3 M6', 'N30 M3 S1800 M8', 'N40 G0 X10 Y10 Z5', 'N50 G1 Z-2 F100', 'N60 G1 X50 F250', 'N70 G0 Z50', 'N80 M5 M9', 'N90 M30');
  /* PRUEFEN: Spindelstillstand beim Werkzeugwechsel ist bei den meisten Fräsmaschinen üblich; Details (automatisches M5 vor M6) hängen von der Maschine ab. */
  add({ id: 'cnc40', cat: 'G-Code lesen', level: 2, title: 'Reihenfolge beim Werkzeugwechsel', machine: 'mill', prog: P40, progMode: 'show',
    text: 'Im Programm steht der Werkzeugwechsel T3 M6 vor dem Einschalten der Spindel mit M3 S1800. Warum ist diese Reihenfolge sinnvoll?',
    ask: choice(['Die Steuerung kann M6 nur ausführen, wenn M3 im selben Satz steht', 'Das Werkzeug wird nur bei laufender Spindel in die Aufnahme gezogen', 'Die Reihenfolge der Sätze ist beliebig, die Steuerung sortiert sie von selbst', 'Die Spindel soll beim Wechsel stillstehen, erst mit dem neuen Werkzeug läuft sie an'], 3), solve: () => ({ correct: 3 }), bad: [0],
    expl: 'Beim Werkzeugwechsel muss die Spindel stillstehen, sonst kann das Werkzeug nicht sicher gespannt werden und es besteht Verletzungs- und Crashgefahr. Deshalb wird erst gewechselt (T3 M6) und dann die Spindel mit der passenden Drehzahl eingeschaltet (M3 S1800). Die Reihenfolge der Sätze bestimmt den Ablauf: Die Steuerung führt sie genau so aus.',
    tips: ['Wann kann ein Werkzeug sicher aus der Spindel genommen und eingesetzt werden: wenn sie dreht oder wenn sie steht?', 'Die Steuerung arbeitet die Sätze in der geschriebenen Reihenfolge ab.'] });
  /* PRUEFEN: Unterprogrammaufruf und Schreibweise hängen von der Steuerung ab (z. B. M98, L oder Programmname); die Simulation dieses Labs kennt keine Unterprogramme, deshalb nur als Textaufgabe. */
  add({ id: 'cnc41', cat: 'G-Code lesen', level: 2, title: 'Wozu ein Unterprogramm?', machine: 'mill', progMode: 'none',
    text: 'Auf einer Platte sollen fünf gleiche Taschen gefräst werden. Du schreibst die Bearbeitung einer Tasche einmal als Unterprogramm und rufst sie fünfmal auf. Was ist der Vorteil?',
    ask: choice(['Die Maschine fährt schneller, weil Unterprogramme grundsätzlich im Eilgang laufen', 'Die Taschen werden genauer, weil die Steuerung Unterprogramme besonders prüft', 'Das Programm wird kürzer, und eine Änderung an der Tasche muss nur einmal erfolgen', 'Im Hauptprogramm ist dann kein Werkstücknullpunkt (G54) mehr nötig'], 2), solve: () => ({ correct: 2 }), bad: [0],
    expl: 'Ein Unterprogramm enthält eine Bearbeitung, die mehrfach vorkommt. Man schreibt sie einmal und ruft sie so oft auf, wie sie gebraucht wird, meist mit einer verschobenen Position. Das Programm wird kürzer und übersichtlicher, und eine Änderung muss nur an einer Stelle gemacht werden. Auf Geschwindigkeit und Genauigkeit hat es keinen Einfluss.',
    tips: ['Überlege, was du bei fünf gleichen Taschen sonst fünfmal abschreiben müsstest.', 'Was passiert, wenn sich die Tiefe der Taschen ändert: an wie vielen Stellen musst du sie im Programm anpassen?'] });
  /* PRUEFEN: G83 = Tieflochbohrzyklus (Spanbrechen/Entspanen) in DIN-nahen Steuerungen; Schreibweise und Parameter hängen von der Steuerung ab. Die Simulation kennt nur G81. */
  add({ id: 'cnc42', cat: 'G-Code lesen', level: 2, title: 'Tiefes Loch bohren', machine: 'mill', progMode: 'none',
    text: 'Ein Loch Ø6 mm soll 36 mm tief gebohrt werden, das ist das Sechsfache des Durchmessers. Der einfache Bohrzyklus G81 bohrt in einem Zug bis zur Tiefe. Welcher Zyklus ist hier besser geeignet?',
    ask: choice(['G80, weil er den Bohrzyklus einschaltet und die Späne gleich beim Bohren löst', 'Ein Tieflochbohrzyklus wie G83, der in Stufen bohrt und die Späne dazwischen entfernt', 'G0, weil im Eilgang weniger Wärme entsteht und die Späne herausfliegen', 'Ein Gewindezyklus, weil er die Späne beim Bohren zerkleinert und herausdrückt'], 1), solve: () => ({ correct: 1 }), bad: [0],
    expl: 'Bei tiefen Bohrungen können die Späne den Bohrer verklemmen, und der Kühlschmierstoff erreicht die Schneide nicht mehr. Ein Tieflochbohrzyklus (zum Beispiel G83) bohrt in mehreren Stufen, zieht dazwischen heraus, entfernt die Späne und bricht sie dabei. G80 schaltet einen Zyklus nur aus, G0 ist der Eilgang.',
    tips: ['Wohin sollen die Späne aus einem tiefen Loch gelangen?', 'Es gibt Zyklen, bei denen der Bohrer zwischendurch zurückzieht.'] });
  add({ id: 'cnc48', cat: 'G-Code lesen', level: 1, title: 'Sicherheit beim ersten Programmlauf', machine: 'mill', progMode: 'none',
    text: 'Du fährst ein neues Programm zum ersten Mal an der Maschine ab. Welche Vorgehensweise ist sinnvoll?',
    ask: choice(['Sofort im Automatikbetrieb bei vollem Vorschub und vollem Eilgang starten, damit Fehler gleich auffallen', 'Die Schutztür einen Spalt offen lassen, damit man das Werkstück besser sehen kann', 'Die Verriegelung der Tür vorher überbrücken, damit die Maschine nicht unnötig stoppt', 'Einzelsatzbetrieb, Vorschub und Eilgang am Regler verringern, Restweg beobachten und die Hand am Not-Halt lassen'], 3), solve: () => ({ correct: 3 }), bad: [0],
    expl: 'Beim ersten Lauf kann noch jeder Fehler im Programm stecken. Im Einzelsatz mit verringertem Vorschub und Eilgang läuft die Maschine langsam, du erkennst Fehler früh und kannst anhalten. Der Restweg zeigt, wie weit das Werkzeug noch fahren will. Die Schutztür bleibt geschlossen, Verriegelungen werden nie überbrückt.',
    tips: ['Was ist besser: ein Fehler bei langsamer oder bei voller Geschwindigkeit?', 'Sicherheitseinrichtungen wie Schutztür und Not-Halt dürfen nie umgangen werden.'] });

  /* ---------- Koordinaten ---------- */
  const WELLE = { kind: 'turn', dim: 'd', pts: [[20, 0], [20, -15], [30, -15], [30, -35], [40, -35], [40, -50]] };
  const WELLER = { kind: 'turn', dim: 'r', pts: [[24, 0], [24, -10], [34, -10], [34, -35], [40, -35], [40, -50]] };
  const RECHT = (zero) => ({ kind: 'mill', W: 80, H: 60, zero, pts: [[15, 10], [65, 10], [65, 40], [15, 40]] });
  add({ id: 'cnc8', cat: 'Koordinaten', level: 1, title: 'Punkt der Welle absolut (G90)', machine: 'turn', fig: WELLE,
    text: 'Der Werkstücknullpunkt liegt auf der Planfläche (rechte Stirnseite) in der Drehachse. X wird als Durchmesser programmiert. Gib die Koordinaten von P4 absolut (G90) an.',
    ask: nums(['X (Durchmesser)'], ['Z']), solve: () => ({ values: [30, -35], tol: 0.01 }), bad: [[15, -35], [30, 35]],
    expl: 'P4 liegt am Ende des Ø30-Abschnitts. Er ist 15 + 20 = 35 mm von der Planfläche entfernt. Z zeigt zum Material, also negativ: Z-35. X ist der Durchmesser: X30.',
    tips: ['Wie weit ist P4 von der Planfläche entfernt? Addiere die Längen.', 'Z ist negativ, wenn du von der Planfläche ins Werkstück gehst. X ist der Durchmesser.'] });
  add({ id: 'cnc9', cat: 'Koordinaten', level: 2, title: 'Von P2 nach P4 im Kettenmaß', machine: 'turn', fig: WELLE,
    text: 'Das Werkzeug steht auf P2. Du fährst mit G91 (Kettenmaß) in einem Satz geradlinig nach P4. Welche Werte stehen im Satz? X ist die Änderung des Durchmessers.',
    ask: nums(['X (Durchmesseränderung)'], ['Z']), solve: () => ({ values: [10, -20], tol: 0.01 }), bad: [[5, -20], [30, -35]],
    expl: 'P2 hat Ø20 bei Z-15, P4 hat Ø30 bei Z-35. Durchmesser: 30 - 20 = +10, also X10 (nicht 5, denn X ist ein Durchmesser). Z: -35 - (-15) = -20. Satz: G91 G1 X10 Z-20.',
    tips: ['Kettenmaß heißt: Ziel minus Start, für jede Achse.', 'X ist der Durchmesser, rechne also mit den Durchmessern, nicht mit den Radien.'] });
  add({ id: 'cnc10', cat: 'Koordinaten', level: 2, title: 'Radiusmaße in X umrechnen', machine: 'turn', fig: WELLER,
    text: 'In der Zeichnung sind die Absätze mit RADIUS bemaßt. Gib die Koordinaten von P3 absolut (G90) an. X wird als Durchmesser programmiert, der Nullpunkt liegt auf der Planfläche.',
    ask: nums(['X (Durchmesser)'], ['Z']), solve: () => ({ values: [34, -10], tol: 0.01 }), bad: [[17, -10], [34, 10]],
    expl: 'P3 liegt am Radius 17 mm, bei 10 mm von der Planfläche. In X muss der DURCHMESSER stehen: 2 · 17 = 34. Z ist negativ: -10. Ergebnis: X34 Z-10.',
    tips: ['Welchen Radius hat P3? Das Maß steht in der Zeichnung.', 'X braucht den Durchmesser, also das Doppelte des Radius.'] });
  add({ id: 'cnc11', cat: 'Koordinaten', level: 1, title: 'Rechteckecke, Nullpunkt links unten', machine: 'mill', fig: RECHT('corner'),
    text: 'Der Werkstücknullpunkt liegt in der linken unteren Ecke des Rohteils. Gib die Koordinaten der Ecke P3 absolut (G90) an.',
    ask: nums(['X'], ['Y']), solve: () => ({ values: [65, 40], tol: 0.01 }), bad: [[40, 65], [15, 40]],
    expl: 'Der Nullpunkt liegt in der Ecke, die Maße aus der Zeichnung sind deshalb schon die Koordinaten: P3 ist 65 mm von links und 40 mm von unten entfernt: X65 Y40.',
    tips: ['Lies die Maße von P3 aus der Zeichnung: von links und von unten.', 'Liegt der Nullpunkt in der Ecke, sind Maße und Koordinaten gleich.'] });
  add({ id: 'cnc12', cat: 'Koordinaten', level: 2, title: 'Nullpunkt in der Rohteilmitte', machine: 'mill', fig: RECHT('center'),
    text: 'Der Werkstücknullpunkt liegt jetzt in der MITTE des Rohteils (80 × 60). Gib die Koordinaten der Ecke P1 absolut (G90) an. Vorsicht bei den Vorzeichen.',
    ask: nums(['X'], ['Y']), solve: () => ({ values: [-25, -20], tol: 0.01 }), bad: [[15, 10], [25, 20]],
    expl: 'Die Mitte des Rohteils liegt bei 40 von links und 30 von unten. P1 ist 15 von links und 10 von unten. Also X = 15 - 40 = -25 und Y = 10 - 30 = -20. Links und unterhalb des Nullpunkts sind die Werte negativ.',
    tips: ['Wo liegt die Mitte, gemessen von der linken unteren Ecke?', 'Rechne Maß minus Mitte. Links vom Nullpunkt ist X negativ, darunter ist Y negativ.'] });
  add({ id: 'cnc13', cat: 'Koordinaten', level: 3, title: 'Abkürzung im Kettenmaß', machine: 'mill', fig: { kind: 'mill', W: 80, H: 60, zero: 'center', pts: [[10, 10], [70, 10], [70, 30], [40, 30], [40, 50], [10, 50]] },
    text: 'Das Werkzeug steht auf P4. Du fährst mit G91 (Kettenmaß) in einem Satz direkt geradlinig nach P6. Welche Werte stehen im Satz? (Die Lage des Nullpunkts spielt keine Rolle.)',
    ask: nums(['X'], ['Y']), solve: () => ({ values: [-30, 20], tol: 0.01 }), bad: [[30, -20], [10, 50]],
    expl: 'P4 liegt bei 40/30, P6 bei 10/50 (Maße von links unten). Kettenmaß ist Ziel minus Start: X = 10 - 40 = -30, Y = 50 - 30 = +20. Im Kettenmaß fällt der Nullpunkt heraus. Satz: G91 G1 X-30 Y20.',
    tips: ['Im Kettenmaß zählt nur der Unterschied zwischen Start und Ziel.', 'Ziel minus Start: erst für X, dann für Y. Beachte die Vorzeichen.'] });
  add({ id: 'cnc32', cat: 'Koordinaten', level: 3, title: 'Nullpunkt in der rechten oberen Ecke', machine: 'mill', fig: RECHT('tr'),
    text: 'Der Werkstücknullpunkt liegt in der rechten oberen Ecke des Rohteils (80 × 60). Gib die Koordinaten der Ecke P4 absolut (G90) an. Vorsicht bei den Vorzeichen.',
    ask: nums(['X'], ['Y']), solve: () => ({ values: [-65, -20], tol: 0.01 }), bad: [[15, 40], [65, 20]],
    expl: 'P4 liegt 15 mm von links und 40 mm von unten. Die rechte obere Ecke des Rohteils liegt bei 80 von links und 60 von unten. Also X = 15 - 80 = -65 und Y = 40 - 60 = -20. Alles, was links oder unterhalb des Nullpunkts liegt, hat negative Werte.',
    tips: ['Wo liegt der Nullpunkt, gemessen von der linken unteren Ecke? Das sind die Rohteilmaße.', 'Rechne Maß minus Nullpunktlage, getrennt für X und Y.'] });

  add({ id: 'cnc43', cat: 'Koordinaten', level: 3, title: 'Bahn der Werkzeugmitte', machine: 'mill', progMode: 'none',
    text: 'Du fräst die Außenkontur eines Rechtecks 60 × 40 mm mit einem Fräser Ø10, ohne Radiuskorrektur. Du programmierst deshalb die Bahn der Werkzeugmitte als Rechteck mit scharfen Ecken, das überall um den Fräserradius größer ist als die Kontur. Wie lang ist diese Bahn der Werkzeugmitte einmal ringsherum?',
    ask: nums(['Weg der Werkzeugmitte', 'mm']), solve: () => ({ values: [2 * ((60 + 10) + (40 + 10))], tol: 0.5 }), bad: [[200], [220]],
    expl: 'Die Werkzeugmitte läuft im Abstand des Fräserradius (5 mm) außen an der Kontur entlang. Das Rechteck der Mittenbahn ist deshalb auf jeder Seite 5 mm größer: 60 + 10 = 70 mm und 40 + 10 = 50 mm. Umfang: 2 · (70 + 50) = 240 mm. Mit Radiuskorrektur G41/G42 rechnet die Steuerung diese Bahn selbst aus, und du programmierst die Kontur direkt.',
    tips: ['Um wie viel ist die Bahn der Werkzeugmitte links und rechts größer als das Werkstück?', 'Pro Richtung kommt zweimal der Fräserradius dazu, also der Fräserdurchmesser.'] });
  add({ id: 'cnc44', cat: 'Koordinaten', level: 1, title: 'Maschinen- und Werkstücknullpunkt', machine: 'mill', progMode: 'none',
    text: 'Die Steuerung kennt einen Maschinennullpunkt M und einen Werkstücknullpunkt W. Welche Aussage stimmt?',
    ask: choice(['Beide Nullpunkte sind immer identisch und liegen in der Spindel', 'Der Maschinennullpunkt ist vom Hersteller fest vorgegeben, den Werkstücknullpunkt legst du für das Werkstück fest', 'Der Werkstücknullpunkt ist fest in der Maschine, der Maschinennullpunkt wird auf dem Werkstück gesetzt', 'Beim Fräsen gilt allein der Maschinennullpunkt, W wird nur beim Drehen verwendet'], 1), solve: () => ({ correct: 1 }), bad: [0],
    expl: 'Der Maschinennullpunkt liegt fest in der Maschine, die Position legt der Hersteller fest. Den Werkstücknullpunkt wählst du je Werkstück so, dass die Maße der Zeichnung direkt als Koordinaten verwendbar sind. Mit G54 wird er im Programm aktiviert. Er wird sowohl beim Fräsen als auch beim Drehen gebraucht.',
    tips: ['Ein Werkstück wird an verschiedenen Stellen im Maschinenraum gespannt. Welcher Nullpunkt muss sich deshalb anpassen lassen?', 'Der Befehl G54 aktiviert eine Nullpunktverschiebung für das Werkstück.'] });

  /* ---------- Programm ergänzen ---------- */
  const NUT = a => L('(RECHTECKNUT)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500 M8', 'N40 G0 X20 Y10', 'N50 G0 Z2', 'N60 G1 Z-2 F100', ...a, 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  const NUTREF = NUT(['N70 G1 X60 F300', 'N80 Y30', 'N90 X20', 'N100 Y10']);
  add({ id: 'cnc14', cat: 'Programm ergänzen', level: 1, title: 'Rechtecknut fräsen', machine: 'mill', prog: NUT(['(HIER ERGAENZEN)']), progMode: 'edit', ref: NUTREF, target: true,
    text: 'Das Werkzeug steht in P1 (X20 Y10) in 2 mm Tiefe. Ergänze die Zeilen so, dass die Nut als Rechteck gefräst wird: P1 → P2 (X60 Y10) → P3 (X60 Y30) → P4 (X20 Y30) → zurück zu P1. Vorschub 300 mm/min.',
    ask: { type: 'prog' }, bad: [NUT(['N70 G1 X60 F300', 'N80 Y30', 'N90 X20'])],
    expl: 'Vier Sätze mit G1: N70 G1 X60 F300 (G1 und F sind modal, danach genügt die neue Koordinate), N80 Y30, N90 X20, N100 Y10. Wird der letzte Satz vergessen, bleibt die Nut offen.',
    tips: ['G1 bleibt aktiv, du musst es nicht jedes Mal schreiben. Der Vorschub F gilt weiter.', 'Fahre die vier Ecken nacheinander an und achte darauf, wieder auf P1 zu kommen.'] });
  const PL = a => L('(PLANDREHEN UND LAENGSDREHEN)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1200 M8', 'N40 G0 X42 Z0', ...a, 'N100 G0 X100 Z50', 'N110 M5 M9', 'N120 M30');
  const PLREF = PL(['N50 G1 X-1 F0.15', 'N60 G0 X42 Z2', 'N70 G0 X30', 'N80 G1 Z-30 F0.25', 'N90 G0 X42']);
  add({ id: 'cnc15', cat: 'Programm ergänzen', level: 2, title: 'Plandrehen und Längsdrehen', machine: 'turn', prog: PL(['(HIER ERGAENZEN)']), progMode: 'edit', ref: PLREF, target: true, cmp: { pathTol: 0.3 },
    text: 'Das Werkzeug steht bei X42 Z0. Ergänze: 1. Plandrehen mit G1 bis X-1, Vorschub 0,15 mm/U. 2. Mit Eilgang zurück auf X42 Z2. 3. Mit Eilgang auf Ø30 (X30). 4. Längsdrehen bis Z-30 mit 0,25 mm/U. 5. Mit Eilgang wieder auf X42 freifahren.',
    ask: { type: 'prog' }, bad: [PL(['N50 G1 X-1 F0.15', 'N60 G0 X42 Z2', 'N70 G0 X15', 'N80 G1 Z-30 F0.25', 'N90 G0 X42'])],
    expl: 'Plandrehen: G1 X-1 F0.15 (die Spitze fährt in der Stirnfläche zur Mitte und etwas darüber). Frei fahren G0 X42 Z2. Dann G0 X30 und G1 Z-30 F0.25. Beim Drehen steht in X der Durchmesser: X30 ergibt Ø30. Zum Schluss G0 X42, damit das Werkzeug frei vom Werkstück ist.',
    tips: ['Beim Drehen ist X der Durchmesser. Ø30 bedeutet X30.', 'Reihenfolge: Plandrehen, Eilgang weg, auf Durchmesser fahren, Längsdrehen, freifahren.'] });
  const EC = a => L('(ECKE MIT RADIUS)', 'N10 G54 G90 G94 G17', 'N20 T2 M6', 'N30 M3 S4000 M8', 'N40 G0 X10 Y10', 'N50 G0 Z2', 'N60 G1 Z-2 F80', 'N70 G1 X50 F250', ...a, 'N90 G1 Y40', 'N100 G0 Z50', 'N110 M5 M9', 'N120 M30');
  const ECREF = EC(['N80 G3 X60 Y20 I0 J10']);
  add({ id: 'cnc16', cat: 'Programm ergänzen', level: 2, title: 'Viertelkreis in der Ecke', machine: 'mill', prog: EC(['(HIER ERGAENZEN)']), progMode: 'edit', ref: ECREF, target: true,
    text: 'Die Kontur läuft von P1 (X10 Y10) nach X50 und soll dann mit einem Viertelkreis (Radius 10) gegen den Uhrzeigersinn nach X60 Y20 laufen, bevor sie nach Y40 weitergeht. Schreibe den Kreissatz. Du darfst den Mittelpunkt mit I/J oder den Radius R angeben.',
    ask: { type: 'prog' }, bad: [EC(['N80 G2 X60 Y20 I0 J10'])],
    expl: 'Gegen den Uhrzeigersinn ist G3. Der Bogen startet bei X50 Y10, der Mittelpunkt liegt bei X50 Y20: I0 J10 (Abstände vom Startpunkt). Mit Radius: G3 X60 Y20 R10. Mit G2 würde der Bogen in die Gegenrichtung fast einen Dreiviertelkreis laufen.',
    tips: ['Gegen den Uhrzeigersinn: G3. Im Uhrzeigersinn: G2.', 'Wo liegt der Mittelpunkt, vom Startpunkt (X50 Y10) aus gesehen? Das sind I und J.'] });
  const BB = a => L('(BOHRUNGEN)', 'N10 G54 G90 G94 G17 G40 G80', 'N20 T3 M6', 'N30 M3 S1500 M8', 'N40 G0 Z5', 'N50 G0 X20 Y30', ...a, 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  const BBREF = BB(['N60 G99 G81 X20 Y30 Z-8 R2 F120', 'N70 X40', 'N80 X60', 'N90 G80']);
  add({ id: 'cnc17', cat: 'Programm ergänzen', level: 2, title: 'Drei Bohrungen mit G81', machine: 'mill', prog: BB(['(HIER ERGAENZEN)']), progMode: 'edit', ref: BBREF, target: false, cmp: { path: false },
    text: 'Bohre mit T3 (Ø8) drei Bohrungen bei X20, X40 und X60 (jeweils Y30), 8 mm tief, Vorschub 120 mm/min. Rückzugsebene R2. Du kannst den Bohrzyklus G81 nutzen oder einzeln mit G1 bohren. Am Ende muss der Zyklus abgewählt sein.',
    ask: { type: 'prog' }, bad: [BB(['N60 G99 G81 X20 Y30 Z-8 R2 F120', 'N70 X40', 'N90 G80'])],
    expl: 'G99 G81 X20 Y30 Z-8 R2 F120 bohrt die erste Bohrung. G81 bleibt aktiv: Es genügt X40 und X60 für die weiteren Bohrungen. G80 beendet den Zyklus. Geprüft wird das Ergebnis am Rohteil: drei Bohrungen in der richtigen Tiefe an den richtigen Orten.',
    tips: ['G81 braucht Z (Tiefe), R (Rückzugsebene) und F (Vorschub). Der Zyklus gilt weiter, bis G80 kommt.', 'Nach der ersten Bohrung genügt es, nur die neue X-Position zu schreiben.'] });
  const IK = a => L('(KONTUR IM KETTENMASS)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000 M8', 'N40 G0 X20 Z2', ...a, 'N100 G0 X100 Z50', 'N110 M5 M9', 'N120 M30');
  const IKREF = IK(['N50 G91', 'N60 G1 Z-22 F0.2', 'N70 X10', 'N80 Z-15', 'N90 G90']);
  add({ id: 'cnc18', cat: 'Programm ergänzen', level: 3, title: 'Kontur im Kettenmaß drehen', machine: 'turn', prog: IK(['(HIER ERGAENZEN)']), progMode: 'edit', ref: IKREF, target: true, req: [{ re: /G91/i, msg: 'Benutze G91 (Kettenmaß) für die Kontur.' }],
    text: 'Das Werkzeug steht bei X20 Z2. Schreibe die Kontur mit G91 (Kettenmaß): 22 mm nach links (bis Z-20) mit 0,2 mm/U, dann den Durchmesser um 10 mm vergrößern, dann 15 mm nach links. Danach muss wieder absolut programmiert sein, damit der Freifahrsatz stimmt.',
    ask: { type: 'prog' }, bad: [IK(['N50 G91', 'N60 G1 Z-22 F0.2', 'N70 X5', 'N80 Z-15', 'N90 G90'])],
    expl: 'G91 einschalten, dann G1 Z-22 F0.2, X10 (X ist die Änderung des DURCHMESSERS: 20 auf 30, nicht 5), Z-15. Zum Schluss G90, sonst würde der Satz G0 X100 Z50 als Weg von 100 mm und 50 mm gelesen und das Werkzeug fährt an eine falsche Stelle.',
    tips: ['Kettenmaß einschalten: G91. Die Werte sind Wege, kein Zielpunkt.', 'X10 ändert den Durchmesser um 10 mm. Vergiss G90 am Ende nicht.'] });
  const FA = a => L('(WELLE MIT FASE)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1200 M8', 'N40 G0 X16 Z2', ...a, 'N100 G0 X100 Z50', 'N110 M5 M9', 'N120 M30');
  const FAREF = FA(['N50 G1 Z0 F0.1', 'N60 X20 Z-2', 'N70 Z-25']);
  add({ id: 'cnc33', cat: 'Programm ergänzen', level: 2, title: 'Welle mit Fase drehen', machine: 'turn', prog: FA(['(HIER ERGAENZEN)']), progMode: 'edit', ref: FAREF, target: true,
    text: 'Das Werkzeug steht bei X16 Z2. Drehe eine Welle Ø20 mit einer Fase 2×45° an der Planfläche, 25 mm lang. Ergänze: 1. Auf Z0 fahren (Vorschub 0,1 mm/U). 2. Die Fase bis Ø20 bei Z-2. 3. Längsdrehen bis Z-25. Alle Werte absolut (G90).',
    ask: { type: 'prog' }, bad: [FA(['N50 G1 Z0 F0.1', 'N60 X20 Z-4', 'N70 Z-25'])],
    expl: 'Die Fase beginnt auf der Planfläche bei Ø16: Radius 8 mm, Fase 2 mm in X-Richtung des Radius, also 4 mm im Durchmesser: von X16 auf X20. Bei 45° ist der Weg in Z ebenfalls 2 mm. Sätze: G1 Z0 F0.1, X20 Z-2 (die Fase), Z-25 (Längsdrehen). Beim Drehen ist X der Durchmesser: Eine Fase von 2 mm am Radius verändert X um 4 mm.',
    tips: ['Bei 45° sind die Fasenschenkel gleich lang: 2 mm in Z und 2 mm am Radius.', 'In X steht der Durchmesser. Welchen Durchmesser hat die Welle am Anfang der Fase, welchen danach?'] });
  const B4 = a => L('(BOHRBILD 4 BOHRUNGEN)', 'N10 G54 G90 G94 G17 G40 G80', 'N20 T3 M6', 'N30 M3 S1500 M8', 'N40 G0 Z5', 'N50 G0 X20 Y20', ...a, 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  const B4REF = B4(['N60 G99 G81 X20 Y20 Z-10 R2 F120', 'N70 X60', 'N80 Y40', 'N90 X20', 'N100 G80']);
  add({ id: 'cnc34', cat: 'Programm ergänzen', level: 2, title: 'Vier Bohrungen im Rechteck', machine: 'mill', prog: B4(['(HIER ERGAENZEN)']), progMode: 'edit', ref: B4REF, target: false, cmp: { path: false },
    text: 'Bohre mit T3 (Ø8) vier Bohrungen in den Ecken eines Rechtecks: X20 Y20, X60 Y20, X60 Y40 und X20 Y40. Tiefe 10 mm, Vorschub 120 mm/min, Rückzugsebene R2. Du kannst G81 nutzen oder einzeln mit G1 bohren. Am Ende muss der Zyklus abgewählt sein.',
    ask: { type: 'prog' }, bad: [B4(['N60 G99 G81 X20 Y20 Z-10 R2 F120', 'N70 X60', 'N80 Y40', 'N100 G80'])],
    expl: 'Die erste Bohrung steht im Satz mit G81 (Z-10, R2, F120). Der Zyklus bleibt aktiv: N70 X60 bohrt die zweite Bohrung, N80 Y40 die dritte (X60 bleibt stehen), N90 X20 die vierte. G80 beendet den Zyklus. Geprüft wird das Ergebnis am Rohteil: vier Bohrungen an den richtigen Orten in der richtigen Tiefe.',
    tips: ['Fahre die vier Ecken nacheinander an. Immer nur die Achse schreiben, die sich ändert, der Zyklus gilt weiter.', 'Zähle am Ende nach, ob du vier Positionen programmiert hast, und schalte den Zyklus wieder ab.'] });

  const ST = a => L('(ZAPFEN MIT ABSATZ)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1200 M8', 'N40 G0 X16 Z2', ...a, 'N100 G0 X100 Z50', 'N110 M5 M9', 'N120 M30');
  const STREF = ST(['N50 G1 Z-20 F0.2', 'N60 X26', 'N70 Z-35']);
  add({ id: 'cnc45', cat: 'Programm ergänzen', level: 2, title: 'Zapfen mit Absatz drehen', machine: 'turn', prog: ST(['(HIER ERGAENZEN)']), progMode: 'edit', ref: STREF, target: true,
    text: 'Das Werkzeug steht bei X16 Z2. Drehe einen Zapfen Ø16 bis Z-20 (Vorschub 0,2 mm/U). Danach fährt das Werkzeug bei Z-20 auf Ø26 und dreht diesen Durchmesser bis Z-35. Alle Werte absolut (G90).',
    ask: { type: 'prog' }, bad: [ST(['N50 G1 Z-20 F0.2', 'N60 X13', 'N70 Z-35'])],
    expl: 'Erst die Längsdrehung des Zapfens: G1 Z-20 F0.2 (X16 steht schon). Dann fährt das Werkzeug an der Stufe auf den größeren Durchmesser: X26, danach Z-35. Beim Drehen steht in X der Durchmesser: Ø26 heißt X26, nicht X13 (das wäre der Radius).',
    tips: ['Beim Drehen ist X der Durchmesser. Welche Durchmesser kommen im Programm vor?', 'Reihenfolge: Zapfen längsdrehen, an der Stufe auf den größeren Durchmesser fahren, weiter längsdrehen.'] });

  /* ---------- Fehler im Programm finden (Verdeckte-Fehler-Prinzip: nur das Symptom wird genannt) ---------- */
  add({ id: 'cnc19', cat: 'Fehler im Programm finden', level: 1, title: 'Nut zu kurz', machine: 'mill', prog: NUT(['N70 G1 X50 F300', 'N80 Y30', 'N90 X20', 'N100 Y10']), progMode: 'edit', ref: NUTREF, target: true,
    text: 'Das Programm läuft ohne Alarm, aber die gefräste Nut ist 10 mm kürzer als in der Zeichnung. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [NUT(['N70 G1 X50 F300', 'N80 Y30', 'N90 X20', 'N100 Y10'])],
    expl: 'Im Satz N70 stand X50 statt X60. Alle weiteren Sätze nutzen X nicht neu, deshalb ist die ganze Nut 10 mm zu kurz. Kontrolliere bei solchen Fehlern jede Koordinate mit der Zeichnung.',
    tips: ['Vergleiche die gefahrene Bahn mit der grünen Sollkontur: Wo fängt die Abweichung an?', 'Die Nut ist in X-Richtung zu kurz. Welche Sätze bestimmen die X-Werte?'] });
  const W20 = x => L('(ABSATZ)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000 M8', 'N40 G0 X20 Z2', 'N50 G1 Z-20 F0.2', 'N60 G1 ' + x, 'N70 G1 Z-35', 'N80 G0 X100 Z50', 'N90 M5 M9', 'N100 M30');
  add({ id: 'cnc20', cat: 'Fehler im Programm finden', level: 2, title: 'Der Absatz ist zu dünn', machine: 'turn', prog: W20('X15'), progMode: 'edit', ref: W20('X30'), target: true,
    text: 'Das Werkstück soll hinten (Z-20 bis Z-35) einen Absatz mit Ø30 haben. Der gedrehte Absatz ist aber nur etwa halb so dick wie in der Zeichnung. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [W20('X15')],
    expl: 'In N60 stand X15, der Programmierer hat den RADIUS statt des Durchmessers eingegeben. Beim Drehen steht in X der Durchmesser: Ø30 heißt X30.',
    tips: ['Vergleiche die gedrehte Kontur mit der Sollkontur: Welcher Durchmesser stimmt nicht?', 'Was steht beim Drehen in der Adresse X: Radius oder Durchmesser?'] });
  const VS = x => L('(KONTUR RECHTECK)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500 M8', 'N40 G0 ' + x, 'N50 G0 Z2', 'N60 G1 Z-2 F100', 'N70 G91', 'N80 G1 X40 F300', 'N90 Y20', 'N100 X-40', 'N110 Y-20', 'N120 G90', 'N130 G0 Z50', 'N140 M5 M9', 'N150 M30');
  add({ id: 'cnc21', cat: 'Fehler im Programm finden', level: 2, title: 'Die Kontur ist verschoben', machine: 'mill', prog: VS('X10 Y10'), progMode: 'edit', ref: VS('X20 Y10'), target: true,
    text: 'Das Programm läuft ohne Alarm. Die gefräste Kontur hat die richtige Form und Größe, sitzt aber 10 mm zu weit links. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [VS('X10 Y10')],
    expl: 'Die Kontur ist im Kettenmaß (G91) geschrieben, sie startet dort, wo das Werkzeug steht. Der Startpunkt in N40 war X10 statt X20. Bei Kettenmaß-Konturen verschiebt ein falscher Startpunkt die ganze Kontur.',
    tips: ['Form und Größe stimmen. Was bestimmt dann allein die Lage?', 'Im Kettenmaß beginnt die Kontur am Startpunkt. Schau, wo das Werkzeug vor G91 positioniert wird.'] });
  add({ id: 'cnc22', cat: 'Fehler im Programm finden', level: 2, title: 'Die Ecke ist falsch', machine: 'mill', prog: EC(['N80 G2 X60 Y20 I0 J10']), progMode: 'edit', ref: ECREF, target: true,
    text: 'Das Programm läuft ohne Alarm. Statt einer abgerundeten Ecke bei P2 fährt das Werkzeug fast einen vollen Kreis. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [EC(['N80 G2 X60 Y20 I0 J10'])],
    expl: 'Im Satz N80 stand G2 (Uhrzeigersinn) statt G3. Mit gleichem Mittelpunkt läuft der Bogen dann den langen Weg (270°) um den Mittelpunkt. Die Kontur ist gegen den Uhrzeigersinn, also G3.',
    tips: ['Beobachte die Bahn im Simulator: In welche Richtung läuft der Kreis?', 'Die Kontur läuft gegen den Uhrzeigersinn. Welcher Befehl gehört dazu?'] });
  const EIN = z => L('(NUT)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500 M8', 'N40 G0 X20 Y10', 'N50 G0 Z2', 'N60 ' + z, 'N70 G1 X60 F300', 'N80 Y30', 'N90 X20', 'N100 Y10', 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  add({ id: 'cnc23', cat: 'Fehler im Programm finden', level: 2, title: 'Alarm beim Eintauchen', machine: 'mill', prog: EIN('Z-2 F100'), progMode: 'edit', ref: EIN('G1 Z-2 F100'), target: true,
    text: 'Die Steuerung bricht mit einem Alarm ab, sobald das Werkzeug ins Material eintauchen soll. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [EIN('Z-2 F100')],
    expl: 'In N60 fehlte G1. Davor war G0 aktiv (N50) und bleibt modal wirksam: Z-2 wird deshalb im Eilgang gefahren, der Vorschub F wird ignoriert, und das Werkzeug fährt im Eilgang ins Material. Mit G1 Z-2 F100 taucht es mit Vorschub ein.',
    tips: ['Lies die Alarmmeldung genau: Welche Art Bewegung wird als gefährlich gemeldet?', 'G0 und G1 sind modal. Welcher Befehl war vor dem Satz zuletzt aktiv?'] });
  const SP = s => L('(NUT)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 ' + s, 'N40 G0 X20 Y10', 'N50 G0 Z2', 'N60 G1 Z-2 F100', 'N70 G1 X60 F300', 'N80 Y30', 'N90 X20', 'N100 Y10', 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  add({ id: 'cnc24', cat: 'Fehler im Programm finden', level: 1, title: 'Alarm beim ersten Fräsweg', machine: 'mill', prog: SP('M8'), progMode: 'edit', ref: SP('M3 S2500 M8'), target: true,
    text: 'Die Steuerung bleibt beim ersten Fräsweg mit einem Alarm stehen. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [SP('M8')],
    expl: 'In N30 wurde nur das Kühlmittel eingeschaltet (M8). Es fehlt die Spindel: M3 mit Drehzahl S (zum Beispiel M3 S2500). Ohne drehende Spindel darf nicht gefräst werden.',
    tips: ['Was muss laufen, bevor ein Fräser zerspanen darf?', 'Schau dir den Satz an, in dem die Drehzahl eingestellt wird.'] });
  const G9 = a => L('(WELLE MIT FASE)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000 M8', 'N40 G0 X16 Z2', 'N50 G1 Z0 F0.15', 'N60 G91 G1 X4 Z-2', ...a, 'N80 G1 Z-30 F0.2', 'N90 G0 X42', 'N100 G0 X100 Z50', 'N110 M5 M9', 'N120 M30');
  add({ id: 'cnc25', cat: 'Fehler im Programm finden', level: 3, title: 'Zu lang gedreht', machine: 'turn', prog: G9([]), progMode: 'edit', ref: G9(['N70 G90']), target: true,
    text: 'Das Programm läuft ohne Alarm. Das Werkstück ist aber 2 mm länger gedreht als in der Zeichnung, und am Programmende fährt die Maschine an eine völlig falsche Stelle. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [G9([])],
    expl: 'Für die Fase wurde in N60 auf Kettenmaß (G91) umgeschaltet, aber nie wieder auf G90 zurück. Z-30 in N80 wurde deshalb als Weg gelesen (2 mm Fase plus 30 mm = Z-32), und auch die Freifahrsätze N90/N100 laufen im Kettenmaß. Lösung: Nach der Fase G90 schreiben.',
    tips: ['G90 und G91 sind modal. Welcher Satz schaltet um, und wo wird zurückgeschaltet?', 'Ein Schaltbefehl, der einmal eingeschaltet wurde, bleibt aktiv, bis er überschrieben wird.'] });
  const NT = z => L('(NUT)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500 M8', 'N40 G0 X20 Y10', 'N50 G0 Z2', 'N60 G1 Z' + z + ' F100', 'N70 G1 X60 F300', 'N80 Y30', 'N90 X20', 'N100 Y10', 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  add({ id: 'cnc35', cat: 'Fehler im Programm finden', level: 1, title: 'Die Nut ist zu tief', machine: 'mill', prog: NT('-4'), progMode: 'edit', ref: NT('-2'), target: true,
    text: 'Das Programm läuft ohne Alarm. Die Nut hat die richtige Lage und Länge, ist aber doppelt so tief wie in der Zeichnung. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [NT('-4')],
    expl: 'Die Tiefe wird in dem Satz bestimmt, in dem das Werkzeug mit Vorschub ins Material eintaucht. Dort stand Z-4 statt Z-2. Alle folgenden Sätze fahren auf dieser Z-Höhe weiter, die ganze Nut wird deshalb 4 mm tief. Prüfe bei solchen Fehlern die Z-Werte mit den Maßen der Zeichnung.',
    tips: ['Form und Lage stimmen. Welche Achse bestimmt dann die Tiefe?', 'Suche den Satz, in dem das Werkzeug eintaucht, und lies den Z-Wert.'] });
  const BF = x => L('(DREI BOHRUNGEN)', 'N10 G54 G90 G94 G17 G40 G80', 'N20 T3 M6', 'N30 M3 S1500 M8', 'N40 G0 Z5', 'N50 G0 X20 Y30', 'N60 G99 G81 X20 Y30 Z-8 R2 F120', 'N70 X' + x, 'N80 X60', 'N90 G80', 'N110 G0 Z50', 'N120 M5 M9', 'N130 M30');
  add({ id: 'cnc36', cat: 'Fehler im Programm finden', level: 2, title: 'Die mittlere Bohrung sitzt schief', machine: 'mill', prog: BF('35'), progMode: 'edit', ref: BF('40'), target: true, cmp: { path: false },
    text: 'Das Programm läuft ohne Alarm. Die drei Bohrungen sollen auf einer Linie mit gleichen Abständen liegen. Die mittlere ist aber zu nah an der linken. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [BF('35')],
    expl: 'Die Bohrungen liegen bei X20, X40 und X60 (gleicher Abstand 20 mm). Im zweiten Positionssatz stand X35. Weil der Zyklus G81 modal aktiv bleibt, bohrt jeder neue Positionssatz sofort an der angegebenen Stelle. Kontrolliere bei Lochbildern die Koordinaten jeder Position mit der Zeichnung.',
    tips: ['Vergleiche die Lage der Bohrungen im Simulator mit der Sollzeichnung.', 'Lies die Positionssätze nach dem G81-Satz: Welche X-Werte stehen dort, und stimmen die Abstände?'] });

  const BZ = (z, r) => L('(BOHRUNG)', 'N10 G54 G90 G94 G17 G40 G80', 'N20 T3 M6', 'N30 M3 S1500 M8', 'N40 G0 Z5', 'N50 G0 X30 Y25', 'N60 G99 G81 X30 Y25 Z' + z + ' R' + r + ' F100', 'N70 G80', 'N80 G0 Z50', 'N90 M5 M9', 'N100 M30');
  add({ id: 'cnc46', cat: 'Fehler im Programm finden', level: 2, title: 'Alarm im Bohrzyklus', machine: 'mill', prog: BZ('2', '-8'), progMode: 'edit', ref: BZ('-8', '2'), target: true, cmp: { path: false },
    text: 'Die Steuerung bricht beim Bohren mit einem Alarm ab, bevor die Bohrung entsteht. Die Position der Bohrung stimmt. Finde den Fehler und korrigiere ihn.',
    ask: { type: 'prog' }, bad: [BZ('2', '-8')],
    expl: 'Im Bohrzyklus G81 bedeuten Z die Bohrtiefe und R die Rückzugsebene. Die Rückzugsebene liegt knapp über dem Werkstück (R2), die Bohrtiefe tief im Material (Z-8). Hier waren beide Werte vertauscht: Die Tiefe lag über der Rückzugsebene, und die Steuerung meldet den Alarm.',
    tips: ['Lies die Alarmmeldung genau: Welche beiden Größen werden verglichen?', 'Die Rückzugsebene R liegt über dem Werkstück, die Bohrtiefe Z liegt darunter. Stimmen die Vorzeichen?'] });

  /* ---------- Zeit rechnen ---------- */
  const Z1 = L('(LAENGSDREHEN)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S800', 'N40 G0 X34 Z2', 'N50 G1 Z-40 F0.25', 'N60 G0 X100 Z50', 'N70 M5', 'N80 M30');
  add({ id: 'cnc26', cat: 'Zeit rechnen', level: 1, title: 'Hauptzeit Längsdrehen', machine: 'turn', prog: Z1, progMode: 'show',
    text: 'Berechne die Hauptzeit (nur der Arbeitsgang N50, Eilgang zählt nicht). Es gilt vf = f · n. Der Weg beginnt dort, wo das Werkzeug beim Satz steht.',
    ask: nums(['Hauptzeit th', 'min']), solve: Cc => ({ values: [Cc.run(Z1, { machine: 'turn' }).time.main], tol: 0.006 }), bad: [[0.2], [0.19]],
    expl: 'Das Werkzeug steht bei Z2 und fährt bis Z-40: Weg L = 42 mm. Drehzahl n = 800 1/min, f = 0,25 mm/U, also vf = 0,25 · 800 = 200 mm/min. th = L / vf = 42 / 200 = 0,21 min (12,6 s).',
    tips: ['Berechne zuerst die Vorschubgeschwindigkeit vf = f · n.', 'Der Weg beginnt bei Z2 (Ende von N40) und endet bei Z-40, nicht bei Z0.'] });
  const Z2 = L('(FRAESWEG)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500', 'N40 G0 X10 Y10 Z5', 'N50 G1 Z-3 F100', 'N60 G1 X70 F300', 'N70 G1 Y40', 'N80 G0 Z50', 'N90 M5', 'N100 M30');
  add({ id: 'cnc27', cat: 'Zeit rechnen', level: 2, title: 'Hauptzeit eines Fräswegs', machine: 'mill', prog: Z2, progMode: 'show',
    text: 'Berechne die Hauptzeit aller Arbeitsgänge (G1) in Sekunden. Eilgang zählt nicht zur Hauptzeit. Vorschub in mm/min.',
    ask: nums(['Hauptzeit th', 's']), solve: Cc => ({ values: [Cc.run(Z2, { machine: 'mill' }).time.main * 60], tol: 0.5 }), bad: [[18], [13.8]],
    expl: 'N50: Eintauchen von Z5 auf Z-3 sind 8 mm mit F100: 0,08 min. N60: 60 mm mit F300: 0,2 min. N70: 30 mm mit F300: 0,1 min. Summe 0,38 min = 22,8 s.',
    tips: ['Rechne jeden G1-Satz einzeln: Weg geteilt durch Vorschub gibt die Zeit in Minuten.', 'Das Eintauchen beginnt bei Z5 und zählt mit (8 mm). Umrechnung: 1 min = 60 s.'] });
  const Z3 = L('(FRAESWEG MIT BOGEN)', 'N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2500', 'N40 G0 X10 Y30 Z2', 'N50 G1 Z-2 F100', 'N60 G1 X30 F300', 'N70 G2 X50 Y30 I10 J0', 'N80 G1 X70', 'N90 G0 Z50', 'N100 M5', 'N110 M30');
  add({ id: 'cnc28', cat: 'Zeit rechnen', level: 3, title: 'Hauptzeit mit Halbkreis', machine: 'mill', prog: Z3, progMode: 'show',
    text: 'Berechne die Hauptzeit aller Arbeitsgänge in Sekunden. Der Halbkreis in N70 hat den Radius 10 mm. Der Vorschub bleibt bis zum Ende 300 mm/min.',
    ask: nums(['Hauptzeit th', 's']), solve: Cc => ({ values: [Cc.run(Z3, { machine: 'mill' }).time.main * 60], tol: 0.4 }), bad: [[12], [14.5]],
    expl: 'Eintauchen: 4 mm bei F100 = 0,04 min. N60: 20 mm bei F300 = 0,0667 min. Halbkreis: Weg = π · r = π · 10 = 31,42 mm bei F300 = 0,1047 min. N80: 20 mm = 0,0667 min. Summe 0,2781 min = 16,7 s.',
    tips: ['Die Länge eines Halbkreises ist π · r.', 'Zähle alle G1/G2-Wege zusammen: 4 mm mit F100, die übrigen mit F300.'] });
  const Z4 = L('(PLAN UND LAENGS)', 'N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S1000', 'N40 G0 X42 Z0', 'N50 G1 X-1 F0.1', 'N60 G0 X42 Z2', 'N70 G0 X36', 'N80 G1 Z-30 F0.2', 'N90 G0 X42 Z2', 'N100 G0 X32', 'N110 G1 Z-30 F0.2', 'N120 G0 X100 Z50', 'N130 M5', 'N140 M30');
  add({ id: 'cnc29', cat: 'Zeit rechnen', level: 3, title: 'Hauptzeit mit Plandrehen', machine: 'turn', prog: Z4, progMode: 'show',
    text: 'Berechne die gesamte Hauptzeit des Programms in Minuten (n = 1000 1/min). Achtung: Beim Plandrehen ist der Weg in X ein RADIUSweg, die Eilgänge zählen nicht.',
    ask: nums(['Hauptzeit th', 'min']), solve: Cc => ({ values: [Cc.run(Z4, { machine: 'turn' }).time.main], tol: 0.006 }), bad: [[0.75], [0.49]],
    expl: 'Plandrehen N50: X42 nach X-1 sind 43 mm im Durchmesser, aber der Radiusweg ist 21,5 mm. vf = 0,1 · 1000 = 100 mm/min, also 0,215 min. Längsdrehen N80 und N110: je Z2 bis Z-30 = 32 mm, vf = 0,2 · 1000 = 200 mm/min: je 0,16 min. Summe 0,535 min.',
    tips: ['Rechne drei Arbeitsgänge einzeln: ein Plandrehen und zwei Längsdrehen.', 'Beim Plandrehen ist der Weg der halbe Durchmesserunterschied. Die Längsdrehwege beginnen bei Z2.'] });
  add({ id: 'cnc37', cat: 'Zeit rechnen', level: 1, title: 'Drehzahl aus der Schnittgeschwindigkeit', machine: 'turn', progMode: 'none',
    text: 'Ein Bolzen Ø40 wird mit der Schnittgeschwindigkeit vc = 120 m/min gedreht. Berechne die Drehzahl n. Runde auf ganze Umdrehungen pro Minute.',
    ask: nums(['Drehzahl n', '1/min']), solve: () => ({ values: [120 * 1000 / (Math.PI * 40)], tol: 1 }), bad: [[3820], [477]],
    expl: 'n = vc · 1000 / (π · d). Der Faktor 1000 rechnet Meter in Millimeter um, der Durchmesser d steht in mm. n = 120 · 1000 / (π · 40) = 120000 / 125,66 ≈ 955 1/min. Mit dem Radius statt dem Durchmesser käme die doppelte Drehzahl heraus.',
    tips: ['Die Umfangsstrecke pro Umdrehung ist π · d.', 'vc steht in m/min, d in mm. Rechne beides in dieselbe Einheit um (1 m = 1000 mm).'] });
  add({ id: 'cnc38', cat: 'Zeit rechnen', level: 2, title: 'Vorschubgeschwindigkeit beim Fräsen', machine: 'mill', progMode: 'none',
    text: 'Ein Schaftfräser mit 4 Schneiden läuft mit n = 2400 1/min. Der Vorschub pro Zahn beträgt fz = 0,05 mm. Berechne die Vorschubgeschwindigkeit vf, die du im Programm als F eingibst (Fräsen, Vorschub in mm/min).',
    ask: nums(['Vorschubgeschwindigkeit vf', 'mm/min']), solve: () => ({ values: [2400 * 4 * 0.05], tol: 0.5 }), bad: [[120], [0.48]],
    expl: 'vf = n · z · fz = 2400 1/min · 4 · 0,05 mm = 480 mm/min. Jede der 4 Schneiden trägt pro Umdrehung 0,05 mm Vorschub, also ist der Vorschub pro Umdrehung 0,2 mm. Beim Fräsen gilt G94 (Vorschub in mm/min), deshalb schreibst du F480.',
    tips: ['Wie viel Vorschub entsteht pro Umdrehung, wenn jeder Zahn fz zurücklegt?', 'Multipliziere den Vorschub pro Umdrehung mit der Drehzahl.'] });

  add({ id: 'cnc47', cat: 'Zeit rechnen', level: 3, title: 'Hauptzeit beim Bohrzyklus', machine: 'mill', prog: B4REF, progMode: 'show',
    text: 'Berechne die Hauptzeit für alle vier Bohrungen in Sekunden. Der Vorschub wirkt von der Rückzugsebene R bis zur Bohrtiefe Z. Eilgänge und Rückzug zählen nicht zur Hauptzeit.',
    ask: nums(['Hauptzeit th', 's']), solve: Cc => ({ values: [Cc.run(B4REF, { machine: 'mill' }).time.main * 60], tol: 0.5 }), bad: [[20], [12]],
    expl: 'Je Bohrung läuft der Bohrer mit F120 von R2 bis Z-10: Weg 2 + 10 = 12 mm. Zeit: 12 mm / 120 mm/min = 0,1 min = 6 s. Vier Bohrungen: 4 · 6 s = 24 s. Der Weg von R bis zur Werkstückoberfläche (2 mm) zählt mit, weil dort schon mit Vorschub gefahren wird.',
    tips: ['Wie lang ist der Weg mit Vorschub für eine Bohrung? Beginne bei der Rückzugsebene R.', 'Zeit = Weg / Vorschub. Rechne eine Bohrung aus und multipliziere mit der Anzahl.'] });

  tasks.forEach(t => { if (!t.tips || t.tips.length < 2) throw new Error('Tipps fehlen: ' + t.id); });

  /* ============================================================ Prüfung */
  const fAny = v => C.fmtNum(v);
  function solText(t, s) {
    if (t.ask.type === 'choice') return t.ask.choices[t.ask.correct];
    if (t.ask.type === 'num') return t.ask.fields.map((f, i) => f.label + ' = ' + C.fmtNum(s.values[i]) + ' ' + f.unit).join(', ');
    return t.ref;
  }
  /* ans: num -> Array<string>, choice -> Index, prog -> Programmtext. Rückgabe {ok, empty, lines, sol} */
  function check(t, ans) {
    const a = t.ask;
    if (a.type === 'choice') {
      if (ans == null || ans < 0) return { empty: true, msg: 'Wähle zuerst eine Antwort.' };
      const ok = ans === a.correct; return { ok, lines: [{ ok, text: ok ? 'Richtig: ' + a.choices[ans] : 'Deine Antwort „' + a.choices[ans] + '“ stimmt nicht.' }], sol: solText(t) };
    }
    if (a.type === 'num') {
      const s = t.solve(C), v = (ans || []).map(C.parseDe);
      if (v.length < a.fields.length || v.some(x => !isFinite(x))) return { empty: true, msg: 'Bitte gib alle Zahlen ein (mit Komma oder Punkt).' };
      const lines = a.fields.map((f, i) => { const ok = Math.abs(v[i] - s.values[i]) <= s.tol + 1e-9; return { ok, text: f.label + ': ' + (ok ? 'richtig (' + C.fmtNum(v[i]) + ' ' + f.unit + ')' : C.fmtNum(v[i]) + ' ' + f.unit + ' ist nicht richtig') }; });
      return { ok: lines.every(l => l.ok), lines, sol: solText(t, s) };
    }
    const res = C.run(ans, t.setup), ref = C.run(t.ref, t.setup), cmp = C.compare(res, ref, t.cmp), lines = cmp.lines.slice();
    (t.req || []).forEach(r => { const ok = r.re.test(ans); lines.push({ ok, text: ok ? 'Vorgabe erfüllt.' : r.msg }); });
    return { ok: lines.every(l => l.ok), lines, sol: t.ref, run: res };
  }
  const cats = ['G-Code lesen', 'Koordinaten', 'Programm ergänzen', 'Fehler im Programm finden', 'Zeit rechnen'];

  /* ============================================================ Zufalls-Trainer */
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const ri = (R, a, b, st) => { st = st || 1; return a + st * Math.floor(R() * ((b - a) / st + 1)); };
  function genFig(R, machine, level) {
    if (machine === 'turn') {
      const n = level === 3 ? 4 : 3, dim = level === 1 ? 'd' : 'r'; let d = ri(R, 12, 24, 2); const pts = []; let z = 0;
      for (let i = 0; i < n; i++) { const l = ri(R, 8, 24, 2); if (i > 0) d += ri(R, 4, 8, 2); pts.push([d, -z]); z += l; pts.push([d, -z]); }
      return { kind: 'turn', dim, pts };
    }
    const B = pick(R, [[80, 60], [100, 60], [90, 70], [120, 80]]), W = B[0], H = B[1], x0 = ri(R, 10, 25, 5), y0 = ri(R, 10, 20, 5), x1 = W - ri(R, 10, 25, 5), y1 = H - ri(R, 10, 20, 5), sh = pick(R, ['rect', 'L', 'ecke']);
    let pts;
    if (sh === 'rect') pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    else if (sh === 'L') { const xm = Math.round((x0 + x1) / 10) * 5, ym = Math.round((y0 + y1) / 10) * 5; pts = [[x0, y0], [x1, y0], [x1, ym], [xm, ym], [xm, y1], [x0, y1]]; }
    else { const c = pick(R, [10, 15]); pts = [[x0, y0], [x1, y0], [x1, y1 - c], [x1 - c, y1], [x0, y1]]; }
    return { kind: 'mill', W, H, zero: level === 1 ? 'corner' : level === 2 ? 'center' : 'tr', pts };
  }
  function figCoord(fig, i) {
    const p = fig.pts[i];
    if (fig.kind === 'turn') return [fig.dim === 'r' ? p[0] : p[0], p[1]];
    const zx = fig.zero === 'center' ? fig.W / 2 : fig.zero === 'tr' ? fig.W : 0, zy = fig.zero === 'center' ? fig.H / 2 : fig.zero === 'tr' ? fig.H : 0;
    return [p[0] - zx, p[1] - zy];
  }
  const sgn = v => (v > 0 ? '+' : '') + C.fmtNum(v);
  function genProg(R, machine, level, forTime) {
    const L2 = [];
    if (machine === 'mill') {
      L2.push('N10 G54 G90 G94 G17', 'N20 T1 M6', 'N30 M3 S2000', 'N40 G0 X10 Y10 Z5');
      let x = 10, y = 10, n = 50;
      if (forTime) {
        const f1 = pick(R, [80, 100, 120]), f2 = pick(R, [200, 250, 300, 400]), xt = ri(R, 40, 70, 10), yt = ri(R, 30, 50, 10);
        L2.push('N' + n + ' G1 Z-2 F' + f1); n += 10; L2.push('N' + n + ' G1 X' + xt + ' F' + f2); n += 10;
        if (level >= 2) { L2.push('N' + n + ' G1 Y' + yt); n += 10; }
        if (level === 3) { L2.push('N' + n + ' G3 X' + (xt - 10) + ' Y' + (yt + 10) + ' I0 J10'); n += 10; }
        L2.push('N' + n + ' G0 Z50', 'N' + (n + 10) + ' M5', 'N' + (n + 20) + ' M30'); return L2.join('\n');
      }
      L2.push('N' + n + ' G1 Z-1 F100'); n += 10; L2.push('N' + n + ' G1 X' + (x = ri(R, 20, 60, 10)) + ' F250'); n += 10; L2.push('N' + n + ' Y' + (y = ri(R, 20, 40, 5))); n += 10;
      if (level >= 2) { const dx = pick(R, [-10, 10, 15]), dy = pick(R, [-5, 5, 10]); L2.push('N' + n + ' G91 X' + dx + ' Y' + dy); n += 10; x += dx; y += dy; L2.push('N' + n + ' G90'); n += 10; }
      if (level === 3) { const r = pick(R, [5, 10]); if (R() < 0.5) { L2.push('N' + n + ' G3 X' + (x + r) + ' Y' + (y + r) + ' I0 J' + r); } else { L2.push('N' + n + ' G2 X' + (x + r) + ' Y' + (y + r) + ' I' + r + ' J0'); } n += 10; x += r; y += r; }
      L2.push('N' + n + ' G1 X' + ri(R, 10, 70, 5)); n += 10; L2.push('N' + n + ' G0 Z50', 'N' + (n + 10) + ' M5', 'N' + (n + 20) + ' M30');
      return L2.join('\n');
    }
    L2.push('N10 G54 G90 G95 G18', 'N20 T1', 'N30 M3 S' + (forTime ? pick(R, [800, 1000, 1200]) : 1000), 'N40 G0 X42 Z2');
    let n = 50;
    if (forTime) {
      const f = pick(R, [0.1, 0.2, 0.25]), l1 = ri(R, 20, 40, 5), d1 = pick(R, [36, 32, 28]);
      L2.push('N' + n + ' G0 X' + d1); n += 10; L2.push('N' + n + ' G1 Z-' + l1 + ' F' + f); n += 10;
      if (level >= 2) { L2.push('N' + n + ' G0 X42 Z2'); n += 10; L2.push('N' + n + ' G0 X' + (d1 - 6)); n += 10; L2.push('N' + n + ' G1 Z-' + l1); n += 10; }
      if (level === 3) { L2.push('N' + n + ' G0 X42 Z2'); n += 10; L2.push('N' + n + ' G0 X' + (d1 - 12)); n += 10; L2.push('N' + n + ' G1 X42 F' + f); n += 10; }
      L2.push('N' + n + ' G0 X100 Z50', 'N' + (n + 10) + ' M5', 'N' + (n + 20) + ' M30'); return L2.join('\n');
    }
    const d1 = ri(R, 20, 36, 2); L2.push('N' + n + ' G0 X' + d1); n += 10; L2.push('N' + n + ' G1 Z-' + ri(R, 10, 20, 5) + ' F0.2'); n += 10;
    if (level >= 2) { L2.push('N' + n + ' G91 G1 X' + pick(R, [4, 6, 8]) + ' Z-' + pick(R, [5, 10])); n += 10; L2.push('N' + n + ' G90'); n += 10; }
    if (level === 3) { L2.push('N' + n + ' G1 U' + pick(R, [2, 4]) + ' W-' + pick(R, [5, 8])); n += 10; }
    L2.push('N' + n + ' G1 Z-' + ri(R, 30, 45, 5)); n += 10; L2.push('N' + n + ' G0 X100 Z50', 'N' + (n + 10) + ' M5', 'N' + (n + 20) + ' M30');
    return L2.join('\n');
  }
  /* kind: 'coord' | 'inc' | 'pos' | 'zeit' ; liefert {kind, machine, level, fig?, src?, text, fields:[{label,unit}], values, tol, expl} */
  function gen(R, kind, machine, level) {
    machine = machine === 'turn' ? 'turn' : 'mill'; level = Math.max(1, Math.min(3, level | 0 || 1));
    const turn = machine === 'turn', lab = turn ? [{ label: 'X (Durchmesser)', unit: 'mm' }, { label: 'Z', unit: 'mm' }] : [{ label: 'X', unit: 'mm' }, { label: 'Y', unit: 'mm' }];
    if (kind === 'coord' || kind === 'inc') {
      const fig = genFig(R, machine, level), n = fig.pts.length, k = kind === 'inc' ? ri(R, 1, n - 1) : ri(R, 0, n - 1), name = 'P' + (k + 1);
      let vals, txt, ex;
      const cs = figCoord(fig, k);
      if (kind === 'coord') {
        vals = cs;
        txt = 'Gib die Koordinaten von ' + name + ' absolut (G90) an.' + (turn ? ' X ist der Durchmesser, der Nullpunkt liegt auf der Planfläche.' : '');
        ex = turn ? name + ': Durchmesser ' + C.fmtNum(vals[0]) + (fig.dim === 'r' ? ' (Radius ' + C.fmtNum(cs[0] / 2) + ' mal 2)' : '') + ', Abstand von der Planfläche ' + C.fmtNum(-vals[1]) + ' mm, Z ist negativ: X' + C.fmtNum(vals[0]) + ' Z' + C.fmtNum(vals[1]) + '.'
          : name + ' liegt ' + C.fmtNum(fig.pts[k][0]) + ' mm von links und ' + C.fmtNum(fig.pts[k][1]) + ' mm von unten. ' + (fig.zero === 'corner' ? 'Der Nullpunkt liegt in der linken unteren Ecke: X' + C.fmtNum(vals[0]) + ' Y' + C.fmtNum(vals[1]) + '.' : 'Nullpunkt ' + (fig.zero === 'center' ? 'in der Mitte (' + C.fmtNum(fig.W / 2) + '/' + C.fmtNum(fig.H / 2) + ')' : 'in der rechten oberen Ecke (' + fig.W + '/' + fig.H + ')') + ': X = ' + C.fmtNum(fig.pts[k][0]) + ' - ' + C.fmtNum(fig.W / 2 * (fig.zero === 'center' ? 1 : 2)) + ' = ' + C.fmtNum(vals[0]) + ', Y = ' + C.fmtNum(fig.pts[k][1]) + ' - ' + C.fmtNum(fig.H / 2 * (fig.zero === 'center' ? 1 : 2)) + ' = ' + C.fmtNum(vals[1]) + '.');
      } else {
        const a = figCoord(fig, k - 1);
        vals = [cs[0] - a[0], cs[1] - a[1]];
        txt = 'Das Werkzeug steht auf P' + k + '. Gib die Werte für den Satz G91 G1 nach ' + name + ' an.' + (turn ? ' X ist die Änderung des Durchmessers.' : '');
        ex = 'Kettenmaß ist Ziel minus Start: ' + (turn ? 'Durchmesser ' + C.fmtNum(cs[0]) + ' - ' + C.fmtNum(a[0]) + ' = ' + sgn(vals[0]) + ', Z ' + C.fmtNum(cs[1]) + ' - (' + C.fmtNum(a[1]) + ') = ' + sgn(vals[1]) + '.' : 'X = ' + C.fmtNum(fig.pts[k][0]) + ' - ' + C.fmtNum(fig.pts[k - 1][0]) + ' = ' + sgn(vals[0]) + ', Y = ' + C.fmtNum(fig.pts[k][1]) + ' - ' + C.fmtNum(fig.pts[k - 1][1]) + ' = ' + sgn(vals[1]) + '.');
      }
      return { kind, machine, level, fig, text: txt, fields: lab, values: vals, tol: 0.01, expl: ex };
    }
    for (let tries = 0; tries < 12; tries++) {
      const src = genProg(R, machine, level, kind === 'zeit'), res = C.run(src, { machine });
      if (!res.ok) continue;
      if (kind === 'pos') {
        const st = res.steps.filter(s => s.n != null && s.m1 > s.m0 && res.moves.slice(s.m0, s.m1).some(m => m.kind === 'feed')), s = st[st.length - 1]; if (!s) continue;
        const p = s.state.pos, vals = turn ? [p.x, p.z] : [p.x, p.y];
        return { kind, machine, level, src, text: 'Wo steht das Werkzeug nach Satz N' + s.n + '? Hier gilt: ' + (turn ? 'X ist der Durchmesser.' : 'Z0 liegt auf der Oberseite.'), fields: lab, values: vals, tol: 0.01, expl: 'Gehe Satz für Satz durch. Nicht programmierte Achsen behalten ihren Wert, G91 macht aus den Werten Wege' + (turn ? ' (X als Durchmesseränderung, U/W sind immer Wege)' : '') + '. Ergebnis nach N' + s.n + ': ' + lab[0].label.split(' ')[0] + C.fmtNum(vals[0]) + ' ' + (turn ? 'Z' : 'Y') + C.fmtNum(vals[1]) + '.', run: res };
      }
      const t = res.time.main, secs = !turn && t < 0.3;
      return { kind, machine, level, src, text: 'Berechne die Hauptzeit aller Arbeitsgänge (G1, G2, G3; ohne Eilgang) in ' + (secs ? 'Sekunden' : 'Minuten') + '. ' + (turn ? 'Es gilt vf = f · n. Der Weg beginnt dort, wo das Werkzeug beim Satz steht; beim Plandrehen zählt der Radiusweg.' : 'Der Weg beginnt dort, wo das Werkzeug beim Satz steht.'),
        fields: [{ label: 'Hauptzeit th', unit: secs ? 's' : 'min' }], values: [secs ? t * 60 : t], tol: secs ? 0.5 : 0.01, expl: 'Weg je Arbeitsgang geteilt durch die Vorschubgeschwindigkeit' + (turn ? ' (vf = f · n)' : '') + ', dann addieren. Gesamtweg der Arbeitsgänge: ' + C.fmtNum(res.time.feedLen) + ' mm. Hauptzeit: ' + C.fmtTime(t) + '.', run: res };
    }
    return null;
  }
  function checkItem(it, ans) {
    const v = (ans || []).map(C.parseDe);
    if (v.length < it.fields.length || v.some(x => !isFinite(x))) return { empty: true, msg: 'Bitte gib alle Zahlen ein (mit Komma oder Punkt).' };
    const lines = it.fields.map((f, i) => { const ok = Math.abs(v[i] - it.values[i]) <= it.tol + 1e-9; return { ok, text: f.label + ': ' + (ok ? 'richtig' : C.fmtNum(v[i]) + ' ist nicht richtig, gesucht ' + C.fmtNum(it.values[i]) + ' ' + f.unit) }; });
    return { ok: lines.every(l => l.ok), lines, sol: it.fields.map((f, i) => f.label.split(' ')[0] + ' ' + C.fmtNum(it.values[i]) + ' ' + f.unit).join(', ') };
  }

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp): die Beispielprogramme aus "Beispielprogramm laden" mit ihrer Erklärung. */
  const beispiele = examples.map(e => ({ id: e.id, ex: e.id, machine: e.machine, titel: e.title, text: e.note }));
  root.CNC_DATA = { beispiele, examples, tasks, cats, check, gen, checkItem, figCoord, posAfter };
  root.CNC_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.CNC_DATA, TASKS: root.CNC_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
