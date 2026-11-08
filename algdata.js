'use strict';
/* Tonfunk Algorithmen-Lab: Daten (Aufgaben-Generatoren, Beispiele, Prüfung der Antworten).
   window.ALG_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, evalAnswer, modelAnswer, solText }
   window.ALG_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'alg', Status in localStorage 'lm4.alg.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Die Lösung kommt immer aus dem Interpreter (ALG_CORE.run); viele Aufgaben tragen zusätzlich eine unabhängig in JavaScript gerechnete Gegenprobe (q.cross), die der Test vergleicht.
   Antwortarten (q.ask.type): num, choice, out (Ausgabe tippen), line (Fehlerzeile markieren), order (Reihenfolge), table (Tabellentest), code (Zeile ergänzen, wird gegen Testfälle ausgeführt).
   Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder Ergebnis noch Fehlerart (die Fehlersuche heißt neutral "Fehlersuche A" bis "D"). */
(function (root) {
  const C = () => root.ALG_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Variablen und Verzweigung', 'Schleifen', 'Ablaufplan und Struktogramm', 'Schreibtischtest und Fehlersuche', 'Suchen und Sortieren', 'Rekursion und Aufwand', 'Zahlenalgorithmen'];

  /* ---------- Bausteine ---------- */
  const join = a => a.join('\n');
  function mustRun(src, o) { const r = C().run(src, o); if (r.error && !(o && o.allowErr)) throw new Error('ALG-Aufgabe: ' + r.error.msg + ' (Zeile ' + r.error.line + ')\n' + src); return r; }
  /* Schreibtischtest als Text: eine Zeile je Schritt */
  function traceText(src, inputs, maxRows) {
    maxRows = maxRows || 16; const r = C().run(src, { inputs, trace: true, traceMax: maxRows, maxSteps: 30000 });
    return (r.trace || []).map(t => 'Schritt ' + t.n + ' (Zeile ' + t.line + (t.cond === undefined ? '' : t.cond ? ', Bedingung wahr' : ', Bedingung falsch') + '): ' + (Object.keys(t.vars).map(k => k + ' = ' + C().fmt(t.vars[k])).join(', ') || 'noch keine Variable')).join('\n') + (r.steps > maxRows ? '\n…' : '');
  }
  const shows = (lines) => lines.join(' | ');
  function qNum(text, src, inputs, value, unit, label, tips, expl, cross, o) {
    return Object.assign({ text, prog: src, inputs: inputs || null, ask: { type: 'num', unit, label }, value, tol: 0, expl, tips, cross }, o);
  }
  function qOut(text, src, inputs, tips, cross, o, expl) {
    const r = mustRun(src, { inputs });
    return Object.assign({ text, prog: src, inputs: inputs || null, ask: { type: 'out', label: 'Ausgabe', expected: r.out }, value: r.out.join(' '), tol: 0, expl: expl || ('Schreibtischtest:\n' + traceText(src, inputs) + '\nAusgabe: ' + shows(r.out)), tips, cross }, o);
  }
  function qChoice(R, text, right, wrong, expl, tips, o) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return Object.assign({ text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips }, o);
  }
  const distinct = (R, n, lo, hi) => { const s = new Set(); while (s.size < n) s.add(C().ri(R, lo, hi)); return Array.from(s); };
  const arrTxt = a => '[' + a.join(', ') + ']';
  const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

  const G = {};

  /* ---------- 1. Variablen und Verzweigung ---------- */
  G.vars1 = R => {
    const c = C(), v = c.ri(R, 0, 1), A = c.ri(R, 3, 9), B = c.ri(R, 2, 8);
    const head = ['Setze a auf ' + A, 'Setze b auf ' + B, 'Setze a auf a + b'];
    const src = join(head.concat(v === 0 ? ['Setze b auf a - b', 'Setze a auf a - b'] : ['Setze b auf a * 2'], ['Ausgabe a, b']));
    const cross = v === 0 ? [B, A] : [A + B, (A + B) * 2];
    return qOut('Was gibt das Programm aus? Schreibe die beiden Werte hintereinander (zum Beispiel 4 7).', src, null, ['Gehe Zeile für Zeile durch und notiere nach jeder Zeile die Werte von a und b.', 'Bei „Setze a auf a + b“ wird zuerst die rechte Seite mit dem alten Wert von a berechnet, dann erst gespeichert.'], cross.map(String));
  };
  G.vars2 = R => {
    const c = C(), op = c.pick(R, ['>=', '>']), T = c.pick(R, [9, 10, 19, 20, 29, 30, 31, 5, 20, 10]);
    const src = join(['Setze t auf ' + T, 'Wenn t ' + op + ' 30 dann', '  Ausgabe "heiß"', 'Sonst Wenn t ' + op + ' 20 dann', '  Ausgabe "warm"', 'Sonst Wenn t ' + op + ' 10 dann', '  Ausgabe "kühl"', 'Sonst', '  Ausgabe "kalt"', 'Ende Wenn']);
    const r = mustRun(src), cross = (op === '>=' ? (T >= 30 ? 'heiß' : T >= 20 ? 'warm' : T >= 10 ? 'kühl' : 'kalt') : (T > 30 ? 'heiß' : T > 20 ? 'warm' : T > 10 ? 'kühl' : 'kalt'));
    const all = ['heiß', 'warm', 'kühl', 'kalt'], q = qChoice(R, 'Was gibt das Programm aus?', r.out[0], all.filter(x => x !== r.out[0]), 'Die Bedingungen werden von oben nach unten geprüft; der erste Zweig mit wahrer Bedingung wird ausgeführt, alle übrigen werden übersprungen.\n' + traceText(src), ['Prüfe die Bedingungen von oben nach unten. Sobald eine wahr ist, geht es nach „Ende Wenn“ weiter.', 'Achte auf das Zeichen: bei > zählt der Grenzwert selbst nicht, bei >= schon.'], { prog: src });
    q.cross = cross; q.crossIsOut = true; return q;
  };
  G.vars3 = R => {
    const c = C(), A = c.ri(R, 1, 6), B = c.ri(R, 2, 5), N = c.ri(R, 5, 11), name = c.pick(R, ['a', 'b']);
    const src = join(['Setze a auf ' + A, 'Setze b auf ' + B, 'Für i von 1 bis 4', '  Setze a auf a + b', '  Setze b auf b * 2', 'Ende Für']);
    const st = { a: undefined, b: undefined }, seq = [() => { st.a = A; }, () => { st.b = B; }];
    for (let k = 1; k <= 4; k++) { seq.push(() => { st.i = k; }, () => { st.a += st.b; }, () => { st.b *= 2; }); } seq.push(() => { st.i = 5; });
    for (let k = 0; k < N; k++) seq[k]();
    const v = C().valueAfter(src, N, name);
    return qNum('Ein Schritt ist eine ausgeführte Anweisung oder ein ausgewerteter Schleifenkopf (jeder Durchgang durch „Für“, auch der letzte). Welchen Wert hat ' + name + ' nach ' + N + ' Schritten? (Hilfe: Reiter „Hilfe“, Abschnitt Schritte)', src, null, v, '', 'Wert von ' + name,
      ['Zähle mit: Schritt 1 und 2 sind die beiden Zeilen „Setze“, Schritt 3 ist der erste Durchgang durch „Für“ (i = 1).', 'Pro Schleifendurchlauf zählen drei Schritte: Kopf, dann a, dann b.'],
      'Schreibtischtest bis Schritt ' + N + ':\n' + traceText(src, null, N), st[name]);
  };
  G.vars4 = R => {
    const c = C(), cases = [[c.ri(R, 1, 9), c.ri(R, 10, 20)], [c.ri(R, 21, 40), c.ri(R, 1, 9)], [c.ri(R, 41, 60), c.ri(R, 41, 60)]];
    const before = ['Eingabe a', 'Eingabe b'], after = ['Ausgabe a, b'], model = 'Setze h auf a\nSetze a auf b\nSetze b auf h';
    return {
      text: 'Das Programm liest zwei Werte und soll sie vertauscht ausgeben (erst b, dann a). Schreibe die fehlenden Zeilen für die Lücke. Du darfst eine Hilfsvariable benutzen.',
      prog: join(before.concat(['  ... (hier fehlt etwas) ...'], after)), ask: { type: 'code', before, after, model, cases: cases.map(k => ({ inputs: k.slice(), expect: [k[1] + ' ' + k[0]] })) }, value: model, tol: 0,
      expl: 'Eine Hilfsvariable merkt sich einen Wert, bevor er überschrieben wird:\n' + model + '\nOhne die Hilfsvariable h wären nach „Setze a auf b“ beide Werte gleich.', tips: ['Wenn du zuerst a mit b überschreibst, ist der alte Wert von a verloren. Wo kannst du ihn vorher aufbewahren?', 'Drei Zeilen reichen: Wert von a in h merken, a bekommt b, b bekommt h.']
    };
  };
  G.vars5 = R => {
    const c = C(), p = c.pick(R, [49, 50, 74, 75, 89, 90, 100, 20, 51, 76]);
    const src = join(['Eingabe p', 'Wenn p >= 50 dann', '  Wenn p >= 90 dann', '    Ausgabe "sehr gut"', '  Sonst Wenn p >= 75 dann', '    Ausgabe "gut"', '  Sonst', '    Ausgabe "ausreichend"', '  Ende Wenn', 'Sonst', '  Ausgabe "nicht bestanden"', 'Ende Wenn']);
    /* PRUEFEN P12: Notenschlüssel als Übungswerte: ab 50 Punkten bestanden, ab 75 „gut“, ab 90 „sehr gut“. Gibt es im Betrieb einen anderen üblichen Schlüssel, der hier stehen soll? */
    return qOut('Das Programm bekommt die Eingabe ' + p + '. Was gibt es aus?', src, [p], ['Die innere Verzweigung wird nur erreicht, wenn die äußere Bedingung wahr ist.', 'Prüfe zuerst p >= 50. Wenn ja, geht es nach innen; wenn nein, ist der äußere „Sonst“-Zweig dran.'], [p >= 50 ? (p >= 90 ? 'sehr gut' : p >= 75 ? 'gut' : 'ausreichend') : 'nicht bestanden'].join(' ').split(' '));
  };

  /* ---------- 2. Schleifen ---------- */
  G.loop1 = R => {
    const c = C(), A = c.ri(R, 1, 3), B = c.ri(R, 5, 9), ex = c.pick(R, ['s + i', 's + i * i']);
    const src = join(['Setze s auf 0', 'Für i von ' + A + ' bis ' + B, '  Setze s auf ' + ex, 'Ende Für', 'Ausgabe s']);
    let s = 0; for (let i = A; i <= B; i++) s = ex === 's + i' ? s + i : s + i * i;
    const r = mustRun(src);
    return qNum('Welche Zahl gibt das Programm aus?', src, null, +r.out[0], '', 'Ausgabe', ['Die Schleife läuft für jedes i von ' + A + ' bis ' + B + ', jeweils einschließlich beider Grenzen.', 'Addiere der Reihe nach mit und halte die Zwischensumme s fest.'], 'Schreibtischtest:\n' + traceText(src, null, 24) + '\nAusgabe: ' + r.out[0], s);
  };
  G.loop2 = R => {
    const c = C(), v = c.pick(R, [[1, 10, 3], [2, 20, 4], [10, 1, -3], [5, 25, 5], [10, 1, -2], [3, 3, 1], [4, 2, 1], [0, 9, 3]]);
    const src = join(['Für i von ' + v[0] + ' bis ' + v[1] + ' Schritt ' + v[2], '  Ausgabe i', 'Ende Für']);
    const cross = (v[2] > 0 ? v[1] >= v[0] : v[1] <= v[0]) ? Math.floor(Math.abs(v[1] - v[0]) / Math.abs(v[2])) + 1 : 0;
    const r = mustRun(src);
    return qNum('Wie oft wird die Ausgabe ausgeführt (Zeile 2)? Gib 0 an, wenn die Schleife gar nicht läuft.', src, null, r.lineCounts[2] || 0, 'mal', 'Anzahl', ['Schreibe die Werte von i nacheinander auf: Anfangswert, dann immer um die Schrittweite weiter, bis die Grenze überschritten wäre.', 'Läuft die Schleife nach unten, muss die Schrittweite negativ sein und der Endwert kleiner als der Anfangswert.'], 'Ausgegeben wird: ' + (r.out.join(', ') || 'nichts') + '. Das sind ' + (r.lineCounts[2] || 0) + ' Durchläufe.', cross);
  };
  G.loop3 = R => {
    const c = C(), X = c.ri(R, 12, 200), op = c.pick(R, ['>=', '>']), K = op === '>=' ? 1 : 2;
    const src = join(['Setze x auf ' + X, 'Setze z auf 0', 'Solange x ' + op + ' ' + K, '  Setze x auf x div 2', '  Setze z auf z + 1', 'Ende Solange', 'Ausgabe z']);
    let x = X, z = 0; while (op === '>=' ? x >= K : x > K) { x = Math.floor(x / 2); z++; }
    const r = mustRun(src);
    return qNum('Welche Zahl gibt das Programm aus? („div“ ist die ganzzahlige Division ohne Rest.)', src, null, +r.out[0], '', 'Ausgabe', ['Halbiere x immer wieder (ganzzahlig, Rest wird abgeschnitten) und zähle mit z, bis die Bedingung nicht mehr stimmt.', 'Schreibe x und z nach jedem Durchlauf in eine kleine Tabelle.'], 'Schreibtischtest:\n' + traceText(src, null, 30) + '\nAusgabe: ' + r.out[0], z);
  };
  G.loop4 = R => {
    const c = C(), foot = c.ri(R, 0, 1) === 1, L = c.ri(R, 4, 8), N = c.ri(R, 0, 1) ? L + c.ri(R, 0, 3) : L - c.ri(R, 1, 3);
    const src = foot ? join(['Setze n auf ' + N, 'Wiederhole', '  Ausgabe n', '  Setze n auf n + 1', 'Bis n >= ' + L]) : join(['Setze n auf ' + N, 'Solange n < ' + L, '  Ausgabe n', '  Setze n auf n + 1', 'Ende Solange']);
    const cross = foot ? (N >= L ? 1 : L - N) : (N >= L ? 0 : L - N), r = mustRun(src), cnt = r.lineCounts[3] || 0;
    return qNum('Wie oft wird die Ausgabe (Zeile 3) ausgeführt?', src, null, cnt, 'mal', 'Anzahl', [foot ? 'Bei „Wiederhole … Bis“ wird der Körper zuerst ausgeführt, die Bedingung steht erst am Ende.' : 'Bei „Solange“ wird die Bedingung vor dem Körper geprüft. Ist sie gleich am Anfang falsch, läuft der Körper nie.', 'Setze den Startwert von n in die Bedingung ein und prüfe, wann sie die Schleife beendet.'],
      (foot ? 'Fußgesteuert: Der Körper läuft mindestens einmal. ' : 'Kopfgesteuert: Der Körper läuft eventuell gar nicht. ') + 'Ausgegeben wird: ' + (r.out.join(', ') || 'nichts') + '.', cross);
  };
  G.loop5 = R => {
    const c = C(), A = c.ri(R, 3, 5), B = c.ri(R, 3, 6), cond = c.pick(R, ['(i + j) mod 2 = 0', 'i < j', 'i = j', 'i * j > 6']);
    const src = join(['Setze z auf 0', 'Für i von 1 bis ' + A, '  Für j von 1 bis ' + B, '    Wenn ' + cond + ' dann', '      Setze z auf z + 1', '    Ende Wenn', '  Ende Für', 'Ende Für', 'Ausgabe z']);
    let z = 0; for (let i = 1; i <= A; i++) for (let j = 1; j <= B; j++) { if (cond === '(i + j) mod 2 = 0' ? (i + j) % 2 === 0 : cond === 'i < j' ? i < j : cond === 'i = j' ? i === j : i * j > 6) z++; }
    const r = mustRun(src);
    return qNum('Welche Zahl gibt das Programm aus?', src, null, +r.out[0], '', 'Ausgabe', ['Die innere Schleife läuft für jedes i komplett durch. Gehe also i = 1, 2, ... nacheinander an und zähle für jedes i alle j.', 'Mache eine Tabelle mit i, j und der Frage „Bedingung wahr?“.'], 'Insgesamt gibt es ' + (A * B) + ' Paare (i, j); gezählt werden die Paare, bei denen die Bedingung wahr ist: ' + r.out[0] + '.', z);
  };

  /* ---------- 3. Ablaufplan und Struktogramm ---------- */
  G.pap1 = R => {
    const c = C(), X = c.ri(R, 2, 20), Y = c.ri(R, 2, 20) + (c.ri(R, 0, 1) ? 0 : 1), v = c.ri(R, 0, 2);
    const X2 = X === Y ? Y + 1 : X;
    const mid = v === 0 ? ['Wenn x > y dann', '  Setze m auf x', 'Sonst', '  Setze m auf y', 'Ende Wenn', 'Ausgabe m'] : v === 1 ? ['Wenn x < y dann', '  Setze m auf x', 'Sonst', '  Setze m auf y', 'Ende Wenn', 'Ausgabe m'] : ['Wenn x > y dann', '  Setze d auf x - y', 'Sonst', '  Setze d auf y - x', 'Ende Wenn', 'Ausgabe d'];
    const src = join(['Setze x auf ' + X2, 'Setze y auf ' + Y].concat(mid));
    const cross = v === 0 ? Math.max(X2, Y) : v === 1 ? Math.min(X2, Y) : Math.abs(X2 - Y), r = mustRun(src);
    return qNum('Der Ablaufplan unten ist ein Programm. Welche Zahl wird ausgegeben? Folge den Pfeilen von „Start“ bis „Ende“.', null, null, +r.out[0], '', 'Ausgabe', ['Wenn du an einer Raute ankommst, prüfe die Bedingung: Ist sie wahr, folge dem Pfeil „Ja“, sonst dem Pfeil „Nein“.', 'Die Rechtecke sind Zuweisungen (:=), die Parallelogramme Ein- und Ausgaben.'], 'Der Programmtext zum Plan:\n' + src + '\nAusgabe: ' + r.out[0], cross, { fig: { kind: 'pap', src } });
  };
  G.nsd1 = R => {
    const c = C(), N = c.ri(R, 100, 999), src = join(['Setze n auf ' + N, 'Setze q auf 0', 'Solange n > 0', '  Setze q auf q + n mod 10', '  Setze n auf n div 10', 'Ende Solange', 'Ausgabe q']);
    const cross = String(N).split('').reduce((a, d) => a + +d, 0), r = mustRun(src);
    return qNum('Das Struktogramm unten ist ein Programm. Welche Zahl wird ausgegeben? („mod“ ist der Rest der Division, „div“ die ganzzahlige Division.)', null, null, +r.out[0], '', 'Ausgabe', ['Die Schleife wiederholt sich, solange n größer als 0 ist. Notiere n und q nach jedem Durchlauf.', 'n mod 10 ist die letzte Ziffer von n, n div 10 schneidet sie ab.'], 'Der Programmtext zum Struktogramm:\n' + src + '\nDie Ziffern von ' + N + ' werden addiert: ' + r.out[0], cross, { fig: { kind: 'nsd', src } });
  };
  /* Ergänzungs-Pools: blank = Zeilennummer (ab 1) der verdeckten Stelle; right/wrong in der Schreibweise der Zeichnung */
  const PAPFILL = [
    { goal: 'Der Ablaufplan gibt alle geraden Zahlen von 1 bis 10 aus.', src: join(['Für i von 1 bis 10', '  Wenn i mod 2 = 0 dann', '    Ausgabe i', '  Ende Wenn', 'Ende Für']), blank: 2, right: 'i mod 2 = 0', wrong: ['i mod 2 = 1', 'i div 2 = 0', 'i = 2'] },
    { goal: 'Der Ablaufplan addiert die Zahlen von 1 bis 5 und gibt die Summe aus.', src: join(['Setze s auf 0', 'Setze i auf 1', 'Solange i <= 5', '  Setze s auf s + i', '  Setze i auf i + 1', 'Ende Solange', 'Ausgabe s']), blank: 3, right: 'i <= 5', wrong: ['i < 5', 'i >= 5', 'i = 5'] },
    { goal: 'Der Ablaufplan verdoppelt die Eingabe, begrenzt das Ergebnis aber auf höchstens 100.', src: join(['Eingabe x', 'Setze y auf x * 2', 'Wenn y > 100 dann', '  Setze y auf 100', 'Ende Wenn', 'Ausgabe y']), blank: 4, right: 'y := 100', wrong: ['y := x', 'y := 0', 'y := y + 100'] },
    { goal: 'Der Ablaufplan zählt von 10 abwärts bis 1 und gibt jede Zahl aus.', src: join(['Setze n auf 10', 'Wiederhole', '  Ausgabe n', '  Setze n auf n - 1', 'Bis n < 1']), blank: 4, right: 'n := n - 1', wrong: ['n := n + 1', 'n := 1', 'n := n * 2'] }
  ];
  const NSDFILL = [
    { goal: 'Das Struktogramm berechnet die Fakultät n! = 1 · 2 · … · n (für n ≥ 1) und gibt sie aus.', src: join(['Eingabe n', 'Setze f auf 1', 'Für i von 2 bis n', '  Setze f auf f * i', 'Ende Für', 'Ausgabe f']), blank: 3, right: 'Für i von 2 bis n', wrong: ['Für i von 1 bis n - 1', 'Für i von 0 bis n', 'Für i von 2 bis n - 1'] },
    { goal: 'Das Struktogramm berechnet den Mittelwert zweier Eingaben und gibt ihn aus.', src: join(['Eingabe a', 'Eingabe b', 'Setze m auf (a + b) / 2', 'Ausgabe m']), blank: 3, right: 'm := (a + b) / 2', wrong: ['m := a + b / 2', 'm := a + b', 'm := (a - b) / 2'] },
    { goal: 'Das Struktogramm gibt den Betrag der Eingabe aus (aus −5 wird 5, aus 5 bleibt 5).', src: join(['Eingabe x', 'Wenn x < 0 dann', '  Setze x auf 0 - x', 'Ende Wenn', 'Ausgabe x']), blank: 3, right: 'x := 0 - x', wrong: ['x := x', 'x := x + 1', 'x := 0'] },
    { goal: 'Das Struktogramm gibt die Zahlen von 3 bis 30 in Dreierschritten aus.', src: join(['Für k von 3 bis 30 Schritt 3', '  Ausgabe k', 'Ende Für']), blank: 1, right: 'Für k von 3 bis 30 Schritt 3', wrong: ['Für k von 3 bis 30 Schritt 1', 'Für k von 0 bis 30 Schritt 3', 'Für k von 3 bis 10 Schritt 3'] }
  ];
  const fillGen = (POOL, kind) => R => {
    const p = C().pick(R, POOL), P = C().parse(p.src);
    return qChoice(R, p.goal + ' An der markierten Stelle fehlt der Inhalt („?“). Was gehört dorthin?', p.right, p.wrong, 'Zum Ziel passt: ' + p.right + '. Der vollständige Programmtext:\n' + p.src, ['Lies, was das Programm erreichen soll, und überlege, was an der markierten Stelle dazu passen muss.', 'Setze jede Antwort probehalber ein und rechne ein kleines Beispiel durch.'], { fig: { kind, src: p.src, blank: [p.blank] }, reveal: { kind, src: p.src }, meta: { src: p.src, blank: p.blank, right: p.right, wrong: p.wrong, ok: P.ok } });
  };
  G.pap2 = fillGen(PAPFILL, 'pap');
  G.nsd2 = fillGen(NSDFILL, 'nsd');
  const ORDER = [
    ['Rechteckfläche', ['Eingabe laenge', 'Eingabe breite', 'Setze flaeche auf laenge * breite', 'Ausgabe flaeche']],
    ['Mittelwert aus drei Zahlen', ['Eingabe a', 'Eingabe b', 'Eingabe c', 'Setze s auf a + b + c', 'Setze m auf s / 3', 'Ausgabe m']],
    ['Preis mit Rabatt', ['Eingabe preis', 'Setze rabatt auf preis * 0.1', 'Setze neu auf preis - rabatt', 'Ausgabe neu']],
    ['Temperatur von Celsius in Fahrenheit', ['Eingabe c', 'Setze f auf c * 9 / 5 + 32', 'Ausgabe f']]
  ];
  G.pap3 = R => {
    const c = C(), o = c.pick(R, ORDER), src = join(o[1]), texts = ['Start'].concat(c.topTexts(src), ['Ende']);
    let sh; let tries = 0; do { sh = c.shuffle(R, texts); tries++; } while (sh.join('|') === texts.join('|') && tries < 20);
    return { text: 'Die Blöcke des Ablaufplans „' + o[0] + '“ sind durcheinander geraten. Tippe sie in der richtigen Reihenfolge an, von „Start“ bis „Ende“.', ask: { type: 'order', items: sh, correct: texts }, value: texts.join(' → '), tol: 0, expl: 'Richtige Reihenfolge: ' + texts.join(' → ') + '. Erst werden die Werte eingelesen, dann wird gerechnet, zuletzt wird ausgegeben.', tips: ['Ein Ablaufplan beginnt immer mit „Start“ und endet mit „Ende“. Was muss passieren, bevor gerechnet werden kann?', 'Ein Wert kann erst benutzt werden, wenn er eingelesen oder berechnet wurde.'], reveal: { kind: 'pap', src } };
  };

  /* ---------- 4. Schreibtischtest und Fehlersuche ---------- */
  function tableQ(R, text, src, inputs, line, cols, fixed, tips, expl, cross, o) {
    const rowsFull = []; const r = C().run(src, { inputs, trace: true, maxSteps: 30000 });
    r.trace.forEach(t => { if (t.line === line) rowsFull.push(cols.map(k => t.vars[k])); });
    const hid = rowsFull.map(() => cols.map(() => false)); let cnt = 0;
    rowsFull.forEach((row, ri) => row.forEach((v, ci) => { if (ci >= fixed && R() < 0.5) { hid[ri][ci] = true; cnt++; } }));
    for (let ri = 0; cnt < 3 && ri < rowsFull.length; ri++) { const ci = cols.length - 1; if (!hid[ri][ci]) { hid[ri][ci] = true; cnt++; } }
    const rows = rowsFull.map((row, ri) => row.map((v, ci) => (hid[ri][ci] ? null : v)));
    return Object.assign({ text, prog: src, inputs: inputs || null, ask: { type: 'table', cols, rows, full: rowsFull }, value: rowsFull.length, tol: 0, expl, tips, cross }, o);
  }
  /* PRUEFEN P13: Beim Tabellentest werden die Variablen nach jedem Schleifendurchlauf (nach dem letzten Befehl im Körper) eingetragen, nicht nach jeder einzelnen Zeile. Verlangt ihr die zeilenweise Form oder die Form je Durchlauf? */
  G.tab1 = R => {
    const c = C(), N = c.ri(R, 4, 5), src = join(['Setze s auf 0', 'Setze p auf 1', 'Für i von 1 bis ' + N, '  Setze s auf s + i', '  Setze p auf p * 2', 'Ende Für']);
    const cross = []; let s = 0, p = 1; for (let i = 1; i <= N; i++) { s += i; p *= 2; cross.push([i, s, p]); }
    const q = tableQ(R, 'Vervollständige den Tabellentest. Die Tabelle zeigt die Variablen jeweils nach dem letzten Befehl im Körper der Schleife (Zeile 5), einmal je Durchlauf. Trage die fehlenden Werte ein.', src, null, 5, ['i', 's', 'p'], 1, ['Beginne mit s = 0 und p = 1. In jedem Durchlauf kommt i zu s dazu, und p wird verdoppelt.', 'Fülle die Tabelle von oben nach unten aus. Jede Zeile baut auf der Zeile darüber auf.'], 'Zeile für Zeile:\n' + cross.map(r => 'i = ' + r[0] + ': s = ' + r[1] + ', p = ' + r[2]).join('\n'), cross);
    return q;
  };
  G.tab2 = R => {
    const c = C(), N = c.pick(R, [3, 5, 6, 10, 12]);
    const src = join(['Setze n auf ' + N, 'Setze z auf 0', 'Solange n <> 1', '  Wenn n mod 2 = 0 dann', '    Setze n auf n div 2', '  Sonst', '    Setze n auf 3 * n + 1', '  Ende Wenn', '  Setze z auf z + 1', 'Ende Solange', 'Ausgabe z']);
    const cross = []; let n = N, z = 0; while (n !== 1) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; z++; cross.push([n, z]); }
    return tableQ(R, 'Vervollständige den Tabellentest. Die Tabelle zeigt n und z jeweils nach dem letzten Befehl im Körper der Schleife (Zeile 9), einmal je Durchlauf. Trage die fehlenden Werte ein.', src, null, 9, ['n', 'z'], 0, ['Ist n gerade, wird es halbiert, sonst gilt n := 3 · n + 1. Danach wird z um 1 größer.', 'Die Schleife endet, sobald n gleich 1 ist. Das ist die letzte Zeile der Tabelle.'], 'Zeile für Zeile:\n' + cross.map((r, k) => 'Durchlauf ' + (k + 1) + ': n = ' + r[0] + ', z = ' + r[1]).join('\n'), cross);
  };
  function lineQ(text, src, bug, expl, tips, o) {
    const lines = src.split('\n');
    return Object.assign({ text, prog: src, ask: { type: 'line', lines, correct: [bug] }, value: bug, tol: 0, expl, tips }, o);
  }
  const obs = r => (r.error ? 'eine Fehlermeldung: „' + r.error.msg + '“ (Zeile ' + r.error.line + ')' : r.finished ? 'die Ausgabe ' + (r.out.length ? r.out.join(' | ') : '(nichts)') : 'nichts Brauchbares');
  G.err1 = R => {
    const c = C(), v = c.ri(R, 0, 2); let bad, fix, goal, bug, intended;
    if (v === 0) {
      const N = c.ri(R, 4, 8);
      bad = join(['Setze n auf ' + N, 'Setze s auf 0', 'Für i von 1 bis n - 1', '  Setze s auf s + i', 'Ende Für', 'Ausgabe s']); fix = bad.replace('bis n - 1', 'bis n'); bug = 2; goal = 'Das Programm soll die Summe aller Zahlen von 1 bis ' + N + ' ausgeben.'; intended = [String(N * (N + 1) / 2)];
    } else if (v === 1) {
      const a = distinct(R, 4, 3, 30);
      bad = join(['Setze a auf ' + arrTxt(a), 'Setze s auf 0', 'Für i von 0 bis Länge(a)', '  Setze s auf s + a[i]', 'Ende Für', 'Ausgabe s']); fix = bad.replace('Länge(a)', 'Länge(a) - 1'); bug = 2; goal = 'Das Programm soll die Summe aller Werte des Felds a ausgeben (a hat vier Elemente, gezählt ab Index 0).'; intended = [String(a.reduce((x, y) => x + y, 0))];
    } else {
      const N = c.ri(R, 4, 7);
      bad = join(['Setze n auf ' + N, 'Setze i auf 1', 'Solange i < n', '  Ausgabe i', '  Setze i auf i + 1', 'Ende Solange']); fix = bad.replace('i < n', 'i <= n'); bug = 2; goal = 'Das Programm soll alle Zahlen von 1 bis ' + N + ' ausgeben.'; intended = range(1, N).map(String);
    }
    const r = mustRun(bad, { allowErr: true });
    return lineQ(goal + ' Das Programm liefert aber ' + obs(r) + '. Welche Zeile enthält den Fehler? Tippe sie an.', bad, bug, 'Die Zeile ' + (bug + 1) + ' ist falsch: Die Grenze der Schleife ist um eins verschoben. Richtig: ' + fix.split('\n')[bug].trim() + '. Prüfe an Grenzfällen: Welcher Wert ist der erste, welcher der letzte?', ['Prüfe die Grenzen: Läuft die Schleife genau über die gewünschten Werte, nicht einen mehr und nicht einen weniger?', 'Die Zahl der Durchläufe ist hier um eins falsch. Welche Zeile legt sie fest?'], { meta: { bad, fix, intended, kind: 'off' } });
  };
  G.err2 = R => {
    const c = C(), v = c.ri(R, 0, 2); let bad, fix, goal, bug, why;
    if (v === 0) { const s = c.ri(R, 5, 12); bad = join(['Setze i auf ' + s, 'Solange i > 0', '  Ausgabe i', '  Setze i auf i + 1', 'Ende Solange']); fix = bad.replace('i + 1', 'i - 1'); bug = 3; goal = 'Das Programm soll von ' + s + ' bis 1 herunterzählen und jede Zahl ausgeben.'; why = 'i wird größer statt kleiner, die Bedingung i > 0 bleibt immer wahr.'; }
    else if (v === 1) { const n = c.ri(R, 50, 200); bad = join(['Setze n auf ' + n, 'Setze z auf 0', 'Solange n > 1', '  Setze n auf n div 1', '  Setze z auf z + 1', 'Ende Solange', 'Ausgabe z']); fix = bad.replace('div 1', 'div 2'); bug = 3; goal = 'Das Programm soll zählen, wie oft man ' + n + ' halbieren kann, bis nur noch 1 übrig bleibt.'; why = 'n div 1 ändert n nicht, die Bedingung n > 1 bleibt immer wahr.'; }
    else { const t = c.pick(R, [5, 7, 9, 11]); bad = join(['Setze x auf 0', 'Wiederhole', '  Setze x auf x + 2', 'Bis x = ' + t, 'Ausgabe x']); fix = bad.replace('x = ' + t, 'x >= ' + t); bug = 3; goal = 'Das Programm soll in Zweierschritten hochzählen und aufhören, sobald x mindestens ' + t + ' erreicht.'; why = 'x ist immer gerade und trifft ' + t + ' nie genau, die Bedingung x = ' + t + ' wird nie wahr.'; }
    const r = mustRun(bad, { allowErr: true, maxSteps: 2000 });
    return lineQ(goal + ' Beim Start läuft das Programm aber nicht zu Ende: Der Interpreter bricht nach 2000 Schritten ab (Schrittgrenze). Welche Zeile enthält den Fehler?', bad, bug, 'Die Zeile ' + (bug + 1) + ' ist falsch: ' + why + ' Richtig: ' + fix.split('\n')[bug].trim() + '.', ['Eine Schleife endet nur, wenn sich etwas ändert, das in der Bedingung vorkommt. Was ändert sich hier bei jedem Durchlauf?', 'Prüfe, ob sich die Variable aus der Bedingung in die Richtung bewegt, in der die Bedingung falsch wird.'], { meta: { bad, fix, kind: 'endless', limit: r.error && r.error.kind === 'limit' } });
  };
  const INITS = [
    { acc: 'Setze s auf s + a[i]', pre: 's', right: 'Setze s auf 0', wrong: ['Setze s auf 1', 'Setze s auf a[0]', 'Setze s auf -1'], goal: 'die Summe aller Werte', arr: [3, 8, 5, 6], res: a => a.reduce((x, y) => x + y, 0) },
    { acc: 'Setze p auf p * a[i]', pre: 'p', right: 'Setze p auf 1', wrong: ['Setze p auf 0', 'Setze p auf 2', 'Setze p auf a[0]'], goal: 'das Produkt aller Werte', arr: [2, 3, 4, 5], res: a => a.reduce((x, y) => x * y, 1) },
    { acc: 'Wenn a[i] > 0 dann|Setze z auf z + 1|Ende Wenn', pre: 'z', right: 'Setze z auf 0', wrong: ['Setze z auf 1', 'Setze z auf -1', 'Setze z auf Länge(a)'], goal: 'wie viele Werte größer als 0 sind', arr: [4, -2, 7, 0, 9], res: a => a.filter(x => x > 0).length },
    { acc: 'Wenn a[i] < m dann|Setze m auf a[i]|Ende Wenn', pre: 'm', right: 'Setze m auf a[0]', wrong: ['Setze m auf 0', 'Setze m auf Länge(a)', 'Setze m auf a[Länge(a)]'], goal: 'den kleinsten Wert', arr: [31, 27, 38, 22], res: a => Math.min.apply(null, a) }
  ];
  G.err3 = R => {
    const c = C(), v = c.pick(R, INITS), a = v.arr.slice(), parts = v.acc.split('|'), body = parts.length === 3 ? ['  ' + parts[0], '    ' + parts[1], '  ' + parts[2]] : ['  ' + parts[0]];
    const mk = init => join(['Setze a auf ' + arrTxt(a)].concat(init ? [init] : [], ['Für i von 0 bis Länge(a) - 1'], body, ['Ende Für', 'Ausgabe ' + v.pre]));
    const bad = mk(null), r = mustRun(bad, { allowErr: true });
    return qChoice(R, 'Das Programm soll ' + v.goal + ' des Felds ausgeben. Beim Start meldet der Interpreter: „' + r.error.msg + '“ (Zeile ' + r.error.line + '). Welche Anweisung muss vor der Schleife ergänzt werden?', v.right, v.wrong, 'Vor der Schleife fehlt die Startbelegung: ' + v.right + '. Jede Variable, die in der Schleife gelesen wird, braucht vorher einen Wert, und zwar einen, der das Ergebnis nicht verfälscht. Richtig ergänzt gibt das Programm ' + v.res(a) + ' aus.', ['Die Meldung sagt dir, welche Variable keinen Anfangswert hat.', 'Welcher Startwert verändert das Ergebnis nicht? Spiele die ersten zwei Durchläufe mit jedem Vorschlag durch.'], { prog: bad, meta: { mk, a, right: v.right, wrong: v.wrong, expect: v.res(a), pre: v.pre } });
  };
  G.err4 = R => {
    const c = C(), v = c.ri(R, 0, 3); let bad, fix, goal, bug, intended, inp = null;
    if (v === 0) { const a = distinct(R, 4, 3, 9).map(x => -x); intended = [String(Math.max.apply(null, a))]; bad = join(['Setze a auf ' + arrTxt(a), 'Setze max auf 0', 'Für i von 0 bis Länge(a) - 1', '  Wenn a[i] > max dann', '    Setze max auf a[i]', '  Ende Wenn', 'Ende Für', 'Ausgabe max']); fix = bad.replace('Setze max auf 0', 'Setze max auf a[0]'); bug = 1; goal = 'Das Programm soll den größten Wert des Felds ausgeben.'; }
    else if (v === 1) { const x = c.ri(R, 2, 6) * 3, y = c.ri(R, 2, 6) * 3, z = c.ri(R, 2, 6) * 3; intended = [C().fmt((x + y + z) / 3)]; bad = join(['Setze a auf ' + x, 'Setze b auf ' + y, 'Setze c auf ' + z, 'Setze m auf a + b + c / 3', 'Ausgabe m']); fix = bad.replace('a + b + c / 3', '(a + b + c) / 3'); bug = 3; goal = 'Das Programm soll den Mittelwert von a, b und c ausgeben.'; }
    else if (v === 2) { let a; do { a = distinct(R, 6, 1, 30); } while (a.filter(q => q % 2 === 0).length === 3); intended = [String(a.filter(q => q % 2 === 0).length)]; bad = join(['Setze a auf ' + arrTxt(a), 'Setze z auf 0', 'Für i von 0 bis Länge(a) - 1', '  Wenn a[i] mod 2 = 1 dann', '    Setze z auf z + 1', '  Ende Wenn', 'Ende Für', 'Ausgabe z']); fix = bad.replace('mod 2 = 1', 'mod 2 = 0'); bug = 3; goal = 'Das Programm soll zählen, wie viele gerade Werte das Feld enthält.'; }
    else { const n = c.pick(R, [7, 11, 13, 17, 19, 23]); intended = ['Primzahl']; bad = join(['Eingabe n', 'Setze p auf wahr', 'Für t von 2 bis n', '  Wenn n mod t = 0 dann', '    Setze p auf falsch', '  Ende Wenn', 'Ende Für', 'Wenn p dann', '  Ausgabe "Primzahl"', 'Sonst', '  Ausgabe "keine Primzahl"', 'Ende Wenn']); fix = bad.replace('bis n', 'bis n - 1'); bug = 2; inp = [n]; goal = 'Das Programm soll prüfen, ob die Eingabe eine Primzahl ist. Eingabe: ' + n + '.'; }
    const r = mustRun(bad, { inputs: inp, allowErr: true });
    return lineQ(goal + ' Es liefert aber ' + obs(r) + '. Welche Zeile enthält den Fehler?', bad, bug, 'Die Zeile ' + (bug + 1) + ' ist falsch. Richtig: ' + fix.split('\n')[bug].trim() + '. Solche Fehler findest du, wenn du das Programm mit einem kleinen Beispiel von Hand durchrechnest (Schreibtischtest).', ['Rechne das Programm mit den angegebenen Zahlen von Hand durch und vergleiche das Ergebnis mit dem gewünschten.', 'Frage bei jeder Zeile: Ist der Startwert sinnvoll, ist die Grenze richtig, ist die Rechenreihenfolge richtig?'], { inputs: inp, meta: { bad, fix, intended, inputs: inp, kind: 'logic' } });
  };

  /* ---------- 5. Suchen und Sortieren ---------- */
  G.search1 = R => {
    const c = C(), a = distinct(R, 8, 10, 99), found = R() < 0.75, k = c.ri(R, 0, 7), x = found ? a[k] : c.ri(R, 100, 120);
    const src = join(['Setze a auf ' + arrTxt(a), 'Setze x auf ' + x, 'Setze pos auf -1', 'Setze i auf 0', 'Solange i < Länge(a) und pos = -1', '  Wenn a[i] = x dann', '    Setze pos auf i', '  Ende Wenn', '  Setze i auf i + 1', 'Ende Solange', 'Ausgabe pos']);
    const cross = found ? k + 1 : 8, r = mustRun(src);
    return qNum('Wie oft wird der Vergleich „a[i] = x“ (Zeile 6) ausgeführt? Das Programm sucht ' + x + ' im Feld.', src, null, r.lineCounts[6] || 0, 'mal', 'Anzahl Vergleiche', ['Die Suche beginnt bei Index 0 und hört auf, sobald pos nicht mehr -1 ist.', found ? 'Wo steht ' + x + ' im Feld (Index ab 0)? Bis dahin wird bei jedem Element einmal verglichen.' : 'Der Wert kommt im Feld nicht vor. Wie viele Elemente werden dann geprüft?'], 'Ausgabe: ' + r.out[0] + (found ? ' (gefunden an Index ' + k + ', also ' + (k + 1) + ' Vergleiche)' : ' (nicht gefunden: alle 8 Elemente werden verglichen)') + '.', cross);
  };
  /* PRUEFEN P17: Binäre Suche mit m = (l + r) div 2 (abgerundete Mitte), Felder ab Index 0; gezählt werden die Durchläufe der Schleife. Ist das die Variante, die ihr unterrichtet (manche runden die Mitte auf)? */
  G.search2 = R => {
    const c = C(), a = distinct(R, 15, 10, 99).sort((p, q) => p - q), found = R() < 0.8, k = c.ri(R, 0, 14), X = found ? a[k] : (a.indexOf(a[k] + 1) >= 0 ? 200 : a[k] + 1);
    const src = join(['Setze a auf ' + arrTxt(a), 'Setze x auf ' + X, 'Setze l auf 0', 'Setze r auf Länge(a) - 1', 'Setze pos auf -1', 'Solange l <= r und pos = -1', '  Setze m auf (l + r) div 2', '  Wenn a[m] = x dann', '    Setze pos auf m', '  Sonst Wenn a[m] < x dann', '    Setze l auf m + 1', '  Sonst', '    Setze r auf m - 1', '  Ende Wenn', 'Ende Solange', 'Ausgabe pos']);
    let l = 0, r2 = a.length - 1, pos = -1, cnt = 0; while (l <= r2 && pos === -1) { const m = Math.floor((l + r2) / 2); cnt++; if (a[m] === X) pos = m; else if (a[m] < X) l = m + 1; else r2 = m - 1; }
    const r = mustRun(src);
    return qNum('Das Feld ist sortiert. Wie oft läuft die Schleife durch (wie oft wird Zeile 7 ausgeführt)?', src, null, r.lineCounts[7] || 0, 'mal', 'Durchläufe', ['Notiere l, r und m für jeden Durchlauf. m ist die abgerundete Mitte von l und r.', 'Ist a[m] kleiner als x, wird rechts weitergesucht (l = m + 1), sonst links (r = m - 1).'], 'Schreibtischtest der Schleife (je Zeile 7):\n' + traceText(src, null, 60).split('\n').filter(s => /\(Zeile 7/.test(s)).join('\n') + '\nAusgabe: ' + r.out[0], cnt);
  };
  const bubble = a => { a = a.slice(); const p = []; for (let i = 0; i <= a.length - 2; i++) { for (let j = 0; j <= a.length - 2 - i; j++) if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; } p.push(a.slice()); } return p; };
  const selection = a => { a = a.slice(); const p = []; for (let i = 0; i <= a.length - 2; i++) { let k = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[k]) k = j; const t = a[i]; a[i] = a[k]; a[k] = t; p.push(a.slice()); } return p; };
  const insertion = a => { a = a.slice(); const p = []; for (let i = 1; i < a.length; i++) { const x = a[i]; let j = i - 1; while (j >= 0 && a[j] > x) { a[j + 1] = a[j]; j--; } a[j + 1] = x; p.push(a.slice()); } return p; };
  const SORTSRC = {
    bubble: a => join(['Setze a auf ' + arrTxt(a), 'Für i von 0 bis Länge(a) - 2', '  Für j von 0 bis Länge(a) - 2 - i', '    Wenn a[j] > a[j + 1] dann', '      Setze t auf a[j]', '      Setze a[j] auf a[j + 1]', '      Setze a[j + 1] auf t', '    Ende Wenn', '  Ende Für', '  Ausgabe a', 'Ende Für']),
    selection: a => join(['Setze a auf ' + arrTxt(a), 'Für i von 0 bis Länge(a) - 2', '  Setze k auf i', '  Für j von i + 1 bis Länge(a) - 1', '    Wenn a[j] < a[k] dann', '      Setze k auf j', '    Ende Wenn', '  Ende Für', '  Setze t auf a[i]', '  Setze a[i] auf a[k]', '  Setze a[k] auf t', '  Ausgabe a', 'Ende Für']),
    insertion: a => join(['Setze a auf ' + arrTxt(a), 'Für i von 1 bis Länge(a) - 1', '  Setze x auf a[i]', '  Setze j auf i - 1', '  Solange j >= 0 und a[j] > x', '    Setze a[j + 1] auf a[j]', '    Setze j auf j - 1', '  Ende Solange', '  Setze a[j + 1] auf x', '  Ausgabe a', 'Ende Für'])
  };
  const SORTREF = { bubble, selection, insertion };
  /* PRUEFEN P16: Ein „Durchlauf“ heißt hier: Bubble-Sort = ein Durchgang der inneren Schleife (der größte Wert wandert nach hinten, innere Schleife wird jedes Mal kürzer); Selection-Sort = ein Austausch des kleinsten Werts nach vorn; Insertion-Sort = das nächste Element wird in den sortierten vorderen Teil eingefügt. Passt das zu euren Unterlagen (Namen, Zählweise)? */
  const sortGen = kind => R => {
    const c = C(); let a, ref, k, tries = 0;
    do { a = distinct(R, 5, 1, 9); ref = SORTREF[kind](a); k = c.ri(R, 1, 2); tries++; } while (tries < 100 && (a.join() === a.slice().sort((x, y) => x - y).join() || ref[k - 1].join() === (k > 1 ? ref[k - 2] : a).join()));
    const src = SORTSRC[kind](a), r = mustRun(src), nm = kind === 'bubble' ? 'Bubble-Sort' : kind === 'selection' ? 'Selection-Sort' : 'Insertion-Sort';
    const hint = kind === 'bubble' ? 'Im ersten Durchlauf wandert der größte Wert durch Tauschen nach hinten.' : kind === 'selection' ? 'Bei jedem Durchlauf wird das kleinste Element des Rests gesucht und an die vorderste Stelle des Rests getauscht.' : 'Bei jedem Durchlauf wird das nächste Element in den schon sortierten vorderen Teil an die richtige Stelle geschoben.';
    const q = qOut(nm + ': Die Ausgabe in der letzten Zeile der äußeren Schleife zeigt das Feld nach jedem Durchlauf. Was wird im ' + k + '. Durchlauf ausgegeben? Schreibe die fünf Werte hintereinander.', src, null, [hint, 'Spiele den Durchlauf von Hand mit dem Feld durch. Schreibe das Feld nach jedem Tausch neu auf.'], ref[k - 1].map(String), null, 'Das Feld nach jedem Durchlauf:\n' + r.out.map((x, i) => (i + 1) + '. Durchlauf: ' + x).join('\n') + '\n' + hint);
    q.ask.expected = [r.out[k - 1]]; q.value = r.out[k - 1]; return q;
  };
  G.sort1 = sortGen('bubble'); G.sort2 = sortGen('selection'); G.sort3 = sortGen('insertion');
  G.sort4 = R => {
    const c = C(); let a, P, kind, tries = 0; const kinds = ['bubble', 'selection', 'insertion'];
    do {
      a = distinct(R, 6, 1, 9); P = {}; kinds.forEach(k => { const p = SORTREF[k](a); P[k] = p[0].join() + '/' + p[1].join(); }); tries++;
    } while (tries < 300 && (new Set(Object.keys(P).map(k => P[k])).size < 3));
    kind = c.pick(R, kinds); const p = SORTREF[kind](a), nm = { bubble: 'Bubble-Sort', selection: 'Selection-Sort', insertion: 'Insertion-Sort' };
    return qChoice(R, 'Ein Sortierverfahren bekommt das Feld ' + arrTxt(a) + '. Nach dem 1. Durchlauf steht das Feld so da: ' + arrTxt(p[0]) + ', nach dem 2. Durchlauf so: ' + arrTxt(p[1]) + '. Welches Verfahren ist es?', nm[kind], kinds.filter(k => k !== kind).map(k => nm[k]),
      'Es ist ' + nm[kind] + '. Bubble-Sort tauscht benachbarte Paare, der größte Wert wandert nach hinten. Selection-Sort holt das kleinste Element nach vorn. Insertion-Sort schiebt das nächste Element in den sortierten vorderen Teil.', ['Schaue, was sich nach einem Durchlauf geändert hat: Wurde vorn der kleinste Wert platziert? Wanderte hinten der größte? Oder ist nur der vordere Teil sortiert?', 'Spiele jedes der drei Verfahren auf dem Startfeld einen Durchlauf lang durch und vergleiche.'], { meta: { a, kind, p0: p[0], p1: p[1] } });
  };

  /* ---------- 6. Rekursion und Aufwand ---------- */
  /* PRUEFEN P20: Fakultät mit 0! = 1 und 1! = 1 (Abbruch bei n <= 1); Fibonacci mit fib(0) = 0 und fib(1) = 1. Stimmt diese Festlegung mit eurem Unterricht überein? */
  const FAK = join(['Funktion fak(n)', '  Wenn n <= 1 dann', '    Gib zurück 1', '  Ende Wenn', '  Gib zurück n * fak(n - 1)', 'Ende Funktion']);
  const FIB = join(['Funktion fib(n)', '  Wenn n <= 1 dann', '    Gib zurück n', '  Ende Wenn', '  Gib zurück fib(n - 1) + fib(n - 2)', 'Ende Funktion']);
  G.rek1 = R => {
    const c = C(), N = c.ri(R, 3, 8), calls = c.ri(R, 0, 1) === 1, src = FAK + '\nAusgabe fak(' + N + ')';
    let fa = 1; for (let i = 2; i <= N; i++) fa *= i; const r = mustRun(src);
    const tr = traceText(src, null, 40);
    return calls ? qNum('Wie oft wird die Funktion fak insgesamt aufgerufen, wenn man fak(' + N + ') ausführt (den ersten Aufruf mitgezählt)? Tipp: Zeile 2 wird bei jedem Aufruf genau einmal ausgeführt.', src, null, r.lineCounts[2], 'mal', 'Anzahl Aufrufe', ['fak(' + N + ') ruft fak(' + (N - 1) + ') auf, das ruft fak(' + (N - 2) + ') auf, und so weiter, bis die Abbruchbedingung greift.', 'Zähle die Aufrufe von ' + N + ' hinunter bis zur Zahl, bei der „n <= 1“ wahr wird.'], 'Es gibt die Aufrufe fak(' + N + '), fak(' + (N - 1) + '), …, fak(1): das sind ' + N + ' Aufrufe.', N)
      : qNum('Welche Zahl gibt das Programm aus?', src, null, +r.out[0], '', 'Ausgabe', ['Die Funktion ruft sich selbst mit einem kleineren Wert auf, bis die Abbruchbedingung greift (n <= 1). Danach werden die Ergebnisse nach oben zurückgegeben und multipliziert.', 'fak(1) = 1. Damit ist fak(2) = 2 · fak(1), fak(3) = 3 · fak(2), und so weiter.'], 'Rekursion: fak(' + N + ') = ' + range(1, N).reverse().join(' · ') + ' = ' + r.out[0] + '.', fa);
  };
  G.rek2 = R => {
    const c = C(), calls = c.ri(R, 0, 1) === 1, N = calls ? c.ri(R, 3, 6) : c.ri(R, 5, 9), src = FIB + '\nAusgabe fib(' + N + ')';
    const fb = n => (n <= 1 ? n : fb(n - 1) + fb(n - 2)), r = mustRun(src);
    return calls ? qNum('Wie oft wird die Funktion fib insgesamt aufgerufen, wenn man fib(' + N + ') ausführt (den ersten Aufruf mitgezählt)? Tipp: Zeile 2 wird bei jedem Aufruf genau einmal ausgeführt.', src, null, r.lineCounts[2], 'mal', 'Anzahl Aufrufe', ['fib(n) ruft fib(n - 1) und fib(n - 2) auf. Zeichne den Baum der Aufrufe für kleine n: fib(2) braucht 3 Aufrufe.', 'Für n gilt: Aufrufe(n) = 1 + Aufrufe(n - 1) + Aufrufe(n - 2), mit Aufrufe(0) = Aufrufe(1) = 1.'], 'Aufrufe(0) = Aufrufe(1) = 1, Aufrufe(2) = 3, Aufrufe(3) = 5, Aufrufe(4) = 9, Aufrufe(5) = 15, Aufrufe(6) = 25, … Für fib(' + N + ') sind es ' + r.lineCounts[2] + ' Aufrufe. Der Aufwand wächst sehr schnell.', 2 * fb(N + 1) - 1)
      : qNum('Welche Zahl gibt das Programm aus? (Die Folge: fib(0) = 0, fib(1) = 1, jede weitere Zahl ist die Summe der beiden davor.)', src, null, +r.out[0], '', 'Ausgabe', ['Schreibe die Folge auf: 0, 1, 1, 2, 3, 5, … und zähle bis zur gesuchten Stelle (Zählung beginnt bei fib(0)).', 'fib(n) = fib(n - 1) + fib(n - 2).'], 'Die Folge lautet 0, 1, 1, 2, 3, 5, 8, 13, 21, 34. An der Stelle ' + N + ' steht ' + r.out[0] + '.', fb(N));
  };
  /* PRUEFEN P19: Aufwand nur grob über das Zählen von Vergleichen (zwei verschachtelte Schleifen: n·(n−1)/2 Vergleiche, bei doppelter Elementzahl etwa das Vierfache). Die O-Notation kommt nicht vor. Reicht das für das 1.–2. Lehrjahr, oder soll O(n²) schon genannt werden? */
  G.kompl1 = R => {
    const c = C(), n = c.ri(R, 4, 7), mk = k => join(['Setze a auf ' + arrTxt(range(1, k)), 'Setze d auf 0', 'Für i von 0 bis Länge(a) - 2', '  Für j von i + 1 bis Länge(a) - 1', '    Wenn a[i] = a[j] dann', '      Setze d auf d + 1', '    Ende Wenn', '  Ende Für', 'Ende Für', 'Ausgabe d']);
    const dbl = R() < 0.5, k = dbl ? 2 * n : n, src = mk(n), asked = mk(k), r = mustRun(asked), cnt = r.lineCounts[5] || 0;
    return qNum(dbl ? 'Das Programm vergleicht jedes Paar von Elementen im Feld (Zeile 5). Es ist hier für ' + n + ' Elemente gezeigt. Wie viele Vergleiche würden es bei doppelt so vielen Elementen (' + k + ') sein? Du kannst die Zahl ' + n + ' im Programm durch ' + k + ' Elemente ersetzen und im Editor zählen.' : 'Das Programm vergleicht jedes Paar von Elementen im Feld. Wie oft wird der Vergleich „a[i] = a[j]“ (Zeile 5) ausgeführt?', src, null, cnt, 'mal', 'Anzahl Vergleiche',
      ['Zähle die Paare: Das Element 0 wird mit n - 1 anderen verglichen, Element 1 mit n - 2 weiteren, und so weiter.', 'Die Summe 1 + 2 + … + (n - 1) ist n · (n - 1) / 2.'], 'Bei ' + k + ' Elementen gibt es ' + k + ' · ' + (k - 1) + ' / 2 = ' + cnt + ' Vergleiche. Verdoppelt man die Elementzahl, wächst die Zahl der Vergleiche ungefähr auf das Vierfache (grob quadratisch).', k * (k - 1) / 2);
  };

  /* ---------- 7. Zahlenalgorithmen ---------- */
  /* PRUEFEN P14: Primzahltest durch Probedivision nur bis zur Wurzel (Bedingung i * i <= n) mit Abbruch beim ersten Teiler; für n < 2 gilt „keine Primzahl“. Ist das die Standardform in eurem Unterricht oder wird bis n - 1 geteilt? */
  G.zahl1 = R => {
    const c = C(), n = c.pick(R, [29, 49, 91, 97, 53, 77, 35, 101, 121, 61]);
    const src = join(['Eingabe n', 'Setze p auf n >= 2', 'Setze i auf 2', 'Solange i * i <= n und p', '  Wenn n mod i = 0 dann', '    Setze p auf falsch', '  Ende Wenn', '  Setze i auf i + 1', 'Ende Solange', 'Wenn p dann', '  Ausgabe "Primzahl"', 'Sonst', '  Ausgabe "keine Primzahl"', 'Ende Wenn']);
    let cnt = 0, i = 2, p = n >= 2; while (i * i <= n && p) { cnt++; if (n % i === 0) p = false; i++; }
    const r = mustRun(src, { inputs: [n] });
    return qNum('Eingabe: ' + n + '. Wie oft wird die Teilbarkeitsprüfung „n mod i = 0“ (Zeile 5) ausgeführt?', src, [n], r.lineCounts[5] || 0, 'mal', 'Anzahl Prüfungen', ['Die Schleife läuft, solange i · i höchstens n ist und noch kein Teiler gefunden wurde.', 'Prüfe i = 2, 3, 4, … der Reihe nach. Hör auf, sobald ein Teiler gefunden ist oder i · i größer als n wird.'], 'Ausgabe: ' + r.out[0] + '. Es genügt, bis zur Wurzel von n zu prüfen: Hat n einen Teiler größer als die Wurzel, dann gehört dazu ein Teiler kleiner als die Wurzel.', cnt);
  };
  G.zahl2 = R => {
    const c = C(), n = c.ri(R, 12, 36), src = join(['Setze n auf ' + n, 'Für t von 1 bis n', '  Wenn n mod t = 0 dann', '    Ausgabe t', '  Ende Wenn', 'Ende Für']);
    const cross = range(1, n).filter(t => n % t === 0).map(String);
    return qOut('Welche Zahlen gibt das Programm aus? Schreibe alle Ausgaben hintereinander, getrennt durch Leerzeichen.', src, null, ['t ist ein Teiler von n, wenn die Division ohne Rest aufgeht (n mod t = 0).', 'Prüfe t = 1, 2, 3, … der Reihe nach, bis n erreicht ist. Notiere nur die Zahlen, bei denen der Rest 0 ist.'], cross, null, 'Teiler von ' + n + ': ' + cross.join(', ') + '. Jede Ausgabe steht in einer eigenen Zeile.');
  };
  /* PRUEFEN P15: ggT nach Euklid mit Rest (mod); gezählt werden die Schleifendurchläufe. Wird bei euch die Subtraktionsvariante (größere minus kleinere Zahl) unterrichtet? */
  G.zahl3 = R => {
    const c = C(), g = c.pick(R, [2, 3, 4, 5, 6, 7]), x = c.ri(R, 2, 9), y = c.ri(R, 2, 9), a0 = g * Math.max(x, y) + (x === y ? g : 0), b0 = g * Math.min(x, y), asRes = c.ri(R, 0, 1) === 1;
    const src = join(['Eingabe a', 'Eingabe b', 'Solange b <> 0', '  Setze t auf a mod b', '  Setze a auf b', '  Setze b auf t', 'Ende Solange', 'Ausgabe a']);
    let A = a0, B = b0, cnt = 0; while (B !== 0) { const t = A % B; A = B; B = t; cnt++; }
    const r = mustRun(src, { inputs: [a0, b0] });
    return asRes ? qNum('Eingaben: a = ' + a0 + ' und b = ' + b0 + '. Welche Zahl gibt das Programm aus?', src, [a0, b0], +r.out[0], '', 'Ausgabe', ['Es ist der Euklid-Algorithmus: Ersetze (a, b) immer durch (b, a mod b), bis b gleich 0 ist.', 'Schreibe a, b und t nach jedem Durchlauf auf.'], 'Schreibtischtest:\n' + traceText(src, [a0, b0], 20) + '\nAusgabe: ' + r.out[0] + ' (größter gemeinsamer Teiler).', A)
      : qNum('Eingaben: a = ' + a0 + ' und b = ' + b0 + '. Wie oft wird die Schleife durchlaufen (wie oft wird Zeile 4 ausgeführt)?', src, [a0, b0], r.lineCounts[4] || 0, 'mal', 'Durchläufe', ['Es ist der Euklid-Algorithmus: In jedem Durchlauf wird (a, b) durch (b, a mod b) ersetzt, bis b gleich 0 ist.', 'Schreibe a, b und t nach jedem Durchlauf auf und zähle mit.'], 'Schreibtischtest:\n' + traceText(src, [a0, b0], 20) + '\nAusgabe ' + r.out[0] + ' (größter gemeinsamer Teiler), erreicht nach ' + cnt + ' Durchläufen.', cnt);
  };
  /* PRUEFEN P22: Umrechnung dezimal in Zweier-/Achtersystem durch fortgesetzte Division mit Rest, Reste von hinten gelesen (die Ziffer wird vorn an den Text gehängt; „Zahl + Text“ verbindet zu Text). Ist diese Schreibweise für die Lücke in Ordnung? */
  G.zahl4 = R => {
    const c = C(), b = c.pick(R, [2, 2, 8]), before = ['Eingabe n', 'Setze b auf ' + b, 'Setze s auf ""', 'Solange n > 0'], gap = '(Lücke: eine Zeile, die die nächste Ziffer vorn an s anhängt)', after = ['  Setze n auf n div b', 'Ende Solange', 'Ausgabe s'], model = 'Setze s auf (n mod b) + s';
    const vals = b === 2 ? [13, 8, 1, 255, 100] : [64, 9, 7, 100, 511];
    return {
      text: 'Das Programm rechnet eine Dezimalzahl in das Zahlensystem zur Basis ' + b + ' um: Es teilt immer wieder durch ' + b + ' und merkt sich die Reste. Die letzte Ziffer entsteht zuerst, die nächste muss davor stehen. Schreibe die fehlende Zeile für die Lücke. („Zahl + Text“ ergibt einen Text.)',
      prog: join(before.concat(['  ' + gap], after)), ask: { type: 'code', before, after, model, cases: vals.map(v => ({ inputs: [v], expect: [v.toString(b)] })) }, value: model, tol: 0,
      expl: 'Bei jedem Durchlauf ist n mod ' + b + ' die nächste Ziffer von hinten. Sie wird vorn an s gehängt:\n' + model + '\nBeispiel: 13 in Basis 2: Reste 1, 0, 1, 1 (von hinten nach vorn) ergeben 1101.', tips: ['Die erste berechnete Ziffer ist die letzte der Zielzahl. Neue Ziffern kommen also nach vorn.', 'Die Ziffer ist n mod b. Verbinde sie mit dem alten Text s so, dass die neue Ziffer vorn steht.']
    };
  };

  /* ---------- Aufgabenliste ---------- */
  const defs = [
    [0, 1, 'Werte nach Zuweisungen', 'vars1'], [0, 1, 'Verzweigung mit mehreren Zweigen', 'vars2'], [0, 2, 'Wert nach n Schritten', 'vars3'], [0, 2, 'Zwei Werte vertauschen', 'vars4'], [0, 3, 'Verschachtelte Entscheidung', 'vars5'],
    [1, 1, 'Zählschleife und Summe', 'loop1'], [1, 1, 'Durchläufe zählen', 'loop2'], [1, 2, 'Schleife mit Bedingung', 'loop3'], [1, 2, 'Bedingung vorn oder hinten', 'loop4'], [1, 3, 'Schleife in Schleife', 'loop5'],
    [2, 1, 'Ablaufplan lesen', 'pap1'], [2, 2, 'Struktogramm lesen', 'nsd1'], [2, 2, 'Ablaufplan ergänzen', 'pap2'], [2, 2, 'Struktogramm ergänzen', 'nsd2'], [2, 1, 'Blöcke ordnen', 'pap3'],
    [3, 2, 'Tabellentest mit Zählschleife', 'tab1'], [3, 3, 'Tabellentest mit Verzweigung', 'tab2'], [3, 2, 'Fehlersuche A', 'err1'], [3, 2, 'Fehlersuche B', 'err2'], [3, 2, 'Fehlersuche C', 'err3'], [3, 3, 'Fehlersuche D', 'err4'],
    [4, 1, 'Suche im Feld', 'search1'], [4, 2, 'Suche im sortierten Feld', 'search2'], [4, 2, 'Sortieren Schritt für Schritt 1', 'sort1'], [4, 2, 'Sortieren Schritt für Schritt 2', 'sort2'], [4, 3, 'Sortieren Schritt für Schritt 3', 'sort3'], [4, 3, 'Verfahren erkennen', 'sort4'],
    [5, 2, 'Rekursive Funktion 1', 'rek1'], [5, 3, 'Rekursive Funktion 2', 'rek2'], [5, 2, 'Vergleiche zählen', 'kompl1'],
    [6, 2, 'Zahl prüfen', 'zahl1'], [6, 1, 'Alle Teiler', 'zahl2'], [6, 3, 'Rest und Tausch', 'zahl3'], [6, 3, 'Zahl umrechnen', 'zahl4']
  ];
  const tasks = defs.map((d, i) => ({ id: 'alg' + (i + 1), cat: CATS[d[0]], level: d[1], title: d[2], gen: d[3] }));

  function make(t, R) { const q = G[t.gen](R); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('alg-' + t.id)); }
  function randomQ(R, level) { const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)]; return make(t, C().rng(Math.floor(R() * 4294967296))); }

  /* ---------- Antworten prüfen ---------- */
  function checkCode(q, text) {
    const a = q.ask, body = String(text || '').replace(/\r/g, '').split('\n').map(s => s.replace(/\s+$/, '')).filter(s => s.trim() !== '');
    if (!body.length) return { incomplete: 'Schreibe mindestens eine Zeile in die Lücke.' };
    const src = a.before.concat(body, a.after).join('\n'), P = C().parse(src);
    if (!P.ok) { const ln = P.error.line, k = ln - a.before.length; return { ok: false, given: body.join(' / '), msg: 'Syntaxfehler' + (k >= 1 && k <= body.length ? ' in deiner Zeile ' + k : ' (Zeile ' + ln + ' des Gesamtprogramms)') + ': ' + P.error.msg }; }
    for (const cs of a.cases) {
      const r = C().run(P.prog, { inputs: cs.inputs, maxSteps: 5000 });
      if (r.error) return { ok: false, given: body.join(' / '), msg: 'Bei der Eingabe ' + cs.inputs.join(', ') + ' bricht das Programm ab: ' + r.error.msg };
      if (!C().sameOut(cs.expect, r.out)) return { ok: false, given: body.join(' / '), msg: 'Bei der Eingabe ' + cs.inputs.join(', ') + ' wird „' + r.out.join(' | ') + '“ ausgegeben, erwartet wird „' + cs.expect.join(' | ') + '“.' };
    }
    return { ok: true, given: body.join(' / ') };
  }
  function evalAnswer(q, a) {
    a = a || {}; const k = q.ask.type;
    if (k === 'choice') { if (a.c == null) return { incomplete: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    if (k === 'num') { const v = C().parseDe(a.v); if (!Number.isFinite(v)) return { incomplete: 'Bitte gib eine Zahl ein.' }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + (q.ask.unit ? ' ' + q.ask.unit : '') }; }
    if (k === 'out') { if (!String(a.v || '').trim()) return { incomplete: 'Schreibe die Ausgabe auf (mehrere Werte durch Leerzeichen trennen).' }; return { ok: C().sameOut(q.ask.expected, a.v), given: String(a.v).trim() }; }
    if (k === 'line') { const s = (a.s || []).slice().sort((x, y) => x - y); if (!s.length) return { incomplete: 'Tippe zuerst die Zeile an, in der du den Fehler vermutest.' }; return { ok: s.join() === q.ask.correct.slice().sort((x, y) => x - y).join(), given: 'Zeile ' + s.map(x => x + 1).join(', ') }; }
    if (k === 'order') { const sq = a.seq || []; if (sq.length < q.ask.items.length) return { incomplete: 'Tippe erst alle ' + q.ask.items.length + ' Blöcke an.' }; return { ok: sq.every((ix, p) => q.ask.items[ix] === q.ask.correct[p]), given: sq.map(ix => q.ask.items[ix]).join(' → ') }; }
    if (k === 'table') {
      const cells = a.cells || {}; let miss = false, ok = true, n = 0;
      q.ask.rows.forEach((row, ri) => row.forEach((v, ci) => { if (v !== null) return; n++; const x = C().parseDe(cells[ri + ',' + ci]); if (!Number.isFinite(x)) miss = true; else if (Math.abs(x - q.ask.full[ri][ci]) > 1e-9) ok = false; }));
      if (miss) return { incomplete: 'Fülle alle leeren Felder der Tabelle aus.' };
      return { ok, given: n + ' Felder ausgefüllt' };
    }
    if (k === 'code') return checkCode(q, a.v);
    return { incomplete: 'Unbekannte Aufgabenart.' };
  }
  function modelAnswer(q) {
    const k = q.ask.type;
    if (k === 'choice') return { c: q.ask.correct };
    if (k === 'num') return { v: f(q.value, 2) };
    if (k === 'out') return { v: q.ask.expected.join(' ') };
    if (k === 'line') return { s: q.ask.correct.slice() };
    if (k === 'order') { const used = []; return { seq: q.ask.correct.map(t => { const ix = q.ask.items.findIndex((x, i) => x === t && used.indexOf(i) < 0); used.push(ix); return ix; }) }; }
    if (k === 'table') { const cells = {}; q.ask.rows.forEach((row, ri) => row.forEach((v, ci) => { if (v === null) cells[ri + ',' + ci] = String(q.ask.full[ri][ci]); })); return { cells }; }
    if (k === 'code') return { v: q.ask.model };
    return {};
  }
  function solText(q) {
    const a = q.ask;
    if (a.type === 'choice') return a.choices[a.correct];
    if (a.type === 'num') return f(q.value, 2) + (a.unit ? ' ' + a.unit : '');
    if (a.type === 'out') return a.expected.join(' | ');
    if (a.type === 'line') return 'Zeile ' + a.correct.map(x => x + 1).join(', ') + ': ' + a.lines[a.correct[0]].trim();
    if (a.type === 'order') return a.correct.join(' → ');
    if (a.type === 'table') return a.cols.join(' | ') + '\n' + a.full.map(r => r.join(' | ')).join('\n');
    return a.model;
  }

  /* ---------- Beispiele (fertig durchgerechnet; Tabellentest und Zeichnungen erzeugt das UI mit ALG_CORE) ---------- */
  const examples = [
    { id: 'summe', title: 'Summe der Zahlen von 1 bis 5', text: 'Eine Zählschleife addiert die Zahlen. Beobachte im Tabellentest, wie s Schritt für Schritt wächst und wie i nach der Schleife auf 6 steht.', src: join(['Setze s auf 0', 'Für i von 1 bis 5', '  Setze s auf s + i', 'Ende Für', 'Ausgabe s']) },
    { id: 'wenn', title: 'Gerade oder ungerade', text: 'Eine Verzweigung entscheidet mit dem Rest der Division durch 2. Die Eingabe ist 7.', src: join(['Eingabe zahl', 'Wenn zahl mod 2 = 0 dann', '  Ausgabe "gerade"', 'Sonst', '  Ausgabe "ungerade"', 'Ende Wenn']), inputs: [7] },
    { id: 'tausch', title: 'Zwei Werte tauschen', text: 'Ohne Hilfsvariable h würde ein Wert verloren gehen. Die Eingaben sind 3 und 8.', src: join(['Eingabe a', 'Eingabe b', 'Setze h auf a', 'Setze a auf b', 'Setze b auf h', 'Ausgabe a, b']), inputs: [3, 8] },
    { id: 'fuss', title: 'Fußgesteuerte Schleife (Wiederhole … Bis)', text: 'Der Körper läuft einmal, bevor die Bedingung geprüft wird. Obwohl n schon größer als 5 ist, wird 10 noch ausgegeben.', src: join(['Setze n auf 10', 'Wiederhole', '  Ausgabe n', '  Setze n auf n + 1', 'Bis n > 5']) },
    { id: 'linear', title: 'Lineare Suche', text: 'Das Feld wird von vorn Element für Element durchsucht. Gesucht wird 42, sie steht an Index 3 (Zählung ab 0).', src: join(['Setze a auf [17, 8, 25, 42, 3, 31]', 'Setze x auf 42', 'Setze pos auf -1', 'Setze i auf 0', 'Solange i < Länge(a) und pos = -1', '  Wenn a[i] = x dann', '    Setze pos auf i', '  Ende Wenn', '  Setze i auf i + 1', 'Ende Solange', 'Ausgabe pos']) },
    { id: 'binaer', title: 'Binäre Suche', text: 'Das Feld ist sortiert. Jeder Durchlauf halbiert den Suchbereich (l bis r). Gesucht wird 23.', src: join(['Setze a auf [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]', 'Setze x auf 23', 'Setze l auf 0', 'Setze r auf Länge(a) - 1', 'Setze pos auf -1', 'Solange l <= r und pos = -1', '  Setze m auf (l + r) div 2', '  Wenn a[m] = x dann', '    Setze pos auf m', '  Sonst Wenn a[m] < x dann', '    Setze l auf m + 1', '  Sonst', '    Setze r auf m - 1', '  Ende Wenn', 'Ende Solange', 'Ausgabe pos']) },
    { id: 'bubble', title: 'Bubble-Sort', text: 'Benachbarte Werte werden getauscht, wenn sie in falscher Reihenfolge stehen. Nach jedem Durchlauf der äußeren Schleife steht der größte Rest-Wert hinten.', src: SORTSRC.bubble([5, 2, 4, 1, 3]) },
    { id: 'selection', title: 'Selection-Sort', text: 'In jedem Durchlauf wird das kleinste Element des Rests gesucht und nach vorn getauscht.', src: SORTSRC.selection([5, 2, 4, 1, 3]) },
    { id: 'insertion', title: 'Insertion-Sort', text: 'Das nächste Element wird in den schon sortierten vorderen Teil eingefügt; größere Werte rücken nach rechts.', src: SORTSRC.insertion([5, 2, 4, 1, 3]) },
    { id: 'fak', title: 'Fakultät rekursiv', text: 'Die Funktion ruft sich selbst mit n - 1 auf. Im Tabellentest siehst du in der Spalte „Ebene“ die Schachtelungstiefe der Aufrufe.', src: FAK + '\nAusgabe fak(4)' },
    { id: 'fib', title: 'Fibonacci rekursiv', text: 'Jeder Aufruf ruft zwei weitere auf. Schon für kleine n entstehen viele Aufrufe (Aufwand wächst schnell).', src: FIB + '\nAusgabe fib(4)' },
    { id: 'prim', title: 'Primzahltest', text: 'Probedivision nur bis zur Wurzel von n. Eingabe: 91 (= 7 · 13).', src: join(['Eingabe n', 'Setze p auf n >= 2', 'Setze i auf 2', 'Solange i * i <= n und p', '  Wenn n mod i = 0 dann', '    Setze p auf falsch', '  Ende Wenn', '  Setze i auf i + 1', 'Ende Solange', 'Wenn p dann', '  Ausgabe "Primzahl"', 'Sonst', '  Ausgabe "keine Primzahl"', 'Ende Wenn']), inputs: [91] },
    { id: 'teiler', title: 'Teilersuche', text: 'Jede Zahl von 1 bis n wird auf Teilbarkeit geprüft (Rest 0). Die Zahl ist 24.', src: join(['Setze n auf 24', 'Für t von 1 bis n', '  Wenn n mod t = 0 dann', '    Ausgabe t', '  Ende Wenn', 'Ende Für']) },
    { id: 'ggt', title: 'Größter gemeinsamer Teiler (Euklid)', text: 'Immer wieder (a, b) durch (b, a mod b) ersetzen, bis b gleich 0 ist. Eingaben: 48 und 18.', src: join(['Eingabe a', 'Eingabe b', 'Solange b <> 0', '  Setze t auf a mod b', '  Setze a auf b', '  Setze b auf t', 'Ende Solange', 'Ausgabe a']), inputs: [48, 18] },
    { id: 'dual', title: 'Dezimalzahl ins Zweiersystem umrechnen', text: 'Fortgesetzte Division durch 2: Die Reste ergeben von hinten nach vorn gelesen die Binärzahl. Eingabe: 13.', src: join(['Eingabe n', 'Setze s auf ""', 'Solange n > 0', '  Setze s auf (n mod 2) + s', '  Setze n auf n div 2', 'Ende Solange', 'Ausgabe s']), inputs: [13] },
    { id: 'fehler', title: 'Schrittgrenze schützt vor Endlosschleife', text: 'Hier wird i nie kleiner, die Bedingung bleibt immer wahr. Der Interpreter bricht nach der Schrittgrenze ab und meldet es, statt das Gerät einzufrieren. Im Editor kannst du den Fehler beheben.', src: join(['Setze i auf 5', 'Solange i > 0', '  Ausgabe i', '  Setze i auf i + 1', 'Ende Solange']), maxSteps: 300 }
  ];

  root.ALG_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, evalAnswer, modelAnswer, solText, traceText, sortref: SORTREF, sortsrc: SORTSRC };
  root.ALG_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.ALG_DATA, TASKS: root.ALG_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
