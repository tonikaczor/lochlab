'use strict';
/* Tonfunk Normen und Konformität: Daten (Themen, Erklärtexte, Aufgaben-Generatoren). Kennung 'nrm', Stufe 'studium' (siehe LAB-META.json).
   window.NRM_DATA { topics, cats, explain, tasks, gens, make(t, R), makeTask(t), randomQ(R, level, topic), NOTE, LOCS, CLAUSE_TASKS }
   window.NRM_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.nrm.done' = {id:true})
   Alle Zahlen und Entscheidungen entstehen aus NRM_CORE: jede Aufgabe hat einen Generator mit festem Seed (id), q.value ist die Hauptrechnung,
   q.alt eine unabhängige Zweitrechnung (NRM_CORE.chk, anderer Rechenweg), die der Test dagegen prüft. Keine Zahl der Lösung steht von Hand im Text.
   Alle Texte sind eigene Zusammenfassungen und Lernmodelle, keine Normtexte. Maßgeblich ist immer die aktuelle Normfassung. */
(function (root) {
  const C = () => root.NRM_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const ex = v => C().fmtExp(v, 2);
  const NOTE = 'Eigene Zusammenfassung und vereinfachtes Lernmodell, kein Normtext. Maßgeblich ist die aktuelle Normfassung.';
  const CATS = ['CE-Kennzeichnung und Richtlinien', 'Schutzarten, Kategorien, Strecken', 'Sicherheit von Maschinen', 'Prüfen elektrischer Geräte', 'Qualität nach ISO 9001'];
  const TOPICS = [
    { k: 'ce', icon: '✔', name: CATS[0], short: 'CE' }, { k: 'sk', icon: '⚡', name: CATS[1], short: 'Schutzarten' }, { k: 'ms', icon: '🛑', name: CATS[2], short: 'Maschinen' },
    { k: 'pf', icon: '🔌', name: CATS[3], short: 'Prüfen' }, { k: 'qm', icon: '📋', name: CATS[4], short: 'Qualität' }
  ];
  const numQ = o => ({ text: o.text, ask: { type: 'num', unit: o.unit, label: o.label }, value: o.value, alt: o.alt, tol: o.tol, expl: o.expl, tips: o.tips, mod360: false });
  function choiceQ(R, o) {
    const ch = C().shuffle(R, [o.right].concat(o.wrong));
    return { text: o.text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(o.right) }, value: ch.indexOf(o.right), alt: ch.indexOf(o.altRight == null ? o.right : o.altRight), tol: 0, expl: o.expl, tips: o.tips };
  }
  const tolOf = (v, rel, min) => Math.max(min, Math.abs(v) * rel);
  const pk = (R, a) => C().pick(R, a), ri = (R, a, b) => C().ri(R, a, b);
  const SHORT = { LVD: 'LVD', EMV: 'EMV', MD: 'MD', RED: 'RED', ROHS: 'RoHS', WEEE: 'WEEE', REACH: 'REACH' };
  const lst = a => a.map(x => SHORT[x]).join(', ');
  const ids7 = ['LVD', 'EMV', 'MD', 'RED', 'ROHS', 'WEEE', 'REACH'];
  function describe(p) {
    const q = C().norm(p), a = [];
    a.push(q.ee ? (q.funktion ? 'elektrisches Gerät' : 'elektrisches Bauteil ohne eigene Funktion') : 'nichtelektrisches Produkt');
    if (q.funk) a.push('mit absichtlicher Funkfunktion'); if (q.maschine) a.push('angetriebene Maschine mit beweglichen Teilen');
    if (q.vac > 0) a.push('Bemessungsspannung ' + f(q.vac, 1) + ' V AC'); if (q.vdc > 0) a.push('Bemessungsspannung ' + f(q.vdc, 1) + ' V DC');
    if (q.vac === 0 && q.vdc === 0 && q.ee) a.push('ohne Bemessungsspannung angegeben');
    if (q.ausnahme) a.push('Einstufung: ' + C().EXC[q.ausnahme]);
    return a.join(', ');
  }
  function randProduct(R) {
    const mode = R() < 0.5, p = { ee: R() < 0.92, funktion: true, funk: R() < 0.3, maschine: R() < 0.3, vac: 0, vdc: 0, ausnahme: '' };
    if (mode) p.vac = pk(R, [24, 48, 49, 50, 120, 230, 400, 690, 1000, 1200]); else p.vdc = pk(R, [5, 12, 24, 48, 60, 74, 75, 110, 1500, 1600]);
    if (!p.funk && p.ee && R() < 0.15) p.ausnahme = 'gross';
    if (!p.ee && !p.funk) { p.vac = 0; p.vdc = 0; p.maschine = true; p.ausnahme = ''; }
    return p;
  }
  const reasonsOf = d => d.rows.filter(r => r.applies).map(r => C().DIR[r.id].name + ': ' + r.text);
  const TIPS_CE = ['Gehe die Rechtsvorschriften der Reihe nach durch: Funk? Maschine? Spannungsbereich? Elektrogerät mit eigener Funktion?', 'LVD gilt von 50 bis 1000 V AC bzw. 75 bis 1500 V DC, aber nicht für Funkgeräte und Maschinen. REACH gilt immer. RoHS und WEEE gelten für Elektrogeräte bis 1000 V AC bzw. 1500 V DC ohne Ausnahme.', 'Eine Funkanlage fällt unter die RED, die Sicherheit und EMV mit regelt. Eine Maschine fällt unter die Maschinenrichtlinie (elektrische Gefährdungen eingeschlossen) und zusätzlich unter die EMV-Richtlinie.'];

  const G = {};
  /* ================================================================ CE (ce) */
  G.ce1 = R => {
    const c = C(), pr = pk(R, c.PRODUCTS), d = c.directives(pr.p), right = lst(d.list), alt = c.chk.directives(pr.p);
    const wr = new Set(); let guard = 0;
    while (wr.size < 3 && guard++ < 200) { const a = d.list.filter(x => x !== 'REACH'), id = pk(R, ids7.filter(x => x !== 'REACH')), n = a.includes(id) ? a.filter(x => x !== id) : a.concat([id]).sort((x, y) => ids7.indexOf(x) - ids7.indexOf(y)); const s = lst(n.concat(['REACH'])); if (s !== right) wr.add(s); }
    return choiceQ(R, { text: 'Welche Rechtsvorschriften gelten nach dem Lernmodell für das Produkt „' + pr.name + '“ (' + describe(pr.p) + ')?', right, altRight: lst(alt), wrong: [...wr],
      expl: ['Das Produkt: ' + describe(pr.p) + '.'].concat(reasonsOf(d)).concat(['Ergebnis: ' + right + '. Davon CE-pflichtig: ' + (d.ceList.length ? lst(d.ceList) : 'keine') + '.']), tips: TIPS_CE });
  };
  G.ce2 = R => {
    const c = C(), p = randProduct(R), d = c.directives(p), v = d.ceList.length;
    return numQ({ text: 'Ein Produkt: ' + describe(p) + '. Für wie viele der Rechtsvorschriften LVD, EMV, MD, RED und RoHS (die eine CE-Kennzeichnung verlangen) gilt es nach dem Lernmodell?', unit: '', label: 'Anzahl CE-pflichtiger Rechtsvorschriften (ohne Einheit)', value: v, alt: c.chk.directives(p).filter(x => c.DIR[x].ce).length, tol: 0.1,
      expl: ['Die Rechtsvorschriften mit CE-Kennzeichnung sind LVD, EMV, MD, RED und RoHS. REACH und WEEE verlangen keine CE-Kennzeichnung.'].concat(reasonsOf(d).filter(s => !/^REACH|^WEEE/.test(s))).concat(['Anzahl: ' + f(v, 0) + (v ? ' (' + lst(d.ceList) + ')' : ' (keine)') + '.']),
      tips: ['Zähle nur die fünf CE-pflichtigen Rechtsvorschriften, nicht REACH und WEEE.', 'Funk: RED statt LVD und EMV. Maschine: MD plus EMV, keine eigene LVD. Spannungsgrenzen der LVD: 50 bis 1000 V AC, 75 bis 1500 V DC.', 'Prüfe nacheinander RED, MD, LVD, EMV, RoHS und zähle die Treffer.'] });
  };
  G.ce3 = R => {
    const c = C(), pr = pk(R, c.PRODUCTS.filter(x => x.p.funk)), d = c.directives(pr.p), alt = c.chk.directives(pr.p);
    const right = 'Die Funkanlagenrichtlinie (RED): sie umfasst Funk, Sicherheit und EMV', okAlt = alt.includes('RED') && !alt.includes('LVD') && !alt.includes('EMV');
    const wrong = ['Niederspannungsrichtlinie und EMV-Richtlinie getrennt, die RED nur für die Funkfrequenzen', 'Die Maschinenrichtlinie, weil das Gerät Bauteile enthält, die sich bewegen können', 'Keine, weil Geräte mit Akku nicht unter die EU-Richtlinien fallen'];
    return choiceQ(R, { text: 'Das Produkt „' + pr.name + '“ sendet und empfängt Funk. Welche Richtlinie ist für Funk, elektrische Sicherheit und EMV zusammen maßgeblich?', right, altRight: okAlt ? right : wrong[0], wrong,
      expl: ['Das Produkt hat eine absichtliche Funkfunktion, ist also eine Funkanlage.', 'Die RED enthält in Artikel 3 die Schutzziele für Sicherheit, EMV und Funkspektrum. LVD und EMV-Richtlinie werden dafür nicht zusätzlich angewendet.', 'Ergebnis: ' + lst(d.list) + '. CE-pflichtig: ' + lst(d.ceList) + '.'],
      tips: ['Frage: Gibt es eine absichtliche Funkfunktion (Bluetooth, WLAN, Mobilfunk)?', 'Für Funkanlagen gibt es eine eigene Richtlinie, die mehrere Schutzziele bündelt.', 'RED, Artikel 3: Gesundheit und Sicherheit, EMV und effiziente Nutzung des Funkspektrums.'] });
  };
  const SL = { rl: 'Rechtsvorschriften bestimmen', norm: 'Normen wählen', risk: 'Risikobeurteilung', konstr: 'Konstruktion und Prüfung', doku: 'Technische Dokumentation', verf: 'Bewertungsverfahren', kerkl: 'Konformitätserklärung', ce: 'CE-Kennzeichnung', inv: 'Inverkehrbringen', aufb: 'Aufbewahren (10 Jahre)' };
  const orderTxt = o => o.map(i => SL[i]).join(' → ');
  function violation(o) { const seen = new Set(); for (const id of o) { const s = C().STEP[id]; const miss = s.after.find(a => !seen.has(a)); if (miss) return '„' + SL[id] + '“ steht vor „' + SL[miss] + '“, braucht sie aber als Voraussetzung'; seen.add(id); } return 'keine Verletzung'; }
  G.ce4 = R => {
    const c = C(), ids = c.STEPS.map(s => s.id), valid = [ids, ids.map(x => (x === 'norm' ? 'risk' : x === 'risk' ? 'norm' : x))], right = pk(R, valid), wr = [], seen = new Set([right.join()]);
    let guard = 0;
    while (wr.length < 3 && guard++ < 500) { const o = right.slice(), i = ri(R, 0, 9), j = ri(R, 0, 9); if (i === j) continue; [o[i], o[j]] = [o[j], o[i]]; if (c.stepsOk(o) || seen.has(o.join())) continue; seen.add(o.join()); wr.push(o); }
    const alt = [right].concat(wr).find(o => c.chk.stepsOk(o));
    return choiceQ(R, { text: 'Ein Hersteller will das Produkt „' + pk(R, c.PRODUCTS).name + '“ in Verkehr bringen. Welche Reihenfolge der Konformitätsbewertung ist stimmig? Jeder Schritt setzt die vorherigen Ergebnisse voraus.', right: orderTxt(right), altRight: orderTxt(alt || wr[0]), wrong: wr.map(orderTxt),
      expl: ['Die Folge richtet sich nach den Abhängigkeiten: Rechtsvorschriften bestimmen, dann Normen und Risikobeurteilung (beide in beliebiger Reihenfolge), dann Konstruktion und Prüfung, dann Dokumentation und Verfahren, erst danach Erklärung und CE-Kennzeichnung.', 'Richtig: ' + orderTxt(right) + '.'].concat([...new Set(wr.map(violation))].map(v => 'Falsch: ' + v + '.')),
      tips: ['Die CE-Kennzeichnung ist der letzte Schritt vor dem Inverkehrbringen: Sie folgt der Konformitätserklärung.', 'Ohne Risikobeurteilung und Norm gibt es nichts zu konstruieren und zu prüfen; ohne Prüfergebnisse keine Dokumentation.', 'Suche in jeder Antwort den Schritt, der vor seiner Voraussetzung steht.'] });
  };
  G.ce5 = R => {
    const c = C(), ac = R() < 0.5, v = ac ? pk(R, [24, 48, 49, 50, 230, 400, 690, 1000, 1001, 1200]) : pk(R, [12, 24, 48, 60, 74, 75, 110, 750, 1500, 1501, 1800]), p = ac ? { ee: 1, vac: v } : { ee: 1, vdc: v };
    const d = c.directives(p), lvd = d.list.includes('LVD'), lo = ac ? 50 : 75, hi = ac ? 1000 : 1500, kind = lvd ? 0 : v < lo ? 1 : 2;
    const ch = ['Die Niederspannungsrichtlinie gilt für dieses Gerät', 'Sie gilt nicht, weil die Spannung unter dem Bereich liegt', 'Sie gilt nicht, weil die Spannung über dem Bereich liegt'];
    const altKind = c.chk.directives(p).includes('LVD') ? 0 : v < lo ? 1 : 2;
    return choiceQ(R, { text: 'Ein elektrisches Gerät (kein Funk, keine Maschine) hat eine Bemessungsspannung von ' + f(v, 0) + ' V ' + (ac ? 'AC (Effektivwert)' : 'DC') + '. Gilt die Niederspannungsrichtlinie?', right: ch[kind], altRight: ch[altKind], wrong: ch.filter((_, i) => i !== kind),
      expl: ['Bereich der LVD: ' + (ac ? '50 V bis 1000 V AC' : '75 V bis 1500 V DC') + ' (beide Grenzen eingeschlossen).', f(v, 0) + ' V liegt ' + (kind === 0 ? 'im Bereich ' + f(lo, 0) + ' bis ' + f(hi, 0) + ' V.' : kind === 1 ? 'unter ' + f(lo, 0) + ' V.' : 'über ' + f(hi, 0) + ' V.'), kind === 0 ? 'Ergebnis: Die LVD gilt (zusammen mit EMV, RoHS, WEEE, REACH).' : 'Ergebnis: Die LVD gilt nicht; EMV und die Stoffvorschriften können trotzdem gelten.'],
      tips: ['Die LVD hat eine untere und eine obere Spannungsgrenze, getrennt für Wechsel- und Gleichspannung.', 'AC: 50 bis 1000 V. DC: 75 bis 1500 V. Die Grenzen selbst gehören dazu.', 'Vergleiche den Wert mit der passenden Zeile (AC oder DC).'] });
  };
  G.ce6 = R => {
    const c = C(), m = ri(R, 4, 40) * 10, s = ri(R, 2, 60) * 10, v = c.sharePct(s, m * 1000);
    return numQ({ text: 'Ein Kabelstecker (ein Erzeugnis) wiegt ' + m + ' g und enthält ' + s + ' mg eines besonders besorgniserregenden Stoffs (SVHC). Wie groß ist der Massenanteil des Stoffs im Erzeugnis in Prozent?', unit: '%', label: 'Massenanteil', value: v, alt: s / m / 1000 * 100, tol: tolOf(v, 0.005, 0.01),
      expl: ['Massenanteil = Masse des Stoffs / Masse des Erzeugnisses, beide in derselben Einheit.', m + ' g = ' + f(m * 1000, 0) + ' mg.', 'w = ' + s + ' mg / ' + f(m * 1000, 0) + ' mg = ' + f(v / 100, 5) + ' = ' + f(v, 3) + ' %.'],
      tips: ['Beide Massen in dieselbe Einheit bringen: 1 g = 1000 mg.', 'Anteil in Prozent = Stoffmasse / Gesamtmasse · 100.', 'Rechne ' + s + ' / ' + f(m * 1000, 0) + ' und multipliziere mit 100.'] });
  };
  G.ce7 = R => {
    const c = C(), m = pk(R, [50, 100, 200, 250, 400, 500]), pct = pk(R, [0.05, 0.1, 0.1, 0.12, 0.2, 0.09]), s = m * 1000 * pct / 100, sh = c.sharePct(s, m * 1000), over = c.exceeds(sh, c.REACH_PCT);
    const ch = ['Die Informationspflicht besteht (Anteil über 0,1 %)', 'Keine Informationspflicht (Anteil höchstens 0,1 %)', 'Das Erzeugnis darf nicht in Verkehr gebracht werden'], k = over ? 0 : 1;
    const altOver = s * 1000 > m * 1000 + 1e-6;   /* in µg gerechnet (0,1 % von m g = m·1000 µg), unabhängig von sharePct */
    return choiceQ(R, { text: 'Ein Erzeugnis wiegt ' + m + ' g und enthält ' + f(s, 2) + ' mg eines SVHC aus der Kandidatenliste. Besteht die Informationspflicht nach REACH Artikel 33 (Lernmodell: Schwelle 0,1 % der Erzeugnismasse)?', right: ch[k], altRight: ch[altOver ? 0 : 1], wrong: ch.filter((_, i) => i !== k),
      expl: ['Anteil = ' + f(s, 2) + ' mg / ' + f(m * 1000, 0) + ' mg = ' + f(sh, 3) + ' %.', 'Die Pflicht entsteht erst bei einem Anteil über 0,1 %; genau 0,1 % löst sie noch nicht aus.', over ? 'Ergebnis: ' + f(sh, 3) + ' % > 0,1 %, die Informationspflicht besteht.' : 'Ergebnis: ' + f(sh, 3) + ' % ≤ 0,1 %, keine Informationspflicht. Ein Verbot folgt nicht aus der Informationspflicht.'],
      tips: ['Rechne den Massenanteil des Stoffs im Erzeugnis aus.', 'Schwelle: über 0,1 % der Masse des Erzeugnisses. Gleich 0,1 % reicht nicht.', 'Die Informationspflicht ist kein Verbot; sie betrifft die Weitergabe der Information in der Lieferkette.'] });
  };
  G.ce8 = R => {
    const c = C(), mt = pk(R, [['Lot an einer Platine', ['Pb', 'Cd']], ['Kunststoff-Gehäuseteil', ['DEHP', 'DBP', 'Cd', 'PBDE']], ['Leitungsmantel', ['DEHP', 'Pb', 'Cd']], ['Beschichtung eines Steckers', ['Cr6', 'Cd', 'Pb']]]), mat = mt[0], sub = pk(R, mt[1]), m = pk(R, [20, 40, 80, 150, 250, 500]), v = c.rohsMaxMass(sub, m * 1000), name = c.ROHS_LIMITS.find(x => x.id === sub).name, lim = c.rohsLimitPct(sub);
    return numQ({ text: 'Der homogene Werkstoff „' + mat + '“ wiegt ' + m + ' g. Wie viel ' + name + ' darf er nach dem RoHS-Grenzwert (' + f(lim, 2) + ' % der Masse des homogenen Werkstoffs) höchstens enthalten?', unit: 'mg', label: 'Höchstmasse', value: v, alt: m * 1000 * lim * 10000 / 1e6, tol: tolOf(v, 0.005, 0.01),
      expl: ['Der Grenzwert ' + f(lim, 2) + ' % gilt je homogenem Werkstoff (nicht für das ganze Gerät).', m + ' g = ' + f(m * 1000, 0) + ' mg.', 'm_max = ' + f(m * 1000, 0) + ' mg · ' + f(lim, 2) + ' % / 100 = ' + f(v, 3) + ' mg.'],
      tips: ['Der Grenzwert bezieht sich auf die Masse des homogenen Werkstoffs, also des Teils, das sich nicht mechanisch weiter zerlegen lässt.', 'Cadmium: 0,01 %, die anderen Stoffe der Liste: 0,1 %.', 'Höchstmasse = Werkstoffmasse · Grenzwert / 100. Masse zuerst in mg umrechnen.'] });
  };
  G.ce9 = R => {
    const c = C(), sc = pk(R, [{ id: 'MD', o: { anhangIV: false }, t: 'Eine Maschine, die nicht in der Liste der besonders gefährlichen Maschinen steht (Anhang IV der Maschinenrichtlinie, ab 20.01.2027 Anhang I der Maschinenverordnung)' }, { id: 'MD', o: { anhangIV: true, normen: true }, t: 'Eine Maschine aus der Liste der besonders gefährlichen Maschinen (Anhang IV der Maschinenrichtlinie, ab 20.01.2027 Anhang I der Maschinenverordnung), bei der alle einschlägigen harmonisierten Normen angewandt werden' }, { id: 'MD', o: { anhangIV: true, normen: false }, t: 'Eine Maschine aus der Liste der besonders gefährlichen Maschinen (Anhang IV der Maschinenrichtlinie, ab 20.01.2027 Anhang I der Maschinenverordnung), bei der keine harmonisierte Norm angewandt wird' }, { id: 'RED', o: { normen: true }, t: 'Eine Funkanlage, bei der alle einschlägigen harmonisierten Normen angewandt werden' }, { id: 'RED', o: { normen: false }, t: 'Eine Funkanlage, bei der die harmonisierten Normen nicht oder nur teilweise angewandt werden' }, { id: 'LVD', o: {}, t: 'Ein Netzteil nach der Niederspannungsrichtlinie' }]);
    const k = c.verfahren(sc.id, sc.o), ch = { intern: 'Der Hersteller bewertet allein (interne Fertigungskontrolle)', benannt: 'Eine Benannte Stelle muss mitwirken', wahl: 'Der Hersteller darf wählen: allein oder mit Benannter Stelle' }, kk = c.chk.verfahren(sc.id, sc.o);
    return choiceQ(R, { text: sc.t + '. Wie läuft die Konformitätsbewertung im Lernmodell ab?', right: ch[k], altRight: ch[kk], wrong: Object.keys(ch).filter(x => x !== k).map(x => ch[x]),
      expl: ['Im Normalfall (LVD, EMV, RoHS und Maschinen außerhalb von Anhang IV) darf der Hersteller selbst bewerten (Modul A, interne Fertigungskontrolle).', 'Sonderfälle: Anhang-IV-Maschine ohne vollständig angewandte Normen und Funkanlage ohne angewandte harmonisierte Normen brauchen eine Benannte Stelle; eine Anhang-IV-Maschine mit angewandten Normen lässt die Wahl.', 'Nach der Maschinenverordnung gibt es zusätzlich Maschinen (Anhang I Teil A), bei denen immer eine Benannte Stelle mitwirkt.', 'Ergebnis für diesen Fall: ' + ch[k] + '.'],
      tips: ['Frage: Muss überhaupt eine staatlich benannte Stelle beteiligt werden?', 'Harmonisierte Normen geben die Vermutung der Konformität; fehlen sie, steigen die Anforderungen an den Nachweis.', 'Standardfall: Hersteller allein. Ausnahmen: Anhang IV ohne Normen, Funk ohne Normen.'] });
  };
  G.ce10 = R => {
    const c = C(), p = randProduct(R), d = c.directives(p), v = d.list.length;
    return numQ({ text: 'Ein Produkt: ' + describe(p) + '. Für wie viele der sieben Rechtsvorschriften (LVD, EMV, MD, RED, RoHS, WEEE, REACH) gilt es im Lernmodell insgesamt?', unit: '', label: 'Anzahl geltender Rechtsvorschriften (ohne Einheit)', value: v, alt: c.chk.directives(p).length, tol: 0.1,
      expl: ['Zu prüfen sind alle sieben Vorschriften, auch REACH und WEEE (ohne CE-Kennzeichnung).'].concat(reasonsOf(d)).concat(['Anzahl: ' + f(v, 0) + ' (' + lst(d.list) + ').']),
      tips: ['REACH gilt immer. Für den Rest brauchst du Funk, Maschine, Spannung, Funktion und Ausnahmen.', 'RoHS und WEEE: Elektrogerät mit eigener Funktion bis 1000 V AC bzw. 1500 V DC, nicht bei Großanlagen, Fahrzeugen oder Militär.', 'Gehe die sieben Rechtsvorschriften einzeln durch und zähle die Treffer.'] });
  };

  /* ================================================================ Schutzarten (sk) */
  const SKTXT = {
    1: ['Ein Gerät mit Metallgehäuse hat ein dreiadriges Netzkabel; die grüngelbe Ader verbindet das Gehäuse mit dem Schutzleiter der Steckdose.', 'Eine Bohrmaschine hat einen Stecker mit Schutzkontakt. Das Metallgehäuse ist mit dem Schutzleiter verbunden, im Inneren trennt eine Basisisolierung die Netzspannung vom Gehäuse.'],
    2: ['Ein Gerät hat ein Kunststoffgehäuse, ein zweiadriges Netzkabel mit Flachstecker und trägt das Symbol aus zwei ineinanderliegenden Quadraten.', 'Ein Haartrockner besitzt keinen Schutzleiteranschluss. Die Netzspannung ist durch doppelte oder verstärkte Isolierung vom berührbaren Gehäuse getrennt.'],
    3: ['Eine Handlampe für enge Metallbehälter wird mit 12 V Sicherheitskleinspannung (SELV) aus einem Sicherheitstransformator versorgt und braucht keinen Schutzleiter.', 'Ein Gerät arbeitet ausschließlich mit Kleinspannung (SELV) aus einer getrennten Quelle; im Gerät tritt keine gefährliche Spannung auf.']
  };
  G.sk1 = R => {
    const c = C(), k = ri(R, 1, 3), txt = pk(R, SKTXT[k]), feat = { pe: k === 1, dbl: k === 2, elv: k === 3 }, ak = feat.pe ? 1 : feat.dbl ? 2 : 3;
    return choiceQ(R, { text: txt + ' Welche Schutzklasse hat das Gerät?', right: c.SK[k].name, altRight: c.SK[ak].name, wrong: [1, 2, 3].filter(x => x !== k).map(x => c.SK[x].name),
      expl: ['Schutzklasse I: ' + c.SK[1].kurz + '.', 'Schutzklasse II: ' + c.SK[2].kurz + '. Schutzklasse III: ' + c.SK[3].kurz + '.', 'Hier: ' + c.SK[k].name + '.'],
      tips: ['Entscheidend ist, wie die Gefahr am berührbaren Gehäuse verhindert wird.', 'I: Schutzleiter. II: doppelte oder verstärkte Isolierung (Doppelquadrat). III: Kleinspannung.', 'Gibt es einen Schutzleiteranschluss? Gibt es das Doppelquadrat? Wird nur mit Kleinspannung gearbeitet?'] });
  };
  G.sk2 = R => {
    const c = C(), a = ri(R, 1, 6), b = ri(R, 1, 8), code = 'IP' + a + b, rt = c.IP1[a] + '; ' + c.IP2[b], pa = /^IP(\d)(\d)$/.exec(code);
    const wr = new Set(); let guard = 0;
    while (wr.size < 3 && guard++ < 100) { const a2 = pk(R, [a, a, Math.min(6, a + 1), Math.max(1, a - 1), b <= 6 ? b : 6]), b2 = pk(R, [b, b, Math.min(9, b + 1), Math.max(1, b - 1), a]), s = c.IP1[a2] + '; ' + c.IP2[b2]; if (s !== rt) wr.add(s); }
    return choiceQ(R, { text: 'Ein Gehäuse trägt die Kennzeichnung ' + code + '. Was bedeutet das?', right: rt, altRight: c.IP1[+pa[1]] + '; ' + c.IP2[+pa[2]], wrong: [...wr],
      expl: ['Die erste Ziffer (' + a + ') gibt den Schutz gegen feste Körper und Staub an: ' + c.IP1[a] + '.', 'Die zweite Ziffer (' + b + ') gibt den Schutz gegen Wasser an: ' + c.IP2[b] + '.', 'Ergebnis für ' + code + ': ' + rt + '.'],
      tips: ['IP steht für den Schutz gegen Eindringen; zwei Ziffern folgen.', 'Erste Ziffer 0 bis 6: feste Körper und Staub. Zweite Ziffer 0 bis 9: Wasser.', 'Lies beide Ziffern getrennt und ordne sie den beiden Tabellen im Reiter „Schutzarten“ zu.'] });
  };
  const SOLTXT = { finger: 'Das Berühren mit dem Finger soll verhindert werden', werkzeug: 'Werkzeuge und dicke Drähte ab 2,5 mm sollen draußen bleiben', draht: 'dünne Drähte ab 1 mm sollen draußen bleiben', staub: 'das Gerät soll staubgeschützt sein', staubdicht: 'das Gerät soll staubdicht sein' };
  const WTXT = { 3: 'Sprühwasser (Regen bis 60° zur Senkrechten)', 4: 'Spritzwasser aus allen Richtungen', 5: 'Strahlwasser (zum Beispiel Gartenschlauch)', 6: 'starkes Strahlwasser (zum Beispiel schwere See)', 7: 'zeitweiliges Untertauchen', 8: 'dauerndes Untertauchen', 9: 'Hochdruckreiniger mit Heißwasser aus der Nähe' };
  G.sk3 = R => {
    const c = C(), sol = pk(R, Object.keys(SOLTXT)), w = pk(R, [3, 4, 5, 6, 7, 8, 9]), code = c.ipRequired(sol, w), a = c.SOLID[sol];
    const wr = new Set(); let guard = 0; const cand = [c.ipStr(a - 1, w), c.ipStr(a, w - 1 >= 0 ? w - 1 : 0), c.ipStr(Math.max(0, a - 1), Math.max(0, w - 1)), c.ipStr(a, Math.max(0, w - 2)), c.ipStr(Math.max(0, a - 2), w)].filter(x => x !== code && /^IP\d\d$/.test(x));
    cand.forEach(x => wr.add(x)); const wl = [...wr].slice(0, 3);
    return choiceQ(R, { text: 'Für ein Gehäuse im Außenbereich gilt: ' + SOLTXT[sol] + '; zusätzlich muss es gegen ' + WTXT[w] + ' geschützt sein. Welches ist die kleinste geeignete Schutzart?', right: code, altRight: c.chk.ipMin(sol, w), wrong: wl,
      expl: ['Erste Ziffer: ' + SOLTXT[sol] + ' → ' + a + ' (' + c.IP1[a] + ').', 'Zweite Ziffer: ' + WTXT[w] + ' → ' + w + ' (' + c.IP2[w] + ').', 'Kleinste geeignete Schutzart: ' + code + '. Jede Ziffer der Antwort muss mindestens so hoch sein wie gefordert (bei 7, 8 und 9 gilt die Einschränkung aus der Erklärung).'],
      tips: ['Ordne beide Anforderungen je einer Ziffer zu und setze sie zu IPab zusammen.', 'Für die zweite Ziffer: 3 Sprühwasser, 4 Spritzwasser, 5 Strahlwasser, 6 starkes Strahlwasser, 7 zeitweilig untertauchen, 8 dauernd untertauchen, 9 Hochdruck heiß.', 'Wähle die kleinste Kombination, die beides erfüllt.'] });
  };
  function ipClass(req, act) { if (req === act) return 'ja'; if (act < req) return 'nein'; if (act === 9) return 'zusatz'; if (act <= 6) return 'ja'; return req <= 4 || req >= 7 ? 'ja' : 'zusatz'; }
  G.sk4 = R => {
    const c = C(), pair = pk(R, [[7, 5], [8, 6], [9, 6], [6, 5], [5, 6], [6, 7], [8, 7], [7, 8], [4, 3], [7, 4], [8, 3], [6, 4], [9, 9], [5, 5], [9, 7]]), act = pair[0], req = pair[1];
    const k = c.ipCovers(c.ipStr(null, req), c.ipStr(null, act)) ? 'ja' : (act >= req ? 'zusatz' : 'nein'), kk = ipClass(req, act);
    const ch = { ja: 'Ja, die Anforderung ist erfüllt', nein: 'Nein, die Schutzart ist niedriger als gefordert', zusatz: 'Nicht automatisch: Dafür ist eine eigene Prüfung oder Doppelkennzeichnung nötig' };
    return choiceQ(R, { text: 'Ein Gehäuse ist mit IPX' + act + ' gekennzeichnet. Gefordert ist IPX' + req + '. Erfüllt das Gehäuse die Anforderung?', right: ch[k], altRight: ch[kk], wrong: Object.keys(ch).filter(x => x !== k).map(x => ch[x]),
      expl: ['Die zweite Kennziffer 0 bis 6 baut aufeinander auf: eine höhere Ziffer deckt die niedrigere ab. Ziffern 7 und 8 (Untertauchen) schließen Tropf-, Sprüh- und Spritzwasser (1 bis 4) ein, aber nicht Strahlwasser (5, 6); 9 (heißer Strahl) schließt weder 5 und 6 noch 7 und 8 ein.', 'Hier: gekennzeichnet ' + act + ', gefordert ' + req + '.', 'Ergebnis: ' + ch[k] + '.'],
      tips: ['Vergleiche zuerst die Ziffern: ist die vorhandene Ziffer kleiner, reicht sie nicht.', 'IPX7 und IPX8 erfüllen IPX1 bis IPX4, aber Untertauchen (7, 8) ist nicht dasselbe wie Strahlwasser (5, 6): ein Gehäuse nur mit IPX7 gilt nicht automatisch als strahlwassergeschützt.', 'Üblich ist eine Doppelkennzeichnung wie IPX5/IPX7, wenn beides gefordert ist.'] });
  };
  G.sk5 = R => {
    const c = C(), u = pk(R, [50, 120, 230, 277, 400]), cat = ri(R, 1, 4), v = c.impulseV(u, cat) / 1000, row = c.IMPULSE_ROWS.find(r => u <= r[0]);
    return numQ({ text: 'In einem Netz beträgt die Spannung zwischen Außenleiter und Neutralleiter ' + u + ' V. Ein Gerät gehört zur Überspannungskategorie ' + ['I', 'II', 'III', 'IV'][cat - 1] + '. Wie hoch ist die Bemessungs-Stoßspannung nach der Lernmodell-Tabelle (Reiter „Schutzarten“)?', unit: 'kV', label: 'Bemessungs-Stoßspannung', value: v, alt: c.chk.impulse(u, cat) / 1000, tol: 0.005,
      expl: ['Die Tabellenzeile richtet sich nach der Spannung Leiter–Neutral, aufgerundet auf die nächste Zeile: ' + u + ' V → Zeile bis ' + row[0] + ' V.', 'Spalte Kategorie ' + ['I', 'II', 'III', 'IV'][cat - 1] + ' (' + c.CAT_TEXT[cat].split(':')[0] + ').', 'Bemessungs-Stoßspannung: ' + f(v * 1000, 0) + ' V = ' + f(v, 2) + ' kV.'],
      tips: ['Die Stoßspannung ist umso höher, je näher das Gerät an der Einspeisung liegt.', 'Zeile: kleinste Tabellenspannung, die ' + u + ' V erreicht oder überschreitet. Spalte: Kategorie.', 'Rechne die Antwort in kV: 4000 V = 4 kV.'] });
  };
  const LOCS = [
    ['Der Stromzähler direkt am Hausanschluss', 4], ['Die Hauptsicherung im Hausanschlusskasten', 4], ['Die Hauptverteilung im Keller eines Wohnhauses', 3], ['Eine fest installierte Unterverteilung in einer Wohnung', 3], ['Ein ortsfester Motorschaltschrank in der Fabrik', 3], ['Ein Installationsschalter, fest in der Wand montiert', 3],
    ['Eine Waschmaschine, die an der Steckdose betrieben wird', 2], ['Eine Tischleuchte mit Steckdosenanschluss', 2], ['Eine Handbohrmaschine am Verlängerungskabel', 2], ['Eine Messelektronik hinter einer eigenen Überspannungs-Schutzstufe im Gerät', 1], ['Eine Elektronikbaugruppe, vor der das Gerät die Überspannungen bereits begrenzt', 1]
  ];
  G.sk6 = R => {
    const c = C(), l = pk(R, LOCS), rom = ['I', 'II', 'III', 'IV'];
    return choiceQ(R, { text: 'Welcher Überspannungskategorie ordnet das Lernmodell zu: ' + l[0] + '?', right: 'Kategorie ' + rom[l[1] - 1], wrong: [1, 2, 3, 4].filter(x => x !== l[1]).map(x => 'Kategorie ' + rom[x - 1]),
      expl: ['Faustregel: Je näher an der Einspeisung, desto höher die Kategorie und die Stoßspannungsfestigkeit.', 'IV: Einspeisung, Zähler und Hauptsicherung vor der Hauptverteilung. III: Festinstallation und Verteiler einschließlich Hauptverteilung. II: Verbrauchsmittel an der Steckdose. I: Geräte mit eigenem Überspannungsschutz davor.', c.CAT_TEXT[l[1]] + '. Ergebnis: Kategorie ' + rom[l[1] - 1] + '.'],
      tips: ['Wo im Netz sitzt das Gerät: am Anfang, im Verteiler, an der Steckdose?', 'Von der Einspeisung zur Steckdose sinkt die Kategorie von IV über III auf II.', 'Kategorie I ist nur sinnvoll, wenn Überspannungen vorher gezielt begrenzt werden.'] });
  };
  const ISOP = R => ({ uLn: pk(R, [150, 230, 300, 600]), cat: ri(R, 1, 4), pd: ri(R, 1, 3), uw: pk(R, [250, 400, 500, 630]), cti: pk(R, [120, 200, 250, 450, 650]), reinforced: false, altitude: 2000 });
  const catR = n => ['I', 'II', 'III', 'IV'][n - 1];
  G.sk7 = R => {
    const c = C(), p = ISOP(R), i = c.isolation(p), alt = c.chk.isolation(p).clearance;
    return numQ({ text: 'Lernbeispiel (kein Normwert): Netz ' + p.uLn + ' V Leiter–Neutral, Überspannungskategorie ' + catR(p.cat) + ', Verschmutzungsgrad ' + p.pd + ', Basisisolierung, Aufstellhöhe bis 2000 m. Wie groß ist die geforderte Luftstrecke im Lernmodell?', unit: 'mm', label: 'Luftstrecke', value: i.clearance, alt, tol: 0.005,
      expl: ['Stoßspannung: ' + p.uLn + ' V, Kategorie ' + catR(p.cat) + ' → ' + f(i.imp, 0) + ' V.', 'Tabellenwert zur Stoßspannung ' + f(i.imp, 0) + ' V: ' + f(i.tab, 2) + ' mm; Mindestwert zum Verschmutzungsgrad ' + p.pd + ': ' + f(c.PD_MIN[p.pd], 2) + ' mm.', 'Luftstrecke = größerer der beiden Werte (Höhenfaktor 1): ' + f(i.clearance, 2) + ' mm.'],
      tips: ['Zuerst die Stoßspannung aus Netzspannung und Kategorie bestimmen.', 'Dazu gehört ein Luftstrecken-Tabellenwert; bei Verschmutzungsgrad 2 oder 3 gilt zusätzlich ein Mindestwert (0,2 mm bzw. 0,8 mm).', 'Nimm den größeren Wert von Tabellenwert und Mindestwert.'] });
  };
  G.sk8 = R => {
    const c = C(), p = Object.assign(ISOP(R), { pd: pk(R, [2, 3]), cat: pk(R, [2, 3]), uLn: 230 }), i = c.isolation(p), alt = c.chk.isolation(p).creepage;
    return numQ({ text: 'Lernbeispiel (kein Normwert): Arbeitsspannung ' + p.uw + ' V (Effektivwert), Netz 230 V Leiter–Neutral, Überspannungskategorie ' + catR(p.cat) + ', Verschmutzungsgrad ' + p.pd + ', Basisisolierung, Isolierstoff mit CTI ' + p.cti + '. Wie groß ist die geforderte Kriechstrecke im Lernmodell?', unit: 'mm', label: 'Kriechstrecke', value: i.creepage, alt, tol: 0.005,
      expl: ['CTI ' + p.cti + ' → Werkstoffgruppe ' + i.group + ' (I ab 600, II ab 400, IIIa ab 175, IIIb ab 100).', 'Tabellenzeile ' + i.rowV + ' V (Arbeitsspannung ' + p.uw + ' V aufgerundet), Verschmutzungsgrad ' + p.pd + ': ' + f(i.crTab, 2) + ' mm.', 'Die Kriechstrecke darf nicht kleiner als die Luftstrecke (' + f(i.clearance, 2) + ' mm) sein. Ergebnis: ' + f(i.creepage, 2) + ' mm.'],
      tips: ['Aus dem CTI die Werkstoffgruppe bestimmen: ein höherer CTI ist besser und erlaubt kürzere Strecken.', 'Tabelle im Reiter „Schutzarten“: Zeile nach Arbeitsspannung (aufrunden), Spalte nach Werkstoffgruppe, Teil nach Verschmutzungsgrad.', 'Prüfe zum Schluss, ob die Luftstrecke größer ist: Die Kriechstrecke darf nie unter der Luftstrecke liegen.'] });
  };
  G.sk9 = R => {
    const c = C(), p = Object.assign(ISOP(R), { uLn: pk(R, [230, 300]), cat: pk(R, [1, 2, 3]), pd: pk(R, [1, 2, 3]), reinforced: true, altitude: pk(R, [2000, 3000, 4000]) }), i = c.isolation(p), alt = c.chk.isolation(p).clearance;
    return numQ({ text: 'Lernbeispiel (kein Normwert): verstärkte Isolierung, Netz ' + p.uLn + ' V Leiter–Neutral, Überspannungskategorie ' + catR(p.cat) + ', Verschmutzungsgrad ' + p.pd + ', Aufstellhöhe ' + f(p.altitude, 0) + ' m. Wie groß ist die geforderte Luftstrecke im Lernmodell?', unit: 'mm', label: 'Luftstrecke', value: i.clearance, alt, tol: 0.01,
      expl: ['Normale Stoßspannung: ' + f(i.imp, 0) + ' V. Bei verstärkter Isolierung gilt die nächsthöhere Stufe der Reihe: ' + f(i.impUsed, 0) + ' V.', 'Tabellenwert: ' + f(i.tab, 2) + ' mm. Höhenfaktor bei ' + f(p.altitude, 0) + ' m: ' + f(i.af, 2) + ' → ' + f(i.tab * i.af, 3) + ' mm; Mindestwert Verschmutzungsgrad ' + p.pd + ': ' + f(c.PD_MIN[p.pd], 2) + ' mm.', 'Luftstrecke = größerer Wert = ' + f(i.clearance, 2) + ' mm.'],
      tips: ['Verstärkte Isolierung wird wie eine Stufe höher in der Stoßspannungsreihe behandelt.', 'Reihe: 1,5 kV, 2,5 kV, 4 kV, 6 kV, 8 kV. Dann Tabellenwert, mal Höhenfaktor (bis 2000 m: 1; 3000 m: 1,14; 4000 m: 1,29).', 'Vergleiche das Ergebnis mit dem Mindestwert zum Verschmutzungsgrad.'] });
  };
  G.sk10 = R => {
    const c = C(), p = ISOP(R), i = c.isolation(p), fc = pk(R, [0.8, 0.9, 1, 1.2, 1.5]), fk = pk(R, [0.8, 0.9, 1, 1.2, 1.5]), aClr = Math.round(i.clearance * fc * 100) / 100, aCrp = Math.round(i.creepage * fk * 100) / 100;
    const ck = c.isolationCheck(i, aClr, aCrp), ch = ['Beide Strecken reichen aus', 'Nur die Luftstrecke ist zu klein', 'Nur die Kriechstrecke ist zu klein', 'Beide Strecken sind zu klein'], k = ck.clrOk ? (ck.crpOk ? 0 : 2) : (ck.crpOk ? 1 : 3);
    const b = c.chk.isolation(p), kk = (aClr >= b.clearance - 1e-9) ? (aCrp >= b.creepage - 1e-9 ? 0 : 2) : (aCrp >= b.creepage - 1e-9 ? 1 : 3);
    return choiceQ(R, { text: 'Lernbeispiel (kein Normwert): Netz ' + p.uLn + ' V Leiter–Neutral, Kategorie ' + catR(p.cat) + ', Verschmutzungsgrad ' + p.pd + ', Arbeitsspannung ' + p.uw + ' V, CTI ' + p.cti + ', Basisisolierung bis 2000 m. Gemessen: Luftstrecke ' + f(aClr, 2) + ' mm, Kriechstrecke ' + f(aCrp, 2) + ' mm. Was gilt?', right: ch[k], altRight: ch[kk], wrong: ch.filter((_, j) => j !== k),
      expl: ['Gefordert: Luftstrecke ' + f(i.clearance, 2) + ' mm, Kriechstrecke ' + f(i.creepage, 2) + ' mm.', 'Vorhanden: Luftstrecke ' + f(aClr, 2) + ' mm (' + (ck.clrOk ? 'reicht' : 'zu klein') + '), Kriechstrecke ' + f(aCrp, 2) + ' mm (' + (ck.crpOk ? 'reicht' : 'zu klein') + ').', 'Gleichheit genügt: Die vorhandene Strecke darf nicht kleiner sein als die geforderte. Ergebnis: ' + ch[k] + '.'],
      tips: ['Berechne zuerst beide geforderten Werte und vergleiche sie einzeln.', 'Luftstrecke aus Stoßspannung und Verschmutzungsgrad, Kriechstrecke aus Arbeitsspannung, Werkstoff und Verschmutzungsgrad.', 'Prüfe jede Strecke für sich: vorhanden ≥ gefordert.'] });
  };

  /* ================================================================ Maschinen (ms) */
  const STXT = { 1: 'leichte, in der Regel reversible Verletzung (zum Beispiel Prellung)', 2: 'schwere, nicht umkehrbare Verletzung bis zum Tod (zum Beispiel Quetschen, Amputation)' }, FTXT = { 1: 'selten bis weniger häufig und/oder kurze Gefährdungsdauer', 2: 'häufig bis dauernd und/oder lange Gefährdungsdauer' }, PTXT = { 1: 'unter bestimmten Bedingungen möglich', 2: 'kaum möglich' };
  const MACH = ['Einlegen von Werkstücken in eine Presse', 'Reinigen einer Förderanlage', 'Beschicken einer Abfüllmaschine', 'Rüsten einer Fräsmaschine', 'Eingriff in einen Roboterarbeitsraum'];
  G.ms1 = R => {
    const c = C(), S = ri(R, 1, 2), F = ri(R, 1, 2), P = ri(R, 1, 2), pl = c.riskGraph(S, F, P);
    return choiceQ(R, { text: 'Risikobeurteilung beim ' + pk(R, MACH) + ': Mögliche Folge: ' + STXT[S] + '. Aufenthalt im Gefahrbereich: ' + FTXT[F] + '. Vermeiden der Gefährdung: ' + PTXT[P] + '. Welcher erforderliche Performance Level PLr ergibt sich nach dem Risikographen?', right: 'PLr ' + pl, altRight: 'PLr ' + c.chk.riskGraph(S, F, P), wrong: c.PLS.filter(x => x !== pl).map(x => 'PLr ' + x),
      expl: ['Schwere: S' + S + ' (' + STXT[S] + '). Häufigkeit und Dauer: F' + F + '. Vermeidung: P' + P + '.', 'Weg im Risikographen: S' + S + ' → F' + F + ' → P' + P + '. Der Wert steigt mit jeder ungünstigeren Einstufung (a bei S1/F1/P1, e bei S2/F2/P2).', 'Ergebnis: PLr ' + pl + '.'],
      tips: ['Drei Fragen: Wie schwer (S), wie oft (F), wie gut vermeidbar (P)?', 'S1F1P1 ist PLr a. F2 und P2 erhöhen jeweils um eine Stufe, S2 um zwei Stufen.', 'Beispiele: S1F1P2 = b, S1F2P2 = c, S2F1P1 = c, S2F1P2 = d, S2F2P2 = e.'] });
  };
  G.ms2 = R => {
    const c = C(), v = pk(R, [1.2e-5, 1e-5, 6e-6, 3e-6, 2.2e-6, 1e-6, 8e-7, 1.5e-7, 1e-7, 6e-8, 2e-8, 1e-8]), o = c.plFromPfh(v), pl = o.pl;
    return choiceQ(R, { text: 'Für eine Sicherheitsfunktion wird eine mittlere Wahrscheinlichkeit eines gefährlichen Ausfalls je Stunde PFHd = ' + ex(v) + ' 1/h berechnet. Welchem Performance Level entspricht das?', right: 'PL ' + pl, altRight: 'PL ' + c.chk.plFromPfh(v), wrong: c.PLS.filter(x => x !== pl).map(x => 'PL ' + x),
      expl: ['Bänder (1/h): PL a von 1·10⁻⁵ bis unter 1·10⁻⁴; PL b von 3·10⁻⁶ bis unter 1·10⁻⁵; PL c von 1·10⁻⁶ bis unter 3·10⁻⁶; PL d von 1·10⁻⁷ bis unter 1·10⁻⁶; PL e von 1·10⁻⁸ bis unter 1·10⁻⁷.', 'PFHd = ' + ex(v) + ' 1/h liegt im Band von PL ' + pl + '.', 'Ergebnis: PL ' + pl + '. Die untere Bandgrenze gehört jeweils noch zum Band.'],
      tips: ['Der Exponent entscheidet: kleiner ist besser.', 'PL e liegt bei 10⁻⁸ bis 10⁻⁷, PL d bei 10⁻⁷ bis 10⁻⁶, PL c bei 10⁻⁶ bis 3·10⁻⁶, PL b bei 3·10⁻⁶ bis 10⁻⁵, PL a darüber.', 'Vergleiche den Wert mit den Bandgrenzen von unten nach oben.'] });
  };
  G.ms3 = R => {
    const c = C(), v = pk(R, [2e-5, 3e-6, 8e-7, 1e-6, 2e-7, 1e-7, 4e-8, 1e-8]), s = c.silFromPfh(v).sil, ch = ['kein SIL', 'SIL 1', 'SIL 2', 'SIL 3'], k = s, kk = c.chk.silFromPfh(v);
    return choiceQ(R, { text: 'Eine Sicherheitsfunktion mit hoher Anforderungsrate hat PFH = ' + ex(v) + ' 1/h. Welches SIL ist erreichbar (Bereiche nach IEC 62061 / IEC 61508)?', right: ch[k], altRight: ch[kk], wrong: ch.filter((_, i) => i !== k),
      expl: ['Bereiche (1/h): SIL 1 von 1·10⁻⁶ bis unter 1·10⁻⁵; SIL 2 von 1·10⁻⁷ bis unter 1·10⁻⁶; SIL 3 von 1·10⁻⁸ bis unter 1·10⁻⁷. Ab 1·10⁻⁵ reicht es für kein SIL.', 'PFH = ' + ex(v) + ' 1/h → ' + ch[k] + '.', 'Zum Vergleich: PL b und PL c entsprechen SIL 1, PL d SIL 2, PL e SIL 3; nur PL a hat kein SIL-Gegenstück.'],
      tips: ['Ein kleinerer PFH-Wert bedeutet ein höheres SIL.', 'SIL 3: 10⁻⁸ bis 10⁻⁷; SIL 2: 10⁻⁷ bis 10⁻⁶; SIL 1: 10⁻⁶ bis 10⁻⁵.', 'Ab 10⁻⁵ pro Stunde kommt kein SIL mehr zustande.'] });
  };
  G.ms4 = R => {
    const c = C(), a = ri(R, 3, 40), b = ri(R, 3, 40), d = ri(R, 3, 40), v = (a + b + d) / 10, tot = (a + b + d) * 1e-8;
    return numQ({ text: 'Eine Sicherheitsfunktion besteht aus Sensor (PFHd = ' + f(a / 10, 1) + '·10⁻⁷ 1/h), Auswertung (' + f(b / 10, 1) + '·10⁻⁷ 1/h) und Aktor (' + f(d / 10, 1) + '·10⁻⁷ 1/h) in Reihe. Wie groß ist die PFHd der gesamten Sicherheitsfunktion? Angabe in ·10⁻⁷ 1/h.', unit: '·10⁻⁷ 1/h', label: 'PFHd gesamt', value: v, alt: (c.pfhSum([a * 1e-8, b * 1e-8, d * 1e-8])) / 1e-7, tol: tolOf(v, 0.005, 0.01),
      expl: ['In einer Reihenschaltung von Teilsystemen addieren sich die PFHd-Werte.', f(a / 10, 1) + ' + ' + f(b / 10, 1) + ' + ' + f(d / 10, 1) + ' = ' + f(v, 2) + ' (in ·10⁻⁷ 1/h).', 'Gesamt: ' + C().fmtExp(tot, 3) + ' 1/h = ' + f(v, 2) + '·10⁻⁷ 1/h. Das entspricht PL ' + (c.plFromPfh(tot).pl || 'kein PL') + '.'],
      tips: ['Die Teilsysteme sind in Reihe: Fällt eines gefährlich aus, fällt die Funktion aus.', 'PFHd gesamt = PFHd (Sensor) + PFHd (Auswertung) + PFHd (Aktor).', 'Addiere die drei Zahlen vor der Zehnerpotenz.'] });
  };
  const CATD = {
    B: ['Es werden grundlegende Sicherheitsprinzipien angewandt; ein einzelner Fehler kann zum Verlust der Sicherheitsfunktion führen.', 'Das Teil ist nach dem Stand der Technik gebaut, ohne besondere Maßnahmen; ein Fehler kann die Sicherheitsfunktion aufheben.'],
    1: ['Es werden bewährte Bauteile und bewährte Sicherheitsprinzipien eingesetzt, zum Beispiel zwangsöffnende Kontakte; ein Fehler kann trotzdem zum Verlust führen, aber seltener.', 'Bewährte Bauteile und Prinzipien sorgen für hohe Zuverlässigkeit; es gibt aber weder Redundanz noch Test.'],
    2: ['Eine Testeinrichtung prüft die Sicherheitsfunktion in geeigneten Abständen; zwischen den Tests kann ein Fehler zum Verlust führen.', 'Beim Einschalten und regelmäßig wird die Sicherheitsfunktion getestet; zwischen zwei Tests bleibt ein Fehler möglich.'],
    3: ['Ein einzelner Fehler führt nicht zum Verlust der Sicherheitsfunktion, nicht alle Fehler werden erkannt; eine Anhäufung unerkannter Fehler kann zum Verlust führen.', 'Zweikanalige Struktur: Der erste Fehler hebt die Funktion nicht auf; manche Fehler bleiben aber unentdeckt.'],
    4: ['Ein einzelner Fehler führt nicht zum Verlust; Fehler werden bei oder vor der nächsten Anforderung erkannt; auch die Anhäufung von Fehlern wird beherrscht.', 'Zweikanalige Struktur mit hoher Diagnose: Fehler werden rechtzeitig erkannt, selbst mehrere Fehler führen nicht zum Verlust.']
  };
  G.ms5 = R => {
    const c = C(), k = pk(R, c.CATS), txt = pk(R, CATD[k]), ch = c.CATS.map(x => 'Kategorie ' + x);
    const feat = { fehlertol: k === '3' || k === '4', test: k === '2', bewaehrt: k === '1', alle: k === '4' }, ak = feat.alle ? '4' : feat.fehlertol ? '3' : feat.test ? '2' : feat.bewaehrt ? '1' : 'B';
    return choiceQ(R, { text: txt + ' Welche Kategorie nach ISO 13849-1 beschreibt das?', right: 'Kategorie ' + k, altRight: 'Kategorie ' + ak, wrong: ch.filter(x => x !== 'Kategorie ' + k),
      expl: ['B: Grundprinzipien; 1: bewährte Bauteile; 2: Testeinrichtung; 3: einzelner Fehler ohne Verlust, nicht alle erkannt; 4: einzelner Fehler ohne Verlust, rechtzeitig erkannt, Fehleranhäufung beherrscht.', 'Das Merkmal der Beschreibung entspricht Kategorie ' + k + '.', 'Ergebnis: Kategorie ' + k + '.'],
      tips: ['Frage: Hält die Funktion bei einem einzelnen Fehler? Wird getestet? Sind bewährte Bauteile Hauptsache?', 'Fehlertoleranz gibt es ab Kategorie 3; Kategorie 4 erkennt zusätzlich rechtzeitig und beherrscht die Fehleranhäufung.', 'Kategorie 2 hat eine Testeinrichtung, Kategorie 1 setzt auf bewährte Bauteile.'] });
  };
  G.ms6 = R => {
    const c = C(), a = pk(R, [30, 50, 75, 100, 150, 200]), b = pk(R, [30, 50, 75, 100, 150, 200]), d = pk(R, [30, 50, 75, 100, 150, 200]), v = c.mttfdSeries([a, b, d]), mc = c.mttfdClass(v);
    return numQ({ text: 'Ein Kanal besteht aus drei Bauteilen in Reihe mit MTTFd = ' + a + ' Jahre, ' + b + ' Jahre und ' + d + ' Jahre. Wie groß ist die MTTFd des Kanals?', unit: 'Jahre', label: 'MTTFd des Kanals', value: v, alt: 1 / (1 / a + 1 / b + 1 / d), tol: tolOf(v, 0.005, 0.02),
      expl: ['In einer Reihenschaltung addieren sich die Ausfallraten (Kehrwerte der MTTFd): 1/MTTFd = 1/MTTFd₁ + 1/MTTFd₂ + 1/MTTFd₃.', '1/MTTFd = 1/' + a + ' + 1/' + b + ' + 1/' + d + ' = ' + f(1 / v, 5) + ' 1/Jahr.', 'MTTFd = ' + f(v, 2) + ' Jahre (Klasse „' + (mc || 'zu niedrig') + '“; je Kanal werden höchstens 100 Jahre angerechnet).'],
      tips: ['Nicht die MTTFd-Werte addieren, sondern ihre Kehrwerte.', '1/MTTFd = 1/MTTFd₁ + 1/MTTFd₂ + 1/MTTFd₃, danach den Kehrwert bilden.', 'Rechne ' + a + ', ' + b + ' und ' + d + ' zu Kehrwerten, addiere, bilde den Kehrwert.'] });
  };
  G.ms7 = R => {
    const c = C(), combos = []; Object.keys(c.CATPL).forEach(cat => Object.keys(c.CATPL[cat]).forEach(dc => Object.keys(c.CATPL[cat][dc]).forEach(mc => combos.push([cat, dc, mc, c.CATPL[cat][dc][mc]]))));
    const cb = pk(R, combos), M = { niedrig: [3, 9.9], mittel: [10, 29.9], hoch: [30, 100] }, D = { keine: [0, 59], niedrig: [60, 89], mittel: [90, 98], hoch: [99, 99.9] };
    const y = Math.round((M[cb[2]][0] + R() * (M[cb[2]][1] - M[cb[2]][0])) * 10) / 10, dc = Math.round(D[cb[1]][0] + R() * (D[cb[1]][1] - D[cb[1]][0])), mcl = c.mttfdClass(y), dcl = c.dcClass(dc), pl = c.plFromCat(cb[0], mcl, dcl);
    const altMc = y >= 30 ? 'hoch' : y >= 10 ? 'mittel' : 'niedrig', altDc = dc >= 99 ? 'hoch' : dc >= 90 ? 'mittel' : dc >= 60 ? 'niedrig' : 'keine', altPl = c.chk.plFromCat(cb[0], altMc, altDc);
    return choiceQ(R, { text: 'Eine Sicherheitsfunktion hat die Struktur der Kategorie ' + cb[0] + ', eine kanalbezogene MTTFd von ' + f(y, 1) + ' Jahren und einen mittleren Diagnosedeckungsgrad DCavg von ' + dc + ' %. Welchen PL erreicht sie nach dem vereinfachten Lernmodell?', right: 'PL ' + pl, altRight: 'PL ' + altPl, wrong: c.PLS.filter(x => x !== pl).map(x => 'PL ' + x),
      expl: ['MTTFd ' + f(y, 1) + ' Jahre → Klasse „' + mcl + '“ (niedrig 3 bis unter 10, mittel 10 bis unter 30, hoch 30 bis 100 Jahre).', 'DCavg ' + dc + ' % → Klasse „' + dcl + '“ (keine unter 60 %, niedrig 60 bis unter 90 %, mittel 90 bis unter 99 %, hoch ab 99 %).', 'Kategorie ' + cb[0] + ' mit MTTFd „' + mcl + '“ und DC „' + dcl + '“ → PL ' + pl + ' (Lernmodell; die Norm verlangt zusätzlich Maßnahmen gegen Ausfälle gemeinsamer Ursache und systematische Fehler).'],
      tips: ['Wandle MTTFd und DCavg zuerst in ihre Klassen um.', 'Das Lernmodell kennt je Kategorie nur bestimmte DC-Klassen: B und 1 ohne DC, 2 und 3 niedrig oder mittel, 4 hoch.', 'Lies in der Matrix im Reiter „Maschinen“ ab: Kategorie, DC-Klasse und MTTFd-Klasse treffen sich im PL.'] });
  };
  G.ms8 = R => {
    const c = C(), it = [0, 1, 2].map(() => [pk(R, [60, 90, 99]), pk(R, [20, 30, 50, 60, 100])]), v = c.dcAvg(it), num = it.reduce((s, x) => s + x[0] / x[1], 0), den = it.reduce((s, x) => s + 1 / x[1], 0);
    return numQ({ text: 'Drei Teile einer Sicherheitsfunktion: Sensor (DC ' + it[0][0] + ' %, MTTFd ' + it[0][1] + ' Jahre), Logik (DC ' + it[1][0] + ' %, MTTFd ' + it[1][1] + ' Jahre), Aktor (DC ' + it[2][0] + ' %, MTTFd ' + it[2][1] + ' Jahre). Wie groß ist der mittlere Diagnosedeckungsgrad DCavg?', unit: '%', label: 'DCavg', value: v, alt: num / den, tol: tolOf(v, 0.005, 0.05),
      expl: ['DCavg gewichtet die DC-Werte mit den Ausfallraten der Teile (1/MTTFd): DCavg = Σ(DC/MTTFd) / Σ(1/MTTFd).', 'Zähler: ' + it.map(x => x[0] + '/' + x[1]).join(' + ') + ' = ' + f(num, 4) + '. Nenner: ' + it.map(x => '1/' + x[1]).join(' + ') + ' = ' + f(den, 4) + '.', 'DCavg = ' + f(num, 4) + ' / ' + f(den, 4) + ' = ' + f(v, 2) + ' % (Klasse „' + c.dcClass(v) + '“).'],
      tips: ['Teile mit kleiner MTTFd fallen häufiger aus und zählen daher stärker.', 'DCavg = (DC₁/MTTFd₁ + DC₂/MTTFd₂ + DC₃/MTTFd₃) / (1/MTTFd₁ + 1/MTTFd₂ + 1/MTTFd₃).', 'Rechne zuerst Zähler und Nenner getrennt aus.'] });
  };
  G.ms9 = R => {
    const c = C(), pool = ['NH', 'LOESEN', 'K1_AUF', 'K1_ZU', 'WARTE', 'RESET', 'START', 'STOP'], ev = R() < 0.7 ? ['RESET', 'START'] : [], n = ri(R, 2, 4);
    for (let i = 0; i < n; i++) ev.push(pk(R, i === 0 && ev.length ? ['NH', 'NH', 'K1_AUF', 'STOP'] : pool));
    const fin = c.nhRun(ev), alt = c.chk.nhRun(ev), states = Object.keys(c.NH_TEXT), wr = states.filter(s => s !== fin.st).sort((x, y) => (x === 'WARTEN_RESET' ? -1 : 0) - (y === 'WARTEN_RESET' ? -1 : 0)).slice(0, 3);
    let s = c.nhInit(); const steps = ev.map((e, i) => { s = c.nhStep(s, e); return (i + 1) + '. ' + c.NH_EV_TEXT[e] + ' → ' + c.NH_TEXT[s.st] + '.'; });
    return choiceQ(R, { text: 'Zweikanaliger Not-Halt mit überwachtem Start, Anfangszustand: Spannung eingeschaltet, Not-Halt nicht betätigt, noch nicht zurückgesetzt. Ereignisfolge: ' + ev.map((e, i) => (i + 1) + ') ' + c.NH_EV_TEXT[e]).join('; ') + '. In welchem Zustand ist die Anlage am Ende?', right: c.NH_TEXT[fin.st], altRight: c.NH_TEXT[alt.st], wrong: wr.map(x => c.NH_TEXT[x]),
      expl: ['Regeln des Lernmodells: Not-Halt schaltet sofort ab. Entriegeln allein startet nichts: Es folgt Rücksetzen, dann ein eigener Startbefehl. Fällt ein Kanal allein aus, schaltet die Anlage ab; hält die Uneinigkeit der Kanäle an (Ablauf der Diskrepanzzeit), verriegelt ein Fehler.'].concat(steps).concat(['Ergebnis: ' + c.NH_TEXT[fin.st] + '.']),
      tips: ['Gehe die Ereignisse einzeln durch und halte nach jedem den Zustand fest.', 'Ablauf: Not-Halt → Ausgänge aus; entriegeln → wartet auf Rücksetzen; Rücksetzen → bereit; Start → läuft.', 'Wenn nur ein Kanal ausfällt und die Diskrepanzzeit abläuft, ist der Fehlerzustand nur über Not-Halt, Entriegeln und Rücksetzen zu verlassen.'] });
  };
  G.ms10 = R => {
    const c = C(), d = pk(R, [14, 20, 30, 40, 50]), t1 = pk(R, [10, 20, 30, 40, 60]), t2 = pk(R, [40, 60, 80, 100, 150, 250]), T = (t1 + t2) / 1000, v = c.safetyDistance(d, T), k = d > 40 ? 1600 : 2000 * T + (d <= 40 ? Math.max(0, 8 * (d - 14)) : 0) > 500 ? 1600 : 2000;
    const C_ = d <= 40 ? Math.max(0, 8 * (d - 14)) : 850;
    return numQ({ text: 'Ein Lichtvorhang mit Detektionsvermögen d = ' + d + ' mm schützt eine Gefahrstelle bei senkrechter Annäherung. Ansprechzeit des Lichtvorhangs t₁ = ' + t1 + ' ms, Nachlaufzeit der Maschine t₂ = ' + t2 + ' ms. Wie groß ist der Mindest-Sicherheitsabstand S nach S = K·T + C (Lernmodell)?', unit: 'mm', label: 'Sicherheitsabstand S', value: v, alt: c.chk.safetyDistance(d, T), tol: 1,
      expl: ['Gesamtzeit T = t₁ + t₂ = ' + t1 + ' ms + ' + t2 + ' ms = ' + f(T, 3) + ' s.', 'C = ' + (d <= 40 ? '8·(d − 14) = 8·(' + d + ' − 14) = ' + f(C_, 0) + ' mm (für d bis 40 mm; mindestens 0)' : '850 mm (für d über 40 mm: Armlänge)') + '.', 'S = K·T + C mit K = ' + f(k, 0) + ' mm/s: ' + (d > 40 ? '1600' : f(k, 0)) + ' · ' + f(T, 3) + ' + ' + f(C_, 0) + ' = ' + f(v, 1) + ' mm' + (d <= 40 && v === 500 ? ' (Ergebnis wird auf mindestens 500 mm angehoben, weil mit K = 1600 mm/s gerechnet wurde)' : '') + '.'],
      tips: ['Alle Zeiten in Sekunden: T ist die Summe aus Ansprechzeit und Nachlaufzeit.', 'K = 2000 mm/s; wird S dabei größer als 500 mm, wird mit K = 1600 mm/s neu gerechnet (dann mindestens 500 mm). C = 8·(d − 14) für d bis 40 mm, sonst 850 mm mit K = 1600 mm/s.', 'Setze zuerst T und C ein, rechne mit K = 2000 mm/s und prüfe, ob S über 500 mm liegt. Bei d bis 40 mm gilt zusätzlich S mindestens 100 mm.'] });
  };
  G.ms11 = R => {
    const c = C(), S = ri(R, 1, 2), F = ri(R, 1, 2), P = ri(R, 1, 2), plr = c.riskGraph(S, F, P), cat = pk(R, ['2', '3', '3', '4']), pool = []; Object.keys(c.CATPL[cat]).forEach(dc => Object.keys(c.CATPL[cat][dc]).forEach(mc => pool.push([dc, mc])));
    const pr = pk(R, pool), pl = c.plFromCat(cat, pr[1], pr[0]), ok = c.plMeets(pl, plr), okAlt = 'abcde'.indexOf(pl) >= 'abcde'.indexOf(c.chk.riskGraph(S, F, P));
    const ch = ['Ausreichend: der erreichte PL ist mindestens so hoch wie PLr', 'Nicht ausreichend: der erreichte PL liegt unter PLr', 'Ausreichend, weil Kategorie 2, 3 oder 4 immer genügt'];
    const mY = { niedrig: 6, mittel: 20, hoch: 60 }[pr[1]], dcv = { keine: 0, niedrig: 70, mittel: 95, hoch: 99 }[pr[0]];
    return choiceQ(R, { text: 'Risikograph: S' + S + ', F' + F + ', P' + P + '. Die umgesetzte Steuerung hat Kategorie ' + cat + ', MTTFd ' + mY + ' Jahre je Kanal und DCavg ' + dcv + ' %. Ist die Sicherheitsfunktion ausreichend?', right: ok ? ch[0] : ch[1], altRight: okAlt ? ch[0] : ch[1], wrong: ok ? [ch[1], ch[2]] : [ch[0], ch[2]],
      expl: ['Risikograph: S' + S + ' → F' + F + ' → P' + P + ' = PLr ' + plr + '.', 'Steuerung: Kategorie ' + cat + ', MTTFd „' + pr[1] + '“, DC „' + pr[0] + '“ → PL ' + pl + ' (Lernmodell).', 'Vergleich: PL ' + pl + (ok ? ' ≥ ' : ' < ') + 'PLr ' + plr + ' → ' + (ok ? 'ausreichend' : 'nicht ausreichend') + '.'],
      tips: ['Zwei Rechnungen: erforderlicher PLr aus dem Risikographen, erreichter PL aus Kategorie, MTTFd und DC.', 'Ausreichend ist, wenn PL größer oder gleich PLr ist.', 'Die Kategorie allein entscheidet nicht: MTTFd und DCavg müssen zur Kategorie passen.'] });
  };

  /* ================================================================ Prüfen (pf) */
  const DEVN = { 1: ['Bohrmaschine', 'Wasserkocher', 'Staubsauger mit Metallgehäuse', 'Heizlüfter', 'Kreissäge'], 2: ['Haartrockner', 'Handmixer', 'Ladegerät mit Kunststoffgehäuse', 'Tischleuchte mit Doppelisolierung', 'Elektrorasierer'], 3: ['Handlampe an einem Sicherheitstransformator', 'Spielzeug-Netzteil mit 12 V Kleinspannung', 'Kleinspannungs-Handleuchte'] };
  const PN = { sicht: 'Sichtprüfung', pe: 'Schutzleiterwiderstand', iso: 'Isolationswiderstand', ab: 'Schutzleiter- bzw. Berührungsstrom', funk: 'Funktionsprüfung', doku: 'Dokumentation' };
  const procTxt = o => o.map(i => PN[i]).join(' → ');
  G.pf1 = R => {
    const c = C(), sk = pk(R, [1, 2]), ok = c.procSequence(sk), wr = [], seen = new Set([ok.join()]); let guard = 0;
    while (wr.length < 3 && guard++ < 300) { const o = ok.slice(), i = ri(R, 0, o.length - 1), j = ri(R, 0, o.length - 1); if (i === j) continue; [o[i], o[j]] = [o[j], o[i]]; if (c.procOk(o, sk) || seen.has(o.join())) continue; seen.add(o.join()); wr.push(o); }
    const altOk = [ok].concat(wr).find(o => o.join() === c.PROC.map(p => p.id).filter(id => !(id === 'pe' && sk !== 1)).join()) || wr[0];
    return choiceQ(R, { text: 'In welcher Reihenfolge prüft man ein Gerät der Schutzklasse ' + (sk === 1 ? 'I' : 'II') + ' (' + pk(R, DEVN[sk]) + ') nach dem Ablauf des Lernmodells (Messwerte erst, wenn die Sichtprüfung ohne Mangel war)?', right: procTxt(ok), altRight: procTxt(altOk), wrong: wr.map(procTxt),
      expl: ['Erst sehen, dann messen: Eine beschädigte Leitung oder ein gebrochenes Gehäuse wird nicht unter Spannung gemessen.', 'Messreihenfolge: Schutzleiterwiderstand (nur Schutzklasse I), Isolationswiderstand, Schutzleiter- bzw. Berührungsstrom; danach Funktionsprüfung und Dokumentation.', 'Ergebnis: ' + procTxt(ok) + '.'],
      tips: ['Beginne mit dem, was ungefährlich ist: dem Hinsehen.', 'Die Messung am Schutzleiter kommt vor den Messungen, die das Gerät unter Spannung setzen. Bei Schutzklasse II entfällt sie.', 'Am Ende steht die Dokumentation mit Kennzeichnung und Termin für die nächste Prüfung.'] });
  };
  G.pf2 = R => {
    const c = C(), len = pk(R, [3, 5, 8, 12.5, 15, 20, 25, 35, 40, 60]), v = c.peLimit(len);
    return numQ({ text: 'Ein Gerät der Schutzklasse I hat eine feste Anschlussleitung von ' + f(len, 1) + ' m Länge. Wie groß ist der Grenzwert des Schutzleiterwiderstands im Lernmodell?', unit: 'Ω', label: 'Grenzwert Schutzleiterwiderstand', value: v, alt: c.chk.peLimit(len), tol: 0.005,
      expl: ['Lernmodell: bis 5 m Leitungslänge 0,3 Ω; für jede weiteren angefangenen 7,5 m kommen 0,1 Ω dazu; höchstens 1 Ω.', len <= 5 ? 'Bei ' + f(len, 1) + ' m (höchstens 5 m): 0,3 Ω.' : 'Zusätzlich zu 5 m: ' + f(len - 5, 1) + ' m → ' + Math.ceil((len - 5) / 7.5 - 1e-9) + ' Schritt(e) à 7,5 m (angefangene zählen voll) → 0,3 Ω + ' + Math.ceil((len - 5) / 7.5 - 1e-9) + ' · 0,1 Ω.', 'Grenzwert: ' + f(v, 1) + ' Ω.'],
      tips: ['Es gibt einen Grundwert für die ersten 5 m und einen Zuschlag je weiteren angefangenen 7,5 m.', 'Grenzwert = 0,3 Ω + 0,1 Ω · (Anzahl der angefangenen 7,5-m-Schritte über 5 m), höchstens 1 Ω.', 'Ziehe 5 m ab, teile durch 7,5 und runde auf.'] });
  };
  G.pf3 = R => {
    const c = C(), cs = pk(R, [{ sk: 1, h: false, pw: 800, t: 'Schutzklasse I (zum Beispiel Bohrmaschine, 800 W)' }, { sk: 2, h: false, pw: 1800, t: 'Schutzklasse II (zum Beispiel Haartrockner, 1800 W)' }, { sk: 3, h: false, pw: 20, t: 'Schutzklasse III (Kleinspannung, 20 W)' }, { sk: 1, h: true, pw: 2200, t: 'Schutzklasse I mit Heizelement (Wasserkocher, 2200 W)' }, { sk: 1, h: true, pw: 4500, t: 'Schutzklasse I mit Heizelement (Warmwasserspeicher, 4500 W)' }]), v = c.isoLimit(cs.sk, cs.h, cs.pw);
    const alt = cs.sk === 2 ? 2 : cs.sk === 3 ? 0.25 : cs.h ? 0.3 : 1;
    return numQ({ text: 'Welcher Mindestwert für den Isolationswiderstand gilt im Lernmodell für ein Gerät der Art: ' + cs.t + '?', unit: 'MΩ', label: 'Mindest-Isolationswiderstand', value: v, alt, tol: 0.005,
      expl: ['Lernmodell: Schutzklasse I mindestens 1 MΩ; Schutzklasse II mindestens 2 MΩ; Schutzklasse III mindestens 0,25 MΩ.', 'Sonderfall: Schutzklasse I mit Heizelementen mindestens 0,3 MΩ (Heizelemente nehmen Feuchtigkeit auf). Über 3,5 kW Heizleistung darf der Wert auch darunter liegen, wenn der Schutzleiterstrom eingehalten ist.', cs.t + ' → ' + f(v, 2) + ' MΩ.'],
      tips: ['Der Mindestwert hängt von der Schutzklasse ab.', 'I: 1 MΩ, II: 2 MΩ, III: 0,25 MΩ; Schutzklasse I mit Heizelement: 0,3 MΩ.', 'Prüfe, ob das Gerät ein Heizelement hat; die Leistung spielt für den Mindestwert keine Rolle.'] });
  };
  G.pf4 = R => {
    const c = C(), P = ri(R, 35, 99) / 10, v = c.leakLimit(1, true, P * 1000);
    return numQ({ text: 'Ein Heizgerät der Schutzklasse I hat eine Leistung von ' + f(P, 1) + ' kW. Welcher Grenzwert des Schutzleiterstroms gilt im Lernmodell?', unit: 'mA', label: 'Grenzwert Schutzleiterstrom', value: v, alt: Math.max(3.5, Math.min(10, P)), tol: 0.005,
      expl: ['Lernmodell: Schutzklasse I allgemein höchstens 3,5 mA. Bei Heizgeräten ab 3,5 kW Leistung gilt 1 mA je kW, höchstens 10 mA.', f(P, 1) + ' kW ≥ 3,5 kW → ' + f(P, 1) + ' kW · 1 mA/kW = ' + f(P, 1) + ' mA (unter 10 mA).', 'Grenzwert: ' + f(v, 1) + ' mA.'],
      tips: ['Ab 3,5 kW Heizleistung steigt der erlaubte Schutzleiterstrom mit der Leistung.', '1 mA je kW Anschlussleistung, aber nie mehr als 10 mA.', 'Rechne die Leistung in kW und lies den Wert in mA ab.'] });
  };
  G.pf5 = R => {
    const c = C(), len = pk(R, [3, 10, 20, 30]), lim = c.peLimit(len), fac = pk(R, [0.5, 0.9, 1, 1.1, 1.5]), m = Math.round(lim * fac * 100) / 100, e = c.evaluate({ sk: 1, len, pw: 800, heater: false }, { vis: true, pe: m, iso: 5, leak: 1, func: true });
    const ch = ['Bestanden: der Messwert liegt innerhalb des Grenzwerts', 'Nicht bestanden: der Schutzleiterwiderstand ist zu hoch', 'Nicht bestanden: der Schutzleiterwiderstand ist zu niedrig'], okk = e.verdict === 'bestanden', altOk = m <= c.chk.peLimit(len) + 1e-12;
    return choiceQ(R, { text: 'Gerät der Schutzklasse I mit ' + f(len, 0) + ' m Anschlussleitung. Gemessener Schutzleiterwiderstand: ' + f(m, 2) + ' Ω. Wie fällt die Prüfung dieses Schritts aus?', right: okk ? ch[0] : ch[1], altRight: altOk ? ch[0] : ch[1], wrong: okk ? [ch[1], ch[2]] : [ch[0], ch[2]],
      expl: ['Grenzwert für ' + f(len, 0) + ' m: ' + f(lim, 1) + ' Ω (0,3 Ω bis 5 m, je angefangene 7,5 m +0,1 Ω).', 'Messwert ' + f(m, 2) + ' Ω ' + (m <= lim + 1e-12 ? '≤' : '>') + ' ' + f(lim, 1) + ' Ω.', 'Ein kleiner Widerstand ist beim Schutzleiter gut; nur ein zu hoher Wert fällt durch. Ergebnis: ' + (okk ? 'bestanden' : 'nicht bestanden') + '.'],
      tips: ['Bestimme zuerst den Grenzwert für die Leitungslänge.', 'Beim Schutzleiterwiderstand ist ein Höchstwert gefordert: gemessen ≤ Grenzwert.', 'Gleich dem Grenzwert zählt noch als bestanden.'] });
  };
  G.pf6 = R => {
    const c = C(), sk = pk(R, [1, 1, 2]), heater = sk === 1 && R() < 0.3, pw = heater ? pk(R, [3600, 5000]) : pk(R, [200, 800, 1500]), len = pk(R, [2, 5, 10, 20]), dev = { sk, len: sk === 1 ? len : 2, pw, heater };
    const failAt = pk(R, sk === 1 ? ['none', 'pe', 'iso', 'ab'] : ['none', 'iso', 'ab']), Lp = c.peLimit(dev.len), Li = c.isoLimit(sk, heater, pw), La = c.leakLimit(sk, heater, pw), rr = (x, lo, hi) => Math.round(x * (lo + R() * (hi - lo)) * 100) / 100;
    const m = { vis: true, func: true, pe: rr(Lp, 0.3, 0.8), iso: rr(Li, 1.5, 8), leak: rr(La, 0.1, 0.8) };
    if (failAt === 'pe') m.pe = rr(Lp, 1.3, 3); if (failAt === 'iso') m.iso = rr(Li, 0.1, 0.8); if (failAt === 'ab') m.leak = rr(La, 1.3, 3);
    const e = c.evaluate(dev, m), names = { none: 'Alle Messungen bestanden', pe: 'Nicht bestanden beim Schutzleiterwiderstand', iso: 'Nicht bestanden beim Isolationswiderstand', ab: 'Nicht bestanden beim Schutzleiter- bzw. Berührungsstrom' }, k = e.failAt || 'none';
    const altK = (sk === 1 && !(m.pe <= c.chk.peLimit(dev.len) + 1e-12)) ? 'pe' : (!(m.iso >= Li - 1e-12)) ? 'iso' : (!(m.leak <= La + 1e-12)) ? 'ab' : 'none';
    return choiceQ(R, { text: 'Prüfling: Schutzklasse ' + (sk === 1 ? 'I' : 'II') + (heater ? ' mit Heizelement' : '') + ', ' + f(pw, 0) + ' W, Anschlussleitung ' + f(dev.len, 0) + ' m. Sichtprüfung ohne Mangel. Messwerte: ' + (sk === 1 ? 'Schutzleiterwiderstand ' + f(m.pe, 2) + ' Ω, ' : '') + 'Isolationswiderstand ' + f(m.iso, 2) + ' MΩ, ' + (sk === 1 ? 'Schutzleiterstrom ' : 'Berührungsstrom ') + f(m.leak, 2) + ' mA. Wie lautet das Prüfergebnis?', right: names[k], altRight: names[altK], wrong: Object.keys(names).filter(x => x !== k).map(x => names[x]),
      expl: e.steps.filter(s => s.applies && s.limit != null).map(s => s.name + ': ' + f(s.value, 2) + ' ' + s.unit + ' ' + (s.skipped ? '(nicht mehr geprüft)' : (s.ok ? 'erfüllt ' : 'verfehlt ') + s.cmp + ' ' + f(s.limit, 2) + ' ' + s.unit) + '.').concat(['Ergebnis: ' + names[k] + '.']),
      tips: ['Berechne für jeden Schritt den Grenzwert aus Schutzklasse, Leitungslänge und Leistung.', 'Schutzleiter ≤ Grenzwert, Isolation ≥ Grenzwert, Schutzleiterstrom ≤ Grenzwert (SK I: 3,5 mA, Heizgerät ab 3,5 kW: 1 mA/kW bis 10 mA; SK II: 0,5 mA).', 'Der erste verfehlte Schritt ist das Ergebnis; danach wird nicht weitergemessen.'] });
  };
  const DEFECT = [['Der Mantel der Netzleitung ist eingeschnitten, eine Ader liegt frei', true], ['Das Gehäuse ist gebrochen, im Inneren sind Leiterteile berührbar', true], ['Der Stecker ist lose und hat ein Spiel am Kabel', true], ['Die Zugentlastung fehlt, die Leitung ist am Gehäuse gequetscht', true], ['Das Gehäuse ist unbeschädigt, Leitung und Stecker sind in Ordnung, das Typenschild ist lesbar', false], ['Leitung, Stecker und Schalter sind unauffällig, die Lüftungsöffnungen sind frei', false]];
  G.pf7 = R => {
    const c = C(), d = pk(R, DEFECT), sk = pk(R, [1, 2]), e = c.evaluate({ sk, len: 3, pw: 500, heater: false }, { vis: !d[1], pe: 0.1, iso: 10, leak: 0.1, func: true }), bad = e.failAt === 'sicht';
    const ch = ['Prüfung abbrechen, Gerät als nicht bestanden kennzeichnen und instandsetzen lassen', sk === 1 ? 'Mit dem Schutzleiterwiderstand weitermessen' : 'Mit dem Isolationswiderstand weitermessen', 'Die Messungen trotzdem durchführen und bei guten Messwerten freigeben'], k = bad ? 0 : 1;
    return choiceQ(R, { text: 'Bei der Sichtprüfung eines Geräts der Schutzklasse ' + (sk === 1 ? 'I' : 'II') + ' stellt man fest: ' + d[0] + '. Wie geht es weiter?', right: ch[k], altRight: d[1] ? ch[0] : ch[1], wrong: ch.filter((_, i) => i !== k),
      expl: ['Die Sichtprüfung kommt zuerst, weil ein sichtbarer Mangel eine Messung unnötig oder gefährlich macht und gute Messwerte den Mangel nicht aufheben.', d[1] ? 'Hier liegt ein sicherheitsrelevanter Mangel vor: abbrechen, kennzeichnen, instandsetzen, danach vollständig neu prüfen.' : 'Hier ist kein Mangel erkennbar: Die Prüfung läuft mit der ersten Messung weiter.', 'Ergebnis: ' + ch[k] + '.'],
      tips: ['Frage: Ist der Befund sicherheitsrelevant oder unauffällig?', 'Ein sicherheitsrelevanter Mangel ist ein Ausschlusskriterium, auch bei guten Messwerten.', 'Ohne Mangel geht es mit der nächsten Prüfstufe weiter.'] });
  };
  G.pf8 = R => {
    const c = C(), P = pk(R, [1200, 3000, 3499, 3500, 5000, 7000, 9500, 10000, 12000, 15000]), v = c.leakLimit(1, true, P);
    return numQ({ text: 'Ein Heizgerät der Schutzklasse I hat eine Leistung von ' + f(P, 0) + ' W. Welchen Grenzwert des Schutzleiterstroms setzt das Lernmodell an (Grundwert 3,5 mA; ab 3,5 kW 1 mA je kW, höchstens 10 mA)?', unit: 'mA', label: 'Grenzwert Schutzleiterstrom', value: v, alt: P < 3500 ? 3.5 : Math.min(10, Math.max(3.5, P / 1000)), tol: 0.005,
      expl: ['Unter 3,5 kW gilt der Grundwert 3,5 mA. Ab 3,5 kW wächst der Wert mit 1 mA je kW (' + f(P / 1000, 2) + ' kW → ' + f(P / 1000, 2) + ' mA), begrenzt auf 10 mA.', P < 3500 ? f(P, 0) + ' W < 3500 W: Grundwert.' : f(P, 0) + ' W ≥ 3500 W: ' + f(P / 1000, 2) + ' mA' + (P / 1000 > 10 ? ', auf 10 mA begrenzt' : '') + '.', 'Grenzwert: ' + f(v, 2) + ' mA.'],
      tips: ['Es gibt eine untere Grenze (Grundwert) und eine obere (10 mA).', 'Unter 3,5 kW: 3,5 mA. Ab 3,5 kW: Leistung in kW als mA, höchstens 10 mA.', 'Prüfe, in welchem der drei Bereiche die Leistung liegt.'] });
  };
  G.pf9 = R => {
    const c = C(), len = pk(R, [3, 10, 20, 30, 45]), lim = c.peLimit(len), m = Math.round(lim * (ri(R, 20, 98) / 100) * 100) / 100, v = c.usage(m, lim);
    return numQ({ text: 'Schutzleiterwiderstand gemessen: ' + f(m, 2) + ' Ω bei ' + f(len, 0) + ' m Anschlussleitung (Schutzklasse I). Wie viel Prozent des Grenzwerts sind ausgeschöpft?', unit: '%', label: 'Ausnutzung des Grenzwerts', value: v, alt: m / c.chk.peLimit(len) * 100, tol: tolOf(v, 0.005, 0.05),
      expl: ['Grenzwert für ' + f(len, 0) + ' m: ' + f(lim, 1) + ' Ω.', 'Ausnutzung = Messwert / Grenzwert · 100 % = ' + f(m, 2) + ' Ω / ' + f(lim, 1) + ' Ω · 100 %.', 'Ergebnis: ' + f(v, 1) + ' %. Ein hoher Wert nahe 100 % ist ein Warnsignal für die nächste Prüfung (zum Beispiel Kontaktwiderstand am Stecker).'],
      tips: ['Berechne zuerst den Grenzwert zur Leitungslänge.', 'Ausnutzung = Messwert geteilt durch Grenzwert mal 100.', 'Rechne mit demselben Grenzwert, den du für die Entscheidung benutzt.'] });
  };
  G.pf10 = R => {
    const c = C(), sk = pk(R, [2, 3]), ok = c.procSequence(sk).filter(x => x !== 'doku'), names = o => o.map(i => PN[i]).join(', '), w1 = ok.slice(); w1.splice(1, 0, 'pe');
    const w2 = ok.filter(x => x !== 'iso'), w3 = sk === 2 ? ok.filter(x => x !== 'ab') : ok.concat(['ab']).sort((x, y) => c.PROC.findIndex(p => p.id === x) - c.PROC.findIndex(p => p.id === y));
    const altOk = names(c.PROC.map(p => p.id).filter(x => x !== 'doku' && x !== 'pe' && !(sk === 3 && x === 'ab')));
    return choiceQ(R, { text: 'Welche Prüfschritte gehören zum Lernmodell für ein Gerät der Schutzklasse ' + (sk === 2 ? 'II (Schutzisolierung)' : 'III (Kleinspannung)') + ', zum Beispiel: ' + pk(R, DEVN[sk]) + '?', right: names(ok), altRight: altOk, wrong: [names(w1), names(w2), names(w3)].filter((x, i, a) => a.indexOf(x) === i && x !== names(ok)),
      expl: ['Ohne Schutzleiter gibt es nichts zu messen: Der Schutzleiterwiderstand entfällt bei Schutzklasse II und III.', sk === 2 ? 'Schutzklasse II: Sichtprüfung, Isolationswiderstand, Berührungsstrom, Funktionsprüfung.' : 'Schutzklasse III: Sichtprüfung, Isolationswiderstand, Funktionsprüfung; ein Ableitstrom wird im Lernmodell nicht gemessen (Kleinspannung).', 'Ergebnis: ' + names(ok) + '.'],
      tips: ['Welche Schutzmaßnahme hat das Gerät? Daraus folgt, was messbar und sinnvoll ist.', 'Schutzklasse II: kein Schutzleiter, aber Isolation und Berührungsstrom. Schutzklasse III: nur Kleinspannung.', 'Streiche zuerst alle Schritte mit Schutzleiter, dann prüfe, ob ein Strom gemessen wird.'] });
  };

  /* ================================================================ Qualität (qm) */
  const CLQ = [['Ein internes Audit wird geplant und durchgeführt', '9.2'], ['Die oberste Leitung bewertet das QM-System in festen Abständen', '9.3'], ['Für ein fehlerhaftes Produkt wird die Ursache beseitigt (Korrekturmaßnahme)', '10.2'], ['Messmittel werden kalibriert und auf Normale rückgeführt', '7.1.5'], ['Dokumentierte Information wird gelenkt und ihre Versionen verwaltet', '7.5'], ['Lieferanten werden beurteilt und überwacht', '8.4'], ['Risiken und Chancen werden ermittelt und Maßnahmen geplant', '6.1'], ['Die Zufriedenheit der Kunden wird erfasst und ausgewertet', '9.1.2'], ['Nichtkonforme Ergebnisse werden gekennzeichnet und gelenkt', '8.7'], ['Die Qualitätspolitik wird festgelegt und bekannt gemacht', '5.2']];
  G.qm1 = R => {
    const c = C(), cl = pk(R, CLQ), others = CLQ.filter(x => x[1] !== cl[1]).map(x => x[1]), wr = c.shuffle(R, others).slice(0, 3);
    return choiceQ(R, { text: 'In welchem Abschnitt der DIN EN ISO 9001:2015 (Normbezug Ausgabe 2015, nicht die neue Ausgabe 2026) geht es um Folgendes: ' + cl[0] + '?', right: 'Abschnitt ' + cl[1], wrong: wr.map(x => 'Abschnitt ' + x),
      expl: ['Normbezug ist die Ausgabe 2015. Gliederung: 4 Kontext, 5 Führung, 6 Planung, 7 Unterstützung, 8 Betrieb, 9 Bewertung der Leistung, 10 Verbesserung.', 'Das Thema „' + cl[0] + '“ gehört zu Abschnitt ' + cl[1] + '.', 'Ergebnis: Abschnitt ' + cl[1] + '.'],
      tips: ['Ordne das Thema zuerst einem der Hauptabschnitte 4 bis 10 zu.', 'Überwachung und Audit stehen in 9, Verbesserung und Korrekturmaßnahmen in 10, Ressourcen und Dokumente in 7, Lieferanten und Produktion in 8.', 'Messmittel: 7.1.5. Dokumentierte Information: 7.5. Internes Audit: 9.2. Managementbewertung: 9.3.'] });
  };
  const PHQ = [['Qualitätsziele für das nächste Jahr werden festgelegt', 6], ['Ein Prozess wird nach der Planung durchgeführt (Fertigung)', 8], ['Die Prozessergebnisse werden überwacht und gemessen', 9], ['Ein internes Audit deckt Abweichungen auf', 9], ['Nach einer Reklamation wird die Ursache beseitigt', 10], ['Ressourcen und Kompetenzen werden bereitgestellt', 7], ['Maßnahmen zum Umgang mit Risiken werden geplant', 6], ['Aus der Managementbewertung folgen Verbesserungsmaßnahmen', 10]];
  G.qm2 = R => {
    const c = C(), q = pk(R, PHQ), cl = c.CLAUSES.find(x => x.k === String(q[1])), alt = q[1] <= 6 ? 'P' : q[1] <= 8 ? 'D' : q[1] === 9 ? 'C' : 'A', all = ['P', 'D', 'C', 'A'];
    return choiceQ(R, { text: 'Der PDCA-Zyklus (Plan, Do, Check, Act) liegt der ISO 9001 zugrunde. Zu welcher Phase gehört: ' + q[0] + ' (Abschnitt ' + q[1] + ')?', right: c.PHASE[cl.phase], altRight: c.PHASE[alt], wrong: all.filter(x => x !== cl.phase).map(x => c.PHASE[x]),
      expl: ['Plan: Planung (Abschnitt 6, auf Grundlage von Kontext 4 und Führung 5). Do: Unterstützung (7) und Betrieb (8). Check: Abschnitt 9 (Bewertung der Leistung). Act: Abschnitt 10 (Verbesserung).', 'Abschnitt ' + q[1] + ' (' + cl.name + ') gehört zur Phase ' + c.PHASE[cl.phase] + '.', 'Ergebnis: ' + c.PHASE[cl.phase] + '.'],
      tips: ['PDCA: planen, tun, prüfen, handeln.', 'Alles Planerische und die Bereitstellung der Mittel ist Plan, die Umsetzung Do, die Auswertung Check, die Korrektur Act.', 'Zähle ab: Abschnitt 6 Plan, 7 und 8 Do, 9 Check, 10 Act.'] });
  };
  const rDate = (R, lo, span) => C().isoFromDay(C().dayNum(lo) + ri(R, 0, span));
  G.qm3 = R => {
    const c = C(), last = rDate(R, '2025-06-01', 450), mon = pk(R, [6, 12, 12, 24]), due = c.addMonths(last, mon), today = c.isoFromDay(Math.max(c.dayNum(last), c.dayNum(due) + ri(R, -200, 60))), st = c.calStatus(last, mon, today);
    return numQ({ text: 'Ein Messschieber wurde am ' + c.fmtDate(last) + ' kalibriert, das Kalibrierintervall beträgt ' + mon + ' Monate. Heute ist der ' + c.fmtDate(today) + '. Wie viele Tage sind es bis zum Fälligkeitstag (negativ = bereits überfällig)?', unit: 'Tage', label: 'Tage bis zur Fälligkeit', value: st.left, alt: c.chk.daysBetween(today, c.chk.addMonths(last, mon)), tol: 0.4,
      expl: ['Fälligkeit = Kalibrierdatum + Intervall: ' + c.fmtDate(last) + ' + ' + mon + ' Monate = ' + c.fmtDate(due) + ' (bei kürzerem Monat gilt der letzte Tag).', 'Tage vom heutigen Tag bis zur Fälligkeit: ' + c.fmtDate(today) + ' → ' + c.fmtDate(due) + '.', 'Ergebnis: ' + f(st.left, 0) + ' Tage' + (st.left < 0 ? ' (überfällig)' : '') + '.'],
      tips: ['Zuerst das Fälligkeitsdatum bestimmen: Kalibrierdatum plus Intervall in Monaten.', 'Dann die Tage zwischen heute und dem Fälligkeitsdatum zählen. Liegt die Fälligkeit in der Vergangenheit, ist die Zahl negativ.', 'Hinweis: Am Fälligkeitstag selbst ist das Prüfmittel noch gültig.'] });
  };
  G.qm4 = R => {
    const c = C(), last = rDate(R, '2025-06-01', 450), mon = pk(R, [6, 12, 12, 24]), due = c.addMonths(last, mon), today = c.isoFromDay(Math.max(c.dayNum(last), c.dayNum(due) + pk(R, [-200, -90, -31, -30, -10, 0, 1, 15, 60]))), st = c.calStatus(last, mon, today);
    const ch = { gueltig: 'Weiter verwenden: Die Kalibrierung ist gültig', bald: 'Noch verwendbar, die Kalibrierung aber jetzt veranlassen (bald fällig)', ueberfaellig: 'Sofort sperren und kennzeichnen; erst nach der Kalibrierung wieder verwenden' };
    const days = Math.round((Date.parse(due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000), kk = days < 0 ? 'ueberfaellig' : days <= 30 ? 'bald' : 'gueltig';
    return choiceQ(R, { text: 'Ein Messmittel wurde am ' + c.fmtDate(last) + ' kalibriert (Intervall ' + mon + ' Monate). Heute ist der ' + c.fmtDate(today) + '. Im Betrieb gilt: Warnung ab 30 Tagen vor Fälligkeit, danach Sperre. Was ist zu tun?', right: ch[st.status], altRight: ch[kk], wrong: Object.keys(ch).filter(x => x !== st.status).map(x => ch[x]),
      expl: ['Fälligkeit: ' + c.fmtDate(last) + ' + ' + mon + ' Monate = ' + c.fmtDate(st.due) + '. Heute: ' + c.fmtDate(today) + '.', 'Verbleibende Tage: ' + f(st.left, 0) + '. Am Fälligkeitstag selbst gilt die Kalibrierung noch; ab dem Folgetag ist das Messmittel überfällig.', 'Ergebnis: ' + c.CAL_TEXT[st.status] + ' → ' + ch[st.status] + '.'],
      tips: ['Berechne die Tage bis zur Fälligkeit.', 'Mehr als 30 Tage: gültig. 0 bis 30 Tage: Warnung. Negativ: überfällig.', 'Ein überfälliges Messmittel liefert keine nachweisbar gültigen Ergebnisse: sperren und kennzeichnen.'] });
  };
  G.qm5 = R => {
    const c = C(), base = '2026-01-01', docs = [1, 2, 3, 4].map(k => ({ rev: k, status: k === 1 ? 'zurueck' : pk(R, ['frei', 'frei', 'entwurf']), ab: rDate(R, base, 150 * k) })), today = c.isoFromDay(c.dayNum(base) + ri(R, 100, 600)), v = c.validDoc(docs, today), a = c.chk.validDoc(docs, today);
    const ST = { zurueck: 'zurückgezogen', frei: 'freigegeben', entwurf: 'Entwurf' }, ch = [1, 2, 3, 4].map(k => 'Revision ' + k).concat(['Keine Revision ist gültig']);
    return choiceQ(R, { text: 'Dokumentenlenkung: Heute ist der ' + c.fmtDate(today) + '. Stände der Arbeitsanweisung: ' + docs.map(d => 'Revision ' + d.rev + ' ' + ST[d.status] + ', gültig ab ' + c.fmtDate(d.ab)).join('; ') + '. Welche Revision gilt?', right: v == null ? ch[4] : ch[v - 1], altRight: a == null ? ch[4] : ch[a - 1], wrong: ch.filter((_, i) => i !== (v == null ? 4 : v - 1)),
      expl: ['Gültig ist die höchste freigegebene Revision, deren Gültigkeitsdatum erreicht ist. Entwürfe und zurückgezogene Stände gelten nie.', docs.map(d => 'Revision ' + d.rev + ': ' + ST[d.status] + (d.status === 'frei' ? (c.dayNum(d.ab) <= c.dayNum(today) ? ', Datum erreicht' : ', Datum noch nicht erreicht') : '')).join('; ') + '.', 'Ergebnis: ' + (v == null ? 'keine Revision ist gültig' : 'Revision ' + v) + '.'],
      tips: ['Streiche Entwürfe und zurückgezogene Stände.', 'Von den freigegebenen Ständen zählen nur die, deren Gültigkeitsdatum heute erreicht oder überschritten ist.', 'Nimm von diesen die höchste Revisionsnummer.'] });
  };
  G.qm6 = R => {
    const c = C(), T = pk(R, [0.1, 0.2, 0.05, 0.4, 0.5]), U = pk(R, [0.005, 0.01, 0.015, 0.02, 0.025, 0.04]), v = c.capability(T, U);
    return numQ({ text: 'Ein Prüfmittel soll ein Maß mit der Toleranzbreite T = ' + f(T, 3) + ' mm prüfen. Seine erweiterte Messunsicherheit beträgt U = ' + f(U, 3) + ' mm. Wie groß ist das Verhältnis T/U?', unit: '', label: 'Verhältnis T/U (ohne Einheit)', value: v, alt: Math.round(T * 1e6) / Math.round(U * 1e6), tol: tolOf(v, 0.005, 0.01),
      expl: ['Das Verhältnis aus Toleranzbreite und Messunsicherheit beschreibt, wie gut das Prüfmittel zur Aufgabe passt.', 'T/U = ' + f(T, 3) + ' mm / ' + f(U, 3) + ' mm.', 'Ergebnis: ' + f(v, 2) + '. Je größer der Wert, desto geeigneter das Prüfmittel; häufig werden mindestens 4:1 bis 10:1 gefordert (Festlegung im eigenen QM-System).'],
      tips: ['Beide Größen in derselben Einheit (hier mm).', 'Verhältnis = Toleranzbreite geteilt durch Messunsicherheit.', 'Rechne ' + f(T, 3) + ' / ' + f(U, 3) + '.'] });
  };
  G.qm7 = R => {
    const c = C(), req = pk(R, [4, 10]), U = 0.01, T = pk(R, [req * U * 0.8, req * U, req * U * 1.5, req * U * 3]), r = Math.round(T * 1e6) / Math.round(U * 1e6), ok = c.capability(T, U) >= req - 1e-9;
    const ch = ['Geeignet: das Verhältnis T/U erreicht den geforderten Wert', 'Nicht geeignet: das Verhältnis T/U liegt unter dem geforderten Wert', 'Nicht entscheidbar ohne weitere Kalibrierung'];
    return choiceQ(R, { text: 'Das Qualitätssystem fordert T/U ≥ ' + req + '. Ein Prüfmittel hat U = ' + f(U, 3) + ' mm und soll eine Toleranzbreite von T = ' + f(T, 3) + ' mm prüfen. Ist es geeignet?', right: ok ? ch[0] : ch[1], altRight: r >= req - 1e-9 ? ch[0] : ch[1], wrong: ok ? [ch[1], ch[2]] : [ch[0], ch[2]],
      expl: ['Verhältnis T/U = ' + f(T, 3) + ' mm / ' + f(U, 3) + ' mm = ' + f(c.capability(T, U), 2) + '.', 'Gefordert: mindestens ' + req + '. Genau der Mindestwert reicht noch.', 'Ergebnis: ' + (ok ? 'geeignet' : 'nicht geeignet') + '.'],
      tips: ['Bilde das Verhältnis T/U.', 'Vergleiche mit dem geforderten Mindestwert: größer oder gleich ist gut.', 'Ist T/U zu klein, braucht man ein genaueres Prüfmittel.'] });
  };
  G.qm8 = R => {
    const c = C(), last = rDate(R, '2026-01-05', 120), found = c.isoFromDay(c.dayNum(last) + ri(R, 20, 90)), per = pk(R, [20, 40, 60, 120]), wd = c.workdays(last, found), v = wd * per;
    return numQ({ text: 'Bei der Kalibrierung am ' + c.fmtDate(found) + ' zeigt sich, dass ein Messmittel außerhalb der Toleranz lag. Die letzte Kalibrierung mit gutem Ergebnis war am ' + c.fmtDate(last) + '. An jedem Arbeitstag (Montag bis Freitag) nach diesem Datum bis einschließlich ' + c.fmtDate(found) + ' wurden ' + per + ' Teile mit dem Messmittel geprüft. Wie viele Teile müssen nachträglich bewertet werden?', unit: 'Teile', label: 'Betroffene Teile', value: v, alt: c.chk.workdays(last, found) * per, tol: 0.4,
      expl: ['Wird ein Messmittel als nicht in Ordnung festgestellt, muss bewertet werden, ob frühere Messergebnisse noch gültig sind (ISO 9001, 7.1.5).', 'Arbeitstage zwischen ' + c.fmtDate(last) + ' (nicht mitgezählt) und ' + c.fmtDate(found) + ' (mitgezählt): ' + f(wd, 0) + '.', 'Betroffene Teile: ' + f(wd, 0) + ' · ' + per + ' = ' + f(v, 0) + '.'],
      tips: ['Zähle nur die Arbeitstage Montag bis Freitag.', 'Der Tag der letzten guten Kalibrierung zählt nicht mit, der Tag der Feststellung schon.', 'Betroffene Teile = Arbeitstage · Teile pro Tag.'] });
  };
  G.qm9 = R => {
    const c = C(), n = pk(R, [20000, 50000, 125000, 400000, 1000000]), d = ri(R, 2, 60), v = c.ppm(d, n);
    return numQ({ text: 'In einem Los von ' + f(n, 0) + ' Teilen wurden ' + d + ' fehlerhafte Teile gefunden. Wie hoch ist die Fehlerquote in ppm (Teile je Million)?', unit: 'ppm', label: 'Fehlerquote', value: v, alt: d / n * 1000000, tol: tolOf(v, 0.005, 0.05),
      expl: ['ppm bedeutet Teile je Million: Anteil · 1 000 000.', 'Anteil = ' + d + ' / ' + f(n, 0) + ' = ' + f(d / n, 7) + '.', 'Fehlerquote = ' + f(d / n, 7) + ' · 1 000 000 = ' + f(v, 1) + ' ppm.'],
      tips: ['Fehlerquote = fehlerhafte Teile geteilt durch alle Teile.', 'ppm = Quote · 1 000 000.', 'Rechne ' + d + ' / ' + f(n, 0) + ' · 1 000 000.'] });
  };
  G.qm10 = R => {
    const c = C(), y = [0, 1, 2].map(() => pk(R, [92, 95, 96.5, 98, 98.5, 99, 99.5])), v = c.rolled(y), names = ['Bestücken', 'Löten', 'Prüfen'];
    return numQ({ text: 'Eine Fertigung hat drei Prozessschritte hintereinander mit Erstausbeuten: ' + names.map((n, i) => n + ' ' + f(y[i], 1) + ' %').join(', ') + '. Wie hoch ist die Gesamtausbeute der Kette (rolled throughput yield)?', unit: '%', label: 'Gesamtausbeute', value: v, alt: c.chk.rolled(y), tol: tolOf(v, 0.001, 0.02),
      expl: ['Teile, die einen Schritt nicht fehlerfrei passieren, fehlen im nächsten. Die Ausbeuten werden daher multipliziert.', f(y[0], 1) + ' % · ' + f(y[1], 1) + ' % · ' + f(y[2], 1) + ' % = ' + f(y[0] / 100, 3) + ' · ' + f(y[1] / 100, 3) + ' · ' + f(y[2] / 100, 3) + ' = ' + f(v / 100, 5) + '.', 'Gesamtausbeute: ' + f(v, 2) + ' %. Sie ist kleiner als jede Einzelausbeute.'],
      tips: ['Die Gesamtausbeute einer Kette ist kleiner als jede einzelne Ausbeute.', 'Rechne die Prozentwerte in Anteile um (98 % = 0,98) und multipliziere.', 'Gesamtausbeute = Y₁ · Y₂ · Y₃, am Ende wieder in Prozent.'] });
  };

  /* ================================================================ Aufgabenliste */
  const defs = [
    ['ce', 1, 'Welche Richtlinien gelten für das Produkt?', 'ce1'], ['ce', 1, 'Wie viele CE-pflichtige Rechtsvorschriften?', 'ce2'], ['ce', 1, 'Funkgerät: RED statt LVD und EMV', 'ce3'], ['ce', 2, 'Reihenfolge der Konformitätsbewertung', 'ce4'], ['ce', 2, 'Spannungsbereich der Niederspannungsrichtlinie', 'ce5'],
    ['ce', 2, 'REACH: Massenanteil eines SVHC', 'ce6'], ['ce', 2, 'REACH: Informationspflicht ja oder nein', 'ce7'], ['ce', 2, 'RoHS: zulässige Höchstmasse im Werkstoff', 'ce8'], ['ce', 3, 'Konformitätsverfahren: allein oder mit Benannter Stelle', 'ce9'], ['ce', 3, 'Alle sieben Rechtsvorschriften zählen', 'ce10'],
    ['sk', 1, 'Schutzklasse erkennen', 'sk1'], ['sk', 1, 'IP-Code lesen', 'sk2'], ['sk', 2, 'Kleinste geeignete Schutzart wählen', 'sk3'], ['sk', 2, 'IPX7 und Strahlwasser', 'sk4'], ['sk', 2, 'Bemessungs-Stoßspannung nach Kategorie', 'sk5'],
    ['sk', 1, 'Überspannungskategorie zuordnen', 'sk6'], ['sk', 2, 'Luftstrecke berechnen (Lernmodell)', 'sk7'], ['sk', 3, 'Kriechstrecke berechnen (Lernmodell)', 'sk8'], ['sk', 3, 'Verstärkte Isolierung in der Höhe', 'sk9'], ['sk', 3, 'Strecken beurteilen: Luft und Kriechweg', 'sk10'],
    ['ms', 1, 'Risikograph: PLr bestimmen', 'ms1'], ['ms', 1, 'PL aus PFHd', 'ms2'], ['ms', 2, 'SIL aus PFH', 'ms3'], ['ms', 2, 'PFHd in Reihe addieren', 'ms4'], ['ms', 2, 'Kategorie B bis 4 erkennen', 'ms5'], ['ms', 2, 'MTTFd eines Kanals', 'ms6'],
    ['ms', 3, 'Erreichbarer PL aus Kategorie, MTTFd, DC', 'ms7'], ['ms', 3, 'Mittlerer Diagnosedeckungsgrad DCavg', 'ms8'], ['ms', 2, 'Not-Halt: Zustand nach Ereignisfolge', 'ms9'], ['ms', 3, 'Sicherheitsabstand eines Lichtvorhangs', 'ms10'], ['ms', 3, 'Reicht die Steuerung für das Risiko?', 'ms11'],
    ['pf', 1, 'Reihenfolge der Prüfschritte', 'pf1'], ['pf', 1, 'Grenzwert Schutzleiterwiderstand', 'pf2'], ['pf', 1, 'Mindest-Isolationswiderstand', 'pf3'], ['pf', 2, 'Schutzleiterstrom-Grenzwert beim Heizgerät', 'pf4'], ['pf', 2, 'Schutzleiterwiderstand beurteilen', 'pf5'],
    ['pf', 2, 'Gesamtbeurteilung eines Prüflings', 'pf6'], ['pf', 2, 'Sichtprüfung findet einen Befund', 'pf7'], ['pf', 3, 'Schutzleiterstrom-Grenzwert mit Randfällen', 'pf8'], ['pf', 3, 'Ausnutzung des Grenzwerts', 'pf9'], ['pf', 2, 'Prüfschritte bei Schutzklasse II und III', 'pf10'],
    ['qm', 1, 'ISO 9001: Abschnitt zuordnen', 'qm1'], ['qm', 1, 'PDCA-Phase zuordnen', 'qm2'], ['qm', 2, 'Tage bis zur Kalibrierfälligkeit', 'qm3'], ['qm', 2, 'Prüfmittelstatus und Maßnahme', 'qm4'], ['qm', 2, 'Dokumentenlenkung: gültige Revision', 'qm5'],
    ['qm', 2, 'Verhältnis Toleranz zu Messunsicherheit', 'qm6'], ['qm', 2, 'Ist das Prüfmittel geeignet?', 'qm7'], ['qm', 3, 'Rückwirkende Bewertung nach Messmittelfehler', 'qm8'], ['qm', 2, 'Fehlerquote in ppm', 'qm9'], ['qm', 3, 'Gesamtausbeute einer Prozesskette', 'qm10']
  ];
  const cnt = {};
  const tasks = defs.map(d => { cnt[d[0]] = (cnt[d[0]] || 0) + 1; return { id: 'nrm' + d[0] + cnt[d[0]], topic: d[0], cat: CATS[TOPICS.findIndex(t => t.k === d[0])], level: d[1], title: d[2], gen: d[3] }; });
  function make(t, R) { const q = G[t.gen](R); q.id = t.id; q.topic = t.topic; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  const makeTask = t => make(t, C().rng('nrm-' + t.id));
  function randomQ(R, level, topic) {
    const pool = tasks.filter(t => (!level || t.level === level) && (!topic || t.topic === topic)), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ================================================================ Erklärtexte (eigene Worte) */
  const eq = h => `<span class="eq">${h}</span>`;
  const WARN = `<p class="rdout warn">${NOTE}</p>`;
  const EXPLAIN = {
    ce: `<p>Ein Produkt darf in der EU nur in Verkehr gebracht werden, wenn der <b>Hersteller</b> erklärt, dass es die Anforderungen aller für das Produkt geltenden Rechtsvorschriften erfüllt. Das <b>CE-Zeichen</b> ist diese Erklärung in Zeichenform. Es ist kein Prüfzeichen einer Behörde und kein Gütesiegel. Die Verantwortung liegt beim Hersteller. Wer Produkte aus Drittländern einführt, muss sicherstellen, dass der Hersteller die Bewertung durchgeführt hat, und selbst mit Namen und Anschrift auf dem Produkt stehen.</p>
      <table><tr><th>Rechtsvorschrift</th><th>Gegenstand</th><th>CE</th></tr>
      <tr><td>Niederspannungsrichtlinie (2014/35/EU)</td><td>Elektrische Sicherheit von Geräten mit 50 bis 1000 V AC oder 75 bis 1500 V DC</td><td>ja</td></tr>
      <tr><td>EMV-Richtlinie (2014/30/EU)</td><td>Störaussendung und Störfestigkeit</td><td>ja</td></tr>
      <tr><td>Maschinenrichtlinie (2006/42/EG)</td><td>Sicherheit von Maschinen, auch ihrer Elektrik</td><td>ja</td></tr>
      <tr><td>Funkanlagenrichtlinie, RED (2014/53/EU)</td><td>Funkgeräte: Sicherheit, EMV und Funkspektrum zusammen</td><td>ja</td></tr>
      <tr><td>RoHS (2011/65/EU)</td><td>Verbot bestimmter Stoffe in Elektrogeräten</td><td>ja</td></tr>
      <tr><td>WEEE (2012/19/EU)</td><td>Rücknahme und Entsorgung von Elektroschrott (in Deutschland ElektroG)</td><td>nein</td></tr>
      <tr><td>REACH (EG) Nr. 1907/2006</td><td>Chemikalien und Stoffe in Erzeugnissen</td><td>nein</td></tr></table>
      <p><b>Zwei Vorfahrtsregeln:</b> Eine <b>Funkanlage</b> fällt unter die RED, die Sicherheit und EMV mit regelt; LVD und EMV-Richtlinie kommen dafür nicht zusätzlich dazu. Bei einer <b>Maschine</b> sind die elektrischen Gefährdungen über die Maschinenrichtlinie abgedeckt, deren Konformitätsverfahren dann gilt; die EMV-Richtlinie kommt zusätzlich dazu. Ausnahme: Haushaltsgeräte, Büro- und IT-Geräte und Elektromotoren mit Netzspannung bleiben bei der Niederspannungsrichtlinie, auch wenn sich darin etwas bewegt. Die Maschinenrichtlinie wird durch die Maschinenverordnung (EU) 2023/1230 abgelöst, die ab 20. Januar 2027 gilt.</p>
      <p>Das Lernmodell betrachtet sieben Vorschriften. In der Praxis kommen je nach Produkt weitere dazu, zum Beispiel die Batterieverordnung, Cybersicherheits-Anforderungen für Funkanlagen und die allgemeine Produktsicherheitsverordnung.</p>
      <p><b>Ablauf der Konformitätsbewertung</b> (jeder Schritt setzt den vorigen voraus): Rechtsvorschriften bestimmen, harmonisierte Normen wählen, <b>Risikobeurteilung</b> durchführen, konstruieren und nachweisen, <b>technische Dokumentation</b> erstellen, Bewertungsverfahren abschließen, <b>EU-Konformitätserklärung</b> ausstellen, CE-Zeichen anbringen, in Verkehr bringen. Unterlagen bleiben mindestens zehn Jahre aufbewahrt. Meist darf der Hersteller selbst bewerten (interne Fertigungskontrolle); in Sonderfällen muss eine <b>Benannte Stelle</b> mitwirken.</p>
      <p><b>Stoffe:</b> RoHS begrenzt zum Beispiel Blei, Quecksilber und sechswertiges Chrom auf 0,1 % je homogenem Werkstoff, Cadmium auf 0,01 %. REACH verlangt, dass der Lieferant seine Abnehmer informiert (und Verbraucher auf Anfrage innerhalb von 45 Tagen), wenn ein besonders besorgniserregender Stoff (SVHC) <b>über 0,1 %</b> der Masse eines Erzeugnisses ausmacht; Bezugsgröße ist das einzelne Erzeugnis (nach der Rechtsprechung auch jedes Bauteil), nicht automatisch das Gesamtgerät. Genau 0,1 % löst die Pflicht noch nicht aus.</p>
      ${WARN}`,
    sk: `<p>Dieser Block beantwortet: Wie schützt ein Gerät vor Berührung, Fremdkörpern und Wasser, und welche Abstände braucht die Isolierung?</p>
      <p><b>Schutzklassen:</b> <b>I</b> Basisisolierung plus Schutzleiter am Gehäuse. <b>II</b> Schutzisolierung (doppelte oder verstärkte Isolierung), kein Schutzleiter, Zeichen: zwei Quadrate ineinander. <b>III</b> Kleinspannung (SELV oder PELV), im Gerät tritt keine gefährliche Spannung auf.</p>
      <p><b>IP-Code:</b> zwei Ziffern. Erste Ziffer 0 bis 6: Schutz gegen feste Körper und Staub (1: ab 50 mm, 2: ab 12,5 mm, 3: ab 2,5 mm, 4: ab 1 mm, 5 staubgeschützt, 6 staubdicht). Zweite Ziffer 0 bis 9: Wasser (1 senkrechte Tropfen, 2 schräge Tropfen, 3 Sprühwasser, 4 Spritzwasser, 5 Strahlwasser, 6 starkes Strahlwasser, 7 zeitweiliges Untertauchen, 8 dauerndes Untertauchen, 9 heißer Hochdruckstrahl). Ein X heißt „nicht angegeben“. Die Ziffern 0 bis 6 bauen aufeinander auf; <b>7 und 8 schließen die Ziffern 1 bis 4 ein, aber nicht Strahlwasser (5, 6)</b>, und 9 schließt weder 5/6 noch 7/8 ein: ein Gehäuse nur mit IPX7 gilt nicht automatisch als strahlwassergeschützt (IP67 erfüllt also IPX4, aber nicht IPX5). Dafür gibt es Doppelangaben wie IPX5/IPX7.</p>
      <p><b>Überspannungskategorie</b> (I bis IV) sagt, wie viel Überspannung ein Gerät aushalten muss: Je näher an der Einspeisung, desto höher. Aus Netzspannung (Leiter–Neutral) und Kategorie folgt die Bemessungs-Stoßspannung, zum Beispiel bei 230 V: I 1,5 kV, II 2,5 kV, III 4 kV, IV 6 kV. <b>Verschmutzungsgrad</b> 1 bis 4 beschreibt die Umgebung am Isolierteil: 1 sauber und trocken, 2 nur nichtleitende Verschmutzung (zeitweise Betauung), 3 leitfähige oder durch Betauung leitfähig werdende Verschmutzung, 4 dauernde Leitfähigkeit durch Staub, Regen oder Schnee.</p>
      <p><b>Luftstrecke</b> ist der kürzeste Weg durch die Luft zwischen zwei leitenden Teilen, <b>Kriechstrecke</b> der kürzeste Weg entlang der Oberfläche des Isolierstoffs. Das Lernmodell rechnet so: Luftstrecke = Tabellenwert zur Stoßspannung (bei verstärkter Isolierung eine Stufe höher), mal Höhenfaktor über 2000 m, mindestens der Wert zum Verschmutzungsgrad. Kriechstrecke = Tabellenwert zu Arbeitsspannung (aufrunden), Verschmutzungsgrad und Werkstoffgruppe (aus dem CTI: I ab 600, II ab 400, IIIa ab 175, IIIb ab 100), bei verstärkter Isolierung doppelt, nie kleiner als die Luftstrecke. Bei Verschmutzungsgrad 1 gelten eigene Kriechstreckenwerte, unabhängig vom Werkstoff: 0,56 mm bis 250 V, 1,0 mm bis 400 V, 1,3 mm bis 500 V, 1,8 mm bis 630 V (Lernwerte, an der Norm prüfen).</p>
      <p class="rdout warn"><b>Lernbeispiel:</b> Die Tabellen im Reiter sind vereinfacht und an die Größenordnung der Normtabellen angelehnt, nicht mit ihnen identisch. Für Entwicklung und Prüfung gilt nur die aktuelle Normfassung (Isolationskoordination, IP-Code). ${NOTE}</p>`,
    ms: `<p>Maschinen sind sicher, wenn Gefährdungen erkannt, bewertet und in einer festen Rangfolge gemindert wurden: erst <b>inhärent sichere Konstruktion</b>, dann <b>technische Schutzmaßnahmen</b>, zuletzt <b>Benutzerinformation</b>. Sicherheitsfunktionen (Sensor, Auswertung, Aktor) müssen dabei so zuverlässig sein, wie das Risiko verlangt.</p>
      <p><b>Risikograph:</b> Drei Fragen. <b>S</b> Schwere (S1 leicht, S2 schwer oder tödlich). <b>F</b> Häufigkeit und Dauer der Gefährdung (F1 selten oder kurz, F2 häufig oder lang). <b>P</b> Möglichkeit zu vermeiden (P1 möglich unter Bedingungen, P2 kaum möglich). Daraus folgt der <b>erforderliche Performance Level PLr</b> von a (niedrig) bis e (hoch).</p>
      <p><b>PL und SIL:</b> Der erreichte PL folgt aus der mittleren Wahrscheinlichkeit eines gefährlichen Ausfalls je Stunde (PFHd): PL a ab 10⁻⁵ bis unter 10⁻⁴, PL b 3·10⁻⁶ bis 10⁻⁵, PL c 10⁻⁶ bis 3·10⁻⁶, PL d 10⁻⁷ bis 10⁻⁶, PL e 10⁻⁸ bis 10⁻⁷. Das SIL (1 bis 3) hat Bänder 10⁻⁶ bis 10⁻⁵ (SIL 1), 10⁻⁷ bis 10⁻⁶ (SIL 2), 10⁻⁸ bis 10⁻⁷ (SIL 3). Etwa entsprechen PL b und c SIL 1, PL d SIL 2, PL e SIL 3. Teilsysteme in Reihe: die PFHd-Werte werden addiert. ${eq('PFHd gesamt = PFHd₁ + PFHd₂ + PFHd₃ &nbsp; 1/MTTFd = 1/MTTFd₁ + 1/MTTFd₂ + … &nbsp; DCavg = Σ(DC/MTTFd) / Σ(1/MTTFd)')}</p>
      <p><b>Kategorien:</b> B Grundprinzipien. 1 bewährte Bauteile. 2 Testeinrichtung zwischen den Anforderungen. 3 ein einzelner Fehler führt nicht zum Verlust, nicht alle Fehler werden erkannt. 4 ein einzelner Fehler führt nicht zum Verlust, Fehler werden rechtzeitig erkannt, auch die Anhäufung ist beherrscht. Für den erreichbaren PL zählen zusätzlich MTTFd (niedrig 3 bis unter 10, mittel 10 bis unter 30, hoch 30 bis 100 Jahre je Kanal) und der Diagnosedeckungsgrad DCavg (keine unter 60 %, niedrig 60 bis unter 90 %, mittel 90 bis unter 99 %, hoch ab 99 %).</p>
      <p><b>Hinweis zur Matrix:</b> Kategorie B mit hoher MTTFd ist in der Norm nicht vorgesehen und hier auf PL b begrenzt (Ergänzung des Lernmodells). Bei Kategorie 4 darf die MTTFd je Kanal über 100 Jahre hinaus bis 2500 Jahre angerechnet werden.</p>
      <p><b>Not-Halt:</b> eine ergänzende Schutzmaßnahme, kein Ersatz für Schutzeinrichtungen. Er wirkt als Stopp-Kategorie 0 (sofort abschalten) oder 1 (gesteuert stillsetzen, dann abschalten), nie als Kategorie 2. Der Taster rastet, wird nur von Hand entriegelt, und Entriegeln startet die Maschine nicht: Es folgt Rücksetzen und ein eigener Startbefehl. Zweikanalig aufgebaut erkennt die Schaltung auch, wenn ein Kanal ausfällt.</p>
      <p><b>Sicherheitsabstand</b> eines Lichtvorhangs bei senkrechter Annäherung: ${eq('S = K · T + C')} mit der Annäherungsgeschwindigkeit K, der Gesamtzeit T (Ansprechzeit plus Nachlaufzeit) und einem Zuschlag C aus dem Detektionsvermögen. Bei d bis 40 mm gilt als Untergrenze S ≥ 100 mm. Das Rechenmodell folgt der Ausgabe 2010 der ISO 13855; die Ausgabe 2025 der DIN EN ISO 13855 (international ISO 13855:2024) nennt die Größen anders (Trennungsabstand) und verlangt zusätzliche Zuschläge. Maßgeblich ist die aktuelle Ausgabe.</p>
      ${WARN}`,
    pf: `<p>Elektrische Geräte werden nach einer Instandsetzung und in regelmäßigen Abständen geprüft. Die Verfahren stehen in DIN EN 50678 (VDE 0701, nach Instandsetzung) und DIN EN 50699 (VDE 0702, wiederkehrend); sie ersetzten die frühere DIN VDE 0701-0702. Das Lernmodell hier vereinfacht den Ablauf und die Grenzwerte.</p>
      <p><b>Ablauf:</b> Zuerst <b>sehen</b> (Gehäuse, Leitung, Stecker, Zugentlastung, Kennzeichnung), dann <b>messen</b>: Schutzleiterwiderstand (nur Schutzklasse I), Isolationswiderstand, Schutzleiter- bzw. Berührungsstrom; danach Funktionsprüfung und Dokumentation mit Kennzeichnung und Termin der nächsten Prüfung. Bei einem sicherheitsrelevanten Mangel wird die Prüfung abgebrochen und das Gerät gesperrt.</p>
      <table><tr><th>Messung</th><th>Entscheidung im Lernmodell</th></tr>
      <tr><td>Schutzleiterwiderstand</td><td>höchstens 0,3 Ω bis 5 m Leitung, je weiteren angefangenen 7,5 m + 0,1 Ω, höchstens 1 Ω</td></tr>
      <tr><td>Isolationswiderstand</td><td>mindestens 1 MΩ (SK I), 2 MΩ (SK II), 0,25 MΩ (SK III); SK I mit Heizelementen mindestens 0,3 MΩ</td></tr>
      <tr><td>Schutzleiterstrom (SK I)</td><td>höchstens 3,5 mA; Heizgeräte ab 3,5 kW 1 mA je kW, höchstens 10 mA</td></tr>
      <tr><td>Berührungsstrom (SK II)</td><td>höchstens 0,5 mA</td></tr></table>
      <p>Der Grenzwert selbst gehört noch zum „bestanden“. Wichtig für die Praxis: Ein Wert nahe am Grenzwert verdient einen zweiten Blick (Kontaktwiderstand, Feuchte, Alter). Der erste verfehlte Schritt beendet die Prüfung: Gerät kennzeichnen, nicht benutzen, Mangel beheben und danach vollständig neu prüfen.</p>
      <p class="rdout warn">Grenzwerte und Messbedingungen (Messspannung, Messstrom, Sonderfälle) stehen in den Normen und ändern sich. ${NOTE}</p>`,
    qm: `<p>Die <b>DIN EN ISO 9001</b> beschreibt, wie ein Unternehmen seine Abläufe so steuert, dass Kundenanforderungen verlässlich erfüllt werden. Ihr Grundgedanke ist der <b>Prozessansatz</b> mit dem Kreislauf <b>PDCA</b>: Plan (planen: Planung, Abschnitt 6, auf Grundlage von Kontext 4 und Führung 5), Do (durchführen: Unterstützung 7 und Betrieb 8), Check (prüfen: Leistung bewerten, interne Audits, Managementbewertung, 9), Act (handeln: verbessern, Korrekturmaßnahmen, 10). Dazu kommt <b>risikobasiertes Denken</b>: Risiken und Chancen werden planvoll behandelt.</p><p><b>Ausgabe:</b> Die Aufgaben beziehen sich auf die DIN EN ISO 9001:2015. Im September 2026 ist die Nachfolgeausgabe ISO 9001:2026 erschienen (deutsche Fassung im Oktober 2026); Zertifikate nach der Ausgabe 2015 gelten in der Übergangszeit weiter. Die zehn Hauptabschnitte bleiben, einzelne Unterabschnitte können sich geändert haben: Abschnittsnummern daher an der aktuellen Ausgabe prüfen.</p>
      <p><b>Prüfmittelüberwachung</b> (Abschnitt 7.1.5): Messmittel, deren Ergebnisse für die Konformität eines Produkts zählen, werden in festgelegten Abständen kalibriert und auf Normale zurückgeführt, gekennzeichnet und geschützt. Ist ein Prüfmittel überfällig oder war es bei der Kalibrierung außerhalb der Toleranz, wird es gesperrt, und es wird bewertet, welche früheren Messergebnisse betroffen sind (Rückwärts-Bewertung). Die Eignung zeigt das Verhältnis aus Toleranzbreite T und Messunsicherheit U:${eq('Eignung = T / U &nbsp; (häufig mindestens 4:1 bis 10:1, im eigenen QM festgelegt)')}</p>
      <p><b>Dokumentenlenkung</b> (Abschnitt 7.5): Dokumente haben Titel, Revision, Freigabe und Gültigkeitsdatum. Am Arbeitsplatz liegt immer nur die gültige, freigegebene Revision vor. Entwürfe und zurückgezogene Stände sind nie gültig. Änderungen werden nachvollziehbar versioniert und bekannt gemacht.</p>
      <p><b>Kennzahlen:</b> Fehlerquote in ppm = fehlerhafte Teile / alle Teile · 10⁶. Erstausbeute = gute Teile beim ersten Durchlauf / alle Teile. Bei mehreren Prozessschritten hintereinander multiplizieren sich die Ausbeuten (Gesamtausbeute, rolled throughput yield).</p>
      <p>Ein <b>internes Audit</b> (9.2) prüft, ob das System die eigenen Vorgaben und die Norm erfüllt. Die <b>Managementbewertung</b> (9.3) bewertet es auf Leitungsebene. Aus Abweichungen folgen Korrekturmaßnahmen (10.2). Ein Zertifikat einer Zertifizierungsstelle bestätigt das System, nicht die einzelne Produktqualität.</p>
      ${WARN}`
  };

  root.NRM_DATA = { topics: TOPICS, cats: CATS, explain: EXPLAIN, tasks, gens: G, make, makeTask, randomQ, NOTE, LOCS };
  root.NRM_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.NRM_DATA, TASKS: root.NRM_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
