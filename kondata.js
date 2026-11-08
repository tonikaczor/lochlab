'use strict';
/* Tonfunk Konstruktions-Lab: Daten (Aufgaben-Generatoren, Beispiele).
   ALLE Tabellenwerte und Normangaben sind ÜBUNGSWERTE für die Ausbildung, keine Konstruktionsvorgabe.
   window.KON_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, symDesc }
   window.KON_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'kon', Status in localStorage 'lm4.kon.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch den Fehler (Titel bleiben neutral).
   Zusatzfelder einer Aufgabe: q.table {head, rows} (Stückliste), q.draw {t:'sym'|'frame'|'rough', ...} (SVG-Zeichnung im UI). */
(function (root) {
  const C = () => root.KON_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Normteile und Stücklisten', 'Schrauben und Gewinde', 'Welle-Nabe-Verbindungen', 'Wälzlager und Federn', 'Form- und Lagetoleranzen', 'Oberflächenangaben', 'Fertigungsgerecht konstruieren'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const w = []; wrong.forEach(x => { if (x !== right && !w.includes(x)) w.push(x); });
    const ch = C().shuffle(R, [right].concat(w));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const loose = (x, lo, hi) => { const fr = x - Math.floor(x); return fr > (lo == null ? 0.1 : lo) && fr < (hi == null ? 0.9 : hi); };
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const tableOf = rows => ({ head: ['Pos.', 'Menge', 'Benennung', 'Norm-Bezeichnung / Werkstoff'], rows: rows.map(r => [String(r.pos), String(r.qty), r.ben, r.bez]) });

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P24: Einteilung der Welle-Nabe-Verbindungen: Passfeder = Formschluss, Pressverband = Kraftschluss, Kleben = Stoffschluss; Passfeder-Nut mit Spiel auf der Oberseite; axiale Sicherung der Nabe zusätzlich nötig. Stimmen Einteilung und Wortwahl mit dem Betriebsunterricht überein? */
  const VERBQ = [
    ['Ein Zahnrad sitzt mit einer Passfeder auf einer Welle. Das Drehmoment geht über die Seitenflächen der Passfeder in Welle und Nabe. Wie nennt man diese Verbindungsart?', 'Formschlüssige Verbindung', ['Kraftschlüssige Verbindung (Reibung)', 'Stoffschlüssige Verbindung (Kleben, Schweißen)', 'Das ist keine Welle-Nabe-Verbindung'], 'Bei der Passfeder liegen die Seitenflächen der Feder an den Nutflanken an. Die Form der Teile überträgt das Drehmoment, das ist Formschluss.', ['Welche Flächen tragen das Drehmoment?', 'Ohne Reibung und ohne Zusatzstoff: die Form hält.']],
    ['Eine Nabe wird heiß auf eine Welle geschoben und schrumpft beim Abkühlen fest. Das Drehmoment wird durch die Reibung in der Fügefläche übertragen. Wie heißt diese Verbindungsart?', 'Kraftschlüssige Verbindung (Pressverband)', ['Formschlüssige Verbindung (Passfeder)', 'Stoffschlüssige Verbindung (Löten)', 'Spielpassung'], 'Beim Pressverband entsteht durch das Übermaß eine hohe Flächenpressung. Die Reibung überträgt das Moment: Kraftschluss.', ['Was hält die Nabe: eine Form oder die Reibung?', 'Die Nabe schrumpft auf, das Übermaß erzeugt Pressung.']],
    ['Ein Zahnrad ist auf eine Welle mit Spezialkleber aufgeklebt. Wie nennt man diese Verbindungsart?', 'Stoffschlüssige Verbindung', ['Formschlüssige Verbindung', 'Kraftschlüssige Verbindung', 'Das ist ein Pressverband'], 'Beim Kleben, Löten und Schweißen halten die Teile durch einen Stoff zusammen: Stoffschluss. Lösen ist meist nur durch Zerstören möglich.', ['Welcher zusätzliche Stoff hält die Teile?', 'Kleben, Löten, Schweißen gehören zusammen.']],
    ['Ein Zahnrad soll ohne Beschädigung wieder von der Welle abgezogen werden können und das Anfahrmoment sicher übertragen. Welche Verbindung ist dafür besonders gut geeignet?', 'Passfederverbindung', ['Aufgeschrumpfte Nabe mit großem Übermaß', 'Verklebte Nabe', 'Verschweißte Nabe'], 'Die Passfeder lässt sich zerstörungsfrei lösen und überträgt auch Stöße gut über die Flanken. Schrumpfen, Kleben und Schweißen sind schwer oder nur durch Zerstören zu lösen.', ['Welche Verbindung lässt sich einfach wieder lösen?', 'Eine Verbindung mit Stoffschluss lässt sich kaum zerstörungsfrei trennen.']],
    ['Eine Nabe sitzt mit Passfeder auf der Welle und darf sich in Achsrichtung nicht verschieben. Was ist nötig?', 'Eine zusätzliche axiale Sicherung (z. B. Sicherungsring, Wellenmutter oder Distanzring)', ['Nichts, die Passfeder hält auch axial', 'Eine längere Passfeder', 'Eine breitere Passfeder'], 'Die Passfeder überträgt nur das Drehmoment um die Achse. Gegen Verschieben in Achsrichtung braucht die Nabe eine zusätzliche Sicherung.', ['Welche Kraftrichtung nimmt die Passfeder auf?', 'Eine Passfeder wirkt in Umfangsrichtung, nicht in Achsrichtung.']],
    ['Ein Pressverband mit 50 µm Übermaß soll ohne große Presskraft gefügt werden. Welches Fügeverfahren ist geeignet?', 'Die Nabe erwärmen (oder die Welle abkühlen), dann zügig fügen', ['Die Welle mit dem Hammer in die kalte Nabe schlagen', 'Nabenbohrung mit Schmirgelleinen aufweiten', 'Beide Teile in Wasser legen und von Hand fügen'], 'Beim Fügen durch Wärmedehnung weitet sich die Nabe so weit, dass die Welle mit Spiel hineinpasst. Beim Abkühlen entsteht der Presssitz.', ['Welche Eigenschaft der Werkstoffe hilft beim Fügen?', 'Warm dehnt sich Stahl aus.']]
  ];
  /* PRUEFEN P21: Zuordnung der Schraubensicherungen: hohe Vorspannung, Kronenmutter mit Splint (formschlüssig), flüssiges Sicherungsmittel (stoffschlüssig), Kontermutter, Hinweis, dass Federringe und Zahnscheiben bei hochfesten Schrauben kaum wirken. Passt das zur Lehrmeinung im Betrieb? */
  const SICHQ = [
    ['An einem Motorlager lockert sich eine Schraube durch Vibration. Du willst die Verbindung dauerhaft sichern. Was hilft grundsätzlich am meisten?', 'Eine ausreichend hohe Vorspannkraft mit dem vorgeschriebenen Anzugsdrehmoment aufbringen', ['Die Schraube nur handfest anziehen, damit das Gewinde nicht überlastet wird', 'Gewindeöl auf die Auflagefläche geben', 'Eine kürzere Schraube einbauen'], 'Eine hohe Vorspannkraft hält die Teile durch Reibung zusammen und verhindert, dass sich die Schraube losrüttelt. Zu wenig Vorspannung ist die häufigste Ursache für Lockern.', ['Was verhindert, dass sich die Teile gegeneinander bewegen?', 'Anziehen nach Drehmoment-Vorgabe, nicht nach Gefühl.']],
    ['Eine Kronenmutter wird mit einem Splint durch ein Loch in der Schraube gesichert. Zu welcher Art von Sicherung gehört das?', 'Formschlüssige Sicherung (verhindert das Losdrehen mechanisch)', ['Stoffschlüssige Sicherung (Klebstoff)', 'Reibschlüssige Sicherung durch hohe Vorspannung', 'Das ist keine Sicherung, nur eine Verliersicherung'], 'Der Splint steckt in Schraube und Mutter. Er blockiert die Drehung durch seine Form: Formschluss.', ['Was blockiert die Drehbewegung?', 'Der Splint steckt in einem Loch.']],
    ['Auf das Gewinde einer Schraube wird vor dem Einschrauben ein flüssiges Schraubensicherungsmittel aufgetragen, das aushärtet. Wie wirkt es?', 'Es füllt das Gewindespiel stoffschlüssig und verhindert selbsttätiges Losdrehen', ['Es erhöht die Vorspannkraft um das Doppelte', 'Es macht die Schraube härter', 'Es dichtet nur gegen Staub, gegen Lösen wirkt es nicht'], 'Das ausgehärtete Mittel verbindet die Gewindeflanken stoffschlüssig und verhindert Losdrehen durch Vibration. Die Vorspannkraft bleibt gleich.', ['Was passiert zwischen den Gewindeflanken?', 'Es härtet aus, wenn es im Gewinde eingeschlossen ist.']],
    ['An einer Maschine liegt unter einer Mutter einer hochfesten Schraube (10.9) ein Federring. Was ist dazu zu sagen?', 'Bei hochfesten Schrauben wirkt der Federring kaum, die Vorspannkraft ist entscheidend', ['Der Federring ist die beste Sicherung für 10.9', 'Federringe dürfen nie verwendet werden, weil sie rosten', 'Der Federring ersetzt das Anzugsdrehmoment'], 'Bei hochfesten Schrauben werden Federringe und Zahnscheiben schon bei normaler Vorspannung flachgedrückt. Sie sichern dann kaum. Eine korrekte Vorspannung ist wichtiger.', ['Was passiert mit dem Federring, wenn die Schraube kräftig angezogen wird?', 'Die Vorspannkraft ist bei 10.9 sehr hoch.']],
    ['Eine zweite Mutter wird kräftig gegen die erste gekontert. Wie heißt diese Sicherung?', 'Kontern (Kontermutter)', ['Verspannen mit Federring', 'Splinten', 'Vorspannen mit Dehnschraube'], 'Beim Kontern spannen sich zwei Muttern gegeneinander. Dadurch entsteht im Gewinde eine zusätzliche Reibung, die das Losdrehen erschwert.', ['Zwei Muttern gegeneinander.', 'Es braucht kein Zusatzteil außer einer zweiten Mutter.']]
  ];
  /* PRUEFEN P20: Die Konstruktionshinweise (Gussschräge 1° bis 3°, gleichmäßige Wanddicken, Radien statt scharfer Kanten, Gewindefreistich, Spannfläche, Mindestabstand einer Bohrung zum Rand, Fräserradius in Innenecken, Sacklochgewinde mit tieferem Kernloch) sind Faustregeln. Passen sie zu euren Lehrmaterialien? Die Kennzahlen (z. B. "mindestens ein Bohrungsdurchmesser Randabstand") bitte prüfen. */
  const GUSSQ = [
    ['Ein Gussgehäuse hat Seitenwände, die genau senkrecht zur Teilungsebene der Form stehen (0° Neigung). Wo liegt die Schwierigkeit beim Abguss?', 'Das Modell lässt sich schlecht aus der Form ziehen: Es fehlen Gussschrägen (etwa 1° bis 3°)', ['Grauguss kann keine senkrechten Wände', 'Die Wände werden beim Gießen zu dünn', 'Die Form wird zu heiß'], 'Flächen parallel zur Entformrichtung klemmen beim Ziehen des Modells. Gussschrägen von etwa 1° bis 3° erleichtern das Entformen und schonen die Form.', ['Wie wird das Modell aus dem Sand gezogen?', 'Eine kleine Neigung der Wände hilft beim Herausziehen.']],
    ['An einem Gussteil trifft eine 5 mm dünne Wand rechtwinklig auf einen massiven Block von 30 mm Dicke. An dieser Stelle entstehen Lunker und Risse. Was verbessert das Bauteil?', 'Wanddicken angleichen und allmähliche Übergänge mit Radien gestalten', ['Die dünne Wand noch dünner machen', 'Den Block weiter verdicken', 'Eine schärfere Kante am Übergang vorsehen'], 'Bei großen Dickenunterschieden erstarrt die Schmelze unterschiedlich schnell. Dadurch entstehen Spannungen und Lunker. Gleichmäßige Wanddicken und weiche Übergänge helfen.', ['Dicke Stellen erstarren später als dünne.', 'Der Übergang sollte weich und nicht abrupt sein.']],
    ['Ein Gussteil hat scharfkantige Innenecken. Im Betrieb entstehen dort Anrisse. Welche Gestaltung ist besser?', 'Innenecken mit einem Radius ausrunden', ['Die Ecken noch schärfer ausführen', 'Die Ecken mit einer zusätzlichen Kerbe versehen', 'Die Wanddicke an der Ecke halbieren'], 'Scharfe Innenecken wirken wie eine Kerbe: Dort sammeln sich Spannungen, und beim Erstarren entstehen Risse. Ein Radius verteilt die Spannung.', ['Wo sammeln sich Spannungen?', 'Rund ist besser als spitz.']],
    ['Eine Gussform kann nicht ohne Zusatzaufwand hergestellt werden, weil das Teil innen eine Hinterschneidung hat. Was ist die einfachste Verbesserung?', 'Die Form des Teils so ändern, dass keine Hinterschneidung entsteht (oder zusätzlich einen Kern einsetzen)', ['Das Modell dicker machen', 'Die Gussschräge auf 0° stellen', 'Den Werkstoff wechseln, dann geht es immer'], 'Das Modell muss sich aus der Form ziehen lassen. Hinterschneidungen verhindern das. Entweder vermeidet man sie oder setzt einen Kern ein, was Kosten verursacht.', ['Wie kommt das Modell aus dem Sand?', 'Alles, was hinter einer Kante sitzt, klemmt.']],
    ['Ein Gussteil soll auf seiner ganzen großen Fußfläche plan gefräst werden. Das dauert lange. Welche Gestaltung spart Bearbeitung?', 'Die Auflage auf schmale Leisten oder Pads beschränken, nur diese werden bearbeitet', ['Die Fußfläche noch größer machen', 'Die Fußfläche weich ausrunden, damit keine Bearbeitung nötig ist', 'Das Bauteil dünner gießen'], 'Bearbeitete Flächen sollten möglichst klein sein. Leisten oder Pads bearbeitet man schneller als eine große Fläche.', ['Wie klein kann die bearbeitete Fläche werden?', 'Nur dort fräsen, wo die Fläche wirklich trägt.']]
  ];
  const DREHQ = [
    ['Eine Welle soll bis an eine Schulter ein Gewinde bekommen. Das Gewinde läuft direkt bis an den Bund. Das Werkzeug kann nicht frei auslaufen. Welche Gestaltung ist besser?', 'Einen Gewindefreistich (Gewindeauslauf) vor der Schulter vorsehen', ['Die Schulter höher machen', 'Das Gewinde noch weiter in den Bund laufen lassen', 'Die Welle härter wählen'], 'Ein Gewindefreistich gibt dem Werkzeug Platz zum Auslaufen. Ohne ihn läuft der Gewindestahl oder Schneideisen gegen die Schulter.', ['Wohin soll das Werkzeug am Ende des Gewindes auslaufen?', 'Eine kleine Rille vor dem Bund schafft Platz.']],
    ['Ein unregelmäßig geformtes Teil soll gefräst werden, hat aber keine ebene, ausreichend große Fläche, an der man es im Schraubstock festspannen kann. Was ist sinnvoll?', 'Spannflächen oder Spannansätze am Bauteil vorsehen', ['Das Teil dünner machen', 'Den Werkstoff weicher wählen', 'Die Toleranzen enger machen'], 'Ein Bauteil muss sicher gespannt werden können, ohne sich zu verformen. Spannflächen oder angegossene Spannansätze helfen dabei.', ['Woran greift die Spannbacke?', 'Eine ebene Fläche zum Spannen schaffen.']],
    ['Eine Bohrung mit 10 mm Durchmesser liegt nur 2 mm von der Außenkante eines Bauteils. Beim Bohren bricht die Wand an der Kante aus. Was gilt als Regel?', 'Zum Rand einen ausreichenden Abstand einhalten (als Faustregel mindestens etwa ein Bohrungsdurchmesser)', ['Bohrungen sollen immer so nah wie möglich am Rand liegen', 'Der Abstand ist egal, wenn die Bohrung gleichmäßig ist', 'Die Bohrung wird kleiner, wenn sie am Rand liegt'], 'Bei zu geringem Randabstand bleibt zu wenig Wand stehen: Das Bauteil verformt sich oder bricht, und der Bohrer verläuft zur Seite.', ['Wie viel Material bleibt zwischen Bohrung und Kante?', 'Zu wenig Wand schwächt das Bauteil.']],
    ['Eine Tasche soll in ein Teil gefräst werden. In der Zeichnung sind alle Innenecken scharfkantig (Radius 0) vorgegeben. Warum ist das nicht herstellbar?', 'Fräser sind rund: Innenecken haben mindestens den Fräserradius', ['Die Maschine ist nicht genau genug', 'Innenecken sind verboten', 'Das Werkstück verbiegt sich'], 'Ein rotierender Fräser hinterlässt in Innenecken immer einen Radius. Besser ist es, einen Radius vorzugeben, der größer ist als der Fräserradius.', ['Welche Form hat ein Fräser im Querschnitt?', 'Runder Fräser ergibt eine runde Ecke.']],
    ['In einem Sackloch ist ein Gewinde bis zum Boden der Kernlochbohrung vorgesehen. Beim Schneiden bricht der Gewindebohrer immer ab. Was ist der Konstruktionsfehler?', 'Das Kernloch muss tiefer sein als das Gewinde (Auslauf für den Gewindebohrer)', ['Das Gewinde muss feiner sein', 'Die Bohrung muss enger sein', 'Der Bohrer muss härter sein'], 'Der Gewindebohrer hat eine angeschnittene Spitze. Er braucht Raum unter dem letzten vollen Gewindegang. Deshalb bohrt man das Kernloch tiefer als die Gewindelänge.', ['Wo soll die Spitze des Gewindebohrers bleiben?', 'Tiefe der Bohrung gegen Tiefe des Gewindes vergleichen.']]
  ];
  /* PRUEFEN P22: Werkstoffe nur als Anwendung (Erklärung der Kurzbezeichnung steht im werlab): EN-GJL-200 für Gehäuse (gießbar, schwingungsdämpfend), C45 für vergütete Wellen, S235JR für geschweißte Rahmen, EN-GJL-200 spröde mit Rm mindestens 200 N/mm². Sind diese Anwendungen für den Unterricht in Ordnung? */
  const WSTQ = [
    ['Ein Maschinengehäuse soll gegossen werden. Es soll gut gießbar sein, Schwingungen dämpfen und günstig bleiben. Welcher Werkstoff passt?', 'EN-GJL-200', ['S235JR', 'C45', 'CuZn37 (Messing)'], 'Grauguss lässt sich gut in komplizierte Formen gießen und dämpft Schwingungen. Deshalb sind viele Maschinengehäuse aus EN-GJL-200.', ['Welcher Werkstoff ist ein Gusswerkstoff?', 'GJL steht für Gusseisen mit Lamellengraphit.']],
    ['Eine Getriebewelle soll nach dem Drehen vergütet werden, um höhere Festigkeit zu bekommen. Welcher Werkstoff passt?', 'C45', ['S235JR', 'EN-GJL-200', 'CuZn37 (Messing)'], 'C45 hat genug Kohlenstoff, um vergütet zu werden. S235JR ist ein Baustahl mit wenig Kohlenstoff, Grauguss ist spröde, Messing ist weich.', ['Welcher Stahl ist härtbar und vergütbar?', 'Der Kohlenstoffgehalt muss ausreichen.']],
    ['Ein Rahmen aus Profilen soll geschweißt werden. Er muss gut schweißbar und günstig sein, hohe Härte ist nicht nötig. Welcher Werkstoff passt?', 'S235JR', ['C45', 'EN-GJL-200', 'Werkzeugstahl mit hohem Kohlenstoffgehalt'], 'S235JR ist ein gut schweißbarer, günstiger Baustahl für Rahmen und Konstruktionen. C45 ist schwerer zu schweißen, Grauguss kaum.', ['Welcher Stahl ist ein klassischer Baustahl?', 'Wenig Kohlenstoff schweißt sich besser.']],
    ['Ein Bauteil aus EN-GJL-200 soll auf Zug beansprucht werden und plötzlich stark belastet werden. Welche Aussage ist richtig?', 'Es ist spröde und verformt sich kaum, bei Stößen und Zug ist Vorsicht nötig', ['Es dehnt sich sehr stark, ehe es bricht', 'Es ist besonders zäh und eignet sich für Stoßbelastung', 'Es hat die Streckgrenze von 235 N/mm²'], 'Grauguss ist gut für Druckbelastung und Dämpfung, aber spröde. Bei Zug und Stößen bricht er, ohne sich vorher stark zu verformen.', ['Wie verhält sich Grauguss beim Zugversuch?', 'Grauguss hat eine geringe Bruchdehnung.']]
  ];
  const RAUKQ = [
    ['Auf einer Zeichnung steht "Ra 1,6". Was bedeutet Ra?', 'Arithmetischer Mittenrauwert in Mikrometern (µm)', ['Radius der Ausrundung in Millimetern', 'Rückstellkraft in Newton', 'Rautiefe als größter Höhenunterschied in Millimetern'], 'Ra ist der arithmetische Mittenrauwert: der Mittelwert der Abweichungen des Rauheitsprofils von der Mittellinie, angegeben in µm.', ['Der Buchstabe a steht für arithmetisch.', 'Die Einheit ist sehr klein, ein Tausendstel Millimeter.']],
    ['Was beschreibt der Rauheitskennwert Rz?', 'Die gemittelte Rautiefe: Abstand zwischen höchster Spitze und tiefstem Tal, gemittelt über mehrere Einzelstrecken', ['Den Mittelwert aller Abweichungen vom Profil', 'Den Radius der Spitzen des Profils', 'Die Zugfestigkeit der Oberfläche'], 'Rz misst den Höhenunterschied zwischen höchster Spitze und tiefstem Tal je Einzelmessstrecke und mittelt diese Werte (meist über fünf Strecken). Er ist größer als Ra.', ['Rz erfasst die Spitzen und Täler.', 'Es ist keine Mittelung über das ganze Profil, sondern von Höchstwerten.']],
    ['Welche der beiden Aussagen zur Rauheit ist richtig?', 'Je kleiner der Ra-Wert, desto glatter die Fläche (und meist desto teurer die Fertigung)', ['Je kleiner der Ra-Wert, desto rauer die Fläche', 'Der Ra-Wert sagt nichts über die Glätte', 'Ein kleiner Ra-Wert spart Fertigungskosten'], 'Kleine Ra-Werte erreicht man nur mit aufwendigeren Verfahren wie Schleifen, Honen oder Läppen. Das kostet Zeit und Geld.', ['Ra ist eine Abweichung vom Mittelwert.', 'Feine Oberflächen brauchen mehr Aufwand.']],
    ['In welcher Einheit wird die Rauheit Ra in Zeichnungen angegeben?', 'Mikrometer (µm)', ['Millimeter (mm)', 'Newton pro Quadratmillimeter (N/mm²)', 'Grad (°)'], 'Ra und Rz werden in Mikrometern angegeben (1 µm = 0,001 mm).', ['Die Rauheit ist viel kleiner als ein Millimeter.', 'Tausendstel Millimeter.']]
  ];

  /* Gewindelängen-Hilfen */
  const NAMES6 = () => [C().NORMS['4017'].n, C().NORMS['4762'].n, C().NORMS['4032'].n, C().NORMS['7089'].n, C().NORMS['2338'].n, C().NORMS['6885'].n];
  const symDesc = {
    gerad: 'Die Toleranz begrenzt, wie stark eine Linie oder Achse von einer geraden Linie abweichen darf.',
    eben: 'Die Toleranz begrenzt, wie stark eine Fläche von einer ideal ebenen Fläche abweichen darf.',
    rund: 'Die Toleranz begrenzt, wie stark ein Querschnitt von einem idealen Kreis abweichen darf.',
    zyl: 'Die Toleranz begrenzt die Abweichung einer Mantelfläche von einem idealen Zylinder (Rundheit, Geradheit und Parallelität der Mantellinien zusammen).',
    par: 'Die Toleranz begrenzt, wie stark ein Element von der parallelen Lage zu einem Bezug abweichen darf.',
    recht: 'Die Toleranz begrenzt, wie stark ein Element von der rechtwinkligen Lage zu einem Bezug abweichen darf.',
    koax: 'Die Toleranz begrenzt, wie weit die Achse eines Elements von der Achse des Bezugselements entfernt liegen darf.',
    pos: 'Die Toleranz begrenzt, wie weit die Achse eines Elements vom theoretisch genauen Sollort abweichen darf.',
    rundl: 'Die Toleranz begrenzt den Ausschlag einer Messuhr, die an einer rotierenden Fläche anliegt, bei einer Umdrehung um den Bezug.'
  };

  /* ---------- Generatoren ---------- */
  const G = {
    /* ----- Normteile und Stücklisten ----- */
    normname: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12]), l = c.pick(R, [16, 20, 25, 30, 40, 50]), fk = c.pick(R, ['8.8', '10.9']);
      const items = [[c.bez.schraube('4017', d, l, fk), c.NORMS['4017'].n], [c.bez.schraube('4762', d, l, fk), c.NORMS['4762'].n], [c.bez.mutter(d, c.fkNut(fk)), c.NORMS['4032'].n], [c.bez.scheibe(d), c.NORMS['7089'].n],
        [c.bez.stift('2338', c.pick(R, [4, 5, 6, 8]), c.pick(R, ['m6', 'h8']), l), c.NORMS['2338'].n], [c.bez.passfeder('A', 8, 7, c.pick(R, [25, 32, 40])), c.NORMS['6885'].n]];
      const it = c.pick(R, items);
      return choiceQ(R, 'In einer Stückliste steht die Bezeichnung "' + it[0] + '". Was für ein Normteil ist das?', it[1], NAMES6().filter(x => x !== it[1]),
        '"' + it[0] + '" ist ' + (/^[AEIOU]/.test(it[1]) ? 'eine ' : 'ein ') + it[1] + '. Die Normnummer legt die Bauform fest, danach folgen Größe und Länge.', ['Die Normnummer (zum Beispiel ISO 4017) steht für eine bestimmte Bauform.', 'Achte auf die Buchstaben und Maße hinter der Normnummer: M steht für metrisches Gewinde.']);
    },
    bezlen: R => {
      const c = C(), no = c.pick(R, ['4017', '4014', '4762']), d = c.pick(R, [5, 6, 8, 10, 12, 16]), l = c.pick(R, [16, 20, 25, 30, 35, 40, 45, 50, 60, 70]), fk = c.pick(R, c.FKS), b = c.bez.schraube(no, d, l, fk), askL = R() < 0.6;
      return askL ? numQ('Im Lieferschein steht: "' + b + '". Wie lang ist die Schraube in mm (Länge ohne Kopf)?', l, 'mm', 'Schraubenlänge', 0.01,
        'In "' + b + '" steht M' + d + ' für das Gewinde, ' + l + ' für die Länge in mm und ' + fk + ' für die Festigkeitsklasse. Die Länge wird ohne den Kopf gemessen: ' + l + ' mm.', ['Die Zahl nach dem x ist die Länge.', 'M8 ist das Gewinde, hinter dem Strich steht die Festigkeitsklasse.'])
        : numQ('Im Lieferschein steht: "' + b + '". Welchen Nenndurchmesser in mm hat das Gewinde der Schraube?', d, 'mm', 'Nenndurchmesser', 0.01,
          'M' + d + ' bedeutet metrisches Gewinde mit ' + d + ' mm Nenndurchmesser. Die Länge ' + l + ' mm und die Festigkeitsklasse ' + fk + ' haben mit dem Durchmesser nichts zu tun.', ['Der Buchstabe M steht für metrisches ISO-Gewinde.', 'Die Zahl direkt hinter M ist der Nenndurchmesser in mm.']);
    },
    mutter: R => {
      const c = C(), no = c.pick(R, ['4017', '4014', '4762']), d = c.pick(R, [6, 8, 10, 12, 16]), fk = c.pick(R, ['8.8', '10.9', '12.9']), l = c.pick(R, [20, 25, 30, 40, 50]), nn = c.fkNut(fk), d2 = c.pick(R, [6, 8, 10, 12, 16].filter(x => x !== d)), low = c.pick(R, [4, 5, 6].filter(x => x < nn)), right = c.bez.mutter(d, nn);
      return choiceQ(R, 'Zur Schraube "' + c.bez.schraube(no, d, l, fk) + '" soll eine passende Mutter bestellt werden. Welche Bezeichnung wählst du?', right, [c.bez.mutter(d2, nn), c.bez.mutter(d, low), c.bez.scheibe(d)],
        'Die Mutter muss dasselbe Gewinde haben (M' + d + ') und eine ausreichende Festigkeitsklasse: zur Schraube ' + fk + ' gehört mindestens Klasse ' + nn + ' (Zahl vor dem Punkt). Richtig ist also "' + right + '". Die Scheibe ist keine Mutter, und Klasse ' + low + ' wäre zu schwach.', ['Gewinde und Festigkeitsklasse müssen passen.', 'Bei 8.8 gehört Klasse 8, bei 10.9 Klasse 10, bei 12.9 Klasse 12 zur Mutter.']);
    },
    stkauswert: R => {
      const c = C(), d1 = c.pick(R, [6, 8, 10]), d2 = c.pick(R, [8, 10, 12]), n1 = c.ri(R, 2, 6), n2 = c.pick(R, [4, 6, 8].filter(x => x !== n1)), fk = c.pick(R, ['8.8', '10.9']), ask = c.pick(R, ['schraube', 'schraube', 'mutter', 'scheibe']);
      const rows = [{ pos: 1, qty: 1, ben: 'Gehäuse', bez: 'EN-GJL-200' }, { pos: 2, qty: 1, ben: 'Deckel', bez: 'S235JR' }, { pos: 3, qty: n1, ben: 'Zylinderschraube', bez: c.bez.schraube('4762', d1, c.pick(R, [16, 20, 25]), '8.8') },
        { pos: 4, qty: n2, ben: 'Sechskantschraube', bez: c.bez.schraube('4017', d2, c.pick(R, [30, 35, 40, 45]), fk) }, { pos: 5, qty: n2, ben: 'Sechskantmutter', bez: c.bez.mutter(d2, c.fkNut(fk)) },
        { pos: 6, qty: n2, ben: 'Scheibe', bez: c.bez.scheibe(d2) }, { pos: 7, qty: 2, ben: 'Zylinderstift', bez: c.bez.stift('2338', 6, 'm6', 30) }];
      const v = c.bomTotals(rows)[ask], what = ask === 'schraube' ? 'Schrauben insgesamt (alle Positionen, die Schrauben sind, aber keine Muttern, Scheiben oder Stifte)' : ask === 'mutter' ? 'Muttern' : 'Scheiben';
      const q = numQ('Für eine Baugruppe gilt die Stückliste in der Tabelle. Wie viele ' + what + ' werden für eine Baugruppe benötigt?', v, 'Stück', 'Anzahl', 0.01,
        ask === 'schraube' ? 'Schrauben sind Position 3 (Zylinderschraube, ' + n1 + ' Stück) und Position 4 (Sechskantschraube, ' + n2 + ' Stück). Zusammen: ' + n1 + ' + ' + n2 + ' = ' + v + ' Stück.' : 'Die Menge steht in der Spalte "Menge" der passenden Position: ' + v + ' Stück.',
        ['Lies die Normnummer: ISO 4762 und ISO 4017 sind Schrauben, ISO 4032 ist eine Mutter, ISO 7089 eine Scheibe.', 'Zähle nur die Positionen, die zur gefragten Teileart gehören, und addiere ihre Mengen.']);
      q.table = tableOf(rows); return q;
    },
    stkpruef: R => {
      const c = C(), d = c.pick(R, [8, 10, 12]), fk = c.pick(R, ['8.8', '10.9']), l = c.pick(R, [30, 35, 40, 50]), n = c.pick(R, [4, 6, 8]), nn = c.fkNut(fk), type = c.pick(R, ['nutD', 'nutFK', 'wD', 'nutQ']);
      let nutD = d, nutK = nn, wD = d, nutQ = n;
      if (type === 'nutD') nutD = c.pick(R, [6, 8, 10, 12, 16].filter(x => x !== d));
      else if (type === 'nutFK') nutK = c.pick(R, [4, 5, 6, 8].filter(x => x < nn));
      else if (type === 'wD') wD = c.pick(R, [6, 8, 10, 12, 16].filter(x => x !== d));
      else nutQ = n + c.pick(R, [-2, 2]);
      const rows = [{ pos: 1, qty: 1, ben: 'Gehäuse', bez: 'EN-GJL-200' }, { pos: 2, qty: n, ben: 'Sechskantschraube', bez: c.bez.schraube('4017', d, l, fk) }, { pos: 3, qty: n, ben: 'Scheibe', bez: c.bez.scheibe(wD) },
        { pos: 4, qty: nutQ, ben: 'Sechskantmutter', bez: c.bez.mutter(nutD, nutK) }, { pos: 5, qty: 2, ben: 'Zylinderstift', bez: c.bez.stift('2338', 6, 'm6', 30) }];
      const is = c.bomIssues(rows), off = is.length ? is[0].pos : 3, labels = { 2: 'Position 2: Sechskantschraube', 3: 'Position 3: Scheibe', 4: 'Position 4: Sechskantmutter', 5: 'Position 5: Zylinderstift' };
      const q = choiceQ(R, 'In der Stückliste einer Spannvorrichtung ist genau eine Position fehlerhaft. Die Schraube in Position 2 ist richtig bestellt. Welche Position passt nicht zu den übrigen?', labels[off], [2, 3, 4, 5].map(k => labels[k]),
        'Die Schraube legt Gewinde, Festigkeitsklasse und Menge fest. ' + (is.length ? is[0].msg : '') + ' Fehlerhaft ist daher ' + labels[off] + '.', ['Vergleiche Gewinde, Festigkeitsklasse und Menge von Mutter und Scheibe mit der Schraube.', 'Eine Mutter braucht dasselbe Gewinde, mindestens die passende Klasse und die gleiche Menge wie die Schraube.']);
      q.table = tableOf(rows); return q;
    },
    /* ----- Schrauben und Gewinde ----- */
    gewinde: R => {
      const c = C(), t = c.pick(R, c.TH), all = [0.5, 0.7, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], fp = v => f(v, 2) + ' mm';
      return choiceQ(R, 'Welche Steigung P hat ein metrisches Regelgewinde M' + t.d + '?', fp(t.P), c.shuffle(R, all.filter(x => x !== t.P)).slice(0, 3).map(fp),
        'Für das Regelgewinde M' + t.d + ' gilt als Übungswert die Steigung P = ' + f(t.P, 2) + ' mm (Gewindetabelle im Reiter Hilfe). Mit wachsendem Durchmesser nimmt die Steigung zu.', ['Schau in die Gewindetabelle im Reiter Schrauben.', 'Je größer das Gewinde, desto größer die Steigung: M6 hat 1 mm.']);
    },
    fk: R => {
      const c = C(), fk = c.pick(R, c.FKS), re = R() < 0.5;
      return re ? numQ('Eine Schraube trägt die Festigkeitsklasse ' + fk + '. Wie hoch ist die Streckgrenze Re (bei hochfesten Schrauben die 0,2-%-Dehngrenze) in N/mm²?', c.fkRe(fk), 'N/mm²', 'Streckgrenze Re', 0.5,
        'Erste Zahl · 100 ist Rm = ' + f(c.fkRm(fk), 0) + ' N/mm². Streckgrenze Re = erste Zahl · zweite Zahl · 10 = ' + f(c.fkParse(fk).a, 0) + ' · ' + f(c.fkParse(fk).b, 0) + ' · 10 = ' + f(c.fkRe(fk), 0) + ' N/mm².', ['Die erste Zahl mal 100 ist die Zugfestigkeit Rm.', 'Die zweite Zahl gibt das Verhältnis Re zu Rm in Zehnteln an: Re = erste · zweite · 10.'])
        : numQ('Eine Schraube trägt die Festigkeitsklasse ' + fk + '. Wie hoch ist die Mindest-Zugfestigkeit Rm in N/mm²?', c.fkRm(fk), 'N/mm²', 'Zugfestigkeit Rm', 0.5,
          'Rm = erste Zahl · 100 = ' + f(c.fkParse(fk).a, 0) + ' · 100 = ' + f(c.fkRm(fk), 0) + ' N/mm².', ['Die erste Zahl der Festigkeitsklasse zählt.', 'Erste Zahl · 100 ergibt Rm in N/mm².']);
    },
    bohr: R => {
      const c = C(), d = c.pick(R, [4, 5, 6, 8, 10, 12, 16]), kern = R() < 0.6, t = c.thread(d);
      return kern ? numQ('In ein Bauteil soll ein Regelgewinde M' + d + ' geschnitten werden. Mit welchem Durchmesser in mm bohrst du das Kernloch vor?', t.kern, 'mm', 'Kernlochdurchmesser', 0.05,
        'Tabellenwert: ' + f(t.kern, 1) + ' mm. Faustformel: Nenndurchmesser minus Steigung = ' + f(d, 0) + ' − ' + f(t.P, 2) + ' = ' + f(c.kernFaust(d), 2) + ' mm. Beide Werte liegen innerhalb der Toleranz von 0,05 mm.', ['Das Kernloch ist kleiner als der Nenndurchmesser.', 'Faustformel: Kernlochdurchmesser ≈ Nenndurchmesser − Steigung.'])
        : numQ('Ein Bauteil soll mit einer Schraube M' + d + ' verschraubt werden. Wie groß ist der Durchmesser des Durchgangslochs "mittel" in mm?', t.dg, 'mm', 'Durchgangsloch', 0.01,
          'Das Durchgangsloch "mittel" für M' + d + ' ist ' + f(t.dg, 1) + ' mm groß (Übungstabelle). Es ist größer als der Nenndurchmesser, damit die Schraube mit Spiel hindurchpasst.', ['Das Durchgangsloch ist größer als das Gewinde.', 'Schau in die Gewindetabelle unter "Durchgangsloch mittel".']);
    },
    laenge: R => {
      const c = C(); let d, a, b, r, ok;
      for (let i = 0; i < 400; i++) {
        d = c.pick(R, [6, 8, 10, 12]); a = c.ri(R, 3, 12) * 2; b = c.ri(R, 3, 12) * 2; r = c.screwLen(a + b, d, 1);
        const prev = Math.max(...c.NORMLEN.filter(x => x <= r.min)); ok = r.min - prev >= 0.8 && r.norm - r.min >= 0.8; if (ok && a + b >= 20 && r.norm <= 80) break;
      }
      const t = c.thread(d), r2 = c.screwLen(a + b, d, 1);
      return numQ('Zwei Platten (Dicke ' + a + ' mm und ' + b + ' mm) werden mit einer Durchsteckschraube M' + d + ' und einer Sechskantmutter verschraubt. Unter der Mutter liegt eine Scheibe (Dicke ' + f(t.s, 1) + ' mm), die Mutter ist ' + f(t.m, 1) + ' mm hoch. Die Schraube soll mindestens zwei Gewindegänge (2 · Steigung = ' + f(2 * t.P, 2) + ' mm) aus der Mutter herausragen. Lieferbare Längen in mm: 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90. Welche Länge bestellst du?', r2.norm, 'mm', 'Schraubenlänge', 0.01,
        'Mindestlänge = ' + a + ' + ' + b + ' + ' + f(t.s, 1) + ' (Scheibe) + ' + f(t.m, 1) + ' (Mutter) + ' + f(2 * t.P, 2) + ' (Überstand) = ' + f(r2.min, 2) + ' mm. Die nächste lieferbare Länge darüber ist ' + r2.norm + ' mm.', ['Addiere alle Dicken: beide Platten, Scheibe, Mutter und den Überstand.', 'Danach auf die nächste lieferbare Länge aufrunden, nie abrunden.']);
    },
    kraft: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12, 16]), fk = c.pick(R, ['8.8', '10.9', '12.9']), As = c.spannQuer(d), F = c.forceYield(fk, d) / 1000;
      return numQ('Eine Schraube M' + d + ' der Festigkeitsklasse ' + fk + ' hat einen Spannungsquerschnitt As = ' + f(As, 1) + ' mm². Bei welcher Zugkraft in kN wird die Streckgrenze (0,2-%-Dehngrenze) erreicht?', F, 'kN', 'Kraft an der Streckgrenze', 0.05,
        'Re = ' + f(c.fkParse(fk).a, 0) + ' · ' + f(c.fkParse(fk).b, 0) + ' · 10 = ' + f(c.fkRe(fk), 0) + ' N/mm². Kraft F = Re · As = ' + f(c.fkRe(fk), 0) + ' N/mm² · ' + f(As, 1) + ' mm² = ' + f(F * 1000, 0) + ' N = ' + f(F, 2) + ' kN.', ['Rechne zuerst die Streckgrenze aus der Festigkeitsklasse aus.', 'Kraft = Spannung · Querschnitt: F = Re · As. Das Ergebnis in N durch 1000 teilen für kN.']);
    },
    sicherung: pq(SICHQ),
    /* ----- Welle-Nabe-Verbindungen ----- */
    verb: pq(VERBQ),
    passfeder: R => {
      const c = C(), i = c.ri(R, 1, c.PF.length - 2), p = c.PF[i], d = c.ri(R, p.from + 1, p.to - 1), near = c.PF.map((x, j) => [x, Math.abs(j - i)]).filter(x => x[1] > 0).sort((a, b) => a[1] - b[1] || a[0].b - b[0].b).slice(0, 3).map(x => c.keyLabel(x[0]) + ' mm');
      return choiceQ(R, 'Ein Zahnrad wird auf einer Welle mit ⌀ ' + d + ' mm mit einer Passfeder befestigt. Welche Passfeder (Breite × Höhe) wählst du?', c.keyLabel(p) + ' mm', near,
        'Für Wellendurchmesser über ' + p.from + ' bis ' + p.to + ' mm gilt in der Übungstabelle die Passfeder ' + c.keyLabel(p) + ' mm. ' + d + ' mm liegt in diesem Bereich.', ['Die Passfeder richtet sich nach dem Wellendurchmesser, nicht nach der Nabenlänge.', 'Suche in der Passfeder-Tabelle im Reiter Hilfe den Bereich "über … bis …", in dem dein Durchmesser liegt.']);
    },
    tragl: R => {
      const c = C(), p = c.pick(R, c.PF.slice(2, 9)), form = c.pick(R, ['A', 'B']), l = c.pick(R, [28, 32, 36, 40, 45, 50, 56, 63]), v = c.keyLen(form, l, p.b);
      return numQ('Eine Passfeder hat die Bezeichnung "' + c.bez.passfeder(form, p.b, p.h, l) + '". Wie groß ist die tragende Länge in mm?', v, 'mm', 'tragende Länge', 0.01,
        form === 'A' ? 'Form A ist beidseitig rundstirnig. Die Rundungen tragen nicht voll mit: tragende Länge = l − b = ' + l + ' − ' + p.b + ' = ' + v + ' mm.' : 'Form B ist beidseitig eckig. Die ganze Länge trägt: tragende Länge = l = ' + l + ' mm.',
        ['Der Buchstabe nach DIN 6885 gibt die Bauform an.', 'Bei der rundstirnigen Form (A) rechnest du l − b, bei der eckigen Form (B) die ganze Länge.']);
    },
    umfang: R => {
      const c = C(), M = c.ri(R, 4, 40) * 10, d = c.pick(R, [20, 25, 30, 35, 40, 50, 60]), F = c.tangForce(M, d);
      return numQ('Eine Welle mit ⌀ ' + d + ' mm überträgt ein Drehmoment von ' + f(M, 0) + ' N·m. Wie groß ist die Umfangskraft am Wellenumfang in N?', F, 'N', 'Umfangskraft', 1,
        'Fu = M / r = 2 · M / d. Das Drehmoment in N·mm: ' + f(M, 0) + ' · 1.000 = ' + f(M * 1000, 0) + ' N·mm. Fu = 2 · ' + f(M * 1000, 0) + ' / ' + d + ' = ' + f(F, 1) + ' N.', ['Kraft = Moment geteilt durch Hebelarm, der Hebelarm ist der Radius.', 'Rechne N·m in N·mm um (mal 1.000) und nimm den Radius d/2 in mm.']);
    },
    press: R => {
      const c = C(), d = c.pick(R, [40, 50, 60, 80]), u = c.pick(R, [0.03, 0.04, 0.05, 0.06]), s = c.pick(R, [0.02, 0.03]), dT = c.thermalDT(d, u + s), T = 20 + dT;
      return numQ('Eine Stahlnabe (Bohrung ⌀ ' + d + ' mm, Raumtemperatur 20 °C) soll auf eine Welle gefügt werden. Das Höchstübermaß des Pressverbands beträgt ' + f(u, 2) + ' mm, zum Fügen braucht die Bohrung zusätzlich ' + f(s, 2) + ' mm Spiel. Auf welche Temperatur in °C musst du die Nabe erwärmen? (Wärmeausdehnung von Stahl α = 12 · 10⁻⁶ 1/K)', T, '°C', 'Fügetemperatur', 1,
        'Nötige Aufweitung: ' + f(u, 2) + ' + ' + f(s, 2) + ' = ' + f(u + s, 2) + ' mm. Δd = α · d · ΔT, also ΔT = Δd / (α · d) = ' + f(u + s, 2) + ' / (0,000012 · ' + d + ') = ' + f(dT, 1) + ' K. Fügetemperatur = 20 °C + ' + f(dT, 1) + ' K = ' + f(T, 1) + ' °C.', ['Wie weit muss sich die Bohrung aufweiten? Übermaß plus Spiel.', 'Δd = α · d · ΔT. Stelle nach ΔT um und addiere 20 °C.']);
    },
    /* ----- Wälzlager und Federn ----- */
    lagerart: R => {
      const c = C(), nn = c.pick(R, ['04', '05', '06', '08', '10']), codes = [['6' + c.pick(R, ['0', '2', '3']) + nn], ['72' + nn], ['302' + nn], ['NU 2' + nn], ['511' + nn], ['222' + nn]].map(x => x[0]), code = c.pick(R, codes), info = c.brgInfo(code);
      const types = ['Rillenkugellager', 'Schrägkugellager', 'Kegelrollenlager', 'Zylinderrollenlager', 'Axial-Rillenkugellager', 'Pendelrollenlager'];
      return choiceQ(R, 'Auf einem Lager steht das Kurzzeichen "' + code + '". Um welche Lagerart handelt es sich?', info.type, types.filter(x => x !== info.type),
        'Die ersten Zeichen des Kurzzeichens geben die Lagerart an: 6 Rillenkugellager, 7 Schrägkugellager, 30 Kegelrollenlager, NU Zylinderrollenlager, 51 Axial-Rillenkugellager, 22 Pendelrollenlager. "' + code + '" ist ein ' + info.type + '.', ['Achte auf die ersten Zeichen des Kurzzeichens.', 'Eine 6 am Anfang steht für Rillenkugellager, NU für Zylinderrollenlager.']);
    },
    lagerbohr: R => {
      const c = C(), ser = c.pick(R, ['0', '2', '3']), bore = c.pick(R, [10, 12, 15, 17, 20, 25, 30, 35, 40]), code = c.brgCode(ser, bore), info = c.brgInfo(code), nn = code.slice(2);
      return numQ('Ein Rillenkugellager trägt das Kurzzeichen "' + code + '". Welchen Wellendurchmesser (Bohrung des Lagers) in mm hat es?', info.bore, 'mm', 'Lagerbohrung', 0.01,
        'Die letzten beiden Ziffern (' + nn + ') sind die Bohrungskennzahl. ' + (bore >= 20 ? 'Ab 04 gilt: Kennzahl · 5 = ' + nn.replace(/^0/, '') + ' · 5 = ' + bore + ' mm.' : 'Die Kennzahlen 00, 01, 02, 03 stehen für 10, 12, 15 und 17 mm: ' + nn + ' bedeutet ' + bore + ' mm.'), ['Die letzten beiden Ziffern sind die Bohrungskennzahl.', 'Ab Kennzahl 04 mit 5 multiplizieren. Für 00 bis 03 gilt eine feste Zuordnung: 10, 12, 15, 17 mm.']);
    },
    lagerwahl: R => {
      const c = C(), bore = c.pick(R, [20, 25, 30, 35, 40]), ser = c.pick(R, ['0', '2', '3']), D = c.BRDIM[ser][bore][0], B = c.BRDIM[ser][bore][1], right = c.brgCode(ser, bore), other = ['0', '2', '3'].filter(x => x !== ser).map(x => c.brgCode(x, bore)), nb = bore === 20 ? 25 : bore - 5;
      return choiceQ(R, 'Ein Lagersitz auf der Welle hat ⌀ ' + bore + ' mm. In der Gehäusebohrung (⌀ ' + D + ' mm) ist Platz für ein Rillenkugellager mit ' + B + ' mm Breite. Welches Kurzzeichen passt?', right, other.concat([c.brgCode(ser, nb)]),
        'Das Lager muss innen ' + bore + ' mm, außen ' + D + ' mm und ' + B + ' mm breit sein. Nach der Maßtabelle erfüllt das Lager ' + right + ' (Reihe ' + ser + ', Kennzahl ' + right.slice(2) + ' = ' + bore + ' mm) alle drei Angaben.', ['Die letzten beiden Ziffern bestimmen die Bohrung, die zweite Ziffer die Durchmesserreihe.', 'Für gleiche Bohrung gibt es mehrere Reihen mit verschiedenem Außendurchmesser. Prüfe Außendurchmesser und Breite in der Lagertabelle.']);
    },
    feder: R => {
      const c = C(), Rr = c.pick(R, [2, 2.5, 4, 5, 8, 10, 12.5, 15, 20]), s = c.ri(R, 2, 12), F = Rr * s, ask = c.pick(R, ['R', 's', 'F']);
      if (ask === 'R') return numQ('Eine Druckfeder wird mit ' + f(F, 1) + ' N um ' + s + ' mm zusammengedrückt. Wie groß ist die Federrate in N/mm?', Rr, 'N/mm', 'Federrate', 0.01, 'Federrate R = F / s = ' + f(F, 1) + ' N / ' + s + ' mm = ' + f(Rr, 2) + ' N/mm.', ['Die Federrate gibt an, wie viel Kraft für 1 mm Weg nötig ist.', 'R = F geteilt durch s.']);
      if (ask === 's') return numQ('Eine Druckfeder hat die Federrate ' + f(Rr, 1) + ' N/mm. Sie wird mit ' + f(F, 1) + ' N belastet. Wie weit wird sie zusammengedrückt (in mm)?', s, 'mm', 'Federweg', 0.01, 'Federweg s = F / R = ' + f(F, 1) + ' N / ' + f(Rr, 1) + ' N/mm = ' + s + ' mm.', ['Stelle R = F / s nach s um.', 's = F geteilt durch R.']);
      return numQ('Eine Druckfeder hat die Federrate ' + f(Rr, 1) + ' N/mm und wird um ' + s + ' mm zusammengedrückt. Welche Kraft in N wirkt dann?', F, 'N', 'Federkraft', 0.05, 'Federkraft F = R · s = ' + f(Rr, 1) + ' N/mm · ' + s + ' mm = ' + f(F, 1) + ' N.', ['Federkraft = Federrate mal Federweg.', 'F = R · s.']);
    },
    kombi: R => {
      const c = C(), par = R() < 0.5, pairs = [[6, 3], [12, 4], [20, 5], [30, 6], [15, 10], [12, 6], [10, 10], [8, 8], [24, 8]];
      let r1, r2, v;
      if (par) { r1 = c.ri(R, 2, 20); r2 = c.pick(R, [2, 4, 5, 8, 10, 12].filter(x => x !== r1)); v = c.springParallel([r1, r2]); } else { const p = c.pick(R, pairs); r1 = p[0]; r2 = p[1]; v = c.springSeries([r1, r2]); }
      const txt = par ? 'Zwei Druckfedern (R1 = ' + r1 + ' N/mm und R2 = ' + r2 + ' N/mm) stehen nebeneinander und drücken gleichzeitig auf dieselbe Platte. Beide werden um denselben Weg zusammengedrückt.' : 'Zwei Druckfedern (R1 = ' + r1 + ' N/mm und R2 = ' + r2 + ' N/mm) sitzen hintereinander auf einer Führung. Die Kraft läuft nacheinander durch beide Federn, die Wege addieren sich.';
      return numQ(txt + ' Wie groß ist die Federrate der Kombination in N/mm?', v, 'N/mm', 'Federrate der Kombination', 0.05,
        par ? 'Bei gleichem Weg teilt sich die Kraft auf beide Federn auf: R = R1 + R2 = ' + r1 + ' + ' + r2 + ' = ' + f(v, 2) + ' N/mm.' : 'Bei gleicher Kraft addieren sich die Wege: 1/R = 1/R1 + 1/R2 = 1/' + r1 + ' + 1/' + r2 + ', also R = ' + f(v, 2) + ' N/mm. Die Kombination ist weicher als jede Einzelfeder.',
        ['Überlege: Teilt sich die Kraft auf (Weg gleich), oder addieren sich die Wege (Kraft gleich)?', 'Parallel: Federraten addieren. In Reihe: Kehrwerte addieren, das Ergebnis ist kleiner als die kleinste Einzelfeder.']);
    },
    /* ----- Form- und Lagetoleranzen ----- */
    symerk: R => {
      const c = C(), s = c.pick(R, c.SYMS), q = choiceQ(R, 'Im Toleranzrahmen einer Zeichnung steht das in der Grafik gezeigte Symbol. Welche Toleranzart ist gemeint?', s.n, c.shuffle(R, c.SYMS.filter(x => x.id !== s.id)).slice(0, 3).map(x => x.n),
        'Das Symbol steht für die ' + s.n + ' (' + s.cls + 'toleranz). ' + symDesc[s.id], ['Betrachte die Form des Symbols: Linie, Kreis, Parallelogramm, Pfeil?', 'Die Symbole stehen in der Übersicht im Reiter Toleranzrahmen.']);
      q.draw = { t: 'sym', id: s.id }; return q;
    },
    symzu: R => {
      const c = C(), s = c.pick(R, c.SYMS);
      return choiceQ(R, symDesc[s.id].replace(/^Die Toleranz begrenzt/, 'Eine Toleranzangabe auf der Zeichnung begrenzt') + ' Wie heißt diese Toleranz?', s.n, c.shuffle(R, c.SYMS.filter(x => x.id !== s.id)).slice(0, 3).map(x => x.n),
        'Das ist die ' + s.n + ': ' + symDesc[s.id], ['Achte darauf, ob ein Bezug genannt wird und was gemessen wird.', 'Form: ein Element für sich. Richtung, Ort und Lauf: im Verhältnis zu einem Bezug.']);
    },
    rahmen: R => {
      const c = C(), s = c.pick(R, c.SYMS), tol = c.pick(R, [0.01, 0.02, 0.03, 0.05, 0.08, 0.1]);
      const dat = s.dat ? (s.id === 'pos' ? ['A', 'B'] : [c.pick(R, ['A', 'B'])]) : [], dia = s.dia === 2 ? true : s.dia === 1 ? R() < 0.5 : false, fr = { sym: s.id, tol, dia, datums: dat };
      const alt = [{ sym: s.id, tol: tol * 2, dia, datums: dat }, { sym: s.id, tol: rd2(tol / 2), dia, datums: dat }];
      const others = c.SYMS.filter(x => x.id !== s.id && x.cls === s.cls && x.dat === s.dat && (x.dia === 2) === (s.dia === 2) && (x.dia > 0 || !dia)); if (others.length) alt.push({ sym: c.pick(R, others).id, tol, dia, datums: dat });
      if (dat.length) alt.push({ sym: s.id, tol, dia, datums: dat.length > 1 ? dat.slice().reverse() : [dat[0] === 'A' ? 'B' : 'A'] }); else if (s.dia === 1) alt.push({ sym: s.id, tol, dia: !dia, datums: [] }); else alt.push({ sym: s.id, tol: tol * 3, dia, datums: dat });
      const right = c.frameText(fr), q = choiceQ(R, 'Die Grafik zeigt einen Toleranzrahmen aus einer Zeichnung. Was fordert er?', right, alt.map(c.frameText), 'Der Rahmen wird von links nach rechts gelesen: Symbol = ' + s.n + ', dann der Toleranzwert' + (dia ? ' mit ⌀ (zylindrische Zone)' : '') + (dat.length ? ', dann der Bezug ' + dat.join(' und ') : ' (kein Bezug, Formtoleranz)') + '. Bedeutung: ' + right,
        ['Lies von links nach rechts: Symbol, Toleranzwert, Bezug.', 'Ein ⌀ vor dem Wert bedeutet eine zylindrische Toleranzzone, ohne ⌀ liegt die Zone zwischen zwei Ebenen oder Linien.']);
      q.draw = { t: 'frame', f: fr }; return q;
    },
    bezug: R => {
      const c = C(), need = R() < 0.5, withD = c.SYMS.filter(x => x.dat), noD = c.SYMS.filter(x => !x.dat), right = c.pick(R, need ? withD : noD), wrong = c.shuffle(R, need ? noD : withD).slice(0, 3);
      return choiceQ(R, need ? 'Welche der folgenden Toleranzen braucht zwingend eine Bezugsangabe im Toleranzrahmen?' : 'Welche der folgenden Toleranzen hat keinen Bezug im Toleranzrahmen?', right.n, wrong.map(x => x.n),
        need ? right.n + ' ist eine ' + right.cls + 'toleranz und bezieht sich auf einen Bezug. Formtoleranzen (Geradheit, Ebenheit, Rundheit, Zylinderform) brauchen keinen.' : right.n + ' ist eine Formtoleranz: Das Element wird für sich beurteilt, es gibt keinen Bezug. Richtung, Ort und Lauf brauchen einen Bezug.', ['Formtoleranzen beurteilen ein Element für sich allein.', 'Richtung, Ort und Lauf messen immer im Verhältnis zu einem Bezug.']);
    },
    posprf: R => {
      const c = C(); let t, dx, dy, half, r; const mode = c.pick(R, ['trap', 'trap', 'in', 'out']);
      for (let i = 0; i < 2000; i++) {
        t = c.pick(R, [0.1, 0.2, 0.3]); half = t / 2 * 100; dx = c.ri(R, 1, 16); dy = c.ri(R, 1, 16); r = Math.hypot(dx, dy);
        if (mode === 'trap' && dx <= half && dy <= half && r > half + 0.5) break;
        if (mode === 'in' && r < half - 0.5) break;
        if (mode === 'out' && r > half + 0.5 && (dx > half + 1 || dy > half + 1)) break;
      }
      const ok = c.posOk(dx / 100, dy / 100, t), fr = { sym: 'pos', tol: t, dia: true, datums: ['A', 'B'] }, d = c.posDist(dx / 100, dy / 100);
      const q = choiceQ(R, 'Eine Bohrung trägt die in der Grafik gezeigte Positionstoleranz. Beim Messen liegt die Bohrungsachse ' + f(dx / 100, 2) + ' mm in x-Richtung und ' + f(dy / 100, 2) + ' mm in y-Richtung vom Sollort entfernt. Liegt die Bohrung in der Toleranz?', ok ? 'Ja, die Bohrung liegt in der Toleranz' : 'Nein, die Bohrung liegt außerhalb der Toleranzzone',
        [ok ? 'Nein, die Bohrung liegt außerhalb der Toleranzzone' : 'Ja, die Bohrung liegt in der Toleranz', 'Das lässt sich ohne Messung des Bohrungsdurchmessers nicht sagen'],
        'Die Zone ist ein Kreis mit ⌀ ' + f(t, 2) + ' mm, die Achse darf also höchstens ' + f(t / 2, 2) + ' mm vom Sollort entfernt liegen (Radius). Abstand = √(' + f(dx / 100, 2) + '² + ' + f(dy / 100, 2) + '²) = ' + f(d, 3) + ' mm. ' + (ok ? 'Das ist nicht mehr als ' + f(t / 2, 2) + ' mm: in der Toleranz.' : 'Das ist mehr als ' + f(t / 2, 2) + ' mm: außerhalb.') + ' Die Abweichungen in x und y dürfen nicht einzeln mit dem halben Wert verglichen werden.', ['Die Zone mit ⌀ ist rund, ihr Radius ist die halbe Toleranz.', 'Berechne den Abstand vom Sollort mit dem Satz des Pythagoras und vergleiche ihn mit dem Radius.']);
      q.draw = { t: 'frame', f: fr }; return q;
    },
    /* ----- Oberflächenangaben ----- */
    rauk: pq(RAUKQ),
    bearbz: R => {
      const c = C(), k = c.pick(R, c.ROUGH_SYM), ra = c.pick(R, [0.8, 1.6, 3.2, 6.3]), s = c.ROUGH_SYM, q = choiceQ(R, 'In einer Zeichnung steht an einer Fläche das in der Grafik gezeigte Zeichen. Was fordert es?', k.n, s.filter(x => x.id !== k.id).map(x => x.n).concat(['Oberfläche muss gehärtet werden']),
        'Das offene V-Zeichen heißt: Fertigungsverfahren beliebig. Mit Strich im Zeichen muss die Fläche spanend bearbeitet werden. Mit Kreis darf sie nicht bearbeitet werden, sie bleibt im Anlieferzustand. Hier: ' + k.n + '.', ['Achte darauf, ob im Zeichen ein Strich oder ein Kreis steht.', 'Strich = abtragend (spanend), Kreis = ohne Abtrag, offen = beliebig.']);
      q.draw = { t: 'rough', kind: k.id, ra: k.id === 'kein' ? null : ra }; return q;
    },
    verfrau: R => {
      const c = C(), p = c.pick(R, c.RA_PROC), asked = R() < 0.5;
      return asked ? choiceQ(R, 'Welches Fertigungsverfahren erreicht üblicherweise (Übungswert) eine Rauheit von etwa Ra ' + f(p.ra, 1) + ' µm?', p.n, c.shuffle(R, c.RA_PROC.filter(x => x.id !== p.id)).slice(0, 3).map(x => x.n), p.n + ' erreicht üblicherweise etwa Ra ' + f(p.ra, 1) + ' µm. Grobe Verfahren wie Sägen und Schruppen liegen bei großen Werten, Schleifen, Honen und Läppen bei kleinen.', ['Grobe Bearbeitung ergibt große Ra-Werte, feine Bearbeitung kleine.', 'Schau in die Rauheitstabelle im Reiter Hilfe.'])
        : choiceQ(R, 'Welche Rauheit Ra (Übungswert) erreichst du üblicherweise mit dem Verfahren "' + p.n + '"?', 'Ra ' + f(p.ra, 1) + ' µm', c.shuffle(R, c.RA_SERIES.filter(x => x !== p.ra && Math.abs(c.RA_SERIES.indexOf(x) - c.RA_SERIES.indexOf(p.ra)) >= 1)).slice(0, 3).map(x => 'Ra ' + f(x, 1) + ' µm'), p.n + ' erreicht üblicherweise etwa Ra ' + f(p.ra, 1) + ' µm.', ['Ordne die Verfahren von grob bis fein.', 'Schau in die Rauheitstabelle im Reiter Hilfe.']);
    },
    rauwahl: R => {
      const c = C(), fn = c.pick(R, c.RA_FUNC), idx = c.RA_SERIES.indexOf(fn.ra), far = c.RA_SERIES.filter((x, i) => Math.abs(i - idx) >= 2);
      return choiceQ(R, 'Welche Rauheit Ra (Übungswert) wird üblicherweise für folgende Fläche gefordert: ' + fn.n + '?', 'Ra ' + f(fn.ra, 1) + ' µm', c.shuffle(R, far).slice(0, 3).map(x => 'Ra ' + f(x, 1) + ' µm'), 'Für ' + fn.n + ' gilt im Übungsmodell Ra ' + f(fn.ra, 1) + ' µm. Laufflächen von Dichtungen und Gleitflächen brauchen feine Werte, Nebenflächen darf man rauer lassen, das spart Kosten.', ['Welche Fläche muss dichten oder gleiten, welche nur auflegen?', 'Wichtige Funktionsflächen haben kleine Ra-Werte, unwichtige große.']);
    },
    /* ----- Fertigungsgerecht konstruieren ----- */
    guss: pq(GUSSQ),
    schraege: R => {
      const c = C(), h = c.pick(R, [30, 40, 50, 60, 80, 100, 120]), a = c.pick(R, [1, 2, 3]), v = c.draftGrowth(h, a);
      return numQ('Die Wand eines Gussteils ist ' + h + ' mm hoch und bekommt eine Gussschräge von ' + a + '°. Um wie viel mm wächst das Maß von oben nach unten auf einer Seite?', v, 'mm', 'Zuwachs durch die Schräge', 0.02,
        'Δ = h · tan α = ' + h + ' mm · tan ' + a + '° = ' + h + ' · ' + f(Math.tan(a * Math.PI / 180), 4) + ' = ' + f(v, 3) + ' mm.', ['Die Schräge bildet mit der Höhe ein rechtwinkliges Dreieck.', 'Gegenkathete = Höhe · tan(Winkel).']);
    },
    dreh: pq(DREHQ),
    wst: pq(WSTQ)
  };
  function rd2(v) { return Math.round(v * 1000) / 1000; }

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument (Indexliste für Pools) */
  const defs = [
    ['Normteile und Stücklisten', 1, 'Normteil benennen', 'normname'], ['Normteile und Stücklisten', 1, 'Bezeichnung lesen', 'bezlen'], ['Normteile und Stücklisten', 2, 'Passende Mutter', 'mutter'], ['Normteile und Stücklisten', 2, 'Stückliste auswerten', 'stkauswert'], ['Normteile und Stücklisten', 3, 'Stückliste prüfen', 'stkpruef'],
    ['Schrauben und Gewinde', 1, 'Gewinde nachschlagen', 'gewinde'], ['Schrauben und Gewinde', 1, 'Festigkeitsklasse lesen', 'fk'], ['Schrauben und Gewinde', 2, 'Bohrungsdurchmesser wählen', 'bohr'], ['Schrauben und Gewinde', 3, 'Passende Schraubenlänge', 'laenge'], ['Schrauben und Gewinde', 3, 'Belastbarkeit einer Schraube', 'kraft'], ['Schrauben und Gewinde', 2, 'Verbindung gegen Lockern', 'sicherung'],
    ['Welle-Nabe-Verbindungen', 1, 'Verbindungsart bestimmen', 'verb', [0, 1, 2, 3]], ['Welle-Nabe-Verbindungen', 2, 'Passfeder wählen', 'passfeder'], ['Welle-Nabe-Verbindungen', 2, 'Länge der Passfeder', 'tragl'], ['Welle-Nabe-Verbindungen', 2, 'Kraft an der Welle', 'umfang'], ['Welle-Nabe-Verbindungen', 3, 'Nabe aufschrumpfen', 'press'],
    ['Wälzlager und Federn', 1, 'Lagerart erkennen', 'lagerart'], ['Wälzlager und Federn', 1, 'Lager lesen', 'lagerbohr'], ['Wälzlager und Federn', 2, 'Lager aussuchen', 'lagerwahl'], ['Wälzlager und Federn', 2, 'Federkennlinie', 'feder'], ['Wälzlager und Federn', 3, 'Federn kombinieren', 'kombi'],
    ['Form- und Lagetoleranzen', 1, 'Symbol erkennen', 'symerk'], ['Form- und Lagetoleranzen', 1, 'Toleranzart zuordnen', 'symzu'], ['Form- und Lagetoleranzen', 2, 'Toleranzrahmen lesen', 'rahmen'], ['Form- und Lagetoleranzen', 2, 'Mit oder ohne Bezug', 'bezug'], ['Form- und Lagetoleranzen', 3, 'Lage der Bohrung prüfen', 'posprf'],
    ['Oberflächenangaben', 1, 'Rauheitsangaben', 'rauk'], ['Oberflächenangaben', 1, 'Bearbeitungszeichen', 'bearbz'], ['Oberflächenangaben', 2, 'Verfahren und Rauheit', 'verfrau'], ['Oberflächenangaben', 3, 'Rauheit passend wählen', 'rauwahl'],
    ['Fertigungsgerecht konstruieren', 1, 'Gussteil gestalten', 'guss'], ['Fertigungsgerecht konstruieren', 2, 'Schräge am Gussteil', 'schraege'], ['Fertigungsgerecht konstruieren', 2, 'Dreh- und Frästeil gestalten', 'dreh'], ['Fertigungsgerecht konstruieren', 3, 'Werkstoff anwenden', 'wst']
  ];
  const tasks = defs.map((d, i) => ({ id: 'kon' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('kon-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus KON_CORE) ---------- */
  const examples = [
    { id: 'kern1', tab: 'schr', title: 'Gewinde M8 in einem Gehäuse', text: 'In ein Gehäuse aus EN-GJL-200 wird ein Gewinde M8 geschnitten. Du suchst Kernlochbohrer, Steigung und das Durchgangsloch im Deckel.', p: { d: 8, fk: '8.8', t1: 12, t2: 10, w: 1 } },
    { id: 'laenge1', tab: 'schr', title: 'Schraubenlänge für zwei Platten', text: 'Eine Platte (16 mm) und ein Flansch (14 mm) werden mit Schraube M10, Scheibe und Mutter verschraubt. Welche Länge bestellst du?', p: { d: 10, fk: '8.8', t1: 16, t2: 14, w: 1 } },
    { id: 'fest1', tab: 'schr', title: 'Hochfeste Schraube M12 der Klasse 10.9', text: 'Eine Schraube M12 der Klasse 10.9 hält ein Lagerschild. Wie hoch ist die Zugfestigkeit, und welche Kraft erreicht sie an der Streckgrenze?', p: { d: 12, fk: '10.9', t1: 20, t2: 18, w: 1 } },
    { id: 'rl1', tab: 'tol', title: 'Rundlauf an einer Welle', text: 'Ein Wellenzapfen muss beim Drehen um den Bezug A mit höchstens 0,03 mm Ausschlag laufen. So steht es im Toleranzrahmen.', p: { sym: 'rundl', tol: '0,03', dia: false, d1: 'A', d2: '' } },
    { id: 'pos1', tab: 'tol', title: 'Positionstoleranz einer Bohrung', text: 'Eine Bohrung darf mit ⌀ 0,2 mm um den Sollort liegen, gemessen von den Bezügen A und B.', p: { sym: 'pos', tol: '0,2', dia: true, d1: 'A', d2: 'B' } },
    { id: 'par1', tab: 'tol', title: 'Parallelität einer Auflagefläche', text: 'Die Auflagefläche eines Maschinenfußes muss parallel zur Unterseite (Bezug A) sein, der Abstand der Ebenen beträgt höchstens 0,05 mm.', p: { sym: 'par', tol: '0,05', dia: false, d1: 'A', d2: '' } },
    { id: 'stk1', tab: 'stk', title: 'Stückliste eines Lagerdeckels (in Ordnung)', text: 'Ein Lagerdeckel wird mit vier Zylinderschrauben befestigt und mit zwei Stiften zentriert. Alles passt zusammen.', p: { rows: [{ pos: 1, qty: 1, ben: 'Lagerdeckel', bez: 'EN-GJL-200' }, { pos: 2, qty: 4, ben: 'Zylinderschraube', bez: 'ISO 4762 M8x25-8.8' }, { pos: 3, qty: 4, ben: 'Scheibe', bez: 'ISO 7089 - 8 - 200 HV' }, { pos: 4, qty: 2, ben: 'Zylinderstift', bez: 'ISO 2338 6m6x20' }] } },
    { id: 'stk2', tab: 'stk', title: 'Stückliste mit Fehler', text: 'Schraube M10 mit Mutter und Scheibe. Der Editor zeigt, was nicht zusammenpasst.', p: { rows: [{ pos: 1, qty: 1, ben: 'Konsole', bez: 'S235JR' }, { pos: 2, qty: 6, ben: 'Sechskantschraube', bez: 'ISO 4017 M10x40-10.9' }, { pos: 3, qty: 6, ben: 'Scheibe', bez: 'ISO 7089 - 10 - 200 HV' }, { pos: 4, qty: 6, ben: 'Sechskantmutter', bez: 'ISO 4032 M10-8' }] } },
    { id: 'lag1', tab: 'lag', title: 'Lager 6204 lesen', text: 'Ein Rillenkugellager trägt das Kurzzeichen 6204 mit zwei Dichtscheiben (2RS). Bohrung, Außendurchmesser und Breite stehen in der Tabelle.', p: { focus: 'lager', code: '6204-2RS', r1: '12', r2: '4', F: '120' } },
    { id: 'fed1', tab: 'lag', title: 'Zwei Federn kombinieren', text: 'Zwei Federn mit 12 N/mm und 4 N/mm werden einmal nebeneinander und einmal hintereinander eingebaut. Die Kraft beträgt 120 N.', p: { focus: 'feder', code: '6204', r1: '12', r2: '4', F: '120' } }
  ];

  root.KON_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, symDesc };
  root.KON_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.KON_DATA, TASKS: root.KON_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
