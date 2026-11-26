'use strict';
/* Tonfunk Bus-Lab: Daten (Aufgaben-Generatoren). Lab-Kennung 'bus'.
   ALLE Zahlen sind ÜBUNGSWERTE. Frei erfundene Firma "Modellbetrieb", keine Hersteller, keine Bauteilnummern. Normen nur beim Namen genannt.
   window.BUS_DATA  { cats, tasks, gens, make, makeTask, randomQ, pools }
   window.BUS_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.bus.done' = {id:true})
   Jede Frage q: { text, ask, value, tol, expl, tips[2], steps[] (So gehst du vor), img? (Bild für BUS_VIZ.taskImg) }.
   Titel verraten weder Ergebnis noch Lösung. Eingaben nie negativ: Gesucht sind immer Beträge, Zeiten, Anzahlen, Reserven. */
(function (root) {
  const C = () => root.BUS_CORE || (typeof require === 'function' ? require('./buscore.js') : null);
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['UART und serielle Zeichen', 'RS-232 und RS-485', 'CAN-Bus', 'USB, Ethernet und Modbus', 'Funk und Pegel', 'Fehler erkennen und Busse vergleichen'];

  /* Toleranz: 0,5 % vom Wert, mindestens 0,01 (die Anzeige rundet auf 2 Stellen) */
  const tol = v => Math.max(0.01, C().rd(Math.abs(v) * 0.005, 2));
  const numQ = (text, value, unit, label, tl, expl, tips, steps, more) => Object.assign({ text, ask: { type: 'num', unit, label }, value, tol: tl, expl, tips, steps }, more || {});
  function choiceQ(R, text, right, wrong, expl, tips, steps, more) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return Object.assign({ text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps }, more || {});
  }
  /* Pool: Einträge [Text, richtig, falsch[], Erklärung, Tipps]; Schritte gelten für den ganzen Pool */
  const pq = (POOL, steps, img) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], steps, img ? { img } : null); };

  const BAUD = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
  const PARW = { N: 'keine Parität', E: 'gerade Parität', O: 'ungerade Parität' };
  const cfgOf = (d, par, stop) => d + par + stop;
  const cfgTxt = (d, par, stop) => cfgOf(d, par, stop) + ' (' + d + ' Datenbits, ' + PARW[par] + ', ' + stop + ' Stoppbit' + (stop > 1 ? 's' : '') + ')';
  const randCfg = R => ({ d: C().pick(R, [7, 8]), par: C().pick(R, ['N', 'E', 'O']), stop: C().pick(R, [1, 2]) });
  const bin = (v, n) => { let s = ''; for (let i = n - 1; i >= 0; i--) s += (v >> i) & 1; return s; };

  /* ============================================================ UART und serielle Zeichen */
  const UARTQ = [
    ['Welchen Pegel hat eine UART-Leitung (TTL-Pegel) im Ruhezustand, wenn nichts gesendet wird?', 'Hoch (logisch 1)', ['Niedrig (logisch 0)', 'Hochohmig, ohne festen Pegel', 'Sie wechselt im Takt der Baudrate'], 'Im Ruhezustand liegt die Leitung auf hohem Pegel (Idle). Erst das Startbit zieht sie auf niedrig.', ['Was kann der Empfänger daran erkennen, dass die Leitung auf niedrig fällt?', 'Der Ruhepegel ist hoch, das Startbit ist niedrig.']],
    ['Woran erkennt der Empfänger den Beginn eines Zeichens?', 'Am Startbit: Die Leitung fällt von hoch auf niedrig', ['An einer eigenen Taktleitung', 'An der Adresse im ersten Datenbyte', 'Am Paritätsbit des vorigen Zeichens'], 'Eine UART hat keine Taktleitung. Die fallende Flanke des Startbits startet den Zeitablauf im Empfänger.', ['Es gibt nur TxD, RxD und Masse.', 'Welche Flanke gibt es nach dem Ruhepegel?']],
    ['In welcher Reihenfolge sendet eine UART die Datenbits normalerweise?', 'Das niederwertigste Bit (D0, LSB) zuerst', ['Das höchstwertige Bit (MSB) zuerst', 'Das Paritätsbit zuerst', 'Mal so, mal so, je nach Baudrate'], 'Bei der üblichen UART kommt D0 zuerst, das höchstwertige Datenbit zuletzt, danach folgen Parität und Stoppbit.', ['Denk an das Bild eines Zeichens mit D0 bis D7.', 'Wo steht D0: vorn oder hinten?']],
    ['Warum nennt man die UART-Übertragung asynchron?', 'Es gibt keine gemeinsame Taktleitung, beide Seiten haben dieselbe Baudrate vereinbart', ['Weil die Daten nur in eine Richtung laufen', 'Weil nie zwei Geräte gleichzeitig senden dürfen', 'Weil sich die Baudrate ständig ändert'], 'Asynchron heißt: ohne gemeinsamen Takt. Jede Seite zählt mit ihrem eigenen Takt, der auf die vereinbarte Baudrate eingestellt ist.', ['Welche Leitung fehlt im Vergleich zu SPI?', 'Wie weiß der Empfänger, wann ein Bit gilt?']],
    ['Sender und Empfänger sind auf verschiedene Baudraten eingestellt. Was passiert meistens?', 'Der Empfänger liest falsche Bits: Zeichenmüll oder Rahmenfehler (Frame Error)', ['Die Daten kommen richtig an, nur langsamer', 'Der Empfänger stellt sich immer selbst ein', 'Der Sender schaltet sich ab'], 'Der Empfänger tastet zu früh oder zu spät ab und liest falsche Bitwerte. Oft passt dann auch das Stoppbit nicht: Rahmenfehler.', ['Wann tastet der Empfänger ein Bit ab?', 'Was geschieht, wenn der Zeitraster nicht passt?']],
    ['Wozu dient das Stoppbit?', 'Es bringt die Leitung wieder auf hoch, danach ist ein neues Startbit erkennbar', ['Es zählt die Datenbits', 'Es schützt die Daten durch eine Prüfsumme', 'Es gibt die Baudrate an'], 'Das Stoppbit hat hohen Pegel. So gibt es vor dem nächsten Startbit immer eine fallende Flanke.', ['Welcher Pegel ist der Ruhepegel?', 'Das nächste Startbit braucht eine fallende Flanke.']],
    ['Was bedeutet die Schreibweise 8N1?', '8 Datenbits, keine Parität (None), 1 Stoppbit', ['8 Stoppbits, 1 Datenbit, keine Parität', '8 Datenbits, gerade Parität, 1 Stoppbit', '8 Teilnehmer, 1 Master, kein Slave'], 'Die Zahlen nennen Datenbits und Stoppbits, der Buchstabe die Parität: N keine, E gerade (even), O ungerade (odd).', ['Die erste Zahl sind die Datenbits.', 'N steht für None.']]
  ];
  const UARTQ_STEPS = ['Lies die Frage und denke an das Bild eines UART-Rahmens: Ruhepegel, Startbit, Datenbits, Parität, Stoppbit.', 'Streiche Antworten, die zu einer Taktleitung oder zu einem Master gehören. Eine UART hat beides nicht.', 'Wähle die Antwort, die zum Rahmen passt.'];
  const A = {
    bitzeit(R) {
      const baud = C().pick(R, BAUD), v = 1e6 / baud;
      return numQ('Eine UART läuft mit ' + f(baud, 0) + ' Baud (hier gleich ' + f(baud, 0) + ' Bit pro Sekunde). Wie lang dauert ein einzelnes Bit?', v, 'µs', 'Bitzeit', tol(v),
        '1 Baud = 1 Bit pro Sekunde. Bitzeit = 1 / Baudrate = 1 / ' + f(baud, 0) + ' s = ' + f(v, 2) + ' µs.',
        ['Die Bitzeit ist der Kehrwert der Baudrate.', 'Rechne 1 durch ' + f(baud, 0) + ' und gib das Ergebnis in µs an (1 s = 1.000.000 µs).'],
        ['Schreibe die Baudrate als Bit pro Sekunde.', 'Bilde den Kehrwert: Bitzeit = 1 / Baudrate.', 'Rechne das Ergebnis in µs um.'],
        { img: { k: 'uart', byte: 85, d: 8, par: 'N', stop: 1, baud, zeit: false } });
    },
    rahmenbits(R) {
      const c = randCfg(R), n = C().frameBits(c.d, c.par, c.stop);
      return numQ('Eine serielle Schnittstelle ist auf ' + cfgTxt(c.d, c.par, c.stop) + ' eingestellt. Wie viele Bit hat ein Rahmen vom Startbit bis zum letzten Stoppbit?', n, 'Bit', 'Bits je Rahmen', 0,
        '1 Startbit + ' + c.d + ' Datenbits' + (c.par === 'N' ? '' : ' + 1 Paritätsbit') + ' + ' + c.stop + ' Stoppbit' + (c.stop > 1 ? 's' : '') + ' = ' + f(n, 0) + ' Bit.',
        ['Zähle alle Bestandteile des Rahmens zusammen.', 'Das Startbit ist immer dabei, das Paritätsbit nur bei gerader oder ungerader Parität.'],
        ['Schreibe auf: Startbit, Datenbits, Paritätsbit (ja oder nein), Stoppbits.', 'Addiere alle Bits.']);
    },
    rahmenzeit(R) {
      const baud = C().pick(R, BAUD), c = randCfg(R), n = C().frameBits(c.d, c.par, c.stop), v = C().frameTime(baud, c.d, c.par, c.stop) * 1000;
      return numQ('Eine UART sendet mit ' + f(baud, 0) + ' Baud und ' + cfgTxt(c.d, c.par, c.stop) + '. Wie lange dauert die Übertragung eines Zeichens (ein Rahmen)?', v, 'ms', 'Rahmendauer', tol(v),
        'Rahmen = ' + f(n, 0) + ' Bit. Bitzeit = 1 / ' + f(baud, 0) + ' s. Rahmendauer = ' + f(n, 0) + ' / ' + f(baud, 0) + ' s = ' + f(v, 2) + ' ms.',
        ['Erst die Bits je Rahmen zählen, dann mit der Bitzeit malnehmen.', 'Rahmendauer = Bits je Rahmen / Baudrate.'],
        ['Bits je Rahmen zählen (Start, Daten, Parität, Stopp).', 'Mit der Bitzeit 1 / Baudrate malnehmen.', 'Ergebnis in ms angeben.'],
        { img: { k: 'uart', byte: 65, d: c.d, par: c.par, stop: c.stop, baud, zeit: false } });
    },
    nettorate(R) {
      const baud = C().pick(R, BAUD.slice(3)), c = randCfg(R), n = C().frameBits(c.d, c.par, c.stop), v = C().netRate(baud, c.d, c.par, c.stop);
      return numQ('Eine UART läuft mit ' + f(baud, 0) + ' Baud und ' + cfgTxt(c.d, c.par, c.stop) + '. Wie viele Datenbits kommen pro Sekunde tatsächlich an (Nutzdatenrate, ohne Start-, Paritäts- und Stoppbits)?', v, 'bit/s', 'Nutzdatenrate', tol(v),
        'Je Rahmen mit ' + f(n, 0) + ' Bit sind ' + c.d + ' Bit Nutzdaten. Nutzdatenrate = ' + f(baud, 0) + ' · ' + c.d + ' / ' + f(n, 0) + ' = ' + f(v, 2) + ' bit/s.',
        ['Nur ein Teil der Bits eines Rahmens sind Daten.', 'Nutzdatenrate = Baudrate · Datenbits / Bits je Rahmen.'],
        ['Bits je Rahmen zählen.', 'Anteil der Datenbits bilden: Datenbits / Bits je Rahmen.', 'Mit der Baudrate malnehmen.']);
    },
    paritaet(R) {
      const C0 = C(); let v = C0.ri(R, 1, 127); while (C0.onesCount(v, 7) === 0) v = C0.ri(R, 1, 127);
      const mode = C0.pick(R, ['E', 'O']), w = mode === 'E' ? 'gerade' : 'ungerade', b = C0.parityBit(v, 7, mode), k = C0.onesCount(v, 7);
      const ja = 'erst mit dem Paritätsbit ist die Zahl der Einsen ' + w, schon = 'die Zahl der Einsen ist schon ' + w, anders = mode === 'E' ? 'ungerade' : 'gerade';
      const right = b ? '1, denn ' + ja : '0, denn ' + schon;
      const wrong = [b ? '0, denn ' + schon : '1, denn ' + ja, '0, denn erst mit dem Paritätsbit ist die Zahl der Einsen ' + anders, '1, denn die Zahl der Einsen ist schon ' + anders];
      return choiceQ(R, 'Ein Zeichen wird mit 7 Datenbits gesendet: D6 bis D0 = ' + bin(v, 7) + ' (links das höchstwertige Bit). Es wird ' + w + ' Parität verwendet. Welches Paritätsbit wird gesendet?', right, wrong,
        'Im Datenwort stehen ' + k + ' Einsen. Bei ' + w + 'r Parität soll die Zahl der Einsen einschließlich Paritätsbit ' + w + ' sein. Das Paritätsbit ist also ' + b + '.',
        ['Zähle zuerst die Einsen im Datenwort.', 'Das Paritätsbit ergänzt die Einsen so, dass die Gesamtzahl ' + w + ' wird.'],
        ['Einsen im Datenwort zählen.', 'Prüfen: Ist die Zahl schon ' + w + '?', 'Wenn ja: Paritätsbit 0. Wenn nein: Paritätsbit 1.']);
    },
    /* PRUEFEN P7: Abtastversatz (siehe P1) als Faustwert; reale Empfänger tasten oft mehrfach ab */
    abtast(R) {
      const x = C().pick(R, [1, 2, 3, 4, 5, 6]), v = C().abtastVersatz(10, x) * 100;
      return numQ('Ein Empfänger tastet jedes Bit in der Mitte ab. Seine Baudrate weicht um ' + x + ' % von der des Senders ab. Der Rahmen hat 10 Bit (8N1). Um wie viel Prozent einer Bitzeit ist der Abtastpunkt des letzten Bits verschoben? Bis zur Mitte des Stoppbits vergehen 9,5 Bitzeiten.', v, '% einer Bitzeit', 'Versatz', 0.05,
        'Versatz = 9,5 Bitzeiten · ' + x + ' % = ' + f(v, 1) + ' % einer Bitzeit. Erst über 50 % liest der Empfänger das Nachbarbit.',
        ['Der Fehler summiert sich über 9,5 Bitzeiten.', 'Versatz = 9,5 · Abweichung (in Prozent einer Bitzeit).'],
        ['Zeit bis zur Mitte des letzten Bits notieren: 9,5 Bitzeiten.', 'Mit der Abweichung malnehmen.', 'Ergebnis in Prozent einer Bitzeit angeben.']);
    },
    uartq: pq(UARTQ, UARTQ_STEPS),
    ascii(R) {
      let code, b8, rev, set;
      do {
        code = C().ri(R, 65, 90); b8 = bin(code, 8); rev = b8.split('').reverse().join('');
        const inv = s => s.split('').map(x => 1 - x).join(''); set = [rev, b8, inv(rev), inv(b8)];
      } while (new Set(set).size < 4);
      return choiceQ(R, 'Das Zeichen „' + String.fromCharCode(code) + '“ hat den ASCII-Code ' + code + ', binär ' + b8 + ' (D7 bis D0). Welche Bitfolge der Datenbits läuft bei einer UART auf der Leitung? Das zuerst gesendete Bit steht links, Start-, Paritäts- und Stoppbit sind nicht mitgezählt, hoher Pegel ist 1.', rev, set.slice(1),
        'Eine UART sendet D0 zuerst. ' + b8 + ' von hinten gelesen ergibt ' + rev + '.',
        ['Das niederwertigste Bit kommt zuerst.', 'Lies die Binärzahl von rechts nach links.'],
        ['Binärzahl aufschreiben und D0 (ganz rechts) markieren.', 'Von D0 bis D7 aufschreiben.', 'Die passende Bitfolge wählen.']);
    }
  };

  /* ============================================================ RS-232 und RS-485 */
  /* PRUEFEN P8: RS-232 Pegel (etwa ±3 V bis ±15 V, 1 = negativ), RS-485 differenziell, bis etwa 1.200 m, 32 Standardlasten nur als Auswahlfragen */
  const RSQ = [
    ['Auf welchem Pegel liegt eine RS-232-Leitung im Ruhezustand (logisch 1)?', 'Auf einer negativen Spannung, etwa −3 V bis −15 V', ['Auf 0 V', 'Auf +5 V', 'Auf einer positiven Spannung, etwa +3 V bis +15 V'], 'Bei RS-232 ist logisch 1 eine negative Spannung und logisch 0 eine positive Spannung, jeweils mindestens 3 V vom Nullpegel entfernt.', ['Der Ruhepegel ist logisch 1 (wie bei der UART).', 'RS-232 verwendet Spannungen beider Vorzeichen.']],
    ['Warum braucht ein Controller mit 3,3-V-UART für RS-232 einen Pegelwandler?', 'RS-232 nutzt Spannungen von etwa ±3 V bis ±15 V, die der Controller nicht erzeugt und nicht verträgt', ['RS-232 ist viel langsamer als die UART', 'Der Wandler erzeugt die Baudrate', 'RS-232 braucht zusätzlich eine Taktleitung'], 'Die UART im Controller arbeitet mit 0 V und 3,3 V. RS-232 verlangt größere Spannungen mit beiden Vorzeichen. Der Pegelwandler setzt um.', ['Vergleiche die Spannungen der beiden Schnittstellen.', 'Wer erzeugt negative Spannungen?']],
    ['Wie überträgt RS-485 ein Bit?', 'Als Spannungsunterschied zwischen den beiden Leitungen A und B', ['Als Spannung einer Leitung gegen Masse', 'Als Strom auf einer einzigen Leitung', 'Als Frequenz eines Trägers'], 'RS-485 arbeitet differenziell: Der Empfänger wertet nur die Spannung zwischen A und B aus.', ['Wie heißen die beiden Leitungen?', 'Differenziell heißt: Unterschied.']],
    ['Warum ist RS-485 störfester als RS-232 und für lange Leitungen geeignet?', 'Störungen wirken auf beide Leitungen gleich, der Empfänger wertet nur die Differenz aus', ['Es nutzt 230 V Spannung', 'Es sendet jedes Bit doppelt', 'Es braucht keine Leitung'], 'Eine Störung, die auf A und B gleich wirkt, kürzt sich in der Differenz heraus. Verdrillte Leitungen verstärken das.', ['Was passiert mit einer Störung, die beide Leitungen gleich trifft?', 'Differenz bilden.']],
    ['Was bedeutet Halbduplex bei einem RS-485-Bus mit einem Leitungspaar?', 'Immer nur ein Teilnehmer sendet, die anderen hören zu', ['Alle Teilnehmer senden gleichzeitig', 'Die Daten laufen nur in eine Richtung', 'Es gibt nur zwei Teilnehmer'], 'Alle Teilnehmer teilen sich dasselbe Leitungspaar. Der Master regelt, wer wann sendet. Gesendet wird abwechselnd.', ['Wie viele Leitungspaare gibt es?', 'Zwei Sender gleichzeitig würden sich stören.']],
    ['Wo gehören die Abschlusswiderstände einer RS-485-Linie hin?', 'An beide Enden der Leitung', ['An jeden Teilnehmer', 'Nur an den Master', 'In die Mitte der Leitung'], 'Die Widerstände sitzen an den beiden Leitungsenden und entsprechen dem Wellenwiderstand (typisch 120 Ω). Teilnehmer in der Mitte bekommen keinen.', ['Wo reflektiert ein Signal?', 'Wie viele Enden hat eine Linie?']],
    ['Wie wird ein RS-485-Bus verdrahtet?', 'Als Linie, die Stiche zu den Teilnehmern sind möglichst kurz', ['Als Stern mit langen Abzweigen', 'Als Ring ohne Anfang und Ende', 'Jeder Teilnehmer mit jedem'], 'Eine Linie hat zwei Enden, an denen terminiert wird. Sterne und lange Stiche erzeugen zusätzliche Reflexionen.', ['Wie viele Enden brauchst du für den Abschluss?', 'Was machen lange Abzweige mit dem Signal?']],
    ['Was geschieht auf einem langen RS-485-Bus ohne Abschluss bei schnellen Flanken?', 'Das Signal wird am offenen Ende reflektiert, es entstehen Überschwinger und Bitfehler', ['Das Signal wird nur kleiner', 'Der Bus passt die Baudrate selbst an', 'Nichts, der Strom steigt nur'], 'Am offenen Ende kehrt die Welle um und überlagert das nächste Signal. Das nennt man Reflexion.', ['Was macht eine Welle am offenen Ende?', 'Probier es im Reiter RS-485 aus.']]
  ];
  const RSQ_STEPS = ['Lies die Frage und überlege, was bei RS-232 und bei RS-485 gleich und was anders ist.', 'Denke an Pegel, Leitungspaar und Abschluss.', 'Wähle die Antwort, die genau zur Frage passt.'];
  const B = {
    rsq: pq(RSQ, RSQ_STEPS),
    parab(R) {
      const rt = C().pick(R, [100, 120, 150]), v = rt / 2;
      return numQ('Ein RS-485-Bus ist an beiden Enden mit je ' + f(rt, 0) + ' Ω abgeschlossen. Das Gerät ist spannungslos, Teilnehmer bleiben außer Acht. Welchen Widerstand misst du zwischen A und B?', v, 'Ω', 'Widerstand A-B', 0.01,
        '1 / R = 1 / ' + f(rt, 0) + ' Ω + 1 / ' + f(rt, 0) + ' Ω = 2 / ' + f(rt, 0) + ' Ω. R = ' + f(v, 2) + ' Ω.',
        ['Die beiden Widerstände liegen parallel.', 'Bei gleichen Widerständen ist das Ergebnis die Hälfte.'],
        ['Zeichne beide Widerstände zwischen A und B.', 'Addiere die Kehrwerte: 1 / R = 1 / R1 + 1 / R2.', 'Bilde den Kehrwert der Summe.'],
        { img: { k: 'rs', term: 'both', rt } });
    },
    parab3(R) {
      const n = C().pick(R, [4, 8, 16, 32]), v = C().parR(120, 120, 12000 / n);
      return numQ('Am abgeschalteten RS-485-Bus hängen ' + n + ' Empfänger, jeder mit 12 kΩ Eingangswiderstand zwischen A und B. Dazu kommen zwei Abschlusswiderstände von je 120 Ω. Welchen Gesamtwiderstand misst du zwischen A und B?', v, 'Ω', 'Gesamtwiderstand', tol(v),
        '1 / R = 1 / 120 Ω + 1 / 120 Ω + ' + n + ' / 12.000 Ω = ' + f(1 / v, 5) + ' 1/Ω. R = ' + f(v, 2) + ' Ω.',
        ['Alle Widerstände liegen parallel. Die ' + n + ' Empfänger zählen als ' + n + ' gleiche Widerstände.', 'Rechne in Kehrwerten: Jeder Empfänger bringt 1 / 12.000 Ω.'],
        ['Die Kehrwerte der Abschlüsse addieren.', 'Die Kehrwerte der Empfänger addieren (Anzahl / 12.000 Ω).', 'Beides zusammenzählen und den Kehrwert bilden.']);
    },
    reflex(R) {
      const rl = C().pick(R, [60, 90, 150, 240, 360, 480]), g = Math.abs(C().reflexion(rl, 120)) * 100;
      return numQ('Eine Leitung hat 120 Ω Wellenwiderstand. An ihrem Ende sitzt ein Widerstand von ' + f(rl, 0) + ' Ω. Wie groß ist der Betrag des Reflexionsfaktors in Prozent? (Das Vorzeichen lässt du weg.)', g, '%', 'Reflexionsfaktor', tol(g),
        '|R − Z| / (R + Z) = |' + f(rl, 0) + ' − 120| / (' + f(rl, 0) + ' + 120) = ' + f(Math.abs(rl - 120), 0) + ' / ' + f(rl + 120, 0) + ' = ' + f(g, 2) + ' %.',
        ['Bei genau 120 Ω wäre die Reflexion null.', 'Reflexionsfaktor = (R − Z) / (R + Z), davon den Betrag.'],
        ['Unterschied zwischen Abschluss und Wellenwiderstand bilden (ohne Vorzeichen).', 'Durch die Summe beider Werte teilen.', 'Mit 100 malnehmen für Prozent.']);
    },
    laufz(R) {
      const l = C().pick(R, [50, 100, 200, 300, 600, 1000, 1200]), v = 2 * C().laufzeit(l) * 1e6;
      return numQ('Ein Signal braucht auf der Leitung 5 ns je Meter. Wie lange dauert der Hin- und Rückweg auf ' + f(l, 0) + ' m (so lange braucht eine Reflexion, bis sie wieder am Sender ist)?', v, 'µs', 'Hin und zurück', tol(v),
        'Einfacher Weg: ' + f(l, 0) + ' m · 5 ns/m = ' + f(l * 5 / 1000, 2) + ' µs. Hin und zurück: ' + f(v, 2) + ' µs.',
        ['Der Weg ist doppelt so lang wie die Leitung.', 'Länge · 5 ns/m · 2, dann in µs umrechnen (1000 ns = 1 µs).'],
        ['Laufzeit für den einfachen Weg berechnen.', 'Mit 2 malnehmen.', 'In µs umrechnen.']);
    },
    rslen(R) {
      const baud = C().pick(R, [9600, 19200, 38400, 115200]), l = C().pick(R, [100, 300, 600, 1200]), t = 2 * C().laufzeit(l), v = t / C().bitTime(baud) * 100;
      return numQ('Auf einer ' + f(l, 0) + ' m langen RS-485-Leitung (5 ns je Meter) wird mit ' + f(baud, 0) + ' Baud gesendet. Wie viel Prozent einer Bitzeit dauert der Hin- und Rückweg des Signals?', v, '%', 'Anteil an der Bitzeit', tol(v),
        'Hin und zurück: ' + f(l, 0) + ' m · 5 ns/m · 2 = ' + f(t * 1e6, 2) + ' µs. Bitzeit = 1 / ' + f(baud, 0) + ' s = ' + f(C().bitTime(baud) * 1e6, 2) + ' µs. Anteil = ' + f(t * 1e6, 2) + ' / ' + f(C().bitTime(baud) * 1e6, 2) + ' = ' + f(v, 2) + ' %.',
        ['Rechne beide Zeiten in µs.', 'Anteil = Laufzeit hin und zurück / Bitzeit · 100.'],
        ['Hin- und Rücklaufzeit berechnen.', 'Bitzeit berechnen.', 'Beide durcheinander teilen und mit 100 malnehmen.']);
    }
  };

  /* ============================================================ CAN-Bus */
  const CANQ = [
    ['Was bedeutet „dominant“ beim CAN-Bus?', 'Ein dominanter Pegel (logisch 0) setzt sich gegen einen gleichzeitig gesendeten rezessiven durch', ['Der Knoten ist der Master des Busses', 'Der Bus ist ausgefallen', 'Das Signal ist schneller'], 'Senden zwei Knoten gleichzeitig, gewinnt auf der Leitung der dominante Pegel (0). Der rezessive Pegel (1) wird überschrieben.', ['Dominant gegen rezessiv: Wer setzt sich durch?', 'Es gibt keinen Master bei CAN.']],
    ['Wie wird bei CAN entschieden, wessen Nachricht zuerst gesendet wird, wenn zwei Knoten gleichzeitig beginnen?', 'Die Nachricht mit der kleineren Kennung (ID) gewinnt', ['Die Nachricht mit der größeren ID gewinnt', 'Der Knoten mit der höheren Baudrate gewinnt', 'Der Knoten, der zuerst eingeschaltet wurde, gewinnt'], 'Die ID wird mit dem höchstwertigen Bit zuerst gesendet. Die erste 0 gegen eine 1 gewinnt: Die kleinere ID hat Vorrang (Arbitrierung).', ['Dominant ist 0.', 'Eine 0 setzt sich gegen eine 1 durch.']],
    ['Wofür steht die Kennung (ID) einer CAN-Nachricht?', 'Für den Inhalt und die Priorität der Nachricht, nicht für ein Zielgerät', ['Für die Adresse des Empfängers', 'Für die Baudrate', 'Für die Länge der Leitung'], 'CAN ist nachrichtenorientiert: Die ID sagt, was die Nachricht bedeutet. Jeder Knoten entscheidet selbst, ob ihn die Nachricht interessiert.', ['Gibt es bei CAN Empfängeradressen?', 'Die ID legt auch die Priorität fest.']],
    ['Was passiert mit dem Knoten, der die Arbitrierung verliert?', 'Er hört auf zu senden, liest die Nachricht des Gewinners mit und sendet später erneut', ['Er sendet seine Nachricht trotzdem weiter', 'Er schaltet sich dauerhaft ab', 'Die Nachricht des Gewinners geht verloren'], 'Der Verlierer merkt, dass der Bus dominant ist, obwohl er rezessiv sendet. Er wird zum Empfänger. Die Nachricht des Gewinners bleibt unbeschädigt.', ['Beim Verlierer wird nichts zerstört.', 'Der Gewinner wird nicht gestört.']],
    ['Wie viele Nutzdatenbytes enthält ein klassischer CAN-Rahmen höchstens?', '8 Byte', ['64 Byte', '1 Byte', '256 Byte'], 'Beim klassischen CAN stehen im Datenfeld 0 bis 8 Byte. Erst CAN FD erlaubt bis zu 64 Byte.', ['Es steht ein „klassisch“ in der Frage.', 'Denke an die Länge eines Datenfelds mit 4 Bit Längenangabe.']],
    ['Wozu dient der ACK-Slot im CAN-Rahmen?', 'Jeder Empfänger, der den Rahmen fehlerfrei erhalten hat, überschreibt ihn mit einem dominanten Bit', ['Der Sender trägt hier die Adresse des Empfängers ein', 'Hier steht die Prüfsumme', 'Hier steht die Länge der Daten'], 'Der Sender sendet an dieser Stelle rezessiv. Hört er dominant, hat mindestens ein Knoten den Rahmen richtig gelesen.', ['ACK heißt Bestätigung.', 'Wer bestätigt: Sender oder Empfänger?']],
    ['Welche Leitungen hat ein CAN-Bus für die Signale?', 'Zwei verdrillte Leitungen CAN_H und CAN_L (differenziell)', ['Eine Datenleitung und eine Taktleitung', 'Drei Leitungen: TxD, RxD und GND', 'Je eine Leitung pro Teilnehmer'], 'CAN überträgt differenziell über CAN_H und CAN_L. Die Leitungen sind verdrillt und an beiden Enden mit 120 Ω abgeschlossen.', ['Wie heißen die Leitungen im Namen?', 'Es gibt keine Taktleitung.']]
  ];
  const CANQ_STEPS = ['Lies die Frage und denke an Rahmen, ID und Pegel.', 'Merke: dominant ist 0, rezessiv ist 1, die kleinere ID hat Vorrang.', 'Wähle die Antwort, die dazu passt.'];
  /* PRUEFEN P9: Messung am abgeschalteten CAN-Bus zwischen CAN_H und CAN_L: etwa 60 Ω in Ordnung, 120 Ω ein Abschluss fehlt, 40 Ω ein dritter Abschluss */
  const CANFEHL = [
    ['Du misst am abgeschalteten CAN-Bus zwischen CAN_H und CAN_L etwa 60 Ω. Was bedeutet das?', 'Beide Abschlusswiderstände sind vorhanden, alles in Ordnung', ['Ein Abschlusswiderstand fehlt', 'Es sind drei Abschlusswiderstände eingebaut', 'CAN_H und CAN_L sind kurzgeschlossen'], 'Zwei Widerstände von 120 Ω parallel ergeben 1 / (1/120 + 1/120) = 60 Ω.', ['Rechne mit Kehrwerten: Zwei gleiche Widerstände parallel.', '120 Ω halbiert ergibt?']],
    ['Du misst am abgeschalteten CAN-Bus zwischen CAN_H und CAN_L etwa 120 Ω. Was ist die wahrscheinlichste Ursache?', 'Ein Abschlusswiderstand fehlt oder eine Leitung ist unterbrochen', ['Alles ist in Ordnung', 'Ein dritter Abschlusswiderstand ist eingebaut', 'CAN_H und CAN_L sind kurzgeschlossen'], 'Soll sind 60 Ω. Misst du genau einen Abschlusswiderstand (120 Ω), fehlt der andere oder der Weg dorthin ist unterbrochen.', ['Wie viel Ohm erwartest du bei zwei Abschlüssen?', 'Ein einzelner Abschluss sind 120 Ω.']],
    ['Du misst am abgeschalteten CAN-Bus zwischen CAN_H und CAN_L etwa 40 Ω. Was ist die wahrscheinlichste Ursache?', 'Ein dritter Abschlusswiderstand ist eingebaut', ['Ein Abschlusswiderstand fehlt', 'Alles ist in Ordnung', 'Eine Leitung ist unterbrochen'], 'Drei Widerstände von 120 Ω parallel ergeben 120 Ω / 3 = 40 Ω. Es gehören nur zwei an die Enden.', ['Wie viele Widerstände von 120 Ω ergeben parallel 40 Ω?', 'Teile 120 Ω durch die Anzahl.']],
    ['Du misst am abgeschalteten CAN-Bus zwischen CAN_H und CAN_L nahezu 0 Ω. Was ist die wahrscheinlichste Ursache?', 'CAN_H und CAN_L sind kurzgeschlossen', ['Ein Abschlusswiderstand fehlt', 'Alles ist in Ordnung', 'Es sind drei Abschlusswiderstände eingebaut'], 'Selbst mehrere Abschlusswiderstände parallel bleiben deutlich über 0 Ω. Nahezu 0 Ω heißt Kurzschluss.', ['Wie klein können parallele 120-Ω-Widerstände werden?', 'Ein Kurzschluss hat fast keinen Widerstand.']]
  ];
  const CANFEHL_STEPS = ['Rechne den Sollwert bei zwei Abschlusswiderständen: 120 Ω parallel zu 120 Ω.', 'Vergleiche deinen Messwert mit dem Sollwert und rechne nach, wie viele Widerstände zum Messwert passen.', 'Wähle die zugehörige Ursache.'];
  const Cp = {
    canarb(R) {
      const C0 = C(), ids = []; while (ids.length < 3) { const x = C0.ri(R, 1, 2047); if (!ids.includes(x)) ids.push(x); }
      const a = C0.arbitrate(ids, 11), N = ['Knoten A', 'Knoten B', 'Knoten C'];
      return choiceQ(R, 'Drei CAN-Knoten beginnen gleichzeitig zu senden. Die 11-Bit-IDs sind: A = ' + f(ids[0], 0) + ', B = ' + f(ids[1], 0) + ', C = ' + f(ids[2], 0) + '. Wer gewinnt die Arbitrierung?', N[a.winner], N.filter((_, i) => i !== a.winner),
        'Das erste dominante Bit (0) entscheidet. Verlierer hören auf. Es gewinnt die kleinste ID: ' + N[a.winner] + ' mit ' + f(ids[a.winner], 0) + '.',
        ['Dominant ist 0: Wer zuerst eine 0 hat, während andere eine 1 senden, gewinnt.', 'Es gewinnt der Knoten mit der kleinsten ID.'],
        ['Die IDs untereinander als 11-Bit-Zahlen aufschreiben (oder das Bild lesen).', 'Von links Bit für Bit vergleichen. Wer 1 sendet, während ein anderer 0 sendet, scheidet aus.', 'Der letzte übrige Knoten gewinnt.'],
        { img: { k: 'can', ids, quiz: true } });
    },
    canbit(R) {
      const C0 = C(), k = C0.ri(R, 1, 8), pre = C0.ri(R, 0, Math.pow(2, k) - 1), rest = 10 - k, mk = bit => (pre << (11 - k)) | (bit << rest) | C0.ri(R, 0, Math.pow(2, rest) - 1);
      const lo = mk(0), hi = mk(1), swap = R() < 0.5, ids = swap ? [hi, lo] : [lo, hi], a = C0.arbitrate(ids, 11), loser = 1 - a.winner, N = ['A', 'B'];
      return numQ('Zwei CAN-Knoten senden gleichzeitig: Knoten A mit ID ' + f(ids[0], 0) + ' und Knoten B mit ID ' + f(ids[1], 0) + ' (11 Bit). Bei dem wievielten ID-Bit gibt der Verlierer auf? Das zuerst gesendete ID-Bit zählt als Bit 1.', a.lost[loser] + 1, 'Bit', 'Nummer des Bits', 0,
        'Die IDs stimmen in den ersten ' + k + ' Bits überein. Im ' + (k + 1) + '. Bit sendet Knoten ' + N[loser] + ' eine 1, der andere eine 0. Der Bus ist dominant (0), Knoten ' + N[loser] + ' hört auf: Bit ' + (k + 1) + '.',
        ['Vergleiche beide IDs von links, bis sie sich unterscheiden.', 'An der ersten Stelle mit Unterschied scheidet der aus, der die 1 sendet.'],
        ['Beide IDs als 11-Bit-Zahlen untereinander aufschreiben (oder das Bild lesen).', 'Von links die erste Stelle suchen, an der sich die Bits unterscheiden.', 'Die Nummer dieser Stelle ist die Antwort. Wer dort 1 sendet, ist der Verlierer.'],
        { img: { k: 'can', ids, quiz: true } });
    },
    canrahmen(R) {
      const rate = C().pick(R, [125, 250, 500, 1000]), n = C().ri(R, 1, 8), bits = C().canFrameBits(n), v = bits / (rate * 1000) * 1e6;
      return numQ('Ein klassischer CAN-Rahmen mit 11-Bit-ID hat 47 Bit Verwaltung und Pause plus 8 Bit je Datenbyte (Stopfbits nicht mitgezählt). Der Bus läuft mit ' + f(rate, 0) + ' kbit/s, der Rahmen enthält ' + n + ' Datenbyte' + (n > 1 ? 's' : '') + '. Wie lange dauert er?', v, 'µs', 'Rahmendauer', tol(v),
        'Bits: 47 + 8 · ' + n + ' = ' + f(bits, 0) + '. Bitzeit = 1 / ' + f(rate, 0) + ' kbit/s. Dauer = ' + f(bits, 0) + ' / ' + f(rate, 0) + ' kbit/s = ' + f(v, 2) + ' µs.',
        ['Erst die Bits des Rahmens zählen.', 'Dauer = Bits / Bitrate. Bei kbit/s kommt die Zeit in ms heraus, mal 1000 ergibt µs.'],
        ['Bits im Rahmen berechnen: 47 + 8 · Datenbytes.', 'Durch die Bitrate teilen.', 'Ergebnis in µs angeben.']);
    },
    cannutz(R) {
      const n = C().pick(R, [1, 2, 4, 6, 8]), v = C().canNutz(n);
      return numQ('Ein klassischer CAN-Rahmen hat 47 Bit Verwaltung und Pause plus 8 Bit je Datenbyte (ohne Stopfbits). Wie viel Prozent der Bits des Rahmens sind Nutzdaten, wenn ' + n + ' Datenbyte' + (n > 1 ? 's' : '') + ' gesendet werden?', v, '%', 'Nutzdatenanteil', tol(v),
        'Nutzbits: 8 · ' + n + ' = ' + f(8 * n, 0) + '. Rahmen: ' + f(C().canFrameBits(n), 0) + ' Bit. Anteil = ' + f(8 * n, 0) + ' / ' + f(C().canFrameBits(n), 0) + ' = ' + f(v, 2) + ' %.',
        ['Nutzbits durch alle Bits des Rahmens.', 'Mit 100 malnehmen für Prozent.'],
        ['Nutzbits berechnen: 8 · Datenbytes.', 'Alle Bits des Rahmens berechnen: 47 + Nutzbits.', 'Teilen und mit 100 malnehmen.']);
    },
    canlen(R) {
      const l = C().pick(R, [30, 80, 200, 400]), rate = C().canMaxRate(l), N = { 1000: '1 Mbit/s', 500: '500 kbit/s', 250: '250 kbit/s', 125: '125 kbit/s' };
      return choiceQ(R, 'Ein CAN-Bus ist ' + l + ' m lang. Welche ist nach den Faustwerten die höchste Bitrate, die noch geht?', N[rate], Object.keys(N).filter(k => +k !== rate).map(k => N[k]),
        'Faustwerte: bis 40 m etwa 1 Mbit/s, bis 100 m etwa 500 kbit/s, bis 250 m etwa 250 kbit/s, bis 500 m etwa 125 kbit/s. Bei ' + l + ' m sind es ' + N[rate] + '.',
        ['Je länger die Leitung, desto langsamer muss der Bus sein.', 'Suche die kleinste Längenstufe, in die ' + l + ' m passen.'],
        ['Die Länge einer Stufe zuordnen: bis 40 m, 100 m, 250 m, 500 m.', 'Die zugehörige Bitrate nehmen.', 'Die Auswahl prüfen: Längere Strecke heißt kleinere Bitrate.']);
    },
    canq: pq(CANQ, CANQ_STEPS),
    canfehl: pq(CANFEHL, CANFEHL_STEPS)
  };

  /* ============================================================ USB, Ethernet und Modbus */
  /* PRUEFEN P10: USB (Host steuert, Baumstruktur, Enumeration, 5 V Versorgung) nur allgemein, keine Geschwindigkeitsstufen als Zahl */
  const USBQ = [
    ['Wer steuert bei USB den Datenverkehr?', 'Der Host: Ein Gerät sendet nur, wenn der Host es abfragt', ['Jedes Gerät sendet, wann es will', 'Der Hub allein', 'Das Gerät mit der kleinsten Adresse'], 'USB ist hostgesteuert. Der Host fragt die Geräte ab und teilt Zeit zu.', ['Wer ist der Master am Bus?', 'Geräte sprechen nur auf Anfrage.']],
    ['Was geschieht beim Anstecken eines USB-Geräts als Erstes?', 'Der Host erkennt es und fragt es ab (Enumeration), dann wird es konfiguriert', ['Das Gerät sendet sofort Daten', 'Der Benutzer stellt die Baudrate ein', 'Der Host schaltet die Versorgung ab'], 'Zuerst erkennt der Host das Gerät, vergibt eine Adresse, liest seine Beschreibung und lädt dazu den passenden Treiber.', ['Wie erfährt der Host, was für ein Gerät es ist?', 'Der Ablauf heißt Enumeration.']],
    ['Welche Spannung liefert ein klassischer USB-Anschluss (ohne Power Delivery) zur Versorgung?', '5 V', ['3,3 V', '12 V', '24 V'], 'Die Versorgung eines klassischen USB-Anschlusses beträgt 5 V.', ['Denke an das Ladegerät eines Smartphones.', 'Es ist eine Gleichspannung.']],
    ['Wie ist die USB-Topologie aufgebaut?', 'Als Baum: ein Host, darunter Hubs und Geräte', ['Als Ring', 'Als Linie mit Abschlusswiderständen', 'Jeder mit jedem'], 'USB bildet einen Baum mit dem Host als Wurzel. Hubs verzweigen.', ['Welche Rolle hat ein Hub?', 'Hat USB eine Linie mit Abschlüssen?']]
  ];
  /* PRUEFEN P11: Ethernet: 100 m Strecke auf Twisted Pair, MAC mit 48 Bit, CRC mit 32 Bit, Stern mit Switch */
  const ETHQ = [
    ['Wie lang darf eine Ethernet-Strecke auf Twisted-Pair-Kupferkabel höchstens sein?', 'Etwa 100 m', ['Etwa 10 m', 'Etwa 1.000 m', 'Etwa 10 km'], 'Für Twisted-Pair-Ethernet gilt eine Strecke von bis zu etwa 100 m zwischen zwei aktiven Geräten.', ['Es ist die bekannte Strecke einer Gebäudeverkabelung.', 'Nicht Glasfaser.']],
    ['Wie viele Bit hat eine MAC-Adresse?', '48 Bit (6 Byte)', ['32 Bit (4 Byte)', '128 Bit (16 Byte)', '8 Bit (1 Byte)'], 'Eine MAC-Adresse besteht aus 6 Byte, meist als sechs Zahlenpaare geschrieben.', ['Wie viele Zahlenpaare hat eine MAC-Adresse?', '32 Bit hat die IPv4-Adresse.']],
    ['Wofür nutzt ein Switch die MAC-Adressen?', 'Er leitet ein Paket nur an den Anschluss weiter, hinter dem der Empfänger liegt', ['Er schickt jedes Paket an alle Anschlüsse', 'Er vergibt die IP-Adressen', 'Er verschlüsselt die Daten'], 'Der Switch merkt sich, hinter welchem Anschluss welche MAC-Adresse erreichbar ist, und leitet gezielt weiter.', ['Was merkt sich der Switch?', 'Ein Hub würde an alle senden, ein Switch nicht.']],
    ['Welche Topologie wird bei Ethernet über Twisted Pair heute meist genutzt?', 'Stern mit einem Switch in der Mitte', ['Linie mit Abschlusswiderständen an beiden Enden', 'Ring ohne Switch', 'Bus mit Koaxialkabel'], 'Jedes Gerät hat ein eigenes Kabel zum Switch. Ein Bus mit Koaxialkabel gab es bei frühem Ethernet.', ['Wohin führt jedes Kabel?', 'Abschlusswiderstände gibt es hier nicht.']]
  ];
  /* PRUEFEN P12: Modbus TCP Port 502; im Antwortenpool stehen Port 80, 1883 und 4840 nur als falsche Antworten */
  const MODQ = [
    ['Auf welchem Port arbeitet Modbus TCP üblicherweise?', 'Port 502', ['Port 80', 'Port 1883', 'Port 4840'], 'Modbus TCP nutzt den Port 502. Port 80 ist HTTP, 1883 ist MQTT, 4840 ist OPC UA.', ['Es ist eine Zahl um 500.', 'Die Ports der anderen Antworten gehören zu anderen Diensten.']],
    ['Wie liegen die Daten bei Modbus im Gerät?', 'In Registern mit je 16 Bit, die über eine Adresse gelesen oder geschrieben werden', ['In Dateien mit Namen', 'In Datenbanktabellen mit SQL', 'In Registern mit je 64 Bit'], 'Ein Modbus-Register ist 16 Bit breit. Größere Werte belegen mehrere Register.', ['Wie breit ist ein Register?', 'Nicht Datei, nicht Datenbank.']],
    ['Welche Aufgabe hat bei Modbus RTU der Master?', 'Er sendet Anfragen, die Slaves antworten', ['Er wartet, bis die Slaves von selbst senden', 'Er misst nur den Bus', 'Er vergibt die Baudrate per Funk'], 'Modbus ist ein Anfrage-Antwort-Protokoll. Der Master fragt, ein Slave antwortet. Die Slaves senden nicht von sich aus.', ['Wer fängt immer an?', 'Slaves antworten nur.']],
    ['Wie sichert Modbus RTU die Telegramme auf der seriellen Leitung?', 'Mit einer 16-Bit-Prüfsumme (CRC-16) am Ende des Telegramms', ['Nur über das Stoppbit', 'Gar nicht, die Slaves prüfen nichts', 'Mit einer 32-Bit-CRC wie bei Ethernet'], 'Am Ende jedes RTU-Telegramms stehen zwei Byte CRC-16. Stimmt sie nicht, wird das Telegramm verworfen.', ['Wie viele Byte hat die Prüfsumme?', '32 Bit hat Ethernet.']],
    ['Wozu dient bei Modbus der Funktionscode?', 'Er sagt, was das Gerät tun soll, zum Beispiel Register lesen oder schreiben', ['Er gibt die Baudrate an', 'Er ist die Adresse des Slaves', 'Er enthält die Prüfsumme'], 'Der Funktionscode ist ein Byte im Telegramm. Er wählt die Aktion, etwa Register lesen (Code 3) oder schreiben.', ['Das Telegramm hat Adresse, Funktionscode, Daten, CRC.', 'Welche Rolle hat der Code zwischen Adresse und Daten?']]
  ];
  const D = {
    usbq: pq(USBQ, ['Lies die Frage und stelle dir einen PC mit einem USB-Stick vor.', 'Überlege, wer abfragt und wer antwortet.', 'Wähle die passende Antwort.']),
    ethq: pq(ETHQ, ['Lies die Frage und stelle dir ein Netzwerk im Büro vor: Rechner, Kabel, Switch.', 'Überlege, was zur Verkabelung und zu den Adressen gehört.', 'Wähle die passende Antwort.']),
    modq: pq(MODQ, ['Lies die Frage und denke an einen Master, der Slaves abfragt.', 'Ordne zu: Adresse, Funktionscode, Register, Prüfsumme.', 'Wähle die passende Antwort.']),
    dateimenge(R) {
      const mb = C().pick(R, [25, 50, 100, 250, 500, 1000]), rate = C().pick(R, [10, 100, 1000]), v = mb * 8 / rate;
      return numQ('Eine Datei mit ' + f(mb, 0) + ' MB wird über Ethernet mit ' + f(rate, 0) + ' Mbit/s übertragen. Wie lange dauert das im Idealfall, ohne Protokollaufwand? (1 Byte = 8 Bit)', v, 's', 'Übertragungszeit', tol(v),
        f(mb, 0) + ' MB · 8 = ' + f(mb * 8, 0) + ' Mbit. ' + f(mb * 8, 0) + ' Mbit / ' + f(rate, 0) + ' Mbit/s = ' + f(v, 2) + ' s.',
        ['Rechne die Datei erst in Bit um.', 'Zeit = Datenmenge in Mbit / Rate in Mbit/s.'],
        ['MB in Mbit umrechnen (mal 8).', 'Durch die Rate in Mbit/s teilen.', 'Ergebnis in Sekunden angeben.']);
    },
    sensorvol(R) {
      const by = C().pick(R, [2, 4, 6, 8, 12]), ms = C().pick(R, [50, 100, 200, 500, 1000]), perDay = by * 86400000 / ms, v = perDay / 1e6;
      return numQ('Ein Sensor sendet alle ' + f(ms, 0) + ' ms ein Telegramm mit ' + by + ' Byte Nutzdaten. Wie viele Megabyte fallen an einem Tag an? (1 MB = 1.000.000 Byte, 1 Tag = 86.400 s)', v, 'MB', 'Datenmenge je Tag', 0.01,
        'Telegramme je Tag: 86.400.000 ms / ' + f(ms, 0) + ' ms = ' + f(86400000 / ms, 0) + '. Byte je Tag: ' + f(86400000 / ms, 0) + ' · ' + by + ' = ' + f(perDay, 0) + ' Byte = ' + f(v, 2) + ' MB.',
        ['Erst ausrechnen, wie viele Telegramme an einem Tag gesendet werden.', 'Mit den Bytes je Telegramm malnehmen und durch 1.000.000 teilen.'],
        ['Telegramme je Tag: 86.400 s in ms durch die Sendezeit teilen.', 'Mit den Bytes je Telegramm malnehmen.', 'Durch 1.000.000 für Megabyte teilen.']);
    },
    mbreg(R) {
      const raw = C().ri(R, 100, 899), v = raw / 10;
      return numQ('Ein Temperaturfühler liefert über Modbus ein Register mit einer ganzen Zahl in Einheiten von 0,1 °C. Das Register enthält ' + f(raw, 0) + '. Welche Temperatur ist das?', v, '°C', 'Temperatur', 0.01,
        f(raw, 0) + ' · 0,1 °C = ' + f(v, 1) + ' °C.',
        ['Ein Register enthält nur ganze Zahlen. Die Kommastelle steckt im Faktor.', 'Wert mal 0,1 °C.'],
        ['Den Faktor aus der Aufgabe ablesen: 0,1 °C je Zähler.', 'Registerwert mit dem Faktor malnehmen.']);
    },
    /* PRUEFEN P6: Modbus RTU mit 11 Bit je Byte (Start, 8 Daten, Parität, Stopp), Funktion 3: Anfrage 8 Byte, Antwort 5 Byte plus 2 je Register, ohne Pausen von 3,5 Zeichen */
    modrtu(R) {
      const n = C().pick(R, [1, 2, 4, 10, 20]), baud = C().pick(R, [9600, 19200]), by = 8 + 5 + 2 * n, v = by * 11 / baud * 1000;
      return numQ('Ein Modbus-RTU-Master liest ' + n + ' Register (Funktion 3). Die Anfrage hat 8 Byte, die Antwort 5 Byte plus 2 Byte je Register. Jedes Byte wird mit 11 Bit gesendet (Start, 8 Daten, Parität, Stopp). Die Baudrate ist ' + f(baud, 0) + '. Wie lange dauern Anfrage und Antwort zusammen, ohne Wartezeiten?', v, 'ms', 'Gesamtdauer', tol(v),
        'Antwort: 5 + 2 · ' + n + ' = ' + f(5 + 2 * n, 0) + ' Byte. Zusammen ' + f(by, 0) + ' Byte = ' + f(by * 11, 0) + ' Bit. ' + f(by * 11, 0) + ' / ' + f(baud, 0) + ' s = ' + f(v, 2) + ' ms.',
        ['Zähle zuerst alle Byte von Anfrage und Antwort.', 'Mal 11 Bit je Byte, durch die Baudrate teilen.'],
        ['Byte der Antwort berechnen: 5 + 2 · Register.', 'Alle Byte addieren und mit 11 Bit je Byte in Bit umrechnen.', 'Durch die Baudrate teilen, in ms angeben.']);
    }
  };

  /* ============================================================ Funk und Pegel */
  /* PRUEFEN P13: Funk: 868 MHz reicht weiter als 2,4 GHz, LoRa Kilometer, BLE wenige Meter, NFC wenige Zentimeter (Faustaussagen) */
  const FUNKA = [
    ['Ein Batteriesensor soll im Gelände über einige Kilometer selten kleine Messwerte melden. Welche Funktechnik passt am besten?', 'LoRa (Weitbereichsfunk für kleine Datenmengen)', ['Bluetooth Low Energy', 'WLAN', 'NFC'], 'LoRa erreicht bei sehr kleiner Datenrate große Reichweiten bei geringem Stromverbrauch.', ['Entscheidend sind Reichweite und Datenmenge.', 'Wenige Meter reichen nicht.']],
    ['Ein Fitnessarmband koppelt sich mit dem Smartphone auf wenige Meter. Welche Funktechnik passt?', 'Bluetooth Low Energy', ['LoRa', 'Mobilfunk', 'Richtfunk'], 'Bluetooth Low Energy überbrückt wenige Meter bei geringer Leistungsaufnahme.', ['Die Entfernung beträgt wenige Meter.', 'Stromsparen ist wichtig.']],
    ['Eine Kamera in der Halle schickt Video mit hoher Datenrate ins Netzwerk. Welche Funktechnik passt?', 'WLAN', ['LoRa', 'NFC', 'Bluetooth Low Energy'], 'Video braucht hohe Datenraten. Dafür ist WLAN geeignet.', ['Welche Technik hat die höchste Datenrate?', 'LoRa ist sehr langsam.']],
    ['Ein Zugangssystem liest einen Ausweis nur wenige Zentimeter vor dem Leser. Welche Technik wird genutzt?', 'NFC', ['LoRa', 'WLAN', 'Mobilfunk'], 'NFC arbeitet nur im Zentimeterbereich. Das ist gewollt, damit nur gezielt gelesen wird.', ['Wie groß ist die Reichweite?', 'Wenige Zentimeter.']]
  ];
  const FUNKB = [
    ['Wie ändert sich die Leistung bei +3 dB?', 'Sie verdoppelt sich etwa', ['Sie steigt um 3 mW', 'Sie wird zehnmal so groß', 'Sie halbiert sich'], '+3 dB entsprechen etwa dem Faktor 2 in der Leistung, +10 dB dem Faktor 10.', ['Merke: +3 dB ungefähr Faktor 2.', 'Dezibel sind Verhältnisse, keine Differenzen in mW.']],
    ['Wie ändert sich die Leistung bei −10 dB?', 'Sie sinkt auf ein Zehntel', ['Sie sinkt auf die Hälfte', 'Sie sinkt um 10 mW', 'Sie sinkt auf ein Hundertstel'], '−10 dB entsprechen dem Faktor 0,1. Bei −20 dB wäre es ein Hundertstel.', ['10 dB sind der Faktor 10.', 'Minus bedeutet kleiner.']],
    ['Wofür steht dBm?', 'Leistungspegel bezogen auf 1 mW', ['Leistung in Milliwatt je Meter', 'Dämpfung je Meter', 'Spannungspegel bezogen auf 1 mV'], 'dBm ist ein logarithmisches Maß für die Leistung. 0 dBm entsprechen 1 mW.', ['Das m steht für Milliwatt.', '0 dBm ist ein fester Bezugswert.']],
    ['Wie wirkt sich ein 868-MHz-Funk gegenüber 2,4 GHz bei sonst gleichen Bedingungen aus?', 'Reichweite und Durchdringung von Wänden sind meist besser, die Datenrate ist meist geringer', ['Reichweite kleiner, Datenrate größer', 'Es ändert sich nichts', 'Funk geht nur noch ohne Hindernisse'], 'Niedrigere Frequenzen werden weniger gedämpft und umgehen Hindernisse besser. Für kleine Datenraten reicht das schmale Band aus.', ['Welche Frequenz ist niedriger?', 'Kleine Frequenz: größere Reichweite.']]
  ];
  const E = {
    dbmq(R) {
      const mw = C().pick(R, [1, 2, 4, 10, 20, 25, 50, 100, 200, 500]), v = C().dbm(mw);
      return numQ('Ein Funkmodul sendet mit ' + f(mw, 0) + ' mW. Wie viel dBm sind das? (0 dBm sind 1 mW, dBm = 10 · lg(P / 1 mW))', v, 'dBm', 'Sendepegel', 0.03,
        'dBm = 10 · lg(' + f(mw, 0) + ' mW / 1 mW) = 10 · lg(' + f(mw, 0) + ') = ' + f(v, 2) + ' dBm.',
        ['Teile die Leistung durch 1 mW und nimm den Zehnerlogarithmus.', 'Ergebnis mal 10.'],
        ['Leistung durch 1 mW teilen.', 'Den Zehnerlogarithmus bilden (lg-Taste).', 'Mit 10 malnehmen.']);
    },
    linkb(R) {
      const C0 = C(), ptx = C0.pick(R, [10, 14, 20]), pmin = C0.pick(R, [90, 100, 110, 120]), res = C0.ri(R, 4, 25), loss = ptx + pmin - res, rx = ptx - loss;
      return numQ('Ein Sender strahlt ' + f(ptx, 0) + ' dBm ab. Der Empfänger braucht mindestens −' + f(pmin, 0) + ' dBm. Die Funkstrecke dämpft das Signal um ' + f(loss, 0) + ' dB. Wie viel dB Reserve bleiben?', res, 'dB', 'Reserve', 0.01,
        'Empfangspegel = ' + f(ptx, 0) + ' dBm − ' + f(loss, 0) + ' dB = ' + f(rx, 0) + ' dBm. Reserve = ' + f(rx, 0) + ' dBm − (−' + f(pmin, 0) + ' dBm) = ' + f(res, 0) + ' dB.',
        ['Erst den Pegel am Empfänger ausrechnen, dann mit dem Mindestpegel vergleichen.', 'dB-Werte werden einfach addiert und subtrahiert.'],
        ['Empfangspegel = Sendepegel − Dämpfung.', 'Abstand zum Mindestpegel bilden.', 'Das Ergebnis in dB angeben, es ist die Reserve.']);
    },
    duty(R) {
      const pct = C().pick(R, [0.1, 1, 10]), v = C().dutySek(pct);
      return numQ('Ein Funkband erlaubt eine Sendezeit von ' + f(pct, 1) + ' % (Duty Cycle). Wie viele Sekunden pro Stunde darf ein Gerät höchstens senden?', v, 's', 'Sendezeit je Stunde', 0.01,
        '1 Stunde = 3.600 s. ' + f(pct, 1) + ' % von 3.600 s = ' + f(v, 2) + ' s.',
        ['Eine Stunde hat 3.600 Sekunden.', 'Nimm davon den Prozentsatz.'],
        ['Stunde in Sekunden umrechnen: 3.600 s.', 'Mit dem Prozentsatz malnehmen und durch 100 teilen.']);
    },
    telegr(R) {
      const t = C().pick(R, [50, 100, 200, 250, 400, 600, 1200]), v = C().dutySek(1) * 1000 / t;
      return numQ('Ein Funkband erlaubt 1 % Sendezeit. Ein Telegramm dauert ' + f(t, 0) + ' ms in der Luft. Wie viele Telegramme darf ein Gerät pro Stunde höchstens senden?', v, 'Telegramme', 'Anzahl je Stunde', 0,
        '1 % von 3.600 s = 36 s = 36.000 ms. 36.000 ms / ' + f(t, 0) + ' ms = ' + f(v, 0) + ' Telegramme.',
        ['Erst die erlaubte Sendezeit je Stunde berechnen.', 'Dann durch die Dauer eines Telegramms teilen. Beide in ms.'],
        ['Erlaubte Sendezeit: 1 % von 3.600 s.', 'In ms umrechnen.', 'Durch die Telegrammdauer teilen.']);
    },
    funka: pq(FUNKA, ['Lies die Aufgabe und notiere Reichweite und Datenmenge.', 'Ordne zu: wenige Zentimeter, wenige Meter, Gebäude, mehrere Kilometer.', 'Wähle die Technik, die genau dazu passt.']),
    funkb: pq(FUNKB, ['Lies die Frage. Denke an das Verhältnis, nicht an feste Milliwatt.', 'Merke: +3 dB ist etwa mal 2, +10 dB ist mal 10, 0 dBm sind 1 mW.', 'Wähle die passende Antwort.'])
  };

  /* ============================================================ Fehler erkennen und Busse vergleichen */
  /* PRUEFEN P14: CRC-Bitbreiten: Ethernet 32, Modbus RTU 16, CAN 15; Parität erkennt nur ungerade Fehlerzahlen; Summe merkt keine vertauschten Bytes */
  const CRCQ = [
    ['Was erkennt ein einzelnes Paritätsbit?', 'Fehler in einer ungeraden Anzahl von Bits, korrigieren kann es nichts', ['Jeden Fehler und es korrigiert ihn', 'Nur Fehler im Stoppbit', 'Nur vertauschte Zeichen'], 'Ein Paritätsbit meldet, dass die Zahl der Einsen nicht stimmt. Kippen zwei Bits, stimmt sie wieder und der Fehler bleibt unbemerkt. Welches Bit falsch ist, sagt es nicht.', ['Was passiert, wenn zwei Bits kippen?', 'Parität allein kann nicht korrigieren.']],
    ['Warum ist eine CRC besser als die einfache Summe der Bytes?', 'Sie erkennt viel mehr Fehler, auch Bündelfehler und vertauschte Bytes', ['Sie ist kürzer', 'Sie korrigiert alle Fehler', 'Sie braucht keine Rechenarbeit'], 'Die Summe bleibt gleich, wenn zwei Bytes vertauscht werden. Die CRC hängt von der Reihenfolge ab und erkennt Fehlerbündel zuverlässig.', ['Was passiert mit der Summe bei vertauschten Bytes?', 'Eine CRC rechnet mit einem Polynom.']],
    ['Welche Prüfung hängt Ethernet an das Ende eines Rahmens?', 'Eine 32-Bit-CRC (Frame Check Sequence)', ['Ein Paritätsbit', 'Eine 8-Bit-Summe', 'Gar keine'], 'Ethernet schließt jeden Rahmen mit einer 32-Bit-CRC ab. Ein Rahmen mit falscher CRC wird verworfen.', ['Wie viele Byte hat die Prüfung?', 'Es ist eine CRC.']],
    ['Was passiert bei Modbus RTU, wenn die CRC nicht stimmt?', 'Das Telegramm wird verworfen, der Master wiederholt die Anfrage nach einer Zeitüberschreitung', ['Der Slave korrigiert den Fehler selbst', 'Das Telegramm wird trotzdem ausgeführt', 'Die Baudrate sinkt automatisch'], 'Die CRC kann Fehler nur erkennen. Ein fehlerhaftes Telegramm wird verworfen. Der Master merkt das an der ausbleibenden Antwort.', ['Kann eine CRC korrigieren?', 'Wer fragt noch einmal?']]
  ];
  const VGL = [
    ['Zwei Chips auf einer Platine tauschen Daten über die Leitungen SDA und SCL, jeder Chip hat eine Adresse. Welcher Bus ist das?', 'I²C', ['SPI', 'UART', 'CAN'], 'Zwei Leitungen (Daten SDA und Takt SCL) und Adressen sind typisch für I²C.', ['Welche Leitungen sind genannt?', 'SDA und SCL gehören zu I²C.']],
    ['Ein schneller Chip auf der Platine bekommt vom Master einen Takt. Jeder Chip wird über eine eigene Chip-Select-Leitung (CS) ausgewählt. Welcher Bus ist das?', 'SPI', ['I²C', 'UART', 'RS-485'], 'Takt vom Master, getrennte Daten- und Auswahlleitungen sind typisch für SPI.', ['Wie wird ein Chip ausgewählt?', 'CS ist ein Merkmal von SPI.']],
    ['Zwei Geräte im Abstand von 2 m tauschen Zeichen über TxD, RxD und Masse, ohne Taktleitung. Was ist das?', 'UART', ['I²C', 'SPI', 'CAN'], 'TxD, RxD und Masse ohne Takt sind eine asynchrone serielle Verbindung (UART).', ['Gibt es einen Takt?', 'Welche Leitungsnamen sind genannt?']],
    ['Viele Steuergeräte in einer Maschine senden ihre Nachrichten, die wichtigsten zuerst, geregelt über eine Kennung. Welcher Bus ist das?', 'CAN', ['I²C', 'SPI', 'UART'], 'Nachrichten mit Kennung und Vorrang über Arbitrierung sind typisch für CAN.', ['Wodurch wird die Reihenfolge geregelt?', 'Eine Kennung bestimmt den Vorrang.']],
    ['Sensoren in einer Halle hängen an einem langen differenziellen Zweidraht-Bus (bis etwa 1 km), ein Master fragt nacheinander ab. Welcher Bus ist das?', 'RS-485', ['SPI', 'I²C', 'UART'], 'Langer differenzieller Zweidraht-Bus mit Master-Abfrage ist typisch für RS-485 (zum Beispiel mit Modbus RTU).', ['Wie weit reicht der Bus?', 'Differenziell und lang: Welcher Standard?']]
  ];
  const F = {
    hamm(R) {
      const C0 = C(), k = C0.ri(R, 2, 6), a = C0.ri(R, 0, 255); let m = 0, n = 0; while (n < k) { const b = 1 << C0.ri(R, 0, 7); if (!(m & b)) { m |= b; n++; } }
      const b8 = a ^ m;
      return numQ('Zwei Codewörter lauten ' + bin(a, 8) + ' und ' + bin(b8, 8) + '. Wie groß ist ihr Hamming-Abstand (an wie vielen Bitstellen unterscheiden sie sich)?', C0.hamming(a, b8), 'Bit', 'Hamming-Abstand', 0,
        'Die Wörter unterscheiden sich in den Stellen ' + bin(m, 8) + ' (Einsen = verschieden). Das sind ' + k + ' Stellen: Hamming-Abstand ' + k + '.',
        ['Schreibe beide Wörter untereinander.', 'Zähle die Stellen, an denen die Bits verschieden sind.'],
        ['Beide Wörter untereinander schreiben.', 'Stelle für Stelle vergleichen und Unterschiede markieren.', 'Die markierten Stellen zählen.']);
    },
    hammq(R) {
      const d = C().pick(R, [2, 3, 4, 5, 6, 7]), korr = R() < 0.5, v = korr ? Math.floor((d - 1) / 2) : d - 1;
      return numQ('Ein Code hat den Hamming-Abstand ' + d + '. Wie viele Bitfehler kann er höchstens sicher ' + (korr ? 'korrigieren' : 'erkennen') + '?', v, 'Bit', 'Bitfehler', 0,
        korr ? 'Korrigieren geht bis (d − 1) / 2, abgerundet: (' + d + ' − 1) / 2 = ' + f((d - 1) / 2, 1) + ', also ' + v + ' Bitfehler.' : 'Erkennen geht bis d − 1: ' + d + ' − 1 = ' + v + ' Bitfehler.',
        [korr ? 'Korrigieren geht nur, wenn die Fehler noch näher am richtigen als an einem anderen Wort liegen: (d − 1) / 2, abgerundet.' : 'Erkennen geht, solange kein anderes gültiges Wort entsteht: bis d − 1.', 'Setze d in die Formel ein.'],
        ['Hamming-Abstand d ablesen.', 'Die Formel wählen: erkennen d − 1, korrigieren (d − 1) / 2 abgerundet.', 'Zahl einsetzen und ganze Zahl angeben.']);
    },
    chksum(R) {
      const by = [0, 1, 2, 3].map(() => C().ri(R, 120, 250)), s = by.reduce((x, y) => x + y, 0), v = C().checksum8(by);
      return numQ('Eine einfache 8-Bit-Prüfsumme ist die Summe aller Datenbytes modulo 256 (der Rest nach Division durch 256). Die Datenbytes lauten (dezimal) ' + by.join(', ') + '. Wie lautet die Prüfsumme?', v, 'dezimal', 'Prüfsumme', 0,
        by.join(' + ') + ' = ' + f(s, 0) + '. ' + f(s, 0) + ' mod 256 = ' + f(v, 0) + ' (' + f(s, 0) + ' − ' + f(s - v, 0) + ').',
        ['Erst alle Bytes addieren.', 'Dann so oft 256 abziehen, bis das Ergebnis kleiner als 256 ist.'],
        ['Alle Bytes addieren.', 'Prüfen, wie oft 256 in die Summe passt.', 'Den Rest als Prüfsumme angeben.']);
    },
    crcq: pq(CRCQ, ['Lies die Frage und überlege: Soll nur erkannt oder auch korrigiert werden?', 'Parität und Summe sind einfach, die CRC ist stärker, aber erkennt auch nur.', 'Wähle die passende Antwort.']),
    i2czeit(R) {
      const n = C().pick(R, [1, 2, 3, 4, 6]), fk = C().pick(R, [100, 400]), v = C().i2cZeit(n, fk) * 1e6;
      return numQ('Ein I²C-Master sendet die Adresse und ' + n + ' Datenbyte' + (n > 1 ? 's' : '') + ' bei ' + f(fk, 0) + ' kHz Takt. Je Byte werden 9 Takte gebraucht (8 Bit und die Quittung). Wie lange dauert das ohne Start- und Stoppbedingung?', v, 'µs', 'Dauer', tol(v),
        'Bytes: 1 + ' + n + ' = ' + f(1 + n, 0) + '. Takte: ' + f(1 + n, 0) + ' · 9 = ' + f((1 + n) * 9, 0) + '. Dauer = ' + f((1 + n) * 9, 0) + ' / ' + f(fk, 0) + ' kHz = ' + f(v, 2) + ' µs.',
        ['Die Adresse ist ein eigenes Byte.', 'Takte = Bytes · 9, Dauer = Takte / Taktfrequenz.'],
        ['Bytes zählen: Adresse plus Datenbytes.', 'Mit 9 Takten je Byte malnehmen.', 'Durch die Taktfrequenz teilen, in µs angeben.']);
    },
    vgl: pq(VGL, ['Lies die Beschreibung und markiere die Merkmale: Leitungen, Takt, Adressen, Entfernung.', 'Ordne zu: I²C hat SDA und SCL, SPI hat CS, UART hat TxD und RxD, CAN hat Kennungen, RS-485 hat A und B.', 'Wähle den Bus, zu dem die meisten Merkmale passen.'])
  };

  const G = Object.assign({}, A, B, Cp, D, E, F);
  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const [K1, K2, K3, K4, K5, K6] = CATS;
  const defs = [
    [K1, 1, 'Dauer eines Bits', 'bitzeit', null], [K1, 1, 'Bits im Rahmen', 'rahmenbits', null], [K1, 2, 'Dauer eines Zeichens', 'rahmenzeit', null], [K1, 2, 'Daten, die wirklich ankommen', 'nettorate', null],
    [K1, 2, 'Paritätsbit bestimmen', 'paritaet', null], [K1, 3, 'Abtastpunkt wandert', 'abtast', null], [K1, 1, 'Ruhepegel und Startbit', 'uartq', [0, 1, 5]], [K1, 2, 'Reihenfolge und Takt', 'uartq', [2, 3, 4, 6]], [K1, 2, 'Bits auf der Leitung', 'ascii', null],
    [K2, 1, 'Pegel der Schnittstellen', 'rsq', [0, 1]], [K2, 1, 'Leitungspaar und Störungen', 'rsq', [2, 3, 4]], [K2, 2, 'Abschluss und Verdrahtung', 'rsq', [5, 6, 7]], [K2, 1, 'Widerstand am Leitungsende', 'parab', null],
    [K2, 2, 'Abschluss und Empfänger', 'parab3', null], [K2, 2, 'Anpassung am Leitungsende', 'reflex', null], [K2, 2, 'Weg des Signals', 'laufz', null], [K2, 3, 'Leitung gegen Bitzeit', 'rslen', null],
    [K3, 1, 'Dominant und Vorrang', 'canq', [0, 1, 2, 3]], [K3, 2, 'Wer gewinnt', 'canarb', null], [K3, 3, 'Wann gibt einer auf', 'canbit', null], [K3, 2, 'Länge eines Rahmens', 'canrahmen', null],
    [K3, 3, 'Nutzdaten im Rahmen', 'cannutz', null], [K3, 2, 'Leitungslänge und Bitrate', 'canlen', null], [K3, 2, 'Widerstandsmessung am CAN', 'canfehl', null], [K3, 2, 'Rahmen und Leitungen', 'canq', [4, 5, 6]],
    [K4, 1, 'USB: Host und Geräte', 'usbq', null], [K4, 1, 'Ethernet: Strecke und Adressen', 'ethq', null], [K4, 2, 'Datei übertragen', 'dateimenge', null], [K4, 2, 'Sensordaten über einen Tag', 'sensorvol', null],
    [K4, 2, 'Modbus: Grundlagen', 'modq', null], [K4, 1, 'Wert im Register', 'mbreg', null], [K4, 3, 'Abfrage am Modbus RTU', 'modrtu', null],
    [K5, 2, 'Leistung als Pegel', 'dbmq', null], [K5, 3, 'Reserve auf der Funkstrecke', 'linkb', null], [K5, 2, 'Erlaubte Sendezeit', 'duty', null], [K5, 3, 'Telegramme in der Sendezeit', 'telegr', null],
    [K5, 1, 'Funktechnik wählen', 'funka', null], [K5, 2, 'Pegel und Frequenz', 'funkb', null],
    [K6, 2, 'Bits, die sich unterscheiden', 'hamm', null], [K6, 2, 'Erkennen oder korrigieren', 'hammq', null], [K6, 2, 'Einfache Prüfsumme', 'chksum', null], [K6, 2, 'Prüfverfahren', 'crcq', null],
    [K6, 2, 'Telegramm am I²C', 'i2czeit', null], [K6, 2, 'Welcher Bus passt', 'vgl', null]
  ];
  const tasks = defs.map((d, i) => ({ id: 'bus' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));
  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('bus-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.BUS_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { UARTQ, RSQ, CANQ, CANFEHL, USBQ, ETHQ, MODQ, FUNKA, FUNKB, CRCQ, VGL } };
  root.BUS_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.BUS_DATA, TASKS: root.BUS_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
