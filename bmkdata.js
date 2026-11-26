'use strict';
/* Tonfunk Plan-Lab: Daten (Aufgaben-Generatoren, Beispiele).
   Anlage, Orte, Klemmenplan, Farben für Steuerleitungen und alle Zahlen sind frei erfundene ÜBUNGSWERTE. Die Kennbuchstaben folgen der heute üblichen Belegung, ältere Pläne weichen teils ab.
   window.BMK_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples }
   window.BMK_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'bmk', Status in localStorage 'lm4.bmk.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Aufgabe nennt unter "So gehst du vor" die Schritte der Reihe nach. Optional: q.img (Bild), q.tables (Tabellen im Aufgabentext).
   Nicht doppeln (siehe nrmlab): CE-Kennzeichnung, Schutzarten, Maschinensicherheit, Qualitätsmanagement. */
(function (root) {
  const C = () => root.BMK_CORE;
  const CATS = ['Plantypen und Zweck', 'Kennbuchstaben der Betriebsmittel', 'Referenzkennzeichen', 'Strompfade und Kontaktspiegel', 'Anschluss- und Klemmenbezeichnung', 'Schaltzeichen erkennen'];

  /* Auswahl: genau eine richtige Antwort, die falschen sind verschieden und nie gleich der richtigen */
  function choiceQ(R, text, steps, right, wrong, expl, tips, extra) {
    const w = Array.from(new Set(wrong)).filter(x => x !== right).slice(0, 3), ch = C().shuffle(R, [right].concat(w));
    return Object.assign({ text, steps, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips }, extra);
  }
  const numQ = (text, steps, value, unit, label, expl, tips, extra) => Object.assign({ text, steps, ask: { type: 'num', unit, label }, value, tol: 0, expl, tips }, extra);
  const pq = (POOL, steps) => R => { const q = C().pick(R, POOL); return choiceQ(R, q[0], steps, q[1], q[2], q[3], q[4]); };
  const ORD = ['erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste'];
  const num = n => String(n);
  /* Plan-Spalten für Tabellen im Aufgabentext */
  const klemTab = ks => ({ title: 'Klemmenplan -X1', head: ['Klemme', 'Quelle (innen)', 'Ziel (außen)', 'Farbe', 'mm²'], rows: ks.map(k => [num(k.n), k.innen, k.aussen, k.f, k.q]) });

  /* ---------- Thema 1: Plantypen ---------- */
  const S_ZWECK = ['Lies, was du aus dem Plan erfahren willst: Aufbau, Funktion, Anschluss oder Prüfung.', 'Überlege, welcher Plan genau diese Auskunft gibt.', 'Streiche die Pläne, die etwas anderes zeigen, und wähle den passenden.'];
  const ZWECK = [
    ['Du willst auf einen Blick sehen, aus welchen Teilen eine Anlage besteht und wie sie grob zusammenarbeiten. Einzelne Adern interessieren dich noch nicht. Welchen Plan nimmst du?', 'Übersichtsplan', ['Klemmenplan', 'Verdrahtungsliste', 'Anschlussplan'], 'Der Übersichtsplan zeigt die Bausteine und deren Zusammenhänge grob, ohne einzelne Verbindungen. Die anderen Unterlagen gehen ins Detail.', ['Gesucht ist der Plan, der nur das Große und Ganze zeigt.', 'Pläne mit Klemmen, Adern oder Anschlüssen sind Detailpläne.']],
    ['Eine Steuerung schaltet nicht wie gewünscht. Du willst Strompfad für Strompfad nachlesen, wie die Schaltung arbeitet. Welchen Plan nimmst du?', 'Stromlaufplan', ['Übersichtsplan', 'Klemmenplan', 'Verdrahtungsliste'], 'Der Stromlaufplan zeigt die Funktion der Schaltung in Strompfaden. Mit ihm verfolgst du den Weg des Stroms und findest die Stelle, an der es klemmt.', ['Es geht um die Funktion der Schaltung, nicht um den Aufbau.', 'Strompfade gibt es nur in einem Plan.']],
    ['Du verdrahtest eine Klemmleiste. Du brauchst die Zeichnung oder Tabelle der Klemmleiste selbst: Klemme für Klemme, mit der Quelle im Schrank und dem Ziel im Feld. Was nimmst du?', 'Klemmenplan', ['Übersichtsplan', 'Stromlaufplan', 'Verdrahtungsliste'], 'Der Klemmenplan ist nach der Klemmleiste geordnet und nennt für jede Klemme Quelle und Ziel. Die Verdrahtungsliste ist dagegen nach Verbindungen geordnet.', ['Die Ordnung nach Klemmennummern verrät den Plan.', 'Die Verdrahtungsliste ordnet nach Verbindung, nicht nach Klemme.']],
    ['Du sollst nach dem Aufbau jede einzelne Verbindung als Zeile abhaken, mit Quelle, Ziel, Aderfarbe und Querschnitt. Welche Unterlage ist dafür gemacht?', 'Verdrahtungsliste', ['Übersichtsplan', 'Stromlaufplan', 'Anschlussplan'], 'In der Verdrahtungsliste ist jede Verbindung eine Zeile mit Quelle, Ziel, Farbe und Querschnitt. So prüfst du den Aufbau Verbindung für Verbindung.', ['Gesucht ist eine Liste, keine Zeichnung.', 'Eine Zeile je Verbindung.']],
    ['Du willst wissen, an welche Anschlüsse eines Geräts, zum Beispiel eines Schützes, welche Leitungen geklemmt werden. Das Gerät ist mit seinen Anschlusspunkten und den angeschlossenen Leitungen gezeichnet. Welcher Plan ist das?', 'Anschlussplan', ['Übersichtsplan', 'Stromlaufplan', 'Klemmenplan'], 'Der Anschlussplan zeigt das Gerät mit seinen Anschlusspunkten und wie die Leitungen angeschlossen werden. Er dient dem Verdrahten, nicht dem Verstehen der Funktion.', ['Es geht um das Gerät und seine Anschlusspunkte.', 'Das Wort Anschluss steckt im Namen des Plans.']]
  ];
  const S_DARST = ['Achte darauf, wie Spule und Kontakte gezeichnet sind: getrennt oder als ein Block.', 'Ordne die Beschreibung der passenden Darstellung zu.'];
  const DARST = [
    ['Im Plan steht die Spule K1 im Strompfad 2. Die zugehörigen Kontakte stehen weit entfernt in den Strompfaden 1, 3 und 5 und sind nur über Querverweise mit der Spule verbunden. Welche Darstellung ist das?', 'Aufgelöste Darstellung', ['Zusammenhängende Darstellung', 'Übersichtsdarstellung', 'Klemmenplan'], 'Spule und Kontakte sind getrennt gezeichnet, jedes Teil steht in dem Strompfad, in dem es arbeitet. Das ist die aufgelöste Darstellung.', ['Spule und Kontakte stehen getrennt.', 'Querverweise verbinden die getrennten Teile.']],
    ['Jedes Schütz ist als ein einziger Block gezeichnet. Spule und Kontakte stehen zusammen, eine gestrichelte Linie zeigt, dass sie zusammengehören. Welche Darstellung ist das?', 'Zusammenhängende Darstellung', ['Aufgelöste Darstellung', 'Übersichtsdarstellung', 'Verdrahtungsliste'], 'Bei der zusammenhängenden Darstellung bleibt jedes Gerät als Ganzes beisammen, die gestrichelte Wirklinie verbindet seine Teile.', ['Gestrichelte Linie, Teile bleiben zusammen.', 'Das Gegenstück ist die aufgelöste Darstellung.']],
    ['Warum wird bei größeren Steuerungen meist die aufgelöste Darstellung gewählt?', 'Die Strompfade lassen sich übersichtlich nebeneinander zeichnen, ohne dass sich Linien kreuzen', ['Weil dann weniger Betriebsmittel gebraucht werden', 'Weil dann keine Kennzeichen nötig sind', 'Weil die Kontakte dann schneller schalten'], 'Die Darstellung ändert nur die Zeichnung, nicht die Schaltung. Getrennte Teile halten die Strompfade übersichtlich und frei von Kreuzungen.', ['Die Darstellung ändert nichts an der Schaltung selbst.', 'Es geht um die Übersicht beim Lesen.']],
    ['Du suchst im aufgelösten Plan alle Kontakte zu einer Spule. Was hilft dir dabei?', 'Der Kontaktspiegel bzw. die Querverweise unter der Spule', ['Die Farbe der Leitungen', 'Die Verdrahtungsliste', 'Die Klemmennummer der Spule'], 'Unter der Spule nennt der Kontaktspiegel die Strompfade der zugehörigen Kontakte. Dort schaust du nach.', ['Die Spule weiß, wo die zugehörigen Kontakte stehen.', 'Es steht direkt unter der Spule.']]
  ];
  const S_UEBER = ['Überlege, welche Auskunft ein Plan gibt und für wen er gedacht ist.', 'Prüfe jede Antwort: Passt sie zu dem, was der Plan zeigt?'];
  const UEBER = [
    ['Was zeigt ein Übersichtsplan nicht?', 'Die einzelnen Klemmen und Adern jeder Verbindung', ['Welche Anlagenteile es gibt', 'Wie die Anlagenteile zusammenarbeiten', 'Wo Energie und Signale grob fließen'], 'Der Übersichtsplan bleibt grob. Klemmen und Adern stehen erst in den Detailplänen und Listen.', ['Er zeigt das Große, nicht das Kleine.', 'Adern gehören in die Detailunterlagen.']],
    ['Du sollst eine fremde Anlage kennenlernen. Womit fängst du beim Lesen der Unterlagen sinnvoll an?', 'Mit dem Übersichtsplan, danach folgen die Detailpläne', ['Mit der Verdrahtungsliste, weil sie am genauesten ist', 'Mit dem Klemmenplan der letzten Klemmleiste', 'Mit irgendeinem Stromlaufplan, alle sind gleich'], 'Erst der Überblick, dann das Detail: So ordnest du jeden Detailplan in die Anlage ein.', ['Vom Groben zum Feinen.', 'Der Überblick hilft, sich später nicht zu verlieren.']],
    ['Welcher Satz über Stromlaufplan und Anschlussplan stimmt?', 'Der Stromlaufplan zeigt, wie die Schaltung funktioniert; der Anschlussplan zeigt, wie die Geräte angeschlossen werden', ['Beide zeigen das Gleiche, nur mit anderen Farben', 'Der Anschlussplan zeigt die Funktion, der Stromlaufplan die Anschlüsse', 'Der Stromlaufplan gilt nur für Motoren, der Anschlussplan nur für Leuchten'], 'Funktion und Anschluss sind zwei verschiedene Fragen. Dafür gibt es zwei verschiedene Pläne.', ['Funktion gegen Anschluss.', 'Welcher Plan erklärt die Arbeitsweise?']]
  ];
  const S_AEND = ['Überlege, welche Unterlagen das geänderte Betriebsmittel nennen.', 'Wähle die Antwort, bei der alle Unterlagen zueinander passen.'];
  const AEND = [
    ['In einer Steuerung wird ein Taster gegen einen Taster mit anderen Anschlusspunkten getauscht. Wo trägst du die Änderung ein?', 'In allen Unterlagen, in denen der Taster vorkommt (Stromlaufplan, Klemmenplan, Verdrahtungsliste)', ['Nur im Stromlaufplan, der Rest ergibt sich daraus', 'Nur in der Verdrahtungsliste, weil dort die Verbindungen stehen', 'Gar nicht, solange die Anlage läuft'], 'Die Unterlagen müssen zueinander und zum Aufbau passen. Sonst sucht der Nächste mit einem falschen Plan nach Fehlern.', ['Ein Betriebsmittel kommt in mehreren Unterlagen vor.', 'Alle Unterlagen sollen am Ende dasselbe sagen.']],
    ['Du findest beim Aufbau eine Abweichung vom Plan, die so bleiben soll. Was ist richtig?', 'Die Abweichung im Plan eintragen (mit Änderungsstand und Datum), damit Plan und Aufbau übereinstimmen', ['Nichts eintragen, der Aufbau funktioniert ja', 'Den Plan wegwerfen und neu zeichnen', 'Es mündlich dem nächsten Kollegen sagen'], 'Was nicht im Plan steht, kennt später niemand. Änderungen werden mit Stand und Datum nachgetragen.', ['Der Plan soll den echten Aufbau zeigen.', 'Mündliches geht verloren.']],
    ['Wozu hat ein Plan einen Änderungsstand mit Datum?', 'Damit erkennbar ist, welche Fassung die aktuelle ist', ['Damit der Plan umfangreicher aussieht', 'Weil sich Betriebsmittel sonst nicht kennzeichnen lassen', 'Damit die Spule die zugehörigen Kontakte findet'], 'Es gibt oft mehrere Fassungen. Der Änderungsstand zeigt, welche gilt.', ['Es geht um die Fassung des Plans.', 'Das Datum sagt, wie aktuell er ist.']]
  ];
  /* Zufällige Auswahl von Zeilen der Verdrahtungsliste; gefragt wird nach der Zahl der Adern mit einer Farbe oder einem Querschnitt */
  function aderzahl(R) {
    const c = C(), rows = c.shuffle(R, c.verdrahtung()).slice(0, 7).sort((a, b) => a.nr - b.nr), attr = c.pick(R, ['f', 'q']), key = attr === 'f' ? 'farbe' : 'q';
    const vals = Array.from(new Set(rows.map(r => r[key]))), v = c.pick(R, vals), n = rows.filter(r => r[key] === v).length;
    const what = attr === 'f' ? 'die Farbe ' + v : 'den Querschnitt ' + v + ' mm²';
    return numQ('Die Verdrahtungsliste eines Schaltschranks ist hier nur zum Teil abgedruckt. Wie viele der abgedruckten Adern haben ' + what + '?', ['Gehe die Tabelle Zeile für Zeile von oben nach unten durch.', 'Mache bei jeder Zeile einen Strich, wenn ' + (attr === 'f' ? 'die Farbe' : 'der Querschnitt') + ' passt.', 'Zähle die Striche.'],
      n, 'Adern', 'Anzahl', 'In der Spalte ' + (attr === 'f' ? 'Farbe' : 'mm²') + ' kommt ' + v + ' genau ' + n + 'mal vor.', ['Lies nur die Spalte ' + (attr === 'f' ? 'Farbe' : 'mm²') + '.', 'Streiche beim Zählen jede passende Zeile an, damit keine doppelt zählt.'],
      { tables: [{ title: 'Verdrahtungsliste (Auszug)', head: ['Nr.', 'Von', 'Nach', 'Farbe', 'mm²'], rows: rows.map(r => [num(r.nr), r.von, r.nach, r.farbe, r.q]) }] });
  }
  /* Klemmenplan und Verdrahtungsliste sollen übereinstimmen; in einer Zeile der Liste weicht genau ein Wert ab */
  function fehlerliste(R) {
    const c = C(), s = c.ri(R, 0, c.KLEMMEN.length - 6), ks = c.KLEMMEN.slice(s, s + 6), bad = c.ri(R, 0, 5), kind = c.pick(R, ['nach', 'farbe', 'q']);
    const rows = ks.map(k => ({ von: k.innen, nach: '-X1:' + k.n, farbe: k.f, q: k.q })), r = rows[bad], k = ks[bad];
    if (kind === 'nach') r.nach = '-X1:' + (k.n === 1 ? 2 : k.n - 1); else if (kind === 'farbe') r.farbe = c.pick(R, ['schwarz', 'rot', 'blau', 'grün-gelb', 'braun'].filter(x => x !== k.f)); else r.q = c.pick(R, ['0,75', '1,5', '2,5'].filter(x => x !== k.q));
    const kw = { nach: 'die Klemme', farbe: 'die Aderfarbe', q: 'der Querschnitt' }[kind];
    return numQ('Die Verdrahtungsliste soll zum Klemmenplan passen. In genau einer Zeile der Liste weicht ein Wert vom Klemmenplan ab. Welche Zeile (laufende Nummer der Liste) ist es?', ['Nimm die erste Zeile der Liste und suche die Klemme im Klemmenplan.', 'Vergleiche Quelle, Klemme, Farbe und Querschnitt mit dem Klemmenplan.', 'Gehe so Zeile für Zeile weiter, bis ein Wert nicht passt.'],
      bad + 1, 'Zeile', 'Zeile', 'In Zeile ' + (bad + 1) + ' weicht ' + kw + ' vom Klemmenplan ab. Alle anderen Zeilen stimmen mit dem Plan überein.', ['Fange oben an und hake jede Zeile ab.', 'Die Zeile der Liste und die Klemme sind nicht dasselbe: Zähle in der Liste von 1 bis 6.'],
      { tables: [klemTab(ks), { title: 'Verdrahtungsliste', head: ['Zeile', 'Von', 'Nach', 'Farbe', 'mm²'], rows: rows.map((x, i) => [num(i + 1), x.von, x.nach, x.farbe, x.q]) }] });
  }

  /* ---------- Thema 2: Kennbuchstaben ---------- */
  /* Beispiele, bei denen ältere und neuere Belegung oder die Praxis auseinanderliegen können, kommen in Aufgaben nicht vor (siehe PRUEFEN.md) */
  const EXKL = ['Leitungsschutzschalter', 'Frequenzumrichter', 'Netzgerät', 'Drossel', 'Heizelement', 'Leistungsschütz im Hauptstromkreis'];
  const exOk = () => C().KB.reduce((a, b) => a.concat(b.ex.filter(e => !EXKL.includes(e)).map(e => ({ k: b.k, e }))), []);
  const S_KB1 = ['Überlege, was das Betriebsmittel tut: schalten, schützen, messen, anzeigen, umformen ...', 'Ordne die Aufgabe dem Kennbuchstaben zu.', 'Prüfe, ob ein anderer Buchstabe besser passt.'];
  const S_KB2 = ['Überlege zu jedem Betriebsmittel, welche Aufgabe es hat.', 'Suche das Betriebsmittel, dessen Aufgabe zum Buchstaben passt.'];
  function kbz(R) {
    const c = C(), it = c.pick(R, exOk()), others = c.shuffle(R, c.KB.map(x => x.k).filter(k => k !== it.k)).slice(0, 3), kb = c.kbOf(it.k);
    return choiceQ(R, 'Welchen Kennbuchstaben trägt im Plan das Betriebsmittel "' + it.e + '"?', S_KB1, it.k, others, 'Kennbuchstabe ' + it.k + ' steht für: ' + kb.n.toLowerCase() + ' (zum Beispiel ' + kb.ex.filter(e => !EXKL.includes(e)).join(', ') + '). Achte auf die Aufgabe, nicht auf den Namen.', ['Frage dich: Was macht das Betriebsmittel in der Schaltung?', 'Der Name täuscht manchmal: Ein Überlastrelais schützt und heißt trotzdem Relais.']);
  }
  function kbrueck(R) {
    const c = C(), pool = exOk(), k = c.pick(R, c.KB.map(x => x.k)), right = c.pick(R, pool.filter(x => x.k === k)), kinds = c.shuffle(R, c.KB.map(x => x.k).filter(x => x !== k)).slice(0, 3);
    const wrong = kinds.map(x => c.pick(R, pool.filter(p => p.k === x)).e);
    return choiceQ(R, 'Welches dieser Betriebsmittel trägt im Plan den Kennbuchstaben ' + k + '?', S_KB2, right.e, wrong, 'Kennbuchstabe ' + k + ' steht für: ' + c.kbOf(k).n.toLowerCase() + '. Das passt zu "' + right.e + '". Die anderen tragen andere Buchstaben.', ['Wofür steht der Buchstabe ' + k + '? Denke an die Aufgabe, nicht an den Namen.', 'Streiche die Betriebsmittel, die offenbar etwas anderes tun.']);
  }
  function zaehlk(R) {
    const c = C(), letters = ['K', 'S', 'F', 'P', 'M', 'B'], L = c.pick(R, letters), n = c.ri(R, 1, 3), used = {}, list = [];
    const add = k => { let nr; do { nr = c.ri(R, 1, 6); } while (used[k + nr]); used[k + nr] = 1; list.push('-' + k + nr); };
    for (let i = 0; i < n; i++) add(L);
    const others = letters.filter(x => x !== L);
    while (list.length < 7) add(c.pick(R, others));
    return numQ('Im Stromlaufplan stehen diese Betriebsmittelkennzeichen: ' + c.shuffle(R, list).join(', ') + '. Wie viele davon beginnen mit dem Kennbuchstaben ' + L + '?', ['Lies jedes Kennzeichen von links.', 'Der Buchstabe hinter dem Minuszeichen ist der Kennbuchstabe.', 'Zähle alle, die mit ' + L + ' beginnen.'], n, 'Stück', 'Anzahl', 'Gezählt werden nur Kennzeichen mit ' + L + ' hinter dem Minuszeichen. Das sind ' + n + '. Die Zahl dahinter ist nur die Zählnummer.', ['Hinter dem Minuszeichen steht der Kennbuchstabe, danach die Zählnummer.', 'Die Zählnummer zählst du nicht mit.']);
  }
  function altneu(R) {
    const c = C(), a = c.pick(R, c.KB_ALT), wrong = [a.alt, 'Q', 'K', 'F', 'X'].filter(x => x !== a.neu);
    return choiceQ(R, 'Ein älterer Plan kennzeichnet "' + a.teil + '" mit ' + a.alt + '. Welchen Kennbuchstaben erwartest du dafür in einem Plan nach heutiger Belegung?', ['Lies, was das Betriebsmittel tut.', 'Denke daran, dass ältere Pläne einzelne Buchstaben anders vergeben haben.', 'Wähle den heute üblichen Buchstaben.'], a.neu, wrong, a.teil + ': früher ' + a.alt + ', heute ' + a.neu + '. Ältere Pläne weichen bei einzelnen Betriebsmitteln ab. Im Zweifel hilft die Zeichenerklärung (Legende) des Plans.', ['Ältere Pläne dürfen abweichen.', a.neu === 'P' ? 'Die Leuchte zeigt etwas an: Information darstellen.' : 'Der Endschalter erfasst eine Stellung und gibt ein Signal ab.']);
  }
  function kzschreiben(R) {
    const c = C(), it = c.pick(R, exOk().filter(x => x.e !== 'Beleuchtung')), nr = c.ri(R, 1, 9), right = '-' + it.k + nr;
    return choiceQ(R, 'Du kennzeichnest das Betriebsmittel "' + it.e + '", Nummer ' + nr + '. Wie schreibst du das Produktkennzeichen im Plan?', ['Suche den Kennbuchstaben des Betriebsmittels.', 'Hänge die Zählnummer an.', 'Setze das Vorzeichen für das Produkt davor.'], right, [it.k + nr + '-', '-' + nr + it.k, '+' + it.k + nr], 'Das Produktkennzeichen besteht aus Minuszeichen, Kennbuchstabe und Zählnummer: ' + right + '.', ['Reihenfolge: Vorzeichen, Buchstabe, Nummer.', 'Das Vorzeichen für das Produkt ist das Minuszeichen.']);
  }
  const PE = [
    ['Zwei Leuchten: Die Leuchte im Schaltschrank soll den Innenraum beleuchten. Die Meldeleuchte am Bedienpult zeigt "Anlage läuft" an. Welche Aussage stimmt?', 'Die Beleuchtung trägt E, die Meldeleuchte trägt P', ['Beide tragen P', 'Beide tragen E', 'Die Beleuchtung trägt P, die Meldeleuchte trägt E'], 'E steht für Licht oder Wärme abgeben, P für Information darstellen. Beleuchten ist etwas anderes als Anzeigen.', ['Frage dich bei jeder Leuchte: Beleuchtet sie oder zeigt sie etwas an?', 'Beleuchten gehört zu E, anzeigen zu P.']],
    ['Ein Summer im Bedienpult gibt bei einer Störung einen Warnton ab. Welcher Kennbuchstabe passt?', 'P, weil er eine Information darstellt', ['E, weil er Energie abgibt', 'M, weil sich in ihm etwas bewegt', 'S, weil er von Hand ausgelöst wird'], 'Der Summer meldet etwas: Er stellt Information dar. Das ist die Aufgabe von P, auch wenn er Schall abgibt.', ['Wozu ist der Summer da?', 'Er meldet, er bewegt nichts.']],
    ['Ein Näherungsschalter meldet, dass ein Teil am Band angekommen ist. Ein Taster wird vom Bediener gedrückt. Welche Aussage stimmt?', 'Der Näherungsschalter trägt B, der Taster trägt S', ['Beide tragen S', 'Beide tragen B', 'Der Näherungsschalter trägt S, der Taster trägt B'], 'B wandelt eine Messgröße oder Stellung in ein Signal um. S ist für Eingaben von Hand. Der Näherungsschalter arbeitet ohne Hand, der Taster mit.', ['Wer löst aus: ein Teil oder eine Hand?', 'Eingabe von Hand gehört zu S.']]
  ];
  const QK = [
    ['Welche Idee steckt hinter den Kennbuchstaben Q und K?', 'Q schaltet einen Energiefluss (Leistung), K verarbeitet Signale (Steuerung)', ['Q gehört allen Betriebsmitteln mit Spule, K allen ohne Spule', 'Q sind Sicherungen, K sind Klemmen', 'Es gibt keinen Unterschied, beide sind austauschbar'], 'Nach heutiger Belegung schaltet Q Leistung (zum Beispiel Leistungsschalter), K verarbeitet Signale (Relais, Hilfsschütz). In der Praxis tragen Leistungsschütze oft noch K, ältere Pläne kennen nur K.', ['Leistung gegen Signal.', 'Ein Relais verarbeitet ein Steuersignal.']],
    ['Ein Plan stammt aus älterer Zeit und kennzeichnet ein Schütz im Hauptstromkreis mit K1. Wie gehst du damit um?', 'Du liest den Plan trotzdem, denn die Zeichenerklärung und der Zusammenhang zeigen, was gemeint ist', ['Du ersetzt K1 sofort durch Q1 und änderst alle Unterlagen', 'Du hältst den Plan für falsch und fragst nicht nach', 'Du schaltest das Schütz ab, weil K1 nicht mehr gilt'], 'Ältere Pläne dürfen abweichen. Gelesen wird, was dort steht. Geändert wird nur, wenn ein Auftrag dazu besteht.', ['Ältere Pläne sind nicht falsch, nur anders.', 'Die Legende erklärt die Kennzeichen.']],
    ['Was ist ein typisches Merkmal von F im Plan?', 'Das Betriebsmittel schützt, zum Beispiel vor Überstrom oder Überlast', ['Das Betriebsmittel wandelt Messwerte in Signale um', 'Das Betriebsmittel verbindet Leitungen', 'Das Betriebsmittel zeigt Zustände an'], 'F steht für Schützen: Sicherung, Überlastrelais, Motorschutz.', ['F wie Schutz.', 'Denke an Sicherung.']]
  ];

  /* ---------- Thema 3: Referenzkennzeichen ---------- */
  const S_VZ = ['Lies, zu welchem Teil des Kennzeichens du das Vorzeichen suchst.', 'Rufe dir die vier Vorzeichen in Erinnerung: Funktion, Ort, Produkt, Anschluss.', 'Wähle das Zeichen, das vor diesem Teil steht.'];
  function vorz(R) {
    const c = C(), t = c.pick(R, c.TEILE), nm = { f: '= (Gleichheitszeichen)', o: '+ (Pluszeichen)', p: '- (Minuszeichen)', a: ': (Doppelpunkt)' };
    return choiceQ(R, 'Welches Vorzeichen steht im Referenzkennzeichen vor dem Teil "' + t[1] + '" (' + t[2] + ')?', S_VZ, nm[t[0]], c.TEILE.filter(x => x[0] !== t[0]).map(x => nm[x[0]]), 'Vor der Funktion steht =, vor dem Ort +, vor dem Produkt - und vor dem Anschluss :. Beispiel: =A1+S1-K3:13.', ['Merke dir das Beispiel =A1+S1-K3:13.', t[1] + ' kommt dort an dieser Stelle vor.']);
  }
  function kzbau(R) {
    const c = C(), k = c.pick(R, Object.keys(c.ANSCHL)), kb = c.kbOf(k), o = { f: c.pick(R, c.FUNKT).c, o: c.pick(R, c.ORTE).c, k, nr: c.ri(R, 1, 9), a: c.pick(R, c.ANSCHL[k]) };
    const right = c.buildKz(o), fn = c.funktOf(o.f).n, on = c.ortOf(o.o).n;
    const wrong = ['+' + o.f + '=' + o.o + '-' + k + o.nr + ':' + o.a, '=' + o.f + '+' + o.o + '+' + k + o.nr + ':' + o.a, '=' + o.f + '+' + o.o + '-' + k + o.nr + '-' + o.a, '=' + o.f + '+' + o.o + '-' + o.nr + k + ':' + o.a];
    return choiceQ(R, 'Baue das Referenzkennzeichen: Funktion ' + o.f + ' (' + fn + '), Ort ' + o.o + ' (' + on + '), Betriebsmittel mit dem Kennbuchstaben ' + k + ' (' + kb.ex[0] + ') mit der Nummer ' + o.nr + ', Anschluss ' + o.a + '.', ['Schreibe die vier Teile mit ihren Vorzeichen nacheinander auf.', 'Das Produkt besteht aus Kennbuchstabe und Zählnummer.', 'Vergleiche mit den Antworten: Stimmen alle Vorzeichen?'], right, wrong, 'Funktion mit =, Ort mit +, Produkt mit - (Buchstabe, dann Nummer), Anschluss mit :. Ergebnis: ' + right + '.', ['Reihenfolge der Teile: Funktion, Ort, Produkt, Anschluss.', 'Prüfe bei jeder Antwort jedes Vorzeichen einzeln.']);
  }
  const LEG = 'In der Übungsanlage gilt: Funktion A1 Förderband, A2 Lüftung, A3 Pumpe. Ort S1 Schaltschrank, S2 Bedienpult, M1 Maschine.';
  function kzzer(R) {
    const c = C(), k = c.pick(R, Object.keys(c.ANSCHL)), o = { f: c.pick(R, c.FUNKT).c, o: c.pick(R, c.ORTE).c, k, nr: c.ri(R, 1, 9), a: c.pick(R, c.ANSCHL[k]) }, kz = c.buildKz(o), what = c.pick(R, ['o', 'f', 'p']);
    const steps = ['Zerlege das Kennzeichen an den Vorzeichen in seine Teile.', 'Suche den Teil, nach dem gefragt ist.', 'Übersetze ihn mit Hilfe der Zeichenerklärung.'];
    if (what === 'o') return choiceQ(R, LEG + ' Das Betriebsmittel hat das Kennzeichen ' + kz + '. Wo ist es eingebaut?', steps, c.ortOf(o.o).n, c.ORTE.filter(x => x.c !== o.o).map(x => x.n).concat(['Der Ort steht nicht im Kennzeichen']), 'Hinter dem Pluszeichen steht der Ort: +' + o.o + ' ist der ' + c.ortOf(o.o).n + '.', ['Der Ort steht hinter dem Pluszeichen.', 'Lies die Zeichenerklärung für den Ort.']);
    if (what === 'f') return choiceQ(R, LEG + ' Das Betriebsmittel hat das Kennzeichen ' + kz + '. Zu welcher Funktion gehört es?', steps, c.funktOf(o.f).n, c.FUNKT.filter(x => x.c !== o.f).map(x => x.n).concat(['Die Funktion steht nicht im Kennzeichen']), 'Hinter dem Gleichheitszeichen steht die Funktion: =' + o.f + ' ist ' + c.funktOf(o.f).n + '.', ['Die Funktion steht hinter dem Gleichheitszeichen.', 'Lies die Zeichenerklärung für die Funktion.']);
    return choiceQ(R, LEG + ' Das Betriebsmittel hat das Kennzeichen ' + kz + '. Was für ein Betriebsmittel ist es?', steps, c.kbOf(k).ex[0], c.shuffle(R, c.KB.filter(x => x.k !== k)).slice(0, 3).map(x => x.ex[0]), 'Hinter dem Minuszeichen steht das Produkt: ' + k + ' steht für ' + c.kbOf(k).n.toLowerCase() + ', zum Beispiel ' + c.kbOf(k).ex[0] + ', mit der Nummer ' + o.nr + '.', ['Das Produkt steht hinter dem Minuszeichen.', 'Der Kennbuchstabe sagt, was für ein Betriebsmittel es ist.']);
  }
  function kzzaehl(R) {
    const c = C(), ort = c.pick(R, c.ORTE), list = [], used = {}, n = c.ri(R, 1, 4);
    for (let i = 0; i < 7; i++) {
      let k, nr; do { k = c.pick(R, ['K', 'S', 'F', 'P', 'M', 'B']); nr = c.ri(R, 1, 4); } while (used[k + nr]);
      used[k + nr] = 1; list.push({ f: 'A1', o: i < n ? ort.c : c.pick(R, c.ORTE.filter(x => x.c !== ort.c)).c, k, nr });
    }
    return numQ(LEG + ' Im Plan stehen diese Kennzeichen: ' + c.shuffle(R, list).map(x => c.buildKz(x)).join(', ') + '. Wie viele der Betriebsmittel sind im Ort ' + ort.n + ' (+' + ort.c + ') eingebaut?', ['Suche in jedem Kennzeichen den Teil mit dem Pluszeichen.', 'Vergleiche ihn mit +' + ort.c + '.', 'Zähle die Treffer.'], n, 'Stück', 'Anzahl', 'Nach dem Pluszeichen steht der Ort. Genau ' + n + ' Kennzeichen enthalten +' + ort.c + '.', ['Der Ort steht hinter dem Pluszeichen.', 'Alle Kennzeichen haben dieselbe Funktion. Die Funktion ändert nichts.']);
  }
  function kzkurz(R) {
    const c = C(), nr = c.ri(R, 1, 9), k = c.pick(R, ['K', 'F', 'M', 'P']), t = c.ri(R, 1, 9);
    if (R() < 0.5) return choiceQ(R, 'Auf einem Blatt des Stromlaufplans gehören alle Betriebsmittel zur Funktion =A1 und sind im Schaltschrank +S1 eingebaut. Beides steht einmal im Schriftfeld des Blattes. Wie darf das Kennzeichen von ' + k + nr + ' auf dem Blatt gekürzt aussehen?', ['Prüfe, was für alle Betriebsmittel des Blattes gleich ist.', 'Lasse nur weg, was im Schriftfeld steht.', 'Behalte, was das Betriebsmittel selbst unterscheidet.'], '-' + k + nr, ['=A1+S1', k + nr, '+S1'], 'Was für das ganze Blatt gilt, steht einmal im Schriftfeld. Am Betriebsmittel genügt das Produkt: -' + k + nr + '.', ['Wiederholungen darf man sparen.', 'Das Produkt unterscheidet die Betriebsmittel.']);
    return choiceQ(R, 'Auf einem Blatt sind fast alle Betriebsmittel im Schaltschrank +S1 eingebaut, die Funktion =A1 steht im Schriftfeld. Nur der Taster S' + t + ' sitzt im Bedienpult +S2. Wie schreibst du sein Kennzeichen auf dem Blatt?', ['Prüfe, was für das Blatt gilt und was für den Taster abweicht.', 'Schreibe die Abweichung ans Betriebsmittel.', 'Lasse das Gleiche weg.'], '+S2-S' + t, ['-S' + t, '=A1-S' + t, '+S1-S' + t], 'Weicht ein Betriebsmittel von der Angabe im Schriftfeld ab, muss der abweichende Ort direkt am Kennzeichen stehen: +S2-S' + t + '.', ['Ohne Ortsangabe würde man den Taster im Schaltschrank suchen.', 'Die Funktion ist für alle gleich und steht im Schriftfeld.']);
  }
  function kzanschl(R) {
    const c = C(), k = c.pick(R, ['K', 'S', 'M', 'P']), nr = c.ri(R, 1, 9), a = c.pick(R, c.ANSCHL[k]), right = '-' + k + nr + ':' + a;
    return choiceQ(R, 'Du willst im Referenzkennzeichen den Anschluss ' + a + ' des Betriebsmittels ' + k + nr + ' ausdrücklich nennen (zum Beispiel in einer Verdrahtungsliste). Wie schreibst du das?', ['Schreibe zuerst das Produktkennzeichen.', 'Überlege, welches Zeichen den Anschluss einleitet.', 'Hänge den Anschluss an.'], right, ['-' + k + nr + '=' + a, '-' + k + nr + '+' + a, '-' + k + nr + '-' + a], 'Der Anschluss wird mit einem Doppelpunkt an das Produkt gehängt: ' + right + '.', ['Das Zeichen für den Anschluss ist der Doppelpunkt.', 'Gleichheitszeichen, Pluszeichen und Minuszeichen sind schon belegt.']);
  }
  const TEILQ = [['Das Förderband als Aufgabe der Anlage', 'Funktion'], ['Die Lüftung als Aufgabe der Anlage', 'Funktion'], ['Das Bedienpult, in dem Taster eingebaut sind', 'Ort'], ['Der Schaltschrank, in dem das Relais sitzt', 'Ort'], ['Das Relais K3 selbst', 'Produkt'], ['Der Taster S2 selbst', 'Produkt'], ['Der Spulenanschluss A2', 'Anschluss'], ['Der Anschlusspunkt 13 eines Hilfskontakts', 'Anschluss']];
  function kzteil(R) {
    const q = C().pick(R, TEILQ);
    return choiceQ(R, 'Zu welchem Teil des Referenzkennzeichens gehört diese Angabe? ' + q[0] + '.', ['Frage dich: Geht es um die Aufgabe, den Einbauort, das Betriebsmittel oder einen Anschlusspunkt?', 'Ordne die Angabe dem Teil zu.'], q[1], ['Funktion', 'Ort', 'Produkt', 'Anschluss'].filter(x => x !== q[1]), 'Die Funktion sagt, was die Einrichtung tut, der Ort, wo sie sitzt, das Produkt, was für ein Betriebsmittel es ist, und der Anschluss, welcher Anschlusspunkt gemeint ist.', ['Vier Teile: tun, wo, was, welcher Anschluss.', 'Ein Betriebsmittel mit Nummer ist ein Produkt.']);
  }

  /* ---------- Thema 4: Strompfade und Kontaktspiegel ---------- */
  /* Zufälliger Kontaktspiegel eines Relais in Strompfad a: nS Schließer, nO Öffner in verschiedenen Strompfaden */
  function randSpiegel(R, nS, nO, doppelt) {
    const c = C(), a = c.ri(R, 2, 9), free = c.shuffle(R, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(x => x !== a)), S = free.slice(0, nS).sort((x, y) => x - y), O = free.slice(nS, nS + nO).sort((x, y) => x - y);
    if (doppelt) S.splice(1, 0, S[0]);
    return { name: 'K' + c.ri(R, 1, 8), pfad: a, S, O };
  }
  const imgSp = s => ({ kind: 'spiegel', name: s.name, pfad: s.pfad, S: s.S, O: s.O });
  function spzaehl(R) {
    const c = C(), s = randSpiegel(R, c.ri(R, 2, 4), c.ri(R, 1, 2));
    return numQ('Das Relais ' + s.name + ' steht im Strompfad ' + s.pfad + '. Das Bild zeigt seinen Kontaktspiegel. Wie viele Schließer hat das Relais?', ['Sieh dir die Spalten des Kontaktspiegels an: Schließer und Öffner.', 'Zähle die Strompfadnummern in der Schließer-Spalte.', 'Jede Zahl steht für einen Kontakt.'], s.S.length, 'Schließer', 'Anzahl', 'Die Schließer-Spalte nennt die Strompfade ' + s.S.join(', ') + ': Das sind ' + s.S.length + ' Schließer.', ['Eine Zahl ist ein Kontakt.', 'Die Öffner stehen in der anderen Spalte.'], { img: imgSp(s) });
  }
  function sppfad(R) {
    const c = C(), s = randSpiegel(R, c.ri(R, 2, 3), 1);
    return numQ('Das Relais ' + s.name + ' hat den abgebildeten Kontaktspiegel. In welchem Strompfad liegt sein Öffner?', ['Suche im Kontaktspiegel die Öffner-Spalte.', 'Lies die Strompfadnummer, die dort steht.', 'Das ist der Strompfad, in dem du den Öffner im Plan findest.'], s.O[0], 'Strompfad', 'Strompfad', 'In der Öffner-Spalte steht die Zahl ' + s.O[0] + ': Der Öffner liegt im Strompfad ' + s.O[0] + '.', ['Nur eine Zahl steht in der Öffner-Spalte.', 'Verwechsle sie nicht mit dem Strompfad der Spule.'], { img: imgSp(s) });
  }
  function spbed(R) {
    const c = C(), p = c.ri(R, 3, 9), right = 'Ein Schließer des Relais liegt im Strompfad ' + p;
    return choiceQ(R, 'Unter einer Relaisspule steht ein Kontaktspiegel. In der Schließer-Spalte steht die Zahl ' + p + '. Was bedeutet das?', ['Erinnere dich: Der Kontaktspiegel zeigt, wo die Kontakte liegen.', 'Prüfe, wofür eine Zahl im Plan sonst stehen könnte.', 'Wähle die Aussage, die zum Kontaktspiegel passt.'], right, ['Das Relais hat ' + p + ' Schließer', 'Ein Schließer ist an Klemme ' + p + ' angeschlossen', 'Die Spule liegt im Strompfad ' + p], 'Die Zahlen im Kontaktspiegel sind Strompfadnummern: Dort liegt je ein Kontakt des Relais. Die Anzahl der Kontakte ergibt sich aus der Anzahl der Zahlen.', ['Es sind Strompfadnummern.', 'Der Kontaktspiegel steht unter der Spule und verweist auf die Kontakte.']);
  }
  const MODETXT = { ruhe: 'Der Motor steht, niemand hat S2 gedrückt, nichts hat ausgelöst.', lauf: 'S2 wurde gedrückt und losgelassen, K1 hält sich selbst, der Motor läuft.', ueberlast: 'Der Motor lief, das Überlastrelais F2 hat ausgelöst und K1 ist abgefallen.' };
  function ruheLampen(R) {
    const c = C(), mode = c.pick(R, ['ruhe', 'lauf', 'ueberlast']), txt = ids => ids.length === 3 ? 'alle drei' : ids.length === 1 ? 'nur ' + ids[0] : ids.join(' und '), right = txt(c.litLamps(mode));
    const opts = ['nur P1', 'nur P2', 'nur P3', 'P1 und P3', 'P2 und P3', 'P1 und P2', 'alle drei'];
    return choiceQ(R, 'Zur Schützsteuerung im Bild: P1 hängt am Öffner K1 21-22, P2 am Schließer K1 33-34, P3 am Schließer F2 97-98 des Überlastrelais. ' + MODETXT[mode] + ' Welche Meldeleuchten leuchten?', ['Das Bild zeigt alle Kontakte im spannungslosen Zustand.', 'Überlege, wie K1 und F2 in der beschriebenen Lage stehen und welche Kontakte dadurch umschalten.', 'Ein Schließer schließt, wenn sein Gerät schaltet, ein Öffner öffnet. Prüfe dann jede Leuchte.'], right, opts.filter(x => x !== right), { ruhe: 'In Ruhe sind alle Schließer offen und alle Öffner geschlossen: Nur P1 am Öffner K1 21-22 leuchtet.', lauf: 'K1 ist angezogen: Der Öffner 21-22 öffnet (P1 aus), der Schließer 33-34 schließt (P2 an). F2 hat nicht ausgelöst, P3 bleibt aus.', ueberlast: 'F2 hat ausgelöst: Sein Öffner 95-96 trennt die Spule, K1 fällt ab, der Öffner 21-22 schließt (P1 an). Der Schließer 97-98 schließt (P3 an). P2 bleibt aus.' }[mode], ['Schaltet ein Schließer, schließt er. Schaltet ein Öffner, öffnet er.', 'Prüfe zuerst K1, dann F2.'], { img: { kind: 'plan' } });
  }
  function spnachsehen(R) {
    const c = C(), s = randSpiegel(R, c.ri(R, 2, 3), c.ri(R, 1, 2), true), all = s.S.concat(s.O), n = new Set(all).size;
    return numQ('Du suchst alle Kontakte zur Spule ' + s.name + ' im Strompfad ' + s.pfad + '. Der Kontaktspiegel zeigt, wo sie liegen. In wie vielen verschiedenen Strompfaden musst du im Plan nachsehen?', ['Lies alle Strompfadnummern im Kontaktspiegel ab, Schließer und Öffner.', 'Zahlen, die doppelt vorkommen, zählen nur einmal.', 'Zähle die verschiedenen Zahlen.'], n, 'Strompfade', 'Anzahl', 'Alle Zahlen: ' + all.join(', ') + '. Verschieden sind ' + n + ', denn mehrere Kontakte können im selben Strompfad liegen (zum Beispiel Hauptkontakte).', ['Zwei Kontakte im selben Pfad sind ein Pfad.', 'Die Spule selbst zählst du nicht mit.'], { img: imgSp(s) });
  }
  const S_SH = ['Lies, was beobachtet wird, und welche Schaltung dahintersteckt.', 'Überlege, welcher Kontakt oder welches Teil für das Verhalten zuständig ist.', 'Wähle die Antwort, die genau dazu passt.'];
  const SH = [
    ['Eine Schützsteuerung (Ein-Taster S2, Selbsthaltung K1 13-14 parallel zu S2, Aus-Taster S1 in Reihe) läuft nur, solange S2 gedrückt wird. Beim Loslassen fällt K1 ab. Was ist die wahrscheinlichste Ursache?', 'Der Schließer K1 13-14 (Selbsthaltung) fehlt, ist falsch angeschlossen oder defekt', ['Die Spule K1 hat zu viel Strom', 'Der Motor ist zu groß für das Schütz', 'Der Aus-Taster S1 ist zu hell'], 'Die Selbsthaltung überbrückt den Ein-Taster, sobald K1 angezogen hat. Fehlt sie, hält nichts die Spule nach dem Loslassen.', ['Was soll K1 nach dem Loslassen von S2 halten?', 'Der Kontakt parallel zu S2 ist gemeint.']],
    ['Warum ist der Aus-Taster S1 in einer Schützsteuerung ein Öffner?', 'Bei einem Drahtbruch fällt das Schütz ab und der Motor bleibt nicht unbemerkt an', ['Weil Öffner billiger sind als Schließer', 'Weil der Motor sonst schneller läuft', 'Weil die Spule sonst keine Kontakte hat'], 'Ein Öffner im Steuerkreis trennt bei Drahtbruch oder Kontaktfehler die Spule: Die Anlage geht in den sicheren Zustand.', ['Was passiert, wenn die Leitung durchtrennt wird?', 'Der sichere Zustand ist: Motor aus.']],
    ['Welche Aufgabe hat der Öffner F2 95-96 im Strompfad der Spule K1?', 'Bei Überlast unterbricht er den Strom zur Spule, K1 fällt ab und der Motor wird abgeschaltet', ['Er schaltet die Leuchte P2 ein', 'Er hält K1 nach dem Einschalten (Selbsthaltung)', 'Er zeigt den Motorstrom an'], 'F2 ist das Überlastrelais. Sein Öffner liegt in Reihe zur Spule und trennt sie bei Überlast.', ['F steht für Schützen.', 'Ein Öffner in Reihe trennt den Pfad.']]
  ];
  const S_SP = ['Lies, was die Frage zum Plan sagt.', 'Überlege, wofür Strompfadnummern und Kontaktspiegel da sind.', 'Wähle die passende Antwort.'];
  const SPFEHL = [
    ['Im Plan liegt ein Schließer des Relais K4 im Strompfad 7. Im Kontaktspiegel unter der Spule K4 steht der Strompfad 7 aber nicht. Was folgt daraus?', 'Plan und Kontaktspiegel passen nicht zusammen, einer von beiden muss berichtigt werden', ['Nichts, der Kontaktspiegel muss nicht vollständig sein', 'Der Schließer ist in Wahrheit ein Öffner', 'Das Relais K4 hat keine Spule'], 'Der Kontaktspiegel soll alle Kontakte nennen. Fehlt einer, ist der Plan nicht stimmig und wird berichtigt.', ['Spiegel und Plan sagen dasselbe, wenn alles stimmt.', 'Eine Abweichung ist ein Fehler im Plan.']],
    ['Wozu dienen die Strompfadnummern unter dem Stromlaufplan?', 'Mit ihnen werden Spule und Kontakte über Querverweise gefunden', ['Die Nummern geben die Spannung im Strompfad an', 'Die Nummern zählen die Betriebsmittel', 'Die Nummern nennen die Klemme, an der die Leitung endet'], 'Die Strompfadnummer ist eine Adresse im Plan. Querverweise und Kontaktspiegel nennen sie.', ['Denke an Hausnummern.', 'Es sind Adressen im Plan.']],
    ['Warum zeichnet man Stromlaufpläne im spannungslosen Zustand?', 'Damit jeder denselben eindeutigen Ausgangszustand sieht: Kontakte in Ruhelage', ['Weil im Betrieb keine Zeichnung möglich ist', 'Weil Strom Linien verfälscht', 'Damit alle Schütze angezogen gezeichnet sind'], 'Der Plan zeigt den Ausgangszustand. Wie die Schaltung im Betrieb schaltet, liest man daraus ab.', ['Es geht um einen vereinbarten Ausgangszustand.', 'Ruhelage heißt: nichts betätigt, nichts angezogen.']]
  ];

  /* ---------- Thema 5: Anschluss- und Klemmenbezeichnung ---------- */
  const S_AN = ['Lies, an welchem Betriebsmittel die Anschlüsse sitzen.', 'Rufe dir die Bezeichnung dieses Anschlusses in Erinnerung.', 'Wähle die passende Antwort.'];
  const SPULEA = [
    ['Wie heißen die Anschlüsse der Spule eines Schützes?', 'A1 und A2', ['1 und 2', '13 und 14', '95 und 96'], 'Spulenanschlüsse tragen A1 und A2. Die Zahlenpaare gehören zu Kontakten.', ['Spulen tragen Buchstaben.', 'Die Zahlenpaare sind Kontakte.']],
    ['Wie sind die Anschlüsse der Hauptkontakte eines dreipoligen Schützes bezeichnet?', 'Oben 1, 3, 5 (L1, L2, L3), unten 2, 4, 6 (T1, T2, T3)', ['Oben A1, A2, A3, unten B1, B2, B3', 'Oben 13, 23, 33, unten 14, 24, 34', 'Oben U, V, W, unten X, Y, Z'], 'Die Hauptkontakte sind einstellig nummeriert: oben ungerade Zahlen, unten die nächsthöhere gerade Zahl.', ['Einstellige Zahlen.', 'Ungerade oben, gerade unten.']]
  ];
  function haupt(R) {
    const c = C(), top = c.pick(R, [1, 3, 5]), up = R() < 0.5;
    return numQ(up ? 'Ein dreipoliger Hauptkontakt eines Schützes hat oben den Anschluss ' + top + '. Welcher Anschluss liegt unten am selben Hauptkontakt?' : 'Ein dreipoliger Hauptkontakt eines Schützes hat unten den Anschluss ' + (top + 1) + '. Welcher Anschluss liegt oben am selben Hauptkontakt?', ['Merke: Oben stehen die ungeraden Zahlen 1, 3, 5, unten die geraden 2, 4, 6.', 'Zusammengehörige Anschlüsse liegen direkt nebeneinander in der Zahlenreihe.', 'Bestimme den Partner.'], up ? top + 1 : top, 'Anschluss', 'Anschluss', 'Die Paare sind 1-2, 3-4 und 5-6. Zu ' + (up ? top : top + 1) + ' gehört ' + (up ? top + 1 : top) + '.', ['Die Hauptkontakte bilden die Paare 1-2, 3-4, 5-6.', 'Eine ungerade Zahl und die nächste gerade Zahl.']);
  }
  const CODES = ['11-12', '13-14', '21-22', '23-24', '31-32', '33-34', '41-42', '43-44', '51-52', '53-54'];
  function funkz(R) {
    const c = C(), code = c.pick(R, CODES), d = c.decodeContact(code);
    return choiceQ(R, 'Ein Hilfskontakt eines Schützes trägt die Anschlussbezeichnung ' + code + '. Welche Art Kontakt ist das?', ['Lies die beiden Zahlen. Die letzte Ziffer jeder Zahl ist die Funktionsziffer.', 'Funktionsziffern 1-2 stehen für einen Öffner, 3-4 für einen Schließer.', 'Die erste Ziffer sagt nur, der wievielte Kontakt es ist.'], c.CTYP[d.typ], ['Schließer', 'Öffner', 'Wechsler', 'Spulenanschluss'].filter(x => x !== c.CTYP[d.typ]), 'Bei ' + code + ' ist die Ordnungsziffer ' + d.ord + ' (der ' + ORD[d.ord - 1] + ' Kontakt) und die Funktionsziffer ' + d.fz + ': ' + c.CTYP[d.typ] + '.', ['Die letzten Ziffern entscheiden: 1-2 oder 3-4.', 'Funktionsziffern 3-4: Schließer, 1-2: Öffner.']);
  }
  function ordz(R) {
    const c = C(), m = c.ri(R, 2, 4), types = Array.from({ length: m }, () => c.pick(R, ['S', 'O'])), nt = c.pick(R, ['S', 'O']), code = (o, t) => o + (t === 'O' ? '1' : '3') + '-' + o + (t === 'O' ? '2' : '4');
    const have = types.map((t, i) => code(i + 1, t)).join(', '), right = code(m + 1, nt);
    const wrong = [code(m + 1, nt === 'S' ? 'O' : 'S'), code(m, nt), code(m + 2, nt)];
    return choiceQ(R, 'An einem Schütz sind schon diese Hilfskontakte belegt: ' + have + '. Du setzt einen weiteren Hilfskontakt als ' + c.CTYP[nt] + ' auf. Wie lautet seine Anschlussbezeichnung?', ['Zähle die vorhandenen Kontakte: Der neue ist der nächste.', 'Die erste Ziffer ist die Nummer des neuen Kontakts.', 'Die letzten Ziffern geben die Art an (Öffner 1-2, Schließer 3-4).'], right, wrong, 'Es sind ' + m + ' Kontakte belegt, der neue ist der ' + ORD[m] + ' (Ordnungsziffer ' + (m + 1) + '). Als ' + c.CTYP[nt] + ' bekommt er die Funktionsziffern ' + (nt === 'O' ? '1-2' : '3-4') + ': ' + right + '.', ['Ordnungsziffer vorn, Funktionsziffer hinten.', 'Vorhandene Ordnungsziffern wiederholst du nicht.']);
  }
  function hilfzaehl(R) {
    const c = C(), want = c.pick(R, ['O', 'S']), n = c.ri(R, 1, 3), types = c.shuffle(R, Array.from({ length: 5 }, (_, i) => (i < n ? want : want === 'O' ? 'S' : 'O'))), list = types.map((t, i) => (i + 1) + (t === 'O' ? '1' : '3') + '-' + (i + 1) + (t === 'O' ? '2' : '4'));
    return numQ('Ein Schütz hat diese Hilfskontakte: ' + list.join(', ') + '. Wie viele davon sind ' + (want === 'O' ? 'Öffner' : 'Schließer') + '?', ['Sieh dir bei jedem Kontakt die letzten Ziffern an.', 'Öffner tragen 1-2, Schließer 3-4 als letzte Ziffern.', 'Zähle die ' + (want === 'O' ? 'Öffner' : 'Schließer') + '.'], n, 'Kontakte', 'Anzahl', 'Letzte Ziffern ' + (want === 'O' ? '1-2' : '3-4') + ' haben ' + n + ' Kontakte: Das sind die ' + (want === 'O' ? 'Öffner' : 'Schließer') + '.', ['Nur die letzten Ziffern zählen.', 'Die erste Ziffer ist die Nummer des Kontakts.']);
  }
  const UE = [
    ['Welche Anschlüsse hat der Öffner eines Überlastrelais, der in Reihe zur Schützspule liegt?', '95-96', ['97-98', '13-14', 'A1-A2'], 'Beim Überlastrelais ist 95-96 der Öffner (Steuerkreis, trennt die Spule), 97-98 der Schließer (Meldung).', ['Zwei Zahlenpaare gehören zum Überlastrelais.', 'Der Öffner liegt in der niedrigeren Zahl.']],
    ['Eine Störmeldeleuchte soll bei Auslösen des Überlastrelais leuchten. An welchen Hilfskontakt wird sie angeschlossen?', '97-98 (Schließer)', ['95-96 (Öffner)', '13-14', 'A1-A2'], 'Bei Überlast schließt der Schließer 97-98 und schaltet die Meldeleuchte ein. Der Öffner 95-96 öffnet dabei.', ['Die Leuchte soll bei Überlast an gehen: Schließer.', 'Das Schließerpaar des Überlastrelais ist 97-98.']]
  ];
  function leiterf(R) {
    const c = C(), l = c.pick(R, c.LEITER), wrong = c.shuffle(R, c.LEITER.filter(x => x.k !== l.k).map(x => x.f).concat(['rot', 'weiß', 'gelb'])).filter(x => x !== l.f);
    return choiceQ(R, 'Welche Aderfarbe hat nach heutiger Kennzeichnung von Installationsleitungen der Leiter ' + l.k + '?', ['Ordne den Leiter einer Rolle zu: Außenleiter, Neutralleiter oder Schutzleiter.', 'Rufe die Farbe zu dieser Rolle in Erinnerung.', 'Wähle die Farbe.'], l.f, wrong, c.LEITER.map(x => x.k + ' ' + x.f).join(', ') + '. Ältere Leitungen und Maschinenverdrahtungen können abweichen.', ['L1, L2, L3, N, PE: je eine Farbe.', 'Der Schutzleiter ist zweifarbig.']);
  }
  function klembez(R) {
    const c = C();
    if (R() < 0.5) { const x = c.ri(R, 1, 4), n = c.ri(R, 2, 9); return choiceQ(R, 'Im Plan steht -X' + x + ':' + n + '. Was bedeutet die Angabe?', ['Zerlege die Angabe in Produkt (vor dem Doppelpunkt) und Anschluss (dahinter).', 'Der Kennbuchstabe X steht für Verbinden.', 'Formuliere in eigenen Worten.'], 'Klemme ' + n + ' der Klemmleiste X' + x, ['Die ' + n + '. Klemmleiste mit dem Kennbuchstaben X', 'Der Anschluss X' + x + ' am Betriebsmittel Nr. ' + n, 'Die Funktion X' + x + ' am Ort ' + n], 'X' + x + ' ist das Produkt (die Klemmleiste), hinter dem Doppelpunkt steht der Anschluss: Klemme ' + n + '.', ['Vor dem Doppelpunkt: das Betriebsmittel. Dahinter: der Anschluss.', 'X ist der Kennbuchstabe für Verbinden.']); }
    const k = c.pick(R, ['K', 'S', 'M']), nr = c.ri(R, 1, 5), a = c.pick(R, c.ANSCHL[k]);
    return choiceQ(R, 'In einer Verdrahtungsliste steht -' + k + nr + ':' + a + '. Was bedeutet die Angabe?', ['Zerlege die Angabe am Doppelpunkt.', 'Vorn steht das Betriebsmittel, hinten der Anschluss.', 'Formuliere in eigenen Worten.'], 'Anschluss ' + a + ' am Betriebsmittel ' + k + nr, ['Das Betriebsmittel ' + a + ' an der Klemmleiste ' + k + nr, 'Der Ort ' + a + ' des Betriebsmittels ' + k + nr, 'Die Funktion ' + k + nr + ' mit dem Anschluss ' + a], 'Das Produkt ' + k + nr + ' steht vor dem Doppelpunkt, der Anschluss ' + a + ' dahinter.', ['Doppelpunkt = Anschluss.', 'Vor dem Doppelpunkt steht das Produkt.']);
  }
  function klemmzahl(R) {
    const c = C(), n = c.ri(R, 1, 3), m = c.ri(R, 1, 3);
    return numQ('Eine Klemmleiste soll ' + n + ' Drehstrommotor' + (n > 1 ? 'en' : '') + ' (je L1, L2, L3 und PE, jede Ader auf eine eigene Klemme) und ' + m + ' Taster (je zwei Adern, jede auf eine eigene Klemme) aufnehmen. Wie viele Klemmen werden mindestens gebraucht?', ['Bestimme die Klemmen je Motor.', 'Bestimme die Klemmen je Taster.', 'Rechne beides mal der jeweiligen Anzahl und addiere.'], 4 * n + 2 * m, 'Klemmen', 'Klemmen', 'Je Motor 4 Klemmen: ' + n + ' · 4 = ' + 4 * n + '. Je Taster 2 Klemmen: ' + m + ' · 2 = ' + 2 * m + '. Zusammen ' + (4 * n + 2 * m) + ' Klemmen.', ['Ein Motor braucht vier Adern: L1, L2, L3 und PE.', 'Jede Ader bekommt eine eigene Klemme.']);
  }
  function klemmlesen(R) {
    const c = C(), k = c.pick(R, c.KLEMMEN);
    if (R() < 0.5) return choiceQ(R, 'Ein Messgerät zeigt Spannung an Klemme -X1:' + k.n + '. Zu welchem Anschluss im Feld führt diese Klemme?', ['Suche die Klemme in der Spalte "Klemme" des Klemmenplans.', 'Lies in derselben Zeile das Ziel (außen).', 'Wähle es in der Antwortliste.'], k.aussen, c.shuffle(R, c.KLEMMEN.filter(x => x.n !== k.n).map(x => x.aussen)).slice(0, 3), 'Klemme ' + k.n + ' führt nach außen zum Ziel ' + k.aussen + ', Quelle im Schrank ist ' + k.innen + '.', ['Eine Zeile pro Klemme.', 'Außen ist das Feld, innen der Schaltschrank.'], { tables: [klemTab(c.KLEMMEN)] });
    return numQ('Du suchst die Klemme, an der im Feld das Ziel ' + k.aussen + ' angeschlossen ist. Welche Klemmennummer von -X1 ist es?', ['Suche das Ziel in der Spalte "Ziel (außen)".', 'Lies in derselben Zeile die Klemme.', 'Gib die Nummer ein.'], k.n, 'Klemme', 'Klemme', 'Das Ziel ' + k.aussen + ' steht in der Zeile von Klemme ' + k.n + '.', ['Von rechts nach links lesen.', 'Das Ziel steht in der Spalte Ziel (außen).'], { tables: [klemTab(c.KLEMMEN)] });
  }

  /* ---------- Thema 6: Schaltzeichen ---------- */
  const S_SYM = ['Sieh dir das Zeichen genau an: Form, Linien, Beschriftung.', 'Überlege, welches Betriebsmittel so gezeichnet wird.', 'Wähle die passende Antwort.'];
  const nameOf = k => C().symOf(k).n, imgSym = k => ({ kind: 'sym', key: k });
  function symname(R) {
    const c = C(), s = c.pick(R, c.SYMS), kont = ['schliesser', 'oeffner', 'taster'], wrong = c.shuffle(R, c.SYMS.filter(x => x.k !== s.k && !(kont.includes(s.k) && kont.includes(x.k)))).slice(0, 3).map(x => x.n);
    return choiceQ(R, 'Welches Betriebsmittel zeigt das Schaltzeichen im Bild?', S_SYM, s.n, wrong, 'Das Zeichen zeigt: ' + s.n + '.', ['Achte auf die Form: Kreis, Rechteck, Linien.', 'Beschriftungen im Zeichen helfen.'], { img: imgSym(s.k) });
  }
  function symkb(R) {
    const c = C(), s = c.pick(R, c.SYMS.filter(x => x.kb && x.k !== 'spule' && x.k !== 'hauptk3')), wrong = c.shuffle(R, c.KB.map(x => x.k).filter(k => k !== s.kb)).slice(0, 3);
    return choiceQ(R, 'Das Bild zeigt das Schaltzeichen eines Betriebsmittels. Welchen Kennbuchstaben trägt dieses Betriebsmittel im Plan?', ['Erkenne zuerst das Betriebsmittel.', 'Überlege, was es tut.', 'Wähle den passenden Kennbuchstaben.'], s.kb, wrong, 'Gezeigt ist: ' + s.n + '. Sein Kennbuchstabe ist ' + s.kb + '.', ['Zuerst: Was ist es?', 'Dann: Wie lautet der Buchstabe für diese Aufgabe?'], { img: imgSym(s.k) });
  }
  function symso(R) {
    const k = C().pick(R, ['schliesser', 'oeffner', 'taster']), closed = k === 'oeffner';
    return choiceQ(R, 'Das Schaltzeichen zeigt einen Kontakt, wie er im Plan gezeichnet wird: unbetätigt. Fließt jetzt Strom durch den Kontakt, wenn der übrige Stromkreis in Ordnung ist?', ['Erkenne, ob der Kontakt im Bild eine Lücke hat.', 'Ein Kontakt in Ruhelage ist so gezeichnet, wie er unbetätigt steht.', 'Wähle die Aussage, die dazu passt.'], closed ? 'Ja, der Kontakt ist in Ruhelage geschlossen' : 'Nein, der Kontakt ist in Ruhelage offen', closed ? ['Nein, der Kontakt ist in Ruhelage offen', 'Ja, aber nur bei Gleichspannung', 'Nein, aber nur bei Wechselspannung'] : ['Ja, der Kontakt ist in Ruhelage geschlossen', 'Ja, aber nur bei Gleichspannung', 'Nein, aber nur bei Wechselspannung'], closed ? 'Der Öffner berührt in Ruhelage seinen Gegenkontakt: Er ist geschlossen und leitet.' : 'Der ' + (k === 'taster' ? 'Taster (Schließer)' : 'Schließer') + ' hat in Ruhelage eine Lücke: Er ist offen und leitet nicht.', ['Hat der Kontakt im Bild eine Lücke?', 'Gezeichnet wird in Ruhelage.'], { img: imgSym(k) });
  }
  function sympins(R) {
    const c = C(), s = c.pick(R, c.SYMS.filter(x => ['motor', 'hauptk3', 'trafo', 'spule', 'sicherung', 'kondensator', 'taster'].includes(x.k)));
    return numQ('Wie viele Anschlusspunkte hat das Schaltzeichen im Bild? Zähle die Linienenden, an denen Leitungen angeschlossen werden (Schutzleiter nicht mitzählen).', ['Suche alle Linien, die aus dem Zeichen herausführen.', 'Zähle jedes Linienende einzeln.', 'Gib die Anzahl ein.'], s.pins, 'Anschlüsse', 'Anzahl', 'Das Zeichen ' + s.n + ' hat ' + s.pins + ' Anschlusspunkte.', ['Zähle oben und unten getrennt und addiere.', 'Jedes Linienende ist ein Anschluss.'], { img: imgSym(s.k) });
  }
  const REGEL = [
    ['Warum gibt es genormte Schaltzeichen?', 'Damit alle Fachleute Pläne lesen können, ohne dass der Zeichner jedes Zeichen erklären muss', ['Damit Pläne möglichst viel Platz brauchen', 'Damit jeder Betrieb seine eigenen Zeichen erfinden kann', 'Damit Betriebsmittel billiger werden'], 'Ein gemeinsamer Zeichenvorrat macht Pläne für alle lesbar, auch für Fremde und über Betriebsgrenzen hinweg.', ['Denke an eine gemeinsame Sprache.', 'Pläne werden von vielen Leuten gelesen.']],
    ['In einem Plan taucht ein Schaltzeichen auf, das du nicht kennst. Was tust du?', 'Du suchst es in der Zeichenerklärung (Legende) des Plans und sonst in einer Normsammlung oder fragst nach', ['Du ignorierst es, es wird schon nicht wichtig sein', 'Du rätst und baust danach', 'Du zeichnest ein eigenes Zeichen dazu, ohne es zu erklären'], 'Unbekannte Zeichen werden nicht geraten. Die Legende erklärt sie, sonst fragst du nach.', ['Nicht raten.', 'Die Legende ist eine Hilfe im Plan selbst.']],
    ['In welchem Zustand werden Schaltzeichen von Kontakten im Plan gezeichnet?', 'Unbetätigt und spannungslos (Ruhelage)', ['Betätigt und unter Spannung', 'So, wie die Anlage gerade läuft', 'Nach Wahl des Zeichners, ohne Regel'], 'Der Ausgangszustand ist vereinbart: Kontakte werden in Ruhelage gezeichnet.', ['Es gibt eine feste Vereinbarung.', 'Ruhelage ist unbetätigt.']]
  ];
  const TAST = [
    ['Worin unterscheidet sich ein Taster von einem Schalter?', 'Ein Taster schaltet nur, solange er betätigt wird, und springt danach zurück; ein Schalter rastet ein', ['Ein Taster hat immer zwei Kontakte, ein Schalter nur einen', 'Ein Taster ist für Gleichstrom, ein Schalter für Wechselstrom', 'Es gibt keinen Unterschied'], 'Der Taster fällt nach dem Loslassen zurück, der Schalter bleibt in der gewählten Stellung.', ['Was passiert nach dem Loslassen?', 'Rasten oder Zurückfedern.']],
    ['Woran erkennst du im Schaltzeichen, dass ein Kontakt von Hand betätigt wird?', 'Am Betätigungsteil (zum Beispiel Druckknopf) mit gestrichelter Wirklinie am Kontakt', ['An dem Buchstaben M neben dem Kontakt', 'An der Farbe des Kontakts', 'An der Zahl der Anschlüsse'], 'Die Wirklinie verbindet Kontakt und Betätigungsteil. Das Teil am Ende zeigt die Art der Betätigung.', ['Schau auf die gestrichelte Linie.', 'Die Linie führt vom Kontakt zum Betätigungsteil.']],
    ['Der Not-Halt-Taster arbeitet in Steuerungen meist mit einem Öffner. Warum?', 'Bei Drahtbruch oder Kontaktfehler wird die Anlage ebenfalls abgeschaltet', ['Weil Öffner sich leichter drücken lassen', 'Weil dann weniger Leitungen nötig sind', 'Weil Schließer im Notfall zu heiß werden'], 'Ein Öffner trennt auch bei einem Leitungsfehler. Das ist der sichere Zustand.', ['Was soll bei einem Leitungsfehler passieren?', 'Sicherer Zustand: aus.']]
  ];
  const S_TAST = ['Lies die Frage: Geht es um Bedienung oder um den Kontakt?', 'Rufe dir die Arbeitsweise von Taster, Schalter und Kontakt in Erinnerung.', 'Wähle die passende Antwort.'];

  /* ---------- Generatoren ---------- */
  const G = {
    zweck: pq(ZWECK, S_ZWECK), darst: pq(DARST, S_DARST), aderzahl, ueber: pq(UEBER, S_UEBER), fehlerliste, aend: pq(AEND, S_AEND),
    kbz, kbrueck, zaehlk, altneu, kzschreiben, epu: pq(PE, ['Überlege, was jedes Betriebsmittel tut.', 'Ordne jedem den Kennbuchstaben zu.', 'Wähle die Aussage, bei der beide Zuordnungen stimmen.']), qk: pq(QK, ['Lies die Frage und rufe dir die Aufgabe der Buchstaben in Erinnerung.', 'Prüfe jede Antwort: Passt sie zur Aufgabe?', 'Wähle die zutreffende.']),
    vorz, kzbau, kzzer, kzzaehl, kzkurz, kzanschl, kzteil,
    spzaehl, sppfad, spbed, ruhe: ruheLampen, spnachsehen, selbsthalt: pq(SH, S_SH), spfehl: pq(SPFEHL, S_SP),
    spulea: pq(SPULEA, S_AN), haupt, funkz, ordz, hilfzaehl, ue: pq(UE, S_AN), leiterf, klembez, klemmzahl, klemmlesen,
    symname, symkb, symso, sympins, symregel: pq(REGEL, S_SYM.slice(0, 2).concat(['Wähle die Antwort, die zu genormten Zeichen passt.'])), taster: pq(TAST, S_TAST)
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral, ohne Zahlen), Generator */
  const defs = [
    [CATS[0], 1, 'Welcher Plan für welchen Zweck', 'zweck'], [CATS[0], 1, 'Darstellung erkennen', 'darst'], [CATS[0], 2, 'Verdrahtungsliste auszählen', 'aderzahl'], [CATS[0], 1, 'Übersichtsplan einordnen', 'ueber'], [CATS[0], 3, 'Liste gegen Klemmenplan prüfen', 'fehlerliste'], [CATS[0], 2, 'Unterlagen ändern', 'aend'],
    [CATS[1], 1, 'Betriebsmittel zum Buchstaben', 'kbz'], [CATS[1], 1, 'Buchstabe zum Betriebsmittel', 'kbrueck'], [CATS[1], 2, 'Kennzeichen im Plan zählen', 'zaehlk'], [CATS[1], 2, 'Älterer Plan', 'altneu'], [CATS[1], 1, 'Produktkennzeichen schreiben', 'kzschreiben'], [CATS[1], 2, 'Zwei ähnliche Buchstaben', 'epu'], [CATS[1], 3, 'Leistung und Signal', 'qk'],
    [CATS[2], 1, 'Vorzeichen zuordnen', 'vorz'], [CATS[2], 2, 'Kennzeichen zusammensetzen', 'kzbau'], [CATS[2], 2, 'Kennzeichen zerlegen', 'kzzer'], [CATS[2], 2, 'Betriebsmittel am Ort zählen', 'kzzaehl'], [CATS[2], 3, 'Kennzeichen kürzen', 'kzkurz'], [CATS[2], 2, 'Anschluss anhängen', 'kzanschl'], [CATS[2], 1, 'Teil des Kennzeichens', 'kzteil'],
    [CATS[3], 1, 'Kontakte im Kontaktspiegel', 'spzaehl'], [CATS[3], 2, 'Strompfad des Kontakts', 'sppfad'], [CATS[3], 1, 'Zahlen im Kontaktspiegel', 'spbed'], [CATS[3], 2, 'Welche Leuchte leuchtet', 'ruhe'], [CATS[3], 2, 'Wo nachsehen', 'spnachsehen'], [CATS[3], 3, 'Steuerung verstehen', 'selbsthalt'], [CATS[3], 3, 'Plan und Spiegel', 'spfehl'],
    [CATS[4], 1, 'Anschlüsse am Schütz', 'spulea'], [CATS[4], 1, 'Hauptkontakte', 'haupt'], [CATS[4], 1, 'Hilfskontakt lesen', 'funkz'], [CATS[4], 2, 'Neuer Hilfskontakt', 'ordz'], [CATS[4], 2, 'Hilfskontakte zählen', 'hilfzaehl'], [CATS[4], 2, 'Überlastrelais', 'ue'], [CATS[4], 1, 'Farbe des Leiters', 'leiterf'], [CATS[4], 1, 'Angabe mit Doppelpunkt', 'klembez'], [CATS[4], 2, 'Klemmen planen', 'klemmzahl'], [CATS[4], 2, 'Klemmenplan lesen', 'klemmlesen'],
    [CATS[5], 1, 'Zeichen erkennen', 'symname'], [CATS[5], 1, 'Zeichen und Buchstabe', 'symkb'], [CATS[5], 1, 'Kontakt in Ruhelage', 'symso'], [CATS[5], 2, 'Anschlusspunkte zählen', 'sympins'], [CATS[5], 1, 'Regeln für Schaltzeichen', 'symregel'], [CATS[5], 2, 'Taster und Kontakt', 'taster']
  ];
  let seq = 0;
  const tasks = defs.map(d => ({ id: 'bmk' + (++seq), cat: d[0], level: d[1], title: d[2], gen: d[3] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) { const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  const makeTask = t => make(t, C().rng('bmk-' + t.id));
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Zahlen entstehen im UI aus BMK_CORE) ---------- */
  const examples = [
    { id: 'plan1', tab: 'plan', title: 'Selbsthaltung lesen', text: 'Motor läuft: K1 ist angezogen, sein Schließer 13-14 in Strompfad 3 hält die Spule, der Öffner 21-22 hat die Leuchte P1 abgeschaltet.', p: { mode: 'lauf', sel: 'K1' } },
    { id: 'plan2', tab: 'plan', title: 'Überlast ausgelöst', text: 'F2 hat ausgelöst: Sein Öffner 95-96 trennt die Spule, K1 fällt ab. Bereit-Leuchte P1 und Störleuchte P3 leuchten.', p: { mode: 'ueberlast', sel: 'F2' } },
    { id: 'kz1', tab: 'kz', title: 'Kennzeichen zusammensetzen', text: 'Das Relais Nr. 3 im Schaltschrank der Förderband-Steuerung, Anschluss 13: Funktion, Ort, Produkt und Anschluss ergeben ein Kennzeichen.', p: { f: 'A1', o: 'S1', k: 'K', nr: 3, a: '13' } },
    { id: 'kl1', tab: 'klem', title: 'Klemme 6 lesen', text: 'Welche Quelle und welches Ziel hat Klemme 6, und wie heißt die Ader in der Verdrahtungsliste?', p: { n: 6 } }
  ];

  root.BMK_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples };
  root.BMK_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.BMK_DATA, TASKS: root.BMK_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
