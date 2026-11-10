'use strict';
/* Tonfunk Schaltschrank-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Layout-Szenarien, Beispiele).
   ALLE Größen, Verlustleistungen, Reserven und Zuordnungstabellen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Planung echter Anlagen.
   window.SSL_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, scenarios, evaluate, solAns, pools }
   window.SSL_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'ssl', Status in localStorage 'lm4.ssl.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Frageformen (q.ask.type): 'choice' (Auswahl), 'num' (Zahl), 'order' (Reihenfolge), 'match' (Zuordnung), 'layout' (Schaltschrank-Layout ordnen, Prüfung durch checkLayout).
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch die Fehlerursache (neutrale Titel, die Fehlersuchen heißen "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, Reihenfolgen werden gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.SSL_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Schutzorgane wählen', 'Strom und Querschnitt', 'Netzteil und Wärme', 'Layout im Schrank', 'Verdrahtung und Klemmen', 'Prüfen vor Inbetriebnahme', 'Fehlersuche'];

  /* ---------- Frageformen ---------- */
  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  /* Reihenfolge: items in der RICHTIGEN Reihenfolge übergeben; sie werden gemischt (nie schon richtig sortiert) */
  function orderQ(R, text, items, expl, tips) {
    let idx = items.map((_, i) => i), sh = idx, tries = 0;
    do { sh = C().shuffle(R, idx); tries++; } while (sh.every((v, i) => v === i) && tries < 20);
    return { text, ask: { type: 'order', items: sh.map(i => items[i]), correct: items.map((_, k) => sh.indexOf(k)) }, value: 0, tol: 0, expl, tips };
  }
  /* Zuordnung: rows[i] bekommt options[corr[i]]; die Optionen werden gemischt */
  function matchQ(R, text, rows, options, corr, expl, tips) {
    const sh = C().shuffle(R, options.map((_, i) => i));
    return { text, ask: { type: 'match', rows, options: sh.map(i => options[i]), correct: corr.map(c => sh.indexOf(c)) }, value: 0, tol: 0, expl, tips };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const cnt = (n, s, p) => n + ' ' + (n === 1 ? s : p);

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P17: RCD-Aussagen (30 mA Personenschutz, 300 mA Brandschutz, Typ S selektiv, FI ersetzt keinen LS) sind vereinfacht und in eigenen Worten. Passen die Werte und die Darstellung zum Lehrmaterial? */
  const RDQ = [
    ['Welcher Bemessungsdifferenzstrom ist für den zusätzlichen Schutz von Steckdosen üblich, an denen Laien Geräte anschließen?', '30 mA', ['10 mA', '100 mA', '300 mA'], 'Ein RCD mit 30 mA löst weit unterhalb dessen aus, was für den Körper gefährlich wird. 300 mA und mehr dienen eher dem Brandschutz.', ['Es geht um den Schutz von Personen bei direktem Berühren.', 'Es ist der kleinste Wert der Auswahl.']],
    ['Wofür wird ein RCD mit 300 mA Bemessungsdifferenzstrom hauptsächlich eingesetzt?', 'Vorbeugender Brandschutz bei Fehlerströmen', ['Personenschutz an Steckdosen im Badezimmer', 'Schutz der Leitung vor Überlast im Abgang', 'Schutz eines Motors vor Überlast im Betrieb'], 'Fehlerströme in dieser Größe können Isolationen erhitzen und Brände auslösen. Für Personen sind 30 mA gedacht, Überlast erkennt ein RCD gar nicht.', ['Ein hoher Fehlerstrom kann Wärme erzeugen.', 'Personen schützt man mit dem kleineren Wert.']],
    ['Wie erkennt ein RCD, dass ein Fehler vorliegt?', 'Er vergleicht Hin- und Rückstrom und erkennt eine Differenz', ['Er misst den Spannungsabfall an der Zuleitung und bewertet ihn', 'Er löst aus, sobald der Strom den Bemessungswert überschreitet', 'Er misst die Leitungstemperatur und schaltet bei Erwärmung ab'], 'Im Normalbetrieb fließt der gleiche Strom hin und zurück. Fließt ein Teil über Erde (Körperschluss, Mensch), entsteht eine Differenz, und der Summenstromwandler löst aus.', ['Im Gerät steckt ein Summenstromwandler.', 'Welche beiden Ströme werden miteinander verglichen?']],
    ['Warum ersetzt ein FI-Schutzschalter den Leitungsschutzschalter nicht?', 'Überlast und Kurzschluss ohne Fehlerstrom erkennt er nicht', ['Er ist nur für Kleinspannung unter 50 V zugelassen und nutzbar', 'Er besitzt keine Schaltkontakte und kann nicht abschalten', 'Er löst grundsätzlich nur bei einem Kurzschluss zwischen L und N'], 'Der FI misst nur die Differenz zwischen Hin- und Rückstrom. Eine Überlast zwischen L und N bleibt für ihn unsichtbar, dafür braucht man den LS.', ['Denke an eine Überlast zwischen L und N: Gibt es dabei einen Fehlerstrom nach Erde?', 'Beide Geräte schützen vor verschiedenen Gefahren.']],
    ['Was bedeutet der Zusatz „Typ S“ bei einem RCD?', 'Selektiv: Er löst verzögert aus und kann vor anderen RCD sitzen', ['Sensibel: Er löst schon bei wenigen Milliampere Fehlerstrom aus', 'Stark: Er verträgt besonders hohe Kurzschlussströme im Abgang', 'Schutzklasse: Er besitzt ein vollständig isoliertes Gehäuse'], 'Der Typ S (selektiv) wartet kurz, damit ein nachgeschalteter RCD zuerst abschalten kann. So fällt nicht die ganze Anlage aus.', ['S steht für ein Verhalten bei mehreren RCD hintereinander.', 'Es geht um die Auslösezeit.']]
  ];
  /* PRUEFEN P18: Selektivität wird nur qualitativ behandelt (nur das Schutzorgan vor der Fehlerstelle löst aus; größerer Nennstrom allein genügt nicht, Herstellertabellen entscheiden). Soll im Unterricht schon mit Selektivitätstabellen oder Zahlen gerechnet werden? */
  const SELQ = [
    ['Im Abgang Q3 tritt ein Kurzschluss auf. Wie verhält sich eine gut abgestufte (selektive) Verteilung?', 'Nur der Abgangs-LS Q3 schaltet ab, die übrigen Abgänge laufen weiter', ['Der Eingangsschutz schaltet ab, damit die Anlage ganz stromlos ist', 'Alle Schutzorgane schalten gleichzeitig ab, das ist am sichersten', 'Der Hauptschalter erkennt den Kurzschluss und schaltet die Anlage ab'], 'Selektivität bedeutet: Nur das Schutzorgan direkt vor der Fehlerstelle löst aus. Der Rest der Anlage bleibt in Betrieb.', ['Es soll möglichst wenig der Anlage ausfallen.', 'Welches Gerät sitzt der Fehlerstelle am nächsten?']],
    ['Warum bekommt das vorgeschaltete Schutzorgan in der Regel einen größeren Bemessungsstrom als das nachgeschaltete?', 'Bei einem Fehler im Abgang soll zuerst der Abgangs-LS reagieren', ['Damit die Leitung hinter dem Gerät dauerhaft mehr Strom führen darf', 'Damit die Summe aller Verbraucherströme insgesamt kleiner bleibt', 'Damit im Schrank weniger Verlustwärme durch den Schutz entsteht'], 'Ein größerer Bemessungsstrom (und oft eine trägere Kennlinie) gibt dem Schutz im Abgang einen Vorsprung. So wird der Fehler dort abgeschaltet, wo er entsteht.', ['Wer soll bei einem Fehler im Abgang zuerst auslösen?', 'Der Eingangsschutz soll später ansprechen.']],
    ['Was beschreibt der Begriff Selektivität?', 'Nur das Schutzorgan direkt vor der Fehlerstelle schaltet ab', ['Alle Schutzorgane sprechen gleich schnell und gemeinsam an', 'Das Schutzorgan wird passend zum jeweiligen Verbraucher gewählt', 'Die Leitung wird passend zum Schutzorgan ausgewählt und verlegt'], 'Selektivität (Staffelung) begrenzt den Ausfall auf den kleinstmöglichen Teil der Anlage.', ['Das Wort kommt von „auswählen“.', 'Es geht um das Abschalten im Fehlerfall.']],
    ['Wozu sitzt ein RCD vom Typ S vor einem nachgeschalteten 30-mA-RCD?', 'Er löst später aus, damit zuerst der nachgeschaltete RCD abschaltet', ['Er löst früher aus, damit der Fehler sofort und sicher getrennt wird', 'Er schützt zusätzlich die Zuleitung vor Überlast und Kurzschluss', 'Er ersetzt den Leitungsschutzschalter im jeweiligen Abgang vollständig'], 'Die Verzögerung des Typs S gibt dem RCD im Abgang die Chance, zuerst auszulösen. Nur dieser Abgang fällt aus.', ['Selektiv heißt: nicht alle gleichzeitig.', 'Wer darf zuerst ansprechen?']],
    ['Bei jedem Fehler fällt der komplette Schrank aus, obwohl nur ein Abgang betroffen ist. Was ist die wahrscheinlichste Ursache?', 'Die Schutzorgane sind nicht abgestuft, das vorgeschaltete löst mit aus', ['Die Leitungen im Schrank wurden für den Betrieb viel zu dick gewählt', 'Die Beschriftung der Abgänge am Schrank fehlt oder ist unleserlich', 'Das Netzteil hat zu wenig Platzreserve auf der Hutschiene eingeplant'], 'Fehlt die Staffelung, spricht das vorgeschaltete Schutzorgan gleichzeitig mit dem im Abgang an. Dann fällt alles hinter ihm aus.', ['Welche Eigenschaft der Schutzorgane entscheidet, wer zuerst auslöst?', 'Dicke Leitungen und Beschriftung ändern nichts am Auslöseverhalten.']],
    ['Welche Aussage über den Nachweis der Selektivität ist richtig?', 'Ein größerer Nennstrom genügt nicht, Herstellertabellen zeigen die Grenzen', ['Ein größerer Nennstrom des vorgeschalteten LS garantiert sie in jedem Fall', 'Bei gleicher Bauart der LS ist sie automatisch und ohne Prüfung gegeben', 'Sie hängt nur vom Querschnitt der angeschlossenen Leitung ab, nicht vom Gerät'], 'Bei hohen Kurzschlussströmen können beide Geräte zugleich auslösen. Die genaue Grenze geben die Hersteller in Selektivitätstabellen an. Hier wird sie nur qualitativ behandelt.', ['Bei sehr großen Strömen verhalten sich die Geräte anders.', 'Wo stehen verlässliche Werte für ein bestimmtes Gerätepaar?']]
  ];
  /* PRUEFEN P7: Aussagen zu Wärme, Trennung, Platzreserve, BMK, Kanälen und Hauptschalter sind vereinfacht (Übungsregeln, siehe sslcore.js). */
  const RLQ = [
    ['Warum setzt man Relais und SPS nicht oberhalb einer Wärmequelle ein?', 'Warme Luft steigt auf und heizt die Elektronik darüber zusätzlich auf', ['Die Wärmequelle stört die Funkübertragung der darüber sitzenden Elektronik', 'Elektronik darf nach Vorschrift nur in der obersten Schiene sitzen', 'Die Wärmequelle zieht die Bauteile darüber magnetisch nach unten'], 'Aufsteigende Warmluft erhöht die Temperatur der Bauteile darüber. Elektronik altert bei Hitze schneller oder fällt aus.', ['Wohin steigt warme Luft?', 'Wer soll nicht zusätzlich erwärmt werden?']],
    ['Warum trennt man im Schrank den Leistungs- vom Steuerungsbereich?', 'Wegen Berührschutz, Übersicht und Störeinkopplung auf Steuerleitungen', ['Weil Leistungsbauteile ohne Abstand nicht auf eine Hutschiene passen', 'Weil 24-V-Bauteile keine Wärme vertragen und deshalb Abstand brauchen', 'Weil die Leitungen sonst insgesamt zu viel Kupfer verbrauchen würden'], 'Verschiedene Spannungen werden getrennt geführt: Das ist sicherer, übersichtlicher, und Störungen aus Leistungsleitungen erreichen die Steuerung weniger.', ['Es geht um Sicherheit und Störungen.', 'Zwei Spannungsbereiche, zwei getrennte Zonen.']],
    ['Wozu lässt man auf einer Hutschiene etwa 20 Prozent Platz frei?', 'Für spätere Erweiterungen und für eine bessere Luftzirkulation', ['Damit sich die Bauteile bei Erwärmung frei ausdehnen können', 'Weil die Schiene sonst bei hoher Belastung verbogen werden würde', 'Damit die Schienenlänge zur Norm für Schaltschränke passend bleibt'], 'Die Reserve ermöglicht Nachrüstungen, ohne den Schrank neu zu bauen, und verhindert einen Wärmestau zwischen eng gesetzten Bauteilen.', ['Denke an die nächste Änderung am Schrank.', 'Auch die Luft braucht Platz.']],
    ['Wozu dient das Betriebsmittelkennzeichen (BMK) auf einem Bauteil?', 'Es ordnet das Bauteil eindeutig dem Schaltplan zu', ['Es gibt die Betriebsspannung des Bauteils direkt an', 'Es zeigt an, wann das Bauteil ausgetauscht werden muss', 'Es ersetzt das Typenschild des Herstellers am Bauteil'], 'Mit dem BMK findest du im Schaltplan das passende Bauteil und umgekehrt. Das beschleunigt Montage, Prüfung und Fehlersuche.', ['Im Schaltplan steht dasselbe Kennzeichen.', 'Es geht um das Wiederfinden.']],
    ['Wozu verwendet man im Schrank Kabelkanäle?', 'Sie ordnen und schützen die Leitungen und halten Bereiche getrennt', ['Sie kühlen die Leitungen durch den Luftzug im Inneren des Kanals', 'Sie erhöhen die zulässige Strombelastbarkeit der verlegten Leitungen', 'Sie ersetzen die Aderendhülsen an den Klemmen aller Bauteile'], 'Kanäle führen die Leitungen ordentlich zwischen den Schienen und schützen sie mechanisch. Mit Trennsteg lassen sich Leistung und Steuerung getrennt führen.', ['Sie bringen Ordnung in die Verdrahtung.', 'Kühlung und Strombelastbarkeit sind nicht ihre Aufgabe.']],
    ['Wo kommt der Hauptschalter im Schrank meist hin?', 'Oben in die erste Schiene, nahe der Einspeisung', ['Unten neben die Klemmenleiste für den Motoranschluss', 'Direkt neben die SPS in die Steuerungsschiene', 'Beliebig, die Lage hat keinen Einfluss auf die Regeln'], 'Die Zuleitung kommt oft von oben. Der Hauptschalter sitzt dort, wo die Energie in den Schrank eintritt, und ist gut zu erreichen.', ['Wo tritt die Energie in den Schrank ein?', 'Der Schalter trennt die gesamte Anlage vom Netz.']]
  ];
  /* PRUEFEN P10: Farbfragen (Neutralleiter, Schutzleiter, EN 60204-1: Haupt schwarz, DC-Steuerung blau, AC-Steuerung rot, Fremdspannung orange; feste Installation braun/schwarz/grau). Welche Regel gilt in der Werkstatt? */
  const COQ = [
    ['Welche Farbe hat der Neutralleiter in einer Verteilung mit Einzeladern oder Kabeln?', 'Blau bzw. hellblau', ['Grün-gelb gestreift', 'Schwarz oder braun', 'Rot oder orange'], 'Der Neutralleiter ist hellblau (im Kabel blau) gekennzeichnet. Grün-gelb ist allein dem Schutzleiter vorbehalten.', ['Die Farbe ist die kühle unter den Möglichkeiten.', 'Grün-gelb gehört dem Schutzleiter.']],
    ['Wofür darf die Farbkombination Grün-gelb verwendet werden?', 'Ausschließlich für den Schutzleiter', ['Für den Neutralleiter bei Gleichstrom', 'Für +24 V in Steuerstromkreisen', 'Für Leitungen ohne Spannung'], 'Grün-gelb ist die Schutzleiterfarbe und wird nicht für andere Aufgaben benutzt, auch nicht als „freie“ Ader.', ['Wer darf diese Farbe tragen?', 'Sie dient der Sicherheit.']],
    ['Welche Farbe wird nach EN 60204-1 für Gleichstrom-Steuerstromkreise (z. B. 24 V DC) vorgesehen?', 'Blau', ['Rot', 'Schwarz', 'Orange'], 'Nach EN 60204-1 sind Gleichstrom-Steuerstromkreise blau, Wechselstrom-Steuerstromkreise rot. In der Praxis wird +24 V oft rot und 0 V blau verdrahtet; maßgeblich ist die Vorgabe deines Betriebs.', ['Es geht um die Norm für die elektrische Ausrüstung von Maschinen.', 'Rot gehört zum Wechselstrom.']],
    ['Welche Farbe haben Hauptstromkreise (Leistung) im Maschinenschrank nach EN 60204-1?', 'Schwarz', ['Rot', 'Hellblau', 'Orange'], 'Hauptstromkreise für Wechsel- und Gleichstrom sind schwarz. Die Außenleiter werden dann oft über Aderbeschriftung (L1, L2, L3) unterschieden.', ['Die Leistung führt die „unauffälligste“ Farbe.', 'Die Phasen unterscheidet man zusätzlich über die Beschriftung.']],
    ['Wofür steht die Farbe Orange bei Einzeladern im Maschinenschrank?', 'Fremdspannung, die auch bei ausgeschaltetem Hauptschalter anliegt', ['Leitungen der Schrankbeleuchtung und der Steckdose im Schrank', 'Leitungen, die dauerhaft mit dem Schutzleiter verbunden sind', 'Reserveleitungen für spätere Erweiterungen der Anlage'], 'Orange warnt: Diese Ader bleibt auch nach dem Ausschalten des Hauptschalters unter Spannung (z. B. Verriegelung aus einem anderen Schrank).', ['Es ist eine Warnfarbe.', 'Denke an Spannung trotz ausgeschaltetem Hauptschalter.']],
    ['Welche Farben haben die Außenleiter L1, L2, L3 in einem Kabel der festen Installation?', 'Braun, Schwarz, Grau', ['Schwarz, Braun, Blau', 'Grau, Blau, Schwarz', 'Rot, Gelb, Blau'], 'In der festen Installation gilt: L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb.', ['Es sind drei Farben ohne Blau und ohne Grün-gelb.', 'Die Reihenfolge ist L1, L2, L3.']]
  ];
  /* PRUEFEN P20: Aussagen zur Isolationsmessung und Schutzleiterprüfung sind rein qualitativ (spannungsfrei, Elektronik trennen, niedriger Wert: nicht einschalten); Messspannung, Grenzwerte und Messverfahren stehen bewusst nicht in den Aufgaben. Reicht diese Tiefe? */
  const ISQ = [
    ['Wann darf der Isolationswiderstand einer Anlage gemessen werden?', 'Nur im spannungsfreien Zustand', ['Nur bei eingeschaltetem Hauptschalter', 'Nur wenn alle Verbraucher laufen', 'Nur wenn der FI ausgeschaltet ist'], 'Das Prüfgerät speist selbst eine Messspannung ein. Die Anlage muss dafür spannungsfrei sein, sonst gefährdest du dich und das Gerät.', ['Das Messgerät liefert die Spannung selbst.', 'Erst freischalten, dann messen.']],
    ['Was geschieht mit elektronischen Baugruppen (Netzteil, SPS) vor einer Isolationsmessung?', 'Sie werden abgeklemmt oder gegen die Prüfspannung geschützt', ['Sie bleiben unter Netzspannung, damit sie mitgeprüft werden', 'Sie werden mit dem Schutzleiter fest und dauerhaft verbunden', 'Sie werden vor der Messung mit Spannung aufgeladen'], 'Die hohe Gleich-Prüfspannung kann Elektronik zerstören. Deshalb werden empfindliche Teile getrennt oder wie vom Hersteller vorgesehen behandelt.', ['Denke an die Prüfspannung am Messgerät.', 'Elektronik ist empfindlich gegen hohe Spannung.']],
    ['Die Isolationsmessung zeigt einen sehr niedrigen Wert. Was tust du?', 'Nicht einschalten, die Fehlerstelle abschnittsweise eingrenzen', ['Trotzdem einschalten und den FI und die Leitungen beobachten', 'Den Messwert ignorieren, weil die Anlage ja noch neu ist', 'Das Messgerät auf einen anderen Messbereich stellen und neu messen'], 'Ein niedriger Wert deutet auf einen Isolationsfehler hin. Teile die Anlage in Abschnitte und messe einzeln, bis du den Fehler findest.', ['Einschalten ist gefährlich.', 'Eingrenzen heißt: Abschnitt für Abschnitt prüfen.']],
    ['Was wird bei der Schutzleiterprüfung festgestellt?', 'Ob alle berührbaren Metallteile niederohmig angebunden sind', ['Ob die Isolierung der Außenleiter ausreichend hoch ist', 'Ob der FI-Schutzschalter bei Fehlerstrom rechtzeitig auslöst', 'Ob die Phasenfolge des Drehfelds am Motor richtig ist'], 'Der Schutzleiter muss alle berührbaren leitfähigen Teile mit niedrigem Widerstand verbinden. Nur so wirkt der Schutz im Fehlerfall.', ['Es geht um die Verbindung, nicht um die Isolierung.', 'Das Ergebnis soll einen sehr kleinen Widerstand zeigen.']],
    ['Warum prüft man den Schutzleiter vor dem ersten Einschalten?', 'Damit im Fehlerfall der Schutz sicher wirkt, bevor Spannung kommt', ['Weil er sonst beim ersten Einschalten durchbrennen würde', 'Weil sich der Hauptschalter sonst gar nicht einschalten lässt', 'Weil sonst die Aderfarben im Schrank mit der Zeit verblassen'], 'Ein unterbrochener Schutzleiter fällt im Normalbetrieb nicht auf, ist aber bei einem Fehler lebensgefährlich. Deshalb wird er vorab geprüft.', ['Welche Gefahr besteht, wenn der Schutzleiter fehlt?', 'Im Normalbetrieb merkt man es nicht.']],
    ['Warum steht die Schutzleiterprüfung im Ablauf vor der Isolationsmessung?', 'Der Durchgang zeigt grobe Fehler schnell, bevor man weiter prüft', ['Der Durchgang darf nur unter Netzspannung geprüft werden', 'Die Isolationsmessung ist gefährlich und darf nie gemacht werden', 'Der Durchgang ist die einzige überhaupt vorgeschriebene Prüfung'], 'Beide Prüfungen werden spannungsfrei gemacht. Der Durchgang liefert schnell ein Ergebnis und verhindert, dass du eine Anlage mit offener Schutzleiterverbindung weiter prüfst.', ['Ob die Anlage unter Spannung steht, entscheidet über die Reihenfolge.', 'Grobe Fehler zuerst finden.']]
  ];
  /* PRUEFEN P14: Befund und nächster Schritt folgen dem Prüfablauf (erst Mängel beheben, spannungsfreie Prüfungen vor dem Zuschalten, Drehrichtung nur spannungsfrei ändern, Protokoll zum Schluss). */
  const PNX = [
    ['Bei der Sichtprüfung fällt eine locker sitzende Klemme auf.', 'Anlage spannungsfrei halten, Klemme nachziehen, Sichtprüfung fortsetzen', 'Gefundener Mangel: Erst beheben, dann weiterprüfen.'],
    ['Der Schutzleiterwiderstand zu einer Montageplatte ist auffällig hoch.', 'Nicht einschalten, Schraubverbindung und Lackstellen prüfen und nacharbeiten', 'Gefundener Mangel: Die Verbindung zum Metallteil ist nicht in Ordnung. Nacharbeiten, dann erneut messen.'],
    ['Alle spannungsfreien Prüfungen sind bestanden.', 'Stufenweise zuschalten: Hauptschalter ein, Spannungen messen', 'Erst nach bestandenen spannungsfreien Prüfungen wird zugeschaltet, immer schrittweise.'],
    ['Die Isolationsmessung zeigt einen niedrigen Wert am Abgang Q4.', 'Abgang Q4 abklemmen und die Leitungen einzeln messen', 'Gefundener Mangel: Den Fehler durch getrenntes Messen eingrenzen, nicht einschalten.'],
    ['Nach dem Einschalten dreht der Motor in die falsche Richtung.', 'Spannungsfrei schalten und zwei Außenleiter am Motorabgang tauschen', 'Die Drehrichtung ändert sich durch Tauschen von zwei Außenleitern, aber nur im spannungsfreien Zustand.'],
    ['Alle Prüfungen sind bestanden, der Schrank funktioniert.', 'Messwerte und Prüfergebnis im Protokoll festhalten', 'Ohne Protokoll gibt es keinen Nachweis der Prüfung.']
  ];

  /* ---------- Layout-Szenarien ---------- */
  /* PRUEFEN P16: Drei Layout-Szenarien (Bauteillisten für Kleinsteuerungen: "Verteiler mit Steuerung", "Pumpenschrank", "Antriebsschrank") sind frei erfunden und vereinfacht; die Regeln sind die der Übung (Wärme, Trennung, Kanal, Beschriftung, Reserve). Passen Regelauswahl und Reihenfolge zu euren Schränken? */
  const SCEN = {
    a: { id: 'a', t: 'Verteiler mit Kleinsteuerung', need: ['hs', 'fi', 'ls3', 'ls1', 'sk', 'klL', 'sps', 'klS'], rules: ['pass', 'fit', 'haupt', 'trenn', 'kanal', 'beschr'] },
    b: { id: 'b', t: 'Pumpenschrank mit Netzteil', need: ['hs', 'fi', 'ls3', 'ls1', 'ls1', 'sk', 'nt', 'klL', 'sps', 'rel', 'rel', 'klS'], rules: ['pass', 'fit', 'haupt', 'trenn', 'kanal', 'warm', 'stapel', 'reserve', 'beschr'] },
    c: { id: 'c', t: 'Antriebsschrank mit Umrichter', need: ['hs', 'ls3', 'fu', 'nt', 'klL', 'sps', 'rel', 'klS', 'ls1'], rules: ['pass', 'fit', 'haupt', 'trenn', 'kanal', 'warm', 'stapel', 'reserve', 'beschr'] }
  };
  const solCache = {};
  function solution(sc) { if (!solCache[sc.id]) { const L = C().solveLayout(sc.need, sc.rules); solCache[sc.id] = L; } return C().cloneLayout(solCache[sc.id]); }
  /* Zufallsfehler: verletzt genau die Regel k (oder null, wenn mit mehreren Versuchen nicht erreichbar) */
  function mutate(R, L, k) {
    const c = C(), P = c.part, it = L.items, pick = a => a[Math.floor(R() * a.length)];
    const spot = (i, r) => { const xs = []; for (let x = 0; x + P(i.p).w <= c.RAIL_TE; x++) { const t = { p: i.p, x, r }; if (!c.railItems({ items: it.filter(o => o !== i) }, r).some(o => c.overlap(t, o))) xs.push(x); } return xs.length ? pick(xs) : -1; };
    const move = (i, r, x) => { i.r = r; i.x = x; };
    const rails = [0, 1, 2];
    if (k === 'beschr') { pick(it).lab = false; return true; }
    if (k === 'kanal') { const need = [0, 1].filter(r => { const z = {}; c.zonesOf(L, r).concat(c.zonesOf(L, r + 1)).forEach(q => { z[q] = 1; }); return z.L && z.S; }); if (!need.length) return false; L.sep[pick(need)] = false; return true; }
    if (k === 'haupt') { const h = it.find(i => i.p === 'hs'); if (!h) return false; const r = pick([1, 2]), x = spot(h, r); if (x < 0) return false; move(h, r, x); return true; }
    if (k === 'trenn') { const i = pick(it), z = P(i.p).z, rs = rails.filter(r => r !== i.r && c.zonesOf(L, r).length && c.zonesOf(L, r)[0] !== z); if (!rs.length) return false; const r = pick(rs), x = spot(i, r); if (x < 0) return false; move(i, r, x); return true; }
    if (k === 'warm') { const ss = it.filter(i => P(i.p).sens), hh = it.filter(i => P(i.p).heat); if (!ss.length || !hh.length) return false; const s = pick(ss), h = pick(hh); const rs = rails.filter(r => r < h.r); if (rs.length) { const r = pick(rs), xs = []; for (let x = Math.max(0, h.x - P(s.p).w + 1); x <= Math.min(c.RAIL_TE - P(s.p).w, h.x + P(h.p).w - 1); x++) { const t = { p: s.p, x, r }; if (!c.railItems({ items: it.filter(o => o !== s) }, r).some(o => c.overlap(t, o))) xs.push(x); } if (!xs.length) return false; move(s, r, pick(xs)); return true; } const rb = rails.filter(r => r > s.r); if (!rb.length) return false; const r = pick(rb), xs = []; for (let x = Math.max(0, s.x - P(h.p).w + 1); x <= Math.min(c.RAIL_TE - P(h.p).w, s.x + P(s.p).w - 1); x++) { const t = { p: h.p, x, r }; if (!c.railItems({ items: it.filter(o => o !== h) }, r).some(o => c.overlap(t, o))) xs.push(x); } if (!xs.length) return false; move(h, r, pick(xs)); return true; }
    if (k === 'stapel') { const hh = it.filter(i => P(i.p).heat); if (hh.length < 2) return false; const a = pick(hh), b = pick(hh.filter(o => o !== a)); if (!b || a.r >= 2) return false; const r = a.r + 1, xs = []; for (let x = Math.max(0, a.x - P(b.p).w + 1); x <= Math.min(c.RAIL_TE - P(b.p).w, a.x + P(a.p).w - 1); x++) { const t = { p: b.p, x, r }; if (!c.railItems({ items: it.filter(o => o !== b) }, r).some(o => c.overlap(t, o))) xs.push(x); } if (!xs.length) return false; move(b, r, pick(xs)); return true; }
    if (k === 'reserve') { const r = pick(rails), z = c.zonesOf(L, r)[0]; if (!z) return false; const cand = it.filter(i => i.r !== r && P(i.p).z === z); for (let g = 0; g < 8 && c.railUsed(L, r) <= c.MAX_TE; g++) { const i = pick(cand); if (!i || i.r === r) continue; const x = spot(i, r); if (x >= 0) move(i, r, x); } return c.railUsed(L, r) > c.MAX_TE; }
    if (k === 'fit') { const i = pick(it); if (R() < 0.5) move(i, i.r, c.RAIL_TE - P(i.p).w + 1 + Math.floor(R() * 2)); else { const o = pick(it.filter(q => q !== i && q.r === i.r)); if (!o) return false; move(i, i.r, o.x); } return true; }
    return false;
  }
  const baseL = (sc) => { const L = solution(sc); L.sep = [true, true]; return L; };
  function brokenOne(R, sc, k) {
    for (let a = 0; a < 400; a++) { const L = baseL(sc); if (!mutate(R, L, k)) continue; const chk = C().checkLayout(L, sc.need, sc.rules.filter(x => x !== 'pass')); if (chk.bad.length === 1 && chk.bad[0] === k) return L; }
    return null;
  }
  function brokenMany(R, sc, ks, min, max) {
    for (let a = 0; a < 600; a++) {
      const L = baseL(sc); ks.forEach(k => mutate(R, L, k));
      const chk = C().checkLayout(L, sc.need, sc.rules.filter(x => x !== 'pass')); if (chk.bad.length >= min && chk.bad.length <= max) return { L, chk };
    }
    return null;
  }
  const SIMPLE_KS = ['haupt', 'trenn', 'kanal', 'beschr', 'fit', 'warm', 'stapel', 'reserve'];
  const rulesFor = sc => sc.rules.filter(k => k !== 'pass');

  /* ---------- Generatoren ---------- */
  const G = {
    lschar: R => {
      const c = C(), ch = c.pick(R, ['B', 'C', 'D']), In = c.pick(R, [10, 13, 16, 20, 25, 32]), rg = x => 'Von ' + f(c.tripLow(x, In), 0) + ' A bis ' + f(c.tripHigh(x, In), 0) + ' A';
      if (R() < 0.5) {
        return choiceQ(R, 'Ein Leitungsschutzschalter ' + ch + In + ' soll bei Kurzschluss magnetisch auslösen. In welchem Strombereich liegt die Auslösung des Schnellauslösers (kleinster bis größter Wert, ab dem er sicher auslöst)?', rg(ch), ['B', 'C', 'D'].filter(x => x !== ch).map(rg).concat(['Von ' + f(In, 0) + ' A bis ' + f(3 * In, 0) + ' A']),
          'Die Auslösegrenzen sind Vielfache von In: B 3 bis 5, C 5 bis 10, D 10 bis 20. Für ' + ch + In + ' gilt: ' + f(c.LS_CHAR[ch].lo, 0) + ' · ' + In + ' A = ' + f(c.tripLow(ch, In), 0) + ' A bis ' + f(c.LS_CHAR[ch].hi, 0) + ' · ' + In + ' A = ' + f(c.tripHigh(ch, In), 0) + ' A.', ['Die Zahl hinter dem Buchstaben ist der Bemessungsstrom In.', 'B löst von 3 bis 5, C von 5 bis 10 und D von 10 bis 20 mal In aus.']);
      }
      const lo = c.LS_CHAR[ch].lo, hi = c.LS_CHAR[ch].hi;
      return choiceQ(R, 'Ein Leitungsschutzschalter löst magnetisch zwischen dem ' + lo + '- und dem ' + hi + '-fachen seines Bemessungsstroms aus. Welche Charakteristik hat er?', 'Charakteristik ' + ch, ['B', 'C', 'D'].filter(x => x !== ch).map(x => 'Charakteristik ' + x).concat(['Charakteristik A']),
        'B löst bei 3 bis 5, C bei 5 bis 10 und D bei 10 bis 20 mal In aus. Hier: ' + lo + ' bis ' + hi + ' mal In = Charakteristik ' + ch + '.', ['Vergleiche die Zahlen mit B (3–5), C (5–10) und D (10–20).', 'Die Charakteristik A gibt es in der Übung nicht.']);
    },
    /* PRUEFEN P19: Zuordnung Verbraucher zur Charakteristik: Netzteile und Leuchten mit Einschaltstrom C, Steckdosen und ohmsche Last B, Transformator D, Motor mit Motorschutzschalter. Das sind Faustregeln; in der Praxis entscheiden Datenblatt (Einschaltstrom) und Kurzschlussstrom am Einbauort. */
    lswhich: R => {
      const c = C(), S = [
        ['Ein Abgang versorgt mehrere Schaltnetzteile, die beim Einschalten kurz ein Vielfaches ihres Nennstroms ziehen.', 'Charakteristik C', 'Der kurze Einschaltstromstoß der Netzteile würde einen B-Automaten leicht auslösen lassen; C hält mehr aus (5 bis 10 mal In).'],
        ['Ein Steckdosenstromkreis für Handwerkzeuge in der Werkstatt, lange Leitung, kein besonderer Einschaltstrom.', 'Charakteristik B', 'B löst schon bei 3 bis 5 mal In aus. Das schützt auch lange Leitungen mit kleinem Kurzschlussstrom zuverlässig.'],
        ['Ein Heizlüfter (ohmsche Last) hängt allein an einem Abgang, ohne Einschaltstromstoß.', 'Charakteristik B', 'Ohmsche Lasten haben keinen Einschaltstromstoß. B ist die Standardwahl und schützt die Leitung am empfindlichsten.'],
        ['Ein Leuchtenband mit vielen Vorschaltgeräten zieht beim Einschalten einen hohen Stromstoß.', 'Charakteristik C', 'Viele Vorschaltgeräte erzeugen gemeinsam einen großen Einschaltstrom. C verträgt das besser als B.'],
        ['Ein Steuertransformator zieht beim Einschalten das 10- bis 15-fache seines Nennstroms.', 'Charakteristik D', 'Sehr hohe, kurze Stromstöße (Transformatoren) verlangen die träge Kennlinie D mit Auslösung bei 10 bis 20 mal In.'],
        ['Eine Wicklung eines Drehstrommotors soll vor Überlast durch den Motorstrom geschützt werden, auch bei langsam steigendem Strom.', 'Motorschutzschalter', 'Ein Motorschutzschalter hat einen einstellbaren thermischen Auslöser für den Motornennstrom. Ein LS schützt nur die Leitung.']
      ], s = c.pick(R, S), opts = ['Charakteristik B', 'Charakteristik C', 'Charakteristik D', 'Motorschutzschalter'];
      return choiceQ(R, s[0] + ' Was passt am besten?', s[1], opts.filter(o => o !== s[1]), s[2], ['Frage dich: Gibt es einen kurzen Stromstoß beim Einschalten, oder soll ein Motor vor Überlast geschützt werden?', 'B ist die Grundwahl, C und D vertragen größere Stromstöße.']);
    },
    lspick: R => {
      const c = C(), ib = c.pick(R, [4.8, 7.5, 9.2, 11, 14.4, 17, 21, 27, 35, 44]), v = c.pickIn(ib);
      return numQ('Ein Abgang im Schaltschrank führt im Dauerbetrieb ' + f(ib, 1) + ' A. Welchen kleinsten Bemessungsstrom des Leitungsschutzschalters wählst du aus der Reihe 6, 10, 13, 16, 20, 25, 32, 40, 50, 63 A?', v, 'A', 'Bemessungsstrom In', 0, 'Der LS muss den Betriebsstrom führen: In ≥ Ib = ' + f(ib, 1) + ' A. Der nächste Wert der Reihe ist ' + f(v, 0) + ' A.', ['Der Bemessungsstrom darf nicht kleiner als der Betriebsstrom sein.', 'Nimm den nächsten Wert der Reihe, der gleich oder größer ist.']);
    },
    lstrip: R => {
      const c = C(), ch = c.pick(R, ['B', 'C', 'D']), In = c.pick(R, [6, 10, 13, 16, 20, 25]), up = R() < 0.5, v = up ? c.tripHigh(ch, In) : c.tripLow(ch, In), hd = '(Auslösebereich: B 3 bis 5, C 5 bis 10, D 10 bis 20 mal In) ';
      return numQ('Ein Leitungsschutzschalter ' + ch + In + ' ' + hd + (up ? 'Ab welchem Strom löst der Schnellauslöser sicher aus (obere Grenze des Bereichs)?' : 'Unterhalb welchen Stroms löst der Schnellauslöser sicher nicht aus (untere Grenze des Bereichs)?'), v, 'A', up ? 'Sicherer Auslösestrom' : 'Nichtauslösestrom', 0.5,
        'Die Grenze ist ein Vielfaches des Bemessungsstroms: ' + ch + In + ' mit ' + f(up ? c.LS_CHAR[ch].hi : c.LS_CHAR[ch].lo, 0) + ' · ' + f(In, 0) + ' A = ' + f(v, 0) + ' A.', ['Multipliziere den Bemessungsstrom mit dem Faktor der Charakteristik.', up ? 'Die obere Grenze ist der größere Faktor.' : 'Die untere Grenze ist der kleinere Faktor.']);
    },
    rcdq: pq(RDQ),
    protchain: R => orderQ(R, 'Ordne die Geräte in einem Motorabgang des Schaltschranks in der Reihenfolge vom Netz bis zum Verbraucher.', ['Hauptschalter', 'FI-Schutzschalter', 'Leitungsschutzschalter', 'Schütz', 'Motor'],
      'Die Energie fließt vom Netz über den Hauptschalter (Trennen der ganzen Anlage), den FI (Fehlerstromschutz für mehrere Abgänge) und den Leitungsschutzschalter (Schutz des Abgangs) zum Schütz (Schalten) und zum Motor.', ['Der Schalter für die ganze Anlage steht am Anfang.', 'Das Gerät, das den Verbraucher schaltet, steht direkt vor dem Verbraucher.']),
    selq: pq(SELQ),
    i1ph: R => {
      const c = C(), I = c.pick(R, [2, 4, 5, 8, 10, 12, 16]), P = I * 230, it = c.pick(R, ['Heizlüfter', 'Heizstrahler', 'Backofen']);
      return numQ('Ein ' + it + ' hat eine Leistung von ' + f(P, 0) + ' W und hängt an 230 V (cos φ = 1, einphasig). Wie groß ist der Strom?', I, 'A', 'Strom', 0.05, 'I = P / (U · cos φ) = ' + f(P, 0) + ' W / (230 V · 1) = ' + f(I, 2) + ' A.', ['Strom = Leistung durch Spannung.', 'Bei cos φ = 1 entfällt der Faktor.']);
    },
    /* PRUEFEN P24: Strom des Drehstrommotors aus Wellenleistung, cos φ (0,8 bis 0,85) und Wirkungsgrad (0,8 bis 0,9) als Übungswerte; Heizregister und Heizgeräte mit cos φ = 1. Entspricht das euren Rechenaufgaben, oder wird mit der aufgenommenen Leistung gerechnet? */
    i3ph: R => {
      const c = C(), P = c.pick(R, [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5]), cs = c.pick(R, [0.8, 0.85]), eta = c.pick(R, [0.8, 0.85, 0.88, 0.9]), v = c.i3(P * 1000, 400, cs, eta);
      return numQ('Ein Drehstrommotor gibt ' + f(P, 2) + ' kW an der Welle ab (400 V, cos φ = ' + f(cs, 2) + ', Wirkungsgrad ' + f(eta * 100, 0) + ' %). Wie groß ist der Strom pro Außenleiter (eine Nachkommastelle)?', v, 'A', 'Strom', 0.06,
        'I = P / (√3 · U · cos φ · η) = ' + f(P * 1000, 0) + ' W / (1,732 · 400 V · ' + f(cs, 2) + ' · ' + f(eta, 2) + ') = ' + f(v, 2) + ' A.', ['Bei Drehstrom kommt der Faktor √3 ≈ 1,732 hinzu.', 'Cos φ und Wirkungsgrad stehen im Nenner.']);
    },
    crossq: R => {
      const c = C(), In = c.pick(R, [13, 16, 20, 25, 32, 40, 50, 63]), v = c.minCross(In);
      return numQ('Übungstabelle Strombelastbarkeit Iz: 1,5 mm² = 16 A, 2,5 = 21 A, 4 = 28 A, 6 = 36 A, 10 = 50 A, 16 = 66 A (Kupfer, Verlegeart B2). Ein Abgang wird mit einem LS von ' + In + ' A abgesichert. Welchen kleinsten Querschnitt brauchst du? (Es gilt In ≤ Iz.)', v, 'mm²', 'Querschnitt', 0,
        'Die Leitung muss mindestens den Bemessungsstrom des LS tragen: Iz ≥ ' + In + ' A. Der kleinste passende Querschnitt ist ' + f(v, 1) + ' mm² (Iz = ' + c.izOf(v) + ' A).', ['Suche in der Tabelle den kleinsten Iz, der mindestens so groß ist wie In.', 'Der LS darf nicht mehr Strom zulassen, als die Leitung verträgt.']);
    },
    cross3: R => {
      const c = C(), three = R() < 0.6; let P, I, txt;
      if (three) { P = c.pick(R, [9, 12, 15, 18, 22, 30, 40]); I = c.i3(P * 1000, 400, 1, 1); txt = 'Ein Heizregister (ohmsch, cos φ = 1) mit ' + f(P, 0) + ' kW wird an 400 V dreiphasig angeschlossen.'; }
      else { P = c.pick(R, [2.3, 3, 3.6, 4.6, 5.5]); I = c.i1(P * 1000, 230, 1); txt = 'Ein Heizgerät (ohmsch, cos φ = 1) mit ' + f(P, 1) + ' kW wird an 230 V einphasig angeschlossen.'; }
      const In = c.pickIn(I), v = c.minCross(In);
      return numQ(txt + ' Der Abgang wird mit dem kleinsten passenden LS der Reihe 6, 10, 13, 16, 20, 25, 32, 40, 50, 63 A abgesichert. Übungstabelle Iz: 1,5 mm² = 16 A, 2,5 = 21 A, 4 = 28 A, 6 = 36 A, 10 = 50 A, 16 = 66 A. Welchen kleinsten Querschnitt in mm² brauchst du?', v, 'mm²', 'Querschnitt', 0,
        'Betriebsstrom Ib = ' + f(I, 2) + ' A. Kleinster LS mit In ≥ Ib: ' + In + ' A. Querschnitt mit Iz ≥ ' + In + ' A: ' + f(v, 1) + ' mm² (Iz = ' + c.izOf(v) + ' A).', ['Rechne zuerst den Strom aus, dann den LS, dann den Querschnitt.', three ? 'Dreiphasig: I = P / (√3 · U).' : 'Einphasig: I = P / U.']);
    },
    peq: R => {
      const c = C(), S = c.pick(R, [2.5, 4, 6, 10, 16, 25, 35, 50, 70]), v = c.peCross(S);
      return numQ('Eine Zuleitung mit Kupfer-Außenleitern von ' + f(S, 1) + ' mm² hat einen getrennt verlegten Schutzleiter aus Kupfer. Welchen Mindestquerschnitt braucht der Schutzleiter (DIN VDE 0100-540, Regel für Schutzleiter aus gleichem Werkstoff)?', v, 'mm²', 'Schutzleiter', 0,
        'Regel: Außenleiter bis 16 mm² → Schutzleiter gleich groß; über 16 bis 35 mm² → 16 mm²; über 35 mm² → halber Querschnitt. Hier ' + f(S, 1) + ' mm² → ' + f(v, 1) + ' mm².', ['Es gibt drei Bereiche: bis 16, bis 35 und darüber.', S > 35 ? 'Über 35 mm² reicht der halbe Querschnitt.' : S > 16 ? 'Bei 16 bis 35 mm² genügt 16 mm².' : 'Bis 16 mm² gilt: gleich groß wie der Außenleiter.']);
    },
    sum24: R => {
      const c = C(), n1 = c.ri(R, 2, 6), n2 = c.ri(R, 2, 8), n3 = c.ri(R, 1, 3), sp = c.pick(R, [0.4, 0.6, 0.8]), v = sp + n1 * 0.05 + n2 * 0.1 + n3 * 0.5;
      return numQ('An der 24-V-Versorgung hängen: eine SPS mit ' + f(sp, 1) + ' A, ' + cnt(n1, 'Koppelrelais', 'Koppelrelais') + ' mit je 0,05 A, ' + cnt(n2, 'Sensor', 'Sensoren') + ' mit je 0,1 A und ' + cnt(n3, 'Magnetventil', 'Magnetventile') + ' mit je 0,5 A. Wie groß ist der Gesamtstrom?', v, 'A', 'Gesamtstrom', 0.005,
        'Gesamtstrom = ' + f(sp, 2) + ' + ' + n1 + ' · 0,05 + ' + n2 + ' · 0,1 + ' + n3 + ' · 0,5 = ' + f(v, 2) + ' A.', ['Rechne jede Gruppe aus Stückzahl mal Strom aus.', 'Zähle dann alles zusammen.']);
    },
    /* PRUEFEN P5: 25 % Reserve und Stufen 2,5 / 5 / 10 / 20 / 40 A. */
    psu24: R => {
      const c = C(), I = c.pick(R, [1.6, 2.4, 3.6, 4.8, 6.4, 8.4, 11, 15.2, 17.5, 24]), need = c.psuNeed(I), v = c.psuPick(I);
      return numQ('Die 24-V-Verbraucher ziehen zusammen ' + f(I, 1) + ' A. Das Netzteil soll 25 % Reserve haben. Welche Ausgangsstrom-Stufe aus der Reihe 2,5 / 5 / 10 / 20 / 40 A wählst du?', v, 'A', 'Netzteil-Ausgangsstrom', 0,
        'Bedarf mit Reserve = ' + f(I, 1) + ' A · 1,25 = ' + f(need, 2) + ' A. Die nächste Stufe ab diesem Wert ist ' + f(v, 1) + ' A.', ['Rechne mit dem Faktor 1,25 (25 % Reserve).', 'Dann die kleinste Stufe wählen, die mindestens so groß ist.']);
    },
    psuloss: R => {
      const c = C(), Ia = c.pick(R, [2.5, 5, 10, 20]), eta = c.pick(R, [0.85, 0.88, 0.9, 0.92]), Po = 24 * Ia, v = c.psuLoss(Po, eta);
      return numQ('Ein 24-V-Netzteil gibt ' + f(Ia, 1) + ' A ab (Ausgangsleistung ' + f(Po, 0) + ' W) bei einem Wirkungsgrad von ' + f(eta * 100, 0) + ' %. Wie viel Verlustleistung entsteht als Wärme im Schrank (eine Nachkommastelle)?', v, 'W', 'Verlustleistung', 0.06,
        'Aufnahme = ' + f(Po, 0) + ' W / ' + f(eta, 2) + ' = ' + f(Po / eta, 2) + ' W. Verlust = Aufnahme − Abgabe = ' + f(Po / eta, 2) + ' W − ' + f(Po, 0) + ' W = ' + f(v, 2) + ' W.', ['Erst die aufgenommene Leistung ausrechnen.', 'Der Verlust ist die Differenz zur abgegebenen Leistung.']);
    },
    psuprim: R => {
      const c = C(), Ia = c.pick(R, [2.5, 5, 10, 20]), eta = c.pick(R, [0.85, 0.88, 0.9, 0.92]), Po = 24 * Ia, v = c.psuIn(Po, eta, 230);
      return numQ('Ein 24-V-Netzteil gibt ' + f(Ia, 1) + ' A ab (' + f(Po, 0) + ' W) bei einem Wirkungsgrad von ' + f(eta * 100, 0) + ' %. Es hängt einphasig an 230 V (cos φ = 1 angenommen). Welchen Strom nimmt es primärseitig auf (zwei Nachkommastellen)?', v, 'A', 'Primärstrom', 0.011,
        'Aufnahme = ' + f(Po, 0) + ' W / ' + f(eta, 2) + ' = ' + f(Po / eta, 2) + ' W. Strom = ' + f(Po / eta, 2) + ' W / 230 V = ' + f(v, 3) + ' A.', ['Die Primärseite muss mehr Leistung liefern als die Sekundärseite.', 'Strom = aufgenommene Leistung durch Netzspannung.']);
    },
    /* PRUEFEN P6: Wärmebilanz mit k = 5,5 W/(m²·K), vorgegebener wirksamer Oberfläche und höchstens 35 oder 40 °C innen. */
    heatbal: R => {
      const c = C(), ids = ['ls1', 'ls3', 'sk', 'nt', 'sps', 'rel', 'klL'];
      let L, Pv, A, Tout, Tin, wall, v;
      for (let t = 0; t < 400; t++) {
        L = c.shuffle(R, ids).slice(0, 4).map(id => [id, c.ri(R, 1, id === 'ls1' || id === 'rel' ? 6 : 3)]); Pv = L.reduce((s, x) => s + x[1] * c.part(x[0]).pv, 0); A = c.pick(R, [1.2, 1.6, 2, 2.4, 3]); Tout = c.pick(R, [25, 30]); Tin = c.pick(R, [35, 40]); wall = c.wallHeat(A, Tin - Tout); v = Math.max(0, Pv - wall);
        if (v >= 15 && v <= 150) break;
      }
      return numQ('Im Schrank sind eingebaut: ' + L.map(x => x[1] + ' × ' + c.part(x[0]).s + ' (je ' + c.part(x[0]).pv + ' W)').join(', ') + '. Die wirksame Schrankoberfläche beträgt ' + f(A, 1) + ' m². Außen sind es ' + Tout + ' °C, innen sollen höchstens ' + Tin + ' °C erreicht werden. Die Wand gibt 5,5 W je m² und Kelvin ab. Wie viel Wärme muss zusätzlich abgeführt werden (ganze Watt)?', v, 'W', 'Zusätzliche Kühlleistung', 0.5,
        'Verlustleistung ' + f(Pv, 0) + ' W. Wandabfuhr = 5,5 · ' + f(A, 1) + ' m² · ' + (Tin - Tout) + ' K = ' + f(wall, 1) + ' W. Zusätzlich nötig: ' + f(Pv, 0) + ' W − ' + f(wall, 1) + ' W = ' + f(v, 1) + ' W.', ['Addiere zuerst alle Verlustleistungen (Anzahl mal Einzelwert).', 'Die Wand führt k · A · ΔT ab, den Rest muss ein Lüfter oder Kühlgerät übernehmen.']);
    },
    fan: R => {
      const c = C(), P = c.pick(R, [60, 90, 120, 150, 200, 300]), dT = c.pick(R, [5, 8, 10]), v = c.fanFlow(P, dT);
      return numQ('Ein Schaltschrank soll ' + P + ' W Verlustleistung durch einen Filterlüfter abführen. Außenluft und Schrankinneres dürfen sich um höchstens ' + dT + ' K unterscheiden. Für den Volumenstrom gilt die Näherung V = 3,1 · P / ΔT (V in m³/h, P in W, ΔT in K). Wie groß muss der Volumenstrom sein (ganze m³/h)?', v, 'm³/h', 'Volumenstrom', 0.6,
        'V = 3,1 · ' + P + ' / ' + dT + ' = ' + f(v, 1) + ' m³/h. (Der Faktor 3,1 folgt aus Dichte und Wärmekapazität der Luft; die Näherung gilt in Meereshöhe.)', ['Setze die Zahlen direkt in die Formel ein.', 'Leistung im Zähler, Temperaturdifferenz im Nenner.']);
    },
    /* PRUEFEN P7: Breiten in TE als Übungswerte (1 TE = 17,5 mm). */
    te: R => {
      const c = C(), sc = c.pick(R, Object.values(SCEN)), ids = c.shuffle(R, sc.need.filter((x, i, a) => a.indexOf(x) === i)).slice(0, 5), n = ids.map(id => c.ri(R, 1, id === 'ls1' || id === 'rel' ? 4 : 2));
      const tot = ids.reduce((s, id, i) => s + n[i] * c.part(id).w, 0);
      return numQ('Auf einer Hutschiene sollen folgende Bauteile sitzen: ' + ids.map((id, i) => n[i] + ' × ' + c.part(id).s + ' (je ' + c.part(id).w + ' TE)').join(', ') + '. Wie viele TE brauchen sie zusammen (1 TE = 17,5 mm)?', tot, 'TE', 'Gesamtbreite', 0,
        'Summe = ' + ids.map((id, i) => n[i] + ' · ' + c.part(id).w).join(' + ') + ' = ' + tot + ' TE (' + f(tot * c.TE_MM, 1) + ' mm).', ['Rechne Stückzahl mal Breite für jedes Bauteil.', 'Dann alle Teilsummen addieren.']);
    },
    ruleq: pq(RLQ),
    railfree: R => {
      const c = C(), used = c.ri(R, 7, 15), v = Math.max(0, c.MAX_TE - used);
      return numQ('Eine Hutschiene ist ' + c.RAIL_TE + ' TE breit. Auf jeder Schiene sollen mindestens 20 % frei bleiben (Reserve). Es sind schon ' + used + ' TE belegt. Wie viele einpolige Leitungsschutzschalter (je 1 TE) passen noch auf die Schiene?', v, 'Stück', 'Anzahl LS', 0,
        '20 % von ' + c.RAIL_TE + ' TE sind ' + (c.RAIL_TE - c.MAX_TE) + ' TE Reserve, also dürfen höchstens ' + c.MAX_TE + ' TE belegt sein. ' + c.MAX_TE + ' − ' + used + ' = ' + v + '.', ['Wie viele TE dürfen insgesamt belegt sein?', 'Ziehe davon die belegten TE ab.']);
    },
    laychoice: R => {
      const c = C(), sc = c.pick(R, [SCEN.b, SCEN.c]); let k, L = null, order = c.shuffle(R, SIMPLE_KS);
      for (let i = 0; i < order.length && !L; i++) { k = order[i]; L = brokenOne(R, sc, k); }
      const others = c.shuffle(R, rulesFor(sc).filter(x => x !== k)).slice(0, 3).map(x => c.RULES[x].t);
      const q = choiceQ(R, 'Das Layout des Schranks „' + sc.t + '“ ist unten dargestellt. Genau eine der Regeln wird verletzt. Welche?', c.RULES[k].t, others, c.RULES[k].d + ' ' + C().checkLayout(L, sc.need, rulesFor(sc)).rules.filter(r => !r.ok)[0].det.join('; ') + '.',
        ['Gehe die Regeln nacheinander am Bild durch: Wärme, Trennung, Kanal, Beschriftung, Platz.', 'Achte auf Bauteile mit Kreuz oder ohne Namensschild und auf die Trennstege im Kanal.']);
      q.layout = L; q.need = sc.need; q.meta = { sc: sc.id, rule: k }; return q;
    },
    laycount: R => {
      const c = C(), sc = c.pick(R, [SCEN.b, SCEN.c]); let r = null; for (let g = 0; g < 8 && !r; g++) r = brokenMany(R, sc, c.shuffle(R, SIMPLE_KS).slice(0, c.ri(R, 2, 4)), 2, 5); const L = r.L, n = r.chk.bad.length;
      const q = numQ('Das Layout des Schranks „' + sc.t + '“ ist unten dargestellt. Es gelten diese ' + rulesFor(sc).length + ' Regeln: ' + rulesFor(sc).map(x => c.RULES[x].t).join('; ') + '. Gezählt wird jede verletzte Regel einmal, egal wie oft sie verletzt wird. Wie viele Regeln werden verletzt?', n, 'Regeln', 'Verletzte Regeln', 0,
        'Verletzt: ' + r.chk.rules.filter(x => !x.ok).map(x => x.t + ' (' + x.det.join('; ') + ')').join(' | ') + '. Das sind ' + n + ' Regeln.', ['Prüfe jede Regel einzeln und merke dir die Verstöße.', 'Eine Regel zählt nur einmal, auch wenn mehrere Bauteile betroffen sind.']);
      q.layout = L; q.need = sc.need; q.meta = { sc: sc.id, n }; return q;
    },
    lay: (R, arg) => {
      const c = C(), sc = SCEN[arg.sc], sol = solution(sc);
      let L, chk, tries = 0;
      do { const ks = c.shuffle(R, SIMPLE_KS.filter(x => sc.rules.indexOf(x) >= 0)).slice(0, arg.ks); L = baseL(sc); L.sep = [false, false]; ks.forEach(k => mutate(R, L, k)); L.items.forEach(i => { if (R() < 0.35) i.lab = false; }); chk = c.checkLayout(L, sc.need, sc.rules); tries++; } while ((chk.ok || chk.bad.length < arg.min) && tries < 200);
      if (arg.unplace) { const i = c.ri(R, 0, L.items.length - 1); L.items.splice(i, 1); }
      const txt = 'Ordne den Schrank „' + sc.t + '“. Alle Bauteile der Liste müssen auf die Schienen, bis alle Regeln erfüllt sind. Es gelten: ' + sc.rules.map(x => c.RULES[x].t).join('; ') + '. Verschiebe die Bauteile per Ziehen oder mit den Pfeiltasten, beschrifte sie und setze die Trennstege im Kanal. Prüfe dann dein Layout.';
      const q = { text: txt, ask: { type: 'layout', need: sc.need.slice(), rules: sc.rules.slice(), start: L }, value: 0, tol: 0, sol, expl: 'Eine mögliche Lösung: ' + sol.items.slice().sort((a, b) => a.r - b.r || a.x - b.x).map(i => c.part(i.p).s + ' (Schiene ' + (i.r + 1) + ', ab TE ' + (i.x + 1) + ')').join(', ') + '. Alle Bauteile sind beschriftet' + (sol.sep[0] || sol.sep[1] ? ', Trennstege sitzen im Kanal zwischen Leistungs- und Steuerschiene' : '') + '. Es gibt mehrere richtige Anordnungen; entscheidend ist, dass jede Regel erfüllt ist.',
        tips: ['Sortiere zuerst nach Bereich: Leistung (230/400 V) auf eine oder zwei Schienen, Steuerung (24 V) auf eine eigene Schiene.', 'Danach Wärme: Wärmequellen (Netzteil, Schütz, Umrichter) nicht direkt über- oder untereinander, Elektronik nie darüber.'] };
      q.meta = { sc: sc.id }; return q;
    },
    /* PRUEFEN P10: Aderfarben der festen Installation (L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb). */
    colmatch: R => {
      const c = C(), keys = c.shuffle(R, c.TERM_ORDER).slice(0, c.ri(R, 4, 5)), opts = ['braun', 'schwarz', 'grau', 'blau', 'grün-gelb'];
      return matchQ(R, 'Du verdrahtest einen Verteiler mit einem Kabel der festen Installation. Ordne den Leitern die Aderfarben zu.', keys.map(k => k === 'N' ? 'Neutralleiter N' : k === 'PE' ? 'Schutzleiter PE' : 'Außenleiter ' + k), opts, keys.map(k => opts.indexOf(c.INST_COL[k])),
        'In der festen Installation gilt: L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb.', ['Die drei Außenleiter sind braun, schwarz und grau.', 'Blau gehört dem Neutralleiter, grün-gelb dem Schutzleiter.']);
    },
    col: pq(COQ),
    /* PRUEFEN P11: Hülsenfarben nach Querschnitt (üblicher Farbcode). */
    ferrule: R => {
      const c = C(), cr = c.shuffle(R, [0.5, 0.75, 1.5, 2.5, 6]).slice(0, 4), opts = ['weiß', 'grau', 'schwarz', 'blau', 'gelb', 'rot'];
      return matchQ(R, 'Für die Verdrahtung im Schrank verwendest du isolierte Aderendhülsen. Welche Hülsenfarbe passt (Farbcode nach DIN 46228-4, üblich) zum Aderquerschnitt?', cr.map(x => f(x, 2) + ' mm²'), opts, cr.map(x => opts.indexOf(c.FERRULE[x])),
        'Üblicher Farbcode der Hülsen: 0,5 mm² weiß, 0,75 grau, 1 rot, 1,5 schwarz, 2,5 blau, 4 grau, 6 gelb, 10 rot (herstellerabhängig, Datenblatt beachten).', ['Der Farbcode hängt nur vom Querschnitt ab.', 'Kleine Querschnitte sind hell, die mittleren schwarz und blau.']);
    },
    /* PRUEFEN P12: Klemmenreihenfolge L1, L2, L3, N, PE. */
    termorder: R => orderQ(R, 'Die Einspeiseklemmen X1 sollen von links nach rechts in der üblichen Reihenfolge belegt werden. Ordne die Leiter.', C().TERM_ORDER.slice(),
      'Übliche Reihenfolge: erst die Außenleiter L1, L2, L3, dann der Neutralleiter N, zuletzt der Schutzleiter PE (Übung; in manchen Betrieben steht PE anders, es gilt die Betriebsvorgabe).', ['Zuerst kommen die drei Außenleiter in der Reihenfolge ihrer Nummern.', 'N kommt vor PE.']),
    termread: R => {
      const c = C(), k = c.ri(R, 0, 4), key = c.TERM_ORDER[k], right = c.INST_COL[key], wrong = c.shuffle(R, ['braun', 'schwarz', 'grau', 'blau', 'grün-gelb'].filter(x => x !== right)).slice(0, 3);
      return choiceQ(R, 'Die Einspeiseklemmen X1:1 bis X1:5 sind in der Reihenfolge L1, L2, L3, N, PE belegt. Ein Kabel der festen Installation wird angeschlossen. Welche Aderfarbe gehört an Klemme X1:' + (k + 1) + '?', right, wrong, 'X1:' + (k + 1) + ' ist ' + key + ': Die Aderfarbe ist ' + right + '.', ['Zähle die Klemmen in der genannten Reihenfolge ab.', 'Ordne dann die Farbe zu: L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb.']);
    },
    /* PRUEFEN P13: Dreileiter-Sensor: braun +24 V, blau 0 V, schwarz Signal. */
    termfill: R => {
      const c = C(), cols = c.shuffle(R, ['braun', 'blau', 'schwarz']), opts = ['+24 V', '0 V', 'Signalausgang', 'Schutzleiter'];
      return matchQ(R, 'Ein Näherungsschalter mit Dreileiter-Anschluss (PNP) wird an die Klemmen X2 der Steuerung angeschlossen. Wohin gehört welche Ader?', cols.map(x => 'Ader ' + x), opts, cols.map(x => opts.indexOf(c.SENSOR_COL[x])),
        'Dreileiter-Sensor: braun = +24 V, blau = 0 V, schwarz = Signalausgang. Ein Schutzleiter wird bei diesem Sensor nicht angeschlossen.', ['Die Versorgung besteht aus zwei Adern, die dritte meldet das Signal.', 'Braun ist der Pluspol, blau der Minuspol.']);
    },
    spannung: R => {
      const c = C(), T = [['Sichtprüfung der Klemmen und Aderendhülsen', 0], ['Durchgang des Schutzleiters messen', 0], ['Isolationswiderstand messen', 0], ['Spannung an den Klemmen nach dem Hauptschalter messen', 1], ['Drehfeld (Phasenfolge) prüfen', 1], ['Not-Halt im Betrieb testen', 1]], ts = c.shuffle(R, T).slice(0, 5);
      return matchQ(R, 'Ordne zu: Wird diese Prüfung im spannungsfreien Zustand oder unter Spannung durchgeführt?', ts.map(x => x[0]), ['im spannungsfreien Zustand', 'unter Spannung'], ts.map(x => x[1]),
        'Spannungsfrei: Sichtprüfung, Durchgang und Isolationsmessung. Unter Spannung: Spannungsmessung, Drehfeldprüfung, Funktionsprüfung. Es wird immer erst alles Spannungsfreie geprüft.', ['Messgeräte für Isolation und Durchgang liefern ihre Messspannung selbst.', 'Alles, was Spannung messen oder eine Funktion im Betrieb zeigen soll, braucht Spannung.']);
    },
    isoq: pq(ISQ),
    /* PRUEFEN P14: Prüfreihenfolge (Sichtprüfung, Schutzleiter, Isolation, Zuschalten, Funktion, Protokoll). */
    pruefreih: R => {
      const c = C(), n = c.PRUEF_STEPS.length, drop = c.ri(R, 0, n - 1), steps = c.PRUEF_STEPS.filter((_, i) => i !== drop).map(s => s.t);
      return orderQ(R, 'Du prüfst einen fertig verdrahteten Schaltschrank vor der Inbetriebnahme. Bringe diese Schritte in die richtige Reihenfolge.', steps,
        'Erst die Sichtprüfung, dann alle spannungsfreien Prüfungen (Schutzleiter, Isolation), danach stufenweises Zuschalten mit Spannungsmessung, dann die Funktionsprüfung, zuletzt das Protokoll.', ['Sicherheit zuerst: Alles Spannungsfreie kommt vor dem Einschalten.', 'Das Protokoll steht am Ende.']);
    },
    /* PRUEFEN P15: Ablauf der Schutzleiterprüfung. */
    pestep: R => orderQ(R, 'Die Schutzleiterprüfung an einem Schaltschrank läuft in diesen Schritten ab. Ordne sie.', C().PE_STEPS.slice(),
      'Erst spannungsfrei schalten und feststellen, dann Messgerät und Messleitungen prüfen, messen, die Werte bewerten und zuletzt dokumentieren.', ['Ohne Spannungsfreiheit wird nicht gemessen.', 'Bewerten kommt nach dem Messen, Dokumentieren zum Schluss.']),
    pnext: R => {
      const c = C(), i = c.ri(R, 0, PNX.length - 1), q = PNX[i], wrong = c.shuffle(R, PNX.filter((_, j) => j !== i)).slice(0, 3).map(x => x[1]);
      return choiceQ(R, 'Prüfung vor der Inbetriebnahme: ' + q[0] + ' Was tust du als Nächstes?', q[1], wrong, q[2], ['Frage dich: Ist die Anlage sicher und spannungsfrei, oder darfst du weiter?', 'Gefundene Mängel werden behoben, bevor du die nächste Stufe prüfst.']);
    },
    fsa: R => {
      const c = C(), NM = ['Q1 Werkstattsteckdosen', 'Q2 Kühlkreis-Pumpe', 'Q3 Heizregister', 'Q4 Absaugung', 'Q5 Kompressor', 'Q6 Lüftung Halle'], names = c.shuffle(R, NM).slice(0, 4), bad = c.ri(R, 0, 3);
      const rows = names.map((n, i) => {
        let s, In, ib;
        if (i === bad) { s = c.pick(R, [1.5, 2.5, 4]); const over = c.LS_IN.filter(x => x > c.maxIn(s)); In = over[0]; ib = Math.max(5, c.rd(c.maxIn(s) * (0.55 + 0.35 * R()), 0)); if (ib > In) ib = In - 2; }
        else { s = c.pick(R, [1.5, 2.5, 4, 6]); const ok = c.LS_IN.filter(x => x <= c.maxIn(s)); In = c.pick(R, ok.slice(Math.max(0, ok.length - 2))); const lo = c.LS_IN[Math.max(0, c.LS_IN.indexOf(In) - 1)]; ib = c.ri(R, lo, In); }
        return { n, s, In, ib, ch: c.pick(R, ['B', 'C']) };
      });
      const q = choiceQ(R, 'Du prüfst die Abgänge eines Schaltschranks (Übungstabelle Iz: 1,5 mm² = 16 A, 2,5 = 21 A, 4 = 28 A, 6 = 36 A, 10 = 50 A, 16 = 66 A):\n' + rows.map(r => r.n + ': Leitung ' + f(r.s, 1) + ' mm², LS ' + r.ch + r.In + ', Betriebsstrom ' + f(r.ib, 0) + ' A').join('\n') + '\nIn einem Abgang ist der Schutz nicht richtig ausgelegt. Welcher ist es?', names[bad], names.filter((_, i) => i !== bad),
        names[bad] + ': Der LS hat ' + rows[bad].In + ' A, die Leitung (' + f(rows[bad].s, 1) + ' mm²) trägt aber nur ' + c.izOf(rows[bad].s) + ' A. Bei Überlast würde der LS nicht rechtzeitig abschalten, die Leitung würde zu heiß. Alle anderen Abgänge erfüllen Betriebsstrom ≤ In ≤ Iz.', ['Vergleiche für jeden Abgang den LS-Strom mit der Strombelastbarkeit der Leitung.', 'Der LS-Strom darf nie größer sein als Iz.']);
      q.meta = { rows, bad }; return q;
    },
    /* PRUEFEN P22: Fehlerbild B (Farbe passt nicht zur Klemme, z. B. N und PE vertauscht). Die Folge „FI löst sofort oder gar nicht richtig aus, Gehäuse kann unter Spannung geraten“ ist vereinfacht dargestellt; stimmt die Beschreibung mit eurer Erfahrung überein? */
    fsb: R => {
      const c = C(), pairs = [['N', 'PE'], ['N', 'PE'], ['L1', 'L2'], ['L2', 'L3'], ['L1', 'N']], pr = c.pick(R, pairs), cols = Object.assign({}, c.INST_COL), a = pr[0], b = pr[1], t = cols[a]; cols[a] = cols[b]; cols[b] = t;
      const text = 'Vor der ersten Inbetriebnahme vergleichst du die Aderfarben am Einspeise-Klemmenblock X1 (Kabel der festen Installation, 5 × 2,5 mm²) mit dem Klemmenplan:\n' + c.TERM_ORDER.map((k, i) => 'X1:' + (i + 1) + ' (Plan: ' + k + '): Ader ' + cols[k]).join('\n') + '\nWelcher Verdrahtungsfehler liegt vor?';
      const opts = [['N', 'PE'], ['L1', 'L2'], ['L2', 'L3'], ['L1', 'N']].map(p => p[0] + ' und ' + p[1] + ' sind vertauscht'), right = a + ' und ' + b + ' sind vertauscht';
      return choiceQ(R, text, right, opts.filter(x => x !== right), 'Die Farben an ' + a + ' und ' + b + ' stimmen nicht mit dem Plan überein: An ' + a + ' sitzt ' + c.INST_COL[b] + ', an ' + b + ' sitzt ' + c.INST_COL[a] + '. ' + (a === 'N' ? 'Wird der Schutzleiter als N benutzt und umgekehrt, fließt Betriebsstrom über den Schutzleiter. Gehäuse können unter Spannung geraten, und ein FI löst sofort oder gar nicht richtig aus.' : 'Das Vertauschen von Leitern ändert Drehfeld oder Zuordnung. Vor dem Einschalten korrigieren.'), ['Vergleiche jede Zeile: Passt die Aderfarbe zum Planbuchstaben?', 'Nur die Zeilen, bei denen die Farbe nicht stimmt, sind betroffen.']);
    },
    /* PRUEFEN P23: Fehlerbild C (24 V fehlt am Schütz): Messkette Einspeisung, LS Q2, Netzteil G1, Sicherung F3, Schützspule K1; die fünf möglichen Ursachen sind vereinfacht. Fehlt eine häufige Ursache (z. B. Klemme lose, Sicherungsautomat statt Sicherung)? */
    fsc: R => {
      const c = C(), F = [
        ['Die Einspeisung vor dem LS Q2 ist spannungslos', [0, 0, 0, 0, 0]],
        ['Der LS Q2 hat ausgelöst oder ist ausgeschaltet', [230, 0, 0, 0, 0]],
        ['Das Netzteil G1 ist defekt', [230, 230, 0, 0, 0]],
        ['Die 24-V-Sicherung F3 hat ausgelöst', [230, 230, 24, 0, 0]],
        ['Das Schütz K1 selbst ist defekt', [230, 230, 24, 24, 24]]
      ], pts = ['vor dem LS Q2 (230 V AC)', 'am Netzteil-Eingang hinter Q2 (230 V AC)', 'am Netzteil-Ausgang (24 V DC)', 'hinter der Sicherung F3 (24 V DC)', 'an der Spule A1/A2 von Schütz K1 (24 V DC)'];
      const FEXP = ['Schon vor dem LS Q2 fehlt die Spannung: Die Einspeisung (Hauptschalter, vorgelagerter Schutz oder Netz) ist die Ursache.', 'Vor Q2 liegt Spannung an, dahinter nicht: Der LS Q2 ist ausgelöst oder ausgeschaltet.', 'Am Netzteil-Eingang liegen 230 V an, am Ausgang aber nichts: Das Netzteil G1 ist defekt.', 'Das Netzteil liefert 24 V, hinter der Sicherung F3 fehlen sie: F3 hat ausgelöst.', 'An der Spule liegen volle 24 V an, das Schütz zieht aber nicht an: Das Schütz K1 ist defekt.'];
      const i = c.ri(R, 0, F.length - 1), fl = F[i], wrongIdx = c.shuffle(R, F.map((_, j) => j).filter(j => j !== i)).slice(0, 3), noise = v => (v === 0 ? '0 V' : v === 230 ? (228 + c.ri(R, 0, 6)) + ' V' : f(23.8 + c.ri(R, 0, 4) / 10, 1) + ' V');
      return choiceQ(R, 'Das Schütz K1 zieht nicht an. Du misst die Spannung an fünf Punkten der Steuerspannungsversorgung (vom Netz bis zur Spule):\n' + pts.map((p, k) => (k + 1) + '. ' + p + ': ' + noise(fl[1][k])).join('\n') + '\nWo liegt die Ursache?', fl[0], wrongIdx.map(j => F[j][0]),
        FEXP[i], ['Suche den ersten Punkt, an dem die Spannung fehlt.', 'Das Gerät zwischen dem letzten Punkt mit Spannung und dem ersten ohne Spannung ist die Ursache.']);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    [CATS[0], 1, 'Auslösebereiche lesen', 'lschar'], [CATS[0], 1, 'Der RCD im Schrank', 'rcdq'], [CATS[0], 2, 'Welcher Automat passt?', 'lswhich'], [CATS[0], 2, 'Bemessungsstrom wählen', 'lspick'], [CATS[0], 2, 'Ansprechströme', 'lstrip'], [CATS[0], 2, 'Vom Netz zum Motor', 'protchain'], [CATS[0], 3, 'Wer schaltet zuerst ab?', 'selq'],
    [CATS[1], 1, 'Strom einer Last', 'i1ph'], [CATS[1], 2, 'Strom im Drehstromabgang', 'i3ph'], [CATS[1], 2, 'Leitung zum Automaten', 'crossq'], [CATS[1], 3, 'Abgang auslegen', 'cross3'], [CATS[1], 3, 'Querschnitt des Schutzleiters', 'peq'],
    [CATS[2], 1, 'Lasten an 24 V', 'sum24'], [CATS[2], 2, 'Netzteil mit Reserve', 'psu24'], [CATS[2], 2, 'Wärme im Netzteil', 'psuloss'], [CATS[2], 3, 'Strom auf der Netzseite', 'psuprim'], [CATS[2], 3, 'Wärmebilanz des Schranks', 'heatbal'], [CATS[2], 3, 'Luftmenge des Lüfters', 'fan'],
    [CATS[3], 1, 'Platz auf der Schiene', 'te'], [CATS[3], 1, 'Regeln im Schrank', 'ruleq'], [CATS[3], 2, 'Freie Plätze', 'railfree'], [CATS[3], 2, 'Layout prüfen A', 'laychoice'], [CATS[3], 2, 'Schrank ordnen A', 'lay', { sc: 'a', ks: 3, min: 2 }], [CATS[3], 3, 'Layout prüfen B', 'laycount'], [CATS[3], 3, 'Schrank ordnen B', 'lay', { sc: 'b', ks: 4, min: 3, unplace: true }], [CATS[3], 3, 'Schrank ordnen C', 'lay', { sc: 'c', ks: 4, min: 3, unplace: true }],
    [CATS[4], 1, 'Aderfarben zuordnen', 'colmatch'], [CATS[4], 1, 'Farben im Maschinenschrank', 'col'], [CATS[4], 2, 'Aderendhülsen', 'ferrule'], [CATS[4], 2, 'Reihenfolge der Klemmen', 'termorder'], [CATS[4], 2, 'Klemmenplan lesen', 'termread'], [CATS[4], 2, 'Sensor anschließen', 'termfill'],
    [CATS[5], 1, 'Mit oder ohne Spannung', 'spannung'], [CATS[5], 1, 'Messen und Prüfen', 'isoq'], [CATS[5], 2, 'Prüfreihenfolge', 'pruefreih'], [CATS[5], 2, 'Schutzleiterprüfung', 'pestep'], [CATS[5], 3, 'Befund und nächster Schritt', 'pnext'],
    [CATS[6], 2, 'Fehlerbild A', 'fsa'], [CATS[6], 3, 'Fehlerbild B', 'fsb'], [CATS[6], 3, 'Fehlerbild C', 'fsc']
  ];
  const tasks = defs.map((d, i) => ({ id: 'ssl' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; if (q.ask.type === 'layout' && q.tips == null) q.tips = ['Sortiere zuerst nach Bereichen.', 'Prüfe danach Wärme und Beschriftung.']; return q;
  }
  const makeTask = t => make(t, C().rng('ssl-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Auswertung (rein, ohne DOM) ---------- */
  /* Antwortformen a: { c } Auswahl, { v } Zahl (Text), { o } Reihenfolge (Indexliste), { m } Zuordnung (Indexliste), { lay } Layout.
     Ergebnis: { err } bei unvollständiger Antwort, sonst { ok, given, detail } */
  function evaluate(q, a) {
    const c = C(), as = q.ask; a = a || {};
    if (as.type === 'choice') { if (a.c == null) return { err: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === as.correct, given: as.choices[a.c] }; }
    if (as.type === 'num') { const v = c.parseDe(a.v); if (!Number.isFinite(v)) return { err: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (as.unit ? ' ' + as.unit : '') }; }
    if (as.type === 'order') { const o = a.o || []; if (o.length < as.items.length) return { err: 'Tippe alle Einträge in der richtigen Reihenfolge an.' }; return { ok: as.correct.every((x, i) => o[i] === x), given: o.map(i => as.items[i]).join(' → ') }; }
    if (as.type === 'match') { const m = a.m || []; if (as.rows.some((_, i) => m[i] == null)) return { err: 'Wähle für jede Zeile eine Zuordnung.' }; return { ok: as.correct.every((x, i) => m[i] === x), given: as.rows.map((r, i) => r + ' → ' + as.options[m[i]]).join('; ') }; }
    if (as.type === 'layout') {
      if (!a.lay || !a.lay.items) return { err: 'Ordne zuerst das Layout.' };
      const chk = c.checkLayout(a.lay, as.need, as.rules), bad = chk.rules.filter(r => !r.ok);
      return { ok: chk.ok, given: chk.ok ? 'Alle ' + chk.rules.length + ' Regeln erfüllt' : (chk.rules.length - bad.length) + ' von ' + chk.rules.length + ' Regeln erfüllt', detail: bad.map(r => r.t + ': ' + r.det.join('; ')), nbad: bad.length };
    }
    return { err: 'Unbekannte Frageform.' };
  }
  function solAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: as.correct };
    if (as.type === 'num') return { v: String(+q.value.toFixed(6)).replace('.', ',') };
    if (as.type === 'order') return { o: as.correct.slice() };
    if (as.type === 'match') return { m: as.correct.slice() };
    return { lay: C().cloneLayout(q.sol) };
  }
  function wrongAns(q) {
    const as = q.ask;
    if (as.type === 'choice') return { c: (as.correct + 1) % as.choices.length };
    if (as.type === 'num') return { v: '-12345' };
    if (as.type === 'order') return { o: as.correct.slice().reverse() };
    if (as.type === 'match') return { m: as.correct.map(x => (x + 1) % as.options.length) };
    return { lay: C().cloneLayout(as.start) };
  }
  function solText(q) {
    const as = q.ask;
    if (as.type === 'choice') return as.choices[as.correct];
    if (as.type === 'num') return f(q.value, 2) + (as.unit ? ' ' + as.unit : '');
    if (as.type === 'order') return as.correct.map(i => as.items[i]).join(' → ');
    if (as.type === 'match') return as.rows.map((r, i) => r + ' → ' + as.options[as.correct[i]]).join('; ');
    return 'Alle Regeln erfüllt (siehe Lösungsweg)';
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus SSL_CORE) ---------- */
  const examples = [
    { id: 'abg1', tab: 'sch', title: 'Heizlüfter an 230 V richtig absichern', text: 'Ein Heizlüfter mit 3 kW hängt an 230 V. Welcher Automat, welcher Querschnitt, und stimmt die Kombination B16 mit 1,5 mm²?', p: { ph: 1, P: '3000', U: '230', cos: '1', eta: '1', In: '16', S: '1,5', ch: 'B' } },
    { id: 'abg2', tab: 'sch', title: 'Drehstrommotor 5,5 kW', text: 'Ein Motor mit 5,5 kW Wellenleistung (400 V, cos φ 0,85, Wirkungsgrad 87 %). Wie groß sind Strom, LS und Leitung?', p: { ph: 3, P: '5500', U: '400', cos: '0,85', eta: '0,87', In: '13', S: '1,5', ch: 'C' } },
    { id: 'abg3', tab: 'sch', title: 'LS zu groß für die Leitung', text: 'Ein Abgang mit 1,5 mm² ist mit B20 abgesichert, der Verbraucher zieht 12 A. Was meldet die Prüfung?', p: { ph: 1, P: '2760', U: '230', cos: '1', eta: '1', In: '20', S: '1,5', ch: 'B' } },
    { id: 'lay1', tab: 'lay', title: 'Verteiler mit Kleinsteuerung: ordentliches Layout', text: 'Hauptschalter oben, Leistung und Steuerung getrennt, Trennsteg im Kanal, alles beschriftet. Wie sieht die Regelprüfung aus?', p: { sc: 'a', mode: 'sol' } },
    { id: 'lay2', tab: 'lay', title: 'Pumpenschrank: Wärme, Kanal und Beschriftung', text: 'Ein Layout mit Verstößen: Die SPS sitzt über dem Schütz, im oberen Kanal fehlt der Trennsteg, ein LS ist nicht beschriftet. Welche Regeln schlagen an, und wie viel Verlustleistung entsteht?', p: { sc: 'b', mode: 'bad', L: { items: [{ p: 'hs', r: 0, x: 0, lab: true }, { p: 'fi', r: 0, x: 3, lab: true }, { p: 'nt', r: 0, x: 7, lab: true }, { p: 'klL', r: 0, x: 12, lab: true }, { p: 'sps', r: 1, x: 0, lab: true }, { p: 'rel', r: 1, x: 8, lab: true }, { p: 'rel', r: 1, x: 9, lab: true }, { p: 'klS', r: 1, x: 10, lab: true }, { p: 'ls3', r: 2, x: 0, lab: true }, { p: 'sk', r: 2, x: 3, lab: true }, { p: 'ls1', r: 2, x: 6, lab: false }, { p: 'ls1', r: 2, x: 7, lab: true }], sep: [false, true] } } },
    { id: 'lay3', tab: 'lay', title: 'Antriebsschrank mit Umrichter', text: 'Umrichter und Netzteil sind zwei Wärmequellen. So sieht ein richtiges Layout aus.', p: { sc: 'c', mode: 'sol' } },
    { id: 'ver1', tab: 'ver', title: 'Einspeiseklemmen X1 in der üblichen Reihenfolge', text: 'Kabel 5 × 2,5 mm²: Die Klemmen X1:1 bis X1:5 mit den Aderfarben der festen Installation.', p: { view: 'x1' } },
    { id: 'ver2', tab: 'ver', title: 'Farben im Maschinenschrank', text: 'Einzeladern im Schrank nach EN 60204-1 und die üblichen Aderendhülsen.', p: { view: 'schrank' } },
    { id: 'pru1', tab: 'pru', title: 'Prüfablauf: erst spannungsfrei', text: 'Die ersten drei Schritte sind abgehakt. Was kommt jetzt, und was darf noch nicht?', p: { done: 3 } }
  ];

  root.SSL_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, scenarios: SCEN, solution, brokenOne, brokenMany, mutate, evaluate, solAns, wrongAns, solText, pools: { RDQ, SELQ, RLQ, COQ, ISQ, PNX } };
  root.SSL_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.SSL_DATA, TASKS: root.SSL_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
