'use strict';
/* Tonfunk Bauteil-Bauformen (bauviz.js): reale Baugrößen als Fotoersatz-Zeichnung (inline-SVG, ohne Bibliotheken).
   window.BAUVIZ = { TEILE, GRUPPEN, WIKI, vergleich, einzel, tabelleHtml, wikiHtml, ringe, wertOhm, wertSI, belastung, balkenHtml, teilFuer, kartenHtml, css }.
   Alle Zeichenfunktionen liefern SVG-Text (oder '' bei unbekannter Eingabe), nie NaN im Markup. Maße in Millimetern, übliche Richtwerte (je nach Hersteller etwas anders).
   Farben: Text, Maßlinien und Rahmen nur über die CSS-Variablen der Seite; die Bauteilfarben (Lack, Gehäuse, Farbringe) sind feste Farbcodes wie in echt.
   Keine Animation, keine Hover-Abhängigkeit. Nur Darstellung: keine Physik, keine Aufgabenlösungen. Quelle der Maße und offene Fragen: quelle/schaltplan/PRUEFEN_bauteile.md */
(function (root) {
  const fin = x => typeof x === 'number' && isFinite(x);
  const q = x => (fin(x) ? Math.round(x * 10) / 10 : 0);
  const pos = x => (fin(x) && x > 0 ? x : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de = x => (fin(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '–');

  /* ---------- Farbcodes ---------- */
  const FARBE = { schwarz: '#15161a', braun: '#7a4a1d', rot: '#d6342a', orange: '#f08a1c', gelb: '#f2d21b', gruen: '#2f9e48', blau: '#2f6fd6', violett: '#8a3fb3', grau: '#8d9199', weiss: '#f4f4f4', gold: '#d4af37', silber: '#c3c7cd' };
  const FNAME = { schwarz: 'schwarz', braun: 'braun', rot: 'rot', orange: 'orange', gelb: 'gelb', gruen: 'grün', blau: 'blau', violett: 'violett', grau: 'grau', weiss: 'weiß', gold: 'gold', silber: 'silber' };
  const ZIFFER = ['schwarz', 'braun', 'rot', 'orange', 'gelb', 'gruen', 'blau', 'violett', 'grau', 'weiss'];
  const LEDFARBE = { rot: '#e5392f', 'grün': '#2fa84f', gelb: '#f2c81b', blau: '#2f6fe0', 'weiß': '#eeeeee', orange: '#f08a1c' };

  /* Widerstandswert (z. B. 4k7, 4.7k, 330, 1M, 4R7) in Ohm; NaN bei Unsinn */
  function wertOhm(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/Ω|ohm/gi, '').replace(',', '.');
    let m = s.match(/^(\d+)([kKMGRr])(\d*)$/);
    if (m) return parseFloat(m[1] + '.' + (m[3] || '0')) * { k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 }[m[2]];
    m = s.match(/^(\d*\.?\d+)([kKMG]?)$/);
    if (m) return parseFloat(m[1]) * ({ '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }[m[2]]);
    return NaN;
  }
  /* Kapazität (100n, 4u7, 22p, 1m) in Farad; NaN bei Unsinn */
  function wertSI(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/F$/i, '').replace(',', '.').replace('µ', 'u');
    const U = { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, '': 1 };
    let m = s.match(/^(\d+)([pnum])(\d*)$/);
    if (m) return parseFloat(m[1] + '.' + (m[3] || '0')) * U[m[2]];
    m = s.match(/^(\d*\.?\d+)([pnum]?)$/);
    return m ? parseFloat(m[1]) * U[m[2]] : NaN;
  }
  const MULT = { '-2': 'silber', '-1': 'gold', 0: 'schwarz', 1: 'braun', 2: 'rot', 3: 'orange', 4: 'gelb', 5: 'gruen', 6: 'blau', 7: 'violett', 8: 'grau', 9: 'weiss' };
  /* Farbringe zu einem Widerstandswert: 4 Ringe (5 %) bei zwei, 5 Ringe (1 %) bei drei gültigen Ziffern; null bei ungültigem Wert */
  function ringe(wert) {
    const v = wertOhm(wert);
    if (!fin(v) || v < 0.1 || v >= 1e11) return null;
    let e = Math.floor(Math.log10(v) + 1e-9), m3 = Math.round(v / Math.pow(10, e - 2));
    if (m3 >= 1000) { m3 = 100; e += 1; }
    const five = m3 % 10 !== 0, dig = String(five ? m3 : m3 / 10), mx = five ? e - 2 : e - 1;
    if (!MULT[String(mx)]) return null;
    const r = dig.split('').map(d => ZIFFER[+d]); r.push(MULT[String(mx)]); r.push(five ? 'braun' : 'gold');
    return { ringe: r, tol: five ? '1 %' : '5 %', text: r.map(c => FNAME[c]).join(' – ') };
  }

  /* ---------- Bauformen-Tabelle (Maße in mm, Richtwerte) ---------- */
  const T = {};
  const add = (id, o) => { T[id] = Object.assign({ id }, o); };
  /* Widerstände bedrahtet: l = Körperlänge, dm = Körper-Ø, dr = Draht-Ø; w = übliche Nennleistung */
  add('r025', { form: 'axial', art: 'res', kurz: '0,25 W', typ: 'Widerstand 0,25 W', l: 6.3, dm: 2.5, dr: 0.55, w: 0.25, kl: 'tan', info: 'Standardtyp für Lochraster und Platine' });
  add('r05', { form: 'axial', art: 'res', kurz: '0,5 W', typ: 'Widerstand 0,5 W', l: 9, dm: 3.6, dr: 0.6, w: 0.5, kl: 'tan', info: 'etwas größer, liegt oft flach auf der Platine' });
  add('r1', { form: 'axial', art: 'res', kurz: '1 W', typ: 'Widerstand 1 W', l: 11, dm: 4, dr: 0.8, w: 1, kl: 'blu', info: 'dickerer Draht, wird spürbar warm' });
  add('r2', { form: 'axial', art: 'res', kurz: '2 W', typ: 'Widerstand 2 W', l: 15, dm: 5, dr: 0.8, w: 2, kl: 'blu', info: 'wird mit Abstand zur Platine eingebaut' });
  /* SMD-Widerstände (Draufsicht): l × b × h */
  add('r0603', { form: 'smd', art: 'res', kurz: '0603', typ: 'SMD-Widerstand 0603', l: 1.6, b: 0.8, h: 0.45, w: 0.1, info: 'ca. 0,1 W' });
  add('r0805', { form: 'smd', art: 'res', kurz: '0805', typ: 'SMD-Widerstand 0805', l: 2, b: 1.25, h: 0.5, w: 0.125, info: 'ca. 0,125 W' });
  add('r1206', { form: 'smd', art: 'res', kurz: '1206', typ: 'SMD-Widerstand 1206', l: 3.2, b: 1.6, h: 0.55, w: 0.25, info: 'ca. 0,25 W' });
  add('r2512', { form: 'smd', art: 'res', kurz: '2512', typ: 'SMD-Widerstand 2512', l: 6.3, b: 3.2, h: 0.6, w: 1, info: 'ca. 1 W' });
  /* Kondensatoren (Seitenansicht, Beine unten) */
  add('c-disc', { form: 'disc', kurz: 'Keramik', typ: 'Keramik-Scheibenkondensator', b: 5, h: 6.5, ra: 5, dr: 0.5, info: 'kleine Kapazitäten, nicht gepolt' });
  add('c-mlcc', { form: 'mlcc', kurz: 'Vielschicht', typ: 'Keramik-Vielschichtkondensator (radial)', b: 5, h: 5.5, t: 2.5, ra: 2.54, dr: 0.5, info: 'klein, nicht gepolt, 2,54-mm-Raster' });
  add('c-folie', { form: 'folie', kurz: 'Folie', typ: 'Folienkondensator (Rechteckbauform)', b: 7.2, h: 6.5, t: 2.5, ra: 5, dr: 0.5, info: 'stabil, nicht gepolt' });
  add('el5', { form: 'elko', kurz: 'Elko 5 × 11', typ: 'Elko radial Ø 5 × 11 mm', dm: 5, h: 11, ra: 2, dr: 0.5, info: 'gepolt: Minus-Streifen beachten' });
  add('el63', { form: 'elko', kurz: 'Elko 6,3 × 11', typ: 'Elko radial Ø 6,3 × 11 mm', dm: 6.3, h: 11, ra: 2.5, dr: 0.5, info: 'gepolt' });
  add('el8', { form: 'elko', kurz: 'Elko 8 × 12', typ: 'Elko radial Ø 8 × 12 mm', dm: 8, h: 12, ra: 3.5, dr: 0.6, info: 'gepolt' });
  add('el10', { form: 'elko', kurz: 'Elko 10 × 16', typ: 'Elko radial Ø 10 × 16 mm', dm: 10, h: 16, ra: 5, dr: 0.6, info: 'gepolt' });
  add('el16', { form: 'elko', kurz: 'Elko 16 × 25', typ: 'Elko radial Ø 16 × 25 mm', dm: 16, h: 25, ra: 7.5, dr: 0.8, info: 'gepolt, für große Kapazitäten' });
  /* Dioden bedrahtet (axial): Band = Kathode */
  add('d4148', { form: 'axial', art: 'diode', kurz: 'Signal', typ: 'Signaldiode (DO-35, Glas)', l: 4, dm: 1.9, dr: 0.55, kl: 'glass', band: 'schwarz', info: 'klein und schnell, wenige 100 mA' });
  add('z05', { form: 'axial', art: 'diode', kurz: 'Z-Diode 0,5 W', typ: 'Z-Diode 0,5 W (DO-35, Glas)', l: 4, dm: 1.9, dr: 0.55, kl: 'zglass', band: 'schwarz', info: 'gleiche Bauform wie die Signaldiode' });
  add('d4007', { form: 'axial', art: 'diode', kurz: 'Gleichr. 1 A', typ: 'Gleichrichterdiode 1 A (DO-41, Kunststoff)', l: 5, dm: 2.7, dr: 0.8, kl: 'blk', band: 'silber', info: 'für Netzteile, höhere Sperrspannung' });
  add('z1', { form: 'axial', art: 'diode', kurz: 'Z-Diode 1 W', typ: 'Z-Diode 1 W (DO-41, Kunststoff)', l: 5, dm: 2.7, dr: 0.8, kl: 'blk', band: 'silber', info: 'verträgt mehr Verlustleistung' });
  add('d5408', { form: 'axial', art: 'diode', kurz: 'Gleichr. 3 A', typ: 'Gleichrichterdiode 3 A (DO-201, Kunststoff)', l: 9, dm: 5, dr: 1.3, kl: 'blk', band: 'silber', info: 'dicker Draht für große Ströme' });
  /* LEDs */
  add('led3', { form: 'led', kurz: '3 mm', typ: 'LED 3 mm (bedrahtet)', dm: 3, fl: 3.8, h: 5, ra: 2.54, dr: 0.5, info: 'langes Bein = Anode' });
  add('led5', { form: 'led', kurz: '5 mm', typ: 'LED 5 mm (bedrahtet)', dm: 5, fl: 5.8, h: 8.6, ra: 2.54, dr: 0.5, info: 'häufigste Bauform; langes Bein = Anode' });
  add('led10', { form: 'led', kurz: '10 mm', typ: 'LED 10 mm (bedrahtet)', dm: 10, fl: 11, h: 13, ra: 2.54, dr: 0.6, info: 'große Signalleuchte' });
  add('ledp', { form: 'smdled', kurz: 'SMD 3528', typ: 'SMD-LED 3528 (PLCC-2)', l: 3.5, b: 2.8, h: 1.9, info: 'Draufsicht' });
  add('led06', { form: 'smdled', kurz: 'SMD 0603', typ: 'SMD-LED 0603', l: 1.6, b: 0.8, h: 0.6, info: 'Draufsicht' });
  /* Transistoren und andere Halbleiter-Gehäuse */
  add('to92', { form: 'to92', kurz: 'TO-92', typ: 'Gehäuse TO-92', b: 4.5, h: 4.5, ra: 2.54, dr: 0.5, info: 'Kleinsignal, Ansicht von vorn' });
  add('to220', { form: 'to220', kurz: 'TO-220', typ: 'Gehäuse TO-220', b: 10, h: 15.4, t: 4.5, tab: 6.4, ra: 2.54, dr: 0.8, info: 'Leistung, Kühlfahne mit Loch, Ansicht von vorn' });
  add('sot23', { form: 'sot23', kurz: 'SOT-23', typ: 'Gehäuse SOT-23', l: 2.9, b: 2.4, h: 1, info: 'SMD, Draufsicht' });
  add('sot223', { form: 'sot223', kurz: 'SOT-223', typ: 'Gehäuse SOT-223', l: 6.5, b: 7, h: 1.7, info: 'SMD mit Kühlfahne, Draufsicht' });
  /* Sicherungen (axial, ohne Draht) */
  add('f5', { form: 'fuse', kurz: '5 × 20 mm', typ: 'Feinsicherung 5 × 20 mm (Glasrohr)', l: 20, dm: 5, info: 'im Sicherungshalter' });
  add('f63', { form: 'fuse', kurz: '6,3 × 32 mm', typ: 'Feinsicherung 6,3 × 32 mm (Glasrohr)', l: 32, dm: 6.3, info: 'im Sicherungshalter' });
  add('fsmd', { form: 'fuse', kurz: 'SMD 1206', typ: 'SMD-Sicherung 1206', l: 3.2, dm: 1.6, info: 'Draufsicht' });
  /* Hutschienen-Geräte (Ansicht von vorn): 1 TE = 17,5 mm */
  add('lss1', { form: 'rail', kurz: '1-polig', typ: 'Leitungsschutzschalter 1-polig', b: 17.5, h: 90, te: 1, info: '1 Teilungseinheit (TE)' });
  add('lss2', { form: 'rail', kurz: '2-polig', typ: 'Leitungsschutzschalter 2-polig', b: 35, h: 90, te: 2, info: '2 TE' });
  add('lss3', { form: 'rail', kurz: '3-polig', typ: 'Leitungsschutzschalter 3-polig', b: 52.5, h: 90, te: 3, info: '3 TE' });
  add('fi2', { form: 'rail', kurz: 'FI 2-polig', typ: 'FI-Schutzschalter 2-polig', b: 35, h: 90, te: 2, fi: true, info: '2 TE, mit Prüftaste' });
  add('fi4', { form: 'rail', kurz: 'FI 4-polig', typ: 'FI-Schutzschalter 4-polig', b: 70, h: 90, te: 4, fi: true, info: '4 TE, mit Prüftaste' });
  /* Relais, Trafo, Poti, ICs */
  add('rly', { form: 'relay', kurz: 'Printrelais', typ: 'Printrelais (1 Wechsler)', b: 19, h: 15.3, t: 15.5, info: 'Spule und Kontakt in einem Würfel' });
  add('ei30', { form: 'ei', kurz: 'EI 30', typ: 'Trafo-Kern EI 30', b: 30, h: 25, info: 'Kernbreite 30 mm' });
  add('ei38', { form: 'ei', kurz: 'EI 38', typ: 'Trafo-Kern EI 38', b: 38, h: 31.7, info: 'Kernbreite 38 mm' });
  add('ei48', { form: 'ei', kurz: 'EI 48', typ: 'Trafo-Kern EI 48', b: 48, h: 40, info: 'Kernbreite 48 mm' });
  add('ei66', { form: 'ei', kurz: 'EI 66', typ: 'Trafo-Kern EI 66', b: 66, h: 55, info: 'Kernbreite 66 mm' });
  add('po9', { form: 'poti', kurz: 'Ø 9 mm', typ: 'Drehpoti 9 mm', dm: 9, ach: 6, info: 'klein, Draufsicht' });
  add('po16', { form: 'poti', kurz: 'Ø 16 mm', typ: 'Drehpoti 16 mm', dm: 16, ach: 6, info: 'häufige Größe, Draufsicht' });
  add('po24', { form: 'poti', kurz: 'Ø 24 mm', typ: 'Drehpoti 24 mm', dm: 24, ach: 6, info: 'große Ausführung, Draufsicht' });
  add('dip8', { form: 'ic', pk: 'dip', kurz: 'DIP-8', typ: 'IC DIP-8', n: 8, l: 9.3, bw: 6.35, span: 8.1, rs: 7.62, pitch: 2.54, info: 'durchsteckbar, Draufsicht' });
  add('dip14', { form: 'ic', pk: 'dip', kurz: 'DIP-14', typ: 'IC DIP-14', n: 14, l: 19.2, bw: 6.35, span: 8.1, rs: 7.62, pitch: 2.54, info: 'durchsteckbar, Draufsicht' });
  add('dip16', { form: 'ic', pk: 'dip', kurz: 'DIP-16', typ: 'IC DIP-16', n: 16, l: 19.3, bw: 6.35, span: 8.1, rs: 7.62, pitch: 2.54, info: 'durchsteckbar, Draufsicht' });
  add('soic8', { form: 'ic', pk: 'soic', kurz: 'SOIC-8', typ: 'IC SOIC-8', n: 8, l: 4.9, bw: 3.9, span: 6, pitch: 1.27, info: 'SMD, Draufsicht' });
  add('soic14', { form: 'ic', pk: 'soic', kurz: 'SOIC-14', typ: 'IC SOIC-14', n: 14, l: 8.65, bw: 3.9, span: 6, pitch: 1.27, info: 'SMD, Draufsicht' });
  add('soic16', { form: 'ic', pk: 'soic', kurz: 'SOIC-16', typ: 'IC SOIC-16', n: 16, l: 9.9, bw: 3.9, span: 6, pitch: 1.27, info: 'SMD, Draufsicht' });

  /* ---------- Gruppen (Größenvergleich im selben Maßstab) ---------- */
  const G = {
    r: { titel: 'Bedrahtete Widerstände nach Nennleistung', achse: 'zeile', ids: ['r025', 'r05', 'r1', 'r2'], text: 'Gleicher Wert (hier 4,7 kΩ), vier Leistungsklassen im selben Maßstab: Je mehr Wärme ein Widerstand abgeben muss, desto größer baut er. Die Farbringe sagen den Wert, nicht die Leistung.' },
    rsmd: { titel: 'SMD-Widerstände', achse: 'spalte', ids: ['r0603', 'r0805', 'r1206', 'r2512'], text: 'SMD-Widerstände von oben gesehen. Der Name steht für die Größe: 0603 bedeutet 0,06 × 0,03 Zoll, also 1,6 × 0,8 mm. Größere Fläche heißt auch hier mehr Leistung.' },
    c: { titel: 'Kondensator-Bauformen', achse: 'spalte', ids: ['c-disc', 'c-mlcc', 'c-folie', 'el63'], text: 'Keramik und Folie sind nicht gepolt und eher klein. Der Elko speichert viel Ladung auf kleinem Raum, hat aber einen Minus-Streifen und darf nicht falsch herum eingebaut werden.' },
    elko: { titel: 'Elko-Größen (radial)', achse: 'spalte', ids: ['el5', 'el63', 'el8', 'el10', 'el16'], text: 'Mit der Kapazität und der Spannungsfestigkeit wächst der Becher. Die genauen Maße unterscheiden sich je nach Hersteller und Spannung; das Raster ist der Abstand der beiden Beine.' },
    d: { titel: 'Dioden-Bauformen', achse: 'zeile', ids: ['d4148', 'z05', 'd4007', 'z1', 'd5408'], text: 'Der Ring auf dem Gehäuse markiert die Kathode. Größeres Gehäuse und dickerer Draht bedeuten mehr Strom- und Verlustleistung, Glasdioden sind die kleinsten.' },
    led: { titel: 'LED-Bauformen', achse: 'spalte', ids: ['led3', 'led5', 'led10', 'ledp', 'led06'], text: 'Bedrahtete LEDs im Größenvergleich mit zwei SMD-Typen. Bei den bedrahteten ist das längere Bein die Anode, am Rand des Gehäuses sitzt eine abgeflachte Stelle auf der Kathodenseite.' },
    tr: { titel: 'Transistor-Gehäuse', achse: 'spalte', ids: ['to92', 'to220', 'sot23', 'sot223'], text: 'Kleine Typen im TO-92 oder als SMD-Bauteil, Leistungstypen im TO-220 mit Kühlfahne. Die Gehäuseform hängt vor allem von der Verlustleistung ab, nicht vom Transistortyp.' },
    sich: { titel: 'Sicherungen', achse: 'zeile', ids: ['f5', 'f63', 'fsmd'], text: 'Feinsicherungen stecken in einem Halter. Der Aufdruck nennt Nennstrom und Auslösecharakteristik; die Größe sagt nichts über den Nennstrom.' },
    lss: { titel: 'Leitungsschutzschalter auf der Hutschiene', achse: 'spalte', ids: ['lss1', 'lss2', 'lss3'], text: 'Reiheneinbaugeräte sind 90 mm hoch und genau ein Vielfaches von 17,5 mm breit (eine Teilungseinheit, TE).' },
    rcd: { titel: 'FI-Schutzschalter auf der Hutschiene', achse: 'spalte', ids: ['fi2', 'fi4'], text: 'FI-Schutzschalter haben dieselbe Bauhöhe wie Leitungsschutzschalter. Die gelbe Prüftaste löst den Schalter zum Testen aus.' },
    rly: { titel: 'Relais', achse: 'spalte', ids: ['rly'], text: 'Ein Printrelais ist ein kleiner Würfel mit Spule und Kontakt. Der Maßstabsbalken zeigt, wie groß er im Vergleich zu den anderen Bauteilen ist.' },
    trf: { titel: 'Transformator-Kerne (EI-Schnitt)', achse: 'spalte', ids: ['ei30', 'ei38', 'ei48', 'ei66'], text: 'Kleintransformatoren haben einen Kern aus E- und I-förmigen Blechen. Der Name nennt die Kernbreite in Millimetern; die Höhe beträgt fünf Sechstel davon. Ein größerer Kern kann mehr Leistung übertragen.' },
    poti: { titel: 'Drehpotis', achse: 'spalte', ids: ['po9', 'po16', 'po24'], text: 'Drehpotis gibt es in genormten Gehäusedurchmessern. Von oben sieht man das Gehäuse und die Achse, auf die der Drehknopf kommt.' },
    ic: { titel: 'IC-Gehäuse: DIP und SOIC', achse: 'spalte', ids: ['dip8', 'dip14', 'dip16', 'soic8', 'soic14', 'soic16'], text: 'DIP-Gehäuse werden durch die Platine gesteckt (Raster 2,54 mm), SOIC-Gehäuse liegen auf der Platine (Raster 1,27 mm). Die Kerbe zeigt nach oben, der Punkt markiert Pin 1.' }
  };
  /* Wiki-Eintrag -> Gruppen */
  const WIKI = {
    'bt-r': ['r', 'rsmd'], 'bt-c': ['c'], 'bt-ce': ['elko'], 'bt-d': ['d'], 'bt-led': ['led'],
    'bt-npn': ['tr'], 'bt-fet': ['tr'], 'bt-thy': ['tr'], 'bt-triac': ['tr'], 'bt-u': ['tr'],
    'bt-pot': ['poti'], 'bt-fuse': ['sich'], 'bt-lss': ['lss'], 'bt-rcd': ['rcd'], 'bt-rly': ['rly'], 'bt-trf': ['trf'],
    'bt-ic': ['ic'], 'bt-opa': ['ic']
  };

  /* ---------- Stil ---------- */
  const CSS = '.bv{display:block;width:100%;height:auto;max-width:560px;margin:6px auto 0;text-anchor:start}'
    + '.bv text{font:600 12px system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg,#e8ecf0);-webkit-user-select:none;user-select:none}'
    + '.bv .mu{fill:var(--mute,#8d99a6);font-weight:500;font-size:11px}.bv .md{text-anchor:middle}.bv .mr{text-anchor:end}'
    + '.bv .dim{stroke:var(--mute,#8d99a6);stroke-width:1;fill:none}.bv .sc{stroke:var(--fg,#e8ecf0);stroke-width:2;fill:none}'
    + '.bv .bd{stroke:#5d6672;stroke-width:.8;stroke-linejoin:round}.bv .ln{stroke:#9aa1ab;stroke-width:.8;fill:none}.bv .nf{fill:none}'
    + '.bv .wire{fill:#b7bcc4;stroke:#6b7380;stroke-width:.4}.bv .tan{fill:#d9bb82}.bv .blu{fill:#8dbbe0}.bv .blk{fill:#2b2e34}.bv .glass{fill:#d98b3e}.bv .zglass{fill:#86a3cb}'
    + '.bv .cer{fill:#d98a45}.bv .mlc{fill:#e3b94b}.bv .foi{fill:#cf4a3e}.bv .elk{fill:#2a3d63}.bv .stp{fill:#c8ced9}.bv .mtl{fill:#9ca2ab}.bv .mtl2{fill:#c2c7ce}.bv .cap{fill:rgba(0,0,0,.2)}'
    + '.bv .gls{fill:rgba(205,228,240,.5)}.bv .cu{fill:#c98a4b}.bv .lt{fill:#e4e7eb}.bv .lt2{fill:#c6ccd4}.bv .rb{fill:#2f5fa6}.bv .lbl{fill:#e8eef7}.bv .yl{fill:#e2c23a}.bv .pr{fill:#7d848e}'
    + '.bvl{margin:8px 0 2px;font-size:13px}.bvl .bvh{display:flex;justify-content:space-between;gap:8px;color:var(--mute,#8d99a6)}.bvl .bvh b{color:var(--fg,#e8ecf0);font-weight:600}'
    + '.bvl .bvt{position:relative;height:14px;border-radius:7px;background:var(--panel,#222830);border:1px solid var(--line,#38424d);overflow:hidden;margin:5px 0}'
    + '.bvl .bvt i{display:block;height:100%;background:var(--ok,#4fd58a)}.bvl.warn .bvt i{background:var(--warn,#ffd166)}.bvl.hoch .bvt i{background:var(--danger,#ff5c5c)}'
    + '.bvl .bvt u{position:absolute;top:0;bottom:0;width:2px;background:var(--fg,#e8ecf0);opacity:.6;text-decoration:none}.bvl .bvs{color:var(--fg,#e8ecf0)}'
    + '.bvk{margin:8px 0 4px;padding-top:8px;border-top:1px solid var(--line,#38424d)}.bvk .bvc{margin:4px 0 0;font-size:13px;color:var(--mute,#8d99a6)}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('bauviz-css')) {
    const st = document.createElement('style'); st.id = 'bauviz-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ---------- Zeichen-Bausteine (alles in Pixeln, s = Pixel je Millimeter) ---------- */
  const R = (x, y, w, h, cls, rx, extra) => `<rect class="${cls}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ` rx="${q(rx)}"` : ''}${extra || ''}/>`;
  const P = (d, cls, extra) => `<path class="${cls}" d="${d}"${extra || ''}/>`;
  const dimH = (x1, x2, y, lab) => `<path class="dim" d="M${q(x1)} ${q(y + 3)}V${q(y - 3)}M${q(x2)} ${q(y + 3)}V${q(y - 3)}M${q(x1)} ${q(y)}H${q(x2)}"/><text class="mu md" x="${q((x1 + x2) / 2)}" y="${q(y - 5)}">${esc(lab)}</text>`;
  const dimV = (x, y1, y2, lab) => `<path class="dim" d="M${q(x - 3)} ${q(y1)}H${q(x + 3)}M${q(x - 3)} ${q(y2)}H${q(x + 3)}M${q(x)} ${q(y1)}V${q(y2)}"/><text class="mu md" transform="rotate(-90 ${q(x - 5)} ${q((y1 + y2) / 2)})" x="${q(x - 5)}" y="${q((y1 + y2) / 2)}">${esc(lab)}</text>`;
  /* Beine nach unten: xs = Mittelpunkte (px), y0 = Start, len = Länge (px), dw = Drahtdicke (px) */
  const legs = (xs, y0, len, dw) => xs.map(x => R(x - dw / 2, y0, dw, len, 'wire')).join('');
  const ldw = (it, s) => Math.max(pos(it.dr) * s, 1.3);

  /* ---------- Axiale Teile (liegend): Ursprung links, y = Mittellinie ---------- */
  function axial(it, s, o) {
    const lead = it.form === 'fuse' ? 0 : 3.5, L = it.l * s, D = it.dm * s, ld = lead * s, W = L + 2 * ld;
    let h = '';
    if (lead) h += R(0, -ldw(it, s) / 2, W, ldw(it, s), 'wire');
    if (it.form === 'fuse') {
      const cl = Math.max(Math.min(it.l * 0.2, 4.5), it.l < 5 ? 0.7 : 1) * s;
      h += R(0, -D / 2, L, D, 'gls bd', Math.min(D * 0.2, 4));
      h += `<path class="ln" d="M${q(cl)} 0H${q(L - cl)}"/>`;
      h += R(0, -D / 2, cl, D, 'mtl2 bd', Math.min(D * 0.2, 3)) + R(L - cl, -D / 2, cl, D, 'mtl2 bd', Math.min(D * 0.2, 3));
      return { w: W, svg: h };
    }
    const x0 = ld, bodyH = D * 0.86, rx = Math.min(D * 0.3, 5);
    if (it.art === 'res') {
      h += R(x0, -bodyH / 2, L, bodyH, it.kl + ' bd', rx);
      const cw = L * 0.11; h += R(x0, -D / 2, cw, D, it.kl + ' bd', rx * 0.8) + R(x0 + L - cw, -D / 2, cw, D, it.kl + ' bd', rx * 0.8);
      h += R(x0, -D / 2, cw, D, 'cap', rx * 0.8) + R(x0 + L - cw, -D / 2, cw, D, 'cap', rx * 0.8);
      const rg = ringe(o.wert || '4k7') || ringe('4k7'), nv = rg.ringe.length - 2, pp = nv === 3 ? [0.2, 0.31, 0.42, 0.53] : [0.22, 0.35, 0.48], rw = Math.max(L * 0.07, 1.4);
      rg.ringe.forEach((c, i) => { const fx = i < nv + 1 ? pp[i] : (nv === 3 ? 0.77 : 0.76); h += R(x0 + L * fx, -bodyH / 2, rw, bodyH, 'nf', 0, ` fill="${FARBE[c]}" stroke="#3a3f47" stroke-width=".4"`); });
    } else {
      const bw = L * (it.kl === 'blk' ? 0.2 : 0.17);
      h += R(x0, -D / 2, L, D, it.kl + ' bd', Math.min(D * 0.25, 3));
      h += R(x0 + L - bw * 1.15, -D / 2, bw, D, 'nf', 0, ` fill="${FARBE[it.band] || '#111'}" stroke="#3a3f47" stroke-width=".4"`);
    }
    return { w: W, svg: h, x0: x0, body: L };
  }

  /* ---------- Radiale Teile (stehend): Ursprung = Mitte der Unterkante, y nach oben negativ ---------- */
  const LEAD = 4;
  function geomR(it) {
    switch (it.form) {
      case 'disc': case 'mlcc': case 'folie': case 'to92': case 'to220': case 'relay': case 'ei': case 'rail': return { w: it.b, up: it.h, down: it.form === 'rail' || it.form === 'ei' ? 0 : (it.form === 'relay' ? 3 : LEAD), dw: it.b, dh: it.h };
      case 'elko': return { w: it.dm, up: it.h, down: LEAD, dw: it.dm, dh: it.h };
      case 'led': return { w: it.fl, up: it.h, down: 4.6, dw: it.dm, dh: it.h };
      case 'smd': case 'smdled': case 'sot23': case 'sot223': return { w: it.l, up: it.b, down: 0, dw: it.l, dh: it.b };
      case 'poti': return { w: it.dm, up: it.dm, down: 0, dw: it.dm, dh: it.dm };
      case 'ic': return { w: it.span, up: it.l, down: 0, dw: it.bw, dh: it.l };
      default: return { w: 1, up: 1, down: 0, dw: 1, dh: 1 };
    }
  }
  function radial(it, s, o) {
    const u = v => v * s, dw = ldw(it, s); let h = '';
    const two = ra => [-u(ra) / 2, u(ra) / 2];
    switch (it.form) {
      case 'disc': {
        const w = u(it.b), H = u(it.h), r = w / 2;
        h += legs(two(it.ra), 0, u(LEAD), dw);
        h += P(`M${q(-r)} 0V${q(-H + r)}A${q(r)} ${q(r)} 0 0 1 ${q(r)} ${q(-H + r)}V0Z`, 'cer bd');
        h += P(`M${q(-r * 0.55)} ${q(-H + r * 0.7)}a${q(r * 0.7)} ${q(r * 0.7)} 0 0 1 ${q(r * 0.7)} ${q(-r * 0.35)}`, 'ln', ' stroke="#f4d2a4" stroke-width="1.2"');
        break;
      }
      case 'mlcc': case 'folie': {
        const w = u(it.b), H = u(it.h), c = it.form === 'mlcc' ? 'mlc' : 'foi';
        h += legs(two(it.ra), 0, u(LEAD), dw);
        h += R(-w / 2, -H, w, H, c + ' bd', Math.min(w * 0.12, 3));
        h += R(-w / 2 + w * 0.15, -H * 0.62, w * 0.7, Math.max(H * 0.2, 2), 'nf', 0, ' fill="rgba(255,255,255,.55)"');
        break;
      }
      case 'elko': {
        const w = u(it.dm), H = u(it.h), x0 = -w / 2;
        h += legs(two(it.ra), 0, u(LEAD), dw);
        h += R(x0, -H, w, H, 'elk bd', Math.min(w * 0.12, 3));
        h += R(x0, -H, w * 0.28, H, 'stp', Math.min(w * 0.12, 3));
        const dh = Math.max(H * 0.07, 1.2), dw2 = w * 0.16;
        [0.3, 0.5, 0.7].forEach(f => { h += R(x0 + w * 0.06, -H * (1 - f), dw2, dh, 'elk'); });
        h += R(x0 + w * 0.34, -H + H * 0.05, w * 0.05, H * 0.9, 'nf', 0, ' fill="rgba(255,255,255,.14)"');
        h += P(`M${q(x0)} ${q(-H * 0.07)}H${q(x0 + w)}`, 'ln', ' stroke="#7d8798"');
        break;
      }
      case 'led': {
        const fl = u(it.fl), dm = u(it.dm), H = u(it.h), ft = Math.max(u(0.8), 1.4), top = -(H - dm / 2), col = LEDFARBE[o.farbe] || LEDFARBE.rot, r = dm / 2;
        h += R(-u(it.ra) / 2 - dw / 2, 0, dw, u(3.2), 'wire') + R(u(it.ra) / 2 - dw / 2, 0, dw, u(4.6), 'wire');
        h += P(`M${q(-r)} ${q(-ft)}V${q(top)}A${q(r)} ${q(r)} 0 0 1 ${q(r)} ${q(top)}V${q(-ft)}Z`, 'nf bd', ` fill="${col}" fill-opacity=".85"`);
        h += P(`M${q(-fl / 2)} ${q(-ft)}H${q(fl / 2)}V0H${q(-fl / 2)}Z`, 'nf bd', ` fill="${col}" fill-opacity=".85"`);
        h += P(`M${q(-u(it.ra) / 4)} ${q(-ft)}V${q(-H * 0.45)}M${q(u(it.ra) / 4)} ${q(-ft)}V${q(-H * 0.55)}M${q(-u(it.ra) / 4)} ${q(-H * 0.45)}H${q(u(it.ra) / 4)}`, 'ln', ' stroke="#555b64"');
        h += P(`M${q(-r * 0.6)} ${q(top + r * 0.3)}a${q(r * 0.75)} ${q(r * 0.75)} 0 0 1 ${q(r * 0.45)} ${q(-r * 0.25)}`, 'ln', ' stroke="#fff" stroke-opacity=".7" stroke-width="1.3"');
        break;
      }
      case 'to92': {
        const w = u(it.b), H = u(it.h), r = w / 2;
        h += legs([-u(it.ra), 0, u(it.ra)], 0, u(LEAD), dw);
        h += P(`M${q(-r)} 0V${q(-H + r)}A${q(r)} ${q(r)} 0 0 1 ${q(r)} ${q(-H + r)}V0Z`, 'blk bd');
        h += R(-r * 0.55, -H * 0.55, r * 1.1, Math.max(H * 0.07, 1), 'pr') + R(-r * 0.4, -H * 0.38, r * 0.8, Math.max(H * 0.07, 1), 'pr');
        break;
      }
      case 'to220': {
        const w = u(it.b), tab = u(it.tab), H = u(it.h), pl = H - tab;
        h += legs([-u(it.ra), 0, u(it.ra)], 0, u(LEAD), dw);
        h += R(-w / 2, -H, w, tab + 1, 'mtl2 bd', 1.5);
        h += `<circle class="nf bd" cx="0" cy="${q(-H + tab * 0.5)}" r="${q(u(1.9))}"/>`;
        h += R(-w / 2, -pl, w, pl, 'blk bd', 1.5);
        h += R(-w * 0.28, -pl * 0.62, w * 0.56, Math.max(pl * 0.06, 1), 'pr') + R(-w * 0.2, -pl * 0.4, w * 0.4, Math.max(pl * 0.06, 1), 'pr');
        break;
      }
      case 'smd': case 'sot23': case 'sot223': case 'smdled': {
        const w = u(it.l), H = u(it.b);
        if (it.form === 'smd') {
          const tw = w * 0.22;
          h += R(-w / 2, -H, w, H, 'blk bd', 0.6) + R(-w / 2, -H, tw, H, 'mtl2 bd', 0.4) + R(w / 2 - tw, -H, tw, H, 'mtl2 bd', 0.4);
        } else if (it.form === 'smdled') {
          const tw = w * 0.2, c = LEDFARBE[o.farbe] || LEDFARBE.gelb;
          h += R(-w / 2, -H, w, H, 'lt bd', 0.6) + R(-w / 2, -H, tw, H, 'mtl2 bd', 0.4) + R(w / 2 - tw, -H, tw, H, 'mtl2 bd', 0.4);
          h += `<circle class="nf" cx="0" cy="${q(-H / 2)}" r="${q(Math.min(w / 2 - tw, H / 2) * 0.72)}" fill="${c}" stroke="#7d848e" stroke-width=".5"/>`;
        } else if (it.form === 'sot23') {
          const bh = u(1.3), lg = (H - bh) / 2, lw = u(0.5);
          h += R(-w / 2, -H + lg, w, bh, 'blk bd', 0.6);
          [-0.95, 0.95].forEach(x => { h += R(u(x) - lw / 2, -lg, lw, lg + 0.4, 'mtl2 bd', 0.3); });
          h += R(-lw / 2, -H - 0.4, lw, lg + 0.4, 'mtl2 bd', 0.3);
        } else {
          const bw = w, bh = u(3.5), tb = u(3), tw = u(3.0), lg = H - bh - tb, lw = u(0.7);
          h += R(-bw / 2, -H + tb, bw, bh, 'blk bd', 1);
          h += R(-tw / 2, -H, tw, tb + 0.5, 'mtl2 bd', 0.5);
          [-2.3, 0, 2.3].forEach(x => { h += R(u(x) - lw / 2, -lg, lw, lg + 0.4, 'mtl2 bd', 0.3); });
        }
        break;
      }
      case 'rail': {
        const w = u(it.b), H = u(it.h), te = u(17.5);
        h += R(-w / 2, -H, w, H, 'lt bd', 2);
        h += R(-w / 2, -H, w, H * 0.14, 'lt2 bd', 2) + R(-w / 2, -H * 0.14, w, H * 0.14, 'lt2 bd', 2);
        for (let i = 1; i < it.te; i++) h += P(`M${q(-w / 2 + i * te)} ${q(-H * 0.86)}V${q(-H * 0.14)}`, 'ln');
        for (let i = 0; i < it.te; i++) h += R(-w / 2 + i * te + te * 0.3, -H * 0.62, te * 0.4, H * 0.2, 'blk', 1);
        if (it.te > 1) h += R(-w / 2 + te * 0.3, -H * 0.56, w - te * 0.6, H * 0.08, 'blk', 1);
        if (it.fi) h += R(w / 2 - te * 0.8, -H * 0.38, te * 0.5, H * 0.09, 'yl bd', 1);
        break;
      }
      case 'relay': {
        const w = u(it.b), H = u(it.h);
        h += legs([-w * 0.32, -w * 0.12, w * 0.12, w * 0.32, 0].slice(0, 4), 0, u(3), Math.max(u(0.6), 1.3));
        h += R(-w / 2, -H, w, H, 'rb bd', 1.5);
        h += R(-w * 0.4, -H * 0.78, w * 0.8, H * 0.5, 'lbl', 1);
        [0.66, 0.54, 0.42].forEach((f, i) => { h += R(-w * 0.3, -H * f, w * (i === 2 ? 0.34 : 0.6), Math.max(H * 0.04, 1), 'pr'); });
        break;
      }
      case 'ei': {
        const w = u(it.b), a = w / 6, H = a * 5;
        h += R(-w / 2, -H, w, H, 'mtl bd', 1);
        h += R(-w / 2 + a, -H + a * 0.9, a * 4, H - a * 1.8, 'cu bd', 1.5);
        h += P(`M${q(-w / 2 + a)} ${q(-H + a * 1.9)}H${q(w / 2 - a)}M${q(-w / 2 + a)} ${q(-a * 1.9)}H${q(w / 2 - a)}`, 'ln', ' stroke="#7a4f24"');
        break;
      }
      case 'poti': {
        const D = u(it.dm), ac = u(it.ach), r = D / 2;
        h += `<circle class="mtl bd" cx="0" cy="${q(-r)}" r="${q(r)}"/>`;
        h += `<circle class="nf" cx="0" cy="${q(-r)}" r="${q(r * 0.82)}" stroke="#7d848e" stroke-width=".6"/>`;
        h += `<circle class="mtl2 bd" cx="0" cy="${q(-r)}" r="${q(ac / 2)}"/>` + P(`M${q(-ac / 2 + 0.8)} ${q(-r)}H${q(ac / 2 - 0.8)}`, 'ln', ' stroke="#3a3f47" stroke-width="1.4"');
        break;
      }
      case 'ic': {
        const bw = u(it.bw), H = u(it.l), sp = u(it.span), n2 = it.n / 2, pitch = u(it.pitch), pw = Math.max(u(it.pk === 'dip' ? 0.5 : 0.4), 1.2);
        const stub = (sp - bw) / 2 + 0.6;
        for (let i = 0; i < n2; i++) {
          const y = -H / 2 + (i - (n2 - 1) / 2) * pitch;
          h += R(-sp / 2, y - pw / 2, stub, pw, 'mtl2 bd', 0.3) + R(sp / 2 - stub, y - pw / 2, stub, pw, 'mtl2 bd', 0.3);
        }
        h += R(-bw / 2, -H, bw, H, 'blk bd', 1);
        const nr = Math.min(u(0.9), bw * 0.22);
        h += P(`M${q(-nr)} ${q(-H)}A${q(nr)} ${q(nr)} 0 0 0 ${q(nr)} ${q(-H)}`, 'ln');
        h += `<circle class="pr" cx="${q(-bw / 2 + Math.max(u(1), 2.2))}" cy="${q(-H + Math.max(u(1.1), 2.6))}" r="${q(Math.max(u(0.35), 0.9))}"/>`;
        break;
      }
      default: return { svg: '' };
    }
    return { svg: h };
  }

  /* ---------- Layout ---------- */
  const scaleBar = (s, W, y) => {
    const opts = [1, 2, 5, 10, 20, 50], lim = W * 0.28; let mm = opts[0];
    opts.forEach(m => { if (m * s <= lim && m * s >= 18) mm = m; else if (m * s < 18) mm = m; });
    const px = Math.max(mm * s, 4);
    return `<path class="sc" d="M12 ${q(y - 4)}V${q(y + 4)}M${q(12 + px)} ${q(y - 4)}V${q(y + 4)}M12 ${q(y)}H${q(12 + px)}"/><text class="mu" x="${q(12 + px + 8)}" y="${q(y + 4)}">${de(mm)} mm, gleicher Maßstab für alle Teile</text>`;
  };
  const labelLines = it => {
    const m = masseKurz(it); return [it.kurz, m];
  };
  function spalte(items, o) {
    const W = o.w || 420, mL = 12, gap = 8, extra = 24, n = items.length, g = items.map(geomR);
    const minSlot = Math.min(o.minSlot || 70, (W - 2 * mL - gap * (n - 1)) / n), maxUp = Math.max(...g.map(x => x.up)), maxDn = Math.max(...g.map(x => x.down));
    const slot = (gg, s) => Math.max(gg.w * s + extra, minSlot);
    const total = s => g.reduce((a, gg) => a + slot(gg, s), 0) + gap * (n - 1) + 2 * mL;
    let s = o.maxS || 14;
    while (s > 0.3 && (total(s) > W || maxUp * s > (o.maxH || 190))) s -= 0.1;
    s = Math.max(s, 0.3);
    const top = 8, dimRow = 22, y0 = top + dimRow + maxUp * s, lab0 = y0 + maxDn * s + 18, nl = 2, H = lab0 + 14 * nl + (o.bar === false ? 4 : 26);
    let x = mL, body = '';
    items.forEach((it, i) => {
      const gg = g[i], sl = slot(gg, s), cx = x + sl / 2, r = radial(it, s, o.opt || {});
      body += `<g transform="translate(${q(cx)} ${q(y0)})">${r.svg}`;
      body += dimH(-gg.dw * s / 2, gg.dw * s / 2, -gg.up * s - 9, de(gg.dw));
      body += dimV(-gg.w * s / 2 - 9, -gg.dh * s, 0, de(gg.dh));
      body += '</g>';
      const L = labelLines(it);
      body += `<text class="md" x="${q(cx)}" y="${q(lab0)}">${esc(L[0])}</text><text class="mu md" x="${q(cx)}" y="${q(lab0 + 14)}">${esc(L[1])}</text>`;
      x += sl + gap;
    });
    if (o.bar !== false) body += scaleBar(s, W, H - 12);
    return { W, H: Math.round(H), body };
  }
  function zeile(items, o) {
    const W = o.w || 420, lw = 108, area = W - lw - 14, mm = Math.max(...items.map(it => it.l + (it.form === 'fuse' ? 0 : 7)));
    const s = Math.min(o.maxS || 11, area / mm);
    let y = 6, body = '';
    items.forEach(it => {
      const D = Math.max(it.dm * s, 10), yc = y + 20 + D / 2, r = axial(it, s, o.opt || {}), lead = it.form === 'fuse' ? 0 : 3.5;
      body += `<text x="2" y="${q(yc - 2)}">${esc(it.kurz)}</text><text class="mu" x="2" y="${q(yc + 12)}">${esc(masseKurz(it))}</text>`;
      body += `<g transform="translate(${lw} ${q(yc)})">${r.svg}${dimH(lead * s, (lead + it.l) * s, -D / 2 - 6, de(it.l))}</g>`;
      y += D + 30;
    });
    const H = Math.round(y + (o.bar === false ? 0 : 22));
    if (o.bar !== false) body += scaleBar(s, W, H - 12);
    return { W, H, body };
  }
  const svgWrap = (r, aria) => `<svg class="bv" viewBox="0 0 ${r.W} ${r.H}" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title>${r.body}</svg>`;

  function masseKurz(it) {
    switch (it.form) {
      case 'axial': case 'fuse': return `L ${de(it.l)} × Ø ${de(it.dm)} mm`;
      case 'smd': case 'smdled': case 'sot23': case 'sot223': return `${de(it.l)} × ${de(it.b)} mm`;
      case 'elko': return `Ø ${de(it.dm)} × ${de(it.h)} mm`;
      case 'led': return `Ø ${de(it.dm)} × ${de(it.h)} mm`;
      case 'poti': return `Ø ${de(it.dm)} mm`;
      case 'ic': return `L ${de(it.l)} mm`;
      default: return `${de(it.b)} × ${de(it.h)} mm`;
    }
  }
  function masseLang(it) {
    const raster = it.ra ? `, Raster ${de(it.ra)}` : '';
    switch (it.form) {
      case 'axial': return `Länge ${de(it.l)} × Ø ${de(it.dm)}, Draht Ø ${de(it.dr)}`;
      case 'fuse': return `Länge ${de(it.l)} × Ø ${de(it.dm)}`;
      case 'smd': case 'smdled': return `${de(it.l)} × ${de(it.b)} × ${de(it.h)}`;
      case 'sot23': case 'sot223': return `${de(it.l)} × ${de(it.b)} × ${de(it.h)} (mit Beinen)`;
      case 'elko': return `Ø ${de(it.dm)} × Höhe ${de(it.h)}${raster}`;
      case 'led': return `Ø ${de(it.dm)} (Rand Ø ${de(it.fl)}), Höhe ${de(it.h)}${raster}`;
      case 'disc': case 'mlcc': case 'folie': return `${de(it.b)} breit × ${de(it.h)} hoch${it.t ? ' × ' + de(it.t) + ' dick' : ''}${raster}`;
      case 'to92': return `${de(it.b)} breit × ${de(it.h)} hoch${raster}`;
      case 'to220': return `${de(it.b)} breit × ${de(it.h)} hoch × ${de(it.t)} dick${raster}`;
      case 'rail': return `${de(it.b)} breit (${it.te} TE) × ${de(it.h)} hoch`;
      case 'relay': return `${de(it.b)} × ${de(it.h)} hoch × ${de(it.t)} tief`;
      case 'ei': return `Kern ${de(it.b)} × ${de(it.h)}`;
      case 'poti': return `Ø ${de(it.dm)}, Achse Ø ${de(it.ach)}`;
      case 'ic': return `Körper ${de(it.l)} × ${de(it.bw)}, Raster ${de(it.pitch)}${it.rs ? ', Reihenabstand ' + de(it.rs) : ''}`;
      default: return '';
    }
  }

  /* ---------- öffentliche Funktionen ---------- */
  function vergleich(gk, opt) {
    const g = G[gk]; if (!g) return '';
    const items = g.ids.map(id => T[id]).filter(Boolean); if (!items.length) return '';
    opt = opt || {};
    const r = (g.achse === 'zeile' ? zeile : spalte)(items, Object.assign({ opt: opt }, opt));
    return svgWrap(r, g.titel + ': ' + items.map(it => it.kurz + ' (' + masseKurz(it) + ')').join(', '));
  }
  function einzel(id, opt) {
    const it = T[id]; if (!it) return '';
    opt = opt || {};
    const zl = it.form === 'axial' || it.form === 'fuse';
    const r = (zl ? zeile : spalte)([it], Object.assign({ w: 300, opt: opt, minSlot: 150, maxH: 150, maxS: zl ? 9 : 16 }, opt));
    return svgWrap(r, it.typ + ', ' + masseKurz(it));
  }
  function tabelleHtml(gk) {
    const g = G[gk]; if (!g) return '';
    const rows = g.ids.map(id => T[id]).filter(Boolean).map(it => `<tr><th scope="row">${esc(it.typ)}</th><td>${esc(masseLang(it))}</td><td>${esc(it.info || '')}</td></tr>`).join('');
    return `<div class="tw"><table class="bv-tab"><thead><tr><th>Bauform</th><th>Maße in mm</th><th>Hinweis</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function wikiHtml(id) {
    const gs = WIKI[id]; if (!gs) return '';
    let h = '<section class="bv-fig" aria-label="Bauformen und Größen"><h4>Bauformen und Größen</h4>';
    gs.forEach(gk => { const g = G[gk]; h += `<figure class="bv-f"><div class="bv-t">${esc(g.titel)}</div>${vergleich(gk)}<figcaption>${esc(g.text)}</figcaption></figure>${tabelleHtml(gk)}`; });
    return h + '<p class="bv-n">Alle Maße sind übliche Richtwerte in Millimetern und weichen je nach Hersteller etwas ab. Die Bilder sind Skizzen als Fotoersatz, keine Konstruktionszeichnungen.</p></section>';
  }

  /* ---------- Belastung: nur Darstellung (Leistung gegen gewählte Nennleistung), keine eigene Physik ---------- */
  const NENN = ['0.25', '0.5', '1', '2'];
  const nennText = w => (NENN.indexOf(String(w)) >= 0 ? de(parseFloat(w)) + ' W' : '');
  function belastung(Pw, Pn) {
    Pw = Math.abs(+Pw); Pn = +Pn;
    if (!fin(Pw) || !fin(Pn) || Pn <= 0) return null;
    const pct = Pw / Pn * 100, stufe = pct > 100 ? 'hoch' : pct > 70 ? 'warn' : 'ok';
    const text = stufe === 'hoch' ? 'über der Nennleistung: Der Widerstand würde zu heiß' : stufe === 'warn' ? 'nahe an der Grenze: Der Widerstand wird deutlich warm' : 'im grünen Bereich';
    return { pct: pct, stufe: stufe, text: text };
  }
  const fmtW = x => (x >= 1 ? de(Math.round(x * 100) / 100) : x >= 0.01 ? de(Math.round(x * 1000) / 1000) : de(Math.round(x * 10000) / 10000)) + ' W';
  function balkenHtml(Pw, Pn) {
    const b = belastung(Pw, Pn); if (!b) return '';
    const fill = Math.min(b.pct, 150) / 150 * 100, mark = 100 / 150 * 100, pc = Math.round(b.pct);
    return `<div class="bvl ${b.stufe}" role="group" aria-label="Belastung ${pc} Prozent der Nennleistung: ${esc(b.text)}"><div class="bvh"><span>Belastung</span><b>${pc} % · ${esc(fmtW(Math.abs(+Pw)))} von ${esc(fmtW(+Pn))}</b></div><div class="bvt" role="meter" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${pc}"><i style="width:${q(fill)}%"></i><u style="left:${q(mark)}%"></u></div><div class="bvs">${esc(b.text)}.</div></div>`;
  }

  /* ---------- Anbindung SchaltLab: Schaltplan-Bauteil -> Bauform ---------- */
  function teilFuer(k, p) {
    p = p || {};
    const v = String(p.v == null ? '' : p.v), opt = {};
    let id = null, bsp = false;
    switch (k) {
      case 'R': id = { '0.25': 'r025', '0.5': 'r05', '1': 'r1', '2': 'r2' }[String(p.w)] || 'r025'; opt.wert = v; bsp = !p.w; break;
      case 'POT': id = 'po16'; bsp = true; break;
      case 'C': { const f = wertSI(v); id = { disc: 'c-disc', mlcc: 'c-mlcc', folie: 'c-folie' }[p.bf] || (fin(f) && f <= 220e-9 ? 'c-disc' : 'c-folie'); bsp = !p.bf; break; }
      case 'CE': { const f = wertSI(v); id = !fin(f) || f <= 47e-6 ? 'el5' : f <= 100e-6 ? 'el63' : f <= 220e-6 ? 'el8' : f <= 1000e-6 ? 'el10' : 'el16'; bsp = true; break; }
      case 'D': id = /^1N54|3A/i.test(v) ? 'd5408' : /^1N40|^1N400|^1N5[0-9]{3}$/i.test(v) ? 'd4007' : 'd4148'; bsp = !/^1N(4148|4007|54)/i.test(v); break;
      case 'SCHOTTKY': id = 'd4007'; bsp = true; break;
      case 'ZD': id = 'z05'; bsp = true; break;
      case 'LED': id = { 3: 'led3', 5: 'led5', 10: 'led10', smd: 'ledp' }[p.bf] || 'led5'; opt.farbe = v; break;
      case 'NPN': case 'PNP': id = { to92: 'to92', to220: 'to220', sot23: 'sot23' }[p.bf] || 'to92'; break;
      case 'NMOS': case 'PMOS': id = /^(IRL|IRF)/i.test(v) ? 'to220' : 'to92'; break;
      case 'TRIAC': case 'THY': id = 'to220'; break;
      case 'REG': id = /78L|79L/i.test(v) ? 'to92' : 'to220'; break;
      case 'FUSE': id = { f5: 'f5', f63: 'f63', fsmd: 'fsmd' }[p.bf] || 'f5'; break;
      case 'RLY': id = 'rly'; bsp = true; break;
      case 'TRF': id = 'ei38'; bsp = true; break;
      case 'ICX': id = { 8: 'dip8', 14: 'dip14', 16: 'dip16' }[p.n || 8] || null; break;
      case 'OPA': id = 'dip8'; break;
      default: return null;
    }
    return id && T[id] ? { id: id, opt: opt, beispiel: bsp } : null;
  }
  /* Karte für die Seitenleiste: Bild, Maße, bei Widerständen die Farbringe */
  function kartenHtml(k, p) {
    const t = teilFuer(k, p); if (!t) return '';
    const it = T[t.id], svg = einzel(t.id, t.opt); if (!svg) return '';
    let c = `${esc(it.typ)}: ${esc(masseLang(it))} mm.`;
    if (it.art === 'res') { const rg = ringe(p && p.v); if (rg) c += ` Farbringe für ${esc(String(p.v))} Ω: ${esc(rg.text)} (${rg.tol}).`; }
    if (t.beispiel) c += ' Das ist eine übliche Bauform als Beispiel; je nach Hersteller und Typ kann sie anders aussehen.';
    return `<div class="bvk"><div class="mu" style="font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute,#8d99a6)">Bauform in echt</div>${svg}<p class="bvc">${c}</p></div>`;
  }

  const BV = { TEILE: T, GRUPPEN: G, WIKI: WIKI, NENN: NENN, FARBE: FARBE, vergleich: vergleich, einzel: einzel, tabelleHtml: tabelleHtml, wikiHtml: wikiHtml, ringe: ringe, wertOhm: wertOhm, wertSI: wertSI, belastung: belastung, balkenHtml: balkenHtml, nennText: nennText, teilFuer: teilFuer, kartenHtml: kartenHtml, masseLang: masseLang, css: CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BV; else root.BAUVIZ = BV;
})(typeof window !== 'undefined' ? window : this);
