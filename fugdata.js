'use strict';
/* Tonfunk Füge-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Beispiele).
   ALLE Zahlen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Verbindungen.
   window.FUG_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools }
   window.FUG_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'fug', Status in localStorage 'lm4.fug.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Frageformen (q.ask.type): 'choice' (Auswahl), 'num' (Zahl), 'order' (Reihenfolge), 'match' (Zuordnung). q.viz = Beschreibung einer Grafik (nur Aufgabenstellung, nie die Lösung), gezeichnet von fugviz.js.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch die Fehlerursache (neutrale Titel, die Fehlersuchen heißen "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, Reihenfolgen werden gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.FUG_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Fügen im System', 'Schweißen', 'Löten', 'Kleben', 'Nieten, Klemmen, Stecken', 'Schraubverbindungen', 'Welle-Nabe-Verbindungen', 'Fehlersuche'];

  /* ---------- Frageformen ---------- */
  const numQ = (text, value, unit, label, tol, expl, tips, viz) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, viz });
  function choiceQ(R, text, right, wrong, expl, tips, viz) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, viz };
  }
  /* Reihenfolge: items in der RICHTIGEN Reihenfolge übergeben; sie werden gemischt (nie schon richtig sortiert) */
  function orderQ(R, text, items, expl, tips, viz) {
    let idx = items.map((_, i) => i), sh = idx, tries = 0;
    do { sh = C().shuffle(R, idx); tries++; } while (sh.every((v, i) => v === i) && tries < 20);
    return { text, ask: { type: 'order', items: sh.map(i => items[i]), correct: items.map((_, k) => sh.indexOf(k)) }, value: 0, tol: 0, expl, tips, viz };
  }
  /* Zuordnung: rows[i] bekommt options[corr[i]]; die Optionen werden gemischt */
  function matchQ(R, text, rows, options, corr, expl, tips, viz) {
    const sh = C().shuffle(R, options.map((_, i) => i));
    return { text, ask: { type: 'match', rows, options: sh.map(i => options[i]), correct: corr.map(c => sh.indexOf(c)) }, value: 0, tol: 0, expl, tips, viz };
  }
  const pq = (POOL, vz) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], vz ? vz(q) : null); };

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P1: Gliederung des Fügens nach DIN 8593 (4.1 bis 4.9) und Zuordnung der Beispiele, siehe fugcore.js DIN8593. */
  const DINQ = [
    ['In der Gliederung der Fertigungsverfahren (DIN 8580) trägt das Fügen die Hauptgruppen-Nummer ...', 'Nummer 4', ['Nummer 1', 'Nummer 2', 'Nummer 3'], 'Die Hauptgruppen sind: 1 Urformen, 2 Umformen, 3 Trennen, 4 Fügen, 5 Beschichten, 6 Stoffeigenschaften ändern.', ['Denke an die Reihenfolge Urformen, Umformen, Trennen, ...', 'Fügen steht hinter dem Trennen.']],
    ['Unter welcher Nummer steht in DIN 8593 das Fügen durch Löten?', '4.7', ['4.6', '4.8', '4.5'], 'DIN 8593 gliedert: 4.6 Schweißen, 4.7 Löten, 4.8 Kleben.', ['Schweißen, Löten und Kleben stehen direkt hintereinander.', 'Das Schweißen ist 4.6.']],
    ['In welche Untergruppe nach DIN 8593 gehört das Nieten?', 'Fügen durch Umformen', ['Fügen durch Löten', 'Zusammensetzen', 'An- und Einpressen'], 'Beim Nieten wird der Schaft zum Schließkopf umgeformt (4.5). Schrauben dagegen zählt man zum Zusammensetzen (4.1).', ['Beim Nieten wird ein Kopf geformt.', 'Es geht um die Untergruppe mit der Nummer 4.5.']],
    ['In welche Untergruppe nach DIN 8593 gehört ein Pressverband?', 'An- und Einpressen', ['Fügen durch Umformen', 'Fügen durch Urformen', 'Füllen'], 'Beim Pressverband werden die Teile mit Übermaß ineinandergepresst. Das ist die Untergruppe 4.3.', ['Das Wort steht fast in der Frage: Pressen.', 'Es ist die Untergruppe 4.3.']],
    ['Zu welcher Untergruppe nach DIN 8593 zählt man das Verschrauben zweier Teile?', 'Zusammensetzen', ['Fügen durch Schweißen', 'Textiles Fügen', 'Fügen durch Urformen'], 'Schrauben, Stifte und Bolzen gehören zum Zusammensetzen (4.1): Die Teile werden zusammengelegt und gesichert.', ['Es ist die erste Untergruppe, 4.1.', 'Schrauben schmelzen nichts auf.']]
  ];
  /* PRUEFEN P2: Einteilung in Stoffschluss, Formschluss, Kraftschluss und lösbar/unlösbar, siehe fugcore.js VERF. */
  const LOQ = [
    ['Welche dieser Verbindungen lässt sich ohne Zerstörung wieder lösen?', 'Eine Schraubverbindung', ['Eine Schweißverbindung', 'Eine Nietverbindung', 'Eine Lötverbindung'], 'Schrauben sind lösbar. Schweißen, Löten und Nieten kann man nur durch Zerstören der Verbindung trennen.', ['Welche Verbindung hat ein Gewinde?', 'Nur eine Verbindung lässt sich mit Werkzeug öffnen und wieder schließen.']],
    ['Eine Welle ist größer als die Bohrung der Nabe (Übermaß). Wie nennt man diese Passungsart?', 'Übermaßpassung', ['Spielpassung', 'Übergangspassung', 'Toleranzpassung'], 'Bei einer Übermaßpassung ist die Welle vor dem Fügen immer größer als die Bohrung. Das Teil wird gepresst oder durch Wärme gefügt.', ['Übermaß heißt: Die Welle ist größer als das Loch.', 'Bei einer Spielpassung passt die Welle immer locker hinein.']],
    ['Welche Verbindung überträgt die Last allein durch Reibung?', 'Der Pressverband', ['Die Passfederverbindung', 'Die Nietverbindung', 'Die Bolzenverbindung'], 'Beim Pressverband hält die Flächenpressung zwischen Welle und Nabe. Passfeder, Niet und Bolzen tragen über ihre Form.', ['Reibung entsteht durch Anpressen der Flächen.', 'Welche der vier Verbindungen hat keine Nut und keinen Bolzen?']],
    ['Welche Verbindung ist formschlüssig und lässt sich wieder lösen?', 'Passfeder in der Nut', ['Klebung mit Epoxid', 'Hartlötung am Rohr', 'Schweißnaht im Rahmen'], 'Die Passfeder greift in Nuten (Formschluss) und kann herausgezogen werden. Kleben, Löten und Schweißen sind stoffschlüssig.', ['Formschluss bedeutet: Die Form der Teile greift ineinander.', 'Stoffschluss lässt sich nicht lösen.']],
    ['Ein Gehäusedeckel wird zur Wartung regelmäßig geöffnet. Welche Fügeart wählst du?', 'Schrauben', ['Schweißen', 'Kleben', 'Löten'], 'Für regelmäßiges Öffnen braucht man eine lösbare Verbindung. Schrauben sind dafür die übliche Wahl.', ['Das Gehäuse soll öfter geöffnet werden.', 'Welche dieser Fügearten lässt sich ohne Schaden wieder lösen?']]
  ];
  const BLQ = [
    ['Wie belastet man eine Klebverbindung am günstigsten?', 'Auf Schub über eine große Überlappung', ['Auf Schälen an einer freien Kante der Fügeteile', 'Auf Spalten an einer Ecke des Bauteils', 'Auf punktuelles Abziehen am Rand'], 'Bei Schub verteilt sich die Kraft auf die ganze Klebfläche. Beim Schälen und Spalten wirkt sie nur an einer schmalen Linie.', ['Eine große Fläche trägt viel.', 'Die Kraft soll parallel zur Klebfläche wirken.']],
    ['Warum ist das Schälen für eine Klebung ungünstig?', 'Die Kraft greift nur an einer schmalen Linie am Rand an', ['Dabei wird der Klebstoff stark erwärmt und deutlich weich', 'Der Klebstoff verdunstet unter Zugbelastung sofort', 'Das Blech wird beim Abziehen magnetisch geladen'], 'Beim Schälen wird die Klebschicht Stück für Stück von der Kante aufgetrennt. Die Spannung konzentriert sich an der Kante.', ['Wo sitzt die Kraft beim Schälen?', 'Vergleiche mit einer Verteilung über die ganze Fläche.']],
    ['Eine Klebung versagt, wenn man an einer Ecke zieht. Wie verbesserst du sie?', 'Die Verbindung so ändern, dass sie auf Schub belastet wird', ['Deutlich mehr Klebstoff dick auf die Kante auftragen', 'Die Flächen vorher glatt polieren', 'Den Klebstoff insgesamt kürzer aushärten lassen als vorgesehen'], 'Eine Konstruktion mit Überlappung belastet die Klebung auf Schub. Mehr Klebstoff oder glatte Flächen helfen nicht.', ['Ändere die Belastungsrichtung.', 'Wie sieht eine typische Überlappung aus?']],
    ['Die Klebfläche wird bei gleichem Klebstoff doppelt so groß. Was gilt für die übertragbare Kraft?', 'Sie wird ungefähr doppelt so groß', ['Sie bleibt gleich, die Fläche spielt keine Rolle', 'Sie wird ungefähr vierfach so groß', 'Sie sinkt auf etwa die Hälfte'], 'Zugscherfestigkeit τ = F / A: Bei gleichem τ wächst die Kraft F im gleichen Verhältnis wie die Fläche A.', ['F = τ · A.', 'Das Verhältnis ist linear.']],
    ['Was bedeutet Kohäsion beim Kleben?', 'Der Zusammenhalt innerhalb des Klebstoffs', ['Das Haften des Klebstoffs an der Fügefläche', 'Die Zeit bis zum vollständigen Aushärten', 'Die Dicke der aufgetragenen Klebschicht'], 'Kohäsion ist die Festigkeit im Klebstoff selbst. Das Haften an der Fläche heißt Adhäsion.', ['Kohäsion und Adhäsion sind ein Paar.', 'Ko- wie „zusammen“.']]
  ];
  const WHQ = [
    ['Was geschieht beim Löten mit dem Grundwerkstoff?', 'Er bleibt fest und wird nur vom flüssigen Lot benetzt', ['Er schmilzt an der Fügestelle mit auf', 'Er wird an der Oberfläche vergast', 'Er löst sich im Lot vollständig auf'], 'Beim Löten schmilzt nur das Lot. Beim Schweißen schmilzt auch der Grundwerkstoff. Das ist der wichtigste Unterschied.', ['Welcher Stoff schmilzt beim Löten?', 'Das Lot hat eine niedrigere Schmelztemperatur als die Werkstücke.']]
  ];
  /* PRUEFEN P22 (siehe fugcore.js STECK): Sicherungsringe DIN 471 und 472, Splint, Passstift. */
  const STQ = [
    ['Welche Norm gilt für Sicherungsringe, die in eine Nut in einer Bohrung eingesetzt werden?', 'DIN 472', ['DIN 471', 'DIN 6885', 'DIN 125'], 'DIN 471 gilt für Wellen (außen), DIN 472 für Bohrungen (innen). Merke: 472 sitzt im Inneren.', ['Es gibt zwei Normen für Sicherungsringe, 471 und 472.', 'Innen oder außen?']],
    ['Welche Norm gilt für Sicherungsringe, die in einer Nut auf einer Welle sitzen?', 'DIN 471', ['DIN 472', 'DIN 6885', 'DIN 125'], 'Sicherungsringe für Wellen sind in DIN 471 genormt, die für Bohrungen in DIN 472.', ['Auf der Welle sitzt der Ring außen.', 'Es ist die niedrigere der beiden Nummern.']],
    ['Wozu dient ein Splint an einer Kronenmutter?', 'Er sperrt die Mutter formschlüssig gegen Drehen', ['Er erhöht die Vorspannkraft der Schraube', 'Er dichtet das Gewinde gegen Feuchtigkeit', 'Er zentriert die beiden Bauteile zueinander'], 'Der Splint steckt durch ein Loch in der Schraube und die Schlitze der Mutter. So kann sich die Mutter nicht mehr drehen.', ['Der Splint blockiert die Drehung.', 'Es ist eine Form-Sicherung.']],
    ['Eine Bolzenverbindung muss im Service schnell lösbar bleiben. Wie sicherst du den Bolzen?', 'Mit Sicherungsring oder Splint', ['Durch Einschweißen in die Bohrung', 'Durch Einkleben mit Epoxidharz', 'Durch Vernieten des Bolzenendes'], 'Sicherungsring oder Splint halten den Bolzen formschlüssig und lassen sich werkzeugarm entfernen.', ['Die Sicherung muss lösbar sein.', 'Schweißen, Kleben und Nieten sind unlösbar.']],
    ['Was leistet ein Passstift zwischen zwei verschraubten Teilen?', 'Er positioniert die Teile genau und nimmt Querkräfte auf', ['Er überträgt allein die Vorspannkraft der Schraube', 'Er verhindert, dass das Gewinde rostet', 'Er ersetzt die Unterlegscheibe unter dem Kopf'], 'Passstifte lagern die Teile exakt zueinander, auch nach dem Lösen und erneuten Verschrauben.', ['Wiederholgenauigkeit nach dem Zerlegen.', 'Stifte sitzen in Bohrungen mit enger Passung.']]
  ];
  const NKQ = [
    ['Welche Aussage über eine Nietverbindung stimmt?', 'Sie ist formschlüssig und nur durch Zerstören lösbar', ['Sie ist stoffschlüssig und lässt sich ohne Schaden wieder lösen', 'Sie hält allein durch Reibung und ist lösbar', 'Sie überträgt Kräfte nur über Vorspannung'], 'Der Niet füllt das Loch (Formschluss) und wird durch den Schließkopf gehalten. Zum Lösen muss man den Niet aufbohren.', ['Der Niet füllt das Loch aus.', 'Zum Lösen muss ein Niet zerstört werden.']],
    ['Wann nimmt man einen Blindniet?', 'Wenn die Verbindung nur von einer Seite zugänglich ist', ['Wenn die Verbindung später wieder gelöst werden soll, ohne Schaden', 'Wenn die Verbindung gasdicht geschweißt werden muss', 'Wenn die Teile heiß verbunden werden müssen'], 'Der Blindniet wird von einer Seite gesetzt: Ein Dorn zieht den Schließkopf auf der Rückseite und bricht dann ab.', ['Blind heißt: Die Rückseite ist nicht sichtbar.', 'Das Setzwerkzeug arbeitet von nur einer Seite.']],
    ['Wodurch hält eine Klemmverbindung?', 'Durch Reibung zwischen den Flächen', ['Durch Aufschmelzen der Fügeflächen', 'Durch eine Nut mit Feder', 'Durch einen Klebfilm zwischen den Teilen'], 'Klemmen ist Kraftschluss: Die Klemmkraft erzeugt Reibung, die das Drehmoment oder die Kraft überträgt.', ['Kraftschluss bedeutet Reibung.', 'Es wird nichts geschmolzen und nichts geklebt.']],
    ['Wie werden Niete hauptsächlich beansprucht?', 'Auf Abscheren und Lochleibung', ['Auf Biegung und Torsion im Schaft', 'Auf Zug in Längsrichtung', 'Auf Druck und Knickung'], 'Die Bleche versuchen, sich gegeneinander zu verschieben: Der Niet wird abgeschert, und die Lochwand drückt auf den Schaft (Lochleibung).', ['Die Bleche werden gegeneinander gezogen.', 'Querkräfte schneiden den Schaft.']],
    ['Warum steht ein Halbrundniet vor dem Schließen mit einem Stück Schaft über?', 'Aus dem Überstand wird der Schließkopf geformt', ['Damit der Niet später wieder gelöst werden kann', 'Damit sich die Bleche bei Wärme ausdehnen können', 'Damit die Verbindung Wärme besser ableitet'], 'Das Überstandsstück (etwa 1,5 · d) wird zum Schließkopf gestaucht. Ohne Überstand gäbe es keinen zweiten Kopf.', ['Der zweite Kopf entsteht aus dem Schaftende.', 'Es ist ein Werkstoffvorrat.']]
  ];
  const SIQ = [
    ['Welche dieser Schraubensicherungen wirkt formschlüssig?', 'Kronenmutter mit Splint', ['Gegenmutter', 'Mittelfestes Schraubensicherungsmittel', 'Sperrzahnschraube'], 'Der Splint greift in Schraube und Mutter und sperrt die Drehung mechanisch. Die anderen drei wirken über Reibung oder Klebung.', ['Formschluss heißt: Ein Teil steckt im anderen.', 'Ein Metallstift blockiert.']],
    ['Was bewirkt ein flüssiges, mittelfestes Schraubensicherungsmittel?', 'Es klebt das Gewinde und bleibt mit Werkzeug lösbar', ['Es schmiert das Gewinde und senkt die Reibung im Gewinde stark', 'Es verschweißt Schraube und Mutter dauerhaft', 'Es dichtet nur gegen Wasser, hält aber nicht'], 'Das Mittel härtet im Gewindespalt aus und verhindert selbsttätiges Lösen. Mittelfest bedeutet: Mit Handwerkzeug lässt sich die Schraube noch lösen.', ['Es ist ein Kleber für das Gewinde.', 'Mittelfest: noch lösbar.']],
    ['Wogegen sichert man eine Schraubverbindung vor allem?', 'Gegen selbsttätiges Lösen durch Vibration und Setzen', ['Gegen Korrosion am Schraubenkopf', 'Gegen das Überschreiten der Zugfestigkeit des Werkstoffs', 'Gegen ein zu hohes Anzugsmoment beim Montieren'], 'Schwingungen und Setzen der Auflageflächen können die Vorspannkraft abbauen. Sicherungen verhindern das Losdrehen.', ['Denke an eine Maschine, die ständig vibriert.', 'Es geht um das Lockern im Betrieb.']],
    ['An einer vibrierenden Maschine lockert sich eine Schraube wiederholt. Was prüfst du zuerst?', 'Ob Anzugsmoment und Sicherung zur Verbindung passen', ['Ob ein längeres Gewinde eingeschnitten werden kann', 'Ob die Mutter noch weiter bis zum Anschlag überdreht werden kann', 'Ob die Schraube eine auffälligere Farbe hat'], 'Eine ausreichende Vorspannkraft ist die Grundlage. Zusätzlich muss die Sicherung zur Belastung passen. Überdrehen schädigt die Schraube.', ['Wie fest ist sie angezogen, und womit gesichert?', 'Mehr Kraft ist nicht immer besser.']],
    ['Wie wirkt eine Gegenmutter?', 'Sie wird gegen die erste Mutter gekontert und verspannt', ['Sie ersetzt die Unterlegscheibe unter dem Schraubenkopf', 'Sie verlängert die Schraube und erhöht so die Festigkeit', 'Sie schließt das Gewinde dicht gegen Flüssigkeit'], 'Zwei Muttern werden gegeneinander angezogen. Die Verspannung der Gewindeflanken erhöht die Reibung und verhindert das Losdrehen.', ['Zwei Muttern werden gegeneinander verspannt.', 'Konterung ist eine Sicherung durch Reibung.']]
  ];
  const VZQ = [
    ['Warum verzieht sich ein Blech beim Schweißen?', 'Die Naht schrumpft beim Abkühlen und zieht das Blech', ['Der Lichtbogen magnetisiert das Blech und biegt es dabei', 'Das Schutzgas drückt von oben auf das Blech', 'Die Elektrode verliert beim Abbrennen an Gewicht'], 'Die erhitzte Zone dehnt sich aus und zieht sich beim Abkühlen zusammen. Weil das kalte Material sie hält, entstehen Spannungen und Verzug.', ['Denke an Erwärmen und Abkühlen.', 'Wärme dehnt aus, Abkühlen zieht zusammen.']],
    ['Welche Maßnahme verringert den Verzug beim Schweißen?', 'Heftstellen setzen und das Werkstück spannen', ['Die Naht möglichst dick (großes a-Maß) auslegen', 'Alle Nähte nacheinander auf einer Seite schweißen', 'Langsam mit hoher Stromstärke schweißen'], 'Heften und Spannen halten die Lage der Teile, ein kleines a-Maß bringt wenig Wärme ein, und eine wechselnde Schweißfolge verteilt die Schrumpfung.', ['Die Teile sollen sich nicht frei bewegen können.', 'Weniger Wärme heißt weniger Verzug.']],
    ['Eine Kehlnaht wird von a = 3 mm auf a = 6 mm verdoppelt. Was passiert mit dem Nahtquerschnitt (a²) und damit mit dem Verzug?', 'Der Querschnitt wird vierfach, der Verzug wächst', ['Der Querschnitt wird doppelt, der Verzug halbiert sich', 'Der Querschnitt bleibt gleich, der Verzug bleibt gleich', 'Der Querschnitt wird vierfach, der Verzug sinkt'], 'A = a²: Aus 9 mm² werden 36 mm². Mehr Nahtvolumen heißt mehr Wärme, mehr Schrumpfung und mehr Verzug. Ein unnötig großes a-Maß schadet also.', ['Rechne a² für beide Fälle.', 'Mehr Schweißgut bedeutet mehr Wärme.']],
    ['Eine lange Naht wird im Pilgerschritt geschweißt. Welchen Vorteil hat das?', 'Die Wärme verteilt sich, der Verzug bleibt kleiner', ['Die Naht wird dadurch deutlich dicker und fester', 'Die Naht braucht dadurch weniger Zusatzwerkstoff', 'Die Schlacke fällt dadurch ganz von allein wieder ab'], 'Beim Pilgerschritt schweißt man kurze Stücke in wechselnder Richtung und an verschiedenen Stellen. Das Blech erwärmt sich nicht an einer Stelle.', ['Kurze Abschnitte mit Abstand.', 'Die Wärme wird verteilt.']],
    ['Wie wirkt eine wechselseitige (symmetrische) Schweißfolge?', 'Die Schrumpfkräfte heben sich teilweise auf', ['Die Naht wird dadurch glatter und schöner', 'Das Schutzgas wird dabei besser ausgenutzt und gespart', 'Der Lichtbogen brennt dabei deutlich ruhiger'], 'Schweißt man abwechselnd links und rechts, ziehen die Nähte in entgegengesetzte Richtungen, und die Verformungen heben sich teilweise auf.', ['Zwei Nähte ziehen in unterschiedliche Richtungen.', 'Gegenläufige Kräfte gleichen sich aus.']]
  ];
  /* PRUEFEN P23: Fragen zu Verzug und Gegenmaßnahmen (Heften, Spannen, Schweißfolge, kleines a-Maß, Pilgerschritt) sind vereinfacht und in eigenen Worten. Passt die Darstellung zur Praxis in der Werkstatt? */
  /* PRUEFEN P24: Fehlerbild B (Schweißfehler): Zuordnung Beobachtung → Ursache (Zugluft, Wärmeeinbringung, Verzug, Spannung/Vorschub, Strom). Die Fälle sind vereinfacht und in eigenen Worten. Fehlen häufige Fehlerbilder (Risse, Wurzelfehler), oder stimmt die Gewichtung? */
  const FSBS = [
    ['Beim MAG-Schweißen in einer Halle zeigt die Naht viele kleine Poren. Ein Fenster steht offen, es zieht deutlich. Gasmenge und Draht sind wie sonst eingestellt.', 'Zugluft bläst das Schutzgas von der Schweißstelle', ['Die Stromstärke ist deutlich zu hoch eingestellt worden', 'Das Blech ist zu dick für dieses Verfahren', 'Der Draht ist nicht fest genug aufgespult'], 'Poren entstehen, wenn Luft ins Schmelzbad gelangt. Zugluft zerstört die Gasglocke. Abhilfe: Windschutz, Gasmenge prüfen, Brennerabstand.', ['Wohin gehört die Gasglocke?', 'Was stört sie, obwohl die Einstellung stimmt?']],
    ['Eine Kehlnaht sieht äußerlich gut aus, lässt sich aber an der Flanke leicht vom Blech abheben. Ein Einbrand ist kaum zu erkennen.', 'Zu wenig Wärme: Strom zu klein oder zu schnell geführt', ['Es wurde viel zu viel Schutzgas an der Düse verwendet', 'Das a-Maß der Naht ist viel zu groß geplant worden', 'Die Brennerführung war insgesamt zu langsam und zu steil'], 'Ein Bindefehler entsteht, wenn der Grundwerkstoff nicht aufgeschmolzen wird. Das Schweißgut liegt nur auf. Abhilfe: mehr Wärme, langsamer führen, saubere Flanken.', ['Was fehlt, damit Grund- und Zusatzwerkstoff verschmelzen?', 'Bei zu langsamer Führung gäbe es zu viel Wärme.']],
    ['Nach dem Schweißen ist das dünne Blech wellig und stark gebogen. Die lange Naht wurde in einem Zug mit hoher Stromstärke geschweißt, ohne Heftstellen.', 'Zu viel Wärme in einem Zug, ohne Heftstellen und Schweißfolge', ['Zu wenig Zusatzwerkstoff wurde in der Naht verarbeitet und aufgetragen', 'Die Schlacke wurde nach dem Schweißen nicht entfernt', 'Das Schutzgas war beim Schweißen viel zu kalt'], 'Ein dünnes Blech reagiert empfindlich auf Wärme. Heften, Spannen, Pilgerschritt und geringere Stromstärke begrenzen die Schrumpfung.', ['Verzug entsteht durch Wärme und Schrumpfung.', 'Was hätte vor dem Schweißen die Lage gesichert?']],
    ['Neben der Naht sind Rillen ins Blech eingebrannt (Einbrandkerben). Der Lichtbogen war sehr lang und die Stromstärke hoch.', 'Zu hohe Stromstärke und zu großer Lichtbogen', ['Die Naht wurde mit zu kleinem a-Maß geplant und gesetzt', 'Das Blech wurde nicht gereinigt', 'Der Draht war zu dünn für das Gerät'], 'Zu viel Energie schmilzt das Blech neben der Naht an, ohne dass Zusatzwerkstoff nachfließt. Es bleibt eine Kerbe, die die Festigkeit mindert.', ['Wo kommt die zusätzliche Energie her?', 'Kerben entstehen neben der Naht.']],
    ['Beim MAG-Schweißen spritzt es stark, der Lichtbogen ist unruhig und knallt. Gas und Blech sind in Ordnung.', 'Spannung und Drahtvorschub passen nicht zueinander', ['Es wurde zu viel Argon im Mischgas zugemischt', 'Das Blech war vorher viel zu gründlich gereinigt worden', 'Das Blech war eindeutig zu dünn für den Draht'], 'Spannung (Lichtbogenlänge) und Drahtvorschub (Strom) müssen aufeinander abgestimmt sein. Sonst ist der Lichtbogen unruhig und es spritzt.', ['Zwei Einstellungen gehören zusammen.', 'Lichtbogenlänge und Drahtgeschwindigkeit.']]
  ];
  /* PRUEFEN P25: Fehlerbild C (Löten und Kleben): Zuordnung Beobachtung → Ursache (Fett auf der Fläche, Schälbelastung, oxidierte Fläche ohne Flussmittel, zu weiter Spalt, Aushärtezeit). Die Fälle sind vereinfacht. Fehlen häufige Ursachen (z. B. zu geringe Löttemperatur, ungeeigneter Klebstoff)? */
  const FSCS = [
    ['Ein geklebtes Typschild löst sich nach kurzer Zeit glatt ab, der Klebstoff haftet nur am Schild. Das Blech war vor dem Kleben ölig.', 'Die Fläche wurde nicht entfettet', ['Die Klebfläche war zu groß geplant', 'Die Aushärtezeit wurde zu lange abgewartet', 'Die Klebschicht war zu dünn'], 'Öl und Fett verhindern die Haftung (Adhäsion). Der Klebstoff kann nicht am Metall anbinden. Vor dem Kleben entfetten, aufrauen und erneut entfetten.', ['Wo haftet der Klebstoff nicht?', 'Was liegt zwischen Blech und Klebstoff?']],
    ['Eine Überlappungsklebung hält im Zugversuch gut, versagt aber, sobald man an der Kante abzieht.', 'Die Belastung wirkt als Schälen statt als Schub', ['Der Klebstoff wurde viel zu kalt gelagert und verarbeitet', 'Die Flächen wurden zu stark und zu grob aufgeraut', 'Die Teile wurden zu fest zusammengepresst'], 'Bei Schub trägt die ganze Fläche, beim Schälen nur die Kante. Abhilfe: Konstruktion ändern, Schälkräfte vermeiden.', ['Wie ist die Kraft gerichtet?', 'Kante oder ganze Fläche?']],
    ['Das Lot perlt beim Löten einer Kupferverbindung ab und benetzt die Fläche nicht. Die Fläche war schon matt und dunkel angelaufen.', 'Fläche oxidiert, Flussmittel oder Reinigung fehlt', ['Der Lötspalt wurde viel zu eng gewählt und gefertigt', 'Das Lot hat zu niedrige Schmelztemperatur', 'Das Rohr wurde zu kurz in die Muffe geschoben'], 'Oxide verhindern die Benetzung. Fläche blank machen und Flussmittel auftragen, damit das Lot fließt.', ['Was sitzt zwischen Lot und Metall?', 'Wofür gibt es Flussmittel?']],
    ['Eine Hartlötung am Rohr ist an der Oberkante gefüllt, tiefer im Spalt aber hohl. Die Muffe sitzt sehr locker auf dem Rohr.', 'Der Spalt ist zu weit, die Kapillarwirkung reicht nicht', ['Der Spalt ist viel zu eng, das Lot kommt nicht hinein', 'Die Fläche war übertrieben sauber und blank vorbereitet', 'Das Flussmittel wurde zu dünn aufgetragen'], 'Nur in einem engen Spalt zieht die Kapillarkraft das Lot hinein. Bei großem Spiel bleibt Luft, und die Festigkeit sinkt.', ['Wie breit ist der Spalt?', 'Kapillarkräfte brauchen enge Spalte.']],
    ['Eine Epoxid-Klebung ist nach einer Stunde noch weich und gibt nach. Die Teile wurden gleich nach dem Fügen belastet.', 'Die Aushärtezeit wurde nicht abgewartet', ['Die Klebfläche war zu groß', 'Der Klebstoff wurde zu dünn aufgetragen', 'Die Fläche wurde zu sorgfältig entfettet'], 'Klebstoffe brauchen die Zeit und Temperatur aus dem Datenblatt. Vorher sind die Teile nur fixiert, nicht belastbar.', ['Datenblatt: Handfestigkeit und Endfestigkeit.', 'Wann trägt eine Klebung?']]
  ];

  /* ---------- Hilfs-Zufall ---------- */
  const cnt = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const TQ = (M, c) => C().torque(M, c);
  const torqText = () => C().TORQ_ORDER.map(m => m + ': 8.8 = ' + f(TQ(m, '8.8'), 1) + ', 10.9 = ' + f(TQ(m, '10.9'), 1) + ', 12.9 = ' + f(TQ(m, '12.9'), 1)).join('\n');

  /* ---------- Generatoren ---------- */
  const G = {
    dinq: pq(DINQ),
    schluss: R => {
      const c = C(), ROWS = [['Schweißen', 0], ['Löten', 0], ['Kleben', 0], ['Nieten', 1], ['Passfeder', 1], ['Bolzen mit Sicherungsring', 1], ['Schrauben', 2], ['Pressverband', 2], ['Klemmen', 2]], rows = c.shuffle(R, ROWS);
      let sel = rows.slice(0, 4);
      while (new Set(sel.map(r => r[1])).size < 2) sel = c.shuffle(R, ROWS).slice(0, 4);
      return matchQ(R, 'Ordne jedem Fügeverfahren die passende Schlussart zu.', sel.map(r => r[0]), ['Stoffschluss', 'Formschluss', 'Kraftschluss'], sel.map(r => r[1]),
        'Stoffschluss: Die Teile werden durch Stoff verbunden (Schweißen, Löten, Kleben). Formschluss: Die Form greift ineinander (Niet, Passfeder, Bolzen). Kraftschluss: Reibung durch Anpressen (Schrauben, Pressverband, Klemmen).', ['Wird etwas aufgeschmolzen oder geklebt? Das ist Stoffschluss.', 'Greift ein Teil in das andere? Das ist Formschluss. Reibung durch Anpressen ist Kraftschluss.']);
    },
    loesbar: pq(LOQ),
    swverf: R => {
      const c = C(), k = c.pick(R, [111, 131, 135, 141]), P = c.PROC[k], names = [111, 131, 135, 141].map(x => c.PROC[x].n);
      if (R() < 0.5) return choiceQ(R, 'Ein Schweißverfahren trägt die Ordnungsnummer ' + k + ' (ISO 4063). Welches ist es?', P.n, names.filter(n => n !== P.n), 'Nummer 111 ist das Lichtbogenhandschweißen, 131 MIG, 135 MAG und 141 WIG. ' + P.n + ': ' + P.k + '.', ['Die Nummern stehen im Hilfe-Reiter.', 'Die vierte Stelle (1, 3, 5, 1) unterscheidet die Verfahren.'], { k: 'verf', id: 'sw' });
      return choiceQ(R, 'Welches Schweißverfahren ist hier beschrieben? ' + P.k + '.', P.n, names.filter(n => n !== P.n), 'Ordnungsnummer ' + k + ': ' + P.n + '. Schutzgas: ' + P.gas + '.', ['Achte auf Elektrode und Schutzgas.', 'Aktiv oder inert beim Schutzgas?'], { k: 'verf', id: 'sw' });
    },
    nahta: R => {
      const c = C(), a = c.pick(R, [3, 4, 5, 6, 7]), l = c.pick(R, [40, 50, 60, 80, 100, 120, 150]), v = a * l;
      return numQ('Eine Kehlnaht hat ein a-Maß von ' + a + ' mm und eine wirksame Länge von ' + l + ' mm. Wie groß ist die tragende Nahtfläche A = a · l?', v, 'mm²', 'Nahtfläche A', 0, 'A = a · l = ' + a + ' mm · ' + l + ' mm = ' + f(v, 0) + ' mm².', ['Die tragende Fläche ist ein Rechteck aus Nahtdicke und Länge.', 'Multipliziere a mit l.'], { k: 'kehl', a, l, showA: true, showL: true });
    },
    zmass: R => {
      const c = C();
      if (R() < 0.6) { const z = c.pick(R, [4, 5, 6, 7, 8, 10]), v = c.kehlA(z); return numQ('Eine gleichschenklige Kehlnaht hat ein z-Maß (Schenkellänge) von ' + z + ' mm. Wie groß ist das a-Maß (Nahtdicke) in mm? Zwei Nachkommastellen.', v, 'mm', 'a-Maß', 0.03, 'a = z / √2 = ' + z + ' mm / 1,414 = ' + f(v, 2) + ' mm. Das a-Maß ist die Höhe des einbeschriebenen Dreiecks.', ['Das a-Maß ist die Höhe des Dreiecks, nicht der Schenkel.', 'Teile das z-Maß durch √2 ≈ 1,414.'], { k: 'kehl', z, showZ: true, showA: false }); }
      const a = c.pick(R, [2, 3, 4, 5, 6]), v = c.kehlZ(a);
      return numQ('Eine gleichschenklige Kehlnaht hat ein a-Maß (Nahtdicke) von ' + a + ' mm. Wie groß ist das z-Maß (Schenkellänge) in mm? Zwei Nachkommastellen.', v, 'mm', 'z-Maß', 0.03, 'z = a · √2 = ' + a + ' mm · 1,414 = ' + f(v, 2) + ' mm.', ['Das z-Maß ist länger als das a-Maß.', 'Multipliziere a mit √2 ≈ 1,414.'], { k: 'kehl', a, showA: true, showZ: false });
    },
    nsym: R => {
      const c = C(), m = c.ri(R, 0, 2);
      if (m === 0) { const s = c.pick(R, ['I', 'V', 'Y', 'U', 'K', 'P']), names = ['I', 'V', 'Y', 'U', 'K', 'P'].map(x => c.NAHT[x].n), right = c.NAHT[s].n, wrong = c.shuffle(R, names.filter(n => n !== right)).slice(0, 3);
        return choiceQ(R, 'Im Nahtsymbol auf der Zeichnung steht das gezeigte Zeichen. Welche Nahtart ist gemeint?', right, wrong, 'Das Symbol zeigt die Nahtart: ' + right + '. ' + c.NAHT[s].d + '.', ['Vergleiche mit der Tabelle im Hilfe-Reiter.', 'Das Dreieck steht für Kehlnähte, die zwei Striche für die I-Naht.'], { k: 'naht', sym: s, plain: true }); }
      const a = c.ri(R, 3, 6), l = c.pick(R, [60, 80, 100, 120]), vz = { k: 'naht', sym: 'K', a, l, plain: true }, ch = ['Nahtdicke a in mm', 'Nahtlänge in mm', 'Schenkellänge z in mm', 'Anzahl der Nähte'];
      return choiceQ(R, m === 1 ? 'Neben dem Kehlnahtsymbol steht links die Angabe a' + a + '. Was bedeutet sie?' : 'Neben dem Kehlnahtsymbol steht rechts die Zahl ' + l + '. Was bedeutet sie?', m === 1 ? ch[0] : ch[1], ch.filter((_, i) => i !== (m === 1 ? 0 : 1)), m === 1 ? 'Das a-Maß steht vor dem Symbol: a' + a + ' bedeutet eine Nahtdicke von ' + a + ' mm.' : 'Die Zahl hinter dem Symbol ist die Nahtlänge in mm.', ['Vor dem Symbol steht das Maß des Querschnitts, dahinter die Länge.', m === 1 ? 'a steht für die Höhe des Dreiecks.' : 'Welche Maße gibt es noch außer dem Querschnitt?'], vz);
    },
    spos: R => {
      const c = C(), keys = Object.keys(c.POS), k = c.pick(R, keys), name = x => x + ' – ' + c.POS[x].n, wrong = c.shuffle(R, keys.filter(x => x !== k)).slice(0, 3).map(name);
      if (R() < 0.7) return choiceQ(R, 'Welche Schweißposition ist hier beschrieben? ' + c.POS[k].k, name(k), wrong, 'Position ' + k + ' (' + c.POS[k].n + '): ' + c.POS[k].k, ['Die Buchstaben PA bis PG stehen im Hilfe-Reiter.', 'Wo liegt die Naht, und wie ist sie erreichbar?']);
      return choiceQ(R, 'Wie wird die Schweißposition ' + k + ' bezeichnet?', c.POS[k].n, c.shuffle(R, keys.filter(x => x !== k)).slice(0, 3).map(x => c.POS[x].n), 'Position ' + k + ' heißt ' + c.POS[k].n + '. ' + c.POS[k].k, ['Die Buchstaben PA bis PG stehen im Hilfe-Reiter.', 'P steht für Position.']);
    },
    nstress: R => {
      const c = C(), a = c.pick(R, [3, 4, 5]), l = c.pick(R, [40, 50, 60, 80]), tau = c.pick(R, [40, 50, 60, 75, 80, 90, 100]), F = tau * 2 * a * l;
      return numQ('Eine Konsole ist mit zwei gleichen Kehlnähten angeschweißt (a = ' + a + ' mm, wirksame Länge je Naht l = ' + l + ' mm) und wird mit F = ' + f(F, 0) + ' N auf Schub belastet. Wie groß ist die Schubspannung in der Naht τ = F / (n · a · l)? Rechne mit n = 2.', tau, 'N/mm²', 'Schubspannung', 0.06, 'Tragende Fläche: 2 · ' + a + ' mm · ' + l + ' mm = ' + f(2 * a * l, 0) + ' mm². τ = ' + f(F, 0) + ' N / ' + f(2 * a * l, 0) + ' mm² = ' + f(tau, 1) + ' N/mm².', ['Erst die gesamte Nahtfläche ausrechnen (zwei Nähte).', 'Dann die Kraft durch diese Fläche teilen.'], { k: 'kehl', a, l, F, n: 2, showA: true, showL: true });
    },
    szusatz: R => {
      const c = C(), a = c.pick(R, [3, 4, 5, 6]), l = c.pick(R, [200, 300, 400, 500, 800]), v = c.seamMass(a, l);
      return numQ('Eine Kehlnaht mit a = ' + a + ' mm und l = ' + l + ' mm soll geschweißt werden. Rechne mit dem Dreiecksquerschnitt (a²), ohne Zuschläge, und mit der Dichte von Stahl 7,85 g/cm³. Wie viel Schweißgut (Masse) wird mindestens gebraucht? Eine Nachkommastelle.', v, 'g', 'Masse Schweißgut', 0.06,
        'Querschnitt A = a² = ' + f(a * a, 0) + ' mm². Volumen V = A · l = ' + f(a * a * l, 0) + ' mm³ = ' + f(a * a * l / 1000, 2) + ' cm³. Masse m = V · ρ = ' + f(a * a * l / 1000, 2) + ' cm³ · 7,85 g/cm³ = ' + f(v, 2) + ' g.', ['Volumen = Querschnitt mal Länge, dann Umrechnung von mm³ in cm³ (1 cm³ = 1000 mm³).', 'Masse = Volumen mal Dichte.'], { k: 'kehl', a, l, showA: true, showL: true });
    },
    sverzug: pq(VZQ),
    wh: R => {
      if (R() < 0.3) return G.whq(R);
      const c = C(), T = c.pick(R, [180, 230, 250, 300, 380, 420, 620, 680, 720, 850]), kind = c.solderKind(T), right = kind === 'weich' ? 'Weichlöten' : 'Hartlöten';
      return choiceQ(R, 'Ein Lot hat eine Arbeitstemperatur von ' + T + ' °C. Um welches Verfahren handelt es sich?', right, ['Weichlöten', 'Hartlöten', 'Hochtemperaturlöten', 'Schweißen'].filter(x => x !== right), 'Die Grenze zwischen Weich- und Hartlöten liegt bei 450 °C. ' + T + ' °C liegen ' + (kind === 'weich' ? 'darunter: Weichlöten' : 'darüber: Hartlöten') + '. Hochtemperaturlöten beginnt erst bei etwa 900 °C.', ['Die Grenze liegt bei 450 °C.', 'Schweißen ist es nicht: Dort schmilzt auch der Grundwerkstoff.']);
    },
    whq: pq(WHQ),
    fluss: pq([
      ['Wozu braucht man beim Löten Flussmittel?', 'Es löst Oxide, schützt und lässt das Lot benetzen', ['Es kühlt die Lötstelle und verhindert Spannungen', 'Es senkt die Schmelztemperatur des Grundwerkstoffs', 'Es erhöht die Festigkeit des Lots dauerhaft'], 'Flussmittel entfernen den dünnen Oxidfilm und verhindern neue Oxidation beim Erwärmen. So kann das flüssige Lot die Fläche benetzen.', ['Oxide stören die Benetzung.', 'Das Flussmittel arbeitet an der Oberfläche.']],
      ['Warum entfernt man Flussmittelreste nach dem Löten oft?', 'Aggressive Reste können später Korrosion auslösen', ['Sie machen die Lötstelle später viel zu hart und spröde', 'Sie verhindern, dass das Lot erstarrt', 'Sie erhöhen die Zugfestigkeit der Naht zu stark'], 'Viele Flussmittel sind chemisch aktiv. Bleiben Reste zurück, greifen sie das Metall mit der Zeit an.', ['Chemisch aktive Stoffe bleiben aktiv.', 'Denke an Korrosion.']],
      ['Was geschieht ohne Flussmittel an einer oxidierten Fläche?', 'Das Lot benetzt die Fläche schlecht und perlt ab', ['Das Lot schmilzt bei niedrigerer Temperatur', 'Der Spalt füllt sich schneller und vollständiger', 'Die Fläche reinigt sich beim Löten von selbst'], 'Ohne Flussmittel bleibt der Oxidfilm, das Lot bildet Tropfen statt eines Films und fließt nicht in den Spalt.', ['Benetzung ist der Schlüssel.', 'Tropfen statt Film.']],
      ['Wann wird das Flussmittel aufgetragen?', 'Vor dem Erwärmen auf die gereinigte Fügefläche', ['Erst nach dem vollständigen Erstarren des Lots', 'Nur auf das Lot, nie auf das Werkstück', 'Nachdem die Fläche absichtlich stark oxidiert wurde'], 'Das Flussmittel muss schon beim Erwärmen auf der Fläche liegen, damit es sie vor neuer Oxidation schützt.', ['Es soll vor Oxidation schützen.', 'Vor dem Erwärmen, nicht danach.']],
      ['Wie bereitest du eine Kupferrohr-Fügefläche zum Löten vor?', 'Blank reinigen (z. B. mit Vlies) und entfetten', ['Mit Öl einsprühen, damit sie nicht oxidiert', 'Grob mit dem Meißel tief aufrauen und anritzen', 'Mit Lack versiegeln'], 'Eine blanke, fettfreie Fläche ist die Voraussetzung dafür, dass das Lot benetzt. Öl und Lack verhindern das Löten.', ['Sauber und blank.', 'Fett und Öl gehören nicht auf die Lötstelle.']]
    ]),
    gapcalc: R => {
      const c = C(), d = c.pick(R, [12, 15, 18, 22, 28]), s = c.pick(R, [0.05, 0.08, 0.1, 0.12, 0.15, 0.2]), D = rdn(d + 2 * s);
      return numQ('Ein Kupferrohr (Außendurchmesser d = ' + f(d, 1) + ' mm) steckt in einer Lötmuffe (Innendurchmesser D = ' + f(D, 2) + ' mm). Wie breit ist der Lötspalt (auf einer Seite, radial) in mm? Zwei Nachkommastellen.', s, 'mm', 'Spaltbreite', 0.006, 'Der Spalt ist der halbe Durchmesserunterschied: s = (D − d) / 2 = (' + f(D, 2) + ' − ' + f(d, 1) + ') / 2 = ' + f(s, 3) + ' mm.', ['Der Unterschied der Durchmesser verteilt sich auf beide Seiten.', 'Teile den Unterschied durch 2.'], { k: 'loet', D, d, showD: true, hideS: true });
    },
    gapq: R => {
      const c = C(), kind = c.pick(R, ['weich', 'hart']), s = c.pick(R, [0.02, 0.03, 0.1, 0.12, 0.25, 0.3, 0.4]), st = c.gapState(kind, s), lim = c.GAP[kind];
      const right = st === 'ok' ? 'Der Spalt passt, das Lot füllt ihn gut' : st === 'eng' ? 'Der Spalt ist zu eng, Lot und Flussmittel kommen schlecht hinein' : 'Der Spalt ist zu weit, die Kapillarwirkung lässt nach';
      const all = ['Der Spalt passt, das Lot füllt ihn gut', 'Der Spalt ist zu eng, Lot und Flussmittel kommen schlecht hinein', 'Der Spalt ist zu weit, die Kapillarwirkung lässt nach', 'Der Spalt spielt keine Rolle, das Lot füllt jeden Spalt'];
      return choiceQ(R, 'Beim ' + (kind === 'weich' ? 'Weichlöten' : 'Hartlöten') + ' liegt der Übungsbereich für den Lötspalt bei ' + f(lim.lo, 2) + ' bis ' + f(lim.hi, 2) + ' mm. Hier misst der Spalt ' + f(s, 2) + ' mm. Was ist zu erwarten?', right, all.filter(x => x !== right), 'Spalt ' + f(s, 2) + ' mm, Bereich ' + f(lim.lo, 2) + ' bis ' + f(lim.hi, 2) + ' mm: ' + (st === 'ok' ? 'Der Spalt liegt im Bereich.' : st === 'eng' ? 'Der Spalt ist kleiner als die untere Grenze.' : 'Der Spalt ist größer als die obere Grenze.') + ' Zu enge Spalte lassen Lot und Flussmittel kaum eindringen, zu weite verlieren die Kapillarkraft.', ['Vergleiche den Spalt mit den beiden Grenzwerten.', 'Kapillarwirkung wirkt nur im engen Spalt.'], { k: 'loet', D: 20 + 2 * 0.1, d: 20, showD: false, hideS: true });
    },
    lotkraft: R => {
      const c = C(), kind = c.pick(R, ['weich', 'hart']), d = c.pick(R, [12, 16, 20, 25]), l = c.pick(R, [10, 12, 15, 20]), tau = c.SOLDER_TAU[kind], A = c.brazeArea(d, l), v = tau * A / 1000;
      return numQ('Ein Rohr (Außendurchmesser ' + d + ' mm) ist auf einer Lötlänge von ' + l + ' mm in eine Muffe gelötet. Als Übungswert gilt eine Scherfestigkeit des Lots von ' + tau + ' N/mm² (' + (kind === 'weich' ? 'Weichlot' : 'Hartlot') + '). Die Lötfläche ist die Mantelfläche A = π · d · l. Welche Scherkraft in kN trägt die Lötstelle höchstens? Eine Nachkommastelle.', v, 'kN', 'Scherkraft', 0.06,
        'Lötfläche A = π · ' + d + ' mm · ' + l + ' mm = ' + f(A, 1) + ' mm². Kraft F = τ · A = ' + tau + ' N/mm² · ' + f(A, 1) + ' mm² = ' + f(tau * A, 0) + ' N = ' + f(v, 2) + ' kN.', ['Erst die Mantelfläche, dann mit der Scherfestigkeit multiplizieren.', 'Rechne in N und teile am Ende durch 1000.'], { k: 'loet', D: d + 0.2, d, showD: false, hideS: true });
    },
    klfl: R => {
      const c = C(), b = c.pick(R, [20, 25, 30, 40]), l = c.pick(R, [10, 12.5, 15, 20, 25]), v = b * l;
      return numQ('Zwei Blechstreifen sind einfach überlappt verklebt (Breite b = ' + f(b, 1) + ' mm, Überlappungslänge l = ' + f(l, 1) + ' mm). Wie groß ist die Klebfläche A in mm²?', v, 'mm²', 'Klebfläche', 0, 'A = b · l = ' + f(b, 1) + ' mm · ' + f(l, 1) + ' mm = ' + f(v, 1) + ' mm².', ['Die Klebfläche ist ein Rechteck.', 'Breite mal Überlappungslänge.'], { k: 'kleb', b, l, showA: true });
    },
    klablauf: R => orderQ(R, 'Bringe die Arbeitsschritte einer Klebung in die richtige Reihenfolge.', ['Fügeteile entfetten (reinigen)', 'Fügeflächen aufrauen (z. B. schleifen)', 'Staub entfernen und erneut entfetten', 'Klebstoff dünn und gleichmäßig auftragen', 'Teile fügen und fixieren', 'Aushärten lassen, nicht belasten'],
      'Erst entfetten, dann aufrauen, danach Staub und Reste entfernen und erneut entfetten. Dann Klebstoff auftragen, fügen, fixieren und die Aushärtezeit aus dem Datenblatt einhalten.', ['Reinigen kommt vor und nach dem Aufrauen.', 'Belastet wird erst nach dem Aushärten.']),
    klzug: R => {
      const c = C(), b = c.pick(R, [20, 25, 30, 40]), l = c.pick(R, [10, 12.5, 15, 20, 25]), A = b * l, tau = c.pick(R, [5, 8, 10, 12, 15, 18, 20]), F = tau * A;
      return numQ('Eine Überlappungsklebung (b = ' + f(b, 1) + ' mm, l = ' + f(l, 1) + ' mm) reißt im Zugversuch bei F = ' + f(F, 0) + ' N. Wie groß ist die Zugscherfestigkeit τ = F / A in N/mm²? Zwei Nachkommastellen genügen.', tau, 'N/mm²', 'Zugscherfestigkeit', 0.06, 'A = ' + f(b, 1) + ' · ' + f(l, 1) + ' = ' + f(A, 1) + ' mm². τ = ' + f(F, 0) + ' N / ' + f(A, 1) + ' mm² = ' + f(tau, 2) + ' N/mm².', ['Erst die Klebfläche, dann die Kraft durch diese Fläche teilen.', 'Die Einheit ist N/mm².'], { k: 'kleb', b, l, F, showA: true });
    },
    klbel: pq(BLQ),
    klzul: R => {
      const c = C(), S = c.pick(R, [2, 3, 4]), tauB = S * c.pick(R, [4, 5, 6, 7]), b = c.pick(R, [20, 25, 30, 40]), l = c.pick(R, [10, 15, 20, 25]), v = c.glueForceAllow(tauB, S, b * l);
      return numQ('Ein Klebstoff erreicht eine Bruchfestigkeit von ' + tauB + ' N/mm² (Übungswert). Mit dem Sicherheitsbeiwert S = ' + S + ' darf die Klebung eine Spannung von ' + f(tauB / S, 1) + ' N/mm² tragen. Die Klebfläche misst b = ' + b + ' mm, l = ' + l + ' mm. Welche Kraft darf die Klebung höchstens tragen?', v, 'N', 'zulässige Kraft', 0.6, 'τ_zul = ' + tauB + ' / ' + S + ' = ' + f(tauB / S, 2) + ' N/mm². A = ' + b + ' · ' + l + ' = ' + f(b * l, 0) + ' mm². F_zul = τ_zul · A = ' + f(v, 0) + ' N.', ['Kraft = zulässige Spannung mal Fläche.', 'Die zulässige Spannung ist Bruchfestigkeit geteilt durch S.'], { k: 'kleb', b, l, showA: true });
    },
    klfl2: R => {
      const c = C(), S = c.pick(R, [2, 3, 4]), tauB = c.pick(R, [12, 15, 20, 24, 30]), F = c.pick(R, [1500, 2400, 3000, 4500, 6000, 7500, 9000]), v = c.glueAreaNeed(F, S, tauB);
      return numQ('Eine Klebung soll eine Kraft von F = ' + f(F, 0) + ' N auf Schub übertragen. Klebstoff: Bruchfestigkeit ' + tauB + ' N/mm² (Übungswert), Sicherheitsbeiwert S = ' + S + '. Welche Klebfläche in mm² wird mindestens benötigt? Ganze mm² genügen.', v, 'mm²', 'erforderliche Klebfläche', 0.6, 'A = F · S / τ_B = ' + f(F, 0) + ' N · ' + S + ' / ' + tauB + ' N/mm² = ' + f(v, 1) + ' mm². Mindestens diese Fläche wird gebraucht (aufrunden).', ['Stelle F = τ_zul · A nach A um.', 'τ_zul = τ_B / S.'], { k: 'kleb', b: 25, l: 20, F, showA: false });
    },
    nietk: pq(NKQ),
    nietl: R => {
      const c = C(), t1 = c.pick(R, [1, 1.5, 2, 3]), t2 = c.pick(R, [2, 3, 4]), d = c.pick(R, [3, 4, 5, 6, 8]), v = c.rivetLen(t1 + t2, d);
      return numQ('Zwei Bleche (' + f(t1, 1) + ' mm und ' + f(t2, 1) + ' mm dick) werden mit einem Halbrundniet (d = ' + d + ' mm) verbunden. Für den Schließkopf rechnest du mit einem Überstand von 1,5 · d. Welche Nietlänge L in mm brauchst du rechnerisch?', v, 'mm', 'Nietlänge', 0.06, 'L = Summe der Blechdicken + 1,5 · d = ' + f(t1 + t2, 1) + ' mm + 1,5 · ' + d + ' mm = ' + f(v, 1) + ' mm.', ['Die Nietlänge ist Klemmlänge plus Überstand.', 'Der Überstand beträgt 1,5 mal Nietdurchmesser.'], { k: 'niet', t1, t2, d, showL: false });
    },
    steck: pq(STQ),
    nietf: R => {
      const c = C(), n = c.pick(R, [2, 3, 4, 6]), m = c.pick(R, [1, 2]), d = c.pick(R, [4, 5, 6, 8]), tau = 60, v = c.rivetForce(n, m, d, tau), tol = Math.max(2, rdn(v * 0.003));
      return numQ('Eine Nietverbindung hat ' + n + ' Niete (d = ' + d + ' mm), jeder ist ' + (m === 1 ? 'einschnittig' : 'zweischnittig') + ' belastet (' + m + ' Scherfläche' + (m > 1 ? 'n' : '') + '). Als Übungswert gilt eine zulässige Scherspannung von ' + tau + ' N/mm². Welche Kraft darf die Verbindung höchstens übertragen? Ganze N, rechne mit dem π deines Taschenrechners.', v, 'N', 'zulässige Kraft', tol, 'A je Scherfläche = π · d² / 4 = ' + f(c.rivetArea(d), 2) + ' mm². F = n · m · A · τ = ' + n + ' · ' + m + ' · ' + f(c.rivetArea(d), 2) + ' mm² · ' + tau + ' N/mm² = ' + f(v, 0) + ' N.', ['Erst die Fläche eines Nietschaftes, dann mit Zahl der Niete und Scherflächen malnehmen.', 'Zum Schluss mit der zulässigen Spannung multiplizieren.'], { k: 'niet', t1: 3, t2: 3, d, n, showL: false, F: 1 });
    },
    sklasse: R => {
      const c = C(), cl = c.pick(R, ['4.6', '5.6', '8.8', '10.9', '12.9']), v = c.boltRm(cl);
      return numQ('Auf dem Kopf einer Schraube steht ' + cl + '. Wie groß ist die Zugfestigkeit Rm (Nennwert) in N/mm²?', v, 'N/mm²', 'Zugfestigkeit Rm', 0, 'Die Zahl vor dem Punkt, mal 100, ergibt die Zugfestigkeit: ' + cl.split('.')[0] + ' · 100 = ' + f(v, 0) + ' N/mm².', ['Die erste Zahl steht für die Zugfestigkeit in Hundert N/mm².', 'Die zweite Zahl ist das Streckgrenzenverhältnis.'], { k: 'schraube', neutral: true });
    },
    skern: R => {
      const c = C(), m = c.pick(R, ['M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24']), B = c.BOLT[m];
      return numQ('Für ein Gewinde ' + m + ' (Steigung P = ' + f(B.P, 2) + ' mm) soll das Kernloch gebohrt werden. Faustwert: Nenndurchmesser minus Steigung. Welcher Bohrerdurchmesser in mm (Tabellenwert, eine Nachkommastelle) wird gebraucht?', B.kern, 'mm', 'Kernlochdurchmesser', 0.06, 'Faustwert d − P = ' + B.d + ' − ' + f(B.P, 2) + ' = ' + f(B.d - B.P, 2) + ' mm. Tabellenwert für ' + m + ': ' + f(B.kern, 1) + ' mm.', ['Nenndurchmesser minus Steigung.', 'Das Ergebnis liegt knapp unter dem Nenndurchmesser.'], { k: 'schraube', neutral: true });
    },
    sre: R => {
      const c = C(), cl = c.pick(R, ['4.6', '5.6', '8.8', '10.9', '12.9']), v = c.boltRe(cl);
      return numQ('Wie groß ist die Streckgrenze Re einer Schraube der Festigkeitsklasse ' + cl + ' in N/mm²? (Re = erste Zahl · zweite Zahl · 10)', v, 'N/mm²', 'Streckgrenze Re', 0, 'Re = ' + cl.split('.')[0] + ' · ' + cl.split('.')[1] + ' · 10 = ' + f(v, 0) + ' N/mm². Die Zugfestigkeit wäre ' + f(c.boltRm(cl), 0) + ' N/mm².', ['Multipliziere beide Zahlen und dann mit 10.', 'Beispiel 6.8 ergibt 480.'], { k: 'schraube', neutral: true });
    },
    smoment: R => {
      const c = C(), m = c.pick(R, c.TORQ_ORDER), cl = c.pick(R, c.TORQ_CLS), v = c.torque(m, cl);
      return numQ('Übungstabelle der Anzugsmomente in Nm:\n' + torqText() + '\nMit welchem Anzugsmoment wird eine Schraube ' + m + ' der Festigkeitsklasse ' + cl + ' angezogen?', v, 'Nm', 'Anzugsmoment', 0, 'Zeile ' + m + ', Spalte ' + cl + ': ' + f(v, 1) + ' Nm.', ['Suche erst die Zeile mit dem Gewinde.', 'Dann die Spalte mit der Festigkeitsklasse.'], { k: 'schraube', neutral: true });
    },
    sdurch: R => {
      const c = C(), m = c.pick(R, ['M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24']), v = c.BOLT[m].dh;
      return numQ('Eine Schraube ' + m + ' soll durch ein Bauteil gesteckt werden. Welchen Durchgangsloch-Durchmesser in mm wählst du (Reihe „mittel“, Tabelle im Hilfe-Reiter)?', v, 'mm', 'Durchgangsloch', 0.06, 'Durchgangsloch mittel für ' + m + ': ' + f(v, 1) + ' mm. Es ist größer als der Gewinde-Nenndurchmesser, damit sich die Teile ausrichten lassen.', ['Das Durchgangsloch ist etwas größer als der Nenndurchmesser.', 'Suche die Reihe mittel in der Tabelle.'], { k: 'schraube', neutral: true });
    },
    ssich: pq(SIQ),
    smont: R => orderQ(R, 'Bringe die Schritte beim Montieren einer Flanschverschraubung in die richtige Reihenfolge.', C().MONTAGE.slice(), 'Erst reinigen und prüfen, dann ausrichten und von Hand ansetzen. Danach kreuzweise in zwei Stufen anziehen (erst etwa die Hälfte, dann das Sollmoment) und zuletzt kontrollieren und sichern.', ['Von Hand ansetzen kommt vor dem Werkzeug.', 'Kreuzweise bedeutet gegenüberliegend.']),
    spre: R => {
      const c = C(), m = c.pick(R, ['M8', 'M10', 'M12', 'M16']), cl = c.pick(R, c.TORQ_CLS), M = c.torque(m, cl), d = c.BOLT[m].d, v = c.preload(M, d);
      return numQ('Eine Schraube ' + m + ' der Klasse ' + cl + ' wird mit ' + f(M, 0) + ' Nm angezogen. Mit der Faustformel F_V = M / (0,2 · d) (M in Nm, d in mm, Ergebnis in kN) ergibt sich welche Vorspannkraft in kN? Zwei Nachkommastellen genügen.', v, 'kN', 'Vorspannkraft', 0.06, 'F_V = ' + f(M, 0) + ' / (0,2 · ' + d + ') = ' + f(M, 0) + ' / ' + f(0.2 * d, 1) + ' = ' + f(v, 2) + ' kN.', ['Die Faustformel steht in der Aufgabe.', 'Das Ergebnis liegt im Bereich 10 bis 100 kN.'], { k: 'schraube', M: m, c: cl, ratio: c.utilPreload(v, m, cl) });
    },
    pfeder: R => {
      const c = C(), K = c.pick(R, c.KEYS), d = K.lo + c.ri(R, 1, Math.min(3, K.hi - K.lo)), what = c.pick(R, ['b', 'h', 't1']), lab = { b: 'Breite b der Passfeder', h: 'Höhe h der Passfeder', t1: 'Tiefe t1 der Wellennut' }, v = K[what];
      return numQ('Eine Welle hat einen Durchmesser von ' + d + ' mm. Eine Passfeder nach DIN 6885 (Form A) soll eingebaut werden. Suche in der Passfeder-Tabelle (Hilfe-Reiter): Wie groß ist die ' + lab[what] + ' in mm?', v, 'mm', lab[what], 0.06, 'Für Wellen über ' + K.lo + ' bis ' + K.hi + ' mm gilt b × h = ' + K.b + ' × ' + K.h + ' mm, Wellennuttiefe t1 = ' + f(K.t1, 1) + ' mm, Nabennuttiefe t2 = ' + f(K.t2, 1) + ' mm.', ['Suche die Zeile, in der der Wellendurchmesser zwischen „über“ und „bis“ liegt.', 'Die Zeile ist für den Bereich, in dem die Welle gerade noch liegt.'], { k: 'pass', d, hide: true });
    },
    ppress: R => {
      const c = C(), mat = c.pick(R, ['stahl', 'stahl', 'alu']), d = c.pick(R, [20, 30, 40, 50, 60, 80]), U = c.pick(R, [0.02, 0.03, 0.04, 0.05]), pl = c.pick(R, [0.02, 0.03, 0.04]), v = c.expandDT(U, pl, d, mat), al = c.ALPHA[mat].a;
      return numQ('Eine Nabe aus ' + c.ALPHA[mat].n + ' (α = ' + al + ' · 10⁻⁶ pro K) wird auf eine Welle mit d = ' + d + ' mm geschrumpft. Das Übermaß beträgt ' + f(U, 2) + ' mm, zum Fügen braucht es zusätzlich ' + f(pl, 2) + ' mm Spiel. Um wie viel Kelvin muss die Nabe erwärmt werden? ΔT = (Übermaß + Spiel) / (α · d). Ganze Kelvin.', v, 'K', 'Temperaturerhöhung', 1, 'Die Bohrung muss um ' + f(U + pl, 2) + ' mm wachsen. ΔT = ' + f(U + pl, 2) + ' mm / (' + al + ' · 10⁻⁶ · ' + d + ' mm) = ' + f(v, 1) + ' K.', ['Die Bohrung muss um Übermaß plus Spiel wachsen.', 'Die Längenausdehnung ist α · d · ΔT.'], { k: 'press', d, U, play: pl, mat });
    },
    ppflaech: R => {
      const c = C(), K = c.pick(R, c.KEYS.slice(3, 9)), d = K.lo + c.ri(R, 1, K.hi - K.lo), l = c.pick(R, [28, 36, 45, 56]), M = c.pick(R, [40, 60, 80, 100, 120]), ltr = c.keyLtr(l, K.b), v = c.keyPress(M, d, K.h, K.t1, ltr);
      return numQ('Eine Passfeder (Form A, runde Enden) b × h = ' + K.b + ' × ' + K.h + ' mm sitzt mit einer Länge von l = ' + l + ' mm in einer Welle mit d = ' + d + ' mm (Wellennuttiefe t1 = ' + f(K.t1, 1) + ' mm). Sie überträgt M = ' + M + ' Nm. Rechne mit der tragenden Länge l_tr = l − b und der tragenden Höhe h − t1. Wie groß ist die Flächenpressung p = 2 · M / (d · (h − t1) · l_tr) in N/mm²? Eine Nachkommastelle.', v, 'N/mm²', 'Flächenpressung', 0.06,
        'l_tr = ' + l + ' − ' + K.b + ' = ' + ltr + ' mm; h − t1 = ' + f(K.h - K.t1, 1) + ' mm; M = ' + f(M * 1000, 0) + ' N·mm. p = 2 · ' + f(M * 1000, 0) + ' / (' + d + ' · ' + f(K.h - K.t1, 1) + ' · ' + ltr + ') = ' + f(v, 2) + ' N/mm².', ['Rechne das Moment in N·mm um (1 Nm = 1000 N·mm).', 'Tragende Länge ist die Passfederlänge minus die Breite.'], { k: 'pass', d, hide: false, b: K.b, h: K.h, t1: K.t1, t2: K.t2 });
    },
    /* PRUEFEN P26: Fehlerbild A (Schraubverbindungen): Aus vier Verbindungen ist bei einer das Anzugsmoment der nächsthöheren Festigkeitsklasse (zu hoch) oder der niedrigeren (zu niedrig) benutzt worden. Die Folgen (Überlastung der Schraube bzw. zu wenig Vorspannkraft) sind vereinfacht dargestellt. */
    fsa: R => {
      const c = C(), NM = ['Getriebedeckel', 'Lagerflansch', 'Maschinenfuß', 'Motorkonsole', 'Pumpendeckel', 'Rahmenwinkel'], names = c.shuffle(R, NM).slice(0, 4), bad = c.ri(R, 0, 3), used = new Set(), rows = [];
      names.forEach((n, i) => {
        let m, cl;
        do { m = c.pick(R, c.TORQ_ORDER); cl = c.pick(R, c.TORQ_CLS); } while (used.has(m + cl));
        used.add(m + cl);
        let M = c.torque(m, cl);
        if (i === bad) { const alt = c.TORQ_CLS.filter(x => x !== cl && Math.abs(c.torque(m, x) - M) > 1); M = c.torque(m, c.pick(R, alt)); }
        rows.push({ n, m, cl, M });
      });
      const q = choiceQ(R, 'Du kontrollierst Schraubverbindungen. Übungstabelle der Anzugsmomente in Nm:\n' + torqText() + '\nDie Montageprotokolle nennen:\n' + rows.map(r => r.n + ': ' + r.m + ', Klasse ' + r.cl + ', angezogen mit ' + f(r.M, 1) + ' Nm').join('\n') + '\nBei einer Verbindung stimmt das Anzugsmoment nicht zur Tabelle. Welche ist es?', names[bad], names.filter((_, i) => i !== bad),
        names[bad] + ': ' + rows[bad].m + ' Klasse ' + rows[bad].cl + ' müsste mit ' + f(c.torque(rows[bad].m, rows[bad].cl), 1) + ' Nm angezogen werden, im Protokoll stehen ' + f(rows[bad].M, 1) + ' Nm. Ein zu hohes Moment überlastet die Schraube, ein zu niedriges lässt zu wenig Vorspannkraft entstehen. Alle anderen Zeilen entsprechen der Tabelle.', ['Vergleiche für jede Zeile das Moment mit der Tabelle.', 'Eine Zeile passt zu einer anderen Festigkeitsklasse.'], { k: 'schraube', neutral: true });
      q.meta = { rows, bad }; return q;
    },
    fsb: pq(FSBS.map(s => s)),
    fsc: pq(FSCS.map(s => s))
  };
  function rdn(v) { return Math.round(v * 1000) / 1000; }

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator */
  const defs = [
    [CATS[0], 1, 'Fügen im System', 'dinq'], [CATS[0], 1, 'Schlussarten', 'schluss'], [CATS[0], 2, 'Lösbar oder nicht', 'loesbar'],
    [CATS[1], 1, 'Verfahren erkennen', 'swverf'], [CATS[1], 1, 'Die Nahtfläche', 'nahta'], [CATS[1], 2, 'Vom z-Maß zum a-Maß', 'zmass'], [CATS[1], 2, 'Nahtsymbole lesen', 'nsym'], [CATS[1], 2, 'Schweißposition', 'spos'], [CATS[1], 2, 'Spannung in der Naht', 'nstress'], [CATS[1], 3, 'Menge Schweißgut', 'szusatz'], [CATS[1], 3, 'Wärme und Verzug', 'sverzug'],
    [CATS[2], 1, 'Weich oder hart', 'wh'], [CATS[2], 2, 'Flussmittel', 'fluss'], [CATS[2], 2, 'Der Lötspalt', 'gapcalc'], [CATS[2], 2, 'Passt der Spalt', 'gapq'], [CATS[2], 3, 'Was trägt die Lötstelle', 'lotkraft'],
    [CATS[3], 1, 'Die Klebfläche', 'klfl'], [CATS[3], 1, 'Klebvorgang ordnen', 'klablauf'], [CATS[3], 2, 'Zugscherfestigkeit', 'klzug'], [CATS[3], 2, 'Wie wird belastet', 'klbel'], [CATS[3], 2, 'Zulässige Kraft', 'klzul'], [CATS[3], 3, 'Fläche für die Last', 'klfl2'],
    [CATS[4], 1, 'Nieten, Klemmen, Stecken', 'nietk'], [CATS[4], 2, 'Die Nietlänge', 'nietl'], [CATS[4], 2, 'Sichern beim Stecken', 'steck'], [CATS[4], 3, 'Was hält der Niet', 'nietf'],
    [CATS[5], 1, 'Festigkeitsklasse lesen', 'sklasse'], [CATS[5], 1, 'Kernloch bohren', 'skern'], [CATS[5], 2, 'Streckgrenze der Schraube', 'sre'], [CATS[5], 2, 'Anzugsmoment aus Tabelle', 'smoment'], [CATS[5], 2, 'Das Durchgangsloch', 'sdurch'], [CATS[5], 2, 'Schrauben sichern', 'ssich'], [CATS[5], 2, 'Schraube montieren', 'smont'], [CATS[5], 3, 'Vorspannkraft', 'spre'],
    [CATS[6], 2, 'Passfeder wählen', 'pfeder'], [CATS[6], 3, 'Pressverband fügen', 'ppress'], [CATS[6], 3, 'Passfeder tragen', 'ppflaech'],
    [CATS[7], 2, 'Fehlerbild A', 'fsa'], [CATS[7], 3, 'Fehlerbild B', 'fsb'], [CATS[7], 3, 'Fehlerbild C', 'fsc']
  ];
  const tasks = defs.map((d, i) => ({ id: 'fug' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('fug-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Auswertung (rein, ohne DOM) ---------- */
  /* Antwortformen a: { c } Auswahl, { v } Zahl (Text), { o } Reihenfolge (Indexliste), { m } Zuordnung (Indexliste).
     Ergebnis: { err } bei unvollständiger Antwort, sonst { ok, given } */
  function evaluate(q, a) {
    const c = C(), as = q.ask; a = a || {};
    if (as.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === as.correct, given: as.choices[a.c] }; }
    if (as.type === 'num') { const v = c.parseDe(a.v); if (!Number.isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (as.unit ? ' ' + as.unit : '') }; }
    if (as.type === 'order') { const o = a.o || []; if (o.length < as.items.length) return { err: 'Tippe alle Einträge in der richtigen Reihenfolge an.' }; return { ok: as.correct.every((x, i) => o[i] === x), given: o.map(i => as.items[i]).join(' → ') }; }
    if (as.type === 'match') { const m = a.m || []; if (as.rows.some((_, i) => m[i] == null)) return { err: 'Wähle für jede Zeile eine Zuordnung.' }; return { ok: as.correct.every((x, i) => m[i] === x), given: as.rows.map((r, i) => r + ' → ' + as.options[m[i]]).join('; ') }; }
    return { err: 'Unbekannte Frageform.' };
  }
  function solAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: as.correct };
    if (as.type === 'num') return { v: String(+q.value.toFixed(6)).replace('.', ',') };
    if (as.type === 'order') return { o: as.correct.slice() };
    return { m: as.correct.slice() };
  }
  function wrongAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: (as.correct + 1) % as.choices.length };
    if (as.type === 'num') return { v: '-12345' };
    if (as.type === 'order') return { o: as.correct.slice().reverse() };
    return { m: as.correct.map(x => (x + 1) % as.options.length) };
  }
  function solText(q) {
    const as = q.ask;
    if (as.type === 'choice') return as.choices[as.correct];
    if (as.type === 'num') return f(q.value, 2) + (as.unit ? ' ' + as.unit : '');
    if (as.type === 'order') return as.correct.map(i => as.items[i]).join(' → ');
    return as.rows.map((r, i) => r + ' → ' + as.options[as.correct[i]]).join('; ');
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus FUG_CORE) ---------- */
  const examples = [
    { id: 'sw1', tab: 'sw', title: 'Konsole mit zwei Kehlnähten a4 × 80', text: 'Eine Konsole hängt an zwei Kehlnähten (a = 4 mm, l = 80 mm je Naht) und trägt 24 kN auf Schub. Wie groß sind Fläche und Spannung?', p: { mode: 'a', a: '4', z: '', l: '80', F: '24000', n: '2' } },
    { id: 'sw2', tab: 'sw', title: 'Vom z-Maß 5 mm zum a-Maß', text: 'Auf der Zeichnung steht z = 5 mm. Wie dick ist die Naht (a-Maß), und welcher Querschnitt entsteht auf 100 mm Länge?', p: { mode: 'z', a: '', z: '5', l: '100', F: '10000', n: '1' } },
    { id: 'sw3', tab: 'sw', title: 'Wie viel Schweißgut für 2 m Naht', text: 'Eine Kehlnaht a = 5 mm läuft 2000 mm lang. Wie viel Volumen und welche Masse Schweißgut (ohne Zuschläge) sind das?', p: { mode: 'a', a: '5', z: '', l: '2000', F: '0', n: '1' } },
    { id: 'lo1', tab: 'lo', title: 'Kupferrohr 22 mm weichlöten', text: 'Rohr 22 mm in einer Muffe mit 22,2 mm Innendurchmesser, Lötlänge 20 mm. Wie breit ist der Spalt, und liegt er im Übungsbereich?', p: { art: 'weich', D: '22,2', d: '22', l: '20' } },
    { id: 'lo2', tab: 'lo', title: 'Zu weiter Spalt beim Hartlöten', text: 'Gleiches Rohr, aber die Muffe hat 22,6 mm. Welcher Spalt entsteht, und was bedeutet das für das Lot?', p: { art: 'hart', D: '22,6', d: '22', l: '20' } },
    { id: 'kl1', tab: 'kl', title: 'Normprobe 25 × 12,5 mm', text: 'Eine Zugscherprobe nach dem Normmaß (25 mm breit, 12,5 mm überlappt) reißt bei 4 kN. Welche Zugscherfestigkeit ist das?', p: { b: '25', l: '12,5', F: '4000', tauB: '12,8', S: '3' } },
    { id: 'kl2', tab: 'kl', title: 'Klebfläche für 6 kN', text: 'Ein Klebstoff mit 15 N/mm² Bruchfestigkeit und Sicherheitsbeiwert 3 soll 6 kN auf Schub übertragen. Welche Fläche braucht man mindestens?', p: { b: '30', l: '40', F: '6000', tauB: '15', S: '3' } },
    { id: 'sr1', tab: 'sr', title: 'M10 der Klasse 8.8', text: 'Kernloch, Durchgangsloch, Anzugsmoment aus der Übungstabelle und die daraus folgende Vorspannkraft.', p: { M: 'M10', c: '8.8', Mset: '' } },
    { id: 'sr2', tab: 'sr', title: 'M12 der Klasse 10.9 zu fest angezogen', text: 'Mit dem Regler wird deutlich über dem Tabellenmoment angezogen. Wann wird die Streckgrenze der Schraube überschritten?', p: { M: 'M12', c: '10.9', Mset: '190' } },
    { id: 'wn1', tab: 'wn', title: 'Passfeder auf 30-mm-Welle', text: 'Welle 30 mm: Welche Passfeder, welche Nuttiefen, und wie groß ist die Flächenpressung bei 100 Nm?', p: { view: 'pass', d: '30', l: '45', M: '100', U: '0,04', play: '0,04', mat: 'stahl' } },
    { id: 'wn2', tab: 'wn', title: 'Lagerbuchse als Pressverband', text: 'Welle 40 mm, Übermaß 0,04 mm, Fügespiel 0,04 mm: Wie weit muss die Stahlnabe erwärmt werden?', p: { view: 'press', d: '40', l: '45', M: '100', U: '0,04', play: '0,04', mat: 'stahl' } },
    { id: 'vf1', tab: 'vf', title: 'Schlussarten im Überblick', text: 'Schweißen, Löten und Kleben sind stoffschlüssig; so liegt der Stoffschluss im DIN-8593-System.', p: { v: 'sw' } },
    { id: 'vf2', tab: 'vf', title: 'Nieten: formschlüssig und unlösbar', text: 'Der Niet füllt das Loch und wird durch den Schließkopf gehalten.', p: { v: 'ni' } }
  ];

  root.FUG_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools: { DINQ, LOQ, BLQ, WHQ, STQ, NKQ, SIQ, VZQ, FSBS, FSCS } };
  root.FUG_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.FUG_DATA, TASKS: root.FUG_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
