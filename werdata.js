'use strict';
/* Tonfunk Werkstoff-Lab: Daten (Lab-Kennung 'wer').
   WER_DATA: materials (Übungswerte für Kurven), heat (Wärmebehandlungen), groups (Werkstoffwahl), quizzes, tasks.
   window.WER_TASKS: Kurzliste für Karriere/Lernpfad [{id, cat, title, level}]; Status in localStorage 'lm4.wer.done' = {id:true}.
   ALLE KENNWERTE SIND ÜBUNGSWERTE (gerundet, typische Größenordnung), keine garantierten Werkstoffdaten.
   Was Ausbilder Dennis Sett prüfen soll, ist mit PRUEFEN markiert bzw. im Bericht aufgelistet. */
(function (root) {
  /* ---------------- Werkstoffe für den Zugversuch (Übungswerte) ---------------- */
  const materials = [
    { id: 's235', name: 'S235JR', kurz: 'S235JR (Baustahl)', type: 're', E: 210000, Re: 235, Rm: 380, Ag: 18, A: 26, lueders: 1.8, ax: { xmax: 30, xstep: 5, ymax: 450, ystep: 50 },
      info: 'Unlegierter Baustahl mit ausgeprägter Streckgrenze: Die Kurve fällt nach der oberen Streckgrenze ReH kurz ab und die Probe fließt bei fast gleicher Spannung (Lüdersdehnung).' },
    { id: 'c45', name: 'C45+QT', kurz: 'C45+QT (vergütet)', type: 'rp', E: 210000, Rp: 430, Rm: 700, Ag: 8, A: 16, ax: { xmax: 20, xstep: 5, ymax: 800, ystep: 100 },   /* PRUEFEN */
      info: 'Vergüteter Stahl ohne ausgeprägte Streckgrenze: Die Kurve geht fließend vom elastischen in den plastischen Bereich. Als Ersatz gilt die Dehngrenze Rp0,2 (0,2 % bleibende Dehnung).' },
    { id: 'al', name: 'EN AW-6082 T6', kurz: 'EN AW-6082 T6 (Aluminium)', type: 'rp', E: 70000, Rp: 260, Rm: 310, Ag: 7, A: 10, ax: { xmax: 12, xstep: 2, ymax: 350, ystep: 50 },   /* PRUEFEN */
      info: 'Ausgehärtete Aluminium-Legierung: kleiner E-Modul (etwa ein Drittel von Stahl), keine ausgeprägte Streckgrenze, mäßige Bruchdehnung.' },
    { id: 'cu', name: 'Cu-ETP (weich)', kurz: 'Cu-ETP weich (Kupfer)', type: 'rp', E: 120000, Rp: 70, Rm: 220, Ag: 35, A: 45, ax: { xmax: 50, xstep: 10, ymax: 250, ystep: 50 },   /* PRUEFEN */
      info: 'Weichgeglühtes Kupfer: niedrige Dehngrenze, aber starke Verfestigung und sehr große Bruchdehnung. Sehr gut umformbar.' },
    { id: 'gjl', name: 'EN-GJL-200', kurz: 'EN-GJL-200 (Grauguss)', type: 'sprod', E: 100000, Rm: 210, Ag: 0.42, A: 0.42, ax: { xmax: 0.5, xstep: 0.1, ymax: 250, ystep: 50 },   /* PRUEFEN */
      info: 'Grauguss mit Lamellengraphit: spröder Bruch ohne Einschnürung bei unter 1 % Dehnung, keine Streckgrenze, gekrümmte Kurve (der E-Modul ist nur ein grober Anfangswert).' }
  ];

  /* ---------------- Härteprüfung ---------------- */
  const hardness = [
    { id: 'hb', name: 'Brinell (HBW)', body: 'Hartmetallkugel, meist D = 10 mm', measure: 'Durchmesser d des Eindrucks (mit Lupe/Messmikroskop)', good: 'weiche bis mittelharte Werkstoffe, Guss, grobkörnige Gefüge, Baustahl, Aluminium', limit: 'nicht für sehr harte Teile (Kugel verformt sich), nicht für dünne Schichten, großer Eindruck' },
    { id: 'hv', name: 'Vickers (HV)', body: 'vierseitige Diamantpyramide, 136° Spitzenwinkel', measure: 'beide Diagonalen d₁ und d₂ des quadratischen Eindrucks', good: 'alle Werkstoffe, auch sehr hart, kleine und dünne Teile, Randschichten, Schweißnähte (Härteverlauf), Prüfkräfte klein bis groß', limit: 'Oberfläche muss gut vorbereitet (geschliffen/poliert) sein, Auswertung braucht Optik' },
    { id: 'hrc', name: 'Rockwell C (HRC)', body: 'Diamantkegel, 120° Spitzenwinkel', measure: 'bleibende Eindringtiefe h, die Maschine zeigt die Härte direkt an', good: 'gehärtete und vergütete Stähle, Werkstatt und Fertigung (schnell, keine Optik)', limit: 'für weiche Werkstoffe ungeeignet (dann Rockwell B mit Kugel), dünne Teile problematisch' }
  ];
  const hardUses = [
    { title: 'Gehärtete Welle', text: 'In der Werkstatt soll eine gehärtete Welle schnell geprüft werden. Das Ergebnis soll direkt an der Maschine ablesbar sein.', correct: 'Rockwell C (HRC)', why: 'Rockwell C eignet sich für gehärtete Stähle und liefert den Wert sofort an der Anzeige, ohne Eindruck auszumessen.' },
    { title: 'Grauguss-Gehäuse', text: 'Ein weiches, grobkörniges Grauguss-Gehäuse soll geprüft werden.', correct: 'Brinell (HBW)', why: 'Die große Kugel mittelt über das grobe Gefüge (Graphitlamellen). Brinell ist für weiche bis mittelharte Werkstoffe und Guss gedacht.' },
    { title: 'Einsatzgehärtete Randschicht', text: 'Von der Oberfläche bis zum Kern eines einsatzgehärteten Zahnrads soll der Härteverlauf gemessen werden.', correct: 'Vickers (HV)', why: 'Vickers hat sehr kleine Eindrücke bei kleiner Prüfkraft und erlaubt viele Messpunkte dicht nebeneinander im Querschliff.' },
    { title: 'Dünnes Blech', text: 'Ein 0,5 mm dünnes Stahlblech soll geprüft werden.', correct: 'Vickers (HV)', why: 'Der Eindruck muss klein bleiben, damit die Unterlage das Ergebnis nicht verfälscht. Vickers mit kleiner Prüfkraft passt.' },
    { title: 'Weicher Baustahl', text: 'Ein dicker Block aus weichem Baustahl soll an einer ungeschliffenen Stelle auf Durchschnittshärte geprüft werden.', correct: 'Brinell (HBW)', why: 'Brinell mit großer Kugel ist unempfindlich gegen raue Oberflächen und gut für weiche Stähle.' },
    { title: 'Gehärtetes Werkzeug', text: 'Ein gehärteter Meißel (ca. 58 HRC) wird in der Fertigung stichprobenartig geprüft.', correct: 'Rockwell C (HRC)', why: 'Typischer Anwendungsfall von HRC: gehärteter Stahl, schnelle Prüfung, direkte Anzeige.' },
    { title: 'Schweißnaht', text: 'An einem Querschliff soll die Härte in Schweißgut, Wärmeeinflusszone und Grundwerkstoff verglichen werden.', correct: 'Vickers (HV)', why: 'Kleine Eindrücke an genau gewählten Stellen: Vickers (z. B. HV 10) ist hier das übliche Verfahren.' }
  ];
  const hardOptions = ['Brinell (HBW)', 'Vickers (HV)', 'Rockwell C (HRC)'];

  /* ---------------- Bezeichnungen: Beispiele (alle vom Decoder lesbar) ---------------- */
  const nameExamples = ['S235JR', 'E295', 'C45', '16MnCr5', '42CrMo4', 'X5CrNi18-10', 'EN-GJL-200', 'EN-GJS-400-15', 'EN AW-6082', '34CrNiMo6', '11SMn30', 'S355J2'];
  const nameQuizList = ['S235JR', 'E295', 'C45', '16MnCr5', '42CrMo4', 'X5CrNi18-10', 'X40Cr13', 'EN-GJL-200', 'EN AW-6082', '11SMn30', '34CrNiMo6', 'EN-GJS-400-15'];
  const nameInfo = {
    S235JR: 'Baustahl für Konstruktionen, gut schweißbar',
    E295: 'Maschinenbaustahl für Wellen und Achsen',
    C45: 'Vergütungsstahl für Wellen und Zahnräder',
    '16MnCr5': 'Einsatzstahl, z. B. für Zahnräder',
    '42CrMo4': 'Vergütungsstahl für hoch belastete Wellen und Schrauben',
    'X5CrNi18-10': 'nichtrostender Stahl (V2A), Werkstoffnummer 1.4301',
    'EN-GJL-200': 'Grauguss für Gehäuse und Maschinenbetten',
    'EN AW-6082': 'Aluminiumlegierung für tragende Teile'
  };

  /* ---------------- Wärmebehandlung ---------------- */
  /* steps: [Zeit (relativ), Temperatur °C] für das Temperatur-Zeit-Schaubild */
  const heat = [
    { id: 'spann', name: 'Spannungsarmglühen', goal: 'Eigenspannungen nach Schweißen, Zerspanen oder Richten abbauen', temp: 'ca. 550 bis 650 °C, unterhalb A₁ (723 °C)', cool: 'langsam, im Ofen', effect: 'Das Gefüge ändert sich kaum, Härte und Festigkeit bleiben fast gleich. Verzug beim späteren Bearbeiten wird vermieden.', use: 'geschweißte Rahmen, Gussgehäuse vor dem Fertigbearbeiten', steps: [[0, 20], [15, 600], [50, 600], [88, 20]], coolText: 'Ofenabkühlung' },
    { id: 'norm', name: 'Normalglühen', goal: 'grobes oder ungleichmäßiges Gefüge fein und gleichmäßig machen', temp: 'ca. 30 bis 50 °C über A₃ (bei C ≤ 0,8 %), kurz halten', cool: 'an ruhender Luft', effect: 'Feinkörniges, gleichmäßiges Gefüge, bessere Zähigkeit und Festigkeit als im grobkörnigen Zustand.', use: 'Schmiedeteile, Schweißverbindungen, Gussstücke aus Stahl', steps: [[0, 20], [15, 860], [32, 860], [58, 20]], coolText: 'Luftabkühlung' },
    { id: 'weich', name: 'Weichglühen', goal: 'Stahl weich machen, damit er sich besser zerspanen oder kalt umformen lässt', temp: 'ca. 680 bis 750 °C, um A₁ (723 °C) pendelnd', cool: 'langsam, im Ofen', effect: 'Der lamellare Zementit des Perlits wird kugelig (kugeliger Zementit). Härte sinkt, Zerspanbarkeit und Umformbarkeit steigen.', use: 'Stähle mit höherem C-Gehalt (z. B. Werkzeugstähle, Kaltstauchstähle)', steps: [[0, 20], [14, 705], [28, 735], [40, 700], [52, 735], [64, 700], [96, 20]], coolText: 'Ofenabkühlung' },
    { id: 'haerten', name: 'Härten', goal: 'höchste Härte und Verschleißfestigkeit erreichen', temp: 'Austenitisieren: 30 bis 50 °C über A₃ (C ≤ 0,8 %) bzw. über A₁ (C > 0,8 %)', cool: 'schnell abschrecken (Wasser, Öl, Polymer)', effect: 'Austenit wandelt in Martensit um: sehr hart, aber spröde und mit Eigenspannungen. Deshalb folgt fast immer das Anlassen.', use: 'Werkzeuge, Schneiden, Wälzlager (mit anschließendem Anlassen)', steps: [[0, 20], [15, 830], [35, 830], [38, 25], [70, 25]], coolText: 'Abschrecken' },
    { id: 'anlass', name: 'Anlassen', goal: 'nach dem Härten Spannungen abbauen und Zähigkeit gewinnen', temp: 'je nach Ziel ca. 150 bis 650 °C, unterhalb A₁', cool: 'meist an Luft', effect: 'Martensit zerfällt teilweise: Härte sinkt, Zähigkeit steigt, Eigenspannungen werden abgebaut. Je höher die Anlasstemperatur, desto weicher und zäher.', use: 'alle gehärteten Teile: Werkzeuge niedrig, Federn mittel, Vergütungsteile hoch', steps: [[0, 25], [20, 400], [50, 400], [80, 25]], coolText: 'Luftabkühlung' },
    { id: 'verg', name: 'Vergüten', goal: 'hohe Festigkeit bei guter Zähigkeit', temp: 'Härten + hohes Anlassen bei ca. 500 bis 680 °C', cool: 'Härten: abschrecken, danach Anlassen an Luft', effect: 'Gefüge mit fein verteiltem Zementit (Vergütungsgefüge): deutlich zäher als nur gehärteter Stahl bei hoher Festigkeit.', use: 'Wellen, Achsen, Zahnräder, Schrauben aus C45, 42CrMo4', steps: [[0, 20], [10, 840], [22, 840], [24, 30], [40, 600], [60, 600], [88, 30]], coolText: 'Abschrecken, dann Anlassen' },
    { id: 'einsatz', name: 'Einsatzhärten', goal: 'harte, verschleißfeste Oberfläche bei zähem Kern', temp: 'Aufkohlen bei ca. 880 bis 950 °C, dann Härten und niedriges Anlassen (ca. 150 bis 200 °C)', cool: 'abschrecken, dann anlassen', effect: 'Die Randschicht wird mit Kohlenstoff angereichert (bis ca. 0,8 % C) und beim Härten martensitisch. Der kohlenstoffarme Kern (ca. 0,1 bis 0,2 % C) bleibt zäh.', use: 'Zahnräder, Nockenwellen, Bolzen aus Einsatzstählen wie 16MnCr5, C15', steps: [[0, 20], [10, 920], [48, 920], [56, 830], [60, 25], [76, 180], [96, 25]], coolText: 'Aufkohlen, Abschrecken, Anlassen' }
  ];
  const heatGoals = [
    { title: 'Nach dem Schweißen', text: 'Ein geschweißter Rahmen soll vor dem Fertigfräsen spannungsfrei werden, ohne seine Festigkeit zu ändern.', correct: 'Spannungsarmglühen', why: 'Bei 550 bis 650 °C bauen sich Eigenspannungen ab, ohne dass sich das Gefüge wesentlich ändert.' },
    { title: 'Schmiedeteil', text: 'Ein geschmiedetes Teil hat ein grobes, ungleichmäßiges Gefüge.', correct: 'Normalglühen', why: 'Normalglühen über A₃ mit Luftabkühlung ergibt ein feinkörniges, gleichmäßiges Gefüge.' },
    { title: 'Besser zerspanbar', text: 'Ein Werkzeugstahl mit 1 % C ist zum Drehen zu hart.', correct: 'Weichglühen', why: 'Weichglühen um A₁ macht den Zementit kugelig. Der Stahl wird weich und zerspanbar.' },
    { title: 'Maximale Härte', text: 'Eine Schneide soll möglichst hart und verschleißfest werden.', correct: 'Härten', why: 'Austenitisieren und schnelles Abschrecken erzeugt hartes Martensitgefüge. (Anschließend wird angelassen.)' },
    { title: 'Zu spröde', text: 'Ein frisch gehärteter Meißel bricht bei Schlag. Er soll zäher werden und etwas Härte abgeben.', correct: 'Anlassen', why: 'Anlassen baut Spannungen ab und erhöht die Zähigkeit, die Härte sinkt dabei etwas.' },
    { title: 'Hoch belastete Welle', text: 'Eine Welle aus 42CrMo4 braucht hohe Festigkeit bei guter Zähigkeit.', correct: 'Vergüten', why: 'Vergüten = Härten + hohes Anlassen. Das ergibt Festigkeit und Zähigkeit zugleich.' },
    { title: 'Zahnrad', text: 'Ein Zahnrad aus 16MnCr5 soll außen hart und verschleißfest sein, innen aber zäh.', correct: 'Einsatzhärten', why: 'Aufkohlen der Randschicht, dann Härten: harter Rand, zäher kohlenstoffarmer Kern.' }
  ];
  const heatOptions = heat.map(h => h.name);

  /* ---------------- Werkstoffwahl (Bewertung 1 bis 5, Übungswerte) ---------------- */
  const propLabels = { fest: 'fest', zaeh: 'zäh (schlagfest)', korr: 'korrosionsbeständig', zerspan: 'gut zerspanbar', leicht: 'leicht', leit: 'elektrisch leitfähig' };
  const groups = [
    { id: 'bau', name: 'Baustahl (S235JR)', r: { fest: 2, zaeh: 4, korr: 1, zerspan: 3, leicht: 1, leit: 1 }, note: 'preiswert, gut schweißbar, zäh, aber rostet' },
    { id: 'verg', name: 'Vergütungsstahl (42CrMo4)', r: { fest: 5, zaeh: 4, korr: 1, zerspan: 2, leicht: 1, leit: 1 }, note: 'sehr fest und zäh nach dem Vergüten, rostet' },
    { id: 'auto', name: 'Automatenstahl (11SMn30)', r: { fest: 3, zaeh: 2, korr: 1, zerspan: 5, leicht: 1, leit: 1 }, note: 'Schwefel macht kurze Späne: ideal für Drehteile in Serie, nicht für Schlagbelastung' },
    { id: 'nr', name: 'Nichtrostender Stahl (X5CrNi18-10)', r: { fest: 3, zaeh: 5, korr: 5, zerspan: 2, leicht: 1, leit: 1 }, note: 'korrosionsbeständig und zäh, schwerer zu zerspanen' },
    { id: 'guss', name: 'Grauguss (EN-GJL-200)', r: { fest: 2, zaeh: 1, korr: 2, zerspan: 4, leicht: 1, leit: 1 }, note: 'gut gießbar und dämpfend, spröde, nur für Druckbelastung günstig' },
    { id: 'alu', name: 'Aluminium-Legierung (EN AW-6082)', r: { fest: 3, zaeh: 3, korr: 4, zerspan: 4, leicht: 5, leit: 4 }, note: 'leicht (etwa ein Drittel der Dichte von Stahl), korrosionsbeständig, gut leitfähig' },
    { id: 'cu', name: 'Kupfer (Cu-ETP)', r: { fest: 1, zaeh: 4, korr: 4, zerspan: 2, leicht: 1, leit: 5 }, note: 'beste elektrische Leitfähigkeit, weich, schwer' },
    { id: 'ms', name: 'Messing (CuZn39Pb3)', r: { fest: 2, zaeh: 2, korr: 4, zerspan: 5, leicht: 1, leit: 3 }, note: 'sehr gut zerspanbar, korrosionsbeständig, mäßig leitfähig' }
  ];
  const gname = id => groups.find(g => g.id === id).name;
  const wahlCases = [
    { title: 'Antriebswelle', text: 'Eine Antriebswelle wird hoch belastet und muss Stöße aushalten.', w: { fest: 2, zaeh: 2 }, correct: 'verg' },
    { title: 'Drehteile in Serie', text: 'Tausende Normteile sollen schnell gedreht werden, mäßige Festigkeit genügt.', w: { zerspan: 2, fest: 1 }, correct: 'auto' },
    { title: 'Tank in der Lebensmittelindustrie', text: 'Ein Behälter kommt dauernd mit Feuchtigkeit in Kontakt und darf nicht rosten, er muss auch zäh sein.', w: { korr: 2, zaeh: 1 }, correct: 'nr' },
    { title: 'Stromschiene', text: 'Eine Schiene soll Strom verlustarm leiten und in feuchter Luft nicht korrodieren.', w: { leit: 2, korr: 1 }, correct: 'cu' },
    { title: 'Leichter Tragrahmen', text: 'Ein tragender Rahmen soll möglichst leicht und trotzdem fest sein.', w: { leicht: 2, fest: 1 }, correct: 'alu' },
    { title: 'Kühlkörper im Außenbereich', text: 'Ein Kühlkörper soll leicht und witterungsbeständig sein und Wärme/Strom gut leiten.', w: { leicht: 1, korr: 1, leit: 1 }, correct: 'alu' }
  ];

  /* ---------------- Aufgaben ---------------- */
  const num = (unit, label) => ({ type: 'num', unit, label });
  const choice = (choices, correct) => ({ type: 'choice', choices, correct });
  const match = (rows, options) => ({ type: 'match', rows, options });
  const MATN = materials.map(m => m.kurz);
  const WB = ['Spannungsarmglühen', 'Normalglühen', 'Weichglühen', 'Härten', 'Anlassen', 'Vergüten', 'Einsatzhärten'];
  const wc = (ids, c) => choice(ids.map(gname), ids.indexOf(c));

  const T = [
    /* ===== Zugversuch ===== */
    { cat: 'Zugversuch', level: 1, title: 'Spannung berechnen', text: 'Eine Rundprobe mit d₀ = 10 mm wird mit F = 20 kN gezogen. Wie groß ist die Spannung σ = F/S₀?',
      ask: num('N/mm²', 'Spannung σ'), solve: () => ({ value: 254.6, tol: 1 }),
      expl: 'S₀ = π · d²/4 = π · 10²/4 = 78,54 mm². σ = F/S₀ = 20 000 N / 78,54 mm² = 254,6 N/mm². (1 N/mm² = 1 MPa.)',
      tips: ['Die Kraft musst du in N einsetzen: 20 kN = 20 000 N.', 'Zuerst den Querschnitt: S₀ = π · d² / 4 mit d = 10 mm.'] },
    { cat: 'Zugversuch', level: 1, title: 'Dehnung berechnen', text: 'Die Messlänge einer Zugprobe beträgt L₀ = 50 mm. Unter Last wächst sie um ΔL = 0,35 mm. Wie groß ist die Dehnung ε in %?',
      ask: num('%', 'Dehnung ε'), solve: () => ({ value: 0.7, tol: 0.01 }),
      expl: 'ε = ΔL / L₀ · 100 % = 0,35 mm / 50 mm · 100 % = 0,7 %.',
      tips: ['Dehnung = Längenänderung geteilt durch die Anfangs-Messlänge.', '0,35 / 50 = 0,007. Mal 100 ergibt Prozent.'] },
    { cat: 'Zugversuch', level: 1, title: 'Bruchdehnung berechnen', text: 'Eine Probe mit L₀ = 80 mm ist gebrochen. Die zusammengelegten Probenteile messen Lᵤ = 98,4 mm. Wie groß ist die Bruchdehnung A?',
      ask: num('%', 'Bruchdehnung A'), solve: () => ({ value: 23, tol: 0.2 }),
      expl: 'A = (Lᵤ − L₀) / L₀ · 100 % = (98,4 − 80) / 80 · 100 % = 18,4 / 80 · 100 % = 23 %.',
      tips: ['Berechne zuerst die bleibende Verlängerung Lᵤ − L₀.', 'Teile sie durch L₀ = 80 mm und rechne in Prozent um.'] },
    { cat: 'Zugversuch', level: 2, title: 'Längenänderung nach Hooke', text: 'Ein Stahlstab (E = 210 000 N/mm²) mit L₀ = 500 mm wird elastisch mit σ = 140 N/mm² belastet. Wie groß ist die Längenänderung ΔL?',
      ask: num('mm', 'Längenänderung ΔL'), solve: () => ({ value: 0.333, tol: 0.005 }),
      expl: 'Hooke: ε = σ/E = 140/210 000 = 0,000667 (0,0667 %). ΔL = ε · L₀ = 0,000667 · 500 mm = 0,333 mm.',
      tips: ['Im elastischen Bereich gilt σ = E · ε. Löse nach ε auf.', 'ε = 140 / 210 000. Danach mit L₀ multiplizieren, um ΔL in mm zu erhalten.'] },
    { cat: 'Zugversuch', level: 1, chart: 's235', title: 'Streckgrenze ablesen', text: 'Lies im Diagramm für S235JR die obere Streckgrenze Re (den ersten Gipfel der Kurve) ab.',
      ask: num('N/mm²', 'Streckgrenze Re'), solve: () => ({ value: 235, tol: 10 }),
      expl: 'Die Kurve steigt linear bis zum ersten Gipfel und fällt dann leicht ab: Das ist die obere Streckgrenze Re = 235 N/mm² (der Name S235 verrät den Wert). Danach fließt die Probe.',
      tips: ['Suche den Punkt, an dem die Gerade endet und die Probe zu fließen beginnt.', 'Der Name S235JR enthält die Zahl bereits. Prüfe sie am Diagramm.'] },
    { cat: 'Zugversuch', level: 2, chart: 'c45', title: 'Zugfestigkeit ablesen', text: 'Lies im Diagramm für C45+QT die Zugfestigkeit Rm ab (höchster Punkt der Kurve).',
      ask: num('N/mm²', 'Zugfestigkeit Rm'), solve: () => ({ value: 700, tol: 20 }),
      expl: 'Rm ist die Spannung am Höchstpunkt der Kurve (Höchstkraft bezogen auf S₀): etwa 700 N/mm². Danach beginnt die Einschnürung.',
      tips: ['Rm gehört zur Höchstkraft, also zum höchsten Punkt der Kurve.', 'Gehe vom Gipfel waagerecht nach links zur Spannungsachse.'] },
    { cat: 'Zugversuch', level: 2, chart: 'al', title: 'Dehngrenze ablesen', text: 'Der Aluminiumwerkstoff EN AW-6082 T6 hat keine ausgeprägte Streckgrenze. Lies die Dehngrenze Rp0,2 ab. Tipp: Mit der Taste „Parallele 0,2 %“ zeichnest du die Parallele zur Hookeschen Geraden ab 0,2 % Dehnung ein.',
      ask: num('N/mm²', 'Dehngrenze Rp0,2'), solve: () => ({ value: 260, tol: 10 }),
      expl: 'Rp0,2 ist die Spannung, bei der nach Entlastung 0,2 % bleibende Dehnung bleibt: Die Parallele zur Anfangsgeraden, bei ε = 0,2 % beginnend, schneidet die Kurve bei etwa 260 N/mm².',
      tips: ['Rp0,2 gilt als Ersatz-Streckgrenze, wenn die Kurve fließend übergeht.', 'Parallele zur elastischen Geraden durch ε = 0,2 % ziehen. Der Schnittpunkt mit der Kurve liefert Rp0,2.'] },
    { cat: 'Zugversuch', level: 1, title: 'Spröden Werkstoff erkennen', text: 'Welcher dieser Werkstoffe bricht ohne Einschnürung und mit weniger als 1 % Bruchdehnung?',
      ask: choice(MATN, 4), solve: () => ({ correct: 4 }),
      expl: 'Grauguss (EN-GJL-200) ist spröde: Die Kurve endet nach sehr kleiner Dehnung im Höchstpunkt, es gibt weder Streckgrenze noch Einschnürung. Stahl, Aluminium und Kupfer sind zäh und schnüren vor dem Bruch ein.',
      tips: ['Spröde Werkstoffe verformen sich kaum plastisch.', 'Denke an einen Werkstoff mit Graphitlamellen im Gefüge.'] },
    { cat: 'Zugversuch', level: 3, title: 'E-Modul aus dem Anstieg', text: 'Im elastischen Bereich einer Aluminium-Probe steigt die Spannung um Δσ = 140 N/mm², dabei wächst die Dehnung um Δε = 0,2 %. Wie groß ist der Elastizitätsmodul E?',
      ask: num('N/mm²', 'E-Modul'), solve: () => ({ value: 70000, tol: 500 }),
      expl: 'E ist der Anstieg der Hookeschen Geraden: E = Δσ / Δε = 140 N/mm² / 0,002 = 70 000 N/mm². Dehnung in % muss vorher durch 100 geteilt werden.',
      tips: ['E = Δσ / Δε (Steigung der Geraden im σ-ε-Diagramm).', 'Rechne 0,2 % um in 0,002, bevor du teilst.'] },
    { cat: 'Zugversuch', level: 2, title: 'Höchstkraft berechnen', text: 'Eine Rundprobe mit d₀ = 12 mm hat die Zugfestigkeit Rm = 360 N/mm². Bei welcher Höchstkraft Fm in kN reißt sie?',
      ask: num('kN', 'Höchstkraft Fm'), solve: () => ({ value: 40.7, tol: 0.2 }),
      expl: 'S₀ = π · 12²/4 = 113,1 mm². Fm = Rm · S₀ = 360 N/mm² · 113,1 mm² = 40 715 N, also 40,7 kN.',
      tips: ['Umgestellt: Rm = Fm / S₀, also Fm = Rm · S₀.', 'S₀ = π · d²/4. Das Ergebnis in N durch 1000 teilen für kN.'] },
    { cat: 'Zugversuch', level: 2, title: 'Zulässige Spannung', text: 'Ein Bauteil aus S235JR (Re = 235 N/mm²) soll mit der Sicherheit S = 1,5 gegen Fließen ausgelegt werden. Wie groß ist die zulässige Spannung σzul = Re / S?',
      ask: num('N/mm²', 'σzul'), solve: () => ({ value: 156.7, tol: 0.5 }),
      expl: 'σzul = Re / S = 235 N/mm² / 1,5 = 156,7 N/mm². Das Bauteil bleibt damit weit unterhalb der Streckgrenze.',
      tips: ['Teile die Streckgrenze durch die Sicherheitszahl.', '235 / 1,5 ergibt etwa 157.'] },
    { cat: 'Zugversuch', level: 2, title: 'Streckgrenze oder Dehngrenze?', text: 'Der vergütete Stahl C45+QT hat keine ausgeprägte Streckgrenze. Welche Kenngröße verwendet man stattdessen?',
      ask: choice(['Rm (Zugfestigkeit)', 'Rp0,2 (0,2 %-Dehngrenze)', 'A (Bruchdehnung)', 'E (Elastizitätsmodul)'], 1), solve: () => ({ correct: 1 }),
      expl: 'Bei fließendem Übergang gilt die 0,2 %-Dehngrenze Rp0,2: die Spannung, bei der 0,2 % bleibende Dehnung auftreten. Rm ist die Höchstspannung, A die Bruchdehnung, E der Anstieg.',
      tips: ['Es geht um die Grenze zwischen elastischem und plastischem Bereich.', 'Die gesuchte Größe beginnt mit „Rp“ und bezieht sich auf 0,2 % bleibende Dehnung.'] },

    /* ===== Härte ===== */
    { cat: 'Härte', level: 2, title: 'Brinellhärte berechnen', text: 'Brinellprüfung mit Hartmetallkugel D = 10 mm und Prüfkraft F = 29 420 N (HBW 10/3000). Der Eindruckdurchmesser ist d = 4,0 mm. Wie groß ist HBW? HBW = 0,102 · 2F / (π · D · (D − √(D² − d²)))',
      ask: num('HBW', 'Brinellhärte'), solve: () => ({ value: 229, tol: 3 }),
      expl: '√(D² − d²) = √(100 − 16) = 9,165 mm. D − 9,165 = 0,835 mm. Nenner: π · 10 · 0,835 = 26,23. Zähler: 0,102 · 2 · 29 420 = 6002. HBW = 6002 / 26,23 ≈ 229.',
      tips: ['Rechne zuerst die Wurzel √(D² − d²) aus: √(100 − 16).', 'Setze alles in die Formel ein: Zähler 0,102 · 2 · F, Nenner π · D · (D − Wurzel).'] },
    { cat: 'Härte', level: 1, title: 'Zugfestigkeit aus Brinellhärte', text: 'Ein unlegierter Stahl hat 200 HBW. Wie groß ist die Zugfestigkeit ungefähr (Faustformel Rm ≈ 3,5 · HB)?',
      ask: num('N/mm²', 'Zugfestigkeit Rm'), solve: () => ({ value: 700, tol: 10 }),
      expl: 'Rm ≈ 3,5 · HB = 3,5 · 200 = 700 N/mm². Das ist nur ein Richtwert für Stähle, kein Ersatz für einen Zugversuch.',
      tips: ['Multipliziere die Brinellhärte mit 3,5.', 'Die Faustformel gilt nur für Stahl und nur als Richtwert.'] },
    { cat: 'Härte', level: 3, title: 'Vickershärte berechnen', text: 'Vickersprüfung HV 10 (F = 98,07 N). Beide Diagonalen messen 0,25 mm. Wie groß ist die Härte? HV = 0,1891 · F / d² (F in N, d = Mittelwert der Diagonalen in mm)',
      ask: num('HV', 'Vickershärte'), solve: () => ({ value: 296.7, tol: 4 }),
      expl: 'd² = 0,25² = 0,0625 mm². HV = 0,1891 · 98,07 / 0,0625 = 296,7, also etwa 297 HV 10.',
      tips: ['Quadriere zuerst die mittlere Diagonale: 0,25² = 0,0625.', 'HV = 0,1891 · 98,07 geteilt durch 0,0625.'] },
    { cat: 'Härte', level: 2, title: 'Rockwell C berechnen', text: 'Bei einer Rockwell-C-Prüfung beträgt die bleibende Eindringtiefe h = 0,090 mm. Wie groß ist die Härte? HRC = 100 − h / 0,002 mm',
      ask: num('HRC', 'Rockwellhärte'), solve: () => ({ value: 55, tol: 0.5 }),
      expl: 'h / 0,002 mm = 0,090 / 0,002 = 45. HRC = 100 − 45 = 55. Je härter der Werkstoff, desto kleiner die Eindringtiefe.',
      tips: ['Teile h durch 0,002 mm: Das sind die Skalenteile.', 'Ziehe die Skalenteile von 100 ab.'] },
    { cat: 'Härte', level: 1, title: 'Verfahren für gehärtete Welle', text: 'Welches Verfahren eignet sich, um eine gehärtete Stahlwelle in der Werkstatt schnell zu prüfen (direkte Anzeige an der Maschine)?',
      ask: choice(hardOptions, 2), solve: () => ({ correct: 2 }),
      expl: 'Rockwell C mit Diamantkegel ist das Standardverfahren für gehärtete Stähle: schnell, mit direkter Anzeige und ohne Ausmessen eines Eindrucks.',
      tips: ['Das Verfahren soll für sehr harte Teile geeignet sein, die Kugel von Brinell würde sich verformen.', 'Es zeigt den Wert direkt an, ohne Diagonalen oder Durchmesser zu messen.'] },
    { cat: 'Härte', level: 2, title: 'Härteverlauf in der Randschicht', text: 'Von der Oberfläche bis in den Kern eines einsatzgehärteten Bolzens soll der Härteverlauf mit vielen dicht liegenden Messpunkten ermittelt werden. Welches Verfahren passt?',
      ask: choice(hardOptions, 1), solve: () => ({ correct: 1 }),
      expl: 'Vickers mit kleiner Prüfkraft erzeugt sehr kleine Eindrücke, die dicht nebeneinander gesetzt werden können. Brinell hätte zu große Eindrücke, Rockwell liefert keinen feinen Verlauf.',
      tips: ['Wichtig sind kleine Eindrücke.', 'Der Eindruck wird mit Mikroskop ausgemessen: zwei Diagonalen.'] },
    { cat: 'Härte', level: 2, title: 'Grauguss prüfen', text: 'Ein weiches, grobkörniges Grauguss-Gehäuse soll auf seine Härte geprüft werden. Welches Verfahren ist üblich?',
      ask: choice(hardOptions, 0), solve: () => ({ correct: 0 }),
      expl: 'Brinell mit großer Kugel mittelt über das grobe Gefüge mit den Graphitlamellen. Für weiche bis mittelharte Werkstoffe und Guss ist HBW das übliche Verfahren.',
      tips: ['Ein großer Eindruck mittelt über ein grobes Gefüge.', 'Eine Kugel als Eindringkörper, Ergebnis in HBW.'] },

    /* ===== Bezeichnungen ===== */
    { cat: 'Bezeichnungen', level: 1, title: 'S235JR: Streckgrenze', text: 'Ein Stahl heißt S235JR. Wie groß ist seine Mindest-Streckgrenze Re?',
      ask: num('N/mm²', 'Streckgrenze Re'), solve: () => ({ value: 235, tol: 0.5 }),
      expl: 'S = Stahl für den Stahlbau, 235 = Mindest-Streckgrenze in N/mm², JR = Kerbschlagarbeit 27 J bei +20 °C.',
      tips: ['Bei Namen, die mit S beginnen, folgt die Mindest-Streckgrenze.', 'Es sind die drei Ziffern nach dem Buchstaben.'] },
    { cat: 'Bezeichnungen', level: 1, title: 'C45: Kohlenstoffgehalt', text: 'Wie viel Prozent Kohlenstoff enthält der Stahl C45?',
      ask: num('%', 'C-Gehalt'), solve: () => ({ value: 0.45, tol: 0.001 }),
      expl: 'Bei Stählen nach C-Gehalt gibt die Zahl das Hundertfache des Kohlenstoffgehalts an: 45 / 100 = 0,45 % C.',
      tips: ['Die Zahl hinter dem C ist nicht der Gehalt selbst.', 'Teile die Zahl durch 100.'] },
    { cat: 'Bezeichnungen', level: 2, title: '16MnCr5: Gruppe', text: 'Zu welcher Werkstoffgruppe gehört 16MnCr5 (Einsatzstahl für Zahnräder)?',
      ask: choice(['Unlegierter Baustahl', 'Niedrig legierter Stahl', 'Hoch legierter Stahl', 'Gusseisen'], 1), solve: () => ({ correct: 1 }),
      expl: 'Der Name beginnt mit einer Zahl (0,16 % C), danach folgen Legierungselemente (Mangan, Chrom) und eine Kennzahl. Alle Legierungselemente liegen unter 5 %: niedrig legierter Stahl.',
      tips: ['Beginnt der Name mit einem X, wäre der Stahl hoch legiert. Hier nicht.', 'Zahl + Elementsymbole + Kennzahl bedeutet niedrig legiert (Gehalt unter 5 %).'] },
    { cat: 'Bezeichnungen', level: 2, title: 'X5CrNi18-10: Nickel', text: 'Der nichtrostende Stahl X5CrNi18-10 (V2A). Wie viel Prozent Nickel enthält er etwa?',
      ask: num('%', 'Nickelgehalt'), solve: () => ({ value: 10, tol: 0.01 }),
      expl: 'Bei hoch legierten Stählen stehen die Gehalte direkt in Prozent, in der Reihenfolge der Elemente: Cr 18 %, Ni 10 %. Die 5 vorn bedeutet 0,05 % C.',
      tips: ['Das X zeigt: hoch legiert, Gehalte direkt in Prozent.', 'Elemente CrNi, Zahlen 18-10: Das zweite Element gehört zur zweiten Zahl.'] },
    { cat: 'Bezeichnungen', level: 3, title: '42CrMo4: Chromgehalt', text: 'Der Vergütungsstahl 42CrMo4: Chrom hat den Faktor 4. Wie viel Prozent Chrom enthält er etwa?',
      ask: num('%', 'Chromgehalt'), solve: () => ({ value: 1, tol: 0.01 }),
      expl: 'Bei niedrig legierten Stählen wird die Kennzahl (hier 4) durch den Faktor des Elements geteilt: Cr 4 / 4 = 1 % Chrom. Molybdän ist nur in kleinem Gehalt (rund 0,2 bis 0,3 %) vorhanden und steht ohne Kennzahl im Namen. Kohlenstoff: 42 / 100 = 0,42 %.',
      tips: ['Die Kennzahl hinter den Elementen ist nicht der Prozentgehalt.', 'Teile die Kennzahl durch den Faktor 4 (gilt für Cr, Mn, Ni, Si).'] },
    { cat: 'Bezeichnungen', level: 2, title: 'EN-GJL-200 entschlüsseln', text: 'Ordne den Teilen des Namens EN-GJL-200 die Bedeutung zu.',
      ask: match([['EN-GJ', 0], ['L', 1], ['200', 2]], ['Gusseisen', 'Lamellengraphit (Grauguss)', 'Mindest-Zugfestigkeit 200 N/mm²', 'Mindest-Streckgrenze 200 N/mm²']), solve: () => ({}),
      expl: 'EN-GJ = Gusseisen (G Guss, J Eisen). L = Lamellengraphit (Grauguss), S wäre Kugelgraphit. 200 = Mindest-Zugfestigkeit Rm in N/mm² (nicht Streckgrenze, Grauguss hat keine).',
      tips: ['GJ steht für Guss und Eisen.', 'Bei Gusseisen gibt die Zahl die Zugfestigkeit an, weil Grauguss keine Streckgrenze hat.'] },
    { cat: 'Bezeichnungen', level: 2, title: 'Namen den Gruppen zuordnen', text: 'Ordne jeden Werkstoff seiner Gruppe zu.',
      ask: match([['S235JR', 0], ['42CrMo4', 1], ['X5CrNi18-10', 2], ['EN-GJL-200', 3]], ['Baustahl, unlegiert', 'niedrig legierter Stahl', 'hoch legierter Stahl', 'Gusseisen']), solve: () => ({}),
      expl: 'S235JR: Baustahl nach Streckgrenze. 42CrMo4: Zahl + Elemente, alle unter 5 %, also niedrig legiert. X5CrNi18-10: X, hoch legiert (Cr 18 %, Ni 10 %). EN-GJL-200: Gusseisen mit Lamellengraphit.',
      tips: ['Das X vorn steht für hoch legiert, EN-GJ für Gusseisen.', 'S + Zahl: Baustahl. Zahl + Elemente + Kennzahl: niedrig legiert.'] },
    { cat: 'Bezeichnungen', level: 2, title: 'Was bedeutet JR?', text: 'Der Stahl S235JR hat die Gütegruppe JR. Was bedeutet sie?',
      ask: choice(['Kerbschlagarbeit 27 J bei +20 °C', 'Rockwellhärte J', 'Rm mindestens 27 N/mm²', 'rostträge'], 0), solve: () => ({ correct: 0 }),
      expl: 'JR, J0, J2, K2 geben an, bei welcher Prüftemperatur welche Kerbschlagarbeit gewährleistet ist. JR: 27 J bei +20 °C (R = Raumtemperatur), J0: bei 0 °C, J2: bei −20 °C.',
      tips: ['Es hat mit der Zähigkeit bei einer bestimmten Temperatur zu tun.', 'Kerbschlagarbeit in Joule (J), R = Raumtemperatur.'] },

    /* ===== Gefüge und Wärmebehandlung ===== */
    { cat: 'Gefüge und Wärmebehandlung', level: 1, title: 'A₁-Temperatur', text: 'Bei welcher Temperatur liegt die A₁-Linie (eutektoide Umwandlung) im vereinfachten Eisen-Kohlenstoff-Diagramm?',
      ask: num('°C', 'Temperatur A₁'), solve: () => ({ value: 723, tol: 1 }),
      expl: 'Bei 723 °C wandelt sich Austenit beim Abkühlen in Ferrit und Zementit (Perlit) um. Bei 0,8 % C geschieht das vollständig (eutektoider Punkt).',
      tips: ['Es ist die waagerechte Linie im Diagramm, die den Austenit nach unten abgrenzt.', 'Die Temperatur ist rund 720 °C: genau 723.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 1, title: 'Gefüge bei 0,8 % C', text: 'Ein Stahl mit 0,8 % C wird langsam auf Raumtemperatur abgekühlt. Welches Gefüge liegt vor?',
      ask: choice(['Ferrit', 'Perlit', 'Perlit + Zementit', 'Austenit'], 1), solve: () => ({ correct: 1 }),
      expl: 'Bei 0,8 % C (eutektoide Zusammensetzung) zerfällt der Austenit komplett in Perlit, ein feines Gemisch aus Ferrit- und Zementitlamellen.',
      tips: ['0,8 % C ist der eutektoide Punkt.', 'Hier gibt es weder freies Ferrit noch freien Zementit.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Gefüge von C45', text: 'Welches Gefüge hat der Stahl C45 (0,45 % C) langsam abgekühlt bei Raumtemperatur?',
      ask: choice(['Nur Ferrit', 'Nur Perlit', 'Ferrit + Perlit', 'Perlit + Zementit'], 2), solve: () => ({ correct: 2 }),
      expl: 'Unter 0,8 % C (untereutektoid) scheidet sich zuerst Ferrit aus, der Rest wandelt bei 723 °C in Perlit um: Ferrit + Perlit.',
      tips: ['0,45 % liegt unter 0,8 %.', 'Untereutektoide Stähle enthalten Ferrit und Perlit.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Perlitanteil', text: 'Ein langsam abgekühlter Stahl hat 0,4 % C. Wie groß ist nach dem vereinfachten Lehrmodell der Perlitanteil (reiner Perlit hat 0,8 % C)?',
      ask: num('%', 'Perlitanteil'), solve: () => ({ value: 50, tol: 1 }),
      expl: 'Perlitanteil = C-Gehalt / 0,8 · 100 % = 0,4 / 0,8 · 100 % = 50 %. Die anderen 50 % sind Ferrit.',
      tips: ['Perlit hat 0,8 % C, Ferrit praktisch 0 %.', 'Teile den C-Gehalt des Stahls durch 0,8.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 3, title: 'A₃-Temperatur bei 0,4 % C', text: 'Wie hoch liegt die A₃-Temperatur bei 0,4 % C im vereinfachten Diagramm (gerade Linie von 911 °C bei 0 % C bis 723 °C bei 0,8 % C)?',
      ask: num('°C', 'Temperatur A₃'), solve: () => ({ value: 817, tol: 5 }),
      expl: 'Die Linie fällt in 0,8 % C um 911 − 723 = 188 °C, das sind 235 °C je 1 % C. A₃ = 911 − 235 · 0,4 = 911 − 94 = 817 °C. (Im echten Diagramm ist die Linie leicht gekrümmt.)',
      tips: ['Berechne, wie viel die Linie je 1 % Kohlenstoff fällt.', '188 °C auf 0,8 % ergibt 235 °C je 1 %. Mal 0,4, dann von 911 abziehen.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 3, title: 'Zementitanteil bei 1,2 % C', text: 'Ein Werkzeugstahl mit 1,2 % C wird langsam abgekühlt. Zementit hat 6,67 % C, Perlit 0,8 % C. Wie groß ist der Zementitanteil (Lehrmodell, Hebelgesetz)?',
      ask: num('%', 'Zementitanteil'), solve: () => ({ value: 6.8, tol: 0.3 }),
      expl: 'Zementitanteil = (C − 0,8) / (6,67 − 0,8) · 100 % = 0,4 / 5,87 · 100 % = 6,8 %. Der Rest (rund 93 %) ist Perlit.',
      tips: ['Hebelgesetz: Abstand des Stahls von Perlit geteilt durch den Abstand Zementit–Perlit.', '(1,2 − 0,8) / (6,67 − 0,8) · 100 %.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 1, title: 'Spannungen abbauen', text: 'Ein geschweißter Rahmen soll vor dem Fertigfräsen spannungsfrei werden, ohne dass sich das Gefüge wesentlich ändert. Welche Behandlung?',
      ask: choice(WB, 0), solve: () => ({ correct: 0 }),
      expl: 'Spannungsarmglühen bei ca. 550 bis 650 °C (unter A₁) baut Eigenspannungen ab, die Härte ändert sich kaum.',
      tips: ['Das Gefüge soll sich nicht ändern, also bleibt die Temperatur unter A₁.', 'Der Name der Behandlung sagt, was sie tut: Spannungen werden „arm“.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Besser zerspanbar machen', text: 'Ein Werkzeugstahl mit 1 % C lässt sich schlecht drehen, weil er zu hart ist. Welche Behandlung macht ihn zerspanbar?',
      ask: choice(WB, 2), solve: () => ({ correct: 2 }),
      expl: 'Weichglühen (um A₁ pendelnd) wandelt den lamellaren Zementit in kugeligen Zementit. Der Stahl wird weich, zerspanbar und umformbar.',
      tips: ['Das Ziel ist ein weicher Stahl.', 'Geglüht wird bei etwa 700 °C, um A₁ herum.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Zahnrad mit hartem Rand', text: 'Ein Zahnrad aus 16MnCr5 soll außen sehr hart und verschleißfest sein, innen aber zäh bleiben. Welche Behandlung?',
      ask: choice(WB, 6), solve: () => ({ correct: 6 }),
      expl: 'Einsatzhärten: Die Randschicht wird aufgekohlt (bis ca. 0,8 % C) und dann gehärtet. Der kohlenstoffarme Kern bleibt zäh. 16MnCr5 hat nur 0,16 % C und wäre ohne Aufkohlen kaum härtbar.',
      tips: ['Härten allein würde bei 0,16 % C keine hohe Härte geben.', 'Dem Rand wird zuerst Kohlenstoff zugeführt.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Behandlung und Wirkung', text: 'Ordne jeder Wärmebehandlung ihre Hauptwirkung zu.',
      ask: match([['Härten', 0], ['Anlassen', 1], ['Normalglühen', 2], ['Weichglühen', 3]], ['Martensit: sehr hart und spröde', 'Zähigkeit steigt, Härte sinkt', 'feinkörniges, gleichmäßiges Gefüge', 'weich, gut zerspanbar (kugeliger Zementit)']), solve: () => ({}),
      expl: 'Härten (abschrecken) erzeugt Martensit. Anlassen macht gehärteten Stahl zäher. Normalglühen mit Luftabkühlung gibt ein feines, gleichmäßiges Gefüge. Weichglühen macht den Zementit kugelig.',
      tips: ['Härten und Anlassen gehören zusammen: erst hart, dann zäher.', 'Normalglühen = feines Korn, Weichglühen = weich.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 1, title: 'Was ist Vergüten?', text: 'Wie ist das Vergüten festgelegt?',
      ask: choice(['Härten und anschließendes hohes Anlassen', 'Nur Abschrecken in Wasser', 'Aufkohlen der Randschicht', 'Langsames Abkühlen im Ofen'], 0), solve: () => ({ correct: 0 }),
      expl: 'Vergüten = Härten + Anlassen bei hoher Temperatur (ca. 500 bis 680 °C). Ergebnis: hohe Festigkeit bei guter Zähigkeit.',
      tips: ['Vergüten besteht aus zwei Schritten.', 'Nach dem Abschrecken wird heiß angelassen.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 2, title: 'Wirkung der Anlasstemperatur', text: 'Ein gehärtetes Teil wird bei höherer Temperatur angelassen. Was passiert?',
      ask: choice(['Härte sinkt, Zähigkeit steigt', 'Härte steigt, Zähigkeit sinkt', 'beides steigt', 'beides bleibt gleich'], 0), solve: () => ({ correct: 0 }),
      expl: 'Je höher die Anlasstemperatur, desto stärker zerfällt der Martensit: Das Teil wird weicher und zäher. Niedriges Anlassen (ca. 200 °C) behält viel Härte, hohes Anlassen (ca. 600 °C) macht zäh.',
      tips: ['Betrachte das Anlassdiagramm: Härte und Zähigkeit verlaufen gegensinnig.', 'Stelle dir einen Meißel vor, der bei Schlag nicht brechen soll.'] },
    { cat: 'Gefüge und Wärmebehandlung', level: 3, title: 'Härtetemperatur für C45', text: 'In welchem Temperaturbereich liegt nach dem Lehrmodell die Härtetemperatur von C45 (0,45 % C)? Faustregel: 30 bis 50 °C über A₃.',
      ask: choice(['700 bis 720 °C', '750 bis 770 °C', '835 bis 855 °C', '950 bis 1000 °C'], 2), solve: () => ({ correct: 2 }),
      expl: 'A₃ bei 0,45 % C: 911 − 235 · 0,45 = 805 °C. Härtetemperatur: 805 + 30 bis 50 = 835 bis 855 °C. (Tabellenbuch: C45 ca. 820 bis 860 °C.)',
      tips: ['Berechne zuerst A₃ für 0,45 % C.', 'Addiere dann 30 bis 50 °C.'] },

    /* ===== Werkstoffwahl ===== */
    { cat: 'Werkstoffwahl', level: 2, title: 'Hoch belastete Antriebswelle', text: 'Eine Antriebswelle wird hoch belastet und muss Stöße aushalten. Gefordert sind: fest und zäh. Welche Werkstoffgruppe passt am besten?',
      ask: wc(['bau', 'verg', 'auto', 'guss'], 'verg'), solve: () => ({ correct: 1 }),
      expl: 'Vergütungsstahl (42CrMo4) ist sehr fest (5 von 5) und zäh (4 von 5). Baustahl ist weniger fest, Automatenstahl und Grauguss sind weniger zäh.',
      tips: ['Es müssen zwei Eigenschaften zugleich erfüllt sein.', 'Hohe Festigkeit und Zähigkeit erreicht man durch Vergüten.'] },
    { cat: 'Werkstoffwahl', level: 2, title: 'Drehteile in Serie', text: 'Tausende Normteile sollen schnell gedreht werden. Gefordert sind: gut zerspanbar und mäßig fest. Welche Gruppe passt am besten?',
      ask: wc(['auto', 'nr', 'verg', 'alu'], 'auto'), solve: () => ({ correct: 0 }),
      expl: 'Automatenstahl (z. B. 11SMn30) hat durch den Schwefelgehalt kurze Späne und beste Zerspanbarkeit. Nichtrostender Stahl und Vergütungsstahl sind schwerer zu zerspanen.',
      tips: ['Es geht vor allem um die Bearbeitung auf der Drehmaschine.', 'Schwefel im Stahl bricht die Späne.'] },
    { cat: 'Werkstoffwahl', level: 2, title: 'Behälter im Nassbereich', text: 'Ein Behälter kommt dauernd mit Feuchtigkeit in Kontakt. Gefordert sind: korrosionsbeständig und zäh. Welche Gruppe?',
      ask: wc(['bau', 'nr', 'guss', 'cu'], 'nr'), solve: () => ({ correct: 1 }),
      expl: 'Nichtrostender Stahl (X5CrNi18-10) ist korrosionsbeständig (5) und zäh (5). Baustahl und Grauguss rosten, Kupfer ist weich.',
      tips: ['Die Chromgehalte über 12 % bilden eine Schutzschicht.', 'Welche Stahlgruppe heißt „nichtrostend“?'] },
    { cat: 'Werkstoffwahl', level: 1, title: 'Stromschiene', text: 'Eine Schiene soll Strom verlustarm leiten und in feuchter Luft nicht korrodieren. Gefordert sind: elektrisch leitfähig und korrosionsbeständig. Welche Gruppe?',
      ask: wc(['cu', 'alu', 'bau', 'ms'], 'cu'), solve: () => ({ correct: 0 }),
      expl: 'Kupfer hat die beste elektrische Leitfähigkeit (5) und ist korrosionsbeständig (4). Aluminium leitet etwas schlechter, Stahl schlecht.',
      tips: ['Welcher Werkstoff wird in Kabeln verwendet?', 'Es ist ein Schwermetall mit roter Farbe.'] },
    { cat: 'Werkstoffwahl', level: 2, title: 'Leichter Tragrahmen', text: 'Ein tragender Rahmen soll möglichst leicht und trotzdem fest sein. Gefordert sind: leicht und fest. Welche Gruppe?',
      ask: wc(['nr', 'alu', 'bau', 'cu'], 'alu'), solve: () => ({ correct: 1 }),
      expl: 'Aluminium-Legierungen sind leicht (Dichte etwa ein Drittel von Stahl) und ausgehärtet recht fest. Stahl und Kupfer sind deutlich schwerer.',
      tips: ['Es kommt auf geringe Dichte an.', 'Der Werkstoff liegt bei etwa 2,7 g/cm³.'] },
    { cat: 'Werkstoffwahl', level: 3, title: 'Kühlkörper im Außenbereich', text: 'Ein Kühlkörper soll leicht und witterungsbeständig sein und Wärme und Strom gut leiten. Gefordert sind: leicht, korrosionsbeständig und leitfähig. Welche Gruppe (Punktebewertung beachten)?',
      ask: wc(['cu', 'alu', 'nr', 'ms'], 'alu'), solve: () => ({ correct: 1 }),
      expl: 'Aluminium erreicht leicht 5 + korrosionsbeständig 4 + leitfähig 4 = 13 Punkte. Kupfer kommt nur auf 1 + 4 + 5 = 10, weil es schwer ist. Messing und Edelstahl liegen noch niedriger.',
      tips: ['Rechne für jede Gruppe die Punkte der drei Anforderungen zusammen.', 'Kupfer leitet besser, aber ist schwer: Es verliert bei „leicht“ viele Punkte.'] }
  ];
  const tasks = T.map((t, i) => Object.assign({ id: 'wer' + (i + 1) }, t));

  root.WER_DATA = { materials, hardness, hardUses, hardOptions, nameExamples, nameQuizList, nameInfo, heat, heatGoals, heatOptions, groups, propLabels, wahlCases, tasks, cats: ['Zugversuch', 'Härte', 'Bezeichnungen', 'Gefüge und Wärmebehandlung', 'Werkstoffwahl'] };
  root.WER_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.WER_DATA, TASKS: root.WER_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
