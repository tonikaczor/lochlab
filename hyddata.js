'use strict';
/* Tonfunk Hydraulik-Lab: Daten (Symbol-Katalog, Schaltungen/Anlagen, Aufgaben).
   window.HYD_DATA   { symbols, circuits, tasks, cats }
   window.HYD_TASKS  Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Lab-Kennung 'hyd', Status in localStorage 'lm4.hyd.done' = {id:true})
   Aufgabe: { id, cat, title, level, kind:'choice'|'num'|'wire', tips:[2-3], make(R) -> Instanz }
   Instanz choice: { text, sym?:[Symbolschlüssel], circ?:Schaltungs-ID, choices:[…], correct:i, expl }
   Instanz num:    { text, unit, value, tol (absolut), expl }
   Instanz wire:   { text, circ }   (Prüfung über HYD_CORE.runSeq mit circuits[circ].seq)
   Zahlen der Schaltungen sind Lehrwerte (Vereinfachungen siehe hydcore.js); Unsicheres steht mit PRUEFEN. */
(function (root) {
  const C = root.HYD_CORE || (typeof require !== 'undefined' ? require('./hydcore.js') : null);
  const f = (v, d) => C.fmtDe(v, d);
  const fa = (v, d) => C.fmtAuto(v, d == null ? 3 : d);

  /* ================================================================ Symbol-Katalog (Bibliothek und Symbol-Aufgaben) */
  const symbols = [
    { k: 'pump', name: 'Hydraulikpumpe (Konstantpumpe)', ports: 'P', text: 'Kreis mit ausgefülltem Dreieck, das nach außen zeigt (zum Druckanschluss P). Ein Förderstrom in eine Richtung, festes Fördervolumen. Die Pumpe saugt aus dem Tank an und erzeugt Volumenstrom, nicht Druck: Der Druck entsteht erst durch den Widerstand der Last.' },
    { k: 'motor', name: 'Antriebsmotor (Elektromotor)', ports: '–', text: 'Kreis mit M. Der Elektromotor treibt die Pumpe über die Welle (Doppelstrich) an.' },
    { k: 'tank', name: 'Tank (Behälter, belüftet)', ports: 'T', text: 'Offener Kasten (U-Form). Hier endet die Rücklaufleitung, der Druck ist 0 bar. In der Anlage dürfen mehrere Tank-Symbole vorkommen, es ist immer derselbe Tank.' },
    { k: 'filter', name: 'Filter', ports: '1, 2', text: 'Auf die Spitze gestelltes Quadrat mit gestrichelter Querlinie. Hält Schmutzteilchen aus dem Öl zurück, im Rücklauf oder in der Druckleitung.' },
    { k: 'dbv', name: 'Druckbegrenzungsventil (DBV)', ports: 'P, T', text: 'Quadrat mit Pfeil, normal geschlossen (Pfeil versetzt). Gestrichelte Steuerleitung vom Eingang P, Feder mit Verstellpfeil auf der Gegenseite. Öffnet bei Erreichen des Einstelldrucks und leitet das Öl zum Tank T.' },
    { k: 'cyl', name: 'Zylinder, doppeltwirkend', ports: 'A (Kolbenseite), B (Stangenseite)', text: 'Beide Seiten des Kolbens lassen sich mit Druck beaufschlagen: Ausfahren über A, Einfahren über B. Kolbenfläche A_A ist größer als die Ringfläche A_B (Stange verdrängt Fläche), deshalb ist die Ausfahrkraft größer und die Ausfahrgeschwindigkeit kleiner.' },
    { k: 'cyle', name: 'Zylinder, einfachwirkend (Federrückstellung)', ports: 'A', text: 'Nur eine Seite hat einen Druckanschluss, die Feder (Zickzacklinie) oder die Last fährt zurück. Das Öl muss beim Einfahren über das Ventil zum Tank abfließen können.' },
    { k: 'v43', name: '4/3-Wegeventil, Mittelstellung gesperrt', ports: 'P, T, A, B', text: '4 Anschlüsse, 3 Schaltstellungen (drei Kästchen). Die Anschlüsse liegen am mittleren Kästchen (Grundstellung, Federzentrierung, Magnete a und b). Mittelstellung gesperrt: alle Anschlüsse zu, der Zylinder steht, die Pumpe fördert über das DBV.' },
    { k: 'v43u', name: '4/3-Wegeventil, Mittelstellung Umlauf', ports: 'P, T, A, B', text: 'In der Mittelstellung ist P mit T verbunden (Umlauf): Die Pumpe fördert nahezu drucklos in den Tank, der Zylinder ist durch A und B gesperrt.' },
    { k: 'v43h', name: '4/3-Wegeventil, Mittelstellung alle Anschlüsse verbunden', ports: 'P, T, A, B', text: 'In der Mittelstellung sind alle vier Anschlüsse miteinander verbunden: Pumpe drucklos im Umlauf, der Zylinder ist entlastet und könnte durch eine Last bewegt werden. /* PRUEFEN */ Bezeichnung der Mittelstellung nach Herstellerkatalog (z. B. Buchstabe H) bitte gegenprüfen.' },
    { k: 'v42', name: '4/2-Wegeventil', ports: 'P, T, A, B', text: '4 Anschlüsse, 2 Schaltstellungen. Hier: Magnet a links, Feder rechts. In Grundstellung (Feder) ist P mit B und A mit T verbunden, betätigt (Magnet) P mit A und B mit T.' },
    { k: 'v32', name: '3/2-Wegeventil', ports: 'P, T, A', text: '3 Anschlüsse, 2 Stellungen. Hier: Grundstellung A mit T (Zylinder entlastet), betätigt P mit A. Typisch für einfachwirkende Zylinder.' },
    { k: 'v22', name: '2/2-Wegeventil (Absperrventil)', ports: 'P, A', text: '2 Anschlüsse, 2 Stellungen: offen oder gesperrt. Hier in Ruhe gesperrt (Federseite zeigt die Sperrstellung).' },
    { k: 'rv', name: 'Rückschlagventil', ports: '1, 2', text: 'Kugel im Kegelsitz: Durchfluss frei von 1 nach 2, in Gegenrichtung gesperrt. /* PRUEFEN */ Lage von Kugel und V-Sitz im Schaltzeichen (Spitze zum Eingang) bitte mit DIN ISO 1219-1 vergleichen.' },
    { k: 'rve', name: 'Rückschlagventil, entsperrbar', ports: '1, 2, X', text: 'Wie das Rückschlagventil, zusätzlich Steueranschluss X (gestrichelt): Mit Steuerdruck an X wird auch die Sperrrichtung geöffnet. Hält Lasten leckölfrei fest.' },
    { k: 'drossel', name: 'Drosselventil', ports: '1, 2', text: 'Zwei gegenüberliegende Bögen verengen den Querschnitt, der Pfeil zeigt die Einstellbarkeit. Begrenzt den Volumenstrom (und damit die Geschwindigkeit); der Rest fließt über das DBV ab, der Druck steigt.' },
    { k: 'drv', name: 'Drosselrückschlagventil', ports: '1, 2', text: 'Drossel und Rückschlagventil parallel: Frei von 1 nach 2, gedrosselt von 2 nach 1. Damit wird eine Bewegungsrichtung gedrosselt, die andere läuft schnell.' },
    { k: 'mano', name: 'Manometer', ports: 'M', text: 'Kreis mit Zeiger: Anzeige des Drucks in bar an der Messstelle.' }
  ];

  /* ================================================================ Schaltungen / Anlagen */
  /* Rahmen: Zylinder oben, Wegeventil darunter, Pumpenaggregat mit Manometer, DBV und Tanks unten.
     Anschluss-Abstände sind so gewählt, dass die Tipp-Ziele (≥ 46 Einheiten) getrennt bleiben. */
  function frame(o) {
    const cx = o.cx || 150, cy = 54, ct = cy + 40, gap = o.gap || 50, va = ct + gap, vy = va + 46;
    const zx = o.cyl === 'cyle' ? cx + 40 : cx;
    const parts = [
      Object.assign({ id: 'Z1', kind: o.cyl || 'cyl', x: zx, y: cy, label: 'Z1' }, o.z || {}),
      Object.assign({ id: 'V1', kind: o.vk, x: cx, y: vy, label: 'V1' }, o.v || {}),
      { id: 'M1', kind: 'pump', x: 96, y: vy + 140, q: o.q || 10, label: 'M1' },
      { id: 'MA1', kind: 'mano', x: 36, y: vy + 42, label: 'MA1' },
      { id: 'R1', kind: 'dbv', x: 248, y: vy + 138, rot: 180, pset: o.pset || 80, label: 'R1' },
      { id: 'TK1', kind: 'tank', x: 248, y: vy + 250 },
      { id: 'TK2', kind: 'tank', x: 306, y: vy + 114 }
    ];
    return { parts: parts.concat(o.extra || []), H: vy + 290, ct, vy };
  }
  const base = (A, B) => [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P']];
  const press = F => ({ type: 'press', F });
  const mk = (id, title, short, o) => Object.assign({ id, title, short, W: 360 }, o);
  const circuits = {};

  /* ---- C1: 4/2-Wegeventil, doppeltwirkender Zylinder ---- */
  (function () {
    const fr = frame({ vk: 'v42', z: { D: 50, d: 28, stroke: 200, load: press(6000) }, pset: 80, q: 10 });
    circuits.C1 = mk('C1', 'Zylinder mit 4/2-Wegeventil', 'Grundschaltung', {
      parts: fr.parts, H: fr.H,
      ref: base().concat([['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']]),
      fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'A und B vertauscht', lines: base().concat([['V1.A', 'Z1.B'], ['V1.B', 'Z1.A']]) },
        { name: 'Druckbegrenzung nicht an der Druckleitung', lines: [['M1.P', 'V1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] },
        { name: 'Ventil-Tankanschluss fehlt', lines: [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] }
      ],
      seq: { steps: [
        { name: 'Magnet a betätigen: Zylinder fährt aus', set: { V1: 'a' }, expect: [{ t: 'ext', c: 'Z1' }, { t: 'pmin', v: 70 }] },
        { name: 'Magnet loslassen: Feder schaltet zurück, Zylinder fährt ein', set: { V1: '0' }, expect: [{ t: 'ret', c: 'Z1' }] }
      ] },
      info: 'Betätigt (a): P→A, B→T, der Zylinder fährt aus. Grundstellung (Feder): P→B, A→T, er fährt ein. Am Anschlag fließt die ganze Pumpenmenge über das DBV ab, das Manometer zeigt den Einstelldruck.',
      tryIt: ['Ventil auf a: Zylinder fährt aus, danach steigt der Druck bis zum Einstelldruck des DBV.', 'Ventil auf 0: Zylinder fährt schneller ein (Ringfläche ist kleiner).', 'Stelle das DBV auf unter 35 bar: Die Last wird nicht mehr bewegt.']
    });
  })();

  /* ---- C2: 4/3, Mittelstellung Umlauf ---- */
  (function () {
    const fr = frame({ vk: 'v43', v: { mid: 'umlauf' }, z: { D: 50, d: 28, stroke: 200, load: press(4000) }, pset: 80, q: 10 });
    circuits.C2 = mk('C2', '4/3-Wegeventil, Mittelstellung Umlauf', 'Pumpe im Umlauf', {
      parts: fr.parts, H: fr.H,
      ref: base().concat([['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']]),
      fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'Ventil-Tankanschluss fehlt', lines: [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] },
        { name: 'Ventil nicht an der Pumpe', lines: [['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] },
        { name: 'B und A vertauscht', lines: base().concat([['V1.A', 'Z1.B'], ['V1.B', 'Z1.A']]) }
      ],
      seq: { steps: [
        { name: 'Ventil auf a: Zylinder fährt bis zur Mitte aus', set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 }, expect: [{ t: 'ext', c: 'Z1', to: 0.5 }] },
        { name: 'Mittelstellung: Zylinder steht, Pumpe fördert drucklos in den Tank', set: { V1: '0' }, expect: [{ t: 'hold', c: 'Z1' }, { t: 'pmax', v: 5 }] },
        { name: 'Ventil auf b: Zylinder fährt ein', set: { V1: 'b' }, expect: [{ t: 'ret', c: 'Z1' }] }
      ] },
      info: 'Mittelstellung Umlauf: P ist mit T verbunden, A und B sind gesperrt. Die Pumpe fördert fast drucklos in den Tank (wenig Leistung, wenig Wärme), der Zylinder steht. Wegen Leckage hält die Sperrstellung eine Last auf Dauer nicht.',
      tryIt: ['Ventil auf a, dann auf 0: Der Zylinder bleibt stehen, der Pumpendruck fällt auf nahezu 0 bar.', 'Vergleiche mit Schaltung C3 (Mittelstellung gesperrt).']
    });
  })();

  /* ---- C3: 4/3, Mittelstellung gesperrt ---- */
  (function () {
    const fr = frame({ vk: 'v43', v: { mid: 'sperr' }, z: { D: 63, d: 36, stroke: 200, load: press(10000) }, pset: 100, q: 10 });
    circuits.C3 = mk('C3', '4/3-Wegeventil, Mittelstellung gesperrt', 'Zylinder halten', {
      parts: fr.parts, H: fr.H,
      ref: base().concat([['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']]),
      fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'Ventil-Tankanschluss fehlt', lines: [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] },
        { name: 'Druckbegrenzung fehlt an der Druckleitung', lines: [['M1.P', 'V1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']] },
        { name: 'A und B vertauscht', lines: base().concat([['V1.A', 'Z1.B'], ['V1.B', 'Z1.A']]) }
      ],
      seq: { steps: [
        { name: 'Ventil auf a: Zylinder fährt bis zur Mitte aus', set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 }, expect: [{ t: 'ext', c: 'Z1', to: 0.5 }] },
        { name: 'Mittelstellung: Zylinder hält, Pumpe arbeitet gegen das DBV', set: { V1: '0' }, expect: [{ t: 'hold', c: 'Z1' }, { t: 'pmin', v: 90 }] },
        { name: 'Ventil auf b: Zylinder fährt ein', set: { V1: 'b' }, expect: [{ t: 'ret', c: 'Z1' }] }
      ] },
      info: 'Mittelstellung gesperrt: alle vier Anschlüsse sind zu. Der Zylinder steht, das Öl in den Kammern ist eingeschlossen. Die Pumpe fördert weiter und der gesamte Förderstrom fließt über das DBV zum Tank: Der Druck steht auf dem Einstelldruck, es entsteht Verlustleistung und Wärme.',
      tryIt: ['Ventil auf a, dann auf 0: Zylinder hält, Manometer zeigt den DBV-Druck (100 bar).', 'Ändere den DBV-Druck: Das Manometer folgt.']
    });
  })();

  /* ---- C4: 3/2, einfachwirkender Zylinder ---- */
  (function () {
    const fr = frame({ vk: 'v32', cyl: 'cyle', z: { D: 50, stroke: 150, spring: 400, load: press(3000) }, pset: 60, q: 8 });
    const parts = fr.parts.filter(p => p.id !== 'TK2').concat([{ id: 'TK2', kind: 'tank', x: 306, y: fr.vy + 114 }]);
    const ref = [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A']];
    circuits.C4 = mk('C4', '3/2-Wegeventil, einfachwirkender Zylinder', 'Einfachwirkend', {
      parts, H: fr.H, ref, fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'P und T am Ventil vertauscht', lines: [['M1.P', 'V1.T'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['V1.P', 'TK2.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A']] },
        { name: 'Ventil-Tankanschluss fehlt', lines: [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['MA1.M', 'M1.P'], ['V1.A', 'Z1.A']] },
        { name: 'Zylinder nicht angeschlossen', lines: [['M1.P', 'V1.P'], ['R1.P', 'M1.P'], ['R1.T', 'TK1.T'], ['V1.T', 'TK2.T'], ['MA1.M', 'M1.P']] }
      ],
      seq: { steps: [
        { name: 'Magnet a betätigen: Zylinder fährt aus', set: { V1: 'a' }, expect: [{ t: 'ext', c: 'Z1' }, { t: 'pmin', v: 50 }] },
        { name: 'Magnet loslassen: A wird zum Tank entlastet, die Feder fährt den Zylinder ein', set: { V1: '0' }, expect: [{ t: 'ret', c: 'Z1' }] }
      ] },
      info: 'Betätigt (a): P→A, der Zylinder fährt aus. Grundstellung: A→T, die Feder drückt das Öl über das Ventil in den Tank zurück. Bei der Pumpe ohne Förderstrom in A gibt es keine aktive Rückfahrt.',
      tryIt: ['Ventil auf a: Zylinder fährt aus, Druck steigt am Anschlag auf den DBV-Wert.', 'Ventil auf 0: Zylinder fährt durch die Feder ein, der Pumpenstrom geht gesperrt über das DBV (P ist im 3/2-Ventil gesperrt).']
    });
  })();

  /* ---- C5: Drosselrückschlagventil (Zulaufdrosselung) ---- */
  (function () {
    const fr = frame({ vk: 'v42', gap: 204, z: { D: 50, d: 28, stroke: 200, load: press(6000) }, pset: 80, q: 10,
      extra: [{ id: 'DV1', kind: 'drv', x: 110, y: 54 + 40 + 102, rot: 180, qn: 1, label: 'DV1' }] });
    const ref = base().concat([['Z1.A', 'DV1.1'], ['DV1.2', 'V1.A'], ['V1.B', 'Z1.B']]);
    circuits.C5 = mk('C5', 'Drosselrückschlagventil: Ausfahren gedrosselt', 'Zulaufdrosselung', {
      parts: fr.parts, H: fr.H, ref, fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'Drosselrückschlagventil verkehrt herum', lines: base().concat([['V1.A', 'DV1.1'], ['DV1.2', 'Z1.A'], ['V1.B', 'Z1.B']]) },
        { name: 'Drosselrückschlagventil fehlt in der Leitung', lines: base().concat([['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']]) },
        { name: 'A und B vertauscht', lines: base().concat([['Z1.B', 'DV1.1'], ['DV1.2', 'V1.A'], ['V1.B', 'Z1.A']]) }
      ],
      seq: { steps: [
        { name: 'Magnet a: Zylinder fährt langsam (gedrosselt) aus', set: { V1: 'a' }, expect: [{ t: 'ext', c: 'Z1' }, { t: 'vmax', c: 'Z1', v: 0.04 }] },
        { name: 'Magnet loslassen: Zylinder fährt schnell ein (Rückschlagventil öffnet)', set: { V1: '0' }, expect: [{ t: 'ret', c: 'Z1' }, { t: 'vmin', c: 'Z1', v: 0.06 }] }
      ] },
      info: 'Das Drosselrückschlagventil sitzt in der Zuleitung zur Kolbenseite: Beim Ausfahren muss das Öl durch die Drossel (gedrosselt), beim Einfahren fließt es frei über das Rückschlagventil zurück. Der Pumpenstrom, den die Drossel nicht durchlässt, fließt über das DBV ab: Der Pumpendruck steht auf dem Einstelldruck.',
      tryIt: ['Ventil auf a: Zylinder fährt langsam, der Pumpendruck steht auf 80 bar, der Zylinderdruck ist deutlich niedriger.', 'Ventil auf 0: Zylinder fährt wieder schnell ein.']
    });
  })();

  /* ---- C6: Hubzylinder mit entsperrbarem Rückschlagventil ---- */
  (function () {
    const fr = frame({ vk: 'v43', gap: 168, v: { mid: 'H' }, z: { D: 63, d: 36, stroke: 200, load: { type: 'grav', F: 12000 } }, pset: 100, q: 10,
      extra: [{ id: 'RV1', kind: 'rve', x: 110, y: 54 + 40 + 84, label: 'RV1' }] });
    const ref = base().concat([['V1.A', 'RV1.1'], ['RV1.2', 'Z1.A'], ['V1.B', 'Z1.B'], ['RV1.X', 'Z1.B']]);
    circuits.C6 = mk('C6', 'Last halten mit entsperrbarem Rückschlagventil', 'Hubzylinder', {
      parts: fr.parts, H: fr.H, ref, fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: 'Steuerleitung X nicht angeschlossen', lines: base().concat([['V1.A', 'RV1.1'], ['RV1.2', 'Z1.A'], ['V1.B', 'Z1.B']]) },
        { name: 'Rückschlagventil verkehrt herum', lines: base().concat([['V1.A', 'RV1.2'], ['RV1.1', 'Z1.A'], ['V1.B', 'Z1.B'], ['RV1.X', 'Z1.B']]) },
        { name: 'Rückschlagventil fehlt', lines: base().concat([['V1.A', 'Z1.A'], ['V1.B', 'Z1.B']]) }
      ],
      seq: { steps: [
        { name: 'Ventil auf a: Last wird bis zur Mitte gehoben', set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 }, expect: [{ t: 'ext', c: 'Z1', to: 0.5 }] },
        { name: 'Mittelstellung: Last bleibt stehen, Pumpe fördert drucklos', set: { V1: '0' }, expect: [{ t: 'hold', c: 'Z1' }, { t: 'pmax', v: 5 }] },
        { name: 'Ventil auf b: Steuerdruck öffnet das Rückschlagventil, die Last wird abgesenkt', set: { V1: 'b' }, expect: [{ t: 'ret', c: 'Z1' }] }
      ] },
      info: 'Die Last (12 kN) hängt am Zylinder. In der Mittelstellung sind alle Anschlüsse verbunden (Pumpe im Umlauf). Ohne Rückschlagventil würde die Last absinken. Das entsperrbare Rückschlagventil sperrt den Weg von A zum Tank, bis über X Steuerdruck anliegt: Beim Absenken (P→B) öffnet der Druck in B das Ventil. Ohne zusätzliches Bremsventil kann die Last beim Absenken schneller werden, in der Praxis bremst man den Ablauf zusätzlich.',
      tryIt: ['Ventil auf a: Die Last wird gehoben (Druck etwa 40 bar).', 'Mittelstellung: Die Last bleibt stehen, der Pumpendruck fällt auf nahezu 0 bar.', 'Ventil auf b: Das Ventil wird über X entsperrt, die Last fährt ab.']
    });
  })();

  /* ---- C7: Eilgang-Vorschub (Drossel mit 2/2-Umgehung) ---- */
  (function () {
    const ct = 54 + 40, ym = ct + 92;
    const fr = frame({ vk: 'v42', cx: 200, gap: 184, z: { D: 50, d: 28, stroke: 200, load: press(6000) }, pset: 80, q: 10,
      extra: [{ id: 'DR1', kind: 'drossel', x: 160, y: ym, qn: 1, label: 'DR1' }, { id: 'V2', kind: 'v22', x: 96, y: ym, label: 'V2' }] });
    const ref = base().concat([['V1.A', 'DR1.1'], ['V1.A', 'V2.P'], ['DR1.2', 'Z1.A'], ['V2.A', 'Z1.A'], ['V1.B', 'Z1.B']]);
    circuits.C7 = mk('C7', 'Eilgang und Vorschub mit Drossel und 2/2-Ventil', 'Eilgang/Vorschub', {
      parts: fr.parts, H: fr.H, ref, fixed: [['MA1.M', 'M1.P'], ['R1.T', 'TK1.T']],
      wrong: [
        { name: '2/2-Ventil in Reihe statt parallel zur Drossel', lines: base().concat([['V1.A', 'V2.P'], ['V2.A', 'DR1.1'], ['DR1.2', 'Z1.A'], ['V1.B', 'Z1.B']]) },
        { name: 'Umgehung am Zylinder nicht angeschlossen', lines: base().concat([['V1.A', 'DR1.1'], ['V1.A', 'V2.P'], ['DR1.2', 'Z1.A'], ['V1.B', 'Z1.B']]) },
        { name: 'Drossel fehlt', lines: base().concat([['V1.A', 'V2.P'], ['V2.A', 'Z1.A'], ['V1.B', 'Z1.B']]) }
      ],
      seq: { steps: [
        { name: 'Eilgang: Magnete a und V2 betätigt, Zylinder fährt schnell aus', set: { V1: 'a', V2: 'a' }, expect: [{ t: 'ext', c: 'Z1' }, { t: 'vmin', c: 'Z1', v: 0.07 }] },
        { name: 'Rückfahrt im Eilgang', set: { V1: '0', V2: 'a' }, expect: [{ t: 'ret', c: 'Z1' }] },
        { name: 'Vorschub: V2 nicht betätigt, Zylinder fährt langsam (gedrosselt) aus', set: { V1: 'a', V2: '0' }, expect: [{ t: 'ext', c: 'Z1' }, { t: 'vmax', c: 'Z1', v: 0.04 }] }
      ] },
      info: 'Eilgang: Das 2/2-Ventil V2 ist offen und umgeht die Drossel, der volle Pumpenstrom fährt den Zylinder schnell aus. Vorschub: V2 ist gesperrt, das Öl muss durch die Drossel DR1; der Rest fließt über das DBV ab und der Pumpendruck steigt auf den Einstelldruck.',
      tryIt: ['V1 auf a und V2 auf a: Eilgang.', 'V2 auf 0: Vorschub, der Zylinder wird deutlich langsamer.', 'V1 auf 0 und V2 auf a: schnelle Rückfahrt.']
    });
  })();

  const circuitList = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];

  /* ================================================================ Aufgaben */
  const tasks = [];
  const cats = ['Symbole', 'Bauteile und Anschlüsse', 'Schaltplan lesen', 'Verschlauchen', 'Rechnen'];
  const T_AB = 'Beim normalen Üben kosten Tipps nichts.';
  function add(cat, title, level, o) { tasks.push(Object.assign({ id: 'hyd' + (tasks.length + 1), cat, title, level }, o)); }
  function choiceTask(cat, title, level, text, choices, correct, expl, tips, extra) {
    add(cat, title, level, Object.assign({ kind: 'choice', tips, make: () => Object.assign({ text, choices, correct, expl }, extra || {}) }, {}));
  }

  /* ---- Symbole ---- */
  choiceTask('Symbole', 'Hydraulikpumpe erkennen', 1, 'Welches Bauteil zeigt das Schaltzeichen?', ['Hydraulikpumpe (Konstantpumpe)', 'Hydraulikmotor', 'Druckbegrenzungsventil', 'Elektromotor'], 0,
    'Ein Kreis mit ausgefülltem Dreieck, dessen Spitze nach außen zeigt (zum Druckanschluss), ist eine Pumpe mit einer Förderrichtung. Die Pumpe fördert Volumenstrom; der Druck entsteht erst durch die Last.',
    ['Das Dreieck zeigt in Richtung des Ölstroms.', 'Der Strom verlässt das Bauteil nach außen: Es gibt Energie an das Öl ab.'], { sym: ['pump'] });
  choiceTask('Symbole', 'Zylinderart erkennen', 1, 'Der Zylinder hat zwei Druckanschlüsse, jede Kolbenseite lässt sich mit Druck beaufschlagen. Wie heißt er?', ['Zylinder, doppeltwirkend', 'Zylinder, einfachwirkend mit Federrückstellung', 'Tauchkolbenzylinder', 'Hydraulikmotor'], 0,
    'Doppeltwirkend: Ausfahren über Anschluss A (Kolbenseite), Einfahren über B (Stangenseite). Beim einfachwirkenden Zylinder gibt es nur einen Druckanschluss und eine Feder oder Last zur Rückstellung.',
    ['Zähle die Anschlüsse am Zylinder.', 'Zwei Anschlüsse = beide Bewegungsrichtungen werden hydraulisch angetrieben.'], { sym: ['cyl'] });
  choiceTask('Symbole', 'Druckbegrenzungsventil erkennen', 1, 'Welches Ventil ist hier abgebildet?', ['Druckbegrenzungsventil (DBV)', 'Rückschlagventil', 'Drosselventil', '2/2-Wegeventil'], 0,
    'Ein Quadrat mit versetztem Pfeil (normal geschlossen), gestrichelter Steuerleitung vom Eingang und Feder mit Verstellpfeil ist ein Druckbegrenzungsventil. Es öffnet bei Erreichen des Einstelldrucks und leitet das Öl zum Tank.',
    ['Achte auf die Feder und die gestrichelte Steuerleitung.', 'Der Druck am Eingang wirkt gegen die Feder: Ab dem Einstelldruck öffnet das Ventil.'], { sym: ['dbv'] });
  choiceTask('Symbole', 'Wegeventil benennen', 2, 'Wie heißt dieses Wegeventil nach Anschlüssen und Schaltstellungen?', ['4/3-Wegeventil', '3/4-Wegeventil', '4/2-Wegeventil', '3/2-Wegeventil'], 0,
    '4/3 bedeutet: 4 Anschlüsse (P, T, A, B), 3 Schaltstellungen (drei Kästchen). Erst die Anschlusszahl, dann die Stellungszahl. Dieses Ventil hat Mittelstellung gesperrt (alle Anschlüsse zu).',
    ['Zähle die Kästchen (= Stellungen) und die Anschlüsse am Mittelkästchen.', 'Vier Anschlüsse, drei Kästchen: Reihenfolge ist Anschlüsse/Stellungen.'], { sym: ['v43'] });
  choiceTask('Symbole', 'Entsperrbares Rückschlagventil', 2, 'Welches Bauteil zeigt das Schaltzeichen?', ['Rückschlagventil, entsperrbar', 'Rückschlagventil ohne Steuerung', 'Drosselrückschlagventil', 'Druckbegrenzungsventil'], 0,
    'Das Rückschlagventil hat einen zusätzlichen Steueranschluss X (gestrichelte Steuerleitung). Mit Druck an X wird die Sperrrichtung geöffnet. So lassen sich Lasten leckölfrei halten und gezielt wieder absenken.',
    ['Das gestrichelte Teil ist eine Steuerleitung.', 'Es gibt drei Anschlüsse: 1, 2 und X.'], { sym: ['rve'] });
  choiceTask('Symbole', 'Drosselrückschlagventil erkennen', 2, 'Welches Bauteil zeigt das Schaltzeichen?', ['Drosselrückschlagventil', 'Drosselventil', 'Rückschlagventil', 'Filter'], 0,
    'Eine Drossel und ein Rückschlagventil liegen parallel (gestrichelter Rahmen = ein Bauteil). In einer Richtung fließt das Öl frei über das Rückschlagventil, in der anderen nur durch die Drossel.',
    ['Es sind zwei Symbole in einem Rahmen.', 'Drossel und Rückschlagventil liegen parallel.'], { sym: ['drv'] });

  /* ---- Bauteile und Anschlüsse ---- */
  choiceTask('Bauteile und Anschlüsse', 'Anschluss T', 1, 'Wohin führt der Anschluss T eines Wegeventils?', ['Zum Tank (Rücklauf)', 'Zur Pumpe (Druckleitung)', 'Zur Kolbenseite des Zylinders', 'Zum Manometer'], 0,
    'T (Tank) ist der Rücklaufanschluss: Das Öl fließt drucklos in den Tank zurück. P ist der Druckanschluss (Pumpe), A und B sind die Arbeitsanschlüsse zum Verbraucher.',
    ['T steht für das englische tank.', 'Das Öl fließt dort entspannt zurück.'], null);
  choiceTask('Bauteile und Anschlüsse', 'Anschlüsse A und B', 1, 'Was bedeuten die Anschlüsse A und B am Wegeventil?', ['Arbeitsanschlüsse zum Verbraucher (Zylinder)', 'Anschlüsse für Pumpe und Tank', 'Steueranschlüsse für die Magnete', 'Anschlüsse für Druckmessgeräte'], 0,
    'A und B sind die Arbeitsanschlüsse und führen zu den beiden Zylinderkammern. P ist der Pumpenanschluss, T der Tankanschluss. Steuerleitungen werden mit X (oder Y) bezeichnet.',
    ['A und B sind die ersten Buchstaben der Arbeitsleitungen.', 'Sie führen zum Zylinder.'], { sym: ['v42'] });
  choiceTask('Bauteile und Anschlüsse', 'Aufgabe des DBV', 1, 'Welche Aufgabe hat das Druckbegrenzungsventil in einer Hydraulikanlage?', ['Es begrenzt den Systemdruck und schützt die Anlage vor Überdruck', 'Es regelt die Geschwindigkeit des Zylinders', 'Es hält die Last im Zylinder leckölfrei fest', 'Es filtert das Öl'], 0,
    'Die Pumpe fördert immer Volumenstrom. Kann das Öl nicht abfließen (Zylinder am Anschlag), würde der Druck unzulässig steigen. Das DBV öffnet beim Einstelldruck und leitet den Förderstrom zum Tank. Sicherheitsbauteil: Die Einstellung darf nicht verändert werden.',
    ['Was passiert, wenn die Pumpe gegen einen geschlossenen Weg fördert?', 'Der Druck steigt ohne Begrenzung: Leitungen und Bauteile können platzen.'], { sym: ['dbv'] });
  choiceTask('Bauteile und Anschlüsse', 'Steueranschluss X', 2, 'Wozu dient der Steueranschluss X am entsperrbaren Rückschlagventil?', ['Mit Steuerdruck an X wird die Sperrrichtung geöffnet', 'X ist der Anschluss zum Tank', 'X misst den Druck für das Manometer', 'X schließt das Ventil in Durchflussrichtung'], 0,
    'Das Rückschlagventil sperrt normalerweise in einer Richtung. Wird an X ein Steuerdruck angelegt, drückt ein Steuerkolben die Kugel vom Sitz und das Öl kann auch in Sperrrichtung fließen (z. B. beim Absenken einer Last).',
    ['X ist ein Steuer-, kein Arbeitsanschluss.', 'Die gestrichelte Linie im Symbol ist eine Steuerleitung.'], { sym: ['rve'] });
  choiceTask('Bauteile und Anschlüsse', 'Mittelstellung Umlauf', 2, 'Das 4/3-Wegeventil hat Mittelstellung Umlauf (P mit T verbunden, A und B gesperrt). Was geschieht in der Mittelstellung?', ['Die Pumpe fördert nahezu drucklos in den Tank, der Zylinder steht', 'Die Pumpe baut den vollen Systemdruck auf', 'Der Zylinder fährt langsam aus', 'Der Zylinder ist entlastet und kann von Hand bewegt werden'], 0,
    'Bei Umlauf geht der Pumpenstrom über P→T fast ohne Druck zurück in den Tank: wenig Leistungsverlust, kaum Erwärmung. Der Zylinder steht, weil A und B gesperrt sind. Bei Mittelstellung gesperrt müsste der Strom über das DBV abfließen (voller Druck, mehr Wärme).',
    ['Wohin kann die Pumpe ihr Öl fördern, wenn P mit T verbunden ist?', 'Ohne Widerstand baut sich kein Druck auf (p = F/A).'], { sym: ['v43u'] });

  /* ---- Schaltplan lesen (mit Simulation; Antwort aus dem Solver) ---- */
  function simFlow(circId, steps, extraOpts) {
    const circ = circuits[circId], st = C.makeState(circ); let tr = null;
    steps.forEach(s => { tr = C.runStep(circ, circ.ref, st, s.set, { stopAt: s.stopAt }); });
    return { tr, st, circ };
  }
  add('Schaltplan lesen', 'Zylinder ausfahren oder einfahren?', 1, {
    kind: 'choice', circ: 'C1', tips: ['Lies im Schaltplan nach, welche Verbindungen das Ventil in der betätigten Stellung (a) herstellt.', 'In Stellung a ist P mit A verbunden. A führt zur Kolbenseite.'],
    make: () => { const r = simFlow('C1', [{ set: { V1: 'a' } }]), ok = r.tr.cyl.Z1.pos1 > 0.9; return { text: 'Schalte das Ventil V1 auf Stellung a. Was macht die Kolbenstange?', circ: 'C1', choices: ['Sie fährt aus', 'Sie fährt ein', 'Sie bleibt stehen'], correct: ok ? 0 : 1, expl: 'In Stellung a ist P mit A verbunden: Das Drucköl strömt in die Kolbenseite, der Kolben schiebt die Stange nach außen. Das Öl aus der Stangenseite fließt über B und T zum Tank.' }; }
  });
  add('Schaltplan lesen', 'Druck bei gesperrter Mittelstellung', 2, {
    kind: 'num', circ: 'C3', tips: ['Der Zylinder steht, aber die Pumpe fördert weiter. Wohin fließt der Pumpenstrom?', 'Der gesamte Förderstrom fließt über das DBV, der Druck steht auf dem Einstelldruck.'],
    make: () => { const r = simFlow('C3', [{ set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 } }, { set: { V1: '0' } }]); return { text: 'Schalte das Ventil V1 auf a, bis der Zylinder in der Mitte ist, dann in die Mittelstellung (0). Was zeigt das Manometer MA1 an?', circ: 'C3', unit: 'bar', value: Math.round(r.tr.pEnd), tol: 4, expl: 'Mittelstellung gesperrt: Der Zylinder steht, der Pumpenstrom kann nur über das DBV abfließen. Der Druck steht deshalb auf dem Einstelldruck des DBV, hier ' + fa(Math.round(r.tr.pEnd)) + ' bar. Das ist Verlustleistung und erwärmt das Öl.' }; }
  });
  add('Schaltplan lesen', 'Pumpendruck im Umlauf', 2, {
    kind: 'choice', circ: 'C2', tips: ['In der Mittelstellung ist P mit T verbunden. Welcher Widerstand liegt vor der Pumpe?', 'Ohne Widerstand baut sich kein Druck auf.'],
    make: () => { const r = simFlow('C2', [{ set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 } }, { set: { V1: '0' } }]), ok = r.tr.pEnd < 5; return { text: 'Schalte V1 auf a (bis der Zylinder halb ausgefahren ist) und danach in die Mittelstellung. Welchen Druck zeigt das Manometer in der Mittelstellung?', circ: 'C2', choices: ['Nahezu 0 bar (drucklos im Umlauf)', 'Den Einstelldruck des DBV (80 bar)', 'Den Lastdruck des Zylinders', 'Der Druck lässt sich nicht sagen'], correct: ok ? 0 : 1, expl: 'Bei Mittelstellung Umlauf fördert die Pumpe über P→T frei in den Tank. Es gibt keinen Widerstand, also baut sich nur ein sehr kleiner Druck auf. Der Zylinder steht, weil A und B gesperrt sind.' }; }
  });
  add('Schaltplan lesen', 'Gedrosselt oder frei?', 2, {
    kind: 'choice', circ: 'C5', tips: ['Welche Richtung fließt durch die Drossel, welche über das Rückschlagventil?', 'Beim Ausfahren strömt das Öl vom Wegeventil zur Kolbenseite. Dort sitzt die Drossel im Weg.'],
    make: () => { const circ = circuits.C5, st = C.makeState(circ), a = C.runStep(circ, circ.ref, st, { V1: 'a' }), b = C.runStep(circ, circ.ref, st, { V1: '0' }), ok = a.cyl.Z1.vavg < b.cyl.Z1.vavg; return { text: 'Fahre den Zylinder mit V1 auf a aus und danach mit V1 auf 0 wieder ein. Wie unterscheiden sich die Geschwindigkeiten?', circ: 'C5', choices: ['Das Ausfahren ist langsamer als das Einfahren', 'Das Ausfahren ist schneller als das Einfahren', 'Beide Richtungen sind gleich schnell'], correct: ok ? 0 : 1, expl: 'Das Drosselrückschlagventil sitzt in der Zuleitung zur Kolbenseite: Beim Ausfahren muss das Öl durch die Drossel, die Geschwindigkeit sinkt. Beim Einfahren fließt es frei über das Rückschlagventil. Außerdem ist die Ringfläche kleiner, das Einfahren ist ohnehin etwas schneller.' }; }
  });
  add('Schaltplan lesen', 'Warum hält die Last?', 3, {
    kind: 'choice', circ: 'C6', tips: ['Vergleiche: In der Mittelstellung ist A mit T verbunden. Was verhindert, dass das Öl aus A abfließt?', 'Das entsperrbare Rückschlagventil sperrt in Richtung Tank, solange an X kein Steuerdruck anliegt.'],
    make: () => { const r = simFlow('C6', [{ set: { V1: 'a' }, stopAt: { c: 'Z1', pos: 0.5 } }, { set: { V1: '0' } }]), ok = Math.abs(r.tr.cyl.Z1.pos1 - 0.5) < 0.01; return { text: 'Hebe die Last mit V1 auf a bis zur Mitte und schalte dann auf Mittelstellung (alle Anschlüsse verbunden). Die Last bleibt stehen. Warum?', circ: 'C6', choices: ['Das entsperrbare Rückschlagventil sperrt den Weg von der Kolbenseite zum Tank', 'Das Druckbegrenzungsventil hält den Druck im Zylinder', 'Das Wegeventil sperrt in der Mittelstellung alle Anschlüsse', 'Die Pumpe hält den Druck aufrecht'], correct: ok ? 0 : 1, expl: 'In dieser Mittelstellung sind A, B, P und T verbunden. Ohne Rückschlagventil würde das Öl aus A zum Tank fließen und die Last sinken. Das Rückschlagventil sperrt diesen Weg (X ist drucklos), die Last wird leckölfrei gehalten. Erst beim Absenken (Druck in B, Steuerleitung X) öffnet es.' }; }
  });
  add('Schaltplan lesen', 'Einfachwirkender Zylinder zurückfahren', 2, {
    kind: 'choice', circ: 'C4', tips: ['Der Zylinder hat nur einen Anschluss. Wer drückt ihn zurück?', 'Die Feder (und die Last) drückt das Öl über das Ventil in den Tank zurück.'],
    make: () => { const circ = circuits.C4, st = C.makeState(circ); C.runStep(circ, circ.ref, st, { V1: 'a' }); const b = C.runStep(circ, circ.ref, st, { V1: '0' }), ok = b.cyl.Z1.pos1 < 0.01; return { text: 'Fahre den einfachwirkenden Zylinder mit V1 auf a aus. Wie fährt er danach wieder ein?', circ: 'C4', choices: ['Ventil in Grundstellung: A ist mit dem Tank verbunden, die Feder drückt den Kolben zurück', 'Die Pumpe fördert Öl auf die Stangenseite', 'Er fährt gar nicht ein', 'Das DBV öffnet und zieht ihn zurück'], correct: ok ? 0 : 1, expl: 'Beim 3/2-Ventil verbindet die Grundstellung A mit T. Die Feder presst das Öl aus dem Zylinder über das Ventil in den Tank. Es gibt nur einen Arbeitsanschluss, die Rückfahrt ist nicht hydraulisch angetrieben.' }; }
  });
  add('Schaltplan lesen', 'Eilgang erkennen', 3, {
    kind: 'choice', circ: 'C7', tips: ['Wohin fließt das Öl, wenn das 2/2-Ventil V2 offen ist?', 'Das offene 2/2-Ventil umgeht die Drossel: Der volle Pumpenstrom gelangt in den Zylinder.'],
    make: () => { const circ = circuits.C7, st = C.makeState(circ), a = C.runStep(circ, circ.ref, st, { V1: 'a', V2: 'a' }), r = C.runStep(circ, circ.ref, st, { V1: '0', V2: 'a' }), b = C.runStep(circ, circ.ref, st, { V1: 'a', V2: '0' }), ok = a.cyl.Z1.vavg > 1.5 * b.cyl.Z1.vavg; return { text: 'Fahre aus mit V1 auf a und V2 auf a, fahre danach mit V1 auf 0 und V2 auf a ein. Fahre dann nochmal mit V1 auf a und V2 auf 0 aus. Was bewirkt das 2/2-Ventil V2?', circ: 'C7', choices: ['Offen: Eilgang (Drossel wird umgangen). Gesperrt: langsamer Vorschub', 'Offen: langsamer Vorschub, gesperrt: Eilgang', 'Es verändert die Geschwindigkeit nicht', 'Es schaltet die Pumpe ab'], correct: ok ? 0 : 1, expl: 'Ist V2 offen, fließt das Öl an der Drossel vorbei (parallele Umgehung): Der Zylinder läuft mit dem vollen Förderstrom im Eilgang. Ist V2 gesperrt, begrenzt die Drossel den Volumenstrom: Vorschub. Den Rest des Pumpenstroms fördert das DBV zum Tank.' }; }
  });

  /* ---- Verschlauchen ---- */
  const wire = (title, level, circ, text, tips) => add('Verschlauchen', title, level, { kind: 'wire', tips, make: () => ({ text, circ }) });
  wire('4/2-Ventil: Zylinder aus und ein', 1, 'C1', 'Verschlauche die Anlage: Die Pumpe fördert über das 4/2-Wegeventil V1 zum doppeltwirkenden Zylinder Z1. Mit Magnet a fährt Z1 aus, in Grundstellung (Feder) fährt er ein. Das Druckbegrenzungsventil R1 sichert die Druckleitung ab. Tippe nacheinander zwei Anschlüsse an, um eine Leitung zu legen.',
    ['Beginne mit der Druckleitung von der Pumpe zum Anschluss P des Ventils. Danach folgen Tank und Arbeitsleitungen.', 'Das DBV sitzt parallel zum Ventil an der Druckleitung. Der Tankanschluss T des Ventils geht in einen Tank.']);
  wire('4/3-Ventil mit Umlauf in Mittelstellung', 2, 'C2', 'Verschlauche die Anlage mit dem 4/3-Wegeventil (Mittelstellung Umlauf). Z1 soll auf Ventilstellung a ausfahren, auf b einfahren und in der Mittelstellung stehen bleiben. Die Pumpe soll in der Mittelstellung drucklos fördern. R1 sichert die Anlage ab.',
    ['In der Mittelstellung ist P mit T verbunden: Dafür müssen P und T am Ventil richtig angeschlossen sein.', 'Der Anschluss T des Ventils muss zu einem Tank führen, sonst staut sich der Strom.']);
  wire('4/3-Ventil mit gesperrter Mittelstellung', 2, 'C3', 'Verschlauche die Anlage mit dem 4/3-Wegeventil (Mittelstellung gesperrt). Z1 soll auf Stellung a ausfahren, auf b einfahren und in der Mittelstellung festgehalten werden. In der Mittelstellung muss die Pumpe über das DBV R1 gegen den Einstelldruck fördern.',
    ['Mittelstellung gesperrt: Die Pumpe kann ihr Öl nur über das DBV loswerden.', 'Das DBV braucht Verbindung zur Druckleitung (Eingang P) und zu einem Tank (Ausgang T).']);
  wire('Einfachwirkender Zylinder mit 3/2-Ventil', 2, 'C4', 'Verschlauche die Anlage: Der einfachwirkende Zylinder Z1 fährt mit Magnet a des 3/2-Wegeventils V1 aus. Beim Loslassen wird der Zylinder entlastet und die Feder fährt ihn ein. R1 sichert die Anlage ab.',
    ['Der einfachwirkende Zylinder hat nur einen Anschluss A. Sein Öl muss beim Einfahren in den Tank zurückfließen.', 'Das 3/2-Ventil hat die Anschlüsse P, A und T.']);
  wire('Ausfahren drosseln (Drosselrückschlagventil)', 3, 'C5', 'Verschlauche die Anlage mit 4/2-Wegeventil V1 und Drosselrückschlagventil DV1: Z1 soll beim Ausfahren langsam (gedrosselt) und beim Einfahren schnell fahren. Das Drosselrückschlagventil sitzt in der Leitung zur Kolbenseite. Es lässt das Öl von 1 nach 2 frei und von 2 nach 1 nur gedrosselt durch.',
    ['Das Öl soll beim Ausfahren vom Wegeventil zum Zylinder durch die Drossel, beim Einfahren zurück frei über das Rückschlagventil.', 'Frei ist die Richtung von 1 nach 2, also muss Anschluss 1 zum Zylinder zeigen und Anschluss 2 zum Wegeventil.']);
  wire('Last halten mit entsperrbarem Rückschlagventil', 3, 'C6', 'Verschlauche den Hubzylinder Z1 (Last 12 kN) mit 4/3-Wegeventil V1 (Mittelstellung: alle Anschlüsse verbunden) und entsperrbarem Rückschlagventil RV1 in der Leitung zur Kolbenseite. Auf a wird die Last gehoben, in der Mittelstellung bleibt sie stehen, auf b wird sie abgesenkt. Das Rückschlagventil lässt das Öl von 1 nach 2 frei durch.',
    ['Das Öl soll zum Heben frei zum Zylinder fließen (1 zum Ventil, 2 zum Zylinder).', 'Zum Absenken muss das Rückschlagventil über Anschluss X Steuerdruck bekommen. Welche Leitung führt dann Druck?']);
  wire('Eilgang und Vorschub mit 2/2-Ventil', 3, 'C7', 'Verschlauche die Anlage: In der Zuleitung zur Kolbenseite sitzen parallel die Drossel DR1 und das 2/2-Wegeventil V2 (in Ruhe gesperrt). Bei offenem V2 soll Z1 im Eilgang fahren, bei gesperrtem V2 langsam im Vorschub. Dafür müssen beide Zweige zwischen dem Anschluss A des Wegeventils V1 und der Kolbenseite von Z1 liegen.',
    ['Parallel heißt: Beide Bauteile haben Anfang und Ende an denselben zwei Punkten (A des Ventils V1 und A des Zylinders).', 'An V1.A und an Z1.A kommen deshalb jeweils zwei Leitungen an.']);

  /* ---- Rechnen (Zufallswerte) ---- */
  const Ds = [32, 40, 50, 63, 80, 100], Rods = { 32: 18, 40: 22, 50: 28, 63: 36, 80: 45, 100: 56 };
  const numTask = (title, level, tips, make) => add('Rechnen', title, level, { kind: 'num', tips, make });
  const tolOf = (v, rel, abs) => Math.max(Math.abs(v) * rel, abs);
  numTask('Kolbenkraft beim Ausfahren', 1, ['F = p · A, die Fläche A in cm² aus dem Durchmesser: A = π/4 · d² / 100.', '1 bar = 10 N/cm². F = p · A · 10 in N, durch 1000 für kN.'], R => {
    const D = C.pick(R, Ds), p = C.pick(R, [40, 60, 80, 100, 120, 160, 200, 250]), A = C.areaCircle(D), F = C.force(p, A) / 1000;
    return { text: 'Ein Zylinder mit Kolbendurchmesser ' + D + ' mm arbeitet mit ' + p + ' bar. Wie groß ist die Kolbenkraft beim Ausfahren (Reibung vernachlässigt)?', unit: 'kN', value: F, tol: tolOf(F, 0.02, 0.05),
      expl: 'A = π/4 · ' + D + '² mm² = ' + f(A, 2) + ' cm². F = p · A · 10 = ' + p + ' bar · ' + f(A, 2) + ' cm² · 10 N/cm² (je bar) = ' + f(F * 1000, 0) + ' N = ' + f(F, 2) + ' kN.' };
  });
  numTask('Kraft beim Einfahren (Ringfläche)', 2, ['Beim Einfahren wirkt der Druck auf die Ringfläche A_B = A_Kolben − A_Stange.', 'F_ein = p · A_B · 10 (N), A_B in cm².'], R => {
    const D = C.pick(R, Ds), d = Rods[D], p = C.pick(R, [60, 80, 100, 120, 160, 200]), AB = C.ringArea(D, d), F = C.force(p, AB) / 1000;
    return { text: 'Zylinder mit Kolbendurchmesser ' + D + ' mm und Stangendurchmesser ' + d + ' mm, Druck ' + p + ' bar. Wie groß ist die Kraft beim Einfahren?', unit: 'kN', value: F, tol: tolOf(F, 0.02, 0.05),
      expl: 'Ringfläche A_B = π/4 · (' + D + '² − ' + d + '²) mm² = ' + f(AB, 2) + ' cm². F = p · A_B · 10 = ' + p + ' · ' + f(AB, 2) + ' · 10 = ' + f(F * 1000, 0) + ' N = ' + f(F, 2) + ' kN. Das Einfahren hat weniger Kraft als das Ausfahren (kleinere Fläche).' };
  });
  numTask('Kolbengeschwindigkeit', 2, ['v = Q / A. Mit Q in l/min und A in cm² gilt: v in m/s = Q / (6 · A).', 'A aus dem Durchmesser: A = π/4 · d² / 100 in cm².'], R => {
    const D = C.pick(R, [40, 50, 63, 80]), Q = C.pick(R, [6, 8, 10, 12, 16, 20, 25]), A = C.areaCircle(D), v = C.speedOf(Q, A);
    return { text: 'Ein Zylinder mit Kolbendurchmesser ' + D + ' mm wird mit ' + Q + ' l/min beaufschlagt. Mit welcher Geschwindigkeit fährt er aus (in m/s, drei Nachkommastellen)?', unit: 'm/s', value: v, tol: tolOf(v, 0.025, 0.0015),
      expl: 'A = ' + f(A, 2) + ' cm². v = Q / (6 · A) = ' + Q + ' / (6 · ' + f(A, 2) + ') = ' + f(v, 3) + ' m/s (das sind ' + f(v * 60, 2) + ' m/min). Herleitung: ' + Q + ' l/min = ' + Q * 1000 + ' cm³/min, geteilt durch ' + f(A, 2) + ' cm² = ' + f(Q * 1000 / A, 0) + ' cm/min.' };
  });
  numTask('Benötigter Volumenstrom', 2, ['Q = v · A. In den gewohnten Einheiten: Q in l/min = 6 · A (cm²) · v (m/s).', 'A aus dem Durchmesser in cm².'], R => {
    const D = C.pick(R, [40, 50, 63, 80, 100]), v = C.pick(R, [0.05, 0.08, 0.1, 0.15, 0.2, 0.25]), A = C.areaCircle(D), Q = C.flowOf(v, A);
    return { text: 'Ein Zylinder (Kolbendurchmesser ' + D + ' mm) soll mit ' + f(v, 2) + ' m/s ausfahren. Welchen Volumenstrom muss die Pumpe liefern?', unit: 'l/min', value: Q, tol: tolOf(Q, 0.025, 0.1),
      expl: 'A = ' + f(A, 2) + ' cm². Q = 6 · A · v = 6 · ' + f(A, 2) + ' · ' + f(v, 2) + ' = ' + f(Q, 1) + ' l/min.' };
  });
  numTask('Hydraulische Leistung', 1, ['P = p · Q / 600 mit p in bar, Q in l/min, P in kW.', 'Setze die Werte direkt ein.'], R => {
    const p = C.pick(R, [60, 80, 100, 120, 160, 200, 250]), Q = C.pick(R, [6, 8, 10, 12, 16, 20, 30]), P = C.power(p, Q);
    return { text: 'Eine Pumpe fördert ' + Q + ' l/min bei ' + p + ' bar. Welche hydraulische Leistung gibt sie an das Öl ab?', unit: 'kW', value: P, tol: tolOf(P, 0.02, 0.02),
      expl: 'P = p · Q / 600 = ' + p + ' · ' + Q + ' / 600 = ' + f(P, 2) + ' kW. (Herleitung: p·Q in bar·l/min geteilt durch 600 ergibt kW.)' };
  });
  numTask('Druck aus Kraft (Einheiten)', 2, ['Rechne die Kraft zuerst in N um: 1 kN = 1000 N.', 'p = F / (A · 10) mit A in cm², Ergebnis in bar.'], R => {
    const D = C.pick(R, [40, 50, 63, 80, 100]), F = C.pick(R, [5, 8, 10, 12, 15, 20, 25, 30]), A = C.areaCircle(D), p = C.pressureOf(F * 1000, A);
    return { text: 'Ein Zylinder mit ' + D + ' mm Kolbendurchmesser soll eine Last von ' + F + ' kN heben (Reibung vernachlässigt). Welcher Druck ist mindestens nötig?', unit: 'bar', value: p, tol: tolOf(p, 0.025, 0.4),
      expl: F + ' kN = ' + F * 1000 + ' N. A = ' + f(A, 2) + ' cm². p = F / (A · 10) = ' + F * 1000 + ' / (' + f(A, 2) + ' · 10) = ' + f(p, 1) + ' bar.' };
  });
  numTask('Einheiten umrechnen', 1, ['1 bar = 0,1 MPa = 100 000 Pa. 1 l/min = 1000 cm³ / 60 s.', 'Eine Einheit nach der anderen umrechnen.'], R => {
    const t = ri3(R);
    function ri3(Rr) { return C.ri(Rr, 0, 3); }
    if (t === 0) { const MPa = C.pick(R, [1.6, 2.5, 6.3, 10, 16, 25, 31.5]); return { text: 'Ein Druck von ' + fa(MPa) + ' MPa soll in bar angegeben werden.', unit: 'bar', value: MPa * 10, tol: 0.05, expl: '1 MPa = 10 bar, also ' + fa(MPa) + ' MPa = ' + fa(MPa * 10) + ' bar.' }; }
    if (t === 1) { const b = C.pick(R, [40, 63, 100, 160, 250, 315]); return { text: 'Ein Druck von ' + b + ' bar soll in MPa angegeben werden.', unit: 'MPa', value: b / 10, tol: 0.02, expl: '1 bar = 0,1 MPa, also ' + b + ' bar = ' + fa(b / 10) + ' MPa.' }; }
    if (t === 2) { const q = C.pick(R, [6, 12, 15, 24, 30, 60]); const v = q * 1000 / 60; return { text: 'Ein Volumenstrom von ' + q + ' l/min soll in cm³/s umgerechnet werden.', unit: 'cm³/s', value: v, tol: tolOf(v, 0.02, 0.05), expl: '1 l = 1000 cm³ und 1 min = 60 s: ' + q + ' · 1000 / 60 = ' + f(v, 1) + ' cm³/s.' }; }
    const c = C.pick(R, [50, 100, 150, 200, 250, 400]); const l = c * 60 / 1000; return { text: 'Ein Volumenstrom von ' + c + ' cm³/s soll in l/min umgerechnet werden.', unit: 'l/min', value: l, tol: tolOf(l, 0.02, 0.05), expl: c + ' cm³/s · 60 s/min = ' + c * 60 + ' cm³/min = ' + f(l, 1) + ' l/min.' };
  });
  numTask('Hydraulische Presse (Kraftübersetzung)', 3, ['Der Druck ist überall gleich: p = F1/A1 = F2/A2.', 'F2 = F1 · A2 / A1. Die Flächen verhalten sich wie die Durchmesserquadrate.'], R => {
    const d1 = C.pick(R, [20, 25, 32, 40]), d2 = C.pick(R, [80, 100, 125, 160]), F1 = C.pick(R, [0.5, 1, 1.5, 2, 2.5]), F2 = F1 * d2 * d2 / (d1 * d1);
    return { text: 'Bei einer hydraulischen Presse wirkt auf den kleinen Kolben (Durchmesser ' + d1 + ' mm) die Kraft ' + fa(F1) + ' kN. Der große Kolben hat ' + d2 + ' mm Durchmesser. Welche Kraft entsteht am großen Kolben (verlustfrei gerechnet)?', unit: 'kN', value: F2, tol: tolOf(F2, 0.02, 0.1),
      expl: 'Der Druck in der Flüssigkeit ist überall gleich. F2 = F1 · (d2/d1)² = ' + fa(F1) + ' kN · (' + d2 + '/' + d1 + ')² = ' + f(F2, 1) + ' kN. Der Weg des großen Kolbens ist dafür um denselben Faktor kleiner (Energie bleibt erhalten).' };
  });
  numTask('Antriebsleistung der Pumpe', 3, ['Zuerst P_hyd = p · Q / 600 ausrechnen.', 'Die Antriebsleistung ist größer: P_an = P_hyd / η_ges.'], R => {
    const p = C.pick(R, [100, 120, 160, 200]), Q = C.pick(R, [10, 12, 16, 20, 25]), eta = C.pick(R, [0.8, 0.85, 0.9]), Ph = C.power(p, Q), Pa = Ph / eta;
    return { text: 'Eine Pumpe fördert ' + Q + ' l/min bei ' + p + ' bar. Der Gesamtwirkungsgrad der Pumpe beträgt ' + f(eta, 2) + ' (Richtwert für Zahnrad- und Kolbenpumpen). Welche Leistung muss der Antriebsmotor abgeben?', unit: 'kW', value: Pa, tol: tolOf(Pa, 0.02, 0.03),
      expl: 'P_hyd = p · Q / 600 = ' + p + ' · ' + Q + ' / 600 = ' + f(Ph, 2) + ' kW. P_an = P_hyd / η = ' + f(Ph, 2) + ' / ' + f(eta, 2) + ' = ' + f(Pa, 2) + ' kW. Der Rest geht als Wärme verloren.' };
  });
  numTask('Förderstrom der Pumpe', 3, ['Q = V_g · n · η_v. V_g in cm³ je Umdrehung, n in 1/min.', 'cm³/min durch 1000 ergibt l/min.'], R => {
    const Vg = C.pick(R, [4, 6, 8, 11, 16]), n = C.pick(R, [1000, 1450, 1500, 2900]), ev = C.pick(R, [0.9, 0.92, 0.95]), Q = C.pumpFlow(Vg, n, ev);
    return { text: 'Eine Pumpe hat ein Verdrängungsvolumen von ' + Vg + ' cm³ je Umdrehung und läuft mit ' + n + ' 1/min. Der volumetrische Wirkungsgrad beträgt ' + f(ev, 2) + '. Welchen Förderstrom liefert sie?', unit: 'l/min', value: Q, tol: tolOf(Q, 0.02, 0.1),
      expl: 'Q = V_g · n · η_v = ' + Vg + ' cm³ · ' + n + ' 1/min · ' + f(ev, 2) + ' = ' + f(Vg * n * ev, 0) + ' cm³/min = ' + f(Q, 1) + ' l/min.' };
  });

  /* ---- Neue Aufgaben hyd36 bis hyd45 (Industriemechaniker: Steuerungstechnik Hydraulik); hinten angehängt, Nummern der bisherigen bleiben. PRUEFEN Pn: quelle/hyd/PRUEFEN.md ---- */
  choiceTask('Bauteile und Anschlüsse', 'Aufgaben des Hydrauliköls', 1, 'Hydrauliköl überträgt in einer Anlage die Energie von der Pumpe zum Zylinder. Welche weitere Aufgabe hat es?',
    ['Es schmiert bewegte Teile und führt Wärme ab', 'Es lässt sich stark zusammendrücken und dämpft dadurch Stöße von selbst', 'Es ersetzt den Filter, weil es Schmutz fest an sich bindet', 'Es erhöht den Druck, indem es in der Anlage teilweise verdampft'], 0,
    'Neben der Energieübertragung schmiert das Öl die bewegten Teile in Pumpe, Ventilen und Zylindern, führt Wärme zum Tank ab, schützt vor Korrosion und transportiert Schmutz zum Filter. Hydrauliköl ist fast nicht zusammendrückbar und soll nicht verdampfen.',
    ['Hydrauliköl hat nicht nur mit Druck zu tun, es kommt auch mit vielen bewegten Teilen in Berührung.', 'Die falschen Antworten behaupten Eigenschaften, die Hydrauliköl gerade nicht haben soll.']);
  choiceTask('Bauteile und Anschlüsse', 'Öl wird heiß', 2, 'Das Öl einer Hydraulikanlage wird im Betrieb dauerhaft deutlich heißer als üblich (weit über 60 °C). Welche Folgen hat das?',
    ['Das Öl wird dünnflüssiger, der Schmierfilm dünner, es gibt mehr Leckage und schnellere Alterung', 'Das Öl wird dickflüssiger und die Pumpe kann es schlechter ansaugen, die Anlage läuft zäh', 'Es ergeben sich keine Folgen, denn Hydrauliköl verträgt jede Temperatur gleich gut', 'Der Druck in der Anlage sinkt auf null, weil sich das Öl stark ausdehnt und entweicht'], 0,
    'Mit steigender Temperatur sinkt die Viskosität: Das Öl wird dünnflüssig. Der Schmierfilm reißt eher ab, die innere Leckage in Pumpe und Ventilen nimmt zu und das Öl oxidiert schneller. Zu kaltes Öl ist dagegen zu zähflüssig und lässt sich schlecht ansaugen. Die Anlage soll deshalb in einem passenden Temperaturbereich arbeiten (nötigenfalls mit Kühler).',
    ['Denke an Honig: Wie verändert sich seine Zähigkeit, wenn er warm wird?', 'Dünnflüssiges Öl schmiert schlechter und fließt leichter durch Spalte.']);
  choiceTask('Bauteile und Anschlüsse', 'Viskositätsklasse auf dem Fass', 2, 'Auf dem Fass mit Hydrauliköl steht „HLP 46“. Was bedeutet die Zahl 46?',
    ['Die ISO-Viskositätsklasse: Die Viskosität beträgt etwa 46 mm²/s bei 40 °C', 'Der höchste zulässige Betriebsdruck von 46 bar für alle Bauteile der Anlage', 'Die höchste zulässige Betriebstemperatur von 46 °C im Ölbehälter der Anlage', 'Der Anteil an Wirkstoffen im Öl, der 46 Prozent des Volumens ausmacht'], 0,
    'HLP steht für ein Mineralöl mit Wirkstoffen gegen Verschleiß, Korrosion und Alterung. Die Zahl ist die ISO-Viskositätsklasse (ISO VG): Die kinematische Viskosität liegt bei 40 °C bei etwa 46 mm²/s. Die Klasse wird nach Herstellerangabe für Pumpe und Betriebstemperatur gewählt und darf nicht beliebig getauscht werden.',
    ['Die Zahl beschreibt eine Eigenschaft des Öls selbst, keine Anlagendaten.', 'Es geht um die Zähigkeit (Viskosität) bei 40 °C.']);
  choiceTask('Schaltplan lesen', 'Wohin fließt das Öl?', 2, 'Eine Konstantpumpe fördert 12 l/min. Der Zylinder ist ganz ausgefahren und steht am Anschlag, das Wegeventil bleibt weiter betätigt. Das Druckbegrenzungsventil ist auf 100 bar eingestellt. Was geschieht mit dem Förderstrom der Pumpe?',
    ['Er fließt fast ganz über das Druckbegrenzungsventil mit 100 bar zum Tank und erwärmt das Öl', 'Er hört auf, weil die Pumpe bei stehendem Zylinder keinen Förderstrom mehr liefert', 'Er fließt zusätzlich in den Zylinder, der dadurch noch ein Stück weiter ausfährt', 'Er fließt drucklos zum Tank zurück, weil das Ventil schon bei 0 bar öffnet'], 0,
    'Die Konstantpumpe fördert weiter. Der Zylinder nimmt kein Öl mehr auf, der Druck steigt bis zum Einstelldruck. Dann öffnet das Druckbegrenzungsventil und leitet fast den ganzen Förderstrom bei 100 bar zum Tank. Die Leistung (100 bar · 12 l/min) wird dabei in Wärme umgesetzt. Deshalb soll man Zylinder nicht lange am Anschlag mit Druck belassen.',
    ['Eine Konstantpumpe fördert immer dasselbe Volumen, auch wenn der Zylinder nichts aufnimmt.', 'Der Druck steigt, bis das Druckbegrenzungsventil öffnet. Wohin geht das Öl dann?']);
  choiceTask('Schaltplan lesen', 'Drossel oder Stromventil?', 3, 'Ein Zylinder soll auch bei schwankender Last mit gleichbleibender Geschwindigkeit fahren. Bei einer einfachen Drossel ändert sich die Geschwindigkeit mit der Last. Welches Bauteil hält den Volumenstrom unabhängig vom Lastdruck konstant?',
    ['Ein Stromregelventil mit Druckwaage', 'Eine größere Drossel mit anderer Einstellung', 'Ein Rückschlagventil in der Zuleitung', 'Ein Druckbegrenzungsventil an der Pumpe'], 0,
    'Der Volumenstrom durch eine einfache Drossel hängt vom Druckunterschied an der Drossel ab. Ändert sich die Last, ändert sich dieser Unterschied und damit die Geschwindigkeit. Ein Stromregelventil enthält zusätzlich eine Druckwaage, die den Druckunterschied an der Drossel konstant hält. Dadurch bleibt der Volumenstrom und damit die Geschwindigkeit gleich.',
    ['Es muss etwas hinzukommen, das auf Druckänderungen reagiert.', 'Die Druckwaage gleicht Schwankungen des Lastdrucks aus.']);
  choiceTask('Schaltplan lesen', 'Eilgang durch Differentialschaltung', 3, 'In einer Differentialschaltung liegt beim Ausfahren auch die Stangenseite des Zylinders an der Pumpe, das Öl von der Stangenseite fließt zur Kolbenseite. Wie ändern sich Geschwindigkeit und Kraft gegenüber der normalen Schaltung?',
    ['Der Zylinder fährt schneller aus, bringt aber weniger Kraft auf', 'Der Zylinder fährt langsamer aus und bringt mehr Kraft auf', 'Geschwindigkeit und Kraft bleiben gleich, nur die Pumpe läuft ruhiger', 'Der Zylinder fährt schneller aus und bringt zugleich mehr Kraft auf'], 0,
    'Bei der Differentialschaltung wirkt der Druck auf beiden Seiten des Kolbens. Als Kraft bleibt nur der Unterschied der Flächen, das ist die Stangenfläche. Die Kraft ist deshalb kleiner. Die Pumpe muss nur das Volumen der Stange ausgleichen, deshalb fährt der Zylinder bei gleichem Förderstrom schneller aus (Eilgang).',
    ['Auf beiden Kolbenseiten steht Druck. Welche Fläche bleibt übrig, die eine Kraft nach außen erzeugt?', 'Das Öl der Stangenseite wird mitgenutzt. Dadurch braucht der Zylinder weniger Öl von der Pumpe.']);
  numTask('Differentialschaltung: Geschwindigkeit', 3, ['Bei der Differentialschaltung bestimmt die Stangenfläche die Geschwindigkeit: v = Q / A_Stange.', 'A_Stange = π/4 · d² in cm². Dann v in m/s = Q / (6 · A).'], R => {
    const D = C.pick(R, [50, 63, 80, 100]), d = Rods[D], Q = C.pick(R, [8, 10, 12, 16, 20]), As = C.areaCircle(d), v = C.speedOf(Q, As);
    return { text: 'Ein Zylinder mit Kolbendurchmesser ' + D + ' mm und Stangendurchmesser ' + d + ' mm ist in Differentialschaltung angeschlossen (beim Ausfahren liegt Druck auf beiden Kolbenseiten). Die Pumpe liefert ' + Q + ' l/min. Mit welcher Geschwindigkeit fährt der Zylinder aus (in m/s, drei Nachkommastellen)?', unit: 'm/s', value: v, tol: tolOf(v, 0.025, 0.002),
      expl: 'Beim Ausfahren in Differentialschaltung muss die Pumpe nur das Volumen der Stange nachliefern. Es gilt v = Q / A_Stange. A_Stange = π/4 · ' + d + '² mm² = ' + f(As, 2) + ' cm². v = Q / (6 · A) = ' + Q + ' / (6 · ' + f(As, 2) + ') = ' + f(v, 3) + ' m/s. In der normalen Schaltung mit der Kolbenfläche wäre der Zylinder deutlich langsamer.' };
  });
  numTask('Nutzbares Speichervolumen', 3, ['Das Gas im Speicher wird zusammengedrückt: Es gilt p · V = konstant (isotherm). Das Gasvolumen bei Druck p ist V = V0 · p0 / p.', 'Das abgegebene Öl ist der Unterschied der Gasvolumen bei p1 und bei p2.'], R => {
    const V0 = C.pick(R, [4, 10, 20]), p0 = C.pick(R, [60, 80, 100]), p1 = p0 + C.pick(R, [40, 60]), p2 = C.pick(R, [200, 250, 300]), dV = V0 * p0 * (1 / p1 - 1 / p2);
    return { text: 'Ein Blasenspeicher hat ein Gasvolumen von ' + V0 + ' l bei einem Gasvorfülldruck von ' + p0 + ' bar. Die Anlage arbeitet zwischen ' + p1 + ' bar (Mindestdruck) und ' + p2 + ' bar (Höchstdruck). Wie viel Öl kann der Speicher zwischen diesen beiden Drücken abgeben? Rechne vereinfacht isotherm (p · V = konstant) mit den angegebenen Drücken, ohne den Umgebungsdruck.', unit: 'l', value: dV, tol: tolOf(dV, 0.02, 0.02),
      expl: 'Gasvolumen bei ' + p1 + ' bar: V1 = V0 · p0 / p1 = ' + V0 + ' · ' + p0 + ' / ' + p1 + ' = ' + f(V0 * p0 / p1, 2) + ' l. Bei ' + p2 + ' bar: V2 = ' + V0 + ' · ' + p0 + ' / ' + p2 + ' = ' + f(V0 * p0 / p2, 2) + ' l. Zwischen beiden Drücken gibt der Speicher ΔV = V1 − V2 = ' + f(dV, 2) + ' l Öl ab. Das nutzbare Volumen ist deutlich kleiner als die Speichergröße.' };
  });
  choiceTask('Bauteile und Anschlüsse', 'Filter in der Saugleitung', 3, 'In der Saugleitung einer Pumpe sitzt nur ein grobes Sieb und kein Feinfilter. Welchen Grund hat das?',
    ['Ein Feinfilter würde den Ansaugwiderstand erhöhen, die Pumpe könnte Luft oder Dampfblasen ziehen und kavitieren', 'Ein Feinfilter würde das Öl auf dem Weg zur Pumpe zu stark erwärmen', 'Die Pumpe saugt immer nur sauberes Öl aus dem Tank an, ein Sieb ist eigentlich überflüssig', 'Feine Filter halten dem Unterdruck der Saugleitung grundsätzlich nicht stand und werden zerstört'], 0,
    'Die Pumpe saugt das Öl mit geringem Unterdruck an. Ein feiner Filter verstopft schneller und hat einen höheren Widerstand. Dann könnten Luft und Dampfblasen entstehen (Kavitation) und die Pumpe nehmen Schaden. Deshalb sitzt in der Saugleitung nur ein grobes Sieb. Feine Filter stehen im Druck- oder Rücklauf, wo kein Unterdruck herrscht.',
    ['Überlege, wie die Pumpe das Öl ansaugt: Es gibt keine Kraft, die das Öl in die Pumpe drückt, außer dem Luftdruck im Tank.', 'Ein feiner Filter setzt dem Öl mehr Widerstand entgegen.']);
  numTask('Gesamtwirkungsgrad der Anlage', 3, ['Die Nutzleistung ist die Leistung am Zylinder: P = F · v. Setze F in N und v in m/s ein, dann kommt W heraus.', 'η = P_nutz / P_zu, mit beiden Leistungen in der gleichen Einheit. Mal 100 ergibt Prozent.'], R => {
    const F = C.pick(R, [10000, 15000, 20000, 30000]), v = C.pick(R, [0.05, 0.08, 0.1, 0.12]), eta = C.pick(R, [0.55, 0.6, 0.65, 0.7]), Pn = F * v / 1000, Pz = Math.round(Pn / eta * 10) / 10, e = Pn / Pz * 100;
    return { text: 'Ein Hydraulikzylinder hebt eine Last mit F = ' + f(F, 0) + ' N und fährt dabei mit v = ' + f(v, 2) + ' m/s. Der Antriebsmotor der Pumpe nimmt dabei ' + f(Pz, 1) + ' kW elektrische Leistung auf. Wie groß ist der Gesamtwirkungsgrad der Anlage (Nutzleistung am Zylinder bezogen auf die aufgenommene Leistung)? Angabe in Prozent.', unit: '%', value: e, tol: tolOf(e, 0.02, 0.5),
      expl: 'Nutzleistung: P_nutz = F · v = ' + f(F, 0) + ' N · ' + f(v, 2) + ' m/s = ' + f(F * v, 0) + ' W = ' + f(Pn, 2) + ' kW. Gesamtwirkungsgrad: η = P_nutz / P_zu = ' + f(Pn, 2) + ' kW / ' + f(Pz, 1) + ' kW = ' + f(e / 100, 3) + ', das sind ' + f(e, 1) + ' %. Der Rest geht als Wärme in Motor, Pumpe, Ventilen und Leitungen verloren.' };
  });

  /* ================================================================ Zufalls-Trainer */
  const symKeys = symbols.map(s => s.k);
  const cleanName = n => n.replace(/, Mittelstellung.*$/, '');
  function trainerSymbol(R) {
    const pool = symbols.filter(s => ['pump', 'motor', 'tank', 'filter', 'dbv', 'cyl', 'cyle', 'v42', 'v32', 'v22', 'rv', 'rve', 'drossel', 'drv', 'mano'].indexOf(s.k) >= 0);
    const s = C.pick(R, pool), others = C.shuffle(R, pool.filter(x => x.k !== s.k && x.name.split(' ')[0] !== s.name.split(' ')[0])).slice(0, 3), all = C.shuffle(R, [s].concat(others));
    return { kind: 'choice', cat: 'Symbole', text: 'Welches Bauteil zeigt das Schaltzeichen?', sym: [s.k], choices: all.map(x => cleanName(x.name)), correct: all.indexOf(s), expl: s.name + ': ' + s.text.replace(/ \/\* PRUEFEN \*\/.*$/, '') };
  }
  function trainerPort(R) {
    const qs = [
      ['Welche Anschlussbezeichnung hat der Tankanschluss eines Wegeventils?', ['T', 'P', 'A', 'X'], 0, 'T = Tank (Rücklauf).'],
      ['Welcher Anschluss eines Wegeventils führt zur Pumpe?', ['P', 'T', 'B', 'X'], 0, 'P = Druckanschluss (Pumpe).'],
      ['Wie heißt ein Wegeventil mit 4 Anschlüssen und 2 Schaltstellungen?', ['4/2-Wegeventil', '2/4-Wegeventil', '4/3-Wegeventil', '3/2-Wegeventil'], 0, 'Erst die Zahl der Anschlüsse, dann die der Schaltstellungen.'],
      ['Wie heißt ein Wegeventil mit 3 Anschlüssen und 2 Schaltstellungen?', ['3/2-Wegeventil', '2/3-Wegeventil', '3/3-Wegeventil', '4/2-Wegeventil'], 0, 'Anschlüsse P, A, T und zwei Stellungen = 3/2.'],
      ['Mit welchem Anschluss fährt ein doppeltwirkender Zylinder aus (Kolbenseite)?', ['A (Kolbenseite)', 'B (Stangenseite)', 'T', 'X'], 0, 'Der Druck auf die Kolbenseite A schiebt die Stange nach außen.'],
      ['Was begrenzt der Druckbegrenzungsventil?', ['Den Systemdruck', 'Den Volumenstrom', 'Die Temperatur', 'Die Drehzahl des Motors'], 0, 'Beim Einstelldruck öffnet das DBV und leitet den Förderstrom zum Tank.'],
      ['Was bewirkt eine Drossel im Hydraulikkreis?', ['Sie begrenzt den Volumenstrom und damit die Geschwindigkeit', 'Sie begrenzt den Systemdruck', 'Sie hält die Last fest', 'Sie filtert das Öl'], 0, 'Die Drossel verengt den Querschnitt: weniger Volumenstrom, kleinere Geschwindigkeit.'],
      ['Wann ist Hydrauliköl nahezu inkompressibel?', ['Immer in guter Näherung (im Gegensatz zu Luft)', 'Nur bei hohen Temperaturen', 'Nur unter 10 bar', 'Nie'], 0, 'Flüssigkeiten lassen sich kaum zusammendrücken: Der Zylinder folgt dem Ölstrom unmittelbar, anders als bei Pneumatik.']
    ];
    const q = C.pick(R, qs), order = C.shuffle(R, [0, 1, 2, 3]);
    return { kind: 'choice', cat: 'Bauteile und Anschlüsse', text: q[0], choices: order.map(i => q[1][i]), correct: order.indexOf(q[2]), expl: q[3] };
  }
  function trainerCalc(R) {
    const idx = C.ri(R, 0, 8), calcTasks = tasks.filter(t => t.cat === 'Rechnen'), t = calcTasks[idx % calcTasks.length], inst = t.make(R);
    return Object.assign({ kind: 'num', cat: 'Rechnen', title: t.title }, inst);
  }
  function trainerQuestion(R, kind) {
    const k = kind === 'mixed' ? C.pick(R, ['sym', 'port', 'calc', 'calc']) : kind;
    return k === 'sym' ? trainerSymbol(R) : k === 'port' ? trainerPort(R) : trainerCalc(R);
  }

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp): alle fertigen Schaltungen aus "Schaltpläne" mit den ersten zwei Sätzen ihrer Erklärung. */
  const sentences = (s, n) => (String(s).match(/[^.!?]+[.!?]+(?:\s|$)/g) || [String(s)]).slice(0, n).join('').trim();
  const beispiele = circuitList.map(id => ({ id, cir: id, titel: circuits[id].title, text: sentences(circuits[id].info, 2) }));
  root.HYD_DATA = { beispiele, symbols, circuits, circuitList, tasks, cats, trainerQuestion, simFlow };
  root.HYD_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.HYD_DATA, TASKS: root.HYD_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
