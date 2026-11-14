'use strict';
/* Tonfunk Projekt-und-Wirtschaftlichkeits-Lab (Kürzel prj, Metadatenfeld stufe: 'studium'): Texte, Voreinstellungen und Aufgaben.
   Alle Texte sind eigene, neutrale Formulierungen. Zahlenwerte in Aufgaben sind frei gewählte Übungswerte, keine Branchenwerte.
   PRJ_DATA.tasks: Aufgaben je Block; jede hat make(R, C) mit seed-fähigem Zufall R und PRJ_CORE C und liefert
     { text, kind:'num'|'pick', fig?, tips[3], expl[] (Musterlösung mit Rechenweg), p (Parameter für den Gegentest),
       num:  asks:[{key,label,unit,value,tol}]            -> Zahlen eingeben
       pick: opts:[...], items:[{t,a,why}]                 -> je Zeile eine Option wählen (a = Index der richtigen Option) }
   Alle Zahlen kommen aus PRJ_CORE; quelle/prj/test_prjdata.js rechnet sie unabhängig nach. */
(function (root) {
  const C = root.PRJ_CORE || (typeof require === 'function' ? require('./prjcore.js') : null);
  const META = { id: 'prj', name: 'Projekt-und-Wirtschaftlichkeits-Lab', stufe: 'studium', ls: 'lm4.prj.' };
  const BLOCKS = [
    { id: 'lh', icon: '📋', name: 'Lastenheft und Pflichtenheft', short: 'Lastenheft' },
    { id: 'np', icon: '🗓', name: 'Projektplanung mit Netzplan', short: 'Planung' },
    { id: 'ko', icon: '💶', name: 'Aufwand und Kosten', short: 'Kosten' },
    { id: 'iv', icon: '📈', name: 'Wirtschaftlichkeit', short: 'Wirtschaft' },
    { id: 'rq', icon: '⚠️', name: 'Risiko und Qualität', short: 'Risiko' },
    { id: 'pb', icon: '📄', name: 'Praxisbericht', short: 'Bericht' }
  ];

  /* ================================================================ Erklärtexte (je Block: Abschnitte mit Überschrift und HTML-Text) */
  const EXPLAIN = {
    lh: [
      { h: 'Wer sagt was?', p: '<p>Das <b>Lastenheft</b> schreibt der Auftraggeber: Es sagt, <b>was</b> gebraucht wird und <b>wofür</b>. Das <b>Pflichtenheft</b> schreibt der Auftragnehmer: Er sagt, <b>wie</b> und <b>womit</b> er die Wünsche umsetzt. Beide Dokumente werden gegeneinander geprüft, bevor gebaut wird.</p><p>Faustregel: Steht im Satz eine Lösung (Bauteil, Verfahren, Programmiersprache), gehört er eher ins Pflichtenheft. Steht darin ein Ziel oder eine Grenze, gehört er ins Lastenheft.</p>' },
      { h: 'Eine gute Anforderung', p: '<p>Eine Anforderung ist brauchbar, wenn man am Ende <b>ja oder nein</b> sagen kann. Vier Fragen helfen: Ist sie <b>eindeutig</b> (nur eine Lesart)? <b>Messbar</b> (Zahl, Einheit, Bezug)? <b>Verbindlich</b> (muss, soll oder kann)? <b>Einzeln</b> (nur eine Forderung je Satz)?</p><p>Schlecht: „Das Gerät soll schnell starten.“ Besser: „Das Gerät muss nach dem Einschalten in höchstens 3 s den ersten Messwert anzeigen.“</p>' },
      { h: 'Muss, Soll, Kann', p: '<p>Mit diesen drei Wörtern legst du die Stärke fest. <b>Muss</b>: ohne diese Eigenschaft gibt es keine Abnahme. <b>Soll</b>: wichtig, aber über Ausnahmen kann man reden. <b>Kann</b>: nice to have, wenn Zeit und Budget bleiben. Jede Anforderung bekommt eine eindeutige Kennung, damit man sie später im Pflichtenheft und im Test wiederfindet.</p>' },
      { h: 'Verfügbarkeit in Zeit übersetzen', p: '<p>„Hohe Verfügbarkeit“ ist keine Anforderung, „99,9 % je Kalenderjahr“ schon. Zur Einordnung rechnest du in Ausfallzeit um: <b>Ausfallzeit = (1 − V) · 8760 h</b>. Bei 99,9 % sind das 8,76 Stunden im Jahr.</p>' }
    ],
    np: [
      { h: 'Vorgänge und Abhängigkeiten', p: '<p>Ein Projekt wird in <b>Vorgänge</b> zerlegt. Jeder hat eine Dauer und kennt seine <b>Vorgänger</b>. Hier gilt die einfachste Beziehung: Ein Vorgang beginnt, wenn alle Vorgänger zu Ende sind (Ende-Anfang). Dauer 0 ergibt einen <b>Meilenstein</b>: einen Termin ohne Arbeit, zum Beispiel „Design-Freigabe“.</p>' },
      { h: 'Vorwärts- und Rückwärtsrechnung', p: '<p><b>Vorwärts</b> (früheste Zeiten): <b>FAZ</b> = größtes FEZ aller Vorgänger, <b>FEZ = FAZ + Dauer</b>. Das größte FEZ ist die Projektdauer.</p><p><b>Rückwärts</b> (späteste Zeiten): <b>SEZ</b> = kleinstes SAZ aller Nachfolger (ohne Nachfolger: Projektende), <b>SAZ = SEZ − Dauer</b>.</p><p>Zeiten sind hier Zeitpunkte: Das Projekt startet bei 0, ein Vorgang von 0 bis 3 dauert 3 Tage.</p>' },
      { h: 'Puffer und kritischer Pfad', p: '<p><b>Gesamtpuffer GP = SAZ − FAZ</b>: So viel darf der Vorgang sich verschieben oder länger dauern, ohne das Projektende zu verschieben. <b>Freier Puffer FP</b> = frühester Anfang der Nachfolger − eigenes FEZ: So viel Spielraum gibt es, ohne dass ein Nachfolger später beginnt.</p><p>Vorgänge mit GP = 0 sind <b>kritisch</b>. Ihre lückenlose Kette ist der <b>kritische Pfad</b>: der längste Weg durch das Netz. Jede Verzögerung dort verschiebt das Projektende, es kann auch mehrere kritische Pfade geben.</p>' },
      { h: 'Gantt-Diagramm', p: '<p>Das Gantt-Diagramm zeigt dieselben Zahlen als Balken auf einer Zeitachse. Der helle Streifen hinter dem Balken ist der Gesamtpuffer. Der Netzplan zeigt die Abhängigkeiten besser, das Gantt-Diagramm die Auslastung und die Termine.</p>' }
    ],
    ko: [
      { h: 'Stundensatz', p: '<p>Ein Mitarbeiter kostet mehr als sein Gehalt: Zum Jahresbrutto kommen <b>Lohnnebenkosten</b>. Bezahlt wird er für die Sollstunden, verrechnen kannst du aber nur die <b>produktiven</b> Stunden (ohne Urlaub, Krankheit, Besprechungen). Dann kommen <b>Gemeinkosten</b> (Raum, Strom, Verwaltung) und <b>Gewinn</b> als Zuschläge dazu.</p>' },
      { h: 'Angebotskalkulation', p: '<p>Personal (Stunden mal Satz), Material und Fremdleistungen bilden die Einzelkosten. Dazu kommen Zuschläge für Materialgemeinkosten und ein <b>Wagnis</b>. Das ergibt die <b>Selbstkosten</b>. Plus Gewinn ergibt den Barverkaufspreis. Viele Betriebe und Lehrbücher fassen Wagnis und Gewinn zu einem Zuschlag auf die Selbstkosten zusammen. Hier wird das Wagnis als Kostenbestandteil vor dem Gewinn gerechnet. Der Kundenskonto wird „im Hundert“ gerechnet: Bezugsgröße ist der höhere Preis, also wird durch (1 − Skonto) geteilt.</p>' },
      { h: 'Deckungsbeitrag und Break-even', p: '<p><b>Deckungsbeitrag je Stück = Preis − variable Kosten</b>. Er deckt erst die Fixkosten, danach bleibt Gewinn. <b>Break-even-Menge = Fixkosten : DB je Stück</b>. Ab dieser Menge arbeitet das Produkt im Plus. Der <b>Sicherheitsabstand</b> sagt, um wie viel Prozent die Menge einbrechen dürfte, bis die Schwelle erreicht ist.</p>' },
      { h: 'Aufwand schätzen (Dreipunkt)', p: '<p>Statt einer einzigen Zahl schätzt man <b>optimistisch a</b>, <b>wahrscheinlich m</b> und <b>pessimistisch b</b>. Erwartungswert <b>E = (a + 4m + b) : 6</b>, Streuung <b>σ = (b − a) : 6</b>. Bei mehreren Paketen addierst du die Erwartungswerte, bei der Streuung addierst du die <b>Quadrate</b> (Varianzen) und ziehst danach die Wurzel. So fällt die Gesamtstreuung kleiner aus als die Summe der Einzelstreuungen.</p>' }
    ],
    iv: [
      { h: 'Kapitalwert', p: '<p>Geld, das später fließt, ist weniger wert als Geld heute. Der <b>Kapitalwert</b> rechnet alle Zahlungen mit dem Kalkulationszins auf heute um: <b>K = Σ Zₜ : (1 + i)ᵗ</b>, die Anschaffung steht bei t = 0 mit Minus. <b>K &gt; 0</b>: Die Investition verdient mehr als die geforderte Verzinsung, sie ist vorteilhaft.</p>' },
      { h: 'Interner Zinsfuß', p: '<p>Der <b>interne Zinsfuß</b> ist der Zins, bei dem der Kapitalwert genau 0 wird. Er ist die Rendite des Projekts. Du vergleichst ihn mit dem geforderten Zins. Von Hand bekommt man ihn durch zwei Probezinssätze und <b>lineare Interpolation</b>; das Lab rechnet es genau. Wechselt die Zahlungsreihe mehrfach das Vorzeichen, kann es mehrere Nullstellen geben.</p>' },
      { h: 'Amortisation und Annuität', p: '<p>Die <b>Amortisationsdauer</b> fragt: Wann ist das Geld zurück? Statisch ohne Zinsen, dynamisch mit abgezinsten Zahlungen (immer etwas länger). Sie sagt nichts über Gewinn nach der Rückzahlung. Die <b>Annuität</b> verteilt einen Betrag auf n gleiche Jahresraten: <b>a = K · i(1+i)ⁿ : ((1+i)ⁿ − 1)</b>. Damit vergleicht man auch Investitionen mit verschiedener Laufzeit.</p>' },
      { h: 'Vergleich und Sensitivität', p: '<p>Zwei Investitionen mit gleicher Laufzeit vergleichst du über den Kapitalwert: Der höhere gewinnt. Bei verschiedener Laufzeit kommt es auf die Annahme an: Wird die Anlage nur einmal angeschafft, entscheidet weiter der Kapitalwert. Soll sie nach Ablauf immer wieder ersetzt werden, vergleichst du die jährliche Annuität des Kapitalwerts. Die <b>Sensitivität</b> zeigt, wie stark das Ergebnis auf Änderungen von Zins, Überschuss oder Laufzeit reagiert, und der <b>kritische Wert</b> ist die Grenze, an der K = 0 wird.</p>' }
    ],
    rq: [
      { h: 'Risikomatrix', p: '<p>Ein Risiko hat eine <b>Eintrittswahrscheinlichkeit P</b> und ein <b>Schadensausmaß S</b>, beide hier auf 1 bis 5 eingestuft. Die Risikozahl ist <b>P · S</b>. Die Klassengrenzen (hier gering bis 4, mittel bis 9, hoch bis 15, kritisch ab 16) sind ein Beispiel; jeder Betrieb legt eigene fest.</p><p>Mit Prozent und Euro rechnest du den <b>Erwartungswert = P · Schaden</b>. Die Summe aller Erwartungswerte ist ein Maß für die Reserve.</p>' },
      { h: 'FMEA und Risikoprioritätszahl', p: '<p>Die <b>FMEA</b> fragt für jede mögliche Fehlerart: Wie schlimm (<b>B</b>edeutung), wie wahrscheinlich (<b>A</b>uftreten), wie schwer zu entdecken (<b>E</b>ntdeckung)? Jeweils 1 bis 10. <b>RPZ = B · A · E</b>. Hohe RPZ zuerst bearbeiten. Nach einer Maßnahme (z. B. besserer Test) wird neu bewertet.</p><p>Beachte: Die RPZ hat Schwächen (sehr verschiedene Kombinationen ergeben dieselbe Zahl). Neuere Leitfäden arbeiten deshalb mit Aktionsprioritäten; hohe Bedeutung (B ≥ 9) wird unabhängig von der RPZ geprüft.</p>' },
      { h: 'Pareto', p: '<p>Oft verursachen wenige Ursachen den größten Teil der Probleme. Sortiere nach Häufigkeit oder Kosten, berechne den kumulierten Anteil: Die Ursachen, die zusammen etwa 80 % ausmachen, sind <b>Klasse A</b>, bis etwa 95 % <b>Klasse B</b>, der Rest <b>Klasse C</b>. Hier zählt ein Element zu A, solange der Anteil vor ihm unter 80 % liegt. Andere Quellen zählen die Ursache, die die 80 % überschreitet, schon zu B.</p>' }
    ],
    pb: [
      { h: 'Gliederung', p: '<p>Ein Praxisbericht erzählt ein Projekt von der Ausgangslage bis zum Ergebnis. Üblich: <b>Einleitung</b> (Anlass, Ziel, Aufbau) · <b>Grundlagen und Ausgangslage</b> · <b>Planung</b> · <b>Durchführung</b> · <b>Ergebnisse und Bewertung</b> · <b>Fazit und Ausblick</b> · dazu Verzeichnisse und <b>Anhang</b>. Rohdaten, große Pläne und Datenblätter gehören in den Anhang, die Auswertung im Haupttext.</p>' },
      { h: 'Abbildungen und Tabellen', p: '<p>Jede Abbildung und Tabelle hat eine <b>fortlaufende Nummer</b>, eine <b>Beschriftung</b>, die ohne den Fließtext verständlich ist, und wird im Text <b>erwähnt und erklärt</b>. Fremde Bilder brauchen eine Quellenangabe, eigene werden als „eigene Darstellung“ gekennzeichnet. Lage der Beschriftung und Verzeichnisse regelt meist eine Vorgabe der Schule oder Hochschule: Die geht vor.</p>' },
      { h: 'Quellen und Zitate', p: '<p>Wörtliche Übernahme steht in Anführungszeichen mit Seitenzahl. Sinngemäße Übernahme steht in eigenen Worten mit „vgl.“. Beides braucht einen Kurzbeleg im Text und einen Eintrag im Quellenverzeichnis. Was du selbst gemessen oder entworfen hast, brauchst du nicht zu belegen, wohl aber zu beschreiben (Messbedingungen!). Das Zitierformat (Fußnote oder Kurzbeleg) wird vorgegeben.</p>' },
      { h: 'Seitenbudget', p: '<p>Lege vorher fest, wie viele Seiten welches Kapitel bekommt. Das Verfahren des größten Rests rundet Anteile so auf ganze Seiten, dass die Summe stimmt. Die Seitenzahl zeigt Gewicht: Der Hauptteil (Durchführung, Ergebnisse) ist deutlich länger als die Einleitung.</p>' }
    ]
  };

  /* ================================================================ Gliederungen, Listen, Voreinstellungen */
  const LH_GLIED = [
    { n: 'Ausgangssituation (Ist-Zustand)', doc: 'LH', t: 'Was gibt es heute, wo hakt es?' },
    { n: 'Zielbestimmung', doc: 'LH', t: 'Was soll am Ende erreicht sein, was ausdrücklich nicht?' },
    { n: 'Produkteinsatz', doc: 'LH', t: 'Wer nutzt es, wo, wie oft, unter welchen Bedingungen?' },
    { n: 'Rahmenbedingungen des Auftraggebers', doc: 'LH', t: 'Termin, Budgetrahmen, vorgegebene Normen und Vorschriften.' },
    { n: 'Funktionale Anforderungen', doc: 'beide', t: 'Lastenheft: Was soll das System tun? Pflichtenheft: genau, mit Kennung und Abnahmetest.' },
    { n: 'Nichtfunktionale Anforderungen', doc: 'beide', t: 'Leistung, Verfügbarkeit, Sicherheit, Bedienbarkeit, als Zahl.' },
    { n: 'Abnahmekriterien', doc: 'beide', t: 'Lastenheft: gewünschte Kriterien. Pflichtenheft: konkrete Testfälle.' },
    { n: 'Systemarchitektur', doc: 'PH', t: 'Aus welchen Bausteinen besteht die Lösung?' },
    { n: 'Realisierungskonzept', doc: 'PH', t: 'Verfahren, Bauteile, Werkzeuge, mit denen es umgesetzt wird.' },
    { n: 'Datenmodell und Schnittstellen', doc: 'PH', t: 'Technische Schnittstellen und Datenformate im Detail.' },
    { n: 'Testplan mit Testfällen', doc: 'PH', t: 'Wie wird jede Anforderung nachgewiesen?' },
    { n: 'Zeit- und Kostenplan des Auftragnehmers', doc: 'PH', t: 'Meilensteine, Aufwand, Angebotspreis.' }
  ];
  const LH_PH_STATEMENTS = {
    LH: ['Das Gerät soll die Raumtemperatur von 0 bis 40 °C erfassen.', 'Die Anzeige muss auch bei direkter Sonneneinstrahlung ablesbar sein.', 'Die Anlage muss ohne Umbau in der bestehenden Werkhalle aufgestellt werden können.', 'Die Wartung muss von einer Elektrofachkraft in höchstens 30 Minuten möglich sein.', 'Der Kunde möchte die Messwerte täglich als Tabelle auswerten können.', 'Die Lösung muss bis zum 30. Juni abnahmebereit sein.'],
    PH: ['Die Temperatur wird mit einem NTC-Sensor erfasst und über einen 12-Bit-Wandler eingelesen.', 'Die Messwerte werden in einer SQLite-Datenbank auf der SD-Karte gespeichert.', 'Die Software wird in drei Schichten gegliedert: Treiber, Logik, Oberfläche.', 'Die Kommunikation erfolgt über Modbus RTU mit 19200 Baud, 8E1.', 'Das Gehäuse wird aus 2 mm Aluminiumblech gefertigt und verschraubt.', 'Die Prüfroutine läuft als Zustandsautomat mit den Zuständen Init, Messen und Fehler.']
  };
  /* Prüffragen messbar/eindeutig: ok = true heißt gut formuliert; noAn = Faustregel-Prüfer erkennt es nicht (braucht Fachverstand) */
  const LH_CHECK = {
    ok: [
      { t: 'Das Gerät muss nach dem Einschalten innerhalb von 3 s den ersten Messwert anzeigen.', why: 'Grenzwert (3 s), Startpunkt (Einschalten) und Ereignis (erster Messwert) sind benannt.' },
      { t: 'Das Netzteil muss bei 230 V Eingangsspannung eine Ausgangsspannung von 12 V ± 2 % liefern.', why: 'Bedingung, Sollwert und Toleranz stehen drin: Man kann messen.' },
      { t: 'Die Messunsicherheit der Temperaturmessung muss im Bereich von 0 bis 40 °C kleiner als ± 0,5 K sein.', why: 'Größe, Bereich und Grenzwert sind angegeben.' },
      { t: 'Das System muss eine Verfügbarkeit von mindestens 99,5 % je Kalenderjahr erreichen.', why: 'Kennzahl, Grenzwert und Bezugszeitraum sind benannt.' },
      { t: 'Die Ladezeit des Akkus von 0 auf 80 % muss unter 90 Minuten liegen.', why: 'Start- und Endwert und Grenze sind eindeutig.' },
      { t: 'Das Gehäuse muss die Schutzart IP54 erfüllen.', why: 'Verweist auf eine genormte, prüfbare Kennzahl.' },
      { t: 'Ein Testnutzer ohne Vorkenntnisse muss die Aufgabe „Messwert exportieren“ in höchstens 5 Schritten abschließen.', why: 'Aus „einfach bedienbar“ wurde ein Test mit Zahl.' },
      { t: 'Alle Fehlermeldungen müssen im Display mit einem Fehlercode von E01 bis E99 angezeigt werden.', why: 'Prüfbar: Man kann jede Meldung durchgehen und abhaken.' },
      { t: 'Das Gerät muss 100 Messwerte je Sekunde liefern.', why: 'Zahl mit Einheit, eindeutig prüfbar.' }
    ],
    bad: [
      { t: 'Das Gerät muss schnell starten.', why: '„schnell“ ist Ansichtssache. Es fehlt die Zahl (zum Beispiel höchstens 3 s) und der Bezug (ab Einschalten?).' },
      { t: 'Die Bedienung soll benutzerfreundlich sein.', why: '„benutzerfreundlich“ lässt sich nicht messen. Besser: ein Test mit Aufgabe, Schrittzahl oder Zeit.' },
      { t: 'Das Netzteil muss ausreichend Leistung liefern.', why: '„ausreichend“ für wen? Es fehlt die Leistung in Watt oder der Strom in Ampere.' },
      { t: 'Das System soll möglichst robust sein.', why: '„möglichst“ und „robust“ sind beide offen. Robust wogegen: Stoß, Staub, Feuchte? Mit Prüfverfahren und Grenzwert.' },
      { t: 'Die Anzeige zeigt die Temperatur an.', why: 'Es fehlt die Verbindlichkeit (muss/soll/kann) und jede Zahl: Wie genau, wie oft, in welchem Bereich?' },
      { t: 'Das Gerät muss eine hohe Genauigkeit haben.', why: '„hohe“ Genauigkeit ist keine Zahl. Gib die Messunsicherheit mit Einheit an.' },
      { t: 'Die Akkulaufzeit soll möglichst lang sein.', why: '„möglichst lang“ ist nie erfüllt oder immer. Nenne eine Mindestlaufzeit in Stunden.' },
      { t: 'Die Software muss gegebenenfalls auch mit anderen Systemen zusammenarbeiten.', why: '„gegebenenfalls“ macht die Pflicht beliebig, „andere Systeme“ nennt keines. Welche Schnittstelle, unter welcher Bedingung?' },
      { t: 'Die Wartung muss einfach und schnell möglich sein.', why: 'Zwei unscharfe Wörter in einem Satz. Beispiel: „Der Filterwechsel muss in höchstens 10 Minuten ohne Werkzeug möglich sein.“' }
    ],
    badSubtle: [
      { t: 'Die Genauigkeit muss ± 1 % betragen.', noAn: true, why: 'Eine Zahl ist da, aber der Bezug fehlt: ± 1 % vom Messwert oder vom Endwert? Das gibt bei kleinen Werten einen großen Unterschied.' },
      { t: 'Die Software muss zu 100 % fehlerfrei sein.', noAn: true, why: 'Die Zahl täuscht: Fehlerfreiheit lässt sich nicht nachweisen. Besser: „Alle 120 Testfälle der Testspezifikation müssen bestanden werden.“' },
      { t: 'Das System muss 50 Benutzer unterstützen.', noAn: true, why: 'Gleichzeitig oder insgesamt? Mit welcher Antwortzeit? Ohne Bedingung sind zwei Lesarten möglich.' }
    ]
  };
  const LH_IMPROVE = [
    { bad: 'Das Gerät muss schnell starten.', opts: ['Das Gerät muss nach dem Einschalten in höchstens 3 s betriebsbereit sein.', 'Das Gerät muss möglichst schnell starten.', 'Das Gerät soll deutlich schneller als der Vorgänger starten.', 'Das Gerät muss zügig und zuverlässig starten.'], a: 0, why: 'Nur die erste Fassung nennt Startpunkt, Ereignis und Grenzwert. „möglichst schnell“, „deutlich schneller“ und „zügig“ bleiben unmessbar.' },
    { bad: 'Die Bedienung soll einfach sein.', opts: ['Die Bedienung soll sehr intuitiv und modern sein.', 'Die Bedienung muss ohne Anleitung möglich sein.', 'Ein Nutzer ohne Vorkenntnisse muss die Funktion „Kalibrieren“ in höchstens 4 Bedienschritten starten können.', 'Die Bedienung muss benutzerfreundlich gestaltet sein.'], a: 2, why: 'Aus „einfach“ wird ein Test mit Personenkreis, Aufgabe und Schrittzahl. Die anderen drei sind nur andere Wörter für „gut“.' },
    { bad: 'Der Akku soll lange halten.', opts: ['Der Akku muss ausreichend lange halten.', 'Der Akku muss bei Dauerbetrieb mit Display mindestens 8 h ohne Nachladen durchhalten.', 'Der Akku soll möglichst viele Stunden schaffen.', 'Der Akku soll länger halten als bisher.'], a: 1, why: 'Nur eine Fassung nennt Betriebszustand und Mindestzeit. „länger als bisher“ braucht einen Vergleichswert und ist trotzdem offen.' },
    { bad: 'Die Messung soll genau sein.', opts: ['Die Messung muss mit hoher Genauigkeit erfolgen.', 'Die Messung soll sehr gute Ergebnisse liefern.', 'Der Messfehler muss im Bereich 0 bis 100 °C höchstens ± 0,5 K betragen.', 'Die Messung muss zuverlässig sein.'], a: 2, why: 'Größe (Messfehler), Bereich und Grenzwert mit Einheit machen die Forderung prüfbar.' }
  ];
  const LH_ABNAHME = [
    { opts: ['Die Reaktionszeit der Anlage muss gut sein.', 'Nach Betätigen des Not-Halt-Tasters müssen alle Antriebe innerhalb von 200 ms stillstehen (Messung am Prüfaufbau).', 'Die Anlage muss auch im Notfall zuverlässig stoppen.', 'Die Anlage soll schnell auf Eingriffe reagieren.'], a: 1, why: 'Prüfbar sind nur Zahl, Ereignis und Messverfahren: 200 ms nach Not-Halt.' },
    { opts: ['Das Display muss jederzeit gut lesbar sein.', 'Das Display muss bei 1000 lx Umgebungshelligkeit aus 1 m Abstand lesbar sein (Leseprobe mit 3 Prüfern).', 'Die Anzeige soll eine ansprechende Darstellung haben.', 'Das Display muss modern wirken.'], a: 1, why: 'Bedingung, Abstand und Testverfahren sind festgelegt. Die übrigen Sätze beschreiben Geschmack.' },
    { opts: ['Das Gerät muss 24 h im Dauerlauf ohne Ausfall arbeiten.', 'Das Gerät sollte stabil laufen.', 'Das Gerät muss robust gegen Störungen sein.', 'Das Gerät muss möglichst selten abstürzen.'], a: 0, why: '24 h Dauerlauf ohne Ausfall lässt sich beobachten und abhaken. Die anderen Fassungen lassen jede Bewertung zu.' }
  ];
  const LH_TRUE = [
    { t: 'Das Lastenheft beschreibt, was gebaut werden soll, das Pflichtenheft, wie es umgesetzt wird.', a: 0, why: 'Genau das ist die Arbeitsteilung: Ziele beim Auftraggeber, Lösung beim Auftragnehmer.' },
    { t: 'Das Pflichtenheft entsteht in der Regel vor dem Lastenheft.', a: 1, why: 'Umgekehrt: Das Pflichtenheft antwortet auf das Lastenheft.' },
    { t: 'Das Pflichtenheft nimmt die Anforderungen des Lastenhefts auf und konkretisiert sie.', a: 0, why: 'Jede Lastenheft-Anforderung sollte im Pflichtenheft wieder auftauchen und genauer beschrieben sein.' },
    { t: 'Anforderungen im Lastenheft dürfen nach der Freigabe ohne Rücksprache weggelassen werden.', a: 1, why: 'Änderungen brauchen eine Abstimmung (Änderungsverfahren), sonst entsteht Streit bei der Abnahme.' },
    { t: 'Jede Anforderung im Pflichtenheft sollte sich auf eine Anforderung im Lastenheft zurückführen lassen.', a: 0, why: 'Das nennt man Rückverfolgbarkeit: So erkennt man, ob etwas vergessen oder zusätzlich eingebaut wurde.' },
    { t: 'Mit dem Lastenheft legt der Auftragnehmer fest, welche Bauteile verwendet werden.', a: 1, why: 'Bauteile und Verfahren stehen im Pflichtenheft. Das Lastenheft sagt, was erreicht werden soll.' }
  ];
  const LH_MSK = [
    { t: 'Ohne diese Eigenschaft nimmt der Auftraggeber das Gerät nicht ab.', a: 0 }, { t: 'Die Eigenschaft ist wichtig. Fehlt sie, wird verhandelt und der Preis kann sinken, die Abnahme ist aber möglich.', a: 1 },
    { t: 'Wenn am Ende Zeit und Geld übrig sind, wäre die Funktion ein Gewinn. Sie ist nicht eingeplant.', a: 2 }, { t: 'Das Gesetz schreibt die Funktion für dieses Gerät vor.', a: 0 },
    { t: 'Die Funktion erleichtert die Wartung und wird erwartet. Über Ausnahmen lässt sich sprechen.', a: 1 }, { t: 'Eine zweite Sprachversion der Anzeige, falls das Budget es zulässt.', a: 2 }
  ];

  const NET_PRESETS = [
    { id: 'geraet', name: 'Messgerät-Prototyp', acts: [['A', 'Anforderungen', 3, []], ['B', 'Schaltplan', 4, ['A']], ['C', 'Leiterplatte', 5, ['B']], ['D', 'Firmware', 9, ['A']], ['E', 'Gehäuse', 6, ['A']], ['F', 'Aufbau', 3, ['C', 'E']], ['M', 'Meilenstein Aufbau fertig', 0, ['F', 'D']], ['G', 'Test', 4, ['M']]] },
    { id: 'release', name: 'Software-Release', acts: [['A', 'Planung', 2, []], ['B', 'Entwurf', 3, ['A']], ['C', 'Backend', 8, ['B']], ['D', 'Oberfläche', 6, ['B']], ['E', 'Integration', 3, ['C', 'D']], ['F', 'Test', 4, ['E']], ['G', 'Handbuch', 5, ['B']], ['H', 'Release', 1, ['F', 'G']]] },
    { id: 'umbau', name: 'Anlagen-Umbau', acts: [['A', 'Genehmigung', 4, []], ['B', 'Material bestellen', 7, ['A']], ['C', 'Rückbau', 3, ['A']], ['D', 'Fundament', 5, ['C']], ['E', 'Montage', 4, ['B', 'D']], ['F', 'Verkabelung', 3, ['E']], ['G', 'Steuerung programmieren', 6, ['B']], ['H', 'Inbetriebnahme', 2, ['F', 'G']], ['I', 'Abnahme', 1, ['H']]] }
  ];
  /* Strukturen für Aufgaben: [Kennung, Name, Dauer von, Dauer bis, Vorgänger] */
  const NETS = [
    { name: 'Messgerät-Prototyp', acts: [['A', 'Anforderungen', 2, 5, []], ['B', 'Schaltplan', 2, 6, ['A']], ['C', 'Leiterplatte', 3, 8, ['B']], ['D', 'Firmware', 4, 12, ['A']], ['E', 'Gehäuse', 3, 8, ['A']], ['F', 'Aufbau', 2, 5, ['C', 'E']], ['G', 'Test', 2, 6, ['F', 'D']]] },
    { name: 'Software-Release', acts: [['A', 'Planung', 1, 3, []], ['B', 'Entwurf', 2, 5, ['A']], ['C', 'Backend', 4, 10, ['B']], ['D', 'Oberfläche', 3, 9, ['B']], ['E', 'Integration', 2, 4, ['C', 'D']], ['F', 'Test', 2, 6, ['E']], ['G', 'Handbuch', 3, 9, ['B']], ['H', 'Release', 1, 2, ['F', 'G']]] },
    { name: 'Anlagen-Umbau', acts: [['A', 'Genehmigung', 2, 6, []], ['B', 'Material bestellen', 3, 9, ['A']], ['C', 'Rückbau', 2, 5, ['A']], ['D', 'Fundament', 3, 7, ['C']], ['E', 'Montage', 2, 6, ['B', 'D']], ['F', 'Verkabelung', 2, 5, ['E']], ['G', 'Steuerung programmieren', 3, 9, ['B']], ['H', 'Inbetriebnahme', 1, 3, ['F', 'G']]] },
    { name: 'Schulungsveranstaltung', acts: [['A', 'Raum buchen', 1, 4, []], ['B', 'Unterlagen erstellen', 3, 8, []], ['C', 'Einladung versenden', 1, 3, ['A']], ['D', 'Probelauf', 1, 3, ['B', 'C']], ['E', 'Durchführung', 1, 2, ['D']], ['F', 'Auswertung', 1, 3, ['E']]] }
  ];
  const INV_PRESET = { i: 6, A: { I: 20000, ue: 5500, n: 5, rest: 2000 }, B: { I: 30000, ue: 7500, n: 5, rest: 3000 } };
  const RISK_PRESET = [{ name: 'Lieferverzug Leiterplatte', p: 4, s: 3 }, { name: 'Schlüsselperson fällt aus', p: 2, s: 5 }, { name: 'Anforderungen ändern sich', p: 4, s: 4 }, { name: 'Prüfgerät nicht kalibriert', p: 2, s: 2 }, { name: 'Budget wird gekürzt', p: 1, s: 5 }];
  const FMEA_PRESET = [{ name: 'Kaltlötstelle am Stecker', b: 7, a: 4, e: 5 }, { name: 'Falsche Firmware-Version', b: 6, a: 3, e: 3 }, { name: 'Kondensator falsch gepolt', b: 8, a: 2, e: 3 }, { name: 'Gehäuse undicht', b: 5, a: 3, e: 6 }, { name: 'Sensor driftet', b: 6, a: 5, e: 7 }];
  const PARETO_PRESET = [{ label: 'Lötfehler', v: 42 }, { label: 'Falsches Bauteil', v: 23 }, { label: 'Firmware', v: 14 }, { label: 'Gehäuse', v: 9 }, { label: 'Bedienfehler', v: 7 }, { label: 'Sonstiges', v: 5 }];
  const PB_CHAPTERS = [{ n: 'Einleitung', w: 8 }, { n: 'Grundlagen und Ausgangslage', w: 14 }, { n: 'Planung', w: 18 }, { n: 'Durchführung', w: 30 }, { n: 'Ergebnisse und Bewertung', w: 20 }, { n: 'Fazit und Ausblick', w: 10 }];
  const PB_CH7 = ['Einleitung', 'Grundlagen und Ausgangslage', 'Planung', 'Durchführung', 'Ergebnisse und Bewertung', 'Fazit und Ausblick', 'Anhang'];
  const PB_CHECK = [
    { g: 'Inhalt', items: ['Ziel und Aufgabenstellung stehen am Anfang', 'Jedes Kapitel hat einen erkennbaren Zweck', 'Ergebnisse werden mit den Zielen verglichen', 'Probleme und Lösungen sind ehrlich beschrieben', 'Das Fazit enthält eine eigene Bewertung'] },
    { g: 'Form', items: ['Seitenzahlen stehen im ganzen Dokument', 'Inhaltsverzeichnis stimmt mit den Überschriften überein', 'Einheitliche Schrift, Abstände und Überschriftenstufen', 'Abbildungen und Tabellen sind nummeriert und beschriftet', 'Im Text wird auf jede Abbildung verwiesen', 'Verzeichnisse (Abbildungen, Tabellen, Abkürzungen) sind vollständig, falls verlangt'] },
    { g: 'Quellen', items: ['Wörtliche Zitate stehen in Anführungszeichen mit Seitenzahl', 'Sinngemäße Übernahmen sind mit „vgl.“ belegt', 'Jede zitierte Quelle steht im Quellenverzeichnis', 'Internetquellen haben Adresse und Abrufdatum', 'Fremde Abbildungen haben eine Quellenangabe'] },
    { g: 'Abgabe', items: ['Rechtschreibung und Zahlenformate geprüft', 'Erklärung zur selbständigen Anfertigung unterschrieben, falls vorgeschrieben', 'Anhang enthält Rohdaten, Pläne und Datenblätter', 'Abgabeformat und Frist der Vorgabe geprüft', 'Eine zweite Person hat Probe gelesen'] }
  ];
  const PB_RULES = [
    { h: 'Abbildungen und Tabellen', t: ['Fortlaufend nummerieren (Abbildung 1, 2, 3 …) und beschriften.', 'Die Beschriftung soll ohne den Fließtext verständlich sein.', 'Im Text auf jede Abbildung verweisen und erklären, was man sehen soll.', 'Fremde Bilder mit Quelle, eigene als „eigene Darstellung“ kennzeichnen.', 'Ab mehreren Abbildungen ist ein Abbildungsverzeichnis üblich. Lage der Beschriftung: Vorgabe der Schule oder Hochschule beachten.'] },
    { h: 'Zitate', t: ['Wörtlich: Anführungszeichen, Seitenzahl, exakt übernehmen.', 'Sinngemäß: eigene Worte, Kurzbeleg mit „vgl.“.', 'Jeder Kurzbeleg verweist auf einen Eintrag im Quellenverzeichnis.', 'Datenblätter, Normen und Webseiten sind ebenfalls Quellen.'] },
    { h: 'Quellenverzeichnis', t: ['Nur Quellen aufführen, die im Text wirklich benutzt wurden.', 'Einheitlich aufbauen: Urheber (Person oder Institution), Jahr, Titel, Ort oder Adresse.', 'Internetquellen mit Abrufdatum angeben.', 'Sortierung nach Vorgabe (meist alphabetisch).'] },
    { h: 'Sprache und Zahlen', t: ['Sachlich, in ganzen Sätzen, möglichst im Präsens oder Perfekt durchgehend.', 'Zahl und Einheit durch ein Leerzeichen trennen, Einheiten einheitlich schreiben.', 'Abkürzungen beim ersten Auftreten erklären.', 'Ergebnisse mit sinnvoller Genauigkeit angeben, nicht mit allen Nachkommastellen des Taschenrechners.'] }
  ];

  /* ================================================================ Aufgaben */
  const tasks = [];
  const add = (blk, title, level, make) => tasks.push({ id: 'prj' + (tasks.length + 1), blk, title, level, make });
  const A = (key, label, unit, value, tol) => ({ key, label, unit, value, tol });
  const rel = (v, r, min) => Math.max(min, Math.abs(v) * r);
  const N = (v, d) => C.fmtN(v, d == null ? 2 : d);
  const E = (v, d) => C.eur(v, d == null ? 2 : d);
  const tries = (gen, ok) => { let p; for (let i = 0; i < 400; i++) { p = gen(); if (ok(p)) return p; } return p; };
  const RULE_NUM = 'Rechne ohne Zwischenrundung und runde erst das Ergebnis.';
  const pickQ = (R, opts, items, shuffleOpts) => {   /* Reihenfolge der Zeilen mischen */
    return { opts, items: C.shuffle(R, items) };
  };

  /* ---------------- Netzplan-Bausteine ---------------- */
  function mkActs(R, tpl) { return tpl.acts.map(a => ({ id: a[0], name: a[1], d: C.ri(R, a[2], a[3]), pre: a[4].slice() })); }
  function drawNet(R, ok, idx) {
    let best = null;
    for (let i = 0; i < 400; i++) {
      const tpl = NETS[idx == null ? Math.floor(R() * NETS.length) : idx], acts = mkActs(R, tpl), res = C.cpm(acts);
      best = { tpl, acts, res }; if (!ok || ok(best)) return best;
    }
    return best;
  }
  const netText = (acts, unit) => acts.map(a => a.id + '  ' + a.name + ': ' + a.d + ' ' + (unit || 'AT') + ', ' + (a.pre.length ? 'nach ' + a.pre.join(' und ') : 'Start')).join('\n');
  const fwd = res => res.order.map(id => { const o = res.map.get(id); return o.id + ': FAZ ' + N(o.es) + (o.pre.length > 1 ? ' (größtes FEZ der Vorgänger ' + o.pre.map(p => res.map.get(p).id + '=' + N(res.map.get(p).ef)).join(', ') + ')' : '') + ', FEZ = ' + N(o.es) + ' + ' + N(o.d) + ' = ' + N(o.ef); });
  const bwd = res => res.order.slice().reverse().map(id => { const o = res.map.get(id); return o.id + ': SEZ ' + N(o.lf) + (o.succ.length > 1 ? ' (kleinstes SAZ der Nachfolger ' + o.succ.map(s => res.map.get(s).id + '=' + N(res.map.get(s).ls)).join(', ') + ')' : '') + ', SAZ = ' + N(o.lf) + ' − ' + N(o.d) + ' = ' + N(o.ls); });
  const pathStr = p => p.join(' → ');
  const NETFIG = a => ({ type: 'net', acts: a });

  add('np', 'Vorwärtsrechnung: Projektdauer', 1, (R, C) => {
    const { tpl, acts, res } = drawNet(R, null, R() < 0.5 ? 3 : 0);
    return { kind: 'num', fig: NETFIG(acts), text: 'Projekt „' + tpl.name + '“. Wie lange dauert es mindestens? Vorgänge:\n' + netText(acts), asks: [A('dur', 'Projektdauer', 'AT', res.duration, 0)], p: { acts },
      tips: ['Rechne vorwärts: Jeder Vorgang kann beginnen, sobald alle Vorgänger fertig sind. Du brauchst also bei jedem Vorgang das späteste Ende seiner Vorgänger.', 'FEZ = FAZ + Dauer. Bei mehreren Vorgängern ist FAZ das größte FEZ. Die Projektdauer ist das größte FEZ aller Vorgänge.', 'Rechne in der Reihenfolge der Vorgänge Zeile für Zeile. Das größte FEZ am Ende ist die Projektdauer; prüfe dein Ergebnis anhand des Wegs über die langsamsten Vorgänger.'],
      expl: fwd(res).concat(['Projektdauer = größtes FEZ = ' + N(res.duration) + ' AT.', 'Kritischer Pfad: ' + res.paths.map(pathStr).join(' und ') + '.']) };
  });
  add('np', 'FAZ bei zwei Vorgängern', 1, (R, C) => {
    const { acts, res } = drawNet(R, null); const cand = res.list.filter(o => o.pre.length >= 2), o = cand[Math.floor(R() * cand.length)] || res.list[res.list.length - 1];
    return { kind: 'num', fig: NETFIG(acts), text: 'Welchen frühesten Anfangszeitpunkt (FAZ) hat Vorgang ' + o.id + ' („' + o.name + '“)? Vorgänge:\n' + netText(acts), asks: [A('faz', 'FAZ von ' + o.id, 'AT', o.es, 0)], p: { acts, id: o.id },
      tips: ['Der Vorgang darf erst beginnen, wenn ALLE Vorgänger fertig sind.', 'FAZ = größtes FEZ der Vorgänger. Rechne zuerst alle Vorgänger vorwärts.', 'Die FEZ der Vorgänger von ' + o.id + ' sind ' + o.pre.map(p => p + ' = ' + N(res.map.get(p).ef)).join(' und ') + '. Welcher Wert ist der größere?'],
      expl: fwd(res).slice(0, res.order.indexOf(o.id) + 1).concat(['FAZ von ' + o.id + ' = ' + N(o.es) + ' AT.']) };
  });
  add('np', 'Kritischen Pfad erkennen', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.paths.length === 1 && C.allPaths(x.res).paths.length >= 3 && C.allPaths(x.res).paths[1].len < x.res.duration, Math.floor(R() * 3));
    const ap = C.allPaths(res).paths, cand = C.shuffle(R, ap.slice(0, 4)), crit = pathStr(res.paths[0]);
    const opts = cand.map(x => pathStr(x.ids) + '  (' + N(x.len) + ' AT)'); const a = cand.findIndex(x => pathStr(x.ids) === crit);
    return { kind: 'pick', fig: NETFIG(acts), text: 'Welcher Weg durch das Netz ist der kritische Pfad? Vorgänge:\n' + netText(acts), opts: opts.map(o => o.replace(/\s+\(.*\)$/, '')), items: [{ t: 'Kritischer Pfad:', a, why: 'Der kritische Pfad ist der längste Weg: ' + crit + ' mit ' + N(res.duration) + ' AT.' }], p: { acts },
      tips: ['Der kritische Pfad ist der längste Weg vom Start bis zum Ende, nicht der mit den meisten Vorgängen.', 'Addiere die Dauern entlang jedes angebotenen Wegs. Der größte Wert gewinnt.', 'Die Weglängen der Optionen: ' + cand.map(x => N(x.len)).join(', ') + ' AT.'],
      expl: cand.map(x => pathStr(x.ids) + ': ' + x.ids.map(id => N(res.map.get(id).d)).join(' + ') + ' = ' + N(x.len) + ' AT').concat(['Der längste Weg ist ' + crit + ' (' + N(res.duration) + ' AT): Er ist kritisch, jeder Tag Verzug dort verschiebt das Projektende.']) };
  });
  add('np', 'Rückwärtsrechnung: SAZ und SEZ', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.some(o => o.succ.length >= 1 && o.gp > 0)); const cand = res.list.filter(o => o.succ.length >= 1 && o.gp > 0), o = cand[Math.floor(R() * cand.length)];
    return { kind: 'num', fig: NETFIG(acts), text: 'Das Projekt soll so früh wie möglich enden. Wie spät dürfen Vorgang ' + o.id + ' („' + o.name + '“) beginnen (SAZ) und enden (SEZ), ohne das Projektende zu verzögern? Vorgänge:\n' + netText(acts), asks: [A('saz', 'SAZ von ' + o.id, 'AT', o.ls, 0), A('sez', 'SEZ von ' + o.id, 'AT', o.lf, 0)], p: { acts, id: o.id },
      tips: ['Jetzt rückwärts: Start am Projektende. Vorgänge ohne Nachfolger enden spätestens zur Projektdauer.', 'SEZ = kleinstes SAZ aller Nachfolger. SAZ = SEZ − Dauer.', 'Projektdauer ' + N(res.duration) + ' AT. Nachfolger von ' + o.id + ': ' + o.succ.map(s => s + ' (SAZ ' + N(res.map.get(s).ls) + ')').join(', ') + '.'],
      expl: ['Projektdauer ' + N(res.duration) + ' AT (Vorwärtsrechnung).'].concat(bwd(res).slice(0, res.order.length - res.order.indexOf(o.id))) };
  });
  add('np', 'Gesamtpuffer bestimmen', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.some(o => o.gp > 0)); const cand = res.list.filter(o => o.gp > 0), o = cand[Math.floor(R() * cand.length)];
    return { kind: 'num', fig: NETFIG(acts), text: 'Wie groß ist der Gesamtpuffer (GP) von Vorgang ' + o.id + ' („' + o.name + '“)? Vorgänge:\n' + netText(acts), asks: [A('gp', 'Gesamtpuffer von ' + o.id, 'AT', o.gp, 0)], p: { acts, id: o.id },
      tips: ['Der Gesamtpuffer sagt, wie viel der Vorgang länger dauern oder später starten darf, ohne dass das Projektende wandert.', 'GP = SAZ − FAZ (gleichwertig: SEZ − FEZ). Dafür brauchst du Vorwärts- und Rückwärtsrechnung.', 'FAZ von ' + o.id + ' ist ' + N(o.es) + ' AT, SAZ ist ' + N(o.ls) + ' AT.'],
      expl: ['Vorwärts: ' + o.id + ' hat FAZ ' + N(o.es) + ', FEZ ' + N(o.ef) + '.', 'Rückwärts: ' + o.id + ' hat SAZ ' + N(o.ls) + ', SEZ ' + N(o.lf) + '.', 'GP = SAZ − FAZ = ' + N(o.ls) + ' − ' + N(o.es) + ' = ' + N(o.gp) + ' AT.'] };
  });
  add('np', 'Freier Puffer', 3, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.some(o => o.fp > 0 && o.fp < o.gp) || x.res.list.some(o => o.fp > 0)); const a1 = res.list.filter(o => o.fp > 0), o = a1[Math.floor(R() * a1.length)];
    return { kind: 'num', fig: NETFIG(acts), text: 'Wie groß ist der freie Puffer (FP) von Vorgang ' + o.id + ' („' + o.name + '“)? Vorgänge:\n' + netText(acts), asks: [A('fp', 'Freier Puffer von ' + o.id, 'AT', o.fp, 0)], p: { acts, id: o.id },
      tips: ['Der freie Puffer fragt nur nach den direkten Nachfolgern: Wie lange kann ich trödeln, ohne dass ein Nachfolger später beginnen muss?', 'FP = (kleinstes FAZ der Nachfolger) − eigenes FEZ. Ohne Nachfolger: Projektdauer − FEZ.', 'FEZ von ' + o.id + ' = ' + N(o.ef) + '. ' + (o.succ.length ? 'FAZ der Nachfolger: ' + o.succ.map(s => s + ' = ' + N(res.map.get(s).es)).join(', ') + '.' : 'Es gibt keinen Nachfolger, die Projektdauer ist ' + N(res.duration) + '.')],
      expl: ['FEZ von ' + o.id + ' = ' + N(o.ef) + '.', o.succ.length ? 'Früheste Anfänge der Nachfolger: ' + o.succ.map(s => s + ' = ' + N(res.map.get(s).es)).join(', ') + ' → Minimum ' + N(Math.min.apply(null, o.succ.map(s => res.map.get(s).es))) + '.' : 'Kein Nachfolger: Bezug ist die Projektdauer ' + N(res.duration) + '.', 'FP = ' + N(o.ef + o.fp) + ' − ' + N(o.ef) + ' = ' + N(o.fp) + ' AT.  (Gesamtpuffer zum Vergleich: ' + N(o.gp) + ' AT; FP ≤ GP gilt immer.)'] };
  });
  add('np', 'Wie viele Vorgänge sind kritisch?', 1, (R, C) => {
    const { acts, res } = drawNet(R, null);
    return { kind: 'num', fig: NETFIG(acts), text: 'Wie viele Vorgänge haben keinen Puffer (GP = 0)? Vorgänge:\n' + netText(acts), asks: [A('n', 'Anzahl kritischer Vorgänge', '', res.critical.length, 0)], p: { acts },
      tips: ['Kritisch ist ein Vorgang, wenn er keinerlei Verzögerung verträgt: GP = 0.', 'Suche den längsten Weg. Alle seine Vorgänge sind kritisch. Gibt es einen zweiten gleich langen Weg, zählen dessen Vorgänge auch.', 'Gesucht ist die Anzahl der Vorgänge, nicht die Dauer des Wegs. Projektdauer: ' + N(res.duration) + ' AT.'],
      expl: fwd(res).slice(-2).concat(['GP = 0 haben: ' + res.critical.join(', ') + '.', 'Anzahl: ' + res.critical.length + '. Kritische Pfade: ' + res.paths.map(pathStr).join(' und ') + '.']) };
  });
  add('np', 'Dauer ändern: neue Projektdauer', 2, (R, C) => {
    const { acts, res } = drawNet(R, null); const k = res.list.filter(o => o.crit), o = k[Math.floor(R() * k.length)], dd = C.ri(R, 1, 4), w = C.whatIf(acts, o.id, o.d + dd);
    return { kind: 'num', fig: NETFIG(acts), text: 'Bei Vorgang ' + o.id + ' („' + o.name + '“) dauert es ' + dd + ' AT länger als geplant (statt ' + o.d + ' nun ' + (o.d + dd) + ' AT). Wie lange dauert das Projekt jetzt? Vorgänge:\n' + netText(acts), asks: [A('dur', 'Neue Projektdauer', 'AT', w.now, 0)], p: { acts, id: o.id, nd: o.d + dd },
      tips: ['Prüfe zuerst: Liegt der Vorgang auf dem kritischen Pfad?', 'Auf dem kritischen Pfad verschiebt jeder Tag Verzug das Projektende um genau einen Tag. Der kritische Pfad bleibt der längste Weg.', 'Rechne das Netz mit der neuen Dauer von ' + o.id + ' einfach neu durch: ' + N(res.duration) + ' AT war es vorher.'],
      expl: ['Vorher: ' + N(res.duration) + ' AT, kritischer Pfad ' + res.paths.map(pathStr).join(' / ') + '.', o.id + ' ist kritisch (GP 0). Neue Dauer ' + (o.d + dd) + ' AT, Netz neu gerechnet.', 'Neue Projektdauer: ' + N(w.now) + ' AT (' + (w.delta >= 0 ? '+' : '') + N(w.delta) + ' AT).'] };
  });
  add('np', 'Puffer nutzen', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.some(o => o.gp >= 1 && !o.crit)); const cand = res.list.filter(o => o.gp >= 1), o = cand[Math.floor(R() * cand.length)], extra = o.gp + C.ri(R, 1, 3), w = C.whatIf(acts, o.id, o.d + extra);
    return { kind: 'num', fig: NETFIG(acts), text: 'Vorgang ' + o.id + ' („' + o.name + '“) ist nicht kritisch. Er dauert statt ' + o.d + ' nun ' + (o.d + extra) + ' AT (also ' + extra + ' AT länger). Wie lange dauert das Projekt jetzt? Vorgänge:\n' + netText(acts), asks: [A('dur', 'Neue Projektdauer', 'AT', w.now, 0)], p: { acts, id: o.id, nd: o.d + extra },
      tips: ['Ein Vorgang mit Puffer darf bis zum Gesamtpuffer länger dauern, ohne dass das Projekt später endet.', 'Nur der Teil der Verzögerung, der den Gesamtpuffer übersteigt, verschiebt das Projektende.', 'Gesamtpuffer von ' + o.id + ' ist ' + N(o.gp) + ' AT, die Verzögerung ' + N(extra) + ' AT.'],
      expl: [o.id + ' hat GP ' + N(o.gp) + ' AT. Verzug ' + N(extra) + ' AT.', 'Überschuss über den Puffer: ' + N(extra) + ' − ' + N(o.gp) + ' = ' + N(extra - o.gp) + ' AT.', 'Neue Projektdauer = ' + N(res.duration) + ' + ' + N(extra - o.gp) + ' = ' + N(w.now) + ' AT (Netz neu gerechnet).'] };
  });
  add('np', 'Meilenstein-Termin', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.length >= 6), two = C.shuffle(R, res.list).slice(0, 2);
    const a2 = acts.concat([{ id: 'M', name: 'Meilenstein', d: 0, pre: two.map(o => o.id) }]), r2 = C.cpm(a2), m = r2.map.get('M');
    return { kind: 'num', fig: NETFIG(a2), text: 'Der Meilenstein M („Zwischenabnahme“, Dauer 0) soll stattfinden, sobald ' + two.map(o => o.id).join(' und ') + ' abgeschlossen sind. Zu welchem Zeitpunkt (AT ab Projektstart) kann er frühestens erreicht werden? Vorgänge:\n' + netText(a2), asks: [A('m', 'Frühester Termin von M', 'AT', m.es, 0)], p: { acts: a2 },
      tips: ['Ein Meilenstein ist ein Vorgang mit Dauer 0: Er hat einen Termin, braucht aber keine Zeit.', 'Sein Termin ist das größte FEZ seiner Vorgänger.', 'FEZ von ' + two.map(o => o.id + ' = ' + N(r2.map.get(o.id).ef)).join(' und ') + '.'],
      expl: two.map(o => o.id + ': FEZ ' + N(r2.map.get(o.id).ef)).concat(['M: FAZ = größtes FEZ = ' + N(m.es) + ', FEZ = ' + N(m.es) + ' + 0 = ' + N(m.ef) + '.', 'Der Meilenstein liegt frühestens bei ' + N(m.es) + ' AT.']) };
  });
  add('np', 'Verkürzen: Was bringt es wirklich?', 3, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.list.some(o => o.crit && o.d >= 3) && x.res.paths.length === 1); const k = res.list.filter(o => o.crit && o.d >= 3), o = k[Math.floor(R() * k.length)], cut = C.ri(R, 1, Math.min(o.d - 1, 4)), w = C.whatIf(acts, o.id, o.d - cut);
    return { kind: 'num', fig: NETFIG(acts), text: 'Vorgang ' + o.id + ' („' + o.name + '“) wird durch mehr Personal um ' + cut + ' AT verkürzt (von ' + o.d + ' auf ' + (o.d - cut) + ' AT). Um wie viele AT wird das Projekt dadurch kürzer? Vorgänge:\n' + netText(acts), asks: [A('save', 'Gewinn', 'AT', -w.delta, 0)], p: { acts, id: o.id, nd: o.d - cut },
      tips: ['Verkürzt du einen kritischen Vorgang, wird das Projekt kürzer. Aber nicht unbedingt um den ganzen Betrag.', 'Sobald ein zweiter Weg gleich lang ist, wird er kritisch, und weiteres Verkürzen auf dem ersten Weg bringt nichts mehr.', 'Alte Projektdauer ' + N(res.duration) + ' AT. Rechne das Netz mit der neuen Dauer neu und bilde die Differenz.'],
      expl: ['Vorher: ' + N(res.duration) + ' AT (kritisch: ' + pathStr(res.paths[0]) + ').', 'Mit ' + o.id + ' = ' + N(o.d - cut) + ' AT neu gerechnet: ' + N(w.now) + ' AT.', 'Gewinn: ' + N(res.duration) + ' − ' + N(w.now) + ' = ' + N(-w.delta) + ' AT' + (-w.delta < cut ? ' (weniger als ' + cut + ' AT, weil ein bisher unkritischer Weg nachrückt: ' + w.res.paths.map(pathStr).join(' / ') + ').' : '.')] };
  });
  add('np', 'Gantt lesen: Wer läuft gleichzeitig?', 2, (R, C) => {
    const { acts, res } = drawNet(R, x => x.res.duration >= 12); const t0 = C.ri(R, 2, Math.max(2, Math.floor(res.duration) - 2)), run = res.list.filter(o => o.d > 0 && o.es <= t0 && t0 < o.ef);
    return { kind: 'num', fig: NETFIG(acts), text: 'Alle Vorgänge starten so früh wie möglich. Wie viele Vorgänge laufen zum Zeitpunkt t = ' + t0 + ' AT (also in dem Zeitraum von ' + t0 + ' bis ' + (t0 + 0.5) + ')? Ein Vorgang läuft, wenn FAZ ≤ t < FEZ. Vorgänge:\n' + netText(acts), asks: [A('n', 'Anzahl laufender Vorgänge', '', run.length, 0)], p: { acts, t: t0 },
      tips: ['Zeichne dir (oder denke dir) das Gantt-Diagramm: Jeder Vorgang ist ein Balken von FAZ bis FEZ.', 'Zähle die Balken, die den Zeitpunkt t überdecken. Ein Balken, der bei t endet, läuft nicht mehr; einer, der bei t beginnt, läuft schon.', 'Du brauchst FAZ und FEZ aller Vorgänge (Vorwärtsrechnung).'],
      expl: res.list.map(o => o.id + ': ' + N(o.es) + ' bis ' + N(o.ef) + (o.es <= t0 && t0 < o.ef && o.d > 0 ? '  ← läuft bei t = ' + t0 : '')).concat(['Es laufen ' + run.length + ' Vorgänge: ' + (run.map(o => o.id).join(', ') || 'keiner') + '.']) };
  });

  /* ---------------- Lastenheft ---------------- */
  const OPT_LH = ['Lastenheft', 'Pflichtenheft'];
  add('lh', 'Lastenheft oder Pflichtenheft?', 1, (R, C) => {
    const L = C.shuffle(R, LH_PH_STATEMENTS.LH).slice(0, 3).map(t => ({ t, a: 0, why: 'Ziel oder Grenze aus Sicht des Auftraggebers: Was soll erreicht werden? → Lastenheft.' })), P = C.shuffle(R, LH_PH_STATEMENTS.PH).slice(0, 3).map(t => ({ t, a: 1, why: 'Beschreibt die technische Lösung (Bauteil, Verfahren, Struktur): Wie wird es gemacht? → Pflichtenheft.' }));
    return Object.assign({ kind: 'pick', text: 'Ordne jede Aussage dem Dokument zu, in das sie gehört.', tips: ['Frage dich bei jedem Satz: Wird hier ein Ziel genannt (Was?) oder eine Lösung (Wie?).', 'Ziele und Grenzen vom Kunden: Lastenheft. Bauteile, Verfahren, Aufbau vom Auftragnehmer: Pflichtenheft.', 'Sätze mit konkreten Bauteilen, Protokollen oder Programmstrukturen sind Lösungen, also Pflichtenheft.'], expl: ['Faustregel: Lastenheft = Was und Wofür (Auftraggeber). Pflichtenheft = Wie und Womit (Auftragnehmer).'] }, pickQ(R, OPT_LH, L.concat(P)), { p: {} });
  });
  add('lh', 'Wer schreibt was?', 1, (R, C) => {
    const O = ['Auftraggeber', 'Auftragnehmer', 'beide gemeinsam'], items = [
      { t: 'Verfasst das Lastenheft.', a: 0, why: 'Der Auftraggeber weiß, was er braucht.' }, { t: 'Verfasst das Pflichtenheft.', a: 1, why: 'Der Auftragnehmer legt fest, wie er die Forderungen umsetzt.' },
      { t: 'Prüft das Pflichtenheft gegen das Lastenheft und gibt es frei.', a: 0, why: 'Der Auftraggeber prüft, ob seine Wünsche richtig verstanden wurden.' }, { t: 'Einigt sich auf die verbindlichen Abnahmekriterien vor Projektstart.', a: 2, why: 'Abnahmekriterien müssen beide Seiten gleich verstehen und anerkennen.' }];
    return Object.assign({ kind: 'pick', text: 'Wer ist für die jeweilige Aufgabe zuständig?', tips: ['Auftraggeber = wer das Ergebnis haben will und bezahlt. Auftragnehmer = wer es liefert.', 'Das Pflichtenheft ist die Antwort des Auftragnehmers auf das Lastenheft.', 'Bei der Freigabe prüft der Auftraggeber; bei den Abnahmekriterien müssen beide zustimmen.'], expl: ['Lastenheft: Auftraggeber. Pflichtenheft: Auftragnehmer, danach Prüfung und Freigabe durch den Auftraggeber. Abnahmekriterien: gemeinsam festgelegt.'] }, pickQ(R, O, items), { p: {} });
  });
  add('lh', 'Gliederung: Welcher Abschnitt wohin?', 2, (R, C) => {
    const Lg = LH_GLIED.filter(g => g.doc === 'LH'), Pg = LH_GLIED.filter(g => g.doc === 'PH'), L = C.shuffle(R, Lg).slice(0, 3).map(g => ({ t: g.n, a: 0, why: g.t + ' → Lastenheft.' })), P = C.shuffle(R, Pg).slice(0, 3).map(g => ({ t: g.n, a: 1, why: g.t + ' → Pflichtenheft.' }));
    return Object.assign({ kind: 'pick', text: 'In welchem Dokument steht dieser Abschnitt zuerst?', tips: ['Das Lastenheft beschreibt die Lage des Auftraggebers und seine Ziele.', 'Das Pflichtenheft beschreibt die Lösung: Architektur, Konzept, Schnittstellen, Tests, Plan des Auftragnehmers.', 'Ist-Zustand, Zielbestimmung, Produkteinsatz und Rahmenbedingungen: Lastenheft. Architektur, Realisierung, Datenmodell, Testplan, Auftragnehmer-Plan: Pflichtenheft.'], expl: ['Nur eindeutige Abschnitte sind gefragt. Funktionale und nichtfunktionale Anforderungen und Abnahmekriterien stehen in beiden Dokumenten, im Pflichtenheft aber genauer.'] }, pickQ(R, OPT_LH, L.concat(P)), { p: {} });
  });
  const OPT_CK = ['eindeutig und messbar', 'nicht eindeutig oder nicht messbar'];
  const ckItems = (R, nOk, nBad, nSub) => {
    const o = C.shuffle(R, LH_CHECK.ok).slice(0, nOk).map(x => ({ t: x.t, a: 0, why: 'Gut formuliert: ' + x.why, req: true })), b = C.shuffle(R, LH_CHECK.bad).slice(0, nBad).map(x => ({ t: x.t, a: 1, why: x.why, req: false })), s = C.shuffle(R, LH_CHECK.badSubtle).slice(0, nSub || 0).map(x => ({ t: x.t, a: 1, why: x.why, req: false, noAn: true }));
    return o.concat(b, s);
  };
  add('lh', 'Prüfen: messbar und eindeutig? (1)', 1, (R, C) => Object.assign({ kind: 'pick', text: 'Prüfe jede Anforderung: Kann man am Ende sicher „erfüllt“ oder „nicht erfüllt“ sagen?', tips: ['Suche Wörter wie schnell, einfach, ausreichend, hoch, möglichst: Sie sind nicht messbar.', 'Eine prüfbare Anforderung hat eine Zahl mit Einheit, einen Bezug und ein verbindliches Wort (muss, soll, kann).', 'Steht keine Zahl und kein klares Kriterium im Satz, ist er fast immer nicht messbar.'], expl: ['Eine Anforderung ist prüfbar, wenn Zahl, Einheit, Bezug und Verbindlichkeit benannt sind.'] }, pickQ(R, OPT_CK, ckItems(R, 2, 2)), { p: {} }));
  add('lh', 'Prüfen: messbar und eindeutig? (2)', 2, (R, C) => Object.assign({ kind: 'pick', text: 'Prüfe jede Anforderung. Achtung: Auch Sätze mit einer Zahl können unklar sein, wenn der Bezug fehlt oder die Zahl nicht nachweisbar ist.', tips: ['Eine Zahl allein genügt nicht. Frage immer: Wovon, unter welcher Bedingung, womit gemessen?', 'Hundert Prozent „fehlerfrei“ lässt sich nie beweisen; „±1 %“ ohne Bezug ist doppeldeutig.', 'Vergleiche mit einem Test: Könnten zwei Prüfer unterschiedlich urteilen? Dann ist die Anforderung nicht eindeutig.'], expl: ['Eindeutig heißt: nur eine Lesart. Messbar heißt: ein Verfahren und ein Grenzwert sind vorhanden.'] }, pickQ(R, OPT_CK, ckItems(R, 2, 1, 2)), { p: {} }));
  add('lh', 'Anforderung verbessern', 2, (R, C) => {
    const s = LH_IMPROVE[Math.floor(R() * LH_IMPROVE.length)], idx = C.shuffle(R, [0, 1, 2, 3]), opts = idx.map(i => s.opts[i]), a = idx.indexOf(s.a);
    return { kind: 'pick', text: 'Die Anforderung „' + s.bad + '“ ist zu unscharf. Welche Umformulierung ist messbar und eindeutig?', opts, items: [{ t: 'Beste Fassung:', a, why: s.why }], p: { src: s.bad },
      tips: ['Suche die Fassung, bei der man am Ende messen kann.', 'Gute Fassung: verbindliches Wort, Zahl mit Einheit, Bezug (wann, wo, unter welcher Bedingung).', 'Streiche gedanklich alle Wörter wie „möglichst“, „ausreichend“, „modern“, „zuverlässig“. Welche Fassung behält danach noch eine prüfbare Aussage?'], expl: [s.why, 'Richtig: ' + s.opts[s.a]] };
  });
  add('lh', 'Muss, Soll oder Kann?', 1, (R, C) => {
    const O = ['Muss', 'Soll', 'Kann'], items = C.shuffle(R, LH_MSK).slice(0, 4).map(x => ({ t: x.t, a: x.a, why: ['Muss: Ohne die Eigenschaft gibt es keine Abnahme.', 'Soll: wichtig, aber Ausnahmen sind verhandelbar.', 'Kann: wünschenswert, nicht eingeplant.'][x.a] }));
    return Object.assign({ kind: 'pick', text: 'Welche Verbindlichkeit passt zur Beschreibung?', tips: ['Muss = Pflicht, Soll = erwartet, Kann = optional.', 'Frage dich: Was passiert, wenn es fehlt? Keine Abnahme (Muss), Verhandlung (Soll) oder nichts (Kann)?', 'Gesetzliche Vorschriften sind immer Muss.'], expl: ['Muss: Abnahmebedingung. Soll: wichtig, Ausnahmen möglich. Kann: Wunsch bei Restbudget.'] }, { opts: O, items }, { p: {} });
  });
  add('lh', 'Verfügbarkeit und Ausfallzeit', 2, (R, C) => {
    const v = C.pick(R, [99, 99.5, 99.8, 99.9, 99.95, 99.99]), a = C.ausfall(v), tol = v >= 99.95 ? 0.01 : 0.05;
    return { kind: 'num', text: 'Ein System soll eine Verfügbarkeit von ' + N(v) + ' % je Kalenderjahr erreichen (365 Tage = 8760 h). Wie viele Stunden darf es im Jahr höchstens ausfallen?', asks: [A('h', 'Ausfallzeit je Jahr', 'h', a.hJahr, tol)], p: { v },
      tips: ['Verfügbarkeit ist der Anteil der Zeit, in der das System läuft. Die Ausfallzeit ist der Rest.', 'Ausfallzeit = (1 − V) · 8760 h, mit V als Dezimalzahl (99,9 % = 0,999).', 'Der Ausfallanteil ist ' + N(100 - v, 3) + ' % = ' + N((100 - v) / 100, 5) + '. Multipliziere mit 8760 h.'],
      expl: ['Ausfallanteil = 100 % − ' + N(v) + ' % = ' + N(100 - v, 3) + ' % = ' + N((100 - v) / 100, 5) + '.', 'Ausfallzeit = ' + N((100 - v) / 100, 5) + ' · 8760 h = ' + N(a.hJahr, 3) + ' h (= ' + N(a.minJahr, 1) + ' min).', 'Das System darf also höchstens ' + N(a.hJahr, 2) + ' h im Jahr ausfallen.'] };
  });
  add('lh', 'Abnahmekriterium finden', 3, (R, C) => {
    const s = LH_ABNAHME[Math.floor(R() * LH_ABNAHME.length)], idx = C.shuffle(R, [0, 1, 2, 3].slice(0, s.opts.length)), opts = idx.map(i => s.opts[i]), a = idx.indexOf(s.a);
    return { kind: 'pick', text: 'Welche Formulierung taugt als Abnahmekriterium, weil man sie bei der Abnahme eindeutig abhaken kann?', opts, items: [{ t: 'Prüfbares Kriterium:', a, why: s.why }], p: { src: 'abn' },
      tips: ['Bei der Abnahme gibt es keine Diskussion über Geschmack. Gesucht ist die Aussage mit Zahl, Messverfahren und Ergebnis.', 'Prüfbar: Grenzwert, Bedingung, Messverfahren. Wörter wie gut, zuverlässig, stabil, möglichst sind nicht prüfbar.', 'Zwei Prüfer müssen bei der gleichen Messung zum gleichen Urteil kommen.'], expl: [s.why, 'Richtig: ' + s.opts[s.a]] };
  });
  add('lh', 'Stimmt das?', 1, (R, C) => {
    const items = C.shuffle(R, LH_TRUE).slice(0, 4).map(x => ({ t: x.t, a: x.a, why: x.why }));
    return Object.assign({ kind: 'pick', text: 'Stimmt die Aussage über Lastenheft und Pflichtenheft?', tips: ['Lastenheft: Was und Wofür. Pflichtenheft: Wie und Womit.', 'Das Pflichtenheft folgt auf das Lastenheft und bezieht sich darauf.', 'Änderungen an freigegebenen Anforderungen laufen immer über eine Abstimmung beider Seiten.'], expl: ['Reihenfolge: Lastenheft → Pflichtenheft → Umsetzung → Abnahme gegen die Anforderungen.'] }, { opts: ['stimmt', 'stimmt nicht'], items }, { p: {} });
  });

  /* ---------------- Kosten ---------------- */
  add('ko', 'Stundensatz je produktiver Stunde', 1, (R, C) => {
    const p = { jb: C.ri(R, 36, 60) * 1000, lnk: C.ri(R, 20, 24), soll: C.pick(R, [1680, 1720, 1760, 1800]), prod: C.ri(R, 70, 85, 5), gk: 0, gw: 0 }, r = C.stundensatz(p), v = r.val;
    return { kind: 'num', text: 'Ein Techniker verdient ' + E(p.jb, 0) + ' brutto im Jahr. Die Lohnnebenkosten betragen ' + p.lnk + ' %, die Sollarbeitszeit ' + p.soll + ' h je Jahr, davon sind ' + p.prod + ' % produktiv (verrechenbar). Wie hoch sind die Personalkosten je produktiver Stunde? ' + RULE_NUM, asks: [A('sk', 'Personalkosten je produktiver Stunde', '€/h', v.sk, 0.05)], p,
      tips: ['Erst die Gesamtkosten des Jahres, dann die Stunden, die wirklich verrechnet werden können.', 'Personalkosten = Jahresbrutto · (1 + Lohnnebenkosten %). Produktive Stunden = Sollstunden · Anteil. Dann teilen.', 'Personalkosten ' + E(v.pk) + ', produktive Stunden ' + N(v.ph) + ' h.'],
      expl: ['Personalkosten = ' + E(p.jb, 0) + ' · (1 + ' + p.lnk + ' %) = ' + E(v.pk) + '.', 'Produktive Stunden = ' + p.soll + ' h · ' + p.prod + ' % = ' + N(v.ph) + ' h.', 'Satz = ' + E(v.pk) + ' : ' + N(v.ph) + ' h = ' + N(v.sk, 4) + ' €/h ≈ ' + E(v.sk) + ' je Stunde.'] };
  });
  add('ko', 'Verrechnungssatz mit Zuschlägen', 2, (R, C) => {
    const p = { jb: C.ri(R, 36, 60) * 1000, lnk: C.ri(R, 20, 24), soll: C.pick(R, [1720, 1760]), prod: C.ri(R, 70, 85, 5), gk: C.ri(R, 20, 60, 5), gw: C.ri(R, 5, 15) }, r = C.stundensatz(p), v = r.val;
    return { kind: 'num', text: 'Gleiche Rechnung wie oben, nun mit Zuschlägen: Jahresbrutto ' + E(p.jb, 0) + ', Lohnnebenkosten ' + p.lnk + ' %, Sollstunden ' + p.soll + ' h, produktiv ' + p.prod + ' %. Gemeinkostenzuschlag ' + p.gk + ' %, Gewinnzuschlag ' + p.gw + ' %. Wie hoch ist der Verrechnungssatz je Stunde? ' + RULE_NUM, asks: [A('vs', 'Verrechnungssatz', '€/h', v.vs, 0.05)], p,
      tips: ['Zuschläge werden nacheinander aufgeschlagen: erst Gemeinkosten auf den Personalsatz, dann Gewinn auf das Ergebnis.', 'Satz · (1 + GK %) · (1 + Gewinn %).', 'Personalkosten je produktiver Stunde: ' + N(v.sk, 3) + ' €/h; nach Gemeinkosten ' + N(v.gk, 3) + ' €/h.'],
      expl: ['Personalkosten ' + E(v.pk) + ', produktive Stunden ' + N(v.ph) + ' h → ' + N(v.sk, 4) + ' €/h.', 'Mit Gemeinkosten ' + p.gk + ' %: ' + N(v.sk, 4) + ' · ' + N(1 + p.gk / 100, 2) + ' = ' + N(v.gk, 4) + ' €/h.', 'Mit Gewinn ' + p.gw + ' %: ' + N(v.gk, 4) + ' · ' + N(1 + p.gw / 100, 2) + ' = ' + N(v.vs, 4) + ' €/h ≈ ' + E(v.vs) + '.'] };
  });
  const angP = R => ({ pos: [{ label: 'Entwicklung', h: C.ri(R, 40, 160, 10), satz: C.ri(R, 55, 75) }, { label: 'Test', h: C.ri(R, 20, 80, 10), satz: C.ri(R, 45, 60) }], mat: C.ri(R, 10, 40) * 100, fremd: C.ri(R, 2, 10) * 100, mgk: C.ri(R, 5, 15), wag: C.ri(R, 2, 6), gw: C.ri(R, 6, 12), sko: C.pick(R, [2, 3]), ust: 19 });
  const angTxt = p => 'Entwicklung ' + p.pos[0].h + ' h zu ' + E(p.pos[0].satz) + ' je Stunde (Selbstkostensatz), Test ' + p.pos[1].h + ' h zu ' + E(p.pos[1].satz) + ', Material ' + E(p.mat, 0) + ' (Materialgemeinkosten ' + p.mgk + ' %), Fremdleistung ' + E(p.fremd, 0) + '. Wagniszuschlag ' + p.wag + ' % auf die Kosten, Gewinn ' + p.gw + ' % auf die Selbstkosten, Kundenskonto ' + p.sko + ' % im Hundert.';
  const angExpl = (p, v) => ['Personal = ' + p.pos[0].h + ' · ' + N(p.pos[0].satz) + ' + ' + p.pos[1].h + ' · ' + N(p.pos[1].satz) + ' = ' + E(v.pers) + '.', 'MGK = ' + E(p.mat, 0) + ' · ' + p.mgk + ' % = ' + E(v.mgk) + '. Kosten vor Wagnis = ' + E(v.ek) + '.', 'Wagnis ' + p.wag + ' % = ' + E(v.wag) + ' → Selbstkosten ' + E(v.sk) + '. Gewinn ' + p.gw + ' % = ' + E(v.gew) + ' → Barverkaufspreis ' + E(v.bvp) + '.', 'Skonto im Hundert: ' + E(v.bvp) + ' : (1 − ' + p.sko + ' %) = ' + E(v.netto) + ' netto.'];
  add('ko', 'Angebot: Selbstkosten', 2, (R, C) => {
    const p = angP(R), r = C.angebot(p), v = r.val;
    return { kind: 'num', text: 'Projektangebot: ' + angTxt(p) + ' Wie hoch sind die Selbstkosten? ' + RULE_NUM, asks: [A('sk', 'Selbstkosten', '€', v.sk, rel(v.sk, 0.0002, 0.5))], p,
      tips: ['Selbstkosten = alle Kosten inklusive Zuschlägen, aber ohne Gewinn.', 'Personal + Material + MGK + Fremdleistung = Kosten vor Wagnis. Darauf das Wagnis.', 'Personalkosten ' + E(v.pers) + ', Materialgemeinkosten ' + E(v.mgk) + '.'],
      expl: angExpl(p, v).slice(0, 3).slice(0, 2).concat(['Selbstkosten = ' + E(v.ek) + ' + ' + E(v.wag) + ' = ' + E(v.sk) + '.']) };
  });
  add('ko', 'Angebot: Preis netto und brutto', 3, (R, C) => {
    const p = angP(R), r = C.angebot(p), v = r.val;
    return { kind: 'num', text: 'Projektangebot: ' + angTxt(p) + ' Umsatzsteuer 19 %. Berechne Angebotspreis netto und brutto. ' + RULE_NUM, asks: [A('netto', 'Angebotspreis netto', '€', v.netto, rel(v.netto, 0.0002, 0.5)), A('brutto', 'Angebotspreis brutto', '€', v.brutto, rel(v.brutto, 0.0002, 0.5))], p,
      tips: ['Schema: Selbstkosten + Gewinn = Barverkaufspreis. Skonto „im Hundert“ erhöht den Preis auf den Zielverkaufspreis. Dann Umsatzsteuer.', 'Zielpreis = Barpreis : (1 − Skonto %), brutto = netto · 1,19. Nicht Barpreis · (1 + Skonto %)!', 'Barverkaufspreis ' + E(v.bvp) + '.'],
      expl: angExpl(p, v).concat(['Brutto = ' + E(v.netto) + ' · 1,19 = ' + E(v.brutto) + '.']) };
  });
  add('ko', 'Deckungsbeitrag und DB-Quote', 1, (R, C) => {
    const pr = C.ri(R, 20, 90), kv = C.ri(R, 8, pr - 6), p = { p: pr, kv, kfix: C.ri(R, 5, 40) * 1000, x: 0 }, d = C.db(p);
    return { kind: 'num', text: 'Ein Produkt wird für ' + E(p.p) + ' verkauft. Die variablen Kosten betragen ' + E(p.kv) + ' je Stück, die Fixkosten ' + E(p.kfix, 0) + ' je Jahr. Wie hoch sind Deckungsbeitrag je Stück und DB-Quote?', asks: [A('dbs', 'Deckungsbeitrag je Stück', '€', d.dbs, 0.01), A('quote', 'DB-Quote', '%', d.quote, 0.1)], p,
      tips: ['Der Deckungsbeitrag ist das, was vom Preis übrig bleibt, wenn die variablen Kosten bezahlt sind.', 'DB = Preis − variable Kosten. DB-Quote = DB : Preis.', 'Die Fixkosten spielen bei dieser Frage keine Rolle.'],
      expl: ['DB je Stück = ' + E(p.p) + ' − ' + E(p.kv) + ' = ' + E(d.dbs) + '.', 'DB-Quote = ' + E(d.dbs) + ' : ' + E(p.p) + ' = ' + N(d.quote, 2) + ' %.'] };
  });
  add('ko', 'Break-even-Menge', 2, (R, C) => {
    const pr = C.ri(R, 20, 90), kv = C.ri(R, 8, pr - 6), p = { p: pr, kv, kfix: C.ri(R, 5, 40) * 1000, x: 0 }, d = C.db(p);
    return { kind: 'num', text: 'Preis ' + E(p.p) + ', variable Kosten ' + E(p.kv) + ' je Stück, Fixkosten ' + E(p.kfix, 0) + '. Ab welcher Stückzahl (ganze Stück, aufgerundet) ist die Gewinnschwelle erreicht, also kein Verlust mehr?', asks: [A('be', 'Break-even-Menge', 'Stück', d.beUp, 0)], p,
      tips: ['Break-even: Der Gewinn ist genau 0. Alle Fixkosten sind durch Deckungsbeiträge bezahlt.', 'Menge = Fixkosten : Deckungsbeitrag je Stück. Ganze Stück: aufrunden, denn bei weniger ist noch ein Rest offen.', 'DB je Stück = ' + E(d.dbs) + '. Rechne ' + E(p.kfix, 0) + ' : ' + E(d.dbs) + '.'],
      expl: ['DB je Stück = ' + E(p.p) + ' − ' + E(p.kv) + ' = ' + E(d.dbs) + '.', 'Break-even-Menge = ' + E(p.kfix, 0) + ' : ' + E(d.dbs) + ' = ' + N(d.be, 3) + ' Stück.', 'Aufgerundet: ' + d.beUp + ' Stück (bei ' + Math.floor(d.be) + ' Stück ist die Schwelle noch nicht erreicht, wenn die Zahl nicht glatt aufgeht).', 'Bei dieser Menge sind die Fixkosten gedeckt (Gewinn ≥ 0).'] };
  });
  add('ko', 'Break-even-Umsatz', 2, (R, C) => {
    const pr = C.ri(R, 20, 90), kv = C.ri(R, 8, pr - 6), p = { p: pr, kv, kfix: C.ri(R, 5, 40) * 1000, x: 0 }, d = C.db(p);
    return { kind: 'num', text: 'Preis ' + E(p.p) + ', variable Kosten ' + E(p.kv) + ' je Stück, Fixkosten ' + E(p.kfix, 0) + '. Bei welchem Umsatz liegt die Gewinnschwelle? ' + RULE_NUM, asks: [A('u', 'Break-even-Umsatz', '€', d.beUmsatz, rel(d.beUmsatz, 0.0005, 1))], p,
      tips: ['Erst die Menge an der Gewinnschwelle, dann in Umsatz umrechnen.', 'Umsatz = Break-even-Menge · Preis. Alternativ: Fixkosten : DB-Quote.', 'Break-even-Menge = ' + N(d.be, 3) + ' Stück (nicht runden, bevor du mit dem Preis malnimmst).'],
      expl: ['Menge = ' + E(p.kfix, 0) + ' : ' + E(d.dbs) + ' = ' + N(d.be, 4) + ' Stück.', 'Umsatz = ' + N(d.be, 4) + ' · ' + E(p.p) + ' = ' + E(d.beUmsatz) + '.', 'Probe über die DB-Quote: ' + E(p.kfix, 0) + ' : ' + N(d.quote / 100, 4) + ' = ' + E(p.kfix / (d.quote / 100)) + '.'] };
  });
  add('ko', 'Menge für einen Zielgewinn', 3, (R, C) => {
    const pr = C.ri(R, 20, 90), kv = C.ri(R, 8, pr - 6), p = { p: pr, kv, kfix: C.ri(R, 5, 40) * 1000, x: 0, gz: C.ri(R, 2, 20) * 1000 }, d = C.db(p);
    return { kind: 'num', text: 'Preis ' + E(p.p) + ', variable Kosten ' + E(p.kv) + ' je Stück, Fixkosten ' + E(p.kfix, 0) + '. Es soll ein Gewinn von ' + E(p.gz, 0) + ' erreicht werden. Wie viele Stück (ganze Stück, aufgerundet) müssen verkauft werden?', asks: [A('x', 'Menge für Zielgewinn', 'Stück', d.zielUp, 0)], p,
      tips: ['Der Gewinn ist, was nach den Fixkosten von den Deckungsbeiträgen übrig bleibt.', 'Menge = (Fixkosten + Zielgewinn) : DB je Stück.', 'Fixkosten + Zielgewinn = ' + E(p.kfix + p.gz, 0) + '; DB je Stück = ' + E(d.dbs) + '.'],
      expl: ['DB je Stück = ' + E(d.dbs) + '.', 'Menge = (' + E(p.kfix, 0) + ' + ' + E(p.gz, 0) + ') : ' + E(d.dbs) + ' = ' + N(d.zielMenge, 3) + ' Stück.', 'Aufgerundet: ' + d.zielUp + ' Stück.'] };
  });
  add('ko', 'Gewinn und Sicherheitsabstand', 3, (R, C) => {
    const pr = C.ri(R, 20, 90), kv = C.ri(R, 8, pr - 6), kfix = C.ri(R, 5, 40) * 1000, d0 = C.db({ p: pr, kv, kfix, x: 0 }), x = Math.ceil(d0.be * C.pick(R, [1.25, 1.5, 1.8, 2])) , p = { p: pr, kv, kfix, x }, d = C.db(p);
    return { kind: 'num', text: 'Preis ' + E(p.p) + ', variable Kosten ' + E(p.kv) + ' je Stück, Fixkosten ' + E(p.kfix, 0) + '. Geplant sind ' + p.x + ' Stück. Wie hoch sind Gewinn und Sicherheitsabstand (um wie viel Prozent der geplanten Menge darf der Absatz sinken, bis die Gewinnschwelle erreicht ist)?', asks: [A('g', 'Gewinn', '€', d.gewinn, rel(d.gewinn, 0.0005, 1)), A('s', 'Sicherheitsabstand', '%', d.sicher, 0.1)], p,
      tips: ['Gewinn = Gesamt-Deckungsbeitrag − Fixkosten.', 'Sicherheitsabstand = (geplante Menge − Break-even-Menge) : geplante Menge.', 'Break-even-Menge = ' + N(d.be, 3) + ' Stück, Gesamt-DB = ' + E(d.dbGes) + '.'],
      expl: ['Gesamt-DB = ' + p.x + ' · ' + E(d.dbs) + ' = ' + E(d.dbGes) + '.', 'Gewinn = ' + E(d.dbGes) + ' − ' + E(p.kfix, 0) + ' = ' + E(d.gewinn) + '.', 'Break-even-Menge = ' + N(d.be, 3) + ' Stück. Sicherheitsabstand = (' + p.x + ' − ' + N(d.be, 3) + ') : ' + p.x + ' = ' + N(d.sicher, 2) + ' %.'] };
  });
  add('ko', 'Dreipunkt-Schätzung', 2, (R, C) => {
    const a = C.ri(R, 2, 8), m = a + C.ri(R, 1, 6), b = m + C.ri(R, 2, 12), r = C.pert(a, m, b);
    return { kind: 'num', text: 'Für ein Arbeitspaket wird geschätzt: optimistisch ' + a + ' Tage, wahrscheinlich ' + m + ' Tage, pessimistisch ' + b + ' Tage. Berechne Erwartungswert E = (a + 4m + b) : 6 und Standardabweichung σ = (b − a) : 6.', asks: [A('e', 'Erwartungswert E', 'Tage', r.e, 0.05), A('sd', 'Standardabweichung σ', 'Tage', r.sd, 0.05)], p: { a, m, b },
      tips: ['Der wahrscheinlichste Wert zählt vierfach, die beiden Extreme je einfach.', 'E = (a + 4m + b) : 6; σ = (b − a) : 6.', 'a + 4m + b = ' + (a + 4 * m + b) + ', b − a = ' + (b - a) + '.'],
      expl: ['E = (' + a + ' + 4 · ' + m + ' + ' + b + ') : 6 = ' + (a + 4 * m + b) + ' : 6 = ' + N(r.e, 3) + ' Tage.', 'σ = (' + b + ' − ' + a + ') : 6 = ' + N(r.sd, 3) + ' Tage.'] };
  });
  add('ko', 'Aufwand mehrerer Pakete', 3, (R, C) => {
    const L = []; for (let i = 0; i < 3; i++) { const a = C.ri(R, 2, 8), m = a + C.ri(R, 1, 5), b = m + C.ri(R, 2, 10); L.push([a, m, b]); } const r = C.pertSum(L);
    return { kind: 'num', text: 'Drei Arbeitspakete (a / m / b in Tagen): ' + L.map((x, i) => 'Paket ' + (i + 1) + ': ' + x.join(' / ')).join(', ') + '. Berechne den Erwartungswert des Gesamtaufwands und die Gesamt-Standardabweichung (Varianzen addieren, dann Wurzel).', asks: [A('e', 'Gesamt-Erwartungswert', 'Tage', r.e, 0.05), A('sd', 'Gesamt-Standardabweichung', 'Tage', r.sd, 0.05)], p: { L },
      tips: ['Erwartungswerte darfst du einfach addieren, Standardabweichungen nicht.', 'Je Paket E und σ² = ((b − a) : 6)² berechnen. Σ E, Σ σ², dann √(Σ σ²).', 'Einzel-E: ' + r.items.map(x => N(x.e, 3)).join(', ') + '. Einzel-σ²: ' + r.items.map(x => N(x.v, 3)).join(', ') + '.'],
      expl: r.items.map((x, i) => 'Paket ' + (i + 1) + ': E = ' + N(x.e, 3) + ', σ = ' + N(x.sd, 3) + ', σ² = ' + N(x.v, 3)).concat(['Σ E = ' + N(r.e, 3) + ' Tage. Σ σ² = ' + N(r.v, 3) + ' → σ = ' + N(r.sd, 3) + ' Tage.', 'Faustregel: E + 2σ = ' + N(r.plus2, 1) + ' Tage deckt etwa 98 % der Fälle ab.']) };
  });

  /* ---------------- Investition ---------------- */
  const IV_TOL = (v) => rel(v, 0.0002, 0.5);
  const cfTxt = cf => cf.map((v, t) => 't = ' + t + ': ' + E(v, 0)).join(' · ');
  add('iv', 'Kapitalwert bei gleichen Überschüssen', 1, (R, C) => {
    const p = { I: C.ri(R, 10, 40) * 500, ue: 0, n: C.ri(R, 3, 6), i: C.ri(R, 4, 10), rest: 0 }; p.ue = Math.round(p.I / p.n * C.ri(R, 105, 135) / 100 / 10) * 10; const cf = C.reihe(p), k = C.npv(p.i / 100, cf), rb = (1 - Math.pow(1 + p.i / 100, -p.n)) / (p.i / 100);
    return { kind: 'num', text: 'Eine Anlage kostet ' + E(p.I, 0) + ' und bringt ' + p.n + ' Jahre lang jährlich ' + E(p.ue, 0) + ' Überschuss (Zahlungen am Jahresende). Kalkulationszins ' + p.i + ' %. Wie hoch ist der Kapitalwert? ' + RULE_NUM, asks: [A('k', 'Kapitalwert', '€', k, IV_TOL(k))], p,
      tips: ['Alle Zahlungen werden auf den Zeitpunkt 0 abgezinst. Die Anschaffung steht schon bei 0.', 'Bei gleichen Überschüssen: K = Überschuss · Rentenbarwertfaktor − Anschaffung, mit RBF = (1 − (1+i)⁻ⁿ) : i.', 'Rentenbarwertfaktor für ' + p.i + ' % und ' + p.n + ' Jahre: ' + N(rb, 5) + '.'],
      expl: ['RBF = (1 − 1,' + String(p.i).padStart(2, '0') + '^−' + p.n + ') : ' + N(p.i / 100, 2) + ' = ' + N(rb, 5) + '.', 'Barwert der Überschüsse = ' + E(p.ue, 0) + ' · ' + N(rb, 5) + ' = ' + E(p.ue * rb) + '.', 'K = ' + E(p.ue * rb) + ' − ' + E(p.I, 0) + ' = ' + E(k) + (k > 0 ? ' (positiv: vorteilhaft).' : ' (negativ: nicht vorteilhaft).')] };
  });
  add('iv', 'Kapitalwert bei ungleichen Zahlungen', 2, (R, C) => {
    const I = C.ri(R, 10, 40) * 500, z = [C.ri(R, 20, 40) * 100, C.ri(R, 20, 45) * 100, C.ri(R, 15, 50) * 100, C.ri(R, 10, 40) * 100], cf = [-I].concat(z), i = C.ri(R, 4, 10), k = C.npv(i / 100, cf);
    return { kind: 'num', text: 'Zahlungsreihe: ' + cfTxt(cf) + '. Kalkulationszins ' + i + ' %. Wie hoch ist der Kapitalwert? ' + RULE_NUM, asks: [A('k', 'Kapitalwert', '€', k, IV_TOL(k))], p: { cf, i },
      tips: ['Jede Zahlung wird einzeln abgezinst: Zahlung : (1 + i)^t.', 'K = Z₀ + Z₁:(1+i) + Z₂:(1+i)² + Z₃:(1+i)³ + Z₄:(1+i)⁴.', 'Abzinsungsfaktoren bei ' + i + ' %: ' + [1, 2, 3, 4].map(t => N(Math.pow(1 + i / 100, -t), 4)).join(', ') + '.'],
      expl: cf.map((v, t) => 't = ' + t + ': ' + E(v, 0) + ' · ' + N(Math.pow(1 + i / 100, -t), 5) + ' = ' + E(v / Math.pow(1 + i / 100, t))).concat(['Summe: K = ' + E(k) + '.']) };
  });
  add('iv', 'Ist die Investition vorteilhaft?', 1, (R, C) => {
    const p = tries(() => { const o = { I: C.ri(R, 10, 40) * 500, n: C.ri(R, 3, 6), i: C.ri(R, 5, 12), ue: 0, rest: 0 }; o.ue = Math.round(o.I / o.n * C.ri(R, 105, 150) / 100 / 10) * 10; return o; }, o => Math.abs(C.npv(o.i / 100, C.reihe(o))) > 0.05 * o.I), cf = C.reihe(p), k = C.npv(p.i / 100, cf);
    return { kind: 'pick', text: 'Anschaffung ' + E(p.I, 0) + ', jährlicher Überschuss ' + E(p.ue, 0) + ' über ' + p.n + ' Jahre, Kalkulationszins ' + p.i + ' %. Berechne den Kapitalwert: Ist die Investition vorteilhaft?', opts: ['vorteilhaft (K > 0)', 'nicht vorteilhaft (K < 0)'], items: [{ t: 'Entscheidung:', a: k > 0 ? 0 : 1, why: 'K = ' + E(k) + (k > 0 ? ' ist größer als 0: Die Investition verdient mehr als ' + p.i + ' %.' : ' ist kleiner als 0: Sie verdient weniger als ' + p.i + ' %.') }], p,
      tips: ['Vorteilhaft heißt: Der Kapitalwert ist positiv.', 'K = Überschuss · RBF − Anschaffung.', 'RBF = (1 − (1+i)⁻ⁿ) : i = ' + N((1 - Math.pow(1 + p.i / 100, -p.n)) / (p.i / 100), 4) + '. Multipliziere mit dem Überschuss und vergleiche mit der Anschaffung.'],
      expl: ['RBF = ' + N((1 - Math.pow(1 + p.i / 100, -p.n)) / (p.i / 100), 5) + '.', 'Barwert der Überschüsse = ' + E(p.ue * (1 - Math.pow(1 + p.i / 100, -p.n)) / (p.i / 100)) + '.', 'K = ' + E(k) + ' → ' + (k > 0 ? 'vorteilhaft.' : 'nicht vorteilhaft.')] };
  });
  add('iv', 'Interner Zinsfuß bei einer Rückzahlung', 2, (R, C) => {
    const I = C.ri(R, 10, 50) * 1000, n = C.ri(R, 2, 6), f = C.ri(R, 118, 190) / 100, Z = Math.round(I * f / 10) * 10, cf = [-I].concat(Array(n - 1).fill(0), [Z]), r = C.irr(cf);
    return { kind: 'num', text: 'Ein Projekt kostet heute ' + E(I, 0) + ' und zahlt nach ' + n + ' Jahren einmalig ' + E(Z, 0) + ' zurück (sonst keine Zahlungen). Wie hoch ist der interne Zinsfuß? Formel: i = (Rückzahlung : Anschaffung)^(1:n) − 1', asks: [A('i', 'Interner Zinsfuß', '%', r, 0.05)], p: { I, n, Z },
      tips: ['Der interne Zinsfuß ist der Zins, bei dem der Kapitalwert 0 ist: Z : (1+i)ⁿ = I.', 'Stelle um: (1 + i)ⁿ = Z : I. Dann die n-te Wurzel.', 'Z : I = ' + N(Z / I, 4) + '. Ziehe die ' + n + '. Wurzel (Taschenrechner: Potenz 1:' + n + ').'],
      expl: ['Ansatz: ' + E(I, 0) + ' = ' + E(Z, 0) + ' : (1 + i)^' + n + '.', '(1 + i)^' + n + ' = ' + E(Z, 0) + ' : ' + E(I, 0) + ' = ' + N(Z / I, 5) + '.', '1 + i = ' + N(Z / I, 5) + '^(1:' + n + ') = ' + N(Math.pow(Z / I, 1 / n), 5) + ' → i = ' + N(r, 3) + ' %.'] };
  });
  add('iv', 'Interner Zinsfuß per Interpolation', 3, (R, C) => {
    const I = C.ri(R, 10, 30) * 500, n = C.ri(R, 3, 5), p = { I, n, ue: Math.round(I / n * C.ri(R, 122, 140) / 100 / 10) * 10, rest: 0 }, cf = C.reihe(p), t = C.irr(cf), i1 = Math.floor(t) - 1, i2 = i1 + 3, k1 = C.npv(i1 / 100, cf), k2 = C.npv(i2 / 100, cf), x = C.irrInterp(i1, k1, i2, k2);
    return { kind: 'num', text: 'Zahlungsreihe: ' + cfTxt(cf) + '. Der Kapitalwert beträgt bei ' + i1 + ' % ' + E(k1) + ' und bei ' + i2 + ' % ' + E(k2) + '. Schätze den internen Zinsfuß durch lineare Interpolation: i = i₁ − K₁ · (i₂ − i₁) : (K₂ − K₁).', asks: [A('i', 'Interner Zinsfuß (Näherung)', '%', x, 0.05)], p: { cf, i1, i2 },
      tips: ['Zwischen den beiden Zinssätzen wechselt der Kapitalwert das Vorzeichen. Die Nullstelle liegt dazwischen.', 'Gerade durch die beiden Punkte legen und die Nullstelle ablesen: i = i₁ − K₁ · (i₂ − i₁) : (K₂ − K₁).', 'i₂ − i₁ = ' + (i2 - i1) + ' Prozentpunkte, K₂ − K₁ = ' + N(k2 - k1) + ' €.'],
      expl: ['i = ' + i1 + ' − ' + N(k1) + ' · (' + i2 + ' − ' + i1 + ') : (' + N(k2) + ' − ' + N(k1) + ')', 'i = ' + i1 + ' + ' + N(-k1 * (i2 - i1) / (k2 - k1), 4) + ' = ' + N(x, 3) + ' %.', 'Zur Kontrolle liefert das Lab den exakten Wert ' + N(t, 3) + ' %: Die Näherung weicht nur um ' + N(Math.abs(x - t), 3) + ' Prozentpunkte ab.'] };
  });
  add('iv', 'Statische Amortisationsdauer', 2, (R, C) => {
    const g = tries(() => { const I = C.ri(R, 10, 30) * 500, z = [0, 0, 0, 0, 0].map(() => C.ri(R, 20, 45) * 100); return { I, z }; }, o => o.z.reduce((s, x) => s + x, 0) > o.I && o.z[0] < o.I), I = g.I, cf = [-I].concat(g.z), pb = C.payback(cf, 0);
    const ok = pb.ok; return { kind: 'num', text: 'Zahlungsreihe: ' + cfTxt(cf) + '. Nach wie vielen Jahren ist die Anschaffung ohne Zinsen zurückgezahlt? Rechne innerhalb des Jahres mit gleichmäßigem Rückfluss.', asks: [A('t', 'Amortisationsdauer', 'Jahre', ok ? pb.years : 0, 0.02)], p: { cf },
      tips: ['Summiere die Rückflüsse Jahr für Jahr, bis die Anschaffung gedeckt ist.', 'Im Jahr der Deckung: Rest : Rückfluss dieses Jahres = Bruchteil des Jahres.', ok ? 'Nach ' + (pb.year - 1) + ' Jahren sind ' + E(-cf[0] - (cf.slice(1, pb.year).reduce((s, x) => s + x, 0))) + ' noch offen.' : 'Prüfe, ob die Summe der Rückflüsse die Anschaffung überhaupt deckt.'],
      expl: ok ? ['Offen nach ' + (pb.year - 1) + ' Jahren: ' + E(-cf[0]) + ' − ' + E(cf.slice(1, pb.year).reduce((s, x) => s + x, 0)) + ' = ' + E(-cf[0] - cf.slice(1, pb.year).reduce((s, x) => s + x, 0)) + '.', 'Rückfluss im ' + pb.year + '. Jahr: ' + E(cf[pb.year]) + '.', 'Dauer = ' + (pb.year - 1) + ' + ' + E(-cf[0] - cf.slice(1, pb.year).reduce((s, x) => s + x, 0)) + ' : ' + E(cf[pb.year]) + ' = ' + N(pb.years, 3) + ' Jahre.'] : ['Die Rückflüsse decken die Anschaffung nicht.'] };
  });
  add('iv', 'Dynamische Amortisationsdauer', 3, (R, C) => {
    const p = tries(() => { const o = { I: C.ri(R, 10, 30) * 500, n: C.ri(R, 5, 7), i: C.ri(R, 5, 10), ue: 0, rest: 0 }; o.ue = Math.round(o.I / 3 * C.ri(R, 105, 130) / 100 / 10) * 10; return o; }, o => C.payback(C.reihe(o), o.i / 100).ok), cf = C.reihe(p), q = 1 + p.i / 100, pb = C.payback(cf, p.i / 100);
    let cum = cf[0]; const lines = []; for (let t = 1; t <= pb.year; t++) { const z = cf[t] / Math.pow(q, t); lines.push('Jahr ' + t + ': ' + E(cf[t], 0) + ' : ' + N(Math.pow(q, t), 4) + ' = ' + E(z) + ', kumuliert ' + E(cum + z)); cum += z; }
    return { kind: 'num', text: 'Anschaffung ' + E(p.I, 0) + ', jährlicher Überschuss ' + E(p.ue, 0) + ' über ' + p.n + ' Jahre, Kalkulationszins ' + p.i + ' %. Wann sind die abgezinsten Rückflüsse gleich der Anschaffung (dynamische Amortisationsdauer, gleichmäßiger Rückfluss im Jahr)?', asks: [A('t', 'Dynamische Amortisationsdauer', 'Jahre', pb.years, 0.03)], p,
      tips: ['Wie bei der statischen Rechnung, aber jede Zahlung wird vorher auf heute abgezinst.', 'Barwert im Jahr t = Überschuss : (1+i)ᵗ. Summiere, bis die Anschaffung gedeckt ist, im letzten Jahr interpolieren.', 'Der Barwert im ersten Jahr ist ' + E(p.ue / q) + '.'],
      expl: lines.concat(['Deckung im ' + pb.year + '. Jahr. Dauer = ' + (pb.year - 1) + ' + ' + E(-(cum - cf[pb.year] / Math.pow(q, pb.year))) + ' : ' + E(cf[pb.year] / Math.pow(q, pb.year)) + ' = ' + N(pb.years, 3) + ' Jahre.']) };
  });
  add('iv', 'Annuität', 2, (R, C) => {
    const K = C.ri(R, 10, 90) * 1000, i = C.ri(R, 3, 9), n = C.ri(R, 5, 15), a = C.annuitaet(K, i / 100, n), f = C.af(i / 100, n);
    return { kind: 'num', text: 'Ein Betrag von ' + E(K, 0) + ' soll bei ' + i + ' % Zinsen in ' + n + ' gleichen Jahresraten (Zahlung am Jahresende) getilgt werden. Wie hoch ist die Annuität? ' + RULE_NUM, asks: [A('a', 'Annuität', '€', a, rel(a, 0.0005, 0.5))], p: { K, i, n },
      tips: ['Die Annuität ist die gleichbleibende Jahresrate aus Zins und Tilgung.', 'a = K · Annuitätenfaktor, mit AF = i(1+i)ⁿ : ((1+i)ⁿ − 1).', 'Der Annuitätenfaktor für ' + i + ' % und ' + n + ' Jahre ist ' + N(f, 6) + '.'],
      expl: ['(1 + i)^n = ' + N(1 + i / 100, 2) + '^' + n + ' = ' + N(Math.pow(1 + i / 100, n), 5) + '.', 'AF = ' + N(i / 100, 2) + ' · ' + N(Math.pow(1 + i / 100, n), 5) + ' : (' + N(Math.pow(1 + i / 100, n), 5) + ' − 1) = ' + N(f, 6) + '.', 'a = ' + E(K, 0) + ' · ' + N(f, 6) + ' = ' + E(a) + '.'] };
  });
  add('iv', 'Zwei Investitionen: Kapitalwerte', 2, (R, C) => {
    const n = C.ri(R, 3, 5), i = C.ri(R, 5, 9), mk = () => { const I = C.ri(R, 10, 30) * 1000, ue = Math.round(I / n * C.ri(R, 112, 140) / 100 / 10) * 10; return { I, ue, n, rest: 0 }; }, A_ = mk(), B_ = mk(), v = C.vergleich(A_, B_, i);
    return { kind: 'num', text: 'Zwei Anlagen mit gleicher Laufzeit (' + n + ' Jahre), Kalkulationszins ' + i + ' %. A: Anschaffung ' + E(A_.I, 0) + ', Überschuss ' + E(A_.ue, 0) + ' je Jahr. B: Anschaffung ' + E(B_.I, 0) + ', Überschuss ' + E(B_.ue, 0) + ' je Jahr. Berechne beide Kapitalwerte. Welche Anlage ist besser (höherer Kapitalwert)?', asks: [A('ka', 'Kapitalwert A', '€', v.A.npv, IV_TOL(v.A.npv)), A('kb', 'Kapitalwert B', '€', v.B.npv, IV_TOL(v.B.npv))], p: { A: A_, B: B_, i },
      tips: ['Bei gleicher Laufzeit entscheidet der höhere Kapitalwert.', 'Beide Kapitalwerte mit demselben Rentenbarwertfaktor RBF = (1 − (1+i)⁻ⁿ) : i rechnen.', 'Der Rentenbarwertfaktor für ' + i + ' % und ' + n + ' Jahre ist ' + N(C.rbf(i / 100, n), 5) + '. Er gilt für beide Anlagen.'],
      expl: ['RBF = ' + N(C.rbf(i / 100, n), 5) + '.', 'K(A) = ' + E(A_.ue, 0) + ' · ' + N(C.rbf(i / 100, n), 5) + ' − ' + E(A_.I, 0) + ' = ' + E(v.A.npv) + '.', 'K(B) = ' + E(B_.ue, 0) + ' · ' + N(C.rbf(i / 100, n), 5) + ' − ' + E(B_.I, 0) + ' = ' + E(v.B.npv) + '.', 'Besser ist ' + (v.best === 'A' ? 'A' : v.best === 'B' ? 'B' : 'keine (gleich)') + ' (höherer Kapitalwert).'] };
  });
  add('iv', 'Zwei Investitionen mit verschiedener Laufzeit', 3, (R, C) => {
    const i = C.ri(R, 5, 9), vv = tries(() => { const A_ = { I: C.ri(R, 10, 20) * 1000, n: 3, rest: 0, ue: 0 }, B_ = { I: C.ri(R, 20, 40) * 1000, n: 5, rest: 0, ue: 0 }; A_.ue = Math.round(A_.I / 3 * C.ri(R, 118, 140) / 100 / 10) * 10; B_.ue = Math.round(B_.I / 5 * C.ri(R, 125, 160) / 100 / 10) * 10; return { A_, B_, v: C.vergleich(A_, B_, i) }; }, o => Math.abs(o.v.A.ann - o.v.B.ann) > 0.04 * Math.abs(o.v.A.ann) + 1 && o.v.A.npv > 0 && o.v.B.npv > 0), v = vv.v, A_ = vv.A_, B_ = vv.B_;
    return { kind: 'pick', text: 'Zwei Anlagen mit verschiedener Laufzeit, Kalkulationszins ' + i + ' %. A: ' + E(A_.I, 0) + ' Anschaffung, ' + E(A_.ue, 0) + ' Überschuss je Jahr, 3 Jahre. B: ' + E(B_.I, 0) + ' Anschaffung, ' + E(B_.ue, 0) + ' Überschuss je Jahr, 5 Jahre. Beide sollen auf unbestimmte Zeit wiederholt werden. Welche Anlage ist besser?', opts: ['Anlage A', 'Anlage B'], items: [{ t: 'Besser ist:', a: v.best === 'A' ? 0 : 1, why: 'Annuitäten der Kapitalwerte: A ' + E(v.A.ann) + ' je Jahr, B ' + E(v.B.ann) + ' je Jahr. Der höhere jährliche Vorteil gewinnt.' }], p: { A: A_, B: B_, i },
      tips: ['Werden die Anlagen laufend ersetzt, sind die Kapitalwerte wegen der verschiedenen Zeiträume nicht direkt vergleichbar.', 'Rechne den Kapitalwert jeder Anlage in eine gleichbleibende Jahresgröße um: Annuität = K · AF(i, n).', 'K(A) = ' + E(v.A.npv) + ', K(B) = ' + E(v.B.npv) + '. AF(3 Jahre) = ' + N(C.af(i / 100, 3), 5) + ', AF(5 Jahre) = ' + N(C.af(i / 100, 5), 5) + '.'],
      expl: ['K(A) = ' + E(v.A.npv) + ', AF(' + i + ' %, 3 J.) = ' + N(C.af(i / 100, 3), 5) + ' → Annuität ' + E(v.A.ann) + '.', 'K(B) = ' + E(v.B.npv) + ', AF(' + i + ' %, 5 J.) = ' + N(C.af(i / 100, 5), 5) + ' → Annuität ' + E(v.B.ann) + '.', 'Höherer jährlicher Vorteil: Anlage ' + v.best + '.'] };
  });
  add('iv', 'Sensitivität: kritischer Überschuss', 3, (R, C) => {
    const I = C.ri(R, 10, 40) * 500, n = C.ri(R, 4, 8), i = C.ri(R, 5, 10), ue = Math.round(I / n * C.ri(R, 130, 160) / 100 / 10) * 10, p = { I, ue, n, i, rest: 0 }, k = C.kritisch(p), rb = C.rbf(i / 100, n);
    return { kind: 'num', text: 'Anschaffung ' + E(I, 0) + ', geplanter Überschuss ' + E(ue, 0) + ' je Jahr über ' + n + ' Jahre, Kalkulationszins ' + i + ' %. Wie hoch muss der jährliche Überschuss mindestens sein, damit der Kapitalwert nicht negativ wird (kritischer Wert)? Um wie viel Prozent dürfte der geplante Überschuss sinken?', asks: [A('ue', 'Kritischer Überschuss', '€', k.ue, rel(k.ue, 0.0005, 0.5)), A('pct', 'zulässiger Rückgang', '%', (1 - k.ue / ue) * 100, 0.2)], p,
      tips: ['Kritisch heißt: Kapitalwert gerade 0. Dann gilt: Überschuss · RBF = Anschaffung.', 'Kritischer Überschuss = Anschaffung : RBF, mit RBF = (1 − (1+i)⁻ⁿ) : i.', 'RBF = ' + N(rb, 5) + '. Den zulässigen Rückgang erhältst du aus 1 − kritischer Überschuss : geplanter Überschuss.'],
      expl: ['RBF = ' + N(rb, 5) + '.', 'Kritischer Überschuss = ' + E(I, 0) + ' : ' + N(rb, 5) + ' = ' + E(k.ue) + '.', 'Rückgang = 1 − ' + E(k.ue) + ' : ' + E(ue, 0) + ' = ' + N((1 - k.ue / ue) * 100, 2) + ' %. So viel Sicherheit hat die Planung.'] };
  });
  add('iv', 'Sensitivität: Zinsänderung', 3, (R, C) => {
    const I = C.ri(R, 10, 40) * 500, n = C.ri(R, 4, 8), i = C.ri(R, 4, 8), ue = Math.round(I / n * C.ri(R, 125, 150) / 100 / 10) * 10, p = { I, ue, n, i, rest: 0 }, d = C.ri(R, 2, 4), k0 = C.sens(p, 'i', 0), k1 = C.sens(p, 'i', d);
    return { kind: 'num', text: 'Anschaffung ' + E(I, 0) + ', Überschuss ' + E(ue, 0) + ' je Jahr über ' + n + ' Jahre. Bei ' + i + ' % Kalkulationszins ist der Kapitalwert ' + E(k0) + '. Wie hoch ist der Kapitalwert, wenn der Zins um ' + d + ' Prozentpunkte auf ' + (i + d) + ' % steigt?', asks: [A('k', 'Kapitalwert bei ' + (i + d) + ' %', '€', k1, IV_TOL(k1))], p: Object.assign({ d }, p),
      tips: ['Ein höherer Zins entwertet spätere Zahlungen stärker. Der Kapitalwert sinkt.', 'Rechne den Kapitalwert komplett neu mit dem neuen Zins: K = Überschuss · RBF − Anschaffung.', 'RBF für ' + (i + d) + ' %: ' + N(C.rbf((i + d) / 100, n), 5) + '.'],
      expl: ['RBF(' + (i + d) + ' %, ' + n + ' J.) = ' + N(C.rbf((i + d) / 100, n), 5) + '.', 'K = ' + E(ue, 0) + ' · ' + N(C.rbf((i + d) / 100, n), 5) + ' − ' + E(I, 0) + ' = ' + E(k1) + '.', 'Änderung gegenüber ' + E(k0) + ': ' + E(k1 - k0) + '.'] };
  });

  /* ---------------- Risiko ---------------- */
  const CLS_BANDS = 'Klassen: gering ≤ 4, mittel 5 bis 9, hoch 10 bis 15, kritisch ≥ 16.';
  add('rq', 'Risikozahl', 1, (R, C) => {
    const pp = C.ri(R, 1, 5), s = C.ri(R, 1, 5), z = C.riskScore(pp, s);
    return { kind: 'num', text: 'Ein Lieferverzug hat die Eintrittswahrscheinlichkeit P = ' + pp + ' (von 5) und das Schadensausmaß S = ' + s + ' (von 5). Wie hoch ist die Risikozahl?', asks: [A('z', 'Risikozahl', '', z, 0)], p: { p: pp, s },
      tips: ['Risiko hat zwei Seiten: wie wahrscheinlich und wie schlimm.', 'Risikozahl = P · S.', 'Rechne ' + pp + ' mal ' + s + '.'], expl: ['Risikozahl = P · S = ' + pp + ' · ' + s + ' = ' + z + '.'] };
  });
  add('rq', 'Risikoklasse', 1, (R, C) => {
    const pp = C.ri(R, 1, 5), s = C.ri(R, 1, 5), z = C.riskScore(pp, s), cl = C.riskClass(z), ids = C.RISK_CLASSES.map(c => c.id);
    return { kind: 'pick', text: 'Ein Risiko hat P = ' + pp + ' und S = ' + s + '. ' + CLS_BANDS + ' In welche Klasse gehört es?', opts: ['gering', 'mittel', 'hoch', 'kritisch'], items: [{ t: 'Klasse:', a: ids.indexOf(cl.id), why: 'Risikozahl ' + pp + ' · ' + s + ' = ' + z + ' → ' + cl.name + '.' }], p: { p: pp, s },
      tips: ['Zuerst die Risikozahl berechnen.', 'Dann die Zahl in die Klassen einordnen. ' + CLS_BANDS, 'Risikozahl = P · S = ' + z + '.'], expl: ['Risikozahl = ' + pp + ' · ' + s + ' = ' + z + '.', CLS_BANDS, 'Einordnung: ' + cl.name + '.'] };
  });
  add('rq', 'Erwartungswert eines Schadens', 2, (R, C) => {
    const pp = C.pick(R, [5, 10, 15, 20, 25, 30, 40]), L = C.ri(R, 4, 80) * 1000, ev = C.erwartung(pp, L);
    return { kind: 'num', text: 'Mit einer Wahrscheinlichkeit von ' + pp + ' % fällt ein Prüfplatz aus. Der Schaden wäre ' + E(L, 0) + '. Wie hoch ist der Erwartungswert des Schadens?', asks: [A('ev', 'Erwartungswert', '€', ev, 0.5)], p: { pp, L },
      tips: ['Der Erwartungswert ist ein Durchschnitt über viele gleiche Projekte: Wahrscheinlichkeit mal Schaden.', 'EW = P · Schaden, mit P als Dezimalzahl.', pp + ' % entsprechen als Dezimalzahl ' + N(pp / 100, 2) + '. Multipliziere sie mit dem Schaden.'], expl: ['EW = ' + N(pp / 100, 2) + ' · ' + E(L, 0) + ' = ' + E(ev) + '.'] };
  });
  add('rq', 'Risikoreserve', 3, (R, C) => {
    const L = [0, 1, 2].map(() => [C.pick(R, [5, 10, 15, 20, 30]), C.ri(R, 3, 40) * 1000]), r = C.reserve(L);
    return { kind: 'num', text: 'Drei Projektrisiken: ' + L.map((x, i) => (i + 1) + ') P = ' + x[0] + ' %, Schaden ' + E(x[1], 0)).join('; ') + '. Welche Reserve (Summe der Erwartungswerte) sollte eingeplant werden?', asks: [A('r', 'Reserve', '€', r, 1)], p: { L },
      tips: ['Jedes Risiko hat einen Erwartungswert. Die Reserve ist ihre Summe.', 'EW = P · Schaden je Risiko, danach addieren.', 'Einzelwerte: ' + L.map(x => E(C.erwartung(x[0], x[1]), 0)).join(', ') + '.'], expl: L.map((x, i) => 'Risiko ' + (i + 1) + ': ' + N(x[0] / 100, 2) + ' · ' + E(x[1], 0) + ' = ' + E(C.erwartung(x[0], x[1]))).concat(['Reserve = ' + E(r) + '. (Die Reserve deckt im Durchschnitt, nicht den schlimmsten Fall.)']) };
  });
  add('rq', 'Risikoprioritätszahl (FMEA)', 2, (R, C) => {
    const b = C.ri(R, 3, 10), a = C.ri(R, 2, 8), e = C.ri(R, 2, 9), z = C.rpz(b, a, e);
    return { kind: 'num', text: 'Eine Fehlerart wird bewertet: Bedeutung B = ' + b + ', Auftreten A = ' + a + ', Entdeckung E = ' + e + ' (jeweils 1 bis 10, bei E bedeutet 10 „kaum zu entdecken“). Wie hoch ist die RPZ?', asks: [A('rpz', 'RPZ', '', z, 0)], p: { b, a, e },
      tips: ['Drei Bewertungen: wie schlimm, wie oft, wie schwer zu entdecken.', 'RPZ = B · A · E.', 'Rechne ' + b + ' · ' + a + ' = ' + (b * a) + ', dann mal ' + e + '.'], expl: ['RPZ = ' + b + ' · ' + a + ' · ' + e + ' = ' + z + '.'] };
  });
  add('rq', 'RPZ nach der Maßnahme', 3, (R, C) => {
    const b = C.ri(R, 6, 10), a = C.ri(R, 4, 8), e = C.ri(R, 5, 9), a2 = C.ri(R, 2, a - 1), e2 = C.ri(R, 2, e - 1), z0 = C.rpz(b, a, e), z1 = C.rpz(b, a2, e2);
    return { kind: 'num', text: 'Vorher: B = ' + b + ', A = ' + a + ', E = ' + e + '. Durch eine Maßnahme (bessere Prüfung und Montagehilfe) sinken A auf ' + a2 + ' und E auf ' + e2 + ' (B bleibt). Wie hoch ist die neue RPZ, und um wie viel Prozent sinkt sie?', asks: [A('rpz', 'Neue RPZ', '', z1, 0), A('pct', 'Rückgang', '%', (1 - z1 / z0) * 100, 0.2)], p: { b, a, e, a2, e2 },
      tips: ['Berechne beide RPZ mit der gleichen Formel. Die Bedeutung ändert sich durch Prüfen nicht.', 'Rückgang in % = (alt − neu) : alt.', 'Alte RPZ = ' + z0 + '.'], expl: ['Alt: ' + b + ' · ' + a + ' · ' + e + ' = ' + z0 + '.', 'Neu: ' + b + ' · ' + a2 + ' · ' + e2 + ' = ' + z1 + '.', 'Rückgang = (' + z0 + ' − ' + z1 + ') : ' + z0 + ' = ' + N((1 - z1 / z0) * 100, 2) + ' %.'] };
  });
  add('rq', 'Priorisieren nach RPZ', 2, (R, C) => {
    const names = C.shuffle(R, ['Kaltlötstelle', 'Falsche Firmware', 'Steckerkontakt lose', 'Sensor driftet', 'Gehäuse undicht']).slice(0, 3);
    const items = tries(() => names.map(n => ({ name: n, b: C.ri(R, 3, 10), a: C.ri(R, 2, 8), e: C.ri(R, 2, 9) })), L => { const z = L.map(x => C.rpz(x.b, x.a, x.e)).sort((x, y) => y - x); return z[0] > z[1]; }), f = C.fmea(items, 100), top = f[0];
    return { kind: 'pick', text: 'Drei Fehlerarten: ' + items.map(x => x.name + ' (B ' + x.b + ', A ' + x.a + ', E ' + x.e + ')').join('; ') + '. Welche wird nach der RPZ zuerst bearbeitet?', opts: names, items: [{ t: 'Zuerst bearbeiten:', a: names.indexOf(top.name), why: 'RPZ: ' + items.map(x => x.name + ' ' + C.rpz(x.b, x.a, x.e)).join(', ') + '. Die höchste RPZ hat ' + top.name + '.' }], p: { items },
      tips: ['Jede Fehlerart bekommt eine RPZ. Die größte kommt zuerst.', 'RPZ = B · A · E für alle drei.', 'Die RPZ-Werte liegen zwischen ' + Math.min.apply(null, f.map(x => x.rpz)) + ' und ' + f[0].rpz + '.'], expl: items.map(x => x.name + ': ' + x.b + ' · ' + x.a + ' · ' + x.e + ' = ' + C.rpz(x.b, x.a, x.e)).concat(['Höchste RPZ: ' + top.name + ' (' + top.rpz + ').', 'Hinweis: In der Praxis prüft man außerdem Fehlerarten mit sehr hoher Bedeutung B (9 oder 10) auch bei kleiner RPZ.']) };
  });
  const paretoSet = R => { const k = C.ri(R, 5, 6), base = C.shuffle(R, ['Lötfehler', 'Falsches Bauteil', 'Firmware', 'Gehäuse', 'Bedienfehler', 'Verpackung']).slice(0, k); const v = base.map((_, i) => Math.round(C.ri(R, 4, 12) * Math.pow(1.9, k - 1 - i))); return base.map((l, i) => ({ label: l, v: v[i] })); };
  add('rq', 'Pareto: kumulierter Anteil', 2, (R, C) => {
    const it = paretoSet(R), p = C.pareto(it), top2 = p.items[1].cum;
    return { kind: 'num', text: 'Fehlerhäufigkeiten in einer Woche: ' + it.map(x => x.label + ' ' + x.v).join(', ') + '. Wie viel Prozent aller Fehler machen die zwei häufigsten Ursachen zusammen aus?', asks: [A('c', 'Anteil der zwei häufigsten', '%', top2, 0.2)], p: { it },
      tips: ['Sortiere die Ursachen absteigend nach Häufigkeit.', 'Addiere die zwei größten Werte und teile durch die Gesamtsumme.', 'Die Gesamtsumme aller Fehler ist ' + p.total + '.'], expl: ['Gesamtsumme = ' + p.total + '. Sortiert: ' + p.items.map(x => x.label + ' ' + x.v).join(', ') + '.', 'Zwei häufigste: ' + p.items[0].v + ' + ' + p.items[1].v + ' = ' + (p.items[0].v + p.items[1].v) + '.', 'Anteil = ' + (p.items[0].v + p.items[1].v) + ' : ' + p.total + ' = ' + N(top2, 2) + ' %.'] };
  });
  add('rq', 'Pareto: Wie viele Ursachen sind Klasse A?', 3, (R, C) => {
    const it = paretoSet(R), p = C.pareto(it);
    return { kind: 'num', text: 'Fehlerhäufigkeiten: ' + it.map(x => x.label + ' ' + x.v).join(', ') + '. Zu Klasse A zählen die häufigsten Ursachen, solange der kumulierte Anteil VOR der Ursache unter 80 % liegt. Wie viele Ursachen sind Klasse A?', asks: [A('n', 'Anzahl Klasse A', '', p.nA, 0)], p: { it },
      tips: ['Sortiere absteigend, bilde die kumulierten Anteile.', 'Eine Ursache gehört zu A, wenn der Anteil der Ursachen davor noch unter 80 % liegt (die Ursache, die die 80 % überschreitet, zählt noch dazu).', 'Kumulierte Anteile: ' + p.items.map(x => N(x.cum, 1) + ' %').join(', ') + '.'], expl: p.items.map(x => x.label + ': ' + x.v + ' → kumuliert ' + N(x.cum, 1) + ' % → Klasse ' + x.cls).concat(['Klasse A: ' + p.nA + ' Ursachen.']) };
  });
  add('rq', 'Risikomatrix lesen', 2, (R, C) => {
    const names = C.shuffle(R, ['Lieferverzug', 'Datenverlust', 'Personalausfall', 'Terminverzug', 'Normänderung', 'Kalibrierfehler']).slice(0, 4), items = names.map(n => { const pp = C.ri(R, 1, 5), s = C.ri(R, 1, 5), z = C.riskScore(pp, s), hi = z >= 10; return { t: n + ' (P ' + pp + ', S ' + s + ')', a: hi ? 0 : 1, why: 'Risikozahl ' + pp + ' · ' + s + ' = ' + z + ' → ' + C.riskClass(z).name + '.', p: pp, s }; });
    return { kind: 'pick', text: 'Welche Risiken müssen aktiv bearbeitet werden, weil sie „hoch“ oder „kritisch“ sind (Risikozahl ≥ 10)? ' + CLS_BANDS, opts: ['ja, ab Klasse hoch', 'nein, darunter'], items, p: { items },
      tips: ['Berechne für jedes Risiko P · S.', 'Ab 10 ist ein Risiko „hoch“, ab 16 „kritisch“.', 'Beispiel: P 3 und S 4 ergibt 12, das ist hoch.'], expl: ['Risikozahl = P · S, dann einordnen: ' + CLS_BANDS] };
  });

  /* ---------------- Praxisbericht ---------------- */
  const CH = {
    'Einleitung': ['Warum das Projekt durchgeführt wurde und welches Ziel gilt', 'Kurzer Überblick, wie der Bericht aufgebaut ist', 'Abgrenzung: Was das Projekt ausdrücklich nicht umfasst'],
    'Grundlagen und Ausgangslage': ['Beschreibung des Ist-Zustands vor Projektbeginn', 'Erklärung eines benutzten Verfahrens (z. B. Kapitalwertmethode) in eigenen Worten', 'Kurze Vorstellung des Betriebsbereichs'],
    'Planung': ['Zeitplan als Netzplan oder Gantt-Diagramm', 'Auswahl und Begründung der Lösung durch einen Variantenvergleich', 'Kostenplan mit Stundensätzen und Materialkosten'],
    'Durchführung': ['Aufbau, Programmierung und Inbetriebnahme in einzelnen Schritten', 'Aufgetretene Probleme und wie sie gelöst wurden', 'Beschreibung, wie die Messungen durchgeführt wurden'],
    'Ergebnisse und Bewertung': ['Gemessene Werte im Vergleich zu den Zielwerten', 'Soll-Ist-Vergleich der Kosten', 'Wirtschaftlichkeitsrechnung mit Ergebnis und Entscheidung'],
    'Fazit und Ausblick': ['Eigene Bewertung: Was lief gut, was nicht', 'Vorschläge für die Weiterentwicklung', 'Zusammenfassung der wichtigsten Ergebnisse in wenigen Sätzen'],
    'Anhang': ['Vollständiger Schaltplan im Format A3', 'Rohdaten der Messreihe mit mehreren hundert Zeilen', 'Datenblätter der verwendeten Bauteile']
  };
  const chapterTask = (R, chaps, nEach) => { const items = []; chaps.forEach(c => C.shuffle(R, CH[c]).slice(0, nEach).forEach(t => items.push({ t, a: PB_CH7.indexOf(c), why: 'Gehört in „' + c + '“.' }))); return items; };
  add('pb', 'Was gehört in welches Kapitel? (1)', 1, (R, C) => Object.assign({ kind: 'pick', text: 'Ordne jeden Inhalt dem Kapitel zu, in dem er zuerst steht.', tips: ['Überlege, wann im Projekt die Sache passiert: vorher (Planung), währenddessen (Durchführung) oder danach (Ergebnisse).', 'Ziele und Aufbau stehen vorn, Bewertung und Ausblick am Ende, Umfangreiches (Rohdaten, Pläne) im Anhang.', 'Ergebnisse vergleichen mit Zielen (Ergebnisse und Bewertung). Wie gearbeitet wurde: Durchführung.'], expl: ['Gliederung: Einleitung · Grundlagen und Ausgangslage · Planung · Durchführung · Ergebnisse und Bewertung · Fazit und Ausblick · Anhang.'] }, { opts: PB_CH7, items: C.shuffle(R, chapterTask(R, C.shuffle(R, ['Einleitung', 'Planung', 'Durchführung', 'Fazit und Ausblick', 'Anhang']).slice(0, 4), 1)) }, { p: {} }));
  add('pb', 'Was gehört in welches Kapitel? (2)', 3, (R, C) => Object.assign({ kind: 'pick', text: 'Einige Inhalte liegen dicht beieinander. Entscheide, wo sie hingehören.', tips: ['Auswertung und Vergleich stehen im Hauptteil, die Rohdaten dahinter im Anhang.', 'Was vor dem Bau entschieden wird (Plan, Variante, Kosten) gehört in die Planung, was nachher gerechnet und verglichen wird in die Ergebnisse.', 'Verfahren erklären gehört in die Grundlagen, Verfahren anwenden in Planung oder Ergebnisse.'], expl: ['Die Grenzen sind fließend: Entscheidend ist, dass der Leser Plan, Umsetzung und Ergebnis auseinanderhalten kann.'] }, { opts: PB_CH7, items: C.shuffle(R, chapterTask(R, ['Grundlagen und Ausgangslage', 'Planung', 'Ergebnisse und Bewertung', 'Anhang', 'Durchführung'], 1)) }, { p: {} }));
  const ABB = [
    { t: 'Jede Abbildung bekommt eine fortlaufende Nummer und eine Beschriftung.', a: 0, why: 'Nur so kann man sie im Text eindeutig benennen.' },
    { t: 'Im Text wird auf jede Abbildung verwiesen und erklärt, was sie zeigt.', a: 0, why: 'Eine Abbildung ohne Verweis hängt im Raum.' },
    { t: 'Eine Abbildung aus fremder Quelle braucht eine Quellenangabe.', a: 0, why: 'Auch Bilder sind geistiges Eigentum und werden belegt.' },
    { t: 'Abbildungen dürfen ohne Beschriftung stehen, wenn sie selbsterklärend wirken.', a: 1, why: 'Beschriftung und Nummer gehören immer dazu.' },
    { t: 'Die Beschriftung soll ohne den Fließtext verständlich sein.', a: 0, why: 'Der Leser blättert oft zuerst durch die Bilder.' },
    { t: 'Die Nummerierung darf zwischen den Kapiteln beliebig springen.', a: 1, why: 'Fortlaufend (oder kapitelweise geordnet), aber ohne Lücken oder Wiederholungen.' },
    { t: 'Eigene Zeichnungen werden als „eigene Darstellung“ gekennzeichnet.', a: 0, why: 'So ist klar, dass keine fremde Quelle fehlt.' }
  ];
  add('pb', 'Abbildungen und Tabellen', 1, (R, C) => Object.assign({ kind: 'pick', text: 'Stimmt die Regel für Abbildungen und Tabellen im Praxisbericht? (Vorgaben der Schule oder Hochschule gehen im Zweifel vor.)', tips: ['Der Leser muss jede Abbildung finden, benennen und verstehen können.', 'Nummer, Beschriftung, Verweis im Text, bei fremden Bildern Quelle.', 'Beliebigkeit ist bei Nummern und Beschriftung nie richtig.'], expl: ['Jede Abbildung: Nummer + Beschriftung + Verweis im Text. Fremde Quelle: belegen. Eigene: „eigene Darstellung“.'] }, { opts: ['stimmt', 'stimmt nicht'], items: C.shuffle(R, ABB).slice(0, 5) }, { p: {} }));
  const QU = [
    { t: 'Ein wörtliches Zitat steht in Anführungszeichen und hat eine Seitenangabe.', a: 0, why: 'Nur so erkennt man die Übernahme und kann sie nachschlagen.' },
    { t: 'Sinngemäß übernommene Gedanken brauchen keine Quellenangabe, wenn man sie umformuliert hat.', a: 1, why: 'Der Gedanke gehört der Quelle, nicht nur die Wörter. Beleg mit „vgl.“.' },
    { t: 'Jede im Text zitierte Quelle steht im Quellenverzeichnis.', a: 0, why: 'Kurzbeleg und Verzeichnis gehören zusammen.' },
    { t: 'Im Quellenverzeichnis stehen auch Werke, die nie im Text benutzt wurden, damit die Liste länger wirkt.', a: 1, why: 'Nur wirklich benutzte Quellen gehören ins Verzeichnis.' },
    { t: 'Internetquellen werden mit Adresse und Abrufdatum angegeben.', a: 0, why: 'Webseiten ändern sich. Das Abrufdatum hält den Stand fest.' },
    { t: 'Datenblätter und Normen sind Quellen und werden belegt.', a: 0, why: 'Alles Fremde, das du benutzt, braucht einen Beleg.' },
    { t: 'Eigene Messergebnisse brauchen keine Quellenangabe, aber eine Beschreibung der Messbedingungen.', a: 0, why: 'Eigene Leistung wird beschrieben, nicht zitiert. Ohne Bedingungen ist sie nicht nachvollziehbar.' }
  ];
  add('pb', 'Quellen und Zitate', 2, (R, C) => Object.assign({ kind: 'pick', text: 'Stimmt die Aussage über Zitate und Quellen?', tips: ['Alles Fremde braucht einen Beleg, auch wenn es umformuliert wurde.', 'Kurzbeleg im Text, Eintrag im Verzeichnis, beides abgleichen.', 'Eigene Arbeit beschreibst du, du zitierst sie nicht.'], expl: ['Wörtlich: Anführungszeichen und Seite. Sinngemäß: „vgl.“. Verzeichnis: nur Benutztes, aber alles Benutzte.'] }, { opts: ['stimmt', 'stimmt nicht'], items: C.shuffle(R, QU).slice(0, 5) }, { p: {} }));
  add('pb', 'Wörtlich, sinngemäß oder ohne Beleg?', 2, (R, C) => {
    const O = ['wörtliches Zitat', 'sinngemäßes Zitat (vgl.)', 'eigene Leistung, kein Zitat'], all = [
      { t: 'Ein Satz aus einem Datenblatt wird Zeichen für Zeichen übernommen.', a: 0, why: 'Zeichengenaue Übernahme: Anführungszeichen, Quelle, Seite.' },
      { t: 'Der Inhalt eines Absatzes aus einer Norm wird mit eigenen Worten zusammengefasst.', a: 1, why: 'Fremder Gedanke, eigene Worte: Beleg mit „vgl.“.' },
      { t: 'Du beschreibst deine eigene Messreihe und die Bedingungen.', a: 2, why: 'Eigene Leistung. Wichtig sind nur die Messbedingungen.' },
      { t: 'Ein Rechenschema aus einem Fachbuch wird mit eigenen Zahlen neu aufgebaut. Idee und Aufbau stammen aus dem Buch.', a: 1, why: 'Die Idee ist fremd: Mit „vgl.“ oder „in Anlehnung an“ belegen.' },
      { t: 'Ein Satz einer Webseite wird unverändert in den Bericht kopiert.', a: 0, why: 'Wörtlich: Anführungszeichen und genaue Quelle mit Abrufdatum.' },
      { t: 'Du zeichnest einen eigenen Netzplan für dein Projekt.', a: 2, why: 'Eigene Leistung; als „eigene Darstellung“ kennzeichnen.' }];
    return Object.assign({ kind: 'pick', text: 'Welche Behandlung verlangt die Stelle im Bericht?', tips: ['Frage: Kommt die Idee von dir oder aus einer Quelle? Und stehen die Wörter genau so in der Quelle?', 'Identische Wörter: wörtlich. Fremde Idee, eigene Worte: sinngemäß. Eigene Arbeit: beschreiben.', 'Auch bei Zusammenfassungen bleibt der Gedanke fremd.'], expl: ['Wörtlich = zeichengenau übernommen. Sinngemäß = fremder Gedanke in eigenen Worten. Eigene Leistung = beschreiben, nicht zitieren.'] }, { opts: O, items: C.shuffle(R, all).slice(0, 4) }, { p: {} });
  });
  add('pb', 'Seitenbudget: Anteil in Seiten', 1, (R, C) => {
    const total = C.pick(R, [24, 30, 36, 40, 48]), ch = Math.floor(R() * PB_CHAPTERS.length), w = PB_CHAPTERS.map(c => c.w), s = C.seiten(total, w), sh = s.shares[ch];
    return { kind: 'num', text: 'Der Bericht soll ' + total + ' Seiten (ohne Anhang) umfassen. Das Kapitel „' + PB_CHAPTERS[ch].n + '“ soll ' + PB_CHAPTERS[ch].w + ' % des Umfangs bekommen. Wie viele Seiten sind das?', asks: [A('s', 'Seiten', 'Seiten', s.exact[ch], 0.06)], p: { total, w: PB_CHAPTERS[ch].w },
      tips: ['Prozent eines Ganzen: Anteil mal Gesamtumfang.', 'Seiten = Gesamtseiten · Anteil : 100.', 'Rechne ' + total + ' Seiten mal ' + N(PB_CHAPTERS[ch].w / 100, 2) + '.'], expl: ['Seiten = ' + total + ' · ' + PB_CHAPTERS[ch].w + ' : 100 = ' + N(s.exact[ch], 3) + ' Seiten.', 'Praktisch rundet man auf ganze Seiten (hier ' + s.whole[ch] + '), wobei die Summe aller Kapitel wieder ' + total + ' ergeben muss.'] };
  });
  add('pb', 'Seitenbudget: Anteil in Prozent', 2, (R, C) => {
    const total = C.pick(R, [20, 25, 30, 40, 50]), pg = C.ri(R, 2, Math.floor(total / 2)), pc = pg / total * 100;
    return { kind: 'num', text: 'Von ' + total + ' Seiten im Bericht entfallen ' + pg + ' Seiten auf das Kapitel „Planung“. Wie viel Prozent des Berichts sind das?', asks: [A('p', 'Anteil', '%', pc, 0.1)], p: { total, pg },
      tips: ['Anteil = Teil : Ganzes.', 'Prozent = Seiten des Kapitels : Gesamtseiten · 100.', 'Rechne ' + pg + ' : ' + total + ' = ' + N(pg / total, 4) + ' und dann mal 100.'], expl: ['Anteil = ' + pg + ' : ' + total + ' = ' + N(pg / total, 4) + ' = ' + N(pc, 2) + ' %.'] };
  });
  add('pb', 'Welche Gliederung ist sinnvoll?', 2, (R, C) => {
    const good = '1 Einleitung · 2 Grundlagen · 3 Planung · 4 Durchführung · 5 Ergebnisse · 6 Fazit', bad = ['1 Fazit · 2 Einleitung · 3 Durchführung · 4 Ergebnisse', '1 Durchführung · 2 Planung · 3 Einleitung · 4 Ergebnisse · 5 Fazit', '1 Einleitung · 2 Ergebnisse · 3 Planung · 4 Durchführung · 5 Fazit'], all = C.shuffle(R, [good].concat(bad)), a = all.indexOf(good);
    return { kind: 'pick', text: 'Welche Gliederung folgt dem Ablauf eines Projekts und ist für einen Praxisbericht sinnvoll?', opts: all, items: [{ t: 'Sinnvolle Gliederung:', a, why: 'Der Bericht folgt dem Projekt: Ziel → Grundlagen → Planung → Umsetzung → Ergebnis → Bewertung. In den anderen Fassungen stehen Kapitel vor dem, wovon sie handeln.' }], p: {},
      tips: ['Ein Bericht folgt dem zeitlichen Ablauf des Projekts.', 'Zuerst Ziel und Ausgangslage, dann Planung, dann Umsetzung, dann Ergebnisse, zuletzt Bewertung.', 'Streiche alle Fassungen, in denen das Fazit nicht am Ende steht oder die Ergebnisse vor der Durchführung kommen.'], expl: ['Richtig: ' + good + '. Fazit am Ende, Ergebnisse nach der Durchführung, Einleitung vorn.'] };
  });
  add('pb', 'Formaler Fehler oder in Ordnung?', 1, (R, C) => {
    const all = [
      { t: 'Im ganzen Dokument fehlen die Seitenzahlen.', a: 0, why: 'Ohne Seitenzahlen kann das Inhaltsverzeichnis nicht stimmen.' },
      { t: 'Das Inhaltsverzeichnis nennt andere Überschriften als im Text stehen.', a: 0, why: 'Verzeichnis und Text müssen übereinstimmen.' },
      { t: 'Alle Abbildungen sind nummeriert, beschriftet und im Text erwähnt.', a: 1, why: 'Das ist die geforderte Form.' },
      { t: 'Schriftart und Überschriftenstufen sind im ganzen Bericht einheitlich.', a: 1, why: 'Einheitlichkeit ist erwünscht.' },
      { t: 'Ein wörtliches Zitat steht ohne Anführungszeichen und ohne Seitenzahl im Text.', a: 0, why: 'Wörtliche Zitate brauchen Anführungszeichen und Seitenzahl.' },
      { t: 'Eine im Text zitierte Quelle fehlt im Quellenverzeichnis.', a: 0, why: 'Jede zitierte Quelle gehört ins Verzeichnis.' },
      { t: 'Rohdaten der Messreihe stehen im Anhang, im Text nur das Diagramm.', a: 1, why: 'So ist es üblich: Auswertung im Haupttext, Rohdaten im Anhang.' }];
    return Object.assign({ kind: 'pick', text: 'Ist das ein formaler Fehler, den du vor der Abgabe beseitigen musst?', tips: ['Gehe die Checkliste Form und Quellen durch.', 'Fehler sind: fehlende Seitenzahlen, abweichende Verzeichnisse, fehlende Belege.', 'In Ordnung sind: Einheitlichkeit, Verweise, Rohdaten im Anhang.'], expl: ['Vor der Abgabe: Form (Seitenzahlen, Verzeichnisse, Nummerierung), Quellen (Beleg und Verzeichnis), Anhang.'] }, { opts: ['Fehler', 'in Ordnung'], items: C.shuffle(R, all).slice(0, 5) }, { p: {} });
  });

  const CATS = BLOCKS.map(b => b.id);
  const TASKLIST = tasks.map(t => ({ id: t.id, cat: t.blk, title: t.title, level: t.level }));
  const DATA = { meta: META, BLOCKS, EXPLAIN, LH_GLIED, LH_PH_STATEMENTS, LH_CHECK, LH_IMPROVE, LH_ABNAHME, LH_TRUE, LH_MSK, NET_PRESETS, NETS, INV_PRESET, RISK_PRESET, FMEA_PRESET, PARETO_PRESET, PB_CHAPTERS, PB_CH7, PB_CHECK, PB_RULES, CH, ABB, QU, tasks, CATS };
  root.PRJ_DATA = DATA; root.PRJ_TASKS = TASKLIST;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
