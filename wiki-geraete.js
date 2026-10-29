/* wiki-geraete.js - Tonfunk Wiki, Kategorien Messgeraete (ger-) und Bedienelemente (bd-) (Hand, Paket W3).
 * Nur Geraete und Bedienelemente, die es im Code wirklich gibt: mess.js (Werkbank: Netzgeraet, Funktionsgenerator, Multimeter,
 * Oszilloskop, Frequenzzaehler, Leistungsmesser, Kennlinienschreiber), messplus.js (Genauigkeit, Frequenzgang, Logikanalysator),
 * oszi.js (Uebungs-Oszilloskop), simui.js (Messspitzen, Oszi), elsrig-isolation.js / elsrig-pruefplatz.js (Isolationsmessung).
 * Zahlenlisten (TDIV/VDIV, Bereiche, Genauigkeit) stammen aus dem Code -> Status 'ueb' mit quelle. Keine Fehlerfaelle, keine
 * Aufgaben, keine Wenn-dann-Diagnosen (Spec 4.1): beschrieben wird, was ein Geraet oder Regler tut. Zahlen deutsch ("0,7 V"). */
(function (arr) { if (typeof module !== 'undefined' && module.exports) module.exports = arr; else window.Wiki.add('geraete', arr); })([
  /* ===================== Multimeter ===================== */
  {
    id: 'ger-dmm', kat: 'geraet', titel: 'Multimeter',
    kurz: 'Das Multimeter misst Gleichspannung, Wechselspannung, Strom und Widerstand mit einem Gerät. Ein Drehschalter wählt die Messgröße, die Buchsen legen fest, ob Spannung, kleiner Strom oder großer Strom gemessen wird. Angezeigt wird ein Zahlenwert mit Einheit.',
    lang: 'Das Digitalmultimeter (DMM) ist das Grundgerät jeder Werkstatt. Es hat eine Anzeige, einen [[bd-dmm-bereich|Drehschalter]] für die Messgröße und mehrere [[bd-dmm-buchse|Buchsen]] für die Messleitungen (schwarz an COM, rot je nach Messung).\n\n**Was es misst**\n\n- Gleichspannung V⎓ und Wechselspannung V∿: parallel zum Bauteil, hochohmiger Eingang, der Stromkreis bleibt in Betrieb\n- Strom A: in Reihe, das Multimeter wird Teil des Stromkreises; der Strom fließt durch eine [[bd-dmm-sicherung|Sicherung]] im Gerät\n- Widerstand Ω: nur am spannungsfreien, ausgebauten Bauteil, das Gerät speist einen kleinen Messstrom ein\n\n**Lesen der Anzeige**\n\nDer Wert erscheint mit Vorsatz und Einheit (mV, V, mA, A, Ω, kΩ, MΩ). Jede Anzeige hat eine [[bd-dmm-genauigkeit|Genauigkeit]], die als Prozent vom Messwert plus Digits angegeben wird. Ein negatives Vorzeichen bei Gleichgrößen bedeutet: rote Messspitze liegt am niedrigeren Potenzial.\n\n**Im MessLab und SimLab**\n\nDie Werkbank zeigt das Multimeter als Karte mit Drehbereichen V⎓, V∿, A, Ω und den Buchsen VΩ, mA, 10 A. Mit [[bd-dmm-spitzen|Messspitzen setzen]] werden die beiden Messpunkte in der Schaltung angetippt; bei Strom wird das Bauteil angetippt, durch das der Strom fließt. Ein [[bt-r|Widerstand]] wird so zum Beispiel über seine beiden Anschlüsse gemessen, die Spannung einer [[bt-bat|Batterie]] an Plus und Minus.',
    werte: [['Drehbereiche (MessLab)', 'V⎓, V∿, A, Ω', 'ueb'], ['Buchsen rot (MessLab)', 'VΩ, mA, 10 A', 'ueb']],
    quelle: 'mess.js DIALS/JACKS',
    verweise: ['bd-dmm-bereich', 'bd-dmm-buchse', 'bd-dmm-sicherung', 'bd-dmm-genauigkeit', 'bd-dmm-spitzen', 'bt-r', 'bt-bat'],
    labs: ['mess', 'sim', 'els', 'ana', 'wsl', 'nts'],
    stich: ['Multimeter', 'DMM', 'Digitalmultimeter', 'Vielfachmessgerät', 'Voltmeter', 'Amperemeter', 'Ohmmeter', 'Messgerät', 'COM'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-dmm-bereich', kat: 'bedien', titel: 'Drehschalter (Messbereich)',
    kurz: 'Der Drehschalter des Multimeters wählt die Messgröße: V⎓ für Gleichspannung, V∿ für Wechselspannung, A für Strom und Ω für Widerstand. Die Stellung bestimmt, wie das Gerät seinen Eingang beschaltet und welche Einheit es anzeigt.',
    lang: 'Der Drehschalter ist das wichtigste Bedienelement am [[ger-dmm|Multimeter]]. Im MessLab gibt es vier Stellungen:\n\n- **V⎓**: Gleichspannung, Mittelwert der Spannung zwischen den Messspitzen, mit Vorzeichen\n- **V∿**: Wechselspannung als Effektivwert\n- **A**: Strom in Reihe; der Messwert hängt zusätzlich von der gewählten [[bd-dmm-buchse|Buchse]] (mA oder 10 A) ab\n- **Ω**: Widerstand, das Gerät speist selbst einen kleinen Strom ein und rechnet aus Spannung und Strom den Widerstand\n\nBei realen Geräten gibt es zusätzlich OFF, oft Hz, Durchgangsprüfer mit Summer, Diodentest und Temperatur. Viele Geräte wählen den Bereich (mV, V, kΩ, MΩ) selbst, das heißt **AUTO**; ältere Geräte haben je Messgröße mehrere Stellungen, und der Bereich wird von Hand so gewählt, dass die Anzeige möglichst viele Stellen nutzt.\n\nDie Stellung wird vor dem Anlegen der Messspitzen gewählt. Spannung wird parallel, Strom in Reihe gemessen; der Widerstand nur am spannungsfreien Bauteil, zum Beispiel an einem ausgebauten [[bt-r|Widerstand]] oder [[bt-ntc|Heißleiter]].',
    werte: [['Stellungen (MessLab)', 'V⎓, V∿, A, Ω', 'ueb']],
    quelle: 'mess.js DIALS',
    verweise: ['ger-dmm', 'bd-dmm-buchse', 'bt-r', 'bt-ntc'],
    labs: ['mess', 'sim'],
    stich: ['Drehschalter', 'Messbereich', 'Bereichswahl', 'AUTO', 'Auto-Range', 'V⎓', 'V∿', 'Durchgangsprüfer', 'Diodentest'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-dmm-buchse', kat: 'bedien', titel: 'Buchsen (COM, VΩ, mA, 10 A)',
    kurz: 'Die Buchsen des Multimeters legen den Messpfad fest. Die schwarze Leitung steckt immer in COM. Die rote Leitung steckt in VΩ für Spannung und Widerstand, in mA für kleine Ströme oder in 10 A für große Ströme.',
    lang: 'Ein [[ger-dmm|Multimeter]] hat meist drei oder vier Buchsen:\n\n- **COM**: gemeinsamer Anschluss (schwarze Messleitung), Bezugspunkt\n- **VΩ** (oft VΩmA oder VΩHz): rote Leitung für Spannung, Widerstand und Frequenz; hochohmiger Eingang\n- **mA**: rote Leitung für kleine Ströme; der Pfad läuft über eine flinke [[bd-dmm-sicherung|Sicherung]] mit kleinem Nennstrom\n- **10 A**: rote Leitung für große Ströme bis zum Nennwert der Buchse; eigener, niederohmiger Pfad mit eigener Sicherung\n\nIm MessLab wählt eine Tastenreihe „rote Buchse“ zwischen VΩ, mA und 10 A. Die Wahl muss zum [[bd-dmm-bereich|Drehschalter]] passen: Spannung an VΩ, Strom an mA oder 10 A. Steckt die rote Leitung in einer Strombuchse, ist der Eingang fast ein Kurzschluss (sehr kleiner Innenwiderstand), steckt sie in VΩ, ist er sehr hochohmig. Vor jeder Messung werden deshalb Drehschalter und Buchse gemeinsam geprüft.\n\nReale Geräte tragen neben den Buchsen die Messkategorie (CAT II, CAT III, CAT IV) mit der höchsten zulässigen Spannung. Sie beschreibt, wie viel Energie ein Stoßimpuls an dieser Stelle des Netzes haben kann: CAT II für Steckdosengeräte, CAT III für feste Installation und Verteiler, CAT IV am Hausanschluss.',
    werte: [['Buchsen rot (MessLab)', 'VΩ, mA, 10 A', 'ueb']],
    quelle: 'mess.js JACKS; CAT-Einteilung: Frage wiki__F11',
    verweise: ['ger-dmm', 'bd-dmm-sicherung', 'bd-dmm-bereich'],
    labs: ['mess', 'sim'],
    stich: ['Buchse', 'COM', 'VΩ', 'mA-Buchse', '10-A-Buchse', 'Messleitung', 'Messkategorie', 'CAT II', 'CAT III', 'CAT IV'],
    pruef: 3, status: 'frage', frage: 'wiki__F11'
  },
  {
    id: 'bd-dmm-sicherung', kat: 'bedien', titel: 'Sicherung im Multimeter',
    kurz: 'Im Strompfad des Multimeters sitzt eine Sicherung. Sie begrenzt den Strom durch die Buchsen mA und 10 A und ist so bemessen, dass sie vor dem Gerät auslöst. Eine ausgelöste Sicherung wird getauscht, danach misst das Gerät im Strombereich wieder.',
    lang: 'Die Strombereiche eines [[ger-dmm|Multimeters]] sind niederohmig. Der Strompfad der [[bd-dmm-buchse|Buchsen]] mA und 10 A hat nur einen sehr kleinen Innenwiderstand. Zum Schutz des Geräts sitzt in jedem Strompfad eine Sicherung: eine kleine flinke Sicherung für den mA-Pfad und eine größere für den 10-A-Pfad.\n\n**Im MessLab**\n\nDie Werkbank-Karte hat die Taste „Sicherung tauschen“. Sie ist nur aktiv, wenn eine der beiden Sicherungen (mA oder 10 A) ausgelöst hat. Nach dem Tausch sind beide Pfade wieder in Ordnung. Das Multimeter selbst nimmt dabei keinen Schaden; es ist eine Nachbildung des realen Geräts, bei dem die Sicherung im Gehäuse ausgetauscht wird.\n\n**Beim realen Gerät**\n\nDie Ersatzsicherung muss Nennstrom, Spannungsfestigkeit und Schaltvermögen der Originalsicherung haben (Angabe auf dem Typenschild oder im Handbuch). Eine [[bt-fuse|Schmelzsicherung]] mit zu kleinem Schaltvermögen kann bei einem Kurzschluss am Netz einen Lichtbogen bilden. Bei Stromstärkemessungen ist der Messbereich zuerst groß (10 A) zu wählen und erst bei kleinem Strom auf mA zu wechseln.',
    verweise: ['ger-dmm', 'bd-dmm-buchse', 'bt-fuse'],
    labs: ['mess'],
    stich: ['Sicherung', 'Multimeter-Sicherung', 'Sicherung tauschen', 'flink', 'Schaltvermögen', 'Strompfad'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-dmm-genauigkeit', kat: 'bedien', titel: 'Genauigkeit (Prozent plus Digit)',
    kurz: 'Die Genauigkeit eines Multimeters wird als Prozent vom Messwert plus eine Anzahl Digits angegeben. Ein Digit ist ein Schritt der letzten angezeigten Stelle. Der wahre Wert liegt innerhalb dieser Spanne um den angezeigten Wert.',
    lang: 'Jede Anzeige eines [[ger-dmm|Multimeters]] hat eine Unsicherheit. Hersteller geben sie je Messgröße an, zum Beispiel ± (0,5 % + 3 Digit). Das bedeutet:\n\n- 0,5 % des angezeigten Werts, plus\n- 3 Schritte der letzten angezeigten Stelle (bei drei Nachkommastellen in Volt also 3 · 0,001 V = 0,003 V)\n\nBeispiel: Anzeige 6,000 V, Genauigkeit ± (0,5 % + 3 Digit): 0,5 % von 6,000 V sind 0,030 V, dazu 0,003 V, zusammen ± 0,033 V. Der wahre Wert liegt zwischen 5,967 V und 6,033 V.\n\n**Im MessLab**\n\nUnter der Anzeige nennt die Werkbank die Genauigkeit der jeweiligen Stellung des [[bd-dmm-bereich|Drehschalters]] und rechnet die Spanne in der Anzeigeeinheit aus. Die Werte sind Übungswerte eines einfachen Handmultimeters:\n\n- Gleichspannung ± (0,5 % + 3 Digit)\n- Wechselspannung ± (1,0 % + 5 Digit)\n- Strom ± (1,0 % + 3 Digit)\n- Widerstand ± (0,8 % + 3 Digit)\n\nWechselgrößen sind ungenauer als Gleichgrößen und gelten nur in einem Frequenzbereich (oft 45 Hz bis 400 Hz, bei Sinusform). Die Digit-Angabe wiegt bei kleinen Anzeigewerten am meisten: Ein Messbereich wird deshalb so gewählt, dass möglichst viele Stellen genutzt werden.',
    formeln: [{ text: 'ΔU = p · U_anz / 100 % + n · Digit', sprich: 'Delta U gleich p Prozent von U Anzeige plus n Digit' }],
    werte: [['Gleichspannung', '± (0,5 % + 3 Digit)', 'ueb'], ['Wechselspannung', '± (1,0 % + 5 Digit)', 'ueb'], ['Strom', '± (1,0 % + 3 Digit)', 'ueb'], ['Widerstand', '± (0,8 % + 3 Digit)', 'ueb']],
    quelle: 'messplus.js ACC',
    verweise: ['ger-dmm', 'bd-dmm-bereich'],
    labs: ['mess'],
    stich: ['Genauigkeit', 'Messunsicherheit', 'Digit', 'Toleranz', 'Messabweichung', 'Prozent plus Digit', 'Messfehler'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-dmm-spitzen', kat: 'bedien', titel: 'Messspitzen setzen',
    kurz: 'Mit Messspitzen setzen werden die beiden Messpunkte des Multimeters in der Schaltung gewählt: erst der rote, dann der schwarze Punkt. Für Strom wird stattdessen das Bauteil angetippt, durch das der Strom fließt.',
    lang: 'Im MessLab und SimLab hat das [[ger-dmm|Multimeter]] keine echten Leitungen. Die Taste „Messspitzen setzen“ schaltet das Werkzeug Messen ein:\n\n- **Spannung und Widerstand**: zwei Punkte in der Schaltung antippen, erst rot, dann schwarz. Die Anzeige zeigt die Spannung des roten gegenüber dem schwarzen Punkt (mit Vorzeichen) beziehungsweise den Widerstand zwischen beiden.\n- **Strom**: ein Bauteil antippen. Das Multimeter wird gedanklich in Reihe in diesen Zweig gelegt und zeigt den Strom durch das Bauteil.\n\nDie Simulation muss dafür laufen („Sim“). Welche Größe angezeigt wird, bestimmt der [[bd-dmm-bereich|Drehschalter]], der Messpfad die [[bd-dmm-buchse|Buchse]].\n\nAm realen Gerät entspricht das dem Anlegen der Messspitzen: Für Spannung wird parallel gemessen, ohne den Stromkreis zu öffnen. Für Strom wird der Stromkreis an einer Stelle aufgetrennt und das Gerät eingeschleift. Der Widerstand wird am spannungsfreien, möglichst ausgelöteten Bauteil gemessen, damit keine Parallelpfade über die übrige Schaltung mitwirken.',
    verweise: ['ger-dmm', 'bd-dmm-bereich', 'bd-dmm-buchse'],
    labs: ['mess', 'sim'],
    stich: ['Messspitzen', 'Messpunkt', 'Prüfspitze', 'parallel messen', 'in Reihe messen', 'Messleitung rot', 'Messleitung schwarz'],
    pruef: 2, status: 'entwurf'
  },
  /* ===================== Oszilloskop ===================== */
  {
    id: 'ger-oszi', kat: 'geraet', titel: 'Oszilloskop',
    kurz: 'Das Oszilloskop zeichnet den Verlauf einer Spannung über der Zeit. Waagerecht läuft die Zeit, senkrecht steht die Spannung, das Raster aus Teilen macht beides ablesbar. So werden Kurvenform, Periodendauer, Spitzenwert und Phasenlage sichtbar.',
    lang: 'Ein Oszilloskop zeigt Spannungsverläufe als Kurve auf einem Schirm mit Raster: 10 Teile (Divisions) in der Breite, 8 Teile in der Höhe. Zwei Einstellungen legen den Maßstab fest: die [[bd-oszi-tdiv|Zeitbasis]] (Zeit je Teil) und die [[bd-oszi-vdiv|Ablenkung]] (Volt je Teil). Aus Kästchen mal Maßstab ergibt sich der Messwert.\n\n**Ablesen**\n\n- Periodendauer T = Kästchen waagerecht · Zeit je Teil; Frequenz f = 1 / T\n- Spitze-Spitze-Wert U_ss = Kästchen senkrecht · Volt je Teil; Spitzenwert û = U_ss / 2 bei symmetrischer Kurve\n- Bei Sinus: Effektivwert U = û / √2\n\n**Bedienelemente**\n\nJeder [[bd-oszi-kanal|Kanal]] hat Volt je Teil, [[bd-oszi-lage|Lage]], [[bd-oszi-kopplung|Kopplung AC/DC]] und einen [[bd-oszi-tastkopf|Tastkopf-Faktor]]. Gemeinsam gelten Zeitbasis, [[bd-oszi-trigger|Trigger]], [[bd-oszi-stop|Stop]] und [[bd-oszi-cursor|Cursor]].\n\n**In den Labs**\n\nIm MessLab hat die Werkbank ein Oszilloskop mit vier Kanälen; mit „Messpunkt setzen“ wird ein Bauteil oder Draht angetippt. Im SimLab zeigt ein Zwei-Kanal-Oszi die Spannungen der Schaltung. Im LochLab übt ein Trainer das Ablesen mit Zeitbasis 10 µs bis 50 ms und 50 mV bis 10 V je Teil. Typische Bilder: die Sinusspannung einer [[bt-ac|Wechselspannungsquelle]], die Halbwellen hinter einer [[bt-d|Diode]], die Ladekurve eines [[bt-c|Kondensators]].',
    formeln: [{ text: 'T = Kästchen · Zeit/Teil, f = 1 / T', sprich: 'T gleich Kästchen mal Zeit je Teil, f gleich eins durch T' }, { text: 'U_ss = Kästchen · Volt/Teil', sprich: 'U Spitze-Spitze gleich Kästchen mal Volt je Teil' }],
    werte: [['Raster', '10 × 8 Teile', 'ueb'], ['Kanäle MessLab', '4 (K1 bis K4)', 'ueb'], ['Trainer LochLab Zeitbasis', '10 µs bis 50 ms je Teil', 'ueb'], ['Trainer LochLab Ablenkung', '50 mV bis 10 V je Teil', 'ueb']],
    quelle: 'mess.js OSC/TDIV/VDIV; oszi.js TB/VB; simui.js tdiv/vdiv',
    verweise: ['bd-oszi-tdiv', 'bd-oszi-vdiv', 'bd-oszi-kanal', 'bd-oszi-lage', 'bd-oszi-kopplung', 'bd-oszi-tastkopf', 'bd-oszi-trigger', 'bd-oszi-stop', 'bd-oszi-cursor', 'bt-ac', 'bt-d', 'bt-c'],
    labs: ['mess', 'sim', 'loch', 'emv', 'nts', 'wsl', 'ana'],
    stich: ['Oszilloskop', 'Oszi', 'Scope', 'Schirm', 'Raster', 'Division', 'Div', 'Kurvenform', 'Periodendauer', 'Spitze-Spitze', 'Effektivwert'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-oszi-tdiv', kat: 'bedien', titel: 'Zeitbasis (Zeit je Teil)',
    kurz: 'Die Zeitbasis legt fest, wie viel Zeit ein Kästchen in der Breite bedeutet. Kleine Werte dehnen schnelle Vorgänge auseinander, große Werte zeigen viele Perioden. Zehn Kästchen ergeben die sichtbare Zeitspanne.',
    lang: 'Die Zeitbasis (TIME/DIV) des [[ger-oszi|Oszilloskops]] wird in Sekunden je Teil angegeben; die Werte folgen der Reihe 1–2–5. Im MessLab reicht sie von 10 µs bis 200 ms je Teil, die Tasten − und ＋ schalten eine Stufe weiter. Das Schirmfenster ist 10 Teile breit, bei 1 ms je Teil sind also 10 ms sichtbar.\n\n**Einstellen**\n\nFür eine gute Ablesung sollen zwei bis drei Perioden auf dem Schirm stehen. Bei 50 Hz ist eine Periode 20 ms lang; mit 5 ms je Teil passen genau zweieinhalb Perioden auf den Schirm. Bei 1 kHz (1 ms Periode) passt 200 µs je Teil.\n\n**Ablesen**\n\nPeriodendauer T = Anzahl Kästchen einer Periode · Zeit je Teil; daraus Frequenz f = 1 / T. Die gleiche Zeitbasis gilt für alle [[bd-oszi-kanal|Kanäle]] und auch für den Logikanalysator des MessLab, der dasselbe Zeitfenster nutzt.',
    werte: [['Bereich MessLab', '10 µs bis 200 ms je Teil', 'ueb'], ['Sichtbares Fenster', '10 Teile', 'ueb']],
    quelle: 'mess.js TDIV',
    verweise: ['ger-oszi', 'bd-oszi-kanal'],
    labs: ['mess', 'sim', 'loch'],
    stich: ['Zeitbasis', 'TIME/DIV', 'Zeit je Teil', 'ms/Teil', 'µs/Teil', 'Zeitablenkung', 'Zeitfenster'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-oszi-vdiv', kat: 'bedien', titel: 'Ablenkung (Volt je Teil)',
    kurz: 'Volt je Teil legt fest, wie viel Spannung ein Kästchen in der Höhe bedeutet. Kleine Werte vergrößern kleine Signale, große Werte bringen hohe Spannungen auf den Schirm. Die Einstellung gilt je Kanal.',
    lang: 'Die vertikale Ablenkung (VOLTS/DIV) des [[ger-oszi|Oszilloskops]] wird je [[bd-oszi-kanal|Kanal]] eingestellt, im MessLab von 10 mV bis 20 V je Teil in der Reihe 1–2–5. Der Schirm ist 8 Teile hoch, bei 2 V je Teil sind also ± 8 V um die Mittellinie darstellbar.\n\n**Einstellen**\n\nDie Kurve soll möglichst viel vom Schirm nutzen, ohne oben oder unten abgeschnitten zu werden. Für eine Sinusspannung mit 10 V Spitze passt 5 V je Teil (zwei Kästchen nach oben und unten).\n\n**Ablesen**\n\nSpannung = Kästchen senkrecht · Volt je Teil. Der [[bd-oszi-tastkopf|Tastkopf-Faktor]] wird dabei mitgerechnet: Bei ×10 bedeutet jedes Kästchen das Zehnfache. Die [[bd-oszi-lage|Lage]] verschiebt die Nulllinie, ändert aber nicht den Maßstab.',
    werte: [['Bereich MessLab', '10 mV bis 20 V je Teil', 'ueb'], ['Schirmhöhe', '8 Teile', 'ueb']],
    quelle: 'mess.js VDIV',
    verweise: ['ger-oszi', 'bd-oszi-kanal', 'bd-oszi-tastkopf', 'bd-oszi-lage'],
    labs: ['mess', 'sim', 'loch'],
    stich: ['Volt je Teil', 'VOLTS/DIV', 'V/Teil', 'Ablenkung', 'Vertikalablenkung', 'Empfindlichkeit', 'mV/Teil'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-oszi-kanal', kat: 'bedien', titel: 'Kanal und Messpunkt',
    kurz: 'Ein Kanal ist ein Eingang des Oszilloskops mit eigener Farbe, eigenem Volt-je-Teil-Wert und eigener Lage. Im MessLab wird ein Kanal belegt, indem nach Messpunkt setzen ein Bauteil oder Draht in der Schaltung angetippt wird.',
    lang: 'Das [[ger-oszi|Oszilloskop]] im MessLab hat vier Kanäle K1 bis K4, jeder in eigener Farbe. Die Tasten K1 bis K4 wählen, welcher Kanal mit den Tasten [[bd-oszi-vdiv|Volt je Teil]], [[bd-oszi-lage|Lage]], [[bd-oszi-kopplung|Kopplung]] und [[bd-oszi-tastkopf|Tastkopf]] eingestellt wird.\n\n**Messpunkt setzen**\n\nMit „Messpunkt setzen“ wird das Werkzeug Oszilloskop aktiv; ein Antippen auf ein Bauteil oder einen Draht belegt den nächsten freien Kanal mit dieser Spannung gegen Masse ([[bt-gnd|GND]]). „Messpunkte löschen“ gibt alle Kanäle frei. Der Frequenzzähler und der Logikanalysator des MessLab greifen auf dieselben Messpunkte zu.\n\n**Am realen Gerät**\n\nJeder Kanal hat eine BNC-Buchse, an der ein Tastkopf steckt. Die Massekrokodilklemme des Tastkopfs liegt auf dem Bezugspotenzial; alle Kanäle teilen sich diese Masse, deshalb darf die Klemme nie an einem anderen Potenzial als die Masse des übrigen Aufbaus liegen. Mit zwei Kanälen lassen sich Eingang und Ausgang einer Schaltung gleichzeitig zeigen, etwa die Spannung vor und hinter einem [[bt-r|Widerstand]].',
    werte: [['Kanäle MessLab', '4', 'ueb'], ['Kanäle SimLab', '2', 'ueb']],
    quelle: 'mess.js OSC.ch; simui.js vdiv',
    verweise: ['ger-oszi', 'bd-oszi-vdiv', 'bd-oszi-lage', 'bd-oszi-kopplung', 'bd-oszi-tastkopf', 'bt-gnd', 'bt-r'],
    labs: ['mess', 'sim'],
    stich: ['Kanal', 'Channel', 'K1', 'K2', 'Messpunkt setzen', 'BNC', 'Massekrokodil', 'Bezugspotenzial'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-oszi-lage', kat: 'bedien', titel: 'Lage (vertikale Verschiebung)',
    kurz: 'Die Lage verschiebt die Kurve eines Kanals nach oben oder unten, ohne den Maßstab zu ändern. So lassen sich die Nulllinie an eine Rasterlinie legen oder mehrere Kanäle übereinander anordnen.',
    lang: 'Mit den Tasten ▲ und ▼ (POSITION am realen Gerät) wird die Nulllinie des gewählten [[bd-oszi-kanal|Kanals]] auf dem Schirm des [[ger-oszi|Oszilloskops]] verschoben. Der Schritt beträgt ein Kästchen. Der Maßstab [[bd-oszi-vdiv|Volt je Teil]] bleibt gleich.\n\n**Wozu**\n\n- Nulllinie auf eine Rasterlinie legen, damit Spitzenwerte leicht abgezählt werden können\n- Bei mehreren Kanälen die Kurven übereinander statt ineinander zeigen\n- Bei einer Mischspannung (Gleichanteil plus Wechselanteil) den Wechselanteil in die Schirmmitte holen\n\nVor einer Gleichspannungsmessung wird die Nulllinie geprüft: Bei [[bd-oszi-kopplung|Kopplung]] GND oder ohne Signal zeigt der Kanal eine Gerade, deren Höhe die Lage der 0 V ist. Alle Werte werden von dieser Linie aus gezählt.',
    verweise: ['ger-oszi', 'bd-oszi-kanal', 'bd-oszi-vdiv', 'bd-oszi-kopplung'],
    labs: ['mess'],
    stich: ['Lage', 'Position', 'Nulllinie', 'Offset', 'Verschiebung', 'Y-Position'],
    pruef: 1, status: 'entwurf'
  },
  {
    id: 'bd-oszi-kopplung', kat: 'bedien', titel: 'Kopplung AC/DC',
    kurz: 'Die Kopplung bestimmt, ob der Gleichanteil eines Signals mit angezeigt wird. DC zeigt das Signal vollständig, AC blendet den Gleichanteil aus und zeigt nur den Wechselanteil um die Nulllinie.',
    lang: 'Jeder [[bd-oszi-kanal|Kanal]] des [[ger-oszi|Oszilloskops]] hat eine Eingangskopplung:\n\n- **DC**: Das Signal gelangt unverändert in den Kanal. Eine Gleichspannung erscheint als Gerade oberhalb oder unterhalb der Nulllinie, eine Mischspannung mit ihrem Gleichanteil.\n- **AC**: Ein [[bt-c|Kondensator]] im Eingang sperrt den Gleichanteil. Der Wechselanteil erscheint um die Nulllinie, auch wenn er auf einer großen Gleichspannung sitzt, etwa die Brummspannung am Ausgang eines Netzteils.\n- **GND** (reale Geräte): Der Eingang wird auf Masse gelegt, die Kurve zeigt die Lage der 0 V.\n\nIm MessLab schaltet die Taste „AC-Kopplung/DC-Kopplung“ je Kanal um. Bei AC-Kopplung gehen sehr langsame Vorgänge und Gleichanteile verloren, deshalb ist DC die Grundeinstellung; AC wird gezielt für kleine Wechselanteile auf großen Gleichspannungen gewählt. Die Kopplung betrifft die Kurve auf dem Bildschirm; die Zahlen unter dem Bild (Uss, Ueff, Umittel) werden im MessLab aus dem vollständigen Signal berechnet.',
    verweise: ['ger-oszi', 'bd-oszi-kanal', 'bt-c'],
    labs: ['mess'],
    stich: ['Kopplung', 'AC-Kopplung', 'DC-Kopplung', 'GND', 'Gleichanteil', 'Wechselanteil', 'Mischspannung', 'Brummspannung'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-oszi-tastkopf', kat: 'bedien', titel: 'Tastkopf 1:1 und 10:1',
    kurz: 'Der Tastkopf verbindet die Schaltung mit dem Oszilloskop. In Stellung 10:1 teilt er die Spannung durch zehn, belastet die Schaltung weniger und erlaubt höhere Spannungen. Das Oszilloskop muss den Faktor kennen, sonst stimmt die Anzeige um den Faktor zehn nicht.',
    lang: 'Ein Tastkopf ist eine abgeschirmte Messleitung mit Spitze und Massekrokodil für einen [[bd-oszi-kanal|Kanal]] des [[ger-oszi|Oszilloskops]]. Viele Tastköpfe haben einen Schalter ×1 / ×10:\n\n- **×1 (1:1)**: Die Spannung gelangt unverändert zum Gerät. Eingangswiderstand des Oszilloskops typisch 1 MΩ.\n- **×10 (10:1)**: Ein Teiler im Tastkopf gibt nur ein Zehntel weiter. Die Schaltung sieht dann etwa 10 MΩ (9 MΩ im Tastkopf in Reihe mit 1 MΩ im Gerät), die kapazitive Last sinkt, der Messbereich wird zehnmal größer. Schnelle Signale werden weniger verfälscht.\n\n**Zwei Schalter im MessLab**\n\nDie Werkbank hat je Kanal die Taste „Tastkopf-Schalter ×1/×10“ (am Tastkopf) und die Taste „Kanal-Faktor ×1/×10“ (am Gerät). Nur wenn beide gleich stehen, zeigt das Oszilloskop die richtige Spannung an; der Kanal-Faktor sagt dem Gerät, mit welchem Wert es den gelesenen Wert multiplizieren muss. Reale Geräte erkennen den Faktor oft über einen Stift am BNC-Stecker.\n\n**Abgleich**\n\nEin 10:1-Tastkopf hat einen kleinen Trimmkondensator, der am Rechtecksignal des Geräts so eingestellt wird, dass die Flanken ohne Über- oder Unterschwingen erscheinen (Kompensation).',
    werte: [['Eingangswiderstand ×1', '1 MΩ', 'ueb'], ['Eingangswiderstand ×10', '10 MΩ', 'ueb']],
    quelle: 'mess.js px/ps; Eingangswiderstände: Frage wiki__F12',
    verweise: ['ger-oszi', 'bd-oszi-kanal'],
    labs: ['mess', 'emv'],
    stich: ['Tastkopf', 'Probe', '10:1', '1:1', '×10', 'Teilertastkopf', 'Kanal-Faktor', 'Kompensation', 'Eingangswiderstand'],
    pruef: 2, status: 'frage', frage: 'wiki__F12'
  },
  {
    id: 'bd-oszi-trigger', kat: 'bedien', titel: 'Trigger und Pegel',
    kurz: 'Der Trigger sorgt für ein stehendes Bild. Er startet die Aufzeichnung immer dann, wenn das Signal des Triggerkanals den eingestellten Pegel überschreitet. Ohne Trigger beginnt jedes Bild an einer zufälligen Stelle und die Kurve läuft durch.',
    lang: 'Das [[ger-oszi|Oszilloskop]] zeichnet das Zeitfenster immer wieder neu. Damit sich die Perioden deckungsgleich übereinanderlegen, muss jedes Bild an derselben Stelle des Signals beginnen. Das leistet der Trigger: Er wartet, bis die Spannung des Triggerkanals den Pegel in der eingestellten Richtung (meist steigende Flanke) durchläuft, und startet dann die Darstellung.\n\n**Bedienelemente im MessLab**\n\n- „Trigger an/aus“ schaltet die Funktion\n- „Pegel −“ und „Pegel ＋“ verschieben den Triggerpegel in Schritten von einem halben Kästchen des [[bd-oszi-vdiv|Volt-je-Teil]]-Werts; die Marke am rechten Schirmrand zeigt die Höhe\n- Der Triggerkanal ist einer der belegten [[bd-oszi-kanal|Kanäle]]\n\n**Einstellen**\n\nDer Pegel muss innerhalb des Signals liegen, sonst findet das Gerät keine Flanke. Für einen Sinus ist der Pegel nahe 0 V eine gute Wahl. Reale Geräte bieten zusätzlich Flanke steigend/fallend, Triggerquelle (Kanal, Netz, extern) und die Betriebsarten Auto (zeichnet auch ohne Triggerereignis) und Normal (wartet auf das Ereignis).',
    verweise: ['ger-oszi', 'bd-oszi-vdiv', 'bd-oszi-kanal'],
    labs: ['mess', 'loch'],
    stich: ['Trigger', 'Triggerpegel', 'Level', 'Flanke', 'stehendes Bild', 'Auto', 'Normal', 'Triggerquelle'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-oszi-stop', kat: 'bedien', titel: 'Stop und Weiter (Run/Stop)',
    kurz: 'Stop friert das Bild des Oszilloskops ein. Die Kurve bleibt stehen und kann in Ruhe abgelesen oder mit dem Cursor vermessen werden. Weiter setzt die laufende Aufzeichnung fort.',
    lang: 'Die Taste „⏸ Stop“ beziehungsweise „▶ Weiter“ (RUN/STOP am realen Gerät) hält die Darstellung des [[ger-oszi|Oszilloskops]] an. Im eingefrorenen Zustand:\n\n- bleibt das zuletzt gezeichnete Bild stehen, auch wenn die Simulation weiterläuft\n- lassen sich Perioden und Amplituden in Ruhe abzählen\n- kann der [[bd-oszi-cursor|Cursor]] gesetzt werden, ohne dass sich die Kurve darunter bewegt\n\nAm Schirmrand steht dann „STOP“ neben der [[bd-oszi-tdiv|Zeitbasis]]. Maßstab und [[bd-oszi-lage|Lage]] lassen sich während des Stops weiter ändern; das Bild wird dann mit dem gespeicherten Verlauf neu gezeichnet. Reale Digitaloszilloskope speichern beim Stop den Signalverlauf und erlauben, darin zu zoomen oder ihn als Bild zu sichern. Für einmalige Vorgänge (Einschalten, Entladen) gibt es dort zusätzlich die Taste SINGLE: ein Triggerereignis, dann automatisch Stop.',
    verweise: ['ger-oszi', 'bd-oszi-cursor', 'bd-oszi-tdiv', 'bd-oszi-lage'],
    labs: ['mess'],
    stich: ['Stop', 'Run/Stop', 'Weiter', 'einfrieren', 'Freeze', 'Single', 'Hold'],
    pruef: 1, status: 'entwurf'
  },
  {
    id: 'bd-oszi-cursor', kat: 'bedien', titel: 'Cursor',
    kurz: 'Cursor sind zwei verschiebbare Linien auf dem Schirm. Das Oszilloskop zeigt den Zeitabstand zwischen beiden Linien an, so lassen sich Periodendauer, Impulsbreite oder Verzögerung direkt ablesen, ohne Kästchen zu zählen.',
    lang: 'Im MessLab setzt ein Tippen auf den Schirm des [[ger-oszi|Oszilloskops]] den ersten Cursor, ein zweites Tippen den zweiten; die Taste „Cursor“ löscht beide. Das Messwertfeld nennt den Zeitabstand Δt zwischen den Linien und die daraus folgende Frequenz 1 / Δt.\n\n**Anwendung**\n\n- Periodendauer: beide Cursor auf gleiche Punkte zweier aufeinanderfolgender Perioden\n- Impulsbreite: Cursor auf steigende und fallende Flanke\n- Phasenverschiebung: Zeitabstand zwischen den Nulldurchgängen zweier [[bd-oszi-kanal|Kanäle]], umgerechnet φ = Δt / T · 360°\n\nReale Geräte haben zusätzlich Spannungscursor (waagerechte Linien, ΔU) und automatische Messungen (Frequenz, Effektivwert, Spitze-Spitze), die das MessLab in der Messwertzeile unter dem Schirm zeigt. Cursor-Messungen sind am stehenden Bild ([[bd-oszi-stop|Stop]]) am genauesten.',
    formeln: [{ text: 'φ = Δt / T · 360°', sprich: 'Phi gleich Delta t durch T mal 360 Grad' }],
    verweise: ['ger-oszi', 'bd-oszi-kanal', 'bd-oszi-stop'],
    labs: ['mess'],
    stich: ['Cursor', 'Δt', 'Zeitcursor', 'Spannungscursor', 'Phasenverschiebung', 'Impulsbreite', 'Messwertzeile'],
    pruef: 2, status: 'entwurf'
  },
  /* ===================== Netzgeraet ===================== */
  {
    id: 'ger-netzteil', kat: 'geraet', titel: 'Labornetzgerät',
    kurz: 'Das Labornetzgerät liefert eine einstellbare Gleichspannung und begrenzt auf Wunsch den Strom. Zwei Anzeigen zeigen Spannung und Strom am Ausgang. Solange die Spannung gehalten wird, leuchtet CV; greift die Strombegrenzung, leuchtet CC und die Spannung sinkt.',
    lang: 'Ein Labornetzgerät (Netzteil) ist eine geregelte Gleichspannungsquelle mit zwei Einstellern: [[bd-netz-spannung|Spannung]] und [[bd-netz-strombegrenzung|Strombegrenzung]]. Im MessLab steuert die Werkbank-Karte „Netzgerät“ die [[bt-bat|Gleichspannungsquelle]] der Schaltung; die Anzeigen zeigen die tatsächliche Spannung und den fließenden Strom.\n\n**Zwei Betriebsarten**\n\n- **CV** (Constant Voltage, Konstantspannung): Die eingestellte Spannung liegt am Ausgang, der Strom ergibt sich aus der Last.\n- **CC** (Constant Current, Konstantstrom): Die Last würde mehr Strom ziehen als eingestellt. Das Gerät senkt die Spannung so weit, dass genau der Grenzstrom fließt. Die Anzeige CC leuchtet, der Hinweis lautet „Strombegrenzung greift: Spannung bricht ein“.\n\nDer Übergang ist selbsttätig: Steigt der Laststrom über die Grenze, wechselt das Gerät von CV nach CC und zurück, sobald die Last wieder weniger zieht.\n\n**Arbeitsweise**\n\nVor dem Anschließen einer Schaltung werden Spannung und Strombegrenzung eingestellt; beim ersten Einschalten einer neuen Schaltung ist eine kleine Strombegrenzung üblich, damit ein Verdrahtungsfehler keine Bauteile zerstört. Die Werkbank weist darauf hin, wenn keine Begrenzung aktiv ist. Reale Geräte haben Ausgangsbuchsen +, − und Erde ⏚, oft eine Taste OUTPUT ON/OFF und grob/fein-Drehknöpfe; der Minuspol ist in der Regel nicht geerdet, sodass mehrere Geräte in Reihe geschaltet werden können.',
    werte: [['Spannung einstellbar', '0 V bis 30 V in 0,1 V', 'ueb'], ['Strombegrenzung einstellbar', '10 mA bis 2 A in 10 mA', 'ueb']],
    quelle: 'mess.js PSU (range min/max/step)',
    verweise: ['bd-netz-spannung', 'bd-netz-strombegrenzung', 'bt-bat', 'bt-u'],
    labs: ['mess', 'nts', 'ana'],
    stich: ['Netzgerät', 'Labornetzteil', 'Netzteil', 'Spannungsquelle', 'CV', 'CC', 'Konstantspannung', 'Konstantstrom', 'Ausgangsbuchsen'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-netz-spannung', kat: 'bedien', titel: 'Spannung einstellen (Netzgerät)',
    kurz: 'Der Spannungssteller legt die Leerlauf- und Sollspannung des Netzgeräts fest. Solange der Laststrom unter der Strombegrenzung bleibt, liegt genau dieser Wert am Ausgang. Im MessLab reicht der Schieber von 0 bis 30 Volt.',
    lang: 'Der Schieber „Spannung einstellen“ des [[ger-netzteil|Labornetzgeräts]] setzt die Ausgangsspannung in Schritten von 0,1 V zwischen 0 V und 30 V. Die Anzeige „Spannung“ darüber zeigt den Istwert am Ausgang: Er stimmt mit der Einstellung überein, solange CV leuchtet; greift die [[bd-netz-strombegrenzung|Strombegrenzung]], liegt der Istwert darunter.\n\n**Einstellen**\n\nDie Spannung wird vor dem Verbinden mit der Schaltung eingestellt und am Voltmeter des Geräts oder mit dem [[ger-dmm|Multimeter]] geprüft. Für Logikschaltungen sind 5 V üblich, für Operationsverstärker ± 12 V oder ± 15 V, für Kfz-Technik 12 V. Reale Geräte haben einen groben und einen feinen Drehknopf oder eine Zifferneingabe; die Einstellung geschieht meist bei offenem Ausgang (OUTPUT OFF).\n\nIm MessLab wirkt der Schieber auf die [[bt-bat|Gleichspannungsquelle]] der Zeichnung; der Wert erscheint auch im Bauteilsymbol.',
    werte: [['Bereich', '0 V bis 30 V', 'ueb'], ['Schritt', '0,1 V', 'ueb']],
    quelle: 'mess.js PSU data-us',
    verweise: ['ger-netzteil', 'bd-netz-strombegrenzung', 'ger-dmm', 'bt-bat'],
    labs: ['mess'],
    stich: ['Spannung einstellen', 'Ausgangsspannung', 'Sollspannung', 'Voltage', 'grob/fein'],
    pruef: 1, status: 'entwurf'
  },
  {
    id: 'bd-netz-strombegrenzung', kat: 'bedien', titel: 'Strombegrenzung (CC)',
    kurz: 'Die Strombegrenzung legt den größten Strom fest, den das Netzgerät abgibt. Will die Last mehr, senkt das Gerät die Spannung, bis genau dieser Strom fließt. Die Leuchte CC zeigt, dass die Begrenzung arbeitet.',
    lang: 'Die Strombegrenzung des [[ger-netzteil|Labornetzgeräts]] ist ein Schutz für Schaltung und Gerät. Im MessLab wird sie mit dem Kontrollkästchen „Strombegrenzung“ eingeschaltet und mit dem Schieber von 10 mA bis 2 A in Schritten von 10 mA eingestellt; die Anzeige daneben zeigt den Grenzwert oder „aus“.\n\n**Wirkung**\n\n- Laststrom unter dem Grenzwert: Konstantspannung, CV leuchtet grün, die [[bd-netz-spannung|eingestellte Spannung]] liegt an.\n- Laststrom würde den Grenzwert überschreiten: Konstantstrom, CC leuchtet rot, die Spannung bricht so weit ein, dass genau der Grenzstrom fließt. Bei einem sehr kleinen Lastwiderstand geht die Spannung bis fast 0 V zurück.\n\n**Einstellen am realen Gerät**\n\nAusgang kurzschließen (oder Taste zum Anzeigen des Grenzwerts nutzen), Stromknopf auf den gewünschten Wert drehen, Kurzschluss entfernen. Ein sinnvoller Wert liegt etwas über dem erwarteten Betriebsstrom der Schaltung. Ohne Begrenzung gibt das Gerät bis zu seinem Nennstrom ab; die Schaltung muss den Strom dann selbst begrenzen, zum Beispiel mit einem [[bt-r|Vorwiderstand]] vor einer [[bt-led|Leuchtdiode]]. Die Strombegrenzung wird auch gezielt als Konstantstromquelle genutzt, etwa zum Laden von Akkus oder zum Prüfen eines [[bt-ptc|Kaltleiters]].',
    werte: [['Bereich', '10 mA bis 2 A', 'ueb'], ['Schritt', '10 mA', 'ueb']],
    quelle: 'mess.js PSU data-is/data-lim',
    verweise: ['ger-netzteil', 'bd-netz-spannung', 'bt-led', 'bt-r', 'bt-ptc'],
    labs: ['mess'],
    stich: ['Strombegrenzung', 'CC', 'Constant Current', 'Konstantstrom', 'Grenzstrom', 'Current Limit', 'Überstromschutz'],
    pruef: 2, status: 'entwurf'
  },
  /* ===================== Funktionsgenerator ===================== */
  {
    id: 'ger-fgen', kat: 'geraet', titel: 'Funktionsgenerator',
    kurz: 'Der Funktionsgenerator erzeugt eine Wechselspannung mit wählbarer Kurvenform, Frequenz und Amplitude. Sinus, Rechteck und Dreieck sind die Grundformen. Mit ihm wird eine Schaltung mit einem bekannten Signal gespeist, dessen Antwort am Oszilloskop sichtbar wird.',
    lang: 'Der Funktionsgenerator ist die Signalquelle der Werkbank. Im MessLab steuert die Karte „Funktionsgenerator“ die [[bt-ac|Wechselspannungsquelle]] der Schaltung. Drei Einsteller bestimmen das Signal: [[bd-fgen-kurvenform|Kurvenform]], [[bd-fgen-frequenz|Frequenz]] und [[bd-fgen-amplitude|Amplitude]].\n\n**Kurvenformen**\n\n- Sinus ∿: eine Frequenz ohne Oberwellen, Standard für Frequenzgänge und Wechselstromrechnung\n- Rechteck ⊓: Logiksignale, Taktgeber, Sprungantwort von RC-Gliedern\n- Dreieck △: lineare Rampen, Kennlinien, Prüfen von Verstärkern\n\n**Anwendung**\n\nDer Generator wird an den Eingang einer Schaltung gelegt, zwei Kanäle des [[ger-oszi|Oszilloskops]] zeigen Eingang und Ausgang. So lassen sich Verstärkung, Phasenverschiebung und Grenzfrequenz bestimmen, zum Beispiel an einem Tiefpass aus [[bt-r|Widerstand]] und [[bt-c|Kondensator]]. Der Frequenzgang-Messplatz des MessLab automatisiert das über einen Frequenzbereich.\n\nReale Geräte haben einen BNC-Ausgang mit 50 Ω Innenwiderstand, einen Gleichspannungsversatz (Offset), Tastverhältnis beim Rechteck und oft einen zweiten Kanal. Die Amplitude wird dort meist als Spitze-Spitze-Wert angegeben.',
    werte: [['Kurvenformen', 'Sinus, Rechteck, Dreieck', 'ueb'], ['Ausgangswiderstand (reale Geräte)', '50 Ω', 'ueb']],
    quelle: 'mess.js GEN data-waves; 50 Ω: SPEC-MESSGERAETE-FABLE.md 4.4',
    verweise: ['bd-fgen-kurvenform', 'bd-fgen-frequenz', 'bd-fgen-amplitude', 'bt-ac', 'ger-oszi', 'bt-r', 'bt-c'],
    labs: ['mess', 'wsl', 'ana'],
    stich: ['Funktionsgenerator', 'Generator', 'Signalgenerator', 'Frequenzgenerator', 'Sinus', 'Rechteck', 'Dreieck', 'Offset', 'Tastverhältnis'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-fgen-kurvenform', kat: 'bedien', titel: 'Kurvenform (Sinus, Rechteck, Dreieck)',
    kurz: 'Die Taste Kurvenform wählt, welche Signalform der Funktionsgenerator abgibt. Sinus hat nur eine Frequenz, Rechteck springt zwischen zwei Werten, Dreieck steigt und fällt linear. Frequenz und Amplitude bleiben beim Umschalten erhalten.',
    lang: 'Am [[ger-fgen|Funktionsgenerator]] des MessLab stehen drei Tasten: ∿ Sinus, ⊓ Rechteck, △ Dreieck. Die gewählte Form ist hervorgehoben; die [[bt-ac|Wechselspannungsquelle]] in der Zeichnung übernimmt sie.\n\n**Eigenschaften**\n\n- **Sinus**: Effektivwert û / √2; Standardform des Netzes und der Wechselstromrechnung mit Blindwiderständen\n- **Rechteck**: Effektivwert gleich Spitzenwert (bei symmetrischem Signal); enthält viele ungerade Oberwellen, zeigt an einem RC-Glied die Lade- und Entladekurve\n- **Dreieck**: Effektivwert û / √3; linearer Anstieg, nützlich für Kennlinien und zum Prüfen der Linearität von Verstärkern\n\nAm [[ger-oszi|Oszilloskop]] unterscheiden sich die Formen auf den ersten Blick. Eine Schaltung mit [[bt-c|Kondensator]] oder [[bt-l|Spule]] verformt Rechteck und Dreieck, weil sie die Oberwellen unterschiedlich stark durchlässt; ein Sinus bleibt ein Sinus und ändert nur Amplitude und Phase.',
    formeln: [{ text: 'U_eff = û / √2 (Sinus), û (Rechteck), û / √3 (Dreieck)', sprich: 'U effektiv gleich u Dach durch Wurzel 2 bei Sinus, u Dach bei Rechteck, u Dach durch Wurzel 3 bei Dreieck' }],
    verweise: ['ger-fgen', 'bt-ac', 'ger-oszi', 'bt-c', 'bt-l'],
    labs: ['mess'],
    stich: ['Kurvenform', 'Signalform', 'Sinus', 'Rechteck', 'Dreieck', 'Oberwellen', 'Formfaktor', 'Waveform'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-fgen-frequenz', kat: 'bedien', titel: 'Frequenz (Funktionsgenerator)',
    kurz: 'Das Feld Frequenz legt fest, wie viele Perioden das Signal je Sekunde hat. Die Tasten ÷10, ÷2, ×2 und ×10 verändern die Frequenz in Sprüngen, so wird ein Frequenzbereich schnell durchlaufen. Die Periodendauer ist der Kehrwert.',
    lang: 'Die Frequenz des [[ger-fgen|Funktionsgenerators]] wird im MessLab als Zahl eingegeben (Hz, kHz, zum Beispiel „1k“) oder mit den Tasten ÷10, ÷2, ×2, ×10 stufenweise verändert. Die Periodendauer ergibt sich als T = 1 / f: 50 Hz entsprechen 20 ms, 1 kHz entsprechen 1 ms.\n\n**Einstellen**\n\nZur Frequenz passt die [[bd-oszi-tdiv|Zeitbasis]] des Oszilloskops: Zwei bis drei Perioden auf dem Schirm sind gut ablesbar. Der [[ger-fzaehler|Frequenzzähler]] zeigt die tatsächliche Frequenz des Messpunkts.\n\n**Frequenz und Bauteile**\n\nMit steigender Frequenz sinkt der Blindwiderstand eines [[bt-c|Kondensators]] und steigt der einer [[bt-l|Spule]]. Ein Tiefpass lässt tiefe Frequenzen durch und dämpft hohe; die Grenzfrequenz ist der Punkt, an dem die Ausgangsspannung auf das 0,707-fache (−3 dB) gesunken ist. Die Sprungtasten erleichtern es, diesen Punkt einzukreisen. Reale Generatoren reichen von Bruchteilen eines Hertz bis in den Megahertzbereich.',
    formeln: [{ text: 'T = 1 / f', sprich: 'T gleich eins durch f' }],
    verweise: ['ger-fgen', 'bd-oszi-tdiv', 'ger-fzaehler', 'bt-c', 'bt-l'],
    labs: ['mess'],
    stich: ['Frequenz', 'Hertz', 'Periodendauer', '×10', '÷10', 'Dekade', 'Grenzfrequenz', 'kHz'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-fgen-amplitude', kat: 'bedien', titel: 'Amplitude (Funktionsgenerator)',
    kurz: 'Die Amplitude gibt den Spitzenwert der erzeugten Wechselspannung in Volt an. Im MessLab wird der Spitzenwert eingegeben, viele reale Geräte zeigen stattdessen den Spitze-Spitze-Wert, der doppelt so groß ist.',
    lang: 'Das Feld „Amplitude (Spitze, V)“ am [[ger-fgen|Funktionsgenerator]] setzt den Scheitelwert û des Signals. Daraus folgen:\n\n- Spitze-Spitze-Wert U_ss = 2 · û\n- Effektivwert bei Sinus U = û / √2 (bei 10 V Spitze also etwa 7,07 V)\n\nDie Werkbank nennt neben der Einstellung den Spitze-Spitze-Wert, weil reale Generatoren und das [[ger-oszi|Oszilloskop]] oft damit arbeiten. Das [[ger-dmm|Multimeter]] in Stellung V∿ zeigt dagegen den Effektivwert. Diese drei Angaben werden leicht verwechselt; beim Vergleichen von Messwerten ist immer zu klären, welche gemeint ist.\n\n**Einstellen**\n\nDie Amplitude richtet sich nach der Schaltung: wenige hundert Millivolt für Verstärkereingänge, einige Volt für RC-Glieder und Gleichrichter. Am Oszilloskop passt dazu der Wert [[bd-oszi-vdiv|Volt je Teil]]. Reale Generatoren geben die Amplitude bei 50 Ω Last an; bei hochohmiger Last ist die Spannung am Ausgang doppelt so groß wie bei angepasster Last.',
    formeln: [{ text: 'U_ss = 2 · û', sprich: 'U Spitze-Spitze gleich zwei mal u Dach' }, { text: 'U_eff = û / √2 (Sinus)', sprich: 'U effektiv gleich u Dach durch Wurzel 2' }],
    werte: [['Beispiel: 10 V Spitze', '20 V Spitze-Spitze, 7,07 V effektiv', 'ueb']],
    quelle: 'mess.js GEN data-a; Umrechnung Sinus',
    verweise: ['ger-fgen', 'ger-oszi', 'ger-dmm', 'bd-oszi-vdiv'],
    labs: ['mess'],
    stich: ['Amplitude', 'Spitzenwert', 'Scheitelwert', 'Spitze-Spitze', 'Vss', 'Effektivwert', 'û'],
    pruef: 3, status: 'entwurf'
  },
  /* ===================== Zaehler, Leistungsmesser, Kennlinienschreiber, Frequenzgang, Logikanalysator ===================== */
  {
    id: 'ger-fzaehler', kat: 'geraet', titel: 'Frequenzzähler',
    kurz: 'Der Frequenzzähler zählt die Perioden eines Signals je Sekunde und zeigt die Frequenz in Hertz. Dazu nennt er die Periodendauer. Im MessLab misst er an einem der Messpunkte, die am Oszilloskop gesetzt wurden.',
    lang: 'Ein Frequenzzähler bestimmt die Frequenz eines periodischen Signals genauer als das Ablesen am [[ger-oszi|Oszilloskop]]. Er zählt, wie oft das Signal in einer festen Torzeit eine Schwelle in gleicher Richtung durchläuft, und rechnet daraus f in Hz; die Periodendauer ist T = 1 / f.\n\n**Im MessLab**\n\nDie Karte „Frequenzzähler“ hat Tasten K1 bis K4 für die [[bd-oszi-kanal|Messpunkte]] des Oszilloskops. Die große Anzeige zeigt die Frequenz, die Zeile darunter die Periodendauer. Ohne gesetzten Messpunkt bleibt die Anzeige leer.\n\n**Anwendung**\n\n- Frequenz des [[ger-fgen|Funktionsgenerators]] oder eines Oszillators prüfen\n- Netzfrequenz 50 Hz hinter einem Transformator; hinter einem Brückengleichrichter aus [[bt-d|Dioden]] erscheint die doppelte Frequenz 100 Hz\n- Taktfrequenz eines Timers oder einer Quarzschaltung\n\nReale Zähler messen bis in den Gigahertzbereich und geben die Auflösung über die Torzeit vor (1 s Torzeit: 1 Hz Auflösung). Viele [[ger-dmm|Multimeter]] haben eine einfache Frequenzfunktion (Hz) für niedrige Frequenzen.',
    formeln: [{ text: 'T = 1 / f', sprich: 'T gleich eins durch f' }],
    werte: [['Netzfrequenz', '50 Hz', 'belegt'], ['Hinter Brückengleichrichter', '100 Hz', 'belegt']],
    quelle: 'mess.js CNT; FACHREVIEW-GRUNDLAGEN (Brücke 100 Hz)',
    verweise: ['ger-oszi', 'bd-oszi-kanal', 'ger-fgen', 'bt-d', 'ger-dmm'],
    labs: ['mess'],
    stich: ['Frequenzzähler', 'Zähler', 'Frequenzmesser', 'Hertz', 'Periodendauer', 'Torzeit', 'Counter'],
    pruef: 1, status: 'entwurf'
  },
  {
    id: 'ger-leistung', kat: 'geraet', titel: 'Leistungsmesser',
    kurz: 'Der Leistungsmesser zeigt die elektrische Leistung eines Bauteils: Spannung mal Strom. Er nennt beide Größen einzeln, die Leistung in Watt und die aufgelaufene Energie in Wattsekunden. Im MessLab wird das Bauteil aus einer Liste gewählt.',
    lang: 'Ein Leistungsmesser (Wattmeter) misst gleichzeitig die Spannung am Bauteil und den Strom durch das Bauteil und bildet das Produkt P = U · I. Bei Wechselgrößen wird der Mittelwert des Produkts gebildet, das ist die Wirkleistung; der Phasenwinkel zwischen Spannung und Strom geht dabei als Leistungsfaktor cos φ ein.\n\n**Im MessLab**\n\nDie Karte „Leistungsmesser“ hat eine Auswahlliste für das Bauteil, eine große Anzeige für die Leistung, zwei kleine für Spannung und Strom sowie die Zeile mit der [[bd-leistung-energie|Energie]], die seit dem letzten Rücksetzen aufgelaufen ist.\n\n**Anwendung**\n\n- Verlustleistung eines [[bt-r|Widerstands]] mit seiner Nennleistung (zum Beispiel 0,25 W) vergleichen\n- Leistung an einer [[bt-led|Leuchtdiode]] oder [[bt-lamp|Lampe]]\n- Wirkleistung an einer Spule oder einem Kondensator: Bei reiner Blindlast ist der Mittelwert null, obwohl Spannung anliegt und Strom fließt\n\nIm Haushalt übernimmt ein Energiezähler dieselbe Rechnung über lange Zeit und zeigt Kilowattstunden. Reale Leistungsmesser haben getrennte Strom- und Spannungspfade; der Strompfad liegt wie beim [[ger-dmm|Multimeter]] in Reihe, der Spannungspfad parallel.',
    formeln: [{ text: 'P = U · I', sprich: 'P gleich U mal I' }, { text: 'P = U · I · cos φ (Wechselstrom)', sprich: 'P gleich U mal I mal Kosinus Phi' }],
    verweise: ['bd-leistung-energie', 'bt-r', 'bt-led', 'bt-lamp', 'ger-dmm'],
    labs: ['mess', 'wsl'],
    stich: ['Leistungsmesser', 'Wattmeter', 'Leistung', 'Watt', 'Wirkleistung', 'Leistungsfaktor', 'cos φ', 'Energiezähler'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'bd-leistung-energie', kat: 'bedien', titel: 'Energie zurücksetzen',
    kurz: 'Die Energieanzeige des Leistungsmessers summiert Leistung mal Zeit seit dem letzten Rücksetzen. Die Taste Energie zurücksetzen stellt den Zähler auf null, damit ein neuer Zeitraum gemessen werden kann.',
    lang: 'Der [[ger-leistung|Leistungsmesser]] des MessLab zählt neben der Leistung die Energie W = P · t in Wattsekunden (Ws) beziehungsweise Joule. Mit jedem Simulationsschritt kommt Leistung mal Schrittdauer hinzu. Die Taste „Energie zurücksetzen“ setzt die Summe auf null; auch die Wahl eines anderen Bauteils in der Liste beginnt die Zählung neu.\n\n**Einordnung**\n\n- 1 Ws = 1 J; 1 Wh = 3600 Ws; 1 kWh = 3,6 MJ\n- Ein [[bt-r|Widerstand]] mit 1 W Verlustleistung setzt in einer Minute 60 Ws in Wärme um\n- Der Stromzähler im Haus misst dieselbe Größe in Kilowattstunden\n\nDie Energieanzeige macht sichtbar, dass auch eine kleine Leistung über lange Zeit viel Energie bedeutet, und dass bei reiner Blindlast trotz Spannung und Strom keine Energie zusammenkommt.',
    formeln: [{ text: 'W = P · t', sprich: 'W gleich P mal t' }],
    werte: [['1 Wh', '3600 Ws', 'belegt'], ['1 kWh', '3,6 MJ', 'belegt']],
    quelle: 'mess.js PWR data-rst; SI-Umrechnung',
    verweise: ['ger-leistung', 'bt-r'],
    labs: ['mess'],
    stich: ['Energie', 'Wattsekunde', 'Joule', 'Kilowattstunde', 'kWh', 'Arbeit', 'zurücksetzen', 'Reset'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'ger-kennlinie', kat: 'geraet', titel: 'Kennlinienschreiber',
    kurz: 'Der Kennlinienschreiber zeichnet den Strom durch ein Bauteil über der Spannung an ihm. Die Kurve zeigt, ob ein Bauteil linear ist wie ein Widerstand oder eine Knickspannung hat wie eine Diode. Ein Tippen in die Kurve nennt Spannung, Strom und statischen Widerstand.',
    lang: 'Ein Kennlinienschreiber legt an ein Bauteil nacheinander viele Spannungen an, misst jeweils den Strom und trägt I über U auf. Im MessLab wird das Bauteil aus der Liste gewählt, „Kennlinie aufnehmen“ zeichnet die Kurve; ein Tippen in das Diagramm zeigt Spannung, Strom und den statischen Widerstand R = U / I an dieser Stelle.\n\n**Typische Kennlinien**\n\n- [[bt-r|Widerstand]]: Gerade durch den Ursprung, Steigung 1 / R\n- [[bt-d|Diode]]: in Durchlassrichtung fast kein Strom bis zur Flussspannung (Silizium etwa 0,7 V), dann steiler Anstieg; in Sperrrichtung praktisch kein Strom\n- Z-Diode: wie Diode, in Sperrrichtung ab der Z-Spannung leitend\n- [[bt-led|Leuchtdiode]]: wie Diode mit höherer Flussspannung je nach Farbe\n- [[bt-ntc|Heißleiter]]: bei Eigenerwärmung gekrümmt, weil der Widerstand mit der Temperatur sinkt\n\n**Statischer und differenzieller Widerstand**\n\nDer statische Widerstand U / I gilt für einen Punkt der Kennlinie. Der differenzielle Widerstand ΔU / ΔI ist die Steigung an dieser Stelle und ist bei Dioden im leitenden Bereich viel kleiner. Reale Kennlinienschreiber (Curve Tracer) nehmen auch Transistorkennlinienfelder mit dem Basisstrom als Parameter auf; das Datenblatt-Lab zeigt solche Felder aus Datenblattwerten.',
    formeln: [{ text: 'R_stat = U / I', sprich: 'R statisch gleich U durch I' }, { text: 'r_diff = ΔU / ΔI', sprich: 'r differenziell gleich Delta U durch Delta I' }],
    werte: [['Flussspannung Silizium', '0,7 V', 'belegt']],
    quelle: 'mess.js TRACE; FACHREVIEW-GRUNDLAGEN-FABLE.md',
    verweise: ['bt-r', 'bt-d', 'bt-led', 'bt-ntc'],
    labs: ['mess', 'ds', 'ana'],
    stich: ['Kennlinienschreiber', 'Kennlinie', 'Curve Tracer', 'I-U-Kennlinie', 'statischer Widerstand', 'differenzieller Widerstand', 'Knickspannung'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'ger-bode', kat: 'geraet', titel: 'Frequenzgang-Messplatz (Bode)',
    kurz: 'Der Frequenzgang-Messplatz misst, wie stark eine Schaltung ein Signal je nach Frequenz durchlässt. Er lässt den Generator einen Frequenzbereich durchlaufen und zeichnet die Ausgangsspannung über der Frequenz. Die Grenzfrequenz wird markiert.',
    lang: 'Der Frequenzgang beschreibt das Verhältnis von Ausgangs- zu Eingangsspannung einer Schaltung in Abhängigkeit von der Frequenz. Das Bode-Diagramm trägt dieses Verhältnis (oft in Dezibel) über einer logarithmischen Frequenzachse auf.\n\n**Im MessLab**\n\nDie Karte „Frequenzgang“ wählt den Generator ([[bt-ac|Wechselspannungsquelle]]) und das Bauteil, an dem der Ausgang gemessen wird. Ein Durchlauf von 10 Hz bis 100 kHz mit 33 Stützpunkten ergibt die Kurve; die Grenzfrequenz f_g wird als senkrechte Marke mit Wert angezeigt. Ein Tippen in die Kurve nennt Frequenz und Verhältnis an dieser Stelle. Der Haken „inv“ wertet das Signal gegenüber dem Generator invertiert aus.\n\n**Grenzfrequenz**\n\nBei der Grenzfrequenz ist die Ausgangsspannung auf 1 / √2 (etwa 70,7 %, −3 dB) des Höchstwerts gesunken. Für ein RC-Glied aus [[bt-r|Widerstand]] und [[bt-c|Kondensator]] gilt f_g = 1 / (2 · π · R · C). Ein Tiefpass fällt oberhalb, ein Hochpass unterhalb der Grenzfrequenz ab, ein Bandpass hat zwei Grenzfrequenzen. Derselbe Messplatz zeigt auch die Resonanz eines Schwingkreises mit [[bt-l|Spule]] und Kondensator.\n\nVon Hand entsteht dasselbe Bild, indem die [[bd-fgen-frequenz|Frequenz]] des [[ger-fgen|Funktionsgenerators]] Schritt für Schritt geändert und die Ausgangsamplitude am [[ger-oszi|Oszilloskop]] abgelesen wird.',
    formeln: [{ text: 'f_g = 1 / (2 · π · R · C)', sprich: 'f g gleich eins durch zwei Pi R C' }, { text: 'a = 20 · lg(U_aus / U_ein) in dB', sprich: 'a gleich 20 mal Logarithmus von U aus durch U ein in Dezibel' }],
    werte: [['Durchlauf MessLab', '10 Hz bis 100 kHz, 33 Punkte', 'ueb'], ['Grenzfrequenz-Kriterium', '−3 dB (1/√2)', 'belegt']],
    quelle: 'messplus.js BODE; Grundlagen Wechselstromtechnik',
    verweise: ['bt-ac', 'bt-r', 'bt-c', 'bt-l', 'bd-fgen-frequenz', 'ger-fgen', 'ger-oszi'],
    labs: ['mess', 'wsl'],
    stich: ['Frequenzgang', 'Bode-Diagramm', 'Bode', 'Grenzfrequenz', 'Tiefpass', 'Hochpass', 'Bandpass', 'Dezibel', 'dB', 'Sweep'],
    pruef: 2, status: 'entwurf'
  },
  {
    id: 'ger-logik', kat: 'geraet', titel: 'Logikanalysator',
    kurz: 'Der Logikanalysator zeigt mehrere Signale gleichzeitig als digitale Kanäle: über der Schwelle ist ein Kanal 1 (High), darunter 0 (Low). Statt der Kurvenform interessiert nur der Pegelwechsel. Die Kanäle zusammen ergeben eine Zahl am Bus.',
    lang: 'Ein Logikanalysator ist das Oszilloskop der Digitaltechnik. Er zeichnet viele Kanäle nebeneinander, aber nur als Pegel 0 oder 1. So lassen sich Taktsignale, Zähler, Busse und die zeitliche Reihenfolge von Flanken beurteilen.\n\n**Im MessLab**\n\nDie Karte „Logikanalysator“ nutzt die [[bd-oszi-kanal|Messpunkte]] des [[ger-oszi|Oszilloskops]] und dessen [[bd-oszi-tdiv|Zeitbasis]]. Die [[bd-logik-schwelle|Schwelle]] legt fest, ab welcher Spannung ein Kanal als 1 gilt. K1 ist das niedrigste Bit; die Kanäle zusammen werden als Zahl am Bus angezeigt, zum Beispiel die Zählfolge 0, 1, 2, 3 eines Binärzählers.\n\n**Vergleich mit dem Oszilloskop**\n\n- Oszilloskop: wenige Kanäle, zeigt die Kurvenform und damit Flankensteilheit, Überschwingen, Störungen\n- Logikanalysator: viele Kanäle (reale Geräte 8, 16 oder mehr), zeigt nur den Pegel und ermöglicht lange Aufzeichnungen und das Dekodieren von Protokollen (I²C, SPI, UART)\n\nDer Logikanalysator ist im DigiLab mit [[bt-ic|Gattern]] und am [[bt-uno|Arduino]] nützlich, um Signale mehrerer Pins in ihrer zeitlichen Abfolge zu sehen.',
    werte: [['Pegel-Zuordnung', 'über Schwelle = 1 (High), darunter = 0 (Low)', 'ueb']],
    quelle: 'messplus.js LA',
    verweise: ['bd-logik-schwelle', 'bd-oszi-kanal', 'ger-oszi', 'bd-oszi-tdiv', 'bt-ic', 'bt-uno'],
    labs: ['mess', 'digi', 'code'],
    stich: ['Logikanalysator', 'Logic Analyzer', 'digitale Kanäle', 'High', 'Low', 'Bus', 'Bit', 'Protokoll', 'I²C', 'SPI'],
    pruef: 1, status: 'entwurf'
  },
  {
    id: 'bd-logik-schwelle', kat: 'bedien', titel: 'Schwelle (Logikanalysator)',
    kurz: 'Die Schwelle ist die Spannung, ab der der Logikanalysator ein Signal als 1 wertet. Liegt die Spannung darüber, zeigt der Kanal High, darunter Low. Sie wird an die Logikfamilie angepasst, etwa 2,5 V bei 5-V-Logik.',
    lang: 'Der [[ger-logik|Logikanalysator]] im MessLab hat die Tasten „Schwelle −“ und „Schwelle ＋“ mit Anzeige des Werts in Volt. Jeder Messpunkt wird mit dieser Spannung verglichen: darüber 1, darunter 0.\n\n**Einstellen**\n\nDie Schwelle liegt sinnvoll in der Mitte zwischen den beiden Pegeln der Schaltung:\n\n- 5-V-Logik (TTL, Arduino Uno): etwa 2,5 V; TTL-Eingänge erkennen unter 0,8 V als Low und über 2,0 V als High\n- 3,3-V-Logik (Raspberry Pi, viele Mikrocontroller): etwa 1,65 V\n- CMOS an 12 V: etwa 6 V\n\nEine zu hohe Schwelle lässt schwache High-Pegel als Low erscheinen, eine zu niedrige wertet Störungen und Restspannungen als High. Reale Logikanalysatoren bieten feste Schwellen je Familie und eine frei einstellbare. Der Vergleich mit der Kurve am [[ger-oszi|Oszilloskop]] zeigt, wie weit ein Signal von der Schwelle entfernt ist (Störabstand).',
    werte: [['Schwelle 5-V-Logik', '2,5 V', 'ueb'], ['Schwelle 3,3-V-Logik', '1,65 V', 'ueb'], ['TTL Low / High am Eingang', '< 0,8 V / > 2,0 V', 'ueb']],
    quelle: 'messplus.js LA.th; TTL-Pegel: Frage wiki__F13',
    verweise: ['ger-logik', 'ger-oszi'],
    labs: ['mess', 'digi'],
    stich: ['Schwelle', 'Threshold', 'Logikpegel', 'High', 'Low', 'TTL', 'CMOS', 'Störabstand', '3,3 V'],
    pruef: 2, status: 'frage', frage: 'wiki__F13'
  },
  /* ===================== Isolations- und Geraetepruefgeraet (Sicherheits-Lab) ===================== */
  {
    id: 'ger-iso', kat: 'geraet', titel: 'Isolations- und Geräteprüfgerät',
    kurz: 'Das Geräteprüfgerät misst, ob ein elektrisches Gerät sicher ist: Schutzleiterwiderstand, Isolationswiderstand mit erhöhter Prüfspannung und Ableitstrom. Isolation und Schutzleiter werden nur am freigeschalteten, vom Netz getrennten Prüfling gemessen.',
    lang: 'Ein Isolationsmessgerät legt eine Gleichspannung von einigen hundert Volt an die Isolierung und berechnet aus dem kleinen Strom den Isolationswiderstand in Megaohm. Ein Geräteprüfgerät (Prüfplatz) vereint diese Messung mit der Schutzleiterprüfung und der Ableitstrommessung und spricht ein Urteil nach Grenzwert.\n\n**Die drei Messungen**\n\n- **Schutzleiterwiderstand R_PE**: niederohmig zwischen Schutzkontakt des Steckers und berührbaren Metallteilen, nur bei Schutzklasse I; Grenzwert im Lab 0,3 Ω bis 5 m Anschlussleitung\n- **Isolationswiderstand R_iso**: mit [[bd-iso-pruefspannung|Prüfspannung]] 500 V Gleichspannung zwischen den miteinander verbundenen Netzleitern L und N und berührbaren Teilen; Grenzwert im Lab 1 MΩ (Schutzklasse I) beziehungsweise 2 MΩ (Schutzklasse II)\n- **Ableitstrom**: unter Netzspannung; bei Schutzklasse I als Schutzleiterstrom, bei Schutzklasse II als Berührungsstrom, der über berührbare Teile fließen würde\n\n**Prüfreihenfolge**\n\nIm Sicherheits-Lab läuft der Prüfplatz in fester Reihenfolge: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom. Die [[bd-iso-messung|Auswahl der Messung]] und die [[bd-iso-leiter|2- oder 4-Leiter-Messung]] sind Bedienelemente des Prüfstands.\n\n**Sicherheit**\n\nIsolation und Schutzleiter werden nur am freigeschalteten, getrennten Prüfling gemessen; den Ableitstrom misst die Elektrofachkraft mit geprüftem Prüfaufbau. Das Lab ist eine Simulation und keine Anleitung für Arbeiten an Netzspannung. Ein Y-[[bt-c|Kondensator]] zwischen Netz und Gehäuse erzeugt den normalen, kleinen Ableitstrom eines Netzteils; der [[bt-rcd|FI-Schutzschalter]] im Netz löst erst bei viel größeren Strömen aus.',
    werte: [['Prüfspannung Isolation', '500 V DC', 'ueb'], ['Grenzwert R_iso Schutzklasse I / II', '1 MΩ / 2 MΩ', 'ueb'], ['Grenzwert R_PE (bis 5 m)', '0,3 Ω', 'belegt'], ['Berührungsstrom Schutzklasse II', '0,5 mA', 'belegt']],
    quelle: 'elsrig-isolation.js CONTROLS/METERS; elsrig-pruefplatz.js (R_PE ✓ belegt); Berührungsstrom SK II 0,5 mA (Toni, reference-fachwerte)',
    verweise: ['bd-iso-pruefspannung', 'bd-iso-messung', 'bd-iso-leiter', 'bt-c', 'bt-rcd'],
    labs: ['els'],
    stich: ['Isolationsmessgerät', 'Geräteprüfgerät', 'Prüfplatz', 'Isolationswiderstand', 'Schutzleiterwiderstand', 'Ableitstrom', 'Schutzleiterstrom', 'Berührungsstrom', 'Megaohm', 'Geräteprüfung', 'Schutzklasse'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-iso-messung', kat: 'bedien', titel: 'Messung wählen (Isolation, Schutzleiter, Ableitstrom)',
    kurz: 'Der Wahlschalter Messung bestimmt, welche Prüfung das Geräteprüfgerät ausführt: Isolationswiderstand, Schutzleiterwiderstand oder Ableitstrom. Zu jeder Messung gehören eigene Einsteller, ein eigener Messwert und ein eigener Grenzwert nach Schutzklasse.',
    lang: 'Im Prüfstand Isolationsmessung des Sicherheits-Labs schaltet die Auswahl „Messung“ zwischen drei Betriebsarten des [[ger-iso|Geräteprüfgeräts]] um:\n\n- **Isolationswiderstand**: Anzeige R_iso in MΩ; Einsteller Feuchte und Verschmutzung bilden Leckpfade parallel zum Material, die [[bd-iso-pruefspannung|Prüfspannung]] ist 500 V Gleichspannung\n- **Schutzleiterwiderstand**: Anzeige R_PE in Ω; Einsteller Leitungslänge, Querschnitt, Kontaktwiderstand und [[bd-iso-leiter|2-/4-Leiter]]; nur bei Schutzklasse I, bei Schutzklasse II und III entfällt der Schritt\n- **Ableitstrom**: Anzeige I_ab in mA; der Y-Kondensator zwischen Netz und Gehäuse bestimmt den Strom bei 230 V und 50 Hz; bei Schutzklasse I heißt er Schutzleiterstrom, bei Schutzklasse II Berührungsstrom\n\nDie Auswahl „Schutzklasse“ daneben setzt den Grenzwert: 1 MΩ (Schutzklasse I) oder 2 MΩ (Schutzklasse II) für die Isolation; Schutzleiterwiderstand 0,3 Ω nur bei Schutzklasse I. Das Urteil in der Anzeige vergleicht Messwert und Grenzwert.\n\nAm realen Prüfgerät entspricht dem ein Drehschalter oder Menü; die Reihenfolge Sicht, Schutzleiter, Isolation, Strom ist fest, weil jede Messung die Sicherheit der nächsten voraussetzt.',
    werte: [['Leckpfad bei Durchschlag (Lehrmodell)', '0,2 MΩ', 'ueb'], ['Y-Kondensator Beispiel', '2,2 nF bis 4,7 nF', 'ueb']],
    quelle: 'elsrig-isolation.js CONTROLS (art, sk, cy, defekt)',
    verweise: ['ger-iso', 'bd-iso-pruefspannung', 'bd-iso-leiter'],
    labs: ['els'],
    stich: ['Messung wählen', 'Betriebsart', 'Isolationswiderstand', 'Schutzleiterwiderstand', 'Ableitstrom', 'Schutzklasse I', 'Schutzklasse II', 'Y-Kondensator', 'Grenzwert'],
    pruef: 3, status: 'frage', frage: 'wiki__F14'
  },
  {
    id: 'bd-iso-pruefspannung', kat: 'bedien', titel: 'Prüfspannung (Isolationsmessung)',
    kurz: 'Die Prüfspannung ist die Gleichspannung, mit der das Isolationsmessgerät die Isolierung belastet. Im Lab sind es 500 Volt. Aus Prüfspannung und dem kleinen Strom durch die Isolierung ergibt sich der Isolationswiderstand in Megaohm.',
    lang: 'Ein Isolationsmessgerät prüft mit einer Spannung, die deutlich über der Betriebsspannung liegt, damit auch schwache Stellen der Isolierung sichtbar werden. Im Prüfstand des Sicherheits-Labs zeigt die Auswahl „Prüfspannung“ den Wert 500 V Gleichspannung (Übungswert); das [[ger-iso|Geräteprüfgerät]] rechnet R_iso = U_prüf / I_iso.\n\n**Warum Gleichspannung**\n\nMit Wechselspannung würde die Kapazität der Isolierung einen Blindstrom treiben und den Wert verfälschen. Bei Gleichspannung fließt nach dem Aufladen nur noch der ohmsche Leckstrom. Reale Geräte bieten Stufen wie 250 V, 500 V und 1000 V; welche Stufe gilt, richtet sich nach der Anlage oder dem Gerät.\n\n**Einflüsse auf den Wert**\n\nFeuchte und Verschmutzung bilden zusätzliche Leckpfade parallel zum Material; der Gesamtwiderstand ist die Parallelschaltung aller Pfade und damit kleiner als der kleinste Einzelpfad. Der Grenzwert hängt von der Schutzklasse ab ([[bd-iso-messung|Messung wählen]]).\n\n**Sicherheit**\n\nDie Prüfspannung ist gefährlich und darf nur am freigeschalteten, vom Netz getrennten und entladenen Prüfling angelegt werden; elektronische Baugruppen, Überspannungsableiter und [[bt-vdr|Varistoren]] können bei 500 V Schaden nehmen oder den Wert verfälschen und werden vorher abgeklemmt.',
    formeln: [{ text: 'R_iso = U_prüf / I_iso', sprich: 'R iso gleich U Prüf durch I iso' }, { text: '1 / R_ges = 1 / R_1 + 1 / R_2 + …', sprich: 'eins durch R gesamt gleich eins durch R 1 plus eins durch R 2 und so weiter' }],
    werte: [['Prüfspannung im Lab', '500 V DC', 'ueb'], ['Stufen realer Geräte', '250 V, 500 V, 1000 V', 'ueb']],
    quelle: 'elsrig-isolation.js uPruef (ELS F2); SPEC-MESSGERAETE-FABLE.md 4.5',
    verweise: ['ger-iso', 'bd-iso-messung', 'bt-vdr'],
    labs: ['els'],
    stich: ['Prüfspannung', '500 V', 'Isolationsprüfung', 'Megger', 'Leckstrom', 'Isolationswiderstand', 'Gleichspannung'],
    pruef: 3, status: 'entwurf'
  },
  {
    id: 'bd-iso-leiter', kat: 'bedien', titel: '2-Leiter- und 4-Leiter-Messung',
    kurz: 'Bei der 2-Leiter-Messung fließt der Messstrom über dieselben Spitzen, an denen die Spannung gemessen wird; ihr Kontaktwiderstand zählt mit. Bei der 4-Leiter-Messung greift ein zweites Leitungspaar die Spannung direkt am Prüfling ab, der Kontakt fällt heraus.',
    lang: 'Der Schutzleiterwiderstand liegt im Bereich weniger Zehntel Ohm. Der Übergangswiderstand einer Messspitze (im Lab 0,01 Ω bis 0,5 Ω) ist genauso groß und verfälscht den Wert. Die Messart im Prüfstand Isolationsmessung des [[ger-iso|Geräteprüfgeräts]] wählt zwischen:\n\n- **2-Leiter**: Strom und Spannung über dieselben zwei Leitungen; R_angezeigt = R_PE + Kontaktwiderstand. Einfach, aber bei kleinen Widerständen ungenau.\n- **4-Leiter** (Kelvin-Messung): zwei Leitungen treiben den Messstrom, zwei weitere messen die Spannung direkt an den Anschlusspunkten. Durch die Spannungsleitungen fließt fast kein Strom, ihr Widerstand spielt keine Rolle; angezeigt wird nur R_PE.\n\nDer Schutzleiterwiderstand selbst folgt aus Länge, Querschnitt und Leitfähigkeit der Anschlussleitung: R = ρ · l / q mit ρ = 0,0178 Ω·mm²/m für Kupfer. Fünf Meter Leitung mit 1 mm² ergeben etwa 0,09 Ω, dazu kommen Stecker und Klemmen. Die Einsteller Leitungslänge, Querschnitt und Kontaktwiderstand im Prüfstand zeigen diese Zusammenhänge; „Leitung bewegen“ bildet die Wackelprüfung nach, bei der die Leitung während der Messung bewegt wird.\n\nDasselbe Prinzip nutzen Milliohmmeter und das [[ger-dmm|Multimeter]] mit Vierleiter-Zubehör für Shunts, Kontakte und Wicklungen.',
    formeln: [{ text: 'R = ρ · l / q', sprich: 'R gleich Rho mal l durch q' }],
    werte: [['Kontaktwiderstand Messspitze', '0,01 Ω bis 0,5 Ω', 'ueb'], ['ρ Kupfer', '0,0178 Ω·mm²/m', 'belegt'], ['Beispiel 5 m, 1 mm²', 'ca. 0,09 Ω', 'belegt']],
    quelle: 'elsrig-isolation.js mode/rk/len/q (Hilfetexte)',
    verweise: ['ger-iso', 'ger-dmm'],
    labs: ['els'],
    stich: ['2-Leiter', '4-Leiter', 'Vierleitermessung', 'Kelvin', 'Kontaktwiderstand', 'Übergangswiderstand', 'Milliohmmeter', 'Schutzleiterwiderstand', 'Wackelprüfung'],
    pruef: 2, status: 'entwurf'
  }
]);
