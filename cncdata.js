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

  root.CNC_DATA = { examples, tasks, cats, check, gen, checkItem, figCoord, posAfter };
  root.CNC_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.CNC_DATA, TASKS: root.CNC_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
