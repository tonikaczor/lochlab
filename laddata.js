'use strict';
/* Tonfunk Ladungssicherungs-Lab: Daten (Aufgaben-Generatoren, Beispiele, Zuordnungs-Sätze).
   ALLE Zurr-, Reib- und Mengenwerte sind ÜBUNGSWERTE, nicht für die Praxis.
   window.LAD_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, sets }
   window.LAD_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'lad', Status in localStorage 'lm4.lad.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Verdeckte-Fehler-Prinzip: Aufgabentitel und -texte verraten weder das Ergebnis noch den Fehler (Titel bleiben neutral). */
(function (root) {
  const C = () => root.LAD_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Kräfte und Reibung', 'Sicherungsarten', 'Zurrkraft berechnen', 'Gefahrgut', 'Stapelung und Standsicherheit', 'Verpackungssymbole', 'Ladeeinheiten und Stauraum', 'Verantwortung'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const loose = x => { const fr = x - Math.floor(x); return fr > 0.1 && fr < 0.9; };
  const pq = (POOL, idxs) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const dirTxt = d => d.short + ' (' + d.n.replace(/ \(.*\)/, '') + ', c = ' + f(d.c, 1) + ')';

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps] ---------- */
  /* PRUEFEN P10: Einteilung "Blockieren = Formschluss, Niederzurren = Kraftschluss, Direktzurren = Zurren (Zugkraft)". Manche Lehrbücher ordnen Direktzurren dem Formschluss zu. Welche Einteilung gilt im Betrieb? */
  const ARTQ = [
    ['Eine Maschine steht dicht an der Stirnwand und wird seitlich von Kanthölzern festgehalten, sodass sie sich nicht bewegen kann. Welche Sicherungsart ist das?', 'Formschlüssige Sicherung (Blockieren)', ['Kraftschlüssige Sicherung (Niederzurren)', 'Sicherung durch Antirutschmatte allein', 'Das ist keine Ladungssicherung'], 'Bei der formschlüssigen Sicherung liegt die Ladung dicht an festen Teilen (Stirnwand, Bordwand, Kantholz, Keil) an und kann sich in diese Richtung nicht bewegen.', ['Die Ladung wird durch feste Teile an ihrem Platz gehalten.', 'Es wird nichts gespannt und keine Reibung gebraucht, die Ladung stößt an.']],
    ['Ein Zurrgurt wird von oben über die Ladung gespannt und presst sie auf die Ladefläche. Die Ladung bleibt durch Reibung liegen. Wie heißt diese Sicherung?', 'Niederzurren (kraftschlüssig)', ['Direktzurren (Zugkraft des Gurtes in Zugrichtung)', 'Blockieren mit Stirnwand', 'Lücken mit Luftkissen füllen'], 'Beim Niederzurren drückt der Gurt die Ladung nach unten. Dadurch steigt die Reibung zwischen Ladung und Ladefläche (Kraftschluss).', ['Welche Kraft wird durch das Niederspannen größer?', 'Der Gurt wirkt senkrecht von oben, nicht in Fahrtrichtung.']],
    ['Ein Gurt wird von einem Zurrpunkt an der Ladung direkt zu einem Zurrpunkt am Fahrzeug gespannt und hält die Ladung durch seine Zugkraft in der Zugrichtung. Wie heißt das?', 'Direktzurren', ['Niederzurren', 'Antirutschmatte legen', 'Kantenschutz anbringen'], 'Beim Direktzurren nimmt der Gurt die Kraft direkt als Zugkraft auf (z. B. Diagonalzurren). Hier zählt die Zurrkraft LC des Gurtes.', ['Der Gurt zieht von der Ladung direkt zum Fahrzeug.', 'Es wird die Zurrkraft LC gebraucht, nicht die Vorspannkraft.']],
    ['Paletten stehen an der Stirnwand. Die restliche Lücke bis zur Hecktür wird mit Luftkissen gefüllt. Welche Sicherung ist das?', 'Formschluss durch Lücken füllen', ['Kraftschluss durch Niederzurren', 'Direktzurren', 'Das ist nur Polsterung, keine Sicherung'], 'Luftkissen und Füllmaterial schließen Lücken, sodass die Ladung nicht anlaufen kann. Das gehört zum Formschluss.', ['Was verhindert, dass die Ladung durch Lücken Anlauf nehmen kann?', 'Lücken füllen heißt: die Ladung liegt überall an.']],
    ['Warum ist Niederzurren allein auf einer nassen, glatten Ladefläche oft nicht ausreichend?', 'Der Reibbeiwert ist klein, die Gurte müssten sehr viel Reibung erzeugen', ['Zurrgurte dürfen nicht nass werden', 'Die Ladung wird bei Nässe schwerer', 'Nässe ändert beim Niederzurren nichts'], 'Niederzurren wirkt über Reibung. Je kleiner der Reibbeiwert µ, desto mehr Gurte braucht man. Bei sehr glatten Flächen ist Direktzurren oder Formschluss besser.', ['Niederzurren arbeitet mit Reibung.', 'Wie verändert sich µ bei Nässe?']],
    ['Welche Maßnahme erhöht den Reibbeiwert zwischen Palette und Ladefläche?', 'Eine Antirutschmatte unter die Palette legen', ['Die Ladefläche leicht ölen', 'Eine Plane über die Ladung legen', 'Die Ladung um 90° drehen'], 'Antirutschmatten haben einen hohen Reibbeiwert (Übungswert µ = 0,6). So braucht man weniger Zurrmittel.', ['Welches Material greift besonders gut?', 'Öl macht es glatter, eine Plane ändert die Reibung nicht.']],
    ['Auf einem Zurrgurt steht "LC 2000 daN". Was bedeutet LC?', 'Zurrkraft (Lashing Capacity): zulässige Zugkraft im geraden Zug', ['Länge des Gurtes in Zentimetern', 'Vorspannkraft der Ratsche', 'Gewicht der Ladung'], 'LC ist die Zurrkraft des Gurtes, die er im geraden Zug aufnehmen darf. Sie wird beim Direktzurren gebraucht.', ['LC steht für "Lashing Capacity".', 'Es ist eine Kraft in daN.']],
    ['Auf dem Etikett steht "STF 400 daN". Was bedeutet STF?', 'Standard-Vorspannkraft (Standard Tension Force) der Ratsche, wichtig beim Niederzurren', ['Höchste Zugkraft vor dem Reißen des Gurtes', 'Stahlfaser-Typ des Gurtbandes', 'Länge des freien Gurtendes'], 'STF ist die Kraft, mit der der Gurt über die Ratsche vorgespannt wird. Sie bestimmt beim Niederzurren die Presskraft auf die Ladung.', ['STF steht für "Standard Tension Force".', 'Es geht um das Spannen mit der Ratsche.']],
    ['Ein Zurrgurt hat einen Schnitt in der Gurtbandkante. Was gilt?', 'Der Gurt darf nicht mehr verwendet werden', ['Mit einem Knoten reparieren', 'Er darf noch mit halber Last benutzt werden', 'Er wird doppelt gelegt und weiterverwendet'], 'Beschädigte Gurte (Schnitte, Risse, Verformungen) gehören aussortiert. Knoten schwächen den Gurt zusätzlich und sind verboten.', ['Darf ein beschädigtes Zurrmittel in der Praxis noch gebraucht werden?', 'Reparieren durch Knoten ist nicht erlaubt.']],
    ['Was schützt einen Zurrgurt an scharfen Ladungskanten?', 'Kantenschutz', ['Ein zusätzlicher Knoten', 'Eine zweite Ratsche', 'Eine dickere Plane'], 'Kantenschutz verhindert, dass der Gurt an scharfen Kanten durchscheuert oder einschneidet und verteilt den Druck.', ['Das Hilfsmittel wird zwischen Gurt und Kante gelegt.', 'Es hat nichts mit der Ratsche zu tun.']]
  ];
  const GGQ = [
    ['Welche Farbe hat die Warntafel, die bei Gefahrguttransporten am Fahrzeug angebracht wird?', 'Orange', ['Gelb', 'Rot', 'Weiß mit rotem Rand'], 'Die Warntafel am Fahrzeug ist orange mit schwarzem Rand. Die Gefahrzettel an den Versandstücken sind dagegen je nach Klasse unterschiedlich.', ['Die Warntafel ist nicht rot, sie leuchtet in einer Warnfarbe.', 'Denke an Warnwesten und Warnleuchten.']],
    ['Wo wird bei einer Beförderung von Gefahrgut die orange Warntafel am Fahrzeug angebracht?', 'Vorn und hinten am Fahrzeug', ['Nur hinten', 'Nur an der Seite', 'Auf dem Dach'], 'Je eine orange Warntafel vorn und hinten, damit das Fahrzeug aus beiden Richtungen erkennbar ist (bei Tankfahrzeugen zusätzlich mit Zahlen).', ['Das Fahrzeug muss von vorn und von hinten erkennbar sein.', 'Zwei Tafeln.']],
    ['Was muss ein Versandstück mit Gefahrgut (z. B. ein Kanister) auf dem Etikett tragen?', 'UN-Nummer, Stoffbezeichnung und Gefahrzettel', ['Nur den Preis', 'Nur das Gewicht', 'Nur den Namen des Empfängers'], 'Das Versandstück wird mit der UN-Nummer, der Stoffbezeichnung und dem passenden Gefahrzettel gekennzeichnet, damit jeder die Gefahr erkennt.', ['Woran erkennt man Stoff und Gefahr?', 'UN-Nummer und Gefahrzettel gehören dazu.']],
    ['Die Gefahrnummer 33 auf der orangen Warntafel steht (Übungsbeispiel) für:', 'Leicht entzündbarer flüssiger Stoff', ['Ätzender Stoff', 'Radioaktiver Stoff', 'Stoff ist nicht gefährlich'], 'Die Gefahrnummer 33 beschreibt einen leicht entzündbaren flüssigen Stoff (z. B. Benzin). Die Gefahrnummer 80 steht für einen ätzenden Stoff.', ['Die 3 steht für flüssig und entzündbar.', 'Die doppelte 3 verstärkt die Gefahr.']]
  ];
  const VERQ = [
    ['Wer muss die Ladung beförderungssicher verladen und sichern (vereinfacht nach § 412 HGB)?', 'Der Absender bzw. der Verlader in seinem Auftrag', ['Nur der Empfänger', 'Nur der Fahrer', 'Das Ordnungsamt'], 'Das Handelsgesetzbuch weist dem Absender das beförderungssichere Verladen und Sichern zu; im Betrieb erledigt das der Verlader.', ['Wer liefert die Ware und lädt sie auf?', 'Der Empfänger ist am anderen Ende der Fahrt.']],
    ['Wer prüft vor Fahrtantritt, ob Fahrzeug und Ladung verkehrssicher sind?', 'Der Fahrer', ['Der Empfänger', 'Der Hersteller der Ware', 'Niemand, das wird erst bei einer Kontrolle geprüft'], 'Der Fahrer trägt die Verantwortung für die Verkehrssicherheit des Fahrzeugs und der Ladung und kontrolliert sie vor und während der Fahrt.', ['Wer sitzt am Steuer?', 'Der Fahrer ist für die Verkehrssicherheit mitverantwortlich.']],
    ['Wer muss bei Gefahrgut die richtige Verpackung, Kennzeichnung und das Beförderungspapier bereitstellen (vereinfacht)?', 'Der Absender', ['Der Empfänger', 'Der Fahrer allein', 'Die Spedition am Zielort'], 'Der Absender ist für die richtige Einstufung, die zugelassene Verpackung, Kennzeichnung und die Papiere zuständig. Der Verlader achtet auf die richtige Verladung, der Fahrer auf Papiere und Ausrüstung im Fahrzeug.', ['Wer gibt die Ware auf den Weg?', 'Verpackung und Papiere kommen vor der Beladung.']],
    ['Der Fahrer merkt vor dem Losfahren, dass die Ladung schlecht gesichert ist. Was gilt?', 'Er muss nachbessern lassen und darf so nicht losfahren', ['Er darf fahren, der Verlader ist ja schuld', 'Er fährt einfach langsamer', 'Er meldet es erst dem Empfänger'], 'Wer eine mangelhafte Sicherung erkennt, darf nicht abfahren. Auch der Fahrer ist mitverantwortlich.', ['Darf mit einer unsicheren Ladung gefahren werden?', 'Langsam fahren ändert an der Sicherung nichts.']],
    ['Welche Aufgabe hat der Verlader (Lagermitarbeiter) bei der Ladungssicherung?', 'Ladung richtig stauen, Gewichte beachten und geeignete Sicherungsmittel einsetzen', ['Nur zuschauen', 'Nur den Lieferschein unterschreiben', 'Die Fahrtroute planen'], 'Der Verlader staut die Ware so, dass Schwerpunkt und Achslasten passen, und sichert sie mit geeigneten Mitteln.', ['Es geht um das Beladen selbst.', 'Er arbeitet mit Paletten, Gurten und Matten.']]
  ];
  /* PRUEFEN P11: Verantwortung von Absender, Verlader, Fahrer und Halter ist stark vereinfacht (§ 412 HGB, § 22 StVO, ADR Kap. 1.4). Stimmen die Zuordnungen mit dem Betriebsunterricht überein? */

  /* Handhabungszeichen (Symbol-Beschreibung, Bedeutung) */
  /* PRUEFEN P12: Beschreibung der Handhabungszeichen nach ISO 780 (Zerbrechlich, Nässe, Oben, Hitze, Handhaken, Schwerpunkt, Anschlagen, Stapellast, Temperatur). Bildzeichen ohne Grafik, nur als Text: stimmen die Bezeichnungen? */
  const SYM = [
    ['Weinglas mit Bruchlinie', 'Zerbrechlich, vorsichtig behandeln'],
    ['Regenschirm mit Regentropfen', 'Vor Nässe schützen'],
    ['Zwei nach oben zeigende Pfeile', 'Diese Seite nach oben'],
    ['Sonne mit Strahlen', 'Vor Hitze schützen'],
    ['Handhaken, durchgestrichen', 'Nicht mit Handhaken anfassen'],
    ['Kreis mit Fadenkreuz', 'Hier ist der Schwerpunkt'],
    ['Kette oder Seil an einem Haken', 'Hier anschlagen'],
    ['Gestapelte Kisten mit Gewichtsangabe', 'Höchstzulässige Stapellast beachten'],
    ['Thermometer mit oberer und unterer Marke', 'Temperaturgrenzen einhalten']
  ];
  const symA = R => { const c = C(), s = SYM[c.ri(R, 0, SYM.length - 1)]; return choiceQ(R, 'Auf einem Karton ist dieses Zeichen aufgedruckt: ' + s[0] + '. Was bedeutet es?', s[1], c.shuffle(R, SYM.filter(x => x !== s)).slice(0, 3).map(x => x[1]), 'Das Zeichen "' + s[0] + '" bedeutet: ' + s[1] + '.', ['Handhabungszeichen sagen dir, wie du die Ware behandeln sollst.', 'Überlege, was das Bild im Alltag bedeutet.']); };
  const symB = R => { const c = C(), s = SYM[c.ri(R, 0, SYM.length - 1)]; return choiceQ(R, 'Welches Zeichen gehört zur Anweisung "' + s[1] + '"?', s[0], c.shuffle(R, SYM.filter(x => x !== s)).slice(0, 3).map(x => x[0]), 'Zur Anweisung "' + s[1] + '" gehört das Zeichen: ' + s[0] + '.', ['Welches Bild passt zur Anweisung?', 'Streiche zuerst Zeichen, die offensichtlich etwas anderes bedeuten.']); };

  /* Gefahrgutklassen */
  const CLS = { '1': 'Klasse 1: Explosive Stoffe', '2': 'Klasse 2: Gase', '3': 'Klasse 3: Entzündbare flüssige Stoffe', '4': 'Klasse 4: Entzündbare feste Stoffe', '5': 'Klasse 5: Oxidierende Stoffe, organische Peroxide', '6': 'Klasse 6: Giftige und ansteckungsgefährliche Stoffe', '7': 'Klasse 7: Radioaktive Stoffe', '8': 'Klasse 8: Ätzende Stoffe', '9': 'Klasse 9: Verschiedene gefährliche Stoffe' };
  /* PRUEFEN P13: Stoffe und ihre Klassen (Benzin 3, Propan 2, Salzsäure 8, Lithium-Ionen-Batterien 9, Feuerwerk 1, Sicherheitsstreichhölzer 4, stabilisiertes Wasserstoffperoxid hoher Konzentration 5, Pflanzenschutzmittel giftig 6, Strahlenquelle 7) sind Lehrbuchbeispiele. Bitte gegen ADR Kapitel 3.2 prüfen. */
  const STOFF = [['Benzin', '3'], ['Propangas in Stahlflaschen', '2'], ['Salzsäure', '8'], ['Lithium-Ionen-Akkus', '9'], ['Feuerwerkskörper', '1'], ['Sicherheitsstreichhölzer', '4'], ['Wasserstoffperoxid-Lösung (hohe Konzentration)', '5'], ['giftiges Pflanzenschutzmittel', '6'], ['Prüfstrahler (radioaktive Quelle)', '7']];
  /* PRUEFEN P14: Beschreibung der Gefahrzettel (Farben, Symbole) vereinfacht; Klasse 2 und 6 haben mehrere Zettel (rot/grün/weiß), deshalb nur eindeutige Zettel verwendet. */
  const ZETTEL = [['Orangefarbener Zettel mit explodierender Bombe', '1'], ['Zettel oben weiß, unten schwarz, mit Ätzwirkung auf Hand und Metall', '8'], ['Weißer Zettel mit sieben senkrechten schwarzen Streifen im oberen Teil', '9'], ['Gelb-weißer Zettel mit Strahlungszeichen', '7'], ['Grüner Zettel mit Gasflasche', '2'], ['Blauer Zettel (Stoff entwickelt mit Wasser entzündbare Gase)', '4'], ['Roter Zettel mit Flamme (Stoff ist flüssig, Beispiel Benzin)', '3'], ['Gelber Zettel mit Flamme über einem Kreis (Stoff fördert Brände)', '5']];
  /* UN-Nummer und Gefahrnummer (Warntafel: oben Gefahrnummer, unten UN-Nummer) */
  /* PRUEFEN P15: UN-/Gefahrnummern (Benzin 1203/33, Dieselkraftstoff 1202/30, Salzsäure 1789/80, Propan 1978/23, Aceton 1090/33, Ethanol 1170/33, Natriumhydroxidlösung 1824/80). Bitte gegen die ADR-Tabelle A prüfen. */
  const UN = [['Benzin', '1203', '33'], ['Dieselkraftstoff', '1202', '30'], ['Salzsäure', '1789', '80'], ['Propan', '1978', '23'], ['Aceton', '1090', '33'], ['Ethanol', '1170', '33'], ['Natriumhydroxidlösung', '1824', '80']];

  /* ---------- Zuordnungs-Sätze für die Reiter (Zuordnungsübung und Nachschlagen) ---------- */
  /* g = Gruppe (Antwortoptionen kommen aus derselben Gruppe), n = Begriff, d = Beschreibung (Frage), pts = Merkpunkte */
  const SETS = {
    art: { title: 'Sicherungsarten und -mittel', prompt: 'Welcher Begriff passt?', items: [
      { g: 'Sicherungsarten', n: 'Formschluss (Blockieren)', d: 'Die Ladung liegt dicht an Stirnwand, Bordwand, Kantholz oder Keil an und kann sich in diese Richtung nicht bewegen.', pts: ['Kräfte werden durch feste Teile aufgenommen', 'Lücken müssen gefüllt werden (Luftkissen, Paletten, Hölzer)', 'Sehr sicher, wenn die Ladung dicht anliegt'] },
      { g: 'Sicherungsarten', n: 'Kraftschluss (Niederzurren)', d: 'Gurte pressen die Ladung von oben auf die Ladefläche, die Reibung hält sie fest.', pts: ['Wirkt über die Reibung, Reibbeiwert µ wichtig', 'Ratsche spannt mit der Vorspannkraft STF', 'Auf glatten oder nassen Flächen viele Gurte nötig'] },
      { g: 'Sicherungsarten', n: 'Direktzurren', d: 'Ein Gurt zieht von einem Zurrpunkt der Ladung direkt zu einem Zurrpunkt am Fahrzeug und hält sie durch seine Zugkraft.', pts: ['Es zählt die Zurrkraft LC des Zurrmittels', 'Zurrpunkte an Ladung und Fahrzeug nötig', 'Zurrwinkel beachten'] },
      { g: 'Sicherungsmittel', n: 'Zurrgurt mit Ratsche', d: 'Kunstfaserband mit Spannvorrichtung; trägt Angaben zu LC und STF auf dem Etikett.', pts: ['Beschädigte Gurte aussortieren', 'Nicht knoten', 'An scharfen Kanten Kantenschutz verwenden'] },
      { g: 'Sicherungsmittel', n: 'Antirutschmatte', d: 'Wird unter die Ladung gelegt und erhöht den Reibbeiwert zwischen Ladung und Ladefläche.', pts: ['Übungswert µ = 0,6 bei Holz auf Matte', 'Spart Zurrmittel, ersetzt sie aber meist nicht ganz'] },
      { g: 'Sicherungsmittel', n: 'Kantenschutz', d: 'Wird zwischen Gurt und scharfe Ladungskante gelegt, damit der Gurt nicht durchscheuert.', pts: ['Verteilt außerdem den Druck', 'Verhindert Beschädigung von Gurt und Ladung'] },
      { g: 'Sicherungsmittel', n: 'Luftkissen / Füllmaterial', d: 'Füllt Lücken zwischen Ladung und Wand, damit die Ladung nicht anlaufen kann.', pts: ['Gehört zum Formschluss', 'Nicht für schwere Lasten allein verwenden'] },
      { g: 'Sicherungsmittel', n: 'Kantholz oder Keil', d: 'Wird vor Rädern, Rollen oder Kanten gelegt und blockiert die Ladung.', pts: ['Typisch bei rollender Ladung', 'Muss selbst gegen Verrutschen gesichert sein'] }
    ] },
    gg: { title: 'Gefahrgutklassen', prompt: 'Zu welcher Gefahrgutklasse passt das?', items: [
      { g: 'Klassen', n: CLS['1'], d: 'Typische Beispiele: Feuerwerkskörper, Munition. Gefahrzettel orange mit Bombe.', pts: ['Gefahrzettel orange', 'Besonders strenge Vorschriften'] },
      { g: 'Klassen', n: CLS['2'], d: 'Typische Beispiele: Propan in Stahlflaschen, Sauerstoff, Spraydosen. Es gibt rote, grüne und weiße Gefahrzettel.', pts: ['2.1 entzündbare Gase (rot)', '2.2 nicht entzündbare, nicht giftige Gase (grün)', '2.3 giftige Gase (weiß mit Totenkopf)'] },
      { g: 'Klassen', n: CLS['3'], d: 'Typische Beispiele: Benzin, Aceton, lösemittelhaltige Farben. Gefahrzettel rot mit Flamme.', pts: ['Gefahrnummer häufig 33 oder 30', 'Zündquellen fernhalten'] },
      { g: 'Klassen', n: CLS['4'], d: 'Typische Beispiele: Sicherheitsstreichhölzer, Magnesium. Gefahrzettel weiß mit roten Streifen, oben weiß unten rot oder blau.', pts: ['4.1 entzündbare feste Stoffe', '4.2 selbstentzündliche Stoffe', '4.3 Stoffe, die mit Wasser entzündbare Gase bilden'] },
      { g: 'Klassen', n: CLS['5'], d: 'Typische Beispiele: hochkonzentriertes Wasserstoffperoxid, organische Peroxide. Gefahrzettel gelb mit Flamme über einem Kreis.', pts: ['5.1 oxidierend wirkende Stoffe', '5.2 organische Peroxide'] },
      { g: 'Klassen', n: CLS['6'], d: 'Typische Beispiele: giftige Pflanzenschutzmittel, ansteckungsgefährliche medizinische Proben. Zettel weiß mit Totenkopf oder drei Halbmonden.', pts: ['6.1 giftige Stoffe', '6.2 ansteckungsgefährliche Stoffe'] },
      { g: 'Klassen', n: CLS['7'], d: 'Typische Beispiele: Strahlenquellen für Messgeräte. Gefahrzettel gelb-weiß mit Strahlungszeichen.', pts: ['Eigene strenge Vorschriften', 'Abstand zu Personen halten'] },
      { g: 'Klassen', n: CLS['8'], d: 'Typische Beispiele: Salzsäure, Batteriesäure, Natronlauge. Gefahrzettel oben weiß, unten schwarz, mit Ätzwirkung.', pts: ['Gefahrnummer häufig 80', 'Schutzkleidung tragen'] },
      { g: 'Klassen', n: CLS['9'], d: 'Typische Beispiele: Lithium-Ionen-Akkus, Trockeneis. Gefahrzettel weiß mit schwarzen Streifen im oberen Teil.', pts: ['Sammelklasse für sonstige Gefahren', 'Lithium-Batterien brauchen besondere Verpackung'] }
    ] },
    sym: { title: 'Handhabungszeichen', prompt: 'Was bedeutet das Zeichen?', items: SYM.map(s => ({ g: 'Zeichen', n: s[1], d: 'Zeichen: ' + s[0] + '.', pts: [] })) },
    ver: { title: 'Verantwortung', prompt: 'Wer ist gemeint?', items: [
      { g: 'Beteiligte', n: 'Absender', d: 'Verpackt die Ware transportfähig, kennzeichnet sie und stellt Lieferpapiere bzw. bei Gefahrgut das Beförderungspapier bereit.', pts: ['Beim Gefahrgut: Einstufung, Verpackung, Kennzeichnung', 'Nach § 412 HGB zuständig für das beförderungssichere Verladen'] },
      { g: 'Beteiligte', n: 'Verlader', d: 'Lädt die Ware auf, staut sie richtig, achtet auf Gewichtsverteilung und sichert sie mit geeigneten Mitteln.', pts: ['Das bist du als Fachkraft für Lagerlogistik beim Verladen', 'Prüft Gewicht, Schwerpunkt und Reibung'] },
      { g: 'Beteiligte', n: 'Fahrer', d: 'Prüft vor Abfahrt die Verkehrssicherheit von Fahrzeug und Ladung und kontrolliert die Sicherung unterwegs.', pts: ['Darf mit unsicher gesicherter Ladung nicht losfahren', 'Mitverantwortlich für die Sicherung'] },
      { g: 'Beteiligte', n: 'Fahrzeughalter', d: 'Stellt ein geeignetes Fahrzeug mit Zurrpunkten und geprüften Zurrmitteln bereit.', pts: ['Sorgt für Wartung und Prüfung der Ausrüstung'] },
      { g: 'Beteiligte', n: 'Empfänger', d: 'Nimmt die Ware an, prüft sie auf Transportschäden und meldet sie sofort.', pts: ['Entlädt, sofern nichts anderes vereinbart ist'] }
    ] }
  };

  /* ---------- Generatoren ---------- */
  const G = {
    gewicht: R => {
      const c = C(), m = c.ri(R, 4, 40) * 50, F = m * c.G;
      return numQ('Eine Palette hat eine Masse von ' + f(m, 0) + ' kg. Berechne ihre Gewichtskraft (Ortsfaktor g = 9,81 m/s²).', F, 'N', 'Gewichtskraft', 1,
        'Gewichtskraft = Masse · g = ' + f(m, 0) + ' kg · 9,81 m/s² = ' + f(F, 1) + ' N.', ['Die Formel lautet F = m · g.', 'Multipliziere die Masse in kg mit 9,81.']);
    },
    mu: R => {
      const c = C(), e = c.pick(R, c.MU), r = 'µ = ' + f(e.mu, 2);
      return choiceQ(R, 'Welcher Reibbeiwert µ gilt hier als Übungswert: ' + e.n + '?', r, c.shuffle(R, c.MU.filter(x => x !== e)).slice(0, 3).map(x => 'µ = ' + f(x.mu, 2)),
        'Für ' + e.n + ' gilt als Übungswert ' + r + '. Je rauer die Paarung, desto größer µ. Eine Antirutschmatte hat den höchsten, geöltes Metall den niedrigsten Wert.', ['Schau in die Tabelle im Reiter Hilfe.', 'Überlege, wie rutschig die Paarung ist: glatt heißt kleines µ.']);
    },
    reib: R => {
      const c = C(), m = c.ri(R, 5, 40) * 100, e = c.pick(R, c.MU.filter(x => x.mu >= 0.2)), Fr = c.friction(e.mu, m);
      return numQ('Eine Ladung von ' + f(m, 0) + ' kg steht auf einer Ladefläche (' + e.n + ', µ = ' + f(e.mu, 2) + '). Berechne die Reibkraft, die die Ladung festhält (g = 9,81 m/s²).', Fr, 'N', 'Reibkraft', Math.max(2, Fr * 0.001),
        'Gewichtskraft = ' + f(m, 0) + ' · 9,81 = ' + f(c.gForce(m), 1) + ' N. Reibkraft = µ · Gewichtskraft = ' + f(e.mu, 2) + ' · ' + f(c.gForce(m), 1) + ' = ' + f(Fr, 1) + ' N.', ['Die Reibkraft ist µ mal die Normalkraft (hier die Gewichtskraft).', 'Erst F = m · g ausrechnen, dann mit µ multiplizieren.']);
    },
    rutscht: R => {
      const c = C(), d = c.pick(R, c.DIRS), e = c.pick(R, c.MU), sl = c.slips(d.c, e.mu);
      return choiceQ(R, 'Eine Palette steht ohne weitere Sicherung auf einer Ladefläche (' + e.n + ', µ = ' + f(e.mu, 2) + '). Die Beschleunigung wirkt ' + dirTxt(d) + '. Rutscht die Ladung?',
        sl ? 'Ja, sie rutscht (die Reibung ist kleiner als der Beschleunigungsbeiwert)' : 'Nein, sie bleibt liegen (die Reibung ist größer als der Beschleunigungsbeiwert)',
        [sl ? 'Nein, sie bleibt liegen (die Reibung ist größer als der Beschleunigungsbeiwert)' : 'Ja, sie rutscht (die Reibung ist kleiner als der Beschleunigungsbeiwert)', 'Das hängt nur vom Gewicht ab, nicht von µ'],
        'Vergleich: µ = ' + f(e.mu, 2) + ' und c = ' + f(d.c, 1) + '. ' + (sl ? 'µ ist kleiner als c, die Massenkraft ist größer als die Reibkraft, die Ladung rutscht.' : 'µ ist nicht kleiner als c, die Reibung reicht aus, die Ladung rutscht nicht.') + ' Das Gewicht kürzt sich heraus, weil Reibkraft und Massenkraft beide mit m · g wachsen.',
        ['Vergleiche µ mit dem Beschleunigungsbeiwert c.', 'Rutschen tritt ein, wenn µ kleiner als c ist.']);
    },
    fehl: R => {
      const c = C(); let d, e, m;
      for (let i = 0; i < 50; i++) { d = c.pick(R, c.DIRS); e = c.pick(R, c.MU); if (e.mu < d.c) break; }
      if (!(e.mu < d.c)) { d = c.DIRS[0]; e = c.MU[0]; }
      m = c.ri(R, 5, 40) * 100; const Fs = c.toDaN(c.secureForce(m, d.c, e.mu));
      return numQ('Eine Ladung von ' + f(m, 0) + ' kg steht auf (' + e.n + ') (µ = ' + f(e.mu, 2) + '). Die Beschleunigung wirkt ' + dirTxt(d) + '. Welche Kraft in daN müssen die Zurrmittel mindestens aufbringen (g = 9,81 m/s²)?', Fs, 'daN', 'Sicherungskraft', 2,
        'Sicherungskraft = m · g · (c − µ) = ' + f(m, 0) + ' · 9,81 · (' + f(d.c, 1) + ' − ' + f(e.mu, 2) + ') = ' + f(c.secureForce(m, d.c, e.mu), 0) + ' N = ' + f(Fs, 1) + ' daN (1 daN = 10 N).', ['Die Reibung hilft mit: Du musst nur den Teil sichern, den die Reibung nicht hält.', 'F = m · g · (c − µ), danach Newton durch 10 teilen für daN.']);
    },
    cwahl: R => {
      const c = C(), d = c.pick(R, c.DIRS), all = ['0,8', '0,5', '1,0', '0,3'], r = 'c = ' + f(d.c, 1).replace('.', ',');
      return choiceQ(R, 'Mit welchem Beschleunigungsbeiwert c (Vielfaches von g) rechnest du, wenn die Ladung ' + dirTxt(d).replace(/, c = .*\)/, ')') + ' in Bewegung geraten kann?', r, all.map(x => 'c = ' + x).filter(x => x !== r).slice(0, 3),
        'Übungswerte: nach vorn 0,8 g, zur Seite und nach hinten 0,5 g. Hier gilt ' + r + '.', ['Nach vorn ist der Wert am größten, weil Bremsen stärker verzögert als Anfahren.', 'Vorwärts 0,8 · seitlich 0,5 · rückwärts 0,5.']);
    },
    fx: R => {
      const c = C(), d = c.pick(R, c.DIRS), m = c.ri(R, 5, 60) * 100, F = c.toDaN(c.accelForce(m, d.c));
      return numQ('Eine Ladung hat eine Masse von ' + f(m, 0) + ' kg. Berechne die Massenkraft in daN, die bei der Beschleunigung ' + dirTxt(d) + ' auf die Ladung wirkt (g = 9,81 m/s², Reibung nicht berücksichtigen).', F, 'daN', 'Massenkraft', 1,
        'Massenkraft = m · g · c = ' + f(m, 0) + ' · 9,81 · ' + f(d.c, 1) + ' = ' + f(c.accelForce(m, d.c), 0) + ' N = ' + f(F, 1) + ' daN.', ['Gewichtskraft mal Beschleunigungsbeiwert.', 'F = m · g · c, dann durch 10 für daN.']);
    },
    direkt: R => {
      const c = C(); let d, m, LC, q;
      for (let i = 0; i < 300; i++) { d = c.pick(R, c.DIRS); m = c.ri(R, 6, 30) * 1000; LC = c.pick(R, [1000, 1250, 2000, 2500]); q = c.secureForce(m, d.c, 0) / (LC * 10); if (loose(q) && q > 1.5) break; }
      const n = c.lashDirect(m, d.c, 0, LC);
      return numQ('Eine Maschine von ' + f(m, 0) + ' kg soll nur durch Direktzurren gesichert werden (Reibung nicht anrechnen). Beschleunigung ' + dirTxt(d) + '. Jeder Zurrgurt hat LC = ' + f(LC, 0) + ' daN. Wie viele Zurrgurte brauchst du mindestens (g = 9,81 m/s²)?', n, 'Gurte', 'Anzahl Zurrgurte', 0.01,
        'Sicherungskraft = m · g · c = ' + f(m, 0) + ' · 9,81 · ' + f(d.c, 1) + ' = ' + f(c.secureForce(m, d.c, 0), 0) + ' N = ' + f(c.toDaN(c.secureForce(m, d.c, 0)), 1) + ' daN. Anzahl = ' + f(c.toDaN(c.secureForce(m, d.c, 0)), 1) + ' / ' + f(LC, 0) + ' = ' + f(q, 2) + ', aufgerundet ' + n + ' Gurte.', ['Rechne die Massenkraft in daN aus und teile durch die Zurrkraft eines Gurtes.', 'Das Ergebnis immer aufrunden: Ein halber Gurt hält nichts.']);
    },
    direktmu: R => {
      const c = C(); let d, e, m, LC, q;
      for (let i = 0; i < 400; i++) { d = c.pick(R, c.DIRS); e = c.pick(R, c.MU.filter(x => x.mu >= 0.2)); m = c.ri(R, 6, 30) * 1000; LC = c.pick(R, [1000, 1250, 2000, 2500]); q = c.secureForce(m, d.c, e.mu) / (LC * 10); if (e.mu < d.c && loose(q) && q > 1.2) break; }
      const n = c.lashDirect(m, d.c, e.mu, LC), Fs = c.secureForce(m, d.c, e.mu);
      return numQ('Eine Ladung von ' + f(m, 0) + ' kg steht auf ' + e.n + ' (µ = ' + f(e.mu, 2) + '). Beschleunigung ' + dirTxt(d) + '. Der Rest wird durch Direktzurren mit Gurten (LC = ' + f(LC, 0) + ' daN je Gurt) gesichert. Wie viele Gurte brauchst du mindestens (g = 9,81 m/s²)?', n, 'Gurte', 'Anzahl Zurrgurte', 0.01,
        'Sicherungskraft = m · g · (c − µ) = ' + f(m, 0) + ' · 9,81 · (' + f(d.c, 1) + ' − ' + f(e.mu, 2) + ') = ' + f(Fs, 0) + ' N = ' + f(c.toDaN(Fs), 1) + ' daN. Anzahl = ' + f(c.toDaN(Fs), 1) + ' / ' + f(LC, 0) + ' = ' + f(q, 2) + ', aufgerundet ' + n + ' Gurte.', ['Die Reibung hält einen Teil, die Gurte nur den Rest: m · g · (c − µ).', 'Teile den Rest in daN durch LC und runde auf.']);
    },
    nieder: R => {
      const c = C(); let d, e, m, STF, al, q;
      for (let i = 0; i < 600; i++) {
        d = c.pick(R, c.DIRS); e = c.pick(R, c.MU.filter(x => x.mu >= 0.3 && x.mu < 0.6 + 1e-9)); m = c.ri(R, 4, 25) * 1000; STF = c.pick(R, [300, 400, 500]); al = c.pick(R, [90, 60]);
        const s = al === 90 ? 1 : 0.866; q = c.secureForce(m, d.c, e.mu) / (2 * e.mu * STF * 10 * s);
        const q2 = c.secureForce(m, d.c, e.mu) / (2 * e.mu * STF * 10 * (al === 90 ? 1 : 0.87));
        if (e.mu < d.c && loose(q) && Math.ceil(q) === Math.ceil(q2) && q > 1.2) break;
      }
      const n = c.lashDown(m, d.c, e.mu, STF, al), Fs = c.secureForce(m, d.c, e.mu);
      return numQ('Eine Ladung von ' + f(m, 0) + ' kg steht auf ' + e.n + ' (µ = ' + f(e.mu, 2) + ') und wird nur durch Niederzurren gesichert. Beschleunigung ' + dirTxt(d) + '. Jeder Gurt hat STF = ' + f(STF, 0) + ' daN, Zurrwinkel α = ' + al + '° (sin α ' + (al === 90 ? '= 1' : '≈ 0,87') + '). Wie viele Gurte brauchst du mindestens (g = 9,81 m/s², Faktor 2 für beide Gurtseiten)?', n, 'Gurte', 'Anzahl Zurrgurte', 0.01,
        'Anzahl = m · g · (c − µ) / (2 · µ · STF · sin α) = ' + f(Fs, 0) + ' N / (2 · ' + f(e.mu, 2) + ' · ' + f(STF * 10, 0) + ' N · ' + (al === 90 ? '1' : '0,866') + ') = ' + f(q, 2) + ', aufgerundet ' + n + ' Gurte. (STF in daN mal 10 ergibt N.)', ['Beim Niederzurren hält die Reibung, die der Gurt durch seine Vorspannkraft erzeugt.', 'Der Nenner enthält 2 · µ · STF · sin α, alles in N (1 daN = 10 N). Zum Schluss aufrunden.']);
    },
    reicht: R => {
      const c = C(); let d, e, m, LC, q;
      for (let i = 0; i < 400; i++) { d = c.pick(R, c.DIRS); e = c.pick(R, c.MU.filter(x => x.mu >= 0.2)); m = c.ri(R, 6, 30) * 1000; LC = c.pick(R, [1000, 1250, 2000, 2500]); q = c.secureForce(m, d.c, e.mu) / (LC * 10); if (e.mu < d.c && loose(q) && q > 1.2) break; }
      const need = c.lashDirect(m, d.c, e.mu, LC), have = need + c.pick(R, [-1, 0, 1]), ok = have >= need;
      return choiceQ(R, 'Eine Ladung von ' + f(m, 0) + ' kg steht auf ' + e.n + ' (µ = ' + f(e.mu, 2) + '). Beschleunigung ' + dirTxt(d) + '. Du hast ' + have + ' Direktzurrgurte mit LC = ' + f(LC, 0) + ' daN (g = 9,81 m/s²). Reicht das?',
        ok ? 'Ja, die Zurrgurte reichen aus' : 'Nein, es fehlt mindestens ein Zurrgurt', [ok ? 'Nein, es fehlt mindestens ein Zurrgurt' : 'Ja, die Zurrgurte reichen aus', 'Das lässt sich ohne den Zurrwinkel nicht sagen'],
        'Nötige Kraft = m · g · (c − µ) = ' + f(c.secureForce(m, d.c, e.mu), 0) + ' N = ' + f(c.toDaN(c.secureForce(m, d.c, e.mu)), 1) + ' daN. Nötige Gurte = ' + f(q, 2) + ', aufgerundet ' + need + '. Vorhanden: ' + have + ', also ' + (ok ? 'ausreichend.' : 'zu wenig.') + ' (Im Übungsmodell wird der Zurrwinkel vernachlässigt.)', ['Berechne zuerst, wie viele Gurte nötig sind, und vergleiche mit den vorhandenen.', 'Nötige Anzahl immer aufrunden.']);
    },
    art: pq(ARTQ),
    klasse: R => {
      const c = C(), s = c.pick(R, STOFF), r = CLS[s[1]];
      return choiceQ(R, 'Zu welcher Gefahrgutklasse gehört: ' + s[0] + '?', r, c.shuffle(R, Object.keys(CLS).filter(k => k !== s[1])).slice(0, 3).map(k => CLS[k]),
        s[0] + ' gehört zur ' + r + '. Die Klassen 1 bis 9 ordnen Stoffe nach ihrer Hauptgefahr.', ['Welche Gefahr steht im Vordergrund: Brand, Explosion, Gift, Ätzwirkung?', 'Schau im Reiter Gefahrgut bei den typischen Beispielen nach.']);
    },
    zettel: R => {
      const c = C(), z = c.pick(R, ZETTEL), r = CLS[z[1]];
      return choiceQ(R, 'Ein Gefahrzettel zeigt: ' + z[0] + '. Zu welcher Klasse gehört er?', r, c.shuffle(R, Object.keys(CLS).filter(k => k !== z[1])).slice(0, 3).map(k => CLS[k]),
        'Dieser Gefahrzettel gehört zur ' + r + '.', ['Achte auf Farbe und Symbol des Zettels.', 'Orange = Explosion, rot = brennbar, gelb = oxidierend oder radioaktiv, grün = Gas, schwarz-weiß = ätzend.']);
    },
    un: R => {
      const c = C(), u = c.pick(R, UN), others = c.shuffle(R, UN.filter(x => x[1] !== u[1])).slice(0, 2).map(x => x[1]);
      return choiceQ(R, 'Auf einer orangen Warntafel steht oben "' + u[2] + '" und darunter "' + u[1] + '". Welche Zahl ist die UN-Nummer des Stoffes?', u[1], [u[2]].concat(others),
        'Oben steht die Gefahrnummer (' + u[2] + ', zwei bis drei Ziffern), unten die vierstellige UN-Nummer (' + u[1] + ', hier ' + u[0] + ').', ['Eine der beiden Zahlen hat genau vier Ziffern.', 'Die UN-Nummer steht unten, die Gefahrnummer oben.']);
    },
    kennz: pq(GGQ),
    frei: R => {
      const c = C(), a = c.pick(R, [2, 5, 8, 10, 12]), b = c.pick(R, [30, 60, 90, 120, 150]), cc = c.pick(R, [50, 100, 200, 300]), P = c.points([{ amount: a, factor: 50 }, { amount: b, factor: 3 }, { amount: cc, factor: 1 }]);
      return numQ('Übungsbeispiel zur Mengen-Freigrenze: Ein Fahrzeug befördert ' + a + ' kg Gefahrgut der Beförderungskategorie 1 (Faktor 50), ' + b + ' kg der Kategorie 2 (Faktor 3) und ' + cc + ' kg der Kategorie 3 (Faktor 1). Berechne die Summe der Punkte. (Die Grenze im Beispiel liegt bei 1.000 Punkten.)', P, 'Punkte', 'Summe der Punkte', 0.5,
        'Punkte = ' + a + ' · 50 + ' + b + ' · 3 + ' + cc + ' · 1 = ' + f(a * 50, 0) + ' + ' + f(b * 3, 0) + ' + ' + f(cc, 0) + ' = ' + f(P, 0) + ' Punkte. ' + (c.exceeded(P) ? 'Das ist mehr als 1.000: Die Freigrenze ist überschritten.' : 'Das ist nicht mehr als 1.000: Im Beispiel bleibt die Freigrenze eingehalten.'), ['Jede Menge wird mit dem Faktor ihrer Kategorie multipliziert.', 'Danach alle drei Ergebnisse addieren.']);
    },
    phoehe: R => {
      const c = C(), n = c.ri(R, 3, 8), h = c.pick(R, [150, 180, 200, 220, 250, 300]), H = c.palHeight(n, h);
      return numQ('Auf einer Europalette (Höhe 144 mm) liegen ' + n + ' Lagen Kartons mit je ' + h + ' mm Höhe. Wie hoch ist die Ladeeinheit insgesamt in mm?', H, 'mm', 'Gesamthöhe', 0.5,
        'Gesamthöhe = Palettenhöhe + Lagen · Kartonhöhe = 144 + ' + n + ' · ' + h + ' = ' + f(H, 0) + ' mm.', ['Vergiss die Palette selbst nicht.', '144 mm plus Lagen mal Kartonhöhe.']);
    },
    stapel: R => {
      const c = C(); let H, room, q;
      for (let i = 0; i < 300; i++) { H = c.palHeight(c.ri(R, 3, 8), c.pick(R, [150, 180, 200, 220, 250, 300])); room = c.pick(R, [2400, 2700, 3000, 3600, 4200, 5000]); q = room / H; if (loose(q) && q >= 1.5) break; }
      const n = c.stackCount(room, H);
      return numQ('Eine Ladeeinheit ist ' + f(H, 0) + ' mm hoch. Die Lagerhöhe beträgt ' + f(room, 0) + ' mm. Wie viele solcher Einheiten kannst du höchstens übereinander stellen (nur nach der Höhe gerechnet)?', n, 'Stück', 'Einheiten übereinander', 0.01,
        'Raumhöhe / Einheitshöhe = ' + f(room, 0) + ' / ' + f(H, 0) + ' = ' + f(q, 2) + '. Es zählen nur ganze Einheiten, also abgerundet ' + n + '.', ['Teile die Lagerhöhe durch die Höhe einer Einheit.', 'Eine angefangene Einheit passt nicht, also abrunden.']);
    },
    schwer: R => {
      const c = C(), H = c.ri(R, 6, 16) * 100, hs = c.cgHeight(H);
      return numQ('Eine gleichmäßig gepackte Ladeeinheit ist einschließlich Palette ' + f(H, 0) + ' mm hoch. In welcher Höhe über dem Boden liegt der Schwerpunkt (vereinfacht)?', hs, 'mm', 'Schwerpunkthöhe', 0.5,
        'Bei gleichmäßiger Packung liegt der Schwerpunkt in der Mitte: ' + f(H, 0) + ' / 2 = ' + f(hs, 0) + ' mm.', ['Der Schwerpunkt eines gleichmäßigen Quaders liegt in der Mitte.', 'Halbe Gesamthöhe.']);
    },
    kipp: R => {
      const c = C(), d = c.pick(R, c.DIRS.slice(0, 2)), dim = c.pick(R, [800, 1200]), lim = c.tipLimit(dim, d.c);
      return numQ('Eine gleichmäßig gepackte Ladeeinheit ist in Richtung der Beschleunigung ' + f(dim, 0) + ' mm lang (Beschleunigung ' + dirTxt(d) + '). In welcher Schwerpunkthöhe in mm kippt sie gerade noch nicht (Kippgrenze, nur Kippen berücksichtigen)?', lim, 'mm', 'Kippgrenze Schwerpunkthöhe', 1,
        'Die Ladung kippt, wenn c · hs größer als die halbe Länge ist. Kippgrenze: hs = (Länge / 2) / c = (' + f(dim, 0) + ' / 2) / ' + f(d.c, 1) + ' = ' + f(dim / 2, 0) + ' / ' + f(d.c, 1) + ' = ' + f(lim, 0) + ' mm.', ['Die Kippkante liegt eine halbe Länge vom Schwerpunkt entfernt.', 'hs = (halbe Länge) / c.']);
    },
    symA, symB,
    nebe: R => {
      const c = C(), w = c.pick(R, [240, 245, 248]), o = c.pick(R, ['laengs', 'quer']), side = o === 'laengs' ? 80 : 120, n = c.perRow(w, side);
      return numQ('Die Ladefläche eines Lkw ist ' + f(w / 100, 2) + ' m breit. Europaletten (1200 mm × 800 mm) stehen ' + (o === 'laengs' ? 'längs (die lange Seite in Fahrtrichtung, quer zur Fahrtrichtung zählt die 0,80 m breite Seite)' : 'quer (die kurze Seite in Fahrtrichtung, quer zur Fahrtrichtung zählt die 1,20 m lange Seite)') + '. Wie viele Paletten passen nebeneinander?', n, 'Paletten', 'Paletten nebeneinander', 0.01,
        'Breite der Ladefläche / Palettenbreite quer = ' + f(w / 100, 2) + ' / ' + f(side / 100, 2) + ' = ' + f(w / side, 2) + '. Es zählen nur ganze Paletten, also ' + n + '.', ['Teile die Ladeflächenbreite durch das Maß der Palette quer zur Fahrtrichtung.', 'Abrunden, eine halbe Palette passt nicht.']);
    },
    breite: R => {
      const c = C(), o = c.pick(R, ['laengs', 'quer']), side = o === 'laengs' ? 0.8 : 1.2, n = o === 'laengs' ? c.ri(R, 2, 3) : c.ri(R, 1, 2), B = n * side;
      return numQ(n + ' Europaletten stehen nebeneinander, ' + (o === 'laengs' ? 'jede mit ihrer 0,80 m langen Seite quer zur Fahrtrichtung' : 'jede mit ihrer 1,20 m langen Seite quer zur Fahrtrichtung') + '. Wie breit ist die Ladung in Metern?', B, 'm', 'Ladungsbreite', 0.005,
        'Ladungsbreite = Anzahl · Maß quer = ' + n + ' · ' + f(side, 2) + ' m = ' + f(B, 2) + ' m.', ['Anzahl der Paletten mal das Maß quer zur Fahrtrichtung.', 'Beachte, ob 0,80 m oder 1,20 m quer liegen.']);
    },
    anzahl: R => {
      const c = C(), o = c.pick(R, ['laengs', 'quer']), e = c.euroCount(o);
      return numQ('Die Ladefläche eines Lkw misst 13,60 m × 2,45 m. Europaletten (1200 mm × 800 mm) werden ' + (o === 'laengs' ? 'längs (lange Seite in Fahrtrichtung)' : 'quer (kurze Seite in Fahrtrichtung)') + ' in dichten Reihen geladen. Wie viele Paletten passen insgesamt?', e.n, 'Paletten', 'Palettenanzahl', 0.01,
        'Nebeneinander: 2,45 m / ' + f(e.breite / 100, 2) + ' m = ' + f(2.45 / (e.breite / 100), 2) + ' → ' + e.across + '. Reihen: 13,60 m / ' + f(e.tiefe / 100, 2) + ' m = ' + f(13.6 / (e.tiefe / 100), 2) + ' → ' + e.rows + '. Gesamt: ' + e.across + ' · ' + e.rows + ' = ' + e.n + ' Paletten.', ['Rechne getrennt: Wie viele nebeneinander, wie viele Reihen hintereinander?', 'Beide Zahlen abrunden und multiplizieren.']);
    },
    ausn: R => {
      const c = C(), n = c.ri(R, 24, 34), u = c.rd(c.utilization(n), 1);
      return numQ('Auf einen Lkw mit 13,60 m × 2,45 m Ladefläche sind ' + n + ' Europaletten (1,20 m × 0,80 m) geladen. Berechne die Ladeflächenausnutzung in Prozent (eine Nachkommastelle).', u, '%', 'Ladeflächenausnutzung', 0.1,
        'Palettenfläche = ' + n + ' · 1,20 · 0,80 = ' + f(n * 0.96, 2) + ' m². Ladefläche = 13,60 · 2,45 = 33,32 m². Ausnutzung = ' + f(n * 0.96, 2) + ' / 33,32 · 100 = ' + f(u, 1) + ' %.', ['Fläche der Paletten durch Ladefläche, mal 100.', 'Eine Europalette hat 0,96 m².']);
    },
    /* PRUEFEN P16: Nutzlast 24.000 kg und Palettengewichte 600 bis 1.100 kg sind frei gewählte Übungswerte (reale Nutzlast hängt vom Fahrzeug ab). */
    nutz: R => {
      const c = C(), m = c.pick(R, [600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100]), byW = Math.floor(24000 / m + 1e-9), v = Math.min(33, byW);
      return numQ('Auf der Ladefläche ist Platz für 33 Europaletten. Der Lkw darf höchstens 24.000 kg laden (Übungswert), jede Palette wiegt ' + f(m, 0) + ' kg. Wie viele Paletten dürfen höchstens geladen werden?', v, 'Paletten', 'Palettenanzahl', 0.01,
        'Nach dem Gewicht: 24.000 / ' + f(m, 0) + ' = ' + f(24000 / m, 2) + ' → ' + byW + ' Paletten. Nach dem Platz: 33. Es gilt der kleinere Wert: ' + v + ' Paletten.', ['Zwei Grenzen: Platz und Gewicht. Die kleinere gilt.', 'Teile 24.000 durch das Palettengewicht und runde ab.']);
    },
    ver: pq(VERQ)
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument (Indexliste für Pools) */
  const defs = [
    ['Kräfte und Reibung', 1, 'Gewichtskraft einer Palette', 'gewicht'], ['Kräfte und Reibung', 1, 'Reibbeiwert nachschlagen', 'mu'], ['Kräfte und Reibung', 2, 'Reibkraft berechnen', 'reib'], ['Kräfte und Reibung', 2, 'Palette und Beschleunigung', 'rutscht'], ['Kräfte und Reibung', 3, 'Kraft für die Zurrmittel', 'fehl'],
    ['Sicherungsarten', 1, 'Sicherung beschreiben', 'art', [0, 3]], ['Sicherungsarten', 1, 'Gurt am Fahrzeug', 'art', [1, 2]], ['Sicherungsarten', 2, 'Reibung und Nässe', 'art', [4, 5]], ['Sicherungsarten', 2, 'Zurrmittel prüfen', 'art', [6, 7, 8, 9]],
    ['Zurrkraft berechnen', 1, 'Beschleunigungsbeiwert wählen', 'cwahl'], ['Zurrkraft berechnen', 2, 'Massenkraft in daN', 'fx'], ['Zurrkraft berechnen', 2, 'Gurte ohne Reibung', 'direkt'], ['Zurrkraft berechnen', 3, 'Gurte mit Reibung', 'direktmu'], ['Zurrkraft berechnen', 3, 'Gurtanzahl Niederzurren', 'nieder'], ['Zurrkraft berechnen', 3, 'Gurtanzahl prüfen', 'reicht'],
    ['Gefahrgut', 1, 'Stoff und Klasse', 'klasse'], ['Gefahrgut', 1, 'Zettel und Klasse', 'zettel'], ['Gefahrgut', 2, 'Warntafel lesen', 'un'], ['Gefahrgut', 2, 'Kennzeichnung', 'kennz', [0, 1, 2, 3]], ['Gefahrgut', 3, 'Mengen-Freigrenze (Beispiel)', 'frei'],
    ['Stapelung und Standsicherheit', 1, 'Höhe der Ladeeinheit', 'phoehe'], ['Stapelung und Standsicherheit', 2, 'Einheiten übereinander', 'stapel'], ['Stapelung und Standsicherheit', 2, 'Lage des Schwerpunkts', 'schwer'], ['Stapelung und Standsicherheit', 3, 'Grenze der Standsicherheit', 'kipp'],
    ['Verpackungssymbole', 1, 'Zeichen auf dem Karton', 'symA'], ['Verpackungssymbole', 1, 'Zeichen zur Anweisung', 'symB'],
    ['Ladeeinheiten und Stauraum', 1, 'Paletten nebeneinander', 'nebe'], ['Ladeeinheiten und Stauraum', 2, 'Breite der Ladung', 'breite'], ['Ladeeinheiten und Stauraum', 2, 'Paletten im Lkw', 'anzahl'], ['Ladeeinheiten und Stauraum', 3, 'Ausnutzung der Ladefläche', 'ausn'], ['Ladeeinheiten und Stauraum', 3, 'Platz und Gewicht', 'nutz'],
    ['Verantwortung', 1, 'Wer verlädt?', 'ver', [0, 4]], ['Verantwortung', 1, 'Wer kontrolliert?', 'ver', [1, 3]], ['Verantwortung', 2, 'Gefahrgut-Pflichten', 'ver', [2]]
  ];
  const tasks = defs.map((d, i) => ({ id: 'lad' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('lad-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Schritte entstehen im UI aus LAD_CORE) ---------- */
  const examples = [
    { id: 'zurr1', tab: 'kr', title: 'Direktzurren einer Maschine nach vorn', text: 'Eine Maschine von 10.000 kg steht auf nasser Holzpalette (µ = 0,3). Bei Vollbremsung wirkt c = 0,8. Du sicherst mit Direktzurren, Zurrgurt LC = 2.000 daN. Wie viele Gurte sind mindestens nötig?', p: { m: 10000, mu: 0.3, dir: 'v', LC: 2000, STF: 400, alpha: 90 } },
    { id: 'zurr2', tab: 'kr', title: 'Antirutschmatte macht die Sicherung leichter', text: 'Eine Ladung von 6.000 kg steht auf einer Antirutschmatte (µ = 0,6). Seitlich wirkt c = 0,5. Wie viel müssen die Gurte noch halten?', p: { m: 6000, mu: 0.6, dir: 's', LC: 2000, STF: 400, alpha: 90 } },
    { id: 'zurr3', tab: 'kr', title: 'Niederzurren mit Ratsche', text: 'Eine Ladung von 8.000 kg steht auf trockenem Siebdruckboden (µ = 0,45). Vorwärts wirkt c = 0,8. Zurrgurte mit STF = 400 daN, Zurrwinkel 90°.', p: { m: 8000, mu: 0.45, dir: 'v', LC: 2000, STF: 400, alpha: 90 } },
    { id: 'kipp1', tab: 'stap', title: 'Kippt die hohe Palette?', text: 'Sechs Lagen Kartons à 200 mm auf einer Europalette. Die Ladung ist in Fahrtrichtung 800 mm lang (kurze Seite vorn). Bei Vollbremsung wirkt c = 0,8.', p: { lagen: 6, hl: 200, room: 3000, d: 800, dir: 'v' } },
    { id: 'stap1', tab: 'stap', title: 'Stapelhöhe und Standsicherheit', text: 'Vier Lagen Kartons à 250 mm auf einer Europalette, die lange Seite (1200 mm) liegt in Fahrtrichtung. Die Lagerhöhe beträgt 3.000 mm.', p: { lagen: 4, hl: 250, room: 3000, d: 1200, dir: 'v' } },
    { id: 'lade1', tab: 'lade', title: 'Europaletten längs: 33 Stück', text: 'Die Paletten stehen mit der langen Seite in Fahrtrichtung, drei nebeneinander und elf Reihen hintereinander. Es bleiben 40 cm Restlänge ungenutzt.', p: { orient: 'laengs', kg: 700 } },
    { id: 'lade2', tab: 'lade', title: 'Europaletten quer: 34 Stück', text: 'Die Paletten stehen mit der kurzen Seite in Fahrtrichtung, zwei nebeneinander und 17 Reihen hintereinander. Die Ladefläche wird fast vollständig genutzt.', p: { orient: 'quer', kg: 700 } },
    { id: 'frei1', tab: 'gg', title: 'Mengen-Freigrenze als Beispiel', text: 'Ein Fahrzeug nimmt 5 kg der Kategorie 1, 100 kg der Kategorie 2 und 200 kg der Kategorie 3 mit. Bleibt die Summe unter der Beispiel-Grenze von 1.000 Punkten?', p: { a: 5, b: 100, c: 200 } }
  ];

  root.LAD_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, sets: SETS, cls: CLS, un: UN, stoff: STOFF, sym: SYM };
  root.LAD_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.LAD_DATA, TASKS: root.LAD_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
