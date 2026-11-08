'use strict';
/* Tonfunk Buchführungs-Lab: Aufgaben und Beispiele (Lab-Kennung 'buc', Präfix lm4.buc.).
   BUC_DATA.tasks: 34 Aufgaben (Stufe 1-3) in 7 Kategorien; jede hat make(R, C) mit seed-fähigem Zufallsgenerator R und BUC_CORE C.
   make liefert eine Aufgabeninstanz { text, rows?, tips[], expl, <Antwortart> } mit genau einer Antwortart:
     ask   = { key, label, unit, tol, value }   eine Zahl eingeben (Antwort = Zeile key des Lösungswegs in rows)
     fill  = [Schlüssel]                        Schema-Tabelle (rows): diese Zeilen ausfüllen, die übrigen sind vorgegeben
     buch  = { konten:[Nr], sol:[Zeile], alts:[[Zeile]] }   Buchungssatz eingeben (Soll/Haben, Konto per Auswahl, Betrag)
     zu    = { opts:[[Wert,Text]], items:[{t,a}] }   Posten einer Seite zuordnen (Aktiva/Passiva)
   Optional tkd = [T-Konto] (in der Aufgabe gezeigte T-Konten, mit C.tkontoOf gebaut; der Saldo wird erst in der Lösung gezeigt).
   Krumme Werte: Beträge sind so gewählt, dass keine Cent-Rundungsstreit entsteht (Nettobeträge als Vielfache von 10 bzw. 100).
   Zahlen (Preise, Prozentsätze, Gehälter, Lohnsteuer, Sozialversicherung) sind frei gewählte Übungswerte, keine amtlichen Werte.
   Konten: Übungsliste in BUC_CORE.KONTEN (Festlegung, keine vollständige IKR-Liste). */
(function (root) {
  const CATS = ['Inventur und Bilanz', 'Buchungssätze', 'Umsatzsteuer', 'Warenkonten', 'Abschreibung', 'Personal', 'Abschluss'];
  const tasks = [];
  const add = (cat, title, level, make) => tasks.push({ id: 'buc' + (tasks.length + 1), cat, title, level, make });
  const L = (s, k, b) => ({ s, k, b });
  const row = (k, label, op, v, o) => Object.assign({ k, label, op, v, u: '€' }, o || {});
  const sumRow = (k, label, v, calc, o) => row(k, label, '=', v, Object.assign({ sum: true, calc }, o || {}));
  const askQ = (C, text, rows, key, label, unit, tips, expl) => { const r = rows.find(x => x.k === key); return { text, rows, ask: { key, label, unit, tol: C.tolOf(unit), value: r.v }, tips, expl }; };
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const POOL = ['2800', '2880', '2400', '4400', '2600', '4800', '6000', '6080', '5000', '5100', '0210', '3000', '4250', '6520'];
  /* Auswahlliste für Buchungsaufgaben: die Konten der Lösung plus Ablenker, sortiert nach Nummer */
  function kset(C, R, sols, n) {
    const set = []; sols.forEach(s => s.forEach(l => { if (!set.includes(l.k)) set.push(l.k); }));
    C.shuffle(R, POOL).forEach(k => { if (set.length < (n || 9) && !set.includes(k)) set.push(k); });
    return set.sort();
  }
  const kontenTip = (C, sol) => { const ks = []; sol.forEach(l => { if (!ks.includes(l.k)) ks.push(l.k); }); return ks.sort().map(k => C.kontoLabel(k)).join(', '); };
  function buchQ(C, R, text, sol, tips, expl, alts) {
    const t = tips.slice(); if (t.length < 2) t.push('Diese Konten kommen im Buchungssatz vor (ohne Reihenfolge und Seite): ' + kontenTip(C, sol) + '. Überlege, auf welcher Seite jedes Konto stehen muss.');
    return { text, buch: { konten: kset(C, R, [sol].concat(alts || [])), sol, alts: alts || [] }, tips: t, expl };
  }
  const euro = (C, v) => C.eur(v);

  /* ======================================================= Inventur und Bilanz */
  const AKT = ['Maschinen', 'Fuhrpark', 'Gebäude', 'Rohstoffe', 'Forderungen aus Lieferungen und Leistungen', 'Guthaben bei der Bank', 'Kassenbestand', 'Betriebs- und Geschäftsausstattung', 'Fertige Erzeugnisse', 'Vorsteuer (Forderung an das Finanzamt)'];
  const PAS = ['Eigenkapital', 'Darlehen bei der Bank', 'Verbindlichkeiten aus Lieferungen und Leistungen', 'Verbindlichkeiten gegenüber dem Finanzamt', 'Verbindlichkeiten gegenüber Sozialversicherungsträgern'];
  add('Inventur und Bilanz', 'Aktiva oder Passiva?', 1, (R, C) => {
    const items = C.shuffle(R, C.shuffle(R, AKT).slice(0, 3).map(t => ({ t, a: 'A' })).concat(C.shuffle(R, PAS).slice(0, 3).map(t => ({ t, a: 'P' }))));
    return { text: 'Ordne jeden Posten der Bilanz zu: Gehört er auf die Aktivseite oder auf die Passivseite?', zu: { opts: [['A', 'Aktiva'], ['P', 'Passiva']], items },
      tips: ['Die Aktivseite zeigt, wo das Kapital steckt (Vermögen). Die Passivseite zeigt, woher es stammt (Eigenkapital und Schulden).', 'Alles, was dem Betrieb gehört oder ihm geschuldet wird (auch Forderungen), steht auf der Aktivseite. Eigenkapital und alle Schulden stehen auf der Passivseite.'],
      expl: 'Aktiva = Vermögen (Anlage- und Umlaufvermögen). Passiva = Kapital (Eigenkapital und Fremdkapital, also Schulden).' };
  });
  const VM = ['Maschinen', 'Fuhrpark', 'Gebäude', 'Rohstoffvorräte', 'Forderungen aus Lieferungen und Leistungen', 'Bankguthaben', 'Kassenbestand', 'Büroausstattung'];
  add('Inventur und Bilanz', 'Summe des Vermögens', 1, (R, C) => {
    const names = C.shuffle(R, VM).slice(0, 4), vals = names.map(() => C.ri(R, 2000, 90000, 500)), sch = C.ri(R, 5000, 40000, 1000);
    const rows = names.map((n, i) => row('p' + i, n, i ? '+' : '', vals[i])); rows.push(sumRow('sum', 'Gesamtvermögen', C.summe(vals), 'Summe der vier Vermögensposten'));
    return askQ(C, 'Bei der Inventur werden festgestellt: ' + names.map((n, i) => n + ' ' + C.eur(vals[i])).join(', ') + '. Außerdem bestehen Bankschulden von ' + C.eur(sch) + '. Wie hoch ist das Gesamtvermögen?', rows, 'sum', 'Gesamtvermögen', '€',
      ['Zähle nur zusammen, was dem Betrieb gehört oder ihm geschuldet wird. Schulden gehören nicht zum Vermögen.', 'Rechne die vier genannten Posten zusammen; die Bankschulden bleiben außen vor.'], 'Vermögen = Summe aller Vermögensposten (Aktiva). Schulden stehen auf der Passivseite und sind kein Vermögen.');
  });
  add('Inventur und Bilanz', 'Eigenkapital berechnen', 2, (R, C) => {
    const vn = C.shuffle(R, VM).slice(0, 5), vv = vn.map(() => C.ri(R, 3000, 80000, 500)), dl = C.ri(R, 10000, 60000, 1000), vb = C.ri(R, 2000, 20000, 500);
    const v = C.summe(vv), s = C.summe([dl, vb]), ek = C.eigenkapital(v, s);
    const rows = [row('v', 'Summe Vermögen', '', v, { sum: true, calc: vn.length + ' Vermögensposten addiert' }), row('s', 'Summe Schulden', '−', s, { calc: C.eur(dl) + ' + ' + C.eur(vb) }), sumRow('ek', 'Eigenkapital', ek, C.eur(v) + ' − ' + C.eur(s))];
    return askQ(C, 'Das Inventar eines Betriebs weist aus. Vermögen: ' + vn.map((n, i) => n + ' ' + C.eur(vv[i])).join(', ') + '. Schulden: Bankdarlehen ' + C.eur(dl) + ', Verbindlichkeiten aus Lieferungen und Leistungen ' + C.eur(vb) + '. Berechne das Eigenkapital.', rows, 'ek', 'Eigenkapital', '€',
      ['Das Eigenkapital ist das, was dem Inhaber nach Abzug aller Schulden vom Vermögen bleibt.', 'Addiere zuerst alle Vermögensposten, dann beide Schulden, und bilde die Differenz.'], 'Eigenkapital = Vermögen − Schulden.');
  });
  add('Inventur und Bilanz', 'Gewinn durch Eigenkapitalvergleich', 3, (R, C) => {
    let ekA, g, ent, ein, ekE;
    do { ekA = C.ri(R, 80, 300, 10) * 1000; g = C.ri(R, 8, 60, 2) * 1000; ent = C.ri(R, 4, 30, 2) * 1000; ein = C.pick(R, [0, 5000, 10000]); ekE = ekA + g - ent + ein; } while (g === ent || g === ein || ekE === ekA);
    const rows = [row('ekE', 'Eigenkapital am Ende', '', ekE), row('ekA', 'Eigenkapital am Anfang', '−', ekA), row('ent', 'Privatentnahmen', '+', ent), row('ein', 'Privateinlagen', '−', ein), sumRow('g', 'Gewinn des Jahres', C.gewinnVergleich(ekE, ekA, ent, ein), C.eur(ekE) + ' − ' + C.eur(ekA) + ' + ' + C.eur(ent) + ' − ' + C.eur(ein))];
    return askQ(C, 'Ein Einzelunternehmer hatte am Jahresanfang ' + C.eur(ekA) + ' Eigenkapital und am Jahresende ' + C.eur(ekE) + '. Im Jahr entnahm er privat ' + C.eur(ent) + (ein ? ' und legte ' + C.eur(ein) + ' privat ein' : ', Einlagen gab es nicht') + '. Wie hoch war der Gewinn des Jahres?', rows, 'g', 'Gewinn', '€',
      ['Vergleiche das Eigenkapital am Ende mit dem am Anfang. Aber nicht jede Veränderung kommt aus dem Betrieb: Entnahmen und Einlagen musst du herausrechnen.', 'Entnahmen haben das Eigenkapital gemindert und müssen wieder dazu, Einlagen haben es erhöht und müssen abgezogen werden.'],
      'Gewinn = Eigenkapital Ende − Eigenkapital Anfang + Entnahmen − Einlagen.');
  });
  add('Inventur und Bilanz', 'Bilanz aufstellen', 2, (R, C) => {
    const mas = C.ri(R, 40, 120, 5) * 1000, fp = C.ri(R, 10, 40, 5) * 1000, roh = C.ri(R, 10, 40, 2) * 1000, ford = C.ri(R, 5, 30, 1) * 1000, bank = C.ri(R, 5, 30, 1) * 1000, ka = C.ri(R, 1, 6, 1) * 1000;
    const dl = C.ri(R, 10, 40, 5) * 1000, vb = C.ri(R, 5, 20, 1) * 1000, av = mas + fp, uv = roh + ford + bank + ka, sa = av + uv, fk = dl + vb, ek = sa - fk;
    const rows = [{ head: 'Aktiva' }, row('mas', 'Maschinen', '', mas), row('fp', 'Fuhrpark', '+', fp), sumRow('av', 'Summe Anlagevermögen', av, C.eur(mas) + ' + ' + C.eur(fp)),
      row('roh', 'Rohstoffe', '', roh), row('ford', 'Forderungen aus L. u. L.', '+', ford), row('bank', 'Bank', '+', bank), row('ka', 'Kasse', '+', ka), sumRow('uv', 'Summe Umlaufvermögen', uv, C.eur(roh) + ' + ' + C.eur(ford) + ' + ' + C.eur(bank) + ' + ' + C.eur(ka)),
      sumRow('sa', 'Summe Aktiva', sa, C.eur(av) + ' + ' + C.eur(uv), { op: '' }),
      { head: 'Passiva' }, row('ek', 'Eigenkapital', '', ek, { calc: C.eur(sa) + ' − ' + C.eur(fk), bas: 'Ausgleichsposten: Summe Aktiva − Fremdkapital' }), row('dl', 'Darlehen', '', dl), row('vb', 'Verbindlichkeiten aus L. u. L.', '+', vb),
      sumRow('fk', 'Summe Fremdkapital', fk, C.eur(dl) + ' + ' + C.eur(vb)), sumRow('sp', 'Summe Passiva', sa, C.eur(ek) + ' + ' + C.eur(fk), { op: '' })];
    return { text: 'Aus dem Inventar ist eine Bilanz entstanden. Die Einzelposten stehen schon darin. Trage die fehlenden Summen und das Eigenkapital ein.', rows, fill: ['av', 'uv', 'sa', 'ek', 'fk', 'sp'],
      tips: ['Die Bilanz ist immer ausgeglichen: Summe Aktiva = Summe Passiva. Das Eigenkapital ist der Posten, der die Passivseite auffüllt.', 'Rechne zuerst Anlage- und Umlaufvermögen und daraus die Summe Aktiva. Dann das Fremdkapital. Das Eigenkapital ist Summe Aktiva − Fremdkapital.'],
      expl: 'Summe Aktiva = Anlagevermögen + Umlaufvermögen. Eigenkapital = Summe Aktiva − Fremdkapital. Summe Passiva muss gleich Summe Aktiva sein.' };
  });

  /* ======================================================= Buchungssätze */
  add('Buchungssätze', 'Geldbewegung zwischen Kasse und Bank', 1, (R, C) => {
    const b = C.ri(R, 5, 60, 5) * 100, ein = R() < 0.5;
    const sol = ein ? [L('S', '2800', b), L('H', '2880', b)] : [L('S', '2880', b), L('H', '2800', b)];
    return buchQ(C, R, ein ? 'Aus der Kasse werden ' + C.eur(b) + ' auf das Bankkonto eingezahlt. Buche den Geschäftsfall.' : 'Vom Bankkonto werden ' + C.eur(b) + ' abgehoben und in die Kasse gelegt. Buche den Geschäftsfall.', sol,
      ['Frage dich: Auf welchem Konto nimmt der Bestand zu (Aktivkonto: Soll), auf welchem nimmt er ab (Haben)?'], 'Beide Konten sind Aktivkonten. Das Konto, dessen Bestand steigt, steht im Soll, das mit sinkendem Bestand im Haben: ' + C.bsText(sol) + '.');
  });
  add('Buchungssätze', 'Eine Schuld wird umgewandelt', 2, (R, C) => {
    const b = C.ri(R, 5, 50, 5) * 1000, sol = [L('S', '4400', b), L('H', '4250', b)];
    return buchQ(C, R, 'Eine offene Lieferantenrechnung über ' + C.eur(b) + ' wird mit dem Lieferer vereinbart in ein langfristiges Darlehen umgewandelt. Es wird nichts bezahlt. Buche den Geschäftsfall.', sol,
      ['Die eine Schuld wird kleiner, die andere größer. Bei Passivkonten stehen Zugänge im Haben und Abgänge im Soll.'], 'Passivtausch: Die Verbindlichkeit aus Lieferungen nimmt ab (Soll), das Darlehen nimmt zu (Haben): ' + C.bsText(sol) + '.');
  });
  add('Buchungssätze', 'Eingangsrechnung bezahlen', 1, (R, C) => {
    const b = C.ri(R, 5, 80, 5) * 100, sol = [L('S', '4400', b), L('H', '2800', b)];
    return buchQ(C, R, 'Wir überweisen eine Eingangsrechnung eines Lieferers über ' + C.eur(b) + ' (die Rechnung ist bereits gebucht) von unserem Bankkonto. Buche den Geschäftsfall.', sol,
      ['Die Schuld gegenüber dem Lieferer verschwindet, und das Bankguthaben sinkt. Verbindlichkeiten sind Passivkonten, Bank ist ein Aktivkonto.'], 'Die Verbindlichkeit nimmt ab (Passivkonto: Abgang im Soll), die Bank nimmt ab (Aktivkonto: Abgang im Haben): ' + C.bsText(sol) + '.');
  });
  add('Buchungssätze', 'Zahlungseingang eines Kunden', 1, (R, C) => {
    const b = C.ri(R, 5, 80, 5) * 100, bar = R() < 0.35, sol = [L('S', bar ? '2880' : '2800', b), L('H', '2400', b)];
    return buchQ(C, R, 'Ein Kunde begleicht eine Ausgangsrechnung über ' + C.eur(b) + ' (die Rechnung ist bereits gebucht) ' + (bar ? 'bar.' : 'per Überweisung auf unser Bankkonto.') + ' Buche den Geschäftsfall.', sol,
      ['Die Forderung an den Kunden erlischt, dafür kommt Geld in den Betrieb.'], 'Das Geld nimmt zu (' + (bar ? 'Kasse' : 'Bank') + ': Soll), die Forderung nimmt ab (Haben): ' + C.bsText(sol) + '.');
  });
  add('Buchungssätze', 'Anlagegut auf Ziel kaufen', 2, (R, C) => {
    const a = C.pick(R, [['0210', 'eine Maschine'], ['0220', 'einen Lieferwagen'], ['0230', 'neue Büromöbel']]), n = C.ri(R, 5, 80, 5) * 1000, u = C.ustVon(n, 19), br = n + u;
    const sol = [L('S', a[0], n), L('S', '2600', u), L('H', '4400', br)];
    return buchQ(C, R, 'Wir kaufen ' + a[1] + ' auf Ziel. Die Eingangsrechnung lautet auf ' + C.eur(n) + ' netto zuzüglich 19 % Umsatzsteuer. Buche die Eingangsrechnung.', sol,
      ['Der Betrieb schuldet dem Lieferer den Bruttobetrag. Die Umsatzsteuer wird nicht Teil der Anschaffungskosten, sie wird getrennt als Vorsteuer gebucht.'],
      'Netto ' + C.eur(n) + ' + 19 % Umsatzsteuer ' + C.eur(u) + ' = Brutto ' + C.eur(br) + '. Das Anlagegut kommt mit dem Nettowert ins Soll, die Vorsteuer ins Soll, die Verbindlichkeit mit dem Bruttobetrag ins Haben: ' + C.bsText(sol) + '.');
  });
  add('Buchungssätze', 'T-Konto Bank: Endbestand', 2, (R, C) => {
    const ab = C.ri(R, 10, 40, 2) * 1000, s = [{ g: '2400', b: C.ri(R, 2, 9, 1) * 500 }, { g: '2880', b: C.ri(R, 1, 4, 1) * 500 }], h = [{ g: '4400', b: C.ri(R, 3, 8, 1) * 500 }, { g: '6200', b: C.ri(R, 2, 6, 1) * 500 }];
    const t = C.tkontoOf('2800', s, h, ab), end = C.endbestand(t);
    const rows = [row('ss', 'Summe Soll-Seite (Anfangsbestand und Zugänge)', '', t.sumS, { calc: C.eur(ab) + ' + ' + C.eur(s[0].b) + ' + ' + C.eur(s[1].b) }), row('hs', 'Summe Haben-Seite (Abgänge)', '−', t.sumH, { calc: C.eur(h[0].b) + ' + ' + C.eur(h[1].b) }), sumRow('end', 'Endbestand (Saldo)', end, C.eur(t.sumS) + ' − ' + C.eur(t.sumH))];
    const q = askQ(C, 'Das T-Konto 2800 Bank zeigt den Anfangsbestand und die Buchungen eines Monats (die Zahlen in der Spalte „Gegenkonto“ sind die Kontonummern der Gegenkonten). Wie hoch ist der Endbestand (Saldo) des Kontos?', rows, 'end', 'Endbestand Bank', '€',
      ['Ein Aktivkonto steht im Soll mit Anfangsbestand und Zugängen, im Haben mit den Abgängen. Der Saldo ist der Unterschied der beiden Seiten.', 'Addiere die Soll-Seite (Anfangsbestand und alle Zugänge), addiere die Haben-Seite und bilde die Differenz.'], 'Endbestand = Soll-Summe − Haben-Summe, weil das Aktivkonto im Soll beginnt.');
    q.tkd = [t]; return q;
  });
  add('Buchungssätze', 'T-Konto Verbindlichkeiten: Endbestand', 3, (R, C) => {
    const ab = C.ri(R, 8, 30, 2) * 1000, h = [{ g: '6000', b: C.ri(R, 3, 9, 1) * 1000 }, { g: '6020', b: C.ri(R, 1, 4, 1) * 500 }], s = [{ g: '2800', b: C.ri(R, 2, 7, 1) * 1000 }, { g: '6002', b: C.ri(R, 1, 3, 1) * 500 }];
    const t = C.tkontoOf('4400', s, h, ab), end = C.endbestand(t);
    const rows = [row('hs', 'Summe Haben-Seite (Anfangsbestand und Zugänge)', '', t.sumH, { calc: C.eur(ab) + ' + ' + C.eur(h[0].b) + ' + ' + C.eur(h[1].b) }), row('ss', 'Summe Soll-Seite (Abgänge)', '−', t.sumS, { calc: C.eur(s[0].b) + ' + ' + C.eur(s[1].b) }), sumRow('end', 'Endbestand (Saldo)', end, C.eur(t.sumH) + ' − ' + C.eur(t.sumS))];
    const q = askQ(C, 'Das T-Konto 4400 Verbindlichkeiten aus L. u. L. zeigt den Anfangsbestand und die Buchungen eines Monats. Wie hoch ist die Verbindlichkeit am Monatsende (Endbestand des Kontos)?', rows, 'end', 'Endbestand der Verbindlichkeiten', '€',
      ['Bei einem Passivkonto ist es umgekehrt wie beim Aktivkonto: Der Anfangsbestand steht im Haben. Zugänge stehen im Haben, Abgänge im Soll.', 'Haben-Seite (Anfangsbestand + Zugänge) minus Soll-Seite (Abgänge) ergibt den Endbestand.'], 'Endbestand = Haben-Summe − Soll-Summe, weil das Passivkonto im Haben beginnt.');
    q.tkd = [t]; return q;
  });

  /* ======================================================= Umsatzsteuer */
  add('Umsatzsteuer', 'Vorsteuer berechnen', 1, (R, C) => {
    const satz = C.pick(R, [19, 19, 7]), n = C.ri(R, 2, 40, 1) * 100, u = C.ustVon(n, satz);
    const rows = [row('n', 'Nettobetrag', '', n), row('u', 'Vorsteuer', '+', u, { pct: satz, bas: 'auf den Nettobetrag (auf Hundert)', calc: C.eur(n) + ' × ' + satz + ' % : 100' }), sumRow('b', 'Bruttobetrag', C.bruttoVon(n, satz), C.eur(n) + ' + ' + C.eur(u))];
    return askQ(C, 'Eine Eingangsrechnung lautet über ' + C.eur(n) + ' netto. Der Umsatzsteuersatz beträgt ' + satz + ' % (' + (satz === 7 ? 'ermäßigter Satz' : 'Regelsatz') + '). Wie hoch ist die Vorsteuer?', rows, 'u', 'Vorsteuer', '€',
      ['Die Umsatzsteuer wird auf den Nettobetrag gerechnet: Nettobetrag × Steuersatz : 100.'], 'Vorsteuer = Nettobetrag × Steuersatz : 100. Beim Einkauf heißt die gezahlte Umsatzsteuer Vorsteuer.');
  });
  add('Umsatzsteuer', 'Nettobetrag aus der Bruttorechnung', 2, (R, C) => {
    const satz = C.pick(R, [19, 19, 7]), n = C.ri(R, 5, 80, 5) * 10, br = C.bruttoVon(n, satz);
    const rows = [row('b', 'Bruttobetrag', '', br, { bas: 'Brutto = ' + (100 + satz) + ' % (auf Hundert)' }), row('u', 'Umsatzsteuer', '−', C.ustAus(br, satz), { pct: satz, calc: C.eur(br) + ' − ' + C.eur(n) }), sumRow('n', 'Nettobetrag', n, C.eur(br) + ' × 100 : ' + (100 + satz))];
    return askQ(C, 'Eine Rechnung lautet über ' + C.eur(br) + ' und enthält ' + satz + ' % Umsatzsteuer. Wie hoch ist der Nettobetrag?', rows, 'n', 'Nettobetrag', '€',
      ['Der Bruttobetrag ist der Nettobetrag plus Umsatzsteuer, also ' + (100 + satz) + ' % des Nettobetrags. Du darfst nicht einfach ' + satz + ' % vom Bruttobetrag abziehen.', 'Nettobetrag = Bruttobetrag × 100 : ' + (100 + satz) + '.'],
      'Der Nettobetrag entspricht 100 %, der Bruttobetrag ' + (100 + satz) + ' %. Netto = Brutto × 100 : ' + (100 + satz) + '.');
  });
  add('Umsatzsteuer', 'Ausgangsrechnung buchen', 2, (R, C) => {
    const wa = R() < 0.5, n = C.ri(R, 5, 80, 5) * 100, u = C.ustVon(n, 19), br = n + u, sol = [L('S', '2400', br), L('H', wa ? '5100' : '5000', n), L('H', '4800', u)];
    return buchQ(C, R, 'Wir liefern ' + (wa ? 'Handelswaren' : 'selbst hergestellte Erzeugnisse') + ' auf Ziel an einen Kunden. Die Ausgangsrechnung lautet auf ' + C.eur(n) + ' netto zuzüglich 19 % Umsatzsteuer. Buche die Ausgangsrechnung.', sol,
      ['Der Kunde schuldet den Bruttobetrag. Die Umsatzsteuer gehört dem Finanzamt, sie ist deshalb kein Erlös.'],
      'Brutto ' + C.eur(br) + ' = Forderung (Soll). Der Erlös (Haben) ist nur der Nettobetrag ' + C.eur(n) + ', die Umsatzsteuer ' + C.eur(u) + ' ist eine Verbindlichkeit (Haben): ' + C.bsText(sol) + '.');
  });
  add('Umsatzsteuer', 'Zahllast ermitteln', 2, (R, C) => {
    const ust = C.ri(R, 8, 40, 1) * 1000 + C.ri(R, 0, 9, 1) * 100, vst = ust - C.ri(R, 2, 7, 1) * 500 - C.ri(R, 0, 4, 1) * 50, z = C.zahllast(ust, vst);
    const rows = [row('u', 'Umsatzsteuer (Konto 4800)', '', ust), row('v', 'Vorsteuer (Konto 2600)', '−', vst), sumRow('z', 'Zahllast', z, C.eur(ust) + ' − ' + C.eur(vst))];
    return askQ(C, 'Am Monatsende zeigt das Konto 4800 Umsatzsteuer einen Betrag von ' + C.eur(ust) + ' und das Konto 2600 Vorsteuer einen Betrag von ' + C.eur(vst) + '. Wie viel muss an das Finanzamt abgeführt werden (Zahllast)?', rows, 'z', 'Zahllast', '€',
      ['Die Umsatzsteuer, die du von Kunden bekommen hast, darfst du um die Umsatzsteuer kürzen, die du selbst an Lieferer gezahlt hast.'], 'Zahllast = Umsatzsteuer − Vorsteuer. Ist die Vorsteuer größer, entsteht ein Erstattungsanspruch.');
  });
  /* PRUEFEN: Zahllast wird auf 4830 gebucht (Ausgleich 4800 an 2600, Rest an 4830); manche Betriebe buchen die Zahllast direkt am Monatsende über 4800 an Bank. */
  add('Umsatzsteuer', 'Zahllast buchen', 3, (R, C) => {
    const ust = C.ri(R, 8, 40, 1) * 1000 + C.ri(R, 0, 9, 1) * 100, vst = ust - C.ri(R, 2, 7, 1) * 500 - C.ri(R, 0, 4, 1) * 50, z = C.zahllast(ust, vst), sol = [L('S', '4800', ust), L('H', '2600', vst), L('H', '4830', z)];
    return buchQ(C, R, 'Zum Monatsende zeigt das Konto 4800 Umsatzsteuer ' + C.eur(ust) + ' und das Konto 2600 Vorsteuer ' + C.eur(vst) + '. Buche den Ausgleich der beiden Konten. Die Überweisung an das Finanzamt erfolgt erst später.', sol,
      ['Beide Steuerkonten werden ausgeglichen. Der Unterschied ist die Schuld gegenüber dem Finanzamt und braucht ein eigenes Konto.'],
      'Das Umsatzsteuerkonto wird im Soll ausgeglichen, das Vorsteuerkonto im Haben. Die Zahllast ' + C.eur(z) + ' ist eine Verbindlichkeit gegenüber dem Finanzamt (Haben): ' + C.bsText(sol) + '.');
  });

  /* ======================================================= Warenkonten */
  /* PRUEFEN: Es wird nach dem Aufwandsverfahren gebucht (Einkauf direkt auf 6000/6020/6080). Das Bestandsverfahren (Einkauf auf 2000/2020/2280) und die Bestandsveränderung am Jahresende sind nicht Inhalt dieses Labs. */
  add('Warenkonten', 'Wareneinkauf auf Ziel', 2, (R, C) => {
    const a = C.pick(R, [['6000', 'Rohstoffe'], ['6080', 'Handelswaren'], ['6020', 'Hilfsstoffe']]), n = C.ri(R, 5, 80, 5) * 100, u = C.ustVon(n, 19), br = n + u, sol = [L('S', a[0], n), L('S', '2600', u), L('H', '4400', br)];
    return buchQ(C, R, 'Wir kaufen ' + a[1] + ' auf Ziel ein. Die Eingangsrechnung lautet auf ' + C.eur(n) + ' netto zuzüglich 19 % Umsatzsteuer. Einkäufe buchen wir nach dem Aufwandsverfahren. Buche die Eingangsrechnung.', sol,
      ['Der Einkauf ist Aufwand in Höhe des Nettobetrags. Die Umsatzsteuer ist Vorsteuer, und der Lieferer erhält erst später sein Geld.'],
      'Aufwandskonto netto im Soll, Vorsteuer im Soll, Verbindlichkeit brutto im Haben: ' + C.bsText(sol) + '.');
  });
  add('Warenkonten', 'Eingangsfracht', 2, (R, C) => {
    const n = C.ri(R, 2, 20, 1) * 100, u = C.ustVon(n, 19), br = n + u, sol = [L('S', '6001', n), L('S', '2600', u), L('H', '2800', br)];
    return buchQ(C, R, 'Für eine Rohstofflieferung zahlen wir die Fracht an den Spediteur per Banküberweisung. Die Frachtrechnung lautet auf ' + C.eur(n) + ' netto zuzüglich 19 % Umsatzsteuer. Buche die Zahlung.', sol,
      ['Die Fracht beim Einkauf sind Bezugskosten und haben ein eigenes Konto. Die Umsatzsteuer darauf ist auch Vorsteuer.'],
      'Bezugskosten netto und Vorsteuer im Soll, die Überweisung des Bruttobetrags im Haben: ' + C.bsText(sol) + '.');
  });
  /* PRUEFEN: Rücksendung wird auf 6002 Nachlässe gebucht; manche Betriebe buchen direkt im Haben auf das Einkaufskonto (6000). Beides wird akzeptiert. */
  add('Warenkonten', 'Rücksendung an den Lieferer', 3, (R, C) => {
    const n = C.ri(R, 2, 20, 1) * 100, u = C.ustVon(n, 19), br = n + u, sol = [L('S', '4400', br), L('H', '6002', n), L('H', '2600', u)];
    return buchQ(C, R, 'Wir senden mangelhafte Rohstoffe mit einem Nettowert von ' + C.eur(n) + ' an den Lieferer zurück. Die Rechnung war noch nicht bezahlt, der Lieferer schreibt den Betrag einschließlich 19 % Umsatzsteuer gut. Buche die Gutschrift.', sol,
      ['Die Verbindlichkeit sinkt um den Bruttobetrag. Auch die Vorsteuer wird zurückgenommen, und der Einkauf wird um den Nettobetrag gemindert.'],
      'Die Schuld wird um den Bruttobetrag gekürzt (Soll). Der Einkauf wird um den Nettowert berichtigt (Haben, Konto Nachlässe) und die Vorsteuer um die Umsatzsteuer gekürzt (Haben): ' + C.bsText(sol) + '. Eine direkte Gegenbuchung auf 6000 wird ebenfalls akzeptiert.', [[L('S', '4400', br), L('H', '6000', n), L('H', '2600', u)]]);
  });
  /* PRUEFEN: Lieferantenskonto wird über 6002 Nachlässe gebucht, Kundenskonto über 5001 Erlösberichtigungen, jeweils mit Berichtigung von Vorsteuer bzw. Umsatzsteuer. Manche Betriebe führen eigene Skontokonten. */
  add('Warenkonten', 'Zahlung an den Lieferer mit Skonto', 3, (R, C) => {
    const n = C.ri(R, 5, 50, 1) * 100, br = C.bruttoVon(n, 19), pct = C.pick(R, [2, 3]), k = C.skonto(br, pct, 19), sol = [L('S', '4400', br), L('H', '2800', k.zahl), L('H', '6002', k.sn), L('H', '2600', k.ust)];
    return buchQ(C, R, 'Eine Eingangsrechnung für Rohstoffe über ' + C.eur(br) + ' brutto (19 % Umsatzsteuer) wird innerhalb der Skontofrist unter Abzug von ' + pct + ' % Skonto per Banküberweisung bezahlt. Buche die Zahlung.', sol,
      ['Die ganze Rechnung wird ausgebucht, aber nur der Zahlbetrag verlässt die Bank. Der Skontoabzug ist brutto gerechnet; in ihm steckt Umsatzsteuer, die der Betrieb zurückgeben muss.', 'Skontobetrag = Rechnungsbetrag × Prozent. Davon ist der Umsatzsteueranteil Vorsteuerberichtigung, der Rest ist der Nettoskonto (Nachlass).'],
      'Skonto brutto ' + C.eur(k.sb) + ' = Nettoskonto ' + C.eur(k.sn) + ' + Umsatzsteuer-Anteil ' + C.eur(k.ust) + '. Gezahlt werden ' + C.eur(k.zahl) + ': ' + C.bsText(sol) + '.');
  });
  add('Warenkonten', 'Zahlung eines Kunden mit Skonto', 3, (R, C) => {
    const n = C.ri(R, 5, 50, 1) * 100, br = C.bruttoVon(n, 19), pct = C.pick(R, [2, 3]), k = C.skonto(br, pct, 19), sol = [L('S', '2800', k.zahl), L('S', '5001', k.sn), L('S', '4800', k.ust), L('H', '2400', br)];
    return buchQ(C, R, 'Ein Kunde zahlt eine Ausgangsrechnung über ' + C.eur(br) + ' brutto (19 % Umsatzsteuer) unter Abzug von ' + pct + ' % Skonto per Überweisung auf unser Bankkonto. Buche den Zahlungseingang.', sol,
      ['Die ganze Forderung wird ausgebucht, aber auf dem Bankkonto kommt nur der Zahlbetrag an. Der Skonto mindert den Erlös, und die darin enthaltene Umsatzsteuer wird ebenfalls berichtigt.', 'Skontobetrag = Rechnungsbetrag × Prozent. Der Umsatzsteueranteil darin mindert die Umsatzsteuerschuld, der Rest ist Erlösberichtigung.'],
      'Skonto brutto ' + C.eur(k.sb) + ' = Erlösberichtigung ' + C.eur(k.sn) + ' + Umsatzsteuer-Anteil ' + C.eur(k.ust) + '. Eingezahlt werden ' + C.eur(k.zahl) + ': ' + C.bsText(sol) + '.');
  });
  add('Warenkonten', 'Rohstoffverbrauch', 2, (R, C) => {
    let ab, zu, sb, v;
    do { ab = C.ri(R, 10, 60, 2) * 1000; zu = C.ri(R, 20, 120, 5) * 1000; sb = C.ri(R, 8, 50, 2) * 1000; v = C.verbrauch(ab, zu, sb); } while (v <= 0 || [ab, zu, sb].includes(v));
    const rows = [row('ab', 'Anfangsbestand', '', ab), row('zu', 'Zukäufe', '+', zu), row('sb', 'Schlussbestand laut Inventur', '−', sb), sumRow('v', 'Verbrauch', v, C.eur(ab) + ' + ' + C.eur(zu) + ' − ' + C.eur(sb))];
    return askQ(C, 'Bei den Rohstoffen beträgt der Anfangsbestand ' + C.eur(ab) + ', es wurden Rohstoffe für ' + C.eur(zu) + ' zugekauft, und die Inventur ergibt einen Schlussbestand von ' + C.eur(sb) + '. Wie hoch ist der Rohstoffverbrauch?', rows, 'v', 'Rohstoffverbrauch', '€',
      ['Was am Ende nicht mehr im Lager liegt, wurde verbraucht. Das Lager vorher plus alles, was dazukam, ist der Gesamtvorrat.'], 'Verbrauch = Anfangsbestand + Zukäufe − Schlussbestand.');
  });

  /* ======================================================= Abschreibung */
  add('Abschreibung', 'Lineare Abschreibung pro Jahr', 1, (R, C) => {
    const nd = C.pick(R, [4, 5, 6, 8, 10]), afa = C.ri(R, 2, 20, 1) * 500, ak = afa * nd;
    const rows = [row('ak', 'Anschaffungskosten', '', ak), row('rest', 'Restwert nach der Nutzungsdauer', '−', 0), row('nd', 'Nutzungsdauer', '', nd, { u: 'Jahre' }), sumRow('afa', 'Jährliche Abschreibung', C.afaLinear(ak, 0, nd), C.eur(ak) + ' : ' + nd + ' Jahre')];
    return askQ(C, 'Eine Maschine wird für ' + C.eur(ak) + ' angeschafft. Die Nutzungsdauer beträgt ' + nd + ' Jahre, der Restwert nach der Nutzungsdauer ist 0 €. Wie hoch ist die jährliche lineare Abschreibung?', rows, 'afa', 'Abschreibung pro Jahr', '€',
      ['Bei der linearen Abschreibung wird in jedem Jahr derselbe Betrag abgeschrieben.'], 'Lineare AfA pro Jahr = (Anschaffungskosten − Restwert) : Nutzungsdauer.');
  });
  add('Abschreibung', 'Restbuchwert', 2, (R, C) => {
    const nd = C.pick(R, [5, 6, 8, 10]), afa = C.ri(R, 2, 20, 1) * 500, ak = afa * nd, n = C.ri(R, 2, nd - 1, 1), rb = C.restbuchwert(ak, afa, n);
    const rows = [row('ak', 'Anschaffungskosten', '', ak), row('afa', 'Jahres-AfA', '', afa, { calc: C.eur(ak) + ' : ' + nd + ' Jahre' }), row('sum', 'Abschreibung in ' + n + ' Jahren', '−', afa * n, { calc: C.eur(afa) + ' × ' + n }), sumRow('rb', 'Restbuchwert', rb, C.eur(ak) + ' − ' + C.eur(afa * n))];
    return askQ(C, 'Eine Maschine wurde zum Preis von ' + C.eur(ak) + ' angeschafft und wird in ' + nd + ' Jahren linear auf 0 € abgeschrieben. Wie hoch ist der Restbuchwert (Buchwert) am Ende des ' + n + '. Jahres?', rows, 'rb', 'Restbuchwert', '€',
      ['Der Restbuchwert ist das, was von den Anschaffungskosten noch nicht abgeschrieben wurde.', 'Rechne zuerst die Jahres-Abschreibung, multipliziere sie mit der Zahl der Jahre und ziehe das Ergebnis von den Anschaffungskosten ab.'], 'Restbuchwert = Anschaffungskosten − (Jahres-AfA × Jahre).');
  });
  /* PRUEFEN: Direkte Abschreibung (Haben auf dem Anlagekonto). Die indirekte Abschreibung über Wertberichtigungskonten ist nicht enthalten. Restwert ist immer 0 (Ausnahme: keine), GWG-Sonderregeln fehlen. */
  add('Abschreibung', 'Abschreibung buchen', 2, (R, C) => {
    const a = C.pick(R, [['0210', 'Maschinen'], ['0220', 'Fuhrpark'], ['0230', 'Betriebs- und Geschäftsausstattung']]), b = C.ri(R, 4, 40, 1) * 500, sol = [L('S', '6520', b), L('H', a[0], b)];
    return buchQ(C, R, 'Zum Jahresende werden auf das Konto ' + a[1] + ' ' + C.eur(b) + ' abgeschrieben (direkte Abschreibung). Buche die Abschreibung.', sol,
      ['Die Abschreibung ist Aufwand und mindert zugleich den Wert des Anlageguts.'], 'Aufwand im Soll (Konto Abschreibungen), das Anlagekonto wird im Haben verringert: ' + C.bsText(sol) + '.');
  });
  add('Abschreibung', 'Abschreibungsplan ausfüllen', 2, (R, C) => {
    const nd = C.pick(R, [4, 5, 6]), afa = C.ri(R, 3, 20, 1) * 500, ak = afa * nd, rb1 = C.restbuchwert(ak, afa, 1), rb2 = C.restbuchwert(ak, afa, 2), rb3 = C.restbuchwert(ak, afa, 3);
    const rows = [row('ak', 'Anschaffungskosten', '', ak), row('nd', 'Nutzungsdauer', '', nd, { u: 'Jahre' }), row('afa', 'Jährliche Abschreibung', '', afa, { calc: C.eur(ak) + ' : ' + nd + ' Jahre' }),
      row('r1', 'Restbuchwert Ende Jahr 1', '', rb1, { calc: C.eur(ak) + ' − ' + C.eur(afa) }), row('r2', 'Restbuchwert Ende Jahr 2', '', rb2, { calc: C.eur(rb1) + ' − ' + C.eur(afa) }), row('r3', 'Restbuchwert Ende Jahr 3', '', rb3, { calc: C.eur(rb2) + ' − ' + C.eur(afa) })];
    return { text: 'Ein Fuhrpark-Fahrzeug wird für ' + C.eur(ak) + ' angeschafft und über ' + nd + ' Jahre linear auf 0 € abgeschrieben. Fülle die Zeilen des Abschreibungsplans aus.', rows, fill: ['afa', 'r1', 'r2', 'r3'],
      tips: ['Jedes Jahr wird derselbe Betrag abgeschrieben, und der Restbuchwert sinkt um genau diesen Betrag.', 'Jährliche Abschreibung = Anschaffungskosten : Nutzungsdauer. Dann ziehst du sie Jahr für Jahr vom Restbuchwert ab.'], expl: 'AfA = Anschaffungskosten : Nutzungsdauer. Restbuchwert Ende Jahr n = Anschaffungskosten − n × AfA.' };
  });
  add('Abschreibung', 'Abschreibung im Anschaffungsjahr', 3, (R, C) => {
    const mo = C.pick(R, [250, 300, 400, 500, 600]), afaJ = mo * 12, nd = C.pick(R, [5, 8, 10]), ak = afaJ * nd, m = C.ri(R, 3, 10, 1), mm = C.monateImJahr(m), a = C.afaAnteilig(afaJ, m);
    const rows = [row('ak', 'Anschaffungskosten', '', ak), row('j', 'Jahres-AfA', '', afaJ, { calc: C.eur(ak) + ' : ' + nd + ' Jahre' }), row('mm', 'Monate im Anschaffungsjahr', '', mm, { u: 'Monate', calc: '13 − ' + m }), sumRow('a', 'Abschreibung im Anschaffungsjahr', a, C.eur(afaJ) + ' : 12 × ' + mm)];
    return askQ(C, 'Im ' + MON[m - 1] + ' wird eine Maschine für ' + C.eur(ak) + ' angeschafft (Nutzungsdauer ' + nd + ' Jahre, linear, Restwert 0 €). Im Anschaffungsjahr wird nur zeitanteilig abgeschrieben: für jeden vollen Monat ab dem Anschaffungsmonat (dieser zählt voll). Wie hoch ist die Abschreibung im Anschaffungsjahr?', rows, 'a', 'Abschreibung im Anschaffungsjahr', '€',
      ['Rechne zuerst die Abschreibung für ein ganzes Jahr, dann den Teil für die Monate, in denen die Maschine im Betrieb war.', 'Zähle die Monate vom Anschaffungsmonat bis Dezember (der Anschaffungsmonat zählt mit). Jahres-AfA : 12 × Monate.'], 'AfA im ersten Jahr = Jahres-AfA : 12 × Monate im Betrieb.');
  });

  /* ======================================================= Personal */
  /* PRUEFEN: Alle Personalwerte (Lohnsteuer 10-15 %, Sozialversicherung je 20 % von Arbeitnehmer und Arbeitgeber) sind Übungswerte; die Aufgabentexte weisen darauf hin. Arbeitgeberanteil wird hier nur im Beispiel 7 gebucht. */
  add('Personal', 'Auszahlungsbetrag', 1, (R, C) => {
    const br = C.ri(R, 22, 45, 1) * 100, lst = C.anteil(br, C.pick(R, [10, 12, 15])), sv = C.anteil(br, 20), net = C.auszahlung(br, lst, sv);
    const rows = [row('br', 'Bruttogehalt', '', br), row('lst', 'Lohnsteuer', '−', lst), row('sv', 'Sozialversicherung (Arbeitnehmeranteil)', '−', sv), sumRow('net', 'Auszahlungsbetrag', net, C.eur(br) + ' − ' + C.eur(lst) + ' − ' + C.eur(sv))];
    return askQ(C, 'Ein Angestellter erhält ein Bruttogehalt von ' + C.eur(br) + '. Einbehalten werden Lohnsteuer von ' + C.eur(lst) + ' und der Arbeitnehmeranteil zur Sozialversicherung von ' + C.eur(sv) + ' (Übungswerte, keine amtlichen Sätze). Wie viel wird ihm überwiesen?', rows, 'net', 'Auszahlungsbetrag', '€',
      ['Der Arbeitgeber behält Steuern und Beiträge ein und überweist den Rest.'], 'Auszahlung = Brutto − Lohnsteuer − Arbeitnehmeranteil Sozialversicherung.');
  });
  add('Personal', 'Gesamte Personalkosten', 2, (R, C) => {
    const br = C.ri(R, 22, 45, 1) * 100, ag = C.anteil(br, 20), tot = C.rd2(br + ag);
    const rows = [row('br', 'Bruttogehalt', '', br), row('ag', 'Arbeitgeberanteil Sozialversicherung', '+', ag, { pct: 20, bas: 'vom Bruttogehalt (Übungswert)', calc: C.eur(br) + ' × 20 % : 100' }), sumRow('tot', 'Personalkosten insgesamt', tot, C.eur(br) + ' + ' + C.eur(ag))];
    return askQ(C, 'Ein Angestellter hat ein Bruttogehalt von ' + C.eur(br) + '. Der Arbeitgeber trägt zusätzlich seinen Anteil zur Sozialversicherung von 20 % des Bruttogehalts (Übungswert, kein amtlicher Satz). Wie hoch sind die gesamten Personalkosten des Betriebs für diesen Angestellten?', rows, 'tot', 'Personalkosten insgesamt', '€',
      ['Für den Betrieb zählen das Bruttogehalt und der Arbeitgeberanteil, der zusätzlich anfällt.'], 'Personalkosten = Bruttogehalt + Arbeitgeberanteil zur Sozialversicherung.');
  });
  /* PRUEFEN: Lohnsteuer auf 4830, Sozialversicherung (AN-Anteil) auf 4840; die Auszahlung per Bank (2800). */
  add('Personal', 'Gehalt buchen', 3, (R, C) => {
    const br = C.ri(R, 22, 45, 1) * 100, lst = C.anteil(br, C.pick(R, [10, 12, 15])), sv = C.anteil(br, 20), net = C.auszahlung(br, lst, sv), sol = [L('S', '6300', br), L('H', '4830', lst), L('H', '4840', sv), L('H', '2800', net)];
    return buchQ(C, R, 'Gehaltsabrechnung eines Angestellten: Bruttogehalt ' + C.eur(br) + ', einbehaltene Lohnsteuer ' + C.eur(lst) + ', Arbeitnehmeranteil zur Sozialversicherung ' + C.eur(sv) + '. Der Auszahlungsbetrag wird per Bank überwiesen. Buche die Gehaltszahlung (der Arbeitgeberanteil wird hier nicht gebucht).', sol,
      ['Das Bruttogehalt ist der Aufwand. Steuer und Beiträge sind noch nicht abgeführt, sie sind Schulden. Nur der Rest geht an den Angestellten.'],
      'Auszahlung ' + C.eur(net) + ' = ' + C.eur(br) + ' − ' + C.eur(lst) + ' − ' + C.eur(sv) + '. Aufwand brutto im Soll; Lohnsteuer, Sozialversicherung und Bankzahlung im Haben: ' + C.bsText(sol) + '.');
  });

  /* ======================================================= Abschluss */
  /* PRUEFEN: Abschluss über 9300 GuV bzw. 9200 Schlussbilanzkonto; Gewinn/Verlust wird bei diesem Einzelunternehmen direkt über 3000 Eigenkapital gebucht (bei Gesellschaften anders, z. B. Gewinnvortrag/Jahresüberschuss). */
  add('Abschluss', 'Konto abschließen', 2, (R, C) => {
    const v = C.ri(R, 0, 3, 1);
    const opts = [[['6000', '6200', '6520', '6800']], [['5000', '5100']], [['2800', '2880', '2400', '0210']], [['4400', '4250', '4840']]][v][0], k = C.pick(R, opts), b = C.ri(R, 4, 80, 1) * 500; let sol, txt, tip, expl;
    if (v === 0) { sol = [L('S', '9300', b), L('H', k, b)]; txt = 'Das Aufwandskonto ' + C.kontoLabel(k) + ' weist zum Jahresende einen Saldo von ' + C.eur(b) + ' aus. Buche den Abschluss dieses Kontos.'; tip = 'Aufwandskonten werden über das Gewinn- und Verlustkonto abgeschlossen. Der Saldo steht auf der Seite, die das Konto ausgleicht.'; expl = 'Der Aufwand steht im Soll des Kontos, zum Ausgleich wird er im Haben gebucht. Das Gegenkonto ist das GuV-Konto (Soll): '; }
    else if (v === 1) { sol = [L('S', k, b), L('H', '9300', b)]; txt = 'Das Ertragskonto ' + C.kontoLabel(k) + ' weist zum Jahresende einen Saldo von ' + C.eur(b) + ' aus. Buche den Abschluss dieses Kontos.'; tip = 'Ertragskonten werden über das Gewinn- und Verlustkonto abgeschlossen. Der Saldo steht auf der Seite, die das Konto ausgleicht.'; expl = 'Der Ertrag steht im Haben des Kontos, zum Ausgleich wird er im Soll gebucht. Das Gegenkonto ist das GuV-Konto (Haben): '; }
    else if (v === 2) { sol = [L('S', '9200', b), L('H', k, b)]; txt = 'Das Aktivkonto ' + C.kontoLabel(k) + ' weist zum Jahresende einen Endbestand von ' + C.eur(b) + ' aus. Buche den Abschluss dieses Kontos.'; tip = 'Bestandskonten werden über das Schlussbilanzkonto abgeschlossen. Der Endbestand eines Aktivkontos steht im Soll, also wird zum Ausgleich im Haben gebucht.'; expl = 'Aktivkonto: Der Endbestand wird im Haben ausgeglichen, das Schlussbilanzkonto bekommt ihn im Soll: '; }
    else { sol = [L('S', k, b), L('H', '9200', b)]; txt = 'Das Passivkonto ' + C.kontoLabel(k) + ' weist zum Jahresende einen Endbestand von ' + C.eur(b) + ' aus. Buche den Abschluss dieses Kontos.'; tip = 'Bestandskonten werden über das Schlussbilanzkonto abgeschlossen. Der Endbestand eines Passivkontos steht im Haben, also wird zum Ausgleich im Soll gebucht.'; expl = 'Passivkonto: Der Endbestand wird im Soll ausgeglichen, das Schlussbilanzkonto bekommt ihn im Haben: '; }
    return buchQ(C, R, txt, sol, [tip], expl + C.bsText(sol) + '.');
  });
  add('Abschluss', 'Gewinn oder Verlust ermitteln', 2, (R, C) => {
    let e1, e2, a1, a2, a3;
    do { e1 = C.ri(R, 20, 120, 5) * 1000; e2 = C.ri(R, 2, 20, 1) * 1000; a1 = C.ri(R, 20, 100, 5) * 1000; a2 = C.ri(R, 10, 60, 5) * 1000; a3 = C.ri(R, 2, 12, 1) * 1000; } while ([e1, e2, a1, a2, a3].includes(Math.abs(e1 + e2 - a1 - a2 - a3)) || e1 + e2 === a1 + a2 + a3);
    const er = C.summe([e1, e2]), au = C.summe([a1, a2, a3]), res = C.ergebnis(er, au);
    const rows = [row('er', 'Erträge', '', er, { calc: C.eur(e1) + ' + ' + C.eur(e2) }), row('au', 'Aufwendungen', '−', au, { calc: C.eur(a1) + ' + ' + C.eur(a2) + ' + ' + C.eur(a3) }), sumRow('res', res >= 0 ? 'Gewinn' : 'Verlust', res, C.eur(er) + ' − ' + C.eur(au))];
    return askQ(C, 'Zum Jahresabschluss haben die Erfolgskonten diese Salden: Umsatzerlöse für Erzeugnisse ' + C.eur(e1) + ', Umsatzerlöse für Waren ' + C.eur(e2) + '; Aufwendungen für Rohstoffe ' + C.eur(a1) + ', Löhne ' + C.eur(a2) + ', Abschreibungen ' + C.eur(a3) + '. Wie hoch ist das Jahresergebnis? Einen Verlust gibst du als negative Zahl an.', rows, 'res', 'Ergebnis (Gewinn +, Verlust −)', '€',
      ['Im Gewinn- und Verlustkonto werden Erträge und Aufwendungen gegenübergestellt. Der Unterschied ist das Ergebnis des Jahres.'], 'Ergebnis = Erträge − Aufwendungen. Positiv: Gewinn, negativ: Verlust.');
  });
  add('Abschluss', 'Gewinn- und Verlustkonto abschließen', 3, (R, C) => {
    const loss = R() < 0.35, au = C.ri(R, 40, 140, 5) * 1000, d = C.ri(R, 2, 20, 1) * 1000, er = loss ? au - d : au + d, res = C.ergebnis(er, au), b = Math.abs(res);
    const sol = loss ? [L('S', '3000', b), L('H', '9300', b)] : [L('S', '9300', b), L('H', '3000', b)];
    return buchQ(C, R, 'Im Gewinn- und Verlustkonto eines Einzelunternehmens stehen Aufwendungen von ' + C.eur(au) + ' und Erträge von ' + C.eur(er) + '. Buche den Abschluss des Gewinn- und Verlustkontos.', sol,
      ['Zuerst: Ist es Gewinn oder Verlust? Das Ergebnis geht in das Eigenkapital: Ein Gewinn erhöht es, ein Verlust mindert es.', 'Gewinn: Das Eigenkapital nimmt zu (Haben). Verlust: Das Eigenkapital nimmt ab (Soll).'],
      (loss ? 'Aufwendungen ' + C.eur(au) + ' > Erträge ' + C.eur(er) + ': Verlust ' + C.eur(b) + '. Das Eigenkapital sinkt (Soll), das GuV-Konto wird ausgeglichen (Haben): ' : 'Erträge ' + C.eur(er) + ' > Aufwendungen ' + C.eur(au) + ': Gewinn ' + C.eur(b) + '. Das GuV-Konto wird ausgeglichen (Soll), das Eigenkapital steigt (Haben): ') + C.bsText(sol) + '.');
  });

  /* ======================================================= Beispiele (fertig durchgerechnet) */
  const ex = (id, title, text, buchungen, ab, note) => ({ id, title, text, buchungen: buchungen.map(b => ({ t: b[0], lines: b[1].map(l => L(l[0], l[1], l[2])) })), ab: ab || {}, note });
  const examples = [
    ex('b1', 'Aktivtausch: Einzahlung auf das Bankkonto', 'Aus der Kasse werden 2.000,00 € auf das Bankkonto eingezahlt. Anfangsbestände: Bank 20.000,00 €, Kasse 5.000,00 €.', [['Einzahlung', [['S', '2800', 2000], ['H', '2880', 2000]]]], { '2800': 20000, '2880': 5000 }, 'Beide Konten sind Aktivkonten: Der Bestand steigt im Soll, er sinkt im Haben. Die Bilanzsumme ändert sich nicht.'),
    ex('b2', 'Wareneinkauf auf Ziel mit Umsatzsteuer', 'Wir kaufen Rohstoffe auf Ziel: netto 5.000,00 € zuzüglich 19 % Umsatzsteuer (950,00 €).', [['Eingangsrechnung', [['S', '6000', 5000], ['S', '2600', 950], ['H', '4400', 5950]]]], {}, 'Aufwand netto, Vorsteuer getrennt, Verbindlichkeit brutto. Es steht immer Soll = Haben (5.950,00 € = 5.950,00 €).'),
    ex('b3', 'Verkauf auf Ziel', 'Wir verkaufen Handelswaren auf Ziel: netto 3.000,00 € zuzüglich 19 % Umsatzsteuer (570,00 €).', [['Ausgangsrechnung', [['S', '2400', 3570], ['H', '5100', 3000], ['H', '4800', 570]]]], {}, 'Die Umsatzsteuer ist kein Erlös, sondern eine Schuld gegenüber dem Finanzamt. Nur der Nettobetrag ist Ertrag.'),
    ex('b4', 'Umsatzsteuer-Zahllast ermitteln und buchen', 'Ein Verkauf (netto 20.000,00 €) und ein Einkauf (netto 12.500,00 €), jeweils mit 19 % Umsatzsteuer. Am Monatsende wird die Zahllast ermittelt.', [['Verkauf auf Ziel', [['S', '2400', 23800], ['H', '5000', 20000], ['H', '4800', 3800]]], ['Einkauf auf Ziel', [['S', '6000', 12500], ['S', '2600', 2375], ['H', '4400', 14875]]], ['Ausgleich der Steuerkonten', [['S', '4800', 3800], ['H', '2600', 2375], ['H', '4830', 1425]]]], {}, 'Zahllast = Umsatzsteuer 3.800,00 € − Vorsteuer 2.375,00 € = 1.425,00 €. Beide Steuerkonten sind danach ausgeglichen.'),
    ex('b5', 'Lineare Abschreibung einer Maschine', 'Eine Maschine (Anschaffungskosten 48.000,00 €, Nutzungsdauer 8 Jahre, Restwert 0 €) wird am Jahresende abgeschrieben.', [['Abschreibung', [['S', '6520', 6000], ['H', '0210', 6000]]]], { '0210': 48000 }, 'AfA = 48.000,00 € : 8 = 6.000,00 € pro Jahr. Der Restbuchwert nach dem ersten Jahr beträgt 42.000,00 €.'),
    ex('b6', 'Einkauf und Zahlung mit Skonto', 'Rohstoffe netto 5.000,00 € (Rechnung 5.950,00 € brutto) werden auf Ziel gekauft und später unter 2 % Skonto bezahlt.', [['Eingangsrechnung', [['S', '6000', 5000], ['S', '2600', 950], ['H', '4400', 5950]]], ['Zahlung mit Skonto', [['S', '4400', 5950], ['H', '2800', 5831], ['H', '6002', 100], ['H', '2600', 19]]]], {}, 'Skonto brutto: 2 % von 5.950,00 € = 119,00 €, davon Umsatzsteuer 19,00 € und Nettoskonto 100,00 €. Gezahlt werden 5.831,00 €.'),
    ex('b7', 'Gehaltsabrechnung mit Arbeitgeberanteil', 'Bruttogehalt 3.000,00 €, Lohnsteuer 360,00 €, Arbeitnehmeranteil zur Sozialversicherung 600,00 €. Der Arbeitgeberanteil beträgt ebenfalls 600,00 € (Übungswerte).', [['Gehaltszahlung', [['S', '6300', 3000], ['H', '4830', 360], ['H', '4840', 600], ['H', '2800', 2040]]], ['Arbeitgeberanteil', [['S', '6400', 600], ['H', '4840', 600]]]], {}, 'Auszahlung: 3.000,00 € − 360,00 € − 600,00 € = 2.040,00 €. Die Sozialversicherung (1.200,00 €) und die Lohnsteuer werden später abgeführt.'),
    ex('b8', 'Jahresabschluss über das GuV-Konto', 'Salden: Umsatzerlöse 60.000,00 €; Aufwendungen für Rohstoffe 30.000,00 €, Löhne 12.000,00 €, Abschreibungen 6.000,00 €.', [['Aufwandskonten abschließen', [['S', '9300', 48000], ['H', '6000', 30000], ['H', '6200', 12000], ['H', '6520', 6000]]], ['Ertragskonto abschließen', [['S', '5000', 60000], ['H', '9300', 60000]]], ['GuV-Konto abschließen (Gewinn)', [['S', '9300', 12000], ['H', '3000', 12000]]]], { '5000': 60000, '6000': 30000, '6200': 12000, '6520': 6000 }, 'Erträge 60.000,00 € − Aufwendungen 48.000,00 € = Gewinn 12.000,00 €. Der Gewinn erhöht das Eigenkapital. In den T-Konten steht „Jahr“ für die Buchungen des Geschäftsjahres vor dem Abschluss.')
  ];

  root.BUC_DATA = { tasks, examples, CATS };
  root.BUC_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.BUC_DATA, TASKS: root.BUC_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
