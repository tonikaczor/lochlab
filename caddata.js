'use strict';
/* Tonfunk 3D-Modellierungs-Lab: Daten (Aufgaben-Generatoren). Lab-Kennung 'cad'.
   ALLE Zahlen sind ÜBUNGSWERTE, Firma "Modellbetrieb" und alle Bauteile sind frei erfunden.
   window.CAD_DATA  { cats, tasks, gens, make, makeTask, randomQ, pools }
   window.CAD_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.cad.done' = {id:true})
   Jede Frage q: { text, ask, value, tol, expl, tips[2], steps[] (So gehst du vor), table? {head, rows}, img? (Bild für CAD_VIZ.taskImg) }.
   Titel verraten weder Ergebnis noch Lösung. */
(function (root) {
  const C = () => root.CAD_CORE || (typeof require === 'function' ? require('./cadcore.js') : null);
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Koordinaten und Ebenen', 'Skizzen und Bedingungen', 'Features: Körper aufbauen', 'Boolesche Operationen und Parameter', 'Fertigung und 3D-Druck', 'Baugruppe und Zusammenbau'];

  const numQ = (text, value, unit, label, tol, expl, tips, steps, more) => Object.assign({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, steps }, more || {});
  function choiceQ(R, text, right, wrong, expl, tips, steps, more) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return Object.assign({ text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps }, more || {});
  }
  /* Pool: Einträge [Text, richtig, falsch[], Erklärung, Tipps]; Schritte und Bild gelten für den ganzen Pool */
  const pq = (POOL, steps, img) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), e = POOL[i]; return choiceQ(R, e[0], e[1], e[2], e[3], e[4], steps, img ? { img } : null); };
  const tolRel = v => Math.max(0.02, Math.abs(v) * 0.005);

  /* ============================================================ Koordinaten und Ebenen */
  const EBQ = [
    ['In diesem Lab zeigt die Z-Achse nach oben. Du willst die Grundfläche eines Gehäuses skizzieren, die flach auf dem Tisch liegt (Blick von oben). Auf welcher Ebene skizzierst du?', 'XY-Ebene', ['XZ-Ebene', 'YZ-Ebene', 'Auf der Z-Achse'],
      'Die Grundfläche liegt waagerecht, dort bleibt Z gleich. Die Ebene, die von X und Y aufgespannt wird, ist die XY-Ebene (Draufsicht).', ['Waagerecht heißt: Die Höhe Z ändert sich nicht.', 'Die Ebene, in der nur X und Y vorkommen, ist die XY-Ebene.']],
    ['Du skizzierst das Profil einer Wand: Breite in X-Richtung, Höhe in Z-Richtung. Danach wird die Skizze in Y-Richtung extrudiert. Auf welcher Ebene liegt die Skizze?', 'XZ-Ebene', ['XY-Ebene', 'YZ-Ebene', 'Auf der Y-Achse'],
      'Ein Profil aus Breite (X) und Höhe (Z) liegt in der XZ-Ebene (Vorderansicht). Extrudiert wird senkrecht zur Skizzenebene, hier also in Y.', ['Welche zwei Achsen kommen im Profil vor?', 'Breite ist X, Höhe ist Z, also die XZ-Ebene.']],
    ['Eine Skizze auf der XY-Ebene wird extrudiert. In welche Richtung wächst der Körper?', 'In Z-Richtung, senkrecht zur Skizzenebene', ['In X-Richtung', 'In Y-Richtung', 'Innerhalb der Skizzenebene'],
      'Extrudiert wird immer senkrecht zur Skizzenebene. Auf der XY-Ebene steht die Z-Achse senkrecht, der Körper wächst also nach oben (oder nach unten) in Z.', ['Eine Extrusion zieht die Fläche heraus, sie bleibt nicht in der Ebene.', 'Senkrecht zur XY-Ebene steht die Z-Achse.']],
    ['Welche Standardebene steht senkrecht auf der X-Achse?', 'YZ-Ebene', ['XY-Ebene', 'XZ-Ebene', 'Alle drei Ebenen'],
      'Die YZ-Ebene enthält die Achsen Y und Z. Die X-Achse durchstößt sie im Ursprung senkrecht, in dieser Ebene ist X überall 0 (Seitenansicht).', ['Die gesuchte Ebene enthält die X-Achse nicht.', 'Es bleiben die Achsen Y und Z: YZ-Ebene.']],
    ['Die drei Achsen und die drei Standardebenen schneiden sich in einem Punkt. Wie heißt er?', 'Ursprung mit den Koordinaten (0, 0, 0)', ['Ursprung mit den Koordinaten (1, 1, 1)', 'Schwerpunkt, dessen Lage vom Bauteil abhängt', 'Nullpunkt, der nur für die Z-Achse gilt'],
      'Alle Achsen und Ebenen treffen sich im Ursprung mit den Koordinaten (0, 0, 0). Alle Maße werden von dort aus angegeben.', ['Er liegt dort, wo alle drei Koordinaten null sind.', 'Er ist der Bezugspunkt aller Koordinaten.']]
  ];
  const ANQ = [
    ['Welche Ansicht zeigt alle drei Raumrichtungen zugleich, mit gleich stark verkürzten Achsen?', 'Isometrische Ansicht', ['Draufsicht', 'Vorderansicht', 'Seitenansicht'],
      'In der Isometrie erscheinen X, Y und Z mit je 120 Grad dazwischen und gleich verkürzt. Draufsicht, Vorderansicht und Seitenansicht zeigen jeweils nur zwei Richtungen.', ['Drei Richtungen gleichzeitig zeigt nur eine schräge Ansicht.', 'Das ist die Isometrie.']],
    ['In diesem Lab blickst du von oben entlang der Z-Achse auf das Bauteil. Wie heißt diese Ansicht?', 'Draufsicht', ['Vorderansicht', 'Seitenansicht', 'Isometrische Ansicht'],
      'Der Blick von oben entlang Z zeigt X und Y: die Draufsicht auf der XY-Ebene.', ['Blick von oben heißt: Du siehst die XY-Ebene.', 'Sie heißt Draufsicht.']],
    ['Warum liest du Maße besser in Draufsicht, Vorderansicht und Seitenansicht ab als in der Isometrie?', 'Dort erscheinen die Längen unverzerrt, in der Isometrie sind alle Achsen verkürzt', ['Die Isometrie ändert die Maße des Modells', 'Nur diese drei Ansichten gibt es in jedem Programm', 'Die Isometrie zeigt nur die Rückseite'],
      'In den drei Hauptansichten blickst du senkrecht auf eine Ebene, die Längen sind in echter Größe zu sehen. In der Isometrie sind alle Achsen gleich verkürzt, die Maße des Modells bleiben aber unverändert.', ['Überlege, was die Isometrie mit den Achsenlängen macht.', 'Verkürzt dargestellt ist nicht dasselbe wie verändert.']],
    ['Du drehst das Modell mit der Maus. Was passiert dabei mit den Maßen des Körpers?', 'Nichts, nur die Blickrichtung ändert sich', ['Sie werden neu berechnet', 'Der Körper schrumpft', 'Der Ursprung wandert mit'],
      'Drehen, Zoomen und Verschieben ändern nur die Darstellung. Das Modell und seine Maße bleiben gleich.', ['Du bewegst die Kamera, nicht das Bauteil.', 'Die Darstellung ändert sich, das Modell nicht.']]
  ];
  const IMG_AX = { k: 'axes' };

  const A1 = {
    ebq: pq(EBQ, ['Lies, in welche Richtungen die Skizze oder der Körper zeigen soll.', 'Überlege, welche Achsen dazu gehören.', 'Wähle die Antwort, die genau zu diesen Achsen passt.'], IMG_AX),
    anq: pq(ANQ, ['Lies, was gesehen oder gerechnet werden soll.', 'Denke an die Blickrichtung und die Achsen im Bild.', 'Wähle die Antwort, die dazu passt.'], IMG_AX),
    abstand(R) {
      const t = C().pick(R, [[3, 4, 5], [5, 12, 13], [8, 15, 17]]), k = C().pick(R, [2, 4, 5, 10]), sw = R() < 0.5, a = t[sw ? 1 : 0] * k, b = t[sw ? 0 : 1] * k, c = t[2] * k;
      return numQ('Ein Punkt in der Skizze hat die Koordinaten X = ' + a + ' mm und Y = ' + b + ' mm, gemessen vom Ursprung. Wie weit ist der Punkt vom Ursprung entfernt (Luftlinie)?', c, 'mm', 'Abstand', 0.01,
        'X und Y stehen senkrecht aufeinander. Abstand = Wurzel aus (' + a + '² + ' + b + '²) = Wurzel aus ' + f(a * a + b * b, 0) + ' = ' + f(c, 0) + ' mm.',
        ['X und Y bilden ein rechtwinkliges Dreieck, der Abstand ist die längste Seite.', 'Abstand = Wurzel aus (' + a + '² + ' + b + '²)'],
        ['Beide Koordinaten quadrieren.', 'Die Quadrate addieren.', 'Aus der Summe die Wurzel ziehen.'], { img: IMG_AX });
    },
    mitte(R) {
      const w = C().pick(R, [40, 60, 80, 100, 120]), h = C().pick(R, [30, 50, 70, 90]), x = R() < 0.5, v = (x ? w : h) / 2;
      return numQ('Ein Rechteck mit der Breite ' + w + ' mm (X) und der Höhe ' + h + ' mm (Y) hat seine linke untere Ecke im Ursprung. Ein Kreis soll genau in der Mitte des Rechtecks liegen. Welche ' + (x ? 'X' : 'Y') + '-Koordinate hat der Kreismittelpunkt?', v, 'mm', (x ? 'X' : 'Y') + '-Koordinate', 0.01,
        'Die Mitte liegt auf halber ' + (x ? 'Breite: ' + w : 'Höhe: ' + h) + ' mm / 2 = ' + f(v, 0) + ' mm.',
        ['Die Ecke liegt bei 0, die gegenüberliegende Kante bei ' + (x ? w : h) + ' mm.', (x ? w : h) + ' mm / 2'],
        ['Suche die Seitenlänge in der gefragten Richtung.', 'Halbiere sie, weil die Ecke im Ursprung liegt.']);
    },
    kante(R) {
      const L = C().pick(R, [60, 80, 100, 120, 140]), a = C().pick(R, [5, 10, 15, 20]), v = L / 2 - a;
      return numQ('Eine Platte ist ' + L + ' mm lang (X-Richtung) und liegt mit ihrer Mitte im Ursprung. Eine Bohrung sitzt mit ihrer Mitte ' + a + ' mm von der rechten Kante entfernt. Welche X-Koordinate hat die Bohrungsmitte?', v, 'mm', 'X-Koordinate', 0.01,
        'Die rechte Kante liegt bei ' + L + ' mm / 2 = ' + f(L / 2, 0) + ' mm. Die Bohrung sitzt ' + a + ' mm weiter links: ' + f(L / 2, 0) + ' − ' + a + ' = ' + f(v, 0) + ' mm.',
        ['Die Platte reicht von minus L/2 bis plus L/2.', f(L, 0) + ' / 2 − ' + a],
        ['Rechne die Lage der rechten Kante aus (halbe Länge).', 'Gehe von dort um den Randabstand zurück nach links.']);
    }
  };

  /* ============================================================ Skizzen und Bedingungen */
  const BDQ = [
    ['Was bewirkt die Bedingung „Tangential“ zwischen einer Linie und einem Kreis?', 'Die Linie berührt den Kreis in genau einem Punkt, ohne ihn zu schneiden', ['Linie und Kreis haben denselben Mittelpunkt', 'Die Linie geht durch den Kreismittelpunkt', 'Linie und Kreisdurchmesser sind gleich lang'],
      'Tangential heißt berühren: Die Linie liegt am Kreis an und schneidet ihn nicht. Sie steht dann senkrecht auf dem Radius im Berührpunkt.', ['Denke an ein Rad auf der Straße.', 'Eine Tangente berührt, sie schneidet nicht.']],
    ['Was bewirkt die Bedingung „Koinzident“ bei zwei Endpunkten?', 'Beide Punkte liegen an derselben Stelle und bleiben verbunden', ['Beide Punkte behalten einen festen Abstand', 'Beide Punkte werden gelöscht', 'Beide Linien werden gleich lang'],
      'Koinzident heißt zusammenfallend: Die Punkte sitzen an derselben Stelle. So bleiben die Ecken einer Kontur geschlossen.', ['Das Wort heißt zusammenfallend.', 'So hängen Linien an einer Ecke zusammen.']],
    ['Zwei Linien einer Skizze sollen immer gleich lang bleiben, ohne dass du ein Maß vorgibst. Welche Bedingung nimmst du?', 'Gleich', ['Parallel', 'Senkrecht', 'Koinzident'],
      'Die Bedingung „Gleich“ erzwingt gleiche Längen (bei Kreisen gleiche Radien), ohne einen Zahlenwert festzulegen.', ['Es geht um die Länge, nicht um die Richtung.', 'Länge gleich halten heißt: Gleich.']],
    ['Zwei Linien sollen im rechten Winkel zueinander stehen. Welche Bedingung passt?', 'Senkrecht', ['Parallel', 'Tangential', 'Gleich'],
      'Senkrecht legt einen Winkel von 90 Grad zwischen den Linien fest. Parallel würde sie gleich ausrichten.', ['Rechter Winkel sind 90 Grad.', 'Senkrecht ist der Gegenspieler von parallel.']],
    ['Zwei Kreise sollen denselben Mittelpunkt haben (wie bei einer Scheibe mit Loch). Welche Bedingung passt?', 'Konzentrisch', ['Tangential', 'Gleich', 'Parallel'],
      'Konzentrisch heißt: gleicher Mittelpunkt, die Radien dürfen verschieden sein. So bleibt das Loch immer mittig in der Scheibe.', ['Die Mittelpunkte sollen zusammenfallen.', 'Das Wort heißt „mit gemeinsamer Mitte“.']]
  ];
  const ZSQ = [
    ['Eine Skizze ist unterbestimmt. Woran erkennst du das in vielen CAD-Programmen?', 'Die Linien haben eine andere Farbe (oft blau) und lassen sich noch mit der Maus ziehen', ['Die Skizze lässt sich nicht speichern', 'Das Programm löscht die Skizze', 'Sie hat mehr Bedingungen als nötig'],
      'Unterbestimmt heißt: Es sind noch Freiheitsgrade offen. Viele Programme zeigen solche Linien in einer eigenen Farbe, und man kann sie noch ziehen. Eine voll bestimmte Skizze lässt sich nicht mehr ziehen.', ['Was ist bei einer unterbestimmten Skizze noch frei?', 'Was frei ist, lässt sich ziehen.']],
    ['Du fügst ein Maß hinzu, das durch andere Bedingungen schon festliegt. Wie nennt man diesen Zustand?', 'Überbestimmt: Ein Maß ist überflüssig oder widerspricht anderen', ['Unterbestimmt: Es fehlen noch Maße', 'Voll bestimmt: Alles ist in Ordnung', 'Ohne Ebene: Die Skizze hat keinen Bezug'],
      'Wenn mehr Bedingungen vorliegen als Freiheitsgrade, ist die Skizze überbestimmt. Das Programm meldet das meist mit einer Warnung oder roter Farbe.', ['Es sind mehr Bedingungen da als nötig.', 'Mehr als nötig heißt überbestimmt.']],
    ['Warum sollte eine Skizze vor dem Extrudieren voll bestimmt sein?', 'Damit sich beim Ändern eines Maßes nichts unerwartet verschiebt', ['Weil das Programm sonst die Ebene löscht', 'Weil der Körper sonst schwerer wird', 'Weil sonst die Dichte nicht stimmt'],
      'Offene Freiheitsgrade können sich beim Ändern eines Maßes unvorhersehbar bewegen. Ist alles bestimmt, folgt die Skizze genau den Maßen.', ['Was passiert mit offenen Freiheitsgraden bei einer Änderung?', 'Alles Festgelegte verhält sich vorhersehbar.']],
    ['Eine Skizze ist überbestimmt. Was tust du?', 'Das überflüssige Maß oder die widersprechende Bedingung löschen', ['Noch mehr Maße hinzufügen', 'Die Skizze auf eine andere Ebene legen', 'Das Programm neu starten'],
      'Bei Überbestimmung nimmst du die Bedingung oder das Maß wieder heraus, das nichts Neues sagt oder widerspricht.', ['Zu viel Festlegung löst du durch Weglassen.', 'Lösche das, was überflüssig ist.']]
  ];
  const BASE_ON = ['h', 'v', 'o', 'w', 'hh', 'm', 'dk'];
  const A2 = {
    dofsum(R) {
      const np = C().ri(R, 1, 4), nl = C().ri(R, 1, 3), nk = C().ri(R, 1, 3), v = C().dofSum(np, nl, nk), D = C().DOF;
      return numQ('Eine Skizze enthält ' + np + ' freie Punkte, ' + nl + ' freie Linien und ' + nk + ' freie Kreise. Es gibt noch keine Bedingungen und keine Maße. Ein Punkt hat 2 Freiheitsgrade (X und Y), eine Linie 4 (zwei Endpunkte), ein Kreis 3 (Mitte X, Y und Radius). Wie viele Freiheitsgrade hat die Skizze insgesamt?', v, '', 'Freiheitsgrade', 0,
        np + ' · 2 + ' + nl + ' · 4 + ' + nk + ' · 3 = ' + (np * D.punkt) + ' + ' + (nl * D.linie) + ' + ' + (nk * D.kreis) + ' = ' + v + ' Freiheitsgrade.',
        ['Rechne jede Sorte einzeln aus und addiere dann.', np + ' · 2 + ' + nl + ' · 4 + ' + nk + ' · 3'],
        ['Punkte mal 2 rechnen.', 'Linien mal 4 und Kreise mal 3 rechnen.', 'Alle drei Zahlen addieren.']);
    },
    dofleft(R) {
      const ks = C().shuffle(R, BASE_ON).slice(0, C().ri(R, 3, 5)), on = BASE_ON.filter(k => ks.includes(k)), st = C().sketchState(on), tot = C().SK_TOTAL;
      const rows = on.map(k => { const c = C().SK.find(x => x.k === k); return [c.n, c.d + (c.d === 1 ? ' Freiheitsgrad' : ' Freiheitsgrade')]; }), sum = tot - st.dof;
      return numQ('Die Übungsskizze besteht aus einem Rechteck (vier Eckpunkte) und einem Kreis darin. Ohne Bedingungen hat sie ' + tot + ' Freiheitsgrade. Die Tabelle zeigt, was schon gesetzt ist. Wie viele Freiheitsgrade bleiben übrig?', st.dof, '', 'Freiheitsgrade', 0,
        'Gesetzt sind zusammen ' + sum + ' Freiheitsgrade. ' + tot + ' − ' + sum + ' = ' + st.dof + ' Freiheitsgrade bleiben übrig.',
        ['Zähle zuerst zusammen, wie viele Freiheitsgrade die Tabelle wegnimmt.', tot + ' − ' + sum],
        ['Die Werte der Tabelle addieren.', 'Die Summe von ' + tot + ' abziehen.'], { table: { head: ['Bedingung', 'nimmt weg'], rows }, img: { k: 'sketch', on } });
    },
    dofvoll(R) {
      const dims = ['w', 'hh', 'dk'], s = C().ri(R, 0, 2), sub = C().shuffle(R, dims).slice(0, s), on = ['h', 'v', 'o', 'm'].concat(dims.filter(k => sub.includes(k))), miss = 3 - s;
      return numQ('Waagerecht, senkrecht, Ursprung und Mitte des Kreises sind festgelegt. Welche Maße schon gesetzt sind, siehst du im Bild. Jedes Maß nimmt einen Freiheitsgrad. Wie viele Maße musst du noch setzen, damit die Skizze voll bestimmt ist?', miss, '', 'Fehlende Maße', 0,
        'Drei Maße sind möglich: Breite, Höhe und Kreisdurchmesser. Im Bild sind ' + s + ' davon gesetzt, also fehlen ' + miss + '.',
        ['Alle anderen Bedingungen sind schon da, es fehlen nur Maße.', '3 − ' + s],
        ['Prüfe im Bild, welche von Breite, Höhe und Durchmesser schon vorhanden sind.', 'Zähle die fehlenden.'], { img: { k: 'sketch', on } });
    },
    bdq: pq(BDQ, ['Lies, welche Eigenschaft die Skizze bekommen soll.', 'Überlege, ob es um Lage, Richtung, Länge oder Berührung geht.', 'Wähle die Bedingung, die genau das festlegt.']),
    zsq: pq(ZSQ, ['Lies die Frage zum Zustand der Skizze.', 'Denke an die Freiheitsgrade: noch offen, genau passend oder zu viel.', 'Wähle die Antwort, die dazu passt.']),
    symm(R) {
      const a = C().pick(R, [5, 8, 10, 12, 15, 20, 25]);
      return numQ('Zwei Bohrungsmitten liegen symmetrisch zur senkrechten Mittellinie der Skizze, jede ' + a + ' mm von ihr entfernt. Wie groß ist der Abstand der beiden Bohrungsmitten voneinander?', 2 * a, 'mm', 'Abstand', 0.01,
        'Symmetrisch heißt: gleicher Abstand auf beiden Seiten. Zusammen sind es ' + a + ' + ' + a + ' = ' + f(2 * a, 0) + ' mm. Mit der Bedingung „Symmetrisch“ brauchst du nur ein Maß.',
        ['Eine Bohrung liegt links, die andere rechts von der Mittellinie.', a + ' + ' + a],
        ['Den Abstand links und den Abstand rechts bestimmen.', 'Beide addieren.']);
    }
  };

  /* ============================================================ Features: Körper aufbauen */
  const FTQ = [
    ['Du brauchst eine Welle, also einen runden Körper um eine Achse. Welches Feature passt am besten?', 'Rotation: Das halbe Längsprofil wird um die Achse gedreht', ['Extrusion einer Rechteckskizze', 'Fase an einer Kante', 'Muster einer Bohrung'],
      'Runde Körper um eine Achse entstehen durch Rotation (Drehen) eines Profils. Das Profil zeichnest du als halben Längsschnitt.', ['Denke an eine Drehbank.', 'Ein Profil wird um die Achse gedreht.']],
    ['Eine scharfe Kante soll entschärft werden, sodass eine schräge, ebene Fläche entsteht. Welches Feature?', 'Fase', ['Rundung', 'Muster', 'Spiegeln'],
      'Eine Fase ersetzt die Kante durch eine schräge, ebene Fläche. Eine Rundung ergäbe dagegen eine gewölbte Fläche.', ['Eben und schräg ist das Stichwort.', 'Gewölbt wäre eine Rundung.']],
    ['Auf einem Kreis sollen 6 gleiche Bohrungen sitzen. Welches Vorgehen ist am besten, weil Änderungen nur an einer Stelle nötig sind?', 'Eine Bohrung als Feature und dann ein Kreismuster mit 6 Wiederholungen', ['Sechs einzelne Bohrungen setzen und jede einzeln bemaßen', 'Eine Bohrung sechsmal kopieren und von Hand verschieben', 'Sechs getrennte Skizzen ohne Bezug zueinander'],
      'Mit einem Kreismuster änderst du Anzahl, Abstand oder Durchmesser an einer Stelle, und alle Bohrungen folgen. Einzeln gesetzte Bohrungen müsstest du alle einzeln anpassen.', ['Was soll sich bei einer Änderung automatisch mitändern?', 'Ein Muster ändert sich an einer Stelle.']],
    ['Ein Halter ist links-rechts symmetrisch. Womit sparst du Arbeit?', 'Eine Hälfte modellieren und an der Mittelebene spiegeln', ['Beide Hälften getrennt modellieren und zusammenkleben', 'Die Hälfte mit dem Muster zehnmal wiederholen', 'Den Körper drehen und neu skizzieren'],
      'Mit dem Spiegeln erzeugst du die zweite Hälfte automatisch. Änderungen an der ersten Hälfte gelten dann auch für die zweite.', ['Eine Hälfte genügt, die andere entsteht als Spiegelbild.', 'Das Feature heißt Spiegeln.']]
  ];
  const FOQ = [
    ['Warum rundest du die senkrechten Kanten eines Gehäuses vor dem Aushöhlen (Schale)?', 'Dann folgt die Innenwand der Rundung und die Wandstärke bleibt rundum gleich', ['Weil sich Rundungen nach dem Aushöhlen nicht mehr anbringen lassen', 'Weil die Schale sonst kein Volumen hat', 'Weil das Gewicht sonst nicht stimmt'],
      'Die Schale folgt der Außenform. Ist die Ecke vorher gerundet, wird auch die Innenecke gerundet und die Wand bleibt überall gleich dick.', ['Die Schale folgt der Außenform, wie sie beim Aushöhlen vorliegt.', 'Gerundet vor dem Aushöhlen heißt: Die Wand läuft mit.']],
    ['Du schiebst im Feature-Baum eine Rundung hinter eine Bohrung, die an der Kante sitzt. Was kann passieren?', 'Die Rundung schlägt fehl oder sieht anders aus, weil die Reihenfolge das Ergebnis bestimmt', ['Nichts, die Reihenfolge ist immer egal', 'Die Bohrung wird gelöscht', 'Das Modell wird automatisch größer'],
      'Jedes Feature arbeitet auf dem Ergebnis der Features davor. Ändert sich die Reihenfolge, ändert sich die Ausgangsform, und manche Features lassen sich dann nicht mehr berechnen.', ['Jedes Feature baut auf dem Vorherigen auf.', 'Andere Reihenfolge, andere Ausgangsform.']],
    ['Was zeigt der Feature-Baum (die Zeitleiste)?', 'Die Arbeitsschritte des Modells in der Reihenfolge, in der sie berechnet werden', ['Nur die Werkstoffe der Teile', 'Die Fertigungskosten', 'Die Ansichten des Modells'],
      'Der Feature-Baum listet Skizzen und Features von oben nach unten in der Reihenfolge der Berechnung. Du kannst einzelne Schritte ändern, und alle folgenden werden neu berechnet.', ['Es ist eine Liste der Modellierschritte.', 'Sie zeigt, wie das Modell entstanden ist.']],
    ['Du schiebst den Marker der Zeitleiste vor die Schale zurück. Was siehst du?', 'Den Zustand vor der Schale, spätere Features sind vorübergehend ausgeblendet', ['Alle späteren Features sind endgültig gelöscht', 'Alle Maße sind auf null gesetzt', 'Das Modell ist gespiegelt'],
      'Der Marker zeigt das Modell an einem früheren Punkt der Zeitleiste. Die späteren Features bleiben erhalten und sind nur ausgeblendet, bis du den Marker wieder nach unten schiebst.', ['Zurückschieben schaut in die Vergangenheit des Modells.', 'Ausgeblendet ist nicht gelöscht.']],
    ['Welche Aufgabe hat eine Skizze im Feature-Baum?', 'Sie liefert das Profil, aus dem ein Feature (zum Beispiel Extrusion oder Rotation) den Körper erzeugt', ['Sie ist das fertige Bauteil', 'Sie speichert nur die Farbe', 'Sie legt die Baugruppe fest'],
      'Die Skizze ist die Grundlage vieler Features: Das Feature macht aus dem flachen Profil einen Körper.', ['Aus der Skizze wird später ein Körper.', 'Sie ist das Profil, nicht der Körper.']]
  ];
  const IMGH = (L, B, H, step, r) => ({ k: 'feat', step, p: { L, B, H, t: 2, r: r || 0, d: 3 } });
  const A3 = {
    ftq: pq(FTQ, ['Lies, welche Form oder Wiederholung gebraucht wird.', 'Überlege, welches Feature diese Form erzeugt.', 'Wähle das Feature, das die Aufgabe am einfachsten löst.']),
    extr(R) {
      const a = C().pick(R, [30, 40, 50, 60, 80, 100]), b = C().pick(R, [20, 30, 40, 50, 60, 70]), h = C().pick(R, [10, 15, 20, 25, 30, 40]), v = a * b * h / 1000;
      return numQ('Du zeichnest ein Rechteck ' + a + ' mm × ' + b + ' mm und extrudierst es um ' + h + ' mm. Welches Volumen hat der Körper?', v, 'cm³', 'Volumen', 0.01,
        'Volumen = Fläche · Höhe = ' + a + ' · ' + b + ' · ' + h + ' mm³ = ' + f(a * b * h, 0) + ' mm³. Geteilt durch 1.000 sind das ' + f(v, 1) + ' cm³.',
        ['Fläche des Rechtecks mal Höhe der Extrusion.', a + ' · ' + b + ' · ' + h + ' / 1.000'],
        ['Fläche des Rechtecks ausrechnen.', 'Mit der Höhe malnehmen (mm³).', 'Durch 1.000 teilen (cm³).'], { img: IMGH(a, b, h, 1) });
    },
    cut(R) {
      const L = C().pick(R, [40, 60, 80, 100]), B = C().pick(R, [30, 40, 50, 70]), h = C().pick(R, [5, 8, 10, 12]), d = C().pick(R, [6, 8, 10, 12, 16, 20]), pl = L * B * h, ho = C().cylV(d, h), v = (pl - ho) / 1000;
      return numQ('Eine Platte ist ' + L + ' mm × ' + B + ' mm × ' + h + ' mm groß. Du schneidest eine Durchgangsbohrung Ø ' + d + ' mm heraus (Ausschnitt-Feature). Welches Volumen hat die Platte danach?', v, 'cm³', 'Volumen', 0.02,
        'Platte ' + f(pl, 0) + ' mm³. Bohrung π/4 · ' + d + '² · ' + h + ' = ' + f(ho, 0) + ' mm³. Rest ' + f(pl - ho, 0) + ' mm³ = ' + f(v, 2) + ' cm³.',
        ['Volumen der Platte minus Volumen des herausgeschnittenen Zylinders.', f(pl, 0) + ' − π/4 · ' + d + '² · ' + h + ' mm³, dann durch 1.000'],
        ['Volumen der vollen Platte berechnen.', 'Volumen der Bohrung als Zylinder berechnen.', 'Abziehen und in cm³ umrechnen.']);
    },
    rev(R) {
      const r = C().pick(R, [5, 8, 10, 12, 15, 20]), h = C().pick(R, [20, 30, 40, 50, 60]), v = C().cylV(2 * r, h) / 1000;
      return numQ('Ein Rechteck mit der Breite ' + r + ' mm und der Höhe ' + h + ' mm liegt mit einer Seite an der Drehachse. Du drehst es um 360 Grad um diese Achse (Rotation). Welches Volumen hat der entstehende Körper?', v, 'cm³', 'Volumen', tolRel(v),
        'Es entsteht ein Zylinder mit Radius ' + r + ' mm und Höhe ' + h + ' mm. V = π · ' + r + '² · ' + h + ' = ' + f(v * 1000, 0) + ' mm³ = ' + f(v, 2) + ' cm³.',
        ['Das Rechteck wird zu einem Zylinder, die Breite ist der Radius.', 'π · ' + r + '² · ' + h + ' / 1.000'],
        ['Erkenne den Körper (Zylinder) und seinen Radius.', 'V = π · r² · h rechnen und durch 1.000 teilen.']);
    },
    fil(R) {
      const r = C().pick(R, [2, 3, 4, 5, 6, 8]), h = C().pick(R, [6, 8, 10, 12, 15, 20]), v = C().eckenV(r, h);
      return numQ('Eine Platte hat vier senkrechte Kanten, die mit dem Radius ' + r + ' mm gerundet werden. Die Platte ist ' + h + ' mm hoch. Wie viel Volumen fällt durch die vier Rundungen insgesamt weg? Pro Ecke fällt die Fläche (1 − π/4) · r² weg, mal Höhe.', v, 'mm³', 'Wegfallendes Volumen', Math.max(1, v * 0.005),
        'Pro Ecke: (1 − π/4) · ' + r + '² = ' + f((1 - Math.PI / 4) * r * r, 2) + ' mm². Vier Ecken: ' + f((4 - Math.PI) * r * r, 2) + ' mm². Mal ' + h + ' mm Höhe = ' + f(v, 1) + ' mm³.',
        ['Die Fläche pro Ecke gilt für den Querschnitt, danach mit der Höhe malnehmen.', '4 · (1 − π/4) · ' + r + '² · ' + h],
        ['Fläche pro Ecke berechnen.', 'Mit 4 Ecken malnehmen.', 'Mit der Höhe malnehmen.'], { img: IMGH(60, 40, h, 2, r) });
    },
    pat(R) {
      const n = C().ri(R, 3, 8), p = C().pick(R, [10, 12, 15, 20, 25]), a = C().pick(R, [10, 15, 20]), v = a + (n - 1) * p;
      return numQ('Ein lineares Muster setzt ' + n + ' Bohrungen in einer Reihe, Mitte zu Mitte im Abstand ' + p + ' mm. Die erste Bohrung liegt ' + a + ' mm vom linken Rand. Wie weit ist die Mitte der letzten Bohrung vom linken Rand entfernt?', v, 'mm', 'Abstand', 0.01,
        'Zwischen ' + n + ' Bohrungen gibt es ' + (n - 1) + ' Abstände. ' + a + ' + ' + (n - 1) + ' · ' + p + ' = ' + f(v, 0) + ' mm.',
        ['Zähle die Abstände, nicht die Bohrungen.', a + ' + (' + n + ' − 1) · ' + p],
        ['Anzahl der Abstände bestimmen (eins weniger als Bohrungen).', 'Mit dem Mittenabstand malnehmen und den Randabstand addieren.']);
    },
    spieg(R) {
      const vh = C().ri(R, 80, 300) / 10;
      return numQ('Du modellierst nur die linke Hälfte eines symmetrischen Halters (' + f(vh, 1) + ' cm³) und spiegelst sie an der Mittelebene. Die Hälften berühren sich nur an der Spiegelfläche. Welches Volumen hat der ganze Halter?', 2 * vh, 'cm³', 'Volumen', 0.01,
        'Die gespiegelte Hälfte hat dasselbe Volumen. 2 · ' + f(vh, 1) + ' = ' + f(2 * vh, 1) + ' cm³.', ['Das Spiegelbild ist genauso groß wie das Original.', '2 · ' + f(vh, 1)],
        ['Überlege, wie groß die gespiegelte Hälfte ist.', 'Beide Hälften addieren.']);
    },
    fo1: pq(FOQ, ['Lies die Frage und denke an die Reihenfolge der Features.', 'Überlege, worauf jedes Feature aufbaut.', 'Wähle die Antwort, die dazu passt.'], null),
    fo2: pq(FOQ, ['Lies die Frage zum Feature-Baum.', 'Überlege, was der Baum und die Zeitleiste im Programm tun.', 'Wähle die Antwort, die dazu passt.'], null)
  };

  /* ============================================================ Boolesche Operationen und Parameter */
  const BOQ = [
    ['Du brauchst eine Bohrung in einem Block. Welche boolesche Operation setzt das Programm dabei um?', 'Differenz: Der Werkzeugkörper wird vom Block abgezogen', ['Vereinigung', 'Schnittmenge', 'Spiegelung'],
      'Ein Loch entsteht, indem ein Zylinder aus dem Block herausgeschnitten wird: Block minus Zylinder.', ['Material soll verschwinden.', 'Wegnehmen heißt Differenz.']],
    ['Zwei Körper sollen zu einem einzigen Körper werden. Welche Operation?', 'Vereinigung', ['Differenz', 'Schnittmenge', 'Muster'],
      'Bei der Vereinigung (Addieren) werden beide Körper verschmolzen. Die Überlappung zählt nur einmal.', ['Es soll nichts wegfallen, die Körper wachsen zusammen.', 'Zusammenfügen heißt Vereinigung.']],
    ['Du willst nur den Bereich behalten, in dem sich beide Körper überlappen. Welche Operation?', 'Schnittmenge', ['Vereinigung', 'Differenz', 'Fase'],
      'Die Schnittmenge behält genau das Volumen, das in beiden Körpern liegt.', ['Gemeinsam heißt: in beiden enthalten.', 'Der gemeinsame Bereich ist die Schnittmenge.']],
    ['Ist bei der Differenz „A − B“ das Ergebnis dasselbe wie bei „B − A“?', 'Nein, das Ergebnis hängt davon ab, welcher Körper abgezogen wird', ['Ja, bei jeder Operation', 'Ja, aber nur bei gleich großen Körpern', 'Nur, wenn sich beide Körper nicht berühren'],
      'Die Differenz ist nicht vertauschbar: A − B behält, was von A übrig bleibt, B − A das, was von B übrig bleibt.', ['Probiere es mit einem Block und einem kleinen Zylinder.', 'Die Reihenfolge entscheidet, was abgezogen wird.']]
  ];
  const PAQ = [
    ['Was ist ein Parameter im CAD?', 'Ein benannter Wert (zum Beispiel Länge oder Wandstärke), der Maße steuert und an einer Stelle geändert werden kann', ['Ein Bauteil in der Baugruppe', 'Ein Dateiformat', 'Eine Ansicht des Modells'],
      'Parameter sind Werte mit Namen, die Maße im Modell steuern. Du änderst den Wert einmal, und alle Maße, die davon abhängen, folgen.', ['Denke an einen Wert mit Namen.', 'Er steuert Maße.']],
    ['Du änderst die Wandstärke von 2 mm auf 3 mm. Was ist bei einem parametrischen Modell zu erwarten?', 'Alle davon abhängigen Features werden neu berechnet', ['Nichts, das Modell bleibt wie es war', 'Du musst alle Features neu zeichnen', 'Nur die Skizze ändert sich, der Körper nicht'],
      'Das Modell wird in der Reihenfolge des Feature-Baums neu aufgebaut. Alle Features, die von der Wandstärke abhängen, folgen automatisch.', ['Parametrisch heißt: Das Modell folgt den Werten.', 'Es wird neu aufgebaut.']],
    ['Die Höhe eines Deckels soll immer halb so groß sein wie die Gehäusehöhe. Wie setzt du das parametrisch um?', 'Mit einer Gleichung: Deckelhöhe = Gehäusehöhe / 2', ['Beide Zahlen von Hand eintippen', 'Zwei getrennte Skizzen ohne Bezug', 'Die Höhe weglassen'],
      'Mit einer Gleichung koppelst du den Deckelwert an die Gehäusehöhe. Ändert sich die Gehäusehöhe, folgt der Deckel.', ['Der eine Wert soll aus dem anderen berechnet werden.', 'Das geht mit einer Gleichung zwischen Parametern.']],
    ['Welchen Vorteil bringen sprechende Parameternamen wie „wand“ statt „d23“?', 'Andere und du selbst verstehen später schneller, was der Wert steuert', ['Das Programm rechnet schneller', 'Das Modell wird leichter', 'Der Name legt die Dichte fest'],
      'Ein sprechender Name erklärt sich selbst. Das hilft bei Änderungen, in Gleichungen und beim Teilen des Modells im Team.', ['Es geht um die Lesbarkeit für Menschen.', 'Ein klarer Name erklärt den Wert.']]
  ];
  const OPT = { union: 'die Vereinigung (A + B)', diff: 'die Differenz (A − B, also B wird von A abgezogen)', inter: 'die Schnittmenge (A ∩ B)' };
  const A4 = {
    boq: pq(BOQ, ['Lies, was mit den Körpern passieren soll.', 'Überlege: zusammenfügen, abziehen oder nur das Gemeinsame behalten.', 'Wähle die passende Operation.']),
    bvol(R) {
      const op = C().pick(R, ['union', 'diff', 'inter']), va = C().ri(R, 30, 90), vb = C().ri(R, 20, 70), z = C().ri(R, 4, Math.floor(Math.min(va, vb) / 2)), v = { union: va + vb - z, diff: va - z, inter: z }[op];
      return numQ('Zwei Körper A und B überlappen sich. A hat ' + va + ' cm³, B hat ' + vb + ' cm³, der gemeinsame Überlappungsbereich hat ' + z + ' cm³. Welches Volumen hat ' + OPT[op] + '?', v, 'cm³', 'Volumen', 0.01,
        { union: 'Die Überlappung steckt in A und in B. Sie darf nur einmal gezählt werden: ' + va + ' + ' + vb + ' − ' + z + ' = ' + v + ' cm³.', diff: 'Von A fällt der Teil weg, der in B liegt: ' + va + ' − ' + z + ' = ' + v + ' cm³.', inter: 'Die Schnittmenge ist genau der Überlappungsbereich: ' + z + ' cm³.' }[op],
        { union: ['Die Überlappung nicht doppelt zählen.', va + ' + ' + vb + ' − ' + z], diff: ['Abgezogen wird nur der Teil von B, der auch in A liegt.', va + ' − ' + z], inter: ['Gefragt ist nur der gemeinsame Bereich.', 'Der Überlappungsbereich: ' + z] }[op],
        ['Prüfe, welche Operation gefragt ist.', 'Überlege, welche Anteile dazugehören.', 'Rechne mit den drei gegebenen Volumen.']);
    },
    bzyl(R) {
      const hb = C().pick(R, [10, 15, 20, 25, 30]), d = C().pick(R, [10, 16, 20, 24, 30, 36]), op = C().pick(R, ['union', 'diff', 'inter']), o = C().boolOps({ L: 60, B: 40, Hb: hb, d, Hc: 50 }), v = o[op] / 1000;
      return numQ('Block A: 60 mm × 40 mm × ' + hb + ' mm. Zylinder B: Ø ' + d + ' mm, 50 mm hoch, steht in der Mitte des Blocks und beginnt auf der Höhe der Blockunterseite (siehe Bild). Welches Volumen hat ' + OPT[op] + '?', v, 'cm³', 'Volumen', tolRel(v),
        'Block ' + f(o.a, 0) + ' mm³, Zylinder ' + f(o.b, 0) + ' mm³, gemeinsamer Teil (Zylinder auf Blockhöhe) ' + f(o.i, 0) + ' mm³. ' + { union: 'Vereinigung = A + B − gemeinsam = ' + f(o.union, 0), diff: 'Differenz = A − gemeinsam = ' + f(o.diff, 0), inter: 'Schnittmenge = gemeinsam = ' + f(o.inter, 0) }[op] + ' mm³ = ' + f(v, 2) + ' cm³.',
        ['Der gemeinsame Teil ist ein Zylinder, der nur so hoch ist wie der Block.', { union: 'A + B − π/4 · ' + d + '² · ' + hb, diff: '60 · 40 · ' + hb + ' − π/4 · ' + d + '² · ' + hb, inter: 'π/4 · ' + d + '² · ' + hb }[op] + ' mm³, dann durch 1.000'],
        ['Volumen von A, B und dem gemeinsamen Teil bestimmen.', 'Je nach Operation verrechnen.', 'In cm³ umrechnen (durch 1.000).'], { img: { k: 'bool', op, d, hb } });
    },
    skal(R) {
      const k = C().pick(R, [2, 3, 4, 1.5, 2.5, 0.5]), v = k * k * k;
      return numQ('Du skalierst ein Modell in allen drei Richtungen (Länge, Breite und Höhe) mit dem Faktor ' + f(k, 1) + '. Um welchen Faktor ändert sich das Volumen?', v, '', 'Faktor', 0.01,
        'Alle drei Längen werden mit ' + f(k, 1) + ' multipliziert, das Volumen ändert sich mit dem Faktor ' + f(k, 1) + '³ = ' + f(v, 3) + '.',
        ['Das Volumen enthält drei Längen.', f(k, 1) + ' · ' + f(k, 1) + ' · ' + f(k, 1)],
        ['Überlege, wie oft der Faktor im Volumen vorkommt (Länge, Breite, Höhe).', 'Den Faktor dreimal multiplizieren.']);
    },
    masse(R) {
      const m = C().pick(R, Object.keys(C().DICHTE)), rho = C().DICHTE[m], L = C().pick(R, [20, 30, 40, 50, 60]), B = C().pick(R, [20, 30, 40, 50]), H = C().pick(R, [10, 20, 30]), v = L * B * H / 1000, mm = C().massG(L * B * H, rho);
      return numQ('Ein Block ist ' + L + ' mm × ' + B + ' mm × ' + H + ' mm groß und besteht aus ' + m + ' (Dichte ' + f(rho, 2) + ' g/cm³). Wie schwer ist er?', mm, 'g', 'Masse', 0.02,
        'Volumen ' + L + ' · ' + B + ' · ' + H + ' = ' + f(L * B * H, 0) + ' mm³ = ' + f(v, 0) + ' cm³. Masse = ' + f(v, 0) + ' cm³ · ' + f(rho, 2) + ' g/cm³ = ' + f(mm, 2) + ' g.',
        ['Erst das Volumen in cm³, dann mit der Dichte malnehmen.', f(v, 0) + ' cm³ · ' + f(rho, 2) + ' g/cm³'],
        ['Volumen in mm³ berechnen und durch 1.000 in cm³ umrechnen.', 'Mit der Dichte malnehmen.']);
    },
    wand(R) {
      const L = C().pick(R, [60, 70, 80, 90, 100]), B = C().pick(R, [40, 50, 60, 70]), H = C().pick(R, [25, 30, 35, 40, 45]), t = C().pick(R, [2, 3, 4]), s = C().housing({ L, B, H, t, r: 0, d: 3 })[3].v, vo = L * B * H, vi = (L - 2 * t) * (B - 2 * t) * (H - t);
      return numQ('Ein Gehäuse ist außen ' + L + ' mm × ' + B + ' mm × ' + H + ' mm groß, oben offen. Wände und Boden sind ' + t + ' mm dick, die Ecken sind nicht gerundet. Wie groß ist das Volumen des Kunststoffs im Gehäuse?', s / 1000, 'cm³', 'Volumen', 0.02,
        'Außen ' + f(vo, 0) + ' mm³. Innenraum (' + (L - 2 * t) + ' · ' + (B - 2 * t) + ' · ' + (H - t) + ') = ' + f(vi, 0) + ' mm³, denn der Boden zählt nur einmal. Differenz ' + f(s, 0) + ' mm³ = ' + f(s / 1000, 2) + ' cm³.',
        ['Äußerer Quader minus Innenraum. Der Innenraum ist an allen Seiten und unten um die Wandstärke kleiner, oben offen.', L + ' · ' + B + ' · ' + H + ' − ' + (L - 2 * t) + ' · ' + (B - 2 * t) + ' · ' + (H - t)],
        ['Volumen des äußeren Quaders berechnen.', 'Maße des Innenraums bestimmen: Länge und Breite minus 2 · Wand, Höhe minus Boden.', 'Differenz bilden und durch 1.000 teilen.'], { img: { k: 'feat', step: 3, p: { L, B, H, t, r: 0, d: 3 } } });
    },
    paq: pq(PAQ, ['Lies, was mit den Werten im Modell passieren soll.', 'Überlege, was ein Parameter im Modell steuert.', 'Wähle die Antwort, die dazu passt.'])
  };

  /* ============================================================ Fertigung und 3D-Druck */
  const UEQ = [
    ['Wann braucht ein Teil im Schmelzschicht-Druck (FDM) meist Stützstrukturen?', 'Wenn Teile stark überhängen (etwa mehr als 45 Grad zur Senkrechten) oder frei in der Luft beginnen', ['Immer, wenn das Teil Löcher hat', 'Nur bei Teilen aus Metall', 'Wenn die Schichthöhe kleiner als 0,3 mm ist'],
      'Jede Schicht braucht Material darunter. Flache Überhänge und freie Kanten hängen sonst in der Luft. Als Faustregel gehen Überhänge bis etwa 45 Grad zur Senkrechten ohne Stützen.', ['Was liegt unter einer überhängenden Schicht?', 'Ohne Unterlage hängt das Material durch.']],
    ['Du drehst ein Teil auf der Bauplatte so, dass weniger Stützen nötig sind. Was verbessert sich außer dem Materialverbrauch?', 'Die Oberflächen, die sonst auf Stützen lägen, werden besser, und die Nacharbeit sinkt', ['Die Dichte des Materials steigt', 'Das CAD-Modell wird genauer', 'Die Maße des Teils ändern sich'],
      'Flächen, die auf Stützen gedruckt werden, werden rau und müssen nachbearbeitet werden. Weniger Stützen heißt bessere Oberfläche, weniger Material und weniger Nacharbeit. Die Maße bleiben gleich.', ['Wo Stützen die Fläche berühren, wird sie rau.', 'Das Modell selbst bleibt unverändert.']],
    ['Ein gedruckter Haken wird auf Zug belastet. Wie liegt er am besten auf der Bauplatte?', 'So, dass die Schichten entlang der Zugrichtung verlaufen', ['Aufrecht stehend, damit der Zug quer zu den Schichten wirkt', 'Egal, 3D-Druck ist in alle Richtungen gleich fest', 'Mit möglichst kleiner Auflagefläche'],
      'Zwischen den Schichten ist ein gedrucktes Teil schwächer als entlang der Schichten. Die Zugkraft sollte die Schichtfugen nicht auseinanderziehen.', ['Wo ist ein gedrucktes Teil am schwächsten?', 'Die Schichtfugen sind die Schwachstelle.']],
    ['Warum ist eine große, ebene Fläche an der Bauplatte günstig?', 'Sie haftet gut auf der Bauplatte und verzieht sich weniger', ['Dort muss die Fläche immer rund sein', 'Dort wird die Dichte des Teils festgelegt', 'Dann sind keine Schichten nötig'],
      'Eine große ebene Fläche klebt sicher auf der Platte. Kleine Auflageflächen lösen sich leichter ab, und das Teil kann sich an den Ecken verziehen.', ['Denke an die erste Schicht.', 'Mehr Fläche heißt mehr Halt.']]
  ];
  const FMQ = [
    ['Du schickst ein Modell an das Druckprogramm (Slicer). Welche Dateiformate sind dafür üblich?', 'STL oder 3MF', ['PDF', 'JPG', 'XLSX'],
      'Druckprogramme lesen Netzmodelle wie STL oder 3MF. PDF, JPG und XLSX enthalten keine 3D-Körper.', ['Es muss ein 3D-Format sein.', 'Üblich sind STL und 3MF.']],
    ['Du willst die genaue Geometrie (Flächen und Kanten) an ein anderes CAD-Programm übergeben. Was passt besser als STL?', 'STEP', ['JPG', 'CSV', 'STL mit weniger Dreiecken'],
      'STEP speichert die genaue Geometrie, die andere CAD-Programme weiterbearbeiten können. STL ist nur ein Netz aus Dreiecken.', ['Genau und austauschbar zwischen CAD-Programmen.', 'Das Format heißt STEP.']],
    ['Was ist an einer STL-Datei typisch?', 'Die Oberfläche besteht aus Dreiecken, Rundungen sind nur angenähert', ['Sie speichert den Feature-Baum', 'Sie speichert alle Parameter', 'Sie enthält die Stückliste'],
      'STL beschreibt nur die Oberfläche als Dreiecksnetz. Feature-Baum, Parameter und Stückliste gehen beim Export verloren.', ['Was bleibt übrig, wenn du nur die Oberfläche speicherst?', 'Ein Netz aus Dreiecken.']],
    ['Warum sollte man beim STL-Export die Auflösung nicht zu grob einstellen?', 'Rundungen werden sonst eckig, weil das Netz zu wenige Dreiecke hat', ['Das Material wird teurer', 'Die Maße werden zu groß', 'Der Ursprung verschiebt sich'],
      'Bei grober Einstellung bilden wenige große Dreiecke die Rundungen nach, und das Teil sieht gerundet eckig aus. Sehr fein macht dafür die Datei groß.', ['Wie wird ein Kreis aus Dreiecken angenähert?', 'Wenige Dreiecke ergeben Ecken.']]
  ];
  const A5 = {
    layers(R) {
      const lh = C().pick(R, [0.2, 0.3]), h = C().pick(R, lh === 0.2 ? [12, 16, 24, 30, 36, 48] : [12, 18, 24, 30, 36, 45]), n = Math.round(h / lh);
      return numQ('Ein Teil ist ' + h + ' mm hoch und wird mit der Schichthöhe ' + f(lh, 1) + ' mm gedruckt. Aus wie vielen Schichten besteht es?', n, '', 'Schichten', 0,
        h + ' mm / ' + f(lh, 1) + ' mm = ' + n + ' Schichten.', ['Teile die Höhe durch die Höhe einer Schicht.', h + ' / ' + f(lh, 1)],
        ['Gesamthöhe und Schichthöhe ablesen.', 'Gesamthöhe durch Schichthöhe teilen.'], { img: { k: 'print' } });
    },
    peri(R) {
      const lb = C().pick(R, [0.4, 0.6]), w = C().pick(R, lb === 0.4 ? [1.2, 1.6, 2, 2.4, 2.8] : [1.2, 1.8, 2.4, 3]), n = Math.round(w / lb);
      return numQ('Ein Druckprogramm druckt die Wand eines Gehäuses aus einzelnen Linien (Perimeter). Eine Linie ist ' + f(lb, 1) + ' mm breit. Die Wand soll ' + f(w, 1) + ' mm dick sein. Wie viele Linien braucht die Wand?', n, '', 'Linien', 0,
        f(w, 1) + ' mm / ' + f(lb, 1) + ' mm = ' + n + ' Linien. Eine Wandstärke, die ein Vielfaches der Linienbreite ist, lässt sich sauber drucken.',
        ['Wandstärke durch Linienbreite.', f(w, 1) + ' / ' + f(lb, 1)], ['Wandstärke und Linienbreite ablesen.', 'Wandstärke durch Linienbreite teilen.']);
    },
    spiel(R) {
      const a = C().pick(R, [6, 8, 10, 12, 15, 20]), s = C().pick(R, [0.1, 0.15, 0.2, 0.25]), v = a + 2 * s;
      return numQ('Ein Zapfen mit Ø ' + a + ' mm soll in eine gedruckte Bohrung passen. Auf jeder Seite soll ' + f(s, 2) + ' mm Spiel bleiben. Welchen Durchmesser modellierst du für die Bohrung?', v, 'mm', 'Bohrungsdurchmesser', 0.005,
        'Das Spiel gibt es auf beiden Seiten, also zweimal: ' + a + ' + 2 · ' + f(s, 2) + ' = ' + f(v, 2) + ' mm.', ['Der Durchmesser wächst auf beiden Seiten.', a + ' + 2 · ' + f(s, 2)],
        ['Spiel pro Seite ablesen.', 'Mit 2 malnehmen (beide Seiten) und zum Zapfendurchmesser addieren.']);
    },
    filament(R) {
      const v = C().pick(R, [15, 20, 25, 30, 35, 40, 45, 50]), pr = C().pick(R, [20, 24, 28, 32]), m = C().massG(v * 1000, C().DICHTE.PLA), k = m / 1000 * pr;
      return numQ('Ein Teil hat ' + v + ' cm³ und wird aus PLA (1,24 g/cm³) gedruckt. Rechne vereinfacht mit voller Füllung. Das Filament kostet ' + pr + ' € pro kg. Wie hoch sind die Materialkosten für ein Teil?', k, '€', 'Materialkosten', 0.01,
        'Masse ' + v + ' · 1,24 = ' + f(m, 1) + ' g = ' + f(m / 1000, 4) + ' kg. Kosten ' + f(m / 1000, 4) + ' kg · ' + pr + ' €/kg = ' + f(k, 2) + ' €.',
        ['Erst die Masse in g, dann in kg, dann mit dem Preis.', v + ' · 1,24 / 1.000 · ' + pr],
        ['Masse aus Volumen und Dichte berechnen.', 'In kg umrechnen.', 'Mit dem Preis je kg malnehmen.']);
    },
    ueq: pq(UEQ, ['Lies, um welches Druckproblem es geht.', 'Denke an die Schichten: Was liegt darunter, wie liegen die Fugen?', 'Wähle die Antwort, die dazu passt.'], { k: 'print' }),
    fmq: pq(FMQ, ['Lies, wofür die Datei gebraucht wird.', 'Überlege, ob ein Netz genügt oder die genaue Geometrie gebraucht wird.', 'Wähle das passende Format.'])
  };

  /* ============================================================ Baugruppe und Zusammenbau */
  const MTQ = [
    ['Eine Schraube soll in einer Bohrung sitzen, ihre Achsen sollen auf einer Linie liegen. Welche Zusammenbaubedingung passt?', 'Konzentrisch', ['Parallel', 'Tangential', 'Abstand'],
      'Konzentrisch legt zwei runde Körper auf dieselbe Achse. So sitzt die Schraube mittig in der Bohrung.', ['Zwei Achsen sollen zusammenfallen.', 'Das ist bei runden Teilen konzentrisch.']],
    ['Der Deckel soll mit seiner Unterseite plan auf der Gehäusekante aufliegen. Welche Bedingung passt?', 'Koinzident (Fläche auf Fläche)', ['Konzentrisch', 'Tangential', 'Winkel'],
      'Koinzident legt zwei Flächen aufeinander. So liegt der Deckel plan auf dem Gehäuse.', ['Zwei ebene Flächen sollen sich berühren.', 'Fläche auf Fläche heißt koinzident.']],
    ['Ein Bauteil der Baugruppe ist „fixiert“. Was bedeutet das?', 'Es bleibt an seinem Platz und dient den anderen Teilen als Bezug', ['Es wird aus der Stückliste gestrichen', 'Es wird gelöscht', 'Es wird in eine Skizze umgewandelt'],
      'Ein fixiertes Bauteil lässt sich nicht verschieben. Die anderen Teile werden mit Bedingungen daran befestigt. Meist fixiert man das Teil, das alles trägt, zum Beispiel das Gehäuse.', ['Ohne Bezug würden alle Teile im Raum schweben.', 'Fixiert heißt: bewegt sich nicht.']],
    ['Was zeigt eine Kollisionsprüfung (Interferenzprüfung) in der Baugruppe?', 'Ob sich Bauteile überschneiden, also am selben Ort Material haben', ['Wie schwer die Baugruppe ist', 'Welche Farbe die Teile haben', 'Ob die Skizze voll bestimmt ist'],
      'Zwei feste Körper können nicht am selben Ort sein. Die Prüfung findet Stellen, an denen sie sich im Modell durchdringen. Das wäre in der Wirklichkeit nicht montierbar.', ['Zwei Teile können nicht an derselben Stelle sein.', 'Es geht um Überschneidung.']],
    ['Wozu dient eine Explosionsansicht?', 'Die Teile werden auseinandergezogen gezeigt, damit der Zusammenbau erkennbar wird', ['Sie berechnet die Festigkeit', 'Sie löscht verdeckte Teile', 'Sie legt die Maße fest'],
      'Eine Explosionsansicht zieht die Bauteile entlang der Montagerichtung auseinander. Sie hilft bei Montageanleitungen und Zeichnungen.', ['Denke an eine Montageanleitung.', 'Die Teile werden auseinandergezogen.']],
    ['Was steht in einer Stückliste, die aus der Baugruppe erzeugt wird?', 'Alle Bauteile mit Benennung und Anzahl', ['Nur die Schrauben', 'Nur die Parameter', 'Die Reihenfolge der Features'],
      'Die Stückliste zählt alle Bauteile der Baugruppe auf, mit Benennung und Anzahl, oft auch mit Werkstoff.', ['Die Stückliste sagt, was und wie viel gebraucht wird.', 'Sie zählt alle Teile.']]
  ];
  const A6 = {
    gehaeuse(R) {
      const P = C().pick(R, [50, 60, 65, 70, 80, 90, 100]), s = C().pick(R, [0.5, 1]), t = C().pick(R, [2, 2.4, 3]), v = P + 2 * s + 2 * t;
      return numQ('Eine Platine ist ' + P + ' mm lang. Zwischen Platine und Innenwand soll auf jeder Seite ' + f(s, 1) + ' mm Spiel bleiben, die Wände sind ' + f(t, 1) + ' mm dick. Wie lang ist das Gehäuse außen?', v, 'mm', 'Außenlänge', 0.01,
        'Innenmaß = ' + P + ' + 2 · ' + f(s, 1) + ' = ' + f(P + 2 * s, 1) + ' mm. Außenmaß = Innenmaß + 2 · ' + f(t, 1) + ' = ' + f(v, 1) + ' mm.',
        ['Spiel und Wand gibt es an beiden Enden, also je zweimal.', P + ' + 2 · ' + f(s, 1) + ' + 2 · ' + f(t, 1)],
        ['Innenmaß aus Platine und Spiel bestimmen.', 'Wandstärke an beiden Seiten addieren.'], { img: { k: 'pcb' } });
    },
    kernloch(R) {
      const g = C().pick(R, [[3, 0.5], [4, 0.7], [5, 0.8], [6, 1], [8, 1.25]]), v = g[0] - g[1];
      return numQ('Du modellierst ein Gewindeloch für eine Schraube M' + g[0] + ' (Steigung ' + f(g[1], 2) + ' mm) als Kernloch. Welchen Durchmesser hat das Kernloch nach der Faustformel „Nenndurchmesser minus Steigung“?', v, 'mm', 'Kernlochdurchmesser', 0.005,
        'Nenndurchmesser ' + g[0] + ' mm minus Steigung ' + f(g[1], 2) + ' mm = ' + f(v, 2) + ' mm.', ['Der Nenndurchmesser steht hinter dem M.', g[0] + ' − ' + f(g[1], 2)],
        ['Nenndurchmesser und Steigung ablesen.', 'Die Steigung vom Nenndurchmesser abziehen.']);
    },
    mt1: pq(MTQ, ['Lies, wie die Teile zueinander liegen sollen.', 'Überlege, ob es um Achsen, Flächen oder Abstände geht.', 'Wähle die Bedingung, die genau das festlegt.'], null),
    mt2: pq(MTQ, ['Lies, was geprüft oder dokumentiert werden soll.', 'Überlege, was die Baugruppe dafür bietet.', 'Wähle die Antwort, die dazu passt.'], null),
    gesamtm(R) {
      const m1 = C().ri(R, 300, 650) / 10, m2 = C().ri(R, 100, 300) / 10, n = C().pick(R, [2, 4, 6]), m3 = C().ri(R, 5, 15) / 10, m4 = C().ri(R, 150, 300) / 10, v = m1 + m2 + n * m3 + m4;
      return numQ('Die Baugruppe „Sensorgehäuse“ besteht aus: Gehäuse ' + f(m1, 1) + ' g, Deckel ' + f(m2, 1) + ' g, Platine ' + f(m4, 1) + ' g und ' + n + ' Schrauben mit je ' + f(m3, 1) + ' g. Wie schwer ist die ganze Baugruppe?', v, 'g', 'Gesamtmasse', 0.05,
        n + ' Schrauben wiegen ' + n + ' · ' + f(m3, 1) + ' = ' + f(n * m3, 1) + ' g. Summe: ' + f(m1, 1) + ' + ' + f(m2, 1) + ' + ' + f(m4, 1) + ' + ' + f(n * m3, 1) + ' = ' + f(v, 1) + ' g.',
        ['Schrauben erst mit der Stückzahl malnehmen.', f(m1, 1) + ' + ' + f(m2, 1) + ' + ' + f(m4, 1) + ' + ' + n + ' · ' + f(m3, 1)],
        ['Masse aller gleichen Teile berechnen (Anzahl mal Einzelmasse).', 'Alle Massen addieren.']);
    },
    raster(R) {
      const t = C().pick(R, [[30, 40], [60, 80], [48, 64], [36, 48], [54, 72], [45, 60], [75, 100]]), a = C().pick(R, [3, 4, 5]), c = Math.hypot(t[0], t[1]);
      return numQ('Eine Platine ist ' + (t[0] + 2 * a) + ' mm × ' + (t[1] + 2 * a) + ' mm groß. Die vier Montagebohrungen sitzen symmetrisch, jede Mitte ' + a + ' mm von den beiden nächsten Kanten entfernt. Wie weit sind zwei diagonal gegenüberliegende Bohrungsmitten voneinander entfernt?', c, 'mm', 'Abstand', 0.01,
        'In X-Richtung: ' + (t[0] + 2 * a) + ' − 2 · ' + a + ' = ' + t[0] + ' mm. In Y-Richtung: ' + (t[1] + 2 * a) + ' − 2 · ' + a + ' = ' + t[1] + ' mm. Diagonale = Wurzel aus (' + t[0] + '² + ' + t[1] + '²) = ' + f(c, 0) + ' mm.',
        ['Erst die Abstände in X und Y bestimmen, dann Pythagoras.', 'Wurzel aus (' + t[0] + '² + ' + t[1] + '²)'],
        ['Abstand der Bohrungen in X berechnen (Länge minus zweimal Randabstand).', 'Dasselbe in Y.', 'Mit dem Satz des Pythagoras die Diagonale berechnen.']);
    }
  };

  const G = Object.assign({}, A1, A2, A3, A4, A5, A6);
  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument, Lehrjahr */
  const [K1, K2, K3, K4, K5, K6] = CATS;
  const defs = [
    [K1, 1, 'Skizzenebene wählen', 'ebq', [0, 1, 2], 1], [K1, 1, 'Ebenen und Ursprung', 'ebq', [3, 4], 1], [K1, 1, 'Ansichten', 'anq', null, 1], [K1, 1, 'Abstand vom Ursprung', 'abstand', null, 1], [K1, 1, 'Lage der Mitte', 'mitte', null, 1], [K1, 2, 'Bohrung von der Mitte aus', 'kante', null, 1],
    [K2, 1, 'Freie Elemente zählen', 'dofsum', null, 1], [K2, 2, 'Was bleibt noch frei', 'dofleft', null, 2], [K2, 3, 'Fehlende Maße', 'dofvoll', null, 2], [K2, 1, 'Bedingungen erkennen', 'bdq', null, 1], [K2, 2, 'Zustand der Skizze', 'zsq', null, 2], [K2, 2, 'Symmetrisch bemaßen', 'symm', null, 1],
    [K3, 1, 'Passendes Feature', 'ftq', null, 2], [K3, 1, 'Extrusion', 'extr', null, 2], [K3, 2, 'Ausschnitt mit Bohrung', 'cut', null, 2], [K3, 2, 'Rotation', 'rev', null, 2], [K3, 3, 'Rundungen', 'fil', null, 2], [K3, 2, 'Muster', 'pat', null, 2], [K3, 2, 'Spiegeln', 'spieg', null, 2], [K3, 2, 'Reihenfolge der Features', 'fo1', [0, 1], 2], [K3, 2, 'Feature-Baum lesen', 'fo2', [2, 3, 4], 2],
    [K4, 1, 'Boolesche Operationen', 'boq', null, 2], [K4, 2, 'Überlappende Körper', 'bvol', null, 2], [K4, 3, 'Block und Zylinder', 'bzyl', null, 2], [K4, 2, 'Skalieren', 'skal', null, 2], [K4, 1, 'Masse aus Maßen', 'masse', null, 2], [K4, 3, 'Gehäuse mit Wand', 'wand', null, 2], [K4, 2, 'Parameter ändern', 'paq', null, 2],
    [K5, 1, 'Schichten zählen', 'layers', null, 2], [K5, 2, 'Wandstärke und Düse', 'peri', null, 2], [K5, 2, 'Spiel für Passungen', 'spiel', null, 2], [K5, 2, 'Materialkosten', 'filament', null, 3], [K5, 2, 'Überhang und Stützen', 'ueq', [0, 1], 2], [K5, 3, 'Ausrichtung im Druck', 'ueq', [2, 3], 3], [K5, 2, 'Dateiformate', 'fmq', null, 3],
    [K6, 2, 'Gehäuse um die Platine', 'gehaeuse', null, 2], [K6, 2, 'Kernloch für ein Gewinde', 'kernloch', null, 2], [K6, 1, 'Zusammenbaubedingungen', 'mt1', [0, 1, 2], 2], [K6, 2, 'Prüfen und Dokumentieren', 'mt2', [3, 4, 5], 3], [K6, 1, 'Masse der Baugruppe', 'gesamtm', null, 2], [K6, 3, 'Montagebohrungen', 'raster', null, 3]
  ];
  const tasks = defs.map((d, i) => ({ id: 'cad' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4], lj: d[5] }));
  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('cad-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.CAD_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, pools: { EBQ, ANQ, BDQ, ZSQ, FTQ, FOQ, BOQ, PAQ, UEQ, FMQ, MTQ } };
  root.CAD_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.CAD_DATA, TASKS: root.CAD_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
