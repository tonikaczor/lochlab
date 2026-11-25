/* verbunddata-kunde.js - berufsübergreifendes Verbundprojekt "Kundenbaugruppe" (Kennung kunde, Kürzel ve, Beruf 'alle', order 14).
 * Ein Kunde aus der Medizintechnik lässt eine bestückte Steuerplatine fertigen. Die Platine läuft durch den EMS-Wertstrom (Electronic Manufacturing Services,
 * Fertigung von Elektronik im Kundenauftrag): Anfrage, Beschaffung, Daten, Bestücken, Prüfmittel, Prüfen, Auswertung, Versand, Rechnung.
 * Jede Station gehört einem oder mehreren Berufen (Stationsfeld beruf); im Einzelmodus liefern "die Kollegen" die übrigen Stationen mit Musterwerten (Engine: verbund.js, Abschnitt Stations-Beruf).
 * Alle Stationen sind Hub-Stationen (on 'vb', Typ vb.form). Keine Kerne, kein Adapter. Ohne Verbund-Kern wartet die Definition in window.VERBUND_QUEUE; in Node liefert module.exports die Definition.
 * Bauweise wie verbunddata-tonfunk.js (Tonfunk-Auftrag).
 *
 * FÜR DIE INTEGRATION
 *   Startseite/Suche (ein Satz): "Kundenbaugruppe: Eine Steuerplatine für einen Kunden aus der Medizintechnik läuft durch die Elektronikfertigung: Kalkulation, Beschaffung, Daten, Bestücken, Prüfadapter, Prüfen, Auswertung, Versand und Rechnung. Du bearbeitest die Stationen deines Berufs, die Kollegen liefern den Rest."
 *   def.beruf: ['alle'] (erscheint bei jedem Ausbildungsberuf, zählt nicht für das Abzeichen vb_alle). Symbol 🩺.
 *   Abzeichen-Vorschlag (vbkunde): Symbol 🩺, Name "Für den Kunden gebaut", Text "Die Kundenbaugruppe mit den Kollegen der anderen Berufe von der Anfrage bis zur Rechnung gebracht."
 *   Labs für die Symbolreihe: ems kal wfl sql mat kon tol ssl lad buc rec.
 *   Stationen (Beruf | Lab-Aufgaben, je min 70 %):
 *     ve1 Anfrage und Kalkulation (ik, wing | ems45 ems46 kal10) . ve2 Beschaffung und Wareneingang (fll | ems21 ems24 wfl1) . ve3 Programm und Rückverfolgung (fi, winf | ems34 ems36 sql11) .
 *     ve4 Bestücken, Reflow und AOI (egs, ige | ems7 ems10 mat93) . ve5 Prüfadapter bauen (im, tpd | kon20 tol21 tol22) . ve6 Prüfen und Fehleranalyse (egs | ems13 ssl38 mat35) .
 *     ve7 Prozessauswertung (ik, tec, wing, stu | ems26 ems29 mat13) . ve8 Versand in Kundenverpackung (fll | ems19 lad21 lad25) . ve9 Rechnung (ik, wing | buc15 rec29 kal33).
 *   Nur eigenständige Labs (schreiben nach lm4.tdone); jedes Lab ist in allen Berufen seiner Station freigeschaltet (LAB_REG beruf).
 *   Hinweis: Die Wege tec, stu, wing, winf stehen an Stationen, sehen berufsübergreifende Projekte aber erst, wenn BerufReg.vbFits (aufgaben.js) und BERUF_NAME/BERUF_KURZ (verbundbar.js) sie kennen.
 *
 * FORMELN (Beispiel = Stufe 1, von Hand nachgerechnet; Geld nach jedem Schritt auf Cent)
 *   ve1  Fertigungskosten je Baugruppe = 320 . 0,02 + 24 . 0,05 + 3 . 1,50 = 6,40 + 1,20 + 4,50 = 12,10 EUR; Rüstkosten je Stück = 600 / 500 = 1,20 EUR;
 *        Kosten je Baugruppe = 18,40 + 12,10 + 1,20 = 31,70 EUR; Angebotspreis = 31,70 . 1,15 = 36,455 -> 36,46 EUR; Auftragswert = 500 . 36,46 = 18.230,00 EUR.
 *   ve2  Bedarf = aufrunden(500 . 12 . 1,02) = 6120 Stück; Rollen = aufrunden(6120 / 4000) = 2; MSL 3 = 168 h Bodenlebensdauer; Rest = 168 - 30 - 46 = 92 h >= 40 h: verarbeiten.
 *   ve3  letzte Seriennummer = 1001 + 500 - 1 = 1500; Datensätze = 500 . (45 + 3) = 24.000; Speicher = 24.000 . 120 Byte = 2,88 MB; betroffene Platinen = min(500; abrunden(4000 / 12)) = 333.
 *   ve4  FPY = 0,98 . 0,99 . 0,97 = 94,11 %; Gutteile = abrunden(500 . 0,9411) = 470; Zeit im Ofen = 3,2 / 0,8 . 60 = 240 s; Platinen je Stunde = abrunden(800 / 200 . 60) = 240; Ofenzeit für das Los = 500 / 240 = 2,08 h.
 *   ve5  Kraft je Prüfstift = 0,6 . 2,5 = 1,5 N; Kraft aller Stifte = 64 . 1,5 = 96 N; Stifte mit 10 % Reserve = aufrunden(70,4) = 71;
 *        Fangstift 3 H7/g6 (H7 +10/0 µm, g6 -2/-8 µm): Höchstspiel = 10 - (-8) = 18 µm, Mindestspiel = 0 - (-2) = 2 µm: Spielpassung.
 *   ve6  Grenzen 3,3 V +/- 3 %: 3,201 / 3,399 V; ein Messwert außerhalb; Fehlerliste 30 Platinen: Lötbrücke 13, Bauteil fehlt 8, verdreht 3, schlecht benetzt 6; häufigste Lötbrücke 13 / 30 = 43,3 %; Maßnahme Pastendruck prüfen.
 *   ve7  Nacharbeit = (500 - 470) . 4,50 = 135,00 EUR; ppm = 30 / (500 . 344) . 1.000.000 = 174,4; Anteil am Auftragswert = 135,00 / 18.230,00 . 100 = 0,74 %;
 *        Mehrkosten nach der Zehnerregel = 4 . (0,20 . 1000 - 0,20) = 799,20 EUR.
 *   ve8  Kartons = aufrunden(500 / 25) = 20; je Lage max(3 . 2; 4 . 2) = 8; Lagen = aufrunden(20 / 8) = 3; Höhe = 144 + 3 . 200 = 744 mm; Gewicht = 500 . 0,12 + 20 . 0,8 + 25 = 101,0 kg.
 *   ve9  Netto = 500 . 36,46 + 2.400,00 = 20.630,00; USt 19 % = 3.919,70; Brutto = 24.549,70; Skonto 2 % = 490,99; Zahlbetrag = 24.058,71 EUR.
 *   Gesamttest: Überschuss = 500 . (36,46 - 31,70) - 135,00 = 2.245,00 EUR.
 *
 * ANNAHMEN (A), zur fachlichen Freigabe
 *   A1  Alle Zahlen sind Übungswerte, keine Betriebswerte. Kunde ohne Namen.
 *   A2  Kalkulation wie im EMS-Lab (ems45, ems46): Bestückpunkt 0,02 EUR, THT-Lötstelle 0,05 EUR, Prüfminute 1,50 EUR, Rüstkosten auf die Liefermenge verteilt, ein Zuschlag auf die Kosten.
 *   A3  Bodenlebensdauer bei höchstens 30 °C und 60 % relativer Luftfeuchte: MSL 3 168 h, MSL 4 72 h (allgemeine Werte nach J-STD-033). Offene Zeiten werden addiert.
 *   A4  1 MB = 1.000.000 Byte. Je Platine ein Datensatz je Bauteilsorte (Los zur Seriennummer) plus die Prozessdatensätze.
 *   A5  FPY = Produkt der Stufenausbeuten, auf zwei Nachkommastellen in Prozent gerundet; Gutteile abgerundet. Alle übrigen Platinen gehen in die Nacharbeit.
 *   A6  Passungsabmaße für die Fangstifte stehen im Lastenheft (Werte aus der ISO-Passungstabelle). Federkraft = Federrate . Arbeitshub.
 *   A7  Fehler je Million Möglichkeiten: Möglichkeiten je Platine = Bestückpunkte + THT-Lötstellen.
 *   A8  Zehnerregel: Wareneingang, Fertigung, Endprüfung, Kunde, je Stufe mal 10.
 *   A9  Europalette 1200 x 800 mm, 144 mm hoch, 25 kg, kein Überstand, Ladehöhe höchstens 1200 mm; Kartons alle gleich ausgerichtet.
 *   A10 Der Kunde bezahlt den Prüfadapter einmalig mit der ersten Rechnung. Skonto vom Bruttobetrag. Buchungssatz nur mit Kontennamen.
 */
(function (root) {
  'use strict';
  const PID = 'kunde';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const numOf = v => { if (fin(v)) return v; if (v === null || v === undefined || v === '') return NaN; const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) { let d = null; if (ctx) { try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; } if (d == null && isObj(ctx.slots)) d = ctx.slots[slot]; } return d == null ? null : unwrap(d); }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  const vals = d => (isObj(d) && isObj(d.vals) ? d.vals : {});
  const r2 = x => Math.round(x * 100 + 1e-6) / 100;                 /* kaufmännisch auf Cent */
  const rd = (x, d) => { const f = Math.pow(10, d); return Math.round(x * f + 1e-9) / f; };
  const ceilE = x => Math.ceil(x - 1e-9), floorE = x => Math.floor(x + 1e-9);
  const u = (own, soll) => { const x = numOf(own); return fin(x) ? x : soll; };      /* eigener Wert, sonst Sollwert: so gibt es keine Folgefehler */
  function taskLines(st, data, ptsAll) {
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };

  /* ---------------------------------------------------------------- Fachwerte (Annahmen siehe Kopf) */
  const FACH = {
    kSmd: 0.02, kTht: 0.05, kPr: 1.5,                                /* EUR je Bestückpunkt, je THT-Lötstelle, je Prüfminute */
    bod: { 3: 168, 4: 72 },                                          /* Bodenlebensdauer in h */
    fits: [{ d: 3, w: 'g6', ES: 10, EI: 0, es: -2, ei: -8 }, { d: 4, w: 'g6', ES: 12, EI: 0, es: -4, ei: -12 }, { d: 4, w: 'h6', ES: 12, EI: 0, es: 0, ei: -8 },
      { d: 5, w: 'k6', ES: 12, EI: 0, es: 9, ei: 1 }, { d: 6, w: 'f7', ES: 12, EI: 0, es: -10, ei: -22 }],
    fehler: ['bruecke', 'fehlt', 'verdreht', 'benetz'],
    fehlerName: { bruecke: 'Lötbrücke', fehlt: 'Bauteil fehlt', verdreht: 'Bauteil verdreht', benetz: 'Lötstelle schlecht benetzt' },
    mass: { bruecke: 'spi', fehlt: 'feeder', verdreht: 'polar', benetz: 'profil' },
    muster: [[0.4, 0.27, 0.13, 0.2], [0.2, 0.4, 0.13, 0.27], [0.13, 0.2, 0.27, 0.4], [0.27, 0.13, 0.4, 0.2]],
    pal: { l: 1200, b: 800, h: 144, kg: 25 }, hMax: 1200, ust: 19
  };

  /* ---------------------------------------------------------------- Lastenheft */
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x6b756e64), e = level === 1, pk = (fix, list) => (e ? fix : pick(r, list));
    const fit = pk(FACH.fits[0], FACH.fits), kart = pk([400, 300, 200], [[400, 300, 200], [300, 200, 150], [380, 280, 180]]);
    const p = {
      stk: pk(500, [300, 400, 500, 600]), mat: pk(18.4, [16.8, 18.4, 21.2]), smd: pk(320, [280, 320, 360]), tht: pk(24, [16, 24, 30]), tPr: pk(3, [2, 3, 4]), ruest: pk(600, [450, 600, 750]), zus: pk(15, [12, 15, 18]),
      c: pk(12, [8, 12, 16]), zug: pk(2, [2, 3, 5]), rolle: pk(4000, [3000, 4000, 5000]), msl: level === 3 ? 4 : pk(3, [3, 4]), h1: pk(30, [8, 16, 24, 30]), h2: pk(46, [8, 16, 24]), tF: pk(40, [24, 40, 60]),
      sn0: pk(1001, [1001, 2001, 5001]), sorten: pk(45, [35, 45, 60]), pd: pk(3, [3, 4]), byte: pk(120, [100, 120, 150]),
      p1: pk(98, [97, 98, 99]), p2: pk(99, [98, 99]), p3: pk(97, [95, 96, 97]), lOfen: pk(3.2, [2.8, 3.2, 3.6]), vb: pk(0.8, [0.7, 0.8, 0.9]), lPl: pk(160, [120, 160, 200]), abst: pk(40, [40, 50]),
      tp: pk(64, [48, 64, 80]), cF: pk(0.6, [0.5, 0.6, 0.8]), hub: pk(2.5, [2, 2.5, 3]), res: pk(10, [5, 10]), d: fit.d, wf: fit.w, ES: fit.ES, EI: fit.EI, es: fit.es, ei: fit.ei,
      uN: pk(3.3, [3.3, 5, 12]), tolU: pk(3, [2, 3, 5]),
      kNa: pk(4.5, [3.5, 4.5, 6]), kWE: pk(0.2, [0.1, 0.2, 0.3]), nK: pk(4, [2, 3, 4, 5]),
      jeK: pk(25, [20, 25, 30]), kl: kart[0], kb: kart[1], kh: kart[2], mPl: pk(0.12, [0.09, 0.12, 0.15]), tare: pk(0.8, [0.6, 0.8, 1.0]),
      adapter: pk(2400, [1800, 2400, 3000]), sko: pk(2, [2, 3])
    };
    /* Fehlerliste der Nacharbeit: Summe = Liefermenge minus Gutteile im ersten Durchlauf; die häufigste Fehlerart ist immer eindeutig */
    const nF = p.stk - floorE(p.stk * rd(p.p1 * p.p2 * p.p3 / 1e4, 2) / 100), sh = e ? FACH.muster[0] : pick(r, FACH.muster);
    p.fl = sh.map(s => floorE(nF * s)); const top = sh.indexOf(Math.max.apply(null, sh)); p.fl[top] += nF - p.fl.reduce((a, b) => a + b, 0);
    /* Stichprobe: acht Messwerte der Versorgungsspannung, ein oder zwei davon klar außerhalb der Toleranz */
    const nOut = e ? 1 : pick(r, [1, 2]), outAt = [3, 6].slice(0, nOut), offs = [-1.2, -0.8, -0.5, -0.2, 0, 0.2, 0.4, 0.7, 1.0, 1.2];
    p.mess = []; for (let i = 0; i < 8; i++) { const o = outAt.indexOf(i) >= 0 ? (e || r() < 0.5 ? 1 : -1) * (p.tolU + 1.5) : (e ? offs[(i * 3) % 10] : pick(r, offs)); p.mess.push(rd(p.uN * (1 + o / 100), 3)); }
    const fn = FACH.fehlerName;
    const text = [
      'Kundenbaugruppe, Stufe ' + level + ': Ein Kunde aus der Medizintechnik bestellt ' + p.stk + ' bestückte Steuerplatinen. Wir sind sein EMS-Fertiger (Electronic Manufacturing Services, Fertigung im Kundenauftrag).',
      'Kalkulation: Material je Baugruppe ' + fm(p.mat, 2) + ' EUR, ' + p.smd + ' Bestückpunkte für SMD-Bauteile (oberflächenmontierte Bauteile) zu je 0,02 EUR, ' + p.tht + ' THT-Lötstellen (Bauteile mit Draht durch die Platine) zu je 0,05 EUR, Prüfzeit ' + p.tPr + ' min zu je 1,50 EUR, Rüstkosten ' + fm(p.ruest, 2) + ' EUR für das Los, Zuschlag ' + p.zus + ' %.',
      'Beschaffung: Auf jeder Platine sitzen ' + p.c + ' gleiche Kondensatoren, Zugabe für Rüstverlust ' + p.zug + ' % (aufrunden), eine Rolle enthält ' + p.rolle + ' Stück. Ein Bauteil der Feuchteklasse MSL ' + p.msl + ' (Moisture Sensitivity Level) war schon ' + p.h1 + ' h und ' + p.h2 + ' h offen, die Fertigung braucht es noch ' + p.tF + ' h lang.',
      'Daten: Seriennummern laufen ab ' + p.sn0 + '. Je Platine speichert das MES (Manufacturing Execution System, Fertigungsleitsystem) einen Datensatz je Bauteilsorte (' + p.sorten + ' Sorten) und ' + p.pd + ' Prozessdatensätze; ein Datensatz hat ' + p.byte + ' Byte.',
      'Linie: Ausbeute ohne Nacharbeit beim Pastendruck ' + p.p1 + ' %, beim Bestücken ' + p.p2 + ' %, beim Löten ' + p.p3 + ' %. Reflow-Ofen: beheizte Länge ' + fm(p.lOfen, 1) + ' m, Bandgeschwindigkeit ' + fm(p.vb, 1) + ' m/min, Platine ' + p.lPl + ' mm lang, Abstand auf dem Band ' + p.abst + ' mm.',
      'Prüfadapter: ' + p.tp + ' Testpunkte, Prüfstift mit Federrate ' + fm(p.cF, 1) + ' N/mm bei ' + fm(p.hub, 1) + ' mm Arbeitshub, Reserve ' + p.res + ' % (aufrunden). Fangstift ' + p.d + ' H7/' + p.wf + ': Bohrung H7 ' + (p.ES > 0 ? '+' : '') + p.ES + '/' + p.EI + ' µm, Stift ' + p.wf + ' ' + (p.es > 0 ? '+' : '') + p.es + '/' + (p.ei > 0 ? '+' : '') + p.ei + ' µm.',
      'Prüfen: Versorgungsspannung ' + fm(p.uN, 1) + ' V ± ' + p.tolU + ' %. Stichprobe in V: ' + p.mess.map(x => fm(x, 3)).join(' · ') + '.',
      'Fehlerliste der Nacharbeit: ' + FACH.fehler.map((k, i) => fn[k] + ' ' + p.fl[i]).join(', ') + '.',
      'Auswertung: Nacharbeit kostet ' + fm(p.kNa, 2) + ' EUR je Platine. Ein Fehler kostet im Wareneingang ' + fm(p.kWE, 2) + ' EUR. ' + p.nK + ' Fehler wären ohne Prüfung erst beim Kunden aufgefallen.',
      'Versand: ' + p.jeK + ' Platinen im ESD-Beutel (Schutz vor elektrostatischer Entladung) je Karton, Karton ' + p.kl + ' x ' + p.kb + ' x ' + p.kh + ' mm, mit Einlage ' + fm(p.tare, 1) + ' kg leer, Platine mit Beutel ' + fm(p.mPl, 2) + ' kg. Europalette 1200 x 800 mm, 144 mm hoch, 25 kg.',
      'Rechnung: Der Prüfadapter wird einmalig mit ' + fm(p.adapter, 2) + ' EUR netto berechnet. Umsatzsteuer 19 %, Zahlung mit ' + p.sko + ' % Skonto.'
    ];
    if (e) text.push('Starthilfe: Rechne jede Station mit den Werten weiter, die vorher übergeben wurden. Geldbeträge nach jedem Schritt auf Cent runden.');
    if (level === 3) text.push('Zusatz Stufe 3: Das Bauteil hat die strengere Feuchteklasse MSL 4, die Rechentoleranzen bei der Auswertung deiner Ergebnisse sind enger.');
    return { params: p, text: text };
  }

  /* ---------------------------------------------------------------- Rechenwege: je Station EINE Funktion calc(P, x, v) (wie im Tonfunk-Auftrag) */
  const sumA = a => (Array.isArray(a) ? a.reduce((s, y) => s + y, 0) : NaN);
  const CALC = {
    anfrage(P, x, v) {
      const kf = r2(P.smd * FACH.kSmd + P.tht * FACH.kTht + P.tPr * FACH.kPr), kr = r2(P.ruest / P.stk), kges = r2(P.mat + u(v.kf, kf) + u(v.kr, kr)), preis = r2(u(v.kges, kges) * (100 + P.zus) / 100);
      return { kf: kf, kr: kr, kges: kges, preis: preis, wert: r2(P.stk * u(v.preis, preis)), eol: 'info' };
    },
    beschaffung(P, x, v) {
      const bedarf = ceilE(P.stk * P.c * (100 + P.zug) / 100), rest = (FACH.bod[P.msl] || NaN) - P.h1 - P.h2;
      return { bedarf: bedarf, rollen: ceilE(u(v.bedarf, bedarf) / P.rolle), rest: rest, msl: u(v.rest, rest) >= P.tF ? 'ok' : 'backen', lager: 'mbb' };
    },
    programm(P, x, v) {
      const zeilen = P.stk * (P.sorten + P.pd);
      return { snEnd: P.sn0 + P.stk - 1, zeilen: zeilen, mb: u(v.zeilen, zeilen) * P.byte / 1e6, nBetr: Math.min(P.stk, floorE(P.rolle / P.c)), sql: 'where', scan: 'stop' };
    },
    smt(P, x, v) {
      const fpy = P.p1 * P.p2 * P.p3 / 1e4, ps = floorE(P.vb * 1000 * 60 / (P.lPl + P.abst)), psU = u(v.proStd, ps);
      return { fpy: fpy, gut: floorE(P.stk * u(v.fpy, rd(fpy, 2)) / 100), tOfen: P.lOfen / P.vb * 60, proStd: ps, tLos: psU > 0 ? P.stk / psU : NaN, aoi: 'verif' };
    },
    adapter(P, x, v) {
      const fs = P.cF * P.hub, hs = P.ES - P.ei, ms = P.EI - P.es, hU = u(v.hs, hs), mU = u(v.ms, ms);
      return { fStift: fs, fGes: P.tp * u(v.fStift, fs), nStift: ceilE(P.tp * (100 + P.res) / 100), hs: hs, ms: ms, art: mU >= 0 ? 'spiel' : hU <= 0 ? 'ueber' : 'ueberg' };
    },
    pruefung(P, x, v) {
      const lo = P.uN * (1 - P.tolU / 100), hi = P.uN * (1 + P.tolU / 100), m = Array.isArray(P.mess) ? P.mess : [], fl = Array.isArray(P.fl) ? P.fl : [], mx = Math.max.apply(null, fl.length ? fl : [NaN]);
      const top = FACH.fehler[fl.indexOf(mx)], own = FACH.fehler.indexOf(v.top) >= 0 ? v.top : top;
      return { umin: lo, umax: hi, naus: m.filter(y => y < lo - 1e-9 || y > hi + 1e-9).length, top: top, anteil: mx / sumA(fl) * 100, mass: FACH.mass[own] };
    },
    auswertung(P, x, v) {
      const nF = P.stk - x.gut, nachk = r2(nF * P.kNa);
      return { nachk: nachk, dpmo: nF / (P.stk * (P.smd + P.tht)) * 1e6, anteil: u(v.nachk, nachk) / x.wert * 100, mehr: r2(P.nK * (P.kWE * 1000 - P.kWE)), norm: 'iso13485' };
    },
    versand(P, x, v) {
      const E = FACH.pal, kartons = ceilE(P.stk / P.jeK), jeLage = Math.max(floorE(E.l / P.kl) * floorE(E.b / P.kb), floorE(E.l / P.kb) * floorE(E.b / P.kl));
      const kU = u(v.kartons, kartons), jU = u(v.jeLage, jeLage), lagen = jU > 0 ? ceilE(kU / jU) : NaN;
      return { kartons: kartons, jeLage: jeLage, lagen: lagen, hoehe: E.h + u(v.lagen, lagen) * P.kh, brutto: P.stk * P.mPl + kU * P.tare + E.kg, etikett: 'esd' };
    },
    rechnung(P, x, v) {
      const netto = r2(P.stk * x.preis + P.adapter), nU = u(v.netto, netto), ust = r2(nU * FACH.ust / 100), brutto = r2(nU + u(v.ust, ust)), bU = u(v.brutto, brutto);
      return { netto: netto, ust: ust, brutto: brutto, zahl: r2(bU - r2(bU * P.sko / 100)), soll: 'ford', haben: 'erloes_ust' };
    }
  };
  const ORDER = ['anfrage', 'beschaffung', 'programm', 'smt', 'adapter', 'pruefung', 'auswertung', 'versand', 'rechnung'];
  /* Welche Werte eine Station an spätere weitergibt (Schlüssel in x) */
  const GIVES = { anfrage: ['kges', 'preis', 'wert'], smt: ['gut'], auswertung: ['nachk'] };
  function inputs(P, ctx) {
    const x = {};
    ORDER.forEach(n => {
      if (!GIVES[n]) return; let s = null; const own = vals(slotOf(ctx, PID + '.' + n));
      GIVES[n].forEach(k => { const o = numOf(own[k]); if (fin(o)) x[k] = o; else { if (!s) { try { s = CALC[n](P, x, {}); } catch (e) { s = {}; } } x[k] = s[k]; } });
    });
    return x;
  }
  const ideal = P => { const x = inputs(P, null), o = {}; ORDER.forEach(n => { o[n] = CALC[n](P, x, {}); }); o.x = x; return o; };

  /* ---------------------------------------------------------------- Prüfzeilen aus der Feldtabelle einer Station */
  function lineOf(row, raw, soll, ctx) {
    if (row.t === 'sel') { const ok = raw != null && String(raw) === String(soll); return L(ok, row.label + ': ' + (raw == null || raw === '' ? 'keine Auswahl' : ok ? 'deine Auswahl passt' : 'deine Auswahl passt nicht'), row.pts); }
    const xv = numOf(raw), dec = row.dec == null ? 2 : row.dec, unit = row.unit ? ' ' + row.unit : '';
    if (!fin(xv)) return L(false, row.label + ': kein Wert', row.pts);
    if (!fin(soll)) return L(false, row.label + ': nicht prüfbar, weil ein Wert davor fehlt', row.pts);
    const lim = row.t === 'int' ? 1e-9 : Math.max((row.rel || 0) * TOL(ctx) * Math.abs(soll), row.abs || 0), ok = Math.abs(xv - soll) <= lim + 1e-9;
    return L(ok, row.label + ': dein Wert ' + fm(xv, row.t === 'int' ? 0 : dec) + unit + (ok ? ' passt' : (xv < soll ? ' ist zu klein' : ' ist zu groß')), row.pts);
  }
  function build(st) {
    const name = st.out.slice(PID.length + 1), calc = CALC[name];
    st.form = st.rows.map(r => { const f = { key: r.k, label: r.label, type: r.t === 'sel' ? 'select' : 'number' }; if (r.unit) f.unit = r.unit; if (r.opts) f.options = r.opts; if (r.hint) f.hint = r.hint; return f; });
    st.check = function (data, ctx) {
      try { ctx = ctx || {}; const P = P_(ctx), v = vals(data), s = calc(P, inputs(P, ctx), v); return { lines: st.rows.map(r => lineOf(r, v[r.k], s[r.k], ctx)).concat(taskLines(st, data, 30)) }; }
      catch (e) { return { lines: [L(false, st.title + ': Prüfung nicht möglich', 100)] }; }
    };
    st.starter = () => ({ vals: {}, tasks: {} });
    st.solution = function (ctx) {
      const P = P_(ctx), x = inputs(P, ctx), v = {};
      st.rows.forEach(r => { const s = calc(P, x, v)[r.k]; v[r.k] = r.t === 'sel' ? String(s) : r.t === 'int' ? Math.round(s) : rd(s, r.dec == null ? 2 : r.dec); });
      return { vals: v, tasks: tasksDone(st) };
    };
    return st;
  }
  const O = (value, label) => ({ value: value, label: label });
  const mut = (name, k, f, label) => ({ name: name, mutate: d => { d.vals[k] = f(d.vals[k], d.vals); return d; }, expectFail: [label] });
  const CAT = 'Kundenbaugruppe';

  /* ---------------------------------------------------------------- Stationen (Reihenfolge = Weg der Baugruppe durch den Betrieb) */
  const STATIONS = [
    { id: 've1', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Anfrage prüfen und kalkulieren', level: 2,
      on: 'vb', beruf: ['ik', 'wing'], in: [], out: 'kunde.anfrage', type: 'vb.form', w: 100, pass: null,
      text: 'Ein Kunde aus der Medizintechnik schickt seine Stückliste und fragt eine Serie Steuerplatinen an. Rechne die Kosten je Baugruppe aus: Fertigungskosten für Bestücken, THT-Löten (Bauteile mit Draht durch die Platine) und Prüfen, dazu die Rüstkosten je Stück und das Material. Schlage dann den Zuschlag auf und rechne den Auftragswert. In der Stückliste ist ein Bauteil mit EOL-Meldung (End of Life, das Bauteil wird nicht mehr hergestellt). Entscheide, wie wir damit umgehen.',
      kollege: 'Die Kaufleute haben die Anfrage geprüft, die Baugruppe kalkuliert und das Angebot mit dem Preis je Baugruppe abgegeben.',
      tasks: [{ lab: 'ems', id: 'ems45', min: 70 }, { lab: 'ems', id: 'ems46', min: 70 }, { lab: 'kal', id: 'kal10', min: 70 }],
      rows: [
        { k: 'kf', label: 'Fertigungskosten je Baugruppe', unit: 'EUR', abs: 0.015, pts: 14 },
        { k: 'kr', label: 'Rüstkosten je Baugruppe', unit: 'EUR', abs: 0.011, pts: 12 },
        { k: 'kges', label: 'Kosten je Baugruppe', unit: 'EUR', abs: 0.015, pts: 12 },
        { k: 'preis', label: 'Angebotspreis je Baugruppe', unit: 'EUR', abs: 0.015, pts: 12 },
        { k: 'wert', label: 'Auftragswert netto', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 10 },
        { k: 'eol', label: 'Umgang mit dem abgekündigten Bauteil', t: 'sel', pts: 10, opts: [O('still', 'Nichts sagen, der Kunde hat nur Bestückung angefragt'), O('tausch', 'Ohne Rücksprache ein anderes Bauteil einsetzen'), O('info', 'Den Kunden früh informieren und eine Lösung vorschlagen'), O('ab', 'Den Auftrag ablehnen')] }
      ],
      hint: ['Jeder Arbeitsschritt hat einen Preis je Stelle oder je Minute. Die Rüstkosten fallen einmal für das ganze Los an und werden verteilt.', 'Fertigungskosten = Bestückpunkte mal Preis + Lötstellen mal Preis + Prüfminuten mal Preis. Rüstkosten je Stück = Rüstkosten geteilt durch die Liefermenge.', 'Angebotspreis = Kosten je Baugruppe mal (1 + Zuschlag in Prozent geteilt durch 100), auf Cent runden. Ein Bauteiltausch ohne Freigabe ändert das Produkt des Kunden.'],
      mutants: [mut('Prüfkosten vergessen', 'kf', a => r2(a - 3), 'Fertigungskosten je Baugruppe'), mut('Rüstkosten nicht verteilt', 'kr', a => a * 100, 'Rüstkosten je Baugruppe'), mut('Material vergessen', 'kges', (a, v) => r2(v.kf + v.kr), 'Kosten je Baugruppe'), mut('Zuschlag vergessen', 'preis', (a, v) => v.kges, 'Angebotspreis je Baugruppe'), mut('Kosten statt Preis', 'wert', (a, v) => r2(a / v.preis * v.kges), 'Auftragswert netto'), mut('Abkündigung verschwiegen', 'eol', () => 'still', 'Umgang mit dem abgekündigten Bauteil')] },
    { id: 've2', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Bauteile beschaffen und annehmen', level: 2,
      on: 'vb', beruf: ['fll'], in: ['kunde.anfrage'], out: 'kunde.beschaffung', type: 'vb.form', w: 100, pass: null,
      text: 'Der Auftrag ist da, die Bauteile müssen ins Haus. Rechne den Bedarf an Kondensatoren für die Liefermenge mit Zugabe für den Rüstverlust (aufrunden) und die Zahl der Rollen. Im Wareneingang kommt ein Bauteil der Feuchteklasse MSL (Moisture Sensitivity Level, Stufe der Feuchteempfindlichkeit) an, das schon offen war. Rechne die restliche Bodenlebensdauer und entscheide, ob es so in die Fertigung darf. Wähle auch die richtige Verpackung für die angebrochene Rolle, die zurück ins Lager geht (ESD heißt elektrostatische Entladung).',
      kollege: 'Die Fachkräfte für Lagerlogistik haben die Bauteile bestellt, im Wareneingang geprüft, die Feuchteklasse beachtet und richtig eingelagert.',
      tasks: [{ lab: 'ems', id: 'ems21', min: 70 }, { lab: 'ems', id: 'ems24', min: 70 }, { lab: 'wfl', id: 'wfl1', min: 70 }],
      rows: [
        { k: 'bedarf', label: 'Bedarf an Kondensatoren', t: 'int', unit: 'Stück', pts: 14 },
        { k: 'rollen', label: 'Rollen', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'rest', label: 'Restliche Bodenlebensdauer', t: 'int', unit: 'h', pts: 14 },
        { k: 'msl', label: 'Entscheidung zum feuchteempfindlichen Bauteil', t: 'sel', pts: 14, opts: [O('ok', 'Verarbeiten, die Restzeit reicht'), O('backen', 'Sperren und nach Vorschrift trocknen (backen), dann verarbeiten')] },
        { k: 'lager', label: 'Verpackung der angebrochenen Rolle', t: 'sel', pts: 16, opts: [O('mbb', 'ESD-gerechter Feuchtesperrbeutel mit Trockenmittel und Feuchteanzeige, neu verschweißt'), O('karton', 'Offen im Karton ins Regal'), O('pe', 'Normaler Kunststoffbeutel'), O('kuehl', 'In den Kühlschrank')] }
      ],
      hint: ['Beim Rüsten gehen Bauteile verloren, deshalb kommt eine Zugabe dazu. Eine halbe Rolle kann man nicht rüsten.', 'Bedarf = Liefermenge mal Bauteile je Platine mal (1 + Zugabe in Prozent geteilt durch 100), aufrunden. Rollen = Bedarf geteilt durch Inhalt einer Rolle, aufrunden.', 'MSL 3 darf 168 h offen sein, MSL 4 nur 72 h. Alle offenen Zeiten werden zusammengezählt. Reicht der Rest nicht für die Fertigung, wird gebacken.'],
      mutants: [mut('Zugabe vergessen', 'bedarf', a => a - 40, 'Bedarf an Kondensatoren'), mut('Rollen abgerundet', 'rollen', a => a - 1, 'Rollen'), mut('Nur einen Zeitraum abgezogen', 'rest', a => a + 8, 'Restliche Bodenlebensdauer'), mut('Falsch entschieden', 'msl', a => (a === 'ok' ? 'backen' : 'ok'), 'Entscheidung zum feuchteempfindlichen Bauteil'), mut('Normaler Beutel', 'lager', () => 'pe', 'Verpackung der angebrochenen Rolle')] },
    { id: 've3', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Programm und Rückverfolgung', level: 2,
      on: 'vb', beruf: ['fi', 'winf'], in: ['kunde.beschaffung'], out: 'kunde.programm', type: 'vb.form', w: 100, pass: null,
      text: 'Bei Medizintechnik muss jede Platine bis zum Bauteillos rückverfolgbar sein. Jede Platine bekommt eine Seriennummer als Barcode. Das MES (Manufacturing Execution System, Fertigungsleitsystem) speichert je Platine einen Datensatz je Bauteilsorte und dazu Prozessdaten. Rechne die letzte Seriennummer, die Zahl der Datensätze und den Speicher in MB (Megabyte). Wie viele Platinen sind höchstens betroffen, wenn ein Kondensator-Los gesperrt wird (eine Rolle ist ein Los)? Wähle die SQL-Abfrage (Structured Query Language, Abfragesprache für Datenbanken) für die betroffenen Seriennummern in der Tabelle verbau (Spalten seriennr und los).',
      kollege: 'Die Fachinformatiker haben das Programm vorbereitet, die Seriennummern vergeben und die Rückverfolgung in der Datenbank eingerichtet.',
      tasks: [{ lab: 'ems', id: 'ems34', min: 70 }, { lab: 'ems', id: 'ems36', min: 70 }, { lab: 'sql', id: 'sql11', min: 70 }],
      rows: [
        { k: 'snEnd', label: 'Letzte Seriennummer', t: 'int', pts: 10 },
        { k: 'zeilen', label: 'Datensätze für den Auftrag', t: 'int', pts: 14 },
        { k: 'mb', label: 'Speicherbedarf', unit: 'MB', rel: 0.01, dec: 2, pts: 12 },
        { k: 'nBetr', label: 'Betroffene Platinen bei einem gesperrten Los', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'sql', label: 'Abfrage für die betroffenen Seriennummern', t: 'sel', pts: 12, opts: [O('count', 'SELECT COUNT(*) FROM verbau;'), O('where', 'SELECT seriennr FROM verbau WHERE los = \'L-0815\';'), O('rev', 'SELECT los FROM verbau WHERE seriennr = \'L-0815\';'), O('order', 'SELECT * FROM verbau ORDER BY los;')] },
        { k: 'scan', label: 'Beim Rüsten passt der Scan der Rolle nicht zum Platz', t: 'sel', pts: 10, opts: [O('weiter', 'Weiterfertigen und später prüfen'), O('stop', 'Die Maschine startet nicht, die Rolle wird geprüft und richtig gesteckt'), O('notiz', 'Nur einen Zettel an die Maschine kleben')] }
      ],
      hint: ['Die erste Nummer zählt mit. Für jede Platine gibt es Datensätze zu den Bauteilsorten und zu den Prozessen.', 'Letzte Nummer = erste Nummer + Liefermenge minus 1. Datensätze = Liefermenge mal (Sorten + Prozessdatensätze). 1 MB sind hier 1.000.000 Byte.', 'Eine Rolle reicht für Rolleninhalt geteilt durch Bauteile je Platine, abgerundet, aber nie mehr als die Liefermenge. Gesucht sind Zeilen mit einer Bedingung auf das Los.'],
      mutants: [mut('Erste Nummer nicht mitgezählt', 'snEnd', a => a + 1, 'Letzte Seriennummer'), mut('Prozessdaten vergessen', 'zeilen', a => a - 900, 'Datensätze für den Auftrag'), mut('Kilobyte statt Megabyte', 'mb', a => a * 1000, 'Speicherbedarf'), mut('Rolle doppelt gezählt', 'nBetr', a => a * 2, 'Betroffene Platinen bei einem gesperrten Los'), mut('Nur gezählt', 'sql', () => 'count', 'Abfrage für die betroffenen Seriennummern'), mut('Weitergefertigt', 'scan', () => 'weiter', 'Beim Rüsten passt der Scan der Rolle nicht zum Platz')] },
    { id: 've4', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Bestücken, Reflow und AOI', level: 2,
      on: 'vb', beruf: ['egs', 'ige'], in: ['kunde.programm', 'kunde.beschaffung'], out: 'kunde.smt', type: 'vb.form', w: 100, pass: null,
      text: 'Die SMT-Linie (Surface Mount Technology, Oberflächenmontage) druckt Lotpaste, bestückt und lötet im Reflow-Ofen (alle Lötstellen schmelzen auf einmal). Danach prüft die AOI (automatische optische Inspektion) jede Platine. Rechne den FPY (First Pass Yield, Ausbeute beim ersten Durchlauf) der Linie in Prozent auf zwei Nachkommastellen und die Gutteile im Los (abrunden). Rechne die Zeit einer Platine im Ofen, die Platinen je Stunde (abrunden) und die Ofenzeit für das ganze Los. Entscheide, was bei einer AOI-Meldung passiert.',
      sprich: 'Die Linie für die Oberflächenmontage druckt Lotpaste, bestückt und lötet im Reflow-Ofen. Danach prüft die automatische optische Inspektion jede Platine. Rechne die Ausbeute beim ersten Durchlauf in Prozent auf zwei Nachkommastellen und die Gutteile im Los, abgerundet. Rechne die Zeit einer Platine im Ofen, die Platinen je Stunde, abgerundet, und die Ofenzeit für das ganze Los. Entscheide, was bei einer Meldung der optischen Inspektion passiert.',
      kollege: 'Die Elektroniker haben die Linie eingerichtet, das Los bestückt und gelötet und die AOI-Meldungen bewertet.',
      tasks: [{ lab: 'ems', id: 'ems7', min: 70 }, { lab: 'ems', id: 'ems10', min: 70 }, { lab: 'mat', id: 'mat93', min: 70 }],
      rows: [
        { k: 'fpy', label: 'FPY der Linie', unit: '%', abs: 0.011, dec: 2, pts: 14 },
        { k: 'gut', label: 'Gutteile im ersten Durchlauf', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'tOfen', label: 'Zeit einer Platine im Ofen', unit: 's', rel: 0.01, dec: 0, pts: 10 },
        { k: 'proStd', label: 'Platinen je Stunde', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'tLos', label: 'Ofenzeit für das Los', unit: 'h', rel: 0.01, dec: 2, pts: 10 },
        { k: 'aoi', label: 'Die AOI meldet einen Fehler', t: 'sel', pts: 12, opts: [O('schrott', 'Platine sofort verschrotten'), O('verif', 'Am Prüfplatz ansehen und bewerten: echter Fehler in die Nacharbeit, Fehlalarm freigeben'), O('ignor', 'Meldung übergehen, die Funktionsprüfung findet es schon')] }
      ],
      hint: ['Jede Stufe verliert etwas Ausbeute. Die Ausbeute der ganzen Linie ist immer kleiner als die schlechteste Stufe.', 'FPY = Ausbeute Druck mal Ausbeute Bestücken mal Ausbeute Löten (als Dezimalzahlen). Zeit im Ofen = beheizte Länge geteilt durch Bandgeschwindigkeit.', 'Platinen je Minute = Bandgeschwindigkeit in mm je Minute geteilt durch (Platinenlänge + Abstand), dann mal 60. Ofenzeit = Liefermenge geteilt durch Platinen je Stunde.'],
      mutants: [mut('Mittelwert statt Produkt', 'fpy', a => a + 2, 'FPY der Linie'), mut('Aufgerundet', 'gut', a => a + 1, 'Gutteile im ersten Durchlauf'), mut('In Minuten eingetragen', 'tOfen', a => a / 60, 'Zeit einer Platine im Ofen'), mut('Abstand vergessen', 'proStd', a => Math.floor(a * 1.25), 'Platinen je Stunde'), mut('Ofenzeit in Minuten', 'tLos', a => a * 60, 'Ofenzeit für das Los'), mut('Sofort verschrottet', 'aoi', () => 'schrott', 'Die AOI meldet einen Fehler')] },
    { id: 've5', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Prüfadapter bauen', level: 2,
      on: 'vb', beruf: ['im', 'tpd'], in: ['kunde.programm'], out: 'kunde.adapter', type: 'vb.form', w: 100, pass: null,
      text: 'Für die Prüfung baut der Prüfmittelbau einen Nadeladapter: Gefederte Prüfstifte drücken auf die Testpunkte der Platine, zwei Fangstifte richten die Platine aus. Rechne die Kraft eines Prüfstifts beim Arbeitshub und die Kraft aller Stifte, die der Niederhalter aufbringen muss. Lege die Zahl der Stifte mit Reserve für die Stückliste fest (aufrunden). Rechne für die Passung des Fangstifts Höchstspiel und Mindestspiel in µm (Mikrometer; ein negatives Spiel ist ein Übermaß) und bestimme die Passungsart.',
      kollege: 'Die Industriemechaniker und Produktdesigner haben den Prüfadapter ausgelegt, gezeichnet und gebaut.',
      tasks: [{ lab: 'kon', id: 'kon20', min: 70 }, { lab: 'tol', id: 'tol21', min: 70 }, { lab: 'tol', id: 'tol22', min: 70 }],
      rows: [
        { k: 'fStift', label: 'Kraft eines Prüfstifts', unit: 'N', abs: 0.011, dec: 2, pts: 10 },
        { k: 'fGes', label: 'Kraft aller Prüfstifte', unit: 'N', rel: 0.01, dec: 1, pts: 12 },
        { k: 'nStift', label: 'Prüfstifte mit Reserve', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'hs', label: 'Höchstspiel', t: 'int', unit: 'µm', pts: 12 },
        { k: 'ms', label: 'Mindestspiel', t: 'int', unit: 'µm', pts: 12 },
        { k: 'art', label: 'Passungsart', t: 'sel', pts: 12, opts: [O('spiel', 'Spielpassung'), O('ueberg', 'Übergangspassung'), O('ueber', 'Übermaßpassung')] }
      ],
      hint: ['Eine Feder drückt umso stärker, je weiter sie zusammengedrückt wird. Alle Stifte drücken gleichzeitig gegen die Platine.', 'Federkraft = Federrate mal Arbeitshub. Stifte mit Reserve = Testpunkte mal (1 + Reserve in Prozent geteilt durch 100), aufrunden.', 'Höchstspiel = oberes Abmaß der Bohrung minus unteres Abmaß des Stifts. Mindestspiel = unteres Abmaß der Bohrung minus oberes Abmaß des Stifts. Ist das Mindestspiel negativ, das Höchstspiel aber positiv, ist es eine Übergangspassung.'],
      mutants: [mut('Hub in cm gerechnet', 'fStift', a => a / 10, 'Kraft eines Prüfstifts'), mut('Nur ein Stift', 'fGes', (a, v) => v.fStift, 'Kraft aller Prüfstifte'), mut('Reserve vergessen', 'nStift', a => a - 3, 'Prüfstifte mit Reserve'), mut('Abmaße vertauscht', 'hs', (a, v) => v.ms, 'Höchstspiel'), mut('Höchstspiel eingetragen', 'ms', (a, v) => v.hs, 'Mindestspiel'), mut('Passungsart verwechselt', 'art', a => (a === 'spiel' ? 'ueber' : 'spiel'), 'Passungsart')] },
    { id: 've6', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Prüfen und Fehler analysieren', level: 2,
      on: 'vb', beruf: ['egs'], in: ['kunde.smt', 'kunde.adapter'], out: 'kunde.pruefung', type: 'vb.form', w: 100, pass: null,
      text: 'Im Adapter läuft der ICT (In-Circuit-Test, Prüfung der Bauteile auf der Platine) und danach die Funktionsprüfung. Rechne die Grenzen der Versorgungsspannung aus der Toleranz und zähle, wie viele Werte der Stichprobe außerhalb liegen. Werte die Fehlerliste der Nacharbeit aus: Welche Fehlerart ist am häufigsten, wie groß ist ihr Anteil, und wo setzt du zuerst an? Die SPI (Solder Paste Inspection, Prüfung der Lotpaste) prüft den Pastendruck.',
      kollege: 'Die Elektroniker haben die Platinen geprüft, die Fehler analysiert und die wichtigste Ursache an die Linie gemeldet.',
      tasks: [{ lab: 'ems', id: 'ems13', min: 70 }, { lab: 'ssl', id: 'ssl38', min: 70 }, { lab: 'mat', id: 'mat35', min: 70 }],
      rows: [
        { k: 'umin', label: 'Untere Grenze der Versorgungsspannung', unit: 'V', abs: 0.0011, dec: 3, pts: 10 },
        { k: 'umax', label: 'Obere Grenze der Versorgungsspannung', unit: 'V', abs: 0.0011, dec: 3, pts: 10 },
        { k: 'naus', label: 'Werte außerhalb der Grenzen', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'top', label: 'Häufigste Fehlerart', t: 'sel', pts: 12, opts: FACH.fehler.map(k => O(k, FACH.fehlerName[k])) },
        { k: 'anteil', label: 'Anteil der häufigsten Fehlerart', unit: '%', abs: 0.06, dec: 1, pts: 12 },
        { k: 'mass', label: 'Erste Maßnahme an der Linie', t: 'sel', pts: 14, opts: [O('spi', 'Pastendruck prüfen: Schablone, Pastenmenge, Ergebnisse der SPI'), O('feeder', 'Rüstung und Zuführung der Bauteile prüfen'), O('polar', 'Drehlage im Bestückprogramm prüfen'), O('profil', 'Temperaturprofil des Reflow-Ofens prüfen')] }
      ],
      hint: ['Die Toleranz in Prozent gilt nach oben und nach unten um den Nennwert. Bei der Fehlerliste zählt, was am häufigsten vorkommt.', 'Grenze = Nennspannung mal (1 plus oder minus Toleranz geteilt durch 100). Anteil = häufigste Fehlerzahl geteilt durch alle Fehler, mal 100.', 'Lötbrücken kommen meist von zu viel Paste, fehlende Bauteile von der Zuführung, verdrehte von der Drehlage im Programm, schlecht benetzte Lötstellen vom Temperaturprofil.'],
      mutants: [mut('Toleranz falsch', 'umin', a => a - 0.1, 'Untere Grenze der Versorgungsspannung'), mut('Toleranz halbiert', 'umax', (a, v) => rd((a + v.umin) / 2 + (a - v.umin) / 4, 3), 'Obere Grenze der Versorgungsspannung'), mut('Ausreißer übersehen', 'naus', a => a - 1, 'Werte außerhalb der Grenzen'), mut('Falsche Fehlerart', 'top', a => (a === 'bruecke' ? 'fehlt' : 'bruecke'), 'Häufigste Fehlerart'), mut('Auf die Liefermenge bezogen', 'anteil', a => a / 2, 'Anteil der häufigsten Fehlerart'), mut('Falsche Maßnahme', 'mass', a => (a === 'spi' ? 'profil' : 'spi'), 'Erste Maßnahme an der Linie')] },
    { id: 've7', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Ausbeute und Fehlerkosten auswerten', level: 3,
      on: 'vb', beruf: ['ik', 'tec', 'wing', 'stu'], in: ['kunde.anfrage', 'kunde.smt', 'kunde.pruefung'], out: 'kunde.auswertung', type: 'vb.form', w: 100, pass: null,
      text: 'Nach dem Los wird der Prozess bewertet. Rechne die Kosten der Nacharbeit für alle Platinen, die nicht im ersten Durchlauf gut waren. Rechne die Fehler in ppm (parts per million, Fehler je Million Fehlermöglichkeiten); jede Bestückstelle und jede THT-Lötstelle (Lötstelle eines bedrahteten Bauteils) ist eine Möglichkeit. Wie groß ist der Anteil der Nacharbeit am Auftragswert? Rechne nach der Zehnerregel die Mehrkosten, wenn Fehler erst beim Kunden auffallen. Wähle die Norm für das Qualitätsmanagement in der Medizintechnik (ISO heißt Internationale Organisation für Normung).',
      kollege: 'Die Kollegen aus Kaufmännischem und Technik haben Ausbeute und Fehlerkosten ausgewertet und mit dem Auftragswert verglichen.',
      tasks: [{ lab: 'ems', id: 'ems26', min: 70 }, { lab: 'ems', id: 'ems29', min: 70 }, { lab: 'mat', id: 'mat13', min: 70 }],
      rows: [
        { k: 'nachk', label: 'Kosten der Nacharbeit', unit: 'EUR', abs: 0.05, pts: 14 },
        { k: 'dpmo', label: 'Fehler je Million Möglichkeiten', unit: 'ppm', rel: 0.01, dec: 1, pts: 14 },
        { k: 'anteil', label: 'Anteil der Nacharbeit am Auftragswert', unit: '%', abs: 0.011, dec: 2, pts: 12 },
        { k: 'mehr', label: 'Mehrkosten, wenn die Fehler erst beim Kunden auffallen', unit: 'EUR', abs: 0.05, pts: 14 },
        { k: 'norm', label: 'Norm für die Medizintechnik', t: 'sel', pts: 16, opts: [O('iso13485', 'ISO 13485, Qualitätsmanagement für Medizinprodukte'), O('iatf', 'IATF 16949 (International Automotive Task Force, Verband der Autoindustrie), Qualitätsmanagement in der Automobilindustrie'), O('iso14001', 'ISO 14001, Umweltmanagement'), O('iso50001', 'ISO 50001, Energiemanagement')] }
      ],
      hint: ['Nacharbeit fällt für jede Platine an, die im ersten Durchlauf nicht gut war. Ein Fehler wird teurer, je später er auffällt.', 'Platinen in der Nacharbeit = Liefermenge minus Gutteile. ppm = Fehler geteilt durch (Platinen mal Möglichkeiten je Platine), mal 1.000.000.', 'Zehnerregel: vom Wareneingang über Fertigung und Endprüfung bis zum Kunden dreimal mal 10. Mehrkosten = Kosten beim Kunden minus Kosten im Wareneingang, für alle Fehler.'],
      mutants: [mut('Mit allen Platinen gerechnet', 'nachk', a => a * 10, 'Kosten der Nacharbeit'), mut('Ohne Million', 'dpmo', a => a / 1e6, 'Fehler je Million Möglichkeiten'), mut('Nicht mal 100', 'anteil', a => a / 100, 'Anteil der Nacharbeit am Auftragswert'), mut('Eine Stufe zu wenig', 'mehr', a => a / 10, 'Mehrkosten, wenn die Fehler erst beim Kunden auffallen'), mut('Automobilnorm', 'norm', () => 'iatf', 'Norm für die Medizintechnik')] },
    { id: 've8', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Versand in Kundenverpackung', level: 2,
      on: 'vb', beruf: ['fll'], in: ['kunde.pruefung'], out: 'kunde.versand', type: 'vb.form', w: 100, pass: null,
      text: 'Die geprüften Platinen gehen in der Verpackung des Kunden raus: jede Platine im ESD-Beutel (Schutz vor elektrostatischer Entladung), mehrere Platinen je Karton. Rechne die Zahl der Kartons (aufrunden), die meisten Kartons je Lage auf der Europalette (beide Ausrichtungen probieren, kein Überstand), die Lagen, die Höhe der Ladeeinheit mit Palette und das Gewicht der Sendung. Wähle das Zeichen, das auf jeden Karton gehört.',
      kollege: 'Die Fachkräfte für Lagerlogistik haben die Platinen in Kundenverpackung gepackt, palettiert und gekennzeichnet.',
      tasks: [{ lab: 'ems', id: 'ems19', min: 70 }, { lab: 'lad', id: 'lad21', min: 70 }, { lab: 'lad', id: 'lad25', min: 70 }],
      rows: [
        { k: 'kartons', label: 'Kartons', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'jeLage', label: 'Kartons je Lage', t: 'int', unit: 'Stück', pts: 14 },
        { k: 'lagen', label: 'Lagen', t: 'int', pts: 12 },
        { k: 'hoehe', label: 'Höhe der Ladeeinheit', unit: 'mm', abs: 0.5, dec: 0, pts: 10 },
        { k: 'brutto', label: 'Gewicht der Sendung', unit: 'kg', rel: 0.005, dec: 1, pts: 12 },
        { k: 'etikett', label: 'Zeichen auf dem Karton', t: 'sel', pts: 10, opts: [O('esd', 'Warnzeichen für elektrostatisch gefährdete Bauteile'), O('bruch', 'Nur das Zeichen für zerbrechlich'), O('gefahr', 'Gefahrgutzettel'), O('keins', 'Kein Zeichen, der Kunde weiß Bescheid')] }
      ],
      hint: ['Auf die Palette passen nur ganze Kartons. Der letzte Karton darf halb voll sein, braucht aber trotzdem Platz.', 'Je Lage: abrunden(1200 geteilt durch Kartonlänge) mal abrunden(800 geteilt durch Kartonbreite), dann den Karton drehen und noch einmal rechnen. Lagen = Kartons geteilt durch Kartons je Lage, aufrunden.', 'Höhe = Palettenhöhe + Lagen mal Kartonhöhe. Gewicht = Platinen mal Gewicht je Platine + Kartons mal Leergewicht + Palette.'],
      mutants: [mut('Kartons abgerundet', 'kartons', a => a - 1, 'Kartons'), mut('Nur eine Richtung probiert', 'jeLage', a => a - 2, 'Kartons je Lage'), mut('Lagen abgerundet', 'lagen', a => a - 1, 'Lagen'), mut('Palette vergessen', 'hoehe', a => a - 144, 'Höhe der Ladeeinheit'), mut('Palette nicht mitgewogen', 'brutto', a => a - 25, 'Gewicht der Sendung'), mut('Falsches Zeichen', 'etikett', () => 'bruch', 'Zeichen auf dem Karton')] },
    { id: 've9', lab: 'vb', cat: 'Kundenbaugruppe', title: 'Rechnung schreiben', level: 3,
      on: 'vb', beruf: ['ik', 'wing'], in: ['kunde.anfrage', 'kunde.versand'], out: 'kunde.rechnung', type: 'vb.form', w: 100, pass: null,
      text: 'Die Platinen sind beim Kunden. Schreibe die Rechnung: Liefermenge mal Angebotspreis je Baugruppe, dazu einmalig der Prüfadapter, ergibt den Nettobetrag. Rechne Umsatzsteuer, Bruttobetrag und den Zahlbetrag, wenn der Kunde mit Skonto zahlt (Skonto vom Bruttobetrag). Bilde den Buchungssatz der Ausgangsrechnung mit Kontennamen.',
      kollege: 'Die Kaufleute haben die Rechnung geschrieben und die Ausgangsrechnung gebucht.',
      tasks: [{ lab: 'buc', id: 'buc15', min: 70 }, { lab: 'rec', id: 'rec29', min: 70 }, { lab: 'kal', id: 'kal33', min: 70 }],
      rows: [
        { k: 'netto', label: 'Nettobetrag der Rechnung', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 14 },
        { k: 'ust', label: 'Umsatzsteuer', unit: 'EUR', abs: 0.05, pts: 10 },
        { k: 'brutto', label: 'Bruttobetrag der Rechnung', unit: 'EUR', abs: 0.05, pts: 10 },
        { k: 'zahl', label: 'Zahlbetrag mit Skonto', unit: 'EUR', abs: 0.05, pts: 12 },
        { k: 'soll', label: 'Buchungssatz, Soll', t: 'sel', pts: 12, opts: [O('bank', 'Bank'), O('verb', 'Verbindlichkeiten aus Lieferungen und Leistungen'), O('ford', 'Forderungen aus Lieferungen und Leistungen'), O('erloes', 'Umsatzerlöse für Erzeugnisse')] },
        { k: 'haben', label: 'Buchungssatz, Haben', t: 'sel', pts: 12, opts: [O('erloes_vst', 'Umsatzerlöse für Erzeugnisse und Vorsteuer'), O('ford_ust', 'Forderungen aus Lieferungen und Leistungen und Umsatzsteuer'), O('erloes_ust', 'Umsatzerlöse für Erzeugnisse und Umsatzsteuer'), O('bank_ust', 'Bank und Umsatzsteuer')] }
      ],
      hint: ['Der Prüfadapter wird nur einmal berechnet, nicht je Platine. Die Umsatzsteuer kommt auf den Nettobetrag.', 'Umsatzsteuer = Nettobetrag mal 19 geteilt durch 100, auf Cent runden. Skonto = Bruttobetrag mal Skontosatz geteilt durch 100.', 'Bei einer Ausgangsrechnung auf Ziel entsteht eine Forderung. Im Haben stehen der Erlös und die Steuer, die du dem Finanzamt schuldest.'],
      mutants: [mut('Adapter vergessen', 'netto', a => r2(a - 1800), 'Nettobetrag der Rechnung'), mut('Steuer vom Brutto', 'ust', a => r2(a / 1.19), 'Umsatzsteuer'), mut('Steuer doppelt', 'brutto', (a, v) => r2(a + v.ust), 'Bruttobetrag der Rechnung'), mut('Skonto vom Nettobetrag', 'zahl', (a, v) => r2(v.brutto - (v.brutto - a) * v.netto / v.brutto), 'Zahlbetrag mit Skonto'), mut('Bank statt Forderung', 'soll', () => 'bank', 'Buchungssatz, Soll'), mut('Vorsteuer statt Umsatzsteuer', 'haben', () => 'erloes_vst', 'Buchungssatz, Haben')] }
  ];
  STATIONS.forEach(build);

  /* ---------------------------------------------------------------- Gesamttest: passt der Auftrag über alle Abteilungen zusammen? */
  function finalCheck(slots, spec, level) {
    try {
      const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
      const g = (n, k) => numOf(vals(slotOf(ctx, PID + '.' + n))[k]), gs = (n, k) => vals(slotOf(ctx, PID + '.' + n))[k];
      const rollen = g('beschaffung', 'rollen'), restT = (FACH.bod[P.msl] || NaN) - P.h1 - P.h2, mslT = restT >= P.tF ? 'ok' : 'backen';
      const okMat = fin(rollen) && rollen * P.rolle >= P.stk * P.c && gs('beschaffung', 'msl') === mslT;
      const sn = g('programm', 'snEnd'), okSn = fin(sn) && sn - P.sn0 + 1 === P.stk;
      const gut = g('smt', 'gut'), nF = sumA(P.fl), okAus = fin(gut) && fin(nF) && Math.abs(gut + nF - P.stk) <= 1;
      const ka = g('versand', 'kartons'), jl = g('versand', 'jeLage'), lg = g('versand', 'lagen'), ho = g('versand', 'hoehe');
      const okVer = fin(ka) && fin(jl) && fin(lg) && fin(ho) && ka * P.jeK >= P.stk && lg * jl >= ka && ho >= FACH.pal.h + lg * P.kh - 0.5 && ho <= FACH.hMax + 0.01;
      const pr = g('anfrage', 'preis'), kg = g('anfrage', 'kges'), na = g('auswertung', 'nachk'), ueb = r2(P.stk * (pr - kg) - na), okW = fin(ueb) && ueb > 0 && pr > kg;
      return {
        lines: [
          L(okMat, 'Material: ' + (okMat ? 'Die Rollen reichen für den Bedarf, das feuchteempfindliche Bauteil ist richtig behandelt' : 'Rollen reichen nicht oder die Entscheidung zur Feuchteklasse passt nicht zum Lastenheft'), 20),
          L(okSn, 'Rückverfolgung: ' + (fin(sn) ? 'Seriennummern ' + P.sn0 + ' bis ' + sn + (okSn ? ', jede Platine hat genau eine Nummer' : ', das passt nicht zur Liefermenge') : 'letzte Seriennummer fehlt'), 20),
          L(okAus, 'Ausbeute: ' + (fin(gut) ? gut + ' Gutteile und ' + nF + ' Platinen in der Nacharbeit' + (okAus ? ' ergeben die Liefermenge' : ' ergeben nicht die Liefermenge') : 'Gutteile fehlen'), 20),
          L(okVer, 'Versand: ' + (okVer ? 'Alle Platinen sind verpackt, alle Kartons stehen auf der Palette, die Ladehöhe ist eingehalten' : 'Kartons, Lagen oder Höhe passen nicht zur Liefermenge'), 20),
          L(okW, 'Wirtschaftlichkeit: ' + (fin(ueb) ? 'Überschuss nach den Fehlerkosten ' + fm(ueb, 2) + ' EUR' + (okW ? '' : ', der Auftrag deckt seine Kosten nicht') : 'Kalkulation oder Auswertung fehlt'), 20)
        ],
        kpis: [
          { key: 'preis', label: 'Angebotspreis je Baugruppe', value: fin(pr) ? pr : null, unit: 'EUR', ok: okW },
          { key: 'fpy', label: 'FPY (Ausbeute beim ersten Durchlauf)', value: fin(g('smt', 'fpy')) ? g('smt', 'fpy') : null, unit: '%', ok: okAus },
          { key: 'dpmo', label: 'Fehler je Million Möglichkeiten', value: fin(g('auswertung', 'dpmo')) ? g('auswertung', 'dpmo') : null, unit: 'ppm', ok: okAus },
          { key: 'kartons', label: 'Kartons', value: fin(ka) ? ka : null, unit: '', ok: okVer },
          { key: 'rechnung', label: 'Rechnungsbetrag brutto', value: fin(g('rechnung', 'brutto')) ? g('rechnung', 'brutto') : null, unit: 'EUR', ok: okW },
          { key: 'ueber', label: 'Überschuss', value: fin(ueb) ? ueb : null, unit: 'EUR', ok: okW }
        ]
      };
    } catch (e) { return { lines: [L(false, 'Gesamttest: Prüfung nicht möglich', 100)], kpis: [] }; }
  }
  function report(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] };
    const row = (n, k, name, unit, d) => { const x = vals(slotOf(ctx, PID + '.' + n))[k], y = numOf(x); return [name, fin(y) ? fm(y, d == null ? 2 : d) + (unit ? ' ' + unit : '') : (x == null ? '-' : String(x))]; };
    return [
      { h: 'Angebot und Rechnung', rows: [row('anfrage', 'kges', 'Kosten je Baugruppe', 'EUR'), row('anfrage', 'preis', 'Angebotspreis je Baugruppe', 'EUR'), row('anfrage', 'wert', 'Auftragswert', 'EUR'), row('rechnung', 'brutto', 'Rechnungsbetrag brutto', 'EUR')] },
      { h: 'Material und Daten', rows: [row('beschaffung', 'rollen', 'Rollen', '', 0), row('beschaffung', 'rest', 'Restliche Bodenlebensdauer', 'h', 0), row('programm', 'snEnd', 'Letzte Seriennummer', '', 0), row('programm', 'zeilen', 'Datensätze', '', 0)] },
      { h: 'Fertigung und Prüfung', rows: [row('smt', 'fpy', 'FPY der Linie', '%'), row('smt', 'gut', 'Gutteile', 'Stück', 0), row('adapter', 'fGes', 'Kraft aller Prüfstifte', 'N', 1), row('pruefung', 'anteil', 'Anteil der häufigsten Fehlerart', '%', 1)] },
      { h: 'Auswertung und Versand', rows: [row('auswertung', 'nachk', 'Kosten der Nacharbeit', 'EUR'), row('auswertung', 'dpmo', 'Fehler je Million Möglichkeiten', 'ppm', 1), row('versand', 'kartons', 'Kartons', '', 0), row('versand', 'brutto', 'Sendungsgewicht', 'kg', 1)] }
    ];
  }

  const def = {
    id: PID, name: 'Kundenbaugruppe', icon: '🩺', prefix: 've', order: 14, beruf: ['alle'],
    story: 'Ein Kunde aus der Medizintechnik lässt bei uns eine bestückte Steuerplatine fertigen. Die Baugruppe läuft durch die ganze Elektronikfertigung: Die Kaufleute kalkulieren das Angebot, das Lager beschafft die Bauteile, die Fachinformatiker richten Programm und Rückverfolgung ein, die Elektroniker bestücken, löten und prüfen, Mechaniker und Produktdesigner bauen den Prüfadapter, die Technik wertet Ausbeute und Fehlerkosten aus, das Lager verschickt in der Verpackung des Kunden und die Kaufleute schreiben die Rechnung. Du bearbeitest die Stationen deines Berufs und rechnest mit den Werten weiter, die deine Kollegen übergeben haben. Am Ende steht ein gemeinsames Zertifikat.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['ems', 'kal', 'wfl', 'sql', 'mat', 'kon', 'tol', 'ssl', 'lad', 'buc', 'rec'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'veF', title: 'Abschlusstest: Die Kundenbaugruppe von der Anfrage bis zur Rechnung', check: finalCheck },
    report: report, kpis: ['preis', 'fpy', 'dpmo', 'kartons', 'rechnung', 'ueber'],
    _test: { CALC: CALC, FACH: FACH, ORDER: ORDER, inputs: inputs, ideal: ideal, r2: r2, CAT: CAT }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
