'use strict';
/* Tonfunk Touren-Lab: Daten (Aufgaben-Generatoren, Beispiele).
   ALLE Zahlen (Entfernungen, Fahrzeuge, Kostensätze, Zeitfenster) sind ÜBUNGSWERTE, nicht für die Praxis.
   window.TOU_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, pools }
   window.TOU_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'tou', Status in localStorage 'lm4.tou.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id): dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed.
   Jede Aufgabe nennt mit "So gehst du vor" die Schritte. Titel bleiben neutral, ohne Ergebnis.
   Nicht doppeln (siehe wfllab/ladlab): Kommissionierung, Versandart, Frachtpapiere, Ladungssicherung. */
(function (root) {
  const C = () => root.TOU_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const CATS = ['Touren bilden', 'Fahrzeug wählen', 'Ladereihenfolge', 'Zeitplanung und Lenkzeiten', 'Kosten'];

  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  /* "So gehst du vor": erwartete Schritte der Reihe nach */
  const sg = steps => ' So gehst du vor: ' + steps.map((s, i) => (i + 1) + '. ' + s).join(' ');
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0] + sg(q[5]), q[1], q[2], q[3], q[4]); };
  const SG_WAHL = ['Lies die Frage genau.', 'Streiche Antworten, die sicher falsch sind.', 'Wähle die Antwort, die vollständig stimmt.'];

  /* ---------- Fragen-Pools: [Text, richtig, falsch[], Erklärung, Tipps, Schritte] ---------- */
  const TOURQ = [
    ['Ein Lkw startet im Lager, beliefert nacheinander mehrere Kunden und kommt danach leer zurück. Wie nennt man diese Tour?', 'Verteiltour (Auslieferungstour)', ['Sammeltour', 'Pendeltour zwischen zwei Orten', 'Streckengeschäft'], 'Bei der Verteiltour wird Ware vom Lager aus an mehrere Empfänger verteilt. Die Rückfahrt zum Lager gehört zur Tour.', ['Wohin geht die Ware: vom Lager weg oder zum Lager hin?', 'Die Ware wird auf mehrere Kunden verteilt.'], SG_WAHL],
    ['Ein Lkw fährt mehrere Lieferer an, holt dort Ware ab und bringt alles ins Lager des Modellbetriebs. Wie nennt man diese Tour?', 'Sammeltour (Abholtour)', ['Verteiltour', 'Pendeltour zwischen zwei Orten', 'Direktbelieferung'], 'Bei der Sammeltour wird Ware an mehreren Stellen eingesammelt und an einen Ort gebracht.', ['Die Ware kommt zum Lager hin.', 'Es wird an mehreren Stellen eingesammelt.'], SG_WAHL],
    ['Warum liefert das Nächster-Nachbar-Verfahren nicht immer die kürzeste Rundtour?', 'Es wählt immer nur den nächsten Schritt und achtet nicht darauf, wie weit die letzten Kunden und der Rückweg zum Lager entfernt sind', ['Es rechnet mit falschen Entfernungen', 'Es lässt Kunden einfach weg', 'Es fährt immer zuerst den am weitesten entfernten Kunden an'], 'Das Verfahren ist einfach und schnell, plant aber nicht voraus. Am Ende bleiben oft weit auseinander liegende Kunden übrig. Deshalb lohnt ein Vergleich mit anderen Reihenfolgen.', ['Schaut das Verfahren auf die ganze Tour oder nur auf den nächsten Schritt?', 'Denke an den Rückweg zum Lager am Ende.'], SG_WAHL],
    ['Warum rechnest du bei einer Verteiltour die Rückfahrt zum Lager immer mit ein?', 'Das Fahrzeug muss zurück. Auch leere Kilometer kosten Kraftstoff, Zeit und Lohn', ['Weil der Kunde die Rückfahrt bezahlt', 'Nur damit die Zahl größer wird', 'Die Rückfahrt rechnet man nie mit ein'], 'Die Rundtour endet erst wieder im Lager. Leerkilometer verursachen Kosten und zählen zur Lenkzeit.', ['Wo steht das Fahrzeug am Abend?', 'Kosten entstehen auch ohne Ladung.'], SG_WAHL],
    ['Was musst du bei der Tourenplanung außer den Entfernungen noch beachten?', 'Zeitfenster der Kunden, Stellplätze und Nutzlast des Fahrzeugs sowie die Lenk- und Ruhezeiten', ['Nur die Farbe des Fahrzeugs', 'Nur das Wetter am Vortag', 'Nichts, die kürzeste Strecke ist immer die beste Tour'], 'Die kürzeste Strecke nützt nichts, wenn ein Kunde nur vormittags annimmt, das Fahrzeug zu klein ist oder der Fahrer seine Lenkzeit überschreitet.', ['Was passiert, wenn der Kunde schon geschlossen hat?', 'Denke an Kunde, Fahrzeug und Fahrer.'], SG_WAHL]
  ];
  /* PRUEFEN P7: Achslasten nur als Begriff (ungleiche Verteilung kann eine Achse überlasten, obwohl das Gesamtgewicht stimmt; Lastverteilungsplan des Herstellers). Keine Achslast-Rechnung. Reicht das für LF 7 und LF 8? */
  const FZQ = [
    ['Was gibt die Nutzlast eines Lkw an?', 'Wie viel Ladung das Fahrzeug höchstens zuladen darf: zulässiges Gesamtgewicht minus Leergewicht', ['Das Gewicht des leeren Fahrzeugs', 'Das zulässige Gesamtgewicht', 'Die Zahl der Palettenstellplätze'], 'Nutzlast = zulässiges Gesamtgewicht − Leergewicht. Fahrer und Kraftstoff gehören je nach Angabe zum Leergewicht, im Lab ist das schon eingerechnet.', ['Was bleibt übrig, wenn man das leere Fahrzeug abzieht?', 'Gesamtgewicht minus Leergewicht.'], SG_WAHL],
    ['Ein Lkw ist nach dem Wiegen nicht überladen. Trotzdem ist die Hinterachse zu schwer. Woran liegt das?', 'Die Ladung ist ungleich verteilt. Für jede Achse gilt eine eigene zulässige Achslast, zusätzlich zum Gesamtgewicht', ['Das kann nicht sein, wenn das Gesamtgewicht stimmt', 'Die Reifen haben zu wenig Luft', 'Der Tank ist zu voll'], 'Auch bei richtigem Gesamtgewicht kann eine Achse zu viel tragen, wenn schwere Ware an einer Stelle steht. Dann muss die Ladung anders verteilt werden.', ['Gilt nur das Gesamtgewicht oder auch etwas je Achse?', 'Wo stehen die schweren Paletten?'], SG_WAHL],
    ['Was zeigt der Lastverteilungsplan eines Fahrzeugs?', 'Wie viel Ladung an welcher Stelle der Ladefläche stehen darf, ohne eine Achslast zu überschreiten oder die Lenkachse zu stark zu entlasten', ['Wie die Tour gefahren wird', 'Welche Kunden zuerst beliefert werden', 'Wie viele Stunden der Fahrer fahren darf'], 'Der Lastverteilungsplan zeigt für jede Stelle der Ladefläche, wie viel Ladung dort stehen darf. Bei Teilladung ist er besonders wichtig.', ['Es geht um Gewicht und Ort auf der Ladefläche.', 'Achsen dürfen nicht überlastet werden.'], SG_WAHL]
  ];
  const LADQ = [
    ['Wie verteilst du schwere und leichte Paletten auf der Ladefläche?', 'Schwere Ware unten und so, wie es der Lastverteilungsplan erlaubt, leichte Ware oben', ['Schwere Ware oben, damit sie besser hält', 'Alle schweren Paletten ganz hinten an die Tür', 'Egal, Hauptsache alles passt hinein'], 'Ein tiefer Schwerpunkt macht das Fahrzeug stabil. Wo wie viel stehen darf, zeigt der Lastverteilungsplan. Das Sichern der Ladung übst du im Ladungssicherungs-Lab.', ['Wo soll der Schwerpunkt liegen: hoch oder tief?', 'Der Lastverteilungsplan sagt, wo wie viel stehen darf.'], SG_WAHL],
    ['Was bedeutet Last In First Out beim Beladen eines Fahrzeugs für eine Verteiltour?', 'Was zuletzt eingeladen wird, wird zuerst ausgeladen. Die Ware für den ersten Kunden kommt zuletzt hinein und steht an der Tür', ['Was zuerst eingeladen wird, wird zuerst ausgeladen', 'Die schwerste Ware kommt immer zuletzt hinein', 'Jeder Kunde bekommt einen eigenen Lkw'], 'Last In First Out heißt: zuletzt hinein, zuerst hinaus. Deshalb lädst du in umgekehrter Reihenfolge der Tour.', ['Übersetze "last in": zuletzt hinein.', 'Wer bekommt seine Ware zuerst?'], SG_WAHL]
  ];
  /* PRUEFEN P8: Lenk- und Ruhezeiten nach VO (EG) 561/2006, nur Grundregeln (4,5 h Lenkzeit, dann 45 min Fahrtunterbrechung, teilbar 15 + 30; 9 h Tageslenkzeit, zweimal je Woche 10 h; 56 h Woche, 90 h Doppelwoche; 11 h tägliche Ruhezeit). Verkürzte und geteilte Ruhezeiten, wöchentliche Ruhezeit, Mehrfahrerbetrieb und die Fahrpersonalverordnung für Fahrzeuge bis 3,5 t sind nur erwähnt oder gar nicht drin. Stimmt der Wortlaut? */
  const ZEITQ = [
    ['Nach wie viel Lenkzeit muss ein Lkw-Fahrer spätestens eine Fahrtunterbrechung einlegen, und wie lang ist sie mindestens?', 'Nach 4,5 h Lenkzeit mindestens 45 min', ['Nach 6 h mindestens 30 min', 'Nach 4 h mindestens 15 min', 'Nach 9 h mindestens 11 h'], 'Nach der EU-Verordnung 561/2006 gilt: Nach höchstens 4,5 h Lenkzeit folgt eine Fahrtunterbrechung von mindestens 45 min. Die Pause darf in 15 min und danach 30 min geteilt werden.', ['Die Zahl liegt zwischen 4 und 5 Stunden.', 'Die Pause ist eine Dreiviertelstunde.'], SG_WAHL],
    ['Wie lang darf die tägliche Lenkzeit eines Lkw-Fahrers sein?', 'Höchstens 9 h, zweimal in der Woche bis zu 10 h', ['Höchstens 8 h, ohne Ausnahme', 'An jedem Tag bis zu 10 h', 'Bis zu 12 h, wenn genug Pausen gemacht werden'], 'Die tägliche Lenkzeit beträgt höchstens 9 h. Zweimal in der Woche darf sie auf 10 h verlängert werden.', ['Die Grundregel ist eine einstellige Zahl.', 'Die Ausnahme gilt nur zweimal je Woche.'], SG_WAHL],
    ['Wie viel Lenkzeit ist in einer Woche und in zwei aufeinanderfolgenden Wochen höchstens erlaubt?', '56 h in einer Woche und 90 h in zwei aufeinanderfolgenden Wochen', ['60 h in einer Woche und 100 h in zwei Wochen', '48 h in einer Woche und 96 h in zwei Wochen', '45 h in einer Woche und 90 h in zwei Wochen'], 'Wochenlenkzeit höchstens 56 h, in der Doppelwoche zusammen höchstens 90 h. Wer in einer Woche 56 h fährt, darf in der nächsten nur noch 34 h fahren.', ['Zweimal 56 h wäre mehr als für die Doppelwoche erlaubt.', '56 + 34 = 90.'], SG_WAHL],
    ['Wie lang ist die regelmäßige tägliche Ruhezeit eines Lkw-Fahrers?', 'Mindestens 11 h', ['Mindestens 8 h', 'Mindestens 45 min', 'Mindestens 24 h'], 'Die regelmäßige tägliche Ruhezeit beträgt mindestens 11 h. Die Ruhezeit darf in 3 h und 9 h geteilt oder bis zu dreimal zwischen zwei wöchentlichen Ruhezeiten auf 9 h verkürzt werden.', ['Mehr als ein halber Tag ist es nicht, aber mehr als 10 h.', 'Die Zahl ist elf.'], SG_WAHL],
    ['Du entlädst 50 min lang bei einem Kunden. Zählt diese Zeit als Fahrtunterbrechung (Pause)?', 'Nein. Entladen ist andere Arbeit. Eine Fahrtunterbrechung dient nur der Erholung', ['Ja, weil das Fahrzeug steht', 'Ja, wenn das Entladen länger als 45 min dauert', 'Ja, aber nur am Vormittag'], 'Während einer Fahrtunterbrechung darf der Fahrer weder fahren noch andere Arbeiten machen. Be- und Entladen sind Arbeit und ersetzen die Pause nicht.', ['Ruht sich der Fahrer beim Entladen aus?', 'Pause heißt: keine Arbeit.'], SG_WAHL]
  ];
  const KOSTQ = [
    ['Der Lkw fährt dieselbe Tour, nimmt aber statt 10 nun 15 Paletten mit. Was passiert mit den Kosten je Palette?', 'Die Kosten je Palette sinken, weil fast dieselben Tourkosten auf mehr Paletten verteilt werden', ['Die Kosten je Palette steigen, weil mehr Ware geladen ist', 'Die Kosten je Palette bleiben genau gleich', 'Die Kosten je Palette fallen weg, weil der Lkw voll ist'], 'Kosten je Palette = Tourkosten / Paletten. Eine bessere Auslastung verteilt die Kosten auf mehr Paletten.', ['Wie rechnest du die Kosten je Palette?', 'Teile durch eine größere Zahl.'], SG_WAHL]
  ];

  /* ---------- Hilfen ---------- */
  const pairsTxt = keys => { const all = ['L'].concat(keys), o = []; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) o.push(all[i] + '-' + all[j] + ' ' + C().km(all[i], all[j]) + ' km'); return o.join(', '); };
  const ordTxt = o => 'L → ' + o.join(' → ') + ' → L';
  /* NN eindeutig (kein Gleichstand bei einem Schritt)? */
  function nnUnique(M) {
    const n = M.length, used = new Set([0]); let cur = 0;
    for (let s = 1; s < n; s++) { const c = []; for (let j = 1; j < n; j++) if (!used.has(j)) c.push(M[cur][j]); c.sort((a, b) => a - b); if (c.length > 1 && c[0] === c[1]) return false; const nx = [...Array(n).keys()].find(j => j > 0 && !used.has(j) && M[cur][j] === c[0]); used.add(nx); cur = nx; }
    return true;
  }
  function pickSet(R, n, cond) {
    const c = C();
    for (let t = 0; t < 200; t++) { const k = c.shuffle(R, c.KUNDEN_KEYS).slice(0, n), M = c.matrixOf(k); if (nnUnique(M) && (!cond || cond(k, M))) return k; }
    return ['H', 'A', 'B', 'C'].slice(0, n);
  }
  const nnSteps = (keys) => { const c = C(), o = c.nearest(keys); let cur = 'L'; return o.concat(['L']).map(k => { const s = cur + ' → ' + k + ' ' + c.km(cur, k) + ' km'; cur = k; return s; }).join(', '); };
  const hmT = m => C().hm(m) + ' Uhr';
  const fig = (fg, q) => { q.fig = fg; return q; };
  /* Bild je Generator (Aufgabenansicht), Karte setzen die Generatoren selbst */
  const FIG = { stell: 'pal', ldm: 'pal', ldm2: 'pal', lifo1: 'lifo', lifo2: 'lifo', heck: 'lifo', umsetz: 'lifo', pmin: 'regel', einsatz: 'regel', woche: 'regel', kmk: 'kosten', zk: 'kosten', tourk: 'kosten', palk: 'kosten', sped: 'kosten' };

  /* ---------- Generatoren ---------- */
  const G = {
    /* ===== Touren bilden ===== */
    karte: R => {
      const c = C();
      for (let t = 0; t < 60; t++) {
        const X = c.pick(R, ['A', 'C', 'D', 'E', 'G']), nb = c.STRASSEN.filter(s => s[0] === X || s[1] === X).map(s => (s[0] === X ? s[1] : s[0]));
        const routes = nb.map(N => { const p = c.weg('L', N); return p.includes(X) ? null : p.concat([X]); }).filter(Boolean);
        const two = c.shuffle(R, routes).slice(0, 2); if (two.length < 2) continue;
        const seg = p => p.slice(1).map((k, i) => ({ a: p[i], b: k, km: c.strasse(p[i], k) })), len = p => seg(p).reduce((a, s) => a + s.km, 0);
        const l1 = len(two[0]), l2 = len(two[1]); if (l1 === l2) continue;
        const txt = p => seg(p).map(s => s.a + '-' + s.b + ' ' + s.km + ' km').join(', '), v = Math.min(l1, l2);
        if (two.some(p => seg(p).some(s => s.km === v))) continue;
        return fig({ art: 'map', mark: [X] }, numQ('Du fährst vom Lager L zu Kunde ' + X + '. Weg 1 führt über ' + txt(two[0]) + '. Weg 2 führt über ' + txt(two[1]) + '. Wie lang ist der kürzere Weg?' + sg(['Zähle die Teilstrecken von Weg 1 zusammen.', 'Zähle die Teilstrecken von Weg 2 zusammen.', 'Nimm den kleineren Wert.']), v, 'km', 'Kürzerer Weg', 0.01,
          'Weg 1: ' + seg(two[0]).map(s => s.km).join(' + ') + ' = ' + l1 + ' km. Weg 2: ' + seg(two[1]).map(s => s.km).join(' + ') + ' = ' + l2 + ' km. Der kürzere Weg ist ' + v + ' km lang.', ['Jeder Weg besteht aus Teilstrecken. Addiere sie.', 'Rechne Weg 1 und Weg 2 getrennt und vergleiche die Summen.']));
      }
      return G.rund(R);
    },
    nn1: R => {
      const c = C(), k = pickSet(R, 4), o = c.nearest(k), first = o[0];
      return fig({ art: 'map', mark: k }, choiceQ(R, 'Entfernungen in km: ' + pairsTxt(k) + '. Du planst ab dem Lager L nach dem Nächster-Nachbar-Verfahren. Welchen Kunden fährst du zuerst an?' + sg(['Suche alle Entfernungen, die bei L beginnen.', 'Vergleiche sie.', 'Wähle den Kunden mit der kleinsten Entfernung zu L.']), 'Kunde ' + first, k.filter(x => x !== first).map(x => 'Kunde ' + x),
        'Ab L: ' + k.map(x => 'L-' + x + ' ' + c.km('L', x) + ' km').join(', ') + '. Am nächsten liegt Kunde ' + first + ' mit ' + c.km('L', first) + ' km.', ['Beim Nächster-Nachbar-Verfahren fährst du immer zum nächstgelegenen Ort.', 'Schau nur auf die Entfernungen ab L.']));
    },
    nn: R => {
      const c = C(), k = pickSet(R, 4), o = c.nearest(k), right = ordTxt(o), wrong = [];
      for (let t = 0; t < 50 && wrong.length < 3; t++) { const p = ordTxt(c.shuffle(R, k)); if (p !== right && !wrong.includes(p)) wrong.push(p); }
      return fig({ art: 'map', mark: k }, choiceQ(R, 'Entfernungen in km: ' + pairsTxt(k) + '. Welche Rundtour ergibt das Nächster-Nachbar-Verfahren ab dem Lager L?' + sg(['Fahre von L zum nächsten Kunden.', 'Fahre von dort immer zum nächsten Kunden, der noch nicht beliefert ist.', 'Wenn alle Kunden drin sind, fährst du zurück zu L.']), right, wrong,
        'Schritt für Schritt: ' + nnSteps(k) + '. Reihenfolge: ' + right + '.', ['Entscheide immer nur den nächsten Schritt.', 'Schon belieferte Kunden fallen weg.']));
    },
    nnkm: R => {
      const c = C(), k = pickSet(R, 4), o = c.nearest(k), v = c.tourKm(o);
      return fig({ art: 'map', mark: k }, numQ('Entfernungen in km: ' + pairsTxt(k) + '. Plane die Rundtour ab dem Lager L nach dem Nächster-Nachbar-Verfahren. Wie lang ist die Rundtour mit Rückfahrt?' + sg(['Fahre von L zum nächsten Kunden.', 'Fahre von dort immer zum nächsten noch offenen Kunden.', 'Rechne die Rückfahrt zu L dazu und zähle alle Teilstrecken zusammen.']), v, 'km', 'Rundtour', 0.01,
        'Schritte: ' + nnSteps(k) + '. Summe: ' + c.tourLegs(o).map(l => l.km).join(' + ') + ' = ' + v + ' km.', ['Erst die Reihenfolge finden, dann die Strecken addieren.', 'Vergiss die Rückfahrt zu L nicht.']));
    },
    vgl: R => {
      const c = C(), k = pickSet(R, 5, kk => c.tourKm(c.nearest(kk)) > c.bestTour(kk).km), o = c.nearest(k), b = c.bestTour(k), nn = c.tourKm(o), v = nn - b.km;
      return fig({ art: 'map', mark: k }, numQ('Entfernungen in km: ' + pairsTxt(k) + '. Eine Kollegin schlägt die Rundtour ' + ordTxt(b.order) + ' vor. Wie viele km ist ihre Tour kürzer als die Tour nach dem Nächster-Nachbar-Verfahren?' + sg(['Bilde die Tour nach dem Nächster-Nachbar-Verfahren und rechne ihre Länge.', 'Rechne die Länge der vorgeschlagenen Tour.', 'Ziehe die kürzere von der längeren Tour ab.']), v, 'km', 'Unterschied', 0.01,
        'Nächster Nachbar: ' + ordTxt(o) + ' = ' + c.tourLegs(o).map(l => l.km).join(' + ') + ' = ' + nn + ' km. Vorschlag: ' + c.tourLegs(b.order).map(l => l.km).join(' + ') + ' = ' + b.km + ' km. Unterschied: ' + nn + ' − ' + b.km + ' = ' + v + ' km. Das Verfahren ist einfach, findet aber nicht immer die kürzeste Tour.', ['Rechne beide Touren mit Rückfahrt zum Lager.', 'Unterschied = Länge Nächster Nachbar − Länge Vorschlag.']));
    },
    rund: R => {
      const c = C(), n = c.ri(R, 3, 4), o = c.shuffle(R, c.KUNDEN_KEYS).slice(0, n), L = c.tourLegs(o), v = c.tourKm(o);
      return fig({ art: 'map', mark: o, order: o }, numQ('Die Tour lautet ' + ordTxt(o) + '. Die Teilstrecken: ' + L.map(l => l.von + ' nach ' + l.nach + ' ' + l.km + ' km').join(', ') + '. Wie lang ist die Rundtour?' + sg(['Schreibe alle Teilstrecken untereinander.', 'Prüfe, dass die Rückfahrt zum Lager dabei ist.', 'Zähle alle Teilstrecken zusammen.']), v, 'km', 'Rundtour', 0.01,
        L.map(l => l.km).join(' + ') + ' = ' + v + ' km. Die Rückfahrt ' + L[L.length - 1].von + ' nach L gehört zur Rundtour.', ['Eine Rundtour endet wieder im Lager.', 'Addiere alle Teilstrecken.']));
    },
    tourart: pq(TOURQ),
    /* ===== Fahrzeug wählen ===== */
    stell: R => {
      const c = C(), d = c.pick(R, [[6.2, 2.45], [7.3, 2.45], [8.0, 2.45], [9.6, 2.45], [13.6, 2.45], [4.8, 2.0], [3.4, 1.7], [7.2, 2.45]]), v = c.stell(d[0], d[1]);
      const r = c.floorN(d[0] / 1.2), q = c.floorN(d[1] / 0.8);
      return numQ('Eine Ladefläche ist ' + f(d[0]) + ' m lang und ' + f(d[1]) + ' m breit. Europaletten (1,2 m x 0,8 m) werden längs geladen: 1,2 m in Fahrtrichtung, so viele nebeneinander, wie in die Breite passen. Wie viele Palettenstellplätze hat die Ladefläche?' + sg(['Teile die Ladelänge durch 1,2 m und runde ab (Reihen).', 'Teile die Ladebreite durch 0,8 m und runde ab (Paletten je Reihe).', 'Multipliziere beide Zahlen.']), v, 'Stellplätze', 'Stellplätze', 0.01,
        'Reihen: ' + f(d[0]) + ' / 1,2 = ' + f(d[0] / 1.2) + ', abgerundet ' + r + '. Je Reihe: ' + f(d[1]) + ' / 0,8 = ' + f(d[1] / 0.8) + ', abgerundet ' + q + '. Stellplätze: ' + r + ' · ' + q + ' = ' + v + '.', ['Angefangene Paletten zählen nicht, also abrunden.', 'Reihen mal Paletten je Reihe.']);
    },
    ldm: R => {
      const c = C(), n = c.ri(R, 5, 30), v = c.ldmPal(n);
      return numQ('Eine Sendung besteht aus ' + n + ' Europaletten, nicht stapelbar. Wie viele Lademeter (ldm) belegt sie?' + sg(['Lademeter je Europalette: 1,2 m · 0,8 m / 2,4 m = 0,4 ldm.', 'Multipliziere mit der Zahl der Paletten.', 'Gib das Ergebnis in ldm an.']), v, 'ldm', 'Lademeter', 0.01,
        'Eine Europalette: 1,2 · 0,8 / 2,4 = 0,4 ldm. ' + n + ' · 0,4 = ' + f(v) + ' ldm.', ['Ein Lademeter ist 1 m Ladelänge bei 2,4 m Breite.', 'Je Europalette 0,4 ldm.']);
    },
    ldm2: R => {
      const c = C(), d = c.pick(R, [[1.6, 1.2], [2.0, 1.2], [1.2, 1.0], [2.4, 1.2], [1.8, 1.2]]), n = c.ri(R, 3, 9), v = c.ldm(d[0], d[1], n);
      return numQ('Der Modellbetrieb verschickt ' + n + ' Kisten mit ' + f(d[0]) + ' m x ' + f(d[1]) + ' m Grundfläche. Die Kisten sind nicht stapelbar. Wie viele Lademeter belegen sie zusammen?' + sg(['Rechne die Grundfläche einer Kiste (Länge · Breite).', 'Teile durch 2,4 m (Breite der Ladefläche).', 'Multipliziere mit der Zahl der Kisten.']), v, 'ldm', 'Lademeter', 0.01,
        'Je Kiste: ' + f(d[0]) + ' · ' + f(d[1]) + ' / 2,4 = ' + f(d[0] * d[1] / 2.4, 3) + ' ldm. Zusammen: ' + n + ' · ' + f(d[0] * d[1] / 2.4, 3) + ' = ' + f(v, 2) + ' ldm.', ['Lademeter = Länge · Breite / 2,4.', 'Erst je Kiste, dann mal Anzahl.']);
    },
    nutz: R => {
      const c = C(), zgg = c.pick(R, [7490, 7500, 12000, 18000, 26000]), leer = Math.round(zgg * (0.45 + R() * 0.2) / 10) * 10, v = zgg - leer;
      return numQ('Ein Lkw hat ein zulässiges Gesamtgewicht von ' + f(zgg, 0) + ' kg. Leer wiegt er ' + f(leer, 0) + ' kg (mit Fahrer und vollem Tank). Wie groß ist die Nutzlast?' + sg(['Nimm das zulässige Gesamtgewicht.', 'Ziehe das Leergewicht ab.', 'Gib das Ergebnis in kg an.']), v, 'kg', 'Nutzlast', 0.01,
        'Nutzlast = ' + f(zgg, 0) + ' − ' + f(leer, 0) + ' = ' + f(v, 0) + ' kg.', ['Was darf noch dazukommen, bis das Gesamtgewicht erreicht ist?', 'Gesamtgewicht minus Leergewicht.']);
    },
    ueber: R => {
      const c = C(), fz = c.pick(R, c.FZG.slice(0, 3)), nl = c.nutzlast(fz.zgg, fz.leer);
      for (let t = 0; t < 80; t++) {
        const a = c.ri(R, 1, 4), ka = c.pick(R, [350, 380, 420, 450, 500, 550]), b = c.ri(R, 1, 3), kb = c.pick(R, [180, 220, 260, 300]), kg = a * ka + b * kb;
        if (kg <= nl || kg - nl > 900) continue;
        return numQ('Der ' + fz.n + ' hat ein zulässiges Gesamtgewicht von ' + f(fz.zgg, 0) + ' kg und ein Leergewicht von ' + f(fz.leer, 0) + ' kg. Geladen werden ' + a + ' Paletten zu je ' + ka + ' kg und ' + b + ' Paletten zu je ' + kb + ' kg. Um wie viel kg ist er überladen?' + sg(['Rechne die Nutzlast (Gesamtgewicht − Leergewicht).', 'Rechne das Gewicht der Ladung.', 'Ziehe die Nutzlast vom Ladungsgewicht ab.']), kg - nl, 'kg', 'Überladung', 0.01,
          'Nutzlast: ' + f(fz.zgg, 0) + ' − ' + f(fz.leer, 0) + ' = ' + f(nl, 0) + ' kg. Ladung: ' + a + ' · ' + ka + ' + ' + b + ' · ' + kb + ' = ' + f(kg, 0) + ' kg. Überladung: ' + f(kg, 0) + ' − ' + f(nl, 0) + ' = ' + f(kg - nl, 0) + ' kg. So darf das Fahrzeug nicht fahren: Ladung verteilen oder größeres Fahrzeug nehmen.', ['Vergleiche Ladung und Nutzlast, nicht Ladung und Gesamtgewicht.', 'Überladung = Ladung − Nutzlast.']);
      }
      return G.nutz(R);
    },
    vol: R => {
      const c = C(), fz = c.pick(R, c.FZG), v = c.volumen(fz.l, fz.b, fz.h);
      return numQ('Der Laderaum eines ' + fz.n + ' ist ' + f(fz.l) + ' m lang, ' + f(fz.b) + ' m breit und ' + f(fz.h) + ' m hoch. Wie groß ist das Ladevolumen?' + sg(['Schreibe Länge, Breite und Höhe in m auf.', 'Multipliziere die drei Werte.', 'Runde auf zwei Stellen nach dem Komma (m³).']), v, 'm³', 'Ladevolumen', 0.01,
        'Volumen = ' + f(fz.l) + ' · ' + f(fz.b) + ' · ' + f(fz.h) + ' = ' + f(v, 2) + ' m³.', ['Volumen eines Quaders: Länge · Breite · Höhe.', 'Alle Maße in m, dann kommt m³ heraus.']);
    },
    wahl: R => {
      const c = C(); let n, kgP, fz;
      for (let t = 0; t < 80; t++) { n = c.ri(R, 3, 30); kgP = c.pick(R, [150, 200, 250, 300, 400, 500, 600]); fz = c.passend(n, n * kgP); if (fz && fz.k !== 't35' || (fz && R() < 0.3)) break; }
      const info = c.FZG.map(x => x.n + ': ' + c.stell(x.l, x.b) + ' Stellplätze, Nutzlast ' + f(c.nutzlast(x.zgg, x.leer), 0) + ' kg').join('; ');
      return choiceQ(R, 'Für eine Tour sind ' + n + ' Europaletten zu je ' + kgP + ' kg zu fahren. Fahrzeuge: ' + info + '. Welches ist das kleinste Fahrzeug, das passt?' + sg(['Rechne das Gewicht der Ladung.', 'Prüfe für jedes Fahrzeug Stellplätze und Nutzlast.', 'Nimm das kleinste Fahrzeug, bei dem beides reicht.']), fz.n, c.FZG.filter(x => x !== fz).map(x => x.n),
        'Ladung: ' + n + ' · ' + kgP + ' = ' + f(n * kgP, 0) + ' kg. ' + c.FZG.map(x => { const l = c.ladung(x, n, n * kgP); return x.n + (l.okPal && l.okKg ? ' passt' : ' passt nicht (' + (!l.okPal ? 'zu wenig Stellplätze' : 'Nutzlast zu klein') + ')'); }).join(', ') + '. Kleinstes passendes Fahrzeug: ' + fz.n + '.', ['Zwei Grenzen gelten gleichzeitig: Stellplätze und Nutzlast.', 'Beginne beim kleinsten Fahrzeug.']);
    },
    ausl: R => {
      const c = C(), fz = c.pick(R, c.FZG.slice(1)), sp = c.stell(fz.l, fz.b), nl = c.nutzlast(fz.zgg, fz.leer), n = c.ri(R, Math.ceil(sp / 3), sp), kgP = c.pick(R, [150, 200, 250, 300, 350, 400]);
      const kg = Math.min(n * kgP, nl), kgPal = Math.floor(kg / n), pp = c.pct(n, sp), pk = c.pct(n * kgPal, nl), v = Math.max(pp, pk);
      return numQ('Der ' + fz.n + ' hat ' + sp + ' Stellplätze und ' + f(nl, 0) + ' kg Nutzlast. Geladen sind ' + n + ' Paletten zu je ' + kgPal + ' kg. Rechne die Auslastung nach Stellplätzen und nach Gewicht in %. Gib die höhere Auslastung an (sie zeigt, was zuerst knapp wird).' + sg(['Auslastung Stellplätze = Paletten / Stellplätze · 100.', 'Auslastung Gewicht = Ladung in kg / Nutzlast · 100.', 'Vergleiche und gib den höheren Wert an.']), v, '%', 'Höhere Auslastung', 0.1,
        'Stellplätze: ' + n + ' / ' + sp + ' · 100 = ' + f(pp, 1) + ' %. Gewicht: ' + f(n * kgPal, 0) + ' / ' + f(nl, 0) + ' · 100 = ' + f(pk, 1) + ' %. Höher ist ' + (pp >= pk ? 'die Auslastung der Stellplätze' : 'die Auslastung nach Gewicht') + ' mit ' + f(v, 1) + ' %.', ['Es gibt zwei Auslastungen: Platz und Gewicht.', 'Erst Ladungsgewicht = Paletten · kg je Palette.']);
    },
    achs: pq(FZQ),
    /* ===== Ladereihenfolge ===== */
    lifo1: R => {
      const c = C(), o = c.shuffle(R, c.KUNDEN_KEYS).slice(0, 4), last = o[o.length - 1];
      return choiceQ(R, 'Die Tour lautet ' + ordTxt(o) + '. Du belädst den Lkw nach Last In First Out. Wessen Ware lädst du zuerst ein (ganz vorn an die Stirnwand)?' + sg(['Schreibe die Reihenfolge der Tour auf.', 'Drehe sie um: Wer zuletzt beliefert wird, kommt zuerst hinein.', 'Lies den ersten Kunden der umgedrehten Liste ab.']), 'Kunde ' + last, o.filter(x => x !== last).map(x => 'Kunde ' + x),
        'Ladereihenfolge = Tour rückwärts: ' + c.ladeFolge(o).join(', ') + '. Zuerst kommt die Ware von Kunde ' + last + ' hinein, weil er zuletzt beliefert wird.', ['Zuletzt hinein, zuerst hinaus.', 'Wer bekommt seine Ware als Letzter?']);
    },
    lifo2: R => {
      const c = C(), o = c.shuffle(R, c.KUNDEN_KEYS).slice(0, 4), right = c.ladeFolge(o).join(', '), wrong = [o.join(', ')];
      for (let t = 0; t < 50 && wrong.length < 3; t++) { const p = c.shuffle(R, o).join(', '); if (p !== right && !wrong.includes(p)) wrong.push(p); }
      return choiceQ(R, 'Die Tour lautet ' + ordTxt(o) + '. In welcher Reihenfolge lädst du die Ware der Kunden ein (zuerst genannt = zuerst eingeladen)?' + sg(['Schreibe die Reihenfolge der Tour auf.', 'Drehe die Reihenfolge um.', 'Prüfe: Die Ware des ersten Kunden steht zuletzt an der Tür.']), right, wrong,
        'Last In First Out: Ladereihenfolge = Tour rückwärts: ' + right + '. Damit steht die Ware des ersten Kunden (' + o[0] + ') an der Tür.', ['Die Ware des ersten Kunden muss als Erstes heraus.', 'Tour rückwärts lesen.']);
    },
    heck: R => {
      const c = C(), o = c.shuffle(R, c.KUNDEN_KEYS).slice(0, 4);
      return choiceQ(R, 'Die Tour lautet ' + ordTxt(o) + '. Der Lkw ist richtig nach Last In First Out beladen. Wessen Paletten stehen direkt an der Tür?' + sg(['Überlege, welche Ware als Erstes heraus muss.', 'Das ist die Ware des ersten Kunden der Tour.', 'Wähle diesen Kunden.']), 'Kunde ' + o[0], o.slice(1).map(x => 'Kunde ' + x),
        'Kunde ' + o[0] + ' wird zuerst beliefert. Seine Ware wurde zuletzt eingeladen und steht an der Tür.', ['Wer wird zuerst beliefert?', 'An der Tür steht, was zuerst heraus muss.']);
    },
    umsetz: R => {
      const c = C(), o = c.shuffle(R, c.KUNDEN_KEYS).slice(0, 4), p = o.map(() => c.ri(R, 1, 5)), v = c.umsetzen(p);
      return numQ('Tour: ' + ordTxt(o) + '. Paletten je Kunde: ' + o.map((k, i) => k + ' ' + p[i]).join(', ') + '. Ein Kollege hat in der Reihenfolge der Tour geladen: die Ware von ' + o[0] + ' zuerst, ganz vorn an der Stirnwand. Wie viele Paletten müsst ihr beim ersten Kunden mindestens aus dem Weg räumen?' + sg(['Überlege, wo die Ware des ersten Kunden steht.', 'Alle anderen Paletten stehen zwischen ihr und der Tür.', 'Zähle die Paletten der anderen Kunden zusammen.']), v, 'Paletten', 'Paletten umsetzen', 0.01,
        'Die Ware von ' + o[0] + ' steht ganz vorn. Davor stehen alle anderen: ' + p.slice(1).join(' + ') + ' = ' + v + ' Paletten. Richtig wäre Last In First Out gewesen: ' + c.ladeFolge(o).join(', ') + '.', ['Wer zuerst eingeladen wird, steht ganz hinten im Laderaum, an der Stirnwand.', 'Zähle alle Paletten außer denen des ersten Kunden.']);
    },
    rest: R => {
      const c = C(), fz = c.pick(R, c.FZG.slice(1, 3)), sp = c.stell(fz.l, fz.b), a = c.ri(R, 2, 5), b = c.ri(R, 1, 5), d = c.ri(R, 1, 4), v = sp - a - b - d;
      return numQ('Die Ladefläche des ' + fz.n + ' ist ' + f(fz.l) + ' m lang und ' + f(fz.b) + ' m breit (Europaletten längs). Für drei Kunden werden ' + a + ', ' + b + ' und ' + d + ' Paletten geladen. Wie viele Stellplätze bleiben frei?' + sg(['Rechne die Stellplätze: Ladelänge / 1,2 abgerundet mal Ladebreite / 0,8 abgerundet.', 'Zähle die geladenen Paletten zusammen.', 'Ziehe die Paletten von den Stellplätzen ab.']), v, 'Stellplätze', 'Freie Stellplätze', 0.01,
        'Stellplätze: ' + c.floorN(fz.l / 1.2) + ' · ' + c.floorN(fz.b / 0.8) + ' = ' + sp + '. Geladen: ' + a + ' + ' + b + ' + ' + d + ' = ' + (a + b + d) + '. Frei: ' + sp + ' − ' + (a + b + d) + ' = ' + v + '.', ['Erst die Stellplätze bestimmen.', 'Stellplätze minus geladene Paletten.']);
    },
    lade: pq(LADQ),
    /* ===== Zeitplanung und Lenkzeiten ===== */
    fz: R => {
      const c = C(), v = c.pick(R, [40, 50, 60, 75, 80]), d = c.ri(R, 4, 36) * 5, m = c.fahrMin(d, v);
      return numQ('Eine Strecke ist ' + d + ' km lang. Der Lkw fährt im Schnitt ' + v + ' km/h. Wie viele Minuten dauert die Fahrt?' + sg(['Teile die Strecke durch die Geschwindigkeit: das ergibt Stunden.', 'Multipliziere mit 60, dann hast du Minuten.', 'Runde auf ganze Minuten.']), m, 'min', 'Fahrzeit', 1,
        'Fahrzeit = ' + d + ' km / ' + v + ' km/h = ' + f(d / v, 3) + ' h. ' + f(d / v, 3) + ' · 60 = ' + f(m, 1) + ' min.', ['Zeit = Weg / Geschwindigkeit.', 'Stunden mal 60 ergibt Minuten.']);
    },
    ank: R => {
      const c = C(), st = c.pick(R, [360, 390, 420, 450]), v = c.pick(R, [50, 60]), d1 = c.ri(R, 4, 12) * 5, sm = c.pick(R, [15, 20, 25, 30]), d2 = c.ri(R, 3, 10) * 5;
      const m1 = Math.round(c.fahrMin(d1, v)), m2 = Math.round(c.fahrMin(d2, v)), an = st + m1 + sm + m2, right = hmT(an);
      const wrong = [hmT(an - sm), hmT(st + d1 / v * 100 + sm + d2 / v * 100), hmT(an + 15)].filter((x, i, a) => x !== right && a.indexOf(x) === i);
      while (wrong.length < 3) wrong.push(hmT(an - 10 * wrong.length - 5));
      return choiceQ(R, 'Abfahrt im Lager um ' + hmT(st) + '. Bis Kunde 1 sind es ' + d1 + ' km, dort entlädst du ' + sm + ' min. Von dort sind es ' + d2 + ' km bis Kunde 2. Durchschnittsgeschwindigkeit ' + v + ' km/h. Wann kommst du bei Kunde 2 an?' + sg(['Rechne die Fahrzeit bis Kunde 1 in Minuten.', 'Zähle die Standzeit bei Kunde 1 dazu.', 'Rechne die Fahrzeit bis Kunde 2 und zähle alles zur Abfahrtszeit.']), right, wrong,
        'Fahrt 1: ' + d1 + ' / ' + v + ' · 60 = ' + m1 + ' min. Standzeit: ' + sm + ' min. Fahrt 2: ' + d2 + ' / ' + v + ' · 60 = ' + m2 + ' min. Zusammen ' + (m1 + sm + m2) + ' min. ' + hmT(st) + ' + ' + c.dauer(m1 + sm + m2) + ' = ' + right + '.', ['Alle Zeiten in Minuten rechnen und am Ende zur Uhrzeit zählen.', 'Die Standzeit beim ersten Kunden nicht vergessen.']);
    },
    warte: R => {
      const c = C(), st = c.pick(R, [330, 345, 360, 375]), v = c.pick(R, [50, 60]), d = c.ri(R, 4, 12) * 5, m = Math.round(c.fahrMin(d, v)), an = st + m, von = Math.ceil((an + c.ri(R, 10, 50)) / 15) * 15, w = von - an;
      return numQ('Abfahrt im Lager um ' + hmT(st) + '. Der Kunde ist ' + d + ' km entfernt, Durchschnittsgeschwindigkeit ' + v + ' km/h. Er nimmt Ware erst ab ' + hmT(von) + ' an. Wie viele Minuten musst du warten?' + sg(['Rechne die Fahrzeit in Minuten.', 'Rechne die Ankunftszeit.', 'Ziehe die Ankunftszeit vom Beginn des Zeitfensters ab.']), w, 'min', 'Wartezeit', 0.01,
        'Fahrzeit: ' + d + ' / ' + v + ' · 60 = ' + m + ' min. Ankunft: ' + hmT(an) + '. Wartezeit bis ' + hmT(von) + ': ' + w + ' min. Besser: später abfahren oder einen anderen Kunden zuerst anfahren.', ['Ankunft = Abfahrt + Fahrzeit.', 'Wartezeit = Beginn Zeitfenster − Ankunft.']);
    },
    fenster: R => {
      const c = C();
      for (let t = 0; t < 200; t++) {
        const o = c.shuffle(R, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).slice(0, 3), st = 360, v = 60, sm = 20, ds = [c.ri(R, 4, 10) * 5, c.ri(R, 4, 10) * 5, c.ri(R, 4, 10) * 5];
        let tt = st; const an = ds.map(d => { tt += d; const a = tt; tt += sm; return a; });
        const bis = an.map(a => Math.round((a + c.pick(R, [-30, -15, 30, 45, 60])) / 15) * 15), late = an.map((a, i) => a > bis[i]);
        if (late.filter(Boolean).length !== 1) continue;
        const li = late.indexOf(true);
        return choiceQ(R, 'Abfahrt ' + hmT(st) + ', Durchschnittsgeschwindigkeit 60 km/h (1 km dauert 1 min), Standzeit je Kunde 20 min. Tour: L → ' + o[0] + ' ' + ds[0] + ' km → ' + o[1] + ' ' + ds[1] + ' km → ' + o[2] + ' ' + ds[2] + ' km. Annahme bis spätestens: ' + o.map((k, i) => k + ' ' + hmT(bis[i])).join(', ') + '. Bei welchem Kunden kommst du zu spät?' + sg(['Rechne die Ankunft beim ersten Kunden.', 'Zähle 20 min Standzeit und die nächste Fahrzeit dazu, und so weiter.', 'Vergleiche jede Ankunft mit dem Ende des Zeitfensters.']), 'Kunde ' + o[li], o.filter((_, i) => i !== li).map(k => 'Kunde ' + k).concat(['Bei keinem Kunden']),
          'Ankünfte: ' + o.map((k, i) => k + ' ' + hmT(an[i]) + (late[i] ? ' (zu spät, bis ' + hmT(bis[i]) + ')' : ' (passt)')).join(', ') + '. Zu spät bei Kunde ' + o[li] + '. Lösung: Reihenfolge ändern oder früher losfahren.', ['Bei 60 km/h sind km und Minuten gleich.', 'Standzeit bei jedem Kunden mitrechnen.']);
      }
      return G.warte(R);
    },
    pause: pq(ZEITQ),
    teil: R => {
      const c = C(), right = c.pick(R, [[15, 30], [20, 30], [15, 35], [25, 30]]), wrong = c.shuffle(R, [[30, 15], [10, 35], [25, 20], [20, 25], [40, 5]]).slice(0, 3);
      const t = p => 'erst ' + p[0] + ' min, später ' + p[1] + ' min';
      return choiceQ(R, 'Ein Fahrer will die Fahrtunterbrechung nach der EU-Verordnung 561/2006 teilen. Welche Aufteilung ist erlaubt?' + sg(['Merke die Regel: erster Teil mindestens 15 min, zweiter Teil mindestens 30 min.', 'Prüfe jede Antwort Teil für Teil.', 'Achte auf die Reihenfolge der Teile.']), t(right), wrong.map(t),
        'Erlaubt ist eine Teilung in mindestens 15 min und danach mindestens 30 min. ' + t(right) + ' erfüllt das. Die Reihenfolge zählt: 30 min und danach 15 min reicht nicht.', ['Der zweite Teil muss mindestens eine halbe Stunde lang sein.', 'Erster Teil mindestens 15 min.']);
    },
    pmin: R => {
      const c = C(), h = c.pick(R, [5, 6, 7.5, 8, 9, 10]), v = c.pauseMin(h * 60), n = v / 45;
      return numQ('Ein Fahrer hat heute ' + f(h) + ' h Lenkzeit vor sich' + (h > 9 ? ' (heute ist einer seiner zwei Tage mit 10 h)' : '') + '. Er macht nur ungeteilte Pausen von 45 min. Wie viele Minuten Fahrtunterbrechung muss er mindestens einplanen?' + sg(['Teile die Lenkzeit in Abschnitte von höchstens 4,5 h.', 'Zwischen zwei Abschnitten liegt je eine Pause von 45 min.', 'Zähle die Pausen und rechne sie in Minuten.']), v, 'min', 'Pausen', 0.01,
        f(h) + ' h Lenkzeit = ' + (n + 1) + ' Abschnitt(e) von höchstens 4,5 h. Dazwischen ' + n + ' Pause(n) · 45 min = ' + v + ' min.' + (h > 9 ? ' Nach 4,5 h und nach weiteren 4,5 h ist je eine Pause fällig.' : ''), ['Nach je 4,5 h Lenkzeit ist eine Pause fällig.', 'Nach der letzten Fahrt am Tag brauchst du keine Fahrtunterbrechung mehr.']);
    },
    tag: pq(ZEITQ),
    woche: R => {
      const c = C();
      for (let t = 0; t < 300; t++) {
        const d = [0, 1, 2, 3, 4].map(() => c.pick(R, [7, 8, 8.5, 9])), i10 = c.ri(R, 0, 4); d[i10] = 10;
        const sum = d.reduce((a, x) => a + x, 0), vor = c.ri(R, 36, 52), r = Math.min(56 - sum, 90 - vor - sum);
        if (!(r > 0 && r < 9) || Math.abs((56 - sum) - (90 - vor - sum)) < 1) continue;
        return numQ('Lenkzeiten eines Fahrers diese Woche: Montag ' + f(d[0]) + ' h, Dienstag ' + f(d[1]) + ' h, Mittwoch ' + f(d[2]) + ' h, Donnerstag ' + f(d[3]) + ' h, Freitag ' + f(d[4]) + ' h. In der Woche davor ist er ' + vor + ' h gefahren. Wie viele Stunden darf er am Samstag höchstens noch fahren?' + sg(['Zähle die Lenkzeit dieser Woche zusammen und vergleiche mit 56 h.', 'Zähle die Vorwoche dazu und vergleiche mit 90 h.', 'Der kleinere Rest ist die Antwort.']), r, 'h', 'Restlenkzeit', 0.01,
          'Diese Woche: ' + d.map(x => f(x)).join(' + ') + ' = ' + f(sum) + ' h. Rest bis 56 h: ' + f(56 - sum) + ' h. Doppelwoche: ' + vor + ' + ' + f(sum) + ' = ' + f(vor + sum) + ' h, Rest bis 90 h: ' + f(90 - vor - sum) + ' h. Es gilt der kleinere Rest: ' + f(r) + ' h.', ['Zwei Grenzen: 56 h je Woche und 90 h in zwei Wochen.', 'Rechne beide Reste und nimm den kleineren.']);
      }
      return G.pmin(R);
    },
    ruhe: R => {
      const c = C(), ende = c.pick(R, [16, 17, 18, 19, 20]) * 60 + c.pick(R, [0, 15, 30, 45]), right = hmT(ende + 660);
      return choiceQ(R, 'Ein Fahrer beendet seine Arbeit um ' + hmT(ende) + '. Er nimmt die regelmäßige tägliche Ruhezeit. Wann darf er am nächsten Tag frühestens wieder losfahren?' + sg(['Merke: regelmäßige tägliche Ruhezeit 11 h.', 'Zähle 11 h zum Arbeitsende.', 'Beachte den Tageswechsel um Mitternacht.']), right, [hmT(ende + 540), hmT(ende + 480), hmT(ende + 720)],
        hmT(ende) + ' + 11 h = ' + right + ' am nächsten Tag. Verkürzt auf 9 h wäre nur bis zu dreimal zwischen zwei wöchentlichen Ruhezeiten erlaubt.', ['Die regelmäßige Ruhezeit ist 11 h lang.', 'Uhrzeit plus 11 Stunden.']);
    },
    einsatz: R => {
      const c = C(), d = [c.ri(R, 10, 25) * 5, c.ri(R, 6, 18) * 5, c.ri(R, 6, 18) * 5, c.ri(R, 10, 25) * 5], sm = [c.pick(R, [20, 30, 40]), c.pick(R, [20, 30, 40]), c.pick(R, [20, 30, 40])];
      const fahrt = d.reduce((a, x) => a + x, 0), stand = sm.reduce((a, x) => a + x, 0), pau = c.pauseMin(fahrt), v = fahrt + stand + pau;
      return numQ('Tour mit drei Kunden bei 60 km/h (1 km dauert 1 min): L → K1 ' + d[0] + ' km, K1 → K2 ' + d[1] + ' km, K2 → K3 ' + d[2] + ' km, K3 → L ' + d[3] + ' km. Standzeiten: K1 ' + sm[0] + ' min, K2 ' + sm[1] + ' min, K3 ' + sm[2] + ' min. Wie lange dauert der Einsatz vom Losfahren bis zur Rückkehr, mit allen vorgeschriebenen Pausen?' + sg(['Zähle die Fahrzeiten zusammen (Lenkzeit).', 'Prüfe, ob die Lenkzeit über 4,5 h liegt: dann kommen 45 min Pause dazu. Standzeiten zählen nicht als Pause.', 'Zähle Lenkzeit, Standzeiten und Pausen zusammen.']), v, 'min', 'Einsatzzeit', 0.01,
        'Lenkzeit: ' + d.join(' + ') + ' = ' + fahrt + ' min (' + c.dauer(fahrt) + '). ' + (pau ? 'Das ist mehr als 4,5 h, also ' + pau + ' min Pause.' : 'Das sind höchstens 4,5 h, keine Pause nötig.') + ' Standzeiten: ' + sm.join(' + ') + ' = ' + stand + ' min. Einsatz: ' + fahrt + ' + ' + stand + ' + ' + pau + ' = ' + v + ' min (' + c.dauer(v) + ').', ['Einsatzzeit = Lenkzeit + Standzeiten + Pausen.', 'Entladen ist Arbeit, keine Pause.']);
    },
    stpause: pq(ZEITQ),
    /* ===== Kosten ===== */
    kmk: R => {
      const c = C(), k = c.ri(R, 8, 60) * 5, s = c.pick(R, [0.35, 0.45, 0.55, 0.7, 0.85, 1.1]), v = k * s;
      return numQ('Eine Tour ist ' + k + ' km lang. Der Kilometersatz (Kraftstoff, Reifen, Wartung, Maut) beträgt ' + f(s) + ' € je km. Wie hoch sind die Kilometerkosten?' + sg(['Nimm die Länge der Tour in km.', 'Multipliziere mit dem Kilometersatz.', 'Gib das Ergebnis in € an.']), v, '€', 'Kilometerkosten', 0.01,
        k + ' km · ' + f(s) + ' €/km = ' + f(v) + ' €.', ['Kilometerkosten hängen von der Strecke ab.', 'Strecke mal Kilometersatz.']);
    },
    zk: R => {
      const c = C(), h = c.pick(R, [4.5, 5.25, 6, 6.5, 7.75, 8.5, 9]), s = c.pick(R, [32, 36, 38, 42, 45]), v = h * s;
      return numQ('Ein Einsatz dauert ' + f(h) + ' h (Fahren, Warten, Entladen, Pausen). Der Stundensatz (Fahrerlohn und zeitabhängige Fahrzeugkosten) beträgt ' + s + ' € je Stunde. Wie hoch sind die Zeitkosten?' + sg(['Nimm die Einsatzzeit in Stunden (Dezimalzahl).', 'Multipliziere mit dem Stundensatz.', 'Gib das Ergebnis in € an.']), v, '€', 'Zeitkosten', 0.01,
        f(h) + ' h · ' + s + ' €/h = ' + f(v) + ' €.', ['Zeitkosten hängen von der Einsatzzeit ab.', 'Stunden mal Stundensatz.']);
    },
    tourk: R => {
      const c = C(), fz = c.pick(R, c.FZG), k = c.ri(R, 20, 70) * 5, h = c.pick(R, [5, 5.5, 6.25, 7, 8, 8.5]), v = c.tourKosten(k, fz.kmS, h, fz.hS);
      return numQ('Der ' + fz.n + ' fährt eine Tour von ' + k + ' km, der Einsatz dauert ' + f(h) + ' h. Kilometersatz ' + f(fz.kmS) + ' €/km, Stundensatz ' + fz.hS + ' €/h. Wie hoch sind die Kosten der Tour?' + sg(['Rechne die Kilometerkosten: km · Kilometersatz.', 'Rechne die Zeitkosten: Stunden · Stundensatz.', 'Zähle beide zusammen.']), v, '€', 'Tourkosten', 0.01,
        'Kilometerkosten: ' + k + ' · ' + f(fz.kmS) + ' = ' + f(k * fz.kmS) + ' €. Zeitkosten: ' + f(h) + ' · ' + fz.hS + ' = ' + f(h * fz.hS) + ' €. Tour: ' + f(v) + ' €.', ['Zwei Kostenarten: nach Strecke und nach Zeit.', 'Tourkosten = km · Satz + h · Satz.']);
    },
    palk: R => {
      const c = C(), k = c.ri(R, 180, 620), p = c.ri(R, 4, 18), v = k / p;
      return numQ('Eine Tour kostet ' + f(k) + ' €. Ausgeliefert werden ' + p + ' Paletten. Wie hoch sind die Kosten je Palette?' + sg(['Nimm die Tourkosten.', 'Teile sie durch die Zahl der Paletten.', 'Runde auf zwei Stellen nach dem Komma (Cent).']), v, '€', 'Kosten je Palette', 0.01,
        f(k) + ' € / ' + p + ' = ' + f(v) + ' € je Palette.', ['Kosten je Stück = Gesamtkosten / Stückzahl.', 'Auf Cent runden.']);
    },
    sped: R => {
      const c = C(), fz = c.FZG[1], k = c.ri(R, 20, 50) * 5, h = c.pick(R, [5, 6, 7, 8]), p = c.ri(R, 6, 15), pr = c.pick(R, [28, 32, 35, 38, 42]);
      const eig = c.tourKosten(k, fz.kmS, h, fz.hS), sp = c.spedKosten(p, pr), v = Math.abs(eig - sp);
      if (v < 1) return G.palk(R);
      return numQ('Eigener ' + fz.n + ': ' + k + ' km zu ' + f(fz.kmS) + ' €/km und ' + h + ' h zu ' + fz.hS + ' €/h. Ein Spediteur würde die ' + p + ' Paletten für ' + pr + ' € je Palette fahren. Wie viel € spart die günstigere Lösung gegenüber der teureren?' + sg(['Rechne die Kosten der eigenen Tour (km-Kosten + Zeitkosten).', 'Rechne den Preis des Spediteurs (Paletten · Preis).', 'Ziehe den kleineren vom größeren Betrag ab.']), v, '€', 'Ersparnis', 0.01,
        'Eigene Tour: ' + k + ' · ' + f(fz.kmS) + ' + ' + h + ' · ' + fz.hS + ' = ' + f(eig) + ' €. Spediteur: ' + p + ' · ' + pr + ' = ' + f(sp) + ' €. ' + (eig < sp ? 'Die eigene Tour' : 'Der Spediteur') + ' ist um ' + f(v) + ' € günstiger.', ['Vergleiche zwei Gesamtbeträge.', 'Ersparnis = teurer − günstiger.']);
    },
    abpal: R => {
      const c = C(), k = c.ri(R, 30, 90) * 5 + c.pick(R, [0, 2.5]), pr = c.pick(R, [26, 30, 34, 38, 45]), v = c.abPaletten(k, pr);
      return numQ('Die eigene Tour kostet ' + f(k) + ' €, egal ob der Lkw halb oder ganz voll ist. Der Spediteur nimmt ' + pr + ' € je Palette. Ab wie vielen Paletten ist die eigene Tour günstiger?' + sg(['Teile die Tourkosten durch den Preis je Palette.', 'Bei so vielen Paletten kosten beide etwa gleich viel.', 'Die nächste ganze Zahl darüber ist die Antwort.']), v, 'Paletten', 'Paletten', 0.01,
        f(k) + ' / ' + pr + ' = ' + f(k / pr) + '. Ab ' + v + ' Paletten ist der Spediteur teurer (' + v + ' · ' + pr + ' = ' + f(v * pr) + ' € > ' + f(k) + ' €), also lohnt dann die eigene Tour.', ['Bei wie vielen Paletten kosten beide gleich viel?', 'Danach die nächste ganze Palette nehmen.']);
    },
    leer: R => {
      const c = C(), g = c.ri(R, 24, 60) * 5, l = c.ri(R, 4, Math.floor(g / 15)) * 5, v = c.leerAnteil(l, g);
      return numQ('Eine Tour ist ' + g + ' km lang. Nach dem letzten Kunden fährt der Lkw ' + l + ' km leer zurück ins Lager. Wie viel Prozent der Strecke sind Leerkilometer?' + sg(['Nimm die Leerkilometer.', 'Teile durch die Gesamtstrecke.', 'Multipliziere mit 100.']), v, '%', 'Leeranteil', 0.1,
        l + ' / ' + g + ' · 100 = ' + f(v, 1) + ' %. Leerkilometer kosten Geld, bringen aber nichts ein. Mit einer Rückladung (z. B. Abholung beim Lieferer) sinkt der Anteil.', ['Anteil = Teil / Ganzes · 100.', 'Leerkilometer durch alle Kilometer.']);
    },
    auslk: pq(KOSTQ)
  };

  /* Aufgabenliste: Kategorie, Stufe, Titel (neutral), Generator, Argument */
  const defs = [
    ['Touren bilden', 1, 'Zwei Wege vergleichen', 'karte'], ['Touren bilden', 1, 'Länge einer Rundtour', 'rund'], ['Touren bilden', 1, 'Erster Halt der Tour', 'nn1'], ['Touren bilden', 2, 'Reihenfolge nach dem nächsten Nachbarn', 'nn'], ['Touren bilden', 2, 'Strecke der Nachbar-Tour', 'nnkm'], ['Touren bilden', 3, 'Vorschlag und Verfahren vergleichen', 'vgl'], ['Touren bilden', 1, 'Arten von Touren', 'tourart', [0, 1]], ['Touren bilden', 2, 'Grenzen der Planung', 'tourart', [2, 3, 4]],
    ['Fahrzeug wählen', 1, 'Palettenstellplätze', 'stell'], ['Fahrzeug wählen', 1, 'Lademeter für Paletten', 'ldm'], ['Fahrzeug wählen', 2, 'Lademeter für Kisten', 'ldm2'], ['Fahrzeug wählen', 1, 'Nutzlast bestimmen', 'nutz'], ['Fahrzeug wählen', 2, 'Gewicht prüfen', 'ueber'], ['Fahrzeug wählen', 2, 'Ladevolumen', 'vol'], ['Fahrzeug wählen', 2, 'Passendes Fahrzeug', 'wahl'], ['Fahrzeug wählen', 3, 'Was wird zuerst knapp', 'ausl'], ['Fahrzeug wählen', 2, 'Achsen und Verteilung', 'achs', [1, 2]],
    ['Ladereihenfolge', 1, 'Was kommt zuerst hinein', 'lifo1'], ['Ladereihenfolge', 1, 'Was steht an der Tür', 'heck'], ['Ladereihenfolge', 2, 'Ganze Ladereihenfolge', 'lifo2'], ['Ladereihenfolge', 3, 'Falsch geladen', 'umsetz'], ['Ladereihenfolge', 2, 'Freie Stellplätze', 'rest'], ['Ladereihenfolge', 2, 'Schwer und leicht verteilen', 'lade', [0]], ['Ladereihenfolge', 1, 'Zuletzt hinein', 'lade', [1]],
    ['Zeitplanung und Lenkzeiten', 1, 'Fahrzeit berechnen', 'fz'], ['Zeitplanung und Lenkzeiten', 2, 'Ankunft beim zweiten Kunden', 'ank'], ['Zeitplanung und Lenkzeiten', 2, 'Zu früh beim Kunden', 'warte'], ['Zeitplanung und Lenkzeiten', 3, 'Zeitfenster prüfen', 'fenster'], ['Zeitplanung und Lenkzeiten', 1, 'Wann ist Pause', 'pause', [0]], ['Zeitplanung und Lenkzeiten', 2, 'Pause teilen', 'teil'], ['Zeitplanung und Lenkzeiten', 2, 'Pausen einplanen', 'pmin'], ['Zeitplanung und Lenkzeiten', 1, 'Lenkzeit am Tag und in der Woche', 'tag', [1, 2]], ['Zeitplanung und Lenkzeiten', 3, 'Rest der Wochenlenkzeit', 'woche'], ['Zeitplanung und Lenkzeiten', 2, 'Ruhezeit und Neustart', 'ruhe'], ['Zeitplanung und Lenkzeiten', 3, 'Dauer des Einsatzes', 'einsatz'], ['Zeitplanung und Lenkzeiten', 2, 'Entladen oder Pause', 'stpause', [4]],
    ['Kosten', 1, 'Kosten nach Strecke', 'kmk'], ['Kosten', 1, 'Kosten nach Zeit', 'zk'], ['Kosten', 2, 'Kosten einer Tour', 'tourk'], ['Kosten', 2, 'Kosten je Palette', 'palk'], ['Kosten', 3, 'Eigener Lkw oder Spediteur', 'sped'], ['Kosten', 3, 'Ab wann lohnt die eigene Tour', 'abpal'], ['Kosten', 2, 'Leere Kilometer', 'leer'], ['Kosten', 1, 'Auslastung und Kosten', 'auslk']
  ];
  const tasks = defs.map((d, i) => ({ id: 'tou' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  function make(t, R) { const q = G[t.gen](R, t.arg); if (!q.fig && FIG[t.gen]) q.fig = { art: FIG[t.gen] }; q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  function makeTask(t) { return make(t, C().rng('tou-' + t.id)); }
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele für den Tourenplaner (Laden in den Planer) ---------- */
  const examples = [
    { id: 'kurz', title: 'Kürzeste Strecke, alle acht Kunden', text: 'Der Sattelzug fährt alle Kunden in der kürzesten Reihenfolge. Die Strecke ist kurz, aber passt sie zu den Zeitfenstern?', p: { order: ['B', 'A', 'H', 'G', 'F', 'E', 'D', 'C'], fz: 's40', start: 360 } },
    { id: 'fenster', title: 'Nach Zeitfenstern geplant', text: 'Erst die Frühkunden E und H, dann im Uhrzeigersinn. Die Strecke wird länger, dafür passen alle Zeitfenster. Die Lenkzeit bleibt knapp unter 4,5 h. Stell die Geschwindigkeit auf 50 km/h: Wo kommt jetzt die Pause?', p: { order: ['E', 'H', 'A', 'B', 'C', 'D', 'F', 'G'], fz: 's40', start: 360 } },
    { id: 'zwei', title: 'Zwei kleine Touren statt einer großen', text: 'Nord-West-Tour mit dem Lkw 7,5 t: H, A, B, C. Zu viel Gewicht? Probiere selbst, ob der Lkw 12 t nötig ist.', p: { order: ['H', 'A', 'B', 'C'], fz: 'l75', start: 420 } }
  ];

  root.TOU_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, pools: { TOURQ, FZQ, LADQ, ZEITQ, KOSTQ } };
  root.TOU_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.TOU_DATA, TASKS: root.TOU_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
