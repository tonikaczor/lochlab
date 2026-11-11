/* verbunddata-gehaeuse.js - Verbundprojekt "Gehäuse für das Labornetzteil" (Kennung gehaeuse, Kürzel vd, Beruf tpd).
 * Hub-Projekt: alle Stationen sind Hub-Stationen (on 'vb', Typ vb.form), dazu Aufgaben aus den Labs zei, kon, tol, wer, fer (geprüft über lm4.tdone).
 * Keine Kerne, keine Adapter. Lädt unabhängig von der Reihenfolge, auch in Node; ohne Verbund-Kern wartet die Definition in window.VERBUND_QUEUE.
 *
 * FÜR DIE INTEGRATION
 *   Beruf-Kürzel: ['tpd'] (Technische Produktdesigner). order 12, prefix vd, id gehaeuse.
 *   Satz für Startseite/Suche: "Gehäuse für das Labornetzteil: Du holst die Maße aus dem Netzteil-Projekt und machst daraus ein Blechgehäuse – von der Ansicht über die Abwicklung und die Toleranzen bis zur Stückliste und den Kosten."
 *   Abzeichen-Vorschlag (vb_gehaeuse): Symbol 📦, Name "Gehäusekonstrukteur", Text "Ein Blechgehäuse für das Labornetzteil von der Skizze bis zur Zeichnungsprüfung gebaut."
 *   Verwendete Lab-Aufgaben: vd1 zei41 | vd2 zei1, zei22 | vd3 wer45, kon27 | vd4 fer15, zei44 | vd5 tol21, tol10 | vd6 kon8, fer6 | vd7 kon33, zei43 | vd8 fer21, fer20.
 *   Lab-Kürzel für die Symbolreihe: zei kon tol wer fer.
 *
 * VERFAHREN UND FORMELN (jede Zahl hat genau eine Soll-Funktion; Beispiele für Stufe 1: Trafo 60x50x45, Platine 80x60, Elko 35 mm, s 1,5 mm)
 *   Innenmaß        L = Rand + Trafolänge + Abstand + Platinenlänge + Rand = 5+60+10+80+5 = 160 mm; B = max(60;50)+2*5 = 70 mm; H = max(10+1,6+35 ; 45)+8 = 54,6 mm; je auf volle 5 mm aufrunden: 160 x 70 x 55 mm.
 *   Außenmaß        a = i + 2*s: 163 x 73 x 58 mm.   Maßstab: größtmöglicher Standardmaßstab (1:1, 1:2, 1:5, 1:10), bei dem die Vorderansicht ins Zeichenfeld passt: 163/2 = 81,5 mm bei 1:2.
 *   Abwicklung      Verfahren der neutralen Faser in der Blechmitte (Mittenmodell, k = 0,5; die Tabellenbuch-Verfahren mit Ausgleichswert v oder K-Faktor geben bei kleinen Radien etwas kürzere Werte, siehe A12).
 *                   r_n = r + s/2; Bogen (90 Grad) = pi*r_n/2; gestreckte Länge U-Haube = 2*(h-r-s) + (b-2*(r+s)) + 2*Bogen = 2*55 + 67 + 7,069 = 184,07 mm (h 58, b 73, r 1,5, s 1,5).
 *                   Mindest-Innenradius = k*s (A: Stahl 1,0; Edelstahl 1,5; AlMg3 2,0), dann nächster Radius der Werkzeugreihe 1 / 1,5 / 2 / 2,5 / 3 / 4 mm.
 *   Passung         ISO 286 (A: nur die benötigten Grundtoleranzen): Nennmaß >3-6: IT6 8 µm, IT7 12 µm, g: es -4 µm; >6-10: 9, 15, -5; >10-18: 11, 18, -6.
 *                   H7/g6 bei d 6: Bohrung 6,000...6,012; Welle 5,988...5,996; Höchstspiel = IT7+IT6-es(g) = 24 µm; Mindestspiel = -es(g) = 4 µm.
 *   Allgemeintoleranz  ISO 2768-1 Längenmaße: Klasse m >30-120 mm: ±0,3; >120-400 mm: ±0,5; Klasse f: ±0,15 bzw. ±0,2 (Zweitprüfung: Werte gegen ISO 2768-1 Tabelle 1 und ISO 286 geprüft, stimmen).
 *   Normteile       Durchgangsloch M4 mittel 4,5 mm, Kernloch M3 2,5 mm (= d - P), Mutter M4 m 3,2 mm, P 0,7 mm. Schraubenlänge = Klemmlänge (2*s) + Mutterhöhe + 2*P = 3+3,2+1,4 = 7,6 mm -> Normlänge 8 mm.
 *   Lüftung         Luftstrom V = P/(rho*cp*dT) mit rho*cp = 1200 J/(m³K) (A): 10 W/(1200*20 K) = 4,167e-4 m³/s = 0,4167 l/s; freie Fläche = V/v bei v 0,3 m/s (A): 1388,9 mm²;
 *                   Schlitz 3 x 30 mm = 90 mm² -> 16 Schlitze; Feld = n*3 + (n-1)*2*s = 93 mm. Mindestabstand Lochmitte zur Biegung = D/2 + 2*s + r = 2,25+3+1,5 = 6,75 mm.
 *   Masse, Kosten   V = s*(L_gestreckt*l_i + l_i*b_i + 2*b_a*h_a) = 73 678 mm³ = 0,073678 dm³; m = V*rho = 0,5784 kg (DC01, 7,85 kg/dm³); Blechkosten = m*Preis*1,25 (Verschnitt, A) = 0,5784*1,20*1,25 = 0,8676 EUR.
 *
 * ANNAHMEN (A), zur fachlichen Freigabe
 *   A1  Platine 80 x 60 mm, 2 Lagen: aus dem Projekt Labornetzteil (verbunddata-netzteil.js, Tabelle FACH NA9_board); Dicke 1,6 mm (A).
 *   A2  Trafo 10 VA (60x50x45) oder 16 VA (66x55x50), Ladeelko 30/35/40 mm hoch, Stehbolzen 10 mm, Wandabstand 5 mm, Abstand Trafo-Platine 10 mm, Luft 8 mm, Rasterrundung 5 mm: Übungswerte.
 *   A3  Verlustleistung 8/10/12 W im Gehäuse: Übungswert in der Größenordnung der Reglerverlustleistung im Netzteil-Projekt (Kurzschluss, ohne Abgleich mit dem Kern).
 *   A4  Innentemperatur höchstens 45 °C bei 25 °C Umgebung (dT 20 K); rho*cp der Luft 1200 J/(m³K); Strömungsgeschwindigkeit in den Schlitzen 0,3 m/s (freie Konvektion). Einfache Übungsrechnung, kein Ersatz für eine Wärmeberechnung.
 *   A5  Schlitz 3 x 30 mm, freie Fläche = Breite x Länge (Rundungen vernachlässigt); Steg zwischen Schlitzen = 2*s; Randabstand des Schlitzfelds 10 mm je Seite; je gleiche Fläche im Boden für die Zuluft.
 *   A6  Mindestabstand Lochrand bis Beginn der Biegung = 2*s + r (Faustregel); Mindestabstand Loch zu Loch (Steg) = 2*s.
 *   A7  Mindest-Biegeradien: Stahl DC01 1,0*s, Edelstahl 1.4301 1,5*s, AlMg3 (EN AW-5754) 2,0*s; Werkzeug-Radienreihe 1; 1,5; 2; 2,5; 3; 4 mm (Übungswerte).
 *   A8  Dichten: DC01 7,85; 1.4301 7,90; AlMg3 2,66 kg/dm³. Übungspreise: DC01 1,20; 1.4301 4,20; AlMg3 5,00 EUR/kg; Verschnittzuschlag 25 %.
 *   A9  Normteilpreise: Schraube M4 0,06; Mutter M4 0,03; Stehbolzen M3 0,35; Schraube M3 0,04 EUR. Budget: DC01 5 EUR, AlMg3 6 EUR, Edelstahl 9 EUR (alles Übungswerte).
 *   A10 Haube = U-Profil (Deckel und zwei Seitenwände, Länge = Innenlänge), Bodenblech zwischen den Seitenwänden, Front- und Rückplatte außen an den Stirnseiten; Außenhöhe = Innenhöhe + 2*s. Befestigung der Platten an Laschen der Haube, Klemmlänge 2*s.
 *   A11 Rauheit der Passfläche H7 (Bohrung gerieben): Ra 1,6 µm als Richtwert. FACHLICHER ZWEIFEL: bitte gegen das Tabellenbuch prüfen.
 *   A12 Abwicklung mit Mittenmodell (neutrale Faser in Blechmitte). Zeichnerische Praxis arbeitet oft mit Ausgleichswerten; ein Satz Tabellenwerte sollte vor dem Einsatz mit dem Fachlehrer abgestimmt werden.
 *   A13 Oberflächenschutz: Stahl pulverbeschichtet, Aluminium eloxiert, Edelstahl geschliffen (ohne Beschichtung).
 *   A14 Schraube M4 ISO 4032-Mutter m 3,2 mm; Gewindesteigung M4 0,7 mm; Durchgangsloch nach Reihe mittel (ISO 273): M3 3,4; M4 4,5; M5 5,5.
 */
(function (root) {
  'use strict';
  const PID = 'gehaeuse', K_PID = 0x67656861;
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const rd = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
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
  const own = (ctx, name) => vals(slotOf(ctx, PID + '.' + name));
  const sx = v => (v == null ? '' : String(v));
  const ceilR = (x, r) => Math.ceil(x / r - 1e-9) * r;

  function numLine(label, x, soll, rel, unit, dec, pts) {      // Zahl mit relativer Toleranz, Rückmeldung ohne die richtige Zahl
    x = numOf(x);
    if (!fin(soll)) return L(false, label + ': der Eingang aus einer früheren Station fehlt oder ist unbrauchbar', pts);
    const ok = fin(x) && Math.abs(x - soll) <= rel * Math.abs(soll);
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function absLine(label, x, soll, tol, unit, dec, pts) {      // Zahl mit absoluter Toleranz (kleine Maße, Rundung auf Millimeter-Schritte)
    x = numOf(x);
    if (!fin(soll)) return L(false, label + ': der Eingang aus einer früheren Station fehlt oder ist unbrauchbar', pts);
    const ok = fin(x) && Math.abs(x - soll) <= tol + 1e-9;
    return L(ok, label + ': ' + (fin(x) ? 'dein Wert ' + fm(x, dec) + ' ' + unit + (ok ? ' passt' : (x < soll ? ' ist zu klein' : ' ist zu groß')) : 'kein Wert'), pts);
  }
  function selLine(label, x, soll, pts, nameOf) {
    x = sx(x);
    const ok = x !== '' && soll !== null && x === sx(soll);
    return L(ok, label + ': ' + (x === '' ? 'keine Auswahl' : ok ? nameOf(x) + ' passt' : '„' + nameOf(x) + '“ passt hier nicht'), pts);
  }
  function taskLines(st, data, ptsAll) {                       // Lab-Aufgaben der Station: zusammen ptsAll Punkte
    const ts = st.tasks || [], got = isObj(data && data.tasks) ? data.tasks : {}, each = Math.floor(ptsAll / Math.max(1, ts.length));
    return ts.map((t, i) => { const p = +got[t.id] || 0, min = t.min || 70; return L(p >= min, 'Lab-Aufgabe ' + t.id + ': ' + (p >= min ? 'gelöst (' + Math.round(p) + ' %)' : 'noch nicht gelöst (verlangt ' + min + ' %)'), i === ts.length - 1 ? ptsAll - each * (ts.length - 1) : each); });
  }
  const tasksDone = st => { const o = {}; (st.tasks || []).forEach(t => { o[t.id] = 100; }); return o; };
  const F_NUM = (key, label, unit, hint) => ({ key: key, label: label, type: 'number', unit: unit || '', hint: hint || '' });
  const F_SEL = (key, label, options, hint) => ({ key: key, label: label, type: 'select', options: options, hint: hint || '' });
  const nameFrom = opts => v => { const o = opts.find(x => x.value === v); return o ? o.label : String(v); };

  /* ====================================================================== Fachwerte (A = Annahme, Kopfkommentar) */
  const FACH = {
    boardW: 80, boardH: 60, boardT: 1.6,                               // Platine aus dem Netzteil-Projekt (A1)
    trafos: [{ va: 10, L: 60, B: 50, H: 45 }, { va: 16, L: 66, B: 55, H: 50 }],
    hSt: 10, rand: 5, gap: 10, luft: 8, raster: 5, hBs: [30, 35, 40],
    wst: {
      dc01:   { name: 'Stahlblech DC01', rho: 7.85, k: 1.0, preis: 1.20, schutz: 'pulver' },
      almg3:  { name: 'Aluminium EN AW-5754 (AlMg3)', rho: 2.66, k: 2.0, preis: 5.00, schutz: 'eloxal' },
      x5crni: { name: 'Edelstahl 1.4301 (X5CrNi18-10)', rho: 7.90, k: 1.5, preis: 4.20, schutz: 'schliff' },
      cuzn37: { name: 'Messing CuZn37', rho: 8.40, k: 1.0, preis: 7.50, schutz: 'pulver' }
    },
    radien: [1, 1.5, 2, 2.5, 3, 4],
    it: [{ bis: 6, it6: 8, it7: 12, gEs: -4 }, { bis: 10, it6: 9, it7: 15, gEs: -5 }, { bis: 18, it6: 11, it7: 18, gEs: -6 }],
    allg: [{ bis: 3, f: 0.05, m: 0.1 }, { bis: 6, f: 0.05, m: 0.1 }, { bis: 30, f: 0.1, m: 0.2 }, { bis: 120, f: 0.15, m: 0.3 }, { bis: 400, f: 0.2, m: 0.5 }, { bis: 1000, f: 0.3, m: 0.8 }],
    spielMax: 40,                                                      // höchstes Spiel der Achsbuchse in µm (A)
    ra: '1.6',                                                         // A11
    mutterM4: 3.2, steigM4: 0.7, dgM4: 4.5, kernM3: 2.5, normL: [6, 8, 10, 12, 16, 20], nSteh: 4,
    rhoCp: 1200, vLuft: 0.3, schlitzB: 3, schlitzL: 30, randFeld: 10,
    verschnitt: 1.25, pSchr: 0.06, pMut: 0.03, pSteh: 0.35, pSchrM3: 0.04,
    budget: { kosten: 5, leicht: 6, rostfrei: 9 }
  };
  const WST_OPT = [{ value: 'dc01', label: FACH.wst.dc01.name }, { value: 'almg3', label: FACH.wst.almg3.name }, { value: 'x5crni', label: FACH.wst.x5crni.name }, { value: 'cuzn37', label: FACH.wst.cuzn37.name }];
  const SCH_OPT = [{ value: 'pulver', label: 'Pulverbeschichtung' }, { value: 'eloxal', label: 'Eloxieren (anodisch oxidieren)' }, { value: 'schliff', label: 'Schleifen, ohne Beschichtung' }, { value: 'roh', label: 'unbehandelt lassen' }];
  const RA_OPT = [{ value: '0.2', label: 'Ra 0,2 µm' }, { value: '1.6', label: 'Ra 1,6 µm' }, { value: '12.5', label: 'Ra 12,5 µm' }, { value: '50', label: 'Ra 50 µm' }];
  const RAD_OPT = FACH.radien.map(x => ({ value: String(x), label: fm(x, 1) + ' mm' }));
  const MS_OPT = [{ value: '1:1', label: '1:1' }, { value: '1:2', label: '1:2' }, { value: '1:5', label: '1:5' }, { value: '1:10', label: '1:10' }];
  const UNTER_OPT = [{ value: 'draufsicht', label: 'Draufsicht' }, { value: 'untersicht', label: 'Untersicht' }, { value: 'links', label: 'Seitenansicht von links' }, { value: 'rueck', label: 'Rückansicht' }];
  const RECHTS_OPT = [{ value: 'links', label: 'Seitenansicht von links' }, { value: 'rechts', label: 'Seitenansicht von rechts' }, { value: 'draufsicht', label: 'Draufsicht' }, { value: 'untersicht', label: 'Untersicht' }];
  const HBEST_OPT = [{ value: 'platine', label: 'Platine mit dem Ladeelko' }, { value: 'trafo', label: 'Trafo' }];
  const ART_OPT = [{ value: 'spiel', label: 'Spielpassung' }, { value: 'uebergang', label: 'Übergangspassung' }, { value: 'uebermass', label: 'Übermaßpassung' }];
  const LNORM_OPT = FACH.normL.map(x => ({ value: String(x), label: x + ' mm' }));
  const JANEIN = [{ value: 'ja', label: 'ja' }, { value: 'nein', label: 'nein' }];

  /* ====================================================================== Lastenheft */
  const LV_NAME = { 1: 'Einsteiger', 2: 'Standard', 3: 'Profi' };
  const PROFIL_TXT = {
    kosten: 'Das Gerät steht im trockenen Labor. Es soll vor allem günstig sein und lackiert werden.',
    leicht: 'Das Gerät wird oft getragen. Es soll möglichst wenig wiegen und eine harte, kratzfeste Oberfläche haben.',
    rostfrei: 'Das Gerät steht in einem Labor mit feuchten Dämpfen. Es darf nicht rosten, Lack kommt nicht infrage.'
  };
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ K_PID);
    const tr = pick(r, FACH.trafos), hB = pick(r, FACH.hBs), s = pick(r, [1, 1.5, 2]), pv = pick(r, [8, 10, 12]), profil = pick(r, ['kosten', 'leicht', 'rostfrei']);
    const dA = pick(r, level === 3 ? [6, 8, 10, 12] : [6, 8, 10]), zf = pick(r, [150, 80]), kl = pick(r, ['m', 'f']);
    const f1 = level === 1;
    const t = f1 ? FACH.trafos[0] : tr;
    const p = {
      boardW: FACH.boardW, boardH: FACH.boardH, boardT: FACH.boardT, trafoVA: t.va, trafoL: t.L, trafoB: t.B, trafoH: t.H,
      hB: f1 ? 35 : hB, hSt: FACH.hSt, rand: FACH.rand, gap: FACH.gap, luft: FACH.luft, raster: FACH.raster,
      s: f1 ? 1.5 : s, profil: f1 ? 'kosten' : profil, dAchse: f1 ? 6 : dA, zf: f1 ? 150 : zf, klasse: level === 3 ? kl : 'm',
      pv: f1 ? 10 : pv, tAmb: 25, tInnen: 45, schrPlatte: level === 3 ? 6 : 4, nSteh: FACH.nSteh
    };
    p.budget = FACH.budget[p.profil];
    const text = [
      'Projekt Gehäuse für das Labornetzteil, Stufe ' + level + ' (' + LV_NAME[level] + ').',
      'Das Gehäuse nimmt die Platine aus dem Projekt Labornetzteil auf (' + p.boardW + ' × ' + p.boardH + ' mm, ' + fm(p.boardT, 1) + ' mm dick) und einen Netztrafo mit ' + p.trafoVA + ' VA (' + p.trafoL + ' × ' + p.trafoB + ' × ' + p.trafoH + ' mm, Länge × Breite × Höhe). Trafomaße und Plattendicke sind Übungswerte (A).',
      'Einbau (A): Die Platine steht auf vier Stehbolzen, ' + p.hSt + ' mm hoch. Das höchste Bauteil auf der Platine ist der Ladeelko, ' + p.hB + ' mm hoch. Trafo und Platine liegen nebeneinander, in Gehäuselänge hintereinander. Rundum ' + p.rand + ' mm Abstand zur Wand, ' + p.gap + ' mm zwischen Trafo und Platine, ' + p.luft + ' mm Luft über dem höchsten Teil. Die drei Innenmaße rundest du auf volle ' + p.raster + ' mm auf.',
      'Aufbau (A): Eine Haube aus einem Blechstreifen, zu einem U gebogen (Deckel und zwei Seitenwände), ein Bodenblech zwischen den Seitenwänden, dazu Front- und Rückplatte außen an den Stirnseiten. Das Blech ist überall ' + fm(p.s, 1) + ' mm dick. Die Haube ist so lang wie das Innenmaß. Außenmaß = Innenmaß + 2 · Blechdicke in jeder Richtung.',
      PROFIL_TXT[p.profil],
      'Wärme (Übungswert, in Anlehnung an die Verlustleistung im Netzteil-Projekt): ' + p.pv + ' W Verlustleistung im Gehäuse. Innen höchstens ' + p.tInnen + ' °C bei ' + p.tAmb + ' °C Umgebung, ohne Lüfter: Die Luft strömt durch Schlitze im Boden hinein und durch Schlitze im Deckel hinaus.',
      'Bedienelement (A): Die Einstellachse mit Ø ' + p.dAchse + ' mm läuft in einer Buchse der Frontplatte mit der Passung H7/g6. Auf dem Zeichenblatt darf die Vorderansicht höchstens ' + p.zf + ' mm breit sein. Allgemeintoleranzen nach ISO 2768-' + p.klasse + '.',
      'Befestigung (A): Front- und Rückplatte werden mit je ' + p.schrPlatte + ' Schrauben M4 und Muttern an Laschen der Haube geschraubt. Die Platine sitzt auf ' + p.nSteh + ' Stehbolzen M3 mit Gewinde im Bodenblech. Materialkosten höchstens ' + p.budget + ' € (Übungswert).'
    ];
    if (level === 1) text.push('Starthilfe Stufe 1: Das Bodenblech trägt Platine und Trafo. Die Wandstärke zählt bei den Außenmaßen auf beiden Seiten mit. Für die Wärme rechnest du mit dem Luftwert 1200 J/(m³·K) und 0,3 m/s Strömungsgeschwindigkeit in den Schlitzen, Schlitz 3 × 30 mm (A).');
    else text.push('Für die Wärmerechnung gilt (A): Luft 1200 J/(m³·K), Strömungsgeschwindigkeit 0,3 m/s, Schlitz 3 × 30 mm, Steg zwischen den Schlitzen 2 · Blechdicke, Randabstand des Schlitzfelds 10 mm je Seite.');
    return { params: p, text: text };
  }

  /* ====================================================================== Soll-Funktionen (check, solution, Tipp und Gesamttest nutzen sie gemeinsam) */
  function sollInnen(P) {
    const hP = P.hSt + P.boardT + P.hB, hRaw = Math.max(hP, P.trafoH) + P.luft;
    const liRaw = P.rand + P.trafoL + P.gap + P.boardW + P.rand, biRaw = Math.max(P.boardH, P.trafoB) + 2 * P.rand;
    return { liRaw: liRaw, biRaw: biRaw, hRaw: hRaw, li: ceilR(liRaw, P.raster), bi: ceilR(biRaw, P.raster), hi: ceilR(hRaw, P.raster), hBest: hP >= P.trafoH ? 'platine' : 'trafo' };
  }
  const sollMassstab = (P, aL) => { const m = [1, 2, 5, 10].find(x => aL / x <= P.zf + 1e-9) || 10; return { m: m, key: '1:' + m, zeichL: aL / m }; };
  const sollWerkstoff = P => (P.profil === 'leicht' ? 'almg3' : P.profil === 'rostfrei' ? 'x5crni' : 'dc01');
  const radiusOf = rmin => FACH.radien.find(x => x >= rmin - 1e-9) || null;
  const bogenOf = (r, s) => Math.PI * (r + s / 2) / 2;
  const lgesOf = (hA, bA, r, s) => 2 * (hA - r - s) + (bA - 2 * (r + s)) + 2 * bogenOf(r, s);
  const itOf = d => FACH.it.find(x => d <= x.bis) || FACH.it[FACH.it.length - 1];
  function sollPassung(P) {
    const t = itOf(P.dAchse), d = P.dAchse;
    return { bMax: d + t.it7 / 1000, wMin: d + (t.gEs - t.it6) / 1000, wMax: d + t.gEs / 1000, sMax: t.it7 + t.it6 - t.gEs, sMin: -t.gEs };
  }
  const allgOf = (klasse, mass) => { const r = FACH.allg.find(x => mass <= x.bis) || FACH.allg[FACH.allg.length - 1]; return klasse === 'f' ? r.f : r.m; };
  const sollNorm = s => { const kl = 2 * s, raw = kl + FACH.mutterM4 + 2 * FACH.steigM4, ln = FACH.normL.find(x => x >= raw - 1e-9) || null; return { klemm: kl, raw: raw, ln: ln }; };
  function sollLuft(P, s, dT) {
    dT = fin(dT) ? dT : P.tInnen - P.tAmb;
    const V = P.pv / (FACH.rhoCp * dT) * 1000, A = V / FACH.vLuft * 1000, n = Math.ceil(A / (FACH.schlitzB * FACH.schlitzL) - 1e-9);
    return { dT: dT, V: V, A: A, n: n, steg: 2 * s, F: n * FACH.schlitzB + (n - 1) * 2 * s };
  }
  const volBlech = (lges, li, bi, aB, aH, s) => s * (lges * li + li * bi + 2 * aB * aH);
  const normKosten = (nSchr, nMut, nSteh) => nSchr * FACH.pSchr + nMut * FACH.pMut + nSteh * (FACH.pSteh + FACH.pSchrM3);

  /* Eigene Werte der Vorstationen (Datenübergabe); NaN, wenn nicht vorhanden */
  function chain(ctx) {
    const i = own(ctx, 'innenmass'), a = own(ctx, 'ansichten'), w = own(ctx, 'werkstoff'), b = own(ctx, 'abwicklung'), t = own(ctx, 'toleranz'), n = own(ctx, 'normteile'), k = own(ctx, 'konstruktion');
    return { i: i, a: a, w: w, b: b, t: t, n: n, k: k, li: numOf(i.li), bi: numOf(i.bi), hi: numOf(i.hi), aL: numOf(a.aL), aB: numOf(a.aB), aH: numOf(a.aH), wst: sx(w.wst), kF: numOf(w.kfaktor),
      s: numOf(b.s), r: numOf(b.r), lges: numOf(b.lges), dg: numOf(n.dg), nSchr: numOf(n.nSchr), nMut: numOf(n.nMut), nSteh: numOf(n.nSteh) };
  }

  /* ====================================================================== Prüfungen */
  function checkInnen(data, ctx) {
    const P = P_(ctx), v = vals(data), s = sollInnen(P), tol = TOL(ctx) * 0.3;
    return [
      absLine('Innenlänge', v.li, s.li, tol, 'mm', 0, 20),
      absLine('Innenbreite', v.bi, s.bi, tol, 'mm', 0, 15),
      absLine('Innenhöhe', v.hi, s.hi, tol, 'mm', 0, 20),
      selLine('Höhenbestimmendes Teil', v.hbest, s.hBest, 15, nameFrom(HBEST_OPT))
    ].concat(taskLines(STATIONS[0], data, 30));
  }
  function checkAnsichten(data, ctx) {
    const P = P_(ctx), v = vals(data), c = chain(ctx), tol = TOL(ctx) * 0.3, sd = P.s;
    const ms = fin(numOf(v.aL)) ? sollMassstab(P, numOf(v.aL)) : null;
    const mkey = sx(v.massstab), mval = /^1:(\d+)$/.exec(mkey) ? +/^1:(\d+)$/.exec(mkey)[1] : NaN;
    const zSoll = fin(numOf(v.aL)) && fin(mval) ? numOf(v.aL) / mval : NaN;
    return [
      absLine('Außenlänge', v.aL, c.li + 2 * sd, tol, 'mm', 1, 10),
      absLine('Außenbreite', v.aB, c.bi + 2 * sd, tol, 'mm', 1, 10),
      absLine('Außenhöhe', v.aH, c.hi + 2 * sd, tol, 'mm', 1, 10),
      selLine('Maßstab', v.massstab, ms ? ms.key : null, 10, nameFrom(MS_OPT)),
      numLine('Länge in der Zeichnung', v.zeichL, zSoll, 0.02 * TOL(ctx), 'mm', 1, 10),
      selLine('Ansicht unter der Vorderansicht', v.unter, 'draufsicht', 10, nameFrom(UNTER_OPT)),
      selLine('Ansicht rechts neben der Vorderansicht', v.rechts, 'links', 10, nameFrom(RECHTS_OPT))
    ].concat(taskLines(STATIONS[1], data, 30));
  }
  function checkWerkstoff(data, ctx) {
    const P = P_(ctx), v = vals(data), sw = sollWerkstoff(P), W = FACH.wst[sx(v.wst)] || null, rel = 0.02 * TOL(ctx);
    return [
      selLine('Werkstoff', v.wst, sw, 20, nameFrom(WST_OPT)),
      numLine('Dichte', v.dichte, W ? W.rho : NaN, rel, 'kg/dm³', 2, 10),
      absLine('Biegefaktor k (Mindestradius = k · s)', v.kfaktor, W ? W.k : NaN, 0.05, '', 1, 10),
      selLine('Oberflächenschutz', v.schutz, W ? W.schutz : null, 15, nameFrom(SCH_OPT)),
      selLine('Rauheit der Passfläche', v.ra, FACH.ra, 15, nameFrom(RA_OPT))
    ].concat(taskLines(STATIONS[2], data, 30));
  }
  function checkAbwicklung(data, ctx) {
    const P = P_(ctx), v = vals(data), c = chain(ctx), s = P.s, W = FACH.wst[c.wst] || null, kk = W ? W.k : NaN;      // gerechnet wird mit der Blechdicke aus dem Lastenheft, die Eingabe der Dicke prüft eine eigene Zeile
    const rmin = fin(kk) && fin(s) ? kk * s : NaN, rSoll = fin(rmin) ? radiusOf(rmin) : null, r = numOf(v.r);
    const rl = fin(r) && fin(rmin) ? (Math.abs(r - rSoll) < 1e-9 ? 'passt' : r < rmin ? 'ist zu klein (Risse außen)' : 'ist größer als nötig (nimm den kleinsten passenden Radius)') : '';
    return [
      absLine('Blechdicke', v.s, P.s, 0.01, 'mm', 1, 5),
      numLine('Mindest-Innenradius', v.rmin, rmin, 0.02 * TOL(ctx), 'mm', 2, 10),
      L(fin(r) && rSoll !== null && Math.abs(r - rSoll) < 1e-9, 'Innenradius: ' + (fin(r) ? 'dein Radius ' + fm(r, 1) + ' mm ' + rl : 'keine Auswahl'), 10),
      numLine('Radius der neutralen Faser', v.rn, fin(r) && fin(s) ? r + s / 2 : NaN, 0.02 * TOL(ctx), 'mm', 2, 10),
      numLine('Bogenlänge je Biegung', v.bogen, fin(r) && fin(s) ? bogenOf(r, s) : NaN, 0.03 * TOL(ctx), 'mm', 2, 10),
      numLine('Gestreckte Länge der Haube', v.lges, fin(r) && fin(s) && fin(c.aH) && fin(c.aB) ? lgesOf(c.aH, c.aB, r, s) : NaN, 0.015 * TOL(ctx), 'mm', 1, 25)
    ].concat(taskLines(STATIONS[3], data, 30));
  }
  function checkToleranz(data, ctx) {
    const P = P_(ctx), v = vals(data), c = chain(ctx), ps = sollPassung(P), a = TOL(ctx) * 0.0005, aS = TOL(ctx) * 0.6, k = P.klasse;
    const tL = fin(c.aL) ? allgOf(k, c.aL) : NaN, tH = fin(c.aH) ? allgOf(k, c.aH) : NaN;
    return [
      absLine('Höchstmaß der Bohrung', v.bMax, ps.bMax, a, 'mm', 3, 10),
      absLine('Mindestmaß der Welle', v.wMin, ps.wMin, a, 'mm', 3, 10),
      absLine('Höchstspiel', v.sMax, ps.sMax, aS, 'µm', 0, 10),
      absLine('Mindestspiel', v.sMin, ps.sMin, aS, 'µm', 0, 10),
      selLine('Passungsart', v.art, 'spiel', 5, nameFrom(ART_OPT)),
      absLine('Höchstmaß Außenlänge', v.lMax, c.aL + tL, a, 'mm', 2, 10),
      absLine('Mindestmaß Außenlänge', v.lMin, c.aL - tL, a, 'mm', 2, 10),
      absLine('Höchstmaß Außenhöhe', v.hMax, c.aH + tH, a, 'mm', 2, 5)
    ].concat(taskLines(STATIONS[4], data, 30));
  }
  function checkNormteile(data, ctx) {
    const P = P_(ctx), v = vals(data), c = chain(ctx), sn = fin(c.s) ? sollNorm(c.s) : null, nS = 2 * P.schrPlatte;
    return [
      absLine('Durchgangsloch für M4 (Reihe mittel)', v.dg, FACH.dgM4, 0.05, 'mm', 1, 10),
      absLine('Kernloch für M3', v.kern, FACH.kernM3, 0.05, 'mm', 1, 10),
      absLine('Klemmlänge', v.kluem, sn ? sn.klemm : NaN, 0.05, 'mm', 1, 5),
      absLine('Rechnerische Schraubenlänge', v.lraw, sn ? sn.raw : NaN, 0.1, 'mm', 1, 10),
      selLine('Normlänge der Schraube', v.lnorm, sn && sn.ln !== null ? String(sn.ln) : null, 10, nameFrom(LNORM_OPT)),
      absLine('Anzahl Schrauben M4', v.nSchr, nS, 0.01, 'Stück', 0, 10),
      absLine('Anzahl Muttern M4', v.nMut, numOf(v.nSchr), 0.01, 'Stück', 0, 5),
      absLine('Anzahl Stehbolzen M3', v.nSteh, P.nSteh, 0.01, 'Stück', 0, 10)
    ].concat(taskLines(STATIONS[5], data, 30));
  }
  function checkKonstruktion(data, ctx) {
    const P = P_(ctx), v = vals(data), c = chain(ctx), s = c.s, dT = numOf(v.dT), V = numOf(v.V), A = numOf(v.A), n = numOf(v.n), F = numOf(v.F), plz = numOf(v.platzL);
    const vS = fin(dT) && dT > 0 ? P.pv / (FACH.rhoCp * dT) * 1000 : NaN, aS = fin(V) ? V / FACH.vLuft * 1000 : NaN, nS = fin(A) ? Math.ceil(A / (FACH.schlitzB * FACH.schlitzL) - 1e-9) : NaN;
    const fS = fin(n) && fin(s) ? n * FACH.schlitzB + (n - 1) * 2 * s : NaN, pS = fin(c.li) ? c.li - 2 * FACH.randFeld : NaN;
    const passt = fin(F) && fin(plz) ? (F <= plz ? 'ja' : 'nein') : null;
    return [
      absLine('Temperaturdifferenz', v.dT, P.tInnen - P.tAmb, 0.1, 'K', 0, 8),
      numLine('Luftvolumenstrom', v.V, vS, 0.03 * TOL(ctx), 'l/s', 3, 10),
      numLine('Erforderliche freie Fläche', v.A, aS, 0.03 * TOL(ctx), 'mm²', 0, 10),
      absLine('Anzahl Schlitze (3 × 30 mm)', v.n, nS, 0.01, 'Stück', 0, 10),
      numLine('Länge des Schlitzfelds', v.F, fS, 0.02 * TOL(ctx), 'mm', 0, 8),
      numLine('Platz in Längsrichtung', v.platzL, pS, 0.02 * TOL(ctx), 'mm', 0, 6),
      selLine('Passt das Schlitzfeld in den Deckel', v.passt, passt, 6, nameFrom(JANEIN)),
      numLine('Mindestabstand Lochmitte bis Biegung', v.eMin, fin(c.dg) && fin(s) && fin(c.r) ? c.dg / 2 + 2 * s + c.r : NaN, 0.03 * TOL(ctx), 'mm', 2, 12)
    ].concat(taskLines(STATIONS[6], data, 30));
  }
  function checkKosten(data, ctx) {
    const v = vals(data), c = chain(ctx), W = FACH.wst[c.wst] || null, ok = W && fin(c.lges) && fin(c.li) && fin(c.bi) && fin(c.aB) && fin(c.aH) && fin(c.s);
    const vH = ok ? c.lges * c.li * c.s : NaN, vG = ok ? volBlech(c.lges, c.li, c.bi, c.aB, c.aH, c.s) : NaN, rel = 0.02 * TOL(ctx);
    const mG = ok ? vG / 1e6 * W.rho : NaN, kB = ok ? mG * W.preis * FACH.verschnitt : NaN, kN = fin(c.nSchr) && fin(c.nMut) && fin(c.nSteh) ? normKosten(c.nSchr, c.nMut, c.nSteh) : NaN;
    const kBe = numOf(v.kBlech), kNe = numOf(v.kNorm);
    return [
      numLine('Masse der Haube', v.mHaube, ok ? vH / 1e6 * W.rho : NaN, rel, 'kg', 3, 15),
      numLine('Gesamtmasse der Blechteile', v.mGes, mG, rel, 'kg', 3, 15),
      numLine('Blechkosten mit Verschnitt', v.kBlech, kB, 0.03 * TOL(ctx), '€', 2, 15),
      numLine('Normteilkosten', v.kNorm, kN, 0.03 * TOL(ctx), '€', 2, 10),
      numLine('Materialkosten gesamt', v.kGes, fin(kBe) && fin(kNe) ? kBe + kNe : NaN, 0.02 * TOL(ctx), '€', 2, 15)
    ].concat(taskLines(STATIONS[7], data, 30));
  }

  /* ====================================================================== Stationen */
  const STATIONS = [
    { id: 'vd1', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Lastenheft: Einbauteile und Innenmaße', level: 1,
      on: 'vb',
      text: 'Lies das Lastenheft. Rechne aus den Maßen von Platine und Trafo, den Abständen und der Bauhöhe die Innenmaße des Gehäuses. Alle drei Maße rundest du auf die Rasterstufe aus dem Lastenheft auf. Gib außerdem an, welches Teil die Innenhöhe bestimmt.',
      in: [], out: 'gehaeuse.innenmass', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'zei', id: 'zei41', min: 70 }],
      form: [F_NUM('li', 'Innenlänge', 'mm'), F_NUM('bi', 'Innenbreite', 'mm'), F_NUM('hi', 'Innenhöhe', 'mm'), F_SEL('hbest', 'Welches Teil bestimmt die Innenhöhe?', HBEST_OPT)],
      hint: ['Lege die Teile in Gedanken auf das Bodenblech: Trafo und Platine liegen in der Länge hintereinander, in der Breite zählt das breitere Teil.',
        'Länge = Rand + Trafo + Abstand + Platine + Rand. Breite = breiteres Teil + zwei Ränder. Höhe = höheres Teil + Luft; die Platine steht auf Stehbolzen und trägt eine Leiterplattendicke.',
        'Höhe der Platine-Seite = Stehbolzen + Leiterplatte + Elko. Vergleiche mit der Trafohöhe, addiere die Luft und runde jedes Maß auf das nächste Vielfache des Rasters auf.'],
      check: safe(checkInnen, 'Innenmaße'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const s = sollInnen(P_(ctx)); return { vals: { li: s.li, bi: s.bi, hi: s.hi, hbest: s.hBest }, tasks: tasksDone(STATIONS[0]) }; },
      mutants: [
        { name: 'Trafo in der Länge vergessen', mutate: d => { d.vals.li = d.vals.li - 70; return d; }, expectFail: ['Innenlänge'] },
        { name: 'Wandabstand in der Breite vergessen', mutate: d => { d.vals.bi = d.vals.bi - 10; return d; }, expectFail: ['Innenbreite'] },
        { name: 'Luft über dem höchsten Teil vergessen', mutate: d => { d.vals.hi = d.vals.hi - 8; return d; }, expectFail: ['Innenhöhe'] },
        { name: 'falsches Teil als höchstes genannt', mutate: d => { d.vals.hbest = d.vals.hbest === 'trafo' ? 'platine' : 'trafo'; return d; }, expectFail: ['Höhenbestimmendes Teil'] },
        { name: 'alle drei Maße ungerundet und zu knapp, Aufgabe offen', heavy: true, mutate: d => { d.vals.li = 100; d.vals.bi = 50; d.vals.hi = 30; d.tasks = {}; return d; }, expectFail: ['Innenlänge', 'Innenbreite', 'Innenhöhe', 'Lab-Aufgabe'] }
      ] },
    { id: 'vd2', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Skizze: Ansichten, Projektion und Maßstab', level: 1,
      on: 'vb',
      text: 'Skizziere das Gehäuse als Quader in den drei Ansichten. Bestimme die Außenmaße aus deinen Innenmaßen und der Blechdicke. Lege den Maßstab so fest, dass die Vorderansicht ins Zeichenfeld passt, und rechne die Länge für die Zeichnung aus. Gib an, wie die Ansichten bei der Projektionsmethode 1 angeordnet werden.',
      in: ['gehaeuse.innenmass'], out: 'gehaeuse.ansichten', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'zei', id: 'zei1', min: 70 }, { lab: 'zei', id: 'zei22', min: 70 }],
      form: [F_NUM('aL', 'Außenlänge', 'mm'), F_NUM('aB', 'Außenbreite', 'mm'), F_NUM('aH', 'Außenhöhe', 'mm'), F_SEL('massstab', 'Maßstab', MS_OPT, 'Wähle den größtmöglichen Standardmaßstab, bei dem die Vorderansicht noch passt.'),
        F_NUM('zeichL', 'Länge der Vorderansicht in der Zeichnung', 'mm'), F_SEL('unter', 'Welche Ansicht steht unter der Vorderansicht?', UNTER_OPT), F_SEL('rechts', 'Welche Ansicht steht rechts neben der Vorderansicht?', RECHTS_OPT)],
      hint: ['Das Blech sitzt auf beiden Seiten des Innenmaßes. Bei der Projektionsmethode 1 sieht man das Teil gedanklich von der Seite, in die man blickt, und klappt die Ansicht auf die andere Seite weg.',
        'Außenmaß = Innenmaß + 2 · Blechdicke. Zeichnungsmaß = Naturmaß geteilt durch die Maßstabszahl. Wähle von 1:1, 1:2, 1:5, 1:10 den ersten, bei dem die Länge nicht über das Zeichenfeld hinausgeht.',
        'Teste die Maßstäbe der Reihe nach: Außenlänge geteilt durch 1, dann durch 2 und so weiter, bis der Wert höchstens so groß wie das erlaubte Zeichenfeld ist. Die Draufsicht liegt unterhalb, die Ansicht von links rechts neben der Vorderansicht.'],
      check: safe(checkAnsichten, 'Ansichten'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), si = sollInnen(P), aL = si.li + 2 * P.s, ms = sollMassstab(P, aL); return { vals: { aL: rd(aL, 2), aB: rd(si.bi + 2 * P.s, 2), aH: rd(si.hi + 2 * P.s, 2), massstab: ms.key, zeichL: rd(ms.zeichL, 2), unter: 'draufsicht', rechts: 'links' }, tasks: tasksDone(STATIONS[1]) }; },
      mutants: [
        { name: 'Außenlänge gleich Innenlänge', mutate: d => { d.vals.aL = d.vals.aL - 3; return d; }, expectFail: ['Außenlänge'] },
        { name: 'Maßstab 1:1 gewählt', mutate: d => { d.vals.massstab = '1:1'; return d; }, expectFail: ['Maßstab'] },
        { name: 'Naturmaß statt Zeichnungsmaß eingetragen', mutate: d => { d.vals.zeichL = d.vals.aL; return d; }, expectFail: ['Länge in der Zeichnung'] },
        { name: 'Untersicht unter die Vorderansicht gelegt', mutate: d => { d.vals.unter = 'untersicht'; return d; }, expectFail: ['Ansicht unter der Vorderansicht'] },
        { name: 'Seitenansicht von rechts auf die rechte Seite gelegt', mutate: d => { d.vals.rechts = 'rechts'; return d; }, expectFail: ['Ansicht rechts neben'] }
      ] },
    { id: 'vd3', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Werkstoff und Oberflächenangabe', level: 2,
      on: 'vb',
      text: 'Wähle den Blechwerkstoff, der zum Einsatz im Lastenheft passt. Trage Dichte und Biegefaktor aus der Werkstofftabelle ein, wähle den Oberflächenschutz und die Rauheitsangabe für die Passfläche der Achsbuchse.',
      in: ['gehaeuse.ansichten'], out: 'gehaeuse.werkstoff', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'wer', id: 'wer45', min: 70 }, { lab: 'kon', id: 'kon27', min: 70 }],
      form: [F_SEL('wst', 'Blechwerkstoff', WST_OPT), F_NUM('dichte', 'Dichte des gewählten Werkstoffs', 'kg/dm³'), F_NUM('kfaktor', 'Biegefaktor k (Mindestradius = k · Blechdicke)', ''),
        F_SEL('schutz', 'Oberflächenschutz', SCH_OPT), F_SEL('ra', 'Rauheitsangabe für die Passfläche der Bohrung (H7, gerieben)', RA_OPT)],
      hint: ['Lies im Lastenheft, was das Gerät vor allem können muss: günstig, leicht oder rostfrei. Ordne jedem Werkstoff seine Stärke zu.',
        'Stahlblech ist günstig und lässt sich lackieren, Aluminium ist leicht und wird eloxiert, Edelstahl rostet nicht und wird nur geschliffen. Dichte und Biegefaktor stehen in der Werkstofftabelle (A, Übungswerte).',
        'Eine Passfläche mit IT7 wird gerieben, nicht nur gebohrt. Für diese Qualität nimmst du einen mittelfeinen Ra-Wert (A: Richtwert aus dem Tabellenbuch zu prüfen), nicht den feinsten und nicht den gröbsten.'],
      check: safe(checkWerkstoff, 'Werkstoff'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const k = sollWerkstoff(P_(ctx)), W = FACH.wst[k]; return { vals: { wst: k, dichte: W.rho, kfaktor: W.k, schutz: W.schutz, ra: FACH.ra }, tasks: tasksDone(STATIONS[2]) }; },
      mutants: [
        { name: 'Messing gewählt', mutate: d => { d.vals.wst = 'cuzn37'; return d; }, expectFail: ['Werkstoff'] },
        { name: 'Dichte falsch eingetragen', mutate: d => { d.vals.dichte = 1; return d; }, expectFail: ['Dichte'] },
        { name: 'Biegefaktor 0,5 angenommen', mutate: d => { d.vals.kfaktor = 0.5; return d; }, expectFail: ['Biegefaktor'] },
        { name: 'Blech unbehandelt gelassen', mutate: d => { d.vals.schutz = 'roh'; return d; }, expectFail: ['Oberflächenschutz'] },
        { name: 'Rauheit Ra 50 für die Passfläche', mutate: d => { d.vals.ra = '50'; return d; }, expectFail: ['Rauheit der Passfläche'] }
      ] },
    { id: 'vd4', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Blechabwicklung und Biegeradius', level: 3,
      on: 'vb',
      text: 'Die Haube wird aus einem Blechstreifen zu einem U gebogen. Bestimme den Mindest-Innenradius für deinen Werkstoff und wähle den passenden Radius aus der Werkzeugreihe. Rechne mit dem Verfahren der neutralen Faser (Blechmitte) die gestreckte Länge des Zuschnitts aus. Das ist ein vereinfachtes Übungsverfahren (Näherung): Bei kleinen Radien liegt die neutrale Faser in der Praxis etwas weiter innen, Tabellenbuch-Verfahren geben dann etwas kürzere Werte. Die Schenkelhöhe und die Bodenbreite sind deine Außenmaße.',
      in: ['gehaeuse.ansichten', 'gehaeuse.werkstoff'], out: 'gehaeuse.abwicklung', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'fer', id: 'fer15', min: 70 }, { lab: 'zei', id: 'zei44', min: 70 }],
      form: [F_NUM('s', 'Blechdicke aus dem Lastenheft', 'mm'), F_NUM('rmin', 'Mindest-Innenradius', 'mm'), F_SEL('r', 'Innenradius (kleinster passender der Reihe)', RAD_OPT), F_NUM('rn', 'Radius der neutralen Faser', 'mm'),
        F_NUM('bogen', 'Bogenlänge einer 90-Grad-Biegung (neutrale Faser)', 'mm'), F_NUM('lges', 'Gestreckte Länge der Haube (Schenkel, Boden, Schenkel)', 'mm')],
      hint: ['Beim Biegen wird das Blech außen gedehnt und innen gestaucht. Nur eine Faser dazwischen behält ihre Länge, und genau mit ihr rechnest du den Zuschnitt.',
        'Mindestradius = Biegefaktor · Blechdicke. Radius der neutralen Faser = Innenradius + halbe Blechdicke. Bogen für 90 Grad = ein Viertel des Kreisumfangs dieser Faser. Von jedem Außenmaß ziehst du bis zur Biegung Innenradius plus Blechdicke ab.',
        'Gestreckte Länge = zwei gerade Schenkelstücke + gerades Stück im Boden + zwei Bögen. Gerade Schenkelstücke: Außenhöhe minus (r + s). Gerades Bodenstück: Außenbreite minus 2 · (r + s).'],
      check: safe(checkAbwicklung, 'Abwicklung'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => {
        const P = P_(ctx), si = sollInnen(P), W = FACH.wst[sollWerkstoff(P)], rmin = W.k * P.s, r = radiusOf(rmin), hA = si.hi + 2 * P.s, bA = si.bi + 2 * P.s;
        return { vals: { s: P.s, rmin: rd(rmin, 2), r: String(r), rn: rd(r + P.s / 2, 3), bogen: rd(bogenOf(r, P.s), 3), lges: rd(lgesOf(hA, bA, r, P.s), 2) }, tasks: tasksDone(STATIONS[3]) };
      },
      mutants: [
        { name: 'Radius eine Stufe daneben', mutate: d => { const i = FACH.radien.indexOf(+d.vals.r); d.vals.r = String(FACH.radien[i > 0 ? i - 1 : i + 1]); return d; }, expectFail: ['Innenradius'] },
        { name: 'Innenradius als Radius der neutralen Faser genommen', mutate: d => { d.vals.rn = +d.vals.r; return d; }, expectFail: ['Radius der neutralen Faser'] },
        { name: 'Bogen mit Durchmesser statt Radius gerechnet', mutate: d => { d.vals.bogen = d.vals.bogen * 2; return d; }, expectFail: ['Bogenlänge'] },
        { name: 'Zuschnitt aus den Außenmaßen addiert (ohne Abzug)', heavy: true, mutate: d => { d.vals.lges = d.vals.lges + 25; d.vals.bogen = d.vals.bogen * 2; d.vals.rn = +d.vals.r; return d; }, expectFail: ['Gestreckte Länge', 'Bogenlänge', 'Radius der neutralen Faser'] },
        { name: 'Blechdicke falsch aus dem Lastenheft übernommen', mutate: d => { d.vals.s = d.vals.s + 1; return d; }, expectFail: ['Blechdicke'] }
      ] },
    { id: 'vd5', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Bemaßung, Toleranzen und Passung für die Achse', level: 2,
      on: 'vb',
      text: 'Die Einstellachse läuft in einer Buchse der Frontplatte (Passung H7/g6). Trage Höchstmaß der Bohrung, Mindestmaß der Welle, Höchst- und Mindestspiel ein. Gib die Passungsart an. Dann bestimmst du für deine Außenlänge und deine Außenhöhe die Grenzmaße nach der Allgemeintoleranz im Lastenheft.',
      in: ['gehaeuse.ansichten'], out: 'gehaeuse.toleranz', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'tol', id: 'tol21', min: 70 }, { lab: 'tol', id: 'tol10', min: 70 }],
      form: [F_NUM('bMax', 'Höchstmaß der Bohrung H7', 'mm', 'Drei Nachkommastellen.'), F_NUM('wMin', 'Mindestmaß der Welle g6', 'mm', 'Drei Nachkommastellen.'), F_NUM('sMax', 'Höchstspiel', 'µm'), F_NUM('sMin', 'Mindestspiel', 'µm'),
        F_SEL('art', 'Passungsart', ART_OPT), F_NUM('lMax', 'Höchstmaß der Außenlänge (Allgemeintoleranz)', 'mm'), F_NUM('lMin', 'Mindestmaß der Außenlänge (Allgemeintoleranz)', 'mm'), F_NUM('hMax', 'Höchstmaß der Außenhöhe (Allgemeintoleranz)', 'mm')],
      hint: ['Die Grundtoleranz (IT) hängt vom Nennmaß ab, das Abmaß g liegt unter der Nulllinie. Für die Bohrung H beginnt die Toleranz bei null und geht nach oben.',
        'Höchstmaß Bohrung = Nennmaß + IT7. Mindestmaß Welle = Nennmaß + Abmaß g − IT6. Höchstspiel = Höchstmaß Bohrung − Mindestmaß Welle. Mindestspiel = Mindestmaß Bohrung − Höchstmaß Welle. Allgemeintoleranz: Maßbereich in der Tabelle suchen, Abmaß ± auf das Nennmaß rechnen.',
        'Nimm die Werte für den Maßbereich deines Nennmaßes aus dem Tabellenbuch: IT6, IT7 und das Abmaß es für g. Bei den Allgemeintoleranzen suchst du in der Zeile der Klasse aus dem Lastenheft den Bereich von Außenlänge und Außenhöhe.'],
      check: safe(checkToleranz, 'Toleranzen'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => {
        const P = P_(ctx), si = sollInnen(P), ps = sollPassung(P), aL = si.li + 2 * P.s, aH = si.hi + 2 * P.s, tL = allgOf(P.klasse, aL), tH = allgOf(P.klasse, aH);
        return { vals: { bMax: rd(ps.bMax, 3), wMin: rd(ps.wMin, 3), sMax: ps.sMax, sMin: ps.sMin, art: 'spiel', lMax: rd(aL + tL, 3), lMin: rd(aL - tL, 3), hMax: rd(aH + tH, 3) }, tasks: tasksDone(STATIONS[4]) };
      },
      mutants: [
        { name: 'Höchstmaß der Bohrung ohne Abmaß', mutate: d => { d.vals.bMax = Math.round(d.vals.bMax); return d; }, expectFail: ['Höchstmaß der Bohrung'] },
        { name: 'Spiel in Millimeter statt Mikrometer', mutate: d => { d.vals.sMax = d.vals.sMax / 1000; return d; }, expectFail: ['Höchstspiel'] },
        { name: 'Übermaßpassung angegeben', mutate: d => { d.vals.art = 'uebermass'; return d; }, expectFail: ['Passungsart'] },
        { name: 'Höchstmaß der Länge gleich Mindestmaß', mutate: d => { d.vals.lMax = d.vals.lMin; return d; }, expectFail: ['Höchstmaß Außenlänge'] },
        { name: 'Mindestspiel mit dem Höchstmaß der Welle falsch gerechnet', heavy: true, mutate: d => { d.vals.sMin = d.vals.sMin + 20; d.vals.sMax = d.vals.sMax + 20; d.vals.wMin = d.vals.wMin - 0.02; d.vals.bMax = d.vals.bMax + 0.02; return d; }, expectFail: ['Mindestspiel', 'Höchstspiel', 'Mindestmaß der Welle', 'Höchstmaß der Bohrung'] }
      ] },
    { id: 'vd6', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Normteile, Gewinde und Stückliste', level: 2,
      on: 'vb',
      text: 'Front- und Rückplatte sitzen mit M4-Schrauben und Muttern an Laschen der Haube, die Platine auf M3-Stehbolzen mit Gewinde im Bodenblech. Bestimme Durchgangsloch und Kernloch, rechne die Schraubenlänge aus der Klemmlänge deiner Blechdicke und wähle die Normlänge. Dann zählst du die Normteile für die Stückliste.',
      in: ['gehaeuse.abwicklung', 'gehaeuse.toleranz'], out: 'gehaeuse.normteile', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kon', id: 'kon8', min: 70 }, { lab: 'fer', id: 'fer6', min: 70 }],
      form: [F_NUM('dg', 'Durchgangsloch für M4 (Reihe mittel)', 'mm'), F_NUM('kern', 'Kernlochdurchmesser für M3', 'mm'), F_NUM('kluem', 'Klemmlänge (zwei Blechlagen)', 'mm'), F_NUM('lraw', 'Rechnerische Schraubenlänge', 'mm'),
        F_SEL('lnorm', 'Normlänge der Schraube', LNORM_OPT), F_NUM('nSchr', 'Anzahl Schrauben M4 (beide Platten)', 'Stück'), F_NUM('nMut', 'Anzahl Muttern M4', 'Stück'), F_NUM('nSteh', 'Anzahl Stehbolzen M3', 'Stück')],
      hint: ['Das Durchgangsloch ist etwas größer als das Gewinde, das Kernloch etwas kleiner. Beides steht im Tabellenbuch beim Gewinde.',
        'Kernloch = Nenndurchmesser − Steigung. Schraubenlänge = Klemmlänge + Mutterhöhe + Überstand von etwa zwei Gewindegängen. Dann auf die nächste Normlänge aufrunden.',
        'Die Klemmlänge ist die Dicke beider Bleche zusammen. Je Platte gibt das Lastenheft die Schraubenzahl vor, je Schraube gehört eine Mutter dazu. Die Platine braucht vier Stehbolzen.'],
      check: safe(checkNormteile, 'Normteile'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => { const P = P_(ctx), sn = sollNorm(P.s), nS = 2 * P.schrPlatte; return { vals: { dg: FACH.dgM4, kern: FACH.kernM3, kluem: sn.klemm, lraw: rd(sn.raw, 2), lnorm: String(sn.ln), nSchr: nS, nMut: nS, nSteh: P.nSteh }, tasks: tasksDone(STATIONS[5]) }; },
      mutants: [
        { name: 'Kernloch gleich Gewindenenndurchmesser', mutate: d => { d.vals.kern = 3; return d; }, expectFail: ['Kernloch'] },
        { name: 'Durchgangsloch gleich Gewindenenndurchmesser', mutate: d => { d.vals.dg = 4; return d; }, expectFail: ['Durchgangsloch'] },
        { name: 'Schraube zu kurz gewählt', mutate: d => { d.vals.lnorm = '6'; return d; }, expectFail: ['Normlänge'] },
        { name: 'Muttern vergessen', mutate: d => { d.vals.nMut = 0; return d; }, expectFail: ['Anzahl Muttern'] },
        { name: 'Klemmlänge nur ein Blech', mutate: d => { d.vals.kluem = d.vals.kluem / 2; return d; }, expectFail: ['Klemmlänge'] }
      ] },
    { id: 'vd7', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Fertigungsgerecht: Lüftungsschlitze und Bohrbild', level: 3,
      on: 'vb',
      text: 'Das Gehäuse muss die Verlustleistung abführen. Rechne mit der Übungsformel aus dem Lastenheft den Luftstrom, die freie Fläche und die Zahl der Schlitze. Prüfe, ob das Schlitzfeld in den Deckel passt. Dann bestimmst du für das Durchgangsloch in der Lasche den Mindestabstand zur Biegung, damit das Blech beim Biegen nicht verzieht.',
      in: ['gehaeuse.normteile', 'gehaeuse.abwicklung', 'gehaeuse.innenmass'], out: 'gehaeuse.konstruktion', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'kon', id: 'kon33', min: 70 }, { lab: 'zei', id: 'zei43', min: 70 }],
      form: [F_NUM('dT', 'Erlaubte Erwärmung der Luft im Gehäuse', 'K'), F_NUM('V', 'Nötiger Luftvolumenstrom', 'l/s'), F_NUM('A', 'Erforderliche freie Fläche (je Zuluft und Abluft)', 'mm²'), F_NUM('n', 'Anzahl Schlitze 3 × 30 mm', 'Stück', 'Immer aufrunden.'),
        F_NUM('F', 'Länge des Schlitzfelds (Schlitze und Stege)', 'mm'), F_NUM('platzL', 'Platz in Längsrichtung im Deckel (ohne Randabstand)', 'mm'), F_SEL('passt', 'Passt das Schlitzfeld in den Deckel?', JANEIN), F_NUM('eMin', 'Mindestabstand Lochmitte bis Biegung (Durchgangsloch M4)', 'mm')],
      hint: ['Die Luft nimmt die Wärme mit. Je mehr Verlustleistung und je kleiner die erlaubte Erwärmung, desto mehr Luft brauchst du. Aus dem Luftstrom und der Strömungsgeschwindigkeit folgt die Fläche.',
        'V = P / (ρ·cp · ΔT), Einheit m³/s, dann in l/s umrechnen (1 m³ = 1000 l). Fläche = V geteilt durch die Geschwindigkeit, umgerechnet in mm². Schlitzzahl = Fläche geteilt durch die Fläche eines Schlitzes, aufgerundet. Feld = n Schlitze + (n − 1) Stege.',
        'Der Steg beträgt zwei Blechdicken. Randabstand 10 mm an beiden Enden vom Innenmaß abziehen. Abstand Lochmitte bis zur Biegung = halber Lochdurchmesser + 2 · Blechdicke + Innenradius.'],
      check: safe(checkKonstruktion, 'Konstruktion'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => {
        const P = P_(ctx), si = sollInnen(P), lf = sollLuft(P, P.s), W = FACH.wst[sollWerkstoff(P)], r = radiusOf(W.k * P.s);
        return { vals: { dT: lf.dT, V: rd(lf.V, 4), A: rd(lf.A, 1), n: lf.n, F: lf.F, platzL: si.li - 2 * FACH.randFeld, passt: lf.F <= si.li - 2 * FACH.randFeld ? 'ja' : 'nein', eMin: rd(FACH.dgM4 / 2 + 2 * P.s + r, 2) }, tasks: tasksDone(STATIONS[6]) };
      },
      mutants: [
        { name: 'Temperaturdifferenz mit der Innentemperatur verwechselt', mutate: d => { d.vals.dT = 45; return d; }, expectFail: ['Temperaturdifferenz'] },
        { name: 'Fläche zu klein: Umrechnung in mm² um den Faktor 10 vergessen', mutate: d => { d.vals.A = d.vals.A / 10; return d; }, expectFail: ['Erforderliche freie Fläche'] },
        { name: 'Schlitzzahl abgerundet und eine zu wenig', mutate: d => { d.vals.n = d.vals.n - 2; return d; }, expectFail: ['Anzahl Schlitze'] },
        { name: 'Biegeradius beim Lochabstand vergessen', mutate: d => { d.vals.eMin = d.vals.eMin - 3; return d; }, expectFail: ['Mindestabstand Lochmitte'] },
        { name: 'Luftstrom und Schlitze viel zu klein', heavy: true, mutate: d => { d.vals.V = d.vals.V / 4; d.vals.n = Math.max(1, Math.round(d.vals.n / 4)); d.vals.eMin = 2; return d; }, expectFail: ['Luftvolumenstrom', 'Erforderliche freie Fläche', 'Anzahl Schlitze'] }
      ] },
    { id: 'vd8', lab: 'vb', cat: 'Gehäuse Labornetzteil', title: 'Masse und Materialkosten', level: 3,
      on: 'vb',
      text: 'Rechne mit deinen Werten aus den früheren Stationen die Masse der Blechteile und die Materialkosten. Die Haube hat deine gestreckte Länge und die Innenlänge als Breite. Dazu kommen Bodenblech (Innenlänge mal Innenbreite) und zwei Platten in Außenbreite mal Außenhöhe. Preise und Verschnitt stehen unten im Hinweis.',
      in: ['gehaeuse.abwicklung', 'gehaeuse.werkstoff', 'gehaeuse.normteile', 'gehaeuse.innenmass', 'gehaeuse.ansichten'], out: 'gehaeuse.kosten', type: 'vb.form', w: 100, pass: null,
      tasks: [{ lab: 'fer', id: 'fer21', min: 70 }, { lab: 'fer', id: 'fer20', min: 70 }],
      form: [F_NUM('mHaube', 'Masse der Haube', 'kg'), F_NUM('mGes', 'Gesamtmasse der Blechteile (Haube, Boden, zwei Platten)', 'kg'), F_NUM('kBlech', 'Blechkosten mit Verschnitt', '€', 'Preise und Zuschlag: 1,20 €/kg Stahl, 5,00 €/kg Aluminium, 4,20 €/kg Edelstahl, 25 % Verschnitt (A).'),
        F_NUM('kNorm', 'Normteilkosten', '€', 'Schraube M4 0,06 €, Mutter M4 0,03 €, Stehbolzen M3 0,35 € plus Schraube M3 0,04 € je Stehbolzen (A).'), F_NUM('kGes', 'Materialkosten gesamt', '€')],
      hint: ['Das Volumen jedes Blechteils ist Länge mal Breite mal Dicke. Rechne alles in mm und wandle am Ende um: 1 dm³ sind eine Million mm³.',
        'Masse = Volumen in dm³ mal Dichte in kg/dm³. Blechkosten = Masse · Preis je kg · Verschnittfaktor 1,25. Normteilkosten = Stückzahl mal Einzelpreis, die Platine hat je Stehbolzen auch eine Schraube M3.',
        'Haube: gestreckte Länge × Innenlänge × Blechdicke. Boden: Innenlänge × Innenbreite × Blechdicke. Platten: 2 × Außenbreite × Außenhöhe × Blechdicke. Gesamtkosten = Blechkosten + Normteilkosten.'],
      check: safe(checkKosten, 'Kosten'),
      starter: ctx => ({ vals: {}, tasks: {} }),
      solution: ctx => {
        const P = P_(ctx), si = sollInnen(P), W = FACH.wst[sollWerkstoff(P)], r = radiusOf(W.k * P.s), aB = si.bi + 2 * P.s, aH = si.hi + 2 * P.s, lg = lgesOf(aH, aB, r, P.s), nS = 2 * P.schrPlatte;
        const vH = lg * si.li * P.s, vG = volBlech(lg, si.li, si.bi, aB, aH, P.s), mG = vG / 1e6 * W.rho, kB = mG * W.preis * FACH.verschnitt, kN = normKosten(nS, nS, P.nSteh);
        return { vals: { mHaube: rd(vH / 1e6 * W.rho, 4), mGes: rd(mG, 4), kBlech: rd(kB, 3), kNorm: rd(kN, 3), kGes: rd(rd(kB, 3) + rd(kN, 3), 3) }, tasks: tasksDone(STATIONS[7]) };
      },
      mutants: [
        { name: 'Masse in Gramm statt Kilogramm', mutate: d => { d.vals.mGes = d.vals.mGes * 1000; return d; }, expectFail: ['Gesamtmasse'] },
        { name: 'Verschnitt vergessen', mutate: d => { d.vals.kBlech = d.vals.kBlech / 1.25; return d; }, expectFail: ['Blechkosten'] },
        { name: 'Normteile nur halb gezählt', mutate: d => { d.vals.kNorm = d.vals.kNorm / 2; return d; }, expectFail: ['Normteilkosten'] },
        { name: 'Gesamtkosten nur aus dem Blech', mutate: d => { d.vals.kGes = d.vals.kBlech; return d; }, expectFail: ['Materialkosten gesamt'] },
        { name: 'Boden und Platten vergessen, nur die Haube gewogen', heavy: true, mutate: d => { d.vals.mGes = d.vals.mHaube; d.vals.kBlech = d.vals.kBlech * 0.6; d.vals.kGes = d.vals.kGes * 0.5; d.vals.kNorm = 0.5; return d; }, expectFail: ['Gesamtmasse', 'Blechkosten', 'Normteilkosten'] }
      ] }
  ];

  /* ====================================================================== Gesamttest: Zeichnungsprüfung */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, level: level, tol: 1, slots: slots || {}, get: k => (slots || {})[k] };
    const c = chain(ctx), si = sollInnen(P), tol = 0.5;
    const raw = fin(c.li) && fin(c.bi) && fin(c.hi) && c.li >= si.liRaw - 1e-9 && c.bi >= si.biRaw - 1e-9 && c.hi >= si.hRaw - 1e-9;
    const aus = fin(c.aL) && fin(c.aB) && fin(c.aH) && fin(c.s) && Math.abs(c.aL - (c.li + 2 * c.s)) <= tol && Math.abs(c.aB - (c.bi + 2 * c.s)) <= tol && Math.abs(c.aH - (c.hi + 2 * c.s)) <= tol && Math.abs(c.s - P.s) <= 0.01;
    const W = FACH.wst[c.wst] || null, sw = sollWerkstoff(P);
    const rOk = !!W && fin(c.r) && fin(c.s) && c.r >= W.k * c.s - 1e-9 && radiusOf(W.k * c.s) === c.r;
    const nK = numOf(c.k.n), lf = sollLuft(P, P.s), freeN = fin(nK) ? nK * FACH.schlitzB * FACH.schlitzL : NaN, passtK = sx(c.k.passt) === 'ja';
    const sMinE = numOf(c.t.sMin), sMaxE = numOf(c.t.sMax), art = sx(c.t.art);
    const spielOk = fin(sMinE) && fin(sMaxE) && sMinE > 0 && sMaxE <= FACH.spielMax && art === 'spiel';
    const wOk = sx(c.w.wst) === sw && !!W && sx(c.w.schutz) === W.schutz;
    const kG = numOf(own(ctx, 'kosten').kGes), mG = numOf(own(ctx, 'kosten').mGes);
    const vol = fin(c.li) && fin(c.bi) && fin(c.hi) ? c.li * c.bi * c.hi / 1e6 : NaN;
    return {
      lines: [
        L(raw && aus, 'Maßkette: ' + (raw && aus ? 'Platine und Trafo passen in das Innenmaß, die Außenmaße folgen aus Innenmaß und Blechdicke' : !raw ? 'das Innenmaß reicht für Platine und Trafo nicht (oder fehlt)' : 'die Außenmaße passen nicht zu Innenmaß und Blechdicke'), 20),
        L(rOk, 'Biegeradius: ' + (rOk ? 'der Innenradius passt zum Werkstoff und zur Blechdicke' : 'der Innenradius ist nicht der kleinste Normradius über dem Mindestradius deines Werkstoffs'), 20),
        L(fin(freeN) && freeN >= lf.A - 1e-9 && passtK, 'Lüftung: ' + (fin(freeN) ? 'deine ' + fm(nK, 0) + ' Schlitze geben ' + fm(freeN, 0) + ' mm² frei' + (freeN >= lf.A - 1e-9 ? ', das reicht für die Verlustleistung aus dem Lastenheft' : ', das reicht für die Verlustleistung nicht') + (passtK ? '' : ' (und das Feld passt nicht in den Deckel)') : 'keine Schlitzzahl'), 20),
        L(spielOk, 'Passung: ' + (spielOk ? 'Spielpassung mit Mindestspiel über null und Höchstspiel bis ' + FACH.spielMax + ' µm' : 'die Achse muss sicher laufen (Mindestspiel über null) und darf nicht wackeln (Höchstspiel bis ' + FACH.spielMax + ' µm)'), 15),
        L(wOk, 'Werkstoff und Schutz: ' + (wOk ? 'passen zum Einsatz im Lastenheft' : 'Werkstoff und Oberflächenschutz passen nicht zum Einsatz aus dem Lastenheft'), 15),
        L(fin(kG) && kG <= P.budget, 'Kosten: ' + (fin(kG) ? fm(kG, 2) + ' €, erlaubt höchstens ' + fm(P.budget, 2) + ' €' : 'keine Materialkosten'), 10)
      ],
      kpis: [
        { key: 'volumen', label: 'Innenvolumen', value: fin(vol) ? rd(vol, 2) : null, unit: 'l', ok: raw },
        { key: 'masse', label: 'Masse der Blechteile', value: fin(mG) ? rd(mG, 3) : null, unit: 'kg', ok: fin(mG) },
        { key: 'kosten', label: 'Materialkosten', value: fin(kG) ? rd(kG, 2) : null, unit: '€', ok: fin(kG) && kG <= P.budget },
        { key: 'lueftung', label: 'Freie Lüftungsfläche', value: fin(freeN) ? Math.round(freeN) : null, unit: 'mm²', ok: fin(freeN) && freeN >= lf.A - 1e-9 },
        { key: 'spiel', label: 'Mindestspiel der Achse', value: fin(sMinE) ? sMinE : null, unit: 'µm', ok: spielOk },
        { key: 'radius', label: 'Biegeradius innen', value: fin(c.r) ? c.r : null, unit: 'mm', ok: rOk }
      ]
    };
  }

  function report(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, ctx = { spec: P, slots: slots || {}, get: k => (slots || {})[k] }, c = chain(ctx), k = own(ctx, 'kosten'), out = [];
    out.push({ h: 'Lastenheft', rows: [['Platine', P.boardW + ' × ' + P.boardH + ' mm'], ['Trafo', P.trafoVA + ' VA, ' + P.trafoL + ' × ' + P.trafoB + ' × ' + P.trafoH + ' mm'], ['Blechdicke', fm(P.s, 1) + ' mm'], ['Verlustleistung', P.pv + ' W'], ['Achse', 'Ø ' + P.dAchse + ' H7/g6'], ['Allgemeintoleranz', 'ISO 2768-' + P.klasse]] });
    out.push({ h: 'Maße', rows: [['Innenmaß', fm(c.li, 0) + ' × ' + fm(c.bi, 0) + ' × ' + fm(c.hi, 0) + ' mm'], ['Außenmaß', fm(c.aL, 1) + ' × ' + fm(c.aB, 1) + ' × ' + fm(c.aH, 1) + ' mm'], ['Maßstab', sx(c.a.massstab)]] });
    out.push({ h: 'Blech', rows: [['Werkstoff', (FACH.wst[c.wst] || { name: '?' }).name], ['Innenradius', fm(c.r, 1) + ' mm'], ['Gestreckte Länge der Haube', fm(c.lges, 1) + ' mm']] });
    out.push({ h: 'Kosten', rows: [['Masse', fm(numOf(k.mGes), 3) + ' kg'], ['Materialkosten', fm(numOf(k.kGes), 2) + ' €']] });
    return out;
  }

  const def = {
    id: PID, name: 'Gehäuse für das Labornetzteil', icon: '📦', prefix: 'vd', order: 12, beruf: ['tpd'],
    story: 'Die Lehrwerkstatt der Tonfunk GmbH Ermsleben hat Netzteile aufgebaut, aber sie liegen noch offen auf dem Tisch. Du bekommst den Auftrag, ein Blechgehäuse dafür zu konstruieren. Du holst dir die Maße der Platine aus dem Netzteil-Projekt, legst Innen- und Außenmaße fest und zeichnest die Ansichten. Dann rechnest du die Blechabwicklung, wählst Werkstoff, Passung und Normteile, planst die Lüftungsschlitze und prüfst am Ende, ob Zeichnung, Wärme und Kosten zusammenpassen.',
    company: 'Tonfunk GmbH Ermsleben', labs: ['zei', 'kon', 'tol', 'wer', 'fer'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft, stations: STATIONS,
    final: { id: 'vdF', title: 'Abschlusstest: Zeichnungsprüfung des Gehäuses', check: finalCheck },
    report: report,
    kpis: ['volumen', 'masse', 'kosten', 'lueftung', 'spiel', 'radius'],
    _test: { FACH: FACH, sollInnen: sollInnen, sollMassstab: sollMassstab, sollWerkstoff: sollWerkstoff, radiusOf: radiusOf, bogenOf: bogenOf, lgesOf: lgesOf, sollPassung: sollPassung, allgOf: allgOf, sollNorm: sollNorm, sollLuft: sollLuft, volBlech: volBlech, normKosten: normKosten }
  };
  /* Registrierung; die Schutzzeile meldet den Typ vb.form an, falls der Kern ihn noch nicht kennt (schadet später nicht) */
  const vForm = d => { const e = []; if (!isObj(d)) return ['Daten fehlen']; if (!isObj(d.vals) || Object.keys(d.vals).length > 80) e.push('vals fehlt'); if (d.tasks !== undefined && !(isObj(d.tasks) && Object.keys(d.tasks).every(k => fin(d.tasks[k])))) e.push('tasks muss Zahlen enthalten'); return e; };
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') { if (V.types().indexOf('vb.form') < 0) V.registerType('vb.form', { validate: vForm }); V.registerProject(def); }
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
})(typeof window !== 'undefined' ? window : globalThis);
