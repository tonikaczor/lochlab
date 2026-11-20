'use strict';
/* Tonfunk Fertigungs-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Beispiele).
   ALLE Werte (Kernlöcher, Zuschläge, Dichten, Grenzwerte) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Aufträge.
   window.FER_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools }
   window.FER_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'fer', Status in localStorage 'lm4.fer.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Frageformen (q.ask.type): 'choice' (Auswahl), 'num' (Zahl), 'order' (Reihenfolge), 'match' (Zuordnung).
   q.viz (optional): Beschreibung einer neutralen Skizze für ferviz.js (zeigt Zusammenhänge, nie die Antwort).
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch die Fehlerursache (neutrale Titel, die Fehlersuchen heißen "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, Reihenfolgen werden gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.FER_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Fertigungsverfahren (DIN 8580)', 'Handfertigung', 'Biegen und Richten', 'Fertigungsplanung', 'Qualitätssicherung', 'Vorrichtungen und Spannmittel', 'Fehlersuche', 'Werkbank-Praxis', 'Einsatzgebiet Produktionstechnik'];

  /* ---------- Frageformen ---------- */
  const numQ = (text, value, unit, label, tol, expl, tips, viz) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, viz: viz || null });
  function choiceQ(R, text, right, wrong, expl, tips, viz) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, viz: viz || null };
  }
  function orderQ(R, text, items, expl, tips) {
    let idx = items.map((_, i) => i), sh = idx, tries = 0;
    do { sh = C().shuffle(R, idx); tries++; } while (sh.every((v, i) => v === i) && tries < 20);
    return { text, ask: { type: 'order', items: sh.map(i => items[i]), correct: items.map((_, k) => sh.indexOf(k)) }, value: 0, tol: 0, expl, tips, viz: null };
  }
  function matchQ(R, text, rows, options, corr, expl, tips) {
    const sh = C().shuffle(R, options.map((_, i) => i));
    return { text, ask: { type: 'match', rows, options: sh.map(i => options[i]), correct: corr.map(c => sh.indexOf(c)) }, value: 0, tol: 0, expl, tips, viz: null };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const gname = n => C().group(n).t;
  const GN = () => C().GROUPS.map(g => g.t);

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P11: Aussagen zu Anreißen und Handwerkzeug (Körner, Bezugskante, Anreißplatte, Anreißfarbe, Höhenreißer) sind in eigenen Worten und vereinfacht. Fehlt etwas Wichtiges aus der Grundausbildung (z. B. Zirkel, Parallelanreißer, Winkel)? */
  const HWQ = [
    ['Wozu setzt man vor dem Bohren mit dem Körner einen Körnerpunkt?', 'Der Bohrer findet eine Vertiefung und läuft nicht weg', ['Die Anreißlinie bleibt dadurch auch nach dem Bohren gut sichtbar', 'Das Werkstück wird an der Stelle etwas gehärtet', 'Das Maß wird dadurch genauer als mit der Reißnadel'], 'Die Spitze eines Bohrers hat keine Führung. Ohne Körnerpunkt kann sie auf der glatten Fläche wegwandern. Der Körnerpunkt gibt ihr einen festen Ansatzpunkt.', ['Denke an die Spitze des Bohrers beim Ansetzen.', 'Der Punkt ist eine kleine Vertiefung.']],
    ['Von wo aus werden beim Anreißen die Maße abgetragen?', 'Von einer sauber bearbeiteten Bezugskante aus', ['Vom Rand des Rohteils, so wie es geliefert wurde', 'Von der Mitte des Rohteils nach außen hin', 'Vom Rand der Anreißplatte aus gemessen'], 'Alle Maße beziehen sich auf eine gemeinsame, glatte und rechtwinklige Kante. So addieren sich Messfehler nicht von Maß zu Maß.', ['Eine gemeinsame Bezugsfläche vermeidet Fehlerketten.', 'Ein rohes Teil hat unsaubere Kanten.']],
    ['Wozu dient die Anreißplatte in der Werkstatt?', 'Sie ist die ebene Bezugsfläche für Werkstück und Höhenreißer', ['Sie schützt die Werkbank beim Hämmern und beim Körnen von Teilen', 'Sie hält das Werkstück beim Feilen unbeweglich fest', 'Sie ersetzt beim Anreißen das Lineal und den Winkel'], 'Auf der Anreißplatte steht alles auf derselben ebenen Fläche. Der Höhenreißer kann deshalb Linien in genau gleicher Höhe ziehen.', ['Es geht um eine ebene Fläche als Bezug.', 'Der Höhenreißer läuft auf der Platte.']],
    ['Warum streicht man blanke Flächen vor dem Anreißen mit Anreißfarbe?', 'Die Risslinie hebt sich gut vom Untergrund ab', ['Die Farbe schützt das Teil dauerhaft vor Rost', 'Die Farbe macht die Reißnadel länger scharf', 'Die Linie wird dadurch deutlich breiter und gröber'], 'Auf einer blanken Fläche sieht man die feine Linie kaum. Auf dem farbigen Untergrund erscheint sie hell und klar. Die Farbe ist nur eine Hilfe zum Sehen.', ['Es geht um die Sichtbarkeit der Linie.', 'Die Farbe ist kein Rostschutz.']],
    ['Womit reißt man mehrere parallele Linien in gleicher Höhe zur Platte an?', 'Mit dem Höhenreißer, der auf der Anreißplatte steht', ['Mit dem Zirkel, dessen Spitze im Werkstück steckt', 'Mit dem Winkel, den man an der Kante entlangzieht', 'Mit dem Körner, den man schräg über die Fläche zieht'], 'Der Höhenreißer wird auf der Platte verschoben und trägt eine eingestellte Höhe an. Alle Linien liegen deshalb parallel zur Plattenfläche.', ['Das Werkzeug wird auf der Platte geführt.', 'Der Name sagt, was es einstellt.']],
    ['Welche Aufgabe hat die Reißnadel?', 'Sie zieht feine Linien, nach denen gesägt oder gefeilt wird', ['Sie setzt Vertiefungen für den Bohrer an der Bohrstelle', 'Sie misst den Abstand zwischen zwei Anreißlinien auf 0,1 mm genau', 'Sie reinigt die Fläche vom Schmutz vor dem Anreißen'], 'Die Reißnadel ist ein harter, spitzer Stift. Sie ritzt dünne Linien in die Oberfläche, die als Orientierung für das spätere Bearbeiten dienen.', ['Vertiefungen setzt ein anderes Werkzeug.', 'Es geht um Linien auf der Oberfläche.']]
  ];
  /* PRUEFEN P12: Aussagen zu Sägen und Feilen (Vorwärtshub, mindestens zwei Zähne im Eingriff, Zahnung nach Wandstärke und Werkstoff, Hiebnummer, Einspannen nah an der Sägestelle). Stimmen die Faustregeln mit eurer Grundausbildung überein? */
  const SAQ = [
    ['Wann schneidet das Sägeblatt der Handbügelsäge, und wann wird entlastet?', 'Es schneidet beim Vorwärtshub, beim Rückhub wird der Druck weggenommen', ['Es schneidet bei beiden Hüben, der Druck bleibt immer gleich', 'Es schneidet nur beim Rückhub, beim Vorhub wird entlastet', 'Es schneidet nur zu Beginn, danach arbeitet die Säge von selbst'], 'Die Zähne zeigen nach vorn. Sie schneiden beim Vorwärtshub. Beim Rückhub würde Druck die Zähne nur stumpf reiben.', ['Die Zähne zeigen in eine Richtung.', 'Schneiden und Zurückziehen sind zwei verschiedene Bewegungen.']],
    ['Wie viele Zähne sollen mindestens gleichzeitig im Werkstoff schneiden?', 'Mindestens zwei Zähne, besser zwei bis drei gleichzeitig', ['Nur ein Zahn, damit der Schnitt besonders gerade bleibt', 'Möglichst alle Zähne des ganzen Sägeblatts zugleich', 'Die Anzahl der Zähne spielt für den Schnitt keine Rolle'], 'Wenn zu wenige Zähne eingreifen, haken sie ein und können ausbrechen. Darum wählt man die Zahnung passend zur Dicke des Werkstücks.', ['Ein einzelner Zahn kann sich festhaken.', 'Die Zahnung wird nach der Wanddicke gewählt.']],
    ['Ein dünnwandiges Rohr wird gesägt. Welche Zahnung passt?', 'Eine feine Zahnung mit vielen Zähnen je 25 mm', ['Eine grobe Zahnung, damit der Schnitt schnell geht', 'Eine Zahnung ohne Schränkung, weil das Rohr hohl ist', 'Jede Zahnung, denn die Wanddicke spielt keine Rolle'], 'Bei dünner Wand sollen trotzdem mehrere Zähne gleichzeitig im Eingriff sein. Das gelingt nur mit feiner Zahnung. Grobe Zähne würden sich einhaken.', ['Auch bei dünner Wand brauchst du mehrere Zähne im Eingriff.', 'Viele Zähne je Länge heißt feine Zahnung.']],
    ['Weiches Aluminium wird gesägt. Warum wählt man eine grobe Zahnung?', 'Die großen Zahnlücken nehmen die weichen Späne auf', ['Weiches Metall braucht möglichst wenige Zähne zum Halt', 'Grobe Zähne schneiden Aluminium kälter als feine', 'Mit feinen Zähnen bricht das Sägeblatt sofort ab'], 'Weiche Werkstoffe erzeugen große Späne. Passen sie nicht in die Zahnlücken, setzt sich das Blatt zu und schneidet nicht mehr.', ['Wohin müssen die Späne beim Sägen?', 'Zu kleine Lücken werden schnell voll.']],
    ['Beim Feilen mit einer Flachfeile: Wann wird Druck ausgeübt?', 'Beim Vorwärtshub, beim Rückhub wird die Feile entlastet', ['Beim Rückhub, weil die Feile dort die Späne abträgt', 'Bei beiden Hüben mit gleichem Druck, das geht schneller', 'Nur beim Anfeilen, danach genügt das Gewicht der Feile'], 'Wie die Säge schneidet auch die Feile nur in einer Richtung, nach vorn. Beim Zurückziehen schont man die Zähne, indem man den Druck wegnimmt.', ['Die Hiebe zeigen nach vorn.', 'Zurück wird nur geführt, nicht geschnitten.']],
    ['Welche Feile nimmst du zum Schlichten, also zum feinen Nacharbeiten bis zum Maß?', 'Eine Feile mit feinem Hieb und hoher Hiebnummer', ['Eine Feile mit grobem Hieb und niedriger Hiebnummer', 'Eine Rundfeile, weil sie den Span besser fasst', 'Eine Feile mit möglichst großen, tiefen Zähnen'], 'Zum groben Abtragen nimmt man grobe Feilen, zum Schlichten feine. Feine Zähne nehmen wenig Werkstoff mit und hinterlassen eine glatte Fläche.', ['Schlichten heißt: wenig abtragen, glatte Fläche.', 'Hohe Nummer bedeutet feinere Zähne.']],
    ['Wie spannst du ein Blech zum Sägen am besten ein?', 'Nah an der Sägestelle im Schraubstock, damit es nicht schwingt', ['Lose in der Hand, damit man es beim Sägen drehen kann', 'Möglichst weit von der Sägestelle entfernt eingespannt', 'Mit der freien Hand direkt neben dem Sägeblatt gehalten'], 'Ein Teil, das schwingt, lässt das Blatt einhaken. Wenn die Spannstelle nah am Schnitt liegt, bleibt das Blech ruhig. Hände gehören nie neben das Blatt.', ['Ein schwingendes Blech haken die Zähne an.', 'Sicherheit: Hände weg vom Sägeblatt.']]
  ];
  /* PRUEFEN P6: Aussagen zur neutralen Faser (außen gedehnt, innen gestaucht, Länge der neutralen Faser bleibt gleich, bei großem Radius etwa Blechmitte). */
  const NEQ = [
    ['Ein Blech wird zu einem Winkel gebogen. Was geschieht mit den Fasern außen und innen?', 'Außen werden sie gedehnt, innen gestaucht', ['Außen werden sie gestaucht, innen gedehnt', 'Außen und innen werden sie gleichmäßig gedehnt', 'Außen und innen bleiben sie völlig unverändert'], 'Die Außenseite hat den längeren Weg und wird gedehnt, die Innenseite den kürzeren und wird zusammengedrückt (gestaucht).', ['Auf der Außenseite der Kurve ist der Weg länger.', 'Innen wird der Weg kürzer.']],
    ['Was bezeichnet man als neutrale Faser?', 'Die Schicht, deren Länge beim Biegen gleich bleibt', ['Die äußerste Schicht, die beim Biegen am meisten reißt', 'Die innerste Schicht, die dabei zusammengedrückt wird', 'Die Mittellinie, die beim Biegen immer kürzer wird'], 'Zwischen der gedehnten Außenseite und der gestauchten Innenseite liegt eine Schicht, die weder länger noch kürzer wird: die neutrale Faser.', ['Sie liegt zwischen Dehnung und Stauchung.', 'Neutral heißt: nichts ändert sich.']],
    ['Warum rechnet man die gestreckte Länge mit der neutralen Faser?', 'Nur ihre Länge ändert sich beim Biegen nicht', ['Sie ist die kürzeste Faser und spart Material', 'Sie ist die Faser mit der größten Dehnung', 'Sie liegt immer genau auf der Blechaußenseite'], 'Die Länge der Außenseite wächst, die der Innenseite schrumpft. Nur die neutrale Faser behält ihre Länge. Ihr Verlauf ergibt darum die Länge des Zuschnitts.', ['Wir brauchen die Länge, die vor und nach dem Biegen gleich ist.', 'Welche Faser bleibt gleich lang?']],
    ['Bei weichem Blech und großem Biegeradius liegt die neutrale Faser etwa …', 'in der Mitte der Blechdicke', ['an der Außenseite des Blechs', 'an der Innenseite des Blechs', 'weit außerhalb des Blechs'], 'Für das Übungsmodell nimmst du die Blechmitte an (Radius r + s/2). Bei kleinen Radien wandert sie in der Praxis etwas nach innen.', ['Dehnung außen und Stauchung innen gleichen sich aus.', 'Das Übungsmodell nutzt die Blechmitte.']]
  ];
  /* PRUEFEN P13: Aussagen zu Rückfederung, Walzrichtung, Biegeradius, Richten. Die Faustregeln sind vereinfacht (kein k-Faktor, keine Biegetabellen). */
  const BIQ = [
    ['Ein Blech federt nach dem Biegen etwas zurück. Was tust du?', 'Etwas über den Sollwinkel hinaus biegen', ['Das Blech vorher stark erwärmen und härten', 'Den Biegeradius möglichst klein wählen', 'Nach dem Biegen mit dem Hammer glatt klopfen'], 'Ein Teil der Verformung ist elastisch und geht beim Entlasten zurück. Biegt man ein wenig weiter, federt das Blech auf den gewünschten Winkel zurück.', ['Das Blech will in seine alte Form zurück.', 'Gleiche den Verlust im Voraus aus.']],
    ['Wie legt man die Biegekante zur Walzrichtung des Blechs?', 'Möglichst quer zur Walzrichtung, das mindert die Rissgefahr', ['Möglichst längs zur Walzrichtung, das mindert die Rissgefahr', 'Die Lage zur Walzrichtung hat nie einen Einfluss', 'Immer schräg, damit das Blech sicher zurückfedert'], 'Beim Walzen entstehen Fasern in Walzrichtung. Quer dazu ist das Blech beim Biegen weniger anfällig für Risse an der Außenseite.', ['Das Walzen gibt dem Blech eine Faserrichtung.', 'Reißen soll die Außenseite nicht.']],
    ['Warum darf der Innenradius beim Biegen nicht beliebig klein werden?', 'Außen wird der Werkstoff zu stark gedehnt und kann reißen', ['Innen wird das Blech zu stark gedehnt und reißt dort', 'Die neutrale Faser wandert dann nach außen aus dem Blech', 'Das Blech würde dabei zu heiß werden und schmelzen'], 'Je kleiner der Radius, desto stärker die Dehnung auf der Außenseite. Dort reißt der Werkstoff zuerst, wenn der Radius zu klein ist.', ['Wo wird der Werkstoff gedehnt?', 'Scharfe Kanten belasten die Außenseite stark.']],
    ['Was bedeutet Richten in der Fertigung?', 'Ein verzogenes Teil gezielt verformen und wieder in Form bringen', ['Ein Teil zum Anreißen auf der Platte ausrichten und fest einspannen', 'Eine Schweißnaht nach dem Schweißen glatt und eben schleifen', 'Ein Werkstück mit der Richtschnur genau ausmessen und anreißen'], 'Beim Richten wird ein Werkstück gezielt so belastet, dass es plastisch in die Sollform zurückgeht. Man misst dabei zwischendurch.', ['Das Teil ist verzogen oder krumm.', 'Das Teil soll wieder die richtige Form bekommen.']],
    ['Was ist beim Richten einer verzogenen Welle sinnvoll?', 'Die hohe Stelle gezielt belasten und zwischendurch messen', ['Mit starken Schlägen auf die ganze Länge der Welle hämmern', 'Die Welle ohne Zwischenmessen in einem Zug gerade pressen', 'Die Welle nur an den Enden halten und kräftig verdrehen'], 'Zu viel Kraft biegt die Welle auf die andere Seite. Darum belastet man dosiert und kontrolliert nach jedem Schritt.', ['Zu viel Kraft verbiegt das Teil auf die Gegenseite.', 'Kontrolliere das Ergebnis häufig.']],
    ['Beim Biegen reißt die Außenseite eines Blechwinkels. Welche Maßnahme hilft?', 'Größeren Biegeradius wählen oder quer zur Walzrichtung biegen', ['Den Radius kleiner wählen, damit das Blech schärfer knickt', 'Das Blech vor dem Biegen noch ein ganzes Stück dünner feilen', 'Mit kleinerem Biegewinkel, aber gleichem Radius und Blech arbeiten'], 'Ein größerer Radius verteilt die Dehnung auf mehr Länge. Auch die Lage der Biegekante quer zur Walzrichtung senkt die Rissgefahr.', ['Die Dehnung außen ist zu groß.', 'Zwei Stellschrauben: Radius und Faserrichtung.']]
  ];
  /* PRUEFEN P14: Aussagen zu Prüfplan, Stichprobe, systematischen und zufälligen Fehlern, Qualitätsregelkarte, Fehlerbewertung (Hauptfehler, Nebenfehler). Stimmen die Begriffe mit dem Lehrmaterial überein? */
  const PQ = [
    ['Was gehört in einen Prüfplan?', 'Merkmal, Prüfmittel, Umfang und Häufigkeit der Prüfung', ['Nur die geplanten Fertigungsstunden für den gesamten Auftrag', 'Ein Verzeichnis aller Werkzeuge der ganzen Werkstatt', 'Die Verkaufspreise der fertigen Teile je Stück'], 'Ein Prüfplan legt fest, was geprüft wird (Merkmal), womit (Prüfmittel), wie viele Teile (Umfang) und wie oft (Häufigkeit).', ['Was, womit, wie viel, wie oft?', 'Preise und Werkzeugverzeichnisse gehören nicht dazu.']],
    ['Warum prüft man oft nur eine Stichprobe statt aller Teile?', 'Eine Vollprüfung ist zu teuer, dauert zu lang oder zerstört das Teil', ['Eine Stichprobe ist immer genauer als die Prüfung aller Teile', 'Die Prüfmittel dürfen nur für wenige Teile genutzt werden', 'Fehlerhafte Teile fallen in der Stichprobe nie auf'], 'Alle Teile zu prüfen kostet Zeit und Geld und ist bei zerstörender Prüfung unmöglich. Aus der Stichprobe schließt man auf die ganze Menge.', ['Denke an Zeit, Kosten und zerstörende Prüfungen.', 'Eine Stichprobe liefert nur einen Ausschnitt.']],
    ['Alle Teile einer Serie sind um etwa 0,05 mm zu lang. Welche Art von Abweichung liegt vor?', 'Eine systematische Abweichung, die Lage ist verschoben', ['Eine zufällige Abweichung, die Teile streuen unregelmäßig', 'Ein Ausreißer, der nur ein einzelnes Teil betrifft', 'Eine Messabweichung, die im Prozess nie vorkommt'], 'Wirkt die Abweichung bei jedem Teil gleich in dieselbe Richtung, ist sie systematisch, zum Beispiel durch einen falsch eingestellten Anschlag.', ['Immer in dieselbe Richtung heißt systematisch.', 'Ein Anschlag oder Maß kann verstellt sein.']],
    ['Die Maße streuen ohne erkennbares Muster um den Sollwert. Welche Art von Abweichung ist das?', 'Zufällige Abweichungen, die nicht vorhersehbar sind', ['Systematische Abweichungen mit festem Betrag', 'Grobe Fehler beim Ablesen des Messwerts', 'Abweichungen, die allein durch den Prüfplan entstehen'], 'Zufällige Abweichungen verteilen sich unregelmäßig nach beiden Seiten. Sie lassen sich nicht einzeln vorhersagen, wohl aber mit der Streuung beschreiben.', ['Kein Muster, keine feste Richtung.', 'Wechselnd nach plus und minus.']],
    ['Wozu dient eine Qualitätsregelkarte?', 'Den Prozess beobachten und eingreifen, bevor Ausschuss entsteht', ['Fertige Teile nachträglich in gut und schlecht sortieren', 'Die Arbeitszeit je Teil für die Lohnabrechnung erfassen', 'Den Verbrauch von Werkzeug und Material verbuchen'], 'Die Karte zeigt die Messwerte in der Reihenfolge der Fertigung. Man erkennt Trends und Verschiebungen, bevor Teile außerhalb der Toleranz liegen.', ['Vorbeugen ist besser als sortieren.', 'Die Karte folgt der Zeit.']],
    ['Ein Fehler macht das Teil unbrauchbar. Wie wird er meist eingestuft?', 'Als Hauptfehler, das Teil ist unbrauchbar', ['Als Nebenfehler, der die Funktion kaum stört', 'Als Schönheitsfehler ohne Bedeutung für den Einsatz', 'Als zulässige Streuung im laufenden Prozess'], 'Fehler werden nach ihrer Wirkung bewertet. Ein Hauptfehler (kritisch) hebt die Funktion auf. Nebenfehler beeinträchtigen sie nur wenig.', ['Es kommt auf die Folge für die Funktion an.', 'Unbrauchbar ist die schwerste Stufe.']]
  ];
  /* PRUEFEN P15: Aussagen zu Spannen und Lagebestimmung (Hauptauflage = größte Fläche, Überbestimmung, Spannkraft auf die Auflagepunkte, Spanneisen nahe am Werkstück, weiche Schutzbacken, Anschlag sperrt eine Verschiebung). */
  const SPQ = [
    ['Welche Fläche wählt man meist als Hauptauflage mit drei Punkten?', 'Die größte und möglichst ebene Fläche des Teils', ['Die kleinste Fläche, damit wenig Reibung entsteht', 'Die Fläche mit den meisten Bohrungen im Teil', 'Die Fläche, die zuletzt bearbeitet worden ist'], 'Je größer der Abstand der Auflagepunkte, desto stabiler und genauer liegt das Teil. Dafür nimmt man die größte, ebenste Fläche.', ['Große Punktabstände geben stabile Lage.', 'Die Fläche soll eben sein.']],
    ['Warum setzt man auf der Hauptauflage nicht mehr als drei Punkte?', 'Vier Punkte bestimmen die Ebene doppelt, das Teil kippelt', ['Mehr Punkte verteilen die Spannkraft zu gleichmäßig auf das Teil', 'Vier Punkte würden das Werkstück beim Spannen stets verbiegen', 'Mehr Punkte kosten mehr, ändern aber nichts an der Lage des Teils'], 'Drei Punkte legen eine Ebene fest. Ein vierter Punkt liegt meist nicht genau in dieser Ebene: Das Teil wackelt oder wird beim Spannen verspannt (überbestimmt).', ['Drei Punkte genügen für eine Ebene.', 'Ein Tisch mit vier Beinen kann wackeln.']],
    ['Wohin soll die Spannkraft beim Spannen wirken?', 'Auf die Auflagepunkte, damit nichts durchgebogen wird', ['Auf eine freie Stelle zwischen den Auflagepunkten des Teils', 'Möglichst weit entfernt von allen Auflagepunkten', 'Nur seitlich, quer zu den Auflagepunkten'], 'Wirkt die Kraft zwischen den Stützpunkten, biegt sich das Teil durch. Wirkt sie in Richtung der Auflagepunkte, wird das Teil sicher gehalten, ohne sich zu verformen.', ['Wo wird das Teil gestützt?', 'Frei schwebende Stellen biegen sich durch.']],
    ['Wo sitzt die Schraube am Spanneisen am besten?', 'Möglichst nah am Werkstück, damit dort die Kraft wirkt', ['Möglichst nah an der Auflage des Spanneisens, weit vom Teil', 'Genau in der Mitte zwischen Auflage und Werkstück', 'Die Lage der Schraube hat keinen Einfluss'], 'Das Spanneisen ist ein Hebel. Je näher die Schraube am Werkstück sitzt, desto mehr von der Schraubenkraft kommt dort an.', ['Denke an einen Hebel.', 'Wo soll die Kraft ankommen?']],
    ['Wozu nimmt man im Schraubstock weiche Schutzbacken?', 'Sie verhindern Eindrücke auf fertigen Flächen', ['Sie erhöhen die Spannkraft auf das Doppelte', 'Sie machen das Teil beim Spannen wärmer', 'Sie ersetzen bei der Lagebestimmung die Hauptauflage'], 'Weiches Material wie Alu oder Kupfer passt sich an und schützt die fertige Oberfläche vor Spannspuren.', ['Es geht um den Schutz der Oberfläche.', 'Weiche Backen verhindern Eindrücke und Kratzer an fertigen Flächen.']],
    ['Was sperrt der Anschlag bei der 3-2-1-Regel?', 'Eine einzige Verschiebung in Richtung des Anschlags', ['Eine Drehung um die Hochachse des Teils', 'Zwei Verschiebungen zugleich in einer waagerechten Ebene', 'Eine Drehung um die Längsachse des Teils'], 'Der eine Punkt des Anschlags nimmt dem Teil die letzte offene Verschiebung. Damit sind alle sechs Freiheitsgrade bestimmt.', ['Es ist nur ein Punkt, also ein Freiheitsgrad.', 'Drehungen sperren die Punkte der anderen Flächen.']]
  ];
  /* PRUEFEN P16: Beschreibungen von Vorgängen (ohne Verfahrensnamen) und deren Zuordnung zu den Hauptgruppen. Sind alle Beispiele eindeutig, und fehlen Verfahren, die in der Grundausbildung vorkommen? */
  const VORG = [
    ['Flüssiges Metall wird in eine Form gefüllt und erstarrt dort zu einem festen Teil.', 1],
    ['Metallpulver wird in eine Form gepresst und anschließend bei hoher Temperatur verfestigt.', 1],
    ['Ein Blechstreifen wird im Schraubstock zum Winkel gebogen, die Masse bleibt gleich.', 2],
    ['Ein glühender Stahlstab wird mit dem Hammer auf Form gebracht.', 2],
    ['Aus einer Blechplatine entsteht in einem Werkzeug eine tiefe Schale, ohne dass etwas abfällt.', 2],
    ['Von einer Stange wird mit der Bügelsäge ein Stück abgetrennt, dabei fallen Späne.', 3],
    ['In eine Platte wird ein Loch gebohrt, die Späne werden entfernt.', 3],
    ['Ein Blech wird mit der Schlagschere in zwei Teile geteilt.', 3],
    ['Zwei Bleche werden mit Schraube und Mutter zu einer Baugruppe verbunden.', 4],
    ['Zwei Teile werden mit flüssigem Zinn und Hitze dauerhaft miteinander verbunden.', 4],
    ['Ein Beschlag wird mit einem Zweikomponentenmittel auf das Gehäuse gefügt.', 4],
    ['Ein Stahlteil bekommt eine dünne, fest haftende Zinkschicht gegen Rost.', 5],
    ['Ein Gehäuse wird gleichmäßig mit Pulverlack überzogen und im Ofen eingebrannt.', 5],
    ['Ein Werkzeug wird erhitzt und abgeschreckt, damit es härter wird, die Form bleibt gleich.', 6],
    ['Ein Stahlteil wird lange bei hoher Temperatur gehalten, damit die Spannungen im Gefüge abgebaut werden.', 6]
  ];
  const CHAINS = [
    [['Das Rohteil wird in einer Sandform gegossen', 1], ['Die Auflagefläche wird mit der Feile geebnet', 3], ['Eine Gewindebohrung wird von Hand geschnitten', 3], ['Der Bock wird an die Platte geschraubt', 4], ['Das Teil wird mit Lack überzogen', 5]],
    [['Das Blech wird mit der Schlagschere zugeschnitten', 3], ['Der Streifen wird im Schraubstock abgekantet', 2], ['Die Teile werden zusammengelötet', 4], ['Das Teil wird pulverbeschichtet', 5]],
    [['Der Stahl wird im Feuer geschmiedet', 2], ['Die Schneide wird mit der Feile angeschrägt', 3], ['Das Teil wird gehärtet', 6], ['Der Griff wird aufgeklebt', 4]],
    [['Die Stange wird warm gewalzt', 2], ['Die Welle wird abgesägt', 3], ['Die Oberfläche wird nitriert', 6], ['Die Welle wird lackiert', 5]]
  ];
  /* PRUEFEN P17: Arbeitspläne (Reihenfolge der Arbeitsschritte) für drei einfache Werkstücke. Besonders: Bohren vor dem Abkanten im flachen Blech, Feilen der Bezugskanten vor dem Anreißen, Entgraten vor der Endprüfung. Passt die Reihenfolge zur Werkstattpraxis? */
  const PLANS = [
    { t: 'eine Winkelplatte aus Flachstahl mit Gewindebohrung', st: ['Rohteil auf Länge sägen', 'Bezugskanten rechtwinklig feilen', 'Maße anreißen und Bohrungsmitte körnen', 'Kernloch bohren und ansenken', 'Gewinde mit Gewindebohrer schneiden', 'Alle Kanten entgraten', 'Maße und Gewinde prüfen'] },
    { t: 'einen Blechwinkel mit zwei Bohrungen', st: ['Zuschnitt aus der Blechtafel schneiden', 'Bohrungen und Biegelinie anreißen und körnen', 'Bohrungen im flachen Blech bohren', 'Kanten und Bohrungen entgraten', 'Blech an der Biegelinie abkanten', 'Winkel und Lage der Bohrungen prüfen'] },
    { t: 'eine Platte mit einer gerieben Passbohrung', st: ['Rohteil auf Länge sägen', 'Bezugskanten feilen', 'Bohrungsmitte anreißen und körnen', 'Mit etwas kleinerem Durchmesser vorbohren', 'Mit Handreibahle auf Maß reiben', 'Kanten entgraten', 'Maß der Bohrung prüfen'] }
  ];
  PLANS[2].t = 'eine Platte mit einer geriebenen Passbohrung';
  const GEWSTEP = ['Kernloch passend zum Gewinde bohren', 'Kernloch mit dem Senker anfasen', 'Werkstück sicher spannen', 'Vorschneider mit Schmiermittel rechtwinklig ansetzen und schneiden', 'Mit Mittel- und Fertigschneider nacharbeiten', 'Gewinde mit einer Schraube oder Lehre prüfen'];

  /* ---------- Regelkarten-Daten ---------- */
  function seriesFor(R, kind) {
    const c = C(), n = 24, mu = 0, sg = 1;
    for (let a = 0; a < 400; a++) {
      const cl = z => Math.max(-1.7, Math.min(1.7, z));
      const s = []; for (let i = 0; i < n; i++) s.push(cl(c.gauss(R)) * 0.75);
      if (kind === 'aus') { const i = c.ri(R, 6, n - 3), sgn = R() < 0.5 ? -1 : 1; s[i] = sgn * (3.3 + R() * 0.5); }
      if (kind === 'trend') { const i0 = c.ri(R, 3, n - 11), dir = R() < 0.5 ? -1 : 1, st = 0.35 + R() * 0.12; for (let j = 0; j < 9; j++) s[i0 + j] = dir * (-1.4 + j * st) + (R() - 0.5) * 0.1; }
      if (kind === 'lage') { const i0 = c.ri(R, 3, n - 11), sgn = R() < 0.5 ? -1 : 1; for (let j = 0; j < 9; j++) s[i0 + j] = sgn * (0.35 + R() * 0.9); }
      const lim = c.limits(mu, sg, 1), v = c.chartVerdict(s, lim);
      if (v === kind) return s.map(x => c.rd(x, 3));
    }
    return null;
  }
  const RULES_TXT = 'Eingriff ist nötig, wenn ein Punkt außerhalb der Eingriffsgrenzen liegt, wenn sieben Punkte in Folge steigen oder fallen oder wenn sieben Punkte in Folge auf derselben Seite der Mittellinie liegen.';
  const KARTE = {
    ok: 'Der Prozess ist stabil, ein Eingriff ist nicht nötig',
    aus: 'Ein Punkt liegt außerhalb der Eingriffsgrenzen, die Ursache wird gesucht',
    trend: 'Die Werte laufen stetig in eine Richtung, ein Trend zeichnet sich ab',
    lage: 'Viele Werte in Folge liegen auf einer Seite, die Lage hat sich verschoben'
  };

  /* ---------- Generatoren ---------- */
  const G = {
    verfgrp: R => {
      const c = C(), o = c.pick(R, c.PROC), g = c.group(o.g), wrong = c.shuffle(R, GN().filter(x => x !== g.t)).slice(0, 3);
      return choiceQ(R, 'Zu welcher Hauptgruppe der Fertigungsverfahren nach DIN 8580 gehört „' + o.p + '“?', g.t, wrong,
        o.p + ' gehört zur Hauptgruppe ' + g.n + ' (' + g.t + '). Kennzeichen: ' + g.d, ['Frage dich: Wird etwas hergestellt, umgeformt, abgetrennt, verbunden, beschichtet oder im Gefüge verändert?', 'Die Hauptgruppen heißen Urformen, Umformen, Trennen, Fügen, Beschichten und Stoffeigenschaft ändern.'], { k: 'landkarte' });
    },
    zush: R => {
      const c = C(), g = c.pick(R, c.GROUPS), T = {
        1: 'Aus formlosem Stoff, zum Beispiel flüssigem Metall, entsteht zum ersten Mal ein fester Körper mit einer Form.',
        2: 'Die Form eines festen Körpers wird plastisch verändert, ohne dass Stoff verloren geht oder dazukommt.',
        3: 'Stoffteile werden aus dem Werkstück herausgelöst oder das Werkstück wird in Teile geteilt.',
        4: 'Mehrere einzelne Werkstücke werden miteinander zu einer Einheit verbunden.',
        5: 'Auf die Oberfläche eines Werkstücks wird eine fest haftende Schicht aufgebracht.',
        6: 'Die Eigenschaften des Werkstoffs werden verändert, die Form bleibt dabei nahezu gleich.'
      }, wrong = c.shuffle(R, GN().filter(x => x !== g.t)).slice(0, 3);
      return choiceQ(R, T[g.n] + ' Welche Hauptgruppe nach DIN 8580 beschreibt das?', g.t, wrong,
        'Das ist die Hauptgruppe ' + g.n + ' (' + g.t + '): ' + g.zl + '. ' + g.d, ['Achte auf das, was mit dem Zusammenhalt des Werkstoffs geschieht.', 'Wird der Zusammenhalt geschaffen, beibehalten, vermindert, vermehrt oder werden nur Eigenschaften geändert?'], { k: 'landkarte' });
    },
    verfmatch: R => {
      const c = C(), gs = c.shuffle(R, [1, 2, 3, 4, 5, 6]).slice(0, 4), rows = gs.map(n => c.pick(R, c.PROC.filter(o => o.g === n)).p);
      return matchQ(R, 'Ordne jedem Verfahren die passende Hauptgruppe nach DIN 8580 zu.', rows, GN(), gs.map(n => n - 1),
        gs.map((n, i) => rows[i] + ' → ' + gname(n)).join('; ') + '.', ['Entscheide jedes Verfahren einzeln.', 'Überlege, was mit dem Werkstück geschieht: neu entstehen, Form ändern, abtrennen, verbinden, beschichten, Eigenschaft ändern.']);
    },
    vorgang: R => {
      const c = C(), v = c.pick(R, VORG), g = c.group(v[1]), wrong = c.shuffle(R, GN().filter(x => x !== g.t)).slice(0, 3);
      return choiceQ(R, v[0] + ' Welche Hauptgruppe nach DIN 8580 ist das?', g.t, wrong, 'Das gehört zur Hauptgruppe ' + g.n + ' (' + g.t + '). ' + g.d, ['Frage dich, was am Ende mit dem Zusammenhalt des Teils geschehen ist.', 'Bleibt Stoff erhalten, geht etwas ab, kommt etwas dazu oder ändert sich nur das Gefüge?'], { k: 'landkarte' });
    },
    kette: R => {
      const c = C(), ch = c.pick(R, CHAINS), steps = c.shuffle(R, ch).slice(0, 4);
      return matchQ(R, 'Ein Bauteil entsteht in mehreren Arbeitsschritten. Ordne jedem Schritt die Hauptgruppe nach DIN 8580 zu.', steps.map(s => s[0]), GN(), steps.map(s => s[1] - 1),
        steps.map(s => s[0] + ' → ' + gname(s[1])).join('; ') + '.', ['Prüfe jeden Schritt einzeln, nicht das ganze Bauteil.', 'Feilen und Bohren trennen Stoff ab, Schrauben und Löten fügen.']);
    },
    kern: R => {
      const c = C(), d = c.pick(R, [4, 5, 6, 8, 10, 12, 16]), th = c.thread(d);
      return numQ('Ein Innengewinde M' + d + ' (metrisches Regelgewinde, Steigung P = ' + f(th.P, 2) + ' mm) wird von Hand geschnitten. Welchen Kernlochdurchmesser bohrst du? Als Richtwert gilt: Kernloch etwa Nenndurchmesser minus Steigung, ausgewählt nach der Gewindetabelle.',
        th.kern, 'mm', 'Kernlochdurchmesser', 0.06, 'Kernloch ≈ d − P = ' + d + ' mm − ' + f(th.P, 2) + ' mm = ' + f(c.kernFaust(d), 2) + ' mm. Die Gewindetabelle nennt ' + f(th.kern, 1) + ' mm (gebohrt wird mit dem passenden Bohrer).', ['Ziehe von M-Größe die Steigung ab.', 'Der Bohrer wird nach der Tabelle gewählt, der Richtwert liegt innerhalb ±0,05 mm.'], { k: 'gewinde', d, vals: false });
    },
    hwz: pq(HWQ),
    saege: pq(SAQ),
    loch: R => {
      const c = C(), d = c.pick(R, [4, 5, 6, 8, 10, 12]), v = c.durchgang(d);
      return numQ('Eine Schraube M' + d + ' soll ohne Gewinde durch eine Platte gesteckt werden. Du bohrst ein Durchgangsloch, mittlere Reihe nach DIN EN 20273 (Werte siehe Hilfe). Welchen Durchmesser bohrst du?', v, 'mm', 'Durchgangsloch', 0.05,
        'Das Durchgangsloch der mittleren Reihe für M' + d + ' ist ' + f(v, 1) + ' mm. Es ist größer als der Gewindedurchmesser, damit die Schraube mit etwas Spiel passt.', ['Das Loch muss größer sein als der Schraubendurchmesser.', 'Schau in die Tabelle der Hilfe, mittlere Reihe.'], { k: 'schraube', d, vals: false });
    },
    reib: R => {
      const c = C(), D = c.pick(R, [6, 8, 10, 12, 16, 20]), z = c.reibAufmass(D);
      return numQ('Eine Bohrung von Ø' + D + ' mm soll mit der Handreibahle auf Maß gebracht werden. Faustregel für das Aufmaß: 0,1 mm bei Durchmessern bis 10 mm, 0,2 mm darüber (Übungswert, maßgeblich sind Tabellenbuch oder Arbeitsanweisung). Welchen Durchmesser bohrst du vor?', D - z, 'mm', 'Vorbohrdurchmesser', 0.005,
        'Aufmaß = ' + f(z, 1) + ' mm, also Vorbohrdurchmesser = ' + D + ' mm − ' + f(z, 1) + ' mm = ' + f(D - z, 1) + ' mm. Die Reibahle trägt nur wenig Werkstoff ab und wird im Uhrzeigersinn gedreht, auch beim Herausziehen.', ['Die Reibahle soll nur ein wenig Werkstoff abnehmen.', 'Achte darauf, ob der Durchmesser über oder unter 10 mm liegt.']);
    },
    gewschr: R => orderQ(R, 'Ein Innengewinde wird von Hand in eine Platte geschnitten. Bringe die Schritte in die richtige Reihenfolge.', GEWSTEP.slice(),
      'Erst das passende Kernloch bohren und anfasen, dann spannen. Mit dem Vorschneider beginnt man, danach folgen Mittel- und Fertigschneider. Zum Schluss prüft man das Gewinde.', ['Ohne Kernloch kein Gewinde, und geprüft wird zuletzt.', 'Die Gewindebohrer eines Satzes werden nacheinander benutzt.']),
    sackloch: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12]), th = c.thread(d), T = c.gewTiefe(d), v = c.bohrtiefe(T, d);
      return numQ('In Stahl soll ein Sackloch-Gewinde M' + d + ' (P = ' + f(th.P, 2) + ' mm) geschnitten werden. Die nutzbare Gewindetiefe soll 1,5 · d betragen. Für den Auslauf des Gewindebohrers rechnest du 3 · P zusätzlich ein. Wie tief bohrst du das Kernloch (ohne Bohrerspitze)?', v, 'mm', 'Bohrtiefe', 0.06,
        'Nutzbare Gewindetiefe T = 1,5 · ' + d + ' mm = ' + f(T, 1) + ' mm. Auslauf = 3 · ' + f(th.P, 2) + ' mm = ' + f(3 * th.P, 2) + ' mm. Bohrtiefe = ' + f(T, 1) + ' mm + ' + f(3 * th.P, 2) + ' mm = ' + f(v, 2) + ' mm.', ['Rechne zuerst die nutzbare Gewindetiefe aus.', 'Addiere dann den Auslauf.'], { k: 'gewinde', d, vals: false });
    },
    neutral: pq(NEQ),
    bogen: R => {
      const c = C(), s = c.pick(R, [1, 1.5, 2, 2.5, 3, 4]), r = c.pick(R, [2, 3, 4, 5, 6, 8]), a = c.pick(R, [30, 45, 60, 90, 120]), v = c.arc(r, s, a);
      return numQ('Ein Blech der Dicke s = ' + f(s, 1) + ' mm wird mit dem Innenradius r = ' + f(r, 0) + ' mm um ' + a + '° gebogen. Rechne mit der neutralen Faser in der Blechmitte (Radius r + s/2). Wie lang ist der Bogen der neutralen Faser?', v, 'mm', 'Bogenlänge', 0.06,
        'Radius der neutralen Faser = ' + f(r, 0) + ' + ' + f(s / 2, 2) + ' = ' + f(r + s / 2, 2) + ' mm. Bogenlänge = π · ' + f(r + s / 2, 2) + ' mm · ' + a + '° / 180° = ' + f(v, 2) + ' mm.' + ' Das ist ein Übungsmodell: In der Werkstatt biegst du ein Probestück und korrigierst den Zuschnitt.', ['Der Radius der neutralen Faser ist r plus halbe Blechdicke.', 'Bogenlänge = π · Radius · Winkel / 180°.'], { k: 'bieg', mode: 'bogen', r, s, a, vals: false });
    },
    gestrW: R => {
      const c = C(), s = c.pick(R, [2, 3, 4]), r = c.pick(R, [s, 2 * s, 3 * s]), a = c.ri(R, 5, 18) * 5, b = c.ri(R, 5, 18) * 5, L = c.lenOuter([a, b], r, s), arcL = c.arc(r, s, 90);
      return numQ('Ein Blechwinkel (90°) aus s = ' + f(s, 0) + ' mm Blech mit dem Innenradius r = ' + f(r, 0) + ' mm hat die Außenmaße a = ' + a + ' mm und b = ' + b + ' mm (gemessen bis zur Außenseite der Biegung). Wie lang ist der gestreckte Zuschnitt? Rechne mit der neutralen Faser in der Blechmitte.', L, 'mm', 'Gestreckte Länge', 0.1,
        'Gerade Teile: (a − r − s) + (b − r − s) = ' + f(a - r - s, 1) + ' + ' + f(b - r - s, 1) + ' = ' + f(a + b - 2 * (r + s), 1) + ' mm. Bogen: π · (r + s/2) / 2 = ' + f(arcL, 2) + ' mm. Gestreckte Länge = ' + f(L, 2) + ' mm. Das ist ein Übungsmodell: In der Werkstatt biegst du ein Probestück und korrigierst den Zuschnitt.', ['Ziehe von jedem Außenmaß r + s ab, das sind die geraden Teile.', 'Addiere den Viertelkreisbogen der neutralen Faser.'], { k: 'bieg', mode: 'out', n: 2, s, r, vals: false });
    },
    biegepool: pq(BIQ),
    gestrU: R => {
      const c = C(), s = c.pick(R, [2, 3, 4]), r = c.pick(R, [s, 2 * s]), a = c.ri(R, 5, 14) * 5, b = c.ri(R, 5, 14) * 5 + 20, d3 = c.ri(R, 5, 14) * 5, L = c.lenOuter([a, b, d3], r, s), arcL = c.arc(r, s, 90);
      return numQ('Ein U-Profil aus s = ' + f(s, 0) + ' mm Blech mit dem Innenradius r = ' + f(r, 0) + ' mm (beide Biegungen 90°) hat die Außenmaße: linker Schenkel ' + a + ' mm, Boden ' + b + ' mm, rechter Schenkel ' + d3 + ' mm (jeweils bis zur Außenseite der Biegungen). Wie lang ist der gestreckte Zuschnitt (neutrale Faser in der Blechmitte)?', L, 'mm', 'Gestreckte Länge', 0.1,
        'Gerade Teile: (' + a + ' − ' + f(r + s, 0) + ') + (' + b + ' − ' + f(2 * (r + s), 0) + ') + (' + d3 + ' − ' + f(r + s, 0) + ') = ' + f(a + b + d3 - 4 * (r + s), 1) + ' mm. Zwei Bögen zu je ' + f(arcL, 2) + ' mm = ' + f(2 * arcL, 2) + ' mm. Gestreckte Länge = ' + f(L, 2) + ' mm. Das ist ein Übungsmodell: In der Werkstatt biegst du ein Probestück und korrigierst den Zuschnitt.', ['Der Boden verliert an beiden Enden je r + s.', 'Zwei Biegungen: zwei Viertelkreisbögen.'], { k: 'bieg', mode: 'out', n: 3, s, r, vals: false });
    },
    zugabe: R => {
      const c = C(), fert = c.ri(R, 8, 40) * 5, z = c.pick(R, [1, 1.5, 2, 2.5]), v = c.rohlaenge(fert, z, 2);
      return numQ('Eine Welle soll fertig ' + fert + ' mm lang sein. Beide Stirnseiten werden plangedreht oder auf andere Weise bearbeitet, dafür sind je Stirnseite ' + f(z, 1) + ' mm Zugabe vorgesehen. Wie lang muss das Rohteil mindestens sein?', v, 'mm', 'Rohlänge', 0,
        'Rohlänge = Fertiglänge + 2 · Zugabe = ' + fert + ' mm + 2 · ' + f(z, 1) + ' mm = ' + f(v, 1) + ' mm.', ['Die Zugabe gibt es an jeder bearbeiteten Stirnseite.', 'Zwei Stirnseiten bedeuten zwei Zugaben.']);
    },
    stange: R => {
      const c = C(), l = c.ri(R, 8, 24) * 5, k = c.pick(R, [2, 2.5, 3, 4]), L = c.pick(R, [1000, 1500, 2000, 3000]), v = c.partsFromBar(L, l, k);
      return numQ('Aus einer Stange von ' + L + ' mm Länge werden Rohteile von ' + l + ' mm Länge abgesägt. Jeder Sägeschnitt kostet ' + f(k, 1) + ' mm Schnittbreite. Das letzte Teil endet am Stangenende und braucht keinen eigenen Schnitt. Wie viele Teile bekommst du höchstens?', v, 'Stück', 'Anzahl Teile', 0,
        'Mit n Teilen gibt es n − 1 Schnitte: n · ' + l + ' mm + (n − 1) · ' + f(k, 1) + ' mm ≤ ' + L + ' mm. Das gilt für n = ' + v + ', für ' + (v + 1) + ' Teile wäre es zu viel (Rest bei ' + v + ' Teilen: ' + f(c.barRest(L, l, k), 1) + ' mm).', ['Jedes Teil braucht seine Länge, jeder Schnitt zusätzlich die Schnittbreite.', 'Probiere n und n + 1 Teile aus.'], { k: 'stange', L, l, kerf: k, vals: false });
    },
    ausn: R => {
      const c = C(), S = c.pick(R, [[1000, 2000], [1250, 2500], [1500, 3000]]), W = S[0], H = S[1], e = c.pick(R, [5, 10]), rr = c.pick(R, [10, 15]);
      let w, h, n, ut, tries = 0;
      do { w = c.ri(R, 5, 18) * 10; h = c.ri(R, 8, 30) * 10; n = c.nest(W, H, w, h, e, rr).n; ut = c.nestUtil(W, H, w, h, e, rr); tries++; } while ((!(n >= 6) || ut > 92 || ut < 40) && tries < 200);
      const rot = c.nest(W, H, w, h, e, rr).rot;
      return numQ('Aus einer Blechtafel ' + W + ' mm × ' + H + ' mm werden rechteckige Platinen ' + w + ' mm × ' + h + ' mm geschnitten. Sie liegen alle gleich ausgerichtet in einem Raster mit ' + e + ' mm Steg dazwischen und ' + rr + ' mm Rand rundum. Du darfst die Platinen als Ganzes drehen (alle gleich), wenn mehr hineinpassen. Wie viel Prozent der Tafelfläche werden genutzt (Fläche aller Platinen durch Tafelfläche)?', ut, '%', 'Materialausnutzung', 0.3,
        'Anzahl bei Lage ' + (rot ? 'gedreht' : 'wie gegeben') + ': ' + c.nest(W, H, w, h, e, rr).nx + ' × ' + c.nest(W, H, w, h, e, rr).ny + ' = ' + n + ' Platinen (Formel je Richtung: (Länge − 2 · Rand + Steg) / (Teilmaß + Steg), abgerundet). Ausnutzung = ' + n + ' · ' + w + ' · ' + h + ' / (' + W + ' · ' + H + ') = ' + f(ut, 2) + ' %.', ['Rechne je Richtung, wie viele Platinen nebeneinander passen: (Länge − 2 · Rand + Steg) / (Teilmaß + Steg), abgerundet.', 'Probiere beide Lagen und nimm die bessere.'], { k: 'tafel', W, H, w, h, vals: false });
    },
    masse: R => {
      const c = C(), mat = c.pick(R, ['Stahl', 'Aluminium']), rho = c.DENS[mat], l = c.ri(R, 4, 30) * 10, b = c.ri(R, 3, 20) * 10, s = c.pick(R, [2, 3, 4, 5, 6]), v = c.mass(l, b, s, rho);
      return numQ('Eine Platine aus ' + mat + ' (Dichte ' + f(rho, 2) + ' kg/dm³) misst ' + l + ' mm × ' + b + ' mm × ' + s + ' mm. Wie schwer ist sie?', v, 'kg', 'Masse', 0.02,
        'Volumen = ' + l + ' · ' + b + ' · ' + s + ' mm³ = ' + f(l * b * s / 1e6, 4) + ' dm³ (1 dm³ = 1 000 000 mm³). Masse = ' + f(l * b * s / 1e6, 4) + ' dm³ · ' + f(rho, 2) + ' kg/dm³ = ' + f(v, 3) + ' kg.', ['Rechne das Volumen in dm³ um, 1 dm³ sind eine Million mm³.', 'Masse = Volumen mal Dichte.']);
    },
    te: R => {
      const c = C(), th = c.ri(R, 8, 40) / 4, tn = c.ri(R, 4, 20) / 4, zE = c.pick(R, [5, 8, 10]), zV = c.pick(R, [8, 10, 12]), v = c.te(th, tn, zE, zV);
      return numQ('Für ein Teil fallen eine Hauptzeit von ' + f(th, 2) + ' min und eine Nebenzeit von ' + f(tn, 2) + ' min an (Grundzeit = Haupt- plus Nebenzeit). Dazu kommen Erholzeit ' + zE + ' % und Verteilzeit ' + zV + ' % der Grundzeit. Wie groß ist die Zeit je Einheit?', v, 'min', 'Zeit je Einheit', 0.05,
        'Grundzeit = ' + f(th, 2) + ' + ' + f(tn, 2) + ' = ' + f(th + tn, 2) + ' min. Zuschlag = ' + (zE + zV) + ' %. Zeit je Einheit = ' + f(th + tn, 2) + ' min · ' + f(1 + (zE + zV) / 100, 2) + ' = ' + f(v, 2) + ' min.', ['Addiere zuerst Haupt- und Nebenzeit.', 'Beide Zuschläge beziehen sich auf die Grundzeit.']);
    },
    auftrag: R => {
      const c = C(), tr = c.pick(R, [20, 30, 45, 60, 90]), m = c.pick(R, [10, 20, 25, 40, 50, 100]), tE = c.ri(R, 20, 120) / 10, v = c.auftragszeit(tr, m, tE) / 60;
      return numQ('Ein Auftrag über ' + m + ' Stück hat eine Rüstzeit von ' + tr + ' min und eine Zeit je Einheit von ' + f(tE, 1) + ' min. Wie lang ist die Auftragszeit in Stunden?', v, 'h', 'Auftragszeit', 0.01,
        'Auftragszeit = Rüstzeit + Stückzahl · Zeit je Einheit = ' + tr + ' min + ' + m + ' · ' + f(tE, 1) + ' min = ' + f(v * 60, 1) + ' min = ' + f(v, 2) + ' h.', ['Die Rüstzeit fällt nur einmal an.', 'Zum Schluss von Minuten in Stunden umrechnen, durch 60.']);
    },
    plan: R => {
      const c = C(), pl = c.pick(R, PLANS);
      return orderQ(R, 'Du fertigst ' + pl.t + '. Bringe die Arbeitsschritte in eine sinnvolle Reihenfolge (Arbeitsplan).', pl.st.slice(),
        'Erst wird das Rohteil zugeschnitten, dann werden die Bezugskanten bearbeitet und angerissen. Bohren, Gewinde oder Reiben kommen danach, Entgraten vor der Endprüfung. Bei Blech wird vor dem Abkanten im flachen Zustand gebohrt.', ['Ohne Rohteil und Bezugskante kannst du nicht anreißen.', 'Geprüft wird ganz am Ende, entgratet davor.']);
    },
    kosten: R => {
      const c = C(), mat = c.ri(R, 5, 60) / 10, tr = c.pick(R, [30, 45, 60, 90]), m = c.pick(R, [10, 20, 25, 30, 50]), tE = c.ri(R, 30, 120) / 10, satz = c.pick(R, [36, 48, 60, 72]), v = c.kostenStk(mat, tr, m, tE, satz);
      return numQ('Ein Teil verursacht Materialkosten von ' + f(mat, 2) + ' € je Stück. Der Auftrag hat ' + m + ' Stück, die Rüstzeit beträgt ' + tr + ' min, die Zeit je Einheit ' + f(tE, 1) + ' min. Der Stundensatz beträgt ' + satz + ' € je Stunde. Wie hoch sind die Kosten je Stück (Material plus Fertigung, Rüstzeit auf die Stückzahl verteilt)?', v, '€', 'Kosten je Stück', 0.02,
        'Rüstzeit je Stück = ' + tr + ' min / ' + m + ' = ' + f(tr / m, 2) + ' min. Fertigungszeit je Stück = ' + f(tr / m + tE, 2) + ' min = ' + f((tr / m + tE) / 60, 3) + ' h. Fertigungskosten = ' + f((tr / m + tE) / 60, 3) + ' h · ' + satz + ' €/h = ' + f((tr / m + tE) * satz / 60, 2) + ' €. Mit Material: ' + f(v, 2) + ' €.', ['Verteile die Rüstzeit auf die Stückzahl.', 'Rechne die Minuten in Stunden um, bevor du mit dem Stundensatz multiplizierst.']);
    },
    breakeven: R => {
      const c = C(), ms = c.ri(R, 4, 30) * 10, dv = c.pick(R, [0.5, 1, 1.5, 2, 2.5]), kv2 = c.pick(R, [1.5, 2, 2.5, 3]), kv1 = kv2 + dv, kr1 = c.pick(R, [20, 30, 40, 50]), kr2 = kr1 + ms * dv;
      return numQ('Ein Teil kann auf zwei Arten gefertigt werden. Verfahren A: Rüstkosten ' + f(kr1, 0) + ' €, ' + f(kv1, 2) + ' € je Stück. Verfahren B: Rüstkosten ' + f(kr2, 0) + ' €, ' + f(kv2, 2) + ' € je Stück. Bei welcher Stückzahl kosten beide Verfahren insgesamt gleich viel?', ms, 'Stück', 'Stückzahl', 0.5,
        'Gleichsetzen: ' + f(kr1, 0) + ' + m · ' + f(kv1, 2) + ' = ' + f(kr2, 0) + ' + m · ' + f(kv2, 2) + '. Umgestellt: m = (' + f(kr2, 0) + ' − ' + f(kr1, 0) + ') / (' + f(kv1, 2) + ' − ' + f(kv2, 2) + ') = ' + ms + ' Stück. Darüber ist B billiger, darunter A.', ['Stelle für beide Verfahren die Gesamtkosten auf: Rüstkosten plus Stückzahl mal Kosten je Stück.', 'Setze beide gleich und löse nach der Stückzahl auf.']);
    },
    mittel: R => {
      const c = C(), N = c.pick(R, [10, 20, 25, 30, 40]), vals = []; for (let i = 0; i < 5; i++) vals.push(c.rd(N + c.ri(R, -6, 6) / 100, 2));
      const v = c.mean(vals);
      return numQ('Fünf Teile wurden gemessen (Sollmaß ' + N + ' mm): ' + vals.map(x => f(x, 2)).join('; ') + ' mm. Wie groß ist der Mittelwert?', v, 'mm', 'Mittelwert', 0.006,
        'Mittelwert = Summe / Anzahl = ' + f(vals.reduce((a, b) => a + b, 0), 2) + ' mm / 5 = ' + f(v, 3) + ' mm.', ['Addiere alle Werte und teile durch ihre Anzahl.', 'Es sind fünf Werte.']);
    },
    strich: R => {
      const c = C(), N = c.pick(R, [10, 20, 25]), vals = [];
      for (let i = 0; i < 20; i++) vals.push(c.rd(N + Math.max(-4, Math.min(4, Math.round(c.gauss(R) * 1.6))) / 100, 2));
      const cl = c.ri(R, -3, 3), lo = c.rd(N + cl / 100, 2), hi = c.rd(N + (cl + 1) / 100, 2), v = vals.filter(x => Math.abs(x - lo) < 1e-6 || Math.abs(x - hi) < 1e-6).length;
      return numQ('Urliste von 20 Messwerten in mm: ' + vals.map(x => f(x, 2)).join('; ') + '. Du führst eine Strichliste mit Klassen aus je zwei Werten. Wie viele Werte fallen in die Klasse ' + f(lo, 2) + ' bis ' + f(hi, 2) + ' mm (beide Werte eingeschlossen)?', v, 'Werte', 'Anzahl in der Klasse', 0,
        'Gezählt werden alle Werte, die ' + f(lo, 2) + ' oder ' + f(hi, 2) + ' mm betragen: ' + v + ' Werte.', ['Gehe die Urliste Wert für Wert durch.', 'Zähle nur die beiden Werte der genannten Klasse.']);
    },
    sdev: R => {
      const c = C(), N = c.pick(R, [10, 20, 30]), vals = [];
      let tries = 0; do { vals.length = 0; for (let i = 0; i < 5; i++) vals.push(c.rd(N + c.ri(R, -5, 5) / 100, 2)); tries++; } while (c.sdev(vals) < 0.012 && tries < 50);
      const v = c.sdev(vals), m = c.mean(vals);
      return numQ('Fünf Teile messen ' + vals.map(x => f(x, 2)).join('; ') + ' mm. Berechne die Standardabweichung der Stichprobe (Teiler n − 1).', v, 'mm', 'Standardabweichung', 0.002,
        'Mittelwert = ' + f(m, 3) + ' mm. Summe der Abweichungsquadrate = ' + f(vals.reduce((s, x) => s + (x - m) * (x - m), 0), 5) + ' mm². s = √(Summe / (5 − 1)) = ' + f(v, 4) + ' mm.', ['Bestimme erst den Mittelwert, dann die Abweichung jedes Werts.', 'Quadriere die Abweichungen, addiere sie und teile durch n − 1.']);
    },
    anteil: R => {
      const c = C(), n = c.pick(R, [100, 150, 200, 250, 400]), a = c.ri(R, 2, 9), b = c.ri(R, 2, 9), d = c.ri(R, 1, 6), bad = a + b + d, v = bad / n * 100;
      return numQ('Aus einer Lieferung wurden ' + n + ' Teile geprüft. Die Strichliste zeigt: Maßfehler ' + a + ', Grat ' + b + ', Oberflächenfehler ' + d + '. Jedes fehlerhafte Teil hat genau einen dieser Fehler. Wie hoch ist der Anteil fehlerhafter Teile in der Stichprobe?', v, '%', 'Fehleranteil', 0.05,
        'Fehlerhafte Teile = ' + a + ' + ' + b + ' + ' + d + ' = ' + bad + '. Anteil = ' + bad + ' / ' + n + ' · 100 % = ' + f(v, 2) + ' %.', ['Zähle zuerst alle fehlerhaften Teile zusammen.', 'Teile durch die Zahl der geprüften Teile.']);
    },
    prueff: pq(PQ),
    cp: R => {
      const c = C(), N = c.pick(R, [10, 20, 25, 30]), T = c.pick(R, [0.1, 0.15, 0.2]), sg = c.pick(R, [0.01, 0.015, 0.02, 0.025, 0.03]), v = c.cp(N - T, N + T, sg);
      return numQ('Ein Maß ist mit ' + N + ' mm ± ' + f(T, 2) + ' mm toleriert (untere Grenze ' + f(N - T, 2) + ' mm, obere Grenze ' + f(N + T, 2) + ' mm). Der Prozess streut mit der Standardabweichung σ = ' + f(sg, 3) + ' mm. Wie groß ist der Fähigkeitsindex Cp = Toleranzbreite / (6 · σ)?', v, '', 'Cp', 0.02,
        'Toleranzbreite = ' + f(2 * T, 2) + ' mm, 6 · σ = ' + f(6 * sg, 3) + ' mm. Cp = ' + f(2 * T, 2) + ' / ' + f(6 * sg, 3) + ' = ' + f(v, 2) + '. Ab etwa 1,33 gilt ein Prozess als fähig (Richtwert).', ['Toleranzbreite ist obere minus untere Grenze.', 'Im Nenner steht das Sechsfache der Standardabweichung.'], { k: 'glocke', mu: N, sigma: sg, ugw: N - T, ogw: N + T, vals: false });
    },
    cpk: R => {
      const c = C(), N = c.pick(R, [10, 20, 25, 30]), T = c.pick(R, [0.1, 0.15, 0.2]), sg = c.pick(R, [0.01, 0.015, 0.02, 0.025]), off = c.pick(R, [-1, 1]) * c.pick(R, [0.02, 0.03, 0.04, 0.05]), mu = c.rd(N + off, 3), v = c.cpk(N - T, N + T, mu, sg);
      return numQ('Ein Maß ist mit ' + N + ' mm ± ' + f(T, 2) + ' mm toleriert. Der Prozess hat den Mittelwert μ = ' + f(mu, 3) + ' mm und die Standardabweichung σ = ' + f(sg, 3) + ' mm. Wie groß ist Cpk = Abstand des Mittelwerts zur näheren Toleranzgrenze / (3 · σ)?', v, '', 'Cpk', 0.02,
        'Abstand zur oberen Grenze: ' + f(N + T - mu, 3) + ' mm, zur unteren: ' + f(mu - (N - T), 3) + ' mm. Der kleinere Abstand ist ' + f(Math.min(N + T - mu, mu - (N - T)), 3) + ' mm. Cpk = ' + f(Math.min(N + T - mu, mu - (N - T)), 3) + ' / (3 · ' + f(sg, 3) + ') = ' + f(v, 2) + '.', ['Bestimme den Abstand des Mittelwerts zu beiden Grenzen.', 'Nimm den kleineren Abstand und teile ihn durch 3 · σ.'], { k: 'glocke', mu, sigma: sg, ugw: N - T, ogw: N + T, vals: false });
    },
    regelkarte: R => {
      const c = C(), kinds = ['ok', 'aus', 'trend', 'lage'], kind = c.pick(R, kinds), s = seriesFor(R, kind);
      return choiceQ(R, 'Die Karte zeigt die Messwerte eines Prozesses in der Reihenfolge der Fertigung (Mittellinie, Warngrenzen bei ±2σ, Eingriffsgrenzen bei ±3σ). ' + RULES_TXT + ' Wie beurteilst du die Karte?', KARTE[kind], kinds.filter(x => x !== kind).map(x => KARTE[x]),
        'Nach den Regeln gilt: ' + KARTE[kind] + '. ' + (kind === 'ok' ? 'Kein Punkt liegt außerhalb der Eingriffsgrenzen, es gibt keine sieben steigenden oder fallenden und keine sieben einseitigen Punkte in Folge.' : kind === 'aus' ? 'Ein Punkt liegt klar jenseits einer Eingriffsgrenze.' : kind === 'trend' ? 'Mindestens sieben Punkte in Folge steigen (oder fallen).' : 'Mindestens sieben Punkte in Folge liegen auf derselben Seite der Mittellinie.'),
        ['Gehe die Regeln der Reihe nach durch: außerhalb, Trend, einseitig.', 'Zähle in Folge liegende Punkte, die steigen oder auf einer Seite der Mittellinie liegen.'], { k: 'regel', s, lim: c.limits(0, 1, 1) });
    },
    fg: R => {
      const c = C(), v = c.ri(R, 0, 3);
      const T = [
        ['Wie viele Freiheitsgrade hat ein frei beweglicher Körper im Raum (Verschiebungen plus Drehungen)?', 6, 'Er kann in drei Richtungen verschoben (x, y, z) und um drei Achsen gedreht werden: 3 + 3 = 6.', ['Zähle Verschieben und Drehen getrennt.', 'Es gibt drei Achsen.']],
        ['Drei Punkte der Hauptauflage drücken von unten gegen ein Werkstück. Wie viele Freiheitsgrade sperren sie zusammen?', 3, 'Die Hauptauflage sperrt eine Verschiebung (nach unten) und zwei Drehungen (Kippen um die beiden waagerechten Achsen): 3 Freiheitsgrade.', ['Drei Punkte legen eine Ebene fest.', 'Eine Ebene sperrt Verschiebung und zwei Kippbewegungen.']],
        ['Zwei Punkte der Führungsfläche liegen seitlich am Werkstück an. Wie viele Freiheitsgrade sperren sie zusätzlich?', 2, 'Die Führungsfläche sperrt eine Verschiebung quer zur Fläche und eine Drehung um die Hochachse: 2 Freiheitsgrade.', ['Zwei Punkte legen eine Linie fest.', 'Eine Verschiebung und eine Drehung.']],
        ['Ein Punkt des Anschlags liegt an der Stirnseite des Werkstücks an. Wie viele Freiheitsgrade sperrt er zusätzlich?', 1, 'Ein einzelner Punkt sperrt eine einzige Verschiebung, nämlich die in Richtung des Anschlags.', ['Ein Punkt sperrt eine Bewegungsrichtung.', 'Er kann keine Drehung sperren.']]
      ][v];
      return numQ(T[0], T[1], '', 'Anzahl Freiheitsgrade', 0, T[2], T[3], { k: 'block', cnt: null, vals: false });
    },
    dreizwei: R => {
      const c = C(); let a, b, cc, d, tries = 0;
      do { a = c.ri(R, 0, 3); b = c.ri(R, 0, 2); cc = c.ri(R, 0, 1); d = c.dof(a, b, cc); tries++; } while ((d.nFree === 0 || d.nFree === 6) && tries < 50);
      const pt = (n, s, p) => n + ' ' + (n === 1 ? s : p);
      return numQ('Ein Werkstück liegt auf ' + pt(a, 'Punkt', 'Punkten') + ' der Hauptauflage, ' + (b === 0 ? 'berührt keinen Punkt der Führungsfläche' : 'liegt an ' + pt(b, 'Punkt', 'Punkten') + ' der Führungsfläche an') + ' und ' + (cc === 0 ? 'hat keinen Punkt am Anschlag' : 'stößt an ' + pt(cc, 'Punkt', 'Punkten') + ' des Anschlags') + '. Alle Punkte sind richtig gesetzt. Wie viele Freiheitsgrade bleiben dem Werkstück?', d.nFree, '', 'Verbleibende Freiheitsgrade', 0,
        'Gesperrt: Hauptauflage ' + a + ' (von 3), Führungsfläche ' + b + ' (von 2), Anschlag ' + cc + ' (von 1) = ' + d.nLocked + ' Freiheitsgrade. Es bleiben 6 − ' + d.nLocked + ' = ' + d.nFree + '.', ['Jeder richtig gesetzte Punkt sperrt einen Freiheitsgrad.', 'Ziehe die gesperrten von 6 ab.'], { k: 'block', cnt: null, vals: false });
    },
    spannen: pq(SPQ),
    /* PRUEFEN P18: Fehlerbild A (Kernloch passt nicht zum Gewinde): Die Beschreibung der Folgen (zu kleines Kernloch: Gewindebohrer bricht, zu großes Kernloch: Gewinde zu flach, hält nicht) ist vereinfacht. Fehlen häufige Ursachen (stumpfer Bohrer, kein Schmiermittel, schief angesetzt)? */
    fsa: R => {
      const c = C(), ds = c.shuffle(R, [4, 5, 6, 8, 10, 12, 16]).slice(0, 4), bad = c.ri(R, 0, 3), small = R() < 0.5;
      const rows = ds.map((d, i) => { const th = c.thread(d); let b = th.kern; if (i === bad) b = c.rd(small ? th.kern - c.pick(R, [0.6, 0.8, 1]) : th.kern + c.pick(R, [0.6, 0.8, 1]), 1); return { d, P: th.P, b, n: 'M' + d }; });
      const q = choiceQ(R, 'Du schneidest Innengewinde von Hand in vier Platten (Regelgewinde). Gebohrt wurde das Kernloch:\n' + rows.map(r => 'Gewinde M' + r.d + ' (P = ' + f(r.P, 2) + ' mm): Kernloch Ø ' + f(r.b, 1) + ' mm').join('\n') + '\nBei einer Platte lässt sich der Gewindebohrer kaum drehen oder das Gewinde wird zu flach. Bei welchem Gewinde stimmt das Kernloch nicht?',
        rows[bad].n, rows.filter((_, i) => i !== bad).map(r => r.n),
        rows[bad].n + ': Das Kernloch von ' + f(rows[bad].b, 1) + ' mm passt nicht (Tabelle: ' + f(c.kernloch(rows[bad].d), 1) + ' mm). ' + (small ? 'Ein zu kleines Kernloch lässt den Gewindebohrer klemmen, er kann abbrechen.' : 'Ein zu großes Kernloch lässt zu wenig Werkstoff für die Gewindeflanken: Das Gewinde wird flach und hält nicht.') + ' Bei den anderen Gewinden passen Kernloch und Nenndurchmesser (Richtwert d − P).',
        ['Rechne bei jedem Gewinde Nenndurchmesser minus Steigung.', 'Vergleiche das Ergebnis mit dem gebohrten Kernloch.'], { k: 'gewinde', d: rows[bad].d, vals: false, generic: true });
      q.meta = { rows, bad, small }; q.viz = null; return q;
    },
    /* PRUEFEN P19: Fehlerbild B (Vorrichtung): Die Folgen (Wackeln bei vier Punkten, Drehung bei einem Punkt an der Führungsfläche, Rutschen ohne Anschlag, Kippen bei nur zwei Punkten) sind vereinfacht dargestellt. */
    fsb: R => {
      const c = C(), V = [
        [[4, 2, 1], 'Das Werkstück wackelt auf der Auflage und lässt sich nicht sauber spannen.', 'Die Hauptauflage ist überbestimmt, weil sie vier Punkte hat'],
        [[3, 1, 1], 'Beim Anlegen dreht sich das Werkstück leicht um die Hochachse.', 'Die Führungsfläche hat zu wenig Punkte, eine Drehung bleibt frei'],
        [[3, 2, 0], 'Das Werkstück rutscht beim Bearbeiten in Längsrichtung.', 'Der Anschlag fehlt, das Teil kann in Längsrichtung rutschen'],
        [[2, 2, 1], 'Das Werkstück kippt zu einer Seite weg.', 'Die Hauptauflage hat zu wenig Punkte, das Teil kann kippen']
      ], i = c.ri(R, 0, 3), v = V[i];
      const q = choiceQ(R, 'Eine Vorrichtung bestimmt die Lage eines Quaders mit diesen Punkten: Hauptauflage ' + v[0][0] + ' Punkte, Führungsfläche ' + v[0][1] + ' Punkte, Anschlag ' + v[0][2] + ' Punkt(e). Beobachtung: ' + v[1] + ' Welche Ursache liegt vor?', v[2], V.filter((_, j) => j !== i).map(x => x[2]),
        'Soll sind 3 Punkte an der Hauptauflage, 2 an der Führungsfläche und 1 am Anschlag. Hier gilt: ' + v[2] + '.', ['Vergleiche die Punktzahlen mit 3-2-1.', 'Welche Fläche weicht ab?'], { k: 'block', cnt: null, vals: false });
      q.meta = { cnt: v[0], i }; return q;
    },
    /* PRUEFEN P20: Fehlerbild C (Prozessfähigkeit): Die Handlungsempfehlungen (Lage nachstellen, Streuung verringern, nichts ändern) sind vereinfacht, die Grenze 1,33 ist der übliche Richtwert. */
    fsc: R => {
      const c = C(); let kind, N, T, sg, mu, cpv, cpkv, tries = 0;
      do {
        kind = c.pick(R, ['lage', 'streu', 'gut']); N = c.pick(R, [10, 20, 25, 30]); T = c.pick(R, [0.1, 0.15, 0.2]);
        const cpt = kind === 'streu' ? c.pick(R, [0.7, 0.8, 0.9]) : c.pick(R, [1.6, 1.8, 2]); sg = c.rd(2 * T / (6 * cpt), 3);
        const off = kind === 'lage' ? (c.pick(R, [1.2, 1.4, 1.5])) * 3 * sg * (R() < 0.5 ? -1 : 1) : (R() - 0.5) * 0.4 * sg; mu = c.rd(N + off, 3);
        cpv = c.rd(c.cp(N - T, N + T, sg), 2); cpkv = c.rd(c.cpk(N - T, N + T, mu, sg), 2); tries++;
      } while (!((kind === 'lage' && cpv >= 1.33 && cpkv < 1 && cpkv > 0) || (kind === 'streu' && cpv < 1 && cpkv < 1) || (kind === 'gut' && cpkv >= 1.33)) && tries < 300);
      const A = { lage: 'Die Lage nachstellen, der Mittelwert sitzt zu nah an einer Grenze', streu: 'Die Streuung verringern, zum Beispiel Spiel und Verschleiß prüfen', gut: 'Nichts ändern, der Prozess ist fähig und liegt mittig', tol: 'Die Toleranz vergrößern, dann passt der Prozess wieder' };
      const q = choiceQ(R, 'Ein Maß ist mit ' + N + ' mm ± ' + f(T, 2) + ' mm toleriert. Eine Prozessuntersuchung ergibt: Mittelwert μ = ' + f(mu, 3) + ' mm, Standardabweichung σ = ' + f(sg, 3) + ' mm, Cp = ' + f(cpv, 2) + ', Cpk = ' + f(cpkv, 2) + '. Als fähig gilt ein Prozess ab 1,33. Welche Maßnahme ist sinnvoll?', A[kind], ['lage', 'streu', 'gut', 'tol'].filter(x => x !== kind).map(x => A[x]),
        kind === 'lage' ? 'Cp ist gut (' + f(cpv, 2) + '), aber Cpk ist deutlich kleiner (' + f(cpkv, 2) + '): Die Streuung passt in die Toleranz, der Mittelwert sitzt aber nicht mittig. Man stellt die Lage nach (Anschlag, Nullpunkt, Werkzeugkorrektur).' : kind === 'streu' ? 'Schon Cp ist kleiner als 1 (' + f(cpv, 2) + '): Die Streubreite ist größer als die Toleranz. Nachstellen hilft nicht, die Streuung selbst muss kleiner werden.' : 'Cp und Cpk liegen über 1,33 und nahe beieinander: Der Prozess streut wenig und liegt mittig.',
        ['Vergleiche Cp und Cpk miteinander und mit 1,33.', 'Ein großer Unterschied zwischen Cp und Cpk deutet auf die Lage hin, ein kleines Cp auf die Streuung.'], { k: 'glocke', mu, sigma: sg, ugw: N - T, ogw: N + T, vals: false });
      q.meta = { kind, N, T, sg, mu, cp: cpv, cpk: cpkv }; q.viz = null; return q;
    },
    /* Werkbank-Praxis (Grundausbildung, v63.187). PRUEFEN: Faustregel Bolzen = d − 0,1 · P steht als Übungsregel im Aufgabentext. */
    bolzen: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12, 16]), P = c.thread(d).P, v = c.rd(d - 0.1 * P, 3);
      return numQ('Auf einen Bolzen soll von Hand ein Außengewinde M' + d + ' geschnitten werden (Steigung P = ' + f(P, 2) + ' mm). Faustregel für die Übung: Der Bolzen ist um ein Zehntel der Steigung dünner als der Nenndurchmesser. Welchen Durchmesser bekommt der Bolzen?', v, 'mm', 'Bolzendurchmesser', 0.01,
        'Bolzendurchmesser = d − 0,1 · P = ' + d + ' mm − 0,1 · ' + f(P, 2) + ' mm = ' + f(v, 3) + ' mm. Beim Schneiden wird der Werkstoff etwas nach außen gedrückt. Darum ist der Bolzen vorher ein wenig dünner als das fertige Gewinde.', ['Rechne zuerst ein Zehntel der Steigung aus.', 'Ziehe diesen kleinen Wert vom Nenndurchmesser ab.']);
    },
    agw: (R, arg) => pq(AGQ)(R, arg),
    agwfolge: R => orderQ(R, 'Auf einen Bolzen wird von Hand ein Außengewinde geschnitten. Bringe die Schritte in die richtige Reihenfolge.', AGSTEP.slice(),
      'Zuerst wird der Bolzen fest gespannt. Dann bekommt das Ende eine Fase, damit das Schneideisen gerade anfasst. Beim Schneiden drehst du immer wieder zurück, damit die Späne brechen. Geprüft wird zum Schluss.', ['Ohne Fase lässt sich das Schneideisen schlecht ansetzen.', 'Geprüft wird erst, wenn das Gewinde fertig ist.']),
    lochreihe: R => {
      const c = C(), r = c.pick(R, [10, 12, 15, 20]), t = c.pick(R, [18, 20, 25, 30, 35]), k = c.pick(R, [4, 5, 6]), v = c.lochLage(r, t, k);
      return numQ('Auf einem Flachstahl reißt du ' + k + ' Bohrungen in einer Reihe an. Die Mitte der ersten Bohrung liegt ' + r + ' mm von der Bezugskante entfernt. Der Abstand von Bohrung zu Bohrung beträgt ' + t + ' mm. Wie weit liegt die Mitte der letzten Bohrung von der Bezugskante entfernt?', v, 'mm', 'Maß bis zur letzten Bohrung', 0.01,
        'Zwischen ' + k + ' Bohrungen liegen nur ' + (k - 1) + ' Abstände. Maß = ' + r + ' mm + ' + (k - 1) + ' · ' + t + ' mm = ' + f(v, 1) + ' mm. Alle Maße trägst du von derselben Bezugskante ab. So addieren sich kleine Fehler nicht.', ['Zähle die Abstände zwischen den Bohrungen, nicht die Bohrungen selbst.', 'Vergiss das Maß bis zur ersten Bohrung nicht.']);
    },
    mittig: R => {
      const c = C(), B = c.pick(R, [60, 70, 80, 100, 120]), a = c.pick(R, [20, 30, 40]), v = (B - a) / 2;
      return numQ('Eine Platte ist ' + B + ' mm breit. Zwei Bohrungen sollen ' + a + ' mm Abstand voneinander haben. Beide zusammen sollen genau mittig auf der Breite sitzen. Wie weit liegt die Mitte der ersten Bohrung von der Bezugskante entfernt?', v, 'mm', 'Maß bis zur ersten Bohrung', 0.01,
        'Neben den beiden Bohrungen bleiben zusammen ' + B + ' mm − ' + a + ' mm = ' + (B - a) + ' mm. Dieser Rest verteilt sich gleich auf beide Seiten: ' + (B - a) + ' mm / 2 = ' + f(v, 1) + ' mm. Die zweite Bohrung liegt dann bei ' + f(v + a, 1) + ' mm.', ['Ziehe zuerst den Abstand der Bohrungen von der Breite ab.', 'Der Rest ist links und rechts gleich groß.']);
    },
    teilwinkel: R => {
      const c = C(), n = c.pick(R, [3, 4, 5, 6, 8, 10, 12]), D = c.pick(R, [60, 80, 100, 120]), v = 360 / n;
      return numQ('Auf einem Lochkreis mit ' + D + ' mm Durchmesser sollen ' + n + ' Bohrungen gleichmäßig verteilt werden. Wie groß ist der Winkel von einer Bohrung zur nächsten?', v, '°', 'Teilungswinkel', 0.01,
        'Ein voller Kreis hat 360°. Teilungswinkel = 360° / ' + n + ' = ' + f(v, 1) + '°. Der Durchmesser des Lochkreises spielt für den Winkel keine Rolle.', ['Ein voller Kreis hat 360°.', 'Teile den vollen Kreis durch die Zahl der Bohrungen.']);
    },
    sehne: R => {
      const c = C(), n = c.pick(R, [3, 5, 6, 8, 10]), D = c.pick(R, [60, 80, 100, 120]), sn = c.rd(Math.sin(Math.PI / n), 4), v = c.rd(D * sn, 3);
      return numQ('Auf einem Lochkreis mit D = ' + D + ' mm liegen ' + n + ' Bohrungen gleichmäßig verteilt. Zum Anreißen mit dem Zirkel brauchst du den geraden Abstand s von Bohrungsmitte zu Bohrungsmitte (Sehne). Es gilt: s = D · sin(180° / n). Für ' + n + ' Bohrungen ist sin(' + f(180 / n, 1) + '°) = ' + f(sn, 4) + '. Wie groß ist s?', v, 'mm', 'Sehne s', 0.05,
        's = D · sin(180° / n) = ' + D + ' mm · ' + f(sn, 4) + ' = ' + f(v, 2) + ' mm. Diesen Abstand stellst du am Zirkel ein und trägst ihn auf dem Lochkreis von Körnerpunkt zu Körnerpunkt ab.', ['Der Sinuswert steht schon fertig im Text.', 'Multipliziere den Durchmesser des Lochkreises mit dem Sinuswert.']);
    },
    entgrat: (R, arg) => pq(EGQ)(R, arg),
    senktiefe: R => {
      const c = C(), p = c.pick(R, [[4.5, 8.6], [5.5, 10.4], [6.6, 12.4], [9, 16.4]]), d = p[0], D = p[1], v = c.rd((D - d) / 2, 3);
      return numQ('Eine Bohrung Ø' + f(d, 1) + ' mm wird mit dem Kegelsenker (Senkwinkel 90°) angesenkt, bis die Senkung oben Ø' + f(D, 1) + ' mm hat. Wie tief ist die Senkung, gemessen von der Oberfläche bis zum Beginn der zylindrischen Bohrung?', v, 'mm', 'Senktiefe', 0.01,
        'Bei 90° Senkwinkel steht die Kegelfläche unter 45° zur Achse. Darum ist die Senkung genauso tief, wie sie auf jeder Seite breiter ist als die Bohrung: t = (D − d) / 2 = (' + f(D, 1) + ' mm − ' + f(d, 1) + ' mm) / 2 = ' + f(v, 2) + ' mm.', ['Bei 90° Senkwinkel steht die Kegelfläche unter 45° zur Achse.', 'Die Tiefe ist so groß wie der halbe Unterschied der beiden Durchmesser.']);
    },
    hwzustand: (R, arg) => pq(HZQ)(R, arg),
    /* Einsatzgebiet Produktionstechnik (Vertiefung 3. und 4. Lehrjahr, v63.187). Alle Zahlen sind Übungswerte, die im Aufgabentext stehen. */
    pvbauteile: R => {
      const c = C(), rows = c.shuffle(R, VBROW).slice(0, 4);
      return matchQ(R, 'Eine Bohrvorrichtung besteht aus mehreren Bauteilen. Ordne jedem Bauteil seine Aufgabe zu.', rows.map(r => r[0]), VBOPT, rows.map(r => r[1]),
        rows.map(r => r[0] + ' → ' + VBOPT[r[1]]).join('; ') + '. Auflagen und Anschläge bestimmen die Lage. Spanner halten das Teil nur fest, sie bestimmen nichts.', ['Bestimmen und Spannen sind zwei verschiedene Aufgaben.', 'Frage dich bei jedem Bauteil: Legt es die Lage fest, hält es fest oder führt es das Werkzeug?']);
    },
    pvzwang: (R, arg) => pq(BZQ)(R, arg),
    pvaufnahme: (R, arg) => pq(AFQ)(R, arg),
    /* PRUEFEN: Spannkraft = Sicherheit · Schnittkraft / Reibwert, vereinfacht nur mit der Reibung an der Auflage. Reibwert und Sicherheit sind Übungswerte im Text. */
    pvspannkraft: R => {
      const c = C(), Fc = c.pick(R, [300, 450, 600, 750, 900]), mu = c.pick(R, [0.15, 0.2]), S = c.pick(R, [1.5, 2]), v = c.rd(S * Fc / mu, 3);
      return numQ('Beim Fräsen wirkt auf ein Werkstück eine Schnittkraft von ' + Fc + ' N. Sie will das Teil auf der Auflage verschieben. Ein Spanner drückt das Teil senkrecht auf die Auflage. Rechne vereinfacht nur mit der Reibung an der Auflage. Übungswerte: Reibwert μ = ' + f(mu, 2) + '. Die Reibkraft soll ' + f(S, 1) + ' mal so groß sein wie die Schnittkraft (Sicherheit). Wie groß muss die Spannkraft mindestens sein?', v, 'N', 'Spannkraft', 1,
        'Reibkraft = μ · Spannkraft. Sie soll ' + f(S, 1) + ' mal so groß sein wie die Schnittkraft: ' + f(S, 1) + ' · ' + Fc + ' N = ' + f(S * Fc, 0) + ' N. Spannkraft = ' + f(S * Fc, 0) + ' N / ' + f(mu, 2) + ' = ' + f(v, 0) + ' N. Besser ist es, die Schnittkraft auf einen festen Anschlag zu leiten. Dann muss die Reibung sie nicht allein halten.', ['Die Reibkraft ist Reibwert mal Spannkraft.', 'Rechne zuerst Sicherheit mal Schnittkraft und teile dann durch den Reibwert.']);
    },
    pvknie: (R, arg) => pq(KHQ)(R, arg),
    pvbuchse: (R, arg) => pq(BBQ)(R, arg),
    pvspaene: (R, arg) => pq(SRQ)(R, arg),
    pvpoka: (R, arg) => pq(PYQ)(R, arg),
    pvplan: R => orderQ(R, 'Du baust eine einfache Bohrvorrichtung mit Grundplatte. Bringe die Arbeitsgänge in eine sinnvolle Reihenfolge.', VPSTEP.slice(),
      'Erst Unterlagen und Material, dann die Grundplatte mit ihren Bezugsflächen. Von dort aus entstehen die Bohrungen. Vor der Montage wird entgratet und gereinigt, damit alle Teile sauber anliegen. Am Schluss zeigt ein Probeteil, ob die Vorrichtung arbeitet.', ['Von den Bezugsflächen gehen alle weiteren Maße aus.', 'Montiert wird erst, wenn alle Einzelteile fertig und sauber sind.']),
    pvlos: R => {
      const c = C(), tr = c.pick(R, [30, 45, 60, 90]), p = c.pick(R, [[10, 25], [10, 50], [20, 50], [20, 100], [25, 100]]), a = tr / p[0], b = tr / p[1], v = c.rd(a - b, 3);
      return numQ('Ein Teil wird in Losen gefertigt. Für jedes Los wird einmal gerüstet, die Rüstzeit beträgt ' + tr + ' min. Bisher umfasst ein Los ' + p[0] + ' Stück. Künftig sollen es ' + p[1] + ' Stück sein. Um wie viele Minuten sinkt der Rüstanteil je Stück?', v, 'min', 'Rüstanteil sinkt um', 0.01,
        'Rüstanteil je Stück = Rüstzeit / Losgröße. Bisher: ' + tr + ' min / ' + p[0] + ' = ' + f(a, 2) + ' min. Künftig: ' + tr + ' min / ' + p[1] + ' = ' + f(b, 2) + ' min. Unterschied: ' + f(a, 2) + ' min − ' + f(b, 2) + ' min = ' + f(v, 2) + ' min je Stück. Größere Lose senken den Rüstanteil. Dafür liegt mehr Material länger im Lager.', ['Die Rüstzeit fällt je Los nur einmal an und verteilt sich auf alle Stücke.', 'Rechne den Rüstanteil für beide Losgrößen und bilde den Unterschied.']);
    },
    pvtakt: R => {
      const c = C(), p = c.pick(R, [30, 45, 60]), tk = c.pick(R, [30, 36, 45, 50, 60, 75, 90]), netto = 480 - p, n = netto * 60 / tk;
      return numQ('An einem Montageplatz dauert die Schicht 480 min. Davon gehen ' + p + ' min für Pausen ab. In dieser Schicht müssen ' + n + ' Baugruppen fertig werden. Wie groß ist die Taktzeit in Sekunden je Stück?', tk, 's', 'Taktzeit', 0.05,
        'Verfügbare Zeit = 480 min − ' + p + ' min = ' + netto + ' min = ' + f(netto * 60, 0) + ' s. Taktzeit = verfügbare Zeit / Stückzahl = ' + f(netto * 60, 0) + ' s / ' + n + ' = ' + f(tk, 1) + ' s je Stück. Dauert die Arbeit je Stück länger als der Takt, wird die Stückzahl nicht erreicht.', ['Ziehe zuerst die Pausen von der Schichtdauer ab.', 'Rechne die Minuten in Sekunden um und teile durch die Stückzahl.']);
    },
    pvengpass: R => {
      const c = C(), mx = c.pick(R, [80, 100]), an = c.shuffle(R, [40, 48, 50, 60, 64, 72]).slice(0, 2), t = c.shuffle(R, [mx, an[0], an[1]]), nm = ['Bohren', 'Entgraten', 'Prüfen'], j = t.indexOf(an[0]), v = c.rd(an[0] / mx * 100, 1);
      return numQ('Drei Arbeitsplätze sind verkettet. Jedes Teil läuft nacheinander über alle drei Plätze. Die Kette läuft im Takt des langsamsten Platzes. Zeit je Stück: ' + nm.map((x, i) => x + ' ' + t[i] + ' s').join(', ') + '. Wie hoch ist die Auslastung des Platzes ' + nm[j] + '?', v, '%', 'Auslastung', 0.05,
        'Der langsamste Platz ist der Engpass mit ' + mx + ' s je Stück. Er gibt den Takt vor. ' + nm[j] + ' braucht ' + an[0] + ' s und wartet die restliche Zeit des Takts. Auslastung = ' + an[0] + ' s / ' + mx + ' s · 100 % = ' + f(v, 1) + ' %. Nur der Engpass ist zu 100 % ausgelastet.', ['Der langsamste Platz bestimmt den Takt der ganzen Kette.', 'Teile die Zeit des Platzes durch die Zeit des Engpasses und rechne in Prozent um.']);
    },
    pvlohnt: R => {
      const c = C(), dt = c.pick(R, [2, 3, 4, 5]), t2 = c.pick(R, [3, 4, 6]), S = c.pick(R, [48, 60, 72]), m = c.ri(R, 2, 10) * 50, e = c.rd(dt * S / 60, 2), K = c.rd(e * m, 2);
      return numQ('Ohne Vorrichtung dauert ein Arbeitsgang ' + (t2 + dt) + ' min je Stück. Mit einer Vorrichtung sind es ' + t2 + ' min je Stück. Der Stundensatz beträgt ' + S + ' € je Stunde. Bau und Material der Vorrichtung kosten einmalig ' + f(K, 0) + ' €. Ab welcher Stückzahl hat die Vorrichtung ihre Kosten eingespielt?', m, 'Stück', 'Stückzahl', 0.5,
        'Zeitersparnis je Stück = ' + (t2 + dt) + ' min − ' + t2 + ' min = ' + dt + ' min. In Geld: ' + dt + ' min / 60 · ' + S + ' €/h = ' + f(e, 2) + ' € je Stück. Stückzahl = ' + f(K, 0) + ' € / ' + f(e, 2) + ' € = ' + m + ' Stück. Jedes weitere Stück spart danach ' + f(e, 2) + ' €.', ['Rechne zuerst aus, wie viel Geld die Vorrichtung je Stück spart.', 'Teile die einmaligen Kosten durch die Ersparnis je Stück.']);
    },
    pverstteil: (R, arg) => pq(ETQ)(R, arg),
    /* PRUEFEN: Faustregel "Skalenteilungswert höchstens ein Zehntel der Toleranz" steht als Übungsregel im Aufgabentext, ebenso die Skalenteilungswerte der vier Prüfmittel. */
    pvpruefmittel: R => {
      const c = C(), i = c.ri(R, 0, 3), pm = PMNAME[i], T = c.rd(pm[2] * 10, 3), N = c.pick(R, i === 0 ? [400, 600, 800] : [20, 40, 60, 80]);
      return choiceQ(R, 'Ein Maß von ' + N + ' mm hat eine Toleranz von ' + f(T, 2) + ' mm (Abstand zwischen Höchstmaß und Mindestmaß). Regel für die Übung: Der Skalenteilungswert des Prüfmittels darf höchstens ein Zehntel der Toleranz betragen. Zur Wahl stehen: ' + PMNAME.map(x => x[0] + ' (' + f(x[2], 3) + ' mm)').join(', ') + '. Du nimmst das gröbste und damit einfachste Prüfmittel, das die Regel erfüllt. Womit prüfst du?', pm[1], PMNAME.filter((_, j) => j !== i).map(x => x[1]),
        'Ein Zehntel der Toleranz: ' + f(T, 2) + ' mm / 10 = ' + f(pm[2], 3) + ' mm. Diesen Skalenteilungswert hat ' + (i === 2 ? 'die ' : 'der ') + pm[0] + '. ' + (i > 0 ? 'Gröbere Prüfmittel lösen zu ungenau auf. ' : '') + (i < 3 ? 'Feinere Prüfmittel würden auch gehen, sind aber teurer und empfindlicher.' : 'Ein gröberes Prüfmittel darfst du hier nicht nehmen.'), ['Rechne zuerst ein Zehntel der Toleranz aus.', 'Vergleiche diesen Wert mit den Skalenteilungswerten in der Klammer.']);
    },
    pvspannweite: R => {
      const c = C(), N = c.pick(R, [12, 20, 25, 40]); let k;
      do { k = []; for (let i = 0; i < 5; i++) k.push(c.ri(R, -6, 6)); } while (Math.max.apply(null, k) - Math.min.apply(null, k) < 3);
      const vals = k.map(x => c.rd(N + x / 100, 2)), hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals), v = c.rd((Math.max.apply(null, k) - Math.min.apply(null, k)) / 100, 2);
      return numQ('Am Prüfplatz misst du fünf Teile aus der laufenden Serie (Sollmaß ' + N + ' mm): ' + vals.map(x => x.toFixed(2).replace('.', ',')).join('; ') + ' mm. Wie groß ist die Spannweite dieser Messreihe?', v, 'mm', 'Spannweite', 0.001,
        'Spannweite = größter Wert − kleinster Wert = ' + f(hi, 2) + ' mm − ' + f(lo, 2) + ' mm = ' + f(v, 2) + ' mm. Die Spannweite zeigt, wie stark die Teile streuen. Der Mittelwert zeigt dagegen die Lage.', ['Suche den größten und den kleinsten Wert der Reihe.', 'Ziehe den kleinsten Wert vom größten ab.']);
    },
    pvlage: R => {
      const c = C(), N = c.pick(R, [15, 20, 30, 50]), g = c.pick(R, [[-10, 10], [-5, 15], [0, 20], [-20, 0], [-15, 5]]), mid = (g[0] + g[1]) / 2; let k, sum;
      do { k = []; for (let i = 0; i < 5; i++) k.push(c.ri(R, -3, 6)); sum = k.reduce((a, b) => a + b, 0); } while (sum < 2);
      const vals = k.map(x => c.rd(N + (mid + x) / 100, 2)), lo = c.rd(N + g[0] / 100, 2), hi = c.rd(N + g[1] / 100, 2), M = c.rd(N + mid / 100, 2), mw = c.rd(N + mid / 100 + sum / 500, 3), v = c.rd(sum / 500, 3);
      return numQ('Ein Maß darf zwischen ' + lo.toFixed(2).replace('.', ',') + ' mm und ' + hi.toFixed(2).replace('.', ',') + ' mm liegen. Fünf Teile aus der Serie messen: ' + vals.map(x => x.toFixed(2).replace('.', ',')).join('; ') + ' mm. Um wie viele Millimeter liegt der Mittelwert über der Toleranzmitte? Gib drei Stellen nach dem Komma an.', v, 'mm', 'Abstand zur Toleranzmitte', 0.0006,
        'Toleranzmitte = (' + f(lo, 2) + ' mm + ' + f(hi, 2) + ' mm) / 2 = ' + f(M, 2) + ' mm. Mittelwert = ' + f(vals.reduce((a, b) => a + b, 0), 2) + ' mm / 5 = ' + f(mw, 3) + ' mm. Abstand = ' + f(mw, 3) + ' mm − ' + f(M, 2) + ' mm = ' + f(v, 3) + ' mm. Liegt der Mittelwert nah an der Mitte, bleibt nach beiden Seiten Luft für die Streuung.', ['Die Toleranzmitte liegt genau zwischen Mindestmaß und Höchstmaß.', 'Addiere die fünf Werte und teile durch fünf.']);
    },
    pvausschuss: R => {
      const c = C(), n = c.pick(R, [200, 250, 400, 500]), b = c.ri(R, 2, 12); let a; do { a = c.ri(R, 3, 15); } while (a === b);
      const v = c.rd(b / n * 100, 3);
      return numQ('In einer Schicht wurden ' + n + ' Teile gefertigt. Bei der Prüfung fallen ' + a + ' Teile auf, die sich nacharbeiten lassen und danach gut sind. Weitere ' + b + ' Teile sind nicht mehr zu retten. Wie hoch ist die Ausschussquote dieser Schicht?', v, '%', 'Ausschussquote', 0.01,
        'Zum Ausschuss zählen nur die ' + b + ' Teile, die nicht mehr zu retten sind. Ausschussquote = ' + b + ' / ' + n + ' · 100 % = ' + f(v, 2) + ' %. Die ' + a + ' nachgearbeiteten Teile werden gut. Sie kosten aber zusätzliche Zeit.', ['Überlege, welche Teile am Ende wirklich verloren sind.', 'Teile diese Zahl durch die gefertigte Stückzahl und rechne in Prozent um.']);
    },
    /* PRUEFEN: Verschleiß als gleichmäßiges Wachsen des Maßes je Teil ist eine Übungsannahme und steht so im Text. */
    pvtrend: R => {
      const c = C(), N = c.pick(R, [20, 25, 30, 40]), d = c.pick(R, [1, 2, 4, 5]), n = c.ri(R, 6, Math.floor(60 / d)), eg = c.rd(N + 0.04, 2), x = c.rd(N + (40 - n * d) / 1000, 3);
      return numQ('Beim Drehen wird ein Außendurchmesser mit jedem Teil etwas größer, weil die Schneide verschleißt. Übungsannahme: Das Maß wächst gleichmäßig um ' + f(d / 1000, 3) + ' mm je Teil. Das letzte Teil misst ' + f(x, 3) + ' mm. Die obere Eingriffsgrenze liegt bei ' + f(eg, 2) + ' mm. Nach wie vielen weiteren Teilen erreicht das Maß die Eingriffsgrenze?', n, 'Teile', 'Anzahl Teile', 0,
        'Abstand zur Eingriffsgrenze = ' + f(eg, 2) + ' mm − ' + f(x, 3) + ' mm = ' + f(n * d / 1000, 3) + ' mm. Anzahl = ' + f(n * d / 1000, 3) + ' mm / ' + f(d / 1000, 3) + ' mm = ' + n + ' Teile. Spätestens dann stellst du das Werkzeug nach oder wechselst die Schneide. So entsteht kein Ausschuss.', ['Rechne zuerst den Abstand vom letzten Messwert bis zur Eingriffsgrenze aus.', 'Teile diesen Abstand durch das Wachstum je Teil.']);
    },
    pv5s: R => orderQ(R, 'Ein Arbeitsplatz wird nach der 5S-Methode in Ordnung gebracht. Bringe die fünf Schritte in die übliche Reihenfolge.', S5STEP.slice(),
      'Erst kommt weg, was niemand braucht. Dann bekommt der Rest feste Plätze. Danach wird gesäubert. Der erreichte Zustand wird als Standard festgehalten. Der letzte Schritt hört nie auf: den Standard einhalten und regelmäßig prüfen.', ['Es lohnt nicht, Dinge zu ordnen, die niemand braucht.', 'Ein Standard lässt sich erst festlegen, wenn der Platz geordnet und sauber ist.']),
    pvergo: (R, arg) => pq(ERQ)(R, arg),
    pvfluss: (R, arg) => pq(MFQ)(R, arg),
    pvuebergabe: R => orderQ(R, 'Deine Vorrichtung ist fertig montiert. Jetzt übergibst du sie an die Produktion. Bringe die Schritte in eine sinnvolle Reihenfolge.', UEBSTEP.slice(),
      'Zuerst muss die Vorrichtung selbst sicher sein und arbeiten. Dann zeigen Probeteile, ob die Maße stimmen. Erst mit diesem Nachweis werden die Bedienenden unterwiesen. Das Protokoll steht am Ende und hält alles fest.', ['Probeteile kannst du erst messen, wenn sie gefertigt sind.', 'Das Protokoll hält fest, was vorher geprüft und gezeigt wurde.']),
    pvsicher: (R, arg) => pq(SIQ)(R, arg),
    pvunterlagen: R => {
      const c = C(); let rows; do { rows = c.shuffle(R, ULROW).slice(0, 4); } while (new Set(rows.map(r => r[1])).size < 3);
      return matchQ(R, 'Zu deiner Vorrichtung gehören mehrere Unterlagen. In welcher Unterlage findest du die Antwort auf die Frage?', rows.map(r => r[0]), ULOPT, rows.map(r => r[1]),
        rows.map(r => r[0] + ' → ' + ULOPT[r[1]]).join('; ') + '. Die Zeichnung zeigt Form und Maße. Die Stückliste nennt alle Teile mit Menge. Der Wartungshinweis sagt, was wann zu pflegen ist. Das Übergabeprotokoll hält die Abnahme fest.', ['Maße stehen in einer anderen Unterlage als Mengen.', 'Die Abnahme wird am Ende in einer eigenen Unterlage festgehalten.']);
    },
    pvruestart: R => {
      const c = C(); let rows; do { rows = c.shuffle(R, RUROW).slice(0, 4); } while (new Set(rows.map(r => r[1])).size < 2);
      return matchQ(R, 'Beim Umrüsten einer Fräsmaschine fallen viele Tätigkeiten an. Manche lassen sich erledigen, während die Maschine noch den alten Auftrag fertigt oder schon den neuen. Ordne jede Tätigkeit zu.', rows.map(r => r[0]), RUOPT, rows.map(r => r[1]),
        rows.map(r => r[0] + ' → ' + (r[1] ? 'inneres Rüsten' : 'äußeres Rüsten')).join('; ') + '. Die Maschine steht nur für das innere Rüsten. Wer alles andere vorher oder nachher erledigt, verkürzt den Stillstand.', ['Frage dich bei jeder Tätigkeit: Muss die Maschine dafür stehen?', 'Bereitlegen, Holen und Wegräumen gehen auch bei laufender Maschine.']);
    },
    pvstoerung: R => {
      const c = C(), nm = c.shuffle(R, STNAME).slice(0, 3); let k, t, z;
      do { k = [0, 1, 2].map(() => c.pick(R, [2, 3, 4, 5, 6, 8])); t = [0, 1, 2].map(() => c.pick(R, [5, 10, 15, 20])); z = k.map((x, i) => x * t[i]); } while (new Set(z).size < 3);
      const mx = Math.max(z[0], z[1], z[2]), im = z.indexOf(mx), v = c.rd(mx * 48 / 60, 2);
      return numQ('An einer Bohrvorrichtung wurde jede Störung notiert. Im Durchschnitt je Woche:\n' + nm.map((x, i) => x + ': ' + k[i] + ' mal, je ' + t[i] + ' min Stillstand').join('\n') + '\nEine Verbesserung beseitigt die Störung mit dem größten Zeitverlust. Wie viele Stunden Stillstand spart das im Jahr? Rechne mit 48 Arbeitswochen.', v, 'h', 'Ersparnis im Jahr', 0.05,
        'Zeitverlust je Woche: ' + nm.map((x, i) => x + ' ' + k[i] + ' · ' + t[i] + ' min = ' + z[i] + ' min').join('; ') + '. Am größten: ' + nm[im] + ' mit ' + mx + ' min je Woche. Im Jahr: ' + mx + ' min · 48 = ' + f(mx * 48, 0) + ' min = ' + f(v, 1) + ' h.', ['Rechne für jede Störung Anzahl mal Dauer.', 'Nimm den größten Wert mal 48 Wochen und rechne in Stunden um.']);
    },
    pvruestspar: R => {
      const c = C(), dt = c.pick(R, [10, 15, 20, 25, 30]), t2 = c.pick(R, [15, 20, 30]), r = c.pick(R, [2, 3, 4, 5]), S = c.pick(R, [48, 60, 72]), h = c.rd(dt * r * 48 / 60, 2), v = c.rd(h * S, 2);
      return numQ('Das Rüsten einer Vorrichtung dauert bisher ' + (t2 + dt) + ' min. Werkzeuge werden künftig vorher bereitgelegt, Schrauben durch Schnellspanner ersetzt. Die Rüstzeit sinkt auf ' + t2 + ' min. Gerüstet wird ' + r + ' mal je Woche, 48 Wochen im Jahr. Der Stundensatz beträgt ' + S + ' € je Stunde. Wie viel Euro spart die Verbesserung im Jahr?', v, '€', 'Ersparnis im Jahr', 0.5,
        'Ersparnis je Rüstvorgang = ' + (t2 + dt) + ' min − ' + t2 + ' min = ' + dt + ' min. Im Jahr: ' + dt + ' min · ' + r + ' · 48 = ' + f(dt * r * 48, 0) + ' min = ' + f(h, 1) + ' h. In Geld: ' + f(h, 1) + ' h · ' + S + ' €/h = ' + f(v, 0) + ' €. Diese Zahl vergleichst du mit den Kosten der Verbesserung.', ['Rechne zuerst die gesparten Minuten je Rüstvorgang aus.', 'Multipliziere mit der Zahl der Rüstvorgänge im Jahr und rechne in Stunden um.'])
    }
  };

  /* ---------- Werkbank-Praxis: Fragen-Pools (v63.187), Form wie oben: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN: Aussagen zum Außengewinde mit dem Schneideisen (Fase, Zurückdrehen, rechtwinklig ansetzen, Schneidöl, Prüfen mit Mutter oder Lehrring, Schneideisenhalter). */
  const AGQ = [
    ['Warum bekommt der Bolzen vor dem Gewindeschneiden eine Fase?', 'Das Schneideisen lässt sich leichter gerade ansetzen', ['Die Fase macht den Bolzen an dieser Stelle deutlich härter als vorher', 'Der Bolzen wird dadurch kürzer', 'Die Fase ersetzt später das Schmieren mit Schneidöl'], 'Die Fase führt das Schneideisen auf den Bolzen. Es fasst gleichmäßig an und verkantet nicht. Ohne Fase schneidet es leicht schief.', ['Denke an den ersten Moment beim Ansetzen.', 'Eine schräge Kante führt das Werkzeug.']],
    ['Beim Schneiden mit dem Schneideisen drehst du immer wieder ein Stück zurück. Wozu?', 'Die Späne brechen und klemmen nicht im Schneideisen', ['Das Gewinde wird dadurch gleich auf Maß nachgemessen und geprüft', 'Der Bolzen kühlt dabei ab', 'Die Steigung wird dabei Stück für Stück größer'], 'Lange Späne verstopfen die Spanlöcher und können das Gewinde aufreißen. Beim Zurückdrehen brechen die Späne ab und fallen heraus.', ['Was entsteht beim Schneiden und muss weg?', 'Lange Späne verklemmen das Werkzeug.']],
    ['Worauf achtest du beim Ansetzen des Schneideisens auf den Bolzen?', 'Das Schneideisen sitzt rechtwinklig zur Achse des Bolzens', ['Das Schneideisen sitzt leicht schräg, damit es schneller greift und zieht', 'Der Bolzen ist glühend warm', 'Das Schneideisen wird mit dem Hammer aufgeschlagen'], 'Sitzt das Schneideisen schief, läuft das Gewinde schief zur Achse. Die Mutter klemmt dann oder sitzt schräg. Darum setzt du rechtwinklig an und prüfst nach den ersten Gängen.', ['Ein schiefes Gewinde lässt die Mutter klemmen.', 'Prüfe die Lage nach den ersten Gängen.']],
    ['Warum gibst du beim Gewindeschneiden in Stahl Schneidöl dazu?', 'Die Reibung sinkt und die Gewindeflanken werden glatter', ['Das Öl härtet die Gewindegänge schon während des Schneidens durch', 'Der Bolzen rostet sonst sofort', 'Das Öl macht den Bolzen etwas dicker und fester'], 'Schneidöl schmiert die Schneiden. Die Kraft wird kleiner, die Flanken reißen nicht aus und das Werkzeug bleibt länger scharf.', ['Öl schmiert zwischen Werkzeug und Werkstück.', 'Weniger Reibung schont die Schneiden.']],
    ['Das Außengewinde ist fertig. Womit prüfst du in der Werkstatt, ob es passt?', 'Mit einer passenden Mutter oder einem Gewindelehrring', ['Mit dem Stahlmaßstab, den du längs an die Gewindegänge anlegst', 'Mit dem Haarwinkel', 'Mit dem Körner, der in die Gewindegänge gedrückt wird'], 'Ein Gewinde muss mit dem Gegenstück zusammenpassen. Die Mutter oder der Gewindelehrring muss sich leicht und ohne Wackeln aufschrauben lassen.', ['Ein Gewinde prüft man mit dem Gegenstück.', 'Zum Außengewinde gehört ein Teil mit Innengewinde.']],
    ['In welchem Werkzeug wird das Schneideisen beim Gewindeschneiden gehalten?', 'Im Schneideisenhalter mit zwei Handgriffen', ['Im Windeisen, das sonst den Gewindebohrer führt und dreht', 'Im Bohrfutter', 'Im Feilkloben, der im Schraubstock eingespannt ist'], 'Das Schneideisen wird in den Schneideisenhalter gelegt und mit Schrauben geklemmt. Mit den beiden Griffen drehst du gleichmäßig. Das Windeisen gehört zum Gewindebohrer.', ['Das Werkzeug hat zwei Griffe zum Drehen.', 'Das Windeisen hält den Gewindebohrer, nicht das Schneideisen.']]
  ];
  const AGSTEP = ['Bolzen senkrecht in den Schraubstock spannen', 'Fase an das eingespannte Bolzenende feilen', 'Schneideisen mit Schneidöl rechtwinklig auf die Fase setzen', 'Gewinde schneiden und dabei immer wieder zurückdrehen', 'Fertiges Gewinde mit einer Mutter prüfen'];
  /* PRUEFEN: Aussagen zum Entgraten (Verletzung, Messfehler, Zeitpunkt, Werkzeug, Zeichnungshinweis). */
  const EGQ = [
    ['Nach dem Sägen hat das Werkstück an der Schnittkante einen Grat. Warum entfernst du ihn?', 'Der scharfe Grat kann schneiden und stört beim Messen', ['Der Grat macht das Werkstück an der Kante viel zu weich für die weitere Arbeit', 'Der Grat rostet nie', 'Der Grat verändert die Farbe des ganzen Werkstücks'], 'Ein Grat ist ein dünner, scharfer Rest an der Kante. Du kannst dich daran schneiden. Außerdem liegt das Teil nicht mehr sauber auf und Messmittel messen den Grat mit.', ['Fasse in Gedanken über die Kante.', 'Ein Grat steht über die Fläche hinaus.']],
    ['Wann entgratest du ein Werkstück, das du gesägt und gebohrt hast?', 'Vor dem Messen und vor dem Spannen für den nächsten Schritt', ['Erst ganz am Ende, wenn alle Teile fertig montiert und verschraubt sind', 'Am besten gar nicht', 'Nur dann, wenn der Ausbilder das Teil ansehen möchte'], 'Ein Grat verfälscht das Maß und lässt das Teil im Schraubstock schief sitzen. Darum entgratest du nach jedem Arbeitsgang, bevor du misst oder neu spannst.', ['Ein Grat stört beim Messen und beim Spannen.', 'Entgraten gehört zu jedem Arbeitsgang.']],
    ['Womit entgratest du den Rand einer frisch gebohrten Bohrung?', 'Mit dem Kegelsenker oder einem Handentgrater', ['Mit dem Körner, den du kräftig in die Bohrung hineinschlägst', 'Mit der Reißnadel', 'Mit dem Gewindebohrer, den du kurz hineindrehst'], 'Der Kegelsenker nimmt den Grat am Bohrungsrand mit einer kleinen Fase weg. Von Hand geht das auch mit einem Handentgrater.', ['Das Werkzeug hat eine kegelige Form.', 'Es entsteht eine kleine Fase am Rand der Bohrung.']],
    ['Ein Werkstück mit Grat liegt beim Messen auf der Messfläche auf. Was passiert?', 'Der Grat hebt das Teil an, das Maß wird verfälscht', ['Der Grat drückt sich von selbst weg, das Maß stimmt dann immer genau', 'Es passiert gar nichts', 'Der Messschieber zeigt dann immer einen zu kleinen Wert an'], 'Der Grat steht über die Fläche hinaus. Das Teil liegt auf dem Grat und nicht auf der Fläche. Das Messmittel misst den Grat mit, der Wert wird zu groß.', ['Der Grat steht über die Fläche hinaus.', 'Das Messmittel misst alles mit, was dazwischen liegt.']],
    ['Auf der Zeichnung steht: Alle Kanten entgratet. Was machst du an den Außenkanten?', 'Den Grat mit der Feile leicht abziehen, bis die Kante nicht mehr scharf ist', ['Jede Kante mit einem großen Radius von 5 mm rund feilen und danach polieren', 'Nichts, das gilt nur für Bohrungen', 'Die Kanten mit dem Hammer breit schlagen, bis sie stumpf sind'], 'Entgraten heißt nur: Der Grat kommt weg und die Kante ist nicht mehr scharf. Ein großer Radius oder eine breite Fase würde die Form des Teils verändern.', ['Es soll nur der scharfe Rest an der Kante weg.', 'Die Form des Teils bleibt dabei erhalten.']]
  ];
  /* PRUEFEN: Aussagen zum Zustand von Handwerkzeug (Bart am Meißelkopf, Feile ohne Heft, lockerer Hammerkopf, Blick auf die Schneide, Schutzbrille). */
  const HZQ = [
    ['Am Kopf eines Meißels hat sich durch viele Schläge ein Bart gebildet. Was tust du?', 'Den Bart abschleifen lassen, bevor du weiterarbeitest', ['Weiterarbeiten, der Bart schützt den Meißelkopf vor weiteren Schlägen', 'Den Bart blau anmalen', 'Den Meißel umdrehen und mit der Schneide nach oben benutzen'], 'Der Bart ist breitgeschlagener Werkstoff am Meißelkopf. Beim nächsten Schlag können Stücke davon abspringen. Der Bart wird deshalb abgeschliffen.', ['Der Bart ist aufgestauchter Werkstoff am Kopf.', 'Was kann beim nächsten Schlag wegfliegen?']],
    ['Warum ist ein Bart am Meißelkopf gefährlich?', 'Beim Schlag können Splitter abspringen und verletzen', ['Der Meißel wird dadurch schwerer und schlägt viel zu tief ins Werkstück', 'Der Meißel rostet schneller', 'Der Hammer bleibt am Bart hängen und federt nicht zurück'], 'Der Bart ist rissig und spröde. Beim Schlag brechen kleine Stücke ab und fliegen mit hoher Geschwindigkeit weg. Sie können Hände und Augen verletzen.', ['Der Bart ist rissig und spröde.', 'Denke an deine Augen und Hände.']],
    ['Du findest eine Feile ohne Heft (Griff). Warum darfst du so nicht feilen?', 'Die spitze Angel kann sich in die Hand bohren', ['Die Feile schneidet ohne Heft nur noch beim Rückhub und wird stumpf', 'Die Feile ist dann zu leicht', 'Ohne Heft wird die Feile beim Feilen sofort weich'], 'Das spitze Ende der Feile heißt Angel. Darauf sitzt das Heft. Ohne Heft drückt die Angel beim Feilen in die Handfläche. Auch ein lockeres oder gerissenes Heft wird ersetzt.', ['Schau dir das Ende der Feile an.', 'Das spitze Ende heißt Angel.']],
    ['Der Hammerkopf sitzt locker auf dem Stiel. Was ist richtig?', 'Den Hammer nicht benutzen, erst neu verkeilen lassen', ['Vorsichtig weiterarbeiten und nur mit halber Kraft und langsam zuschlagen', 'Den Stiel kürzer fassen', 'Den Kopf mit Klebeband umwickeln und dann normal weiterarbeiten'], 'Ein lockerer Hammerkopf kann beim Ausholen wegfliegen. Der Hammer wird erst wieder benutzt, wenn der Kopf fest verkeilt ist und der Stiel keine Risse hat.', ['Was kann beim Ausholen passieren?', 'Ein Keil hält den Kopf auf dem Stiel.']],
    ['Du trennst ein Blech mit dem Flachmeißel. Wohin schaust du beim Schlagen?', 'Auf die Schneide des Meißels am Werkstück', ['Auf den Meißelkopf, damit der Hammer ihn auch sicher und mittig trifft', 'Auf den Hammerstiel', 'Auf die Werkbank neben dem Schraubstock, wo die Späne liegen'], 'Die Schneide entscheidet, wo getrennt wird. Darum bleibt der Blick an der Schneide. Den Meißelkopf trifft die Hand nach kurzer Übung von allein.', ['Wo entsteht der Schnitt?', 'Den Kopf trifft der Hammer nach etwas Übung von allein.']],
    ['Welche Schutzausrüstung brauchst du beim Meißeln auf jeden Fall?', 'Eine Schutzbrille gegen wegfliegende Späne', ['Nur einen Gehörschutz, die Augen sind beim Meißeln nicht gefährdet', 'Ein Schweißerschild', 'Eine Staubmaske, weil beim Meißeln feiner Staub entsteht'], 'Beim Meißeln fliegen Späne und manchmal Splitter weg. Die Schutzbrille schützt die Augen. Oft steht zusätzlich eine Schutzwand hinter dem Schraubstock, damit niemand getroffen wird.', ['Beim Meißeln fliegen Späne weg.', 'Welches Körperteil ist am empfindlichsten?']]
  ];

  /* ---------- Einsatzgebiet Produktionstechnik: Fragen-Pools (v63.187), Form wie oben: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN: Bestimmen ohne Zwang (drei feste Auflagen plus einstellbare Stütze, Bestimmen an den Bezugsflächen der Zeichnung, nur ein fester Anschlag je Richtung). */
  const BZQ = [
    ['Ein rohes Gussteil hat eine unebene Unterseite. Auf vier festen Auflagen kippelt es. Wie baust du die Auflage in der Vorrichtung?', 'Drei feste Auflagen und dazu eine einstellbare Stütze', ['Vier feste Auflagen, alle genau gleich hoch geschliffen', 'Eine durchgehende ebene Platte', 'Zwei feste Auflagen und ein kräftiger Spanner von oben'], 'Drei Punkte legen die Ebene eindeutig fest. Eine vierte feste Auflage wäre zu viel: Das Teil kippelt oder wird beim Spannen verbogen. Die einstellbare Stütze wird erst angelegt, wenn das Teil auf den drei festen Auflagen liegt.', ['Wie viele Punkte legen eine Ebene fest?', 'Eine Stütze darf die Lage nicht noch einmal bestimmen.']],
    ['An welchen Flächen bestimmst du ein Werkstück in der Vorrichtung möglichst?', 'An den Flächen, von denen in der Zeichnung die Maße ausgehen', ['An den Flächen, die in diesem Arbeitsgang bearbeitet werden', 'An den kleinsten Flächen des Werkstücks', 'An beliebigen Flächen, solange der Spanner genug Kraft hat'], 'Liegt das Teil an seinen Bezugsflächen an, entsteht das Maß direkt von dort aus. Bestimmst du an einer anderen Fläche, gehen deren Abweichungen zusätzlich in das Maß ein.', ['Schau, wo in der Zeichnung die Maße beginnen.', 'Jede Zwischenfläche bringt eigene Abweichungen mit.']],
    ['Ein Quader liegt auf drei Auflagen, an zwei seitlichen Anschlägen und an einem Anschlag an der Stirnseite. Jemand will an der gegenüberliegenden Stirnseite einen zweiten festen Anschlag einbauen. Was passiert dann?', 'Lange Teile klemmen, kurze Teile haben Spiel', ['Die Lage wird doppelt so genau wie vorher', 'Das Teil kann sich jetzt um die Hochachse drehen', 'Die Spannkraft darf danach halbiert werden'], 'Die Länge der Teile schwankt innerhalb der Toleranz. Zwei feste Anschläge in derselben Richtung bestimmen die Lage doppelt. In jeder Richtung genügt ein fester Anschlag. Von der Gegenseite wird höchstens gespannt.', ['Die Teile sind nie alle genau gleich lang.', 'In jeder Richtung bestimmt nur ein fester Anschlag.']],
    ['Eine dünne Platte liegt richtig auf drei Auflagen. Beim Bohren biegt sie sich an der freien Ecke durch. Was hilft, ohne die Lage zu verändern?', 'Eine einstellbare Stütze, die du nach dem Auflegen anstellst', ['Eine vierte feste Auflage in gleicher Höhe wie die anderen drei', 'Ein stärkerer Spanner über der freien Ecke', 'Ein höherer Vorschub, damit der Bohrer schneller durch ist'], 'Die drei festen Auflagen bestimmen die Lage. Die Stütze kommt erst danach von unten an das Teil und nimmt nur die Kraft auf. Eine vierte feste Auflage würde die Lage doppelt bestimmen.', ['Bestimmen und Stützen sind zwei verschiedene Aufgaben.', 'Die Stütze darf das Teil nicht anheben.']]
  ];
  /* PRUEFEN: Aufnahme in zwei Bohrungen mit rundem und abgeflachtem Bolzen (Luft in Richtung der Verbindungslinie, abgeflachter Bolzen sperrt nur die Drehung). */
  const AFQ = [
    ['Ein Werkstück hat zwei Bohrungen. In der Vorrichtung wird es auf zwei Aufnahmebolzen gesteckt. Der Abstand der Bohrungen schwankt innerhalb der Toleranz. Welche Bolzen wählst du?', 'Einen runden Bolzen und einen abgeflachten Bolzen', ['Zwei runde Bolzen mit möglichst wenig Spiel in der Bohrung', 'Zwei abgeflachte Bolzen in gleicher Richtung', 'Zwei runde Bolzen mit sehr viel Spiel'], 'Der runde Bolzen legt die Lage in der Ebene fest. Der abgeflachte Bolzen sperrt nur noch die Drehung um den runden Bolzen. In Richtung des Lochabstands hat er Luft. So klemmt kein Teil, auch wenn der Abstand etwas schwankt.', ['Zwei enge runde Bolzen bestimmen den Lochabstand doppelt.', 'Der zweite Bolzen muss nur noch die Drehung sperren.']],
    ['Ein Werkstück sitzt auf einem runden und einem abgeflachten Aufnahmebolzen. In welcher Richtung hat der abgeflachte Bolzen Luft in der Bohrung?', 'In Richtung der Verbindungslinie der beiden Bolzen', ['Quer zur Verbindungslinie der beiden Bolzen', 'In allen Richtungen gleich viel', 'Nur nach oben, in Richtung der Bolzenachse'], 'Der Abstand der Bohrungen schwankt in Richtung der Verbindungslinie. Genau dort ist der Bolzen abgeflacht und hat Luft. Quer dazu liegt er an und sperrt die Drehung des Werkstücks.', ['In welcher Richtung schwankt der Lochabstand?', 'Quer dazu muss der Bolzen anliegen, sonst dreht sich das Teil.']],
    ['Ein Werkstück sitzt auf einem runden und einem abgeflachten Aufnahmebolzen. Welche Aufgabe hat der abgeflachte Bolzen?', 'Er sperrt die Drehung um den runden Bolzen', ['Er trägt das Gewicht des Werkstücks', 'Er spannt das Werkstück gegen die Auflage', 'Er legt die Lage in beiden Richtungen noch einmal fest'], 'Auf dem runden Bolzen allein könnte sich das Werkstück noch drehen. Der abgeflachte Bolzen nimmt ihm diese letzte Bewegung. Mehr soll er nicht bestimmen.', ['Was kann ein Teil auf einem einzelnen runden Bolzen noch tun?', 'Es geht um eine Drehung, nicht um eine Kraft.']],
    ['In einer Vorrichtung sitzen zwei runde Aufnahmebolzen mit engem Spiel. Manche Werkstücke lassen sich nicht aufstecken, obwohl alle Maße in der Toleranz liegen. Woran liegt das?', 'Der Lochabstand schwankt, die Bolzen lassen dafür keine Luft', ['Die Bolzen sind zu hart für den Werkstoff der Teile', 'Die Bolzen stehen zu weit auseinander', 'Die Bohrungen wurden mit zu hoher Drehzahl gebohrt und sind rau'], 'Zwei enge runde Bolzen bestimmen den Lochabstand doppelt. Weicht der Abstand am Werkstück etwas ab, klemmt das Teil. Abhilfe: Ein Bolzen wird abgeflacht.', ['Vergleiche den Abstand der Bolzen mit dem Abstand der Bohrungen.', 'Auch ein Maß in der Toleranz ist nie bei allen Teilen gleich.']]
  ];
  /* PRUEFEN: Kniehebelspanner (verriegelt knapp hinter der gestreckten Lage, kleiner Spannweg, Andruckschraube einstellen, Bedienung mit einer Hand). */
  const KHQ = [
    ['Ein Kniehebelspanner bleibt in der Spannstellung von selbst geschlossen. Wodurch?', 'Das Gelenk wird knapp über die gestreckte Lage gedrückt', ['Eine starke Feder zieht den Hebel dauernd nach unten und hält ihn', 'Die Reibung im Handgriff hält den Hebel', 'Ein Magnet im Fuß hält den Spannarm fest'], 'Kurz hinter der gestreckten Lage liegt der Kniehebel an einem Anschlag an. Die Gegenkraft des Werkstücks drückt ihn dann noch fester in diese Lage. Er öffnet erst, wenn du den Hebel zurückziehst.', ['Denke an ein durchgedrücktes Knie.', 'Die Gegenkraft des Werkstücks hält den Spanner zu.']],
    ['Die Dicke der Werkstücke hat sich mit dem neuen Auftrag geändert. Der Kniehebelspanner schließt nicht mehr richtig. Was tust du?', 'Die Andruckschraube am Spannarm neu einstellen', ['Den Handhebel mit einem Rohr verlängern und fester drücken', 'Den Spanner halb offen stehen lassen', 'Das Gelenk kräftig ölen, dann schließt er wieder von selbst'], 'Ein Kniehebelspanner hat nur einen kleinen Spannweg. Die Kraft entsteht erst kurz vor der gestreckten Lage. Darum wird die Andruckschraube auf die Dicke des Werkstücks eingestellt und gekontert.', ['Der Spannweg eines Kniehebelspanners ist klein.', 'Am Spannarm sitzt ein einstellbares Teil.']],
    ['Warum sind Kniehebelspanner an Vorrichtungen für die Serie beliebt?', 'Spannen und Lösen gelingen schnell mit einem Handgriff', ['Sie spannen ohne Einstellung jedes beliebige Werkstück', 'Sie ersetzen Auflagen und Anschläge', 'Sie erzeugen mehr Kraft als jede Schraube'], 'Ein Schwenk des Hebels spannt, ein Schwenk zurück gibt das Teil ganz frei. Das spart bei jedem Stück Zeit. Bestimmen müssen trotzdem Auflagen und Anschläge.', ['In der Serie zählt die Zeit je Stück.', 'Ein Spanner bestimmt nicht die Lage.']],
    ['Du baust einen Spanner an eine Vorrichtung für die Serie. Warum soll er sich mit einer Hand bedienen lassen?', 'Die andere Hand kann das Werkstück einlegen und halten', ['Mit zwei Händen wird die Spannkraft immer zu groß für das Teil', 'Die Vorrichtung wird dadurch kleiner', 'Eine Hand muss beim Spannen stets am Hauptschalter liegen'], 'Beim Einlegen hält eine Hand das Werkstück an Auflagen und Anschlägen. Die andere spannt. Braucht der Spanner beide Hände, verrutscht das Teil leicht und das Spannen dauert länger.', ['Wer hält das Teil, während gespannt wird?', 'Denke an den Ablauf beim Einlegen.']]
  ];
  /* PRUEFEN: Bohrbuchsen und Verschleißteile (führen und Lage festlegen, gehärtet, Steckbohrbuchse bei Bohren und Reiben in einer Lage, Abstand für Späne, Verschleißteile tauschbar). */
  const BBQ = [
    ['Welche Aufgabe hat die Bohrbuchse in einer Bohrvorrichtung?', 'Sie führt den Bohrer und legt die Lage der Bohrung fest', ['Sie spannt das Werkstück während des Bohrens gegen die Auflage', 'Sie kühlt den Bohrer', 'Sie begrenzt die Bohrtiefe auf das richtige Maß'], 'Mit der Bohrbuchse sitzt jede Bohrung an derselben Stelle. Anreißen und Körnen entfallen. Der Bohrer kann beim Anbohren nicht verlaufen.', ['Was entfällt in der Serie dank der Vorrichtung?', 'Der Bohrer braucht beim Ansetzen eine Führung.']],
    ['Warum sind Bohrbuchsen gehärtet?', 'Der Bohrer würde eine weiche Buchse schnell ausreiben', ['Eine harte Buchse schärft den Bohrer bei jedem Hub ein wenig nach', 'Gehärteter Stahl rostet nicht', 'Eine weiche Buchse würde beim Bohren schmelzen'], 'Der Bohrer läuft bei jedem Teil durch die Buchse. Eine weiche Buchse wäre bald zu weit und würde nicht mehr genau führen. Die Lage der Bohrungen würde streuen.', ['Der Bohrer berührt die Buchse bei jedem Teil.', 'Eine ausgeriebene Buchse führt nicht mehr genau.']],
    ['In derselben Lage wird erst gebohrt und dann gerieben. Welche Bohrbuchse passt?', 'Eine Steckbohrbuchse, die sich schnell wechseln lässt', ['Eine fest eingepresste Buchse mit dem Maß der Reibahle', 'Eine besonders lange Buchse mit dem Maß des Bohrers', 'Eine fest eingepresste Buchse mit dem Maß des Bohrers'], 'Bohrer und Reibahle haben verschiedene Durchmesser. Jedes Werkzeug braucht seine eigene Führung. Steckbohrbuchsen werden in eine feste Grundbuchse gesteckt und von Hand getauscht.', ['Bohrer und Reibahle sind nicht gleich dick.', 'Es gibt Buchsen, die man von Hand wechseln kann.']],
    ['Auflagebolzen, Anschläge und Bohrbuchsen nutzen sich im Betrieb ab. Wie baust du sie in die Vorrichtung ein?', 'Gehärtet und so befestigt, dass sie sich tauschen lassen', ['Fest mit dem Grundkörper verschweißt und danach überschliffen', 'Aus dem Grundkörper herausgefräst', 'Eingeklebt, damit sich im Betrieb nichts lösen kann'], 'Verschleißteile werden gesteckt, eingepresst oder verschraubt. Ist ein Teil abgenutzt, wird nur dieses Teil getauscht. Der teure Grundkörper bleibt.', ['Was geschieht, wenn eine Auflage abgenutzt ist?', 'Der Grundkörper soll lange halten.']],
    ['Zwischen Bohrbuchse und Werkstück bleibt ein kleiner Abstand. Wozu?', 'Die Späne können unter der Buchse austreten', ['Der Bohrer kann so leichter zur Seite ausweichen, wenn er verläuft', 'Das Werkstück darf sich beim Bohren bewegen', 'Die Buchse bleibt dadurch kühl und dehnt sich nicht'], 'Ohne Abstand müssten alle Späne durch die Buchse nach oben. Das reibt die Buchse aus und kann den Bohrer klemmen. Der Abstand bleibt klein, damit der Bohrer gut geführt ist.', ['Wohin müssen die Späne?', 'Späne in der Buchse reiben sie aus.']]
  ];
  /* PRUEFEN: Späne und Sauberkeit (kleine erhöhte Auflagen, Span auf der Auflage, Freistich in der Ecke, offene Bauweise). */
  const SRQ = [
    ['Warum liegt das Werkstück in einer Vorrichtung auf kleinen, erhöhten Auflagen und nicht auf einer großen Fläche?', 'Späne bleiben kaum liegen, die Auflage ist schnell sauber', ['Kleine Auflagen erzeugen viel mehr Reibung als eine große Fläche', 'Das Werkstück wird dadurch leichter', 'Eine große Fläche würde sich schneller erwärmen'], 'Auf einer kleinen, erhöhten Auflage findet ein Span kaum Platz. Du siehst sie gut und wischst sie mit einem Griff sauber. Auf einer großen Fläche bleibt leicht ein Span liegen.', ['Denke an Späne und Schmutz.', 'Was lässt sich schneller säubern?']],
    ['Ein Span liegt unbemerkt auf einer Auflage. Das nächste Werkstück wird eingelegt und gespannt. Was ist die Folge?', 'Das Teil liegt schief, die Maße stimmen nicht mehr', ['Die Spannkraft steigt, das Teil sitzt dadurch besonders fest', 'Der Span stört nicht, er wird flach gedrückt', 'Die Bohrbuchse gleicht den Fehler aus'], 'Der Span hebt das Teil an einer Stelle an. Es liegt nicht mehr auf allen Auflagen. Alle Maße, die von dieser Fläche ausgehen, werden falsch. Darum wird vor jedem Einlegen gesäubert.', ['Der Span hebt das Teil an einer Stelle an.', 'Von der Auflage gehen die Maße aus.']],
    ['In der Ecke zwischen Auflage und Anschlag ist ein kleiner Freistich eingearbeitet. Wozu dient er?', 'Grat am Teil und Schmutz in der Ecke stören die Anlage nicht', ['Der Anschlag wird dadurch härter und nutzt sich langsamer ab', 'Dort wird der Spanner eingehängt', 'Das Kühlmittel sammelt sich dort und bleibt stehen'], 'In einer scharfen Innenecke sammelt sich Schmutz. Auch ein kleiner Grat an der Werkstückkante würde dort anstoßen. Mit dem Freistich liegt das Teil trotzdem sauber an beiden Flächen an.', ['Was sammelt sich in einer scharfen Innenecke?', 'Die Kante des Werkstücks hat oft einen kleinen Grat.']],
    ['Wie gestaltest du eine Bohrvorrichtung, damit sie im Betrieb sauber bleibt?', 'Offen, mit Schrägen, an denen die Späne abrutschen', ['Mit geschlossenen Taschen, in denen sich die Späne sammeln', 'Mit rauen Flächen, an denen Späne haften', 'Mit tiefen Sacklöchern unter jeder Auflage'], 'Späne sollen von selbst herausfallen oder sich leicht entfernen lassen. Geschlossene Taschen, Sacklöcher und raue Flächen halten Späne fest. Dann dauert das Reinigen bei jedem Teil länger.', ['Späne sollen von selbst herausfallen.', 'Wo Späne hängen bleiben, musst du jedes Mal säubern.']]
  ];
  /* PRUEFEN: Verwechslungsschutz (Poka-Yoke): Fehler durch die Bauart verhindern statt durch Schild, Prüfung oder Unterweisung. */
  const PYQ = [
    ['Ein Werkstück sieht fast symmetrisch aus. Es lässt sich auch um 180° verdreht in die Vorrichtung legen. Dann sitzt die Bohrung an der verkehrten Stelle. Welche Lösung ist am sichersten?', 'Ein zusätzlicher Stift, der die verdrehte Lage sperrt', ['Ein Warnschild mit dem Hinweis auf die richtige Lage des Teils', 'Eine Prüfung aller Teile am Schichtende', 'Eine längere Unterweisung für alle am Platz'], 'Am sichersten ist eine Vorrichtung, in die das Teil nur in der richtigen Lage passt. Schilder und Unterweisungen helfen, aber Menschen übersehen etwas. Eine Prüfung am Ende findet den Fehler erst, wenn er schon gemacht ist.', ['Am besten ist der Fehler gar nicht möglich.', 'Ein Schild kann man übersehen.']],
    ['Was ist der Grundgedanke von Poka-Yoke?', 'Fehler werden durch die Bauart von vornherein verhindert', ['Fehler werden am Ende durch eine genaue Prüfung aller Teile aussortiert', 'Fehler werden gezählt und monatlich ausgewertet', 'Fehler werden durch höhere Stückzahlen ausgeglichen'], 'Poka-Yoke heißt: Vorrichtung und Ablauf sind so gestaltet, dass eine Verwechslung oder ein Vergessen nicht möglich ist oder sofort auffällt. Der Fehler entsteht gar nicht erst.', ['Es geht um Vermeiden, nicht um Aussortieren.', 'Die Lösung steckt in der Bauart.']],
    ['An einem Platz werden zwei sehr ähnliche Teiletypen gebohrt. Wie verhinderst du am sichersten, dass ein Teil in die Vorrichtung des anderen Typs kommt?', 'Die Aufnahme passt nur für den richtigen Typ', ['Der Typ steht klein auf der Rückseite der Vorrichtung geschrieben', 'Alle am Platz merken sich den Unterschied', 'Beide Typen liegen im selben Behälter bereit'], 'Wenn der andere Typ gar nicht in die Aufnahme passt, kann niemand ihn versehentlich bearbeiten. Dafür nutzt man ein Merkmal, in dem sich die Typen unterscheiden, zum Beispiel eine Bohrung oder eine Kante.', ['Nutze ein Merkmal, in dem sich die Typen unterscheiden.', 'Was nicht hineinpasst, wird nicht bearbeitet.']],
    ['An einer Montagevorrichtung wird manchmal eine Scheibe vergessen. Welche Lösung verhindert den Fehler durch die Bauart?', 'Das nächste Bauteil lässt sich nur einlegen, wenn die Scheibe sitzt', ['Ein Zettel am Platz erinnert an die Scheibe', 'Die Scheiben liegen in einem größeren Behälter bereit', 'Am Schichtende wird die Zahl der übrigen Scheiben geschätzt'], 'Die Vorrichtung fragt die Scheibe sozusagen ab: Ohne Scheibe geht es nicht weiter. So fällt das Vergessen sofort auf, nicht erst bei der Prüfung oder beim Kunden.', ['Der Fehler soll sofort auffallen.', 'Die Vorrichtung selbst soll das Weiterarbeiten sperren.']]
  ];
  /* PRUEFEN: Erstteilprüfung und Erstteilfreigabe (nach dem Rüsten und nach Werkzeugwechsel, keine Freigabe bei Abweichung). */
  const ETQ = [
    ['Wann ist eine Erstteilprüfung nötig?', 'Nach dem Rüsten, bevor die Serie anläuft', ['Erst am Ende, wenn das ganze Los fertig bearbeitet ist', 'Nur einmal im Jahr', 'Nur dann, wenn ein Kunde reklamiert hat'], 'Nach dem Rüsten ist alles neu eingestellt: Vorrichtung, Werkzeug, Anschläge. Das erste Teil zeigt, ob die Einstellung stimmt. Erst nach der Freigabe läuft die Serie.', ['Wann wurde zuletzt etwas eingestellt?', 'Ein Fehler soll auffallen, bevor viele Teile fertig sind.']],
    ['Das Erstteil nach dem Rüsten liegt bei einem Maß außerhalb der Toleranz. Was tust du?', 'Nicht freigeben, Ursache beheben, neues Erstteil prüfen', ['Freigeben und das Maß bei den nächsten Teilen weiter beobachten', 'Das Erstteil aussortieren und die Serie starten', 'Die Toleranz in der Zeichnung von Hand ändern'], 'Ohne Freigabe läuft keine Serie. Erst wird die Ursache gesucht und behoben, zum Beispiel ein verstellter Anschlag. Dann wird ein neues Erstteil gefertigt und geprüft.', ['Die Einstellung stimmt offenbar noch nicht.', 'Nach der Korrektur brauchst du einen neuen Nachweis.']],
    ['Wozu dient die Erstteilfreigabe?', 'Ein Fehler beim Einrichten wird vor der Serie entdeckt', ['Sie ersetzt alle weiteren Prüfungen während der laufenden Serie', 'Sie verkürzt die Rüstzeit', 'Sie legt den Preis für das fertige Teil fest'], 'Ein Einrichtfehler wirkt bei jedem Teil gleich. Ohne Erstteilprüfung steckt er im ganzen Los. Die Prüfungen während der Serie bleiben trotzdem nötig, zum Beispiel wegen Verschleiß.', ['Ein Einrichtfehler trifft jedes Teil des Loses.', 'Während der Serie wird trotzdem weiter geprüft.']],
    ['Mitten in der Serie wird ein gebrochener Bohrer ersetzt. Was gilt für das nächste Teil?', 'Es wird wie ein Erstteil geprüft, bevor es weitergeht', ['Es gilt ohne Prüfung als gut, die Vorrichtung ist ja dieselbe', 'Es kommt ungeprüft in das Sperrlager', 'Es wird erst bei der Endprüfung des Loses angesehen'], 'Nach einem Werkzeugwechsel hat sich etwas am Prozess geändert. Das nächste Teil zeigt, ob Maß und Lage noch stimmen. Erst dann läuft die Serie weiter.', ['Nach jeder Änderung am Prozess wird neu geprüft.', 'Ein neues Werkzeug kann anders schneiden als das alte.']]
  ];
  /* PRUEFEN: Ergonomie (Greifraum, Arbeitshöhe bei feiner Arbeit im Stehen etwas über Ellenbogenhöhe, schwere Teile in Hüfthöhe lagern). */
  const ERQ = [
    ['An einem Montageplatz brauchst du Schrauben und Schrauber bei jedem Teil. Wo liegen sie am besten?', 'Im vorderen Greifraum, ohne Vorbeugen erreichbar', ['Im Regal hinter dir, damit die Tischfläche ganz frei bleibt', 'Unter dem Tisch in einer Schublade', 'Am Nachbarplatz, dort ist mehr Platz'], 'Was du bei jedem Teil brauchst, liegt direkt vor dir in Reichweite der Hände. Was du selten brauchst, darf weiter weg liegen. So sparst du bei jedem Stück Wege und schonst den Rücken.', ['Wie oft greifst du in einer Schicht nach diesen Teilen?', 'Häufig gebrauchte Dinge liegen nah.']],
    ['Du richtest einen Steharbeitsplatz für feine Montagearbeit ein. Welche Arbeitshöhe passt nach der Faustregel?', 'Etwa in Ellenbogenhöhe oder etwas darüber', ['In Kniehöhe, damit die Arme locker nach unten hängen können', 'In Schulterhöhe', 'Deutlich unter Hüfthöhe'], 'Bei feiner Arbeit musst du gut sehen können. Darum liegt die Arbeit etwa in Ellenbogenhöhe oder etwas darüber. Bei schwerer Arbeit liegt sie tiefer, damit du Kraft von oben aufbringen kannst.', ['Bei feiner Arbeit musst du genau hinsehen können.', 'Die Schultern sollen locker bleiben, der Rücken gerade.']],
    ['Schwere Vorrichtungen werden am Platz im Regal gelagert. In welcher Höhe nach der Faustregel?', 'Etwa in Hüfthöhe, ohne Bücken und ohne Strecken', ['Ganz oben, damit unten Platz für die Kleinteile bleibt', 'Direkt auf dem Boden', 'Über Kopfhöhe, dort stören sie nicht'], 'Schwere Lasten hebst du am sichersten nah am Körper und etwa in Hüfthöhe. Ganz unten musst du dich tief bücken, ganz oben über Schulterhöhe heben. Beides belastet den Rücken stark.', ['Wo hebst du mit geradem Rücken?', 'Leichte Dinge dürfen nach oben und nach unten.']],
    ['Was bedeutet Greifraum an einem Arbeitsplatz?', 'Der Bereich, den du mit den Händen bequem erreichst', ['Der Platz, an dem die Greifzangen und Pinzetten aufbewahrt werden', 'Der Weg vom Lager zum Arbeitsplatz', 'Die Fläche, die der Spanner zum Öffnen braucht'], 'Der Greifraum ist der Bereich vor dir, den du ohne Vorbeugen und ohne Aufstehen erreichst. Dort liegen Teile und Werkzeuge, die du häufig brauchst.', ['Es geht um die Reichweite der Arme.', 'Der Begriff beschreibt einen Bereich, kein Werkzeug.']]
  ];
  /* PRUEFEN: Materialfluss, Kennzeichnung und Sperrlager (Plätze in Reihenfolge der Arbeitsgänge, fehlerhafte Teile gekennzeichnet und getrennt). */
  const MFQ = [
    ['Drei Arbeitsplätze bearbeiten nacheinander dasselbe Teil. Wie ordnest du sie an?', 'In der Reihenfolge der Arbeitsgänge, mit kurzen Wegen', ['Nach der Größe der Maschinen, die größte Maschine zuerst', 'Möglichst weit auseinander', 'So, dass sich die Wege der Teile kreuzen'], 'Das Teil soll auf kurzem Weg von Platz zu Platz wandern, ohne Umwege und ohne Kreuzungen. Jeder unnötige Weg kostet Zeit und bringt keinen Nutzen für das Teil.', ['Folge dem Weg des Teils durch die Fertigung.', 'Wege bringen dem Teil keinen Nutzen.']],
    ['Du findest am Prüfplatz ein fehlerhaftes Teil. Wohin kommt es?', 'Gekennzeichnet in den Sperrbehälter, getrennt von guten Teilen', ['Zurück in den Behälter mit den noch ungeprüften Teilen der Serie', 'Oben auf die guten Teile', 'Ohne Kennzeichnung auf die Werkbank daneben'], 'Ein fehlerhaftes Teil wird sofort gekennzeichnet und von den anderen getrennt. So kann es niemand versehentlich weiterverarbeiten. Über Nacharbeit oder Ausschuss wird danach entschieden.', ['Niemand darf das Teil versehentlich weiterverarbeiten.', 'Zwei Dinge sind nötig: kennzeichnen und trennen.']],
    ['Wozu dient ein Sperrlager in der Produktion?', 'Fehlerhafte Teile gelangen nicht versehentlich in die Montage', ['Gute Teile werden dort bis zum Versand vor Diebstahl geschützt', 'Rohmaterial wartet dort auf die Fertigung', 'Werkzeuge werden dort nach der Schicht eingeschlossen'], 'Im Sperrlager liegen gesperrte Teile getrennt und gekennzeichnet, bis entschieden ist: Nacharbeit, Ausschuss oder Freigabe. Ohne diese Trennung könnten sie zwischen gute Teile geraten.', ['Gesperrt heißt: darf nicht verwendet werden.', 'Es geht um die Trennung von guten Teilen.']],
    ['Ein Behälter mit Teilen steht zwischen zwei Arbeitsplätzen. Was gehört auf seine Kennzeichnung?', 'Teilenummer, Menge und Stand der Bearbeitung', ['Nur der Name der Person, die den Behälter gefüllt hat', 'Nur das Datum der letzten Reinigung', 'Nur die Menge, die Teilenummer kennt jeder'], 'Jeder muss ohne Nachfragen erkennen: Welches Teil ist das, wie viele sind es, und welcher Arbeitsgang ist schon erledigt? So werden Teile nicht verwechselt und kein Arbeitsgang wird ausgelassen.', ['Was muss der nächste Platz über die Teile wissen?', 'Ähnliche Teile dürfen nicht verwechselt werden.']]
  ];
  /* PRUEFEN: Sicherheit an der Vorrichtung vor der Übergabe (Quetschstellen baulich vermeiden, Kanten brechen, Kennzeichnung, Unterweisung am Platz). */
  const SIQ = [
    ['Beim Schließen des Spanners könnte ein Finger zwischen Spannarm und Werkstück geraten. Was tust du vor der Übergabe?', 'Die Stelle so umbauen oder abdecken, dass keine Hand hineingerät', ['Nichts, an Vorrichtungen sind solche Stellen üblich und allen bekannt', 'Dickere Handschuhe an den Platz legen', 'Die Stelle rot anmalen und es dabei belassen'], 'Eine Quetschstelle wird zuerst baulich beseitigt: anders anordnen, Abstand vergrößern oder abdecken. Hinweise und Schutzausrüstung kommen erst danach und ersetzen die bauliche Lösung nicht.', ['Erst die Gefahr beseitigen, dann warnen.', 'Ein Hinweis allein schützt keine Hand.']],
    ['Die neue Vorrichtung hat nach dem Fräsen noch scharfe Kanten. Was gilt vor der Übergabe?', 'Alle Kanten brechen, auch dort, wo man nur hinfasst', ['Nur die Kanten brechen, an denen später das Werkstück anliegt', 'Scharfe Kanten bleiben, sie zeigen die genaue Form', 'Die Kanten mit Klebeband abdecken'], 'An der Vorrichtung wird jeden Tag viele Male gegriffen. Scharfe Kanten und Grate führen zu Schnittverletzungen. Darum werden alle Kanten gebrochen, bevor die Vorrichtung in die Produktion geht.', ['Wie oft am Tag wird die Vorrichtung angefasst?', 'Auch Kanten ohne Funktion können schneiden.']],
    ['Wie kennzeichnest du eine fertige Vorrichtung?', 'Mit ihrer Nummer und dem Teil, für das sie gebaut ist', ['Mit dem Preis der Normteile, die in ihr verbaut worden sind', 'Gar nicht, die Form zeigt den Zweck', 'Mit dem Namen der Maschine, an der sie gefräst wurde'], 'Mit Vorrichtungsnummer und zugehöriger Teilenummer findet jeder die richtige Vorrichtung zum Auftrag. Auch Zeichnung, Stückliste und Wartungshinweis lassen sich so eindeutig zuordnen.', ['Im Regal stehen viele ähnliche Vorrichtungen.', 'Zur Vorrichtung gehören auch Unterlagen.']],
    ['Wer darf mit der neuen Vorrichtung in der Produktion arbeiten?', 'Wer am Platz an der Vorrichtung unterwiesen wurde', ['Jeder, der die Zeichnung der Vorrichtung einmal gesehen hat', 'Nur, wer sie gebaut hat', 'Jeder, sobald die Vorrichtung am Platz steht'], 'Die Bedienenden müssen wissen, wie das Teil eingelegt, gespannt und entnommen wird und wo Gefahren liegen. Das wird am Platz gezeigt und im Übergabeprotokoll festgehalten.', ['Wer bedient, muss Ablauf und Gefahren kennen.', 'Gezeigt wird direkt an der Vorrichtung.']]
  ];
  /* PRUEFEN: Reihenfolgen und Zuordnungen der Rubrik (Arbeitsgänge für die Vorrichtung, fünf Schritte der 5S-Methode, Übergabe, Unterlagen, inneres und äußeres Rüsten). */
  const VPSTEP = ['Zeichnung und Stückliste lesen, Material bereitstellen', 'Grundplatte auf Maß fräsen, Bezugsflächen zuerst', 'Bohrungen bohren, Passbohrungen reiben, Gewinde schneiden', 'Alle Kanten brechen und die Teile reinigen', 'Auflagen, Anschläge und Spanner montieren', 'Funktion mit einem Probeteil prüfen'];
  const S5STEP = ['Aussortieren: Alles Unnötige kommt vom Platz weg', 'Aufräumen: Jedes Ding bekommt einen festen, markierten Platz', 'Säubern: Platz reinigen und dabei Mängel entdecken', 'Standard festlegen: Den guten Zustand als Regel festhalten', 'Standard halten: Regeln einhalten und regelmäßig prüfen'];
  const UEBSTEP = ['Vorrichtung prüfen: Funktion, scharfe Kanten, Quetschstellen', 'Probeteile mit der Vorrichtung fertigen', 'Probeteile messen und Ergebnis festhalten', 'Bedienende am Platz unterweisen', 'Übergabeprotokoll gemeinsam unterschreiben'];
  const VBROW = [['Drei gehärtete Auflagebolzen unter dem Werkstück', 0], ['Fester Anschlagstift an der Stirnseite', 0], ['Kniehebelspanner, der von oben auf das Werkstück drückt', 1], ['Spannschraube mit Sterngriff gegenüber dem Anschlag', 1], ['Gehärtete Buchse in der Platte über der Bohrstelle', 2], ['Schräge, offene Aussparung unter der Bohrstelle', 3]];
  const VBOPT = ['Lage bestimmen', 'Werkstück spannen', 'Werkzeug führen', 'Späne abführen'];
  const ULROW = [['Welches Maß hat der Auflagebolzen?', 0], ['Wo sitzen die Bohrungen für die Passstifte?', 0], ['Welche Normteile müssen bestellt werden?', 1], ['Wie viele Zylinderstifte werden für den Nachbau gebraucht?', 1], ['Wie oft werden die Gelenke der Spanner geölt?', 2], ['Wann werden die Bohrbuchsen auf Verschleiß geprüft?', 2], ['Wer hat die Vorrichtung wann abgenommen?', 3], ['Welche Mängel wurden bei der Abnahme festgehalten?', 3]];
  const ULOPT = ['Zeichnung', 'Stückliste', 'Wartungshinweis', 'Übergabeprotokoll'];
  const RUROW = [['Werkzeuge für den nächsten Auftrag bereitlegen', 0], ['Zeichnung und Prüfmittel für den nächsten Auftrag holen', 0], ['Ausgebaute Vorrichtung reinigen und ins Regal bringen', 0], ['Nächste Vorrichtung an die Maschine fahren', 0], ['Vorrichtung auf dem Maschinentisch wechseln', 1], ['Werkzeug in der Spindel wechseln', 1], ['Anschlag am Maschinentisch neu einstellen', 1], ['Neue Vorrichtung auf dem Maschinentisch ausrichten', 1]];
  const RUOPT = ['Äußeres Rüsten: geht, während die Maschine läuft', 'Inneres Rüsten: geht nur, wenn die Maschine steht'];
  const STNAME = ['Werkstück klemmt beim Entnehmen', 'Spanner löst sich', 'Späne auf der Auflage', 'Bohrbuchse sitzt locker', 'Anschlag verstellt sich'];
  const PMNAME = [['Stahlmaßstab', 'Mit dem Stahlmaßstab', 0.5], ['Messschieber', 'Mit dem Messschieber', 0.05], ['Bügelmessschraube', 'Mit der Bügelmessschraube', 0.01], ['Feinzeiger', 'Mit dem Feinzeiger', 0.001]];

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator */
  const defs = [
    [CATS[0], 1, 'Hauptgruppen zuordnen', 'verfgrp'], [CATS[0], 1, 'Was geschieht mit dem Werkstück?', 'zush'], [CATS[0], 2, 'Verfahren einordnen', 'verfmatch'], [CATS[0], 2, 'Vorgang erkennen', 'vorgang'], [CATS[0], 3, 'Teil mit mehreren Verfahren', 'kette'],
    [CATS[1], 1, 'Kernloch für Gewinde', 'kern'], [CATS[1], 1, 'Anreißen und Körnen', 'hwz'], [CATS[1], 2, 'Sägen und Feilen', 'saege'], [CATS[1], 2, 'Loch für die Schraube', 'loch'], [CATS[1], 2, 'Vorbohren zum Reiben', 'reib'], [CATS[1], 2, 'Gewinde von Hand', 'gewschr'], [CATS[1], 3, 'Gewinde im Sackloch', 'sackloch'],
    [CATS[2], 1, 'Dehnen und Stauchen', 'neutral'], [CATS[2], 2, 'Bogen der neutralen Faser', 'bogen'], [CATS[2], 2, 'Zuschnitt für den Winkel', 'gestrW'], [CATS[2], 2, 'Biegen und Richten', 'biegepool'], [CATS[2], 3, 'Zuschnitt für das U-Profil', 'gestrU'],
    [CATS[3], 1, 'Rohteil mit Zugabe', 'zugabe'], [CATS[3], 1, 'Teile aus der Stange', 'stange'], [CATS[3], 2, 'Ausnutzung der Tafel', 'ausn'], [CATS[3], 2, 'Masse der Platine', 'masse'], [CATS[3], 2, 'Zeit je Einheit', 'te'], [CATS[3], 2, 'Auftragszeit', 'auftrag'], [CATS[3], 2, 'Arbeitsplan', 'plan'], [CATS[3], 3, 'Kosten je Stück', 'kosten'], [CATS[3], 3, 'Zwei Verfahren im Vergleich', 'breakeven'],
    [CATS[4], 1, 'Mittelwert', 'mittel'], [CATS[4], 1, 'Strichliste lesen', 'strich'], [CATS[4], 2, 'Streuung der Messwerte', 'sdev'], [CATS[4], 2, 'Fehleranteil', 'anteil'], [CATS[4], 2, 'Prüfplan und Fehlerarten', 'prueff'], [CATS[4], 3, 'Prozess und Toleranz', 'cp'], [CATS[4], 3, 'Lage und Toleranz', 'cpk'], [CATS[4], 3, 'Qualitätsregelkarte lesen', 'regelkarte'],
    [CATS[5], 1, 'Freiheitsgrade', 'fg'], [CATS[5], 2, 'Punkte setzen', 'dreizwei'], [CATS[5], 2, 'Spannen und Auflegen', 'spannen'],
    [CATS[6], 2, 'Fehlerbild A', 'fsa'], [CATS[6], 3, 'Fehlerbild B', 'fsb'], [CATS[6], 3, 'Fehlerbild C', 'fsc'],
    [CATS[7], 1, 'Bolzen für das Außengewinde', 'bolzen'], [CATS[7], 1, 'Außengewinde schneiden', 'agw'], [CATS[7], 2, 'Außengewinde von Hand', 'agwfolge'], [CATS[7], 1, 'Lochreihe anreißen', 'lochreihe'], [CATS[7], 2, 'Bohrungen mittig anreißen', 'mittig'], [CATS[7], 1, 'Teilung auf dem Lochkreis', 'teilwinkel'], [CATS[7], 2, 'Sehne auf dem Lochkreis', 'sehne'], [CATS[7], 1, 'Entgraten', 'entgrat'], [CATS[7], 2, 'Tiefe der Senkung', 'senktiefe'], [CATS[7], 1, 'Werkzeug vor der Arbeit prüfen', 'hwzustand'],
    [CATS[8], 2, 'Bauteile einer Bohrvorrichtung', 'pvbauteile'], [CATS[8], 2, 'Bestimmen ohne Zwang', 'pvzwang'], [CATS[8], 3, 'Aufnahme in zwei Bohrungen', 'pvaufnahme'], [CATS[8], 3, 'Spannkraft gegen Schnittkraft', 'pvspannkraft'], [CATS[8], 2, 'Kniehebelspanner', 'pvknie'], [CATS[8], 2, 'Bohrbuchsen und Verschleißteile', 'pvbuchse'], [CATS[8], 2, 'Späne und Sauberkeit', 'pvspaene'], [CATS[8], 2, 'Verwechslungsschutz', 'pvpoka'], [CATS[8], 2, 'Vom Rohteil zur Vorrichtung', 'pvplan'], [CATS[8], 2, 'Losgröße und Rüstanteil', 'pvlos'], [CATS[8], 2, 'Taktzeit am Montageplatz', 'pvtakt'], [CATS[8], 2, 'Verkettete Arbeitsplätze', 'pvengpass'], [CATS[8], 3, 'Lohnt sich die Vorrichtung?', 'pvlohnt'], [CATS[8], 2, 'Erstteil und Freigabe', 'pverstteil'], [CATS[8], 2, 'Prüfmittel wählen', 'pvpruefmittel'], [CATS[8], 2, 'Spannweite der Messreihe', 'pvspannweite'], [CATS[8], 3, 'Lage zur Toleranzmitte', 'pvlage'], [CATS[8], 2, 'Ausschuss und Nacharbeit zählen', 'pvausschuss'], [CATS[8], 3, 'Das Maß wandert', 'pvtrend'], [CATS[8], 2, 'Ordnung am Arbeitsplatz', 'pv5s'], [CATS[8], 2, 'Greifraum und Arbeitshöhe', 'pvergo'], [CATS[8], 2, 'Materialfluss und Sperrlager', 'pvfluss'], [CATS[8], 2, 'Übergabe an die Produktion', 'pvuebergabe'], [CATS[8], 2, 'Sicherheit an der Vorrichtung', 'pvsicher'], [CATS[8], 2, 'Unterlagen zur Vorrichtung', 'pvunterlagen'], [CATS[8], 2, 'Rüsten: innen oder außen', 'pvruestart'], [CATS[8], 3, 'Störungen auswerten', 'pvstoerung'], [CATS[8], 3, 'Rüstzeit verkürzen', 'pvruestspar']
  ];
  const tasks = defs.map((d, i) => ({ id: 'fer' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('fer-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Auswertung (rein, ohne DOM) ---------- */
  function evaluate(q, a) {
    const c = C(), as = q.ask; a = a || {};
    if (as.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === as.correct, given: as.choices[a.c] }; }
    if (as.type === 'num') { const v = c.parseDe(a.v); if (!Number.isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 3) + (as.unit ? ' ' + as.unit : '') }; }
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
    if (as.type === 'num') return f(q.value, 3) + (as.unit ? ' ' + as.unit : '');
    if (as.type === 'order') return as.correct.map(i => as.items[i]).join(' → ');
    return as.rows.map((r, i) => r + ' → ' + as.options[as.correct[i]]).join('; ');
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus FER_CORE) ---------- */
  const examples = [
    { id: 'ver1', tab: 'ver', title: 'Fügen: Schrauben, Löten, Kleben', text: 'Hauptgruppe 4 auf der Landkarte: Was gehört dazu, und warum zählt das Beschichten nicht dazu, obwohl beide den Zusammenhalt vermehren?', p: { g: 4 } },
    { id: 'ver2', tab: 'ver', title: 'Trennen: Sägen, Feilen, Bohren, Gewindeschneiden', text: 'Die Hauptgruppe der Handfertigung. Was verbindet alle vier Verfahren?', p: { g: 3 } },
    { id: 'bie1', tab: 'bie', title: 'Blechwinkel 60 × 40 mm', text: 'Blech 3 mm, Innenradius 3 mm, Außenmaße 60 und 40 mm. Wie lang ist der Zuschnitt, und warum ist er kürzer als die Summe der Außenmaße?', p: { mode: 'out', s: '3', r: '3', a: '60', b: '40', c: '' } },
    { id: 'bie2', tab: 'bie', title: 'U-Profil 25 × 50 × 25 mm', text: 'Zwei Biegungen: Blech 2 mm, Innenradius 2 mm. Jede Biegung bringt einen Ausgleichswert.', p: { mode: 'out', s: '2', r: '2', a: '25', b: '50', c: '25' } },
    { id: 'bie3', tab: 'bie', title: 'Biegung mit 60° und geraden Schenkeln', text: 'Zwei gerade Schenkel von 40 und 30 mm, Biegewinkel 60°, Blech 2,5 mm, Radius 5 mm.', p: { mode: 'gerade', s: '2,5', r: '5', l1: '40', l2: '30', al: '60' } },
    { id: 'gew1', tab: 'gew', title: 'Gewinde M8 von Hand', text: 'Kernloch, Steigung und die Schritte vom Bohren bis zum Fertigschneider.', p: { d: '8', T: '', D: '10' } },
    { id: 'gew2', tab: 'gew', title: 'Sackloch M10', text: 'Gewindetiefe 15 mm, dazu der Auslauf für den Gewindebohrer: Wie tief muss das Kernloch sein?', p: { d: '10', T: '15', D: '10' } },
    { id: 'pla1', tab: 'pla', title: 'Teile aus der Stange', text: 'Aus 3 000 mm Stange werden 85-mm-Teile gesägt. Jeder Schnitt kostet 3 mm. Wie viele Teile, wie viel Rest?', p: { view: 'stange', L: '3000', l: '85', k: '3' } },
    { id: 'pla2', tab: 'pla', title: 'Platinen aus der Blechtafel', text: 'Eine Tafel 1 000 × 2 000 mm, Platinen 180 × 250 mm. Wie viele passen, und wie hoch ist die Ausnutzung?', p: { view: 'tafel', W: '1000', H: '2000', w: '180', h: '250', e: '10', rr: '10' } },
    { id: 'pla3', tab: 'pla', title: 'Stückzeit und Kosten bei 25 Stück', text: 'Rüstzeit 45 min, Hauptzeit 6 min, Nebenzeit 2 min, Zuschläge 5 % und 10 %, Stundensatz 60 €. Was kostet ein Stück?', p: { view: 'kosten', th: '6', tn: '2', zE: '5', zV: '10', tr: '45', m: '25', satz: '60', matk: '2,40' } },
    { id: 'pla4', tab: 'pla', title: 'Hand oder Vorrichtung: ab wann lohnt es sich?', text: 'Verfahren A: kaum Rüsten, aber teuer je Stück. Verfahren B: Rüsten kostet mehr, jedes Stück ist günstiger.', p: { view: 'vergleich', kr1: '30', kv1: '4', kr2: '180', kv2: '2,5' } },
    { id: 'qua1', tab: 'qua', title: 'Prozess mittig und fähig', text: 'Ein Maß 20 ± 0,1 mm: Die Messwerte streuen wenig um die Mitte. Cp und Cpk liegen nahe beieinander.', p: { set: 'gut', ugw: '19,9', ogw: '20,1' } },
    { id: 'qua2', tab: 'qua', title: 'Streuung klein, aber außermittig', text: 'Die Werte liegen eng beieinander, aber nahe der oberen Grenze. Cp ist gut, Cpk deutlich schlechter.', p: { set: 'lage', ugw: '19,9', ogw: '20,1' } },
    { id: 'qua3', tab: 'qua', title: 'Werkzeugverschleiß als Trend', text: 'Die Werte wandern Stück für Stück nach oben. Die Regelkarte zeigt es früh, bevor Ausschuss entsteht.', p: { set: 'trend', ugw: '19,9', ogw: '20,1' } },
    { id: 'vor1', tab: 'vor', title: '3-2-1: Quader vollständig bestimmt', text: 'Drei Punkte unten, zwei an der Seite, einer am Anschlag. Welche Freiheitsgrade sind gesperrt?', p: { a: 3, b: 2, c: 1 } },
    { id: 'vor2', tab: 'vor', title: 'Vier Punkte: überbestimmt', text: 'Ein vierter Punkt auf der Hauptauflage: Das Teil kippelt.', p: { a: 4, b: 2, c: 1 } }
  ];

  /* Beispiel-Messreihen für den Qualitäts-Reiter (24 Werte, Sollmaß 20 mm) */
  function sampleSet(kind) {
    const c = C(), R = c.rng('fer-sample-' + kind), out = [];
    for (let i = 0; i < 24; i++) {
      const z = Math.max(-1.6, Math.min(1.6, c.gauss(R)));
      let v;
      if (kind === 'gut') v = 20 + z * 0.018;
      else if (kind === 'lage') v = 20.065 + z * 0.014;
      else if (kind === 'streu') v = 20 + z * 0.05;
      else v = i < 10 ? 20 + z * 0.012 : 20 + (i - 9) * 0.002 + z * 0.0003;
      out.push(c.rd(v, 4));
    }
    return out;
  }

  root.FER_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sampleSet, seriesFor, evaluate, solAns, wrongAns, solText, KARTE, RULES_TXT, pools: { HWQ, SAQ, NEQ, BIQ, PQ, SPQ, VORG, CHAINS, PLANS } };
  root.FER_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.FER_DATA, TASKS: root.FER_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
