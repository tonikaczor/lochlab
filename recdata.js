'use strict';
/* Tonfunk Auftrag-und-Recht-Lab: Daten (Aufgaben-Generatoren, Beispiele, Zuordnungs-Sätze).
   KEINE RECHTSBERATUNG. Prozentsätze, Fristen und Beträge sind ÜBUNGSWERTE; Gesetze ändern sich.
   window.REC_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, sets }
   window.REC_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'rec', Status in localStorage 'lm4.rec.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch den Fehler (Titel bleiben neutral, ohne Zahlen).
   Abgrenzung: Kalkulation (Bezugs-/Selbstkosten, Skonto in der Kalkulation) steht in kallab, Buchungssätze/Umsatzsteuer/Personalbuchung in buclab. Hier nur Recht, Fristen, Belege, einfache Abrechnung. */
(function (root) {
  const C = () => root.REC_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const dt = ms => C().fmtDate(ms);
  const CATS = ['Vertragsabschluss', 'Vertragsarten', 'Vertragsstörungen', 'Fristen', 'Zahlung und Eigentumsvorbehalt', 'Belegkette', 'Lohn und Arbeitsvertrag'];

  const numQ = (text, value, unit, label, tol, expl, tips, meta) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, meta: meta || null });
  function choiceQ(R, text, right, wrong, expl, tips, meta) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, meta: meta || null };
  }
  /* Pool-Aufgabe: [Text, richtig, falsch[], Erklärung, Tipps] */
  const pq = POOL => R => { const q = POOL[C().ri(R, 0, POOL.length - 1)]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  /* n verschiedene Werte aus cands, die ungleich right sind */
  function distinct(R, right, cands, n) {
    const seen = new Set([right]), out = [];
    C().shuffle(R, cands).forEach(x => { if (!seen.has(x) && out.length < n) { seen.add(x); out.push(x); } });
    return out;
  }

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P16: Katalog, Preisliste und Werbung an einen unbestimmten Personenkreis gelten hier als bloße Aufforderung zur Bestellung (kein bindendes Angebot). Entspricht das eurem Lehrbuch? */
  const P_ANF = [
    ['Ein Einkäufer fragt bei einem Lieferanten nach Preis und Lieferzeit für 200 Schrauben und legt sich noch nicht fest. Wie nennt man diesen Beleg?', 'Anfrage (unverbindlich)', ['Angebot', 'Bestellung', 'Auftragsbestätigung'], 'Die Anfrage kommt vom Käufer und ist unverbindlich. Die Anfrage holt nur Informationen und Preise ein.', ['Wer fragt hier, und legt er sich schon fest?', 'Eine Anfrage bindet weder den Käufer noch den Lieferanten.']],
    ['Ein Lieferant schickt auf eine Anfrage ein schriftliches Angebot mit Menge, Preis und Lieferzeit, ohne Einschränkung. Wie ist er gebunden?', 'Er ist an sein Angebot gebunden, solange es gilt', ['Gar nicht, ein Angebot ist immer unverbindlich', 'Nur, wenn der Kunde vorher angerufen hat', 'Nur, wenn ein Notar es beglaubigt'], 'Ein Angebot an eine bestimmte Person ist rechtlich ein Antrag. Der Anbieter ist daran gebunden, solange die Bindungsfrist läuft.', ['Das Angebot ist rechtlich ein Antrag.', 'Ein Antrag bindet den, der ihn macht.']],
    ['Ein Hersteller verschickt seinen Katalog mit Preisliste an viele Firmen. Was ist das rechtlich in der Regel?', 'Nur eine Aufforderung zur Bestellung, kein bindendes Angebot', ['Ein bindendes Angebot an jeden Empfänger des Katalogs', 'Eine Auftragsbestätigung für spätere Bestellungen', 'Eine Bestellung des Herstellers bei seinen Kunden'], 'Werbung und Kataloge richten sich an einen unbestimmten Personenkreis und binden den Hersteller nicht (Übungsregel). Erst eine Bestellung wäre ein Antrag.', ['Der Katalog geht an viele, nicht an eine bestimmte Firma.', 'Stell dir vor, alle würden gleichzeitig bestellen: Müsste der Hersteller alles liefern?']],
    ['Wer schickt die Anfrage, und an wen?', 'Der Käufer an den Lieferanten', ['Der Lieferant an den Käufer', 'Die Bank an den Käufer', 'Das Finanzamt an den Lieferanten'], 'Die Anfrage ist der erste Beleg der Kaufabwicklung. Der Beleg geht vom Käufer an einen oder mehrere Lieferanten.', ['Wer will etwas wissen?', 'Ohne Anfrage gibt es oft noch kein Angebot.']]
  ];
  const P_ANTRAG = [
    ['Ein Kunde bestellt ohne vorheriges Angebot 50 Stück zu einem genannten Preis. Wie nennt man seine Erklärung rechtlich?', 'Antrag (Vertragsangebot des Kunden)', ['Annahme (Zustimmung zum Angebot)', 'Anfrage (unverbindliche Preisauskunft)', 'Mahnung (Zahlungsaufforderung)'], 'Wer ohne bindendes Angebot bestellt, macht selbst einen Antrag. Der Lieferant kann ihn annehmen oder ablehnen.', ['Gibt es schon einen Antrag des Lieferanten?', 'Die erste verbindliche Erklärung ist der Antrag.']],
    ['Ein Lieferant bestätigt eine Bestellung schriftlich ohne Änderungen. Was ist das rechtlich, wenn die Bestellung der Antrag war?', 'Die Annahme: Der Kaufvertrag kommt zustande', ['Ein neuer Antrag: Der Vertrag steht noch aus', 'Eine Anfrage: Der Lieferant will nur Preise wissen', 'Eine Mahnung: Der Kunde soll endlich zahlen'], 'Die unveränderte Auftragsbestätigung ist die Annahme des Antrags. Dann gibt es zwei übereinstimmende Willenserklärungen.', ['Zu einem Antrag gehört die Annahme.', 'Wer nimmt hier den Antrag an?']],
    ['Wie kommt ein Kaufvertrag zustande?', 'Durch zwei übereinstimmende Willenserklärungen: Antrag und Annahme', ['Erst mit der Rechnung, die der Lieferant schreibt', 'Erst mit der Lieferung der Ware an den Kunden', 'Erst mit der Bezahlung durch den Kunden'], 'Der Vertrag entsteht durch Antrag und Annahme. Lieferung und Zahlung sind schon die Erfüllung des Vertrags.', ['Es braucht zwei Seiten, die sich einig sind.', 'Lieferung und Zahlung kommen später.']],
    ['Ein Kunde nimmt ein bindendes Angebot, das noch gilt, mit einer unveränderten Bestellung an. Wann ist der Kaufvertrag zustande gekommen?', 'Sobald die Bestellung beim Lieferanten eingeht', ['Erst, wenn der Lieferant eine Auftragsbestätigung schickt', 'Erst bei der Lieferung', 'Erst bei der Zahlung'], 'Das bindende Angebot war der Antrag, die Bestellung ist die Annahme. Eine Auftragsbestätigung ist dann nicht mehr nötig (sie dient nur zur Klarheit).', ['Wer hat den Antrag gemacht, wer die Annahme?', 'Ist nach der Annahme noch eine weitere Erklärung nötig?']]
  ];
  /* PRUEFEN P17: Abgrenzung der Vertragsarten (Kauf: Ware gegen Geld und Eigentum; Werk: geschuldeter Erfolg; Dienst: Tätigkeit; Miete: Gebrauch auf Zeit gegen Miete; Arbeitsvertrag als besonderer Dienstvertrag). Nicht behandelt: Werklieferungsvertrag, Leasing, Pacht, Leihe. Reicht das für das Lab? */
  const P_ART = [
    ['Ein Betrieb erhält 500 Schrauben und zahlt dafür einen Preis. Welche Vertragsart?', 'Kaufvertrag', ['Werkvertrag', 'Dienstvertrag', 'Mietvertrag'], 'Beim Kaufvertrag wird Ware gegen Geld getauscht und das Eigentum übertragen.', ['Es geht um Ware gegen Geld.', 'Das Eigentum geht auf den Betrieb über.']],
    ['Eine Firma lässt für einen festen Preis ihre Halle streichen. Geschuldet ist die fertig gestrichene Halle. Welche Vertragsart?', 'Werkvertrag', ['Kaufvertrag', 'Dienstvertrag', 'Mietvertrag'], 'Beim Werkvertrag wird ein bestimmter Erfolg geschuldet: hier die fertig gestrichene Halle.', ['Was genau schuldet der Maler: Zeit oder Ergebnis?', 'Es gibt ein fertiges Ergebnis.']],
    ['Ein Betrieb zahlt monatlich für einen Gabelstapler, den er nutzen darf. Nach Vertragsende gibt er ihn zurück. Welche Vertragsart?', 'Mietvertrag', ['Kaufvertrag', 'Werkvertrag', 'Dienstvertrag'], 'Beim Mietvertrag wird der Gebrauch einer Sache auf Zeit gegen Miete überlassen. Das Eigentum bleibt beim Vermieter.', ['Wem gehört der Stapler am Ende?', 'Gebrauch gegen regelmäßige Zahlung.']],
    ['Ein Unternehmen beschäftigt eine Beraterin für Schulungen, abgerechnet wird nach Stunden. Ein bestimmter Erfolg wird nicht zugesagt. Welche Vertragsart?', 'Dienstvertrag', ['Werkvertrag', 'Kaufvertrag', 'Mietvertrag'], 'Beim Dienstvertrag wird die Tätigkeit geschuldet, nicht ein bestimmter Erfolg.', ['Wird ein Erfolg zugesagt oder die Arbeitszeit bezahlt?', 'Abrechnung nach Stunden ist ein Hinweis.']]
  ];
  const P_ERFOLG = [
    ['Was unterscheidet den Werkvertrag vom Dienstvertrag?', 'Beim Werkvertrag wird ein Erfolg geschuldet, beim Dienstvertrag die Tätigkeit', ['Beim Werkvertrag wird die Tätigkeit geschuldet, beim Dienstvertrag ein Erfolg', 'Der Werkvertrag braucht immer die Schriftform', 'Beim Dienstvertrag geht das Eigentum über'], 'Werkvertrag: Erfolg (Ergebnis). Dienstvertrag: Tätigkeit (Arbeitsleistung), auch wenn das Ergebnis ausbleibt.', ['Denk an Ergebnis und Bemühen.', 'Der Handwerker, der die Anlage fertig einbaut, schuldet ein Ergebnis.']],
    ['Ein Elektriker baut eine Anlage ein, die danach funktionieren muss. Welche Vertragsart?', 'Werkvertrag (geschuldet ist die funktionierende Anlage)', ['Dienstvertrag (geschuldet ist die Arbeitszeit)', 'Kaufvertrag (geschuldet ist die Lieferung von Ware)', 'Mietvertrag (geschuldet ist die Nutzung auf Zeit)'], 'Geschuldet ist ein bestimmter Erfolg: die funktionierende Anlage. Das ist ein Werkvertrag.', ['Was soll am Ende herauskommen?', 'Der Erfolg ist die funktionierende Anlage.']],
    ['Worin unterscheiden sich Kaufvertrag und Mietvertrag?', 'Beim Kauf geht das Eigentum über, bei der Miete nur der Gebrauch auf Zeit', ['Beim Kauf wird nur der Gebrauch überlassen, bei der Miete das Eigentum', 'Es gibt keinen Unterschied', 'Die Miete braucht keine Zahlung'], 'Kauf: Ware und Eigentum gegen Kaufpreis. Miete: Gebrauch auf Zeit gegen Miete, das Eigentum bleibt beim Vermieter.', ['Wem gehört die Sache nach Vertragsende?', 'Zeitlich begrenzt oder endgültig?']],
    ['Ein Mitarbeiter arbeitet gegen monatliches Gehalt weisungsgebunden im Betrieb. Welcher Vertrag liegt zugrunde?', 'Arbeitsvertrag (besondere Form des Dienstvertrags)', ['Werkvertrag (geschuldet ist ein Erfolg)', 'Mietvertrag (Gebrauch gegen Miete)', 'Kaufvertrag (Ware gegen Geld)'], 'Im Arbeitsvertrag wird die Arbeitsleistung geschuldet (Tätigkeit), nicht ein bestimmter Erfolg. Er ist ein besonderer Dienstvertrag.', ['Wird ein Ergebnis oder die Arbeitszeit geschuldet?', 'Weisungsgebundenheit ist typisch für den Arbeitsvertrag.']]
  ];
  /* PRUEFEN P18: Hauptpflichten im Kaufvertrag (§ 433 BGB): Verkäufer übergibt mangelfrei und verschafft Eigentum, Käufer zahlt und nimmt ab. Trennung Verpflichtungs- und Erfüllungsgeschäft (Trennungsprinzip) in einfacher Sprache. Passt das zum Unterricht? */
  const P_PFLICHT = [
    ['Welche Hauptpflichten hat der Verkäufer im Kaufvertrag?', 'Die Ware mangelfrei übergeben und das Eigentum verschaffen', ['Die Ware bezahlen und vom Lieferanten abnehmen', 'Nur die Rechnung schreiben und versenden', 'Die Ware auf eigene Kosten für den Käufer versichern'], 'Der Verkäufer muss die Sache übergeben, das Eigentum verschaffen und dafür sorgen, dass sie frei von Mängeln ist.', ['Es geht um das, was der Verkäufer leisten muss.', 'Zahlung ist Sache des Käufers.']],
    ['Welche Hauptpflichten hat der Käufer im Kaufvertrag?', 'Den Kaufpreis zahlen und die Ware abnehmen', ['Die Ware herstellen und liefern', 'Nur die Ware prüfen, nicht bezahlen', 'Das Eigentum verschaffen'], 'Der Käufer muss den vereinbarten Preis zahlen und die Ware abnehmen.', ['Gegenleistung zur Ware.', 'Annahme und Zahlung.']],
    ['Wann ist ein Kaufvertrag erfüllt?', 'Wenn die Ware übergeben und der Kaufpreis gezahlt ist', ['Sobald die Rechnung geschrieben und versendet ist', 'Sobald die Bestellung beim Lieferanten eingeht', 'Sobald die Ware verpackt und versandbereit ist'], 'Erfüllt ist der Vertrag, wenn beide Seiten das Geschuldete geleistet haben: Ware übergeben und Preis gezahlt.', ['Beide Seiten müssen leisten.', 'Rechnung und Verpackung sind nur Vorbereitung.']],
    ['Der Kaufvertrag verpflichtet zur Lieferung; die Übergabe mit Eigentumsübertragung ist ein eigener Schritt. Was gilt?', 'Zwei getrennte Vorgänge: erst Verpflichtung, dann Erfüllung', ['Beides ist immer ein einziger Vorgang zur gleichen Zeit', 'Der Vertrag macht den Käufer sofort zum Eigentümer', 'Die Übergabe der Ware kommt immer vor dem Kaufvertrag'], 'Der Kaufvertrag verpflichtet nur (Verpflichtungsgeschäft). Eigentum und Besitz gehen erst mit der Erfüllung über.', ['Zuerst verspricht man etwas, dann leistet man es.', 'Wann wird die Ware übergeben?']]
  ];
  const P_STOER = [
    ['Die bestellte Ware kommt nicht zum vereinbarten Termin an. Welche Störung liegt vor?', 'Lieferverzug', ['Zahlungsverzug', 'Mangelhafte Lieferung', 'Annahmeverzug'], 'Der Lieferant leistet nicht rechtzeitig: Das ist Lieferverzug (Nicht-rechtzeitig-Lieferung).', ['Wer ist im Rückstand, Lieferant oder Kunde?', 'Es geht um die Zeit, nicht um die Qualität.']],
    ['Der Kunde bezahlt die Rechnung nicht zum vereinbarten Termin. Welche Störung liegt vor?', 'Zahlungsverzug', ['Lieferverzug', 'Mangelhafte Lieferung', 'Annahmeverzug'], 'Der Kunde zahlt nicht rechtzeitig: Zahlungsverzug (Nicht-rechtzeitig-Zahlung).', ['Wer ist im Rückstand?', 'Es geht um Geld.']],
    ['Die Lieferung kommt pünktlich, aber die Hälfte der Teile ist verbogen. Welche Störung liegt vor?', 'Mangelhafte Lieferung (Schlechtleistung)', ['Lieferverzug (Lieferung zu spät)', 'Zahlungsverzug (Zahlung zu spät)', 'Annahmeverzug (Ware nicht angenommen)'], 'Zeit und Menge stimmen, aber die Beschaffenheit nicht: Das ist eine mangelhafte Lieferung.', ['Pünktlich war die Ware ja.', 'Was stimmt mit der Ware nicht?']],
    ['Der Kunde weigert sich, die pünktlich angelieferte Ware anzunehmen. Welche Störung liegt vor?', 'Annahmeverzug', ['Lieferverzug', 'Zahlungsverzug', 'Mangelhafte Lieferung'], 'Der Kunde nimmt die ordnungsgemäß angebotene Ware nicht an: Annahmeverzug (Gläubigerverzug).', ['Wer verhindert hier die Erfüllung?', 'Der Lieferant hat alles richtig gemacht.']]
  ];
  /* PRUEFEN P19: Einteilung der Mängel nach Lehrbuch: Mangel in der Art (Falschlieferung), Güte (Qualität/Beschaffenheit), Menge, Montage. Rechtlich sind Falsch- und Zuweniglieferung nach § 434 BGB den Sachmängeln gleichgestellt. Welche Einteilung gilt bei euch? */
  const P_MANGEL = [
    ['Bestellt waren 100 Stück, geliefert wurden 80. Welche Art von Mangel ist das?', 'Mangel in der Menge (Quantitätsmangel)', ['Mangel in der Art (Falschlieferung)', 'Mangel in der Güte (Qualitätsmangel)', 'Montagemangel'], 'Es fehlt ein Teil der Menge: Quantitätsmangel.', ['Stimmt die Zahl der gelieferten Stücke?', 'Es fehlen Stücke.']],
    ['Bestellt waren Schrauben M8, geliefert wurden Muttern M8. Welche Art von Mangel ist das?', 'Mangel in der Art (Falschlieferung)', ['Mangel in der Menge (Quantitätsmangel)', 'Mangel in der Güte (Qualitätsmangel)', 'Montagemangel'], 'Es wurde eine andere Ware als bestellt geliefert: Falschlieferung (Mangel in der Art).', ['Ist es überhaupt die bestellte Ware?', 'Schrauben und Muttern sind verschiedene Artikel.']],
    ['Die gelieferten Schrauben sind rostig, obwohl rostfreie bestellt waren. Welche Art von Mangel ist das?', 'Mangel in der Güte (Qualitätsmangel)', ['Mangel in der Menge (Quantitätsmangel)', 'Mangel in der Art (Falschlieferung)', 'Montagemangel'], 'Die Ware ist die bestellte, aber ihre Beschaffenheit entspricht nicht der Vereinbarung: Qualitätsmangel.', ['Der Artikel stimmt, die Eigenschaft nicht.', 'Es geht um die Beschaffenheit.']],
    ['Ein Techniker baut eine gekaufte Maschine vereinbarungsgemäß ein, aber falsch, sodass sie nicht läuft. Welche Art von Mangel ist das?', 'Montagemangel', ['Mangel in der Menge (Quantitätsmangel)', 'Mangel in der Art (Falschlieferung)', 'Mangel in der Güte (Qualitätsmangel)'], 'Die Ware ist in Ordnung, aber die vereinbarte Montage wurde fehlerhaft ausgeführt.', ['Was wurde falsch gemacht: Ware oder Einbau?', 'Die Maschine selbst ist nicht schuld.']]
  ];
  /* PRUEFEN P20: Mahnung entbehrlich bei kalendermäßig bestimmtem Termin (§ 286 Abs. 2 Nr. 1 BGB), bei ernsthafter und endgültiger Erfüllungsverweigerung (Nr. 3) und bei Zahlungsverzug 30 Tage nach Fälligkeit und Rechnungszugang (§ 286 Abs. 3 BGB, gegenüber Unternehmen). Stimmen die drei Fälle für den Unterricht? */
  const MAHN = [
    'Ja: Ohne Mahnung tritt kein Verzug ein',
    'Nein: Der Termin ist nach dem Kalender bestimmt, der Verzug tritt ohne Mahnung ein',
    'Nein: Der Schuldner verweigert die Leistung ernsthaft und endgültig, eine Mahnung wäre sinnlos',
    'Nein: Der Kunde ist 30 Tage nach Zugang der Rechnung ohne Mahnung im Verzug'
  ];
  const P_REAKT = [
    ['Ein Kunde stellt fest, dass eine gelieferte Maschine nicht richtig läuft. Welches Recht muss er in der Regel zuerst geltend machen?', 'Nacherfüllung (Nachbesserung oder Ersatzlieferung)', ['Sofort vom Vertrag zurücktreten und alles zurückgeben', 'Sofort den Preis mindern und die Ware behalten', 'Sofort Schadensersatz in Geld verlangen'], 'Bei einem Mangel hat die Nacherfüllung Vorrang. Erst wenn sie scheitert, kommen Rücktritt oder Minderung in Betracht.', ['Der Verkäufer soll zuerst die Chance bekommen, den Mangel zu beheben.', 'Rücktritt und Minderung sind nachrangig.']],
    ['Wann darf der Käufer bei mangelhafter Ware zurücktreten oder mindern?', 'Wenn die Nacherfüllung scheiterte oder die Nachfrist erfolglos ablief', ['Immer sofort nach dem Kauf, ohne dem Verkäufer eine Chance zu geben', 'Nur, wenn der Verkäufer schriftlich seine Erlaubnis dazu gibt', 'Erst nach zwei Jahren, wenn die Gewährleistung endet'], 'Rücktritt und Minderung setzen voraus, dass der Verkäufer seine Chance zur Nacherfüllung ungenutzt ließ oder sie scheiterte.', ['Zuerst Nacherfüllung, dann die anderen Rechte.', 'Eine Frist muss erfolglos abgelaufen sein.']],
    ['Was bedeutet Nachbesserung?', 'Der Mangel wird beseitigt, die Ware also repariert', ['Eine neue, mangelfreie Ware wird geliefert', 'Der Preis wird gesenkt', 'Der Vertrag wird aufgehoben'], 'Nachbesserung heißt: reparieren. Ersatzlieferung wäre die Lieferung einer neuen Ware.', ['Besserer Zustand derselben Ware.', 'Neue Ware nennt man Ersatzlieferung.']],
    ['Was bedeutet Ersatzlieferung?', 'Der Verkäufer liefert eine neue, mangelfreie Ware nach', ['Der Mangel wird repariert', 'Der Preis wird gemindert', 'Der Käufer behält die Ware und bekommt Geld zurück'], 'Bei der Ersatzlieferung wird die mangelhafte Ware durch mangelfreie ersetzt.', ['Es kommt andere Ware.', 'Reparatur wäre Nachbesserung.']]
  ];
  const P_DAUER = [
    ['Wie lange dauert die regelmäßige Verjährungsfrist nach BGB (Übungswert)?', 'Drei Jahre', ['Ein Jahr', 'Zwei Jahre', 'Zehn Jahre'], 'Die regelmäßige Verjährungsfrist beträgt drei Jahre.', ['Die Zahl liegt zwischen zwei und vier.', 'Der Beginn liegt erst am Jahresende.']],
    ['Wann beginnt die regelmäßige Verjährung?', 'Mit dem Ende des Jahres, in dem der Anspruch entstanden ist', ['Am Tag der Bestellung durch den Kunden', 'Am Tag der ersten Mahnung durch den Lieferanten', 'Sechs Monate nach dem Rechnungsdatum'], 'Die Verjährung beginnt mit dem Schluss des Jahres, in dem der Anspruch entstanden ist (und der Gläubiger davon wusste). Deshalb endet sie am 31. Dezember.', ['Es zählt das Jahresende, nicht das Tagesdatum.', 'Daher endet sie immer an einem 31. Dezember.']],
    ['Wie lange dauert die Gewährleistungsfrist beim Kauf einer neuen beweglichen Sache (Übungswert)?', 'Zwei Jahre ab Ablieferung', ['Drei Jahre ab Jahresende', 'Sechs Monate ab Kauf', 'Zehn Jahre ab Rechnung'], 'Mängelansprüche verjähren beim Kauf neuer beweglicher Sachen nach zwei Jahren ab Ablieferung.', ['Die Frist ist kürzer als die regelmäßige Verjährung.', 'Maßgeblich ist die Übergabe der Ware.']],
    ['Ab wann läuft die Gewährleistungsfrist?', 'Ab der Ablieferung der Ware', ['Ab dem Vertragsschluss', 'Ab dem Rechnungsdatum', 'Ab der Zahlung'], 'Maßgeblich ist der Tag, an dem die Ware abgeliefert (übergeben) wird.', ['Die Ware muss beim Käufer sein.', 'Rechnung und Zahlung sind unwichtig.']]
  ];
  /* PRUEFEN P21: Eigentumsvorbehalt: einfacher (Eigentum geht erst mit vollständiger Zahlung über, § 449 BGB), verlängerter (Forderung aus Weiterverkauf wird im Voraus abgetreten), erweiterter (alle Forderungen aus der Geschäftsbeziehung), Verarbeitungsklausel (§ 950 BGB). Die Wirkung gegenüber gutgläubigen Dritten und in der Insolvenz ist nicht dargestellt. Reicht die Vereinfachung? */
  const P_EIGEN = [
    ['Was ist der Unterschied zwischen Eigentum und Besitz?', 'Eigentum ist die rechtliche Herrschaft über eine Sache, Besitz die tatsächliche', ['Eigentum ist die tatsächliche Herrschaft, Besitz die rechtliche', 'Es gibt keinen Unterschied, beides bedeutet dasselbe', 'Besitz bedeutet immer mehr Rechte als Eigentum an der Sache'], 'Wem eine Sache gehört, ist Eigentümer. Wer sie gerade hat und nutzt, ist Besitzer. Ein Mieter ist zum Beispiel Besitzer, nicht Eigentümer.', ['Denke an eine gemietete Wohnung.', 'Wem gehört sie, wer hat sie?']],
    ['Eine Maschine wird unter Eigentumsvorbehalt geliefert. Wer ist bis zur vollständigen Zahlung Eigentümer?', 'Der Verkäufer (der Käufer ist nur Besitzer)', ['Der Käufer, weil er die Ware schon hat', 'Der Spediteur, der die Ware transportiert hat', 'Beide zur Hälfte, bis bezahlt ist'], 'Beim Eigentumsvorbehalt behält der Verkäufer das Eigentum bis zur vollständigen Zahlung. Der Käufer darf die Ware aber schon benutzen.', ['Wofür ist der Vorbehalt gedacht?', 'Der Käufer hat die Ware, aber noch nicht bezahlt.']],
    ['Wann geht das Eigentum beim einfachen Eigentumsvorbehalt auf den Käufer über?', 'Mit der vollständigen Zahlung des Kaufpreises', ['Mit dem Abschluss des Kaufvertrags', 'Mit der Lieferung an den Käufer', 'Mit dem Datum der Rechnung'], 'Die vollständige Zahlung ist die Bedingung für den Eigentumsübergang.', ['Welche Leistung fehlt dem Verkäufer noch?', 'Erst wenn alles bezahlt ist.']],
    ['Wozu dient der Eigentumsvorbehalt?', 'Der Verkäufer sichert sich gegen Zahlungsausfall des Käufers', ['Der Käufer sichert sich gegen Mängel ab', 'Der Spediteur sichert sich gegen Transportschäden ab', 'Er verkürzt die Gewährleistungsfrist'], 'Wenn der Käufer nicht zahlt, kann der Verkäufer die Ware zurückverlangen, weil sie ihm noch gehört.', ['Wer trägt das Risiko, nicht bezahlt zu werden?', 'Es ist eine Sicherung für den Lieferanten.']]
  ];
  const P_EV = [
    ['Ein Händler hat Ware unter einfachem Eigentumsvorbehalt gekauft, noch nicht bezahlt und verkauft sie weiter. Wie bleibt der Lieferant trotzdem gesichert?', 'Verlängerter Eigentumsvorbehalt: Die Forderung gegen den Endkunden wird im Voraus abgetreten', ['Er braucht nichts, der Eigentumsvorbehalt gilt auch beim Endkunden immer weiter', 'Skontoklausel: Der Händler darf beim Weiterverkauf Skonto an den Endkunden geben', 'Gerichtsstandsklausel: Streit wird am Sitz des Lieferanten entschieden'], 'Beim einfachen Eigentumsvorbehalt darf der Händler weiterverkaufen, das Eigentum des Lieferanten erlischt aber. Der verlängerte Eigentumsvorbehalt gibt dem Lieferanten stattdessen die Forderung gegen den Endkunden.', ['Die Ware ist weg, was bleibt dem Lieferanten?', 'Die Forderung des Händlers gegen seinen Kunden.']],
    ['Beim erweiterten Eigentumsvorbehalt gilt:', 'Das Eigentum bleibt beim Lieferanten, bis alle Forderungen aus der Geschäftsbeziehung bezahlt sind', ['Das Eigentum bleibt nur bis zur Zahlung dieser einen Lieferung beim Lieferanten', 'Das Eigentum bleibt beim Lieferanten, bis die Gewährleistungsfrist abgelaufen ist', 'Der Käufer wird sofort Eigentümer'], 'Der erweiterte Vorbehalt sichert alle offenen Forderungen aus der Geschäftsbeziehung, nicht nur den einzelnen Kaufpreis.', ['Es geht um mehr als eine Rechnung.', 'Die Sicherung wird ausgedehnt.']],
    ['Ein Kunde verarbeitet unter Eigentumsvorbehalt gelieferten Stahl zu einem Bauteil. Welche Vereinbarung schützt den Lieferanten dann?', 'Die Verarbeitungsklausel: Der Lieferant gilt als Hersteller und wird (Mit-)Eigentümer', ['Die Skontoklausel: Der Kunde darf bei schneller Zahlung Abzüge machen', 'Die Freizeichnungsklausel: Der Lieferant bleibt im Angebot unverbindlich', 'Die Gerichtsstandsklausel: Streit wird am Sitz des Lieferanten geklärt'], 'Durch die Verarbeitung entsteht eine neue Sache. Die Verarbeitungsklausel sichert dem Lieferanten das Eigentum daran.', ['Aus Stahl wird etwas Neues.', 'Es geht um Eigentum an der neuen Sache.']]
  ];
  /* PRUEFEN P22: Zahlungsbedingungen: 'netto Kasse' = sofort ohne Abzug, Zahlungsziel = späteste Zahlungsfrist, Skonto = Preisnachlass bei Zahlung innerhalb der Skontofrist, Vorauskasse = Zahlung vor Lieferung. Die Skonto-Prozente und Fristen in den Aufgaben (2 bis 3 %, 8 bis 14 Tage, Ziel 30 oder 60 Tage) sind Übungswerte. */
  const P_ZAHL = [
    ['Auf der Rechnung steht "zahlbar sofort netto Kasse". Was bedeutet das?', 'Der Rechnungsbetrag ist sofort ohne Abzug fällig', ['Zahlung innerhalb von 30 Tagen nach Rechnungsdatum', 'Zahlung vor der Lieferung der Ware', 'Der Kunde darf 2 % Skonto abziehen'], '"Netto Kasse" heißt: sofort, ohne Abzug (kein Skonto, kein Zahlungsziel).', ['Netto heißt ohne Abzug.', 'Kasse heißt sofort.']],
    ['Es gilt: "Zahlung innerhalb 14 Tagen mit 2 % Skonto, innerhalb 30 Tagen netto." Was gilt, wenn der Kunde am 20. Tag zahlt?', 'Er zahlt den vollen Rechnungsbetrag ohne Abzug, noch rechtzeitig', ['Er darf 2 % Skonto vom Rechnungsbetrag abziehen', 'Er ist bereits im Verzug und schuldet Zinsen', 'Er darf 1 % Skonto vom Rechnungsbetrag abziehen'], 'Die Skontofrist (14 Tage) ist abgelaufen, das Zahlungsziel (30 Tage) noch nicht. Es gilt der volle Betrag.', ['Vergleiche den 20. Tag mit beiden Fristen.', 'Skonto gibt es nur innerhalb der kürzeren Frist.']],
    ['Was bedeutet Vorauskasse?', 'Der Kunde zahlt, bevor die Ware geliefert wird', ['Der Kunde zahlt 30 Tage nach Lieferung', 'Der Kunde zahlt bei Abholung', 'Der Lieferant zahlt dem Kunden eine Gutschrift'], 'Bei Vorauskasse liefert der Lieferant erst, wenn das Geld da ist. Er trägt dann kein Ausfallrisiko.', ['Vorab heißt: vor der Lieferung.', 'Wer trägt dabei das Risiko?']],
    ['Was ist ein Zahlungsziel?', 'Die Frist, bis zu der die Rechnung spätestens bezahlt sein muss', ['Der Prozentsatz, um den der Preis bei früher Zahlung sinkt', 'Der Tag, an dem die Ware beim Kunden ankommt', 'Die Höhe der Mahngebühr bei verspäteter Zahlung'], 'Das Zahlungsziel ist die vereinbarte Frist für die Zahlung. Wer sie überschreitet, kann in Verzug geraten.', ['Es geht um die Zeit bis zur Zahlung.', 'Mit dem Ziel endet auch die Chance auf Skonto.']]
  ];
  /* PRUEFEN P23: Aufbewahrungsfristen: Buchungsbelege (z. B. Rechnungen) 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 AO, § 257 HGB). Die Fristen wurden zuletzt geändert; bitte gegen die aktuelle Fassung prüfen. */
  const P_BELEG = [
    ['Der Lieferschein liegt der Ware bei. Wozu dient er dem Empfänger vor allem?', 'Zum Vergleich von Art und Menge der Ware mit der Bestellung', ['Als Zahlungsaufforderung an den Kunden', 'Als bindendes Angebot für die nächste Bestellung', 'Als Mahnung bei verspäteter Lieferung'], 'Mit dem Lieferschein prüft der Empfänger beim Wareneingang, ob Art und Menge stimmen.', ['Er begleitet die Ware.', 'Menge und Art stehen drauf, kein Preis nötig.']],
    ['Wozu dient die Rechnung?', 'Zahlungsaufforderung und Buchungsbeleg für beide Seiten', ['Ersatz für den Lieferschein bei der Wareneingangsprüfung', 'Bindender Antrag des Kunden auf Lieferung', 'Bestätigung des Wareneingangs durch den Kunden'], 'Die Rechnung nennt den Preis, fordert zur Zahlung auf und dient beiden Seiten als Buchungsbeleg.', ['Hier geht es ums Geld.', 'Wer bucht damit?']],
    ['Was ist die Auftragsbestätigung?', 'Schriftliche Bestätigung der Bestellung durch den Lieferanten', ['Bestätigung des Wareneingangs durch den Kunden', 'Zahlungsaufforderung des Lieferanten an den Kunden', 'Unverbindliche Preisanfrage des Kunden beim Lieferanten'], 'Die Auftragsbestätigung kommt vom Lieferanten und bestätigt die Bestellung des Kunden.', ['Wer bestätigt was?', 'Der Beleg kommt nach der Bestellung.']],
    ['Wie lange müssen Rechnungen als Buchungsbelege nach dem Übungswert aufbewahrt werden?', '8 Jahre', ['2 Jahre', '3 Jahre', '30 Jahre'], 'Buchungsbelege wie Rechnungen müssen 8 Jahre aufbewahrt werden (Übungswert, Handelsbriefe 6 Jahre; die Fristen ändern sich gelegentlich).', ['Die Frist ist länger als die Verjährung.', 'Es sind mehrere Jahre, aber nicht Jahrzehnte.']]
  ];
  /* PRUEFEN P24: Gesetzliche Sozialversicherung: Kranken-, Pflege-, Renten- und Arbeitslosenversicherung (Arbeitnehmer- und Arbeitgeberanteil), dazu die gesetzliche Unfallversicherung, die der Arbeitgeber allein zahlt. Richtig und vollständig genug? */
  const P_BRUTTO = [
    ['Was ist das Bruttogehalt?', 'Das vereinbarte Gehalt vor Abzug von Steuern und Beiträgen', ['Der Auszahlungsbetrag, der auf dem Konto ankommt', 'Das Gehalt nach Abzug aller Steuern und Beiträge', 'Das Gehalt plus der Arbeitgeberanteil zur Sozialversicherung'], 'Brutto ist der Betrag vor Abzügen. Nach Abzug von Lohnsteuer und Arbeitnehmeranteilen bleibt das Netto.', ['Brutto ist größer als Netto.', 'Es ist der Betrag vor den Abzügen.']],
    ['Welche Abzüge stehen auf einer einfachen Gehaltsabrechnung zwischen Brutto und Netto?', 'Lohnsteuer und Arbeitnehmeranteile zur Sozialversicherung', ['Umsatzsteuer und Gewerbesteuer des Betriebs', 'Körperschaftsteuer und Zölle auf Importe', 'Nur der Arbeitgeberanteil zur Sozialversicherung'], 'Der Arbeitgeber behält Lohnsteuer und den Arbeitnehmeranteil der Sozialversicherung ein und führt sie ab.', ['Es geht um Steuer und Versicherung des Mitarbeiters.', 'Umsatzsteuer zahlt der Kunde, nicht der Mitarbeiter.']],
    ['Wer zahlt den Arbeitgeberanteil zur Sozialversicherung?', 'Der Arbeitgeber, zusätzlich zum Bruttogehalt', ['Der Arbeitnehmer, aus seinem Nettogehalt', 'Das Finanzamt, aus der Lohnsteuer', 'Die Krankenkasse aus ihren Rücklagen'], 'Der Arbeitgeberanteil wird nicht vom Brutto abgezogen, er ist ein zusätzlicher Aufwand des Betriebs. Er steht deshalb nicht in der Abzugsliste des Mitarbeiters.', ['Es steht nicht in den Abzügen des Mitarbeiters.', 'Er kommt zusätzlich zum Brutto.']],
    ['Welche Versicherungen gehören zur gesetzlichen Sozialversicherung?', 'Kranken-, Pflege-, Renten- und Arbeitslosenversicherung (dazu die Unfallversicherung)', ['Hausrat-, Haftpflicht-, Rechtsschutz- und Kfz-Versicherung des Mitarbeiters', 'Nur die gesetzliche Rentenversicherung, alle anderen sind freiwillig', 'Lebens-, Reise- und Berufsunfähigkeitsversicherung als Pflichtpolicen'], 'Die gesetzliche Sozialversicherung besteht aus Kranken-, Pflege-, Renten- und Arbeitslosenversicherung; die Unfallversicherung zahlt der Arbeitgeber allein.', ['Das sind die vier großen Säulen.', 'Private Policen gehören nicht dazu.']]
  ];
  const P_PROBE = [
    ['Wie lang darf eine Probezeit im Arbeitsvertrag höchstens sein (Übungswert)?', 'Sechs Monate', ['Ein Monat', 'Zwölf Monate', 'Zwei Jahre'], 'Die Probezeit im Arbeitsverhältnis darf höchstens sechs Monate dauern.', ['Eine halbe Jahreslänge.', 'Länger als ein paar Wochen, kürzer als ein Jahr.']],
    ['Wie lang ist die Probezeit in der Berufsausbildung (Übungswert nach BBiG)?', 'Mindestens einen Monat und höchstens vier Monate', ['Genau sechs Monate', 'Mindestens drei und höchstens zwölf Monate', 'Eine Probezeit gibt es nicht'], 'Im Ausbildungsvertrag muss die Probezeit mindestens einen Monat und darf höchstens vier Monate dauern.', ['Die Zeit ist kürzer als im Arbeitsvertrag.', 'Die obere Grenze liegt bei vier Monaten.']],
    ['Wie kann in der Probezeit der Ausbildung gekündigt werden?', 'Von beiden Seiten ohne Frist und ohne Grund, schriftlich', ['Nur mit vier Wochen Frist zum Monatsende', 'Nur mit Zustimmung der Industrie- und Handelskammer', 'Gar nicht, die Probezeit schützt beide Seiten'], 'Während der Probezeit kann der Ausbildungsvertrag ohne Einhaltung einer Frist und ohne Grund gekündigt werden (schriftlich).', ['Die Probezeit dient dem gegenseitigen Kennenlernen.', 'Kündigungsfristen gelten erst danach.']],
    ['Welche Kündigungsfrist gilt in der vereinbarten Probezeit eines Arbeitsverhältnisses (Übungswert)?', 'Zwei Wochen', ['Vier Wochen zum Monatsende', 'Sechs Monate', 'Keine Frist'], 'In der Probezeit eines Arbeitsverhältnisses kann mit einer Frist von zwei Wochen gekündigt werden.', ['Es ist kürzer als die Grundfrist von vier Wochen.', 'Die Frist wird in Wochen gezählt.']]
  ];

  /* ---------- Zuordnungs-Sätze ---------- */
  const SETS = {
    beg: { title: 'Begriffe aus Auftrag und Recht', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Vertragsarten', n: 'Kaufvertrag', d: 'Ware wird gegen Geld getauscht, das Eigentum geht über.', pts: ['Verkäufer: Ware mangelfrei übergeben, Eigentum verschaffen', 'Käufer: Preis zahlen, Ware abnehmen'] },
      { g: 'Vertragsarten', n: 'Werkvertrag', d: 'Geschuldet ist ein bestimmter Erfolg, zum Beispiel die fertig gestrichene Halle.', pts: ['Erfolg wird geschuldet', 'Abnahme des Werks'] },
      { g: 'Vertragsarten', n: 'Dienstvertrag', d: 'Geschuldet ist die Tätigkeit, nicht ein bestimmter Erfolg.', pts: ['Zum Beispiel Beratung nach Stunden', 'Der Arbeitsvertrag ist ein besonderer Dienstvertrag'] },
      { g: 'Vertragsarten', n: 'Mietvertrag', d: 'Der Gebrauch einer Sache wird auf Zeit gegen Miete überlassen, das Eigentum bleibt beim Vermieter.', pts: ['Zum Beispiel Gabelstapler auf Zeit', 'Am Ende wird die Sache zurückgegeben'] },
      { g: 'Belege', n: 'Anfrage', d: 'Der Kunde fragt unverbindlich nach Preis, Menge und Lieferzeit.', pts: ['Kommt vom Käufer', 'Bindet niemanden'] },
      { g: 'Belege', n: 'Angebot', d: 'Der Lieferant nennt Ware, Preis, Lieferzeit und Zahlungsbedingungen, er ist meist daran gebunden.', pts: ['Kommt vom Lieferanten', '"Freibleibend" macht es unverbindlich'] },
      { g: 'Belege', n: 'Bestellung', d: 'Der Kunde bestellt Ware verbindlich. Bei einem bindenden Angebot ist sie die Annahme.', pts: ['Kommt vom Käufer', 'Beim Lieferanten heißt der Beleg Auftrag'] },
      { g: 'Belege', n: 'Auftragsbestätigung', d: 'Der Lieferant bestätigt die Bestellung schriftlich mit Menge, Preis und Termin.', pts: ['Kann die Annahme sein', 'Weicht sie ab, gilt sie als neuer Antrag'] },
      { g: 'Belege', n: 'Lieferschein', d: 'Er liegt der Ware bei und beschreibt Art und Menge der Lieferung.', pts: ['Grundlage der Wareneingangsprüfung', 'Meist ohne Preise'] },
      { g: 'Belege', n: 'Rechnung', d: 'Der Beleg fordert zur Zahlung auf und ist Grundlage für Buchung und Vorsteuerabzug.', pts: ['Pflichtangaben nach dem Umsatzsteuergesetz', 'Enthält Zahlungsbedingungen'] },
      { g: 'Störungen', n: 'Lieferverzug', d: 'Der Lieferant liefert nicht rechtzeitig, obwohl die Lieferung fällig ist.', pts: ['Verzug braucht meist eine Mahnung', 'Ohne Mahnung bei Kalendertermin'] },
      { g: 'Störungen', n: 'Zahlungsverzug', d: 'Der Kunde zahlt nicht rechtzeitig, obwohl die Rechnung fällig ist.', pts: ['Verzugszinsen und Pauschale möglich', 'Spätestens 30 Tage nach Rechnungszugang'] },
      { g: 'Störungen', n: 'Annahmeverzug', d: 'Der Kunde nimmt die ordnungsgemäß angebotene Ware nicht an.', pts: ['Der Lieferant hat korrekt geleistet'] },
      { g: 'Störungen', n: 'Mangelhafte Lieferung', d: 'Die Ware entspricht nicht der Vereinbarung in Art, Güte oder Menge.', pts: ['Rüge im Handelskauf nötig', 'Zuerst Nacherfüllung'] },
      { g: 'Eigentumsvorbehalt', n: 'Einfacher Eigentumsvorbehalt', d: 'Die Ware bleibt bis zur vollständigen Zahlung Eigentum des Verkäufers.', pts: ['Käufer ist nur Besitzer', 'Weiterverkauf zerstört die Sicherung'] },
      { g: 'Eigentumsvorbehalt', n: 'Verlängerter Eigentumsvorbehalt', d: 'Beim Weiterverkauf wird die Forderung gegen den Endkunden im Voraus an den Lieferanten abgetreten.', pts: ['Händler darf weiterverkaufen', 'Sicherung wandert auf die Forderung'] },
      { g: 'Eigentumsvorbehalt', n: 'Erweiterter Eigentumsvorbehalt', d: 'Das Eigentum bleibt beim Lieferanten, bis alle Forderungen aus der Geschäftsbeziehung bezahlt sind.', pts: ['Sichert mehr als eine Rechnung'] },
      { g: 'Zahlungsbedingungen', n: 'Vorauskasse', d: 'Der Kunde zahlt, bevor die Ware geliefert wird.', pts: ['Kein Ausfallrisiko für den Lieferanten'] },
      { g: 'Zahlungsbedingungen', n: 'Netto Kasse', d: 'Der Rechnungsbetrag ist sofort ohne Abzug fällig.', pts: ['Kein Skonto'] },
      { g: 'Zahlungsbedingungen', n: 'Zahlungsziel', d: 'Die Frist, bis zu der der Rechnungsbetrag spätestens gezahlt werden muss.', pts: ['Danach droht Verzug'] },
      { g: 'Zahlungsbedingungen', n: 'Skonto', d: 'Preisnachlass in Prozent, wenn der Kunde innerhalb einer kurzen Frist zahlt.', pts: ['Die Skontofrist ist kürzer als das Zahlungsziel', 'Berechnung in der Kalkulation: siehe kallab'] },
      { g: 'Lohn und Arbeit', n: 'Bruttolohn', d: 'Der vereinbarte Lohn oder das Gehalt vor allen Abzügen.', pts: ['Ausgangspunkt der Abrechnung'] },
      { g: 'Lohn und Arbeit', n: 'Nettolohn', d: 'Der Auszahlungsbetrag nach Abzug von Lohnsteuer und Sozialversicherung.', pts: ['Brutto minus Abzüge'] },
      { g: 'Lohn und Arbeit', n: 'Arbeitgeberanteil', d: 'Der Anteil zur Sozialversicherung, den der Arbeitgeber zusätzlich zum Bruttolohn trägt.', pts: ['Steht nicht in den Abzügen des Mitarbeiters', 'Erhöht die Kosten des Betriebs'] },
      { g: 'Lohn und Arbeit', n: 'Probezeit', d: 'Zeit zu Beginn des Vertrags, in der beide Seiten sich kennenlernen und leichter kündigen können.', pts: ['Arbeitsvertrag: höchstens sechs Monate', 'Ausbildung: ein bis vier Monate'] },
      { g: 'Lohn und Arbeit', n: 'Kündigungsfrist', d: 'Der Zeitraum zwischen dem Zugang der Kündigung und dem Ende des Arbeitsverhältnisses.', pts: ['Wird mit der Betriebszugehörigkeit länger', 'Übungswerte im Lab'] }
    ] }
  };

  /* ---------- Generatoren ---------- */
  const OUT_KEYS = ['bestellung', 'ab', 'wartet-lieferant', 'wartet-kunde'];
  function vertragQ(R, text, v, meta) {
    const c = C(), right = c.VERTRAG[v.code], wrong = OUT_KEYS.map(k => c.VERTRAG[k]).filter(x => x !== right);
    return choiceQ(R, text, right, wrong, v.grund, ['Prüfe zuerst: Ist das Angebot bindend, und kam die Bestellung rechtzeitig und unverändert?', 'Ein Vertrag braucht Antrag und Annahme. Frage dich, welche Erklärung der Antrag ist und welche die Annahme.'], meta);
  }
  function orderQ(R, key, text, tips, expl) {
    const c = C(), right = c.orderRight(key), n = right.length, join = a => a.join(' → '), rt = join(right), seen = new Set([rt]), wrong = [];
    for (let t = 0; t < 200 && wrong.length < 3; t++) {
      const a = right.slice(), i = c.ri(R, 0, n - 1); let j = c.ri(R, 0, n - 1); if (j === i) j = (i + 1) % n;
      [a[i], a[j]] = [a[j], a[i]]; const s = join(a); if (!seen.has(s)) { seen.add(s); wrong.push(s); }
    }
    return choiceQ(R, text, rt, wrong, expl + ' Richtige Reihenfolge: ' + rt + '.', tips, { key });
  }
  /* Termine für Aufgaben: Enddatum nicht auf Wochenende */
  function noWeekend(R, genStart, endOf) { for (let i = 0; i < 100; i++) { const d = genStart(R); if (!C().isWeekend(endOf(d))) return d; } return genStart(R); }

  const G = {
    p_anf: pq(P_ANF), p_antrag: pq(P_ANTRAG), p_art: pq(P_ART), p_erfolg: pq(P_ERFOLG), p_pflicht: pq(P_PFLICHT), p_stoer: pq(P_STOER), p_mangel: pq(P_MANGEL), p_reakt: pq(P_REAKT),
    p_dauer: pq(P_DAUER), p_eigen: pq(P_EIGEN), p_ev: pq(P_EV), p_zahl: pq(P_ZAHL), p_beleg: pq(P_BELEG), p_brutto: pq(P_BRUTTO), p_probe: pq(P_PROBE),

    bind: R => {
      const c = C(), g = c.dateRand(R), bis = c.addDays(g, c.ri(R, 10, 40)), ok = R() < 0.5, best = ok ? c.addDays(bis, -c.ri(R, 1, 6)) : c.addDays(bis, c.ri(R, 2, 9));
      const v = c.kaufvertrag({ angebot: 'bindend', gueltigBis: bis, bestellung: best });
      return vertragQ(R, 'Am ' + dt(g) + ' schickt ein Lieferant einem Kunden ein schriftliches, bindendes Angebot. Es ist bis zum ' + dt(bis) + ' befristet. Der Kunde bestellt am ' + dt(best) + ' genau die angebotene Ware zum angebotenen Preis. Der Lieferant hat sich danach nicht mehr gemeldet. Wie ist die Lage?', v, { angebot: 'bindend', bis, best });
    },
    frei: R => {
      const c = C(), g = c.dateRand(R), best = c.addDays(g, c.ri(R, 2, 12)), mitAb = R() < 0.5, ab = c.addDays(best, c.ri(R, 1, 4));
      const v = c.kaufvertrag({ angebot: 'frei', bestellung: best, ab: mitAb ? 'gleich' : null });
      return vertragQ(R, 'Ein Lieferant sendet am ' + dt(g) + ' ein Angebot mit dem Zusatz "Preise und Mengen freibleibend". Der Kunde bestellt am ' + dt(best) + ' unverändert. ' + (mitAb ? 'Am ' + dt(ab) + ' schickt der Lieferant eine Auftragsbestätigung, die mit der Bestellung übereinstimmt.' : 'Der Lieferant hat sich bisher nicht gemeldet.') + ' Wie ist die Lage?', v, { angebot: 'frei', mitAb });
    },
    vertrag: R => {
      const c = C(), s = c.ri(R, 0, 6), g = c.dateRand(R), bis = c.addDays(g, c.ri(R, 10, 30)), early = c.addDays(bis, -c.ri(R, 1, 6)), late = c.addDays(bis, c.ri(R, 2, 8)), abD = d => c.addDays(d, c.ri(R, 1, 4));
      let fall, txt;
      const abText = (ab, d) => ab === 'gleich' ? ' Am ' + dt(d) + ' schickt der Lieferant eine Auftragsbestätigung, die genau der Bestellung entspricht.' : ab === 'abweichend' ? ' Am ' + dt(d) + ' schickt der Lieferant eine Auftragsbestätigung mit einem höheren Preis als in der Bestellung.' : ' Der Lieferant hat sich nicht gemeldet.';
      if (s === 0) { fall = { angebot: 'bindend', gueltigBis: bis, bestellung: early, ab: null }; txt = 'Ein Lieferant macht ein bindendes Angebot bis zum ' + dt(bis) + '. Der Kunde bestellt am ' + dt(early) + ' unverändert.' + abText(null); }
      else if (s === 1) { const a = abD(late); fall = { angebot: 'bindend', gueltigBis: bis, bestellung: late, ab: 'gleich' }; txt = 'Ein Lieferant macht ein bindendes Angebot bis zum ' + dt(bis) + '. Der Kunde bestellt erst am ' + dt(late) + ' unverändert.' + abText('gleich', a); }
      else if (s === 2) { fall = { angebot: 'bindend', gueltigBis: bis, bestellung: late, ab: null }; txt = 'Ein Lieferant macht ein bindendes Angebot bis zum ' + dt(bis) + '. Der Kunde bestellt erst am ' + dt(late) + ' unverändert.' + abText(null); }
      else if (s === 3) { const a = abD(early); fall = { angebot: 'frei', bestellung: early, ab: 'gleich' }; txt = 'Ein Lieferant sendet ein Angebot "freibleibend". Der Kunde bestellt am ' + dt(early) + ' unverändert.' + abText('gleich', a); }
      else if (s === 4) { fall = { angebot: 'kein', bestellung: early, ab: null }; txt = 'Ein Kunde hat bei einem Lieferanten nur angefragt und bekam keinen Preis genannt. Er bestellt am ' + dt(early) + ' trotzdem zu einem eigenen Wunschpreis.' + abText(null); }
      else if (s === 5) { fall = { angebot: 'bindend', gueltigBis: bis, bestellung: early, abweichend: true, ab: null }; txt = 'Ein Lieferant macht ein bindendes Angebot bis zum ' + dt(bis) + '. Der Kunde bestellt am ' + dt(early) + ' jedoch eine größere Menge zu einem niedrigeren Preis als im Angebot.' + abText(null); }
      else { const a = abD(early); fall = { angebot: 'frei', bestellung: early, ab: 'abweichend' }; txt = 'Ein Lieferant sendet ein Angebot "freibleibend". Der Kunde bestellt am ' + dt(early) + ' unverändert.' + abText('abweichend', a); }
      const v = c.kaufvertrag(fall);
      return vertragQ(R, txt + ' Wie ist die Lage?', v, { fall });
    },
    mahnnoetig: R => {
      const c = C(), k = c.ri(R, 0, 3), g = c.dateRand(R), d2 = c.addDays(g, c.ri(R, 20, 60)), b = c.ri(R, 3, 40) * 100;
      const T = [
        'Ein Lieferant soll laut Vertrag "bis spätestens ' + dt(d2) + '" liefern. Dieser Tag ist verstrichen, geliefert wurde nichts.',
        'Im Vertrag steht nur "Lieferung in den nächsten Wochen". Mehrere Wochen sind vergangen, die Ware fehlt noch.',
        'Der Lieferant erklärt dem Kunden schriftlich ernsthaft und endgültig, dass er die bestellte Ware nicht liefern wird.',
        'Ein Kunde hat eine Rechnung über ' + f(b, 0) + ' € am ' + dt(g) + ' erhalten (sofort fällig, kein Zahlungstermin genannt). Seit dem Zugang sind mehr als 30 Tage vergangen, er hat nicht gezahlt.'
      ];
      /* Kodierung: k 0 = Kalendertermin (Option 1), k 1 = keine Frist (Option 0), k 2 = Verweigerung (Option 2), k 3 = 30 Tage (Option 3) */
      const opt = [1, 0, 2, 3][k];
      return choiceQ(R, T[k] + ' Muss vor dem Verzug noch gemahnt werden, und warum?', MAHN[opt], MAHN.filter((x, i) => i !== opt),
        ['Der Termin ist nach dem Kalender bestimmt (§ 286 Abs. 2 Nr. 1 BGB): Der Verzug tritt ohne Mahnung ein.', 'Ohne Termin und ohne besonderen Grund ist eine Mahnung nötig, sie begründet den Verzug.', 'Wer die Leistung ernsthaft und endgültig verweigert, muss nicht mehr gemahnt werden.', 'Gegenüber Unternehmen tritt Verzug spätestens 30 Tage nach Fälligkeit und Zugang der Rechnung ohne Mahnung ein.'][k],
        ['Gibt es einen bestimmten Termin im Kalender, oder bleibt die Zeit offen?', 'Eine Mahnung ist sinnlos, wenn feststeht, dass der Schuldner nicht leisten will.'], { k });
    },
    faelle: R => {
      const c = C(), verzug = R() < 0.4;
      let fall, txt, uni;
      if (!verzug) {
        const art = c.pick(R, ['offen', 'versteckt']), ruege = R() < 0.75, nach = R() < 0.65 ? 'gescheitert' : 'offen', erheblich = R() < 0.7, verschulden = R() < 0.6;
        fall = { stoerung: 'mangel', handel: true, mangelart: art, ruege, nacherf: nach, erheblich, verschulden };
        txt = 'Ein Händler kauft bei einem Hersteller Geräte (Handelskauf). ' + (art === 'offen' ? 'Beim Auspacken ist ein Mangel sofort sichtbar.' : 'Nach einigen Wochen zeigt sich ein versteckter Mangel.') + ' ' + (ruege ? 'Er rügt rechtzeitig.' : 'Er meldet den Mangel erst viele Wochen später.') + ' ' + (nach === 'gescheitert' ? 'Der Hersteller hat zweimal erfolglos nachgebessert.' : 'Der Hersteller hat noch nicht reagiert, eine Frist zur Nacherfüllung läuft.') + ' ' + (erheblich ? 'Der Mangel ist erheblich, die Geräte sind kaum brauchbar.' : 'Der Mangel ist unerheblich: Nur ein kleiner Kratzer am Gehäuse.') + ' ' + (verschulden ? 'Der Fehler geht auf eine schlampige Endkontrolle des Herstellers zurück.' : 'Der Hersteller konnte den Fehler nicht erkennen und trifft kein Verschulden.');
        uni = ['nacherfuellung', 'minderung', 'ruecktritt', 'schadensersatz'];
      } else {
        const kal = R() < 0.5, mahn = R() < 0.5, nach = R() < 0.5, verschulden = R() < 0.6;
        fall = { stoerung: 'verzug', kalender: kal, mahnung: mahn, nachfrist: nach, verschulden };
        txt = 'Ein Lieferant liefert nicht rechtzeitig. ' + (kal ? 'Als Liefertermin war im Vertrag ein bestimmter Kalendertag vereinbart.' : 'Im Vertrag steht kein bestimmter Kalendertag.') + ' ' + (mahn ? 'Der Kunde hat gemahnt.' : 'Der Kunde hat nicht gemahnt.') + ' ' + (nach ? 'Eine angemessene Nachfrist ist ergebnislos abgelaufen.' : 'Eine Nachfrist wurde nicht gesetzt.') + ' ' + (verschulden ? 'Der Lieferant hat die Verspätung zu vertreten.' : 'Der Lieferant hat die Verspätung nicht zu vertreten.');
        uni = ['erfuellung', 'verzugsschaden', 'ruecktritt', 'schadensersatz'];
      }
      const res = c.kaeuferRechte(fall), nm = a => (a.length ? a.map(k => c.RECHTE[k].n).join(', ') : null);
      const keine = res.blocked ? (fall.stoerung === 'mangel' ? 'Keine Mängelrechte: Die Ware gilt als genehmigt' : 'Keines dieser Rechte: Der Verzug ist noch nicht eingetreten') : null;
      const right = nm(res.rights) || keine, seen = new Set([right]), wrong = [];
      for (let t = 0; t < 300 && wrong.length < 3; t++) { const sub = uni.filter(() => R() < 0.5); if (!sub.length) continue; sub.sort((a, b) => c.RIGHT_ORDER.indexOf(a) - c.RIGHT_ORDER.indexOf(b)); const s = nm(sub); if (!seen.has(s)) { seen.add(s); wrong.push(s); } }
      const expl = (res.blocked ? res.blocked + ' ' : 'Möglich sind: ' + right + '. ') + res.notes.join(' ');
      return choiceQ(R, txt + ' Welche Rechte hat der Käufer jetzt?', right, wrong, expl,
        [fall.stoerung === 'mangel' ? 'Prüfe der Reihe nach: Rüge, Nacherfüllung, Erheblichkeit, Verschulden.' : 'Prüfe der Reihe nach: Verzug eingetreten, Nachfrist, Verschulden.', fall.stoerung === 'mangel' ? 'Rücktritt braucht einen erheblichen Mangel, Schadensersatz Verschulden.' : 'Rücktritt braucht eine abgelaufene Nachfrist (oder ein Fixgeschäft), Schadensersatz Verschulden.'], { fall });
    },
    verj: R => {
      const c = C(); let d;
      for (let i = 0; i < 100; i++) { d = c.mk(c.ri(R, 2023, 2026), c.ri(R, 2, 11), c.ri(R, 1, 28)); if (!c.isWeekend(c.verjaehrungEnde(d))) break; }
      const y = c.ymd(d).y, right = dt(c.verjaehrungEnde(d));
      const cands = [dt(c.mk(y + 2, 12, 31)), dt(c.addYears(d, 3)), dt(c.mk(y + 4, 12, 31)), dt(c.mk(y + 1, 12, 31))];
      return choiceQ(R, 'Ein Lieferant hat gegen einen Kunden einen Zahlungsanspruch, der am ' + dt(d) + ' entstanden ist; der Lieferant kennt Schuldner und Anspruch. Der Anspruch unterliegt der regelmäßigen Verjährung. Wann endet die Verjährungsfrist?', right, distinct(R, right, cands, 3),
        'Die regelmäßige Verjährung dauert drei Jahre und beginnt mit dem Ende des Jahres der Entstehung (' + y + '). Die Frist endet deshalb am 31.12.' + (y + 3) + '.', ['Die Frist beginnt erst mit dem Jahresende.', 'Drei volle Jahre ab dem 31. Dezember des Entstehungsjahres.'], { d, y });
    },
    gewl: R => {
      const c = C(), d = noWeekend(R, r => c.mk(c.ri(r, 2023, 2026), c.ri(r, 1, 12), c.ri(r, 1, 28)), x => c.gewaehrleistungEnde(x)), right = dt(c.gewaehrleistungEnde(d)), y = c.ymd(d).y;
      const cands = [dt(c.addDays(c.gewaehrleistungEnde(d), -1)), dt(c.addYears(d, 1)), dt(c.mk(y + 2, 12, 31)), dt(c.addYears(d, 3)), dt(c.addDays(c.gewaehrleistungEnde(d), 1))];
      return choiceQ(R, 'Ein Betrieb kauft eine neue bewegliche Sache. Die Ware wird am ' + dt(d) + ' abgeliefert. Es gilt die Gewährleistungsfrist von zwei Jahren ab Ablieferung (Übungswert). An welchem Tag endet die Frist?', right, distinct(R, right, cands, 3),
        'Der Tag der Ablieferung (' + dt(d) + ') zählt nicht mit. Die Frist endet mit Ablauf des Tages, der dem Ablieferungstag nach zwei Jahren entspricht: ' + right + '.', ['Zwei Jahre ab Ablieferung, nicht ab Jahresende.', 'Gleiches Datum, zwei Jahre später.'], { d });
    },
    ruege: R => {
      const c = C(), g = c.dateRand(R), versteckt = R() < 0.5, e = versteckt ? c.addDays(g, c.ri(R, 20, 60)) : g, ok = R() < 0.5, r = c.addDays(e, ok ? c.ri(R, 1, 5) : c.ri(R, 9, 16)), start = e;
      const R0 = 'Ja, die Rüge ist rechtzeitig: Die Mängelrechte bleiben erhalten', R1 = 'Nein, die Rüge ist zu spät: Die Ware gilt als genehmigt, die Mängelrechte entfallen', R2 = 'Nein, aber die Mängelrechte bleiben trotzdem erhalten', R3 = 'Ja, aber nur das Recht auf Minderung bleibt erhalten';
      const rt = c.ruegeRechtzeitig(start, r) ? R0 : R1;
      const txt = 'Ein Händler (Handelskauf) erhält am ' + dt(g) + ' eine Lieferung. ' + (versteckt ? 'Am ' + dt(e) + ' fällt ihm ein versteckter Mangel auf. ' : 'Der Mangel ist sofort erkennbar. ') + 'Er schickt die Mängelrüge am ' + dt(r) + ' ab. Als Übungsfrist für "unverzüglich" gelten 7 Tage ' + (versteckt ? 'ab Entdeckung' : 'ab Ablieferung') + '. Hat er rechtzeitig gerügt?';
      return choiceQ(R, txt, rt, [R0, R1, R2, R3].filter(x => x !== rt), 'Die Rügefrist endet am ' + dt(c.ruegeEnde(start)) + ' (' + (versteckt ? 'Entdeckung' : 'Ablieferung') + ' ' + dt(start) + ' plus 7 Tage). Gerügt wurde am ' + dt(r) + ': ' + (rt === R0 ? 'rechtzeitig.' : 'zu spät, die Ware gilt als genehmigt (§ 377 HGB).'), ['Zähle ab dem Tag, an dem der Mangel erkennbar war, 7 Tage weiter.', 'Spätestens am Fristende muss die Rüge abgesendet sein.'], { start, r });
    },
    tage: R => {
      const c = C(), g = c.dateRand(R), over = c.ri(R, 5, 70), pay = c.addDays(g, 30 + over);
      return numQ('Ein Kunde erhält am ' + dt(g) + ' eine sofort fällige Rechnung. Seine 30-Tage-Frist ohne Mahnung endet 30 Tage nach dem Zugang. Er zahlt erst am ' + dt(pay) + '. Für wie viele Tage kann der Lieferant Verzugszinsen verlangen (Zinstage = Tage vom Ende der 30-Tage-Frist bis zum Zahlungstag)?', over, 'Tage', 'Zinstage', 0.01,
        'Ende der 30-Tage-Frist: ' + dt(c.verzugFristEnde(g)) + '. Vom ' + dt(c.verzugFristEnde(g)) + ' bis zum ' + dt(pay) + ' liegen ' + over + ' Tage.', ['Bestimme zuerst das Datum, an dem die 30 Tage enden.', 'Zähle dann die Tage bis zum Zahlungstag (über Monatsgrenzen achten).'], { g, pay });
    },
    ruegeablauf: R => orderQ(R, 'ruege', 'Ein Händler hat eine Lieferung erhalten, die nicht in Ordnung ist. In welcher Reihenfolge geht er sinnvoll vor?', ['Zuerst prüfen, dann rügen, dann die Rechte geltend machen.', 'Rücktritt und Minderung kommen erst, wenn die Nacherfüllung nicht klappt.'], 'Erst prüfen und festhalten, dann unverzüglich rügen, dann Nacherfüllung verlangen, zuletzt Rücktritt oder Minderung.'),
    skonto: R => {
      const c = C(), g = c.dateRand(R), sk = c.pick(R, [8, 10, 14]), ziel = c.pick(R, [30, 45, 60]), pr = c.pick(R, [2, 3]), art = c.pick(R, ['skonto', 'netto', 'ueberfaellig']);
      const off = art === 'skonto' ? c.ri(R, 1, sk - 2) : art === 'netto' ? c.ri(R, sk + 2, ziel - 2) : ziel + c.ri(R, 2, 8), pay = c.addDays(g, off);
      const O = ['Er darf ' + pr + ' % Skonto abziehen', 'Er zahlt den vollen Rechnungsbetrag, noch innerhalb des Zahlungsziels', 'Die Zahlung ist überfällig, das Zahlungsziel ist überschritten', 'Er darf die Hälfte des Skontos abziehen'];
      const right = art === 'skonto' ? O[0] : art === 'netto' ? O[1] : O[2], got = c.zahlungsArt(g, pay, sk, ziel);
      return choiceQ(R, 'Eine Rechnung vom ' + dt(g) + ' trägt den Vermerk: "Zahlung innerhalb von ' + sk + ' Tagen mit ' + pr + ' % Skonto, innerhalb von ' + ziel + ' Tagen netto." Die Fristen laufen ab Rechnungsdatum. Der Kunde zahlt am ' + dt(pay) + '. Was gilt?', right, O.filter(x => x !== right),
        'Skontofrist endet am ' + dt(c.skontoEnde(g, sk)) + ', Zahlungsziel am ' + dt(c.skontoEnde(g, ziel)) + '. Gezahlt wurde am ' + dt(pay) + ': ' + (got === 'skonto' ? 'innerhalb der Skontofrist.' : got === 'netto' ? 'nach der Skontofrist, aber vor dem Zahlungsziel.' : 'nach dem Zahlungsziel.'), ['Berechne beide Fristenden ab Rechnungsdatum.', 'Liegt der Zahlungstag vor dem ersten, zwischen den beiden oder nach dem zweiten Fristende?'], { g, sk, ziel, pay, art });
    },
    zins: R => {
      const c = C(), K = c.ri(R, 3, 60) * 100, p = c.pick(R, [8, 9, 10, 11, 12]), t = c.pick(R, [10, 15, 20, 30, 36, 40, 45, 60, 72, 90]), Z = c.zins(K, p, t);
      return numQ('Ein Kunde schuldet ' + f(K, 0) + ' €. Er ist ' + t + ' Tage im Verzug. Der Verzugszinssatz beträgt ' + f(p, 0) + ' % pro Jahr. Berechne die Verzugszinsen (Jahr zu 360 Tagen, auf Cent runden).', Z, '€', 'Verzugszinsen', 0.01,
        'Zinsen = Kapital · Zinssatz · Tage / (100 · 360) = ' + f(K, 0) + ' · ' + f(p, 0) + ' · ' + t + ' / 36.000 = ' + f(Z, 2) + ' €.', ['Die Zinsformel lautet Z = K · p · t / (100 · 360).', 'Für t setzt du die Verzugstage ein, nicht die Monate.'], { K, p, t });
    },
    mahnstufen: R => orderQ(R, 'mahn', 'Ein Kunde zahlt eine fällige Rechnung nicht. In welcher Reihenfolge geht der Lieferant üblicherweise vor?', ['Von der freundlichen zur strengen Form, zuletzt das Gericht.', 'Erst die Rechnung, am Ende der Vollstreckungsbescheid.'], 'Der Lieferant steigert die Mittel Schritt für Schritt: erinnern, mahnen, Frist setzen, gerichtlich vorgehen.'),
    belegWer: R => {
      const c = C(), it = c.pick(R, c.ORDER.beleg.items.filter(x => x.k !== 'Zahlung')), right = it.wer === 'Kunde' ? 'Der Kunde (Käufer)' : 'Der Lieferant (Verkäufer)';
      return choiceQ(R, 'Wer erstellt in der Regel den Beleg "' + it.k + '"?', right, ['Der Kunde (Käufer)', 'Der Lieferant (Verkäufer)', 'Die Bank', 'Das Finanzamt'].filter(x => x !== right), it.n + ': ' + it.d + ' Ersteller: ' + it.wer + '.', ['Wer will etwas wissen oder bestellen, wer bietet an oder liefert?', 'Bank und Finanzamt sind nicht an der Kaufabwicklung beteiligt.'], { k: it.k, wer: it.wer });
    },
    belegFolge: R => {
      const c = C(), it = c.ORDER.beleg.items, i = c.ri(R, 0, it.length - 2), right = it[i + 1].k, cands = it.map(x => x.k).filter(k => k !== it[i].k);
      return choiceQ(R, 'Welcher Beleg folgt in der Kette der Kaufabwicklung (Anfrage bis Zahlung) direkt auf den Beleg "' + it[i].k + '"?', right, distinct(R, right, cands, 3), 'Die Reihenfolge lautet: ' + c.orderRight('beleg').join(' → ') + '. Auf "' + it[i].k + '" folgt "' + right + '".', ['Gehe die Kette von der Anfrage bis zur Zahlung im Kopf durch.', 'Lieferschein und Rechnung kommen erst nach der Bestellung.'], { i });
    },
    pflicht: R => {
      const c = C(), miss = c.ri(R, 0, c.PFLICHT.length - 1), amount = c.ri(R, 5, 60) * 50 + 300, here = c.PFLICHT.filter((x, i) => i !== miss), right = c.PFLICHT[miss];
      return choiceQ(R, 'Ein Betrieb prüft eine Rechnung über ' + f(amount, 0) + ' € brutto auf Pflichtangaben. Auf ihr stehen: ' + here.join('; ') + '. Welche Pflichtangabe fehlt?', right, c.shuffle(R, here).slice(0, 3),
        'Die Rechnung enthält ' + here.length + ' der ' + c.PFLICHT.length + ' Pflichtangaben. Es fehlt: ' + right + '.', ['Gehe die neun Pflichtangaben der Reihe nach durch und hake ab.', 'Gesucht ist die Angabe, die im Text nicht vorkommt.'], { miss, here });
    },
    sv: R => {
      const c = C(), B = c.ri(R, 18, 42) * 100, p = c.svSatz(), v = c.abzug(B, p);
      return numQ('Ein Mitarbeiter verdient ' + f(B, 0) + ' € brutto im Monat. Für die Sozialversicherung (Arbeitnehmeranteil) gilt als Übungswert zusammen ' + f(p, 1) + ' % (Rentenversicherung 9,3 %, Krankenversicherung 7,3 %, Pflegeversicherung 1,8 %, Arbeitslosenversicherung 1,3 %). Wie hoch ist der Abzug für die Sozialversicherung in €?', v, '€', 'Abzug Sozialversicherung', 0.01,
        'Abzug = Brutto · Prozentsatz / 100 = ' + f(B, 0) + ' · ' + f(p, 1) + ' / 100 = ' + f(v, 2) + ' €. Der Arbeitgeberanteil kommt zusätzlich und wird nicht abgezogen.', ['Prozentwert = Grundwert · Prozentsatz / 100.', 'Die vier Sätze sind schon zu einem Gesamtsatz zusammengezählt.'], { B, p });
    },
    lohn: R => {
      const c = C(), sl = c.ri(R, 7, 12) * 2, nh = c.pick(R, [150, 160, 168]), uh = c.ri(R, 4, 14), br = c.bruttoLohn(sl, nh, uh, 25), a = c.abrechnung(br, { lst: 15, rv: 9.3, kv: 7.3, pv: 1.8, av: 1.3 });
      return numQ('Ein Mitarbeiter bekommt ' + f(sl, 0) + ' € Stundenlohn. Im Monat arbeitet er ' + nh + ' Normalstunden und ' + uh + ' Überstunden. Überstunden werden mit 25 % Zuschlag bezahlt. Als Übungswerte werden vom Bruttolohn 15 % Lohnsteuer und 19,7 % Sozialversicherung (Arbeitnehmeranteil) abgezogen. Wie hoch ist der Auszahlungsbetrag in €?', a.netto, '€', 'Auszahlungsbetrag', 0.02,
        'Brutto = ' + f(sl, 0) + ' · ' + nh + ' + ' + f(sl, 0) + ' · 1,25 · ' + uh + ' = ' + f(br, 2) + ' €. Lohnsteuer 15 % = ' + f(a.lst, 2) + ' €, Sozialversicherung 19,7 % = ' + f(a.sv, 2) + ' €. Netto = ' + f(br, 2) + ' − ' + f(a.lst, 2) + ' − ' + f(a.sv, 2) + ' = ' + f(a.netto, 2) + ' €. (Die Buchung der Gehaltsabrechnung findest du im Buchführungs-Lab.)', ['Rechne zuerst das Brutto: Überstunden bekommen einen Zuschlag von 25 %.', 'Dann beide Abzüge vom Brutto berechnen und abziehen.'], { sl, nh, uh });
    },
    kuend: R => {
      const c = C(), j = c.pick(R, [1, 3, 6]), z = c.dateRand(R), right = c.kuendEnde(z, j);
      const cands = [c.endOfMonth(c.addMonths(z, 1)), c.endOfMonth(c.addMonths(z, 2)), c.endOfMonth(c.addMonths(z, 3)), c.addDays(z, 28), c.addMonths(z, 1), c.addMonths(z, 2), c.endOfMonth(z)].map(dt);
      return choiceQ(R, 'Ein Arbeitgeber kündigt einem Mitarbeiter. Die Kündigung geht am ' + dt(z) + ' zu. Der Mitarbeiter ist seit ' + j + (j === 1 ? ' Jahr' : ' Jahren') + ' im Betrieb. Übungsfristen für Kündigung durch den Arbeitgeber: bis zwei Jahre 4 Wochen zum 15. oder zum Monatsende, ab 2 Jahren 1 Monat zum Monatsende, ab 5 Jahren 2 Monate zum Monatsende. Wann endet das Arbeitsverhältnis frühestens?', dt(right), distinct(R, dt(right), cands, 3),
        'Beschäftigungsdauer ' + j + (j === 1 ? ' Jahr' : ' Jahre') + (c.kuendMonate(j) ? ': ' + c.kuendMonate(j) + ' Monat(e) zum Monatsende, also ' : ': 4 Wochen zum 15. oder zum Monatsende. Vier Wochen nach dem Zugang ist der ' + dt(c.addDays(z, 28)) + ', der nächste 15. oder das Monatsende danach ist ') + dt(right) + '.', ['Suche zuerst in der Übersicht die Frist für die Betriebszugehörigkeit.', 'Monate zum Monatsende: Zugangsmonat plus Monate, dann der letzte Tag.'], { z, j });
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    [CATS[0], 1, 'Anfrage und Angebot', 'p_anf'], [CATS[0], 1, 'Antrag und Annahme', 'p_antrag'], [CATS[0], 2, 'Bindung ans Angebot', 'bind'], [CATS[0], 2, 'Angebot mit Zusatz', 'frei'], [CATS[0], 3, 'Vertrag oder nicht', 'vertrag'],
    [CATS[1], 1, 'Welcher Vertrag', 'p_art'], [CATS[1], 2, 'Erfolg oder Tätigkeit', 'p_erfolg'], [CATS[1], 2, 'Pflichten der Vertragspartner', 'p_pflicht'],
    [CATS[2], 1, 'Störung erkennen', 'p_stoer'], [CATS[2], 2, 'Art der Abweichung', 'p_mangel'], [CATS[2], 2, 'Mahnung oder nicht', 'mahnnoetig'], [CATS[2], 2, 'Erste Reaktion', 'p_reakt'], [CATS[2], 3, 'Rechte des Käufers', 'faelle'],
    [CATS[3], 1, 'Dauer der Fristen', 'p_dauer'], [CATS[3], 2, 'Ende der Verjährung', 'verj'], [CATS[3], 2, 'Ende der Gewährleistung', 'gewl'], [CATS[3], 2, 'Frist für die Rüge', 'ruege'], [CATS[3], 3, 'Tage zwischen zwei Terminen', 'tage'], [CATS[3], 3, 'Schritte nach dem Wareneingang', 'ruegeablauf'],
    [CATS[4], 1, 'Eigentum oder Besitz', 'p_eigen'], [CATS[4], 3, 'Ware wird weiterverkauft', 'p_ev'], [CATS[4], 1, 'Zahlungsbedingung deuten', 'p_zahl'], [CATS[4], 2, 'Zahlung am Stichtag', 'skonto'], [CATS[4], 2, 'Zinsen für die Verspätung', 'zins'], [CATS[4], 3, 'Schritte bei ausbleibender Zahlung', 'mahnstufen'],
    [CATS[5], 1, 'Wer erstellt den Beleg', 'belegWer'], [CATS[5], 2, 'Der nächste Beleg', 'belegFolge'], [CATS[5], 2, 'Beleg und Zweck', 'p_beleg'], [CATS[5], 3, 'Inhalt einer Rechnung', 'pflicht'],
    [CATS[6], 1, 'Brutto und Netto', 'p_brutto'], [CATS[6], 2, 'Abzug vom Bruttolohn', 'sv'], [CATS[6], 3, 'Von den Stunden zur Auszahlung', 'lohn'], [CATS[6], 2, 'Probezeit', 'p_probe'], [CATS[6], 3, 'Ende des Arbeitsverhältnisses', 'kuend']
  ];
  const tasks = defs.map((d, i) => ({ id: 'rec' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('rec-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Schritte entstehen im UI aus REC_CORE) ---------- */
  const examples = [
    { id: 'vert1', tab: 'vert', title: 'Bindendes Angebot, rechtzeitige Bestellung', text: 'Ein Lieferant schickt ein bindendes Angebot, gültig bis 30.04.2025. Der Kunde bestellt am 28.04.2025 unverändert. Ist der Kaufvertrag zustande gekommen?', p: { angebot: 'bindend', bis: '30.04.2025', best: '28.04.2025', abw: 'nein', ab: 'keine' } },
    { id: 'vert2', tab: 'vert', title: 'Freibleibendes Angebot und Auftragsbestätigung', text: 'Das Angebot ist freibleibend. Der Kunde bestellt am 05.05.2025, der Lieferant bestätigt am 07.05.2025 unverändert.', p: { angebot: 'frei', bis: '', best: '05.05.2025', abw: 'nein', ab: 'gleich' } },
    { id: 'vert3', tab: 'vert', title: 'Auftragsbestätigung mit anderem Preis', text: 'Das Angebot ist freibleibend. Der Kunde bestellt am 05.05.2025, der Lieferant bestätigt mit einem höheren Preis.', p: { angebot: 'frei', bis: '', best: '05.05.2025', abw: 'nein', ab: 'abweichend' } },
    { id: 'fall1', tab: 'fall', title: 'Mangel: Nacherfüllung gescheitert', text: 'Ein Händler hat die Ware rechtzeitig gerügt. Der Hersteller hat zweimal erfolglos nachgebessert, der Mangel ist erheblich, der Fehler geht auf eine schlampige Endkontrolle zurück.', p: { stoerung: 'mangel', handel: 'ja', mangelart: 'offen', ruege: 'ja', nacherf: 'gescheitert', erheblich: 'ja', verschulden: 'ja' } },
    { id: 'fall2', tab: 'fall', title: 'Mangel: Rüge versäumt', text: 'Ein Händler meldet einen offenen Mangel erst nach vielen Wochen.', p: { stoerung: 'mangel', handel: 'ja', mangelart: 'offen', ruege: 'nein', nacherf: 'offen', erheblich: 'ja', verschulden: 'ja' } },
    { id: 'frist1', tab: 'frist', title: 'Verjährung eines Zahlungsanspruchs', text: 'Ein Zahlungsanspruch ist am 15.06.2025 entstanden. Wann verjährt er?', p: { mode: 'verj', d1: '15.06.2025' } },
    { id: 'frist2', tab: 'frist', title: 'Zahlungsverzug mit Zinsen', text: 'Rechnung über 4.000 € am 10.03.2025 zugegangen, bezahlt am 20.05.2025. Verzugszinssatz 11 %.', p: { mode: 'verzug', d1: '10.03.2025', d2: '20.05.2025', betrag: '4000', satz: '11' } },
    { id: 'frist3', tab: 'frist', title: 'Ende der Gewährleistung', text: 'Die Ware wurde am 10.03.2025 abgeliefert. Wann endet die Gewährleistungsfrist von zwei Jahren?', p: { mode: 'gew', d1: '10.03.2025' } },
    { id: 'frist4', tab: 'frist', title: 'Kündigung nach sechs Jahren Betriebszugehörigkeit', text: 'Dem Mitarbeiter wird am 10.03.2025 gekündigt, er ist seit sechs Jahren im Betrieb.', p: { mode: 'kuend', d1: '10.03.2025', jahre: '6' } },
    { id: 'beleg1', tab: 'beleg', title: 'Belegkette der Kaufabwicklung', text: 'Von der Anfrage bis zur Zahlung: Welcher Beleg kommt wann, und wer erstellt ihn?', p: { set: 'beleg' } },
    { id: 'lohn1', tab: 'lohn', title: 'Von Brutto zu Netto', text: 'Ein Mitarbeiter verdient 2.800 € brutto. Abzüge mit den Übungssätzen.', p: { brutto: '2800' } }
  ];

  root.REC_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sets: SETS };
  root.REC_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.REC_DATA, TASKS: root.REC_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
