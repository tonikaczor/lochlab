'use strict';
/* Tonfunk Warenfluss-Lab: Daten (Aufgaben-Generatoren, Beispiele, Zuordnungs-Sätze).
   ALLE Zahlen (Mengen, Fristen, Tarife, Tragfähigkeiten, Maße, Zeiten) sind ÜBUNGSWERTE, nicht für die Praxis.
   window.WFL_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, sets }
   window.WFL_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'wfl', Status in localStorage 'lm4.wfl.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch den Fehler (Titel bleiben neutral, ohne Zahlen).
   Nicht doppeln (siehe laglab/ladlab): Kennzahlen, Disposition, ABC-Analyse, Zurren, Reibung, Gefahrgut, Verpackungssymbole. */
(function (root) {
  const C = () => root.WFL_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Wareneingangsprüfung', 'Mängel und Rüge', 'Lagerstrategien', 'Kommissionierung', 'Flurförderzeuge', 'Inventur', 'Versand und Frachtpapiere'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const pad = (v, n) => String(v).padStart(n, ' ');

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  const BN = { m: 'Mengenabweichung', t: 'Transportschaden', q: 'Qualitätsmangel (Mangel an der Ware selbst)', f: 'Falschlieferung' };
  const BEF = [
    ['Auf der Palette stehen 18 Kartons. Bestellt und auf dem Lieferschein angegeben sind 20.', 'm', 'Du zählst weniger Kartons als bestellt. Weder die Ware noch der Transport sind schuld, es stimmt die Menge nicht: Unterlieferung.'],
    ['Die Stretchfolie ist aufgerissen und zwei Kartons sind nass. Die Ware darin ist aufgequollen.', 't', 'Die Verpackung zeigt den Schaden, er ist auf dem Transportweg entstanden: Transportschaden.'],
    ['Die Verpackung ist unversehrt. Beim Auspacken siehst du, dass bei mehreren Teilen das Gewinde schief geschnitten ist.', 'q', 'Die Verpackung ist heil, also kein Transportschaden. Der Fehler steckt in der Ware selbst (Herstellung): Qualitätsmangel.'],
    ['Geliefert wurde die Artikelnummer B-2210 (Schraube M10 x 60), bestellt war B-2201 (M10 x 40).', 'f', 'Es ist ein anderer Artikel als bestellt: Falschlieferung. Achte auf ähnliche Artikelnummern.'],
    ['Auf dem Lieferschein stehen drei Paletten, abgeladen wurden vier.', 'm', 'Auch zu viel ist eine Mengenabweichung (Überlieferung).'],
    ['Der Karton ist eingedrückt und mehrere Gläser darin sind zerbrochen.', 't', 'Eingedrückter Karton und zerbrochener Inhalt weisen auf den Transport hin: Transportschaden.'],
    ['Alle Teile sind vollständig und die Verpackung ist heil, aber die Maße der Teile liegen außerhalb der Toleranz.', 'q', 'Menge und Verpackung sind in Ordnung, die Teile selbst sind fehlerhaft: Qualitätsmangel.'],
    ['Bestellt waren Netzteile mit 2,5 A. Im Karton liegen Netzteile mit 5 A.', 'f', 'Richtige Menge, aber ein anderer Artikel: Falschlieferung.'],
    ['Eine Ecke der Palette ist gestaucht, der Karton dort ist eingerissen und die Ware darin verbogen.', 't', 'Gestauchte Palettenecke und beschädigte Ware: Schaden durch den Transport.']
  ];
  const befQ = (R) => {
    const e = C().pick(R, BEF);
    return choiceQ(R, 'Du prüfst eine Anlieferung und stellst fest: ' + e[0] + ' Wie ordnest du den Befund ein?', BN[e[1]], Object.keys(BN).filter(k => k !== e[1]).map(k => BN[k]), e[2], ['Schau zuerst, ob die Verpackung beschädigt ist.', 'Vergleiche Art, Menge und Zustand der Ware mit der Bestellung.']);
  };
  /* PRUEFEN P16: Schadens- und Mangelbegriffe (offener/versteckter Mangel, Transportschaden, Tatbestandsaufnahme, Sperren) sind vereinfacht und keine Rechtsaussage. Passen die Begriffe zu euren Wareneingangs-Unterlagen? */
  const SCHQ = [
    ['Beim Abladen siehst du eine Palette mit gerissener Folie und nassen Kartons. Der Fahrer will gleich weiterfahren. Was tust du zuerst?', 'Den Schaden auf dem Lieferschein bzw. Frachtbrief vermerken, bevor der Fahrer abfährt', ['Die Ware erst einlagern und später prüfen', 'Die Kartons neu verpacken, damit der Schaden nicht auffällt', 'Die Ware entsorgen'], 'Ein Schaden muss sofort festgehalten werden, solange der Fahrer noch da ist und der Zustand unverändert ist. Danach wird Ware gesperrt und der Ablauf des Betriebs eingehalten.', ['Wann ist der Zustand der Ware noch unverändert?', 'Der Fahrer soll den Vermerk gegenzeichnen können.']],
    ['Was gehört zur Tatbestandsaufnahme bei einem Schaden?', 'Fotos, Menge und Art des Schadens, Datum, Uhrzeit und Namen der Beteiligten festhalten', ['Nur den Preis der Ware notieren', 'Die Ware aufräumen, damit sie ordentlich aussieht', 'Den Lieferanten anrufen und nichts aufschreiben'], 'Die Tatbestandsaufnahme hält fest, was wann wo und wie festgestellt wurde. Fotos und Notizen sind später der Nachweis.', ['Wer später nachfragt, braucht Belege.', 'Wer, was, wann, wo, wie viel.']],
    ['Warum wird beschädigte Ware vor der Klärung nicht normal eingelagert?', 'Die Ware könnte mit einwandfreier Ware verwechselt und weiterverwendet werden, deshalb wird sie gesperrt und getrennt gestellt', ['Weil beschädigte Ware keinen Lagerplatz bekommt', 'Weil sie sofort zum Lieferanten zurückgehen muss', 'Weil der Lagerplatz sonst teurer wird'], 'Gesperrte Ware wird getrennt und gekennzeichnet gelagert. So wird sie nicht versehentlich verbaut oder ausgeliefert, bis über Nachlieferung, Gutschrift oder Rücksendung entschieden ist.', ['Was passiert, wenn jemand die Ware für gut hält?', 'Denke an Kennzeichnung und getrennten Platz.']],
    ['Wer wird nach der Schadensaufnahme informiert?', 'Der Vorgesetzte bzw. der zuständige Einkauf, nach dem Ablauf deines Betriebs', ['Der Kunde des Lieferanten', 'Niemand, bis die Rüge fertig geschrieben ist', 'Die Presse'], 'Die Meldung geht nach dem betrieblichen Ablauf an den Vorgesetzten bzw. den Einkauf, der mit dem Lieferer die Lösung klärt.', ['Wer hat die Beziehung zum Lieferer?', 'Der Ablauf deines Betriebs entscheidet.']],
    ['Ein Karton ist äußerlich unversehrt. Erst beim Einbau in der Montage fällt ein Mangel auf. Wie nennt man einen solchen Mangel?', 'Versteckter Mangel (bei der Annahme nicht erkennbar)', ['Offener Mangel (bei der Annahme sofort erkennbar)', 'Transportschaden mit Frachtführer', 'Falschlieferung'], 'Ein Mangel, den man bei der Annahme nicht sehen konnte, heißt versteckter Mangel. Er muss ebenfalls gemeldet werden, sobald er entdeckt ist. Die Fristen sind hier nur Übungswerte.', ['Konntest du den Mangel bei der Annahme sehen?', 'Das Gegenteil heißt offener Mangel.']],
    ['Warum kontrollierst du beim Entladen die Stückzahl selbst, auch wenn der Lieferschein stimmt?', 'Der Lieferschein zeigt nur, was der Lieferer behauptet; maßgeblich ist, was tatsächlich ankommt', ['Weil Lieferscheine immer falsch sind', 'Weil der Fahrer sonst nicht unterschreibt', 'Weil das Zählen die Ware schützt'], 'Der Lieferschein ist eine Angabe des Lieferers. Erst die Zählung beim Wareneingang zeigt, was wirklich geliefert wurde.', ['Wer hat den Lieferschein geschrieben?', 'Ware zählen heißt gegen die Angabe prüfen.']]
  ];
  const KSQ = [
    ['Der Kommissionierer geht mit einem Wagen durch die Regalgänge und entnimmt die Artikel direkt an den Regalen. Wie heißt das System?', 'Mann-zur-Ware', ['Ware-zum-Mann', 'Pick-by-Voice', 'Auftragsbündelung'], 'Beim System Mann-zur-Ware bewegt sich die Person zur Ware, die Ware bleibt am Platz.', ['Wer bewegt sich: die Person oder die Ware?', 'Die Ware bleibt im Regal.']],
    ['Ein Fördersystem bringt Behälter an eine feste Entnahmestation. Der Kommissionierer bleibt an seinem Platz stehen. Wie heißt das System?', 'Ware-zum-Mann', ['Mann-zur-Ware', 'Pick-by-Light', 'Papierpickliste'], 'Bei Ware-zum-Mann kommt die Ware zur Person an die Station. Der Weg der Person fällt weg.', ['Wer bleibt stehen?', 'Die Ware wird an die Station gebracht.']],
    ['Der Kommissionierer hört über Kopfhörer "Gang 3, Platz 12, Menge 4" und bestätigt per Sprache. Hände und Augen sind frei. Wie heißt das Verfahren?', 'Pick-by-Voice', ['Pick-by-Light', 'Pickliste auf Papier', 'Ware-zum-Mann'], 'Pick-by-Voice gibt Anweisungen per Sprache und nimmt Bestätigungen per Sprache an. Das Handgerät oder Papier entfällt.', ['Das Wort "Voice" heißt Stimme.', 'Die Anweisung kommt über Kopfhörer.']],
    ['An jedem Regalfach leuchtet eine Anzeige mit der Entnahmemenge, die per Tastendruck quittiert wird. Wie heißt das Verfahren?', 'Pick-by-Light', ['Pick-by-Voice', 'Pickliste auf Papier', 'Auftragsbündelung'], 'Pick-by-Light zeigt das Entnahmefach und die Menge direkt am Regal durch eine Leuchtanzeige an.', ['Das Wort "Light" heißt Licht.', 'Die Anzeige sitzt am Regalfach.']],
    ['Eine ausgedruckte Liste wird in der Reihenfolge der Lagerplätze abgearbeitet und mit einem Stift abgehakt. Wie heißt das Hilfsmittel?', 'Pickliste auf Papier', ['Pick-by-Light', 'Pick-by-Voice', 'Ware-zum-Mann'], 'Die Papierpickliste ist das einfachste Hilfsmittel. Die Liste ist günstig, aber anfälliger für Lesefehler und braucht Hände und Augen.', ['Was benutzt man zum Abhaken?', 'Es braucht keine Technik am Regal.']],
    ['Mehrere Kundenaufträge werden in einem gemeinsamen Rundgang kommissioniert und danach den Aufträgen zugeteilt. Wie heißt das?', 'Auftragsbündelung (Batch-Kommissionierung)', ['Einzelauftragskommissionierung', 'Pick-by-Light', 'Ware-zum-Mann'], 'Bei der Auftragsbündelung werden Aufträge zusammen gesammelt. Das spart Wege, braucht aber hinterher das Aufteilen.', ['Wie viele Aufträge werden gleichzeitig gesammelt?', 'Wege sparen, dafür später sortieren.']],
    ['Was ist ein typischer Vorteil von Pick-by-Voice gegenüber der Papierpickliste?', 'Hände und Augen bleiben frei für die Ware', ['Es wird gar kein Personal mehr gebraucht', 'Die Fehlerquote ist immer null', 'Es ist ohne Einarbeitung nutzbar'], 'Wer nicht auf Papier oder Display schaut, kann Ware und Umgebung im Blick behalten. Einarbeitung und Technik sind trotzdem nötig.', ['Was braucht man bei Papier, was nicht bei Voice?', 'Perfekte Ergebnisse gibt es nie.']],
    ['Wann kommt Ware-zum-Mann besonders in Frage?', 'Bei vielen kleinen Teilen und hoher Pickzahl, wenn lange Wege der Person vermieden werden sollen', ['Bei sperrigen Einzelstücken, die nur selten gebraucht werden', 'Wenn kein Platz für eine Station vorhanden ist', 'Wenn nur ein Auftrag am Tag anfällt'], 'Ware-zum-Mann lohnt sich vor allem bei vielen Positionen und kleinen Teilen. Die Anlage kostet aber viel und braucht Platz.', ['Wo spart man am meisten Wegzeit?', 'Wann lohnt sich eine teure Anlage?']]
  ];
  /* PRUEFEN P17: Fahrerlaubnis/Befähigung für Flurförderzeuge wird hier nur als Pflicht genannt (Unterweisung, Beauftragung durch den Unternehmer). Die genauen Vorgaben (Ausbildungsnachweis, Prüfintervalle, Betriebsanweisung) stehen nicht im Lab. Ist der Wortlaut sicher genug, oder soll nur auf die Betriebsanweisung verwiesen werden? */
  const FLQ = [
    ['Was musst du vor Fahrtantritt mit dem Stapler tun?', 'Eine Sicht- und Funktionsprüfung nach der Betriebsanweisung durchführen (z. B. Reifen, Gabelzinken, Hydraulik, Bremse, Hupe)', ['Nichts, das macht nur die Werkstatt', 'Nur den Tank oder die Batterie prüfen', 'Erst losfahren und Mängel unterwegs melden'], 'Vor der Fahrt wird der Stapler nach der Betriebsanweisung geprüft. Mängel werden gemeldet und der Stapler wird bei sicherheitsrelevanten Mängeln nicht benutzt.', ['Wer fährt mit dem Gerät und ist dafür verantwortlich?', 'Prüfe, bevor etwas passieren kann.']],
    ['Bei der Prüfung vor der Fahrt siehst du einen feuchten, tropfenden Hydraulikschlauch. Was tust du?', 'Den Stapler nicht benutzen, den Mangel melden und das Gerät nach dem betrieblichen Ablauf sperren', ['Vorsichtig weiterfahren und nur leichte Lasten heben', 'Mit einem Lappen abwischen und weiterarbeiten', 'Den Schlauch selbst wechseln'], 'Hydraulikmängel sind sicherheitsrelevant. Der Stapler wird gesperrt, gemeldet und von einer befugten Stelle repariert.', ['Darf ein Gerät mit einem sicherheitsrelevanten Mangel eingesetzt werden?', 'Wer darf reparieren?']],
    ['Wer darf einen Gabelstapler im Betrieb fahren (Pflicht nur nennen)?', 'Nur wer dafür unterwiesen und befähigt ist und vom Unternehmer ausdrücklich beauftragt wurde (Fahrerlaubnis)', ['Jeder, der schon einmal mitgefahren ist', 'Jeder mit Pkw-Führerschein ohne weitere Unterweisung', 'Wer es eilig hat und niemanden fragen will'], 'Für Flurförderzeuge sind Unterweisung, Befähigung und eine Beauftragung nötig. Die Einzelheiten regelt dein Betrieb, im Lab wird nur die Pflicht genannt.', ['Wer erlaubt das Fahren?', 'Mitfahren reicht als Nachweis nicht.']],
    ['Wo findest du, wie viel der Stapler bei welchem Lastschwerpunkt und welcher Hubhöhe heben darf?', 'Auf dem Typenschild bzw. im Traglastdiagramm des Staplers', ['In der Bestellung der Ware', 'Auf dem Lieferschein', 'Im Lagerplan'], 'Die zulässige Last steht im Traglastdiagramm bzw. auf dem Typenschild des Staplers. Diese Angaben gelten, nicht eine Schätzung.', ['Das Gerät selbst trägt die Angaben.', 'Es gehört zum Fahrzeug, nicht zur Ware.']],
    ['Du fährst mit aufgenommener Last. Wie trägst du sie?', 'Möglichst niedrig (bodennah) und mit zurückgeneigtem Hubmast', ['So hoch wie möglich, damit sie nichts berührt', 'Mit vorgeneigtem Mast, damit sie nicht rutscht', 'Auf halber Höhe für gute Sicht'], 'Eine tief getragene, zurückgeneigte Last liegt stabil und der Schwerpunkt bleibt tief. Das verbessert die Standsicherheit.', ['Wo liegt der Schwerpunkt am sichersten?', 'Zurückneigen heißt zum Fahrer hin.']],
    ['Ein Kollege möchte sich auf die Gabel stellen, um ein Regalfach zu erreichen. Was gilt?', 'Personen dürfen nicht auf den Gabeln mitgenommen oder angehoben werden (Ausnahmen nur mit zugelassenem Arbeitskorb nach der Betriebsanweisung)', ['Das ist erlaubt, wenn die Gabel nur ganz kurz angehoben wird', 'Das ist erlaubt, wenn die Person sich festhält', 'Das ist erlaubt, wenn der Fahrer langsam hebt'], 'Anheben von Personen auf der Gabel ist gefährlich und grundsätzlich verboten. Zugelassene Arbeitsbühnen gibt es nur mit Betriebsanweisung.', ['Ist die Gabel dafür gebaut?', 'Absturzgefahr.']]
  ];
  /* PRUEFEN P18: Inventurbegriffe (Stichtagsinventur, permanente Inventur, Stichprobeninventur, Blindzählung, Differenzliste) und "Bestandsdifferenz buchen" werden nur als Begriffe erklärt, keine Buchungssätze und keine Rechtsaussage zur Zulässigkeit der Verfahren. Passt die Erklärung zum Unterricht? */
  const INVQ = [
    ['Alle Bestände werden an einem festen Tag gezählt, das Lager steht dabei oft still. Wie heißt das Verfahren?', 'Stichtagsinventur', ['Permanente Inventur', 'Stichprobeninventur', 'Bestandsführung'], 'Bei der Stichtagsinventur wird der gesamte Bestand an einem festgelegten Tag aufgenommen.', ['Ein einzelner Tag für alle Artikel.', 'Das Lager muss dafür ruhen.']],
    ['Jeder Artikel wird mindestens einmal im Jahr gezählt, verteilt über das ganze Jahr, z. B. bei einem Platz mit Bestand null. Wie heißt das Verfahren?', 'Permanente Inventur', ['Stichtagsinventur', 'Stichprobeninventur', 'Blindzählung'], 'Bei der permanenten Inventur wird laufend gezählt, jeder Artikel mindestens einmal im Jahr. Das Lager muss nicht stillstehen.', ['Zählen verteilt sich auf das Jahr.', 'Das Wort "permanent" heißt laufend.']],
    ['Ein Teil der Artikel wird zufällig ausgewählt und gezählt, der Rest wird hochgerechnet. Wie heißt das Verfahren?', 'Stichprobeninventur', ['Stichtagsinventur', 'Permanente Inventur', 'Einzelbewertung'], 'Bei der Stichprobeninventur wird nur ein Teil gezählt, das Ergebnis wird auf alle Artikel hochgerechnet.', ['Nicht alle werden gezählt.', 'Es wird geschätzt.']],
    ['Was ist die Inventurdifferenz?', 'Der Unterschied zwischen Sollbestand (Buchbestand) und Istbestand (gezählt)', ['Der Unterschied zwischen Einkaufs- und Verkaufspreis', 'Die Anzahl der Zähler', 'Der Bestand am Stichtag'], 'Soll ist, was das System meint. Ist ist, was du zählst. Die Differenz ist der Unterschied.', ['Soll gegen Ist.', 'Buchbestand gegen Zählung.']],
    ['Was bedeutet der Begriff "Bestandsdifferenz buchen"?', 'Der Buchbestand im Lagerverwaltungssystem wird nach Freigabe an den gezählten Istbestand angepasst', ['Der Lieferant wird bezahlt', 'Die Ware wird verkauft', 'Der Artikel wird aus dem Sortiment genommen'], 'Nach der Zählung und Klärung wird die Differenz im System korrigiert. Wer freigibt, regelt der Betrieb. Im Lab geht es nur um den Begriff.', ['Welcher Bestand wird angepasst?', 'Freigabe vor Korrektur.']],
    ['Warum wird bei einer Blindzählung der Sollbestand nicht angezeigt?', 'Damit der Zähler nicht unbewusst den Sollwert übernimmt', ['Damit weniger Zeit gebraucht wird', 'Damit die Differenz kleiner wird', 'Damit die Ware nicht gezählt werden muss'], 'Wer den Sollwert kennt, neigt dazu, ihn zu bestätigen. Ohne Sollwert wird wirklich gezählt.', ['Was beeinflusst den Zähler?', 'Neutral zählen.']],
    ['Was zeigt eine Differenzliste?', 'Die Artikel, bei denen Soll- und Istbestand nicht übereinstimmen', ['Alle Artikel mit ihrem Preis', 'Die Lieferanten mit den meisten Aufträgen', 'Den Bestand am Jahresanfang'], 'Die Differenzliste stellt Soll und Ist gegenüber und zeigt die Abweichungen. Die Liste dient der Klärung (Nachzählung, Ursachensuche).', ['Soll minus Ist ergibt was?', 'Nur Abweichungen interessieren.']]
  ];
  /* PRUEFEN P19: Aussagen zu Frachtbrief (Nachweis des Beförderungsvertrags, international z. B. CMR) und Packliste (Inhalt je Packstück) sind vereinfacht. Welche Papiere und Begriffe verwenden eure Speditionspartner? */
  const PAPQ = [
    ['Welches Papier begleitet die Ware, nennt Art und Menge und wird beim Wareneingang gegen die Bestellung geprüft?', 'Lieferschein', ['Frachtbrief', 'Packliste', 'Rechnung'], 'Der Lieferschein nennt Art und Menge der gelieferten Ware. Er ist die Grundlage für die Wareneingangsprüfung.', ['Wer prüft das Papier, der Empfänger oder der Frachtführer?', 'Es steht eine Menge pro Artikel darauf.']],
    ['Welches Papier ist der Nachweis über den Beförderungsvertrag zwischen Absender und Frachtführer?', 'Frachtbrief', ['Lieferschein', 'Packliste', 'Bestellung'], 'Der Frachtbrief gehört zur Beförderung: Absender, Empfänger, Frachtführer, Sendung. Bei Auslandstransporten gibt es dafür einen eigenen Vordruck (z. B. CMR).', ['Wer transportiert?', 'Das Papier hat mit dem Frachtführer zu tun.']],
    ['Welches Papier listet auf, was in welchem Packstück liegt, mit Maßen und Gewichten?', 'Packliste', ['Lieferschein', 'Frachtbrief', 'Wareneingangsbeleg'], 'Die Packliste beschreibt den Inhalt jedes Packstücks. Die Liste hilft beim Auspacken, beim Zoll und bei Reklamationen.', ['Es geht um den Inhalt einzelner Packstücke.', 'Stückzahl je Karton.']],
    ['Was gehört typischerweise auf die Kennzeichnung eines Packstücks?', 'Empfänger, Absender, laufende Packstücknummer (z. B. 2/5), Gewicht und ggf. Handhabungshinweise', ['Nur der Preis der Ware', 'Nur die Rechnungsnummer', 'Nur das Lieferdatum'], 'Die Kennzeichnung sagt, wohin das Packstück gehört, wie viele zur Sendung gehören und wie es behandelt wird.', ['Wohin und von wem?', 'Wie viele Packstücke gehören zusammen?']],
    ['Eine Sendung besteht aus 7 Packstücken. Auf einem Etikett steht "3/7". Was bedeutet das?', 'Es ist das dritte von sieben Packstücken der Sendung', ['Es sind drei Stück von sieben im Karton', 'Es ist die Palette Nummer sieben von drei', 'Es sind sieben Kilogramm in drei Kartons'], 'Die Angabe "3/7" nennt die Nummer des Packstücks und die Gesamtzahl. So fällt auf, wenn ein Packstück fehlt.', ['Erste Zahl: laufende Nummer.', 'Zweite Zahl: Gesamtzahl.']],
    ['Welche Aufgabe hat die Packliste im Unterschied zum Lieferschein?', 'Die Packliste beschreibt den Inhalt der einzelnen Packstücke, der Lieferschein die gesamte Lieferung', ['Die Packliste ersetzt die Rechnung', 'Die Packliste ist der Beförderungsvertrag', 'Die Packliste gilt nur für Gefahrgut'], 'Lieferschein: Was wird geliefert? Packliste: Was liegt in welchem Packstück?', ['Gesamtlieferung oder einzelnes Packstück?', 'Wer öffnet die Packstücke?']]
  ];

  /* ---------- Hilfen für Aufgaben ---------- */
  const KOMMOD = 'Lagermodell: Gänge 1 bis 6, je 20 m lang, 3 m Abstand, Quergänge vorn und hinten, Start und Ziel (Basis) vorn an Gang 0. "3/10" heißt Gang 3, 10 m ab Vorderkante.';
  const ptxt = picks => picks.map(q => q.a + '/' + q.p).join(', ');
  const legTxt = picks => { const C0 = C(); let cur = { a: 0, p: 0 }, o = []; picks.concat([{ a: 0, p: 0 }]).forEach(q => { o.push((cur.a ? cur.a + '/' + cur.p : 'Basis') + ' → ' + (q.a ? q.a + '/' + q.p : 'Basis') + ': ' + f(C0.dist(cur.a, cur.p, q.a, q.p), 0) + ' m'); cur = q; }); return o.join('; '); };
  function randPicks(R, n) {
    const c = C(), out = [], key = new Set();
    while (out.length < n) { const a = c.ri(R, 1, 6), p = c.pick(R, c.LAYOUT.slots), k = a + '/' + p; if (!key.has(k)) { key.add(k); out.push({ a, p }); } }
    return out;
  }
  function mkBatches(R, n, fefoDiff) {
    const c = C();
    for (let t = 0; t < 80; t++) {
      const ein = c.shuffle(R, [10, 25, 40, 55, 70, 85, 100, 115]).slice(0, n), mhd = c.shuffle(R, [150, 170, 190, 210, 230, 250, 270, 300]).slice(0, n);
      const b = ein.map((e, i) => ({ id: 'Charge ' + 'ABCD'[i], ein: e, mhd: mhd[i], qty: c.ri(R, 4, 12) * 5 }));
      if (!fefoDiff || c.orderBatches(b, 'fifo')[0].id !== c.orderBatches(b, 'fefo')[0].id) return b;
    }
    return [{ id: 'Charge A', ein: 10, mhd: 300, qty: 40 }, { id: 'Charge B', ein: 55, mhd: 150, qty: 40 }, { id: 'Charge C', ein: 85, mhd: 230, qty: 40 }].slice(0, n);
  }
  const batchTxt = b => b.map(x => x.id + ': eingelagert am ' + C().dayStr(x.ein) + ', haltbar bis ' + C().dayStr(x.mhd) + ', ' + f(x.qty, 0) + ' Stück').join('; ');
  const HUBTXT = () => C().HUB.map((h, i) => 'bis ' + f(h.bis, 0) + ' mm Hub: ' + f(h.q, 0) + ' kg').join(', ');

  /* ---------- Generatoren ---------- */
  const G = {
    /* Wareneingangsprüfung */
    fehl: R => {
      const c = C(), art = c.pick(R, c.ARTS), o = c.pick(R, [48, 60, 72, 80, 100, 120, 150, 200]), miss = c.ri(R, 3, 14), z = o - miss;
      return numQ('Bestellt sind ' + f(o, 0) + ' Stück "' + art.n + '". Auf dem Lieferschein stehen ' + f(o, 0) + ' Stück. Du zählst die Ware beim Abladen nach und kommst auf ' + f(z, 0) + ' Stück. Wie viele Stück fehlen gegenüber der Bestellung?', miss, 'Stück', 'Fehlmenge', 0.01,
        'Maßgeblich ist die Zählung, nicht der Lieferschein: ' + f(o, 0) + ' bestellt − ' + f(z, 0) + ' gezählt = ' + f(miss, 0) + ' Stück fehlen. Der Lieferschein nennt die volle Menge, deshalb muss die Fehlmenge darauf vermerkt werden.', ['Vergleiche die Bestellung mit deiner eigenen Zählung.', 'Bestellt minus gezählt.']);
    },
    befund: befQ,
    teil: R => {
      const c = C(), B = c.pick(R, [400, 500, 600, 800]), t1 = c.ri(R, 4, 9) * 20, t2 = c.ri(R, 3, 8) * 20, x = c.ri(R, 1, 4) * 10, open = B - t1 - (t2 - x);
      return numQ('Bestellt sind ' + f(B, 0) + ' Stück. Die erste Teillieferung hatte ' + f(t1, 0) + ' Stück. In der zweiten Teillieferung standen ' + f(t2, 0) + ' Stück auf dem Lieferschein, davon hast du ' + f(x, 0) + ' Stück wegen Transportschäden nicht angenommen. Wie viele Stück sind noch offen?', open, 'Stück', 'Offene Menge', 0.01,
        'Angenommen wurden ' + f(t1, 0) + ' + (' + f(t2, 0) + ' − ' + f(x, 0) + ') = ' + f(t1 + t2 - x, 0) + ' Stück. Offen: ' + f(B, 0) + ' − ' + f(t1 + t2 - x, 0) + ' = ' + f(open, 0) + ' Stück. Die abgelehnten Stücke zählen nicht als geliefert.', ['Was zählt als angenommen?', 'Abgelehnte Ware zählt nicht als geliefert.']);
    },
    wert: R => {
      const c = C(), P = c.pick(R, [2.5, 3.2, 4.75, 12.4, 18.9]), B = c.pick(R, [100, 120, 150, 200, 250]), z = B - c.ri(R, 4, 15), x = c.ri(R, 3, 9), v = (B - z + x) * P;
      return numQ('Bestellt sind ' + f(B, 0) + ' Stück zu je ' + f(P, 2) + ' € (Einkaufspreis). Du zählst ' + f(z, 0) + ' Stück. Davon sind ' + f(x, 0) + ' Stück durch einen Transportschaden unbrauchbar. Wie hoch ist der Wert der Ware, die nicht geliefert oder unbrauchbar ist?', v, '€', 'Wert', 0.01,
        'Nicht geliefert: ' + f(B, 0) + ' − ' + f(z, 0) + ' = ' + f(B - z, 0) + ' Stück. Unbrauchbar: ' + f(x, 0) + ' Stück. Zusammen ' + f(B - z + x, 0) + ' Stück · ' + f(P, 2) + ' € = ' + f(v, 2) + ' €. Die beschädigten Stücke sind in der gezählten Menge enthalten und werden hinzugerechnet.', ['Zwei Mengen sind betroffen: fehlende und unbrauchbare.', 'Menge insgesamt mal Preis.']);
    },
    /* Mängel und Rüge */
    schaden: pq(SCHQ),
    ablauf: R => {
      const c = C(), A = c.ABLAUF, i = c.ri(R, 0, A.length - 2), right = A[i + 1], wrong = c.shuffle(R, A.filter((_, j) => j !== i && j !== i + 1)).slice(0, 3);
      return choiceQ(R, 'Im Übungsablauf bei einer Beanstandung ist der Schritt "' + A[i] + '" erledigt. Welcher Schritt folgt als nächster?', right, wrong, 'Der Übungsablauf lautet: ' + A.map((s, j) => (j + 1) + '. ' + s).join('; ') + '. Nach Schritt ' + (i + 1) + ' folgt: ' + right + '.', ['Denke an den Weg von der Annahme bis zur Entscheidung.', 'Erst sichern und festhalten, dann melden, dann rügen.']);
    },
    frist: R => {
      const c = C(), dow = c.ri(R, 1, 5), n = c.pick(R, [2, 3, 5]), r = c.addWorkdays(dow, n), naive = c.naiveDow(dow, n), right = c.WD[r.dow - 1];
      const wrong = [c.WD[naive - 1]].filter(x => x !== right);
      c.shuffle(R, c.WD).forEach(x => { if (wrong.length < 3 && x !== right && !wrong.includes(x)) wrong.push(x); });
      return choiceQ(R, 'Übungsaufgabe zu Fristen: Die Ware kommt am ' + c.WD[dow - 1] + ' an. Die Übungsfrist für die Rüge beträgt ' + f(n, 0) + ' Werktage (Montag bis Freitag). Der Ankunftstag zählt nicht mit. Bis zu welchem Wochentag muss die Rüge spätestens raus?', right, wrong,
        'Gezählt werden nur Werktage Montag bis Freitag, beginnend am Tag nach der Ankunft: ' + f(n, 0) + ' Werktage nach ' + c.WD[dow - 1] + ' ergeben ' + right + ' (das sind ' + f(r.cal, 0) + ' Kalendertage). Zählst du Samstag und Sonntag mit, kommst du auf ' + c.WD[naive - 1] + '. Die Fristen sind hier nur Übungswerte.', ['Wie viele Werktage hat die Woche?', 'Samstag und Sonntag zählen in dieser Übung nicht.']);
    },
    /* Lagerstrategien */
    slot: R => {
      const c = C(), g = c.ri(R, 5, 12), fa = c.ri(R, 13, 30), e = c.ri(R, 2, 4), s = c.slotStr(g, fa, e);
      return choiceQ(R, 'Ein Lagerplatz heißt "' + s + '". Der Aufbau ist Gang-Fach-Ebene, Ebene 1 liegt ganz unten. Welche Aussage stimmt?', 'Gang ' + g + ', Fach ' + fa + ', Ebene ' + e + ' (von unten gezählt)', ['Gang ' + fa + ', Fach ' + g + ', Ebene ' + e, 'Gang ' + g + ', Fach ' + e + ', Ebene ' + fa, 'Gang ' + e + ', Fach ' + fa + ', Ebene ' + g],
        'Die Platzadresse wird von links nach rechts gelesen: ' + s + ' = Gang ' + g + ', Fach ' + fa + ', Ebene ' + e + '. Die Ebene ist die kleinste Zahl, weil ein Regal nur wenige Ebenen hat.', ['Lies die Zahlen in der Reihenfolge Gang, Fach, Ebene.', 'Wie viele Ebenen hat ein Regal höchstens?']);
    },
    fifo: R => {
      const c = C(), n = c.ri(R, 3, 4), b = mkBatches(R, n, false), st = c.pick(R, ['fifo', 'lifo']), first = c.orderBatches(b, st)[0], S = c.STRATS.find(x => x.k === st);
      return choiceQ(R, 'Im Lager liegen folgende Chargen: ' + batchTxt(b) + '. Es wird nach ' + S.n + ' entnommen. Aus welcher Charge entnimmst du zuerst?', first.id, b.filter(x => x !== first).map(x => x.id),
        S.n + ' bedeutet: ' + S.d + '. Das entscheidende Datum ist hier die Einlagerung. Reihenfolge: ' + c.orderBatches(b, st).map(x => x.id + ' (' + c.dayStr(x.ein) + ')').join(', ') + '. Das Haltbarkeitsdatum spielt bei dieser Strategie keine Rolle.', ['Welches Datum zählt bei dieser Strategie: Einlagerung oder Ablauf?', 'Sortiere die Chargen nach diesem Datum.']);
    },
    fefo: R => {
      const c = C(), n = c.ri(R, 3, 4), b = mkBatches(R, n, true), first = c.orderBatches(b, 'fefo')[0], fi = c.orderBatches(b, 'fifo')[0];
      return choiceQ(R, 'Im Lager liegen folgende Chargen: ' + batchTxt(b) + '. Es wird nach FEFO entnommen. Aus welcher Charge entnimmst du zuerst?', first.id, b.filter(x => x !== first).map(x => x.id),
        'FEFO heißt first expired, first out: zuerst wird entnommen, was zuerst abläuft. ' + first.id + ' läuft am ' + c.dayStr(first.mhd) + ' ab. Nach FIFO wäre ' + fi.id + ' (eingelagert am ' + c.dayStr(fi.ein) + ') dran, aber die läuft erst später ab.', ['Hier zählt das Haltbarkeitsdatum, nicht das Einlagerdatum.', 'Wähle die Charge mit dem frühesten Ablaufdatum.']);
    },
    frei: R => {
      const c = C(), all = c.allSlots(2, 3, 3), occ = c.shuffle(R, all).slice(0, c.ri(R, 7, 10)), next = c.nextFreeSlot(occ, 2, 3, 3), free = all.filter(s => !occ.includes(s) && s !== next);
      return choiceQ(R, 'Bei freier Platzwahl (chaotische Lagerhaltung) vergibt das System den nächsten freien Platz, geordnet nach Gang, dann Fach, dann Ebene (aufsteigend). Alle Plätze haben die Form Gang-Fach-Ebene, es gibt 2 Gänge mit je 3 Fächern und 3 Ebenen. Belegt sind: ' + occ.slice().sort().join(', ') + '. Welchen Platz schlägt das System vor?', next, c.shuffle(R, free).slice(0, 3),
        'Das System prüft die Plätze in der Reihenfolge ' + all.slice(0, 4).join(', ') + ' usw. und nimmt den ersten, der nicht belegt ist: ' + next + '. Die Ware wird dort eingelagert, wo gerade Platz ist; der Platz muss im System gebucht werden, damit sie wiedergefunden wird.', ['Gehe die Plätze der Reihe nach durch.', 'Der erste freie Platz in dieser Reihenfolge zählt.']);
    },
    platz: R => {
      const c = C(); let m, pn;
      for (let t = 0; t < 60; t++) { m = [0, 1, 2].map(() => [0, 1, 2, 3].map(() => c.ri(R, 2, 14))); pn = c.placeNeed(m); if (pn.saving >= 3) break; }
      const nm = ['A', 'B', 'C'], mo = ['Januar', 'Februar', 'März', 'April'];
      return numQ('Drei Artikel werden gelagert (Bestand in Paletten am Monatsende). ' + m.map((r, i) => 'Artikel ' + nm[i] + ': ' + r.map((v, j) => mo[j] + ' ' + f(v, 0)).join(', ')).join('; ') + '. Bei fester Zuordnung bekommt jeder Artikel so viele eigene Plätze wie sein Höchstbestand. Bei freier Platzwahl wird nur der höchste Gesamtbestand eines Monats gebraucht. Wie viele Plätze spart die freie Platzwahl?', pn.saving, 'Plätze', 'Platzersparnis', 0.01,
        'Feste Plätze: Höchstbestand je Artikel ' + m.map(r => f(Math.max.apply(null, r), 0)).join(' + ') + ' = ' + f(pn.fixed, 0) + '. Freie Platzwahl: Gesamtbestand je Monat ' + pn.colSum.map(v => f(v, 0)).join(', ') + ', Höchstwert ' + f(pn.free, 0) + '. Ersparnis: ' + f(pn.fixed, 0) + ' − ' + f(pn.free, 0) + ' = ' + f(pn.saving, 0) + ' Plätze.', ['Rechne zweimal: Summe der Höchstwerte und höchste Monatssumme.', 'Die Höchstbestände treten nicht im selben Monat auf.']);
    },
    /* Kommissionierung */
    ksys: pq(KSQ),
    weg: R => {
      const c = C(), pk = randPicks(R, 4), len = c.routeLength(pk);
      return numQ(KOMMOD + ' Die Pickliste lautet in dieser Reihenfolge: ' + ptxt(pk) + '. Du gehst die Plätze genau in dieser Reihenfolge ab und kehrst zur Basis zurück. Wie lang ist der Weg? (Zwischen Gängen nimmst du den kürzeren Quergang, vorn oder hinten.)', len, 'm', 'Weg', 0.01,
        'Teilstrecken: ' + legTxt(pk) + '. Summe: ' + f(len, 0) + ' m. Im selben Gang zählt der Unterschied der Meterangaben, zwischen Gängen kommen 3 m je Gang dazu plus der kürzere Weg über den vorderen oder hinteren Quergang.', ['Berechne jede Teilstrecke einzeln, auch Basis zum ersten Platz und letzter Platz zur Basis.', 'Zwischen zwei Gängen: Gangabstand plus Weg bis zum Quergang vorn oder hinten, was kürzer ist.']);
    },
    sform: R => {
      const c = C(), k = c.ri(R, 3, 4), aisles = c.shuffle(R, [1, 2, 3, 4, 5, 6]).slice(0, k).sort((a, b) => a - b), pk = [];
      aisles.forEach(a => { const n = c.ri(R, 1, 2); c.shuffle(R, c.LAYOUT.slots).slice(0, n).forEach(p => pk.push({ a, p })); });
      const len = c.sShapeLength(pk), A = c.aislesOf(pk);
      return numQ(KOMMOD + ' Die Pickliste lautet: ' + ptxt(pk) + '. Du läufst nach der S-Form: Jeden Gang mit Positionen durchläufst du ganz (abwechselnd hin und zurück) und gehst zum Schluss zur Basis zurück. Wie lang ist der Weg?', len, 'm', 'Weg', 0.01,
        'Gänge mit Positionen: ' + A.join(', ') + ' (' + A.length + ' Gänge). ' + A.length + ' · 20 m = ' + f(A.length * 20, 0) + ' m für die Gänge, dazu hin und zurück über den Quergang bis Gang ' + A[A.length - 1] + ': 2 · ' + A[A.length - 1] + ' · 3 m = ' + f(2 * A[A.length - 1] * 3, 0) + ' m' + (A.length % 2 ? ', dazu weil du am hinteren Ende endest noch 20 m durch Gang 0 nach vorn' : ' (bei gerader Zahl endest du vorn)') + '. Summe: ' + f(len, 0) + ' m.', ['Zähle die Gänge, in denen etwas zu holen ist. Jeder wird ganz durchlaufen.', 'Bei ungerader Zahl von Gängen endest du hinten und musst durch Gang 0 zurück.']);
    },
    leist: R => {
      const c = C(), weg = c.pick(R, [180, 240, 300, 360, 420]), v = c.pick(R, [1, 1.5, 2]), n = c.pick(R, [12, 15, 20, 24, 30]), tg = c.pick(R, [8, 10, 12]), tb = c.pick(R, [60, 90, 120]), sec = c.pickSeconds(weg, v, n, tg, tb), rate = c.pickRate(n, sec);
      return numQ('Ein Auftrag mit ' + f(n, 0) + ' Positionen: Der Weg ist ' + f(weg, 0) + ' m lang, die Gehgeschwindigkeit beträgt ' + f(v, 1) + ' m/s, für jede Position brauchst du ' + f(tg, 0) + ' s (Greifen und Quittieren). Je Auftrag kommen ' + f(tb, 0) + ' s Basiszeit dazu (Auftrag holen und Ware abgeben). Wie groß ist die Pickleistung in Positionen je Stunde?', rate, 'Positionen/h', 'Pickleistung', 0.1,
        'Gehzeit: ' + f(weg, 0) + ' m / ' + f(v, 1) + ' m/s = ' + f(weg / v, 0) + ' s. Greifzeit: ' + f(n, 0) + ' · ' + f(tg, 0) + ' s = ' + f(n * tg, 0) + ' s. Basiszeit: ' + f(tb, 0) + ' s. Gesamtzeit: ' + f(sec, 0) + ' s. Pickleistung = ' + f(n, 0) + ' / ' + f(sec, 0) + ' s · 3600 = ' + f(rate, 1) + ' Positionen je Stunde.', ['Rechne die Gesamtzeit aus Gehen, Greifen und Basiszeit.', 'Positionen durch Sekunden mal 3600 ergibt Positionen je Stunde.']);
    },
    fehlq: R => {
      const c = C(), A = c.pick(R, [200, 250, 400, 500]), n = c.pick(R, [2, 4, 5]), F = c.ri(R, 3, 19), q = c.errorRate(F, A * n);
      return numQ('In einer Woche wurden ' + f(A, 0) + ' Aufträge mit je ' + f(n, 0) + ' Positionen kommissioniert. Bei ' + f(F, 0) + ' Aufträgen fiel bei der Kontrolle genau eine falsche Position auf. Wie hoch ist die Fehlerquote bezogen auf alle Positionen in Prozent?', q, '%', 'Fehlerquote', 0.01,
        'Alle Positionen: ' + f(A, 0) + ' · ' + f(n, 0) + ' = ' + f(A * n, 0) + '. Falsche Positionen: ' + f(F, 0) + '. Fehlerquote = ' + f(F, 0) + ' / ' + f(A * n, 0) + ' · 100 = ' + f(q, 2) + ' %. Bezogen auf die Aufträge wären es ' + f(c.errorRate(F, A), 2) + ' %, aber gefragt ist die Quote je Position.', ['Worauf bezieht sich die Quote: Aufträge oder Positionen?', 'Falsche Positionen durch alle Positionen mal 100.']);
    },
    buendel: R => {
      const c = C(); let a, b, bs;
      for (let t = 0; t < 60; t++) { a = randPicks(R, c.ri(R, 3, 4)); b = randPicks(R, c.ri(R, 3, 4)); bs = c.bundleSaving([a, b]); if (bs.saving >= 20) break; }
      return numQ(KOMMOD + ' Zwei Aufträge sollen entweder einzeln oder in einem gemeinsamen Rundgang kommissioniert werden. Auftrag 1: ' + ptxt(a) + '. Auftrag 2: ' + ptxt(b) + '. Jeder Rundgang erfolgt nach der S-Form (jeden Gang mit Positionen ganz durchlaufen, zum Schluss zurück zur Basis). Wie viele Meter spart die Bündelung?', bs.saving, 'm', 'Ersparnis', 0.01,
        'Auftrag 1 allein: ' + f(c.sShapeLength(a), 0) + ' m, Auftrag 2 allein: ' + f(c.sShapeLength(b), 0) + ' m, zusammen ' + f(bs.single, 0) + ' m. Gemeinsamer Rundgang über die Gänge ' + c.aislesOf(a.concat(b)).join(', ') + ': ' + f(bs.joint, 0) + ' m. Ersparnis: ' + f(bs.saving, 0) + ' m (' + f(bs.pct, 1) + ' %). Die Meterangaben der Plätze spielen bei der S-Form keine Rolle.', ['Rechne die S-Form dreimal: Auftrag 1, Auftrag 2 und beide zusammen.', 'Beim gemeinsamen Rundgang zählen die Gänge beider Aufträge nur einmal.']);
    },
    /* Flurförderzeuge */
    lsp: R => {
      const c = C(), l = c.pick(R, [800, 1000, 1200, 1400, 1600, 1800]), b = c.pick(R, [600, 800, 1000, 1200].filter(x => x !== l)), h = c.pick(R, [900, 1100, 1300, 1500]), v = c.loadCentre(l);
      return numQ('Eine gleichmäßig gepackte Gitterbox ist ' + f(b, 0) + ' mm breit, ' + f(l, 0) + ' mm tief und ' + f(h, 0) + ' mm hoch. Die Gabel fährt in Richtung der Tiefe ein. Wie groß ist der Lastschwerpunkt (Abstand vom Gabelrücken)?', v, 'mm', 'Lastschwerpunkt', 0.01,
        'Maßgeblich ist das Maß in Gabelrichtung, also die Tiefe von ' + f(l, 0) + ' mm. Bei gleichmäßiger Verteilung liegt der Schwerpunkt in der Mitte: ' + f(l, 0) + ' / 2 = ' + f(v, 0) + ' mm. Breite und Höhe sind hier nicht gefragt.', ['Welches Maß liegt in Gabelrichtung?', 'Der Schwerpunkt liegt in der Mitte dieses Maßes.']);
    },
    pruef: pq(FLQ),
    typ: R => {
      const c = C(), h = c.pick(R, [2500, 3000, 3200, 3900, 4000, 4300, 4900, 5000]), q = c.hubQ(h);
      return numQ('Typenschild eines Übungsstaplers (Lastschwerpunkt 500 mm): ' + HUBTXT() + '. Du willst eine Last mit 500 mm Lastschwerpunkt auf ' + f(h, 0) + ' mm Höhe heben. Wie schwer darf die Last höchstens sein?', q, 'kg', 'Zulässige Last', 0.01,
        'Die Hubhöhe ' + f(h, 0) + ' mm gehört zur Stufe bis ' + f(c.HUB.find(x => h <= x.bis).bis, 0) + ' mm. Dort gilt ' + f(q, 0) + ' kg. Gilt eine Stufe bis zu einer Höhe, so liegt eine Höhe knapp darüber schon in der nächsten Stufe (mit weniger Tragfähigkeit).', ['Finde die Stufe, in der deine Hubhöhe liegt.', 'Eine Höhe knapp über dem Stufenrand gehört zur nächsten Stufe.']);
    },
    rest: R => {
      const c = C(); let Q, l, cc, v;
      for (let t = 0; t < 100; t++) { Q = c.pick(R, [1800, 2100, 2400, 3000, 3500, 4200]); l = c.pick(R, [1200, 1400, 1500, 1600, 2000]); cc = l / 2; v = Q * 500 / cc; if (Number.isInteger(v)) break; }
      return numQ('Ein Stapler darf in der gewählten Hubhöhe bei 500 mm Lastschwerpunkt ' + f(Q, 0) + ' kg heben. Du willst eine Palettenladung aufnehmen, die ' + f(l, 0) + ' mm tief ist (Gabel fährt in Richtung der Tiefe ein, Last gleichmäßig gepackt). Wie viel darf die Ladung bei dieser Hubhöhe höchstens wiegen (Resttragfähigkeit)?', c.restCap(Q, cc), 'kg', 'Resttragfähigkeit', 1,
        'Lastschwerpunkt c = ' + f(l, 0) + ' / 2 = ' + f(cc, 0) + ' mm. Resttragfähigkeit = Nenntragfähigkeit · 500 / c = ' + f(Q, 0) + ' · 500 / ' + f(cc, 0) + ' = ' + f(c.restCap(Q, cc), 0) + ' kg. Je weiter der Schwerpunkt vom Gabelrücken weg ist, desto weniger darf der Stapler heben.', ['Bestimme zuerst den Lastschwerpunkt aus der Tiefe.', 'Tragfähigkeit mal 500 geteilt durch den Lastschwerpunkt.']);
    },
    hebt: R => {
      const c = C(), h = c.pick(R, [2800, 3500, 3900, 4000, 4600, 5000]), l = c.pick(R, [1000, 1200, 1400, 1600, 2000]), cc = l / 2, rest = c.capacity(h, cc);
      let m; if (R() < 0.5) m = Math.max(200, Math.floor(rest * c.ri(R, 70, 95) / 100 / 50) * 50); else m = Math.ceil((rest + 1) / 50) * 50 + 50 * c.ri(R, 0, 2);
      const ok = c.canLift(m, h, cc), Qh = c.hubQ(h);
      return choiceQ(R, 'Typenschild eines Übungsstaplers (Lastschwerpunkt 500 mm): ' + HUBTXT() + '. Du sollst eine gleichmäßig gepackte Last mit ' + f(m, 0) + ' kg auf ' + f(h, 0) + ' mm Höhe heben. Die Last ist ' + f(l, 0) + ' mm tief (Gabel fährt in Richtung der Tiefe ein). Darf der Stapler das heben?',
        ok ? 'Ja, die Last darf gehoben werden' : 'Nein, die Last ist für diese Hubhöhe und diesen Lastschwerpunkt zu schwer', [ok ? 'Nein, die Last ist für diese Hubhöhe und diesen Lastschwerpunkt zu schwer' : 'Ja, die Last darf gehoben werden', 'Das lässt sich ohne das Fahrzeuggewicht nicht beurteilen'],
        'Hubhöhe ' + f(h, 0) + ' mm → Stufe mit ' + f(Qh, 0) + ' kg bei 500 mm. Lastschwerpunkt c = ' + f(l, 0) + ' / 2 = ' + f(cc, 0) + ' mm. Resttragfähigkeit = ' + f(Qh, 0) + ' · 500 / ' + f(cc, 0) + (cc <= 500 ? ' (bei c bis 500 mm gilt die volle Tragfähigkeit)' : '') + ' = ' + f(rest, 0) + ' kg. Last ' + f(m, 0) + ' kg ' + (ok ? 'ist nicht größer: erlaubt.' : 'ist größer: nicht erlaubt.'), ['Bestimme Hubstufe und Lastschwerpunkt.', 'Vergleiche die Last mit der Resttragfähigkeit, nicht mit der Nennlast.']);
    },
    stand: R => {
      const c = C(); let mS, b, e, l, v, cc;
      for (let t = 0; t < 300; t++) { mS = c.pick(R, [3000, 3200, 3600, 4000]); b = c.pick(R, [800, 900, 1000]); e = c.pick(R, [400, 450, 500]); l = c.pick(R, [1000, 1200, 1400, 1600]); cc = l / 2; v = c.tipLoad(mS, b, cc, e); if (Number.isInteger(v)) break; }
      return numQ('Übungsmodell Standsicherheit: Ein Stapler wiegt ' + f(mS, 0) + ' kg, sein Schwerpunkt liegt ' + f(b, 0) + ' mm hinter der Vorderachse. Der Gabelrücken ist ' + f(e, 0) + ' mm von der Vorderachse entfernt. Du nimmst eine gleichmäßig gepackte Last auf, die ' + f(l, 0) + ' mm tief ist (Gabel fährt in Richtung der Tiefe ein). Bei welcher Last wäre der Stapler im Gleichgewicht, kurz vor dem Kippen nach vorn?', v, 'kg', 'Grenzlast', 1,
        'Lastschwerpunkt c = ' + f(l, 0) + ' / 2 = ' + f(cc, 0) + ' mm, Abstand zur Vorderachse = ' + f(cc, 0) + ' + ' + f(e, 0) + ' = ' + f(cc + e, 0) + ' mm. Standmoment = ' + f(mS, 0) + ' · ' + f(b, 0) + '. Gleichgewicht: Last · ' + f(cc + e, 0) + ' = ' + f(mS, 0) + ' · ' + f(b, 0) + ', also Last = ' + f(v, 0) + ' kg. In der Praxis wird nie so nah an die Grenze gegangen, die Tragfähigkeit auf dem Typenschild liegt deutlich darunter.', ['Das Kippmoment der Last muss das Standmoment erreichen.', 'Der Hebelarm der Last ist Lastschwerpunkt plus Abstand Gabelrücken zur Vorderachse.']);
    },
    /* Inventur */
    invv: pq(INVQ),
    dif: R => {
      const c = C(), S = c.ri(R, 20, 300), d = c.ri(R, 1, 9) * (R() < 0.6 ? -1 : 1), I = S + d, art = c.pick(R, c.ARTS);
      return numQ('Im Lagerverwaltungssystem steht für "' + art.n + '" ein Sollbestand von ' + f(S, 0) + ' Stück. Du zählst am Regal ' + f(I, 0) + ' Stück. Wie groß ist die Inventurdifferenz (Istbestand minus Sollbestand)? Ein Fehlbestand wird mit Minus angegeben.', d, 'Stück', 'Differenz', 0.01,
        'Differenz = Ist − Soll = ' + f(I, 0) + ' − ' + f(S, 0) + ' = ' + f(d, 0) + ' Stück. ' + (d < 0 ? 'Es fehlen Stücke (Fehlbestand).' : 'Es sind mehr Stücke da als gebucht (Mehrbestand).'), ['Differenz = Ist minus Soll.', 'Ist weniger da als gebucht, ist das Ergebnis negativ.']);
    },
    diffw: R => {
      const c = C(), as = c.shuffle(R, c.ARTS).slice(0, 3), rows = as.map(a => { const S = c.ri(R, 20, 120), d = c.ri(R, 1, 9) * (R() < 0.5 ? -1 : 1); return { a, S, I: S + d, d, P: a.p }; });
      let sal = rows.reduce((s, r) => s + r.d * r.P, 0); if (Math.abs(sal) < 1) { rows[0].d = 6; rows[0].I = rows[0].S + 6; sal = rows.reduce((s, r) => s + r.d * r.P, 0); }
      return numQ('Differenzliste mit drei Artikeln (Soll, Ist, Einkaufspreis je Stück): ' + rows.map(r => '"' + r.a.n + '": ' + f(r.S, 0) + ' / ' + f(r.I, 0) + ' / ' + f(r.P, 2) + ' €').join('; ') + '. Wie hoch ist der Saldo der Differenzen in Euro (Mehrbestand als Plus, Fehlbestand als Minus)?', sal, '€', 'Saldo', 0.01,
        rows.map(r => f(r.I, 0) + ' − ' + f(r.S, 0) + ' = ' + f(r.d, 0) + ' Stück · ' + f(r.P, 2) + ' € = ' + f(r.d * r.P, 2) + ' €').join('; ') + '. Saldo = ' + f(sal, 2) + ' €. Mehr- und Fehlbestände heben sich teilweise auf, deshalb zeigt der Saldo allein nicht, wie viel Wert falsch gebucht war.', ['Rechne je Artikel (Ist − Soll) · Preis.', 'Zähle die Ergebnisse mit Vorzeichen zusammen.']);
    },
    stich: R => {
      const c = C(), z = c.ri(R, 40, 200) * 10, zu = c.ri(R, 2, 12) * 5, ab = c.ri(R, 2, 12) * 5, v = c.stichtagBestand(z, zu, ab, true);
      return numQ('Stichtag der Inventur ist der 31. Dezember. Die Zählung findet erst am 3. Januar statt und ergibt ' + f(z, 0) + ' Stück. Zwischen dem Stichtag und der Zählung wurden ' + f(zu, 0) + ' Stück eingelagert (Zugang) und ' + f(ab, 0) + ' Stück ausgelagert (Abgang). Wie groß war der Bestand am Stichtag?', v, 'Stück', 'Bestand am Stichtag', 0.01,
        'Du musst von der Zählung zurückrechnen: Zugang nach dem Stichtag war am 31. Dezember noch nicht da, also abziehen; Abgang nach dem Stichtag war am 31. Dezember noch da, also dazuzählen. ' + f(z, 0) + ' − ' + f(zu, 0) + ' + ' + f(ab, 0) + ' = ' + f(v, 0) + ' Stück.', ['Was war am Stichtag noch nicht da, was war noch da?', 'Zugang abziehen, Abgang addieren.']);
    },
    stichpr: R => {
      const c = C(), n = c.pick(R, [20, 25, 50]), N = c.pick(R, [500, 1000, 2000]), S = c.ri(R, 4, 40) * 10, v = c.extrapolate(S, n, N);
      return numQ('Von ' + f(N, 0) + ' Artikeln werden ' + f(n, 0) + ' zufällig ausgewählt und gezählt. Die Fehlbestände der Stichprobe haben zusammen einen Wert von ' + f(S, 0) + ' €. Auf welchen Betrag rechnest du die Fehlbestände aller Artikel hoch?', v, '€', 'Hochrechnung', 0.01,
        'Je Artikel der Stichprobe: ' + f(S, 0) + ' € / ' + f(n, 0) + ' = ' + f(S / n, 2) + ' €. Hochgerechnet auf ' + f(N, 0) + ' Artikel: ' + f(S / n, 2) + ' € · ' + f(N, 0) + ' = ' + f(v, 2) + ' €. Das ist nur ein Schätzwert.', ['Wie hoch ist der Fehlbestand im Durchschnitt je gezähltem Artikel?', 'Multipliziere mit der Zahl aller Artikel.']);
    },
    /* Versand und Frachtpapiere */
    papier: pq(PAPQ),
    etik: R => {
      const c = C(), pal = c.ri(R, 2, 4), kart = c.ri(R, 3, 8), gb = c.ri(R, 1, 3), kp = pal * c.ri(R, 10, 20), n = c.packCount(pal, kart, gb);
      return numQ('Eine Sendung wird vorbereitet: ' + f(pal, 0) + ' Paletten (auf den Paletten stehen zusammen ' + f(kp, 0) + ' Kartons, fest mit Folie gesichert), ' + f(kart, 0) + ' einzeln versendete Kartons und ' + f(gb, 0) + ' Gitterboxen. Jedes Packstück bekommt ein eigenes Versandetikett. Wie viele Etiketten brauchst du?', n, 'Etiketten', 'Anzahl Etiketten', 0.01,
        'Packstücke sind die Paletten, die einzeln versendeten Kartons und die Gitterboxen: ' + f(pal, 0) + ' + ' + f(kart, 0) + ' + ' + f(gb, 0) + ' = ' + f(n, 0) + '. Die Kartons auf den Paletten gehören zum Packstück Palette und zählen nicht einzeln.', ['Was wird am Ende wirklich als eigene Einheit verschickt?', 'Kartons auf einer Palette sind kein eigenes Packstück.']);
    },
    gurt: R => {
      const c = C(), dims = c.shuffle(R, [c.pick(R, [70, 80, 90, 100, 110]), c.pick(R, [40, 50, 60]), c.pick(R, [20, 30])]);
      const [h, b, t] = dims, g = c.girth(t, b, h), lg = c.longest(t, b, h), sm = dims.reduce((a, x) => a + x, 0) - lg;
      return numQ('Ein Paket hat folgende Maße: Höhe ' + f(h, 0) + ' cm, Breite ' + f(b, 0) + ' cm, Tiefe ' + f(t, 0) + ' cm. Wie groß ist das Gurtmaß (längste Seite plus zweimal die Summe der beiden anderen Seiten)?', g, 'cm', 'Gurtmaß', 0.01,
        'Die längste Seite ist ' + f(lg, 0) + ' cm (das ist nicht immer die zuerst genannte). Die beiden anderen Seiten: ' + f(sm, 0) + ' cm. Gurtmaß = ' + f(lg, 0) + ' + 2 · ' + f(sm, 0) + ' = ' + f(g, 0) + ' cm.', ['Suche zuerst die längste Seite.', 'Gurtmaß = längste Seite + 2 · (Summe der anderen beiden).']);
    },
    versand: R => {
      const c = C(), P = c.PAKET; let l, b, h, kg;
      const bad = c.pick(R, ['girth', 'long', 'kg', 'none', 'none']);
      l = c.ri(R, 5, 11) * 10; b = c.ri(R, 3, 6) * 10; h = c.ri(R, 2, 5) * 10; kg = c.ri(R, 5, 25);
      if (bad === 'long') { l = 130 + c.ri(R, 0, 3) * 10; b = 30; h = 20; kg = c.ri(R, 5, 20); }
      else if (bad === 'girth') { l = 110; b = 70 + c.ri(R, 0, 3) * 10; h = 50 + c.ri(R, 0, 2) * 10; kg = c.ri(R, 5, 25); }
      else if (bad === 'kg') { kg = 32 + c.ri(R, 0, 8); }
      const chk = c.parcelCheck(l, b, h, kg), mode = c.shipMode({ l, b, h, kg, pal: 0 });
      return choiceQ(R, 'Übungsregel: Ein Paket darf höchstens ' + f(P.kgMax, 1) + ' kg wiegen, die längste Seite höchstens ' + f(P.longMax, 0) + ' cm lang und das Gurtmaß höchstens ' + f(P.girthMax, 0) + ' cm sein. Alles andere geht als Stückgut mit Spedition. Eine Sendung ist ' + f(l, 0) + ' cm lang, ' + f(b, 0) + ' cm breit und ' + f(h, 0) + ' cm hoch und wiegt ' + f(kg, 1) + ' kg (keine Palette). Welche Versandart wählst du?',
        c.MODE_NAMES[mode], [c.MODE_NAMES[mode === 'paket' ? 'stueck' : 'paket'], c.MODE_NAMES.komplett, 'Versand ist nicht möglich'],
        'Längste Seite ' + f(chk.longest, 0) + ' cm (' + (chk.okLong ? 'passt' : 'zu lang') + '), Gurtmaß ' + f(chk.longest, 0) + ' + 2 · ' + f(l + b + h - chk.longest, 0) + ' = ' + f(chk.girth, 0) + ' cm (' + (chk.okGirth ? 'passt' : 'zu groß') + '), Gewicht ' + f(kg, 1) + ' kg (' + (chk.okKg ? 'passt' : 'zu schwer') + '). ' + (chk.ok ? 'Alle drei Grenzen sind eingehalten: Paketversand.' : 'Mindestens eine Grenze ist verletzt: Stückgutversand.'), ['Prüfe alle drei Grenzen einzeln.', 'Das Gurtmaß musst du selbst ausrechnen.']);
    },
    fracht: R => {
      const c = C(), l = 120, b = 80, h = c.pick(R, [60, 80, 100, 120, 140]), vol = c.volKg(l, b, h), kg = c.pick(R, [90, 120, 150, 180, 220, 260]), bw = c.billWeight(kg, vol), p = c.freight(bw), pct = c.pick(R, [10, 12, 15]), tot = c.withSurcharge(p, pct);
      return numQ('Eine Palette (' + f(l, 0) + ' cm × ' + f(b, 0) + ' cm × ' + f(h, 0) + ' cm) wiegt ' + f(kg, 0) + ' kg. Abgerechnet wird das größere von tatsächlichem Gewicht und Raumgewicht (1 m³ gilt als ' + f(c.RAUM, 0) + ' kg, Raumgewicht auf ganze kg aufrunden). Tarif (Übungswerte): ' + c.TARIF.map(t => 'bis ' + f(t.bis, 0) + ' kg ' + f(t.p, 0) + ' €').join(', ') + '. Dazu kommt ein Zuschlag von ' + f(pct, 0) + ' % auf die Fracht. Wie hoch sind die Frachtkosten insgesamt?', tot, '€', 'Frachtkosten', 0.01,
        'Raumgewicht: ' + f(l / 100 * b / 100 * h / 100, 3) + ' m³ · ' + f(c.RAUM, 0) + ' kg = ' + f(l * b * h / 1e6 * c.RAUM, 2) + ' → ' + f(vol, 0) + ' kg. Abrechnungsgewicht: größer von ' + f(kg, 0) + ' kg und ' + f(vol, 0) + ' kg = ' + f(bw, 0) + ' kg. Tarifstufe bis ' + f(c.TARIF.find(t => bw <= t.bis).bis, 0) + ' kg: ' + f(p, 2) + ' €. Mit ' + f(pct, 0) + ' % Zuschlag: ' + f(p, 2) + ' € · ' + f(1 + pct / 100, 2) + ' = ' + f(tot, 2) + ' €.', ['Rechne das Raumgewicht aus und vergleiche es mit dem Istgewicht.', 'Das größere Gewicht bestimmt die Tarifstufe.'])
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator, Argument */
  const defs = [
    ['Wareneingangsprüfung', 1, 'Lieferschein und Zählung', 'fehl'], ['Wareneingangsprüfung', 1, 'Befund einordnen', 'befund'], ['Wareneingangsprüfung', 2, 'Teillieferungen', 'teil'], ['Wareneingangsprüfung', 3, 'Wert der Abweichung', 'wert'],
    ['Mängel und Rüge', 1, 'Schaden bei der Anlieferung', 'schaden'], ['Mängel und Rüge', 2, 'Ablauf nach dem Befund', 'ablauf'], ['Mängel und Rüge', 3, 'Letzter Tag der Frist', 'frist'],
    ['Lagerstrategien', 1, 'Platzadresse lesen', 'slot'], ['Lagerstrategien', 1, 'Entnahme nach Einlagerung', 'fifo'], ['Lagerstrategien', 2, 'Entnahme nach Ablaufdatum', 'fefo'], ['Lagerstrategien', 2, 'Nächster freier Platz', 'frei'], ['Lagerstrategien', 3, 'Plätze fest oder frei', 'platz'],
    ['Kommissionierung', 1, 'Kommissioniersystem erkennen', 'ksys'], ['Kommissionierung', 2, 'Weg der Pickliste', 'weg'], ['Kommissionierung', 2, 'Weg durch die Gänge', 'sform'], ['Kommissionierung', 2, 'Pickleistung berechnen', 'leist'], ['Kommissionierung', 3, 'Fehlerquote berechnen', 'fehlq'], ['Kommissionierung', 3, 'Aufträge zusammenlegen', 'buendel'],
    ['Flurförderzeuge', 1, 'Lastschwerpunkt bestimmen', 'lsp'], ['Flurförderzeuge', 1, 'Vor Fahrtantritt', 'pruef'], ['Flurförderzeuge', 2, 'Typenschild lesen', 'typ'], ['Flurförderzeuge', 2, 'Tragfähigkeit bei langer Last', 'rest'], ['Flurförderzeuge', 3, 'Darf die Last hoch', 'hebt'], ['Flurförderzeuge', 3, 'Grenze der Standsicherheit', 'stand'],
    ['Inventur', 1, 'Inventur beschreiben', 'invv'], ['Inventur', 1, 'Zählergebnis und Buchbestand', 'dif'], ['Inventur', 2, 'Wert der Differenzliste', 'diffw'], ['Inventur', 2, 'Bestand am Stichtag', 'stich'], ['Inventur', 3, 'Von der Stichprobe aufs Ganze', 'stichpr'],
    ['Versand und Frachtpapiere', 1, 'Papier zuordnen', 'papier'], ['Versand und Frachtpapiere', 1, 'Etiketten zur Sendung', 'etik'], ['Versand und Frachtpapiere', 2, 'Gurtmaß berechnen', 'gurt'], ['Versand und Frachtpapiere', 2, 'Paket oder Spedition', 'versand'], ['Versand und Frachtpapiere', 3, 'Frachtkosten berechnen', 'fracht']
  ];
  const tasks = defs.map((d, i) => ({ id: 'wfl' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('wfl-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Zuordnungs-Sätze für den Reiter Begriffe ---------- */
  /* g = Gruppe (Antwortoptionen kommen aus derselben Gruppe), n = Begriff, d = Beschreibung (Frage), pts = Merkpunkte */
  const SETS = {
    we: { title: 'Wareneingang und Mängel', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Befunde', n: 'Mengenabweichung', d: 'Es kommt mehr oder weniger Ware an, als bestellt bzw. auf dem Lieferschein angegeben ist.', pts: ['Unterlieferung oder Überlieferung', 'Immer selbst nachzählen'] },
      { g: 'Befunde', n: 'Transportschaden', d: 'Die Verpackung ist beschädigt (eingedrückt, nass, aufgerissen) und die Ware ist beim Transport zu Schaden gekommen.', pts: ['Sofort vermerken, solange der Fahrer da ist', 'Fotos machen'] },
      { g: 'Befunde', n: 'Qualitätsmangel', d: 'Die Verpackung ist heil, aber die Ware selbst ist fehlerhaft (z. B. Maße falsch, Oberfläche beschädigt).', pts: ['Mangel an der Ware', 'Oft erst bei der Prüfung zu erkennen'] },
      { g: 'Befunde', n: 'Falschlieferung', d: 'Es wurde ein anderer Artikel geliefert als bestellt, oft mit ähnlicher Artikelnummer.', pts: ['Artikelnummer genau vergleichen', 'Nicht einlagern, sperren'] },
      { g: 'Ablauf', n: 'Wareneingangsprüfung', d: 'Der Lieferschein wird gegen die Bestellung geprüft, die Ware gezählt und auf Schäden untersucht.', pts: ['Art, Menge, Zustand', 'Lieferschein ist nur eine Angabe des Lieferers'] },
      { g: 'Ablauf', n: 'Tatbestandsaufnahme', d: 'Festhalten, was wann wo festgestellt wurde: Fotos, Mengen, Datum, Uhrzeit, Namen der Beteiligten.', pts: ['Beleg für die spätere Klärung', 'Ware nicht verändern'] },
      { g: 'Ablauf', n: 'Mängelrüge', d: 'Meldung an den Lieferer, dass die Ware Mängel hat, nach dem Ablauf deines Betriebs und innerhalb der Frist.', pts: ['Nur als Ablauf im Lab', 'Fristen im Lab sind Übungswerte'] },
      { g: 'Ablauf', n: 'Sperren der Ware', d: 'Beanstandete Ware wird getrennt und gekennzeichnet gelagert, bis über Nachlieferung, Gutschrift oder Rücksendung entschieden ist.', pts: ['Verwechslung vermeiden', 'Kennzeichnung gut sichtbar'] }
    ] },
    lag: { title: 'Lagerstrategien', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Entnahme', n: 'FIFO', d: 'Zuerst eingelagerte Ware wird zuerst entnommen (first in, first out).', pts: ['Das Einlagerdatum zählt', 'Für Ware mit Alterung, wenn kein Ablaufdatum bekannt ist'] },
      { g: 'Entnahme', n: 'LIFO', d: 'Zuletzt eingelagerte Ware wird zuerst entnommen (last in, first out).', pts: ['Typisch bei Blocklagerung', 'Nicht für verderbliche Ware'] },
      { g: 'Entnahme', n: 'FEFO', d: 'Ware mit dem frühesten Ablaufdatum wird zuerst entnommen (first expired, first out).', pts: ['Das Ablaufdatum zählt, nicht das Einlagerdatum', 'Wichtig bei Lebensmitteln, Klebstoffen, Chemie'] },
      { g: 'Platzvergabe', n: 'Feste Lagerplätze', d: 'Jeder Artikel hat seinen eigenen, festen Platz und wird immer dort gelagert.', pts: ['Einfach zu finden', 'Braucht Platz für den Höchstbestand je Artikel'] },
      { g: 'Platzvergabe', n: 'Chaotische Lagerhaltung', d: 'Das System vergibt bei der Einlagerung einen freien Platz; Ware kann überall liegen und wird per Platzbuchung gefunden.', pts: ['Spart Platz', 'Ohne Lagerverwaltungssystem nicht möglich'] },
      { g: 'Platzvergabe', n: 'Platzadresse', d: 'Eindeutige Bezeichnung eines Lagerplatzes aus Gang, Fach und Ebene (z. B. 07-14-3).', pts: ['Immer in derselben Reihenfolge lesen', 'Ebene 1 liegt unten'] },
      { g: 'Platzvergabe', n: 'Nächster-freier-Platz-Strategie', d: 'Die Ware wird auf dem ersten freien Platz in einer festgelegten Reihenfolge eingelagert.', pts: ['Eine Variante der freien Platzvergabe', 'Reihenfolge ist vorher festgelegt'] }
    ] },
    kom: { title: 'Kommissionierung', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Systeme', n: 'Mann-zur-Ware', d: 'Der Kommissionierer geht zu den Lagerplätzen und entnimmt die Ware, die am Platz bleibt.', pts: ['Wege der Person sind lang', 'Typisch bei Regallagern'] },
      { g: 'Systeme', n: 'Ware-zum-Mann', d: 'Die Ware wird automatisch an eine feste Station gebracht, der Kommissionierer bleibt stehen.', pts: ['Kaum Gehwege', 'Anlage kostet viel Geld'] },
      { g: 'Systeme', n: 'Einzelauftrag', d: 'Jeder Kundenauftrag wird für sich in einem eigenen Rundgang kommissioniert.', pts: ['Kein Aufteilen nötig', 'Mehr Wege bei vielen kleinen Aufträgen'] },
      { g: 'Systeme', n: 'Auftragsbündelung', d: 'Mehrere Aufträge werden zusammen in einem Rundgang gesammelt und anschließend den Aufträgen zugeteilt.', pts: ['Spart Wege', 'Aufteilen kostet Zeit'] },
      { g: 'Hilfsmittel', n: 'Pickliste auf Papier', d: 'Ausgedruckte Liste, die in der Reihenfolge der Plätze abgearbeitet und abgehakt wird.', pts: ['Günstig', 'Lesefehler möglich'] },
      { g: 'Hilfsmittel', n: 'Pick-by-Voice', d: 'Anweisung und Bestätigung laufen über Sprache und Kopfhörer, die Hände sind frei.', pts: ['Hände und Augen frei', 'Einarbeitung nötig'] },
      { g: 'Hilfsmittel', n: 'Pick-by-Light', d: 'Eine Leuchtanzeige am Regalfach zeigt Platz und Menge, die Entnahme wird per Taste quittiert.', pts: ['Schnell und fehlerarm', 'Regal muss mit Anzeigen ausgestattet sein'] },
      { g: 'Kennzahlen und Wege', n: 'Pickleistung', d: 'Anzahl der Positionen, die ein Kommissionierer in einer Stunde schafft.', pts: ['Positionen je Stunde', 'Zeit aus Gehen, Greifen und Basiszeit'] },
      { g: 'Kennzahlen und Wege', n: 'Fehlerquote', d: 'Anteil der falsch kommissionierten Positionen an allen Positionen in Prozent.', pts: ['Falsche durch alle Positionen', 'Positionen, nicht Aufträge'] },
      { g: 'Kennzahlen und Wege', n: 'S-Form', d: 'Wegstrategie, bei der jeder Gang mit Positionen ganz und abwechselnd hin und zurück durchlaufen wird.', pts: ['Auch Schleifenstrategie genannt', 'Einfach und gut für viele Positionen'] },
      { g: 'Kennzahlen und Wege', n: 'Stichstrategie', d: 'Wegstrategie, bei der jeder Gang von vorn bis zum hintersten Platz und zurück gegangen wird.', pts: ['Gut bei wenigen Positionen je Gang', 'Wege nur im vorderen Quergang'] }
    ] },
    flur: { title: 'Flurförderzeuge', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Begriffe', n: 'Lastschwerpunkt', d: 'Abstand des Lastschwerpunkts vom Gabelrücken; bei gleichmäßiger Last die halbe Tiefe in Gabelrichtung.', pts: ['In mm angegeben', 'Je größer, desto weniger darf gehoben werden'] },
      { g: 'Begriffe', n: 'Nenntragfähigkeit', d: 'Die auf dem Typenschild angegebene Last, die der Stapler bei Nenn-Lastschwerpunkt heben darf.', pts: ['Gilt nur bei dem angegebenen Lastschwerpunkt', 'Hubhöhe beachten'] },
      { g: 'Begriffe', n: 'Resttragfähigkeit', d: 'Die verbleibende zulässige Last, wenn der Lastschwerpunkt größer ist als der Nennwert.', pts: ['Im Lab: Q · 500 / c', 'Verbindlich ist das Traglastdiagramm'] },
      { g: 'Begriffe', n: 'Traglastdiagramm', d: 'Diagramm am Stapler, das die zulässige Last für verschiedene Lastschwerpunkte und Hubhöhen zeigt.', pts: ['Gehört zum Typenschild', 'Muss lesbar sein'] },
      { g: 'Begriffe', n: 'Standsicherheit', d: 'Fähigkeit des Staplers, nicht zu kippen; Standmoment gegen Kippmoment der Last.', pts: ['Last tief tragen', 'Mast zurückneigen'] },
      { g: 'Vor und beim Fahren', n: 'Prüfung vor Fahrtantritt', d: 'Sicht- und Funktionsprüfung nach Betriebsanweisung, z. B. Reifen, Gabelzinken, Hydraulik, Bremse, Hupe.', pts: ['Mängel melden', 'Bei sicherheitsrelevanten Mängeln sperren'] },
      { g: 'Vor und beim Fahren', n: 'Fahrerlaubnis', d: 'Pflicht: Fahren dürfen nur unterwiesene, befähigte und vom Unternehmer beauftragte Personen.', pts: ['Im Lab nur als Pflicht genannt', 'Einzelheiten regelt dein Betrieb'] },
      { g: 'Vor und beim Fahren', n: 'Last tragen', d: 'Während der Fahrt wird die Last möglichst niedrig und mit zurückgeneigtem Mast getragen.', pts: ['Schwerpunkt bleibt tief', 'Sicht nach vorn beachten'] },
      { g: 'Vor und beim Fahren', n: 'Stapler sperren', d: 'Bei einem sicherheitsrelevanten Mangel wird der Stapler nicht benutzt, gekennzeichnet und gemeldet.', pts: ['Nicht selbst reparieren', 'Meldung nach betrieblichem Ablauf'] }
    ] },
    inv: { title: 'Inventur', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Verfahren', n: 'Stichtagsinventur', d: 'Alle Bestände werden an einem festen Tag gezählt, das Lager ruht dabei meist.', pts: ['Ein Tag für alles', 'Hoher Zählaufwand auf einmal'] },
      { g: 'Verfahren', n: 'Permanente Inventur', d: 'Die Artikel werden laufend über das Jahr gezählt, jeder mindestens einmal.', pts: ['Lager muss nicht stillstehen', 'Gute Bestandsführung nötig'] },
      { g: 'Verfahren', n: 'Stichprobeninventur', d: 'Nur ein zufälliger Teil der Artikel wird gezählt, das Ergebnis wird hochgerechnet.', pts: ['Schätzung', 'Weniger Zählaufwand'] },
      { g: 'Begriffe', n: 'Sollbestand', d: 'Der im Lagerverwaltungssystem gebuchte Bestand (Buchbestand).', pts: ['Wird bei der Blindzählung nicht angezeigt', 'Buchbestand'] },
      { g: 'Begriffe', n: 'Istbestand', d: 'Der tatsächlich gezählte Bestand am Lagerplatz.', pts: ['Zählergebnis', 'Zweitzählung bei Abweichung'] },
      { g: 'Begriffe', n: 'Inventurdifferenz', d: 'Unterschied zwischen Istbestand und Sollbestand, bei Fehlbestand negativ.', pts: ['Ist minus Soll', 'Mehr- oder Fehlbestand'] },
      { g: 'Begriffe', n: 'Differenzliste', d: 'Liste der Artikel, bei denen Soll und Ist nicht übereinstimmen, mit Menge und Wert.', pts: ['Grundlage für Nachzählung', 'Zeigt Ursachen suchen'] },
      { g: 'Begriffe', n: 'Blindzählung', d: 'Der Zähler kennt den Sollbestand nicht, damit er ihn nicht unbewusst übernimmt.', pts: ['Neutral zählen', 'Mehr Ehrlichkeit im Ergebnis'] },
      { g: 'Begriffe', n: 'Bestandsdifferenz buchen', d: 'Nach Klärung und Freigabe wird der Buchbestand im System an den Istbestand angepasst (nur der Begriff).', pts: ['Freigabe vorher', 'Im Lab keine Buchungssätze'] }
    ] },
    ver: { title: 'Versand und Frachtpapiere', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Papiere', n: 'Lieferschein', d: 'Begleitet die Ware und nennt Art und Menge der gesamten Lieferung; Grundlage der Wareneingangsprüfung.', pts: ['Wird gegen die Bestellung geprüft', 'Angabe des Lieferers'] },
      { g: 'Papiere', n: 'Frachtbrief', d: 'Nachweis des Beförderungsvertrags zwischen Absender und Frachtführer.', pts: ['Gehört zur Beförderung', 'International z. B. CMR (nur nennen)'] },
      { g: 'Papiere', n: 'Packliste', d: 'Beschreibt den Inhalt jedes einzelnen Packstücks mit Maßen und Gewichten.', pts: ['Je Packstück', 'Hilft beim Auspacken'] },
      { g: 'Maße und Kennzeichnung', n: 'Gurtmaß', d: 'Längste Seite plus zweimal die Summe der beiden anderen Seiten eines Pakets.', pts: ['Grenze je Paketdienst', 'In cm'] },
      { g: 'Maße und Kennzeichnung', n: 'Packstück-Kennzeichnung', d: 'Etikett mit Empfänger, Absender, laufender Nummer (z. B. 3/7), Gewicht und Handhabungshinweisen.', pts: ['Jedes Packstück bekommt eines', 'Zeigt, ob etwas fehlt'] },
      { g: 'Maße und Kennzeichnung', n: 'Raumgewicht', d: 'Umrechnung des Volumens in ein Gewicht (im Lab 200 kg je m³); abgerechnet wird das größere von Raum- und Istgewicht.', pts: ['Leichte, große Sendungen werden nach Raum bezahlt', 'Zahl im Lab ist Übungswert'] },
      { g: 'Maße und Kennzeichnung', n: 'Versandart', d: 'Wahl zwischen Paket, Stückgut (Spedition) und Komplettladung nach Maßen, Gewicht und Palettenzahl.', pts: ['Schwellen im Lab sind Übungswerte', 'Alle Grenzen einzeln prüfen'] }
    ] }
  };

  /* ---------- Beispiele (fertig durchgerechnet; die Rechenschritte entstehen im UI aus WFL_CORE) ---------- */
  const examples = [
    { id: 'we1', tab: 'we', title: 'Lieferung gegen Bestellung prüfen', text: 'Fünf Zeilen: Lieferschein, Bestellung und Zählung abgleichen. Hier ist die Musterlösung mit den Befunden und dem Ablauf.', p: { seed: 'bsp1' } },
    { id: 'fefo1', tab: 'lag', title: 'FEFO statt FIFO', text: 'Drei Chargen, 55 Stück werden gebraucht. Nach FIFO wäre die älteste Charge dran, nach FEFO die, die zuerst abläuft.', p: { kind: 'ent', rows: [{ id: 'Charge A', ein: 40, mhd: 230, qty: 30 }, { id: 'Charge B', ein: 75, mhd: 150, qty: 40 }, { id: 'Charge C', ein: 110, mhd: 300, qty: 50 }], q: 55, strat: 'fefo' } },
    { id: 'platz1', tab: 'lag', title: 'Feste Plätze oder freie Platzwahl', text: 'Drei Artikel, vier Monate. Wie viele Palettenplätze braucht man bei fester Zuordnung und wie viele bei freier Platzwahl?', p: { kind: 'platz', m: [[8, 12, 5, 9], [3, 4, 10, 6], [6, 2, 3, 11]] } },
    { id: 'kom1', tab: 'kom', title: 'Pickliste ablaufen', text: 'Vier Plätze in der Reihenfolge der Liste, dann in S-Form-Reihenfolge und in der kürzesten Reihenfolge. Wie viele Meter spart die Wegoptimierung?', p: { kind: 'route', picks: [[3, 10], [1, 6], [5, 14], [2, 18]] } },
    { id: 'kom2', tab: 'kom', title: 'Pickleistung und Fehlerquote', text: 'Ein Auftrag mit 15 Positionen, 240 m Weg, 1,5 m/s, 10 s je Position, 90 s Basiszeit; bei 400 kontrollierten Positionen waren 3 falsch.', p: { kind: 'leist', weg: 240, v: 1.5, n: 15, tg: 10, tb: 90, err: 3, tot: 400 } },
    { id: 'trag1', tab: 'trag', title: 'Lange Palette: Resttragfähigkeit', text: 'Eine 1.600 mm tiefe Last mit 1.600 kg soll auf 3.500 mm Höhe. Das Typenschild sagt 2.100 kg bei 500 mm Lastschwerpunkt in dieser Höhe.', p: { m: 1600, l: 1600, h: 3500, mS: 3600, b: 900, e: 450 } },
    { id: 'trag2', tab: 'trag', title: 'Kurze Palette, große Höhe', text: 'Eine 1.200 mm tiefe Last mit 1.500 kg soll auf 4.500 mm Höhe. Passt das, und wie weit ist der Stapler vom Kippen entfernt?', p: { m: 1500, l: 1200, h: 4500, mS: 3600, b: 900, e: 450 } },
    { id: 'inv1', tab: 'inv', title: 'Differenzliste auswerten', text: 'Sechs Artikel mit Sollbestand, Zählung und Preis. Wie groß sind Mehr- und Fehlbestand, und wie viele Artikel weichen ab?', p: { kind: 'diff', rows: [{ n: 'Schrauben M8 (100er-Pack)', soll: 120, ist: 118, p: 4.5 }, { n: 'Kugellager 6204', soll: 60, ist: 60, p: 4.5 }, { n: 'Dichtring 40 x 52', soll: 300, ist: 312, p: 1.2 }, { n: 'Netzteil 24 V', soll: 25, ist: 22, p: 21.4 }, { n: 'Kabelbinder 300 mm', soll: 80, ist: 80, p: 3.1 }, { n: 'Hydraulikschlauch 2 m', soll: 18, ist: 17, p: 18.5 }] } },
    { id: 'inv2', tab: 'inv', title: 'Bestand am Stichtag zurückrechnen', text: 'Gezählt wurde erst am 3. Januar. Wie groß war der Bestand am Stichtag 31. Dezember, wenn danach Zugänge und Abgänge gebucht wurden?', p: { kind: 'stich', z: 1250, zu: 40, ab: 65 } },
    { id: 'ver1', tab: 'ver', title: 'Paket oder Spedition?', text: 'Sendung 110 cm × 70 cm × 50 cm mit 18 kg. Die Übungsgrenzen für Pakete werden geprüft.', p: { l: 110, b: 70, h: 50, kg: 18, pal: 0, pct: 10 } },
    { id: 'ver2', tab: 'ver', title: 'Frachtkosten einer Palette', text: 'Palette 120 cm × 80 cm × 100 cm mit 150 kg, Raumgewicht 200 kg je m³, Tarif nach Gewichtsstufen und 10 % Zuschlag.', p: { l: 120, b: 80, h: 100, kg: 150, pal: 1, pct: 10 } }
  ];

  root.WFL_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sets: SETS, pools: { BEF, SCHQ, KSQ, FLQ, INVQ, PAPQ } };
  root.WFL_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.WFL_DATA, TASKS: root.WFL_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
