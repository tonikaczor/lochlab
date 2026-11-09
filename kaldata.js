'use strict';
/* Tonfunk Kalkulations-Lab: Aufgaben und Beispiele (Lab-Kennung 'kal', Präfix lm4.kal.).
   KAL_DATA.tasks: 41 Aufgaben (Stufe 1-3) in 7 Kategorien; jede hat make(R, C) mit seed-fähigem Zufallsgenerator R und KAL_CORE C.
   make liefert eine Aufgabeninstanz { text, rows, ask | fill, tips[], expl }:
     ask  = { key, label, unit, tol, value }  -> eine Zahl eingeben (Antwort = Zeile key des Lösungswegs)
     fill = [Schlüssel]                       -> Schema-Tabelle: diese Zeilen ausfüllen, die übrigen sind vorgegeben
   Krumme Werte: Generatoren probieren Zahlen, bis gerundete und ungerundete Rechnung am Ergebnis um weniger als 0,5 Cent abweichen.
   KAL_DATA.examples: durchgerechnete Beispiele (mode + params wie im Rechner), KAL_TASKS: Kurzliste [{id,cat,title,level}] für Karriere/Lernpfad.
   Prozentsätze sind frei gewählte Aufgabenwerte; sie entsprechen keinem festen Branchenwert. */
(function (root) {
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const tries = (gen, ok) => { let p; for (let i = 0; i < 80; i++) { p = gen(); if (ok(p)) return p; } return p; };
  const exact = p => Object.assign({}, p, { exact: true });
  const neat = (fn, key) => p => { const a = fn(p), b = fn(exact(p)); return a.ok && b.ok && Math.abs(a.val[key] - b.val[key]) < 0.0045; };
  const CATS = ['Bezug', 'Selbstkosten', 'Angebot', 'Rückwärts/Differenz', 'Spanne/Faktor', 'Deckungsbeitrag', 'Qualität und Projekt'];
  const tasks = [];
  const add = (cat, title, level, make) => tasks.push({ id: 'kal' + (tasks.length + 1), cat, title, level, make });
  const num = (C, res, key, label, unit) => ({ key, label, unit, tol: C.tolOf(unit), value: res.val[key] });
  const rowOf = (res, k) => res.rows.find(r => r.k === k);

  /* ---------- Bezug ---------- */
  const bezP = R => ({ lep: ri(R, 300, 2400, 10), rab: pick(R, [10, 15, 20, 25]), sko: pick(R, [2, 3]), bk: ri(R, 20, 150, 5) });
  const bezTxt = (C, p) => 'Listeneinkaufspreis ' + C.eur(p.lep) + ', Liefererrabatt ' + p.rab + ' %, Liefererskonto ' + p.sko + ' %, Bezugskosten ' + C.eur(p.bk);
  const TIP_BEZ = 'Rabatt rechnest du vom Listeneinkaufspreis, Skonto erst danach vom Zieleinkaufspreis. Bezugskosten kommen erst nach dem Skonto dazu.';
  add('Bezug', 'Bezugsschema ausfüllen', 1, (R, C) => {
    const p = bezP(R), res = C.bezug(p);
    return { text: 'Ein Industriebetrieb kauft Rohstoffe ein: ' + bezTxt(C, p) + '. Fülle das Bezugsschema Zeile für Zeile aus (die vorgegebenen Zeilen sind schon eingetragen).', rows: res.rows, fill: ['rab', 'zep', 'sko', 'bep', 'bzp'], tips: [TIP_BEZ], expl: 'Rabatt und Skonto sind Abzüge, die Bezugskosten ein Zuschlag. Jedes Zwischenergebnis wird auf Cent gerundet.' };
  });
  add('Bezug', 'Bareinkaufspreis', 1, (R, C) => {
    const p = bezP(R), res = C.bezug(p);
    return { text: 'Listeneinkaufspreis ' + C.eur(p.lep) + ', Liefererrabatt ' + p.rab + ' %, Liefererskonto ' + p.sko + ' %. Wie hoch ist der Bareinkaufspreis?', rows: res.rows.slice(0, 5), ask: num(C, res, 'bep', 'Bareinkaufspreis', '€'), tips: [TIP_BEZ], expl: 'LEP − Rabatt = Zieleinkaufspreis; Zieleinkaufspreis − Skonto = Bareinkaufspreis.' };
  });
  add('Bezug', 'Bezugspreis einer Lieferung', 2, (R, C) => {
    const m = pick(R, [10, 20, 25, 40, 50]), up = ri(R, 12, 90, 2), fr = ri(R, 30, 200, 5), vp = ri(R, 10, 60, 5);
    const p = { lep: C.rd2(m * up), rab: pick(R, [10, 15, 20]), sko: pick(R, [2, 3]), bk: fr + vp }, res = C.bezug(p);
    res.rows[0].calc = m + ' Stück × ' + C.eur(up); rowOf(res, 'bk').calc = C.eur(fr) + ' + ' + C.eur(vp);
    return { text: m + ' Stück werden zu je ' + C.eur(up) + ' Listeneinkaufspreis bezogen. Liefererrabatt ' + p.rab + ' %, Liefererskonto ' + p.sko + ' %. Fracht ' + C.eur(fr) + ', Verpackung ' + C.eur(vp) + '. Berechne den Bezugspreis der ganzen Lieferung.', rows: res.rows, ask: num(C, res, 'bzp', 'Bezugspreis der Lieferung', '€'), tips: [TIP_BEZ + ' Fracht und Verpackung sind zusammen die Bezugskosten.'], expl: 'Erst Listenpreis der Menge, dann Rabatt, Skonto, zuletzt Bezugskosten.' };
  });
  add('Bezug', 'Bezugspreis je Stück', 3, (R, C) => {
    const m = pick(R, [10, 20, 25, 50]), up = ri(R, 12, 90, 2), p = { lep: C.rd2(m * up), rab: pick(R, [10, 15, 20, 25]), sko: pick(R, [2, 3]), bk: ri(R, 40, 300, 10) }, res = C.bezug(p);
    res.rows[0].calc = m + ' Stück × ' + C.eur(up); const st = C.rd2(res.val.bzp / m);
    res.rows.push({ k: 'stk', label: 'Bezugspreis je Stück', op: '', v: st, u: '€', sum: true, calc: C.eur(res.val.bzp) + ' : ' + m + ' Stück' }); res.val.stk = st;
    return { text: m + ' Stück zu je ' + C.eur(up) + ' Listeneinkaufspreis, Liefererrabatt ' + p.rab + ' %, Liefererskonto ' + p.sko + ' %, Bezugskosten insgesamt ' + C.eur(p.bk) + '. Wie hoch ist der Bezugspreis (Einstandspreis) je Stück?', rows: res.rows, ask: num(C, res, 'stk', 'Bezugspreis je Stück', '€'), tips: ['Rechne zuerst das ganze Bezugsschema für die Gesamtmenge und teile erst am Ende durch die Stückzahl.'], expl: 'Gesamt-Bezugspreis durch die Stückzahl. Nicht vorher runden außer auf Cent.' };
  });

  /* ---------- Selbstkosten ---------- */
  const skP = R => ({ mek: ri(R, 1000, 9000, 100), mgk: pick(R, [10, 15, 20, 25]), fl: ri(R, 800, 6000, 100), fgk: pick(R, [100, 120, 150, 180, 200, 250]), vwgk: pick(R, [6, 8, 10, 12]), vtgk: pick(R, [3, 4, 5, 6]) });
  const skTxt = (C, p) => 'Materialeinzelkosten ' + C.eur(p.mek) + ', Materialgemeinkosten-Zuschlag ' + p.mgk + ' %, Fertigungslöhne ' + C.eur(p.fl) + ', Fertigungsgemeinkosten-Zuschlag ' + p.fgk + ' %, Verwaltungsgemeinkosten ' + p.vwgk + ' % und Vertriebsgemeinkosten ' + p.vtgk + ' % (beide auf die Herstellkosten)';
  const TIP_SK = 'Die Zuschläge für Material und Fertigung beziehen sich auf ihre Einzelkosten. Verwaltung und Vertrieb beziehen sich auf die Herstellkosten.';
  add('Selbstkosten', 'Industrie-Schema ausfüllen', 1, (R, C) => {
    const p = skP(R), res = C.selbstkosten(p);
    return { text: 'Ein Industriebetrieb hat folgende Werte: ' + skTxt(C, p) + '. Fülle das Selbstkostenschema aus.', rows: res.rows, fill: ['mgk', 'mk', 'fgk', 'fk', 'hk', 'vwgk', 'vtgk', 'sk'], tips: [TIP_SK], expl: 'Materialkosten + Fertigungskosten = Herstellkosten; darauf die Verwaltungs- und Vertriebsgemeinkosten ergeben die Selbstkosten.' };
  });
  add('Selbstkosten', 'Herstellkosten', 2, (R, C) => {
    const p = skP(R), res = C.selbstkosten(p);
    return { text: 'Berechne die Herstellkosten: ' + skTxt(C, p).replace(/, Verwaltungsgemeinkosten.*$/, '') + '.', rows: res.rows.slice(0, 7), ask: num(C, res, 'hk', 'Herstellkosten', '€'), tips: [TIP_SK], expl: 'Herstellkosten = Materialkosten + Fertigungskosten.' };
  });
  add('Selbstkosten', 'Selbstkosten eines Auftrags', 2, (R, C) => {
    const p = skP(R), res = C.selbstkosten(p);
    return { text: 'Berechne die Selbstkosten: ' + skTxt(C, p) + '.', rows: res.rows, ask: num(C, res, 'sk', 'Selbstkosten', '€'), tips: [TIP_SK], expl: 'Selbstkosten = Herstellkosten + Verwaltungsgemeinkosten + Vertriebsgemeinkosten.' };
  });
  add('Selbstkosten', 'Zuschlagssatz ermitteln', 3, (R, C) => {
    return zuschlagTask(R, C, ri(R, 0, 2));
  });
  function zuschlagTask(R, C, v) {
    const bases = [['Materialeinzelkosten', 'Materialgemeinkosten', 'MGK'], ['Fertigungslöhne', 'Fertigungsgemeinkosten', 'FGK'], ['Herstellkosten', 'Verwaltungsgemeinkosten', 'VwGK']][v];
    const pct = pick(R, [8, 10, 12, 15, 18, 20, 25]), base = ri(R, 1000, 9000, 500), gk = C.rd2(base * pct / 100);
    const rows = [{ k: 'satz', label: bases[2] + '-Zuschlagssatz', op: '', v: pct, u: '%', sum: true, calc: C.eur(gk) + ' : ' + C.eur(base) + ' × 100' }];
    return { text: 'In der Abrechnungsperiode fielen ' + bases[0] + ' von ' + C.eur(base) + ' und ' + bases[1] + ' von ' + C.eur(gk) + ' an. Berechne den Zuschlagssatz in Prozent.', rows, ask: { key: 'satz', label: bases[2] + '-Zuschlagssatz', unit: '%', tol: 0.1, value: pct }, tips: ['Zuschlagssatz = Gemeinkosten : Einzelkosten × 100. Die Einzelkosten sind die Bezugsgröße (100 %).'], expl: 'Zuschlagssatz = Gemeinkosten : Bezugsgröße × 100.' };
  }

  /* ---------- Angebot ---------- */
  /* PRUEFEN: Gewinn als Zuschlag auf die Selbstkosten; Skonto/Provision im Hundert vom Zielverkaufspreis, Rabatt im Hundert vom Listenverkaufspreis (Lehrbuch-Standard). */
  const angP = (R, ust) => ({ sk: ri(R, 500, 5000, 50), gew: pick(R, [8, 10, 12, 15, 20]), sko: pick(R, [2, 3]), prov: pick(R, [3, 4, 5]), rab: pick(R, [10, 15, 20]), ust: ust == null ? 19 : ust });
  const TIP_HU = 'Skonto, Provision und Rabatt sind „im Hundert“: Sie sind Prozente vom höheren Preis (ZVP bzw. LVP). Darum rechnest du dort mit ×100 : (100 − Prozent), nicht mit einem Aufschlag auf den kleineren Preis.';
  add('Angebot', 'Barverkaufspreis', 1, (R, C) => {
    const p = angP(R), res = C.angebot(p);
    return { text: 'Selbstkosten ' + C.eur(p.sk) + ', Gewinnzuschlag ' + p.gew + ' % auf die Selbstkosten. Berechne den Barverkaufspreis.', rows: res.rows.slice(0, 3), ask: num(C, res, 'bvp', 'Barverkaufspreis', '€'), tips: ['Der Gewinn wird als Zuschlag auf die Selbstkosten gerechnet (auf Hundert): Gewinn = Selbstkosten × Prozent : 100.'], expl: 'Barverkaufspreis = Selbstkosten + Gewinn.' };
  });
  add('Angebot', 'Angebotsschema bis Listenpreis', 2, (R, C) => {
    const ok = neat(C.angebot, 'lvp'), p = tries(() => angP(R), ok), res = C.angebot(p);
    return { text: 'Selbstkosten ' + C.eur(p.sk) + '; Gewinn ' + p.gew + ' %; Kundenskonto ' + p.sko + ' %; Vertreterprovision ' + p.prov + ' %; Kundenrabatt ' + p.rab + ' %. Fülle das Schema bis zum Listenverkaufspreis (netto) aus. Rechne zuerst den Zielverkaufspreis, danach Skonto und Provision.', rows: res.rows.slice(0, 8), fill: ['gew', 'bvp', 'sko', 'prov', 'zvp', 'rab', 'lvp'], tips: [TIP_HU], expl: 'ZVP = BVP × 100 : (100 − Skonto − Provision); Skonto und Provision sind Prozente vom ZVP. LVP = ZVP × 100 : (100 − Rabatt).' };
  });
  add('Angebot', 'Zielverkaufspreis', 2, (R, C) => {
    const p0 = tries(() => angP(R), neat(C.angebot, 'zvp')), p = { bvp: C.angebot(p0).val.bvp, sko: p0.sko, prov: p0.prov, rab: p0.rab, ust: 19 }, res = C.angebot(p);
    return { text: 'Der Barverkaufspreis beträgt ' + C.eur(p.bvp) + '. Der Kunde erhält ' + p.sko + ' % Skonto, der Vertreter ' + p.prov + ' % Provision (beides im Hundert vom Zielverkaufspreis). Wie hoch ist der Zielverkaufspreis?', rows: res.rows.slice(0, 4), ask: num(C, res, 'zvp', 'Zielverkaufspreis', '€'), tips: [TIP_HU], expl: 'Der Barverkaufspreis entspricht ' + C.fmtP(100 - p.sko - p.prov) + ' % des Zielverkaufspreises: ZVP = BVP × 100 : ' + C.fmtP(100 - p.sko - p.prov) + '.' };
  });
  add('Angebot', 'Listenverkaufspreis netto', 2, (R, C) => {
    const p0 = tries(() => angP(R), neat(C.angebot, 'lvp')), zvp = C.angebot(p0).val.zvp, p = { zvp, rab: p0.rab, ust: 19 }, res = C.angebot(p);
    return { text: 'Der Zielverkaufspreis beträgt ' + C.eur(zvp) + '. Dem Kunden werden ' + p.rab + ' % Rabatt (im Hundert vom Listenverkaufspreis) eingeräumt. Berechne den Listenverkaufspreis (netto).', rows: res.rows.slice(0, 3), ask: num(C, res, 'lvp', 'Listenverkaufspreis (netto)', '€'), tips: [TIP_HU], expl: 'Der Zielverkaufspreis ist ' + C.fmtP(100 - p.rab) + ' % des Listenverkaufspreises: LVP = ZVP × 100 : ' + C.fmtP(100 - p.rab) + '.' };
  });
  add('Angebot', 'Vollständiges Angebot mit USt', 3, (R, C) => {
    const ust = pick(R, [19, 7]), ok = neat(C.angebot, 'brutto'), p = tries(() => angP(R, ust), ok), res = C.angebot(p);
    return { text: 'Ein ' + (ust === 7 ? 'Fachbuch (ermäßigter Satz 7 %)' : 'Gerät (Regelsatz 19 %)') + ' wird kalkuliert: Selbstkosten ' + C.eur(p.sk) + '; Gewinn ' + p.gew + ' %; Skonto ' + p.sko + ' %; Provision ' + p.prov + ' %; Rabatt ' + p.rab + ' %; Umsatzsteuer ' + ust + ' %. Fülle das ganze Schema bis zum Bruttoverkaufspreis aus.', rows: res.rows, fill: ['gew', 'bvp', 'sko', 'prov', 'zvp', 'rab', 'lvp', 'ust', 'brutto'], tips: [TIP_HU + ' Die Umsatzsteuer kommt zuletzt als Aufschlag auf den Nettopreis.'], expl: 'Netto-Listenpreis + Umsatzsteuer = Bruttoverkaufspreis. Die USt rechnest du auf den Listenverkaufspreis (auf Hundert).' };
  });
  add('Angebot', 'Handel: vom Einkauf zum Bruttopreis', 3, (R, C) => {
    const mk = () => ({ b: bezP(R), hk: pick(R, [15, 20, 25, 30]), a: angP(R) });
    const calc = q => { const b = C.bezug(q.b), h = C.handelSk({ bzp: b.val.bzp, hk: q.hk }), a = C.angebot(Object.assign({}, q.a, { sk: h.val.sk })); return { b, h, a }; };
    const q = tries(mk, q => { const c = calc(q), cx = { b: C.bezug(exact(q.b)) }; const hx = C.handelSk({ bzp: cx.b.val.bzp, hk: q.hk, exact: true }), ax = C.angebot(Object.assign({}, q.a, { sk: hx.val.sk, exact: true })); return Math.abs(c.a.val.brutto - ax.val.brutto) < 0.0045; });
    const c = calc(q), head = t => ({ head: t });
    const rows = [head('1 Bezugskalkulation')].concat(c.b.rows, [head('2 Handlungskosten')], c.h.rows.slice(1), [head('3 Verkaufskalkulation')], c.a.rows.slice(1));
    const val = Object.assign({}, c.a.val);
    return { text: 'Ein Händler kauft ein: ' + bezTxt(C, q.b) + '. Handlungskostenzuschlag ' + q.hk + ' %, Gewinn ' + q.a.gew + ' %, Kundenskonto ' + q.a.sko + ' %, Provision ' + q.a.prov + ' %, Kundenrabatt ' + q.a.rab + ' %, Umsatzsteuer 19 %. Wie hoch ist der Bruttoverkaufspreis?', rows, ask: { key: 'brutto', label: 'Bruttoverkaufspreis', unit: '€', tol: 0.01, value: val.brutto }, tips: ['Drei Schritte: erst Bezugspreis, dann Selbstkosten (Bezugspreis + Handlungskosten), dann Verkaufsschema bis brutto.'], expl: 'Bezugspreis → Selbstkosten (Handel) → Barverkaufspreis → Zielverkaufspreis → Listenverkaufspreis → Bruttopreis.' };
  });

  /* ---------- Rückwärts / Differenz ---------- */
  const difP = R => { const lvp = ri(R, 500, 4000, 50); return { lvp, rab: pick(R, [10, 15, 20]), sko: pick(R, [2, 3]), prov: pick(R, [3, 4, 5]), sk: ri(R, Math.round(lvp * 0.55 / 10), Math.round(lvp * 0.95 / 10), 1) * 10 }; };
  add('Rückwärts/Differenz', 'Gewinn oder Verlust (Differenz)', 2, (R, C) => {
    const p = difP(R), res = C.differenz(p);
    return { text: 'Der Markt zahlt einen Listenverkaufspreis von ' + C.eur(p.lvp) + ' (netto). Rabatt ' + p.rab + ' %, Skonto ' + p.sko + ' %, Provision ' + p.prov + ' % (alle im Hundert). Die Selbstkosten betragen ' + C.eur(p.sk) + '. Berechne die Differenz zum Barverkaufspreis: Gewinn als positive, Verlust als negative Zahl.', rows: res.rows.slice(0, 8), ask: num(C, res, 'diff', 'Gewinn (+) / Verlust (−)', '€'), tips: ['Rechne vom Marktpreis rückwärts nach unten: erst Rabatt, dann Skonto und Provision vom Zielverkaufspreis abziehen. Das Ergebnis (Barverkaufspreis) minus Selbstkosten ist die Differenz.'], expl: 'Differenzkalkulation: Barverkaufspreis (aus dem Marktpreis) − Selbstkosten = Gewinn oder Verlust.' };
  });
  add('Rückwärts/Differenz', 'Differenz in Prozent', 3, (R, C) => {
    const p = difP(R), res = C.differenz(p);
    return { text: 'Marktpreis (Listenverkaufspreis netto) ' + C.eur(p.lvp) + ', Rabatt ' + p.rab + ' %, Skonto ' + p.sko + ' %, Provision ' + p.prov + ' % (alle im Hundert), Selbstkosten ' + C.eur(p.sk) + '. Wie viel Prozent der Selbstkosten sind Gewinn (positiv) oder Verlust (negativ)?', rows: res.rows, ask: num(C, res, 'pct', 'Gewinn/Verlust in % der Selbstkosten', '%'), tips: ['Erst die Differenz in Euro bestimmen. Dann: Differenz : Selbstkosten × 100.'], expl: 'Prozentsatz = Differenz : Selbstkosten × 100 (Bezugsgröße sind die Selbstkosten).' };
  });
  add('Rückwärts/Differenz', 'Höchste Selbstkosten', 2, (R, C) => {
    const mk = () => ({ art: 'netto', preis: ri(R, 500, 4000, 50), ust: 19, rab: pick(R, [10, 15, 20]), sko: pick(R, [2, 3]), prov: pick(R, [3, 4, 5]), gew: pick(R, [8, 10, 12, 15, 20]), hk: 0, bk: 0, lsko: 0, lrab: 0, bis: 'sk' });
    const p = tries(mk, neat(C.rueckwaerts, 'sk')), res = C.rueckwaerts(p);
    return { text: 'Der Markt zahlt netto ' + C.eur(p.preis) + ' (Listenverkaufspreis). Rabatt ' + p.rab + ' %, Skonto ' + p.sko + ' %, Provision ' + p.prov + ' % (im Hundert), gewünschter Gewinn ' + p.gew + ' % auf die Selbstkosten. Wie hoch dürfen die Selbstkosten höchstens sein?', rows: res.rows, ask: num(C, res, 'sk', 'Höchste Selbstkosten', '€'), tips: ['Von oben nach unten rechnen: Rabatt, Skonto, Provision abziehen (Prozente vom jeweiligen höheren Preis). Der Gewinn steckt als „auf Hundert“ in den Selbstkosten: BVP = (100 + Gewinn %) % der Selbstkosten.'], expl: 'Selbstkosten = Barverkaufspreis × 100 : (100 + Gewinnsatz).' };
  });
  add('Rückwärts/Differenz', 'Höchster Listeneinkaufspreis', 3, (R, C) => {
    const mk = () => ({ art: 'brutto', preis: ri(R, 300, 3000, 10), ust: 19, rab: pick(R, [10, 15, 20]), sko: pick(R, [2, 3]), prov: pick(R, [0, 3, 4]), gew: pick(R, [10, 15, 20, 25]), hk: pick(R, [15, 20, 25]), bk: ri(R, 10, 60, 5), lsko: pick(R, [2, 3]), lrab: pick(R, [10, 15, 20]), bis: 'lep' });
    const p = tries(mk, neat(C.rueckwaerts, 'lep')), res = C.rueckwaerts(p);
    return { text: 'Ein Händler kann ein Produkt zu einem Marktpreis von ' + C.eur(p.preis) + ' brutto (USt 19 %) verkaufen. Kundenrabatt ' + p.rab + ' %, Kundenskonto ' + p.sko + ' %, Provision ' + p.prov + ' %, Gewinn ' + p.gew + ' % auf die Selbstkosten, Handlungskosten ' + p.hk + ' % auf den Bezugspreis, Bezugskosten ' + C.eur(p.bk) + ', Liefererskonto ' + p.lsko + ' %, Liefererrabatt ' + p.lrab + ' %. Welchen Listeneinkaufspreis darf er höchstens zahlen?', rows: res.rows, ask: num(C, res, 'lep', 'Höchster Listeneinkaufspreis', '€'), tips: ['Das Verkaufsschema wird von unten nach oben „umgedreht“. Immer prüfen, ob der Satz auf Hundert (+ Prozent) oder im Hundert (− Prozent) wirkt.'], expl: 'Rückwärts: brutto → netto → ZVP → BVP → Selbstkosten → Bezugspreis → Bareinkaufspreis → Zieleinkaufspreis → Listeneinkaufspreis.' };
  });

  /* ---------- Spanne / Faktor ---------- */
  const spP = (R, zs) => { const z = pick(R, zs), bzp = ri(R, 8, 200, 4); return { z, bzp, vp: C_rd2(bzp * (1 + z / 100)) }; };
  const C_rd2 = v => Math.round(v * 100 + 1e-7) / 100;
  add('Spanne/Faktor', 'Kalkulationszuschlag', 1, (R, C) => {
    const p = spP(R, [25, 40, 50, 60, 80, 100, 125, 150]), res = C.spanne(p);
    return { text: 'Ein Artikel wird für ' + C.eur(p.bzp) + ' bezogen und für ' + C.eur(p.vp) + ' (netto) verkauft. Wie hoch ist der Kalkulationszuschlag in Prozent?', rows: res.rows.slice(0, 4), ask: num(C, res, 'z', 'Kalkulationszuschlag', '%'), tips: ['Kalkulationszuschlag = Aufschlag : Bezugspreis × 100. Der Bezugspreis ist die Bezugsgröße (100 %).'], expl: 'Aufschlag = Verkaufspreis − Bezugspreis; Zuschlag = Aufschlag : Bezugspreis × 100.' };
  });
  add('Spanne/Faktor', 'Handelsspanne', 2, (R, C) => {
    const p = spP(R, [25, 100, 150, 300]), res = C.spanne(p);
    return { text: 'Bezugspreis ' + C.eur(p.bzp) + ', Verkaufspreis (netto) ' + C.eur(p.vp) + '. Berechne die Handelsspanne in Prozent.', rows: res.rows.slice(0, 3).concat(res.rows.slice(4, 5)), ask: num(C, res, 's', 'Handelsspanne', '%'), tips: ['Handelsspanne = Aufschlag : Verkaufspreis × 100. Der Verkaufspreis ist die Bezugsgröße (100 %), deshalb ist die Spanne immer kleiner als der Zuschlag.'], expl: 'Handelsspanne = (Verkaufspreis − Bezugspreis) : Verkaufspreis × 100.' };
  });
  add('Spanne/Faktor', 'Kalkulationsfaktor', 2, (R, C) => {
    const p = spP(R, [25, 50, 60, 80, 100, 150]), res = C.spanne(p);
    return { text: 'Bezugspreis ' + C.eur(p.bzp) + ', Verkaufspreis (netto) ' + C.eur(p.vp) + '. Berechne den Kalkulationsfaktor (zwei Nachkommastellen reichen).', rows: res.rows.slice(0, 3).concat(res.rows.slice(5)), ask: num(C, res, 'f', 'Kalkulationsfaktor', ''), tips: ['Kalkulationsfaktor = Verkaufspreis : Bezugspreis. Mit dem Faktor multiplizierst du den Bezugspreis direkt zum Verkaufspreis.'], expl: 'Faktor = Verkaufspreis : Bezugspreis = 1 + Zuschlag : 100.' };
  });
  add('Spanne/Faktor', 'Spanne in Zuschlag umrechnen', 3, (R, C) => {
    const s = pick(R, [20, 50, 60, 75, 80]), res = C.spFrom({ g: 's', wert: s });
    return { text: 'Ein Betrieb kalkuliert mit einer Handelsspanne von ' + s + ' %. Welchem Kalkulationszuschlag (in Prozent) entspricht das?', rows: res.rows, ask: { key: 'z', label: 'Kalkulationszuschlag', unit: '%', tol: 0.1, value: res.val.z }, tips: ['Bei der Spanne sind 100 % der Verkaufspreis, der Bezugspreis ist dann (100 − Spanne) %. Der Aufschlag ist Spanne %. Zuschlag = Spanne : (100 − Spanne) × 100.'], expl: 'Zuschlag = Spanne : (100 − Spanne) × 100.' };
  });
  add('Spanne/Faktor', 'Zuschlag oder Faktor in Spanne', 3, (R, C) => {
    const byF = R() < 0.5, z = pick(R, [25, 100, 150, 300, 400]), f = 1 + z / 100, res = C.spFrom({ g: byF ? 'f' : 'z', wert: byF ? f : z });
    return { text: byF ? 'Der Kalkulationsfaktor beträgt ' + C.fmtDe(f, 2) + '. Welche Handelsspanne in Prozent ergibt sich?' : 'Der Kalkulationszuschlag beträgt ' + z + ' %. Welche Handelsspanne in Prozent ergibt sich?', rows: res.rows, ask: { key: 's', label: 'Handelsspanne', unit: '%', tol: 0.1, value: res.val.s }, tips: ['Mit Zuschlag z gilt: Bezugspreis = 100, Verkaufspreis = 100 + z. Die Spanne ist der Aufschlag in Prozent des Verkaufspreises: z : (100 + z) × 100. Ein Faktor f ist 1 + z : 100.'], expl: 'Spanne = Zuschlag : (100 + Zuschlag) × 100 = (Faktor − 1) : Faktor × 100.' };
  });

  /* ---------- Deckungsbeitrag ---------- */
  const dbP = R => { const p = ri(R, 20, 120, 5), kv = Math.round(p * pick(R, [0.4, 0.5, 0.6, 0.7]) * 2) / 2, dbs = p - kv, N = ri(R, 200, 2000, 100); return { p, kv, kfix: dbs * N, N }; };
  const dbTxt = (C, q) => 'Verkaufspreis ' + C.eur(q.p) + ' je Stück, variable Stückkosten ' + C.eur(q.kv) + ', Fixkosten ' + C.eur(q.kfix) + ' je Periode';
  add('Deckungsbeitrag', 'Stückdeckungsbeitrag', 1, (R, C) => {
    const q = dbP(R), res = C.db({ p: q.p, kv: q.kv, kfix: q.kfix, x: q.N });
    return { text: 'Verkaufspreis ' + C.eur(q.p) + ' je Stück, variable Stückkosten ' + C.eur(q.kv) + '. Wie hoch ist der Stückdeckungsbeitrag?', rows: res.rows.slice(0, 1), ask: num(C, res, 'dbs', 'Stückdeckungsbeitrag', '€'), tips: ['Der Stückdeckungsbeitrag ist der Teil des Preises, der nach den variablen Kosten übrig bleibt, um die Fixkosten zu decken.'], expl: 'db = Preis − variable Stückkosten.' };
  });
  add('Deckungsbeitrag', 'Break-even-Menge', 2, (R, C) => {
    const q = dbP(R), res = C.db({ p: q.p, kv: q.kv, kfix: q.kfix, x: q.N });
    return { text: dbTxt(C, q) + '. Bei welcher Absatzmenge (Stück) wird die Gewinnschwelle erreicht?', rows: res.rows.slice(0, 1).concat(res.rows.filter(r => r.k === 'bepM')), ask: num(C, res, 'bepM', 'Break-even-Menge', 'Stück'), tips: ['Gewinnschwelle: Der Gesamtdeckungsbeitrag deckt genau die Fixkosten. Menge = Fixkosten : Stückdeckungsbeitrag.'], expl: 'Break-even-Menge = Fixkosten : Stückdeckungsbeitrag.' };
  });
  add('Deckungsbeitrag', 'Gewinn bei Menge x', 2, (R, C) => {
    const q = dbP(R), x = Math.max(50, q.N + pick(R, [-300, -150, 150, 300, 500])), res = C.db({ p: q.p, kv: q.kv, kfix: q.kfix, x });
    return { text: dbTxt(C, q) + '. Es werden ' + C.fmtDe(x, 0) + ' Stück abgesetzt. Wie hoch ist der Gewinn? Einen Verlust gibst du als negative Zahl an.', rows: res.rows.slice(0, 4), ask: num(C, res, 'gewinn', 'Gewinn (+) / Verlust (−)', '€'), tips: ['Gewinn = Gesamtdeckungsbeitrag − Fixkosten. Gesamtdeckungsbeitrag = Stückdeckungsbeitrag × Menge.'], expl: 'Gewinn = db × Menge − Fixkosten (Verlust, wenn das Ergebnis negativ ist).' };
  });
  add('Deckungsbeitrag', 'Break-even-Umsatz', 3, (R, C) => {
    const q = dbP(R), res = C.db({ p: q.p, kv: q.kv, kfix: q.kfix, x: q.N });
    return { text: dbTxt(C, q) + '. Bei welchem Umsatz liegt die Gewinnschwelle?', rows: res.rows.filter(r => r.k === 'dbs' || r.k === 'bepM' || r.k === 'bepU'), ask: num(C, res, 'bepU', 'Break-even-Umsatz', '€'), tips: ['Erst die Break-even-Menge, dann Menge × Verkaufspreis.'], expl: 'Break-even-Umsatz = Break-even-Menge × Verkaufspreis.' };
  });
  add('Deckungsbeitrag', 'Kurzfristige Preisuntergrenze', 3, (R, C) => {
    const m = ri(R, 8, 40, 2), l = ri(R, 6, 30, 2), g = ri(R, 2, 10, 1), kv = m + l + g, kfix = ri(R, 5000, 30000, 1000), x = ri(R, 500, 2000, 100), res = C.db({ p: kv + 3, kv, kfix, x });
    res.rows = [{ k: 'puk', label: 'Preisuntergrenze kurzfristig', op: '', v: kv, u: '€', sum: true, calc: C.eur(m) + ' + ' + C.eur(l) + ' + ' + C.eur(g) }];
    return { text: 'Ein Betrieb ist nicht ausgelastet und prüft einen Zusatzauftrag. Je Stück fallen an: Material ' + C.eur(m) + ', Fertigungslohn ' + C.eur(l) + ', variable Gemeinkosten ' + C.eur(g) + '. Die Fixkosten (' + C.eur(kfix) + ') fallen ohnehin an. Welchen Preis je Stück muss der Auftrag kurzfristig mindestens bringen?', rows: res.rows, ask: { key: 'puk', label: 'Kurzfristige Preisuntergrenze', unit: '€', tol: 0.01, value: kv }, tips: ['Kurzfristig zählen nur die Kosten, die der Zusatzauftrag wirklich auslöst: die variablen Stückkosten. Fixkosten sind schon da.'], expl: 'Kurzfristige Preisuntergrenze = variable Stückkosten (Deckungsbeitrag ≥ 0). Langfristig müsste der Preis auch die Fixkosten decken.' };
  });

  /* ---------- Erweiterung (kal29 bis kal36): kleine Einzelschritte und Zusatzaufgaben ---------- */
  add('Bezug', 'Zieleinkaufspreis', 1, (R, C) => {
    const p = { lep: ri(R, 200, 3000, 10), rab: pick(R, [5, 10, 12, 15, 20, 25]), sko: 0, bk: 0 }, res = C.bezug(p);
    return { text: 'Ein Lieferer berechnet für eine Warenlieferung ' + C.eur(p.lep) + ' (Listeneinkaufspreis) und gewährt ' + p.rab + ' % Rabatt. Wie hoch ist der Zieleinkaufspreis?', rows: res.rows.slice(0, 3), ask: num(C, res, 'zep', 'Zieleinkaufspreis', '€'), tips: ['Der Rabatt wird vom Listeneinkaufspreis berechnet und abgezogen. Was übrig bleibt, ist der Zieleinkaufspreis.'], expl: 'Rabatt = Listeneinkaufspreis × Prozentsatz : 100; Zieleinkaufspreis = Listeneinkaufspreis − Rabatt.' };
  });
  add('Bezug', 'Skontobetrag berechnen', 2, (R, C) => {
    const p = { lep: ri(R, 300, 3000, 10), rab: pick(R, [10, 15, 20, 25]), sko: pick(R, [2, 3]), bk: 0 }, res = C.bezug(p);
    return { text: 'Eine Rechnung lautet auf ' + C.eur(p.lep) + ' (Listeneinkaufspreis) abzüglich ' + p.rab + ' % Liefererrabatt. Bei Zahlung innerhalb der Skontofrist dürfen ' + p.sko + ' % Skonto abgezogen werden. Wie viel Euro Skonto sind das?', rows: res.rows.slice(0, 4), ask: num(C, res, 'sko', 'Skontobetrag', '€'), tips: ['Das Skonto gilt für den Rechnungsbetrag nach Rabatt (Zieleinkaufspreis), nicht für den Listenpreis.'], expl: 'Erst den Zieleinkaufspreis bestimmen, dann Skonto = Zieleinkaufspreis × Skontosatz : 100.' };
  });
  add('Selbstkosten', 'Fertigungskosten', 2, (R, C) => {
    const p = skP(R), res = C.selbstkosten(p);
    return { text: 'Fertigungslöhne ' + C.eur(p.fl) + ', Fertigungsgemeinkosten-Zuschlag ' + p.fgk + ' % (auf die Fertigungslöhne). Wie hoch sind die Fertigungskosten?', rows: res.rows.slice(3, 6), ask: num(C, res, 'fk', 'Fertigungskosten', '€'), tips: ['Fertigungskosten sind Fertigungslöhne plus Fertigungsgemeinkosten. Der Zuschlagssatz bezieht sich auf die Fertigungslöhne.'], expl: 'FGK = Fertigungslöhne × Zuschlagssatz : 100; Fertigungskosten = Fertigungslöhne + FGK.' };
  });
  add('Selbstkosten', 'Selbstkosten je Stück', 3, (R, C) => {
    const p = skP(R), res = C.selbstkosten(p), n = pick(R, [50, 100, 200, 250, 400, 500]), st = C.rd2(res.val.sk / n);
    res.rows.push({ k: 'stk', label: 'Selbstkosten je Stück', op: '', v: st, u: '€', sum: true, calc: C.eur(res.val.sk) + ' : ' + C.fmtDe(n, 0) + ' Stück' });
    return { text: 'Ein Auftrag über ' + C.fmtDe(n, 0) + ' Stück wird kalkuliert: ' + skTxt(C, p) + '. Wie hoch sind die Selbstkosten je Stück (auf Cent gerundet)?', rows: res.rows, ask: num(C, { val: { stk: st } }, 'stk', 'Selbstkosten je Stück', '€'), tips: [TIP_SK + ' Rechne das ganze Schema für den Auftrag und teile erst zum Schluss durch die Stückzahl.'], expl: 'Selbstkosten des Auftrags : Stückzahl = Selbstkosten je Stück. Nur das Endergebnis wird gerundet.' };
  });
  add('Angebot', 'Bruttopreis aus Nettopreis', 1, (R, C) => {
    const ust = pick(R, [19, 7]), net = ri(R, 100, 2000, 10), u = C.rd2(net * ust / 100), br = C.rd2(net + u);
    const rows = [{ k: 'lvp', label: 'Listenverkaufspreis (netto)', op: '', v: net, u: '€' }, { k: 'ust', label: 'Umsatzsteuer', op: '+', v: u, u: '€', pct: ust, bas: 'auf den Nettopreis (auf Hundert)', calc: C.eur(net) + ' × ' + ust + ' % : 100' }, { k: 'brutto', label: 'Bruttoverkaufspreis', op: '=', v: br, u: '€', sum: true, calc: C.eur(net) + ' + ' + C.eur(u) }];
    return { text: 'Ein ' + (ust === 7 ? 'Fachbuch (ermäßigter Satz 7 %)' : 'Gerät (Regelsatz 19 %)') + ' kostet netto ' + C.eur(net) + '. Wie hoch ist der Bruttoverkaufspreis mit Umsatzsteuer?', rows, ask: { key: 'brutto', label: 'Bruttoverkaufspreis', unit: '€', tol: 0.01, value: br }, tips: ['Die Umsatzsteuer wird auf den Nettopreis aufgeschlagen: Netto × Steuersatz : 100. Danach addierst du sie zum Nettopreis.'], expl: 'Brutto = Netto + Umsatzsteuer, kurz Netto × (1 + Steuersatz : 100).' };
  });
  add('Angebot', 'Gewinnzuschlag in Prozent', 2, (R, C) => {
    const sk = ri(R, 100, 3000, 50), g = pick(R, [8, 10, 12, 15, 20, 25]), gw = C.rd2(sk * g / 100), bvp = C.rd2(sk + gw);
    const rows = [{ k: 'sk', label: 'Selbstkosten', op: '', v: sk, u: '€' }, { k: 'gew', label: 'Gewinn', op: '+', v: gw, u: '€', calc: C.eur(bvp) + ' − ' + C.eur(sk) }, { k: 'bvp', label: 'Barverkaufspreis', op: '=', v: bvp, u: '€', sum: true }, { k: 'satz', label: 'Gewinnzuschlag', op: '', v: g, u: '%', calc: C.eur(gw) + ' : ' + C.eur(sk) + ' × 100', bas: 'Gewinn in % der Selbstkosten' }];
    return { text: 'Die Selbstkosten eines Auftrags betragen ' + C.eur(sk) + '. Der Barverkaufspreis soll ' + C.eur(bvp) + ' betragen. Mit wie viel Prozent Gewinnzuschlag auf die Selbstkosten ist kalkuliert?', rows, ask: { key: 'satz', label: 'Gewinnzuschlag', unit: '%', tol: 0.1, value: g }, tips: ['Gewinn = Barverkaufspreis − Selbstkosten. Der Gewinnzuschlag bezieht sich auf die Selbstkosten (100 %).'], expl: 'Gewinnzuschlag = (Barverkaufspreis − Selbstkosten) : Selbstkosten × 100.' };
  });
  add('Spanne/Faktor', 'Verkaufspreis mit Kalkulationsfaktor', 2, (R, C) => {
    const f = pick(R, [1.25, 1.5, 1.6, 2, 2.5]), bzp = ri(R, 8, 200, 4), res = C.spFrom({ g: 'f', wert: f, bzp });
    return { text: 'Ein Händler kalkuliert mit dem Kalkulationsfaktor ' + C.fmtDe(f, 2) + '. Der Bezugspreis eines Artikels beträgt ' + C.eur(bzp) + '. Zu welchem Verkaufspreis (netto) wird der Artikel angeboten?', rows: res.rows, ask: num(C, res, 'vp', 'Verkaufspreis (netto)', '€'), tips: ['Mit dem Kalkulationsfaktor multiplizierst du den Bezugspreis direkt zum Verkaufspreis. Er fasst Handlungskosten und Gewinn zusammen.'], expl: 'Verkaufspreis = Bezugspreis × Kalkulationsfaktor.' };
  });
  add('Deckungsbeitrag', 'Absatzmenge für Zielgewinn', 3, (R, C) => {
    const q = dbP(R), e = ri(R, 100, 500, 50), dbs = q.p - q.kv, g = dbs * e, N = q.N + e;
    const rows = [{ k: 'dbs', label: 'Stückdeckungsbeitrag db', op: '', v: dbs, u: '€', calc: C.eur(q.p) + ' − ' + C.eur(q.kv) }, { k: 'need', label: 'Nötiger Gesamtdeckungsbeitrag', op: '', v: q.kfix + g, u: '€', calc: C.eur(q.kfix) + ' + ' + C.eur(g) }, { k: 'menge', label: 'Absatzmenge', op: '', v: N, u: 'Stück', sum: true, calc: C.eur(q.kfix + g) + ' : ' + C.eur(dbs) }];
    return { text: dbTxt(C, q) + '. Der Betrieb will einen Gewinn von ' + C.eur(g) + ' erzielen. Wie viele Stück muss er dafür absetzen?', rows, ask: { key: 'menge', label: 'Absatzmenge', unit: 'Stück', tol: 0.01, value: N }, tips: ['Der Gesamtdeckungsbeitrag muss die Fixkosten und zusätzlich den Zielgewinn decken. Teile diese Summe durch den Stückdeckungsbeitrag.'], expl: 'Menge = (Fixkosten + Zielgewinn) : Stückdeckungsbeitrag.' };
  });

  /* ---------- Qualität und Projekt (kal37 bis kal41, Berufsschulstoff 4. Lehrjahr: Qualitätskosten, Pareto, Projektkosten, magisches Dreieck) ----------
     Gliederung der Qualitätskosten nach der Mitschrift: Fehlerverhütung (Qualitätsplanung, Schulung, Lieferantenbewertung), Prüfkosten (Wareneingangs- und Endprüfung),
     Fehlerkosten intern (Ausschuss, Nacharbeit) und extern (Gewährleistung, Kulanz). Alle Beträge sind frei gewählte Übungswerte. */
  const qkP = R => ({ sch: ri(R, 800, 3000, 50), lief: ri(R, 300, 1500, 50), we: ri(R, 1000, 4000, 100), end: ri(R, 2000, 6000, 100), aus: ri(R, 1500, 8000, 100), na: ri(R, 1000, 5000, 100), gew: ri(R, 2000, 9000, 100) });
  const qkPosten = (C, v) => [['Schulung zur Fehlervermeidung', v.sch], ['Ausschuss in der Fertigung', v.aus], ['Wareneingangsprüfung', v.we], ['Gewährleistung beim Kunden', v.gew], ['Lieferantenbewertung', v.lief], ['Nacharbeit', v.na], ['Endprüfung', v.end]].map(x => x[0] + ' ' + C.eur(x[1])).join(', ');
  const qkRows = (C, v) => {
    const vk = C.rd2(v.sch + v.lief), pk = C.rd2(v.we + v.end), fk = C.rd2(v.aus + v.na + v.gew), qk = C.rd2(vk + pk + fk);
    return { vk, pk, fk, qk, rows: [{ k: 'vk', label: 'Fehlerverhütungskosten', op: '', v: vk, u: '€', calc: C.eur(v.sch) + ' + ' + C.eur(v.lief) }, { k: 'pk', label: 'Prüfkosten', op: '+', v: pk, u: '€', calc: C.eur(v.we) + ' + ' + C.eur(v.end) }, { k: 'fk', label: 'Fehlerkosten (intern und extern)', op: '+', v: fk, u: '€', calc: C.eur(v.aus) + ' + ' + C.eur(v.na) + ' + ' + C.eur(v.gew) }, { k: 'qk', label: 'Qualitätskosten gesamt', op: '=', v: qk, u: '€', sum: true, calc: C.eur(vk) + ' + ' + C.eur(pk) + ' + ' + C.eur(fk) }] };
  };
  const TIP_QK = 'Fehlerverhütung: alles, was Fehler gar nicht erst entstehen lässt (Schulung, Lieferantenbewertung). Prüfkosten: alles Prüfen (Wareneingang, Endprüfung). Fehlerkosten: was ein entstandener Fehler kostet, im Betrieb (Ausschuss, Nacharbeit) oder beim Kunden (Gewährleistung).';
  add('Qualität und Projekt', 'Qualitätskosten gliedern', 2, (R, C) => {
    const v = qkP(R), q = qkRows(C, v);
    return { text: 'Ein Elektronikbetrieb hat im Quartal folgende Kosten rund um die Qualität erfasst: ' + qkPosten(C, v) + '. Fasse sie zu den drei Gruppen der Qualitätskosten zusammen und bilde die Summe.', rows: q.rows, fill: ['vk', 'pk', 'fk', 'qk'], tips: [TIP_QK], expl: 'Qualitätskosten = Fehlerverhütungskosten + Prüfkosten + Fehlerkosten. Geld für die Verhütung lohnt sich oft, weil es Fehlerkosten an anderer Stelle spart.' };
  });
  add('Qualität und Projekt', 'Anteil an den Qualitätskosten', 3, (R, C) => {
    const v = qkP(R), q = qkRows(C, v), ant = C.rd2(q.fk / q.qk * 100);
    const rows = q.rows.concat([{ k: 'ant', label: 'Anteil der Fehlerkosten', op: '', v: ant, u: '%', sum: true, calc: C.eur(q.fk) + ' : ' + C.eur(q.qk) + ' × 100', bas: 'in % der Qualitätskosten' }]);
    return { text: 'Kosten rund um die Qualität im letzten Quartal: ' + qkPosten(C, v) + '. Wie viel Prozent der gesamten Qualitätskosten sind Fehlerkosten (intern und extern zusammen)?', rows, ask: { key: 'ant', label: 'Anteil der Fehlerkosten', unit: '%', tol: 0.1, value: ant }, tips: [TIP_QK + ' Erst alle Qualitätskosten addieren, dann den Anteil der Fehlerkosten daran berechnen.'], expl: 'Anteil = Fehlerkosten : Qualitätskosten × 100. Ein hoher Anteil zeigt: Es wird zu wenig in Verhütung investiert.' };
  });
  /* Pareto: Anteil der zwei häufigsten Ursachen an allen Ausfällen */
  const URS = ['Steckverbinder locker', 'Kalte Lötstelle', 'Bauteil defekt', 'Bedienfehler', 'Feuchtigkeit im Gehäuse'];
  add('Qualität und Projekt', 'Die wichtigsten Ursachen', 2, (R, C) => {
    const p = tries(() => URS.map(() => ri(R, 3, 60)), a => new Set(a).size === a.length && a.reduce((x, y) => x + y, 0) >= 80), sum = p.reduce((x, y) => x + y, 0);
    const srt = URS.map((u, i) => [u, p[i]]).sort((a, b) => b[1] - a[1]), two = srt[0][1] + srt[1][1], ant = C.rd2(two / sum * 100);
    const rows = [{ k: 'sum', label: 'Ausfälle insgesamt', op: '', v: sum, u: 'Stück', calc: p.join(' + ') }, { k: 'two', label: 'Zwei häufigste Ursachen (' + srt[0][0] + ', ' + srt[1][0] + ')', op: '', v: two, u: 'Stück', calc: srt[0][1] + ' + ' + srt[1][1] }, { k: 'ant', label: 'Anteil der zwei häufigsten Ursachen', op: '', v: ant, u: '%', sum: true, calc: two + ' : ' + sum + ' × 100' }];
    return { text: 'Eine Fehlersammelliste zu den Ausfällen einer Steuerung zeigt nach drei Monaten: ' + URS.map((u, i) => u + ' ' + p[i] + '-mal').join(', ') + '. Für ein Pareto-Diagramm werden die Ursachen nach Häufigkeit sortiert. Wie viel Prozent aller Ausfälle gehen auf die zwei häufigsten Ursachen zurück?', rows, ask: { key: 'ant', label: 'Anteil der zwei häufigsten Ursachen', unit: '%', tol: 0.1, value: ant }, tips: ['Sortiere die Ursachen absteigend nach ihrer Anzahl. Addiere die zwei obersten und teile durch die Summe aller Ausfälle.'], expl: 'Im Pareto-Diagramm stehen die häufigsten Ursachen links. Sie zuerst zu beheben bringt die größte Wirkung. Anteil = (erste + zweite Ursache) : alle Ausfälle × 100.' };
  });
  add('Qualität und Projekt', 'Kosten eines Projekts', 1, (R, C) => {
    const h = ri(R, 40, 120, 4), satz = pick(R, [42, 45, 48, 52, 55]), mat = ri(R, 150, 900, 10), zus = pick(R, [5, 10, 15]), pers = C.rd2(h * satz), su = C.rd2(pers + mat), z = C.rd2(su * zus / 100), tot = C.rd2(su + z);
    const rows = [{ k: 'pers', label: 'Personalkosten', op: '', v: pers, u: '€', calc: h + ' h × ' + C.eur(satz) }, { k: 'mat', label: 'Material', op: '+', v: mat, u: '€' }, { k: 'su', label: 'Zwischensumme', op: '=', v: su, u: '€', calc: C.eur(pers) + ' + ' + C.eur(mat) }, { k: 'z', label: 'Zuschlag für Unvorhergesehenes', op: '+', v: z, u: '€', pct: zus, bas: 'auf die Zwischensumme', calc: C.eur(su) + ' × ' + zus + ' % : 100' }, { k: 'tot', label: 'Geplante Projektkosten', op: '=', v: tot, u: '€', sum: true, calc: C.eur(su) + ' + ' + C.eur(z) }];
    return { text: 'Für den Umbau einer Prüfvorrichtung werden ' + h + ' Arbeitsstunden zu je ' + C.eur(satz) + ' und Material für ' + C.eur(mat) + ' geplant. Auf die Summe kommt ein Zuschlag von ' + zus + ' % für Unvorhergesehenes. Wie hoch sind die geplanten Projektkosten?', rows, ask: { key: 'tot', label: 'Geplante Projektkosten', unit: '€', tol: 0.01, value: tot }, tips: ['Erst die Personalkosten (Stunden × Stundensatz), dann das Material dazu, zuletzt den Zuschlag auf diese Summe.'], expl: 'Projektkosten = (Stunden × Stundensatz + Material) × (1 + Zuschlag : 100). Der Zuschlag ist ein Puffer für Risiken, die bei der Planung noch nicht bekannt sind.' };
  });
  add('Qualität und Projekt', 'Preis für den früheren Termin', 2, (R, C) => {
    const n = ri(R, 2, 4), uh = ri(R, 6, 16), satz = pick(R, [40, 44, 48, 52]), zp = pick(R, [25, 30, 50]), std = n * uh, zs = C.rd2(satz * zp / 100), mk = C.rd2(std * zs);
    const rows = [{ k: 'std', label: 'Überstunden insgesamt (Stunden)', op: '', v: std, u: 'h', dec: 0, calc: n + ' × ' + uh + ' h' }, { k: 'zs', label: 'Zuschlag je Stunde', op: '', v: zs, u: '€', calc: C.eur(satz) + ' × ' + zp + ' % : 100' }, { k: 'mk', label: 'Mehrkosten durch Zuschläge', op: '', v: mk, u: '€', sum: true, calc: std + ' h × ' + C.eur(zs) }];
    return { text: 'Ein Kunde möchte seine Anlage eine Woche früher haben, der Leistungsumfang bleibt gleich. Dafür leisten ' + n + ' Beschäftigte je ' + uh + ' Überstunden. Der Stundensatz beträgt ' + C.eur(satz) + ', für Überstunden kommt ein Zuschlag von ' + zp + ' % hinzu. Die Arbeitsstunden selbst sind schon im Budget eingeplant. Um wie viel Euro steigen die Projektkosten durch die Zuschläge?', rows, ask: { key: 'mk', label: 'Mehrkosten durch Zuschläge', unit: '€', tol: 0.01, value: mk }, tips: ['Gezahlt werden zusätzlich nur die Zuschläge. Rechne alle Überstunden zusammen und dann den Zuschlag je Stunde.'], expl: 'Das ist das magische Dreieck in Zahlen: Termin früher bei gleicher Leistung heißt höhere Kosten. Mehrkosten = Personen × Überstunden × Stundensatz × Zuschlag : 100.' };
  });

  /* ---------- Beispiele (fertig durchgerechnet, werden im Rechner geladen) ---------- */
  const examples = [
    { id: 'b1', mode: 'bezug', title: 'Bezugskalkulation Rohstoff', text: 'Ein Betrieb bestellt Rohmaterial zum Listenpreis von 2.400,00 €. Der Lieferer gewährt 15 % Rabatt und 2 % Skonto; Fracht und Verpackung kosten 120,00 €. Wie hoch ist der Bezugspreis?', params: { lep: '2400', rab: '15', sko: '2', bk: '120' }, key: ['bzp', 2119.2], note: 'Skonto wird vom Zieleinkaufspreis (nach Rabatt) berechnet, die Bezugskosten kommen erst nach dem Skonto dazu.' },
    { id: 'b2', mode: 'sk', title: 'Selbstkosten eines Auftrags (Industrie)', text: 'Materialeinzelkosten 4.000,00 € (MGK 20 %), Fertigungslöhne 3.000,00 € (FGK 180 %), Verwaltungsgemeinkosten 8 % und Vertriebsgemeinkosten 4 % auf die Herstellkosten.', params: { mek: '4000', mgk: '20', fl: '3000', fgk: '180', vwgk: '8', vtgk: '4' }, key: ['sk', 14784], note: 'Verwaltungs- und Vertriebsgemeinkosten beziehen sich auf die Herstellkosten, nicht auf die Selbstkosten.' },
    { id: 'b3', mode: 'ang', title: 'Angebot vorwärts (Industrie, 19 % USt)', text: 'Selbstkosten 14.784,00 €. Gewinn 10 %, Kundenskonto 2 %, Provision 8 %, Kundenrabatt 10 %, Umsatzsteuer 19 %. Wie hoch ist der Bruttoverkaufspreis?', params: { src: 'sk', sk: '14784', gew: '10', sko: '2', prov: '8', rab: '10', ust: '19' }, key: ['brutto', 23891.67], note: 'Skonto, Provision und Rabatt sind „im Hundert“: ZVP = BVP × 100 : 90 und LVP = ZVP × 100 : 90.' },
    { id: 'b4', mode: 'ang', title: 'Angebot im Handel (Buch, 7 % USt)', text: 'Ein Buchhändler bezieht ein Fachbuch zu 12,00 € Bezugspreis. Handlungskosten 25 %, Gewinn 20 %, Skonto 3 %, Provision 7 %, Rabatt 20 %, Umsatzsteuer 7 %.', params: { src: 'handel', bzp: '12', hk: '25', gew: '20', sko: '3', prov: '7', rab: '20', ust: '7' }, key: ['brutto', 26.75], note: 'Bücher unterliegen dem ermäßigten Satz von 7 %. Für den Händler bleibt die USt nur ein durchlaufender Posten.' },
    { id: 'b5', mode: 'rueck', title: 'Rückwärtskalkulation: höchster Einkaufspreis', text: 'Der Markt zahlt 595,00 € brutto. Rabatt 10 %, Skonto 2 %, Provision 3 %, Gewinn 25 %, Handlungskosten 20 %, Bezugskosten 40,00 €, Liefererskonto 2 %, Liefererrabatt 20 %. Welchen Listeneinkaufspreis darf der Händler höchstens zahlen?', params: { art: 'brutto', preis: '595', ust: '19', rab: '10', sko: '2', prov: '3', gew: '25', hk: '20', bk: '40', lsko: '2', lrab: '20' }, key: ['lep', 312.5], note: 'Jeder Satz wird in der Richtung umgekehrt: „auf Hundert“ heißt durch (100 + %), „im Hundert“ heißt durch (100 − %).' },
    { id: 'b6', mode: 'diff', title: 'Differenzkalkulation: Verlust', text: 'Marktpreis 1.000,00 € netto, Rabatt 20 %, Skonto 2 %, Provision 4 %. Die Selbstkosten liegen bei 800,00 €. Gewinn oder Verlust?', params: { lvp: '1000', rab: '20', sko: '2', prov: '4', sk: '800' }, key: ['diff', -48], note: 'Der Barverkaufspreis (752,00 €) liegt unter den Selbstkosten: Verlust von 48,00 € = 6 % der Selbstkosten.' },
    { id: 'b7', mode: 'sp', title: 'Handelsspanne, Zuschlag und Faktor', text: 'Bezugspreis 8,00 €, Verkaufspreis 12,00 € netto.', params: { g: 'pp', bzp: '8', vp: '12', wert: '50' }, key: ['s', 33.3333333333], note: 'Zuschlag 50 % (vom Einkauf), Spanne 33,33 % (vom Verkauf), Faktor 1,5. Spanne und Zuschlag unterscheiden sich durch die Bezugsgröße.' },
    { id: 'b8', mode: 'db', title: 'Break-even und Gewinn', text: 'Preis 25,00 € je Stück, variable Stückkosten 15,00 €, Fixkosten 12.000,00 €. Gewinnschwelle? Gewinn bei 1.500 Stück?', params: { p: '25', kv: '15', kfix: '12000', x: '1500' }, key: ['bepM', 1200], note: 'Stückdeckungsbeitrag 10,00 €: Ab 1.200 Stück (30.000,00 € Umsatz) beginnt der Gewinn; bei 1.500 Stück sind es 3.000,00 €.' }
  ];

  root.KAL_DATA = { tasks, examples, CATS };
  root.KAL_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.KAL_DATA, TASKS: root.KAL_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
