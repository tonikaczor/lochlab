/* verbunddata-kalk.js - Verbundprojekt "Auftrag kalkulieren und abrechnen" (Kennung kalk, Präfix vc, Beruf ik = Industriekaufleute)
 * Hub-Projekt: alle Stationen sind Hub-Stationen (on 'vb', Typ vb.form), keine Kerne, kein Adapter. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund; ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE. In Node liefert module.exports die Definition.
 *
 * ---------- Für die Integration ----------
 * Startseite/Suche (ein Satz): "Von der Kundenanfrage bis zum Gewinn: Du vergleichst Lieferer, kalkulierst den Preis, buchst, mahnst und wertest den Auftrag aus."
 * Berufskürzel: ['ik'] (Industriekaufleute), order 10, Präfix vc, Kennung kalk, Symbol 🧾.
 * Abzeichen-Vorschlag (badges.js, Kennung vbkalk): Symbol 🧾, Name "Auftrag abgerechnet", Text "Ein Kundenauftrag von der Anfrage bis zur Auswertung kalkuliert, gebucht und abgerechnet."
 * Verwendete Lab-Aufgaben (alle in AUFGABEN geprüft): vc1 rec1 rec26 | vc2 kal3 kal4 | vc3 rec3 rec20 | vc4 kal7 kal13 | vc5 kal25 kal26 | vc6 buc21 buc15 | vc7 rec24 rec11 | vc8 kal15 kal16.
 *
 * ---------- Rechenwege (wie in den Labs kal, buc, rec; jedes Zwischenergebnis wird kaufmännisch auf ganze Cent gerundet, 0,005 wird aufgerundet) ----------
 * Bezug (kal3): Listeneinkaufspreis = Stückpreis · Menge; − Rabatt (vom Listenpreis) = Zieleinkaufspreis; − Skonto (vom Zieleinkaufspreis) = Bareinkaufspreis; + Bezugskosten = Bezugspreis.
 *   Beispiel: 104 Stück zu 30,00 €, 8 % Rabatt, 3 % Skonto, 150 € Fracht: 3.120,00 − 249,60 = 2.870,40; − 86,11 = 2.784,29; + 150,00 = 2.934,29 €.
 * Zuschlagskalkulation (kal7, kal13): MK = MEK + MGK (% auf MEK); FK = FL + FGK (% auf FL); HK = MK + FK; SK = HK + VwGK + VtGK (% auf HK); BVP = SK + Gewinn (% auf SK, auf Hundert);
 *   ZVP = BVP · 100 : (100 − Kundenskonto); LVP = ZVP · 100 : (100 − Kundenrabatt) (Skonto und Rabatt im Hundert); Brutto = LVP + 19 % USt.
 *   Beispiel: MEK 2.914,91, FL 1.000,00, MGK 8 %, FGK 120 %, VwGK 12 %, VtGK 4 %, Gewinn 12 %, Skonto 3 %, Rabatt 5 %:
 *   MGK 233,19 → MK 3.148,10; FGK 1.200,00 → FK 2.200,00; HK 5.348,10; VwGK 641,77; VtGK 213,92; SK 6.203,79; Gewinn 744,45; BVP 6.948,24; ZVP 7.163,13; LVP 7.540,14; USt 1.432,63; Brutto 8.972,77 €.
 * Deckungsbeitrag (kal25, kal26): db = Preis − kv (je Stück, auf Cent); Break-even = Fixkosten : db (aufrunden); Gewinn = db · Menge − Fixkosten.
 * Buchung (buc21, buc15): Skonto auf die Bruttorechnung, Skontobetrag brutto = Brutto · % : 100, darin Umsatzsteuer (Brutto-Skonto · 19 : 119) als Berichtigung, Rest = Nettoskonto.
 * Verzug (rec24, rec11): Z = K · p · t : (100 · 360), t = tatsächliche Tage vom Ende der 30-Tage-Frist bis zum Zahlungstag (Zugangstag zählt nicht). Beispiel: 4.000 € zugegangen 10.03.2025,
 *   bezahlt 20.05.2025, 11 %: Fristende 09.04.2025, t = 41, Z = 4.000 · 11 · 41 : 36.000 = 50,11 €.
 *
 * ---------- Annahmen (A) und zur fachlichen Freigabe ----------
 * (A) Kontenplan: Die Buchungssätze nennen KONTENNAMEN OHNE NUMMERN (Entscheidung IKR gegen Betriebskontenplan ist offen). Die Namen entsprechen der Übungsliste im Buchführungs-Lab (buc):
 *     Aufwendungen für Rohstoffe, Vorsteuer, Verbindlichkeiten aus L. u. L., Bank, Nachlässe, Forderungen aus L. u. L., Umsatzerlöse für Erzeugnisse, Umsatzsteuer.
 *     NEU, im Lab nicht enthalten: Zinserträge, Sonstige betriebliche Erträge (für Verzugszinsen und Pauschale). Aufwandsverfahren (Einkauf direkt auf Aufwand), wie im Lab.
 * (A) Zinsmethode (Entscheidung offen): wie im Lab rec: Z = K · p · t : 36.000, Zinsjahr 360 Tage, tatsächliche Tage, auf Cent gerundet (deutsche Methode vereinfacht). Der Text nennt die Methode.
 * (A) Verzugszinssatz: Basiszinssatz 2,0 % (Übungswert wie im Lab, ändert sich halbjährlich) + 9 Prozentpunkte im Geschäftsverkehr = 11,0 %; Verzugspauschale 40 € (Lab: VERZ).
 * (A) Verzug ohne Mahnung 30 Tage nach Zugang der Rechnung (Rechnung sofort fällig, Zugang = Rechnungsdatum), Zugangstag zählt nicht mit, wie im Lab. Wochenenden und Feiertage bleiben unberücksichtigt.
 * (A) Verzugszinsen werden aus dem Bruttobetrag der Rechnung gerechnet; die Pauschale ist umsatzsteuerfrei und wird als sonstiger Ertrag gebucht. Zinsen und Pauschale zählen zum Auftragsgewinn.
 * (A) Zuschlagskalkulation wie im Lab ohne Sondereinzelkosten und ohne Provision; Gewinn auf die Selbstkosten; Kundenskonto und Kundenrabatt im Hundert; der Rabatt steht auf der Rechnung,
 *     deshalb ist der Zielverkaufspreis der Rechnungspreis netto. Bruttopreis in Station 4 = Listenpreis mit Umsatzsteuer (wie kal13), die Rechnung rechnet die Umsatzsteuer vom Zielverkaufspreis.
 * (A) Material: Bestellmenge = Liefermenge + Ausschuss (in % der Liefermenge); eine Baugruppe braucht einen Materialsatz; die Materialkosten des Auftrags sind der Bezugspreis der ganzen Bestellung.
 * (A) Break-even: Erlös je Stück = Zielverkaufspreis : Liefermenge; Fixkosten = Fixanteil (Lastenheft) der Gemeinkosten; alle anderen Selbstkosten gelten als variabel. Rundung je Stück auf Cent,
 *     deshalb weicht der Gewinn der Deckungsbeitragsrechnung um Centbeträge pro Stück · Menge vom Gewinn der Auswertung ab (gewollt, nicht verglichen).
 * (A) Skonto beim Lieferer wird genutzt (Zahlung innerhalb der Frist); beim Kunden wird es im Auftrag NICHT genutzt (er zahlt verspätet). Bezugskosten (Fracht) werden in den Buchungen nicht geübt.
 * (A) Rechtliches vereinfacht wie im Lab rec: bindendes Angebot + unveränderte rechtzeitige Bestellung = Vertrag mit Eingang der Bestellung; freibleibend = Vertrag erst mit Auftragsbestätigung;
 *     einfacher Eigentumsvorbehalt; Lieferung ab Werk = Käufer trägt die Fracht. Keine Rechtsberatung.
 * (A) Nachkalkulation: nur die Fertigungslöhne weichen ab; Zuschlagssätze und Material bleiben wie geplant.
 */
(function (root) {
  'use strict';
  const PID = 'kalk';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 2 : d).replace('.', ',') : '?');
  const numOf = v => { if (fin(v)) return v; const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) { let d = null; if (ctx) { try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; } if (d == null && isObj(ctx.slots)) d = ctx.slots[slot]; } return d == null ? null : unwrap(d); }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  const safe = (fn, label) => function (data, ctx) { try { return { lines: fn(data, ctx || {}) }; } catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich', 100)] }; } };
  const vals = d => (isObj(d) && isObj(d.vals) ? d.vals : {});
  const rd2 = v => { const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * 100 + 1e-7) / 100; };   // kaufmännisch auf Cent
  const ceil0 = x => Math.ceil(x - 1e-9);
  const pos = (x, s) => { const n = numOf(x); return fin(n) && n > 0 ? n : s; };            // eigener Wert (> 0), sonst Rückfallwert
  const nonneg = (x, s) => { const n = numOf(x); return fin(n) && n >= 0 ? n : s; };
  const anyN = (x, s) => { const n = numOf(x); return fin(n) ? n : s; };

  /* Zahl mit absoluter Toleranz (Cent-Rundung der Stufe), Rückmeldung ohne die richtige Zahl */
  function eurLine(label, x, soll, unit, pts, ctx, dec) {
    x = numOf(x); const ok = fin(x) && fin(soll) && Math.abs(x - soll) <= 0.03 * TOL(ctx) + 1e-9;
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, dec == null ? 2 : dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function intLine(label, x, soll, unit, pts) {
    x = numOf(x); const ok = fin(x) && fin(soll) && Math.abs(x - soll) < 1e-9;
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, 0) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function selLine(label, v, soll, pts, okText) {
    const ok = typeof v === 'string' && v !== '' && v === soll;
    return L(ok, label + ': ' + (typeof v !== 'string' || v === '' ? 'keine Auswahl' : ok ? (okText || 'passt') : 'passt nicht'), pts);
  }
  function taskLines(st, data, ptsAll) {                         // Lab-Aufgaben der Station: zusammen ptsAll Punkte
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };
  const opts = list => list.map(a => ({ value: a[0], label: a[1] }));

  /* ---------- Kalender (ohne Date): Tage seit 01.01.1970 ---------- */
  function civ(o) { let y = o.y; const m = o.m, d = o.d; y -= m <= 2 ? 1 : 0; const era = Math.floor(y / 400), yoe = y - era * 400, doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1, doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; return era * 146097 + doe - 719468; }
  function ymd(z) { z += 719468; const era = Math.floor(z / 146097), doe = z - era * 146097, yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365), doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9); return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m: m, d: d }; }
  const fmtDate = o => (o.d < 10 ? '0' : '') + o.d + '.' + (o.m < 10 ? '0' : '') + o.m + '.' + o.y;

  /* ---------- Fachwerte mit Quelle ---------- */
  const FACH = {
    ust: 19,            // Umsatzsteuer-Regelsatz (§ 12 UStG)
    basis: 2.0,         // Basiszinssatz in % p. a., Übungswert (wie Lab rec, ändert sich halbjährlich) (A)
    aufschlag: 9,       // Aufschlag im Geschäftsverkehr in Prozentpunkten (§ 288 Abs. 2 BGB)
    pauschale: 40,      // Verzugspauschale in € (§ 288 Abs. 5 BGB), nur Geschäftsverkehr
    fristTage: 30,      // Verzug ohne Mahnung 30 Tage nach Zugang der Rechnung (§ 286 Abs. 3 BGB)
    zinsJahr: 360,      // Zinsjahr der deutschen Methode (A)
    skoTage: 10         // Skontofrist gegenüber dem Kunden (A)
  };
  const KUNDEN = ['Hellwerk Anlagenbau GmbH', 'Kronfeld Automation GmbH', 'Brandtal Maschinenbau GmbH'];
  const LIEF_A = ['Nordstadt Elektroteile GmbH', 'Elbtal Bauteile GmbH'];
  const LIEF_B = ['Südwerk Komponenten AG', 'Mittelmark Elektronik GmbH'];

  /* ---------- Rechenkerne (EINE Soll-Funktion je Zahl, genutzt von check, solution, Gesamttest) ---------- */
  const sollBedarf = P => P.menge * (100 + P.ausschuss) / 100;
  const flSumme = P => P.flStk * P.menge;
  function bezug(s, q) {
    const l = rd2(s.lep * q), ra = rd2(l * s.rab / 100), zep = rd2(l - ra), sk = rd2(zep * s.sko / 100), bep = rd2(zep - sk);
    return { lep: l, rab: ra, zep: zep, sko: sk, bep: bep, bk: s.bk, bzp: rd2(bep + s.bk) };
  }
  function sollS2(P, q) { const a = bezug(P.A, q), b = bezug(P.B, q), wahl = a.bzp <= b.bzp ? 'A' : 'B', c = wahl === 'A' ? a : b; return { a: a, b: b, wahl: wahl, c: c }; }
  function sollS3(P, q, wahl) { const s = P[wahl] || P.A, b = bezug(s, q); return { vertrag: P.angebot === 'bindend' ? 'bestellung' : 'ab', art: 'kauf', fracht: s.bk > 0 ? 'kaeufer' : 'lieferer', ev: 'lieferer', skonto: b.sko, zep: b.zep }; }
  function sollS4(P, mek, v) {                                   // v = Werte des Azubis (Kette) oder null (reine Musterlösung)
    const g = (k, s) => (v ? pos(v[k], s) : s), fl = flSumme(P);
    const mk = rd2(mek + rd2(mek * P.mgk / 100)), fk = rd2(fl + rd2(fl * P.fgk / 100)), hk = rd2(mk + fk);
    const hkB = g('hk', hk), sk = rd2(hkB + rd2(hkB * P.vwgk / 100) + rd2(hkB * P.vtgk / 100));
    const skB = g('sk', sk), bvp = rd2(skB + rd2(skB * P.gew / 100));
    const bvpB = g('bvp', bvp), zvp = rd2(bvpB * 100 / (100 - P.kSko));
    const zvpB = g('zvp', zvp), lvp = rd2(zvpB * 100 / (100 - P.kRab));
    const lvpB = g('lvp', lvp), brutto = rd2(lvpB + rd2(lvpB * FACH.ust / 100));
    return { mk: mk, fk: fk, hk: hk, sk: sk, bvp: bvp, zvp: zvp, lvp: lvp, brutto: brutto };
  }
  function sollS5(P, sk, zvp, mek, v) {
    const g = (k, s) => (v ? pos(v[k], s) : s), gk = rd2(sk - mek - flSumme(P));
    const preis = rd2(zvp / P.menge), preisB = g('preis', preis), kfix = rd2(gk * P.fix / 100), kfixB = g('kfix', kfix);
    const kv = rd2((sk - kfixB) / P.menge), kvB = g('kv', kv), db = rd2(preisB - kvB), dbB = g('db', db);
    const bep = dbB > 0 ? ceil0(kfixB / dbB) : null, gewinn = rd2(rd2(dbB * P.menge) - kfixB);
    return { gk: gk, preis: preis, kfix: kfix, kv: kv, db: db, bep: bep, gewinn: gewinn };
  }
  function sollS6(P, q, wahl, zvp, v) {
    const s = P[wahl] || P.A, b = bezug(s, q), v1 = rd2(b.zep + rd2(b.zep * FACH.ust / 100)), v1B = v ? pos(v.v1, v1) : v1;
    const sb = rd2(v1B * s.sko / 100), v2 = rd2(v1B - sb), v3 = rd2(zvp + rd2(zvp * FACH.ust / 100));
    return { b1: 'b', v1: v1, b2: 'c', v2: v2, sb: sb, b3: 'a', v3: v3 };
  }
  const tageSoll = P => Math.max(0, civ(P.zahl) - (civ(P.zug) + FACH.fristTage));
  function sollS7(P, K, v) {
    const t = tageSoll(P), p = FACH.basis + FACH.aufschlag, tB = v ? nonneg(v.tage, t) : t, pB = v ? pos(v.satz, p) : p;
    const zins = rd2(K * pB * tB / (100 * FACH.zinsJahr)), zinsB = v ? pos(v.zins, zins) : zins, gesamt = rd2(K + zinsB + FACH.pauschale);
    return { tage: t, satz: p, zins: zins, gesamt: gesamt, mahn: 'nein30', buch: 'd' };
  }
  function ist(P, mek) {                                         // Selbstkosten mit tatsächlichen Fertigungslöhnen
    const flI = rd2(flSumme(P) * (100 + P.flAbw) / 100), mk = rd2(mek + rd2(mek * P.mgk / 100)), fk = rd2(flI + rd2(flI * P.fgk / 100)), hk = rd2(mk + fk);
    return { fl: flI, sk: rd2(hk + rd2(hk * P.vwgk / 100) + rd2(hk * P.vtgk / 100)) };
  }
  function sollS8(P, mek, zvp, zins, bvp, sk, v) {
    const i = ist(P, mek), skB = v ? pos(v.skIst, i.sk) : i.sk, gewinn = rd2(zvp + zins + FACH.pauschale - skB), gB = v ? anyN(v.gewinn, gewinn) : gewinn;
    const gewPct = skB > 0 ? rd2(gB / skB * 100) : null, plan = rd2(bvp - sk), abw = rd2(gB - plan), abwB = v ? anyN(v.abw, abw) : abw;
    return { skIst: i.sk, gewinn: gewinn, gewPct: gewPct, plan: plan, abw: abw, urteil: abwB > 0.004 ? 'besser' : abwB < -0.004 ? 'schlechter' : 'gleich' };
  }
  function forward(P) {                                          // reine Musterkette aus den Lastenheft-Werten
    const q = sollBedarf(P), s2 = sollS2(P, q), mek = s2.c.bzp, s3 = sollS3(P, q, s2.wahl), s4 = sollS4(P, mek, null), s5 = sollS5(P, s4.sk, s4.zvp, mek, null);
    const s6 = sollS6(P, q, s2.wahl, s4.zvp, null), s7 = sollS7(P, s6.v3, null), s8 = sollS8(P, mek, s4.zvp, s7.zins, s4.bvp, s4.sk, null);
    return { q: q, mek: mek, s2: s2, s3: s3, s4: s4, s5: s5, s6: s6, s7: s7, s8: s8 };
  }
  function prev(ctx) {                                           // eigene Werte des Azubis aus den Vorstationen, sonst Musterwerte
    const P = P_(ctx), F = forward(P), sl = k => vals(slotOf(ctx, k));
    const v1 = sl('kalk.anfrage'), v2 = sl('kalk.einkauf'), v4 = sl('kalk.kalkulation'), v5 = sl('kalk.deckung'), v6 = sl('kalk.buchung'), v7 = sl('kalk.zahlung'), v8 = sl('kalk.auswertung');
    const q = pos(v1.bedarf, F.q), e = sollS2(P, q), wahl = v2.wahl === 'A' || v2.wahl === 'B' ? v2.wahl : e.wahl, mek = pos(v2['bzp' + wahl], wahl === 'A' ? e.a.bzp : e.b.bzp);
    return { P: P, F: F, q: q, e: e, wahl: wahl, mek: mek, v4: v4, v5: v5, v6: v6, v7: v7, v8: v8,
      zvp: pos(v4.zvp, F.s4.zvp), sk: pos(v4.sk, F.s4.sk), bvp: pos(v4.bvp, F.s4.bvp), K: pos(v6.v3, F.s6.v3), zins: pos(v7.zins, F.s7.zins) };
  }

  /* ---------- Lastenheft ---------- */
  function lieferer(r, level, q) {
    if (level === 1) return { A: { name: 'Nordstadt Elektroteile GmbH', lep: 22.5, rab: 5, sko: 2, bk: 300 }, B: { name: 'Südwerk Komponenten AG', lep: 24, rab: 10, sko: 2, bk: 0 } };
    const nA = pick(r, LIEF_A), nB = pick(r, LIEF_B);
    for (let i = 0; i < 80; i++) {
      const lepAc = (40 + Math.floor(r() * 25)) * 50, rabA = pick(r, [0, 5, 8, 10]), skoA = pick(r, [2, 3]), bkA = Math.round(rd2(lepAc / 100 * q) * pick(r, [2, 3, 4, 5]) / 100 / 10) * 10;
      const lepBc = Math.round(lepAc * pick(r, [1.04, 1.06, 1.08, 1.1]) / 50) * 50, rabB = pick(r, [8, 10, 12, 15]), skoB = pick(r, [2, 3]), bkB = pick(r, [0, 0, 40, 60, 80]);
      const A = { name: nA, lep: lepAc / 100, rab: rabA, sko: skoA, bk: bkA }, B = { name: nB, lep: lepBc / 100, rab: rabB, sko: skoB, bk: bkB };
      const a = bezug(A, q).bzp, b = bezug(B, q).bzp;
      if (Math.abs(a - b) / Math.min(a, b) >= 0.025) return { A: A, B: B };
    }
    return { A: { name: nA, lep: 22.5, rab: 5, sko: 2, bk: Math.round(rd2(22.5 * q) * 0.06 / 10) * 10 }, B: { name: nB, lep: 24, rab: 10, sko: 2, bk: 0 } };
  }
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x6b616c6b), L1 = level === 1;
    const kunde = pick(r, KUNDEN), menge = L1 ? 200 : pick(r, [100, 200, 300, 400, 500]), ausschuss = L1 ? 5 : pick(r, [2, 4, 5]), q = menge * (100 + ausschuss) / 100;
    const lf = lieferer(r, level, q);
    const p = {
      kunde: kunde, menge: menge, ausschuss: ausschuss, A: lf.A, B: lf.B, angebot: L1 ? 'bindend' : pick(r, ['bindend', 'frei']),
      flStk: L1 ? 12 : pick(r, [8, 10, 12, 14, 16]), mgk: L1 ? 10 : pick(r, [8, 10, 12]), fgk: L1 ? 150 : pick(r, [120, 150, 180]), vwgk: L1 ? 10 : pick(r, [8, 10, 12]), vtgk: L1 ? 5 : pick(r, [4, 5, 6]),
      gew: L1 ? 10 : pick(r, [8, 10, 12]), kSko: L1 ? 2 : pick(r, [2, 3]), kRab: L1 ? 10 : pick(r, [5, 8, 10]), fix: L1 ? 50 : pick(r, [40, 50, 60]), flAbw: L1 ? 0 : pick(r, [-3, 2, 4, 6]),
      zug: { y: 2026, m: ri(r, 1, 12), d: ri(r, 1, 28) }, minGew: null, hidden: []
    };
    const verz = L1 ? 20 : pick(r, [12, 18, 25, 33, 40, 47]);
    p.zahl = ymd(civ(p.zug) + FACH.fristTage + verz);
    if (level === 3) p.minGew = p.gew - 3;
    const lt = s => 'Listenpreis ' + fm(s.lep, 2) + ' € je Satz, Rabatt ' + s.rab + ' %, Skonto ' + s.sko + ' %, ' + (s.bk > 0 ? 'Lieferung ab Werk (Fracht und Verpackung ' + fm(s.bk, 2) + ' € für die ganze Lieferung)' : 'Lieferung frei Haus (keine Bezugskosten)');
    const text = [
      'Projekt Auftrag kalkulieren und abrechnen, Stufe ' + level + '.',
      'Kundenanfrage der ' + kunde + ': ' + menge + ' Steuerbaugruppen. Je Baugruppe brauchst du einen Materialsatz; dazu kommen ' + ausschuss + ' % Ausschuss, gerechnet auf die Liefermenge (A).',
      'Lieferer A (' + lf.A.name + '): ' + lt(lf.A) + '. Lieferer B (' + lf.B.name + '): ' + lt(lf.B) + '.',
      'Beide Lieferer liefern unter einfachem Eigentumsvorbehalt. Ihr Angebot ist ' + (p.angebot === 'bindend' ? 'bindend und noch gültig; du bestellst unverändert und rechtzeitig' : 'freibleibend') + ' (A).',
      'Fertigung: Fertigungslohn ' + fm(p.flStk, 2) + ' € je Baugruppe. Zuschläge: Materialgemeinkosten ' + p.mgk + ' %, Fertigungsgemeinkosten ' + p.fgk + ' %, Verwaltungsgemeinkosten ' + p.vwgk + ' %, Vertriebsgemeinkosten ' + p.vtgk + ' %, Gewinn ' + p.gew + ' % auf die Selbstkosten.',
      'Gegenüber dem Kunden: Skonto ' + p.kSko + ' % bei Zahlung innerhalb von ' + FACH.skoTage + ' Tagen, Kundenrabatt ' + p.kRab + ' %, Umsatzsteuer ' + FACH.ust + ' %. Die Rechnung ist sofort fällig.',
      'Break-even: ' + p.fix + ' % der Gemeinkosten sind fix, alles andere ist variabel (A).',
      'Abrechnung: Die Rechnung geht dem Kunden am ' + fmtDate(p.zug) + ' zu, er zahlt erst am ' + fmtDate(p.zahl) + '. Basiszinssatz (Übungswert): ' + fm(FACH.basis, 1) + ' % p. a.',
      'Nachkalkulation: Die tatsächlichen Fertigungslöhne liegen ' + (p.flAbw === 0 ? 'genau auf dem Plan' : Math.abs(p.flAbw) + ' % ' + (p.flAbw > 0 ? 'über' : 'unter') + ' dem Plan') + '.'
    ];
    if (level === 1) text.push('Starthilfe: Rechne jeden Schritt auf ganze Cent und nimm den Bezugspreis des günstigeren Lieferers als Materialkosten.');
    if (level === 3) text.push('Zusatzforderung: Der Auftrag soll am Ende mindestens ' + p.minGew + ' % Gewinn auf die tatsächlichen Selbstkosten bringen.');
    return { params: p, text: text };
  }

  /* ---------- Optionen ---------- */
  const O_ART = opts([['bestellung', 'Eine bindende Bestellung'], ['vertrag', 'Schon ein fertiger Kaufvertrag'], ['unverbindlich', 'Eine unverbindliche Bitte um ein Angebot']]);
  const O_LH = opts([['lieferant', 'Der Auftragnehmer (wir)'], ['auftraggeber', 'Der Auftraggeber (der Kunde)'], ['behoerde', 'Das Finanzamt']]);
  const O_VERTRAG = opts([['anfrage', 'Schon mit unserer Anfrage'], ['bestellung', 'Mit dem Eingang unserer Bestellung, eine Auftragsbestätigung ist nicht nötig'], ['ab', 'Erst mit der Auftragsbestätigung des Lieferers'], ['lieferung', 'Erst mit der Lieferung der Ware']]);
  const O_VART = opts([['werk', 'Werkvertrag'], ['kauf', 'Kaufvertrag'], ['dienst', 'Dienstvertrag'], ['miet', 'Mietvertrag']]);
  const O_FRACHT = opts([['kaeufer', 'Wir als Käufer (Lieferung ab Werk)'], ['lieferer', 'Der Lieferer (Lieferung frei Haus)'], ['geteilt', 'Beide zur Hälfte']]);
  const O_EV = opts([['wir', 'Uns, sobald die Ware im Lager liegt'], ['lieferer', 'Dem Lieferer, wir sind bis zur Zahlung nur Besitzer'], ['kunde', 'Unserem Kunden']]);
  const O_B1 = opts([['a', 'Aufwendungen für Rohstoffe an Verbindlichkeiten aus L. u. L. (ohne Vorsteuer)'], ['b', 'Aufwendungen für Rohstoffe und Vorsteuer an Verbindlichkeiten aus L. u. L.'], ['c', 'Verbindlichkeiten aus L. u. L. an Aufwendungen für Rohstoffe und Vorsteuer'], ['d', 'Aufwendungen für Rohstoffe und Umsatzsteuer an Bank']]);
  const O_B2 = opts([['a', 'Verbindlichkeiten aus L. u. L. an Bank (der Skonto wird nicht gebucht)'], ['b', 'Bank an Verbindlichkeiten aus L. u. L., Nachlässe und Vorsteuer'], ['c', 'Verbindlichkeiten aus L. u. L. an Bank, Nachlässe und Vorsteuer'], ['d', 'Verbindlichkeiten aus L. u. L. an Bank und Nachlässe (ohne Vorsteuerberichtigung)']]);
  const O_B3 = opts([['a', 'Forderungen aus L. u. L. an Umsatzerlöse für Erzeugnisse und Umsatzsteuer'], ['b', 'Forderungen aus L. u. L. an Umsatzerlöse für Erzeugnisse (ohne Umsatzsteuer)'], ['c', 'Umsatzerlöse für Erzeugnisse und Umsatzsteuer an Forderungen aus L. u. L.'], ['d', 'Bank an Umsatzerlöse für Erzeugnisse und Umsatzsteuer']]);
  const O_MAHN = opts([['ja', 'Ja, ohne Mahnung gibt es nie Verzug'], ['nein30', 'Nein, 30 Tage nach Zugang der Rechnung tritt der Verzug auch ohne Mahnung ein'], ['nachfrist', 'Ja, erst nach einer Nachfrist von 14 Tagen']]);
  const O_B4 = opts([['a', 'Bank an Forderungen aus L. u. L. (Zinsen und Pauschale werden nicht gebucht)'], ['b', 'Forderungen aus L. u. L. an Bank, Zinserträge und Sonstige betriebliche Erträge'], ['c', 'Bank an Umsatzerlöse für Erzeugnisse und Umsatzsteuer'], ['d', 'Bank an Forderungen aus L. u. L., Zinserträge und Sonstige betriebliche Erträge']]);
  const O_URT = opts([['besser', 'Besser als geplant'], ['schlechter', 'Schlechter als geplant'], ['gleich', 'Genau wie geplant']]);
  const num = (key, label, unit, hint) => ({ key: key, label: label, type: 'number', unit: unit, hint: hint });
  const sel = (key, label, options) => ({ key: key, label: label, type: 'select', options: options });

  /* ---------- Prüfungen ---------- */
  function checkS1(data, ctx) {
    const P = P_(ctx), v = vals(data), q = sollBedarf(P);
    return [selLine('Art der Anfrage', v.art, 'unverbindlich', 15, 'richtig eingeordnet'), selLine('Lastenheft', v.lh, 'auftraggeber', 15, 'richtig zugeordnet'),
      intLine('Bestellmenge', v.bedarf, q, 'Sätze', 40)].concat(taskLines(STATIONS[0], data, 30));
  }
  function checkS2(data, ctx) {
    const O = prev(ctx), v = vals(data), e = O.e, c = O.wahl === 'A' ? e.a : e.b;
    return [eurLine('Bezugspreis Lieferer A', v.bzpA, e.a.bzp, '€', 20, ctx), eurLine('Bezugspreis Lieferer B', v.bzpB, e.b.bzp, '€', 20, ctx),
      selLine('Entscheidung', v.wahl, e.wahl, 15, 'der günstigere Lieferer'), eurLine('Bezugspreis je Stück', v.bzpStk, rd2(pos(v['bzp' + (v.wahl === 'B' ? 'B' : 'A')], c.bzp) / O.q), '€', 15, ctx)]
      .concat(taskLines(STATIONS[1], data, 30));
  }
  function checkS3(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS3(O.P, O.q, O.wahl);
    return [selLine('Vertragsschluss', v.vertrag, s.vertrag, 20), selLine('Vertragsart', v.art, s.art, 10), selLine('Fracht', v.fracht, s.fracht, 15),
      selLine('Eigentumsvorbehalt', v.ev, s.ev, 10), eurLine('Lieferantenskonto', v.skonto, s.skonto, '€', 15, ctx)].concat(taskLines(STATIONS[2], data, 30));
  }
  function checkS4(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS4(O.P, O.mek, v);
    return [eurLine('Herstellkosten', v.hk, s.hk, '€', 12, ctx), eurLine('Selbstkosten', v.sk, s.sk, '€', 12, ctx), eurLine('Barverkaufspreis', v.bvp, s.bvp, '€', 12, ctx),
      eurLine('Zielverkaufspreis', v.zvp, s.zvp, '€', 12, ctx), eurLine('Listenverkaufspreis netto', v.lvp, s.lvp, '€', 11, ctx), eurLine('Bruttoverkaufspreis', v.brutto, s.brutto, '€', 11, ctx)]
      .concat(taskLines(STATIONS[3], data, 30));
  }
  function checkS5(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS5(O.P, O.sk, O.zvp, O.mek, v);
    return [eurLine('Erlös je Stück', v.preis, s.preis, '€', 12, ctx), eurLine('Fixkosten', v.kfix, s.kfix, '€', 12, ctx), eurLine('Variable Stückkosten', v.kv, s.kv, '€', 12, ctx),
      eurLine('Deckungsbeitrag je Stück', v.db, s.db, '€', 12, ctx), intLine('Break-even-Menge', v.bep, s.bep, 'Stück', 11), eurLine('Gewinn bei Liefermenge', v.gewinn, s.gewinn, '€', 11, ctx)]
      .concat(taskLines(STATIONS[4], data, 30));
  }
  function checkS6(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS6(O.P, O.q, O.wahl, O.zvp, v);
    return [selLine('Buchung Eingangsrechnung', v.b1, s.b1, 12), eurLine('Verbindlichkeit (brutto)', v.v1, s.v1, '€', 12, ctx), selLine('Buchung Zahlung an den Lieferer', v.b2, s.b2, 12),
      eurLine('Zahlbetrag an den Lieferer', v.v2, s.v2, '€', 12, ctx), selLine('Buchung Ausgangsrechnung', v.b3, s.b3, 11), eurLine('Forderung (brutto)', v.v3, s.v3, '€', 11, ctx)]
      .concat(taskLines(STATIONS[5], data, 30));
  }
  function checkS7(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS7(O.P, O.K, v);
    return [intLine('Zinstage', v.tage, s.tage, 'Tage', 12), eurLine('Verzugszinssatz', v.satz, s.satz, '% p. a.', 10, ctx, 1), eurLine('Verzugszinsen', v.zins, s.zins, '€', 14, ctx),
      eurLine('Gesamtforderung', v.gesamt, s.gesamt, '€', 14, ctx), selLine('Mahnung nötig', v.mahn, s.mahn, 10, 'richtig beurteilt'), selLine('Buchung Zahlungseingang', v.buch, s.buch, 10)]
      .concat(taskLines(STATIONS[6], data, 30));
  }
  function checkS8(data, ctx) {
    const O = prev(ctx), v = vals(data), s = sollS8(O.P, O.mek, O.zvp, O.zins, O.bvp, O.sk, v);
    return [eurLine('Selbstkosten (Ist)', v.skIst, s.skIst, '€', 20, ctx), eurLine('Gewinn des Auftrags', v.gewinn, s.gewinn, '€', 20, ctx), eurLine('Gewinn in Prozent der Selbstkosten', v.gewPct, s.gewPct, '%', 10, ctx),
      eurLine('Abweichung vom Plan', v.abw, s.abw, '€', 10, ctx), selLine('Urteil', v.urteil, s.urteil, 10, 'richtig beurteilt')].concat(taskLines(STATIONS[7], data, 30));
  }

  /* ---------- Hilfen für Lösungen und Mutanten ---------- */
  const sol = fn => ctx => ({ vals: fn(prev(ctx), ctx), tasks: {} });
  const noTasks = d => { Object.keys(d.tasks || {}).forEach(k => { d.tasks[k] = 0; }); return d; };
  const mulV = (k, f) => d => { d.vals[k] = rd2(d.vals[k] * f); return d; };
  const setV = (k, x) => d => { d.vals[k] = x; return d; };
  const both = (...fs) => d => fs.reduce((a, f) => f(a), d);
  const other = (cur, a, b) => (cur === a ? b : a);

  const STATIONS = [
    { id: 'vc1', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Kundenanfrage prüfen', level: 1,
      on: 'vb', text: 'Die Anfrage des Kunden liegt im Lastenheft vor. Ordne sie rechtlich ein, kläre, wer das Lastenheft schreibt, und rechne aus, wie viele Materialsätze du bestellen musst: Liefermenge plus Ausschuss.',
      in: [], out: 'kalk.anfrage', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'rec', id: 'rec1', min: 70 }, { lab: 'rec', id: 'rec26', min: 70 }],
      form: [sel('art', 'Was ist die Anfrage des Kunden rechtlich?', O_ART), sel('lh', 'Wer legt im Lastenheft die Anforderungen fest?', O_LH), num('bedarf', 'Bestellmenge Materialsätze', 'Sätze', 'Liefermenge plus Ausschuss')],
      hint: ['Eine Anfrage bindet weder den Kunden noch uns. Beim Material kommt zur Liefermenge noch der Ausschuss dazu.',
        'Bestellmenge = Liefermenge + Liefermenge · Ausschuss in % : 100. Den Ausschuss rechnest du auf die Liefermenge, nicht auf die Bestellmenge.',
        'Rechne zuerst aus, wie viele Sätze der Ausschuss ausmacht, und zähle sie zur Liefermenge dazu. Das Ergebnis ist eine ganze Zahl.'],
      check: safe(checkS1, 'Kundenanfrage'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => ({ art: 'unverbindlich', lh: 'auftraggeber', bedarf: sollBedarf(O.P) })),
      mutants: [{ name: 'Ausschuss vergessen', mutate: d => { d.vals.bedarf -= 10; return d; }, expectFail: ['Bestellmenge'] },
        { name: 'Anfrage als Bestellung gedeutet', mutate: setV('art', 'bestellung'), expectFail: ['Art der Anfrage'] },
        { name: 'Lastenheft dem Auftragnehmer zugeordnet', mutate: setV('lh', 'lieferant'), expectFail: ['Lastenheft'] },
        { name: 'Schwer: Aufgaben offen und Menge falsch', mutate: both(noTasks, d => { d.vals.bedarf -= 10; return d; }), expectFail: ['Lab-Aufgabe', 'Bestellmenge'] }] },
    { id: 'vc2', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Angebote vergleichen', level: 2,
      on: 'vb', text: 'Zwei Lieferer haben für den Materialsatz ein Angebot abgegeben. Rechne für beide den Bezugspreis der ganzen Bestellung aus (Listenpreis, Rabatt, Skonto, Bezugskosten), wähle den günstigeren und gib dessen Bezugspreis je Stück an. Jedes Zwischenergebnis rundest du auf ganze Cent.',
      in: ['kalk.anfrage'], out: 'kalk.einkauf', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kal', id: 'kal3', min: 70 }, { lab: 'kal', id: 'kal4', min: 70 }],
      form: [num('bzpA', 'Bezugspreis Lieferer A (ganze Bestellung)', '€'), num('bzpB', 'Bezugspreis Lieferer B (ganze Bestellung)', '€'), sel('wahl', 'Welchen Lieferer wählst du?', opts([['A', 'Lieferer A'], ['B', 'Lieferer B']])),
        num('bzpStk', 'Bezugspreis je Stück des gewählten Lieferers', '€', 'Bezugspreis : Bestellmenge')],
      hint: ['Rechne Schritt für Schritt wie im Bezugsschema: Der Rabatt kommt vom Listenpreis, der Skonto vom Zieleinkaufspreis, die Bezugskosten kommen zuletzt dazu.',
        'Listeneinkaufspreis = Stückpreis · Bestellmenge; − Rabatt = Zieleinkaufspreis; − Skonto = Bareinkaufspreis; + Bezugskosten = Bezugspreis. Nimm die Bestellmenge aus Station 1.',
        'Vergleiche am Ende die beiden Bezugspreise, nicht die Listenpreise. Für den Preis je Stück teilst du den Bezugspreis des Siegers durch die Bestellmenge und rundest auf Cent.'],
      check: safe(checkS2, 'Angebotsvergleich'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => ({ bzpA: O.e.a.bzp, bzpB: O.e.b.bzp, wahl: O.e.wahl, bzpStk: rd2(O.e.c.bzp / O.q) })),
      mutants: [{ name: 'Bezugskosten beim teureren Lieferer falsch', mutate: d => { const o = d.vals.wahl === 'A' ? 'bzpB' : 'bzpA'; d.vals[o] = rd2(d.vals[o] * 1.1); return d; }, expectFail: ['Bezugspreis Lieferer'] },
        { name: 'Falschen Lieferer gewählt', mutate: d => { d.vals.wahl = other(d.vals.wahl, 'A', 'B'); return d; }, expectFail: ['Entscheidung', 'Bezugspreis je Stück'] },
        { name: 'Preis je Stück zehnfach', mutate: mulV('bzpStk', 10), expectFail: ['Bezugspreis je Stück'] },
        { name: 'Schwer: beide Bezugspreise falsch', mutate: both(mulV('bzpA', 1.1), mulV('bzpB', 1.1)), expectFail: ['Bezugspreis Lieferer', 'Bezugspreis je Stück'] }] },
    { id: 'vc3', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Bestellung und Kaufvertrag', level: 2,
      on: 'vb', text: 'Du bestellst beim gewählten Lieferer. Kläre, wann der Kaufvertrag zustande kommt, welche Vertragsart vorliegt, wer die Fracht trägt und wem das Material bis zur Zahlung gehört. Rechne außerdem den Skontobetrag aus, den du bei pünktlicher Zahlung abziehen darfst (in Euro, auf Cent gerundet).',
      in: ['kalk.einkauf'], out: 'kalk.bestellung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'rec', id: 'rec3', min: 70 }, { lab: 'rec', id: 'rec20', min: 70 }],
      form: [sel('vertrag', 'Wann kommt der Kaufvertrag zustande?', O_VERTRAG), sel('art', 'Welche Vertragsart ist es?', O_VART), sel('fracht', 'Wer trägt die Fracht?', O_FRACHT),
        sel('ev', 'Wem gehört das Material bis zur Zahlung?', O_EV), num('skonto', 'Skontobetrag des Lieferers', '€', 'vom Zieleinkaufspreis')],
      hint: ['Überlege: Wer macht den Antrag, wer nimmt an? Das hängt davon ab, ob das Angebot bindend war. Beim Skonto zählt der Zieleinkaufspreis.',
        'Ein bindendes Angebot, auf das du unverändert und rechtzeitig bestellst, ist angenommen. Ein freibleibendes Angebot ist nur eine Einladung: Dann ist deine Bestellung der Antrag. Bei Lieferung ab Werk zahlt der Käufer die Fracht. Skonto = Zieleinkaufspreis · Skonto-% : 100.',
        'Zieleinkaufspreis = Listenpreis der Bestellmenge minus Rabatt. Beim Eigentumsvorbehalt bleibt das Eigentum beim Lieferer, du bekommst nur den Besitz.'],
      check: safe(checkS3, 'Bestellung'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS3(O.P, O.q, O.wahl); return { vertrag: s.vertrag, art: s.art, fracht: s.fracht, ev: s.ev, skonto: s.skonto }; }),
      mutants: [{ name: 'Vertrag schon mit der Anfrage', mutate: setV('vertrag', 'anfrage'), expectFail: ['Vertragsschluss'] },
        { name: 'Fracht beim falschen Partner', mutate: d => { d.vals.fracht = other(d.vals.fracht, 'kaeufer', 'lieferer'); return d; }, expectFail: ['Fracht'] },
        { name: 'Eigentum beim Käufer', mutate: setV('ev', 'wir'), expectFail: ['Eigentumsvorbehalt'] },
        { name: 'Skonto vom Bruttopreis gerechnet', mutate: mulV('skonto', 1.19), expectFail: ['Lieferantenskonto'] },
        { name: 'Schwer: Vertragsart und Zeitpunkt falsch, Aufgaben offen', mutate: both(noTasks, setV('art', 'werk'), d => { d.vals.vertrag = other(d.vals.vertrag, 'bestellung', 'ab'); return d; }), expectFail: ['Lab-Aufgabe', 'Vertragsart', 'Vertragsschluss'] }] },
    { id: 'vc4', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Auftrag kalkulieren', level: 3,
      on: 'vb', text: 'Kalkuliere den Auftrag mit der Zuschlagskalkulation. Die Materialkosten sind der Bezugspreis aus Station 2, die Fertigungslöhne und Zuschläge stehen im Lastenheft. Rechne bis zum Listenverkaufspreis netto und zum Bruttopreis. Der Kundenrabatt steht später auf der Rechnung. Skonto und Rabatt rechnest du im Hundert, den Gewinn auf die Selbstkosten, jedes Zwischenergebnis auf ganze Cent.',
      in: ['kalk.einkauf', 'kalk.bestellung'], out: 'kalk.kalkulation', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kal', id: 'kal7', min: 70 }, { lab: 'kal', id: 'kal13', min: 70 }],
      form: [num('hk', 'Herstellkosten', '€'), num('sk', 'Selbstkosten', '€'), num('bvp', 'Barverkaufspreis', '€'), num('zvp', 'Zielverkaufspreis', '€'), num('lvp', 'Listenverkaufspreis netto (Angebotspreis)', '€'),
        num('brutto', 'Bruttoverkaufspreis (Listenpreis mit Umsatzsteuer)', '€')],
      hint: ['Gehe das Schema von oben nach unten durch: erst Material und Fertigung, dann Herstellkosten, Selbstkosten, Gewinn, Skonto, Rabatt und zuletzt die Umsatzsteuer.',
        'HK = Material + MGK + Fertigungslohn + FGK. SK = HK + VwGK + VtGK (beide auf die HK). BVP = SK + Gewinn (auf Hundert). ZVP = BVP · 100 : (100 − Skonto). LVP = ZVP · 100 : (100 − Rabatt). Brutto = LVP + Umsatzsteuer.',
        'Skonto und Rabatt sind Prozente im Hundert: Der Nenner ist 100 minus der Prozentsatz, nicht 100 plus. Den Fertigungslohn für den ganzen Auftrag bekommst du, wenn du den Lohn je Baugruppe mit der Liefermenge malnimmst.'],
      check: safe(checkS4, 'Kalkulation'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS4(O.P, O.mek, null); return { hk: s.hk, sk: s.sk, bvp: s.bvp, zvp: s.zvp, lvp: s.lvp, brutto: s.brutto }; }),
      mutants: [{ name: 'Gewinn nicht aufgeschlagen', mutate: d => { d.vals.bvp = d.vals.sk; return d; }, expectFail: ['Barverkaufspreis', 'Zielverkaufspreis'] },
        { name: 'Kundenrabatt vergessen', mutate: d => { d.vals.lvp = d.vals.zvp; return d; }, expectFail: ['Listenverkaufspreis', 'Bruttoverkaufspreis'] },
        { name: 'Umsatzsteuer vergessen', mutate: d => { d.vals.brutto = d.vals.lvp; return d; }, expectFail: ['Bruttoverkaufspreis'] },
        { name: 'Fertigungsgemeinkosten vergessen', mutate: mulV('hk', 0.7), expectFail: ['Herstellkosten', 'Selbstkosten'] },
        { name: 'Schwer: Aufgaben offen, Selbstkosten falsch', mutate: both(noTasks, mulV('sk', 0.9)), expectFail: ['Lab-Aufgabe', 'Selbstkosten', 'Barverkaufspreis'] }] },
    { id: 'vc5', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Break-even berechnen', level: 2,
      on: 'vb', text: 'Prüfe, ab welcher Menge sich der Auftrag lohnt. Als Erlös je Stück nimmst du den Rechnungspreis netto (Zielverkaufspreis geteilt durch die Liefermenge). Fix ist der im Lastenheft genannte Anteil der Gemeinkosten, alles andere in den Selbstkosten ist variabel (A). Rechne je Stück auf ganze Cent und runde die Break-even-Menge auf.',
      in: ['kalk.kalkulation'], out: 'kalk.deckung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kal', id: 'kal25', min: 70 }, { lab: 'kal', id: 'kal26', min: 70 }],
      form: [num('preis', 'Erlös je Stück (netto, nach Rabatt)', '€'), num('kfix', 'Fixkosten des Auftrags', '€'), num('kv', 'Variable Stückkosten', '€'), num('db', 'Deckungsbeitrag je Stück', '€'),
        num('bep', 'Break-even-Menge (aufgerundet)', 'Stück'), num('gewinn', 'Gewinn bei der Liefermenge', '€', 'db · Menge − Fixkosten')],
      hint: ['Der Deckungsbeitrag zeigt, was jedes verkaufte Stück zur Deckung der Fixkosten beiträgt. Fix sind nur Gemeinkosten, nicht das Material und nicht der Fertigungslohn.',
        'db = Erlös − variable Stückkosten. Break-even-Menge = Fixkosten : db (aufrunden). Gewinn = db · Menge − Fixkosten. Gemeinkosten = Selbstkosten − Materialkosten − Fertigungslöhne.',
        'Fixkosten = Gemeinkosten · Fixanteil in % : 100. Variable Kosten = Selbstkosten − Fixkosten; durch die Liefermenge geteilt ergibt das die variablen Stückkosten.'],
      check: safe(checkS5, 'Break-even'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS5(O.P, O.sk, O.zvp, O.mek, null); return { preis: s.preis, kfix: s.kfix, kv: s.kv, db: s.db, bep: s.bep, gewinn: s.gewinn }; }),
      mutants: [{ name: 'Break-even nicht aufgerundet', mutate: d => { d.vals.bep -= 1; return d; }, expectFail: ['Break-even-Menge'] },
        { name: 'Gewinn ohne Abzug der Fixkosten', mutate: d => { d.vals.gewinn += d.vals.kfix; return d; }, expectFail: ['Gewinn bei Liefermenge'] },
        { name: 'Erlös je Stück zu hoch', mutate: mulV('preis', 1.1), expectFail: ['Erlös je Stück', 'Deckungsbeitrag je Stück'] },
        { name: 'Schwer: Aufgaben offen, Break-even und Gewinn falsch', mutate: both(noTasks, d => { d.vals.bep -= 1; d.vals.gewinn += d.vals.kfix; return d; }), expectFail: ['Lab-Aufgabe', 'Break-even-Menge', 'Gewinn bei Liefermenge'] }] },
    { id: 'vc6', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Buchungssätze Einkauf und Verkauf', level: 3,
      on: 'vb', text: 'Buche drei Geschäftsfälle des Auftrags: die Eingangsrechnung des Lieferers für das Material (auf Ziel, Einkauf direkt als Aufwand), deren Bezahlung per Bank unter Abzug von Skonto und die Ausgangsrechnung an den Kunden (der Rabatt steht schon auf der Rechnung). Die Konten nennst du mit Namen; die Kontonummern hängen vom Kontenplan deines Betriebs ab. Die Fracht lassen wir hier weg.',
      in: ['kalk.einkauf', 'kalk.kalkulation'], out: 'kalk.buchung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'buc', id: 'buc21', min: 70 }, { lab: 'buc', id: 'buc15', min: 70 }],
      form: [sel('b1', 'Buchungssatz Eingangsrechnung', O_B1), num('v1', 'Verbindlichkeit (brutto)', '€'), sel('b2', 'Buchungssatz Zahlung an den Lieferer mit Skonto', O_B2), num('v2', 'Zahlbetrag an den Lieferer', '€', 'Rechnung minus Skonto brutto'),
        sel('b3', 'Buchungssatz Ausgangsrechnung', O_B3), num('v3', 'Forderung (brutto)', '€', 'Zielverkaufspreis plus Umsatzsteuer')],
      hint: ['Einkauf im Aufwandsverfahren: Der Nettobetrag ist Aufwand, die Umsatzsteuer ist Vorsteuer, die Schuld steht brutto im Haben. Beim Verkauf ist es umgekehrt: Forderung brutto im Soll, Erlös netto und Umsatzsteuer im Haben.',
        'Skonto bei der Zahlung: Du rechnest den Skonto vom Bruttobetrag der Rechnung. Darin steckt Umsatzsteuer, die du als Vorsteuer berichtigst, der Rest mindert den Einkauf (Konto Nachlässe). Zahlbetrag = Rechnung − Skonto brutto.',
        'Eingangsrechnung: Zieleinkaufspreis plus 19 % Vorsteuer. Ausgangsrechnung: Zielverkaufspreis plus 19 % Umsatzsteuer, der Rabatt steht schon auf der Rechnung. Das Soll steht links vom „an“, das Haben rechts.'],
      check: safe(checkS6, 'Buchungssätze'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS6(O.P, O.q, O.wahl, O.zvp, null); return { b1: s.b1, v1: s.v1, b2: s.b2, v2: s.v2, b3: s.b3, v3: s.v3 }; }),
      mutants: [{ name: 'Vorsteuer nicht gebucht', mutate: setV('b1', 'a'), expectFail: ['Buchung Eingangsrechnung'] },
        { name: 'Skonto nicht berichtigt', mutate: setV('b2', 'd'), expectFail: ['Buchung Zahlung an den Lieferer'] },
        { name: 'Verbindlichkeit netto statt brutto', mutate: d => { d.vals.v1 = rd2(d.vals.v1 / 1.19); return d; }, expectFail: ['Verbindlichkeit', 'Zahlbetrag an den Lieferer'] },
        { name: 'Umsatzsteuer der Ausgangsrechnung vergessen', mutate: d => { d.vals.v3 = rd2(d.vals.v3 / 1.19); return d; }, expectFail: ['Forderung'] },
        { name: 'Schwer: Buchungen und Forderung falsch, Aufgaben offen', mutate: both(noTasks, setV('b3', 'b'), setV('b1', 'a'), d => { d.vals.v3 = rd2(d.vals.v3 / 1.19); return d; }), expectFail: ['Lab-Aufgabe', 'Buchung Ausgangsrechnung', 'Forderung', 'Buchung Eingangsrechnung'] }] },
    { id: 'vc7', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Zahlung und Verzug', level: 3,
      on: 'vb', text: 'Der Kunde zahlt zu spät. Die Rechnung ist sofort fällig; ohne Mahnung gerät ein Unternehmen 30 Tage nach Zugang der Rechnung in Verzug (A). Zähle die Zinstage vom Ende dieser 30 Tage bis zum Zahlungstag, bestimme den Verzugszinssatz (Basiszinssatz plus Aufschlag im Geschäftsverkehr) und rechne die Zinsen aus dem Rechnungsbetrag brutto aus Station 6. Zinsmethode wie im Auftrag-und-Recht-Lab: Zinsen = Kapital · Zinssatz · Tage : 36.000 (Zinsjahr 360 Tage, tatsächliche Zinstage), auf Cent gerundet. Dazu kommt die Verzugspauschale von 40 €. Buche den Zahlungseingang.',
      in: ['kalk.buchung'], out: 'kalk.zahlung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'rec', id: 'rec24', min: 70 }, { lab: 'rec', id: 'rec11', min: 70 }],
      form: [num('tage', 'Zinstage', 'Tage'), num('satz', 'Verzugszinssatz', '% p. a.'), num('zins', 'Verzugszinsen', '€'), num('gesamt', 'Gesamtforderung (Rechnung + Zinsen + Pauschale)', '€'),
        sel('mahn', 'Muss der Kunde erst gemahnt werden, damit der Verzug eintritt?', O_MAHN), sel('buch', 'Buchungssatz Zahlungseingang des Kunden', O_B4)],
      hint: ['Zähle ab dem Tag, an dem die 30 Tage enden, bis zum Zahlungstag. Der Zinssatz im Geschäftsverkehr liegt über dem Basiszinssatz.',
        'Zinstage = Tage vom Fristende (Zugang + 30 Tage) bis zum Zahlungstag. Verzugszinssatz = Basiszinssatz + 9 Prozentpunkte. Zinsen = Kapital · Satz · Tage : 36.000.',
        'Kapital ist der Rechnungsbetrag brutto aus Station 6. Gesamtforderung = Rechnungsbetrag + Zinsen + 40 € Pauschale. Zinsen und Pauschale buchst du als Ertrag, die Forderung wird ausgeglichen.'],
      check: safe(checkS7, 'Zahlung und Verzug'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS7(O.P, O.K, null); return { tage: s.tage, satz: s.satz, zins: s.zins, gesamt: s.gesamt, mahn: s.mahn, buch: s.buch }; }),
      mutants: [{ name: 'Zinsjahr mit 365 Tagen gerechnet', mutate: d => { d.vals.zins = rd2(d.vals.zins * 360 / 365); return d; }, expectFail: ['Verzugszinsen', 'Gesamtforderung'] },
        { name: 'Zinstage ab Rechnungszugang gezählt', mutate: d => { d.vals.tage += 30; return d; }, expectFail: ['Zinstage', 'Verzugszinsen'] },
        { name: 'Verzugspauschale vergessen', mutate: d => { d.vals.gesamt = rd2(d.vals.gesamt - 40); return d; }, expectFail: ['Gesamtforderung'] },
        { name: 'Mahnung für nötig gehalten', mutate: setV('mahn', 'ja'), expectFail: ['Mahnung nötig'] },
        { name: 'Zinsen und Pauschale nicht gebucht', mutate: setV('buch', 'a'), expectFail: ['Buchung Zahlungseingang'] },
        { name: 'Schwer: Zinssatz ohne Aufschlag, Aufgaben offen', mutate: both(noTasks, setV('satz', 2)), expectFail: ['Lab-Aufgabe', 'Verzugszinssatz', 'Verzugszinsen'] }] },
    { id: 'vc8', lab: 'vb', cat: 'Auftrag kalkulieren', title: 'Auftrag auswerten', level: 2,
      on: 'vb', text: 'Der Auftrag ist erledigt. Rechne die Selbstkosten mit den tatsächlichen Fertigungslöhnen nach (Zuschlagssätze und Materialkosten bleiben), ermittle den Gewinn des Auftrags (Rechnungspreis netto plus Verzugszinsen plus Pauschale minus tatsächliche Selbstkosten), setze ihn ins Verhältnis zu den Selbstkosten und vergleiche ihn mit dem geplanten Gewinn aus der Kalkulation.',
      in: ['kalk.kalkulation', 'kalk.zahlung'], out: 'kalk.auswertung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kal', id: 'kal15', min: 70 }, { lab: 'kal', id: 'kal16', min: 70 }],
      form: [num('skIst', 'Selbstkosten (Ist)', '€'), num('gewinn', 'Gewinn des Auftrags', '€'), num('gewPct', 'Gewinn in Prozent der Selbstkosten (Ist)', '%'), num('abw', 'Abweichung vom geplanten Gewinn', '€', 'Gewinn Ist minus Gewinn laut Kalkulation'),
        sel('urteil', 'Wie ist das Ergebnis gegenüber der Planung?', O_URT)],
      hint: ['Rechne die Selbstkosten noch einmal, diesmal mit den tatsächlichen Löhnen. Der Erlös ist das, was der Kunde nach Rabatt netto zahlt; dazu kommen Zinsen und Pauschale.',
        'Ist-Lohn = Planlohn · (100 + Abweichung in %) : 100. Gewinn = Zielverkaufspreis + Zinsen + Pauschale − Ist-Selbstkosten. Prozent = Gewinn : Ist-Selbstkosten · 100. Abweichung = Gewinn − geplanter Gewinn (Barverkaufspreis − Selbstkosten).',
        'Die Zuschläge gelten unverändert und werden auf die Ist-Löhne und die neuen Herstellkosten gerechnet. Ein Kunde, der kein Skonto nimmt, bringt dir den Skontobetrag als Mehrerlös.'],
      check: safe(checkS8, 'Auswertung'), starter: ctx => ({ vals: {}, tasks: {} }),
      solution: sol((O, ctx) => { const s = sollS8(O.P, O.mek, O.zvp, O.zins, O.bvp, O.sk, null); return { skIst: s.skIst, gewinn: s.gewinn, gewPct: s.gewPct, abw: s.abw, urteil: s.urteil }; }),
      mutants: [{ name: 'Planlöhne statt Istlöhne', mutate: mulV('skIst', 0.97), expectFail: ['Selbstkosten (Ist)', 'Gewinn des Auftrags', 'Gewinn in Prozent'] },
        { name: 'Verzugserträge nicht berücksichtigt', mutate: d => { d.vals.gewinn = rd2(d.vals.gewinn - 100); return d; }, expectFail: ['Gewinn des Auftrags', 'Gewinn in Prozent', 'Abweichung vom Plan'] },
        { name: 'Urteil falsch herum', mutate: d => { d.vals.urteil = d.vals.urteil === 'besser' ? 'schlechter' : 'besser'; return d; }, expectFail: ['Urteil'] },
        { name: 'Abweichung mit falschem Vorzeichen', mutate: d => { d.vals.abw = -d.vals.abw; return d; }, expectFail: ['Abweichung vom Plan', 'Urteil'] },
        { name: 'Schwer: Aufgaben offen, Ist-Selbstkosten falsch', mutate: both(noTasks, mulV('skIst', 0.97)), expectFail: ['Lab-Aufgabe', 'Selbstkosten (Ist)', 'Gewinn des Auftrags', 'Gewinn in Prozent'] }] }
  ];
  STATIONS.forEach(s => { const f = s.solution; s.solution = ctx => { const d = f(ctx); d.tasks = tasksDone(s); return d; }; });   // Lab-Aufgaben der eigenen Station als gelöst

  /* ---------- Gesamttest ---------- */
  const TOLS = { 1: 1.5, 2: 1, 3: 0.6 };
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, level: level, tol: TOLS[level] || 1, slots: slots || {}, get: k => (slots || {})[k] };
    let O, F, v4, v5, v7, v8;
    try { O = prev(ctx); F = O.F; v4 = O.v4; v5 = O.v5; v7 = O.v7; v8 = O.v8; } catch (e) { return { lines: [L(false, 'Gesamtauftrag: Prüfung nicht möglich', 100)], kpis: [] }; }
    const t = TOLS[level] || 1, lvp = numOf(v4.lvp), bep = numOf(v5.bep), gesamt = numOf(v7.gesamt), gew = numOf(v8.gewinn), skI = numOf(v8.skIst), pct = fin(gew) && fin(skI) && skI > 0 ? gew / skI * 100 : NaN;
    const rel = (x, s, f) => fin(x) && fin(s) && Math.abs(x - s) <= f * t * Math.abs(s);
    const a = numOf(vals(slotOf(ctx, 'kalk.einkauf')).bzpA), b = numOf(vals(slotOf(ctx, 'kalk.einkauf')).bzpB), zins = numOf(v7.zins);
    const gewOk = fin(gew) && gew > 0 && (P.minGew == null || (fin(pct) && pct >= P.minGew));
    return {
      lines: [
        L(rel(lvp, F.s4.lvp, 0.002), 'Angebotspreis: ' + (fin(lvp) ? fm(lvp) + ' € netto ' + (rel(lvp, F.s4.lvp, 0.002) ? 'passt zum Gesamtauftrag' : 'passt nicht zum Gesamtauftrag (Material, Zuschläge und Rabatt prüfen)') : 'fehlt'), 25),
        L(fin(bep) && bep > 0 && bep < P.menge, 'Break-even: ' + (fin(bep) ? fm(bep, 0) + ' Stück, ' + (bep < P.menge ? 'unter der Liefermenge, der Auftrag lohnt sich' : 'nicht unter der Liefermenge') : 'fehlt'), 15),
        L(rel(gesamt, F.s7.gesamt, 0.002), 'Gesamtforderung: ' + (fin(gesamt) ? fm(gesamt) + ' € ' + (rel(gesamt, F.s7.gesamt, 0.002) ? 'passt zur Kette aus Preis, Buchung und Verzug' : 'passt nicht zur Kette aus Preis, Buchung und Verzug') : 'fehlt'), 20),
        L(gewOk, 'Gewinn des Auftrags: ' + (fin(gew) ? fm(gew) + ' € (' + (fin(pct) ? fm(pct) : '?') + ' % der Selbstkosten) ' + (gewOk ? 'erfüllt die Vorgabe' : (gew > 0 ? 'liegt unter dem verlangten Mindestgewinn' : 'ist kein Gewinn')) : 'fehlt'), 25),
        L(fin(gew) && Math.abs(gew - F.s8.gewinn) <= 0.5 * t, 'Gewinn stimmt mit der Kette überein: ' + (fin(gew) ? (Math.abs(gew - F.s8.gewinn) <= 0.5 * t ? 'ja' : 'nein, ein früherer Wert weicht vom Gesamtauftrag ab') : 'fehlt'), 15)
      ],
      kpis: [{ key: 'angebot', label: 'Angebotspreis netto', value: fin(lvp) ? lvp : null, unit: '€', ok: rel(lvp, F.s4.lvp, 0.002) },
        { key: 'bep', label: 'Break-even-Menge', value: fin(bep) ? bep : null, unit: 'Stück', ok: fin(bep) && bep < P.menge },
        { key: 'zins', label: 'Verzugszinsen', value: fin(zins) ? zins : null, unit: '€', ok: fin(zins) && Math.abs(zins - F.s7.zins) <= 0.05 * t },
        { key: 'gewinn', label: 'Gewinn des Auftrags', value: fin(gew) ? gew : null, unit: '€', ok: gewOk },
        { key: 'gewpct', label: 'Gewinn in Prozent der Selbstkosten', value: fin(pct) ? Math.round(pct * 100) / 100 : null, unit: '%', ok: fin(pct) && pct > 0 },
        { key: 'einsparung', label: 'Ersparnis durch den Angebotsvergleich', value: fin(a) && fin(b) ? rd2(Math.abs(a - b)) : null, unit: '€', ok: fin(a) && fin(b) && Math.abs(a - b) > 0 }]
    };
  }
  function finalSolution(ctx) { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; }

  /* ---------- Bericht ---------- */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, level: 2, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
    const sl = k => vals(slotOf(ctx, k)), v1 = sl('kalk.anfrage'), v2 = sl('kalk.einkauf'), v4 = sl('kalk.kalkulation'), v5 = sl('kalk.deckung'), v6 = sl('kalk.buchung'), v7 = sl('kalk.zahlung'), v8 = sl('kalk.auswertung');
    const m = (x, d) => (fin(numOf(x)) ? fm(numOf(x), d) : '–');
    const secs = [{ h: 'Lastenheft', rows: [['Kunde', P.kunde || '–'], ['Liefermenge', fin(P.menge) ? P.menge + ' Steuerbaugruppen' : '–'], ['Bestellmenge Material', m(v1.bedarf, 0) + ' Sätze']] }];
    if (Object.keys(v2).length) secs.push({ h: 'Einkauf', rows: [['Bezugspreis Lieferer A', m(v2.bzpA) + ' €'], ['Bezugspreis Lieferer B', m(v2.bzpB) + ' €'], ['Gewählt', v2.wahl || '–'], ['Bezugspreis je Stück', m(v2.bzpStk) + ' €']] });
    if (Object.keys(v4).length) secs.push({ h: 'Kalkulation', rows: [['Herstellkosten', m(v4.hk) + ' €'], ['Selbstkosten', m(v4.sk) + ' €'], ['Zielverkaufspreis', m(v4.zvp) + ' €'], ['Angebotspreis netto', m(v4.lvp) + ' €'], ['Bruttoverkaufspreis', m(v4.brutto) + ' €']] });
    if (Object.keys(v5).length) secs.push({ h: 'Break-even', rows: [['Fixkosten', m(v5.kfix) + ' €'], ['Deckungsbeitrag je Stück', m(v5.db) + ' €'], ['Break-even-Menge', m(v5.bep, 0) + ' Stück']] });
    if (Object.keys(v6).length || Object.keys(v7).length) secs.push({ h: 'Abrechnung', rows: [['Forderung brutto', m(v6.v3) + ' €'], ['Zinstage', m(v7.tage, 0)], ['Verzugszinsen (Z = K · p · t : 36.000)', m(v7.zins) + ' €'], ['Gesamtforderung', m(v7.gesamt) + ' €']] });
    if (Object.keys(v8).length) secs.push({ h: 'Auswertung', rows: [['Selbstkosten (Ist)', m(v8.skIst) + ' €'], ['Gewinn des Auftrags', m(v8.gewinn) + ' €'], ['Gewinn in Prozent', m(v8.gewPct) + ' %'], ['Abweichung vom Plan', m(v8.abw) + ' €']] });
    return secs;
  }

  const def = {
    id: PID, name: 'Auftrag kalkulieren und abrechnen', icon: '🧾', prefix: 'vc', order: 10, beruf: ['ik'],
    story: 'Die Tonfunk GmbH Ermsleben bekommt eine Anfrage für eine Serie Steuerbaugruppen. Du begleitest den Auftrag im Büro vom ersten Schreiben bis zur letzten Zahlung. Du vergleichst Lieferer, schließt den Kaufvertrag, kalkulierst den Preis und buchst Einkauf und Verkauf. Zahlt der Kunde zu spät, rechnest du Verzugszinsen aus. Am Ende weißt du, ob der Auftrag wirklich Gewinn gebracht hat.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['kal', 'buc', 'rec'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vcF', title: 'Abschlusstest: Der Auftrag im Ganzen', check: finalCheck, solution: finalSolution,
      mutants: [{ name: 'Angebotspreis zu hoch', mutate: s => { s['kalk.kalkulation'].vals.lvp = rd2(s['kalk.kalkulation'].vals.lvp * 1.05); return s; }, expectFail: ['Angebotspreis'] },
        { name: 'Break-even über der Liefermenge', mutate: s => { s['kalk.deckung'].vals.bep = 99999; return s; }, expectFail: ['Break-even'] },
        { name: 'Gesamtforderung ohne Zinsen', mutate: s => { s['kalk.zahlung'].vals.gesamt = s['kalk.buchung'].vals.v3; return s; }, expectFail: ['Gesamtforderung'] }] },
    kpis: ['angebot', 'bep', 'zins', 'gewinn', 'gewpct', 'einsparung'], report: reportParts,
    demos: [{ id: 'bis4', name: 'Auftrag bis zur Kalkulation', upTo: 'vc4' }, { id: 'fertig', name: 'Auftrag fertig abgerechnet', upTo: 'vcF' }],
    _test: { FACH: FACH, rd2: rd2, bezug: bezug, sollS2: sollS2, sollS3: sollS3, sollS4: sollS4, sollS5: sollS5, sollS6: sollS6, sollS7: sollS7, sollS8: sollS8, ist: ist, forward: forward, prev: prev, civ: civ, ymd: ymd, tageSoll: tageSoll, sollBedarf: sollBedarf }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
