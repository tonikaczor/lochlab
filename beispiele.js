/* Zusätzliche Beispiele (alle Labs). Format wie EXAMPLES in schaltplan.js:
   Teile [Art, x, y, Drehung, Wert, Zusatz], Drähte als Linienzüge x1,y1,x2,y2,… (Knickpunkte nur dort, wo etwas anschließt). */
(function () {
  const EX = [
    /* ---------- SchaltLab ---------- */
    /* ---------- neue Bauteile ---------- */
    { cat: 'Netzteile', name: 'Netzteil 5 V: Brücke, Elko und Spannungsregler', info: 'Aus 12 V Wechselspannung (Trafo, Scheitelwert 17 V) wird eine stabile Gleichspannung: vier Dioden richten gleich, der Elko 1000 µF glättet, der 7805 stabilisiert auf 5 V. Ein kleiner Elko am Ausgang beruhigt den Regler, die LED zeigt den Betrieb an.',
      make: () => ({ parts: [['AC', 6, 4, 0, '17V 50Hz'], ['D', 6, 4, 3, '1N4007'], ['D', 6, 8, 3, '1N4007'], ['D', 12, 4, 3, '1N4007'], ['D', 12, 8, 3, '1N4007'], ['CE', 18, 0, 1, '1000u'], ['REG', 22, 0, 0, '7805'], ['CE', 30, 0, 1, '10u'], ['R', 34, 0, 1, '330'], ['LED', 34, 4, 1, 'grün'], ['GND', 12, 8]],
        wires: [[10, 4, 12, 4], [6, 0, 12, 0, 18, 0, 22, 0], [6, 8, 12, 8, 18, 8, 24, 8, 30, 8, 34, 8], [18, 4, 18, 8], [24, 2, 24, 8], [26, 0, 30, 0, 34, 0], [30, 4, 30, 8]], scopes: [], tempo: 0.4, win: 0.1 }) },
    { cat: 'Transistoren', name: 'Dämmerungsschalter mit Relais und Lampe', info: 'Im Dunkeln (Regler Licht unten) hat der Fotowiderstand viel Widerstand, die Basisspannung steigt, der Transistor schaltet das Relais und das Relais schaltet die Lampe im zweiten Stromkreis ein. Bei Licht fällt der Widerstand, der Transistor sperrt und die Lampe geht aus. Die Diode schützt vor der Induktionsspannung der Spule.',
      make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 4, 4, 1, '47k'], ['LDR', 4, 10, 1, '', { pos: 0.15 }], ['NPN', 8, 12, 0, 'BC547'], ['RLY', 8, 2, 0, '12V'], ['D', 6, 6, 3, '1N4007'], ['LAMP', 16, 2, 0, '12V 0.1A'], ['BAT', 22, 2, 1, '12'], ['GND', 2, 10], ['GND', 4, 16], ['GND', 10, 16], ['GND', 22, 10]],
        wires: [[2, 4, 2, 2, 4, 2, 6, 2, 8, 2], [4, 2, 4, 4], [4, 8, 4, 10], [4, 10, 6, 10, 6, 12, 8, 12], [4, 14, 4, 16], [8, 6, 10, 6, 10, 10], [6, 6, 8, 6], [10, 14, 10, 16], [20, 2, 22, 2], [13, 4, 13, 10, 22, 10, 22, 6], [2, 8, 2, 10]], scopes: [], tempo: 0.75 }) },
    { cat: 'Logik', name: 'Ampel mit 555-Takt und Zähler (CD4017)', info: 'Der 555 ist als astabile Kippstufe der Taktgeber (etwa 1 Hz). Der CD4017 zählt die Takte und schaltet seine Ausgänge nacheinander: Q0 rot, Q1 grün, Q2 gelb. Q3 setzt den Zähler zurück (RST), dann beginnt es von vorn.',
      make: () => ({ parts: [['BAT', 2, 8, 1, '9'], ['ICX', 22, 6, 0, 'CD4017', { n: 16 }], ['ICX', 40, 6, 0, 'NE555', { n: 8 }], ['R', 10, 8, 1, '470'], ['LED', 10, 12, 1, 'grün'], ['R', 14, 10, 1, '470'], ['LED', 14, 14, 1, 'rot'], ['R', 18, 12, 1, '470'], ['LED', 18, 16, 1, 'gelb'], ['R', 50, 2, 1, '10k'], ['R', 50, 8, 1, '68k'], ['C', 38, 22, 1, '10u'], ['GND', 2, 28]],
        wires: [[2, 8, 2, 2, 28, 2, 42, 2, 44, 2, 50, 2], [28, 6, 28, 2], [42, 4, 42, 2], [44, 4, 44, 2],
                [2, 12, 2, 26, 10, 26, 14, 26, 18, 26, 22, 26, 32, 26, 38, 26, 43, 26], [2, 26, 2, 28], [10, 16, 10, 26], [14, 18, 14, 26], [18, 20, 18, 26],
                [22, 8, 10, 8], [22, 10, 14, 10], [22, 12, 18, 12], [22, 18, 20, 18, 20, 24, 30, 24, 30, 8, 28, 8], [22, 20, 22, 26], [28, 12, 32, 12, 32, 26],
                [43, 16, 43, 26], [46, 8, 50, 8], [50, 6, 50, 8], [50, 12, 50, 22, 38, 22, 38, 12, 40, 12], [38, 12, 38, 10, 40, 10], [46, 12, 48, 12, 48, 20, 34, 20, 34, 10, 28, 10]], scopes: [], tempo: 0.75, win: 6 }) },
    { cat: 'Transistoren', name: 'MOSFET als Schalter (N-Kanal, Low-Side)', info: 'Schalter schließen: Das Gate bekommt 5 V, der IRLZ44N schaltet durch und die LED leuchtet. Offen zieht der 10-kΩ-Widerstand das Gate auf Masse, der MOSFET sperrt. Im Gegensatz zum Bipolartransistor fließt kein Basisstrom.',
      make: () => ({ parts: [['BAT', 0, 4, 1, '5'], ['R', 10, 2, 0, '220'], ['LED', 14, 2, 0, 'rot'], ['NMOS', 16, 6, 0, 'IRLZ44N'], ['SPST', 6, 6, 0, ''], ['R', 13, 6, 1, '10k'], ['GND', 0, 12]],
        wires: [[0, 4, 0, 2, 6, 2, 10, 2], [6, 2, 6, 6], [18, 2, 18, 4], [10, 6, 13, 6, 16, 6], [0, 8, 0, 10, 13, 10, 18, 10], [18, 8, 18, 10], [0, 10, 0, 12]], scopes: [] }) },
    { cat: 'Transistoren', name: 'Lampen-Dimmer mit DIAC und TRIAC', info: 'Phasenanschnitt wie im Wandschalter: Der Kondensator lädt sich über R auf, bis der DIAC bei etwa 32 V kippt und den TRIAC zündet. Je größer R, desto später zündet er und desto dunkler leuchtet die Lampe. Wert von R ändern (z. B. 100k, 220k, 330k) und die Helligkeit vergleichen.',
      make: () => ({ parts: [['AC', 0, 4, 1, '325V 50Hz'], ['LAMP', 6, 2, 0, '230V 100W'], ['R', 20, 4, 1, '220k'], ['C', 20, 8, 1, '100n'], ['DIAC', 16, 8, 0, '32V'], ['TRIAC', 12, 6, 0, 'BT136'], ['GND', 0, 14]],
        wires: [[0, 4, 0, 2, 6, 2], [10, 2, 16, 2, 20, 2, 20, 4], [16, 2, 16, 6], [12, 6, 12, 12], [15, 8, 16, 8], [0, 8, 0, 12, 12, 12, 20, 12], [0, 12, 0, 14]], scopes: [2] }) },
    { cat: 'Dioden', name: 'Duo-LED mit drei Beinen (rot/grün)', info: 'Zwei LEDs in einem Gehäuse mit gemeinsamer Kathode (mittleres Bein). Je nachdem, welcher Schalter geschlossen ist, leuchtet sie rot, grün oder bei beiden gelb-orange. Jede Farbe braucht ihren eigenen Vorwiderstand. Im Eigenschaftenfeld lässt sich auch „gemeinsame Anode“ wählen.',
      make: () => ({ parts: [['BAT', 0, 10, 1, '5'], ['SPST', 4, 2, 0, ''], ['R', 8, 2, 0, '220'], ['SPST', 4, 8, 0, ''], ['R', 8, 8, 0, '220'], ['DUOLED', 14, 2, 0, 'Kathode'], ['GND', 0, 18]],
        wires: [[0, 10, 0, 8, 4, 8], [0, 8, 0, 2, 4, 2], [12, 2, 14, 2], [12, 8, 12, 6, 14, 6], [14, 4, 18, 4, 18, 16, 0, 16, 0, 14], [0, 16, 0, 18]], scopes: [] }) },
    { cat: 'Dioden', name: 'Duo-7-Segment: Ziffer wählen (Multiplex-Anzeige)', info: 'Die Anzeige hat zwei Ziffern, die sich die Segmente a bis dp teilen. Jede Ziffer hat ihre eigene gemeinsame Kathode (K1, K2). Segmente a, b, c sind vorbereitet: Schalter an K1 schließen = linke Ziffer zeigt eine 7, an K2 = rechte Ziffer. Beide = beide. Im Multiplexbetrieb schaltet ein Mikrocontroller die Ziffern schnell abwechselnd.',
      make: () => ({ parts: [['BAT', 0, 0, 1, '5'], ['R', 10, 0, 0, '330'], ['R', 10, 2, 0, '330'], ['R', 10, 4, 0, '330'], ['SEG8D', 16, 0, 0, ''], ['SPST', 28, 2, 0, ''], ['SPST', 28, 12, 0, ''], ['GND', 32, 14]],
        wires: [[0, 0, 8, 0], [8, 0, 8, 2, 8, 4], [8, 2, 10, 2], [8, 4, 10, 4], [14, 0, 16, 0], [14, 2, 16, 2], [14, 4, 16, 4], [26, 2, 28, 2], [26, 12, 28, 12], [0, 4, 0, 16, 32, 16, 32, 14], [32, 2, 32, 12, 32, 14], [8, 0, 10, 0]], scopes: [] }) },
    { cat: 'Dioden', name: 'Diode: Durchlass- und Sperrrichtung', info: 'Links leitet die Diode (Voltmeter etwa 0,7 V), rechts ist sie umgekehrt eingebaut und sperrt: fast die ganze Spannung fällt an der Diode ab.',
      make: () => ({ parts: [['BAT', 4, 4, 1, '5'], ['R', 10, 2, 1, '470'], ['D', 10, 6, 1, '1N4148'], ['VM', 14, 6, 1, ''], ['R', 22, 2, 1, '470'], ['D', 22, 10, 3, '1N4148'], ['VM', 26, 6, 1, ''], ['GND', 4, 14]],
        wires: [[4, 4, 4, 2, 10, 2, 22, 2], [10, 6, 14, 6], [14, 10, 10, 10, 10, 12], [22, 6, 26, 6], [26, 10, 22, 10, 22, 12], [4, 8, 4, 12, 10, 12, 22, 12], [4, 12, 4, 14]], scopes: [] }) },
    { cat: 'Grundlagen', name: 'Kondensator laden und entladen', info: 'Wechsler umlegen: Der Kondensator lädt sich über 10 kΩ auf 9 V auf und entlädt sich wieder. Die Zeitkonstante beträgt 1 s. Im Graph sieht man die Kurve.',
      make: () => ({ parts: [['SPDT', 4, 2, 0, ''], ['R', 4, 2, 2, '10k'], ['C', 0, 2, 1, '100u'], ['BAT', 10, 1, 1, '9'], ['GND', 0, 8]],
        wires: [[8, 1, 10, 1], [10, 5, 10, 8, 8, 8, 0, 8, 0, 6], [8, 3, 8, 8]], scopes: [3], tempo: 0.75, win: 6 }) },
    { cat: 'Grundlagen', name: 'Belasteter Spannungsteiler', info: 'Ohne Last zeigt das Voltmeter 6 V. Schalter schließen: Der Lastwiderstand liegt parallel zu R2 und die Spannung sackt auf 4 V ab.',
      make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 8, 2, 1, '1k'], ['R', 8, 6, 1, '1k'], ['VM', 5, 6, 1, ''], ['SPST', 12, 6, 0, ''], ['R', 16, 6, 1, '1k'], ['GND', 2, 12]],
        wires: [[2, 4, 2, 2, 8, 2], [8, 6, 5, 6], [5, 10, 8, 10], [8, 6, 12, 6], [2, 8, 2, 10, 5, 10, 8, 10, 16, 10], [2, 10, 2, 12]], scopes: [] }) },
    { cat: 'Filter und Schwingkreise', name: 'RL-Glied am Wechselstrom', info: 'Die Spule bremst den Strom: Im Graph (gelb Spannung, grün Strom) hinkt der Strom der Spannung hinterher. Je höher die Frequenz, desto größer der Blindwiderstand der Spule.',
      make: () => ({ parts: [['AC', 2, 4, 1, '5V 200Hz'], ['R', 4, 2, 0, '100'], ['L', 8, 2, 0, '100m'], ['GND', 2, 12]],
        wires: [[2, 4, 2, 2, 4, 2], [12, 2, 14, 2, 14, 10, 2, 10, 2, 8], [2, 10, 2, 12]], scopes: [0] }) },
    { cat: 'Transistoren', name: 'Dämmerungsschalter (LDR)', info: 'Im Dunkeln (Regler Licht unten) hat der Fotowiderstand viel Widerstand, die Basisspannung steigt und die LED leuchtet. Regler Licht hochziehen: Der Widerstand fällt, der Transistor sperrt, die LED geht aus.',
      make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 6, 1, '100k'], ['LDR', 6, 14, 1, '', { pos: 0.15 }], ['NPN', 8, 14, 0, 'BC547'], ['R', 10, 2, 1, '470'], ['LED', 10, 6, 1, 'rot'], ['GND', 2, 20]],
        wires: [[2, 4, 2, 2, 6, 2, 10, 2], [6, 2, 6, 6], [6, 10, 6, 14, 8, 14], [10, 10, 10, 12], [2, 8, 2, 18, 6, 18, 10, 18, 10, 16], [2, 18, 2, 20]], scopes: [] }) },
    { cat: 'Filter und Schwingkreise', name: 'Parallelschwingkreis (Sperrkreis)', info: 'Bei der Resonanzfrequenz (etwa 1 kHz) sperrt der Kreis aus Spule und Kondensator: Die Spannung an ihm wird groß, der Strom aus der Quelle klein. Frequenz der Quelle verändern und die Graphen vergleichen.',
      make: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['R', 2, 2, 0, '1k'], ['L', 6, 2, 1, '10m'], ['C', 10, 2, 1, '2.5u'], ['GND', 2, 12]],
        wires: [[2, 4, 2, 2], [6, 2, 10, 2], [2, 8, 2, 10, 6, 10, 10, 10], [6, 6, 6, 10], [10, 6, 10, 10], [2, 10, 2, 12]], scopes: [0, 2] }) },
    { cat: 'Logik', name: 'Invertierender Verstärker (Operationsverstärker)', info: 'Das Signal wird um den Faktor 10 verstärkt (Rf : Rin = 100 k : 10 k) und gleichzeitig invertiert. Der Graph zeigt Eingang und Ausgang. Der Operationsverstärker braucht eine symmetrische Versorgung ±9 V.',
      make: () => ({ parts: [['AC', 2, 8, 1, '100mV 1kHz'], ['R', 4, 8, 0, '10k'], ['R', 10, 2, 0, '100k'], ['OPA', 12, 8, 0, 'LM358'], ['BAT', 24, 4, 1, '9'], ['BAT', 24, 8, 1, '9'], ['GND', 2, 14], ['GND', 10, 10], ['GND', 26, 8]],
        wires: [[2, 8, 4, 8], [8, 8, 10, 8, 12, 8], [10, 8, 10, 2], [14, 2, 20, 2, 20, 9, 16, 9], [12, 10, 10, 10], [14, 6, 14, 4, 24, 4], [14, 12, 14, 14, 24, 14, 24, 12], [24, 8, 26, 8], [2, 12, 2, 14]], scopes: [0, 3], tempo: 0.5 }) },
    { cat: 'Logik', name: 'Monostabiler 555 (Treppenlicht-Timer)', info: 'Taster kurz drücken: Der Ausgang geht für etwa 1,1 Sekunden auf HIGH und die LED leuchtet. Die Dauer ergibt sich aus 1,1 · R · C (100 kΩ · 10 µF).',
      make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['ICX', 14, 6, 0, 'NE555', { n: 8 }], ['R', 10, 2, 1, '10k'], ['PB', 6, 12, 0, ''], ['R', 30, 2, 1, '100k'], ['C', 30, 8, 1, '10u'], ['R', 22, 12, 0, '470'], ['LED', 26, 12, 1, 'rot'], ['GND', 2, 10], ['GND', 6, 14], ['GND', 17, 18], ['GND', 30, 14], ['GND', 26, 18]],
        wires: [[2, 4, 2, 2, 10, 2, 16, 2, 18, 2, 30, 2], [16, 4, 16, 2], [18, 4, 18, 2], [10, 6, 10, 12, 14, 12], [14, 10, 12, 10, 12, 0, 32, 0, 32, 8, 30, 8], [30, 6, 30, 8, 20, 8], [20, 12, 22, 12], [17, 16, 17, 18], [26, 16, 26, 18], [2, 8, 2, 10], [6, 12, 6, 14], [30, 12, 30, 14]], scopes: [1, 7], tempo: 0.75, win: 3 }) },
    { cat: 'Logik', name: 'Halbaddierer (XOR und UND)', info: 'Zwei Schalter sind die Eingänge A und B. Die gelbe LED zeigt die Summe (XOR), die rote den Übertrag (UND). 1 + 1 = 10: Summe aus, Übertrag an.',
      make: () => ({ parts: [['BAT', 2, 6, 1, '5'], ['SPST', 4, 2, 0, ''], ['SPST', 4, 6, 0, ''], ['XOR', 12, 2, 0, '5V'], ['AND', 12, 10, 0, '5V'], ['R', 18, 3, 0, '470'], ['LED', 22, 3, 1, 'gelb'], ['R', 18, 11, 0, '470'], ['LED', 22, 11, 1, 'rot'], ['GND', 2, 12], ['GND', 22, 9], ['GND', 22, 17]],
        wires: [[4, 2, 2, 2, 2, 6, 4, 6], [8, 2, 10, 2, 12, 2], [10, 2, 10, 10, 12, 10], [8, 6, 11, 6, 11, 4, 12, 4], [11, 6, 11, 12, 12, 12], [16, 3, 18, 3], [16, 11, 18, 11], [2, 10, 2, 12]], scopes: [], tempo: 0.75 }) },
    { cat: 'Bauteile', name: 'Relais mit Transistor und Freilaufdiode', info: 'Schalter schließen: Der Transistor schaltet die Relaisspule, das Relais zieht an und schaltet die Lampe im zweiten Stromkreis. Die Diode über der Spule schützt den Transistor vor der Induktionsspannung beim Abschalten.',
      make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['SPST', 4, 8, 1, ''], ['R', 4, 12, 0, '10k'], ['NPN', 8, 12, 0, 'BC547'], ['RLY', 8, 2, 0, '12V'], ['D', 6, 6, 3, '1N4007'], ['LAMP', 16, 2, 0, '12V 0.1A'], ['BAT', 22, 2, 1, '12'], ['GND', 2, 10], ['GND', 10, 16], ['GND', 22, 10]],
        wires: [[2, 4, 2, 2, 4, 2, 6, 2, 8, 2], [4, 2, 4, 8], [8, 6, 10, 6, 10, 10], [6, 6, 8, 6], [10, 14, 10, 16], [20, 2, 22, 2], [13, 4, 13, 10, 22, 10, 22, 6], [2, 8, 2, 10]], scopes: [], tempo: 0.75 }) },
    /* ---------- SimLab ---------- */
    { lab: 'sim', cat: 'Hausinstallation', name: 'Zwei Lampen getrennt schaltbar', info: 'Hinter dem Sicherungsautomaten zweigt der Außenleiter ab: Jede Lampe hat ihren eigenen Schalter. Beide Lampen liegen parallel an 230 V und beeinflussen sich nicht.',
      make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', 1, 8, 1, '', { sw: 1 }], ['LAMP', 1, 12, 1, '230V 60W'], ['SPST', -3, 8, 1, '', { sw: 0 }], ['LAMP', -3, 12, 1, '230V 60W']],
        wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, 1, 8], ['braun', 1, 6, -3, 6, -3, 8], ['blau', 3, 0, 3, 20, 1, 20, -3, 20, -3, 16], ['blau', 1, 16, 1, 20]], scopes: [], tempo: 0.55, win: 0.04 }) },
    { lab: 'sim', cat: 'Hausinstallation', name: 'Öffner-Taster (Ruhekontakt)', info: 'Die Lampe leuchtet im Ruhezustand. Taster gedrückt halten: Der Öffner unterbricht den Stromkreis und die Lampe geht aus. So arbeiten Stopp- und Not-Aus-Taster.',
      make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PBC', 1, 6, 1, ''], ['LAMP', 1, 10, 1, '230V 60W']],
        wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 16, 1, 16, 1, 14]], scopes: [], tempo: 0.55, win: 0.04 }) },
    { lab: 'sim', cat: 'Drehstrom', name: 'Drehstrommotor mit Schütz (Tippbetrieb)', info: 'Start gedrückt halten: Das Schütz (Spule an L1 und N) zieht an und schaltet mit seinen drei Schließern die drei Außenleiter auf den Motor. Taster loslassen: Der Motor stoppt.',
      make: () => ({ parts: [['NETZ3', 1, 0], ['PB', -9, 11, 0, '', { l: 'S1' }], ['SCHUETZ', -14, 14, 0, '230V'], ['MOTOR3', -12, 26, 0, '400V 2.2kW']],
        wires: [['braun', 1, 0, 1, 11, 1, 18, -5, 18], ['braun', 1, 11, -5, 11], ['schwarz', 3, 0, 3, 14, -5, 14], ['grau', 5, 0, 5, 20, -5, 20], ['schwarz', -9, 11, -14, 11, -14, 14],
                ['blau', 7, 0, 7, 34, -17, 34, -17, 20, -14, 20], ['schwarz', -9, 14, -12, 14, -12, 26], ['braun', -9, 18, -10, 18, -10, 26], ['grau', -9, 20, -9, 22, -8, 22, -8, 26]], scopes: [], tempo: 0.55, win: 0.04 }) },

    /* ---------- CodeLab ---------- */
    { lab: 'code', cat: 'Mehrere LEDs', name: 'Lauflicht mit vier LEDs', info: 'Vier LEDs an den Pins 3, 5, 7 und 9 laufen hin und her. Die Pins liegen in einem Feld (Array) und werden mit einer Schleife angesteuert.',
      make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'grün'], ['GND', 30, 14], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'blau'], ['GND', 30, 18]], wires: [[20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14], [20, 18, 22, 18]], scopes: [], tempo: 0.75,
      code: String.raw`// Lauflicht: ein Licht wandert hin und her
int ledPins[] = {3, 5, 7, 9};
int anzahl = 4;

void setup() {
  for (int i = 0; i < anzahl; i++) {
    pinMode(ledPins[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < anzahl; i++) {          // von links nach rechts
    digitalWrite(ledPins[i], HIGH);
    delay(150);
    digitalWrite(ledPins[i], LOW);
  }
  for (int i = anzahl - 2; i > 0; i--) {      // und zurück
    digitalWrite(ledPins[i], HIGH);
    delay(150);
    digitalWrite(ledPins[i], LOW);
  }
}
` }) },
    { lab: 'code', cat: 'Mehrere LEDs', name: 'Binärzähler mit vier LEDs', info: 'Die vier LEDs zeigen die Zahlen 0 bis 15 als Dualzahl (leuchtet = 1). Die rote LED ist das niedrigste Bit. Im Serial-Monitor steht die Zahl dazu.',
      make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'grün'], ['GND', 30, 14], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'blau'], ['GND', 30, 18]], wires: [[20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14], [20, 18, 22, 18]], scopes: [], tempo: 0.75,
      code: String.raw`// Binärzähler: jede LED zeigt ein Bit der Zahl
int ledPins[] = {3, 5, 7, 9};
int zahl = 0;

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
  }
  Serial.begin(9600);
}

void loop() {
  for (int bit = 0; bit < 4; bit++) {
    digitalWrite(ledPins[bit], (zahl >> bit) & 1);   // Bit Nummer "bit" herausholen
  }
  Serial.println(zahl);
  zahl = (zahl + 1) % 16;
  delay(500);
}
` }) },
    { lab: 'code', cat: 'Grundlagen', name: 'SOS-Morsezeichen', info: 'Die LED blinkt dreimal kurz, dreimal lang, dreimal kurz. Eigene Funktionen (punkt, strich) machen das Programm übersichtlich.',
      make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`// SOS: ... --- ...
const int ledPin = 13;

void punkt() {
  digitalWrite(ledPin, HIGH);
  delay(200);
  digitalWrite(ledPin, LOW);
  delay(200);
}

void strich() {
  digitalWrite(ledPin, HIGH);
  delay(600);
  digitalWrite(ledPin, LOW);
  delay(200);
}

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  for (int i = 0; i < 3; i++) punkt();
  delay(400);
  for (int i = 0; i < 3; i++) strich();
  delay(400);
  for (int i = 0; i < 3; i++) punkt();
  delay(2000);
}
` }) },
    { lab: 'code', cat: 'Grundlagen', name: 'LED per Serial-Monitor schalten', info: 'Im Eingabefeld des Serial-Monitors eine 1 senden: LED an. Eine 0 senden: LED aus. Der Arduino liest die Zeichen mit Serial.read().',
      make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Sende 1 = LED an, 0 = LED aus");
}

void loop() {
  if (Serial.available() > 0) {
    char zeichen = Serial.read();
    if (zeichen == '1') {
      digitalWrite(13, HIGH);
      Serial.println("LED an");
    } else if (zeichen == '0') {
      digitalWrite(13, LOW);
      Serial.println("LED aus");
    }
  }
}
` }) },
    { lab: 'code', cat: 'Grundlagen', name: 'Würfel mit Taster', info: 'Taster gedrückt halten: Der Arduino würfelt (random), schreibt das Ergebnis in den Serial-Monitor und lässt die LED so oft blinken, wie die Augenzahl ist.',
      make: () => ({ parts: [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 4, 24, 4], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`const int tasterPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(tasterPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Taster druecken zum Wuerfeln");
}

void loop() {
  if (digitalRead(tasterPin) == LOW) {
    randomSeed(micros());               // Zufall hängt vom Zeitpunkt ab
    int wurf = random(1, 7);            // 1 bis 6
    Serial.print("Gewuerfelt: ");
    Serial.println(wurf);
    for (int i = 0; i < wurf; i++) {
      digitalWrite(ledPin, HIGH);
      delay(200);
      digitalWrite(ledPin, LOW);
      delay(200);
    }
    while (digitalRead(tasterPin) == LOW) {   // warten, bis losgelassen
      delay(10);
    }
  }
}
` }) },
    { lab: 'code', cat: 'Töne und Sensoren', name: 'Nachtlicht mit Fotowiderstand', info: 'Regler „Licht“ am Fotowiderstand herunterziehen: Je dunkler es wird, desto heller leuchtet die LED (PWM an Pin 9). Der Fotowiderstand bildet mit 10 kΩ einen Spannungsteiler an A0.',
      make: () => ({ parts: [['UNO', 12, 0], ['LDR', 8, 0, 1, '', { pos: 0.5 }], ['R', 8, 4, 1, '10k'], ['GND', 8, 8], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'gelb'], ['GND', 30, 18]], wires: [[8, 0, 12, 0], [8, 4, 10, 4, 10, 8, 12, 8], [20, 18, 22, 18]], scopes: [], tempo: 0.75,
      code: String.raw`const int ldrPin = A0;
const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int hell = analogRead(ldrPin);        // 0 = dunkel, 1023 = hell
  int pwm = 255 - hell / 4;             // dunkel -> LED hell
  analogWrite(ledPin, pwm);
  Serial.println(hell);
  delay(100);
}
` }) },
    { lab: 'code', cat: 'Töne und Sensoren', name: 'Servo mit Poti steuern', info: 'Am Poti drehen (Regler unter dem Bauteil): Der Servo folgt dem Drehwinkel. analogRead liefert 0 bis 1023, map rechnet das auf 0 bis 180 Grad um.',
      make: () => ({ parts: [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['SERVO', 24, 18], ['GND', 24, 22]], wires: [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 18, 24, 18], [24, 20, 26, 20, 26, -2, 20, -2]], scopes: [], tempo: 0.75,
      code: String.raw`#include <Servo.h>

Servo meinServo;

void setup() {
  meinServo.attach(9);
}

void loop() {
  int wert = analogRead(A0);
  int winkel = map(wert, 0, 1023, 0, 180);
  meinServo.write(winkel);
  delay(15);
}
` }) },
    { lab: 'code', cat: 'Töne und Sensoren', name: 'Bewegungsmelder-Alarm (PIR)', info: 'Regler „Bewegung“ am PIR-Sensor über 50 % ziehen: Der Sensor meldet eine Bewegung, die rote LED leuchtet und der Summer spielt eine Sirene.',
      make: () => ({ parts: [['UNO', 12, 0], ['PIR', 24, 2, 0, '', { pos: 0 }], ['GND', 24, 6], ['R', 22, 16, 0, '100'], ['SPK', 26, 16, 0, '8'], ['GND', 30, 16], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[24, 2, 22, 2, 22, -2, 20, -2], [20, 4, 24, 4], [20, 16, 22, 16], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`const int pirPin = 2;
const int summerPin = 8;
const int ledPin = 13;

void setup() {
  pinMode(pirPin, INPUT);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (digitalRead(pirPin) == HIGH) {
    digitalWrite(ledPin, HIGH);
    tone(summerPin, 880);
    delay(150);
    tone(summerPin, 660);
    delay(150);
  } else {
    digitalWrite(ledPin, LOW);
    noTone(summerPin);
  }
}
` }) },
    { lab: 'code', cat: 'Töne und Sensoren', name: 'Star-Wars-Thema mit Lichtshow', info: 'Der Lautsprecher an Pin 8 spielt das Star-Wars-Thema, dazu leuchten die drei LEDs reihum im Takt der Noten. Die Tonhöhen und Längen stehen in zwei Listen (Arrays). Mit dem Tempo-Regler oben geht es schneller.',
      make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 4, 0, '220'], ['LED', 26, 4, 0, 'rot'], ['GND', 30, 4], ['R', 22, 12, 0, '220'], ['LED', 26, 12, 0, 'gelb'], ['GND', 30, 12], ['R', 22, 16, 0, '100'], ['SPK', 26, 16, 0, '8'], ['GND', 30, 16], ['R', 22, 24, 0, '220'], ['LED', 26, 24, 0, 'grün'], ['GND', 30, 24]], wires: [[20, 4, 22, 4], [20, 12, 22, 12], [20, 16, 22, 16], [20, 24, 22, 24]], scopes: [], tempo: 1,
      code: String.raw`const int summerPin = 8;
int ledPins[] = {2, 6, 12};

// Die Melodie: Tonhöhe (Hz) und Länge (ms) jeder Note
int melodie[] = {NOTE_G4, NOTE_G4, NOTE_G4, NOTE_C5, NOTE_G5, NOTE_F5, NOTE_E5, NOTE_D5, NOTE_C6, NOTE_G5, NOTE_F5, NOTE_E5, NOTE_D5, NOTE_C6, NOTE_G5, NOTE_F5, NOTE_E5, NOTE_F5, NOTE_D5};
int dauer[]   = {200, 200, 200, 800, 800, 200, 200, 200, 800, 400, 200, 200, 200, 800, 400, 200, 200, 200, 1000};
const int anzahl = 19;

void setup() {
  for (int i = 0; i < 3; i++) {
    pinMode(ledPins[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < anzahl; i++) {
    int led = ledPins[i % 3];      // die LEDs reihum nehmen
    digitalWrite(led, HIGH);
    tone(summerPin, melodie[i], dauer[i]);
    delay(dauer[i] + 60);          // kurze Pause zwischen den Noten
    digitalWrite(led, LOW);
  }
  delay(2000);
}
` }) },
    { lab: 'code', cat: 'Töne und Sensoren', name: 'Einparkhilfe mit Ultraschall und Summer', info: 'Regler „Abstand“ am Sensor verkleinern: Unter 100 cm piept der Summer, und je näher das Hindernis ist, desto schneller kommen die Töne.',
      make: () => ({ parts: [['UNO', 12, 0], ['HCSR04', 24, 10, 0, '', { pos: 0.1 }], ['GND', 24, 16], ['R', 22, 20, 0, '100'], ['SPK', 26, 20, 0, '8'], ['GND', 30, 20]], wires: [[24, 10, 22, 10, 22, -2, 20, -2], [20, 12, 24, 12], [20, 14, 24, 14], [20, 20, 22, 20]], scopes: [], tempo: 0.75,
      code: String.raw`const int triggerPin = 6;
const int echoPin = 7;
const int summerPin = 10;

long messeDauer() {
  pinMode(triggerPin, OUTPUT);
  digitalWrite(triggerPin, LOW);
  delayMicroseconds(2);
  digitalWrite(triggerPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(triggerPin, LOW);
  pinMode(echoPin, INPUT);
  return pulseIn(echoPin, HIGH);
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  float cm = 0.01723 * messeDauer();
  Serial.println(cm);
  if (cm < 100) {
    tone(summerPin, 1000, 60);
    delay(cm * 4 + 40);          // je näher, desto schneller
  } else {
    delay(200);
  }
}
` }) },



    /* ---------- Pi-Lab ---------- */
    { lab: 'pi', cat: 'Grundlagen', name: 'LED blinkt (GPIO17)', info: 'Die LED an GPIO17 (Pin 11) blinkt im Sekundentakt. Der 220-Ω-Vorwiderstand schützt Pin und LED. gpiozero zählt mit GPIO-Nummern, nicht mit den Pin-Nummern der Leiste.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], wires: [[12, 10, 10, 10]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import LED
from time import sleep

led = LED(17)          # LED an GPIO17 (Pin 11)

while True:
    led.on()
    sleep(1)
    led.off()
    sleep(1)
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'Taster schaltet LED (Rückruf)', info: 'Taster gedrückt halten: die LED leuchtet. Der Taster liegt zwischen GPIO2 und Masse, gpiozero schaltet den Pull-up automatisch ein. Mit when_pressed wird bei jedem Druck eine Funktion aufgerufen.',
      make: () => ({ parts: [['PI', 12, 0], ['PB', 8, 2, 1, ''], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], wires: [[12, 10, 10, 10], [8, 2, 12, 2], [8, 6, 8, 8, 12, 8]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import LED, Button
from signal import pause

led = LED(17)
taster = Button(2)             # Taster zwischen GPIO2 und Masse

taster.when_pressed = led.on     # bei Druck: LED an
taster.when_released = led.off   # beim Loslassen: LED aus

pause()                          # Programm läuft weiter und wartet auf Ereignisse
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'Taster abfragen (Schleife)', info: 'Dieselbe Schaltung, aber das Programm fragt den Taster ständig selbst ab (Polling). is_pressed ist True, solange der Taster gedrückt ist.',
      make: () => ({ parts: [['PI', 12, 0], ['PB', 8, 2, 1, ''], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], wires: [[12, 10, 10, 10], [8, 2, 12, 2], [8, 6, 8, 8, 12, 8]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import LED, Button
from time import sleep

led = LED(17)
taster = Button(2)

while True:
    if taster.is_pressed:
        led.on()
    else:
        led.off()
    sleep(0.05)
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'LED pulsiert (PWM)', info: 'Die gelbe LED an GPIO18 wird mit PWM langsam heller und dunkler. PWMLED nimmt Werte von 0.0 bis 1.0.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10]], wires: [[20, 10, 22, 10]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import PWMLED
from time import sleep

led = PWMLED(18)

while True:
    for i in range(0, 101, 5):
        led.value = i / 100       # 0.0 bis 1.0
        sleep(0.05)
    for i in range(100, -1, -5):
        led.value = i / 100
        sleep(0.05)
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'Ampel mit TrafficLights', info: 'Drei LEDs an GPIO18 (rot), GPIO24 (gelb) und GPIO8 (grün). TrafficLights fasst sie zu einem Gerät zusammen.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16], ['R', 22, 22, 0, '220'], ['LED', 26, 22, 0, 'grün'], ['GND', 30, 22]], wires: [[20, 10, 22, 10], [20, 16, 22, 16], [20, 22, 22, 22]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import TrafficLights
from time import sleep

ampel = TrafficLights(18, 24, 8)   # rot, gelb, grün

while True:
    ampel.red.on()
    sleep(3)
    ampel.amber.on()           # rot und gelb
    sleep(1)
    ampel.red.off()
    ampel.amber.off()
    ampel.green.on()
    sleep(3)
    ampel.green.off()
    ampel.amber.on()
    sleep(1)
    ampel.amber.off()
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Summer piept (Buzzer)', info: 'Der Lautsprecher an GPIO23 piept im Takt. Beim echten Pi nimmt man einen aktiven Summer. Der 220-Ω-Widerstand begrenzt den Strom.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 14, 0, '220'], ['SPK', 26, 14, 0, '8'], ['GND', 30, 14]], wires: [[20, 14, 22, 14]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import Buzzer
from signal import pause

summer = Buzzer(23)
summer.beep(0.2, 0.8)      # 0,2 s an, 0,8 s aus, immer wieder

pause()
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Ultraschall-Abstand', info: 'Regler „Abstand“ am Sensor verändern und die Werte in der Konsole beobachten. Der Echo-Pin liefert 5 V, deshalb liegt ein Spannungsteiler (1 kΩ und 2 kΩ) davor: Der Pi verträgt an den GPIO-Pins nur 3,3 V.',
      make: () => ({ parts: [['PI', 12, 0], ['HCSR04', 30, 10, 0, '', { pos: 0.246 }], ['R', 22, 16, 0, '1k'], ['R', 22, 18, 1, '2k'], ['GND', 22, 22], ['GND', 30, 16]], wires: [[30, 10, 26, 10, 26, 0, 20, 0], [20, 14, 24, 14, 24, 12, 30, 12], [20, 16, 22, 16], [22, 16, 22, 18], [30, 14, 28, 14, 28, 16, 26, 16]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import DistanceSensor
from time import sleep

sensor = DistanceSensor(echo=24, trigger=23, max_distance=3)

while True:
    cm = sensor.distance * 100       # distance ist in Metern
    print(round(cm), "cm")
    sleep(0.5)
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Bewegungsmelder-Alarm', info: 'Regler „Bewegung“ am PIR-Sensor über 50 % ziehen: LED und Summer gehen an. Der PIR liefert 3,3 V und darf direkt an einen GPIO-Pin.',
      make: () => ({ parts: [['PI', 12, 0], ['PIR', 26, 12, 0, '', { pos: 0 }], ['GND', 26, 16], ['R', 22, 20, 0, '220'], ['LED', 26, 20, 0, 'rot'], ['GND', 30, 20], ['R', 22, 30, 0, '220'], ['SPK', 26, 30, 0, '8'], ['GND', 30, 30]], wires: [[26, 12, 24, 12, 24, 0, 20, 0], [20, 14, 26, 14], [20, 20, 22, 20], [20, 30, 22, 30]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import MotionSensor, LED, Buzzer
from signal import pause

pir = MotionSensor(23)
led = LED(25)
summer = Buzzer(12)

def alarm_an():
    led.on()
    summer.on()
    print("Bewegung!")

def alarm_aus():
    led.off()
    summer.off()

pir.when_motion = alarm_an
pir.when_no_motion = alarm_aus

pause()
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Servo mit AngularServo', info: 'Der Servo an GPIO23 fährt nacheinander auf 0°, 90° und 180°. Die rote Leitung des Servos gehört an 5 V, das Signal an den GPIO.',
      make: () => ({ parts: [['PI', 12, 0], ['SERVO', 24, 14], ['GND', 24, 18]], wires: [[20, 14, 24, 14], [24, 16, 26, 16, 26, 0, 20, 0]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import AngularServo
from time import sleep

servo = AngularServo(23, min_angle=0, max_angle=180)

while True:
    for winkel in (0, 90, 180, 90):
        servo.angle = winkel
        print("Winkel:", winkel)
        sleep(1)
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Star-Wars-Thema mit Lichtshow', info: 'Der Lautsprecher an GPIO23 spielt das Star-Wars-Thema (TonalBuzzer), dazu leuchten die drei LEDs reihum im Takt der Noten. Beim echten Pi braucht man dafür einen passiven Summer oder Lautsprecher, ein aktiver Summer kann nur einen festen Ton.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 14, 0, '100'], ['SPK', 26, 14, 0, '8'], ['GND', 30, 14], ['R', 22, 22, 0, '220'], ['LED', 26, 22, 0, 'gelb'], ['GND', 30, 22], ['R', 22, 30, 0, '220'], ['LED', 26, 30, 0, 'grün'], ['GND', 30, 30]], wires: [[20, 10, 22, 10], [20, 14, 22, 14], [20, 22, 22, 22], [20, 30, 22, 30]], scopes: [], tempo: 1,
      code: String.raw`from gpiozero import TonalBuzzer, LED
from time import sleep

summer = TonalBuzzer(23, octaves=2)
leds = [LED(18), LED(8), LED(12)]

# Die Melodie: Notenname und Länge in Sekunden
melodie = [("G4", 0.2), ("G4", 0.2), ("G4", 0.2), ("C5", 0.8), ("G5", 0.8),
           ("F5", 0.2), ("E5", 0.2), ("D5", 0.2), ("C6", 0.8), ("G5", 0.4),
           ("F5", 0.2), ("E5", 0.2), ("D5", 0.2), ("C6", 0.8), ("G5", 0.4),
           ("F5", 0.2), ("E5", 0.2), ("F5", 0.2), ("D5", 1.0)]

while True:
    nr = 0
    for note, laenge in melodie:
        led = leds[nr % 3]         # die LEDs reihum nehmen
        led.on()
        summer.play(note)
        sleep(laenge)
        summer.stop()
        led.off()
        sleep(0.06)                # kurze Pause zwischen den Noten
        nr += 1
    sleep(2)
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'Eigene Klasse: zwei Blinker', info: 'Zeigt eine eigene Klasse (Bauplan): Blinker legt eine LED an und kann blinken. Zwei Objekte (rot und gelb) blinken mit unterschiedlichem Takt.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16]], wires: [[20, 10, 22, 10], [20, 16, 22, 16]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import LED
from signal import pause

class Blinker:
    def __init__(self, pin):
        self.led = LED(pin)

    def start(self, takt):
        self.led.blink(on_time=takt, off_time=takt)

# Mit Vererbung ginge auch: class Schnell(Blinker) und super().__init__(pin)
rot = Blinker(18)
gelb = Blinker(24)
rot.start(0.5)
gelb.start(0.2)
pause()
` }) },
    { lab: 'pi', cat: 'I²C-Sensoren', name: 'Temperatur über I²C (LM75)', info: 'Der Temperatursensor LM75 hängt am I²C-Bus (SDA an GPIO2, SCL an GPIO3, Adresse 0x48). Das Programm liest zwei Bytes und rechnet sie in Grad Celsius um. Den Regler am Sensor ziehen. Der Pi hat die Pull-up-Widerstände für den Bus schon eingebaut.',
      make: () => ({ parts: [['PI', 12, 0], ['I2CTEMP', 2, 0, 0, '', { pos: 0.4 }], ['GND', 7, 8]], wires: [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8]], scopes: [], tempo: 0.75,
      code: String.raw`from smbus2 import SMBus
from time import sleep

ADRESSE = 0x48            # I2C-Adresse des LM75
bus = SMBus(1)            # Bus 1 = GPIO2 (SDA) und GPIO3 (SCL)

while True:
    daten = bus.read_i2c_block_data(ADRESSE, 0, 2)    # Register 0 = Temperatur, 2 Bytes
    wert = (daten[0] << 1) | (daten[1] >> 7)            # 9-Bit-Wert, 0,5 Grad pro Schritt
    if wert > 255:
        wert = wert - 512                               # negative Temperaturen
    print("Temperatur:", wert * 0.5, "°C")
    sleep(1)
` }) },
    { lab: 'pi', cat: 'I²C-Sensoren', name: 'Lichtsensor BH1750 (I²C) mit LED', info: 'Der Lichtsensor BH1750 (Adresse 0x23) misst die Helligkeit in Lux. Wird es dunkel (unter 100 lx), geht die LED an GPIO18 an. Regler am Sensor ziehen.',
      make: () => ({ parts: [['PI', 12, 0], ['I2CLUX', 2, 0, 0, '', { pos: 0.5 }], ['GND', 7, 8], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10]], wires: [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8], [20, 10, 22, 10]], scopes: [], tempo: 0.75,
      code: String.raw`from smbus2 import SMBus
from gpiozero import LED
from time import sleep

BH1750 = 0x23
bus = SMBus(1)
led = LED(18)

bus.write_byte(BH1750, 0x10)      # Messung starten (dauernd, hohe Auflösung)
sleep(0.2)

while True:
    daten = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((daten[0] << 8) | daten[1]) / 1.2
    print("Licht:", round(lux), "lx")
    if lux < 100:
        led.on()
    else:
        led.off()
    sleep(0.5)
` }) },
    { lab: 'pi', cat: 'I²C-Sensoren', name: 'Zwei Sensoren am selben I²C-Bus', info: 'Temperatursensor (Adresse 0x48) und Lichtsensor (Adresse 0x23) teilen sich dieselben zwei Leitungen SDA und SCL. Jedes Gerät hat eine eigene Adresse, so weiß der Pi, wen er anspricht.',
      make: () => ({ parts: [['PI', 12, 0], ['I2CTEMP', 2, 0, 0, '', { pos: 0.4 }], ['GND', 7, 8], ['I2CLUX', 2, 12, 0, '', { pos: 0.5 }], ['GND', 7, 20]], wires: [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8], [12, 0, 10, 0, 10, 12, 7, 12], [12, 2, 9, 2, 9, 14, 7, 14], [12, 4, 8, 4, 8, 16, 7, 16], [7, 18, 7, 20]], scopes: [], tempo: 0.75,
      code: String.raw`from smbus2 import SMBus
from time import sleep

LM75 = 0x48
BH1750 = 0x23
bus = SMBus(1)

bus.write_byte(BH1750, 0x10)
sleep(0.2)

while True:
    t = bus.read_i2c_block_data(LM75, 0, 2)
    wert = (t[0] << 1) | (t[1] >> 7)
    if wert > 255:
        wert = wert - 512
    l = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((l[0] << 8) | l[1]) / 1.2
    print(wert * 0.5, "°C und", round(lux), "lx")
    sleep(1)
` }) },
    { lab: 'pi', cat: 'Sensoren und Töne', name: 'Lauflicht mit LEDBoard', info: 'Vier LEDs an GPIO18, 24, 8 und 12 laufen nacheinander. LEDBoard fasst sie zu einer Liste zusammen.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16], ['R', 22, 22, 0, '220'], ['LED', 26, 22, 0, 'grün'], ['GND', 30, 22], ['R', 22, 30, 0, '220'], ['LED', 26, 30, 0, 'blau'], ['GND', 30, 30]], wires: [[20, 10, 22, 10], [20, 16, 22, 16], [20, 22, 22, 22], [20, 30, 22, 30]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import LEDBoard
from time import sleep

leds = LEDBoard(18, 24, 8, 12)

while True:
    for led in leds:
        led.on()
        sleep(0.2)
        led.off()
` }) },
    { lab: 'pi', cat: 'Grundlagen', name: 'LED mit RPi.GPIO (klassisch)', info: 'Dieselbe Schaltung wie das erste Beispiel, aber mit der älteren Bibliothek RPi.GPIO. Sie findet man in vielen Anleitungen im Internet. Hier musst du den Pin-Modus selbst einstellen.',
      make: () => ({ parts: [['PI', 12, 0], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], wires: [[12, 10, 10, 10]], scopes: [], tempo: 0.75,
      code: String.raw`import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)      # GPIO-Nummern (nicht Pin-Nummern)
GPIO.setup(17, GPIO.OUT)    # GPIO17 ist ein Ausgang

for i in range(5):
    GPIO.output(17, GPIO.HIGH)
    time.sleep(0.5)
    GPIO.output(17, GPIO.LOW)
    time.sleep(0.5)

GPIO.cleanup()              # aufräumen
` }) },
    { lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', name: 'Poti lesen (MCP3008)', info: 'Der Raspberry Pi hat keine analogen Eingänge. Der Wandler MCP3008 misst die Spannung am Poti und schickt sie als Zahl über vier Leitungen (SPI). Wandler MCP3008 mit Software-SPI an GPIO23 (Takt), GPIO24 (MISO), GPIO25 (MOSI) und GPIO8 (Chip-Select). VDD und VREF liegen an 3,3 V, AGND und DGND an Masse. Poti drehen: Regler unter dem Bauteil.',
      make: () => ({ parts: [['PI', 12, 0], ['MCP3008', 28, 6], ['POT', 40, 6, 1, '10k', { pos: 0.4 }], ['GND', 40, 10]], wires: [[28, 8, 26, 8, 26, 6, 26, -2, 26, -4, 10, -4, 10, 0, 12, 0], [28, 6, 26, 6], [20, 14, 28, 14], [20, 16, 28, 16], [28, 18, 24, 18, 24, 20, 20, 20], [28, 20, 26, 20, 26, 22, 20, 22], [20, 12, 26, 12, 28, 12], [28, 10, 26, 10, 26, 12], [40, 6, 40, -2, 26, -2], [42, 8, 44, 8, 44, 4, 36, 4, 36, 6, 34, 6]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import MCP3008
from time import sleep

# Software-SPI: Takt GPIO23, MISO GPIO24, MOSI GPIO25, Chip-Select GPIO8
poti = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)

while True:
    wert = poti.value              # 0.0 bis 1.0
    print("Poti:", round(wert * 100), "%")
    sleep(0.5)
` }) },
    { lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', name: 'Helligkeit messen (LDR)', info: 'Fotowiderstand und 10-kΩ-Widerstand bilden einen Spannungsteiler an Kanal 0. Regler „Licht“ am Fotowiderstand verändern. Wandler MCP3008 mit Software-SPI an GPIO23 (Takt), GPIO24 (MISO), GPIO25 (MOSI) und GPIO8 (Chip-Select). VDD und VREF liegen an 3,3 V, AGND und DGND an Masse.',
      make: () => ({ parts: [['PI', 12, 0], ['MCP3008', 28, 6], ['LDR', 40, 6, 1, '', { pos: 0.5 }], ['R', 40, 10, 1, '10k'], ['GND', 40, 14]], wires: [[28, 8, 26, 8, 26, 6, 26, -2, 26, -4, 10, -4, 10, 0, 12, 0], [28, 6, 26, 6], [20, 14, 28, 14], [20, 16, 28, 16], [28, 18, 24, 18, 24, 20, 20, 20], [28, 20, 26, 20, 26, 22, 20, 22], [20, 12, 26, 12, 28, 12], [28, 10, 26, 10, 26, 12], [40, 6, 40, -2, 26, -2], [40, 10, 38, 10, 38, 6, 34, 6]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import MCP3008
from time import sleep

licht = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)

while True:
    wert = licht.value
    if wert < 0.3:
        text = "dunkel"
    else:
        text = "hell"
    print(round(wert * 100), "% ->", text)
    sleep(0.5)
` }) },
    { lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', name: 'Temperatur messen (TMP36)', info: 'Der Sensor TMP36 liefert 0,5 V bei 0 °C und 10 mV pro Grad. voltage rechnet den Messwert in Volt um (bei 3,3 V Referenz). Regler „Temperatur“ am Sensor verändern. Wandler MCP3008 mit Software-SPI an GPIO23 (Takt), GPIO24 (MISO), GPIO25 (MOSI) und GPIO8 (Chip-Select). VDD und VREF liegen an 3,3 V, AGND und DGND an Masse.',
      make: () => ({ parts: [['PI', 12, 0], ['MCP3008', 28, 6], ['TMP36', 44, 8, 2, '', { pos: 0.394 }], ['GND', 40, 4]], wires: [[28, 8, 26, 8, 26, 6, 26, -2, 26, -4, 10, -4, 10, 0, 12, 0], [28, 6, 26, 6], [20, 14, 28, 14], [20, 16, 28, 16], [28, 18, 24, 18, 24, 20, 20, 20], [28, 20, 26, 20, 26, 22, 20, 22], [20, 12, 26, 12, 28, 12], [28, 10, 26, 10, 26, 12], [40, 8, 38, 8, 38, -2, 26, -2], [40, 6, 34, 6]], scopes: [], tempo: 0.75,
      code: String.raw`from gpiozero import MCP3008
from time import sleep

temp = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)

while True:
    volt = temp.voltage                 # in Volt (0 bis 3,3)
    celsius = (volt - 0.5) * 100        # TMP36: 0,5 V bei 0 Grad, 10 mV pro Grad
    print("Temperatur:", round(celsius, 1), "°C")
    sleep(0.5)
` }) },

    /* ---------- Projekte für zuhause: Licht am Fahrzeug (nur Modell auf dem Brett, kein Einbau) ---------- */
    { lab: 'code', cat: 'Projekt: Licht am Fahrzeug (Modell)', name: 'Lauflicht-Blinker (Modell)', info: 'Modell auf dem Steckbrett, nicht für den Einbau: Vier gelbe LEDs zeigen einen Lauflicht-Blinker. Der Taster an Pin 2 schaltet ihn ein und aus. Hinweis: Am Fahrzeug im Straßenverkehr dürfen nur Teile mit Prüfzeichen verbaut werden, Änderungen an der Beleuchtung können die Betriebserlaubnis erlöschen lassen.',
      make: () => ({ parts: [['UNO', 12, 0], ['PB', 34, 4, 1, ''], ['GND', 34, 8], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'gelb'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'gelb'], ['GND', 30, 14], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'gelb'], ['GND', 30, 18]], wires: [[20, 4, 34, 4], [20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14], [20, 18, 22, 18]], scopes: [], tempo: 0.75,
      code: String.raw`// Lauflicht-Blinker (Modell): Taster an Pin 2 schaltet ein und aus
int ledPins[] = {3, 5, 7, 9};
int anzahl = 4;
bool an = true;                                  // startet eingeschaltet
bool letzter = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);                    // Taster gegen Masse
  for (int i = 0; i < anzahl; i++) pinMode(ledPins[i], OUTPUT);
}

void alleAus() {
  for (int i = 0; i < anzahl; i++) digitalWrite(ledPins[i], LOW);
}

void loop() {
  bool jetzt = digitalRead(2);
  if (letzter == HIGH && jetzt == LOW) an = !an;   // Flanke: Taste wurde gedrückt
  letzter = jetzt;
  if (!an) { alleAus(); delay(20); return; }
  for (int i = 0; i < anzahl; i++) {               // Licht wandert in Fahrtrichtung
    digitalWrite(ledPins[i], HIGH);
    delay(90);
  }
  alleAus();
  delay(250);
}
` }) },
    { lab: 'code', cat: 'Projekt: Licht am Fahrzeug (Modell)', name: 'Bremslicht mit Notbremsblinken (Modell)', info: 'Modell auf dem Steckbrett: Taster an Pin 2 ist das Bremspedal. Gedrückt leuchtet das Bremslicht hell (zwei LEDs); wer lange bremst, bekommt schnelles Blinken. Nur Modell, kein Einbau: Im Straßenverkehr gelten für Bremslichter feste Vorschriften, nur geprüfte Teile sind erlaubt.',
      make: () => ({ parts: [['UNO', 12, 0], ['PB', 34, 4, 1, ''], ['GND', 34, 8], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'rot'], ['GND', 30, 14]], wires: [[20, 4, 34, 4], [20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14]], scopes: [], tempo: 0.75,
      code: String.raw`// Bremslicht (Modell): Pin 3 und 5 = Bremslicht, Pin 7 = Zusatz
// Rücklicht dunkel (PWM), Bremsen hell, lange Bremsung blinkt
unsigned long bremsStart = 0;
bool bremst = false;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, OUTPUT); pinMode(5, OUTPUT); pinMode(7, OUTPUT);
}

void loop() {
  bool druck = (digitalRead(2) == LOW);
  if (druck && !bremst) bremsStart = millis();
  bremst = druck;
  if (!bremst) {
    analogWrite(3, 40);                          // Rücklicht: gedimmt
    analogWrite(5, 40);
    digitalWrite(7, LOW);
  } else if (millis() - bremsStart < 1500) {
    analogWrite(3, 255); analogWrite(5, 255);    // Bremslicht: volle Helligkeit
    digitalWrite(7, HIGH);
  } else {                                       // lange Bremsung: Warnblinken
    bool blink = (millis() / 100) % 2;
    digitalWrite(3, blink); digitalWrite(5, blink); digitalWrite(7, blink);
  }
}
` }) },
    { lab: 'code', cat: 'Projekt: Licht am Fahrzeug (Modell)', name: 'Tagfahrlicht und Standlicht dimmen (Modell)', info: 'Modell auf dem Steckbrett: Pin 3 ist ein Tagfahrlicht (weiß), Pin 5 das Standlicht (gelb). Der Taster an Pin 2 wechselt zwischen Aus, Tagfahrlicht, Standlicht. Die Helligkeit wird über PWM weich verändert. Nur Modell: Am Fahrzeug ist dafür eine zugelassene Leuchte mit Prüfzeichen nötig.',
      make: () => ({ parts: [['UNO', 12, 0], ['PB', 34, 4, 1, ''], ['GND', 34, 8], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'weiß'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10]], wires: [[20, 4, 34, 4], [20, 6, 22, 6], [20, 10, 22, 10]], scopes: [], tempo: 0.75,
      code: String.raw`// Betriebsarten: 0 = aus, 1 = Tagfahrlicht, 2 = Standlicht
int modus = 1;                       // startet mit Tagfahrlicht
bool letzter = HIGH;
int h3 = 0, h5 = 0;                  // aktuelle Helligkeit (0 bis 255)

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, OUTPUT); pinMode(5, OUTPUT);
}

void loop() {
  bool jetzt = digitalRead(2);
  if (letzter == HIGH && jetzt == LOW) modus = (modus + 1) % 3;
  letzter = jetzt;
  int ziel3 = (modus == 1) ? 255 : 0;
  int ziel5 = (modus == 2) ? 90 : 0;
  if (h3 < ziel3) h3 += 5; else if (h3 > ziel3) h3 -= 5;   // weich überblenden
  if (h5 < ziel5) h5 += 5; else if (h5 > ziel5) h5 -= 5;
  analogWrite(3, constrain(h3, 0, 255));
  analogWrite(5, constrain(h5, 0, 255));
  delay(10);
}
` }) },
  ];

  /* Schutzleiter (PE) für Haus-Beispiele: Lampen (230 V), Heizlüfter und Drehstrommotor bekommen eine grün-gelbe Ader vom PE des Netzes.
     Die Leitung läuft unterhalb der Schaltung entlang, damit sie keine andere Leitung berührt. */
  function addPE(dd) {
    const OFF = { LAMP: [2, 2], HEAT: [2, 2], MOTOR3: [6, 3] }, SRC = { NETZ: [4, 0], NETZ3: [8, 0] };
    const rot = (x, y, r) => { switch (r & 3) { case 0: return [x, y]; case 1: return [-y, x]; case 2: return [-x, -y]; default: return [y, -x]; } };
    const pinAt = (p, off) => { const [a, b] = rot(off[0], off[1], p[3] || 0); return [p[1] + a, p[2] + b]; };
    const src = dd.parts.find(p => SRC[p[0]]); if (!src) return dd;
    const devs = dd.parts.filter(p => OFF[p[0]] && (p[0] !== 'LAMP' || /230\s*V/i.test(String(p[4] || ''))));
    if (!devs.length) return dd;
    const ends = new Set(); let maxY = -1e9;
    dd.wires.forEach(w => { const poly = typeof w[0] === 'string' ? w.slice(1) : w; for (let i = 0; i + 1 < poly.length; i += 2) { ends.add(poly[i] + ',' + poly[i + 1]); maxY = Math.max(maxY, poly[i + 1]); } });
    dd.parts.forEach(p => { maxY = Math.max(maxY, p[2] + 6); });
    const todo = devs.map(p => pinAt(p, OFF[p[0]])).filter(q => !ends.has(q[0] + ',' + q[1]));
    if (!todo.length) return dd;
    const sp = pinAt(src, SRC[src[0]]), yl = maxY + 4, wires = [['gruen', sp[0], sp[1], sp[0], yl]];
    todo.forEach(q => wires.push(['gruen', sp[0], yl, q[0], yl, q[0], q[1]]));
    return Object.assign({}, dd, { wires: dd.wires.concat(wires) });
  }
  EX.addPE = addPE;
  if (typeof module !== 'undefined' && module.exports) module.exports = EX; else { window.MORE_EX = EX; window.addPE = addPE; }
})();
