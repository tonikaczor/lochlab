'use strict';
/* Tonfunk Mikrocontroller-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools).
   ALLE Zahlen (Takt, Vorteiler, Ströme, Zeiten, Batterien) sind ÜBUNGSWERTE. Die Registernamen (TCCR0B, OCR0A, TIMSK0 ...) sind die eines üblichen 8-Bit-Controllers, ohne Herstellernamen.
   window.MIK_DATA  { cats, tasks, gens, make, makeTask, randomQ, pools }
   window.MIK_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'mik', Status in localStorage 'lm4.mik.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage hat q.vor (Liste "So gehst du vor"), manche q.code (kurzer Programmauszug).
   Titel bleiben neutral, ohne Zahlen und ohne Ergebnis. */
(function (root) {
  const C = () => root.MIK_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const MHz = hz => f(hz / 1e6, 3) + ' MHz';
  const CATS = ['Timer und Vorteiler', 'PWM und Mittelwert', 'AD-Wandler', 'Interrupts und ISR', 'millis und Zustandsautomat', 'Energiesparen'];

  const numQ = (text, value, unit, label, tol, expl, tips, vor) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, vor });
  function choiceQ(R, text, right, wrong, expl, tips, vor, code) {
    const ch = C().shuffle(R, [right].concat(wrong));
    const q = { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, vor };
    if (code) q.code = code; return q;
  }
  /* Pool-Eintrag: [Text, richtig, falsch[], Erklärung, Tipps, Programmauszug (optional)] */
  const pq = (POOL, VOR) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], VOR, q[5]); };
  const withCode = (q, code) => { q.code = code; return q; };

  /* ---------- Fehlersuche: Fragen-Pools ---------- */
  const VOR_BUG = ['Lies den Programmauszug von oben nach unten.', 'Stelle dir bei jeder Zeile vor, was der Controller damit tut.', 'Suche die Stelle, die zum beschriebenen Fehlverhalten passt, und wähle die Ursache.'];
  const TIMERBUG = [
    ['Der 8-Bit-Timer soll alle 300 Zählschritte einen Treffer melden. Das Ergebnis stimmt nicht. Was ist der Fehler?', 'OCR0A kann nur Werte von 0 bis 255 aufnehmen, 300 passt nicht in 8 Bit und wird abgeschnitten', ['Der Vorteiler 8 gibt es nicht', 'WGM01 schaltet den Timer aus', 'Zwischen den Zeilen fehlt ein delay()'], 'Ein 8-Bit-Register fasst 0 bis 255. Die Zahl 300 wird abgeschnitten (300 − 256 = 44), der Timer meldet viel zu früh. Für längere Zeiten braucht es einen größeren Vorteiler oder einen 16-Bit-Timer.', ['Wie groß ist der größte Wert, den 8 Bit darstellen?', 'Was passiert mit einer Zahl, die nicht ins Register passt?'], 'TCCR0A = (1 << WGM01);   // CTC-Modus\nOCR0A  = 300;\nTCCR0B = (1 << CS01);    // Vorteiler 8'],
    ['Takt 16 MHz, Vorteiler 64, OCR0A = 249. Die ISR soll genau alle 1,000 ms laufen, sie läuft aber alle 1,024 ms. Was fehlt?', 'Der CTC-Modus ist nicht eingeschaltet: Der Zähler läuft immer bis 255 durch, statt bei 249 auf 0 zurückzukehren', ['Das Freigabe-Bit OCIE0A ist nicht gesetzt', 'Der Takt ist in Wirklichkeit 15,6 MHz', 'sei() fehlt'], 'Mit CTC dauert die Periode (249 + 1) · 4 µs = 1,000 ms. Ohne CTC zählt der Zähler bis 255 und braucht 256 · 4 µs = 1,024 ms. Fehlen OCIE0A oder sei(), käme gar keine ISR.', ['Wie viele Zählschritte dauert eine Periode im Normalmodus?', 'Rechne 250 und 256 Schritte mit 4 µs je Schritt.'], 'OCR0A  = 249;\nTCCR0B = (1 << CS01) | (1 << CS00);   // Vorteiler 64\nTIMSK0 = (1 << OCIE0A);\nsei();'],
    ['Die ISR(TIMER0_COMPA_vect) wird nie aufgerufen, obwohl der Timer läuft. Was fehlt?', 'sei(): Die Interrupts sind global nicht freigegeben', ['OCR0A muss größer als 255 sein', 'Der Vorteiler muss 1 sein', 'Die ISR darf nicht in setup() stehen'], 'Neben dem Freigabe-Bit des Timers (OCIE0A) muss das globale Freigabe-Bit mit sei() gesetzt sein. Beides zusammen löst den Sprung in die ISR aus.', ['Es gibt zwei Schalter: einen am Timer und einen für alle Interrupts.', 'Welcher davon fehlt im Auszug?'], 'TCCR0A = (1 << WGM01);\nOCR0A  = 249;\nTCCR0B = (1 << CS01) | (1 << CS00);\nTIMSK0 = (1 << OCIE0A);'],
    ['Die ISR wird nie aufgerufen, obwohl sei() steht und der Timer läuft. Was fehlt?', 'Das Freigabe-Bit OCIE0A im Register TIMSK0 ist nicht gesetzt', ['Die ISR hat den falschen Rückgabetyp', 'Der Vorteiler 64 ist für CTC nicht erlaubt', 'sei() muss ganz am Ende des Programms stehen'], 'Der Treffer setzt nur das Flag. Ohne Freigabe-Bit (OCIE0A) im Register TIMSK0 wird daraus kein Interrupt.', ['Das Flag zeigt das Ereignis, das Freigabe-Bit entscheidet über den Sprung.', 'Welches Register enthält die Freigabe-Bits der Timer?'], 'sei();\nTCCR0A = (1 << WGM01);\nOCR0A  = 249;\nTCCR0B = (1 << CS01) | (1 << CS00);'],
    ['Der Treffer des Vergleichswerts soll die ISR starten, die Zählung stimmt, aber die ISR läuft nie. Was ist falsch?', 'Es steht der Überlauf-Vektor TIMER0_OVF_vect, der Treffer löst aber TIMER0_COMPA_vect aus', ['Der Name ISR darf nur einmal im Programm vorkommen', 'In einer ISR darf kein Zähler stehen', 'OCR0A muss kleiner als der Vorteiler sein'], 'Jedes Ereignis hat seinen eigenen Vektor. Der Vergleichstreffer läuft über COMPA, der Überlauf über OVF. Steht der falsche Name, wird die richtige Stelle nie angesprungen.', ['Welches Ereignis soll die ISR starten: Treffer oder Überlauf?', 'Vergleiche den Vektornamen mit dem Ereignis.'], 'TIMSK0 = (1 << OCIE0A);\nsei();\n\nISR(TIMER0_OVF_vect) {\n  zaehler++;\n}'],
    ['Der Timer soll laufen, der Zählerstand TCNT0 bleibt aber immer 0. Was fehlt?', 'TCCR0B wurde nie gesetzt: Ohne Taktquelle (Vorteiler) zählt der Timer nicht', ['OCR0A ist zu klein', 'sei() fehlt', 'Das Register TCNT0 darf nicht gelesen werden'], 'Erst die Bits CS02 bis CS00 verbinden den Timer mit dem Takt. Sind alle drei Bits 0, steht der Timer.', ['Was liefert dem Zähler seinen Takt?', 'Welches Register wählt die Taktquelle?'], 'TCCR0A = (1 << WGM01);\nOCR0A  = 249;\nTIMSK0 = (1 << OCIE0A);\nsei();']
  ];
  const PWMBUG = [
    ['Am PWM-Pin kommt nichts heraus, obwohl der Timer läuft und OCR2A = 128 ist. Was fehlt?', 'Der Pin ist nicht als Ausgang geschaltet (Datenrichtungs-Bit)', ['OCR2A muss 255 sein', 'WGM20 darf nicht gesetzt sein', 'Der Vorteiler muss 1 sein'], 'Auch bei PWM muss der Pin ein Ausgang sein. Ohne gesetztes Datenrichtungs-Bit bleibt er ein Eingang, der Timer kann ihn nicht treiben.', ['Wer treibt den Pin, wenn er als Eingang geschaltet ist?', 'Suche eine Zeile, die den Pin als Ausgang festlegt.'], 'TCCR2A = (1 << COM2A1) | (1 << WGM21) | (1 << WGM20);\nTCCR2B = (1 << CS21);\nOCR2A  = 128;'],
    ['Der Pin bleibt dauerhaft Low, obwohl er Ausgang ist und OCR2A = 128 gilt. Was fehlt?', 'Die COM-Bits (COM2A1) sind nicht gesetzt: Der Ausgang ist nicht mit dem Timer verbunden', ['DDRB muss auf 0 stehen', 'OCR2A darf nicht größer als 100 sein', 'Der Vorteiler muss 1024 sein'], 'Die Bits COM2A1 und COM2A0 verbinden den Pin mit dem Vergleichsausgang des Timers. Ohne sie bleibt der Pin ein gewöhnlicher Ausgang und steht auf Low.', ['Wie kommt das Signal vom Timer zum Pin?', 'Welche Bits legen das Verhalten des Pins bei einem Treffer fest?'], 'DDRB  |= (1 << PB3);          // Pin ist Ausgang\nTCCR2A = (1 << WGM21) | (1 << WGM20);\nTCCR2B = (1 << CS21);\nOCR2A  = 128;'],
    ['Die LED soll mit OCR2A = 51 nur 20 % hell sein, sie leuchtet aber sehr hell. Warum?', 'Beide COM-Bits sind gesetzt: Der Ausgang ist invertiert und bei OCR2A = 51 etwa 80 % der Zeit High', ['51 ist kleiner als 128, deshalb schaltet PWM ab', 'Fast-PWM kennt nur Werte über 100', 'Der Vorteiler fehlt, deshalb flackert die LED'], 'COM2A1 und COM2A0 zusammen bedeuten invertierende PWM: Der Pin ist High, solange der Zähler unter dem Vergleichswert liegt, nicht darüber. Aus 20 % werden 80 %.', ['Was bewirkt es, wenn beide COM-Bits gesetzt sind?', '255 minus 51 ist wie viel Prozent von 255?'], 'TCCR2A = (1 << COM2A1) | (1 << COM2A0) | (1 << WGM21) | (1 << WGM20);\nOCR2A  = 51;   // gewollt: 20 % hell'],
    ['Die LED flackert sichtbar. Was ist die Ursache?', 'Mit Vorteiler 1024 liegt die PWM-Frequenz nur bei etwa 61 Hz, das Auge sieht das Flackern', ['Der Tastgrad ist zu klein', 'Ein 8-Bit-Register kann keine LED dimmen', 'Der Takt von 16 MHz ist zu hoch'], 'PWM-Frequenz = 16 MHz / (1024 · 256) = 61 Hz. Unter etwa 100 Hz erkennt das Auge das Flackern. Ein kleinerer Vorteiler hebt die Frequenz.', ['Rechne die PWM-Frequenz aus Takt, Vorteiler und 256 Schritten.', 'Ab welcher Frequenz sieht man kein Flackern mehr?'], 'TCCR2A = (1 << COM2A1) | (1 << WGM21) | (1 << WGM20);\nTCCR2B = (1 << CS22) | (1 << CS21) | (1 << CS20);   // Vorteiler 1024\nOCR2A  = 128;']
  ];
  const ADCBUG = [
    ['Die Prozentanzeige springt nur zwischen 0 und 100. Was ist der Fehler?', 'roh / 1023 ist eine ganzzahlige Division und ergibt fast immer 0: Erst multiplizieren, dabei long verwenden, dann teilen', ['analogRead liefert nur 0 oder 1023', 'analogRead darf nicht in loop() stehen', 'Das Ergebnis muss in einem String stehen'], 'Bei ganzen Zahlen wird abgeschnitten: 500 / 1023 ergibt 0. Besser (long)roh * 100 / 1023. Das long ist nötig, weil roh * 100 bei 16-Bit-int über 32767 hinausgeht.', ['Was ergibt 500 geteilt durch 1023 bei ganzen Zahlen?', 'Ändere die Reihenfolge: erst malnehmen.'], 'int roh = analogRead(A0);      // 0 bis 1023\nint prozent = roh / 1023 * 100;'],
    ['Die Spannung wird ab einem Rohwert von etwa 7 völlig falsch angezeigt. Was ist der Fehler?', 'Das Produkt roh * 5000 passt nicht in ein 16-Bit-int (höchstens 32767) und läuft über: long verwenden', ['Die Zahl 5000 darf in keinem Programm stehen', 'analogRead liefert bereits Millivolt', 'Die Division durch 1023 ist nicht erlaubt'], '7 · 5000 = 35000 ist größer als 32767. Ein 16-Bit-int läuft dann über und wird negativ. Mit (long)roh * 5000 / 1023 stimmt es.', ['Wie groß ist der größte Wert eines 16-Bit-int?', 'Rechne 7 mal 5000.'], 'int roh = analogRead(A0);\nint mv  = roh * 5000 / 1023;'],
    ['Das Multimeter zeigt 0,8 V, die Rechnung ergibt aber etwa 3,6 V. Warum?', 'Die Umrechnung nimmt 5 V als Referenz an, der Wandler nutzt aber die interne Referenz von 1,1 V', ['analogRead misst nur bis 3,3 V', 'Die Variable u muss ein int sein', 'Der Eingang A0 ist defekt'], 'Bei 1,1 V Referenz ergeben 0,8 V den Rohwert 745. Mit 5 V gerechnet: 745 · 5 / 1023 = 3,64 V. Referenz und Umrechnung müssen zusammenpassen.', ['Welche Referenz hat der Wandler eingestellt?', 'Mit welcher Referenz rechnet die Zeile darunter?'], 'analogReference(INTERNAL);          // Referenz 1,1 V\nint roh = analogRead(A0);\nfloat u = roh * 5.0 / 1023;'],
    ['Der Messwert springt bei hohen Spannungen plötzlich auf kleine Zahlen zurück. Warum?', 'Ein byte fasst nur 0 bis 255: der 10-Bit-Messwert wird abgeschnitten, es braucht ein int', ['analogRead liefert bei hohen Spannungen negative Zahlen', 'Der Wandler arbeitet nur bis 2,5 V', 'Die Referenz fehlt'], 'Ein 10-Bit-Wert geht bis 1023. Im byte bleibt nur der Rest nach 256 übrig, aus 300 wird 44.', ['Wie viele Werte hat ein byte?', 'Wie groß kann ein 10-Bit-Wert werden?'], 'byte roh = analogRead(A0);\nSerial.println(roh);']
  ];
  const VOLQ = [
    ['Warum bekommt eine Variable, die in der ISR geändert und in loop() gelesen wird, das Schlüsselwort volatile?', 'Der Compiler darf den Wert nicht in einem Register zwischenspeichern, sondern muss ihn bei jedem Zugriff neu aus dem Speicher lesen', ['Damit die Variable schneller wird', 'Damit die Variable im Flash gespeichert wird', 'Damit die Variable automatisch vor Unterbrechungen geschützt ist'], 'Der Compiler sieht in loop() nicht, dass eine ISR die Variable ändert, und darf den Wert im Register lassen. volatile verbietet das. Atomar (unteilbar) macht volatile den Zugriff nicht.', ['Wer kann die Variable noch ändern, ohne dass loop() es merkt?', 'volatile heißt: flüchtig, bitte immer neu lesen.']],
    ['Warum soll eine ISR möglichst kurz sein?', 'Das Hauptprogramm steht, und weitere Interrupts warten (bei den üblichen 8-Bit-Controllern sind sie gesperrt): Ereignisse können verloren gehen', ['Lange ISR beschädigen den Flash-Speicher', 'Der Compiler verbietet Schleifen in einer ISR', 'Die ISR verbraucht sonst den Arbeitsspeicher'], 'Solange die ISR läuft, wird das Hauptprogramm angehalten. Neue Ereignisse müssen warten oder gehen verloren. Deshalb nur das Nötigste: Wert merken, Flag setzen, fertig.', ['Was macht das Hauptprogramm, solange die ISR läuft?', 'Was passiert mit einem zweiten Ereignis in dieser Zeit?']],
    ['Was ist der Unterschied zwischen Interrupt-Flag und Freigabe-Bit?', 'Das Flag zeigt, dass das Ereignis eingetreten ist; das Freigabe-Bit entscheidet, ob daraus ein Sprung in die ISR wird', ['Beide sind dasselbe Bit unter zwei Namen', 'Das Flag startet den Timer, das Freigabe-Bit stoppt ihn', 'Das Freigabe-Bit zeigt das Ereignis, das Flag erlaubt die ISR'], 'Zwei getrennte Dinge: Ereignis gemerkt (Flag) und Ereignis darf unterbrechen (Freigabe-Bit, dazu global sei()). Ohne Freigabe bleibt das Flag gesetzt, die ISR läuft nicht.', ['Eines meldet, das andere erlaubt.', 'Wofür sind die zwei Schalter nötig?']],
    ['Warum muss man beim Lesen einer 16-Bit-Variable, die eine ISR ändert, kurz Interrupts sperren?', 'Ein 8-Bit-Controller liest die Variable in zwei Schritten; greift die ISR dazwischen ein, passen oberes und unteres Byte nicht zusammen', ['Weil 16-Bit-Variablen langsamer sind', 'Weil sonst der Speicher voll läuft', 'Weil volatile Variablen sonst gelöscht werden'], 'Beispiel: 255 wird zu 256. Liest du das obere Byte (0) vor und das untere (0) nach dem Zählen, erhältst du 0 statt 255 oder 256. Kurz sperren macht den Zugriff unteilbar (atomar).', ['Wie viele Bytes hat die Variable, wie viele kann der Controller auf einmal lesen?', 'Was kann zwischen den zwei Lesevorgängen passieren?']]
  ];
  const ISRBUG = [
    ['Was ist an dieser ISR falsch?', 'delay() blockiert die ISR lange, und weil weitere Interrupts gesperrt sind, bleibt auch die Zeitzählung hängen', ['delay() gibt es nur in loop()', 'Der Zähler darf nicht in der ISR erhöht werden', 'Der Interrupt-Vektor INT0_vect existiert nicht'], 'In der ISR läuft keine Zeit weiter wie im Hauptprogramm. Entprellen gehört in den Vergleich von Zeitstempeln (millis()), nicht in ein Warten.', ['Wie lange steht das Hauptprogramm bei delay(50)?', 'Wie kann man Entprellen ohne zu warten lösen?'], 'ISR(INT0_vect) {\n  delay(50);        // entprellen\n  zaehler++;\n}'],
    ['Was ist an dieser ISR ungünstig?', 'Serial.print ist langsam und kann warten: In der ISR nur ein Flag setzen und die Ausgabe in loop() machen', ['Serial.print gibt nur Zahlen aus', 'Die Variable messwert ist zu groß', 'ISR dürfen keine Variablen lesen'], 'Ausgaben über die serielle Schnittstelle dauern lange. In der ISR gilt: so kurz wie möglich, nur Werte merken oder Flag setzen.', ['Wie lang dauert das Senden eines Textes im Vergleich zu einer Zuweisung?', 'Wohin gehört die Ausgabe stattdessen?'], 'ISR(TIMER1_COMPA_vect) {\n  Serial.print("Messwert: ");\n  Serial.println(messwert);\n}'],
    ['Der Tastendruck wird bei eingeschalteter Optimierung manchmal nie bemerkt. Was ist die Ursache?', 'gedrueckt ist nicht volatile: Der Compiler darf den Wert in loop() im Register behalten', ['Eine bool-Variable kann nicht in einer ISR gesetzt werden', 'Die ISR muss einen Rückgabewert haben', 'Die Zeile gedrueckt = false; ist verboten'], 'Ohne volatile liest loop() einen alten Wert aus dem Register. Mit volatile bool gedrueckt wird der Speicher bei jedem Zugriff neu gelesen.', ['Weiß der Compiler in loop(), dass eine ISR die Variable ändert?', 'Welches Schlüsselwort erzwingt das erneute Lesen?'], 'bool gedrueckt = false;\n\nISR(INT0_vect) { gedrueckt = true; }\n\nvoid loop() {\n  if (gedrueckt) { gedrueckt = false; /* ... */ }\n}'],
    ['Das Hauptprogramm hängt, die Anzeige bleibt manchmal stehen. Was ist der Fehler?', 'Die ISR rechnet viel zu lange: Nur den Messwert holen und ein Flag setzen, das Rechnen gehört in loop()', ['Der Timer läuft zu schnell für den Vorteiler', 'Das Feld messwert[] ist zu klein', 'sqrt() darf nicht in C-Programmen stehen'], 'Zweihundert Wurzeln je Aufruf dauern lang. In dieser Zeit steht das Hauptprogramm. Rechnen im Hauptprogramm, die ISR liefert nur den Wert.', ['Wie oft läuft die Schleife bei jedem Timer-Treffer?', 'Was gehört in eine ISR, was in loop()?'], 'ISR(TIMER1_COMPA_vect) {\n  for (int i = 0; i < 200; i++)\n    summe += sqrt(messwert[i]);\n}']
  ];
  const FSMBUG = [
    ['Die Ampel springt nach GRUEN sofort wieder weiter, GELB dauert nur einen Augenblick. Warum?', 'Beim Wechsel zu GELB wird tLast nicht neu gesetzt: Die Zeit seit dem Beginn von GRUEN ist schon größer als 2000 ms', ['Der Wert 2000 ist für millis() zu groß', 'case GELB darf nicht nach case GRUEN stehen', 'break fehlt nach case GELB'], 'Bei jedem Zustandswechsel muss tLast = millis() gesetzt werden. Sonst misst die Bedingung die Zeit seit dem letzten gesetzten tLast und ist sofort erfüllt.', ['Seit wann misst millis() - tLast?', 'Welche Zeile fehlt beim Wechsel von GRUEN zu GELB?'], 'case GRUEN:\n  if (millis() - tLast >= 5000) {\n    zustand = GELB;\n  }\n  break;\ncase GELB:\n  if (millis() - tLast >= 2000) {\n    zustand = ROT;\n    tLast = millis();\n  }\n  break;'],
    ['Die Ampel bleibt immer in ROT. Was ist die Ursache?', 'In der Bedingung steht = (Zuweisung) statt == (Vergleich): zustand wird bei jedem Durchlauf auf ROT gesetzt', ['ROT ist kein gültiger Name für einen Zustand', 'Eine if-Bedingung darf keine Variable enthalten', 'Der Vergleich muss mit != geschrieben werden'], 'zustand = ROT weist zu und ist danach immer wahr. Der Vergleich heißt zustand == ROT.', ['Wie viele Gleichheitszeichen braucht ein Vergleich?', 'Was passiert mit zustand in dieser Zeile?'], 'if (zustand = ROT) {\n  if (millis() - tLast >= 4000) {\n    zustand = ROTGELB;\n    tLast = millis();\n  }\n}'],
    ['Die Taste für Fußgänger reagiert nur während GRUEN und ROT, nie während GELB. Warum?', 'delay(2000) blockiert das Programm: Die Tastenabfrage in loop() läuft währenddessen nicht', ['Während GELB sind alle Eingänge gesperrt', 'Die Taste hat in GELB keinen Pull-up', 'case GELB darf keine Anweisung enthalten'], 'delay() hält das ganze Programm an, auch die Abfragen. Mit millis() und tLast läuft loop() weiter.', ['Was passiert in loop() während delay(2000)?', 'Wie ersetzt man delay() mit millis()?'], 'case GELB:\n  delay(2000);\n  zustand = ROT;\n  break;'],
    ['Nach ROT leuchten sofort auch die Lampen von ROTGELB, die Zeit für ROT wird ausgelassen. Was fehlt?', 'Das break nach case ROT: Das Programm läuft in den nächsten case weiter', ['Ein semikolon hinter case ROT', 'Die Variable zustand muss ein String sein', 'Der Zustand ROTGELB muss vor ROT stehen'], 'Ohne break führt switch die Anweisungen des nächsten case mit aus (Durchfallen). Jeder case endet mit break.', ['Was macht switch, wenn kein break kommt?', 'Welche Zeile fehlt am Ende von case ROT?'], 'case ROT:\n  setzeLampen(1, 0, 0);\n  if (millis() - tLast >= 4000) {\n    zustand = ROTGELB;\n    tLast = millis();\n  }\ncase ROTGELB:\n  setzeLampen(1, 1, 0);\n  break;'],
    ['Nach etwa 33 Sekunden verhält sich die Ampel falsch. Was ist die Ursache?', 'int ist auf einem 8-Bit-Controller 16 Bit groß (höchstens 32767): tLast läuft über, unsigned long ist nötig', ['millis() gibt nach 33 Sekunden Null zurück', 'Der Vergleich >= ist nach 33 Sekunden nicht erlaubt', 'Die Zeit wird ab da in Sekunden statt in Millisekunden gezählt'], 'millis() liefert unsigned long (32 Bit). Wird das Ergebnis in einem int gespeichert, wird es bei 32767 ms (rund 33 s) falsch.', ['Wann ist 32767 Millisekunden erreicht?', 'Welchen Typ liefert millis()?'], 'int tLast = 0;\n\nif (millis() - tLast >= 5000) {\n  zustand = GELB;\n  tLast = millis();\n}']
  ];
  const SLPQ = [
    ['Ein Funksensor misst alle 10 Minuten und soll mit einer kleinen Batterie Jahre laufen. Zwischen den Messungen muss nichts außer einem Wecker laufen. Welcher Schlafmodus passt?', 'Power-down mit Watchdog-Timer als Weckquelle', ['Idle: CPU steht, alle anderen Teile laufen weiter', 'Kein Schlafmodus, stattdessen delay(600000)', 'Nur den Takt erhöhen, damit der Controller schneller fertig ist'], 'Power-down schaltet fast alles ab und braucht nur Mikroampere. Der Watchdog-Timer kann trotzdem wecken. Idle spart viel weniger, delay() spart nichts.', ['Wie viel läuft im Power-down noch?', 'Wer weckt den Controller, wenn Timer und Takt aus sind?']],
    ['Der Controller soll nur schlafen, bis ein Taster gedrückt wird. Sonst muss nichts laufen. Welcher Modus ist am sparsamsten?', 'Power-down, Weckquelle ist ein Pin-Interrupt', ['Idle, weil der Timer weiterlaufen muss', 'Dauerbetrieb mit Abfragen in loop()', 'Kein Schlaf, aber mit niedrigerem Takt'], 'Der Pin-Interrupt kann auch im tiefsten Schlafmodus wecken. Deshalb ist Power-down mit Pin-Interrupt die sparsamste Wahl.', ['Welche Weckquellen funktionieren im Power-down?', 'Wann ist ein Wecken durch Tasterpin möglich?']],
    ['millis() soll auch im Schlaf weiterzählen, und alle 4 ms soll ein Timer-Interrupt kommen. Welcher Modus ist geeignet?', 'Idle: Die CPU steht, die Timer laufen weiter', ['Power-down: Alle Timer stehen', 'Power-down mit Pin-Interrupt', 'Kein Modus ist geeignet'], 'Im Idle-Modus bleibt die Peripherie, auch die Timer, in Betrieb. Im Power-down stehen die Timer still, millis() zählt dort nicht.', ['Welcher Modus lässt Timer weiterlaufen?', 'Was bedeutet Idle: nur die CPU steht?']],
    ['Warum spart ein Schlafmodus im Mittel viel Strom, wenn der Controller nur kurz aktiv sein muss?', 'Die meiste Zeit fließt nur der kleine Schlafstrom, der Mittelwert liegt nahe am Schlafstrom', ['Weil im Schlaf der Takt erhöht wird', 'Weil die Betriebsspannung im Schlaf höher ist', 'Weil der Schlafmodus den Aktivstrom senkt'], 'Der Mittelwert ist die Summe der Ladungen geteilt durch die Zeit. Ist die Aktivzeit sehr kurz, bestimmt der Schlafstrom fast alles.', ['Wie lange ist der Controller aktiv, wie lange schläft er?', 'Wovon hängt der Mittelwert ab?']]
  ];
  const SLPBUG = [
    ['Nach sleep_cpu() passiert nie wieder etwas. Was fehlt?', 'Es ist keine Weckquelle freigegeben (zum Beispiel Pin-Interrupt oder Watchdog)', ['Die Funktion set_sleep_mode() darf nicht aufgerufen werden', 'Es fehlt ein delay() vor sleep_cpu()', 'Power-down kann nur mit einem Neustart verlassen werden'], 'Im Power-down läuft kein Takt. Wecken kann nur ein Ereignis, das dafür freigegeben wurde. Ohne Weckquelle schläft der Controller für immer.', ['Wer soll den Controller aufwecken?', 'Was muss dafür freigegeben sein?'], 'set_sleep_mode(SLEEP_MODE_PWR_DOWN);\nsleep_enable();\nsleep_cpu();'],
    ['Nach dem Aufwachen aus dem Power-down ist millis() kaum weitergelaufen. Warum?', 'Im Power-down stehen alle Timer still, deshalb zählt millis() im Schlaf nicht', ['millis() wird beim Aufwachen immer auf 0 zurückgesetzt', 'millis() läuft nur, wenn eine LED an ist', 'Im Power-down läuft die Zeit zehnmal langsamer'], 'millis() hängt von einem Timer. Steht der Timer, bleibt die Zeit stehen. Wer Zeit im Schlaf braucht, nimmt den Watchdog oder einen anderen Zeitgeber.', ['Wovon wird millis() getaktet?', 'Was läuft im Power-down noch?'], 'unsigned long vor = millis();\nsleep_cpu();                 // Schlaf, Weckquelle Watchdog nach 8 s\nunsigned long dauer = millis() - vor;'],
    ['Im Schlaf bleibt der Strom hoch, obwohl der Controller nur wenige Mikroampere braucht. Was ist die Ursache?', 'Die LED bleibt vor dem Schlaf eingeschaltet und zieht weiter Strom, den der Schlafmodus nicht sparen kann', ['Power-down braucht grundsätzlich 10 Milliampere', 'sleep_cpu() schaltet den Takt auf 16 MHz', 'Der Schlafmodus gilt nur für die Zeit nach dem Aufwachen'], 'Der Schlafmodus spart nur den Strom des Controllers. Was an den Pins hängt (LED, Sensor, Pull-up), muss vorher abgeschaltet werden.', ['Wer zieht außer dem Controller noch Strom?', 'Welche Zeile gehört vor den Schlaf?'], 'digitalWrite(LED, HIGH);      // LED an\nsleep_cpu();'],
    ['Selten bleibt das Gerät schlafen, obwohl das Ereignis schon da war. Warum?', 'Die ISR kann zwischen der Abfrage von flag und sleep_cpu() laufen: Das Ereignis ist dann verbraucht, der Schlaf wird nie beendet', ['Die Abfrage if (!flag) darf in keinem Programm stehen', 'sleep_cpu() prüft das Flag selbst und wartet daher', 'Das Flag wird im Schlaf gelöscht'], 'Zwischen Abfrage und Schlafbefehl liegt ein kleines Zeitfenster. Kommt das Ereignis genau dort, schläft der Controller trotzdem ein. Abhilfe: Interrupts sperren, Flag prüfen, mit sei() direkt vor dem Schlafbefehl freigeben.', ['Was passiert, wenn die ISR genau nach der Abfrage läuft?', 'Wie lässt sich dieses Zeitfenster schließen?'], 'if (!flag) {\n  sleep_cpu();      // Ereignis genau davor?\n}']
  ];

  /* ---------- Gemeinsame "So gehst du vor"-Listen ---------- */
  const VOR = {
    tick: ['Lies Takt und Vorteiler aus der Aufgabe ab.', 'Teile den Vorteiler durch den Takt (Hz): Dauer eines Zählschritts in Sekunden.', 'Rechne in µs um und gib das Ergebnis an.'],
    ovf: ['Bestimme die Zahl der Zählstufen: 2 hoch Bitbreite.', 'Zählschritt = Vorteiler / Takt.', 'Überlaufzeit = Stufen · Zählschritt, in ms angeben.'],
    ocr: ['Rechne die gewünschte Frequenz in eine Periode um (1 / Frequenz).', 'Teile die Periode durch die Zeit eines Zählschritts: Das ist die Zahl der Schritte.', 'Ziehe 1 ab (der Zähler beginnt bei 0): Das ist OCR. Prüfe, dass es höchstens 255 ist.'],
    ocrT: ['Zeit eines Zählschritts ausrechnen (Vorteiler / Takt).', 'Zielzeit durch Zählschritt teilen: Zahl der Schritte.', 'Eins abziehen, weil der Zähler bei 0 beginnt: OCR.'],
    pre: ['Rechne für jeden Vorteiler OCR + 1 = Takt / (Vorteiler · Frequenz).', 'Der Wert OCR muss höchstens 255 sein.', 'Wähle den kleinsten Vorteiler, bei dem das gilt (feinste Auflösung).'],
    csbits: ['Lies in der Zeile ab, welche Bits gesetzt sind.', 'Schreibe die Bits als Dreier-Zahl (CS02 CS01 CS00).', 'Suche die Zahl in der Tabelle und lies den Vorteiler ab.'],
    toggle: ['Treffer je Sekunde = Takt / (Vorteiler · (OCR + 1)).', 'Der Pin kippt bei jedem Treffer, eine volle Periode braucht zwei Treffer: halbieren.', 'Ergebnis in Hz angeben.'],
    ferr: ['Rechne OCR als Kommazahl: Takt / (Vorteiler · Zielfrequenz) − 1.', 'Runde auf die nächste ganze Zahl: Das ist das tatsächliche OCR.', 'Rechne damit die tatsächliche Frequenz aus und bilde Abweichung / Zielfrequenz in %.'],
    duty: ['Der 8-Bit-Zähler läuft bis 255.', 'Tastgrad = OCR / 255.', 'In Prozent angeben.'],
    mean: ['Tastgrad als Anteil (Prozent durch 100).', 'Mittelwert = Tastgrad · Versorgungsspannung.', 'Ergebnis in V angeben.'],
    ocru: ['Tastgrad = gewünschte Spannung / Versorgungsspannung.', 'OCR = Tastgrad · 255.', 'Auf eine ganze Zahl runden (ist hier exakt).'],
    pwmf: ['Eine PWM-Periode hat 256 Zählschritte (8 Bit).', 'Periode = 256 · Vorteiler / Takt, Frequenz = Kehrwert.', 'Oder gleich: Takt / (Vorteiler · 256).'],
    scope: ['Tastgrad = High-Zeit / Periode.', 'Mittelwert = Tastgrad · Versorgungsspannung.', 'Ergebnis in V angeben.'],
    mosfet: ['Der Mittelwert hängt von der Spannung ab, die der Schalter durchlässt (Lastversorgung, nicht Logik-Spannung).', 'Tastgrad = Zielspannung / Lastversorgung.', 'OCR = Tastgrad · 255.'],
    steps: ['Jedes Bit verdoppelt die Zahl der Werte.', 'Stufen = 2 hoch Bitbreite.', 'Ergebnis angeben.'],
    lsb: ['Stufen = 2 hoch Bitbreite.', 'Ein Digit = Referenzspannung / Stufen.', 'In mV umrechnen.'],
    raw2u: ['Stufen = 2 hoch Bitbreite (hier 1024).', 'Spannung = Rohwert · Referenz / Stufen.', 'In V angeben.'],
    u2raw: ['Bestimme die Stufen (2 hoch Bitbreite).', 'Rohwert = Spannung / Referenz · Stufen.', 'Hier ergibt sich eine ganze Zahl.'],
    refsel: ['Der Messbereich reicht bis zur größten Spannung der Aufgabe.', 'Die Referenz muss mindestens so groß sein.', 'Nimm die kleinste, die noch reicht (feinste Auflösung).'],
    perdig: ['Messspanne durch Stufen teilen (2 hoch Bitbreite).', 'Das ist der Wert, um den sich die Messgröße je Digit ändert.', 'In mK je Digit umrechnen (mal 1000).'],
    divider: ['Verhältnis Eingangsspannung zu Spannung am Teilerpunkt bilden.', 'R1 = R2 · (Ue / Ua − 1).', 'Ergebnis in kΩ.'],
    deb: ['Beginne bei tLast = 0.', 'Für jede Flanke: Abstand zur zuletzt gezählten Flanke bilden.', 'Nur wenn der Abstand größer als 50 ms ist, zählen und tLast auf diese Zeit setzen.'],
    rpm: ['Impulse je Umdrehung und Torzeit aus der Aufgabe lesen.', 'Umdrehungen = Impulse / Impulse je Umdrehung.', 'Auf eine Minute umrechnen (durch Torzeit, mal 60).'],
    load: ['Die ISR braucht je Aufruf eine feste Zeit.', 'Anteil = Zeit je Aufruf · Aufrufe je Sekunde (in Sekunden rechnen).', 'Mal 100 für Prozent.'],
    pollint: ['Vergleiche die Impulsdauer mit der Dauer eines loop()-Durchlaufs.', 'Ist der Impuls kürzer als ein Durchlauf, kann er zwischen zwei Abfragen liegen.', 'Wähle die Antwort, die dazu passt.'],
    dly: ['Lies ab, wie lange das Programm in delay() steht.', 'Die Taste wird nur einmal je Durchlauf abgefragt.', 'Schlimmster Fall: Tastendruck direkt nach der Abfrage, also eine volle Durchlaufzeit.'],
    toggl: ['Rechne die Beobachtungszeit in ms um.', 'Teile durch das Umschaltintervall.', 'Nur ganze Wechsel zählen.'],
    mover: ['Zahl der Werte des Zählers: 2 hoch Bitbreite.', 'Zeit bis zum Überlauf = Werte · Zeit je Zählschritt.', 'In die verlangte Einheit umrechnen.'],
    u32: ['Beide Zahlen sind unsigned long: Subtraktion rechnet modulo 2 hoch 32.', 'Der Überlauf liegt zwischen den beiden Zeiten.', 'Differenz = (2 hoch 32 − letzt) + jetzt.'],
    stat: ['Addiere die vier Dauern: Länge eines Durchlaufs.', 'Teile die Zeit durch einen Durchlauf, nur der Rest zählt.', 'Suche den Zustand, in dessen Zeitfenster der Rest liegt.'],
    cyc: ['Addiere die vier Dauern: Länge eines Durchlaufs in ms.', 'Rechne die Minuten in ms um.', 'Teile und runde ab: Nur volle Durchläufe zählen.'],
    avgi: ['Ladung der Aktivphase: Aktivstrom · Aktivzeit.', 'Ladung der Schlafphase: Schlafstrom · (Periode − Aktivzeit).', 'Summe durch die Periode teilen: Mittelwert.'],
    days: ['Kapazität in mAh in µAh umrechnen (mal 1000).', 'Laufzeit in Stunden = µAh / Strom in µA.', 'Durch 24 teilen: Tage.'],
    measure: ['Rechne den Mittelstrom für die Ausgangslage.', 'Rechne ihn nochmals mit halbierter Aktivzeit und mit halbiertem Schlafstrom.', 'Wähle die Maßnahme mit dem kleineren Mittelstrom.'],
    isrseq: ['Stelle dir den Ablauf vor: vom Ereignis bis zur Rückkehr.', 'Finde den angegebenen Schritt in der Reihenfolge.', 'Wähle den Schritt, der direkt danach kommt.'],
    stateq: ['Lies jede der vier Zeitangaben aus dem Programmauszug ab.', 'Rechne die Zeit modulo der Länge eines Durchlaufs.', 'Lege die vier Zeitfenster hintereinander und finde das passende.'],
    know: ['Lies die Frage und überlege, welcher Begriff gemeint ist.', 'Streiche die Antworten, die offensichtlich falsch sind.', 'Wähle die Antwort, die zum Fachbegriff passt.']
  };

  /* ---------- Generatoren ---------- */
  const G = {
    /* Timer und Vorteiler */
    tick: R => {
      const c = C(), fr = c.pick(R, c.FCPU), N = c.pick(R, c.PRES.filter(n => n > 1)), v = c.tick(fr, N) * 1e6;
      return numQ('Ein Mikrocontroller läuft mit ' + MHz(fr) + ' Takt. Ein Timer zählt über den Vorteiler ' + N + ' (der Takt wird durch ' + N + ' geteilt). Wie lange dauert ein Zählschritt?', v, 'µs', 'Zählschritt', 0.01,
        'Zählschritt = Vorteiler / Takt = ' + N + ' / ' + f(fr, 0) + ' Hz = ' + f(v, 4) + ' µs.', ['Der Takt gibt die Schritte je Sekunde an, der Vorteiler macht ihn langsamer.', 'Vorteiler geteilt durch Takt in Hz ergibt Sekunden, mal 1.000.000 ergibt µs.'], VOR.tick);
    },
    ovf: R => {
      const c = C(), fr = c.pick(R, [1e6, 4e6, 8e6, 16e6]), N = c.pick(R, [8, 64, 256, 1024]), b = c.pick(R, [8, 16]), v = c.overflow(fr, N, b) * 1000;
      return numQ('Ein ' + b + '-Bit-Timer läuft mit ' + MHz(fr) + ' Takt und Vorteiler ' + N + '. Er zählt von 0 bis zum Höchstwert und springt dann auf 0 zurück (Überlauf). Wie lange dauert es von einem Überlauf bis zum nächsten?', v, 'ms', 'Überlaufzeit', Math.max(0.01, v * 0.0005),
        'Stufen = 2^' + b + ' = ' + f(c.pow2(b), 0) + '. Zählschritt = ' + N + ' / ' + f(fr, 0) + ' Hz = ' + f(c.tick(fr, N) * 1e6, 4) + ' µs. Überlaufzeit = ' + f(c.pow2(b), 0) + ' · ' + f(c.tick(fr, N) * 1e6, 4) + ' µs = ' + f(v, 3) + ' ms.', ['Wie viele Zählstufen hat ein ' + b + '-Bit-Zähler?', 'Stufen mal Zeit je Zählschritt.'], VOR.ovf);
    },
    ocr: R => {
      const c = C(); let fr, N, s, fz, ok = false;
      for (let t = 0; t < 200 && !ok; t++) { fr = c.pick(R, [8e6, 16e6]); N = c.pick(R, [8, 64, 256, 1024]); s = c.pick(R, [10, 20, 25, 40, 50, 100, 125, 200, 250]); fz = fr / (N * s); ok = Number.isInteger(fz) && fz >= 50 && fz <= 20000; }
      if (!ok) { fr = 16e6; N = 64; s = 250; fz = 1000; }
      const ocr = s - 1;
      return numQ('Der 8-Bit-Timer läuft im CTC-Modus: Der Zähler läuft von 0 bis OCR, löst dann einen Treffer aus und springt auf 0. Takt ' + MHz(fr) + ', Vorteiler ' + N + '. Es sollen genau ' + f(fz, 0) + ' Treffer je Sekunde entstehen. Welchen Wert trägst du in OCR ein?', ocr, 'Zählwert', 'Vergleichswert OCR', 0.01,
        'Zählschritt = ' + N + ' / ' + f(fr, 0) + ' Hz = ' + f(c.tick(fr, N) * 1e6, 4) + ' µs. Periode = 1 / ' + f(fz, 0) + ' Hz = ' + f(1e6 / fz, 3) + ' µs. Schritte = ' + f(1e6 / fz, 3) + ' / ' + f(c.tick(fr, N) * 1e6, 4) + ' = ' + f(s, 0) + '. OCR = ' + f(s, 0) + ' − 1 = ' + f(ocr, 0) + ' (passt in 8 Bit).', ['Wie viele Zählschritte passen in eine Periode?', 'Der Zähler beginnt bei 0: Ziehe 1 ab.'], VOR.ocr);
    },
    ocrT: R => {
      const c = C(), fr = c.pick(R, [8e6, 16e6]), N = c.pick(R, [64, 256, 1024]), s = c.pick(R, [25, 50, 100, 125, 200, 250]), Tz = s * N / fr * 1000;
      return numQ('Im CTC-Modus soll ein 8-Bit-Timer alle ' + f(Tz, 3) + ' ms einen Treffer auslösen. Takt ' + MHz(fr) + ', Vorteiler ' + N + '. Welchen Wert trägst du in OCR ein?', s - 1, 'Zählwert', 'Vergleichswert OCR', 0.01,
        'Zählschritt = ' + N + ' / ' + f(fr, 0) + ' Hz = ' + f(c.tick(fr, N) * 1e6, 4) + ' µs. Schritte = ' + f(Tz * 1000, 3) + ' µs / ' + f(c.tick(fr, N) * 1e6, 4) + ' µs = ' + f(s, 0) + '. OCR = ' + f(s, 0) + ' − 1 = ' + f(s - 1, 0) + '.', ['Zeit je Zählschritt bestimmen, Zielzeit in dieser Einheit ausdrücken.', 'Der Zähler beginnt bei 0: ein Schritt weniger.'], VOR.ocrT);
    },
    pre: R => {
      const c = C(), fr = c.pick(R, [8e6, 16e6]), fz = c.pick(R, [100, 200, 250, 500, 1000, 2000, 4000]), best = c.bestPre(fr, fz, 8);
      const tab = c.PRES.map(N => 'Vorteiler ' + N + ': OCR = ' + f(c.ocrIdeal(fr, N, fz), 1) + (c.ocrIdeal(fr, N, fz) <= 255 + 1e-9 ? ' (passt)' : ' (zu groß)')).join('; ');
      return choiceQ(R, 'Der 8-Bit-Timer (OCR höchstens 255) soll im CTC-Modus bei ' + MHz(fr) + ' Takt genau ' + f(fz, 0) + ' Treffer je Sekunde liefern. Du darfst die Vorteiler 1, 8, 64, 256 und 1024 wählen. Welcher ist der kleinste, bei dem der Vergleichswert noch in OCR passt?', 'Vorteiler ' + best, c.shuffle(R, c.PRES.filter(n => n !== best)).slice(0, 3).map(n => 'Vorteiler ' + n),
        'OCR = Takt / (Vorteiler · Frequenz) − 1 für jeden Vorteiler: ' + tab + '. Der kleinste passende Vorteiler ist ' + best + '. Er hat die feinste Auflösung.', ['Berechne OCR für den kleinsten Vorteiler und gehe dann weiter nach oben.', 'Die Rechnung endet, sobald OCR höchstens 255 ist.'], VOR.pre);
    },
    csbits: R => {
      const c = C(), M = { 1: ['CS00'], 8: ['CS01'], 64: ['CS01', 'CS00'], 256: ['CS02'], 1024: ['CS02', 'CS00'] }, bits = { 1: '001', 8: '010', 64: '011', 256: '100', 1024: '101' }, N = c.pick(R, c.PRES);
      const code = 'TCCR0B = ' + M[N].map(n => '(1 << ' + n + ')').join(' | ') + ';';
      return choiceQ(R, 'Das Register TCCR0B steuert den Vorteiler des 8-Bit-Timers. Tabelle für die Bits CS02, CS01, CS00 (in dieser Reihenfolge): 001 = Vorteiler 1, 010 = 8, 011 = 64, 100 = 256, 101 = 1024, 000 = Timer steht. Welchen Vorteiler stellt die Programmzeile ein?', 'Vorteiler ' + N, c.shuffle(R, c.PRES.filter(n => n !== N)).slice(0, 3).map(n => 'Vorteiler ' + n),
        'Gesetzt sind ' + M[N].join(' und ') + ', die übrigen CS-Bits sind 0. Als Dreier-Zahl (CS02 CS01 CS00) ergibt das ' + bits[N] + ' und die Tabelle sagt: Vorteiler ' + N + '.', ['Welche der drei Bits CS02, CS01, CS00 sind 1?', 'Setze die Bits in der Reihenfolge CS02, CS01, CS00 zusammen.'], VOR.csbits, code);
    },
    timerbug: pq(TIMERBUG, VOR_BUG),
    toggle: R => {
      const c = C(); let fr, N, s, fo, ok = false;
      for (let t = 0; t < 200 && !ok; t++) { fr = c.pick(R, [8e6, 16e6]); N = c.pick(R, [8, 64, 256]); s = c.pick(R, [10, 20, 25, 40, 50, 100, 125, 200, 250]); fo = fr / (2 * N * s); ok = Math.abs(fo * 100 - Math.round(fo * 100)) < 1e-9 && fo >= 20 && fo <= 50000; }
      if (!ok) { fr = 16e6; N = 64; s = 250; fo = 500; }
      return numQ('Der Timer läuft im CTC-Modus mit ' + MHz(fr) + ' Takt, Vorteiler ' + N + ' und OCR = ' + (s - 1) + '. Bei jedem Treffer kippt ein Ausgangspin (High wird Low, Low wird High). Welche Frequenz hat das Rechteck am Pin?', fo, 'Hz', 'Frequenz am Pin', 0.05,
        'Treffer je Sekunde = ' + f(fr, 0) + ' / (' + N + ' · ' + f(s, 0) + ') = ' + f(fr / (N * s), 2) + ' Hz. Der Pin kippt bei jedem Treffer, eine volle Periode braucht zwei Treffer: ' + f(fr / (N * s), 2) + ' / 2 = ' + f(fo, 2) + ' Hz.', ['Zuerst: Wie viele Treffer je Sekunde?', 'Eine Periode des Rechtecks hat zwei Kippvorgänge.'], VOR.toggle);
    },
    ferr: R => {
      const c = C(); let fr, N, fz, r, ok = false;
      for (let t = 0; t < 300 && !ok; t++) {
        fr = c.pick(R, [8e6, 16e6]); N = c.pick(R, [8, 64, 256]); fz = c.pick(R, [900, 1500, 2500, 3000, 3500, 6000, 7000, 9000]); r = c.ocrCalc(fr, N, fz, 8);
        const fr0 = r.ideal - Math.floor(r.ideal); ok = r.fits && r.ideal >= 20 && Math.abs(fr0 - 0.5) > 0.1 && r.errPct > 0.05;
      }
      if (!ok) { fr = 16e6; N = 64; fz = 3000; r = c.ocrCalc(fr, N, fz, 8); }
      return numQ('Der 8-Bit-Timer soll im CTC-Modus ' + f(fz, 0) + ' Treffer je Sekunde liefern. Takt ' + MHz(fr) + ', Vorteiler ' + N + '. OCR muss eine ganze Zahl sein. Wie viel Prozent weicht die tatsächliche Frequenz von der gewünschten ab? (Betrag, ohne Vorzeichen)', r.errPct, '%', 'Abweichung', 0.02,
        'OCR = ' + f(fr, 0) + ' / (' + N + ' · ' + f(fz, 0) + ') − 1 = ' + f(r.ideal, 2) + ', gerundet ' + f(r.ocr, 0) + '. Tatsächliche Frequenz = ' + f(fr, 0) + ' / (' + N + ' · ' + f(r.ocr + 1, 0) + ') = ' + f(r.fReal, 2) + ' Hz. Abweichung = |' + f(r.fReal, 2) + ' − ' + f(fz, 0) + '| / ' + f(fz, 0) + ' · 100 = ' + f(r.errPct, 3) + ' %.', ['Berechne OCR als Kommazahl und runde.', 'Aus dem gerundeten OCR die tatsächliche Frequenz berechnen.'], VOR.ferr);
    },
    /* PWM und Mittelwert */
    duty: R => {
      const c = C(), o = c.pick(R, [51, 102, 153, 204]), d = c.duty(o, 8) * 100;
      return numQ('Ein 8-Bit-Timer erzeugt PWM. Der Zähler läuft von 0 bis 255, der Ausgang ist High, solange der Zähler unter OCR liegt. OCR = ' + o + '. Wie groß ist der Tastgrad?', d, '%', 'Tastgrad', 0.1,
        'Tastgrad = OCR / 255 = ' + o + ' / 255 = ' + f(d / 100, 2) + ' = ' + f(d, 1) + ' %.', ['Wie viele Schritte hat die ganze Periode, wie viele davon ist der Ausgang High?', 'OCR geteilt durch 255.'], VOR.duty);
    },
    mean: R => {
      const c = C(), d = c.pick(R, [20, 40, 50, 60, 80]), vs = c.pick(R, [5, 3.3]), v = c.meanV(d / 100, vs);
      return numQ('Ein PWM-Signal mit ' + f(d, 0) + ' % Tastgrad schaltet zwischen 0 V und ' + f(vs, 1) + ' V. Ein Tiefpass glättet es. Welche mittlere Gleichspannung entsteht?', v, 'V', 'Mittelwert', 0.01,
        'Mittelwert = Tastgrad · Versorgungsspannung = ' + f(d / 100, 2) + ' · ' + f(vs, 1) + ' V = ' + f(v, 3) + ' V.', ['Der Mittelwert liegt zwischen 0 V und der Versorgungsspannung.', 'Tastgrad als Anteil mal Spannung.'], VOR.mean);
    },
    ocru: R => {
      const c = C(), vs = c.pick(R, [5, 3.3]), k = c.ri(R, 1, 4), u = vs === 5 ? k : k * 0.66, o = c.ocrForU(u, vs, 8);
      return numQ('Ein 8-Bit-PWM-Ausgang (0 bis 255, ' + f(vs, 1) + ' V Pegel) mit Tiefpass soll eine mittlere Spannung von ' + f(u, 2) + ' V liefern. Welchen Wert schreibst du in OCR?', o, 'Zählwert', 'Vergleichswert OCR', 0.01,
        'Tastgrad = ' + f(u, 2) + ' V / ' + f(vs, 1) + ' V = ' + f(u / vs, 2) + '. OCR = ' + f(u / vs, 2) + ' · 255 = ' + f(o, 0) + '.', ['Wie viel Prozent der Versorgungsspannung sollen es sein?', 'Tastgrad mal 255.'], VOR.ocru);
    },
    pwmf: R => {
      const c = C(), fr = c.pick(R, [8e6, 16e6]), N = c.pick(R, [8, 64, 256, 1024]), v = c.pwmHz(fr, N, 8);
      return numQ('Ein 8-Bit-Timer erzeugt PWM mit dem Zählumfang 256 Schritte je Periode. Takt ' + MHz(fr) + ', Vorteiler ' + N + '. Wie hoch ist die PWM-Frequenz?', v, 'Hz', 'PWM-Frequenz', 0.05,
        'Periode = 256 · ' + N + ' / ' + f(fr, 0) + ' Hz = ' + f(256 * N / fr * 1000, 4) + ' ms. Frequenz = Takt / (Vorteiler · 256) = ' + f(fr, 0) + ' / (' + N + ' · 256) = ' + f(v, 3) + ' Hz.', ['Wie viele Zählschritte hat eine PWM-Periode?', 'Takt durch Vorteiler durch 256.'], VOR.pwmf);
    },
    scope: R => {
      const c = C(), T = c.pick(R, [2, 4, 5, 10, 20]), d = c.pick(R, [0.2, 0.25, 0.4, 0.6, 0.75, 0.8]), vs = c.pick(R, [5, 3.3]), th = Math.round(T * d * 1000) / 1000, v = c.meanV(th / T, vs);
      return numQ('Am Oszilloskop siehst du ein PWM-Signal mit der Periode ' + f(T, 0) + ' ms. Der Pegel ist ' + f(th, 2) + ' ms lang High (' + f(vs, 1) + ' V) und sonst Low (0 V). Welche mittlere Spannung hat das Signal?', v, 'V', 'Mittelwert', 0.01,
        'Tastgrad = ' + f(th, 2) + ' ms / ' + f(T, 0) + ' ms = ' + f(th / T, 2) + '. Mittelwert = ' + f(th / T, 2) + ' · ' + f(vs, 1) + ' V = ' + f(v, 3) + ' V.', ['Wie lange ist der Pegel hoch, im Verhältnis zur Periode?', 'Das Verhältnis mal die Spannung.'], VOR.scope);
    },
    pwmbug: pq(PWMBUG, VOR_BUG),
    mosfet: R => {
      const c = C(), vs = c.pick(R, [12, 24]), k = c.ri(R, 1, 4), u = vs * k / 5, o = c.ocrForU(u, vs, 8);
      return numQ('Der Controller (Logikpegel 5 V) steuert über einen Leistungsschalter einen Motor an ' + f(vs, 0) + ' V. Der 8-Bit-PWM-Ausgang (0 bis 255) schaltet den Motor ein und aus. Der Motor soll im Mittel ' + f(u, 1) + ' V erhalten. Welchen Wert schreibst du in OCR?', o, 'Zählwert', 'Vergleichswert OCR', 0.01,
        'Der Schalter legt ' + f(vs, 0) + ' V an den Motor, nicht 5 V. Tastgrad = ' + f(u, 1) + ' V / ' + f(vs, 0) + ' V = ' + f(u / vs, 2) + '. OCR = ' + f(u / vs, 2) + ' · 255 = ' + f(o, 0) + '.', ['Welche Spannung liegt am Motor, wenn der Schalter durchgeschaltet ist?', 'Tastgrad = Zielspannung / Lastspannung.'], VOR.mosfet);
    },
    /* AD-Wandler */
    steps: R => {
      const c = C(), n = c.pick(R, [6, 8, 10, 12]), v = c.steps(n);
      return numQ('Ein AD-Wandler hat ' + n + ' Bit Auflösung. Wie viele verschiedene Messwerte (Stufen) kann er liefern?', v, 'Stufen', 'Zahl der Stufen', 0.01,
        'Jedes Bit verdoppelt die Zahl der Werte: 2^' + n + ' = ' + f(v, 0) + ' Stufen (Rohwerte 0 bis ' + f(v - 1, 0) + ').', ['Mit 1 Bit sind es 2 Werte, mit 2 Bit sind es 4 ...', 'Potenz: 2 hoch n.'], VOR.steps);
    },
    lsb: R => {
      const c = C(), u = c.pick(R, [5, 3.3, 2.56, 1.1]), n = c.pick(R, [8, 10, 12]), v = c.lsb(u, n) * 1000;
      return numQ('Ein ' + n + '-Bit-AD-Wandler hat die Referenzspannung ' + f(u, 2) + ' V. Um wie viel mV ändert sich die Eingangsspannung für einen Digit-Schritt (1 LSB)?', v, 'mV', 'LSB', 0.01,
        'Stufen = 2^' + n + ' = ' + f(c.pow2(n), 0) + '. 1 LSB = ' + f(u, 2) + ' V / ' + f(c.pow2(n), 0) + ' = ' + f(v, 4) + ' mV.', ['Stufen ausrechnen, Referenz darauf aufteilen.', 'V in mV umrechnen: mal 1000.'], VOR.lsb);
    },
    raw2u: R => {
      const c = C(), u = c.pick(R, [5, 3.3, 2.56]), raw = c.ri(R, 100, 1000), v = c.uOf(raw, u, 10);
      return numQ('Ein 10-Bit-AD-Wandler mit ' + f(u, 2) + ' V Referenz liefert den Rohwert ' + f(raw, 0) + '. Welche Spannung liegt am Eingang? (Rechne mit U = Rohwert · Referenz / 1024.)', v, 'V', 'Eingangsspannung', 0.01,
        'U = ' + f(raw, 0) + ' · ' + f(u, 2) + ' V / 1024 = ' + f(v, 4) + ' V.', ['Ein Rohwert ist ein Anteil der Referenz.', 'Rohwert durch 1024 mal Referenz.'], VOR.raw2u);
    },
    u2raw: R => {
      const c = C(), u = c.pick(R, [5, 2.56]), n = c.pick(R, [8, 10]), m = c.ri(R, 1, 7), U = u * m / 8, raw = c.rawOf(U, u, n);
      return numQ('Ein ' + n + '-Bit-AD-Wandler hat ' + f(u, 2) + ' V Referenz. Am Eingang liegen ' + f(U, 3) + ' V. Welchen Rohwert liefert er?', raw, 'Digit', 'Rohwert', 0.01,
        'Stufen = 2^' + n + ' = ' + f(c.pow2(n), 0) + '. Rohwert = ' + f(U, 3) + ' V / ' + f(u, 2) + ' V · ' + f(c.pow2(n), 0) + ' = ' + f(raw, 0) + '.', ['Wie viel Prozent der Referenz liegen am Eingang?', 'Dieser Anteil mal die Zahl der Stufen.'], VOR.u2raw);
    },
    refsel: R => {
      const c = C(), um = c.pick(R, [0.9, 1.0, 1.8, 2.2, 2.5, 3.0, 3.2, 4.0, 4.8]), right = c.refFor(um), nm = x => f(x, 2) + ' V';
      return choiceQ(R, 'Ein Sensor liefert Spannungen von 0 V bis ' + f(um, 1) + ' V. Der AD-Wandler bietet die Referenzen 1,1 V, 2,56 V, 3,3 V und 5 V. Welche wählst du, damit der Messbereich abgedeckt ist und die Auflösung so fein wie möglich bleibt?', nm(right), c.REFS.filter(x => x !== right).map(nm),
        'Der Messbereich muss unter der Referenz liegen, sonst wird der Wert abgeschnitten. Unter den passenden (' + c.REFS.filter(x => x >= um - 1e-9).map(nm).join(', ') + ') hat die kleinste die feinste Auflösung: ' + nm(right) + '.', ['Welche Referenzen sind überhaupt groß genug?', 'Kleinere Referenz bedeutet kleinere Stufen.'], VOR.refsel);
    },
    perdig: R => {
      const c = C(), span = c.pick(R, [100, 150, 200, 250]), n = c.pick(R, [8, 10]), v = c.perDigit(span, n) * 1000;
      return numQ('Ein Temperatursensor liefert über die gesamte Messspanne von ' + f(span, 0) + ' K (0 V bis zur Referenz) eine Spannung. Ein ' + n + '-Bit-AD-Wandler wertet sie aus. Um wie viel mK ändert sich die Temperatur je Digit?', v, 'mK', 'Auflösung je Digit', 0.05,
        'Stufen = 2^' + n + ' = ' + f(c.pow2(n), 0) + '. Je Digit = ' + f(span, 0) + ' K / ' + f(c.pow2(n), 0) + ' = ' + f(v / 1000, 5) + ' K = ' + f(v, 3) + ' mK.', ['Messspanne durch Stufen teilen.', 'K in mK: mal 1000.'], VOR.perdig);
    },
    divider: R => {
      const c = C(), ue = c.pick(R, [10, 15, 20, 25, 30]), r2 = c.pick(R, [1, 2.2, 4.7, 10]), r1 = c.r1For(ue, 5, r2);
      return numQ('Eine Spannung bis ' + f(ue, 0) + ' V soll mit einem Spannungsteiler an einen AD-Eingang mit 5 V Referenz angepasst werden. Der untere Widerstand R2 hat ' + f(r2, 1) + ' kΩ. Bei ' + f(ue, 0) + ' V Eingangsspannung sollen genau 5 V am Teilerpunkt liegen. Wie groß ist der obere Widerstand R1?', r1, 'kΩ', 'Widerstand R1', 0.01,
        'Ue / Ua = ' + f(ue, 0) + ' / 5 = ' + f(ue / 5, 1) + '. Das Verhältnis (R1 + R2) / R2 muss ' + f(ue / 5, 1) + ' sein, also R1 = R2 · (' + f(ue / 5, 1) + ' − 1) = ' + f(r2, 1) + ' kΩ · ' + f(ue / 5 - 1, 1) + ' = ' + f(r1, 2) + ' kΩ.', ['Welcher Anteil der Eingangsspannung darf am unteren Widerstand liegen?', 'Beim Spannungsteiler verhalten sich die Spannungen wie die Widerstände.'], VOR.divider);
    },
    adcbug: pq(ADCBUG, VOR_BUG),
    /* Interrupts und ISR */
    volat: pq(VOLQ, VOR.know),
    isrseq: R => {
      const c = C(), A = ['Das Ereignis tritt ein, das Interrupt-Flag wird gesetzt', 'Der Controller beendet den laufenden Befehl', 'Die Rücksprungadresse wird gerettet, weitere Interrupts werden gesperrt', 'Die ISR läuft', 'Der Rücksprung führt das Hauptprogramm an derselben Stelle fort'], i = c.ri(R, 0, A.length - 2), right = A[i + 1], wrong = c.shuffle(R, A.filter((_, j) => j !== i && j !== i + 1)).slice(0, 3);
      return choiceQ(R, 'Ein Interrupt unterbricht das Hauptprogramm. Im Ablauf ist der Schritt "' + A[i] + '" erledigt. Welcher Schritt folgt als nächster?', right, wrong, 'Der Ablauf: ' + A.map((s, j) => (j + 1) + '. ' + s).join('; ') + '. Nach Schritt ' + (i + 1) + ' folgt: ' + right + '.', ['Denke an den Weg vom Ereignis bis zur Rückkehr.', 'Erst muss der laufende Befehl fertig sein, dann wird die Stelle gemerkt, dann läuft die ISR.'], VOR.isrseq);
    },
    isrbug: pq(ISRBUG, VOR_BUG),
    deb: R => {
      const c = C(); let t = c.ri(R, 100, 400); const times = [], np = c.ri(R, 2, 3), slow = R() < 0.7 ? c.ri(R, 0, np - 1) : -1;
      for (let p = 0; p < np; p++) {
        times.push(t);
        const k = c.ri(R, 2, 3), offs = new Set(); while (offs.size < k) offs.add(c.ri(R, 1, 40));
        if (R() < 0.5) offs.add(c.ri(R, 42, 48)); if (p === slow) offs.add(c.ri(R, 52, 60));
        const so = [...offs].sort((a, b) => a - b); so.forEach(o => times.push(t + o)); t = t + so[so.length - 1] + c.ri(R, 80, 300);
      }
      const tr = c.debounceTrace(times, 50), n = c.debounce(times, 50);
      return withCode(numQ('Ein Taster löst bei jeder fallenden Flanke einen Interrupt aus. Die ISR zählt eine Flanke nur, wenn seit der zuletzt gezählten Flanke mehr als 50 ms vergangen sind. tLast ist am Anfang 0. Die Flanken kommen zu diesen Zeiten (ms nach dem Start): ' + times.join(', ') + '. Wie viele Flanken zählt die ISR?', n, 'Flanken', 'Gezählte Flanken', 0.01,
        'Schritt für Schritt (Zeit: Abstand zur letzten gezählten Flanke): ' + tr.map(x => x.t + ' ms: ' + x.d + ' ms, ' + (x.counted ? 'gezählt' : 'ignoriert')).join('; ') + '. Ergebnis: ' + n + ' Flanken. Gezählt wird nur bei Abstand größer als 50 ms, danach beginnt die Sperrzeit von neuem.', ['Beginne mit tLast = 0 und gehe die Flanken der Reihe nach durch.', 'tLast ändert sich nur bei einer gezählten Flanke.'], VOR.deb),
        'ISR(INT0_vect) {\n  unsigned long t = millis();\n  if (t - tLast > 50) {\n    zaehler++;\n    tLast = t;\n  }\n}');
    },
    rpm: R => {
      const c = C(); let rp, ppr, g, cnt, ok = false;
      for (let t = 0; t < 200 && !ok; t++) { rp = c.pick(R, [300, 600, 900, 1200, 1500, 1800, 2400, 3000]); ppr = c.pick(R, [1, 2, 4, 20]); g = c.pick(R, [0.5, 1, 2]); cnt = rp * ppr * g / 60; ok = Number.isInteger(cnt) && cnt >= 5; }
      if (!ok) { rp = 1200; ppr = 2; g = 1; cnt = 40; }
      return numQ('Eine Gabellichtschranke liefert ' + f(ppr, 0) + ' Impuls' + (ppr === 1 ? '' : 'e') + ' je Umdrehung. Ein Interrupt zählt die Impulse. In einer Torzeit von ' + f(g, 1) + ' s zählt die ISR ' + f(cnt, 0) + ' Impulse. Welche Drehzahl hat die Welle?', rp, 'min⁻¹', 'Drehzahl', 0.5,
        'Umdrehungen = ' + f(cnt, 0) + ' / ' + f(ppr, 0) + ' = ' + f(cnt / ppr, 2) + '. Je Sekunde: ' + f(cnt / ppr, 2) + ' / ' + f(g, 1) + ' s = ' + f(cnt / ppr / g, 2) + ' 1/s. Je Minute: mal 60 = ' + f(rp, 0) + ' min⁻¹.', ['Zuerst die Impulse in Umdrehungen umrechnen.', 'Dann auf eine Minute hochrechnen.'], VOR.rpm);
    },
    load: R => {
      const c = C(), us = c.pick(R, [5, 8, 10, 12, 20, 25, 40, 50]), fz = c.pick(R, [500, 1000, 2000, 5000, 10000]), v = c.isrLoad(us, fz);
      return numQ('Eine ISR läuft bei jedem Impuls und braucht ' + f(us, 0) + ' µs. Die Impulse kommen mit ' + f(fz, 0) + ' Hz. Wie viel Prozent der Rechenzeit belegt die ISR?', v, '%', 'Belastung', 0.01,
        'Zeit je Sekunde = ' + f(us, 0) + ' µs · ' + f(fz, 0) + ' = ' + f(us * fz, 0) + ' µs = ' + f(us * fz / 1e6, 4) + ' s. Das sind ' + f(v, 2) + ' % von einer Sekunde. Für das Hauptprogramm bleiben ' + f(100 - v, 2) + ' %.', ['Wie viel Zeit verbringt die ISR insgesamt in einer Sekunde?', 'Dieser Teil von einer Sekunde, in Prozent.'], VOR.load);
    },
    pollint: R => {
      const c = C();
      if (R() < 0.5) {
        const L = c.pick(R, [5, 10, 20, 50]), P = c.pick(R, [50, 100, 200]);
        return choiceQ(R, 'Ein Messimpuls dauert ' + f(P, 0) + ' µs. Ein Durchlauf von loop() dauert bis zu ' + f(L, 0) + ' ms (Anzeige, Berechnung). Muss ein Interrupt benutzt werden, damit kein Impuls verpasst wird?', 'Ja: Der Impuls ist viel kürzer als ein Durchlauf und kann zwischen zwei Abfragen liegen', ['Nein: Jede Abfrage sieht jeden Impuls, die Länge spielt keine Rolle', 'Nein: Es reicht, ein delay() ans Ende von loop() zu setzen', 'Ja: Aber nur, wenn der Impuls länger als 1 s dauert'],
          'Ein Impuls von ' + f(P, 0) + ' µs ist ' + f(L * 1000 / P, 0) + '-mal kürzer als ein Durchlauf von ' + f(L, 0) + ' ms. Liegt er zwischen zwei Abfragen, wird er nie gesehen. Ein Interrupt reagiert sofort auf die Flanke.', ['Vergleiche Impulsdauer und Durchlaufdauer in derselben Einheit.', 'Wann wird in loop() das nächste Mal abgefragt?'], VOR.pollint);
      }
      const L = c.pick(R, [2, 5, 10]), P = c.pick(R, [20, 50, 100]);
      return choiceQ(R, 'Ein Taster-Impuls dauert ' + f(P, 0) + ' ms. Ein Durchlauf von loop() dauert höchstens ' + f(L, 0) + ' ms. Muss ein Interrupt benutzt werden, damit kein Impuls verpasst wird?', 'Nein: Der Impuls ist länger als ein Durchlauf, die nächste Abfrage sieht ihn sicher', ['Ja: Nur ein Interrupt kann Impulse erkennen', 'Ja: Jede Abfrage verpasst mindestens jeden zweiten Impuls', 'Ja: Abfragen zerstören den Impuls'],
        'Der Impuls ist ' + f(P / L, 0) + '-mal länger als ein Durchlauf, in dieser Zeit kommt mindestens eine Abfrage. Polling genügt.', ['Vergleiche Impulsdauer und Durchlaufdauer in derselben Einheit.', 'Wie oft wird während des Impulses abgefragt?'], VOR.pollint);
    },
    /* millis und Zustandsautomat */
    dly: R => {
      const c = C(), a = c.pick(R, [100, 200, 250, 300, 500, 1000]), b = c.pick(R, [100, 200, 250, 300, 500, 1000]);
      return withCode(numQ('Die Taste wird in loop() nur einmal je Durchlauf abgefragt. Der Rest der Zeit steht das Programm in delay(). Du drückst die Taste im ungünstigsten Moment, direkt nach der Abfrage. Wie viele ms dauert es höchstens, bis das Programm die Taste bemerkt? (Rechenzeit der anderen Zeilen vernachlässigt)', a + b, 'ms', 'Reaktionszeit', 0.01,
        'Ein Durchlauf dauert ' + f(a, 0) + ' ms + ' + f(b, 0) + ' ms = ' + f(a + b, 0) + ' ms. Drückst du direkt nach der Abfrage, wartest du fast den ganzen Durchlauf: höchstens ' + f(a + b, 0) + ' ms. Mit millis() bleibt loop() schnell und die Taste wird sofort bemerkt.', ['Wie lange steht das Programm insgesamt in delay()?', 'Der schlimmste Fall: gerade eben verpasst.'], VOR.dly),
        'void loop() {\n  digitalWrite(LED, HIGH);\n  delay(' + a + ');\n  digitalWrite(LED, LOW);\n  delay(' + b + ');\n  if (digitalRead(TASTE) == LOW) { /* reagieren */ }\n}');
    },
    toggl: R => {
      const c = C(); let iv, T, ok = false;
      for (let t = 0; t < 100 && !ok; t++) { iv = c.pick(R, [200, 250, 400, 500]); T = c.pick(R, [3, 5, 10, 12, 20]); ok = (T * 1000) % iv === 0; }
      if (!ok) { iv = 500; T = 10; }
      const n = c.toggles(T * 1000, iv);
      return withCode(numQ('Eine LED wird mit millis() umgeschaltet. tLast beginnt bei 0. Wie oft schaltet die LED in den ersten ' + f(T, 0) + ' s um?', n, 'Wechsel', 'Zahl der Wechsel', 0.01,
        'Beobachtungszeit = ' + f(T * 1000, 0) + ' ms. Intervall = ' + f(iv, 0) + ' ms. Wechsel = ' + f(T * 1000, 0) + ' / ' + f(iv, 0) + ' = ' + f(n, 0) + '. Der erste Wechsel liegt bei ' + f(iv, 0) + ' ms, der letzte genau bei ' + f(T * 1000, 0) + ' ms.', ['Alle Zeiten in dieselbe Einheit bringen.', 'Zeit durch Intervall.'], VOR.toggl),
        'if (millis() - tLast >= ' + iv + ') {\n  tLast = millis();\n  digitalWrite(LED, !digitalRead(LED));\n}');
    },
    mover: R => {
      const c = C(), mode = c.pick(R, [16, 16, 32]);
      if (mode === 16) {
        const tk = c.pick(R, [1, 2, 4, 10]), v = 65536 * tk / 1000;
        return numQ('Ein Zähler aus 16 Bit (Zählumfang 65.536) wird alle ' + f(tk, 0) + ' ms um 1 erhöht und fängt nach dem Höchstwert bei 0 wieder an. Nach wie vielen Sekunden läuft er über (von 0 bis zum Überlauf)?', v, 's', 'Zeit bis zum Überlauf', 0.01,
          '65.536 Werte · ' + f(tk, 0) + ' ms = ' + f(65536 * tk, 0) + ' ms = ' + f(v, 3) + ' s.', ['Wie viele Werte hat ein 16-Bit-Zähler?', 'Werte mal Zeit je Schritt.'], VOR.mover);
      }
      const v = c.U32 / 86400000;
      return numQ('millis() zählt Millisekunden in einer 32-Bit-Zahl ohne Vorzeichen (unsigned long, Zählumfang 4.294.967.296) und läuft dann über. Nach wie vielen Tagen passiert das? (1 Tag = 86.400.000 ms)', v, 'Tagen', 'Zeit bis zum Überlauf', 0.01,
        '2^32 ms = 4.294.967.296 ms. Geteilt durch 86.400.000 ms je Tag = ' + f(v, 4) + ' Tage, also rund 49,7 Tage.', ['Wie viele Millisekunden hat ein Tag?', 'Teile den Zählumfang durch die Millisekunden je Tag.'], VOR.mover);
    },
    u32: R => {
      const c = C(), a = c.ri(R, 2, 18) * 50, b = c.ri(R, 1, 12) * 50, last = c.U32 - a;
      return withCode(numQ('millis() ist gerade über den Höchstwert hinweggelaufen. letzt = ' + f(last, 0) + ' ms (das ist ' + f(a, 0) + ' ms vor dem Überlauf), jetzt = ' + f(b, 0) + ' ms. Beide Variablen sind unsigned long. Welchen Wert hat jetzt - letzt?', a + b, 'ms', 'Differenz', 0.01,
        'Von letzt bis zum Überlauf vergehen ' + f(a, 0) + ' ms, danach noch ' + f(b, 0) + ' ms: ' + f(a + b, 0) + ' ms. Die Subtraktion ohne Vorzeichen rechnet modulo 2^32 und liefert genau das. Der Vergleich if (jetzt - letzt >= intervall) arbeitet deshalb auch über den Überlauf richtig.', ['Wie viel Zeit liegt zwischen letzt und dem Überlauf?', 'Und wie viel zwischen Überlauf und jetzt?'], VOR.u32),
        'unsigned long jetzt  = millis();\nif (jetzt - letzt >= intervall) {\n  letzt = jetzt;\n}');
    },
    stat: R => {
      const c = C(), d = [c.pick(R, [3000, 4000, 5000]), c.pick(R, [1000, 2000]), c.pick(R, [4000, 5000, 6000]), c.pick(R, [1000, 2000, 3000])], cy = c.cycle(d); let T;
      for (let t = 0; t < 200; t++) { T = c.ri(R, 12, 70) * 1000 + c.pick(R, [0, 500]); const m = T % cy; if (c.segs(d).every(s => s.from !== m)) break; }
      const si = c.stateAt(T, d), N = c.AMPEL.map(a => a.n), m = T % cy, S = c.segs(d);
      const code = 'switch (zustand) {\n  case ROT:     if (millis() - tLast >= ' + d[0] + ') { zustand = ROTGELB; tLast = millis(); } break;\n  case ROTGELB: if (millis() - tLast >= ' + d[1] + ') { zustand = GRUEN;   tLast = millis(); } break;\n  case GRUEN:   if (millis() - tLast >= ' + d[2] + ') { zustand = GELB;    tLast = millis(); } break;\n  case GELB:    if (millis() - tLast >= ' + d[3] + ') { zustand = ROT;     tLast = millis(); } break;\n}';
      return choiceQ(R, 'Eine Ampel arbeitet mit dem Zustandsautomaten im Programmauszug. Die Zeiten sind in ms. Der Start war bei t = 0 im Zustand ROT, tLast = 0. In welchem Zustand ist die Ampel nach ' + f(T / 1000, 1) + ' s? (Rechenzeit vernachlässigt)', N[si], N.filter((_, i) => i !== si),
        'Ein Durchlauf dauert ' + d.map(v => f(v, 0)).join(' + ') + ' = ' + f(cy, 0) + ' ms. ' + f(T, 0) + ' ms ergeben ' + f(Math.floor(T / cy), 0) + ' volle Durchläufe und einen Rest von ' + f(m, 0) + ' ms. Zeitfenster: ' + S.map(s => N[s.i] + ' ' + f(s.from, 0) + ' bis ' + f(s.to, 0) + ' ms').join(', ') + '. Der Rest liegt in ' + N[si] + '.', ['Wie lang ist ein ganzer Durchlauf?', 'Nur der Rest nach den vollen Durchläufen zählt.'], VOR.stateq, code);
    },
    fsmbug: pq(FSMBUG, VOR_BUG),
    cyc: R => {
      const c = C(), d = [c.pick(R, [3000, 4000, 5000]), c.pick(R, [1000, 2000]), c.pick(R, [4000, 5000, 6000]), c.pick(R, [1000, 2000, 3000])], cy = c.cycle(d), M = c.pick(R, [2, 3, 5, 10]), n = Math.floor(M * 60000 / cy);
      return withCode(numQ('Eine Ampel durchläuft die vier Zustände ROT, ROTGELB, GRUEN, GELB der Reihe nach, dann beginnt sie wieder bei ROT. Die Zeiten stehen im Programmauszug (in ms). Wie viele vollständige Durchläufe schafft sie in ' + f(M, 0) + ' Minuten?', n, 'Durchläufe', 'Volle Durchläufe', 0.01,
        'Ein Durchlauf: ' + d.map(v => f(v, 0)).join(' + ') + ' = ' + f(cy, 0) + ' ms. ' + f(M, 0) + ' min = ' + f(M * 60000, 0) + ' ms. ' + f(M * 60000, 0) + ' / ' + f(cy, 0) + ' = ' + f(M * 60000 / cy, 2) + ', also ' + f(n, 0) + ' volle Durchläufe.', ['Wie lange dauert ein Durchlauf?', 'Teile und runde ab: Angefangene Durchläufe zählen nicht.'], VOR.cyc),
        'ROT      ' + d[0] + ' ms\nROTGELB  ' + d[1] + ' ms\nGRUEN    ' + d[2] + ' ms\nGELB     ' + d[3] + ' ms');
    },
    /* Energiesparen */
    slpmode: pq(SLPQ, VOR.know),
    avgi: R => {
      const c = C(), ia = c.pick(R, [8000, 10000, 12000, 15000]), ta = c.pick(R, [10, 20, 50, 100]), is = c.pick(R, [5, 10, 20]), T = c.pick(R, [1000, 2000, 5000, 10000]), v = c.avgI(ia, ta, is, T);
      return numQ('Ein Sensorknoten ist alle ' + f(T, 0) + ' ms für ' + f(ta, 0) + ' ms aktiv (Strom ' + f(ia, 0) + ' µA) und schläft sonst (Strom ' + f(is, 0) + ' µA). Wie groß ist der mittlere Strom?', v, 'µA', 'Mittlerer Strom', 0.5,
        'Aktiv: ' + f(ia, 0) + ' µA · ' + f(ta, 0) + ' ms = ' + f(ia * ta, 0) + ' µA·ms. Schlaf: ' + f(is, 0) + ' µA · ' + f(T - ta, 0) + ' ms = ' + f(is * (T - ta), 0) + ' µA·ms. Summe ' + f(ia * ta + is * (T - ta), 0) + ' / ' + f(T, 0) + ' ms = ' + f(v, 2) + ' µA.', ['Rechne die Ladung der Aktivphase und der Schlafphase getrennt.', 'Summe der Ladungen durch die ganze Periode.'], VOR.avgi);
    },
    days: R => {
      const c = C(), cm = c.pick(R, [200, 240, 1200, 2400]), i = c.pick(R, [100, 125, 200, 250, 400, 500, 1000]), v = c.runDays(cm, i);
      return numQ('Eine Modell-Batterie hat ' + f(cm, 0) + ' mAh. Das Gerät nimmt im Mittel ' + f(i, 0) + ' µA auf. Wie viele Tage läuft das Gerät? (Entladung ideal, ohne Selbstentladung)', v, 'Tage', 'Laufzeit', 0.5,
        'Kapazität = ' + f(cm, 0) + ' mAh = ' + f(cm * 1000, 0) + ' µAh. Laufzeit = ' + f(cm * 1000, 0) + ' µAh / ' + f(i, 0) + ' µA = ' + f(cm * 1000 / i, 1) + ' h = ' + f(v, 2) + ' Tage.', ['Stunden = Kapazität / Strom, beide in derselben Einheit.', 'Stunden durch 24 ergibt Tage.'], VOR.days);
    },
    measure: R => {
      const c = C(); let ia, ta, is, T, a, b, ok = false;
      for (let t = 0; t < 300 && !ok; t++) {
        ia = c.pick(R, [5000, 8000, 10000, 15000]); ta = c.pick(R, [5, 10, 20, 50, 100]); is = c.pick(R, [5, 10, 20, 50]); T = c.pick(R, [1000, 5000, 10000]);
        a = c.avgI(ia, ta / 2, is, T); b = c.avgI(ia, ta, is / 2, T); ok = Math.abs(a - b) / Math.max(a, b) >= 0.2;
      }
      if (!ok) { ia = 10000; ta = 20; is = 10; T = 1000; a = c.avgI(ia, ta / 2, is, T); b = c.avgI(ia, ta, is / 2, T); }
      const A = 'Die Aktivzeit halbieren', B = 'Den Schlafstrom halbieren', best = a < b ? A : B, w = a < b ? B : A, now = c.avgI(ia, ta, is, T);
      return choiceQ(R, 'Ein Gerät ist alle ' + f(T, 0) + ' ms für ' + f(ta, 0) + ' ms aktiv (' + f(ia, 0) + ' µA) und schläft sonst mit ' + f(is, 0) + ' µA. Du kannst genau eine Maßnahme umsetzen. Welche senkt den mittleren Strom stärker?', best, [w, 'Beide bringen genau gleich viel', 'Keine der beiden ändert den Mittelwert merklich'],
        'Ausgangslage: ' + f(now, 2) + ' µA. Aktivzeit halbiert: ' + f(a, 2) + ' µA. Schlafstrom halbiert: ' + f(b, 2) + ' µA. ' + (a < b ? 'Die Aktivphase verbraucht den größten Teil der Ladung, deshalb wirkt hier die Aktivzeit stärker.' : 'Die lange Schlafphase verbraucht den größten Teil der Ladung, deshalb wirkt hier der Schlafstrom stärker.'), ['Welche Phase verbraucht mehr Ladung: aktiv oder schlafend?', 'Rechne beide Maßnahmen durch und vergleiche.'], VOR.measure);
    },
    slpbug: pq(SLPBUG, VOR_BUG)
  };

  /* ---------- Aufgabenliste ---------- */
  const T1 = CATS[0], T2 = CATS[1], T3 = CATS[2], T4 = CATS[3], T5 = CATS[4], T6 = CATS[5];
  const defs = [
    [T1, 1, 'Zählschritt berechnen', 'tick'], [T1, 1, 'Überlaufzeit berechnen', 'ovf'], [T1, 2, 'Vergleichswert aus der Frequenz', 'ocr'], [T1, 2, 'Vergleichswert aus der Zeit', 'ocrT'], [T1, 2, 'Passenden Vorteiler finden', 'pre'], [T1, 2, 'Vorteiler aus den Bits lesen', 'csbits'], [T1, 2, 'Timer-Fehler suchen', 'timerbug'], [T1, 3, 'Rechteck am Pin', 'toggle'], [T1, 3, 'Frequenzabweichung durch Runden', 'ferr'],
    [T2, 1, 'Tastgrad bestimmen', 'duty'], [T2, 1, 'Mittelwert eines PWM-Signals', 'mean'], [T2, 2, 'Vergleichswert für eine Spannung', 'ocru'], [T2, 2, 'PWM-Frequenz berechnen', 'pwmf'], [T2, 2, 'PWM am Oszilloskop lesen', 'scope'], [T2, 2, 'PWM-Fehler suchen', 'pwmbug'], [T2, 3, 'Motor mit eigener Versorgung', 'mosfet'],
    [T3, 1, 'Stufen eines Wandlers', 'steps'], [T3, 1, 'Spannung je Digit', 'lsb'], [T3, 2, 'Rohwert in Spannung umrechnen', 'raw2u'], [T3, 2, 'Spannung in Rohwert umrechnen', 'u2raw'], [T3, 2, 'Referenz auswählen', 'refsel'], [T3, 2, 'Auflösung einer Messgröße', 'perdig'], [T3, 3, 'Spannungsteiler vor dem Eingang', 'divider'], [T3, 2, 'Messfehler im Programm suchen', 'adcbug'],
    [T4, 1, 'Wozu volatile', 'volat'], [T4, 1, 'Ablauf eines Interrupts', 'isrseq'], [T4, 2, 'ISR-Fehler suchen', 'isrbug'], [T4, 3, 'Taster entprellen', 'deb'], [T4, 2, 'Drehzahl aus Impulsen', 'rpm'], [T4, 2, 'Rechenzeit der ISR', 'load'], [T4, 3, 'Abfragen oder Interrupt', 'pollint'],
    [T5, 1, 'Wartezeit mit delay', 'dly'], [T5, 2, 'Blinken mit millis', 'toggl'], [T5, 2, 'Überlauf des Zählers', 'mover'], [T5, 3, 'Zeitdifferenz über den Überlauf', 'u32'], [T5, 2, 'Zustand zu einem Zeitpunkt', 'stat'], [T5, 3, 'Fehler im Zustandsautomaten', 'fsmbug'], [T5, 2, 'Durchläufe zählen', 'cyc'],
    [T6, 1, 'Schlafmodus wählen', 'slpmode'], [T6, 2, 'Mittlerer Strom', 'avgi'], [T6, 2, 'Batterielaufzeit', 'days'], [T6, 3, 'Welche Maßnahme bringt mehr', 'measure'], [T6, 2, 'Schlaf-Fehler suchen', 'slpbug']
  ];
  const tasks = defs.map((d, i) => ({ id: 'mik' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('mik-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.MIK_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { TIMERBUG, PWMBUG, ADCBUG, VOLQ, ISRBUG, FSMBUG, SLPQ, SLPBUG } };
  root.MIK_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MIK_DATA, TASKS: root.MIK_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
