/* verbunddata-tonfunk.js - berufsübergreifendes Verbundprojekt "Tonfunk-Auftrag" (Kennung tonfunk, Kürzel vz (nicht vt: vt1 gehört dem Schaltplan-Aufgabenverzeichnis), Beruf 'alle', order 13).
 * Ein Seriengerät (Labornetzteil im Blechgehäuse) läuft wie im Betrieb durch alle Berufe. Jede Station gehört einem Beruf (Stationsfeld beruf);
 * im Einzelmodus bearbeitet der Lernende nur die Stationen seines Berufs, die übrigen liefern "die Kollegen" mit Musterwerten (Engine: verbund.js, Abschnitt Stations-Beruf).
 * Alle Stationen sind Hub-Stationen (on 'vb', Typ vb.form). Keine Kerne, kein Adapter. Ohne Verbund-Kern wartet die Definition in window.VERBUND_QUEUE; in Node liefert module.exports die Definition.
 *
 * FÜR DIE INTEGRATION
 *   Startseite/Suche (ein Satz): "Tonfunk-Auftrag: Ein Labornetzteil läuft als Serienauftrag durch alle Berufe – Anfrage, Gehäuse, Fertigung, Angebot, Schaltung, Prüfung, Datenauswertung, Versand und Rechnung. Du bearbeitest die Stationen deines Berufs, die Kollegen liefern den Rest."
 *   def.beruf: ['alle'] (erscheint bei jedem Beruf, zählt nicht für das Abzeichen vb_alle). Symbol 🏭. Abzeichen-Vorschlag (vbtonfunk): Symbol 🏭, Name "Hand in Hand", Text "Den Tonfunk-Auftrag mit den Kollegen der anderen Berufe bis zur Rechnung gebracht."
 *   Labs für die Symbolreihe: rec kal zei fer tol fug zer ssl mat sql alg lad buc.
 *   Stationen (Beruf | Lab-Aufgaben, je min 70 %):
 *     vz1 Anfrage und Material (ik | rec1 kal3) · vz2 Gehäusezeichnung (tpd | zei22 zei24) · vz3 Zuschnitt und Toleranz (tpd | zei44 tol10) · vz4 Fügen (im | fug26 fug24) ·
 *     vz5 Schnittdaten und Zeit (im | zer24 fer23) · vz6 Angebot (ik | kal7 kal13) · vz7 Schaltung (egs, ige | ssl14 ssl15) · vz8 Prüfen und Messen (egs, ige | ssl36 mat43) ·
 *     vz9 Prüfdaten (fi | sql17 alg6) · vz10 Verpacken und Palettieren (fll | lad21 lad22) · vz11 Ladungssicherung (fll | lad5 lad14) · vz12 Rechnung und Nachkalkulation (ik | buc15 rec29).
 *   Die Elektronik-Stationen verweisen auf ssl und mat, weil nur eigenständige Labs ihr Ergebnis nach lm4.tdone schreiben (nts, els, mess schreiben sim.done).
 *
 * FORMELN (Beispiel = Stufe 1: 200 Stück, 5 % Zugabe, Gehäuse innen 220 x 160 x 100 mm, Blech 1 mm; von Hand nachgerechnet)
 *   vz1  Fertigungsmenge = aufrunden(200 · 1,05) = 210. Bezug (wie kal3): 210 · 20,00 = 4.200,00; − 10 % Rabatt = 3.780,00 (Zieleinkaufspreis); − 2 % Skonto = 3.704,40 (Bareinkaufspreis); + 60,00 Bezugskosten = 3.764,40 EUR.
 *   vz2  Außenmaß = Innenmaß + 2 · s: 222 x 162 x 102 mm. Maßstab: größter aus 1:1, 1:2, 1:5, 1:10, bei dem Länge und Höhe in das Zeichenfeld 180 x 120 mm passen: 1:2, Zeichnungsmaß 111 mm.
 *   vz3  Haube = U-Profil (Schenkel = Außenhöhe, Boden = Außenbreite, Innenradius r = s, neutrale Faser in Blechmitte, wie zei44 und Fertigungs-Lab fer17):
 *        L = 2 · 102 + 162 − 2 · (2 · (r + s) − π/2 · (r + s/2)) = 366 − 2 · (4 − 2,3562) = 362,71 mm.
 *        Fläche = L · li + bi · li + 2 · ba · ha = 79.796,7 + 35.200 + 33.048 = 148.044,7 mm²; Masse = Fläche · s · 7,85 kg/dm³ = 1,162 kg; Blechkosten = 1,162 · 1,20 · 1,25 · 210 = 366,08 EUR (bzw. 366,03 EUR mit der auf 1,162 kg gerundeten Masse).
 *        ISO 2768-m: über 30 bis 120 mm ± 0,3; über 120 bis 400 mm ± 0,5. Außenhöhe 102: 102,3 / 101,7 mm.
 *   vz4  Niet d 4 mm: A = π/4 · d² = 12,57 mm²; je Seite n = aufrunden(F / (τ · A)) = 2000 / (60 · 12,57) = 2,65 -> 3 (mindestens 2); je Gehäuse 6; Nietlänge = 2 · s + 1,5 · d = 8 mm; Auftrag 6 · 210 = 1260.
 *   vz5  Bohrung 4,1 mm, vc 30 m/min: n = vc · 1000 / (π · d) = 2329 1/min -> Stufe 2000; Bohrweg = 2 · s + 0,3 · d + 1 = 4,23 mm; th = 4,23 / (0,1 · 2000) = 0,02115 min = 1,27 s;
 *        te = (6 · 1,27 s + 4,5 min) · 1,10 = 5,09 min; Auftragszeit T = (45 + 210 · 5,09) / 60 = 18,57 h (wie fer23: T = tr + m · te).
 *   vz6  Zuschlagskalkulation (wie kal7, kal13, jedes Zwischenergebnis auf Cent): MEK 3.764,40 + 366,03 = 4.130,43; MGK 10 % 413,04; FL 18,57 h · 24 = 445,68; FGK 150 % 668,52; HK 5.657,67;
 *        VwVtGK 12 % 678,92; SK 6.336,59; Gewinn 10 % 633,66; BVP 6.970,25; Skonto 2 % im Hundert: 7.112,50; Rabatt 5 % im Hundert: 7.486,84; je Stück 37,43 EUR.
 *   vz7  LM317: R2 = R1 · (Ua / 1,25 V − 1) = 240 · 8,6 = 2064 Ω; Pv = (Ue − Ua) · I = 5 W; Rth,K ≤ (Tj − Tu) / Pv − RthJG − RthGK = 85 / 5 − 4,5 = 12,5 K/W -> Kühlkörper 10 K/W; η = Ua / Ue = 70,6 %.
 *   vz8  Grenzen 12 V ± 3 %: 11,64 / 12,36 V; Schutzleiterwiderstand höchstens 0,3 Ω; Isolationswiderstand mindestens 1 MΩ (Schutzklasse I); Prüfzeit 210 · 4 min = 14 h.
 *   vz9  Mittelwert der zehn Messwerte, Zahl außerhalb der Grenzen, Ausschussquote = 6 / 210 = 2,86 %, Gutteile 204, Datensätze 210 · 12 = 2520.
 *   vz10 Karton = Außenmaß + 2 · Polster (20 mm): 262 x 202 x 142 mm; je Lage max(4 · 3, 5 · 3) = 15; Lagen = abrunden((1000 − 144) / 142) = 6; 90 je Palette -> 3 Paletten; Sendung 200 · 3,5 + 3 · 25 = 775 kg.
 *   vz11 Fv = m · g · (0,8 − µ) = 775 · 9,81 · 0,5 = 3801 N; Fs = 775 · 9,81 · 0,2 = 1521 N; Niederzurren n = aufrunden(Fv / (2 · µ · STF · 10)) = 3801 / 2400 = 1,58 -> 2; Fracht 3 · 60 = 180 EUR.
 *   vz12 Listenpreis 200 · 37,43 = 7.486,00; − 5 % = 7.111,70 netto; USt 19 % 1.351,22; brutto 8.462,92. Nachkalkulation: FL + 10 % = 490,25; FGK 735,38; HK 5.769,10; + 12 % = 6.461,39; + Fracht 180 = 6.641,39; Gewinn 7.111,70 − 6.641,39 = 470,31 EUR.
 *
 * ANNAHMEN (A), zur fachlichen Freigabe
 *   A1  Alle Zahlen sind Übungswerte. Zugabe für Ausschuss in Prozent der Liefermenge, immer aufrunden.
 *   A2  Gehäuse wie im Projekt "Gehäuse für das Labornetzteil": Haube als U-Profil, Front- und Rückplatte außen, Außenmaß = Innenmaß + 2 · s, Innenradius = Blechdicke, Abwicklung mit neutraler Faser in Blechmitte.
 *   A3  DC01 7,85 kg/dm³, 1,20 EUR/kg, Verschnittzuschlag 25 %. Allgemeintoleranz ISO 2768-m (± 0,3 bis 120 mm, ± 0,5 bis 400 mm). Zeichenfeld 180 x 120 mm.
 *   A4  Halbrundniet aus Aluminium, einschnittig, zulässige Scherspannung 60 N/mm² (Übungswert des Füge-Labs), mindestens 2 Niete je Seite, Nietlänge = Klemmlänge + 1,5 · d.
 *   A5  Bohren: HSS, Bohrung = Nietdurchmesser + 0,1 mm, beide Bleche im Paket, Anschnitt 0,3 · d, Überlauf 1 mm, Vorschub 0,1 mm je Umdrehung, Drehzahlstufe = nächstniedrigere der Reihe 355 bis 2800 1/min.
 *       Zeit je Einheit = (Bohrzeit + übrige Zeit für Scheren, Biegen, Nieten, Montieren) · (1 + Verteilzeitzuschlag).
 *   A6  Kalkulation ohne Sondereinzelkosten; Verwaltungs- und Vertriebsgemeinkosten als ein Satz auf die Herstellkosten; Gewinn auf die Selbstkosten; Kundenskonto und Kundenrabatt im Hundert.
 *       Materialeinzelkosten = Bezugspreis der Bausätze + Blechkosten. Fertigungslöhne = Auftragszeit · Lohnsatz.
 *   A7  LM317 ohne Strom am Einstellanschluss, Referenz 1,25 V, R1 240 Ω. Wärme: Tj höchstens 125 °C, RthJG 4 K/W, RthGK 0,5 K/W (TO-220 mit Wärmeleitpaste), Kühlkörperreihe 20/15/10/7/5/3 K/W.
 *   A8  Geräteprüfung vereinfacht: Schutzklasse I, Schutzleiterwiderstand höchstens 0,3 Ω (Leitung bis 5 m), Isolationswiderstand mindestens 1 MΩ. Maßgeblich ist die gültige Prüfnorm des Betriebs (Grenzwerte wie bei der Gerätewiederholungsprüfung nach DIN EN 50699 / VDE 0702). Prüfen nur durch eine Elektrofachkraft oder unter ihrer Aufsicht; Isolationsmessung mit 500 V Gleichspannung am vom Netz getrennten Gerät.
 *   A9  Ein Gerät je Karton, kein Überstand über die Europalette (1200 x 800 mm, 144 mm hoch, 25 kg), Kartons stehend, alle gleich ausgerichtet; Karton und Polster wiegen 0,3 kg.
 *   A10 Ladungssicherung stark vereinfacht wie im Ladungssicherungs-Lab: g = 9,81 m/s², vorwärts 0,8, seitlich 0,5, Niederzurren ohne Winkel und ohne Ratschenverlust, die ganze Sendung als ein Block.
 *       NUR zum Üben; in der Praxis gelten EN 12195-1 und VDI 2700.
 *   A11 Lieferung frei Haus: Tonfunk trägt die Fracht (Preis je Palette). In der Nachkalkulation weichen nur die Fertigungslöhne ab; die Fracht kommt zu den Selbstkosten; der Kunde zahlt ohne Skontoabzug.
 *   A12 Buchungssatz nur mit Kontennamen, ohne Kontonummern (Kontenplan offen). Umsatzsteuer 19 %.
 */
(function (root) {
  'use strict';
  const PID = 'tonfunk';
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
    zf: { l: 180, h: 120 }, ms: [1, 2, 5, 10],                      /* Zeichenfeld in mm, Maßstäbe 1:k */
    rho: 7.85, blechPreis: 1.20, verschnitt: 25,                    /* DC01 */
    tau: 60, nMin: 2,                                               /* Niet: zulässige Scherspannung N/mm², Mindestzahl je Seite */
    stufen: [355, 500, 710, 1000, 1400, 2000, 2800], fB: 0.1, lue: 1,
    uref: 1.25, r1: 240, tj: 125, rjg: 4, rgk: 0.5, kk: [20, 15, 10, 7, 5, 3],
    rpeMax: 0.3, risoMin: 1,
    pal: { l: 1200, b: 800, h: 144, kg: 25 }, mKarton: 0.3, g: 9.81, cv: 0.8, cs: 0.5, ust: 19
  };
  const tol2768 = x => (x <= 6 ? 0.1 : x <= 30 ? 0.2 : x <= 120 ? 0.3 : x <= 400 ? 0.5 : 0.8);   /* ISO 2768-m, Längenmaße */

  /* ---------------------------------------------------------------- Lastenheft */
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x746f6e66), e = level === 1, pk = (fix, list) => (e ? fix : pick(r, list));
    const geh = pk([220, 160, 100], [[220, 160, 100], [240, 180, 110], [260, 200, 120], [200, 150, 90]]);
    const p = {
      stk: pk(200, [120, 160, 200, 240]), aus: pk(5, [4, 5, 8]),
      lep: pk(20, [18, 20, 22.5]), rab: pk(10, [10, 12, 15]), sko: pk(2, [2, 3]), bzk: pk(60, [45, 60, 75]),
      li: geh[0], bi: geh[1], hi: geh[2], s: pk(1, [1, 1.5]),
      dn: pk(4, [4, 5]), fN: pk(2000, [1500, 2000, 2500, 3000]),
      vc: pk(30, [25, 30]), tn: pk(4.5, [3.5, 4, 4.5]), tr: pk(45, [30, 45, 60]), zv: pk(10, [10, 12, 15]),
      lohn: pk(24, [22, 24, 26]), mgk: pk(10, [8, 10, 12]), fgk: pk(150, [120, 150, 180]), vvgk: pk(12, [10, 12, 15]), gew: pk(10, [8, 10, 12]), ksk: pk(2, [2, 3]), krab: pk(5, [5, 8]),
      ua: pk(12, [9, 12, 15]), ia: pk(1, [0.5, 0.8, 1]), tu: level === 3 ? 50 : 40,
      tolU: pk(3, [2, 3, 5]), rpe: pk(0.15, [0.08, 0.15, 0.24, 0.38]), riso: pk(50, [0.5, 2.5, 50, 200]), tPr: pk(4, [3, 4, 5]),
      mw: pk(12, [8, 12, 16]),
      pol: pk(20, [15, 20, 25]), mG: pk(3.2, [2.8, 3.2, 3.6]), hMax: pk(1000, [1000, 1200]), mu: pk(0.3, [0.3, 0.45]), stf: pk(400, [300, 400, 500]), fp: pk(60, [55, 60, 70]),
      abw: pk(10, [5, 10, 15])
    };
    p.ue = p.ua + pk(5, [4, 5, 6]);
    const zug = ceilE(p.stk * (1 + p.aus / 100)) - p.stk;
    p.nDef = Math.max(1, zug - pk(4, [0, 1, 2, 3]));
    /* Stichprobe: zehn Messwerte der Ausgangsspannung, ein oder zwei davon klar außerhalb der Toleranz */
    const nOut = e ? 1 : pick(r, [1, 2]), outAt = [3, 7].slice(0, nOut), offs = [-1.2, -0.8, -0.5, -0.2, 0, 0.2, 0.4, 0.7, 1.0, 1.2];
    p.mess = []; for (let i = 0; i < 10; i++) { const o = outAt.indexOf(i) >= 0 ? (e || r() < 0.5 ? 1 : -1) * (p.tolU + 1.5) : (e ? offs[(i * 3) % 10] : pick(r, offs)); p.mess.push(rd(p.ua * (1 + o / 100), 2)); }
    const text = [
      'Tonfunk-Auftrag, Stufe ' + level + ': Ein Kunde fragt ' + p.stk + ' Labornetzteile im Blechgehäuse an. Lieferung frei Haus auf Europaletten.',
      'Einkauf und Kalkulation: Zugabe für Ausschuss ' + p.aus + ' % (aufrunden). Elektronik-Bausatz je Gerät ' + fm(p.lep, 2) + ' EUR Listenpreis, ' + p.rab + ' % Rabatt, ' + p.sko + ' % Skonto, Bezugskosten ' + fm(p.bzk, 2) + ' EUR für die ganze Lieferung.',
      'Zuschlagssätze: Materialgemeinkosten ' + p.mgk + ' %, Fertigungsgemeinkosten ' + p.fgk + ' %, Verwaltung und Vertrieb zusammen ' + p.vvgk + ' %, Gewinn ' + p.gew + ' %, Kundenskonto ' + p.ksk + ' %, Kundenrabatt ' + p.krab + ' %. Lohnsatz ' + fm(p.lohn, 2) + ' EUR je Stunde.',
      'Gehäuse: Innenmaß ' + p.li + ' x ' + p.bi + ' x ' + p.hi + ' mm (Länge x Breite x Höhe), Stahlblech DC01, Dicke ' + fm(p.s, 1) + ' mm, Innenradius der Biegung = Blechdicke. Dichte 7,85 kg/dm³, 1,20 EUR je kg, Verschnittzuschlag 25 % (A). Zeichenfeld 180 x 120 mm. Allgemeintoleranz ISO 2768-m.',
      'Fügen: Die Haube wird auf beiden Längsseiten genietet. Niet d = ' + p.dn + ' mm, einschnittig, Querkraft je Seite ' + p.fN + ' N, zulässige Scherspannung 60 N/mm² (A), mindestens 2 Niete je Seite.',
      'Bohren: Bohrung = Nietdurchmesser + 0,1 mm, vc = ' + p.vc + ' m/min, Vorschub 0,1 mm je Umdrehung, Überlauf 1 mm, beide Bleche im Paket. Drehzahlstufen der Maschine: 355, 500, 710, 1000, 1400, 2000, 2800 1/min.',
      'Zeiten: Rüstzeit ' + p.tr + ' min, übrige Zeit je Gehäuse (Scheren, Biegen, Nieten, Montieren) ' + fm(p.tn, 1) + ' min, Verteilzeitzuschlag ' + p.zv + ' %.',
      'Schaltung: Ausgang ' + p.ua + ' V bei ' + fm(p.ia, 1) + ' A, Linearregler LM317 mit R1 = 240 Ω, Eingangsspannung am Regler ' + p.ue + ' V. Umgebung im Gehäuse bis ' + p.tu + ' °C, Sperrschicht höchstens 125 °C, RthJG 4 K/W, RthGK 0,5 K/W (A). Kühlkörper gibt es mit 20, 15, 10, 7, 5 und 3 K/W.',
      'Prüfung (Schutzklasse I): Ausgangsspannung ' + p.ua + ' V ± ' + p.tolU + ' %. Am Erstmuster gemessen: Schutzleiterwiderstand ' + fm(p.rpe, 2) + ' Ω, Isolationswiderstand ' + fm(p.riso, 1) + ' MΩ. Prüfzeit je Gerät ' + p.tPr + ' min.',
      'Stichprobe, Ausgangsspannung in V: ' + p.mess.map(x => fm(x, 2)).join(' · ') + '. In der Endprüfung des ganzen Loses fallen ' + p.nDef + ' Geräte durch. Je Gerät speichert der Prüfplatz ' + p.mw + ' Messwerte (ein Datensatz je Messwert).',
      'Versand: ein Gerät je Karton, Polster ' + p.pol + ' mm auf jeder Seite, Gerät ' + fm(p.mG, 1) + ' kg, Karton mit Polster 0,3 kg. Europalette 1200 x 800 mm, 144 mm hoch, 25 kg; Ladehöhe mit Palette höchstens ' + p.hMax + ' mm, kein Überstand.',
      'Ladungssicherung: Reibbeiwert ' + fm(p.mu, 2) + ', Niederzurren mit Gurten STF ' + p.stf + ' daN. Fracht ' + fm(p.fp, 2) + ' EUR je Palette.',
      'Nachkalkulation: Die Fertigungslöhne lagen ' + p.abw + ' % über dem Plan. Die Fracht kommt zu den Selbstkosten.'
    ];
    if (e) text.push('Starthilfe: Rechne jede Station mit den Werten weiter, die vorher übergeben wurden. Geldbeträge nach jedem Schritt auf Cent runden. „Im Hundert“ heißt: Barverkaufspreis : (100 − Skonto) · 100.');
    if (level === 3) text.push('Zusatz Stufe 3: Die Umgebungstemperatur im Gehäuse ist höher angesetzt, die Rechentoleranzen bei der Auswertung deiner Ergebnisse sind enger.');
    return { params: p, text: text };
  }

  /* ---------------------------------------------------------------- Rechenwege: je Station EINE Funktion calc(P, x, v).
     x = Werte der Vorstationen (eigene, sonst Soll), v = Formularwerte dieser Station (für die Kette ohne Folgefehler). Rückgabe: Sollwert je Feld. */
  const CALC = {
    anfrage(P, x, v) {
      const fmS = ceilE(P.stk * (1 + P.aus / 100)), lepG = r2(u(v.fm, fmS) * P.lep), zep = r2(lepG - r2(lepG * P.rab / 100)), zU = u(v.zep, zep), bep = r2(zU - r2(zU * P.sko / 100));
      return { fm: fmS, zep: zep, bep: bep, bzp: r2(u(v.bep, bep) + P.bzk), bind: 'angebot' };
    },
    zeichnung(P, x, v) {
      const la = P.li + 2 * P.s, ba = P.bi + 2 * P.s, ha = P.hi + 2 * P.s, lU = u(v.la, la), hU = u(v.ha, ha);
      const k = FACH.ms.find(m => lU / m <= FACH.zf.l + 1e-9 && hU / m <= FACH.zf.h + 1e-9) || 10, kU = FACH.ms.indexOf(numOf(v.ms)) >= 0 ? numOf(v.ms) : k;
      return { la: la, ba: ba, ha: ha, ms: String(k), zm: lU / kU, menge: x.fm };
    },
    zuschnitt(P, x, v) {
      const r = P.s, lg = 2 * x.ha + x.ba - 2 * (2 * (r + P.s) - Math.PI / 2 * (r + P.s / 2));
      const A = u(v.lg, lg) * P.li + P.bi * P.li + 2 * x.ba * x.ha, mk = A * P.s * FACH.rho / 1e6, t = tol2768(x.ha);
      return { lg: lg, mk: mk, blech: r2(u(v.mk, mk) * FACH.blechPreis * (1 + FACH.verschnitt / 100) * x.fm), hmax: x.ha + t, hmin: x.ha - t };
    },
    fuegen(P, x, v) {
      const a = Math.PI / 4 * P.dn * P.dn, ns = Math.max(FACH.nMin, ceilE(P.fN / (FACH.tau * u(v.a, a)))), ng = 2 * u(v.ns, ns);
      return { a: a, ns: ns, ng: ng, ln: 2 * P.s + 1.5 * P.dn, na: u(v.ng, ng) * x.fm };
    },
    fertigung(P, x, v) {
      const d = P.dn + 0.1, nr = P.vc * 1000 / (Math.PI * d), st = FACH.stufen.filter(s => s <= nr).pop() || FACH.stufen[0], stU = FACH.stufen.indexOf(numOf(v.nst)) >= 0 ? numOf(v.nst) : st;
      const th = (2 * P.s + 0.3 * d + FACH.lue) / (FACH.fB * stU) * 60, te = (x.ng * u(v.th, th) / 60 + P.tn) * (1 + P.zv / 100);
      return { nr: nr, nst: String(st), th: th, te: te, t: (P.tr + x.fm * u(v.te, te)) / 60 };
    },
    angebot(P, x, v) {
      const mek = r2(x.bzp + x.blech), fl = r2(x.t * P.lohn), mU = u(v.mek, mek), fU = u(v.fl, fl);
      const hk = r2(mU + r2(mU * P.mgk / 100) + fU + r2(fU * P.fgk / 100)), hU = u(v.hk, hk), sk = r2(hU + r2(hU * P.vvgk / 100)), sU = u(v.sk, sk);
      const bvp = r2(sU + r2(sU * P.gew / 100)), zvp = r2(bvp * 100 / (100 - P.ksk)), lvp = r2(zvp * 100 / (100 - P.krab));
      return { mek: mek, fl: fl, hk: hk, sk: sk, lvp: lvp, stkp: r2(u(v.lvp, lvp) / P.stk) };
    },
    schaltung(P, x, v) {
      const pv = (P.ue - P.ua) * P.ia, rth = (FACH.tj - P.tu) / u(v.pv, pv) - FACH.rjg - FACH.rgk, kk = FACH.kk.find(k => k <= rth + 1e-9) || FACH.kk[FACH.kk.length - 1];
      return { r2: FACH.r1 * (P.ua / FACH.uref - 1), pv: pv, rth: rth, kk: String(kk), eta: P.ua / P.ue * 100 };
    },
    pruefung(P, x, v) {
      return { umin: P.ua * (1 - P.tolU / 100), umax: P.ua * (1 + P.tolU / 100), rpe: P.rpe <= FACH.rpeMax ? 'ok' : 'nok', riso: P.riso >= FACH.risoMin ? 'ok' : 'nok', tp: x.fm * P.tPr / 60 };
    },
    daten(P, x, v) {
      const m = Array.isArray(P.mess) ? P.mess : [], lo = P.ua * (1 - P.tolU / 100), hi = P.ua * (1 + P.tolU / 100);
      return { mittel: m.length ? m.reduce((a, b) => a + b, 0) / m.length : NaN, naus: m.filter(y => y < lo - 1e-9 || y > hi + 1e-9).length, quote: P.nDef / x.fm * 100, gut: x.fm - P.nDef, zeilen: x.fm * P.mw, sql: 'count' };
    },
    verpackung(P, x, v) {
      const kl = x.la + 2 * P.pol, kb = x.ba + 2 * P.pol, kh = x.ha + 2 * P.pol, lU = u(v.kl, kl), hU = u(v.kh, kh), E = FACH.pal;
      const lage = Math.max(floorE(E.l / lU) * floorE(E.b / kb), floorE(E.l / kb) * floorE(E.b / lU)), lagen = floorE((P.hMax - E.h) / hU);
      const je = u(v.lage, lage) * u(v.lagen, lagen), pal = je > 0 ? ceilE(P.stk / je) : NaN;
      return { kl: kl, kh: kh, lage: lage, lagen: lagen, pal: pal, brutto: P.stk * (P.mG + FACH.mKarton) + u(v.pal, pal) * E.kg };
    },
    ladung(P, x, v) {
      const fv = x.brutto * FACH.g * (FACH.cv - P.mu);
      return { fv: fv, fs: x.brutto * FACH.g * (FACH.cs - P.mu), n: Math.max(1, ceilE(u(v.fv, fv) / (2 * P.mu * P.stf * 10))), fracht: r2(x.pal * P.fp) };
    },
    rechnung(P, x, v) {
      const list = r2(P.stk * x.stkp), netto = r2(list - r2(list * P.krab / 100)), nU = u(v.netto, netto), ust = r2(nU * FACH.ust / 100);
      const flI = r2(x.fl * (1 + P.abw / 100)), hkI = r2(x.mek + r2(x.mek * P.mgk / 100) + flI + r2(flI * P.fgk / 100)), skI = r2(hkI + r2(hkI * P.vvgk / 100) + x.fracht);
      return { netto: netto, ust: ust, brutto: r2(nU + u(v.ust, ust)), soll: 'ford', haben: 'erloes_ust', skist: skI, gewinn: r2(nU - u(v.skist, skI)) };
    }
  };
  const ORDER = ['anfrage', 'zeichnung', 'zuschnitt', 'fuegen', 'fertigung', 'angebot', 'schaltung', 'pruefung', 'daten', 'verpackung', 'ladung', 'rechnung'];
  /* Welche Werte eine Station an spätere weitergibt (Schlüssel in x) */
  const GIVES = { anfrage: ['fm', 'bzp'], zeichnung: ['la', 'ba', 'ha'], zuschnitt: ['blech'], fuegen: ['ng'], fertigung: ['t'], angebot: ['mek', 'fl', 'stkp'], verpackung: ['pal', 'brutto'], ladung: ['fracht'] };
  /* x aufbauen: eigene Werte aus den übergebenen Slots, wo sie fehlen der Sollwert aus der bisherigen Kette */
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
    /* Musterlösung Feld für Feld: jeder Wert wird so gerundet eingetragen, wie ein Azubi ihn schreibt, und die Folgefelder rechnen mit dem gerundeten Wert weiter */
    st.solution = function (ctx) {
      const P = P_(ctx), x = inputs(P, ctx), v = {};
      st.rows.forEach(r => { const s = calc(P, x, v)[r.k]; v[r.k] = r.t === 'sel' ? String(s) : r.t === 'int' ? Math.round(s) : rd(s, r.dec == null ? 2 : r.dec); });
      return { vals: v, tasks: tasksDone(st) };
    };
    return st;
  }
  const O = (value, label) => ({ value: value, label: label });
  const mut = (name, k, f, label) => ({ name: name, mutate: d => { d.vals[k] = f(d.vals[k], d.vals); return d; }, expectFail: [label] });

  /* ---------------------------------------------------------------- Stationen (Reihenfolge = Weg des Auftrags durch den Betrieb) */
  const STATIONS = [
    { id: 'vz1', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Anfrage prüfen und Material beschaffen', level: 1,
      on: 'vb', beruf: ['ik'], in: [], out: 'tonfunk.anfrage', type: 'vb.form', w: 100, pass: null,
      text: 'Die Anfrage des Kunden liegt auf deinem Tisch. Lege die Fertigungsmenge fest (Liefermenge plus Zugabe für Ausschuss, aufrunden) und rechne den Bezugspreis der Elektronik-Bausätze für die ganze Fertigungsmenge aus: Zieleinkaufspreis, Bareinkaufspreis, Bezugspreis. Entscheide außerdem, wodurch sich Tonfunk rechtlich bindet.',
      kollege: 'Die Kaufleute haben die Anfrage geprüft, die Fertigungsmenge mit Zugabe festgelegt und die Bausätze zum Bezugspreis eingekauft.',
      tasks: [{ lab: 'rec', id: 'rec1', min: 70 }, { lab: 'kal', id: 'kal3', min: 70 }],
      rows: [
        { k: 'fm', label: 'Fertigungsmenge', t: 'int', unit: 'Stück', pts: 15 },
        { k: 'zep', label: 'Zieleinkaufspreis', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 15 },
        { k: 'bep', label: 'Bareinkaufspreis', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 15 },
        { k: 'bzp', label: 'Bezugspreis der Bausätze', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 15 },
        { k: 'bind', label: 'Rechtliche Bindung', t: 'sel', pts: 10, opts: [O('anfrage', 'Schon die Anfrage des Kunden bindet beide Seiten'), O('angebot', 'Erst unser verbindliches Angebot bindet uns'), O('rechnung', 'Erst die Rechnung bindet uns'), O('nie', 'Ohne Unterschrift bindet nichts')] }
      ],
      hint: ['Die Zugabe ist ein Prozentsatz der Liefermenge. Ein halbes Gerät gibt es nicht, also wird aufgerundet. Der Einkauf rechnet dann mit dieser Fertigungsmenge.', 'Bezugskalkulation von oben nach unten: Listenpreis der ganzen Menge, minus Rabatt, minus Skonto vom verminderten Betrag, plus Bezugskosten.', 'Der Skonto wird vom Zieleinkaufspreis gerechnet, nicht vom Listenpreis. Eine Anfrage ist unverbindlich; gebunden ist, wer ein Angebot ohne Einschränkung abgibt.'],
      mutants: [mut('Zugabe vergessen', 'fm', (a, v) => a - 5, 'Fertigungsmenge'), mut('Skonto vom Listenpreis', 'bep', a => a - 9, 'Bareinkaufspreis'), mut('Bezugskosten abgezogen', 'bzp', a => a - 100, 'Bezugspreis der Bausätze'), mut('Anfrage für bindend gehalten', 'bind', () => 'anfrage', 'Rechtliche Bindung')] },
    { id: 'vz2', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Gehäuse zeichnen', level: 1,
      on: 'vb', beruf: ['tpd'], in: ['tonfunk.anfrage'], out: 'tonfunk.zeichnung', type: 'vb.form', w: 100, pass: null,
      text: 'Aus dem Innenmaß im Lastenheft wird die Zeichnung des Gehäuses. Bestimme die Außenmaße (Blechdicke auf beiden Seiten), wähle den größten Maßstab, bei dem die Vorderansicht (Länge mal Höhe) in das Zeichenfeld passt, und gib das Zeichnungsmaß der Länge an. In die Stückliste gehört die Fertigungsmenge aus der Anfrage.',
      kollege: 'Die Produktdesigner haben aus dem Innenmaß die Außenmaße bestimmt, den Maßstab gewählt und die Zeichnung mit Stückliste angelegt.',
      tasks: [{ lab: 'zei', id: 'zei22', min: 70 }, { lab: 'zei', id: 'zei24', min: 70 }],
      rows: [
        { k: 'la', label: 'Außenlänge', unit: 'mm', abs: 0.01, dec: 1, pts: 12 },
        { k: 'ba', label: 'Außenbreite', unit: 'mm', abs: 0.01, dec: 1, pts: 10 },
        { k: 'ha', label: 'Außenhöhe', unit: 'mm', abs: 0.01, dec: 1, pts: 12 },
        { k: 'ms', label: 'Maßstab', t: 'sel', pts: 14, opts: [O('1', '1:1'), O('2', '1:2'), O('5', '1:5'), O('10', '1:10')] },
        { k: 'zm', label: 'Zeichnungsmaß der Länge', unit: 'mm', abs: 0.06, dec: 1, pts: 12 },
        { k: 'menge', label: 'Menge in der Stückliste', t: 'int', unit: 'Stück', pts: 10 }
      ],
      hint: ['Das Blech sitzt außen um den Innenraum herum. Auf jeder Seite kommt eine Blechdicke dazu.', 'Außenmaß = Innenmaß + 2 · Blechdicke. Teile Länge und Höhe durch die Maßstabszahl und vergleiche mit dem Zeichenfeld.', 'Beginne mit 1:1 und gehe erst zum nächsten Maßstab, wenn Länge oder Höhe nicht passt. Zeichnungsmaß = Außenlänge geteilt durch die Maßstabszahl.'],
      mutants: [mut('Blechdicke nur einmal', 'la', (a, v) => a - 1, 'Außenlänge'), mut('Maßstab zu klein gewählt', 'ms', a => (a === '10' ? '5' : '10'), 'Maßstab'), mut('Zeichnungsmaß verdoppelt', 'zm', a => a * 2, 'Zeichnungsmaß der Länge'), mut('Liefermenge statt Fertigungsmenge', 'menge', a => a - 3, 'Menge in der Stückliste')] },
    { id: 'vz3', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Zuschnitt und Toleranz', level: 2,
      on: 'vb', beruf: ['tpd'], in: ['tonfunk.zeichnung', 'tonfunk.anfrage'], out: 'tonfunk.zuschnitt', type: 'vb.form', w: 100, pass: null,
      text: 'Die Haube ist ein U-Profil: zwei Schenkel so hoch wie die Außenhöhe, der Boden so breit wie die Außenbreite, die Haubenlänge ist die Innenlänge. Rechne die gestreckte Länge (neutrale Faser in der Blechmitte), die Masse eines Gehäuses aus Haube, Bodenblech (Innenbreite mal Innenlänge) und zwei Stirnplatten (Außenbreite mal Außenhöhe) und die Blechkosten für die Fertigungsmenge mit Verschnittzuschlag. Gib für die Außenhöhe Höchst- und Mindestmaß nach ISO 2768-m an.',
      kollege: 'Die Produktdesigner haben die Haube abgewickelt, Masse und Blechkosten bestimmt und die Grenzmaße der Außenhöhe eingetragen.',
      tasks: [{ lab: 'zei', id: 'zei44', min: 70 }, { lab: 'tol', id: 'tol10', min: 70 }],
      rows: [
        { k: 'lg', label: 'Gestreckte Länge der Haube', unit: 'mm', abs: 0.5, dec: 2, pts: 18 },
        { k: 'mk', label: 'Masse eines Gehäuses', unit: 'kg', rel: 0.01, dec: 3, pts: 14 },
        { k: 'blech', label: 'Blechkosten für den Auftrag', unit: 'EUR', rel: 0.01, pts: 14 },
        { k: 'hmax', label: 'Höchstmaß der Außenhöhe', unit: 'mm', abs: 0.01, dec: 1, pts: 12 },
        { k: 'hmin', label: 'Mindestmaß der Außenhöhe', unit: 'mm', abs: 0.01, dec: 1, pts: 12 }
      ],
      hint: ['Beim Biegen bleibt nur die neutrale Faser gleich lang. Zähle erst die Außenmaße zusammen und ziehe je Biegung ab, was die Ecke gegenüber dem Bogen zu lang ist.', 'Je 90-Grad-Biegung: Abzug = 2 · (r + s) − π/2 · (r + s/2). Masse = Fläche · Dicke · Dichte, auf die Einheiten achten (mm³ in dm³).', 'Blechkosten = Masse · Preis je kg · 1,25 · Fertigungsmenge. Die Toleranz hängt vom Nennmaßbereich ab: die Grenze liegt bei 120 mm.'],
      mutants: [mut('Biegungen nicht abgezogen', 'lg', a => a + 3.3, 'Gestreckte Länge der Haube'), mut('Masse in Gramm verrechnet', 'mk', a => a * 10, 'Masse eines Gehäuses'), mut('Verschnitt vergessen', 'blech', a => r2(a / 1.25), 'Blechkosten für den Auftrag'), mut('Falscher Toleranzbereich', 'hmax', a => a + 0.2, 'Höchstmaß der Außenhöhe')] },
    { id: 'vz4', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Fügen: Nietverbindung auslegen', level: 2,
      on: 'vb', beruf: ['im'], in: ['tonfunk.anfrage'], out: 'tonfunk.fuegen', type: 'vb.form', w: 100, pass: null,
      text: 'Die Haube wird auf beiden Längsseiten mit dem Unterteil vernietet. Rechne die Scherfläche eines Niets, die Zahl der Niete je Seite (aufrunden, Mindestzahl beachten), die Niete je Gehäuse, die Nietlänge für zwei Blechdicken und den Bedarf an Nieten für die ganze Fertigungsmenge.',
      kollege: 'Die Industriemechaniker haben die Nietverbindung der Haube ausgelegt und den Nietbedarf für das Los bestimmt.',
      tasks: [{ lab: 'fug', id: 'fug26', min: 70 }, { lab: 'fug', id: 'fug24', min: 70 }],
      rows: [
        { k: 'a', label: 'Scherfläche eines Niets', unit: 'mm²', rel: 0.01, pts: 14 },
        { k: 'ns', label: 'Niete je Seite', t: 'int', unit: 'Stück', pts: 18 },
        { k: 'ng', label: 'Niete je Gehäuse', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'ln', label: 'Nietlänge', unit: 'mm', abs: 0.05, dec: 1, pts: 14 },
        { k: 'na', label: 'Niete für den Auftrag', t: 'int', unit: 'Stück', pts: 12 }
      ],
      hint: ['Ein Niet wird quer zum Schaft abgeschert. Tragend ist der Kreisquerschnitt des Schafts.', 'Zulässige Kraft eines Niets = Scherfläche · zulässige Scherspannung. Niete je Seite = Querkraft geteilt durch diese Kraft, aufgerundet.', 'Nietlänge = Summe der Blechdicken + 1,5 · Nietdurchmesser. Für den Auftrag zählt die Fertigungsmenge, nicht die Liefermenge.'],
      mutants: [mut('Durchmesser statt Radius quadriert', 'a', a => a * 4, 'Scherfläche eines Niets'), mut('Abgerundet statt aufgerundet', 'ns', a => a - 1, 'Niete je Seite'), mut('Nur eine Seite gezählt', 'ng', (a, v) => v.ns, 'Niete je Gehäuse'), mut('Überstand vergessen', 'ln', (a, v) => a - 3, 'Nietlänge')] },
    { id: 'vz5', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Fertigung: Schnittdaten und Auftragszeit', level: 2,
      on: 'vb', beruf: ['im'], in: ['tonfunk.fuegen', 'tonfunk.anfrage'], out: 'tonfunk.fertigung', type: 'vb.form', w: 100, pass: null,
      text: 'Die Nietlöcher werden gebohrt, beide Bleche im Paket. Rechne die Drehzahl aus der Schnittgeschwindigkeit, wähle die nächstniedrigere Stufe der Maschine und rechne damit die Bohrzeit je Loch (Bohrweg = zwei Blechdicken + Anschnitt 0,3 · d + Überlauf). Zeit je Gehäuse = (Bohrzeit aller Löcher + übrige Zeit) · (1 + Verteilzeitzuschlag in Prozent : 100). Daraus folgt die Auftragszeit mit Rüstzeit für die ganze Fertigungsmenge.',
      kollege: 'Die Industriemechaniker haben die Bohrdaten eingestellt und die Auftragszeit für das ganze Los geplant.',
      tasks: [{ lab: 'zer', id: 'zer24', min: 70 }, { lab: 'fer', id: 'fer23', min: 70 }],
      rows: [
        { k: 'nr', label: 'Rechnerische Drehzahl', unit: '1/min', rel: 0.01, dec: 0, pts: 14 },
        { k: 'nst', label: 'Drehzahlstufe', t: 'sel', pts: 12, opts: FACH.stufen.map(s => O(String(s), s + ' 1/min')) },
        { k: 'th', label: 'Bohrzeit je Loch', unit: 's', rel: 0.02, dec: 2, pts: 14 },
        { k: 'te', label: 'Zeit je Gehäuse', unit: 'min', rel: 0.01, dec: 2, pts: 14 },
        { k: 't', label: 'Auftragszeit', unit: 'h', rel: 0.01, dec: 2, pts: 16 }
      ],
      hint: ['Die Schnittgeschwindigkeit ist der Weg der Schneide am Umfang je Minute. Kleine Bohrer brauchen hohe Drehzahlen.', 'n = vc · 1000 / (π · d). Bohrzeit = Bohrweg / (Vorschub · Drehzahl), Ergebnis in Minuten, dann in Sekunden umrechnen.', 'Auftragszeit = Rüstzeit + Fertigungsmenge · Zeit je Gehäuse. Die Rüstzeit fällt nur einmal an; am Ende von Minuten in Stunden umrechnen.'],
      mutants: [mut('Durchmesser in m gelassen', 'nr', a => a / 10, 'Rechnerische Drehzahl'), mut('Nächsthöhere Stufe gewählt', 'nst', a => String(FACH.stufen[Math.min(FACH.stufen.length - 1, FACH.stufen.indexOf(+a) + 1)] === +a ? FACH.stufen[0] : FACH.stufen[Math.min(FACH.stufen.length - 1, FACH.stufen.indexOf(+a) + 1)]), 'Drehzahlstufe'), mut('Bohrzeit in Minuten eingetragen', 'th', a => a / 60, 'Bohrzeit je Loch'), mut('Rüstzeit je Stück gerechnet', 't', a => a * 3, 'Auftragszeit')] },
    { id: 'vz6', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Angebotspreis kalkulieren', level: 3,
      on: 'vb', beruf: ['ik'], in: ['tonfunk.anfrage', 'tonfunk.zuschnitt', 'tonfunk.fertigung'], out: 'tonfunk.angebot', type: 'vb.form', w: 100, pass: null,
      text: 'Jetzt liegen alle Zahlen für das Angebot vor: Bezugspreis der Bausätze, Blechkosten und Auftragszeit. Kalkuliere den Auftrag mit den Zuschlagssätzen aus dem Lastenheft: Materialeinzelkosten, Fertigungslöhne (Auftragszeit mal Lohnsatz), Herstellkosten, Selbstkosten, Listenverkaufspreis (Gewinn, dann Kundenskonto und Kundenrabatt im Hundert) und den Angebotspreis je Stück für die Liefermenge. Runde jeden Schritt auf Cent.',
      kollege: 'Die Kaufleute haben aus Material, Auftragszeit und Zuschlagssätzen den Angebotspreis je Stück kalkuliert.',
      tasks: [{ lab: 'kal', id: 'kal7', min: 70 }, { lab: 'kal', id: 'kal13', min: 70 }],
      rows: [
        { k: 'mek', label: 'Materialeinzelkosten', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 10 },
        { k: 'fl', label: 'Fertigungslöhne', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 10 },
        { k: 'hk', label: 'Herstellkosten', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 12 },
        { k: 'sk', label: 'Selbstkosten', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 12 },
        { k: 'lvp', label: 'Listenverkaufspreis des Auftrags', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 16 },
        { k: 'stkp', label: 'Angebotspreis je Stück', unit: 'EUR', abs: 0.015, pts: 10 }
      ],
      hint: ['Das Schema läuft von den Einzelkosten über die Gemeinkosten zu den Selbstkosten und dann vorwärts zum Verkaufspreis.', 'Herstellkosten = Material mit Materialgemeinkosten + Löhne mit Fertigungsgemeinkosten. Selbstkosten = Herstellkosten + Zuschlag für Verwaltung und Vertrieb.', 'Skonto und Rabatt des Kunden werden im Hundert gerechnet: Betrag : (100 − Satz) · 100. Je Stück teilst du durch die Liefermenge, nicht durch die Fertigungsmenge.'],
      mutants: [mut('Blech vergessen', 'mek', a => a - 200, 'Materialeinzelkosten'), mut('Gemeinkosten vergessen', 'hk', (a, v) => r2(v.mek + v.fl), 'Herstellkosten'), mut('Skonto und Rabatt vom Hundert', 'lvp', a => r2(a * 0.996), 'Listenverkaufspreis des Auftrags'), mut('Durch die Fertigungsmenge geteilt', 'stkp', a => r2(a * 0.95), 'Angebotspreis je Stück')] },
    { id: 'vz7', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Schaltung auslegen', level: 2,
      on: 'vb', beruf: ['egs', 'ige'], in: ['tonfunk.angebot'], out: 'tonfunk.schaltung', type: 'vb.form', w: 100, pass: null,
      text: 'Der Auftrag ist erteilt, die Schaltung wird festgelegt. Rechne den Einstellwiderstand R2 des LM317 für die Ausgangsspannung, die Verlustleistung des Reglers bei Nennstrom und den größten Wärmewiderstand, den der Kühlkörper haben darf. Wähle aus der Reihe den kleinsten Kühlkörper, der noch reicht (größter zulässiger Wert in K/W), und gib den Wirkungsgrad des Reglers an.',
      kollege: 'Die Elektroniker haben den Regler eingestellt, die Verlustleistung bestimmt und den Kühlkörper gewählt.',
      tasks: [{ lab: 'ssl', id: 'ssl14', min: 70 }, { lab: 'ssl', id: 'ssl15', min: 70 }],
      rows: [
        { k: 'r2', label: 'Einstellwiderstand R2', unit: 'Ω', rel: 0.02, dec: 0, pts: 16 },
        { k: 'pv', label: 'Verlustleistung des Reglers', unit: 'W', rel: 0.02, dec: 2, pts: 16 },
        { k: 'rth', label: 'Größter Wärmewiderstand des Kühlkörpers', unit: 'K/W', rel: 0.02, dec: 2, pts: 16 },
        { k: 'kk', label: 'Gewählter Kühlkörper', t: 'sel', pts: 12, opts: FACH.kk.map(k => O(String(k), k + ' K/W')) },
        { k: 'eta', label: 'Wirkungsgrad des Reglers', unit: '%', rel: 0.02, dec: 1, pts: 10 }
      ],
      hint: ['Am Linearregler fällt die Differenz zwischen Eingang und Ausgang ab. Diese Spannung mal Laststrom wird Wärme.', 'LM317: Ua = 1,25 V · (1 + R2 / R1), nach R2 umstellen. Wärmekette: Temperaturunterschied = Verlustleistung · Summe der Wärmewiderstände.', 'Vom gesamten Wärmewiderstand ziehst du die Anteile Sperrschicht-Gehäuse und Gehäuse-Kühlkörper ab. Ein Kühlkörper mit kleinerem K/W-Wert kühlt besser, ist aber größer und teurer.'],
      mutants: [mut('Referenzspannung nicht abgezogen', 'r2', a => a + 240, 'Einstellwiderstand R2'), mut('Ausgangsleistung statt Verlustleistung', 'pv', a => a * 2.6, 'Verlustleistung des Reglers'), mut('Innere Wärmewiderstände vergessen', 'rth', a => a + 4.5, 'Größter Wärmewiderstand des Kühlkörpers'), mut('Zu kleiner Kühlkörper', 'kk', a => String(FACH.kk[Math.max(0, FACH.kk.indexOf(+a) - 1)] === +a ? 3 : FACH.kk[Math.max(0, FACH.kk.indexOf(+a) - 1)]), 'Gewählter Kühlkörper')] },
    { id: 'vz8', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Prüfen und Messen', level: 2,
      on: 'vb', beruf: ['egs', 'ige'], in: ['tonfunk.schaltung', 'tonfunk.anfrage'], out: 'tonfunk.pruefung', type: 'vb.form', w: 100, pass: null,
      text: 'Bevor die Serie läuft, wird das Erstmuster geprüft und der Prüfplan festgelegt. Rechne die Grenzen der Ausgangsspannung aus der Toleranz, bewerte die Messwerte von Schutzleiter- und Isolationswiderstand (Gerät der Schutzklasse I im Blechgehäuse) und rechne die Prüfzeit für die ganze Fertigungsmenge in Stunden. Sicherheit: Geräte prüfen darf nur eine Elektrofachkraft oder eine Person unter ihrer Aufsicht; die Isolationsmessung läuft mit 500 V Gleichspannung am vom Netz getrennten Gerät.',
      kollege: 'Die Elektroniker haben die Prüfgrenzen festgelegt, das Erstmuster auf Schutzleiter und Isolation geprüft und die Prüfzeit geplant.',
      tasks: [{ lab: 'ssl', id: 'ssl36', min: 70 }, { lab: 'mat', id: 'mat43', min: 70 }],
      rows: [
        { k: 'umin', label: 'Untere Grenze der Ausgangsspannung', unit: 'V', abs: 0.011, pts: 15 },
        { k: 'umax', label: 'Obere Grenze der Ausgangsspannung', unit: 'V', abs: 0.011, pts: 15 },
        { k: 'rpe', label: 'Schutzleiterwiderstand', t: 'sel', pts: 15, opts: [O('ok', 'bestanden'), O('nok', 'nicht bestanden, nacharbeiten')] },
        { k: 'riso', label: 'Isolationswiderstand', t: 'sel', pts: 15, opts: [O('ok', 'bestanden'), O('nok', 'nicht bestanden, nacharbeiten')] },
        { k: 'tp', label: 'Prüfzeit für das Los', unit: 'h', rel: 0.01, dec: 2, pts: 10 }
      ],
      hint: ['Die Toleranz in Prozent gilt nach oben und nach unten um den Nennwert.', 'Grenze = Nennspannung · (1 ± Toleranz / 100). Der Schutzleiter muss niederohmig sein, die Isolation hochohmig: Der eine Messwert muss unter seinem Grenzwert liegen, der andere darüber.', 'Für Schutzklasse I gelten hier höchstens 0,3 Ω am Schutzleiter und mindestens 1 MΩ Isolation. Die Prüfzeit rechnest du mit der Fertigungsmenge, in Stunden.'],
      mutants: [mut('Toleranz in Volt statt Prozent', 'umin', (a, v) => a - 1, 'Untere Grenze der Ausgangsspannung'), mut('Schutzleiter falsch bewertet', 'rpe', a => (a === 'ok' ? 'nok' : 'ok'), 'Schutzleiterwiderstand'), mut('Isolation falsch bewertet', 'riso', a => (a === 'ok' ? 'nok' : 'ok'), 'Isolationswiderstand'), mut('Prüfzeit in Minuten', 'tp', a => a * 60, 'Prüfzeit für das Los')] },
    { id: 'vz9', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Prüfdaten auswerten', level: 2,
      on: 'vb', beruf: ['fi'], in: ['tonfunk.pruefung', 'tonfunk.anfrage'], out: 'tonfunk.daten', type: 'vb.form', w: 100, pass: null,
      text: 'Der Prüfplatz schreibt alle Messwerte in eine Datenbank. Werte die Stichprobe aus dem Lastenheft aus: Mittelwert der Ausgangsspannung und Zahl der Werte außerhalb der Grenzen. Rechne für das ganze Los die Ausschussquote, die Zahl der Gutteile und die Zahl der Datensätze in der Messwert-Tabelle. In der Tabelle pruefung steht je Gerät eine Zeile; die Spalte ergebnis enthält "iO" oder "niO". Wähle die Abfrage, die die durchgefallenen Geräte zählt.',
      kollege: 'Die Fachinformatiker haben die Prüfdaten ausgewertet: Mittelwert, Ausschussquote, Gutteile und Umfang der Messwert-Tabelle.',
      tasks: [{ lab: 'sql', id: 'sql17', min: 70 }, { lab: 'alg', id: 'alg6', min: 70 }],
      rows: [
        { k: 'mittel', label: 'Mittelwert der Stichprobe', unit: 'V', abs: 0.006, dec: 3, pts: 14 },
        { k: 'naus', label: 'Werte außerhalb der Grenzen', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'quote', label: 'Ausschussquote des Loses', unit: '%', abs: 0.06, pts: 12 },
        { k: 'gut', label: 'Gutteile', t: 'int', unit: 'Stück', pts: 10 },
        { k: 'zeilen', label: 'Datensätze in der Messwert-Tabelle', t: 'int', pts: 10 },
        { k: 'sql', label: 'Abfrage für die durchgefallenen Geräte', t: 'sel', pts: 12, opts: [O('sum', 'SELECT SUM(ergebnis) FROM pruefung;'), O('count', 'SELECT COUNT(*) FROM pruefung WHERE ergebnis = \'niO\';'), O('order', 'SELECT * FROM pruefung ORDER BY ergebnis;'), O('group', 'SELECT geraet_id FROM pruefung GROUP BY geraet_id;')] }
      ],
      hint: ['Der Mittelwert ist die Summe aller Werte geteilt durch ihre Anzahl. Für die Grenzen gilt dieselbe Toleranz wie in der Prüfstation.', 'Ausschussquote = durchgefallene Geräte / geprüfte Geräte · 100. Geprüft wird die ganze Fertigungsmenge.', 'Datensätze = Geräte · Messwerte je Gerät. Zum Zählen brauchst du eine Aggregatfunktion und eine Bedingung, die nur die durchgefallenen Zeilen auswählt.'],
      mutants: [mut('Durch neun geteilt', 'mittel', a => a * 10 / 9, 'Mittelwert der Stichprobe'), mut('Ausreißer nicht erkannt', 'naus', a => a - 1, 'Werte außerhalb der Grenzen'), mut('Quote auf die Liefermenge bezogen', 'quote', a => a * 1.2, 'Ausschussquote des Loses'), mut('Sortieren statt zählen', 'sql', () => 'order', 'Abfrage für die durchgefallenen Geräte')] },
    { id: 'vz10', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Verpacken und Palettieren', level: 2,
      on: 'vb', beruf: ['fll'], in: ['tonfunk.zeichnung', 'tonfunk.daten'], out: 'tonfunk.verpackung', type: 'vb.form', w: 100, pass: null,
      text: 'Die geprüften Geräte gehen in den Versand. Der Karton ist in Länge, Breite und Höhe um zwei Polsterdicken größer als das Gehäuse (Außenmaße aus der Zeichnung). Rechne Kartonlänge und Kartonhöhe, die größte Zahl Kartons je Lage auf der Europalette (beide Ausrichtungen probieren, kein Überstand), die Zahl der Lagen bis zur Ladehöhe, die Zahl der Paletten für die Liefermenge und das Gewicht der ganzen Sendung.',
      kollege: 'Die Fachkräfte für Lagerlogistik haben die Geräte verpackt, auf Europaletten gestapelt und das Sendungsgewicht ermittelt.',
      tasks: [{ lab: 'lad', id: 'lad21', min: 70 }, { lab: 'lad', id: 'lad22', min: 70 }],
      rows: [
        { k: 'kl', label: 'Kartonlänge', unit: 'mm', abs: 0.01, dec: 1, pts: 10 },
        { k: 'kh', label: 'Kartonhöhe', unit: 'mm', abs: 0.01, dec: 1, pts: 10 },
        { k: 'lage', label: 'Kartons je Lage', t: 'int', unit: 'Stück', pts: 14 },
        { k: 'lagen', label: 'Lagen je Palette', t: 'int', pts: 12 },
        { k: 'pal', label: 'Paletten', t: 'int', unit: 'Stück', pts: 12 },
        { k: 'brutto', label: 'Gewicht der Sendung', unit: 'kg', rel: 0.005, dec: 1, pts: 12 }
      ],
      hint: ['Das Polster liegt auf jeder Seite, also zweimal je Richtung. Auf die Palette passen nur ganze Kartons.', 'Je Lage: abrunden(1200 / Kartonlänge) · abrunden(800 / Kartonbreite), dann den Karton um 90 Grad drehen und noch einmal rechnen. Lagen = abrunden((Ladehöhe − Palettenhöhe) / Kartonhöhe).', 'Paletten = Liefermenge / Kartons je Palette, aufgerundet. Gewicht = Liefermenge · (Gerät + Karton) + Paletten · 25 kg.'],
      mutants: [mut('Polster nur einmal', 'kl', (a, v) => a - 20, 'Kartonlänge'), mut('Palettenhöhe vergessen', 'lagen', a => a + 1, 'Lagen je Palette'), mut('Paletten abgerundet', 'pal', a => a - 1, 'Paletten'), mut('Paletten nicht mitgewogen', 'brutto', (a, v) => a - 25 * v.pal, 'Gewicht der Sendung')] },
    { id: 'vz11', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Ladung sichern und Fracht rechnen', level: 3,
      on: 'vb', beruf: ['fll'], in: ['tonfunk.verpackung'], out: 'tonfunk.ladung', type: 'vb.form', w: 100, pass: null,
      text: 'Die Sendung wird verladen. Rechne mit dem Sendungsgewicht aus der Verpackung die Kraft, die die Zurrmittel nach vorn und zur Seite aufnehmen müssen (Beschleunigungsbeiwert 0,8 vorwärts, 0,5 seitlich, Reibung abziehen). Bestimme die Zahl der Gurte beim Niederzurren für die Vorwärtsrichtung und die Frachtkosten für alle Paletten. Das ist eine vereinfachte Übungsrechnung (A); im Betrieb gelten Norm und Betriebsanweisung.',
      kollege: 'Die Fachkräfte für Lagerlogistik haben die Sicherungskräfte gerechnet, die Zurrgurte festgelegt und die Fracht ermittelt.',
      tasks: [{ lab: 'lad', id: 'lad5', min: 70 }, { lab: 'lad', id: 'lad14', min: 70 }],
      rows: [
        { k: 'fv', label: 'Sicherungskraft vorwärts', unit: 'N', rel: 0.01, dec: 0, pts: 20 },
        { k: 'fs', label: 'Sicherungskraft seitlich', unit: 'N', rel: 0.01, abs: 1, dec: 0, pts: 16 },
        { k: 'n', label: 'Gurte beim Niederzurren', t: 'int', unit: 'Stück', pts: 20 },
        { k: 'fracht', label: 'Frachtkosten', unit: 'EUR', abs: 0.05, pts: 14 }
      ],
      hint: ['Beim Bremsen will die Ladung nach vorn. Ein Teil der Kraft wird schon durch die Reibung auf der Ladefläche gehalten.', 'F = m · g · (c − µ) mit g = 9,81 m/s². Vorwärts c = 0,8, seitlich c = 0,5.', 'Niederzurren: Gurte = F / (2 · µ · STF · 10), aufrunden. STF steht in daN, deshalb der Faktor 10 für Newton. Fracht = Paletten · Preis je Palette.'],
      mutants: [mut('Reibung nicht abgezogen', 'fv', a => a * 1.6, 'Sicherungskraft vorwärts'), mut('Seitlich wie vorwärts', 'fs', (a, v) => v.fv, 'Sicherungskraft seitlich'), mut('Gurte abgerundet', 'n', a => a - 1, 'Gurte beim Niederzurren'), mut('Fracht je Karton', 'fracht', a => a * 10, 'Frachtkosten')] },
    { id: 'vz12', lab: 'vb', cat: 'Tonfunk-Auftrag', title: 'Rechnung und Nachkalkulation', level: 3,
      on: 'vb', beruf: ['ik'], in: ['tonfunk.angebot', 'tonfunk.ladung'], out: 'tonfunk.rechnung', type: 'vb.form', w: 100, pass: null,
      text: 'Die Ware ist beim Kunden. Schreibe die Rechnung: Liefermenge mal Angebotspreis je Stück, abzüglich Kundenrabatt, ergibt den Nettobetrag; dazu Umsatzsteuer und Bruttobetrag. Bilde den Buchungssatz der Ausgangsrechnung mit Kontennamen. Rechne dann nach: Die Fertigungslöhne lagen über dem Plan (Lastenheft), die Zuschlagssätze bleiben, die Fracht kommt zu den Selbstkosten. Wie hoch sind die Ist-Selbstkosten und der Gewinn (Nettobetrag minus Ist-Selbstkosten)?',
      kollege: 'Die Kaufleute haben die Rechnung geschrieben, gebucht und den Auftrag nachkalkuliert.',
      tasks: [{ lab: 'buc', id: 'buc15', min: 70 }, { lab: 'rec', id: 'rec29', min: 70 }],
      rows: [
        { k: 'netto', label: 'Nettobetrag der Rechnung', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 12 },
        { k: 'ust', label: 'Umsatzsteuer', unit: 'EUR', abs: 0.05, pts: 8 },
        { k: 'brutto', label: 'Bruttobetrag der Rechnung', unit: 'EUR', abs: 0.05, pts: 8 },
        { k: 'soll', label: 'Buchungssatz, Soll', t: 'sel', pts: 10, opts: [O('bank', 'Bank'), O('verb', 'Verbindlichkeiten aus L. u. L.'), O('ford', 'Forderungen aus L. u. L.'), O('erloes', 'Umsatzerlöse für Erzeugnisse')] },
        { k: 'haben', label: 'Buchungssatz, Haben', t: 'sel', pts: 10, opts: [O('erloes_vst', 'Umsatzerlöse für Erzeugnisse und Vorsteuer'), O('ford_ust', 'Forderungen aus L. u. L. und Umsatzsteuer'), O('erloes_ust', 'Umsatzerlöse für Erzeugnisse und Umsatzsteuer'), O('bank_ust', 'Bank und Umsatzsteuer')] },
        { k: 'skist', label: 'Ist-Selbstkosten', unit: 'EUR', rel: 0.0005, abs: 0.05, pts: 12 },
        { k: 'gewinn', label: 'Gewinn des Auftrags', unit: 'EUR', abs: 0.06, pts: 10 }
      ],
      hint: ['Der Rabatt mindert den Listenpreis des ganzen Auftrags. Die Umsatzsteuer kommt auf den Nettobetrag.', 'Bei einer Ausgangsrechnung auf Ziel entsteht eine Forderung; im Haben stehen der Erlös und die Steuer, die du dem Finanzamt schuldest.', 'Nachkalkulation: Löhne um den Prozentsatz erhöhen, Fertigungsgemeinkosten neu davon rechnen, Herstellkosten und Zuschlag für Verwaltung und Vertrieb neu bilden, zum Schluss die Fracht addieren.'],
      mutants: [mut('Rabatt vergessen', 'netto', (a, v) => r2(a * 1.06), 'Nettobetrag der Rechnung'), mut('Steuer vom Brutto', 'ust', a => r2(a / 1.19), 'Umsatzsteuer'), mut('Bank statt Forderung', 'soll', () => 'bank', 'Buchungssatz, Soll'), mut('Vorsteuer statt Umsatzsteuer', 'haben', () => 'erloes_vst', 'Buchungssatz, Haben'), mut('Fracht vergessen', 'skist', a => a - 55, 'Ist-Selbstkosten')] }
  ];
  STATIONS.forEach(build);

  /* ---------------------------------------------------------------- Gesamttest: passt der Auftrag über alle Abteilungen zusammen? */
  function finalCheck(slots, spec, level) {
    try {
      const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
      const g = (n, k) => numOf(vals(slotOf(ctx, PID + '.' + n))[k]);
      const fmO = g('anfrage', 'fm'), gut = fmO - P.nDef, okMenge = fin(gut) && gut >= P.stk;
      const la = g('zeichnung', 'la'), ha = g('zeichnung', 'ha'), kl = g('verpackung', 'kl'), kh = g('verpackung', 'kh'), platz = g('verpackung', 'lage') * g('verpackung', 'lagen') * g('verpackung', 'pal');
      const okPack = fin(kl) && fin(kh) && kl >= la + 2 * P.pol - 0.01 && kh >= ha + 2 * P.pol - 0.01 && kh * g('verpackung', 'lagen') + FACH.pal.h <= P.hMax + 0.01 && fin(platz) && platz >= P.stk;
      const m = g('verpackung', 'brutto'), nNeed = fin(m) ? Math.max(1, ceilE(m * FACH.g * (FACH.cv - P.mu) / (2 * P.mu * P.stf * 10))) : NaN, nO = g('ladung', 'n'), okZurr = fin(nO) && fin(nNeed) && nO >= nNeed;
      const netto = g('rechnung', 'netto'), skI = g('rechnung', 'skist'), gew = netto - skI, okPreis = fin(gew) && gew > 0 && g('angebot', 'stkp') * P.stk > g('angebot', 'sk');
      const pv = g('schaltung', 'pv'), kk = g('schaltung', 'kk'), tj = P.tu + pv * (FACH.rjg + FACH.rgk + kk), okTj = fin(tj) && tj <= FACH.tj + 0.01;
      return {
        lines: [
          L(okMenge, 'Menge: ' + (fin(gut) ? gut + ' Gutteile für ' + P.stk + ' bestellte Geräte' + (okMenge ? ', das reicht' : ', das reicht nicht') : 'Fertigungsmenge fehlt'), 20),
          L(okPack, 'Verpackung: ' + (okPack ? 'Karton passt zum Gehäuse mit Polster, alle Geräte stehen auf den Paletten, die Ladehöhe ist eingehalten' : 'Karton, Ladehöhe oder Palettenplatz passen nicht zum Gehäuse und zur Liefermenge'), 20),
          L(okZurr, 'Ladungssicherung: ' + (fin(nO) ? (nO === 1 ? '1 Gurt' : nO + ' Gurte') + ' für ' + fm(m, 0) + ' kg: ' + (okZurr ? 'das reicht' : 'das reicht nicht') : 'Gurtzahl fehlt'), 20),
          L(okPreis, 'Wirtschaftlichkeit: ' + (fin(gew) ? 'Gewinn nach der Nachkalkulation ' + fm(gew, 2) + ' EUR' + (okPreis ? '' : ', der Auftrag deckt seine Kosten nicht') : 'Rechnung oder Nachkalkulation fehlt'), 20),
          L(okTj, 'Erwärmung: ' + (fin(tj) ? 'Sperrschicht ' + fm(tj, 0) + ' °C mit dem gewählten Kühlkörper' + (okTj ? ', zulässig' : ', zu heiß') : 'Kühlkörper fehlt'), 20)
        ],
        kpis: [
          { key: 'preis', label: 'Angebotspreis je Stück', value: fin(g('angebot', 'stkp')) ? g('angebot', 'stkp') : null, unit: 'EUR', ok: okPreis },
          { key: 'gut', label: 'Gutteile', value: fin(gut) ? gut : null, unit: 'Stück', ok: okMenge },
          { key: 'pal', label: 'Paletten', value: fin(g('verpackung', 'pal')) ? g('verpackung', 'pal') : null, unit: '', ok: okPack },
          { key: 'kg', label: 'Sendung', value: fin(m) ? rd(m, 1) : null, unit: 'kg', ok: okZurr },
          { key: 'tj', label: 'Sperrschicht', value: fin(tj) ? rd(tj, 0) : null, unit: '°C', ok: okTj },
          { key: 'gewinn', label: 'Gewinn', value: fin(gew) ? r2(gew) : null, unit: 'EUR', ok: okPreis }
        ]
      };
    } catch (e) { return { lines: [L(false, 'Gesamttest: Prüfung nicht möglich', 100)], kpis: [] }; }
  }
  function report(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] };
    const row = (n, k, name, unit, d) => { const x = vals(slotOf(ctx, PID + '.' + n))[k], y = numOf(x); return [name, fin(y) ? fm(y, d == null ? 2 : d) + (unit ? ' ' + unit : '') : (x == null ? '-' : String(x))]; };
    return [
      { h: 'Auftrag und Preis', rows: [row('anfrage', 'fm', 'Fertigungsmenge', 'Stück', 0), row('anfrage', 'bzp', 'Bezugspreis der Bausätze', 'EUR'), row('angebot', 'sk', 'Selbstkosten', 'EUR'), row('angebot', 'stkp', 'Angebotspreis je Stück', 'EUR'), row('rechnung', 'brutto', 'Rechnungsbetrag brutto', 'EUR'), row('rechnung', 'gewinn', 'Gewinn', 'EUR')] },
      { h: 'Gehäuse und Fertigung', rows: [row('zeichnung', 'la', 'Außenlänge', 'mm', 1), row('zuschnitt', 'lg', 'Gestreckte Länge der Haube', 'mm'), row('fuegen', 'ng', 'Niete je Gehäuse', '', 0), row('fertigung', 't', 'Auftragszeit', 'h')] },
      { h: 'Elektrik und Prüfung', rows: [row('schaltung', 'pv', 'Verlustleistung', 'W'), row('schaltung', 'kk', 'Kühlkörper', 'K/W', 0), row('daten', 'quote', 'Ausschussquote', '%'), row('daten', 'gut', 'Gutteile', 'Stück', 0)] },
      { h: 'Versand', rows: [row('verpackung', 'pal', 'Paletten', '', 0), row('verpackung', 'brutto', 'Sendungsgewicht', 'kg', 1), row('ladung', 'n', 'Zurrgurte', '', 0), row('ladung', 'fracht', 'Fracht', 'EUR')] }
    ];
  }

  const def = {
    id: PID, name: 'Tonfunk-Auftrag', icon: '🏭', prefix: 'vz', order: 13, beruf: ['alle'],
    story: 'Ein Kunde bestellt eine Serie Labornetzteile im Blechgehäuse. Wie im echten Betrieb wandert der Auftrag durch alle Abteilungen: Die Kaufleute prüfen die Anfrage und kalkulieren, die Produktdesigner zeichnen das Gehäuse, die Industriemechaniker fertigen es, die Elektroniker legen die Schaltung aus und prüfen, die Fachinformatiker werten die Prüfdaten aus, das Lager verpackt und sichert die Ladung. Du bearbeitest die Stationen deines Berufs und rechnest mit den Werten weiter, die deine Kollegen übergeben haben. Am Ende steht ein gemeinsames Zertifikat.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['rec', 'kal', 'zei', 'fer', 'tol', 'fug', 'zer', 'ssl', 'mat', 'sql', 'alg', 'lad', 'buc'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vzF', title: 'Abschlusstest: Der Auftrag von der Anfrage bis zur Rechnung', check: finalCheck },
    report: report, kpis: ['preis', 'gut', 'pal', 'kg', 'tj', 'gewinn'],
    _test: { CALC: CALC, FACH: FACH, ORDER: ORDER, inputs: inputs, ideal: ideal, tol2768: tol2768, r2: r2 }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
