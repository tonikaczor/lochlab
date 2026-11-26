'use strict';
/* Tonfunk Simulations- und EDA-Lab: Daten (Aufgaben-Generatoren, Schrittlisten).
   ALLE Zahlen (Spannungen, Ströme, Bauteilwerte, Mindestmaße) sind ÜBUNGSWERTE, nicht für die Praxis.
   window.EDA_DATA  { cats, tasks, gens, make, makeTask, randomQ, steps }
   window.EDA_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'eda', Status in localStorage 'lm4.eda.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Frage bringt mit: text, ask, value, tol, expl (Lösungsweg), tips (zwei Stufen), steps ("So gehst du vor").
   Verdeckte-Fehler-Prinzip: Titel bleiben neutral, ohne Zahlen und ohne Ergebnis.
   Nicht doppeln (siehe pcblab, simlab): Leiterbahnbreite nach Strom, Mehrlagen, DRC beheben, Schaltungen im Simulator aufbauen. */
(function (root) {
  const C = () => root.EDA_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Analysearten der Simulation', 'Ergebnisse lesen und bewerten', 'Modell und Wirklichkeit', 'Schaltplan und ERC', 'Fertigungsdaten', 'Vom Entwurf zur Freigabe'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const pq = POOL => (R) => { const q = POOL[C().ri(R, 0, POOL.length - 1)]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  const AN = ['Arbeitspunkt (DC)', 'Zeitverlauf (Transient)', 'Frequenzgang (AC)', 'Parameter-Sweep'];
  const ANQ = [
    ['Du willst wissen, welche Gleichspannung und welcher Gleichstrom sich in einer Schaltung nach dem Einschwingen einstellen. Welche Analyse wählst du?', 0, 'Der Arbeitspunkt (DC) berechnet die Ruhewerte ohne Zeit und ohne Frequenz: alle Spannungen und Ströme bei Gleichspannung.', ['Es geht um Ruhewerte, nicht um Verläufe.', 'Zeit und Frequenz spielen keine Rolle.']],
    ['Du willst sehen, wie die Spannung am Kondensator eines Netzteils nach dem Einschalten ansteigt und wie stark sie im Betrieb schwankt. Welche Analyse wählst du?', 1, 'Der Zeitverlauf (Transient) rechnet die Schaltung Schritt für Schritt über die Zeit und zeigt Anstieg und Schwankung.', ['Gefragt ist ein Verlauf über der Zeit.', 'Ein einzelner Wert reicht nicht.']],
    ['Du willst wissen, ab welcher Frequenz ein Filter ein Signal merklich abschwächt. Welche Analyse wählst du?', 2, 'Der Frequenzgang (AC) zeigt Verstärkung bzw. Dämpfung und Phase über der Frequenz. Daraus liest du die Grenzfrequenz ab.', ['Die Größe auf der waagerechten Achse ist die Frequenz.', 'Es geht um das Verhalten bei vielen Frequenzen.']],
    ['Du willst vergleichen, wie sich die Brummspannung ändert, wenn der Kondensator der Reihe nach 100 µF, 220 µF, 470 µF und 1000 µF hat. Welche Analyse hilft dir am meisten?', 3, 'Beim Parameter-Sweep ändert das Programm einen Bauteilwert in Schritten und rechnet für jeden Wert eine Analyse. Du siehst alle Ergebnisse nebeneinander.', ['Ein Bauteilwert wird in Schritten verändert.', 'Das Programm wiederholt die Rechnung selbst.']],
    ['Du willst die Einschwingzeit und das Überschwingen eines Schaltsignals nach einem Sprung messen. Welche Analyse wählst du?', 1, 'Sprungantwort und Einschwingen sind Vorgänge über der Zeit: Das ist der Zeitverlauf (Transient).', ['Wann passiert was nach dem Sprung?', 'Die Antwort hängt von der Zeit ab.']],
    ['Du willst die Phasenverschiebung zwischen Eingang und Ausgang eines Verstärkers von 1 kHz bis 100 kHz untersuchen. Welche Analyse wählst du?', 2, 'Phase und Verstärkung über der Frequenz liefert die AC-Analyse (Frequenzgang).', ['Die Frequenz wird durchgestimmt.', 'Der Eingang bleibt ein kleines Sinussignal.']]
  ];
  const DCQ = [
    ['Du simulierst den Arbeitspunkt (DC) einer Schaltung mit einem Kondensator. Wie behandelt das Programm den Kondensator?', 'Wie eine Unterbrechung, weil bei Gleichspannung nach dem Aufladen kein Strom mehr fließt', ['Wie einen Kurzschluss, weil er Strom durchlässt', 'Wie einen Widerstand mit dem Wert seiner Kapazität in Ohm', 'Er wird zufällig ein- oder ausgeschaltet'], 'Im Arbeitspunkt gilt der eingeschwungene Gleichstromfall. Ein Kondensator sperrt Gleichstrom und wirkt wie eine Unterbrechung.', ['Fließt durch einen geladenen Kondensator ein Gleichstrom?', 'Denke an den Zustand lange nach dem Einschalten.']],
    ['Du simulierst den Arbeitspunkt (DC) einer Schaltung mit einer idealen Spule. Wie behandelt das Programm die Spule?', 'Wie eine Drahtbrücke (Kurzschluss), weil sie bei Gleichstrom keinen Spannungsabfall hat', ['Wie eine Unterbrechung', 'Wie einen Widerstand von 1 kΩ', 'Wie eine Wechselspannungsquelle'], 'Eine ideale Spule hat bei Gleichstrom keine Spannung über sich und wirkt wie ein Draht.', ['Bei Gleichstrom ändert sich der Strom nicht mehr.', 'Spannung an der Spule ist L · Stromänderung.']],
    ['Ein Netzteil hat eine Wechselspannungsquelle am Eingang. Was setzt die Arbeitspunkt-Analyse (DC) dafür an?', 'Nur den Gleichanteil der Quelle, meist 0 V', ['Den Scheitelwert der Wechselspannung', 'Den Effektivwert der Wechselspannung', 'Die Frequenz der Quelle'], 'Die DC-Analyse kennt keine Zeit. Von der Quelle zählt nur der Gleichanteil, bei reiner Wechselspannung also 0 V.', ['Welche Größe ändert sich bei Gleichstrom nicht?', 'Zeit gibt es in dieser Analyse nicht.']],
    ['Welche Analyse zeigt dir den Einschaltstromstoß, der beim Laden eines leeren Kondensators fließt?', 'Der Zeitverlauf (Transient)', ['Der Arbeitspunkt (DC), weil er alle Ströme liefert', 'Der Frequenzgang (AC)', 'Keine: so etwas kann ein Programm nicht berechnen'], 'Der Stoß dauert nur kurz nach dem Einschalten. Nur der Zeitverlauf zeigt, wie der Strom über der Zeit abklingt.', ['Der Vorgang dauert nur kurz.', 'Der Arbeitspunkt zeigt den Zustand nach dem Einschwingen.']]
  ];
  const UEQ = [
    ['Ein Transistor wird in der Simulation als Schalter betrieben und ist ausgeschaltet (kein Basisstrom). Welche Spannung UCE liest du ungefähr ab?', 'Fast die gesamte Betriebsspannung', ['Etwa 0,2 V', 'Etwa 0,7 V', 'Etwa 0 V, weil kein Strom fließt'], 'Ohne Basisstrom sperrt der Transistor und es fließt kein Kollektorstrom. Am Kollektorwiderstand fällt nichts ab, also liegt fast die ganze Betriebsspannung an UCE.', ['Ohne Strom fällt am Kollektorwiderstand nichts ab.', 'Der Transistor sperrt wie ein offener Schalter.']],
    ['Ein Transistor (reales Modell) ist als Schalter eingeschaltet und gesättigt. Welche Spannung UCE zeigt die Simulation ungefähr?', 'Etwa 0,2 V', ['Etwa 0,7 V', 'Fast die gesamte Betriebsspannung', 'Etwa 5 V, immer'], 'Im gesättigten Zustand ist UCE klein, etwa 0,2 V (UCE,sat). Die 0,7 V gehören zur Basis-Emitter-Strecke.', ['Der Schalter ist fast geschlossen.', 'UBE und UCE sind verschiedene Spannungen.']],
    ['Wie groß ist die Spannung UBE eines leitenden Silizium-Transistors in der Simulation ungefähr?', 'Etwa 0,7 V', ['Etwa 0,2 V', 'Etwa 5 V', 'Etwa 0 V'], 'Die Basis-Emitter-Strecke ist eine Diode. Bei Silizium fallen im Durchlassbetrieb rund 0,7 V ab.', ['Die Basis-Emitter-Strecke verhält sich wie eine Diode.', 'Denke an die Schwellspannung von Silizium.']],
    ['Der Basisstrom eines Schalttransistors ist nur gerade so groß wie IC/B. Was zeigt die Simulation bei UCE?', 'UCE bleibt höher als nötig: Der Transistor ist nicht voll durchgeschaltet und wird wärmer', ['UCE ist genau 0 V', 'UCE ist negativ', 'Es ändert sich nichts, ein größerer Basisstrom bringt keinen Vorteil'], 'Ohne Übersteuerung wird die Sättigung nicht sicher erreicht. UCE steigt, die Verlustleistung am Transistor auch. Deshalb wird der Basisstrom mit einem Faktor größer als 1 gewählt.', ['Was fehlt beim knapp bemessenen Basisstrom?', 'Je höher UCE, desto höher die Verlustleistung UCE · IC.']]
  ];
  const IDQ = [
    ['Was nimmt das ideale Diodenmodell an?', 'In Durchlassrichtung 0 V Spannungsabfall, in Sperrrichtung kein Strom', ['In Durchlassrichtung 0,7 V Spannungsabfall, in Sperrrichtung 0,7 A Strom', 'In beiden Richtungen den gleichen Widerstand', 'Eine Spannungsabhängigkeit wie bei einer LED'], 'Die ideale Diode ist ein Schalter ohne Verluste: Durchlass wie ein Draht, Sperren wie eine Unterbrechung. Schwellspannung, Sperrstrom und Temperatur fehlen.', ['Ein idealer Schalter hat keine Verluste.', 'Das reale Verhalten mit 0,7 V gehört zum besseren Modell.']],
    ['Welche Eigenschaft hat ein idealer Kondensator im Simulationsprogramm, die ein echter nicht hat?', 'Er hat keinen Serienwiderstand (ESR), keinen Leckstrom und keine Toleranz', ['Er speichert Energie', 'Er lässt Gleichstrom nicht dauerhaft durch', 'Er hat eine Spannungsfestigkeit'], 'Das ideale Modell besteht nur aus der Kapazität. Echte Kondensatoren haben Toleranz, ESR und Leckstrom. Speichern und Sperren von Gleichstrom machen auch das ideale Modell.', ['Was lässt das ideale Modell weg?', 'Prüfe jede Antwort: Gilt sie nur für das ideale Modell?']],
    ['Was bedeutet „ideale Spannungsquelle“ in der Simulation?', 'Der Innenwiderstand ist 0 Ω, die Spannung bricht bei Belastung nicht ein', ['Die Quelle liefert nur Wechselspannung', 'Die Quelle hat einen Innenwiderstand von 1 Ω', 'Die Quelle kann nicht überlastet werden, weil sie Strom aufnimmt'], 'Eine ideale Quelle hält ihre Spannung bei jedem Strom. Echte Quellen (Batterie, Trafo) haben einen Innenwiderstand, ihre Spannung sinkt unter Last.', ['Wie verhält sich die Spannung unter Last?', 'Reale Batterien werden bei Belastung schwächer.']],
    ['Welche Annahme steckt im Standardmodell eines Widerstands im Simulationsprogramm?', 'Der Wert ist genau und ändert sich nicht mit Temperatur und Frequenz', ['Der Wert streut zufällig um ±5 % bei jedem Lauf', 'Der Wert steigt mit der Spannung', 'Der Widerstand hat immer eine kleine Induktivität'], 'Standardmodelle sind ideal: genau der eingegebene Wert, ohne Toleranz, Temperaturgang oder Eigeninduktivität.', ['Was ist beim eingegebenen Wert verborgen: Streuung oder Genauigkeit?', 'Der Wert wird einfach übernommen.']]
  ];
  const WARQ = [
    ['Die Messung der Brummspannung zeigt 2,4 V, die Simulation 2,0 V. Der Elko hat laut Datenblatt eine Toleranz von ±20 %. Welche Ursache ist plausibel?', 'Der Elko hat weniger als den Nennwert und liegt am unteren Ende der Toleranz', ['Die Simulation rechnet zu langsam', 'Das Oszilloskop zeigt immer 20 % zu viel an', 'Der Strom fließt in Wirklichkeit in die andere Richtung'], 'Weniger Kapazität bedeutet mehr Brummspannung. Das passt zur Abweichung und liegt innerhalb der Toleranz. Die anderen Gründe sind nicht begründbar.', ['Wie hängt Brumm von der Kapazität ab?', 'Welche Angabe im Datenblatt streut?']],
    ['Ein hochohmiger Spannungsteiler (Widerstände je 1 MΩ) zeigt mit dem Multimeter weniger Spannung als in der Simulation. Welche Ursache ist plausibel?', 'Das Messgerät hat einen endlichen Innenwiderstand und belastet den Teiler', ['Die Widerstände sind in Wirklichkeit supraleitend', 'Das Multimeter misst immer zu wenig', 'Die Spannung hängt nicht von den Widerständen ab'], 'Das Messgerät liegt parallel zu einem Widerstand und verändert den Teiler. Bei hochohmigen Schaltungen ist der Messfehler groß.', ['Das Messgerät ist selbst ein Widerstand.', 'Welcher Wert ist neben 1 MΩ nicht mehr klein?']],
    ['Zwei LEDs gleichen Typs haben an demselben Vorwiderstand etwas unterschiedliche Ströme. Welche Ursache ist plausibel?', 'Die Flussspannung der LEDs streut von Exemplar zu Exemplar', ['Die LEDs sind verschieden alt, ein Strom fließt „nach hinten“', 'Das Simulationsprogramm hat die LEDs vertauscht', 'Strom hängt nur vom Widerstand ab und kann gar nicht streuen'], 'LEDs desselben Typs haben unterschiedliche Flussspannungen. Das ändert den Strom durch den Vorwiderstand ein wenig.', ['Welche Größe der LED ist im Modell fest?', 'Der Strom ergibt sich aus (UB − UF)/RV.']],
    ['Die gemessene Ausgangsspannung eines Netzteils liegt bei Last unter dem simulierten Wert. Welche Ursache ist plausibel?', 'Der Trafo und die Leitungen haben Innenwiderstände, die unter Last Spannung abfallen lassen', ['Das ideale Modell der Quelle hat zu wenig Innenwiderstand, deshalb gleicht die Messung aus', 'Das Netzteil liefert unter Last grundsätzlich mehr Spannung', 'Gleichspannung hängt nicht von der Last ab'], 'Die ideale Quelle der Simulation hat 0 Ω Innenwiderstand. In Wirklichkeit fällt unter Last an Trafo und Leitungen Spannung ab.', ['Wie verhält sich die ideale Quelle unter Last?', 'Die Wirklichkeit hat Widerstände, die das Modell weglässt.']]
  ];
  const PLQ = [
    ['Ein Netzteil mit 12 V Wechselspannung (Effektivwert) wurde mit Brücke und Elko simuliert. Welches Ergebnis ist unplausibel?', 'Die geglättete Gleichspannung beträgt 21 V', ['Die geglättete Gleichspannung beträgt etwa 15 V', 'Die Brummspannung beträgt 1,5 V', 'Der Mittelwert der Gleichspannung beträgt etwa 14 V'], 'Der Scheitelwert beträgt 12 V · 1,41 − 1,4 V ≈ 15,6 V. Mehr als das kann die Gleichspannung nicht erreichen, 21 V sind also nicht möglich.', ['Wie hoch kann die Gleichspannung höchstens werden?', 'Rechne den Scheitelwert hinter der Brücke aus.']],
    ['Eine LED (rot) wird an 5 V mit 330 Ω betrieben. Welches Ergebnis ist unplausibel?', 'Der LED-Strom beträgt 150 mA', ['Der LED-Strom beträgt etwa 9 mA', 'Am Widerstand fallen etwa 3,1 V ab', 'An der LED liegen etwa 1,9 V'], 'Mit (5 V − 1,9 V)/330 Ω fließen etwa 9 mA. 150 mA wären nur bei etwa 20 Ω Widerstand möglich.', ['Rechne den Strom mit dem Ohmschen Gesetz grob nach.', 'Wie viel Spannung bleibt für den Widerstand übrig?']],
    ['Ein RC-Tiefpass hat die Grenzfrequenz 1 kHz. Welches Simulationsergebnis ist unplausibel?', 'Bei 10 kHz wird weniger gedämpft als bei 100 Hz', ['Bei 100 Hz wird fast nichts gedämpft', 'Bei 1 kHz beträgt die Dämpfung etwa 3 dB', 'Bei 10 kHz beträgt die Dämpfung etwa 20 dB'], 'Ein Tiefpass dämpft hohe Frequenzen stärker. Dass 10 kHz weniger gedämpft werden als 100 Hz, widerspricht dem Verhalten.', ['Ein Tiefpass lässt tiefe Frequenzen durch.', 'Bei der Grenzfrequenz sind es etwa 3 dB.']],
    ['Ein Transistor schaltet in der Simulation eine Last. Welches Ergebnis im eingeschalteten Zustand ist unplausibel?', 'UBE beträgt 5 V', ['UBE beträgt etwa 0,7 V', 'UCE beträgt etwa 0,2 V', 'Der Basisstrom ist viel kleiner als der Kollektorstrom'], 'Die Basis-Emitter-Strecke ist eine Diode. Sie begrenzt UBE auf etwa 0,7 V, höhere Werte kommen nicht vor.', ['Wie groß ist UBE bei Silizium?', 'Die Basis-Emitter-Strecke begrenzt die Spannung.']]
  ];
  const ERCQ = [
    ['Der ERC meldet: „Pin U2.GND ist nicht angeschlossen.“ Was bedeutet das?', 'Der Pin hat keine Verbindung zu einem Netz', ['Der Pin ist nur falsch beschriftet', 'Das Bauteil U2 ist defekt', 'Das Bauteil hat keinen Footprint'], 'Eine Meldung „nicht angeschlossen“ heißt: An diesem Pin endet keine Leitung und er trägt kein Netz. Entweder fehlt die Verbindung oder der Pin muss bewusst als nicht benutzt markiert werden.', ['Es geht um die Verbindung, nicht um die Beschriftung.', 'Fehlt eine Leitung am Pin?']],
    ['Der ERC meldet: „Das Netz SENS1 hat nur einen Anschluss.“ Was bedeutet das?', 'An dem Netz hängt nur ein einziger Pin, es verbindet nichts', ['Das Netz hat zu viele Anschlüsse', 'Das Netz führt Netzspannung', 'Das Netz ist doppelt vorhanden und doppelt gezählt'], 'Ein Netz soll mindestens zwei Pins verbinden. Ein einzelner Pin deutet meist auf einen Tippfehler im Netznamen oder eine fehlende Leitung.', ['Wie viele Pins hängen am Netz?', 'Eine Verbindung braucht mindestens zwei Enden.']],
    ['Der ERC meldet: „Der Eingang U2.IN hat keinen Treiber.“ Was bedeutet das?', 'An dem Netz hängt kein Ausgang und keine Quelle, die den Eingang speist', ['Der Eingang ist zu langsam', 'Der Eingang hat keine Referenznummer', 'Der Eingang hängt an zu vielen Ausgängen'], 'Ein Eingang braucht eine Quelle, die ihn treibt (Ausgang oder Versorgung). Fehlt sie, schwebt der Eingang, die Schaltung funktioniert nicht.', ['Was soll einen Eingang antreiben?', 'Es fehlt etwas, das am Netz „schreibt“.']],
    ['Der ERC meldet eine Warnung: „Für R1 ist kein Footprint zugewiesen.“ Was ist gemeint?', 'Dem Schaltplansymbol fehlt das Gehäuse für das Layout', ['Der Widerstand hat keinen Wert', 'R1 hängt nicht am Netz', 'R1 muss aus dem Schaltplan gelöscht werden'], 'Für das Layout braucht jedes Bauteil einen Footprint, also die Pad-Anordnung seines Gehäuses. Er wird in der Bauteilzuordnung vergeben.', ['Was braucht das Layout von jedem Bauteil?', 'Es geht um das Gehäuse, nicht um die Schaltung.']]
  ];
  const ZAQ = [
    ['Zwei Ausgänge verschiedener Bauteile liegen am selben Netz. Warum ist das ein Fehler?', 'Die beiden Ausgänge können gegeneinander arbeiten, einer will „hoch“, der andere „tief“ ziehen', ['Weil ein Netz höchstens zwei Pins haben darf', 'Weil Ausgänge nur Strom aufnehmen dürfen', 'Weil Ausgänge nie verbunden sein dürfen, auch nicht mit einem Eingang'], 'Ein Ausgang legt den Pegel des Netzes fest. Wollen zwei Ausgänge verschiedene Pegel, fließt ein Kurzschlussstrom, im Zweifel wird ein Baustein zerstört.', ['Was passiert, wenn zwei Quellen verschiedene Spannungen wollen?', 'Ausgang an Eingang ist normal, Ausgang an Ausgang nicht.']],
    ['Wie behebst du die ERC-Meldung „Zwei Ausgänge verbunden“ am sinnvollsten?', 'Du prüfst, welche der beiden Verbindungen gewollt ist, und trennst die andere', ['Du schaltest die Meldung im ERC ab', 'Du gibst beiden Ausgängen denselben Netznamen', 'Du löschst den Eingang des Netzes'], 'Erst klären, was die Schaltung wirklich will: Meist hängt ein Pin am falschen Netz. Meldungen abschalten verdeckt nur den Fehler.', ['Zuerst die Ursache finden, dann ändern.', 'Warnungen abzuschalten behebt nichts.']],
    ['Welche Pinkombination löst die Meldung „Zwei Ausgänge verbunden“ aus?', 'Ein Ausgang und ein zweiter Ausgang am selben Netz', ['Ein Ausgang und ein Eingang am selben Netz', 'Zwei passive Pins am selben Netz', 'Ein Ausgang und ein Versorgungseingang am selben Netz'], 'Normal ist: ein Ausgang treibt einen oder mehrere Eingänge. Nur wenn zwei Treiber zusammenkommen, meldet der ERC den Fehler.', ['Wer treibt, wer hört zu?', 'Zwei Treiber an einem Netz sind das Problem.']],
    ['Der ERC meldet zwei Ausgänge am Netz „SENS“. Du siehst im Schaltplan nur eine Leitung. Was prüfst du?', 'Ob ein zweites Bauteil über ein Netzlabel oder einen Netznamen am selben Netz hängt', ['Ob der Schaltplan ausgedruckt ist', 'Ob alle Bauteile dieselbe Farbe haben', 'Ob das Netz in der Stückliste steht'], 'Netze werden nicht nur durch gezeichnete Leitungen verbunden, sondern auch durch gleiche Netznamen. Ein zweiter Ausgang kann über einen Namen auf dem Netz liegen.', ['Wie kann ein Netz ohne sichtbare Leitung verbunden werden?', 'Suche nach Namen, nicht nur nach Linien.']]
  ];
  const VOQ = [
    ['Der ERC meldet: „Der Versorgungspin U1.IN wird von keiner Quelle gespeist.“ Die Batterie J1 ist angeschlossen. Was ist am wahrscheinlichsten?', 'Der Netzname am Reglereingang unterscheidet sich vom Netznamen an der Batterie, z. B. wegen eines Tippfehlers', ['Der Regler U1 ist zu groß', 'Die Batterie hat zu viel Spannung', 'U1 braucht keinen Eingang'], 'Ein Tippfehler im Netznamen trennt das Netz in zwei Teile. Am Reglereingang bleibt dann keine Quelle übrig.', ['Vergleiche die Netznamen an Batterie und Regler.', 'Zwei Schreibweisen sind zwei Netze.']],
    ['Eine Versorgung kommt von einem Steckverbinder, dessen Pins im Programm als „passiv“ gelten. Der ERC meldet: „Versorgungspin nicht gespeist“. Was hilft?', 'Dem Netz eine Quelle zuweisen, z. B. mit einer Versorgungsmarke (Power-Flag)', ['Die Meldung ignorieren, ist immer harmlos', 'Den Eingang des Bausteins löschen', 'Das Netz umbenennen, bis die Meldung weg ist'], 'Der ERC weiß nicht, dass der Stecker die Versorgung liefert. Mit einer Marke sagst du dem Programm, dass hier bewusst eingespeist wird. Das ist eine bewusste Entscheidung, kein Ausschalten der Prüfung.', ['Wer speist das Netz aus Sicht des ERC?', 'Der Stecker ist für den ERC nur passiv.']],
    ['Was ist die Aufgabe eines Netznamens wie „+5V“ in einem Schaltplan?', 'Pins mit demselben Namen sind elektrisch verbunden, auch ohne gezeichnete Leitung', ['Er schreibt die Spannung an die Leitung, ohne dass sie fließt', 'Er legt die Farbe der Leiterbahn fest', 'Er begrenzt den Strom im Netz'], 'Der Netzname ordnet Pins zu einem Netz. Das spart Leitungen und sorgt für Übersicht. Er verändert aber nichts an Spannung oder Strom.', ['Was verbindet Pins außer einer Leitung noch?', 'Der Name gehört zur Netzliste.']],
    ['Der Regler U1 hat seinen Eingang auf Netz „+9V“ und die Batterie auf Netz „+9v“ (kleines v). Der ERC meldet für U1.IN „nicht gespeist“. Was ist die Ursache?', 'Die Netzname-Schreibweise stimmt nicht überein, das Programm sieht zwei verschiedene Netze', ['Das Programm kann keine Kleinbuchstaben lesen', 'Der Regler braucht einen größeren Kondensator', 'Die Batterie ist leer'], 'In dem Programm sind beide Schreibweisen unterschiedliche Netznamen, dann hängen Batterie und Regler an getrennten Netzen. Netznamen müssen exakt gleich sein.', ['Sind „+9V“ und „+9v“ gleich geschrieben?', 'Ein Netzname gilt nur, wenn er genau passt.']]
  ];
  const DRQ = [
    ['Zwei Bauteile im Schaltplan haben dieselbe Referenz „R3“. Was ist die Folge?', 'Stückliste und Layout lassen sich nicht eindeutig zuordnen: Wer ist welcher R3?', ['Keine, das Programm rechnet beide zusammen', 'Beide Bauteile haben automatisch denselben Wert', 'Das Layout wird kleiner'], 'Die Referenz ist der Name des Bauteils. Doppelte Namen machen Positionen, Stückliste und Bestückung mehrdeutig. Die Annotation vergibt neue Referenzen.', ['Eine Referenz soll ein Bauteil eindeutig benennen.', 'Wie findet die Bestückung „R3“?']],
    ['Wie behebst du eine doppelte Referenz am schnellsten?', 'Die Annotation (Neunummerierung) durchführen, sodass jede Referenz nur einmal vergeben wird', ['Beide Bauteile in „R“ umbenennen', 'Ein Bauteil löschen', 'Den Wert eines Bauteils ändern'], 'Die Annotation nummeriert die Bauteile automatisch durch. So bleibt jede Referenz eindeutig.', ['Die Nummern lassen sich automatisch vergeben.', 'Wer vergibt Nummern am zuverlässigsten?']]
  ];
  const FPQ = [
    ['Ein bedrahteter Widerstand (0,25 W) soll auf der Platine in Bohrungen gelötet werden. Welcher Footprint passt?', 'Ein Footprint für bedrahtete Bauteile (THT) mit Bohrungen im passenden Rastermaß', ['Ein SMD-Chip-Footprint ohne Bohrungen', 'Ein Footprint für ein Gehäuse mit acht Beinchen', 'Ein beliebiger, die Pads lassen sich später ändern'], 'Der Footprint muss zum echten Gehäuse passen: THT hat Bohrungen im Raster (z. B. 2,54 mm bzw. Vielfache), SMD hat Pads auf der Oberfläche.', ['Wird gebohrt oder auf die Oberfläche gelötet?', 'Der Footprint folgt dem realen Bauteil.']],
    ['Ein Kondensator 100 nF in der Bauform 0805 soll bestückt werden. Welcher Footprint passt?', 'Ein SMD-Footprint der Bauform 0805', ['Ein THT-Footprint mit Bohrungen', 'Ein Footprint 0603, weil er kleiner ist', 'Ein Footprint für einen Elko'], 'Bauform und Footprint müssen übereinstimmen. Die Bezeichnung 0805 nennt die Gehäusegröße.', ['Die Gehäusebezeichnung steht im Footprint-Namen.', 'Ein anderes Gehäuse passt nicht auf die Pads.']],
    ['Wo vergibst du im Entwurf, welcher Footprint zu welchem Schaltplansymbol gehört?', 'In der Bauteilzuordnung (Footprint-Zuordnung), bevor das Layout beginnt', ['Erst im Layout beim Bestellen', 'Im Bohrplan der Fertigung', 'Gar nicht, das Programm errät es'], 'Die Zuordnung verbindet Symbol und Gehäuse. Sie muss vor dem Layout fertig sein, sonst fehlen im Layout die Bauteile.', ['Wann braucht das Layout die Gehäuse?', 'Der Schritt liegt zwischen Schaltplan und Layout.']],
    ['Ein Widerstand soll in einem anderen Gehäuse gekauft werden, als der zugewiesene Footprint vorsieht. Was ist zu tun?', 'Footprint oder Bauteilwahl anpassen, damit beide zusammenpassen, und die Stückliste prüfen', ['Nichts, ein Widerstand passt überall hin', 'Die Pads im Layout ungefähr zurechtziehen', 'Den Widerstand im Schaltplan umbenennen'], 'Footprint und echtes Bauteil müssen übereinstimmen, sonst lässt sich die Platine nicht bestücken. Die Stückliste muss zum gewählten Gehäuse passen.', ['Passt das echte Bauteil auf die Pads?', 'Welche beiden Dokumente müssen übereinstimmen?']]
  ];
  const LAQ = [
    ['Zwei Pins tragen im Schaltplan das gleiche Netzlabel „TAKT“, es ist aber keine Leitung dazwischen gezeichnet. Sind die Pins elektrisch verbunden?', 'Ja, gleiche Netzlabels verbinden die Pins zu einem Netz', ['Nein, nur gezeichnete Leitungen verbinden', 'Nur wenn beide Pins Ausgänge sind', 'Nur wenn auf dem Blatt „GND“ steht'], 'Netzlabels gleichen Namens gehören zum selben Netz. So lassen sich Leitungen sparen und Blätter übersichtlich halten.', ['Was legt ein Netzlabel fest?', 'Prüfe die Regel für gleiche Namen.']],
    ['Wozu dient ein Power-Symbol wie „+5V“ oder „GND“ im Schaltplan?', 'Es legt ein Versorgungsnetz fest, an dem alle gleichnamigen Symbole hängen', ['Es zeichnet die Bauteile größer', 'Es misst die Spannung im Layout', 'Es ersetzt die Stückliste'], 'Power-Symbole sind Netznamen mit Symbol. Alle Symbole mit gleichem Namen liegen auf demselben Netz.', ['Es ist ein Netzname mit Symbol.', 'Wie viele Netze gibt es für „GND“?']],
    ['Warum zeichnest du den Signalfluss im Schaltplan möglichst von links nach rechts und die Versorgung oben, Masse unten?', 'Der Plan wird dadurch übersichtlich und leichter prüfbar', ['Weil der ERC sonst nicht startet', 'Weil das Layout sonst Fehler zeigt', 'Weil der Hersteller es verlangt'], 'Eine geordnete Zeichnung zeigt Fehler schneller. Für den ERC und die Funktion ist die Anordnung egal.', ['Was gewinnt der Leser?', 'Für die Elektrik spielt die Lage der Symbole keine Rolle.']],
    ['Warum bekommen Netze sprechende Namen wie „SENS“ oder „LED_A“ statt „N001“?', 'Man erkennt im Schaltplan und in Meldungen schneller, worum es geht', ['Weil der Name den Strom im Netz erhöht', 'Weil nur benannte Netze gefertigt werden', 'Weil das Layout sonst keine Leiterbahnen findet'], 'Sprechende Namen helfen beim Lesen, Prüfen und bei Fehlermeldungen. An der Funktion ändern sie nichts.', ['Wer liest den Plan später?', 'Der Name beeinflusst keine Messwerte.']]
  ];
  const PAQ = [
    ['Wozu dient die Pastenlage (Lötpaste)?', 'Sie zeigt, wo Lötpaste durch die Schablone auf die SMD-Pads gedruckt wird', ['Sie zeigt die Lage der Bohrungen', 'Sie färbt die Platine grün', 'Sie enthält die Bauteilbeschriftung'], 'Die Pastenlage ist die Vorlage für die Schablone. Nur SMD-Pads bekommen Paste, durchkontaktierte Bohrungen nicht.', ['Welche Pads werden mit Paste bedruckt?', 'Die Schablone entsteht aus dieser Lage.']],
    ['Welche Pads erscheinen in der Pastenlage?', 'Die Pads der SMD-Bauteile', ['Alle Bohrungen der Platine', 'Nur die Montagelöcher', 'Die Bauteilreferenzen'], 'Gelötet wird in der Reflow-Technik mit Paste auf den SMD-Pads. THT-Bohrungen werden meist anders gelötet und stehen nicht in der Pastenlage.', ['Wo wird Paste gebraucht?', 'Bedrahtete Anschlüsse stecken in Bohrungen.']],
    ['Was zeigt die Lötstoppmaske-Datei?', 'Die Öffnungen im Lack, an denen das Kupfer frei bleibt', ['Alle Stellen, die mit Lack bedeckt sind, als Fläche', 'Die Leiterbahnen auf der Rückseite', 'Die Umrisse der Bauteile'], 'Die Datei beschreibt die Öffnungen: Wo eine Fläche gezeichnet ist, wird der Lack ausgespart. Nur dort lässt sich löten.', ['Gezeichnete Flächen sind Öffnungen.', 'Wo muss Kupfer frei bleiben?']],
    ['Warum ist die Maskenöffnung meist etwas größer als das Pad?', 'Damit auch bei kleinen Versätzen kein Lack auf das Pad gerät', ['Weil die Maske dann besser hält', 'Weil das Pad sonst keinen Strom führt', 'Damit die Platine leichter wird'], 'Beim Auftragen der Maske gibt es Lagetoleranzen. Eine etwas größere Öffnung sichert, dass das Pad frei bleibt.', ['Es gibt immer kleine Versätze.', 'Lack auf dem Pad verhindert das Löten.']]
  ];
  const BEQ = [
    ['Was steht in den Bestückungsdaten (Pick-and-Place-Datei)?', 'Referenz, Position (X/Y), Drehung und Seite jedes Bauteils', ['Nur Stückzahl und Preis', 'Der Verlauf aller Leiterbahnen', 'Durchmesser der Bohrungen'], 'Der Bestückungsautomat braucht für jedes Bauteil, wo es hin muss, wie es zu drehen ist und auf welche Seite es gehört.', ['Was muss der Automat für jedes Bauteil wissen?', 'Es geht um Lage und Orientierung.']],
    ['Was enthält die Stückliste im Unterschied zur Bestückungsdatei?', 'Werte, Gehäuse und Stückzahl je Position, aber keine Koordinaten', ['Koordinaten und Drehwinkel jedes Bauteils', 'Den Verlauf der Leiterbahnen', 'Nur die Bohrdurchmesser'], 'Die Stückliste sagt, was bestellt und bestückt wird. Die Bestückungsdatei sagt, wo jedes Teil sitzt.', ['Was wird eingekauft?', 'Wo etwas liegt, steht in der anderen Datei.']],
    ['Warum ist die Drehung (Rotation) in der Bestückungsdatei wichtig?', 'Der Automat setzt gepolte Bauteile sonst um 90° oder 180° verdreht auf', ['Damit das Bauteil leichter wird', 'Weil die Drehung die Bauteilwerte festlegt', 'Damit die Leiterbahnen kürzer werden'], 'Die Lage des Bauteils im Bestückungsprogramm kann von der Lage in der Verpackung abweichen. Stimmt die Drehung nicht, sitzen z. B. ICs und Dioden falsch.', ['Was passiert bei einer gepolten Diode?', 'Pin 1 muss an die richtige Stelle.']],
    ['Was zeigt der Bestückungsdruck zur Polung einer Diode?', 'Eine Markierung am Kathodenstrich bzw. an Pin 1, damit man die Richtung erkennt', ['Den Preis der Diode', 'Die Länge der Leiterbahn', 'Die Farbe der Lötstoppmaske'], 'Der Druck zeigt Referenz und Polarität, damit Bestückung und Prüfung die Richtung sicher erkennen.', ['Wie erkennt man die Richtung einer Diode?', 'Pin 1 und Kathode werden markiert.']]
  ];
  const EDQ = [
    ['Was prüft der ERC, was prüft der DRC?', 'ERC prüft die Schaltung im Schaltplan (Pins, Netze), DRC das Layout (Abstände, Breiten, Bohrungen)', ['ERC prüft das Layout, DRC den Schaltplan', 'Beide prüfen dasselbe, nur zu verschiedenen Zeiten', 'ERC prüft die Fertigungsdaten, DRC die Bauteile'], 'ERC = Electrical Rules Check für den Schaltplan, DRC = Design Rules Check für die Geometrie im Layout.', ['Das E steht für „Electrical“, das D für „Design“.', 'Schaltplan oder Layout?']],
    ['Warum führst du den ERC vor dem Layout durch?', 'Ein Fehler im Schaltplan zieht sich sonst durch das ganze Layout, Korrekturen kosten später mehr', ['Weil der ERC das Layout automatisch erzeugt', 'Weil der Hersteller den ERC-Bericht verlangt', 'Weil es ohne ERC keine Bauteile gibt'], 'Je früher ein Fehler gefunden wird, desto billiger ist die Korrektur. Eine Änderung im Schaltplan nach dem Routen bedeutet oft viel Nacharbeit.', ['Wann ist eine Korrektur am billigsten?', 'Was baut auf dem Schaltplan auf?']],
    ['Der DRC meldet, dass der Abstand zwischen zwei Leiterbahnen kleiner ist als die Regel. Welche Prüfung hat das gemeldet?', 'Der DRC, weil es um Geometrie im Layout geht', ['Der ERC, weil es um Netze geht', 'Der Hersteller vor der Bestellung', 'Keine, Abstände werden nicht geprüft'], 'Abstände, Leiterbahnbreiten und Bohrungen prüft der DRC gegen die Entwurfsregeln.', ['Geht es um Elektrik der Netze oder um Maße?', 'Abstände sind Maße.']],
    ['Eine Meldung im DRC lässt sich nicht beheben. Wie gehst du vor?', 'Meldung bewerten, Ursache beheben oder die Regel begründet ändern, keine Fehler einfach ignorieren', ['Die Meldung ignorieren, die Fertigung merkt es nicht', 'Die Regel auf null setzen', 'Alle Meldungen abschalten'], 'Ein Fehler wird beseitigt, oder die Regel wird mit Grund an den Hersteller angepasst. Ignorieren führt zu Fehlern in der Fertigung.', ['Was sagt die Meldung wirklich?', 'Regeln dürfen nicht nach Gefühl abgeschaltet werden.']]
  ];
  const REQ = [
    ['Nach der Fertigung der ersten Platine änderst du im Layout eine Leiterbahn. Was tust du als Nächstes?', 'DRC wiederholen, Fertigungsdaten neu erzeugen und die Revision hochzählen', ['Nur die geänderte Datei umbenennen', 'Die alten Fertigungsdaten weiter verwenden', 'Die Revision gleich lassen, damit der Hersteller nichts merkt'], 'Jede Änderung braucht neue Daten und einen neuen Revisionsstand. Nur so weiß die Fertigung, welche Daten gelten.', ['Wann gilt eine Datei als neu?', 'Alte und neue Daten dürfen nicht verwechselt werden.']],
    ['Wozu dient der Revisionsstand auf der Platine und in den Daten?', 'Er zeigt, welche Version von Schaltplan und Layout gefertigt wurde', ['Er gibt die Zahl der Lagen an', 'Er gibt den Preis an', 'Er gibt die Zahl der Bauteile an'], 'Mit dem Index lassen sich Platine, Stückliste und Dokumente einander zuordnen. Das hilft bei Rückfragen und Fehlersuche.', ['Welche Frage beantwortet ein Revisionsindex?', 'Er gehört auch auf den Bestückungsdruck.']],
    ['Was dokumentierst du bei jeder Revision?', 'Was geändert wurde, Datum und neuer Index', ['Nur den Preis', 'Nichts, wenn die Änderung klein ist', 'Nur den Namen der Datei'], 'Eine kurze Änderungsliste mit Datum und Index macht den Entwurfsstand nachvollziehbar.', ['Wer liest später die Liste?', 'Auch kleine Änderungen können Folgen haben.']]
  ];
  const FRQ = [
    ['Du hast die Fertigungsdaten erzeugt. Was machst du vor der Bestellung?', 'Die Daten in einem Viewer ansehen und gegen die Anforderungen und Herstellerregeln prüfen (DFM)', ['Sofort bestellen, das Programm hat alles geprüft', 'Nur die Datei umbenennen', 'Die Stückliste weglassen'], 'Der Viewer zeigt, was der Hersteller wirklich sieht. Beim DFM-Check fallen Fehler auf, die der DRC nicht kennt (z. B. fehlende Lage, falsche Bohrungen).', ['Was sieht der Hersteller?', 'Fehler vor der Bestellung kosten nichts.']],
    ['Warum ist eine zweite Person bei der Freigabe von Fertigungsdaten sinnvoll?', 'Fehler fallen oft einem Außenstehenden eher auf als dem, der den Entwurf gemacht hat', ['Weil der Hersteller zwei Unterschriften verlangt', 'Weil sonst die Daten verloren gehen', 'Weil der DRC allein nicht rechnen kann'], 'Wer lange an einem Entwurf arbeitet, übersieht eigene Fehler. Eine zweite Kontrolle (Vier-Augen-Prinzip) senkt das Risiko.', ['Wem fallen eigene Fehler schwer auf?', 'Was bringt ein frischer Blick?']],
    ['Bei der DFM-Prüfung fällt auf: Die Bohrdatei fehlt. Was tust du?', 'Die Daten nicht freigeben, die Datei erzeugen und die Prüfung wiederholen', ['Bestellen und die Datei später nachreichen', 'Die Lötstoppmaske als Ersatz verwenden', 'Die Bohrungen aus dem Bestückungsdruck ablesen'], 'Ohne Bohrdatei kann der Hersteller nicht bohren. Erst wenn das Paket vollständig ist, geht die Bestellung raus.', ['Was braucht der Hersteller zum Bohren?', 'Ein unvollständiges Paket wird nicht freigegeben.']],
    ['Ein Fehler wird erst nach der Bestellung der Platinen entdeckt. Was ist der Grund, warum das teuer wird?', 'Die fertigen Platinen sind nutzlos, die Fertigung muss mit korrigierten Daten neu laufen', ['Weil Fehler im Laufe der Zeit größer werden', 'Weil der Hersteller dann keine Daten mehr annimmt', 'Weil der Schaltplan neu gezeichnet werden muss'], 'Eine fehlerhafte Charge ist Ausschuss. Kosten und Zeit entstehen doppelt. Die Prüfung vor der Bestellung ist billig.', ['Was geschieht mit den fertigen Platinen?', 'Wann ist eine Korrektur noch kostenlos?']]
  ];

  /* ---------- Schrittlisten „So gehst du vor“ je Generator ---------- */
  const SCH = 'Lies die Frage genau.|Überlege, was jede Antwort bedeuten würde.|Wähle die eine Antwort, die zur Frage passt.';
  const STEPS = {
    frage: 'Lies, was herauskommen soll: ein Ruhewert, ein Verlauf, ein Frequenzbild oder ein Vergleich.|Ordne die Frage einer der vier Analysearten zu.|Wähle die passende Analyse.',
    grenz: 'Rechne R in Ω und C in F um.|Setze in fg = 1 / (2 · π · R · C) ein.|Gib das Ergebnis in Hz an.',
    daempf: 'Bestimme das Verhältnis f / fg.|Setze in D = 10 · log10(1 + (f / fg)²) ein.|Gib die Dämpfung als positive Zahl in dB an.',
    simzeit: 'Bestimme die Dauer einer Periode: T = 1 / f.|Multipliziere mit der Zahl der Perioden.|Rechne in ms um.',
    sweep: 'Bestimme die Zahl der Schritte: (Endwert − Startwert) / Schrittweite.|Der Startwert zählt als eigener Lauf: addiere 1.|Gib die Zahl der Läufe an.',
    dcverh: SCH,
    rv: 'Ziehe die Flussspannung der LED von der Betriebsspannung ab.|Teile die Spannung am Widerstand durch den Strom.|Gib den Widerstand in Ω an.',
    norm: 'Rechne den Vorwiderstand RV = (UB − UF) / IF aus.|Suche in der Reihe E12 den nächsten Wert, der nicht kleiner ist.|Gib den Normwert in Ω an.',
    pv: 'Bestimme die Spannung am Widerstand: UB − UF.|Multipliziere mit dem Strom: P = UR · I.|Gib die Leistung in mW an.',
    simlesen: 'Ziehe die abgelesene LED-Spannung von der Betriebsspannung ab.|Teile durch den Vorwiderstand.|Gib den Strom in mA an.',
    rb: 'Rechne den Basisstrom: IB = IC / B · k (k = Übersteuerung).|Bestimme die Spannung am Basiswiderstand: UE − 0,7 V.|Teile: RB = (UE − 0,7 V) / IB.',
    icsat: 'Ziehe UCE,sat von der Betriebsspannung ab.|Teile die Spannung am Kollektorwiderstand durch RC.|Gib den Strom in mA an.',
    uce: SCH,
    brumm: 'Rechne die Kapazität in F um.|Setze in ΔU = I / (f · C) mit f = 100 Hz ein.|Gib die Brummspannung in V an.',
    cmin: 'Rechne den Strom in A um.|Stelle um: C = I / (f · ΔU) mit f = 100 Hz.|Gib die Kapazität in µF an.',
    gleich: 'Rechne den Scheitelwert: Ueff · √2.|Ziehe die beiden Diodenspannungen ab (2 · 0,7 V).|Gib die Spannung in V an.',
    ideal: SCH,
    tolmax: 'Rechne die Toleranz in einen Faktor um (z. B. 5 % = 1,05).|Multipliziere den Nennwert mit dem Faktor.|Gib den Wert in Ω an.',
    teiler: 'Ua ist am größten, wenn R1 klein und R2 groß ist.|Rechne R1 mit Minus-, R2 mit Plus-Toleranz.|Setze in Ua = Ue · R2 / (R1 + R2) ein.',
    uftemp: 'Bestimme die Temperaturänderung ΔT.|Multipliziere mit 2 mV je Kelvin.|Gib die Änderung in mV an.',
    abw: 'Bilde den Unterschied zwischen Messwert und Simulationswert (Betrag).|Teile durch den Simulationswert.|Rechne in Prozent um.',
    warum: SCH,
    plausi: 'Schätze für jedes Ergebnis eine Grenze ab (Scheitelwert, Ohmsches Gesetz, Verhalten).|Prüfe, welches Ergebnis dagegen verstößt.|Wähle genau dieses.',
    elko: 'Bestimme den kleinsten möglichen Kapazitätswert: C · (1 − Toleranz).|Setze ihn in ΔU = I / (f · C) ein, f = 100 Hz.|Gib die größte mögliche Brummspannung an.',
    ercmeld: SCH,
    zweiaus: SCH,
    versorg: SCH,
    netzpins: 'Gehe die Bauteile der Reihe nach durch.|Zähle jeden Pin, der am genannten Netz hängt.|Gib die Zahl der Pins an.',
    ercfehler: 'Lies den Bericht Zeile für Zeile.|Zähle nur die Zeilen mit „Fehler“, nicht die Warnungen.|Gib die Zahl der Fehler an.',
    doppelref: SCH,
    footprint: SCH,
    labels: SCH,
    lage: 'Lies, was die gesuchte Lage enthält.|Ordne sie einer Lage im Fertigungspaket zu.|Wähle den passenden Namen.',
    paste: SCH,
    fehlt: 'Liste auf, welche sechs Dateien ein Leiterplattenhersteller braucht.|Vergleiche mit dem Paket.|Wähle die Datei, die fehlt.',
    ring: 'Bestimme den Unterschied zwischen Pad und Bohrung.|Halbiere ihn: Der Restring liegt rundum.|Gib den Restring in mm an.',
    bohr: 'Nimm den Durchmesser des Anschlussdrahts.|Addiere die genannte Zugabe.|Gib den Bohrdurchmesser in mm an.',
    dfm: 'Vergleiche jeden Wert mit dem Mindestwert des Herstellers.|Den Restring rechnest du selbst: (Pad − Bohrung) / 2.|Wähle die Regel, die verletzt ist.',
    bom: 'Fasse Bauteile mit gleichem Wert und gleichem Gehäuse zusammen.|Jede Gruppe ist eine Position.|Zähle die Positionen.',
    bestueck: SCH,
    ablauf: 'Rufe dir den Ablauf von der Anforderung bis zur Revision ins Gedächtnis.|Suche den genannten Schritt.|Wähle den Schritt direkt danach.',
    ercdrc: SCH,
    revision: SCH,
    freigabe: SCH,
    nutzen: 'Teile den Bedarf durch die Platinen je Nutzen.|Ein angefangener Nutzen zählt voll: runde auf.|Gib die Zahl der Nutzen an.'
  };
  const stepsOf = k => (STEPS[k] || SCH).split('|');

  /* ---------- Generatoren ---------- */
  const NETZLISTE = c => c.sch.comps.map(k => k.ref + ' (' + k.val + '): ' + k.pins.map(p => 'Pin ' + p.name + ' an ' + (p.net == null ? 'nichts' : p.net)).join(', ')).join('\n');
  const LEDS = [['rot', 1.9], ['gelb', 2.1], ['grün', 2.2], ['blau', 3.0]];
  const BOMT = [['R', '10 kΩ', 'R 0805'], ['R', '4,7 kΩ', 'R 0805'], ['R', '330 Ω', 'R 0805'], ['C', '100 nF', 'C 0805'], ['C', '10 µF', 'Elko 5 mm'], ['D', 'LED rot', 'LED 3 mm'], ['U', 'Steuer-IC', 'SOIC-8'], ['J', 'Stiftleiste 2 Pole', 'THT 2,54 mm']];
  const G = {
    /* Analysearten */
    frage: R => { const q = ANQ[C().ri(R, 0, ANQ.length - 1)]; return choiceQ(R, q[0], AN[q[1]], AN.filter((_, i) => i !== q[1]), q[2], q[3]); },
    grenz: R => {
      const c = C(), r = c.pick(R, [1000, 2200, 4700, 10000, 22000]), cf = c.pick(R, [10e-9, 22e-9, 47e-9, 100e-9, 220e-9]), fg = c.fgRC(r, cf), tol = Math.max(1, Math.ceil(fg * 0.01));
      return numQ('Ein RC-Tiefpass hat R = ' + c.fmtOhm(r) + ' und C = ' + c.fmtF(cf) + '. Rechne mit π = 3,1416. Wie groß ist die Grenzfrequenz (auf ganze Hz gerundet)?', Math.round(fg), 'Hz', 'Grenzfrequenz', tol,
        'fg = 1 / (2 · π · R · C) = 1 / (2 · π · ' + f(r, 0) + ' Ω · ' + f(cf * 1e9, 0) + ' nF) = ' + f(fg, 1) + ' Hz. Bei dieser Frequenz sinkt die Amplitude auf 70,7 %, das sind 3 dB Dämpfung.', ['Rechne die Einheiten in Ω und F um (1 nF = 10⁻⁹ F).', 'Das Produkt R · C ist die Zeitkonstante, fg = 1 / (2π · τ).']);
    },
    daempf: R => {
      const c = C(), fg = c.pick(R, [500, 800, 1000, 1600, 2000, 3200]), k = c.pick(R, [2, 3, 5, 10]), d = c.attenDb(k * fg, fg);
      return numQ('Aus dem Frequenzgang liest du für einen RC-Tiefpass die Grenzfrequenz ' + f(fg, 0) + ' Hz ab. Das Signal hat die Frequenz ' + f(k * fg, 0) + ' Hz, also das ' + f(k, 0) + '-Fache der Grenzfrequenz. Um wie viele dB wird es gedämpft? (Gib die Dämpfung als positive Zahl an, auf eine Stelle gerundet.)', c.rd(d, 1), 'dB', 'Dämpfung', 0.15,
        'Verhältnis f / fg = ' + f(k, 0) + '. Dämpfung = 10 · log10(1 + ' + f(k * k, 0) + ') = 10 · log10(' + f(1 + k * k, 0) + ') = ' + f(d, 2) + ' dB. Bei fg selbst sind es nur 3 dB, eine Dekade darüber rund 20 dB.', ['Das Verhältnis f / fg ist hier gegeben.', 'Rechne 10 · log10(1 + (f/fg)²) mit dem Taschenrechner.']);
    },
    simzeit: R => {
      const c = C(), fq = c.pick(R, [50, 100, 200, 500]), n = c.pick(R, [3, 4, 5, 6, 8]), t = n / fq * 1000;
      return numQ('Ein Wechselspannungssignal hat die Frequenz ' + f(fq, 0) + ' Hz. Du willst im Zeitverlauf genau ' + f(n, 0) + ' Perioden sehen. Wie lange stellst du die Simulationsdauer ein?', t, 'ms', 'Simulationsdauer', 0.01,
        'Eine Periode dauert T = 1 / ' + f(fq, 0) + ' Hz = ' + f(1000 / fq, 2) + ' ms. Für ' + f(n, 0) + ' Perioden: ' + f(n, 0) + ' · ' + f(1000 / fq, 2) + ' ms = ' + f(t, 2) + ' ms.', ['Eine Periode dauert 1 geteilt durch die Frequenz.', '1 s = 1000 ms.']);
    },
    sweep: R => {
      const c = C(), st = c.pick(R, [100, 200, 250, 500]), a = c.pick(R, [100, 200, 500]), n = c.ri(R, 4, 9), b = a + (n - 1) * st;
      return numQ('Du führst einen Parameter-Sweep über die Kapazität durch: Start ' + f(a, 0) + ' µF, Ende ' + f(b, 0) + ' µF, Schrittweite ' + f(st, 0) + ' µF. Der Start und das Ende gehören beide dazu. Wie viele Simulationsläufe rechnet das Programm?', n, 'Läufe', 'Läufe', 0.01,
        'Schritte: (' + f(b, 0) + ' − ' + f(a, 0) + ') / ' + f(st, 0) + ' = ' + f(n - 1, 0) + '. Der Startwert zählt als eigener Lauf, also ' + f(n - 1, 0) + ' + 1 = ' + f(n, 0) + ' Läufe.', ['Wie viele Schritte liegen zwischen Start und Ende?', 'Ein Zaun mit n Feldern hat n + 1 Pfosten.']);
    },
    dcverh: pq(DCQ),
    /* Ergebnisse lesen */
    rv: R => {
      const c = C(), led = c.pick(R, LEDS), ub = c.pick(R, [5, 9, 12, 24]), i = c.pick(R, [5, 10, 15, 20]), r = c.rvLed(ub, led[1], i / 1000);
      return numQ('Eine ' + led[0] + 'e LED (Flussspannung ' + f(led[1], 1) + ' V) soll mit ' + f(i, 0) + ' mA leuchten. Die Betriebsspannung beträgt ' + f(ub, 0) + ' V. Wie groß ist der Vorwiderstand (ohne Normreihe)?', r, 'Ω', 'Vorwiderstand', 0.5,
        'Am Widerstand liegen ' + f(ub, 0) + ' V − ' + f(led[1], 1) + ' V = ' + f(ub - led[1], 1) + ' V. RV = ' + f(ub - led[1], 1) + ' V / ' + f(i, 0) + ' mA = ' + f(r, 1) + ' Ω.', ['Die Spannung am Widerstand ist Betriebsspannung minus LED-Spannung.', 'Ohmsches Gesetz: R = U / I, der Strom in A (mA geteilt durch 1000).']);
    },
    norm: R => {
      const c = C(); let led, ub, i, r;
      for (let t = 0; t < 80; t++) { led = c.pick(R, LEDS); ub = c.pick(R, [5, 9, 12, 24]); i = c.pick(R, [5, 10, 15, 20]); r = c.rvLed(ub, led[1], i / 1000); if (c.e12Up(r) > r + 0.5) break; }
      const e = c.e12Up(r);
      return numQ('Eine ' + led[0] + 'e LED (' + f(led[1], 1) + ' V) soll mit ' + f(i, 0) + ' mA bei ' + f(ub, 0) + ' V Betriebsspannung leuchten. Du hast Widerstände der Reihe E12 (1,0 · 1,2 · 1,5 · 1,8 · 2,2 · 2,7 · 3,3 · 3,9 · 4,7 · 5,6 · 6,8 · 8,2 mit Zehnerpotenzen). Du wählst den nächsten Normwert, der nicht kleiner als der berechnete ist. Welchen?', e, 'Ω', 'Normwert', 0.5,
        'Berechnet: (' + f(ub, 0) + ' V − ' + f(led[1], 1) + ' V) / ' + f(i, 0) + ' mA = ' + f(r, 1) + ' Ω. Der nächste E12-Wert nach oben ist ' + f(e, 0) + ' Ω. Nach oben, damit der Strom die Grenze nicht überschreitet.', ['Rechne zuerst den genauen Widerstand aus.', 'Suche den Wert in der Reihe, der gleich oder größer ist.']);
    },
    pv: R => {
      const c = C(), led = c.pick(R, LEDS), ub = c.pick(R, [9, 12, 24]), i = c.pick(R, [10, 15, 20]), p = (ub - led[1]) * i;
      return numQ('Eine LED (' + f(led[1], 1) + ' V) wird mit ' + f(i, 0) + ' mA an ' + f(ub, 0) + ' V betrieben. Wie viel Leistung wird im Vorwiderstand in Wärme umgesetzt?', p, 'mW', 'Verlustleistung', 0.5,
        'Am Widerstand liegen ' + f(ub - led[1], 1) + ' V. P = U · I = ' + f(ub - led[1], 1) + ' V · ' + f(i, 0) + ' mA = ' + f(p, 1) + ' mW. Das ist ' + (p > 250 ? 'mehr' : 'weniger') + ' als eine Viertelwatt-Bauform (250 mW) verträgt.', ['Welche Spannung liegt am Widerstand?', 'P = U · I, mA mal V ergibt mW.']);
    },
    simlesen: R => {
      const c = C(), ub = c.pick(R, [5, 9, 12]), r = c.pick(R, [220, 330, 470, 680, 1000]), op = c.operatingPoint(ub, r), uf = c.rd(op.u, 2), i = (ub - uf) / r * 1000;
      return numQ('Das Simulationsprogramm zeigt für eine LED mit Vorwiderstand ' + f(r, 0) + ' Ω an ' + f(ub, 0) + ' V als Arbeitspunkt eine LED-Spannung von ' + f(uf, 2) + ' V. Wie groß ist der Strom durch die LED?', i, 'mA', 'LED-Strom', 0.1,
        'Am Widerstand liegen ' + f(ub, 0) + ' V − ' + f(uf, 2) + ' V = ' + f(ub - uf, 2) + ' V. Der Strom ist in Reihe überall gleich: I = ' + f(ub - uf, 2) + ' V / ' + f(r, 0) + ' Ω = ' + f(i, 2) + ' mA.', ['Der Strom durch den Widerstand ist der Strom durch die LED.', 'Spannung am Widerstand geteilt durch seinen Wert.']);
    },
    rb: R => {
      const c = C(), ic = c.pick(R, [40, 60, 80, 100, 150]), b = c.pick(R, [50, 100, 150]), k = c.pick(R, [2, 3, 5]), ue = c.pick(R, [3.3, 5]), ib = c.ibNeeded(ic / 1000, b, k), rb = c.rbFor(ue, ib);
      return numQ('Ein Transistor schaltet ein Relais mit IC = ' + f(ic, 0) + ' mA. Seine Stromverstärkung ist mindestens B = ' + f(b, 0) + '. Du übersteuerst ' + f(k, 0) + '-fach. Die Ansteuerspannung beträgt ' + f(ue, 1) + ' V, UBE = 0,7 V. Wie groß ist der Basiswiderstand RB (auf ganze Ω gerundet)?', Math.round(rb), 'Ω', 'Basiswiderstand', Math.max(1, Math.ceil(rb * 0.01)),
        'IB = IC / B · k = ' + f(ic, 0) + ' mA / ' + f(b, 0) + ' · ' + f(k, 0) + ' = ' + f(ib * 1000, 2) + ' mA. RB = (' + f(ue, 1) + ' V − 0,7 V) / ' + f(ib * 1000, 2) + ' mA = ' + f(rb, 0) + ' Ω. Mit Übersteuerung wird die Sättigung auch bei kleinem B sicher erreicht.', ['Zuerst den nötigen Basisstrom, dann den Widerstand.', 'Am Basiswiderstand fällt die Ansteuerspannung minus UBE ab.']);
    },
    icsat: R => {
      const c = C(), ub = c.pick(R, [5, 12, 24]), rc = c.pick(R, [100, 220, 470, 1000]), ic = c.icSat(ub, rc) * 1000;
      return numQ('Ein Transistor schaltet eine Last mit dem Kollektorwiderstand ' + f(rc, 0) + ' Ω an ' + f(ub, 0) + ' V. Im eingeschalteten Zustand ist UCE = 0,2 V. Wie groß ist der Kollektorstrom?', ic, 'mA', 'Kollektorstrom', 0.2,
        'Am Kollektorwiderstand liegen ' + f(ub, 0) + ' V − 0,2 V = ' + f(ub - 0.2, 1) + ' V. IC = ' + f(ub - 0.2, 1) + ' V / ' + f(rc, 0) + ' Ω = ' + f(ic, 2) + ' mA.', ['Wie viel Spannung bleibt für RC übrig?', 'I = U / R, Ergebnis in A mal 1000 ergibt mA.']);
    },
    uce: pq(UEQ),
    brumm: R => {
      const c = C(), i = c.pick(R, [100, 200, 300, 500]), cf = c.pick(R, [470, 1000, 2200, 4700]), du = c.ripple(i / 1000, cf * 1e-6, 100);
      return numQ('Ein Netzteil mit Brückengleichrichter (Brummfrequenz 100 Hz) liefert ' + f(i, 0) + ' mA. Der Ladeelko hat ' + f(cf, 0) + ' µF. Wie groß ist die Brummspannung (Spitze-Spitze, Näherung)?', du, 'V', 'Brummspannung', 0.02 + du * 0.01,
        'ΔU = I / (f · C) = ' + f(i / 1000, 3) + ' A / (100 Hz · ' + f(cf * 1e-6, 6) + ' F) = ' + f(du, 2) + ' V. Das ist eine Näherung: Die Simulation zeigt etwas weniger, weil der Kondensator kurz nachgeladen wird.', ['Rechne mA in A und µF in F um.', 'Die Brummfrequenz der Brücke ist doppelt so hoch wie die Netzfrequenz.']);
    },
    cmin: R => {
      const c = C(), i = c.pick(R, [150, 250, 400, 500]), du = c.pick(R, [0.5, 1, 2, 2.5]), cf = c.cForRipple(i / 1000, 100, du) * 1e6;
      return numQ('Ein Netzteil mit Brückengleichrichter (100 Hz) liefert ' + f(i, 0) + ' mA. Die Brummspannung darf höchstens ' + f(du, 1) + ' V betragen. Welche Kapazität braucht der Ladeelko mindestens (Näherung)?', cf, 'µF', 'Kapazität', cf * 0.01,
        'C = I / (f · ΔU) = ' + f(i / 1000, 3) + ' A / (100 Hz · ' + f(du, 1) + ' V) = ' + f(cf * 1e-6, 6) + ' F = ' + f(cf, 0) + ' µF. Im Aufbau nimmst du den nächsten größeren Normwert.', ['Stelle die Brummformel nach C um.', 'Das Ergebnis in F mal 1.000.000 ergibt µF.']);
    },
    gleich: R => {
      const c = C(), ue = c.pick(R, [9, 12, 15, 18, 24]), up = c.peakDC(ue);
      return numQ('Ein Trafo liefert ' + f(ue, 0) + ' V Wechselspannung (Effektivwert). Dahinter sitzt ein Brückengleichrichter mit Silizium-Dioden (je 0,7 V Spannungsabfall), danach ein Ladeelko. Wie hoch wird die Gleichspannung am Elko höchstens (Scheitelwert hinter der Brücke)?', up, 'V', 'Scheitelwert', 0.05,
        'Scheitelwert der Wechselspannung: ' + f(ue, 0) + ' V · √2 = ' + f(ue * Math.SQRT2, 2) + ' V. In der Brücke liegen zwei Dioden im Strompfad: 2 · 0,7 V = 1,4 V. ' + f(ue * Math.SQRT2, 2) + ' V − 1,4 V = ' + f(up, 2) + ' V.', ['Der Scheitelwert ist das √2-Fache des Effektivwerts.', 'In der Brücke fließt der Strom durch zwei Dioden.']);
    },
    /* Modell und Wirklichkeit */
    ideal: pq(IDQ),
    tolmax: R => {
      const c = C(), v = c.pick(R, [1000, 2200, 4700, 10000, 22000, 47000]), t = c.pick(R, [1, 5, 10]), mx = c.tolMax(v, t);
      return numQ('Ein Widerstand ist mit ' + c.fmtOhm(v) + ' und ' + f(t, 0) + ' % Toleranz angegeben. Welchen Wert kann er höchstens haben (in Ω)?', mx, 'Ω', 'Höchstwert', 0.5,
        'Faktor ' + f(1 + t / 100, 2) + '. Höchstwert = ' + f(v, 0) + ' Ω · ' + f(1 + t / 100, 2) + ' = ' + f(mx, 1) + ' Ω. Der niedrigste Wert wäre ' + f(c.tolMin(v, t), 1) + ' Ω.', ['Aus 5 % wird der Faktor 1,05.', 'Beim Höchstwert addierst du die Toleranz.']);
    },
    teiler: R => {
      const c = C(), ue = c.pick(R, [5, 9, 12]), r1 = c.pick(R, [1000, 2200, 4700, 10000]), r2 = c.pick(R, [1000, 2200, 4700, 10000]), t = c.pick(R, [1, 5, 10]), mx = c.dividerMax(ue, r1, r2, t), nom = ue * r2 / (r1 + r2);
      return numQ('Ein Spannungsteiler an ' + f(ue, 0) + ' V besteht aus R1 = ' + c.fmtOhm(r1) + ' (oben) und R2 = ' + c.fmtOhm(r2) + ' (unten), beide mit ' + f(t, 0) + ' % Toleranz. Die Ausgangsspannung liegt über R2. Wie groß kann sie im ungünstigsten Fall höchstens werden?', mx, 'V', 'größte Ausgangsspannung', 0.01,
        'Ua ist am größten, wenn R1 klein und R2 groß ist: R1 = ' + f(c.tolMin(r1, t), 1) + ' Ω, R2 = ' + f(c.tolMax(r2, t), 1) + ' Ω. Ua = ' + f(ue, 0) + ' V · ' + f(c.tolMax(r2, t), 1) + ' / (' + f(c.tolMin(r1, t), 1) + ' + ' + f(c.tolMax(r2, t), 1) + ') = ' + f(mx, 3) + ' V. Mit Nennwerten wären es ' + f(nom, 3) + ' V.', ['Welcher Widerstand muss groß, welcher klein sein?', 'Rechne mit den Grenzwerten statt mit den Nennwerten.']);
    },
    uftemp: R => {
      const c = C(), t1 = c.pick(R, [45, 55, 65, 75, 85]), dT = t1 - 25, d = c.ufDrift(dT);
      return numQ('Die Flussspannung einer Silizium-Diode sinkt mit steigender Temperatur um rund 2 mV je Kelvin. Die Diode erwärmt sich von 25 °C auf ' + f(t1, 0) + ' °C. Um wie viele mV sinkt die Flussspannung?', d, 'mV', 'Änderung', 0.5,
        'Temperaturänderung ' + f(t1, 0) + ' °C − 25 °C = ' + f(dT, 0) + ' K. Änderung: ' + f(dT, 0) + ' K · 2 mV/K = ' + f(d, 0) + ' mV. Ein Simulationsprogramm mit festem Modell bei 27 °C zeigt diesen Effekt nicht.', ['Wie viele Kelvin liegen zwischen den beiden Temperaturen?', 'Je Kelvin 2 mV.']);
    },
    abw: R => {
      const c = C(), s = c.pick(R, [5.1, 12.0, 3.3, 8.2, 9.0]), p = c.pick(R, [-0.12, -0.08, -0.05, 0.03, 0.06, 0.1]), m = c.rd(s * (1 + p), 2), dv = c.devPct(m, s);
      return numQ('Die Simulation liefert ' + f(s, 2) + ' V, die Messung am Aufbau ' + f(m, 2) + ' V. Wie groß ist die Abweichung in Prozent, bezogen auf den Simulationswert?', dv, '%', 'Abweichung', 0.05,
        'Unterschied: |' + f(m, 2) + ' V − ' + f(s, 2) + ' V| = ' + f(Math.abs(m - s), 2) + ' V. Bezogen auf ' + f(s, 2) + ' V: ' + f(Math.abs(m - s), 2) + ' / ' + f(s, 2) + ' · 100 = ' + f(dv, 2) + ' %. Ob das noch plausibel ist, hängt von den Toleranzen der Bauteile ab.', ['Der Unterschied ohne Vorzeichen.', 'Teile durch den Bezugswert, hier den Simulationswert.']);
    },
    warum: pq(WARQ),
    plausi: pq(PLQ),
    elko: R => {
      const c = C(), cf = c.pick(R, [470, 1000, 2200]), t = c.pick(R, [10, 20]), i = c.pick(R, [200, 300, 500]), cmin = cf * (1 - t / 100), du = c.ripple(i / 1000, cmin * 1e-6, 100);
      return numQ('Ein Netzteil mit Brückengleichrichter (100 Hz) liefert ' + f(i, 0) + ' mA. Der Ladeelko trägt die Angabe ' + f(cf, 0) + ' µF ±' + f(t, 0) + ' %. Wie groß kann die Brummspannung im ungünstigsten Fall werden (Näherung)?', du, 'V', 'größte Brummspannung', 0.02 + du * 0.01,
        'Kleinste Kapazität: ' + f(cf, 0) + ' µF · ' + f(1 - t / 100, 2) + ' = ' + f(cmin, 1) + ' µF. ΔU = ' + f(i / 1000, 3) + ' A / (100 Hz · ' + f(cmin * 1e-6, 7) + ' F) = ' + f(du, 2) + ' V. Mit dem Nennwert wären es ' + f(c.ripple(i / 1000, cf * 1e-6, 100), 2) + ' V.', ['Weniger Kapazität heißt mehr Brumm.', 'Bei −20 % bleiben 80 % der Nennkapazität.']);
    },
    /* Schaltplan und ERC */
    ercmeld: pq(ERCQ),
    zweiaus: pq(ZAQ),
    versorg: pq(VOQ),
    netzpins: R => {
      const c = C(), kase = c.makeCase('np' + c.ri(R, 1, 99999)), net = c.pick(R, ['GND', '+5V']), cnt = c.nets(kase.sch)[net] ? c.nets(kase.sch)[net].length : 0;
      return numQ('Der Schaltplan wurde als Netzliste ausgegeben (jede Zeile ein Bauteil, danach seine Pins mit dem Netz):\n' + NETZLISTE(kase) + '\nWie viele Pins hängen am Netz „' + net + '“ (genau so geschrieben)?', cnt, 'Pins', 'Zahl der Pins', 0.01,
        'Zähle in jeder Zeile die Pins, die an „' + net + '“ hängen: ' + (c.nets(kase.sch)[net] || []).map(e => e.c.ref + '.' + e.p.name).join(', ') + '. Das sind ' + f(cnt, 0) + ' Pins. Pins mit anderer Schreibweise oder ohne Netz zählen nicht mit.', ['Gehe Bauteil für Bauteil durch.', 'Nur die genaue Schreibweise zählt.']);
    },
    ercfehler: R => {
      const c = C(), kase = c.makeCase('ef' + c.ri(R, 1, 99999)), fe = kase.msgs.filter(m => m.level === 'Fehler').length;
      return numQ('Der ERC hat für einen Schaltplan folgenden Bericht ausgegeben:\n' + kase.msgs.map(m => m.level + ': ' + m.text).join('\n') + '\nWie viele dieser Meldungen sind Fehler (also keine Warnungen)?', fe, 'Fehler', 'Zahl der Fehler', 0.01,
        'Zähle die Zeilen mit „Fehler“: ' + f(fe, 0) + ' von ' + f(kase.msgs.length, 0) + ' Meldungen. Warnungen weisen auf Unsauberes hin (einzelnes Netz, fehlender Footprint), blockieren das Layout aber nicht. Fehler musst du vor dem Layout beheben.', ['Lies nur das erste Wort jeder Zeile.', 'Fehler und Warnungen sind getrennt gekennzeichnet.']);
    },
    doppelref: pq(DRQ),
    footprint: pq(FPQ),
    labels: pq(LAQ),
    /* Fertigungsdaten */
    lage: R => {
      const c = C(), pool = c.LAYERS.filter(l => l.k !== 'cuBot'), L = c.pick(R, pool), wrong = c.shuffle(R, c.LAYERS.filter(l => l !== L).map(l => l.n)).slice(0, 3);
      return choiceQ(R, 'Zum Fertigungspaket gehört diese Datei: „' + L.info + '“ Welche Lage ist das?', L.n, wrong, 'Das ist die Lage „' + L.n + '“ (Dateiendung z. B. ' + L.ext + '). ' + L.info, ['Lies, was die Lage enthält: Kupfer, Lack, Druck, Paste, Umriss oder Bohrungen?', 'Jede Lage hat genau einen Zweck.']);
    },
    paste: pq(PAQ),
    fehlt: R => {
      const c = C(), need = c.LAYERS.filter(l => l.k !== 'paste'), miss = c.pick(R, need), have = need.filter(l => l !== miss);
      return choiceQ(R, 'Eine zweilagige Platine mit SMD- und THT-Bauteilen soll unbestückt bei einem Leiterplattenhersteller bestellt werden. Der Hersteller braucht Kupfer oben und unten, Lötstoppmaske, Bestückungsdruck, Platinenkontur und Bohrdatei. Im Paket liegen: ' + have.map(l => l.n + ' (' + l.ext + ')').join(', ') + '. Welche Datei fehlt?', miss.n, need.filter(l => l !== miss).map(l => l.n),
        'Sechs Dateien werden gebraucht, es sind fünf da. Es fehlt: ' + miss.n + ' (' + miss.ext + '). ' + miss.info + ' Die Pastenlage braucht der Hersteller der unbestückten Platine nicht, sie gehört zur Schablone für die Bestückung.', ['Hake die sechs Dateien nacheinander ab.', 'Die Pastenlage gehört nicht zu den sechs.']);
    },
    ring: R => {
      const c = C(), drill = c.pick(R, [0.8, 1.0, 1.2]), pad = c.pick(R, [1.6, 1.8, 2.0, 2.2, 2.4]), r = c.ringOf(pad, drill);
      return numQ('Ein Pad für ein bedrahtetes Bauteil hat einen Durchmesser von ' + f(pad, 1) + ' mm, die Bohrung ' + f(drill, 1) + ' mm. Wie groß ist der Restring (Kupfer rund um die Bohrung)?', r, 'mm', 'Restring', 0.005,
        'Pad minus Bohrung: ' + f(pad, 1) + ' mm − ' + f(drill, 1) + ' mm = ' + f(pad - drill, 1) + ' mm. Das Kupfer liegt auf beiden Seiten der Bohrung, deshalb halbieren: ' + f(pad - drill, 1) + ' / 2 = ' + f(r, 2) + ' mm.', ['Der Ring liegt rundum, also nur halb so breit wie der Unterschied der Durchmesser.', 'Durchmesser, nicht Radius, sind gegeben.']);
    },
    bohr: R => {
      const c = C(), lead = c.pick(R, [0.5, 0.6, 0.8, 1.0, 1.2]), add = c.pick(R, [0.2, 0.25, 0.3]), d = c.drillFor(lead, add);
      return numQ('Ein bedrahtetes Bauteil hat Anschlussdrähte mit ' + f(lead, 1) + ' mm Durchmesser. Der Bohrdurchmesser soll ' + f(add, 2) + ' mm größer sein. Wie groß bohrst du?', d, 'mm', 'Bohrdurchmesser', 0.005,
        'Bohrdurchmesser = Drahtdurchmesser + Zugabe = ' + f(lead, 1) + ' mm + ' + f(add, 2) + ' mm = ' + f(d, 2) + ' mm. Die Zugabe lässt Platz zum Einstecken und für das Lot.', ['Drahtdurchmesser plus Zugabe.', 'Die Zugabe steht in der Aufgabe.']);
    },
    dfm: R => {
      const c = C(), M = c.DFM_MIN, ks = ['track', 'gap', 'drill', 'ring'], bad = c.pick(R, ks), ring0 = c.pick(R, [0.2, 0.25, 0.3]);
      const p = { track: c.pick(R, [0.2, 0.25, 0.3]), gap: c.pick(R, [0.2, 0.25, 0.3]), drill: c.pick(R, [0.4, 0.6, 0.8]) };
      if (bad === 'track') p.track = c.pick(R, [0.1, 0.12]); else if (bad === 'gap') p.gap = c.pick(R, [0.1, 0.12]); else if (bad === 'drill') p.drill = c.pick(R, [0.2, 0.25]);
      p.pad = c.rd(p.drill + 2 * (bad === 'ring' ? c.pick(R, [0.05, 0.1]) : ring0), 2);
      const res = c.dfmCheck(p), viol = res.filter(x => !x.ok);
      return choiceQ(R, 'Der Leiterplattenhersteller verlangt (Übungswerte): Leiterbahnbreite mindestens ' + f(M.track, 2) + ' mm, Abstand mindestens ' + f(M.gap, 2) + ' mm, Bohrung mindestens ' + f(M.drill, 2) + ' mm, Restring mindestens ' + f(M.ring, 2) + ' mm. Dein Entwurf hat: Leiterbahn ' + f(p.track, 2) + ' mm, Abstand ' + f(p.gap, 2) + ' mm, Bohrung ' + f(p.drill, 2) + ' mm, Pad-Durchmesser ' + f(p.pad, 2) + ' mm. Welche Regel ist verletzt?', c.DFM_NAMES[viol[0].k], ks.filter(k => k !== viol[0].k).map(k => c.DFM_NAMES[k]),
        'Verglichen mit den Mindestwerten ist nur ' + c.DFM_NAMES[viol[0].k] + ' zu klein: ' + f(viol[0].val, 2) + ' mm statt mindestens ' + f(viol[0].min, 2) + ' mm. ' + (viol[0].k === 'ring' ? 'Der Restring ergibt sich aus (Pad − Bohrung) / 2 = (' + f(p.pad, 2) + ' − ' + f(p.drill, 2) + ') / 2 = ' + f(viol[0].val, 2) + ' mm.' : 'Der Restring ist mit ' + f(res.find(x => x.k === 'ring').val, 2) + ' mm in Ordnung.'), ['Vergleiche jeden Wert einzeln mit seinem Mindestwert.', 'Den Restring musst du selbst aus Pad und Bohrung rechnen.']);
    },
    bom: R => {
      const c = C(); let items, g;
      for (let t = 0; t < 50; t++) {
        const types = c.shuffle(R, BOMT).slice(0, c.ri(R, 4, 6)); items = []; const cnt = {};
        types.forEach(ty => { const n = c.ri(R, 1, 3); for (let k = 0; k < n; k++) { cnt[ty[0]] = (cnt[ty[0]] || 0) + 1; items.push({ ref: ty[0] + cnt[ty[0]], val: ty[1], fp: ty[2] }); } });
        g = c.bomGroup(items); if (g.total >= 8 && g.total > g.positions + 2) break;
      }
      return numQ('Der Schaltplan enthält diese Bauteile: ' + items.map(x => x.ref + ' ' + x.val + ' (' + x.fp + ')').join(', ') + '. Die Stückliste fasst Bauteile mit gleichem Wert und gleichem Gehäuse zu einer Position zusammen. Wie viele Positionen hat sie?', g.positions, 'Positionen', 'Positionen', 0.01,
        'Gleiche Werte und Gehäuse werden zusammengefasst: ' + g.rows.map(r => f(r.qty, 0) + ' × ' + r.val + ' (' + r.fp + ')').join(', ') + '. Das sind ' + f(g.positions, 0) + ' Positionen für ' + f(g.total, 0) + ' Bauteile.', ['Wie viele verschiedene Kombinationen aus Wert und Gehäuse kommen vor?', 'Die Zahl der Bauteile ist größer als die Zahl der Positionen.']);
    },
    bestueck: pq(BEQ),
    /* Entwurf bis Freigabe */
    ablauf: R => {
      const c = C(), A = c.ABLAUF, i = c.ri(R, 0, A.length - 2), right = A[i + 1], wrong = c.shuffle(R, A.filter((_, j) => j !== i && j !== i + 1)).slice(0, 3);
      return choiceQ(R, 'Im Ablauf vom Entwurf bis zur Freigabe (siehe Hilfe) ist der Schritt „' + A[i] + '“ erledigt. Welcher Schritt folgt als nächster?', right, wrong, 'Der Ablauf: ' + A.map((s, j) => (j + 1) + '. ' + s).join('; ') + '. Nach Schritt ' + (i + 1) + ' folgt Schritt ' + (i + 2) + ': ' + right + '.', ['Gehe die Reihe von der Anforderung bis zur Revision durch.', 'Erst prüfen, dann weitergeben.']);
    },
    ercdrc: pq(EDQ),
    revision: pq(REQ),
    freigabe: pq(FRQ),
    nutzen: R => {
      const c = C(); let need, per;
      for (let t = 0; t < 60; t++) { need = c.pick(R, [25, 30, 40, 50, 60, 75, 120]); per = c.pick(R, [4, 6, 8, 10, 12]); if (need % per) break; }
      const n = c.panelCount(need, per);
      return numQ('Du brauchst ' + f(need, 0) + ' Leiterplatten. Auf einen Fertigungsnutzen passen ' + f(per, 0) + ' Platinen. Wie viele Nutzen musst du mindestens bestellen?', n, 'Nutzen', 'Nutzen', 0.01,
        f(need, 0) + ' / ' + f(per, 0) + ' = ' + f(need / per, 2) + '. Ein angefangener Nutzen wird voll gefertigt, also aufrunden: ' + f(n, 0) + ' Nutzen (' + f(n * per, 0) + ' Platinen, ' + f(n * per - need, 0) + ' mehr als gebraucht).', ['Wie viele Platinen liefert ein Nutzen?', 'Halbe Nutzen gibt es nicht.']);
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    ['Analysearten der Simulation', 1, 'Welche Analyse passt', 'frage'], ['Analysearten der Simulation', 2, 'Grenzfrequenz eines Filters', 'grenz'], ['Analysearten der Simulation', 3, 'Dämpfung im Frequenzgang', 'daempf'],
    ['Analysearten der Simulation', 1, 'Simulationsdauer wählen', 'simzeit'], ['Analysearten der Simulation', 2, 'Läufe beim Sweep', 'sweep'], ['Analysearten der Simulation', 2, 'Bauteile im Arbeitspunkt', 'dcverh'],
    ['Ergebnisse lesen und bewerten', 1, 'Vorwiderstand der LED', 'rv'], ['Ergebnisse lesen und bewerten', 2, 'Vorwiderstand aus der Reihe', 'norm'], ['Ergebnisse lesen und bewerten', 2, 'Wärme im Vorwiderstand', 'pv'],
    ['Ergebnisse lesen und bewerten', 1, 'Strom aus dem Arbeitspunkt', 'simlesen'], ['Ergebnisse lesen und bewerten', 2, 'Basiswiderstand des Schalters', 'rb'], ['Ergebnisse lesen und bewerten', 2, 'Strom im durchgeschalteten Transistor', 'icsat'],
    ['Ergebnisse lesen und bewerten', 1, 'Spannungen am Schalttransistor', 'uce'], ['Ergebnisse lesen und bewerten', 2, 'Brumm am Ladeelko', 'brumm'], ['Ergebnisse lesen und bewerten', 3, 'Elko für wenig Brumm', 'cmin'], ['Ergebnisse lesen und bewerten', 2, 'Spannung hinter der Brücke', 'gleich'],
    ['Modell und Wirklichkeit', 1, 'Was „ideal“ bedeutet', 'ideal'], ['Modell und Wirklichkeit', 1, 'Grenzen eines Widerstands', 'tolmax'], ['Modell und Wirklichkeit', 3, 'Spannungsteiler im Grenzfall', 'teiler'],
    ['Modell und Wirklichkeit', 2, 'Diode und Temperatur', 'uftemp'], ['Modell und Wirklichkeit', 1, 'Messung gegen Simulation', 'abw'], ['Modell und Wirklichkeit', 2, 'Ursache der Abweichung', 'warum'],
    ['Modell und Wirklichkeit', 2, 'Ergebnis auf Plausibilität prüfen', 'plausi'], ['Modell und Wirklichkeit', 3, 'Elko mit Toleranz', 'elko'],
    ['Schaltplan und ERC', 1, 'ERC-Meldung deuten', 'ercmeld'], ['Schaltplan und ERC', 2, 'Zwei Quellen auf einem Netz', 'zweiaus'], ['Schaltplan und ERC', 2, 'Versorgung ohne Quelle', 'versorg'],
    ['Schaltplan und ERC', 1, 'Pins eines Netzes zählen', 'netzpins'], ['Schaltplan und ERC', 2, 'ERC-Bericht lesen', 'ercfehler'], ['Schaltplan und ERC', 2, 'Gleiche Bauteilnamen', 'doppelref'],
    ['Schaltplan und ERC', 2, 'Bauteil und Gehäuse zuordnen', 'footprint'], ['Schaltplan und ERC', 2, 'Netzlabels und Power-Symbole', 'labels'],
    ['Fertigungsdaten', 1, 'Welche Lage ist das', 'lage'], ['Fertigungsdaten', 2, 'Paste und Maske', 'paste'], ['Fertigungsdaten', 1, 'Paket vollständig', 'fehlt'],
    ['Fertigungsdaten', 2, 'Kupfer um die Bohrung', 'ring'], ['Fertigungsdaten', 1, 'Bohrung für den Anschlussdraht', 'bohr'], ['Fertigungsdaten', 2, 'DFM-Prüfung', 'dfm'],
    ['Fertigungsdaten', 2, 'Stückliste zusammenfassen', 'bom'], ['Fertigungsdaten', 2, 'Bestückungsdaten', 'bestueck'],
    ['Vom Entwurf zur Freigabe', 1, 'Nächster Schritt im Ablauf', 'ablauf'], ['Vom Entwurf zur Freigabe', 2, 'ERC und DRC', 'ercdrc'], ['Vom Entwurf zur Freigabe', 2, 'Änderung und Revision', 'revision'],
    ['Vom Entwurf zur Freigabe', 3, 'Prüfung vor der Bestellung', 'freigabe'], ['Vom Entwurf zur Freigabe', 2, 'Nutzen bestellen', 'nutzen']
  ];
  let seq = 0;
  const tasks = defs.map(d => ({ id: 'eda' + (++seq), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; q.steps = stepsOf(t.gen); return q;
  }
  function makeTask(t) { return make(t, C().rng('eda-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.EDA_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, steps: STEPS, pools: { ANQ, DCQ, UEQ, IDQ, WARQ, PLQ, ERCQ, ZAQ, VOQ, DRQ, FPQ, LAQ, PAQ, BEQ, EDQ, REQ, FRQ } };
  root.EDA_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.EDA_DATA, TASKS: root.EDA_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
