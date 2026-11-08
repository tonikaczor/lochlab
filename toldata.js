'use strict';
/* Tonfunk Toleranz-Lab: Daten (ISO-Tabelle, Aufgaben, Anwendungsfälle, Messmittel).
   window.TOL_ISO   Abmaße nach DIN EN ISO 286-1 in µm (Einheitsbohrung)
   window.TOL_DATA  { tasks, uses, devices, cats }
   window.TOL_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'tol', Status in localStorage 'lm4.tol.done' = {id:true}) */
(function (root) {
  /* ===== ISO-Tabelle =====
     Quelle: DIN EN ISO 286-1 (ISO-System für Grenzmaße und Passungen), Tabellen der Grundtoleranzgrade (IT) und der
     Grundabmaße für Wellen; Werte wie in den gängigen Tabellenbüchern (Metall) für Nennmaßbereiche über 6 bis 10, über 10 bis 18,
     über 18 bis 30 und über 30 bis 50 mm. Alle Werte in µm. Reihenfolge der Felder = Reihenfolge von ranges.
     Bohrung H: unteres Abmaß EI = 0, oberes Abmaß ES = +IT.
     Welle: es = oberes, ei = unteres Abmaß; es − ei = IT (f7: IT7, alle anderen: IT6). */
  const ISO = {
    ranges: [[6, 10], [10, 18], [18, 30], [30, 50]],              /* über 6 bis 10, über 10 bis 18, über 18 bis 30, über 30 bis 50 mm */
    IT: { 6: [9, 11, 13, 16], 7: [15, 18, 21, 25], 8: [22, 27, 33, 39] },
    shafts: {
      f7: { es: [-13, -16, -20, -25], ei: [-28, -34, -41, -50] },
      g6: { es: [-5, -6, -7, -9], ei: [-14, -17, -20, -25] },
      h6: { es: [0, 0, 0, 0], ei: [-9, -11, -13, -16] },
      /* PRUEFEN: j6 ist kein Formelwert, sondern ein Tabellenwert (Grundabmaß j, IT6): +7/−2, +8/−3, +9/−4, +11/−5 – bitte mit Tabellenbuch vergleichen. */
      j6: { es: [7, 8, 9, 11], ei: [-2, -3, -4, -5] },
      k6: { es: [10, 12, 15, 18], ei: [1, 1, 2, 2] },
      m6: { es: [15, 18, 21, 25], ei: [6, 7, 8, 9] },
      n6: { es: [19, 23, 28, 33], ei: [10, 12, 15, 17] },
      p6: { es: [24, 29, 35, 42], ei: [15, 18, 22, 26] },
      s6: { es: [32, 39, 48, 59], ei: [23, 28, 35, 43] }
    },
    holes: ['H6', 'H7', 'H8'],
    shaftList: ['f7', 'g6', 'h6', 'j6', 'k6', 'm6', 'n6', 'p6', 's6']
  };

  /* ===== Messmittel für die Faustregel ===== (Skalenteilungswert / Ablesung in mm) */
  const devices = [
    { id: 'mass', name: 'Stahlmaßstab', r: 0.5 },
    { id: 'ms10', name: 'Messschieber 1/10', r: 0.1 },
    { id: 'ms20', name: 'Messschieber 1/20', r: 0.05 },
    { id: 'ms50', name: 'Messschieber 1/50', r: 0.02 },
    { id: 'bms', name: 'Bügelmessschraube (0,01 mm)', r: 0.01 },
    { id: 'fz', name: 'Feinzeiger (Skalenwert 0,001 mm)', r: 0.001 }
  ];

  /* ===== Anwendungsfälle für „Welche Passung passt?“ ===== (Einheitsbohrung H7; je Fall genau eine passende von drei Wellen) */
  const uses = [
    { id: 'gleit', title: 'Gleitlager', text: 'Eine Welle dreht sich in einer Lagerbuchse und wird geschmiert. Es soll deutliches Spiel für den Schmierfilm da sein.', correct: 'H7/f7',
      why: 'f7 liegt weit unter der Nulllinie, so entsteht immer Spiel (Spielpassung) für Schmierfilm und Wärmedehnung.' },
    { id: 'zentr', title: 'Zentrierung', text: 'Ein Zentrierflansch soll genau fluchten, sich aber ohne große Kraft fügen und wieder lösen lassen.', correct: 'H7/j6',
      why: 'j6 ergibt eine Übergangspassung: je nach Istmaßen minimales Spiel oder minimales Übermaß. Das zentriert genau und lässt sich noch leicht fügen.' },
    { id: 'press', title: 'Presssitz', text: 'Eine Buchse soll dauerhaft fest in der Bohrung sitzen und ohne weitere Sicherung Kraft übertragen. Sie wird eingepresst.', correct: 'H7/s6',
      why: 's6 ergibt immer Übermaß (Übermaßpassung): Die Welle ist stets größer als die Bohrung, das Teil sitzt fest.' }
  ];
  const useOptions = ['H7/f7', 'H7/j6', 'H7/s6'];

  /* ===== Aufgaben ===== */
  const GEN_T1 = 'Lies zuerst die Hauptskala: Wie viele ganze Millimeter liegen links vom Nullstrich des Nonius?';
  const GEN_M1 = 'Lies zuerst die Hülse: Welcher Millimeterstrich ist zuletzt links neben der Trommelkante sichtbar? Ist auch der Halbmillimeterstrich darunter schon frei?';
  const num = (unit, label) => ({ type: 'num', unit, label });
  const choice = (choices, correct) => ({ type: 'choice', choices, correct });
  const GPA = ['Gut', 'Nacharbeit', 'Ausschuss'];

  const tasks = [
    /* ----- Ablesen ----- */
    { id: 'tol1', cat: 'Ablesen', level: 1, title: 'Messschieber 1/10 ablesen', text: 'Lies den Messwert am Messschieber (Nonius 1/10) ab.',
      inst: { t: 'caliper', den: 10, v: 14.7 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'caliper', den: 10, v: 14.7 }), tol: 0.1 }),
      expl: 'Der Nullstrich des Nonius steht hinter dem 14-mm-Strich der Hauptskala: 14 mm. Beim Nonius 1/10 deckt sich der 7. Strich mit einem Hauptstrich: 7 × 0,1 = 0,7 mm. Messwert 14,7 mm.',
      tips: [GEN_T1, 'Danach suchst du den Noniusstrich, der genau in einer Linie mit einem Strich der Hauptskala liegt. Jeder Strich ist 0,1 mm wert.'] },
    { id: 'tol2', cat: 'Ablesen', level: 1, title: 'Messschieber 1/20 ablesen', text: 'Lies den Messwert am Messschieber (Nonius 1/20, Ablesung 0,05 mm) ab.',
      inst: { t: 'caliper', den: 20, v: 12.35 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'caliper', den: 20, v: 12.35 }), tol: 0.05 }),
      expl: 'Hauptskala: 12 mm. Beim Nonius 1/20 ist jeder Strich 0,05 mm wert; der 7. Strich deckt sich: 7 × 0,05 = 0,35 mm. Messwert 12,35 mm. Die Zahlen am Nonius zeigen Zehntel Millimeter (0,1 mm je Zahl), dazwischen liegt je ein 0,05-Strich.',
      tips: [GEN_T1, 'Zähle am Nonius die Striche bis zu dem, der sich deckt. Beim 1/20-Nonius ist jeder Strich 0,05 mm wert, die Zahlen stehen für Zehntel.'] },
    { id: 'tol3', cat: 'Ablesen', level: 2, title: 'Messschieber 1/50 ablesen', text: 'Lies den Messwert am Messschieber (Nonius 1/50, Ablesung 0,02 mm) ab.',
      inst: { t: 'caliper', den: 50, v: 47.86 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'caliper', den: 50, v: 47.86 }), tol: 0.02 }),
      expl: 'Hauptskala: 47 mm. Beim Nonius 1/50 ist jeder Strich 0,02 mm wert; der 43. Strich deckt sich: 43 × 0,02 = 0,86 mm. Messwert 47,86 mm. Tipp: Die Zahlen am Nonius sind Zehntel, jede Zahl hat vier kleine Striche dazwischen.',
      tips: [GEN_T1, 'Die Zahlen am Nonius zeigen Zehntel Millimeter, zwischen zwei Zahlen liegen fünf Teile zu je 0,02 mm.'] },
    { id: 'tol4', cat: 'Ablesen', level: 2, title: 'Großes Maß am Messschieber', text: 'Lies den Messwert ab (Nonius 1/20). Das Werkstück ist über 100 mm lang.',
      inst: { t: 'caliper', den: 20, v: 103.65 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'caliper', den: 20, v: 103.65 }), tol: 0.05 }),
      expl: 'Hauptskala: 103 mm (zehn Zentimeterstriche plus drei Millimeter). Der Nonius zeigt 0,65 mm (13 × 0,05). Messwert 103,65 mm.',
      tips: [GEN_T1 + ' Die Zahlen auf der Hauptskala sind Zentimeter.', 'Die Zahl 10 auf der Hauptskala bedeutet 100 mm. Zähle von dort die Striche bis zum Nullstrich des Nonius weiter.'] },
    { id: 'tol5', cat: 'Ablesen', level: 1, title: 'Bügelmessschraube ablesen', text: 'Lies den Messwert an der Bügelmessschraube (Messbereich 0–25 mm) ab.',
      inst: { t: 'micro', base: 0, v: 7.38 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'micro', base: 0, v: 7.38 }), tol: 0.01 }),
      expl: 'Hülse: 7 mm (der Halbmillimeterstrich ist noch verdeckt). Trommel: Strich 38 steht an der Hülsenlinie, also 38 × 0,01 = 0,38 mm. Messwert 7,38 mm.',
      tips: [GEN_M1, 'Danach liest du die Zahl der Trommel ab, die an der durchgehenden Linie der Hülse steht. Jeder Trommelstrich ist 0,01 mm.'] },
    { id: 'tol6', cat: 'Ablesen', level: 2, title: 'Messbereich 25–50 mm', text: 'Lies den Messwert an der Bügelmessschraube mit dem Messbereich 25–50 mm ab.',
      inst: { t: 'micro', base: 25, v: 31.72 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'micro', base: 25, v: 31.72 }), tol: 0.01 }),
      expl: 'Die Hülse zeigt 6,5 mm (Millimeterstrich 6 und der Halbmillimeterstrich sind sichtbar). Dazu kommt die Trommel mit 22 × 0,01 = 0,22 mm. Das ergibt 6,72 mm. Bei einer Bügelmessschraube 25–50 mm kommen noch 25 mm Messbereichsanfang dazu: 31,72 mm.',
      tips: ['Der Messbereich steht auf dem Bügel: Er beginnt bei 25 mm. Dieser Wert wird zum Ablesewert addiert.', 'Hülse 6 mm plus sichtbarer Halbmillimeterstrich = 6,5 mm. Dazu die Trommel und die 25 mm Messbereichsanfang.'] },
    { id: 'tol7', cat: 'Ablesen', level: 3, title: 'Falle: Trommel kurz vor dem Halbmillimeter', text: 'Lies den Messwert an der Bügelmessschraube (Messbereich 50–75 mm) ab. Achte genau darauf, ob der Halbmillimeterstrich schon frei ist.',
      inst: { t: 'micro', base: 50, v: 62.49 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'micro', base: 50, v: 62.49 }), tol: 0.01 }),
      expl: 'Hülse: 12 mm, der Halbmillimeterstrich ist noch von der Trommel verdeckt. Die Trommel steht auf 49, also 0,49 mm (fast ein halber Millimeter). Ablesewert 12,49 mm plus 50 mm Messbereichsanfang = 62,49 mm.',
      tips: ['Ist der Strich unter der Hülsenlinie (Halbmillimeter) sichtbar oder noch verdeckt? Das entscheidet, ob 0,5 mm dazukommen.', 'Die Trommel zeigt eine hohe Zahl (fast 50). Dann ist der Halbmillimeterstrich noch nicht erreicht. Vergiss den Messbereichsanfang 50 mm nicht.'] },
    { id: 'tol8', cat: 'Ablesen', level: 3, title: 'Falle: Nonius kurz vor dem nächsten Millimeter', text: 'Lies den Messwert am Messschieber (Nonius 1/50) ab. Achte auf die Hauptskala: Steht der Nullstrich schon hinter dem nächsten Millimeterstrich?',
      inst: { t: 'caliper', den: 50, v: 9.98 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'caliper', den: 50, v: 9.98 }), tol: 0.02 }),
      expl: 'Der Nullstrich des Nonius steht noch vor dem 10-mm-Strich, also zählt die Hauptskala nur 9 mm. Der Noniusstrich 49 deckt sich: 49 × 0,02 = 0,98 mm. Messwert 9,98 mm (nicht 10,98 mm).',
      tips: ['Entscheidend ist der letzte Hauptskalenstrich links vom Nullstrich des Nonius, nicht der nächste.', 'Der Nullstrich liegt fast am 10-mm-Strich, aber noch davor. Es zählen 9 mm.'] },
    { id: 'tol9', cat: 'Ablesen', level: 3, title: 'Falle: Halbmillimeter und Trommel 0', text: 'Lies den Messwert an der Bügelmessschraube (Messbereich 0–25 mm) ab.',
      inst: { t: 'micro', base: 0, v: 12.5 }, ask: num('mm', 'Messwert'), solve: C => ({ value: C.truth({ t: 'micro', base: 0, v: 12.5 }), tol: 0.01 }),
      expl: 'Hülse: 12 mm und der Halbmillimeterstrich ist frei: 12,5 mm. Die Trommel steht auf 0, es kommen keine Hundertstel dazu. Messwert 12,50 mm. Wer den Halbmillimeter übersieht, liest fälschlich 12,00 mm ab.',
      tips: [GEN_M1, 'Die Trommel zeigt 0 an der Hülsenlinie. Der Strich unter der Linie (Halbmillimeter) ist sichtbar, das sind 0,5 mm.'] },

    /* ----- Toleranzen ----- */
    { id: 'tol10', cat: 'Toleranzen', level: 1, title: 'Höchstmaß berechnen', text: 'Maß an der Zeichnung: 40 mit oberem Abmaß +0,05 mm und unterem Abmaß +0,01 mm. Wie groß ist das Höchstmaß?',
      ask: num('mm', 'Höchstmaß'), solve: () => ({ value: 40.05, tol: 0.0005 }),
      expl: 'Höchstmaß = Nennmaß + oberes Abmaß = 40 mm + 0,05 mm = 40,05 mm. (Mindestmaß: 40 + 0,01 = 40,01 mm.)',
      tips: ['Das Höchstmaß ist das größte erlaubte Maß. Es gehört zum oberen Abmaß.', 'Höchstmaß = Nennmaß + oberes Abmaß. Achte auf das Vorzeichen.'] },
    { id: 'tol11', cat: 'Toleranzen', level: 1, title: 'Mindestmaß berechnen', text: 'Eine Welle hat das Maß Ø25 mit oberem Abmaß −0,020 mm und unterem Abmaß −0,041 mm. Wie groß ist das Mindestmaß?',
      ask: num('mm', 'Mindestmaß'), solve: () => ({ value: 24.959, tol: 0.0005 }),
      expl: 'Mindestmaß = Nennmaß + unteres Abmaß = 25 mm + (−0,041 mm) = 24,959 mm. (Höchstmaß: 25 − 0,020 = 24,980 mm.)',
      tips: ['Das Mindestmaß gehört zum unteren Abmaß.', 'Mindestmaß = Nennmaß + unteres Abmaß. Das untere Abmaß ist negativ, das Maß wird also kleiner als 25.'] },
    { id: 'tol12', cat: 'Toleranzen', level: 1, title: 'Toleranz bestimmen', text: 'Maß an der Zeichnung: 60 mit oberem Abmaß +0,03 mm und unterem Abmaß −0,02 mm. Wie groß ist die Toleranz?',
      ask: num('mm', 'Toleranz'), solve: () => ({ value: 0.05, tol: 0.0005 }),
      expl: 'Toleranz = oberes Abmaß − unteres Abmaß = +0,03 − (−0,02) = 0,05 mm. Das ist auch Höchstmaß − Mindestmaß = 60,03 − 59,98.',
      tips: ['Die Toleranz ist die Breite des erlaubten Bereichs, immer positiv.', 'Toleranz = oberes Abmaß − unteres Abmaß. Minus mal minus gibt plus.'] },
    { id: 'tol13', cat: 'Toleranzen', level: 2, title: 'Mittenmaß', text: 'Ein Maß ist angegeben als Ø12 mit oberem Abmaß +0,05 mm und unterem Abmaß −0,03 mm. Wie groß ist das Mittenmaß?',
      ask: num('mm', 'Mittenmaß'), solve: () => ({ value: 12.01, tol: 0.0005 }),
      expl: 'Höchstmaß 12,05 mm, Mindestmaß 11,97 mm. Mittenmaß = (12,05 + 11,97) / 2 = 12,01 mm. Auf dieses Maß stellt man die Fertigung gern ein.',
      tips: ['Das Mittenmaß liegt genau in der Mitte zwischen Mindestmaß und Höchstmaß.', 'Rechne zuerst Höchstmaß und Mindestmaß aus, dann den Mittelwert bilden.'] },
    { id: 'tol14', cat: 'Toleranzen', level: 2, title: 'Toleranz in µm', text: 'Eine Welle hat die Abmaße +16 µm (oben) und −9 µm (unten). Wie groß ist die Toleranz in µm?',
      ask: num('µm', 'Toleranz'), solve: () => ({ value: 25, tol: 0.5 }),
      expl: 'Toleranz = 16 µm − (−9 µm) = 25 µm. 1 µm = 0,001 mm, das sind 0,025 mm.',
      tips: ['Beide Abmaße stehen schon in µm, du musst nicht umrechnen.', 'Oberes Abmaß minus unteres Abmaß: 16 − (−9).'] },
    { id: 'tol15', cat: 'Toleranzen', level: 2, title: 'Welle zu groß', text: 'Welle Ø30 mit den Abmaßen −0,010 mm (oben) und −0,030 mm (unten). Gemessen wird 29,992 mm. Wie wird das Teil bewertet?',
      ask: choice(GPA, 1), solve: () => ({ correct: 1 }),
      expl: 'Höchstmaß 29,990 mm, Mindestmaß 29,970 mm. 29,992 mm ist größer als das Höchstmaß. Eine zu dicke Welle lässt sich nachdrehen oder -schleifen: Nacharbeit.',
      tips: ['Bestimme zuerst Höchstmaß und Mindestmaß und vergleiche damit den Messwert.', 'Der Messwert liegt über dem Höchstmaß. Bei einer Welle kann man Material noch abtragen.'] },
    { id: 'tol16', cat: 'Toleranzen', level: 2, title: 'Bohrung zu klein', text: 'Bohrung Ø20 mit oberem Abmaß +0,021 mm und unterem Abmaß 0 mm. Gemessen wird 19,998 mm. Wie wird das Teil bewertet?',
      ask: choice(GPA, 1), solve: () => ({ correct: 1 }),
      expl: 'Mindestmaß 20,000 mm, Höchstmaß 20,021 mm. 19,998 mm ist kleiner als das Mindestmaß. Eine zu kleine Bohrung kann man noch aufreiben oder aufbohren: Nacharbeit.',
      tips: ['Vergleiche den Messwert mit Mindest- und Höchstmaß.', 'Der Messwert ist kleiner als das Mindestmaß. Bei einer Bohrung kann man Material noch wegnehmen.'] },
    { id: 'tol17', cat: 'Toleranzen', level: 3, title: 'Bohrung zu groß', text: 'Bohrung Ø50 mit oberem Abmaß +0,025 mm und unterem Abmaß 0 mm. Gemessen wird 50,030 mm. Wie wird das Teil bewertet?',
      ask: choice(GPA, 2), solve: () => ({ correct: 2 }),
      expl: 'Höchstmaß 50,025 mm. 50,030 mm ist größer: Die Bohrung ist zu groß. Material, das schon fehlt, kann man nicht ersetzen. Das Teil ist Ausschuss.',
      tips: ['Wie bei der vorigen Aufgabe: erst die Grenzmaße, dann vergleichen.', 'Der Messwert liegt über dem Höchstmaß. Bei einer Bohrung bedeutet zu groß: Material fehlt.'] },
    { id: 'tol18', cat: 'Toleranzen', level: 3, title: 'Welle zu klein', text: 'Welle Ø16 mit oberem Abmaß 0 mm und unterem Abmaß −0,018 mm. Gemessen wird 15,979 mm. Wie wird das Teil bewertet?',
      ask: choice(GPA, 2), solve: () => ({ correct: 2 }),
      expl: 'Mindestmaß 15,982 mm. 15,979 mm ist kleiner: Die Welle ist zu dünn, Material fehlt. Das lässt sich nicht reparieren: Ausschuss.',
      tips: ['Berechne das Mindestmaß: 16 + (−0,018).', 'Der Messwert liegt unter dem Mindestmaß. Eine zu dünne Welle kann man nicht dicker machen.'] },
    { id: 'tol19', cat: 'Toleranzen', level: 3, title: 'Genau auf dem Grenzmaß', text: 'Welle Ø20 mit den Abmaßen −0,020 mm (oben) und −0,033 mm (unten). Gemessen wird 19,980 mm. Wie wird das Teil bewertet?',
      ask: choice(GPA, 0), solve: () => ({ correct: 0 }),
      expl: 'Höchstmaß = 20 − 0,020 = 19,980 mm. Der Messwert liegt genau auf dem Höchstmaß. Die Grenzmaße gehören noch zum erlaubten Bereich, das Teil ist Gut.',
      tips: ['Rechne das Höchstmaß aus und vergleiche es mit dem Messwert.', 'Gleich dem Grenzmaß heißt: noch erlaubt.'] },

    /* ----- Passungen ----- */
    { id: 'tol20', cat: 'Passungen', level: 2, title: 'Höchstspiel H7/f7', text: 'Passung Ø30 H7/f7 (Nennmaßbereich über 18 bis 30 mm: H7 hat +21/0 µm, f7 hat −20/−41 µm). Wie groß ist das Höchstspiel in µm?',
      ask: num('µm', 'Höchstspiel'), solve: C => ({ value: C.fit('H7', 'f7', 30).Pso, tol: 0.5 }),
      expl: 'Höchstspiel = oberes Abmaß der Bohrung − unteres Abmaß der Welle = +21 − (−41) = 62 µm. Das ist die größte mögliche Lücke: größte Bohrung, kleinste Welle.',
      tips: ['Höchstspiel entsteht, wenn die Bohrung am größten und die Welle am kleinsten ist.', 'Höchstspiel = ES − ei. Setze +21 und −41 ein.'] },
    { id: 'tol21', cat: 'Passungen', level: 2, title: 'Mindestspiel H7/g6', text: 'Passung Ø25 H7/g6 (Nennmaßbereich über 18 bis 30 mm: H7 hat +21/0 µm, g6 hat −7/−20 µm). Wie groß ist das Mindestspiel in µm?',
      ask: num('µm', 'Mindestspiel'), solve: C => ({ value: C.fit('H7', 'g6', 25).Psu, tol: 0.5 }),
      expl: 'Mindestspiel = unteres Abmaß der Bohrung − oberes Abmaß der Welle = 0 − (−7) = 7 µm. Kleinste Bohrung und größte Welle: es bleibt immer noch 7 µm Spiel.',
      tips: ['Mindestspiel entsteht bei der kleinsten Bohrung und der größten Welle.', 'Mindestspiel = EI − es. Setze 0 und −7 ein.'] },
    { id: 'tol22', cat: 'Passungen', level: 2, title: 'Passungsart bestimmen', text: 'Welche Passungsart ist Ø40 H7/n6? (Nennmaßbereich über 30 bis 50 mm: H7 hat +25/0 µm, n6 hat +33/+17 µm)',
      ask: choice(['Spielpassung', 'Übergangspassung', 'Übermaßpassung'], 1), solve: () => ({ correct: 1 }),
      expl: 'Höchstspiel = 25 − 17 = +8 µm (Spiel möglich). Mindestspiel = 0 − 33 = −33 µm (Übermaß möglich). Weil beides vorkommen kann, ist es eine Übergangspassung.',
      tips: ['Rechne Höchstspiel (ES − ei) und Mindestspiel (EI − es) aus.', 'Höchstspiel +8 µm, Mindestspiel −33 µm: ein Wert positiv, einer negativ.'] },
    { id: 'tol23', cat: 'Passungen', level: 3, title: 'Mindestübermaß H7/s6', text: 'Passung Ø10 H7/s6 (Nennmaßbereich über 6 bis 10 mm: H7 hat +15/0 µm, s6 hat +32/+23 µm). Wie groß ist das Mindestübermaß in µm?',
      ask: num('µm', 'Mindestübermaß'), solve: C => ({ value: C.fit('H7', 's6', 10).Ueu, tol: 0.5 }),
      expl: 'Mindestübermaß = unteres Abmaß der Welle − oberes Abmaß der Bohrung = +23 − (+15) = 8 µm. Größte Bohrung, kleinste Welle: die Welle ist trotzdem noch 8 µm dicker. Höchstübermaß: 32 − 0 = 32 µm.',
      tips: ['Mindestübermaß ist der günstigste Fall für das Fügen: größte Bohrung, kleinste Welle.', 'Mindestübermaß = ei − ES = 23 − 15.'] },
    { id: 'tol24', cat: 'Passungen', level: 3, title: 'Höchstspiel H8/h6', text: 'Passung Ø15 H8/h6 (Nennmaßbereich über 10 bis 18 mm: H8 hat +27/0 µm, h6 hat 0/−11 µm). Wie groß ist das Höchstspiel in µm?',
      ask: num('µm', 'Höchstspiel'), solve: C => ({ value: C.fit('H8', 'h6', 15).Pso, tol: 0.5 }),
      expl: 'Höchstspiel = ES − ei = +27 − (−11) = 38 µm. Mindestspiel = EI − es = 0 − 0 = 0 µm: Das ist eine Spielpassung.',
      tips: ['Höchstspiel = oberes Abmaß Bohrung − unteres Abmaß Welle.', 'Das untere Abmaß der Welle ist −11 µm: 27 − (−11).'] },
    { id: 'tol25', cat: 'Passungen', level: 3, title: 'Höchstübermaß H7/k6', text: 'Passung Ø20 H7/k6 (Nennmaßbereich über 18 bis 30 mm: H7 hat +21/0 µm, k6 hat +15/+2 µm). Wie groß ist das Höchstübermaß in µm?',
      ask: num('µm', 'Höchstübermaß'), solve: C => ({ value: C.fit('H7', 'k6', 20).Ueo, tol: 0.5 }),
      expl: 'Höchstübermaß = oberes Abmaß der Welle − unteres Abmaß der Bohrung = +15 − 0 = 15 µm. Es entsteht bei der kleinsten Bohrung und der größten Welle. Das Höchstspiel beträgt 21 − 2 = 19 µm, es ist also eine Übergangspassung.',
      tips: ['Höchstübermaß entsteht bei kleinster Bohrung und größter Welle.', 'Höchstübermaß = es − EI = 15 − 0.'] },
    { id: 'tol26', cat: 'Passungen', level: 2, title: 'Passung für ein Gleitlager', text: 'Eine Welle dreht sich geschmiert in einer Lagerbuchse. Es soll deutliches Spiel für den Schmierfilm vorhanden sein. Welche Passung (Einheitsbohrung) wählst du?',
      ask: choice(useOptions, 0), solve: () => ({ correct: 0 }),
      expl: 'H7/f7 ist eine Spielpassung mit deutlichem Mindestspiel für den Schmierfilm. H7/j6 (Übergang) und H7/s6 (Presssitz) würden die Welle festklemmen.',
      tips: ['Die Welle muss sich drehen können. Welche Passungsart brauchst du?', 'Nur eine der drei Passungen hat immer Spiel. Der Buchstabe der Welle liegt dort weit unter der Nulllinie.'] },
    { id: 'tol27', cat: 'Passungen', level: 2, title: 'Passung für eine Zentrierung', text: 'Ein Zentrierflansch soll genau fluchten, sich aber ohne große Kraft fügen und wieder lösen lassen. Welche Passung (Einheitsbohrung) wählst du?',
      ask: choice(useOptions, 1), solve: () => ({ correct: 1 }),
      expl: 'H7/j6 ist eine Übergangspassung: Je nach Istmaßen gibt es ein kleines Spiel oder ein kleines Übermaß. Das zentriert genau und lässt sich noch fügen und lösen.',
      tips: ['Es soll weder viel Spiel noch festes Pressen sein.', 'Gesucht ist die Passung in der Mitte: die Übergangspassung.'] },
    { id: 'tol28', cat: 'Passungen', level: 3, title: 'Passung für einen Presssitz', text: 'Eine Buchse soll dauerhaft fest in der Bohrung sitzen und ohne weitere Sicherung Kraft übertragen. Sie wird eingepresst. Welche Passung (Einheitsbohrung) wählst du?',
      ask: choice(useOptions, 2), solve: () => ({ correct: 2 }),
      expl: 'H7/s6 ist eine Übermaßpassung: Die Welle ist immer größer als die Bohrung, das Fügen geschieht durch Pressen (oder Erwärmen/Kühlen).',
      tips: ['Das Teil darf sich nicht bewegen und nicht von Hand fügbar sein.', 'Gesucht ist die Passung, bei der die Welle immer größer ist als die Bohrung.'] },

    /* ----- Messmittel wählen ----- */
    { id: 'tol29', cat: 'Messmittel wählen', level: 1, title: 'Tiefe einer Sacklochbohrung', text: 'Du sollst die Tiefe einer Sacklochbohrung messen. Welchen Teil des Messschiebers benutzt du?',
      ask: choice(['Die großen Messschenkel (Außenmessung)', 'Die kleinen oberen Schnäbel (Innenmessung)', 'Den Tiefenmessstab am Ende der Schiene'], 2), solve: () => ({ correct: 2 }),
      expl: 'Der Tiefenmessstab ragt am Schienenende heraus. Du setzt die Schiene auf die Werkstückkante und schiebst den Schieber, bis der Stab am Bohrungsgrund anliegt.',
      tips: ['Außen, innen und Tiefe haben beim Messschieber je ein eigenes Messelement.', 'Das Element für die Tiefe ragt am Ende der Schiene heraus.'] },
    { id: 'tol30', cat: 'Messmittel wählen', level: 1, title: 'Die Knarre der Bügelmessschraube', text: 'Wozu dient die Knarre (Ratsche) an der Bügelmessschraube?',
      ask: choice(['Sie macht die Messung schneller.', 'Sie sorgt für einen immer gleichen Messdruck.', 'Sie stellt die Messschraube auf 0 ein.'], 1), solve: () => ({ correct: 1 }),
      expl: 'Die Knarre rutscht durch, sobald die Messkraft einen festgelegten Wert erreicht. So messen verschiedene Personen mit gleichem Messdruck und verfälschen das Ergebnis nicht durch zu festes Zudrehen.',
      tips: ['Es geht um die Kraft, mit der die Messflächen auf das Werkstück drücken.', 'Die Knarre rutscht ab einer bestimmten Kraft durch.'] },
    { id: 'tol31', cat: 'Messmittel wählen', level: 2, title: 'Welche Ablesung ist nötig?', text: 'Faustregel: Der Skalenteilungswert (Ablesung) des Messmittels soll höchstens 1/10 der Toleranz betragen. Ein Maß hat die Toleranz 0,5 mm. Wie groß darf die Ablesung höchstens sein?',
      ask: num('mm', 'Ablesung höchstens'), solve: () => ({ value: 0.05, tol: 0.0005 }),
      expl: '0,5 mm / 10 = 0,05 mm. Ein Messschieber mit 1/20-Nonius (0,05 mm) erfüllt die Faustregel gerade noch.',
      tips: ['Es ist ein Zehntel der Toleranz gefragt.', 'Teile 0,5 mm durch 10.'] },
    { id: 'tol32', cat: 'Messmittel wählen', level: 2, title: 'Das passende Messmittel', text: 'Ein Maß ist mit ±0,05 mm toleriert, die Toleranz beträgt also 0,1 mm. Welches ist das einfachste Messmittel, das die Faustregel (Ablesung höchstens 1/10 der Toleranz) erfüllt?',
      ask: choice(devices.slice(0, 5).map(d => d.name), 4), solve: () => ({ correct: 4 }),
      expl: 'Erlaubte Ablesung: 0,1 mm / 10 = 0,01 mm. Der Messschieber 1/50 liest nur auf 0,02 mm ab, das reicht nicht. Die Bügelmessschraube liest auf 0,01 mm ab: das einfachste geeignete Messmittel.',
      tips: ['Rechne zuerst die erlaubte Ablesung aus: ein Zehntel der Toleranz.', 'Erlaubt sind 0,01 mm. Vergleiche mit der Ablesung der Messmittel in der Liste.'] },
    { id: 'tol33', cat: 'Messmittel wählen', level: 3, title: 'Passungsmaß prüfen', text: 'Eine Welle Ø20 h6 hat eine Toleranz von 13 µm. Welches Messmittel erfüllt die Faustregel (Ablesung höchstens 1/10 der Toleranz)?',
      ask: choice(devices.slice(1).map(d => d.name), 4), solve: () => ({ correct: 4 }),
      expl: 'Erlaubte Ablesung: 13 µm / 10 = 1,3 µm = 0,0013 mm. Nur der Feinzeiger mit 0,001 mm Skalenwert erfüllt das. Bügelmessschraube und Messschieber sind für so kleine Toleranzen zu grob.',
      tips: ['Rechne die Toleranz in mm um: 13 µm = 0,013 mm.', 'Ein Zehntel davon ist rund 0,0013 mm. Welches Messmittel liest so fein ab?'] }
  ];

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp): fertige Einstellungen, die "Laden" im passenden Reiter übernimmt.
     Zahlen nur aus den Rechnungen des Labs (Hilfe-Beispiel Nonius, ISO-Tabelle, Toleranz-Rechner). */
  const beispiele = [
    { id: 'tb1', tab: 'cal', titel: 'Messschieber 1/20: 23,35 mm', text: 'Hauptskala: 23 mm. Der 7. Strich des 1/20-Nonius deckt sich mit einem Strich der Hauptskala: 7 · 0,05 = 0,35 mm. Messwert 23,35 mm.', set: { den: 20, v: 23.35 } },
    { id: 'tb2', tab: 'mic', titel: 'Bügelmessschraube: 7,38 mm', text: 'Hülse: 7 ganze Millimeter. Auf der Trommel deckt sich der Strich 38 mit der Hülsenlinie: 0,38 mm. Messwert 7,38 mm.', set: { base: 0, v: 7.38 } },
    { id: 'tb3', tab: 'fit', titel: 'Passung Gleitlager H7/f7, Ø25', text: 'Bohrung H7, Welle f7 bei Nennmaß 25 mm: Spielpassung mit Mindestspiel 20 µm und Höchstspiel 62 µm. Im Toleranzfeld-Bild liegt die Welle immer unter der Bohrung.', set: { hole: 'H7', shaft: 'f7', N: '25' } },
    { id: 'tb4', tab: 'calc', titel: 'Toleranz-Rechner: Welle Ø30 −0,010/−0,030, gemessen 29,980 (Gut)', text: 'Höchstmaß 29,990 mm, Mindestmaß 29,970 mm, Toleranz 0,020 mm. Das gemessene Maß 29,980 mm liegt dazwischen: Die Welle ist gut.', set: { part: 'welle', N: '30', hi: '-0,010', lo: '-0,030', unit: 'mm', m: '29,980' } },
    { id: 'tb5', tab: 'calc', titel: 'Toleranz-Rechner: Welle Ø30 −0,010/−0,030, gemessen 29,960 (Ausschuss)', text: 'Gleiche Welle, gemessen 29,960 mm: 10 µm unter dem Mindestmaß. Die Welle ist zu dünn, es fehlt Material: Ausschuss.', set: { part: 'welle', N: '30', hi: '-0,010', lo: '-0,030', unit: 'mm', m: '29,960' } },
    { id: 'tb6', tab: 'calc', titel: 'Toleranz-Rechner: Welle Ø30, gemessen 29,992 (Nacharbeit)', text: 'Gleiche Welle, gemessen 29,992 mm: 2 µm über dem Höchstmaß. Die Welle ist zu dick, Material kann noch abgetragen werden: Nacharbeit.', set: { part: 'welle', N: '30', hi: '-0,010', lo: '-0,030', unit: 'mm', m: '29,992' } }
  ];

  root.TOL_ISO = ISO;
  root.TOL_DATA = { beispiele, tasks, uses, useOptions, devices, cats: ['Ablesen', 'Toleranzen', 'Passungen', 'Messmittel wählen'] };
  root.TOL_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { ISO, DATA: root.TOL_DATA, TASKS: root.TOL_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
