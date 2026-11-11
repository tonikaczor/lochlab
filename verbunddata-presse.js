/* Tonfunk Lab, Verbundprojekt 8 "Pneumatische Presse" (Industriemechaniker/in). Datei von Hand geschrieben, nur Hub-Stationen (on: 'vb', Typ vb.form), keine Kerne.

   FÜR DIE INTEGRATION
   - Startseite/Suche: "Pneumatische Presse: Du baust eine kleine Einpresse für die Lehrwerkstatt, von der Einpresskraft über Zylinder, Passung,
     Werkstoff, Drehteil und CNC bis zu Zweihandbedienung, Wartungsplan und Abnahme."
   - Abzeichen-Vorschlag: Symbol 🗜️, Name "Pressenbauer", Text "Pneumatische Presse bis zur Abnahme durchgespielt". Berufskürzel: im (def.beruf).
   - Verwendete Lab-Aufgaben (alle in AUFGABEN geprüft, Test Abschnitt 2):
     vp1 pne28 · vp2 fug36 tol28 · vp3 pne43 pne32 · vp4 tol20 tol26 zei22 · vp5 wer11 wer36 · vp6 zer2 zer4 zer9 · vp7 cnc37 cnc26 cnc8 ·
     vp8 pne40 pne41 pne44 · vp9 ins33 ins37. Labs: pne fug tol zei wer zer cnc ins.

   FORMELN (mit durchgerechnetem Beispiel, Stufe 1: Fügedurchmesser 20 mm, Fügelänge 15 mm, Fugenpressung 20 N/mm², 6 bar, Hub 80 mm, 12 Takte/min)
   - Zykluszeit T = 60 s : Takte je Minute = 5 s. Mittlere Kolbengeschwindigkeit v = 2 · Hub : T = 2 · 80 : 5 = 32 mm/s. Fügefläche A = π · d · l = 942,5 mm².
   - Einpresskraft Längspressverband F = µ · p · A = 0,1 · 20 · 942,5 = 1885 N; erforderliche Zylinderkraft mit Zuschlag 1,25 = 2356 N.
   - Zylinderkraft F = p · A_K · η mit p = 0,6 N/mm² (6 bar), η = 0,9; A_K = π/4 · d². Mindestdurchmesser d = Wurzel(4 · F : (π · p · η)) = 74,5 mm, Normdurchmesser 80 mm,
     Kolbenkraft = 0,6 · 5026,5 · 0,9 = 2714 N. Kolbenstange nach ISO 15552 (32:12, 40:16, 50:20, 63:20, 80:25, 100:25, 125:32 mm) = 25 mm.
   - Passung H7/g6 am Stößel 25 mm (ISO 286, Bereich 18 bis 30 mm): H7 = +21/0 µm, g6 = -7/-20 µm. Höchstspiel = ES - ei = 21 + 20 = 41 µm, Mindestspiel = EI - es = 0 + 7 = 7 µm,
     Höchstmaß der Welle 24,993 mm, Mittenmaß 24,9865 mm.
   - Stößelspannung σ = F : A = 2714 : 490,9 = 5,53 N/mm²; zulässig σ_zul = Re : ν = 440 : 3 = 146,7 N/mm²; Ausnutzung 3,8 %.
   - Drehen: n = vc · 1000 : (π · d) mit vc = 150 m/min, Rohteil 30 mm = 1592 min^-1, nächstliegende Stufe der Reihe 1400 min^-1, vc_ist = π · 30 · 1400 : 1000 = 132 m/min;
     Hauptzeit th = i · (L + la) : (f · n) = 2 · (120 + 2) : (0,2 · 1400) = 0,871 min. CNC: S = 1400, vf = f · n = 280 mm/min.
   - Luftverbrauch je Doppelhub = (A_K + A_Ring) · Hub · (p_ü + 1 bar) : 1 bar = 9562 mm² · 80 mm · 7 = 5,35 Nl; je Minute bei 12 Takten = 64,3 Nl/min. Je Schicht (8 h) = 30,8 Nm³.
   - Dichtungsintervall = 1 000 000 Doppelhübe : (12 · 60 · 8 = 5760 Hübe je Schicht) = 173,6 Betriebstage.

   ANNAHMEN (A), zur fachlichen Freigabe durch den Ausbilder
   (A1) Reibwert beim Einpressen µ = 0,1 (Stahl auf Stahl, geölt, Längspressverband). Fugenpressung ist im Lastenheft vorgegeben, sie wird hier nicht aus dem Übermaß gerechnet.
   (A2) Sicherheitszuschlag auf die Einpresskraft 25 % (Streuung der Reibung, Fluchtungsfehler).
   (A3) Wirkungsgrad des Zylinders η = 0,9 (wie im Pneumatik-Lab, Aufgabe pne43); Luftverbrauch vereinfacht mit 1 bar Atmosphärendruck (wie pne44).
   (A4) Kolbenstangen-Durchmesser der ISO-15552-Reihe wie oben angegeben; der Stößel ist die Kolbenstange (Stößeldurchmesser = Stangendurchmesser).
   (A5) Stößelführung: Spielgrenzen aus dem Lastenheft (Mindestspiel 5 oder 15 µm, Höchstspiel 50 oder 80 µm); Maßstab der Zeichnung 1:2.
   (A6) Werkstoff-Richtwerte (Streckgrenze Re in N/mm², vc für Hartmetall beim Schruppen in m/min): S235JR 235/200, C45 normalgeglüht 340/160, 16MnCr5 (Kernwert nach dem Einsatzhärten) 440/150,
        X5CrNi18-10 190/100, EN AW-6082 250/300. Randschichthärte erreichbar: C45 (Flammhärten) rund 55 HRC, 16MnCr5 (Einsatzhärten) rund 60 HRC, die anderen nicht härtbar.
        Gefordert sind 58 HRC bei zähem Kern, damit passt nur 16MnCr5. Sicherheitszahl gegen Fließen ν = 3 (schwellende Belastung).
   (A7) Drehen: Rohteil = Stößel-Nennmaß + 5 mm, zwei Schnitte (Schruppen, Schlichten), An- und Überlauf zusammen 2 mm; Drehzahlreihe der Maschine 45 bis 2000 min^-1 (wie im Zerspan-Lab).
   (A8) CNC: Werkstück-Nullpunkt auf der fertigen Stirnfläche, Durchmesserprogrammierung; programmiert wird auf das Mittenmaß des Toleranzfelds.
   (A9) Zweihandbedienung: höchstens 0,5 s zwischen beiden Tastern (ISO 13851); ein Zweidruckventil allein ist keine Zweihandschaltung nach Norm, es braucht ein Zweihand-Steuergerät (Sicherheitsbaustein)
        mit Sicherheitsbewertung nach ISO 13849-1. Die Wahl von Typ und Performance Level legt eine Gefährdungsbeurteilung fest, das ist hier nicht Teil der Aufgabe.
   (A10) Dichtungen halten 1 000 000 Doppelhübe (Richtwert), Betriebsstunden je Schicht aus dem Lastenheft.
   (A11) Das Netz liefert höchstens das 1,25-fache des Luftbedarfs des passenden Zylinders (auf 5 Nl/min aufgerundet); ein Zylinder eine Größe darüber überschreitet das immer. */
(function (root) {
  'use strict';
  const PID = 'presse';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const numOf = v => { if (fin(v)) return v; const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) { let d = null; if (ctx) { try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; } if (d == null && isObj(ctx.slots)) d = ctx.slots[slot]; } return d == null ? null : unwrap(d); }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  const safe = (fn, label) => function (data, ctx) { try { return { lines: fn(data, ctx || {}) }; } catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich', 100)] }; } };
  const vals = d => (isObj(d) && isObj(d.vals) ? d.vals : {});
  const vOf = (ctx, slot) => vals(slotOf(ctx, slot));
  function numLine(label, x, soll, rel, unit, dec, pts) {       // Zahl mit relativer Toleranz, Rückmeldung ohne die richtige Zahl
    x = numOf(x); const ok = fin(x) && fin(soll) && Math.abs(x - soll) <= rel * Math.abs(soll);
    if (!fin(x)) return L(false, label + ': kein Wert', pts);
    if (!fin(soll)) return L(false, label + ': dein Wert ' + fm(x, dec) + ' ' + unit + ' lässt sich nicht prüfen, weil ein Wert aus einer früheren Station fehlt', pts);
    return L(ok, label + ': dein Wert ' + fm(x, dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')), pts);
  }
  function absLine(label, x, soll, abs, unit, dec, pts) {        // Zahl mit absoluter Toleranz (Maße in mm, Spiel in µm)
    x = numOf(x); const ok = fin(x) && fin(soll) && Math.abs(x - soll) <= abs + 1e-9;
    if (!fin(x)) return L(false, label + ': kein Wert', pts);
    if (!fin(soll)) return L(false, label + ': dein Wert ' + fm(x, dec) + ' ' + unit + ' lässt sich nicht prüfen, weil ein Wert aus einer früheren Station fehlt', pts);
    return L(ok, label + ': dein Wert ' + fm(x, dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')), pts);
  }
  function taskLines(st, data, ptsAll) {                        // Lab-Aufgaben der Station: zusammen ptsAll Punkte
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };
  const opts = (list) => list.map(o => ({ value: o[0], label: o[1] }));

  /* ====================================================================== Fachwerte (Quellen und Annahmen im Kopfkommentar) */
  const FACH = {
    mu: 0.1, zuschlag: 1.25, eta: 0.9, atm: 1, nDicht: 1000000, zweihandS: 0.5, hrcSoll: 58, nu: 3, aufmass: 5, schnitte: 2, anlauf: 2, massstab: 2,   // (A1) bis (A10)
    reihe: [32, 40, 50, 63, 80, 100, 125],                                                              // Normdurchmesser Kolben in mm (ISO 15552)
    stange: { 32: 12, 40: 16, 50: 20, 63: 20, 80: 25, 100: 25, 125: 32 },                               // Kolbenstange in mm (A4)
    stufen: [45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400, 2000],                              // Drehzahlreihe der Drehmaschine in min^-1 (A7)
    wk: {                                                                                               // (A6): Name, Streckgrenze Re, Randschichthärte HRC (0 = nicht härtbar), vc Hartmetall Schruppen
      s235: { name: 'S235JR (Baustahl)', re: 235, hrc: 0, vc: 200 },
      c45: { name: 'C45 (Vergütungsstahl, flammhärtbar)', re: 340, hrc: 55, vc: 160 },
      cr5: { name: '16MnCr5 (Einsatzstahl)', re: 440, hrc: 60, vc: 150 },
      x5: { name: 'X5CrNi18-10 (nichtrostender Stahl)', re: 190, hrc: 0, vc: 100 },
      alu: { name: 'EN AW-6082 (Aluminium)', re: 250, hrc: 0, vc: 300 }
    },
    /* ISO 286 in µm: Bohrung H7 (ES, EI = 0); Wellen [es, ei]; Nennmaßbereiche über 10 bis 18, über 18 bis 30, über 30 bis 50 mm */
    iso: {
      '10-18': { H7: 18, f7: [-16, -34], g6: [-6, -17], h6: [0, -11], k6: [12, 1], s6: [39, 28] },
      '18-30': { H7: 21, f7: [-20, -41], g6: [-7, -20], h6: [0, -13], k6: [15, 2], s6: [48, 35] },
      '30-50': { H7: 25, f7: [-25, -50], g6: [-9, -25], h6: [0, -16], k6: [18, 2], s6: [59, 43] }
    },
    passungen: ['f7', 'g6', 'h6', 'k6', 's6']
  };
  const ZYLR = FACH.reihe;
  const kolbenKraft = (d, pBar) => Math.PI / 4 * d * d * pBar * 0.1 * FACH.eta;            // F = p · A · η, p in N/mm²
  const rodOf = d => (FACH.stange[d] || NaN);
  const nearestStep = n => FACH.stufen.reduce((a, s) => (Math.abs(s - n) < Math.abs(a - n) ? s : a), FACH.stufen[0]);
  const isoRange = n => (n > 10 && n <= 18 ? '10-18' : n > 18 && n <= 30 ? '18-30' : n > 30 && n <= 50 ? '30-50' : null);
  function fitOf(nenn, code) {                                                                  // Passung H7/<code> am Nennmaß nenn (mm)
    const rg = isoRange(nenn), tb = rg ? FACH.iso[rg] : null; if (!tb || !tb[code]) return null;
    const ES = tb.H7, es = tb[code][0], ei = tb[code][1];
    return { ES: ES, es: es, ei: ei, gmax: ES - ei, gmin: 0 - es, dmax: nenn + es / 1000, dmin: nenn + ei / 1000, mitte: nenn + (es + ei) / 2000 };
  }
  function sollPass(nenn, gminZul, gmaxZul) {                                                   // Passung mit kleinstem Höchstspiel, die beide Grenzen einhält
    let best = null;
    FACH.passungen.forEach(c => { const f = fitOf(nenn, c); if (f && f.gmin >= gminZul && f.gmax <= gmaxZul && (!best || f.gmax < best.f.gmax)) best = { code: c, f: f }; });
    return best;
  }
  const fEin = P => FACH.mu * P.pF * Math.PI * P.dF * P.lF;
  const fErf = P => fEin(P) * FACH.zuschlag;
  const dMinFor = (F, P) => Math.sqrt(4 * F / (Math.PI * P.pBar * 0.1 * FACH.eta));
  function sollZyl(P) {                                                                         // eine Soll-Funktion für Station, Lösung und Lastenheft
    const dMin = dMinFor(fErf(P), P), d = ZYLR.find(x => x >= dMin) || ZYLR[ZYLR.length - 1];
    return { dMin: dMin, d: d, f: kolbenKraft(d, P.pBar), rod: rodOf(d) };
  }
  function luft(d, P) {                                                                         // Luftverbrauch in Normlitern je Doppelhub und je Minute
    const rod = rodOf(d), aK = Math.PI / 4 * d * d, aR = Math.PI / 4 * (d * d - rod * rod), hub = (aK + aR) * P.hub / 1e6 * (P.pBar + FACH.atm) / FACH.atm;
    return { hub: hub, min: hub * P.takt };
  }
  const wkOf = key => (FACH.wk[key] || null);
  function ownD(ctx) { const d = numOf(vOf(ctx, 'presse.zylinder').d); return ZYLR.indexOf(d) >= 0 ? d : NaN; }
  const sigmaOf = (d, P) => kolbenKraft(d, P.pBar) / (Math.PI / 4 * rodOf(d) * rodOf(d));
  const hubeTag = P => P.takt * 60 * P.hS;
  const dRoh = d => rodOf(d) + FACH.aufmass;

  /* ====================================================================== Lastenheft */
  const COMBOS = [];                                                                            // Fügedaten mit sicherem Abstand zu den Normdurchmessern (mind. 4 %), damit "Runden" nicht kippt
  [16, 20, 25].forEach(dF => [12, 15, 20].forEach(lF => [15, 20].forEach(pF => [5, 6].forEach(pBar => {
    const dm = dMinFor(FACH.mu * pF * Math.PI * dF * lF * FACH.zuschlag, { pBar: pBar });
    if (dm <= ZYLR[ZYLR.length - 1] && Math.min.apply(null, ZYLR.map(x => Math.abs(x - dm) / x)) >= 0.04) COMBOS.push({ dF: dF, lF: lF, pF: pF, pBar: pBar });
  }))));
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x70726573);
    const c = pick(r, COMBOS), hub = pick(r, [50, 80, 100]), takt = pick(r, [10, 12, 15]), lSt = pick(r, [120, 150, 180]), f = pick(r, [0.15, 0.2, 0.25]), hS = pick(r, [4, 6, 8]), gm = pick(r, [0, 1]);
    const p = level === 1 ? { dF: 20, lF: 15, pF: 20, pBar: 6, hub: 80, takt: 12, lSt: 120, f: 0.2, hS: 8, gminZul: 5, gmaxZul: 50 }
      : { dF: c.dF, lF: c.lF, pF: c.pF, pBar: c.pBar, hub: hub, takt: takt, lSt: lSt, f: f, hS: hS, gminZul: level === 3 || gm ? 15 : 5, gmaxZul: level === 3 || gm ? 80 : 50 };
    p.mu = FACH.mu;
    const s = sollZyl(p); p.qVerf = Math.ceil(luft(s.d, p).min * 1.25 / 5) * 5;                 // (A11)
    return { params: p, text: [
      'Projekt Pneumatische Presse, Stufe ' + level + '. Auftrag der Lehrwerkstatt: eine kleine pneumatische Einpresse für Lagerbuchsen.',
      'Pressstelle: Buchse mit ' + p.dF + ' mm Durchmesser, ' + p.lF + ' mm Fügelänge, Fugenpressung ' + p.pF + ' N/mm² (Längspressverband, kalt einpressen). Reibwert beim Einpressen µ = ' + fm(FACH.mu, 1) + ' (A), Zuschlag auf die Einpresskraft 25 % (A).',
      'Antrieb: doppeltwirkender Zylinder nach ISO 15552, Betriebsdruck ' + p.pBar + ' bar Überdruck, Hub ' + p.hub + ' mm, ' + p.takt + ' Doppelhübe je Minute, Wirkungsgrad 0,9 (A).',
      'Stößel: ' + p.lSt + ' mm lang, ist die Kolbenstange des Zylinders. Führung mit Einheitsbohrung H7: Spiel mindestens ' + p.gminZul + ' µm, höchstens ' + p.gmaxZul + ' µm. Die Zeichnung ist im Maßstab 1:2.',
      'Stößelwerkstoff: harte Randschicht mit mindestens 58 HRC bei zähem Kern, Sicherheitszahl gegen Fließen 3 (A). Drehen mit Hartmetall, Vorschub ' + fm(p.f, 2) + ' mm/U, zwei Schnitte, An- und Überlauf zusammen 2 mm (A).',
      'Druckluftnetz: höchstens ' + p.qVerf + ' Nl/min für die Presse. Betrieb: ' + p.hS + ' Stunden je Schicht im Dauertakt, die Dichtungen halten 1 000 000 Doppelhübe (A).',
      'Sicherheit: Die Presse hat eine Quetschstelle und wird nur mit beiden Händen gestartet (Zweihandbedienung).'
    ] };
  }

  /* ====================================================================== Stationen */
  const ST = id => STATIONS.find(s => s.id === id);
  const SOLS = {};                                                                              // Musterlösung je Station (siehe unten), nutzt ctx.get der Vorstationen

  /* ---- vp1 Lastenheft auswerten */
  const GEFAHR = [['quetschen', 'Quetschen und Einziehen der Hand zwischen Stößel und Buchse'], ['laerm', 'Lärmschwerhörigkeit durch die Presse'], ['strahlung', 'Laserstrahlung am Werkstück'], ['strom', 'Elektrischer Schlag aus dem Druckluftnetz']];
  function checkEck(data, ctx) {
    const P = P_(ctx), v = vals(data), T = 60 / P.takt, vm = 2 * P.hub / T, af = Math.PI * P.dF * P.lF, g = v.gefahr;
    return [
      numLine('Zykluszeit je Takt', v.T, T, 0.03 * TOL(ctx), 's', 1, 15),
      numLine('Mittlere Kolbengeschwindigkeit', v.v, vm, 0.03 * TOL(ctx), 'mm/s', 1, 20),
      numLine('Fügefläche der Pressstelle', v.af, af, 0.02 * TOL(ctx), 'mm²', 0, 20),
      L(g === 'quetschen', 'Hauptgefährdung: ' + (g ? (g === 'quetschen' ? 'richtig erkannt' : 'das ist bei dieser Presse nicht die größte Gefahr') : 'keine Auswahl'), 15)
    ].concat(taskLines(ST('vp1'), data, 30));
  }
  SOLS.vp1 = ctx => { const P = P_(ctx); return { vals: { T: +(60 / P.takt).toFixed(2), v: +(2 * P.hub / (60 / P.takt)).toFixed(2), af: Math.round(Math.PI * P.dF * P.lF), gefahr: 'quetschen' }, tasks: tasksDone(ST('vp1')) }; };

  /* ---- vp2 Einpresskraft */
  const VERF = [['laengs', 'Längspressverband: Buchse kalt einpressen'], ['quer', 'Querpressverband: Gehäuse erwärmen und Buchse einlegen'], ['kleb', 'Klebeverbindung mit Aushärten'], ['schraub', 'Schraubverbindung mit Gewinde']];
  function checkFuegen(data, ctx) {
    const P = P_(ctx), v = vals(data), af = numOf(vOf(ctx, 'presse.eckdaten').af), F = FACH.mu * P.pF * af, fe = numOf(v.fEin), g = v.verfahren;
    return [
      numLine('Einpresskraft mit deiner Fügefläche', v.fEin, F, 0.03 * TOL(ctx), 'N', 0, 30),
      numLine('Erforderliche Zylinderkraft mit Zuschlag', v.fErf, fe * FACH.zuschlag, 0.02 * TOL(ctx), 'N', 0, 25),
      L(g === 'laengs', 'Fügeverfahren: ' + (g ? (g === 'laengs' ? 'passt zu einer Einpresse' : 'das macht die Presse nicht') : 'keine Auswahl'), 15)
    ].concat(taskLines(ST('vp2'), data, 30));
  }
  SOLS.vp2 = ctx => { const P = P_(ctx), af = numOf(vOf(ctx, 'presse.eckdaten').af), F = FACH.mu * P.pF * (fin(af) ? af : Math.PI * P.dF * P.lF); return { vals: { fEin: Math.round(F), fErf: Math.round(Math.round(F) * FACH.zuschlag), verfahren: 'laengs' }, tasks: tasksDone(ST('vp2')) }; };

  /* ---- vp3 Zylinder auslegen */
  function checkZyl(data, ctx) {
    const P = P_(ctx), v = vals(data), F = numOf(vOf(ctx, 'presse.fuegen').fErf), dm = fin(F) ? dMinFor(F, P) : NaN, d = numOf(v.d), inR = ZYLR.indexOf(d) >= 0, sr = numOf(v.dSt);
    const small = fin(dm) ? ZYLR.find(x => x >= dm) : NaN;
    return [
      numLine('Mindestdurchmesser aus der Kraft', v.dMin, dm, 0.03 * TOL(ctx), 'mm', 1, 15),
      L(inR && fin(dm) && d >= dm, 'Kolbendurchmesser: ' + (inR ? fm(d, 0) + ' mm ' + (fin(dm) ? (d >= dm ? 'reicht für die Presskraft' : 'reicht für die Presskraft nicht') : 'lässt sich nicht prüfen, weil die Kraft aus Station 2 fehlt') : 'kein Normdurchmesser gewählt'), 20),
      L(inR && fin(small) && d === small, 'Wirtschaftlichkeit: ' + (inR && fin(small) ? (d === small ? 'kleinster passender Normdurchmesser' : (d < small ? 'zu klein gewählt' : 'eine Größe kleiner würde schon reichen')) : 'nicht prüfbar'), 10),
      L(inR && sr === rodOf(d), 'Kolbenstange: ' + (fin(sr) ? fm(sr, 0) + ' mm ' + (inR && sr === rodOf(d) ? 'passt zum Zylinder' : 'passt nicht zum gewählten Zylinder') : 'keine Auswahl'), 10),
      numLine('Kolbenkraft mit deinem Zylinder', v.f, inR ? kolbenKraft(d, P.pBar) : NaN, 0.03 * TOL(ctx), 'N', 0, 15)
    ].concat(taskLines(ST('vp3'), data, 30));
  }
  SOLS.vp3 = ctx => { const P = P_(ctx), F = numOf(vOf(ctx, 'presse.fuegen').fErf), s = fin(F) ? { dMin: dMinFor(F, P), d: ZYLR.find(x => x >= dMinFor(F, P)) || 125 } : sollZyl(P); return { vals: { dMin: +s.dMin.toFixed(1), d: String(s.d), dSt: String(rodOf(s.d)), f: Math.round(kolbenKraft(s.d, P.pBar)) }, tasks: tasksDone(ST('vp3')) }; };

  /* ---- vp4 Stößel und Führung (Passung) */
  function checkPass(data, ctx) {
    const P = P_(ctx), v = vals(data), d = ownD(ctx), nenn = rodOf(d), code = v.pass, f = fin(nenn) ? fitOf(nenn, code) : null, so = fin(nenn) ? sollPass(nenn, P.gminZul, P.gmaxZul) : null, t = TOL(ctx);
    return [
      L(f && f.gmax <= P.gmaxZul, 'Führungsspiel nach oben: ' + (f ? (f.gmax <= P.gmaxZul ? 'Höchstspiel bleibt im Lastenheft' : 'Führung zu locker, das Höchstspiel ist zu groß') : 'keine gültige Passung oder kein Zylinder aus Station 3'), 10),
      L(f && f.gmin >= P.gminZul, 'Führungsspiel nach unten: ' + (f ? (f.gmin >= P.gminZul ? 'Mindestspiel bleibt im Lastenheft' : 'Führung zu eng, der Stößel kann klemmen') : 'keine gültige Passung oder kein Zylinder aus Station 3'), 10),
      L(f && so && code === so.code, 'Wahl der Passung: ' + (f && so ? (code === so.code ? 'die passende mit dem kleinsten Spiel' : 'es gibt eine Passung, die besser zum Lastenheft passt') : 'nicht prüfbar'), 6),
      absLine('Rechnung Höchstspiel', v.gmax, f ? f.gmax : NaN, 1.5 * t, 'µm', 0, 12),
      absLine('Rechnung Mindestspiel', v.gmin, f ? f.gmin : NaN, 1.5 * t, 'µm', 0, 12),
      absLine('Höchstmaß des Stößels', v.dmax, f ? f.dmax : NaN, 0.0006 * t, 'mm', 3, 12),
      numLine('Länge des Stößels in der Zeichnung', v.zl, P.lSt / FACH.massstab, 0.01 * t, 'mm', 1, 8)
    ].concat(taskLines(ST('vp4'), data, 30));
  }
  SOLS.vp4 = ctx => { const P = P_(ctx), d = ownD(ctx), dd = fin(d) ? d : sollZyl(P).d, nenn = rodOf(dd), so = sollPass(nenn, P.gminZul, P.gmaxZul), f = so.f; return { vals: { pass: so.code, gmax: f.gmax, gmin: f.gmin, dmax: +f.dmax.toFixed(3), zl: P.lSt / FACH.massstab }, tasks: tasksDone(ST('vp4')) }; };

  /* ---- vp5 Werkstoff */
  function checkWerk(data, ctx) {
    const P = P_(ctx), v = vals(data), d = ownD(ctx), key = v.wk, w = wkOf(key), sg = fin(d) ? sigmaOf(d, P) : NaN, sz = w ? w.re / FACH.nu : NaN, t = TOL(ctx);
    return [
      L(w && w.hrc >= FACH.hrcSoll, 'Werkstoff: ' + (w ? (w.hrc >= FACH.hrcSoll ? 'erreicht die verlangte Randhärte bei zähem Kern' : 'liefert keine Randschicht mit 58 HRC bei zähem Kern') : 'keine Auswahl'), 25),
      numLine('Druckspannung im Stößel', v.sigma, sg, 0.03 * t, 'N/mm²', 2, 15),
      numLine('Zulässige Spannung', v.sigZul, sz, 0.02 * t, 'N/mm²', 1, 15),
      numLine('Ausnutzung', v.ausn, fin(sg) && fin(sz) ? 100 * sg / sz : NaN, 0.04 * t, '%', 2, 15)
    ].concat(taskLines(ST('vp5'), data, 30));
  }
  SOLS.vp5 = ctx => { const P = P_(ctx), d = ownD(ctx), dd = fin(d) ? d : sollZyl(P).d, sg = sigmaOf(dd, P), sz = FACH.wk.cr5.re / FACH.nu; return { vals: { wk: 'cr5', sigma: +sg.toFixed(3), sigZul: +sz.toFixed(1), ausn: +(100 * sg / sz).toFixed(3) }, tasks: tasksDone(ST('vp5')) }; };

  /* ---- vp6 Drehteil: Drehzahl und Hauptzeit */
  function checkDreh(data, ctx) {
    const P = P_(ctx), v = vals(data), d = ownD(ctx), w = wkOf(vOf(ctx, 'presse.werkstoff').wk), dr = fin(d) ? dRoh(d) : NaN, t = TOL(ctx);
    const n = w && fin(dr) ? w.vc * 1000 / (Math.PI * dr) : NaN, ns = numOf(v.stufe), inS = FACH.stufen.indexOf(ns) >= 0;
    return [
      numLine('Drehzahl aus vc und Rohteildurchmesser', v.n, n, 0.03 * t, 'min⁻¹', 0, 15),
      L(inS && fin(n) && ns === nearestStep(n), 'Drehzahlstufe: ' + (inS ? fm(ns, 0) + ' min⁻¹ ' + (fin(n) ? (ns === nearestStep(n) ? 'ist die nächstliegende Stufe' : (ns < nearestStep(n) ? 'ist nicht die nächstliegende, zu niedrig' : 'ist nicht die nächstliegende, zu hoch')) : 'lässt sich nicht prüfen, weil der Werkstoff aus Station 5 fehlt') : 'keine Auswahl'), 15),
      numLine('Tatsächliche Schnittgeschwindigkeit', v.vc, inS && fin(dr) ? Math.PI * dr * ns / 1000 : NaN, 0.03 * t, 'm/min', 0, 15),
      numLine('Hauptzeit mit deiner Stufe', v.th, inS ? FACH.schnitte * (P.lSt + FACH.anlauf) / (P.f * ns) : NaN, 0.03 * t, 'min', 2, 25)
    ].concat(taskLines(ST('vp6'), data, 30));
  }
  SOLS.vp6 = ctx => { const P = P_(ctx), d = ownD(ctx), dd = fin(d) ? d : sollZyl(P).d, w = wkOf(vOf(ctx, 'presse.werkstoff').wk) || FACH.wk.cr5, dr = dRoh(dd), n = w.vc * 1000 / (Math.PI * dr), ns = nearestStep(n); return { vals: { n: Math.round(n), stufe: String(ns), vc: +(Math.PI * dr * ns / 1000).toFixed(1), th: +(FACH.schnitte * (P.lSt + FACH.anlauf) / (P.f * ns)).toFixed(3) }, tasks: tasksDone(ST('vp6')) }; };

  /* ---- vp7 CNC-Eckdaten */
  const NULLP = [['fertig', 'Fertige Stirnfläche des Stößels (Z0 dort)'], ['futter', 'Anlagefläche am Spannfutter'], ['maschine', 'Maschinennullpunkt der Drehmaschine'], ['roh', 'Rohteilende mit Aufmaß']];
  function checkCnc(data, ctx) {
    const P = P_(ctx), v = vals(data), d = ownD(ctx), nenn = rodOf(d), code = vOf(ctx, 'presse.passung').pass, f = fin(nenn) ? fitOf(nenn, code) : null, ns = numOf(vOf(ctx, 'presse.drehen').stufe), t = TOL(ctx);
    return [
      numLine('Spindeldrehzahl S', v.S, ns, 0.01 * t, 'min⁻¹', 0, 12),
      numLine('Vorschubgeschwindigkeit', v.vf, fin(ns) ? P.f * ns : NaN, 0.03 * t, 'mm/min', 0, 14),
      absLine('Durchmesser X auf Mittenmaß', v.X, f ? f.mitte : NaN, 0.002 * t, 'mm', 4, 14),
      absLine('Endmaß Z', v.Z, -P.lSt, 0.5 * t, 'mm', 1, 12),
      L(v.nullp === 'fertig', 'Werkstück-Nullpunkt: ' + (v.nullp ? (v.nullp === 'fertig' ? 'üblich und sinnvoll gewählt' : 'dort liegt er bei dieser Arbeit nicht günstig') : 'keine Auswahl'), 18)
    ].concat(taskLines(ST('vp7'), data, 30));
  }
  SOLS.vp7 = ctx => { const P = P_(ctx), d = ownD(ctx), dd = fin(d) ? d : sollZyl(P).d, code = vOf(ctx, 'presse.passung').pass || sollPass(rodOf(dd), P.gminZul, P.gmaxZul).code, f = fitOf(rodOf(dd), code), ns = numOf(vOf(ctx, 'presse.drehen').stufe), s = fin(ns) ? ns : 1400; return { vals: { S: s, vf: Math.round(P.f * s), X: +f.mitte.toFixed(4), Z: -P.lSt, nullp: 'fertig' }, tasks: tasksDone(ST('vp7')) }; };

  /* ---- vp8 Pneumatik: Luftverbrauch und Zweihandbedienung */
  const VENTIL = [['32', '3/2-Wegeventil'], ['52', '5/2-Wegeventil'], ['22', '2/2-Wegeventil'], ['53', '5/3-Wegeventil mit gesperrter Mittelstellung']];
  const VERKN = [['und', 'UND (Zweidruckventil): beide Signale nötig'], ['oder', 'ODER (Wechselventil): ein Signal genügt'], ['nicht', 'NICHT: Signal wird umgekehrt']];
  const BAUST = [['ja', 'Ja: Zweihand-Steuergerät (Sicherheitsbaustein) nach ISO 13851 ist nötig'], ['nein', 'Nein: ein Zweidruckventil schützt ausreichend'], ['taster', 'Nein: ein Taster mit Selbsthaltung genügt']];
  function checkLuft(data, ctx) {
    const P = P_(ctx), v = vals(data), d = ownD(ctx), q = fin(d) ? luft(d, P) : null, t = TOL(ctx);
    return [
      numLine('Luftverbrauch je Doppelhub', v.qHub, q ? q.hub : NaN, 0.03 * t, 'Nl', 2, 8),
      numLine('Luftverbrauch je Minute', v.qMin, q ? q.min : NaN, 0.03 * t, 'Nl/min', 1, 10),
      L(v.ventil === '52', 'Wegeventil: ' + (v.ventil ? (v.ventil === '52' ? 'passt zum doppeltwirkenden Zylinder' : 'passt nicht zum doppeltwirkenden Zylinder') : 'keine Auswahl'), 6),
      L(v.verkn === 'und', 'Verknüpfung der beiden Taster: ' + (v.verkn ? (v.verkn === 'und' ? 'richtig, beide müssen gedrückt sein' : 'so startet die Presse schon mit einer Hand') : 'keine Auswahl'), 10),
      L(v.baustein === 'ja', 'Sicherheitsbaustein: ' + (v.baustein ? (v.baustein === 'ja' ? 'richtig, eine echte Zweihandschaltung braucht ihn' : 'falsch, die Quetschstelle ist damit nicht ausreichend abgesichert') : 'keine Auswahl'), 26),
      numLine('Zeitfenster für beide Taster', v.zeit, FACH.zweihandS, 0.02, 's', 2, 10)
    ].concat(taskLines(ST('vp8'), data, 30));
  }
  SOLS.vp8 = ctx => { const P = P_(ctx), d = ownD(ctx), dd = fin(d) ? d : sollZyl(P).d, q = luft(dd, P); return { vals: { qHub: +q.hub.toFixed(3), qMin: +q.min.toFixed(2), ventil: '52', verkn: 'und', baustein: 'ja', zeit: FACH.zweihandS }, tasks: tasksDone(ST('vp8')) }; };

  /* ---- vp9 Wartungsplan */
  const SICHER = [['abstuetzen', 'Druckluft abschalten, Anlage entlüften, Stößel abstützen und gegen Wiedereinschalten sichern'], ['notaus', 'Nur den Not-Halt drücken und sofort arbeiten'], ['zweihand', 'Presse im Zweihandbetrieb langsam fahren und dabei nachstellen'], ['ventil', 'Nur das Wegeventil von Hand umschalten']];
  const TAEGL = [['kondensat', 'Wasserabscheider der Wartungseinheit prüfen und Kondensat ablassen'], ['zerlegen', 'Zylinder zerlegen und alle Dichtungen tauschen'], ['druck', 'Betriebsdruck über den Wert im Lastenheft erhöhen'], ['ueberbruecken', 'Sicherheitsbaustein überbrücken, damit es schneller geht']];
  function checkWart(data, ctx) {
    const P = P_(ctx), v = vals(data), qm = numOf(vOf(ctx, 'presse.luft').qMin), h = hubeTag(P), t = TOL(ctx);
    return [
      numLine('Doppelhübe je Schicht', v.hubeTag, h, 0.01 * t, 'Hübe', 0, 6),
      numLine('Luftverbrauch je Schicht', v.luftTag, fin(qm) ? qm * 60 * P.hS / 1000 : NaN, 0.03 * t, 'Nm³', 1, 6),
      numLine('Dichtungsintervall', v.intervall, FACH.nDicht / h, 0.03 * t, 'Betriebstage', 0, 8),
      L(v.sicher === 'abstuetzen', 'Vor Arbeiten an der Presse: ' + (v.sicher ? (v.sicher === 'abstuetzen' ? 'sicherer Zustand hergestellt' : 'unsicher, so besteht Quetschgefahr durch Restenergie oder Wiedereinschalten') : 'keine Auswahl'), 30),
      L(v.taeglich === 'kondensat', 'Tägliche Maßnahme: ' + (v.taeglich ? (v.taeglich === 'kondensat' ? 'passt zur Druckluftpflege' : 'das gehört nicht in die tägliche Pflege oder ist gefährlich') : 'keine Auswahl'), 20)
    ].concat(taskLines(ST('vp9'), data, 30));
  }
  SOLS.vp9 = ctx => { const P = P_(ctx), qm = numOf(vOf(ctx, 'presse.luft').qMin), q = fin(qm) ? qm : luft(sollZyl(P).d, P).min, h = hubeTag(P); return { vals: { hubeTag: h, luftTag: +(q * 60 * P.hS / 1000).toFixed(2), intervall: Math.round(FACH.nDicht / h), sicher: 'abstuetzen', taeglich: 'kondensat' }, tasks: tasksDone(ST('vp9')) }; };

  const mut = (name, fn, exp, heavy, safety) => ({ name: name, mutate: fn, expectFail: exp, heavy: !!heavy, safety: !!safety });
  const H = (a, b, c) => [a, b, c];
  const STATIONS = [
    { id: 'vp1', lab: 'vb', cat: 'Pneumatische Presse', title: 'Lastenheft auswerten', level: 1,
      on: 'vb',
      text: 'Lies das Lastenheft und rechne die Eckdaten der Presse aus: die Zykluszeit eines Takts (Ausfahren und Einfahren), die mittlere Kolbengeschwindigkeit und die Fügefläche der Pressstelle. Wähle außerdem die Hauptgefährdung. Nimm dafür die Zahlen aus dem Lastenheft.',
      in: [], out: 'presse.eckdaten', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'pne', id: 'pne28', min: 70 }],
      form: [{ key: 'T', label: 'Zykluszeit je Takt', type: 'number', unit: 's' }, { key: 'v', label: 'Mittlere Kolbengeschwindigkeit', type: 'number', unit: 'mm/s', hint: 'Hin- und Rückhub in einem Takt, ohne Pausen' }, { key: 'af', label: 'Fügefläche der Buchse', type: 'number', unit: 'mm²' }, { key: 'gefahr', label: 'Hauptgefährdung', type: 'select', options: opts(GEFAHR) }],
      hint: H('Ein Takt besteht aus Ausfahren und Einfahren. Wie lange dauert er bei der verlangten Taktzahl je Minute?', 'Zykluszeit T = 60 s : Takte je Minute. Geschwindigkeit v = Weg : Zeit, und in einem Takt fährt der Kolben zweimal den Hub. Fügefläche = π · Durchmesser · Länge.', 'Setze ein: T = 60 : Takt, v = 2 · Hub : T, A = π · Fügedurchmesser · Fügelänge. Längen in mm, Zeit in s.'),
      check: safe(checkEck, 'Eckdaten'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp1,
      mutants: [
        mut('Zykluszeit nur für einen Hub', d => { d.vals.T = d.vals.T / 2; return d; }, ['Zykluszeit']),
        mut('Geschwindigkeit nur für den halben Weg', d => { d.vals.v = d.vals.v / 2; return d; }, ['Mittlere Kolbengeschwindigkeit']),
        mut('Fügefläche mit dem Radius gerechnet', d => { d.vals.af = d.vals.af / 2; return d; }, ['Fügefläche']),
        mut('Lärm statt Quetschen gewählt', d => { d.vals.gefahr = 'laerm'; return d; }, ['Hauptgefährdung']),
        mut('Drei Fehler zugleich', d => { d.vals.v = d.vals.v / 2; d.vals.af = d.vals.af / 2; d.vals.gefahr = 'strom'; return d; }, ['Mittlere Kolbengeschwindigkeit', 'Fügefläche', 'Hauptgefährdung'], true)
      ] },
    { id: 'vp2', lab: 'vb', cat: 'Pneumatische Presse', title: 'Einpresskraft und Fügeverfahren', level: 2,
      on: 'vb',
      text: 'Die Buchse wird in das Gehäuse eingepresst. Rechne die Einpresskraft aus Reibwert, Fugenpressung und deiner Fügefläche aus Station 1. Daraus ergibt sich die Kraft, die der Zylinder mit Zuschlag liefern muss. Wähle außerdem das Fügeverfahren, das zu einer Einpresse passt.',
      in: ['presse.eckdaten'], out: 'presse.fuegen', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'fug', id: 'fug36', min: 70 }, { lab: 'tol', id: 'tol28', min: 70 }],
      form: [{ key: 'fEin', label: 'Einpresskraft', type: 'number', unit: 'N' }, { key: 'fErf', label: 'Erforderliche Zylinderkraft mit Zuschlag', type: 'number', unit: 'N' }, { key: 'verfahren', label: 'Fügeverfahren', type: 'select', options: opts(VERF) }],
      hint: H('Beim Einpressen muss die Haftreibung in der Fuge überwunden werden. Sie hängt von Reibwert, Fugenpressung und Fugenfläche ab.', 'F = µ · p · A mit der Fügefläche aus Station 1. Die erforderliche Zylinderkraft ist die Einpresskraft mit dem Zuschlag aus dem Lastenheft.', 'Einpresskraft = µ · Fugenpressung · Fügefläche. Erforderliche Kraft = Einpresskraft · (1 + Zuschlag in Prozent : 100). Eine Einpresse arbeitet kalt, ohne Erwärmen.'),
      check: safe(checkFuegen, 'Einpresskraft'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp2,
      mutants: [
        mut('Reibwert vergessen', d => { d.vals.fEin = d.vals.fEin * 10; d.vals.fErf = Math.round(d.vals.fEin * 1.25); return d; }, ['Einpresskraft mit deiner Fügefläche']),
        mut('Zuschlag vergessen', d => { d.vals.fErf = d.vals.fEin; return d; }, ['Erforderliche Zylinderkraft']),
        mut('Schrumpfen statt Einpressen', d => { d.vals.verfahren = 'quer'; return d; }, ['Fügeverfahren']),
        mut('Kraft und Verfahren falsch', d => { d.vals.fEin = Math.round(d.vals.fEin / 2); d.vals.fErf = Math.round(d.vals.fEin * 1.25); d.vals.verfahren = 'kleb'; return d; }, ['Einpresskraft mit deiner Fügefläche', 'Fügeverfahren'], true)
      ] },
    { id: 'vp3', lab: 'vb', cat: 'Pneumatische Presse', title: 'Zylinder auslegen', level: 2,
      on: 'vb',
      text: 'Lege den Zylinder aus. Rechne aus der erforderlichen Kraft von Station 2 den Mindestdurchmesser, wähle den kleinsten Normdurchmesser, der die Kraft bringt, und nenne den Kolbenstangendurchmesser. Die Stangen der ISO-15552-Zylinder haben bei Kolben 32, 40, 50, 63, 80, 100 und 125 mm die Durchmesser 12, 16, 20, 20, 25, 25 und 32 mm. Rechne zum Schluss die Kolbenkraft deines Zylinders aus.',
      in: ['presse.fuegen'], out: 'presse.zylinder', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'pne', id: 'pne43', min: 70 }, { lab: 'pne', id: 'pne32', min: 70 }],
      form: [{ key: 'dMin', label: 'Mindestdurchmesser', type: 'number', unit: 'mm' }, { key: 'd', label: 'Kolbendurchmesser (Norm)', type: 'select', options: ZYLR.map(x => ({ value: String(x), label: x + ' mm' })) }, { key: 'dSt', label: 'Kolbenstangendurchmesser', type: 'select', options: [12, 16, 20, 25, 32].map(x => ({ value: String(x), label: x + ' mm' })) }, { key: 'f', label: 'Kolbenkraft beim Ausfahren', type: 'number', unit: 'N' }],
      hint: H('Die Kraft folgt aus Druck mal Kolbenfläche, und die Reibung kostet einen Teil davon.', 'F = p · A · η mit A = π/4 · d². Stelle nach d um und nimm den nächstgrößeren Normwert. Rechne den Druck um: 1 bar = 0,1 N/mm².', 'd = Wurzel(4 · F : (π · p · η)) mit F aus Station 2, p in N/mm² und η = 0,9. Danach die Kolbenkraft mit dem gewählten Normdurchmesser nachrechnen.'),
      check: safe(checkZyl, 'Zylinder'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp3,
      mutants: [
        mut('Eine Normgröße zu klein', d => { const i = ZYLR.indexOf(+d.vals.d); const od = +d.vals.d; d.vals.d = String(ZYLR[Math.max(0, i - 1)]); d.vals.dSt = String(rodOf(+d.vals.d)); d.vals.f = Math.round(d.vals.f * Math.pow(+d.vals.d / od, 2)); return d; }, ['Kolbendurchmesser', 'Wirtschaftlichkeit']),
        mut('Eine Normgröße zu groß', d => { const i = ZYLR.indexOf(+d.vals.d); d.vals.d = String(ZYLR[Math.min(ZYLR.length - 1, i + 1)]); d.vals.dSt = String(rodOf(+d.vals.d)); return d; }, ['Wirtschaftlichkeit', 'Kolbenkraft mit deinem Zylinder']),
        mut('Wirkungsgrad vergessen', d => { d.vals.f = Math.round(d.vals.f / 0.9); return d; }, ['Kolbenkraft mit deinem Zylinder']),
        mut('Falsche Kolbenstange', d => { d.vals.dSt = d.vals.dSt === '12' ? '16' : '12'; return d; }, ['Kolbenstange']),
        mut('Durchmesser mit dem Radius gerechnet', d => { d.vals.dMin = d.vals.dMin / 2; return d; }, ['Mindestdurchmesser'])
      ] },
    { id: 'vp4', lab: 'vb', cat: 'Pneumatische Presse', title: 'Stößel und Führung: Passung und Zeichnung', level: 2,
      on: 'vb',
      text: 'Der Stößel ist die Kolbenstange deines Zylinders und läuft in einer Führung mit Einheitsbohrung H7. Wähle die Passung so, dass das Spiel zwischen dem Mindest- und dem Höchstwert aus dem Lastenheft bleibt und die Führung möglichst eng ist. Rechne Höchst- und Mindestspiel und das Höchstmaß des Stößels. Die Zeichnung ist im Maßstab 1:2: Trage die Länge des Stößels ein, wie sie auf dem Blatt gezeichnet wird.',
      in: ['presse.zylinder'], out: 'presse.passung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'tol', id: 'tol20', min: 70 }, { lab: 'tol', id: 'tol26', min: 70 }, { lab: 'zei', id: 'zei22', min: 70 }],
      form: [{ key: 'pass', label: 'Passung der Welle zu H7', type: 'select', options: FACH.passungen.map(c => ({ value: c, label: 'H7/' + c })) }, { key: 'gmax', label: 'Höchstspiel', type: 'number', unit: 'µm', hint: 'Bei Übermaß steht hier das Höchstübermaß mit Minuszeichen' }, { key: 'gmin', label: 'Mindestspiel', type: 'number', unit: 'µm' }, { key: 'dmax', label: 'Höchstmaß des Stößels', type: 'number', unit: 'mm', hint: 'mit drei Nachkommastellen' }, { key: 'zl', label: 'Stößellänge in der Zeichnung', type: 'number', unit: 'mm' }],
      hint: H('Suche im Tabellenbuch die Grenzabmaße für den Nennmaßbereich deines Stößels. Spiel entsteht, wenn die Welle immer kleiner als die Bohrung ist.', 'Höchstspiel = oberes Abmaß der Bohrung minus unteres Abmaß der Welle. Mindestspiel = unteres Abmaß der Bohrung minus oberes Abmaß der Welle. Wähle die Passung, bei der beide Grenzen halten und das Höchstspiel möglichst klein ist.', 'Höchstmaß der Welle = Nennmaß + oberes Abmaß der Welle. Zeichnungslänge = Naturmaß : 2. Prüfe jede Passung der Liste nacheinander gegen beide Spielgrenzen.'),
      check: safe(checkPass, 'Passung'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp4,
      mutants: [
        mut('Zu lockere Passung', d => { d.vals.pass = 'f7'; return d; }, ['Führungsspiel nach oben', 'Wahl der Passung', 'Rechnung Höchstspiel', 'Rechnung Mindestspiel', 'Höchstmaß des Stößels']),
        mut('Zu enge Passung (Übergang)', d => { d.vals.pass = 'k6'; return d; }, ['Führungsspiel nach unten', 'Wahl der Passung', 'Rechnung Höchstspiel', 'Rechnung Mindestspiel', 'Höchstmaß des Stößels']),
        mut('Spiel aus den falschen Abmaßen', d => { d.vals.gmax = d.vals.gmin; return d; }, ['Rechnung Höchstspiel']),
        mut('Zeichnungslänge im Naturmaß', d => { d.vals.zl = d.vals.zl * 2; return d; }, ['Länge des Stößels in der Zeichnung']),
        mut('Höchstmaß mit dem Mindestmaß verwechselt', d => { d.vals.dmax = +(d.vals.dmax - 0.013).toFixed(3); return d; }, ['Höchstmaß des Stößels'])
      ] },
    { id: 'vp5', lab: 'vb', cat: 'Pneumatische Presse', title: 'Werkstoff für den Stößel', level: 2,
      on: 'vb',
      text: 'Wähle den Werkstoff für den Stößel: Er braucht eine harte Randschicht (mindestens 58 HRC) bei zähem Kern. Rechne die Druckspannung im Stößel mit deiner Kolbenkraft und deinem Stangendurchmesser aus Station 3, die zulässige Spannung (Sicherheitszahl 3) und die Ausnutzung. Richtwerte der Streckgrenze: S235JR 235, C45 340, 16MnCr5 440, X5CrNi18-10 190, EN AW-6082 250 N/mm². Randhärte: C45 flammgehärtet rund 55 HRC, 16MnCr5 einsatzgehärtet rund 60 HRC, die übrigen nicht härtbar.',
      in: ['presse.zylinder'], out: 'presse.werkstoff', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wer', id: 'wer11', min: 70 }, { lab: 'wer', id: 'wer36', min: 70 }],
      form: [{ key: 'wk', label: 'Werkstoff', type: 'select', options: Object.keys(FACH.wk).map(k => ({ value: k, label: FACH.wk[k].name })) }, { key: 'sigma', label: 'Druckspannung im Stößel', type: 'number', unit: 'N/mm²' }, { key: 'sigZul', label: 'Zulässige Spannung', type: 'number', unit: 'N/mm²' }, { key: 'ausn', label: 'Ausnutzung', type: 'number', unit: '%' }],
      hint: H('Überlege zuerst, welche Anforderung den Werkstoff entscheidet: Festigkeit reicht hier leicht, wichtig ist die Oberfläche in der Führung.', 'Spannung = Kraft : Fläche, mit A = π/4 · d² des Stößels. Zulässige Spannung = Streckgrenze : Sicherheitszahl. Ausnutzung = vorhandene : zulässige Spannung.', 'Nur ein Stahl, der sich einsatzhärten lässt, bringt harte Randschicht und zähen Kern zusammen. Dann σ = F : A, σ_zul = Re : 3, Ausnutzung = σ : σ_zul · 100.'),
      check: safe(checkWerk, 'Werkstoff'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp5,
      mutants: [
        mut('Baustahl gewählt', d => { d.vals.wk = 's235'; d.vals.sigZul = +(235 / 3).toFixed(1); d.vals.ausn = +(100 * d.vals.sigma / (235 / 3)).toFixed(3); return d; }, ['Werkstoff']),
        mut('Sicherheitszahl vergessen', d => { d.vals.sigZul = 440; d.vals.ausn = +(100 * d.vals.sigma / 440).toFixed(3); return d; }, ['Zulässige Spannung', 'Ausnutzung']),
        mut('Stößeldurchmesser statt Fläche eingesetzt', d => { d.vals.sigma = d.vals.sigma * 10; return d; }, ['Druckspannung im Stößel']),
        mut('Ausnutzung als Verhältnis ohne Prozent', d => { d.vals.ausn = d.vals.ausn / 100; return d; }, ['Ausnutzung']),
        mut('C45 und falsche Spannung', d => { d.vals.wk = 'c45'; d.vals.sigma = d.vals.sigma * 3; return d; }, ['Werkstoff', 'Druckspannung im Stößel', 'Zulässige Spannung', 'Ausnutzung'], true)
      ] },
    { id: 'vp6', lab: 'vb', cat: 'Pneumatische Presse', title: 'Drehteil Stößel: Drehzahl und Hauptzeit', level: 2,
      on: 'vb',
      text: 'Der Stößel wird aus Rundmaterial gedreht. Das Rohteil ist 5 mm dicker als das Nennmaß des Stößels (Stangendurchmesser aus Station 3). Richtwerte für vc bei Hartmetall, Schruppen: S235JR 200, C45 160, 16MnCr5 150, X5CrNi18-10 100, EN AW-6082 300 m/min; nimm den Wert für deinen Werkstoff aus Station 5. Rechne die Drehzahl, wähle die nächstliegende Stufe der Drehzahlreihe, rechne die tatsächliche Schnittgeschwindigkeit und die Hauptzeit für die ganze Stößellänge (zwei Schnitte, An- und Überlauf zusammen 2 mm).',
      in: ['presse.werkstoff', 'presse.zylinder'], out: 'presse.drehen', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'zer', id: 'zer2', min: 70 }, { lab: 'zer', id: 'zer4', min: 70 }, { lab: 'zer', id: 'zer9', min: 70 }],
      form: [{ key: 'n', label: 'Drehzahl aus vc', type: 'number', unit: 'min⁻¹' }, { key: 'stufe', label: 'Drehzahlstufe der Maschine', type: 'select', options: FACH.stufen.map(x => ({ value: String(x), label: x + ' min⁻¹' })) }, { key: 'vc', label: 'Tatsächliche Schnittgeschwindigkeit', type: 'number', unit: 'm/min' }, { key: 'th', label: 'Hauptzeit', type: 'number', unit: 'min' }],
      hint: H('Die Drehzahl richtet sich nach dem Durchmesser, an dem die Schneide anfängt zu schneiden: Das ist das Rohteil.', 'n = vc · 1000 : (π · d). Wähle die Stufe mit dem kleinsten Abstand zu n und rechne damit vc zurück. Hauptzeit th = Schnitte · Länge : (f · n).', 'Länge = Stößellänge + 2 mm. vf = f · n. th = 2 · Länge : vf, mit n der gewählten Stufe. Rohteildurchmesser = Stangendurchmesser + 5 mm.'),
      check: safe(checkDreh, 'Drehen'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp6,
      mutants: [
        mut('Mit dem Fertigdurchmesser gerechnet', d => { d.vals.n = Math.round(d.vals.n * 1.2); return d; }, ['Drehzahl aus vc und Rohteildurchmesser']),
        mut('Stufe darüber gewählt', d => { const i = FACH.stufen.indexOf(+d.vals.stufe); d.vals.stufe = String(FACH.stufen[Math.min(FACH.stufen.length - 1, i + 1)]); return d; }, ['Drehzahlstufe', 'Tatsächliche Schnittgeschwindigkeit', 'Hauptzeit mit deiner Stufe']),
        mut('Hauptzeit nur ein Schnitt', d => { d.vals.th = d.vals.th / 2; return d; }, ['Hauptzeit mit deiner Stufe']),
        mut('Anlauf nicht beachtet und mm/min verwechselt', d => { d.vals.th = d.vals.th * 60; return d; }, ['Hauptzeit mit deiner Stufe']),
        mut('vc nicht zurückgerechnet', d => { d.vals.vc = +(d.vals.vc * 1.5).toFixed(1); return d; }, ['Tatsächliche Schnittgeschwindigkeit'])
      ] },
    { id: 'vp7', lab: 'vb', cat: 'Pneumatische Presse', title: 'CNC-Programm: Eckdaten', level: 2,
      on: 'vb',
      text: 'Der Stößel wird auf der CNC-Drehmaschine gefertigt. Trage die Eckdaten des Programms ein: die Spindeldrehzahl S (deine Stufe aus Station 6), die Vorschubgeschwindigkeit, den Durchmesser X, auf den programmiert wird (Mittenmaß des Toleranzfelds aus deiner Passung in Station 4), das Endmaß Z der Länge und die Lage des Werkstück-Nullpunkts. Programmiert wird im Durchmessermaß, Z ist vom Nullpunkt aus negativ.',
      in: ['presse.drehen', 'presse.passung'], out: 'presse.cnc', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'cnc', id: 'cnc37', min: 70 }, { lab: 'cnc', id: 'cnc26', min: 70 }, { lab: 'cnc', id: 'cnc8', min: 70 }],
      form: [{ key: 'S', label: 'Spindeldrehzahl S', type: 'number', unit: 'min⁻¹' }, { key: 'vf', label: 'Vorschubgeschwindigkeit', type: 'number', unit: 'mm/min' }, { key: 'X', label: 'Durchmesser X (Mittenmaß)', type: 'number', unit: 'mm', hint: 'mit vier Nachkommastellen' }, { key: 'Z', label: 'Endmaß Z', type: 'number', unit: 'mm' }, { key: 'nullp', label: 'Werkstück-Nullpunkt', type: 'select', options: opts(NULLP) }],
      hint: H('Die Maschine fährt die Werte, die du ins Programm schreibst. Welche Zahlen kennst du schon aus den Stationen davor?', 'Mittenmaß = Nennmaß + (oberes Abmaß + unteres Abmaß) : 2. Vorschubgeschwindigkeit vf = f · n. Der Nullpunkt liegt dort, von wo aus die Zeichnung bemaßt ist.', 'S = deine Drehzahlstufe. vf = f · S. X = Mittelwert aus Höchst- und Mindestmaß des Stößels. Z = minus die Stößellänge, wenn der Nullpunkt an der fertigen Stirnfläche liegt.'),
      check: safe(checkCnc, 'CNC'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp7,
      mutants: [
        mut('Auf das Höchstmaß programmiert', d => { d.vals.X = +(d.vals.X + 0.0065).toFixed(4); return d; }, ['Durchmesser X auf Mittenmaß']),
        mut('Z positiv', d => { d.vals.Z = -d.vals.Z; return d; }, ['Endmaß Z']),
        mut('Vorschub in mm/U statt mm/min', d => { d.vals.vf = +(d.vals.vf / d.vals.S).toFixed(3); return d; }, ['Vorschubgeschwindigkeit']),
        mut('Nullpunkt am Futter', d => { d.vals.nullp = 'futter'; return d; }, ['Werkstück-Nullpunkt']),
        mut('Andere Drehzahl eingetragen', d => { d.vals.S = Math.round(d.vals.S / 2); d.vals.vf = Math.round(d.vals.vf / 2); return d; }, ['Spindeldrehzahl S', 'Vorschubgeschwindigkeit'], true)
      ] },
    { id: 'vp8', lab: 'vb', cat: 'Pneumatische Presse', title: 'Pneumatik: Luftverbrauch und Zweihandbedienung', level: 3,
      on: 'vb',
      text: 'Rechne den Luftverbrauch deines Zylinders aus Station 3 (Kolbenseite und Stangenseite, Hub und Taktzahl aus dem Lastenheft, Druck als Überdruck, die Atmosphäre vereinfacht mit 1 bar). Wähle das Wegeventil für den doppeltwirkenden Zylinder und lege die Zweihandbedienung fest: Beide Taster müssen gedrückt sein. Prüfe, ob dafür ein Sicherheitsbaustein nötig ist, und trage das größte erlaubte Zeitfenster zwischen beiden Tastern ein. Achtung: Eine Quetschstelle an einer Presse darf nie mit einer Schaltung aus einfachen Ventilen allein abgesichert werden.',
      in: ['presse.zylinder', 'presse.eckdaten'], out: 'presse.luft', type: 'vb.form', w: 100, pass: 90,
      tasks: [{ lab: 'pne', id: 'pne40', min: 70 }, { lab: 'pne', id: 'pne41', min: 70 }, { lab: 'pne', id: 'pne44', min: 70 }],
      form: [{ key: 'qHub', label: 'Luftverbrauch je Doppelhub', type: 'number', unit: 'Nl' }, { key: 'qMin', label: 'Luftverbrauch je Minute', type: 'number', unit: 'Nl/min' }, { key: 'ventil', label: 'Wegeventil für den Zylinder', type: 'select', options: opts(VENTIL) }, { key: 'verkn', label: 'Verknüpfung der beiden Taster', type: 'select', options: opts(VERKN) }, { key: 'baustein', label: 'Sicherheitsbaustein nötig?', type: 'select', options: opts(BAUST) }, { key: 'zeit', label: 'Größtes Zeitfenster zwischen beiden Tastern', type: 'number', unit: 's' }],
      hint: H('Die Kolbenseite ist eine volle Kreisfläche, die Stangenseite eine Kreisringfläche. Die Luft ist auf Atmosphärendruck bezogen, also wird sie mit dem Druckverhältnis umgerechnet.', 'V je Doppelhub = (A_Kolben + A_Ring) · Hub · (p_Überdruck + 1 bar) : 1 bar. A_Ring = π/4 · (D² - d²). Je Minute mal Taktzahl. Zweihandbedienung: Ein Zweidruckventil ist nur ein UND, kein Sicherheitsbauteil.', 'Wandle mm³ in Liter um (1 Liter = 1 000 000 mm³). Für die Zweihandbedienung nach ISO 13851 braucht es ein Steuergerät mit Sicherheitsbewertung und eine Gleichzeitigkeit von deutlich unter einer Sekunde; den genauen Wert findest du in der Norm oder im Tabellenbuch.'),
      check: safe(checkLuft, 'Pneumatik'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp8,
      mutants: [
        mut('Stangenseite vergessen (grob)', d => { d.vals.qHub = +(d.vals.qHub * 0.55).toFixed(3); d.vals.qMin = +(d.vals.qMin * 0.55).toFixed(2); return d; }, ['Luftverbrauch je Doppelhub', 'Luftverbrauch je Minute']),
        mut('Atmosphäre nicht beachtet', d => { d.vals.qMin = +(d.vals.qMin / 7).toFixed(2); return d; }, ['Luftverbrauch je Minute']),
        mut('Wechselventil statt Zweidruckventil', d => { d.vals.verkn = 'oder'; return d; }, ['Verknüpfung der beiden Taster']),
        mut('Zweidruckventil als ausreichend betrachtet', d => { d.vals.baustein = 'nein'; return d; }, ['Sicherheitsbaustein'], true, true),
        mut('Zeitfenster zu groß', d => { d.vals.zeit = 5; return d; }, ['Zeitfenster für beide Taster']),
        mut('3/2-Ventil für doppeltwirkenden Zylinder', d => { d.vals.ventil = '32'; return d; }, ['Wegeventil'])
      ] },
    { id: 'vp9', lab: 'vb', cat: 'Pneumatische Presse', title: 'Wartungsplan der Presse', level: 2,
      on: 'vb',
      text: 'Lege den Wartungsplan fest. Rechne die Doppelhübe je Schicht, den Luftverbrauch je Schicht (mit deinem Wert je Minute aus Station 8) und nach wie vielen Betriebstagen die Dichtungen fällig sind. Wähle außerdem, wie die Presse vor Arbeiten an ihr gesichert wird, und die richtige tägliche Pflegemaßnahme.',
      in: ['presse.luft', 'presse.eckdaten'], out: 'presse.wartung', type: 'vb.form', w: 100, pass: 90,
      tasks: [{ lab: 'ins', id: 'ins33', min: 70 }, { lab: 'ins', id: 'ins37', min: 70 }],
      form: [{ key: 'hubeTag', label: 'Doppelhübe je Schicht', type: 'number', unit: 'Hübe' }, { key: 'luftTag', label: 'Luftverbrauch je Schicht', type: 'number', unit: 'Nm³', hint: '1000 Normliter sind 1 Normkubikmeter' }, { key: 'intervall', label: 'Dichtungen fällig nach', type: 'number', unit: 'Betriebstagen' }, { key: 'sicher', label: 'Vor Arbeiten an der Presse', type: 'select', options: opts(SICHER) }, { key: 'taeglich', label: 'Tägliche Pflegemaßnahme', type: 'select', options: opts(TAEGL) }],
      hint: H('Rechne zuerst, wie viele Doppelhübe die Presse in einer Schicht macht. Daraus folgen alle anderen Zahlen.', 'Doppelhübe je Schicht = Takte je Minute · 60 · Stunden. Intervall = Lebensdauer der Dichtung : Doppelhübe je Schicht. Vor Wartungsarbeiten werden alle Energien weggenommen oder gesichert.', 'Luft je Schicht = Verbrauch je Minute · 60 · Stunden : 1000. Sicher wird eine Presse nur, wenn Druck abgelassen, der Stößel abgestützt und das Wiedereinschalten verhindert ist. Täglich: Druckluftaufbereitung kontrollieren.'),
      check: safe(checkWart, 'Wartung'),
      starter: ctx => ({ vals: {}, tasks: {} }), solution: SOLS.vp9,
      mutants: [
        mut('Nur einen Hub je Takt gezählt', d => { d.vals.hubeTag = d.vals.hubeTag / 2; return d; }, ['Doppelhübe je Schicht']),
        mut('Intervall mit Stunden statt Tagen gerechnet', d => { d.vals.intervall = Math.round(d.vals.intervall * 8); return d; }, ['Dichtungsintervall']),
        mut('Luft je Schicht in Litern', d => { d.vals.luftTag = d.vals.luftTag * 1000; return d; }, ['Luftverbrauch je Schicht']),
        mut('Nur Not-Halt gedrückt', d => { d.vals.sicher = 'notaus'; return d; }, ['Vor Arbeiten an der Presse'], true, true),
        mut('Sicherheitsbaustein überbrücken', d => { d.vals.taeglich = 'ueberbruecken'; return d; }, ['Tägliche Maßnahme'], false, true)
      ] }
  ];

  /* ====================================================================== Gesamttest */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
    try {
      const d = ownD(ctx), erf = fErf(P), F = fin(d) ? kolbenKraft(d, P.pBar) : NaN, nenn = rodOf(d), pass = vOf(ctx, 'presse.passung').pass, f = fin(nenn) ? fitOf(nenn, pass) : null;
      const w = wkOf(vOf(ctx, 'presse.werkstoff').wk), sg = fin(d) ? sigmaOf(d, P) : NaN, ausn = w && fin(sg) ? 100 * sg / (w.re / FACH.nu) : NaN, q = fin(d) ? luft(d, P) : null;
      const lv = vOf(ctx, 'presse.luft'), zeit = numOf(lv.zeit), sicherOk = lv.verkn === 'und' && lv.baustein === 'ja' && fin(zeit) && zeit > 0 && zeit <= FACH.zweihandS + 1e-9;
      const okF = fin(F) && F >= erf, okG = !!f && f.gmax <= P.gmaxZul && f.gmin >= P.gminZul, okW = !!w && w.hrc >= FACH.hrcSoll && fin(ausn) && ausn <= 100, okL = !!q && q.min <= P.qVerf;
      return { lines: [
        L(okF, 'Presskraft: ' + (fin(F) ? 'die Kolbenkraft von ' + fm(F, 0) + ' N ' + (okF ? 'reicht für die Einpresskraft mit Zuschlag' : 'reicht für die Einpresskraft mit Zuschlag nicht') : 'kein Zylinder gewählt'), 25),
        L(okG, 'Stößelführung: ' + (f ? 'Spiel von ' + fm(f.gmin, 0) + ' bis ' + fm(f.gmax, 0) + ' µm ' + (okG ? 'liegt im Lastenheft' : 'verletzt das Lastenheft') : 'keine gültige Passung'), 20),
        L(okW, 'Stößelwerkstoff: ' + (w ? (okW ? 'hält die Last und hat die verlangte Randhärte' : 'erfüllt Härte oder Festigkeit nicht') : 'kein Werkstoff gewählt'), 15),
        L(okL, 'Druckluftbedarf: ' + (q ? fm(q.min, 1) + ' Nl/min ' + (okL ? 'liefert das Netz' : 'liefert das Netz nicht') : 'nicht berechenbar'), 20),
        L(sicherOk, 'Zweihandbedienung: ' + (sicherOk ? 'UND-Verknüpfung, Sicherheitsbaustein und Zeitfenster stimmen' : 'nicht sicher, Verknüpfung, Sicherheitsbaustein oder Zeitfenster fehlen oder sind falsch'), 20)
      ], kpis: [
        { key: 'kraft', label: 'Kolbenkraft', value: fin(F) ? Math.round(F) : null, unit: 'N', ok: okF },
        { key: 'spiel', label: 'Höchstspiel der Führung', value: f ? f.gmax : null, unit: 'µm', ok: okG },
        { key: 'luft', label: 'Luftbedarf', value: q ? Math.round(q.min * 10) / 10 : null, unit: 'Nl/min', ok: okL },
        { key: 'ausn', label: 'Ausnutzung des Stößels', value: fin(ausn) ? Math.round(ausn * 10) / 10 : null, unit: '%', ok: okW },
        { key: 'zeit', label: 'Zeitfenster Zweihand', value: fin(zeit) ? zeit : null, unit: 's', ok: sicherOk }
      ] };
    } catch (e) { return { lines: [L(false, 'Abnahme: Prüfung nicht möglich', 100)], kpis: [] }; }
  }

  function report(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : (isObj(spec) ? spec : {}), ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] };
    const d = ownD(ctx), z = vOf(ctx, 'presse.zylinder'), pa = vOf(ctx, 'presse.passung'), wk = vOf(ctx, 'presse.werkstoff'), dr = vOf(ctx, 'presse.drehen'), cn = vOf(ctx, 'presse.cnc'), lf = vOf(ctx, 'presse.luft'), wa = vOf(ctx, 'presse.wartung');
    const nm = wkOf(wk.wk);
    return [
      { h: 'Zylinder und Presskraft', rows: [['Kolbendurchmesser', fin(d) ? d + ' mm' : '-'], ['Kolbenstange', fin(numOf(z.dSt)) ? numOf(z.dSt) + ' mm' : '-'], ['Kolbenkraft', fin(numOf(z.f)) ? fm(numOf(z.f), 0) + ' N' : '-'], ['Betriebsdruck', P.pBar + ' bar']] },
      { h: 'Stößel und Führung', rows: [['Passung', pa.pass ? 'H7/' + pa.pass : '-'], ['Höchstspiel / Mindestspiel', fin(numOf(pa.gmax)) ? fm(numOf(pa.gmax), 0) + ' / ' + fm(numOf(pa.gmin), 0) + ' µm' : '-'], ['Höchstmaß Stößel', fin(numOf(pa.dmax)) ? fm(numOf(pa.dmax), 3) + ' mm' : '-'], ['Werkstoff', nm ? nm.name : '-']] },
      { h: 'Fertigung', rows: [['Drehzahlstufe', dr.stufe ? dr.stufe + ' min⁻¹' : '-'], ['Hauptzeit', fin(numOf(dr.th)) ? fm(numOf(dr.th), 2) + ' min' : '-'], ['CNC: X / Z', fin(numOf(cn.X)) ? fm(numOf(cn.X), 4) + ' / ' + fm(numOf(cn.Z), 1) + ' mm' : '-']] },
      { h: 'Pneumatik und Sicherheit', rows: [['Luftverbrauch', fin(numOf(lf.qMin)) ? fm(numOf(lf.qMin), 1) + ' Nl/min' : '-'], ['Zweihandbedienung', lf.baustein === 'ja' ? 'mit Sicherheitsbaustein' : 'nicht ausreichend'], ['Zeitfenster', fin(numOf(lf.zeit)) ? fm(numOf(lf.zeit), 1) + ' s' : '-']] },
      { h: 'Wartung', rows: [['Dichtungen fällig nach', fin(numOf(wa.intervall)) ? fm(numOf(wa.intervall), 0) + ' Betriebstagen' : '-'], ['Luft je Schicht', fin(numOf(wa.luftTag)) ? fm(numOf(wa.luftTag), 1) + ' Nm³' : '-']] }
    ];
  }

  const def = {
    id: PID, name: 'Pneumatische Presse', icon: '🗜️', prefix: 'vp', order: 8, beruf: ['im'],
    story: 'Die Lehrwerkstatt der Tonfunk GmbH Ermsleben braucht eine kleine pneumatische Einpresse, die Lagerbuchsen in Gehäuse drückt. Du begleitest den Auftrag wie in der Werkstatt: Lastenheft lesen, Einpresskraft rechnen, Zylinder wählen, Stößel und Führung passend toleranzieren, Werkstoff und Drehteil festlegen, CNC-Eckdaten bestimmen, Luftverbrauch und Zweihandbedienung klären und den Wartungsplan aufstellen. Jede Station arbeitet mit den Werten der vorigen. Sicherheit geht vor: An einer Presse entscheidet die Schutzeinrichtung, nicht die Schnelligkeit. Zum Schluss prüft der Abnahmetest, ob alles zusammenpasst.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['pne', 'fug', 'tol', 'zei', 'wer', 'zer', 'cnc', 'ins'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vpF', title: 'Abnahme: Die Presse im Probelauf', check: finalCheck },
    report: report, kpis: ['kraft', 'spiel', 'luft', 'ausn', 'zeit'],
    _test: { FACH: FACH, sollZyl: sollZyl, fitOf: fitOf, sollPass: sollPass, luft: luft, kolbenKraft: kolbenKraft, fEin: fEin, fErf: fErf, nearestStep: nearestStep, COMBOS: COMBOS, hubeTag: hubeTag, dRoh: dRoh, sigmaOf: sigmaOf, rodOf: rodOf }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
