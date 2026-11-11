/* verbunddata-versand.js - Verbundprojekt "Kundenauftrag vom Wareneingang bis zur Rampe" (Kennung versand, Kürzel vk, Beruf fll)
 * Alle Stationen sind Hub-Stationen (on: 'vb', Typ vb.form): Formular mit Rechen- und Auswahlfeldern, dazu Lab-Aufgaben aus wfl, lag, lad.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition. Keine Kerne nötig (die Formeln sind hier nachgebaut und im Test gegen lagcore/wflcore/ladcore geprüft).
 *
 * FÜR DIE INTEGRATION
 *  Startseite/Suche (ein Satz): "Kundenauftrag von der Anlieferung bis zur Rampe: Ware prüfen, einlagern, Bestand bewerten, Paletten packen, Stapler und Ladungssicherung rechnen, Papiere erstellen."
 *  Berufskürzel: fll (Fachkraft für Lagerlogistik). Präfix vk, order 9. Projekttitel: "Kundenauftrag vom Wareneingang bis zur Rampe".
 *  Abzeichen-Vorschlag: Symbol 🚚, Name "Rampenprofi", Text "Du hast einen Kundenauftrag vom Wareneingang bis zur Rampe durchgerechnet."
 *  Verwendete Lab-Aufgaben: vk1 wfl40 · vk2 wfl1 wfl5 · vk3 lag24 lag30 · vk4 lag2 lag10 · vk5 wfl13 wfl16 · vk6 wfl20 wfl22 · vk7 lad5 lad14 · vk8 wfl30 lad32 (je min 70 %).
 *
 * FORMELN (alle Zahlen sind Übungswerte; Beispiel = Stufe 1, von Hand nachgerechnet)
 *  Kartons          K = aufrunden(Sets / Sets je Karton)                          830 / 12 = 69,2 -> 70
 *  Lagen            n = abrunden((Höhe - 144 mm) / Kartonhöhe), höchstens abrunden((Palettenlimit - 25 kg) / (Kartons je Lage · kg je Karton))
 *                   Versand (Höhe 1200 mm): min(4, 5) = 4        Lager (Fachhöhe 1500 mm): min(5, 5) = 5
 *  Palette brutto   25 kg + Kartons · kg je Karton                                 25 + 24 · 15 = 385 kg
 *  Flächenlast      Stapelzahl · Palette brutto / 0,96 m²                          2 · 475 / 0,96 = 989,6 kg/m²
 *  Meldebestand     Jahresverbrauch / 360 · Lieferzeit + Sicherheitsbestand        1800 / 360 · 6 + 30 = 60
 *  Umschlag         Jahresverbrauch / Ø Bestand, Lagerdauer = 360 / Umschlag       1800 / 70 = 25,7 ; 360 / 25,7 = 14,0 Tage
 *  Stapler          Resttragfähigkeit = abrunden(Nennlast · 500 / Lastschwerpunkt) (gilt ab Schwerpunkt über 500 mm, Hubhöhe aus Tabelle)  2400 · 500 / 600 = 2000 kg
 *  Ladungssicherung Sicherungskraft F = m · 9,81 · (c - µ)  (c vorwärts 0,8, seitlich 0,5)    1125 · 9,81 · 0,5 = 5518 N = 551,8 daN
 *                   Direktzurren n = aufrunden(F / (LC · 10))   Niederzurren n = aufrunden(F / (2 · µ · STF · 10 · sin 90°))
 *                   F = 5518 N, LC 500 daN: 2 Gurte ; µ 0,3, STF 400 daN: 5518 / 2400 = 2,3 -> 3 Gurte
 *  Fracht           Paletten · Preis je Palette · (1 + Zuschlag)                   3 · 70 · 1,10 = 231,00 EUR
 *
 * ZUR FACHLICHEN FREIGABE (Annahmen A)
 *  (A1) Europalette 1200 x 800 mm, Eigengewicht 25 kg, Höhe 144 mm, Stellfläche 0,96 m².
 *  (A2) Zulässiges Palettengewicht (palMax) und Höhenlimits (Versand 1200 mm, Regalfach 1500 mm) sind Übungswerte; im Betrieb gelten Fachlast- und Regalschilder.
 *  (A3) Angebrochene Kartons zählen mit vollem Gewicht (sichere Seite). Der Wareneingang deckt den Auftrag mengenmäßig ab (Nachschub in Auftragshöhe).
 *  (A4) Reibbeiwerte (trocken 0,45, nass 0,30, Antirutschmatte 0,60), Beschleunigungsbeiwerte (vorwärts 0,8, seitlich 0,5), g = 9,81 m/s² wie im Ladungs-Lab.
 *       Direkt- und Niederzurren stark vereinfacht: kein Zurrwinkel (90° beim Niederzurren), keine Ratschenverluste, kein Faktor für Schlingenzurren. NUR zum Üben,
 *       für die Praxis gilt EN 12195-1 bzw. VDI 2700 mit Betriebsanweisung. Der Text sagt das auch den Azubis.
 *  (A5) Staplerdiagramm: Übungstabelle des Warenfluss-Labs (bis 3000 mm 2400 kg, bis 4000 mm 2100 kg, bis 5000 mm 1800 kg bei 500 mm Schwerpunkt). Echte Werte nur vom Typenschild.
 *       Doppelaufnahme: zwei Paletten hintereinander, Lastschwerpunkt = halbe Gesamttiefe (n · 600 mm).
 *  (A6) Lieferbedingung vereinfacht: "frei Haus" = Verkäufer trägt die Fracht, "ab Werk" = Kunde trägt sie.
 *  (A7) Frachttarif: Preis je Palette plus Zuschlag in Prozent, frei erfunden. Papiere und Verantwortung wie im Warenfluss- und Ladungs-Lab vereinfacht (§ 412 HGB nur als Hinweis).
 *  (A8) Meldebestand ohne Mengenrundung, Zinsjahr 360 Tage wie im Lager-Lab; Bestellung wird ausgelöst, wenn der Bestand den Meldebestand erreicht oder unterschreitet.
 */
(function (root) {
  'use strict';
  const PID = 'versand';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const numOf = v => { if (fin(v)) return v; const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const LVL = ctx => (ctx && (ctx.level === 1 || ctx.level === 3) ? ctx.level : 2);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) { let d = null; if (ctx) { try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; } if (d == null && isObj(ctx.slots)) d = ctx.slots[slot]; } return d == null ? null : unwrap(d); }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  const safe = (fn, label) => function (data, ctx) { try { return { lines: fn(data, ctx || {}) }; } catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich', 100)] }; } };
  const vals = d => (isObj(d) && isObj(d.vals) ? d.vals : {});
  const ceilN = x => Math.ceil(x - 1e-9);
  const floorN = x => Math.floor(x + 1e-9);
  const r2 = x => Math.round(x * 100) / 100;
  const r1 = x => Math.round(x * 10) / 10;
  /* eigener Wert aus einer Vorstation; fehlt er, gilt der Sollwert (Folgefehler werden so nicht doppelt bestraft) */
  const own = (ctx, slot, key, fb) => { const d = slotOf(ctx, slot); const x = d ? numOf(vals(d)[key]) : NaN; return fin(x) ? x : fb; };
  const pos = (x, fb) => (fin(x) && x > 0 ? x : fb);

  function numLine(label, x, soll, rel, unit, dec, pts) {
    x = numOf(x); const ok = fin(x) && fin(soll) && Math.abs(x - soll) <= rel * Math.abs(soll) + 1e-9;
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function intLine(label, x, soll, unit, pts, kleinTxt, grossTxt) {
    x = numOf(x); const ok = fin(x) && fin(soll) && x === soll;
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, 0) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' + (kleinTxt ? ' (' + kleinTxt + ')' : '') : ' ist zu groß' + (grossTxt ? ' (' + grossTxt + ')' : ''))) : 'kein Wert'), pts);
  }
  function selLine(label, x, soll, okTxt, badTxt, pts) {
    const ok = typeof x === 'string' && x === soll;
    return L(ok, label + ': ' + (typeof x === 'string' && x ? (ok ? okTxt : badTxt) : 'keine Auswahl'), pts);
  }
  function taskLines(st, data, ptsAll) {
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };
  const opts = list => list.map(o => ({ value: o[0], label: o[1] }));
  const MON = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function dayStr(n) { let m = 0; while (m < 11 && n > MON[m]) { n -= MON[m]; m++; } return (n < 10 ? '0' : '') + n + '.' + (m + 1 < 10 ? '0' : '') + (m + 1) + '.'; }

  /* ---------- Fachwerte (Übungswerte, Annahmen A1 bis A6) ---------- */
  const FACH = {
    tara: 25, palH: 144, palFl: 0.96, palTiefe: 1200, hMax: 1200, hFach: 1500, g: 9.81, jahr: 360,
    mu: { holz: 0.45, holzn: 0.3, matte: 0.6 },
    muName: { holz: 'Holzpalette auf Siebdruck-Ladeboden, trocken', holzn: 'Holzpalette auf Siebdruck-Ladeboden, nass', matte: 'Holzpalette auf Antirutschmatte' },
    cV: 0.8, cS: 0.5, alpha: 90, c0: 500,
    hub: [{ bis: 3000, q: 2400 }, { bis: 4000, q: 2100 }, { bis: 5000, q: 1800 }],
    mangel: {
      reifen: 'Ein Reifen ist eingeschnitten, das Gewebe ist zu sehen.',
      hydro: 'Ein Hydraulikschlauch ist feucht, am Boden liegen Öltropfen.',
      gabel: 'Eine Gabelzinke ist sichtbar verbogen, am Zinkenrücken ist ein Riss.',
      bremse: 'Das Bremspedal lässt sich fast bis zum Boden treten.',
      hupe: 'Die Hupe gibt keinen Ton von sich.',
      lenkung: 'Das Lenkrad hat viel Spiel, der Stapler zieht nach links.',
      gurt: 'Der Rückhaltegurt klemmt und lässt sich nicht ausziehen.',
      batt: 'Der Batteriestecker sitzt lose, an einem Kabel ist die Isolierung angeschmort.',
      keiner: 'Alle Prüfpunkte sind in Ordnung: Reifen, Schläuche, Zinken, Bremse, Hupe, Lenkung, Gurt und Batterie.'
    },
    artikel: ['Dichtungssatz', 'Anschlussset', 'Kabelsatz', 'Lagersatz']
  };

  /* ---------- Lastenheft ---------- */
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x7665726b), one = level === 1, v = (fix, list) => (one ? fix : pick(r, list));
    const p = {
      artikel: v('Dichtungssatz', FACH.artikel), setsK: v(12, [10, 12, 15]), sets: v(830, [430, 590, 710, 850, 970]),
      kgK: v(15, [12, 15, 18, 20, 24]), proLage: v(6, [4, 6, 8]), hK: v(250, [200, 250, 300]),
      pSet: v(9.5, [8.9, 9.5, 11.5, 12.8]), ekSet: v(6, [5.5, 6, 7.5, 8]),
      lieferung: v('frei Haus', ['frei Haus', 'ab Werk']),
      fehl: v(2, [0, 1, 2, 3, 4]), schad: v(1, [0, 1, 2]),
      palMax: v(500, [500, 550, 600]), stapel: v(2, [2, 3]), boden: v(1500, [1000, 1500, 2000]),
      dA: v(45, [30, 45, 60, 75, 90]), gap: v(35, [20, 35, 50]),
      V: v(1800, [1440, 1800, 2160, 2880, 3600]), lief: v(6, [5, 6, 8, 10]), sb: v(30, [20, 30, 40]),
      ab: v(80, [60, 80, 100]), eb: v(60, [40, 60, 80]),
      nPal: v(1, [1, 2]), hHub: v(2500, [2500, 3500, 4500]),
      mangel: v('hydro', ['reifen', 'hydro', 'gabel', 'bremse', 'hupe', 'lenkung', 'gurt', 'batt', 'keiner']),
      bodenArt: v('holzn', ['holz', 'holzn', 'matte']), LC: v(500, [500, 750, 1000]), STF: v(400, [300, 400, 500]), gurte: v(2, [2, 3, 4, 5, 6]),
      palPreis: v(70, [62, 70, 78]), zuschlag: v(10, [8, 10, 12])
    };
    if (p.fehl === 0 && p.schad === 0) p.schad = 1;
    const meld = p.V / FACH.jahr * p.lief + p.sb;
    p.b0 = one ? 62 : Math.max(20, Math.round(meld + pick(r, [-8, -2, 3, 9, 15, 24])));
    p.dB = p.dA + p.gap;
    const K = kartons(p), lg = lagenVersand(p), lgL = lagenLager(p);
    const t = [
      'Projekt Kundenauftrag vom Wareneingang bis zur Rampe, Stufe ' + level + '. Alle Zahlen sind Übungswerte (A).',
      'Auftrag: ' + p.sets + ' Sets "' + p.artikel + '", je ' + p.setsK + ' Sets in einem Karton (angebrochene Kartons zählen voll), Karton ' + p.kgK + ' kg schwer und ' + p.hK + ' mm hoch, ' + p.proLage + ' Kartons je Lage auf der Palette.',
      'Preise: Verkauf ' + fm(p.pSet, 2) + ' EUR je Set, Einkauf ' + fm(p.ekSet, 2) + ' EUR je Set. Lieferbedingung: ' + p.lieferung + ' (A: frei Haus = Verkäufer zahlt die Fracht, ab Werk = Kunde zahlt sie).',
      'Wareneingang: Der Lieferschein nennt so viele Kartons, wie der Auftrag braucht. Beim Zählen ergibt sich eine Fehlmenge von ' + p.fehl + ' Kartons, ' + p.schad + ' Kartons sind auf dem Transport zerdrückt.',
      'Palette: Europalette 1200 x 800 mm, leer 25 kg, 144 mm hoch, 0,96 m² Stellfläche (A). Zulässiges Gewicht je Palette ' + p.palMax + ' kg. Versandhöhe höchstens ' + FACH.hMax + ' mm, Regalfach ' + FACH.hFach + ' mm hoch.',
      'Lager: Im Blocklager stehen ' + p.stapel + ' Paletten übereinander, der Boden trägt ' + p.boden + ' kg je m². Altbestand: Charge A eingelagert am ' + dayStr(p.dA) + ', Charge B am ' + dayStr(p.dB) + '.',
      'Bestand: Vor dem Wareneingang liegen ' + p.b0 + ' Kartons im Lager. Jahresverbrauch ' + p.V + ' Kartons, Lieferzeit ' + p.lief + ' Tage, Sicherheitsbestand ' + p.sb + ' Kartons, Jahresanfangsbestand ' + p.ab + ', Jahresendbestand ' + p.eb + ' Kartons, Zinsjahr ' + FACH.jahr + ' Tage.',
      'Stapler: Die Paletten werden aus ' + p.hHub + ' mm Hubhöhe geholt. Aufnahme: ' + (p.nPal > 1 ? 'bis zu ' + p.nPal + ' Paletten hintereinander auf langen Gabeln (Lastschwerpunkt = halbe Gesamttiefe)' : 'eine Palette längs auf die Gabeln') + '. Tragfähigkeit laut Übungsdiagramm: bis 3000 mm Hub 2400 kg, bis 4000 mm 2100 kg, bis 5000 mm 1800 kg, jeweils bei 500 mm Lastschwerpunkt (A). Echte Werte stehen nur auf dem Typenschild.',
      'Beim Rundgang vor der Schicht fällt dir am Stapler auf: ' + FACH.mangel[p.mangel],
      'Ladungssicherung (nur Übungsformeln, nicht für die Praxis): ' + FACH.muName[p.bodenArt] + '. Reibbeiwerte: trocken 0,45, nass 0,30, Antirutschmatte 0,60. Beschleunigung vorwärts 0,8 g, seitlich 0,5 g, g = 9,81 m/s². Zurrgurt LC ' + p.LC + ' daN (Direktzurren), Vorspannkraft STF ' + p.STF + ' daN (Niederzurren, Gurtwinkel 90 Grad). Bereit liegen ' + p.gurte + ' Gurte.',
      'Fracht: ' + fm(p.palPreis, 2) + ' EUR je Palette plus ' + p.zuschlag + ' % Zuschlag (A).'
    ];
    if (one) t.push('Hilfen (Stufe 1): Kartons = Sets / Sets je Karton, aufrunden. Lagen = freie Höhe / Kartonhöhe, abrunden; beachte auch das Palettengewicht. Meldebestand = Tagesverbrauch · Lieferzeit + Sicherheitsbestand. Zurrkraft = m · g · (c - µ) in N, 10 N = 1 daN.');
    if (level === 3) t.push('Stufe 3: Gib bei der Ladungssicherung auch die Sicherungskraft zur Seite an. Die Toleranzen sind enger.');
    return { params: p, text: t };
  }

  /* ---------- Soll-Funktionen (check, solution, Tipps und Gesamttest benutzen dieselben) ---------- */
  const kartons = P => ceilN(P.sets / P.setsK);
  const ekK = P => P.ekSet * P.setsK;
  const lagenGew = P => floorN((P.palMax - FACH.tara) / (P.proLage * P.kgK));
  const lagenH = (P, h) => floorN((h - FACH.palH) / P.hK);
  const lagenVersand = P => Math.min(lagenH(P, FACH.hMax), lagenGew(P));
  const lagenLager = P => Math.min(lagenH(P, FACH.hFach), lagenGew(P));
  const palBrutto = (P, lagen) => FACH.tara + P.proLage * lagen * P.kgK;
  const meldeSoll = P => P.V / FACH.jahr * P.lief + P.sb;
  const hubQ = h => { const e = FACH.hub.find(x => h <= x.bis); return e ? e.q : NaN; };
  const restCap = (Q, c) => (c <= FACH.c0 ? Q : floorN(Q * FACH.c0 / c));
  const secN = (m, c, mu) => Math.max(0, m * FACH.g * (c - mu));                 // Sicherungskraft in N
  const direkt = (m, mu, LC) => ceilN(secN(m, FACH.cV, mu) / (LC * 10));
  const nieder = (m, mu, STF) => { const F = secN(m, FACH.cV, mu); return mu > 0 ? (F === 0 ? 0 : ceilN(F / (2 * mu * STF * 10 * Math.sin(FACH.alpha * Math.PI / 180)))) : NaN; };
  const fracht = (n, P) => r2(n * P.palPreis * (1 + P.zuschlag / 100));
  const befundOf = P => (P.fehl > 0 && P.schad > 0 ? 'beides' : P.fehl > 0 ? 'menge' : 'schaden');
  const idealK = P => kartons(P);
  const idealE = P => kartons(P) - P.fehl - P.schad;

  /* Kette der Sollwerte aus dem Lastenheft allein (Gesamttest, Bericht, Tests) */
  function ideal(P) {
    const K = kartons(P), E = idealE(P), lgV = lagenVersand(P), kPal = P.proLage * lgV, pal = ceilN(K / kPal);
    const schwerste = FACH.tara + Math.min(K, kPal) * P.kgK, gesamt = K * P.kgK + pal * FACH.tara;
    const nG = Math.min(P.nPal, pal), last = nG * schwerste, c = nG * FACH.palTiefe / 2, rest = restCap(hubQ(P.hHub), c), darf = last <= rest;
    const mu = FACH.mu[P.bodenArt], fahrten = darf ? ceilN(pal / nG) : pal;
    return { K: K, E: E, lgV: lgV, kPal: kPal, pal: pal, schwerste: schwerste, gesamt: gesamt, nG: nG, last: last, c: c, rest: rest, darf: darf, fahrten: fahrten,
      mu: mu, nDir: direkt(gesamt, mu, P.LC), nNied: nieder(gesamt, mu, P.STF), fracht: fracht(pal, P), meld: meldeSoll(P), nach: P.b0 + E - K };
  }

  /* ============================== Station 1: Auftrag lesen ============================== */
  const BED = opts([['wir', 'Wir tragen die Frachtkosten'], ['kunde', 'Der Kunde trägt die Frachtkosten']]);
  function checkAuftrag(data, ctx) {
    const P = P_(ctx), v = vals(data), K = kartons(P), kOwn = numOf(v.kartons), kgSoll = pos(kOwn, K) * P.kgK;
    return [
      intLine('Kartons im Auftrag', v.kartons, K, 'Kartons', 20, 'angebrochene Kartons zählen mit', 'es reicht, den letzten Karton nur aufzurunden'),
      numLine('Auftragswert (Verkauf)', v.wert, P.sets * P.pSet, 0.01 * TOL(ctx), 'EUR', 2, 16),
      numLine('Gewicht der Kartons', v.kg, kgSoll, 0.01 * TOL(ctx), 'kg', 0, 16),
      selLine('Lieferbedingung', v.bed, P.lieferung === 'frei Haus' ? 'wir' : 'kunde', 'Zuordnung stimmt', 'die Frachtkosten trägt die andere Seite', 18)
    ].concat(taskLines(STATIONS[0], data, 30));
  }

  /* ============================== Station 2: Wareneingang prüfen ============================== */
  const BEFUND = opts([['ok', 'Menge stimmt und Ware unbeschädigt'], ['menge', 'Nur eine Fehlmenge'], ['schaden', 'Nur ein Transportschaden'], ['beides', 'Fehlmenge und Transportschaden']]);
  const SCHRITT = opts([['vermerk', 'Abweichung vor der Abfahrt des Fahrers auf dem Lieferschein vermerken, beschädigte Ware sperren, Einkauf informieren'], ['einlagern', 'Alles einlagern und später nachsehen'], ['verpacken', 'Beschädigte Kartons neu verpacken, damit nichts auffällt'], ['nichts', 'Nichts tun, der Lieferant merkt das schon']]);
  function checkEingang(data, ctx) {
    const P = P_(ctx), v = vals(data), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P)), gezSoll = K - P.fehl, gOwn = pos(numOf(v.gez), gezSoll);
    const eSoll = gOwn - P.schad, eOwn = fin(numOf(v.ein)) ? numOf(v.ein) : eSoll;
    return [
      intLine('Gezählte Kartons', v.gez, gezSoll, 'Kartons', 12, 'es fehlen Kartons gegenüber dem Lieferschein', 'mehr als der Lieferschein kann nicht angekommen sein'),
      intLine('Einlagerbare Kartons', v.ein, eSoll, 'Kartons', 14, 'beschädigte Kartons dürfen nicht abgezogen werden', 'beschädigte Kartons zählen nicht zum Bestand'),
      numLine('Wert der Abweichung (Einkaufswert)', v.abw, (K - eOwn) * ekK(P), 0.02 * TOL(ctx), 'EUR', 2, 12),
      selLine('Befund', v.befund, befundOf(P), 'Befund stimmt', 'vergleiche Lieferschein, Zählung und Zustand noch einmal', 16),
      selLine('Erster Schritt', v.schritt, 'vermerk', 'richtig: solange der Fahrer noch da ist, wird festgehalten', 'so geht Beweis oder Anspruch verloren', 16)
    ].concat(taskLines(STATIONS[1], data, 30));
  }

  /* ============================== Station 3: Einlagern ============================== */
  const FIFO = opts([['A', 'Charge A'], ['B', 'Charge B'], ['neu', 'Die neu eingelagerte Charge']]);
  const JN = opts([['ja', 'ja'], ['nein', 'nein']]);
  function checkLager(data, ctx) {
    const P = P_(ctx), v = vals(data), E = own(ctx, 'versand.eingang', 'ein', idealE(P)), lgS = lagenLager(P), lgO = numOf(v.lagen);
    const lg = fin(lgO) && lgO >= 1 && Math.floor(lgO) === lgO ? lgO : lgS, kPal = P.proLage * lg, brS = FACH.tara + kPal * P.kgK, brO = pos(numOf(v.brutto), brS);
    const flS = P.stapel * brO / FACH.palFl, flO = pos(numOf(v.flaeche), flS);
    return [
      intLine('Lagen je Lagerpalette', v.lagen, lgS, 'Lagen', 12, 'Platz verschenkt', 'Höhe oder Palettengewicht passen nicht mehr'),
      intLine('Lagerpaletten', v.pal, ceilN(E / kPal), 'Paletten', 12, 'die letzte angefangene Palette zählt mit', 'eine Palette weniger würde reichen'),
      numLine('Gewicht einer vollen Lagerpalette', v.brutto, brS, 0.01 * TOL(ctx), 'kg', 0, 12),
      numLine('Flächenlast im Blocklager', v.flaeche, flS, 0.02 * TOL(ctx), 'kg/m²', 0, 14),
      selLine('Bodentragfähigkeit', v.bodenok, flO <= P.boden ? 'ja' : 'nein', 'Beurteilung stimmt', 'vergleiche mit der zulässigen Bodenlast', 10),
      selLine('FIFO-Entnahme', v.fifo, P.dA < P.dB ? 'A' : 'B', 'richtig: zuerst eingelagert, zuerst entnommen', 'FIFO heißt: der älteste Eingang geht zuerst raus', 10)
    ].concat(taskLines(STATIONS[2], data, 30));
  }

  /* ============================== Station 4: Bestand und Kennzahlen ============================== */
  function checkBestand(data, ctx) {
    const P = P_(ctx), v = vals(data), E = own(ctx, 'versand.eingang', 'ein', idealE(P)), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P));
    const oeS = (P.ab + P.eb) / 2, oe = pos(numOf(v.oe), oeS), uS = P.V / oe, u = pos(numOf(v.umschlag), uS), mS = meldeSoll(P), m = pos(numOf(v.meld), mS);
    const nS = P.b0 + E - K, n = fin(numOf(v.nach)) ? numOf(v.nach) : nS;
    return [
      intLine('Bestand nach der Auslieferung', v.nach, nS, 'Kartons', 12, 'Eingang plus Altbestand minus Auslieferung', 'Eingang plus Altbestand minus Auslieferung'),
      numLine('Durchschnittlicher Lagerbestand', v.oe, oeS, 0.01 * TOL(ctx), 'Kartons', 1, 10),
      numLine('Umschlagshäufigkeit', v.umschlag, uS, 0.02 * TOL(ctx), 'mal je Jahr', 1, 12),
      numLine('Durchschnittliche Lagerdauer', v.dauer, FACH.jahr / u, 0.02 * TOL(ctx), 'Tage', 1, 10),
      numLine('Meldebestand', v.meld, mS, 0.01 * TOL(ctx), 'Kartons', 0, 14),
      selLine('Bestellung auslösen', v.bestellen, n <= m ? 'ja' : 'nein', 'Entscheidung passt zu deinem Bestand', 'vergleiche den Bestand mit dem Meldebestand', 12)
    ].concat(taskLines(STATIONS[3], data, 30));
  }

  /* ============================== Station 5: Kommissionieren und Verpacken ============================== */
  function checkPalette(data, ctx) {
    const P = P_(ctx), v = vals(data), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P)), lgS = lagenVersand(P), lgO = numOf(v.lagen);
    const lg = fin(lgO) && lgO >= 1 && Math.floor(lgO) === lgO ? lgO : lgS, kPalS = P.proLage * lg, kPalO = pos(numOf(v.kpal), kPalS), pal = pos(numOf(v.pal), ceilN(K / kPalO));
    return [
      intLine('Lagen je Versandpalette', v.lagen, lgS, 'Lagen', 12, 'Platz verschenkt', 'Höhe oder Palettengewicht passen nicht mehr'),
      numLine('Höhe der Versandpalette', v.hoehe, FACH.palH + lg * P.hK, 0.01 * TOL(ctx), 'mm', 0, 8),
      intLine('Kartons je Palette', v.kpal, kPalS, 'Kartons', 10, 'Kartons je Lage mal Lagen', 'Kartons je Lage mal Lagen'),
      intLine('Anzahl Paletten', v.pal, ceilN(K / kPalO), 'Paletten', 14, 'die letzte angefangene Palette zählt mit', 'eine Palette weniger würde reichen'),
      numLine('Gewicht der schwersten Palette', v.schwer, FACH.tara + Math.min(K, kPalO) * P.kgK, 0.01 * TOL(ctx), 'kg', 0, 12),
      numLine('Gewicht der Sendung', v.gesamt, K * P.kgK + pal * FACH.tara, 0.01 * TOL(ctx), 'kg', 0, 14)
    ].concat(taskLines(STATIONS[4], data, 30));
  }

  /* ============================== Station 6: Stapler ============================== */
  const PRUEF = opts([['sperren', 'Stapler nicht benutzen, sperren und kennzeichnen (Schild, Schlüssel abziehen), Mangel melden, nicht selbst reparieren'], ['fahren', 'Stapler darf fahren, es liegt kein Mangel vor'], ['spaeter', 'Erst die Schicht fahren und den Mangel danach melden'], ['selbst', 'Mangel selbst notdürftig beheben und weiterfahren']]);
  function checkStapler(data, ctx) {
    const P = P_(ctx), v = vals(data), pal = own(ctx, 'versand.palette', 'pal', ideal(P).pal), sw = own(ctx, 'versand.palette', 'schwer', ideal(P).schwerste);
    const nG = Math.min(P.nPal, Math.max(1, Math.round(pal))), lastS = nG * sw, lastO = pos(numOf(v.last), lastS), cS = nG * FACH.palTiefe / 2, cO = pos(numOf(v.c), cS);
    const Q = hubQ(P.hHub), restS = restCap(Q, cO), restO = pos(numOf(v.rest), restS), darfO = lastO <= restO, fS = darfO ? ceilN(pal / nG) : pal;
    return [
      selLine('Prüfung vor Fahrtantritt', v.pruef, P.mangel === 'keiner' ? 'fahren' : 'sperren', P.mangel === 'keiner' ? 'richtig: ohne Mangel darfst du fahren' : 'richtig: mit Mangel wird nicht gefahren', P.mangel === 'keiner' ? 'ohne Befund gibt es keinen Grund zu sperren' : 'ein Mangel an sicherheitsrelevanten Teilen verbietet die Fahrt', 12),
      numLine('Last auf den Gabeln', v.last, lastS, 0.01 * TOL(ctx), 'kg', 0, 10),
      numLine('Lastschwerpunkt', v.c, cS, 0.01 * TOL(ctx), 'mm', 0, 10),
      numLine('Resttragfähigkeit', v.rest, restCap(Q, cO), 0.02 * TOL(ctx), 'kg', 0, 14),
      selLine('Last darf angehoben werden', v.darf, darfO ? 'ja' : 'nein', 'Urteil passt zu deinen Zahlen', 'vergleiche Last und Resttragfähigkeit', 12),
      intLine('Anzahl Fahrten', v.fahrten, fS, 'Fahrten', 12, 'zu wenig Fahrten bei dieser Aufnahme', 'es geht mit weniger Fahrten')
    ].concat(taskLines(STATIONS[5], data, 30));
  }

  /* ============================== Station 7: Ladungssicherung ============================== */
  function checkSicherung(data, ctx) {
    const P = P_(ctx), v = vals(data), I = ideal(P), m0 = own(ctx, 'versand.palette', 'gesamt', I.gesamt), mu0 = FACH.mu[P.bodenArt];
    const m = pos(numOf(v.m), m0), mu = fin(numOf(v.mu)) && numOf(v.mu) > 0 ? numOf(v.mu) : mu0, lv = LVL(ctx), ptsFs = lv >= 3 ? 8 : 0;
    const nDir = direkt(m, mu, P.LC), nNie = nieder(m, mu, P.STF), reichtS = fin(nNie) && P.gurte >= nNie;
    const out = [
      numLine('Masse der Ladung', v.m, m0, 0.01 * TOL(ctx), 'kg', 0, 6),
      numLine('Reibbeiwert', v.mu, mu0, 0.001, '', 2, 10),
      numLine('Sicherungskraft nach vorn', v.fv, secN(m, FACH.cV, mu) / 10, 0.02 * TOL(ctx), 'daN', 1, 10 + (8 - ptsFs))
    ];
    if (lv >= 3) out.push(numLine('Sicherungskraft zur Seite', v.fs, secN(m, FACH.cS, mu) / 10, 0.02 * TOL(ctx), 'daN', 1, ptsFs));
    out.push(intLine('Gurte beim Direktzurren', v.nd, nDir, 'Gurte', 12, 'zu wenig Gurte, die Ladung könnte rutschen', 'es geht mit weniger Gurten'));
    out.push(intLine('Gurte beim Niederzurren', v.nn, nNie, 'Gurte', 14, 'zu wenig Gurte, die Ladung könnte rutschen', 'es geht mit weniger Gurten'));
    out.push(selLine('Vorhandene Gurte reichen', v.reicht, reichtS ? 'ja' : 'nein', 'Urteil passt zu deiner Gurtzahl', 'vergleiche vorhandene und nötige Gurte', 10));
    return out.concat(taskLines(STATIONS[6], data, 30));
  }

  /* ============================== Station 8: Versandpapiere und Übergabe ============================== */
  const PAPIER = opts([['frachtbrief', 'Frachtbrief'], ['lieferschein', 'Lieferschein'], ['rechnung', 'Rechnung'], ['bestellung', 'Bestellung']]);
  const VERANT = opts([['verlader', 'Der Absender bzw. Verlader in seinem Auftrag; der Fahrer prüft vor der Abfahrt mit'], ['fahrer', 'Nur der Fahrer'], ['empfaenger', 'Der Empfänger']]);
  function checkPapiere(data, ctx) {
    const P = P_(ctx), v = vals(data), I = ideal(P), pal = own(ctx, 'versand.palette', 'pal', I.pal), g0 = own(ctx, 'versand.palette', 'gesamt', I.gesamt), pk = pos(numOf(v.stk), pal);
    return [
      intLine('Packstücke', v.stk, pal, 'Paletten', 14, 'jede Palette ist ein Packstück', 'Kartons auf einer Palette zählen nicht einzeln'),
      numLine('Gewicht der Sendung', v.kg, g0, 0.01 * TOL(ctx), 'kg', 0, 14),
      numLine('Frachtkosten', v.fracht, fracht(pk, P), 0.01 * TOL(ctx), 'EUR', 2, 16),
      selLine('Frachtpapier', v.papier, 'frachtbrief', 'richtig: der Frachtbrief gehört zur Beförderung', 'dieses Papier weist den Beförderungsvertrag nicht nach', 13),
      selLine('Verantwortung beim Verladen', v.verant, 'verlader', 'richtig: der Verlader sichert beförderungssicher, der Fahrer prüft mit und darf mit mangelhafter Sicherung nicht abfahren', 'die Verantwortung liegt nicht allein dort', 13)
    ].concat(taskLines(STATIONS[7], data, 30));
  }

  /* ---------- Hilfen für Musterlösungen und Mutanten ---------- */
  const MW = (d, k, f) => { d.vals[k] = f(d.vals[k]); return d; };
  const sel = (d, k, val) => { d.vals[k] = val; return d; };

  const hintsOf = (a, b, c) => [a, b, c];
  const STATIONS = [
    { id: 'vk1', lab: 'vb', cat: 'Kundenauftrag', title: 'Auftrag lesen und Mengen ableiten', level: 1,
      on: 'vb',
      text: 'Lies das Lastenheft wie einen Kundenauftrag. Rechne aus den Sets die Anzahl Kartons aus, bestimme Auftragswert und Gewicht der Kartons und ordne die Lieferbedingung zu: Wer zahlt die Fracht?',
      in: [], out: 'versand.auftrag', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wfl', id: 'wfl40', min: 70 }],
      form: [
        { key: 'kartons', label: 'Kartons im Auftrag', type: 'number', unit: 'Kartons', hint: 'angebrochene Kartons zählen mit' },
        { key: 'wert', label: 'Auftragswert (Verkauf)', type: 'number', unit: 'EUR' },
        { key: 'kg', label: 'Gewicht der Kartons', type: 'number', unit: 'kg' },
        { key: 'bed', label: 'Lieferbedingung: Wer trägt die Fracht?', type: 'select', options: BED }
      ],
      hint: hintsOf('Zuerst die Menge in Kartons, danach alles andere: Wert und Gewicht folgen aus Sets und Kartons.', 'Kartons = Sets / Sets je Karton und immer aufrunden. Wert = Sets mal Verkaufspreis. Gewicht = Kartons mal Gewicht je Karton.', 'Ein angebrochener Karton wird voll gezählt. "Frei Haus" bedeutet: Der Verkäufer organisiert und bezahlt den Transport bis zum Kunden.'),
      check: safe(checkAuftrag, 'Auftrag'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), K = kartons(P); return { vals: { kartons: K, wert: r2(P.sets * P.pSet), kg: K * P.kgK, bed: P.lieferung === 'frei Haus' ? 'wir' : 'kunde' }, tasks: tasksDone(STATIONS[0]) }; },
      mutants: [
        { name: 'Kartons abgerundet statt aufgerundet', mutate: d => MW(d, 'kartons', x => x - 1), expectFail: ['Kartons im Auftrag'] },
        { name: 'Auftragswert mit Einkaufspreis gerechnet', mutate: d => MW(d, 'wert', x => x * 0.63), expectFail: ['Auftragswert'] },
        { name: 'Frachtträger vertauscht', mutate: d => sel(d, 'bed', d.vals.bed === 'wir' ? 'kunde' : 'wir'), expectFail: ['Lieferbedingung'] },
        { name: 'Gewicht der Kartons vergessen', mutate: d => MW(d, 'kg', x => x / 2), expectFail: ['Gewicht der Kartons'] }
      ] },
    { id: 'vk2', lab: 'vb', cat: 'Kundenauftrag', title: 'Wareneingang prüfen', level: 1,
      on: 'vb',
      text: 'Die Ware kommt an. Vergleiche Lieferschein und Zählung, ziehe beschädigte Kartons ab und bewerte die Abweichung in Euro. Beantworte außerdem, was du zuerst tust.',
      in: ['versand.auftrag'], out: 'versand.eingang', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wfl', id: 'wfl1', min: 70 }, { lab: 'wfl', id: 'wfl5', min: 70 }],
      form: [
        { key: 'gez', label: 'Gezählte Kartons', type: 'number', unit: 'Kartons' },
        { key: 'ein', label: 'Einlagerbare Kartons', type: 'number', unit: 'Kartons' },
        { key: 'abw', label: 'Wert der Abweichung (Einkaufswert)', type: 'number', unit: 'EUR' },
        { key: 'befund', label: 'Befund', type: 'select', options: BEFUND },
        { key: 'schritt', label: 'Erster Schritt', type: 'select', options: SCHRITT }
      ],
      hint: hintsOf('Der Lieferschein nennt die Menge, die der Lieferant behauptet. Zählen musst du selbst.', 'Gezählt = Lieferschein minus fehlende Kartons. Einlagerbar = gezählt minus beschädigte. Wert = nicht einlagerbare Kartons mal Einkaufswert je Karton.', 'Einkaufswert je Karton = Einkaufspreis je Set mal Sets je Karton. Schäden werden festgehalten, solange der Fahrer noch da ist.'),
      check: safe(checkEingang, 'Wareneingang'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P)), g = K - P.fehl, e = g - P.schad; return { vals: { gez: g, ein: e, abw: r2((K - e) * ekK(P)), befund: befundOf(P), schritt: 'vermerk' }, tasks: tasksDone(STATIONS[1]) }; },
      mutants: [
        { name: 'beschädigte Kartons nicht abgezogen', mutate: d => MW(d, 'ein', x => x + 1), expectFail: ['Einlagerbare Kartons'] },
        { name: 'Ware zuerst eingelagert', mutate: d => sel(d, 'schritt', 'einlagern'), expectFail: ['Erster Schritt'] },
        { name: 'Befund falsch eingeordnet', mutate: d => sel(d, 'befund', 'ok'), expectFail: ['Befund'] },
        { name: 'Abweichung nur zum halben Wert', mutate: d => MW(d, 'abw', x => (x === 0 ? 50 : x / 2)), expectFail: ['Wert der Abweichung'] }
      ] },
    { id: 'vk3', lab: 'vb', cat: 'Kundenauftrag', title: 'Einlagern: Lagerplatz, Last und FIFO', level: 2,
      on: 'vb',
      text: 'Lagere die einlagerbaren Kartons ein. Bestimme die Lagen je Palette (Fachhöhe und Palettengewicht beachten), die Anzahl Paletten, die Flächenlast im Blocklager und beurteile die Bodentragfähigkeit. Welche Charge geht nach FIFO zuerst raus?',
      in: ['versand.eingang'], out: 'versand.lager', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'lag', id: 'lag24', min: 70 }, { lab: 'lag', id: 'lag30', min: 70 }],
      form: [
        { key: 'lagen', label: 'Lagen je Lagerpalette', type: 'number', unit: 'Lagen' },
        { key: 'pal', label: 'Lagerpaletten', type: 'number', unit: 'Paletten' },
        { key: 'brutto', label: 'Gewicht einer vollen Lagerpalette', type: 'number', unit: 'kg' },
        { key: 'flaeche', label: 'Flächenlast im Blocklager', type: 'number', unit: 'kg/m²' },
        { key: 'bodenok', label: 'Bodentragfähigkeit ausreichend?', type: 'select', options: JN },
        { key: 'fifo', label: 'FIFO: Welche Charge zuerst entnehmen?', type: 'select', options: FIFO }
      ],
      hint: hintsOf('Zwei Grenzen begrenzen die Lagen: die Höhe des Fachs und das erlaubte Gewicht. Die kleinere Zahl gilt.', 'Lagen aus Höhe = (Fachhöhe minus Palettenhöhe) / Kartonhöhe, abgerundet. Lagen aus Gewicht = (Limit minus Leergewicht) / (Kartons je Lage mal Kartongewicht), abgerundet. Flächenlast = Stapelzahl mal Palettengewicht / Stellfläche.', 'Paletten = einlagerbare Kartons / Kartons je Palette, aufrunden. Bodenlast mit der zulässigen Last vergleichen. FIFO: Wer zuerst kam, geht zuerst.'),
      check: safe(checkLager, 'Einlagern'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), E = own(ctx, 'versand.eingang', 'ein', idealE(P)), lg = lagenLager(P), kPal = P.proLage * lg, br = palBrutto(P, lg), fl = P.stapel * br / FACH.palFl; return { vals: { lagen: lg, pal: ceilN(E / kPal), brutto: br, flaeche: r1(fl), bodenok: fl <= P.boden ? 'ja' : 'nein', fifo: P.dA < P.dB ? 'A' : 'B' }, tasks: tasksDone(STATIONS[2]) }; },
      mutants: [
        { name: 'nur die Höhe beachtet, nicht das Gewicht', mutate: d => MW(d, 'lagen', x => x + 1), expectFail: ['Lagen je Lagerpalette'] },
        { name: 'Palettenleergewicht vergessen', mutate: d => MW(d, 'brutto', x => x - 25), expectFail: ['Gewicht einer vollen Lagerpalette'] },
        { name: 'Stapelzahl bei der Flächenlast vergessen', mutate: d => MW(d, 'flaeche', x => x / 2), expectFail: ['Flächenlast'] },
        { name: 'LIFO statt FIFO', mutate: d => sel(d, 'fifo', 'neu'), expectFail: ['FIFO-Entnahme'] }
      ] },
    { id: 'vk4', lab: 'vb', cat: 'Kundenauftrag', title: 'Bestand und Kennzahlen', level: 2,
      on: 'vb',
      text: 'Buche den Wareneingang und die Auslieferung. Berechne den Bestand danach, den durchschnittlichen Lagerbestand, Umschlagshäufigkeit, Lagerdauer und Meldebestand. Entscheide, ob eine Bestellung fällig ist.',
      in: ['versand.lager', 'versand.eingang', 'versand.auftrag'], out: 'versand.bestand', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'lag', id: 'lag2', min: 70 }, { lab: 'lag', id: 'lag10', min: 70 }],
      form: [
        { key: 'nach', label: 'Bestand nach der Auslieferung', type: 'number', unit: 'Kartons' },
        { key: 'oe', label: 'Durchschnittlicher Lagerbestand', type: 'number', unit: 'Kartons' },
        { key: 'umschlag', label: 'Umschlagshäufigkeit', type: 'number', unit: 'mal je Jahr' },
        { key: 'dauer', label: 'Durchschnittliche Lagerdauer', type: 'number', unit: 'Tage' },
        { key: 'meld', label: 'Meldebestand', type: 'number', unit: 'Kartons' },
        { key: 'bestellen', label: 'Bestellung jetzt auslösen?', type: 'select', options: JN }
      ],
      hint: hintsOf('Der Bestand ändert sich durch den Eingang (plus) und die Auslieferung (minus). Für die Kennzahlen zählt das ganze Jahr.', 'Durchschnitt = (Anfangs- plus Endbestand) / 2. Umschlag = Jahresverbrauch / Durchschnitt. Lagerdauer = 360 / Umschlag. Meldebestand = Tagesverbrauch mal Lieferzeit plus Sicherheitsbestand.', 'Tagesverbrauch = Jahresverbrauch / 360. Bestellt wird, wenn der Bestand den Meldebestand erreicht oder unterschreitet.'),
      check: safe(checkBestand, 'Bestand'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), E = own(ctx, 'versand.eingang', 'ein', idealE(P)), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P)), oe = (P.ab + P.eb) / 2, u = P.V / oe, n = P.b0 + E - K, m = meldeSoll(P); return { vals: { nach: n, oe: oe, umschlag: r2(u), dauer: r2(FACH.jahr / u), meld: m, bestellen: n <= m ? 'ja' : 'nein' }, tasks: tasksDone(STATIONS[3]) }; },
      mutants: [
        { name: 'Sicherheitsbestand im Meldebestand vergessen', mutate: d => MW(d, 'meld', x => x - 20), expectFail: ['Meldebestand'] },
        { name: 'Umschlag mit Endbestand statt Durchschnitt', mutate: d => MW(d, 'umschlag', x => x * 1.3), expectFail: ['Umschlagshäufigkeit'] },
        { name: 'Auslieferung nicht abgezogen', mutate: d => MW(d, 'nach', x => x + 40), expectFail: ['Bestand nach der Auslieferung'] },
        { name: 'Lagerdauer mit 365 statt 360 Tagen', mutate: d => MW(d, 'dauer', x => x * 365 / 360 * 1.03), expectFail: ['Durchschnittliche Lagerdauer'] }
      ] },
    { id: 'vk5', lab: 'vb', cat: 'Kundenauftrag', title: 'Kommissionieren und Palettenplan', level: 2,
      on: 'vb',
      text: 'Stelle den Auftrag zusammen und plane die Versandpaletten: Lagen je Palette (Höhe 1200 mm und Gewichtslimit), Höhe, Kartons je Palette, Anzahl Paletten, Gewicht der schwersten Palette und Gewicht der ganzen Sendung.',
      in: ['versand.auftrag', 'versand.bestand'], out: 'versand.palette', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wfl', id: 'wfl13', min: 70 }, { lab: 'wfl', id: 'wfl16', min: 70 }],
      form: [
        { key: 'lagen', label: 'Lagen je Versandpalette', type: 'number', unit: 'Lagen' },
        { key: 'hoehe', label: 'Höhe der Versandpalette', type: 'number', unit: 'mm' },
        { key: 'kpal', label: 'Kartons je Palette', type: 'number', unit: 'Kartons' },
        { key: 'pal', label: 'Anzahl Paletten', type: 'number', unit: 'Paletten' },
        { key: 'schwer', label: 'Gewicht der schwersten Palette', type: 'number', unit: 'kg' },
        { key: 'gesamt', label: 'Gewicht der Sendung', type: 'number', unit: 'kg' }
      ],
      hint: hintsOf('Die Versandhöhe ist niedriger als die Fachhöhe im Lager. Rechne die Lagen neu.', 'Lagen = kleinerer Wert aus Höhe und Gewicht. Höhe = 144 mm plus Lagen mal Kartonhöhe. Schwerste Palette = Leergewicht plus volle Palette Kartons.', 'Sendungsgewicht = alle Kartons mal Kartongewicht plus alle Paletten mal Leergewicht. Die letzte Palette ist oft nur teilweise voll.'),
      check: safe(checkPalette, 'Palettenplan'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), K = own(ctx, 'versand.auftrag', 'kartons', idealK(P)), lg = lagenVersand(P), kp = P.proLage * lg, pal = ceilN(K / kp); return { vals: { lagen: lg, hoehe: FACH.palH + lg * P.hK, kpal: kp, pal: pal, schwer: FACH.tara + Math.min(K, kp) * P.kgK, gesamt: K * P.kgK + pal * FACH.tara }, tasks: tasksDone(STATIONS[4]) }; },
      mutants: [
        { name: 'Palettenhöhe ohne die Palette selbst', mutate: d => MW(d, 'hoehe', x => x - 144), expectFail: ['Höhe der Versandpalette'] },
        { name: 'zu viele Lagen, Gewicht oder Höhe überschritten', mutate: d => MW(d, 'lagen', x => x + 1), expectFail: ['Lagen je Versandpalette'] },
        { name: 'Leergewicht der Paletten vergessen', mutate: d => MW(d, 'gesamt', x => x - 75), expectFail: ['Gewicht der Sendung'] },
        { name: 'angefangene Palette nicht mitgezählt', mutate: d => MW(d, 'pal', x => x - 1), expectFail: ['Anzahl Paletten'] }
      ] },
    { id: 'vk6', lab: 'vb', cat: 'Kundenauftrag', title: 'Stapler: Check und Tragfähigkeit', level: 3,
      on: 'vb',
      text: 'Bevor du fährst: Beurteile den Rundgang am Stapler. Dann rechne mit der schwersten Palette aus der Palettenplanung: Last auf den Gabeln, Lastschwerpunkt, Resttragfähigkeit, ob die Last hoch darf, und wie viele Fahrten nötig sind.',
      in: ['versand.palette'], out: 'versand.stapler', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wfl', id: 'wfl20', min: 70 }, { lab: 'wfl', id: 'wfl22', min: 70 }],
      form: [
        { key: 'pruef', label: 'Prüfung vor Fahrtantritt: Was tust du?', type: 'select', options: PRUEF },
        { key: 'last', label: 'Last auf den Gabeln', type: 'number', unit: 'kg' },
        { key: 'c', label: 'Lastschwerpunkt', type: 'number', unit: 'mm' },
        { key: 'rest', label: 'Resttragfähigkeit', type: 'number', unit: 'kg' },
        { key: 'darf', label: 'Last darf angehoben werden?', type: 'select', options: JN },
        { key: 'fahrten', label: 'Anzahl Fahrten', type: 'number', unit: 'Fahrten' }
      ],
      hint: hintsOf('Sicherheit zuerst: Ein sicherheitsrelevanter Mangel heißt, dass der Stapler nicht gefahren wird: sperren, kennzeichnen, melden, nicht selbst reparieren. Danach erst rechnen.', 'Der Lastschwerpunkt liegt bei gleichmäßiger Last in der halben Gesamttiefe. Die Nennlast des Diagramms gilt bei 500 mm; weiter außen sinkt sie: Nennlast mal 500 / Schwerpunkt, abgerundet.', 'Nimm die Nennlast für deine Hubhöhe aus dem Übungsdiagramm. Wenn die Last nicht hoch darf, fährst du mit jeweils nur einer Palette.'),
      check: safe(checkStapler, 'Stapler'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), I = ideal(P), pal = own(ctx, 'versand.palette', 'pal', I.pal), sw = own(ctx, 'versand.palette', 'schwer', I.schwerste), nG = Math.min(P.nPal, Math.max(1, Math.round(pal))), last = nG * sw, c = nG * FACH.palTiefe / 2, rest = restCap(hubQ(P.hHub), c), darf = last <= rest; return { vals: { pruef: P.mangel === 'keiner' ? 'fahren' : 'sperren', last: last, c: c, rest: rest, darf: darf ? 'ja' : 'nein', fahrten: darf ? ceilN(pal / nG) : pal }, tasks: tasksDone(STATIONS[5]) }; },
      mutants: [
        { name: 'trotz Mangel weitergefahren', mutate: d => sel(d, 'pruef', d.vals.pruef === 'sperren' ? 'spaeter' : 'sperren'), expectFail: ['Prüfung vor Fahrtantritt'] },
        { name: 'Lastschwerpunkt auf der Palettenkante statt in der Mitte', mutate: d => MW(d, 'c', x => x * 2), expectFail: ['Lastschwerpunkt'] },
        { name: 'Nennlast ohne Schwerpunkt-Umrechnung', mutate: d => MW(d, 'rest', x => x * 1.4), expectFail: ['Resttragfähigkeit'] },
        { name: 'Last in kg statt Palettenzahl falsch gebildet', mutate: d => MW(d, 'last', x => x / 2), expectFail: ['Last auf den Gabeln'] }
      ] },
    { id: 'vk7', lab: 'vb', cat: 'Kundenauftrag', title: 'Ladungssicherung: Reibung und Zurrmittel', level: 3,
      on: 'vb',
      text: 'Sichere die Sendung auf dem Lkw (nur Übungsformeln, in der Praxis gilt die Betriebsanweisung mit EN 12195-1). Übernimm die Masse, wähle den Reibbeiwert aus der Tabelle, berechne die Sicherungskraft und die Anzahl Gurte für Direkt- und Niederzurren. Reichen die bereitliegenden Gurte?',
      in: ['versand.palette', 'versand.stapler'], out: 'versand.sicherung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'lad', id: 'lad5', min: 70 }, { lab: 'lad', id: 'lad14', min: 70 }],
      form: [
        { key: 'm', label: 'Masse der Ladung', type: 'number', unit: 'kg' },
        { key: 'mu', label: 'Reibbeiwert', type: 'number', hint: 'Tabelle im Lastenheft' },
        { key: 'fv', label: 'Sicherungskraft nach vorn', type: 'number', unit: 'daN' },
        { key: 'fs', label: 'Sicherungskraft zur Seite (Pflicht ab Stufe 3)', type: 'number', unit: 'daN' },
        { key: 'nd', label: 'Gurte beim Direktzurren', type: 'number', unit: 'Gurte' },
        { key: 'nn', label: 'Gurte beim Niederzurren', type: 'number', unit: 'Gurte' },
        { key: 'reicht', label: 'Vorhandene Gurte reichen (Niederzurren)?', type: 'select', options: JN }
      ],
      hint: hintsOf('Die Reibung hilft mit: Du musst nur den Teil sichern, den sie nicht hält. Die Masse kommt aus deiner Palettenplanung.', 'Sicherungskraft F = m mal 9,81 mal (c minus µ) in Newton, durch 10 ergibt daN. Direktzurren: Gurte = F / (LC mal 10), aufrunden.', 'Niederzurren: Gurte = F / (2 mal µ mal STF mal 10), aufrunden (Winkel 90 Grad). Immer aufrunden, nie abrunden: Zu wenige Gurte sind ein Sicherheitsrisiko.'),
      check: safe(checkSicherung, 'Ladungssicherung'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), I = ideal(P), m = own(ctx, 'versand.palette', 'gesamt', I.gesamt), mu = FACH.mu[P.bodenArt], nn = nieder(m, mu, P.STF); return { vals: { m: m, mu: mu, fv: r2(secN(m, FACH.cV, mu) / 10), fs: r2(secN(m, FACH.cS, mu) / 10), nd: direkt(m, mu, P.LC), nn: nn, reicht: P.gurte >= nn ? 'ja' : 'nein' }, tasks: tasksDone(STATIONS[6]) }; },
      mutants: [
        { name: 'Reibbeiwert für trocken statt nass genommen', mutate: d => MW(d, 'mu', x => (x === 0.45 ? 0.6 : 0.45)), expectFail: ['Reibbeiwert'] },
        { name: 'Reibung nicht abgezogen', mutate: d => MW(d, 'fv', x => x * 2.5), expectFail: ['Sicherungskraft nach vorn'] },
        { name: 'Gurtzahl abgerundet', mutate: d => MW(d, 'nn', x => x - 1), expectFail: ['Gurte beim Niederzurren'] },
        { name: 'Direktzurren mit zu hoher Zurrkraft gerechnet', mutate: d => MW(d, 'nd', x => x - 1), expectFail: ['Gurte beim Direktzurren'] },
        { name: 'Seitenkraft mit vorwärts-Beiwert gerechnet', mutate: d => MW(d, 'fs', x => x * 3 + 10), expectFail: ['Sicherungskraft zur Seite'], minLevel: 3 }
      ] },
    { id: 'vk8', lab: 'vb', cat: 'Kundenauftrag', title: 'Versandpapiere und Übergabe', level: 2,
      on: 'vb',
      text: 'Die Sendung steht an der Rampe. Fülle die Eckdaten für die Papiere aus: Packstücke, Gewicht und Frachtkosten. Ordne das richtige Frachtpapier zu und beantworte, wer für die sichere Verladung verantwortlich ist.',
      in: ['versand.palette', 'versand.sicherung'], out: 'versand.papiere', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wfl', id: 'wfl30', min: 70 }, { lab: 'lad', id: 'lad32', min: 70 }],
      form: [
        { key: 'stk', label: 'Packstücke', type: 'number', unit: 'Paletten' },
        { key: 'kg', label: 'Gewicht der Sendung', type: 'number', unit: 'kg' },
        { key: 'fracht', label: 'Frachtkosten', type: 'number', unit: 'EUR' },
        { key: 'papier', label: 'Frachtpapier: Beförderungsvertrag nachweisen', type: 'select', options: PAPIER },
        { key: 'verant', label: 'Wer sorgt für die sichere Verladung?', type: 'select', options: VERANT }
      ],
      hint: hintsOf('Die Zahlen hast du schon: Paletten und Gewicht stehen in der Palettenplanung.', 'Fracht = Paletten mal Preis je Palette, danach der Zuschlag in Prozent. Eine Palette ist ein Packstück, die Kartons darauf zählen nicht einzeln.', 'Frachtkosten = Paletten mal Preis mal (1 plus Zuschlag / 100). Das Papier zum Beförderungsvertrag nennt Absender, Empfänger und Frachtführer.'),
      check: safe(checkPapiere, 'Versandpapiere'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), I = ideal(P), pal = own(ctx, 'versand.palette', 'pal', I.pal), g = own(ctx, 'versand.palette', 'gesamt', I.gesamt); return { vals: { stk: pal, kg: g, fracht: fracht(pal, P), papier: 'frachtbrief', verant: 'verlader' }, tasks: tasksDone(STATIONS[7]) }; },
      mutants: [
        { name: 'Kartons statt Paletten als Packstücke', mutate: d => MW(d, 'stk', x => x * 20), expectFail: ['Packstücke'] },
        { name: 'Zuschlag vergessen', mutate: d => MW(d, 'fracht', x => x / 1.1 * 0.9), expectFail: ['Frachtkosten'] },
        { name: 'Lieferschein statt Frachtbrief', mutate: d => sel(d, 'papier', 'lieferschein'), expectFail: ['Frachtpapier'] },
        { name: 'Verantwortung allein beim Fahrer', mutate: d => sel(d, 'verant', 'fahrer'), expectFail: ['Verantwortung beim Verladen'] }
      ] }
  ];

  /* ---------- Gesamttest: das fertige Ergebnis über mehrere Stationen ---------- */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
    let I; try { I = ideal(P); } catch (e) { return { lines: [L(false, 'Gesamttest: Lastenheft nicht lesbar', 100)], kpis: [] }; }
    const g = (slot, key) => { const d = slotOf(ctx, slot); return d ? numOf(vals(d)[key]) : NaN; };
    const K = g('versand.auftrag', 'kartons'), pal = g('versand.palette', 'pal'), kpal = g('versand.palette', 'kpal'), gesamt = g('versand.palette', 'gesamt');
    const mSich = g('versand.sicherung', 'm'), nNie = g('versand.sicherung', 'nn'), nDir = g('versand.sicherung', 'nd'), muS = g('versand.sicherung', 'mu');
    const kgPap = g('versand.papiere', 'kg'), stk = g('versand.papiere', 'stk'), fr = g('versand.papiere', 'fracht');
    const darf = slotOf(ctx, 'versand.stapler') ? vals(slotOf(ctx, 'versand.stapler')).darf : null, fahrten = g('versand.stapler', 'fahrten'), nach = g('versand.bestand', 'nach'), meld = g('versand.bestand', 'meld');
    const bestellen = slotOf(ctx, 'versand.bestand') ? vals(slotOf(ctx, 'versand.bestand')).bestellen : null;
    const rel = (a, b) => fin(a) && fin(b) && Math.abs(a - b) <= 0.01 * Math.abs(b) + 1e-9;
    const mengeOk = fin(pal) && fin(kpal) && fin(K) && pal * kpal >= K && (pal - 1) * kpal < K && stk === pal && K === I.K;
    const gewichtOk = rel(gesamt, I.gesamt) && rel(mSich, gesamt) && rel(kgPap, gesamt);
    const sichOk = fin(nNie) && fin(nDir) && fin(muS) && muS <= I.mu + 1e-9 && nNie >= I.nNied && nDir >= I.nDir;
    const stapOk = (darf === 'ja' || darf === 'nein') && fin(fahrten) && fahrten >= I.fahrten && (darf === 'nein' || I.darf);
    const bestOk = fin(nach) && fin(meld) && nach === I.nach && meld === I.meld && bestellen === (nach <= meld ? 'ja' : 'nein');
    const frOk = fin(fr) && fr === fracht(stk, P);
    const lines = [
      L(mengeOk, 'Mengenkette: Auftrag, Palettenplan und Packstücke passen zusammen' + (mengeOk ? '' : ' (Kartons, Paletten und Packstücke stimmen nicht überein)'), 25),
      L(gewichtOk, 'Gewichtskette: dieselbe Sendungsmasse im Palettenplan, bei der Ladungssicherung und in den Papieren' + (gewichtOk ? '' : ' (die Gewichte weichen voneinander oder vom Sollwert ab)'), 25),
      L(sichOk, 'Ladungssicherung: genug Gurte und kein zu hoher Reibbeiwert' + (sichOk ? '' : ' (zu wenige Gurte oder Reibung zu optimistisch angesetzt)'), 25),
      L(stapOk, 'Staplerfahrt: Fahrten passen zur Tragfähigkeit' + (stapOk ? '' : ' (Last oder Fahrtenzahl nicht tragbar)'), 15),
      L(bestOk && frOk, 'Bestand und Fracht: Bestandsentscheidung und Frachtkosten stimmig' + (bestOk && frOk ? '' : ' (Bestand, Meldebestand oder Fracht passen nicht)'), 10)
    ];
    const gur = fin(nNie) ? nNie : null, um = slotOf(ctx, 'versand.bestand') ? numOf(vals(slotOf(ctx, 'versand.bestand')).umschlag) : NaN;
    return { lines: lines, kpis: [
      { key: 'gewicht', label: 'Sendungsgewicht', value: fin(gesamt) ? Math.round(gesamt) : null, unit: 'kg', ok: gewichtOk },
      { key: 'paletten', label: 'Paletten', value: fin(pal) ? pal : null, unit: 'Stück', ok: mengeOk },
      { key: 'gurte', label: 'Zurrgurte (Niederzurren)', value: gur, unit: 'Stück', ok: sichOk },
      { key: 'fracht', label: 'Frachtkosten', value: fin(fr) ? fr : null, unit: 'EUR', ok: frOk },
      { key: 'umschlag', label: 'Umschlagshäufigkeit', value: fin(um) ? r1(um) : null, unit: 'mal/Jahr', ok: fin(um) },
      { key: 'meld', label: 'Meldebestand', value: fin(meld) ? meld : null, unit: 'Kartons', ok: bestOk }
    ] };
  }

  /* ---------- Bericht ---------- */
  function report(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] };
    const sec = [{ h: 'Lastenheft', rows: [['Artikel', P.artikel || '–'], ['Auftrag', (P.sets || '–') + ' Sets'], ['Lieferbedingung', P.lieferung || '–'], ['Ladeboden', FACH.muName[P.bodenArt] || '–']] }];
    const grp = [['Auftrag', 'versand.auftrag'], ['Wareneingang', 'versand.eingang'], ['Einlagerung', 'versand.lager'], ['Bestand und Kennzahlen', 'versand.bestand'], ['Palettenplan', 'versand.palette'], ['Stapler', 'versand.stapler'], ['Ladungssicherung', 'versand.sicherung'], ['Versandpapiere', 'versand.papiere']];
    grp.forEach((gr, i) => { const d = slotOf(ctx, gr[1]); if (!d) return; const st = STATIONS[i], v = vals(d); sec.push({ h: gr[0], rows: st.form.map(f => { const o = (f.options || []).find(x => x.value === v[f.key]); return [f.label, o ? o.label : (fin(numOf(v[f.key])) ? fm(numOf(v[f.key]), 2) + (f.unit ? ' ' + f.unit : '') : '–')]; }) }); });
    return sec;
  }

  const def = {
    id: PID, name: 'Kundenauftrag vom Wareneingang bis zur Rampe', icon: '🚚', prefix: 'vk', order: 9, beruf: ['fll'],
    story: 'Bei der Tonfunk GmbH Ermsleben ist ein Kundenauftrag eingegangen, und der Nachschub kommt gerade an der Rampe an. Du prüfst die Lieferung, lagerst sie ein und bewertest den Bestand. Danach packst du die Paletten, prüfst den Stapler, sicherst die Ladung und füllst die Papiere aus. Dein Ergebnis aus jeder Station geht in die nächste ein, vom Kartongewicht bis zur Zurrkraft.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['wfl', 'lag', 'lad'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vkF', title: 'Abschlusstest: Die Sendung an der Rampe', check: finalCheck },
    report: report, kpis: ['gewicht', 'paletten', 'gurte', 'fracht', 'umschlag', 'meld'],
    _test: { FACH: FACH, ideal: ideal, kartons: kartons, lagenVersand: lagenVersand, lagenLager: lagenLager, restCap: restCap, hubQ: hubQ, direkt: direkt, nieder: nieder, secN: secN, fracht: fracht, meldeSoll: meldeSoll, dayStr: dayStr }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
