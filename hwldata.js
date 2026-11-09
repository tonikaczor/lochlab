'use strict';
/* Tonfunk PC-Hardware-Lab: Daten (Aufgaben-Generatoren, Fragen-Pools, Diagnose-Bäume, Beispiele).
   ALLE Leistungs-, Kapazitäts-, Datenraten- und Preiswerte sind ÜBUNGSWERTE, nicht für den Einkauf.
   window.HWL_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, trees, post, usb }
   window.HWL_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'hwl', Status in localStorage 'lm4.hwl.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch die Fehlerursache (neutrale Titel, die Fehlersuche heißt "Fehlerbild A" bis "C").
   Die richtige Antwort steht nie im Seitentext: Sie entsteht erst beim Erzeugen der Aufgabe, die Antwortreihenfolge wird gemischt, die Auswertung geschieht im Skript. */
(function (root) {
  const C = () => root.HWL_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['PC-Aufbau und Netzteil', 'Speicher und RAID', 'Schnittstellen und Datenraten', 'BIOS und UEFI', 'Fehlersuche', 'Zahlensysteme und Speichergrößen', 'Strom und Kosten', 'Kompatibilität'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const cnt = (n, s, p) => (n === 0 ? 'keine ' + s : n + ' ' + (n === 1 ? s : p));

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P8: Aufgaben und Zuordnungen zum PC-Aufbau (Prozessor, RAM, Netzteil, Mainboard, Chipsatz, Sockel, TDP, Wärmeleitpaste) sind in eigenen Worten und vereinfacht formuliert. Passen die Aussagen zum Lehrmaterial, besonders die Rolle des Chipsatzes (bei neueren Prozessoren sitzen Teile davon im Prozessor)? */
  const PCQ = [
    ['Welches Bauteil führt die Befehle von Programmen aus und rechnet?', 'Der Prozessor (CPU)', ['Der Arbeitsspeicher (RAM)', 'Das Netzteil des Rechners', 'Die Grafikkarte im Steckplatz'], 'Der Prozessor holt Befehle aus dem Arbeitsspeicher, führt sie aus und steuert damit den Ablauf.', ['Es ist das Rechenwerk des Rechners.', 'Er hat Kerne und eine Taktfrequenz.']],
    ['Wofür ist der Arbeitsspeicher (RAM) zuständig?', 'Kurzzeitspeicher für laufende Programme und Daten', ['Dauerhafter Speicher für alle Dateien und Programme', 'Wandler der Netzspannung für den Rechner', 'Speicher für die BIOS-Einstellungen ohne Strom'], 'Der Arbeitsspeicher hält, was der Prozessor gerade braucht. Beim Ausschalten ist sein Inhalt weg.', ['Was passiert mit dem Inhalt, wenn der Strom ausfällt?', 'Er ist viel schneller als eine Festplatte, aber flüchtig.']],
    ['Welche Aufgabe hat das Netzteil im PC?', 'Wandelt Netzspannung in Gleichspannungen für die Bauteile', ['Speichert Energie für den Betrieb bei Stromausfall im Rechner', 'Regelt die Drehzahl aller Lüfter im Gehäuse', 'Verbindet den Rechner mit dem Netzwerk'], 'Das Netzteil macht aus 230 V Wechselspannung die Gleichspannungen 12 V, 5 V und 3,3 V.', ['Aus der Steckdose kommt Wechselspannung, die Bauteile brauchen Gleichspannung.', 'Es liefert 12 V, 5 V und 3,3 V.']],
    ['Welches Bauteil verbindet Prozessor, Speicher, Steckkarten und Laufwerke miteinander?', 'Das Mainboard (Hauptplatine)', ['Das Netzteil mit seinen Kabeln', 'Das Gehäuse mit dem Frontpanel', 'Die Wärmeleitpaste zwischen den Teilen'], 'Das Mainboard trägt Sockel, Steckplätze und Anschlüsse und verbindet alle Bauteile über Leiterbahnen.', ['Alle Bauteile stecken irgendwo drauf.', 'Es wird auch Hauptplatine genannt.']],
    ['Welche Aufgabe hat der Chipsatz auf dem Mainboard?', 'Er verbindet Prozessor, Speicher und Anschlüsse', ['Er kühlt den Prozessor mit einem kleinen Lüfter auf dem Mainboard', 'Er speichert das Betriebssystem dauerhaft auf dem Mainboard', 'Er liefert die Betriebsspannung für alle Steckkarten im Rechner'], 'Der Chipsatz regelt, welche Daten zwischen Prozessor, Arbeitsspeicher, Steckplätzen und Laufwerken fließen. Er bestimmt auch, wie viele Anschlüsse das Mainboard bietet.', ['Er ist ein Verteiler für Datenwege.', 'Er entscheidet mit, wie viele USB- und SATA-Anschlüsse es gibt.']],
    ['Was bezeichnet man als Sockel (z. B. AM5 oder LGA 1700)?', 'Die Fassung auf dem Mainboard, in die der Prozessor kommt', ['Der Steckplatz für die Arbeitsspeicher-Riegel auf dem Mainboard', 'Der Anschluss für das Netzteilkabel am Mainboard', 'Die Halterung für den Gehäuselüfter'], 'Der Sockel hält den Prozessor und stellt die Kontakte her. Prozessor und Sockel müssen zueinander passen.', ['Dort wird der Prozessor eingesetzt.', 'Der Name ist auf Prozessor und Mainboard angegeben.']],
    ['Was gibt der TDP-Wert eines Prozessors an?', 'Die Wärmeleistung, die der Kühler abführen muss', ['Die Taktfrequenz des Prozessors in Gigahertz', 'Die Größe des Arbeitsspeichers, den er verwalten kann', 'Die Anzahl der Rechenkerne im Prozessor'], 'TDP ist die Wärmeleistung in Watt, auf die der Kühler ausgelegt sein muss. Der Kühler sollte mindestens diesen Wert schaffen.', ['Die Einheit ist Watt.', 'Es geht um Abwärme, nicht um Geschwindigkeit.']],
    ['Warum wird zwischen Prozessor und Kühler Wärmeleitpaste aufgetragen?', 'Sie gleicht Unebenheiten aus und leitet Wärme besser', ['Sie klebt den Kühler fest und leitet den Strom ab', 'Sie schützt die Sockelkontakte vor Staub und Feuchtigkeit', 'Sie verhindert, dass der Prozessor zu schnell takten kann'], 'Zwischen zwei Metallflächen bleiben winzige Luftspalte. Luft leitet Wärme schlecht, die Paste füllt die Spalte.', ['Luft ist ein schlechter Wärmeleiter.', 'Die Paste soll Lücken füllen, nicht kleben.']]
  ];
  /* PRUEFEN P9: Eigenschaften von HDD, SATA-SSD und NVMe-SSD (bewegliche Teile, Zugriffszeit, M.2 mit PCIe, Verschleiß/TBW, Preis je TB) vereinfacht dargestellt; bitte mit dem Lehrmaterial abgleichen. */
  const DSQ = [
    ['Welcher Datenträger hat bewegliche Teile (rotierende Scheiben und Schreib-Lese-Köpfe)?', 'Die Festplatte (HDD)', ['Die SATA-SSD im 2,5-Zoll-Gehäuse', 'Die NVMe-SSD im M.2-Steckplatz', 'Der USB-Stick'], 'Nur die klassische Festplatte dreht Scheiben und bewegt Köpfe. SSDs speichern in Flash-Zellen ohne Mechanik.', ['Welche Technik dreht sich?', 'SSD steht für Solid State Drive, also ohne mechanische Teile.']],
    ['Warum ist eine SSD beim Starten und Laden meist deutlich schneller als eine HDD?', 'Sie hat keine beweglichen Teile, der Zugriff ist kaum verzögert', ['Sie dreht sich schneller und liest dadurch mehr Daten pro Umdrehung ein', 'Sie wird direkt vom Prozessor als Arbeitsspeicher benutzt', 'Sie hat immer einen größeren Zwischenspeicher als die Platte'], 'Eine HDD muss den Kopf positionieren und auf die Scheibe warten. Die SSD greift elektronisch auf die Zellen zu.', ['Denke an Wartezeiten bei der Mechanik.', 'Bei vielen kleinen Dateien ist der Unterschied besonders groß.']],
    ['Was unterscheidet eine NVMe-SSD im M.2-Steckplatz von einer SATA-SSD?', 'NVMe nutzt PCIe-Lanes und erreicht deutlich höhere Datenraten', ['NVMe hat bewegliche Teile und ist deshalb robuster gegen Stöße', 'NVMe wird über ein SATA-Kabel angeschlossen und ist schneller', 'NVMe speichert nur Daten für den Arbeitsspeicher kurzzeitig'], 'NVMe ist ein Protokoll für Flash-Speicher über PCIe. Eine SATA-SSD ist auf etwa 600 MB/s begrenzt, NVMe darf mehrere GB/s.', ['Die Schnittstelle heißt PCIe.', 'SATA ist bei 600 MB/s am Ende.']],
    ['Was bedeutet die Angabe 7200 U/min bei einer Festplatte?', 'Die Scheiben drehen sich 7200-mal pro Minute', ['Der Prozessor darf 7200-mal pro Minute zugreifen', 'Es können 7200 Dateien pro Minute gelesen werden', 'Die Platte schafft 7200 MB pro Minute'], 'U/min sind Umdrehungen pro Minute. Mehr Umdrehungen bedeuten kürzere Wartezeit auf die richtige Stelle.', ['U/min kennst du von Motoren.', 'Es ist eine Drehzahl der Scheiben.']],
    ['Welche Folge hat es, wenn eine SSD sehr oft beschrieben wird?', 'Die Zellen nutzen sich ab, die Schreibmenge (TBW) ist begrenzt', ['Die Scheibe verliert ihre Magnetisierung nach einem Jahr', 'Der Schreibkopf setzt auf der Oberfläche auf und zerkratzt sie', 'Der Controller bremst die Platte, bis sie neu formatiert wurde'], 'Flash-Zellen vertragen nur eine begrenzte Zahl an Schreibvorgängen. Hersteller geben dafür TBW (Terabytes Written) an.', ['Flash-Zellen altern beim Beschreiben.', 'TBW steht für Terabytes Written.']],
    ['Wofür eignet sich eine HDD heute noch gut?', 'Für große Datenmengen zu geringen Kosten je Terabyte', ['Für das Betriebssystem, weil sie am schnellsten startet', 'Für den Einsatz als Arbeitsspeicher bei großen Programmen', 'Für Geräte, die oft herunterfallen und stoßempfindlich sind'], 'Festplatten bieten viel Platz für wenig Geld, etwa für Archive und Datensicherungen. Schnell und stoßfest sind sie nicht.', ['Welcher Vorteil der HDD bleibt?', 'Preis je Terabyte.']]
  ];
  /* PRUEFEN P10: RAID-Aussagen (RAID ersetzt kein Backup, RAID 5 braucht beim Wiederaufbau eine intakte Restmenge, Stufennamen, Mindestplatten) sind vereinfacht. Reicht die Tiefe, oder sollen Hot-Spare und Rebuild-Zeit schon vorkommen? */
  const RDQ = [
    ['Wie arbeitet RAID 0?', 'Daten werden gleichmäßig auf alle Platten verteilt, ohne Schutz', ['Jede Platte enthält eine vollständige Kopie aller Daten', 'Eine Platte speichert nur Paritätsinformationen', 'Alle Platten halten dieselben Daten und erhöhen so die Lesegeschwindigkeit'], 'RAID 0 verteilt die Daten in Streifen (Striping) auf alle Platten. Das ist schnell, aber der Ausfall einer Platte zerstört den ganzen Verbund.', ['Der Name Striping kommt von Streifen.', 'Es gibt keine Redundanz.']],
    ['Was bedeutet Spiegelung (RAID 1)?', 'Alle Daten liegen auf zwei oder mehr Platten identisch vor', ['Die Daten werden in kleine Blöcke zerlegt und verteilt', 'Die Kapazität aller Platten wird zu einer großen zusammengelegt', 'Eine Platte enthält die Daten, die zweite nur die Prüfsummen'], 'Bei RAID 1 schreibt der Controller jeden Block auf alle Platten. Fällt eine aus, liegen die Daten noch auf den anderen.', ['Spiegel bedeutet Kopie.', 'Die nutzbare Kapazität ist die einer einzelnen Platte.']],
    ['Wozu dient die Parität bei RAID 5?', 'Aus ihr lässt sich der Inhalt einer ausgefallenen Platte berechnen', ['Sie beschleunigt das Schreiben, weil die Daten doppelt abgelegt werden', 'Sie verschlüsselt die Daten auf allen Platten gegen Zugriff', 'Sie zählt, wie oft eine Platte beschrieben wurde'], 'Die Parität ist eine Prüfsumme (XOR) über die Datenblöcke. Fehlt ein Block, rechnet der Controller ihn aus den übrigen und der Parität zurück.', ['Eine Prüfsumme kann Fehlendes rekonstruieren.', 'Sie kostet Kapazität einer Platte.']],
    ['Welche Aussage über RAID und Datensicherung ist richtig?', 'RAID schützt vor Plattenausfall, ersetzt aber kein Backup', ['Ein RAID 1 ersetzt die Datensicherung, weil alle Daten doppelt vorliegen', 'RAID schützt zuverlässig vor Schadsoftware und versehentlichem Löschen', 'Nur RAID 0 braucht noch eine zusätzliche Datensicherung'], 'Ein RAID spiegelt auch Fehler: Gelöschte oder verschlüsselte Dateien sind auf allen Platten gleich betroffen. Brand, Diebstahl und Bedienfehler fängt nur ein Backup ab.', ['Was passiert mit einer gelöschten Datei bei RAID 1?', 'RAID erhöht die Verfügbarkeit, ein Backup die Wiederherstellbarkeit.']],
    ['Welche Stufe kombiniert Spiegelung und Striping (Paare werden gespiegelt, dann verteilt)?', 'RAID 10', ['RAID 0', 'RAID 5', 'RAID 6'], 'RAID 10 ist ein Striping über gespiegelte Paare. Es braucht mindestens vier Platten, die Hälfte der Kapazität ist nutzbar.', ['Die Zahl verrät die Kombination aus 1 und 0.', 'Mindestens vier Platten.']],
    ['Warum sollte bei einem RAID 5 eine ausgefallene Platte schnell ersetzt werden?', 'Beim Wiederaufbau darf keine weitere Platte ausfallen', ['Die Parität wird sonst automatisch gelöscht, um Platz zu schaffen', 'Der Controller schaltet sonst die übrigen Platten ab, um sie zu schonen', 'Die Garantie der übrigen Platten erlischt nach einer Stunde'], 'Mit einer ausgefallenen Platte hat RAID 5 keinen Schutz mehr. Fällt vor Ende des Wiederaufbaus eine zweite aus, sind die Daten verloren.', ['Wie viele Ausfälle verträgt RAID 5?', 'Im Zustand mit einer fehlenden Platte gibt es keine Reserve mehr.']],
    ['Wie viele Platten braucht RAID 5 mindestens?', 'Drei Platten', ['Zwei Platten', 'Vier Platten', 'Sechs Platten'], 'RAID 5 braucht mindestens drei Platten: zwei für Daten, Platz für eine Parität (verteilt).', ['Eine Platte an Kapazität geht für die Parität.', 'Mit zwei Platten wäre es ein Spiegel.']]
  ];
  const IFQ = [
    ['Ein flacher Stecker mit sieben Kontakten verbindet eine 2,5-Zoll-SSD mit dem Mainboard. Welche Schnittstelle ist das?', 'SATA (Datenkabel)', ['PCIe x16 (Steckkarte)', 'USB-C', 'Molex-Stromstecker'], 'Das flache Kabel mit sieben Kontakten ist das SATA-Datenkabel. Der Strom kommt über einen separaten, breiteren Stecker.', ['Es ist ein Datenkabel für Laufwerke.', 'SATA III schafft 6 Gbit/s.']],
    ['Wofür ist der lange PCIe-x16-Steckplatz auf dem Mainboard hauptsächlich gedacht?', 'Für die Grafikkarte', ['Für den Arbeitsspeicher', 'Für den Prozessorlüfter', 'Für die Pufferbatterie'], 'Der x16-Steckplatz hat die meisten Lanes und ist für Grafikkarten gedacht. Er kann auch andere schnelle Karten aufnehmen.', ['Er ist der längste PCIe-Steckplatz.', 'Grafikkarten brauchen viel Bandbreite.']],
    ['Wie wird eine M.2-NVMe-SSD befestigt und angeschlossen?', 'Direkt im M.2-Steckplatz, gehalten von einer kleinen Schraube', ['Mit einem SATA-Datenkabel und einem Netzteilstecker', 'In einem DIMM-Steckplatz neben dem Arbeitsspeicher', 'Über ein USB-Kabel am Gehäuse'], 'M.2-SSDs stecken direkt im Mainboard. Daten und Strom laufen über den Steckplatz, eine Schraube hält das Ende fest.', ['Es wird kein Kabel gebraucht.', 'Der Steckplatz sitzt auf dem Mainboard.']],
    ['Welche Aussage über USB-Stecker und -Generationen stimmt?', 'Die Steckerform (z. B. USB-C) sagt nichts über die Datenrate', ['Ein USB-C-Stecker bedeutet immer USB4 mit einer Datenrate von 40 Gbit/s', 'Alle blauen USB-Buchsen sind USB 2.0 mit 480 Mbit/s', 'USB-A-Stecker gibt es nur in der Generation 1.1'], 'Die Steckerform und die Übertragungsart sind getrennt: USB-C gibt es mit 480 Mbit/s genauso wie mit 40 Gbit/s. Die Datenrate steht in der Spezifikation des Geräts und des Kabels.', ['Stecker und Geschwindigkeit sind zwei Eigenschaften.', 'Ein USB-C-Kabel kann auch nur USB 2.0 können.']],
    ['Wozu dient der 24-polige Stecker vom Netzteil auf dem Mainboard?', 'Er versorgt das Mainboard mit den Betriebsspannungen', ['Er überträgt die Daten der Festplatte zum Prozessor', 'Er verbindet das Frontpanel mit den USB-Buchsen', 'Er leitet die Abwärme zum Gehäuselüfter'], 'Der ATX-Stecker (24 Pol) liefert 3,3 V, 5 V und 12 V ans Mainboard. Der Prozessor bekommt zusätzlich einen eigenen 4+4-poligen Stecker.', ['Er führt Strom, keine Daten.', 'Er kommt vom Netzteil.']],
    ['Was bedeutet „x4“ bei einem PCIe-Steckplatz oder einer NVMe-SSD?', 'Es sind vier Lanes (Datenleitungspaare) gebündelt', ['Die Karte hat vier Anschlüsse für Monitore', 'Der Steckplatz verträgt vier Karten gleichzeitig', 'Die Schnittstelle arbeitet mit vier Gigahertz'], 'Eine Lane ist ein Leitungspaar je Richtung. x4 bedeutet vier Lanes und damit die vierfache Datenrate einer Lane.', ['Lanes sind Spuren.', 'x1, x4, x8 und x16 gibt es.']],
    ['Welcher Anschluss ist ein reiner Stromanschluss für Laufwerke und Lüfter?', 'SATA-Stromstecker (15-polig)', ['SATA-Datenstecker (7-polig)', 'M.2-Steckplatz für SSDs', 'USB-Header auf dem Mainboard'], 'Der breite 15-polige SATA-Stecker kommt vom Netzteil und liefert 3,3 V, 5 V und 12 V. Der schmale mit sieben Kontakten führt die Daten.', ['Die Stromstecker kommen vom Netzteil.', 'Der breitere Stecker ist der für Strom.']]
  ];
  /* PRUEFEN P11: BIOS/UEFI-Fragen (POST, CMOS und Pufferbatterie, Bootreihenfolge, Secure Boot, XMP/EXPO, Virtualisierung, UEFI gegen BIOS, Flash-Update) vereinfacht. Passt der Wortlaut zu den Einstellungen an den Mainboards in der Werkstatt? */
  const BIOQ = [
    ['Was ist die Hauptaufgabe von BIOS bzw. UEFI beim Einschalten?', 'Hardware prüfen, initialisieren und das Betriebssystem starten', ['Programme aus dem Internet nachladen und installieren', 'Die Festplatte vor dem Start formatieren und alle Dateien neu anlegen', 'Die Netzspannung im Netzteil regeln'], 'Die Firmware prüft die Hardware, setzt sie in Betrieb und übergibt an den Bootloader des Betriebssystems.', ['Es läuft vor dem Betriebssystem.', 'Es startet den Rechner und übergibt dann.']],
    ['Wie heißt der Selbsttest der Hardware beim Einschalten?', 'POST (Power-On Self-Test)', ['BIOS-Update (Firmware-Aktualisierung)', 'Defragmentierung (Ordnen der Dateien)', 'Bootmanager-Auswahl (Wahl des Systems)'], 'POST prüft nach dem Einschalten Prozessor, Speicher und Grafik. Fehler zeigt die Firmware mit Pieptönen oder Codes an.', ['Die Abkürzung beginnt mit Power-On.', 'Er läuft jedes Mal beim Einschalten.']],
    ['Wo speichert der PC seine BIOS-/UEFI-Einstellungen (Datum, Bootreihenfolge) bei ausgeschaltetem Netzteil?', 'Im CMOS-/NVRAM-Speicher, versorgt von der Pufferbatterie', ['Im Arbeitsspeicher, der auch ausgeschaltet noch dauerhaft Strom bekommt', 'Auf der Festplatte in einer versteckten Datei', 'Im Netzteil, das die Werte zwischenspeichert'], 'Ein kleiner Speicher auf dem Mainboard wird von einer Knopfzelle (meist CR2032) versorgt. Ist sie leer, gehen Datum und Einstellungen verloren.', ['Es gibt eine kleine Knopfzelle auf dem Mainboard.', 'Ist sie leer, stimmt das Datum nicht mehr.']],
    ['Was ist die Bootreihenfolge?', 'Die Reihenfolge der Datenträger, von denen ein System gesucht wird', ['Die Reihenfolge, in der Programme nach dem Systemstart automatisch geladen werden', 'Die Reihenfolge der Treiber-Installation im Betriebssystem', 'Die Reihenfolge, in der Lüfter beim Start hochdrehen'], 'Die Firmware sucht in dieser Liste der Reihe nach einen startfähigen Datenträger, z. B. SSD, USB-Stick, Netzwerk.', ['Es geht um Datenträger.', 'Der erste Eintrag, der ein System enthält, wird gestartet.']],
    ['Wozu dient Secure Boot im UEFI?', 'Es lässt nur signierte, vertrauenswürdige Startprogramme zu', ['Es verschlüsselt die gesamte Festplatte mit einem Passwort', 'Es sichert die Daten automatisch in die Cloud zum Schutz', 'Es startet den Rechner schneller, indem der Selbsttest entfällt'], 'Secure Boot prüft die digitale Signatur des Bootloaders und blockiert nicht vertrauenswürdige Startprogramme (Schutz vor Bootkits).', ['Das Wort Secure verrät es: Es geht um Vertrauen.', 'Es prüft eine Signatur.']],
    ['Was bewirkt das Zurücksetzen der Pufferbatterie (CMOS-Reset)?', 'Die BIOS-/UEFI-Einstellungen gehen auf Werkseinstellungen zurück', ['Alle Daten auf den Datenträgern werden gelöscht', 'Das Betriebssystem wird neu installiert', 'Der Prozessor wird auf höhere Taktraten freigeschaltet'], 'Ohne Spannung verliert der CMOS-Speicher seine Werte. Der Reset hilft zum Beispiel, wenn ein vergessenes UEFI-Passwort oder eine falsche Einstellung den Start verhindert.', ['Es betrifft nur die Firmware-Einstellungen.', 'Datenträger bleiben unberührt.']],
    ['Wofür ist ein XMP- oder EXPO-Profil im UEFI gedacht?', 'Der Arbeitsspeicher nutzt seine angegebene höhere Taktrate', ['Der Prozessor wird automatisch heruntergetaktet, um Strom zu sparen und leiser zu laufen', 'Das Netzteil schaltet auf einen sparsamen Betriebsmodus um', 'Die Festplatte wird mit einem Kennwort geschützt'], 'Ohne Profil läuft der RAM oft mit dem langsameren Standardtakt. Das Profil lädt die vom Hersteller geprüften Werte (Takt, Zeiten, Spannung).', ['Es betrifft den Speicher.', 'Es ist eine gespeicherte Voreinstellung des Herstellers.']],
    ['Was bedeutet die UEFI-Einstellung für die Prozessor-Virtualisierung?', 'Virtuelle Maschinen laufen mit Hardware-Unterstützung des Prozessors', ['Der Arbeitsspeicher wird auf die Festplatte ausgelagert, um Platz zu schaffen', 'Der Rechner startet mehrere Betriebssysteme gleichzeitig ohne Zusatzsoftware', 'Die Grafikkarte wird für den Prozessor als Speicher genutzt'], 'Die Option schaltet die Befehle frei, mit denen Programme wie Hypervisor oder Emulatoren virtuelle Rechner schnell und sicher ausführen können.', ['Sie betrifft virtuelle Maschinen.', 'Ohne sie laufen VMs oft gar nicht oder sehr langsam.']],
    ['Was ist der Hauptunterschied von UEFI gegenüber dem klassischen BIOS?', 'UEFI startet von GPT-Datenträgern und kennt Secure Boot', ['UEFI arbeitet nur mit MBR-Datenträgern bis höchstens 2 TiB', 'UEFI läuft nur auf Mainboards ohne Pufferbatterie', 'UEFI ersetzt das Betriebssystem auf dem Datenträger'], 'UEFI ist der Nachfolger des BIOS: grafische Oberfläche, Start von GPT-Datenträgern auch über 2 TiB, Secure Boot und mehr Funktionen.', ['Denke an GPT und Datenträger über 2 TiB.', 'UEFI ist Firmware, kein Betriebssystem.']],
    ['Das Flashen eines BIOS-Updates bricht durch einen Stromausfall ab. Was droht?', 'Das Mainboard kann unbrauchbar werden und startet nicht mehr', ['Nur das Datum geht verloren, ansonsten läuft alles weiter wie vorher', 'Das Betriebssystem muss danach neu aktiviert werden', 'Die Festplatte wird dabei automatisch formatiert'], 'Die Firmware wird beim Update überschrieben. Bricht der Vorgang ab, fehlt ein funktionsfähiges Startprogramm. Manche Mainboards haben ein zweites BIOS als Rettung.', ['Das Update überschreibt das Startprogramm.', 'Darum nie während des Updates ausschalten.']]
  ];
  const FSQ = [
    ['Ein Rechner startet nicht mehr. Was machst du zuerst?', 'Nach Symptomen und kürzlichen Änderungen fragen', ['Sofort das Mainboard austauschen und danach weitersuchen', 'Das Betriebssystem komplett neu installieren, um Fehler auszuschließen', 'Alle Bauteile gleichzeitig durch neue ersetzen'], 'Gute Fehlersuche beginnt mit Fragen: Was ist passiert, was wurde verändert (neue Hardware, Gewitter, Umzug)? Erst danach prüft man gezielt.', ['Informationen sammeln kostet nichts.', 'Teile tauschen kommt erst später.']],
    ['Warum tauscht man bei der Fehlersuche immer nur ein Bauteil auf einmal?', 'Nur so erkennt man, welches Bauteil den Fehler verursacht hat', ['Damit die Garantie der übrigen Teile erhalten bleibt', 'Weil mehrere Teile gleichzeitig nicht eingebaut werden dürfen', 'Weil das Netzteil mehr als ein Teil nicht versorgen kann'], 'Werden mehrere Teile gleichzeitig getauscht, weiß man nicht, welches den Fehler behoben hat. Eine Änderung je Schritt macht die Ursache sichtbar.', ['Wie würdest du die Ursache erkennen, wenn drei Dinge geändert sind?', 'Ein Schritt, eine Änderung, ein Test.']],
    ['Du arbeitest am geöffneten PC. Welche Schutzmaßnahme gehört dazu?', 'Netzstecker ziehen und Potenzialausgleich (ESD-Schutz) herstellen', ['Nur den Power-Taster drücken und das Netzteil eingesteckt lassen', 'Zum Schutz vor Staub Gummihandschuhe aus Kunststoff tragen', 'Die Bauteile auf einer Kunststofftüte oder Folie ablegen'], 'Vor dem Öffnen den Netzstecker ziehen. Elektrostatische Entladung kann Bauteile zerstören: Armband oder Erdung, Teile in antistatischen Beuteln ablegen.', ['Zwei Dinge: Strom und statische Aufladung.', 'Das Netzteil führt auch ausgeschaltet noch Spannung am Eingang.']],
    ['Der PC zeigt kein Bild, die Lüfter laufen. Welchen Schritt prüfst du als einfachsten zuerst?', 'Monitorkabel, Eingang und Sitz der Grafikkarte', ['Das Mainboard ausbauen und auf dem Tisch neu verschrauben', 'Die Festplatte formatieren und das System neu aufspielen', 'Die Pufferbatterie ausbauen und dauerhaft weglassen'], 'Zuerst die einfachen, schnellen Prüfungen: Kabel am Monitor und am richtigen Ausgang, richtiger Eingang am Monitor, Grafikkarte fest im Steckplatz.', ['Fang mit dem an, was am wenigsten Aufwand macht.', 'Das Signal muss vom Rechner zum Monitor kommen.']],
    ['Nach dem Einbau neuer RAM-Riegel startet der PC nicht mehr. Wahrscheinlichste Ursache?', 'Riegel nicht eingerastet oder falscher Speichertyp', ['Das Betriebssystem ist durch den Einbau beschädigt worden', 'Die Festplatte hat zu wenig freien Speicherplatz bekommen', 'Der Monitor erkennt den größeren Speicher nicht'], 'Nach der Änderung liegt die Ursache nah: Riegel nicht fest eingerastet, falscher Typ (DDR4/DDR5) oder nicht kompatibel mit dem Mainboard.', ['Was wurde zuletzt verändert?', 'Prüfe Sitz und Typ der Riegel.']],
    ['Was dokumentierst du nach der Reparatur?', 'Fehlerbild, Ursache, durchgeführte Maßnahme und getauschte Teile', ['Nur den Preis der getauschten Teile und die Dauer der Arbeit', 'Die Seriennummer des Gehäuses und das Datum der Lieferung', 'Nur den Namen des Kunden und die genaue Uhrzeit der Annahme'], 'Eine gute Dokumentation hilft beim nächsten Fehler und bei Nachfragen: Was war los, woran lag es, was wurde getan, welche Teile wurden getauscht.', ['Es soll jemand anderes den Fall nachvollziehen können.', 'Fehler, Ursache, Maßnahme.']]
  ];
  /* PRUEFEN P12: Binärpräfixe: 1 KiB = 1024 Byte, 1 kB = 1000 Byte. Windows schreibt oft "GB", meint aber GiB (binär); Hersteller von Datenträgern rechnen dezimal, Arbeitsspeicher binär (16 GB = 16 GiB). Soll im Unterricht die Schreibweise KiB/MiB/GiB konsequent verwendet werden? */
  const PREF = [
    ['Wie viele Byte hat 1 KiB (Kibibyte)?', '1.024 Byte', ['1.000 Byte', '1.048.576 Byte', '8.000 Byte'], 'Das Präfix Kibi steht für 2¹⁰ = 1.024. Kilo (kB) bedeutet dagegen 1.000.', ['Kibi ist das binäre Präfix.', '2 hoch 10.']],
    ['Wie viele Byte hat 1 kB (Kilobyte mit SI-Vorsatz)?', '1.000 Byte', ['1.024 Byte', '100 Byte', '8.192 Byte'], 'Der SI-Vorsatz Kilo bedeutet immer 1.000. Für 1.024 gibt es Kibi (KiB).', ['Kilo heißt in der Physik tausend.', 'Binär wäre KiB.']],
    ['Warum zeigt das Betriebssystem für eine „1-TB“-Festplatte etwa 931 „GB“ an?', 'Hersteller rechnen dezimal, die Anzeige rechnet binär', ['Ein Teil der Platte ist für das Betriebssystem reserviert', 'Die Platte ist defekt und hat einen Teil verloren', 'Die Formatierung löscht etwa sieben Prozent der Daten'], '1 TB = 10¹² Byte. Geteilt durch 2³⁰ ergibt das etwa 931 GiB. Das Betriebssystem schreibt dafür oft „GB“, meint aber GiB.', ['Vergleiche 10¹² mit 2³⁰.', 'Zwei Rechenweisen, ein Datenträger.']],
    ['Welche Einheit meint 2³⁰ Byte?', 'GiB (Gibibyte)', ['GB (Gigabyte, dezimal)', 'Gb (Gigabit)', 'GHz (Gigahertz)'], 'Gibi steht für 2³⁰ = 1.073.741.824. Ein Gigabyte (GB) sind dagegen 10⁹ Byte.', ['Gibi ist binär.', '2³⁰ = 1.073.741.824.']],
    ['Ein Hersteller gibt 16 GB für einen RAM-Riegel an. Wie wird das gemeint?', 'Arbeitsspeicher wird binär gebaut: 16 GB meint hier 16 GiB', ['Immer dezimal: 16 GB sind exakt 16.000.000.000 Byte, der PC zeigt weniger', 'Immer dezimal, daher zeigt der PC etwas weniger an', 'Der Hersteller rundet auf, der PC zeigt immer 16 GB'], 'Speicherchips haben von Natur aus Größen als Zweierpotenzen. Beim RAM sind 16 GB deshalb 16 GiB. Bei Festplatten und SSDs dagegen dezimal.', ['Speicherchips adressieren mit Zweierpotenzen.', 'Bei Festplatten ist es anders.']],
    ['Was ist der Unterschied zwischen Mbit/s und MB/s?', 'Mbit/s zählt Bits, MB/s zählt Bytes (1 Byte = 8 Bit)', ['Mbit/s ist die Geschwindigkeit, MB/s die Größe einer Datei', 'Beide Angaben sind gleich, nur die Schreibweise unterscheidet sich', 'Mbit/s gilt nur für WLAN, MB/s nur für Festplatten'], 'Das kleine b steht für Bit, das große B für Byte. Ein Byte hat 8 Bit, also sind 80 Mbit/s etwa 10 MB/s.', ['Klein b, groß B.', 'Teile durch 8.']]
  ];
  const KPQ = [
    ['Ein Prozessor hat den Sockel AM5. Welches Mainboard passt?', 'Ein Mainboard mit Sockel AM5', ['Ein Mainboard mit Sockel AM4', 'Ein Mainboard mit Sockel LGA 1700', 'Jedes Mainboard, wenn die Kühlerhalterung passt'], 'Prozessor und Mainboard müssen den gleichen Sockel haben. Er legt Kontakte, Form und Befestigung fest.', ['Sockelname vergleichen.', 'Es gibt keine Adapter.']],
    ['Das Mainboard hat DDR5-Steckplätze. Welcher Speicher kann eingesetzt werden?', 'Nur DDR5-Riegel', ['DDR4-Riegel, wenn man sie fest genug eindrückt', 'DDR3- und DDR4-Riegel gemeinsam', 'Alle DDR-Typen, die Kerbe ist nur zur Zierde'], 'Die Speichertypen sind nicht austauschbar. Die Kerbe sitzt bei jedem Typ an anderer Stelle und verhindert das Einsetzen.', ['Der Typ muss zum Mainboard passen.', 'Nie mit Gewalt eindrücken.']],
    ['Warum passt ein DDR4-Riegel nicht in einen DDR5-Steckplatz?', 'Kerbe und Kontaktbelegung sind unterschiedlich', ['Die Riegel sind für DDR4 immer länger als für DDR5', 'Der DDR5-Steckplatz hat mehr Kontakte als Platz im Gehäuse', 'DDR4 nutzt eine andere Stromversorgung über das Netzteil'], 'Die Riegel sind gleich lang, aber die Kerbe liegt an anderer Stelle, und die Kontakte sind anders belegt. So lässt sich der falsche Typ nicht einsetzen.', ['Es ist eine mechanische Sicherung.', 'Die Kerbe sitzt an unterschiedlicher Stelle.']],
    ['Ein Mainboard im Format Mini-ITX soll in ein Gehäuse. Was muss das Gehäuse können?', 'Das Format Mini-ITX unterstützen', ['Mindestens drei PCIe-Steckplätze haben', 'Ein Netzteil mit 1000 W aufnehmen', 'Nur ATX-Mainboards aufnehmen'], 'Der Formfaktor (ATX, mATX, ITX) bestimmt Größe und Schraubpunkte. Größere Gehäuse nehmen kleinere Mainboards auf, aber nicht umgekehrt.', ['Formfaktor vergleichen.', 'Größere Gehäuse können kleinere Mainboards aufnehmen.']],
    ['Das Netzteil liefert 450 W, der Rechner braucht rechnerisch bei Volllast 480 W. Was gilt?', 'Das Netzteil ist zu schwach und muss größer sein', ['Es reicht, denn 450 W sind nur knapp unter 480 W', 'Es reicht, wenn man die Grafikkarte etwas langsamer taktet', 'Das Netzteil reicht, es erzeugt dann nur mehr Wärme'], 'Das Netzteil muss den Bedarf liefern können, dazu kommt eine Reserve. Bei Unterversorgung drohen Abstürze und Defekte.', ['Vergleiche Bedarf und Leistung.', 'Dazu kommt noch eine Reserve.']],
    ['Ein Kühler ist für 65 W ausgelegt, der Prozessor hat 105 W TDP. Was ist die Folge?', 'Der Prozessor überhitzt oder taktet stark herunter', ['Der Kühler arbeitet leiser und kühlt besser', 'Der Kühler schaltet den Prozessor ab, bevor er warm wird', 'Es passiert nichts, TDP ist nur ein Richtwert für den Preis'], 'Der Kühler schafft die Abwärme nicht. Der Prozessor wird heiß, regelt zur Sicherheit seinen Takt herunter oder schaltet ab.', ['Vergleiche 65 W mit 105 W.', 'Hitze führt zu Drosselung.']],
    ['Woran erkennst du, ob ein Kühler auf den Sockel passt?', 'Sockelliste in den technischen Daten des Kühlers', ['Farbe der Lüfterflügel und Form der Kühllamellen', 'Seriennummer des Netzteils im Gehäuse mit dem Prozessor', 'Länge des Lüfterkabels und Anzahl der Heatpipes'], 'Hersteller führen die unterstützten Sockel in den Produktdaten auf. Die Halterung muss zum Sockel des Mainboards passen.', ['Es steht in den technischen Daten.', 'Es ist eine Liste von Sockelnamen.']]
  ];

  /* ---------- Pieptöne und Meldungen (POST) ---------- */
  /* PRUEFEN P13: Zuordnung Pieptöne und Meldungen zu Ursachen ist eine Übungstabelle; echte Pieptoncodes hängen vom BIOS-Hersteller ab (Handbuch des Mainboards). Welche Beispiele nutzt ihr in der Werkstatt? */
  const POST = [
    ['Dauerhaft wiederholter langer Ton, kein Bild', 'Arbeitsspeicher wird nicht erkannt oder sitzt nicht richtig'],
    ['Ein langer und zwei kurze Töne, kein Bild', 'Fehler bei Grafikkarte oder Bildausgabe'],
    ['Kein Ton, die CPU-Kontrollleuchte auf dem Mainboard leuchtet rot', 'Prozessor wird nicht erkannt oder sitzt falsch im Sockel'],
    ['Meldung „CMOS checksum error“ und das Datum steht auf dem Werkswert', 'Pufferbatterie (Knopfzelle) ist leer'],
    ['Meldung „CPU fan error“ beim Start', 'CPU-Lüfter dreht nicht oder ist nicht angeschlossen'],
    ['Meldung „No bootable device“ nach dem Selbsttest', 'Es wird kein startfähiger Datenträger gefunden'],
    ['Der PC schaltet sich sofort nach dem Einschalten wieder aus, die Lüfter zucken kurz', 'Kurzschluss, zum Beispiel durch einen falschen Abstandsbolzen unter dem Mainboard'],
    ['Ein kurzer Ton, danach erscheint das Bild', 'Selbsttest bestanden, die Hardware ist in Ordnung']
  ];

  /* ---------- Diagnose-Entscheidungsbäume ---------- */
  /* PRUEFEN P14: Die drei Diagnose-Bäume (PC startet nicht, Meldung "No bootable device", Abstürze unter Last) sind vereinfachte Standardabläufe. Entsprechen Reihenfolge der Prüfschritte und die genannten Ursachen eurem Vorgehen in der Werkstatt? */
  const TREES = {
    dark: { id: 'dark', title: 'Der PC startet nicht', symptom: 'Der PC lässt sich nicht einschalten: Nach dem Druck auf den Power-Taster passiert nichts.', start: 'n1',
      nodes: {
        n1: { q: 'Leuchtet die Standby-LED auf dem Mainboard, wenn der Netzschalter am Netzteil eingeschaltet ist?', chk: 'Die Standby-LED auf dem Mainboard beobachten', a: [{ t: 'Nein, nichts leuchtet', to: 'n2' }, { t: 'Ja, sie leuchtet', to: 'n3' }] },
        n2: { q: 'Ändert sich etwas, wenn du ein anderes Netzkabel und eine andere Steckdose benutzt?', chk: 'Netzkabel und Steckdose austauschen', a: [{ t: 'Ja, jetzt leuchtet die LED', to: 'Lkabel' }, { t: 'Nein, es bleibt dunkel', to: 'Lpsu' }] },
        n3: { q: 'Startet der PC, wenn du die beiden Pins des Power-Anschlusses auf dem Mainboard kurz mit einem Schraubendreher überbrückst?', chk: 'Die Power-Pins auf dem Mainboard direkt überbrücken', a: [{ t: 'Ja, der PC startet', to: 'Ltaster' }, { t: 'Nein, es tut sich nichts', to: 'n4' }] },
        n4: { q: 'Sitzen der 24-polige ATX-Stecker und der CPU-Stromstecker fest?', chk: 'ATX- und CPU-Stromstecker auf festen Sitz prüfen', a: [{ t: 'Nein, ein Stecker saß lose', to: 'Lstecker' }, { t: 'Ja, alle Stecker sitzen fest', to: 'Lmbpsu' }] }
      },
      leaves: {
        Lkabel: { cause: 'Netzkabel oder Steckdosenleiste ist defekt', fix: 'Defektes Kabel bzw. die Steckdosenleiste ersetzen' },
        Lpsu: { cause: 'Das Netzteil ist defekt (oder sein Schalter bzw. die Sicherung)', fix: 'Netzteil mit einem Ersatzgerät oder Prüfgerät testen und tauschen' },
        Ltaster: { cause: 'Power-Taster oder Frontpanel-Kabel ist defekt oder falsch gesteckt', fix: 'Frontpanel-Kabel nach Handbuch neu stecken, Taster ersetzen' },
        Lstecker: { cause: 'Ein Stromstecker sitzt nicht richtig auf dem Mainboard', fix: 'Stecker bis zum Einrasten eindrücken' },
        Lmbpsu: { cause: 'Das Netzteil liefert unter Last keine Spannung, oder das Mainboard ist defekt', fix: 'Netzteil gegen ein Ersatzgerät tauschen; hilft das nicht, das Mainboard prüfen' }
      } },
    boot: { id: 'boot', title: 'Meldung „No bootable device“', symptom: 'Der PC startet, zeigt aber nur die Meldung „No bootable device“.', start: 'm1',
      nodes: {
        m1: { q: 'Wird der Datenträger mit dem Betriebssystem im BIOS/UEFI angezeigt?', chk: 'Im BIOS/UEFI nachsehen, ob der Datenträger erscheint', a: [{ t: 'Nein, er fehlt in der Liste', to: 'm2' }, { t: 'Ja, er wird angezeigt', to: 'm3' }] },
        m2: { q: 'Wird er erkannt, nachdem du Daten- und Stromkabel (bzw. die M.2-SSD) neu gesteckt hast?', chk: 'Daten- und Stromkabel bzw. M.2-Steckplatz neu stecken', a: [{ t: 'Ja, jetzt erscheint er', to: 'Lkontakt' }, { t: 'Nein, er bleibt unsichtbar', to: 'Ldisk' }] },
        m3: { q: 'Steht dieser Datenträger in der Bootreihenfolge an erster Stelle?', chk: 'Die Bootreihenfolge im BIOS/UEFI kontrollieren', a: [{ t: 'Nein, ein anderes Laufwerk steht davor', to: 'Lorder' }, { t: 'Ja, er steht vorn', to: 'm4' }] },
        m4: { q: 'Passen der Startmodus (UEFI oder Legacy/CSM) und der Partitionsstil (GPT oder MBR) zusammen?', chk: 'Startmodus und Partitionsstil vergleichen', a: [{ t: 'Nein, UEFI ist an, der Datenträger ist aber MBR-partitioniert', to: 'Lmode' }, { t: 'Ja, beides passt zusammen', to: 'Lloader' }] }
      },
      leaves: {
        Lkontakt: { cause: 'Wackelkontakt an Daten- oder Stromkabel bzw. am M.2-Steckplatz', fix: 'Kabel ersetzen und fest stecken, M.2-SSD neu einsetzen und festschrauben' },
        Ldisk: { cause: 'Der Datenträger ist defekt', fix: 'Datenträger in einem anderen PC testen, ersetzen und Daten aus dem Backup zurückspielen' },
        Lorder: { cause: 'Die Bootreihenfolge ist falsch eingestellt', fix: 'Den Systemdatenträger an die erste Stelle setzen und speichern' },
        Lmode: { cause: 'Der Startmodus passt nicht zum Partitionsstil (UEFI/GPT gegen Legacy/MBR)', fix: 'Startmodus passend umstellen oder den Datenträger umwandeln' },
        Lloader: { cause: 'Bootloader oder Startdateien sind beschädigt', fix: 'Startreparatur mit dem Installationsmedium ausführen' }
      } },
    load: { id: 'load', title: 'Abstürze unter Last', symptom: 'Der PC läuft im Büro stabil, startet aber bei Spielen oder hoher Rechenlast von selbst neu.', start: 't1',
      nodes: {
        t1: { q: 'Steigt die Prozessortemperatur unter Last schnell auf über 90 °C?', chk: 'Die Prozessortemperatur unter Last messen', a: [{ t: 'Ja, über 90 °C', to: 't2' }, { t: 'Nein, deutlich darunter', to: 't3' }] },
        t2: { q: 'Dreht der CPU-Lüfter, und sitzt der Kühler fest auf dem Prozessor?', chk: 'CPU-Lüfter und Sitz des Kühlers prüfen', a: [{ t: 'Nein, der Lüfter steht oder der Kühler ist locker', to: 'Lfan' }, { t: 'Ja, beides ist in Ordnung', to: 'Lpaste' }] },
        t3: { q: 'Tritt der Fehler auch auf, wenn nur ein einzelner RAM-Riegel steckt (jeder Riegel einzeln getestet)?', chk: 'Die RAM-Riegel einzeln testen', a: [{ t: 'Nur mit einem bestimmten Riegel stürzt der PC ab', to: 'Lram' }, { t: 'Mit jedem Riegel stürzt er ab', to: 't4' }] },
        t4: { q: 'Bleiben die Abstürze weg, wenn du probeweise ein Ersatznetzteil anschließt?', chk: 'Probeweise ein Ersatznetzteil einbauen', a: [{ t: 'Ja, mit dem Ersatznetzteil läuft er stabil', to: 'Lpsu2' }, { t: 'Nein, die Abstürze bleiben', to: 'Lother' }] }
      },
      leaves: {
        Lfan: { cause: 'Die Kühlung fällt aus (Lüfter blockiert oder Kühler locker)', fix: 'Lüfter reinigen oder tauschen, Kühler korrekt befestigen' },
        Lpaste: { cause: 'Die Wärmeleitpaste ist ausgetrocknet oder der Kühler stark verstaubt', fix: 'Kühler reinigen und neue Wärmeleitpaste auftragen' },
        Lram: { cause: 'Ein RAM-Riegel ist defekt', fix: 'Defekten Riegel mit einem Speichertest bestätigen und ersetzen' },
        Lpsu2: { cause: 'Das Netzteil bricht unter Last ein (zu schwach oder gealtert)', fix: 'Netzteil mit ausreichender Leistung und Reserve einbauen' },
        Lother: { cause: 'Mainboard oder Prozessor ist defekt (Spannungsregler, Kontakte)', fix: 'Mainboard bzw. Prozessor prüfen und ersetzen' }
      } }
  };
  const TREE_IDS = ['dark', 'boot', 'load'];
  const GENERIC_STEP = ['Das Betriebssystem neu installieren', 'Ein BIOS-Update einspielen', 'Alle Bauteile gegen neue tauschen', 'Die Wärmeleitpaste erneuern'];
  const stepTxt = (tree, s) => '• ' + tree.nodes[s.id].q + ' – ' + tree.nodes[s.id].a[s.i].t;

  /* ---------- Hilfsfunktionen für Konfigurationsaufgaben ---------- */
  const CATSEL = ['cpu', 'mb', 'ram', 'gpu', 'cool', 'psu', 'case'];
  const CATLBL = { cpu: 'Prozessor', mb: 'Mainboard', ram: 'Arbeitsspeicher', gpu: 'Grafik', cool: 'Kühler', psu: 'Netzteil', case: 'Gehäuse' };
  const buildTxt = sel => CATSEL.map(k => CATLBL[k] + ': ' + C().nameOf(k, sel[k])).join('; ');
  const dbIds = k => C().DB[k].map(x => x.id);
  function validBuild(R) {
    const c = C(), DB = c.DB;
    for (let i = 0; i < 400; i++) {
      const mb = c.pick(R, DB.mb), cpus = DB.cpu.filter(x => x.sock === mb.sock), cpu = c.pick(R, cpus);
      const rams = DB.ram.filter(x => x.type === mb.ram && x.gib <= mb.max); if (!rams.length) continue;
      const cases = DB.case.filter(x => x.ff.indexOf(mb.ff) >= 0), cs = c.pick(R, cases);
      const cools = DB.cool.filter(x => x.socks.indexOf(cpu.sock) >= 0 && x.tdp >= cpu.tdp && x.h <= cs.cool); if (!cools.length) continue;
      const gpus = DB.gpu.filter(x => x.len <= cs.gpu), ram = c.pick(R, rams), gpu = c.pick(R, gpus);
      const watts = cpu.tdp + gpu.tdp + c.OVERHEAD + c.RAM_W * ram.mods, psus = DB.psu.filter(x => x.w >= watts * c.RESERVE); if (!psus.length) continue;
      const sel = { cpu: cpu.id, mb: mb.id, ram: ram.id, gpu: gpu.id, cool: c.pick(R, cools).id, psu: c.pick(R, psus).id, case: cs.id };
      if (c.checkBuild(sel).err.length === 0 && c.checkBuild(sel).warn.length === 0) return sel;
    }
    return { cpu: 'c1', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k2', psu: 'p450', case: 't1' };
  }
  /* Baut eine Konfiguration mit genau nErr Konflikten (und ohne knappe Reserve) durch Austauschen einzelner Bauteile */
  function brokenBuild(R, minErr, maxErr, noWarn) {
    const c = C(); let last = null;
    for (let i = 0; i < 1500; i++) {
      const sel = validBuild(R), k = minErr === maxErr && minErr === 1 ? 1 : c.ri(R, 1, 3), cats = c.shuffle(R, CATSEL).slice(0, k);
      cats.forEach(cat => { const ids = dbIds(cat).filter(x => x !== sel[cat]); sel[cat] = c.pick(R, ids); });
      const r = c.checkBuild(sel); last = sel;
      if (r.err.length >= minErr && r.err.length <= maxErr && (!noWarn || !r.warn.length)) return sel;
    }
    return last;
  }

  /* ---------- Generatoren ---------- */
  const G = {
    pc: pq(PCQ), dsq: pq(DSQ), rdq: pq(RDQ), ifq: pq(IFQ), bio: pq(BIOQ), fsq: pq(FSQ), pref: pq(PREF), kpq: pq(KPQ),
    watt: R => {
      const c = C(), cpu = c.pick(R, [65, 95, 105, 125]), gpu = c.pick(R, [75, 150, 200, 250, 320]), ram = c.pick(R, [2, 4]), ssd = c.pick(R, [1, 2]), hdd = c.pick(R, [0, 1, 2]), fan = c.pick(R, [3, 4, 5, 6]);
      const sum = c.loadSum({ cpu, gpu, mb: 40, ram, ssd, hdd, fan });
      return numQ('Ein PC enthält: Prozessor (TDP ' + cpu + ' W), Grafikkarte (' + gpu + ' W), Mainboard (40 W), ' + ram + ' RAM-Riegel (je 4 W), ' + cnt(ssd, 'SSD', 'SSDs') + ' (je 5 W)' + ', ' + (hdd ? cnt(hdd, 'Festplatte', 'Festplatten') + ' (je 8 W)' : 'keine Festplatte') + ' und ' + fan + ' Lüfter (je 3 W). Wie hoch ist die Gesamtleistung?', sum, 'W', 'Gesamtleistung', 0.5,
        'Prozessor ' + cpu + ' + Grafik ' + gpu + ' + Mainboard 40 + RAM ' + ram + ' · 4 = ' + ram * 4 + ' + SSD ' + ssd + ' · 5 = ' + ssd * 5 + ' + Festplatten ' + hdd + ' · 8 = ' + hdd * 8 + ' + Lüfter ' + fan + ' · 3 = ' + fan * 3 + ' ergibt ' + f(sum, 0) + ' W.', ['Jedes Bauteil: Anzahl mal Leistung, dann alles addieren.', 'Prozessor und Grafikkarte stehen mit ihrem Wert direkt im Text.']);
    },
    psu: R => {
      const c = C(); let sum, need, ok = false;
      for (let i = 0; i < 300 && !ok; i++) { sum = c.ri(R, 40, 150) * 5; need = c.psuNeed(sum); ok = need <= 1000 && c.PSU_SIZES.every(s => Math.abs(s - need) >= 4); }
      const p = c.psuPick(sum);
      return numQ('Die Bauteile eines Rechners brauchen zusammen ' + f(sum, 0) + ' W. Du planst 30 % Reserve (Faktor 1,3) und wählst die nächste Normgröße aus der Reihe 350, 400, 450, 500, 550, 650, 750, 850, 1.000 W. Welche Nennleistung wählst du mindestens?', p, 'W', 'Nennleistung des Netzteils', 0.01,
        'Mit Reserve: ' + f(sum, 0) + ' W · 1,3 = ' + f(need, 1) + ' W. Die nächste Normgröße ab ' + f(need, 1) + ' W ist ' + f(p, 0) + ' W.', ['Erst mit 1,3 multiplizieren.', 'Dann in der Reihe die erste Größe suchen, die nicht kleiner ist.']);
    },
    temp: R => {
      const c = C(), ta = c.pick(R, [20, 25, 30, 35]), p = c.pick(R, [65, 95, 105, 125]), rth = c.pick(R, [0.2, 0.25, 0.3, 0.4, 0.5]), T = c.cpuTemp(ta, p, rth);
      return numQ('Ein Prozessor gibt ' + p + ' W als Wärme ab. Der Kühler hat einen Wärmewiderstand von ' + f(rth, 2) + ' K/W, die Umgebung ist ' + ta + ' °C warm. Welche Temperatur erreicht der Prozessor nach der vereinfachten Formel T = Umgebung + P · Rth (eine Nachkommastelle)?', T, '°C', 'Prozessortemperatur', 0.06,
        'Temperaturanstieg = P · Rth = ' + p + ' W · ' + f(rth, 2) + ' K/W = ' + f(p * rth, 2) + ' K. T = ' + ta + ' °C + ' + f(p * rth, 2) + ' K = ' + f(T, 2) + ' °C.', ['Wärmewiderstand mal Leistung ergibt den Temperaturanstieg.', 'Die Umgebungstemperatur kommt noch dazu.']);
    },
    raidcap: R => {
      const c = C(), l = c.pick(R, [0, 1, 5, 6, 10]), n = l === 0 ? c.ri(R, 2, 6) : l === 1 ? c.ri(R, 2, 3) : l === 5 ? c.ri(R, 3, 8) : l === 6 ? c.ri(R, 4, 8) : c.pick(R, [4, 6, 8]), s = c.pick(R, [1, 2, 4, 8, 12]), u = c.raidUsable(l, n, s);
      const fm = l === 0 ? 'n · s' : l === 1 ? 's' : l === 5 ? '(n − 1) · s' : l === 6 ? '(n − 2) · s' : 'n / 2 · s';
      return numQ('Ein RAID ' + l + ' besteht aus ' + n + ' gleich großen Festplatten mit je ' + s + ' TB. Wie viel nutzbare Kapazität hat der Verbund?', u, 'TB', 'Nutzbare Kapazität', 0.01,
        'RAID ' + l + ': ' + fm + ' = ' + (l === 0 ? n + ' · ' + s : l === 1 ? f(s, 0) : l === 5 ? '(' + n + ' − 1) · ' + s : l === 6 ? '(' + n + ' − 2) · ' + s : n + ' / 2 · ' + s) + ' = ' + f(u, 0) + ' TB.', ['Überlege, was bei dieser Stufe für Redundanz verbraucht wird.', 'RAID 0 verbraucht nichts, RAID 1 alle außer einer, RAID 5 eine, RAID 6 zwei, RAID 10 die Hälfte.']);
    },
    raidn: R => {
      const c = C(); let l, s, need, n;
      for (let i = 0; i < 300; i++) { l = c.pick(R, [5, 6, 10]); s = c.pick(R, [2, 4, 8]); need = c.ri(R, 3, 12) * 2; n = c.raidDisksFor(l, need, s); if (n >= c.raidOf(l).min + 1 && n <= 12) break; }
      return numQ('Du brauchst mindestens ' + need + ' TB nutzbare Kapazität in einem RAID ' + l + ' aus Festplatten mit je ' + s + ' TB. Wie viele Festplatten brauchst du mindestens' + (l === 10 ? ' (RAID 10 braucht eine gerade Anzahl)' : '') + '?', n, 'Platten', 'Anzahl der Festplatten', 0.01,
        'Nutzbar = ' + (l === 5 ? '(n − 1)' : l === 6 ? '(n − 2)' : 'n / 2') + ' · ' + s + ' TB soll mindestens ' + need + ' TB sein. Das ergibt ' + (l === 5 ? 'n − 1' : l === 6 ? 'n − 2' : 'n / 2') + ' ≥ ' + f(need / s, 2) + ', also n = ' + n + (l === 10 ? ' (gerade Anzahl)' : '') + '. Probe: ' + f(c.raidUsable(l, n, s), 0) + ' TB nutzbar.', ['Löse die Formel für die Kapazität nach der Plattenzahl auf.', 'Immer auf die nächste ganze (bei RAID 10 gerade) Zahl aufrunden.']);
    },
    /* PRUEFEN P19: Bei RAID 10 bilden die Platten 1 und 2, 3 und 4 usw. je ein Spiegelpaar (Reihenfolge nach Plattennummer); echte Controller legen die Paare je nach Konfiguration fest. Bei RAID 1 mit drei Platten wird eine Dreifach-Spiegelung angenommen. Passt die Annahme? */
    raidfail: R => {
      const c = C(), l = c.pick(R, [0, 1, 5, 6, 10]), n = l === 0 ? c.ri(R, 2, 4) : l === 1 ? c.ri(R, 2, 3) : l === 5 ? c.ri(R, 3, 6) : l === 6 ? c.ri(R, 4, 6) : c.pick(R, [4, 6]);
      const k = c.ri(R, 1, Math.min(3, n)), failed = c.shuffle(R, Array.from({ length: n }, (_, i) => i)).slice(0, k).sort((a, b) => a - b), ok = c.raidSurvives(l, n, failed), nums = failed.map(i => i + 1);
      const right = ok ? 'Ja, alle Daten sind weiterhin lesbar' : 'Nein, die Daten des Verbunds sind verloren';
      const wrong = [ok ? 'Nein, die Daten des Verbunds sind verloren' : 'Ja, alle Daten sind weiterhin lesbar', 'Nur die Daten der ausgefallenen Platten fehlen', 'Das hängt von der Plattengröße ab, nicht von der Stufe'];
      const q = choiceQ(R, 'Ein RAID ' + l + ' besteht aus ' + n + ' Platten (Platte 1 bis ' + n + ').' + (l === 10 ? ' Platte 1 und 2 bilden einen Spiegel, Platte 3 und 4 den nächsten' + (n === 6 ? ', Platte 5 und 6 den dritten' : '') + '.' : '') + ' Gleichzeitig ' + (k === 1 ? 'fällt Platte ' + nums[0] : 'fallen die Platten ' + nums.join(' und ').replace(/ und (\d+) und/, ', $1 und') ) + ' aus. Sind die Daten noch vollständig vorhanden?', right, wrong,
        'RAID ' + l + (l === 0 ? ' hat keine Redundanz: Jeder Ausfall zerstört den Verbund.' : l === 1 ? ' hält, solange mindestens eine Platte lebt.' : l === 5 ? ' verträgt den Ausfall einer beliebigen Platte, bei zwei ist Schluss.' : l === 6 ? ' verträgt den Ausfall von zwei beliebigen Platten.' : ' verträgt je Spiegelpaar den Ausfall einer Platte; fallen beide Platten eines Paares aus, sind die Daten weg.') + ' Hier ' + (ok ? 'bleibt der Verbund erhalten.' : 'ist der Verbund verloren.'),
        ['Wie viele Platten darf diese Stufe verlieren?', l === 10 ? 'Prüfe, ob beide Platten eines Spiegelpaares ausgefallen sind.' : 'Vergleiche die Zahl der Ausfälle mit der Toleranz der Stufe.']);
      q.meta = { level: l, n, failed, ok }; return q;
    },
    schnitt: R => {
      const c = C(), usb = c.IFACES.filter(x => /^usb/.test(x.id)), u = c.pick(R, usb), rate = x => (x.gbit < 1 ? f(x.gbit * 1000, 0) + ' Mbit/s' : f(x.gbit, 0) + ' Gbit/s'), nm = x => x.n;
      if (R() < 0.5) return choiceQ(R, 'Welche Datenrate (Signalrate) gehört zu ' + u.n + '?', rate(u), c.shuffle(R, usb.filter(x => x !== u)).slice(0, 3).map(rate), u.n + ' arbeitet mit ' + rate(u) + '. Die Nutzdatenrate liegt wegen Kodierung und Protokoll darunter.', ['Die Generationen werden schneller: 480 Mbit/s, 5, 10, 20, 40 Gbit/s.', 'Gen 1 hat 5 Gbit/s, Gen 2 hat 10 Gbit/s.']);
      return choiceQ(R, 'Welche USB-Schnittstelle arbeitet mit ' + rate(u) + '?', nm(u), c.shuffle(R, usb.filter(x => x !== u)).slice(0, 3).map(nm), nm(u) + ' arbeitet mit ' + rate(u) + '.', ['Die Generationen werden schneller: 480 Mbit/s, 5, 10, 20, 40 Gbit/s.', 'Gen 1 hat 5 Gbit/s, Gen 2 hat 10 Gbit/s.']);
    },
    bits: R => {
      const c = C();
      if (R() < 0.55) { const x = c.pick(R, [48, 80, 100, 160, 200, 480, 800, 1000, 2000]), v = c.mbitToMB(x); return numQ('Eine Schnittstelle überträgt ' + f(x, 0) + ' Mbit/s (brutto, ohne Kodierung). Wie viele MB/s sind das? (1 Byte = 8 Bit)', v, 'MB/s', 'Datenrate', 0.01, f(x, 0) + ' Mbit/s : 8 = ' + f(v, 3) + ' MB/s.', ['Ein Byte besteht aus 8 Bit.', 'Von Bit auf Byte: durch 8 teilen.']); }
      const y = c.pick(R, [50, 125, 250, 400, 550]), v = c.mbToMbit(y);
      return numQ('Eine SSD liest mit ' + f(y, 0) + ' MB/s. Wie viele Mbit/s sind das? (1 Byte = 8 Bit)', v, 'Mbit/s', 'Datenrate', 0.01, f(y, 0) + ' MB/s · 8 = ' + f(v, 0) + ' Mbit/s.', ['Ein Byte besteht aus 8 Bit.', 'Von Byte auf Bit: mal 8.']);
    },
    pcie: R => {
      const c = C(), gen = c.pick(R, [3, 4, 5]), per = c.LANE_GBS[gen], head = 'Übungswerte je Lane: PCIe 3.0 = 1 GB/s, 4.0 = 2 GB/s, 5.0 = 4 GB/s (je Richtung). ';
      if (R() < 0.5) { const L = c.pick(R, [1, 4, 8, 16]), v = c.pcieRate(gen, L); return numQ(head + 'Wie hoch ist die Datenrate eines PCIe-' + gen + '.0-Steckplatzes mit ' + L + ' Lanes (x' + L + ')?', v, 'GB/s', 'Datenrate', 0.01, 'Rate = Lanes · Rate je Lane = ' + L + ' · ' + f(per, 0) + ' GB/s = ' + f(v, 0) + ' GB/s.', ['Die Lanes addieren sich.', 'Anzahl der Lanes mal Rate je Lane.']); }
      const L0 = c.pick(R, [2, 4, 8]), top = per * L0, need = c.rd(top * (0.6 + 0.3 * R()), 1), nL = c.LANES.find(L => c.pcieRate(gen, L) >= need - 1e-9);
      return numQ(head + 'Eine NVMe-SSD soll im PCIe-' + gen + '.0-Steckplatz mindestens ' + f(need, 1) + ' GB/s erreichen. Wie viele Lanes brauchst du mindestens (möglich sind 1, 2, 4, 8, 16)?', nL, 'Lanes', 'Anzahl der Lanes', 0.01,
        'Eine Lane liefert ' + f(per, 0) + ' GB/s. ' + f(need, 1) + ' : ' + f(per, 0) + ' = ' + f(need / per, 2) + ', also ' + nL + ' Lanes (nächste mögliche Breite).', ['Teile die gewünschte Rate durch die Rate einer Lane.', 'Aufrunden auf eine mögliche Breite: 1, 2, 4, 8 oder 16.']);
    },
    /* PRUEFEN P20: Dauer = Größe durch Rate mit 1 GB = 1.000 MB (dezimal) und konstanter Rate; Zwischenspeicher, Protokoll-Overhead und Schwankungen bleiben unberücksichtigt. In der Aufgabe 'bits' wird Mbit/s einfach durch 8 geteilt (brutto, ohne Kodierung). Ist die Vereinfachung für das 1.-2. Lehrjahr in Ordnung? */
    xfer: R => {
      const c = C(); let size, rate, t, min = R() < 0.5;
      for (let i = 0; i < 400; i++) { size = c.pick(R, [4, 8, 12, 16, 25, 32, 50, 64, 100]); rate = c.pick(R, [100, 125, 200, 250, 400, 500, 600]); t = size * 1000 / rate; if (min ? (t >= 120 && t <= 900) : (Number.isInteger(t) && t >= 10 && t <= 400)) break; }
      if (min) return numQ('Du kopierst eine Datei von ' + f(size, 0) + ' GB (1 GB = 1.000 MB) auf ein Laufwerk, das gleichmäßig mit ' + f(rate, 0) + ' MB/s schreibt. Wie viele Minuten dauert das (eine Nachkommastelle)?', t / 60, 'min', 'Dauer', 0.06,
        'Dauer = Größe : Rate = ' + f(size * 1000, 0) + ' MB : ' + f(rate, 0) + ' MB/s = ' + f(t, 1) + ' s = ' + f(t / 60, 2) + ' min.', ['Erst GB in MB umrechnen.', 'Sekunden durch 60 ergeben Minuten.']);
      return numQ('Du kopierst eine Datei von ' + f(size, 0) + ' GB (1 GB = 1.000 MB) auf ein Laufwerk, das gleichmäßig mit ' + f(rate, 0) + ' MB/s schreibt. Wie viele Sekunden dauert das?', t, 's', 'Dauer', 0.5,
        'Dauer = Größe : Rate = ' + f(size * 1000, 0) + ' MB : ' + f(rate, 0) + ' MB/s = ' + f(t, 0) + ' s.', ['Erst GB in MB umrechnen.', 'Dann Größe durch Rate teilen.']);
    },
    /* PRUEFEN P21: Adressraum 2^n Byte bei n Adressleitungen (32 Bit = 4 GiB) und Datenträgergrenze 2^LBA-Bits · Sektorgröße (MBR: 32 Bit mit 512 Byte = 2 TiB; GPT ist hier nicht Thema). Stimmt die Darstellung mit dem Lehrmaterial (z. B. 128-GiB-Grenze bei 28 Bit)? */
    mbr: R => {
      const c = C(), bits = c.pick(R, [28, 30, 32]), sec = c.pick(R, [512, 4096]), v = c.lbaBytes(bits, sec) / 1073741824;
      return numQ('Eine Partitionstabelle adressiert Sektoren mit ' + bits + ' Bit. Ein Sektor fasst ' + f(sec, 0) + ' Byte. Wie viele GiB kann ein Datenträger damit höchstens haben? (2³⁰ Byte = 1 GiB)', v, 'GiB', 'Höchste Größe', 0.01,
        'Zahl der Sektoren = 2^' + bits + ' = ' + f(Math.pow(2, bits), 0) + '. Mal ' + f(sec, 0) + ' Byte, geteilt durch 2³⁰ ergibt ' + f(v, 0) + ' GiB. (Der klassische MBR mit 32 Bit und 512 Byte erreicht so 2 TiB.)', ['Sektorzahl ist 2 hoch Bitbreite.', 'Mal Sektorgröße, dann durch 2³⁰ für GiB.']);
    },
    dispgb: R => {
      const c = C();
      if (R() < 0.5) { const g = c.pick(R, [250, 500, 750, 1000, 2000, 4000]), v = c.shown(g, 'GB'); return numQ('Eine SSD ist mit ' + f(g, 0) + ' GB angegeben (dezimal, 1 GB = 10⁹ Byte). Wie viele GiB zeigt das Betriebssystem an (zwei Nachkommastellen)?', v, 'GiB', 'Angezeigte Größe', 0.01, f(g, 0) + ' GB = ' + f(g, 0) + ' · 10⁹ Byte; geteilt durch 2³⁰ = 1.073.741.824 ergibt ' + f(v, 2) + ' GiB.', ['Rechne die Angabe in Byte um.', 'Dann durch 1.073.741.824 teilen.']); }
      const t = c.pick(R, [1, 2, 4, 8, 12, 16]), v = c.shown(t, 'TB');
      return numQ('Eine Festplatte ist mit ' + f(t, 0) + ' TB angegeben (dezimal, 1 TB = 10¹² Byte). Wie viele TiB zeigt das Betriebssystem an (zwei Nachkommastellen)?', v, 'TiB', 'Angezeigte Größe', 0.01, f(t, 0) + ' TB = ' + f(t, 0) + ' · 10¹² Byte; geteilt durch 2⁴⁰ = 1.099.511.627.776 ergibt ' + f(v, 2) + ' TiB.', ['Rechne die Angabe in Byte um.', 'Dann durch 1.099.511.627.776 teilen.']);
    },
    binu: R => {
      const c = C(), U = ['KiB', 'MiB', 'GiB', 'TiB'], a = c.ri(R, 0, 2), b = c.ri(R, a + 1, 3), v = c.ri(R, 1, 16), fac = Math.pow(1024, b - a);
      if (R() < 0.5) return numQ('Wie viele ' + U[a] + ' sind ' + v + ' ' + U[b] + '? (1 ' + U[b] + ' = 1.024 ' + U[b - 1] + ')', v * fac, U[a], 'Anzahl ' + U[a], 0.01, 'Von ' + U[b] + ' nach ' + U[a] + ' sind es ' + (b - a) + (b - a === 1 ? ' Stufe' : ' Stufen') + ', je Stufe mal 1.024: ' + v + ' · ' + f(fac, 0) + ' = ' + f(v * fac, 0) + ' ' + U[a] + '.', ['Je Stufe mal 1.024.', 'Zähle die Stufen zwischen den Einheiten.']);
      return numQ('Wie viele ' + U[b] + ' sind ' + f(v * fac, 0) + ' ' + U[a] + '? (1 ' + U[b] + ' = 1.024 ' + U[b - 1] + ')', v, U[b], 'Anzahl ' + U[b], 0.01, 'Von ' + U[a] + ' nach ' + U[b] + ' sind es ' + (b - a) + (b - a === 1 ? ' Stufe' : ' Stufen') + ', je Stufe durch 1.024: ' + f(v * fac, 0) + ' : ' + f(fac, 0) + ' = ' + v + ' ' + U[b] + '.', ['Je Stufe durch 1.024.', 'Zähle die Stufen zwischen den Einheiten.']);
    },
    hex: R => {
      const c = C();
      if (R() < 0.5) { const v = c.ri(R, 32, 255), h = c.toBase(v, 16); return numQ('Wandle die Hexadezimalzahl ' + h + ' in eine Dezimalzahl um (A = 10, B = 11, C = 12, D = 13, E = 14, F = 15).', v, '', 'Dezimalzahl', 0.01, h + ' (hex) = ' + c.fromBase(h[0], 16) + ' · 16 + ' + c.fromBase(h[1], 16) + ' = ' + v + '.', ['Die linke Ziffer zählt 16-mal, die rechte einfach.', 'Hex-Ziffern: A = 10 bis F = 15.']); }
      const v = c.ri(R, 20, 255), b = c.toBase(v, 2).padStart(8, '0'), bs = b.slice(0, 4) + ' ' + b.slice(4);
      return numQ('Wandle die Binärzahl ' + bs + ' in eine Dezimalzahl um.', v, '', 'Dezimalzahl', 0.01, bs + ' (binär): Stellenwerte 128, 64, 32, 16, 8, 4, 2, 1. Die Summe der gesetzten Stellen ist ' + v + '.', ['Die Stellenwerte sind 128, 64, 32, 16, 8, 4, 2, 1.', 'Addiere die Stellen, an denen eine 1 steht.']);
    },
    addr: R => {
      const c = C(), b = c.pick(R, [30, 31, 32, 34, 36, 38]), v = c.addrBytes(b) / 1073741824;
      return numQ('Ein Prozessor kann mit ' + b + ' Adressleitungen jedes Byte im Arbeitsspeicher einzeln ansprechen. Wie viele GiB RAM kann er höchstens direkt adressieren? (2³⁰ Byte = 1 GiB)', v, 'GiB', 'Adressraum', 0.01, 'Adressraum = 2^' + b + ' Byte; geteilt durch 2³⁰ ergibt 2^' + (b - 30) + ' = ' + f(v, 0) + ' GiB.', ['Mit n Leitungen gibt es 2^n Adressen.', 'Ein GiB sind 2³⁰ Byte; die Hochzahlen werden subtrahiert.']);
    },
    kwh: R => {
      const c = C(), p = c.pick(R, [60, 85, 120, 150, 200, 350]), h = c.pick(R, [2, 4, 5, 8, 10]), v = c.kwh(p, h);
      return numQ('Ein PC nimmt im Betrieb ' + p + ' W auf und läuft ' + h + ' Stunden. Wie viel Energie verbraucht er in kWh? (1 kWh = 1.000 Wh)', v, 'kWh', 'Energie', 0.005, 'Energie = Leistung · Zeit = ' + p + ' W · ' + h + ' h = ' + f(p * h, 0) + ' Wh = ' + f(v, 3) + ' kWh.', ['Energie = Leistung mal Zeit.', 'Durch 1.000 teilen, um von Wh auf kWh zu kommen.']);
    },
    /* PRUEFEN P17: Strompreise 30, 35 und 40 ct/kWh und Betriebstage 250 (Arbeitstage) bzw. 365 sind Übungswerte; der Rechner läuft in der Aufgabe mit konstanter Leistung. Welchen Preis und welche Annahmen nehmt ihr im Unterricht? */
    cost: R => {
      const c = C(), p = c.pick(R, [60, 100, 150, 200, 300]), h = c.pick(R, [2, 4, 8, 10, 24]), d = c.pick(R, [250, 365]), ct = c.pick(R, [30, 35, 40]), v = c.yearCost(p, h, d, ct);
      return numQ('Ein Rechner nimmt ' + p + ' W auf und läuft an ' + d + ' Tagen im Jahr täglich ' + h + ' Stunden. Eine kWh kostet ' + ct + ' ct. Wie hoch sind die Stromkosten pro Jahr in Euro (auf ganze Euro gerundet reicht)?', v, '€', 'Kosten pro Jahr', 0.5,
        'Energie = ' + p + ' W · ' + h + ' h · ' + d + ' Tage = ' + f(p * h * d / 1000, 2) + ' kWh. Kosten = ' + f(p * h * d / 1000, 2) + ' kWh · ' + ct + ' ct = ' + f(v, 2) + ' €.', ['Erst die Energie im Jahr in kWh, dann mit dem Preis multiplizieren.', 'Cent durch 100 ergibt Euro.']);
    },
    /* PRUEFEN P18: Wirkungsgrade 80, 85 und 90 % (angelehnt an die 80-PLUS-Stufen) als Übungswerte; der Wirkungsgrad hängt in der Praxis von der Last ab. Reicht ein fester Wert je Aufgabe? */
    loss: R => {
      const c = C(), po = c.pick(R, [200, 300, 400, 450, 500]), eta = c.pick(R, [80, 85, 90]), pin = c.inputPower(po, eta);
      if (R() < 0.5) return numQ('Ein Netzteil gibt ' + po + ' W an die Bauteile ab und hat einen Wirkungsgrad von ' + eta + ' %. Welche Leistung nimmt es aus der Steckdose auf (eine Nachkommastelle)?', pin, 'W', 'Aufgenommene Leistung', 0.06, 'Aufnahme = Abgabe : Wirkungsgrad = ' + po + ' W : ' + f(eta / 100, 2) + ' = ' + f(pin, 2) + ' W.', ['Der Wirkungsgrad ist Abgabe durch Aufnahme.', 'Stelle die Formel nach der Aufnahme um.']);
      return numQ('Ein Netzteil gibt ' + po + ' W an die Bauteile ab und hat einen Wirkungsgrad von ' + eta + ' %. Wie viel Verlustleistung entsteht als Wärme im Netzteil (eine Nachkommastelle)?', pin - po, 'W', 'Verlustleistung', 0.06, 'Aufnahme = ' + po + ' W : ' + f(eta / 100, 2) + ' = ' + f(pin, 2) + ' W. Verlust = Aufnahme − Abgabe = ' + f(pin, 2) + ' − ' + po + ' = ' + f(pin - po, 2) + ' W.', ['Erst die Aufnahme aus der Steckdose ausrechnen.', 'Verlust = Aufnahme minus Abgabe.']);
    },
    post: R => {
      const c = C(), p = c.pick(R, POST);
      return choiceQ(R, 'Beim Einschalten eines Rechners fällt auf: ' + p[0] + '. Was ist nach der Übungstabelle die wahrscheinlichste Ursache?', p[1], c.shuffle(R, POST.filter(x => x !== p)).slice(0, 3).map(x => x[1]), p[0] + ' deutet auf Folgendes hin: ' + p[1] + '. (Echte Pieptoncodes hängen vom BIOS-Hersteller ab; maßgeblich ist das Mainboard-Handbuch.)', ['Ordne Hinweis und Bauteil einander zu.', 'Wo setzt der Selbsttest an?']);
    },
    cool: R => {
      const c = C(), socks = ['AM4', 'AM5', 'LGA 1700', 'LGA 1200']; let sk, tdp, hmax, valid = [];
      for (let i = 0; i < 600; i++) {
        sk = c.pick(R, socks); tdp = c.pick(R, [35, 65, 95, 105, 125, 150, 200]); hmax = c.pick(R, [40, 60, 160, 170]);
        valid = c.DB.cool.filter(k => k.socks.indexOf(sk) >= 0 && k.tdp >= tdp && k.h <= hmax); if (valid.length === 1) break;
      }
      if (valid.length !== 1) { sk = 'AM5'; tdp = 65; hmax = 70; valid = c.DB.cool.filter(k => k.socks.indexOf(sk) >= 0 && k.tdp >= tdp && k.h <= hmax); }
      const r = valid[0], nm = c.NAMES.cool;
      return choiceQ(R, 'Ein Prozessor mit Sockel ' + sk + ' gibt ' + tdp + ' W Abwärme ab. Im Gehäuse ist Platz für einen Kühler bis ' + hmax + ' mm Höhe. Welcher Kühler erfüllt alle Bedingungen?', nm(r), c.DB.cool.filter(k => k !== r).map(nm),
        'Der Kühler muss zum Sockel passen, mindestens ' + tdp + ' W abführen und höchstens ' + hmax + ' mm hoch sein. Nur ' + r.n + ' (bis ' + r.tdp + ' W, ' + r.h + ' mm) erfüllt alle drei Bedingungen.', ['Prüfe nacheinander Sockel, Leistung und Höhe.', 'Streiche jeden Kühler, der eine Bedingung verletzt.']);
    },
    build1: R => {
      const c = C(), sel = brokenBuild(R, 1, 1, true), r = c.checkBuild(sel), e = r.err[0], order = c.CONFLICT_ORDER.filter(k => k !== 'psuMargin' && k !== e.k), wr = c.shuffle(R, order).slice(0, 3).map(k => c.CONFLICTS[k].t);
      const q = choiceQ(R, 'Ein Rechner ist so geplant: ' + buildTxt(sel) + '. (Zusatzlast für Mainboard, Laufwerke und Lüfter: 50 W plus 4 W je RAM-Riegel; das Netzteil muss mindestens den berechneten Bedarf liefern.) Genau ein Bauteil passt nicht. Welcher Konflikt besteht?', c.CONFLICTS[e.k].t, wr, e.t + ' Alle anderen Verbindungen passen.', ['Gehe die Verbindungen der Reihe nach durch: Sockel, Speicher, Kühler, Gehäuse, Netzteil.', 'Vergleiche immer zwei Bauteile, die zusammenpassen müssen.']);
      q.meta = { sel, code: e.k }; return q;
    },
    buildn: R => {
      const c = C(), sel = brokenBuild(R, 2, 4, true), r = c.checkBuild(sel), n = r.err.length;
      const q = numQ('Ein Rechner ist so geplant: ' + buildTxt(sel) + '. (Zusatzlast für Mainboard, Laufwerke und Lüfter: 50 W plus 4 W je RAM-Riegel; das Netzteil muss mindestens den berechneten Bedarf liefern. Mögliche Konflikte: Sockel, Speichertyp, Speichermenge, Kühler-Sockel, Kühlleistung, Formfaktor, Kühlerhöhe, Grafikkartenlänge, Netzteil.) Wie viele Konflikte hat die Planung?', n, 'Konflikte', 'Anzahl der Konflikte', 0.01,
        'Die Konflikte: ' + r.err.map(x => x.t).join(' ') + ' Das sind ' + n + ' Konflikte.', ['Prüfe jede der neun möglichen Verbindungen einzeln.', 'Zähle nur echte Konflikte, nicht die Verbindungen, die passen.']);
      q.meta = { sel }; return q;
    },
    diagpath: (R, arg) => {
      const c = C(), id = arg && arg.length ? c.pick(R, arg) : c.pick(R, TREE_IDS), tr = TREES[id], lid = c.pick(R, Object.keys(tr.leaves)), path = c.treePath(tr, lid), right = tr.leaves[lid].cause;
      const q = choiceQ(R, 'Kundenmeldung: „' + tr.symptom + '“ Du prüfst der Reihe nach:\n' + path.map(s => stepTxt(tr, s)).join('\n') + '\nWas ist die wahrscheinlichste Ursache?', right, c.shuffle(R, Object.keys(tr.leaves).filter(k => k !== lid)).slice(0, 3).map(k => tr.leaves[k].cause),
        'Der Weg durch den Entscheidungsbaum „' + tr.title + '“ endet bei: ' + right + '. Maßnahme: ' + tr.leaves[lid].fix + '.', ['Gehe die Antworten Schritt für Schritt durch und streiche, was dadurch ausgeschlossen ist.', 'Die letzte Prüfung grenzt die Ursache am stärksten ein.']);
      q.meta = { tree: id, leaf: lid }; return q;
    },
    diagnext: (R, arg) => {
      const c = C(), id = arg && arg.length ? c.pick(R, arg) : c.pick(R, TREE_IDS), tr = TREES[id];
      let path, k;
      for (let i = 0; i < 100; i++) { path = c.treePath(tr, c.pick(R, Object.keys(tr.leaves))); if (path.length >= 2) break; }
      k = c.ri(R, 1, path.length - 1); const nd = tr.nodes[path[k].id], onPath = path.slice(0, k + 1).map(s => s.id);
      const pool = Object.keys(tr.nodes).filter(x => onPath.indexOf(x) < 0).map(x => tr.nodes[x].chk).concat(c.shuffle(R, GENERIC_STEP)), wr = pool.slice(0, 3);
      const q = choiceQ(R, 'Kundenmeldung: „' + tr.symptom + '“ Bisher hast du geprüft:\n' + path.slice(0, k).map(s => stepTxt(tr, s)).join('\n') + '\nWas prüfst du als Nächstes?', nd.chk, wr,
        'Nach diesen Ergebnissen ist der nächste sinnvolle Schritt: ' + nd.chk + '. Die Prüfungen gehen vom Einfachen zum Aufwendigen, und jede Antwort entscheidet, welcher Zweig weiterverfolgt wird.', ['Was ist die einfachste Prüfung, die noch fehlt?', 'Springe nicht zu Schritten, die erst nach anderen Ergebnissen sinnvoll sind.']);
      q.meta = { tree: id, node: path[k].id }; return q;
    }
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument (Indexliste für Pools oder Baum-Kennungen) */
  const defs = [
    [CATS[0], 1, 'Bauteil und Aufgabe', 'pc'], [CATS[0], 2, 'Leistung der Bauteile', 'watt'], [CATS[0], 2, 'Netzteil wählen', 'psu'], [CATS[0], 3, 'Temperatur im Betrieb', 'temp'],
    [CATS[1], 1, 'Datenträger im Vergleich', 'dsq'], [CATS[1], 1, 'Verbund von Platten', 'rdq'], [CATS[1], 2, 'Platz im Verbund', 'raidcap'], [CATS[1], 2, 'Plattenzahl bestimmen', 'raidn'], [CATS[1], 3, 'Platten fallen aus', 'raidfail'],
    [CATS[2], 1, 'Anschluss erkennen', 'ifq'], [CATS[2], 1, 'Datenrate zuordnen', 'schnitt'], [CATS[2], 2, 'Bit und Byte', 'bits'], [CATS[2], 2, 'Lanes und Bandbreite', 'pcie'], [CATS[2], 3, 'Dauer einer Übertragung', 'xfer'],
    [CATS[3], 1, 'Aufgabe der Firmware', 'bio', [0, 1, 2, 3]], [CATS[3], 2, 'Einstellungen im Setup', 'bio', [4, 5, 6, 7, 8, 9]], [CATS[3], 3, 'Größe adressieren', 'mbr'],
    [CATS[4], 1, 'Meldungen beim Start', 'post'], [CATS[4], 1, 'Vorgehen beim Prüfen', 'fsq'], [CATS[4], 2, 'Fehlerbild A', 'diagpath', ['dark']], [CATS[4], 2, 'Fehlerbild B', 'diagnext', TREE_IDS], [CATS[4], 3, 'Fehlerbild C', 'diagpath', ['boot', 'load']],
    [CATS[5], 1, 'Vorsätze und Einheiten', 'pref'], [CATS[5], 2, 'Angabe und Anzeige', 'dispgb'], [CATS[5], 2, 'Binäre Einheiten', 'binu'], [CATS[5], 2, 'Hex und Binär', 'hex'], [CATS[5], 3, 'Adressen und Speicher', 'addr'],
    [CATS[6], 2, 'Energie im Betrieb', 'kwh'], [CATS[6], 3, 'Kosten im Jahr', 'cost'], [CATS[6], 3, 'Netzteil und Wärme', 'loss'],
    [CATS[7], 1, 'Passende Bauteile', 'kpq'], [CATS[7], 2, 'Kühler wählen', 'cool'], [CATS[7], 2, 'Planung prüfen', 'build1'], [CATS[7], 3, 'Planung bewerten', 'buildn']
  ];
  const tasks = defs.map((d, i) => ({ id: 'hwl' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('hwl-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Ausgabe entsteht im UI aus HWL_CORE) ---------- */
  const examples = [
    { id: 'psu1', tab: 'pc', title: 'Netzteil für einen Büro-PC', text: 'Ein Büro-PC mit Prozessor (65 W), ohne Grafikkarte, mit 2 RAM-Riegeln, einer SSD und zwei Gehäuselüftern. Welches Netzteil reicht?', p: { cpu: 65, gpu: 0, mb: 40, ram: 2, ssd: 1, hdd: 0, fan: 2, other: 0, eff: 85, h: 8, days: 250, ct: 35, tamb: 25, rth: 0.4 } },
    { id: 'psu2', tab: 'pc', title: 'Netzteil für einen Spiele-PC', text: 'Prozessor 125 W, Grafikkarte 250 W, 4 RAM-Riegel, zwei SSDs, eine Festplatte und fünf Lüfter. Wie viel Reserve braucht das Netzteil?', p: { cpu: 125, gpu: 250, mb: 40, ram: 4, ssd: 2, hdd: 1, fan: 5, other: 0, eff: 90, h: 4, days: 365, ct: 35, tamb: 25, rth: 0.25 } },
    { id: 'psu3', tab: 'pc', title: 'Stromkosten eines Dauerläufers', text: 'Ein Heimserver mit Prozessor (65 W), 4 Festplatten und drei Lüftern läuft rund um die Uhr. Was kostet der Strom im Jahr bei 35 ct je kWh?', p: { cpu: 65, gpu: 0, mb: 40, ram: 2, ssd: 1, hdd: 4, fan: 3, other: 0, eff: 85, h: 24, days: 365, ct: 35, tamb: 25, rth: 0.4 } },
    { id: 'raid1', tab: 'raid', title: 'RAID 5 aus vier Platten', text: 'Vier Festplatten mit je 4 TB bilden ein RAID 5. Wie viel Platz bleibt nutzbar, und wie viele Ausfälle sind erlaubt?', p: { level: 5, n: 4, s: 4, failed: [] } },
    { id: 'raid2', tab: 'raid', title: 'RAID 10: zwei Ausfälle überstehen', text: 'Ein RAID 10 aus sechs Platten à 2 TB. Die Platten 1 und 4 fallen aus (aus verschiedenen Spiegelpaaren). Sind die Daten noch da?', p: { level: 10, n: 6, s: 2, failed: [0, 3] } },
    { id: 'raid3', tab: 'raid', title: 'RAID 10: ein Spiegelpaar fällt aus', text: 'Ein RAID 10 aus vier Platten à 2 TB. Die Platten 1 und 2, ein ganzes Spiegelpaar, fallen aus. Was passiert?', p: { level: 10, n: 4, s: 2, failed: [0, 1] } },
    { id: 'raid4', tab: 'raid', title: 'RAID 6 mit zwei Ausfällen', text: 'Sechs Platten à 4 TB als RAID 6. Zwei beliebige Platten fallen gleichzeitig aus.', p: { level: 6, n: 6, s: 4, failed: [1, 4] } },
    { id: 'kfg1', tab: 'kfg', title: 'Eine stimmige Konfiguration', text: 'Prozessor A (AM4), Mainboard A (AM4, DDR4, ATX), 32 GiB DDR4, kleine Grafikkarte, Boxed-Kühler, Netzteil 450 W, Midi-Tower. Passt alles zusammen?', p: { cpu: 'c1', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k2', psu: 'p450', case: 't1' } },
    { id: 'kfg2', tab: 'kfg', title: 'Der Sockel passt nicht', text: 'Prozessor B (AM5) soll auf Mainboard A (AM4), mit Towerkühler mittel. Sonst passt alles. Was meldet der Konfigurator?', p: { cpu: 'c2', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k3', psu: 'p450', case: 't1' } },
    { id: 'kfg3', tab: 'kfg', title: 'DDR4 im DDR5-Mainboard und ein zu schwaches Netzteil', text: 'Prozessor B und Mainboard B (AM5, DDR5) mit DDR4-Speicher, große Grafikkarte, Netzteil 450 W. Welche zwei Konflikte treten auf?', p: { cpu: 'c2', mb: 'b2', ram: 'r2', gpu: 'g3', cool: 'k3', psu: 'p450', case: 't1' } },
    { id: 'bit1', tab: 'bit', title: 'Festplatte mit 500 GB: Anzeige im System', text: 'Eine SSD ist mit 500 GB angegeben. Wie groß ist sie in der Anzeige des Betriebssystems (GiB)?', p: { v: 500, u: 'GB', fs: 25, fu: 'GB', fi: 'usb32g1', fr: '' } },
    { id: 'bit2', tab: 'bit', title: '25 GB über USB 3.2 Gen 1 kopieren', text: 'Eine Datei von 25 GB wird über USB 3.2 Gen 1 mit der Übungs-Höchstrate kopiert. Wie lange dauert das mindestens?', p: { v: 1, u: 'GiB', fs: 25, fu: 'GB', fi: 'usb32g1', fr: '' } },
    { id: 'bit3', tab: 'bit', title: 'Wie viele Byte hat 1 GiB?', text: 'Ein GiB ist 2³⁰ Byte. Wie sieht der Unterschied zu einem Gigabyte (10⁹ Byte) aus?', p: { v: 1, u: 'GiB', fs: 25, fu: 'GB', fi: 'sata3', fr: '' } },
    { id: 'diag1', tab: 'diag', title: 'PC startet nicht: Netzteil als Ursache', text: 'Nichts leuchtet, auch mit anderem Netzkabel und anderer Steckdose bleibt es dunkel.', p: { tree: 'dark', path: [0, 1] } },
    { id: 'diag2', tab: 'diag', title: 'No bootable device: falsche Reihenfolge', text: 'Der Datenträger wird angezeigt, steht aber nicht an erster Stelle in der Bootreihenfolge.', p: { tree: 'boot', path: [1, 0] } }
  ];

  root.HWL_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, trees: TREES, treeIds: TREE_IDS, post: POST, validBuild, pools: { PCQ, DSQ, RDQ, IFQ, BIOQ, FSQ, PREF, KPQ } };
  root.HWL_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.HWL_DATA, TASKS: root.HWL_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
