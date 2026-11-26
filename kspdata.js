'use strict';
/* Tonfunk Kleinsteuerungs-Lab: Daten (Aufgaben-Generatoren). Kennung 'ksp'.
   ALLE Zahlen (Spannungen, Ströme, Zeiten, Schaltabstände, Reduktionsfaktoren, Leitungslängen) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   window.KSP_DATA  { cats, tasks, gens, make, makeTask, randomQ }
   window.KSP_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.ksp.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage hat: text, ask, value, tol, expl (Lösungsweg), tips (zwei Stufen) und go ("So gehst du vor": die Schritte in Kurzform).
   Nicht doppeln (siehe spslab, pnelab): GRAFCET, Ampel, Förderband, Symbole der Pneumatik, Verschlauchen, Kraft und Luftverbrauch.
   Keine Produktnamen von Steuerungen: überall nur "Kleinsteuerung". */
(function (root) {
  const C = () => root.KSP_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Relais, Schütz, Selbsthaltung', 'Kleinsteuerung als Gerät', 'Funktionsplan, Zeiten, Zähler', 'Elektropneumatik', 'Sensorik an der Steuerung', 'Fehlersuche an Ein- und Ausgängen'];

  const numQ = (text, value, unit, label, tol, expl, tips, go) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, go });
  function choiceQ(R, text, right, wrong, expl, tips, go) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, go };
  }
  /* Pool-Eintrag: [Text, richtig, falsch[], Erklärung, Tipps[2]] */
  const pq = (POOL, go) => R => { const q = POOL[C().ri(R, 0, POOL.length - 1)]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], go); };
  const GO_LIES = 'Lies die Frage ganz. Überlege, welche Aufgabe das Bauteil hat. Streiche die Antworten, die dazu nicht passen, und wähle die übrige.';

  /* ---------- Fragen-Pools ---------- */
  const KLEMM = [
    ['Welche Klemmenbezeichnungen hat ein Schließer-Hilfskontakt?', '13 und 14', ['11 und 12', 'A1 und A2', '1/L1 und 2/T1'], 'Schließer tragen die Endziffern 3 und 4 (13/14, 23/24 ...). Öffner haben 1 und 2. A1 und A2 sind die Anschlüsse der Spule.', ['Schließer: Endziffern 3 und 4.', 'Die Spule heißt A1 und A2.']],
    ['Welche Klemmenbezeichnungen hat ein Öffner-Hilfskontakt?', '21 und 22', ['13 und 14', 'A1 und A2', '3/L2 und 4/T2'], 'Öffner haben die Endziffern 1 und 2 (11/12, 21/22 ...). Die erste Ziffer ist nur die Platznummer des Kontakts.', ['Öffner: Endziffern 1 und 2.', 'Die Zehnerziffer zählt die Kontakte durch.']],
    ['Welche Klemmen sind die Anschlüsse der Spule eines Schützes?', 'A1 und A2', ['13 und 14', '21 und 22', '1/L1 und 2/T1'], 'Die Spule hat die Anschlüsse A1 und A2. Alle Zahlenpaare gehören zu Kontakten.', ['Ein Buchstabe vor der Ziffer.', 'Die Spule ist kein Kontakt.']],
    ['Was verrät die Endziffer 4 in der Klemmenbezeichnung 14?', 'Der Kontakt ist ein Schließer (Endziffern 3 und 4)', ['Der Kontakt ist ein Öffner (Endziffern 1 und 2)', 'Es ist ein Spulenanschluss', 'Es ist ein Hauptkontakt für den Motor'], 'Die Endziffern geben die Funktion an: 1 und 2 sind Öffner, 3 und 4 sind Schließer.', ['Merke: 3 und 4 sind Schließer.', 'Die Endziffer sagt, was der Kontakt tut.']],
    ['Welche Anschlüsse gehören zu den Hauptkontakten eines Leistungsschützes?', '1/L1 mit 2/T1, 3/L2 mit 4/T2, 5/L3 mit 6/T3', ['13 mit 14, 23 mit 24, 33 mit 34', 'A1 mit A2', '11 mit 12, 21 mit 22, 31 mit 32'], 'Die Hauptkontakte führen den Laststrom, oben die Leiter L1 bis L3, unten die Ausgänge T1 bis T3. Die Zahlenpaare mit 13/14 oder 11/12 sind Hilfskontakte für die Steuerung.', ['Die Hauptkontakte tragen die Buchstaben L und T.', 'Hilfskontakte haben zweistellige Nummern.']]
  ];
  const RS = [
    ['Du sollst mit einer 24-V-Steuerung einen Motor mit 7,5 kW einschalten. Was schaltet den Laststrom?', 'Ein Schütz mit Hauptkontakten', ['Ein Hilfsrelais mit kleinen Kontakten für wenige Ampere', 'Ein Taster auf der Schalttafel', 'Der Ausgang der Kleinsteuerung direkt'], 'Große Ströme schaltet ein Schütz mit Hauptkontakten. Der Ausgang der Kleinsteuerung steuert nur die Spule des Schützes.', ['Wer ist für große Ströme gebaut?', 'Der Ausgang schaltet nur die Spule.']],
    ['Was ist der wichtigste Unterschied zwischen einem Relais und einem Schütz?', 'Das Schütz hat Hauptkontakte für große Ströme, das Relais schaltet nur kleine Ströme', ['Das Relais hat keine Spule', 'Das Schütz wird immer von Hand eingerastet', 'Das Relais hat immer nur Öffner'], 'Beide haben eine Spule und Kontakte. Das Schütz hat kräftige Hauptkontakte (mit Löschung des Schaltlichtbogens), das Relais ist für kleine Ströme gebaut.', ['Beide haben eine Spule.', 'Es geht um die Größe des Stroms.']],
    ['Die Spule eines Relais wird stromlos. Was geschieht mit den Kontakten?', 'Die Kontakte fallen in die Ruhelage zurück: Schließer öffnen, Öffner schließen', ['Die Kontakte bleiben in der Stellung, bis ein Taster gedrückt wird', 'Alle Kontakte öffnen', 'Alle Kontakte schließen'], 'Eine Feder bringt die Kontakte in die Ruhelage, sobald die Spule keinen Strom mehr hat.', ['Eine Feder stellt zurück.', 'Wie sind die Kontakte ohne Strom gezeichnet?']],
    ['Warum arbeiten Steuerstromkreise oft mit 24 V Gleichspannung?', 'Bei 24 V Gleichspannung ist die Berührungsgefahr gering (Schutzkleinspannung)', ['Weil 24 V mehr Leistung liefert als 230 V', 'Weil Schütze nur mit 24 V funktionieren', 'Weil dann keine Spule gebraucht wird'], 'Kleine Spannungen sind bei Berührung weit weniger gefährlich. Die Kleinspannung gehört zum Schutzkonzept der Steuerung.', ['Denke an Berührung.', 'Es geht um Sicherheit, nicht um Leistung.']],
    ['Ein Koppelrelais steht zwischen dem Ausgang der Kleinsteuerung und einer 230-V-Last. Wozu?', 'Es trennt den Steuerteil von der Last und schaltet die höhere Spannung mit eigenem Kontakt', ['Es erhöht die Spannung am Ausgang auf 230 V', 'Es speichert das Programm', 'Es misst den Strom der Last'], 'Der Ausgang bedient nur die kleine Spule des Koppelrelais. Der potenzialfreie Kontakt schaltet die Last und trennt beide Stromkreise galvanisch.', ['Wer schaltet die 230 V?', 'Spule und Kontakt sind getrennt.']]
  ];
  const WEN = [
    ['Wozu dient der Öffner von K2 im Strompfad der Spule K1?', 'Er verriegelt: K1 kann nicht anziehen, solange K2 angezogen ist', ['Er hält K1 nach dem Loslassen von S1 selbst', 'Er schaltet K1 aus, wenn S1 losgelassen wird', 'Er ersetzt den Aus-Taster'], 'Die Verriegelung sperrt den Weg der anderen Drehrichtung. Der Öffner von K2 öffnet, sobald K2 angezogen hat, und hält K1 so aus.', ['Wer schließt den Weg, wenn K2 anzieht?', 'Ein Öffner öffnet bei Betätigung.']],
    ['Was geschieht in einer Wendeschaltung ohne Verriegelung, wenn beide Schütze gleichzeitig anziehen?', 'Zwei Außenleiter werden kurzgeschlossen', ['Der Motor läuft schneller', 'Der Motor steht und es passiert nichts', 'Der Motor läuft mit halber Drehzahl'], 'Ein Schütz legt L1 und L2 normal an, das andere vertauscht sie. Ziehen beide an, verbinden die Kontakte zwei Außenleiter direkt. Das ist ein Kurzschluss.', ['Was vertauscht ein Wendeschütz?', 'Beide Schütze verbinden L1 mit L2 auf unterschiedliche Weise.']],
    ['Wie wird die Drehrichtung eines Drehstrommotors gewendet?', 'Zwei Außenleiter werden vertauscht', ['Alle drei Außenleiter werden vertauscht', 'Der Schutzleiter wird vertauscht', 'Die Frequenz wird halbiert'], 'Vertauschen zweier Außenleiter kehrt das Drehfeld um. Alle drei zu vertauschen hätte denselben Drehsinn wie vorher.', ['Wie viele Leiter braucht ein Drehfeld-Wechsel?', 'Zwei, nicht drei.']],
    ['Der Motor läuft rechts (K1 angezogen). Du drückst S3 für Links, ohne vorher Aus zu drücken. Was geschieht bei einer Verriegelung durch Öffner?', 'Nichts: K2 kann nicht anziehen, solange K1 angezogen ist', ['K1 fällt ab und K2 zieht sofort an', 'Beide Schütze ziehen an', 'Der Motor stoppt, weil S3 ein Öffner ist'], 'Der Öffner von K1 liegt im Strompfad von K2 und bleibt offen. Erst nach Aus kann K2 anziehen.', ['Wer hält den Weg von K2 offen?', 'Erst Aus, dann Links.']]
  ];
  const NS = [
    ['Das Netz fällt kurz aus und kehrt zurück. K1 war mit Selbsthaltung angezogen. Was geschieht?', 'K1 bleibt nach der Rückkehr abgefallen, bis jemand S1 drückt (Nullspannungssicherheit)', ['K1 zieht von selbst wieder an', 'K1 bleibt die ganze Zeit angezogen', 'K1 zieht erst an, wenn S2 gedrückt wird'], 'Beim Spannungsausfall fällt K1 ab und der Selbsthaltekontakt öffnet. Bei Rückkehr der Spannung fehlt die Haltung, die Maschine läuft nicht von allein an.', ['Was hält K1 nach dem Loslassen?', 'Der Selbsthaltekontakt fällt beim Ausfall ab.']],
    ['Warum ist die Nullspannungssicherheit bei einer Maschine wichtig?', 'Die Maschine läuft nach Rückkehr der Spannung nicht von selbst an und gefährdet niemanden', ['Die Maschine läuft schneller an', 'Der Strom ist dann kleiner', 'Die Spule wird kühler'], 'Ein plötzliches Anlaufen nach einem Spannungsausfall kann Menschen gefährden. Die Selbsthaltung verhindert das.', ['Wer steht vielleicht an der Maschine?', 'Von selbst anlaufen ist gefährlich.']],
    ['Wozu dient der Selbsthaltekontakt 13/14 parallel zu S1?', 'Er überbrückt S1, damit K1 nach dem Loslassen von S1 angezogen bleibt', ['Er schaltet den Motor aus', 'Er ist der Aus-Taster', 'Er misst den Strom der Spule'], 'Der Kontakt gehört zu K1. Sobald K1 angezogen hat, schließt er und hält den Stromweg zur Spule, auch wenn S1 wieder offen ist.', ['Wer gehört zu K1?', 'Parallel zu S1 heißt: überbrücken.']],
    ['Welcher Taster-Typ wird für Aus (Stopp) im Strompfad der Spule eingebaut und warum?', 'Öffner: Drücken unterbricht den Strompfad der Spule', ['Schließer: Drücken schließt den Strompfad zur Spule', 'Schließer: er ist billiger', 'Wechsler, weil er zwei Anschlüsse hat'], 'Ein Öffner im Strompfad unterbricht beim Drücken den Strom zur Spule. Ein Schließer würde beim Drücken einen Strompfad herstellen, nicht trennen.', ['Aus heißt: Strom unterbrechen.', 'Welcher Kontakt öffnet beim Drücken?']]
  ];
  const FUPB = [
    ['Was bedeutet ein kleiner Kreis am Eingang eines FUP-Bausteins?', 'Der Eingang wird negiert (invertiert)', ['Der Eingang ist ein Zähleingang', 'Der Eingang ist nicht angeschlossen', 'Der Eingang hat Vorrang'], 'Ein Kreis am Eingang dreht den Wert um: aus 0 wird 1 und aus 1 wird 0.', ['Der Kreis ändert den Wert.', 'Aus 1 wird 0.']],
    ['Wann liefert ein UND-Baustein am Ausgang eine 1?', 'Nur wenn alle Eingänge 1 sind', ['Wenn mindestens ein Eingang 1 ist', 'Wenn die Eingänge verschieden sind', 'Wenn kein Eingang 1 ist'], 'UND: alle Bedingungen müssen gleichzeitig erfüllt sein. Mindestens ein Eingang 1 beschreibt ODER, verschiedene Eingänge XOR, kein Eingang 1 NOR.', ['Denke an Reihenschaltung von Schaltern.', 'Alle Bedingungen zugleich.']],
    ['Welcher Baustein liefert nur dann eine 1, wenn kein Eingang 1 ist?', 'NOR (ODER mit negiertem Ausgang)', ['UND', 'ODER', 'XOR'], 'NOR ist die Verneinung von ODER. Der Ausgang ist 1 nur, wenn beide Eingänge 0 sind.', ['Verneinung eines ODER.', 'Alle Eingänge müssen 0 sein.']],
    ['Ein Speicherbaustein hat einen Setzen-Eingang S und einen Rücksetzen-Eingang R. Was bedeutet "Rücksetzen vorrangig"?', 'Liegen S und R gleichzeitig an, ist der Ausgang 0', ['Liegen S und R gleichzeitig an, ist der Ausgang 1', 'Der Ausgang ändert sich nie', 'Der Ausgang wechselt dauernd hin und her'], 'Beim Rücksetzen-vorrangigen Speicher gewinnt R: der Ausgang wird 0. Beim Setzen-vorrangigen gewinnt S. Wie die Bausteine heißen, steht im Handbuch deiner Kleinsteuerung.', ['Wer gewinnt, wenn beide gleichzeitig kommen?', 'Vorrang heißt gewinnen.']],
    ['Was ist ein Funktionsplan (FUP)?', 'Eine grafische Darstellung der Steuerung aus Bausteinen mit Ein- und Ausgängen', ['Ein Plan der Leitungsverlegung in der Halle', 'Eine Liste der Klemmennummern', 'Ein Schaltplan nur für Relais'], 'Im FUP verbindest du Bausteine wie UND, ODER, Zeiten und Zähler durch Linien. Die Linien zeigen die Signalrichtung.', ['Es geht um Bausteine und Linien.', 'Kein Plan der Verkabelung.']]
  ];
  const ZB = [
    ['Der Lüfter soll nach dem Abschalten des Motors noch 30 s weiterlaufen. Welcher Baustein?', 'Ausschaltverzögerung (TOF)', ['Einschaltverzögerung (TON)', 'Wischer (Impuls)', 'Zähler'], 'Eine Nachlaufzeit hält den Ausgang nach dem Wegfall des Eingangs noch eine Zeit lang an: Ausschaltverzögerung.', ['Wann beginnt die Zeit zu laufen?', 'Nach dem Abschalten.']],
    ['Ein Warnsignal soll erst ertönen, wenn ein Taster mindestens 3 s lang gehalten wird. Welcher Baustein?', 'Einschaltverzögerung (TON)', ['Ausschaltverzögerung (TOF)', 'Wischer (Impuls)', 'Zähler'], 'Der Ausgang soll erst nach der Zeit einschalten, wenn der Eingang durchgehend anliegt. Das ist eine Einschaltverzögerung.', ['Muss der Eingang durchgehend anliegen?', 'Der Ausgang kommt nach der Zeit.']],
    ['Bei jeder Betätigung des Tasters soll ein Ventil genau 2 s lang angesteuert werden, auch bei langem Tastendruck. Welcher Baustein?', 'Wischer (Impuls fester Länge)', ['Einschaltverzögerung (TON)', 'Ausschaltverzögerung (TOF)', 'Zähler'], 'Der Wischer macht aus einer steigenden Flanke einen Impuls fester Länge, unabhängig von der Dauer des Tastendrucks.', ['Die Länge soll fest sein.', 'Die Flanke startet den Impuls.']],
    ['Es sollen Teile gezählt werden, bis 20 Stück erreicht sind. Welcher Baustein?', 'Zähler', ['Einschaltverzögerung (TON)', 'Wischer (Impuls)', 'Ausschaltverzögerung (TOF)'], 'Der Zähler zählt Impulse und meldet, wenn die Schwelle erreicht ist.', ['Es werden Ereignisse gezählt.', 'Keine Zeit im Spiel.']],
    ['Ein Sensor flackert beim Anfahren kurz (wenige Millisekunden). Das Programm soll das ignorieren. Was hilft?', 'Eine kurze Einschaltverzögerung (TON) am Eingang', ['Eine Ausschaltverzögerung (TOF) am Eingang', 'Ein Zähler mit Schwelle 0', 'Ein zweiter Eingang parallel'], 'Die Einschaltverzögerung schaltet nur, wenn der Eingang länger als die Zeit anliegt. Kürzere Impulse bleiben ohne Wirkung.', ['Kurze Impulse sollen verschwinden.', 'Der Ausgang kommt erst nach der Zeit.']]
  ];
  const VENT = [
    ['Wie viele Spulen hat ein monostabiles 5/2-Ventil mit Federrückstellung?', 'Eine', ['Zwei', 'Keine', 'Drei'], 'Das monostabile Ventil hat eine Spule. Eine Feder bringt es zurück, wenn die Spule stromlos ist.', ['Mono heißt einfach.', 'Die Rückstellung macht eine Feder.']],
    ['Die Spule eines monostabilen 5/2-Ventils wird abgeschaltet. Was geschieht?', 'Die Feder schaltet das Ventil in die Grundstellung zurück', ['Das Ventil bleibt in der Stellung', 'Das Ventil öffnet alle Anschlüsse', 'Der Druck bricht zusammen'], 'Ohne Spulenstrom stellt die Feder das Ventil zurück, der Zylinder fährt in die Grundstellung.', ['Wer stellt zurück?', 'Ohne Strom gilt die Grundstellung.']],
    ['Y1 eines bistabilen 5/2-Ventils bekommt kurz einen Impuls und ist dann wieder stromlos. Was geschieht?', 'Das Ventil bleibt in der Stellung, bis Y2 einen Impuls bekommt', ['Das Ventil fällt sofort zurück', 'Das Ventil schaltet erst beim zweiten Impuls auf Y1', 'Der Zylinder fährt hin und her'], 'Das bistabile Ventil speichert seine Stellung. Es braucht nur Impulse und schaltet erst wieder um, wenn die Gegenspule angesteuert wird.', ['Bi heißt zwei stabile Stellungen.', 'Das Ventil merkt sich die Stellung.']],
    ['Welchen Vorteil hat ein bistabiles Ventil gegenüber einem monostabilen?', 'Es behält seine Stellung ohne Dauerstrom, auch bei Spannungsausfall', ['Es braucht keine Druckluft', 'Es hat nur eine Spule', 'Es schaltet immer schneller'], 'Das bistabile Ventil braucht nur kurze Impulse und spart Strom. Bei Spannungsausfall bleibt die Stellung erhalten, was je nach Anlage ein Vorteil oder ein Nachteil sein kann.', ['Was braucht ein Ventil zum Halten?', 'Die Stellung wird gespeichert.']]
  ];
  const ENDL = [
    ['Wofür sitzen an einem Zylinder die Sensoren B1 und B2?', 'Die Sensoren melden der Steuerung die beiden Endlagen des Kolbens', ['Die Sensoren messen den Luftdruck', 'Die Sensoren schalten das Ventil direkt', 'Die Sensoren messen die Temperatur der Kolbenstange'], 'Die Endlagensensoren melden, ob der Kolben hinten oder vorn angekommen ist. Die Steuerung wertet das aus.', ['Wo kann ein Kolben stehen?', 'Der Sensor meldet, die Steuerung entscheidet.']],
    ['Wodurch wird ein Reedkontakt am Zylinder betätigt?', 'Durch den Magneten am Kolben', ['Durch den Luftdruck im Zylinder', 'Durch die Spannung an der Ventilspule', 'Durch die Wärme des Kolbens'], 'Der Kolben trägt einen Dauermagneten. Dessen Feld schließt den Reedkontakt berührungslos von außen.', ['Was trägt der Kolben?', 'Berührungslos von außen.']],
    ['Was gilt für einen Reedkontakt als Endlagensensor?', 'Er arbeitet berührungslos und lässt sich außen am Zylinder anbringen', ['Er braucht einen Nocken an der Kolbenstange', 'Er funktioniert nur mit Wechselspannung', 'Er erkennt nur Aluminium'], 'Der Reedkontakt erkennt den Magneten durch die Zylinderwand. Ein Endschalter dagegen wird mechanisch betätigt.', ['Wo wird er montiert?', 'Welches Signal braucht er?']],
    ['Warum startet in einer Ablaufsteuerung der nächste Schritt erst nach der Endlagenmeldung?', 'Damit der Schritt erst beginnt, wenn der vorige wirklich beendet ist', ['Weil die Ventile sonst keine Luft bekommen', 'Weil der Zylinder sonst zu schnell fährt', 'Weil Ventile nur nach Zeit schalten'], 'Die Rückmeldung zeigt, dass die Bewegung geschafft ist. Ohne sie könnte der nächste Schritt starten, obwohl der Zylinder noch fährt oder klemmt.', ['Wie weiß die Steuerung, dass der Zylinder angekommen ist?', 'Ohne Meldung weiß sie es nicht.']]
  ];
  const SPSI = [
    ['Wozu dient die Handhilfsbetätigung an einem Magnetventil?', 'Du kannst das Ventil von Hand schalten, auch ohne Strom, zum Beispiel bei der Inbetriebnahme', ['Der Druck im System wird erhöht', 'Die Feder wird ersetzt', 'Das Ventil wird vor Staub geschützt'], 'Mit der Handhilfsbetätigung kannst du die Bewegung prüfen oder einen Fehler eingrenzen, ohne die Spule zu bestromen.', ['Was kannst du ohne Strom prüfen?', 'Von Hand schalten.']],
    ['Was ist bei der Wartung eines Zylinders mit Druckluft und Strom zuerst zu tun?', 'Anlage ausschalten, gegen Wiedereinschalten sichern und die Druckluft entlüften', ['Den Zylinder festhalten', 'Nur die Steuerspannung abschalten und den Druck lassen', 'Den Not-Halt überbrücken'], 'Erst Energie wegnehmen, dann gegen Wiedereinschalten sichern, dann Restdruck ablassen. So kann sich nichts unerwartet bewegen.', ['Energie wegnehmen, Reihenfolge beachten.', 'Auch Druckluft ist Energie.']],
    ['Warum kann an einer ausgeschalteten Anlage ein Zylinder noch gefährlich sein?', 'Im System kann noch Restdruck stehen, der den Kolben bewegt', ['Weil der Zylinder warm bleibt', 'Weil das Ventil dann doppelt schaltet', 'Weil der Reedkontakt Strom erzeugt'], 'Gespeicherte Druckluft kann den Kolben auch ohne Strom bewegen. Vor Arbeiten wird entlüftet.', ['Was bleibt nach dem Abschalten im Schlauch?', 'Druckluft ist gespeichert.']],
    ['Warum ist bei Spannungsausfall oft ein monostabiles Ventil die sicherere Wahl?', 'Die Feder bringt es in eine festgelegte Grundstellung', ['Weil es keine Druckluft braucht', 'Weil es nie ausfällt', 'Weil es zwei Spulen hat'], 'Ein monostabiles Ventil fährt bei Ausfall der Spannung in die Grundstellung. Ein bistabiles bleibt dort, wo es gerade steht. Welche Lage sicher ist, hängt von der Anlage ab.', ['Wer stellt ohne Strom zurück?', 'Eine feste Lage nach dem Ausfall.']]
  ];
  const SENW = [
    ['Auf einem Band sollen nur Metallteile erkannt werden, Kunststoffteile sollen ignoriert werden. Welcher Sensor?', 'Induktiver Näherungsschalter', ['Kapazitiver Näherungsschalter', 'Reedkontakt', 'Optischer Taster für Glas'], 'Der induktive Sensor reagiert nur auf Metall. Ein kapazitiver Sensor würde auch Kunststoff erkennen.', ['Welcher Sensor spricht nur auf Metall an?', 'Kunststoff darf nicht auslösen.']],
    ['Der Füllstand von Granulat soll von außen durch eine Kunststoffwand des Behälters erkannt werden. Welcher Sensor?', 'Kapazitiver Näherungsschalter', ['Induktiver Näherungsschalter', 'Reedkontakt', 'Mechanischer Endschalter'], 'Kapazitive Sensoren erkennen auch nichtmetallische Stoffe durch dünne Wände. Der induktive Sensor sieht Kunststoff nicht.', ['Granulat ist nicht metallisch.', 'Der Sensor soll durch die Wand erkennen.']],
    ['Der Kolben eines Zylinders trägt einen Magneten, der von außen erkannt werden soll. Welcher Sensor?', 'Magnetfeldsensor (Reedkontakt)', ['Induktiver Näherungsschalter für Stahl', 'Kapazitiver Näherungsschalter', 'Optischer Taster'], 'Der Magnetfeldsensor ist für Magnete gebaut und sitzt am Zylinder.', ['Was soll erkannt werden: Metall oder Magnet?', 'Es ist ein Magnetfeld.']],
    ['Ein Karton soll aus 400 mm Abstand erkannt werden. Welcher Sensor passt?', 'Optischer Taster (Reflexionslichttaster)', ['Induktiver Sensor', 'Kapazitiver Sensor', 'Reedkontakt'], 'Induktive und kapazitive Sensoren haben nur wenige Millimeter bis Zentimeter Reichweite. Optische Sensoren erreichen größere Abstände.', ['Wie groß ist der Abstand?', 'Wer hat die größte Reichweite?']],
    ['Wasser in einem Kunststoffrohr soll von außen erkannt werden. Welcher Sensor?', 'Kapazitiver Näherungsschalter', ['Induktiver Näherungsschalter', 'Reedkontakt', 'Optischer Taster für undurchsichtige Teile'], 'Wasser verändert die Kapazität am Sensor, auch durch die Rohrwand. Induktive Sensoren reagieren nicht auf Wasser.', ['Wasser ist nicht metallisch.', 'Erkennen durch die Wand.']]
  ];
  const OPT = [
    ['Ein PNP-Öffner ist unbetätigt (kein Teil im Schaltabstand). Welchen Pegel sieht ein Eingang für 24 V?', '1 (24 V am Eingang)', ['0 (0 V am Eingang)', 'Nicht definiert', 'Wechselspannung'], 'Der Öffner schaltet seinen Ausgang im unbetätigten Zustand ein. Ein PNP schaltet dann +24 V auf die Signalleitung. Der Eingang sieht 24 V, also eine 1.', ['Was tut ein Öffner ohne Betätigung?', 'PNP schaltet +24 V.']],
    ['Warum wird als Meldung "Schutztür geschlossen" oft ein Öffner-Signal benutzt?', 'Bei Drahtbruch sieht die Steuerung dasselbe wie bei geöffneter Tür: Die Maschine stoppt', ['Weil ein Öffner weniger Strom braucht', 'Weil ein Schließer nicht in Schutztüren passt', 'Weil Öffner keine Adern brauchen'], 'Fällt das Signal ab, wird es als "Tür offen" gewertet. So führt auch ein Kabelbruch zum sicheren Stopp (Ruhestromprinzip).', ['Was sieht die Steuerung bei Drahtbruch?', 'Ruhestromprinzip.']],
    ['Wann gibt ein optischer Reflexionslichttaster ein Signal?', 'Wenn das Licht vom Objekt zurückgeworfen und vom Empfänger gesehen wird', ['Wenn die Lichtquelle ausfällt', 'Wenn die Raumtemperatur sinkt', 'Wenn der Strahl dauerhaft unterbrochen ist und kein Empfänger da ist'], 'Sender und Empfänger sitzen im selben Gehäuse. Ein Objekt wirft das Licht zurück.', ['Wo sitzt der Empfänger?', 'Das Objekt wirft Licht zurück.']],
    ['Wie unterscheiden sich Einweg-Lichtschranke und Lichttaster?', 'Bei der Lichtschranke stehen Sender und Empfänger sich gegenüber, beim Taster sitzen beide im selben Gehäuse', ['Es gibt keinen Unterschied', 'Der Taster hat nur einen Sender', 'Die Lichtschranke arbeitet mit Magneten'], 'Eine Einweg-Lichtschranke hat zwei Teile, die Unterbrechung des Strahls ist das Signal. Der Taster ist ein einziges Gerät.', ['Wie viele Gehäuse?', 'Wohin zeigt der Strahl?']]
  ];
  const DRB = [
    ['Was bedeutet das Ruhestromprinzip?', 'Der sichere Zustand entspricht dem stromlosen Zustand: ein Drahtbruch führt zum sicheren Zustand', ['Der Strom fließt nur in Ruhe', 'Alle Leitungen sind dauernd stromlos', 'Es gibt keine Drahtbrüche'], 'Wenn "sicher" ein Signal von 0 bedeutet, fällt die Anlage bei Leitungsbruch oder Spannungsausfall in den sicheren Zustand.', ['Welcher Zustand ist sicher?', 'Was passiert bei Drahtbruch?']],
    ['Ein Stopp-Taster ist als Schließer angeschlossen. Das Kabel bricht. Was geschieht?', 'Die Maschine lässt sich nicht mehr ausschalten und der Fehler fällt nicht auf', ['Die Maschine schaltet sofort aus', 'Die Maschine meldet den Fehler', 'Nichts ändert sich beim Drücken, aber die Maschine läuft schneller'], 'Ein Schließer liefert nur beim Drücken ein Signal. Bei Drahtbruch bleibt das Signal immer aus, du bemerkst den Fehler nicht.', ['Wann liefert ein Schließer ein Signal?', 'Was sieht die Steuerung bei Bruch?']],
    ['Ein Aus-Taster ist als Öffner angeschlossen. Das Kabel bricht. Was geschieht?', 'Die Steuerung sieht dasselbe wie bei gedrücktem Taster: Die Maschine schaltet aus', ['Die Maschine läuft unbemerkt weiter', 'Der Taster zeigt dann ein falsches Signal', 'Nichts, denn die Steuerung sieht keinen Unterschied'], 'Ein Öffner liefert im Ruhezustand ein Signal. Bei Drahtbruch fällt es weg, das wirkt wie ein Druck auf Aus.', ['Was liefert ein Öffner in Ruhe?', 'Bruch bedeutet Signal weg.']],
    ['Warum prüft man den Not-Halt-Kreis oft mit einem Ruhesignal statt mit einem Arbeitssignal?', 'Ein Fehler im Kreis wird sofort wirksam und die Maschine bleibt stehen', ['Weil der Kreis weniger Strom braucht', 'Weil Arbeitssignale zu teuer sind', 'Weil Ruhesignale schneller sind'], 'Mit Ruhestrom führt jeder Leitungsfehler zum Stopp. Das ist der sichere Weg bei Schutzfunktionen.', ['Was will man bei Fehlern erreichen?', 'Fehler soll zum Stopp führen.']]
  ];
  const LED = [
    ['Die Eingangs-LED E3 leuchtet nicht, obwohl der Taster gedrückt ist. Was weißt du dadurch?', 'Am Eingang kommt keine ausreichende Spannung an: Taster, Leitung oder Versorgung kommen als Ursache in Frage', ['Die Kleinsteuerung ist defekt', 'Das Programm ist falsch', 'Der Ausgang ist überlastet'], 'Die LED zeigt, was an der Klemme anliegt, nicht was das Programm daraus macht. Der Fehler liegt davor.', ['Die LED zeigt den Eingang.', 'Wo kommt das Signal her?']],
    ['Die Ausgangs-LED A2 leuchtet, aber das Ventil zieht nicht an. Was sagt dir die LED?', 'Das Programm hat den Ausgang eingeschaltet; ob an der Klemme Spannung anliegt, zeigt erst die Messung', ['Das Ventil ist sicher in Ordnung', 'Die Leitung ist sicher in Ordnung', 'Der Ausgang liefert sicher 24 V'], 'Die LED zeigt den Befehl des Programms. Leitung, Klemme und Spule kann sie nicht prüfen.', ['Die LED sitzt vor der Klemme.', 'Messung gegen 0 V.']],
    ['E1 leuchtet dauerhaft, auch ohne Betätigung. Was kommt als Ursache in Frage?', 'Der Sensor ist ein Öffner oder die Signalleitung hat Kontakt mit +24 V', ['Das Netzteil ist zu groß', 'Der Ausgang ist überlastet', 'Die Kleinsteuerung hat zu wenig Speicher'], 'Ein Öffner liefert im Ruhezustand ein Signal. Ein Schluss gegen +24 V täuscht ebenfalls eine 1 vor.', ['Was liefert ein Öffner im Ruhezustand?', 'Kann die Leitung Plus berühren?']],
    ['Keine LED an der Kleinsteuerung leuchtet. Was prüfst du zuerst?', 'Die Versorgungsspannung an den Klemmen der Kleinsteuerung', ['Das Programm', 'Alle Sensoren einzeln', 'Die Pneumatik'], 'Ohne Versorgung bleiben alle LED dunkel. Dann ist weder Programm noch Sensor die erste Ursache.', ['Was braucht ein Gerät als Erstes?', 'Ohne Spannung bleibt alles dunkel.']]
  ];
  const MESS = [
    ['Du willst prüfen, ob +24 V am Sensor ankommen. Wo misst du?', 'Zwischen brauner und blauer Ader am Sensor', ['Zwischen schwarzer Ader und Schutzleiter der Halle', 'Zwischen blauer Ader und dem Netzleiter 230 V', 'Gar nicht, die LED reicht'], 'Die Versorgung des Sensors liegt zwischen braun (+24 V) und blau (0 V). Gemessen wird immer zwischen den beiden Punkten, die den Stromkreis bilden.', ['Zwischen welchen Adern liegt die Versorgung?', 'Plus und Minus.']],
    ['Du willst den Widerstand einer Magnetspule messen. Was ist wichtig?', 'Die Spule spannungsfrei machen und abklemmen, sonst verfälschen andere Zweige die Messung', ['Die Spule unter Spannung lassen', 'Die Spule in Reihe mit dem Netzteil messen', 'Ein Strommessgerät an die Spule halten'], 'Der Widerstand wird nur an spannungsfreien Teilen gemessen. Parallele Zweige würden den Wert verändern.', ['Unter Spannung messen ist falsch.', 'Parallelzweige stören.']],
    ['Du misst eine Gleichspannung mit dem Multimeter. In welche Buchsen gehören die Messleitungen?', 'COM und die Buchse für Spannung (V)', ['COM und die Buchse für Strom (A)', 'Beide in die Buchse für Strom', 'Beide in COM'], 'Spannung wird parallel mit den Buchsen COM und V gemessen. In der Strombuchse wäre das Gerät fast ein Kurzschluss.', ['Spannung heißt V.', 'Die Strombuchse ist falsch.']],
    ['Ein Bauteil soll auf Durchgang geprüft werden. Was musst du vorher tun?', 'Die Anlage spannungsfrei schalten und gegen Wiedereinschalten sichern', ['Die Anlage laufen lassen', 'Das Netzteil auf Maximum stellen', 'Nur die Sicherung herausnehmen'], 'Durchgangsprüfung geschieht an spannungsfreien Teilen. Dazu gehört auch die Sicherung gegen Wiedereinschalten.', ['Unter Spannung prüfen ist gefährlich.', 'Reihenfolge der Sicherheitsregeln.']],
    ['An einer Spule misst du am Minusanschluss fast die volle Versorgungsspannung gegen 0 V. Was ist wahrscheinlich?', 'Die 0-V-Leitung der Spule ist unterbrochen', ['Die Spule ist in Ordnung', 'Der Ausgang liefert zu wenig Strom', 'Das Netzteil ist zu klein'], 'Ohne Rückleitung fließt kein Strom. Der Minusanschluss liegt über die Spule auf Plus, das Messgerät zeigt fast die volle Spannung.', ['Wohin fließt der Strom zurück?', 'Der Minusanschluss ist über die Spule am Plus.']]
  ];

  /* ---------- Hilfen für Zufallswerte ---------- */
  const pressName = t => (t === 'E' ? 'S1 (Ein)' : 'S2 (Aus)');
  const EXPR = [
    ['(I1 UND I2) ODER I3', (a, b, c) => (a && b) || c],
    ['I1 UND (I2 ODER I3)', (a, b, c) => a && (b || c)],
    ['(I1 ODER I2) UND NICHT I3', (a, b, c) => (a || b) && !c],
    ['I1 XOR I3', (a, b, c) => a !== c],
    ['NICHT (I1 UND I2 UND I3)', (a, b, c) => !(a && b && c)],
    ['I1 UND NICHT I2 UND I3', (a, b, c) => a && !b && c],
    ['(I1 UND I2) ODER (NICHT I1 UND I3)', (a, b, c) => (a && b) || (!a && c)]
  ];
  const GATENAME = { und: 'UND', oder: 'ODER', nand: 'NAND', nor: 'NOR', xor: 'XOR' };
  const LEIT = [[14, 0.5, 1], [28, 0.5, 2], [42, 0.5, 3], [28, 1, 1], [56, 1, 2], [42, 0.75, 2], [56, 0.5, 4]];
  const evPulse = (list, t0) => { let t = t0; const ev = []; list.forEach(p => { ev.push({ t, i1: 1, i2: 0 }); ev.push({ t: t + p[0], i1: 0, i2: 0 }); t += p[0] + p[1]; }); return { ev, end: t }; };

  const G = {
    /* ===== Relais, Schütz, Selbsthaltung ===== */
    klemm: pq(KLEMM, 'Lies, was gesucht ist: Kontakt, Spule oder Hauptkontakt. Rufe dir die Nummerierung ab: Spule A1/A2, Schließer Endziffern 3/4, Öffner 1/2. Wähle die passende Antwort.'),
    relais: pq(RS, GO_LIES),
    shfolge: R => {
      const c = C(); let seq, out, steps, n;
      do {
        seq = ['E']; const m = c.ri(R, 5, 6); for (let i = 1; i < m; i++) seq.push(c.pick(R, ['E', 'A']));
        steps = []; seq.forEach(t => { steps.push(t === 'E' ? { s1: 1 } : { s2: 1 }); steps.push({}); });
        out = c.shRun({ mode: 'sh', vorrang: 'aus', k1: false }, steps); n = 0; let prev = false;
        seq.forEach((t, i) => { const st = out[2 * i + 1].k1; if (st && !prev) n++; prev = st; });
      } while (n < 2 || seq.filter(x => x === 'E').length < 3);
      const log = seq.map((t, i) => pressName(t) + ': K1 ' + (out[2 * i + 1].k1 ? 'an' : 'aus'));
      return numQ('Eine Selbsthaltung mit Aus-Vorrang ist am Anfang abgefallen. Du drückst nacheinander ' + seq.map(pressName).join(', ') + ' und lässt nach jedem Druck los. Wie oft zieht K1 dabei neu an?', n, 'Mal', 'Anzahl', 0.01,
        'Nach jedem Druck mit Loslassen: ' + log.join('; ') + '. K1 zieht nur an, wenn es vorher aus war und S1 gedrückt wird: ' + n + ' Mal. Ein weiterer Druck auf Ein bei angezogenem K1 ändert nichts.', ['Verfolge den Zustand von K1 nach jedem Druck.', 'Ein bei angezogenem K1 zählt nicht neu.'],
        '1. Beginne mit K1 aus. 2. Gehe jeden Tastendruck der Reihe nach durch und notiere den Zustand von K1 nach dem Loslassen. 3. Zähle die Übergänge von aus nach an.');
    },
    vorrang: R => {
      const c = C(), v = c.pick(R, ['aus', 'ein']), A = 'K1 zieht an und bleibt nach dem Loslassen angezogen', B = 'K1 zieht nicht an', Cc = 'K1 zieht an und fällt beim Loslassen wieder ab';
      const bau = v === 'aus' ? 'S2 (Öffner) liegt vor der Parallelschaltung aus S1 und Selbsthaltekontakt' : 'S1 liegt direkt an der Spule, S2 (Öffner) liegt nur im Zweig des Selbsthaltekontakts';
      const k = c.shSettle({ mode: 'sh', vorrang: v }, { k1: false }, { s1: 1, s2: 1 }), after = c.shSettle({ mode: 'sh', vorrang: v }, k, {});
      const right = !k.k1 ? B : after.k1 ? A : Cc;
      return choiceQ(R, 'Bei einer Selbsthaltung gilt: ' + bau + '. K1 ist abgefallen. Du drückst S1 und S2 gleichzeitig. Was geschieht?', right, [A, B, Cc].filter(x => x !== right),
        v === 'aus' ? 'Der Öffner S2 unterbricht den Strompfad vor der Parallelschaltung, die Spule bekommt keinen Strom (Aus-Vorrang). K1 zieht nicht an.' : 'S1 liegt direkt an der Spule und überbrückt S2. K1 zieht an, der Selbsthaltekontakt schließt, nach dem Loslassen hält K1 sich selbst, wenn S2 nicht mehr gedrückt ist (Ein-Vorrang).',
        ['Zeichne den Strompfad mit beiden gedrückten Tastern.', 'Kommt Strom bis zur Spule?'], '1. Lies, wo S2 im Plan liegt. 2. Verfolge den Strompfad zur Spule mit beiden Tastern gedrückt. 3. Prüfe, ob K1 nach dem Loslassen von selbst hält.');
    },
    wende: pq(WEN, GO_LIES),
    nullspg: pq(NS, GO_LIES),
    spulenstrom: R => {
      const c = C(), r = c.pick(R, [480, 600, 800, 960, 1200, 1600, 2400]), i = c.coilMA(24, r);
      return numQ('Die Spule eines Schützes (24 V Gleichspannung) hat einen Wicklungswiderstand von ' + f(r, 0) + ' Ω. Welcher Strom fließt bei angelegter Spannung?', i, 'mA', 'Spulenstrom', 0.01,
        'I = U / R = 24 V / ' + f(r, 0) + ' Ω = ' + f(i / 1000, 3) + ' A = ' + f(i, 0) + ' mA.', ['Ohmsches Gesetz: I = U / R.', 'Ergebnis in Ampere, dann mal 1000 für mA.'],
        '1. Schreibe die Formel I = U / R. 2. Setze 24 V und den Widerstand in Ω ein. 3. Rechne in mA um (mal 1000).');
    },
    spulenleistung: R => {
      const c = C(), i = c.pick(R, [25, 40, 50, 75, 100, 125]), p = 24 * i / 1000;
      return numQ('Die Spule eines Relais nimmt bei 24 V einen Strom von ' + f(i, 0) + ' mA auf. Welche elektrische Leistung nimmt sie auf?', p, 'W', 'Leistung', 0.01,
        'P = U · I = 24 V · ' + f(i / 1000, 3) + ' A = ' + f(p, 3) + ' W.', ['P = U · I.', 'Strom zuerst in Ampere umrechnen.'],
        '1. Schreibe P = U · I. 2. Rechne den Strom in A um. 3. Multipliziere mit 24 V.');
    },
    /* ===== Kleinsteuerung als Gerät ===== */
    belegung: R => {
      const c = C(), ne = c.pick(R, [8, 12, 16]), na = c.pick(R, [6, 8, 10]), fe = c.pick(R, ['e', 'a']);
      if (fe === 'e') {
        const e = c.ri(R, 4, ne - 4), res = c.ri(R, 1, 2), fr = ne - e - res;
        return numQ('Die Kleinsteuerung hat ' + ne + ' digitale Eingänge und ' + na + ' digitale Ausgänge. In der Belegungsliste sind ' + e + ' Eingänge vergeben. Du willst ' + res + ' Eingänge als Reserve freihalten. Wie viele Eingänge kannst du noch neu belegen?', fr, 'Eingänge', 'Freie Eingänge', 0.01,
          'Alle Eingänge minus belegte minus Reserve: ' + ne + ' − ' + e + ' − ' + res + ' = ' + fr + '.', ['Ziehe von allen Eingängen die belegten ab.', 'Dann die Reserve abziehen.'],
          '1. Lies die Zahl der Eingänge. 2. Ziehe die belegten ab. 3. Ziehe die Reserve ab, sie bleibt frei.');
      }
      const a = c.ri(R, 2, na - 3), fr = na - a - 1;
      return numQ('Die Kleinsteuerung hat ' + ne + ' digitale Eingänge und ' + na + ' digitale Ausgänge. In der Belegungsliste sind ' + a + ' Ausgänge vergeben. Du willst 1 Ausgang als Reserve freihalten. Wie viele Ausgänge kannst du noch neu belegen?', fr, 'Ausgänge', 'Freie Ausgänge', 0.01,
        'Alle Ausgänge minus belegte minus Reserve: ' + na + ' − ' + a + ' − 1 = ' + fr + '.', ['Ziehe von allen Ausgängen die belegten ab.', 'Dann die Reserve abziehen.'],
        '1. Lies die Zahl der Ausgänge. 2. Ziehe die belegten ab. 3. Ziehe die Reserve ab, sie bleibt frei.');
    },
    gesamtstrom: R => {
      const c = C(), n1 = c.pick(R, [2, 3, 4, 6]), i1 = c.pick(R, [40, 50, 60, 80]), n2 = c.pick(R, [4, 5, 6, 8]), i2 = c.pick(R, [10, 15, 20]), ik = c.pick(R, [100, 150, 200]), s = n1 * i1 + n2 * i2 + ik;
      return numQ('An einem 24-V-Netzteil hängen ' + n1 + ' Ventilspulen mit je ' + i1 + ' mA, ' + n2 + ' Sensoren mit je ' + i2 + ' mA und eine Kleinsteuerung mit ' + ik + ' mA. Alle sind gleichzeitig eingeschaltet. Wie groß ist der Gesamtstrom?', s, 'mA', 'Gesamtstrom', 0.01,
        'Ventile: ' + n1 + ' · ' + i1 + ' mA = ' + n1 * i1 + ' mA. Sensoren: ' + n2 + ' · ' + i2 + ' mA = ' + n2 * i2 + ' mA. Kleinsteuerung: ' + ik + ' mA. Summe: ' + s + ' mA.', ['Gleiche Verbraucher: Anzahl mal Einzelstrom.', 'Alle Teilströme addieren.'],
        '1. Rechne je Gruppe Anzahl mal Einzelstrom. 2. Nimm die Kleinsteuerung dazu. 3. Addiere alles, denn alle laufen gleichzeitig.');
    },
    netzteil: R => {
      const c = C(), a = c.pick(R, [0.38, 0.64, 1.5, 2.3, 3.6, 5.2]), n = c.psuFor(a * 1000);
      return numQ('Die Anlage nimmt an 24 V insgesamt ' + f(a, 2) + ' A auf. Das Netzteil soll mindestens 20 % Reserve haben. Welche Nennstrom-Stufe ist die kleinste passende? Es gibt Netzteile mit 0,5 A, 1 A, 2,5 A, 5 A und 10 A.', n, 'A', 'Nennstrom', 0.001,
        'Mit 20 % Reserve: ' + f(a, 2) + ' A · 1,2 = ' + f(a * 1.2, 3) + ' A. Die kleinste Stufe, die mindestens so viel liefert, ist ' + f(n, 1) + ' A.', ['Reserve: Strom mal 1,2.', 'Die erste Stufe nehmen, die mindestens so groß ist.'],
        '1. Rechne den Strom mit 20 % Reserve (mal 1,2). 2. Gehe die Stufen von klein nach groß durch. 3. Wähle die erste Stufe, die den Wert erreicht.');
    },
    ausgangtyp: pq([
      ['Du willst eine Last mit 230 V Wechselspannung schalten. Welcher Ausgang einer Kleinsteuerung kommt in Frage?', 'Ein Relaisausgang (potenzialfreier Kontakt)', ['Ein Transistorausgang für 24 V Gleichspannung', 'Ein Eingang', 'Jeder Ausgang, die Spannung ist egal'], 'Relaiskontakte sind potenzialfrei und für die angegebene Spannung ausgelegt. Ein Transistorausgang für 24 V DC schaltet keine 230 V AC.', ['Wer ist von der Steuerung getrennt?', 'Transistor: nur 24 V DC.']],
      ['Ein Ventil wird über Jahre mehrmals pro Sekunde geschaltet. Welcher Ausgang hält länger?', 'Ein Transistorausgang, weil er keinen mechanischen Verschleiß hat', ['Ein Relaisausgang, weil er einen Kontakt hat', 'Beide gleich lang', 'Weder noch, beides hält höchstens ein paar Minuten'], 'Relaiskontakte verschleißen mit jeder Schaltung. Ein Transistor schaltet ohne bewegte Teile.', ['Welcher Ausgang hat bewegte Teile?', 'Verschleiß begrenzt die Schaltspiele.']],
      ['Eine Magnetspule hängt an einem Transistorausgang. Was schützt den Ausgang vor der Spannungsspitze beim Abschalten?', 'Eine Freilaufdiode parallel zur Spule', ['Ein Widerstand in Reihe zum Ausgang', 'Ein Kondensator in Reihe zur Spule', 'Eine zweite Spule in Reihe'], 'Beim Abschalten will die Spule den Strom weitertreiben und erzeugt eine hohe Spannung. Die Diode (in Sperrrichtung zur Versorgung) leitet den Strom ab.', ['Die Spule erzeugt beim Abschalten eine Spannungsspitze.', 'Ein Bauteil leitet den Strom ab.']],
      ['Was bedeutet "potenzialfrei" bei einem Relaisausgang?', 'Der Kontakt ist galvanisch vom Steuerungsteil getrennt und hat keine eigene Spannung', ['Der Ausgang liefert immer 0 V', 'Der Ausgang liefert immer 24 V', 'Der Kontakt hat keinen Anschluss'], 'Der Relaiskontakt ist ein reiner Schalter. Die Spannung für die Last bringst du selbst mit.', ['Der Kontakt ist nur ein Schalter.', 'Wer liefert die Spannung?']]
    ], GO_LIES),
    reserve: R => {
      const c = C(), a = c.pick(R, [60, 80, 100, 120, 150]), b = c.pick(R, [40, 50, 90, 110, 130]), r = 500 - a - b;
      return numQ('Ein Transistorausgang der Kleinsteuerung darf höchstens 500 mA liefern. Daran hängen zwei Ventilspulen mit ' + a + ' mA und ' + b + ' mA, die gleichzeitig schalten. Wie viel Strom darf noch zusätzlich entnommen werden?', r, 'mA', 'Reserve', 0.01,
        'Belastung: ' + a + ' mA + ' + b + ' mA = ' + (a + b) + ' mA. Reserve: 500 mA − ' + (a + b) + ' mA = ' + r + ' mA.', ['Erst die Belastung addieren.', 'Dann von 500 mA abziehen.'],
        '1. Addiere die Ströme der Verbraucher. 2. Ziehe die Summe vom Grenzwert 500 mA ab.');
    },
    sensoranschluss: pq([
      ['Die Eingänge einer Kleinsteuerung erkennen bei +24 V eine 1. Welcher Sensortyp passt?', 'PNP: er schaltet +24 V auf die Signalleitung', ['NPN: er schaltet 0 V auf die Signalleitung', 'PNP, aber nur als Schließer', 'Beide Typen funktionieren gleich'], 'Ein PNP-Sensor legt im geschalteten Zustand +24 V auf die Signalleitung, das erkennt der Eingang als 1. Ein NPN zieht die Leitung auf 0 V und wäre für diese Eingänge falsch.', ['Was soll der Eingang sehen?', 'PNP schaltet Plus.']],
      ['Ein PNP-Sensor hat geschaltet. Welche Spannung liegt am Signalausgang gegen 0 V?', 'Etwa +24 V', ['0 V', 'Eine Wechselspannung', 'Keine, der Ausgang ist offen'], 'Der PNP-Ausgang verbindet die Signalleitung mit +24 V.', ['PNP schaltet Plus.', 'Gegen 0 V gemessen.']],
      ['Welche Adern hat ein üblicher Dreidraht-Sensor?', 'Braun (+24 V), Blau (0 V), Schwarz (Signal)', ['Rot (+24 V), Gelb (0 V), Grün (Signal)', 'Braun (Signal), Schwarz (+24 V), Blau (0 V)', 'Zwei Adern, nur Versorgung'], 'Die übliche Zuordnung ist braun Plus, blau Minus, schwarz Signal.', ['Merke: braun, blau, schwarz.', 'Plus, Minus, Signal.']],
      ['Warum müssen Sensor und Kleinsteuerung dasselbe 0 V haben?', 'Der Eingang misst gegen 0 V, ohne gemeinsames Bezugspotenzial ist der Pegel nicht eindeutig', ['Weil der Sensor sonst mehr Strom braucht', 'Weil sonst die Sensor-LED nicht leuchtet', 'Weil die Leitung sonst zu lang ist'], 'Ein Spannungspegel hat nur einen Sinn gegen ein Bezugspotenzial. Gemeinsames 0 V sorgt dafür, dass 24 V am Sensor auch 24 V am Eingang sind.', ['Spannung braucht einen Bezugspunkt.', 'Gemeinsames Bezugspotenzial.']]
    ], GO_LIES),
    aderfarbe: R => {
      const c = C(), A = [['Braun', '+24 V (Versorgung)'], ['Blau', '0 V (Masse)'], ['Schwarz', 'Signalausgang']], k = c.pick(R, A), alle = A.map(x => x[1]).concat(['Schutzleiter']);
      return choiceQ(R, 'Du schließt einen Dreidraht-Sensor an. Welche Funktion hat die ' + k[0].toLowerCase() + 'e Ader?', k[1], alle.filter(x => x !== k[1]),
        'Die übliche Zuordnung: braun +24 V, blau 0 V, schwarz Signalausgang. Ein Schutzleiter hat ein Sensor nicht.', ['Merke: braun, blau, schwarz = Plus, Minus, Signal.', 'Schutzleiter gibt es am Sensor nicht.'], '1. Rufe die Farbfolge ab: braun, blau, schwarz. 2. Ordne ihr Plus, Minus und Signal zu. 3. Wähle die Funktion der gefragten Ader.');
    },
    pegel: R => {
      const c = C(), u = c.pick(R, [0, 2, 4, 8, 10, 12, 18, 22, 24]), p = c.pegel(u), right = p === 0 ? 'Logisch 0' : p === 1 ? 'Logisch 1' : 'Nicht definiert';
      return choiceQ(R, 'Für die 24-V-Eingänge dieses Labs gilt: Bis 5 V erkennt der Eingang eine 0, ab 15 V eine 1, dazwischen ist der Zustand nicht definiert. Am Eingang liegen ' + f(u, 0) + ' V. Was erkennt die Kleinsteuerung?', right, ['Logisch 0', 'Logisch 1', 'Nicht definiert'].filter(x => x !== right),
        f(u, 0) + ' V liegen ' + (p === 0 ? 'unter oder bei 5 V: Logisch 0.' : p === 1 ? 'bei oder über 15 V: Logisch 1.' : 'zwischen 5 V und 15 V: nicht definiert.'), ['Vergleiche die Spannung mit 5 V und 15 V.', 'Dazwischen weiß die Steuerung es nicht.'], '1. Lies die Spannung. 2. Prüfe: höchstens 5 V? mindestens 15 V? 3. Wenn keins von beiden zutrifft, ist der Pegel nicht definiert.');
    },
    /* ===== Funktionsplan, Zeiten, Zähler ===== */
    gatter: R => {
      const c = C(), a = c.pick(R, [0, 1]), b = c.pick(R, [0, 1]), ks = Object.keys(c.GATES), r = ks.filter(k => c.GATES[k](!!a, !!b)), n = r.length;
      return numQ('An den Eingängen liegen I1 = ' + a + ' und I2 = ' + b + '. Wie viele der fünf Bausteine UND, ODER, NAND, NOR und XOR haben am Ausgang eine 1?', n, 'Bausteine', 'Anzahl', 0.01,
        'Mit I1 = ' + a + ', I2 = ' + b + ' liefern eine 1: ' + (r.length ? r.map(k => GATENAME[k]).join(', ') : 'keiner') + '. Das sind ' + n + ' Bausteine.', ['Werte jeden Baustein einzeln aus.', 'NAND und NOR sind die verneinten Bausteine.'],
        '1. Werte UND, ODER, NAND, NOR und XOR mit den Eingangswerten aus. 2. Zähle die Bausteine mit Ausgang 1.');
    },
    wahrheit: R => {
      const c = C(), e = c.pick(R, EXPR), n = c.ones3(e[1]);
      return numQ('Gegeben ist die Verknüpfung Q = ' + e[0] + '. Die drei Eingänge I1, I2 und I3 können 8 verschiedene Kombinationen annehmen. Bei wie vielen Kombinationen ist Q = 1?', n, 'Kombinationen', 'Anzahl', 0.01,
        'Alle 8 Kombinationen von I1, I2, I3 durchgehen und Q auswerten. Q = 1 bei ' + n + ' Kombinationen.', ['Schreibe die 8 Zeilen der Wahrheitstabelle.', 'Werte Klammern zuerst aus.'],
        '1. Schreibe alle 8 Kombinationen von I1, I2, I3 auf. 2. Werte die Klammern aus, dann die übrige Verknüpfung. 3. Zähle die Zeilen mit Q = 1.');
    },
    fupbegriff: pq(FUPB, GO_LIES),
    ton: R => {
      const c = C(), T = c.ri(R, 2, 5), d1 = c.ri(R, 1, T - 1), gap = c.ri(R, 2, 4), d2 = T + c.ri(R, 2, 6), p = evPulse([[d1, gap], [d2, 0]], 1);
      const on = c.onTime(c.fupTrace('ton', { T }, p.ev, p.end + 3));
      return numQ('Eine Einschaltverzögerung (TON) hat die Zeit ' + T + ' s. Der Eingang I1 wird zweimal eingeschaltet: zuerst ' + d1 + ' s lang, nach einer Pause von ' + gap + ' s dann ' + d2 + ' s lang. Wie lange ist Q insgesamt eingeschaltet?', on, 's', 'Einschaltdauer', 0.01,
        'Beim ersten Mal liegt I1 nur ' + d1 + ' s an, das ist kürzer als ' + T + ' s: Q bleibt aus. Beim zweiten Mal schaltet Q nach ' + T + ' s ein und bleibt bis I1 wegfällt: ' + d2 + ' s − ' + T + ' s = ' + on + ' s.', ['Q schaltet nur, wenn I1 mindestens die Zeit lang anliegt.', 'Ziehe die Verzögerung von der Dauer ab.'],
        '1. Prüfe jeden Impuls: ist er mindestens so lang wie die Zeit? 2. Für jeden langen Impuls gilt: Q ist an von Zeit bis Ende des Impulses. 3. Addiere die Einschaltdauern.');
    },
    tof: R => {
      const c = C(), T = c.ri(R, 3, 6), d1 = c.ri(R, 1, 4), gap = c.ri(R, 1, T - 1), d2 = c.ri(R, 1, 4), p = evPulse([[d1, gap], [d2, 0]], 1);
      const on = c.onTime(c.fupTrace('tof', { T }, p.ev, p.end + T + 3));
      return numQ('Eine Ausschaltverzögerung (TOF) hat die Zeit ' + T + ' s. I1 wird zweimal eingeschaltet: ' + d1 + ' s lang, nach einer Pause von ' + gap + ' s dann ' + d2 + ' s lang. Wie lange ist Q insgesamt eingeschaltet?', on, 's', 'Einschaltdauer', 0.01,
        'Die Pause (' + gap + ' s) ist kürzer als ' + T + ' s, deshalb läuft die Zeit nicht ab: Q bleibt durchgehend an. Von der ersten steigenden Flanke bis ' + T + ' s nach dem letzten Abschalten: ' + d1 + ' + ' + gap + ' + ' + d2 + ' + ' + T + ' = ' + on + ' s.', ['Ist die Pause kürzer als die Zeit?', 'Dann läuft Q durch.'],
        '1. Prüfe, ob die Pause kürzer als die Zeit ist: dann bleibt Q durchgehend an. 2. Addiere Impuls, Pause, Impuls und die Nachlaufzeit.');
    },
    wischer: R => {
      const c = C(), T = c.ri(R, 3, 5), s1 = 1, s2 = s1 + 2, s3 = s1 + T + c.ri(R, 1, 3), ev = [s1, s2, s3].flatMap(t => [{ t, i1: 1, i2: 0 }, { t: t + 1, i1: 0, i2: 0 }]);
      const on = c.onTime(c.fupTrace('wisch', { T }, ev, s3 + T + 3));
      return numQ('Ein Wischer (Impulsbaustein) hat die Zeit ' + T + ' s und lässt sich nicht nachtriggern. Der Taster an I1 wird dreimal kurz gedrückt, bei Sekunde ' + s1 + ', ' + s2 + ' und ' + s3 + '. Wie lange ist Q insgesamt eingeschaltet?', on, 's', 'Einschaltdauer', 0.01,
        'Der erste Druck startet einen Impuls von ' + T + ' s. Der zweite Druck kommt bei Sekunde ' + s2 + ' mitten im Impuls und wird ignoriert. Der dritte Druck bei Sekunde ' + s3 + ' kommt nach dem Ende (Sekunde ' + (s1 + T) + ') und startet einen zweiten Impuls. Zusammen: 2 · ' + T + ' s = ' + on + ' s.', ['Während des Impulses werden weitere Flanken ignoriert.', 'Wie viele Impulse starten wirklich?'],
        '1. Der erste Druck startet einen Impuls. 2. Prüfe bei jedem weiteren Druck, ob der Impuls noch läuft: dann wird er ignoriert. 3. Zähle die gestarteten Impulse mal Zeit.');
    },
    zaehler: R => {
      const c = C(), mode = c.pick(R, ['auf', 'ab']), S = c.ri(R, 4, 8), n1 = c.ri(R, 1, S - 1); let n2; do { n2 = c.ri(R, 1, S - 1); } while (n2 === n1);
      const seq = Array(n1).fill('p').concat(['r'], Array(n2).fill('p')), z = c.zaehler(mode, S, seq).z;
      return numQ((mode === 'auf' ? 'Ein Vorwärtszähler zählt von 0 bis zur Schwelle ' + S + '.' : 'Ein Rückwärtszähler wird mit dem Startwert ' + S + ' geladen und zählt abwärts.') + ' Er bekommt ' + n1 + ' Impulse, dann einen Reset (Rücksetzen) und danach ' + n2 + ' Impulse. Welchen Zählerstand zeigt er am Ende?', z, 'Impulse', 'Zählerstand', 0.01,
        'Der Reset ' + (mode === 'auf' ? 'setzt den Zähler auf 0 zurück' : 'lädt den Startwert ' + S + ' neu') + '. Danach kommen ' + n2 + ' Impulse: ' + (mode === 'auf' ? '0 + ' + n2 : S + ' − ' + n2) + ' = ' + z + '.', ['Der Reset löscht alles, was vorher war.', 'Zähle nur die Impulse nach dem Reset.'],
        '1. Der Reset stellt den Anfangswert wieder her. 2. Zähle nur die Impulse nach dem Reset. 3. Vorwärts: Anfangswert 0 plus Impulse. Rückwärts: Startwert minus Impulse.');
    },
    zeitwahl: pq(ZB, 'Lies, was die Anlage tun soll. Frage dich: Ist es eine Verzögerung beim Einschalten, beim Ausschalten, ein fester Impuls oder ein Zählen? Wähle den passenden Baustein.'),
    /* ===== Elektropneumatik ===== */
    ventil: pq(VENT, GO_LIES),
    teilhub: R => {
      const c = C(), T = c.pick(R, [2, 4, 5]), t = c.pick(R, T === 2 ? [0.5, 1] : T === 4 ? [1, 2, 3] : [1, 2, 3, 4]), p = c.epPulse({ ventil: 'mono', T }, t).max;
      return numQ('Ein Zylinder mit monostabilem Ventil braucht ' + f(T, 0) + ' s für den ganzen Hub nach vorn. Die Spule Y1 wird nur ' + f(t, 1) + ' s lang bestromt, danach ist sie stromlos. Wie viel Prozent des Hubs fährt der Kolben höchstens aus, bevor er zurückfährt?', p, '%', 'Hubanteil', 0.5,
        'Der Kolben fährt nur, solange Y1 bestromt ist. In ' + f(t, 1) + ' s legt er ' + f(t, 1) + ' s / ' + f(T, 0) + ' s = ' + f(t / T, 2) + ' des Hubs zurück, das sind ' + f(p, 0) + ' %. Dann stellt die Feder zurück.', ['Der Kolben fährt nur während der Bestromung aus.', 'Bestromungszeit durch Hubzeit.'],
        '1. Stelle fest: Das Ventil ist monostabil, der Kolben fährt nur bei Bestromung. 2. Teile die Bestromungszeit durch die Hubzeit. 3. Rechne in Prozent um.');
    },
    ausfall: R => {
      const c = C(), v = c.pick(R, ['mono', 'bi']), x = c.epPowerLoss({ ventil: v, T: 1 }, 1, 1), right = x === 0 ? 'Eingefahren (hinten)' : 'Ausgefahren (vorn)';
      return choiceQ(R, 'Ein Zylinder ist ausgefahren (Y1 fährt aus). Er wird von einem ' + (v === 'mono' ? 'monostabilen Ventil mit Federrückstellung' : 'bistabilen Ventil mit zwei Spulen') + ' gesteuert. Die Steuerspannung fällt aus, die Druckluft bleibt. Wo steht der Kolben nach einiger Zeit?', right, ['Eingefahren (hinten)', 'Ausgefahren (vorn)', 'In der Mitte'].filter(y => y !== right),
        v === 'mono' ? 'Ohne Strom stellt die Feder das Ventil in die Grundstellung. Der Kolben fährt ein.' : 'Ein bistabiles Ventil behält seine Stellung. Der Kolben bleibt ausgefahren.', ['Was geschieht mit dem Ventil ohne Strom?', 'Feder oder Speicher?'],
        '1. Prüfe, ob das Ventil eine Feder oder einen Speicher hat. 2. Mono: Das Ventil geht in die Grundstellung. Bi: Es bleibt. 3. Der Kolben folgt dem Ventil.');
    },
    endlage: pq(ENDL, GO_LIES),
    zyklen: R => {
      const c = C(), Tz = c.pick(R, [4, 5, 6, 10]), t1 = c.pick(R, [0.5, 1, 1.5]), t2 = c.pick(R, [0.5, 1, 1.5]), tp = Tz - t1 - t2, z = 60 / Tz;
      return numQ('Ein Zylinder fährt in ' + f(t1, 1) + ' s aus und in ' + f(t2, 1) + ' s wieder ein. Dazwischen und danach gibt es insgesamt eine Pause von ' + f(tp, 1) + ' s, bevor der nächste Zyklus beginnt. Wie viele Zyklen schafft er in einer Minute?', z, 'Zyklen/min', 'Zyklen', 0.01,
        'Ein Zyklus dauert ' + f(t1, 1) + ' s + ' + f(t2, 1) + ' s + ' + f(tp, 1) + ' s = ' + f(Tz, 0) + ' s. In 60 s: 60 s / ' + f(Tz, 0) + ' s = ' + f(z, 0) + ' Zyklen.', ['Rechne zuerst die Zeit eines ganzen Zyklus.', 'Dann 60 s durch die Zyklusdauer.'],
        '1. Addiere Ausfahren, Einfahren und Pause zur Zyklusdauer. 2. Teile 60 s durch die Zyklusdauer.');
    },
    ablauf: R => {
      const c = C(), seqs = [['A+', 'B+', 'B-', 'A-'], ['A+', 'B+', 'A-', 'B-']], seq = c.pick(R, seqs), k = c.ri(R, 0, 2), sens = { 'A+': 'a1', 'A-': 'a0', 'B+': 'b1', 'B-': 'b0' }, right = sens[seq[k]];
      const nm = { a0: 'a0 (A eingefahren)', a1: 'a1 (A ausgefahren)', b0: 'b0 (B eingefahren)', b1: 'b1 (B ausgefahren)' };
      return choiceQ(R, 'Zwei Zylinder A und B arbeiten nacheinander im Ablauf ' + seq.join(' ') + '. Die Sensoren sind a0 und a1 (A hinten und vorn) sowie b0 und b1 (B hinten und vorn). Welche Meldung gibt den Schritt „' + seq[k + 1] + '“ frei?', nm[right], Object.keys(nm).filter(y => y !== right).map(y => nm[y]),
        'Der Schritt „' + seq[k + 1] + '“ darf erst starten, wenn „' + seq[k] + '“ beendet ist. Dann ist der Kolben in der Lage ' + nm[right] + '.', ['Welcher Schritt kommt direkt davor?', 'Welche Endlage hat dieser Schritt erreicht?'],
        '1. Suche den Schritt, der vor dem gefragten kommt. 2. Überlege, in welcher Endlage dieser Zylinder danach steht. 3. Wähle den Sensor dieser Endlage.');
    },
    spule: pq(SPSI, GO_LIES),
    /* ===== Sensorik an der Steuerung ===== */
    sensorwahl: pq(SENW, 'Lies, was erkannt werden soll: Metall, Kunststoff, Flüssigkeit, Magnet oder ein Objekt aus der Ferne. Ordne jedem Sensortyp seine Stärke zu und wähle den passenden.'),
    reduktion: R => {
      const c = C(), sn = c.pick(R, [5, 8, 10, 15]), m = c.pick(R, [['Aluminium', 0.4], ['Messing', 0.5], ['Edelstahl', 0.8]]), sr = rdv(sn * m[1]);
      return numQ('Ein induktiver Sensor hat einen Nennschaltabstand von ' + f(sn, 0) + ' mm. Für ' + m[0] + ' gilt in diesem Lab der Reduktionsfaktor ' + f(m[1], 1) + '. Wie groß ist der reduzierte Schaltabstand Sr?', sr, 'mm', 'Schaltabstand', 0.01,
        'Sr = Sn · Reduktionsfaktor = ' + f(sn, 0) + ' mm · ' + f(m[1], 1) + ' = ' + f(sr, 2) + ' mm. Bei Metallen mit schlechterer Wirkung schaltet der Sensor früher.', ['Sr = Sn mal Faktor.', 'Faktor kleiner 1 heißt kürzer.'],
        '1. Schreibe die Formel Sr = Sn · Faktor. 2. Setze die Werte ein. 3. Gib das Ergebnis in mm an.');
    },
    arbeitsabstand: R => {
      const c = C(), sr = c.pick(R, [3.2, 4, 5, 6, 7.5]), sa = rdv(sr * 0.8);
      return numQ('Ein induktiver Sensor schaltet bei einem reduzierten Schaltabstand Sr = ' + f(sr, 1) + ' mm. Für sicheren Betrieb soll er so montiert werden, dass das Teil im Betrieb höchstens 80 % von Sr entfernt ist. Wie groß ist dieser Arbeitsabstand?', sa, 'mm', 'Arbeitsabstand', 0.01,
        'Sa = 0,8 · Sr = 0,8 · ' + f(sr, 1) + ' mm = ' + f(sa, 2) + ' mm. So bleibt Reserve gegen Temperatur und Toleranzen.', ['80 % heißt mal 0,8.', 'Rechne mit dem reduzierten Abstand Sr.'],
        '1. Lies Sr. 2. Rechne 80 % davon (mal 0,8). 3. Gib das Ergebnis in mm an.');
    },
    hysterese: R => {
      const c = C(), sr = c.pick(R, [4, 5, 8, 10]), off = rdv(sr * 1.1);
      return numQ('Ein Sensor schaltet bei einem Abstand von höchstens ' + f(sr, 0) + ' mm ein. Die Hysterese beträgt in diesem Lab 10 % des Schaltabstands. Bei welchem Abstand schaltet er beim Entfernen des Teils wieder aus?', off, 'mm', 'Ausschaltabstand', 0.01,
        'Die Hysterese macht den Ausschaltpunkt größer als den Einschaltpunkt: ' + f(sr, 0) + ' mm · 1,1 = ' + f(off, 1) + ' mm. So flackert der Ausgang nicht um den Schaltpunkt.', ['10 % mehr als der Einschaltabstand.', 'Mal 1,1.'],
        '1. Lies den Einschaltabstand. 2. Rechne 10 % Hysterese dazu (mal 1,1). 3. Das ist der Ausschaltabstand.');
    },
    oeffner: pq(OPT, GO_LIES),
    eingaenge: R => {
      const c = C(), n = 5, list = []; for (let i = 0; i < n; i++) list.push({ typ: c.pick(R, ['pnp', 'npn']), fkt: c.pick(R, ['s', 'o']), aktiv: R() < 0.5 });
      const hi = list.map(s => c.sensorSim({ typ: s.typ, fkt: s.fkt, aktiv: s.aktiv, fehler: 'keiner' }).eingangLed), k = hi.filter(Boolean).length;
      const txt = list.map((s, i) => 'Sensor ' + (i + 1) + ': ' + s.typ.toUpperCase() + '-' + (s.fkt === 's' ? 'Schließer' : 'Öffner') + ', ' + (s.aktiv ? 'betätigt' : 'unbetätigt')).join('; ');
      return numQ('Fünf Sensoren hängen an Eingängen, die bei +24 V eine 1 erkennen: ' + txt + '. Wie viele Eingänge zeigen eine 1?', k, 'Eingänge', 'Anzahl', 0.01,
        'Ein Eingang zeigt nur bei einem PNP-Sensor eine 1, und zwar wenn dessen Ausgang eingeschaltet ist (Schließer betätigt oder Öffner unbetätigt). NPN-Sensoren ziehen auf 0 V und erzeugen hier nie eine 1. Das trifft auf die Sensoren ' + (hi.map((h, i) => h ? i + 1 : 0).filter(Boolean).join(', ') || 'keinen') + ' zu: ' + k + '.', ['Erst PNP oder NPN, dann Schließer oder Öffner, dann betätigt oder nicht.', 'NPN liefert hier nie eine 1.'],
        '1. Streiche alle NPN-Sensoren. 2. Frage bei jedem PNP: Ist sein Ausgang eingeschaltet? Schließer: wenn betätigt. Öffner: wenn unbetätigt. 3. Zähle.');
    },
    /* ===== Fehlersuche ===== */
    fehleringang: R => {
      const c = C(), k = c.pick(R, c.SEN_FEHLER), s = c.senBild(k.k), an = b => (b ? 'leuchtet' : 'leuchtet nicht');
      return choiceQ(R, 'Ein Sensor mit Schließerfunktion soll ein Teil melden. Das Teil liegt im Schaltabstand, doch der Eingang der Kleinsteuerung (er erkennt bei +24 V eine 1) bleibt aus. Du misst: Die Sensor-LED ' + an(s.led) + '. Braune Ader gegen 0 V: ' + f(s.braun, 0) + ' V. Schwarze Ader direkt am Sensor gegen 0 V: ' + f(s.schwarz, 0) + ' V. Die Eingangs-LED ' + an(s.eingangLed) + '. Was ist die Ursache?', k.n, c.SEN_FEHLER.filter(x => x.k !== k.k).map(x => x.n),
        k.k === 'braun' ? 'Braun ist 0 V und der Sensor hat keine Versorgung: Die braune Ader ist unterbrochen.' : k.k === 'blau' ? 'Braun hat 24 V, aber der Sensor schaltet nicht und die LED ist aus: Ihm fehlt die Rückleitung (blau).' : k.k === 'schwarz' ? 'Der Sensor schaltet (LED an, 24 V am Signal), aber am Eingang kommt nichts an: Die schwarze Ader ist unterbrochen.' : 'Der Sensor schaltet (LED an), aber sein Ausgang bleibt auf 0 V: Es ist ein NPN-Typ, der Eingang braucht aber PNP.', ['Ist der Sensor versorgt? Schaltet er?', 'Kommt das Signal am Eingang an?'],
        '1. Prüfe die Versorgung an braun und blau. 2. Schaltet der Sensor (LED)? 3. Liegt das Signal am Sensor an und kommt es am Eingang an? 4. Ordne den Befund dem Fehler zu.');
    },
    fehlerausgang: R => {
      const c = C(), k = c.pick(R, c.AUS_FEHLER), an = b => (b ? 'leuchtet' : 'leuchtet nicht');
      return choiceQ(R, 'Ein Ventil soll vom Ausgang Q1 geschaltet werden, zieht aber nicht an. Die LED von Q1 ' + an(k.led) + '. Du misst gegen 0 V: an der Klemme Q1 ' + f(k.q, 0) + ' V, am Plusanschluss der Spule ' + f(k.lp, 0) + ' V, am Minusanschluss der Spule ' + f(k.lm, 0) + ' V. Was ist die Ursache?', k.n, c.AUS_FEHLER.filter(x => x.k !== k.k).map(x => x.n),
        k.k === 'prog' ? 'LED aus und 0 V an der Klemme: Der Ausgang ist gar nicht eingeschaltet, der Fehler liegt im Programm.' : k.k === 'plus' ? 'Die Klemme hat 24 V, aber an der Spule kommt nichts an: Die Leitung dazwischen ist unterbrochen.' : k.k === 'null' ? 'Am Minusanschluss der Spule liegen fast 24 V: Die Verbindung zu 0 V ist unterbrochen, es kann kein Strom fließen.' : 'Spannung kommt an der Spule an, es fließt aber kein Strom: Die Spule ist offen.', ['Wo bricht die Spannung zusammen?', 'LED und Messwerte der Reihe nach vergleichen.'],
        '1. Schaut die Ausgangs-LED: Hat das Programm eingeschaltet? 2. Liegt Spannung an der Klemme? 3. Kommt sie an der Spule an (Plus gegen 0 V)? 4. Wie sieht der Minusanschluss aus? Ordne den Befund zu.');
    },
    drahtbruch: pq(DRB, GO_LIES),
    statusled: pq(LED, GO_LIES),
    leitung: R => {
      const c = C(), l = c.pick(R, LEIT), i = c.pick(R, [100, 150, 200, 250]), rl = l[2], du = rdv(i * rl / 1000), u = rdv(24 - du);
      return numQ('Ein Ventil nimmt ' + i + ' mA auf und ist über ' + f(l[0], 0) + ' m Kupferleitung mit ' + f(l[1], 2) + ' mm² Querschnitt angeschlossen. Für Hin- und Rückleitung zusammen gilt R = l / (28 · A) mit l in m und A in mm², R in Ω. Die Versorgung liefert 24 V. Welche Spannung kommt an der Spule an?', u, 'V', 'Spannung an der Spule', 0.01,
        'Leitungswiderstand: R = ' + f(l[0], 0) + ' / (28 · ' + f(l[1], 2) + ') = ' + f(rl, 0) + ' Ω. Spannungsabfall: ' + f(i / 1000, 3) + ' A · ' + f(rl, 0) + ' Ω = ' + f(du, 3) + ' V. An der Spule: 24 V − ' + f(du, 3) + ' V = ' + f(u, 3) + ' V.', ['Erst den Leitungswiderstand, dann U = R · I.', 'Den Abfall von 24 V abziehen.'],
        '1. Rechne den Leitungswiderstand mit der Formel. 2. Rechne den Spannungsabfall U = R · I (Strom in A). 3. Ziehe ihn von 24 V ab.');
    },
    messen: pq(MESS, GO_LIES)
  };
  function rdv(v) { return C().rd(v, 4); }

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator, Argument */
  const defs = [
    [0, 1, 'Klemmen am Schütz lesen', 'klemm'], [0, 1, 'Relais und Schütz', 'relais'], [0, 2, 'Tastenfolge an der Selbsthaltung', 'shfolge'], [0, 2, 'Beide Taster gleichzeitig', 'vorrang'],
    [0, 1, 'Wendeschaltung und Verriegelung', 'wende'], [0, 1, 'Selbsthaltung und Spannungsausfall', 'nullspg'], [0, 1, 'Strom der Schützspule', 'spulenstrom'], [0, 2, 'Leistung der Spule', 'spulenleistung'],
    [1, 1, 'Belegungsliste', 'belegung'], [1, 2, 'Gesamtstrom der Anlage', 'gesamtstrom'], [1, 2, 'Netzteil auswählen', 'netzteil'], [1, 1, 'Relais- oder Transistorausgang', 'ausgangtyp'],
    [1, 2, 'Reserve am Ausgang', 'reserve'], [1, 2, 'Sensor anschließen', 'sensoranschluss'], [1, 1, 'Adernfarben des Sensors', 'aderfarbe'], [1, 2, 'Pegel am Eingang', 'pegel'],
    [2, 1, 'Bausteine auswerten', 'gatter'], [2, 2, 'Wahrheitstabelle auszählen', 'wahrheit'], [2, 1, 'Begriffe im Funktionsplan', 'fupbegriff'], [2, 2, 'Einschaltverzögerung', 'ton'],
    [2, 2, 'Ausschaltverzögerung', 'tof'], [2, 3, 'Wischer', 'wischer'], [2, 1, 'Zähler', 'zaehler'], [2, 1, 'Passenden Zeitbaustein wählen', 'zeitwahl'],
    [3, 2, 'Magnetventile unterscheiden', 'ventil'], [3, 3, 'Kurze Bestromung', 'teilhub'], [3, 2, 'Spannungsausfall am Zylinder', 'ausfall'], [3, 1, 'Endlagen erfassen', 'endlage'],
    [3, 2, 'Takte pro Minute', 'zyklen'], [3, 3, 'Ablauf mit Rückmeldung', 'ablauf'], [3, 2, 'Ventilspule und Sicherheit', 'spule'],
    [4, 1, 'Sensor auswählen', 'sensorwahl'], [4, 2, 'Schaltabstand je Werkstoff', 'reduktion'], [4, 2, 'Arbeitsabstand', 'arbeitsabstand'], [4, 3, 'Ausschaltpunkt', 'hysterese'],
    [4, 2, 'Öffner und optische Sensoren', 'oeffner'], [4, 3, 'Eingänge bei gemischten Sensoren', 'eingaenge'],
    [5, 2, 'Fehler am Eingang', 'fehleringang'], [5, 3, 'Fehler am Ausgang', 'fehlerausgang'], [5, 2, 'Drahtbruch und Ruhestrom', 'drahtbruch'], [5, 1, 'Status-LED lesen', 'statusled'],
    [5, 3, 'Spannung an der Spule', 'leitung'], [5, 2, 'Messen und Prüfen', 'messen']
  ];
  let seq = 0;
  const tasks = defs.map(d => ({ id: 'ksp' + (++seq), cat: CATS[d[0]], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('ksp-' + t.id));
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.KSP_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { KLEMM, RS, WEN, NS, FUPB, ZB, VENT, ENDL, SPSI, SENW, OPT, DRB, LED, MESS } };
  root.KSP_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  /* Schnittstelle für Karriere/Lernpfad: gelöste Aufgaben stehen in localStorage 'lm4.ksp.done' = {id:true} */
  const LSP = 'lm4.ksp.', lsObj = k => { try { return JSON.parse(localStorage.getItem(LSP + k) || '{}') || {}; } catch (e) { return {}; } };
  root.KSP_LAB = { id: 'ksp', title: 'Kleinsteuerungs-Lab', doneKey: LSP + 'done', progKey: LSP + 'prog', total: tasks.length, done: () => Object.keys(lsObj('done')).filter(k => tasks.some(t => t.id === k)), tasks: root.KSP_TASKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.KSP_DATA, TASKS: root.KSP_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
