'use strict';
/* Tonfunk Maschinen-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Beispiele).
   ALLE Richtwerte, Zeiten und Regeln sind ÜBUNGSWERTE für die Ausbildung; maßgebend sind Maschinentafel, Tabellenbuch, Werkzeughersteller und die Betriebsanweisung der Werkstatt.
   window.MAK_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools }
   window.MAK_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'mak', Status in localStorage 'lm4.mak.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Frageformen (q.ask.type): 'choice', 'num', 'order', 'match', 'key' (Taste im CNC-Bedienfeld antippen). q.viz beschreibt die Zeichnung zur Aufgabe: { t: 'machine'|'tafel'|'panel'|'pratze', ... }.
   Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder Ergebnis noch Fehlerursache (Fehlersuchen heißen "Fehlerbild A" bis "C"); Zeichnungen zeigen in Aufgaben nur die Maschine, eine Markierung oder die Tafel, nie die Lösung. */
(function (root) {
  const C = () => root.MAK_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Maschinenkunde', 'Bedienelemente', 'Tafeln lesen', 'Sicherheit an Maschinen', 'Spannen und Werkzeuge', 'Maschinenwahl', 'CNC-Bedienung', 'Fehlersuche'];

  /* ---------- Frageformen ---------- */
  const numQ = (text, value, unit, label, tol, expl, tips, viz) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, viz });
  function choiceQ(R, text, right, wrong, expl, tips, viz) {
    const seen = {}; seen[right] = 1; const w = []; wrong.forEach(x => { if (!seen[x]) { seen[x] = 1; w.push(x); } });
    const ch = C().shuffle(R, [right].concat(w));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, viz };
  }
  function orderQ(R, text, items, expl, tips, viz) {
    let idx = items.map((_, i) => i), sh = idx, tries = 0;
    do { sh = C().shuffle(R, idx); tries++; } while (sh.every((v, i) => v === i) && tries < 20);
    return { text, ask: { type: 'order', items: sh.map(i => items[i]), correct: items.map((_, k) => sh.indexOf(k)) }, value: 0, tol: 0, expl, tips, viz };
  }
  function matchQ(R, text, rows, options, corr, expl, tips, viz) {
    const sh = C().shuffle(R, options.map((_, i) => i));
    return { text, ask: { type: 'match', rows, options: sh.map(i => options[i]), correct: corr.map(c => sh.indexOf(c)) }, value: 0, tol: 0, expl, tips, viz };
  }
  const keyQ = (text, key, expl, tips) => ({ text, ask: { type: 'key', correct: key }, value: 0, tol: 0, expl, tips, viz: { t: 'panel' } });
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const brief = t => { const m = /^[^.!?]+[.!?]/.exec(t); return (m ? m[0] : t).replace(/[.]$/, ''); };
  const mach = id => C().machine(id);
  const LABEL_TIPS = ['Überlege, welche Aufgabe das markierte Teil an dieser Maschine hat.', 'Vergleiche Lage und Form mit den Bauteilen der Auswahl.'];

  /* ---------- Fragen-Pools: [Text, richtig, falsch[3], Erklärung, Tipps[2]] ---------- */
  /* PRUEFEN P25: Not-Aus: roter Pilz auf gelbem Grund, nur für die Gefahr, nach dem Auslösen erst Ursache klären, dann entriegeln und bewusst neu einschalten; bei Maschinen mit Wiederanlaufsperre startet nichts von selbst. Stimmen Wortlaut und Ablauf mit der Betriebsanweisung (z. B. „Wer entriegelt?“) überein? */
  const NOT = [
    ['Wann drückst du den Not-Aus?', 'Wenn Menschen oder die Maschine unmittelbar gefährdet sind', ['Wenn der Bohrer stumpf geworden ist und gewechselt werden muss', 'Immer, wenn du die Maschine am Feierabend ausschaltest', 'Wenn du in Ruhe die Drehzahl am Hebel umstellen möchtest'], 'Der Not-Aus ist für den Gefahrenfall da. Zum normalen Ausschalten gibt es den Aus-Taster.', ['Denke an den Namen: Er ist für den Notfall.', 'Zum Ausschalten im Alltag gibt es einen anderen Taster.']],
    ['Was gilt nach einem ausgelösten Not-Aus?', 'Ursache klären und beseitigen, dann entriegeln und bewusst wieder einschalten', ['Sofort entriegeln und weiterarbeiten, denn die Maschine ist ja gleich wieder bereit', 'Den Not-Aus mit Klebeband überbrücken, damit er beim Arbeiten nicht mehr stört', 'Zwei Minuten warten, dann ohne weitere Prüfung die Maschine neu starten'], 'Ein Not-Aus hat einen Grund. Wer ihn ohne Prüfung zurücksetzt, riskiert, dass die Gefahr noch besteht.', ['Warum wurde der Not-Aus gedrückt?', 'Wer entriegelt, muss die Gefahr kennen.']],
    ['Woran erkennst du einen Not-Aus-Taster?', 'Ein roter Pilztaster auf gelbem Grund', ['Ein grüner Taster mit der Aufschrift I', 'Ein blauer Drehknopf mit Skala', 'Ein schwarzer Schalter ohne Beschriftung'], 'Not-Aus-Geräte sind rot, pilzförmig und sitzen auf gelbem Grund, damit man sie in Gefahr sofort findet.', ['Die Farben sind genormt.', 'Er ist groß, damit man ihn mit der Handfläche trifft.']],
    ['Wo muss ein Not-Aus an der Maschine sein?', 'Jederzeit schnell erreichbar und nicht zugestellt', ['Hinter der Maschine, damit niemand versehentlich drückt', 'Im Schrank, damit er geschützt ist', 'Nur am Hauptschalter im Nebenraum'], 'Im Notfall zählt jede Sekunde. Der Weg zum Not-Aus muss frei bleiben.', ['Wie schnell kommst du im Notfall heran?', 'Zugestellt heißt: nicht erreichbar.']],
    ['Nach dem Entriegeln des Not-Aus startet die Maschine nicht von selbst. Warum ist das so gewollt?', 'Ungewollter Wiederanlauf wird verhindert: Man muss bewusst neu einschalten', ['Der Motor muss nach dem Not-Aus erst abkühlen und startet deshalb nicht', 'Die Maschine gilt nach jedem Not-Aus als defekt und muss repariert werden', 'Das Entriegeln dauert immer eine Minute, erst dann ist die Steuerung bereit'], 'Die Wiederanlaufsperre schützt Personen, die noch im Arbeitsbereich sein könnten.', ['Stell dir vor, jemand greift noch in den Arbeitsraum.', 'Absichtliches Einschalten ist Teil des Konzepts.']]
  ];
  /* PRUEFEN P18: Sicherheitsregeln (Haare, Schmuck, Handschuhe, Kleidung, Schutzbrille, Späne nur mit Haken oder Pinsel, Werkstück spannen statt halten, Futterschlüssel abziehen) sind allgemein bekannte Regeln der Unfallverhütung in eigenen Worten; die Reihenfolge der Schritte vor dem Start (Aufgabe „Vor dem Start“) ist ein Lehrvorschlag. Stimmt das mit der Betriebsanweisung der Lehrwerkstatt überein (z. B. Handschuhe beim Entgraten, Gehörschutz, Sicherheitsschuhe)? */
  const PSA = [
    ['Du hast lange Haare und willst an der Bohrmaschine arbeiten. Was tust du?', 'Haare zusammenbinden und unter ein Haarnetz stecken', ['Offen lassen, denn sie stören beim Bohren nicht weiter', 'Nur lose mit einem Tuch bedecken, das genügt meistens', 'Nur beim Drehen sichern, beim Bohren ist das nicht nötig'], 'Lange Haare können von drehenden Teilen erfasst werden. Das führt zu schweren Verletzungen. Sie werden immer gesichert.', ['Denke an die drehende Spindel und das Futter.', 'Die Gefahr besteht an jeder drehenden Maschine.']],
    ['Dürfen Handschuhe beim Arbeiten an drehenden Werkzeugen und Werkstücken getragen werden?', 'Nein: Sie können erfasst und mitgerissen werden', ['Ja, sie schützen vor Spänen und sind überall Pflicht', 'Ja, wenn es dünne Stoffhandschuhe sind', 'Nur beim Fräsen nicht, beim Bohren immer'], 'An drehenden Teilen besteht Einzugsgefahr. Handschuhe, Ringe, Uhren und Ketten werden dort nicht getragen.', ['Was passiert, wenn der Handschuh vom Bohrer erfasst wird?', 'Die Gefahr ist bei dünnem Stoff dieselbe.']],
    ['Welchen Schutz trägst du bei Späneflug an der Maschine?', 'Eine Schutzbrille', ['Nur Gehörschutz', 'Eine Sonnenbrille nur bei Sonne', 'Gar nichts, wenn die Maschine ein Gehäuse hat'], 'Späne und Splitter fliegen auch bei einem Spritzschutz. Die Augen werden mit der Schutzbrille geschützt.', ['Welches Körperteil ist durch Späne am stärksten gefährdet?', 'Der Spritzschutz ersetzt die Brille nicht.']],
    ['Was geschieht mit Ringen, Armbändern, Uhren und Ketten vor der Arbeit an Maschinen?', 'Sie werden vor Arbeitsbeginn abgelegt', ['Sie bleiben dran, solange sie fest genug sitzen', 'Sie werden nur unter den Ärmel geschoben', 'Sie werden mit Klebeband am Handgelenk gesichert'], 'Schmuck kann hängen bleiben und Finger oder Hand mitreißen. Deshalb wird er abgelegt.', ['Was kann an einer drehenden Maschine hängen bleiben?', 'Klebeband macht Schmuck nicht sicherer.']],
    ['Welche Kleidung ist an Maschinen geeignet?', 'Eng anliegende Arbeitskleidung mit geschlossenen Ärmeln', ['Eine weite Jacke mit offenen, flatternden Ärmeln', 'Ein langer Schal, der gegen die Zugluft locker um den Hals hängt', 'Ein Kapuzenpullover mit langen, locker herabhängenden Kordeln'], 'Lose Kleidung kann von drehenden Teilen eingezogen werden. Ärmel werden geschlossen oder aufgekrempelt.', ['Nichts Loses oder Hängendes.', 'Eng anliegend ist die Regel.']],
    ['Welche Schuhe trägst du in der mechanischen Werkstatt?', 'Geschlossene, feste Schuhe nach Vorgabe der Werkstatt', ['Offene Sandalen, weil es in der Halle warm ist', 'Weiche Hausschuhe, in denen man bequem stehen kann', 'Barfuß, weil das am rutschfestesten ist, wenn es nass wird'], 'Heiße, scharfe Späne und herabfallende Teile verletzen Füße. Festes Schuhwerk ist Pflicht.', ['Was fällt auf den Boden?', 'Offene Schuhe schützen nicht vor Spänen.']]
  ];
  const SPAN = [
    ['Wie entfernst du Späne an der Maschine?', 'Maschine stillsetzen, dann mit Handfeger, Pinsel oder Haken entfernen', ['Mit der bloßen Hand schnell wegwischen, solange sie noch läuft', 'Mit Druckluft vom Körper weg in Richtung Hallenmitte wegblasen', 'Mit einem Lappen bei laufender Spindel in einem Zug abwischen'], 'Späne sind scharf und oft heiß. Man berührt sie nicht mit der Hand, sondern nimmt Haken, Handfeger oder Pinsel, und nur bei Stillstand.', ['Womit ist deine Hand geschützt?', 'Die Maschine muss stehen.']],
    ['Warum bläst man Späne nicht mit Druckluft weg?', 'Die Späne fliegen als Geschosse umher und verletzen Augen und Haut', ['Druckluft verbraucht zu viel Strom und ist deshalb im Betrieb untersagt', 'Die Maschine rostet davon, weil die Luft immer etwas Feuchtigkeit enthält', 'Druckluft kühlt das Werkstück beim Zerspanen zu stark ab'], 'Mit Druckluft werden Späne und Staub wild verteilt. Das ist gefährlich für alle in der Nähe. Man fegt oder saugt ab.', ['Wohin fliegen die Späne?', 'Denke an die Augen der anderen Personen.']],
    ['Ein langer Span hat sich am Werkzeug verfangen. Was tust du?', 'Maschine stoppen, warten bis alles steht, dann mit dem Haken entfernen', ['Mit der Hand schnell zugreifen und den langen Span einfach abreißen', 'Mit einer Zange bei laufender Spindel vorsichtig herausziehen', 'Die Drehzahl erhöhen, damit der Span von selbst abbricht und herausfliegt'], 'Fließspäne sind gefährlich scharf und können Hand und Arm mitziehen. Nur bei Stillstand und mit Hilfsmittel entfernen.', ['Erst Stillstand, dann Hilfsmittel.', 'Eine höhere Drehzahl macht den Span nicht ungefährlicher.']],
    ['Warum sind Späne gefährlich?', 'Sie sind scharfkantig und oft sehr heiß', ['Sie sind giftig und gehören in Dosen', 'Sie sind magnetisch und ziehen Werkzeug an', 'Sie rosten sofort und färben die Haut'], 'Späne schneiden und verbrennen. Deshalb gilt: nie mit der Hand anfassen.', ['Denke an die Kanten beim Abtrennen.', 'Sie sind direkt nach der Zerspanung warm.']],
    ['Wohin gehören die Späne nach der Arbeit?', 'In den vorgesehenen Spänebehälter, nach Werkstoff getrennt', ['In den normalen Restmüll, so wie anderer Abfall auch', 'Auf dem Boden liegen lassen, der Staubsauger holt sie später', 'Unter die Werkbank schieben, wo sie niemanden stören'], 'Späne gehören in die Behälter für Metallabfall, damit sie verwertet werden können und niemand ausrutscht oder sich schneidet.', ['Metall wird recycelt.', 'Auf dem Boden besteht Rutsch- und Schnittgefahr.']]
  ];
  const SPH = [
    ['Du willst ein kleines Teil bohren. Wie sicherst du es?', 'Im Maschinenschraubstock oder mit Spannelementen am Tisch spannen', ['Mit der Hand festhalten und beim Durchbruch kurz nachlassen, das geht schneller', 'Mit einer Zange in der freien Hand halten, dann bleibt die andere frei', 'Auf dem Tisch liegen lassen, die Reibung genügt bei kleinen Teilen'], 'Ein Werkstück wird immer gespannt, nie gehalten. Das Bohrmoment kann es herumschleudern.', ['Die Bohrkraft will das Teil mitdrehen.', 'Spannen statt halten.']],
    ['Was kann passieren, wenn ein ungespanntes Blech vom Bohrer erfasst wird?', 'Es dreht sich mit, wird weggeschleudert und verletzt schwer', ['Nichts, das Blech bleibt durch sein Gewicht sicher auf dem Tisch liegen', 'Der Bohrer wird nur stumpfer, das Blech bleibt unversehrt', 'Die Maschine schaltet beim Erfassen automatisch von selbst ab'], 'Beim Durchbruch wird das Blech vom Bohrer gepackt und rotiert mit. Schnittverletzungen sind die Folge.', ['Wann ist die Gefahr am größten? Beim Durchbruch.', 'Es gibt keine automatische Abschaltung dafür.']],
    ['Beim Durchbohren im Schraubstock ist zu beachten:', 'Unterlagen unterlegen, damit der Bohrer nicht in die Backen oder den Tisch bohrt', ['Den Bohrer ohne Unterlage bis in den Tisch durchfahren lassen, das gibt nur eine kleine Marke', 'Das Werkstück nur leicht klemmen, damit es sich beim Bohren selbst ausrichtet', 'Den Schraubstock lose auf den Tisch stellen und nur mit der Hand halten'], 'Der Bohrer darf weder die Backen noch den Tisch beschädigen. Das Werkstück muss dabei fest sitzen.', ['Wohin läuft der Bohrer nach dem Durchbruch?', 'Fest klemmen, nicht locker.']],
    ['Warum wird der Maschinenschraubstock beim Bohren am Tisch befestigt oder festgehalten?', 'Er darf sich nicht mitdrehen, sonst wird er mit dem Teil herumgeschleudert', ['Damit der Tisch nicht verkratzt wird, wenn der Schraubstock beim Bohren verrutscht', 'Das ist nur bei sehr großen und schweren Schraubstöcken überhaupt nötig', 'Damit er nicht verrostet, wenn Kühlschmierstoff auf ihm stehen bleibt'], 'Das Drehmoment des Bohrers wirkt auf den Schraubstock. Er wird gegen Mitdrehen gesichert (Anschlag oder Spannung).', ['Das Drehmoment wirkt auf alles, was nicht gesichert ist.', 'Auch kleine Schraubstöcke drehen mit.']],
    ['Wie sitzt ein Werkstück im Schraubstock richtig?', 'Satt an den Backen, nicht zu weit herausstehend, fest angezogen', ['Nur an der Kante der Backen, damit möglichst viel Teil herausragt', 'Möglichst weit herausstehend, damit man die Bohrstelle gut sieht', 'Lose, denn es zieht sich beim Bohren von selbst fest'], 'Kleine Auflageflächen und lockerer Sitz führen zum Verrutschen. Je weiter ein Teil heraussteht, desto eher biegt es sich oder kippt weg.', ['Fläche und Sitz müssen stimmen.', 'Je kürzer der Überstand, desto stabiler.']]
  ];
  /* PRUEFEN P19: Kühlschmierstoff: Stahl beim Bohren mit Emulsion oder Bohröl, Grauguss meist trocken, Absaugung bei staubenden Werkstoffen (Hartgewebe, Kunststoff, Graphit), Hautschutz und Rutschgefahr. Stimmen die Zuordnungen mit eurer Praxis (Aluminium, Messing, Kunststoff)? */
  const KSS = [
    ['Wozu dient Kühlschmierstoff?', 'Zum Kühlen, Schmieren und zum Abführen der Späne aus der Schneidzone', ['Nur zum Reinigen der Maschine am Ende des Arbeitstages', 'Nur zum Schutz gegen Rost am fertigen Werkstück nach der Bearbeitung', 'Damit die Spindel mit einer höheren Drehzahl laufen kann'], 'Kühlschmierstoff nimmt Wärme auf, verringert die Reibung und spült Späne aus der Schneidzone. Das schont Werkzeug und Oberfläche.', ['Es sind drei Aufgaben.', 'Wärme und Reibung sind die Probleme beim Zerspanen.']],
    ['Worauf achtest du im Umgang mit Kühlschmierstoff?', 'Hautschutz beachten und verschüttetes Mittel sofort aufnehmen (Rutschgefahr)', ['Er ist völlig ungefährlich, deshalb braucht man nie einen Hautschutz zu verwenden', 'Mit bloßen Händen die Späne in der Emulsion prüfen und aussortieren', 'Verschüttetes Mittel mit Druckluft schnell in die Ecke wegblasen'], 'Kühlschmierstoffe können die Haut reizen und den Boden rutschig machen. Schutz und Sauberkeit gehören dazu.', ['Haut und Boden sind betroffen.', 'Druckluft verteilt Tröpfchen und Späne.']],
    ['Wann ist die Absaugung an der Maschine einzuschalten?', 'Bei staubenden Werkstoffen wie Hartgewebe, Kunststoff oder Graphit', ['Nur dann, wenn niemand sonst in der Halle ist und es ruhig bleibt', 'Nie, denn sie macht die Späne feucht und die Maschine schmutzig', 'Nur beim Zerspanen von Messing, weil dessen Späne besonders stauben'], 'Feiner Staub aus Hartgewebe oder Kunststoff gelangt in die Atemwege. Die Absaugung hält die Luft sauber.', ['Wo entsteht feiner Staub?', 'Die Absaugung dient der Gesundheit.']],
    ['Was ist beim Bohren von Stahl üblich?', 'Mit Emulsion oder Bohröl kühlen und schmieren', ['Stahl wird grundsätzlich immer trocken gebohrt, ohne Kühlung', 'Nur mit Wasser ohne Zusatz', 'Eine Kühlung wird nie gebraucht'], 'Beim Bohren in Stahl entsteht viel Wärme. Mit Emulsion oder Bohröl wird die Schneide geschont und die Oberfläche besser.', ['Stahl erwärmt sich stark.', 'Der Bohrer bleibt dadurch länger scharf.']],
    ['Beim Zerspanen von Grauguss ist es üblich, dass er …', 'trocken zerspant, der Staub wird dabei abgesaugt', ['immer mit viel Emulsion überflutet, damit er kühl bleibt', 'reichlich mit Bohröl getränkt, bevor man beginnt', 'nur unter Wasser in einem Becken bearbeitet'], 'Grauguss bildet kurze, bröselige Späne und Graphitstaub. Meist wird trocken gearbeitet und abgesaugt.', ['Der Span ist kurz und staubig.', 'Emulsion bildet mit dem Staub Schlamm.']]
  ];
  const BF = [
    ['Was machst du sofort nach dem Spannen des Bohrers im Zahnkranzfutter?', 'Den Futterschlüssel sofort wieder abziehen', ['Den Schlüssel stecken lassen, bis die Arbeit fertig ist', 'Den Schlüssel neben die Maschine legen', 'Den Schlüssel mit Klebeband am Futter sichern'], 'Ein steckengebliebener Schlüssel wird beim Einschalten weggeschleudert. Er wird sofort abgezogen.', ['Was geschieht beim Einschalten mit dem Schlüssel?', 'Das gilt auch an der Drehmaschine.']],
    ['Wie wird ein Bohrer im Zahnkranzfutter gespannt?', 'Zentrisch und fest, an allen Löchern des Futters nachgezogen', ['Nur an einem einzigen Loch leicht angezogen, das reicht', 'Schräg eingesetzt, weil er so beim Anbohren besser greift und nicht wandert', 'Mit einem Hammer festgeschlagen, damit er sicher klemmt'], 'Nur an allen drei Löchern angezogen sitzt der Bohrer zentrisch und fest. Ein schiefer oder loser Bohrer bricht oder rutscht.', ['Das Futter hat mehrere Spannstellen.', 'Hammerschläge beschädigen das Futter.']],
    ['Wann wird der Bohrer gewechselt oder neu gespannt?', 'Nur bei stehender Spindel', ['Während die Spindel langsam läuft', 'Nur bei höchster Drehzahl', 'Bei laufender Maschine mit einer Zange'], 'Die Spindel muss stillstehen, damit nichts erfasst wird.', ['Nichts an drehenden Teilen berühren.', 'Zuerst ausschalten, dann warten.']],
    ['Was ist ein Schnellspannfutter?', 'Ein Futter, das ohne Schlüssel von Hand gespannt wird', ['Ein Futter mit nur zwei Spannbacken für sehr flache Bleche', 'Ein Futter, das nur für Gewindebohrer gedacht ist', 'Ein Futter mit einem eigenen kleinen Elektromotor'], 'Ein Schnellspannfutter wird mit der Hand angezogen. Man erspart sich den Schlüssel, die Spannregeln bleiben dieselben.', ['Es geht ohne Werkzeug.', 'Fest und zentrisch bleibt Pflicht.']],
    ['Welche Bohrer passen in ein Bohrfutter?', 'Bohrer mit zylindrischem Schaft bis zur Spannweite des Futters', ['Bohrer mit jedem beliebigen Durchmesser, denn das Futter passt sich immer an', 'Nur Bohrer, die einen Morsekegel am Schaft haben', 'Nur Bohrer mit einem Sechskantschaft passen hinein'], 'Das Bohrfutter hat einen Spannbereich. Ein Bohrer, der dicker ist, passt nicht hinein.', ['Das Futter hat eine größte Weite.', 'Der Kegelschaft gehört in die Spindel.']]
  ];
  const AUFN = [
    ['Wie hält ein Morsekegel das Werkzeug in der Spindel?', 'Durch Klemmung im Kegel; ein Mitnehmerlappen überträgt das Drehmoment', ['Durch eine Überwurfmutter, die über ein feines Gewinde fest angezogen wird', 'Durch Kleben mit einem Spezialkleber vor jeder Arbeit', 'Durch eine Spannschraube am Schaftende, ohne jede Ausnahme und immer'], 'Der Kegel klemmt sich beim Einstecken fest. Der Lappen am Ende sichert gegen Durchrutschen.', ['Es ist eine Kegelverbindung.', 'Reibung im Kegel hält das Werkzeug.']],
    ['Wie bekommst du ein Werkzeug mit Morsekegel aus der Spindel?', 'Mit einem Austreiberkeil durch den Schlitz der Spindel', ['Mit dem Hammer von unten auf das Werkzeug schlagen', 'Mit der Zange fest umfassen, drehen und herausziehen', 'Die Spindel mit hoher Drehzahl laufen lassen, bis es herausfällt'], 'Der Kegel sitzt fest. Der Keil drückt das Werkzeug aus der Aufnahme, ohne die Spindel zu beschädigen.', ['Es gibt ein Hilfswerkzeug dafür.', 'Schläge beschädigen die Lager.']],
    ['Wozu dient der Reitstock an der Drehmaschine beim Bohren?', 'Er trägt das Bohrfutter mit Bohrer und schiebt es mit der Pinole vor', ['Er treibt das Werkstück an und liefert dafür das gesamte Drehmoment der Maschine', 'Er dreht das Werkstück langsam mit einem kleinen eigenen Motor', 'Er ist ausschließlich für Hartmetall-Bohrer mit Kühlkanal gedacht'], 'Im Reitstock sitzt die Pinole, die Futter oder Körner aufnimmt. Mit dem Handrad fährst du sie aus.', ['Der Reitstock steht am Bettende.', 'Er bewegt nur den Bohrer, nicht das Werkstück.']],
    ['Du willst mit dem Reitstock bohren. Was prüfst du vor dem Start?', 'Reitstock und Pinole sind geklemmt, und der Bohrer läuft zentrisch', ['Der Reitstock darf locker bleiben, weil er sich selbst zentriert', 'Die Pinole bleibt immer ganz ausgefahren, das ist am stabilsten', 'Das Futter sitzt lose, denn es zieht sich beim Bohren von selbst fest'], 'Locker sitzende Teile werden vom Bohrmoment verschoben. Alles muss geklemmt sein.', ['Was darf sich nicht bewegen?', 'Futter und Pinole müssen fest sein.']],
    ['Warum müssen Kegel und Aufnahme sauber sein?', 'Späne dazwischen verhindern den zentrischen, festen Sitz', ['Späne dazwischen sind nur optisch störend, sonst nicht weiter wichtig', 'Sie erhöhen die Haftung und verbessern den Sitz sogar', 'Sauberkeit gilt nur für das Bohrfutter, nicht für Kegel'], 'Schon ein Span im Kegel macht den Rundlauf schlecht und beschädigt die Aufnahme.', ['Ein Span ist dicker, als es aussieht.', 'Genauigkeit braucht Sauberkeit.']]
  ];
  const MTYPES = ['Tischbohrmaschine', 'Ständerbohrmaschine', 'Drehmaschine', 'Fräsmaschine', 'Bohr-Fräsmaschine', 'Vertikalbandsäge', 'CNC-Fräsmaschine'];
  /* PRUEFEN P17: Zuordnung Arbeit → Maschinentyp (kleine Bohrungen Tischbohrmaschine, große Bohrungen Ständerbohrmaschine, Wellen Drehmaschine, Flächen und Nuten Fräsmaschine, Bohrbild und Nut in einer Aufspannung Bohr-Fräsmaschine, Zuschnitt Vertikalbandsäge, Serie nach Programm CNC-Fräsmaschine) und die Grenzen der Maschinen (größter Bohrdurchmesser, Hubweg) sind Faustregeln. Welche Maschine nimmt die Werkstatt für welche Arbeit, und gibt es Größengrenzen (z. B. größter Bohrer an der Tischbohrmaschine)? */
  const JOBS = [
    ['Eine Bohrung mit 4 mm Durchmesser in ein kleines Flachstahlteil', 0, 'Kleine Bohrer brauchen hohe Drehzahlen, das leisten die schnelleren Tischbohrmaschinen. Die Maschine ist klein und handlich.'],
    ['Eine Bohrung mit 25 mm Durchmesser in eine dicke Stahlplatte', 1, 'Große Bohrungen brauchen niedrige Drehzahlen, viel Kraft und einen stabilen Ständer.'],
    ['Eine Welle auf einen bestimmten Durchmesser abdrehen', 2, 'Runde Teile mit Außen- und Innendurchmessern entstehen auf der Drehmaschine: Das Werkstück dreht, das Werkzeug steht.'],
    ['Eine ebene Fläche und eine Nut in einen Block fräsen', 3, 'Flächen und Nuten werden gefräst: Das Werkzeug dreht, das Werkstück wird auf dem Tisch bewegt.'],
    ['Eine Bohrung, eine Nut und ein Bohrbild in einer Aufspannung an einem kleinen Teil', 4, 'Die kleine Bohr-Fräsmaschine verbindet Bohren und Fräsen mit Digitalanzeige; das Teil muss nicht umgespannt werden.'],
    ['Aus einem Blech eine Kontur ausschneiden oder ein Rundstab zuschneiden', 5, 'Die Vertikalbandsäge schneidet Konturen und Zuschnitte aus Blech und Profilen.'],
    ['Eine größere Serie gleicher Frästeile nach Programm mit gleichbleibender Genauigkeit', 6, 'Programmgesteuerte Fertigung mit Wiederholgenauigkeit ist Sache der CNC-Maschine.']
  ];
  const OP = [
    ['Wann dürfen Getriebehebel oder Drehzahlhebel verstellt werden?', 'Nur dann, wenn die Spindel vollständig steht', ['Nur bei voller Drehzahl, damit es leichter geht', 'Jederzeit, die Zahnräder sind abgedeckt', 'Nur beim Bohren, nicht beim Drehen'], 'Zahnräder greifen nur im Stillstand sicher ineinander. Bei laufendem Antrieb wird das Getriebe beschädigt und es besteht Verletzungsgefahr.', ['Auch auf der Maschine steht der Hinweis.', 'Es geht um Zahnräder im Eingriff.']],
    ['Warum darf die zulässige Futterdrehzahl an der Drehmaschine nicht überschritten werden?', 'Die Backen verlieren Spannkraft, das Werkstück kann herausfliegen', ['Der Motor würde dabei unzulässig laut und das Getriebe würde stark verschleißen', 'Das Werkstück würde dabei zu warm und verzieht sich', 'Der Drehmeißel bricht dadurch jedes Mal sofort ab'], 'Durch die Fliehkraft verlieren die Backen an Spannkraft. Auf der Maschine steht ein Hinweis zur größten Drehzahl.', ['Fliehkraft zieht die Backen nach außen.', 'Die Warnung steht an der Maschine.']],
    ['Wie stellst du bei der stufenlosen Drehmaschine die Drehzahlreihe um?', 'Im Stillstand am Hebel H/L, dann am Regler einstellen', ['Während die Spindel läuft, damit der Motor nicht anhält', 'Gar nicht, die Reihe ist fest eingestellt und bleibt', 'Nur nach einem ausgelösten Not-Aus der Maschine'], 'Der Hebel H/N/L wird nur im Stillstand geschaltet. Danach regelt man stufenlos und liest die Zahl ab.', ['Der Hinweis „nur im Stillstand“ steht am Schild.', 'Die Reihe wird mechanisch umgeschaltet.']],
    ['Was zeigt die Zahlenanzeige einer stufenlosen Maschine?', 'Die eingestellte Spindeldrehzahl in min⁻¹', ['Den eingestellten Vorschub in mm je Umdrehung', 'Die berechnete Schnittgeschwindigkeit in m/min', 'Die Temperatur des Motors in Grad Celsius'], 'Der Wert in min⁻¹ ist die Drehzahl. Die Schnittgeschwindigkeit musst du aus Drehzahl und Durchmesser selbst berechnen.', ['Welche Größe wird in min⁻¹ gemessen?', 'vc ist ein berechneter Wert.']],
    ['Du hast beim Anfahren eines Maßes mit dem Handrad den Wert überfahren. Was tust du?', 'Zurückdrehen und das Maß erneut aus derselben Richtung anfahren', ['Das Handrad ein bisschen zurückdrehen und dann dort einfach lassen', 'Das Werkstück um 180 Grad drehen und neu anfahren', 'Das Maß ignorieren, es wird beim Fräsen schon passen'], 'Spindel und Mutter haben Spiel. Nur aus gleicher Richtung angefahren ist die Anzeige verlässlich.', ['Spiel entsteht beim Richtungswechsel.', 'Immer aus derselben Richtung.']],
    ['Wie stellst du an der Ständerbohrmaschine A eine Drehzahl ein?', 'Mit zwei Hebeln: Buchstabe und Zeile ergeben zusammen eine Zahl', ['Nur mit dem Buchstaben, die Zeile ist dabei völlig egal und wird nicht gebraucht', 'Nur mit der Zeile, der Buchstabe ist dabei völlig egal', 'Mit einem Drehknopf stufenlos von 63 bis 1000 min⁻¹'], 'Zwei Hebel, 3 × 3 Stellungen: Es gibt neun feste Drehzahlen. Zwischenwerte sind nicht möglich.', ['Die Tafel hat Zeilen und Spalten.', 'Feste Stufen statt stufenlos.']]
  ];
  const CNCMODE = [
    ['Mit welcher Betriebsart verfährst du die Achsen mit den Tasten ±X, ±Y und ±Z von Hand?', 'MANUAL', ['AUTO', 'SINGLE', 'Nur nach einem Not-Aus'], 'In MANUAL werden die Achsen von Hand verfahren. In AUTO und SINGLE läuft das Programm.', ['Hand heißt auf Englisch manual.', 'Achstasten wirken nur dort.']],
    ['Du testest ein neues Programm zum ersten Mal. Wie gehst du vor?', 'In SINGLE, mit kleinem Override, Haube zu, Hand am Not-Aus', ['In AUTO, mit voller Geschwindigkeit und 120 % Override', 'In AUTO bei geöffneter Haube, damit man besser zusehen kann', 'In MANUAL, denn dort läuft das Programm ganz von selbst ab'], 'Beim Erstlauf sollen Fehler im Programm keinen Schaden anrichten: Satz für Satz, langsam, mit Hand am Not-Aus.', ['Satz für Satz ist sicherer.', 'Langsam heißt kleiner Override.']],
    ['Was macht die Betriebsart SINGLE?', 'Nach jedem Satz hält sie an, mit START folgt der nächste', ['Sie fährt das Programm nur mit einem einzigen Werkzeug und ohne Wechsel', 'Sie führt das Programm schnell ohne Bearbeitung durch', 'Sie löscht das Programm automatisch nach dem Lauf'], 'SINGLE ist der Einzelsatzbetrieb. So kannst du jeden Satz einzeln prüfen.', ['Einzeln heißt single.', 'START löst den nächsten Satz aus.']],
    ['Welche Betriebsart führt ein fertiges Programm selbstständig bis zum Ende aus?', 'AUTO, das Programm läuft dann ohne weiteren Eingriff', ['MANUAL, dort werden die Achsen mit Tasten bewegt', 'TEACH IN, dort werden Positionen angefahren und gespeichert', 'Keine, bei jedem Satz muss man erneut eine Taste drücken'], 'AUTO arbeitet das Programm von Satz 1 bis zum Ende ab, solange keine Störung eintritt.', ['Automatik.', 'Danach läuft es ohne Eingriff.']],
    ['Was ist der Unterschied zwischen STOP und NOT-AUS?', 'STOP hält den Ablauf an, der NOT-AUS schaltet in Gefahr ab', ['Beide Tasten bewirken genau dasselbe und sind austauschbar', 'STOP ist die schnellere Variante und löst den Notfall aus', 'NOT-AUS startet das Programm neu und setzt es auf den Anfang'], 'STOP unterbricht ein Programm gezielt. Der Not-Aus ist die Sicherheitseinrichtung für Gefahr und schaltet die Antriebe ab.', ['Einer ist Betrieb, einer Sicherheit.', 'Nach Not-Aus ist die Maschine ausgeschaltet.']],
    ['Der Vorschub-Override steht auf 50 %. Was bedeutet das?', 'Die Maschine fährt mit halbem programmierten Vorschub', ['Die Spindel dreht mit der halben Drehzahl weiter', 'Das Programm läuft nur bis zur Hälfte des Ablaufs', 'Der Eilgang wird halbiert und der Arbeitsvorschub nicht'], 'Der Override ändert den programmierten Vorschub F prozentual: Ist = F · Override / 100.', ['Override heißt „überschreiben“ des Prozentwerts.', '50 % ist die Hälfte.']]
  ];
  /* PRUEFEN P24: Referenzfahrt und Nullpunkt: Nach dem Einschalten fahren die Achsen den Referenzpunkt an, damit die Steuerung ihre Position kennt; der Werkstücknullpunkt ist der Bezugspunkt der Zeichnung am Werkstück; Erstlauf in Einzelsatz mit kleinem Override. Läuft es an euren Maschinen so ab (Reihenfolge, wer setzt den Nullpunkt)? */
  const CNCREF = [
    ['Wozu dient die Referenzfahrt?', 'Die Steuerung lernt die Lage der Achsen und kennt danach ihre Positionen', ['Sie reinigt und schmiert die Führungen aller Achsen und prüft den Ölstand', 'Sie prüft die eingesetzten Werkzeuge auf ihre Schärfe hin', 'Sie stellt die Spindeldrehzahl auf den Programmwert ein'], 'Beim Einschalten kennt die Steuerung die Achslage noch nicht. Beim Referenzieren wird ein bekannter Punkt angefahren, von dem aus alle Maße gelten.', ['Die Steuerung muss ihre Position kennen.', 'Es geht um einen festen Punkt der Maschine.']],
    ['Was ist der Werkstücknullpunkt?', 'Der Bezugspunkt am Werkstück für die Maße im Programm', ['Der Punkt der Maschine, an dem der Not-Aus angebracht ist', 'Der erste Satz des Programms mit der Nummer N1', 'Der Punkt am Boden der Halle, an dem die Maschine steht'], 'Die Maße der Zeichnung beziehen sich auf eine Ecke oder Kante des Werkstücks. Diesen Punkt teilst du der Steuerung mit.', ['Die Maße der Zeichnung gehen von einem Punkt aus.', 'Er liegt am Werkstück, nicht an der Maschine.']],
    ['Das Programm soll zum ersten Mal laufen. Was prüfst du vorher?', 'Spannung fest, Nullpunkt gesetzt, Werkzeug richtig, Haube zu, Weg frei', ['Nur, ob die Anzeige hell genug ist und die Schrift gut lesbar bleibt, wenn es läuft', 'Nur, ob die Absaugung läuft und der Spänebehälter leer ist', 'Nichts, die Steuerung prüft den Aufbau und alles andere selbst'], 'Eine Steuerung führt aus, was man ihr sagt. Mängel im Aufbau erkennt sie nicht.', ['Prüfe Spannen, Nullpunkt, Werkzeug und Schutz.', 'Die Steuerung sieht nicht, ob etwas im Weg ist.']],
    ['Warum fährt man mit G0 (Eilgang) nur im freien Raum?', 'Er fährt mit höchster Geschwindigkeit: Hindernisse bedeuten Kollision', ['G0 bearbeitet das Werkstück viel zu grob und hinterlässt eine raue Oberfläche', 'G0 ist sehr langsam und kostet unnötig Fertigungszeit', 'G0 schaltet die Spindel aus und stoppt das Kühlmittel'], 'Der Eilgang ist für schnelle Positionierung ohne Bearbeitung. Kollisionen bei Eilgang sind teuer und gefährlich.', ['Wie schnell ist ein Eilgang?', 'Bearbeitet wird mit G1.']],
    ['Wohin gehören Hände und Blick beim ersten Lauf?', 'Hand nahe am Not-Aus, Blick auf Werkzeug und Werkstück', ['Hände auf dem Spannmittel, um es festzuhalten', 'Hand in der Haube, um schnell einen Span zu entfernen', 'Weggehen und Kaffee holen, das Programm läuft ja allein'], 'Wenn etwas schiefgeht, musst du sofort stoppen können.', ['Du musst jederzeit eingreifen können.', 'Der Arbeitsraum ist tabu.']]
  ];

  /* ---------- Generatoren ---------- */
  const KIND_MACH = { bohr: ['tb1', 'tb2', 'tba', 'sbA', 'sbB'], dreh: ['dsl', 'dgr'], fraes: ['bfr', 'frd', 'srv'] };
  const TAB_MACH = ['tb2', 'sbA', 'dgr', 'bfr', 'frd'];
  const PROC_OF = { tb2: 'bohr', sbA: 'bohr', bfr: 'bohr', dgr: 'dreh', frd: 'fraes' };
  const DIAM = { bohr: [4, 5, 6, 8, 10, 12, 14, 16, 20], dreh: [20, 25, 30, 40, 50, 60], fraes: [8, 10, 12, 16, 20, 25] };
  const mats = ['stahl', 'alu', 'messing', 'guss'], MATN = { stahl: 'Baustahl', alu: 'Aluminium', messing: 'Messing', guss: 'Grauguss' };
  const stg = v => f(v, 0) + ' min⁻¹';
  const WIN = (proc, grp) => C().vcWindow(proc, grp, 'hss');
  const winTxt = w => f(w[0], 0) + ' bis ' + f(w[1], 0) + ' m/min';

  const G = {
    partmark: (R, kind) => {
      const c = C(), m = mach(c.pick(R, KIND_MACH[kind])), cands = m.hot.filter(x => m.name.toLowerCase().indexOf(x.name.toLowerCase()) < 0), h = c.pick(R, cands), others = m.hot.filter(x => x.id !== h.id).map(x => x.name);
      let wrong = c.shuffle(R, others).slice(0, 3);
      if (wrong.length < 3) { const pool = []; KIND_MACH[kind].forEach(id => mach(id).hot.forEach(x => { if (x.name !== h.name && wrong.indexOf(x.name) < 0 && pool.indexOf(x.name) < 0) pool.push(x.name); })); wrong = wrong.concat(c.shuffle(R, pool).slice(0, 3 - wrong.length)); }
      return choiceQ(R, 'An der ' + m.name + ' ist ein Teil markiert (gestrichelter Rahmen). Wie heißt es?', h.name, wrong, h.name + ': ' + h.text, LABEL_TIPS, { t: 'machine', id: m.id, mark: h.id });
    },
    partfunc: R => {
      const c = C(), m = mach(c.pick(R, ['sbA', 'dsl', 'dgr', 'bfr', 'frd', 'tb2', 'tba'])), h = c.pick(R, m.hot), others = c.shuffle(R, m.hot.filter(x => x.id !== h.id)).slice(0, 3);
      return choiceQ(R, 'Was ist die Aufgabe des Teils „' + h.name + '“ an der ' + m.name + '?', brief(h.text), others.map(x => brief(x.text)), h.name + ': ' + h.text, ['Überlege, was das Teil an der Maschine tut.', 'Die Antworten beschreiben jeweils ein anderes Bauteil der Maschine.'], { t: 'machine', id: m.id });
    },
    partmatch: R => {
      const c = C(), m = mach(c.pick(R, ['dsl', 'dgr'])), pool = m.hot.filter(x => x.id !== 'notaus'), rows = c.shuffle(R, pool).slice(0, 4);
      return matchQ(R, 'Ordne jedem Bauteil der ' + m.name + ' seine Aufgabe zu.', rows.map(x => x.name), rows.map(x => brief(x.text)), rows.map((_, i) => i), rows.map(x => x.name + ': ' + brief(x.text) + '.').join(' '), ['Beginne mit den Teilen, die du sicher kennst.', 'Jede Aufgabe passt zu genau einem Bauteil.'], { t: 'machine', id: m.id });
    },
    speedat: R => {
      const c = C(), m = mach(c.pick(R, TAB_MACH)), p = m.sel.map(s => c.ri(R, 0, s.opts.length - 1)), n = c.speedAt(m, p);
      return numQ('Die ' + m.name + ' ist so eingestellt: ' + c.pickLabel(m, p) + '. Welche Spindeldrehzahl ergibt das nach der Tafel?', n, 'min⁻¹', 'Drehzahl', 0, 'Du suchst in der Tafel die Zeile und die Spalte, die zu den Hebelstellungen gehören. Der Wert im Schnittpunkt ist ' + stg(n) + '.', ['Suche zuerst die Zeile, dann die Spalte.', 'Der gesuchte Wert steht im Schnittpunkt.'], { t: 'tafel', id: m.id });
    },
    setfor: R => {
      const c = C(), m = mach(c.pick(R, TAB_MACH)), st = c.pick(R, c.stages(m)), right = c.pickLabel(m, st.p);
      let wrong = c.shuffle(R, c.stages(m).filter(s => s.n !== st.n)).slice(0, 3).map(s => c.pickLabel(m, s.p));
      return choiceQ(R, 'Die ' + m.name + ' soll mit ' + stg(st.n) + ' laufen. Welche Hebelstellung ist richtig?', right, wrong, 'Der Wert ' + stg(st.n) + ' steht in der Tafel bei: ' + right + '.', ['Suche den Wert in der Tafel und lies Zeile und Spalte ab.', 'Jede Zahl der Tafel gehört zu genau einer Stellung.'], { t: 'tafel', id: m.id });
    },
    dslrange: R => {
      const c = C(), m = mach('dsl'), low = R() < 0.5, n = low ? c.ri(R, 4, 18) * 10 : c.ri(R, 46, 240) * 10, rng = low ? 'L' : 'H', other = low ? 'H' : 'L';
      return choiceQ(R, 'Die ' + m.name + ' soll auf ' + stg(n) + ' laufen. Wie gehst du vor?', 'Reihe ' + rng + ' im Stillstand einstellen, dann am Regler ' + n + ' wählen', ['Reihe ' + other + ' im Stillstand einstellen, dann am Regler ' + n + ' wählen', 'Reihe ' + rng + ' bei laufender Spindel umschalten', 'Hebel in Stellung N lassen und die Drehzahl am Regler einstellen'], 'Die niedrige Reihe (L) geht von 35 bis 440, die hohe (H) von 200 bis 2500 min⁻¹. ' + stg(n) + ' liegt nur in der Reihe ' + rng + '. Der Hebel wird nur im Stillstand geschaltet; N ist neutral, dort treibt die Maschine nicht.', ['Vergleiche die Zahl mit den beiden Bereichen der Maschine.', 'Geschaltet wird nur im Stillstand.'], { t: 'tafel', id: 'dsl' });
    },
    opq: pq(OP),
    startorder: R => orderQ(R, 'Bringe die Schritte vor dem ersten Bohren in eine sinnvolle Reihenfolge.', ['Schutzbrille aufsetzen, Haare sichern, Ärmel und Schmuck prüfen', 'Drehzahl nach der Tafel einstellen (Maschine steht)', 'Bohrer spannen und den Futterschlüssel abziehen', 'Werkstück fest spannen', 'Maschine einschalten und mit dem Hebel gefühlvoll zustellen'], 'Erst persönlicher Schutz, dann Maschine einstellen und bestücken, zuletzt einschalten. Eingeschaltet wird immer erst, wenn alles fest sitzt und nichts mehr nachgestellt werden muss.', ['Beginne mit dir selbst.', 'Einschalten ist der letzte Schritt.']),
    leverset: R => {
      const c = C(), m = mach('bfr'), d = c.pick(R, [5, 6, 8, 10, 12, 16]), w = WIN('bohr', 'stahl'), vc = c.ri(R, w[0], w[1]), nS = c.nFromVc(vc, d), st = c.stageFor(m, nS);
      const rows = ['Bereich (L oder H)', 'Hebel (1, 2 oder 3)', 'Motorstufe'], opts = ['Bereich L', 'Bereich H', 'Hebel 1', 'Hebel 2', 'Hebel 3', 'Motorstufe 1', 'Motorstufe 2'], corr = [st.p[0], 2 + st.p[1], 5 + st.p[2]];
      return matchQ(R, 'Du bohrst Ø ' + d + ' mm in Baustahl (HSS-Bohrer) mit vc = ' + vc + ' m/min an der ' + m.name + '. Berechne die Solldrehzahl, nimm die nächstkleinere Stufe der Tafel und ordne die Hebelstellungen zu.', rows, opts, corr, 'n = vc · 1000 / (π · d) = ' + vc + ' · 1000 / (π · ' + d + ') = ' + f(nS, 0) + ' min⁻¹. Die nächstkleinere Stufe der Tafel ist ' + stg(st.n) + ': Bereich ' + m.sel[0].opts[st.p[0]] + ', Hebel ' + m.sel[1].opts[st.p[1]] + ', ' + m.sel[2].opts[st.p[2]] + '.', ['Rechne n = vc · 1000 / (π · d).', 'Suche in der Tafel die größte Drehzahl, die nicht über dem Sollwert liegt.'], { t: 'tafel', id: 'bfr' });
    },
    vcn: R => {
      const c = C(), d = c.pick(R, [8, 10, 12, 16, 20, 25, 30, 40]), n = c.pick(R, [180, 250, 355, 500, 710, 1000, 1400]), v = c.vcFromN(d, n);
      return numQ('Ein Bohrer mit Ø ' + d + ' mm läuft mit ' + f(n, 0) + ' min⁻¹. Wie groß ist die Schnittgeschwindigkeit?', c.rd(v, 1), 'm/min', 'vc', Math.max(0.3, 0.01 * v), 'vc = π · d · n / 1000 = π · ' + d + ' · ' + n + ' / 1000 = ' + f(v, 1) + ' m/min.', ['Setze d in mm und n in min⁻¹ ein, geteilt durch 1000.', 'Rechne π · d · n / 1000.']);
    },
    nfromvc: R => {
      const c = C(), proc = c.pick(R, ['bohr', 'dreh']), grp = c.pick(R, mats), w = WIN(proc, grp), vc = c.ri(R, w[0], w[1]), d = c.pick(R, DIAM[proc]), n = c.nFromVc(vc, d);
      return numQ((proc === 'bohr' ? 'Beim Bohren' : 'Beim Drehen') + ' von ' + MATN[grp] + ' soll die Schnittgeschwindigkeit ' + vc + ' m/min betragen, der Durchmesser ist ' + d + ' mm. Welche Solldrehzahl ist nötig?', c.rd(n, 0), 'min⁻¹', 'Solldrehzahl', Math.max(3, 0.02 * n), 'n = vc · 1000 / (π · d) = ' + vc + ' · 1000 / (π · ' + d + ') = ' + f(n, 0) + ' min⁻¹.', ['Stelle die Formel für vc nach n um.', 'n = vc · 1000 / (π · d).']);
    },
    stagepick: R => {
      const c = C(); let m, proc, grp, w, vc, d, nS, tries = 0;
      do { m = mach(c.pick(R, TAB_MACH)); proc = PROC_OF[m.id]; grp = c.pick(R, mats); w = WIN(proc, grp); vc = c.ri(R, w[0], w[1]); d = c.pick(R, DIAM[proc]); nS = c.nFromVc(vc, d); tries++; } while ((nS < c.series(m)[0] || nS > c.series(m)[c.series(m).length - 1] || c.vcFromN(d, c.lowerStage(c.series(m), nS)) < w[0] - 1e-9) && tries < 600);
      const ser = c.series(m), right = c.lowerStage(ser, nS), wrong = c.shuffle(R, ser.filter(x => x !== right)).slice(0, 3), vcA = c.vcFromN(d, right);
      const qq = choiceQ(R, 'An der ' + m.name + ' wird ' + MATN[grp] + ' bearbeitet (' + PROC_LABEL[proc] + ', Werkzeug HSS, Ø ' + d + ' mm), gewünscht ist vc = ' + vc + ' m/min. Welche Stufe der Tafel stellst du ein?', stg(right), wrong.map(stg), 'n = vc · 1000 / (π · d) = ' + f(nS, 0) + ' min⁻¹. Die nächstkleinere Stufe der Tafel ist ' + stg(right) + ' (damit vc = ' + f(vcA, 1) + ' m/min).', ['Rechne zuerst die Solldrehzahl aus.', 'Nimm die größte Stufe, die nicht über dem Sollwert liegt.'], { t: 'tafel', id: m.id });
      qq.meta = { m: m.id, d, vc, nS, right, w }; return qq;
    },
    feedread: R => {
      const c = C(), m = mach('sbA'), z = c.ri(R, 0, 2), s = c.ri(R, 0, 2), v = m.feed.f([z, s]);
      return numQ('Die Vorschubtafel der ' + m.name + ' (mm je Umdrehung) wird mit Zeile ' + (z + 1) + ' und Spalte ' + ['I', 'II', 'III'][s] + ' eingestellt. Welcher Vorschub ergibt das?', v, 'mm/U', 'Vorschub f', 0.0005, 'In Zeile ' + (z + 1) + ', Spalte ' + ['I', 'II', 'III'][s] + ' steht f = ' + f(v, 2) + ' mm/U.', ['Lies die Zeile von oben, die Spalte von links.', 'Der Wert steht im Schnittpunkt.'], { t: 'tafel', id: 'sbA', feed: true });
    },
    drilltime: R => {
      const c = C(), m = mach('sbA'), n = c.pick(R, [180, 250, 355, 500, 710]), fv = c.pick(R, [0.08, 0.11, 0.16, 0.22]), L = c.ri(R, 4, 12) * 5, t = c.timeMin(L, fv, n) * 60;
      /* PRUEFEN P28: Bohrzeit grob t = L / (f · n); L ist der Gesamtweg (Bohrtiefe plus Anlauf plus Überlauf). Die Spitzenlänge und der Handvorschub bleiben unberücksichtigt. Genügt die grobe Näherung für den Unterricht, oder soll L = l + la + lu einzeln gerechnet werden? */
      return numQ('An der ' + m.name + ' soll ein Weg von insgesamt ' + L + ' mm mit Selbstvorschub gebohrt werden (n = ' + n + ' min⁻¹, f = ' + f(fv, 2) + ' mm/U). Wie lange dauert das ungefähr?', c.rd(t, 1), 's', 'Zeit', Math.max(1, 0.03 * t), 'Vorschubgeschwindigkeit vf = f · n = ' + f(fv, 2) + ' · ' + n + ' = ' + f(fv * n, 1) + ' mm/min. Zeit t = L / vf = ' + L + ' / ' + f(fv * n, 1) + ' = ' + f(t / 60, 3) + ' min = ' + f(t, 1) + ' s.', ['Berechne zuerst vf = f · n.', 'Dann t = L / vf, in Sekunden umrechnen.'], { t: 'tafel', id: 'sbA', feed: true });
    },
    vccheck: R => {
      const c = C(), want = c.pick(R, ['niedrig', 'ok', 'hoch']); let r = null;
      for (let k = 0; k < 400 && !r; k++) {
        const m = mach(c.pick(R, TAB_MACH)), proc = PROC_OF[m.id], grp = c.pick(R, mats), w = WIN(proc, grp), st = c.pick(R, c.stages(m)), d = c.pick(R, DIAM[proc]), v = c.vcFromN(d, st.n);
        if (c.vcStatus(v, w) === want) r = { m, proc, grp, w, st, d, v };
      }
      const wordsOf = { niedrig: 'zu langsam', ok: 'im Fenster', hoch: 'zu schnell' };
      return choiceQ(R, 'An der ' + r.m.name + ' steht ' + c.pickLabel(r.m, r.st.p) + ' (' + stg(r.st.n) + '). Du ' + (r.proc === 'bohr' ? 'bohrst' : r.proc === 'dreh' ? 'drehst' : 'fräst') + ' ' + MATN[r.grp] + ' mit HSS-Werkzeug, Ø ' + r.d + ' mm. Richtwert für vc: ' + winTxt(r.w) + '. Wie ist diese Drehzahl zu beurteilen?', wordsOf[want], ['zu langsam', 'im Fenster', 'zu schnell'].filter(x => x !== wordsOf[want]), 'vc = π · ' + r.d + ' · ' + r.st.n + ' / 1000 = ' + f(r.v, 1) + ' m/min. Der Richtwert ist ' + winTxt(r.w) + ', also ist die Drehzahl ' + wordsOf[want] + '.', ['Berechne vc aus d und n.', 'Vergleiche mit dem Richtwert-Fenster.'], { t: 'tafel', id: r.m.id });
    },
    turnrange: R => {
      const c = C(), m = mach('dsl'); let d, grp, w, vc, nS, tries = 0;
      do { grp = c.pick(R, ['stahl', 'alu', 'messing']); w = WIN('dreh', grp); vc = c.ri(R, w[0], w[1]); d = c.pick(R, [20, 25, 30, 40, 50, 60, 80]); nS = c.nFromVc(vc, d); tries++; } while ((nS < 40 || nS > 2400 || (nS >= 190 && nS <= 460)) && tries < 300);
      const n10 = Math.round(nS / 10) * 10, rg = nS < 200 ? 'L' : 'H', other = rg === 'L' ? 'H' : 'L', t = (r, n) => 'Reihe ' + r + ', etwa ' + f(n, 0) + ' min⁻¹';
      return choiceQ(R, 'Auf der ' + m.name + ' wird ' + MATN[grp] + ' mit Ø ' + d + ' mm gedreht (HSS), gewünscht ist vc = ' + vc + ' m/min. Welche Einstellung passt?', t(rg, n10), [t(other, n10), t(rg, n10 * 2), t(rg, Math.round(n10 / 2 / 10) * 10)], 'n = vc · 1000 / (π · d) = ' + f(nS, 0) + ' min⁻¹. Die niedrige Reihe L deckt 35 bis 440, die hohe Reihe H 200 bis 2500 min⁻¹ ab. ' + f(nS, 0) + ' min⁻¹ gehört zur Reihe ' + rg + '. Doppelte oder halbe Werte entstehen, wenn mit dem Radius statt dem Durchmesser gerechnet wird.', ['Rechne die Solldrehzahl aus.', 'Prüfe, in welchem Bereich der Maschine sie liegt.'], { t: 'tafel', id: 'dsl' });
    },
    windowstages: R => {
      const c = C(), m = mach('dgr'), ser = c.series(m); let d, grp, w, cnt, tries = 0;
      do { grp = c.pick(R, ['stahl', 'messing', 'alu']); w = WIN('dreh', grp); d = c.pick(R, [20, 25, 30, 40, 50, 60]); cnt = c.stagesInWindow(ser, d, w[0], w[1]).length; tries++; } while ((cnt < 1 || cnt > 5) && tries < 300);
      const list = c.stagesInWindow(ser, d, w[0], w[1]);
      return numQ('Auf der ' + m.name + ' wird ' + MATN[grp] + ' mit Ø ' + d + ' mm gedreht. Der Richtwert für vc (HSS) ist ' + winTxt(w) + '. Wie viele der neun Drehzahlstufen liegen im Fenster?', cnt, 'Stufen', 'Anzahl', 0, 'Für jede Stufe vc = π · ' + d + ' · n / 1000 berechnen: Im Fenster liegen ' + list.map(stg).join(', ') + ' (' + cnt + ' Stufen).', ['Berechne vc für jede der neun Stufen.', 'Zähle die Werte zwischen unterer und oberer Grenze.'], { t: 'tafel', id: 'dgr' });
    },
    notq: pq(NOT), psaq: pq(PSA), spanq: pq(SPAN), sphq: pq(SPH), kssq: pq(KSS), bfq: pq(BF), aufnq: pq(AUFN), cncmq: pq(CNCMODE), cncrq: pq(CNCREF),
    haz: R => {
      const c = C(), rows = ['Lange Haare an der Bohrspindel', 'Wegfliegende Späne', 'Ungespanntes Blech beim Durchbruch', 'Steckengebliebener Futterschlüssel'], opts = ['Haare zusammenbinden und unter Haarnetz stecken', 'Schutzbrille tragen', 'Werkstück fest spannen', 'Schlüssel nach dem Spannen abziehen', 'Handschuhe anziehen'];
      return matchQ(R, 'Ordne jeder Gefahr die passende Schutzmaßnahme zu. Eine Maßnahme bleibt übrig.', rows, opts, [0, 1, 2, 3], 'Haare sichern, Augen schützen, Werkstück spannen und den Schlüssel abziehen. Handschuhe wären an drehenden Teilen selbst eine Gefahr.', ['Jede Gefahr hat genau eine passende Maßnahme.', 'Handschuhe sind an drehenden Teilen gefährlich.']);
    },
    /* PRUEFEN P20: Spannen mit Pratzen: Stütze so hoch wie das Werkstück (Pratze waagerecht), Schraube nahe am Werkstück, Nutenstein in der T-Nut, Pratze nicht auf dem Schraubengewinde „hängen“; die vier Fälle der Zeichnung sind vereinfacht. Fehlt eine übliche Regel (Auflage, Anzahl der Pratzen, Anzugsmoment)? */
    pratze: R => {
      const c = C(), v = c.pick(R, [['gleich', 'werkstueck'], ['hoch', 'werkstueck'], ['tief', 'werkstueck'], ['gleich', 'stuetze']]), OK = 'Richtig gespannt: Stütze gleich hoch wie das Werkstück, Schraube nahe am Werkstück';
      const TXT = { 'gleich,werkstueck': OK, 'hoch,werkstueck': 'Die Stütze ist höher als das Werkstück: Die Pratze drückt nur an der Kante und kann abrutschen', 'tief,werkstueck': 'Die Stütze ist niedriger als das Werkstück: Die Pratze kippt auf das Werkstück und biegt sich', 'gleich,stuetze': 'Die Schraube sitzt nahe an der Stütze: Die Spannkraft am Werkstück ist zu gering' };
      const key = v.join(',');
      return choiceQ(R, 'Beurteile die gezeichnete Spannung mit Pratze auf dem Maschinentisch.', TXT[key], Object.keys(TXT).filter(k => k !== key).map(k => TXT[k]), 'Eine Pratze ist ein Hebel: Sie liegt waagerecht (Stütze so hoch wie das Werkstück), die Schraube sitzt möglichst nah am Werkstück. So wirkt die Spannkraft dort, wo sie gebraucht wird.', ['Eine Pratze soll waagerecht aufliegen.', 'Die Kraft wirkt dort stark, wo die Schraube sitzt.'], { t: 'pratze', stuetze: v[0], schraube: v[1] });
    },
    spannm: R => matchQ(R, 'Ordne jeder Arbeit das passende Spannmittel zu.', ['Quaderförmiges Teil beim Bohren oder Fräsen', 'Große, ebene Platte, die in keinen Schraubstock passt', 'Wiederkehrende Frästeile in Serie, schnelles Wechseln', 'Rundes Werkstück an der Drehmaschine'], ['Maschinenschraubstock', 'Spannpratzen mit T-Nutenstein', 'Kniehebelspanner', 'Dreibackenfutter'], [0, 1, 2, 3], 'Quader: Schraubstock. Große Platten: Pratzen auf T-Nuten. Serien: Kniehebelspanner (schnell). Runde Teile: Dreibackenfutter, das zentrisch spannt.', ['Überlege, welche Form und Größe das Teil hat.', 'Das Futter ist für runde Teile gedacht.']),
    wahl: R => { const c = C(), j = c.pick(R, JOBS); return choiceQ(R, 'Welche Maschine ist für diese Arbeit am besten geeignet? ' + j[0], MTYPES[j[1]], c.shuffle(R, MTYPES.filter((_, i) => i !== j[1])).slice(0, 3), j[2], ['Überlege, ob sich Werkzeug oder Werkstück dreht.', 'Denke an Größe, Menge und Genauigkeit.']); },
    wahlmatch: R => {
      const c = C(), idx = c.shuffle(R, JOBS.map((_, i) => i)).slice(0, 4), rows = idx.map(i => JOBS[i][0]), types = idx.map(i => MTYPES[JOBS[i][1]]);
      return matchQ(R, 'Ordne jeder Arbeit die passende Maschine zu.', rows, types, types.map((_, i) => i), idx.map(i => MTYPES[JOBS[i][1]] + ': ' + JOBS[i][2]).join(' '), ['Beginne mit der eindeutigsten Arbeit.', 'Jeder Maschinentyp kommt höchstens einmal vor.']);
    },
    wahlcalc: R => {
      const c = C(), ids = ['tb2', 'sbA', 'bfr'], names = ids.map(id => mach(id).name); let d, grp, w, sets, tries = 0;
      do { grp = c.pick(R, ['stahl', 'alu', 'messing']); w = WIN('bohr', grp); d = c.pick(R, [3, 4, 5, 6, 8, 10, 12, 16, 20, 25]); sets = ids.map(id => c.stagesInWindow(c.series(mach(id)), d, w[0], w[1]).length > 0); tries++; } while (!sets.some(x => x) && tries < 300);
      const label = s => { const nm = names.filter((_, i) => s[i]); return nm.length ? nm.join(' und ') : 'keine der drei Maschinen'; };
      const combos = []; for (let k = 0; k < 8; k++) { const s = [!!(k & 1), !!(k & 2), !!(k & 4)]; combos.push(s); }
      const right = label(sets), wrong = c.shuffle(R, combos.map(label).filter(x => x !== right)).slice(0, 3);
      return choiceQ(R, 'Du bohrst Ø ' + d + ' mm in ' + MATN[grp] + ' mit HSS-Bohrer, Richtwert vc ' + winTxt(w) + '. Welche der Maschinen ' + names.join(', ') + ' hat mindestens eine Drehzahlstufe, bei der vc im Fenster liegt?', right, wrong, 'Das Drehzahlfenster liegt bei ' + f(c.nFromVc(w[0], d), 0) + ' bis ' + f(c.nFromVc(w[1], d), 0) + ' min⁻¹. ' + ids.map((id, i) => names[i] + ': ' + (sets[i] ? c.stagesInWindow(c.series(mach(id)), d, w[0], w[1]).map(stg).join(', ') : 'keine Stufe im Fenster')).join('; ') + '.', ['Berechne das Drehzahlfenster aus der unteren und der oberen vc-Grenze.', 'Suche in jeder Tafel eine Stufe im Fenster.']);
    },
    keytap: R => {
      const c = C(), P = [
        ['manual', 'Du willst die Achsen von Hand verfahren. Welche Taste wählt die Betriebsart?'], ['auto', 'Das geprüfte Programm soll selbstständig komplett ablaufen. Tippe die Taste der Betriebsart.'], ['single', 'Du willst das Programm Satz für Satz ablaufen lassen. Tippe die passende Betriebsart.'],
        ['notaus', 'Eine Person gerät in Gefahr. Tippe die Taste, die sofort alles stoppt.'], ['ovr100', 'Der Vorschub soll wieder genau dem programmierten Wert entsprechen. Welche Taste?'], ['ovr0', 'Der Vorschub soll sofort auf null, ohne Not-Aus. Welche Taste?'], ['zp', 'Das Werkzeug soll nach oben vom Werkstück wegfahren. Welche Achstaste?'],
        ['stop', 'Das laufende Programm soll angehalten, aber nicht abgeschaltet werden. Welche Taste?'], ['mason', 'Der Not-Aus ist entriegelt, die Maschine soll eingeschaltet werden. Welche Taste?'], ['s1', 'Du willst mit der kleinsten Schrittweite fein anfahren. Welche Taste?'], ['reset', 'Das Programm soll zurück auf den ersten Satz. Welche Taste?'], ['memlock', 'Das Programm soll gegen Überschreiben gesperrt werden. Welche Taste?']
      ], p = c.pick(R, P);
      return keyQ(p[1], p[0], 'Das ist die Taste „' + C().KEYS[p[0]].l + '“: ' + C().KEYS[p[0]].t, ['Die Tasten sind in Gruppen sortiert: Betriebsarten, Achsen, Schrittweite, Override, Ablauf, Sicherheit.', 'Lies die Beschriftung der Tasten.']);
    },
    satz: R => {
      const c = C(), S = [['G0 X20 Y30 Z5', 'G0', 'Eilgang auf die Position X 20, Y 30, Z 5'], ['G1 Z-3 F200', 'G1', 'Arbeitsgang mit Vorschub 200 auf Z −3'], ['G90', 'G90', 'Absolutmaß'], ['G91', 'G91', 'Kettenmaß'], ['M3 S1200', 'M3', 'Spindel Rechtslauf mit 1200 min⁻¹'], ['M5', 'M5', 'Spindel aus'], ['M30', 'M30', 'Programmende']], s = c.pick(R, S);
      const N = 'N' + c.ri(R, 1, 9) * 10, blk = N + ' ' + s[0], EXP = { G0: 'Eilgang: Bewegung mit höchster Geschwindigkeit ohne Bearbeitung', G1: 'Geradenbewegung mit Arbeitsvorschub F, also Bearbeitung', G90: 'Alle Maße beziehen sich auf den Nullpunkt (Absolutmaß)', G91: 'Jedes Maß bezieht sich auf die letzte Position (Kettenmaß)', M3: 'Spindel schaltet ein und dreht rechts', M5: 'Spindel schaltet aus', M30: 'Programmende, Rücksprung zum Anfang' };
      const code = s[1];
      return choiceQ(R, 'Was bewirkt der Programmsatz „' + blk + '“?', EXP[code], Object.keys(EXP).filter(k => k !== code).map(k => EXP[k]).sort(() => R() - 0.5).slice(0, 3), 'N ' + N.slice(1) + ' ist die Satznummer. ' + c.parseBlock(blk).filter(o => o.L !== 'N').map(o => o.w + ': ' + o.t).join('; ') + '.', ['Lies zuerst die G- oder M-Funktion.', 'G beschreibt Bewegungen, M schaltet Funktionen.'], { t: 'panel', screen: { lines: [blk] } });
    },
    ovr: R => {
      const c = C(), F = c.pick(R, [120, 150, 200, 240, 300, 400]), pct = c.pick(R, [30, 50, 60, 80, 110, 120]), ist = c.overrideFeed(F, pct);
      if (R() < 0.5) return numQ('Im Programm steht F ' + F + ' mm/min. Der Vorschub-Override steht auf ' + pct + ' %. Mit welchem Vorschub fährt die Maschine?', ist, 'mm/min', 'Vorschub', 0.5, 'Ist = F · Override / 100 = ' + F + ' · ' + pct + ' / 100 = ' + f(ist, 1) + ' mm/min.', ['Der Override ist ein Prozentwert.', 'Ist = F · Override / 100.']);
      const sx = c.pick(R, [5, 10, 20, 100]), ix = c.pick(R, [105.5, 33.25, 62.75, 12.5]), rw = c.restweg(sx, ix);
      return numQ('Auf der Anzeige steht: Sollposition X = ' + f(sx, 2) + ' mm, Istposition X = ' + f(ix, 2) + ' mm. Wie groß ist der Restweg (Dist to go) in X? Vorzeichen beachten.', rw, 'mm', 'Restweg', 0.005, 'Restweg = Soll − Ist = ' + f(sx, 2) + ' − ' + f(ix, 2) + ' = ' + f(rw, 2) + ' mm. Negativ heißt: Die Achse muss in negative Richtung fahren.', ['Restweg = Soll − Ist.', 'Das Vorzeichen zeigt die Richtung.']);
    },
    fsa: R => {
      const c = C(), m = mach(c.pick(R, ['dsl', 'dgr', 'sbB', 'tb2', 'bfr'])), CA = [
        ['Der Hauptschalter oder die Zuleitung ist aus', ['Keine Kontrollleuchte leuchtet.', 'Der rote Not-Aus-Pilz steht oben (entriegelt).', 'Die Schutzeinrichtung ist geschlossen.'], 'Wenn gar keine Lampe leuchtet, fehlt die Spannung: Hauptschalter einschalten. Bleibt es dunkel, die Fachkraft rufen.'],
        ['Der Not-Aus ist noch gedrückt', ['Die Kontrollleuchte der Maschine leuchtet.', 'Der rote Pilz steht eingedrückt unten.', 'Die Schutzeinrichtung ist geschlossen.'], 'Der Not-Aus unterbricht den Steuerkreis. Erst klären, warum er gedrückt wurde, dann entriegeln (drehen oder ziehen) und neu einschalten.'],
        ['Die Schutzhaube ist offen', ['Die Kontrollleuchte leuchtet.', 'Der Not-Aus-Pilz steht oben (entriegelt).', 'Die Schutzhaube steht hochgeklappt.'], 'Die Verriegelung der Schutzhaube lässt nur bei geschlossener Haube einschalten. Haube schließen, nie überbrücken.'],
        ['Der Motorschutz hat ausgelöst (Überlast); Ausbilder oder Fachkraft informieren', ['Die Kontrollleuchte leuchtet, der Not-Aus ist entriegelt, die Haube ist zu.', 'Der Motor brummt kurz, die Spindel dreht nicht an.', 'Vorher lief die Maschine längere Zeit mit großem Vorschub und stumpfem Werkzeug.'], 'Der Motorschutz schaltet bei Überlast ab. Ursache (z. B. zu große Belastung) beseitigen, Fachkraft oder Ausbilder rufen; nicht selbst am Schaltschrank arbeiten.']
      ], k = c.ri(R, 0, 3), cs = CA[k];
      return choiceQ(R, 'An der ' + m.name + ' läuft nichts an. Du prüfst der Reihe nach:\n• ' + c.shuffle(R, cs[1]).join('\n• ') + '\nWas ist die Ursache?', cs[0], CA.filter((_, i) => i !== k).map(x => x[0]), cs[2], ['Welche Prüfung ist als einzige nicht in Ordnung?', 'Gehe die Sicherheitseinrichtungen der Reihe nach durch.']);
    },
    fsb: R => {
      const c = C(), d = c.pick(R, [6, 8, 10, 12]), w = WIN('bohr', 'stahl'), fw = c.feedWindow(d), cand = [];
      ['sbA', 'tb2', 'bfr'].forEach(id => c.stages(mach(id)).forEach(s => cand.push({ id, n: s.n, v: c.vcFromN(d, s.n) })));
      const okN = cand.filter(x => x.v >= w[0] && x.v <= w[1]), hiN = cand.filter(x => x.v >= 1.7 * w[1]);
      if (!okN.length || !hiN.length) return G.fsb(R);
      const k = c.ri(R, 0, 3), CAUSES = ['Die Drehzahl ist zu hoch', 'Der Vorschub ist zu groß', 'Es fehlt die Kühlung und Schmierung', 'Der Bohrer ist stumpf'], base = c.pick(R, okN), nHi = c.pick(R, hiN);
      const fok = c.rd(d * (0.012 + R() * 0.008), 2), fbig = c.rd(d * (0.07 + R() * 0.04), 2), n = k === 0 ? nHi.n : base.n, fv = k === 1 ? fbig : fok, kss = k === 2 ? 'keine (trocken)' : 'Bohröl', sharp = k === 3 ? 'Schneiden abgerundet und blank gerieben' : 'Schneiden scharf';
      const vcv = c.vcFromN(d, n), expl = ['vc = ' + f(vcv, 1) + ' m/min liegt weit über dem Richtwert (' + winTxt(w) + '): Die Schneiden werden zu heiß und verfärben sich blau. Drehzahl senken.', 'Der Vorschub ' + f(fv, 2) + ' mm/U liegt über dem Richtwert (' + f(fw[0], 2) + ' bis ' + f(fw[1], 2) + ' mm/U): Der Bohrer wird überlastet. Vorschub senken, vc passt (' + f(vcv, 1) + ' m/min).', 'Drehzahl (vc = ' + f(vcv, 1) + ' m/min) und Vorschub passen, aber es wurde trocken gebohrt: Ohne Kühlung und Schmierung glüht die Schneide.', 'Drehzahl (vc = ' + f(vcv, 1) + ' m/min), Vorschub und Kühlung passen, die Schneiden sind aber abgerundet: Der Bohrer ist stumpf und muss nachgeschliffen oder gewechselt werden.'][k];
      const qb = choiceQ(R, 'Beim Bohren in Baustahl wird der Bohrer heiß und verfärbt sich blau. Gemessen und beobachtet:\n• Bohrer: Ø ' + d + ' mm, HSS\n• Drehzahl: ' + f(n, 0) + ' min⁻¹\n• Vorschub (Selbstvorschub): ' + f(fv, 2) + ' mm/U\n• Kühlung: ' + kss + '\n• Zustand: ' + sharp + '\nRichtwerte (Übung): vc ' + winTxt(w) + '; Vorschub 0,01 bis 0,03 · d. Was ist die Ursache?', CAUSES[k], CAUSES.filter((_, i) => i !== k), expl, ['Rechne vc aus Durchmesser und Drehzahl und vergleiche mit dem Richtwert.', 'Prüfe danach Vorschub, Kühlung und Zustand der Schneiden der Reihe nach.']);
      qb.meta = { k, d, n, f: fv, kss: k !== 2, sharp: k !== 3, w, fw }; return qb;
    },
    fsc: R => {
      const c = C(), d = c.pick(R, [10, 12, 14, 16]), n = c.pick(R, [63, 90, 125, 180]), L = c.ri(R, 4, 8) * 5, k = c.ri(R, 0, 3), CAUSES = ['Der Handvorschub ist bei dieser kleinen Drehzahl zu schnell (Vorschub je Umdrehung zu groß)', 'Das Werkstück ist nicht gespannt und dreht mit', 'Die Späne stauen sich in den Nuten, der Bohrer wurde nicht gelüftet', 'Der Bohrer sitzt nicht zentrisch im Futter'];
      const fok = d * (0.012 + R() * 0.008), fbig = d * (0.12 + R() * 0.12), fv = k === 0 ? fbig : fok, t = c.rd(c.timeMin(L, fv, n) * 60, 1), fReal = L / ((t / 60) * n), fw = c.feedWindow(d);
      const expl = ['Aus Weg und Zeit folgt vf = ' + f(L / (t / 60), 0) + ' mm/min, mit n = ' + n + ' also f = vf / n = ' + f(fReal, 2) + ' mm/U. Zulässig sind etwa ' + f(fw[0], 2) + ' bis ' + f(fw[1], 2) + ' mm/U. Bei kleiner Drehzahl ist dieselbe Handkraft ein viel größerer Vorschub je Umdrehung. Sanfter vorschieben oder höhere Drehzahl.', 'Der Vorschub je Umdrehung passt (f = ' + f(fReal, 2) + ' mm/U), das Werkstück wurde aber nur von Hand gehalten und dreht mit. Werkstück immer spannen.', 'Der Vorschub je Umdrehung passt (f = ' + f(fReal, 2) + ' mm/U), die Späne stauen sich aber, weil nicht gelüftet wurde: Der Bohrer klemmt. Beim Tieferbohren zwischendurch lüften.', 'Der Vorschub je Umdrehung passt (f = ' + f(fReal, 2) + ' mm/U), der Bohrer eiert aber im Futter: Er sitzt schief und bricht. Neu spannen und Rundlauf prüfen.'][k];
      /* PRUEFEN P27: Fehlerbild C rechnet den Vorschub je Umdrehung bei Handvorschub aus Weg, Zeit und Drehzahl (f = L / (t · n)). Als zulässig gelten 0,01 bis 0,03 · d (Faustregel, siehe P15). Ist die Betrachtung „bei kleiner Drehzahl wird ein gleich schneller Handvorschub zu viel Vorschub je Umdrehung“ so in der Werkstatt üblich? */
      const qc = choiceQ(R, 'An der Ständerbohrmaschine bricht der Bohrer beim Bohren in Stahl. Beobachtet:\n• Bohrer: Ø ' + d + ' mm, Drehzahl ' + n + ' min⁻¹\n• Von Hand vorgeschoben: ' + L + ' mm in ' + f(t, 1) + ' s\n• Werkstück: ' + (k === 1 ? 'nur mit der Hand gehalten' : 'im Schraubstock gespannt') + '\n• Späne: ' + (k === 2 ? 'dicht gepackt in den Nuten, nicht gelüftet' : 'laufen frei aus den Nuten') + '\n• Rundlauf: ' + (k === 3 ? 'der Bohrer eiert beim Anlauf' : 'läuft ruhig rund') + '\nRichtwert (Übung): Vorschub 0,01 bis 0,03 · d in mm/U. Was ist die Ursache?', CAUSES[k], CAUSES.filter((_, i) => i !== k), expl, ['Rechne aus Weg und Zeit die Vorschubgeschwindigkeit, dann f = vf / n.', 'Vergleiche mit dem Richtwert und prüfe die anderen Angaben der Reihe nach.']);
      qc.meta = { k, d, n, L, t, fReal, fw }; return qc;
    }
  };
  const PROC_LABEL = { bohr: 'Bohren', dreh: 'Drehen', fraes: 'Fräsen' };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    [CATS[0], 1, 'Bauteile an Bohrmaschinen', 'partmark', 'bohr'], [CATS[0], 1, 'Bauteile an Drehmaschinen', 'partmark', 'dreh'], [CATS[0], 1, 'Bauteile an Fräsmaschinen', 'partmark', 'fraes'], [CATS[0], 2, 'Aufgabe der Bauteile', 'partfunc'], [CATS[0], 2, 'Bauteile und Aufgaben zuordnen', 'partmatch'],
    [CATS[1], 1, 'Drehzahl am Hebelstand', 'speedat'], [CATS[1], 1, 'Hebelstellung für eine Drehzahl', 'setfor'], [CATS[1], 2, 'Stufenlose Drehzahl einstellen', 'dslrange'], [CATS[1], 2, 'Bedienregeln', 'opq'], [CATS[1], 2, 'Vor dem Start', 'startorder'], [CATS[1], 3, 'Alle Hebel setzen', 'leverset'],
    [CATS[2], 1, 'Schnittgeschwindigkeit berechnen', 'vcn'], [CATS[2], 2, 'Drehzahl berechnen', 'nfromvc'], [CATS[2], 2, 'Nächste Stufe der Maschine', 'stagepick'], [CATS[2], 2, 'Vorschubtafel lesen', 'feedread'], [CATS[2], 2, 'Bohrzeit grob', 'drilltime'], [CATS[2], 3, 'Stufe beurteilen', 'vccheck'], [CATS[2], 3, 'Drehzahlreihe wählen', 'turnrange'], [CATS[2], 3, 'Stufen im Fenster', 'windowstages'],
    [CATS[3], 1, 'Not-Aus', 'notq'], [CATS[3], 1, 'Persönlicher Schutz', 'psaq'], [CATS[3], 1, 'Umgang mit Spänen', 'spanq'], [CATS[3], 2, 'Spannen statt halten', 'sphq'], [CATS[3], 2, 'Gefahr und Schutz', 'haz'], [CATS[3], 2, 'Kühlschmierstoff und Absaugung', 'kssq'],
    [CATS[4], 2, 'Spannpratzen beurteilen', 'pratze'], [CATS[4], 2, 'Spannmittel wählen', 'spannm'], [CATS[4], 1, 'Bohrfutter und Bohrer', 'bfq'], [CATS[4], 2, 'Aufnahme und Reitstock', 'aufnq'],
    [CATS[5], 2, 'Welche Maschine?', 'wahl'], [CATS[5], 3, 'Arbeit und Maschine', 'wahlmatch'], [CATS[5], 3, 'Passende Drehzahlstufe', 'wahlcalc'],
    [CATS[6], 2, 'Betriebsarten', 'cncmq'], [CATS[6], 2, 'Taste zuordnen', 'keytap'], [CATS[6], 3, 'Programmsatz lesen', 'satz'], [CATS[6], 3, 'Override und Restweg', 'ovr'], [CATS[6], 2, 'Referenzfahrt und Nullpunkt', 'cncrq'],
    [CATS[7], 2, 'Fehlerbild A', 'fsa'], [CATS[7], 3, 'Fehlerbild B', 'fsb'], [CATS[7], 3, 'Fehlerbild C', 'fsc']
  ];
  const tasks = defs.map((d, i) => ({ id: 'mak' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('mak-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Auswertung (rein, ohne DOM) ---------- */
  /* Antwortformen a: { c } Auswahl, { v } Zahl (Text), { o } Reihenfolge, { m } Zuordnung, { k } Taste. Ergebnis: { err } bei unvollständiger Antwort, sonst { ok, given } */
  function evaluate(q, a) {
    const c = C(), as = q.ask; a = a || {};
    if (as.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === as.correct, given: as.choices[a.c] }; }
    if (as.type === 'num') { const v = c.parseDe(a.v); if (!Number.isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (as.unit ? ' ' + as.unit : '') }; }
    if (as.type === 'order') { const o = a.o || []; if (o.length < as.items.length) return { err: 'Tippe alle Einträge in der richtigen Reihenfolge an.' }; return { ok: as.correct.every((x, i) => o[i] === x), given: o.map(i => as.items[i]).join(' → ') }; }
    if (as.type === 'match') { const m = a.m || []; if (as.rows.some((_, i) => m[i] == null)) return { err: 'Wähle für jede Zeile eine Zuordnung.' }; return { ok: as.correct.every((x, i) => m[i] === x), given: as.rows.map((r, i) => r + ' → ' + as.options[m[i]]).join('; ') }; }
    if (as.type === 'key') { if (!a.k) return { err: 'Tippe zuerst eine Taste im Bedienfeld an.' }; return { ok: a.k === as.correct, given: c.KEYS[a.k] ? c.KEYS[a.k].l : String(a.k) }; }
    return { err: 'Unbekannte Frageform.' };
  }
  function solAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: as.correct };
    if (as.type === 'num') return { v: String(+q.value.toFixed(6)).replace('.', ',') };
    if (as.type === 'order') return { o: as.correct.slice() };
    if (as.type === 'match') return { m: as.correct.slice() };
    return { k: as.correct };
  }
  function wrongAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: (as.correct + 1) % as.choices.length };
    if (as.type === 'num') return { v: '-12345' };
    if (as.type === 'order') return { o: as.correct.slice().reverse() };
    if (as.type === 'match') return { m: as.correct.map(x => (x + 1) % as.options.length) };
    return { k: as.correct === 'start' ? 'stop' : 'start' };
  }
  function solText(q) {
    const as = q.ask;
    if (as.type === 'choice') return as.choices[as.correct];
    if (as.type === 'num') return f(q.value, 2) + (as.unit ? ' ' + as.unit : '');
    if (as.type === 'order') return as.correct.map(i => as.items[i]).join(' → ');
    if (as.type === 'match') return as.rows.map((r, i) => r + ' → ' + as.options[as.correct[i]]).join('; ');
    return C().KEYS[as.correct].l;
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus MAK_CORE) ---------- */
  const examples = [
    { id: 'bohr1', tab: 'rech', title: 'Bohren Ø 10 in Baustahl an der Ständerbohrmaschine A', text: 'Wie viel Drehzahl, welche Stufe der Tafel, und wie lange dauert ein Bohrweg von 30 mm?', p: { m: 'sbA', proc: 'bohr', grp: 'stahl', d: '10', vc: '25', L: '30', f: '0,11' } },
    { id: 'bohr2', tab: 'rech', title: 'Kleine Bohrung in Aluminium an der Tischbohrmaschine 2-stufig', text: 'Ø 6 in Aluminium mit hoher vc: welche der vier Stufen passt?', p: { m: 'tb2', proc: 'bohr', grp: 'alu', d: '6', vc: '80', L: '15', f: '0,1' } },
    { id: 'dreh1', tab: 'rech', title: 'Drehen Ø 40 in Baustahl auf der stufenlosen Drehmaschine', text: 'Die Solldrehzahl liegt im Überschneidungsbereich beider Reihen: Beide gehen, die niedrige Reihe hat mehr Drehmoment.', p: { m: 'dsl', proc: 'dreh', grp: 'stahl', d: '40', vc: '30', L: '120', f: '0,2' } },
    { id: 'dreh2', tab: 'rech', title: 'Drehen Ø 30 auf der Drehmaschine mit Gruppenschaltung', text: 'Welche Gruppe und Stufe stellst du ein?', p: { m: 'dgr', proc: 'dreh', grp: 'stahl', d: '30', vc: '28', L: '80', f: '0,15' } },
    { id: 'fraes1', tab: 'rech', title: 'Fräsen mit Ø 16 in Baustahl', text: 'Fräsmaschine mit Digitalanzeige: Drehzahl und Stufe.', p: { m: 'frd', proc: 'fraes', grp: 'stahl', d: '16', vc: '25', L: '100', f: '120' } },
    { id: 'fraes2', tab: 'rech', title: 'Grenze der Maschine: Fräsen in Aluminium', text: 'Der Wunsch-vc ist so hoch, dass selbst die größte Stufe zu langsam ist. Die Anzeige sagt es ehrlich.', p: { m: 'bfr', proc: 'fraes', grp: 'alu', d: '12', vc: '150', L: '60', f: '100' } },
    { id: 'tour1', tab: 'mach', title: 'Rundgang an der Drehmaschine mit Gruppenschaltung', text: 'Tippe die Bauteile an: Support, Reitstock, Futter. Stelle Gruppe B und Stufe 2 ein und lies die Drehzahl in der Tafel ab.', p: { m: 'dgr', sel: [1, 1], hs: 'support' } },
    { id: 'tour2', tab: 'mach', title: 'Hebel und Tafel an der Ständerbohrmaschine A', text: 'Zeile 2, Buchstabe B ergibt 250 min⁻¹. Die Tafel markiert die Zelle, das Futter dreht dezent im Takt.', p: { m: 'sbA', sel: [1, 1], hs: 'tafel' } },
    { id: 'pratze1', tab: 'spann', title: 'Spannpratze richtig', text: 'Die Stütze ist so hoch wie das Werkstück, die Schraube sitzt nahe am Werkstück.', p: { stuetze: 'gleich', schraube: 'werkstueck' } },
    { id: 'pratze2', tab: 'spann', title: 'Spannpratze mit zu hoher Stütze', text: 'Hier liegt die Pratze nur an der Kante: Sie kann abrutschen.', p: { stuetze: 'hoch', schraube: 'werkstueck' } },
    { id: 'cnc1', tab: 'cnc', title: 'Bedienfeld: Betriebsart AUTO und der Programmsatz', text: 'Das Programm läuft in AUTO. Auf dem Bildschirm stehen Soll- und Istposition, der Override und der aktuelle Satz.', p: { mode: 'AUTO', ovr: 80, blk: 2 } },
    { id: 'cnc2', tab: 'cnc', title: 'Bedienfeld: Einzelsatz mit kleinem Override', text: 'So läuft ein Erstlauf: SINGLE, Override 50 %, Haube zu, Hand am Not-Aus.', p: { mode: 'SINGLE', ovr: 50, blk: 1 } },
    { id: 'zeit1', tab: 'rech', title: 'Schnittzeit grob: Bohren mit Selbstvorschub', text: 'Weg 40 mm, f = 0,16 mm/U bei 355 min⁻¹: vf = 56,8 mm/min, also etwa 42 s.', p: { m: 'sbA', proc: 'bohr', grp: 'stahl', d: '14', vc: '25', L: '40', f: '0,16' } }
  ];

  root.MAK_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, evaluate, solAns, wrongAns, solText, pools: { NOT, PSA, SPAN, SPH, KSS, BF, AUFN, OP, CNCMODE, CNCREF, JOBS, MTYPES } };
  root.MAK_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MAK_DATA, TASKS: root.MAK_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
