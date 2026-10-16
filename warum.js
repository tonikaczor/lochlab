'use strict';
/* Tonfunk Lab: „Warum?“-Erklärungen zu fehlgeschlagenen Prüfzeilen von SchaltLab, SimLab, DigiLab (und als Auffangnetz in den anderen Labs).
   Die Prüfungen selbst bleiben unverändert: warum.js ordnet dem Text einer fehlgeschlagenen Zeile eine kurze Erklärung zu.
   HausLab und MessLab bringen eigene Erklärungen mit, sie werden hier nicht überschrieben. Reihenfolge der Einträge: spezielle zuerst. */
(function (root) {
  const W = [
    [/Es fehlt eine Verbindung/, 'Zwei Anschlüsse, die zusammengehören, sind nicht durch einen Draht verbunden. Ziehe mit dem Werkzeug „Draht“ von dem einen Pin zum anderen. Ein Draht muss genau am Anschluss enden, sonst verbindet er nicht. Die Meldung nennt beide Bauteile mit der Pinnummer.'],
    [/Z-Diode fehlt/, 'Die Z-Diode hält die Spannung in Sperrrichtung konstant: Sie stabilisiert. Setze sie so ein, dass die Kathode (Strich) zur positiven Seite zeigt.'],
    [/Diode fehlt/, 'Die Diode lässt Strom nur in einer Richtung durch. In dieser Aufgabe richtet sie die Wechselspannung gleich.'],
    [/Elko fehlt|Kondensator fehlt/, 'Der Kondensator speichert Ladung. Er glättet Spannungen oder bildet mit einem Widerstand einen Filter. Ohne ihn fehlt diese Wirkung.'],
    [/Sicherungsautomat fehlt/, 'Der Sicherungsautomat schützt die Leitung vor Überlast und Kurzschluss. Er gehört direkt hinter den Netzanschluss in den Außenleiter.'],
    [/FI-Schutzschalter fehlt/, 'Der FI schützt Menschen: Er erkennt Fehlerströme und schaltet in Millisekunden ab. Er sitzt vor den Stromkreisen, die er schützen soll.'],
    [/Wechselschalter fehlt|Kreuzschalter fehlt/, 'Mit Wechselschaltern schaltest du eine Lampe von mehreren Orten. Zwei Wechselschalter sind durch zwei Wechseldrähte verbunden, bei drei Orten kommt ein Kreuzschalter in die Mitte.'],
    [/Schalter fehlt|Taster fehlt/, 'Der Schalter oder Taster fehlt im Stromweg. Setze ihn in den Außenleiter vor der Lampe oder dem Verbraucher.'],
    [/Schutzleiter/, 'Das Gehäuse eines Geräts muss mit dem Schutzleiter (PE, grün-gelb) verbunden sein. Gelangt bei einem Defekt Spannung ans Gehäuse, leitet der Schutzleiter den Strom ab, und FI oder Automat lösen aus. Ziehe eine grün-gelbe Ader vom PE des Netzes zum Gerät.'],
    [/löst nichts aus|nicht im Stromkreis/, 'Der Sicherungsautomat muss im Weg des Kurzschlussstroms liegen. Er sitzt direkt hinter dem Netzanschluss im Außenleiter, noch vor den Verbrauchern.'],
    [/Motorwicklungen/, 'Ein Drehstrommotor braucht alle drei Außenleiter L1, L2 und L3. Prüfe, dass jede Phase über den Schalter oder das Schütz bis zum Motor führt.'],
    [/Spannung am Heizlüfter/, 'Auf langen Leitungen fällt Spannung ab: U = I · R der Leitung. Ein größerer Querschnitt macht den Leitungswiderstand kleiner und den Spannungsfall geringer.'],
    [/schützt nicht die Leitung/, 'Der Automat muss die Leitung schützen: Sein Nennstrom darf nicht größer sein als der Strom, den die Leitung dauernd führen darf. Wähle einen kleineren Automaten oder einen größeren Querschnitt.'],
    [/Schleifenimpedanz/, 'Im Fehlerfall soll der Automat schnell auslösen. Dafür muss der Fehlerstrom groß genug sein: Z darf höchstens 230 V / (5 · Nennstrom) betragen. Kürzere Leitungen oder größerer Querschnitt senken die Schleifenimpedanz.'],
    [/Schalter ein: LED-Strom/, 'Ein Transistor schaltet erst, wenn ein Basisstrom fließt. Prüfe den Basiswiderstand und die Verbindung vom Schalter zur Basis, außerdem dass der Emitter an Masse liegt.'],
    [/LED-Strom/, 'Der LED-Strom ist I = (U − UF) / R mit UF von etwa 2 V bei einer roten LED. Ein größerer Vorwiderstand macht den Strom kleiner, ein kleinerer größer. Üblich sind 10 bis 20 mA.'],
    [/Voltmeter zeigt/, 'Die Spannung am Voltmeter folgt aus den Widerständen: U2 = U · R2 / (R1 + R2) (Spannungsteiler). Ändere den Widerstandswert, bis die Anzeige passt.'],
    [/Der Strom beträgt/, 'In einer Reihenschaltung gilt I = U / (R1 + R2). Ändere einen der Widerstände, bis der Strom passt.'],
    [/Vorwiderstand fehlt/, 'Ohne Vorwiderstand fließt durch die LED viel zu viel Strom, sie würde durchbrennen. Der Widerstand begrenzt den Strom.'],
    [/Widerstand.*fehlt/, 'Der Widerstand bestimmt den Strom oder teilt die Spannung. Setze ihn so ein, wie es der Aufgabentext beschreibt (in Reihe oder parallel).'],
    [/Ohne Fehler/, 'Ohne Defekt muss die Schaltung normal arbeiten: Die Lampe leuchtet, und kein Schutzorgan löst aus. Löst trotzdem etwas aus, ist die Schaltung falsch verdrahtet (Kurzschluss) oder überlastet. Prüfe die Verbindungen und den Verbraucher.'],
    [/Lampe ist aus|Lampen leuchten|schalten dieselbe Lampe|Beim Kurzschluss/, 'Der Stromweg ist nicht geschlossen oder falsch verdrahtet: Netz, Automat, Schalter oder Schütz, Lampe, zurück zum Neutralleiter. Schalte in „Sim“ alle Schalter einmal durch und prüfe, wo die Lampe keine Spannung bekommt.'],
    [/Mit S = .*Q|Nach S = |Mit R = |Nach R = /, 'Ein SR-Latch aus zwei überkreuz gekoppelten Gattern speichert ein Bit: S setzt Q auf 1, R setzt es auf 0, bei S = R = 0 bleibt der Zustand. Prüfe die Rückkopplung: Der Ausgang jedes Gatters geht an einen Eingang des anderen.'],
    [/Taktflanke/, 'Ein Flipflop übernimmt seinen Wert nur bei der steigenden Taktflanke. Prüfe, ob der Takt an allen Flipflops anliegt und wie die Stufen gekoppelt sind: beim Zähler Q̄ als Takt der nächsten Stufe, beim Schieberegister Q an D der nächsten Stufe.'],
    [/LEDs nacheinander/, 'Beim Schieberegister wandert der Wert von Stufe zu Stufe: Der Ausgang Q jeder Stufe geht an den Eingang D der nächsten, der Takt liegt an allen.'],
    [/Falsch bei: |Die Ausgabe sollte|Erwartet/, 'Dein Programm liefert eine andere Folge als verlangt. Starte es mit „Ein Schritt“ im Programmfenster und sieh dir nach jedem Befehl Register A und die Ausgabe an: So erkennst du, wo es abweicht.'],
    [/Falsch bei A=/, 'Die Wahrheitstabelle deiner Schaltung weicht in dieser Zeile ab. Stelle die Schalter auf diese Eingänge und verfolge das Signal von Gatter zu Gatter vom Eingang zum Ausgang: Dort, wo es zuerst vom Erwarteten abweicht, liegt der Fehler (falsches Gatter oder falsche Verbindung).'],
    [/fehlt \(\d+ von \d+\)/, 'Es fehlt ein Bauteil der verlangten Art. Wähle es in der Bauteilleiste unten (oder in der Liste links) und setze es in die Schaltung.']
  ];
  function decorate(lines) {
    (lines || []).forEach(l => { if (l && l.ok === false && !l.why) { const m = W.find(w => w[0].test(String(l.text))); if (m) l.why = m[1]; } });
    return lines;
  }
  root.Warum = { decorate, W };
})(window);
