'use strict';
/* Tonfunk Kunststoff-Lab: Daten (Aufgaben-Generatoren, Beispiele, Zuordnungs-Sätze).
   ALLE Zahlen (Schwindung, Dichte, Dehnung, Zeiten, Kosten, Faustregeln) sind ÜBUNGSWERTE, nicht für die Praxis.
   window.KUN_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, sets }
   window.KUN_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'kun', Status in localStorage 'lm4.kun.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage hat steps (So gehst du vor), tips (zwei Stufen) und expl (Lösungsweg).
   Firma und Produkte sind frei erfunden ("Modellbetrieb", Gehäuse, Kappen, Halter). */
(function (root) {
  const C = () => root.KUN_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const e2 = v => C().fmtDe(v, 2, true);   /* Geldbeträge immer mit zwei Nachkommastellen */
  const CATS = ['Kunststoffe kennen', 'Urformverfahren', 'Spritzgussgerecht konstruieren', 'Schwindung und Maße', 'Verbindungen', 'Kosten'];

  const numQ = (text, value, unit, label, tol, expl, tips, steps) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, steps });
  function choiceQ(R, text, right, wrong, expl, tips, steps) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps };
  }
  /* Fragen-Pool: [Text, richtig, falsch[], Erklärung, Tipps]; steps gelten für den ganzen Pool */
  const pq = (POOL, steps) => R => { const q = C().pick(R, POOL); return choiceQ(R, q[0], q[1], q[2], q[3], q[4], steps); };
  const MB = 'Im Modellbetrieb ';
  /* Bild für die Aufgabenansicht anhängen (KUN_VIZ.img); spec ist eine Funktion des fertigen q oder ein Objekt */
  const im = (q, spec) => { q.img = spec; return q; };
  const withImg = (gen, spec) => R => { const q = gen(R); q.img = typeof spec === 'function' ? spec(q) : spec; return q; };

  /* ---------- Fragen-Pools ---------- */
  const ST_WAHL = ['Lies, was beschrieben wird, und unterstreiche das wichtigste Merkmal.', 'Ordne das Merkmal einem Begriff aus dem Lab zu.', 'Streiche die Antworten, die nicht passen, und wähle die übrige.'];
  const GRQ = [
    ['Ein Bauteil wird beim Erwärmen weich, lässt sich neu formen und schweißen. Zu welcher Gruppe gehört der Kunststoff?', 'Thermoplast', ['Duroplast', 'Elastomer', 'Metall'], 'Thermoplaste haben lange, nicht vernetzte Ketten. Wärme lässt sie gleiten: Der Stoff wird weich und lässt sich wieder formen.', ['Was passiert mit dem Stoff bei Wärme?', 'Thermo heißt Wärme.']],
    ['Ein Schaltergehäuse bleibt auch bei großer Hitze hart, wird nicht weich und verkohlt erst bei sehr hoher Temperatur. Zu welcher Gruppe gehört es?', 'Duroplast', ['Thermoplast', 'Elastomer', 'Schaumstoff'], 'Duroplaste sind engmaschig vernetzt. Nach dem Aushärten lassen sie sich nicht mehr schmelzen, sie zersetzen sich bei zu viel Hitze.', ['Wird der Stoff weich oder bleibt er hart?', 'Duro heißt hart.']],
    ['Eine Dichtung lässt sich stark dehnen und federt sofort in ihre Form zurück. Zu welcher Gruppe gehört sie?', 'Elastomer', ['Thermoplast', 'Duroplast', 'Glas'], 'Elastomere sind weitmaschig vernetzt. Die Ketten lassen sich strecken, die Vernetzung zieht sie wieder zurück: gummielastisch.', ['Woran erinnert das Verhalten?', 'Gummi gehört zu dieser Gruppe.']],
    ['Welche Gruppe lässt sich NICHT im Spritzgießen mit Recycling-Mahlgut wieder einschmelzen?', 'Duroplaste, weil sie vernetzt sind und nicht schmelzen', ['Thermoplaste, weil sie zu weich sind', 'Alle Kunststoffe lassen sich gleich gut einschmelzen', 'Nur Kunststoffe mit dem Code 05'], 'Nur Thermoplaste werden beim Erwärmen wieder flüssig. Vernetzte Duroplaste und Elastomere schmelzen nicht.', ['Welche Gruppe ist vernetzt und hart?', 'Schmelzen geht nur ohne Vernetzung.']],
    ['Warum lassen sich zwei Teile aus ABS mit Ultraschall verschweißen, zwei Teile aus Epoxidharz aber nicht?', 'ABS ist ein Thermoplast und schmilzt an der Fügestelle, Epoxidharz ist ein Duroplast und schmilzt nicht', ['Epoxidharz ist zu weich', 'ABS ist ein Duroplast', 'Ultraschall wirkt nur bei Metall'], 'Schweißen heißt: Die Fügeflächen schmelzen und verbinden sich. Das geht nur bei Thermoplasten.', ['Was muss beim Schweißen an der Fügestelle passieren?', 'Welche Gruppe schmilzt?']]
  ];
  const EINQ = [
    [MB + 'soll eine glasklare, schlagzähe Schutzhaube für eine Maschine entstehen. Welcher Kunststoff passt am besten?', 'PC (Polycarbonat)', ['PP (Polypropylen)', 'POM (Polyoxymethylen)', 'PE (Polyethylen)'], 'PC ist amorph, kann glasklar sein und ist sehr schlagzäh. PMMA wäre auch klar, bricht aber leichter.', ['Glasklar geht nur mit amorphen Kunststoffen.', 'Welcher amorphe Kunststoff ist besonders schlagzäh?']],
    [MB + 'bekommt eine Verschlusskappe ein angespritztes Scharnier, das tausendmal geöffnet wird. Welcher Kunststoff passt?', 'PP (Polypropylen)', ['PMMA (Acrylglas)', 'PC (Polycarbonat)', 'ABS'], 'PP ist der klassische Werkstoff für Filmscharniere: zäh, biegewillig und dauerhaft.', ['Welcher Kunststoff ist für Filmscharniere bekannt?', 'Spröde Kunststoffe brechen am Scharnier.']],
    [MB + 'soll ein kleines Zahnrad leise und ohne Schmierung laufen. Welcher Kunststoff passt?', 'POM (Polyoxymethylen)', ['PMMA (Acrylglas)', 'PE (Polyethylen)', 'PC (Polycarbonat)'], 'POM ist steif, maßhaltig und gleitfähig. Deshalb wird es oft für Zahnräder, Clips und Gleitteile genommen. PA ginge auch, nimmt aber Wasser auf.', ['Gesucht ist ein steifer, gleitfähiger Kunststoff.', 'Er wird auch für Schnapphaken gern genommen.']],
    [MB + 'soll ein glänzendes Gehäuse für ein Handgerät entstehen, das man auch lackieren und kleben kann. Welcher Kunststoff passt?', 'ABS', ['PE (Polyethylen)', 'PP (Polypropylen)', 'POM (Polyoxymethylen)'], 'ABS ergibt glänzende, schlagzähe Gehäuse und lässt sich gut kleben und lackieren. PE und PP sind schwer zu kleben.', ['Welche Kunststoffe lassen sich schlecht kleben?', 'Gesucht ist ein amorpher Gehäusewerkstoff.']],
    [MB + 'soll ein Lichtleiter das Licht einer Leuchtdiode zur Gehäusefront führen. Welcher Kunststoff passt?', 'PMMA (Acrylglas)', ['PA (Polyamid)', 'POM (Polyoxymethylen)', 'PP (Polypropylen)'], 'PMMA ist glasklar und leitet Licht sehr gut. Teilkristalline Kunststoffe sind milchig.', ['Licht leiten geht nur mit glasklarem Werkstoff.', 'Acrylglas.']],
    [MB + 'wird ein Kanister für Reinigungsmittel geblasen. Welcher Kunststoff passt?', 'PE-HD (Polyethylen)', ['PMMA (Acrylglas)', 'PC (Polycarbonat)', 'ABS'], 'PE-HD ist zäh, chemikalienbeständig und lässt sich gut blasformen. Kanister und Flaschen sind typische Teile.', ['Welcher Kunststoff verträgt viele Chemikalien?', 'Typische Teile aus PE: Flaschen und Kanister.']]
  ];
  const EIGQ = [
    ['Ein Kunststoff ist teilkristallin. Was trifft typisch zu?', 'Er schwindet stärker und ist eher milchig als glasklar', ['Er ist immer glasklar', 'Er schwindet kaum', 'Er ist vernetzt wie ein Duroplast'], 'In teilkristallinen Kunststoffen ordnen sich Kettenteile dicht an. Das macht sie milchig und lässt sie beim Abkühlen stärker schwinden.', ['Geordnete Bereiche brechen das Licht.', 'Dichte Packung heißt mehr Schwindung.']],
    ['Ein Kunststoff ist amorph. Was trifft typisch zu?', 'Er kann glasklar sein und schwindet wenig und gleichmäßig', ['Er ist immer milchig', 'Er schwindet stark', 'Er lässt sich nicht spritzgießen'], 'Amorphe Kunststoffe haben ungeordnete Ketten (wie Watte). Licht geht durch, die Schwindung ist klein und in alle Richtungen ähnlich.', ['Amorph heißt ungeordnet.', 'Welche Kunststoffe gibt es glasklar?']],
    ['Warum verziehen sich Teile aus teilkristallinem Kunststoff leichter als Teile aus amorphem Kunststoff?', 'Weil die Schwindung größer ist und je nach Fließrichtung unterschiedlich ausfällt', ['Weil sie leichter sind', 'Weil sie vernetzt sind', 'Weil sie nicht schmelzen'], 'Große und richtungsabhängige Schwindung erzeugt Spannungen. Das Teil verzieht sich.', ['Was ist bei teilkristallinen Kunststoffen größer?', 'Unterschiedliche Schwindung erzeugt Spannungen.']],
    ['Welche Gruppe von Kunststoffen kann glasklar sein?', 'Amorphe Thermoplaste wie PC und PMMA', ['Teilkristalline Thermoplaste wie POM und PA', 'Alle Duroplaste', 'Nur Elastomere'], 'Glasklar sind nur amorphe Kunststoffe, zum Beispiel PC, PMMA oder PS. Teilkristalline sind milchig bis opak.', ['Geordnete Bereiche streuen Licht.', 'Amorph heißt ohne Ordnung.']]
  ];
  const ST_VERF = ['Schau, welche Form das Teil hat: Formteil, endloses Profil, Hohlkörper oder dünne Schale.', 'Überlege, wie viele Teile gebraucht werden.', 'Wähle das Verfahren, das zu Form und Menge passt.'];
  const VERFQ = [
    [MB + 'werden Kabelschutzrohre als Meterware hergestellt. Welches Verfahren passt?', 'Extrudieren', ['Spritzgießen', 'Blasformen', '3D-Druck'], 'Endlose Profile wie Rohre, Schläuche und Platten entstehen beim Extrudieren: Die Schmelze wird durch eine Düse gedrückt.', ['Das Teil ist endlos lang.', 'Eine Düse gibt die Form des Querschnitts vor.']],
    [MB + 'werden 200.000 Gehäusedeckel mit Rippen und Schraubdomen gebraucht. Welches Verfahren passt?', 'Spritzgießen', ['Extrudieren', 'Tiefziehen', '3D-Druck'], 'Formteile mit Rippen und Domen in großer Stückzahl werden spritzgegossen. Das Werkzeug ist teuer, das einzelne Teil aber billig.', ['Rippen und Dome gehen nur in einer geschlossenen Form.', 'Große Stückzahl.']],
    [MB + 'wird eine Flasche für Kühlmittel mit engem Hals gebraucht. Welches Verfahren passt?', 'Blasformen', ['Spritzgießen', 'Extrudieren', 'Tiefziehen'], 'Hohlkörper mit engem Hals entstehen beim Blasformen: Ein weicher Schlauch wird in der Form aufgeblasen.', ['Das Teil ist innen hohl.', 'Luft drückt die Wand an die Form.']],
    [MB + 'werden dünnwandige Verpackungsschalen aus einer Kunststoffplatte geformt. Welches Verfahren passt?', 'Tiefziehen (Thermoformen)', ['Spritzgießen', 'Extrudieren', 'Blasformen'], 'Beim Tiefziehen wird eine erwärmte Platte über oder in eine Form gezogen (Vakuum oder Druck). Das Werkzeug ist günstig.', ['Ausgangsmaterial ist eine Platte.', 'Die Wand wird gezogen, nicht gespritzt.']],
    [MB + 'braucht man drei Muster eines neuen Halters, um die Passung zu testen. Welches Verfahren passt?', '3D-Druck (FDM)', ['Spritzgießen', 'Blasformen', 'Extrudieren'], 'Für wenige Muster lohnt kein Werkzeug. Der 3D-Druck baut das Teil Schicht für Schicht direkt aus den CAD-Daten.', ['Wie viele Teile werden gebraucht?', 'Welches Verfahren braucht kein Werkzeug?']]
  ];
  const SG3DQ = [
    ['Ein Halter aus dem 3D-Drucker (FDM) bricht bei Belastung zwischen zwei Schichten. Warum?', 'Die Schichten haften schwächer aneinander als das Material in einer Schicht', ['Der Kunststoff ist ein Duroplast', 'Das Teil ist zu leicht', 'Weil 3D-Druck keine Kunststoffe verarbeitet'], 'Beim FDM liegen die Schichten aufeinander. Quer zu den Schichten hält das Teil weniger aus. Deshalb legt man die Druckrichtung passend zur Last.', ['Wie entsteht das Teil beim FDM?', 'Die schwächste Stelle liegt zwischen den Schichten.']],
    ['Wann ist Spritzgießen dem 3D-Druck klar überlegen?', 'Bei großen Stückzahlen gleicher Teile, weil das einzelne Teil dann sehr billig und schnell ist', ['Bei einem einzigen Muster', 'Wenn sich die Form noch oft ändert', 'Wenn kein Geld für ein Werkzeug da ist'], 'Spritzgießen braucht ein teures Werkzeug, liefert dann aber in Sekunden gleiche Teile. Das lohnt sich erst ab vielen Teilen.', ['Was kostet beim Spritzgießen viel Geld am Anfang?', 'Wie schnell ist ein Zyklus?']],
    ['Was spricht für den 3D-Druck in der Entwicklung eines neuen Gehäuses?', 'Änderungen kosten fast nichts, weil kein Werkzeug geändert werden muss', ['Die Teile sind immer fester als Spritzgussteile', 'Der Druck ist bei großen Stückzahlen am billigsten', 'Der 3D-Druck braucht keine CAD-Daten'], 'In der Entwicklung ändert sich die Form oft. Ohne Werkzeug wird einfach die neue Datei gedruckt.', ['Was passiert bei einer Änderung am Spritzgießwerkzeug?', 'Der Drucker braucht nur die neue Datei.']],
    ['Was bedeutet "Mehrfachwerkzeug" (zum Beispiel mit 4 Kavitäten) beim Spritzgießen?', 'In einem Zyklus entstehen vier gleiche Teile', ['Das Werkzeug hält viermal so lange', 'Vier Maschinen teilen sich ein Werkzeug', 'Das Teil wird viermal nacheinander gespritzt'], 'Eine Kavität ist ein Formnest. Mit vier Kavitäten entstehen pro Zyklus vier Teile. Das Werkzeug wird teurer, die Teile je Stunde vervierfachen sich.', ['Kavität heißt Formnest.', 'Wie viele Teile fallen pro Zyklus heraus?']]
  ];
  const FEHLQ = [
    ['Auf der Sichtseite eines Deckels ist genau gegenüber einer Rippe eine flache Mulde zu sehen. Was ist die wahrscheinliche Ursache?', 'Die Rippe ist zu dick, am Rippenfuß sammelt sich Masse und schwindet nach (Einfallstelle)', ['Die Entformungsschräge ist zu groß', 'Der Radius ist zu groß', 'Die Wand ist zu dünn'], 'Eine Einfallstelle entsteht an Masseanhäufungen. Abhilfe: Rippe dünner (0,5 bis 0,7 · Wanddicke), mehr Nachdruck.', ['Wo sitzt die Mulde?', 'Was ist an dieser Stelle dicker als sonst?']],
    ['Hinter einem Loch ist auf dem Teil eine feine Linie zu sehen, und genau dort bricht das Teil bei Belastung. Was ist das?', 'Eine Bindenaht: Zwei Schmelzefronten treffen sich hinter dem Loch und verbinden sich schlecht', ['Eine Einfallstelle durch zu dicke Wand', 'Ein Kratzer vom Auswerfen', 'Ein Lunker in der Mitte der Wand'], 'Die Schmelze fließt um den Kern des Lochs herum und trifft sich dahinter. Die Naht ist sichtbar und schwächer. Die Angusslage verschiebt sie in unkritische Bereiche.', ['Was passiert mit der Schmelze, wenn sie auf einen Kern trifft?', 'Zwei Fronten treffen sich.']],
    ['Ein langes, flaches Teil aus POM liegt nach dem Abkühlen nicht mehr plan auf dem Tisch. Wie heißt der Fehler?', 'Verzug durch ungleichmäßige Schwindung', ['Einfallstelle', 'Bindenaht', 'Grat'], 'POM ist teilkristallin und schwindet stark und richtungsabhängig. Unterschiedliche Schwindung verbiegt das Teil: Verzug.', ['Das ganze Teil hat seine Form verändert.', 'Welcher Kunststoff schwindet stark?']],
    ['Ein Teil hat außen Kratzer in Entformungsrichtung und bleibt manchmal am Kern hängen. Was fehlt wahrscheinlich?', 'Eine ausreichende Entformungsschräge', ['Eine Bindenaht', 'Eine dickere Rippe', 'Ein kleinerer Radius'], 'Ohne Schräge reibt die Wand beim Auswerfen über die ganze Länge am Kern. Schon 0,5 bis 1° helfen.', ['In welcher Richtung laufen die Kratzer?', 'Was erleichtert das Abziehen vom Kern?']],
    ['Ein Gehäuse reißt bei einem Sturz immer an derselben scharfen Innenecke. Was ist die Ursache?', 'Kerbwirkung durch eine scharfe Ecke ohne Radius', ['Zu große Entformungsschräge', 'Zu dünne Rippe auf der anderen Seite', 'Zu wenig Schwindung'], 'In einer scharfen Ecke sammeln sich die Spannungen (Kerbwirkung). Ein Innenradius von mindestens 0,5 · Wanddicke verteilt sie.', ['Wo reißt das Teil?', 'Was fehlt an der Ecke?']]
  ];
  const HINTQ = [
    ['Was ist ein Hinterschnitt an einem Spritzgussteil?', 'Eine Form, die das Teil daran hindert, in Öffnungsrichtung aus dem Werkzeug zu kommen', ['Eine besonders dünne Rippe', 'Die Fläche, an der der Anguss sitzt', 'Eine Schräge an der Wand'], 'Ein Hinterschnitt hakt in Öffnungsrichtung fest, zum Beispiel ein seitliches Loch oder ein Schnapphaken.', ['In welcher Richtung öffnet das Werkzeug?', 'Was würde dabei festhaken?']],
    ['Ein Gehäuse braucht ein seitliches Loch für einen Stecker. Wie lässt es sich entformen?', 'Mit einem Schieber, der vor dem Öffnen seitlich herausfährt', ['Gar nicht, Spritzgießen ist dann unmöglich', 'Durch eine größere Rippe', 'Durch mehr Nachdruck'], 'Ein Schieber (Kernzug) fährt quer zur Öffnungsrichtung heraus. Das Werkzeug wird dadurch teurer, deshalb vermeidet man Hinterschnitte, wo es geht.', ['Das Loch liegt quer zur Öffnungsrichtung.', 'Ein Teil des Werkzeugs muss seitlich weg.']],
    ['Wie vermeidest du einen Hinterschnitt für ein seitliches Fenster, ganz ohne Schieber?', 'Das Fenster bis zur Kante öffnen oder den Durchbruch so legen, dass ein Kern in Öffnungsrichtung ihn bildet', ['Die Wand dicker machen', 'Eine scharfe Ecke einbauen', 'Den Anguss neben das Fenster legen'], 'Wird die Form so geändert, dass alle Flächen in Öffnungsrichtung frei sind, braucht das Werkzeug keinen Schieber. Das spart Geld.', ['Was muss für das Entformen frei sein?', 'Ändere die Form, nicht das Werkzeug.']],
    ['Warum lässt sich ein kleiner Hinterschnitt an einem Teil aus PE manchmal ohne Schieber entformen?', 'PE ist weich und zäh, der Hinterschnitt federt beim Auswerfen kurz auf (Zwangsentformung)', ['Weil PE ein Duroplast ist', 'Weil PE nicht schwindet', 'Weil PE glasklar ist'], 'Weiche, zähe Kunststoffe können kleine Hinterschnitte überspringen. Bei steifen oder spröden Werkstoffen bricht das Teil oder es bleibt hängen.', ['Ist der Werkstoff weich oder spröde?', 'Das Teil muss sich kurz verformen dürfen.']]
  ];
  const ANGQ = [
    ['Wo setzt du den Anguss bei einem Teil mit einer dicken und einer dünnen Zone?', 'An der dicken Zone, damit die Schmelze von dick nach dünn fließt und der Nachdruck wirkt', ['An der dünnsten Stelle', 'Auf der Sichtfläche in der Mitte', 'Egal, die Lage hat keinen Einfluss'], 'Von dick nach dünn bleibt der Fließweg lange offen, der Nachdruck erreicht die dicke Stelle und verhindert Einfallstellen.', ['Welche Zone erstarrt zuletzt?', 'Der Nachdruck braucht einen offenen Weg.']],
    ['Ein Teil hat zwei Löcher und wird an einem Ende angespritzt. Wohin legst du die Bindenähte?', 'In Bereiche ohne große Last und ohne Sichtanspruch, durch passende Lage des Angusses', ['Direkt in die Biegestelle eines Schnapphakens', 'Mitten auf die Sichtfläche', 'Bindenähte entstehen nur ohne Löcher'], 'Bindenähte sind schwächer und sichtbar. Mit der Angusslage verschiebt man sie dorthin, wo sie nicht stören.', ['Was ist an einer Bindenaht schwach?', 'Welche Stellen sollen fest und schön sein?']],
    ['Warum setzt man den Anguss nicht auf eine Sichtfläche?', 'Der Anguss hinterlässt eine Marke, die man sieht', ['Weil sich dort keine Schmelze verteilen kann', 'Weil die Schwindung dort null ist', 'Weil Sichtflächen keine Wanddicke haben'], 'Wo der Anguss abgetrennt wird, bleibt ein kleiner Rest oder eine Marke. Deshalb sitzt er auf einer verdeckten Fläche oder an einer Kante.', ['Was bleibt nach dem Abtrennen zurück?', 'Wo stört das nicht?']]
  ];
  const VERZQ = [
    ['Was ist Verzug bei einem Spritzgussteil?', 'Eine Formänderung des ganzen Teils (zum Beispiel Verbiegen), weil es ungleichmäßig schwindet', ['Eine Mulde gegenüber einer Rippe', 'Ein Grat an der Trennebene', 'Eine Farbänderung durch Licht'], 'Schwinden verschiedene Bereiche unterschiedlich, entstehen Spannungen und das Teil verbiegt oder verwindet sich.', ['Betroffen ist das ganze Teil.', 'Ungleichmäßig schwinden heißt Spannung.']],
    ['Welche Maßnahme verringert Verzug am meisten?', 'Gleichmäßige Wanddicke und gleichmäßige Kühlung', ['Scharfe Ecken', 'Dicke Rippen auf einer Seite', 'Ein Anguss mitten auf der Sichtfläche'], 'Gleich dicke Wände kühlen gleich schnell ab und schwinden gleich. Dann bleiben die Spannungen klein.', ['Was schwindet gleich?', 'Gleiche Dicke, gleiche Abkühlung.']],
    ['Warum verziehen sich glasfaserverstärkte Teile oft trotz kleiner Schwindung?', 'Die Fasern richten sich in Fließrichtung aus, längs schwindet das Teil weniger als quer', ['Glasfasern schmelzen beim Abkühlen', 'Glasfasern machen den Kunststoff zum Duroplast', 'Glasfasern erhöhen die Schwindung in jede Richtung gleich'], 'Fasern behindern die Schwindung längs. Quer dazu schwindet das Teil mehr. Der Unterschied verzieht das Teil.', ['Wie liegen die Fasern nach dem Einspritzen?', 'Längs und quer sind verschieden.']]
  ];
  const TOLQ = [
    ['Warum bekommen Kunststoffteile meist größere Toleranzen als gefräste Metallteile?', 'Die Schwindung streut je nach Werkstoff, Wanddicke und Verarbeitung, das Maß schwankt deshalb stärker', ['Kunststoff lässt sich nicht messen', 'Kunststoffteile werden immer gefräst', 'Weil Kunststoffteile keine Maße haben'], 'Die Schwindung ist nie ganz gleich. Je größer die Schwindung und je länger das Maß, desto größer die Schwankung. Engere Toleranzen kosten viel Aufwand.', ['Was verändert das Maß nach dem Spritzen?', 'Ist die Schwindung immer gleich?']],
    ['Welche Maße eines Spritzgussteils sind meist genauer?', 'Maße, die nur von einer Werkzeughälfte gebildet werden', ['Maße über die Trennebene hinweg', 'Maße, die von Schiebern abhängen', 'Alle Maße sind gleich genau'], 'Maße in einer Werkzeughälfte hängen nur vom Formnest ab. Über die Trennebene oder Schieber kommen Spiel und Verschiebung dazu.', ['Was kommt bei der Trennebene dazu?', 'Je weniger bewegte Teile, desto genauer.']],
    ['In welchem Regelwerk stehen Toleranzen für Kunststoff-Formteile?', 'In einer eigenen Norm für Kunststoff-Formteile (DIN ISO 20457, früher DIN 16742)', ['In der ISO-Passungstabelle für Wellen', 'Im Recycling-Code', 'Im Datenblatt des 3D-Druckers'], 'Für Kunststoff-Formteile gibt es eine eigene Toleranznorm. Allgemeintoleranzen für Metall (ISO 2768) passen nicht gut zu Kunststoff.', ['Kunststoff hat eigene Regeln.', 'Die Norm heißt Formteile, Toleranzen.']]
  ];
  const VERBQ = [
    [MB + 'soll ein Batteriedeckel oft geöffnet und ohne Werkzeug wieder geschlossen werden. Welche Verbindung passt?', 'Schnapphaken', ['Kleben', 'Ultraschallschweißen', 'Eingespritzte Gewindebuchse ohne Schraube'], 'Schnapphaken sind lösbar und brauchen kein Werkzeug. Die Haken werden gleich mit angespritzt.', ['Soll die Verbindung lösbar sein?', 'Was federt und rastet ein?']],
    [MB + 'soll ein Gehäuse für die Wartung oft verschraubt werden, ohne dass das Gewinde im Kunststoff ausreißt. Welche Lösung passt?', 'Gewindeeinsatz aus Messing (eingespritzt oder warm eingebettet)', ['Direkt eingedrehte Schraube ohne Dom', 'Kleben', 'Filmscharnier'], 'Ein Metall-Gewindeeinsatz hält viele Montagen aus. Direkt geschraubte Gewinde im Kunststoff nutzen sich bei häufigem Lösen ab.', ['Wie oft wird geschraubt?', 'Metallgewinde verschleißt kaum.']],
    [MB + 'sollen zwei Hälften eines Gehäuses aus ABS dicht und dauerhaft verbunden werden, in großer Stückzahl und in Sekunden. Welche Lösung passt?', 'Ultraschallschweißen', ['Schnapphaken', 'Schrauben mit Gewindeeinsatz', 'Filmscharnier'], 'Ultraschall schmilzt die Fügeflächen in Sekunden an. Die Naht ist dicht und nicht lösbar. Das geht bei Thermoplasten wie ABS.', ['Soll die Verbindung lösbar sein?', 'Was geht schnell und dicht bei Thermoplasten?']],
    ['Warum lässt sich PP schlecht kleben?', 'PP ist unpolar, der Klebstoff haftet kaum; die Oberfläche muss vorbehandelt werden (zum Beispiel Plasma oder Beflammen)', ['PP schmilzt beim Kleben', 'PP ist ein Duroplast', 'PP ist zu schwer'], 'PE und PP haben eine reaktionsträge Oberfläche. Ohne Vorbehandlung hält kaum ein Klebstoff.', ['Welche Kunststoffe gelten als schwer klebbar?', 'Die Oberfläche muss aktiviert werden.']]
  ];
  const FILMQ = [
    ['Was ist ein Filmscharnier?', 'Eine sehr dünne, angespritzte Stelle, an der sich zwei Teile wie mit einem Scharnier gegeneinander klappen lassen', ['Ein Scharnier aus Metall, das eingeklebt wird', 'Eine Folie, die über das Teil geklebt wird', 'Ein Schnapphaken mit Feder'], 'Das Filmscharnier ist Teil des Spritzgussteils. Es ist nur wenige Zehntelmillimeter dick und kann sehr oft gebogen werden.', ['Woraus besteht das Scharnier?', 'Es wird gleich mitgespritzt.']],
    ['Aus welchem Kunststoff macht man Filmscharniere meist?', 'PP (Polypropylen)', ['PMMA (Acrylglas)', 'PC (Polycarbonat)', 'Duroplast'], 'PP hält sehr viele Biegungen aus. Spröde Kunststoffe wie PMMA würden sofort brechen.', ['Gesucht ist ein zäher, biegewilliger Thermoplast.', 'Verschlusskappen sind oft aus diesem Stoff.']],
    ['Warum wird ein neues Filmscharnier direkt nach dem Entformen ein paar Mal gebogen?', 'Die Ketten richten sich dabei aus, das Scharnier wird zäher und hält länger', ['Damit es bricht und man es neu spritzen kann', 'Damit es abkühlt', 'Damit die Farbe hält'], 'Das erste Biegen im warmen Zustand streckt und ordnet die Ketten in der dünnen Stelle (Recken). Danach ist das Scharnier dauerhaft.', ['Was passiert mit den Ketten beim Biegen?', 'Warm biegen macht das Scharnier zäh.']]
  ];
  const FUEGQ = [
    ['Wozu dient der dreieckige Grat (Energierichtungsgeber) an einer Fügefläche beim Ultraschallschweißen?', 'Er bündelt die Schwingung, schmilzt zuerst und füllt die Fuge', ['Er hält das Teil im Werkzeug fest', 'Er zeigt die Angusslage an', 'Er verhindert jedes Schmelzen'], 'An der Spitze des Dreiecks wird die Energie konzentriert. Die Spitze schmilzt zuerst und verteilt sich in der Naht.', ['Wo wird es zuerst warm?', 'Spitze heißt kleine Fläche, hohe Energie.']],
    ['Welche Teile lassen sich NICHT miteinander verschweißen?', 'Zwei Teile aus Duroplast', ['Zwei Teile aus ABS', 'Zwei Teile aus PP', 'Zwei Teile aus PC'], 'Schweißen braucht schmelzbare Werkstoffe. Duroplaste schmelzen nicht, sie werden geklebt oder geschraubt.', ['Welche Gruppe schmilzt nicht?', 'Vernetzt heißt nicht schmelzbar.']],
    ['Was ist ein Vorteil von Kleben gegenüber Schweißen?', 'Auch verschiedene Werkstoffe (zum Beispiel Kunststoff mit Metall) lassen sich verbinden', ['Kleben ist bei PP immer ohne Vorbehandlung fest', 'Kleben ist lösbar wie eine Schraube', 'Kleben braucht keine Aushärtezeit'], 'Klebstoff verbindet auch Werkstoffe, die nicht zusammen schmelzen. Nachteile: Aushärtezeit, Vorbehandlung, nicht lösbar.', ['Lassen sich Kunststoff und Metall verschweißen?', 'Klebstoff haftet an beiden Flächen.']]
  ];
  const KOSTQ = [
    ['Wie senkst du die Stückkosten eines Spritzgussteils, wenn die Stückzahl groß ist?', 'Mehr Kavitäten im Werkzeug und dünnere, gleichmäßige Wände (kürzere Kühlzeit)', ['Dickere Wände für mehr Festigkeit', 'Mehr Schieber für jede Kante', 'Jedes Teil einzeln drucken'], 'Mehr Kavitäten bringen mehr Teile je Zyklus. Dünne Wände kühlen schneller ab. Beides senkt die Maschinenzeit je Teil.', ['Was bestimmt die Zeit je Teil?', 'Die Kühlzeit hängt an der Wanddicke.']],
    ['Was macht ein Spritzgießwerkzeug teuer?', 'Schieber für Hinterschnitte, viele Kavitäten und enge Toleranzen', ['Große Entformungsschrägen', 'Gleichmäßige Wanddicke', 'Große Radien'], 'Jeder Schieber ist eine eigene Mechanik. Mehr Kavitäten und enge Toleranzen brauchen mehr Fertigungszeit im Werkzeugbau.', ['Was muss im Werkzeug zusätzlich bewegt werden?', 'Hinterschnitte kosten Geld.']],
    ['Was zählt zu den Stückkosten eines Spritzgussteils (ohne Werkzeug)?', 'Material, Maschinenzeit und Nacharbeit je Teil', ['Nur der Preis des Werkzeugs', 'Die Kosten der CAD-Lizenz', 'Nur die Miete der Halle für ein Jahr'], 'Stückkosten fallen je Teil an: Granulat, Maschinenstundensatz mal Zeit je Teil, eventuell Nacharbeit. Das Werkzeug ist ein einmaliger Betrag.', ['Was fällt für jedes Teil neu an?', 'Das Werkzeug wird nur einmal bezahlt.']]
  ];

  /* ---------- Generatoren ---------- */
  const G = {
    /* Kunststoffe kennen */
    gruppe: withImg(pq(GRQ, ST_WAHL), { k: 'groups' }),
    kurz: R => {
      const c = C(), m = c.pick(R, c.MATS), wrong = c.shuffle(R, c.MATS.filter(x => x !== m)).slice(0, 3).map(x => x.n);
      return choiceQ(R, 'Auf einer Zeichnung im Modellbetrieb steht als Werkstoff das Kurzzeichen ' + m.k + '. Welcher Kunststoff ist gemeint?', m.n, wrong,
        m.k + ' steht für ' + m.n + '. Eigenschaften: ' + m.eig + '. Typische Teile: ' + m.use + '.', ['Die Buchstaben sind Teile des chemischen Namens.', 'Poly heißt viele: Polyethylen besteht aus vielen Ethylen-Bausteinen.'],
        ['Lies das Kurzzeichen.', 'Suche den Namen, dessen Anfangsbuchstaben passen.', 'Prüfe mit der Werkstofftabelle im Reiter Kunststoffe.']);
    },
    struk: R => {
      const c = C(), m = c.pick(R, c.MATS), right = m.struk === 'amorph' ? 'amorph' : 'teilkristallin';
      return im(choiceQ(R, 'Ist ' + m.k + ' (' + m.n + ') ein amorpher oder ein teilkristalliner Thermoplast?', right, [right === 'amorph' ? 'teilkristallin' : 'amorph', 'vernetzt wie ein Duroplast'],
        m.k + ' ist ' + right + '. ' + (right === 'amorph' ? 'Amorphe Kunststoffe können glasklar sein und schwinden wenig (' : 'Teilkristalline Kunststoffe sind milchig und schwinden stärker (') + f(m.smin, 1) + ' bis ' + f(m.smax, 1) + ' % als Übungswert).',
        ['Kann man den Kunststoff glasklar kaufen?', 'Große Schwindung spricht für teilkristallin.'], ['Denke an die typischen Teile aus diesem Kunststoff.', 'Sind sie glasklar oder milchig?', 'Glasklar heißt amorph, milchig heißt teilkristallin.']), { k: 'struk', o: { names: false } });
    },
    einsatz: pq(EINQ, ['Lies, was das Teil können muss (klar, zäh, gleitfähig, biegsam).', 'Vergleiche mit den Eigenschaften in der Werkstofftabelle.', 'Wähle den Kunststoff, der alle Anforderungen erfüllt.']),
    rcode: R => {
      const c = C(), i = c.ri(R, 0, 5), r = c.RCODES[i], wrong = c.shuffle(R, c.RCODES.filter((_, j) => j !== i)).slice(0, 3).map(x => x[1]);
      return choiceQ(R, 'Auf einem Kanister steht im Recycling-Dreieck die Zahl ' + r[0] + '. Welcher Kunststoff ist gemeint?', r[1], wrong,
        'Die Codes lauten: ' + c.RCODES.map(x => x[0] + ' ' + x[1]).join(', ') + '. Code ' + r[0] + ' steht für ' + r[1] + '.', ['Die Codes 01 bis 06 stehen für die sechs häufigsten Verpackungskunststoffe.', 'PE gibt es zweimal: hart (HD) und weich (LD).'],
        ['Lies die Zahl im Dreieck.', 'Suche die Zahl in der Liste der Recycling-Codes (Reiter Kunststoffe).', 'Wähle das passende Kurzzeichen.']);
    },
    eig: withImg(pq(EIGQ, ['Kläre, ob amorph (ungeordnet) oder teilkristallin (teils geordnet) gemeint ist.', 'Leite daraus Durchsicht und Schwindung ab.', 'Wähle die passende Aussage.']), { k: 'struk', o: { names: false } }),
    masse: R => {
      const c = C(), m = c.pick(R, c.MATS), v = c.pick(R, [12, 18, 24, 30, 36, 45]), n = c.pick(R, [500, 1000, 2000, 5000]), a = c.pick(R, [5, 8, 10, 15]), mg = c.partMass(v, m.rho), kg = c.granulateKg(mg, n, a);
      return numQ(MB + 'wird ein Halter aus ' + m.k + ' gespritzt (Dichte ' + f(m.rho, 2) + ' g/cm³, Übungswert). Ein Teil hat ' + f(v, 0) + ' cm³ Volumen. Es werden ' + f(n, 0) + ' Teile gebraucht, für Anguss und Anfahren kommen ' + f(a, 0) + ' % dazu. Wie viel Granulat brauchst du in kg?', kg, 'kg', 'Granulat', 0.05,
        'Masse je Teil: ' + f(v, 0) + ' cm³ · ' + f(m.rho, 2) + ' g/cm³ = ' + f(mg, 2) + ' g. Für ' + f(n, 0) + ' Teile: ' + f(mg * n, 0) + ' g. Mit ' + f(a, 0) + ' % Zuschlag: ' + f(mg * n, 0) + ' g · ' + f(1 + a / 100, 2) + ' = ' + f(mg * n * (1 + a / 100), 0) + ' g = ' + f(kg, 2) + ' kg.',
        ['Masse = Volumen · Dichte.', 'Zum Schluss den Zuschlag aufschlagen und von g in kg umrechnen (geteilt durch 1.000).'],
        ['Rechne die Masse eines Teils: Volumen mal Dichte.', 'Multipliziere mit der Stückzahl.', 'Schlage den Zuschlag auf (mal 1 plus Prozent durch 100).', 'Rechne g in kg um.']);
    },
    /* Urformverfahren */
    verf: pq(VERFQ, ST_VERF),
    zyklus: R => {
      const c = C(), i = c.ri(R, 0, c.CYCLE.length - 2), right = c.CYCLE[i + 1].n, wrong = c.shuffle(R, c.CYCLE.filter((_, j) => j !== i && j !== i + 1)).slice(0, 3).map(x => x.n);
      return choiceQ(R, 'Im Spritzgießzyklus ist der Schritt "' + c.CYCLE[i].n + '" gerade fertig. Welcher Schritt folgt?', right, wrong,
        'Der Zyklus lautet: ' + c.CYCLE.map((x, j) => (j + 1) + '. ' + x.n).join(', ') + '. Danach beginnt er von vorn. Nach "' + c.CYCLE[i].n + '" folgt "' + right + '".',
        ['Erst wird die Form gefüllt, dann muss das Teil fest werden, dann kommt es heraus.', 'Das Teil muss erst abkühlen, bevor die Form aufgeht.'],
        ['Sage den Zyklus einmal laut auf: Schließen, ...', 'Suche den genannten Schritt.', 'Nimm den Schritt direkt danach.']);
    },
    zykzeit: R => {
      const c = C(), ph = { schl: c.pick(R, [1, 1.5, 2]), einspr: c.pick(R, [0.8, 1, 1.5, 2]), nach: c.pick(R, [3, 4, 5, 6]), kuehl: c.pick(R, [8, 10, 12, 15, 18]), oeffn: c.pick(R, [1, 1.5, 2]), ausw: c.pick(R, [0.5, 1, 1.5]) }, tz = c.cycleTime(ph);
      return im(numQ(MB + 'wird eine Kappe gespritzt. Zeiten je Schritt (Übungswerte): ' + c.CYCLE.map(x => x.n + ' ' + f(ph[x.k], 1) + ' s').join(', ') + '. Wie lang ist ein Zyklus?', tz, 's', 'Zykluszeit', 0.01,
        'Zykluszeit = ' + c.CYCLE.map(x => f(ph[x.k], 1)).join(' + ') + ' = ' + f(tz, 1) + ' s. Die Kühlzeit ist der größte Anteil (' + f(ph.kuehl / tz * 100, 0) + ' %).',
        ['Alle Schritte laufen nacheinander ab.', 'Zähle alle sechs Zeiten zusammen.'], ['Schreibe die sechs Zeiten untereinander.', 'Zähle sie zusammen.', 'Gib das Ergebnis in Sekunden an.']), { k: 'cycle', p: { ph: 1 } });
    },
    tph: R => {
      const c = C(), tz = c.pick(R, [12, 15, 18, 20, 24, 30, 36]), kav = c.pick(R, [1, 2, 4, 8]), v = c.partsPerHour(tz, kav);
      return im(numQ(MB + 'läuft ein Werkzeug mit ' + f(kav, 0) + ' Kavität' + (kav > 1 ? 'en' : '') + '. Ein Zyklus dauert ' + f(tz, 0) + ' s. Wie viele Teile entstehen in einer Stunde?', v, 'Teile', 'Teile je Stunde', 0.5,
        'Zyklen je Stunde: 3.600 s / ' + f(tz, 0) + ' s = ' + f(3600 / tz, 1) + '. Teile je Stunde: ' + f(3600 / tz, 1) + ' · ' + f(kav, 0) + ' = ' + f(v, 0) + ' Teile.',
        ['Eine Stunde hat 3.600 Sekunden.', 'Jeder Zyklus liefert so viele Teile, wie das Werkzeug Kavitäten hat.'], ['Rechne die Zyklen je Stunde: 3.600 geteilt durch die Zykluszeit.', 'Multipliziere mit der Zahl der Kavitäten.']), { k: 'cycle', p: { ph: 5 } });
    },
    kuehl: R => {
      const c = C(), s1 = c.pick(R, [1.5, 2, 2.5, 3]), s2 = c.pick(R, [3, 4, 5, 6].filter(x => x > s1)), t1 = c.coolTime(s1), t2 = c.coolTime(s2);
      return im(numQ('Übungsregel: Die Kühlzeit wächst mit dem Quadrat der Wanddicke, t = ' + f(c.KCOOL, 0) + ' s/mm² · s². Ein Deckel hat ' + f(s1, 1) + ' mm Wand. Eine Kollegin will die Wand auf ' + f(s2, 1) + ' mm erhöhen. Um wie viele Sekunden wird die Kühlzeit länger?', t2 - t1, 's', 'Mehr Kühlzeit', 0.05,
        'Vorher: ' + f(c.KCOOL, 0) + ' · ' + f(s1, 1) + '² = ' + f(t1, 2) + ' s. Nachher: ' + f(c.KCOOL, 0) + ' · ' + f(s2, 1) + '² = ' + f(t2, 2) + ' s. Unterschied: ' + f(t2 - t1, 2) + ' s, das ist das ' + f(t2 / t1, 2) + '-Fache. Dicke Wände kosten viel Zykluszeit.',
        ['Rechne die Kühlzeit für beide Wanddicken einzeln.', 'Quadrat heißt Wanddicke mal Wanddicke.'], ['Setze die alte Wanddicke in die Formel ein.', 'Setze die neue Wanddicke ein.', 'Ziehe den alten Wert vom neuen ab.']), { k: 'cycle', p: { ph: 3 } });
    },
    sg3d: pq(SG3DQ, ['Lies, um welche Stückzahl oder Eigenschaft es geht.', 'Denke an Werkzeug, Schichten und Zeit je Teil.', 'Wähle die Aussage, die zum Verfahren passt.']),
    druck: R => {
      const c = C(), h = c.pick(R, [12, 18, 24, 30, 36]), lh = c.pick(R, [0.1, 0.15, 0.2, 0.3]), ts = c.pick(R, [20, 30, 40, 45, 60]), t = c.printTime(h, lh, ts), n = Math.ceil(h / lh - 1e-9);
      return numQ(MB + 'wird ein Muster-Halter ' + f(h, 0) + ' mm hoch im FDM-Verfahren gedruckt. Die Schichthöhe beträgt ' + f(lh, 2) + ' mm, eine Schicht dauert im Schnitt ' + f(ts, 0) + ' s. Wie lange dauert der Druck in Minuten?', t / 60, 'min', 'Druckzeit', 0.1,
        'Schichten: ' + f(h, 0) + ' mm / ' + f(lh, 2) + ' mm = ' + f(n, 0) + '. Zeit: ' + f(n, 0) + ' · ' + f(ts, 0) + ' s = ' + f(t, 0) + ' s = ' + f(t / 60, 1) + ' min.',
        ['Wie viele Schichten passen in die Höhe?', 'Sekunden durch 60 ergibt Minuten.'], ['Teile die Höhe durch die Schichthöhe.', 'Multipliziere mit der Zeit je Schicht.', 'Rechne Sekunden in Minuten um.']);
    },
    /* Spritzgussgerecht konstruieren */
    rippe: R => {
      const c = C(), s = c.pick(R, [1.5, 2, 2.5, 3, 3.5, 4]), v = c.ribMax(s);
      return im(numQ(MB + 'hat ein Gehäusedeckel eine Wanddicke von ' + f(s, 1) + ' mm. Er bekommt Versteifungsrippen. Wie dick darf eine Rippe am Fuß höchstens sein (Faustregel 0,5 bis 0,7 · Wanddicke)?', v, 'mm', 'Rippendicke höchstens', 0.01,
        'Höchstens 0,7 · ' + f(s, 1) + ' mm = ' + f(v, 2) + ' mm. Mindestens 0,5 · ' + f(s, 1) + ' mm = ' + f(c.ribMin(s), 2) + ' mm. Eine dickere Rippe erzeugt eine Einfallstelle auf der Sichtseite.',
        ['Gefragt ist die obere Grenze der Faustregel.', 'Multipliziere die Wanddicke mit 0,7.'], ['Lies die Wanddicke ab.', 'Nimm den oberen Faktor der Faustregel (0,7).', 'Multipliziere und gib das Ergebnis in mm an.']), { k: 'form', p: { s, t: s * 0.6, a: 1, r: s / 2 }, o: { lab: { t: 't = ?', a: '', r: '' } } });
    },
    ripcheck: R => {
      const c = C(), s = c.pick(R, [2, 2.5, 3, 4]), kind = c.pick(R, ['dick', 'duenn', 'ok']), t = kind === 'dick' ? c.rd(s * c.pick(R, [0.8, 0.9, 1]), 2) : kind === 'duenn' ? c.rd(s * c.pick(R, [0.3, 0.4]), 2) : c.rd(s * c.pick(R, [0.5, 0.6, 0.7]), 2);
      const A = { dick: 'Zu dick: Gefahr einer Einfallstelle auf der Sichtseite', duenn: 'Zu dünn: Die Rippe füllt schlecht und bricht leicht', ok: 'Passt: Die Rippe liegt im Bereich der Faustregel' };
      return im(choiceQ(R, 'Wanddicke ' + f(s, 1) + ' mm, Rippendicke am Fuß ' + f(t, 2) + ' mm. Wie beurteilst du die Rippe (Faustregel 0,5 bis 0,7 · Wanddicke)?', A[kind], Object.keys(A).filter(k => k !== kind).map(k => A[k]),
        'Erlaubt sind ' + f(c.ribMin(s), 2) + ' bis ' + f(c.ribMax(s), 2) + ' mm. Verhältnis ' + f(t, 2) + ' / ' + f(s, 1) + ' = ' + f(t / s, 2) + '. ' + A[kind] + '.',
        ['Rechne die untere und die obere Grenze aus.', 'Liegt die Rippe dazwischen, darunter oder darüber?'], ['Rechne 0,5 · Wanddicke und 0,7 · Wanddicke.', 'Vergleiche die Rippendicke mit beiden Grenzen.', 'Wähle die passende Beurteilung.']), { k: 'form', p: { s, t, a: 1, r: s / 2 }, o: { lab: { a: '', r: '' } } });
    },
    schraeg: R => {
      const c = C(), h = c.pick(R, [20, 30, 40, 50, 60, 80]), a = c.pick(R, [0.5, 1, 1.5, 2]), v = 2 * c.draftOffset(h, a);
      return im(numQ(MB + 'wird ein Becher ' + f(h, 0) + ' mm tief. Die Innenwände bekommen auf beiden Seiten eine Entformungsschräge von ' + f(a, 1) + '°. Um wie viel mm ist der Becher innen oben breiter als unten?', v, 'mm', 'Breitenunterschied', 0.02,
        'Je Seite: ' + f(h, 0) + ' mm · tan ' + f(a, 1) + '° = ' + f(h, 0) + ' · ' + f(Math.tan(a * Math.PI / 180), 4) + ' = ' + f(v / 2, 3) + ' mm. Beide Seiten: 2 · ' + f(v / 2, 3) + ' = ' + f(v, 2) + ' mm.',
        ['Je Seite gilt: Versatz = Tiefe · tan(Winkel).', 'Es gibt zwei Seiten, also mal 2.'], ['Rechne den Versatz einer Seite mit dem Tangens.', 'Verdopple ihn für beide Seiten.', 'Runde auf zwei Nachkommastellen.']), { k: 'form', p: { s: 2, t: 1.2, a, r: 1 }, o: { lab: { s: '', t: '', r: '', a: 'α = ' + f(a, 1) + '° je Seite' } } });
    },
    radius: R => {
      const c = C(), s = c.pick(R, [1.5, 2, 2.5, 3, 4]), ri0 = 0.5 * s, ra = c.outerRadius(ri0, s);
      return im(numQ('Eine Gehäusewand ist ' + f(s, 1) + ' mm dick. Die Innenecke bekommt den Mindestradius nach Faustregel (0,5 · Wanddicke). Wie groß muss der Außenradius sein, damit die Wand in der Ecke gleich dick bleibt?', ra, 'mm', 'Außenradius', 0.01,
        'Innenradius: 0,5 · ' + f(s, 1) + ' = ' + f(ri0, 2) + ' mm. Außenradius = Innenradius + Wanddicke = ' + f(ri0, 2) + ' + ' + f(s, 1) + ' = ' + f(ra, 2) + ' mm. So bleibt die Ecke gleich dick und es entsteht keine Masseanhäufung.',
        ['Rechne zuerst den Innenradius.', 'Außen kommt genau eine Wanddicke dazu.'], ['Rechne den Innenradius: 0,5 mal Wanddicke.', 'Addiere die Wanddicke.', 'Gib den Außenradius in mm an.']), { k: 'form', p: { s, t: s * 0.6, a: 1, r: ri0 }, o: { lab: { t: '', a: '', r: 'innen 0,5 · s, außen ?' } } });
    },
    fehler: pq(FEHLQ, ['Lies, wo und wie der Fehler am Teil aussieht.', 'Überlege, was an dieser Stelle konstruktiv anders ist (dick, scharf, ohne Schräge, Schmelze trifft sich).', 'Wähle die passende Ursache.']),
    hinter: pq(HINTQ, ['Stell dir vor, wie das Werkzeug aufgeht.', 'Prüfe, ob etwas in Öffnungsrichtung festhakt.', 'Wähle die Lösung, die das Entformen möglich macht.']),
    anguss: pq(ANGQ, ['Überlege, wie die Schmelze vom Anguss aus fließt.', 'Denke an dicke Zonen, Bindenähte und Sichtflächen.', 'Wähle die Lage, die alle drei berücksichtigt.']),
    dom: R => {
      const c = C(), d = c.pick(R, [2.5, 3, 3.5, 4, 5]), w = c.domeWall(d);
      return im(numQ(MB + 'wird eine Leiterplatte mit Schrauben ' + f(d, 1) + ' mm direkt in Kunststoffdome geschraubt. Übungsregel: Dom-Außendurchmesser = 2 · d, Kernloch = 0,8 · d. Wie dick ist die Wand des Doms?', w, 'mm', 'Domwand', 0.01,
        'Außendurchmesser: 2 · ' + f(d, 1) + ' = ' + f(c.domeOuter(d), 2) + ' mm. Kernloch: 0,8 · ' + f(d, 1) + ' = ' + f(c.domeHole(d), 2) + ' mm. Wand = (' + f(c.domeOuter(d), 2) + ' − ' + f(c.domeHole(d), 2) + ') / 2 = ' + f(w, 2) + ' mm. Den Dom bindet man mit Rippen an die Wand an, statt ihn massiv zu machen.',
        ['Die Wand ist der halbe Unterschied der beiden Durchmesser.', 'Erst Außendurchmesser und Kernloch ausrechnen.'], ['Rechne den Außendurchmesser: 2 mal d.', 'Rechne das Kernloch: 0,8 mal d.', 'Ziehe ab und teile durch 2.']), { k: 'dom', p: { d }, o: { lab: 'Wand ?' } });
    },
    /* Schwindung und Maße */
    formmass: R => {
      const c = C(), m = c.pick(R, c.MATS), lf = c.pick(R, [40, 60, 80, 100, 120, 150]), lw = c.moldSize(lf, m.s);
      return im(numQ(MB + 'soll ein Deckel aus ' + m.k + ' nach dem Abkühlen ' + f(lf, 0) + ' mm lang sein. Übungswert für die Schwindung: ' + f(m.s, 1) + ' % (bezogen auf das Werkzeugmaß). Wie lang muss das Formnest im Werkzeug sein?', lw, 'mm', 'Werkzeugmaß', 0.02,
        'Werkzeugmaß = Fertigmaß / (1 − S/100) = ' + f(lf, 0) + ' / (1 − ' + f(m.s / 100, 3) + ') = ' + f(lf, 0) + ' / ' + f(1 - m.s / 100, 3) + ' = ' + f(lw, 2) + ' mm. Das Werkzeug ist größer, weil das Teil beim Abkühlen schrumpft.',
        ['Das Werkzeug muss größer sein als das fertige Teil.', 'Teile das Fertigmaß durch (1 minus Schwindung als Dezimalzahl).'], ['Wandle die Schwindung in eine Dezimalzahl um (Prozent durch 100).', 'Rechne 1 minus diese Zahl.', 'Teile das Fertigmaß durch das Ergebnis.']), { k: 'shrink', p: { lw, s: m.s }, o: { lab: { lw: 'Werkzeugmaß ?', lf: 'Fertigmaß ' + f(lf, 0) + ' mm' } } });
    },
    fertig: R => {
      const c = C(), m = c.pick(R, c.MATS), lw = c.pick(R, [50.5, 81, 101.5, 122, 152]), lf = c.partSize(lw, m.s);
      return im(numQ('Ein Formnest für ein Teil aus ' + m.k + ' ist ' + f(lw, 1) + ' mm lang. Übungswert für die Schwindung: ' + f(m.s, 1) + ' %. Wie lang wird das Teil nach dem Abkühlen?', lf, 'mm', 'Fertigmaß', 0.02,
        'Fertigmaß = Werkzeugmaß · (1 − S/100) = ' + f(lw, 1) + ' · ' + f(1 - m.s / 100, 3) + ' = ' + f(lf, 2) + ' mm.',
        ['Das Teil wird kleiner als das Werkzeug.', 'Ziehe die Schwindung in Prozent vom Werkzeugmaß ab.'], ['Rechne 1 minus Schwindung als Dezimalzahl.', 'Multipliziere das Werkzeugmaß damit.', 'Runde auf zwei Nachkommastellen.']), { k: 'shrink', p: { lw, s: m.s }, o: { lab: { lw: 'Werkzeugmaß ' + f(lw, 1) + ' mm', lf: 'Fertigmaß ?' } } });
    },
    sprozent: R => {
      const c = C(), lw = c.pick(R, [80, 100, 120, 150, 200]), s = c.pick(R, [0.5, 0.8, 1.2, 1.5, 2, 2.5]), lf = c.rd(c.partSize(lw, s), 2), v = c.shrinkPct(lw, lf);
      return im(numQ(MB + 'ist ein Formnest ' + f(lw, 0) + ' mm lang. Am abgekühlten Musterteil misst du ' + f(lf, 2) + ' mm. Wie groß ist die Schwindung in Prozent (bezogen auf das Werkzeugmaß)?', v, '%', 'Schwindung', 0.02,
        'S = (Werkzeugmaß − Fertigmaß) / Werkzeugmaß · 100 = (' + f(lw, 0) + ' − ' + f(lf, 2) + ') / ' + f(lw, 0) + ' · 100 = ' + f(v, 2) + ' %.',
        ['Rechne zuerst, um wie viel mm das Teil kürzer ist.', 'Teile durch das Werkzeugmaß und nimm mal 100.'], ['Ziehe das Fertigmaß vom Werkzeugmaß ab.', 'Teile durch das Werkzeugmaß.', 'Multipliziere mit 100.']), { k: 'shrink', p: { lw, s }, o: { lab: { lw: 'Werkzeugmaß ' + f(lw, 0) + ' mm', lf: 'gemessen ' + f(lf, 2) + ' mm', s: '? %' } } });
    },
    streu: R => {
      const c = C(), m = c.pick(R, c.MATS.filter(x => x.smax - x.smin >= 0.3)), lw = c.pick(R, [50, 80, 100, 120, 160]), v = c.shrinkSpread(lw, m.smin, m.smax);
      return im(numQ('Ein Formnest ist ' + f(lw, 0) + ' mm lang. Der Kunststoff ' + m.k + ' schwindet je nach Wanddicke und Verarbeitung zwischen ' + f(m.smin, 1) + ' und ' + f(m.smax, 1) + ' % (Übungswerte). Um wie viel mm kann das fertige Maß dadurch schwanken?', v, 'mm', 'Schwankung', 0.01,
        'Größtes Teil (kleinste Schwindung): ' + f(c.partSize(lw, m.smin), 2) + ' mm. Kleinstes Teil (größte Schwindung): ' + f(c.partSize(lw, m.smax), 2) + ' mm. Schwankung = ' + f(lw, 0) + ' · (' + f(m.smax, 1) + ' − ' + f(m.smin, 1) + ') / 100 = ' + f(v, 2) + ' mm. Deshalb sind enge Toleranzen bei stark schwindenden Kunststoffen teuer.',
        ['Rechne das Fertigmaß einmal mit der kleinsten und einmal mit der größten Schwindung.', 'Der Unterschied ist die Schwankung.'], ['Rechne den Unterschied der Schwindungen in Prozent.', 'Nimm diesen Anteil vom Werkzeugmaß.', 'Gib das Ergebnis in mm an.']), { k: 'shrink', p: { lw, s: (m.smin + m.smax) / 2, smin: m.smin, smax: m.smax }, o: { lab: { lw: 'Werkzeugmaß ' + f(lw, 0) + ' mm', lf: 'Fertigmaß schwankt', s: '' } } });
    },
    verzug: pq(VERZQ, ['Lies, wie sich das Teil verändert hat.', 'Überlege, wo es unterschiedlich schwindet.', 'Wähle die passende Aussage.']),
    toler: pq(TOLQ, ['Denke an die Schwindung und ihre Streuung.', 'Überlege, was das Maß zusätzlich beeinflusst.', 'Wähle die passende Aussage.']),
    wenig: R => {
      const c = C(), a = c.shuffle(R, c.MATS.filter(x => x.struk === 'amorph'))[0], t = c.shuffle(R, c.MATS.filter(x => x.struk === 'teil')).slice(0, 3);
      return choiceQ(R, MB + 'soll ein Gehäuseteil sehr maßhaltig werden. Welcher Kunststoff schwindet nach den Übungswerten am wenigsten?', a.k + ' (' + f(a.smin, 1) + ' bis ' + f(a.smax, 1) + ' %)', t.map(x => x.k + ' (' + f(x.smin, 1) + ' bis ' + f(x.smax, 1) + ' %)'),
        a.k + ' ist amorph und schwindet wenig und gleichmäßig. Die anderen sind teilkristallin und schwinden deutlich mehr.', ['Vergleiche die oberen Werte der Bandbreiten.', 'Amorphe Kunststoffe schwinden wenig.'],
        ['Lies bei jeder Antwort die Bandbreite der Schwindung.', 'Suche die kleinste Bandbreite.', 'Prüfe: Ist der Kunststoff amorph?']);
    },
    /* Verbindungen */
    verbwahl: pq(VERBQ, ['Kläre: Soll die Verbindung lösbar sein, wie oft, und aus welchem Werkstoff sind die Teile?', 'Vergleiche Schnapphaken, Schrauben mit Einsatz, Schweißen und Kleben.', 'Wähle die Verbindung, die alle Bedingungen erfüllt.']),
    dehnung: R => {
      const c = C(), l = c.pick(R, [10, 12, 15, 18, 20]), h = c.pick(R, [1, 1.2, 1.5, 2]), y = c.pick(R, [0.6, 0.8, 1, 1.2, 1.5]), v = c.snapStrain(h, y, l);
      return im(numQ('Ein Schnapphaken ist ' + f(l, 0) + ' mm lang und am Fuß ' + f(h, 1) + ' mm dick (gleichbleibender Rechteckquerschnitt). Der Hinterschnitt beträgt ' + f(y, 1) + ' mm. Wie groß ist die Dehnung am Fuß beim Einrasten? Formel: ε = 1,5 · h · y / l² · 100 %.', v, '%', 'Dehnung', 0.02,
        'ε = 1,5 · ' + f(h, 1) + ' · ' + f(y, 1) + ' / ' + f(l, 0) + '² · 100 % = ' + f(1.5 * h * y, 2) + ' / ' + f(l * l, 0) + ' · 100 % = ' + f(v, 2) + ' %.',
        ['Setze Länge, Dicke und Hinterschnitt in mm ein.', 'Die Länge steht im Quadrat im Nenner.'], ['Multipliziere 1,5 mit Dicke und Hinterschnitt.', 'Teile durch die Länge zum Quadrat.', 'Multipliziere mit 100 für Prozent.']), { k: 'snap', p: { l, h, y } });
    },
    haelt: R => {
      const c = C(), m = c.pick(R, c.MATS.filter(x => ['PP', 'ABS', 'PC', 'POM', 'PA'].includes(x.k))), l = c.pick(R, [10, 12, 15, 20]), h = c.pick(R, [1, 1.5, 2]), y = c.pick(R, [0.8, 1, 1.5, 2]), v = c.snapStrain(h, y, l), ok = v <= m.eps + 1e-9;
      const yes = 'Ja, die Dehnung bleibt unter der zulässigen Dehnung', no = 'Nein, die Dehnung ist größer als zulässig, der Haken kann brechen';
      return im(choiceQ(R, 'Ein Schnapphaken aus ' + m.k + ' (zulässige Dehnung beim einmaligen Fügen ' + f(m.eps, 1) + ' %, Übungswert) ist ' + f(l, 0) + ' mm lang, ' + f(h, 1) + ' mm dick und hat ' + f(y, 1) + ' mm Hinterschnitt. Hält er das Einrasten aus? (ε = 1,5 · h · y / l² · 100 %)', ok ? yes : no, [ok ? no : yes, 'Das lässt sich ohne Fügekraft nicht sagen'],
        'ε = 1,5 · ' + f(h, 1) + ' · ' + f(y, 1) + ' / ' + f(l, 0) + '² · 100 % = ' + f(v, 2) + ' %. Zulässig: ' + f(m.eps, 1) + ' %. ' + (ok ? 'Die Dehnung ist kleiner oder gleich: hält.' : 'Die Dehnung ist zu groß. Abhilfe: Haken länger, dünner oder kleinerer Hinterschnitt.'),
        ['Rechne zuerst die Dehnung aus.', 'Vergleiche sie mit der zulässigen Dehnung des Werkstoffs.'], ['Rechne die Dehnung mit der Formel.', 'Lies die zulässige Dehnung im Text.', 'Vergleiche beide Werte.']), { k: 'snap', p: { l, h, y } });
    },
    maxy: R => {
      const c = C(), m = c.pick(R, c.MATS.filter(x => ['PP', 'ABS', 'PC', 'POM'].includes(x.k))), l = c.pick(R, [12, 15, 18, 20, 25]), h = c.pick(R, [1, 1.2, 1.5, 2]), v = c.snapMaxY(h, l, m.eps);
      return im(numQ('Ein Schnapphaken aus ' + m.k + ' ist ' + f(l, 0) + ' mm lang und ' + f(h, 1) + ' mm dick. Die zulässige Dehnung beträgt ' + f(m.eps, 1) + ' % (Übungswert). Wie groß darf der Hinterschnitt höchstens sein? Formel umgestellt: y = ε/100 · l² / (1,5 · h).', v, 'mm', 'Hinterschnitt höchstens', 0.02,
        'y = ' + f(m.eps / 100, 3) + ' · ' + f(l, 0) + '² / (1,5 · ' + f(h, 1) + ') = ' + f(m.eps / 100 * l * l, 2) + ' / ' + f(1.5 * h, 2) + ' = ' + f(v, 2) + ' mm.',
        ['Wandle die Dehnung von Prozent in eine Dezimalzahl um.', 'Länge zum Quadrat in den Zähler, 1,5 · Dicke in den Nenner.'], ['Teile die zulässige Dehnung durch 100.', 'Multipliziere mit der Länge zum Quadrat.', 'Teile durch 1,5 mal Dicke.']), { k: 'snap', p: { l, h, y: v }, o: { lab: { y: 'y = ?' } } });
    },
    film: pq(FILMQ, ['Lies, was am Scharnier gefragt ist (Aufbau, Werkstoff oder Behandlung).', 'Denke an eine Verschlusskappe mit Klappdeckel.', 'Wähle die passende Aussage.']),
    fuegen: pq(FUEGQ, ['Kläre, ob die Werkstoffe schmelzen können.', 'Vergleiche Schweißen und Kleben.', 'Wähle die passende Aussage.']),
    /* Kosten */
    stueck: R => {
      const c = C(), w = c.pick(R, [12000, 15000, 18000, 24000, 30000]), k = c.pick(R, [0.4, 0.55, 0.8, 1.2]), n = c.pick(R, [2000, 5000, 10000, 20000]), v = c.unitCost(w, k, n);
      return numQ(MB + 'kostet ein Spritzgießwerkzeug ' + e2(w) + ' €. Ein Teil kostet ohne Werkzeug ' + e2(k) + ' € (Material und Maschinenzeit, Übungswerte). Es werden ' + f(n, 0) + ' Teile gefertigt. Wie hoch sind die Kosten je Teil mit Werkzeuganteil?', v, '€', 'Kosten je Teil', 0.01,
        'Werkzeuganteil: ' + e2(w) + ' € / ' + f(n, 0) + ' = ' + e2(w / n) + ' €. Kosten je Teil: ' + e2(w / n) + ' € + ' + e2(k) + ' € = ' + e2(v) + ' €.',
        ['Verteile das Werkzeug auf alle Teile.', 'Dazu kommen die Stückkosten.'], ['Teile die Werkzeugkosten durch die Stückzahl.', 'Addiere die Stückkosten.', 'Runde auf Cent.']);
    },
    vergl: R => {
      const c = C(), w = c.pick(R, [10000, 15000, 20000]), k = c.pick(R, [0.5, 0.8, 1]), k3 = c.pick(R, [6, 7.5, 9, 12]), n = c.pick(R, [1000, 3000, 5000, 8000]), dd = c.totalCost(0, k3, n) - c.totalCost(w, k, n), d = Math.abs(dd);
      return im(numQ(MB + 'werden ' + f(n, 0) + ' Halter gebraucht. Spritzgießen: Werkzeug ' + e2(w) + ' €, je Teil ' + e2(k) + ' €. 3D-Druck: kein Werkzeug, je Teil ' + e2(k3) + ' € (Übungswerte). Um wie viel € unterscheiden sich die Gesamtkosten der beiden Verfahren?', d, '€', 'Unterschied', 0.01,
        'Spritzgießen: ' + e2(w) + ' + ' + e2(k) + ' · ' + f(n, 0) + ' = ' + e2(c.totalCost(w, k, n)) + ' €. 3D-Druck: ' + e2(k3) + ' · ' + f(n, 0) + ' = ' + e2(c.totalCost(0, k3, n)) + ' €. Unterschied: ' + e2(d) + ' €. ' + (dd > 0 ? 'Bei dieser Menge ist Spritzgießen billiger.' : 'Bei dieser Menge ist der 3D-Druck billiger.'),
        ['Rechne die Gesamtkosten beider Verfahren für die Menge.', 'Ziehe den kleineren vom größeren Wert ab.'], ['Rechne Spritzgießen: Werkzeug plus Stückkosten mal Menge.', 'Rechne 3D-Druck: Stückkosten mal Menge.', 'Ziehe den kleineren Wert vom größeren ab.']), { k: 'cost', p: { w, k, k3, n } });
    },
    breakeven: R => {
      const c = C(), w = c.pick(R, [8000, 12000, 18000, 25000]), k = c.pick(R, [0.5, 0.6, 0.9, 1.2]), k3 = c.pick(R, [5.5, 7, 8.5, 11]), n = c.breakEvenN(w, k, k3);
      return im(numQ(MB + 'kostet ein Werkzeug ' + e2(w) + ' €, ein Spritzgussteil dann ' + e2(k) + ' €. Im 3D-Druck kostet dasselbe Teil ' + e2(k3) + ' € ohne Werkzeug (Übungswerte). Ab welcher Stückzahl ist Spritzgießen billiger?', n, 'Teile', 'Stückzahl', 0.01,
        'Gleichstand: ' + e2(w) + ' + ' + e2(k) + ' · n = ' + e2(k3) + ' · n, also n = ' + e2(w) + ' / (' + e2(k3) + ' − ' + e2(k) + ') = ' + e2(w) + ' / ' + f(k3 - k, 2) + ' = ' + f(c.breakEven(w, k, k3), 2) + '. Ab ' + f(n, 0) + ' Teilen ist Spritzgießen billiger (die nächste ganze Zahl über dem Gleichstand).',
        ['Setze beide Gesamtkosten gleich und stelle nach n um.', 'Das Werkzeug muss durch den Preisvorteil je Teil wieder hereinkommen.'], ['Rechne den Preisvorteil je Teil: 3D-Druck minus Spritzguss.', 'Teile die Werkzeugkosten durch diesen Vorteil.', 'Runde auf die nächste ganze Zahl darüber.']), { k: 'cost', p: { w, k, k3, n: Math.round(c.breakEven(w, k, k3) * 1.3) } });
    },
    maschz: R => {
      const c = C(), n = c.pick(R, [10000, 20000, 48000, 60000]), tz = c.pick(R, [18, 20, 24, 30]), kav = c.pick(R, [1, 2, 4]), v = c.machineHours(n, tz, kav);
      return numQ(MB + 'sollen ' + f(n, 0) + ' Kappen gespritzt werden. Ein Zyklus dauert ' + f(tz, 0) + ' s, das Werkzeug hat ' + f(kav, 0) + ' Kavität' + (kav > 1 ? 'en' : '') + '. Wie viele Stunden läuft die Maschine (ohne Rüsten)?', v, 'h', 'Maschinenzeit', 0.05,
        'Zyklen: ' + f(n, 0) + ' / ' + f(kav, 0) + ' = ' + f(Math.ceil(n / kav), 0) + '. Zeit: ' + f(Math.ceil(n / kav), 0) + ' · ' + f(tz, 0) + ' s = ' + f(Math.ceil(n / kav) * tz, 0) + ' s. Stunden: ' + f(Math.ceil(n / kav) * tz, 0) + ' / 3.600 = ' + e2(v) + ' h.',
        ['Wie viele Zyklen brauchst du für alle Teile?', 'Sekunden durch 3.600 ergibt Stunden.'], ['Teile die Stückzahl durch die Kavitäten.', 'Multipliziere mit der Zykluszeit.', 'Rechne Sekunden in Stunden um.']);
    },
    lohnt: R => {
      const c = C(); let w, k, k3, n, be;
      for (let i = 0; i < 50; i++) { w = c.pick(R, [9000, 14000, 20000]); k = c.pick(R, [0.5, 0.8]); k3 = c.pick(R, [4, 6, 9]); n = c.pick(R, [800, 1500, 2500, 4000, 6000]); be = c.breakEven(w, k, k3); if (Math.abs(n - be) > 150) break; }
      const sg = c.totalCost(w, k, n), dr = c.totalCost(0, k3, n), sgBetter = sg < dr;
      const A = 'Spritzgießen, weil es bei dieser Menge insgesamt billiger ist', B = '3D-Druck, weil es bei dieser Menge insgesamt billiger ist';
      return im(choiceQ(R, MB + 'wird über ' + f(n, 0) + ' Teile entschieden. Spritzgießen: Werkzeug ' + e2(w) + ' €, je Teil ' + e2(k) + ' €. 3D-Druck: je Teil ' + e2(k3) + ' € (Übungswerte). Welches Verfahren wählst du nach den Kosten?', sgBetter ? A : B, [sgBetter ? B : A, 'Beide kosten genau gleich viel'],
        'Spritzgießen: ' + e2(w) + ' + ' + e2(k) + ' · ' + f(n, 0) + ' = ' + e2(sg) + ' €. 3D-Druck: ' + e2(k3) + ' · ' + f(n, 0) + ' = ' + e2(dr) + ' €. Gleichstand bei ' + f(be, 0) + ' Teilen. ' + (sgBetter ? 'Die Menge liegt darüber: Spritzgießen.' : 'Die Menge liegt darunter: 3D-Druck.'),
        ['Rechne beide Gesamtkosten.', 'Oder rechne den Gleichstand und vergleiche mit der Menge.'], ['Rechne die Kosten für Spritzgießen.', 'Rechne die Kosten für 3D-Druck.', 'Wähle das billigere Verfahren.']), { k: 'cost', p: { w, k, k3, n } });
    },
    ksenk: pq(KOSTQ, ['Unterscheide einmalige Kosten (Werkzeug) und Kosten je Teil.', 'Überlege, was die Zeit je Teil oder den Werkzeugbau beeinflusst.', 'Wähle die passende Aussage.'])
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    ['Kunststoffe kennen', 1, 'Kunststoffgruppe erkennen', 'gruppe'], ['Kunststoffe kennen', 1, 'Kurzzeichen lesen', 'kurz'], ['Kunststoffe kennen', 2, 'Amorph oder teilkristallin', 'struk'], ['Kunststoffe kennen', 2, 'Werkstoff für den Einsatz', 'einsatz'], ['Kunststoffe kennen', 1, 'Recycling-Kennzeichen', 'rcode'], ['Kunststoffe kennen', 2, 'Eigenschaften vergleichen', 'eig'], ['Kunststoffe kennen', 3, 'Granulat für einen Auftrag', 'masse'],
    ['Urformverfahren', 1, 'Verfahren zuordnen', 'verf'], ['Urformverfahren', 1, 'Ablauf beim Spritzgießen', 'zyklus'], ['Urformverfahren', 2, 'Zykluszeit berechnen', 'zykzeit'], ['Urformverfahren', 2, 'Teile je Stunde', 'tph'], ['Urformverfahren', 3, 'Kühlzeit und Wanddicke', 'kuehl'], ['Urformverfahren', 2, 'Spritzgießen oder 3D-Druck', 'sg3d'], ['Urformverfahren', 2, 'Druckzeit im FDM', 'druck'],
    ['Spritzgussgerecht konstruieren', 1, 'Rippendicke festlegen', 'rippe'], ['Spritzgussgerecht konstruieren', 2, 'Rippe beurteilen', 'ripcheck'], ['Spritzgussgerecht konstruieren', 2, 'Entformungsschräge', 'schraeg'], ['Spritzgussgerecht konstruieren', 2, 'Radius in der Ecke', 'radius'], ['Spritzgussgerecht konstruieren', 2, 'Fehlerbild deuten', 'fehler'], ['Spritzgussgerecht konstruieren', 1, 'Hinterschnitt', 'hinter'], ['Spritzgussgerecht konstruieren', 3, 'Lage des Angusses', 'anguss'], ['Spritzgussgerecht konstruieren', 3, 'Schraubdom auslegen', 'dom'],
    ['Schwindung und Maße', 2, 'Werkzeugmaß berechnen', 'formmass'], ['Schwindung und Maße', 2, 'Fertigmaß berechnen', 'fertig'], ['Schwindung und Maße', 2, 'Schwindung aus der Messung', 'sprozent'], ['Schwindung und Maße', 3, 'Streuung der Schwindung', 'streu'], ['Schwindung und Maße', 1, 'Verzug verstehen', 'verzug'], ['Schwindung und Maße', 2, 'Toleranzen bei Kunststoff', 'toler'], ['Schwindung und Maße', 1, 'Maßhaltiger Werkstoff', 'wenig'],
    ['Verbindungen', 1, 'Verbindung wählen', 'verbwahl'], ['Verbindungen', 2, 'Dehnung am Schnapphaken', 'dehnung'], ['Verbindungen', 3, 'Hält der Schnapphaken', 'haelt'], ['Verbindungen', 3, 'Größter Hinterschnitt', 'maxy'], ['Verbindungen', 1, 'Filmscharnier', 'film'], ['Verbindungen', 2, 'Schweißen oder Kleben', 'fuegen'],
    ['Kosten', 1, 'Kosten je Teil mit Werkzeug', 'stueck'], ['Kosten', 2, 'Gesamtkosten vergleichen', 'vergl'], ['Kosten', 2, 'Gleichstand berechnen', 'breakeven'], ['Kosten', 2, 'Maschinenzeit', 'maschz'], ['Kosten', 3, 'Welches Verfahren lohnt', 'lohnt'], ['Kosten', 1, 'Kosten senken', 'ksenk']
  ];
  const tasks = defs.map((d, i) => ({ id: 'kun' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  function make(t, R) { const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('kun-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Zuordnungs-Sätze für den Reiter Begriffe ---------- */
  const SETS = {
    stoff: { title: 'Kunststoffe', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Gruppen', n: 'Thermoplast', d: 'Lange, nicht vernetzte Ketten; wird beim Erwärmen weich und lässt sich wieder schmelzen und schweißen.', pts: ['Spritzgießen, Extrudieren', 'Recycling durch Einschmelzen'] },
      { g: 'Gruppen', n: 'Duroplast', d: 'Engmaschig vernetzt; nach dem Aushärten hart und nicht mehr schmelzbar.', pts: ['Nicht schweißbar', 'Zum Beispiel Epoxid- oder Phenolharz'] },
      { g: 'Gruppen', n: 'Elastomer', d: 'Weitmaschig vernetzt; gummielastisch, federt nach dem Dehnen zurück.', pts: ['Dichtungen, Puffer', 'Nicht schmelzbar'] },
      { g: 'Aufbau', n: 'amorph', d: 'Die Ketten liegen ungeordnet wie Watte; der Kunststoff kann glasklar sein und schwindet wenig.', pts: ['PC, PMMA, ABS', 'Kleine, gleichmäßige Schwindung'] },
      { g: 'Aufbau', n: 'teilkristallin', d: 'Teile der Ketten liegen geordnet und dicht; der Kunststoff ist milchig und schwindet stärker.', pts: ['PE, PP, PA, POM', 'Gefahr von Verzug'] },
      { g: 'Aufbau', n: 'Recycling-Code', d: 'Zahl im Dreieck mit Kurzzeichen, die zeigt, aus welchem Kunststoff ein Teil besteht.', pts: ['01 PET bis 07 andere', 'Hilft beim sortenreinen Sammeln'] }
    ] },
    verf: { title: 'Verfahren', prompt: 'Welches Verfahren passt?', items: [
      { g: 'Urformen', n: 'Spritzgießen', d: 'Schmelze wird in eine geschlossene Form gespritzt, kühlt ab und wird ausgeworfen; Formteile in großer Stückzahl.', pts: ['Teures Werkzeug', 'Sekunden je Teil'] },
      { g: 'Urformen', n: 'Extrudieren', d: 'Schmelze wird von einer Schnecke durch eine Düse gedrückt; es entsteht ein endloses Profil.', pts: ['Rohre, Platten, Folien', 'Querschnitt bestimmt die Düse'] },
      { g: 'Urformen', n: 'Blasformen', d: 'Ein weicher Schlauch wird in einer Form aufgeblasen; es entstehen Hohlkörper.', pts: ['Flaschen, Kanister', 'Wanddicke schwer zu steuern'] },
      { g: 'Weitere', n: 'Tiefziehen', d: 'Eine erwärmte Platte wird mit Vakuum oder Druck über eine Form gezogen.', pts: ['Becher, Schalen', 'Günstiges Werkzeug'] },
      { g: 'Weitere', n: '3D-Druck (FDM)', d: 'Ein Kunststoffstrang wird geschmolzen und Schicht für Schicht abgelegt.', pts: ['Ohne Werkzeug', 'Quer zu den Schichten schwächer'] },
      { g: 'Weitere', n: 'Kavität', d: 'Formnest im Werkzeug, in dem ein Teil entsteht.', pts: ['Mehrfachwerkzeug: mehrere Kavitäten', 'Mehr Teile je Zyklus'] }
    ] },
    gest: { title: 'Gestalten', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Regeln', n: 'Gleichmäßige Wanddicke', d: 'Alle Wände etwa gleich dick, damit das Teil überall gleich abkühlt und schwindet.', pts: ['Übungsbereich 1 bis 4 mm', 'Weniger Verzug'] },
      { g: 'Regeln', n: 'Rippe', d: 'Dünner Steg, der eine Wand versteift, statt die Wand dicker zu machen.', pts: ['0,5 bis 0,7 · Wanddicke', 'Zu dick: Einfallstelle'] },
      { g: 'Regeln', n: 'Entformungsschräge', d: 'Kleine Neigung der Wände in Öffnungsrichtung, damit das Teil leicht aus der Form geht.', pts: ['Übungswert mindestens 0,5°', 'Narbung braucht mehr'] },
      { g: 'Regeln', n: 'Schraubdom', d: 'Rohrförmiger Ansatz, in den eine Schraube gedreht wird.', pts: ['Mit Rippen an die Wand anbinden', 'Nicht massiv'] },
      { g: 'Fehler', n: 'Einfallstelle', d: 'Flache Mulde auf der Oberfläche über einer Masseanhäufung, zum Beispiel gegenüber einer zu dicken Rippe.', pts: ['Rippe dünner', 'Mehr Nachdruck'] },
      { g: 'Fehler', n: 'Bindenaht', d: 'Linie, an der zwei Schmelzefronten zusammentreffen, zum Beispiel hinter einem Loch.', pts: ['Sichtbar und schwächer', 'Angusslage verschiebt sie'] },
      { g: 'Fehler', n: 'Hinterschnitt', d: 'Form, die in Öffnungsrichtung festhakt und einen Schieber braucht.', pts: ['Möglichst vermeiden', 'Schieber machen das Werkzeug teuer'] },
      { g: 'Fehler', n: 'Kerbwirkung', d: 'Spannungsspitze an einer scharfen Ecke, an der das Teil zuerst reißt.', pts: ['Innenradius mindestens 0,5 · Wanddicke', 'Außenradius = Innenradius + Wanddicke'] }
    ] },
    mass: { title: 'Schwindung', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Begriffe', n: 'Schwindung', d: 'Das Teil wird beim Abkühlen kleiner als das Formnest; Angabe in Prozent vom Werkzeugmaß.', pts: ['S = (L_W − L_F) / L_W · 100 %', 'Je Werkstoff verschieden'] },
      { g: 'Begriffe', n: 'Werkzeugmaß', d: 'Maß des Formnests im Werkzeug; größer als das fertige Teil.', pts: ['L_W = L_F / (1 − S/100)', 'Wird vom Werkzeugbau gefertigt'] },
      { g: 'Begriffe', n: 'Fertigmaß', d: 'Maß des abgekühlten Teils, das in der Zeichnung steht.', pts: ['L_F = L_W · (1 − S/100)', 'Nach dem Abkühlen gemessen'] },
      { g: 'Begriffe', n: 'Verzug', d: 'Formänderung des ganzen Teils durch ungleichmäßige Schwindung.', pts: ['Gleichmäßige Wanddicke hilft', 'Fasern verstärken ihn oft'] },
      { g: 'Begriffe', n: 'Nachdruck', d: 'Druck nach dem Füllen, der Schmelze nachschiebt und die Schwindung im Formnest ausgleicht.', pts: ['Gegen Einfallstellen', 'Wirkt nur, solange der Anguss offen ist'] }
    ] },
    verb: { title: 'Verbindungen', prompt: 'Welche Verbindung passt?', items: [
      { g: 'Lösbar', n: 'Schnapphaken', d: 'Federnder Haken, der beim Fügen ausweicht und hinter einer Kante einrastet.', pts: ['Dehnung = 1,5 · h · y / l²', 'Wird mitgespritzt'] },
      { g: 'Lösbar', n: 'Gewindeeinsatz', d: 'Metallbuchse mit Innengewinde, eingespritzt oder warm in den Kunststoff gesetzt.', pts: ['Für häufiges Schrauben', 'Meist aus Messing'] },
      { g: 'Lösbar', n: 'Filmscharnier', d: 'Sehr dünne, angespritzte Stelle, die sich oft biegen lässt.', pts: ['Meist aus PP', 'Nach dem Entformen einige Male biegen'] },
      { g: 'Fest', n: 'Ultraschallschweißen', d: 'Schwingungen schmelzen die Fügeflächen von zwei Thermoplast-Teilen in Sekunden auf.', pts: ['Nur Thermoplaste', 'Energierichtungsgeber an der Naht'] },
      { g: 'Fest', n: 'Kleben', d: 'Ein Klebstoff verbindet die Flächen, auch zwischen verschiedenen Werkstoffen.', pts: ['PE und PP vorbehandeln', 'Aushärtezeit beachten'] }
    ] },
    kost: { title: 'Kosten', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Begriffe', n: 'Werkzeugkosten', d: 'Einmaliger Betrag für die Spritzgießform, der auf alle Teile verteilt wird.', pts: ['Je mehr Teile, desto kleiner der Anteil', 'Schieber machen es teurer'] },
      { g: 'Begriffe', n: 'Stückkosten', d: 'Kosten, die für jedes einzelne Teil neu anfallen: Material, Maschinenzeit, Nacharbeit.', pts: ['Beim Spritzgießen klein', 'Beim 3D-Druck groß'] },
      { g: 'Begriffe', n: 'Gleichstand (Break-even)', d: 'Stückzahl, bei der beide Verfahren gleich viel kosten.', pts: ['n = Werkzeug / (k_3D − k_SG)', 'Darüber lohnt das Werkzeug'] },
      { g: 'Begriffe', n: 'Zykluszeit', d: 'Zeit für einen vollständigen Durchlauf von Schließen bis Auswerfen.', pts: ['Kühlzeit ist der größte Anteil', 'Bestimmt die Teile je Stunde'] }
    ] }
  };

  /* ---------- Beispiele (fertig durchgerechnet; die Rechenschritte entstehen im UI aus KUN_CORE) ---------- */
  const examples = [
    { id: 'gest1', tab: 'gest', title: 'Rippe zu dick, Ecke zu scharf', text: 'Ein Deckel mit 2,5 mm Wand hat eine 2,5 mm dicke Rippe, keine Entformungsschräge und scharfe Innenecken. Was meldet die Prüfung?', p: { s: 2.5, t: 2.5, a: 0, r: 0 } },
    { id: 'gest2', tab: 'gest', title: 'Derselbe Deckel, verbessert', text: 'Wand 2,5 mm, Rippe 1,5 mm, 1° Schräge, Innenradius 1,3 mm.', p: { s: 2.5, t: 1.5, a: 1, r: 1.3 } },
    { id: 'verf1', tab: 'verf', title: 'Zykluszeit einer Kappe', text: 'Zeiten je Schritt und ein Werkzeug mit 4 Kavitäten. Wie viele Kappen entstehen in einer Stunde?', p: { schl: 1.5, einspr: 1, nach: 4, kuehl: 12, oeffn: 1.5, ausw: 1, kav: 4 } },
    { id: 'mass1', tab: 'mass', title: 'Werkzeugmaß für PP', text: 'Ein Teil aus PP soll 120 mm lang werden. Wie groß wird das Formnest, und wie stark schwankt das Maß?', p: { mat: 'PP', lf: 120 } },
    { id: 'verb1', tab: 'verb', title: 'Schnapphaken aus ABS', text: 'Haken 15 mm lang, 1,5 mm dick, 1 mm Hinterschnitt. Hält ABS das aus?', p: { mat: 'ABS', l: 15, h: 1.5, y: 1 } },
    { id: 'kost1', tab: 'kost', title: 'Werkzeug oder Drucker', text: 'Werkzeug 18.000,00 €, Spritzgussteil 0,60 €, gedrucktes Teil 8,50 €. Ab wann lohnt das Werkzeug?', p: { w: 18000, k: 0.6, k3: 8.5, n: 3000 } }
  ];

  root.KUN_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sets: SETS };
  root.KUN_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.KUN_DATA, TASKS: root.KUN_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
