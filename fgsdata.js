'use strict';
/* Tonfunk Fachgespräch-Lab: Daten (Aufgaben-Generatoren, Leitfragen fürs Fachgespräch).
   ALLE Zahlen (Zeiten, Puffer, Gewichte, Punkte) sind ÜBUNGSWERTE, keine Vorgaben einer Prüfung. Alle Betriebe, Geräte und Aufträge sind frei erfunden ("Modellbetrieb").
   window.FGS_DATA  { cats, tasks, gens, make, makeTask, randomQ, phasen, krit, fragen }
   window.FGS_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'fgs', Status in localStorage 'lm4.fgs.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage q: { text, ask, value, tol, expl, tips[2], steps[] (So gehst du vor), table? {head, rows} }. */
(function (root) {
  const C = () => root.FGS_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Ausbildung und Unterweisungen', 'Arbeitsauftrag planen', 'Präsentation vorbereiten', 'Fachgespräch führen', 'Bewerten und Rückmeldung'];

  const numQ = (text, value, unit, label, tol, expl, tips, steps, more) => Object.assign({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, steps }, more || {});
  function choiceQ(R, text, right, wrong, expl, tips, steps) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps };
  }
  /* Auswahlaufgabe aus Varianten [Text, richtig, falsch[3], Erklärung]; tips und steps gelten für alle Varianten */
  const pv = (tips, steps, vars) => R => { const v = C().pick(R, vars); return choiceQ(R, v[0], v[1], v[2], v[3], tips, steps); };

  /* Reihenfolge-Aufgabe: richtig ist die gegebene Reihenfolge, falsch sind Tauschungen von Schritten mit mindestens einem Schritt dazwischen */
  function orderQ(tips, steps, scenarios, why) {
    return R => {
      const c = C(), sc = c.pick(R, scenarios), s = sc.s, n = s.length, pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) pairs.push([i, j]);
      const wrong = c.shuffle(R, pairs).slice(0, 3).map(p => { const t = s.slice(); [t[p[0]], t[p[1]]] = [t[p[1]], t[p[0]]]; return t.join(' → '); });
      return choiceQ(R, sc.t, s.join(' → '), wrong, why + ' Richtig: ' + s.join(' → ') + '.', tips, steps);
    };
  }

  const KRIT = [
    { k: 'fach', n: 'Fachlich richtig', d: 'Die Aussagen stimmen und passen zur Frage.' },
    { k: 'beg', n: 'Begründet', d: 'Du nennst das Warum, nicht nur das Was.' },
    { k: 'term', n: 'Fachbegriffe', d: 'Du benutzt die richtigen Begriffe.' },
    { k: 'verst', n: 'Verständlich', d: 'Kurze Sätze, klare Ordnung, ein Zuhörer kann folgen.' }
  ];
  const PHASEN = [
    { k: 'ein', n: 'Einstieg mit dem eigenen Projekt', kurz: 'Einstieg' },
    { k: 'vor', n: 'Vorgehen begründen', kurz: 'Vorgehen' },
    { k: 'abw', n: 'Fehler und Abweichungen erklären', kurz: 'Fehler' },
    { k: 'alt', n: 'Alternativen nennen', kurz: 'Alternativen' },
    { k: 'sich', n: 'Sicherheit und Qualität', kurz: 'Sicherheit' }
  ];
  /* Leitfragen mit Stichpunkten einer guten Antwort: id, Phase, Frage, Stichpunkte */
  const FRAGEN = [
    ['e1', 'ein', 'Stell kurz deinen Auftrag vor: Was war die Aufgabe, und was sollte am Ende herauskommen?', ['Auftrag in ein bis zwei Sätzen: Gerät oder Baugruppe und Zweck', 'Ergebnis und Termin nennen', 'Die eigene Rolle: Was hast du selbst gemacht?', 'Roter Faden: Planung, Aufbau, Prüfung, Ergebnis']],
    ['e2', 'ein', 'Wie bist du an den Auftrag herangegangen? Was hast du als Erstes getan?', ['Auftrag und Unterlagen gelesen, Unklares geklärt', 'Arbeitsschritte geplant, Zeit mit Puffer', 'Material und Prüfmittel bereitgelegt']],
    ['e3', 'ein', 'Wofür wird das Gerät oder die Baugruppe gebraucht, und wie funktioniert sie in groben Zügen?', ['Einsatzzweck in einem Satz', 'Eingang, Verarbeitung, Ausgang (Blockschaltbild)', 'Die wichtigsten Bauteile mit ihrer Aufgabe', 'Mit eigenen Worten erklären, nicht ablesen']],
    ['e4', 'ein', 'Welche Unterlagen hast du benutzt, und was stand jeweils darin?', ['Schaltplan, Stückliste, Datenblatt, Prüfplan', 'Wofür du welche Unterlage gebraucht hast', 'Auf den aktuellen Stand der Unterlage geachtet', 'Eigene Unterlagen: Protokoll und Berichtsheft']],
    ['v1', 'vor', 'Warum hast du die Arbeitsschritte in genau dieser Reihenfolge geplant?', ['Abhängigkeiten: Was braucht das Ergebnis des vorigen Schritts?', 'Material und Prüfmittel liegen vor dem Aufbau bereit', 'Prüfen erst nach dem Aufbau, Dokumentieren sofort', 'Puffer für Unerwartetes']],
    ['v2', 'vor', 'Warum hast du dieses Bauteil oder diesen Wert gewählt?', ['Anforderung nennen, zum Beispiel Strom, Spannung, Toleranz', 'Kurze Rechnung oder Wert aus dem Datenblatt', 'Normwert gewählt und nachgerechnet', 'Reserve und Grenzen: Leistung, Spannungsfestigkeit']],
    ['v3', 'vor', 'Wie hast du geprüft, ob dein Ergebnis die Anforderungen erfüllt?', ['Prüfplan: Was wird womit gegen welchen Sollwert geprüft?', 'Reihenfolge der Messungen', 'Messwerte mit Einheit im Protokoll', 'Ergebnis mit dem Sollwert verglichen']],
    ['v4', 'vor', 'Wie hast du deine Zeit eingeteilt, und ist der Plan aufgegangen?', ['Plan: Schritte mit Dauer und Puffer', 'Ist-Zeiten mit dem Plan verglichen', 'Was länger gedauert hat und warum', 'Was du nächstes Mal anders planst']],
    ['a1', 'abw', 'Gab es eine Abweichung vom Plan oder einen Fehler? Was war los, und wie hast du es gelöst?', ['Offen benennen, nichts verstecken', 'Ursache eingrenzen: Sichtprüfung, messen, Schritt für Schritt', 'Beschreiben, wie du den Fehler behoben hast', 'Danach erneut geprüft und dokumentiert']],
    ['a2', 'abw', 'Ein Messwert liegt außerhalb der Toleranz. Was machst du?', ['Messung wiederholen, Messaufbau und Messbereich kontrollieren', 'Ursache suchen: Bauteil, Lötstelle, Prüfmittel', 'Den echten Wert ehrlich protokollieren', 'Ausbilder oder Auftraggeber informieren']],
    ['a3', 'abw', 'Das Material kommt später als geplant. Wie reagierst du?', ['Früh melden', 'Reihenfolge umstellen: Unabhängiges vorziehen', 'Puffer nutzen und Termin neu abschätzen', 'Absprache festhalten']],
    ['a4', 'abw', 'Was würdest du beim nächsten Mal anders machen?', ['Einen konkreten Punkt nennen, nicht nur "alles gut"', 'Begründen, warum die Änderung hilft', 'Zeigen, was du gelernt hast', 'Beispiel aus dem Auftrag nennen']],
    ['l1', 'alt', 'Welche andere Lösung hättest du wählen können, und warum hast du sie nicht gewählt?', ['Mindestens eine echte Alternative nennen', 'Vor- und Nachteile vergleichen: Aufwand, Kosten, Platz, Sicherheit', 'Die eigene Entscheidung begründen', 'Sagen, wann die Alternative besser wäre']],
    ['l2', 'alt', 'Der Auftraggeber wünscht eine höhere Genauigkeit. Was würdest du ändern?', ['Was genauer werden muss', 'Bauteile mit kleinerer Toleranz oder ein anderes Messverfahren', 'Folgen für Kosten und Zeit', 'Einen neuen Test einplanen']],
    ['l3', 'alt', 'Wie wäre das Ergebnis, wenn nur die halbe Zeit zur Verfügung gestanden hätte?', ['Priorisieren: Muss, Soll, Kann', 'Prüfung und Sicherheit bleiben unverzichtbar', 'Das Risiko offen nennen', 'Mit dem Auftraggeber abstimmen']],
    ['l4', 'alt', 'Wie könntest du den Ablauf für eine größere Stückzahl verbessern?', ['Wiederkehrende Schritte vorbereiten, zum Beispiel Vorlage oder Vorrichtung', 'Prüfen mit Stichprobe oder Prüfvorrichtung', 'Zeit je Gerät neu rechnen', 'Dokumentation vereinfachen, ohne Lücken zu lassen']],
    ['s1', 'sich', 'Welche Sicherheitsmaßnahmen hast du bei deinem Auftrag beachtet?', ['Gefahren benennen: Spannung, Hitze, Dämpfe', 'Maßnahmen: Spannungsfreiheit, Schutzbrille, Absaugung', 'Unterweisung und Betriebsanweisung', 'ESD-Schutz bei empfindlichen Bauteilen']],
    ['s2', 'sich', 'Woran erkennst du, dass deine Arbeit die Qualitätsanforderungen erfüllt?', ['Sichtprüfung der Lötstellen', 'Funktionsprüfung gegen Sollwerte', 'Dokumentation im Protokoll', 'Abnahme durch den Auftraggeber']],
    ['s3', 'sich', 'Wie stellst du sicher, dass deine Messergebnisse verlässlich sind?', ['Prüfmittel mit gültiger Kalibrierung', 'Richtiger Messbereich und richtiger Anschluss', 'Messung wiederholen, Werte auf Plausibilität prüfen', 'Messunsicherheit erwähnen']],
    ['s4', 'sich', 'Was machst du, wenn du bei einer Arbeit unsicher bist, ob sie sicher ist?', ['Die Arbeit anhalten', 'Betriebsanweisung nachlesen', 'Ausbilder oder Aufsicht fragen', 'Erst weitermachen, wenn die Antwort klar ist']]
  ].map(a => ({ id: a[0], ph: a[1], q: a[2], pts: a[3] }));

  const G = {};
  /* ============================================================ 1 Ausbildung und Unterweisungen */
  G.unt1 = pv(['Eine Unterweisung soll dich vor Gefahren schützen, bevor etwas passiert.', 'Streiche Antworten mit "nur" oder "nie", solche Aussagen sind meist zu eng.'],
    ['Frage genau lesen: Es geht um den Zweck der Unterweisung.', 'Überlege, welches Ziel Sicherheit im Betrieb hat.', 'Streiche Antworten, die die Unterweisung zur bloßen Formalität machen.'], [
      ['Dein Ausbilder unterweist dich, bevor du an einer neuen Maschine arbeitest. Wozu dient das?', 'Du lernst Gefahren und Schutzmaßnahmen kennen, bevor du anfängst zu arbeiten.', ['Die Unterweisung ersetzt die Betriebsanweisung, die du danach nicht mehr lesen musst.', 'Die Unterweisung dient nur dazu, dass der Betrieb eine Unterschrift von dir bekommt.', 'Die Unterweisung ist nur für Azubis ohne Vorkenntnisse gedacht.'], 'Eine Unterweisung zeigt dir vor Beginn der Arbeit, welche Gefahren es gibt und wie du dich schützt. Die Betriebsanweisung bleibt weiter wichtig.'],
      ['Warum werden Unterweisungen in festen Abständen wiederholt?', 'Wissen und Aufmerksamkeit lassen nach, und Regeln und Arbeitsplätze ändern sich.', ['Nur nach einem Unfall, sonst reicht die erste Unterweisung für die ganze Ausbildung.', 'Damit die Unterschriftenliste länger wird und im Prüfungsfall besser aussieht.', 'Weil Unterweisungen nur für neue Maschinen gelten und alte nie dazugehören.'], 'Wiederholung hält das Wissen frisch und bringt Änderungen im Betrieb zu dir. Deshalb gibt es feste Termine und zusätzliche Anlässe.']
    ]);
  G.unt2 = pv(['Die arbeitsplatzbezogene Unterweisung kommt vor der Arbeit, nicht danach.', 'Frage dich: Was darf ich erst tun, wenn ich die Gefahren dort kenne?'],
    ['Lies, an welcher Station oder bei welcher Tätigkeit du arbeiten sollst.', 'Frage dich, welche Unterweisung dort Pflicht ist.', 'Wähle den Zeitpunkt, der vor dem ersten Arbeiten liegt.'], [
      ['Du wechselst in eine neue Abteilung. Wann bekommst du die arbeitsplatzbezogene Unterweisung für diese Station?', 'Vor dem Einsatz an der neuen Station, bevor du dort arbeitest.', ['Am Ende der ersten Woche an der Station.', 'Erst beim nächsten halbjährlichen Termin für alle.', 'Nur, wenn du ausdrücklich danach fragst.'], 'Die Unterweisung für einen Arbeitsplatz gehört vor den ersten Einsatz dort. Warte nicht auf einen späteren Termin.'],
      ['Welche Schulung ist nötig, bevor du das erste Mal im Labor mit elektrostatisch gefährdeten Bauteilen arbeitest?', 'Die ESD-Schulung mit Nachweis.', ['Die Unterweisung für Flurförderzeuge.', 'Eine Unterweisung zum Bildschirmarbeitsplatz allein.', 'Keine, denn ESD betrifft nur Bauteile in der Fertigung und nicht das Labor.'], 'Wer an ESD-gefährdeten Bauteilen arbeitet, braucht vorher die ESD-Schulung und kann sie nachweisen.']
    ]);
  G.unt3 = pv(['Die Unterschrift ist ein Nachweis, kein Ersatz für das Zuhören.', 'Jeder unterschreibt nur für sich selbst und erst nach der Unterweisung.'],
    ['Überlege, was die Unterschrift beweisen soll.', 'Prüfe, ob die Aussage nur für dich und nur für diese Unterweisung gilt.', 'Streiche Antworten, die zu viel versprechen.'], [
      ['Du unterschreibst nach der Unterweisung die Teilnehmerliste. Was bestätigst du damit?', 'Dass die Unterweisung stattgefunden hat und du die Inhalte verstanden hast.', ['Dass du nie wieder eine Unterweisung brauchst.', 'Dass du alle Gefahren im Betrieb kennst, auch an anderen Stationen.', 'Nur, dass du an diesem Tag im Betrieb warst.'], 'Mit der Unterschrift belegst du, dass die Unterweisung stattfand und du die Inhalte verstanden hast. Für andere Stationen brauchst du eigene Unterweisungen.'],
      ['Eine Unterweisung fand statt, während du krank warst. Was ist richtig?', 'Du meldest dich beim Ausbilder, holst die Unterweisung nach und unterschreibst erst danach.', ['Du unterschreibst die Liste später im Voraus, damit sie vollständig ist.', 'Du arbeitest ohne Unterweisung weiter, weil die anderen sie bekommen haben.', 'Ein Kollege unterschreibt für dich, das ist üblich.'], 'Unterschreiben darfst du nur, wenn du die Unterweisung wirklich bekommen hast. Verpasste Unterweisungen werden nachgeholt.']
    ]);
  G.ba1 = pv(['Die Abschnitte haben feste Aufgaben: wofür, welche Gefahr, welcher Schutz, was bei Störung, Erste Hilfe, Entsorgung.', 'Suche das Stichwort, das zur Frage passt.'],
    ['Überlege, welche Frage du beantworten willst.', 'Ordne sie einem Abschnitt zu: Anwendungsbereich, Gefahren, Schutzmaßnahmen, Störungen, Erste Hilfe, Entsorgung.', 'Prüfe, dass kein anderer Abschnitt besser passt.'], [
      ['Du suchst in der Betriebsanweisung für den Lötkolben, was bei einer Verbrennung zu tun ist. In welchem Abschnitt schaust du nach?', 'Erste Hilfe', ['Anwendungsbereich', 'Entsorgung', 'Verhalten bei Störungen'], 'Maßnahmen bei einer Verletzung stehen im Abschnitt Erste Hilfe.'],
      ['Du willst wissen, für welche Maschine und welche Arbeiten die Anweisung überhaupt gilt. Wo steht das?', 'Anwendungsbereich', ['Entsorgung', 'Erste Hilfe', 'Verhalten bei Störungen'], 'Der Anwendungsbereich nennt, wofür die Betriebsanweisung gilt.'],
      ['Du suchst, wohin leere Flussmittelflaschen gehören. Wo steht das?', 'Entsorgung', ['Anwendungsbereich', 'Erste Hilfe', 'Schutzmaßnahmen und Verhaltensregeln'], 'Abfälle und Rückstände behandelt der Abschnitt Entsorgung.'],
      ['Du willst wissen, welche Schutzbrille und welche Handschuhe zur Arbeit gehören. Wo steht das?', 'Schutzmaßnahmen und Verhaltensregeln', ['Anwendungsbereich', 'Entsorgung', 'Erste Hilfe'], 'Schutzausrüstung und Verhaltensregeln stehen im Abschnitt Schutzmaßnahmen.']
    ]);
  G.ba2 = pv(['Zuerst die Gefahr beenden, dann melden. Nie selbst improvisieren.', 'Die Betriebsanweisung nennt für Störungen meist: abschalten, sichern, melden.'],
    ['Stelle fest, was gerade gefährlich ist.', 'Schalte ab und sichere die Stelle, wenn das ungefährlich möglich ist.', 'Melde die Störung dem Ausbilder oder der Aufsicht.'], [
      ['An der Bohrmaschine springt der Bohrer aus dem Futter, und die Maschine vibriert stark. Was tust du nach der Betriebsanweisung zuerst?', 'Maschine ausschalten, gegen Wiedereinschalten sichern und die Aufsicht informieren.', ['Weiterarbeiten und erst nach der Schicht melden.', 'Den Bohrer bei laufender Maschine mit der Hand festhalten.', 'Selbst reparieren, damit der Ausbilder nicht gestört wird.'], 'Bei einer Störung zuerst die Gefahr beenden: abschalten, sichern, melden. Repariert wird nur durch Befugte.'],
      ['Die Absaugung am Lötplatz fällt aus. Was tust du?', 'Das Löten unterbrechen und die Aufsicht informieren, bis die Absaugung wieder läuft.', ['Mit schnellerem Löten weiterarbeiten, dann entstehen weniger Dämpfe.', 'Die Absaugung bei laufendem Betrieb selbst öffnen und reparieren.', 'Weiterlöten und nichts sagen, damit es nicht auffällt.'], 'Ohne Absaugung atmest du Lötdämpfe ein. Die Arbeit ruht, bis die Schutzmaßnahme wieder funktioniert.']
    ]);
  G.esd1 = pv(['ESD-Schäden siehst du nicht sofort. Halte dich deshalb immer an die Regeln.', 'Fasse Baugruppen am Rand an und nicht an den Anschlüssen.'],
    ['Überlege, wie sich Ladung aufbauen und entladen kann.', 'Streiche Antworten, bei denen Ladung entstehen oder unkontrolliert fließen kann.', 'Wähle die Regel, die Ladung kontrolliert ableitet.'], [
      ['Welche Regel gehört zu den ESD-Grundregeln beim Arbeiten an Baugruppen?', 'Baugruppen am Rand anfassen, nicht an den Anschlüssen, und nur am geerdeten ESD-Arbeitsplatz öffnen.', ['Baugruppen zum Transport einfach übereinanderstapeln, das spart Platz.', 'Als Unterlage dient am besten eine normale Kunststofffolie.', 'Das Armband trägst du nur, wenn du lötest.'], 'Du schützt Bauteile durch Anfassen am Rand, ableitfähige Unterlage und Erdung des Körpers. Kunststoff lädt sich auf und stapeln beschädigt Baugruppen.'],
      ['Warum hat ein Erdungsarmband einen eingebauten hohen Widerstand (zum Beispiel 1 Megaohm)?', 'Es leitet Aufladungen langsam ab und schützt dich zugleich vor einem gefährlichen Strom, falls du an eine Spannung gerätst.', ['Damit sich das Armband schneller auflädt.', 'Damit sich die Ladung schlagartig entlädt und die Bauteile dabei geprüft werden.', 'Weil das Armband sonst nicht eng an der Haut anliegt.'], 'Der Widerstand begrenzt den Strom für dich und leitet die Ladung trotzdem sicher ab.']
    ]);
  G.esd2 = pv(['Der Nachweis gehört zu deiner Schulung, nicht zur Ausrüstung.', 'Ableitende Verpackung schützt, normale Kunststofftüten laden sich auf.'],
    ['Lies, ob es um den Nachweis oder um die Handhabung geht.', 'Überlege, was ESD-gefährdete Bauteile brauchen.', 'Wähle die Antwort mit ableitfähigem Schutz oder dem richtigen Zweck.'], [
      ['Wofür brauchst du den ESD-Nachweis (Zertifikat der Schulung)?', 'Er zeigt, dass du die ESD-Regeln kennst und an Arbeitsplätzen mit gefährdeten Bauteilen arbeiten darfst.', ['Er ersetzt das Erdungsarmband am Arbeitsplatz.', 'Er gilt für alle Tätigkeiten im Betrieb ohne weitere Unterweisung.', 'Er ist nur für den Zoll bei der Einfuhr von Bauteilen nötig.'], 'Der Nachweis belegt deine Schulung. Er ersetzt weder Schutzausrüstung noch andere Unterweisungen.'],
      ['Du willst eine empfindliche Baugruppe an einen anderen Arbeitsplatz bringen. Wie transportierst du sie?', 'In einem geschlossenen ESD-Beutel oder einer ESD-Verpackung.', ['In einer normalen Plastiktüte, die ist dicht.', 'Lose in der Hand, mit den Fingern an den Anschlüssen festgehalten.', 'In einem Karton mit Verpackungschips aus Kunststoffschaum.'], 'ESD-Verpackung leitet Ladung ab oder schirmt ab. Normale Kunststoffe laden sich auf.']
    ]);
  G.bh = pv(['Das Berichtsheft ist ein Nachweis deiner Ausbildung und gehört zu den Zulassungsvoraussetzungen.', 'Ein guter Eintrag nennt Tätigkeit, Zeit und Ergebnis.'],
    ['Lies, ob es um die Regeln fürs Führen oder um einen einzelnen Eintrag geht.', 'Beim Eintrag: Tätigkeit, Menge oder Dauer, Ergebnis.', 'Streiche zu kurze und zu allgemeine Antworten.'], [
      ['Was gilt für dein Berichtsheft (Ausbildungsnachweis)?', 'Du führst es regelmäßig, der Ausbilder zeichnet es ab, und es gehört zu den Voraussetzungen für die Zulassung zur Abschlussprüfung.', ['Du schreibst es am Ende der Ausbildung auf einmal, das spart Zeit.', 'Es ist freiwillig und für die Prüfung ohne Bedeutung.', 'Nur der Ausbilder schreibt es, du unterschreibst am Ende.'], 'Der Ausbildungsnachweis wird laufend geführt und abgezeichnet. Ein ordentlich geführtes Berichtsheft ist eine Voraussetzung für die Zulassung zur Abschlussprüfung.'],
      ['Welcher Eintrag im Berichtsheft ist am besten?', 'Lötübung an einer Netzteilplatine: 12 Lötstellen THT gelötet, 2 wegen kalter Lötstelle nachgearbeitet, Sichtprüfung mit dem Ausbilder.', ['Habe gearbeitet.', 'Heute war es schön, und ich habe viel gelernt.', 'Gelötet.'], 'Ein guter Eintrag nennt Tätigkeit, Menge und Ergebnis. So kann jeder nachvollziehen, was du gelernt hast.']
    ]);
  G.beur = pv(['Eine Beurteilung ist ein Gesprächsanlass, kein Urteil über dich als Person.', 'Konkrete Beispiele und ein Ziel machen sie nützlich.'],
    ['Lies die Beurteilung in Ruhe.', 'Besprich sie mit deinem Ausbilder und frage bei unklaren Punkten nach Beispielen.', 'Leite ein bis zwei Ziele für den nächsten Einsatz ab.'], [
      ['Nach deinem Einsatz in einer Abteilung bekommst du eine Beurteilung. Wie gehst du am besten damit um?', 'Du liest sie, besprichst sie mit dem Ausbilder, fragst bei unklaren Punkten nach und leitest ein bis zwei Ziele ab.', ['Du heftest sie ab, ohne sie zu lesen.', 'Du streitest jede schwächere Bewertung ab, ohne nach Beispielen zu fragen.', 'Du vergleichst sie mit denen deiner Kollegen und forderst bessere Punkte.'], 'Eine Beurteilung hilft dir nur, wenn du sie besprichst und daraus Ziele machst.'],
      ['Was hilft dir, damit die Beurteilung nach einem Einsatz aussagekräftig wird?', 'Du schätzt dich vorher selbst ein und kannst konkrete Aufgaben nennen, die du erledigt hast.', ['Du hältst dich zurück, damit niemand Fehler bemerkt.', 'Du bittest darum, dass nur gute Punkte eingetragen werden.', 'Du lässt die Beurteilung am letzten Tag ohne Gespräch ausfüllen.'], 'Mit Selbsteinschätzung und konkreten Beispielen wird das Gespräch genauer und fairer.']
    ]);

  /* ============================================================ 2 Arbeitsauftrag planen */
  G.auftr = pv(['Plane erst, wenn du verstanden hast, was verlangt ist.', 'Unklare Angaben klärst du vor dem Beginn, nicht danach.'],
    ['Lies den Auftrag ganz: Ergebnis, Termin, Unterlagen, Prüfvorgaben.', 'Markiere Unklares und kläre es vor dem Beginn.', 'Notiere die Antwort, damit sie nachvollziehbar bleibt.'], [
      ['Welche Angaben solltest du aus einem Arbeitsauftrag sicher herauslesen, bevor du planst?', 'Ergebnis, Termin, Unterlagen und die Vorgaben für die Prüfung.', ['Nur die Überschrift, den Rest siehst du beim Arbeiten.', 'Nur den Termin, der Rest ergibt sich von selbst.', 'Nur die Bauteilliste, die Prüfung betrifft einen anderen Kollegen.'], 'Wer Ergebnis, Termin, Unterlagen und Prüfvorgaben kennt, kann Schritte, Zeit und Material sinnvoll planen.'],
      ['Im Auftrag fehlt die Prüfspannung. Was tust du?', 'Du fragst vor dem Beginn beim Auftraggeber oder Ausbilder nach und notierst die Antwort.', ['Du nimmst einen Wert an, der dir passend erscheint, und arbeitest los.', 'Du lässt den Punkt weg und prüfst nur, was du kennst.', 'Du wartest, bis jemand beim Prüfen auf den Fehler kommt.'], 'Fehlende Angaben klärst du vor dem Beginn. Geraten wird nicht, und eine Antwort gehört in die Unterlagen.']
    ]);
  G.reihe = orderQ(['Frage bei jedem Schritt: Was braucht er vom Schritt davor?', 'Prüfen kommt erst nach dem Aufbau, Übergeben erst nach dem Protokoll.'],
    ['Lies die Schritte und überlege, was jeder Schritt braucht.', 'Setze den Schritt ohne Voraussetzung an den Anfang.', 'Prüfe die Reihenfolge von hinten: Was folgt wirklich zuletzt?'], [
      { t: 'Du sollst im Modellbetrieb eine Netzteilplatine aufbauen und prüfen. Welche Reihenfolge der Arbeitsschritte ist sinnvoll?', s: ['Auftrag lesen', 'Material bereitlegen', 'Platine aufbauen', 'Funktion prüfen', 'Protokoll und Übergabe'] },
      { t: 'Ein Gerät aus dem Modellbetrieb soll nach Prüfplan geprüft werden. Welche Reihenfolge ist sinnvoll?', s: ['Prüfplan lesen', 'Prüfmittel kontrollieren', 'Prüfaufbau herstellen', 'Messungen durchführen', 'Ergebnis bewerten'] },
      { t: 'Ein Prüfling aus dem Modellbetrieb funktioniert nicht. Welche Reihenfolge der Fehlersuche ist sinnvoll?', s: ['Fehler beschreiben', 'Messpunkte festlegen', 'Fehler eingrenzen', 'Fehler beheben', 'Funktion erneut prüfen'] }
    ], 'Jeder Schritt braucht das Ergebnis des vorigen.');
  G.zeit = R => {
    const c = C(), names = ['Auftrag lesen', 'Material holen', 'Platine aufbauen', 'Funktion prüfen', 'Protokoll schreiben', 'Übergabe vorbereiten'], n = c.ri(R, 4, 5); let d, sum, pct;
    for (let i = 0; i < 200; i++) { d = []; for (let k = 0; k < n; k++) d.push(5 * c.ri(R, 2, 12)); sum = c.sumSteps(d); pct = c.pick(R, [10, 15, 20, 25]); if ((sum * pct) % 100 === 0) break; }
    const buf = c.bufferMin(sum, pct), tot = c.totalWithBuffer(sum, pct);
    return numQ('Für einen Prüfauftrag im Modellbetrieb planst du diese Schritte: ' + d.map((m, i) => names[i] + ' ' + f(m, 0) + ' min').join(', ') + '. Dazu kommt ein Puffer von ' + f(pct, 0) + ' % auf die Summe der Schritte. Wie viele Minuten brauchst du insgesamt?', tot, 'min', 'Gesamtzeit mit Puffer', 0.01,
      'Summe der Schritte: ' + d.map(m => f(m, 0)).join(' + ') + ' = ' + f(sum, 0) + ' min. Puffer: ' + f(sum, 0) + ' · ' + f(pct, 0) + ' / 100 = ' + f(buf, 0) + ' min. Gesamt: ' + f(sum, 0) + ' + ' + f(buf, 0) + ' = ' + f(tot, 0) + ' min.',
      ['Der Puffer gilt für die Summe aller Schritte, nicht für einen einzelnen Schritt.', 'Rechne erst die Summe, dann den Puffer in Minuten, dann beides zusammen.'],
      ['Alle Schrittzeiten addieren.', 'Puffer in Minuten ausrechnen: Summe mal Prozentsatz durch 100.', 'Summe und Puffer addieren.']);
  };
  G.ende = R => {
    const c = C(); let d, sum, pct, start;
    for (let i = 0; i < 300; i++) { d = [c.ri(R, 3, 10) * 5, c.ri(R, 3, 10) * 5, c.ri(R, 3, 10) * 5, c.ri(R, 3, 10) * 5]; sum = c.sumSteps(d); pct = c.pick(R, [10, 15, 20, 25]); start = 420 + 15 * c.ri(R, 0, 10); if ((sum * pct) % 100 === 0 && sum !== 100 && sum * pct / 100 >= 5) break; }
    const buf = c.bufferMin(sum, pct), end = c.gantt(d.map(m => ({ n: '', d: m })), start, pct).end, ck = c.clock;
    return choiceQ(R, 'Du beginnst um ' + ck(start) + ' Uhr. Deine Schritte dauern ' + d.map(m => f(m, 0)).join(', ') + ' Minuten. Du planst ' + f(pct, 0) + ' % Puffer auf die Summe der Schritte ein. Wann bist du nach Plan fertig?',
      ck(end) + ' Uhr', [ck(start + sum) + ' Uhr', ck(start + sum + pct) + ' Uhr', ck(start + sum - buf) + ' Uhr'],
      'Summe: ' + f(sum, 0) + ' min. Puffer: ' + f(sum, 0) + ' · ' + f(pct, 0) + ' / 100 = ' + f(buf, 0) + ' min. Dauer gesamt: ' + f(sum + buf, 0) + ' min. ' + ck(start) + ' Uhr plus ' + f(sum + buf, 0) + ' min ergibt ' + ck(end) + ' Uhr.',
      ['Der Puffer wird zur Dauer addiert, nicht abgezogen, und die Prozentzahl sind keine Minuten.', 'Rechne die Gesamtdauer in Minuten und zähle sie zur Startzeit. 60 Minuten sind eine Stunde.'],
      ['Alle Schrittzeiten addieren.', 'Puffer in Minuten ausrechnen und addieren.', 'Gesamtdauer zur Startzeit zählen (60 Minuten sind eine Stunde).']);
  };
  G.pufp = R => {
    const c = C(), sum = 20 * c.ri(R, 5, 15), pct = c.pick(R, [10, 15, 20, 25, 30]), buf = c.bufferMin(sum, pct);
    return numQ('Dein Plan hat ' + f(sum, 0) + ' min Arbeitszeit und am Ende ' + f(buf, 0) + ' min Puffer. Wie viel Prozent Puffer sind das, bezogen auf die Arbeitszeit?', c.bufferPct(sum, buf), '%', 'Puffer', 0.01,
      'Puffer in Prozent = Puffer / Arbeitszeit · 100 = ' + f(buf, 0) + ' / ' + f(sum, 0) + ' · 100 = ' + f(pct, 0) + ' %.',
      ['Der Puffer wird durch die Arbeitszeit geteilt, nicht durch die Gesamtzeit.', 'Das Ergebnis der Division mit 100 malnehmen.'],
      ['Puffer in Minuten durch die Arbeitszeit teilen.', 'Das Ergebnis mit 100 malnehmen, das ergibt Prozent.']);
  };
  G.mat = pv(['Prüfmittel messen oder prüfen, Material wird verbaut, Werkzeug bearbeitet.', 'Ein Prüfmittel braucht einen gültigen Nachweis seiner Genauigkeit.'],
    ['Trenne Material, Werkzeug und Prüfmittel.', 'Schreibe zu jedem Prüfmittel auf, welcher Nachweis gelten muss.', 'Wähle die Antwort, bei der nichts Wichtiges fehlt.'], [
      ['Für den Aufbau einer Netzteilplatine liegt eine Stückliste vor. Was gehört zusätzlich in die Liste der Prüfmittel?', 'Das Multimeter und das Labornetzgerät mit gültigem Kalibriernachweis.', ['Der Lötzinn und das Flussmittel.', 'Die Platine und die Bauteile aus der Stückliste.', 'Der Seitenschneider und die Pinzette.'], 'Prüfmittel sind Geräte, mit denen du misst und prüfst. Lötzinn und Bauteile sind Material, Seitenschneider und Pinzette sind Werkzeug.'],
      ['Beim Planen merkst du: Das Prüfmittel ist seit Monaten über dem Kalibrierdatum. Was ist richtig?', 'Du nimmst ein Prüfmittel mit gültiger Kalibrierung oder lässt es erst neu kalibrieren.', ['Du nutzt es trotzdem und lässt das Datum im Protokoll weg.', 'Du nutzt es und rechnest 10 Prozent Sicherheit auf die Messwerte.', 'Du nutzt es, wenn die Anzeige plausibel aussieht.'], 'Messwerte zählen nur mit Prüfmitteln, deren Kalibrierung gültig ist. Das Datum steht im Protokoll.']
    ]);
  G.prot = pv(['Ein Protokoll muss ein anderer ohne dich verstehen.', 'Trage immer die echten Werte ein, auch wenn sie schlecht sind.'],
    ['Überlege, was ein Dritter wissen muss: Wer, was, womit, wann, Ergebnis.', 'Trage gemessene Werte unverändert ein.', 'Kennzeichne Abweichungen und melde sie.'], [
      ['Was gehört in ein brauchbares Prüfprotokoll?', 'Auftrag oder Gerät, Datum, Prüfer, Prüfmittel, Sollwerte, gemessene Istwerte und das Ergebnis.', ['Nur das Ergebnis "bestanden" mit Unterschrift.', 'Nur die Messwerte, die gut aussehen.', 'Nur eine Skizze des Geräts, Zahlen sind nicht nötig.'], 'Ein Protokoll macht die Prüfung nachvollziehbar: Wer hat was womit gemessen, und was war das Ergebnis?'],
      ['Ein Messwert liegt außerhalb der Toleranz. Wie trägst du ihn ein?', 'Du trägst den gemessenen Wert ein, kennzeichnest ihn als nicht in Ordnung und meldest es.', ['Du trägst den Sollwert ein, damit das Protokoll sauber aussieht.', 'Du lässt die Zeile leer.', 'Du misst so lange, bis ein guter Wert herauskommt, und trägst nur den ein.'], 'Ein Protokoll zeigt die Wahrheit. Abweichungen werden eingetragen und gemeldet.']
    ]);
  G.ueber = pv(['Zur Übergabe gehört alles, was der Empfänger braucht, um weiterzuarbeiten.', 'Änderungen und offene Punkte nennst du von dir aus.'],
    ['Überlege, was der Empfänger bekommen und wissen muss.', 'Nenne Besonderheiten und offene Punkte.', 'Übergib Gerät und Protokoll zusammen.'], [
      ['Dein Auftrag ist fertig. Was gehört zur Übergabe an den Auftraggeber?', 'Das fertige Gerät, das Prüfprotokoll und der Hinweis auf Besonderheiten oder offene Punkte.', ['Nur das Gerät, über Protokoll und offene Punkte sprichst du nur, wenn jemand fragt.', 'Nur eine mündliche Meldung, das Gerät bleibt am Arbeitsplatz.', 'Das Gerät ohne Protokoll, das behältst du für dich.'], 'Eine Übergabe ist vollständig mit Gerät, Protokoll und Hinweisen.'],
      ['Du hast beim Prüfen einen Mangel behoben, der nicht im Auftrag stand. Was gehört in die Übergabe?', 'Ein Hinweis, was du gefunden und geändert hast, damit der Auftraggeber Bescheid weiß.', ['Nichts, wenn es jetzt funktioniert, ist es egal.', 'Nichts, denn Änderungen gehen den Auftraggeber nichts an.', 'Ein Hinweis nur, wenn der Auftraggeber danach fragt.'], 'Änderungen am Gerät muss der Auftraggeber kennen. Du nennst sie von dir aus.']
    ]);
  G.kap = R => {
    const c = C(); let shift, pause, ruest, per, net;
    for (let i = 0; i < 300; i++) { shift = c.pick(R, [450, 480]); pause = c.pick(R, [30, 45, 60]); ruest = c.pick(R, [15, 20, 30]); per = c.pick(R, [35, 40, 45, 50, 55, 65]); net = c.netShift(shift, pause, ruest); const x = net / per; if (x - Math.floor(x) > 0.15 && x - Math.floor(x) < 0.85) break; }
    const n = c.jobsPerShift(net, per);
    return numQ('Ein Prüfplatz im Modellbetrieb ist eine Schicht von ' + f(shift, 0) + ' min besetzt. Davon gehen ' + f(pause, 0) + ' min für Pausen und ' + f(ruest, 0) + ' min für Rüsten ab. Ein Prüfauftrag braucht inklusive Puffer ' + f(per, 0) + ' min. Wie viele Aufträge schaffst du in dieser Schicht (nur volle Aufträge zählen)?', n, 'Aufträge', 'Aufträge je Schicht', 0.01,
      'Nutzbare Zeit: ' + f(shift, 0) + ' − ' + f(pause, 0) + ' − ' + f(ruest, 0) + ' = ' + f(net, 0) + ' min. ' + f(net, 0) + ' / ' + f(per, 0) + ' = ' + f(net / per, 2) + ', abgerundet ' + f(n, 0) + ' Aufträge.',
      ['Rechne zuerst aus, wie viel Zeit wirklich zum Prüfen bleibt.', 'Teile durch die Zeit je Auftrag und runde ab: Ein angefangener Auftrag zählt nicht.'],
      ['Pausen und Rüstzeit von der Schicht abziehen.', 'Die nutzbare Zeit durch die Zeit je Auftrag teilen.', 'Abrunden, weil nur volle Aufträge zählen.']);
  };
  G.rest = R => {
    const c = C(); let h, a, b, d;
    for (let i = 0; i < 300; i++) { h = c.pick(R, [6, 8, 10]); a = 5 * c.ri(R, 8, 24); b = 5 * c.ri(R, 8, 24); d = 5 * c.ri(R, 8, 24); if (h * 60 - a - b - d >= 20) break; }
    const left = h * 60 - a - b - d;
    return numQ('Für Aufträge stehen dir diese Woche ' + f(h, 0) + ' Stunden zur Verfügung. Drei Aufträge brauchen inklusive Puffer ' + f(a, 0) + ' min, ' + f(b, 0) + ' min und ' + f(d, 0) + ' min. Wie viele Minuten bleiben übrig?', left, 'min', 'Restzeit', 0.01,
      'Verfügbare Zeit: ' + f(h, 0) + ' · 60 = ' + f(h * 60, 0) + ' min. Aufträge: ' + f(a, 0) + ' + ' + f(b, 0) + ' + ' + f(d, 0) + ' = ' + f(a + b + d, 0) + ' min. Rest: ' + f(h * 60, 0) + ' − ' + f(a + b + d, 0) + ' = ' + f(left, 0) + ' min.',
      ['Rechne die Stunden zuerst in Minuten um.', 'Zähle die drei Auftragszeiten zusammen und ziehe sie von der Zeit ab.'],
      ['Stunden in Minuten umrechnen (mal 60).', 'Die drei Auftragszeiten addieren.', 'Die Summe von der verfügbaren Zeit abziehen.']);
  };

  /* ============================================================ 3 Präsentation vorbereiten */
  G.glied = pv(['Einstieg: Thema und Interesse. Hauptteil: der Inhalt. Schluss: Zusammenfassung und Fazit.', 'Ein Vortrag beginnt mit dem Warum und endet mit dem Ergebnis.'],
    ['Überlege, welche Aufgabe der Teil hat: wecken, erklären oder zusammenfassen.', 'Ordne die Aussage dem Teil zu.', 'Streiche Antworten, die in einen anderen Teil gehören.'], [
      ['Welche Aufgabe hat der Einstieg eines Vortrags?', 'Das Thema vorstellen und das Interesse der Zuhörer wecken.', ['Alle Messwerte der Reihe nach vorlesen.', 'Die Quellenangaben aufzählen.', 'Fragen des Publikums beantworten.'], 'Der Einstieg zeigt, worum es geht und warum es wichtig ist. Details folgen im Hauptteil.'],
      ['Was gehört in den Schluss?', 'Eine kurze Zusammenfassung der wichtigsten Punkte und ein Fazit oder Ausblick.', ['Ein ganz neues Thema, das vorher nicht vorkam.', 'Die ausführlichste Erklärung der Schaltung.', 'Eine Entschuldigung für alles, was nicht geklappt hat.'], 'Der Schluss fasst zusammen, was hängen bleiben soll. Neue Themen und lange Erklärungen gehören nicht mehr dazu.'],
      ['Du hast drei Folien: (A) "Ergebnis und Fazit", (B) "Aufbau der Schaltung", (C) "Worum es heute geht". In welcher Reihenfolge zeigst du sie?', 'C, B, A', ['B, C, A', 'A, B, C', 'C, A, B'], 'Erst das Thema (C, Einstieg), dann der Inhalt (B, Hauptteil), zum Schluss das Fazit (A).']
    ]);
  G.haupt = R => {
    const c = C(), T = c.pick(R, [10, 15, 20]), pe = c.pick(R, [10, 20]), ps = c.pick(R, [10, 20]), p = c.partMinutes(T, pe, ps);
    return numQ('Dein Vortrag dauert ' + f(T, 0) + ' Minuten. Der Einstieg bekommt ' + f(pe, 0) + ' % der Zeit, der Schluss ' + f(ps, 0) + ' %, der Rest gehört dem Hauptteil. Wie viele Minuten hat der Hauptteil?', p.h, 'min', 'Hauptteil', 0.01,
      'Anteil Hauptteil: 100 − ' + f(pe, 0) + ' − ' + f(ps, 0) + ' = ' + f(100 - pe - ps, 0) + ' %. Minuten: ' + f(T, 0) + ' · ' + f(100 - pe - ps, 0) + ' / 100 = ' + f(p.h, 2) + ' min.',
      ['Der Hauptteil ist der Rest: 100 Prozent minus Einstieg minus Schluss.', 'Rechne diesen Anteil von der Gesamtzeit aus.'],
      ['Anteil des Hauptteils bestimmen: 100 % minus Einstieg minus Schluss.', 'Gesamtzeit mal Anteil durch 100 rechnen.']);
  };
  G.folien = R => {
    const c = C(), T = c.pick(R, [10, 15, 20]), m = c.pick(R, [1, 1.5, 2]), n = c.slideCount(T, m);
    return numQ('Dein Vortrag dauert ' + f(T, 0) + ' Minuten. Du planst je Folie ' + f(m, 1) + ' Minuten. Wie viele Folien passen höchstens in den Vortrag (nur volle Folien)?', n, 'Folien', 'Folien', 0.01,
      f(T, 0) + ' min / ' + f(m, 1) + ' min je Folie = ' + f(T / m, 2) + ', abgerundet ' + f(n, 0) + ' Folien.',
      ['Teile die Vortragszeit durch die Zeit je Folie.', 'Runde ab: Eine angefangene Folie passt nicht mehr hinein.'],
      ['Die Vortragszeit durch die Minuten je Folie teilen.', 'Abrunden auf volle Folien.']);
  };
  G.vzeit = R => {
    const c = C(); let S, q, t;
    for (let i = 0; i < 200; i++) { S = c.pick(R, [20, 25, 30]); q = c.pick(R, [20, 25, 30]); t = c.talkMinutes(S, q); if ((t * 2) % 1 === 0) break; }
    return numQ('Dein Termin dauert ' + f(S, 0) + ' Minuten. Davon planst du ' + f(q, 0) + ' % für Fragen und Rückmeldung ein. Wie viele Minuten bleiben für den Vortrag selbst?', t, 'min', 'Vortragszeit', 0.01,
      'Fragen: ' + f(S, 0) + ' · ' + f(q, 0) + ' / 100 = ' + f(S * q / 100, 2) + ' min. Vortrag: ' + f(S, 0) + ' − ' + f(S * q / 100, 2) + ' = ' + f(t, 2) + ' min.',
      ['Rechne zuerst die Fragenzeit in Minuten aus.', 'Ziehe sie von der Terminzeit ab.'],
      ['Die Minuten für Fragen ausrechnen: Terminzeit mal Prozent durch 100.', 'Fragenzeit von der Terminzeit abziehen.']);
  };
  G.folie = pv(['Eine Folie unterstützt dich, sie ersetzt deinen Vortrag nicht.', 'Frage dich: Kann man die Folie in drei Sekunden erfassen?'],
    ['Stelle dir die Folie vor, wie sie hinten im Raum aussieht.', 'Streiche Folien mit viel Text oder vielen Gedanken.', 'Wähle die Folie mit einem klaren Schwerpunkt.'], [
      ['Welche Folie ist besser gestaltet?', 'Eine Überschrift, ein großes Schaltbild und drei kurze Stichpunkte.', ['Ein ganzer Absatz Fließtext in kleiner Schrift.', 'Zehn Stichpunkte, damit nichts vergessen wird.', 'Das Schaltbild klein in der Ecke, drumherum viel Text.'], 'Wenig Text, ein klares Bild und eine Überschrift: So erfassen Zuhörer die Folie sofort und hören dir zu.'],
      ['Wie viele Gedanken gehören auf eine Folie?', 'Ein Gedanke je Folie.', ['So viele wie möglich, damit weniger Folien nötig sind.', 'Alle Gedanken eines Teils, mehr als fünf.', 'Keine Gedanken, nur Bilder ohne Beschriftung.'], 'Ein Gedanke je Folie hält die Aufmerksamkeit bei dir und macht den roten Faden sichtbar.']
    ]);
  G.lesen = pv(['Denke an die letzte Reihe im Raum: Sieht man dort noch alles?', 'Kontrast und Größe zählen mehr als viele Farben.'],
    ['Überlege, wie die Folie auf einer großen Wand wirkt.', 'Prüfe Größe, Kontrast und Menge der Elemente.', 'Wähle die Lösung, die ohne Zusatzerklärung lesbar ist.'], [
      ['Dein Schaltplan soll auf einer Folie gezeigt werden. Was ist sinnvoll?', 'Den Schaltplan groß zeigen, das Wichtige hervorheben und nur die nötigen Teile beschriften.', ['Den ganzen Plan klein einfügen, damit alles zu sehen ist.', 'Den Plan als Foto vom Bildschirm mit Spiegelungen einfügen.', 'Nur eine Beschreibung ohne Bild.'], 'Ein großer, hervorgehobener Ausschnitt ist lesbar. Ein kleiner Gesamtplan ist es nicht.'],
      ['Was beachtest du bei Schrift und Farbe auf der Folie?', 'Große, klare Schrift und starker Kontrast zwischen Text und Hintergrund.', ['Möglichst viele Farben und Schriftarten, das wirkt lebendig.', 'Hellgrauer Text auf weißem Hintergrund, das sieht modern aus.', 'Kleine Schrift, damit mehr Text passt.'], 'Große Schrift und starker Kontrast machen die Folie lesbar, auch für Zuhörer weiter hinten.']
    ]);
  G.thema = pv(['Lies die Gliederung und frage dich: Worum geht es im Kern?', 'Das Thema passt zu allen drei Punkten.'],
    ['Lies die drei Gliederungspunkte.', 'Suche das Thema, das alle drei Punkte abdeckt.', 'Streiche Themen, die nur einen Punkt oder keinen betreffen.'], [
      ['Gliederung: (1) Wozu braucht man ein Netzteil, (2) Gleichrichten, Glätten, Stabilisieren, (3) Messung am Beispielgerät. Welches Thema passt?', 'Wie ein Netzteil aus Netzspannung eine Gleichspannung macht', ['Wie man ein Berichtsheft richtig führt', 'Unfallverhütung beim Staplerfahren', 'Wie ein Oszilloskop ein Signal darstellt'], 'Alle drei Punkte beschreiben, wie ein Netzteil arbeitet und wie man es misst.'],
      ['Gliederung: (1) Warum ESD Bauteile zerstört, (2) Armband, Matte, Verpackung, (3) Regeln für den Arbeitsplatz. Welches Thema passt?', 'ESD-Schutz am Arbeitsplatz', ['Löten von SMD-Bauteilen', 'Zeitplan für ein Projekt', 'Einführung in die Schaltalgebra'], 'Ursache, Schutzmittel und Regeln gehören zum Thema ESD-Schutz.'],
      ['Gliederung: (1) Was ist ein Fachgespräch, (2) typische Fragen, (3) wie ich mich vorbereite. Welches Thema passt?', 'So bereite ich mich auf ein Fachgespräch vor', ['Wie ein Kondensator geladen wird', 'Schutzklassen elektrischer Geräte', 'Aufbau eines Mikrocontrollers'], 'Die drei Punkte drehen sich um Fachgespräch und Vorbereitung darauf.']
    ]);
  G.probe = pv(['Nur die Stoppuhr zeigt, ob die Zeit reicht.', 'Kürze zuerst im Hauptteil beim Nebensächlichen.'],
    ['Sprich den Vortrag laut mit Stoppuhr durch.', 'Vergleiche die Zeit mit der Vorgabe.', 'Kürze Nebensächliches und prüfe erneut.'], [
      ['Wie prüfst du, ob dein Vortrag in die vorgegebene Zeit passt?', 'Du sprichst ihn laut mit Stoppuhr durch und kürzt, was nicht in die Zeit passt.', ['Du schätzt die Zeit im Kopf und hoffst, dass es passt.', 'Du liest nur die Folien durch und zählst die Wörter nicht.', 'Du planst fünf Minuten extra ein, ohne es auszuprobieren.'], 'Nur ein Probelauf mit Stoppuhr zeigt die echte Zeit, denn lautes Sprechen dauert länger als Lesen.'],
      ['Beim Probelauf dauert dein Vortrag länger als erlaubt. Was tust du?', 'Du kürzt Nebensächliches im Hauptteil und prüfst erneut mit der Stoppuhr.', ['Du sprichst am Tag des Vortrags einfach schneller.', 'Du streichst den Schluss ganz weg.', 'Du liest die Folien nur noch vor.'], 'Kürzen bei Nebensächlichem hält die Struktur. Schneller sprechen oder den Schluss streichen schadet dem Vortrag.']
    ]);

  /* ============================================================ 4 Fachgespräch führen */
  G.phasen = orderQ(['Das Gespräch beginnt bei deinem Projekt und endet bei Sicherheit und Qualität.', 'Begründen kommt vor Fehlern, Alternativen kommen danach.'],
    ['Überlege, womit ein Gespräch über dein Projekt beginnt.', 'Ordne die Phasen: Vorstellen, begründen, Fehler erklären, Alternativen, Sicherheit.', 'Prüfe die Reihenfolge von hinten.'], [
      { t: 'In diesem Lab verläuft ein Übungsgespräch in fünf Phasen. Welche Reihenfolge ist richtig?', s: ['Einstieg', 'Vorgehen begründen', 'Fehler erklären', 'Alternativen nennen', 'Sicherheit und Qualität'] }
    ], 'Das Übungsgespräch folgt dem Weg vom Vorstellen bis zur Bewertung.');
  G.pzuo = pv(['Achte auf das Fragewort: Warum, Welche andere, Woran liegt, Welche Schutzmaßnahmen.', 'Das Thema der Frage verrät die Phase.'],
    ['Lies die Frage und finde das Thema.', 'Ordne sie der Phase zu.', 'Prüfe, dass keine andere Phase besser passt.'], [
      ['Die Frage lautet: "Warum hast du dich für diese Schaltung entschieden?" Zu welcher Phase passt sie?', 'Vorgehen begründen', ['Einstieg mit dem eigenen Projekt', 'Fehler und Abweichungen erklären', 'Sicherheit und Qualität'], 'Eine Frage nach dem Warum einer Entscheidung gehört zum Begründen des Vorgehens.'],
      ['Die Frage lautet: "Welche Schutzmaßnahmen hast du bei der Prüfung getroffen?" Zu welcher Phase passt sie?', 'Sicherheit und Qualität', ['Einstieg mit dem eigenen Projekt', 'Vorgehen begründen', 'Alternativen nennen'], 'Schutzmaßnahmen sind Thema der Phase Sicherheit und Qualität.'],
      ['Die Frage lautet: "Welche andere Lösung hättest du wählen können?" Zu welcher Phase passt sie?', 'Alternativen nennen', ['Einstieg mit dem eigenen Projekt', 'Fehler und Abweichungen erklären', 'Sicherheit und Qualität'], 'Andere mögliche Lösungen sind das Thema der Phase Alternativen.'],
      ['Die Frage lautet: "Dein Messwert weicht vom Sollwert ab. Woran liegt das?" Zu welcher Phase passt sie?', 'Fehler und Abweichungen erklären', ['Einstieg mit dem eigenen Projekt', 'Alternativen nennen', 'Sicherheit und Qualität'], 'Eine Abweichung zwischen Soll und Ist erklärst du in der Phase Fehler und Abweichungen.']
    ]);
  G.gute = pv(['Eine gute Antwort hat Kernaussage, Begründung und ein Beispiel.', 'Schwache Antworten bleiben vage oder verweisen nur auf andere.'],
    ['Suche die Antwort mit fachlichem Inhalt und Begründung.', 'Streiche vage Antworten ("lief halt", "stand so da").', 'Prüfe, ob die gewählte Antwort die Frage wirklich beantwortet.'], [
      ['Frage: "Warum hast du den Vorwiderstand so dimensioniert?" Welche Antwort ist die beste?', 'Der Strom durch die LED soll 10 mA betragen. Mit der Spannung am Widerstand und dem Ohmschen Gesetz habe ich den Wert berechnet und den nächsten Normwert gewählt.', ['Das stand so im Schaltplan.', 'Das hat mein Kollege gesagt.', 'Weiß ich nicht mehr, aber es hat funktioniert.'], 'Die beste Antwort nennt die Anforderung, den Rechenweg und die Wahl des Normwerts.'],
      ['Frage: "Wie hast du geprüft, ob die Baugruppe in Ordnung ist?" Welche Antwort ist die beste?', 'Erst die Sichtprüfung der Lötstellen, dann die Versorgungsspannung gemessen, dann die Funktion nach Prüfplan getestet und alle Werte im Protokoll notiert.', ['Ich habe sie eingeschaltet, und sie lief.', 'Mit dem Messgerät, aber ich weiß nicht mehr, womit genau.', 'Das macht normalerweise jemand anderes.'], 'Eine gute Antwort beschreibt Schritte in sinnvoller Reihenfolge und nennt das Protokoll.']
    ]);
  G.beg = pv(['Begründen heißt: weil, damit, deshalb.', 'Ein Beispiel aus deinem Auftrag macht die Begründung glaubwürdig.'],
    ['Suche die Antwort mit einem Weil-Satz.', 'Prüfe, ob die Begründung zum Auftrag passt.', 'Streiche Antworten, die nur wiederholen oder ausweichen.'], [
      ['Du wirst gefragt, warum du einen Steckverbinder mit Verpolschutz gewählt hast. Welche Antwort begründet?', 'Weil ein falsches Stecken die Platine zerstören könnte und der Verpolschutz das mechanisch verhindert.', ['Weil ich Steckverbinder mit Verpolschutz oft verwende.', 'Er steht in der Stückliste.', 'Weil er schwarz ist.'], 'Eine Begründung nennt die Gefahr und wie die Entscheidung sie vermeidet.'],
      ['Welcher Satz begründet eine Entscheidung?', 'Ich habe den Aufbau zuerst getestet, weil Fehler dort später schwer zu finden sind. Bei der letzten Platine hat eine kalte Lötstelle einen Tag Suche gekostet.', ['Ich habe zuerst getestet.', 'Das ist so üblich.', 'Ich habe getestet, getestet und noch einmal getestet.'], 'Kernaussage, Begründung und ein Beispiel: Das macht eine Antwort überzeugend.']
    ]);
  G.begr = pv(['Prüfe jede Antwort: Welche Größe wird gemessen, wie wird angeschlossen?', 'Eine falsch benutzte Bezeichnung kostet im Gespräch Punkte.'],
    ['Lies die Aussagen genau.', 'Prüfe jede auf technische Richtigkeit.', 'Wähle die, in der alle Begriffe stimmen.'], [
      ['Du erklärst eine Messung. Welche Aussage benutzt die Fachbegriffe richtig?', 'Die Spannung messe ich parallel zum Bauteil, den Strom in Reihe dazu.', ['Die Spannung messe ich in Reihe, den Strom parallel.', 'Die Spannung fließt durch das Bauteil, den Strom messe ich daran.', 'Der Widerstand misst die Spannung am Strom.'], 'Spannung misst du parallel, Strom in Reihe. Strom fließt, Spannung liegt an.'],
      ['Welche Formulierung benutzt Fachbegriffe richtig?', 'Der Kondensator glättet die gleichgerichtete Spannung und verringert die Restwelligkeit.', ['Der Kondensator macht die Spannung gleichgerichtet und verstärkt die Restwelligkeit.', 'Der Gleichrichter macht aus Gleichspannung Wechselspannung.', 'Die Sicherung erhöht die Spannung, wenn zu viel Strom fließt.'], 'Der Gleichrichter macht aus Wechsel- eine Gleichspannung, der Kondensator glättet sie.'],
      ['Du beschreibst eine Lötstelle. Welcher Satz ist fachlich richtig?', 'Eine kalte Lötstelle hat eine matte, körnige Oberfläche, weil das Lot nicht richtig geflossen ist.', ['Eine gute Lötstelle ist kugelförmig und sitzt wie ein Tropfen auf dem Pad.', 'Eine kalte Lötstelle entsteht, wenn der Kolben zu heiß ist.', 'Bleifreies Lot schmilzt bei niedrigerer Temperatur als bleihaltiges.'], 'Kalte Lötstellen sind matt und körnig. Gute Lötstellen sind glatt und kegelförmig, und bleifreies Lot braucht mehr Temperatur.']
    ]);
  G.abw = pv(['Ehrlich sein, Ursache suchen, Lösung zeigen.', 'Niemand erwartet, dass nie etwas schiefgeht, aber dass du damit umgehen kannst.'],
    ['Nenne die Abweichung offen.', 'Beschreibe, wie du die Ursache eingegrenzt hast.', 'Sage, wie du es gelöst hast und was du daraus lernst.'], [
      ['Dein Messwert liegt über dem Sollwert. Welche Antwort im Fachgespräch ist am besten?', 'Ich habe den Wert mit dem Sollwert verglichen. Mögliche Ursache ist die Toleranz des Bauteils. Ich habe die Messung wiederholt und den Aufbau kontrolliert.', ['Das Messgerät war bestimmt kaputt.', 'Das liegt am Bauteil, dafür kann ich nichts.', 'Das ist normal, passiert dauernd.'], 'Eine gute Antwort vergleicht Soll und Ist, nennt Ursachen und zeigt, was du geprüft hast.'],
      ['Du hast etwas falsch eingebaut. Wie sprichst du im Fachgespräch darüber?', 'Ich nenne den Fehler offen, erkläre, wie ich ihn gefunden und behoben habe, und was ich künftig anders mache.', ['Ich erwähne ihn nicht, vielleicht fragt niemand.', 'Ich sage, ein anderer hätte den Fehler gemacht.', 'Ich sage, der Schaltplan sei falsch gewesen, ohne es geprüft zu haben.'], 'Offen mit Fehlern umzugehen und daraus zu lernen, ist eine Stärke.']
    ]);
  G.wnicht = pv(['Nicht raten, sondern sagen, was du weißt, und wie du vorgehen würdest.', 'Ehrlichkeit und ein klarer Weg zählen mehr als eine geratene Zahl.'],
    ['Sage ehrlich, was du nicht genau weißt.', 'Nenne, was du sicher weißt.', 'Beschreibe, wie du die Antwort finden würdest.'], [
      ['Der Prüfer fragt nach etwas, das du nicht weißt. Wie reagierst du am besten?', 'Du sagst ehrlich, dass du es nicht genau weißt, nennst, was du sicher weißt, und erklärst, wie du es herausfinden würdest.', ['Du rätst schnell irgendeine Zahl, damit du nicht schweigst.', 'Du schweigst, bis die Frage zurückgenommen wird.', 'Du wechselst das Thema und redest über etwas anderes.'], 'Wer begründet vorgeht, statt zu raten, zeigt Fachkompetenz und Ehrlichkeit.'],
      ['Du erinnerst dich nicht an einen Grenzwert. Welche Antwort ist gut?', 'Den genauen Wert weiß ich nicht auswendig. Ich würde ihn im Datenblatt nachschlagen und vorher die Größenordnung abschätzen.', ['Der liegt bei 100, ich bin mir ganz sicher.', 'Das weiß man doch.', 'Ich war an dem Tag nicht da.'], 'Nachschlagen und abschätzen ist ein sicheres Vorgehen. Eine geratene Zahl als sicher auszugeben, ist es nicht.']
    ]);
  G.rueckf = pv(['Eine Rückfrage zeigt, dass du genau sein willst.', 'Eine kurze Denkpause ist völlig in Ordnung.'],
    ['Entscheide, ob du die Frage verstanden hast.', 'Frage höflich nach oder wiederhole sie mit eigenen Worten.', 'Antworte erst dann ruhig und der Reihe nach.'], [
      ['Du hast die Frage nicht richtig verstanden. Was tust du?', 'Du fragst höflich nach oder gibst die Frage mit eigenen Worten wieder, um sicherzugehen.', ['Du antwortest auf etwas anderes, vielleicht passt es.', 'Du antwortest nicht und hoffst, dass die Frage vergessen wird.', 'Du sagst, die Frage sei unklar gestellt.'], 'Eine Rückfrage vermeidet Missverständnisse und wird im Fachgespräch erwartet.'],
      ['Du brauchst einen Moment zum Nachdenken. Was ist sinnvoll?', 'Kurz überlegen und dann ruhig antworten, eine Denkpause ist völlig in Ordnung.', ['Sofort losreden, damit keine Pause entsteht.', 'Aufstehen und etwas holen.', 'Die Frage ablehnen.'], 'Wer kurz nachdenkt, antwortet meist besser als jemand, der sofort drauflos redet.']
    ]);
  G.zphase = R => {
    const c = C(); let T, t0, n, x;
    for (let i = 0; i < 100; i++) { T = c.pick(R, [20, 25, 30, 35]); t0 = c.pick(R, [2, 3, 5]); n = c.pick(R, [3, 4]); x = c.perPhase(T, t0, n); if (x > 0) break; }
    return numQ('Dein Übungsgespräch dauert ' + f(T, 0) + ' Minuten. Die Vorstellung deines Auftrags dauert ' + f(t0, 0) + ' Minuten. Die übrige Zeit teilst du gleichmäßig auf ' + f(n, 0) + ' weitere Phasen auf. Wie viele Minuten hat jede dieser Phasen (auf zwei Stellen runden)?', x, 'min', 'Minuten je Phase', 0.01,
      'Restzeit: ' + f(T, 0) + ' − ' + f(t0, 0) + ' = ' + f(T - t0, 0) + ' min. Je Phase: ' + f(T - t0, 0) + ' / ' + f(n, 0) + ' = ' + f(x, 2) + ' min.',
      ['Ziehe zuerst die Vorstellung von der Gesamtzeit ab.', 'Teile die Restzeit durch die Zahl der Phasen.'],
      ['Vorstellung von der Gesamtzeit abziehen.', 'Die Restzeit durch die Zahl der Phasen teilen.']);
  };

  /* ============================================================ 5 Bewerten und Rückmeldung */
  const RASTER = [['Inhalt', 'Gliederung', 'Vortragsweise', 'Folien'], ['Fachlicher Inhalt', 'Gliederung', 'Sprechweise', 'Foliengestaltung'], ['Fachlich richtig', 'Begründung', 'Fachbegriffe', 'Verständlichkeit']];
  G.gew = R => {
    const c = C(), names = c.pick(R, RASTER), w = c.pick(R, [[40, 25, 20, 15], [40, 30, 20, 10], [30, 30, 25, 15], [50, 20, 20, 10], [35, 25, 25, 15]]), max = c.pick(R, [5, 10]);
    const pts = w.map(() => c.ri(R, Math.ceil(max / 2), max)), items = w.map((x, i) => ({ pts: pts[i], max, w: x })), v = c.weighted(items);
    return numQ('Ein Vortrag wird nach einem Raster mit vier Kriterien bewertet. Gewichte und Punkte stehen in der Tabelle. Wie viel Prozent der möglichen Punkte hat der Vortrag insgesamt erreicht?', v, '%', 'Punktwert', 0.01,
      'Je Kriterium: Gewicht · Punkte / höchste Punktzahl: ' + items.map(i => f(i.w, 0) + ' · ' + f(i.pts, 0) + ' / ' + f(max, 0) + ' = ' + f(i.w * i.pts / max, 1)).join(', ') + '. Summe: ' + f(v, 1) + ' (die Gewichte ergeben 100 %). Ergebnis: ' + f(v, 1) + ' %.',
      ['Rechne für jedes Kriterium Punkte durch höchste Punktzahl und multipliziere mit dem Gewicht.', 'Die Gewichte ergeben zusammen 100 Prozent, du kannst die Teilergebnisse einfach addieren.'],
      ['Je Kriterium die erreichten Punkte durch die höchste Punktzahl teilen.', 'Das Ergebnis mit dem Gewicht in Prozent malnehmen.', 'Alle vier Teilergebnisse addieren.'],
      { table: { head: ['Kriterium', 'Gewicht', 'Höchste Punktzahl', 'Erreicht'], rows: items.map((i, k) => [names[k], f(i.w, 0) + ' %', f(max, 0), f(i.pts, 0)]) } });
  };
  G.prz = R => {
    const c = C(); let max, pts;
    for (let i = 0; i < 100; i++) { max = c.pick(R, [20, 25, 40, 50]); pts = c.ri(R, Math.ceil(max * 0.5), Math.floor(max * 0.95)); if (pts < max) break; }
    const p = c.pctOf(pts, max);
    return numQ('Du erreichst in einer Übungsbewertung ' + f(pts, 0) + ' von ' + f(max, 0) + ' möglichen Punkten. Wie viel Prozent sind das?', p, '%', 'Prozent', 0.01,
      f(pts, 0) + ' / ' + f(max, 0) + ' · 100 = ' + f(p, 1) + ' %.',
      ['Teile die erreichten Punkte durch die möglichen Punkte.', 'Mit 100 malnehmen ergibt Prozent.'],
      ['Erreichte Punkte durch mögliche Punkte teilen.', 'Das Ergebnis mit 100 malnehmen.']);
  };
  G.selbst = R => {
    const c = C(), s = c.pick(R, [70, 75, 80, 85, 90, 95]), d = c.pick(R, [5, 10, 15, 20, 25]), r = s - d, gp = c.gap(s, r);
    return numQ('Vor der Rückmeldung schätzt du deinen Vortrag auf ' + f(s, 0) + ' % ein. Im Raster der Bewertung erreichst du ' + f(r, 0) + ' %. Um wie viele Prozentpunkte liegt deine Selbsteinschätzung über der Bewertung?', gp, 'Prozentpunkte', 'Unterschied', 0.01,
      f(s, 0) + ' % − ' + f(r, 0) + ' % = ' + f(d, 0) + ' Prozentpunkte. Ein großer Unterschied ist ein guter Gesprächsanlass: Welche Kriterien siehst du anders als der Bewerter?',
      ['Subtrahiere die Bewertung von der Selbsteinschätzung.', 'Der Unterschied zwischen zwei Prozentwerten heißt Prozentpunkte.'],
      ['Die Selbsteinschätzung nehmen.', 'Die Bewertung davon abziehen.', 'Das Ergebnis in Prozentpunkten angeben.']);
  };
  G.krit = pv(['Ein Kriterium muss man beobachten und prüfen können.', 'Wörter wie "gut" oder "nett" sagen nichts über die Leistung.'],
    ['Prüfe jede Aussage: Kann man sie beobachten oder nachzählen?', 'Streiche Eindrücke und Gefühle.', 'Wähle das Kriterium, das sich eindeutig prüfen lässt.'], [
      ['Welches Kriterium für ein Bewertungsraster ist gut formuliert?', 'Die Funktion der Schaltung wird erklärt und die Auswahl der Bauteile begründet.', ['Der Vortrag war gut.', 'Der Azubi hat sich Mühe gegeben.', 'Der Gesamteindruck war sympathisch.'], 'Beobachtbare, prüfbare Kriterien machen die Bewertung nachvollziehbar.'],
      ['Warum ist ein Raster mit mehreren Kriterien fairer als ein einziger Gesamteindruck?', 'Jedes Kriterium wird einzeln beurteilt, so sieht man Stärken und Schwächen, und die Bewertung ist nachvollziehbar.', ['Weil die Zahl am Ende immer höher wird.', 'Weil dann keine Rückmeldung nötig ist.', 'Weil der Bewerter nicht mehr zuhören muss.'], 'Ein Raster macht sichtbar, wo jemand stark ist und wo er noch üben kann.']
    ]);
  G.rueck = pv(['Beschreibe, was du beobachtet hast, und mache einen Vorschlag.', 'Sprich über die Sache, nicht über die Person.'],
    ['Nenne zuerst, was gut war.', 'Beschreibe das Beobachtete konkret.', 'Mache einen Vorschlag, was besser gehen könnte.'], [
      ['Welche Rückmeldung ist sachlich und hilfreich?', 'Deine Folien hatten viel Text, und die Schaltung war schwer zu lesen. Eine große Zeichnung mit drei Stichpunkten würde helfen.', ['Die Folien waren schlecht.', 'Du kannst das einfach nicht.', 'Andere haben das viel besser gemacht.'], 'Sachliche Rückmeldung nennt Beobachtung und Vorschlag und bleibt bei der Sache.'],
      ['Du gibst einem Mitazubi nach dem Übungsvortrag Rückmeldung. Womit beginnst du?', 'Mit dem, was gut gelungen ist, danach folgen konkrete Verbesserungsvorschläge.', ['Mit allen Fehlern, damit er sie sofort kennt.', 'Mit einem Vergleich zu deinem eigenen, besseren Vortrag.', 'Mit einer Note, ohne zu erklären.'], 'Wer mit Gelungenem beginnt, wird eher gehört. Vorschläge helfen mehr als Urteile.']
    ]);
  G.annehm = pv(['Zuhören, nachfragen, bedanken, dann entscheiden.', 'Rückmeldung ist ein Angebot, kein Angriff.'],
    ['Höre ruhig zu und lass den anderen ausreden.', 'Frage bei Unklarem nach einem Beispiel.', 'Bedanke dich und überlege, was du ändern willst.'], [
      ['Du bekommst eine kritische Rückmeldung zu deinem Vortrag. Was ist eine gute Reaktion?', 'Zuhören, ausreden lassen, bei Bedarf nachfragen und sich bedanken, dann überlegen, was du ändern willst.', ['Sofort widersprechen und erklären, warum alle falsch liegen.', 'Nichts sagen und die Rückmeldung vergessen.', 'Zurückgeben und die Fehler des anderen aufzählen.'], 'Kritik annehmen heißt zuhören und nachfragen. Entscheiden kannst du danach.'],
      ['Du verstehst einen Kritikpunkt nicht. Was tust du?', 'Du bittest um ein Beispiel aus deinem Vortrag, damit du verstehst, was gemeint ist.', ['Du nickst und machst weiter wie bisher.', 'Du sagst, die Kritik sei unfair.', 'Du fragst, wer sonst noch so denkt.'], 'Ein Beispiel macht die Kritik konkret und zeigt dir, was du ändern kannst.']
    ]);
  G.ges = R => {
    const c = C(), wA = c.pick(R, [60, 70]), a = 5 * c.ri(R, 12, 19), b = 5 * c.ri(R, 12, 19), v = c.weighted([{ pts: a, max: 100, w: wA }, { pts: b, max: 100, w: 100 - wA }]);
    return numQ('Dein Gesamtergebnis in einer Übung besteht aus zwei Teilen. Teil A zählt mit ' + f(wA, 0) + ' %, Teil B mit ' + f(100 - wA, 0) + ' %. In Teil A erreichst du ' + f(a, 0) + ' %, in Teil B ' + f(b, 0) + ' %. Wie hoch ist dein Gesamtergebnis in Prozent?', v, '%', 'Gesamtergebnis', 0.01,
      'Teil A: ' + f(a, 0) + ' · ' + f(wA, 0) + ' / 100 = ' + f(a * wA / 100, 1) + '. Teil B: ' + f(b, 0) + ' · ' + f(100 - wA, 0) + ' / 100 = ' + f(b * (100 - wA) / 100, 1) + '. Summe: ' + f(v, 1) + ' %.',
      ['Rechne nicht einfach den Mittelwert: Die Gewichte sind verschieden.', 'Multipliziere jeden Teil mit seinem Gewicht und addiere.'],
      ['Teil A mit seinem Gewicht malnehmen und durch 100 teilen.', 'Teil B genauso rechnen.', 'Beide Ergebnisse addieren.']);
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    [0, 1, 'Wozu Unterweisungen', 'unt1'], [0, 1, 'Welche Unterweisung wann', 'unt2'], [0, 1, 'Unterschrift auf der Liste', 'unt3'], [0, 1, 'Betriebsanweisung lesen', 'ba1'], [0, 2, 'Störung an der Maschine', 'ba2'],
    [0, 1, 'ESD-Grundregeln', 'esd1'], [0, 2, 'ESD-Nachweis und Transport', 'esd2'], [0, 1, 'Berichtsheft führen', 'bh'], [0, 2, 'Beurteilung nach dem Einsatz', 'beur'],
    [1, 1, 'Auftrag lesen', 'auftr'], [1, 2, 'Reihenfolge der Arbeitsschritte', 'reihe'], [1, 2, 'Zeitplan mit Puffer', 'zeit'], [1, 2, 'Wann bist du fertig', 'ende'], [1, 2, 'Wie viel Puffer', 'pufp'],
    [1, 2, 'Material und Prüfmittel', 'mat'], [1, 2, 'Prüfprotokoll', 'prot'], [1, 2, 'Übergabe', 'ueber'], [1, 3, 'Aufträge je Schicht', 'kap'], [1, 3, 'Zeit in der Woche', 'rest'],
    [2, 1, 'Einstieg, Hauptteil, Schluss', 'glied'], [2, 2, 'Zeit für den Hauptteil', 'haupt'], [2, 2, 'Folien und Zeit', 'folien'], [2, 2, 'Vortragszeit und Fragen', 'vzeit'], [2, 1, 'Folie gestalten', 'folie'], [2, 2, 'Lesbarkeit', 'lesen'], [2, 2, 'Thema zur Gliederung', 'thema'], [2, 2, 'Probelauf mit Stoppuhr', 'probe'],
    [3, 1, 'Phasen des Gesprächs', 'phasen'], [3, 1, 'Frage und Phase', 'pzuo'], [3, 2, 'Gute Antwort erkennen', 'gute'], [3, 2, 'Begründen statt aufzählen', 'beg'], [3, 2, 'Fachbegriffe richtig', 'begr'], [3, 3, 'Abweichung erklären', 'abw'], [3, 2, 'Wenn du etwas nicht weißt', 'wnicht'], [3, 1, 'Rückfrage und Denkpause', 'rueckf'], [3, 3, 'Zeit im Übungsgespräch', 'zphase'],
    [4, 3, 'Gewichteter Punktwert', 'gew'], [4, 1, 'Punkte in Prozent', 'prz'], [4, 2, 'Selbsteinschätzung und Bewertung', 'selbst'], [4, 2, 'Kriterien im Raster', 'krit'], [4, 1, 'Sachliche Rückmeldung', 'rueck'], [4, 2, 'Rückmeldung annehmen', 'annehm'], [4, 3, 'Gesamtergebnis aus zwei Teilen', 'ges']
  ];
  const tasks = defs.map((d, i) => ({ id: 'fgs' + (i + 1), cat: CATS[d[0]], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('fgs-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.FGS_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, phasen: PHASEN, krit: KRIT, fragen: FRAGEN };
  root.FGS_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.FGS_DATA, TASKS: root.FGS_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
