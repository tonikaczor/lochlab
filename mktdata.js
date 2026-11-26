'use strict';
/* Tonfunk Marketing-Lab: Daten (Aufgaben-Generatoren, Zuordnungs-Sätze).
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronik für Haus und Garten), Produkte frei erfunden.
   window.MKT_DATA  { cats, tasks, gens, make, makeTask, randomQ, sets }
   window.MKT_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'mkt', Status in localStorage 'lm4.mkt.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id); der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage hat steps ("So gehst du vor"), tips (Stufe 2 = Lösungsweg mit Formel) und expl (Lösungsweg nach dem Prüfen).
   Rechtliche Aussagen sind bewusst einfach gehalten und keine Rechtsberatung; offene Punkte stehen in quelle/mkt/PRUEFEN.md. */
(function (root) {
  const C = () => root.MKT_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Marktforschung', 'Marketing-Mix, Lebenszyklus und Portfolio', 'Preispolitik', 'Kommunikation und Werbeerfolg', 'Recht im Marketing'];
  const MB = 'Im Modellbetrieb (Elektronik für Haus und Garten, Übungswerte): ';

  const numQ = (text, steps, value, unit, label, tol, expl, tips) => ({ text, steps, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, steps, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, steps, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const pickI = (R, arg, n) => ((arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, n - 1));
  /* Pool-Frage: [Text, richtig, falsch[], Erklärung, Tipps]; arg = Liste erlaubter Einträge (feste Aufgabe) */
  const pq = (POOL, steps) => (R, arg) => { const q = POOL[pickI(R, arg, POOL.length)]; return choiceQ(R, q[0], steps, q[1], q[2], q[3], q[4]); };
  /* Fall-Frage: [Fall, Index der richtigen Kategorie, Erklärung]; NAMES = Kategorien */
  const cq = (CASES, NAMES, ask, steps, tips) => (R, arg) => { const e = CASES[pickI(R, arg, CASES.length)]; return choiceQ(R, MB + e[0] + ' ' + ask, steps, NAMES[e[1]], NAMES.filter((_, i) => i !== e[1]), e[2], tips); };

  /* ---------- Fälle und Pools ---------- */
  const ART = ['Primärforschung (eigene, neue Erhebung)', 'Sekundärforschung (vorhandene Daten auswerten)', 'Keine Marktforschung, sondern Werbung'];
  const artE = [
    ['Der Betrieb befragt 300 Kunden im eigenen Webshop mit einem Fragebogen zur Wetterstation WS-6.', 0, 'Die Daten werden extra für diese Frage neu erhoben: Primärforschung.'],
    ['Die Marketingabteilung wertet die amtliche Statistik und einen Branchenbericht des Fachverbands aus.', 1, 'Die Daten gibt es schon, sie wurden für andere Zwecke gesammelt: Sekundärforschung.'],
    ['Am Messestand wird gezählt, wie viele Besucher die neue Gartenleuchte GL-8 in die Hand nehmen.', 0, 'Die Zahlen entstehen neu durch eigene Beobachtung: Primärforschung.'],
    ['Die Umsätze der letzten drei Jahre aus der eigenen Buchhaltung und die Berichte des Außendienstes werden verglichen.', 1, 'Auch eigene, schon vorhandene Daten (Buchhaltung, Berichte) sind Sekundärforschung, hier interne Quellen.'],
    ['Testgeräte des Rauchmelders RM-1 gehen an 50 Haushalte, nach vier Wochen werden diese befragt.', 0, 'Eigener Test mit neuer Befragung: Primärforschung.'],
    ['Testberichte in Fachzeitschriften und die Preislisten der Mitbewerber im Internet werden gesammelt und verglichen.', 1, 'Vorhandene, veröffentlichte Daten werden ausgewertet: Sekundärforschung.']
  ];
  const METH = ['Befragung', 'Beobachtung', 'Experiment (Test)', 'Panel'];
  const methE = [
    ['Kunden füllen nach dem Kauf im Webshop einen kurzen Fragebogen zur Zufriedenheit aus.', 0, 'Die Kunden werden direkt gefragt und antworten selbst: Befragung (schriftlich).'],
    ['Im Fachmarkt wird gezählt, wie lange Kunden vor dem Regal mit den Gartenleuchten stehen. Niemand wird angesprochen.', 1, 'Das Verhalten wird angeschaut und gezählt, ohne zu fragen: Beobachtung.'],
    ['Die Smart-Steckdose SD-4 wird in zwei Testgebieten zu verschiedenen Preisen angeboten. Danach werden die Absatzzahlen verglichen.', 2, 'Eine Größe (der Preis) wird gezielt verändert und die Wirkung gemessen: Experiment (Markttest).'],
    ['Dieselben 200 Haushalte melden ein Jahr lang jeden Monat, welche Geräte für Haus und Garten sie gekauft haben.', 3, 'Gleiche Gruppe, gleiches Thema, immer wieder in festen Abständen: Panel.'],
    ['Ein Mitarbeiter ruft 80 Elektrofachhändler an und fragt, welche Wünsche ihre Kunden an einen Rauchmelder haben.', 0, 'Direktes Fragen am Telefon: Befragung (mündlich).'],
    ['Auf der Webseite wird gemessen, welche Produktseiten Besucher wie lange ansehen, ohne sie zu fragen.', 1, 'Das Verhalten wird aufgezeichnet, die Besucher werden nicht gefragt: Beobachtung.']
  ];
  const MBEG = [
    ['Wie heißt die größtmögliche Absatzmenge eines Produkts in einem Markt, wenn alle möglichen Käufer kaufen würden?', 'Marktpotenzial', ['Marktvolumen', 'Marktanteil', 'Sättigungsgrad'], 'Das Marktpotenzial ist die Obergrenze: alles, was der Markt aufnehmen könnte. Das Marktvolumen ist das, was alle Anbieter tatsächlich absetzen.', ['Möglich oder tatsächlich?', 'Potenzial = Möglichkeit.']],
    ['Wie heißt die Menge (oder der Umsatz), die alle Anbieter in einem Zeitraum in einem Markt tatsächlich absetzen?', 'Marktvolumen', ['Marktpotenzial', 'Marktanteil', 'Absatzplan'], 'Das Marktvolumen ist der tatsächliche Absatz aller Anbieter zusammen. Davon hat jeder Anbieter seinen Marktanteil.', ['Alle Anbieter zusammen, tatsächlich verkauft.', 'Volumen = was wirklich da ist.']],
    ['Wie heißt der Anteil des eigenen Absatzes (oder Umsatzes) am Marktvolumen in Prozent?', 'Marktanteil', ['Marktpotenzial', 'Sättigungsgrad', 'Marktwachstum'], 'Marktanteil = eigener Absatz / Marktvolumen · 100.', ['Eigener Teil am Ganzen.', 'Eigener Absatz durch Marktvolumen.']],
    ['Der Sättigungsgrad eines Marktes liegt bei 95 %. Was bedeutet das?', 'Der Markt ist fast ausgeschöpft. Mehr Absatz geht meist nur, wenn man Mitbewerbern Kunden abnimmt.', ['Der Markt wächst noch sehr stark', 'Der Modellbetrieb hat 95 % Marktanteil', '95 % der Kunden sind unzufrieden'], 'Sättigungsgrad = Marktvolumen / Marktpotenzial · 100. Bei 95 % kaufen fast alle möglichen Käufer schon.', ['Volumen im Verhältnis zum Potenzial.', 'Fast alle möglichen Käufer sind versorgt.']],
    ['Was zeigt ein relativer Marktanteil von 0,5?', 'Der eigene Umsatz ist halb so groß wie der des größten Mitbewerbers', ['Der eigene Marktanteil beträgt 0,5 %', 'Der Modellbetrieb ist Marktführer', 'Der Markt ist zur Hälfte gesättigt'], 'Relativer Marktanteil = eigener Umsatz / Umsatz des größten Mitbewerbers. Unter 1 heißt: Ein anderer ist größer.', ['Mit wem wird beim relativen Marktanteil verglichen?', 'Eigener Umsatz durch Umsatz des Größten.']]
  ];
  const MIX = ['Produktpolitik', 'Preispolitik (Kontrahierungspolitik)', 'Distributionspolitik', 'Kommunikationspolitik'];
  const mixE = [
    ['Die Gartenleuchte GL-8 bekommt ein neues Gehäuse in drei Farben und zwei Jahre Garantie.', 0, 'Gestaltung, Varianten und Garantie betreffen das Produkt selbst: Produktpolitik.'],
    ['Großkunden bekommen ab 100 Stück 8 % Rabatt und 30 Tage Zahlungsziel.', 1, 'Rabatte und Zahlungsbedingungen gehören zur Preispolitik (Kontrahierungspolitik).'],
    ['Die Wetterstation WS-6 wird künftig auch über einen eigenen Webshop und über Elektrofachhändler verkauft.', 2, 'Der Weg zum Kunden (Absatzwege) gehört zur Distributionspolitik.'],
    ['Für den Rauchmelder RM-1 läuft eine Anzeige in Fachzeitschriften, dazu gibt es einen Stand auf der Hausmesse.', 3, 'Anzeigen und Messen sollen informieren und überzeugen: Kommunikationspolitik.'],
    ['Ein Handelsvertreter übernimmt den Verkauf im Süden des Landes.', 2, 'Wer verkauft und über welchen Weg: Distributionspolitik (Absatzorgane).'],
    ['Der Kundendienst bietet einen Austauschservice innerhalb von 24 Stunden an.', 0, 'Kundendienst und Service ergänzen das Produkt: Produktpolitik.'],
    ['Die Smart-Steckdose SD-4 wird drei Monate zu einem Einführungspreis angeboten.', 1, 'Preisfestlegung: Preispolitik.'],
    ['Der Betrieb bezahlt die Trikots des örtlichen Sportvereins, das Firmenzeichen steht darauf.', 3, 'Sponsoring macht den Namen bekannt: Kommunikationspolitik.']
  ];
  const PSTRAT = [
    ['Ein Bewegungsmelder BM-2 mit ganz neuer Technik kommt zu einem hohen Preis auf den Markt. Später wird der Preis schrittweise gesenkt.', 'Abschöpfungsstrategie (Skimming)', ['Durchdringungsstrategie (Penetration)', 'Preisdifferenzierung nach Kundengruppen', 'Niedrigpreisstrategie auf Dauer'], 'Hoher Einstiegspreis, solange das Produkt neu ist, dann senken: Man schöpft zuerst die Käufer ab, die viel zahlen wollen.', ['Hoch beginnen, dann senken.', 'Abschöpfen = erst die Zahlungsbereiten.']],
    ['Die Smart-Steckdose SD-4 kommt zu einem sehr niedrigen Preis auf den Markt, um schnell viele Kunden zu gewinnen. Später steigt der Preis.', 'Durchdringungsstrategie (Penetration)', ['Abschöpfungsstrategie (Skimming)', 'Hochpreisstrategie (Prämienpreis)', 'Preisdifferenzierung nach Kundengruppen'], 'Niedrig einsteigen, Markt schnell erobern, später erhöhen: Durchdringung.', ['Niedrig beginnen, dann erhöhen.', 'Den Markt schnell durchdringen.']],
    ['Die gleiche Wetterstation WS-6 kostet für Gewerbekunden weniger als für Privatkunden.', 'Preisdifferenzierung nach Kundengruppen', ['Abschöpfungsstrategie (Skimming)', 'Durchdringungsstrategie (Penetration)', 'Zeitliche Preisdifferenzierung'], 'Gleiches Produkt, verschiedene Preise je Kundengruppe: personelle Preisdifferenzierung.', ['Was unterscheidet die Käufer?', 'Gleiches Produkt, andere Gruppe, anderer Preis.']],
    ['Im Winter sind die Solar-Gartenleuchten GL-8 günstiger als im Frühjahr.', 'Zeitliche Preisdifferenzierung', ['Preisdifferenzierung nach Kundengruppen', 'Abschöpfungsstrategie (Skimming)', 'Hochpreisstrategie (Prämienpreis)'], 'Gleiches Produkt, anderer Preis je nach Jahreszeit: zeitliche Preisdifferenzierung.', ['Was ändert sich: Kunde, Ort oder Zeit?', 'Jahreszeit = Zeit.']],
    ['Eine besondere Variante der Funk-Türklingel TK-3 wird dauerhaft deutlich teurer als ähnliche Geräte angeboten, mit edlem Gehäuse und langer Garantie.', 'Hochpreisstrategie (Prämienpreis)', ['Durchdringungsstrategie (Penetration)', 'Zeitliche Preisdifferenzierung', 'Niedrigpreisstrategie auf Dauer'], 'Dauerhaft hoher Preis für ein hochwertiges Produkt mit gutem Ruf: Prämienpreis.', ['Dauerhaft oder nur am Anfang hoch?', 'Hochwertig und dauerhaft teuer.']]
  ];
  const AIDAN = ['Attention (Aufmerksamkeit)', 'Interest (Interesse)', 'Desire (Wunsch)', 'Action (Handlung)'];
  const aidaE = [
    ['Ein auffälliges Plakat mit einem leuchtenden Garten bei Nacht lässt Leute auf der Straße stehen bleiben.', 0, 'Das Plakat soll den Blick fangen: Attention, Aufmerksamkeit wecken.'],
    ['Im Prospekt steht genau, wie lange der Akku der Gartenleuchte hält und wie sie montiert wird.', 1, 'Genaue Informationen halten das Interesse: Interest.'],
    ['Im Video sieht ein Kunde, wie schön die Terrasse mit den Leuchten GL-8 wirkt, und will sie unbedingt für seinen Garten.', 2, 'Der Kunde möchte das Produkt haben: Desire, Wunsch.'],
    ['Ein Knopf „Jetzt bestellen“ mit kostenlosem Versand bis Sonntag lädt zum Kauf ein.', 3, 'Aufforderung zum Handeln: Action.'],
    ['Ein kurzer Ton und ein bewegtes Bild am Anfang des Werbevideos sollen den Blick fangen.', 0, 'Erst muss der Kunde hinsehen: Attention.'],
    ['Ein Testbericht und eine Tabelle mit allen Funktionen liegen zum Nachlesen bereit.', 1, 'Informationen für alle, die mehr wissen wollen: Interest.']
  ];
  const WPLAN = [
    ['Im Werbeplan steht: „Hausbesitzer mit Garten zwischen 30 und 60 Jahren“. Welcher Teil des Werbeplans ist das?', 'Zielgruppe (Streukreis)', ['Werbeträger', 'Werbemittel', 'Streuzeit'], 'Die Zielgruppe sagt, wer erreicht werden soll.', ['Wer soll die Werbung sehen?', 'Personen = Zielgruppe.']],
    ['Eine Zeitschrift, ein Radiosender oder eine Webseite bringt die Werbung zu den Menschen. Wie heißt das im Werbeplan?', 'Werbeträger', ['Werbemittel', 'Werbebotschaft', 'Werbeetat'], 'Der Werbeträger trägt das Werbemittel zum Kunden (Zeitschrift trägt die Anzeige).', ['Wer bringt die Werbung zum Kunden?', 'Träger trägt, Mittel ist die Werbung selbst.']],
    ['Die Anzeige, der Werbespot oder das Plakat selbst heißt im Werbeplan …', 'Werbemittel', ['Werbeträger', 'Streugebiet', 'Werbeziel'], 'Das Werbemittel ist die gestaltete Werbung. Der Werbeträger bringt sie zum Kunden.', ['Was sieht der Kunde genau an?', 'Mittel = die Anzeige selbst.']],
    ['In welchem Zeitraum und wie oft geworben wird, legt im Werbeplan die … fest.', 'Streuzeit', ['Streugebiet', 'Werbeetat', 'Zielgruppe'], 'Die Streuzeit regelt Beginn, Dauer und Häufigkeit der Werbung.', ['Wann und wie oft?', 'Zeit = Streuzeit.']],
    ['Wie viel Geld für die Werbung zur Verfügung steht, heißt im Werbeplan …', 'Werbeetat (Werbebudget)', ['Streuzeit', 'Werbeträger', 'Werberendite'], 'Der Werbeetat ist das Geld für die Werbung. Die Werberendite misst erst später den Erfolg.', ['Geld vorher oder Erfolg nachher?', 'Etat = Budget.']],
    ['Was der Kunde über das Produkt erfahren und sich merken soll (z. B. „Licht ohne Kabel“), heißt …', 'Werbebotschaft', ['Werbeträger', 'Streugebiet', 'Werbeetat'], 'Die Werbebotschaft ist der Inhalt, den die Werbung vermitteln soll.', ['Was soll im Kopf bleiben?', 'Inhalt = Botschaft.']]
  ];
  /* PRUEFEN M3 bis M6: Rechtsfälle vereinfacht, Paragrafen nach Stand der Erstellung; bitte vom Ausbilder bestätigen lassen */
  const RECHT = [
    ['Der Betrieb schickt eine Werbe-E-Mail für den Rauchmelder RM-1 an 2.000 Privatleute, deren Adressen gekauft wurden. Niemand hat vorher eingewilligt. Ist das erlaubt?', 'Nicht erlaubt: Werbung per E-Mail ohne vorherige ausdrückliche Einwilligung ist eine unzumutbare Belästigung (§ 7 UWG).', ['Erlaubt, weil E-Mails den Empfänger nichts kosten', 'Erlaubt, wenn die E-Mail einen Link zum Abmelden hat', 'Erlaubt, weil die Adressen bezahlt wurden'], 'Werbe-E-Mails brauchen vorher eine ausdrückliche Einwilligung. Ein Abmeldelink allein reicht nicht.', ['Hat der Empfänger vorher zugestimmt?', 'Regel: E-Mail-Werbung nur mit vorheriger ausdrücklicher Einwilligung (§ 7 UWG).']],
    ['Ein Kunde hat im Webshop eine Wetterstation gekauft und dabei seine E-Mail-Adresse angegeben. Er wurde klar darauf hingewiesen, dass er Werbung jederzeit ablehnen kann, und hat nicht abgelehnt. Nun bekommt er Werbung für passendes Zubehör des Betriebs. Ist das erlaubt?', 'In der Regel erlaubt: Ausnahme für Bestandskunden bei ähnlichen eigenen Waren, wenn alle Bedingungen erfüllt sind.', ['Immer verboten, auch bei Kunden, die schon gekauft haben', 'Erlaubt, auch für Waren anderer Firmen', 'Erlaubt, auch wenn er schon abgelehnt hat'], 'Für Bestandskunden gibt es eine Ausnahme: Adresse aus einem Kauf, Werbung für eigene ähnliche Waren, Hinweis auf das Recht zum Ablehnen, kein Widerspruch.', ['Woher hat der Betrieb die Adresse, und wofür wird geworben?', 'Regel: Bestandskunden-Ausnahme (§ 7 Abs. 3 UWG), nur eigene ähnliche Waren und mit Hinweis.']],
    ['Ein Mitarbeiter ruft Privatleute aus einem Telefonverzeichnis an, um Smart-Steckdosen anzubieten. Keiner hat eingewilligt. Ist das erlaubt?', 'Nicht erlaubt: Werbeanrufe bei Verbrauchern brauchen eine vorherige ausdrückliche Einwilligung.', ['Erlaubt, wenn das Gespräch kurz ist', 'Erlaubt, weil die Nummer öffentlich ist', 'Erlaubt, solange am Telefon nichts verkauft wird'], 'Telefonwerbung bei Verbrauchern ohne vorherige ausdrückliche Einwilligung ist eine unzumutbare Belästigung.', ['Wer wird angerufen und hat er zugestimmt?', 'Regel: Werbeanruf bei Verbrauchern nur mit vorheriger ausdrücklicher Einwilligung (§ 7 UWG).']],
    ['In einer Anzeige steht: „Hält 10 Jahre ohne Batteriewechsel“. Tatsächlich muss die Batterie nach 2 Jahren getauscht werden. Ist das erlaubt?', 'Nicht erlaubt: irreführende Werbung über wesentliche Merkmale des Produkts (§ 5 UWG).', ['Erlaubt, Werbung darf immer übertreiben', 'Erlaubt, wenn es klein gedruckt dasteht', 'Erlaubt, solange kein Kunde sich beschwert'], 'Falsche Angaben über wichtige Eigenschaften täuschen den Kunden. Das ist irreführende Werbung.', ['Stimmt die Angabe?', 'Regel: Keine unwahren oder täuschenden Angaben (§ 5 UWG).']],
    ['Der Betrieb vergleicht in einer Anzeige sachlich und nachprüfbar den Stromverbrauch seiner Wetterstation mit einem gleichartigen Gerät eines Mitbewerbers. Ist das erlaubt?', 'Grundsätzlich erlaubt: Vergleichende Werbung ist zulässig, wenn sie sachlich, nachprüfbar und nicht herabsetzend ist (§ 6 UWG).', ['Immer verboten, Mitbewerber dürfen nie genannt werden', 'Nur erlaubt, wenn der Mitbewerber zustimmt', 'Erlaubt, auch wenn die Zahlen nicht stimmen'], 'Vergleichende Werbung ist erlaubt, wenn gleichartige Waren sachlich und nachprüfbar verglichen werden und niemand herabgesetzt wird.', ['Wie wird verglichen: sachlich oder abwertend?', 'Regel: Vergleich ja, wenn sachlich, nachprüfbar, gleichartig, nicht herabsetzend (§ 6 UWG).']],
    ['In einem Werbevideo heißt es über einen Mitbewerber: „Dessen Leuchten sind Schrott, nur Dummköpfe kaufen so etwas.“ Ist das erlaubt?', 'Nicht erlaubt: Vergleichende Werbung darf Mitbewerber nicht herabsetzen oder verunglimpfen.', ['Erlaubt, das ist freie Meinung', 'Erlaubt, wenn der Name des Mitbewerbers nicht genannt wird, aber jeder ihn erkennt', 'Erlaubt, weil Videos nicht unter das Gesetz fallen'], 'Abwertende Aussagen über Mitbewerber ohne sachlichen Vergleich sind unlauter.', ['Ist der Vergleich sachlich?', 'Regel: Herabsetzen von Mitbewerbern ist unlauter (§ 6 UWG).']],
    ['Im Webshop steht beim Rauchmelder RM-1 nur der Preis ohne Umsatzsteuer. Der Shop richtet sich an Privatkunden. Ist das erlaubt?', 'Nicht erlaubt: Gegenüber Verbrauchern ist der Gesamtpreis einschließlich Umsatzsteuer anzugeben (Preisangabenverordnung).', ['Erlaubt, die Steuer kommt an der Kasse dazu', 'Erlaubt, wenn der Preis rund ist', 'Nur im Laden verboten, nicht im Webshop'], 'Verbraucher müssen sofort den Gesamtpreis sehen, also mit Umsatzsteuer.', ['Wer kauft: Verbraucher oder Unternehmen?', 'Regel: Gesamtpreis mit Umsatzsteuer gegenüber Verbrauchern (PAngV).']],
    ['Die Gartenleuchte GL-8 wird mit „Jetzt 20 % billiger!“ beworben. Als alter Preis steht ein Preis da, der nur am Tag vor der Aktion galt. In den 30 Tagen davor war sie billiger. Ist das erlaubt?', 'Nicht erlaubt: Bei einer Preisermäßigung ist der niedrigste Preis der letzten 30 Tage als alter Preis anzugeben.', ['Erlaubt, jeder frühere Preis darf genannt werden', 'Erlaubt, wenn der Rabatt unter 50 % liegt', 'Nur im Laden verboten, nicht im Internet'], 'Bei Preisermäßigungen gegenüber Verbrauchern zählt als Bezug der niedrigste Preis der letzten 30 Tage. Ein kurz vorher erhöhter Preis täuscht.', ['Welcher alte Preis ist der richtige Bezug?', 'Regel: niedrigster Preis der letzten 30 Tage (§ 11 PAngV).']],
    ['Ein besonders billiges Angebot für die Smart-Steckdose wird groß beworben. Es sind aber nur 5 Stück da, obwohl mit großer Nachfrage zu rechnen war. Ein Hinweis darauf fehlt. Ist das erlaubt?', 'Nicht erlaubt: Ein Lockangebot ohne ausreichenden Vorrat und ohne Hinweis ist irreführend.', ['Erlaubt, wer zuerst kommt, mahlt zuerst', 'Erlaubt, wenn der Preis stimmt', 'Erlaubt, weil Vorräte geheim sind'], 'Wer ein Angebot bewirbt, muss mit genug Ware rechnen oder klar auf die kleine Menge hinweisen. Sonst lockt er Kunden nur an.', ['Reicht die Menge für die erwartete Nachfrage?', 'Regel: Lockangebote ohne ausreichenden Vorrat sind irreführend (UWG).']],
    ['Ein Beitrag in sozialen Medien lobt den Bewegungsmelder BM-2 als „ehrliche Meinung“. Der Betrieb hat dafür bezahlt, das steht aber nirgends. Ist das erlaubt?', 'Nicht erlaubt: Bezahlte Werbung muss als Werbung erkennbar sein (sonst Schleichwerbung).', ['Erlaubt, weil soziale Medien privat sind', 'Erlaubt, wenn der Beitrag gut gemacht ist', 'Erlaubt, solange keine Preise genannt werden'], 'Wer für einen Beitrag bezahlt, muss das kenntlich machen, z. B. mit „Werbung“ oder „Anzeige“.', ['Kann der Leser erkennen, dass es Werbung ist?', 'Regel: Werbung muss als Werbung erkennbar sein (UWG).']],
    ['Ein Mitbewerber stellt fest, dass der Modellbetrieb irreführend wirbt. Was kann er in der Regel zuerst tun?', 'Abmahnen und verlangen, dass die Werbung unterlassen wird (Unterlassungserklärung mit Vertragsstrafe).', ['Die Polizei muss den Betrieb sofort schließen', 'Er darf die Ware des Modellbetriebs mitnehmen', 'Nichts, das UWG schützt nur Verbraucher'], 'Bei Verstößen gegen das UWG gibt es vor allem den Anspruch auf Unterlassung, oft zuerst mit einer Abmahnung. Dazu kann Schadensersatz kommen.', ['Was will der Mitbewerber erreichen?', 'Regel: Unterlassung (§ 8 UWG), meist erst Abmahnung.']],
    ['Wen schützt das Gesetz gegen den unlauteren Wettbewerb (UWG)?', 'Mitbewerber, Verbraucher und sonstige Marktteilnehmer sowie den unverfälschten Wettbewerb', ['Nur Verbraucher', 'Nur große Unternehmen', 'Nur den Staat'], 'Das UWG schützt alle am Markt: Mitbewerber, Verbraucher, sonstige Marktteilnehmer und den fairen Wettbewerb.', ['Wer ist alles am Markt beteiligt?', 'Regel: Schutzzweck in § 1 UWG.']]
  ];

  /* ---------- Hilfen ---------- */
  const N3 = ['Mitbewerber A', 'Mitbewerber B', 'Mitbewerber C'];

  /* ---------- Generatoren ---------- */
  const G = {
    /* Marktforschung */
    art: cq(artE, ART, 'Welche Art der Marktforschung ist das?', ['Lies, woher die Daten kommen.', 'Frage dich: Werden sie extra neu erhoben oder gibt es sie schon?', 'Wähle die passende Art.'], ['Neu erhoben oder schon vorhanden?', 'Primär = neu und eigens erhoben, Sekundär = vorhandene Daten (auch aus der eigenen Buchhaltung).']),
    meth: cq(methE, METH, 'Welche Methode der Marktforschung wird genutzt?', ['Lies, wie die Daten gewonnen werden.', 'Wird gefragt, nur zugesehen, etwas gezielt verändert oder dieselbe Gruppe immer wieder erfasst?', 'Wähle die passende Methode.'], ['Fragen, zusehen, testen oder regelmäßig dieselbe Gruppe?', 'Befragung = fragen, Beobachtung = zusehen, Experiment = gezielt ändern und messen, Panel = gleiche Gruppe in Abständen.']),
    ant: R => {
      const c = C(), V = c.pick(R, [40000, 50000, 64000, 80000, 120000, 125000]), s = c.pick(R, [4, 5, 6.25, 8, 12.5, 15, 20, 25]), e = V * s / 100;
      return numQ(MB + 'Im letzten Jahr wurden von allen Anbietern zusammen ' + f(V, 0) + ' Funk-Türklingeln verkauft. Der Modellbetrieb hat davon ' + f(e, 0) + ' Stück seiner Türklingel TK-3 abgesetzt. Wie hoch ist sein Marktanteil in Prozent?',
        ['Suche das Marktvolumen (alle Anbieter zusammen).', 'Teile den eigenen Absatz durch das Marktvolumen.', 'Multipliziere mit 100.'], c.marktAnteil(e, V), '%', 'Marktanteil', 0.05,
        'Marktanteil = ' + f(e, 0) + ' / ' + f(V, 0) + ' · 100 = ' + f(s, 2) + ' %.', ['Marktanteil = eigener Absatz / Marktvolumen · 100.', 'Lösungsweg: ' + f(e, 0) + ' / ' + f(V, 0) + ' · 100 = ?']);
    },
    satt: R => {
      const c = C(), P = c.pick(R, [100000, 150000, 200000, 250000, 400000]), r = c.pick(R, [0.45, 0.6, 0.72, 0.8, 0.88, 0.95]), V = P * r, g = c.saettigung(V, P);
      return numQ(MB + 'Marktforscher schätzen: Höchstens ' + f(P, 0) + ' Haushalte im Verkaufsgebiet würden einen Rauchmelder mit Funkvernetzung kaufen (Marktpotenzial). Im letzten Jahr wurden von allen Anbietern ' + f(V, 0) + ' Stück verkauft (Marktvolumen). Wie hoch ist der Sättigungsgrad in Prozent?',
        ['Ordne zu: Was ist das Marktvolumen, was das Marktpotenzial?', 'Teile das Marktvolumen durch das Marktpotenzial.', 'Multipliziere mit 100 und beurteile den Wert.'], g, '%', 'Sättigungsgrad', 0.05,
        'Sättigungsgrad = ' + f(V, 0) + ' / ' + f(P, 0) + ' · 100 = ' + f(g, 2) + ' %.' + (g >= 85 ? ' Der Markt ist fast gesättigt.' : ' Der Markt hat noch Luft nach oben.'), ['Sättigungsgrad = Marktvolumen / Marktpotenzial · 100.', 'Lösungsweg: ' + f(V, 0) + ' / ' + f(P, 0) + ' · 100 = ?']);
    },
    rel: R => {
      const c = C(), own = c.pick(R, [240, 300, 360, 450, 600, 720, 900]), us = N3.map(() => c.pick(R, [150, 200, 250, 400, 480, 500, 800, 1200])); let mx = Math.max.apply(null, us);
      while (us.filter(u => u === mx).length > 1) { us[us.indexOf(mx)] -= 30; mx = Math.max.apply(null, us); }
      const rel = c.relAnteil(own, mx), name = N3[us.indexOf(mx)];
      return numQ(MB + 'Umsatz mit Wetterstationen im letzten Jahr in Tausend Euro: Modellbetrieb ' + f(own, 0) + ', ' + N3.map((n, i) => n + ' ' + f(us[i], 0)).join(', ') + '. Wie groß ist der relative Marktanteil des Modellbetriebs? (Faktor mit zwei Nachkommastellen)',
        ['Suche den größten Mitbewerber (den mit dem höchsten Umsatz).', 'Teile den eigenen Umsatz durch dessen Umsatz.', 'Runde auf zwei Nachkommastellen. Über 1 heißt: Du bist Marktführer.'], c.rd(rel, 2), '', 'relativer Marktanteil', 0.011,
        'Größter Mitbewerber: ' + name + ' mit ' + f(mx, 0) + '. Relativer Marktanteil = ' + f(own, 0) + ' / ' + f(mx, 0) + ' = ' + f(rel, 2) + '.' + (rel > 1 ? ' Über 1: Der Modellbetrieb ist Marktführer.' : ' Unter 1: Ein Mitbewerber ist größer.'), ['Verglichen wird nur mit dem größten Mitbewerber, nicht mit dem ganzen Markt.', 'Lösungsweg: ' + f(own, 0) + ' / ' + f(mx, 0) + ' = ?']);
    },
    wach: R => {
      const c = C(), a = c.pick(R, [20000, 25000, 40000, 50000, 80000]), p = c.pick(R, [-8, -5, 4, 6, 12.5, 15, 20, 30]), n = a * (1 + p / 100), w = c.wachstum(a, n);
      return numQ(MB + 'Das Marktvolumen für Smart-Steckdosen lag im Vorjahr bei ' + f(a, 0) + ' Stück, in diesem Jahr bei ' + f(n, 0) + ' Stück. Um wie viel Prozent ist der Markt gewachsen? (Ein Rückgang ist negativ.)',
        ['Rechne die Veränderung: neues Volumen minus altes Volumen.', 'Teile die Veränderung durch das alte Volumen.', 'Multipliziere mit 100.'], w, '%', 'Marktwachstum', 0.05,
        'Veränderung: ' + f(n, 0) + ' − ' + f(a, 0) + ' = ' + f(n - a, 0) + ' Stück. Marktwachstum = ' + f(n - a, 0) + ' / ' + f(a, 0) + ' · 100 = ' + f(w, 2) + ' %.', ['Bezugsgröße ist immer der alte Wert (Vorjahr).', 'Lösungsweg: (' + f(n, 0) + ' − ' + f(a, 0) + ') / ' + f(a, 0) + ' · 100 = ?']);
    },
    ums: R => {
      const c = C(), V = c.pick(R, [1.2, 1.5, 2, 2.4, 3.6, 4.8]) * 1e6, s = c.pick(R, [5, 7.5, 10, 12, 15, 18]), u = V * s / 100;
      return numQ(MB + 'Das Marktvolumen für Solar-Gartenleuchten beträgt ' + f(V, 0) + ' € Umsatz im Jahr. Der Modellbetrieb plant mit der Leuchte GL-8 einen Marktanteil von ' + f(s, 1) + ' %. Welchen Umsatz plant er in Euro?',
        ['Schreibe den Marktanteil als Bruch: Prozent / 100.', 'Multipliziere das Marktvolumen damit.', 'Gib das Ergebnis in Euro an.'], u, '€', 'geplanter Umsatz', 0.5,
        'Umsatz = ' + f(V, 0) + ' € · ' + f(s, 1) + ' / 100 = ' + f(u, 0) + ' €.', ['Marktanteil umgestellt: eigener Umsatz = Marktvolumen · Marktanteil / 100.', 'Lösungsweg: ' + f(V, 0) + ' · ' + f(s, 1) + ' / 100 = ?']);
    },
    mbeg: pq(MBEG, ['Lies die Frage und markiere das Schlüsselwort (möglich, tatsächlich, eigener Teil).', 'Vergleiche mit den Begriffen Marktpotenzial, Marktvolumen, Marktanteil und Sättigungsgrad.', 'Wähle die passende Antwort.']),
    /* Marketing-Mix, Lebenszyklus, Portfolio */
    mix: cq(mixE, MIX, 'Zu welchem Bereich des Marketing-Mix gehört die Maßnahme?', ['Lies die Maßnahme und frage dich, was verändert wird.', 'Produkt selbst, Preis und Bedingungen, Weg zum Kunden oder Information und Werbung?', 'Wähle den passenden Bereich.'], ['Die 4 P: Product, Price, Place, Promotion.', 'Produkt = Ware und Service, Preis = Preis und Konditionen, Distribution = Absatzweg, Kommunikation = Werbung, Messe, Sponsoring.']),
    plzd: (R, arg) => {
      const c = C(), i = pickI(R, arg, 5), P = c.PLZ;
      return choiceQ(R, MB + 'Ein Produkt zeigt diese Lage: ' + P[i].d + ' In welcher Phase des Produktlebenszyklus ist es?', ['Lies, wie sich Umsatz und Gewinn gerade entwickeln.', 'Ordne zu: steigt, wächst kaum, sinkt? Gibt es schon Gewinn?', 'Wähle die passende Phase.'], P[i].n, P.filter((_, k) => k !== i).map(p => p.n).slice(0, 3),
        P[i].n + ': ' + P[i].d + ' Passende Maßnahme: ' + P[i].m, ['Die Phasen: Einführung, Wachstum, Reife, Sättigung, Rückgang.', 'Achte auf Umsatz (steigt, flach, sinkt) und Gewinn (Verlust, Höchstwert, sinkt).']);
    },
    plzm: (R, arg) => {
      const c = C(), i = pickI(R, arg, 5), P = c.PLZ;
      return choiceQ(R, MB + 'Die Wetterstation WS-6 ist in der Phase „' + P[i].n + '“. Welche Maßnahme passt am besten?', ['Überlege, wie Umsatz und Gewinn in dieser Phase aussehen.', 'Frage dich, was das Produkt jetzt braucht: bekannt werden, wachsen, Kunden halten oder Abschied.', 'Wähle die Maßnahme, die dazu passt.'], P[i].m, P.filter((_, k) => k !== i).map(p => p.m).slice(0, 3),
        P[i].n + ': ' + P[i].d + ' Darum: ' + P[i].m, ['Jede Phase hat eigene Ziele.', 'Einführung = bekannt machen, Wachstum = ausbauen, Reife = halten, Sättigung = erneuern, Rückgang = Kosten senken oder vom Markt nehmen.']);
    },
    bcg: R => {
      const c = C(), rel = c.pick(R, [0.3, 0.5, 0.8, 1.4, 2, 2.5]), w = c.pick(R, [-2, 3, 6, 14, 18, 25]), i = c.bcgFeld(rel, w), B = c.BCG;
      return choiceQ(R, MB + 'Der Rauchmelder RM-1 hat einen relativen Marktanteil von ' + f(rel, 1) + ', der Markt wächst um ' + f(w, 0) + ' % im Jahr. In welchem Feld der BCG-Matrix (Portfolio) liegt das Produkt?', ['Prüfe den relativen Marktanteil: über 1 hoch, sonst niedrig.', 'Prüfe das Marktwachstum: über 10 % hoch, sonst niedrig.', 'Kombiniere beide und wähle das Feld.'], B[i].n, B.filter((_, k) => k !== i).map(b => b.n),
        'Relativer Marktanteil ' + f(rel, 1) + (rel > 1 ? ' (hoch)' : ' (niedrig)') + ', Wachstum ' + f(w, 0) + ' %' + (w > 10 ? ' (hoch)' : ' (niedrig)') + ': ' + B[i].n + '. ' + B[i].d, ['Zwei Fragen: Marktführer (über 1)? Markt wächst stark (über 10 %)?', 'Star = hoch/hoch, Cash Cow = Anteil hoch/Wachstum niedrig, Question Mark = Anteil niedrig/Wachstum hoch, Poor Dog = niedrig/niedrig.']);
    },
    bcg3: R => {
      const c = C(), own = c.pick(R, [300, 450, 600, 900, 1200]), comp = c.pick(R, [400, 500, 750, 1000]), a = c.pick(R, [8000, 10000, 12000, 16000]), p = c.pick(R, [2, 5, 8, 15, 20, 25]), n = a * (1 + p / 100);
      const rel = c.relAnteil(own, comp), w = c.wachstum(a, n), i = c.bcgFeld(rel, w), B = c.BCG;
      return choiceQ(R, MB + 'Bewegungsmelder BM-2: eigener Umsatz ' + f(own, 0) + ' Tausend €, größter Mitbewerber ' + f(comp, 0) + ' Tausend €. Das Marktvolumen stieg von ' + f(a, 0) + ' Tausend € auf ' + f(n, 0) + ' Tausend €. In welches Feld der BCG-Matrix gehört das Produkt, und was wird empfohlen?', ['Rechne den relativen Marktanteil: eigener Umsatz / Umsatz des größten Mitbewerbers.', 'Rechne das Marktwachstum in Prozent.', 'Ordne mit den Grenzen 1 und 10 % ein und wähle die Empfehlung.'], B[i].n + ': ' + B[i].m, B.filter((_, k) => k !== i).map(b => b.n + ': ' + b.m),
        'Relativer Marktanteil = ' + f(own, 0) + ' / ' + f(comp, 0) + ' = ' + f(rel, 2) + '. Wachstum = (' + f(n, 0) + ' − ' + f(a, 0) + ') / ' + f(a, 0) + ' · 100 = ' + f(w, 1) + ' %. Feld: ' + B[i].n + '. Empfehlung: ' + B[i].m, ['Erst zwei Zahlen rechnen, dann einordnen.', 'Lösungsweg: ' + f(own, 0) + ' / ' + f(comp, 0) + ' und (' + f(n, 0) + ' − ' + f(a, 0) + ') / ' + f(a, 0) + ' · 100, dann mit 1 und 10 % vergleichen.']);
    },
    krit: R => {
      const c = C(), fR = c.pick(R, [2500, 3000, 3500, 4000]), pR = c.pick(R, [1, 2, 3]), fH = c.pick(R, [0, 300, 500]), pH = c.pick(R, [6, 8, 10]), k = c.kritUmsatz(fR, pR, fH, pH);
      return numQ(MB + 'Für den Verkauf im Norden gibt es zwei Möglichkeiten: ein Reisender (angestellt) mit ' + f(fR, 0) + ' € Fixum im Monat und ' + f(pR, 0) + ' % Provision, oder ein Handelsvertreter (selbstständig) mit ' + f(fH, 0) + ' € fester Vergütung und ' + f(pH, 0) + ' % Provision vom Umsatz. Bei welchem Monatsumsatz sind beide gleich teuer (kritischer Umsatz)?',
        ['Schreibe die Kosten beider Wege als Formel: Fixum + Provision · Umsatz.', 'Setze beide Formeln gleich.', 'Löse nach dem Umsatz auf: Unterschied der Fixa / Unterschied der Provisionssätze.'], k, '€', 'kritischer Umsatz', 1,
        'Gleichsetzen: ' + f(fR, 0) + ' + ' + f(pR / 100, 2) + ' · U = ' + f(fH, 0) + ' + ' + f(pH / 100, 2) + ' · U. U = (' + f(fR, 0) + ' − ' + f(fH, 0) + ') / (' + f(pH / 100, 2) + ' − ' + f(pR / 100, 2) + ') = ' + f(k, 2) + ' €. Darüber ist der Reisende günstiger, darunter der Handelsvertreter.', ['Kritischer Umsatz = (Fixum Reisender − Fixum Vertreter) / (Provisionssatz Vertreter − Provisionssatz Reisender).', 'Lösungsweg: (' + f(fR, 0) + ' − ' + f(fH, 0) + ') / ((' + f(pH, 0) + ' − ' + f(pR, 0) + ') / 100) = ?']);
    },
    aussen: R => {
      const c = C(), fR = 3000, pR = 2, fH = 500, pH = 8, k = c.kritUmsatz(fR, pR, fH, pH), u = c.pick(R, [20000, 30000, 50000, 60000, 80000]), kr = c.vertriebsKosten(fR, pR, u), kh = c.vertriebsKosten(fH, pH, u);
      const right = kr < kh ? 'Reisender' : 'Handelsvertreter';
      return choiceQ(R, MB + 'Reisender: 3000 € Fixum und 2 % Provision. Handelsvertreter: 500 € fest und 8 % Provision. Erwartet wird ein Monatsumsatz von ' + f(u, 0) + ' €. Wer ist günstiger?', ['Rechne die Kosten des Reisenden: Fixum + Provision vom Umsatz.', 'Rechne die Kosten des Handelsvertreters genauso.', 'Vergleiche beide Beträge.'], right, [right === 'Reisender' ? 'Handelsvertreter' : 'Reisender', 'Beide kosten genau gleich viel'],
        'Reisender: 3000 + 0,02 · ' + f(u, 0) + ' = ' + f(kr, 0) + ' €. Handelsvertreter: 500 + 0,08 · ' + f(u, 0) + ' = ' + f(kh, 0) + ' €. Günstiger: ' + right + '. (Kritischer Umsatz: ' + f(k, 2) + ' €.)', ['Hoher Umsatz: das feste Gehalt lohnt sich eher. Niedriger Umsatz: die reine Provision.', 'Lösungsweg: 3000 + 0,02 · ' + f(u, 0) + ' gegen 500 + 0,08 · ' + f(u, 0) + '.']);
    },
    /* Preispolitik */
    db: R => {
      const c = C(), p = c.pick(R, [29.9, 34.5, 39, 45, 49.9, 59]), kv = c.pick(R, [12.4, 15.8, 18, 21.5, 24.9]), d = c.dbStueck(p, kv);
      return numQ(MB + 'Die Funk-Türklingel TK-3 wird für ' + f(p, 2) + ' € (netto) verkauft. Die variablen Kosten betragen ' + f(kv, 2) + ' € je Stück. Wie hoch ist der Deckungsbeitrag je Stück?',
        ['Suche den Nettoverkaufspreis je Stück.', 'Suche die variablen Kosten je Stück.', 'Ziehe die variablen Kosten vom Preis ab.'], d, '€', 'Deckungsbeitrag je Stück', 0.005,
        'Deckungsbeitrag je Stück = ' + f(p, 2) + ' € − ' + f(kv, 2) + ' € = ' + f(d, 2) + ' €. Dieser Betrag hilft, die Fixkosten zu decken.', ['Deckungsbeitrag = Preis − variable Kosten (je Stück).', 'Lösungsweg: ' + f(p, 2) + ' − ' + f(kv, 2) + ' = ?']);
    },
    erg: R => {
      const c = C(), p = c.pick(R, [24, 28, 32, 36]), kv = c.pick(R, [12, 14, 15, 18]), x = c.pick(R, [2000, 2500, 3000, 4000]), kf = c.pick(R, [18000, 24000, 30000, 36000]), e = c.ergebnis(p, kv, x, kf);
      return numQ(MB + 'Smart-Steckdose SD-4 im Monat: ' + f(x, 0) + ' Stück zu ' + f(p, 2) + ' €, variable Kosten ' + f(kv, 2) + ' € je Stück, Fixkosten ' + f(kf, 0) + ' €. Wie hoch ist das Betriebsergebnis (Gewinn oder Verlust)? (Verlust negativ)',
        ['Rechne den Deckungsbeitrag je Stück: Preis − variable Kosten.', 'Multipliziere mit der Menge: Deckungsbeitrag gesamt.', 'Ziehe die Fixkosten ab.'], e, '€', 'Betriebsergebnis', 0.5,
        'DB je Stück: ' + f(p, 2) + ' − ' + f(kv, 2) + ' = ' + f(p - kv, 2) + ' €. DB gesamt: ' + f(p - kv, 2) + ' · ' + f(x, 0) + ' = ' + f((p - kv) * x, 0) + ' €. Ergebnis: ' + f((p - kv) * x, 0) + ' − ' + f(kf, 0) + ' = ' + f(e, 0) + ' €.', ['Erst Deckungsbeitrag gesamt, dann Fixkosten abziehen.', 'Lösungsweg: (' + f(p, 2) + ' − ' + f(kv, 2) + ') · ' + f(x, 0) + ' − ' + f(kf, 0) + ' = ?']);
    },
    pugk: R => {
      const c = C(), m = c.pick(R, [6.4, 8.2, 9.5, 11]), l = c.pick(R, [3.6, 4.8, 5.5]), s = c.pick(R, [0.8, 1.2, 1.5]), kf = c.pick(R, [12000, 15000, 20000]), x = c.pick(R, [2000, 2500, 4000]), kv = m + l + s;
      return numQ(MB + 'Rauchmelder RM-1 je Stück: Material ' + f(m, 2) + ' €, Fertigungslohn ' + f(l, 2) + ' €, Verpackung und Fracht ' + f(s, 2) + ' € (alles variabel). Fixkosten ' + f(kf, 0) + ' € im Monat bei ' + f(x, 0) + ' Stück. Wie hoch ist die kurzfristige Preisuntergrenze je Stück?',
        ['Trenne variable Kosten und Fixkosten.', 'Kurzfristig muss der Preis nur die variablen Kosten decken.', 'Zähle die variablen Kosten je Stück zusammen.'], kv, '€', 'kurzfristige Preisuntergrenze', 0.005,
        'Kurzfristige Preisuntergrenze = variable Kosten je Stück = ' + f(m, 2) + ' + ' + f(l, 2) + ' + ' + f(s, 2) + ' = ' + f(kv, 2) + ' €. Die Fixkosten fallen kurzfristig sowieso an.', ['Kurzfristig: Welche Kosten entstehen nur, wenn produziert wird?', 'Lösungsweg: ' + f(m, 2) + ' + ' + f(l, 2) + ' + ' + f(s, 2) + ' = ?']);
    },
    pugl: R => {
      const c = C(), kv = c.pick(R, [14.5, 16, 18.4, 21]), kf = c.pick(R, [12000, 15000, 20000, 24000]), x = c.pick(R, [2000, 2500, 3000, 4000]), p = c.pugLang(kv, kf, x);
      return numQ(MB + 'Wetterstation WS-6: variable Kosten ' + f(kv, 2) + ' € je Stück, Fixkosten ' + f(kf, 0) + ' € im Monat, geplante Menge ' + f(x, 0) + ' Stück. Wie hoch ist die langfristige Preisuntergrenze je Stück?',
        ['Verteile die Fixkosten auf die Menge: Fixkosten / Stück.', 'Zähle die variablen Kosten je Stück dazu.', 'Das Ergebnis sind die Selbstkosten je Stück.'], p, '€', 'langfristige Preisuntergrenze', 0.005,
        'Fixkosten je Stück: ' + f(kf, 0) + ' / ' + f(x, 0) + ' = ' + f(kf / x, 2) + ' €. Langfristige Preisuntergrenze = ' + f(kv, 2) + ' + ' + f(kf / x, 2) + ' = ' + f(p, 2) + ' €.', ['Langfristig müssen alle Kosten gedeckt sein.', 'Lösungsweg: ' + f(kv, 2) + ' + ' + f(kf, 0) + ' / ' + f(x, 0) + ' = ?']);
    },
    be: R => {
      const c = C(), p = c.pick(R, [25, 30, 35, 40]), kv = c.pick(R, [13, 15, 17, 19]), kf = c.pick(R, [18000, 21000, 24000, 30000]), b = c.breakEven(kf, p, kv);
      return numQ(MB + 'Gartenleuchte GL-8: Preis ' + f(p, 2) + ' €, variable Kosten ' + f(kv, 2) + ' € je Stück, Fixkosten ' + f(kf, 0) + ' € im Monat. Ab welcher Menge macht der Betrieb keinen Verlust mehr (Gewinnschwelle, aufgerundet)?',
        ['Rechne den Deckungsbeitrag je Stück.', 'Teile die Fixkosten durch den Deckungsbeitrag je Stück.', 'Runde auf ganze Stück auf.'], b, 'Stück', 'Gewinnschwelle', 0.01,
        'DB je Stück: ' + f(p, 2) + ' − ' + f(kv, 2) + ' = ' + f(p - kv, 2) + ' €. Gewinnschwelle: ' + f(kf, 0) + ' / ' + f(p - kv, 2) + ' = ' + f(kf / (p - kv), 2) + ', aufgerundet ' + f(b, 0) + ' Stück.', ['Gewinnschwelle (Break-even) = Fixkosten / Deckungsbeitrag je Stück.', 'Lösungsweg: ' + f(kf, 0) + ' / (' + f(p, 2) + ' − ' + f(kv, 2) + ') = ?, dann aufrunden']);
    },
    zus: R => {
      const c = C(), kv = c.pick(R, [16, 18, 20]), pz = kv + c.pick(R, [-2, -1, 1.5, 2, 3, 4]), x = c.pick(R, [400, 500, 800, 1000]), d = (pz - kv) * x;
      return numQ(MB + 'Ein Händler will einmalig ' + f(x, 0) + ' Bewegungsmelder BM-2 für ' + f(pz, 2) + ' € je Stück. Die Selbstkosten liegen bei 26,00 € je Stück, davon variabel ' + f(kv, 2) + ' €. Kapazität ist frei, die Fixkosten bleiben gleich. Um wie viel Euro ändert sich das Betriebsergebnis durch den Zusatzauftrag? (Verschlechterung negativ)',
        ['Bei freier Kapazität zählen nur die variablen Kosten, die Fixkosten fallen sowieso an.', 'Rechne den Deckungsbeitrag je Stück: Angebotspreis − variable Kosten.', 'Multipliziere mit der Menge.'], d, '€', 'Änderung des Ergebnisses', 0.5,
        'DB je Stück: ' + f(pz, 2) + ' − ' + f(kv, 2) + ' = ' + f(pz - kv, 2) + ' €. Änderung: ' + f(pz - kv, 2) + ' · ' + f(x, 0) + ' = ' + f(d, 2) + ' €. ' + (d > 0 ? 'Der Auftrag lohnt sich kurzfristig, obwohl der Preis unter den Selbstkosten liegt.' : 'Der Preis deckt nicht einmal die variablen Kosten: ablehnen.'), ['Die Selbstkosten sind hier eine Falle. Was ändert sich wirklich?', 'Lösungsweg: (' + f(pz, 2) + ' − ' + f(kv, 2) + ') · ' + f(x, 0) + ' = ?']);
    },
    pa: R => {
      const c = C(), a = c.pick(R, [3000, 4000, 5000]), b = c.pick(R, [50, 60, 80, 100]), kv = c.pick(R, [10, 12, 15]), top = a / b;
      const ps = [0.35, 0.5, 0.65, 0.8].map(k => Math.round(top * k)), rows = ps.map(p => ({ p, x: c.absatz(a, b, p), d: (p - kv) * c.absatz(a, b, p) }));
      let best = rows[0]; rows.forEach(r => { if (r.d > best.d) best = r; });
      if (rows.filter(r => r.d === best.d).length > 1) return G.pa(R);
      return choiceQ(R, MB + 'Für die Funk-Türklingel TK-3 wird geschätzt (Preis-Absatz einfach, je Monat): ' + rows.map(r => 'bei ' + f(r.p, 0) + ' € ' + f(r.x, 0) + ' Stück').join('; ') + '. Variable Kosten: ' + f(kv, 0) + ' € je Stück. Bei welchem Preis ist der gesamte Deckungsbeitrag am höchsten?', ['Rechne je Preis den Deckungsbeitrag je Stück: Preis − variable Kosten.', 'Multipliziere mit der jeweiligen Absatzmenge.', 'Wähle den Preis mit dem größten Gesamtbetrag.'], f(best.p, 0) + ' €', rows.filter(r => r !== best).map(r => f(r.p, 0) + ' €'),
        rows.map(r => f(r.p, 0) + ' €: (' + f(r.p, 0) + ' − ' + f(kv, 0) + ') · ' + f(r.x, 0) + ' = ' + f(r.d, 0) + ' €').join('; ') + '. Am höchsten bei ' + f(best.p, 0) + ' €. Höherer Preis heißt weniger Absatz: Der beste Preis liegt dazwischen.', ['Nicht der höchste Preis und nicht die größte Menge zählen, sondern das Produkt aus beiden.', 'Lösungsweg: je Preis (Preis − ' + f(kv, 0) + ') · Menge, dann vergleichen.']);
    },
    pstrat: pq(PSTRAT, ['Lies, wie der Preis gesetzt wird: hoch oder niedrig, dauerhaft oder nur am Anfang, für alle gleich?', 'Vergleiche mit den Preisstrategien in der Hilfe.', 'Wähle die passende Strategie.']),
    /* Kommunikation und Werbeerfolg */
    aida: cq(aidaE, AIDAN, 'Welche Stufe des AIDA-Modells spricht die Maßnahme vor allem an?', ['Lies, was die Maßnahme beim Kunden erreichen soll.', 'Hinsehen, mehr wissen, haben wollen oder kaufen?', 'Wähle die passende Stufe.'], ['AIDA: Attention, Interest, Desire, Action.', 'Aufmerksamkeit wecken, Interesse halten, Wunsch erzeugen, zum Kauf auffordern.']),
    kjk: R => {
      const c = C(), n = c.pick(R, [8000, 12000, 20000, 25000, 40000]), k = c.pick(R, [0.05, 0.08, 0.12, 0.15, 0.2, 0.25]), K = n * k;
      return numQ(MB + 'Eine Anzeige für die Wetterstation WS-6 in einem Gartenmagazin kostet ' + f(K, 2) + ' €. Das Magazin erreicht ' + f(n, 0) + ' Leser. Wie hoch sind die Kosten je Kontakt in Euro?',
        ['Suche die Kosten der Werbung.', 'Suche die Zahl der erreichten Kontakte (Leser).', 'Teile die Kosten durch die Kontakte.'], k, '€', 'Kosten je Kontakt', 0.005,
        'Kosten je Kontakt = ' + f(K, 2) + ' € / ' + f(n, 0) + ' = ' + f(k, 2) + ' €.', ['Kosten je Kontakt = Werbekosten / Zahl der Kontakte.', 'Lösungsweg: ' + f(K, 2) + ' / ' + f(n, 0) + ' = ?']);
    },
    tkp: R => {
      const c = C(), n = c.pick(R, [50000, 80000, 120000, 150000, 250000]), t = c.pick(R, [6, 8, 12, 15, 22, 30]), K = n * t / 1000;
      return numQ(MB + 'Eine Werbung in einem Online-Portal kostet ' + f(K, 2) + ' € und erreicht ' + f(n, 0) + ' Kontakte. Wie hoch ist der Tausend-Kontakt-Preis (TKP)?',
        ['Teile die Kosten durch die Kontakte.', 'Multipliziere mit 1.000.', 'Der TKP sind die Kosten für 1.000 Kontakte.'], t, '€', 'Tausend-Kontakt-Preis', 0.005,
        'TKP = ' + f(K, 2) + ' € / ' + f(n, 0) + ' · 1.000 = ' + f(t, 2) + ' €.', ['TKP = Werbekosten / Kontakte · 1.000.', 'Lösungsweg: ' + f(K, 2) + ' / ' + f(n, 0) + ' · 1.000 = ?']);
    },
    rend: R => {
      const c = C(), v = c.pick(R, [80000, 120000, 150000, 200000]), k = c.pick(R, [4000, 5000, 8000, 10000]), r = c.pick(R, [150, 250, 300, 400, 500]), z = k * r / 100, n = v + z, wr = c.werberendite(z, k);
      return numQ(MB + 'Vor einer Werbeaktion für Rauchmelder lag der Umsatz bei ' + f(v, 0) + ' € im Monat, danach bei ' + f(n, 0) + ' €. Die Aktion kostete ' + f(k, 0) + ' €. Andere Gründe für den Zuwachs gab es nicht. Wie hoch ist die Werberendite in Prozent?',
        ['Rechne den Umsatzzuwachs: Umsatz danach − Umsatz davor.', 'Teile den Umsatzzuwachs durch die Werbekosten.', 'Multipliziere mit 100.'], wr, '%', 'Werberendite', 0.05,
        'Umsatzzuwachs: ' + f(n, 0) + ' − ' + f(v, 0) + ' = ' + f(z, 0) + ' €. Werberendite = ' + f(z, 0) + ' / ' + f(k, 0) + ' · 100 = ' + f(wr, 2) + ' %. Jeder Werbe-Euro brachte ' + f(wr / 100, 2) + ' € mehr Umsatz.', ['Werberendite = Umsatzzuwachs / Werbekosten · 100.', 'Lösungsweg: (' + f(n, 0) + ' − ' + f(v, 0) + ') / ' + f(k, 0) + ' · 100 = ?']);
    },
    ctr: R => {
      const c = C(), e = c.pick(R, [20000, 40000, 50000, 80000, 120000]), r = c.pick(R, [0.4, 0.8, 1.2, 1.5, 2, 2.5]), k = e * r / 100;
      return numQ(MB + 'Eine Suchanzeige für die Smart-Steckdose wurde ' + f(e, 0) + '-mal eingeblendet und ' + f(k, 0) + '-mal angeklickt. Wie hoch ist die Klickrate in Prozent?',
        ['Suche die Zahl der Einblendungen.', 'Teile die Klicks durch die Einblendungen.', 'Multipliziere mit 100.'], r, '%', 'Klickrate', 0.005,
        'Klickrate = ' + f(k, 0) + ' / ' + f(e, 0) + ' · 100 = ' + f(r, 2) + ' %.', ['Klickrate = Klicks / Einblendungen · 100.', 'Lösungsweg: ' + f(k, 0) + ' / ' + f(e, 0) + ' · 100 = ?']);
    },
    konv: R => {
      const c = C(), b = c.pick(R, [800, 1200, 1500, 2000, 2500]), r = c.pick(R, [1.5, 2, 2.4, 3, 4, 5]), a = b * r / 100;
      return numQ(MB + 'Über eine Werbeaktion kamen ' + f(b, 0) + ' Besucher in den Webshop. ' + f(a, 0) + ' von ihnen haben eine Gartenleuchte bestellt. Wie hoch ist die Konversionsrate in Prozent?',
        ['Suche die Zahl der Besucher.', 'Teile die Bestellungen durch die Besucher.', 'Multipliziere mit 100.'], r, '%', 'Konversionsrate', 0.005,
        'Konversionsrate = ' + f(a, 0) + ' / ' + f(b, 0) + ' · 100 = ' + f(r, 2) + ' %.', ['Konversionsrate = Bestellungen / Besucher · 100.', 'Lösungsweg: ' + f(a, 0) + ' / ' + f(b, 0) + ' · 100 = ?']);
    },
    kvgl: R => {
      const c = C(); let A, B, ka, kb;
      do {
        A = { K: c.pick(R, [2000, 3000, 4000]), n: c.pick(R, [40000, 60000, 100000]), r: c.pick(R, [1, 1.5, 2]), k: c.pick(R, [2, 4, 5]) };
        B = { K: c.pick(R, [2000, 3000, 4000]), n: c.pick(R, [40000, 60000, 100000]), r: c.pick(R, [1, 1.5, 2]), k: c.pick(R, [2, 4, 5]) };
        ka = A.K / (A.n * A.r / 100 * A.k / 100); kb = B.K / (B.n * B.r / 100 * B.k / 100);
      } while (Math.abs(ka - kb) < 1);
      const d = (x, nm) => nm + ': Kosten ' + f(x.K, 0) + ' €, ' + f(x.n, 0) + ' Kontakte, Reaktionsrate ' + f(x.r, 1) + ' %, davon bestellen ' + f(x.k, 0) + ' %';
      const auf = x => x.n * x.r / 100 * x.k / 100, right = ka < kb ? 'Kanal A' : 'Kanal B';
      return choiceQ(R, MB + 'Zwei Werbewege für die Wetterstation: ' + d(A, 'Kanal A') + '. ' + d(B, 'Kanal B') + '. Welcher Kanal hat die niedrigeren Kosten je Auftrag?', ['Rechne je Kanal die Reaktionen: Kontakte · Reaktionsrate.', 'Rechne die Aufträge: Reaktionen · Bestellquote.', 'Teile die Kosten durch die Aufträge und vergleiche.'], right, [right === 'Kanal A' ? 'Kanal B' : 'Kanal A', 'Beide gleich teuer je Auftrag'],
        'Kanal A: ' + f(A.n, 0) + ' · ' + f(A.r, 1) + ' % · ' + f(A.k, 0) + ' % = ' + f(auf(A), 0) + ' Aufträge, ' + f(ka, 2) + ' € je Auftrag. Kanal B: ' + f(B.n, 0) + ' · ' + f(B.r, 1) + ' % · ' + f(B.k, 0) + ' % = ' + f(auf(B), 0) + ' Aufträge, ' + f(kb, 2) + ' € je Auftrag. Günstiger: ' + right + '.', ['Nicht die Kosten je Kontakt entscheiden, sondern was am Ende bestellt wird.', 'Lösungsweg: Kosten / (Kontakte · Reaktionsrate · Bestellquote) je Kanal.']);
    },
    wplan: pq(WPLAN, ['Lies die Beschreibung und kläre, ob es um Personen, Medium, Inhalt, Zeit oder Geld geht.', 'Vergleiche mit den Teilen des Werbeplans in der Hilfe.', 'Wähle den passenden Begriff.']),
    /* Recht */
    recht: pq(RECHT, ['Lies den Fall und kläre: Wer wird angesprochen (Verbraucher, Kunde, Mitbewerber)?', 'Prüfe: Gibt es eine Einwilligung, eine wahre Aussage, eine richtige Preisangabe?', 'Wähle die Antwort mit der passenden Regel.'])
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    [CATS[0], 1, 'Woher die Daten kommen', 'art'], [CATS[0], 1, 'Wie die Daten entstehen', 'meth'], [CATS[0], 1, 'Unser Stück vom Markt', 'ant'], [CATS[0], 2, 'Wie voll der Markt ist', 'satt'], [CATS[0], 2, 'Im Vergleich zum Größten', 'rel'], [CATS[0], 2, 'Wächst der Markt', 'wach'], [CATS[0], 2, 'Umsatz aus dem Plan', 'ums'], [CATS[0], 1, 'Begriffe am Markt', 'mbeg'],
    [CATS[1], 1, 'Maßnahme zuordnen A', 'mix', [0, 1, 2, 3]], [CATS[1], 1, 'Maßnahme zuordnen B', 'mix', [4, 5, 6, 7]], [CATS[1], 1, 'Lage eines Produkts', 'plzd'], [CATS[1], 2, 'Was jetzt hilft', 'plzm'], [CATS[1], 2, 'Feld in der Matrix', 'bcg'], [CATS[1], 3, 'Rechnen und einordnen', 'bcg3'], [CATS[1], 3, 'Angestellt oder selbstständig', 'krit'], [CATS[1], 2, 'Wer im Außendienst günstiger ist', 'aussen'],
    [CATS[2], 1, 'Beitrag je Stück', 'db'], [CATS[2], 2, 'Gewinn oder Verlust', 'erg'], [CATS[2], 2, 'Untergrenze für kurze Zeit', 'pugk'], [CATS[2], 2, 'Untergrenze auf Dauer', 'pugl'], [CATS[2], 2, 'Ab wann es sich lohnt', 'be'], [CATS[2], 3, 'Ein Auftrag extra', 'zus'], [CATS[2], 3, 'Preis und Menge', 'pa'], [CATS[2], 1, 'Preis mit Plan', 'pstrat'],
    [CATS[3], 1, 'Stufe beim Kunden', 'aida'], [CATS[3], 1, 'Was ein Kontakt kostet', 'kjk'], [CATS[3], 2, 'Tausend Kontakte', 'tkp'], [CATS[3], 2, 'Was die Werbung brachte', 'rend'], [CATS[3], 1, 'Klicks auf die Anzeige', 'ctr'], [CATS[3], 2, 'Vom Besuch zur Bestellung', 'konv'], [CATS[3], 3, 'Zwei Wege im Vergleich', 'kvgl'], [CATS[3], 1, 'Teile des Werbeplans', 'wplan'],
    [CATS[4], 1, 'Werbung per E-Mail', 'recht', [0]], [CATS[4], 2, 'Werbung an Stammkunden', 'recht', [1]], [CATS[4], 1, 'Anruf bei Privatleuten', 'recht', [2]], [CATS[4], 2, 'Was die Anzeige verspricht', 'recht', [3, 8]], [CATS[4], 2, 'Mitbewerber in der Werbung', 'recht', [4, 5]], [CATS[4], 2, 'Preise richtig angeben', 'recht', [6, 7]], [CATS[4], 1, 'Bezahlter Beitrag', 'recht', [9]], [CATS[4], 1, 'Folgen und Schutz', 'recht', [10, 11]]
  ];
  const tasks = defs.map((d, i) => ({ id: 'mkt' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('mkt-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Zuordnungs-Sätze für den Reiter Begriffe ---------- */
  const SETS = {
    mf: { title: 'Marktforschung', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Arten', n: 'Primärforschung', d: 'Neue Daten werden eigens für eine Frage erhoben.', pts: ['Befragung, Beobachtung, Experiment, Panel', 'Genau, aber teuer'] },
      { g: 'Arten', n: 'Sekundärforschung', d: 'Vorhandene Daten (Statistik, Berichte, eigene Buchhaltung) werden ausgewertet.', pts: ['Schnell und günstig', 'Nicht immer genau passend'] },
      { g: 'Arten', n: 'Panel', d: 'Dieselbe Gruppe wird in festen Abständen zum gleichen Thema befragt oder beobachtet.', pts: ['Zeigt Veränderungen'] },
      { g: 'Arten', n: 'Beobachtung', d: 'Verhalten wird angesehen und gezählt, ohne zu fragen.', pts: ['z. B. Zählung am Regal'] },
      { g: 'Kennzahlen', n: 'Marktpotenzial', d: 'Größtmögliche Absatzmenge, wenn alle möglichen Käufer kaufen würden.', pts: ['Obergrenze'] },
      { g: 'Kennzahlen', n: 'Marktvolumen', d: 'Tatsächlicher Absatz aller Anbieter in einem Zeitraum.', pts: ['Alle Anbieter zusammen'] },
      { g: 'Kennzahlen', n: 'Marktanteil', d: 'Eigener Absatz im Verhältnis zum Marktvolumen in Prozent.', pts: ['Eigener Absatz / Marktvolumen · 100'] },
      { g: 'Kennzahlen', n: 'Sättigungsgrad', d: 'Marktvolumen im Verhältnis zum Marktpotenzial in Prozent.', pts: ['Nahe 100 % = Markt fast voll'] }
    ] },
    mix: { title: 'Mix, Lebenszyklus, Portfolio', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Marketing-Mix', n: 'Produktpolitik', d: 'Entscheidungen über Ware, Gestaltung, Sortiment, Garantie und Service.', pts: ['Product'] },
      { g: 'Marketing-Mix', n: 'Preispolitik', d: 'Entscheidungen über Preise, Rabatte und Zahlungsbedingungen.', pts: ['Price, auch Kontrahierungspolitik'] },
      { g: 'Marketing-Mix', n: 'Distributionspolitik', d: 'Entscheidungen über den Weg der Ware zum Kunden und wer verkauft.', pts: ['Place: Reisender, Handelsvertreter, Webshop'] },
      { g: 'Marketing-Mix', n: 'Kommunikationspolitik', d: 'Werbung, Verkaufsförderung, Öffentlichkeitsarbeit, Messen, Sponsoring.', pts: ['Promotion'] },
      { g: 'Lebenszyklus und Portfolio', n: 'Produktlebenszyklus', d: 'Modell für Umsatz und Gewinn eines Produkts von der Einführung bis zum Rückgang.', pts: ['Einführung, Wachstum, Reife, Sättigung, Rückgang'] },
      { g: 'Lebenszyklus und Portfolio', n: 'Star', d: 'Produkt mit hohem relativem Marktanteil in einem stark wachsenden Markt.', pts: ['Fördern'] },
      { g: 'Lebenszyklus und Portfolio', n: 'Cash Cow', d: 'Produkt mit hohem relativem Marktanteil in einem kaum wachsenden Markt.', pts: ['Geld abschöpfen'] },
      { g: 'Lebenszyklus und Portfolio', n: 'Question Mark', d: 'Produkt mit kleinem relativem Marktanteil in einem stark wachsenden Markt.', pts: ['Fördern oder aufgeben'] },
      { g: 'Lebenszyklus und Portfolio', n: 'Poor Dog', d: 'Produkt mit kleinem relativem Marktanteil in einem kaum wachsenden Markt.', pts: ['Eher aufgeben'] }
    ] },
    preis: { title: 'Preispolitik', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Rechnung', n: 'Deckungsbeitrag', d: 'Preis minus variable Kosten, je Stück oder gesamt.', pts: ['Deckt erst die Fixkosten, dann Gewinn'] },
      { g: 'Rechnung', n: 'Kurzfristige Preisuntergrenze', d: 'Preis, der gerade noch die variablen Kosten je Stück deckt.', pts: ['Deckungsbeitrag = 0'] },
      { g: 'Rechnung', n: 'Langfristige Preisuntergrenze', d: 'Preis, der alle Kosten je Stück deckt (Selbstkosten).', pts: ['Variable Kosten + Fixkosten / Menge'] },
      { g: 'Rechnung', n: 'Gewinnschwelle', d: 'Menge, bei der der Deckungsbeitrag gesamt die Fixkosten genau deckt.', pts: ['Break-even', 'Fixkosten / DB je Stück'] },
      { g: 'Strategien', n: 'Abschöpfungsstrategie', d: 'Hoher Einführungspreis, später schrittweise gesenkt.', pts: ['Skimming'] },
      { g: 'Strategien', n: 'Durchdringungsstrategie', d: 'Niedriger Einführungspreis, um den Markt schnell zu erobern, später erhöht.', pts: ['Penetration'] },
      { g: 'Strategien', n: 'Preisdifferenzierung', d: 'Gleiches Produkt zu verschiedenen Preisen je nach Kunde, Ort, Zeit oder Menge.', pts: ['z. B. Winterpreis'] },
      { g: 'Strategien', n: 'Prämienpreis', d: 'Dauerhaft hoher Preis für ein hochwertiges Produkt.', pts: ['Hochpreisstrategie'] }
    ] },
    kom: { title: 'Kommunikation', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Werbeplan', n: 'Werbeträger', d: 'Medium, das die Werbung zum Kunden bringt, z. B. Zeitschrift oder Webseite.', pts: ['Trägt das Werbemittel'] },
      { g: 'Werbeplan', n: 'Werbemittel', d: 'Die gestaltete Werbung selbst, z. B. Anzeige, Spot oder Plakat.', pts: ['Was der Kunde sieht'] },
      { g: 'Werbeplan', n: 'Streuzeit', d: 'Zeitraum und Häufigkeit der Werbung.', pts: ['Wann und wie oft'] },
      { g: 'Werbeplan', n: 'Werbeetat', d: 'Geld, das für die Werbung zur Verfügung steht.', pts: ['Budget'] },
      { g: 'Erfolg', n: 'Tausend-Kontakt-Preis', d: 'Werbekosten für 1.000 erreichte Kontakte.', pts: ['Kosten / Kontakte · 1.000'] },
      { g: 'Erfolg', n: 'Werberendite', d: 'Umsatzzuwachs im Verhältnis zu den Werbekosten in Prozent.', pts: ['Zuwachs / Kosten · 100'] },
      { g: 'Erfolg', n: 'Klickrate', d: 'Anteil der Klicks an den Einblendungen einer Anzeige.', pts: ['Klicks / Einblendungen · 100'] },
      { g: 'Erfolg', n: 'Konversionsrate', d: 'Anteil der Besucher, die bestellen.', pts: ['Bestellungen / Besucher · 100'] }
    ] },
    recht: { title: 'Recht im Marketing', prompt: 'Welcher Begriff passt?', items: [
      { g: 'UWG', n: 'Irreführende Werbung', d: 'Werbung mit unwahren oder täuschenden Angaben, z. B. über Eigenschaften oder Preis.', pts: ['§ 5 UWG'] },
      { g: 'UWG', n: 'Vergleichende Werbung', d: 'Werbung, die einen Mitbewerber oder dessen Waren erkennbar macht.', pts: ['Erlaubt, wenn sachlich und nachprüfbar', '§ 6 UWG'] },
      { g: 'UWG', n: 'Unzumutbare Belästigung', d: 'Werbung, die der Empfänger erkennbar nicht will, z. B. E-Mail oder Anruf ohne Einwilligung.', pts: ['§ 7 UWG'] },
      { g: 'UWG', n: 'Abmahnung', d: 'Aufforderung, einen Wettbewerbsverstoß zu unterlassen, meist mit Unterlassungserklärung.', pts: ['Vor einem Gerichtsverfahren'] },
      { g: 'Preisangaben', n: 'Gesamtpreis', d: 'Preis einschließlich Umsatzsteuer und sonstiger Preisbestandteile für Verbraucher.', pts: ['Preisangabenverordnung'] },
      { g: 'Preisangaben', n: '30-Tage-Preis', d: 'Bei einer Preisermäßigung der niedrigste Preis der letzten 30 Tage als Bezug.', pts: ['§ 11 PAngV'] },
      { g: 'Preisangaben', n: 'Lockangebot', d: 'Beworbenes Angebot, für das nicht genug Ware vorrätig ist.', pts: ['Irreführend ohne Hinweis'] }
    ] }
  };

  root.MKT_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, sets: SETS, pools: { MBEG, PSTRAT, WPLAN, RECHT } };
  root.MKT_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MKT_DATA, TASKS: root.MKT_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
