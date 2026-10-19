'use strict';
/* Tonfunk Prüfungs-Lab: Fragenbank (prüfungsähnlich, eigene Aufgaben, Beruf Elektroniker/in für Geräte und Systeme).
   TOPICS: acht Themen. MC: Mehrfachwahl [Thema, Frage, richtige Antwort, drei falsche, Erklärung] (die Reihenfolge der Antworten wird beim Ziehen gemischt).
   GEN: Rechengeneratoren je Thema; jede Funktion bekommt einen Zufallsgeber r und liefert { q, ans, unit, w, tol } mit zufälligen Werten aus E-Reihen.
   Hinweis: Alle Fragen sind eigene Formulierungen und keine echten Kammer-Aufgaben. */
(function (root) {
  const TOPICS = [
    { k: 'grund', t: 'Grundlagen Gleichstrom', icon: '🔋', lab: 'sch', labN: 'SchaltLab' },
    { k: 'bauteile', t: 'Bauelemente', icon: '🔌', lab: 'sch', labN: 'SchaltLab' },
    { k: 'wechsel', t: 'Wechselstrom und Filter', icon: '〰', lab: 'sim', labN: 'SimLab' },
    { k: 'digital', t: 'Digitaltechnik', icon: '🔢', lab: 'digi', labN: 'DigiLab' },
    { k: 'messen', t: 'Messtechnik', icon: '📏', lab: 'mess', labN: 'MessLab' },
    { k: 'strom', t: 'Stromversorgung', icon: '⚡', lab: 'sch', labN: 'SchaltLab' },
    { k: 'mcu', t: 'Mikrocontroller', icon: '💻', lab: 'code', labN: 'Arduino-Lab' },
    { k: 'sicher', t: 'Sicherheit und Normen', icon: '🦺', lab: 'haus', labN: 'HausLab' }
  ];

  const MC = [
    // ---- Grundlagen
    ['grund', 'Welche Einheit hat die elektrische Leistung?', 'Watt (W)', 'Joule (J)', 'Coulomb (C)', 'Ohm (Ω)', 'Die Leistung ist P = U · I, ihre Einheit ist das Watt. Joule ist die Einheit der Energie.'],
    ['grund', 'In einer Reihenschaltung zweier Widerstände gilt:', 'Durch beide fließt derselbe Strom', 'An beiden liegt dieselbe Spannung', 'Der kleinere Widerstand hat die größere Spannung', 'Der Gesamtwiderstand ist kleiner als jeder Einzelwiderstand', 'In der Reihenschaltung gibt es nur einen Strompfad, also überall denselben Strom. Die Spannungen teilen sich auf, der Gesamtwiderstand ist die Summe.'],
    ['grund', 'Wie verhält sich der Gesamtwiderstand einer Parallelschaltung?', 'Er ist kleiner als der kleinste Einzelwiderstand', 'Er ist die Summe der Einzelwiderstände', 'Er ist gleich dem größten Einzelwiderstand', 'Er hängt nicht von den Einzelwiderständen ab', 'Jeder weitere parallele Zweig bietet dem Strom einen zusätzlichen Weg, der Gesamtwiderstand sinkt.'],
    ['grund', 'Die Knotenregel (1. Kirchhoffsches Gesetz) besagt:', 'Die Summe der zufließenden Ströme ist gleich der Summe der abfließenden Ströme', 'Die Summe aller Spannungen in einer Masche ist null', 'Der Strom ist proportional zur Spannung', 'Die Leistung ist das Produkt aus Strom und Spannung', 'Die Knotenregel handelt von Strömen. Die Aussage über die Spannungen in der Masche ist die Maschenregel.'],
    ['grund', 'Bei gleicher Spannung wird ein Widerstand durch einen mit doppeltem Wert ersetzt. Der Strom …', 'halbiert sich', 'verdoppelt sich', 'bleibt gleich', 'vervierfacht sich', 'I = U / R: Bei doppeltem R und gleichem U wird I halb so groß.'],
    ['grund', 'Die Spannung an einem Widerstand verdoppelt sich. Wie ändert sich die Leistung?', 'Sie vervierfacht sich', 'Sie verdoppelt sich', 'Sie bleibt gleich', 'Sie halbiert sich', 'P = U² / R: Die Spannung geht quadratisch ein, doppelte Spannung bedeutet vierfache Leistung.'],
    ['grund', 'Was bedeutet „Leerlaufspannung“ einer Spannungsquelle?', 'Die Spannung ohne angeschlossene Last', 'Die Spannung bei Kurzschluss', 'Die Spannung bei Nennlast', 'Die Spannung nach einer Stunde Betrieb', 'Im Leerlauf fließt (fast) kein Strom, die Klemmenspannung ist am höchsten.'],
    ['grund', 'Ein Spannungsteiler aus zwei gleichen Widerständen teilt die Eingangsspannung …', 'in zwei gleiche Hälften', 'im Verhältnis 1 : 10', 'gar nicht', 'auf das Doppelte', 'Bei R1 = R2 liegt an jedem die halbe Spannung.'],
    ['grund', 'Welche Richtung hat die technische Stromrichtung?', 'Von Plus nach Minus', 'Von Minus nach Plus', 'Immer in Richtung der Elektronen', 'Sie hängt vom Material ab', 'Die technische Stromrichtung wurde festgelegt von Plus nach Minus. Die Elektronen wandern entgegengesetzt.'],
    ['grund', 'Ein Kupferdraht wird bei gleichem Querschnitt doppelt so lang. Sein Widerstand …', 'verdoppelt sich', 'halbiert sich', 'bleibt gleich', 'vervierfacht sich', 'R = ρ · l / A: Der Widerstand ist proportional zur Länge.'],
    // ---- Bauelemente
    ['bauteile', 'Welche Aufgabe hat ein Vorwiderstand vor einer LED?', 'Er begrenzt den Strom durch die LED', 'Er erhöht die Spannung an der LED', 'Er speichert Energie', 'Er richtet den Strom gleich', 'Eine LED hat eine feste Durchlassspannung. Ohne Vorwiderstand würde der Strom unzulässig hoch.'],
    ['bauteile', 'In welcher Richtung leitet eine Diode?', 'Von der Anode zur Kathode', 'Von der Kathode zur Anode', 'In beide Richtungen', 'Nur bei Wechselspannung', 'In Durchlassrichtung fließt der Strom von der Anode zur Kathode (Ring auf dem Gehäuse markiert die Kathode).'],
    ['bauteile', 'Die Durchlassspannung einer Silizium-Diode beträgt etwa …', '0,7 V', '0,2 V', '5 V', '12 V', 'Eine Silizium-Diode leitet ab etwa 0,6 bis 0,7 V. Schottky-Dioden liegen niedriger.'],
    ['bauteile', 'Was geschieht mit der Kapazität eines Plattenkondensators, wenn der Plattenabstand kleiner wird?', 'Sie wird größer', 'Sie wird kleiner', 'Sie bleibt gleich', 'Sie wird null', 'C = ε · A / d: Je kleiner der Abstand d, desto größer die Kapazität.'],
    ['bauteile', 'Ein Elektrolytkondensator wird falsch gepolt betrieben. Welche Folge ist möglich?', 'Er erwärmt sich stark und kann platzen', 'Er arbeitet normal weiter', 'Seine Spannungsfestigkeit steigt', 'Er verdoppelt seine Kapazität', 'Elkos sind gepolt. Bei falscher Polung bricht die Oxidschicht ab, es fließt viel Strom, das Bauteil kann zerstört werden.'],
    ['bauteile', 'Ein npn-Transistor in Emitterschaltung als Schalter schaltet durch, wenn …', 'genügend Basisstrom fließt (UBE etwa 0,7 V)', 'die Basis auf Masse liegt', 'der Kollektor offen ist', 'die Emitterspannung größer als die Kollektorspannung ist', 'Erst ein Basisstrom bei etwa 0,7 V zwischen Basis und Emitter steuert die Kollektor-Emitter-Strecke auf.'],
    ['bauteile', 'Wozu dient eine Freilaufdiode parallel zu einer Relaisspule?', 'Sie schützt vor Spannungsspitzen beim Abschalten', 'Sie erhöht die Haltespannung', 'Sie verdoppelt den Spulenstrom', 'Sie ersetzt den Vorwiderstand', 'Beim Abschalten induziert die Spule eine hohe Gegenspannung. Die Diode leitet sie ab und schützt den Transistor.'],
    ['bauteile', 'Ein Widerstand trägt die Ringe Braun, Schwarz, Orange, Gold. Sein Wert ist …', '10 kΩ ± 5 %', '1 kΩ ± 5 %', '100 kΩ ± 10 %', '10 Ω ± 5 %', 'Braun = 1, Schwarz = 0, Orange = mal 1000, Gold = ± 5 %: 10 · 1000 Ω = 10 kΩ.'],
    ['bauteile', 'Ein Operationsverstärker ohne Gegenkopplung als Komparator gibt am Ausgang …', 'je nach Vorzeichen der Differenz etwa die positive oder negative Sättigungsspannung aus', 'immer genau 0 V aus', 'die Summe der Eingangsspannungen aus', 'die halbe Versorgungsspannung aus', 'Ohne Gegenkopplung ist die Verstärkung riesig, der Ausgang kippt in die Sättigung.'],
    ['bauteile', 'Welche Eigenschaft hat ein NTC-Widerstand?', 'Sein Widerstand sinkt bei steigender Temperatur', 'Sein Widerstand steigt bei steigender Temperatur', 'Sein Widerstand ist temperaturunabhängig', 'Er leitet nur in eine Richtung', 'NTC bedeutet negativer Temperaturkoeffizient: Heißleiter, der Widerstand fällt mit der Temperatur.'],
    ['bauteile', 'Wozu sitzt ein 100-nF-Kondensator direkt an der Versorgung eines ICs?', 'Er stützt die Versorgung gegen kurze Stromspitzen', 'Er erhöht die Taktfrequenz', 'Er dient als Vorwiderstand', 'Er schützt vor falscher Polung', 'Ein Abblockkondensator liefert kurzzeitig Strom, wenn der IC schaltet, und hält die Versorgung ruhig.'],
    // ---- Wechselstrom
    ['wechsel', 'Wie hängen Frequenz f und Periodendauer T zusammen?', 'f = 1 / T', 'f = T', 'f = T²', 'f = 2 · T', 'Eine Periode dauert T. In einer Sekunde passen 1/T Perioden hinein.'],
    ['wechsel', 'Die Netzspannung „230 V“ ist ein …', 'Effektivwert', 'Spitzenwert', 'Spitze-Spitze-Wert', 'Gleichrichtwert', 'Der Effektivwert gibt an, welche Gleichspannung dieselbe Leistung umsetzen würde. Der Spitzenwert liegt bei etwa 325 V.'],
    ['wechsel', 'Wie ändert sich der kapazitive Widerstand XC bei steigender Frequenz?', 'Er sinkt', 'Er steigt', 'Er bleibt gleich', 'Er wird induktiv', 'XC = 1 / (2π · f · C): Höhere Frequenz bedeutet kleineren Widerstand.'],
    ['wechsel', 'Wie ändert sich der induktive Widerstand XL bei steigender Frequenz?', 'Er steigt', 'Er sinkt', 'Er bleibt gleich', 'Er wird kapazitiv', 'XL = 2π · f · L: Er wächst mit der Frequenz.'],
    ['wechsel', 'Ein Tiefpass …', 'lässt tiefe Frequenzen durch und dämpft hohe', 'lässt hohe Frequenzen durch und dämpft tiefe', 'lässt nur eine einzige Frequenz durch', 'sperrt Gleichspannung', 'Beim RC-Tiefpass wird der Kondensator für hohe Frequenzen zum Kurzschluss gegen Masse.'],
    ['wechsel', 'Bei der Grenzfrequenz eines RC-Tiefpasses ist die Ausgangsspannung auf etwa … der Eingangsspannung gesunken.', '70,7 % (−3 dB)', '50 %', '10 %', '90 %', 'An der Grenzfrequenz gilt Ua / Ue = 1 / √2 ≈ 0,707, das sind −3 dB.'],
    ['wechsel', 'Was bewirkt ein Transformator?', 'Er wandelt eine Wechselspannung mit galvanischer Trennung auf einen anderen Wert', 'Er wandelt Gleichspannung in Wechselspannung', 'Er erhöht die Leistung', 'Er speichert Energie dauerhaft', 'Der Transformator überträgt Leistung über das Magnetfeld, die Wicklungen sind elektrisch getrennt.'],
    ['wechsel', 'Im Reihenschwingkreis bei Resonanz ist der Gesamtwiderstand …', 'minimal (nur der ohmsche Anteil)', 'unendlich', 'gleich XL + XC', 'maximal', 'Bei Resonanz heben sich XL und XC auf, es bleibt nur R, der Strom ist am größten.'],
    ['wechsel', 'Welche Phasenlage hat der Strom an einem idealen Kondensator an Wechselspannung?', 'Er eilt der Spannung um 90° voraus', 'Er eilt der Spannung um 90° nach', 'Er ist in Phase mit der Spannung', 'Er ist um 180° verschoben', 'Beim Kondensator fließt zuerst der Ladestrom, danach steigt die Spannung: Der Strom eilt vor (Merkhilfe: „Kondensator: Strom eilt vor“).'],
    ['wechsel', 'Was gibt der Leistungsfaktor cos φ an?', 'Das Verhältnis von Wirkleistung zu Scheinleistung', 'Das Verhältnis von Spannung zu Strom', 'Den Wirkungsgrad', 'Die Blindleistung in Prozent', 'cos φ = P / S. Je kleiner, desto mehr Blindleistung belastet das Netz.'],
    // ---- Digitaltechnik
    ['digital', 'Welcher Dezimalzahl entspricht die Binärzahl 1011?', '11', '13', '9', '10', '1·8 + 0·4 + 1·2 + 1·1 = 11.'],
    ['digital', 'Ein UND-Gatter (AND) gibt am Ausgang 1 aus, wenn …', 'alle Eingänge 1 sind', 'mindestens ein Eingang 1 ist', 'alle Eingänge 0 sind', 'die Eingänge verschieden sind', 'UND verlangt, dass alle Bedingungen gleichzeitig erfüllt sind.'],
    ['digital', 'Welchen Ausgangswert hat ein NAND-Gatter bei den Eingängen 1 und 1?', '0', '1', 'hochohmig', 'undefiniert', 'NAND ist die Verneinung von UND: 1 UND 1 = 1, verneint 0.'],
    ['digital', 'Ein XOR-Gatter (exklusives ODER) ergibt 1, wenn …', 'die Eingänge verschieden sind', 'beide Eingänge 1 sind', 'beide Eingänge 0 sind', 'mindestens ein Eingang 0 ist', 'XOR liefert 1 bei ungleichen Eingängen, 0 bei gleichen.'],
    ['digital', 'Ein D-Flipflop übernimmt den Wert am Eingang D …', 'bei der aktiven Taktflanke', 'jederzeit', 'nur bei Reset', 'bei jeder Änderung von D', 'Ein taktflankengesteuertes Flipflop speichert D nur im Moment der Taktflanke.'],
    ['digital', 'Wie viele verschiedene Zustände kann ein 4-Bit-Binärzähler annehmen?', '16', '8', '4', '32', '2⁴ = 16 Zustände (0 bis 15).'],
    ['digital', 'Was bewirkt ein Pull-up-Widerstand an einem digitalen Eingang?', 'Er legt den offenen Eingang auf High', 'Er legt den offenen Eingang auf Low', 'Er erhöht die Spannung dauerhaft über Vcc', 'Er schützt vor Überspannung', 'Ein Pull-up zieht den Eingang über einen Widerstand an die Versorgung, bis ein Taster ihn nach Masse zieht.'],
    ['digital', 'Der hexadezimalen Zahl 0xFF entspricht dezimal …', '255', '256', '15', '127', 'F = 15: 15 · 16 + 15 = 255.'],
    ['digital', 'Was liefert ein Halbaddierer?', 'Summe und Übertrag zweier Bits', 'Summe dreier Bits', 'Den Zählerstand', 'Einen gespeicherten Wert', 'Ein Halbaddierer addiert zwei Bits: Summe = XOR, Übertrag = UND.'],
    ['digital', 'Was bedeutet „Prellen“ bei einem Taster?', 'Mehrfaches schnelles Schließen und Öffnen beim Betätigen', 'Dauerhaften Kontaktverlust', 'Zu hohen Strom', 'Einen Kurzschluss der Versorgung', 'Die Kontakte federn mechanisch nach. Ein schneller Eingang zählt dann mehrere Flanken.'],
    // ---- Messtechnik
    ['messen', 'Wie wird ein Spannungsmesser angeschlossen?', 'Parallel zum Bauteil', 'In Reihe zum Bauteil', 'In Reihe zur Quelle', 'Berührungslos', 'Spannung misst man zwischen zwei Punkten, also parallel zum Bauteil.'],
    ['messen', 'Wie wird ein Strommesser angeschlossen?', 'In Reihe zum Verbraucher', 'Parallel zur Quelle', 'Parallel zum Verbraucher', 'Über einen Kondensator', 'Der Strom muss durch das Messgerät fließen, also wird der Kreis aufgetrennt und das Gerät in Reihe geschaltet.'],
    ['messen', 'Welchen Innenwiderstand sollte ein Spannungsmesser haben?', 'Möglichst hoch', 'Möglichst niedrig', 'Genau 1 Ω', 'Gleich dem Messobjekt', 'Ein hoher Innenwiderstand belastet die Schaltung kaum und verfälscht das Ergebnis wenig.'],
    ['messen', 'Was passiert, wenn man im Strommessbereich parallel zu einer Spannungsquelle misst?', 'Es entsteht praktisch ein Kurzschluss, die Messgerätesicherung kann auslösen', 'Es wird die Spannung angezeigt', 'Es wird 0 angezeigt und nichts passiert', 'Das Gerät lädt sich auf', 'Der Strommessbereich hat einen sehr kleinen Innenwiderstand.'],
    ['messen', 'Was gibt die Zeitbasis (Zeit pro Teilung) am Oszilloskop an?', 'Die Zeit pro waagerechtem Rasterkästchen', 'Die Spannung pro Rasterkästchen', 'Die Triggerschwelle', 'Die Bandbreite', 'Mit der Zeitbasis liest man Periodendauer und Frequenz ab.'],
    ['messen', 'Was bewirkt ein Tastkopf mit Teilung 10 : 1?', 'Er teilt das Signal durch 10 und erhöht die Eingangsimpedanz', 'Er verstärkt das Signal um den Faktor 10', 'Er filtert Signale unter 10 Hz', 'Er begrenzt auf 10 V', 'Der 10:1-Tastkopf belastet die Schaltung weniger, der abgelesene Wert muss mit 10 multipliziert werden (oder das Gerät rechnet es ein).'],
    ['messen', 'Wozu dient die Triggerung am Oszilloskop?', 'Sie startet die Darstellung immer an derselben Signalstelle und liefert ein stehendes Bild', 'Sie verstärkt das Signal', 'Sie speichert das Bild dauerhaft', 'Sie schaltet den Kanal um', 'Ohne Trigger würde das Bild durchlaufen.'],
    ['messen', 'Wie misst man den Widerstand eines Bauteils sinnvoll?', 'Spannungsfrei und freigeschaltet, möglichst ausgelötet', 'Unter Betriebsspannung', 'Im Strommessbereich', 'Parallel zu einem Kondensator', 'Fremdspannungen und parallele Zweige verfälschen die Messung oder zerstören das Messgerät.'],
    ['messen', 'Was bedeutet „True RMS“ bei einem Multimeter?', 'Das Gerät misst den Effektivwert auch bei nicht sinusförmigen Signalen richtig', 'Es misst nur Gleichspannung', 'Es zeigt nur Spitzenwerte an', 'Es misst Frequenzen bis 1 GHz', 'Einfache Geräte messen den Gleichrichtwert und rechnen für Sinus um. True RMS bildet den echten Effektivwert.'],
    ['messen', 'Ein Messwert weicht immer in dieselbe Richtung vom wahren Wert ab. Das ist ein …', 'systematischer Fehler', 'zufälliger Fehler', 'grober Fehler durch Ablesen', 'Rundungsfehler', 'Systematische Fehler haben eine feste Richtung, zum Beispiel durch Nullpunktabweichung oder Gerätetoleranz.'],
    // ---- Stromversorgung
    ['strom', 'Wozu dient ein Siebkondensator nach dem Gleichrichter?', 'Er glättet die pulsierende Gleichspannung', 'Er verdoppelt die Spannung', 'Er schützt vor Kurzschluss', 'Er wandelt in Wechselspannung', 'Der Kondensator lädt sich auf den Spitzenwert und gibt zwischen den Spitzen Energie ab.'],
    ['strom', 'Wie viele Dioden hat ein Brückengleichrichter?', '4', '2', '1', '6', 'Vier Dioden arbeiten in zwei Paaren abwechselnd.'],
    ['strom', 'Welche Frequenz hat die Brummspannung bei Zweiweggleichrichtung aus dem 50-Hz-Netz?', '100 Hz', '50 Hz', '25 Hz', '200 Hz', 'Bei Zweiweggleichrichtung gibt es pro Netzperiode zwei Spannungsbuckel, also 100 Hz.'],
    ['strom', 'Welcher Vorteil spricht für einen Schaltregler gegenüber einem Linearregler?', 'Höherer Wirkungsgrad, weniger Verlustwärme', 'Weniger Störungen', 'Einfacherer Aufbau', 'Kein Kondensator nötig', 'Der Linearregler wandelt die Spannungsdifferenz in Wärme. Der Schaltregler arbeitet getaktet mit kleinen Verlusten.'],
    ['strom', 'Ein Festspannungsregler 7805 liefert …', '5 V stabilisiert', '5 A', '50 V', '−5 V', 'Die Typenbezeichnung 78xx steht für positive Festspannung, xx = Ausgangsspannung (05 = 5 V).'],
    ['strom', 'Was bedeutet Schutzklasse II?', 'Schutzisolierung, kein Schutzleiteranschluss nötig', 'Gerät mit Schutzleiter', 'Schutzkleinspannung', 'Gerät für den Außenbereich', 'Schutzklasse II (Symbol: Quadrat im Quadrat) sichert durch doppelte oder verstärkte Isolierung.'],
    ['strom', 'Warum braucht ein Linearregler oft einen Kühlkörper?', 'Die Spannungsdifferenz mal Strom wird als Wärme umgesetzt', 'Er erzeugt Hochfrequenz', 'Er enthält einen Transformator', 'Er schaltet mit hoher Frequenz', 'Verlustleistung = (Ue − Ua) · I.'],
    ['strom', 'Wozu dient eine Z-Diode in einer einfachen Stabilisierung?', 'Sie hält in Sperrrichtung im Durchbruch die Spannung nahezu konstant', 'Sie richtet Wechselspannung gleich', 'Sie speichert Energie', 'Sie verstärkt den Strom', 'In der Z-Diode steigt der Strom im Durchbruch stark, die Spannung ändert sich kaum.'],
    ['strom', 'Wozu dient die Feinsicherung in einem Netzteil?', 'Schutz vor zu hohem Strom bei Überlast und Kurzschluss', 'Schutz vor Blitzüberspannung', 'Glättung der Ausgangsspannung', 'Erhöhung des Wirkungsgrads', 'Die Sicherung schmilzt bei zu hohem Strom und trennt das Gerät vom Netz.'],
    // ---- Mikrocontroller
    ['mcu', 'Wofür steht PWM?', 'Pulsweitenmodulation', 'Parallele Wechselmodulation', 'Phasenweises Messen', 'Programmierbare Wellenform-Matrix', 'Bei PWM wird ein Rechtecksignal mit festem Takt und veränderlichem Tastgrad erzeugt.'],
    ['mcu', 'Wie verändert man mit PWM die mittlere Spannung?', 'Über das Verhältnis von Einschaltzeit zur Periodendauer (Tastgrad)', 'Über die Höhe der Versorgungsspannung', 'Über die Frequenz allein', 'Über einen Vorwiderstand', 'Mittelwert = Tastgrad · Spannung im eingeschalteten Zustand.'],
    ['mcu', 'Was bewirkt ein Pull-down-Widerstand an einem Eingang?', 'Er hält den offenen Eingang auf Low', 'Er hält den offenen Eingang auf High', 'Er begrenzt den Strom der Versorgung', 'Er schützt vor Funkstörungen', 'Ein Pull-down zieht den Eingang nach Masse, solange kein anderes Signal anliegt.'],
    ['mcu', 'Was bewirkt delay(500) in einem Arduino-Programm?', 'Das Programm pausiert etwa 500 Millisekunden', 'Es pausiert 500 Sekunden', 'Es pausiert 500 Mikrosekunden', 'Es setzt Pin 500', 'delay() erwartet Millisekunden.'],
    ['mcu', 'Welche Logikpegel hat ein 5-V-Arduino Uno typischerweise an den Pins?', '0 V (Low) und 5 V (High)', '0 V und 3,3 V', '−5 V und +5 V', '0 V und 12 V', 'Der Uno arbeitet mit 5-V-Logik.'],
    ['mcu', 'Warum sollte ein 5-V-Ausgang nicht ohne Pegelwandlung an einen 3,3-V-Eingang?', 'Die Überspannung kann den Eingang beschädigen', 'Das Signal würde zu langsam', 'Der Strom wäre zu klein', 'Der Eingang würde dauerhaft Low melden', 'Viele 3,3-V-Bausteine vertragen am Eingang nicht mehr als etwa 3,6 V.'],
    ['mcu', 'Was bewirkt eine if-Anweisung?', 'Sie führt Code nur aus, wenn die Bedingung erfüllt ist', 'Sie wiederholt Code endlos', 'Sie definiert eine Variable', 'Sie beendet das Programm', 'Mit if wird verzweigt.'],
    ['mcu', 'Wie entprellt man einen Taster zuverlässig?', 'Per Software mit Wartezeit oder per RC-Glied in der Hardware', 'Mit höherer Spannung', 'Mit einem längeren Kabel', 'Gar nicht, das ist nicht nötig', 'Nach der ersten Flanke wartet man einige Millisekunden, bis der Kontakt ruhig ist.'],
    ['mcu', 'Was ist ein Interrupt?', 'Eine Unterbrechung des Programms durch ein Ereignis zur sofortigen Behandlung', 'Ein Programmfehler', 'Ein Speicherbereich', 'Eine Schleife', 'Ein Interrupt unterbricht den Hauptablauf, die Service-Routine läuft sofort.'],
    ['mcu', 'Wann läuft die Funktion setup() in einem Arduino-Programm?', 'Einmal beim Start', 'Endlos', 'Bei jedem Tastendruck', 'Beim Beenden', 'setup() initialisiert, loop() wiederholt sich danach.'],
    // ---- Sicherheit und Normen
    ['sicher', 'Welche ist die erste der fünf Sicherheitsregeln?', 'Freischalten', 'Spannungsfreiheit feststellen', 'Erden und Kurzschließen', 'Gegen Wiedereinschalten sichern', 'Reihenfolge: Freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit feststellen, Erden und Kurzschließen, benachbarte Teile abdecken.'],
    ['sicher', 'Welcher Schritt folgt auf „Gegen Wiedereinschalten sichern“?', 'Spannungsfreiheit allpolig feststellen', 'Erden und Kurzschließen', 'Anlage einschalten', 'Benachbarte Teile abdecken', 'Vor dem Erden wird sicher festgestellt, dass keine Spannung anliegt.'],
    ['sicher', 'Wofür steht die Abkürzung ESD?', 'Elektrostatische Entladung', 'Elektrische Sicherheitsdiode', 'Energiesparendes Display', 'Externe Stromdichte', 'ESD zerstört empfindliche Halbleiter, oft ohne dass man den Funken spürt.'],
    ['sicher', 'Wie schützt man empfindliche Bauteile vor ESD?', 'ESD-Armband an geerdeter Arbeitsmatte', 'Gummihandschuhe', 'Anschlüsse anfassen', 'Trockene Raumluft', 'Armband und Matte leiten Ladungen kontrolliert ab. Trockene Luft verschlimmert das Problem.'],
    ['sicher', 'Bis zu welcher Wechselspannung spricht man von Kleinspannung?', '50 V', '230 V', '400 V', '12 V', 'Kleinspannung gilt bis 50 V Wechselspannung und 120 V Gleichspannung (ohne Welligkeit).'],
    ['sicher', 'Welche Gefahr besteht beim Löten besonders?', 'Verbrennungen und Flussmitteldämpfe', 'Röntgenstrahlung', 'Starke Magnetfelder', 'Kälteschäden', 'Darum arbeitet man mit Absaugung, ablegbarem Kolben und ohne Lötkolben in der Hand beim Wegdrehen.'],
    ['sicher', 'Wie entsorgt man Elektronikschrott richtig?', 'Über Rücknahmestellen oder Wertstoffhof (ElektroG)', 'Im Hausmüll', 'Im Gelben Sack', 'Durch Verbrennen', 'Elektroaltgeräte enthalten Wertstoffe und Schadstoffe und werden getrennt gesammelt.'],
    ['sicher', 'Wozu dient ein FI-Schutzschalter (RCD)?', 'Er schaltet bei Fehlerstrom gegen Erde schnell ab und schützt Personen', 'Er schützt die Leitung vor Überlast', 'Er stabilisiert die Spannung', 'Er begrenzt den Einschaltstrom', 'Der FI vergleicht Hin- und Rückstrom. Eine Differenz (zum Beispiel durch den Körper) löst aus.'],
    ['sicher', 'Was tust du als Erstes bei einem Stromunfall im Niederspannungsbereich?', 'Strom abschalten oder Stecker ziehen, dabei Eigenschutz beachten', 'Den Verletzten sofort anfassen', 'Wasser holen', 'Erst Fotos machen', 'Nur wenn die Spannung weg ist, kann man gefahrlos helfen. Danach Notruf und Erste Hilfe.'],
    ['sicher', 'Welche Farbe hat ein Schutzleiter?', 'Grün-Gelb', 'Blau', 'Schwarz', 'Rot', 'Grün-Gelb ist dem Schutzleiter vorbehalten, Blau dem Neutralleiter.'],
    ['sicher', 'Was sagt das CE-Zeichen auf einem Produkt aus?', 'Der Hersteller erklärt die Übereinstimmung mit den EU-Vorgaben', 'Eine unabhängige Stelle hat jedes Gerät geprüft', 'Es wurde in Europa hergestellt', 'Es ist besonders umweltfreundlich', 'Das CE-Zeichen ist eine Herstellererklärung. Es ist kein Gütesiegel und keine Herkunftsangabe.']
  ];

  /* ---------- Zufall und Zahlenformat ---------- */
  const seeded = seed => { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return { f, pick: arr => arr[Math.floor(f() * arr.length)], int: (a, b) => a + Math.floor(f() * (b - a + 1)), shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; } }; };
  const de = (x, d) => { let s = (Math.round(x * Math.pow(10, d == null ? 4 : d)) / Math.pow(10, d == null ? 4 : d)).toString(); if (/e/.test(s)) s = Number(x).toPrecision(4); return s.replace('.', ','); };
  const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2], E6 = [1, 1.5, 2.2, 3.3, 4.7, 6.8];
  const sig = (x, n) => Number(Number(x).toPrecision(n || 4));

  /* ---------- Rechengeneratoren ---------- */
  const GEN = {
    grund: [
      r => { const R = r.pick(E12) * r.pick([1, 10]), I = r.pick([1, 2, 2.5, 3.2, 4, 5, 8, 10]); return { q: 'Durch einen Widerstand von ' + de(R) + ' kΩ fließen ' + de(I) + ' mA. Welche Spannung fällt an ihm ab?', ans: R * I, unit: 'V', w: 'U = R · I = ' + de(R) + ' kΩ · ' + de(I) + ' mA = ' + de(R * I) + ' V (kΩ mal mA ergibt V).' }; },
      r => { const a = r.pick([100, 220, 330, 470, 680, 1000]), b = r.pick([100, 220, 330, 470, 680, 1000]), c = r.pick([100, 220, 330, 470, 680, 1000]); return { q: 'Drei Widerstände mit ' + a + ' Ω, ' + b + ' Ω und ' + c + ' Ω liegen in Reihe. Wie groß ist der Gesamtwiderstand?', ans: a + b + c, unit: 'Ω', w: 'In der Reihenschaltung addieren sich die Widerstände: ' + a + ' + ' + b + ' + ' + c + ' = ' + (a + b + c) + ' Ω.' }; },
      r => { const a = r.pick(E6), b = r.pick(E6), p = a * b / (a + b); return { q: 'Zwei Widerstände mit ' + de(a) + ' kΩ und ' + de(b) + ' kΩ liegen parallel. Wie groß ist der Gesamtwiderstand?', ans: p, unit: 'kΩ', w: 'R = R1 · R2 / (R1 + R2) = ' + de(a) + ' · ' + de(b) + ' / ' + de(a + b) + ' = ' + de(p, 3) + ' kΩ.' }; },
      r => { const U = r.pick([12, 24, 230]), R = r.pick([10, 22, 47, 100, 220]), P = U * U / R; return { q: 'Ein Heizwiderstand mit ' + R + ' Ω liegt an ' + U + ' V. Welche Leistung setzt er um?', ans: P, unit: 'W', w: 'P = U² / R = (' + U + ' V)² / ' + R + ' Ω = ' + de(P, 2) + ' W.' }; },
      r => { const U = r.pick([5, 9, 12, 24]), R1 = r.pick([1, 2.2, 3.3, 4.7, 10]), R2 = r.pick([1, 2.2, 3.3, 4.7, 10]), Ua = U * R2 / (R1 + R2); return { q: 'Ein unbelasteter Spannungsteiler besteht aus R1 = ' + de(R1) + ' kΩ (oben) und R2 = ' + de(R2) + ' kΩ (unten) an ' + U + ' V. Wie groß ist die Spannung über R2?', ans: Ua, unit: 'V', w: 'Ua = U · R2 / (R1 + R2) = ' + U + ' V · ' + de(R2) + ' / ' + de(R1 + R2) + ' = ' + de(Ua, 3) + ' V.' }; },
      r => { const P = r.pick([0.5, 1.2, 1.5, 2]), t = r.pick([2, 3, 4, 5, 8]), K = P * t * 0.35; return { q: 'Ein Gerät mit ' + de(P) + ' kW läuft ' + t + ' Stunden. Eine kWh kostet 0,35 €. Wie hoch sind die Stromkosten?', ans: K, unit: '€', w: 'Energie = P · t = ' + de(P) + ' kW · ' + t + ' h = ' + de(P * t) + ' kWh. Kosten = ' + de(P * t) + ' kWh · 0,35 €/kWh = ' + de(K, 2) + ' €.' }; }
    ],
    bauteile: [
      r => { const Ub = r.pick([5, 9, 12, 24]), blau = r.pick([0, 1]), Uf = blau ? 3 : 2, I = r.pick([10, 15, 20]), R = (Ub - Uf) / I * 1000; return { q: 'Eine ' + (blau ? 'blaue LED (Durchlassspannung 3,0 V)' : 'rote LED (Durchlassspannung 2,0 V)') + ' soll mit ' + I + ' mA an ' + Ub + ' V betrieben werden. Wie groß ist der Vorwiderstand mindestens (rechnerisch)?', ans: R, unit: 'Ω', w: 'R = (Ub − Uf) / I = (' + Ub + ' V − ' + de(Uf) + ' V) / ' + I + ' mA = ' + de(R, 1) + ' Ω. In der Praxis nimmt man den nächsten größeren Wert der E-Reihe.' }; },
      r => { const C = r.pick([10, 47, 100, 220, 470]), U = r.pick([5, 12, 16, 25]); return { q: 'Ein Kondensator mit ' + C + ' µF ist auf ' + U + ' V geladen. Wie groß ist die gespeicherte Ladung?', ans: C * U, unit: 'µC', w: 'Q = C · U = ' + C + ' µF · ' + U + ' V = ' + (C * U) + ' µC.' }; },
      r => { const R = r.pick([1, 2.2, 4.7, 10, 47]), C = r.pick([1, 10, 47, 100]); return { q: 'Ein RC-Glied hat R = ' + de(R) + ' kΩ und C = ' + C + ' µF. Wie groß ist die Zeitkonstante τ?', ans: R * C, unit: 'ms', w: 'τ = R · C = ' + de(R) + ' kΩ · ' + C + ' µF = ' + de(R * C) + ' ms (kΩ mal µF ergibt ms).' }; },
      r => { const C = r.pick([100, 220, 470, 1000]), U = r.pick([5, 12, 24]), W = 0.5 * C * U * U / 1000; return { q: 'Ein Kondensator mit ' + C + ' µF ist auf ' + U + ' V geladen. Welche Energie ist gespeichert?', ans: W, unit: 'mJ', w: 'W = ½ · C · U² = 0,5 · ' + C + ' µF · (' + U + ' V)² = ' + de(W, 2) + ' mJ.' }; },
      r => { const Ic = r.pick([20, 50, 100, 200]), B = r.pick([100, 150, 200, 250]), Ib = Ic / B * 1000; return { q: 'Ein Transistor mit Stromverstärkung B = ' + B + ' soll einen Kollektorstrom von ' + Ic + ' mA schalten. Welcher Basisstrom ist mindestens nötig?', ans: Ib, unit: 'µA', w: 'IB = IC / B = ' + Ic + ' mA / ' + B + ' = ' + de(Ib, 1) + ' µA. Zum sicheren Sättigen nimmt man in der Praxis mehr.' }; },
      r => { const Rf = r.pick([10, 22, 47, 100]), Rg = r.pick([1, 2.2, 4.7, 10]), v = 1 + Rf / Rg; return { q: 'Ein nichtinvertierender Operationsverstärker hat Rf = ' + Rf + ' kΩ und Rg = ' + de(Rg) + ' kΩ. Wie groß ist die Spannungsverstärkung (ohne Einheit)?', ans: v, unit: '', w: 'V = 1 + Rf / Rg = 1 + ' + Rf + ' / ' + de(Rg) + ' = ' + de(v, 2) + '.' }; }
    ],
    wechsel: [
      r => { const T = r.pick([0.2, 0.5, 1, 2, 4, 5, 20]), f = 1000 / T; return { q: 'Eine Schwingung hat eine Periodendauer von ' + de(T) + ' ms. Welche Frequenz hat sie?', ans: f, unit: 'Hz', w: 'f = 1 / T = 1 / ' + de(T) + ' ms = ' + de(f) + ' Hz.' }; },
      r => { const U = r.pick([12, 17, 24, 40, 325, 565]), e = U / Math.SQRT2; return { q: 'Eine sinusförmige Wechselspannung hat einen Spitzenwert von ' + U + ' V. Wie groß ist der Effektivwert?', ans: e, unit: 'V', w: 'Ueff = Û / √2 = ' + U + ' V / 1,414 = ' + de(e, 1) + ' V.' }; },
      r => { const f = r.pick([50, 100, 1000, 5000]), C = r.pick([0.1, 0.47, 1, 4.7, 10]), X = 1 / (2 * Math.PI * f * C * 1e-6); return { q: 'Welchen kapazitiven Widerstand hat ein Kondensator mit ' + de(C) + ' µF bei ' + f + ' Hz?', ans: X, unit: 'Ω', w: 'XC = 1 / (2π · f · C) = 1 / (2π · ' + f + ' Hz · ' + de(C) + ' µF) = ' + de(X, 1) + ' Ω.' }; },
      r => { const R = r.pick([1, 4.7, 10, 22]), C = r.pick([10, 47, 100]), f = 1 / (2 * Math.PI * R * 1e3 * C * 1e-9); return { q: 'Ein RC-Tiefpass hat R = ' + de(R) + ' kΩ und C = ' + C + ' nF. Wie groß ist seine Grenzfrequenz?', ans: f, unit: 'Hz', w: 'fg = 1 / (2π · R · C) = 1 / (2π · ' + de(R) + ' kΩ · ' + C + ' nF) = ' + de(f, 1) + ' Hz.' }; },
      r => { const N2 = r.pick([60, 115, 230, 345]), U = 230 * N2 / 1150; return { q: 'Ein Transformator hat primär 1150 Windungen an 230 V. Wie groß ist die Sekundärspannung bei ' + N2 + ' Windungen (ideal, unbelastet)?', ans: U, unit: 'V', w: 'U2 = U1 · N2 / N1 = 230 V · ' + N2 + ' / 1150 = ' + de(U, 1) + ' V.' }; },
      r => { const L = r.pick([1, 10, 100]), C = r.pick([10, 100, 470]), f = 1 / (2 * Math.PI * Math.sqrt(L * 1e-3 * C * 1e-9)) / 1000; return { q: 'Ein Schwingkreis hat L = ' + L + ' mH und C = ' + C + ' nF. Wie groß ist die Resonanzfrequenz?', ans: f, unit: 'kHz', w: 'f0 = 1 / (2π · √(L · C)) = 1 / (2π · √(' + L + ' mH · ' + C + ' nF)) = ' + de(f, 2) + ' kHz.' }; }
    ],
    digital: [
      r => { const n = r.int(20, 250), b = ('00000000' + n.toString(2)).slice(-8), g = b.slice(0, 4) + ' ' + b.slice(4); return { q: 'Wandle die Binärzahl ' + g + ' in eine Dezimalzahl um.', ans: n, unit: '', tol: 0, w: 'Stellenwerte 128, 64, 32, 16, 8, 4, 2, 1: Ergebnis ' + n + '.' }; },
      r => { const n = r.int(26, 255), h = n.toString(16).toUpperCase(); return { q: 'Wandle die Hexadezimalzahl 0x' + h + ' in eine Dezimalzahl um.', ans: n, unit: '', tol: 0, w: '0x' + h + ' = ' + parseInt(h[0], 16) + ' · 16 + ' + parseInt(h[1], 16) + ' = ' + n + '.' }; },
      r => { const n = r.pick([8, 10, 12]), U = r.pick([3.3, 5]), l = U * 1000 / Math.pow(2, n); return { q: 'Ein Analog-Digital-Wandler mit ' + n + ' Bit hat die Referenzspannung ' + de(U) + ' V. Wie groß ist eine Stufe (1 LSB)?', ans: l, unit: 'mV', w: 'LSB = Uref / 2ⁿ = ' + de(U) + ' V / ' + Math.pow(2, n) + ' = ' + de(l, 3) + ' mV.' }; },
      r => { const N = r.pick([100, 200, 300, 1000, 5000]), b = Math.ceil(Math.log2(N)); return { q: 'Wie viele Bit braucht man mindestens, um ' + N + ' verschiedene Zustände darzustellen?', ans: b, unit: 'Bit', tol: 0, w: '2^' + (b - 1) + ' = ' + Math.pow(2, b - 1) + ' reicht nicht, 2^' + b + ' = ' + Math.pow(2, b) + ' reicht. Also ' + b + ' Bit.' }; },
      r => { const n = r.pick([3, 4, 5, 8]), f = r.pick([64, 128, 256, 1000]), o = f / Math.pow(2, n); return { q: 'Ein ' + n + '-Bit-Binärzähler wird mit ' + f + ' kHz getaktet. Welche Frequenz hat das höchstwertige Ausgangsbit?', ans: o, unit: 'kHz', w: 'Jede Stufe halbiert die Frequenz. Höchstes Bit: f / 2ⁿ = ' + f + ' kHz / ' + Math.pow(2, n) + ' = ' + de(o, 3) + ' kHz.' }; }
    ],
    messen: [
      r => { const S = r.pick([5, 10, 12, 24]), d = r.pick([1, 2, 3, 4, 5]), A = S * (1 + d / 100); return { q: 'Ein Messgerät zeigt bei einer Sollspannung von ' + S + ' V den Wert ' + de(A, 2) + ' V an. Wie groß ist die relative Abweichung?', ans: d, unit: '%', w: 'Abweichung = (Anzeige − Soll) / Soll = ' + de(A - S, 2) + ' V / ' + S + ' V = ' + d + ' %.' }; },
      r => { const p = r.pick([0.5, 1, 2]), dg = r.pick([2, 3, 5]), U = r.pick([3.3, 5, 12, 24]), e = p / 100 * U + dg * 0.01; return { q: 'Ein Multimeter hat die Genauigkeit ± (' + de(p) + ' % vom Messwert + ' + dg + ' Digit) bei einer Auflösung von 0,01 V. Angezeigt werden ' + de(U, 2) + ' V. Wie groß ist der größte mögliche Fehler?', ans: e, unit: 'V', w: 'Fehler = ' + de(p) + ' % · ' + de(U, 2) + ' V + ' + dg + ' · 0,01 V = ' + de(p / 100 * U, 3) + ' V + ' + de(dg * 0.01, 2) + ' V = ' + de(e, 3) + ' V.' }; },
      r => { const k = r.pick([2, 4, 5, 8]), t = r.pick([0.1, 0.2, 0.5, 1, 2]), f = 1000 / (k * t); return { q: 'Am Oszilloskop (Zeitbasis ' + de(t) + ' ms pro Teilung) nimmt eine Periode ' + k + ' Teilungen ein. Welche Frequenz hat das Signal?', ans: f, unit: 'Hz', w: 'T = ' + k + ' · ' + de(t) + ' ms = ' + de(k * t) + ' ms, f = 1 / T = ' + de(f, 1) + ' Hz.' }; },
      r => { const k = r.pick([2, 3, 4, 5, 6]), v = r.pick([0.5, 1, 2, 5]), tk = r.pick([1, 10]), u = k * v * tk; return { q: 'Das Signal belegt von Spitze zu Spitze ' + k + ' Teilungen bei ' + de(v) + ' V/Teilung. Es wird mit einem Tastkopf ' + tk + ' : 1 gemessen, und das Gerät rechnet die Teilung nicht ein. Wie groß ist die tatsächliche Spitze-Spitze-Spannung?', ans: u, unit: 'V', w: 'Upp = Teilungen · V/Teilung · Teilerfaktor = ' + k + ' · ' + de(v) + ' V · ' + tk + ' = ' + de(u) + ' V.' }; },
      r => { const U = r.pick([10, 25, 50, 100]), R = r.pick([0.1, 0.5, 1]), I = U / R; return { q: 'An einem Messwiderstand (Shunt) von ' + de(R) + ' Ω fällt eine Spannung von ' + U + ' mV ab. Welcher Strom fließt?', ans: I, unit: 'mA', w: 'I = U / R = ' + U + ' mV / ' + de(R) + ' Ω = ' + de(I) + ' mA.' }; }
    ],
    strom: [
      r => { const U = r.pick([9, 12, 15, 18]), u = U * Math.SQRT2 - 1.4; return { q: 'Ein Transformator liefert ' + U + ' V Wechselspannung (Effektivwert) an einen Brückengleichrichter mit Siebkondensator, unbelastet. Wie groß ist die Gleichspannung ungefähr (je Diode 0,7 V Durchlassspannung, zwei Dioden im Strompfad)?', ans: u, unit: 'V', w: 'Û = Ueff · √2 = ' + U + ' V · 1,414 = ' + de(U * Math.SQRT2, 2) + ' V. Minus 2 · 0,7 V = ' + de(u, 2) + ' V.' }; },
      r => { const I = r.pick([50, 100, 200, 500]), C = r.pick([470, 1000, 2200, 4700]), d = I / 1000 / (100 * C * 1e-6); return { q: 'Ein Siebkondensator mit ' + C + ' µF wird nach einem Brückengleichrichter (100 Hz) mit ' + I + ' mA belastet. Wie groß ist die Brummspannung (Spitze-Spitze, vereinfacht ΔU = I / (f · C))?', ans: d, unit: 'V', w: 'ΔU = I / (f · C) = ' + de(I / 1000) + ' A / (100 Hz · ' + C + ' µF) = ' + de(d, 2) + ' V.' }; },
      r => { const Ue = r.pick([9, 12, 15, 24]), Ua = r.pick([5, 3.3]), I = r.pick([0.1, 0.2, 0.5, 1]), P = (Ue - Ua) * I; return { q: 'Ein Linearregler wandelt ' + Ue + ' V in ' + de(Ua) + ' V bei ' + de(I) + ' A Laststrom. Welche Verlustleistung entsteht im Regler?', ans: P, unit: 'W', w: 'PV = (Ue − Ua) · I = (' + Ue + ' V − ' + de(Ua) + ' V) · ' + de(I) + ' A = ' + de(P, 3) + ' W.' }; },
      r => { const Pz = r.pick([10, 20, 50, 100]), f = r.pick([0.6, 0.75, 0.8, 0.9]), Pa = Pz * f; return { q: 'Ein Netzteil nimmt ' + Pz + ' W auf und gibt ' + de(Pa, 1) + ' W ab. Wie groß ist der Wirkungsgrad?', ans: f * 100, unit: '%', w: 'η = Pab / Pzu = ' + de(Pa, 1) + ' W / ' + Pz + ' W = ' + de(f * 100, 0) + ' %.' }; },
      r => { const Ub = r.pick([9, 12, 15]), Uz = r.pick([3.3, 5.1, 6.2]), I = r.pick([10, 20, 25]), R = (Ub - Uz) / I * 1000; return { q: 'Eine Z-Diode mit ' + de(Uz) + ' V wird aus ' + Ub + ' V gespeist. Durch den Vorwiderstand sollen ' + I + ' mA fließen. Wie groß ist der Vorwiderstand?', ans: R, unit: 'Ω', w: 'R = (Ub − Uz) / I = (' + Ub + ' V − ' + de(Uz) + ' V) / ' + I + ' mA = ' + de(R, 1) + ' Ω.' }; }
    ],
    mcu: [
      r => { const D = r.pick([10, 20, 25, 40, 50, 60, 75, 80]), U = r.pick([5, 3.3]), u = D / 100 * U; return { q: 'Ein PWM-Ausgang (Pegel ' + de(U) + ' V) hat einen Tastgrad von ' + D + ' %. Welche mittlere Spannung ergibt sich?', ans: u, unit: 'V', w: 'Mittelwert = Tastgrad · Pegel = ' + D + ' % · ' + de(U) + ' V = ' + de(u, 3) + ' V.' }; },
      r => { const a = r.pick([100, 200, 250, 300, 500]), b = r.pick([400, 500, 750, 800, 1000]), f = 1000 / (a + b); return { q: 'Eine LED leuchtet ' + a + ' ms und ist danach ' + b + ' ms aus (dann wiederholt es sich). Welche Blinkfrequenz ergibt das?', ans: f, unit: 'Hz', w: 'Periode = ' + a + ' ms + ' + b + ' ms = ' + (a + b) + ' ms. f = 1 / T = ' + de(f, 3) + ' Hz.' }; },
      r => { const B = r.pick([9600, 19200, 57600, 115200]); return { q: 'Eine serielle Schnittstelle arbeitet mit ' + B + ' Baud im Format 8N1 (je Zeichen 1 Startbit, 8 Datenbits, 1 Stoppbit). Wie viele Zeichen werden pro Sekunde höchstens übertragen?', ans: B / 10, unit: 'Zeichen/s', w: 'Je Zeichen 10 Bit: ' + B + ' / 10 = ' + (B / 10) + ' Zeichen pro Sekunde.' }; },
      r => { const n = r.pick([10, 20, 50, 100, 250]); return { q: 'Auf einem Arduino Uno ist ein int 2 Byte groß. Wie viel Speicher belegt ein Array mit ' + n + ' Werten vom Typ int?', ans: 2 * n, unit: 'Byte', tol: 0, w: n + ' · 2 Byte = ' + (2 * n) + ' Byte.' }; }
    ],
    sicher: [
      r => { const Z = r.pick([0.2, 0.4, 0.5, 0.8, 1]), I = 230 / Z; return { q: 'In einem Stromkreis an 230 V beträgt die Schleifenimpedanz ' + de(Z) + ' Ω. Welcher Kurzschlussstrom kann höchstens fließen?', ans: I, unit: 'A', w: 'Ik = U / Z = 230 V / ' + de(Z) + ' Ω = ' + de(I, 1) + ' A.' }; },
      r => { const P = r.pick([1000, 1500, 1800, 2300]), I = P / 230; return { q: 'Ein Gerät mit ' + P + ' W Leistungsaufnahme hängt am 230-V-Netz. Welchen Strom nimmt es auf?', ans: I, unit: 'A', w: 'I = P / U = ' + P + ' W / 230 V = ' + de(I, 2) + ' A.' }; },
      r => { const P = r.pick([40, 60, 80, 100]), t = r.pick([4, 6, 8]), E = P * t / 1000; return { q: 'Ein Lötkolben mit ' + P + ' W Leistung ist ' + t + ' Stunden eingeschaltet. Welche Energie nimmt er auf?', ans: E, unit: 'kWh', w: 'E = P · t = ' + P + ' W · ' + t + ' h = ' + (P * t) + ' Wh = ' + de(E, 3) + ' kWh.' }; }
    ]
  };

  /* ---------- Fragen ziehen ---------- */
  function mcQuestion(i, r) {
    const m = MC[i], opts = r.shuffle([m[2], m[3], m[4], m[5]]);
    return { id: 'mc' + i, k: m[0], type: 'mc', q: m[1], opts, r: opts.indexOf(m[2]), w: m[6], pts: 2 };
  }
  function numQuestion(topic, gi, seed) {
    const r = seeded(seed), g = GEN[topic][gi](r);
    return { id: 'n' + topic + gi + '_' + seed, k: topic, type: 'num', q: g.q, ans: g.ans, unit: g.unit, tol: g.tol == null ? 0.02 : g.tol, w: g.w, pts: 4 };
  }
  /* n Fragen für ein Thema (oder alle Themen mit k = null), mode: 'mix' | 'rechnen' | 'mc' */
  function draw(k, n, seed, mode) {
    const r = seeded(seed), out = [], used = new Set();
    const topics = k ? [k] : TOPICS.map(t => t.k);
    const mcIdx = topics.reduce((a, t) => a.concat(MC.map((m, i) => (m[0] === t ? i : -1)).filter(i => i >= 0)), []);
    const numPool = []; topics.forEach(t => GEN[t].forEach((g, gi) => numPool.push([t, gi])));
    const wantNum = mode === 'rechnen' ? n : mode === 'mc' ? 0 : Math.round(n * 0.4);
    const nums = r.shuffle(numPool);
    for (let i = 0; i < wantNum; i++) { const p = nums[i % nums.length]; out.push(numQuestion(p[0], p[1], Math.floor(r.f() * 1e9))); }
    const mcs = r.shuffle(mcIdx);
    for (let i = 0; out.length < n && i < mcs.length; i++) { if (!used.has(mcs[i])) { used.add(mcs[i]); out.push(mcQuestion(mcs[i], r)); } }
    return r.shuffle(out);
  }
  /* Prüfungssatz: je Thema eine Rechenaufgabe und eine Mehrfachwahl-Frage, der Rest weitere Mehrfachwahl aus zufälligen Themen (n = 20: 8 Rechnen, 12 Mehrfachwahl, 56 Punkte) */
  function exam(seed, n) {
    const r = seeded(seed), out = [], idx = {}, tl = r.shuffle(TOPICS.map(t => t.k));
    tl.forEach(k => { idx[k] = r.shuffle(MC.map((m, i) => (m[0] === k ? i : -1)).filter(i => i >= 0)); });
    tl.forEach(k => { out.push(numQuestion(k, r.int(0, GEN[k].length - 1), Math.floor(r.f() * 1e9))); out.push(mcQuestion(idx[k].shift(), r)); });
    for (let i = 0; out.length < n; i++) out.push(mcQuestion(idx[tl[i % tl.length]].shift(), r));
    return r.shuffle(out).slice(0, n);
  }

  root.PR_BANK = { TOPICS, MC, GEN, seeded, draw, exam, de, sig, nMC: MC.length, nGEN: Object.keys(GEN).reduce((s, k) => s + GEN[k].length, 0) };
})(window);
