'use strict';
/* Tonfunk Regelkreis-Lab: Daten (Aufgaben-Generatoren, Beispiele).
   ALLE Zahlenwerte sind ÜBUNGSWERTE, keine echte Anlage.
   window.RKR_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples }
   window.RKR_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'rkr', Status in localStorage 'lm4.rkr.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Diagramm-Aufgaben tragen q.sims = [{kind:'closed'|'open'|'ctrl', cfg, label, band}]; die Oberfläche zeichnet daraus die Kurven.
   Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder das Ergebnis noch den Fehler; Ursache oder Wert muss am Diagramm gefunden werden. */
(function (root) {
  const C = () => root.RKR_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Regelkreis und Begriffe', 'Strecke und Sprungantwort', 'Totzeit und Ordnung', 'P-Regler', 'I- und PI-Regler', 'PID-Regler', 'Stabilität und Schwingen', 'Störung und Führung', 'Zweipunktregler'];

  const numQ = (text, value, unit, label, tol, expl, tips, sims) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, sims: sims || null });
  function choiceQ(R, text, right, wrong, expl, tips, sims) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, sims: sims || null };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const S = (kind, cfg, extra) => Object.assign({ kind, cfg }, extra || {});

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P15: Einteilung der Beispiele in Steuerung (offener Wirkungsablauf, keine Rückmeldung des Istwerts) und Regelung (geschlossener Wirkungsablauf nach DIN 19226). Passen die Alltagsbeispiele zum Unterricht? */
  const RG = 'Regelung (geschlossener Wirkungsablauf, der Istwert wird zurückgemeldet)', ST = 'Steuerung (offener Wirkungsablauf, keine Rückmeldung des Istwerts)', WN = 'Weder noch: Es wird nur ein Wert angezeigt';
  const STEUQ = [
    ['Steuern oder regeln? Ein Raumthermostat misst die Raumtemperatur und öffnet oder schließt das Heizkörperventil, bis die Wunschtemperatur erreicht ist.', RG, [ST, WN], 'Der Thermostat misst den Istwert (Raumtemperatur) und vergleicht ihn mit dem Sollwert. Er beeinflusst die Heizung so lange, bis beide übereinstimmen. Das ist ein geschlossener Wirkungsablauf, also eine Regelung.', ['Wird der Istwert zurückgemeldet?', 'Geschlossener Kreis: Ausgang wirkt auf den Eingang zurück.']],
    ['Steuern oder regeln? Ein Scheibenwischer läuft in Stufe 2 immer gleich schnell, egal wie nass die Scheibe ist.', ST, [RG, WN], 'Die Wischgeschwindigkeit hängt nicht davon ab, wie nass die Scheibe ist. Es gibt keine Rückmeldung des Istwerts, also ist es eine Steuerung (offener Wirkungsablauf).', ['Reagiert die Anlage auf das Ergebnis (nasse Scheibe)?', 'Ohne Rückmeldung des Istwerts gibt es keinen Regelkreis.']],
    ['Steuern oder regeln? Ein Tempomat hält die Fahrzeuggeschwindigkeit auch am Berg konstant, indem er die Motorleistung nachführt.', RG, [ST, WN], 'Die Geschwindigkeit wird gemessen und mit der Wunschgeschwindigkeit verglichen. Weicht sie ab, ändert der Regler die Motorleistung. Das ist eine Regelung.', ['Es wird gemessen, verglichen und nachgeführt.', 'Der Berg ist eine Störgröße, die der Kreis ausgleicht.']],
    ['Steuern oder regeln? Das Treppenhauslicht wird mit einem Zeitrelais nach zwei Minuten abgeschaltet, auch wenn noch jemand im Treppenhaus ist.', ST, [RG, WN], 'Das Relais schaltet nach fester Zeit ab. Es misst nicht, ob noch jemand im Treppenhaus ist. Ohne Rückmeldung ist das eine Steuerung.', ['Nimmt die Anlage den Istzustand auf?', 'Das Ergebnis (Licht noch gebraucht?) wirkt nicht zurück.']],
    ['Steuern oder regeln? Die Drehzahl eines Gleichstrommotors wird mit einem Tachogenerator gemessen und über einen Thyristorsteller so nachgeführt, dass sie bei Belastung konstant bleibt.', RG, [ST, WN], 'Der Tachogenerator meldet die Ist-Drehzahl zurück, der Regler vergleicht sie mit dem Sollwert und stellt den Thyristorsteller nach. Das ist ein Regelkreis.', ['Welches Bauteil meldet den Istwert zurück?', 'Rückmeldung = Regelung.']],
    ['Steuern oder regeln? Ein Lüfter läuft auf Stufe 3, egal wie warm es im Schaltschrank ist.', ST, [RG, WN], 'Die Stufe wird von Hand gewählt und hängt nicht von der Temperatur ab. Es gibt keine Rückmeldung, also eine Steuerung.', ['Gibt es einen Temperaturfühler im Kreis?', 'Ohne Fühler kein Regelkreis.']],
    ['Steuern oder regeln? Ein Füllstandsregler öffnet ein Zulaufventil, sobald der Pegel im Behälter unter den Sollwert sinkt, und schließt es wieder, wenn der Sollwert erreicht ist.', RG, [ST, WN], 'Der Pegel wird gemessen und mit dem Sollwert verglichen, das Ventil wirkt auf den Pegel zurück. Das ist eine Regelung.', ['Wird der Pegel gemessen?', 'Das Ventil beeinflusst genau die Größe, die gemessen wird.']],
    ['Steuern oder regeln? Eine Ampel schaltet nach einem festen Zeitplan, unabhängig vom Verkehr.', ST, [RG, WN], 'Die Ampel arbeitet nach einem festen Programm ohne Rückmeldung des Verkehrs. Es ist eine Steuerung.', ['Wird der Verkehr gemessen?', 'Fester Zeitplan = offene Kette.']]
  ];
  /* Begriffe des Regelkreises (nach DIN 19226), eigene Beschreibung */
  const NAMEN = ['Regelgröße x', 'Führungsgröße w', 'Stellgröße y', 'Störgröße z', 'Regelabweichung e'];
  const BEGR = [
    ['Die Größe, die der Kreis konstant halten soll und die gemessen wird, zum Beispiel die Raumtemperatur.', 0],
    ['Der Wert, den der Bediener vorgibt und dem die geregelte Größe folgen soll, zum Beispiel die am Drehknopf eingestellte Temperatur.', 1],
    ['Die Größe, mit der der Regler über das Stellglied auf die Strecke wirkt, zum Beispiel die Ventilstellung oder der Heizstrom.', 2],
    ['Eine von außen wirkende, nicht gewollte Größe, zum Beispiel ein geöffnetes Fenster oder eine zusätzliche Belastung der Welle.', 3],
    ['Die Differenz zwischen Führungsgröße und Regelgröße, die der Regler ausgleichen soll.', 4]
  ];
  const ROLLEN = ['Regler', 'Stellglied', 'Regelstrecke', 'Messeinrichtung'];
  const BAUT = [
    ['In einer Raumheizung ist der Raum selbst (Luft und Wände) die geregelte Anlage. Welche Rolle hat er im Regelkreis?', 2],
    ['Im Raum misst ein Temperaturfühler die Ist-Temperatur. Welche Rolle hat er?', 3],
    ['Das Heizkörperventil mit elektrischem Stellantrieb ändert den Wasserdurchfluss. Welche Rolle hat es?', 1],
    ['Eine Elektronik vergleicht Soll- und Ist-Temperatur und bildet daraus das Stellsignal. Welche Rolle hat sie?', 0],
    ['Bei einer Drehzahlregelung formt ein Thyristorsteller die Ankerspannung des Motors. Welche Rolle hat er?', 1],
    ['Bei einer Drehzahlregelung liefert ein Tachogenerator eine Spannung, die zur Drehzahl proportional ist. Welche Rolle hat er?', 3],
    ['Bei einer Drehzahlregelung dreht der Gleichstrommotor mit der angekoppelten Last. Welche Rolle hat der Motor mit Last?', 2]
  ];
  /* PRUEFEN P16: Zuordnung Bauteil zu Rolle im Regelkreis (Thyristorsteller als Stellglied, Motor als Strecke, Tachogenerator als Messeinrichtung) folgt der Mitschrift LF 7.2 Kapitel 2, wo Stellglied, Strecke und Messeinrichtung zur "Regelstrecke" im weiteren Sinn zusammengefasst werden. Soll im Lab zwischen Stellglied und Strecke getrennt werden? */
  /* PRUEFEN P17: Ordnungszahl n = Anzahl der Energiespeicher; n = 1 PT1, n = 2 PT2, n = 3 PT3. Ein Spannungsteiler ohne Kondensator wird als Strecke ohne Verzögerung (n = 0) eingestuft. Sind die Beispiele (Heizelement mit Block und Behälter, drei Tanks) für den Unterricht passend? */
  const ORDQ = [
    ['Ein Heizdraht erwärmt direkt ein kleines Metallplättchen. Nur das Plättchen speichert merklich Wärme. Welche Ordnungszahl n hat diese Strecke?', 'n = 1', ['n = 0', 'n = 2', 'n = 3'], 'Es gibt einen Energiespeicher (das Plättchen). Die Ordnungszahl ist die Zahl der Energiespeicher, hier also n = 1 (PT1).', ['Zähle die Speicher, die Energie aufnehmen.', 'Ein Speicher = eine Verzögerung.']],
    ['Ein Heizelement erwärmt zuerst einen Metallblock, der Block erwärmt einen Wasserbehälter dahinter. Beide speichern Wärme und sind hintereinander geschaltet. Welche Ordnungszahl n hat die Strecke?', 'n = 2', ['n = 0', 'n = 1', 'n = 3'], 'Zwei hintereinander liegende Energiespeicher ergeben n = 2 (PT2). Die Regelgröße reagiert deshalb träger als bei n = 1.', ['Wie viele Speicher liegen hintereinander?', 'Block und Behälter zählen je einen.']],
    ['Ein Wasserkreislauf besteht aus drei Behältern, die hintereinander durchflossen werden und alle eine nennenswerte Wassermenge speichern. Welche Ordnungszahl n hat die Strecke?', 'n = 3', ['n = 0', 'n = 1', 'n = 2'], 'Jeder Behälter ist ein Speicher, zusammen also n = 3. Je größer n ist, desto langsamer ändert sich die Regelgröße nach einem Sprung.', ['Jeder Behälter ist ein Energiespeicher.', 'Drei Speicher in Reihe.']],
    ['Eine Strecke besteht nur aus einem Spannungsteiler aus zwei Widerständen, ohne Kondensator und ohne Spule. Welche Ordnungszahl n hat sie?', 'n = 0', ['n = 1', 'n = 2', 'n = 3'], 'Ohne Energiespeicher gibt es keine Verzögerung: Die Ausgangsspannung folgt dem Sprung sofort (PT0, nur Proportionalverhalten).', ['Gibt es einen Speicher für Energie (Kondensator, Spule, Masse, Wärme)?', 'Ohne Speicher keine Verzögerung.']],
    ['Am Ausgang einer Verstärkerstufe liegt ein RC-Glied mit einem Kondensator, das die Spannung glättet. Welche Ordnungszahl n hat dieses Glied?', 'n = 1', ['n = 0', 'n = 2', 'n = 3'], 'Der Kondensator ist der einzige Energiespeicher, also n = 1 (PT1, Zeitkonstante T = R·C).', ['Wie viele Kondensatoren oder Spulen sind im Weg?', 'Einer.']]
  ];
  const IQ = [
    ['Die Regelabweichung bleibt konstant bei 4 %. Wie verhält sich die Stellgröße eines reinen I-Reglers?', 'Sie steigt gleichmäßig an (Rampe), solange die Regelabweichung nicht null ist', ['Sie bleibt konstant bei einem festen Wert', 'Sie springt sofort auf Kp · e und bleibt dort', 'Sie fällt allmählich auf null'], 'Der I-Regler summiert die Regelabweichung auf: y = (1/Tn) · ∫e dt. Bei konstantem e wächst y gleichmäßig an, also als Rampe.', ['Integrieren heißt aufsummieren.', 'Konstanter Eingang ergibt beim Integrator eine Rampe.']],
    ['Wann hört die Stellgröße eines I-Reglers auf, sich zu ändern?', 'Wenn die Regelabweichung null ist', ['Wenn die Stellgröße 100 % erreicht hat', 'Wenn der Sollwert verdoppelt wird', 'Nie, sie ändert sich immer weiter'], 'Der Integrator hält seinen Wert, wenn sein Eingang null ist. Das heißt: Regelabweichung gleich null, Istwert gleich Sollwert.', ['Was steht am Eingang des Integrators, wenn nichts mehr zu ändern ist?', 'Ohne Eingang bleibt der Ausgang stehen.']],
    ['Welchen Vorteil hat ein Regler mit I-Anteil gegenüber einem reinen P-Regler?', 'Er beseitigt die bleibende Regelabweichung', ['Er reagiert immer schneller', 'Er verhindert jedes Überschwingen', 'Er braucht keine Messeinrichtung'], 'Solange e ungleich null ist, integriert der I-Anteil weiter. Erst bei e = 0 bleibt die Stellgröße stehen. So gleicht der Regler die Abweichung vollständig aus.', ['Was bleibt beim reinen P-Regler übrig?', 'Der I-Anteil wirkt, bis die Abweichung weg ist.']],
    ['Was kann passieren, wenn der I-Anteil zu stark eingestellt ist (Nachstellzeit Tn zu klein)?', 'Der Regelkreis neigt zum Schwingen', ['Die bleibende Regelabweichung wächst', 'Der Regler wird träger', 'Die Strecke bekommt eine Totzeit'], 'Ein starker I-Anteil baut die Stellgröße schnell auf. Die Strecke reagiert verzögert, die Stellgröße schießt über, und der Kreis schwingt.', ['Starker I-Anteil heißt: Stellgröße wächst schnell.', 'Verzögerte Strecke und schneller Regler: Überschwingen.']],
    ['Warum braucht ein reiner I-Regler länger als ein P-Regler, um auf eine Regelabweichung zu reagieren?', 'Seine Stellgröße muss sich erst über die Zeit aufintegrieren', ['Er rechnet mit einer Totzeit von einer Minute', 'Er arbeitet nur bei Zweipunktstrecken', 'Er hat keinen Ausgang'], 'Ein P-Regler springt sofort auf Kp · e. Beim I-Regler startet die Stellgröße bei null und steigt erst allmählich an.', ['Beim Sprung am Eingang: Wie sieht der Ausgang beim I-Regler zuerst aus?', 'Rampe beginnt bei null.']]
  ];
  const ANTQ = [
    ['Welcher Anteil eines PID-Reglers reagiert sofort und im gleichen Verhältnis auf die Regelabweichung?', 'P-Anteil (proportional)', ['I-Anteil (integrierend)', 'D-Anteil (differenzierend)'], 'Der P-Anteil bildet y = Kp · e ohne Verzögerung.', ['Gleiche Form wie die Abweichung, nur verstärkt.', 'Kp ist sein Parameter.']],
    ['Welcher Anteil summiert die Regelabweichung über die Zeit auf?', 'I-Anteil (integrierend)', ['P-Anteil (proportional)', 'D-Anteil (differenzierend)'], 'Der I-Anteil integriert e über der Zeit. Sein Parameter ist die Nachstellzeit Tn.', ['Integrieren = aufsummieren.', 'Tn gehört dazu.']],
    ['Welcher Anteil reagiert auf die Änderungsgeschwindigkeit der Regelabweichung und greift darum früh ein?', 'D-Anteil (differenzierend)', ['P-Anteil (proportional)', 'I-Anteil (integrierend)'], 'Der D-Anteil bildet die Steigung der Regelabweichung (Tv · de/dt). Wächst e schnell, gibt er sofort einen kräftigen Stellimpuls.', ['Differenzieren = Steigung.', 'Tv (Vorhaltezeit) gehört dazu.']],
    ['Welcher Anteil beseitigt die bleibende Regelabweichung?', 'I-Anteil (integrierend)', ['P-Anteil (proportional)', 'D-Anteil (differenzierend)'], 'Nur der I-Anteil ändert die Stellgröße weiter, solange e nicht null ist, und gleicht die Abweichung damit ganz aus.', ['Welcher Anteil hört erst bei e = 0 auf?', 'Aufsummieren.']],
    ['Welcher Anteil liefert bei einer konstanten Regelabweichung ungleich null keinen Beitrag zur Stellgröße?', 'D-Anteil (differenzierend)', ['P-Anteil (proportional)', 'I-Anteil (integrierend)'], 'Bei konstantem e ist die Steigung null, also ist der D-Anteil null. P und I liefern weiter einen Beitrag.', ['Wie groß ist die Steigung einer konstanten Größe?', 'Null.']]
  ];
  const WIRKQ = [
    ['Was bewirkt eine größere Vorhaltezeit Tv beim PID-Regler?', 'Der Regler greift bei schnellen Änderungen stärker ein und dämpft das Überschwingen', ['Die bleibende Regelabweichung verschwindet', 'Der I-Anteil wird stärker', 'Die Strecke wird schneller'], 'Tv wichtet den D-Anteil. Bei schnell wachsender Regelabweichung bremst der D-Anteil früh und dämpft das Überschwingen (bei starkem Messrauschen kann er aber stören).', ['Tv gehört zum D-Anteil.', 'D reagiert auf die Steigung.']],
    ['Was bewirkt eine kleinere Nachstellzeit Tn beim PI-Regler?', 'Der I-Anteil wirkt stärker: schnelleres Ausregeln, aber höhere Schwinggefahr', ['Der I-Anteil verschwindet', 'Die Totzeit der Strecke sinkt', 'Der P-Anteil wird null'], 'Je kleiner Tn, desto schneller wächst der I-Anteil. Die Abweichung wird schneller ausgeregelt, der Kreis neigt aber eher zum Schwingen.', ['Tn steht im Nenner des I-Anteils.', 'Kleineres Tn = stärkerer I-Anteil.']],
    ['Warum kann der D-Anteil bei einem verrauschten Messsignal Probleme machen?', 'Er verstärkt schnelle Schwankungen des Messwerts stark', ['Er speichert das Rauschen dauerhaft', 'Er sperrt den I-Anteil', 'Er verlängert die Totzeit'], 'Rauschen besteht aus schnellen Änderungen. Der D-Anteil reagiert auf die Steigung und verstärkt gerade diese schnellen Änderungen, die Stellgröße zappelt.', ['Wie sieht die Steigung von Rauschen aus?', 'Schnelle Änderungen = große Steigung.']],
    ['Was passiert im Allgemeinen, wenn der Verstärkungsfaktor Kp größer wird?', 'Der Regler reagiert schneller, die bleibende Abweichung wird kleiner, die Schwinggefahr wächst', ['Die Schwinggefahr sinkt immer', 'Die bleibende Abweichung wird größer', 'Es ändert sich nichts'], 'Größeres Kp heißt größere Stellgröße bei gleicher Abweichung: schneller und genauer, aber der Kreis kommt näher an die Stabilitätsgrenze.', ['Mehr Verstärkung bringt Tempo und Genauigkeit.', 'Zu viel Verstärkung schwingt.']]
  ];
  const STOQ = [
    ['Bei einem Raumthermostat wird der Drehknopf von 20 °C auf 22 °C gestellt. Welche Größe ändert sich dadurch zuerst?', 'Führungsgröße w', ['Störgröße z', 'Stellgröße y', 'Regelgröße x'], 'Der Bediener verändert den Sollwert. Das ist eine Änderung der Führungsgröße w.', ['Wer ändert den Wert, und wofür steht er?', 'Der Drehknopf gibt den Sollwert vor.']],
    ['Während des Heizens wird ein Fenster geöffnet, kalte Luft strömt ein. Welche Größe ist das?', 'Störgröße z', ['Führungsgröße w', 'Stellgröße y', 'Regelgröße x'], 'Die kalte Luft wirkt von außen auf die Strecke und ist nicht gewollt. Sie ist eine Störgröße z.', ['Kommt die Änderung von außen und ungewollt?', 'Der Regler muss sie ausgleichen.']],
    ['Bei einer Drehzahlregelung wird die Welle zusätzlich durch eine Bremse belastet. Welche Größe ist das?', 'Störgröße z', ['Führungsgröße w', 'Stellgröße y', 'Regelgröße x'], 'Die zusätzliche Last wirkt als Störgröße auf die Strecke (Motor mit Last). Der Regler stellt die Spannung nach.', ['Wer bestimmt die Last, der Regler oder die Umgebung?', 'Die Umgebung, also Störgröße.']],
    ['Beim Tempomat wird die Wunschgeschwindigkeit von 80 km/h auf 100 km/h erhöht. Welche Größe ändert sich?', 'Führungsgröße w', ['Störgröße z', 'Stellgröße y', 'Regelgröße x'], 'Die Wunschgeschwindigkeit ist der Sollwert, also die Führungsgröße w. Die Regelgröße x (tatsächliche Geschwindigkeit) folgt ihr nach.', ['Welche Größe gibt der Fahrer vor?', 'Der Sollwert heißt Führungsgröße.']],
    ['Bei einem Füllstandsregler wird aus dem Behälter plötzlich mehr Wasser entnommen, weil ein Verbraucher dazukommt. Welche Größe ist das?', 'Störgröße z', ['Führungsgröße w', 'Stellgröße y', 'Regelgröße x'], 'Der zusätzliche Abfluss wirkt von außen auf den Pegel. Der Regler muss den Zulauf nachstellen. Der Abfluss ist die Störgröße.', ['Wer verursacht den Abfluss?', 'Nicht der Regler.']],
    ['Der Bediener erhöht an einem Regler den eingestellten Sollwert. Welche Größe verändert er?', 'Führungsgröße w', ['Störgröße z', 'Stellgröße y', 'Regelgröße x'], 'Der Sollwert ist die Führungsgröße. Die Regelgröße ändert sich erst danach, weil der Regler die Strecke nachführt.', ['Sollwert = ?', 'Vorgabe von außen, aber gewollt.']]
  ];

  /* ---------- Generatoren ---------- */
  const G = {
    steuern: pq(STEUQ),
    groesse: R => {
      const c = C(), b = c.pick(R, BEGR), right = NAMEN[b[1]];
      return choiceQ(R, 'Welcher Begriff ist gemeint? ' + b[0], right, NAMEN.filter(x => x !== right), 'Gemeint ist die ' + right + '. Merke: x Regelgröße, w Führungsgröße, y Stellgröße, z Störgröße, e = w − x Regelabweichung.', ['Gehe die fünf Begriffe nacheinander durch.', 'Wer bestimmt die Größe: Bediener, Regler oder Umwelt?']);
    },
    bauteil: R => {
      const c = C(), b = c.pick(R, BAUT), right = ROLLEN[b[1]];
      return choiceQ(R, b[0], right, ROLLEN.filter(x => x !== right), 'Die Rolle ist: ' + right + '. Der Regler bildet das Stellsignal, das Stellglied setzt es um, die Strecke ist die zu regelnde Anlage, die Messeinrichtung meldet den Istwert zurück.', ['Was macht das Bauteil mit dem Signal?', 'Regler vergleicht, Stellglied stellt, Strecke ist die Anlage, Messeinrichtung misst.']);
    },
    abw: R => {
      const c = C(), w = c.ri(R, 4, 16) * 5, d = c.pick(R, [-8, -6, -5, -3, 2, 3, 4, 5, 6, 8, 10]), x = w - d;
      return numQ('Ein Regler soll eine Temperatur auf w = ' + f(w, 0) + ' °C halten. Gemessen wird x = ' + f(x, 0) + ' °C. Berechne die Regelabweichung e = w − x (Vorzeichen beachten).', d, '°C', 'Regelabweichung', 0.01,
        'e = w − x = ' + f(w, 0) + ' °C − ' + f(x, 0) + ' °C = ' + f(d, 0) + ' °C. ' + (d > 0 ? 'Der Istwert liegt unter dem Sollwert, e ist positiv: Der Regler muss mehr heizen.' : 'Der Istwert liegt über dem Sollwert, e ist negativ: Der Regler muss weniger heizen.'), ['Führungsgröße minus Regelgröße.', 'Liegt der Istwert über dem Sollwert, wird das Ergebnis negativ.']);
    },
    ksofen: R => {
      const c = C(), ctx = c.pick(R, [
        { n: 'einem elektrisch beheizten Ofen', y: 'der Heizstrom', yu: 'A', x: 'die Temperatur', xu: '°C', Ks: [2, 4, 5, 8, 10], y1: [2, 3, 4, 5], dy: [1, 2, 3], x1: [40, 50, 60, 80], u: '°C/A' },
        { n: 'einer Förderpumpe', y: 'die Stellspannung', yu: 'V', x: 'der Förderstrom', xu: 'l/min', Ks: [3, 4, 5, 6], y1: [1, 2, 3], dy: [1, 2, 3, 4], x1: [5, 10, 15, 20], u: '(l/min)/V' },
        { n: 'einem Gleichstrommotor', y: 'die Ankerspannung', yu: 'V', x: 'die Drehzahl', xu: '1/min', Ks: [20, 25, 40, 50], y1: [20, 40, 60], dy: [10, 20, 30], x1: [500, 800, 1000], u: '(1/min)/V' }]);
      const Ks = c.pick(R, ctx.Ks), y1 = c.pick(R, ctx.y1), dy = c.pick(R, ctx.dy), x1 = c.pick(R, ctx.x1), y2 = y1 + dy, x2 = x1 + Ks * dy;
      return numQ('Bei ' + ctx.n + ' wird ' + ctx.y + ' von ' + f(y1, 0) + ' ' + ctx.yu + ' auf ' + f(y2, 0) + ' ' + ctx.yu + ' erhöht. Nach Ende des Einschwingens ist ' + ctx.x + ' von ' + f(x1, 0) + ' ' + ctx.xu + ' auf ' + f(x2, 0) + ' ' + ctx.xu + ' gestiegen. Berechne den Übertragungsbeiwert Ks der Strecke.', Ks, ctx.u, 'Übertragungsbeiwert Ks', 0.01,
        'Ks = Δx / Δy = (' + f(x2, 0) + ' − ' + f(x1, 0) + ') ' + ctx.xu + ' / (' + f(y2, 0) + ' − ' + f(y1, 0) + ') ' + ctx.yu + ' = ' + f(x2 - x1, 0) + ' / ' + f(dy, 0) + ' = ' + f(Ks, 0) + ' ' + ctx.u + '.', ['Ks ist Änderung der Regelgröße durch Änderung der Stellgröße.', 'Beide Differenzen bilden, dann dividieren.']);
    },
    tablesen: R => {
      const c = C(), Ks = c.pick(R, [1, 1.5, 2]), T = c.pick(R, [1.5, 2, 2.5, 3, 4]), cfg = { reg: 'offen', str: 'PT1', Ks, T1: T, w: 10, tEnd: Math.ceil(6 * T) };
      return numQ('Eine Strecke erhält einen Sprung der Stellgröße von 0 auf 10 %. Das Diagramm zeigt die Regelgröße x (gestrichelt: der Sprung am Eingang). Lies die Zeitkonstante T der Strecke ab.', T, 's', 'Zeitkonstante T', Math.max(0.3, 0.12 * T),
        'Der Endwert ist Ks · 10 % = ' + f(Ks * 10, 1) + ' %. Bei t = T hat die Sprungantwort 63 % ihres Endwerts erreicht, also ' + f(0.632 * Ks * 10, 1) + ' %. Dort liest du T = ' + f(T, 1) + ' s ab.', ['Erst den Endwert ablesen.', '63 % vom Endwert, dann nach unten auf die Zeitachse gehen.'], [S('open', cfg)]);
    },
    pt1wert: R => {
      const c = C(), Ks = c.pick(R, [1.5, 2, 2.5, 3]), T = c.pick(R, [2, 3, 4, 5]), k = c.pick(R, [1, 2, 3]), du = c.pick(R, [10, 20, 30]), t = k * T, v = c.pt1(t, Ks, T, du);
      return numQ('Eine PT1-Strecke mit Ks = ' + f(Ks, 1) + ' und T = ' + f(T, 0) + ' s erhält einen Stellgrößensprung von ' + f(du, 0) + ' %. Wie groß ist die Regelgröße x nach t = ' + f(t, 0) + ' s?', v, '%', 'Regelgröße x', 0.15,
        'x(t) = Ks · Δu · (1 − e^(−t/T)) = ' + f(Ks, 1) + ' · ' + f(du, 0) + ' · (1 − e^(−' + f(k, 0) + ')) = ' + f(Ks * du, 1) + ' · ' + f(1 - Math.exp(-k), 3) + ' = ' + f(v, 2) + ' %. (Nach t = ' + f(k, 0) + '·T sind ' + f((1 - Math.exp(-k)) * 100, 1) + ' % des Endwerts erreicht.)', ['Der Endwert ist Ks · Δu.', 'e^(−1) = 0,368, e^(−2) = 0,135, e^(−3) = 0,050.']);
    },
    ausgleich: R => {
      const c = C(), v = c.pick(R, ['PT1', 'PT2', 'I']), A = 'Strecke mit Ausgleich: x strebt einem festen Endwert zu', B = 'Strecke ohne Ausgleich: x steigt immer weiter, solange der Sprung anliegt', Cc = 'Das Diagramm zeigt keine Strecke, sondern den Ausgang eines Zweipunktreglers';
      const cfg = v === 'PT1' ? { reg: 'offen', str: 'PT1', Ks: 1.5, T1: 3, w: 10, tEnd: 20 } : v === 'PT2' ? { reg: 'offen', str: 'PT2', Ks: 1.2, T1: 3, T2: 1.5, Tt: 0, w: 10, tEnd: 25 } : { reg: 'offen', str: 'I', Ks: 0.3, w: 10, tEnd: 20 };
      const right = v === 'I' ? B : A;
      return choiceQ(R, 'Eine Regelstrecke erhält einen Sprung der Stellgröße. Das Diagramm zeigt die Regelgröße x (gestrichelt: der Sprung am Eingang). Welche Aussage stimmt?', right, v === 'I' ? [A, Cc] : [B, Cc],
        v === 'I' ? 'Die Regelgröße steigt gleichmäßig weiter, es stellt sich kein Beharrungszustand ein. Das ist eine Strecke ohne Ausgleich (z. B. Füllstand eines Behälters bei konstantem Zulauf).' : 'Die Regelgröße läuft auf einen festen Endwert zu (Beharrungszustand). Das ist eine Strecke mit Ausgleich.', ['Bleibt x irgendwann stehen?', 'Mit Ausgleich: neuer fester Wert. Ohne Ausgleich: x läuft weiter.'], [S('open', cfg)]);
    },
    totlesen: R => {
      const c = C(), Tt = c.pick(R, [1, 1.5, 2, 2.5, 3]), T = c.pick(R, [2, 3, 4]), Ks = c.pick(R, [1, 1.5]), cfg = { reg: 'offen', str: 'PT1', Ks, T1: T, Tt, w: 10, tEnd: Math.ceil(Tt + 5 * T) };
      return numQ('Eine Strecke erhält zum Zeitpunkt t = 0 einen Sprung der Stellgröße (gestrichelt). Das Diagramm zeigt die Regelgröße x am Messort. Wie lang ist die Totzeit der Strecke?', Tt, 's', 'Totzeit', 0.3,
        'Die Regelgröße bleibt zunächst bei 0 und beginnt erst nach der Totzeit zu steigen. Hier setzt die Wirkung bei t = ' + f(Tt, 1) + ' s ein. Während der Totzeit wird die Regelgröße nicht beeinflusst.', ['Wann beginnt die Kurve zu steigen?', 'Das ist die Zeit zwischen Sprung und erster Wirkung.'], [S('open', cfg)]);
    },
    totband: R => {
      const c = C(), v = c.pick(R, [0.5, 1, 1.5, 2, 3]), L = c.pick(R, [6, 9, 12, 15, 18, 24]), t = c.rd(c.tt(L, v), 2);
      return numQ('Ein Förderband von ' + f(L, 0) + ' m Länge läuft mit ' + f(v, 1) + ' m/s. Am Bandanfang dosiert ein Stellglied Schüttgut, am Bandende misst eine Waage das Gewicht. Wie groß ist die Totzeit der Regelstrecke?', t, 's', 'Totzeit', 0.05,
        'Die Totzeit ist die Transportzeit: Tt = Länge / Geschwindigkeit = ' + f(L, 0) + ' m / ' + f(v, 1) + ' m/s = ' + f(t, 2) + ' s. Erst nach dieser Zeit wirkt eine Änderung der Dosierung an der Waage.', ['Wie lange braucht das Gut vom Anfang bis zum Ende?', 'Zeit = Weg / Geschwindigkeit.']);
    },
    ordnung: pq(ORDQ),
    regelbar: R => {
      const c = C(); let Tu, Tg, r;
      for (let i = 0; i < 80; i++) { Tu = c.pick(R, [0.5, 1, 1.5, 2, 3, 5]); Tg = c.pick(R, [10, 12, 15, 20, 25, 30, 40, 50]); r = Tu / Tg; if (Math.abs(r - 0.1) > 0.015 && Math.abs(r - 0.3) > 0.03 && r < 0.6) break; }
      const g = c.regelbarkeit(Tu, Tg), L = { 'gut': 'gut regelbar', 'mäßig': 'mäßig regelbar', 'schlecht': 'schlecht regelbar' };
      return choiceQ(R, 'Eine Temperaturstrecke hat die Verzugszeit Tu = ' + f(Tu, 1) + ' s und die Ausgleichszeit Tg = ' + f(Tg, 0) + ' s. Wie ist ihre Regelbarkeit?', L[g.urteil], Object.keys(L).filter(k => k !== g.urteil).map(k => L[k]),
        'Verhältnis Tu / Tg = ' + f(Tu, 1) + ' / ' + f(Tg, 0) + ' = ' + f(r, 2) + '. Unter 0,1 gilt eine Strecke als gut, von 0,1 bis 0,3 als mäßig und über 0,3 als schlecht regelbar. Eine große Verzugszeit macht die Regelung schwierig.', ['Bilde das Verhältnis Tu / Tg.', 'Grenzen: 0,1 und 0,3.']);
    },
    xp: R => {
      const c = C(), Kp = c.pick(R, [0.5, 2, 4, 5, 8, 10, 20, 25]), X = c.xp(Kp);
      return numQ('Ein P-Regler hat den Verstärkungsfaktor Kp = ' + f(Kp, 1) + '. Wie groß ist sein Proportionalbereich Xp?', X, '%', 'Proportionalbereich Xp', 0.05,
        'Xp = 100 % / Kp = 100 % / ' + f(Kp, 1) + ' = ' + f(X, 2) + ' %. Innerhalb dieses Bereichs der Regelabweichung fährt die Stellgröße ihren gesamten Bereich durch.', ['Xp = 100 % geteilt durch Kp.', 'Je größer Kp, desto kleiner Xp.']);
    },
    pstell: R => {
      const c = C(), Kp = c.pick(R, [0.5, 1.5, 2, 2.5, 3, 4, 5]), w = c.ri(R, 6, 16) * 5, d = c.pick(R, [-8, -4, 2, 4, 6, 10, 12]), x = w - d, y = Kp * d;
      return numQ('Ein P-Regler (Kp = ' + f(Kp, 1) + ') bekommt die Führungsgröße w = ' + f(w, 0) + ' % und misst die Regelgröße x = ' + f(x, 0) + ' %. Welche Stellgröße y gibt er aus?', y, '%', 'Stellgröße y', 0.05,
        'e = w − x = ' + f(w, 0) + ' − ' + f(x, 0) + ' = ' + f(d, 0) + ' %. y = Kp · e = ' + f(Kp, 1) + ' · ' + f(d, 0) + ' = ' + f(y, 2) + ' %.', ['Erst e = w − x bilden.', 'Dann mit Kp multiplizieren, auch bei negativem e.']);
    },
    pbleib: R => {
      const c = C(), Kp = c.pick(R, [1, 2, 3, 4]), Ks = c.pick(R, [1, 1.5, 2]), w = c.pick(R, [40, 60, 80]), T = c.pick(R, [2, 3]), cfg = { reg: 'P', Kp, Ks, T1: T, w, tEnd: 20 }, e = c.bleibP(w, Kp, Ks);
      return numQ('Ein Regelkreis mit einem Regler und einer Strecke wird auf den Sollwert w = ' + f(w, 0) + ' % gebracht. Das Diagramm zeigt x (gestrichelt: w). Lies die bleibende Regelabweichung ab.', e, '%', 'bleibende Regelabweichung', Math.max(1.5, 0.06 * w),
        'Die Regelgröße läuft auf ' + f(c.xEndP(w, Kp, Ks), 1) + ' % und bleibt dort, also unter dem Sollwert. Bleibende Regelabweichung = w − x_end = ' + f(w, 0) + ' − ' + f(c.xEndP(w, Kp, Ks), 1) + ' = ' + f(e, 1) + ' %. (Zugrunde liegt ein P-Regler mit Kp = ' + f(Kp, 1) + ' an einer Strecke mit Ks = ' + f(Ks, 1) + ': e = w / (1 + Kp · Ks).)', ['Wo endet die Kurve, wo liegt der Sollwert?', 'Differenz zwischen gestrichelter Linie und Endwert.'], [S('closed', cfg)]);
    },
    pdopp: R => {
      const c = C(), Kp = c.pick(R, [1, 1.5, 2, 2.5, 3]), Ks = c.pick(R, [1, 1.5, 2]), w = c.pick(R, [40, 60, 80]), e1 = c.bleibP(w, Kp, Ks), e2 = c.bleibP(w, 2 * Kp, Ks);
      return numQ('Ein P-Regler mit Kp = ' + f(Kp, 1) + ' regelt eine Strecke mit Ks = ' + f(Ks, 1) + ' auf den Sollwert w = ' + f(w, 0) + ' %. Dann wird Kp auf ' + f(2 * Kp, 1) + ' verdoppelt. Wie groß ist die bleibende Regelabweichung danach?', e2, '%', 'bleibende Regelabweichung', 0.06,
        'Vorher: e = w / (1 + Kp·Ks) = ' + f(w, 0) + ' / (1 + ' + f(Kp * Ks, 2) + ') = ' + f(e1, 2) + ' %. Nachher: e = ' + f(w, 0) + ' / (1 + ' + f(2 * Kp * Ks, 2) + ') = ' + f(e2, 2) + ' %. Die Abweichung wird nicht halbiert, weil die Eins im Nenner bleibt, und sie verschwindet nie ganz.', ['Formel e = w / (1 + Kp · Ks) mit dem neuen Kp.', 'Die Eins im Nenner bleibt bestehen.']);
    },
    iverh: pq(IQ),
    irampe: R => {
      const c = C(), e = c.pick(R, [2, 4, 5, 10]), Ti = c.pick(R, [2, 4, 5, 10, 20]), t = c.pick(R, [2, 5, 10, 20]), y = c.iRamp(e, Ti, t);
      return numQ('Ein reiner I-Regler mit der Integrierzeit Ti = ' + f(Ti, 0) + ' s bekommt eine konstante Regelabweichung von e = ' + f(e, 0) + ' %. Welche Stellgröße hat er nach t = ' + f(t, 0) + ' s erreicht (Start bei y = 0)?', y, '%', 'Stellgröße y', 0.05,
        'y(t) = e · t / Ti = ' + f(e, 0) + ' % · ' + f(t, 0) + ' s / ' + f(Ti, 0) + ' s = ' + f(y, 2) + ' %. Die Stellgröße wächst gleichmäßig an (Rampe), solange e konstant bleibt.', ['Konstantes e ergibt eine Rampe.', 'y = e · t / Ti.']);
    },
    pizeit: R => {
      const c = C(), Kp = c.pick(R, [1, 2, 3, 4]), Tn = c.pick(R, [2, 4, 5, 8]), e0 = 2, cfg = { typ: 'PI', Kp, Tn, Tv: 0, e0, tEnd: Tn * 3 };
      return numQ('Das Diagramm zeigt die Stellgröße y eines PI-Reglers nach einem Sprung der Regelabweichung auf e = 2 %. Lies die Nachstellzeit Tn ab.', Tn, 's', 'Nachstellzeit Tn', Math.max(0.3, 0.1 * Tn),
        'Der Sprung auf y(0) = Kp · e = ' + f(Kp * e0, 1) + ' % ist der P-Anteil. Die Nachstellzeit Tn ist die Zeit, nach der der I-Anteil genauso groß geworden ist wie der P-Anteil, die Stellgröße also auf ' + f(2 * Kp * e0, 1) + ' % verdoppelt ist. Das ist bei t = ' + f(Tn, 0) + ' s der Fall.', ['Erst den Sprung am Anfang ablesen.', 'Wann ist die Stellgröße doppelt so groß wie dieser Sprung?'], [S('ctrl', cfg)]);
    },
    reglerart: R => {
      const c = C(); let typ, cfg, ok = false;
      for (let i = 0; i < 80 && !ok; i++) {
        typ = c.pick(R, ['P', 'PI', '2P']);
        if (typ === 'P') { cfg = { reg: 'P', Kp: c.pick(R, [1, 1.5, 2, 3]), Ks: c.pick(R, [1, 1.5]), str: c.pick(R, ['PT1', 'PT2']), T1: 3, T2: 1.5, w: 50, tEnd: 30 }; ok = c.bleibP(50, cfg.Kp, cfg.Ks) > 8; }
        else if (typ === 'PI') { cfg = { reg: 'PI', Kp: c.pick(R, [0.8, 1, 1.5]), Tn: c.pick(R, [3, 4, 6]), Ks: 1, str: c.pick(R, ['PT1', 'PT2']), T1: 3, T2: 1.5, w: 50, tEnd: 60 }; const a = c.analyse(c.simulate(cfg)); ok = Math.abs(a.xend - 50) < 0.5 && a.stab === 'stabil'; }
        else { cfg = { reg: '2P', h: 4, w: 50, yh: 100, Ks: 1, T1: c.pick(R, [15, 20, 25]), Tt: c.pick(R, [1, 2]), str: 'PT1', tEnd: 100 }; ok = true; }
      }
      const L = { P: 'P-Regler', PI: 'PI-Regler', '2P': 'Zweipunktregler' };
      return choiceQ(R, 'Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Welche Reglerart arbeitet im Kreis?', L[typ], Object.keys(L).filter(k => k !== typ).map(k => L[k]),
        typ === 'P' ? 'Die Regelgröße bleibt dauerhaft unter dem Sollwert: bleibende Regelabweichung. Das ist typisch für einen P-Regler (ohne I-Anteil).' : typ === 'PI' ? 'Die Regelgröße läuft genau auf den Sollwert, die Abweichung wird ganz ausgeregelt. Das kann nur ein Regler mit I-Anteil, hier ein PI-Regler.' : 'Die Regelgröße pendelt dauernd in einem schmalen Band um den Sollwert. Das ist typisch für einen Zweipunktregler: Er schaltet nur ein und aus.', ['Wo liegt der Endwert im Vergleich zum Sollwert?', 'Pendelt x dauernd oder beruhigt es sich?'], [S('closed', cfg)]);
    },
    eigenschaft: pq(ANTQ),
    wirkung: pq(WIRKQ),
    pidramp: R => {
      const c = C(), a = c.pick(R, [1, 2, 3]), Kp = c.pick(R, [1, 2, 4]), Tn = c.pick(R, [2, 4, 5, 10]), Tv = c.pick(R, [0.5, 1, 2]), t = c.pick(R, [2, 4, 5]), y = c.pidRamp(Kp, Tn, Tv, a, t);
      return numQ('Ein idealer PID-Regler (y = Kp · (e + 1/Tn · ∫e dt + Tv · de/dt)) mit Kp = ' + f(Kp, 0) + ', Tn = ' + f(Tn, 0) + ' s und Tv = ' + f(Tv, 1) + ' s bekommt eine Regelabweichung, die ab t = 0 gleichmäßig ansteigt: e(t) = ' + f(a, 0) + ' %/s · t. Welche Stellgröße gibt er nach t = ' + f(t, 0) + ' s aus?', y, '%', 'Stellgröße y', 0.05,
        'e(' + f(t, 0) + ' s) = ' + f(a * t, 0) + ' %. P-Teil: ' + f(a * t, 2) + ' %. I-Teil: ∫e dt = a·t²/2 = ' + f(a * t * t / 2, 2) + ' %·s, geteilt durch Tn: ' + f(a * t * t / (2 * Tn), 2) + ' %. D-Teil: Tv · a = ' + f(Tv * a, 2) + ' %. Summe mal Kp: ' + f(Kp, 0) + ' · ' + f(a * t + a * t * t / (2 * Tn) + Tv * a, 3) + ' = ' + f(y, 2) + ' %.', ['Berechne die drei Anteile einzeln.', 'Das Integral der Rampe a·t ist a·t²/2, die Ableitung ist a.']);
    },
    stabil: R => {
      const c = C(), pr = c.pick(R, [[2, 1], [3, 1.5], [2, 1.5], [4, 2]]), Ks = 1, k = c.critI2(Ks, pr[0], pr[1]), f0 = c.pick(R, [0.3, 1, 1.4]), verdict = f0 < 1 ? 'stabil' : f0 === 1 ? 'grenzstabil' : 'instabil';
      const cfg = { reg: 'I', Tn: k.Ti / f0, str: 'PT2', Ks, T1: pr[0], T2: pr[1], w: 50, tEnd: Math.round(k.period * (f0 > 1 ? 4.5 : 7)) };
      const TX = { stabil: 'Stabil: Die Schwingung klingt ab, x geht auf den Sollwert', grenzstabil: 'Grenzstabil: Dauerschwingung mit gleichbleibender Amplitude', instabil: 'Instabil: Die Schwingung schaukelt sich immer weiter auf' };
      return choiceQ(R, 'Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Wie ist das Verhalten des Kreises zu beurteilen?', TX[verdict], Object.keys(TX).filter(k2 => k2 !== verdict).map(k2 => TX[k2]),
        verdict === 'stabil' ? 'Die Ausschläge um den Sollwert werden von Schwingung zu Schwingung kleiner. Der Kreis ist stabil und beruhigt sich.' : verdict === 'grenzstabil' ? 'Die Ausschläge bleiben gleich groß: Dauerschwingung. Der Kreis steht genau an der Stabilitätsgrenze.' : 'Jeder Ausschlag ist größer als der vorherige. Der Kreis ist instabil, die Regelgröße läuft aus dem Ruder.', ['Vergleiche die Höhe aufeinanderfolgender Spitzen.', 'Kleiner werdend = stabil, gleich = Grenze, größer werdend = instabil.'], [S('closed', cfg, { clip: true })]);
    },
    ueber: R => {
      const c = C(); let cfg, a, ok = false;
      for (let i = 0; i < 200 && !ok; i++) {
        const pr = c.pick(R, [[3, 1.5], [4, 2], [3, 2], [2, 1.5]]);
        cfg = { reg: 'PI', Kp: c.pick(R, [1, 1.5, 2, 2.5, 3]), Tn: c.pick(R, [2, 2.5, 3, 4]), Ks: 1, str: 'PT2', T1: pr[0], T2: pr[1], w: 50, tEnd: 10 * pr[0] };
        a = c.analyse(c.simulate(cfg)); ok = a.ueb > 8 && a.ueb < 60 && a.taus != null && a.taus < cfg.tEnd * 0.9 && Math.abs(a.xend - 50) < 0.2 && a.stab === 'stabil';
      }
      return numQ('Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Bestimme die Überschwingweite ü in Prozent des Endwerts (ü = (x_max − x_end) / x_end · 100 %).', a.ueb, '%', 'Überschwingweite', 4,
        'Der Endwert ist x_end = ' + f(a.xend, 1) + ' %, der höchste Wert x_max = ' + f(a.xmax, 1) + ' %. ü = (' + f(a.xmax, 1) + ' − ' + f(a.xend, 1) + ') / ' + f(a.xend, 1) + ' · 100 % = ' + f(a.ueb, 1) + ' %.', ['Wo liegt die höchste Spitze, wo der Endwert?', 'Überschwingen bezogen auf den Endwert.'], [S('closed', cfg)]);
    },
    daempf: R => {
      const c = C(), pr = c.pick(R, [[2, 1], [3, 1.5], [2, 1.5]]), k = c.critI2(1, pr[0], pr[1]), f0 = c.pick(R, [0.7, 0.8, 0.9]);
      const cfg = { reg: 'I', Tn: k.Ti / f0, str: 'PT2', Ks: 1, T1: pr[0], T2: pr[1], w: 50, tEnd: Math.round(k.period * 7) };
      const right = 'Die Integrierzeit Tn vergrößern (I-Anteil schwächer einstellen)';
      return choiceQ(R, 'Ein Regelkreis mit I-Regler wird auf den Sollwert w = 50 % gefahren. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Der Kreis soll deutlich ruhiger einschwingen. Welche Änderung am Regler ist sinnvoll?', right, ['Die Integrierzeit Tn verkleinern (I-Anteil stärker einstellen)', 'Den Regler abschalten und die Stellgröße festhalten', 'Das Messsignal zusätzlich durch ein langsames Filterglied verzögern'],
        'Der Kreis schwingt, weil der I-Anteil zu stark ist: Die Stellgröße wächst schneller, als die Strecke reagieren kann. Eine größere Integrierzeit Tn schwächt ihn ab, die Schwingung wird kleiner (der Preis: langsameres Ausregeln). Ein zusätzliches Filterglied würde die Verzögerung im Kreis erhöhen und das Schwingen verschlimmern.', ['Warum schwingt der Kreis? Zu viel oder zu wenig Verstärkung?', 'Weniger Schwung heißt: I-Anteil schwächen.'], [S('closed', cfg)]);
    },
    zweikurven: R => {
      const c = C(); let a, b, cfgA, cfgB, ok = false;
      for (let i = 0; i < 200 && !ok; i++) {
        const base = { reg: 'I', Tn: c.pick(R, [2.5, 3, 3.5, 4]), str: 'PT1', Ks: 1, T1: 2, w: 50, tEnd: 40 };
        cfgA = Object.assign({}, base, { Tt: 0 }); cfgB = Object.assign({}, base, { Tt: c.pick(R, [1, 1.5, 2]) });
        a = c.analyse(c.simulate(cfgA)); b = c.analyse(c.simulate(cfgB)); ok = b.ueb > a.ueb + 8 && b.stab === 'stabil' && Math.abs(b.xend - 50) < 1;
      }
      const tIdx = R() < 0.5 ? 1 : 0, labs = ['Kurve A', 'Kurve B'], simsAB = tIdx === 1 ? [S('closed', cfgA, { label: 'Kurve A' }), S('closed', cfgB, { label: 'Kurve B' })] : [S('closed', cfgB, { label: 'Kurve A' }), S('closed', cfgA, { label: 'Kurve B' })];
      const right = labs[tIdx === 1 ? 1 : 0];
      return choiceQ(R, 'Zwei Regelkreise haben denselben Regler und dieselbe Strecke, aber in einer der beiden Strecken steckt zusätzlich eine Totzeit. Beide wurden auf w = 50 % gefahren. Zu welcher Kurve gehört die Strecke mit Totzeit?', right, labs.filter(x => x !== right).concat(['Beide Kurven gehören zu Strecken ohne Totzeit']),
        'Bei der Strecke mit Totzeit bleibt x nach dem Sprung zunächst auf null: Die Wirkung kommt erst verspätet an. Der Regler baut in dieser Zeit weiter Stellgröße auf, deshalb schwingt der Kreis stärker über (hier ü = ' + f(b.ueb, 0) + ' % gegenüber ' + f(a.ueb, 0) + ' %).', ['Wo beginnt x erst nach einer Wartezeit zu steigen?', 'Totzeit heißt: keine Wirkung am Anfang.'], simsAB);
    },
    zn: R => {
      const c = C(), K = c.pick(R, [4, 5, 8, 10, 12]), T = c.pick(R, [5, 10, 20, 25]), sel = c.pick(R, [['P', 'Kp'], ['PI', 'Kp'], ['PI', 'Tn'], ['PID', 'Kp'], ['PID', 'Tn'], ['PID', 'Tv']]), z = c.zn(sel[0], K, T), v = z[sel[1]];
      const nm = { Kp: 'den Verstärkungsfaktor Kp', Tn: 'die Nachstellzeit Tn', Tv: 'die Vorhaltezeit Tv' };
      return numQ('Bei einem Dauerschwingversuch schwingt ein Regelkreis mit reinem P-Regler bei Kkrit = ' + f(K, 0) + ' dauernd mit der Periodendauer Tkrit = ' + f(T, 0) + ' s. Bestimme nach der Einstellregel von Ziegler und Nichols für einen ' + sel[0] + '-Regler ' + nm[sel[1]] + '.', v, sel[1] === 'Kp' ? '' : 's', sel[1] === 'Kp' ? 'Kp' : sel[1], 0.02,
        'Regel für den ' + sel[0] + '-Regler: ' + (sel[0] === 'P' ? 'Kp = 0,5 · Kkrit' : sel[0] === 'PI' ? 'Kp = 0,45 · Kkrit, Tn = 0,85 · Tkrit' : 'Kp = 0,6 · Kkrit, Tn = 0,5 · Tkrit, Tv = 0,12 · Tkrit') + '. Hier: ' + sel[1] + ' = ' + f(v, 3) + (sel[1] === 'Kp' ? '' : ' s') + '.', ['Die Faktoren stehen in der Hilfe unter "Einstellregeln".', 'Kp wird aus Kkrit gebildet, Tn und Tv aus Tkrit.']);
    },
    stoerfuehr: pq(STOQ),
    stoerzeit: R => {
      const c = C(), tz = c.pick(R, [25, 30, 35]), cfg = { reg: 'PI', Kp: c.pick(R, [1, 1.5]), Tn: c.pick(R, [3, 4]), str: 'PT1', Ks: 1.5, T1: 2, w: 50, z: c.pick(R, [-20, -16, 16]), tz, tEnd: tz + 30 };
      return numQ('Ein Regelkreis ist auf den Sollwert w = 50 % eingeschwungen. Irgendwann wirkt eine Störgröße auf die Strecke. Das Diagramm zeigt die Regelgröße x (gestrichelt: w). Zu welchem Zeitpunkt hat die Störung eingesetzt?', tz, 's', 'Zeitpunkt der Störung', 1.2,
        'Bis zu diesem Zeitpunkt liegt x ruhig auf dem Sollwert. Dann bricht x aus (hier bei t = ' + f(tz, 0) + ' s), der Regler greift ein und führt x wieder an w heran. Weil der Regler einen I-Anteil hat, endet die Kurve wieder bei w.', ['Wann verlässt x den Sollwert?', 'Der Zeitpunkt, an dem die Kurve zum ersten Mal wieder abweicht, nachdem sie eingeschwungen war.'], [S('closed', cfg)]);
    },
    bleibz: R => {
      const c = C(), Kp = c.pick(R, [1, 2, 3, 4]), Ks = c.pick(R, [1, 1.5, 2]), w = c.pick(R, [40, 50, 60]), z = c.pick(R, [-12, -10, -6, 6, 8]), e = c.bleibPz(w, z, Kp, Ks), x = c.xEndPz(w, z, Kp, Ks);
      return numQ('Ein P-Regler (Kp = ' + f(Kp, 0) + ') regelt eine Strecke (Ks = ' + f(Ks, 1) + ') auf den Sollwert w = ' + f(w, 0) + ' %. Zusätzlich wirkt am Streckeneingang eine konstante Störgröße z = ' + f(z, 0) + ' % (sie addiert sich zur Stellgröße). Wie groß ist die bleibende Regelabweichung w − x?', e, '%', 'bleibende Regelabweichung', 0.06,
        'Im Beharrungszustand gilt x = Ks · (y + z) mit y = Kp · (w − x). Daraus x = Ks · (Kp · w + z) / (1 + Ks · Kp) = ' + f(Ks, 1) + ' · (' + f(Kp * w, 0) + ' + ' + f(z, 0) + ') / ' + f(1 + Ks * Kp, 2) + ' = ' + f(x, 2) + ' %. Bleibende Regelabweichung = ' + f(w, 0) + ' − ' + f(x, 2) + ' = ' + f(e, 2) + ' %.', ['Erst den Endwert x berechnen, dann w − x.', 'z addiert sich zur Stellgröße y.']);
    },
    ausregel: R => {
      const c = C(); let cfg, a, ok = false;
      for (let i = 0; i < 300 && !ok; i++) {
        const T1 = c.pick(R, [2, 3, 4]);
        cfg = { reg: 'PI', Kp: c.pick(R, [1, 1.5, 2]), Tn: c.pick(R, [3, 4, 5, 6, 8]), Ks: 1, str: 'PT1', T1, w: 50, tEnd: 40 };
        a = c.analyse(c.simulate(cfg)); ok = a.taus != null && a.taus >= 6 && a.taus <= 24 && a.ueb < 35 && Math.abs(a.xend - 50) < 0.2;
      }
      return numQ('Ein Regelkreis wird auf den Sollwert w = 50 % gefahren. Im Diagramm ist das Toleranzband von ±2 % um den Sollwert eingezeichnet (grau). Lies die Ausregelzeit ab, also die Zeit, ab der x dauerhaft im Band bleibt.', a.taus, 's', 'Ausregelzeit', Math.max(1, 0.1 * a.taus),
        'Die Ausregelzeit ist der Zeitpunkt, ab dem die Kurve das Band ±2 % um den Endwert nicht mehr verlässt. Hier ist das bei t = ' + f(a.taus, 1) + ' s der Fall.', ['Gehe die Kurve von rechts nach links, bis sie zum letzten Mal das Band verlässt.', 'Das ist die Zeit, ab der alles im Band bleibt.'], [S('closed', cfg, { band: true })]);
    },
    schalt: R => {
      const c = C(), w = c.pick(R, [40, 50, 60, 70, 80]), h = c.pick(R, [2, 4, 6, 8, 10]), up = R() < 0.5, s = c.schalt(w, h), v = up ? s.xo : s.xu;
      return numQ('Ein Zweipunktregler (Thermostat) soll eine Temperatur auf w = ' + f(w, 0) + ' °C halten und hat eine Schaltdifferenz von ' + f(h, 0) + ' K, die symmetrisch um den Sollwert liegt. Bei welcher Temperatur ' + (up ? 'schaltet er die Heizung aus (obere Schaltschwelle)' : 'schaltet er die Heizung ein (untere Schaltschwelle)') + '?', v, '°C', 'Schaltschwelle', 0.01,
        'Die Schaltdifferenz ' + f(h, 0) + ' K verteilt sich je zur Hälfte nach oben und unten: ' + (up ? 'obere Schwelle = w + h/2 = ' + f(w, 0) + ' + ' + f(h / 2, 0) + ' = ' + f(v, 0) : 'untere Schwelle = w − h/2 = ' + f(w, 0) + ' − ' + f(h / 2, 0) + ' = ' + f(v, 0)) + ' °C.', ['Teile die Schaltdifferenz durch zwei.', 'Oben aus, unten ein.']);
    },
    swing2p: R => {
      const c = C(), w = c.pick(R, [40, 50, 60]), h = c.pick(R, [2, 4, 6]), T = c.pick(R, [15, 20, 30]), Tt = c.pick(R, [1, 2, 3]), cfg = { reg: '2P', h, w, yh: 100, Ks: 1, xa: 0, str: 'PT1', T1: T, Tt, tEnd: 100 }, z = c.zweipunkt(w, h, 100, 0, T, Tt);
      return numQ('Ein Zweipunktregler hält die Temperatur einer Heizung auf w = ' + f(w, 0) + ' °C (gestrichelt). Das Diagramm zeigt die Regelgröße x. Wie groß ist die Schwankung der Temperatur von der tiefsten bis zur höchsten Spitze (im eingeschwungenen Zustand)?', z.swing, '°C', 'Schwankung (Spitze-Spitze)', Math.max(1.2, 0.15 * z.swing),
        'Im Diagramm liest du die höchste Spitze (' + f(z.xmax, 1) + ' °C) und die tiefste (' + f(z.xmin, 1) + ' °C) ab: Schwankung ' + f(z.swing, 1) + ' °C. Die Schwankung ist größer als die Schaltdifferenz (' + f(h, 0) + ' K), weil die Wirkung der Heizung verspätet am Messfühler ankommt und die Temperatur nach dem Schalten noch ein Stück weiterläuft.', ['Höchste Spitze minus tiefste Spitze.', 'Nicht die Schaltdifferenz, die die Elektronik einstellt, sondern was am Messfühler tatsächlich passiert.'], [S('closed', cfg)]);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument (Indexliste für Pools) */
  const defs = [
    ['Regelkreis und Begriffe', 1, 'Steuerung oder Regelung', 'steuern'], ['Regelkreis und Begriffe', 1, 'Größe benennen', 'groesse'], ['Regelkreis und Begriffe', 2, 'Bauteil im Kreis', 'bauteil'], ['Regelkreis und Begriffe', 2, 'Abweichung berechnen', 'abw'],
    ['Strecke und Sprungantwort', 2, 'Verhältnis von Ausgang und Eingang', 'ksofen'], ['Strecke und Sprungantwort', 2, 'Sprungantwort lesen', 'tablesen'], ['Strecke und Sprungantwort', 2, 'Wert nach einer Zeit', 'pt1wert'], ['Strecke und Sprungantwort', 3, 'Endverhalten der Strecke', 'ausgleich'],
    ['Totzeit und Ordnung', 1, 'Wartezeit am Anfang', 'totlesen'], ['Totzeit und Ordnung', 2, 'Transport auf dem Band', 'totband'], ['Totzeit und Ordnung', 2, 'Speicher zählen', 'ordnung'], ['Totzeit und Ordnung', 3, 'Strecke beurteilen', 'regelbar'],
    ['P-Regler', 1, 'Bereich des Reglers', 'xp'], ['P-Regler', 2, 'Ausgang des Reglers', 'pstell'], ['P-Regler', 2, 'Abstand zum Sollwert', 'pbleib'], ['P-Regler', 3, 'Doppelte Verstärkung', 'pdopp'],
    ['I- und PI-Regler', 1, 'Verhalten des Integrierers', 'iverh'], ['I- und PI-Regler', 2, 'Ausgang über die Zeit', 'irampe'], ['I- und PI-Regler', 2, 'Reglerkennlinie lesen', 'pizeit'], ['I- und PI-Regler', 3, 'Reglerart am Verhalten', 'reglerart'],
    ['PID-Regler', 1, 'Anteil zuordnen', 'eigenschaft'], ['PID-Regler', 2, 'Einstellung und Wirkung', 'wirkung'], ['PID-Regler', 3, 'Ausgang bei steigender Abweichung', 'pidramp'],
    ['Stabilität und Schwingen', 1, 'Verhalten beurteilen', 'stabil'], ['Stabilität und Schwingen', 2, 'Spitze und Endwert', 'ueber'], ['Stabilität und Schwingen', 2, 'Ruhigerer Verlauf', 'daempf'], ['Stabilität und Schwingen', 2, 'Zwei Kurven im Vergleich', 'zweikurven'], ['Stabilität und Schwingen', 3, 'Einstellung aus dem Versuch', 'zn'],
    ['Störung und Führung', 1, 'Wer ändert was', 'stoerfuehr'], ['Störung und Führung', 2, 'Der Moment der Änderung', 'stoerzeit'], ['Störung und Führung', 2, 'Zeit bis zur Ruhe', 'ausregel'], ['Störung und Führung', 3, 'Abweichung mit Zusatzlast', 'bleibz'],
    ['Zweipunktregler', 2, 'Schaltpunkte', 'schalt'], ['Zweipunktregler', 3, 'Schwankung der Temperatur', 'swing2p']
  ];
  const tasks = defs.map((d, i) => ({ id: 'rkr' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('rkr-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Kennwerte entstehen im UI aus RKR_CORE) ---------- */
  /* tab 'sim': cfg wird in die Simulation geladen; tab 'reg': Reglerkennlinie (typ, Kp, Tn, Tv) */
  /* PRUEFEN P18: Alle Zahlenwerte der Beispiele (Zeitkonstanten 2 bis 20 s, Verstärkungen 1 bis 3, Sollwert 50 oder 60 %) sind frei gewählte Übungswerte und nicht an eine echte Anlage angelehnt. Sollen echte Betriebsanlagen (Brennofen, Härteofen, Förderband) als Vorbild dienen? */
  const examples = [
    { id: 'strecke1', tab: 'sim', title: 'Sprungantwort einer PT1-Strecke', text: 'Eine Strecke mit Ausgleich (Ks = 2, T = 3 s) erhält einen Sprung der Stellgröße von 0 auf 10 %. Die Regelgröße läuft auf Ks · 10 % = 20 % zu. Nach t = T hat sie 63 % davon erreicht, nach etwa 3·T sind es 95 %.', cfg: { reg: 'offen', str: 'PT1', Ks: 2, T1: 3, w: 10, tEnd: 20 } },
    { id: 'p1', tab: 'sim', title: 'P-Regler: Die Abweichung bleibt', text: 'Ein P-Regler (Kp = 2) regelt eine PT1-Strecke (Ks = 1,5, T = 3 s) auf den Sollwert 60 %. Die Regelgröße läuft auf 60 · 3 / 4 = 45 % und bleibt dort: bleibende Regelabweichung 15 %.', cfg: { reg: 'P', Kp: 2, Ks: 1.5, T1: 3, w: 60, tEnd: 20 } },
    { id: 'pi1', tab: 'sim', title: 'PI-Regler beseitigt die Abweichung', text: 'Dieselbe Strecke wie vorher, jetzt mit PI-Regler (Kp = 1, Tn = 3 s). Der I-Anteil integriert die Abweichung weiter auf, bis die Regelgröße genau beim Sollwert 60 % liegt. Die bleibende Regelabweichung ist null.', cfg: { reg: 'PI', Kp: 1, Tn: 3, Ks: 1.5, T1: 3, w: 60, tEnd: 40 } },
    { id: 'pid1', tab: 'sim', title: 'PID-Regler an einer trägen Strecke', text: 'Eine Strecke mit zwei Speichern (PT2, T1 = 2 s, T2 = 1 s) wird von einem PID-Regler (Kp = 2, Tn = 3 s, Tv = 1 s) auf 50 % geregelt. Der D-Anteil bremst früh, der Kreis schwingt kaum über und ist nach wenigen Sekunden eingeschwungen.', cfg: { reg: 'PID', Kp: 2, Tn: 3, Tv: 1, str: 'PT2', Ks: 1, T1: 2, T2: 1, w: 50, tEnd: 30 } },
    { id: 'tot1', tab: 'sim', title: 'Totzeit lässt den Kreis schwingen', text: 'Ein I-Regler (Ti = 3 s) regelt eine PT1-Strecke (Ks = 1, T = 2 s) mit einer Totzeit von 2 s. Weil die Wirkung der Stellgröße erst verspätet am Messort ankommt, baut der Regler zu viel Stellgröße auf: Die Regelgröße schwingt stark über. Ohne Totzeit wäre der Kreis deutlich ruhiger.', cfg: { reg: 'I', Tn: 3, str: 'PT1', Ks: 1, T1: 2, Tt: 2, w: 50, tEnd: 60 } },
    { id: 'inst1', tab: 'sim', title: 'Am Rand der Stabilität', text: 'Ein I-Regler an einer PT2-Strecke (T1 = 2 s, T2 = 1 s, Ks = 1) schwingt dauernd mit gleichbleibender Amplitude, wenn die Integrierzeit nur etwa 0,67 s beträgt. Die Periodendauer ist etwa 8,9 s. Wird Ti noch kleiner, schaukelt sich der Kreis auf; wird Ti größer, klingt die Schwingung ab.', cfg: { reg: 'I', Tn: 2 / 3, str: 'PT2', Ks: 1, T1: 2, T2: 1, w: 50, tEnd: 62 } },
    { id: 'stoer1', tab: 'sim', title: 'Störgröße und PI-Regler', text: 'Ein PI-Regler hält eine PT1-Strecke (Ks = 1,5, T = 2 s) auf 50 %. Bei t = 25 s wirkt am Streckeneingang eine Störgröße von −20 %. Die Regelgröße bricht ein, der I-Anteil führt sie wieder auf 50 % zurück. Ein reiner P-Regler würde dauerhaft darunter bleiben.', cfg: { reg: 'PI', Kp: 1, Tn: 3, str: 'PT1', Ks: 1.5, T1: 2, w: 50, z: -20, tz: 25, tEnd: 55 } },
    { id: 'zwei1', tab: 'sim', title: 'Zweipunktregler an einer Heizung', text: 'Ein Thermostat (Schaltdifferenz 4 K um w = 50 °C) schaltet eine Heizung (Endwert bei EIN 100 °C, Umgebung 0 °C, T = 20 s, Totzeit 2 s). Die Temperatur pendelt dauernd, die Schwankung ist größer als die Schaltdifferenz, weil die Wirkung verspätet am Fühler ankommt.', cfg: { reg: '2P', h: 4, w: 50, yh: 100, Ks: 1, xa: 0, str: 'PT1', T1: 20, Tt: 2, tEnd: 100 } },
    { id: 'reg1', tab: 'reg', title: 'Sprungantwort eines PID-Reglers', text: 'Ein PID-Regler (Kp = 2, Tn = 4 s, Tv = 1 s) bekommt einen Sprung der Regelabweichung auf 1 %. Der P-Anteil springt sofort, der D-Anteil gibt eine kurze Spitze, danach steigt die Stellgröße durch den I-Anteil gleichmäßig an.', cfg: { typ: 'PID', Kp: 2, Tn: 4, Tv: 1, e0: 1, tEnd: 12 } }
  ];

  root.RKR_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples };
  root.RKR_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.RKR_DATA, TASKS: root.RKR_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
