'use strict';
/* Tonfunk Lager-Lab: Daten (Aufgaben-Generatoren, Beispiele, Lagerarten, Hilfe-Begriffe).
   window.LAG_DATA  { cats, tasks, gens, make(t, R), examples, org }
   window.LAG_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'lag', Status in localStorage 'lm4.lag.done' = {id:true})
   Jede Aufgabe entsteht aus einem Generator mit festem Seed (id) – dieselben Zahlen bei jedem Aufruf; der Zufalls-Trainer nutzt dieselben Generatoren mit freiem Seed. */
(function (root) {
  const C = () => root.LAG_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const eur = v => f(v, 2) + ' €';
  const CATS = ['Kennzahlen', 'Disposition', 'Bestellmenge', 'ABC-Analyse', 'Lagerorganisation'];

  /* Zahlenfrage: value = Sollwert, tol = erlaubte Abweichung (absolut) */
  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong));
    return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const rel = (v, p) => Math.max(0.01, Math.abs(v) * (p == null ? 0.005 : p));

  /* Andler-Zahlen mit glatter Lösung: sucht D, K, P, q so, dass m_opt eine ganze Zahl ist. */
  function andlerSet(R) {
    const c = C();
    for (let i = 0; i < 400; i++) {
      const m = c.pick(R, [100, 150, 200, 250, 300, 400, 500, 600]), K = c.pick(R, [20, 25, 30, 40, 50, 60, 80]), P = c.pick(R, [5, 8, 10, 16, 20, 25, 40, 50]), q = c.pick(R, [10, 12, 15, 16, 20, 25]);
      const D = m * m * P * q / (200 * K);
      if (Number.isInteger(D) && D >= 1000 && D <= 60000 && D % 100 === 0) return { D, K, P, q, m };
    }
    return { D: 8000, K: 40, P: 25, q: 16, m: 400 };
  }
  const NAMES = ['Schrauben M8', 'Gehäuse', 'Kabelbaum', 'Netzteil', 'Platine', 'Lüfter', 'Display', 'Akku', 'Dichtung', 'Karton', 'Etiketten', 'Folie'];

  /* ABC-Aufgabenliste: Anteile in % (Summe 100), Gesamtwert ein Vielfaches von 1000 €, Preis teilt jeden Wert glatt */
  const SHARES = [[52, 26, 10, 6, 4, 2], [60, 18, 10, 6, 4, 2], [45, 30, 10, 8, 5, 2], [55, 25, 9, 6, 3, 2]];
  function abcSet(R) {
    const c = C(), sh = c.pick(R, SHARES), total = c.ri(R, 10, 50) * 1000, names = c.shuffle(R, NAMES).slice(0, 6), items = [];
    sh.forEach((s, i) => { const v = s * total / 100, price = c.pick(R, [2, 5, 10]); items.push({ name: names[i], qty: v / price, price }); });
    return { items: c.shuffle(R, items), total };
  }
  const itemsText = items => items.map(it => it.name + ': ' + f(it.qty, 0) + ' Stück zu ' + eur(it.price)).join('; ');

  /* ---------- Lagerarten und Strategien (auch für den Reiter "Lager" und die Zuordnungsübung) ---------- */
  const ORG = [
    { g: 'Lagerprinzipien', n: 'FIFO (first in, first out)', d: 'Die zuerst eingelagerte Ware wird zuerst entnommen.', pro: ['Ware veraltet nicht, Mindesthaltbarkeit bleibt gewahrt', 'Gut für verderbliche oder datierte Ware'], con: ['Organisation und Platzbedarf höher (Durchlaufregal, Kennzeichnung)'] },
    { g: 'Lagerprinzipien', n: 'LIFO (last in, first out)', d: 'Die zuletzt eingelagerte Ware wird zuerst entnommen.', pro: ['Einfach und platzsparend (Blocklager, Schüttgut)', 'Kurze Wege, kein Umräumen nötig'], con: ['Ältere Ware bleibt liegen, Verderb- und Alterungsrisiko'] },
    { g: 'Lagerprinzipien', n: 'Chaotische Lagerhaltung', d: 'Ware kommt auf einen beliebigen freien Platz; das Lagerverwaltungssystem (EDV) merkt sich den Ort.', pro: ['Sehr gute Raumausnutzung', 'Flexibel bei wechselnden Mengen'], con: ['Ohne EDV nicht beherrschbar, bei Systemausfall unübersichtlich', 'Höherer Aufwand für Software und Scanner'] },
    { g: 'Lagerprinzipien', n: 'Festplatzlagerung', d: 'Jeder Artikel hat seinen festen Lagerplatz.', pro: ['Übersichtlich, Ort ist leicht zu merken', 'Auch ohne EDV gut zu führen'], con: ['Schlechte Raumausnutzung, leere Plätze bleiben reserviert'] },
    { g: 'Lagerarten', n: 'Blocklager', d: 'Paletten oder Packstücke werden ohne Regal direkt auf dem Boden gestapelt.', pro: ['Sehr geringe Investition', 'Gute Flächenausnutzung bei großen Mengen gleicher Ware'], con: ['Kein Zugriff auf einzelne Paletten (meist LIFO)', 'Gefahr für unten stehende Ware durch Stapeldruck'] },
    { g: 'Lagerarten', n: 'Regallager', d: 'Ware steht in Regalen (z. B. Palettenregal, Fachbodenregal) mit direktem Zugriff auf jeden Platz.', pro: ['Zugriff auf jede Palette oder Ware', 'Höhe wird genutzt, FIFO möglich'], con: ['Höhere Kosten als Blocklager', 'Gassen brauchen Platz'] },
    { g: 'Lagerarten', n: 'Hochregallager', d: 'Sehr hohe Regale (oft über 12 m), bedient von Regalbediengeräten, häufig automatisch.', pro: ['Beste Raumausnutzung in der Höhe', 'Hohe Umschlagleistung, wenig Personal'], con: ['Sehr hohe Investition', 'Wenig flexibel, bei Ausfall steht der Betrieb'] },
    { g: 'Flurförderzeuge', n: 'Hubwagen (Handhub- oder Elektro-Deichselhubwagen)', d: 'Transportiert Paletten ebenerdig über kurze Strecken, hebt nur wenige Zentimeter.', pro: ['Günstig, wendig, einfach zu bedienen'], con: ['Kein Einlagern in Regale, bei Handhub kraftaufwendig'] },
    { g: 'Flurförderzeuge', n: 'Gegengewichtsstapler (Frontstapler)', d: 'Hebt Paletten auf Regalhöhe und belädt Fahrzeuge; das Gegengewicht hinten gleicht die Last vorn aus.', pro: ['Vielseitig innen und außen, hohe Tragkraft'], con: ['Braucht breite Gänge, Staplerschein nötig'] },
    { g: 'Flurförderzeuge', n: 'Schubmaststapler', d: 'Fährt in schmalen Gängen; der Mast mit Gabel schiebt nach vorn und hebt die Last in Regalhöhe.', pro: ['Schmalere Gänge als Frontstapler, gute Hubhöhe'], con: ['Nur für ebenen Hallenboden, teurer als Hubwagen'] }
  ];
  /* PRUEFEN: Hubhöhen und Gangbreiten der Flurförderzeuge sind bewusst nicht als Zahlen genannt; Herstellerangaben und Lehrmaterial vergleichen. */

  /* Pool für Lagerorganisations-Fragen: [Text, richtig, falsch[], Erklärung, Tipps] */
  const ORGQ = [
    ['In einem Lager liegen Joghurtbecher mit Mindesthaltbarkeitsdatum. Nach welchem Prinzip soll die Ware entnommen werden?', 'FIFO: zuerst Eingelagertes zuerst entnehmen', ['LIFO: zuletzt Eingelagertes zuerst entnehmen', 'Chaotisch: nach Gefühl des Lagermitarbeiters', 'Festplatz: Hauptsache der Artikel steht am selben Ort'], 'Bei Ware mit Haltbarkeitsdatum muss die älteste Ware zuerst raus: FIFO (first in, first out).', ['Es geht um Ware, die verderben kann.', 'Welche Ware ist am längsten im Lager? Die muss zuerst weg.']],
    ['Sand wird in einer Halde aufgeschüttet und immer von oben entnommen. Welches Prinzip entsteht dabei von selbst?', 'LIFO: zuletzt Eingelagertes zuerst entnommen', ['FIFO: zuerst Eingelagertes zuerst entnommen', 'Chaotische Lagerhaltung mit freien Plätzen nach System', 'Festplatzlagerung mit festen Plätzen je Artikel'], 'Was zuletzt oben liegt, wird zuerst genommen: LIFO. Bei Schüttgut und Blocklagern ist das typisch und unkritisch, weil die Ware nicht verdirbt.', ['Wo liegt der zuletzt aufgeschüttete Sand?', 'Entnommen wird oben, also zuerst das, was als Letztes kam.']],
    ['Ein Lager nutzt jeden freien Platz für ankommende Ware. Das Lagerverwaltungssystem speichert, wo was liegt. Wie heißt dieses Prinzip?', 'Chaotische Lagerhaltung', ['Festplatzlagerung mit festen Plätzen', 'FIFO-Lagerung', 'Blocklagerung auf dem Boden'], 'Bei der chaotischen Lagerhaltung gibt es keine festen Plätze. Das spart Fläche, funktioniert aber nur mit EDV-Unterstützung.', ['Es gibt keine festen Plätze.', 'Wer weiß, wo die Ware liegt? Das System.']],
    ['Welcher Vorteil gehört zur Festplatzlagerung?', 'Der Lagerort ist leicht zu merken und auch ohne EDV auffindbar', ['Beste Raumausnutzung, weil jeder freie Platz für jede Ware genutzt wird', 'Die Ware wird automatisch nach ihrem Haltbarkeitsdatum sortiert', 'Es sind keine Regale nötig, weil alles am Boden gestapelt wird'], 'Feste Plätze sind übersichtlich. Nachteil: Plätze bleiben reserviert, auch wenn sie leer sind, daher schlechte Raumausnutzung.', ['Denke an den Gegensatz zur chaotischen Lagerhaltung.', 'Jeder Artikel hat seinen Platz, also weiß man, wo er liegt.']],
    ['Ein Lager ist sehr hoch (über 12 m), wird von Regalbediengeräten bedient und hat hohe Investitionskosten. Welche Lagerart ist das?', 'Hochregallager', ['Blocklager', 'Freilager', 'Fachbodenregal'], 'Das Hochregallager nutzt die Höhe optimal aus, braucht aber hohe Investitionen und ist wenig flexibel.', ['Welche Lagerart baut in die Höhe?', 'Regalbediengeräte fahren in den Regalgassen.']],
    ['Eine Palette soll ebenerdig über 40 m von der Rampe zum Bereitstellplatz gefahren werden, ohne Regal. Welches Flurförderzeug reicht?', 'Hubwagen (z. B. Deichselhubwagen)', ['Hochregal-Bediengerät mit Teleskopgabel', 'Brückenkran an der Hallendecke', 'Gegengewichtsstapler mit 6 m Hubhöhe'], 'Für kurze, ebene Transporte genügt der Hubwagen: günstig und wendig. Für Regale braucht man einen Stapler.', ['Muss die Palette hoch gehoben werden?', 'Nein, nur transportieren. Welches Gerät hebt nur wenige Zentimeter?']],
    ['Paletten stehen in Reihen auf dem Boden, drei Paletten hoch, ohne Regale. Welche Aussage stimmt?', 'Gute Flächenausnutzung, aber nicht jede Palette ist direkt erreichbar', ['Jede Palette ist jederzeit ohne Umräumen einzeln erreichbar', 'FIFO ist auch ohne Umräumen jederzeit sicher möglich', 'Es sind sehr hohe Investitionen in Regale und Technik nötig'], 'Das Blocklager ist günstig, hat aber meist LIFO und keinen Einzelzugriff.', ['Welche Lagerart hat keine Regale?', 'Wer unten steht, kommt nur nach Umräumen heraus.']],
    ['Paletten sollen in Regale bis 6 m Höhe eingelagert und Lkw beladen werden. Welches Flurförderzeug passt?', 'Gegengewichtsstapler (Frontstapler)', ['Handhubwagen mit langer Gabel', 'Förderband ohne Hubfunktion zum Lkw', 'Rollwagen mit Handschiebegriff'], 'Der Frontstapler hebt auf Regalhöhe und eignet sich auch zum Be- und Entladen von Lkw.', ['Der Hubwagen hebt nicht hoch genug.', 'Welches Fahrzeug hat vorn die Gabel und hinten ein Gegengewicht?']],
    ['Beim Wareneingang fällt ein sichtbar eingedrückter Karton auf. Der Lieferschein stimmt mit der Bestellung überein. Was ist zuerst richtig?', 'Schaden dokumentieren und auf dem Lieferschein vom Fahrer bestätigen lassen', ['Karton annehmen und den Schaden erst melden, wenn die Ware eingelagert wird', 'Lieferschein ohne Anmerkung quittieren, weil Bestellung und Menge stimmen', 'Den Karton still aussortieren und ohne Rückfrage im Müll entsorgen'], 'Sichtbare Mängel müssen sofort festgehalten werden, am besten mit Foto und Vermerk auf dem Lieferschein, solange der Fahrer noch da ist. Ohne Vermerk ist ein späterer Anspruch schwer durchzusetzen.', ['Wer soll den Schaden bestätigen, solange er noch vor Ort ist?', 'Ein Vermerk auf dem Lieferschein dient später als Nachweis.']]
  ];
  /* PRUEFEN: Hubhöhe 6 m und Grenze 12 m für das Hochregallager sind übliche Richtwerte, keine Norm. */
  const ORG_TASK_IDX = [0, 1, 2, 4, 5];

  /* ---------- Generatoren ---------- */
  const G = {
    avg2: R => {
      const c = C(), ab = c.ri(R, 8, 30) * 1000, eb = c.ri(R, 8, 30) * 1000, v = (ab + eb) / 2;
      return numQ('Zu Beginn des Jahres lagen Waren im Wert von ' + eur(ab) + ' im Lager, am Jahresende im Wert von ' + eur(eb) + '. Berechne den durchschnittlichen Lagerbestand.', v, '€', 'Durchschnittlicher Lagerbestand', 1,
        'Durchschnittlicher Lagerbestand = (Jahresanfangsbestand + Jahresendbestand) / 2 = (' + f(ab, 0) + ' + ' + f(eb, 0) + ') / 2 = ' + eur(v) + '.', ['Du brauchst den Mittelwert aus Anfangs- und Endbestand.', 'Addiere beide Bestände und teile durch 2.']);
    },
    avg13: R => {
      const c = C(), ab = c.ri(R, 10, 40) * 1000, mo = []; for (let i = 0; i < 12; i++) mo.push(c.ri(R, 10, 40) * 1000);
      const s = ab + mo.reduce((a, b) => a + b, 0), v = c.rd(s / 13, 0);
      return numQ('Der Jahresanfangsbestand betrug ' + eur(ab) + '. Die Monatsendbestände von Januar bis Dezember: ' + mo.map(x => f(x, 0)).join('; ') + ' €. Berechne den durchschnittlichen Lagerbestand aus den 13 Werten (Anfangsbestand und 12 Monatsendbestände), gerundet auf ganze Euro.', v, '€', 'Durchschnittlicher Lagerbestand', 1,
        'Summe aller 13 Werte = ' + f(s, 0) + ' €. Durchschnitt = ' + f(s, 0) + ' / 13 = ' + eur(s / 13) + ', gerundet ' + f(v, 0) + ' €.', ['Zähle die Werte: Anfangsbestand plus 12 Monatsendbestände sind 13 Werte.', 'Alle Werte addieren und durch 13 teilen (nicht durch 12).']);
    },
    turn: R => {
      const c = C(), U = c.pick(R, [3, 4, 5, 6, 8, 10, 12]), av = c.ri(R, 5, 25) * 1000, use = U * av;
      return numQ('Der Wareneinsatz eines Jahres beträgt ' + eur(use) + ', der durchschnittliche Lagerbestand ' + eur(av) + '. Berechne die Umschlagshäufigkeit.', U, 'mal', 'Umschlagshäufigkeit', 0.01,
        'Umschlagshäufigkeit = Jahresverbrauch / durchschnittlicher Lagerbestand = ' + f(use, 0) + ' / ' + f(av, 0) + ' = ' + f(U, 0) + '. Das Lager wird ' + U + '-mal im Jahr umgeschlagen.', ['Die Formel: Verbrauch geteilt durch Durchschnittsbestand.', 'Beide Werte stehen in Euro, das Ergebnis ist eine Zahl ohne Einheit (mal pro Jahr).']);
    },
    days: R => {
      const c = C(), U = c.pick(R, [4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24]), d = 360 / U;
      return numQ('Die Umschlagshäufigkeit eines Artikels beträgt ' + U + '. Berechne die durchschnittliche Lagerdauer in Tagen (Jahr mit 360 Tagen).', d, 'Tage', 'Durchschnittliche Lagerdauer', 0.5,
        'Durchschnittliche Lagerdauer = 360 / Umschlagshäufigkeit = 360 / ' + U + ' = ' + f(d, 0) + ' Tage.', ['Im Lager rechnet man mit 360 Tagen je Jahr.', '360 geteilt durch die Umschlagshäufigkeit.']);
    },
    turndays: R => {
      const c = C(), U = c.pick(R, [4, 5, 6, 8, 9, 10, 12, 15]), av = c.ri(R, 10, 40) * 1000, dl = c.ri(R, 1, 4) * 1000, ab = av - dl, eb = av + dl, use = U * av, d = 360 / U;
      return numQ('Anfangsbestand ' + eur(ab) + ', Endbestand ' + eur(eb) + ', Wareneinsatz im Jahr ' + eur(use) + '. Wie lange liegt die Ware im Durchschnitt im Lager?', d, 'Tage', 'Durchschnittliche Lagerdauer', 0.5,
        'Ø Lagerbestand = (' + f(ab, 0) + ' + ' + f(eb, 0) + ') / 2 = ' + eur(av) + '. Umschlagshäufigkeit = ' + f(use, 0) + ' / ' + f(av, 0) + ' = ' + U + '. Lagerdauer = 360 / ' + U + ' = ' + f(d, 0) + ' Tage.', ['Drei Schritte: Durchschnittsbestand, Umschlagshäufigkeit, Lagerdauer.', 'Erst (Anfang + Ende) / 2, dann Wareneinsatz / Durchschnitt, dann 360 / Umschlagshäufigkeit.']);
    },
    costrate: R => {
      const c = C(), av = c.ri(R, 10, 50) * 1000, p = c.pick(R, [5, 8, 10, 12, 15, 20]), k = av * p / 100;
      return numQ('Die jährlichen Lagerkosten (Miete, Personal, Strom, Versicherung) betragen ' + eur(k) + ', der durchschnittliche Lagerbestand ' + eur(av) + '. Berechne den Lagerkostensatz.', p, '%', 'Lagerkostensatz', 0.01,
        'Lagerkostensatz = Lagerkosten / Ø Lagerbestand · 100 = ' + f(k, 0) + ' / ' + f(av, 0) + ' · 100 = ' + f(p, 0) + ' %.', ['Wie viel Prozent des Lagerbestands kosten die Lagerkosten?', 'Lagerkosten durch Durchschnittsbestand, mal 100.']);
    },
    zinssatz: R => {
      const c = C(), r = c.pick(R, [3, 4, 5, 6, 8, 9, 10, 12]), d = c.pick(R, [30, 45, 60, 72, 90, 120]), v = r * d / 360;
      return numQ('Der Jahreszinssatz für gebundenes Kapital beträgt ' + r + ' %, die durchschnittliche Lagerdauer ' + d + ' Tage. Berechne den Lagerzinssatz in % (zwei Nachkommastellen).', v, '%', 'Lagerzinssatz', 0.01,
        'Lagerzinssatz = Jahreszinssatz · Lagerdauer / 360 = ' + r + ' % · ' + d + ' / 360 = ' + f(v, 2) + ' %.', ['Der Jahreszins gilt für 360 Tage, die Ware liegt aber nur kürzer im Lager.', 'Jahreszinssatz mal Lagerdauer, geteilt durch 360.']);
    },
    holding: R => {
      const c = C(), av = c.ri(R, 10, 40) * 1000, p1 = c.pick(R, [8, 10, 12, 15]), r = c.pick(R, [4, 5, 6, 8]), k = av * p1 / 100, z = av * r / 100, v = p1 + r;
      return numQ('Durchschnittlicher Lagerbestand ' + eur(av) + ', Lagerkosten im Jahr ' + eur(k) + ', Lagerzinsen im Jahr ' + eur(z) + '. Berechne den Lagerhaltungskostensatz.', v, '%', 'Lagerhaltungskostensatz', 0.01,
        'Lagerhaltungskostensatz = (Lagerkosten + Lagerzinsen) / Ø Lagerbestand · 100 = (' + f(k, 0) + ' + ' + f(z, 0) + ') / ' + f(av, 0) + ' · 100 = ' + f(v, 0) + ' %.', ['Lagerkosten und Lagerzinsen werden zusammengezählt.', 'Summe durch den Durchschnittsbestand, mal 100.']);
    },
    zins: R => {
      const c = C(), U = c.pick(R, [4, 5, 6, 8, 10, 12]), av = c.ri(R, 10, 40) * 1000, r = c.pick(R, [4, 5, 6, 8]), use = U * av, d = 360 / U, lz = r * d / 360, z = use * lz / 100;
      return numQ('Wareneinsatz ' + eur(use) + ' im Jahr, durchschnittlicher Lagerbestand ' + eur(av) + ', Jahreszinssatz ' + r + ' %. Berechne die jährlichen Lagerzinsen in Euro (über Umschlagshäufigkeit, Lagerdauer und Lagerzinssatz).', z, '€', 'Lagerzinsen je Jahr', 1,
        'Umschlagshäufigkeit = ' + f(use, 0) + ' / ' + f(av, 0) + ' = ' + U + '; Lagerdauer = 360 / ' + U + ' = ' + f(d, 0) + ' Tage; Lagerzinssatz = ' + r + ' % · ' + f(d, 0) + ' / 360 = ' + f(lz, 2) + ' %; Lagerzinsen = ' + f(use, 0) + ' € · ' + f(lz, 2) + ' % = ' + eur(z) + '. Kontrolle: ' + f(av, 0) + ' € · ' + r + ' % ergibt dasselbe.', ['Der Weg: Umschlagshäufigkeit, dann Lagerdauer, dann Lagerzinssatz.', 'Lagerzinsen = Wareneinsatz mal Lagerzinssatz / 100. Kontrolle: Durchschnittsbestand mal Jahreszins.']);
    },
    meld: R => {
      const c = C(), d = c.ri(R, 1, 16) * 5, L = c.ri(R, 3, 14), s = c.ri(R, 1, 6) * 10, v = d * L + s;
      return numQ('Tagesverbrauch ' + d + ' Stück, Lieferzeit ' + L + ' Tage, Sicherheitsbestand ' + s + ' Stück. Wie hoch ist der Meldebestand?', v, 'Stück', 'Meldebestand', 0.5,
        'Meldebestand = Tagesverbrauch · Lieferzeit + Sicherheitsbestand = ' + d + ' · ' + L + ' + ' + s + ' = ' + v + ' Stück.', ['Während der Lieferzeit wird weiter verbraucht.', 'Verbrauch in der Lieferzeit plus Sicherheitsbestand.']);
    },
    orders: R => {
      const c = C(), n = c.pick(R, [4, 5, 6, 8, 10, 12, 15, 20, 24]), m = c.ri(R, 1, 10) * 100, D = n * m;
      return numQ('Der Jahresbedarf eines Artikels beträgt ' + f(D, 0) + ' Stück, je Bestellung werden ' + f(m, 0) + ' Stück bestellt. Wie viele Bestellungen sind im Jahr nötig?', n, 'Bestellungen', 'Bestellungen je Jahr', 0.01,
        'Bestellungen je Jahr = Jahresbedarf / Bestellmenge = ' + f(D, 0) + ' / ' + f(m, 0) + ' = ' + n + '.', ['Wie oft passt die Bestellmenge in den Jahresbedarf?', 'Jahresbedarf geteilt durch Bestellmenge.']);
    },
    safety: R => {
      const c = C(), d = c.pick(R, [10, 15, 20, 25, 30, 40, 50, 60]), days = c.ri(R, 2, 6), v = d * days;
      return numQ('Der Jahresverbrauch eines Artikels beträgt ' + f(d * 360, 0) + ' Stück (360 Tage). Als Sicherheitsbestand soll der Verbrauch von ' + days + ' Tagen vorrätig sein. Wie hoch ist der Sicherheitsbestand?', v, 'Stück', 'Sicherheitsbestand', 0.5,
        'Tagesverbrauch = ' + f(d * 360, 0) + ' / 360 = ' + d + ' Stück. Sicherheitsbestand = ' + d + ' · ' + days + ' = ' + v + ' Stück.', ['Berechne zuerst den Verbrauch pro Tag.', 'Tagesverbrauch mal Anzahl der Sicherheitstage.']);
    },
    meld2: R => {
      const c = C(), d = c.pick(R, [10, 15, 20, 25, 30, 40, 50, 60]), L = c.ri(R, 4, 15), s = c.ri(R, 1, 5) * d, v = d * L + s;
      return numQ('Der Jahresverbrauch beträgt ' + f(d * 360, 0) + ' Stück (360 Tage). Die Lieferzeit beträgt ' + L + ' Tage, der Sicherheitsbestand ' + s + ' Stück. Berechne den Meldebestand.', v, 'Stück', 'Meldebestand', 0.5,
        'Tagesverbrauch = ' + f(d * 360, 0) + ' / 360 = ' + d + '. Meldebestand = ' + d + ' · ' + L + ' + ' + s + ' = ' + v + ' Stück.', ['Zuerst den Tagesverbrauch aus dem Jahresverbrauch.', 'Danach Tagesverbrauch mal Lieferzeit plus Sicherheitsbestand.']);
    },
    max: R => {
      const c = C(), n = c.pick(R, [4, 6, 8, 10, 12]), q = c.ri(R, 1, 10) * 100, D = n * q, s = c.ri(R, 1, 6) * 50, v = s + q;
      return numQ('Jahresbedarf ' + f(D, 0) + ' Stück bei ' + n + ' Bestellungen im Jahr (gleich große Mengen). Der Sicherheitsbestand beträgt ' + s + ' Stück. Wie hoch ist der Höchstbestand?', v, 'Stück', 'Höchstbestand', 0.5,
        'Bestellmenge = ' + f(D, 0) + ' / ' + n + ' = ' + q + '. Höchstbestand = Sicherheitsbestand + Bestellmenge = ' + s + ' + ' + q + ' = ' + v + ' Stück.', ['Wie groß ist eine Bestellung?', 'Direkt nach der Lieferung liegt der Sicherheitsbestand plus die gelieferte Menge im Lager.']);
    },
    rhythm: R => {
      const c = C(), d = c.pick(R, [20, 25, 40, 50]), t = c.ri(R, 5, 30), q = d * t;
      return numQ('Je Bestellung werden ' + f(q, 0) + ' Stück geliefert, der Tagesverbrauch beträgt ' + d + ' Stück. In welchem Abstand (in Tagen) muss bestellt werden (Bestellrhythmus)?', t, 'Tage', 'Bestellrhythmus', 0.5,
        'Bestellrhythmus = Bestellmenge / Tagesverbrauch = ' + f(q, 0) + ' / ' + d + ' = ' + t + ' Tage.', ['Wie viele Tage reicht eine Lieferung?', 'Bestellmenge geteilt durch Tagesverbrauch.']);
    },
    ordercost: R => {
      const c = C(), m = c.pick(R, [100, 200, 250, 400, 500]), n = c.pick(R, [4, 5, 8, 10, 12, 16, 20]), D = m * n, K = c.ri(R, 5, 15) * 5, v = n * K;
      return numQ('Jahresbedarf ' + f(D, 0) + ' Stück, Bestellmenge ' + m + ' Stück, Bestellkosten ' + eur(K) + ' je Bestellung. Wie hoch sind die jährlichen Bestellkosten?', v, '€', 'Bestellkosten je Jahr', 0.5,
        'Anzahl Bestellungen = ' + f(D, 0) + ' / ' + m + ' = ' + n + '. Bestellkosten = ' + n + ' · ' + eur(K) + ' = ' + eur(v) + '.', ['Wie oft wird im Jahr bestellt?', 'Anzahl der Bestellungen mal Kosten je Bestellung.']);
    },
    storecost: R => {
      const c = C(), m = c.pick(R, [200, 300, 400, 500, 600, 800]), P = c.pick(R, [5, 8, 10, 20, 25, 40]), q = c.pick(R, [10, 12, 15, 20, 25]), av = m / 2, v = av * P * q / 100;
      return numQ('Bestellmenge ' + m + ' Stück, Einstandspreis ' + eur(P) + ' je Stück, Lagerhaltungskostensatz ' + q + ' %. Berechne die jährlichen Lagerkosten (der durchschnittliche Bestand ist die halbe Bestellmenge).', v, '€', 'Lagerkosten je Jahr', rel(v),
        'Durchschnittlicher Bestand = ' + m + ' / 2 = ' + av + ' Stück. Lagerwert = ' + av + ' · ' + eur(P) + ' = ' + eur(av * P) + '. Lagerkosten = ' + eur(av * P) + ' · ' + q + ' % = ' + eur(v) + '.', ['Im Mittel liegt die halbe Bestellmenge im Lager.', 'Durchschnittswert des Lagers mal Lagerhaltungskostensatz.']);
    },
    andler: R => {
      const s = andlerSet(R);
      return numQ('Jahresbedarf ' + f(s.D, 0) + ' Stück, Bestellkosten ' + eur(s.K) + ' je Bestellung, Einstandspreis ' + eur(s.P) + ' je Stück, Lagerhaltungskostensatz ' + s.q + ' %. Berechne die optimale Bestellmenge (Andler).', s.m, 'Stück', 'Optimale Bestellmenge', Math.max(1, s.m * 0.005),
        'm_opt = √(200 · ' + f(s.D, 0) + ' · ' + s.K + ' / (' + s.P + ' · ' + s.q + ')) = √(' + f(200 * s.D * s.K, 0) + ' / ' + f(s.P * s.q, 0) + ') = √' + f(200 * s.D * s.K / (s.P * s.q), 0) + ' = ' + f(s.m, 0) + ' Stück.', ['Andler-Formel: Wurzel aus (200 · Jahresbedarf · Bestellkosten) geteilt durch (Preis · Lagerhaltungskostensatz in %).', 'Rechne zuerst den Bruch unter der Wurzel aus, dann die Wurzel ziehen. Der Satz geht als Prozentzahl ein (z. B. 16, nicht 0,16).']);
    },
    andlercost: R => {
      const s = andlerSet(R), c = C(), b = c.costOrder(s.D, s.K, s.m), l = c.costStore(s.m, s.P, s.q), g = b + l;
      return numQ('Jahresbedarf ' + f(s.D, 0) + ' Stück, Bestellkosten ' + eur(s.K) + ' je Bestellung, Einstandspreis ' + eur(s.P) + ', Lagerhaltungskostensatz ' + s.q + ' %. Wie hoch sind die gesamten jährlichen Kosten (Bestell- plus Lagerkosten), wenn mit der optimalen Bestellmenge bestellt wird?', g, '€', 'Gesamtkosten je Jahr', rel(g),
        'm_opt = ' + f(s.m, 0) + ' Stück. Bestellkosten = ' + f(s.D, 0) + ' / ' + f(s.m, 0) + ' · ' + s.K + ' = ' + eur(b) + '. Lagerkosten = ' + f(s.m, 0) + ' / 2 · ' + s.P + ' · ' + s.q + ' % = ' + eur(l) + '. Gesamt = ' + eur(g) + '. Bei der optimalen Menge sind Bestell- und Lagerkosten gleich groß.', ['Erst die optimale Bestellmenge, dann beide Kostenarten.', 'Bestellkosten = Bedarf / m · K; Lagerkosten = m / 2 · Preis · Satz / 100. Beide addieren.']);
    },
    abcshare: R => {
      const c = C(), set = abcSet(R), a = c.abc(set.items), it = c.pick(R, set.items), row = a.rows.find(r => r.name === it.name);
      return numQ('Jahresverbrauch von sechs Artikeln: ' + itemsText(set.items) + '. Wie viel Prozent des Gesamtwerts macht der Artikel „' + it.name + '“ aus (eine Nachkommastelle)?', row.share, '%', 'Wertanteil von ' + it.name, 0.1,
        'Wert „' + it.name + '“ = ' + f(it.qty, 0) + ' · ' + eur(it.price) + ' = ' + eur(row.value) + '. Gesamtwert = ' + eur(a.total) + '. Anteil = ' + f(row.value, 0) + ' / ' + f(a.total, 0) + ' · 100 = ' + f(row.share, 1) + ' %.', ['Wert eines Artikels = Menge mal Preis. Rechne alle sechs aus.', 'Wert des gesuchten Artikels durch Gesamtwert, mal 100.']);
    },
    abcclass: R => {
      const c = C(), set = abcSet(R), a = c.abc(set.items), it = c.pick(R, set.items), row = a.rows.find(r => r.name === it.name);
      const seq = a.rows.map(r => r.name + ' ' + f(r.share, 0) + ' % (kumuliert ' + f(r.cum, 0) + ' %, ' + r.cls + ')').join('; ');
      return choiceQ(R, 'Jahresverbrauch: ' + itemsText(set.items) + '. Ordne mit den Grenzen 80 % (A) und 95 % (B, kumuliert) den Artikel „' + it.name + '“ ein.', 'Klasse ' + row.cls, ['A', 'B', 'C'].filter(x => x !== row.cls).map(x => 'Klasse ' + x),
        'Nach Wert sortiert: ' + seq + '. Bis kumuliert 80 % = A, bis 95 % = B, der Rest = C. „' + it.name + '“ ist Klasse ' + row.cls + '.', ['Rechne die Werte aus und sortiere sie absteigend.', 'Addiere die Wertanteile von oben nach unten und vergleiche mit 80 % und 95 %.']);
    },
    abccum: R => {
      const c = C(), set = abcSet(R), a = c.abc(set.items), A = a.classes.A, names = a.rows.filter(r => r.cls === 'A').map(r => r.name).join(', ');
      return numQ('Jahresverbrauch: ' + itemsText(set.items) + '. Mache eine ABC-Analyse mit den Grenzen 80 % (A) und 95 % (A+B). Welchen Anteil am Gesamtwert haben die A-Artikel zusammen (in %)?', A.share, '%', 'Wertanteil der A-Artikel', 0.1,
        'Nach Wert sortiert und kumuliert gehören zu A: ' + names + '. Zusammen ' + f(A.share, 1) + ' % des Gesamtwerts (Gesamtwert ' + eur(a.total) + '), obwohl es nur ' + A.n + ' von ' + a.rows.length + ' Artikeln sind (' + f(A.nShare, 0) + ' %).', ['Sortiere nach Wert, größter zuerst, und addiere die Anteile, solange 80 % nicht überschritten werden.', 'Die Artikel, deren kumulierter Anteil höchstens 80 % ist, sind A. Ihre Anteile zählst du zusammen.']);
    },
    abcstrat: R => {
      const c = C(), cl = c.pick(R, ['A', 'B', 'C']);
      const POOL = {
        A: ['Genaue Bedarfsplanung, Einzelbeschaffung nach Bedarf, kleine Bestände, scharfe Bestandsüberwachung', 'A-Artikel haben einen hohen Wertanteil bei kleiner Menge. Hohe Kapitalbindung vermeiden: genau planen, bedarfsgenau beschaffen, Bestände eng überwachen.'],
        B: ['Mittlerer Aufwand: Bestellpunkt-Verfahren mit regelmäßiger Kontrolle', 'B-Artikel liegen dazwischen. Üblich ist ein Bestellpunkt-Verfahren mit mäßigem Kontrollaufwand.'],
        C: ['Einfache Verfahren, größere Bestellmengen, Vorratshaltung, wenig Kontrolle (z. B. Zwei-Behälter-System)', 'C-Artikel haben einen geringen Wertanteil bei großer Menge. Der Planungsaufwand soll klein bleiben: größere Mengen vorrätig halten und einfach disponieren.']
      };
      const wrong = ['A', 'B', 'C'].filter(x => x !== cl).map(x => POOL[x][0]);
      return choiceQ(R, 'Welche Dispositionsstrategie passt zu den ' + cl + '-Artikeln einer ABC-Analyse?', POOL[cl][0], wrong, POOL[cl][1], ['Denke an Wert und Menge der Klasse: ' + (cl === 'A' ? 'viel Wert, wenig Menge' : cl === 'B' ? 'mittlerer Wert, mittlere Menge' : 'wenig Wert, viel Menge') + '.', 'Wo lohnt sich viel Planungsaufwand, wo nicht?']);
    },
    reichweite: R => {
      const c = C(), d = c.pick(R, [20, 25, 40, 50, 60, 80, 120]), days = c.ri(R, 10, 60), B = d * days;
      return numQ('Im Lager liegen ' + f(B, 0) + ' Stück eines Artikels, der Tagesverbrauch beträgt ' + d + ' Stück. Wie viele Tage reicht der Bestand (Lagerreichweite)?', days, 'Tage', 'Lagerreichweite', 0.5,
        'Reichweite = Lagerbestand / Tagesverbrauch = ' + f(B, 0) + ' / ' + d + ' = ' + days + ' Tage.', ['Wie viele Tage passen in den Bestand, wenn jeden Tag gleich viel verbraucht wird?', 'Lagerbestand geteilt durch Tagesverbrauch.']);
    },
    palplatz: R => {
      const c = C(), F = c.ri(R, 6, 20), E = c.ri(R, 3, 6), P = c.pick(R, [1, 2, 3]), v = F * E * P;
      return numQ('Ein Palettenregal hat ' + F + ' Felder nebeneinander und ' + E + ' Ebenen übereinander. In jedes Fach ' + (P === 1 ? 'passt ' : 'passen ') + P + (P === 1 ? ' Palette' : ' Paletten') + '. Wie viele Paletten kann das Regal höchstens aufnehmen?', v, 'Paletten', 'Palettenplätze im Regal', 0.5,
        'Fächer = Felder · Ebenen = ' + F + ' · ' + E + ' = ' + (F * E) + '. Paletten = ' + (F * E) + ' · ' + P + ' = ' + v + '.', ['Zuerst: Wie viele Fächer hat das Regal insgesamt?', 'Fächer mal Paletten je Fach.']);
    },
    auslast: R => {
      const c = C(), T = c.pick(R, [200, 400, 500, 800, 1000]), p = c.ri(R, 11, 19) * 5, b = T * p / 100;
      return numQ('Ein Lager hat ' + f(T, 0) + ' Stellplätze, davon sind ' + f(b, 0) + ' belegt. Wie hoch ist die Lagerplatzauslastung in Prozent?', p, '%', 'Lagerplatzauslastung', 0.1,
        'Auslastung = belegte Plätze / vorhandene Plätze · 100 = ' + f(b, 0) + ' / ' + f(T, 0) + ' · 100 = ' + p + ' %.', ['Wie viel Prozent der Plätze sind belegt?', 'Belegte Plätze durch alle Plätze, mal 100.']);
    },
    inventur: R => {
      const c = C(), P = c.pick(R, [3, 5, 8, 12, 25, 40]), book = c.ri(R, 20, 200) * 10, diff = c.ri(R, 5, 60), ist = book - diff, v = diff * P;
      return numQ('Laut Lagerkartei sind ' + f(book, 0) + ' Stück eines Artikels vorrätig, bei der Inventur werden ' + f(ist, 0) + ' Stück gezählt. Der Einstandspreis beträgt ' + eur(P) + ' je Stück. Welchen Wert hat die Fehlmenge?', v, '€', 'Wert der Fehlmenge', 0.5,
        'Fehlmenge = Sollbestand − Istbestand = ' + f(book, 0) + ' − ' + f(ist, 0) + ' = ' + diff + ' Stück. Wert = ' + diff + ' · ' + eur(P) + ' = ' + eur(v) + '.', ['Zuerst die Differenz in Stück, danach den Wert bestimmen.', 'Fehlmenge mal Einstandspreis.']);
    },
    zeitpkt: R => {
      const c = C(), d = c.pick(R, [10, 20, 25, 40, 50]), M = c.ri(R, 4, 12) * d, days = c.ri(R, 3, 12), B = M + d * days;
      return numQ('Im Lager liegen aktuell ' + f(B, 0) + ' Stück. Der Meldebestand beträgt ' + f(M, 0) + ' Stück, der Tagesverbrauch ' + d + ' Stück. Nach wie vielen Tagen wird der Meldebestand erreicht, wenn bis dahin keine Ware eingeht?', days, 'Tage', 'Tage bis zum Meldebestand', 0.5,
        'Bis zum Meldebestand sind noch ' + f(B, 0) + ' − ' + f(M, 0) + ' = ' + f(B - M, 0) + ' Stück zu verbrauchen. Tage = ' + f(B - M, 0) + ' / ' + d + ' = ' + days + '. Dann muss bestellt werden.', ['Wie viele Stück darf noch verbraucht werden, bis der Meldebestand erreicht ist?', 'Diese Stückzahl durch den Tagesverbrauch teilen.']);
    },
    andlerdiff: R => {
      const s = andlerSet(R), c = C(), a = c.costTotal(s.D, s.K, s.P, s.q, s.m), b = c.costTotal(s.D, s.K, s.P, s.q, 2 * s.m), v = b - a;
      return numQ('Jahresbedarf ' + f(s.D, 0) + ' Stück, Bestellkosten ' + eur(s.K) + ' je Bestellung, Einstandspreis ' + eur(s.P) + ', Lagerhaltungskostensatz ' + s.q + ' %. Der Einkauf bestellt jedes Mal die doppelte optimale Bestellmenge. Wie viel Euro höher sind die jährlichen Gesamtkosten (Bestell- plus Lagerkosten) als bei der optimalen Menge?', v, '€', 'Mehrkosten je Jahr', rel(v),
        'm_opt = ' + f(s.m, 0) + ' Stück, Gesamtkosten dort ' + eur(a) + '. Bei ' + f(2 * s.m, 0) + ' Stück: Bestellkosten ' + eur(c.costOrder(s.D, s.K, 2 * s.m)) + ' + Lagerkosten ' + eur(c.costStore(2 * s.m, s.P, s.q)) + ' = ' + eur(b) + '. Differenz = ' + eur(v) + '.', ['Erst die optimale Bestellmenge, danach die Gesamtkosten für beide Mengen.', 'Gesamtkosten = Bedarf / m · K + m / 2 · Preis · Satz / 100. Bei beiden Mengen berechnen und die Differenz bilden.']);
    },
    org: (R, idx) => {
      const q = ORGQ[idx == null ? C().ri(R, 0, ORGQ.length - 1) : idx];
      return choiceQ(R, q[0], q[1], q[2], q[3], q[4]);
    }
  };

  /* Aufgabenliste: id, Kategorie, Stufe, Titel, Generator, Argument */
  const defs = [
    ['Kennzahlen', 1, 'Durchschnittlicher Lagerbestand', 'avg2'], ['Kennzahlen', 1, 'Umschlagshäufigkeit berechnen', 'turn'], ['Kennzahlen', 1, 'Durchschnittliche Lagerdauer', 'days'],
    ['Kennzahlen', 2, 'Durchschnittsbestand aus 13 Werten', 'avg13'], ['Kennzahlen', 2, 'Lagerdauer aus Bestandsdaten', 'turndays'], ['Kennzahlen', 2, 'Lagerkostensatz', 'costrate'],
    ['Kennzahlen', 2, 'Lagerzinssatz', 'zinssatz'], ['Kennzahlen', 3, 'Lagerhaltungskostensatz', 'holding'], ['Kennzahlen', 3, 'Lagerzinsen in Euro', 'zins'],
    ['Disposition', 1, 'Meldebestand', 'meld'], ['Disposition', 1, 'Bestellungen je Jahr', 'orders'], ['Disposition', 2, 'Sicherheitsbestand aus Jahresverbrauch', 'safety'],
    ['Disposition', 2, 'Meldebestand aus Jahresverbrauch', 'meld2'], ['Disposition', 2, 'Höchstbestand', 'max'], ['Disposition', 2, 'Bestellrhythmus in Tagen', 'rhythm'],
    ['Bestellmenge', 2, 'Jahresbestellkosten', 'ordercost'], ['Bestellmenge', 2, 'Jahreslagerkosten', 'storecost'], ['Bestellmenge', 2, 'Optimale Bestellmenge nach Andler', 'andler'], ['Bestellmenge', 3, 'Gesamtkosten bei optimaler Menge', 'andlercost'],
    ['ABC-Analyse', 1, 'Wertanteil eines Artikels', 'abcshare'], ['ABC-Analyse', 2, 'Artikel in A, B oder C einordnen', 'abcclass'], ['ABC-Analyse', 3, 'Wertanteil der A-Artikel', 'abccum'], ['ABC-Analyse', 1, 'Strategie für A-, B- oder C-Artikel', 'abcstrat'],
    ['Lagerorganisation', 1, 'Haltbarkeit: FIFO', 'org', 0], ['Lagerorganisation', 1, 'Schüttgut: LIFO', 'org', 1], ['Lagerorganisation', 2, 'Chaotische Lagerhaltung', 'org', 2],
    ['Lagerorganisation', 2, 'Lagerart erkennen', 'org', 4], ['Lagerorganisation', 1, 'Flurförderzeug wählen', 'org', 5],
    ['Kennzahlen', 1, 'Lagerreichweite', 'reichweite'], ['Lagerorganisation', 1, 'Palettenplätze im Regal', 'palplatz'], ['Lagerorganisation', 2, 'Lagerplatzauslastung', 'auslast'],
    ['Kennzahlen', 2, 'Inventurdifferenz bewerten', 'inventur'], ['Disposition', 3, 'Zeitpunkt der Bestellung', 'zeitpkt'], ['Bestellmenge', 3, 'Mehrkosten bei doppelter Bestellmenge', 'andlerdiff'],
    ['Lagerorganisation', 1, 'Vorteil der Festplatzlagerung', 'org', 3], ['Lagerorganisation', 2, 'Beschädigte Ware im Wareneingang', 'org', 8]
  ];
  const tasks = defs.map((d, i) => ({ id: 'lag' + (i + 1), cat: d[0], level: d[1], title: d[2], gen: d[3], arg: d[4] }));

  /* Aufgabe oder Trainerfrage erzeugen; R = Zufallsfunktion (bei Aufgaben fester Seed) */
  function make(t, R) {
    const q = G[t.gen](R, t.arg); q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  function makeTask(t) { return make(t, C().rng('lag-' + t.id)); }
  /* Zufallsfrage für den Trainer; level 0 = alle Stufen */
  function randomQ(R, level) {
    const pool = tasks.filter(t => !level || t.level === level), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ---------- Beispiele (fertig durchgerechnet; Schritte entstehen im UI aus LAG_CORE) ---------- */
  const examples = [
    { id: 'umschlag', tab: 'kz', title: 'Umschlagshäufigkeit und Lagerdauer', text: 'Ein Großhandel hat einen Jahresanfangsbestand von 60.000 € und einen Jahresendbestand von 100.000 €. Der Wareneinsatz im Jahr beträgt 480.000 €, der Jahreszinssatz 6 %, die Lagerkosten 12.000 €.', p: { mode: 'ae', ab: 60000, eb: 100000, use: 480000, rate: 6, costs: 12000 } },
    { id: 'monate', tab: 'kz', title: 'Durchschnittsbestand aus 12 Monatswerten', text: 'Anfangsbestand 40.000 €, dazu die zwölf Monatsendbestände. Der Durchschnitt wird aus allen 13 Werten gebildet. Wareneinsatz 390.000 €, Jahreszinssatz 5 %, Lagerkosten 9.000 €.', p: { mode: 'm12', ab: 40000, months: [42000, 38000, 36000, 40000, 44000, 46000, 42000, 38000, 40000, 44000, 48000, 52000], use: 390000, rate: 5, costs: 9000 } },
    { id: 'meld', tab: 'dis', title: 'Meldebestand, Höchstbestand, Rhythmus', text: 'Ein Artikel wird mit 40 Stück am Tag verbraucht, die Lieferzeit beträgt 8 Tage, der Sicherheitsbestand 120 Stück, je Bestellung kommen 800 Stück.', p: { daily: 40, lead: 8, safety: 120, qty: 800 } },
    { id: 'abc', tab: 'abc', title: 'ABC-Analyse mit zehn Artikeln', text: 'Zehn Artikel mit Jahresverbrauch und Preis werden nach Wert sortiert und mit den Grenzen 80 % und 15 % (A bis 80 %, B bis 95 %, C der Rest) eingeteilt.', p: { items: [{ n: 'Schrauben M8', q: 20000, p: 0.05 }, { n: 'Netzteil', q: 1800, p: 25 }, { n: 'Karton', q: 3000, p: 0.5 }, { n: 'Display', q: 500, p: 50 }, { n: 'Dichtung', q: 10000, p: 0.2 }, { n: 'Platine', q: 3000, p: 3 }, { n: 'Akku', q: 500, p: 5 }, { n: 'Gehäuse', q: 1500, p: 4 }, { n: 'Lüfter', q: 1000, p: 3 }, { n: 'Kabelbaum', q: 2500, p: 2 }], lim: { a: 80, b: 15 } } },
    { id: 'andler', tab: 'best', title: 'Optimale Bestellmenge (Andler)', text: 'Jahresbedarf 8.000 Stück, Bestellkosten 40 € je Bestellung, Einstandspreis 25 €, Lagerhaltungskostensatz 16 %.', p: { D: 8000, K: 40, P: 25, q: 16 } }
  ];

  root.LAG_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, org: ORG, orgq: ORGQ, orgTaskIdx: ORG_TASK_IDX };
  root.LAG_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.LAG_DATA, TASKS: root.LAG_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
