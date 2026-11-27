'use strict';
/* Tonfunk Löt-Lab: Daten (Aufgaben-Generatoren, Fehlerbilder).
   ALLE Zahlen (Temperaturen, Zeiten, Schwellen, Raten, Kosten) sind ÜBUNGSWERTE bzw. Richtwerte für die Ausbildung. Verbindlich sind Lötanweisung, Datenblätter und die Vorgaben der Prüfung.
   window.LOT_DATA  { cats, tasks, gens, make, makeTask, randomQ, defects, pools }
   window.LOT_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'lot', Status in localStorage 'lm4.lot.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id); der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage trägt q.how: die erwarteten Schritte ("So gehst du vor"). Titel bleiben neutral, ohne Zahlen und ohne Ergebnis.
   Beurteilung nach allgemein bekanntem Fachwissen in eigenen Worten (z. B. Klassen und Zielzustand nach der Art von IPC-A-610); die Normtexte werden weder zitiert noch nachgebaut. */
(function (root) {
  const C = () => root.LOT_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Lötprozess und Werkstoffe', 'Durchsteck-Lötstellen beurteilen', 'SMD und Reflow', 'Klassen und Qualität', 'ESD und Arbeitsschutz', 'Nacharbeit und Entlöten'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  /* Pool-Eintrag: [Text, richtig, falsch[3], Erklärung, Tipp 1, Tipp 2] */
  const pq = POOL => R => { const q = POOL[C().ri(R, 0, POOL.length - 1)]; return choiceQ(R, q[0], q[1], q[2], q[3], [q[4], q[5]]); };

  /* ---------- Fehlerbilder (Reiter Fehlerbilder, Aufgabe "Fehlerbild benennen") ---------- */
  /* k = Kennung, seite = Durchsteck (tht) oder SMD, lvl = Beurteilungsstufe, merk = was du siehst, urs = Ursache, abh = was hilft */
  const DEFECTS = [
    { k: 'ziel', n: 'Gute Lötstelle', seite: 'tht', lvl: 'ziel', merk: 'Glatte, glänzende bis seidenmatte Oberfläche. Die Hohlkehle ist nach innen gewölbt und reicht gleichmäßig vom Anschluss bis zum Rand des Lötauges. Die Hülse ist gefüllt.', urs: 'Passende Temperatur, wenige Sekunden Wärme, genug Flussmittel, richtige Lotmenge.', abh: 'Nichts. So soll es aussehen.' },
    { k: 'wenig', n: 'Zu wenig Lot', seite: 'tht', lvl: 'fehler', merk: 'Die Hohlkehle ist sehr flach und reicht nicht bis zur Anschlussspitze. Am Rand des Lötauges ist blankes Kupfer zu sehen, die Hülse ist nur teilweise gefüllt.', urs: 'Zu kurz Lot zugeführt oder zu früh die Spitze weggenommen.', abh: 'Mit Flussmittel und etwas Lot nachlöten.' },
    { k: 'viel', n: 'Zu viel Lot', seite: 'tht', lvl: 'fehler', merk: 'Ein dicker, kugelförmiger Klumpen: Der Anschluss ist nicht mehr zu erkennen, die Oberfläche ist nach außen gewölbt.', urs: 'Zu lange Lot zugeführt. Die Menge richtet sich nicht nach der Zeit, sondern nach dem Bedarf.', abh: 'Überschüssiges Lot mit der heißen Spitze oder Entlötlitze abziehen.' },
    { k: 'kalt', n: 'Kalte Lötstelle', seite: 'tht', lvl: 'fehler', merk: 'Matte, raue, körnige Oberfläche, die zerklüftet wirkt. Der Rand ist unscharf, die Lötstelle sieht aus wie festgeklebt.', urs: 'Zu wenig Wärme oder der Anschluss wurde bewegt, während das Lot erstarrte.', abh: 'Neu erwärmen, etwas frisches Lot und Flussmittel zugeben, dann in Ruhe erstarren lassen.' },
    { k: 'benetzt', n: 'Schlecht benetzt', seite: 'tht', lvl: 'fehler', merk: 'Das Lot steht als Tropfen oder Kugel auf Anschluss und Lötauge und berührt sie in einem steilen Winkel (über 90°). Am Rand ist Kupfer frei.', urs: 'Oxidiertes oder verschmutztes Metall, fehlendes oder verbranntes Flussmittel.', abh: 'Flächen reinigen, frisches Flussmittel auftragen und neu löten.' },
    { k: 'bruecke', n: 'Lötbrücke', seite: 'tht', lvl: 'fehler', merk: 'Zwischen zwei benachbarten Lötstellen hängt Lot und verbindet sie leitend.', urs: 'Zu viel Lot, zu große Spitze oder die Spitze wurde nicht sauber abgezogen.', abh: 'Mit Flussmittel und Entlötlitze oder frisch verzinnter Spitze das Lot abziehen.' },
    { k: 'lunker', n: 'Lunker', seite: 'tht', lvl: 'prozess', merk: 'Kleine Löcher oder Blasen in der Lötstelle, an der Oberfläche als Krater sichtbar oder im Röntgenbild als Hohlräume.', urs: 'Gase oder Flussmittel konnten beim Erstarren nicht entweichen.', abh: 'Kurz neu aufschmelzen, damit Gase entweichen, und Ursache im Prozess suchen.' },
    { k: 'ueberhitzt', n: 'Überhitzt', seite: 'tht', lvl: 'prozess', merk: 'Dunkle, verbrannte Flussmittelreste, stumpfe braune Oberfläche, das Lötauge kann sich ablösen.', urs: 'Zu lange oder zu heiß gelötet.', abh: 'Temperatur und Zeit senken, Lötstelle neu löten und prüfen.' },
    { k: 'perle', n: 'Lotkugeln', seite: 'tht', lvl: 'prozess', merk: 'Kleine Lotkügelchen liegen neben der Lötstelle auf der Platine.', urs: 'Spritzendes Flussmittel durch zu schnelles Aufheizen oder Feuchtigkeit.', abh: 'Entfernen und die Ursache abstellen (gleichmäßiger erwärmen, trockene Paste und Platine). Lose Kugeln oder Kugeln, die den Abstand zwischen Leitern verkleinern, sind ein Fehler.' },
    { k: 'smdziel', n: 'Gute SMD-Lötstelle', seite: 'smd', lvl: 'ziel', merk: 'An beiden Enden des Chips steigt das Lot in einer glatten, nach innen gewölbten Hohlkehle am Anschluss hoch. Das Bauteil liegt flach auf.', urs: 'Gleichmäßige Erwärmung, passende Pastenmenge, sauberes Profil.', abh: 'Nichts. So soll es aussehen.' },
    { k: 'grabstein', n: 'Grabstein', seite: 'smd', lvl: 'fehler', merk: 'Der Chip steht an einem Ende senkrecht oder schräg, nur ein Anschluss ist verlötet. Das andere Ende hängt in der Luft.', urs: 'Ein Pad schmilzt zuerst und zieht das Bauteil hoch: ungleiche Erwärmung, ungleiche Pastenmenge oder Pads.', abh: 'Aufheizrate senken, Pads und Paste gleichmäßig auslegen, Bauteil von Hand neu setzen.' },
    { k: 'smdbruecke', n: 'Brücke am IC', seite: 'smd', lvl: 'fehler', merk: 'Zwischen zwei eng benachbarten Anschlüssen eines ICs liegt Lot und schließt sie kurz.', urs: 'Zu viel Paste, Bauteil verrutscht oder zu lange flüssig.', abh: 'Mit Flussmittel und Entlötlitze oder Schleppen entfernen.' }
  ];
  const FB6 = ['kalt', 'wenig', 'viel', 'bruecke', 'benetzt', 'lunker'].map(k => DEFECTS.find(d => d.k === k));

  /* ---------- Fragen-Pools ---------- */
  /* PRUEFEN L3: Zeitangabe "2 bis 4 Sekunden" und Spitzentemperatur "etwa 350 °C" sind Richtwerte für das Handlöten bleifreier Durchsteck-Lötstellen. Passt das zu euren Lötanweisungen? */
  const GRQ = [
    ['Was passiert beim Weichlöten mit Lot und Anschluss?', 'Das Lot schmilzt und verbindet sich mit den Metalloberflächen, die Anschlüsse selbst bleiben fest', ['Anschluss und Lot schmelzen zu einem Stück wie beim Schweißen', 'Das Lot klebt nur auf der Oberfläche wie ein Leim', 'Das Lot löst den Anschluss auf'], 'Beim Weichlöten schmilzt nur das Lot. Es benetzt die erwärmten Flächen und bildet an der Grenze eine dünne Zwischenschicht. Die Anschlüsse bleiben fest.', 'Schmilzt der Anschluss mit?', 'Es geht um Benetzen, nicht um Schweißen.'],
    ['Wie heißt die dünne Schicht, die sich beim Löten zwischen Lot und Kupfer bildet und die Verbindung ausmacht?', 'Intermetallische Phase (aus Zinn und Kupfer)', ['Oxidschicht', 'Lackschicht', 'Isolierschicht'], 'Zinn und Kupfer verbinden sich an der Grenze zu einer dünnen intermetallischen Schicht. Ist sie zu dünn, hält das Lot nicht, ist sie zu dick, wird sie spröde.', 'Zwei Metalle bilden eine Verbindung.', 'Die Oxidschicht verhindert das Löten, sie bildet es nicht.'],
    ['Was ist das Lötauge (Pad) auf der Leiterplatte?', 'Die Kupferfläche, an der Anschluss und Lot verbunden werden', ['Die Lötstopplack-Schicht, die das Lot abweist', 'Das Loch für den Anschluss ohne Kupfer', 'Die Beschriftung des Bauteils'], 'Das Lötauge ist die lötbare Kupferfläche. Rundherum deckt Lötstopplack die Leiterbahnen ab, damit das Lot nur dort bleibt, wo es hin soll.', 'Wo hält das Lot?', 'Der Lack weist Lot ab.'],
    ['Wie lange dauert das Erwärmen und Löten einer normalen Durchsteck-Lötstelle von Hand etwa?', 'Etwa 2 bis 4 Sekunden', ['Unter einer halben Sekunde', 'Etwa 20 bis 30 Sekunden', 'Mehrere Minuten'], 'Mit passender Spitze genügen wenige Sekunden. Viel länger belastet Lötauge und Bauteil, viel kürzer fließt das Lot nicht richtig.', 'Es ist kurz, aber nicht blitzschnell.', 'Dein Lehrer hat dir die Zeit sicher in Sekunden genannt.'],
    ['Warum berührst du Lötauge und Anschluss gleichzeitig mit der Spitze?', 'Beide müssen gleichzeitig heiß werden, damit das Lot an beide fließt', ['Damit die Spitze sauber bleibt', 'Damit weniger Lot gebraucht wird', 'Damit das Flussmittel kalt bleibt'], 'Das Lot fließt nur auf heiße, saubere Metallflächen. Wird nur eine Seite warm, benetzt das Lot nur dort.', 'Was braucht das Lot, um zu fließen?', 'Zwei Flächen, zwei heiße Flächen.'],
    ['Du hältst den Lötdraht nur an die Spitze und streichst das Lot dann an die Stelle. Was ist das Problem?', 'Das Flussmittel verbrennt an der Spitze, bevor das Lot an der Lötstelle ist', ['Das Lot wird zu kalt', 'Der Draht wird zu dick', 'Nichts, so wird es sonst auch gemacht'], 'Das Lot soll an der erwärmten Stelle schmelzen, damit das Flussmittel dort wirkt und das Oxid löst. An der Spitze allein verbrennt es nutzlos.', 'Wo soll das Flussmittel wirken?', 'Lot an die erwärmte Stelle führen.']
  ];
  const FLQ = [
    ['Wozu dient das Flussmittel beim Löten?', 'Es löst Oxid und hält die Fläche sauber, damit das Lot benetzt', ['Es senkt die Schmelztemperatur der Platine', 'Es isoliert die Lötstelle elektrisch', 'Es ersetzt das Lot'], 'Metalle haben an der Luft eine hauchdünne Oxidschicht. Das Flussmittel löst sie bei Wärme und schützt die Fläche, bis das Lot sie benetzt.', 'Was liegt auf blankem Metall an der Luft?', 'Flussmittel macht die Fläche lötbar.'],
    ['Elektronik-Lötdraht hat oft einen Hohlraum in der Mitte. Was steckt darin?', 'Flussmittel', ['Kupfer', 'Blei', 'Wasser'], 'Die Seele des Lötdrahts enthält Flussmittel. Es kommt beim Schmelzen genau dort an, wo das Lot hinfließt.', 'Was braucht jede Lötstelle zusätzlich zum Lot?', 'Es steckt im Draht.'],
    ['Das Lot perlt an einem Anschluss ab und bleibt als Kugel liegen. Was ist die wahrscheinlichste Ursache?', 'Die Fläche ist oxidiert oder verschmutzt oder das Flussmittel ist verbrannt', ['Die Platine ist zu dünn', 'Der Draht ist zu lang', 'Die Spitze ist zu sauber'], 'Ohne wirksames Flussmittel auf einer oxidierten Fläche benetzt das Lot nicht. Es zieht sich zur Kugel zusammen.', 'Wann benetzt Lot nicht?', 'Denke an die Oberfläche.'],
    ['Warum soll das Flussmittel nicht lange auf der heißen Spitze brennen?', 'Verbranntes Flussmittel wirkt nicht mehr und hinterlässt dunkle Rückstände', ['Es wird dann zu flüssig', 'Es löst die Spitze auf', 'Es wird elektrisch leitend'], 'Flussmittel hat eine begrenzte Wirkzeit. Nach dem Verbrennen löst es kein Oxid mehr, und die Reste verfärben die Lötstelle.', 'Was bleibt vom Flussmittel nach dem Verbrennen?', 'Es hat nur wenige Sekunden Wirkzeit.'],
    ['Was bedeutet "No-Clean" bei einem Flussmittel?', 'Die Rückstände dürfen nach dem Löten meist auf der Baugruppe bleiben', ['Das Flussmittel braucht keine Wärme', 'Das Flussmittel entfernt sich selbst vollständig', 'Es darf nur in Reinräumen benutzt werden'], 'No-Clean-Flussmittel hinterlassen wenige, harmlose Reste. Ob gereinigt werden muss, regelt die Fertigungsvorgabe.', 'Clean heißt rein, reinigen.', 'Es geht um die Reste.'],
    ['Warum lässt sich angelaufenes (dunkles) Kupfer schwer löten?', 'Auf der Oxidschicht benetzt das Lot nicht', ['Kupfer schmilzt dann früher', 'Das Lot wird dann zu dünn', 'Das Kupfer leitet dann nicht mehr'], 'Die Oxidschicht liegt zwischen Metall und Lot. Erst Flussmittel oder mechanisches Reinigen macht die Fläche wieder lötbar.', 'Was liegt zwischen Kupfer und Lot?', 'Die dunkle Schicht ist Oxid.']
  ];
  /* PRUEFEN L4: bleifrei ca. 217 °C, bleihaltig ca. 183 °C, die Aussage "bleifrei meist matter" und die Beschränkung durch RoHS (nur genannt, nicht erklärt). Stimmt das für eure Lote? */
  const BFQ = [
    ['Warum werden in der Elektronik heute meist bleifreie Lote benutzt?', 'Vorschriften zur Beschränkung gefährlicher Stoffe (RoHS) verlangen das für die meisten Geräte', ['Bleifreies Lot schmilzt niedriger und ist einfacher', 'Bleifreies Lot leitet viel besser', 'Bleihaltiges Lot ist nicht mehr herstellbar'], 'Die RoHS-Vorgaben begrenzen Blei in den meisten Elektrogeräten. Bleifreie Lote sind dafür schwieriger zu verarbeiten.', 'Es geht um Vorschriften.', 'Ist bleifrei einfacher oder schwieriger zu löten?'],
    ['Wie unterscheiden sich bleifreies (SnAgCu) und bleihaltiges (SnPb) Lot in der Schmelztemperatur?', 'Bleifreies Lot schmilzt höher (etwa 217 °C gegenüber etwa 183 °C)', ['Bleifreies Lot schmilzt niedriger', 'Beide schmelzen bei etwa 100 °C', 'Es gibt keinen Unterschied'], 'SnAgCu schmilzt bei etwa 217 °C, SnPb bei etwa 183 °C. Deshalb braucht bleifreies Löten mehr Wärme.', 'Welches ist schwerer zu löten?', 'Die Zahlen stehen in der Hilfe.'],
    ['Was folgt aus der höheren Schmelztemperatur beim Handlöten mit bleifreiem Lot?', 'Mehr Wärme nötig, das Flussmittel wird stärker belastet', ['Weniger Flussmittel nötig', 'Kürzere Lötspitzen nötig', 'Es folgt nichts'], 'Die Spitze muss heißer sein oder länger wärmen, und das Flussmittel hat weniger Reserve. Gute Spitzen und passende Flussmittel gleichen das aus.', 'Höher heißt mehr Wärme.', 'Was verbrennt zuerst?'],
    ['Wie vermeidest du in der Werkstatt, dass bleifreies und bleihaltiges Lot vermischt werden?', 'Getrennte, gekennzeichnete Lötspitzen, Lötdrähte und Entlöt-Werkzeuge', ['Nur eine Sorte gleichzeitig auf einen Tisch legen', 'Die Lote gut miteinander mischen', 'Mit derselben Spitze nacheinander arbeiten'], 'Mischlot kann hohe Schmelzbereiche und spröde Gefüge bilden. Deshalb arbeitet man mit getrennten und beschrifteten Werkzeugen.', 'Wie hält man Dinge sauber getrennt?', 'Kennzeichnen.'],
    ['Wie erkennst du bleifreie Lötstellen oft im Vergleich zu bleihaltigen?', 'Sie sind meist matter und etwas rauer, auch wenn sie in Ordnung sind', ['Sie sind immer spiegelblank', 'Sie sind schwarz', 'Sie sind immer rissig'], 'Bleifreie Lote erstarren oft seidenmatt oder leicht körnig. Das allein ist kein Fehler: Form und Benetzung zählen.', 'Glanz ist nicht alles.', 'Es geht um das Aussehen.']
  ];
  const URQ = [
    ['Du erhöhst die Spitzentemperatur von 350 °C auf 420 °C, damit es schneller geht. Was ist die wahrscheinlichste Folge?', 'Das Flussmittel verbrennt schneller, Lötauge und Bauteil werden stärker belastet', ['Die Lötstelle wird automatisch besser', 'Das Lot schmilzt erst bei höherer Temperatur', 'Es ändert sich nichts'], 'Zu viel Temperatur verkürzt die Wirkzeit des Flussmittels und belastet Lötauge und Bauteil. Besser ist mehr Wärme durch gute Spitze und Kontakt.', 'Mehr Hitze heißt mehr Belastung.', 'Wo verbrennt das Flussmittel?'],
    ['Das Lötauge hängt an einer großen Massefläche und wird kaum warm. Was hilft am besten?', 'Größere Spitze oder mehr Leistung, gegebenenfalls Platine vorwärmen', ['Weniger Lot nehmen', 'Flussmittel weglassen', 'Kürzer löten'], 'Eine große Kupferfläche leitet die Wärme ab. Dann braucht man mehr Leistung, eine größere Spitze oder Vorwärmen, damit das Lötauge die Fließtemperatur erreicht.', 'Wohin geht die Wärme?', 'Mehr Wärme ins Lötauge bringen.'],
    ['Du bewegst den Anschluss, solange das Lot noch flüssig ist. Was droht?', 'Eine gestörte Lötstelle mit matter, rauer Oberfläche und schwacher Verbindung', ['Eine besonders feste Lötstelle', 'Eine Lötbrücke', 'Nichts, das Lot schließt sich wieder'], 'Wird das erstarrende Lot bewegt, bilden sich Risse und eine raue Oberfläche. Der Anschluss muss bis zum Erstarren ruhig bleiben.', 'Wann ist das Lot fest?', 'Ruhig halten.'],
    ['Wie viel Lot gehört an eine Durchsteck-Lötstelle?', 'So viel, dass sich eine glatte Hohlkehle um den Anschluss bildet und die Hülse gefüllt ist', ['So viel wie möglich, damit es hält', 'Nur ein winziger Tropfen auf der Spitze', 'So viel, dass das Lötauge ganz verdeckt ist'], 'Die richtige Menge zeigt sich an der Form: Hohlkehle bis nahe an die Anschlussspitze, Hülse gefüllt, Anschluss noch erkennbar.', 'Woran siehst du die richtige Menge?', 'Form, nicht Gewicht.'],
    ['Die Lötspitze ist dunkel und das Lot perlt von ihr ab. Was tust du?', 'Spitze reinigen (feuchter Schwamm oder Messingwolle) und neu verzinnen', ['Temperatur erhöhen und weiterlöten', 'Die Spitze trocken lassen', 'Mehr Druck auf die Lötstelle ausüben'], 'Eine oxidierte Spitze überträgt kaum Wärme. Reinigen und frisch verzinnen macht sie wieder benetzbar.', 'Was liegt auf der Spitze?', 'Reinigen kommt vor dem Verzinnen.']
  ];
  const MEQ = [
    ['Wie sieht eine gute Durchsteck-Lötstelle aus?', 'Glatt, glänzend bis seidenmatt, mit nach innen gewölbter Hohlkehle vom Anschluss zum Lötauge', ['Kugelförmig, stark nach außen gewölbt', 'Matt, rau und körnig', 'Das Lötauge ist ganz verdeckt, der Anschluss nicht mehr zu sehen'], 'Eine gute Lötstelle hat einen glatten, konkaven Meniskus. Der Anschluss bleibt erkennbar und das Lot läuft flach auf das Lötauge aus.', 'Wie sieht ein Wassertropfen auf einem benetzten Glas aus?', 'Konkav heißt nach innen gewölbt.'],
    ['Was bedeutet "konkav" bei der Hohlkehle?', 'Die Oberfläche ist nach innen gewölbt wie eine Schale', ['Die Oberfläche ist nach außen gewölbt wie eine Kugel', 'Die Oberfläche ist gerade wie ein Kegel', 'Die Oberfläche ist zackig'], 'Konkav ist das Gegenteil von konvex. Eine gute Hohlkehle sinkt zur Mitte ein.', 'Denke an eine Schale.', 'Das Gegenteil heißt konvex.'],
    ['Die Lötstelle ist ein nach außen gewölbter Klumpen, der Anschluss ist nicht zu erkennen. Was liegt vor?', 'Zu viel Lot oder schlechte Benetzung', ['Eine ideale Lötstelle', 'Eine zu kalte Spitze, aber sonst alles in Ordnung', 'Ein Lunker'], 'Ein Klumpen ohne Hohlkehle entsteht bei zu viel Lot oder wenn das Lot nicht fließt. In beiden Fällen ist der Winkel groß.', 'Ist eine Wölbung nach außen gut?', 'Der Anschluss soll sichtbar bleiben.'],
    ['Was sagt ein kleiner Benetzungswinkel (zum Beispiel 20°) über die Lötstelle?', 'Das Lot ist flach ausgelaufen und hat gut benetzt', ['Es ist zu wenig Lot vorhanden', 'Das Lot ist zu heiß', 'Die Lötstelle ist kalt'], 'Je kleiner der Winkel zwischen Lot und Fläche, desto besser hat das Lot benetzt. Kugeln haben große Winkel.', 'Flach oder kugelig?', 'Gute Benetzung hat einen kleinen Winkel.'],
    ['Warum ist Glanz allein kein sicheres Merkmal einer guten Lötstelle?', 'Bleifreie Lote sind oft seidenmatt, auch wenn sie gut sind; Form und Benetzung zählen', ['Glänzende Lötstellen sind immer schlecht', 'Matte Lötstellen sind immer gut', 'Glanz hat mit der Lötstelle nichts zu tun'], 'Glanz hängt von Legierung und Abkühlung ab. Entscheidend sind die Form der Hohlkehle, die Benetzung und die Füllung.', 'Bleifrei erstarrt meist matter.', 'Worauf zählt es sonst?']
  ];
  const FUQ = [
    ['Eine Lötstelle ist matt, rau und körnig. Was ist die häufigste Ursache?', 'Der Anschluss wurde bewegt, als das Lot erstarrte, oder es wurde zu kalt gelötet', ['Zu viel Flussmittel', 'Zu viel Lot', 'Zu saubere Spitze'], 'Wird der Anschluss beim Erstarren bewegt oder fehlt Wärme, entsteht eine kalte (gestörte) Lötstelle mit rauer Oberfläche.', 'Was passiert beim Erstarren?', 'Ruhig halten und genug Wärme.'],
    ['Zwischen zwei benachbarten Lötstellen hängt Lot. Was ist die häufigste Ursache?', 'Zu viel Lot oder eine zu große Spitze, die nicht sauber abgezogen wurde', ['Zu wenig Wärme', 'Zu wenig Lot', 'Zu kurzes Flussmittel'], 'Überschüssiges Lot sucht sich den Weg zwischen die Lötaugen. Weniger Lot und eine passende Spitze verhindern das.', 'Was ist in der Brücke?', 'Zu viel von etwas.'],
    ['Das Lot perlt als Kugel ab. Was ist die häufigste Ursache?', 'Oxidierte oder verschmutzte Fläche, fehlendes oder verbranntes Flussmittel', ['Zu viel Lot', 'Zu große Lötaugen', 'Zu kurzer Anschluss'], 'Das Lot benetzt nur saubere, lötbare Metallflächen. Reinigen und Flussmittel nachlegen löst das Problem.', 'Wann benetzt Lot nicht?', 'Fläche und Flussmittel.'],
    ['In der Lötstelle sind Hohlräume (Lunker). Was ist die wahrscheinlichste Ursache?', 'Gase oder Flussmittel konnten beim Erstarren nicht entweichen', ['Zu wenig Lot', 'Zu große Lötaugen', 'Zu viel Strom beim Messen'], 'Eingeschlossene Gase wie verdampfendes Flussmittel oder Feuchtigkeit hinterlassen beim Erstarren Hohlräume.', 'Was steckt im Hohlraum?', 'Gase brauchen Zeit zum Entweichen.'],
    ['Das Lötauge hat sich von der Platine abgelöst. Was ist die häufigste Ursache?', 'Zu lange oder zu heiß gelötet oder Zug am Bauteil beim Entlöten', ['Zu viel Flussmittel', 'Zu wenig Lot', 'Zu kurze Anschlüsse'], 'Der Klebstoff unter dem Kupfer verträgt nur begrenzt Hitze. Zu viel Wärme oder Zug löst das Lötauge ab.', 'Was hält das Lötauge?', 'Wärme und Zug schaden.'],
    ['Kleine Lotkügelchen liegen neben der Lötstelle. Was ist die häufigste Ursache?', 'Flussmittel spritzt durch zu schnelles Aufheizen oder Feuchtigkeit', ['Zu wenig Flussmittel', 'Zu kalte Lötspitze', 'Zu großes Lötauge'], 'Verdampfendes Flussmittel schleudert kleine Lotteilchen heraus. Gleichmäßigeres Aufheizen und trockene Teile helfen.', 'Was verdampft?', 'Spritzen.']
  ];
  /* PRUEFEN L5: Lochfüllung 75 % und Benetzungswinkel 90° als Grenzen der Übungsbeurteilung, Zwischenstufe "Prozessindikator" für Winkel 55 bis 90°: sind das in eurer Prüfung ähnliche Größenordnungen? */
  const BAUQ = [
    ['Was bedeutet die Angabe 0805 bei einem Chip-Widerstand?', 'Länge 0,08 Zoll und Breite 0,05 Zoll (etwa 2,0 mm mal 1,25 mm)', ['Der Widerstand hat 805 Ω', 'Die Leistung ist 0,805 W', 'Er ist 8,05 mm lang'], 'Die Bauform steht für Länge und Breite in Hundertstel Zoll. 0805 ist also etwa 2,0 mm mal 1,25 mm groß.', 'Zahlen stehen für Länge und Breite.', 'Es ist ein Maß, kein Wert.'],
    ['Welche dieser Chip-Bauformen ist die kleinste?', '0402', ['0603', '0805', '1206'], 'Die ersten beiden Ziffern geben die Länge, die letzten die Breite. Je kleiner die Zahlen, desto kleiner das Bauteil.', 'Kleinere Zahlen heißen kleineres Bauteil.', 'Vergleiche die ersten beiden Ziffern.'],
    ['Was bedeutet SMD?', 'Bauteil, das direkt auf die Oberfläche der Leiterplatte gelötet wird (Surface Mounted Device)', ['Bauteil mit langen Drähten durch die Platine', 'Ein Lötverfahren mit Flammen', 'Ein Prüfgerät für Leiterplatten'], 'SMD-Bauteile haben keine Drähte durch die Platine, sondern Anschlüsse auf der Oberfläche. Das spart Platz und Bohrungen.', 'Das D steht für Device, Bauteil.', 'Oberfläche, nicht Durchsteck.'],
    ['Welche Bauform hat Anschlüsse, die wie Möwenflügel nach außen gebogen sind?', 'Gull-Wing (zum Beispiel SOIC oder QFP)', ['Chip-Bauform 0603', 'Radial bedrahtet', 'Axial bedrahtet'], 'Gull-Wing-Anschlüsse laufen seitlich aus dem Gehäuse und sind nach unten und außen gebogen. Der Fuß liegt flach auf dem Lötauge.', 'Gull heißt Möwe.', 'Seitlich herausgeführte Beinchen.'],
    ['Wo sitzen die Anschlüsse bei einem BGA?', 'Als Lotkugeln unter dem Gehäuse, von außen nicht sichtbar', ['Als Beinchen an den vier Seiten', 'Als Drähte durch die Platine', 'Als Klemmen an der Seite'], 'Beim Ball Grid Array liegen die Lotkugeln unter dem Gehäuse. Die Lötstellen sind von außen nicht zu sehen und werden im Röntgenbild geprüft.', 'Ball heißt Kugel.', 'Wo sieht man die Kugeln nicht?'],
    ['Warum ist das Handlöten von 0402-Bauteilen schwierig?', 'Sie sind sehr klein und leicht, sie verrutschen oder stellen sich auf', ['Sie schmelzen bei niedriger Temperatur', 'Sie brauchen besonders viel Lot', 'Sie lassen sich nicht löten'], 'Kleine Teile sind leicht und haben kleine Lötflächen. Mit Lupe, Pinzette und genauer Menge gelingt es trotzdem.', 'Wie groß ist 0402?', 'Leichte Teile bewegen sich leicht.']
  ];
  const SHQ = [
    ['Wie gehst du beim Handlöten eines Chip-Widerstands am besten vor?', 'Ein Pad verzinnen, das Bauteil mit der Pinzette dort festlöten, dann das zweite Ende löten', ['Beide Pads mit viel Lot füllen, dann das Bauteil hineindrücken', 'Das Bauteil festkleben und beide Enden gleichzeitig löten', 'Erst das Bauteil auflegen, dann beide Pads mit Lot überfluten'], 'Ein Pad wird verzinnt. Das Bauteil wird festgehalten und an diesem Pad angelötet. Dann ist es fixiert, das zweite Ende lässt sich ruhig löten.', 'Erst fixieren, dann das zweite Ende.', 'Mit der Pinzette festhalten.'],
    ['Welche Lötspitze eignet sich für kleine SMD-Teile?', 'Eine feine Meißel- oder Kegelspitze, passend zur Padgröße', ['Eine breite Spitze für große Flächen', 'Eine abgebrochene Spitze', 'Die Spitze ist egal'], 'Die Spitze muss das Pad treffen, ohne Nachbarn zu berühren. Zu große Spitzen verursachen Brücken, zu kleine übertragen zu wenig Wärme.', 'Passend zur Padgröße.', 'Nicht zu groß, nicht zu klein.'],
    ['Warum verzinnst du bei SMD-Teilen zuerst ein Pad?', 'Das Bauteil bleibt beim zweiten Anschluss an seinem Platz', ['Damit weniger Flussmittel gebraucht wird', 'Damit das Bauteil kälter bleibt', 'Damit die Spitze länger hält'], 'Das angelötete Ende hält das Bauteil fest. Danach muss man keine Hand mehr zum Halten nehmen.', 'Was passiert sonst beim Löten des ersten Endes?', 'Fixieren hilft.'],
    ['Wie vermeidest du Brücken beim Handlöten eng stehender IC-Beinchen?', 'Wenig Lot, genug Flussmittel und die Spitze am Beinchen entlang abziehen', ['Möglichst viel Lot auftragen', 'Die Spitze lange auf den Beinchen lassen', 'Auf Flussmittel verzichten'], 'Mit wenig Lot und viel Flussmittel zieht das Lot mit der Spitze entlang der Beinchen und bleibt dort, wo es hingehört.', 'Wenig Lot.', 'Flussmittel hilft beim Abziehen.'],
    ['Wie lange wärmst du ein SMD-Pad bei Handlötung etwa?', 'Kurz: etwa 1 bis 3 Sekunden je Anschluss', ['Mehrere Minuten', 'Nur eine Zehntelsekunde', 'So lange, bis das Bauteil heiß ist'], 'Kleine Bauteile verkraften nur kurz Wärme. Zu lange Wärme schadet Bauteil und Pad. Bei Problemen lieber pausieren und es nochmals versuchen.', 'Das Bauteil ist klein.', 'Wenige Sekunden.']
  ];
  const PAQ = [
    ['Woraus besteht Lotpaste?', 'Aus winzigen Lotkügelchen und Flussmittel', ['Aus Lötdraht und Wasser', 'Aus Kleber und Kupferpulver', 'Aus reinem Flussmittel'], 'Lotpaste ist ein cremiges Gemisch aus kleinen Lotkügelchen und Flussmittel. Beim Erhitzen schmilzt das Lot und benetzt Pad und Anschluss.', 'Lot plus Flussmittel.', 'Kügelchen, nicht Draht.'],
    ['Wie wird Lotpaste im Serienprozess auf die Platine gebracht?', 'Mit einer Schablone (Stencil) und einem Rakel auf die Lötaugen', ['Mit dem Pinsel aus der Dose', 'Mit dem Lötkolben', 'Per Hand aus der Tube auf jedes Bauteil'], 'Die Schablone hat Öffnungen genau über den Lötaugen. Das Rakel drückt Paste hindurch, so entsteht jedes Mal die gleiche Menge.', 'Gleiche Menge an jeder Stelle.', 'Schablone heißt Stencil.'],
    ['Wie lagerst du Lotpaste?', 'Gekühlt nach Angabe des Herstellers, vor Gebrauch auf Raumtemperatur kommen lassen', ['Warm in der Sonne', 'Offen auf dem Arbeitstisch', 'Eingefroren und direkt benutzen'], 'Kühlen verlangsamt das Altern. Vor dem Öffnen muss die Paste warm werden, sonst schlägt sich Kondenswasser nieder.', 'Kühl lagern.', 'Dann Zeit zum Aufwärmen.'],
    ['Warum muss Paste vor dem Öffnen Raumtemperatur annehmen?', 'Sonst bildet sich Kondenswasser, das beim Löten spritzt und Lotperlen verursacht', ['Sonst wird sie zu hart', 'Sonst riecht sie stark', 'Sonst schmilzt das Lot'], 'Kalte Behälter ziehen Feuchtigkeit aus der Luft. Das Wasser verdampft im Ofen schlagartig.', 'Was setzt sich an kalten Flächen ab?', 'Wasser verdampft schnell.'],
    ['Was passiert bei zu viel Paste auf dem Lötauge?', 'Brückengefahr zwischen eng stehenden Anschlüssen und Lotkugeln', ['Die Lötstelle wird automatisch besser', 'Nichts, das Lot fließt weg', 'Das Bauteil wird kälter'], 'Die Pastenmenge bestimmt die Lotmenge. Zu viel Lot sucht sich den Weg zum Nachbarn.', 'Wohin fließt überschüssiges Lot?', 'Menge steuert Ergebnis.']
  ];
  const ZOQ = [
    ['Wozu dient die Vorwärmzone im Reflow-Ofen?', 'Langsames, gleichmäßiges Aufheizen, damit Lösungsmittel entweichen und nichts schockt', ['Das Lot schmilzt und benetzt', 'Das Lot erstarrt', 'Das Bauteil wird gereinigt'], 'In der Vorwärmzone steigt die Temperatur sanft an, Lösungsmittel der Paste verdampfen und Bauteile werden nicht geschockt.', 'Sanft aufheizen.', 'Vor dem Schmelzen.'],
    ['Was geschieht in der Haltezone (Soak)?', 'Große und kleine Bauteile gleichen ihre Temperatur an, das Flussmittel wirkt', ['Das Lot erstarrt', 'Die Platine kühlt ab', 'Das Lot schmilzt vollständig'], 'In der Haltezone bleibt die Temperatur unter dem Schmelzpunkt. Die Platine wird gleichmäßig warm und das Flussmittel löst Oxide.', 'Nicht heißer als die Schmelztemperatur.', 'Temperaturen angleichen.'],
    ['Was geschieht in der Spitzenzone (Reflow)?', 'Das Lot schmilzt und benetzt Anschluss und Lötauge', ['Das Flussmittel wird verbraucht, ohne dass etwas schmilzt', 'Die Bauteile werden getrocknet', 'Das Lot erstarrt'], 'Die Temperatur geht über die Schmelztemperatur des Lots. Es fließt und benetzt. Die Spitze darf die Grenzen der Bauteile nicht überschreiten.', 'Hier ist es am heißesten.', 'Reflow heißt wieder fließen.'],
    ['Wozu dient die Abkühlzone?', 'Das Lot erstarrt kontrolliert und gleichmäßig', ['Das Lot wird aufgeschmolzen', 'Das Flussmittel wird aktiviert', 'Die Platine wird getrocknet'], 'Beim Abkühlen erstarrt das Lot. Zu schnell macht Spannungen und Risse, zu langsam grobes, sprödes Gefüge.', 'Nach der Spitze.', 'Weder zu schnell noch zu langsam.'],
    ['Warum heizt man nicht sofort auf die Spitzentemperatur?', 'Thermischer Schock, Lotperlen und Grabsteine wären die Folge', ['Das Lot würde dann nicht schmelzen', 'Der Ofen kann das nicht', 'Das Flussmittel wird kalt'], 'Schnelles Aufheizen lässt das Flussmittel kochen und die Bauteile ungleich warm werden. Die Zonen verhindern das.', 'Was passiert bei schnellem Aufheizen?', 'Ungleichmäßig.'],
    ['Was bezeichnet die Zeit über der Schmelztemperatur (TAL, time above liquidus)?', 'Die Zeit, in der das Lot flüssig ist: lang genug zum Benetzen, kurz genug für die Bauteile', ['Die Dauer der gesamten Ofenfahrt', 'Die Dauer der Vorwärmzone', 'Die Dauer der Abkühlzone unter 100 °C'], 'Nur solange das Lot flüssig ist, kann es benetzen. Zu lange Zeit führt zu dicker Zwischenschicht und belasteten Bauteilen.', 'Liquidus heißt flüssig.', 'Nur die Zeit über der Schmelztemperatur zählt.']
  ];
  const GBQ = [
    ['Ein 0603-Widerstand steht an einem Ende senkrecht. Wie heißt der Fehler?', 'Grabstein-Effekt (Tombstoning)', ['Lötbrücke', 'Lunker', 'Kalte Lötstelle'], 'Steht ein Chip auf einem Ende, hat nur ein Pad das Lot früher geschmolzen und das Bauteil hochgezogen: Grabstein-Effekt.', 'Wie sieht ein Grabstein aus?', 'Das Bauteil steht auf.'],
    ['Wodurch entsteht der Grabstein?', 'Ein Pad benetzt früher und zieht das Bauteil hoch, weil das Lot nicht an beiden Enden gleichzeitig schmilzt', ['Zu viel Flussmittel', 'Zu langsames Abkühlen', 'Zu große Bauteile'], 'Die Oberflächenspannung des früher geschmolzenen Lots reißt das Bauteil am anderen Ende hoch.', 'Wer schmilzt zuerst?', 'Oberflächenspannung.'],
    ['Welche Maßnahme hilft gegen den Grabstein?', 'Gleichmäßig erwärmen, gleiche Padgrößen und gleich viel Paste an beiden Enden', ['Mehr Paste an einem Ende', 'Die Aufheizrate erhöhen', 'Das Bauteil kleiner wählen'], 'Beide Enden sollen zur gleichen Zeit schmelzen. Dafür sorgen gleiche Wärmeaufnahme, Pads und Paste.', 'Beide Enden gleich behandeln.', 'Gleichzeitig schmelzen.'],
    ['Warum begünstigt ein sehr steiler Anstieg im Reflow-Profil den Grabstein?', 'Ein Ende erreicht die Schmelztemperatur deutlich früher als das andere', ['Das Flussmittel wird zu kalt', 'Das Lot erstarrt zu früh', 'Die Platine kühlt dabei ab'], 'Je schneller der Anstieg, desto größer der Unterschied zwischen beiden Enden, bevor das erste schmilzt.', 'Wie groß ist der Temperaturunterschied?', 'Steil heißt ungleich.'],
    ['Bei welchen Bauteilen ist die Grabstein-Gefahr am größten?', 'Bei kleinen, leichten Chips mit ungleichen Pads oder ungleichem Wärmeabfluss', ['Bei großen schweren ICs', 'Bei bedrahteten Bauteilen', 'Bei Steckern'], 'Kleine Chips haben wenig Gewicht gegen die Zugkraft des Lots. Ein ungleicher Wärmeabfluss lässt ein Ende früher schmelzen.', 'Was ist leicht?', 'Kleine Teile.']
  ];
  /* PRUEFEN L6: Die Klassen 1 bis 3 sind nur allgemein beschrieben (einfache Geräte, Geräte mit Lebensdauer-Anspruch, höchste Zuverlässigkeit); Zielzustand, annehmbar, Prozessindikator, Fehler als Stufen. Passt die Beschreibung zu dem, was ihr im Unterricht sagt? */
  const KLQ = [
    ['Wofür stehen die drei Produktklassen bei der Beurteilung von Lötstellen grundsätzlich?', 'Für wachsende Anforderungen: einfache Geräte, Geräte mit Lebensdauer-Anspruch, Geräte mit höchster Zuverlässigkeit', ['Für drei verschiedene Lötverfahren', 'Für drei Schichten pro Tag', 'Für drei Größen von Leiterplatten'], 'Die Klassen legen fest, wie streng Lötstellen beurteilt werden: von Verbrauchsgeräten bis zu Produkten, bei denen Ausfall nicht hinnehmbar ist.', 'Es geht um Anforderungen an das Produkt.', 'Je höher die Klasse, desto strenger.'],
    ['In welche Klasse gehört ein Gerät, das nie ausfallen darf, zum Beispiel lebenserhaltende Medizintechnik?', 'In Klasse 3', ['In Klasse 1', 'In Klasse 2', 'Es gibt keine solche Klasse'], 'Klasse 3 ist für Produkte mit höchsten Zuverlässigkeits-Anforderungen. Die Kriterien sind dort am strengsten.', 'Welche Klasse ist die strengste?', 'Ausfall nicht hinnehmbar.'],
    ['Welche Klasse hat die lockersten Anforderungen?', 'Klasse 1', ['Klasse 2', 'Klasse 3', 'Alle gleich'], 'Klasse 1 ist für einfache Geräte, bei denen Funktion wichtig, die Lebensdauer aber nicht kritisch ist.', 'Eins ist die kleinste Zahl.', 'Einfache Geräte.'],
    ['Wer legt fest, welche Klasse für ein Produkt gilt?', 'Der Auftraggeber bzw. die Produktspezifikation', ['Der Lötende nach Gefühl', 'Die Berufsschule', 'Der Lieferant der Lotpaste'], 'Die Klasse wird für das Produkt vorgegeben. Wer prüft, legt sie nicht selbst fest.', 'Wer bestellt das Produkt?', 'Es steht in der Spezifikation.'],
    ['Eine Lötstelle wird in Klasse 3 beurteilt statt in Klasse 1. Was ändert sich?', 'Es gelten strengere Grenzen für die gleiche Beurteilung', ['Es gelten lockerere Grenzen', 'Es gelten dieselben Grenzen', 'Die Lötstelle wird nicht mehr beurteilt'], 'Mit steigender Klasse werden Abweichungen früher zum Fehler. Dieselbe Lötstelle kann in Klasse 1 annehmbar und in Klasse 3 ein Fehler sein.', 'Klasse 3 ist die strengste.', 'Dieselbe Lötstelle, strengere Messlatte.']
  ];
  const STQ = [
    ['Der Zustand ist der bestmögliche: Alles passt. Wie heißt die Beurteilungsstufe?', 'Zielzustand', ['Annehmbar', 'Prozessindikator', 'Fehler'], 'Der Zielzustand ist das Ideal: nahezu perfekt. Mehr kann man nicht verlangen.', 'Das Ideal.', 'Nahezu perfekt.'],
    ['Die Lötstelle ist nicht ideal, funktioniert und hält aber noch sicher. Wie heißt die Stufe?', 'Annehmbar', ['Zielzustand', 'Prozessindikator', 'Fehler'], 'Annehmbar heißt: Funktion und Zuverlässigkeit sind gegeben, auch wenn das Bild nicht perfekt ist.', 'Es hält noch.', 'Kein Ideal, aber in Ordnung.'],
    ['Die Lötstelle ist noch annehmbar, deutet aber auf einen Prozess hin, der nicht optimal läuft. Wie heißt die Stufe?', 'Prozessindikator', ['Zielzustand', 'Annehmbar ohne Hinweis', 'Fehler'], 'Ein Prozessindikator ist kein Fehler, aber ein Warnsignal. Die Ursache im Prozess soll gesucht werden, bevor es zu Fehlern kommt.', 'Es ist ein Hinweis auf den Prozess.', 'Kein Fehler, aber ein Warnzeichen.'],
    ['Funktion oder Zuverlässigkeit sind nicht gewährleistet. Wie heißt die Stufe?', 'Fehler (Nacharbeit nötig)', ['Zielzustand', 'Annehmbar', 'Prozessindikator'], 'Ein Fehler erfüllt die Anforderungen nicht. Die Baugruppe muss nachgearbeitet oder ausgesondert werden.', 'Hält es noch sicher?', 'Nacharbeit oder Aussonderung.'],
    ['Du findest bei mehreren Lötstellen denselben Prozessindikator. Was tust du?', 'Die Ursache im Prozess suchen und beheben, die Baugruppen können meist weiterlaufen', ['Alle Baugruppen sofort verschrotten', 'Nichts tun, ist ja annehmbar', 'Die Prüfung abbrechen'], 'Ein gehäufter Prozessindikator zeigt, dass der Prozess driftet. Wer die Ursache beseitigt, verhindert spätere Fehler.', 'Was sagt ein Warnzeichen?', 'Prozess verbessern.']
  ];
  const AOQ = [
    ['Was macht eine AOI (automatische optische Inspektion)?', 'Kameras prüfen Lötstellen und Bestückung automatisch auf Abweichungen', ['Sie lötet Bauteile', 'Sie misst Strom und Spannung', 'Sie reinigt Platinen'], 'Die AOI vergleicht Kamerabilder mit Sollbildern und meldet Abweichungen. Ein Mensch beurteilt die Meldungen.', 'Das O steht für optisch.', 'Kameras prüfen.'],
    ['Was kann eine AOI nicht sehen?', 'Verdeckte Lötstellen, zum Beispiel unter BGA-Gehäusen', ['Lötbrücken', 'Fehlende Bauteile', 'Verdrehte Bauteile'], 'Kameras sehen nur, was frei sichtbar ist. Verdeckte Lötstellen prüft man mit Röntgen.', 'Was liegt unter dem Gehäuse?', 'Sichtbar ist Voraussetzung.'],
    ['Wie prüfst du verdeckte BGA-Lötstellen?', 'Mit Röntgenprüfung', ['Mit der Lupe', 'Mit dem Multimeter am Gehäuse', 'Gar nicht'], 'Röntgenstrahlen durchdringen das Gehäuse und zeigen Lotkugeln, Brücken und Lunker.', 'Was durchdringt Material?', 'Unsichtbares sichtbar machen.'],
    ['Wozu nutzt du bei der Sichtprüfung eine Lupe oder ein Mikroskop?', 'Form, Benetzung und Füllung der Lötstelle lassen sich bei Vergrößerung beurteilen', ['Damit die Lötstelle heißer wird', 'Damit du die Farbe des Lots misst', 'Damit du nicht messen musst'], 'Viele Merkmale wie Hohlkehle und Benetzungswinkel sind klein. Vergrößerung macht sie sichtbar.', 'Kleine Merkmale.', 'Sehen heißt prüfen.'],
    ['Eine AOI meldet viele Pseudofehler. Was bedeutet das?', 'Sie meldet Abweichungen, die bei der Kontrolle gar kein Fehler sind', ['Sie übersieht echte Fehler', 'Sie hat zu viele Kameras', 'Sie meldet nichts mehr'], 'Pseudofehler sind Fehlalarme. Zu viele davon kosten Prüfzeit, deshalb stellt man die Prüfprogramme nach.', 'Pseudo heißt scheinbar.', 'Fehlalarm.']
  ];
  /* PRUEFEN L7: ESD-Aussagen (schon unter 100 V können empfindliche Bauteile schädigen, Menschen spüren ESD erst ab einigen Tausend Volt, Armband mit 1 MΩ Schutzwiderstand) sind übliche Lehrbuchwerte. Passt das zu euren ESD-Unterlagen? */
  const ESQ = [
    ['Warum ist ESD für Bauteile gefährlich, obwohl du den Funken nicht spürst?', 'Schon kleine Spannungen können empfindliche Halbleiter schädigen, spürbar wird ESD erst ab einigen Tausend Volt', ['Weil der Funke hell leuchtet', 'Weil der Strom sehr lange fließt', 'Weil ESD nur Mensch und Tier schadet'], 'Viele Halbleiter vertragen nur wenige Hundert Volt. Du spürst Entladungen aber erst ab einigen Tausend Volt.', 'Spürst du kleine Entladungen?', 'Bauteile sind empfindlicher als du.'],
    ['Wo arbeitest du mit ungeschützten Bauteilen?', 'In einem ESD-geschützten Bereich (EPA)', ['Am Schreibtisch im Büro', 'Auf dem Boden der Werkstatt', 'Im Pausenraum'], 'Nur im EPA sind Boden, Tisch, Mensch und Werkzeug geerdet oder ableitfähig. Dort sind Bauteile geschützt.', 'EPA steht für ESD Protected Area.', 'Geschützter Bereich.'],
    ['Was gehört zur persönlichen ESD-Schutzausrüstung am Arbeitsplatz?', 'Armband mit Erdung, ableitfähige Schuhe oder Bodenbelag, geerdete Arbeitsmatte', ['Gummihandschuhe ohne Erdung', 'Ein Pulli aus Kunstfaser', 'Ein isolierender Hocker'], 'Alle Personen und Gegenstände im EPA werden auf gleiches Potential gebracht und über Widerstände abgeleitet.', 'Alles erden.', 'Ableiten, nicht isolieren.'],
    ['Wie fasst du eine ungeschützte Baugruppe an?', 'Am Rand oder am Gehäuse, nicht an den Anschlüssen', ['An den Anschlüssen, damit sie nicht rutscht', 'Mit den Fingern an den ICs', 'Mit dem Handschuh aus Kunststoff'], 'Berührte Anschlüsse können durch Entladung Schaden nehmen. Der Rand ist unkritisch.', 'Wo sitzen die empfindlichen Stellen?', 'Rand.'],
    ['Warum ist ein Kunststoffbecher im EPA ein Problem?', 'Isolatoren laden sich auf und lassen sich nicht über die Erdung entladen', ['Weil er zu schwer ist', 'Weil er zu viel Platz braucht', 'Weil er Flussmittel enthält'], 'Isolatoren können hohe Spannungen aufbauen, die du nicht ableiten kannst. Sie gehören nicht in den EPA.', 'Lässt sich Kunststoff erden?', 'Aufladen.'],
    ['Was prüfst du vor Arbeitsbeginn am Erdungsarmband?', 'Die Funktion mit einem Armbandprüfer und den festen Hautkontakt', ['Die Farbe des Bands', 'Die Länge des Kabels', 'Nichts, es funktioniert immer'], 'Ein defektes oder lockeres Armband schützt nicht. Die Funktionsprüfung wird regelmäßig durchgeführt.', 'Was kann ein Armband ausfallen lassen?', 'Prüfen vor Arbeitsbeginn.']
  ];
  const ARQ = [
    ['Wie schützt du dich vor Lötdämpfen?', 'Absaugung am Arbeitsplatz einschalten und nicht direkt in den Dampf atmen', ['Mit Parfüm', 'Mit offenem Fenster, ohne Absaugung', 'Gar nicht, die Dämpfe sind harmlos'], 'Beim Löten entstehen Dämpfe aus Flussmittel. Eine Absaugung leitet sie weg, bevor du sie einatmest.', 'Wohin soll der Dampf?', 'Absaugung.'],
    ['Wo legst du den heißen Lötkolben ab?', 'In den dafür vorgesehenen Ablageständer', ['Auf die Tischkante', 'Auf die Arbeitsmatte', 'In die Werkzeugschublade'], 'Ein Lötkolben erreicht mehrere hundert Grad. Der Ständer verhindert Brände und Verbrennungen.', 'Wie heiß ist die Spitze?', 'Ständer.'],
    ['Wann trägst du beim Löten eine Schutzbrille?', 'Beim Abschneiden von Anschlüssen, bei spritzendem Lot oder beim Entlöten', ['Nie, sie stört beim Sehen', 'Nur bei Sonne', 'Nur beim Messen'], 'Abgeschnittene Drahtenden und Lotspritzer können ins Auge fliegen. Die Brille schützt davor.', 'Was fliegt durch die Luft?', 'Augenschutz.'],
    ['Was tust du nach dem Löten, besonders mit bleihaltigem Lot, vor dem Essen?', 'Hände waschen', ['Nichts', 'Hände an der Arbeitskleidung abwischen', 'Etwas essen, dann waschen'], 'Blei kann an den Händen haften. Händewaschen vor Essen und Trinken verhindert, dass es in den Körper gelangt.', 'Was haftet an den Fingern?', 'Waschen.'],
    ['Wie gehst du mit Lötabfällen und Lotresten um?', 'Sie getrennt sammeln und nach der Betriebsregel entsorgen', ['In den normalen Müll werfen', 'Auf dem Boden liegen lassen', 'In den Ausguss spülen'], 'Lotreste und Putzwolle enthalten Metalle. Sie werden getrennt gesammelt und nach den Vorgaben des Betriebs entsorgt.', 'Was steckt im Lotrest?', 'Getrennt sammeln.']
  ];
  const VPQ = [
    ['In was transportierst du ESD-empfindliche Baugruppen?', 'In ESD-Schutzbeuteln oder -Behältern', ['In normalen Plastiktüten', 'In Seidenpapier', 'In Styropor-Chips'], 'Normale Plastikbeutel laden sich auf. ESD-Beutel leiten Ladung ab oder schirmen ab.', 'Was darf sich nicht aufladen?', 'ESD-Beutel.'],
    ['Was bedeutet das Warnzeichen mit dem durchgestrichenen Handsymbol im Dreieck?', 'Elektrostatisch gefährdete Bauteile, nur im EPA öffnen und anfassen', ['Brandgefahr', 'Giftig', 'Heiße Oberfläche'], 'Das ESD-Warnzeichen kennzeichnet Verpackungen und Bereiche, in denen empfindliche Bauteile liegen.', 'Es geht um Entladung.', 'ESD-Zeichen.'],
    ['Wo öffnest du einen ESD-Schutzbeutel?', 'Am ESD-Arbeitsplatz im EPA', ['Auf dem Boden', 'Im Büro', 'Im Auto'], 'Beim Öffnen und Herausnehmen kann es zur Entladung kommen. Das passiert nur im EPA ohne Schaden.', 'Wo ist alles geerdet?', 'EPA.'],
    ['Was bedeutet "abschirmend" bei einem ESD-Beutel?', 'Die Ladung bleibt außen, das Innere ist wie in einem Metallkäfig geschützt', ['Er schirmt vor Licht ab', 'Er ist wasserdicht', 'Er isoliert Wärme'], 'Abschirmende Beutel verteilen äußere Ladung um den Inhalt herum. Im Inneren entsteht kein Feld.', 'Denke an einen Käfig.', 'Außen bleibt außen.'],
    ['Warum nimmst du keine normale Plastikfolie zum Verpacken von Platinen?', 'Sie lädt sich leicht auf und gibt beim Berühren Spannung an die Baugruppe ab', ['Sie ist zu teuer', 'Sie ist zu schwer', 'Sie lässt sich nicht beschriften'], 'Isolierende Folien erzeugen beim Reiben hohe Spannungen. Eine Entladung auf die Baugruppe kann Bauteile schädigen.', 'Reibung und Aufladung.', 'Isolator.']
  ];
  const ENQ = [
    ['Wie arbeitet eine Entlötsaugpumpe?', 'Sie saugt flüssiges Lot von der Lötstelle ab', ['Sie kühlt das Lot', 'Sie fügt Lot hinzu', 'Sie reinigt die Spitze'], 'Das Lot wird mit dem Kolben und Unterdruck vom heißen Anschluss gesaugt. Die Lötstelle muss dabei flüssig sein.', 'Pumpe saugt.', 'Lot muss flüssig sein.'],
    ['Wie wirkt Entlötlitze?', 'Das Kupfergeflecht saugt flüssiges Lot durch Kapillarwirkung auf', ['Sie schmilzt das Lot', 'Sie klebt das Bauteil fest', 'Sie isoliert die Lötstelle'], 'Die feinen Kupferdrähte ziehen das flüssige Lot wie ein Docht auf. Flussmittel in der Litze hilft dabei.', 'Denke an einen Docht.', 'Kapillarwirkung.'],
    ['Wie entlötest du ein mehrpoliges Bauteil am saubersten?', 'Mit Entlötstation oder Heißluft, alle Anschlüsse gleichzeitig flüssig halten', ['Mit Gewalt abreißen', 'Mit dem Seitenschneider abbrechen', 'Nur den ersten Pin lösen und ziehen'], 'Alle Anschlüsse müssen flüssig sein, sonst reißt man Lötaugen heraus. Heißluft oder Spezialwerkzeug erwärmt sie gemeinsam.', 'Alle Beinchen gleichzeitig.', 'Nicht ziehen.'],
    ['Wozu gibst du beim Entlöten oft frisches Lot auf die alte Lötstelle?', 'Frisches Lot mit Flussmittel verbessert den Wärmeübergang und lässt das alte Lot besser fließen', ['Damit das Bauteil kalt bleibt', 'Damit die Spitze dicker wird', 'Damit das Lot erstarrt'], 'Altes Lot ist oft oxidiert. Frisches Lot und Flussmittel bringen Wärme besser in die Stelle.', 'Wärme muss schnell hinein.', 'Flussmittel hilft.'],
    ['Warum ziehst du nicht mit Gewalt am Bauteil, wenn es noch festsitzt?', 'Lötauge oder Durchkontaktierung können herausgerissen werden', ['Das Bauteil wird sonst zu heiß', 'Das Lot wird sonst hart', 'Es entsteht kein Schaden'], 'Fest sitzendes Lot hält mit großer Kraft. Gewalt reißt Kupfer aus der Platine, und die Reparatur wird schwierig.', 'Wo sitzt die Kraft?', 'Lot noch nicht flüssig.']
  ];
  const GRZ = [
    ['Wie oft darfst du eine Lötstelle nacharbeiten?', 'So selten wie möglich und nach Vorgabe, jedes Erwärmen belastet Lötauge und Bauteil', ['Beliebig oft', 'Nie', 'Genau dreimal'], 'Jeder Wärmegang schwächt Lötauge, Platine und Bauteil. Die Zahl der erlaubten Nacharbeiten steht in der Arbeitsanweisung.', 'Was passiert bei jedem Erwärmen?', 'Vorgabe beachten.'],
    ['Wann ist Nacharbeit nicht mehr sinnvoll?', 'Wenn das Lötauge abgelöst oder die Leiterbahn beschädigt ist: dann Reparatur nach Vorgabe oder Aussonderung', ['Wenn die Lötstelle glänzt', 'Wenn das Lot zu kalt ist', 'Nie, es geht immer'], 'Ist das Kupfer beschädigt, hält die neue Lötstelle nicht. Dann entscheidet die Arbeitsanweisung über Reparatur oder Ausschuss.', 'Was hält die Lötstelle?', 'Kupfer beschädigt.'],
    ['Wer darf Nacharbeit an Serienbaugruppen ausführen?', 'Nur dazu unterwiesene Personen nach der Arbeitsanweisung', ['Jeder, der einen Lötkolben hat', 'Nur der Kunde', 'Niemand'], 'Nacharbeit verlangt Wissen über Wärme, Werkzeug und Grenzen. Unterweisung und Arbeitsanweisung sichern das.', 'Wer kennt die Grenzen?', 'Unterwiesen.'],
    ['Was gehört nach der Nacharbeit dazu?', 'Die Stelle prüfen und die Nacharbeit nach Vorgabe dokumentieren', ['Nichts', 'Die Baugruppe sofort verpacken', 'Die Lötstelle verstecken'], 'Nach der Nacharbeit wird die Lötstelle neu beurteilt. Die Dokumentation zeigt später, wie oft und warum nachgearbeitet wurde.', 'Ist das Ergebnis in Ordnung?', 'Aufschreiben.'],
    ['Was ist nach der Nacharbeit mit Flussmittelresten zu tun?', 'Je nach Flussmittel nach Vorgabe entfernen (reinigen)', ['Mit der Spitze verbrennen', 'Immer stehen lassen', 'Mit Wasser und Seife abwaschen'], 'No-Clean-Reste dürfen meist bleiben, andere Flussmittel müssen entfernt werden. Das steht in der Vorgabe.', 'Welche Flussmittelart?', 'Vorgabe lesen.']
  ];

  /* ---------- Reihenfolgen ---------- */
  const SCHRITTE = ['Lötspitze reinigen und verzinnen', 'Spitze an Lötauge und Anschluss anlegen', 'Lötdraht an die erwärmte Stelle führen', 'Lötdraht wegnehmen', 'Spitze wegnehmen', 'Lötstelle ruhig erstarren lassen', 'Lötstelle prüfen'];
  const NACHAB = ['Fehler und Ursache feststellen', 'Baugruppe ESD-gerecht aufnehmen', 'Altes Lot erwärmen und absaugen', 'Anschluss und Lötauge reinigen', 'Neu löten', 'Stelle prüfen und dokumentieren'];
  function folgeQ(R, L, was, tail) {
    const c = C(), i = c.ri(R, 0, L.length - 2), right = L[i + 1], wrong = c.shuffle(R, L.filter((_, j) => j !== i && j !== i + 1)).slice(0, 3);
    return choiceQ(R, was + ' Der Schritt "' + L[i] + '" ist erledigt. Welcher Schritt folgt als nächster?', right, wrong, 'Die Reihenfolge lautet: ' + L.map((s, j) => (j + 1) + '. ' + s).join('; ') + '. Nach Schritt ' + (i + 1) + ' folgt: ' + right + '.', [tail, 'Denke an den Weg von vorn nach hinten.']);
  }

  /* ---------- Zufallswerte ---------- */
  const ZIFFERN = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];   // erste zwei Ziffern des SMD-Codes (E12-Werte mal 10)
  /* Messwerte so wählen, dass kein Wert nahe an einer Stufengrenze liegt */
  const fernVon = (v, gr) => gr.every(g => Math.abs(v - g) >= 3);
  function messwert(R, a, b, gr) { for (let i = 0; i < 200; i++) { const v = C().ri(R, a, b); if (fernVon(v, gr)) return v; } return gr[0] + 5; }
  const DEV = [
    { k: 'flux', n: 'Das Flussmittel fehlt', p: { flux: 'kein' } },
    { k: 'kalt', n: 'Die Spitze ist viel zu kalt', p: { temp: 225 } },
    { k: 'masse', n: 'Die Lötstelle liegt an einer großen Massefläche', p: { mass: 'masse' } },
    { k: 'kurz', n: 'Es wurde viel zu kurz erwärmt', p: { zeit: 0.8 } },
    { k: 'heiss', n: 'Es wurde zu heiß und zu lange gelötet', p: { temp: 430, zeit: 6 } }
  ];
  const RFB = { anstieg: 'Aufheizrate', halten: 'Haltezeit', spitze: 'Spitzentemperatur', kuehl: 'Abkühlrate' };

  /* ---------- Generatoren ---------- */
  const G = {
    /* Lötprozess und Werkstoffe */
    grund: pq(GRQ), flux: pq(FLQ), bleifrei: pq(BFQ), ursache: pq(URQ),
    ueber: R => {
      const c = C(), al = c.pick(R, [c.ALLOYS.sac, c.ALLOYS.snpb]), T = c.pick(R, al.k === 'sac' ? [320, 330, 340, 350, 360, 380] : [300, 320, 330, 340, 350, 360]), d = T - al.tm;
      return numQ('Im Modellbetrieb steht die Lötspitze auf ' + f(T, 0) + ' °C. Du lötest mit ' + al.kurz + 'em Lot (Schmelztemperatur etwa ' + f(al.tm, 0) + ' °C). Um wie viele Kelvin liegt die Spitze über der Schmelztemperatur des Lots?', d, 'K', 'Differenz', 0.01,
        'Spitzentemperatur minus Schmelztemperatur: ' + f(T, 0) + ' − ' + f(al.tm, 0) + ' = ' + f(d, 0) + ' K. Das Lötauge erreicht diese Temperatur nicht, es bleibt immer kälter als die Spitze. Deshalb braucht es einen deutlichen Abstand.', ['Wie viel Spielraum hat die Spitze?', 'Spitzentemperatur minus Schmelztemperatur.']);
    },
    schritt: R => folgeQ(R, SCHRITTE, 'Du lötest eine Durchsteck-Lötstelle von Hand.', 'Erst warm machen, dann Lot, dann wegnehmen und ruhig halten.'),
    draht: R => {
      const c = C(), d = c.pick(R, [0.5, 0.7, 0.8, 1.0]), l = c.ri(R, 4, 12), rho = 7.4, v = Math.PI / 4 * d * d * l, m = c.solderMg(d, l, rho);
      return numQ('Für eine Lötstelle im Modellbetrieb brauchst du ein Stück Lötdraht von ' + f(d, 1) + ' mm Durchmesser und ' + f(l, 0) + ' mm Länge (Vollkern, ohne Seele). Die Dichte des Lots beträgt 7,4 g/cm³. Wie viel wiegt das Stück?', m, 'mg', 'Masse', 0.05,
        'Volumen eines Zylinders: π/4 · d² · l = π/4 · ' + f(d, 1) + '² · ' + f(l, 0) + ' = ' + f(v, 3) + ' mm³. Mit 7,4 g/cm³ = 7,4 mg/mm³ ergibt sich ' + f(v, 3) + ' · 7,4 = ' + f(m, 2) + ' mg.', ['Berechne zuerst das Volumen in mm³.', '1 g/cm³ sind 1 mg je mm³.']);
    },
    szen: R => {
      const c = C(), dv = c.pick(R, DEV), p = Object.assign({ lot: 100, temp: 350, zeit: 3, flux: 'normal', alloy: 'sac', mass: 'normal' }, dv.p), j = c.joint(p), wrong = c.shuffle(R, DEV.filter(x => x !== dv)).slice(0, 3).map(x => x.n);
      const wo = j.melted ? 'Das Lot ist geflossen, der Benetzungswinkel beträgt etwa ' + f(j.theta, 0) + '°, die Oberfläche wirkt ' + j.look + '.' : 'Das Lot ist nicht richtig geflossen, die Oberfläche wirkt ' + j.look + ' und der Winkel ist größer als 90°.';
      return choiceQ(R, 'Eine Durchsteck-Lötstelle im Modellbetrieb ist misslungen. Eingestellt waren: Spitze ' + f(p.temp, 0) + ' °C, Lötzeit ' + f(p.zeit, 1) + ' s, Flussmittel ' + c.FLUX[p.flux].n + ', ' + (p.mass === 'masse' ? 'Lötauge an einer großen Massefläche' : 'normale Lötauge-Fläche') + '. Üblich wären 350 °C, 3 s, normales Flussmittel und eine normale Fläche. ' + wo + ' Was ist die Ursache?', dv.n, wrong,
        'Vergleiche jede Einstellung mit dem üblichen Wert. Hier weicht genau eine ab: ' + dv.n + '. Alles andere liegt im üblichen Bereich.', ['Welche Einstellung weicht vom Üblichen ab?', 'Es ist genau eine.']);
    },
    /* THT-Lötstellen beurteilen */
    meni: pq(MEQ), fehlursache: pq(FUQ),
    fehlerbild: R => {
      const c = C(), d = c.pick(R, FB6), wrong = c.shuffle(R, FB6.filter(x => x !== d)).slice(0, 3).map(x => x.n);
      return choiceQ(R, 'Du siehst eine Durchsteck-Lötstelle mit diesem Befund: ' + d.merk + ' Wie heißt das Fehlerbild?', d.n, wrong, d.n + ': ' + d.merk + ' Ursache: ' + d.urs, ['Gehe die Merkmale der Reihe nach durch: Form, Oberfläche, Winkel.', 'Vergleiche mit den Fehlerbildern im Reiter Fehlerbilder.']);
    },
    winkel: R => {
      const c = C(), th = messwert(R, 8, 120, [30, 55, 90]), lv = c.thetaLevel(th);
      return choiceQ(R, 'Du misst am Mikroskop einen Benetzungswinkel von ' + f(th, 0) + '°. Nach dem Übungsmaßstab des Labs gilt: bis 30° Zielzustand, bis 55° annehmbar, bis 90° Prozessindikator, darüber Fehler. Wie stufst du die Benetzung ein?', c.LEVN[lv], c.LEV.filter(x => x !== lv).map(x => c.LEVN[x]),
        f(th, 0) + '° liegt ' + (lv === 'ziel' ? 'bis 30°' : lv === 'annehmbar' ? 'zwischen 30° und 55°' : lv === 'prozess' ? 'zwischen 55° und 90°' : 'über 90°') + ': ' + c.LEVN[lv] + '.', ['Lies die Grenzen in der Aufgabe ab.', 'Sortiere den Winkel in die richtige Spanne ein.']);
    },
    durchst: R => {
      const c = C(), t = c.pick(R, [1.6, 2.0, 2.4]), pct = c.pick(R, [55, 60, 65, 70, 75, 80, 85, 90, 95]), h = c.rd(t * pct / 100, 2), v = c.fillPct(h, t);
      return numQ('Die Leiterplatte im Modellbetrieb ist ' + f(t, 1) + ' mm dick. Das Lot ist in der Hülse ' + f(h, 2) + ' mm hoch gestiegen. Wie viel Prozent der Hülse sind gefüllt?', v, '%', 'Füllung', 0.1,
        'Füllung = Lothöhe geteilt durch Plattendicke mal 100: ' + f(h, 2) + ' mm / ' + f(t, 1) + ' mm · 100 = ' + f(v, 1) + ' %. Als Übungsgrenze gelten mindestens 75 %.', ['Teile die Lothöhe durch die Plattendicke.', 'Für Prozent rechnest du mal 100.']);
    },
    benetz: R => {
      const c = C(), dp = c.pick(R, [2.0, 2.5, 3.0]), pct = c.pick(R, [60, 70, 75, 80, 85, 90, 95]), dw = c.rd(dp * Math.sqrt(pct / 100), 1), v = c.areaPct(dw, dp);
      return numQ('Das Lötauge hat einen Durchmesser von ' + f(dp, 1) + ' mm. Das Lot hat es bis zu einem Durchmesser von ' + f(dw, 1) + ' mm benetzt (Kreisfläche). Wie viel Prozent der Fläche sind benetzt?', v, '%', 'Benetzte Fläche', 0.1,
        'Die Fläche wächst mit dem Quadrat des Durchmessers: (' + f(dw, 1) + ' / ' + f(dp, 1) + ')² · 100 = ' + f(v, 1) + ' %. Als Übungsgrenze gelten mindestens 75 %.', ['Flächen verhalten sich wie die Quadrate der Durchmesser.', 'Verhältnis der Durchmesser, quadrieren, mal 100.']);
    },
    kuerz: R => {
      const c = C(), u = c.ri(R, 21, 36) / 10, k = c.trimLen(u, 1.0);
      return numQ('Nach dem Löten ragt ein Anschlussdraht ' + f(u, 1) + ' mm über die Lötseite der Leiterplatte hinaus. Er soll auf 1,0 mm gekürzt werden (üblich sind 0,5 bis 1,5 mm). Wie viel schneidest du ab?', k, 'mm', 'Abzuschneidende Länge', 0.01,
        'Überstand minus Ziel: ' + f(u, 1) + ' − 1,0 = ' + f(k, 1) + ' mm. Schneide knapp über dem Lot ab, ohne in die Lötstelle zu schneiden, und trage eine Schutzbrille.', ['Wie lang ist der Überstand, wie lang soll er werden?', 'Überstand minus Ziel.']);
    },
    urteil: R => {
      const c = C(), lot = messwert(R, 40, 170, [60, 80, 90, 115, 130, 150]), th = messwert(R, 10, 110, [30, 55, 90]), fl = messwert(R, 50, 100, [60, 75, 90]);
      const ls = [c.lotLevel(lot), c.thetaLevel(th), c.fillLevel(fl)], v = c.worst(ls);
      return choiceQ(R, 'An einer Durchsteck-Lötstelle im Modellbetrieb misst du: Lotmenge ' + f(lot, 0) + ' % der Idealmenge, Benetzungswinkel ' + f(th, 0) + '°, Füllung der Hülse ' + f(fl, 0) + ' %. Übungsmaßstab: Lotmenge 90 bis 115 % Ziel, 80 bis 130 % annehmbar, 60 bis 150 % Prozessindikator, sonst Fehler. Winkel bis 30° Ziel, bis 55° annehmbar, bis 90° Prozessindikator, sonst Fehler. Füllung ab 90 % Ziel, ab 75 % annehmbar, ab 60 % Prozessindikator, sonst Fehler. Welche Gesamtbeurteilung gilt?', c.LEVN[v], c.LEV.filter(x => x !== v).map(x => c.LEVN[x]),
        'Beurteile jeden Wert einzeln: Lot ' + c.LEVN[ls[0]] + ', Winkel ' + c.LEVN[ls[1]] + ', Füllung ' + c.LEVN[ls[2]] + '. Das schlechteste Ergebnis bestimmt die Gesamtbeurteilung: ' + c.LEVN[v] + '.', ['Beurteile Lotmenge, Winkel und Füllung einzeln.', 'Das schlechteste Einzelurteil entscheidet.']);
    },
    /* SMD und Reflow */
    bauform: pq(BAUQ), smdhand: pq(SHQ), paste: pq(PAQ), zone: pq(ZOQ), grab: pq(GBQ),
    smdcode: R => {
      const c = C(), d = c.pick(R, ZIFFERN), m = c.ri(R, 2, 4), code = String(d) + m, ohm = c.smdOhm(code), k = ohm / 1000;
      return numQ('Auf einem SMD-Widerstand im Modellbetrieb steht der Code "' + code + '". Die ersten beiden Ziffern sind der Wert, die letzte ist die Anzahl der Nullen. Wie groß ist der Widerstand?', k, 'kΩ', 'Widerstand', 0.005,
        'Die ersten Ziffern ' + f(d, 0) + ' bilden den Wert, die letzte Ziffer ' + f(m, 0) + ' gibt die Anzahl der Nullen: ' + f(ohm, 0) + ' Ω = ' + f(k, 3) + ' kΩ.', ['Trenne die letzte Ziffer ab.', 'Hänge so viele Nullen an, wie die letzte Ziffer sagt.']);
    },
    tal: R => {
      const c = C(), al = c.ALLOYS.sac, peak = c.pick(R, [240, 245, 250]), up = c.pick(R, [1, 1.5, 2]), down = c.pick(R, [2, 3, 4]), hold = c.pick(R, [10, 15, 20]), v = c.talSimple(peak, al.tm, up, down, hold), dT = peak - al.tm;
      return numQ('Ein bleifreies Reflow-Profil im Modellbetrieb (Schmelztemperatur 217 °C): Über 217 °C steigt die Temperatur mit ' + f(up, 1) + ' K/s bis zur Spitze von ' + f(peak, 0) + ' °C, bleibt dort ' + f(hold, 0) + ' s und fällt dann mit ' + f(down, 1) + ' K/s wieder auf 217 °C. Wie lange ist das Lot flüssig (Zeit über der Schmelztemperatur)?', v, 's', 'Zeit über Schmelztemperatur', 0.1,
        'Anstieg: ' + f(dT, 0) + ' K / ' + f(up, 1) + ' K/s = ' + f(dT / up, 1) + ' s. Spitze: ' + f(hold, 0) + ' s. Abfall: ' + f(dT, 0) + ' K / ' + f(down, 1) + ' K/s = ' + f(dT / down, 1) + ' s. Summe: ' + f(v, 1) + ' s.', ['Teile die Strecke in drei Abschnitte: Anstieg, Spitze, Abfall.', 'Zeit = Temperaturunterschied durch Rate.']);
    },
    aufheiz: R => {
      const c = C(), b = c.pick(R, [100, 150, 180]), rate = c.pick(R, [0.5, 1, 1.25, 2, 2.5]), t = c.rampTime(25, b, rate);
      return numQ('Der Ofen im Modellbetrieb heizt die Baugruppe mit ' + f(rate, 2) + ' K/s auf. Sie startet bei 25 °C. Wie lange dauert es, bis sie ' + f(b, 0) + ' °C erreicht?', t, 's', 'Aufheizzeit', 0.1,
        'Temperaturunterschied: ' + f(b, 0) + ' − 25 = ' + f(b - 25, 0) + ' K. Zeit = Unterschied durch Rate = ' + f(b - 25, 0) + ' K / ' + f(rate, 2) + ' K/s = ' + f(t, 1) + ' s.', ['Wie viel Kelvin müssen dazukommen?', 'Zeit = Unterschied durch Rate.']);
    },
    rfurteil: R => {
      const c = C(), k = c.pick(R, Object.keys(RFB)), p = { up: c.pick(R, [1.2, 1.5, 2, 2.5]), hold: c.ri(R, 7, 11) * 10, peak: c.ri(R, 49, 51) * 5, down: c.pick(R, [1.5, 2, 2.5, 3]), alloy: 'sac' };
      if (k === 'anstieg') p.up = c.pick(R, [4, 4.5, 5]);
      if (k === 'halten') p.hold = c.pick(R, [25, 30, 35, 170, 180]);
      if (k === 'spitze') p.peak = c.pick(R, [222, 226, 268, 272, 278]);
      if (k === 'kuehl') p.down = c.pick(R, [6.5, 7, 8]);
      return choiceQ(R, 'Ein bleifreies Reflow-Profil im Modellbetrieb: Aufheizrate ' + f(p.up, 1) + ' K/s, Haltezeit ' + f(p.hold, 0) + ' s bei 150 bis 180 °C, Spitze ' + f(p.peak, 0) + ' °C, Abkühlrate ' + f(p.down, 1) + ' K/s. Richtwerte: Aufheizen höchstens 3 K/s, Halten 60 bis 120 s, Spitze unter 260 °C und am großen Bauteil über 232 °C, Abkühlen höchstens 4 K/s. Welche Einstellung ist das Hauptproblem?', RFB[k], Object.keys(RFB).filter(x => x !== k).map(x => RFB[x]),
        'Vergleiche jeden Wert mit dem Richtwert. Nur ' + RFB[k] + ' liegt außerhalb, die anderen sind in Ordnung.', ['Gehe die vier Einstellungen der Reihe nach durch.', 'Genau eine liegt außerhalb des Richtwerts.']);
    },
    /* Klassen und Qualität */
    klassen: pq(KLQ), stufen: pq(STQ), aoi: pq(AOQ),
    fehlq: R => {
      const c = C(), n = c.pick(R, [250, 400, 500, 800, 1200]), e = c.ri(R, 3, 20), v = c.perHundred(e, n);
      return numQ('Im Modellbetrieb wurden ' + f(n, 0) + ' Lötstellen geprüft, davon waren ' + f(e, 0) + ' fehlerhaft. Wie hoch ist die Fehlerquote in Prozent?', v, '%', 'Fehlerquote', 0.01,
        'Fehlerquote = fehlerhafte durch geprüfte mal 100: ' + f(e, 0) + ' / ' + f(n, 0) + ' · 100 = ' + f(v, 2) + ' %.', ['Fehlerhafte durch geprüfte Lötstellen.', 'Für Prozent mal 100.']);
    },
    dpmo: R => {
      const c = C(), b = c.pick(R, [200, 250, 400, 500, 1000]), per = c.pick(R, [120, 200, 300, 450]), e = c.ri(R, 3, 12), v = c.dpmo(e, b, per);
      return numQ('Im Modellbetrieb wurden ' + f(b, 0) + ' Baugruppen mit je ' + f(per, 0) + ' Lötstellen gefertigt. Bei der Prüfung wurden ' + f(e, 0) + ' fehlerhafte Lötstellen gefunden. Wie viele Fehler sind das je eine Million Lötstellen (ppm)?', v, 'ppm', 'Fehler je Million', 1,
        'Lötstellen gesamt: ' + f(b, 0) + ' · ' + f(per, 0) + ' = ' + f(b * per, 0) + '. Anteil: ' + f(e, 0) + ' / ' + f(b * per, 0) + ' = ' + f(e / (b * per), 6) + '. Mal eine Million: ' + f(v, 1) + ' ppm.', ['Wie viele Lötstellen sind es insgesamt?', 'Anteil mal eine Million.']);
    },
    pareto: R => {
      const c = C(), N = ['Lötbrücke', 'Kalte Lötstelle', 'Zu wenig Lot', 'Lotkugeln', 'Grabstein'], cnt = c.shuffle(R, [4, 7, 9, 12, 15, 18, 22, 28, 35]).slice(0, 5), items = N.map((k, i) => ({ k, n: cnt[i] })), pa = c.pareto(items), v = pa[1].cum, tot = cnt.reduce((a, b) => a + b, 0);
      return numQ('Im Modellbetrieb wurden in einer Woche folgende Fehler gezählt: ' + items.map(x => x.k + ' ' + x.n).join(', ') + '. Wie viel Prozent aller Fehler machen die zwei häufigsten Fehlerarten zusammen aus?', v, '%', 'Anteil', 0.1,
        'Gesamt: ' + f(tot, 0) + ' Fehler. Absteigend: ' + pa.map(x => x.k + ' ' + x.n).join(', ') + '. Die zwei häufigsten: ' + f(pa[0].n, 0) + ' + ' + f(pa[1].n, 0) + ' = ' + f(pa[0].n + pa[1].n, 0) + '. Anteil: ' + f(pa[0].n + pa[1].n, 0) + ' / ' + f(tot, 0) + ' · 100 = ' + f(v, 1) + ' %.', ['Addiere alle Fehler.', 'Nimm die zwei größten Zahlen.']);
    },
    zehn: R => {
      const c = C(), base = c.pick(R, [0.5, 1, 2, 4]), st = c.ri(R, 1, 3), n = c.ri(R, 3, 12), v = c.costTen(n, st, base), S = ['Lötprüfung', 'Funktionstest', 'Endprüfung', 'beim Kunden'];
      return numQ('Nach der Zehnerregel wird ein Fehler mit jeder späteren Prüfstufe zehnmal so teuer. Im Modellbetrieb kostet ein Fehler bei der Lötprüfung ' + f(base, 2) + ' €. Die Stufen sind: Lötprüfung, Funktionstest, Endprüfung, beim Kunden. Was kosten ' + f(n, 0) + ' Fehler, die erst ' + S[st] + ' auffallen?', v, '€', 'Kosten', 0.01,
        'Von der Lötprüfung bis ' + S[st] + ' sind es ' + f(st, 0) + (st === 1 ? ' Stufe' : ' Stufen') + ': Faktor 10^' + f(st, 0) + ' = ' + f(Math.pow(10, st), 0) + '. Kosten je Fehler: ' + f(base, 2) + ' · ' + f(Math.pow(10, st), 0) + ' = ' + f(base * Math.pow(10, st), 2) + ' €. Mal ' + f(n, 0) + ' Fehler: ' + f(v, 2) + ' €.', ['Zähle, wie viele Stufen später es ist.', 'Jede Stufe mal 10.']);
    },
    /* ESD und Arbeitsschutz */
    esd: pq(ESQ), arbeit: pq(ARQ), verp: pq(VPQ),
    armband: R => {
      const c = C(), Rm = c.pick(R, [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 4.7]), v = c.strapMicroA(230, Rm);
      return numQ('Das Erdungsarmband im Modellbetrieb hat einen Schutzwiderstand von ' + f(Rm, 1) + ' MΩ. Im Fehlerfall berührt der Träger 230 V gegen Erde. Wie groß ist der Strom durch den Körper? Rechne mit dem Widerstand des Armbands allein.', v, 'µA', 'Strom', 0.5,
        'I = U / R = 230 V / ' + f(Rm, 1) + ' MΩ = ' + f(v, 1) + ' µA. Das ist viel weniger als die Schwelle, die für Menschen gefährlich wird. Genau dafür ist der Widerstand im Armband. Ein Schutz gegen elektrischen Schlag ist das Armband trotzdem nicht: An offenen Teilen unter Netzspannung arbeitest du nur mit Freigabe und unter Aufsicht einer Elektrofachkraft.', ['Ohmsches Gesetz: I = U / R.', 'V geteilt durch MΩ ergibt µA.']);
    },
    tau: R => {
      const c = C(), Rm = c.pick(R, [1, 10]), Cp = c.pick(R, [47, 100, 150, 220]), v = c.tauUs(Rm, Cp);
      return numQ('Ein aufgeladenes Bauteil mit ' + f(Cp, 0) + ' pF wird über einen ableitenden Widerstand von ' + f(Rm, 0) + ' MΩ entladen. Wie groß ist die Zeitkonstante τ = R · C?', v, 'µs', 'Zeitkonstante', 0.5,
        'τ = R · C = ' + f(Rm, 0) + ' MΩ · ' + f(Cp, 0) + ' pF = ' + f(v, 0) + ' µs. Nach etwa fünf Zeitkonstanten ist das Bauteil praktisch entladen.', ['MΩ mal pF ergibt direkt µs.', 'τ = R · C.']);
    },
    /* Nacharbeit und Entlöten */
    entloet: pq(ENQ), grenzen: pq(GRZ),
    nachab: R => folgeQ(R, NACHAB, 'Du arbeitest eine Lötstelle im Modellbetrieb nach.', 'Erst klären und schützen, dann wärmen, dann prüfen.'),
    nachzeit: R => {
      const c = C(), n = c.ri(R, 6, 24), sec = c.pick(R, [30, 45, 60, 90]), ex = c.pick(R, [5, 10, 15]), v = c.reworkMin(n, sec, ex);
      return numQ('Im Modellbetrieb müssen ' + f(n, 0) + ' Lötstellen einer Baugruppe nachgearbeitet werden. Jede dauert ' + f(sec, 0) + ' s. Zusätzlich brauchst du ' + f(ex, 0) + ' min für Vorbereitung und Prüfung. Wie lange dauert die Nacharbeit in Minuten?', v, 'min', 'Dauer', 0.1,
        'Nacharbeit: ' + f(n, 0) + ' · ' + f(sec, 0) + ' s = ' + f(n * sec, 0) + ' s = ' + f(n * sec / 60, 2) + ' min. Dazu ' + f(ex, 0) + ' min: ' + f(v, 2) + ' min.', ['Rechne die Sekunden in Minuten um.', 'Addiere die Vorbereitung.']);
    }
  };

  /* So gehst du vor: die erwarteten Schritte je Generator */
  const WISS = ['Lies die Frage ganz und markiere das Stichwort.', 'Streiche zuerst die Antworten, die sicher falsch sind.', 'Wähle die Antwort, die zum Stichwort passt, und tippe auf Prüfen.'];
  const HOW = {
    ueber: ['Lies die Spitzentemperatur und die Schmelztemperatur ab.', 'Rechne Spitze minus Schmelztemperatur.', 'Schreibe das Ergebnis in Kelvin.'],
    schritt: ['Suche den erledigten Schritt in deiner Vorstellung vom Ablauf.', 'Frage dich: Was kommt als Nächstes?', 'Wähle genau diesen Schritt.'],
    draht: ['Rechne das Volumen des Zylinders: π/4 · d² · l.', 'Multipliziere mit der Dichte, 7,4 mg je mm³.', 'Runde sinnvoll und schreibe in mg.'],
    szen: ['Vergleiche jede Einstellung mit dem üblichen Wert.', 'Finde die eine Einstellung, die abweicht.', 'Wähle die dazu passende Ursache.'],
    fehlerbild: ['Beschreibe in Gedanken Form, Oberfläche und Winkel.', 'Vergleiche mit den Fehlerbildern im Reiter Fehlerbilder.', 'Wähle das Fehlerbild, das alle Merkmale trifft.'],
    winkel: ['Lies den Winkel und die Grenzen der Stufen ab.', 'Sortiere den Winkel in die passende Spanne.', 'Wähle die zugehörige Stufe.'],
    durchst: ['Lies Lothöhe und Plattendicke ab.', 'Teile die Lothöhe durch die Plattendicke.', 'Mal 100 ergibt Prozent.'],
    benetz: ['Lies beide Durchmesser ab.', 'Teile benetzter Durchmesser durch Lötaugendurchmesser und quadriere.', 'Mal 100 ergibt Prozent.'],
    kuerz: ['Lies den Überstand und das Ziel ab.', 'Rechne Überstand minus Ziel.', 'Schreibe das Ergebnis in mm.'],
    urteil: ['Beurteile Lotmenge, Winkel und Füllung einzeln mit den Grenzen.', 'Suche die schlechteste Einzelstufe.', 'Sie ist die Gesamtbeurteilung.'],
    smdcode: ['Trenne die letzte Ziffer vom Rest ab.', 'Hänge so viele Nullen an den Rest, wie die letzte Ziffer sagt.', 'Rechne in kΩ um (durch 1000).'],
    tal: ['Rechne den Temperaturunterschied zwischen Spitze und Schmelztemperatur.', 'Berechne die Zeit für Anstieg und Abfall, addiere die Spitzenzeit.', 'Schreibe die Summe in Sekunden.'],
    aufheiz: ['Rechne den Temperaturunterschied zur Zieltemperatur.', 'Teile ihn durch die Heizrate.', 'Schreibe das Ergebnis in Sekunden.'],
    rfurteil: ['Vergleiche jeden Wert mit seinem Richtwert.', 'Finde den Wert, der außerhalb liegt.', 'Wähle die zugehörige Einstellung.'],
    fehlq: ['Lies fehlerhafte und geprüfte Lötstellen ab.', 'Teile fehlerhafte durch geprüfte.', 'Mal 100 ergibt Prozent.'],
    dpmo: ['Rechne alle Lötstellen aus: Baugruppen mal Lötstellen je Baugruppe.', 'Teile die Fehler durch diese Zahl.', 'Mal eine Million ergibt ppm.'],
    pareto: ['Addiere alle Fehler zur Gesamtzahl.', 'Suche die beiden größten Zahlen und addiere sie.', 'Teile durch die Gesamtzahl, mal 100.'],
    zehn: ['Zähle, wie viele Stufen später der Fehler auffällt.', 'Multipliziere die Kosten mit 10 für jede Stufe.', 'Multipliziere mit der Anzahl der Fehler.'],
    armband: ['Lies Spannung und Widerstand ab.', 'Rechne I = U / R.', 'V durch MΩ ergibt µA.'],
    tau: ['Lies Widerstand und Kapazität ab.', 'Multipliziere R mal C.', 'MΩ mal pF ergibt µs.'],
    nachab: ['Denke an den Weg von der Ursache bis zur Dokumentation.', 'Finde den erledigten Schritt.', 'Wähle den nächsten.'],
    nachzeit: ['Rechne die Zeit aller Lötstellen in Sekunden.', 'Wandle in Minuten um (durch 60).', 'Addiere die Vorbereitung.']
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    [0, 1, 'Was beim Löten passiert', 'grund'], [0, 1, 'Wozu Flussmittel', 'flux'], [0, 2, 'Spitze und Schmelztemperatur', 'ueber'], [0, 1, 'Bleifrei und bleihaltig', 'bleifrei'], [0, 1, 'Reihenfolge beim Handlöten', 'schritt'], [0, 2, 'Lot in einem Drahtstück', 'draht'], [0, 2, 'Wärme und Zeit', 'ursache'], [0, 2, 'Ursache finden', 'szen'],
    [1, 1, 'Gute Lötstelle erkennen', 'meni'], [1, 1, 'Fehlerbild benennen', 'fehlerbild'], [1, 2, 'Ursache des Fehlers', 'fehlursache'], [1, 2, 'Benetzungswinkel einstufen', 'winkel'], [1, 2, 'Füllung der Hülse', 'durchst'], [1, 2, 'Benetzte Fläche', 'benetz'], [1, 1, 'Überstand kürzen', 'kuerz'], [1, 3, 'Gesamturteil aus Messwerten', 'urteil'],
    [2, 1, 'Bauform lesen', 'bauform'], [2, 2, 'Wert aus dem Code', 'smdcode'], [2, 1, 'SMD von Hand löten', 'smdhand'], [2, 1, 'Lotpaste', 'paste'], [2, 2, 'Zonen im Reflow-Ofen', 'zone'], [2, 3, 'Zeit über der Schmelztemperatur', 'tal'], [2, 2, 'Aufheizzeit', 'aufheiz'], [2, 2, 'Grabstein', 'grab'], [2, 3, 'Profil beurteilen', 'rfurteil'],
    [3, 1, 'Produktklassen', 'klassen'], [3, 2, 'Zielzustand bis Fehler', 'stufen'], [3, 2, 'Fehlerquote in Prozent', 'fehlq'], [3, 3, 'Fehler je Million', 'dpmo'], [3, 3, 'Häufigste Fehlerarten', 'pareto'], [3, 2, 'Prüfverfahren', 'aoi'], [3, 3, 'Kosten nach der Zehnerregel', 'zehn'],
    [4, 1, 'ESD verstehen', 'esd'], [4, 2, 'Strom durch das Armband', 'armband'], [4, 3, 'Entladezeit', 'tau'], [4, 1, 'Sicher am Lötplatz', 'arbeit'], [4, 1, 'ESD-gerecht verpacken', 'verp'],
    [5, 1, 'Entlöten mit Werkzeug', 'entloet'], [5, 2, 'Ablauf der Nacharbeit', 'nachab'], [5, 2, 'Grenzen der Nacharbeit', 'grenzen'], [5, 2, 'Zeit für die Nacharbeit', 'nachzeit']
  ];
  const tasks = defs.map((d, i) => ({ id: 'lot' + (i + 1), cat: CATS[d[0]], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; q.how = HOW[t.gen] || WISS; return q;
  }
  const makeTask = t => make(t, C().rng('lot-' + t.id));
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.LOT_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, defects: DEFECTS, devs: DEV, pools: { GRQ, FLQ, BFQ, URQ, MEQ, FUQ, BAUQ, SHQ, PAQ, ZOQ, GBQ, KLQ, STQ, AOQ, ESQ, ARQ, VPQ, ENQ, GRZ }, steps: { SCHRITTE, NACHAB } };
  root.LOT_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.LOT_DATA, TASKS: root.LOT_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
