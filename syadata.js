'use strict';
/* Tonfunk Systemanalyse-Lab: Daten (Aufgaben-Generatoren). Lab-Kennung 'sya'.
   ALLE Zahlen sind ÜBUNGSWERTE, Modellgerät Temperaturwächter TW-1 vom Modellbetrieb (frei erfunden).
   window.SYA_DATA  { cats, lj, tasks, gens, make, makeTask, randomQ, pools }
   window.SYA_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.sya.done' = {id:true})
   Jede Frage q: { text, ask, value, tol, expl, tips[2], steps[] (So gehst du vor), table? {head, rows}, img? (Bild für SYA_VIZ.taskImg) }.
   Titel verraten weder Ergebnis noch Fehler. */
(function (root) {
  const C = () => root.SYA_CORE || (typeof require === 'function' ? require('./syacore.js') : null);
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true), eu = v => C().fmtDe(v, 2, true) + ' €';
  const CATS = ['Blockschaltbild und Signalweg', 'Fehlersuche nach Messprotokoll', 'Prüfung nach Instandsetzung', 'Bauteile dimensionieren', 'Dokumentation und Übergabe'];

  const numQ = (text, value, unit, label, tol, expl, tips, steps, more) => Object.assign({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips, steps }, more || {});
  function choiceQ(R, text, right, wrong, expl, tips, steps, more) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return Object.assign({ text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips, steps }, more || {});
  }
  /* Pool: Einträge [Text, richtig, falsch[], Erklärung, Tipps]; Schritte und Bild gelten für den ganzen Pool */
  const pq = (POOL, steps, img) => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4], steps, img ? { img } : null); };
  const bn = k => C().BLOCKS.find(b => b.k === k).n;
  const IMGB = mps => ({ k: 'block', mps: mps || [] });

  /* ============================================================ Blockschaltbild und Signalweg */
  const CHAIN = ['netz', 'f1', 'trafo', 'gl', 'c1', 'reg', 'mc', 'drv', 'rel'];
  const FKT = {
    f1: 'Trennt das Gerät bei Überstrom vom Netz und schaltet es ein und aus',
    trafo: 'Setzt die Netzspannung herab und trennt sicher vom Netz',
    gl: 'Formt Wechselspannung in pulsierende Gleichspannung um',
    c1: 'Glättet die pulsierende Gleichspannung (speichert Energie zwischen)',
    reg: 'Hält die Ausgangsspannung konstant auf 5 V',
    ntc: 'Wandelt die Temperatur in einen Widerstand und damit in eine Spannung um',
    drv: 'Verstärkt den kleinen Ausgangsstrom des Mikrocontrollers auf den Spulenstrom',
    rel: 'Schaltet den Lastkreis galvanisch getrennt vom Steuerkreis'
  };
  const MPART = {
    MP1: 'Wechselspannung, etwa 230 V', MP2: 'Wechselspannung, etwa 9 V', MP3: 'Gleichspannung mit Brummen, etwa 11 V', MP4: 'Geregelte Gleichspannung 5 V'
  };
  const PRES_U = [6, 9, 12, 15];

  const BFQ_STEPS = ['Suche den Block im Blockschaltbild.', 'Überlege, was am Eingang des Blocks ankommt und was am Ausgang herauskommt.', 'Wähle die Aufgabe, die genau diese Umformung beschreibt.'];
  const A = {
    blockzw(R) {
      const i = C().ri(R, 1, CHAIN.length - 2), a = CHAIN[i - 1], b = CHAIN[i + 1], right = bn(CHAIN[i]);
      const wrong = C().shuffle(R, CHAIN.filter((k, j) => j !== i)).slice(0, 3).map(bn);
      return choiceQ(R, 'Im Blockschaltbild des TW-1 fließt die Energie bzw. das Signal von „' + bn(a) + '“ zu „' + bn(b) + '“. Welcher Block liegt direkt dazwischen?', right, wrong,
        'Die Kette lautet: Netz, F1 und S1, Trafo, Gleichrichter, Ladeelko, Regler, Mikrocontroller, Treiber, Relais. Zwischen „' + bn(a) + '“ und „' + bn(b) + '“ liegt „' + right + '“.',
        ['Fang beim Netzstecker an und folge den Pfeilen der Energie.', 'Erst kommt die Netzseite (F1, Trafo), dann das Netzteil (Gleichrichter, Elko, Regler), dann die Steuerung mit Treiber und Relais.'],
        ['Suche den ersten genannten Block im Bild.', 'Folge der Leitung in Energie- bzw. Signalrichtung.', 'Der nächste Block vor dem zweiten genannten Block ist die Antwort.'], { img: IMGB() });
    },
    spart(R) {
      const k = C().pick(R, ['MP1', 'MP2', 'MP3', 'MP4']), right = MPART[k], wrong = Object.keys(MPART).filter(x => x !== k).map(x => MPART[x]);
      const mp = C().MPS.find(x => x.k === k);
      return choiceQ(R, 'Welche Spannung erwartest du im fehlerfreien Gerät an ' + k + ' (' + mp.n + ')?', right, wrong,
        k + ' liegt ' + { MP1: 'vor dem Trafo auf der Netzseite: Netzwechselspannung 230 V.', MP2: 'hinter dem Trafo: Wechselspannung 9 V (Effektivwert unter Last).', MP3: 'am Ladeelko hinter dem Gleichrichter: ungeregelte Gleichspannung von etwa 11 V mit Brummspannung.', MP4: 'hinter dem Regler: geregelte, glatte 5 V.' }[k],
        ['Schau, welcher Block direkt vor dem Messpunkt liegt.', 'Trafo: Wechselspannung klein; Gleichrichter und Elko: Gleichspannung mit Brummen; Regler: glatte 5 V.'],
        ['Finde ' + k + ' im Blockschaltbild.', 'Bestimme den Block direkt davor.', 'Überlege, welche Spannungsart dieser Block liefert.'], { img: IMGB([k]) });
    },
    sigweg(R) {
      const right = 'Fühler → Mikrocontroller → Treiber V2 → Relais K1 → Lüfter';
      const wrong = ['Fühler → Treiber V2 → Mikrocontroller → Relais K1 → Lüfter', 'Mikrocontroller → Fühler → Relais K1 → Treiber V2 → Lüfter', 'Fühler → Relais K1 → Treiber V2 → Mikrocontroller → Lüfter'];
      return choiceQ(R, 'Der Fühler wird auf 70 °C erwärmt. In welcher Reihenfolge läuft das Signal, bis der Lüfter am Relaisausgang anläuft?', right, wrong,
        'Der NTC ändert seinen Widerstand, der Mikrocontroller misst die Spannung an MP5 und schaltet bei 60 °C seinen Ausgang (MP6). Der Treiber V2 schaltet den Spulenstrom, das Relais K1 zieht an und schaltet den Lüfter.',
        ['Wer misst, wer entscheidet, wer verstärkt, wer schaltet?', 'Der Mikrocontroller kann die Spule nicht direkt treiben, dazwischen liegt der Transistor.'],
        ['Beginne beim Sensor (Eingang).', 'Danach kommt die Verarbeitung, dann die Verstärkung.', 'Am Ende steht das Stellglied mit dem Verbraucher.'], { img: IMGB(['MP5', 'MP6', 'MP8']) });
    },
    bfkt(R) {
      const k = C().pick(R, Object.keys(FKT)), right = FKT[k], wrong = C().shuffle(R, Object.keys(FKT).filter(x => x !== k)).slice(0, 3).map(x => FKT[x]);
      return choiceQ(R, 'Welche Aufgabe hat der Block „' + bn(k) + '“ im TW-1?', right, wrong, bn(k) + ': ' + right + '.',
        ['Was geht in den Block hinein, was kommt heraus?', 'Beispiel: Der Gleichrichter bekommt Wechselspannung und gibt pulsierende Gleichspannung ab.'], BFQ_STEPS, { img: IMGB() });
    },
    scheitel(R) {
      const U = C().pick(R, PRES_U), v = C().rd(C().peak(U), 2);
      return numQ('Du misst an MP2 mit dem Vielfachmessgerät (V~) ' + f(U, 0) + ' V. Wie groß ist der Scheitelwert dieser Sinusspannung?', v, 'V', 'Scheitelwert Û', 0.05,
        'Das Messgerät zeigt den Effektivwert. Û = U · √2 = ' + f(U, 0) + ' V · 1,414 = ' + f(v, 2) + ' V.',
        ['Das Messgerät zeigt bei V~ den Effektivwert an.', 'Û = U · √2 = ' + f(U, 0) + ' V · 1,414'],
        ['Erkenne: Angezeigt wird der Effektivwert U.', 'Rechne Û = U · √2.', 'Runde auf zwei Stellen und gib das Ergebnis in V an.'], { img: { k: 'scope', v: C().rd(2 * C().peak(U), 1), f: 50, art: 'ac' } });
    },
    ucleer(R) {
      const U = C().pick(R, PRES_U), v = C().rd(C().ucPeak(U, 2, 0.7), 2);
      return numQ('Hinter dem Trafo misst du ' + f(U, 0) + ' V~. Der Brückengleichrichter hat Siliziumdioden mit 0,7 V Durchlassspannung. Auf welche Spannung lädt sich der Elko C1 ohne Last höchstens auf?', v, 'V', 'Spannung an C1', 0.05,
        'Û = ' + f(U, 0) + ' V · 1,414 = ' + f(C().peak(U), 2) + ' V. In der Brücke leiten immer zwei Dioden: 2 · 0,7 V = 1,4 V. UC1 = ' + f(C().peak(U), 2) + ' V − 1,4 V = ' + f(v, 2) + ' V.',
        ['Der Elko lädt sich auf den Scheitelwert auf, abzüglich der Dioden, die gerade leiten.', 'UC1 = U · √2 − 2 · 0,7 V = ' + f(U, 0) + ' V · 1,414 − 1,4 V'],
        ['Scheitelwert der Trafospannung berechnen.', 'Zählen, wie viele Dioden in der Brücke gleichzeitig leiten (zwei).', 'Deren Durchlassspannung abziehen.'], { img: { k: 'ripple', up: v, pp: 0.4, f: 100 } });
    },
    brummf(R) {
      const half = R() < 0.5;
      return choiceQ(R, half ? 'Am Oszilloskop siehst du an MP3, dass nur jede zweite Halbwelle den Elko nachlädt. Welche Frequenz hat die Brummspannung (Netz 50 Hz)?' : 'Welche Frequenz hat die Brummspannung an MP3 beim fehlerfreien Brückengleichrichter (Netz 50 Hz)?',
        half ? '50 Hz' : '100 Hz', half ? ['100 Hz', '25 Hz', '200 Hz'] : ['50 Hz', '25 Hz', '200 Hz'],
        half ? 'Wird nur jede zweite Halbwelle genutzt, arbeitet die Schaltung wie ein Einweggleichrichter: eine Nachladung je Periode, also 50 Hz. Typischer Fehler: eine Diode der Brücke ist unterbrochen.' : 'Die Brücke nutzt beide Halbwellen. Je Periode (20 ms) wird der Elko zweimal nachgeladen: 2 · 50 Hz = 100 Hz.',
        ['Zähle die Nachladungen je Netzperiode (20 ms).', 'Brücke: zwei Ladepulse je Periode, Einweg: einer.'],
        ['Netzfrequenz und Periodendauer notieren (50 Hz, 20 ms).', 'Nachladungen je Periode zählen.', 'Frequenz = Nachladungen je Periode · 50 Hz.'], { img: { k: 'ripple', up: 11, pp: half ? 2 : 1, f: half ? 50 : 100 } });
    },
    sensu(R) {
      const T = C().pick(R, [0, 40, 60, 80]), Rn = Math.round(C().rntc(T) / 10) * 10, v = C().rd(C().divider(5, 10000, Rn), 2);
      return numQ('Der NTC hat bei ' + f(T, 0) + ' °C einen Widerstand von ' + f(Rn / 1000, 2) + ' kΩ. Er liegt unten im Spannungsteiler gegen Masse, oben liegt ein Festwiderstand von 10 kΩ an 5 V. Welche Spannung misst du an MP5?', v, 'V', 'Spannung an MP5', 0.02,
        'U5 = 5 V · RNTC / (10 kΩ + RNTC) = 5 V · ' + f(Rn / 1000, 2) + ' kΩ / ' + f(10 + Rn / 1000, 2) + ' kΩ = ' + f(v, 2) + ' V.',
        ['Spannungsteiler: Die Spannung teilt sich im Verhältnis der Widerstände.', 'U5 = 5 V · RNTC / (10 kΩ + RNTC) = 5 V · ' + f(Rn / 1000, 2) + ' kΩ / (10 kΩ + ' + f(Rn / 1000, 2) + ' kΩ)'],
        ['Gesamtwiderstand des Teilers bilden.', 'Anteil des NTC am Gesamtwiderstand bestimmen.', 'Mit 5 V malnehmen.'], { img: IMGB(['MP5']) });
    },
    strom(R) {
      const U = C().pick(R, [10.8, 11, 11.4, 12]), Rs = C().pick(R, [300, 360, 400, 480]), Ic = U / Rs * 1000, v = C().rd(200 + Ic, 1);
      return numQ('Das Relais ist angezogen. Die Spule (' + f(Rs, 0) + ' Ω) liegt an ' + f(U, 1) + ' V von C1, der Regler gibt 200 mA an die 5-V-Seite ab. Wie viel Strom muss C1 insgesamt liefern? (Den Eigenbedarf des Reglers lässt du weg.)', v, 'mA', 'Strom aus C1', 1,
        'ISpule = ' + f(U, 1) + ' V / ' + f(Rs, 0) + ' Ω = ' + f(Ic, 1) + ' mA. Iges = 200 mA + ' + f(Ic, 1) + ' mA = ' + f(v, 1) + ' mA.',
        ['Der Regler gibt seinen Ausgangsstrom aus C1 weiter. Dazu kommt der Spulenstrom.', 'ISpule = U / R = ' + f(U, 1) + ' V / ' + f(Rs, 0) + ' Ω, dann 200 mA dazuzählen.'],
        ['Spulenstrom mit dem ohmschen Gesetz berechnen.', 'In mA umrechnen.', 'Den Strom der 5-V-Seite dazuzählen.'], { img: { k: 'drv' } });
    }
  };

  /* ============================================================ Fehlersuche nach Messprotokoll */
  const SIQ = [
    ['Du willst an MP1 (Primärseite, 230 V) messen. Was ist richtig?', 'Nur mit Messgerät und Messleitungen für Netzspannung (passende Messkategorie), berührungsgeschützten Prüfspitzen und als Elektrofachkraft oder unter deren Aufsicht', ['Mit jedem Messgerät, solange es auf 600 V steht', 'Nur wenn das Gerät keinen Schutzleiter hat', 'Am besten mit dem Oszilloskop, weil der Schutzleiter das Gehäuse erdet'], 'An der Netzseite besteht Lebensgefahr. Messgerät und Messleitungen müssen für Netzspannung und die Messkategorie zugelassen sein, Prüfspitzen berührungsgeschützt. Arbeiten in der Nähe aktiver Teile nur nach den Regeln deines Betriebs.', ['Denk an Lebensgefahr und Messkategorie.', 'Eine Bereichswahl am Messgerät allein macht es nicht sicher.']],
    ['Du willst den Widerstand der Relaisspule messen. Was tust du vorher?', 'Gerät vom Netz trennen, gegen Wiedereinschalten sichern, Elko C1 entladen und Spannungsfreiheit feststellen', ['Nichts, ein Ohmmeter misst auch unter Spannung', 'Nur das Relais abziehen', 'Den Regler kurzschließen'], 'Widerstände misst du nur spannungsfrei. Ein geladener Elko kann das Ohmmeter beschädigen und das Ergebnis verfälschen.', ['Ohmmeter haben eine eigene Spannungsquelle.', 'Denk an den Elko C1: er hält die Spannung auch nach dem Ausstecken.']],
    ['Wie entlädst du den Ladeelko C1 sicher?', 'Über einen passenden Widerstand und danach nachmessen', ['Mit einem Schraubendreher kurzschließen', 'Gar nicht, er entlädt sich sofort', 'Mit dem Finger prüfen, ob er noch geladen ist'], 'Ein Kurzschluss erzeugt einen hohen Stromstoß (Funken, Schaden am Elko). Entlade über einen Widerstand und miss danach, ob die Spannung wirklich weg ist.', ['Ein Kurzschluss ist nie die richtige Lösung.', 'Strom begrenzen, danach messen.']],
    ['Warum nimmst du für die Fehlersuche ein Messprotokoll mit Sollwerten?', 'Weil du jeden Messwert sofort mit dem Sollwert vergleichen und so den Fehler eingrenzen kannst', ['Weil die Messwerte sonst nicht stimmen', 'Weil das Gerät dann schneller abkühlt', 'Weil der Kunde es unterschreiben muss'], 'Ohne Sollwert weißt du nicht, ob ein Messwert gut oder schlecht ist. Mit dem Protokoll grenzt du Schritt für Schritt ein.', ['Was brauchst du, um einen Messwert zu bewerten?', 'Ist gegen Soll.']]
  ];
  const MESQ = [
    ['Du willst die Brummspannung an MP3 (Ladeelko) beurteilen. Womit misst du am besten?', 'Mit dem Oszilloskop (AC-Kopplung), dann siehst du Höhe und Frequenz', ['Mit dem Ohmmeter', 'Mit dem Durchgangsprüfer', 'Mit dem Strommessgerät in Reihe zum Elko'], 'Das Oszilloskop zeigt die Spannungsform. Mit AC-Kopplung blendet es den Gleichanteil aus, dann sind Uss und Frequenz gut ablesbar.', ['Du willst die Form der Spannung sehen.', 'Gleichanteil ausblenden.']],
    ['Welche Messart stellst du an MP2 (Sekundärseite des Trafos) ein?', 'Wechselspannung (V~)', ['Gleichspannung (V=)', 'Widerstand (Ω)', 'Strom (A)'], 'Hinter dem Trafo liegt Wechselspannung. Das Messgerät zeigt bei V~ den Effektivwert.', ['Der Gleichrichter kommt erst danach.', 'Trafo: nur Wechselspannung.']],
    ['Wo legst du die schwarze Messleitung (COM) an, wenn du MP4 bis MP8 misst?', 'An die Masse der Schaltung (Minus von C1)', ['An den Schutzleiter des Netzsteckers', 'An MP1', 'An den Plus des Elkos'], 'Alle Sollwerte für MP3 bis MP8 sind gegen Masse (Minus von C1) angegeben. Bezug falsch, Messwert falsch.', ['Gegen welchen Punkt sind die Sollwerte angegeben?', 'Bezugspunkt der Kleinspannungsseite.']],
    ['MP4 springt im Abstand von Minuten zwischen 0 V und 5 V. Welches Messgerät hilft am meisten?', 'Ein Vielfachmessgerät mit Min/Max-Speicher oder ein Oszilloskop mit langsamer Zeitbasis bzw. Aufzeichnung', ['Ein Ohmmeter', 'Ein Isolationsmessgerät', 'Ein Durchgangsprüfer'], 'Ein Fehler, der nur ab und zu auftritt, muss aufgezeichnet werden: Min/Max-Speicher oder lange Aufzeichnung.', ['Der Fehler ist nicht dauerhaft da.', 'Du brauchst eine Aufzeichnung über Zeit.']]
  ];
  const BILDQ = [
    ['Kunde meldet: „Die Anzeige flackert und das Gerät startet neu, vor allem wenn das Relais angezogen ist.“ Was ist die wahrscheinlichste Ursache?', 'elko', 'Mehr Laststrom (Spule) heißt mehr Brummspannung. Bei zu kleinem Elko fallen die Täler unter die Mindestspannung des Reglers: Einbrüche an MP4, Neustart.'],
    ['Kunde meldet: „Das Gerät geht nach einigen Minuten aus und kommt nach einer Weile wieder.“ An MP3 ist alles in Ordnung. Wahrscheinlichste Ursache?', 'regler', 'Ein Fehler, der mit der Zeit kommt und nach dem Abkühlen verschwindet, deutet auf Übertemperatur. MP3 ist gut, also liegt es am Regler (Kühlung).'],
    ['Kunde meldet: „Der Lüfter läuft immer, auch wenn es kalt ist.“ Die Anzeige zeigt 22 °C. Wahrscheinlichste Ursache?', 'tr', 'Die Steuerung sieht 22 °C und schaltet nicht. Trotzdem zieht das Relais an: Der Transistor ist durchlegiert. Fehlt die Freilaufdiode, passiert das häufig.'],
    ['Die Anzeige zeigt „F1“, das Relais bleibt aus. Wahrscheinlichste Ursache?', 'fopen', 'F1 ist die Meldung für „Fühlerspannung zu hoch“: Der NTC ist abgetrennt, der Festwiderstand zieht MP5 auf 5 V.'],
    ['Die Anzeige bleibt dunkel. An MP1 misst du 230 V, an MP2 0 V. Wahrscheinlichste Ursache?', 'trafo', 'Netzspannung kommt am Trafo an, aber hinten kommt nichts heraus: Die Wicklung ist unterbrochen.']
  ];
  const FN = k => C().faultOf(k).n;
  /* Messprotokoll: Soll (fehlerfrei) und Ist (mit Fehler) bei Temperatur T */
  function protTable(fault, T) {
    const s0 = C().sim('ok', T), s1 = C().sim(fault, T), rows = [];
    const cell = (m, ac) => m.jump ? 'springt 0 bis 5 V' : f(ac ? m.ac : m.dc, ac ? 0 : 2) + (ac ? ' V~' : ' V');
    C().MPS.forEach(mp => {
      const ac = mp.art === 'ac';
      rows.push([mp.k + ' ' + mp.n, cell(s0.mp[mp.k], ac), cell(s1.mp[mp.k], ac)]);
      if (mp.k === 'MP3') rows.push(['MP3 Brummspannung (Oszilloskop)', f(s0.mp.MP3.pp, 1) + ' Vss, ' + f(s0.mp.MP3.f, 0) + ' Hz', s1.mp.MP3.f ? f(s1.mp.MP3.pp, 1) + ' Vss, ' + f(s1.mp.MP3.f, 0) + ' Hz' : '0 Vss']);
    });
    const rel = r => r === true ? 'angezogen' : r ? 'zieht ab und zu an' : 'aus';
    rows.push(['Anzeige', s0.display, s1.display]);
    rows.push(['Relais K1', rel(s0.relay), rel(s1.relay)]);
    return { head: ['Messpunkt', 'Soll', 'Ist'], rows };
  }
  const B = {
    halb1(R) {
      const n = C().pick(R, [6, 8, 10, 12, 16, 20]), v = C().maxMeas(n);
      return numQ('Eine Signalkette hat ' + f(n, 0) + ' Stufen hintereinander. Eine Stufe ist defekt. Wie viele Messungen brauchst du mit der Halbierungsmethode höchstens, um die defekte Stufe zu finden?', v, 'Messungen', 'Anzahl Messungen', 0,
        'Jede Messung halbiert den verdächtigen Bereich: ' + f(n, 0) + ' → ' + (() => { let a = n, s = []; while (a > 1) { a = Math.ceil(a / 2); s.push(f(a, 0)); } return s.join(' → '); })() + '. Das sind ' + f(v, 0) + ' Messungen (2 hoch ' + f(v, 0) + ' = ' + f(Math.pow(2, v), 0) + ' ≥ ' + f(n, 0) + ').',
        ['Jede Messung halbiert die Zahl der verdächtigen Stufen.', 'Rechne 2 · 2 · 2 · ... und zähle die Faktoren, bis das Produkt mindestens ' + f(n, 0) + ' ist.'],
        ['Erste Messung in der Mitte der Kette.', 'Ist der Wert gut, liegt der Fehler dahinter, sonst davor.', 'Halbieren, bis nur eine Stufe übrig ist, und die Messungen zählen.'], { img: IMGB(['MP3']) });
    },
    halbn(R) {
      const good = R() < 0.5, right = good ? 'hinter Stufe 6' : 'hinter Stufe 2';
      return choiceQ(R, 'Eine Kette hat 8 Stufen. Du misst zuerst hinter Stufe 4. Der Wert ist ' + (good ? 'in Ordnung' : 'nicht in Ordnung') + '. Wo misst du als Nächstes?', right, ['hinter Stufe 3', 'hinter Stufe 5', good ? 'hinter Stufe 2' : 'hinter Stufe 6'],
        good ? 'Stufen 1 bis 4 sind in Ordnung, der Fehler liegt in 5 bis 8. Die Mitte davon ist hinter Stufe 6.' : 'Der Fehler liegt in den Stufen 1 bis 4. Die Mitte davon ist hinter Stufe 2.',
        ['Welcher Teil der Kette ist nach der ersten Messung noch verdächtig?', 'Miss in der Mitte des verdächtigen Teils.'],
        ['Entscheide, ob der Fehler vor oder hinter Stufe 4 liegt.', 'Bestimme den verdächtigen Bereich.', 'Wähle dessen Mitte als nächsten Messpunkt.'], { img: IMGB(['MP3', 'MP4']) });
    },
    sicher: pq(SIQ, ['Lies, welche Arbeit ansteht (Messen unter Spannung oder spannungsfrei).', 'Überlege, welche Gefahr dabei besteht.', 'Wähle die Antwort, die diese Gefahr sicher ausschließt.'], { k: 'pruef', m: '', sk: 1 }),
    mesq: pq(MESQ, ['Überlege, welche Größe du brauchst (Gleichspannung, Wechselspannung, Form, Verlauf).', 'Wähle das Messgerät bzw. die Messart dafür.', 'Achte auf den richtigen Bezugspunkt.'], IMGB(['MP3'])),
    prot(R, arg) {
      const fault = C().pick(R, arg), T = fault === 'rb' ? 70 : fault === 'tr' || fault === 'spule' ? 30 : C().pick(R, [25, 70]);
      const others = C().shuffle(R, C().FAULTS.filter(x => x.k !== 'ok' && x.k !== fault && !arg.includes(x.k))).slice(0, Math.max(0, 3 - (arg.length - 1)));
      const wrong = arg.filter(k => k !== fault).map(FN).concat(others.map(x => x.n));
      return choiceQ(R, 'Messprotokoll am TW-1 bei ' + f(T, 0) + ' °C am Fühler. Vergleiche Soll und Ist. Welcher Fehler liegt vor?', FN(fault), wrong,
        C().faultOf(fault).ursache,
        ['Geh das Protokoll von oben (Netz) nach unten (Relais) durch und suche die erste Zeile, in der Ist und Soll nicht passen.', 'Der Fehler sitzt im Block zwischen dem letzten guten und dem ersten schlechten Messpunkt.'],
        ['Zeile für Zeile Ist mit Soll vergleichen.', 'Den letzten guten und den ersten schlechten Messpunkt markieren.', 'Im Blockschaltbild den Block dazwischen suchen und mit dem Gerätezustand (Anzeige, Relais) abgleichen.'],
        { table: protTable(fault, T), img: IMGB(['MP1', 'MP2', 'MP3', 'MP4', 'MP5', 'MP6', 'MP7', 'MP8']) });
    },
    bild(R) {
      const e = C().pick(R, BILDQ), wrong = C().shuffle(R, ['elko', 'regler', 'tr', 'fopen', 'trafo', 'rb', 'diode'].filter(k => k !== e[1])).slice(0, 3).map(FN);
      return choiceQ(R, e[0], FN(e[1]), wrong, e[2],
        ['Was sagt das Fehlerbild über den Ort aus (Netzteil, Steuerung, Treiber)?', 'Tritt der Fehler dauernd, nur unter Last oder nur nach einer Zeit auf?'],
        ['Fehlerbild in eigenen Worten aufschreiben.', 'Blöcke streichen, die sicher in Ordnung sind.', 'Die Ursache wählen, die alle Beobachtungen erklärt.'], { img: IMGB() });
    },
    brumm(R) {
      const I = C().pick(R, [0.2, 0.23, 0.25]), dU = C().pick(R, [4, 5, 6, 7]), v = C().rd(I / (100 * dU) * 1e6, 0);
      return numQ('Der Ladeelko C1 (Sollwert 2.200 µF) steht unter Verdacht. Am Oszilloskop misst du an MP3 eine Brummspannung von ' + f(dU, 0) + ' Vss bei 100 Hz. C1 liefert ' + f(I * 1000, 0) + ' mA. Wie groß ist die wirksame Kapazität noch ungefähr?', v, 'µF', 'wirksame Kapazität', Math.max(5, v * 0.02),
        'ΔU = I / (f · C), umgestellt C = I / (f · ΔU) = ' + f(I, 2) + ' A / (100 Hz · ' + f(dU, 0) + ' V) = ' + f(v, 0) + ' µF. Das ist weit unter 2.200 µF: Der Elko ist ausgetrocknet und muss getauscht werden.',
        ['Benutze die Formel für die Brummspannung und stelle sie nach C um.', 'C = I / (f · ΔU) = ' + f(I, 2) + ' A / (100 Hz · ' + f(dU, 0) + ' V), Ergebnis in µF umrechnen (· 1.000.000).'],
        ['Werte notieren: I in A, f in Hz, ΔU in V.', 'Formel ΔU = I / (f · C) nach C umstellen.', 'Ausrechnen, in µF umrechnen und mit dem Sollwert vergleichen.'], { img: { k: 'scope', v: dU, f: 100, art: 'dc', dc: 9 } });
    },
    mp8(R) {
      const U = C().pick(R, [10.6, 10.9, 11.2]), Us = C().pick(R, [0.1, 0.2]), Rs = C().pick(R, [360, 400]), v = C().rd((U - Us) / Rs * 1000, 1);
      return numQ('Das Relais soll anziehen. An MP3 misst du ' + f(U, 1) + ' V, an MP8 (Kollektor von V2) ' + f(Us, 1) + ' V. Die Spule hat ' + f(Rs, 0) + ' Ω. Wie groß ist der Spulenstrom?', v, 'mA', 'Spulenstrom', 0.6,
        'An der Spule liegt die Differenz: ' + f(U, 1) + ' V − ' + f(Us, 1) + ' V = ' + f(U - Us, 1) + ' V. I = ' + f(U - Us, 1) + ' V / ' + f(Rs, 0) + ' Ω = ' + f(v, 1) + ' mA. Der kleine Wert an MP8 zeigt: V2 ist voll durchgeschaltet.',
        ['Die Spule liegt zwischen MP3 (+U) und MP8 (Kollektor).', 'USpule = UMP3 − UMP8, dann I = USpule / RSpule = (' + f(U, 1) + ' V − ' + f(Us, 1) + ' V) / ' + f(Rs, 0) + ' Ω'],
        ['Spannung an der Spule aus den beiden Messpunkten bestimmen.', 'Ohmsches Gesetz anwenden.', 'In mA umrechnen.'], { img: { k: 'drv' } });
    }
  };

  /* ============================================================ Prüfung nach Instandsetzung */
  const PRQ = [
    ['Wozu dient die Prüfung nach der Instandsetzung?', 'Nachweis, dass das Gerät nach der Reparatur elektrisch sicher ist, bevor es zurück zum Kunden geht', ['Ersatz für die Fehlersuche', 'Nur bei neuen Geräten nötig', 'Nur Kontrolle, ob das Gerät funktioniert'], 'Nach jeder Instandsetzung oder Änderung wird geprüft, ob Schutzmaßnahmen und Isolation in Ordnung sind. Erst dann darf das Gerät übergeben werden.', ['Was könnte bei der Reparatur an der Sicherheit verändert worden sein?', 'Prüfen heißt: Sicherheit nachweisen.']],
    ['Wer darf die Prüfung nach Instandsetzung durchführen?', 'Eine Elektrofachkraft, oder eine elektrotechnisch unterwiesene Person mit geeignetem Prüfgerät unter Leitung und Aufsicht einer Elektrofachkraft', ['Jeder, der ein Prüfgerät hat', 'Nur der Hersteller', 'Der Kunde selbst'], 'Die Verantwortung liegt bei einer Elektrofachkraft. Unterwiesene Personen dürfen nur mit geeigneten Prüfgeräten und unter deren Leitung und Aufsicht prüfen.', ['Es geht um Verantwortung für die Sicherheit.', 'Fachkraft oder Aufsicht durch eine Fachkraft.']],
    ['Was tust du bei der Messung des Schutzleiterwiderstands mit der Netzleitung?', 'Die Leitung abschnittsweise bewegen, besonders an Knickschutz und Zugentlastung, und dabei den Messwert beobachten', ['Die Leitung abziehen', 'Die Leitung fest aufrollen', 'Nichts, die Leitung darf nicht berührt werden'], 'Ein Aderbruch zeigt sich oft nur, wenn die Leitung bewegt wird. Springt der Messwert, ist der Schutzleiter beschädigt.', ['Wo bricht eine Leitung am häufigsten?', 'Ein Wackelkontakt zeigt sich nur bei Bewegung.']],
    ['Wie schließt du ein Gerät der Schutzklasse I für die Isolationsmessung an?', 'L und N werden verbunden und gegen den Schutzleiter (PE) gemessen', ['L gegen N messen', 'Nur N gegen PE messen', 'PE abklemmen und L gegen Gehäuse messen'], 'Gemessen wird zwischen den aktiven Leitern (L und N verbunden) und den berührbaren leitfähigen Teilen bzw. PE.', ['Die Isolation trennt aktive Teile von berührbaren Teilen.', 'Aktive Teile zusammen gegen PE.']],
    ['Warum muss der Netzschalter S1 bei der Isolationsmessung eingeschaltet sein?', 'Damit auch die Teile hinter dem Schalter mitgeprüft werden', ['Damit das Gerät nicht kaputtgeht', 'Damit der Prüfstrom kleiner wird', 'Das ist egal'], 'Bei ausgeschaltetem S1 erreicht die Prüfspannung nur die Teile vor dem Schalter. Ein Isolationsfehler im Trafo bliebe unentdeckt.', ['Was liegt hinter dem Schalter?', 'Alle aktiven Teile sollen erfasst werden.']],
    ['Ein Messwert liegt außerhalb des Grenzwerts. Was tust du?', 'Gerät als nicht sicher kennzeichnen, nicht übergeben, Fehler beheben und neu prüfen', ['Messwert runden und übergeben', 'Dem Kunden sagen, er soll aufpassen', 'Nur den Messwert ins Protokoll schreiben'], 'Ein nicht bestandenes Gerät darf nicht in Betrieb gehen. Erst nach Instandsetzung und erneuter, bestandener Prüfung wird es übergeben.', ['Darf ein unsicheres Gerät zum Kunden?', 'Kennzeichnen, beheben, neu prüfen.']]
  ];
  const PR_STEPS = ['Lies, welcher Prüfschritt gemeint ist.', 'Überlege, was dieser Schritt nachweisen soll.', 'Wähle die Antwort, die genau das sicherstellt.'];
  const Cp = {
    reihen(R) {
      const S = C().PRUEF_SCHRITTE, i = C().ri(R, 0, S.length - 2), right = S[i + 1], wrong = C().shuffle(R, S.filter((x, j) => j !== i + 1 && j !== i)).slice(0, 3);
      return choiceQ(R, 'Prüfung nach Instandsetzung am TW-1 (Schutzklasse I). Du hast gerade „' + S[i] + '“ erledigt. Was kommt als Nächstes?', right, wrong,
        'Reihenfolge: ' + S.join(', ') + '. Erst schauen, dann den Schutzleiter, dann die Isolation, dann Ableitströme, zum Schluss Funktion und Dokumentation.',
        ['Zuerst prüfst du ohne Netzspannung, erst am Ende mit Netzspannung.', 'Ist der Schutzleiter nicht in Ordnung, ist jede weitere Messung gefährlich.'],
        ['Liste der Prüfschritte im Kopf durchgehen.', 'Den erledigten Schritt suchen.', 'Den nächsten Schritt wählen.'], { img: { k: 'pruef', m: 'rpe', sk: 1 } });
    },
    rpegr(R) {
      const L = C().pick(R, [1.5, 3, 5, 8, 12, 15, 20]), v = C().rpeLimit(L);
      return numQ('Der TW-1 (Schutzklasse I) hat eine Netzleitung von ' + f(L, 1) + ' m. Welcher Schutzleiterwiderstand ist höchstens zulässig?', v, 'Ω', 'Grenzwert RPE', 0.001,
        'Bis 5 m gelten 0,3 Ω, für jede weiteren angefangenen 7,5 m kommen 0,1 Ω dazu, höchstens 1 Ω. ' + (L <= 5 ? f(L, 1) + ' m ≤ 5 m, also 0,3 Ω.' : f(L, 1) + ' m − 5 m = ' + f(L - 5, 1) + ' m, das sind ' + f(Math.ceil((L - 5) / 7.5 - 1e-9), 0) + ' angefangene Abschnitte zu 7,5 m: 0,3 Ω + ' + f(Math.ceil((L - 5) / 7.5 - 1e-9) * 0.1, 1) + ' Ω = ' + f(v, 1) + ' Ω.'),
        ['Grundwert 0,3 Ω bis 5 m Leitungslänge.', 'RPE = 0,3 Ω + (angefangene 7,5-m-Abschnitte über 5 m) · 0,1 Ω, höchstens 1 Ω'],
        ['Leitungslänge mit 5 m vergleichen.', 'Längen über 5 m in angefangene 7,5-m-Abschnitte teilen.', 'Je Abschnitt 0,1 Ω zu 0,3 Ω dazuzählen.'], { img: { k: 'pruef', m: 'rpe', sk: 1 } });
    },
    rpebew(R) {
      const L = C().pick(R, [2, 3, 5]), bad = R() < 0.5, lim = C().rpeLimit(L), v = bad ? C().rd(lim + C().pick(R, [0.04, 0.12]), 2) : C().rd(lim - C().pick(R, [0.08, 0.15]), 2);
      const right = bad ? 'Nicht in Ordnung, der Grenzwert von 0,3 Ω ist überschritten' : 'In Ordnung, der Grenzwert von 0,3 Ω ist eingehalten';
      return choiceQ(R, 'Netzleitung ' + f(L, 0) + ' m, Schutzklasse I. Du misst einen Schutzleiterwiderstand von ' + f(v, 2) + ' Ω. Wie bewertest du das?', right,
        [bad ? 'In Ordnung, der Grenzwert von 0,3 Ω ist eingehalten' : 'Nicht in Ordnung, der Grenzwert von 0,3 Ω ist überschritten', 'In Ordnung, bis 1 Ω ist immer erlaubt', 'Die Messung entfällt bei Schutzklasse I'],
        'Bis 5 m Leitung gilt 0,3 Ω. ' + f(v, 2) + ' Ω ist ' + (bad ? 'größer, das Gerät hat nicht bestanden.' : 'kleiner, der Schutzleiter ist in Ordnung.'),
        ['Grenzwert für die Leitungslänge bestimmen.', 'Messwert mit dem Grenzwert vergleichen: kleiner oder gleich ist in Ordnung.'],
        ['Grenzwert bestimmen.', 'Messwert vergleichen.', 'Urteil fällen.'], { img: { k: 'pruef', m: 'rpe', sk: 1 } });
    },
    risogr(R) {
      const sk = C().pick(R, [1, 2, 3]), v = C().risoLimit(sk);
      return numQ('Welcher Isolationswiderstand muss bei einem Gerät der Schutzklasse ' + ['I', 'II', 'III'][sk - 1] + ' mindestens erreicht werden?', v, 'MΩ', 'Mindestwert RISO', 0.001,
        'Grenzwerte für den Isolationswiderstand: Schutzklasse I 1 MΩ, Schutzklasse II 2 MΩ, Schutzklasse III 0,25 MΩ.',
        ['Schutzklasse II hat keinen Schutzleiter, deshalb muss die Isolation besser sein.', 'SK I: 1 MΩ, SK II: 2 MΩ, SK III: 0,25 MΩ.'],
        ['Schutzklasse erkennen.', 'Grenzwert aus der Tabelle wählen.', 'In MΩ angeben.'], { img: { k: 'pruef', m: 'riso', sk: sk === 2 ? 2 : 1 } });
    },
    isou(R) {
      return choiceQ(R, 'Mit welcher Prüfspannung misst du den Isolationswiderstand am TW-1 (Netzgerät 230 V, Schutzklasse I)?', '500 V Gleichspannung', ['230 V Wechselspannung', '50 V Gleichspannung', '1.000 V Wechselspannung'],
        'Bei Geräten für 230 V wird der Isolationswiderstand mit 500 V Gleichspannung gemessen (bei Schutzkleinspannung, Schutzklasse III, mit 250 V).',
        ['Gemessen wird mit Gleichspannung, deutlich über der Netzspannung.', 'Für Netzgeräte: 500 V DC.'],
        ['Schutzklasse und Nennspannung des Geräts feststellen.', 'Passende Prüfspannung wählen.', 'Am Prüfgerät einstellen.'], { img: { k: 'pruef', m: 'riso', sk: 1 } });
    },
    ipe(R) {
      const sk = C().pick(R, [1, 2]), right = sk === 1 ? 'Schutzleiterstrom, höchstens 3,5 mA' : 'Berührungsstrom, höchstens 0,5 mA';
      return choiceQ(R, 'Welcher Ableitstrom wird bei einem Gerät der Schutzklasse ' + (sk === 1 ? 'I' : 'II') + ' gemessen und welcher Grenzwert gilt?', right,
        [sk === 1 ? 'Berührungsstrom, höchstens 0,5 mA' : 'Schutzleiterstrom, höchstens 3,5 mA', 'Schutzleiterstrom, höchstens 30 mA', 'Berührungsstrom, höchstens 10 mA'],
        'Schutzklasse I: Strom über den Schutzleiter, Grenzwert 3,5 mA. Schutzklasse II: Strom über berührbare leitfähige Teile, Grenzwert 0,5 mA. (Für Sonderfälle wie Heizgeräte gelten andere Werte.)',
        ['Hat das Gerät einen Schutzleiter?', 'Ohne Schutzleiter fließt der Strom über berührbare Teile, deshalb ein kleinerer Grenzwert.'],
        ['Schutzklasse erkennen.', 'Passende Messart wählen.', 'Grenzwert zuordnen.'], { img: { k: 'pruef', m: 'ileak', sk } });
    },
    prq: pq(PRQ, PR_STEPS, { k: 'pruef', m: '', sk: 1 }),
    protbew(R) {
      let p, s = C().ri(R, 1, 1e6);
      for (let k = 0; k < 50; k++) { p = C().makePruef(s + k); if (p.rows.filter(r => !r.ok).length <= 1) break; }
      const bad = p.rows.find(r => !r.ok), none = 'Keine, das Gerät hat bestanden';
      const right = bad ? bad.n : none, wrong = p.rows.filter(r => r !== bad).map(r => r.n).concat(bad ? [none] : []).slice(0, 4);
      const wert = r => typeof r.wert === 'number' ? f(r.wert, 2) + ' ' + r.unit : r.wert;
      return choiceQ(R, 'Prüfprotokoll nach Instandsetzung: Schutzklasse ' + (p.sk === 1 ? 'I' : 'II') + (p.sk === 1 ? ', Netzleitung ' + f(p.L, 1) + ' m' : '') + '. Bestimme selbst die Grenzwerte. Welche Zeile ist nicht in Ordnung?', right, wrong,
        p.rows.map(r => r.n + ': ' + wert(r) + ' (Grenzwert ' + r.grenz + ') ' + (r.ok ? 'in Ordnung' : 'nicht in Ordnung')).join('. ') + '. ' + (bad ? 'Das Gerät hat nicht bestanden und darf so nicht übergeben werden.' : 'Alle Werte sind in Ordnung, das Gerät hat bestanden.'),
        ['Schreib zu jeder Zeile den Grenzwert dazu (Schutzleiter nach Länge, Isolation nach Schutzklasse, Ableitstrom nach Schutzklasse).', 'Widerstände müssen unter (Schutzleiter) bzw. über (Isolation) dem Grenzwert liegen, Ströme darunter.'],
        ['Schutzklasse und Leitungslänge ablesen.', 'Für jede Zeile den Grenzwert bestimmen.', 'Jeden Messwert vergleichen und das Gesamturteil bilden.'],
        { table: { head: ['Prüfschritt', 'Messwert bzw. Befund'], rows: p.rows.map(r => [r.n, wert(r)]) }, img: { k: 'pruef', m: '', sk: p.sk } });
    }
  };

  /* ============================================================ Bauteile dimensionieren */
  const DIMQ = [
    ['Warum wählst du beim Basiswiderstand RB den nächstkleineren Wert der E12-Reihe?', 'Damit der Basisstrom eher größer wird und V2 sicher durchschaltet', ['Damit der Transistor weniger warm wird', 'Damit das Relais langsamer anzieht', 'Weil größere Widerstände teurer sind'], 'Ein kleinerer RB gibt mehr Basisstrom. Der Übersteuerungsfaktor bleibt mindestens erhalten, V2 ist sicher gesättigt.', ['Was passiert mit IB, wenn RB kleiner wird?', 'Der Transistor soll sicher als Schalter arbeiten.']],
    ['Warum wählst du beim Vorwiderstand einer LED den nächstgrößeren Normwert?', 'Damit der Strom nicht über den gewünschten Wert steigt', ['Damit die LED heller wird', 'Damit die Spannung an der LED steigt', 'Weil die E12-Reihe nur große Werte hat'], 'Größerer Widerstand heißt kleinerer Strom. So bleibt die LED sicher unter ihrem Höchststrom.', ['Was soll auf keinen Fall zu groß werden?', 'I = UR / R.']],
    ['Wozu dient die Freilaufdiode V3 an der Relaisspule?', 'Nimmt die Abschaltspannung der Spule auf und schützt so den Transistor V2', ['Lässt das Relais schneller anziehen', 'Glättet die Betriebsspannung', 'Verhindert, dass das Relais kontaktprellt'], 'Beim Abschalten will die Spule den Strom weitertreiben und erzeugt eine hohe Spannungsspitze. Die Diode schließt diesen Strom kurz, V2 bleibt heil.', ['Was macht eine Spule, wenn ihr Strom plötzlich abgeschaltet wird?', 'Induktionsspannung beim Abschalten.']],
    ['Wie wird die Freilaufdiode eingebaut?', 'Parallel zur Spule, Kathode an Plus, im Betrieb in Sperrrichtung', ['In Reihe zur Spule, Anode an Plus', 'Parallel zur Spule, Anode an Plus', 'Zwischen Basis und Emitter von V2'], 'Im Betrieb sperrt die Diode. Erst beim Abschalten dreht sich die Spannung an der Spule um, dann leitet sie.', ['Im Normalbetrieb soll durch die Diode kein Strom fließen.', 'Kathode zeigt zu Plus.']],
    ['Welche Spannungsfestigkeit wählst du für C1, wenn die Spannung im Leerlauf bis 14 V steigen kann?', 'Mindestens 16 V, besser 25 V für mehr Reserve und Lebensdauer', ['10 V reichen, weil im Betrieb nur 11 V anliegen', '6,3 V, weil der Regler 5 V liefert', 'Egal, Elkos halten jede Spannung'], 'Die Nennspannung muss über der höchsten auftretenden Spannung liegen (Leerlauf, Netzüberspannung). Reserve verlängert die Lebensdauer.', ['Maßgebend ist die höchste Spannung, nicht die im Betrieb.', 'Normreihe: 6,3 V, 10 V, 16 V, 25 V, 35 V.']]
  ];
  const Dm = {
    ploss(R) {
      const Uin = C().pick(R, [9, 10, 11, 12, 13]), I = C().pick(R, [0.2, 0.25, 0.3, 0.4, 0.5]), v = C().rd(C().regLoss(Uin, 5, I), 2);
      return numQ('Der Regler U1 bekommt am Eingang im Mittel ' + f(Uin, 0) + ' V und liefert 5 V bei ' + f(I * 1000, 0) + ' mA. Welche Verlustleistung setzt er in Wärme um?', v, 'W', 'Verlustleistung', 0.01,
        'P = (UE − UA) · I = (' + f(Uin, 0) + ' V − 5 V) · ' + f(I, 2) + ' A = ' + f(v, 2) + ' W.',
        ['Die Spannungsdifferenz am Regler wird mit dem Laststrom in Wärme umgesetzt.', 'P = (UE − UA) · I = (' + f(Uin, 0) + ' V − 5 V) · ' + f(I, 2) + ' A'],
        ['Spannungsdifferenz zwischen Eingang und Ausgang bilden.', 'Strom in A umrechnen.', 'Malnehmen, Ergebnis in W.'], { img: { k: 'therm' } });
    },
    kk(R) {
      const P = C().pick(R, [1.5, 2, 2.4, 3]), tu = C().pick(R, [25, 40]), rjg = C().pick(R, [3, 5]), rgk = C().pick(R, [0.5, 1]), v = C().rd(C().rthK(125, tu, P, rjg, rgk), 2);
      return numQ('Der Regler setzt ' + f(P, 1) + ' W um. Die Sperrschicht darf höchstens 125 °C warm werden, im Gehäuse sind es ' + f(tu, 0) + ' °C. Rth,JG = ' + f(rjg, 1) + ' K/W, Wärmeleitfolie Rth,GK = ' + f(rgk, 1) + ' K/W. Welchen Wärmewiderstand darf der Kühlkörper höchstens haben?', v, 'K/W', 'Rth,K höchstens', 0.05,
        'Rth,gesamt = (125 °C − ' + f(tu, 0) + ' °C) / ' + f(P, 1) + ' W = ' + f((125 - tu) / P, 2) + ' K/W. Rth,K = ' + f((125 - tu) / P, 2) + ' K/W − ' + f(rjg, 1) + ' K/W − ' + f(rgk, 1) + ' K/W = ' + f(v, 2) + ' K/W. Du wählst einen Kühlkörper mit kleinerem Wert.',
        ['Die Wärmewiderstände liegen in Reihe wie Widerstände im Stromkreis. Die Temperaturdifferenz entspricht der Spannung, die Leistung dem Strom.', 'Rth,K = (ϑj − ϑu) / P − Rth,JG − Rth,GK = (125 °C − ' + f(tu, 0) + ' °C) / ' + f(P, 1) + ' W − ' + f(rjg, 1) + ' K/W − ' + f(rgk, 1) + ' K/W'],
        ['Zulässige Temperaturdifferenz bilden.', 'Durch die Leistung teilen: gesamter Wärmewiderstand.', 'Die bekannten Wärmewiderstände abziehen.'], { img: { k: 'therm' } });
    },
    cgl(R) {
      const I = C().pick(R, [0.2, 0.25, 0.3, 0.4]), dU = C().pick(R, [1, 1.5, 2]), v = C().rd(C().capFor(I, 100, dU) * 1e6, 0);
      return numQ('Hinter einem Brückengleichrichter (Netz 50 Hz) fließen ' + f(I * 1000, 0) + ' mA. Die Brummspannung soll höchstens ' + f(dU, 1) + ' Vss betragen. Welche Kapazität braucht der Ladeelko mindestens?', v, 'µF', 'Kapazität C', Math.max(2, v * 0.01),
        'Brücke: Brummfrequenz 100 Hz. C = I / (f · ΔU) = ' + f(I, 2) + ' A / (100 Hz · ' + f(dU, 1) + ' V) = ' + f(v, 0) + ' µF.',
        ['Bei der Brücke ist die Brummfrequenz doppelt so hoch wie die Netzfrequenz.', 'C = I / (f · ΔU) = ' + f(I, 2) + ' A / (100 Hz · ' + f(dU, 1) + ' V), dann · 1.000.000 für µF'],
        ['Brummfrequenz bestimmen (Brücke: 100 Hz).', 'Strom in A und Brummspannung in V einsetzen.', 'C ausrechnen und in µF umrechnen.'], { img: { k: 'ripple', up: 11, pp: dU, f: 100 } });
    },
    cnorm(R) {
      const c = C().pick(R, [1250, 1667, 2000, 2500, 3000, 4000]), v = C().eUp(c, C().E6);
      return numQ('Du hast für den Ladeelko ' + f(c, 0) + ' µF berechnet. Welchen Wert aus der E6-Reihe (1,0 1,5 2,2 3,3 4,7 6,8) baust du ein?', v, 'µF', 'Normwert', 0.5,
        'Der Elko muss mindestens so groß sein wie berechnet, sonst wird die Brummspannung zu groß. Nächstgrößerer E6-Wert über ' + f(c, 0) + ' µF: ' + f(v, 0) + ' µF.',
        ['Mindestens den berechneten Wert, also aufrunden.', 'E6-Werte in diesem Bereich: 1.000, 1.500, 2.200, 3.300, 4.700 µF'],
        ['Berechneten Wert notieren.', 'In der E6-Reihe den nächstgrößeren Wert suchen.', 'Diesen Wert in µF angeben.'], { img: { k: 'ripple', up: 11, pp: 1, f: 100 } });
    },
    rb(R) {
      const U = 12, Rs = C().pick(R, [240, 300, 400]), Bv = C().pick(R, [100, 150, 200]), ue = C().pick(R, [3, 5]);
      const Ic = C().coilI(U, Rs), Ib = C().baseI(Ic, Bv, ue), v = C().rd(C().rBase(5, 0.7, Ib) / 1000, 2);
      return numQ('Relaistreiber: Spule 12 V / ' + f(Rs, 0) + ' Ω, Transistor mit B = ' + f(Bv, 0) + ', Übersteuerungsfaktor ü = ' + f(ue, 0) + '. Der Mikrocontroller gibt 5 V aus, UBE = 0,7 V. Wie groß ist der Basiswiderstand RB?', v, 'kΩ', 'RB', Math.max(0.02, v * 0.01),
        'IC = 12 V / ' + f(Rs, 0) + ' Ω = ' + f(Ic * 1000, 1) + ' mA. IB = IC / B · ü = ' + f(Ic * 1000, 1) + ' mA / ' + f(Bv, 0) + ' · ' + f(ue, 0) + ' = ' + f(Ib * 1000, 2) + ' mA. RB = (5 V − 0,7 V) / ' + f(Ib * 1000, 2) + ' mA = ' + f(v, 2) + ' kΩ.',
        ['Erst den Kollektorstrom (Spulenstrom), dann den Basisstrom mit Übersteuerung, dann RB.', 'IC = 12 V / ' + f(Rs, 0) + ' Ω; IB = IC / ' + f(Bv, 0) + ' · ' + f(ue, 0) + '; RB = (5 V − 0,7 V) / IB'],
        ['Spulenstrom IC berechnen.', 'Basisstrom IB = IC / B · ü.', 'RB = (U_µC − UBE) / IB, Ergebnis in kΩ.'], { img: { k: 'drv' } });
    },
    rbnorm(R) {
      const r = C().pick(R, [2150, 3870, 5160, 7740, 9560, 12900]), v = C().eDown(r) / 1000;
      return numQ('Für den Basiswiderstand hast du ' + f(r / 1000, 2) + ' kΩ berechnet. Welchen Wert aus der E12-Reihe (1,0 1,2 1,5 1,8 2,2 2,7 3,3 3,9 4,7 5,6 6,8 8,2) baust du ein?', v, 'kΩ', 'Normwert RB', 0.005,
        'Beim Basiswiderstand nimmst du den nächstkleineren Wert, damit der Basisstrom nicht zu klein wird: ' + f(v, 1) + ' kΩ.',
        ['Kleinerer RB heißt größerer Basisstrom: V2 schaltet sicher durch.', 'Suche den E12-Wert direkt unter ' + f(r / 1000, 2) + ' kΩ.'],
        ['Berechneten Wert notieren.', 'Richtung festlegen (beim Basiswiderstand abrunden).', 'E12-Wert ablesen und in kΩ angeben.'], { img: { k: 'drv' } });
    },
    led(R) {
      const U = C().pick(R, [5, 12]), UF = C().pick(R, [1.8, 2, 2.1]), I = C().pick(R, [10, 15, 20]), v = C().rd(C().rLed(U, UF, I / 1000), 1);
      return numQ('Eine Kontroll-LED (UF = ' + f(UF, 1) + ' V, ' + f(I, 0) + ' mA) soll an ' + f(U, 0) + ' V leuchten. Wie groß muss der Vorwiderstand rechnerisch sein?', v, 'Ω', 'Vorwiderstand R', 0.6,
        'R = (U − UF) / I = (' + f(U, 0) + ' V − ' + f(UF, 1) + ' V) / ' + f(I / 1000, 3) + ' A = ' + f(v, 1) + ' Ω.',
        ['Am Widerstand liegt die Spannung, die die LED nicht braucht.', 'R = (U − UF) / I = (' + f(U, 0) + ' V − ' + f(UF, 1) + ' V) / ' + f(I / 1000, 3) + ' A'],
        ['Spannung am Widerstand berechnen (U − UF).', 'Strom in A umrechnen.', 'R = UR / I.'], { img: { k: 'led' } });
    },
    dimq: pq(DIMQ, ['Lies, welches Bauteil gemeint ist.', 'Überlege, was passiert, wenn der Wert zu groß oder zu klein ist.', 'Wähle die Antwort, die das Bauteil und die Schaltung schützt.'], { k: 'drv' }),
    umin(R) {
      const Ud = C().pick(R, [1.5, 2, 2.5]), dU = C().pick(R, [1, 1.5, 2]), v = C().rd(C().minUin(5, Ud, dU), 2);
      return numQ('Ein 5-V-Regler braucht ' + f(Ud, 1) + ' V Mindestabstand zwischen Eingang und Ausgang. Am Ladeelko liegt eine Brummspannung von ' + f(dU, 1) + ' Vss. Wie hoch muss der Scheitelwert an C1 mindestens sein, damit der Regler auch im Tal der Brummspannung noch regelt?', v, 'V', 'Scheitelwert an C1', 0.01,
        'Im Tal muss die Spannung noch 5 V + ' + f(Ud, 1) + ' V = ' + f(5 + Ud, 1) + ' V betragen. Der Scheitelwert liegt um die Brummspannung höher: ' + f(5 + Ud, 1) + ' V + ' + f(dU, 1) + ' V = ' + f(v, 1) + ' V.',
        ['Die tiefste Spannung (Tal) ist Scheitelwert minus Brummspannung.', 'Û = UA + UMin.Abstand + ΔU = 5 V + ' + f(Ud, 1) + ' V + ' + f(dU, 1) + ' V'],
        ['Mindest-Eingangsspannung des Reglers bilden.', 'Erkennen, dass das Tal der Brummspannung zählt.', 'Brummspannung dazuzählen.'], { img: { k: 'ripple', up: v, pp: dU, f: 100 } });
    }
  };

  /* ============================================================ Dokumentation und Übergabe */
  const MAT = [['Elko 2.200 µF / 25 V', 1.8], ['Festspannungsregler 5 V', 0.9], ['Wärmeleitfolie', 0.4], ['Feinsicherung träge', 0.35], ['Transistor NPN', 0.25], ['Diode für Freilauf', 0.1], ['Relais 12 V', 3.2]];
  function matList(R) {
    const it = C().shuffle(R, MAT).slice(0, 3).map(m => ({ n: m[0], preis: m[1], menge: C().pick(R, [1, 1, 2]) }));
    return it;
  }
  const matTxt = it => it.map(x => f(x.menge, 0) + ' · ' + x.n + ' zu ' + eu(x.preis)).join(', ');
  const DOKQ = [
    ['Was gehört in den Arbeitsbericht zur Reparatur?', 'Fehlerbild, Messwerte, Ursache, getauschte Teile, Arbeitszeit und Prüfergebnis', ['Nur der Rechnungsbetrag', 'Nur die getauschten Teile', 'Nur die Unterschrift des Kunden'], 'Der Bericht muss nachvollziehbar sein: Was war, was wurde gemessen, was getauscht, wie lange gearbeitet und ob das Gerät die Prüfung bestanden hat.', ['Jemand anderes soll die Reparatur später nachvollziehen können.', 'Von der Fehlermeldung bis zur Prüfung.']],
    ['Was ist ein Kostenvoranschlag?', 'Eine Aufstellung der voraussichtlichen Kosten vor der Reparatur, die der Kunde freigibt', ['Die Rechnung nach der Reparatur', 'Ein Prüfprotokoll', 'Eine Garantieerklärung'], 'Der Kostenvoranschlag zeigt dem Kunden vorher, was die Reparatur etwa kostet. Erst nach seiner Freigabe wird repariert.', ['Wann bekommt der Kunde ihn, vor oder nach der Reparatur?', 'Er dient der Entscheidung des Kunden.']],
    ['Was erklärst du dem Kunden bei der Übergabe?', 'Was defekt war, was getauscht wurde, dass die Prüfung bestanden ist und worauf er achten soll', ['Nur den Preis', 'Wie man das Gerät öffnet', 'Nichts, das steht ja auf der Rechnung'], 'Die Übergabe schließt den Auftrag ab. Der Kunde soll verstehen, was gemacht wurde, und Hinweise für den Betrieb bekommen (z. B. Lüftungsschlitze frei lassen).', ['Was will der Kunde wissen?', 'Fehler, Abhilfe, Sicherheit, Hinweise.']],
    ['Warum bewahrst du das Prüfprotokoll auf?', 'Es weist die elektrische Sicherheit nach, auch für spätere Prüfungen und bei Haftungsfragen', ['Damit die Rechnung höher wird', 'Weil es der Hersteller verlangt, sonst nie', 'Gar nicht, es reicht die Prüfplakette'], 'Das Protokoll belegt, was gemessen wurde. Bei späteren Prüfungen kannst du vergleichen, ob sich Werte verschlechtern.', ['Wer könnte später fragen, ob das Gerät sicher war?', 'Nachweis und Vergleich.']],
    ['Wo findest du die Sollwerte für die Messpunkte MP1 bis MP8?', 'In den Serviceunterlagen des Geräts (Schaltplan und Messprotokoll mit Sollwerten)', ['Auf dem Typenschild', 'In der Rechnung', 'Im Prüfprotokoll nach DIN VDE'], 'Sollwerte der Schaltung stehen in den Serviceunterlagen. Das Typenschild nennt nur Nennwerte (Spannung, Leistung, Schutzklasse).', ['Das Typenschild ist zu klein für Messpunkte.', 'Hersteller- bzw. Serviceunterlagen.']],
    ['Wozu dient die Prüfmarke, die du nach bestandener Prüfung aufklebst?', 'Zeigt, dass das Gerät geprüft ist und wann die nächste Prüfung fällig ist', ['Ersetzt das Prüfprotokoll', 'Zeigt den Reparaturpreis', 'Verlängert die Garantie'], 'Die Prüfmarke ist ein schneller Hinweis am Gerät. Der Nachweis selbst ist das Protokoll.', ['Was sieht jemand, der das Gerät in die Hand nimmt?', 'Datum der nächsten Prüfung.']]
  ];
  const Ed = {
    kvamat(R) {
      const it = matList(R), v = C().kva(it, 0).mat;
      return numQ('Für die Reparatur brauchst du: ' + matTxt(it) + '. Wie hoch sind die Materialkosten (netto)?', v, '€', 'Material netto', 0.005,
        it.map(x => f(x.menge, 0) + ' · ' + eu(x.preis)).join(' + ') + ' = ' + eu(v) + '.',
        ['Menge mal Einzelpreis für jede Zeile, dann alles zusammenzählen.', it.map(x => f(x.menge, 0) + ' · ' + eu(x.preis)).join(' + ')],
        ['Jede Position: Menge · Einzelpreis.', 'Alle Positionen addieren.', 'Auf Cent runden.'], { img: { k: 'kva' } });
    },
    kvalohn(R) {
      const m = C().pick(R, [45, 60, 75, 90, 105]), rate = C().pick(R, [60, 68, 72]), v = C().kva([], m, rate).lohn;
      return numQ('Die Fehlersuche, Reparatur und Prüfung dauern ' + f(m, 0) + ' Minuten. Der Stundensatz beträgt ' + f(rate, 0) + ' €/h (netto). Wie hoch sind die Arbeitskosten?', v, '€', 'Arbeitskosten netto', 0.01,
        f(m, 0) + ' min = ' + f(m / 60, 2) + ' h. ' + f(m / 60, 2) + ' h · ' + f(rate, 0) + ' €/h = ' + eu(v) + '.',
        ['Minuten erst in Stunden umrechnen (durch 60).', f(m, 0) + ' min / 60 · ' + f(rate, 0) + ' €/h'],
        ['Arbeitszeit in Stunden umrechnen.', 'Mit dem Stundensatz malnehmen.', 'Auf Cent runden.'], { img: { k: 'kva' } });
    },
    kvabrutto(R) {
      const it = matList(R), m = C().pick(R, [60, 75, 90]), k = C().kva(it, m, 68);
      return numQ('Kostenvoranschlag für den TW-1: Material ' + matTxt(it) + '. Arbeitszeit ' + f(m, 0) + ' Minuten zu 68 €/h. Alle Preise netto, dazu 19 % Mehrwertsteuer. Wie hoch ist der Bruttobetrag?', k.brutto, '€', 'Brutto', 0.02,
        'Material ' + eu(k.mat) + ' + Arbeit ' + f(m / 60, 2) + ' h · 68 €/h = ' + eu(k.lohn) + ' ergibt netto ' + eu(k.netto) + '. MwSt 19 % = ' + eu(k.mwst) + '. Brutto = ' + eu(k.brutto) + '.',
        ['Erst Material und Arbeit netto zusammenzählen, dann 19 % dazu.', 'Brutto = (Material + Minuten / 60 · 68 €/h) · 1,19'],
        ['Materialkosten berechnen.', 'Arbeitskosten berechnen und zum Material addieren (netto).', 'Netto · 1,19 = brutto, auf Cent runden.'], { img: { k: 'kva' } });
    },
    dokq: pq(DOKQ, ['Lies, für wen das Dokument gedacht ist (Kunde, Kollege, Prüfer).', 'Überlege, was diese Person wissen muss.', 'Wähle die Antwort, die vollständig und nachvollziehbar ist.'], { k: 'kva' })
  };

  const G = Object.assign({}, A, B, Cp, Dm, Ed);
  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument, Lehrjahr */
  const [K1, K2, K3, K4, K5] = CATS;
  const defs = [
    [K1, 1, 'Block in der Kette', 'blockzw', null, 3], [K1, 1, 'Spannungsart am Messpunkt', 'spart', null, 3], [K1, 1, 'Weg des Signals', 'sigweg', null, 3], [K1, 1, 'Aufgabe eines Blocks', 'bfkt', null, 3],
    [K1, 2, 'Scheitelwert hinter dem Trafo', 'scheitel', null, 3], [K1, 2, 'Spannung am Ladeelko', 'ucleer', null, 3], [K1, 1, 'Frequenz der Brummspannung', 'brummf', null, 3], [K1, 2, 'Spannung am Fühler', 'sensu', null, 3], [K1, 2, 'Strom aus dem Ladeelko', 'strom', null, 3],
    [K2, 2, 'Messungen bei der Halbierung', 'halb1', null, 3], [K2, 2, 'Nächster Messpunkt', 'halbn', null, 3], [K2, 1, 'Sicher messen', 'sicher', null, 3], [K2, 2, 'Richtig messen', 'mesq', null, 3],
    [K2, 2, 'Messprotokoll A', 'prot', ['sich', 'trafo'], 3], [K2, 3, 'Messprotokoll B', 'prot', ['fopen', 'fshort', 'rb'], 3], [K2, 3, 'Messprotokoll C', 'prot', ['elko', 'diode', 'regler'], 4], [K2, 3, 'Messprotokoll D', 'prot', ['tr', 'spule', 'rb'], 4],
    [K2, 2, 'Vom Fehlerbild zur Ursache', 'bild', null, 4], [K2, 3, 'Kapazität aus der Brummspannung', 'brumm', null, 4], [K2, 3, 'Strom durch die Spule', 'mp8', null, 4],
    [K3, 1, 'Reihenfolge der Prüfung', 'reihen', null, 3], [K3, 2, 'Grenzwert Schutzleiter', 'rpegr', null, 3], [K3, 2, 'Schutzleiter bewerten', 'rpebew', null, 3], [K3, 1, 'Grenzwert Isolation', 'risogr', null, 3], [K3, 1, 'Prüfspannung', 'isou', null, 3],
    [K3, 2, 'Ableitstrom', 'ipe', null, 3], [K3, 2, 'Prüfung: Zweck und Ablauf', 'prq', [0, 1, 2], 4], [K3, 2, 'Prüfung: Messen und Folgen', 'prq', [3, 4, 5], 4], [K3, 3, 'Prüfprotokoll bewerten', 'protbew', null, 4],
    [K4, 2, 'Verlustleistung am Regler', 'ploss', null, 4], [K4, 3, 'Kühlkörper auswählen', 'kk', null, 4], [K4, 3, 'Ladeelko berechnen', 'cgl', null, 4], [K4, 2, 'Elko nach Normreihe', 'cnorm', null, 4], [K4, 3, 'Basiswiderstand berechnen', 'rb', null, 4],
    [K4, 2, 'Basiswiderstand nach Normreihe', 'rbnorm', null, 4], [K4, 1, 'Vorwiderstand der LED', 'led', null, 4], [K4, 2, 'Bauteile richtig wählen', 'dimq', [0, 1], 4], [K4, 2, 'Freilauf und Spannungsfestigkeit', 'dimq', [2, 3, 4], 4], [K4, 2, 'Mindestspannung am Regler', 'umin', null, 4],
    [K5, 1, 'Materialkosten', 'kvamat', null, 3], [K5, 2, 'Arbeitskosten', 'kvalohn', null, 4], [K5, 3, 'Kostenvoranschlag brutto', 'kvabrutto', null, 4],
    [K5, 1, 'Bericht und Sollwerte', 'dokq', [0, 4], 3], [K5, 1, 'Kostenvoranschlag und Prüfmarke', 'dokq', [1, 5], 4], [K5, 2, 'Übergabe und Nachweis', 'dokq', [2, 3], 4]
  ];
  const tasks = defs.map((d, i) => ({ id: 'sya' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4], lj: d[5] }));
  function make(t, R) { const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('sya-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  root.SYA_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, protTable, pools: { SIQ, MESQ, BILDQ, PRQ, DIMQ, DOKQ } };
  root.SYA_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.SYA_DATA, TASKS: root.SYA_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
