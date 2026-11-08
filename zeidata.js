'use strict';
/* Tonfunk Zeichnungs-Lab: Daten (ZEI_DATA: Körper, Linienarten, Regeln, Aufgaben, Beispiele; ZEI_TASKS: Kurzliste).
   Körper als Schichten lay[z][r] (z=0 unten; Zeile r=0 ist HINTEN, letzte Zeile ist VORN, so wie in der Draufsicht gezeichnet; '#' = Material).
   holes: Durchgangsbohrungen (im Modell eckig, für die Mittellinien): ax = Achse, from/to = Würfelschichten entlang der Achse.
   u = Millimeter je Würfel (für die Bemaßung der Beispiele). */
(function (root) {
  const models = {
    wuerfel: { title: 'Würfel', lay: [['#']] },
    winkel: { title: 'Winkel mit Bohrung', note: 'Winkel 40 × 30 × 30 mm mit Durchgangsbohrung (hier eckig gezeichnet)',
      lay: [['####', '##.#', '####'], ['#...', '#...', '#...'], ['#...', '#...', '#...']], holes: [{ ax: 'z', x: 2, y: 1, from: 0, to: 1 }] },
    treppe: { title: 'Treppe', note: 'Drei Stufen nebeneinander, nach rechts abfallend', lay: [['###', '###'], ['##.', '##.'], ['#..', '#..']] },
    stufenblock: { title: 'Stufenblock', note: 'Block mit einer Stufe und einem Absatz in der Draufsicht',
      lay: [['####', '####', '####'], ['##..', '#...', '....']] },
    nutenstein: { title: 'Nutenstein', note: 'Breiter Fuß, schmaler Hals, Bohrung durch beide Teile (vereinfacht eckig)',
      lay: [['#####', '##.##', '#####'], ['.###.', '.#.#.', '.###.']], holes: [{ ax: 'z', x: 2, y: 1, from: 0, to: 2 }] },
    prisma: { title: 'Block mit Nut', note: 'Block 40 × 30 × 20 mm mit durchgehender Nut (20 mm breit, 10 mm tief)',
      lay: [['####', '####', '####'], ['#..#', '#..#', '#..#']] },
    bruecke: { title: 'Brücke (Durchgang)', note: 'Block mit durchgehendem Durchbruch quer durch die Tiefe',
      lay: [['#...#', '#...#'], ['#...#', '#...#'], ['#####', '#####']] },
    zapfen: { title: 'Platte mit Zapfen', note: 'Platte 30 × 30 × 10 mm mit mittigem Zapfen',
      lay: [['###', '###', '###'], ['...', '.#.', '...']] },
    staffel: { title: 'Treppenblock', note: 'Block mit Stufen in zwei Richtungen: hinten links am höchsten',
      lay: [['####', '####', '####'], ['###.', '##..', '....'], ['#...', '....', '....']] },
    winkelplatte: { title: 'Eckplatte', note: 'L-förmige Platte, 10 mm dick', lay: [['#..', '#..', '###']] },
    wellenabsatz: { title: 'Wellenabsatz mit Zentrierbohrung', note: 'Stufenwelle (quadratischer Querschnitt statt rund, vereinfacht): dicker Bund 30 mm, Zapfen 10 mm, Zentrierung am Ende',
      lay: [['###...', '###...', '###...'], ['###...', '.#####', '###...'], ['###...', '###...', '###...']], holes: [{ ax: 'x', y: 1, z: 1, from: 0, to: 1 }] }
  };

  /* Linienarten nach DIN EN ISO 128-20 (Kurzform); nr = Linientyp-Nummer */
  const lines = [
    { id: 'breit', name: 'Volllinie breit', nr: '01.2', use: 'Sichtbare Kanten und Umrisse' },
    { id: 'schmal', name: 'Volllinie schmal', nr: '01.1', use: 'Maßlinien, Maßhilfslinien und Schraffuren' },
    /* PRUEFEN: Strichlinie für verdeckte Kanten: 02.1 (schmal) oder 02.2 (breit) erlaubt; Tabellenbuch des Betriebs vergleichen */
    { id: 'strich', name: 'Strichlinie', nr: '02.1 / 02.2', use: 'Verdeckte Kanten und Umrisse' },
    { id: 'sp', name: 'Strich-Punkt-Linie schmal', nr: '04.1', use: 'Mittellinien und Symmetrielinien' },
    /* PRUEFEN: Schnittverlauf breit an Enden und Richtungswechseln (ISO 128-40) */
    { id: 'spb', name: 'Strich-Punkt-Linie breit', nr: '04.2', use: 'Schnittverlauf an den Enden und bei Richtungswechseln' },
    { id: 'frei', name: 'Freihandlinie schmal', nr: '01.1 (freihand)', use: 'Bruchkanten bei abgebrochenen Darstellungen' },
    /* PRUEFEN: Nummer 05.1 */
    { id: 'zwei', name: 'Strich-Zweipunkt-Linie schmal', nr: '05.1', use: 'Umrisse von Nachbarteilen und Grenzstellungen beweglicher Teile' }
  ];

  /* Bemaßungsregeln (nur Regeln, bei denen sichere Quellen übereinstimmen); l = Stufe */
  const rules = [
    { l: 1, q: 'Mit welcher Linienart werden Maßlinien gezeichnet?', right: 'Volllinie schmal', wrong: ['Volllinie breit', 'Strichlinie', 'Strich-Punkt-Linie schmal'], expl: 'Maßlinien und Maßhilfslinien sind Volllinien schmal. Die breite Volllinie ist den sichtbaren Körperkanten vorbehalten.' },
    { l: 2, q: 'Wie stehen Maßhilfslinien zur bemaßten Strecke?', right: 'Rechtwinklig zur Strecke, sie ragen ein Stück über die Maßlinie hinaus', wrong: ['Parallel zur Strecke, direkt auf der Körperkante', 'Unter 45° zur Strecke, damit man sie von der Kante unterscheidet', 'Sie ragen nie über die Maßlinie hinaus'], expl: 'Maßhilfslinien stehen senkrecht auf der bemaßten Strecke und überragen die Maßlinie um etwa 1 bis 2 mm.' },
    { l: 2, q: 'Wie wird die Maßzahl an einer senkrechten Maßlinie geschrieben?', right: 'Links neben der Maßlinie, um 90° gedreht, von rechts lesbar', wrong: ['Rechts neben der Maßlinie, von links lesbar', 'Immer waagerecht, egal wie die Maßlinie liegt', 'Mitten auf der Maßlinie, dabei auf dem Kopf stehend'], expl: 'Maßzahlen sind von unten oder von rechts lesbar: an waagerechten Maßlinien über der Linie, an senkrechten Maßlinien links davon, um 90° gedreht.' },
    { l: 1, q: 'Welches Zeichen steht vor der Maßzahl eines Kreisdurchmessers?', right: '⌀ (Durchmesserzeichen)', wrong: ['R', '□', 'M'], expl: 'Das Zeichen ⌀ steht vor der Maßzahl, wenn ein Durchmesser bemaßt wird, zum Beispiel ⌀12. R steht für den Radius, □ für ein Quadrat.' },
    { l: 1, q: 'Welcher Buchstabe steht vor der Maßzahl eines Radius?', right: 'R', wrong: ['⌀', '□', 'M'], expl: 'Radien werden mit R vor der Maßzahl bemaßt, zum Beispiel R5. Der Radius ist die Hälfte des Durchmessers.' },
    { l: 3, q: 'Wie oft wird ein Maß in einer Zeichnung eingetragen?', right: 'Jedes Maß nur einmal (keine Doppelbemaßung)', wrong: ['In jeder Ansicht noch einmal, damit man es schneller findet', 'Zur Kontrolle immer zweimal'], expl: 'Doppelbemaßung ist zu vermeiden: Jedes Maß steht nur einmal, und zwar in der Ansicht, in der die Form am besten zu erkennen ist.' },
    { l: 3, q: 'Warum lässt man bei einer geschlossenen Maßkette (alle Teilmaße und das Gesamtmaß) ein Maß weg?', right: 'Sonst ist die Zeichnung überbestimmt: Toleranzen addieren sich und widersprechen sich', wrong: ['Weil die Zeichnung sonst zu groß für das Blatt wird', 'Weil man Teilmaße und Gesamtmaß nicht zusammen schreiben darf, wenn sie im Maßstab gezeichnet sind'], expl: 'Sind alle Teilmaße und das Gesamtmaß eingetragen, bestimmt jedes Maß das andere mit. Die Toleranzen widersprechen sich. Deshalb lässt man ein Maß weg oder setzt es als Hilfsmaß in Klammern.' },
    { l: 1, q: 'Welche Einheit gilt, wenn bei den Maßzahlen einer Maschinenbau-Zeichnung keine Einheit steht?', right: 'Millimeter (mm)', wrong: ['Zentimeter (cm)', 'Meter (m)', 'Zoll (inch)'], expl: 'Im Maschinenbau sind Längenmaße in Millimetern angegeben; die Einheit wird nicht eingetragen.' },
    { l: 3, q: 'Ein Bauteil ist 20 mm lang und wird im Maßstab 2:1 gezeichnet. Welche Maßzahl steht an der Maßlinie?', right: '20 (das Naturmaß)', wrong: ['40', '10', '2'], expl: 'Die Maßzahl gibt immer das tatsächliche Maß des Bauteils an, unabhängig vom Maßstab. Die gezeichnete Strecke ist dann 40 mm lang, die Zahl bleibt 20.' },
    { l: 2, q: 'Dürfen Körperkanten oder Mittellinien als Maßlinie benutzt werden?', right: 'Nein, Maßlinien werden immer extra gezeichnet', wrong: ['Ja, das spart Platz', 'Ja, aber nur die breiten Körperkanten'], expl: 'Maßlinien sind eigene Linien (Volllinie schmal). Kanten und Mittellinien dürfen nicht als Maßlinie dienen; Mittellinien dürfen aber als Maßhilfslinie verlängert werden.' },
    /* PRUEFEN: Abstand 10 mm der ersten Maßlinie zur Körperkante (Tabellenbuch: etwa 10 mm, weitere mindestens 7 mm) */
    { l: 2, q: 'Wo wird die erste Maßlinie bevorzugt eingetragen?', right: 'Außerhalb der Ansicht, mit etwa 10 mm Abstand zur Körperkante', wrong: ['Genau auf der Körperkante', 'Mitten durch die Ansicht quer über alle Körperkanten', 'Dicht an der Kante mit nur 1 mm Abstand'], expl: 'Maße stehen bevorzugt außerhalb der Ansicht. Die erste Maßlinie hat etwa 10 mm Abstand zur Körperkante, weitere mindestens etwa 7 mm.' },
    { l: 3, q: 'Wohin gehören Maße bevorzugt?', right: 'An sichtbare Kanten, nicht an Strichlinien', wrong: ['Nur an verdeckte Kanten, damit die Ansicht übersichtlich bleibt', 'An beliebige Linien, die Linienart ist egal'], expl: 'Bemaße möglichst an sichtbaren Kanten (Volllinien), nicht an verdeckten Kanten. Dafür wählt man die Ansicht oder den Schnitt, in dem die Form sichtbar ist.' }
  ];

  const T = (id, cat, level, title, o) => Object.assign({ id, cat, level, title }, o);
  const AN = 'Ansichten', ER = 'Ansichten ergänzen', LB = 'Linien und Bemaßung', MA = 'Maßstab', SC = 'Schnitt';
  const ISOHINT = 'Die Isometrie zeigt den Körper von vorn rechts oben: die linke sichtbare Seitenfläche ist die Vorderseite, die Fläche oben die Draufsicht.';
  const tasks = [
    T('zei1', AN, 1, 'Anordnung: Was liegt unter der Vorderansicht?', { kind: 'know', q: 'Welche Ansicht liegt bei der Projektionsmethode 1 (Europa) UNTER der Vorderansicht?', right: 'Die Draufsicht', wrong: ['Die Seitenansicht von links', 'Die Untersicht', 'Die Rückansicht'], tips: ['Die Vorderansicht steht in der Mitte, die anderen Ansichten ordnet man um sie herum an.', 'Die Draufsicht schaut von oben auf den Körper. Sie klappt nach unten weg.'], expl: 'Die Draufsicht liegt unter der Vorderansicht. Die Seitenansicht von links liegt rechts daneben.' }),
    T('zei2', AN, 1, 'Anordnung: Wo liegt die Seitenansicht von links?', { kind: 'know', q: 'Wo wird die Seitenansicht von links bei der Projektionsmethode 1 (Europa) gezeichnet?', right: 'Rechts neben der Vorderansicht', wrong: ['Links neben der Vorderansicht', 'Über der Vorderansicht', 'Unter der Vorderansicht'], tips: ['Merke: In Europa liegt jede Ansicht auf der entgegengesetzten Seite des Blickpunkts.', 'Du blickst von links auf den Körper: die Ansicht wird auf die gegenüberliegende Seite, also nach rechts, gelegt.'], expl: 'Seitenansicht von links: rechts von der Vorderansicht. Draufsicht: darunter. Beide liegen auf der entgegengesetzten Seite des Blickpunkts.' }),
    T('zei3', AN, 1, 'Treppe: Welche Vorderansicht passt?', { kind: 'iso2view', model: 'treppe', view: 'front', text: 'Welche Vorderansicht gehört zum gezeigten Körper? ' + ISOHINT, tips: ['Schau von vorn auf die linke sichtbare Seitenfläche. Zähle die Stufen und ihre Höhen.', 'Von vorn sehen die Stufen aus wie eine Treppe: links niedrig, rechts hoch.'], expl: 'Von vorn sieht man die Treppenstufen als Umriss. Die Kanten zwischen den Stufen sind sichtbar, es gibt keine verdeckten Kanten.' }),
    T('zei4', AN, 2, 'Winkel: Welche Vorderansicht passt?', { kind: 'iso2view', model: 'winkel', view: 'front', text: 'Welche Vorderansicht gehört zum Winkel? ' + ISOHINT, tips: ['Von vorn siehst du den Umriss der L-Form. Gibt es Kanten, die man nicht sieht?', 'Die Bohrung liegt im waagerechten Schenkel und ist von vorn nicht zu sehen: Sie erscheint als Strichlinie (verdeckte Kanten).'], expl: 'Die Bohrung im Fuß ist von vorn verdeckt und wird mit zwei Strichlinien dargestellt. Die Mittellinie der Bohrung ist eine Strich-Punkt-Linie.' }),
    T('zei5', AN, 2, 'Stufenblock: Welche Draufsicht passt?', { kind: 'iso2view', model: 'stufenblock', view: 'top', text: 'Welche Draufsicht gehört zum Stufenblock? Die Draufsicht schaut von oben auf den Körper. In der Draufsicht liegt die Vorderseite UNTEN. ' + ISOHINT, tips: ['Von oben siehst du zwei Höhen. Wo liegt die höhere Fläche, vorn oder hinten?', 'In der Draufsicht ist die Vorderseite des Körpers unten gezeichnet, die Rückseite oben.'], expl: 'Die höhere Fläche liegt links hinten. Zwischen den Höhen sieht man in der Draufsicht eine Kante (Volllinie), weil der Absatz sichtbar ist.' }),
    T('zei6', AN, 2, 'Winkel: Welche Seitenansicht passt?', { kind: 'iso2view', model: 'winkel', view: 'side', text: 'Welche Seitenansicht von links gehört zum Winkel? Du schaust von links auf den Körper, in der Isometrie ist das die nicht sichtbare Seite hinten links. ' + ISOHINT, tips: ['Von links siehst du die Stirnfläche des hohen Schenkels. Wie groß ist sie?', 'Die Bohrung im Fuß ist von links durch den hohen Schenkel verdeckt: Strichlinie.'], expl: 'Von links sieht man das hohe Quadrat des Schenkels. Die Bohrung im Fuß liegt dahinter und wird mit Strichlinien gezeichnet.' }),
    T('zei7', AN, 2, 'Brücke: Welche Draufsicht passt?', { kind: 'iso2view', model: 'bruecke', view: 'top', text: 'Welche Draufsicht gehört zum Körper mit Durchgang? ' + ISOHINT, tips: ['Von oben sieht man die Deckfläche. Was ist mit dem Durchgang darunter?', 'Der Durchgang ist von oben verdeckt und wird in der Draufsicht mit Strichlinien gezeichnet.'], expl: 'Der Durchgang liegt unter der geschlossenen Deckfläche. Seine Kanten sind verdeckt: Strichlinien.' }),
    T('zei8', AN, 3, 'Freier Körper: Welche Vorderansicht passt?', { kind: 'iso2view', model: 'rand', view: 'front', text: 'Welche Vorderansicht gehört zum gezeigten Körper? ' + ISOHINT, tips: ['Übertrage die Höhen der Spalten von vorn nach rechts in die Ansicht. Kanten dahinter erkennst du nur an den Höhen.', 'Sichtbare Kanten: Stufen zwischen vorderen und hinteren Flächen. Verdeckte Kanten: Strichlinie.'], expl: 'Nur die Vorderansicht passt zu den Höhen und Kanten des Körpers. Die anderen Bilder zeigen eine Stufe zu viel, zu wenig oder gespiegelt.' }),
    T('zei9', ER, 2, 'Treppenblock: Vorderansicht ergänzen', { kind: 'view3', model: 'staffel', given: ['top', 'side'], target: 'front', text: 'Draufsicht und Seitenansicht von links sind gegeben. Welche Vorderansicht gehört dazu?', tips: ['Die Vorderansicht liegt links von der Seitenansicht und über der Draufsicht. Die Breite kommt aus der Draufsicht, die Höhen aus der Seitenansicht.', 'Du schaust von vorn: die vorderen, niedrigen Stufen verdecken die dahinter liegenden höheren nicht. Der Umriss zeigt die höchste Höhe je Spalte.'], expl: 'Die Breite stimmt mit der Draufsicht überein, die Höhe mit der Seitenansicht. Der Umriss ist die höchste Stelle je Spalte; Kanten zwischen den Stufen sind sichtbar.' }),
    T('zei10', ER, 2, 'Treppenblock: Seitenansicht ergänzen', { kind: 'view3', model: 'staffel', given: ['front', 'top'], target: 'side', text: 'Vorderansicht und Draufsicht sind gegeben. Welche Seitenansicht von links gehört dazu?', tips: ['Die Seitenansicht liegt rechts neben der Vorderansicht: gleiche Höhe wie die Vorderansicht.', 'Die Tiefe liest du in der Draufsicht ab. Von links sieht man die höchste Stufe zuerst vor dem Hintergrund.'], expl: 'Höhen kommen aus der Vorderansicht, die Tiefe aus der Draufsicht. Von links sieht man die niedrigste Stufe vorn, die anderen verdeckt dahinter.' }),
    T('zei11', ER, 3, 'Freier Körper: Seitenansicht ergänzen', { kind: 'view3', model: 'rand', given: ['front', 'top'], target: 'side', text: 'Vorderansicht und Draufsicht sind gegeben. Welche Seitenansicht von links gehört dazu?', tips: ['Übertrage die Höhen aus der Vorderansicht und die Tiefen aus der Draufsicht. In der Seitenansicht ist die Vorderseite rechts.', 'Verdeckte Kanten ergeben Strichlinien. Prüfe, ob Alternativen zur Draufsicht passen.'], expl: 'Die richtige Seitenansicht passt zur Höhe aus der Vorderansicht und zur Tiefe aus der Draufsicht (vorn rechts, hinten links).' }),
    T('zei12', ER, 1, 'Treppe: Draufsicht zeichnen', { kind: 'edges', model: 'treppe', given: ['front'], target: 'top', text: 'Trage die Kanten der Draufsicht in das Raster ein. Tippen wechselt: leer, Volllinie, Strichlinie.', tips: ['In der Draufsicht siehst du jede Stufenkante von oben als Volllinie. Rand des Körpers nicht vergessen.', 'Es gibt keine verdeckten Kanten, nur Volllinien: Außenrand und zwei Linien zwischen den Stufen.'], expl: 'Außenrechteck plus je eine Linie an den Stufenkanten. Hinter der Treppe liegt nichts Verdecktes.' }),
    T('zei13', ER, 2, 'Winkel: Draufsicht zeichnen', { kind: 'edges', model: 'winkel', given: ['front'], target: 'top', text: 'Trage die Kanten der Draufsicht in das Raster ein. Tippen wechselt: leer, Volllinie, Strichlinie.', tips: ['Der Rand, die Kante des hohen Schenkels und die Bohrung sind von oben sichtbar.', 'Die Bohrung ist von oben sichtbar: ein Quadrat mit Volllinien. Nichts ist verdeckt.'], expl: 'Außenrand, Kante zwischen Fuß und hohem Schenkel und die Bohrung: alles von oben sichtbar, also Volllinien.' }),
    T('zei14', ER, 3, 'Nutenstein: Seitenansicht zeichnen', { kind: 'edges', model: 'nutenstein', given: ['front'], target: 'side', text: 'Trage die Kanten der Seitenansicht von links in das Raster ein. Tippen wechselt: leer, Volllinie, Strichlinie.', tips: ['Von links siehst du den breiten Fuß und den schmalen Hals dahinter verdeckt: Kante des Halses im Fuß verdeckt.', 'Die Bohrung liegt innen und ist von links verdeckt: zwei senkrechte Strichlinien. Der Hals ist hinter dem Fuß ganz verdeckt.'], expl: 'Fuß als Umriss sichtbar. Der Hals und die Bohrung liegen innen oder dahinter: Strichlinien.' }),
    T('zei15', LB, 1, 'Mittellinie: Welche Linienart?', { kind: 'use2line', line: 'sp', pool: ['sp'], text: '', tips: ['Mittellinien markieren die Achse von Bohrungen und runden Teilen.', 'Die Linie besteht aus langen Strichen und einem Punkt dazwischen; sie ist schmal.'], expl: '' }),
    T('zei16', LB, 1, 'Sichtbare Kanten: Welche Verwendung?', { kind: 'line2use', line: 'breit', pool: ['breit'], text: '', tips: ['Die Linie ist die breiteste und durchgezogen.', 'Mit der breiten Volllinie zeichnet man alles, was man am Bauteil sieht.'], expl: '' }),
    T('zei17', LB, 2, 'Verdeckte Kanten: Welche Linienart?', { kind: 'use2line', line: 'strich', pool: ['strich'], text: '', tips: ['Verdeckte Kanten sind unterbrochen gezeichnet, damit man sie nicht mit sichtbaren verwechselt.', 'Gesucht ist die Linie aus gleichmäßigen Strichen mit Lücken, ohne Punkte.'], expl: '' }),
    T('zei18', LB, 1, 'Maßlinie: Welche Linienart?', { kind: 'rule', rule: 0, pool: [0], text: '', tips: ['Maßlinien dürfen nicht mit den Körperkanten verwechselt werden.', 'Sie sind dünn und durchgezogen.'], expl: '' }),
    T('zei19', LB, 1, 'Durchmesserzeichen', { kind: 'rule', rule: 3, pool: [3], text: '', tips: ['Das Zeichen sieht aus wie ein durchgestrichener Kreis.', 'Es steht vor der Maßzahl, nicht dahinter.'], expl: '' }),
    T('zei20', LB, 2, 'Maßzahl an senkrechter Maßlinie', { kind: 'rule', rule: 2, pool: [2], text: '', tips: ['Maßzahlen sollen von unten oder von rechts lesbar sein.', 'Bei senkrechten Maßlinien dreht man die Zahl um 90° nach links, so dass sie von rechts lesbar ist.'], expl: '' }),
    T('zei21', LB, 3, 'Doppelbemaßung', { kind: 'rule', rule: 5, pool: [5], text: '', tips: ['Überlege, wie leicht sich Widersprüche einschleichen, wenn ein Maß zweimal steht.', 'Eine gute Zeichnung enthält jedes Maß genau einmal.'], expl: '' }),
    T('zei22', MA, 1, 'Maßstab: Zeichnungsmaß berechnen', { kind: 'scale', level: 1, dir: 'z', scale: [1, 2], text: '', tips: ['M 1:2 heißt: Die Zeichnung ist halb so groß wie das Bauteil.', 'Zeichnungsmaß = Naturmaß geteilt durch 2.'], expl: '' }),
    T('zei23', MA, 2, 'Maßstab: Naturmaß berechnen', { kind: 'scale', level: 2, dir: 'n', text: '', tips: ['Bei Vergrößerung (z. B. 5:1) ist die Zeichnung größer als das Bauteil.', 'Naturmaß = Zeichnungsmaß mal Natur-Zahl durch Zeichnungs-Zahl (Beispiel M 5:1: durch 5 teilen).'], expl: '' }),
    T('zei24', MA, 2, 'Welcher Maßstab wurde verwendet?', { kind: 'scaleq', level: 2, text: '', tips: ['Maßstab = Zeichnungsmaß : Naturmaß.', 'Ist die Zeichnung kleiner als das Bauteil, ist es eine Verkleinerung (links die kleinere Zahl).'], expl: '' }),
    T('zei25', MA, 3, 'Maßstab: gemischte Rechnung', { kind: 'scale', level: 3, text: '', tips: ['Lies den Maßstab zuerst: Zeichnung : Natur.', 'Vergrößerung: Zeichnung = Natur mal Faktor. Verkleinerung: Zeichnung = Natur durch Faktor.'], expl: '' }),
    T('zei26', SC, 2, 'Winkel: Welcher Schnitt A–A?', { kind: 'schnitt', model: 'winkel', cy: 1, text: 'Der Winkel wird entlang der Linie A–A geschnitten. Die Pfeile zeigen die Blickrichtung (nach hinten). Welcher Schnitt A–A gehört dazu? Schnittflächen werden mit 45°-Linien schraffiert.', tips: ['Der Teil vor der Schnittebene wird weggenommen. Du siehst auf die Schnittfläche und dahinter.', 'Die Schnittebene geht durch die Bohrung: In der Schnittfläche ist dort eine Lücke (nicht schraffiert).'], expl: 'Die Schnittfläche ist schraffiert und zeigt den Fuß mit der Bohrungslücke und den hohen Schenkel. Hinter der Ebene liegende Kanten sind sichtbar.' }),
    T('zei27', SC, 2, 'Stufenblock: Welcher Schnitt A–A?', { kind: 'schnitt', model: 'stufenblock', cy: 1, text: 'Der Stufenblock wird entlang der Linie A–A geschnitten. Die Pfeile zeigen die Blickrichtung (nach hinten). Welcher Schnitt A–A gehört dazu?', tips: ['Schau auf die Schnittebene: Wie hoch ist der Körper dort, wie breit der Absatz?', 'Schraffiert wird nur, was in der Schnittebene wirklich Material ist. Dahinter sichtbare Stufen bleiben unschraffiert.'], expl: 'In der Schnittebene hat der Körper links den Absatz (zwei Würfel hoch) und rechts den niedrigen Teil. Dahinter sieht man die weitere Stufe als unschraffierte Fläche.' }),
    T('zei28', SC, 3, 'Nutenstein: Welcher Schnitt A–A?', { kind: 'schnitt', model: 'nutenstein', cy: 1, text: 'Der Nutenstein wird mittig entlang der Linie A–A geschnitten. Die Pfeile zeigen die Blickrichtung (nach hinten). Welcher Schnitt A–A gehört dazu?', tips: ['Die Schnittebene liegt in der Mitte, genau durch die Bohrung.', 'Die Bohrung ist in der Schnittfläche eine unschraffierte Lücke in der Mitte, die Fuß und Hals durchläuft.'], expl: 'Fuß breit, Hals schmal, die Bohrung als Lücke durch beide. Die Schnittfläche ist schraffiert, dahinter liegende Kanten sind sichtbar.' })
  ];
  /* Zusatz-Pools für den Trainer (mehr Abwechslung als die feste Aufgabe) */
  const poolById = { zei15: ['sp', 'schmal', 'spb', 'zwei', 'frei'], zei16: ['breit', 'schmal', 'strich', 'sp', 'spb', 'frei', 'zwei'], zei17: ['strich', 'breit', 'schmal', 'sp'],
    zei18: [0, 1, 7, 9, 10], zei19: [3, 4], zei20: [2, 1, 10], zei21: [5, 6, 8, 11] };
  tasks.forEach(t => { if (poolById[t.id]) t.trainPool = poolById[t.id]; });

  /* Fertige Beispiele (Reiter Beispiele, ?bsp) */
  const examples = [
    { id: 'winkel', title: 'Winkel mit Bohrung in drei Ansichten', model: 'winkel', dim: true, notes: [
      'Die Vorderansicht (Mitte) zeigt die L-Form. Die Bohrung im Fuß ist von vorn nicht zu sehen: zwei Strichlinien (verdeckte Kanten) und eine Mittellinie (Strich-Punkt).',
      'Die Draufsicht liegt unter der Vorderansicht. Die Bohrung ist von oben sichtbar, darum Volllinien und ein Mittellinienkreuz. In der Draufsicht ist die Vorderseite unten.',
      'Die Seitenansicht von links liegt rechts neben der Vorderansicht: Von links sieht man nur den hohen Schenkel. Die Bohrung liegt dahinter und ist gestrichelt.',
      'Jedes Maß steht nur einmal: Breite und Höhe an der Vorderansicht, die Tiefe an der Draufsicht. Die Seitenansicht bleibt ohne Maße.'] },
    { id: 'stufenblock', title: 'Stufenblock', model: 'stufenblock', dim: true, notes: [
      'Alle Kanten sind von vorn oder oben sichtbar: es gibt keine Strichlinien.',
      'In der Vorderansicht sieht man den Absatz, aber nicht, wie tief er ist. Das zeigt erst die Draufsicht: Zusammen ergeben die Ansichten den Körper eindeutig.',
      'Wo zwei Flächen in verschiedener Höhe aneinanderstoßen, entsteht eine Kante (Volllinie). Wo zwei Flächen in einer Ebene liegen, wird keine Linie gezeichnet.'] },
    { id: 'nutenstein', title: 'Nutenstein mit Bohrung', model: 'nutenstein', dim: true, notes: [
      'Breiter Fuß und schmaler Hals, die Bohrung geht durch beides. Die Bohrung ist in Vorder- und Seitenansicht verdeckt und wird gestrichelt gezeichnet.',
      'In der Draufsicht sieht man den Hals auf dem Fuß und die Bohrung als Quadrat (Volllinien) mit Mittellinienkreuz.',
      'Der Hals ist in der Seitenansicht von links hinter dem breiteren Fuß verdeckt: seine Kante erscheint als Strichlinie.'] },
    { id: 'welle', title: 'Wellenabsatz im Schnitt', model: 'wellenabsatz', cy: 1, section: true, notes: [
      'Die Schnittebene geht mitten durch den Körper. Der vordere Teil ist weggenommen, man blickt auf die Schnittfläche.',
      'Die Schnittfläche wird mit Volllinien schmal unter 45° schraffiert. Die Zentrierbohrung am linken Ende bleibt als unschraffierte Lücke.',
      'Im Schnitt werden keine verdeckten Kanten gezeichnet. Die Absatzkante zwischen Bund und Zapfen ist sichtbar.',
      'Die Welle ist hier vereinfacht mit quadratischem Querschnitt gezeichnet; eine runde Welle sieht in der Längsschnitt-Ansicht genauso aus.'] },
    { id: 'prisma', title: 'Block mit durchgehender Nut', model: 'prisma', dim: true, notes: [
      'Die Nut zeigt sich nur in der Vorderansicht als Einschnitt (Volllinien). In der Draufsicht laufen zwei Linien durch.',
      'In der Seitenansicht von links liegt die Nutsohle hinter der Stirnfläche: Strichlinie über die ganze Breite.',
      'Mit diesen drei Ansichten ist der Körper eindeutig dargestellt.'] }
  ];

  const sections = [];
  root.ZEI_DATA = { models, lines, rules, tasks, examples, cats: [AN, ER, LB, MA, SC], sections };
  root.ZEI_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.ZEI_DATA, TASKS: root.ZEI_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
