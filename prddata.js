'use strict';
/* Tonfunk Produktions-Lab: Daten (Aufgaben-Generatoren, Zuordnungs-Sätze).
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronikfertigung), Produkte frei erfunden.
   window.PRD_DATA  { cats, tasks, gens, make, makeTask, randomQ, sets }
   window.PRD_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'prd', Status in localStorage 'lm4.prd.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id); der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage hat steps ("So gehst du vor"), tips (Stufe 2 = Lösungsweg mit Formel) und expl (Lösungsweg nach dem Prüfen).
   Titel bleiben neutral (verraten weder Ergebnis noch Fachbegriff der Lösung). */
(function (root) {
  const C = () => root.PRD_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Fertigungsarten und Organisationstypen', 'Kapazität und Auslastung', 'Losgröße', 'Durchlaufzeit und Terminplanung', 'Kennzahlen und Bedarfsermittlung', 'Qualität und Lean'];
  const MB = 'Im Modellbetrieb (Elektronikfertigung, Übungswerte): ';

  const numQ = (text, steps, value, unit, label, tol, expl, tips) => ({ text, steps, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, steps, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, steps, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  /* Pool-Frage: arg = Liste erlaubter Einträge (feste Aufgabe) */
  const pq = (POOL, steps) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], steps, q[1], q[2], q[3], q[4]); };

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  const FA = ['Einzelfertigung', 'Serienfertigung', 'Sortenfertigung', 'Massenfertigung'];
  const faE = [
    ['Der Modellbetrieb baut für einen Kunden genau einen Prüfstand nach dessen Zeichnung. Ein zweiter gleicher Prüfstand ist nicht geplant.', 0, 'Ein Stück nach Kundenwunsch, keine Wiederholung: Einzelfertigung.'],
    ['Die Steuerplatine SP-10 wird in Losen von 800 Stück gefertigt. Danach wird die Linie für das Funkmodul FM-2 umgerüstet.', 1, 'Eine begrenzte Menge (Los) eines Produkts, danach Umrüsten auf ein anderes Produkt: Serienfertigung.'],
    ['Aus demselben Kabelmaterial entstehen Anschlusskabel in fünf Längen und drei Farben. Zwischen den Varianten wird nur wenig umgestellt.', 2, 'Varianten eines Grundprodukts aus demselben Ausgangsstoff mit kleinen Unterschieden: Sortenfertigung.'],
    ['Ein Standard-Widerstandsnetzwerk wird über Jahre ohne Unterbrechung in sehr großer Menge gefertigt. Ein Ende der Fertigung ist nicht geplant.', 3, 'Ein gleiches Produkt in sehr großer Menge ohne geplantes Ende: Massenfertigung.'],
    ['Für einen Kunden wird ein Sonderschaltschrank nach Maß geplant, gebaut und geprüft. Es bleibt bei diesem einen Schrank.', 0, 'Ein einziges Stück nach Kundenauftrag: Einzelfertigung.'],
    ['Das Ladegerät LG-5 läuft in einer Auflage von 2.000 Stück. Im nächsten Quartal folgt eine neue Auflage mit geändertem Gehäuse.', 1, 'Begrenzte Auflage, danach ein geändertes Produkt: Serienfertigung.']
  ];
  const ORG = ['Werkstattfertigung', 'Fließfertigung', 'Gruppenfertigung', 'Baustellenfertigung'];
  const orgE = [
    ['Alle Bohrmaschinen stehen in einem Raum, alle Lötplätze in einem anderen. Jeder Auftrag wandert je nach Bedarf zwischen den Räumen.', 0, 'Gleichartige Maschinen sind in einer Werkstatt zusammengefasst, der Auftrag wandert zu ihnen: Werkstattfertigung.'],
    ['Die Arbeitsplätze stehen in der Reihenfolge der Arbeitsgänge. Ein Band bringt jede Platine im festen Takt zum nächsten Platz.', 1, 'Anordnung nach der Arbeitsfolge mit festem Takt: Fließfertigung (hier Fließbandfertigung).'],
    ['Ein Team aus fünf Leuten fertigt an einer Insel mit Bestück-, Löt- und Prüfplatz ein ganzes Funkmodul und teilt die Arbeit selbst ein.', 2, 'Eine Gruppe fertigt ein ganzes Teil an einer Insel und plant selbst: Gruppenfertigung (Fertigungsinsel).'],
    ['Eine große Schaltanlage wird beim Kunden im Gebäude aufgebaut. Werkzeuge, Material und Leute kommen zum Produkt.', 3, 'Das Produkt steht fest, alles andere kommt zu ihm: Baustellenfertigung.'],
    ['Ein Prüfstand nach Kundenwunsch läuft durch Dreherei, Blechbearbeitung und Elektrowerkstatt, je nachdem, was gerade gebraucht wird.', 0, 'Der Auftrag wandert zwischen Werkstätten mit gleichartigen Maschinen: Werkstattfertigung.'],
    ['Netzteile in großer Stückzahl: Jeder Arbeitsplatz macht nur einen kurzen Handgriff, die Weitergabe läuft im festen Takt.', 1, 'Arbeitsplätze nach der Arbeitsfolge, kurzer Takt: Fließfertigung.']
  ];
  const faQ = (R, arg) => { const e = faE[(arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, faE.length - 1)]; return choiceQ(R, MB + e[0] + ' Welche Fertigungsart liegt vor?', ['Lies den Fall und markiere, wie viele gleiche Stücke entstehen.', 'Frage dich: ein Stück, ein begrenztes Los, Varianten aus gleichem Stoff oder eine Menge ohne Ende?', 'Wähle die Fertigungsart, die dazu passt.'], FA[e[1]], FA.filter((_, i) => i !== e[1]), e[2], ['Die Fertigungsart sagt, wie oft ein gleiches Produkt gefertigt wird.', 'Einzel = 1 Stück, Serie = begrenztes Los, Sorte = Varianten aus gleichem Stoff, Masse = sehr große Menge ohne Ende.']); };
  const orgQ = (R, arg) => { const e = orgE[(arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, orgE.length - 1)]; return choiceQ(R, MB + e[0] + ' Welcher Organisationstyp der Fertigung liegt vor?', ['Lies, wie die Arbeitsplätze angeordnet sind.', 'Frage dich: Wandert der Auftrag zu gleichartigen Maschinen, laufen die Plätze in Arbeitsfolge, arbeitet eine Gruppe an einer Insel oder kommt alles zum festen Produkt?', 'Wähle den passenden Organisationstyp.'], ORG[e[1]], ORG.filter((_, i) => i !== e[1]), e[2], ['Der Organisationstyp sagt, wie Maschinen und Arbeitsplätze angeordnet sind.', 'Werkstatt = gleiche Maschinen zusammen, Fließ = Reihenfolge der Arbeitsgänge, Gruppe = Insel mit Team, Baustelle = Produkt steht fest.']); };
  const VOR = [
    ['Welcher Vorteil ist typisch für die Fließfertigung?', 'Kurze Durchlaufzeiten und niedrige Stückkosten bei großen, gleichartigen Mengen', ['Sehr beweglich bei vielen Einzelaufträgen mit wechselnder Arbeitsfolge', 'Kaum Planung nötig, weil jeder Auftrag anders läuft', 'Fällt eine Station aus, laufen die anderen ungestört weiter'], 'Die Fließfertigung ist auf große Mengen eines Produkts ausgelegt: kurze Wege, feste Takte, niedrige Stückkosten. Dafür ist sie starr und störanfällig.', ['Für welche Mengen wird ein Band gebaut?', 'Feste Reihenfolge, kurze Wege, fester Takt.']],
    ['Welcher Nachteil ist typisch für die Werkstattfertigung?', 'Lange Transportwege und Liegezeiten, deshalb lange Durchlaufzeiten', ['Werkstätten eignen sich nur für die Massenfertigung', 'Ein Ausfall einer Station legt sofort die ganze Linie still', 'Die Arbeit ist sehr eintönig, weil jeder nur einen Handgriff macht'], 'In der Werkstattfertigung wandert der Auftrag zwischen den Werkstätten. Er wartet oft auf freie Maschinen, die Durchlaufzeit wird lang. Dafür ist sie sehr beweglich.', ['Was passiert mit einem Auftrag zwischen zwei Werkstätten?', 'Wege und Wartezeiten.']],
    ['Welcher Vorteil wird der Gruppenfertigung zugeschrieben?', 'Mehr Abwechslung und Verantwortung für die Beschäftigten, kürzere Wege als in der Werkstattfertigung', ['Es werden weder Platz noch Maschinen gebraucht', 'Höchste Stückzahlen bei kleinstem Personalbedarf', 'In der Gruppe ist keine Abstimmung nötig'], 'Die Gruppe fertigt ein ganzes Teil, wechselt die Aufgaben und plant selbst. Das stärkt Verantwortung und Abwechslung, die Wege sind kurz.', ['Was macht eine Gruppe an einer Fertigungsinsel anders als ein Bandarbeiter?', 'Ganzes Teil, Aufgaben wechseln, selbst planen.']],
    ['Warum passt die Fließfertigung schlecht zur Einzelfertigung?', 'Die Anlage lohnt sich erst bei großen, gleichartigen Mengen. Für ein einzelnes Stück ist sie zu teuer und zu starr.', ['Weil Einzelstücke nicht geprüft werden müssen', 'Weil bei der Fließfertigung keine Maschinen eingesetzt werden', 'Weil Einzelstücke immer auf der Baustelle entstehen müssen'], 'Ein Band mit festem Takt kostet viel und lässt sich nur mit Aufwand umstellen. Bei einem Einzelstück verteilen sich diese Kosten auf nur ein Stück.', ['Auf wie viele Stücke verteilen sich die Kosten der Anlage?', 'Starr und teuer gegen Einzelstück.']],
    ['Welche Kombination aus Fertigungsart und Organisationstyp passt am besten?', 'Massenfertigung und Fließfertigung', ['Einzelfertigung und Fließfertigung', 'Massenfertigung und Baustellenfertigung', 'Sortenfertigung und Baustellenfertigung'], 'Sehr große Mengen eines Produkts laufen am günstigsten im festen Takt am Band. Einzelstücke passen eher zur Werkstatt- oder Baustellenfertigung.', ['Welcher Organisationstyp braucht große, gleiche Mengen?', 'Masse und Band gehören zusammen.']]
  ];
  const KAPQ = [
    ['Der Beschäftigungsgrad steigt von 60 % auf 90 %. Was passiert mit den fixen Kosten je Stück?', 'Die fixen Kosten je Stück sinken, weil sich die gleichen fixen Kosten auf mehr Stück verteilen', ['Die fixen Kosten je Stück steigen, weil mehr gefertigt wird', 'Die fixen Kosten je Stück bleiben gleich', 'Die fixen Kosten fallen ganz weg'], 'Fixe Kosten (z. B. Miete, Abschreibung) bleiben im Monat gleich. Werden mehr Stück gefertigt, entfällt auf jedes Stück weniger davon (Fixkostendegression).', ['Ändert sich die Miete, wenn mehr gefertigt wird?', 'Gleicher Betrag geteilt durch mehr Stück.']],
    ['Eine Linie hat drei Stationen. Die mittlere Station ist zu 104 % ausgelastet, die anderen zu 70 % und 80 %. Was gilt?', 'Die mittlere Station ist der Engpass, sie begrenzt die Menge der ganzen Linie', ['Die erste Station ist der Engpass, weil dort alles beginnt', 'Es gibt keinen Engpass, weil der Durchschnitt unter 100 % liegt', 'Die Station mit 70 % ist der Engpass'], 'Der Engpass ist die Stelle mit der höchsten Auslastung. Mehr als sie schafft, kann die Linie nicht liefern, auch wenn die anderen Stationen Luft haben.', ['Welche Station schafft am wenigsten?', 'Höchste Auslastung = Engpass.']],
    ['Der Kapazitätsbedarf im nächsten Monat liegt 15 % über dem Angebot. Welche Maßnahme hilft kurzfristig?', 'Überstunden oder eine Zusatzschicht einplanen bzw. einen Teil fremd fertigen lassen', ['Maschinen verkaufen', 'Die Rüstzeiten verlängern', 'Gar nichts tun, die Aufträge erledigen sich selbst'], 'Bei Überlast erhöht man kurzfristig das Angebot (Überstunden, Zusatzschicht, Fremdvergabe) oder verschiebt Aufträge nach Absprache.', ['Mehr Stunden oder weniger Bedarf?', 'Kurzfristig: Zeit dazukaufen oder auslagern.']],
    ['Eine Abteilung ist nur zu 55 % ausgelastet. Welche Maßnahme passt?', 'Aufträge vorziehen, Personal in andere Abteilungen umsetzen oder Wartung einplanen', ['Eine Zusatzschicht einführen', 'Neue Maschinen kaufen', 'Überstunden anordnen'], 'Bei Unterauslastung sucht man Arbeit für freie Kapazität (Aufträge vorziehen, Lager auffüllen, Wartung) oder setzt Personal um.', ['Ist zu viel oder zu wenig Arbeit da?', 'Freie Kapazität sinnvoll nutzen.']]
  ];
  const LOSQ = [
    ['Der Modellbetrieb fertigt größere Lose. Wie wirkt sich das aus?', 'Die Rüstkosten im Jahr sinken, die Lagerkosten im Jahr steigen', ['Rüst- und Lagerkosten sinken beide', 'Die Rüstkosten steigen, die Lagerkosten sinken', 'Beide Kosten bleiben gleich'], 'Größere Lose heißen weniger Lose im Jahr, also seltener rüsten. Dafür liegt im Schnitt mehr Ware im Lager (x / 2), die Lagerkosten steigen.', ['Wie oft muss bei großen Losen gerüstet werden?', 'Durchschnittlicher Lagerbestand = Losgröße / 2.']],
    ['Was zeichnet die optimale Losgröße aus?', 'Die Summe aus Rüst- und Lagerkosten im Jahr ist am kleinsten', ['Die Rüstkosten sind null', 'Das Lager ist immer leer', 'Es wird nur ein Los im Jahr gefertigt'], 'Rüstkosten fallen mit wachsender Losgröße, Lagerkosten steigen. Wo die Summe am kleinsten ist, liegt die optimale Losgröße. Nach der Andler-Formel sind dort beide Kostenarten gleich hoch.', ['Welche Kosten werden zusammengezählt?', 'Tiefster Punkt der Gesamtkostenkurve.']],
    ['Welche Kosten gehören zu den Rüstkosten eines Loses?', 'Lohn für das Umstellen der Maschine, Probeteile und Stillstand während des Umrüstens', ['Zinsen für das im Lager gebundene Kapital', 'Miete für den Lagerplatz', 'Versicherung der Lagerbestände'], 'Rüstkosten entstehen einmal je Los beim Umstellen. Zinsen, Miete und Versicherung des Lagers sind Lagerkosten.', ['Was passiert genau einmal je Los?', 'Umstellen der Maschine.']],
    ['Warum ist eine sehr große Losgröße riskant?', 'Viel Kapital ist im Lager gebunden, Ware kann veralten, wenn sich die Nachfrage ändert', ['Weil dann öfter gerüstet werden muss', 'Weil die Rüstkosten je Los steigen', 'Weil große Lose nicht gelagert werden dürfen'], 'Große Lose sparen Rüstkosten, binden aber Kapital und Platz. Ändert sich die Nachfrage oder das Produkt, bleibt Ware liegen.', ['Was liegt bei großen Losen lange im Lager?', 'Kapitalbindung und Veralten.']]
  ];
  const TERQ = [
    ['Welcher Anteil der Durchlaufzeit ist in der Werkstattfertigung meist am größten?', 'Die Übergangszeit (Liegen und Transport)', ['Die Rüstzeit', 'Die Bearbeitungszeit', 'Die Prüfzeit beim Kunden'], 'Aufträge warten in der Werkstattfertigung oft lange vor den Maschinen. Die Liegezeit ist deshalb meist der größte Teil der Durchlaufzeit, hier liegt das größte Einsparpotenzial.', ['Was passiert mit einem Auftrag, während eine Maschine noch belegt ist?', 'Warten und Transport.']],
    ['Wann wendet man die Rückwärtsterminierung an?', 'Wenn der Liefertermin feststeht und der spätestmögliche Beginn gesucht wird', ['Wenn der Beginn feststeht und das früheste Ende gesucht wird', 'Wenn es keinen Liefertermin gibt', 'Nur bei Einzelfertigung auf der Baustelle'], 'Rückwärts rechnet man vom Liefertermin zum Beginn: So spät wie möglich anfangen, damit wenig Ware vorher im Lager liegt. Vorwärts rechnet man vom Beginn zum frühesten Ende.', ['Von welchem Termin aus wird gerechnet?', 'Rückwärts = vom Ende her.']],
    ['Was zeigt ein Balkendiagramm (Gantt-Diagramm) in der Terminplanung?', 'Für jeden Arbeitsgang einen Balken auf der Zeitachse von Beginn bis Ende', ['Die Kosten jedes Arbeitsgangs in Euro', 'Die Lagerbestände am Monatsende', 'Den Gewinn des Auftrags'], 'Jeder Arbeitsgang ist ein Balken: links Beginn, rechts Ende. So sieht man Reihenfolge, Dauer und Lücken auf einen Blick.', ['Was steht auf der waagrechten Achse?', 'Zeit, Beginn und Ende.']],
    ['Die Vorwärtsterminierung ergibt ein Ende nach dem Liefertermin. Was bedeutet das?', 'Der Termin ist so nicht zu halten. Man muss Zeiten verkürzen (z. B. Liegezeiten, Überstunden, Lose teilen) oder den Termin neu abstimmen.', ['Alles ist in Ordnung, es gibt genug Puffer', 'Der Auftrag kann später beginnen', 'Die Rüstzeiten werden automatisch null'], 'Ein negativer Puffer heißt: Selbst bei frühestem Beginn wird der Auftrag zu spät fertig. Dann müssen Zeiten verkürzt oder der Termin verschoben werden.', ['Ist der Puffer positiv oder negativ?', 'Frühestes Ende später als der Liefertermin.']]
  ];
  const KZQ = [
    ['Welche Kennzahl setzt eine Menge an Ausbringung ins Verhältnis zu einer Menge an Einsatz, z. B. Stück je Arbeitsstunde?', 'Produktivität', ['Wirtschaftlichkeit', 'Rentabilität', 'Beschäftigungsgrad'], 'Die Produktivität ist ein Mengenverhältnis: Ausbringung durch Einsatz, z. B. Stück je Stunde. Die Wirtschaftlichkeit vergleicht Werte (Euro), die Rentabilität Gewinn mit Kapital oder Umsatz.', ['Stehen Euro oder Mengen im Bruch?', 'Mengen durch Mengen.']],
    ['Welche Kennzahl vergleicht Ertrag (Leistung) in Euro mit dem Aufwand (Kosten) in Euro?', 'Wirtschaftlichkeit', ['Produktivität', 'Eigenkapitalrentabilität', 'Ausschussquote'], 'Wirtschaftlichkeit = Ertrag / Aufwand. Ist sie größer als 1, wird wirtschaftlich gearbeitet.', ['Beide Größen in Euro.', 'Ertrag durch Kosten.']],
    ['Welche Stückliste zeigt den Aufbau eines Erzeugnisses Stufe für Stufe (Baugruppen und ihre Teile)?', 'Strukturstückliste', ['Mengenübersichtsstückliste', 'Lieferschein', 'Arbeitsplan'], 'Die Strukturstückliste zeigt die Stufen (Erzeugnis, Baugruppe, Teil). Die Mengenübersichtsstückliste fasst nur zusammen, wie viele Teile je Erzeugnis gebraucht werden.', ['Sind die Stufen sichtbar?', 'Struktur = Aufbau.']],
    ['Was beschreibt der Arbeitsplan eines Erzeugnisses?', 'Die Reihenfolge der Arbeitsgänge mit Arbeitsplatz, Rüstzeit und Stückzeit', ['Welche Teile in welcher Menge gebraucht werden', 'Wer der Kunde ist', 'Wie hoch der Gewinn ist'], 'Die Stückliste sagt WAS gebraucht wird, der Arbeitsplan WIE und WO gefertigt wird (Arbeitsgänge, Zeiten, Maschinen).', ['Stückliste oder Arbeitsplan: was gegen wie.', 'Arbeitsgänge mit Zeiten.']]
  ];
  const LEANQ = [
    ['Am Lötplatz ist ein Behälter mit Bauteilen leer. Die Karte am Behälter geht zurück an den Lieferplatz, der genau diesen Behälter wieder füllt. Wie heißt das Verfahren?', 'Kanban', ['Just in Time mit Lieferplan', 'Rückwärtsterminierung', 'Werkstattfertigung'], 'Bei Kanban löst der Verbrauch den Nachschub aus (Holprinzip, Pull). Die Karte ist der Auftrag zum Nachfüllen.', ['Wer löst den Nachschub aus: der Plan oder der Verbrauch?', 'Japanisch für Karte.']],
    ['Was ist der Grundgedanke von Just in Time (JIT)?', 'Material kommt genau dann in der benötigten Menge, wenn es gebraucht wird, Lagerbestände bleiben klein', ['Möglichst viel auf Vorrat einkaufen, damit nie etwas fehlt', 'Nur einmal im Jahr bestellen', 'Ware erst nach der Auslieferung beim Lieferer bestellen'], 'JIT senkt Bestände und Kapitalbindung. Es braucht zuverlässige Lieferer und gute Planung.', ['Was bedeutet "gerade rechtzeitig"?', 'Kleine Bestände.']],
    ['Welches Risiko hat Just in Time?', 'Fällt eine Lieferung aus (Stau, Streik, Störung beim Lieferer), steht die Fertigung schnell still', ['Die Lagerkosten steigen stark', 'Es wird zu viel Kapital im Lager gebunden', 'Es gibt keine Abhängigkeit von Lieferern'], 'Weil kaum Vorrat da ist, wirkt jede Lieferstörung sofort auf die Fertigung.', ['Wie groß ist der Vorrat bei JIT?', 'Was passiert ohne Puffer?']],
    ['Was bedeutet Kaizen?', 'Ständige Verbesserung in kleinen Schritten durch alle Beschäftigten', ['Einmalige große Umstellung der Fabrik', 'Verlagerung der Fertigung ins Ausland', 'Abschaffen jeder Prüfung'], 'Kaizen heißt: jeden Tag ein wenig besser werden. Ideen kommen von den Menschen am Arbeitsplatz.', ['Groß und einmalig oder klein und ständig?', 'Alle machen mit.']],
    ['Was zählt im Lean-Gedanken zur Verschwendung?', 'Unnötige Bestände, Wartezeiten, unnötige Wege und Nacharbeit', ['Die Montage des Produkts selbst', 'Die Prüfung, die der Kunde verlangt', 'Der Verkauf an den Kunden'], 'Verschwendung ist alles, was Zeit oder Geld kostet, aber für den Kunden keinen Wert schafft: Bestände, Warten, Wege, Fehler.', ['Wofür zahlt der Kunde?', 'Alles ohne Wert für den Kunden.']]
  ];

  /* ---------- Hilfen ---------- */
  /* Losgröße-Zahlen mit glatter optimaler Losgröße */
  function losSet(R) {
    const c = C();
    for (let i = 0; i < 400; i++) {
      const x = c.pick(R, [400, 500, 600, 800, 1000, 1200, 1500, 2000]), p = c.pick(R, [4, 5, 8, 10, 12.5, 16, 20]), z = c.pick(R, [10, 12, 15, 20, 25]), Rk = c.pick(R, [50, 80, 100, 120, 150, 200, 250]);
      const B = x * x * p * z / (200 * Rk);
      if (Number.isInteger(B) && B >= 2000 && B <= 100000 && B % 100 === 0) return { B, R: Rk, p, z, x };
    }
    return { B: 12000, R: 150, p: 8, z: 20, x: 1500 };
  }
  const losTxt = s => 'Jahresbedarf ' + f(s.B, 0) + ' Stück, Rüstkosten ' + f(s.R, 2) + ' € je Los, Herstellkosten ' + f(s.p, 2) + ' € je Stück, Lagerhaltungskostensatz ' + f(s.z, 0) + ' % im Jahr';
  const AGN = ['Bestücken', 'Löten', 'Prüfen', 'Verpacken'];
  function opsSet(R, n) {
    const c = C();
    return AGN.slice(0, n).map(a => ({ n: a, tr: c.pick(R, [0.5, 1, 1.5, 2]), te: c.pick(R, [0.6, 1.2, 1.5, 2.4, 3]), ue: c.pick(R, [2, 4, 6, 8]) }));
  }
  const opsTxt = (ops, m) => 'Menge ' + f(m, 0) + ' Stück. ' + ops.map((o, i) => 'Arbeitsgang ' + (i + 1) + ' ' + o.n + ': Übergangszeit davor ' + f(o.ue, 1) + ' h, Rüstzeit ' + f(o.tr, 1) + ' h, Stückzeit ' + f(o.te, 1) + ' min').join('; ') + '.';
  const opsWeg = (ops, m) => ops.map(o => o.n + ': ' + f(o.ue, 1) + ' + ' + f(o.tr, 1) + ' + ' + f(m, 0) + ' · ' + f(o.te, 1) + ' / 60 = ' + f(o.ue + C().auftragsZeit(m, o.te, o.tr), 2) + ' h').join('; ');

  /* ---------- Generatoren ---------- */
  const G = {
    fa: faQ, org: orgQ,
    vor: pq(VOR, ['Lies die Frage und kläre, um welchen Organisationstyp es geht.', 'Überlege, für welche Mengen und Aufträge er gebaut ist.', 'Streiche Antworten, die zu einem anderen Typ gehören, und wähle.']),
    /* Kapazität */
    kapa: R => {
      const c = C(), m = c.ri(R, 2, 6), tage = c.pick(R, [19, 20, 21, 22]), sch = c.pick(R, [1, 2, 3]), h = sch * 8, k = c.kapAngebot(m, tage, h);
      return numQ(MB + 'Im Bestückungsbereich stehen ' + f(m, 0) + ' gleiche Automaten. Im Monat gibt es ' + f(tage, 0) + ' Arbeitstage, gearbeitet wird in ' + f(sch, 0) + ' Schicht' + (sch > 1 ? 'en' : '') + ' zu je 8 Stunden. Wie groß ist die Kapazität (Kapazitätsangebot) im Monat in Stunden?',
        ['Rechne die Stunden je Tag aus: Schichten · 8 h.', 'Multipliziere mit den Arbeitstagen.', 'Multipliziere mit der Zahl der Automaten.'], k, 'h', 'Kapazität', 0.01,
        'Stunden je Tag: ' + f(sch, 0) + ' · 8 h = ' + f(h, 0) + ' h. Kapazität: ' + f(m, 0) + ' Automaten · ' + f(tage, 0) + ' Tage · ' + f(h, 0) + ' h = ' + f(k, 0) + ' h.', ['Kapazität = Maschinen · Arbeitstage · Stunden je Tag.', 'Lösungsweg: ' + f(m, 0) + ' · ' + f(tage, 0) + ' · (' + f(sch, 0) + ' · 8) h = ?']);
    },
    kapb: R => {
      const c = C(), m = c.pick(R, [400, 600, 750, 900, 1200, 1500]), te = c.pick(R, [1.5, 2, 2.4, 3, 4]), tr = c.pick(R, [1, 1.5, 2, 3]), b = c.kapBedarf(m, te, tr);
      return numQ(MB + 'Ein Auftrag über ' + f(m, 0) + ' Steuerplatinen SP-10 läuft über den Lötautomaten. Die Rüstzeit beträgt ' + f(tr, 1) + ' h, die Stückzeit ' + f(te, 1) + ' min je Platine. Wie groß ist der Kapazitätsbedarf in Stunden?',
        ['Rechne die Bearbeitungszeit: Menge · Stückzeit in Minuten.', 'Teile durch 60, damit du Stunden hast.', 'Zähle die Rüstzeit dazu.'], b, 'h', 'Kapazitätsbedarf', 0.01,
        'Bearbeitung: ' + f(m, 0) + ' · ' + f(te, 1) + ' min = ' + f(m * te, 0) + ' min = ' + f(m * te / 60, 2) + ' h. Kapazitätsbedarf: ' + f(tr, 1) + ' h + ' + f(m * te / 60, 2) + ' h = ' + f(b, 2) + ' h.', ['Achte auf die Einheiten: Stückzeit in Minuten, Rüstzeit in Stunden.', 'Lösungsweg: ' + f(tr, 1) + ' h + ' + f(m, 0) + ' · ' + f(te, 1) + ' min / 60 = ?']);
    },
    grad: R => {
      const c = C(), k = c.pick(R, [320, 400, 480, 640, 800]), ist = Math.round(k * c.pick(R, [0.62, 0.7, 0.78, 0.85, 0.93, 1.06]) / 4) * 4, g = c.beschGrad(ist, k);
      return numQ(MB + 'Die Prüfabteilung hat im Monat eine Kapazität von ' + f(k, 0) + ' Stunden. Die Aufträge brauchen ' + f(ist, 0) + ' Stunden. Wie hoch ist der Beschäftigungsgrad in Prozent?',
        ['Schreibe den benötigten (genutzten) Wert in den Zähler.', 'Schreibe die vorhandene Kapazität in den Nenner.', 'Multipliziere mit 100.'], g, '%', 'Beschäftigungsgrad', 0.05,
        'Beschäftigungsgrad = ' + f(ist, 0) + ' h / ' + f(k, 0) + ' h · 100 = ' + f(g, 2) + ' %.' + (g > 100 ? ' Über 100 % heißt: Überlast, die Kapazität reicht nicht.' : ''), ['Beschäftigungsgrad = genutzte Kapazität / vorhandene Kapazität · 100.', 'Lösungsweg: ' + f(ist, 0) + ' / ' + f(k, 0) + ' · 100 = ?']);
    },
    frei: R => {
      const c = C(), k = c.pick(R, [320, 352, 400, 480]), a = c.ri(R, 60, 120), b = c.ri(R, 50, 110), m = c.pick(R, [300, 500, 600]), te = c.pick(R, [3, 6, 9]), bed = c.kapBedarf(m, te, 2), fr = k - a - b - bed;
      return numQ(MB + 'Die Montage hat im Monat eine Kapazität von ' + f(k, 0) + ' Stunden. Eingeplant sind Auftrag A mit ' + f(a, 0) + ' h und Auftrag B mit ' + f(b, 0) + ' h. Neu kommt Auftrag C: ' + f(m, 0) + ' Stück, Stückzeit ' + f(te, 0) + ' min, Rüstzeit 2 h. Wie viele Stunden bleiben danach frei? (Negativ heißt: es fehlen Stunden.)',
        ['Rechne den Kapazitätsbedarf von Auftrag C in Stunden aus (Rüstzeit + Menge · Stückzeit / 60).', 'Zähle die Bedarfe von A, B und C zusammen.', 'Ziehe die Summe von der Kapazität ab.'], fr, 'h', 'freie Kapazität', 0.01,
        'Auftrag C: 2 h + ' + f(m, 0) + ' · ' + f(te, 0) + ' / 60 h = ' + f(bed, 2) + ' h. Summe: ' + f(a, 0) + ' + ' + f(b, 0) + ' + ' + f(bed, 2) + ' = ' + f(a + b + bed, 2) + ' h. Frei: ' + f(k, 0) + ' − ' + f(a + b + bed, 2) + ' = ' + f(fr, 2) + ' h.', ['Erst Auftrag C in Stunden umrechnen, dann alles abziehen.', 'Lösungsweg: ' + f(k, 0) + ' − ' + f(a, 0) + ' − ' + f(b, 0) + ' − (2 + ' + f(m, 0) + ' · ' + f(te, 0) + ' / 60) = ?']);
    },
    eng: R => {
      const c = C(), st = ['Bestücken', 'Löten', 'Prüfen'], rows = st.map(n => { const ang = c.pick(R, [160, 176, 320, 352]); return { n, angebot: ang, bedarf: Math.round(ang * c.pick(R, [0.55, 0.68, 0.74, 0.81, 0.88, 0.97, 1.08]) ) }; });
      let e = c.engpass(rows); while (rows.filter(r => Math.abs(c.beschGrad(r.bedarf, r.angebot) - e.grad) < 1).length > 1) { rows[0].bedarf += 7; e = c.engpass(rows); }
      return choiceQ(R, MB + 'Für den nächsten Monat ist geplant: ' + rows.map(r => r.n + ': Bedarf ' + f(r.bedarf, 0) + ' h, Kapazität ' + f(r.angebot, 0) + ' h').join('; ') + '. Welche Stelle ist der Engpass?',
        ['Rechne für jede Stelle den Beschäftigungsgrad aus: Bedarf / Kapazität · 100.', 'Vergleiche die drei Prozentwerte.', 'Die Stelle mit dem höchsten Wert ist der Engpass.'], e.n, st.filter(n => n !== e.n).concat(['Keine, alle Stellen haben genug Kapazität']).slice(0, 3),
        rows.map(r => r.n + ': ' + f(r.bedarf, 0) + ' / ' + f(r.angebot, 0) + ' · 100 = ' + f(c.beschGrad(r.bedarf, r.angebot), 1) + ' %').join('; ') + '. Höchster Wert: ' + e.n + ' (' + f(e.grad, 1) + ' %). Nicht der größte Bedarf in Stunden zählt, sondern die Auslastung.', ['Vergleiche nicht die Stunden, sondern die Auslastung in Prozent.', 'Lösungsweg: je Stelle Bedarf / Kapazität · 100, dann den größten Wert suchen.']);
    },
    zus: R => {
      const c = C(), m = c.ri(R, 2, 4), ang = m * 20 * 16, over = c.ri(R, 30, 140), bed = ang + over, per = m * 8, n = Math.ceil(over / per - 1e-9);
      return numQ(MB + 'Die Bestückung hat ' + f(m, 0) + ' Automaten und im Monat eine Kapazität von ' + f(ang, 0) + ' h (20 Tage, 2 Schichten). Der Bedarf liegt bei ' + f(bed, 0) + ' h. Eine Zusatzschicht am Samstag bringt 8 h je Automat. Wie viele Samstagsschichten sind mindestens nötig?',
        ['Rechne die fehlenden Stunden aus: Bedarf − Kapazität.', 'Rechne, wie viele Stunden eine Samstagsschicht bringt: Automaten · 8 h.', 'Teile und runde auf, denn eine halbe Schicht gibt es nicht.'], n, 'Schichten', 'Zusatzschichten', 0.01,
        'Fehlend: ' + f(bed, 0) + ' − ' + f(ang, 0) + ' = ' + f(over, 0) + ' h. Eine Schicht: ' + f(m, 0) + ' · 8 h = ' + f(per, 0) + ' h. ' + f(over, 0) + ' / ' + f(per, 0) + ' = ' + f(over / per, 2) + ', aufgerundet ' + f(n, 0) + ' Schichten.', ['Erst die Lücke in Stunden, dann durch die Stunden je Schicht teilen.', 'Lösungsweg: (' + f(bed, 0) + ' − ' + f(ang, 0) + ') / (' + f(m, 0) + ' · 8), aufrunden.']);
    },
    kapq: pq(KAPQ, ['Lies den Fall und kläre: Überlast, Unterlast oder Engpass?', 'Überlege, was mit Kapazität und Kosten passiert.', 'Wähle die Antwort, die dazu passt.']),
    /* Losgröße */
    ruest: R => {
      const c = C(), s = losSet(R), x = c.pick(R, [s.x / 2, s.x, s.x * 2]), v = c.ruestJahr(s.B, s.R, x);
      return numQ(MB + 'Für das Funkmodul FM-2 gilt: ' + losTxt(s) + '. Gefertigt wird in Losen zu ' + f(x, 0) + ' Stück. Wie hoch sind die Rüstkosten im Jahr?',
        ['Rechne die Zahl der Lose im Jahr: Jahresbedarf / Losgröße.', 'Multipliziere mit den Rüstkosten je Los.'], v, '€', 'Rüstkosten im Jahr', 0.01,
        'Lose im Jahr: ' + f(s.B, 0) + ' / ' + f(x, 0) + ' = ' + f(s.B / x, 2) + '. Rüstkosten: ' + f(s.B / x, 2) + ' · ' + f(s.R, 2) + ' € = ' + f(v, 2) + ' €.', ['Rüstkosten fallen einmal je Los an.', 'Lösungsweg: ' + f(s.B, 0) + ' / ' + f(x, 0) + ' · ' + f(s.R, 2) + ' € = ?']);
    },
    lager: R => {
      const c = C(), s = losSet(R), x = c.pick(R, [s.x / 2, s.x, s.x * 2]), v = c.lagerJahr(x, s.p, s.z);
      return numQ(MB + 'Für das Funkmodul FM-2 gilt: ' + losTxt(s) + '. Gefertigt wird in Losen zu ' + f(x, 0) + ' Stück, der Verbrauch ist gleichmäßig. Wie hoch sind die Lagerkosten im Jahr?',
        ['Rechne den durchschnittlichen Lagerbestand: Losgröße / 2.', 'Rechne seinen Wert: Bestand · Herstellkosten je Stück.', 'Nimm davon den Lagerhaltungskostensatz.'], v, '€', 'Lagerkosten im Jahr', 0.01,
        'Durchschnittlicher Bestand: ' + f(x, 0) + ' / 2 = ' + f(x / 2, 0) + ' Stück. Wert: ' + f(x / 2, 0) + ' · ' + f(s.p, 2) + ' € = ' + f(x / 2 * s.p, 2) + ' €. Lagerkosten: ' + f(x / 2 * s.p, 2) + ' € · ' + f(s.z, 0) + ' % = ' + f(v, 2) + ' €.', ['Im Schnitt liegt nur die halbe Losgröße auf Lager.', 'Lösungsweg: ' + f(x, 0) + ' / 2 · ' + f(s.p, 2) + ' € · ' + f(s.z, 0) + ' / 100 = ?']);
    },
    ges: R => {
      const c = C(), s = losSet(R), x = c.pick(R, [s.x / 2, s.x * 2]), k = c.losKosten(s.B, s.R, s.p, s.z, x);
      return numQ(MB + 'Für den Sensor SM-3 gilt: ' + losTxt(s) + '. Gefertigt wird in Losen zu ' + f(x, 0) + ' Stück. Wie hoch sind die gesamten losabhängigen Kosten (Rüst- plus Lagerkosten) im Jahr?',
        ['Rechne die Rüstkosten im Jahr: Jahresbedarf / Losgröße · Rüstkosten je Los.', 'Rechne die Lagerkosten im Jahr: Losgröße / 2 · Herstellkosten · Lagerhaltungskostensatz.', 'Zähle beide zusammen.'], k.ges, '€', 'Gesamtkosten', 0.01,
        'Rüstkosten: ' + f(s.B, 0) + ' / ' + f(x, 0) + ' · ' + f(s.R, 2) + ' € = ' + f(k.ruest, 2) + ' €. Lagerkosten: ' + f(x / 2, 0) + ' · ' + f(s.p, 2) + ' € · ' + f(s.z, 0) + ' % = ' + f(k.lager, 2) + ' €. Summe: ' + f(k.ges, 2) + ' €.', ['Zwei Kostenarten getrennt rechnen, dann addieren.', 'Lösungsweg: ' + f(s.B, 0) + ' / ' + f(x, 0) + ' · ' + f(s.R, 2) + ' + ' + f(x, 0) + ' / 2 · ' + f(s.p, 2) + ' · ' + f(s.z, 0) + ' / 100 = ?']);
    },
    andl: R => {
      const c = C(), s = losSet(R), x = c.andler(s.B, s.R, s.p, s.z);
      return numQ(MB + 'Für das Ladegerät LG-5 gilt: ' + losTxt(s) + '. Berechne die optimale Losgröße mit der Andler-Formel.',
        ['Schreibe die Formel auf: Wurzel aus (200 · Jahresbedarf · Rüstkosten) / (Herstellkosten · Lagerhaltungskostensatz).', 'Rechne Zähler und Nenner getrennt aus.', 'Teile und ziehe die Wurzel.'], x, 'Stück', 'optimale Losgröße', 0.5,
        'Zähler: 200 · ' + f(s.B, 0) + ' · ' + f(s.R, 2) + ' = ' + f(200 * s.B * s.R, 0) + '. Nenner: ' + f(s.p, 2) + ' · ' + f(s.z, 0) + ' = ' + f(s.p * s.z, 2) + '. Wurzel aus ' + f(200 * s.B * s.R / (s.p * s.z), 0) + ' = ' + f(x, 0) + ' Stück. Bei dieser Losgröße sind Rüst- und Lagerkosten gleich hoch.', ['Die 200 kommt aus 2 · 100 (Prozentsatz).', 'Lösungsweg: Wurzel(200 · ' + f(s.B, 0) + ' · ' + f(s.R, 2) + ' / (' + f(s.p, 2) + ' · ' + f(s.z, 0) + ')) = ?']);
    },
    lose: R => {
      const c = C(), s = losSet(R), x = c.andler(s.B, s.R, s.p, s.z), n = s.B / x;
      return numQ(MB + 'Für das Ladegerät LG-5 gilt: ' + losTxt(s) + '. Wie viele Lose werden im Jahr gefertigt, wenn immer in der optimalen Losgröße nach Andler gefertigt wird?',
        ['Berechne zuerst die optimale Losgröße mit der Andler-Formel.', 'Teile den Jahresbedarf durch diese Losgröße.'], n, 'Lose', 'Lose im Jahr', 0.01,
        'Optimale Losgröße: Wurzel(200 · ' + f(s.B, 0) + ' · ' + f(s.R, 2) + ' / (' + f(s.p, 2) + ' · ' + f(s.z, 0) + ')) = ' + f(x, 0) + ' Stück. Lose: ' + f(s.B, 0) + ' / ' + f(x, 0) + ' = ' + f(n, 2) + '.', ['Zwei Schritte: erst Losgröße, dann Anzahl.', 'Lösungsweg: ' + f(s.B, 0) + ' / Wurzel(200 · ' + f(s.B, 0) + ' · ' + f(s.R, 2) + ' / (' + f(s.p, 2) + ' · ' + f(s.z, 0) + ')) = ?']);
    },
    vergl: R => {
      const c = C(), s = losSet(R), xs = c.shuffle(R, [s.x].concat(c.shuffle(R, [s.x / 4, s.x / 2, s.x * 2]).slice(0, 2))), ks = xs.map(x => c.losKosten(s.B, s.R, s.p, s.z, x).ges), best = xs[ks.indexOf(Math.min.apply(null, ks))];
      return choiceQ(R, MB + 'Für die Steuerplatine SP-10 gilt: ' + losTxt(s) + '. Zur Wahl stehen drei Losgrößen. Welche ist am günstigsten (kleinste Summe aus Rüst- und Lagerkosten)?',
        ['Rechne für jede Losgröße die Rüstkosten im Jahr.', 'Rechne für jede Losgröße die Lagerkosten im Jahr.', 'Bilde jeweils die Summe und wähle die kleinste.'], f(best, 0) + ' Stück', xs.filter(x => x !== best).map(x => f(x, 0) + ' Stück').concat(['Alle drei kosten gleich viel']),
        xs.map((x, i) => f(x, 0) + ' Stück: ' + f(ks[i], 2) + ' €').join('; ') + '. Am günstigsten: ' + f(best, 0) + ' Stück.', ['Gesamtkosten = Rüstkosten + Lagerkosten, für jede Losgröße einzeln.', 'Lösungsweg: je Losgröße x: ' + f(s.B, 0) + ' / x · ' + f(s.R, 2) + ' + x / 2 · ' + f(s.p, 2) + ' · ' + f(s.z, 0) + ' / 100.']);
    },
    losq: pq(LOSQ, ['Lies die Frage und kläre, ob es um Rüst- oder Lagerkosten geht.', 'Überlege, was sich bei größeren oder kleineren Losen ändert.', 'Wähle die passende Antwort.']),
    /* Durchlaufzeit und Termine */
    afz: R => {
      const c = C(), m = c.pick(R, [120, 200, 250, 300, 400]), te = c.pick(R, [0.6, 1.2, 1.5, 2.4, 3]), tr = c.pick(R, [0.5, 1, 1.5]), v = c.auftragsZeit(m, te, tr);
      return numQ(MB + 'Am Prüfplatz werden ' + f(m, 0) + ' Sensormodule SM-3 geprüft. Rüstzeit ' + f(tr, 1) + ' h, Stückzeit ' + f(te, 1) + ' min. Wie lange dauert der Arbeitsgang (Auftragszeit = Rüstzeit + Ausführungszeit) in Stunden?',
        ['Rechne die Ausführungszeit: Menge · Stückzeit in Minuten.', 'Rechne in Stunden um (durch 60).', 'Zähle die Rüstzeit dazu.'], v, 'h', 'Auftragszeit', 0.01,
        'Ausführungszeit: ' + f(m, 0) + ' · ' + f(te, 1) + ' min = ' + f(m * te, 0) + ' min = ' + f(m * te / 60, 2) + ' h. Auftragszeit: ' + f(tr, 1) + ' + ' + f(m * te / 60, 2) + ' = ' + f(v, 2) + ' h.', ['Auftragszeit = Rüstzeit + Menge · Stückzeit.', 'Lösungsweg: ' + f(tr, 1) + ' h + ' + f(m, 0) + ' · ' + f(te, 1) + ' / 60 h = ?']);
    },
    dlz: R => {
      const c = C(), m = c.pick(R, [100, 150, 200, 250]), ops = opsSet(R, 3), d = c.durchlauf(ops, m);
      return numQ(MB + 'Ein Auftrag durchläuft drei Arbeitsgänge. ' + opsTxt(ops, m) + ' Wie lang ist die Durchlaufzeit in Stunden?',
        ['Rechne je Arbeitsgang: Übergangszeit + Rüstzeit + Menge · Stückzeit / 60.', 'Zähle die drei Ergebnisse zusammen.'], d.dlz, 'h', 'Durchlaufzeit', 0.01,
        opsWeg(ops, m) + '. Durchlaufzeit: ' + f(d.dlz, 2) + ' h (davon Übergangszeit ' + f(d.ue, 1) + ' h).', ['Die Durchlaufzeit enthält auch Liegen und Transport.', 'Lösungsweg: Summe über alle Arbeitsgänge von Übergangszeit + Rüstzeit + Menge · Stückzeit / 60.']);
    },
    anteil: R => {
      const c = C(), m = c.pick(R, [100, 150, 200]), ops = opsSet(R, 3), d = c.durchlauf(ops, m);
      return numQ(MB + 'Ein Auftrag durchläuft drei Arbeitsgänge. ' + opsTxt(ops, m) + ' Wie viel Prozent der Durchlaufzeit sind Übergangszeit (Liegen und Transport)?',
        ['Rechne die Durchlaufzeit aus (alle Zeiten aller Arbeitsgänge in Stunden).', 'Zähle die Übergangszeiten zusammen.', 'Teile Übergangszeit durch Durchlaufzeit und multipliziere mit 100.'], d.anteilUe, '%', 'Anteil Übergangszeit', 0.05,
        opsWeg(ops, m) + '. Durchlaufzeit ' + f(d.dlz, 2) + ' h, Übergangszeit ' + f(d.ue, 1) + ' h. Anteil: ' + f(d.ue, 1) + ' / ' + f(d.dlz, 2) + ' · 100 = ' + f(d.anteilUe, 2) + ' %.', ['Erst das Ganze (Durchlaufzeit), dann den Teil (Übergangszeit).', 'Lösungsweg: Übergangszeit / Durchlaufzeit · 100.']);
    },
    vorw: R => {
      const c = C(), m = c.pick(R, [100, 200, 300]), ops = opsSet(R, 3), s = c.pick(R, [0, 8, 16]), v = c.vorwaerts(ops, m, s);
      return numQ(MB + 'Vorwärtsterminierung (Zeiten in Arbeitsstunden ab Planungsbeginn). Der Auftrag kann frühestens in Stunde ' + f(s, 0) + ' beginnen. ' + opsTxt(ops, m) + ' In welcher Stunde ist der Auftrag frühestens fertig?',
        ['Starte beim frühesten Beginn.', 'Zähle je Arbeitsgang Übergangszeit, Rüstzeit und Ausführungszeit dazu.', 'Das Ende des letzten Arbeitsgangs ist der früheste Endtermin.'], v.ende, 'h', 'frühestes Ende', 0.01,
        'Start ' + f(s, 0) + ' h. ' + v.ops.map(o => o.n + ' von ' + f(o.start, 2) + ' bis ' + f(o.ende, 2) + ' h').join('; ') + '. Frühestes Ende: Stunde ' + f(v.ende, 2) + '.', ['Vorwärts heißt: vom Beginn zum Ende rechnen.', 'Lösungsweg: ' + f(s, 0) + ' + Summe aller Zeiten aller Arbeitsgänge = ?']);
    },
    rueck: R => {
      const c = C(), m = c.pick(R, [100, 200, 300]), ops = opsSet(R, 3), d = c.durchlauf(ops, m), T = Math.ceil(d.dlz / 8) * 8 + c.pick(R, [8, 16, 24]), r = c.rueckwaerts(ops, m, T);
      return numQ(MB + 'Rückwärtsterminierung (Zeiten in Arbeitsstunden ab Planungsbeginn). Der Auftrag muss in Stunde ' + f(T, 0) + ' fertig sein. ' + opsTxt(ops, m) + ' In welcher Stunde muss der Auftrag spätestens beginnen (Beginn der ersten Übergangszeit)?',
        ['Starte beim Liefertermin.', 'Ziehe vom letzten Arbeitsgang an rückwärts je Arbeitsgang Ausführungszeit, Rüstzeit und Übergangszeit ab.', 'Was übrig bleibt, ist der späteste Beginn.'], r.start, 'h', 'spätester Beginn', 0.01,
        'Liefertermin ' + f(T, 0) + ' h. ' + r.ops.slice().reverse().map(o => o.n + ' von ' + f(o.start, 2) + ' bis ' + f(o.ende, 2) + ' h').join('; ') + '. Spätester Beginn: ' + f(T, 0) + ' − ' + f(d.dlz, 2) + ' = Stunde ' + f(r.start, 2) + '.', ['Rückwärts heißt: vom Liefertermin zurückrechnen.', 'Lösungsweg: ' + f(T, 0) + ' − Durchlaufzeit = ?']);
    },
    puff: R => {
      const c = C(), m = c.pick(R, [100, 200, 300]), ops = opsSet(R, 3), d = c.durchlauf(ops, m), T = Math.round(d.dlz) + c.pick(R, [-6, 4, 10, 18]), p = c.puffer(T, d.dlz);
      return numQ(MB + 'Der Auftrag beginnt in Stunde 0, der Liefertermin ist Stunde ' + f(T, 0) + '. ' + opsTxt(ops, m) + ' Wie groß ist der Puffer (Zeitreserve) in Stunden? (Negativ heißt: der Termin wird nicht gehalten.)',
        ['Rechne die Durchlaufzeit aus (Vorwärtsterminierung ab Stunde 0).', 'Ziehe das früheste Ende vom Liefertermin ab.'], p, 'h', 'Puffer', 0.01,
        opsWeg(ops, m) + '. Frühestes Ende: ' + f(d.dlz, 2) + ' h. Puffer: ' + f(T, 0) + ' − ' + f(d.dlz, 2) + ' = ' + f(p, 2) + ' h.' + (p < 0 ? ' Der Termin ist so nicht zu halten.' : ''), ['Puffer = Liefertermin − frühestes Ende.', 'Lösungsweg: ' + f(T, 0) + ' − Durchlaufzeit = ?']);
    },
    terq: pq(TERQ, ['Lies die Frage und kläre, ob es um vorwärts, rückwärts oder um die Zeitanteile geht.', 'Denke an den Aufbau der Durchlaufzeit: Übergangszeit, Rüstzeit, Ausführungszeit.', 'Wähle die passende Antwort.']),
    /* Kennzahlen und Bedarf */
    prod: R => {
      const c = C(), h = c.pick(R, [160, 320, 480, 640]), s = h * c.pick(R, [12, 15, 18, 22.5, 25]), v = c.produktivitaet(s, h);
      return numQ(MB + 'In der Montage wurden im Monat ' + f(s, 0) + ' Ladegeräte LG-5 gefertigt. Dafür wurden ' + f(h, 0) + ' Arbeitsstunden gebraucht. Wie hoch ist die Arbeitsproduktivität in Stück je Arbeitsstunde?',
        ['Schreibe die Ausbringung (Stück) in den Zähler.', 'Schreibe den Einsatz (Arbeitsstunden) in den Nenner.', 'Teile die beiden Zahlen.'], v, 'Stück/h', 'Produktivität', 0.01,
        'Produktivität = ' + f(s, 0) + ' Stück / ' + f(h, 0) + ' h = ' + f(v, 2) + ' Stück je Arbeitsstunde.', ['Produktivität = Ausbringungsmenge / Einsatzmenge.', 'Lösungsweg: ' + f(s, 0) + ' / ' + f(h, 0) + ' = ?']);
    },
    wirt: R => {
      const c = C(), k = c.pick(R, [400000, 520000, 640000, 800000]), e = Math.round(k * c.pick(R, [0.92, 1.04, 1.08, 1.15, 1.25]) / 1000) * 1000, v = c.wirtschaftlichkeit(e, k);
      return numQ(MB + 'Im letzten Jahr standen Erträgen (Leistungen) von ' + f(e, 0) + ' € Aufwendungen (Kosten) von ' + f(k, 0) + ' € gegenüber. Wie hoch ist die Wirtschaftlichkeit? (auf zwei Stellen)',
        ['Schreibe den Ertrag in den Zähler.', 'Schreibe den Aufwand in den Nenner.', 'Teile und runde auf zwei Nachkommastellen. Über 1 heißt wirtschaftlich.'], C().rd(v, 2), '', 'Wirtschaftlichkeit', 0.006,
        'Wirtschaftlichkeit = ' + f(e, 0) + ' € / ' + f(k, 0) + ' € = ' + f(v, 2) + '. ' + (v > 1 ? 'Größer als 1: Der Betrieb arbeitet wirtschaftlich.' : 'Kleiner als 1: Die Kosten sind höher als die Erträge.'), ['Wirtschaftlichkeit = Ertrag / Aufwand (ohne Einheit).', 'Lösungsweg: ' + f(e, 0) + ' / ' + f(k, 0) + ' = ?']);
    },
    ekr: R => {
      const c = C(), ek = c.pick(R, [800000, 1200000, 1500000, 2000000]), g = Math.round(ek * c.pick(R, [0.045, 0.06, 0.075, 0.09, 0.12]) / 1000) * 1000, v = c.ekRent(g, ek);
      return numQ(MB + 'Der Modellbetrieb hat ein Eigenkapital von ' + f(ek, 0) + ' € und erzielte einen Gewinn von ' + f(g, 0) + ' €. Wie hoch ist die Eigenkapitalrentabilität in Prozent?',
        ['Schreibe den Gewinn in den Zähler.', 'Schreibe das Eigenkapital in den Nenner.', 'Multipliziere mit 100.'], v, '%', 'Eigenkapitalrentabilität', 0.01,
        'Eigenkapitalrentabilität = ' + f(g, 0) + ' € / ' + f(ek, 0) + ' € · 100 = ' + f(v, 2) + ' %.', ['Rentabilität = Gewinn / Kapital · 100.', 'Lösungsweg: ' + f(g, 0) + ' / ' + f(ek, 0) + ' · 100 = ?']);
    },
    umr: R => {
      const c = C(), u = c.pick(R, [2400000, 3600000, 4800000, 6000000]), g = Math.round(u * c.pick(R, [0.025, 0.04, 0.05, 0.065]) / 1000) * 1000, v = c.umsRent(g, u);
      return numQ(MB + 'Der Modellbetrieb erzielte einen Umsatz von ' + f(u, 0) + ' € und einen Gewinn von ' + f(g, 0) + ' €. Wie hoch ist die Umsatzrentabilität in Prozent?',
        ['Schreibe den Gewinn in den Zähler.', 'Schreibe den Umsatz in den Nenner.', 'Multipliziere mit 100.'], v, '%', 'Umsatzrentabilität', 0.01,
        'Umsatzrentabilität = ' + f(g, 0) + ' € / ' + f(u, 0) + ' € · 100 = ' + f(v, 2) + ' %. Von jedem Euro Umsatz bleiben ' + f(v, 2) + ' Cent Gewinn.', ['Umsatzrentabilität = Gewinn / Umsatz · 100.', 'Lösungsweg: ' + f(g, 0) + ' / ' + f(u, 0) + ' · 100 = ?']);
    },
    brut: R => {
      const c = C(), P = c.pick(R, [250, 400, 500, 750, 1200]), pl = c.pick(R, [1, 2, 3]), k = c.pick(R, [4, 6, 8, 12]), v = P * pl * k;
      return numQ(MB + 'Stückliste des Funkmoduls FM-2: Ein Modul enthält ' + f(pl, 0) + ' Platine' + (pl > 1 ? 'n' : '') + ' P-7. Jede Platine P-7 enthält ' + f(k, 0) + ' Kondensatoren C-22 und 1 Funkchip. Verkauft werden sollen ' + f(P, 0) + ' Module (Primärbedarf). Wie groß ist der Bruttobedarf an Kondensatoren C-22?',
        ['Rechne, wie viele Platinen für alle Module gebraucht werden: Module · Platinen je Modul.', 'Multipliziere mit den Kondensatoren je Platine.'], v, 'Stück', 'Bruttobedarf', 0.01,
        'Platinen: ' + f(P, 0) + ' · ' + f(pl, 0) + ' = ' + f(P * pl, 0) + '. Kondensatoren: ' + f(P * pl, 0) + ' · ' + f(k, 0) + ' = ' + f(v, 0) + ' Stück.', ['Gehe die Stückliste Stufe für Stufe von oben nach unten durch.', 'Lösungsweg: ' + f(P, 0) + ' · ' + f(pl, 0) + ' · ' + f(k, 0) + ' = ?']);
    },
    net: R => {
      const c = C(), br = c.pick(R, [2400, 3000, 4800, 6000]), lg = c.pick(R, [400, 600, 900, 1200]), si = c.pick(R, [200, 300, 500]), of = c.pick(R, [0, 500, 800, 1000]), v = c.netto(br, lg, si, of);
      return numQ(MB + 'Für die Kondensatoren C-22 gilt: Bruttobedarf ' + f(br, 0) + ' Stück, Lagerbestand ' + f(lg, 0) + ' Stück, Sicherheitsbestand ' + f(si, 0) + ' Stück (darf nicht verbraucht werden), offene Bestellungen ' + f(of, 0) + ' Stück. Wie groß ist der Nettobedarf?',
        ['Rechne den verfügbaren Bestand: Lagerbestand − Sicherheitsbestand + offene Bestellungen.', 'Ziehe ihn vom Bruttobedarf ab.', 'Ist das Ergebnis negativ, ist der Nettobedarf 0.'], v, 'Stück', 'Nettobedarf', 0.01,
        'Verfügbar: ' + f(lg, 0) + ' − ' + f(si, 0) + ' + ' + f(of, 0) + ' = ' + f(lg - si + of, 0) + ' Stück. Nettobedarf: ' + f(br, 0) + ' − ' + f(lg - si + of, 0) + ' = ' + f(v, 0) + ' Stück.', ['Der Sicherheitsbestand ist nicht verfügbar, offene Bestellungen kommen noch.', 'Lösungsweg: ' + f(br, 0) + ' − (' + f(lg, 0) + ' − ' + f(si, 0) + ' + ' + f(of, 0) + ') = ?']);
    },
    kzq: pq(KZQ, ['Lies die Frage und kläre, ob Mengen oder Euro verglichen werden bzw. was die Liste zeigt.', 'Vergleiche mit den Begriffen in der Hilfe.', 'Wähle die passende Antwort.']),
    /* Qualität und Lean */
    ausq: R => {
      const c = C(), g = c.pick(R, [2000, 2500, 4000, 5000, 8000]), a = c.ri(R, 12, 180), v = c.ausschussQuote(a, g);
      return numQ(MB + 'Von ' + f(g, 0) + ' gefertigten Steuerplatinen SP-10 sind bei der Endprüfung ' + f(a, 0) + ' Stück Ausschuss (nicht nacharbeitbar). Wie hoch ist die Ausschussquote in Prozent?',
        ['Schreibe die Ausschussmenge in den Zähler.', 'Schreibe die gefertigte Menge in den Nenner.', 'Multipliziere mit 100.'], v, '%', 'Ausschussquote', 0.01,
        'Ausschussquote = ' + f(a, 0) + ' / ' + f(g, 0) + ' · 100 = ' + f(v, 2) + ' %.', ['Ausschussquote = Ausschuss / gefertigte Menge · 100.', 'Lösungsweg: ' + f(a, 0) + ' / ' + f(g, 0) + ' · 100 = ?']);
    },
    fehlk: R => {
      const c = C(), g = c.pick(R, [3000, 4000, 6000]), q = c.pick(R, [1.5, 2, 2.5, 3, 4]), hk = c.pick(R, [6.4, 8.5, 12.8, 14.2, 18.5]), a = g * q / 100, v = a * hk;
      return numQ(MB + 'Im Monat werden ' + f(g, 0) + ' Sensormodule SM-3 gefertigt. Die Ausschussquote liegt bei ' + f(q, 1) + ' %. Jedes Modul kostet in der Herstellung ' + f(hk, 2) + ' €. Wie hoch sind die Kosten des Ausschusses im Monat?',
        ['Rechne die Ausschussmenge: gefertigte Menge · Ausschussquote / 100.', 'Multipliziere mit den Herstellkosten je Stück.'], v, '€', 'Ausschusskosten', 0.01,
        'Ausschuss: ' + f(g, 0) + ' · ' + f(q, 1) + ' % = ' + f(a, 0) + ' Stück. Kosten: ' + f(a, 0) + ' · ' + f(hk, 2) + ' € = ' + f(v, 2) + ' €.', ['Erst die Stückzahl, dann den Wert.', 'Lösungsweg: ' + f(g, 0) + ' · ' + f(q, 1) + ' / 100 · ' + f(hk, 2) + ' € = ?']);
    },
    start: R => {
      const c = C(); let gut, q, v;
      for (let i = 0; i < 100; i++) { gut = c.pick(R, [480, 500, 760, 950, 1200]); q = c.pick(R, [2, 3, 4, 5, 8]); v = c.startMenge(gut, q); if (gut / (1 - q / 100) % 1 > 0.01) break; }
      return numQ(MB + 'Ein Kunde bestellt ' + f(gut, 0) + ' gute Funkmodule FM-2. Erfahrungsgemäß sind ' + f(q, 0) + ' % der gefertigten Stücke Ausschuss. Wie viele Stück müssen mindestens gefertigt werden?',
        ['Die Gutmenge ist (100 − Ausschussquote) % der Startmenge.', 'Teile die Gutmenge durch (1 − Quote / 100).', 'Runde auf, denn sonst fehlen gute Stücke.'], v, 'Stück', 'Startmenge', 0.01,
        'Gutanteil: 100 % − ' + f(q, 0) + ' % = ' + f(100 - q, 0) + ' %. Startmenge: ' + f(gut, 0) + ' / ' + f(1 - q / 100, 2) + ' = ' + f(gut / (1 - q / 100), 2) + ', aufgerundet ' + f(v, 0) + ' Stück. Achtung: ' + f(gut, 0) + ' + ' + f(q, 0) + ' % wäre zu wenig.', ['Nicht einfach die Prozent aufschlagen: Der Ausschuss bezieht sich auf die Startmenge.', 'Lösungsweg: ' + f(gut, 0) + ' / (1 − ' + f(q, 0) + ' / 100), aufrunden.']);
    },
    kanb: R => {
      const c = C(), vt = c.pick(R, [240, 300, 360, 480, 600]), wbz = c.pick(R, [1, 1.5, 2, 3]), si = c.pick(R, [10, 20, 25]), jb = c.pick(R, [50, 80, 100, 150]), v = c.kanbanAnzahl(vt, wbz, si, jb);
      return numQ(MB + 'Am Lötplatz werden je Tag ' + f(vt, 0) + ' Steckverbinder verbraucht. Die Wiederbeschaffungszeit eines Behälters beträgt ' + f(wbz, 1) + ' Tage, der Sicherheitszuschlag ' + f(si, 0) + ' %. Ein Behälter fasst ' + f(jb, 0) + ' Stück. Wie viele Kanban-Behälter (Karten) werden gebraucht?',
        ['Rechne den Verbrauch während der Wiederbeschaffungszeit: Verbrauch je Tag · Tage.', 'Schlage den Sicherheitszuschlag auf.', 'Teile durch die Menge je Behälter und runde auf.'], v, 'Behälter', 'Kanban-Anzahl', 0.01,
        'Verbrauch in der Wiederbeschaffungszeit: ' + f(vt, 0) + ' · ' + f(wbz, 1) + ' = ' + f(vt * wbz, 0) + ' Stück. Mit Zuschlag: ' + f(vt * wbz, 0) + ' · ' + f(1 + si / 100, 2) + ' = ' + f(vt * wbz * (1 + si / 100), 1) + ' Stück. Behälter: ' + f(vt * wbz * (1 + si / 100), 1) + ' / ' + f(jb, 0) + ' = ' + f(vt * wbz * (1 + si / 100) / jb, 2) + ', aufgerundet ' + f(v, 0) + '.', ['Es müssen so viele Behälter im Umlauf sein, dass die Zeit bis zum Nachschub überbrückt wird.', 'Lösungsweg: ' + f(vt, 0) + ' · ' + f(wbz, 1) + ' · (1 + ' + f(si, 0) + ' / 100) / ' + f(jb, 0) + ', aufrunden.']);
    },
    pdca: R => {
      const c = C(), P = c.PDCA, i = c.ri(R, 0, 3), right = P[(i + 1) % 4].n;
      return choiceQ(R, MB + 'Im Verbesserungsteam wurde gerade dieser Schritt erledigt: ' + P[i].d + ' (' + P[i].n + '). Welcher Schritt des PDCA-Zyklus folgt als nächster?',
        ['Ordne den erledigten Schritt einer der vier Phasen zu.', 'Gehe im Kreis weiter: Plan, Do, Check, Act und wieder Plan.', 'Wähle die nächste Phase.'], right, P.filter((_, j) => j !== (i + 1) % 4).map(x => x.n),
        'Der PDCA-Zyklus läuft im Kreis: ' + P.map(x => x.n + ' (' + x.d + ')').join(', ') + '. Nach ' + P[i].n + ' folgt ' + right + '.', ['Die vier Buchstaben stehen für Plan, Do, Check, Act.', 'Nach Act beginnt der Kreis wieder mit Plan.']);
    },
    lean: pq(LEANQ, ['Lies den Fall und kläre, ob es um Nachschub, Bestände oder Verbesserung geht.', 'Vergleiche mit den Begriffen Kanban, Just in Time, Kaizen und Verschwendung in der Hilfe.', 'Wähle die passende Antwort.'])
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    [CATS[0], 1, 'Fertigungsart im Fall A', 'fa', [0, 4]], [CATS[0], 1, 'Fertigungsart im Fall B', 'fa', [1, 5]], [CATS[0], 2, 'Fertigungsart im Fall C', 'fa', [2, 3]], [CATS[0], 1, 'Organisationstyp im Fall A', 'org', [0, 4]], [CATS[0], 1, 'Organisationstyp im Fall B', 'org', [1, 5]], [CATS[0], 2, 'Organisationstyp im Fall C', 'org', [2, 3]], [CATS[0], 2, 'Vor- und Nachteile', 'vor'],
    [CATS[1], 1, 'Kapazität im Monat', 'kapa'], [CATS[1], 1, 'Bedarf eines Auftrags', 'kapb'], [CATS[1], 2, 'Wie stark ausgelastet', 'grad'], [CATS[1], 2, 'Platz für einen neuen Auftrag', 'frei'], [CATS[1], 3, 'Stellen vergleichen', 'eng'], [CATS[1], 3, 'Samstag arbeiten', 'zus'], [CATS[1], 2, 'Über- und Unterlast', 'kapq'],
    [CATS[2], 1, 'Kosten fürs Umrüsten', 'ruest'], [CATS[2], 1, 'Kosten fürs Lagern', 'lager'], [CATS[2], 2, 'Summe der Loskosten', 'ges'], [CATS[2], 2, 'Beste Losgröße berechnen', 'andl'], [CATS[2], 3, 'Lose im Jahr', 'lose'], [CATS[2], 3, 'Drei Losgrößen im Vergleich', 'vergl'], [CATS[2], 1, 'Wirkung der Losgröße', 'losq'],
    [CATS[3], 1, 'Dauer eines Arbeitsgangs', 'afz'], [CATS[3], 2, 'Dauer des ganzen Auftrags', 'dlz'], [CATS[3], 2, 'Anteil der Wartezeit', 'anteil'], [CATS[3], 2, 'Frühester Endtermin', 'vorw'], [CATS[3], 3, 'Spätester Beginn', 'rueck'], [CATS[3], 3, 'Reicht die Zeit', 'puff'], [CATS[3], 1, 'Begriffe der Terminplanung', 'terq'],
    [CATS[4], 1, 'Stück je Stunde', 'prod'], [CATS[4], 2, 'Ertrag und Aufwand', 'wirt'], [CATS[4], 2, 'Gewinn und Eigenkapital', 'ekr'], [CATS[4], 2, 'Gewinn und Umsatz', 'umr'], [CATS[4], 2, 'Stückliste auflösen', 'brut'], [CATS[4], 3, 'Was wirklich fehlt', 'net'], [CATS[4], 1, 'Kennzahl oder Liste erkennen', 'kzq'],
    [CATS[5], 1, 'Anteil der Fehlteile', 'ausq'], [CATS[5], 2, 'Was der Ausschuss kostet', 'fehlk'], [CATS[5], 3, 'Wie viele anfangen', 'start'], [CATS[5], 3, 'Behälter im Umlauf', 'kanb'], [CATS[5], 1, 'Verbesserung im Kreis', 'pdca'], [CATS[5], 1, 'Lean im Fall A', 'lean', [0, 1, 2]], [CATS[5], 2, 'Lean im Fall B', 'lean', [3, 4]]
  ];
  const tasks = defs.map((d, i) => ({ id: 'prd' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('prd-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Zuordnungs-Sätze für den Reiter Begriffe ---------- */
  const SETS = {
    fa: { title: 'Fertigung', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Fertigungsarten', n: 'Einzelfertigung', d: 'Ein Erzeugnis wird nur einmal nach Kundenwunsch gefertigt.', pts: ['Hohe Stückkosten', 'Sehr beweglich'] },
      { g: 'Fertigungsarten', n: 'Serienfertigung', d: 'Eine begrenzte Menge (Los, Serie) eines Erzeugnisses wird gefertigt, danach wird umgerüstet.', pts: ['Rüstkosten je Los', 'Losgröße planen'] },
      { g: 'Fertigungsarten', n: 'Sortenfertigung', d: 'Varianten eines Grundprodukts aus demselben Ausgangsstoff mit kleinen Unterschieden.', pts: ['Wenig Umstellung', 'z. B. Kabel in Längen und Farben'] },
      { g: 'Fertigungsarten', n: 'Massenfertigung', d: 'Ein gleiches Erzeugnis in sehr großer Menge ohne geplantes Ende.', pts: ['Niedrige Stückkosten', 'Oft Fließfertigung'] },
      { g: 'Organisationstypen', n: 'Werkstattfertigung', d: 'Gleichartige Maschinen stehen zusammen, der Auftrag wandert zu ihnen.', pts: ['Beweglich', 'Lange Wege und Liegezeiten'] },
      { g: 'Organisationstypen', n: 'Fließfertigung', d: 'Arbeitsplätze stehen in der Reihenfolge der Arbeitsgänge, oft mit festem Takt.', pts: ['Kurze Durchlaufzeit', 'Starr und störanfällig'] },
      { g: 'Organisationstypen', n: 'Gruppenfertigung', d: 'Ein Team fertigt an einer Insel ein ganzes Teil und plant die Arbeit selbst.', pts: ['Abwechslung, Verantwortung', 'Kurze Wege'] },
      { g: 'Organisationstypen', n: 'Baustellenfertigung', d: 'Das Erzeugnis steht fest, Menschen, Maschinen und Material kommen zu ihm.', pts: ['Große Anlagen', 'Beim Kunden vor Ort'] }
    ] },
    kap: { title: 'Kapazität und Losgröße', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Kapazität', n: 'Kapazität', d: 'Leistungsvermögen einer Stelle in einem Zeitraum, z. B. Maschinenstunden im Monat.', pts: ['Maschinen · Tage · Stunden'] },
      { g: 'Kapazität', n: 'Kapazitätsbedarf', d: 'Zeit, die die geplanten Aufträge an einer Stelle brauchen.', pts: ['Rüstzeit + Menge · Stückzeit'] },
      { g: 'Kapazität', n: 'Beschäftigungsgrad', d: 'Genutzte Kapazität im Verhältnis zur vorhandenen Kapazität in Prozent.', pts: ['Über 100 % = Überlast'] },
      { g: 'Kapazität', n: 'Engpass', d: 'Die Stelle mit der höchsten Auslastung, sie begrenzt die Menge des ganzen Ablaufs.', pts: ['Höchster Beschäftigungsgrad'] },
      { g: 'Losgröße', n: 'Losgröße', d: 'Menge eines Erzeugnisses, die ohne Umrüsten am Stück gefertigt wird.', pts: ['Große Lose: weniger Rüstkosten, mehr Lagerkosten'] },
      { g: 'Losgröße', n: 'Rüstkosten', d: 'Kosten, die je Los beim Umstellen der Maschinen anfallen.', pts: ['Fallen je Los an'] },
      { g: 'Losgröße', n: 'Lagerkosten', d: 'Kosten für Zinsen, Platz und Risiko der Ware, die zwischen Fertigung und Verbrauch lagert.', pts: ['Ø Bestand = Losgröße / 2'] },
      { g: 'Losgröße', n: 'Optimale Losgröße', d: 'Losgröße, bei der die Summe aus Rüst- und Lagerkosten im Jahr am kleinsten ist.', pts: ['Andler-Formel'] }
    ] },
    ter: { title: 'Zeiten und Termine', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Zeiten', n: 'Rüstzeit', d: 'Zeit zum Vorbereiten und Umstellen eines Arbeitsplatzes, einmal je Auftrag bzw. Los.', pts: ['Unabhängig von der Menge'] },
      { g: 'Zeiten', n: 'Stückzeit', d: 'Zeit für die Bearbeitung eines einzelnen Stücks.', pts: ['Mal Menge = Ausführungszeit'] },
      { g: 'Zeiten', n: 'Übergangszeit', d: 'Liege- und Transportzeit zwischen den Arbeitsgängen.', pts: ['Oft der größte Anteil'] },
      { g: 'Zeiten', n: 'Durchlaufzeit', d: 'Zeit vom Beginn des ersten bis zum Ende des letzten Arbeitsgangs eines Auftrags, mit Liegen und Transport.', pts: ['Summe aller Zeiten'] },
      { g: 'Termine', n: 'Vorwärtsterminierung', d: 'Vom frühesten Beginn aus wird das früheste Ende berechnet.', pts: ['Zeigt, ob der Termin hält'] },
      { g: 'Termine', n: 'Rückwärtsterminierung', d: 'Vom Liefertermin aus wird der späteste Beginn berechnet.', pts: ['Wenig Vorrat, aber kein Puffer'] },
      { g: 'Termine', n: 'Puffer', d: 'Zeitreserve zwischen frühestem Ende und Liefertermin.', pts: ['Negativ = Termin in Gefahr'] },
      { g: 'Termine', n: 'Balkendiagramm', d: 'Darstellung der Arbeitsgänge als Balken auf einer Zeitachse.', pts: ['Auch Gantt-Diagramm'] }
    ] },
    kz: { title: 'Kennzahlen und Stückliste', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Kennzahlen', n: 'Produktivität', d: 'Verhältnis von Ausbringungsmenge zu Einsatzmenge, z. B. Stück je Arbeitsstunde.', pts: ['Mengen durch Mengen'] },
      { g: 'Kennzahlen', n: 'Wirtschaftlichkeit', d: 'Verhältnis von Ertrag zu Aufwand (beides in Euro).', pts: ['Größer als 1 = wirtschaftlich'] },
      { g: 'Kennzahlen', n: 'Eigenkapitalrentabilität', d: 'Gewinn im Verhältnis zum Eigenkapital in Prozent.', pts: ['Verzinsung des Eigenkapitals'] },
      { g: 'Kennzahlen', n: 'Umsatzrentabilität', d: 'Gewinn im Verhältnis zum Umsatz in Prozent.', pts: ['Gewinn je Euro Umsatz'] },
      { g: 'Bedarf', n: 'Primärbedarf', d: 'Bedarf an verkaufsfähigen Erzeugnissen laut Absatzplan.', pts: ['Ausgangspunkt der Rechnung'] },
      { g: 'Bedarf', n: 'Bruttobedarf', d: 'Gesamter Bedarf an Teilen aus der Stückliste, ohne Bestände zu beachten.', pts: ['Primärbedarf · Menge je Stück'] },
      { g: 'Bedarf', n: 'Nettobedarf', d: 'Bruttobedarf abzüglich verfügbarer Bestände, also das, was noch beschafft oder gefertigt werden muss.', pts: ['Sicherheitsbestand ist nicht verfügbar'] },
      { g: 'Bedarf', n: 'Strukturstückliste', d: 'Stückliste, die den Aufbau eines Erzeugnisses Stufe für Stufe zeigt.', pts: ['Erzeugnis, Baugruppe, Teil'] }
    ] },
    ql: { title: 'Qualität und Lean', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Qualität', n: 'Ausschussquote', d: 'Anteil der nicht verwendbaren Stücke an der gefertigten Menge in Prozent.', pts: ['Ausschuss / Menge · 100'] },
      { g: 'Qualität', n: 'PDCA-Zyklus', d: 'Kreislauf aus Planen, Ausführen, Prüfen und Handeln zur ständigen Verbesserung.', pts: ['Plan, Do, Check, Act'] },
      { g: 'Qualität', n: 'Kaizen', d: 'Ständige Verbesserung in kleinen Schritten durch alle Beschäftigten.', pts: ['Jeden Tag ein wenig besser'] },
      { g: 'Lean', n: 'Kanban', d: 'Steuerung mit Karten: Der Verbrauch eines Behälters löst den Nachschub aus.', pts: ['Holprinzip (Pull)'] },
      { g: 'Lean', n: 'Just in Time', d: 'Material kommt genau dann und in der Menge, in der es gebraucht wird.', pts: ['Kleine Bestände', 'Zuverlässige Lieferer nötig'] },
      { g: 'Lean', n: 'Verschwendung', d: 'Alles, was Zeit oder Geld kostet, aber für den Kunden keinen Wert schafft.', pts: ['Bestände, Warten, Wege, Fehler'] }
    ] }
  };

  root.PRD_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, sets: SETS, pools: { VOR, KAPQ, LOSQ, TERQ, KZQ, LEANQ }, losSet };
  root.PRD_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.PRD_DATA, TASKS: root.PRD_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
