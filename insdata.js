'use strict';
/* Tonfunk Instandhaltungs-Lab: Daten (Lab-Kennung 'ins', Präfix lm4.ins.).
   window.INS_DATA  { GROUPS, scenarios, measX, begriffe, begriffeItems, strategien, strategieItems, schmier, schmierItems, schmierplan,
                      schaeden, ursachen, sicherheit, planPool, cats, tasks }
   window.INS_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.ins.done' = {id:true})
   Szenarien (Fehlersuche): Jede Prüfschritt-Antwort steht in der Wahrheitstabelle step.def (Normalbefund) bzw. step.over[faultId] (Befund bei diesem Fehler).
   Fehlernamen (faults[].name) und Wörter aus faults[].forbid dürfen in KEINEM Text stehen, den der Lernende vor der Abgabe sieht
   (Einleitung, Symptome, Prüfschritt-Bezeichnungen, Befunde, Tipps Stufe 1 und 2). Die Tests prüfen das automatisch.
   Alle Messwerte der Szenarien sind erfundene Lab-Daten für diese Übung, keine Herstellerangaben.
   Fachliche Werte, die der Ausbilder gegenprüfen soll, sind mit PRUEFEN markiert. */
(function (root) {
  const GROUPS = { doc: 'Befragen und Unterlagen', sicht: 'Sichtprüfung', hoer: 'Hören und Fühlen', mess: 'Messen und Prüfen' };
  /* Prüfschritt: mode 'run' = nur bei laufender Maschine, 'safe' = nur bei gesicherter Maschine (Eingriff), 'any' = immer */
  const st = (id, g, mode, min, label, def, over) => ({ id, g, mode, min, label, def, over: over || {} });
  const fl = (id, name, forbid, cause, measure, prev) => ({ id, name, forbid, cause, measure, prev });

  /* ============================================================ Fehlersuche-Szenarien */
  const scenarios = [
    /* ---------- 1 Ständerbohrmaschine ---------- */
    { id: 'bohr', title: 'Ständerbohrmaschine rattert', machine: 'Ständerbohrmaschine mit Riementrieb', level: 1, rate: 40,
      flow: ['Motor', 'Riementrieb', 'Spindel mit Lager', 'Bohrfutter und Bohrer'],
      residual: { label: 'Spindelnachlauf abwarten, Spindel gegen Drehen sichern', done: 'Die Spindel ist ausgelaufen und gegen Drehen gesichert.' },
      intro: 'Die Ständerbohrmaschine in der Lehrwerkstatt läuft schlecht. Sie ist eingeschaltet und läuft im Leerlauf. Du bist von der Instandhaltung und sollst die Ursache finden.',
      symptoms: ['Beim Bohren in Stahl rattert die Maschine.', 'Die Drehzahl fällt unter Last spürbar ab.', 'Die Bohrungen werden unrund und rau.'],
      tips: ['Beginne mit den billigen Schritten: Bediener befragen und ins Wartungsbuch sehen. Prüfe im Betrieb, bevor du die Maschine stilllegst.',
        'Drei Bereiche kommen infrage: der Antrieb (Motor, Riementrieb), die Spindel mit ihrem Lager und das Werkzeug. Eine einzige Messung trennt oft zwei Bereiche.'],
      faults: [
        fl('f1', 'Keilriemen zu locker und verglast', ['verglast', 'Schlupf', 'Riemenschlupf'], 'Der Keilriemen hat durch Verschleiß und Wärme Spannung verloren. Er rutscht auf den Scheiben (Schlupf), die Flanken verglasen, die Drehzahl an der Spindel bricht unter Last ein.', 'Riemen ersetzen, auf Soll-Durchdrückmaß spannen und die Scheiben prüfen', 'Riemenspannung im Wartungsplan regelmäßig prüfen und nach jedem Drehzahlwechsel kontrollieren.'),
        fl('f2', 'Spindellager ausgeschlagen (zu großes Lagerspiel)', ['ausgeschlagen', 'Lagerschaden'], 'Das Spindellager hat zu viel Radialspiel. Die Spindel schlägt, es rattert und die Bohrung wird unrund; das Lager läuft wärmer.', 'Spindellager tauschen und Lagerspiel bzw. Vorspannung einstellen', 'Spindelspiel regelmäßig messen (Inspektion), nach Plan schmieren, Überlast und Schläge vermeiden.'),
        fl('f3', 'Bohrer stumpf (Schneiden verschlissen)', ['stumpf', 'verschlissen'], 'Die Schneiden des Bohrers sind abgerundet und ausgebrochen. Er schneidet nicht, sondern quetscht, es quietscht, die Späne glühen blau an. Die Maschine selbst ist in Ordnung.', 'Bohrer nachschleifen oder durch einen scharfen, passenden Bohrer ersetzen; Schnittwerte für das Material prüfen', 'Standzeit festlegen, Werkzeug rechtzeitig wechseln, passende Drehzahl und Kühlung wählen.'),
        fl('f4', 'Motorzuleitung: eine Phase fehlt', ['Phasenausfall', 'Phase fehlt', 'durchgebrannt'], 'Eine Phase der Motorzuleitung ist unterbrochen. Der Drehstrommotor läuft im Leerlauf weiter, bricht aber unter Last ein, brummt und wird heiß.', 'Zuleitung und Absicherung durch eine Elektrofachkraft prüfen und instandsetzen lassen', 'Elektrische Prüfungen durch die Elektrofachkraft im Prüfplan verankern, Motorschutz regelmäßig prüfen.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Störung sei „irgendwann in den letzten Wochen“ gekommen, genau wisse er es nicht.', {
          f1: 'Der Bediener sagt: Seit dem Drehzahlwechsel (Riemen umlegen) vor zwei Wochen fällt die Drehzahl beim Bohren ab. Beim Anbohren riecht es leicht nach Gummi.',
          f2: 'Der Bediener sagt: Seit Wochen rumpelt es im Spindelkopf, die Bohrungen werden immer unrunder, auch mit neuen Bohrern.',
          f3: 'Der Bediener sagt: Es wurde viel in Edelstahl gebohrt. Der Bohrer ist seit Wochen derselbe, er quietscht und die Späne sind blau.',
          f4: 'Der Bediener sagt: Beim Einschalten hat es kurz geknallt, danach brummte der Motor ungewöhnlich. Seitdem fehlt die Kraft.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Inspektion und Schmierung nach Plan, ohne Befund.', {
          f1: 'Eintrag: Vor zwei Wochen Riemen für andere Drehzahl umgelegt, Spannung nicht dokumentiert.',
          f2: 'Eintrag: Spindelspiel seit der Inspektion vor einem Jahr nicht mehr gemessen.',
          f3: 'Eintrag: Werkzeugwechsel und Nachschliff liegen beim Bediener, es gibt keine Standzeitliste.' }),
        st('leer', 'hoer', 'run', 2, 'Maschine im Leerlauf anhören', 'Im Leerlauf läuft die Maschine gleichmäßig und leise.', { f2: 'Im Leerlauf ist ein unruhiges, brummendes Geräusch zu hören, der Lauf wirkt unrund.', f4: 'Im Leerlauf ist ein unruhiges, brummendes Geräusch zu hören, der Lauf wirkt unrund.' }),
        st('last', 'hoer', 'run', 4, 'Probebohrung in Stahl beobachten', 'Beim Anbohren rattert die Maschine und die Drehzahl fällt ab; die Bohrung wird unrund.', {
          f3: 'Der Bohrer quietscht und schneidet kaum, die Späne sind blau angelaufen. Die Maschine läuft dabei ruhig, die Drehzahl hält.' }),
        st('temp', 'mess', 'run', 3, 'Temperaturen messen (Spindelkopf und Motor, Infrarotthermometer)', 'Spindelkopf etwa 35 °C, Motor etwa 55 °C: beides im normalen Bereich.', {
          f2: 'Spindelkopf etwa 65 °C, Motor normal.',
          f4: 'Spindelkopf normal, Motorgehäuse etwa 95 °C, es riecht nach heißem Lack.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme der drei Phasen ablesen (Anzeige am Schaltschrank)', 'Alle drei Phasen zeigen den gleichen Wert, im Leerlauf etwa 3 A.', {
          f4: 'Zwei Phasen zeigen etwa 6 A, die dritte Phase zeigt 0 A.' }),
        st('vib', 'hoer', 'run', 3, 'Laufruhe am Spindelgehäuse mit der Hand fühlen (nicht an drehenden Teilen)', 'Gleichmäßiger, ruhiger Lauf, keine Vibration spürbar.', {
          f2: 'Deutliches Vibrieren und Schlagen am Spindelgehäuse.',
          f4: 'Fühlbares gleichmäßiges Brummen im Motorgehäuse.' }),
        st('riem', 'mess', 'safe', 4, 'Riemenspannung prüfen (Durchdrücken in der Mitte)', 'Der Riemen lässt sich etwa 1 cm eindrücken, das liegt im Sollbereich.', {
          f1: 'Der Riemen lässt sich über 4 cm eindrücken, weit über dem Sollmaß.' }),
        st('riemsicht', 'sicht', 'safe', 4, 'Riemen und Riemenscheiben ansehen', 'Riemen und Scheiben unauffällig.', {
          f1: 'Die Riemenflanken glänzen glasig, die Scheibenrillen sind blank poliert, im Gehäuse liegt feiner schwarzer Abrieb.' }),
        st('spiel', 'mess', 'safe', 8, 'Radialspiel der Spindel mit der Messuhr prüfen (am Bohrfutter)', 'Radialspiel kleiner als 0,02 mm, im Sollbereich.', {
          f2: 'Radialspiel etwa 0,25 mm, weit über dem Sollwert.' }),
        st('lager', 'hoer', 'safe', 3, 'Spindel von Hand drehen (Lagerlauf fühlen)', 'Die Spindel dreht leicht und gleichmäßig.', {
          f2: 'Die Spindel dreht rau und mit spürbarem Spiel, beim Rütteln klappert sie leicht.' }),
        st('werk', 'sicht', 'safe', 3, 'Bohrer prüfen (Schneiden, Anschliff)', 'Schneiden scharf, Anschliff symmetrisch.', {
          f3: 'Die Schneiden sind abgerundet und ausgebrochen, der Anschliff ist ungleich, die Schneidenecken sind blau angelaufen.' }),
        st('futter', 'mess', 'safe', 5, 'Bohrfutter und Aufnahme auf Rundlauf prüfen', 'Rundlauf in Ordnung, das Futter spannt fest.')] },

    /* ---------- 2 Kreiselpumpe ---------- */
    { id: 'pumpe', title: 'Kreiselpumpe fördert zu wenig', machine: 'Kreiselpumpe mit Drehstrommotor', level: 2, rate: 60,
      flow: ['Motor', 'Pumpe mit Laufrad', 'Druckleitung', 'Saugleitung mit Filter'],
      residual: { label: 'Schieber schließen und Restdruck in der Leitung ablassen', done: 'Saug- und druckseitiger Schieber sind geschlossen, der Restdruck ist abgelassen.' },
      intro: 'Eine Kreiselpumpe der Wasserversorgung fördert weniger als sonst. Sie läuft. Die Instandhaltung soll die Ursache finden.',
      symptoms: ['Der Förderstrom ist deutlich zu gering.', 'Der Druck auf der Druckseite liegt unter dem Sollwert von 4 bar.', 'Der Motor läuft, die Pumpe klingt auffällig.'],
      tips: ['Vergleiche Saugseite und Druckseite: Ein Unterdruck-Messgerät und ein Manometer sagen viel über den Weg des Wassers.',
        'Es kommen die Saugseite, die Pumpe selbst und der Antrieb infrage. Nach Arbeiten am Motor oder an Leitungen immer an den Einbauzustand denken.'],
      faults: [
        fl('f1', 'Saugfilter zugesetzt (Kavitation)', ['Kavitation', 'zugesetzt', 'verstopft'], 'Das Sieb im Saugfilter ist mit Schlamm belegt. Die Pumpe saugt gegen einen hohen Unterdruck, das Wasser verdampft in der Pumpe (Kavitation), es rasselt und die Förderung sinkt.', 'Saugfilter reinigen, Leitung prüfen und Reinigungsintervall festlegen', 'Filter in den Wartungsplan aufnehmen, Unterdruck am Vakuummeter regelmäßig ablesen (zustandsabhängig).'),
        fl('f2', 'Saugleitung undicht (Luft wird angesaugt)', ['undicht', 'Luft wird', 'Falschluft'], 'Am Saugflansch dringt Luft ein. Die Pumpe fördert ein Luft-Wasser-Gemisch, der Druck schwankt, es gurgelt.', 'Flanschdichtung erneuern, Schrauben nach Plan anziehen, Dichtheit prüfen', 'Nach jedem Arbeiten an der Saugleitung Dichtheit prüfen, Dichtungen nur einmal verwenden.'),
        fl('f3', 'Laufrad verschlissen', ['verschlissen', 'Spaltverschleiß'], 'Die Schaufeln des Laufrads sind abgetragen, der Spalt zum Gehäuse ist zu groß. Die Pumpe erreicht Förderstrom und Druck nicht mehr.', 'Laufrad und Spaltring erneuern', 'Zustandsüberwachung über Druck- und Stromaufnahme-Trend, Förderstrom regelmäßig messen.'),
        fl('f4', 'Drehrichtung falsch (Motor falsch angeschlossen)', ['Drehrichtung falsch', 'falsche Drehrichtung', 'vertauscht'], 'Nach dem Motortausch wurden zwei Außenleiter vertauscht, der Motor dreht entgegen dem Richtungspfeil. Das Laufrad fördert rückwärts schlecht, Druck und Strom sind niedrig.', 'Zwei Außenleiter durch die Elektrofachkraft tauschen lassen, danach Drehrichtung prüfen', 'Nach jedem Motoranschluss die Drehrichtung vor dem ersten Dauerlauf prüfen und dokumentieren.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Pumpe fördere schon seit einiger Zeit weniger, genau wisse er es nicht.', {
          f1: 'Der Bediener sagt: Gestern wurde Schlamm aus dem Behälter gepumpt, seitdem rasselt die Pumpe und fördert wenig.',
          f2: 'Der Bediener sagt: Seit dem Leitungswechsel am Montag gurgelt die Pumpe und der Druck schwankt.',
          f4: 'Der Bediener sagt: Nach dem Motortausch gestern läuft die Pumpe leise, fördert aber kaum.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Pumpe zuletzt vor drei Monaten inspiziert, ohne Befund.', {
          f2: 'Eintrag: Saugleitung vor einer Woche teilweise erneuert.',
          f4: 'Eintrag: Motor vor einem Tag getauscht, Klemmenkasten neu angeschlossen.' }),
        st('hoer', 'hoer', 'run', 2, 'Pumpe anhören', 'Gleichmäßiges Laufgeräusch ohne Auffälligkeit.', { f1: 'Unruhiges Geräusch: lautes Rasseln und Gurgeln im Wechsel.', f2: 'Unruhiges Geräusch: lautes Rasseln und Gurgeln im Wechsel.' }),
        st('vak', 'mess', 'run', 3, 'Unterdruck auf der Saugseite ablesen (Vakuummeter)', 'Unterdruck gering, etwa −0,1 bar.', {
          f1: 'Unterdruck sehr hoch, etwa −0,7 bar.',
          f2: 'Der Zeiger schwankt stark um −0,2 bar.' }),
        st('druck', 'mess', 'run', 3, 'Druck auf der Druckseite ablesen (Manometer)', 'Etwa 4 bar, das entspricht dem Sollwert.', {
          f1: 'Deutlich zu niedrig, etwa 2 bar.', f3: 'Deutlich zu niedrig, etwa 2 bar.',
          f2: 'Schwankt zwischen 1 und 3 bar.',
          f4: 'Kaum Druck, weniger als 1 bar.' }),
        st('fluss', 'mess', 'run', 4, 'Förderstrom ablesen (Durchflussanzeige)', 'Förderstrom im Sollbereich.', {
          f1: 'Förderstrom deutlich zu gering.', f2: 'Förderstrom deutlich zu gering.', f3: 'Förderstrom deutlich zu gering.',
          f4: 'Förderstrom sehr gering, fast null.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Motors ablesen (Anzeige)', 'Stromaufnahme im Bereich des Nennstroms.', {
          f1: 'Stromaufnahme niedrig (unter 75 % des Nennstroms).', f3: 'Stromaufnahme niedrig (unter 75 % des Nennstroms).', f4: 'Stromaufnahme niedrig (unter 75 % des Nennstroms).',
          f2: 'Stromaufnahme niedrig und schwankend.' }),
        st('dreh', 'mess', 'run', 3, 'Drehrichtung am Lüfterrad mit dem Richtungspfeil vergleichen', 'Das Lüfterrad dreht in Pfeilrichtung.', {
          f4: 'Das Lüfterrad dreht entgegen dem Pfeil.' }),
        st('filter', 'sicht', 'safe', 4, 'Saugfilter ausbauen und ansehen', 'Filter sauber, das Sieb ist frei.', {
          f1: 'Das Sieb ist fast vollständig mit Schlamm belegt.' }),
        st('saugl', 'sicht', 'safe', 5, 'Saugleitung auf Dichtheit prüfen (Flansche, Verschraubungen)', 'Alle Verbindungen dicht, Dichtungen unauffällig.', {
          f2: 'Am Saugflansch sitzt die Dichtung schief, eine Schraube ist locker; beim Bestreichen mit Seifenlauge entstehen Blasen.' }),
        st('lauf', 'sicht', 'safe', 20, 'Pumpengehäuse öffnen und Laufrad prüfen', 'Laufrad und Gehäuse unauffällig.', {
          f3: 'Die Schaufeln sind stark abgetragen, zwischen Laufrad und Gehäuse klafft ein großer Spalt.' }),
        st('schieber', 'doc', 'any', 2, 'Stellung der Absperrschieber prüfen (saug- und druckseitig)', 'Beide Schieber sind voll geöffnet.')] },

    /* ---------- 3 Förderband ---------- */
    { id: 'band', title: 'Förderband steht unter Last', machine: 'Förderband mit Riementrieb und Getriebe', level: 2, rate: 80,
      flow: ['Motor', 'Riementrieb', 'Getriebe', 'Antriebstrommel', 'Umlenktrommel'],
      residual: { label: 'Bandspannung entlasten, Band gegen Anlaufen und Zurücklaufen sichern', done: 'Bandspannung ist entlastet, das Band ist gegen Bewegung gesichert.' },
      intro: 'Ein Förderband in der Montage fördert nicht richtig. Der Motor ist eingeschaltet. Du sollst die Ursache finden.',
      symptoms: ['Das Band fördert nicht oder bleibt unter Last stehen.', 'Der Motor läuft oder brummt.', 'Der Antrieb wirkt unruhig.'],
      tips: ['Folge dem Antriebsstrang vom Motor bis zur Trommel. Der Vergleich der Drehzahlen an mehreren Stellen zeigt, wo die Kraft verloren geht.',
        'Es kommen der Riementrieb, die Lagerung der Umlenkung, die Welle-Nabe-Verbindung und das Fördergut selbst infrage. Die Stromaufnahme hilft, Überlast von Leerlauf zu trennen.'],
      faults: [
        fl('f1', 'Antriebsriemen rutscht (Spannung zu gering)', ['rutscht', 'Schlupf', 'zu gering'], 'Die Riemenspannung ist zu gering, der Riemen rutscht auf den Scheiben und überträgt das Moment nicht. Die Flanken verglasen und der Riemen wird rissig.', 'Riemen erneuern und auf Sollspannung bringen', 'Riemenspannung im Wartungsplan, Spannvorrichtung prüfen, Riemen nach Plan tauschen.'),
        fl('f2', 'Lager der Umlenktrommel festgelaufen', ['festgelaufen', 'festgefressen', 'Lagerschaden'], 'Die Lager der Umlenktrommel sind ohne Schmierung gelaufen und heiß geworden, die Trommel dreht schwer. Der Antrieb muss gegen diese Bremse arbeiten, der Strom steigt.', 'Lager der Umlenktrommel erneuern, Lagerstelle schmieren und Schmierplan ergänzen', 'Umlenkstation in den Schmierplan aufnehmen, Lagertemperatur regelmäßig messen.'),
        fl('f3', 'Passfeder der Antriebstrommel abgeschert', ['abgeschert', 'Passfeder'], 'Die Passfeder zwischen Getriebewelle und Antriebstrommel ist abgeschert. Der Motor und das Getriebe laufen leer, die Trommel steht.', 'Passfeder und beschädigte Nut ersetzen bzw. instandsetzen, Ursache der Überlast klären', 'Überlastschutz (Rutschkupplung, Strommessung) prüfen, Welle-Nabe-Verbindungen beim Inspektionsrundgang kontrollieren.'),
        fl('f4', 'Fördergut klemmt am Abstreifer', ['klemmt', 'eingeklemmt', 'verklemmt'], 'Folie und Schüttgut haben sich zwischen Band und Abstreifer festgesetzt. Das Band wird gebremst, der Motor wird überlastet, der Motorschutz spricht an.', 'Fremdkörper entfernen, Abstreifer einstellen und Aufgabestelle sichern', 'Aufgabe von Fremdkörpern vermeiden, Abstreifer regelmäßig kontrollieren und einstellen.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Das Band habe heute Morgen angefangen zu spinnen.', {
          f1: 'Der Bediener sagt: Das Band blieb bei voller Beladung stehen, kurz vorher hat es gequietscht.',
          f2: 'Der Bediener sagt: Seit Tagen ein Heulen am Bandende, das Band läuft schwer.',
          f3: 'Der Bediener sagt: Plötzlich knackte es im Antrieb, danach lief der Motor, aber das Band stand.',
          f4: 'Der Bediener sagt: Es wurde Schüttgut mit Folienresten aufgegeben, das Band blieb mit einem Ruck stehen.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Letzte Inspektion ohne Befund.', {
          f1: 'Eintrag: Riemenspannung zuletzt vor einem Jahr geprüft.',
          f2: 'Eintrag: Umlenkstation zuletzt vor zwei Jahren geschmiert.' }),
        st('hoer', 'hoer', 'run', 2, 'Antrieb im Betrieb anhören', 'Motor und Getriebe laufen gleichmäßig.', { f1: 'Unruhige Laufgeräusche am Antrieb: Quietschen und Knirschen, besonders beim Anfahren.', f4: 'Unruhige Laufgeräusche am Antrieb: Quietschen und Knirschen, besonders beim Anfahren.', f2: 'Heulendes Schleifen am Bandende.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Motors ablesen (Anzeige)', 'Stromaufnahme im Bereich des Nennstroms.', { f1: 'Stromaufnahme niedrig (unter 75 % des Nennstroms).', f3: 'Stromaufnahme niedrig (unter 75 % des Nennstroms).', f2: 'Stromaufnahme erhöht (über dem Nennstrom), der Motor wird warm.', f4: 'Stromaufnahme erhöht (über dem Nennstrom), der Motor wird warm.' }),
        st('drz', 'mess', 'run', 4, 'Drehzahlen vergleichen (Markierung, Handtachometer: Motor, Getriebeeingang, Antriebstrommel)', 'Alle Drehzahlen passen zur Übersetzung.', { f1: 'Die Antriebstrommel dreht, aber deutlich langsamer als nach der Übersetzung zu erwarten wäre.', f2: 'Die Antriebstrommel dreht, aber deutlich langsamer als nach der Übersetzung zu erwarten wäre.', f3: 'Die Antriebstrommel steht oder dreht nur ruckweise.', f4: 'Die Antriebstrommel steht oder dreht nur ruckweise.' }),
        st('temp', 'mess', 'run', 3, 'Lagertemperatur an der Umlenkstation messen (Infrarotthermometer)', 'Lager etwa 40 °C, normal.', {
          f2: 'Lager etwa 95 °C, zu heiß für die Handberührung.' }),
        st('spann', 'mess', 'safe', 4, 'Riemenspannung prüfen (Durchdrücken)', 'Durchdrückmaß im Sollbereich.', {
          f1: 'Der Riemen lässt sich weit über das Sollmaß durchdrücken.' }),
        st('riemsicht', 'sicht', 'safe', 3, 'Riemen und Scheiben ansehen', 'Riemen und Scheiben ohne Auffälligkeit.', {
          f1: 'Die Flanken glänzen glasig, der Riemenrücken ist rissig.' }),
        st('tromm', 'hoer', 'safe', 3, 'Umlenktrommel von Hand drehen', 'Die Trommel dreht leicht.', {
          f2: 'Die Trommel dreht schwer und rau, sie ist kaum zu bewegen.' }),
        st('welle', 'sicht', 'safe', 10, 'Welle-Nabe-Verbindung der Antriebstrommel prüfen', 'Die Verbindung sitzt fest, kein Spiel.', {
          f3: 'Die Welle lässt sich in der Nabe um etwa eine Viertelumdrehung verdrehen, an der Nutkante liegen Metallspäne.' }),
        st('abstr', 'sicht', 'safe', 3, 'Band und Abstreifer ansehen', 'Das Band läuft frei, der Abstreifer liegt locker an.', {
          f4: 'Zwischen Band und Abstreifer steckt ein Knäuel aus Folie und Schüttgut, das Band ist festgesetzt.' }),
        st('oel', 'mess', 'safe', 3, 'Ölstand am Getriebe prüfen', 'Ölstand zwischen den Markierungen.')] },

    /* ---------- 4 Pneumatikzylinder ---------- */
    { id: 'pneu', title: 'Pneumatikzylinder zieht nicht durch', machine: 'Pneumatik-Pressstation mit Wartungseinheit', level: 2, rate: 70,
      flow: ['Druckluftnetz', 'Wartungseinheit', 'Wegeventil', 'Drosselventil', 'Zylinder'],
      residual: { label: 'Restenergie abbauen: Druckluft absperren und Anlage entlüften', done: 'Das Absperrventil ist geschlossen, die Wartungseinheit ist entlüftet. Der Zylinder ist drucklos.' },
      intro: 'An einer Pressstation fährt der Pneumatikzylinder nicht mehr sauber aus. Die Station ist in Betrieb. Du sollst die Ursache finden.',
      symptoms: ['Der Zylinder fährt langsam aus und kommt nicht sauber in die Endlage.', 'Die Anlage taktet zu langsam.', 'Am Werkstück fehlt Kraft.'],
      tips: ['Verfolge den Druck vom Netz bis zum Zylinder. Vergleiche den Druck im Stillstand mit dem Druck während des Hubs.',
        'Der Fehler kann vor dem Ventil (Aufbereitung), an der Abluftseite (Drossel) oder im Zylinder selbst liegen. Zischende Geräusche an der Abluft sind ein Hinweis.'],
      faults: [
        fl('f1', 'Druckregler zu niedrig eingestellt', ['zu niedrig eingestellt', 'verstellt', 'heruntergedreht'], 'Der Druckregler der Wartungseinheit steht auf etwa 2,5 bar statt 6 bar. Der Zylinder bekommt zu wenig Druck, Kraft und Geschwindigkeit sind zu gering.', 'Druckregler auf den Sollwert einstellen und gegen Verstellen sichern (Plombe)', 'Solldruck an der Wartungseinheit markieren, Einstellung im Inspektionsrundgang kontrollieren.'),
        fl('f2', 'Filter der Wartungseinheit zugesetzt', ['zugesetzt', 'verstopft', 'verschmutzter Filter'], 'Das Filterelement ist durch Wasser, Öl und Schmutz zugesetzt. Im Stillstand zeigt der Regler 6 bar, beim Hub bricht der Druck ein, weil nicht genug Luft nachströmt.', 'Filterelement erneuern, Schale entleeren und Kondensat prüfen', 'Filterwechsel im Wartungsplan, Druckdifferenz oder Sichtprüfung der Filterschale regelmäßig kontrollieren.'),
        fl('f3', 'Abluftdrossel zu weit geschlossen', ['zu weit geschlossen', 'zugedreht', 'zugedrosselt'], 'Die Abluftdrossel ist fast geschlossen. Auf der Abluftseite staut sich Druck, der Kolben fährt langsam gegen diesen Gegendruck, die Hubzeit steigt.', 'Drossel auf die Soll-Geschwindigkeit einstellen und Einstellung kontern', 'Einstellungen nach Umrüstungen dokumentieren, Drosselschrauben sichern.'),
        fl('f4', 'Kolbendichtung verschlissen (Leckage im Zylinder)', ['verschlissen', 'Kolbendichtung defekt', 'Leckage im Zylinder'], 'Die Kolbendichtung lässt Luft am Kolben vorbei in die Gegenkammer strömen. Der Druck baut sich nicht auf, die Luft entweicht dauernd an der Abluft.', 'Zylinder abbauen und Dichtsatz erneuern, Kolbenstange und Lauffläche prüfen', 'Dichtungen nach Hubzahl bzw. zustandsabhängig tauschen, saubere und geölte bzw. fettfreie Druckluft nach Herstellerangabe.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Station sei „irgendwie schwach“ geworden.', {
          f1: 'Der Bediener sagt: Er habe vor kurzem „an der Wartungseinheit gedreht“, um Luft zu sparen.',
          f2: 'Der Bediener sagt: Das Netz führte tagelang Wasser und Öl mit, seitdem wird es immer schlechter.',
          f3: 'Der Bediener sagt: Nach der Umrüstung ist der Zylinder viel langsamer.',
          f4: 'Der Bediener sagt: Der Zylinder hat schon über eine Million Hübe, in letzter Zeit zischt es an der Anlage.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Wartungseinheit nach Plan geprüft.', {
          f2: 'Eintrag: Filterelement zuletzt vor zwei Jahren gewechselt.',
          f3: 'Eintrag: Anlage vor einer Woche umgerüstet, Einstellungen nicht dokumentiert.',
          f4: 'Eintrag: Zylinder seit der Inbetriebnahme nicht überholt.' }),
        st('hoer', 'hoer', 'run', 2, 'Anlage anhören', 'Kein auffälliges Geräusch.', { f3: 'Ein Zischen oder Pfeifen an der Abluft ist zu hören.', f4: 'Ein Zischen oder Pfeifen an der Abluft ist zu hören.' }),
        st('netz', 'mess', 'run', 3, 'Netzdruck vor der Wartungseinheit ablesen', 'Netzdruck 6 bar, wie Sollwert.'),
        st('reg', 'mess', 'run', 3, 'Druck nach der Wartungseinheit im Stillstand ablesen', 'Ausgangsdruck 6 bar, wie Sollwert.', {
          f1: 'Ausgangsdruck nur 2,5 bar.' }),
        st('reghub', 'mess', 'run', 4, 'Druck nach der Wartungseinheit während des Hubs ablesen', 'Ausgangsdruck bleibt bei 6 bar.', { f1: 'Der Ausgangsdruck ist während des Hubs deutlich zu niedrig (unter 4 bar).', f2: 'Der Ausgangsdruck ist während des Hubs deutlich zu niedrig (unter 4 bar).' }),
        st('zyl', 'mess', 'run', 4, 'Druck an den Zylinderanschlüssen ablesen (Antriebsseite und Abluftseite)', 'Antriebsseite 6 bar, kein nennenswerter Gegendruck.', { f1: 'Antriebsseite deutlich zu niedrig (unter 4 bar), kein nennenswerter Gegendruck.', f2: 'Antriebsseite deutlich zu niedrig (unter 4 bar), kein nennenswerter Gegendruck.', f3: 'Antriebsseite 6 bar, aber hoher Gegendruck (etwa 3 bar) auf der Abluftseite.', f4: 'Antriebsseite fällt während des Hubs ab, kein Gegendruck.' }),
        st('hubz', 'mess', 'run', 3, 'Hubzeit stoppen', 'Hubzeit im Sollbereich.', {
          f1: 'Hubzeit etwa dreimal so lang wie der Sollwert.', f2: 'Hubzeit etwa dreimal so lang wie der Sollwert.',
          f3: 'Hubzeit etwa dreimal so lang wie der Sollwert.', f4: 'Hubzeit etwa dreimal so lang wie der Sollwert.' }),
        st('abl', 'sicht', 'run', 2, 'Abluft am Ventil in der Endlage prüfen (Luftaustritt)', 'Die Abluft verstummt nach dem Hub.', {
          f4: 'Auch in der Endlage strömt dauernd Luft aus dem Abluftanschluss.' }),
        st('schale', 'sicht', 'safe', 3, 'Filterschale und Filterelement ansehen', 'Filter sauber.', {
          f2: 'Die Schale enthält Wasser-Öl-Schlamm, das Element ist dunkel verschmutzt.' }),
        st('drossel', 'sicht', 'safe', 2, 'Stellung der Drosselschraube prüfen', 'Die Drossel ist etwa halb geöffnet (Grundeinstellung).', {
          f3: 'Die Drossel ist fast vollständig geschlossen.' }),
        st('hand', 'hoer', 'safe', 3, 'Kolbenstange drucklos von Hand bewegen', 'Die Stange läuft leicht und gleichmäßig.')] },

    /* ---------- 5 Getriebe mit Geräusch ---------- */
    { id: 'getriebe', title: 'Getriebe mit Geräusch', machine: 'Stirnradgetriebe an einer Antriebsstation', level: 3, rate: 90,
      flow: ['Motor', 'Kupplung', 'Eingangswelle mit Lager', 'Zahnräder im Ölbad', 'Abtriebswelle'],
      residual: { label: 'Nachlauf abwarten und Abtrieb gegen Mitdrehen sichern', done: 'Der Antrieb steht, der Abtrieb ist gegen Mitdrehen gesichert.' },
      intro: 'Ein Stirnradgetriebe an der Antriebsstation macht Geräusche. Die Station läuft. Die Instandhaltung soll die Ursache finden, bevor ein Folgeschaden entsteht.',
      symptoms: ['Das Getriebe klingt lauter als sonst.', 'Das Gehäuse ist wärmer als gewohnt.', 'Die Station vibriert leicht.'],
      tips: ['Das Geräusch ist ein Hinweis: Notiere, ob es gleichmäßig, im Takt der Drehzahl oder unregelmäßig ist, und vergleiche es mit Schwingungsmessung und Temperatur.',
        'Es kommen der Schmierstoffhaushalt, die Verzahnung, die Lager und die Ausrichtung zum Antrieb infrage. Die Ölprobe liefert viel Information für wenig Zeit.'],
      faults: [
        fl('f1', 'Ölmangel im Getriebe (Ölstand zu niedrig)', ['Ölmangel', 'Ölstand zu niedrig', 'Mangelschmierung'], 'Aus einem undichten Wellendichtring ist Öl ausgelaufen. Die Verzahnung und die Lager laufen mit zu wenig Schmierstoff, das Gehäuse wird heiß, das Öl verbrennt.', 'Wellendichtring tauschen, Öl nachfüllen bzw. wechseln und Ölstand kontrollieren', 'Ölstand im Inspektionsrundgang, Wellendichtringe nach Plan prüfen, Ölwechselintervall einhalten.'),
        fl('f2', 'Zahnflanken mit Grübchenbildung', ['Grübchen', 'Pitting', 'Ermüdung'], 'Die Zahnflanken sind durch hohe Flankenpressung ermüdet. Kleine muschelförmige Ausbrüche entstehen, das Getriebe knattert im Takt des Zahneingriffs.', 'Zahnräder erneuern, Belastung und Schmierung prüfen, Öl wechseln', 'Zustandsüberwachung durch Ölanalyse und Schwingungsmessung, Überlast vermeiden, Schmierstoff nach Vorschrift.'),
        fl('f3', 'Wälzlager der Eingangswelle beschädigt', ['Lagerschaden', 'beschädigt', 'Wälzlagerschaden'], 'Das Wälzlager der Eingangswelle hat Schäden auf den Laufbahnen. Es rumpelt drehzahlabhängig, das Lager läuft warm, im Öl und am Magnet sammelt sich grober Abrieb.', 'Wälzlager der Eingangswelle erneuern, Welle und Sitz prüfen', 'Schwingungsmessung (Hüllkurve) in den Prüfplan, Lagertemperatur überwachen, Schmierung einhalten.'),
        fl('f4', 'Fluchtfehler zwischen Motor und Getriebe', ['Fluchtfehler', 'nicht fluchtend', 'Wellenversatz'], 'Nach dem Motortausch wurden Motor und Getriebe nicht sauber ausgerichtet. Der Versatz belastet Kupplung und Lager, es schlägt im Takt der Drehung, die Wellendichtringe sind gestört.', 'Motor und Getriebe mit Messuhr bzw. Laser ausrichten, Kupplung und Wellendichtring prüfen', 'Nach jedem Motorwechsel Ausrichtung messen und protokollieren.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Das Getriebe sei „seit einiger Zeit lauter“.', {
          f1: 'Der Bediener sagt: Er sehe seit Tagen Ölflecken unter dem Getriebe.',
          f2: 'Der Bediener sagt: Seit Wochen ein knatterndes Geräusch, das mit der Drehzahl schneller wird.',
          f3: 'Der Bediener sagt: Seit kurzem ein Brummen und Rumpeln, das mit der Drehzahl zunimmt, sonst sei alles wie immer.',
          f4: 'Der Bediener sagt: Nach dem Motortausch vor zwei Wochen läuft das Getriebe unruhig.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Ölwechsel nach Plan, ohne Befund.', {
          f1: 'Eintrag: Ölstand zuletzt vor einem halben Jahr geprüft.',
          f4: 'Eintrag: Motor vor zwei Wochen getauscht, Ausrichtung nicht dokumentiert.' }),
        st('hoer', 'hoer', 'run', 2, 'Geräusch des Getriebes anhören', 'Gleichmäßiges Laufgeräusch.', { f1: 'Lautes, hochfrequentes Geräusch (Heulen oder Knattern).', f2: 'Lautes, hochfrequentes Geräusch (Heulen oder Knattern).', f3: 'Tiefes Brummen und Rumpeln, das mit der Drehzahl zunimmt.', f4: 'Tiefes Brummen und Rumpeln, das mit der Drehzahl zunimmt.' }),
        st('temp', 'mess', 'run', 3, 'Gehäusetemperatur messen (Infrarotthermometer)', 'Gehäuse etwa 50 °C, normal.', { f1: 'Gehäuse sehr heiß, etwa 85 °C.', f2: 'Gehäuse etwa 60 °C, leicht erhöht.', f3: 'Gehäuse etwa 60 °C, leicht erhöht.', f4: 'Gehäuse etwa 60 °C, leicht erhöht.' }),
        st('vib', 'mess', 'run', 5, 'Schwingungen messen (Handmessgerät, Spektrum)', 'Schwingstärke im grünen Bereich.', { f1: 'Schwingstärke erhöht, die Ursache ist im Spektrum nicht eindeutig zu erkennen.', f2: 'Schwingstärke erhöht, die Ursache ist im Spektrum nicht eindeutig zu erkennen.', f3: 'Schwingstärke deutlich erhöht, Spitzen bei Dreh- und Lagerfrequenzen.', f4: 'Schwingstärke deutlich erhöht, Spitzen bei Dreh- und Lagerfrequenzen.' }),
        st('oelst', 'sicht', 'any', 2, 'Ölstand am Schauglas ablesen', 'Ölstand in Ordnung.', {
          f1: 'Das Schauglas ist leer, der Ölstand liegt unter der Minimum-Marke.' }),
        st('oelzu', 'mess', 'safe', 5, 'Ölprobe entnehmen und beurteilen', 'Öl klar und goldgelb.', { f1: 'Öl dunkel und dünn, es riecht verbrannt.', f2: 'Das Öl enthält glitzernde Metallpartikel, teils fein, teils grob.', f3: 'Das Öl enthält glitzernde Metallpartikel, teils fein, teils grob.' }),
        st('magnet', 'mess', 'safe', 4, 'Magnetschraube am Ölablass prüfen', 'Nur wenig feiner Abrieb.', { f2: 'Deutlicher Abrieb am Magneten: kleine Plättchen und Späne.', f3: 'Deutlicher Abrieb am Magneten: kleine Plättchen und Späne.' }),
        st('leck', 'sicht', 'any', 2, 'Gehäuse und Wellendurchtritte auf Ölaustritt ansehen', 'Gehäuse trocken, kein Ölaustritt.', {
          f1: 'Ölspur unter dem Abtriebswellen-Dichtring, Tropfen am Boden.',
          f4: 'Ölschleier am eingangsseitigen Wellendichtring.' }),
        st('ausr', 'mess', 'safe', 12, 'Ausrichtung der Kupplung prüfen (Messuhr bzw. Lineal)', 'Versatz und Winkelfehler im Toleranzbereich.', {
          f4: 'Die Wellenmitten liegen etwa 0,4 mm versetzt, dazu kommt ein deutlicher Winkelfehler.' }),
        st('hand', 'hoer', 'safe', 3, 'Eingangswelle von Hand drehen und bewegen', 'Die Welle läuft leicht und gleichmäßig, kein Spiel.', { f3: 'Die Welle läuft rau und lässt sich radial deutlich bewegen.' }),
        st('flank', 'sicht', 'safe', 15, 'Inspektionsdeckel öffnen und Zahnflanken ansehen', 'Zahnflanken blank, gleichmäßiges Tragbild.', {
          f1: 'Flanken matt, erste Anlauffarben.',
          f2: 'Kleine muschelförmige Ausbrüche auf den Flanken mehrerer Zähne.' }),
        st('schr', 'mess', 'safe', 4, 'Befestigung am Fundament prüfen', 'Schrauben fest.')] },

    /* ---------- 6 Spindellager läuft heiß ---------- */
    { id: 'spindel', title: 'Spindellager läuft heiß', machine: 'Hauptspindel einer Fräsmaschine', level: 3, rate: 110,
      flow: ['Hauptmotor', 'Riemen', 'Spindel', 'Spindellager', 'Labyrinthdichtung'],
      residual: { label: 'Spindelnachlauf abwarten (Schwungmasse), Spindel gegen Drehen sichern', done: 'Die Spindel steht und ist gegen Drehen gesichert.' },
      intro: 'Bei einer Fräsmaschine wird der Spindelkopf auffällig heiß. Die Maschine läuft im Leerlauf. Du sollst die Ursache am Spindellager finden.',
      symptoms: ['Der Spindelkopf wird nach kurzer Laufzeit sehr warm.', 'Die Spindel läuft nicht mehr so ruhig wie früher.', 'Die Maschine ist sonst unauffällig.'],
      tips: ['Der Temperaturverlauf über die Zeit ist ein starker Hinweis. Steigt er dauernd an oder pendelt er sich ein?',
        'Betrachte Schmierstoffmenge, Zustand des Schmierstoffs, Einstellung des Lagers und die Abdichtung. Das Wartungsbuch nennt oft die letzte Arbeit an der Spindel.'],
      faults: [
        fl('f1', 'Lager überfettet (zu viel Fett im Lagerraum)', ['überfettet', 'zu viel Fett', 'Überfettung'], 'Beim Nachschmieren wurde zu viel Fett eingepresst. Das Fett wird im Lager gewalkt und erwärmt sich, anfangs steigt die Temperatur stark. Überschüssiges Fett tritt aus dem Labyrinth aus.', 'Überschüssiges Fett entfernen, Lager mit der vorgeschriebenen Menge neu füllen und einlaufen lassen', 'Fettmenge im Schmierplan festlegen und einhalten, nicht „nach Gefühl“ nachschmieren.'),
        fl('f2', 'Fettmangel im Spindellager', ['Fettmangel', 'Schmierungsmangel', 'Trockenlauf'], 'Das Lager wurde seit Jahren nicht nachgeschmiert. Das Fett ist verhärtet und trocken, das Lager läuft im Mischreibungsgebiet, pfeift und wird immer heißer.', 'Spindellager prüfen, bei Schaden tauschen, neu fetten und Schmierintervall einhalten', 'Schmierplan einhalten und überwachen, Fälligkeiten im Wartungsplan sichtbar machen.'),
        fl('f3', 'Lagervorspannung zu hoch eingestellt', ['Vorspannung zu hoch', 'zu hoch eingestellt', 'zu fest angezogen'], 'Beim Nachstellen wurde die Lagermutter zu fest angezogen. Die Vorspannung ist zu hoch, die Reibung steigt, das Lager wird schnell und dauerhaft heiß.', 'Vorspannung nach Herstellerangabe neu einstellen (Anzugsmoment), Lager auf Schäden prüfen', 'Nachstellarbeiten nur mit Sollwerten und Drehmomentschlüssel durchführen und protokollieren.'),
        fl('f4', 'Kühlschmierstoff im Lager (Dichtung defekt)', ['Dichtung defekt', 'Kühlschmierstoff im Lager', 'Wassereintritt'], 'Das Labyrinth an der Spindelnase ist verbogen, Kühlschmierstoff dringt ein. Das Fett wird ausgewaschen und verschmutzt, das Lager läuft rau und wird heiß.', 'Dichtung instandsetzen, Lager reinigen oder tauschen, neu fetten', 'Abdichtung in die Inspektion aufnehmen, Kühlmittelstrahl nicht auf die Spindelnase richten.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Spindel werde seit einiger Zeit heiß.', {
          f1: 'Der Bediener sagt: Vor einigen Tagen wurde kräftig nachgeschmiert, seitdem wird die Spindel schnell heiß.',
          f2: 'Der Bediener sagt: Die Spindel wird seit Wochen immer heißer und pfeift.',
          f3: 'Der Bediener sagt: Seit der Lagereinstellung letzte Woche wird die Spindel nach kurzer Laufzeit heiß.',
          f4: 'Der Bediener sagt: Kühlmittel spritzt oft an die Spindelnase, die Spindel wird seit Tagen heißer und rauer.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Schmierung und Einstellung nach Plan.', {
          f1: 'Eintrag: Nachschmierung vor wenigen Tagen, Menge nicht notiert.',
          f2: 'Eintrag: Letzte Schmierung vor drei Jahren, weit überfällig.',
          f3: 'Eintrag: Lagervorspannung vor einer Woche nachgestellt.',
          f4: 'Eintrag: Abdichtung der Spindelnase nicht im Wartungsplan.' }),
        st('tverl', 'mess', 'run', 4, 'Temperaturverlauf am Spindelkopf über 20 Minuten messen', 'Die Temperatur steigt langsam auf etwa 45 °C und bleibt dort.', {
          f1: 'Die Temperatur steigt schnell auf etwa 70 °C und sinkt nach etwa 30 Minuten wieder ab.',
          f2: 'Die Temperatur steigt stetig auf über 85 °C, ohne zu sinken.', f3: 'Die Temperatur steigt stetig auf über 85 °C, ohne zu sinken.',
          f4: 'Die Temperatur steigt stetig, nach 20 Minuten etwa 70 °C, ohne zu sinken.' }),
        st('hoer', 'hoer', 'run', 2, 'Spindel im Betrieb anhören', 'Gleichmäßiges, leises Laufgeräusch.', { f2: 'Raues Geräusch: Pfeifen, Zischen oder Knirschen aus dem Spindelkopf.', f4: 'Raues Geräusch: Pfeifen, Zischen oder Knirschen aus dem Spindelkopf.', f1: 'Gleichmäßiges, leises Rauschen und Heulen.', f3: 'Gleichmäßiges, leises Rauschen und Heulen.' }),
        st('vib', 'hoer', 'run', 3, 'Laufruhe am Spindelgehäuse mit der Hand fühlen (nicht an drehenden Teilen)', 'Laufruhe gut.', { f2: 'Erhöhte Vibration, körniges Rauschen.', f4: 'Erhöhte Vibration, körniges Rauschen.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Hauptmotors ablesen (Anzeige)', 'Stromaufnahme im Leerlauf normal.', {
          f1: 'Stromaufnahme leicht erhöht.', f4: 'Stromaufnahme leicht erhöht.',
          f3: 'Stromaufnahme deutlich erhöht.' }),
        st('austr', 'sicht', 'safe', 3, 'Spindelnase und Labyrinthdichtung auf Fettaustritt ansehen', 'Kein Fettaustritt.', {
          f1: 'Viel Fett ist aus dem Labyrinth ausgetreten, die Spindelnase ist fettverschmiert.' }),
        st('probe', 'mess', 'safe', 15, 'Fettprobe aus dem Lager entnehmen und beurteilen', 'Fett in normaler Menge, hellbraun und sauber.', { f1: 'Der Lagerraum ist bis oben gefüllt, das Fett ist sauber.', f2: 'Das Fett ist dunkel verfärbt, teils hart und trocken, teils ölig abgesondert.', f3: 'Das Fett ist dunkel verfärbt, teils hart und trocken, teils ölig abgesondert.', f4: 'Das Fett ist grau und milchig, mit feinen Partikeln.' }),
        st('dreh', 'hoer', 'safe', 4, 'Spindel von Hand drehen (Drehwiderstand und Lauf fühlen)', 'Die Spindel dreht leicht und gleichmäßig.', { f1: 'Die Spindel dreht gleichmäßig, aber zäh.', f2: 'Die Spindel dreht rau und kratzend.', f4: 'Die Spindel dreht rau und kratzend.', f3: 'Die Spindel dreht sehr schwer, ohne Spiel.' }),
        st('dicht', 'sicht', 'safe', 4, 'Dichtungen und Abdeckung der Spindelnase ansehen', 'Dichtungen intakt.', {
          f4: 'Der Labyrinthring ist verbogen, im Dichtbereich sind Kühlmittelspuren.' }),
        st('mutter', 'mess', 'safe', 6, 'Anzugsmoment der Lagermutter kontrollieren', 'Anzugsmoment im Sollbereich.', {
          f3: 'Das Anzugsmoment liegt weit über der Vorgabe.' }),
        st('riem', 'mess', 'safe', 4, 'Riemenspannung des Spindelantriebs prüfen', 'Riemenspannung im Sollbereich.')] },

    /* ---------- 7 Hydraulikpumpe laut ---------- */
    { id: 'hyd', title: 'Hydraulikpumpe laut', machine: 'Hydraulikaggregat einer Presse', level: 3, rate: 120,
      flow: ['Motor', 'Kupplung', 'Pumpe', 'Druckleitung zur Presse', 'Tank mit Saugfilter'],
      residual: { label: 'Restenergie abbauen: Druck ablassen, Speicher entlasten, Zylinder absenken bzw. abstützen', done: 'Druck abgelassen, Speicher entlastet, Presse abgestützt. Das Manometer steht auf 0 bar.' },
      intro: 'Das Hydraulikaggregat der Presse ist auffällig laut. Es läuft. Die Instandhaltung soll die Ursache finden.',
      symptoms: ['Die Pumpe ist deutlich lauter als gewohnt.', 'Die Presse arbeitet unsauber.', 'Das Aggregat läuft sonst.'],
      tips: ['Das Geräusch allein reicht nicht. Vergleiche Unterdruck an der Saugseite, Systemdruck, Öltemperatur und Zustand des Öls.',
        'Es kommen die Ölversorgung (Tank, Saugfilter), der Antrieb (Kupplung) und die Pumpe selbst infrage. Das Aggregat steht unter Druck: Eingriffe erst nach dem Abbau der Restenergie.'],
      faults: [
        fl('f1', 'Ölstand im Tank zu niedrig (Luft im Saugstrom)', ['Ölstand zu niedrig', 'Luft im Saugstrom', 'Ölmangel'], 'Durch eine undichte Verschraubung ist Öl verloren gegangen. Die Pumpe saugt Luft mit an, das Öl schäumt, es heult und gurgelt, der Druck schwankt.', 'Leckage beheben, Öl bis zur Marke auffüllen und Öl entlüften lassen', 'Ölstand täglich kontrollieren, Verschraubungen im Rundgang prüfen.'),
        fl('f2', 'Saugfilter verschmutzt', ['verschmutzt', 'zugesetzt', 'Kavitation'], 'Der Saugfilter ist mit Ölschlamm belegt. Die Pumpe saugt gegen einen hohen Unterdruck, es entsteht Kavitation mit hellem Heulen, die Fördermenge sinkt.', 'Saugfilter reinigen oder erneuern, Öl auf Alterung und Schmutz prüfen', 'Filterwechsel im Wartungsplan oder Wechsel nach Unterdruckanzeige, Ölanalyse in Intervallen.'),
        fl('f3', 'Pumpenkupplung verschlissen', ['verschlissen', 'Kupplungsverschleiß'], 'Der Elastomerkranz der Kupplung ist zerbröselt. Die Kupplungshälften schlagen gegeneinander, es klackert im Takt der Drehzahl.', 'Elastomerkranz erneuern, Ausrichtung prüfen', 'Kupplung nach Zeit tauschen, Ausrichtung regelmäßig messen.'),
        fl('f4', 'Pumpe innen verschlissen (zu hohe Leckverluste)', ['innen verschlissen', 'Leckverluste', 'Spaltverluste'], 'Im Inneren der Pumpe sind Zahnräder und Seitenplatten abgetragen. Es entsteht ein hoher innerer Leckstrom, der das Öl stark erwärmt, den Druck nicht mehr aufbauen lässt und Metallabrieb in den Kreislauf bringt.', 'Pumpe instandsetzen oder erneuern, Öl wechseln und Filter spülen', 'Ölreinheit überwachen, Druck- und Temperaturtrend beobachten (zustandsabhängig).')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Pumpe sei „schon länger laut“.', {
          f1: 'Der Bediener sagt: Der Ölstand sei schon länger knapp, nachgefüllt habe er nicht.',
          f2: 'Der Bediener sagt: Die Pumpe pfeift hell, seit der letzte Filterwechsel überfällig ist.',
          f3: 'Der Bediener sagt: Es klackert an der Pumpenglocke im Takt der Drehzahl.',
          f4: 'Der Bediener sagt: Die Zylinder werden langsamer und das Öl wird sehr heiß.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Letzte Inspektion ohne Befund.', {
          f1: 'Eintrag: Letzte Ölstandskontrolle vor vier Monaten.',
          f2: 'Eintrag: Filterwechsel seit zwei Jahren überfällig.',
          f3: 'Eintrag: Kupplung seit der Inbetriebnahme nicht geprüft.' }),
        st('hoer', 'hoer', 'run', 2, 'Pumpe anhören', 'Gleichmäßiges Pumpengeräusch.', { f1: 'Heulen und Gurgeln, unregelmäßig.', f2: 'Lautes, gleichmäßiges Heulen.', f4: 'Lautes, gleichmäßiges Heulen.', f3: 'Klackern und Rasseln im Takt der Drehzahl an der Pumpenglocke.' }),
        st('druck', 'mess', 'run', 3, 'Systemdruck ablesen (Manometer)', 'Systemdruck im Sollbereich.', { f1: 'Der Systemdruck schwankt.', f2: 'Der Systemdruck ist zu niedrig und fällt unter Last ab.', f4: 'Der Systemdruck ist zu niedrig und fällt unter Last ab.' }),
        st('temp', 'mess', 'run', 3, 'Öltemperatur ablesen', 'Öltemperatur normal, etwa 45 °C.', {
          f4: 'Öltemperatur sehr hoch, über 70 °C.' }),
        st('ostand', 'sicht', 'any', 2, 'Ölstand im Schauglas ablesen', 'Ölstand zwischen den Marken.', {
          f1: 'Ölstand unter der Minimum-Marke.' }),
        st('schaum', 'sicht', 'run', 2, 'Öl im Tank auf Schaum und Trübung ansehen', 'Öl klar, kein Schaum.', {
          f1: 'Das Öl ist trüb-milchig, im Tank bildet sich Schaum.' }),
        st('vak', 'mess', 'run', 3, 'Unterdruck an der Saugleitung ablesen', 'Unterdruck normal.', {
          f1: 'Der Unterdruck schwankt leicht.',
          f2: 'Der Unterdruck liegt weit über dem Grenzwert.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Motors ablesen (Anzeige)', 'Stromaufnahme im Normalbereich.', { f1: 'Die Stromaufnahme schwankt.', f4: 'Die Stromaufnahme ist hoch.' }),
        st('fluss', 'mess', 'run', 3, 'Geschwindigkeit der Presszylinder beurteilen', 'Zylindergeschwindigkeit normal.', {
          f1: 'Die Zylinder fahren zu langsam.', f2: 'Die Zylinder fahren zu langsam.', f4: 'Die Zylinder fahren zu langsam.' }),
        st('kuppl', 'sicht', 'safe', 5, 'Pumpenkupplung ansehen', 'Kupplung unauffällig.', {
          f3: 'Der Elastomerkranz ist zerbröselt, in der Pumpenglocke liegt Gummistaub.' }),
        st('spiel', 'mess', 'safe', 4, 'Drehspiel der Kupplungshälften prüfen', 'Das Drehspiel ist gering.', {
          f3: 'Das Drehspiel ist groß, die Kupplungshälften klappern gegeneinander.' }),
        st('rueck', 'mess', 'safe', 5, 'Rücklauffilter und Magnetabscheider prüfen', 'Rücklauffilter mit normaler Verschmutzung, Magnetabscheider fast sauber.', {
          f4: 'Der Magnetabscheider ist voller feiner Metallpartikel.' }),
        st('saugfil', 'sicht', 'safe', 8, 'Saugfilter ausbauen und ansehen', 'Saugfilter sauber.', {
          f2: 'Das Sieb ist voller Ölschlamm.' }),
        st('leck', 'sicht', 'any', 2, 'Leitungen und Tank auf Ölaustritt ansehen', 'Keine Ölspuren.', {
          f1: 'Ölspur an einer Verschraubung am Tank, Öl tropft.' })] },

    /* ---------- 8 Kühlmittelpumpe ---------- */
    { id: 'kuehl', title: 'Kühlmittelpumpe fördert nicht', machine: 'Kühlschmierstoff-Pumpe an einer Drehmaschine', level: 1, rate: 50,
      flow: ['Motor', 'Pumpe mit Laufrad', 'Schlauch und Düse', 'Behälter mit Saugkorb'],
      residual: null,
      intro: 'An der Drehmaschine kommt kein Kühlschmierstoff mehr an der Schneide an. Die Pumpe ist eingeschaltet. Du sollst die Ursache finden.',
      symptoms: ['An der Düse kommt kein oder kaum Kühlschmierstoff an.', 'Der Motor der Pumpe ist eingeschaltet.', 'Die Pumpe klingt anders als sonst.'],
      tips: ['Frage zuerst nach dem Weg des Kühlschmierstoffs: Behälter, Saugkorb, Pumpe, Schlauch, Düse. Die Stromaufnahme verrät, ob der Motor arbeitet.',
        'Bedenke, dass eine laufende Pumpe nicht automatisch fördert. Anzeigen am Schaltschrank (Motorschutz) und der Füllstand kosten wenig Zeit.'],
      faults: [
        fl('f1', 'Kühlschmierstoffbehälter zu leer (Pumpe saugt Luft)', ['zu leer', 'Behälter leer', 'Trockenlauf'], 'Der Füllstand ist durch Verdunsten und Verschleppen unter die Saugöffnung gefallen. Die Pumpe saugt Luft und fördert keinen Kühlschmierstoff.', 'Kühlschmierstoff auf den Sollstand auffüllen, Konzentration prüfen', 'Füllstand und Konzentration im Rundgang prüfen, Kühlmittelpflege im Wartungsplan.'),
        fl('f2', 'Saugkorb mit Spänen zugesetzt', ['zugesetzt', 'verstopft', 'Saugkorb belegt'], 'Späne und Schlamm haben den Saugkorb belegt. Die Pumpe bekommt kaum Medium, die Strahlmenge ist sehr gering.', 'Saugkorb reinigen, Spänefilter und Reinigungsintervall prüfen', 'Behälter und Saugkorb nach Plan reinigen, Späneabscheidung verbessern.'),
        fl('f3', 'Laufrad lose auf der Welle', ['Laufrad lose', 'lose auf der Welle', 'durchgerutscht'], 'Die Sicherung des Laufrads fehlt nach der Reparatur am Wochenende. Die Welle dreht durch, das Laufrad steht still, es wird nichts gefördert.', 'Laufrad mit neuer Sicherung (Passfeder bzw. Haltestift) befestigen und prüfen', 'Nach Reparaturen Montage prüfen und Probelauf protokollieren, Sicherungselemente nach Anleitung ersetzen.'),
        fl('f4', 'Pumpenwelle durch Späne blockiert', ['blockiert', 'Welle klemmt', 'festgeklemmt'], 'Späne sind zwischen Laufrad und Gehäuse geraten und blockieren die Welle. Der Motor kann nicht drehen, zieht Anlaufstrom und der Motorschutz löst aus.', 'Späne entfernen, Laufrad und Dichtung prüfen, Spänefilter verbessern', 'Spänefilter vor der Pumpe vorsehen, Saugkorb reinigen, Motorschutz nicht überbrücken.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Seit dem Frühstück kommt kein Kühlmittel mehr.', {
          f1: 'Der Bediener sagt: Es wird seit Tagen nur noch mit Spritzern gekühlt, nachgefüllt habe er nicht.',
          f2: 'Der Bediener sagt: Es wurde stark gespant, der Spänekorb sei voll gewesen.',
          f3: 'Der Bediener sagt: Die Pumpe lief nach der Reparatur am Wochenende, förderte aber nie richtig.',
          f4: 'Der Bediener sagt: Die Pumpe brummt und steht, dann schaltet der Motorschutz ab.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Kühlmittelpflege nach Plan.', {
          f1: 'Eintrag: Füllstand zuletzt vor zwei Wochen geprüft.',
          f3: 'Eintrag: Pumpe am Wochenende demontiert (Dichtung getauscht).' }),
        st('hoer', 'hoer', 'run', 2, 'Pumpe anhören', 'Der Motor läuft gleichmäßig.', { f1: 'Die Pumpe läuft mit dumpfem, trockenem Surren und leisem Rattern.', f2: 'Die Pumpe läuft mit dumpfem, trockenem Surren und leisem Rattern.', f3: 'Der Motor läuft gleichmäßig, aus dem Pumpenteil ist kein Strömungsgeräusch zu hören.', f4: 'Der Motor brummt, dreht aber nicht.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Motors ablesen (Anzeige)', 'Stromaufnahme im Normalbereich.', {
          f1: 'Stromaufnahme niedrig.', f2: 'Stromaufnahme niedrig.',
          f3: 'Stromaufnahme sehr niedrig, entspricht dem Leerlauf.',
          f4: 'Stromaufnahme sehr hoch, entspricht dem Anlaufstrom.' }),
        st('strahl', 'sicht', 'run', 2, 'Düse und Schlauchende auf den Strahl ansehen', 'Kräftiger Kühlmittelstrahl.', {
          f1: 'Nur Spritzer und Luft.',
          f2: 'Ein dünner, schwacher Strahl.',
          f3: 'Es kommt kein Kühlmittel.', f4: 'Es kommt kein Kühlmittel.' }),
        st('stand', 'sicht', 'any', 2, 'Füllstand im Behälter ablesen', 'Füllstand in Ordnung.', {
          f1: 'Der Behälter ist fast leer, der Saugkorb liegt frei.' }),
        st('mschutz', 'sicht', 'any', 2, 'Anzeige des Motorschutzes ablesen', 'Motorschutz nicht ausgelöst.', {
          f4: 'Der Motorschutz ist ausgelöst.' }),
        st('korb', 'sicht', 'safe', 3, 'Saugkorb ansehen', 'Saugkorb sauber.', {
          f2: 'Der Saugkorb ist vollständig mit Spänen und Schlamm belegt.' }),
        st('duese', 'mess', 'safe', 3, 'Düse und Schlauch auf Durchgang prüfen', 'Düse und Schlauch sind frei.'),
        st('hand', 'hoer', 'safe', 3, 'Lüfterrad am Motor von Hand drehen', 'Das Lüfterrad dreht leicht.', {
          f4: 'Das Lüfterrad lässt sich nicht drehen.' }),
        st('laufrad', 'sicht', 'safe', 15, 'Pumpengehäuse öffnen und Laufrad prüfen', 'Laufrad fest und unbeschädigt.', {
          f3: 'Das Laufrad dreht sich auf der Welle durch, die Sicherung fehlt.',
          f4: 'Späne sind zwischen Laufrad und Gehäuse eingeklemmt.' }),
        st('dreh', 'mess', 'run', 3, 'Drehrichtung am Lüfterrad mit dem Pfeil vergleichen', 'Das Lüfterrad dreht in Pfeilrichtung.')] },

    /* ---------- 9 Vorschubantrieb ---------- */
    { id: 'vorschub', title: 'Vorschub arbeitet ungenau', machine: 'Vorschubachse mit Kugelgewindetrieb', level: 2, rate: 100,
      flow: ['Vorschubmotor', 'Kupplung', 'Spindel mit Mutter', 'Führungsbahn mit Abstreifer', 'Schlitten'],
      residual: { label: 'Hängende Achse absenken bzw. gegen Absinken abstützen', done: 'Der Schlitten ist abgestützt, der Antrieb ist lastfrei.' },
      intro: 'Eine Vorschubachse arbeitet ungenau: Die Maße der gefertigten Teile stimmen nicht mehr. Die Achse ist in Betrieb. Du sollst die Ursache finden.',
      symptoms: ['Die Maße der Teile weichen von Soll ab.', 'Die Bewegung des Schlittens wirkt nicht mehr sauber.', 'Die Steuerung meldet keinen Fehler.'],
      tips: ['Frage, ob die Abweichung konstant, zufällig, geschwindigkeitsabhängig oder nur an einer Stelle auftritt. Das trennt die Ursachen gut.',
        'Es kommen die Spindelmutter, die Kupplung zum Motor, die Schmierung und die Führungsbahn infrage. Messuhr und Wartungsbuch helfen.'],
      faults: [
        fl('f1', 'Spindelmutter verschlissen (Umkehrspiel)', ['verschlissen', 'Spiel zu groß'], 'Die Spindelmutter ist nach vielen Betriebsstunden ausgelaufen. Beim Richtungswechsel fehlt ein fester Betrag (Umkehrspiel), die Maße weichen konstant ab.', 'Spindelmutter bzw. Spindel erneuern oder neu vorspannen lassen, Steuerung kompensieren nur als Übergang', 'Umkehrspiel regelmäßig messen (Inspektion) und Verschleißtrend beobachten.'),
        fl('f2', 'Kupplung auf der Spindel locker (Klemmnabe gelöst)', ['Klemmnabe', 'gelöst', 'Kupplung locker'], 'Die Klemmschraube der Kupplungsnabe hat sich gelockert, die Nabe rutscht auf der Welle. Der Antrieb schlägt durch, die Position springt zufällig.', 'Nabe reinigen, Welle prüfen, Klemmschraube mit Drehmoment anziehen und sichern', 'Schraubverbindungen im Antriebsstrang nach Arbeiten am Motor prüfen und mit Drehmoment anziehen.'),
        fl('f3', 'Schmierung fehlt (Stick-Slip)', ['Stick-Slip', 'Schmierung fehlt', 'Schmierstoffmangel'], 'Die Spindel wurde zu lange nicht geschmiert. Bei niedriger Geschwindigkeit entsteht ruckartiges Gleiten (Haft-Gleit-Effekt), die Reibung und die Temperatur steigen.', 'Spindel und Mutter nach Plan schmieren, Spindel auf Schäden prüfen', 'Schmierplan einhalten, Fälligkeiten sichtbar machen (Zentralschmierung erwägen).'),
        fl('f4', 'Führung verschmutzt, Abstreifer beschädigt', ['Abstreifer beschädigt', 'Führung verschmutzt'], 'Der Abstreifer ist eingerissen, Späne gelangen auf die Führungsbahn und stören an einer Stelle den Lauf. Die Abweichung tritt nur dort auf.', 'Führungsbahn reinigen, Riefen prüfen, Abstreifer erneuern', 'Abstreifer regelmäßig prüfen und tauschen, Späneabfuhr verbessern.')],
      steps: [
        st('bed', 'doc', 'any', 2, 'Bediener befragen', 'Der Bediener sagt: Die Maße seien „seit ein paar Tagen unsicher“.', {
          f1: 'Der Bediener sagt: Die Maße sind nach der Richtungsumkehr immer um einen festen Betrag falsch.',
          f2: 'Der Bediener sagt: Mal passt das Maß, mal nicht, es springt und manchmal klackt es beim Umkehren.',
          f3: 'Der Bediener sagt: Bei langsamem Vorschub ruckelt der Schlitten, im Eilgang läuft er ruhig.',
          f4: 'Der Bediener sagt: Es knirscht immer an derselben Stelle des Verfahrwegs, Späne liegen auf der Bahn.' }),
        st('buch', 'doc', 'any', 2, 'Wartungsbuch einsehen', 'Eintrag: Inspektion ohne Befund.', {
          f1: 'Eintrag: Spindel seit zehn Jahren in Betrieb, Mutter nie gemessen.',
          f2: 'Eintrag: Vorschubmotor vor einem Monat getauscht.',
          f3: 'Eintrag: Schmierung der Vorschubspindel seit zwei Jahren überfällig.',
          f4: 'Eintrag: Abstreifer zuletzt vor drei Jahren erneuert.' }),
        st('bew', 'sicht', 'run', 3, 'Vorschubbewegung beobachten', 'Die Bewegung ist gleichmäßig.', { f1: 'Die Bewegung ist gleichmäßig, nach dem Umkehren fehlt ein fester Betrag.', f2: 'Die Bewegung ist ruckartig.', f3: 'Die Bewegung ist ruckartig.', f4: 'Die Bewegung stockt an einer bestimmten Stelle.' }),
        st('hoer', 'hoer', 'run', 2, 'Achse im Betrieb anhören', 'Ruhiger Lauf.', { f2: 'Klacken beim Richtungswechsel.', f3: 'Quietschen und Knirschen beim Verfahren.', f4: 'Quietschen und Knirschen beim Verfahren.' }),
        st('strom', 'mess', 'run', 4, 'Stromaufnahme des Vorschubmotors ablesen (Anzeige)', 'Stromaufnahme normal.', {
          f3: 'Stromaufnahme erhöht und schwankend.',
          f4: 'Stromaufnahme steigt punktuell an der Engstelle.' }),
        st('temp', 'mess', 'run', 3, 'Temperatur an Spindelmutter und Lager messen', 'Temperatur normal.', {
          f3: 'Mutter und Lager sind deutlich wärmer als normal.' }),
        st('pos', 'mess', 'run', 6, 'Position mit der Messuhr bei Hin- und Rückfahrt vergleichen', 'Positionsfehler gering.', { f1: 'Konstanter Versatz bei jedem Richtungswechsel.', f2: 'Die Abweichungen sind nicht konstant, sie ändern sich von Hub zu Hub oder mit der Geschwindigkeit.', f3: 'Die Abweichungen sind nicht konstant, sie ändern sich von Hub zu Hub oder mit der Geschwindigkeit.', f4: 'Abweichungen nur in einem Bereich des Verfahrwegs.' }),
        st('spiel', 'mess', 'safe', 8, 'Umkehrspiel der Spindel mit der Messuhr messen', 'Umkehrspiel gering (unter 0,02 mm).', {
          f1: 'Umkehrspiel etwa 0,3 mm.',
          f2: 'Umkehrspiel unregelmäßig, schwankt zwischen 0,05 und 0,2 mm.' }),
        st('kupp', 'sicht', 'safe', 4, 'Kupplung zwischen Motor und Spindel ansehen', 'Die Kupplung sitzt fest.', {
          f2: 'Die Klemmschraube der Nabe sitzt nicht fest, die Welle zeigt Riefen.' }),
        st('film', 'sicht', 'safe', 3, 'Spindel und Führung auf Schmierfilm ansehen', 'Dünner Schmierfilm vorhanden.', {
          f3: 'Die Spindel ist trocken, kein Fett ist sichtbar, es liegen Staub und leichter Rost darauf.' }),
        st('fuehr', 'sicht', 'safe', 4, 'Führungsbahn und Abstreifer ansehen', 'Führung sauber, Abstreifer intakt.', {
          f4: 'Späne liegen unter dem Abstreifer, die Lippe ist eingerissen, in der Bahn sind Riefen.' }),
        st('hand', 'hoer', 'safe', 3, 'Spindel von Hand drehen (Gleichlauf fühlen)', 'Gleichmäßig leicht.', { f1: 'Leicht, beim Umkehren ist Spiel spürbar.', f2: 'Die Spindel dreht, bevor der Schlitten mitkommt.', f3: 'Schwergängig, ruckartig oder an einer Stelle.', f4: 'Schwergängig, ruckartig oder an einer Stelle.' }),
        st('lager', 'mess', 'safe', 6, 'Axialspiel des Festlagers prüfen', 'Axialspiel im Sollbereich.')] }
  ];

  /* Allgemeine Falsch-Maßnahmen, die bei jedem Szenario zur Auswahl stehen */
  const measX = [
    { id: 'x1', text: 'Die Störung quittieren und die Maschine weiterlaufen lassen' },
    { id: 'x2', text: 'Die gesamte Baugruppe auf Verdacht tauschen' }
  ];

  /* ============================================================ Grundbegriffe */
  const begriffe = [
    { id: 'wartung', name: 'Wartung', def: 'Maßnahmen zur Verzögerung des Abbaus des vorhandenen Abnutzungsvorrats (DIN 31051).', bsp: 'Reinigen, Schmieren, Nachstellen, Auffüllen und Austauschen von Betriebsstoffen und Verbrauchsteilen.' },
    { id: 'inspektion', name: 'Inspektion', def: 'Maßnahmen zur Feststellung und Beurteilung des Istzustands, einschließlich der Bestimmung der Ursachen der Abnutzung (DIN 31051).', bsp: 'Messen, Prüfen, Ansehen, Beurteilen: Temperatur, Spiel, Ölstand, Riemenzustand.' },
    { id: 'instandsetzung', name: 'Instandsetzung', def: 'Maßnahmen zur Rückführung einer Betrachtungseinheit in den funktionsfähigen Zustand (DIN 31051).', bsp: 'Reparieren und Austauschen defekter Teile, zum Beispiel Lager, Riemen, Dichtung.' },
    { id: 'verbesserung', name: 'Verbesserung', def: 'Kombination aller technischen und administrativen Maßnahmen zur Steigerung der Funktionssicherheit, ohne die geforderte Funktion zu ändern (DIN 31051).', bsp: 'Dichtere Lagerabdichtung, Zentralschmierung, Überwachungssensor nachrüsten.' }
  ];
  const begriffeItems = [
    ['Getriebeöl nach Plan wechseln', 'wartung'], ['Spindellager mit der Fettpresse nachschmieren', 'wartung'], ['Filterelement der Wartungseinheit nach Plan tauschen', 'wartung'],
    ['Führungsbahnen reinigen und ölen', 'wartung'], ['Keilriemen nachspannen', 'wartung'], ['Kühlschmierstoff nachfüllen', 'wartung'],
    ['Lagertemperatur mit dem Infrarotthermometer messen', 'inspektion'], ['Spiel der Spindel mit der Messuhr prüfen', 'inspektion'], ['Ölstand am Schauglas ablesen', 'inspektion'],
    ['Riemen auf Risse und Verschleiß ansehen', 'inspektion'], ['Schwingungen am Motor messen', 'inspektion'], ['Dichtungen auf Undichtigkeit kontrollieren', 'inspektion'],
    ['Gerissenen Keilriemen ersetzen', 'instandsetzung'], ['Ausgeschlagenes Spindellager tauschen', 'instandsetzung'], ['Undichten Zylinder mit neuer Kolbendichtung versehen', 'instandsetzung'],
    ['Gebrochenes Zahnrad austauschen', 'instandsetzung'], ['Defekten Näherungsschalter ersetzen', 'instandsetzung'],
    ['Zentralschmierung statt Handschmierung einbauen', 'verbesserung'], ['Temperatursensor zur Überwachung am Lager nachrüsten', 'verbesserung'],
    ['Lagerabdichtung gegen eine staubdichtere Bauart tauschen, damit die Lager länger halten', 'verbesserung'], ['Kupplung durch eine wartungsfreie Ausführung ersetzen', 'verbesserung']
  ].map(a => ({ t: a[0], k: a[1] }));

  const strategien = [
    { id: 'ausfall', name: 'Ausfallbedingt', long: 'Ausfallbedingte Instandhaltung', was: 'Reparatur erst, wenn das Teil ausgefallen ist.', vor: 'Kein Planungsaufwand, das Teil wird voll ausgenutzt.', nach: 'Ungeplanter Stillstand, Folgeschäden und Sicherheitsrisiko möglich, Ersatzteile müssen sofort da sein.', bsp: 'Leuchte im Lager, einfache Hilfsmaschine ohne Sicherheitsfunktion.' },
    { id: 'zeit', name: 'Zeitabhängig (vorbeugend)', long: 'Vorbeugende, zeitabhängige Instandhaltung', was: 'Wartung und Austausch nach festen Intervallen (Zeit, Betriebsstunden, Hubzahl).', vor: 'Gut planbar, wenige Überraschungen, Ersatzteile einplanbar.', nach: 'Teile werden oft zu früh getauscht, laufender Aufwand, Eingriffe können selbst Fehler einbringen.', bsp: 'Ölwechsel alle 2000 Betriebsstunden, Riemenwechsel nach Plan, wiederkehrende Prüfungen.' },
    { id: 'zustand', name: 'Zustandsabhängig', long: 'Zustandsabhängige Instandhaltung', was: 'Eingriff, wenn der gemessene Zustand einen Grenzwert erreicht.', vor: 'Teile werden bis zum tatsächlichen Verschleiß genutzt, Schäden werden früh erkannt, Stillstand ist planbar.', nach: 'Messtechnik, Know-how und Auswertung nötig, die Überwachung kostet.', bsp: 'Schwingungsmessung an Lagern, Ölanalyse, Verschmutzungsanzeige am Hydraulikfilter.' }
  ];
  const strategieItems = [
    ['Der Hydraulikfilter wird getauscht, wenn die Verschmutzungsanzeige anspricht', 'zustand'], ['Der Keilriemen wird alle sechs Monate gewechselt, egal wie er aussieht', 'zeit'],
    ['Die Kühlmittelpumpe wird erst repariert, wenn sie nicht mehr fördert', 'ausfall'], ['Lager werden nach der Schwingungsmessung getauscht', 'zustand'],
    ['Die Hallenbeleuchtung wird ersetzt, wenn eine Lampe ausfällt', 'ausfall'], ['Der Ölwechsel erfolgt alle 2000 Betriebsstunden', 'zeit'],
    ['Der Zustand des Getriebeöls wird per Ölanalyse beurteilt, danach wird gewechselt', 'zustand'], ['Die Wartungseinheit bekommt jedes Jahr ein neues Filterelement', 'zeit']
  ].map(a => ({ t: a[0], k: a[1] }));

  /* ============================================================ Schmierung */
  const schmier = [
    { id: 'oel', name: 'Öl', eig: 'Führt Wärme ab, dringt in enge Spalte, spült Abrieb aus, geeignet für hohe Drehzahlen. Braucht Behälter und Dichtungen, kann auslaufen.', einsatz: 'Getriebe, Hydraulik, Führungsbahnen, Ketten, Spindeln mit Umlaufschmierung.' },
    { id: 'fett', name: 'Fett', eig: 'Öl mit Verdicker. Bleibt an der Schmierstelle, dichtet gegen Schmutz und Feuchtigkeit, ermöglicht Lebensdauerschmierung. Führt Wärme schlechter ab.', einsatz: 'Wälzlager, Gelenke, Schmiernippel, Gewindetriebe.' },
    { id: 'fest', name: 'Festschmierstoff', eig: 'Feste Teilchen (zum Beispiel Molybdändisulfid, Graphit, PTFE). Wirken auch bei extremer Temperatur, Vakuum und als Notlauf.', einsatz: 'Gleitflächen im Vakuum, heiße Gewinde, Montagepasten, Einlaufhilfe.' }
  ];
  const schmierAufgaben = ['Reibung vermindern', 'Verschleiß vermindern', 'Wärme abführen (vor allem Öl)', 'Korrosion verhindern', 'Abdichten gegen Schmutz und Wasser (vor allem Fett)', 'Schwingungen und Geräusche dämpfen', 'Verunreinigungen und Abrieb ausspülen (Öl)'];
  const schmierItems = [
    ['Getriebe mit Ölbad', 'oel'], ['Wälzlager am Motor mit Dauerschmierung', 'fett'], ['Hydraulikanlage', 'oel'], ['Führungsbahnen einer Fräsmaschine', 'oel'],
    ['Gelenk mit Schmiernippel', 'fett'], ['Antriebskette', 'oel'], ['Gleitfläche in einer Vakuumkammer', 'fest'], ['Gewinde im heißen Ofenbereich', 'fest'],
    ['Spindellager einer Werkzeugmaschine (Fettschmierung)', 'fett'], ['Kolbenstange eines Hydraulikzylinders (Medium Hydrauliköl)', 'oel']
  ].map(a => ({ t: a[0], k: a[1] }));
  /* Beispiel-Schmierplan einer Fräsmaschine. PRUEFEN: Kurzzeichen (CLP, HLP, CGLP), ISO-VG-Stufen, Intervalle und Mengen sind Beispiele für die Übung, nicht Herstellerangaben. */
  const schmierplan = [
    { stelle: 'Führungsbahnen', stoff: 'Gleitbahnöl (CGLP, ISO VG 68)', art: 'oel', intervall: 'täglich vor Schichtbeginn', menge: 'Zentralschmierung: Pumpe bis zur Kontrollanzeige' },
    { stelle: 'Vorschubspindel', stoff: 'Wälzlagerfett (Lithiumseife)', art: 'fett', intervall: 'alle 3 Monate', menge: '2 Hübe mit der Fettpresse' },
    { stelle: 'Hauptspindellager', stoff: 'Hochdrehzahl-Wälzlagerfett', art: 'fett', intervall: 'nach Herstellerangabe (Beispiel: 2000 Betriebsstunden)', menge: 'Menge nach Herstellerangabe, nicht überfetten' },
    { stelle: 'Hauptgetriebe', stoff: 'Getriebeöl (CLP, ISO VG 220)', art: 'oel', intervall: 'Ölstand wöchentlich prüfen, Wechsel jährlich', menge: 'bis Mitte Schauglas' },
    { stelle: 'Hydraulikaggregat', stoff: 'Hydrauliköl (HLP, ISO VG 46)', art: 'oel', intervall: 'Ölstand täglich prüfen, Wechsel nach Ölanalyse oder Herstellerangabe', menge: 'bis zur oberen Marke' },
    { stelle: 'Gelenke am Spannschlitten', stoff: 'Mehrzweckfett', art: 'fett', intervall: 'monatlich', menge: '1 bis 2 Hübe je Nippel' }
  ];

  /* ============================================================ Verschleiß und Schäden */
  const ursachen = [
    { id: 'ueberlast', name: 'Überlast' }, { id: 'schmierung', name: 'Fehlschmierung' }, { id: 'flucht', name: 'Fluchtfehler' },
    { id: 'schmutz', name: 'Verschmutzung' }, { id: 'feuchte', name: 'Feuchtigkeit und Korrosion' }, { id: 'alterung', name: 'Alterung und Überhitzung' }
  ];
  /* svg: Bauteil-Typ (bearing, gear, belt, seal) und Schadensmarke, die der UI-Zeichner kennt */
  const schaeden = [
    { id: 'lager-pitting', teil: 'Wälzlager', name: 'Grübchenbildung auf der Laufbahn', svg: ['bearing', 'pits'], desc: 'Auf der Laufbahn sitzen kleine, muschelförmige Ausbrüche, oft in einem Streifen. Das Lager läuft rau und laut.', ursache: 'ueberlast', warum: 'Wiederholte Überbeanspruchung der Laufbahn führt zu Werkstoffermüdung. Nach Ablauf der Lebensdauer ist das normal, vorzeitig tritt es bei Überlast auf.', mass: 'Lager tauschen, Lasten und Lagerauswahl prüfen, Überlast vermeiden.' },
    { id: 'lager-heiss', teil: 'Wälzlager', name: 'Heißlauf (Anlauffarben)', svg: ['bearing', 'burn'], desc: 'Laufbahn und Käfig sind blau-braun angelaufen, das Fett ist verkohlt und dunkel, das Lager roch verbrannt.', ursache: 'schmierung', warum: 'Zu wenig, falsches oder verbrauchtes Schmierfett führt zu Mischreibung und starker Erwärmung.', mass: 'Lager tauschen, Schmierplan prüfen (Fettsorte, Menge, Intervall) und einhalten.' },
    { id: 'lager-schmutz', teil: 'Wälzlager', name: 'Verschleiß durch Fremdkörper', svg: ['bearing', 'dirt'], desc: 'Die Laufbahn ist matt und zerkratzt, überall sind kleine Eindrücke von Partikeln. Das Fett ist körnig.', ursache: 'schmutz', warum: 'Schmutz, Späne oder Abrieb sind ins Lager gelangt und wirken wie Schleifmittel.', mass: 'Lager tauschen, Dichtungen prüfen, sauber arbeiten, Schmierstellen vor dem Abschmieren reinigen.' },
    { id: 'lager-rost', teil: 'Wälzlager', name: 'Rostflecken (Stillstandskorrosion)', svg: ['bearing', 'rust'], desc: 'Rostbraune Flecken liegen auf der Laufbahn im Abstand der Wälzkörper. Das Lager lief lange nicht.', ursache: 'feuchte', warum: 'Feuchtigkeit und Kondenswasser haben beim Stillstand an den Berührstellen Rost erzeugt.', mass: 'Lager tauschen, Feuchtigkeit fernhalten, Dichtung prüfen, Lager vor langem Stillstand konservieren.' },
    { id: 'lager-flucht', teil: 'Wälzlager', name: 'Einseitige, schräge Laufspur', svg: ['bearing', 'off'], desc: 'Die Laufspur liegt nicht in der Mitte der Laufbahn, sondern einseitig und schräg. Das Lager lief warm.', ursache: 'flucht', warum: 'Die Lagersitze oder Wellen fluchten nicht, das Lager verkantet.', mass: 'Lager tauschen, Lagersitze und Fluchtung prüfen, Welle ausrichten.' },
    { id: 'lager-dent', teil: 'Wälzlager', name: 'Eindrücke im Kugelabstand', svg: ['bearing', 'dents'], desc: 'Auf der Laufbahn sind in regelmäßigem Abstand glatte Mulden, genau im Abstand der Kugeln. Das Lager brummt.', ursache: 'ueberlast', warum: 'Ein Stoß oder statische Überlast (zum Beispiel Hammerschläge bei der Montage) hat die Kugeln in die Laufbahn gedrückt.', mass: 'Lager tauschen, Montage nur mit passenden Werkzeugen, Stoßbelastung vermeiden.' },
    { id: 'zahn-bruch', teil: 'Zahnrad', name: 'Zahnbruch', svg: ['gear', 'broken'], desc: 'Ein Zahn ist am Fuß abgebrochen, die Bruchfläche ist frisch und blank. Im Getriebe liegen Metallstücke.', ursache: 'ueberlast', warum: 'Eine Blockade oder ein Stoß hat den Zahn über seine Belastbarkeit hinaus beansprucht.', mass: 'Zahnrad und Gegenrad prüfen und erneuern, Getriebe spülen, Überlastschutz prüfen.' },
    { id: 'zahn-fressen', teil: 'Zahnrad', name: 'Fressen der Zahnflanken', svg: ['gear', 'scuff'], desc: 'Die Zahnflanken haben Riefen in Gleitrichtung, Metall ist stellenweise aufgeschweißt und verfärbt.', ursache: 'schmierung', warum: 'Der Schmierfilm ist zusammengebrochen, zum Beispiel durch Ölmangel oder zu hohe Temperatur, die Flanken berühren sich metallisch.', mass: 'Zahnräder erneuern, Ölstand, Ölsorte und Ölwechsel prüfen.' },
    { id: 'zahn-trag', teil: 'Zahnrad', name: 'Einseitiges Tragbild', svg: ['gear', 'edge'], desc: 'Die Zähne tragen nur an einer Kante. Dort glänzen die Flanken blank, auf der anderen Seite bleibt die Fläche matt.', ursache: 'flucht', warum: 'Die Wellen liegen nicht parallel, das Zahnrad trägt nur an einem Ende.', mass: 'Lagerung und Wellenparallelität prüfen, Zahnräder ausrichten, ggf. erneuern.' },
    { id: 'zahn-abr', teil: 'Zahnrad', name: 'Abrasiver Verschleiß', svg: ['gear', 'worn'], desc: 'Die Zähne sind dünner geworden, die Flanken matt. Im Öl liegen Schleifkörner und feiner Schlamm.', ursache: 'schmutz', warum: 'Schmutz und Abrieb im Öl wirken als Schleifmittel auf die Flanken.', mass: 'Öl wechseln, Filter und Abdichtung prüfen, Zahnräder nach Verschleißgrenze tauschen.' },
    { id: 'riem-glas', teil: 'Riemen', name: 'Verglaste Flanken', svg: ['belt', 'glaze'], desc: 'Die Keilriemenflanken glänzen glatt wie Glas, der Riemen ist hart. Er rutscht, es riecht nach Gummi.', ursache: 'alterung', warum: 'Schlupf erzeugt Wärme, der Gummi härtet aus und wird glatt. Die Spannung ist zu gering oder der Riemen alt.', mass: 'Riemen erneuern, Spannung nach Vorgabe einstellen, Scheiben prüfen.' },
    { id: 'riem-einseitig', teil: 'Riemen', name: 'Einseitig abgenutzte Flanke', svg: ['belt', 'oneside'], desc: 'Eine Flanke des Keilriemens ist stark abgenutzt, die andere nahezu neu. Der Riemen läuft schief.', ursache: 'flucht', warum: 'Die Riemenscheiben fluchten nicht oder stehen schief zueinander.', mass: 'Scheiben mit Lineal oder Laser ausrichten, dann Riemen erneuern.' },
    { id: 'riem-riss', teil: 'Riemen', name: 'Ausgefranster, gerissener Riemen', svg: ['belt', 'torn'], desc: 'Der Riemen ist quer eingerissen, Zugstränge stehen heraus, Zähne fehlen. Die Maschine blieb ruckartig stehen.', ursache: 'ueberlast', warum: 'Eine Blockade oder ein Stoß hat den Riemen über seine Belastbarkeit hinaus beansprucht.', mass: 'Riemen und Scheiben prüfen, ersetzen, Ursache der Blockade beseitigen.' },
    { id: 'dicht-hart', teil: 'Dichtung', name: 'Verhärtete, rissige Dichtlippe', svg: ['seal', 'cracked'], desc: 'Die Lippe des Wellendichtrings ist hart und spröde, mit feinen Rissen. Es tritt Öl aus.', ursache: 'alterung', warum: 'Wärme und Alter haben den Werkstoff verhärtet, die Lippe folgt der Welle nicht mehr.', mass: 'Dichtring erneuern, Betriebstemperatur und Werkstoff prüfen, Austauschintervall festlegen.' },
    { id: 'dicht-rille', teil: 'Dichtung', name: 'Einlaufrille auf der Welle', svg: ['seal', 'groove'], desc: 'Auf der Welle sitzt unter der Dichtlippe eine umlaufende Rille, die Dichtung ist undicht und Schmutz steckt in der Rille.', ursache: 'schmutz', warum: 'Schmutzpartikel unter der Dichtlippe haben die Welle eingeschliffen.', mass: 'Welle und Dichtring erneuern bzw. Laufbahn aufarbeiten, Staubschutz ergänzen.' }
  ];

  /* ============================================================ Sicherheit */
  /* PRUEFEN: Die fünf Sicherheitsregeln stammen aus der Elektrotechnik (DIN VDE 0105-100). Wortlaut sinngemäß, bitte mit der Betriebsanweisung vergleichen.
     An Maschinen kommen Restenergien hinzu. Elektrische Arbeiten dürfen nur Elektrofachkräfte ausführen. */
  const sicherheit = {
    regeln: [
      { n: 1, name: 'Freischalten', txt: 'Die Anlage allpolig von der Energiezufuhr trennen: Hauptschalter aus, Ventile und Absperrhähne schließen.' },
      { n: 2, name: 'Gegen Wiedereinschalten sichern', txt: 'Mit persönlichem Schloss und Warnschild gegen Einschalten durch andere sichern.' },
      { n: 3, name: 'Spannungsfreiheit bzw. Energiefreiheit feststellen', txt: 'Prüfen, ob wirklich keine Energie mehr anliegt (elektrisch: durch die Elektrofachkraft mit Spannungsprüfer; an Maschinen auch Manometer, Stillstand).' },
      { n: 4, name: 'Erden und Kurzschließen', txt: 'Nur in elektrischen Anlagen, wo vorgeschrieben (Elektrofachkraft). An Maschinen tritt an diese Stelle der Abbau der Restenergien.' },
      { n: 5, name: 'Benachbarte Teile abdecken oder abschranken', txt: 'Teile, die unter Spannung bleiben oder Gefahr bringen, abdecken oder absperren.' }
    ],
    /* Reihenfolge der Schritte im Lab-Prüfplatz */
    ablauf: ['Freischalten', 'Gegen Wiedereinschalten sichern', 'Restenergie abbauen', 'Energiefreiheit feststellen'],
    rest: [
      { id: 'luft', name: 'Druckluft', bsp: 'Zylinder, Leitungen, Druckbehälter', mass: 'Absperren, Anlage entlüften (Restdruck ablassen)' },
      { id: 'hyd', name: 'Hydraulikdruck', bsp: 'Hydrospeicher, Leitungen, Zylinder unter Last', mass: 'Druck ablassen, Speicher entlasten (nach Anleitung)' },
      { id: 'feder', name: 'Federspannung', bsp: 'Federspeicherbremse, Spannfeder, Federzylinder', mass: 'Feder entspannen oder mechanisch blockieren' },
      { id: 'schwer', name: 'Schwerkraft (hängende oder angehobene Last)', bsp: 'Senkrechte Achse, Hubtisch, angehobene Traverse', mass: 'Absenken, abstützen oder mit Sicherungsbolzen sichern' },
      { id: 'kin', name: 'Bewegungsenergie (Nachlauf)', bsp: 'Schwungmasse, Spindel, Lüfterrad', mass: 'Stillstand abwarten, prüfen, gegen Mitdrehen sichern' },
      { id: 'therm', name: 'Wärme', bsp: 'Heiße Gehäuse, heißes Öl, Heizpatronen', mass: 'Abkühlen lassen, Schutzhandschuhe tragen' },
      { id: 'elek', name: 'Elektrische Restladung', bsp: 'Kondensatoren, Zwischenkreis von Frequenzumrichtern', mass: 'Entladezeit nach Herstellerangabe abwarten, Elektrofachkraft' }
    ],
    loto: { name: 'Lockout/Tagout (LOTO)', txt: 'Lockout: Die Energiequelle wird mit einem persönlichen Vorhängeschloss verriegelt. Tagout: Ein Schild mit Name, Datum und Grund kennzeichnet die Sicherung. Jede Person bringt ihr eigenes Schloss an (bei mehreren Personen mit Schlosshaspel), und nur wer es angebracht hat, entfernt es.' }
  };

  /* Wartungsplan-Bausteine (Kalender-Raster) */
  const planPool = ['Ölstand Getriebe prüfen', 'Spindellager nachschmieren', 'Keilriemen prüfen', 'Filter der Wartungseinheit reinigen', 'Sicherheitseinrichtungen prüfen', 'Kühlschmierstoff wechseln', 'Führungen schmieren', 'Hydrauliköl wechseln', 'Schrauben am Fundament nachziehen', 'Schutzhauben und Not-Halt prüfen'];

  /* ============================================================ Aufgaben */
  const cats = ['Begriffe', 'Fehlersuche', 'Schmierung', 'Schäden', 'Kennzahlen', 'Sicherheit'];
  const WARTBEGR = ['Wartung', 'Inspektion', 'Instandsetzung', 'Verbesserung'];
  const STRAT3 = ['Ausfallbedingt', 'Zeitabhängig (vorbeugend)', 'Zustandsabhängig'];
  const ch = (id, cat, level, title, text, choices, correct, expl, tips, extra) => Object.assign({ id, cat, level, title, text, kind: 'choice', choices, correct, expl, tips }, extra || {});
  const mu = (id, cat, level, title, text, choices, correct, expl, tips) => ch(id, cat, level, title, text, choices, correct, expl, tips, { kind: 'multi' });
  const ma = (id, cat, level, title, text, items, options, correct, expl, tips) => ({ id, cat, level, title, text, kind: 'match', items, options, correct, expl, tips });
  const nu = (id, cat, level, title, text, calc, tol, unit, label, expl, tips) => ({ id, cat, level, title, text, kind: 'num', calc, tol, unit, label, expl, tips });
  const sc = (id, level, scen, fault, title, text) => ({ id, cat: 'Fehlersuche', level, title, text, kind: 'scen', scen, fault, expl: 'Du grenzt die Ursache mit Prüfschritten ein, sicherst die Maschine vor dem Eingriff und wählst Ursache und Maßnahme. Das Ergebnis mit Auswertung steht nach der Abgabe.', tips: null });
  const pl = (id, level, title, text, rows, expl, tips) => ({ id, cat: 'Kennzahlen', level, title, text, kind: 'plan', plan: { rows }, expl, tips });

  const tasks = [
    /* ----- Begriffe ----- */
    ch('ins1', 'Begriffe', 1, 'Die vier Teile der Instandhaltung', 'Nach DIN 31051 besteht Instandhaltung aus Wartung, Inspektion, Instandsetzung und …', ['Fertigung', 'Verbesserung', 'Entsorgung', 'Montage'], 1, 'Instandhaltung = Wartung + Inspektion + Instandsetzung + Verbesserung.', ['Es geht um Maßnahmen, die die Funktionssicherheit erhöhen, ohne die Funktion zu ändern.', 'Das gesuchte Wort beginnt mit V.']),
    ma('ins2', 'Begriffe', 1, 'Tätigkeiten zuordnen', 'Ordne jede Tätigkeit dem passenden Begriff zu.', ['Spindellager mit der Fettpresse nachschmieren', 'Lagertemperatur mit dem Infrarotthermometer messen', 'Gerissenen Keilriemen ersetzen', 'Zentralschmierung statt Handschmierung einbauen'], WARTBEGR, [0, 1, 2, 3], 'Schmieren ist Wartung, Messen und Beurteilen ist Inspektion, Defektes ersetzen ist Instandsetzung, Konstruktiv besser machen ist Verbesserung.', ['Frage dich: Wird nur der Verschleiß verzögert, wird der Zustand festgestellt, wird etwas repariert oder wird die Maschine besser gemacht?', 'Schmieren verzögert Verschleiß. Messen stellt den Zustand fest.']),
    ch('ins3', 'Begriffe', 1, 'Temperatur messen', 'Du misst die Lagertemperatur eines Motors und vergleichst sie mit dem Grenzwert. Was ist das?', ['Wartung', 'Instandsetzung', 'Inspektion', 'Verbesserung'], 2, 'Feststellen und Beurteilen des Istzustands ist Inspektion.', ['Es wird nichts verändert, nur der Zustand festgestellt.', 'Messen, Prüfen und Beurteilen gehören zu einem bestimmten Begriff.']),
    ma('ins4', 'Begriffe', 2, 'Fünf Beispiele aus der Werkstatt', 'Ordne die Beispiele zu.', ['Ölstand am Schauglas ablesen', 'Filterelement der Wartungseinheit nach Plan tauschen', 'Defekten Näherungsschalter ersetzen', 'Staubdichtere Lagerabdichtung einbauen, damit die Lager länger halten', 'Riemenspannung nachstellen'], WARTBEGR, [1, 0, 2, 3, 0], 'Ablesen = Inspektion. Planmäßiges Tauschen von Verbrauchsteilen und Nachstellen = Wartung. Ersetzen eines defekten Teils = Instandsetzung. Eine bessere Bauart einbauen = Verbesserung.', ['Planmäßiger Tausch von Verbrauchsteilen und Nachstellen gehören zur Wartung.', 'Nur das Teil, das schon kaputt ist, gehört zur Instandsetzung.']),
    ch('ins5', 'Begriffe', 2, 'Strategie erkennen', 'Die Kühlmittelpumpe wird erst repariert, wenn sie nicht mehr fördert. Welche Strategie ist das?', ['Ausfallbedingt', 'Zeitabhängig (vorbeugend)', 'Zustandsabhängig', 'Verbesserung'], 0, 'Reparatur erst nach dem Ausfall = ausfallbedingte Instandhaltung.', ['Es wird nichts vorbeugend getan.', 'Das Wort „Ausfall“ steckt schon im Namen der Strategie.']),
    ma('ins6', 'Begriffe', 2, 'Strategien zuordnen', 'Welche Strategie steckt jeweils dahinter?', ['Ölwechsel alle 2000 Betriebsstunden', 'Lager werden nach der Schwingungsmessung getauscht', 'Die Beleuchtung im Lager wird ersetzt, wenn eine Lampe ausfällt'], STRAT3, [1, 2, 0], 'Feste Intervalle sind zeitabhängig. Entscheidung nach Messwert ist zustandsabhängig. Reparatur nach Ausfall ist ausfallbedingt.', ['Wonach richtet sich der Zeitpunkt: Kalender, Messwert oder Ausfall?', 'Betriebsstunden sind ein fester Plan, die Schwingungsmessung ist ein Messwert.']),
    mu('ins7', 'Begriffe', 3, 'Zustandsabhängige Instandhaltung', 'Welche Aussagen zur zustandsabhängigen Instandhaltung stimmen? Wähle alle richtigen.', ['Bauteile werden bis zum tatsächlichen Verschleißzustand genutzt.', 'Sie kommt ohne jede Messtechnik aus.', 'Schäden werden oft früh erkannt, der Stillstand lässt sich planen.', 'Sie macht jede Inspektion überflüssig.', 'Typische Beispiele sind Schwingungsmessung und Ölanalyse.'], [0, 2, 4], 'Zustandsabhängige Instandhaltung beruht auf Messen und Beurteilen (Inspektion) und nutzt die Teile länger. Sie braucht Messtechnik und Wissen.', ['Überlege, wie man den Zustand überhaupt erfährt.', 'Zwei Aussagen widersprechen dem Wesen der Strategie: keine Messtechnik und keine Inspektion.']),
    /* ----- Fehlersuche ----- */
    ch('ins8', 'Fehlersuche', 1, 'Fehlersuche beginnen', 'An einer Maschine tritt eine Störung auf. Was machst du als Erstes?', ['Sofort das verdächtigste Teil tauschen', 'Symptome aufnehmen: Bediener befragen, Unterlagen ansehen, Maschine beobachten', 'Die Maschine zerlegen', 'Das Werkzeug wechseln und hoffen'], 1, 'Systematisch vorgehen: Symptome aufnehmen, Ursachen sammeln, mit Prüfschritten eingrenzen, erst dann eingreifen. Eingriffe erst, wenn die Maschine gesichert ist.', ['Vor dem Handeln kommt das Informieren.', 'Befragen, ansehen, beobachten kostet wenig Zeit und Geld.']),
    sc('ins9', 1, 'kuehl', 'f2', 'Fehlersuche: Kühlmittelpumpe', 'An der Drehmaschine kommt kein Kühlschmierstoff mehr an. Finde die Ursache im Prüfplatz und wähle die Maßnahme.'),
    sc('ins10', 1, 'bohr', 'f1', 'Fehlersuche: Ständerbohrmaschine', 'Die Bohrmaschine rattert und verliert unter Last Drehzahl. Finde die Ursache im Prüfplatz.'),
    sc('ins11', 2, 'band', 'f2', 'Fehlersuche: Förderband', 'Das Förderband bleibt unter Last stehen. Finde die Ursache im Prüfplatz.'),
    sc('ins12', 2, 'pumpe', 'f4', 'Fehlersuche: Kreiselpumpe', 'Die Kreiselpumpe fördert zu wenig. Finde die Ursache im Prüfplatz.'),
    sc('ins13', 2, 'pneu', 'f2', 'Fehlersuche: Pneumatikzylinder', 'Der Zylinder zieht nicht durch. Finde die Ursache im Prüfplatz.'),
    sc('ins14', 2, 'vorschub', 'f3', 'Fehlersuche: Vorschubachse', 'Die Vorschubachse arbeitet ungenau. Finde die Ursache im Prüfplatz.'),
    sc('ins15', 3, 'getriebe', 'f4', 'Fehlersuche: Getriebe', 'Das Getriebe macht Geräusche. Finde die Ursache im Prüfplatz.'),
    sc('ins16', 3, 'spindel', 'f1', 'Fehlersuche: Spindellager', 'Das Spindellager läuft heiß. Finde die Ursache im Prüfplatz.'),
    sc('ins17', 3, 'hyd', 'f3', 'Fehlersuche: Hydraulikpumpe', 'Die Hydraulikpumpe ist laut. Finde die Ursache im Prüfplatz.'),
    /* ----- Schmierung ----- */
    ch('ins18', 'Schmierung', 1, 'Aufgaben der Schmierung', 'Welche Aufgabe hat ein Schmierstoff NICHT?', ['Reibung und Verschleiß vermindern', 'Wärme abführen (vor allem Öl)', 'Korrosion verhindern', 'Die Drehzahl der Maschine erhöhen'], 3, 'Schmierstoffe mindern Reibung und Verschleiß, führen Wärme ab, schützen vor Korrosion und dichten ab. Die Drehzahl bestimmt der Antrieb.', ['Drei Aufgaben stimmen. Eine Antwort beschreibt eine Aufgabe des Antriebs.', 'Der Schmierstoff verändert die Drehzahl nicht.']),
    ma('ins19', 'Schmierung', 1, 'Schmierstoffart wählen', 'Welche Schmierstoffart passt zur Stelle?', ['Getriebe mit Ölbad', 'Wälzlager am Motor mit Dauerschmierung', 'Gleitfläche in einer Vakuumkammer', 'Hydraulikanlage'], ['Öl', 'Fett', 'Festschmierstoff'], [0, 1, 2, 0], 'Getriebe und Hydraulik arbeiten mit Öl, Wälzlager mit Dauerschmierung mit Fett, im Vakuum helfen Festschmierstoffe.', ['Fett bleibt am Lager. Öl fließt und führt Wärme ab.', 'Im Vakuum verdampft Öl. Feste Teilchen bleiben.']),
    nu('ins20', 'Schmierung', 2, 'Schmierhübe pro Jahr', 'Drei Schmiernippel werden alle 2 Wochen mit je 2 Hüben der Fettpresse geschmiert. Das Jahr hat 52 Wochen. Wie viele Hübe sind das pro Jahr?', ['hub', 52, 2, 3, 2], 0, 'Hübe', 'Hübe pro Jahr', 'Schmierungen pro Jahr: 52 : 2 = 26. Hübe: 26 · 3 Nippel · 2 Hübe = 156.', ['Erst die Anzahl der Schmiertermine im Jahr, dann Nippel und Hübe.', '52 : 2 = 26 Termine.']),
    ch('ins21', 'Schmierung', 2, 'Schmierplan ergänzen', 'Im Schmierplan fehlt der Schmierstoff für das Hauptspindellager (nach Herstellerangabe). Was gehört hinein?', ['Getriebeöl CLP ISO VG 220', 'Hochdrehzahl-Wälzlagerfett', 'Hydrauliköl HLP ISO VG 46', 'Graphitpulver'], 1, 'Spindellager sind Wälzlager mit hoher Drehzahl und werden mit einem dafür geeigneten Wälzlagerfett geschmiert (Menge und Intervall nach Herstellerangabe, nicht überfetten).', ['Die Spindel ist ein Wälzlager bei hoher Drehzahl.', 'Öle sind für Getriebe und Hydraulik vorgesehen.']),
    ma('ins22', 'Schmierung', 3, 'Schmierplan ergänzen', 'Ordne jeder Schmierstelle den Schmierstoff des Schmierplans zu.', ['Führungsbahnen', 'Hauptgetriebe', 'Hydraulikaggregat', 'Vorschubspindel'], ['Gleitbahnöl', 'Getriebeöl', 'Hydrauliköl', 'Wälzlagerfett'], [0, 1, 2, 3], 'Führungsbahnen: Gleitbahnöl. Getriebe: Getriebeöl. Hydraulik: Hydrauliköl. Vorschubspindel: Fett (Wälzlagerfett).', ['Der Name der Stelle verrät die Ölsorte oft schon.', 'Die Spindel wird mit Fettpresse geschmiert.']),
    nu('ins23', 'Schmierung', 3, 'Ölwechsel planen', 'Das Getriebeöl wird nach 2000 Betriebsstunden gewechselt. Die Maschine läuft 16 Stunden je Arbeitstag an 5 Tagen je Woche. Nach wie vielen Wochen ist der Wechsel fällig?', ['wechsel', 2000, 16, 5], 0, 'Wochen', 'Wochen', 'Betriebsstunden je Woche: 16 · 5 = 80. Wochen: 2000 : 80 = 25.', ['Wie viele Betriebsstunden sind das je Woche?', '16 · 5 = 80 Stunden je Woche.']),
    /* ----- Schäden ----- */
    ch('ins24', 'Schäden', 1, 'Anlauffarben am Lager', 'Ein Wälzlager ist blau-braun angelaufen, das Fett ist verkohlt. Wahrscheinlichste Ursache?', ['Verschmutzung', 'Fehlschmierung (Mangel oder falsches Fett)', 'Fluchtfehler', 'Überlast durch Stoß'], 1, 'Anlauffarben und verkohltes Fett zeigen Heißlauf. Er entsteht durch fehlende oder ungeeignete Schmierung.', ['Blau-braun heißt: es wurde sehr heiß.', 'Heißlauf entsteht, wenn der Schmierfilm fehlt.']),
    ma('ins25', 'Schäden', 2, 'Schadensbild und Ursache', 'Ordne jedem Schadensbild die Ursache zu.', ['Zahnflanken mit Fressspuren (Riefen in Gleitrichtung)', 'Keilriemen mit einseitig abgenutzter Flanke', 'Matte, zerkratzte Laufbahn mit Partikeleindrücken', 'Zahnbruch nach einer Blockade'], ['Überlast', 'Fehlschmierung', 'Fluchtfehler', 'Verschmutzung'], [1, 2, 3, 0], 'Fressen: Schmierfilm zusammengebrochen. Einseitiger Riemenverschleiß: Scheiben fluchten nicht. Partikeleindrücke: Schmutz. Zahnbruch nach Blockade: Überlast.', ['Jede Ursache passt genau einmal.', 'Riefen in Gleitrichtung entstehen, wenn Metall auf Metall gleitet.']),
    ch('ins26', 'Schäden', 2, 'Schadensbild erkennen', 'Welches Schadensbild zeigt die Skizze?', ['Rostflecken im Kugelabstand', 'Grübchenbildung auf der Laufbahn', 'Heißlauf mit Anlauffarben', 'Einseitige, schräge Laufspur'], 1, 'Viele kleine Ausbrüche in einem Streifen der Laufbahn sind Grübchen (Pitting): Werkstoffermüdung, oft durch Überlast oder nach Ablauf der Lebensdauer.', ['Achte auf Form und Anordnung der Marken.', 'Es sind kleine, dunkle Ausbrüche in einem Streifen.'], { svg: ['bearing', 'pits'] }),
    ch('ins27', 'Schäden', 3, 'Riemen läuft einseitig ab', 'Ein Keilriemen ist an einer Flanke stark abgenutzt, die andere ist fast neu. Ursache und Maßnahme?', ['Fluchtfehler der Scheiben: Scheiben ausrichten, dann Riemen erneuern', 'Überlast: stärkeren Motor einbauen', 'Fettmangel: den Riemen fetten', 'Zu hohe Drehzahl: Drehzahl senken'], 0, 'Einseitiger Verschleiß entsteht, wenn die Scheiben nicht fluchten. Erst ausrichten, sonst zerstört auch der neue Riemen.', ['Die Belastung verteilt sich ungleich auf beide Flanken.', 'Die Ursache muss beseitigt werden, bevor der Riemen erneuert wird.']),
    mu('ins28', 'Schäden', 3, 'Fehlschmierung vorbeugen', 'Welche Maßnahmen beugen Fehlschmierung vor? Wähle alle richtigen.', ['Den Schmierplan einhalten', 'Den im Plan vorgeschriebenen Schmierstoff verwenden', 'Möglichst viel Fett einpressen', 'Schmiernippel vor dem Abschmieren reinigen', 'Verschiedene Fette nach Gefühl mischen'], [0, 1, 3], 'Richtiger Schmierstoff, richtige Menge, richtiges Intervall und saubere Schmierstellen. Zu viel Fett erwärmt das Lager, Fette mischen kann die Schmierwirkung zerstören.', ['Zwei Antworten klingen nach „viel hilft viel“. Das stimmt hier nicht.', 'Der Schmierplan gibt Schmierstoff, Menge und Intervall vor.']),
    /* ----- Kennzahlen ----- */
    nu('ins29', 'Kennzahlen', 1, 'MTBF berechnen', 'Eine Anlage lief im Quartal 1200 Betriebsstunden und fiel 6-mal aus. Wie groß ist die MTBF (mittlere Betriebsdauer zwischen Ausfällen)?', ['mtbf', 1200, 6], 0.05, 'h', 'MTBF', 'MTBF = Betriebszeit : Anzahl der Ausfälle = 1200 h : 6 = 200 h.', ['MTBF = Betriebszeit : Anzahl der Ausfälle.', '1200 : 6.']),
    nu('ins30', 'Kennzahlen', 1, 'MTTR berechnen', 'Vier Reparaturen dauerten zusammen 14 Stunden. Wie groß ist die MTTR (mittlere Reparaturdauer)?', ['mttr', 14, 4], 0.05, 'h', 'MTTR', 'MTTR = Summe der Reparaturzeiten : Anzahl der Reparaturen = 14 h : 4 = 3,5 h.', ['MTTR = Summe der Reparaturzeiten : Anzahl der Reparaturen.', '14 : 4.']),
    nu('ins31', 'Kennzahlen', 2, 'Verfügbarkeit berechnen', 'Eine Maschine hat eine MTBF von 200 h und eine MTTR von 8 h. Wie hoch ist die Verfügbarkeit in Prozent? (auf zwei Nachkommastellen genau)', ['verf', 200, 8], 0.1, '%', 'Verfügbarkeit', 'Verfügbarkeit = MTBF : (MTBF + MTTR) = 200 : 208 = 0,9615, also 96,15 %.', ['Verfügbarkeit = MTBF : (MTBF + MTTR).', 'Nenner: 200 + 8 = 208. Das Ergebnis mal 100 ergibt Prozent.']),
    nu('ins32', 'Kennzahlen', 3, 'Ausfallkosten berechnen', 'Ein Ausfall dauert 6 Stunden Stillstand, der Produktionsausfall kostet 450 € je Stunde. Zwei Mitarbeiter reparieren je 5 Stunden zu 48 € je Stunde. Ersatzteile kosten 320 €. Wie hoch sind die Gesamtkosten?', ['kosten', 6, 450, 2, 5, 48, 320], 0.5, '€', 'Gesamtkosten', 'Stillstand: 6 · 450 = 2700 €. Lohn: 2 · 5 · 48 = 480 €. Ersatzteile: 320 €. Summe: 3500 €.', ['Drei Posten: Stillstand, Lohn, Ersatzteile.', 'Lohn: Personen · Stunden · Stundensatz.']),
    pl('ins33', 2, 'Wartungsplan: drei Maßnahmen', 'Trage die Termine im Jahresraster ein. Tippe auf ein Feld, um einen Termin zu setzen.', [{ label: 'Keilriemen prüfen', iv: 3, start: 1 }, { label: 'Hydrauliköl wechseln', iv: 12, start: 3 }, { label: 'Schmiernippel schmieren', iv: 6, start: 2 }], 'Alle 3 Monate ab Januar: Jan, Apr, Jul, Okt. Jährlich im März: nur März. Alle 6 Monate ab Februar: Feb, Aug. Das sind 7 Termine im Jahr.', ['Beginne mit dem Startmonat und zähle den Abstand dazu.', 'Alle 3 Monate ab Januar: 1, 4, 7, 10.']),
    pl('ins34', 3, 'Wartungsplan: fünf Maßnahmen', 'Trage die Termine im Jahresraster ein.', [{ label: 'Ölstand Getriebe prüfen', iv: 2, start: 1 }, { label: 'Filter reinigen', iv: 4, start: 2 }, { label: 'Spindellager nachschmieren', iv: 3, start: 3 }, { label: 'Not-Halt prüfen', iv: 12, start: 5 }, { label: 'Schrauben nachziehen', iv: 6, start: 1 }], 'Alle 2 Monate ab Januar: 1, 3, 5, 7, 9, 11. Alle 4 Monate ab Februar: 2, 6, 10. Alle 3 Monate ab März: 3, 6, 9, 12. Jährlich im Mai: 5. Alle 6 Monate ab Januar: 1, 7. Das sind 16 Termine.', ['Zähle bei jeder Zeile vom Startmonat in Schritten des Intervalls weiter, bis der Dezember erreicht ist.', 'Alle 4 Monate ab Februar: Februar, Juni, Oktober.']),
    /* ----- Sicherheit ----- */
    ch('ins35', 'Sicherheit', 1, 'Der erste Schritt', 'Du sollst an einer Maschine eine Wartung ausführen. Was kommt vor jedem Eingriff zuerst?', ['Schutzhaube abbauen', 'Freischalten: Energiezufuhr trennen', 'Werkzeug holen', 'Maschine anlaufen lassen'], 1, 'Erst freischalten (Hauptschalter aus, Energiezufuhr trennen), dann gegen Wiedereinschalten sichern, Restenergie abbauen und Energiefreiheit feststellen. Erst dann arbeiten.', ['Ohne getrennte Energie darf nicht eingegriffen werden.', 'Der erste Schritt der Sicherheitsregeln beginnt mit F.']),
    ma('ins36', 'Sicherheit', 2, 'Reihenfolge der Sicherung', 'Bringe die Schritte in die Reihenfolge, wie sie im Prüfplatz des Labs gelten (Schritt 1 bis 4).', ['Energiefreiheit feststellen', 'Freischalten', 'Restenergie abbauen', 'Gegen Wiedereinschalten sichern'], ['Schritt 1', 'Schritt 2', 'Schritt 3', 'Schritt 4'], [3, 0, 2, 1], 'Reihenfolge: 1 Freischalten, 2 Gegen Wiedereinschalten sichern, 3 Restenergie abbauen, 4 Energiefreiheit feststellen. Betriebe können Feinheiten abweichend regeln; maßgeblich ist die Betriebsanweisung.', ['Zuerst muss die Energie weg, erst dann wird gesichert.', 'Die Kontrolle, ob wirklich alles energiefrei ist, steht am Ende.']),
    ma('ins37', 'Sicherheit', 1, 'Restenergien', 'Welche Maßnahme passt zur Restenergie?', ['Druckluft im Zylinder', 'Hängende Last an einer senkrechten Achse', 'Hydraulikspeicher unter Druck', 'Nachlaufende Schwungmasse'], ['Entlüften, Druck ablassen', 'Absenken oder abstützen', 'Speicher nach Anleitung entlasten', 'Stillstand abwarten und prüfen'], [0, 1, 2, 3], 'Jede Energieform braucht ihre Maßnahme: Druck ablassen, Last abstützen, Speicher entlasten, Nachlauf abwarten.', ['Frage dich: Wo steckt die Energie, und wie wird sie sicher abgebaut?', 'Druck wird abgelassen, eine Last wird abgestützt, ein Nachlauf wird abgewartet.']),
    ch('ins38', 'Sicherheit', 2, 'Hängende Last', 'Eine senkrechte Achse könnte nach dem Abschalten absinken. Welche Restenergie ist das und was tust du?', ['Schwerkraft: Achse absenken oder mechanisch abstützen', 'Wärme: Schutzhandschuhe tragen', 'Elektrische Ladung: Kabel durchtrennen', 'Federspannung: Feder aufschneiden'], 0, 'Die Schwerkraft wirkt auf die Last auch ohne Antrieb. Die Last wird abgesenkt oder mit Sicherungsbolzen abgestützt, bevor jemand darunter arbeitet.', ['Was wirkt auf eine Last, auch wenn der Antrieb aus ist?', 'Gefahr entsteht durch das Absinken.']),
    ch('ins39', 'Sicherheit', 2, 'Lockout/Tagout', 'Was bedeutet Lockout/Tagout (LOTO)?', ['Automatisches Abschalten bei Störung', 'Verriegeln der Energiequelle mit persönlichem Schloss und Kennzeichnen mit einem Schild', 'Ein Verfahren zur Ölprobe', 'Ein Wartungsplan für Schmierstellen'], 1, 'Lockout = verriegeln (persönliches Schloss), Tagout = kennzeichnen (Schild mit Name). So kann niemand die Maschine versehentlich einschalten, und nur wer das Schloss angebracht hat, nimmt es ab.', ['Das englische Wort „lock“ heißt abschließen.', '„Tag“ ist ein Anhänger oder Schild.']),
    mu('ins40', 'Sicherheit', 3, 'Restenergien an der Hydraulikpresse', 'Welche Energien können an einer Hydraulikpresse auch nach dem Abschalten noch vorhanden sein? Wähle alle richtigen.', ['Druck im Hydrospeicher', 'Eine Last, die an einem Zylinder hängt oder oben abgestützt ist', 'Eingeschlossener Druck in Leitungen und Zylindern', 'Nach dem Ausschalten ist die Anlage immer energiefrei', 'Heißes Öl'], [0, 1, 2, 4], 'Auch nach dem Abschalten bleiben Druck, Lastgewicht und Wärme. Energiefreiheit muss hergestellt und festgestellt werden.', ['Eine Antwort behauptet das Gegenteil dessen, was die Regeln lehren.', 'Denke an Druck, Gewicht und Wärme.'])
  ];

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp). Der Beispielfall ist ein LÖSUNGSBEISPIEL zum Lernen und kein Aufgabenfall:
     Er hat eine eigene Ursache, die in KEINEM Szenario der Fehlersuche vorkommt (Test prüft Fehlernamen und Sperrwörter aller Szenarien),
     und enthält bewusst keine Zahlen. Sicherheitsschritte und Maßnahmen verweisen auf sicherheit.ablauf und sicherheit.rest. */
  const beispiele = [
    { id: 'ib1', typ: 'fall', titel: 'Durchgespielter Fall: Kühlmittelpumpe fördert nicht', text: 'Lösungsbeispiel zum Lernen, kein Aufgabenfall: Der Idealweg von der Störungsmeldung bis zur Maßnahme, Schritt für Schritt erklärt. Die Aufgaben im Prüfplatz bleiben für dich verdeckt.',
      fall: {
        intro: 'An einer Drehmaschine kommt kein Kühlschmierstoff mehr an der Schneide an, obwohl die Pumpe eingeschaltet ist.',
        schritte: [
          { phase: 'Vorbereitung', titel: 'Erst fragen und lesen', text: 'Bediener befragen und Wartungsbuch einsehen. Das kostet keine Zeit an der Maschine und ist ohne Gefahr. Ergebnis: Gestern wurde ein Schlauch am Kühlkreislauf erneuert, seitdem kommt nichts mehr an. Das Wartungsbuch bestätigt den Schlauchwechsel.' },
          { phase: 'Prüfen laufend', titel: 'Ansehen, anhören, ablesen, ohne Eingriff', text: 'Füllstand im Behälter ablesen: in Ordnung. Pumpe anhören: gleichmäßiges Brummen, kaum Strömungsgeräusch. Stromaufnahme ablesen: niedriger als sonst, die Pumpe arbeitet gegen einen versperrten Weg und braucht wenig Leistung. Motorschutz: hat nicht angesprochen. Ein Befund ist erst eine Spur, noch kein Beweis.' },
          { phase: 'Sicherheit', titel: 'Vor jedem Eingriff sichern', text: 'Bevor jemand ins Innere greift oder Teile öffnet, wird die Anlage gesichert, in dieser Reihenfolge: ' + sicherheit.ablauf.join(', ') + '. Beim Nachlauf des Lüfterrads gilt: ' + sicherheit.rest.find(r => r.id === 'kin').mass + '.' },
          { phase: 'Prüfen gesichert', titel: 'Eingriff nur so weit wie nötig', text: 'Von der Pumpe zur Düse verfolgen: Saugseite sauber, Schlauch bis zum Absperrhahn frei, Pumpe lässt sich leicht von Hand drehen. Am Absperrhahn in der Druckleitung steht der Hebel quer zur Leitung: Der Hahn ist geschlossen.' },
          { phase: 'Befund', titel: 'Befund ordnen', text: 'Pumpe und Motor sind in Ordnung, Behälter ist gefüllt, aber der Weg zur Düse ist versperrt. Das passt zu allen Beobachtungen: wenig Strom, kaum Strömungsgeräusch, kein Strahl.' },
          { phase: 'Ursache', titel: 'Ursache benennen', text: 'Der Absperrhahn in der Druckleitung wurde nach dem Schlauchwechsel nicht wieder geöffnet. Die Pumpe lief gegen die geschlossene Leitung. Ein Bauteilschaden liegt nicht vor.' },
          { phase: 'Maßnahme', titel: 'Beheben, freigeben, vorbeugen', text: 'Hahn öffnen, Sicherung nur durch die Person aufheben, die sie angebracht hat, Maschine wieder einschalten und den Strahl an der Düse prüfen. Danach Eintrag ins Wartungsbuch. Vorbeugen: Nach jedem Eingriff die Stellung der Absperrorgane in einer Checkliste abhaken und die Stellung am Hahn kennzeichnen.' }
        ]
      } },
    { id: 'ib2', typ: 'plan', titel: 'Beispiel-Schmierplan einer Werkzeugmaschine', text: 'Der Schmierplan aus dem Reiter „Schmierung“ als Tabelle: Schmierstelle, Schmierstoff, Intervall und Menge. Zum Lernen, wie ein vollständiger Plan aufgebaut ist.' },
    { id: 'ib3', typ: 'schaden', schaden: 'lager-schmutz', titel: 'Beispiel-Schadensbild: Verschleiß durch Fremdkörper', text: 'Ein Wälzlager mit mattem, zerkratztem Laufbahnbild. Das Beispiel zeigt Schadensbild, Ursache und Maßnahme zusammen.' },
    { id: 'ib4', typ: 'kenn', titel: 'Kennzahlen-Beispielrechnung: MTBF, MTTR, Verfügbarkeit, Ausfallkosten', text: 'Eine Anlage läuft 1200 h und fällt 6 Mal aus; die Reparaturen dauern zusammen 14 h bei 4 Reparaturen. „Laden“ trägt die Werte in den Kennzahlen-Rechner ein.', kc: { b: '1200', n: '6', r: '14', rn: '4', m1: '200', m2: '8', st: '6', kh: '450', pe: '2', rh: '5', lo: '48', te: '320' } }
  ];
  root.INS_DATA = { beispiele, GROUPS, scenarios, measX, begriffe, begriffeItems, strategien, strategieItems, schmier, schmierAufgaben, schmierItems, schmierplan, schaeden, ursachen, sicherheit, planPool, cats, tasks };
  root.INS_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.INS_DATA, TASKS: root.INS_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
