'use strict';
/* Tonfunk Arbeitsschutz-Lab: Inhalte (Lab-Kennung 'arb', Präfix lm4.arb.).
   window.ARB_DATA  { cats, kat, signs, ghs, brand, mittel, matrix, signal, stop, gb, psa, tasks, eh, seiten, beispiele, help }
   window.ARB_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.arb.done' = {id:true})
   Fachliche Aussagen sind Standardwissen (Arbeitsschutz Deutschland). Unsichere Stellen sind mit PRUEFEN markiert. */
(function (root) {
  /* ===== Zeichnen: kleine Hilfen für die SVG-Piktogramme (Zeichenfläche 100 x 100) ===== */
  const P = d => `<path d="${d}"/>`;
  const L = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const R = (x, y, w, h, r, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}"${f ? ` fill="${f}"` : ''}/>`;
  const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}"${f ? ` fill="${f}"` : ''}/>`;
  const RO = (x, y, w, h, r, c, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
  const star = (cx, cy, Ro, Ri) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? Ri : Ro; p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); } return p.join(' '); };
  const flame = (c, b) => P('M50 18C57 32 69 40 67 58C65 71 57 78 50 78C43 78 33 71 33 58C33 47 41 41 44 30C46 35 48 34 50 18Z') + `<path d="M50 78C45 78 41 73 41 67C41 60 47 57 49 50C54 56 59 61 59 67C59 73 55 78 50 78Z" fill="${b}"/>`;
  const skull = (c, b) => C(50, 38, 18) + R(41, 52, 18, 14, 3) + C(42, 38, 5, b) + C(58, 38, 5, b) + `<path d="M50 44L47 51H53Z" fill="${b}"/>` + L('M28 66L72 86M72 66L28 86', 6, c);
  const stapler = (c, b) => R(24, 48, 28, 18, 3) + L('M28 48V36H44V48', 4, c) + R(58, 28, 5, 46, 1) + R(58, 70, 20, 4, 1) + C(32, 72, 7) + C(50, 72, 6) + C(32, 72, 2.5, b) + C(50, 72, 2.5, b);

  const PIC = {
    rauchen: c => R(20, 56, 42, 9, 2) + `<rect x="64" y="56" width="14" height="9" rx="2" opacity=".55"/>` + L('M70 49C65 44 74 40 69 34', 3, c) + L('M58 49C53 44 62 40 57 34', 3, c),
    feuer: flame,
    zutritt: c => C(50, 24, 8) + R(38, 36, 24, 28, 6) + R(29, 38, 8, 24, 4) + R(63, 38, 8, 24, 4) + R(38, 62, 10, 24, 3) + R(52, 62, 10, 24, 3),
    wasser: (c, b) => P('M36 20q9 12 0 20q-9-8 0-20z') + P('M58 20q9 12 0 20q-9-8 0-20z') + `<g transform="translate(27 42) scale(.55)">${flame(c, b)}</g>`,
    stapler,
    handy: (c, b) => R(35, 20, 30, 60, 5) + R(40, 27, 20, 36, 1, b) + C(50, 71, 3, b),
    augen: c => `<circle cx="35" cy="52" r="12" fill="none" stroke="${c}" stroke-width="5"/><circle cx="65" cy="52" r="12" fill="none" stroke="${c}" stroke-width="5"/>` + L('M47 50H53M24 48L14 42M76 48L86 42', 4, c),
    gehoer: c => L('M26 58C24 26 76 26 74 58', 5, c) + R(19, 54, 15, 26, 7) + R(66, 54, 15, 26, 7),
    handschuh: c => R(34, 52, 32, 26, 7) + R(34, 32, 7, 24, 3.5) + R(43, 26, 7, 30, 3.5) + R(52, 26, 7, 30, 3.5) + R(61, 32, 6, 24, 3) + P('M35 66L21 54L26 48L40 58Z'),
    helm: (c, b) => P('M24 62A26 26 0 0 1 76 62Z') + R(16, 62, 68, 9, 4.5) + L('M50 38V60', 4, b),
    fuss: (c, b) => P('M34 24H52V52L76 60V80H34Z') + L('M34 70H76', 3, b),
    atem: (c, b) => P('M24 42Q50 28 76 42Q78 66 50 82Q22 66 24 42Z') + C(38, 60, 6, b) + C(62, 60, 6, b) + L('M24 46L14 40M76 46L86 40', 3, c),
    blitz: () => P('M56 20L34 54H48L42 82L68 44H54Z'),
    heiss: c => L('M34 20Q27 30 34 40Q41 50 34 60', 4, c) + L('M50 20Q43 30 50 40Q57 50 50 60', 4, c) + L('M66 20Q59 30 66 40Q73 50 66 60', 4, c) + R(26, 70, 48, 8, 2),
    rutsch: c => C(36, 28, 7) + L('M40 36L52 54L72 50', 6, c) + L('M52 54L40 72', 6, c) + L('M20 84Q28 78 36 84T52 84T68 84T84 84', 3.5, c),
    stolper: c => C(30, 28, 7) + L('M36 36L54 50', 6, c) + L('M44 42L32 52', 5, c) + L('M54 50L70 62L66 82', 6, c) + L('M54 50L42 70L26 76', 6, c) + R(56, 76, 26, 8, 2),
    gift: skull,
    notausgang: c => L('M62 24H82V80H62', 5, c) + C(38, 28, 7) + L('M40 38L48 54L38 66', 6, c) + L('M48 54L58 66', 6, c) + L('M40 38L26 46M40 38L52 34', 5, c),
    erstehilfe: () => P('M40 20H60V40H80V60H60V80H40V60H20V40H40Z'),
    sammel: c => [0, 90, 180, 270].map(r => `<g transform="rotate(${r} 50 50)">${L('M50 14V38M41 29L50 38L59 29', 5, c)}</g>`).join('') + C(50, 50, 6),
    augendusche: c => L('M18 40Q50 16 82 40Q50 64 18 40Z', 4, c) + C(50, 40, 8) + P('M32 68q-7 9 0 14q7-5 0-14z') + P('M50 70q-7 9 0 14q7-5 0-14z') + P('M68 68q-7 9 0 14q7-5 0-14z'),
    notruf: () => P('M24 40Q22 28 36 28L42 28L46 40L40 46Q46 58 58 62L64 56L76 60V66Q76 78 64 78Q26 74 24 40Z'),
    loescher: (c, b) => R(36, 40, 26, 42, 7) + R(43, 30, 12, 12, 2) + L('M36 28H58', 5, c) + L('M58 34Q76 34 76 52', 4, c) + C(49, 54, 4, b),
    melder: c => RO(28, 28, 44, 44, 4, c, 5) + C(50, 50, 10) + L('M18 18L26 26M82 18L74 26M50 10V20', 4, c),
    schlauch: c => `<circle cx="44" cy="50" r="24" fill="none" stroke="${c}" stroke-width="5"/>` + C(44, 50, 9) + L('M68 50Q80 50 80 66V80', 4, c),
    /* GHS */
    bombe: c => C(44, 60, 17) + L('M52 47L62 35', 5, c) + L('M64 28L68 20M70 36L79 33M60 22V13', 3.5, c),
    brandfoerd: (c, b) => `<circle cx="50" cy="68" r="13" fill="none" stroke="${c}" stroke-width="5"/><g transform="translate(20 4) scale(.6)">${flame(c, b)}</g>`,
    gas: c => R(38, 36, 24, 46, 10) + R(45, 26, 10, 12, 2) + L('M41 26H59', 4, c),
    aetz: c => `<g transform="rotate(-25 34 30)">${R(26, 16, 16, 22, 3)}</g><g transform="rotate(25 66 30)">${R(58, 16, 16, 22, 3)}</g>` + C(30, 50, 3) + C(30, 58, 3) + C(70, 50, 3) + R(18, 72, 32, 6, 1) + R(56, 64, 20, 18, 4) + R(57, 54, 4, 12, 2) + R(63, 52, 4, 14, 2) + R(69, 54, 4, 12, 2),
    totenkopf: skull,
    ausruf: () => R(44, 20, 12, 36, 5) + C(50, 70, 7),
    gesund: (c, b) => C(50, 24, 10) + P('M28 82Q28 44 50 44Q72 44 72 82Z') + `<polygon points="${star(50, 63, 13, 5.5)}" fill="${b}"/>`,
    umwelt: (c, b) => L('M32 80V50M32 66L22 56M32 58L42 48', 4, c) + L('M16 84H84', 3, c) + '<ellipse cx="64" cy="64" rx="13" ry="8"/>' + P('M74 64L86 54V74Z') + C(58, 62, 1.8, b)
  };
  const wrap = (inner, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${label}">${inner}</svg>`;
  const BASE = {
    verbot: (p, l) => wrap(`<circle cx="50" cy="50" r="45" fill="#fff" stroke="#c8102e" stroke-width="9"/><g fill="#111">${p('#111', '#fff')}</g><path d="M18.5 18.5L81.5 81.5" stroke="#c8102e" stroke-width="9"/>`, l),
    gebot: (p, l) => wrap(`<circle cx="50" cy="50" r="47" fill="#0055a5"/><g fill="#fff">${p('#fff', '#0055a5')}</g>`, l),
    warnung: (p, l) => wrap(`<path d="M50 7L94 87H6Z" fill="#ffd400" stroke="#111" stroke-width="5" stroke-linejoin="round"/><g fill="#111" transform="translate(50 64) scale(.55) translate(-50 -50)">${p('#111', '#ffd400')}</g>`, l),
    rettung: (p, l) => wrap(`<rect x="5" y="5" width="90" height="90" rx="7" fill="#00873c"/><g fill="#fff">${p('#fff', '#00873c')}</g>`, l),
    brand: (p, l) => wrap(`<rect x="5" y="5" width="90" height="90" rx="7" fill="#c8102e"/><g fill="#fff">${p('#fff', '#c8102e')}</g>`, l),
    ghs: (p, l) => wrap(`<path d="M50 5L95 50L50 95L5 50Z" fill="#fff" stroke="#c8102e" stroke-width="9" stroke-linejoin="miter"/><g fill="#111" transform="translate(50 50) scale(.78) translate(-50 -50)">${p('#111', '#fff')}</g>`, l)
  };

  /* ===== Sicherheitszeichen ===== */
  const cats = ['Zeichen', 'Brandschutz', 'Gefahrstoffe', 'Gefährdungsbeurteilung', 'PSA', 'Erste Hilfe'];
  const kat = {
    verbot: { name: 'Verbotszeichen', form: 'rund', farbe: 'roter Rand und roter Querbalken, schwarzes Symbol auf weißem Grund', sinn: 'verbietet ein Verhalten, das Gefahr verursacht' },
    gebot: { name: 'Gebotszeichen', form: 'rund', farbe: 'blauer Grund, weißes Symbol', sinn: 'schreibt ein bestimmtes Verhalten vor, z. B. Schutzausrüstung tragen' },
    warnung: { name: 'Warnzeichen', form: 'dreieckig', farbe: 'gelber Grund, schwarzer Rand, schwarzes Symbol', sinn: 'warnt vor einer Gefahr' },
    rettung: { name: 'Rettungszeichen', form: 'rechteckig oder quadratisch', farbe: 'grüner Grund, weißes Symbol', sinn: 'zeigt Rettungswege, Erste Hilfe und Sammelstellen' },
    brand: { name: 'Brandschutzzeichen', form: 'rechteckig oder quadratisch', farbe: 'roter Grund, weißes Symbol', sinn: 'zeigt Brandschutzeinrichtungen und Löschgeräte' }
  };
  const sg = (id, k, name, bed, pic) => ({ id, kat: k, name, bed, svg: BASE[k](PIC[pic], name) });
  const signs = [
    sg('v_rauchen', 'verbot', 'Rauchen verboten', 'Hier darf nicht geraucht werden, z. B. wegen Brandgefahr.', 'rauchen'),
    sg('v_feuer', 'verbot', 'Keine offene Flamme', 'Feuer, offenes Licht und Zündquellen sind verboten, z. B. dort, wo brennbare Stoffe lagern.', 'feuer'),
    sg('v_zutritt', 'verbot', 'Zutritt für Unbefugte verboten', 'Nur befugte Personen dürfen den Bereich betreten.', 'zutritt'),
    sg('v_wasser', 'verbot', 'Mit Wasser löschen verboten', 'Ein Brand darf hier nicht mit Wasser gelöscht werden, z. B. wegen elektrischer Anlagen oder Stoffen, die mit Wasser reagieren.', 'wasser'),
    sg('v_stapler', 'verbot', 'Für Flurförderzeuge verboten', 'Stapler und andere Flurförderzeuge dürfen hier nicht fahren.', 'stapler'),
    sg('v_handy', 'verbot', 'Mobiltelefone verboten', 'Handys sind hier ausgeschaltet zu lassen oder dürfen nicht mitgeführt werden.', 'handy'),
    sg('g_augen', 'gebot', 'Augenschutz benutzen', 'Hier muss eine Schutzbrille oder ein Gesichtsschutz getragen werden.', 'augen'),
    sg('g_gehoer', 'gebot', 'Gehörschutz benutzen', 'Im Lärmbereich muss Gehörschutz getragen werden.', 'gehoer'),
    sg('g_hand', 'gebot', 'Schutzhandschuhe benutzen', 'Hier müssen passende Schutzhandschuhe getragen werden.', 'handschuh'),
    sg('g_helm', 'gebot', 'Schutzhelm benutzen', 'Hier besteht Gefahr durch herabfallende Teile; ein Schutzhelm ist Pflicht.', 'helm'),
    sg('g_fuss', 'gebot', 'Fußschutz benutzen', 'Hier müssen Sicherheitsschuhe getragen werden.', 'fuss'),
    sg('g_atem', 'gebot', 'Atemschutz benutzen', 'Hier muss geeigneter Atemschutz getragen werden, z. B. bei Staub oder Dämpfen.', 'atem'),
    sg('w_strom', 'warnung', 'Warnung vor elektrischer Spannung', 'Es besteht Gefahr durch Strom, z. B. an Schaltschränken und Verteilern.', 'blitz'),
    sg('w_heiss', 'warnung', 'Warnung vor heißer Oberfläche', 'Die Oberfläche kann heiß sein: Verbrennungsgefahr, z. B. Lötkolben, Heizplatte.', 'heiss'),
    sg('w_stapler', 'warnung', 'Warnung vor Flurförderzeugen', 'Hier fahren Stapler oder andere Flurförderzeuge: Vorsicht beim Kreuzen.', 'stapler'),
    sg('w_rutsch', 'warnung', 'Warnung vor Rutschgefahr', 'Der Boden kann nass, glatt oder verschmutzt sein.', 'rutsch'),
    sg('w_stolper', 'warnung', 'Warnung vor Hindernissen am Boden', 'Stolpergefahr durch Gegenstände oder Stufen im Weg.', 'stolper'),
    sg('w_gift', 'warnung', 'Warnung vor giftigen Stoffen', 'Hier können giftige Stoffe auftreten oder gelagert sein.', 'gift'),
    sg('w_feuer', 'warnung', 'Warnung vor feuergefährlichen Stoffen', 'Hier lagern oder arbeiten leicht entzündbare Stoffe: keine Zündquellen.', 'feuer'),
    sg('r_notausgang', 'rettung', 'Notausgang', 'Kennzeichnet einen Ausgang, der im Notfall als Fluchtweg dient. Er muss frei bleiben.', 'notausgang'),
    sg('r_erstehilfe', 'rettung', 'Erste Hilfe', 'Hier gibt es Erste-Hilfe-Material, z. B. den Verbandkasten.', 'erstehilfe'),
    sg('r_sammel', 'rettung', 'Sammelstelle', 'Hierhin gehen alle Personen nach der Räumung des Gebäudes. Dort wird die Vollzähligkeit geprüft.', 'sammel'),
    sg('r_augen', 'rettung', 'Augenspüleinrichtung', 'Hier kann man sich bei Verätzungen oder Fremdkörpern die Augen spülen.', 'augendusche'),
    sg('r_notruf', 'rettung', 'Notruftelefon', 'Hier befindet sich ein Telefon für den Notruf.', 'notruf'),
    sg('b_loescher', 'brand', 'Feuerlöscher', 'Hier hängt ein Feuerlöscher.', 'loescher'),
    sg('b_melder', 'brand', 'Brandmelder (Handfeuermelder)', 'Hier kann ein Brand von Hand gemeldet werden (Alarm auslösen).', 'melder'),
    sg('b_schlauch', 'brand', 'Löschschlauch', 'Hier befindet sich ein Wandhydrant bzw. Löschschlauch zur Brandbekämpfung.', 'schlauch')
  ];

  /* ===== GHS-Piktogramme ===== */
  const gh = (id, name, bed, bsp, pic) => ({ id, name, bed, bsp, svg: BASE.ghs(PIC[pic], id + ' ' + name) });
  /* PRUEFEN: Beispiele sind typische Stoffe; Einstufung immer nach Etikett und Sicherheitsdatenblatt */
  const ghs = [
    gh('GHS01', 'Explodierende Bombe', 'Explosionsgefährlich', 'z. B. Feuerwerk, Munition', 'bombe'),
    gh('GHS02', 'Flamme', 'Entzündbar', 'z. B. Benzin, Aceton, Spiritus', 'feuer'),
    gh('GHS03', 'Flamme über Kreis', 'Brandfördernd (oxidierend): fördert einen Brand', 'z. B. Sauerstoff, konzentriertes Wasserstoffperoxid', 'brandfoerd'),
    gh('GHS04', 'Gasflasche', 'Gas unter Druck', 'z. B. Gasflaschen mit Propan oder Sauerstoff', 'gas'),
    gh('GHS05', 'Ätzwirkung', 'Ätzend für Haut und Augen, kann Metalle angreifen', 'z. B. Säuren, Laugen, Rohrreiniger', 'aetz'),
    gh('GHS06', 'Totenkopf mit gekreuzten Knochen', 'Akut giftig: schon kleine Mengen können lebensgefährlich sein', 'z. B. Methanol, Cyanide', 'totenkopf'),
    gh('GHS07', 'Ausrufezeichen', 'Reizend oder gesundheitsschädlich (Achtung)', 'z. B. manche Reiniger, Isopropanol', 'ausruf'),
    gh('GHS08', 'Gesundheitsgefahr', 'Schwere Langzeitschäden möglich, z. B. krebserzeugend, erbgutverändernd, Organschäden', 'z. B. Benzol, Toluol', 'gesund'),
    gh('GHS09', 'Umwelt', 'Gewässergefährdend (giftig für Wasserlebewesen)', 'z. B. Heizöl, Schädlingsbekämpfungsmittel', 'umwelt')
  ];
  const signal = [
    { w: 'Gefahr', t: 'für die schwerwiegenderen Gefahrenkategorien' },
    { w: 'Achtung', t: 'für die weniger schwerwiegenden Gefahrenkategorien' }
  ];

  /* ===== Brandschutz ===== */
  const brand = [
    { k: 'A', name: 'feste Stoffe', bsp: 'Holz, Papier, Pappe, Textilien', hint: 'brennen meist mit Flamme und Glut' },
    { k: 'B', name: 'flüssige oder flüssig werdende Stoffe', bsp: 'Benzin, Lösemittel, Spiritus, Wachs, Lack', hint: 'Lösemittel und Benzin sind leicht entzündbar' },
    { k: 'C', name: 'Gase', bsp: 'Propan, Erdgas, Acetylen, Wasserstoff', hint: 'erst die Gaszufuhr absperren, dann löschen' },
    { k: 'D', name: 'Metalle', bsp: 'Magnesium, Natrium, Aluminiumpulver', hint: 'brennen mit sehr hoher Temperatur; Wasser ist lebensgefährlich' },
    { k: 'F', name: 'Speiseöle und -fette', bsp: 'Frittierfett, Bratöl in Fritteuse oder Pfanne', hint: 'Wasser löst eine Fettexplosion aus' }
  ];
  const mittel = [
    { id: 'wasser', name: 'Wasser' }, { id: 'schaum', name: 'Schaum' }, { id: 'pulver', name: 'Pulver (ABC)' },
    { id: 'co2', name: 'Kohlendioxid (CO₂)' }, { id: 'fett', name: 'Fettbrandlöscher' }, { id: 'metall', name: 'Metallbrandpulver' }
  ];
  /* ja = geeignet, bed = nur bedingt (Entstehungsbrand), nein = ungeeignet oder gefährlich; Spalte "strom" = elektrische Anlagen unter Spannung */
  const matrix = {
    wasser: { A: 'ja', B: 'nein', C: 'nein', D: 'nein', F: 'nein', strom: 'nein' },
    schaum: { A: 'ja', B: 'ja', C: 'nein', D: 'nein', F: 'nein', strom: 'nein' },
    pulver: { A: 'ja', B: 'ja', C: 'ja', D: 'nein', F: 'nein', strom: 'ja' },
    co2: { A: 'bed', B: 'ja', C: 'nein', D: 'nein', F: 'nein', strom: 'ja' },
    fett: { A: 'nein', B: 'nein', C: 'nein', D: 'nein', F: 'ja', strom: 'nein' },
    metall: { A: 'nein', B: 'nein', C: 'nein', D: 'ja', F: 'nein', strom: 'nein' }
  };
  const grund = {
    wasser: 'Wasser nur bei festen Stoffen (A). Bei Fett, Metall und Strom nie.',
    schaum: 'Schaum für feste und flüssige Stoffe (A, B); enthält Wasser, daher nicht bei Strom.',
    pulver: 'ABC-Pulver löscht A, B und C und ist bei elektrischen Anlagen möglich; es richtet aber große Schäden an Geräten an.',
    co2: 'CO₂ leitet keinen Strom, hinterlässt keine Rückstände; gut für B und elektrische Anlagen, bei A nur kleine Entstehungsbrände.',
    fett: 'Nur der Fettbrandlöscher (F) kühlt und erstickt brennendes Fett sicher.',
    metall: 'Nur Spezialpulver für Metallbrände (D) ist geeignet.'
  };
  const brandMaterial = [
    { t: 'ein Papierstapel', k: 'A' }, { t: 'ein Holzregal', k: 'A' }, { t: 'Pappkartons im Lager', k: 'A' }, { t: 'Textilien', k: 'A' },
    { t: 'Benzin', k: 'B' }, { t: 'Spiritus', k: 'B' }, { t: 'ein Lösemittel (Aceton)', k: 'B' }, { t: 'Wachs', k: 'B' },
    { t: 'Propangas aus einer Gasflasche', k: 'C' }, { t: 'Erdgas', k: 'C' }, { t: 'Acetylen', k: 'C' },
    { t: 'Magnesiumspäne', k: 'D' }, { t: 'Natrium', k: 'D' },
    { t: 'Frittierfett in der Fritteuse', k: 'F' }, { t: 'Bratöl in der Pfanne', k: 'F' }
  ];

  /* ===== STOP-Prinzip ===== */
  const stop = {
    S: { name: 'Substitution', text: 'Gefahr beseitigen oder ersetzen, z. B. gefährlichen Stoff durch weniger gefährlichen ersetzen, leiseres Gerät kaufen.' },
    T: { name: 'Technische Maßnahmen', text: 'Gefahr an der Quelle abschirmen, z. B. Schutzeinrichtung, Absaugung, Hebehilfe.' },
    O: { name: 'Organisatorische Maßnahmen', text: 'Abläufe und Regeln, z. B. Unterweisung, Betriebsanweisung, Pausen, Zutrittsregeln.' },
    P: { name: 'Persönliche Maßnahmen', text: 'Persönliche Schutzausrüstung (PSA), z. B. Schutzbrille, Gehörschutz. Sie kommt zuletzt.' }
  };

  /* ===== Mini-Gefährdungsbeurteilung ===== */
  const o = (id, t, s, ok, amb) => (amb ? { id, t, stop: s, ok, amb: true } : { id, t, stop: s, ok });
  const gb = {
    buero: {
      id: 'buero', name: 'Büro-Arbeitsplatz', intro: 'Ein Bildschirmarbeitsplatz im Büro der Ausbildungsabteilung.',
      gef: [
        { id: 'g1', k: 'Zwangshaltung', t: 'Langes Sitzen und Bildschirmarbeit: Rücken-, Nacken- und Augenbeschwerden.', req: ['T', 'O'], opts: [
          o('a', 'Höhenverstellbarer Tisch und Stuhl; Bildschirm blendfrei und in richtiger Höhe aufstellen', 'T', true),
          o('b', 'Haltung regelmäßig wechseln, kurze Pausen einlegen; Unterweisung zur Einstellung des Arbeitsplatzes', 'O', true),
          o('c', 'Mehrere Stunden ohne Unterbrechung durcharbeiten, dann ist man schneller fertig', 'O', false),
          o('d', 'Bildschirm vor das Fenster stellen, damit man nach draußen sieht', 'T', false)] },
        { id: 'g2', k: 'Stolpern über Kabel', t: 'Kabel und Taschen liegen im Gang: Stolper- und Sturzgefahr.', req: ['T', 'O'], opts: [
          o('a', 'Kabelkanäle oder Kabelbrücken verwenden, Steckdosen am Arbeitsplatz einplanen', 'T', true),
          o('b', 'Verkehrswege frei halten, Taschen nicht im Gang abstellen', 'O', true),
          o('c', 'Kabel quer über den Gang legen, dann stört es am Tisch nicht', 'T', false)] },
        { id: 'g3', k: 'Elektrische Gefährdung', t: 'Defekte Geräte, beschädigte Kabel oder überlastete Steckdosenleisten: Stromschlag und Brand.', req: ['T', 'O'], opts: [
          o('a', 'Ausreichend Steckdosen installieren, Steckdosenleisten nicht hintereinander schalten', 'T', true),
          o('b', 'Elektrische Geräte regelmäßig durch eine Elektrofachkraft prüfen lassen', 'O', true),
          o('c', 'Defekte Geräte sofort melden und außer Betrieb nehmen', 'O', true),
          o('d', 'Mehrere Steckdosenleisten hintereinander stecken, damit alles passt', 'T', false),
          o('e', 'Ein beschädigtes Kabel mit Klebeband flicken und weiterbenutzen', 'O', false)] },
        { id: 'g4', k: 'Brand und Flucht', t: 'Brand im Büro; Fluchtwege oder Brandschutztüren sind blockiert.', req: ['T', 'O'], opts: [
          o('a', 'Brandmelder, gekennzeichnete Feuerlöscher und Fluchtwegschilder', 'T', true, true),
          o('b', 'Fluchtwege freihalten; Unterweisung und Räumungsübung; Brandschutzhelfer benennen', 'O', true),
          o('c', 'Brandschutztür mit einem Keil offen halten, weil es praktisch ist', 'O', false),
          o('d', 'Feuerlöscher hinter Kartons stellen, damit der Flur ordentlich aussieht', 'O', false)] }
      ]
    },
    bohr: {
      id: 'bohr', name: 'Ständerbohrmaschine (Werkstatt)', intro: 'Eine Ständerbohrmaschine in der Lehrwerkstatt; Azubis bohren Bleche und Profile.',
      gef: [
        { id: 'g1', k: 'Werkstück wird erfasst', t: 'Das Werkstück wird vom Bohrer erfasst und herumgeschleudert (Quetsch- und Schnittgefahr).', req: ['T', 'O'], opts: [
          o('a', 'Werkstück im Maschinenschraubstock oder mit Spannmitteln festspannen', 'T', true),
          o('b', 'Unterweisung: Das Werkstück nie mit der Hand festhalten', 'O', true),
          o('c', 'Das Werkstück mit der Hand festhalten, das geht schneller', 'O', false),
          o('d', 'Dicke Handschuhe tragen, damit nichts passiert', 'P', false),
          o('e', 'Schutzbrille tragen', 'P', true)] },
        { id: 'g2', k: 'Einzug von Haaren und Kleidung', t: 'Haare, Ärmel, Schmuck oder Schal geraten an die drehende Spindel (Einzugsgefahr).', req: ['T', 'O'], opts: [
          o('a', 'Bohrfutterschutz benutzen und nicht entfernen', 'T', true),
          o('b', 'Unterweisung: Lange Haare zusammenbinden, keinen Schmuck oder Schal tragen', 'O', true),
          o('c', 'Eng anliegende Arbeitskleidung tragen', 'P', true, true),
          o('d', 'Schutzhandschuhe an der drehenden Maschine tragen', 'P', false),
          o('e', 'Den Bohrfutterschutz abnehmen, wenn er stört', 'T', false)] },
        { id: 'g3', k: 'Späne und Splitter', t: 'Späne und Splitter fliegen ins Gesicht oder schneiden die Hände.', req: ['T', 'O', 'P'], opts: [
          o('a', 'Spanschutz bzw. Schutzscheibe an der Maschine', 'T', true),
          o('b', 'Schutzbrille tragen', 'P', true),
          o('c', 'Späne nur bei Stillstand mit Handfeger oder Spänehaken entfernen', 'O', true),
          o('d', 'Späne mit der Hand wegwischen, während die Maschine läuft', 'O', false)] },
        { id: 'g4', k: 'Unbeabsichtigter Anlauf', t: 'Die Maschine läuft unerwartet an oder lässt sich im Notfall nicht schnell stoppen.', req: ['T', 'O'], opts: [
          o('a', 'Not-Halt-Taster gut erreichbar und funktionsfähig', 'T', true),
          o('b', 'Schutzeinrichtungen überbrücken, damit es schneller geht', 'T', false),
          o('c', 'Sichtprüfung vor Arbeitsbeginn; defekte Maschine melden und nicht benutzen', 'O', true),
          o('d', 'Bei einer Störung die Maschine selbst reparieren', 'O', false),
          o('e', 'Unterweisung vor der ersten Benutzung: Bedienung und Not-Halt', 'O', true)] }
      ]
    },
    lager: {
      id: 'lager', name: 'Lager mit Flurförderzeug', intro: 'Ein Lager mit Regalen, Paletten und einem Gegengewichtsstapler.',
      gef: [
        { id: 'g1', k: 'Zusammenstoß mit Stapler', t: 'Fußgänger und Stapler begegnen sich im Fahrweg (Anfahr- und Quetschgefahr).', req: ['T', 'O', 'P'], opts: [
          o('a', 'Getrennte, markierte Fußgänger- und Fahrwege; Warnleuchte oder Warnsignal am Stapler', 'T', true, true),
          o('b', 'Nur unterwiesene und beauftragte Personen fahren; angepasste Geschwindigkeit', 'O', true),
          o('c', 'Warnweste tragen', 'P', true),
          o('d', 'Fahrwege als Ablage für Paletten nutzen', 'O', false),
          o('e', 'Beim Staplerfahren Kopfhörer mit Musik tragen', 'O', false)] },
        { id: 'g2', k: 'Herabfallende Ladung', t: 'Ladung oder Regalteile fallen herab.', req: ['T', 'O', 'P'], opts: [
          o('a', 'Tragfähigkeitsangaben am Regal und Anfahrschutz', 'T', true, true),
          o('b', 'Ladung sichern, Palette nicht überladen; Regale regelmäßig prüfen lassen', 'O', true),
          o('c', 'Sicherheitsschuhe tragen', 'P', true),
          o('d', 'Paletten über die zulässige Tragfähigkeit beladen, solange es hält', 'O', false),
          o('e', 'Ein beschädigtes Regal weiterbenutzen, bis Ersatz da ist', 'O', false)] },
        { id: 'g3', k: 'Heben und Tragen', t: 'Schwere Lasten werden von Hand gehoben oder getragen (Rückenbelastung).', req: ['T', 'O'], opts: [
          o('a', 'Schwere Teile in kleineren Verpackungseinheiten bestellen', 'S', true),
          o('b', 'Hubwagen, Hubtisch oder Kran als Hebehilfe bereitstellen', 'T', true),
          o('c', 'Unterweisung: rückenschonend heben, schwere Lasten zu zweit tragen', 'O', true),
          o('d', 'Alles allein tragen, das ist schneller', 'O', false)] },
        { id: 'g4', k: 'Stolpern und Rutschen', t: 'Stolpern über Ware, Ausrutschen auf Nässe oder Öl.', req: ['T', 'O', 'P'], opts: [
          o('a', 'Rutschhemmender Bodenbelag und gute Beleuchtung', 'T', true),
          o('b', 'Verkehrswege freihalten; Verschüttetes sofort aufnehmen oder absichern', 'O', true),
          o('c', 'Sicherheitsschuhe mit rutschhemmender Sohle', 'P', true),
          o('d', 'Ware vorübergehend im Gang abstellen', 'O', false),
          o('e', 'Verschüttetes Öl mit einem Karton abdecken und weiterarbeiten', 'O', false)] }
      ]
    },
    server: {
      id: 'server', name: 'Serverraum', intro: 'Ein Serverraum mit Racks, Klimageräten und einer unterbrechungsfreien Stromversorgung (USV).',
      gef: [
        { id: 'g1', k: 'Brand', t: 'Brand durch Überlast oder Defekt an elektrischen Geräten und Leitungen.', req: ['T', 'O'], opts: [
          o('a', 'Brandmeldeanlage und ein für elektrische Anlagen geeigneter Feuerlöscher (z. B. CO₂)', 'T', true),
          o('b', 'Keine Kartons oder Verpackungen im Raum lagern; Brandschutzunterweisung', 'O', true),
          o('c', 'Einen Wasserlöscher bereitstellen', 'T', false),
          o('d', 'Die Brandschutztür des Raums offen verkeilen', 'O', false)] },
        { id: 'g2', k: 'Lärm', t: 'Lüfter und Klimageräte erzeugen hohen Dauerschall.', req: ['T', 'O', 'P'], opts: [
          o('a', 'Leisere Geräte und Lüfter beschaffen', 'S', true),
          o('b', 'Geräte in schalldämmenden Schränken aufstellen', 'T', true),
          o('c', 'Aufenthaltsdauer im Raum begrenzen; Lärmbereich kennzeichnen', 'O', true),
          o('d', 'Gehörschutz tragen', 'P', true),
          o('e', 'Nichts tun, man gewöhnt sich daran', 'O', false)] },
        { id: 'g3', k: 'Elektrische Anlagen', t: 'Offene Verteiler oder Racks: Stromschlag und Kurzschluss.', req: ['T', 'O'], opts: [
          o('a', 'Verteiler und Racks verschlossen halten, Abdeckungen und Berührungsschutz', 'T', true),
          o('b', 'Arbeiten an Elektroanlagen nur durch Elektrofachkräfte; Zutritt nur für Berechtigte', 'O', true),
          o('c', 'Abdeckungen im Betrieb entfernen, damit man besser herankommt', 'T', false),
          o('d', 'Bei einer Störung als Azubi selbst Kabel im Verteiler umstecken', 'O', false)] },
        { id: 'g4', k: 'Heben schwerer Geräte', t: 'Server und USV-Akkus sind schwer; beim Einbau droht Rückenschaden oder Quetschen.', req: ['T', 'O', 'P'], opts: [
          o('a', 'Serverlift oder Hubwagen als Hebehilfe', 'T', true),
          o('b', 'Schwere Geräte zu zweit einbauen; Gewichte kennzeichnen', 'O', true),
          o('c', 'Sicherheitsschuhe tragen', 'P', true),
          o('d', 'Schwere Geräte allein über Kopfhöhe ins Rack heben', 'O', false)] }
      ]
    }
  };
  const gbOrder = ['buero', 'bohr', 'lager', 'server'];

  /* ===== PSA je Tätigkeit ===== */
  const psaItems = {
    augen: 'Augenschutz (Schutzbrille, Gesichtsschutz)', gehoer: 'Gehörschutz', hand: 'Schutzhandschuhe (allgemein)',
    chem: 'Chemikalienschutzhandschuhe', atem: 'Atemschutz (Staubmaske)', fuss: 'Sicherheitsschuhe', warn: 'Warnweste', kopf: 'Schutzhelm'
  };
  /* req = Pflicht bzw. dringend nötig, empf = üblich/empfohlen (wird in Aufgaben nicht als falsch gewertet), nein = hier ungeeignet oder gefährlich */
  const psa = [
    { id: 'schleifen', t: 'Schleifen an der Schleifmaschine', req: ['augen', 'gehoer', 'atem'], empf: [], nein: ['warn', 'chem'], note: 'Atemschutz bei Staubentwicklung, wenn die Absaugung nicht ausreicht. Keine Handschuhe, wenn Teile rotieren und einziehen können.', gen: true },
    { id: 'loeten', t: 'Löten', req: ['augen'], empf: [], nein: ['warn', 'kopf'], note: 'Lötdämpfe zuerst absaugen (technische Maßnahme), danach Schutzbrille gegen Spritzer. /* PRUEFEN: Schutzbrille beim Weichlöten ist üblich, nicht in jedem Betrieb Pflicht */', gen: false },
    { id: 'loesemittel', t: 'Umgang mit Lösemittel', req: ['chem', 'augen'], empf: ['atem'], nein: ['warn', 'kopf'], note: 'Handschuhmaterial nach Sicherheitsdatenblatt und Betriebsanweisung wählen. Zuerst lüften bzw. absaugen.', gen: true },
    { id: 'stapler', t: 'Stapler fahren', req: ['fuss'], empf: ['warn'], nein: ['chem', 'atem'], note: 'Nur beauftragte und unterwiesene Personen. Sicherheitsschuhe; Warnkleidung in Verkehrsbereichen.', gen: true },
    { id: 'laerm', t: 'Arbeit im Lärmbereich', req: ['gehoer'], empf: [], nein: ['warn', 'chem'], note: 'Gehörschutz wird ab 80 dB(A) zur Verfügung gestellt und ist ab 85 dB(A) Pflicht (Lärmbereich ist mit dem Gebotszeichen gekennzeichnet).', gen: true },
    { id: 'bohren', t: 'Arbeit an der Ständerbohrmaschine', req: ['augen'], empf: ['fuss'], nein: ['hand', 'warn'], note: 'An drehenden Werkzeugen keine Handschuhe, keinen Schmuck, keine offenen Haare: Einzugsgefahr.', gen: true }
  ];

  /* ===== Aufgaben ===== */
  const T = (id, cat, level, title, text, choices, correct, tips, expl, extra) => Object.assign({ id, cat, level, title, text, choices, correct, tips, expl }, extra || {});
  const sc = ids => ids.map(s => ({ s }));
  const tasks = [
    T('arb1', 'Zeichen', 1, 'Gelbes Dreieck', 'Dieses Schild hängt am Schaltschrank. Zu welcher Gruppe von Sicherheitszeichen gehört es?', ['Verbotszeichen', 'Gebotszeichen', 'Warnzeichen', 'Rettungszeichen'], 2,
      ['Achte auf die Form: ein Dreieck.', 'Dreieckig mit gelbem Grund und schwarzem Rand heißt: Das Schild warnt vor einer Gefahr.'], 'Warnzeichen sind dreieckig, gelb mit schwarzem Rand und schwarzem Symbol. Dieses Schild warnt vor elektrischer Spannung.', { sign: 'w_strom' }),
    T('arb2', 'Zeichen', 1, 'Blaues rundes Schild', 'Was bedeutet dieses Schild?', ['Augenschutz benutzen', 'Hier ist die Augenspüleinrichtung', 'Brillen sind verboten', 'Warnung vor Augenreizung'], 0,
      ['Blau und rund: Das ist eine Vorschrift.', 'Ein Gebot sagt dir, was du tun musst. Das Symbol zeigt eine Schutzbrille.'], 'Blaue runde Zeichen sind Gebote. Hier gilt: Augenschutz benutzen, also Schutzbrille tragen.', { sign: 'g_augen' }),
    T('arb3', 'Zeichen', 2, 'Mit Wasser löschen verboten', 'Welches Schild bedeutet „Mit Wasser löschen verboten“?', sc(['b_loescher', 'v_wasser', 'w_feuer', 'v_feuer']), 1,
      ['Ein Verbot ist rund mit rotem Rand und rotem Querbalken.', 'Zwei Schilder sind rund: Eins zeigt nur eine Flamme, das andere Wassertropfen und Flamme.'], 'Es ist ein Verbotszeichen: rund, rot umrandet, mit Querbalken. Das Symbol zeigt Wassertropfen und Flamme.'),
    T('arb4', 'Zeichen', 2, 'Rotes Quadrat mit Feuerlöscher', 'Zu welcher Gruppe gehört dieses Schild?', ['Verbotszeichen', 'Brandschutzzeichen', 'Warnzeichen', 'Gebotszeichen'], 1,
      ['Rot bedeutet nicht automatisch „verboten“. Achte auf die Form.', 'Verbote sind rund. Brandschutzzeichen sind quadratisch oder rechteckig, rot mit weißem Symbol.'], 'Brandschutzzeichen sind rot mit weißem Symbol und quadratisch oder rechteckig. Sie zeigen Löschgeräte und Meldeeinrichtungen.', { sign: 'b_loescher' }),
    T('arb5', 'Zeichen', 2, 'Grünes Schild mit Pfeilen', 'Der Feueralarm ertönt und du siehst dieses Schild. Was bedeutet es und was tust du?', ['Sammelstelle: Ich gehe dorthin und melde mich dort', 'Notausgang: Ich laufe durch die Tür', 'Erste Hilfe: Hier ist der Verbandkasten', 'Gefahr: Ich meide den Bereich'], 0,
      ['Grün steht für Rettung.', 'Vier Pfeile zeigen aufeinander zu: Hier sammeln sich die Personen nach der Räumung.'], 'Die Sammelstelle ist der Ort, an dem nach der Räumung die Vollzähligkeit geprüft wird. Niemand geht ohne Meldung zurück ins Gebäude.', { sign: 'r_sammel' }),
    T('arb6', 'Brandschutz', 1, 'Brandklasse A', 'Ein Papierstapel brennt. Zu welcher Brandklasse gehört der Brand?', ['A (feste Stoffe)', 'B (flüssige Stoffe)', 'C (Gase)', 'F (Speiseöle und -fette)'], 0,
      ['Papier ist ein fester Stoff.', 'A ist der erste Buchstabe und steht für feste Stoffe wie Holz, Papier, Textilien.'], 'Papier, Holz, Pappe und Textilien sind feste Stoffe: Brandklasse A.'),
    T('arb7', 'Brandschutz', 1, 'Notruf', 'Welche Notrufnummer gilt in Deutschland und Europa für Feuerwehr und Rettungsdienst?', ['110', '112', '115', '116 117'], 1,
      ['Die Nummer gilt europaweit.', 'Die 110 ist die Polizei.'], 'Die 112 ist der europaweite Notruf für Feuerwehr und Rettungsdienst. Die 110 erreicht die Polizei.'),
    T('arb8', 'Brandschutz', 2, 'Fettbrand', 'In der Küche brennt Fett in einer Pfanne. Welche Reaktion ist lebensgefährlich?', ['Deckel oder Löschdecke auflegen', 'Mit Wasser ablöschen', 'Herd abschalten, wenn das gefahrlos geht', 'Fettbrandlöscher einsetzen'], 1,
      ['Drei Maßnahmen ersticken oder kühlen das Fett.', 'Wasser ist schwerer als Fett und verdampft sofort.'], 'Wasser verdampft schlagartig im heißen Fett und schleudert brennendes Fett als Stichflamme in den Raum (Fettexplosion). Fettbrände werden erstickt oder mit dem Fettbrandlöscher gelöscht.'),
    T('arb9', 'Brandschutz', 2, 'Brand im Schaltschrank', 'Ein Schaltschrank unter Spannung brennt. Welcher Löscher ist geeignet?', ['Wasserlöscher', 'Schaumlöscher', 'CO₂-Löscher', 'Fettbrandlöscher'], 2,
      ['Strom und Wasser vertragen sich nicht.', 'Gesucht ist ein Löschmittel, das keinen Strom leitet und keine Rückstände hinterlässt.'], 'CO₂ leitet keinen Strom. Wasser und Schaum enthalten Wasser. Auch Pulver wäre möglich, richtet aber große Schäden an Geräten an. Wenn es gefahrlos geht, zuerst Strom abschalten.'),
    T('arb10', 'Brandschutz', 2, 'Metallbrand', 'Magnesiumspäne an der Drehmaschine brennen. Was ist geeignet?', ['Wasser', 'Schaum', 'Metallbrandpulver (Klasse D)', 'Fettbrandlöscher'], 2,
      ['Brennendes Metall ist sehr heiß und reagiert mit vielen Löschmitteln.', 'Wasser und Schaum (enthält Wasser) scheiden aus. Gesucht ist ein Spezialmittel.'], 'Brennende Metalle (Klasse D) löscht man nur mit Spezialpulver für Metallbrände. Wasser reagiert heftig und kann die Lage verschlimmern.'),
    T('arb11', 'Brandschutz', 3, 'Verhalten im Brandfall', 'Wie lautet die richtige Reihenfolge im Brandfall?', ['Ruhe bewahren, Brand melden, in Sicherheit bringen, Löschversuch', 'Löschversuch, Brand melden, Ruhe bewahren, in Sicherheit bringen', 'Brand melden, Löschversuch, Ruhe bewahren, in Sicherheit bringen', 'In Sicherheit bringen, Löschversuch, Brand melden, Ruhe bewahren'], 0,
      ['Zuerst der Kopf: erst nachdenken, dann handeln.', 'Menschen gehen vor Sachen. Gelöscht wird nur, wenn es ohne Gefahr geht.'], 'Ruhe bewahren, Brand melden (Alarm, 112), Menschen und dich in Sicherheit bringen, Löschversuch nur ohne Eigengefahr. Türen schließen, keinen Aufzug benutzen.'),
    T('arb12', 'Gefahrstoffe', 1, 'Flamme auf dem Etikett', 'Dieses Piktogramm ist auf einem Spiritus-Kanister. Was bedeutet es?', ['Entzündbar', 'Ätzend', 'Akut giftig', 'Gewässergefährdend'], 0,
      ['Das Symbol zeigt eine Flamme.', 'Spiritus brennt leicht. Das Piktogramm warnt davor.'], 'GHS02 (Flamme) kennzeichnet entzündbare Stoffe. Zündquellen fernhalten, nicht rauchen.', { sign: 'GHS02' }),
    T('arb13', 'Gefahrstoffe', 1, 'Totenkopf', 'Was bedeutet dieses Piktogramm?', ['Akut giftig: kann lebensgefährlich sein', 'Reizend', 'Brandfördernd', 'Gas unter Druck'], 0,
      ['Es ist eines der ernstesten Piktogramme.', 'Der Totenkopf steht für Giftigkeit.'], 'GHS06 kennzeichnet akut giftige Stoffe. Schon kleine Mengen können beim Verschlucken, Einatmen oder Hautkontakt lebensgefährlich sein.', { sign: 'GHS06' }),
    T('arb14', 'Gefahrstoffe', 2, 'Ausrufezeichen', 'Was bedeutet das Ausrufezeichen im roten Rahmen?', ['Reizend oder gesundheitsschädlich', 'Explosionsgefährlich', 'Krebserzeugend', 'Ätzend'], 0,
      ['Es ist eine weniger schwere Gefahr als Totenkopf oder Gesundheitsgefahr.', 'Typisch sind Reizungen von Haut, Augen und Atemwegen.'], 'GHS07 steht für reizende oder gesundheitsschädliche Stoffe, meist mit dem Signalwort „Achtung“. Krebserzeugend ist GHS08, ätzend GHS05.', { sign: 'GHS07' }),
    T('arb15', 'Gefahrstoffe', 2, 'Signalwörter', 'Welches Signalwort steht auf dem Etikett bei den schwerwiegenderen Gefahren?', ['Gefahr', 'Achtung', 'Warnung', 'Vorsicht'], 0,
      ['Es gibt nur zwei Signalwörter.', 'Das stärkere Wort heißt wie das, wovor es warnt.'], 'Es gibt nur zwei Signalwörter: „Gefahr“ für schwerwiegendere und „Achtung“ für weniger schwerwiegende Gefahren.'),
    T('arb16', 'Gefahrstoffe', 2, 'Sicherheitsdatenblatt', 'Wo findest du ausführliche Angaben zu einem Gefahrstoff, z. B. zu Gefahren, Erster Hilfe und Entsorgung?', ['Im Sicherheitsdatenblatt (SDB)', 'Im Lieferschein', 'Auf der Rechnung', 'Auf dem Palettenaufkleber'], 0,
      ['Das Dokument liefert der Hersteller mit.', 'Es hat 16 Abschnitte, z. B. „Mögliche Gefahren“ und „Erste-Hilfe-Maßnahmen“.'], 'Das Sicherheitsdatenblatt (SDB) beschreibt den Stoff in 16 Abschnitten. Das Etikett zeigt nur die wichtigsten Gefahren mit Piktogrammen, Signalwort sowie H- und P-Sätzen.'),
    T('arb17', 'Gefährdungsbeurteilung', 1, 'Erster Schritt', 'Womit beginnt eine Gefährdungsbeurteilung?', ['Arbeitsbereiche und Tätigkeiten festlegen', 'Maßnahmen umsetzen', 'Wirksamkeit prüfen', 'Ergebnis dokumentieren'], 0,
      ['Man muss zuerst wissen, was man betrachtet.', 'Zuerst legt man fest, welcher Arbeitsbereich und welche Tätigkeit betrachtet werden.'], 'Die Schritte: 1 Bereiche und Tätigkeiten festlegen, 2 Gefährdungen ermitteln, 3 beurteilen, 4 Maßnahmen festlegen, 5 umsetzen, 6 Wirksamkeit prüfen, 7 dokumentieren und fortschreiben.'),
    T('arb18', 'Gefährdungsbeurteilung', 2, 'STOP-Rangfolge', 'Welche Maßnahmengruppe steht bei STOP an letzter Stelle?', ['Persönliche Maßnahmen (PSA)', 'Technische Maßnahmen', 'Substitution', 'Organisatorische Maßnahmen'], 0,
      ['STOP ist eine Rangfolge von vorn nach hinten.', 'Das P steht für die Maßnahmen, die dem Menschen helfen, statt die Gefahr zu beseitigen.'], 'S Substitution, T Technisch, O Organisatorisch, P Persönlich. Gefahr beseitigen geht vor abschirmen, abschirmen vor Regeln, Regeln vor PSA.'),
    T('arb19', 'Gefährdungsbeurteilung', 1, 'Mini-GB: Büro', 'Wähle für jede Gefährdung die passenden Maßnahmen. Prüfe danach.', [], 0, null, 'Im Büro sind technische (Ergonomie, Kabelführung) und organisatorische Maßnahmen die wichtigsten. PSA spielt kaum eine Rolle.', { gb: 'buero' }),
    T('arb20', 'Gefährdungsbeurteilung', 2, 'Mini-GB: Ständerbohrmaschine', 'Wähle für jede Gefährdung die passenden Maßnahmen. Prüfe danach.', [], 0, null, 'Wichtig: Spannen statt halten, Schutzeinrichtungen nie entfernen, keine Handschuhe an drehenden Teilen.', { gb: 'bohr' }),
    T('arb21', 'Gefährdungsbeurteilung', 2, 'Mini-GB: Lager', 'Wähle für jede Gefährdung die passenden Maßnahmen. Prüfe danach.', [], 0, null, 'Im Lager helfen getrennte Wege, sichere Ladung, Hebehilfen und Ordnung. PSA kommt zusätzlich, ersetzt aber keine Technik.', { gb: 'lager' }),
    T('arb22', 'Gefährdungsbeurteilung', 3, 'Mini-GB: Serverraum', 'Wähle für jede Gefährdung die passenden Maßnahmen. Prüfe danach.', [], 0, null, 'Im Serverraum: für Elektrik geeignete Löschmittel, Lärm an der Quelle mindern, Verteiler verschlossen halten, schwer nur mit Hebehilfe.', { gb: 'server' }),
    T('arb23', 'PSA', 1, 'Lärmbereich', 'In einem Bereich ist das blaue Gebotszeichen mit den Ohrenschützern angebracht. Welche PSA gehört dazu?', ['Gehörschutz', 'Schutzbrille', 'Warnweste', 'Atemschutz'], 0,
      ['Das Symbol zeigt es bereits.', 'Es geht um Lärm.'], 'Gehörschutz wird ab 80 dB(A) zur Verfügung gestellt und muss ab 85 dB(A) getragen werden. Der Lärmbereich ist gekennzeichnet.', { sign: 'g_gehoer' }),
    T('arb24', 'PSA', 2, 'Schleifen', 'Du schleifst ein Werkstück an der Schleifmaschine. Wähle alle passenden PSA.', ['Augenschutz (Schutzbrille oder Gesichtsschutz)', 'Gehörschutz', 'Atemschutz bei Staub', 'Warnweste', 'Chemikalienschutzhandschuhe'], [0, 1, 2],
      ['Beim Schleifen fliegen Funken und Partikel, es ist laut und staubig.', 'Drei Gefahren, drei Schutzmittel: Augen, Ohren, Atemwege.'], 'Schleifen bedeutet: Funken und Partikel in die Augen, Lärm, Staub. Warnweste ist für Verkehrsbereiche, Chemikalienhandschuhe für Chemikalien.', { multi: true }),
    T('arb25', 'PSA', 2, 'Ständerbohrmaschine', 'Welche Aussage zur Arbeit an der Ständerbohrmaschine stimmt?', ['Handschuhe schützen vor Spänen und werden deshalb immer getragen', 'An drehenden Teilen werden keine Handschuhe getragen: Einzugsgefahr', 'Lange Haare dürfen offen bleiben, wenn man vorsichtig ist', 'Ein enger Ring ist erlaubt, weil er nicht hängen bleibt'], 1,
      ['Denke an das, was sich dreht.', 'Stoff, Haare und Schmuck können vom Bohrer erfasst werden.'], 'Handschuhe, lose Kleidung, Schmuck und offene Haare können von drehenden Teilen eingezogen werden. Schutzbrille tragen, Späne nur mit Handfeger oder Haken entfernen.'),
    T('arb26', 'PSA', 3, 'Lösemittel', 'Du reinigst ein Teil mit einem Lösemittel. Wähle alle passenden Schutzmaßnahmen.', ['Chemikalienschutzhandschuhe laut Sicherheitsdatenblatt', 'Schutzbrille', 'Gute Lüftung oder Absaugung', 'Normale Stoffhandschuhe', 'Gehörschutz'], [0, 1, 2],
      ['Es geht um Haut, Augen und Dämpfe.', 'Stoffhandschuhe halten Lösemittel nicht ab. Welche Maßnahme hat nach STOP Vorrang vor der PSA?'], 'Lüftung bzw. Absaugung ist eine technische Maßnahme und hat Vorrang. Dazu kommen Schutzbrille und passende Chemikalienhandschuhe. Das Material steht im Sicherheitsdatenblatt.', { multi: true }),
    T('arb27', 'Erste Hilfe', 1, 'Notruf abgeschlossen', 'Du hast den Notruf gewählt und deine Angaben gemacht. Wie geht es weiter?', ['Sofort auflegen, damit die Leitung frei ist', 'Auf Rückfragen warten: Die Leitstelle beendet das Gespräch', 'Erst nach fünf Minuten erneut anrufen', 'Auflegen und zuerst den Ausbilder anrufen'], 1,
      ['Die Leitstelle braucht eventuell weitere Angaben.', 'Wer legt zuerst auf?'], 'Die fünf W: Wo, Was, Wie viele, Welche Verletzungen, Warten auf Rückfragen. Die Leitstelle beendet das Gespräch.'),
    T('arb28', 'Erste Hilfe', 2, 'Verbrennung', 'Du hast dir die Hand an heißem Metall verbrannt. Was ist richtig?', ['Mit Mehl oder Butter einreiben', 'Mit fließendem, lauwarmem Wasser etwa 10 Minuten kühlen', 'Brandblasen aufstechen', 'Eiswürfel direkt auf die Haut drücken'], 1,
      ['Die Haut muss gekühlt werden, aber nicht unterkühlt.', 'Hausmittel und Eis schaden. Es geht um fließendes Wasser, nicht eiskalt.'], 'Verbrannte Stelle sofort mit lauwarmem fließendem Wasser kühlen, danach keimfrei abdecken. Keine Hausmittel, Blasen nicht öffnen. Bei großen Flächen, Gesicht oder Händen Arzt bzw. 112. /* PRUEFEN: Kühldauer und Temperatur */'),
    T('arb29', 'Erste Hilfe', 2, 'Stabile Seitenlage', 'Wann bringst du eine Person in die stabile Seitenlage?', ['Wenn sie bewusstlos ist und normal atmet', 'Wenn sie bewusstlos ist und nicht normal atmet', 'Immer bei Schwindel', 'Wenn sie ansprechbar ist und Schmerzen hat'], 0,
      ['Die Atmung entscheidet.', 'Atmet die Person nicht normal, brauchst du eine andere Maßnahme.'], 'Stabile Seitenlage bei Bewusstlosigkeit mit normaler Atmung. Sie hält die Atemwege frei. Atmet die Person nicht normal: 112 und Wiederbelebung. Dieses Lab ersetzt keinen Erste-Hilfe-Kurs.'),
    T('arb30', 'Erste Hilfe', 3, 'Rettungskette', 'Wie lautet die richtige Reihenfolge der Rettungskette?', ['Sofortmaßnahmen, Notruf, Erste Hilfe, Rettungsdienst, Krankenhaus', 'Notruf, Krankenhaus, Erste Hilfe, Rettungsdienst, Sofortmaßnahmen', 'Erste Hilfe, Krankenhaus, Notruf, Sofortmaßnahmen, Rettungsdienst', 'Rettungsdienst, Notruf, Sofortmaßnahmen, Erste Hilfe, Krankenhaus'], 0,
      ['Am Anfang steht, was du an der Unfallstelle sofort tust (Absichern, Eigenschutz).', 'Danach kommt der Notruf, dann die Erste Hilfe, bis der Rettungsdienst übernimmt.'], 'Die Rettungskette: Sofortmaßnahmen am Unfallort, Notruf, Erste Hilfe, Rettungsdienst, Krankenhaus.')
  ];

  /* Zusätzliche Fragen Erste Hilfe (Trainer und Abschlussrunde) */
  const eh = [
    T('eh1', 'Erste Hilfe', 2, 'Schnittverletzung', 'Eine Schnittwunde blutet stark. Was tust du?', ['Mit Handschuhen schützen, keimfrei abdecken und Druckverband anlegen', 'Die Wunde ausgiebig auswaschen und warten', 'Salbe oder Puder auf die Wunde geben', 'Nichts tun, die Blutung hört von selbst auf'], 0, ['Eigenschutz vor Blut: Handschuhe.', 'Druck auf die Wunde stoppt die Blutung.'], 'Starke Blutung: Handschuhe anziehen (Eigenschutz), Wunde keimfrei abdecken, Druckverband anlegen, bei starker Blutung 112. Salben und Puder gehören nicht auf Wunden.'),
    T('eh2', 'Erste Hilfe', 2, 'Chemikalie im Auge', 'Ein Spritzer Reiniger ist ins Auge gelangt. Was tust du zuerst?', ['Sofort und ausgiebig mit Wasser spülen (Augendusche), dann Arzt', 'Das Auge fest reiben', 'Abwarten, ob es besser wird', 'Augentropfen suchen'], 0, ['Die Chemikalie muss sofort raus.', 'Es gibt dafür eine Einrichtung mit grünem Schild.'], 'Sofort lange mit viel Wasser spülen (Augenspüleinrichtung), dann Augenarzt oder 112. Nicht reiben. /* PRUEFEN: Mindest-Spüldauer nicht genannt */'),
    T('eh3', 'Erste Hilfe', 1, 'Verbandbuch', 'Wo trägst du eine kleine Verletzung ein, die du am Arbeitsplatz erlitten hast?', ['Im Verbandbuch', 'Im Pausenplan', 'Im Gefahrstoffverzeichnis', 'In der Betriebsanweisung'], 0, ['Es gehört zum Verbandkasten.', 'Das Buch hat den Namen des Materials.'], 'Jede Erste-Hilfe-Leistung wird dokumentiert, z. B. im Verbandbuch. Das hilft später bei Versicherungsfragen.'),
    T('eh4', 'Erste Hilfe', 3, 'Keine normale Atmung', 'Eine Person reagiert nicht und atmet nicht normal. Was tust du?', ['112 rufen (lassen) und sofort fest und schnell in die Mitte des Brustkorbs drücken', 'In die stabile Seitenlage bringen', 'Warten, bis jemand Erfahrenes kommt', 'Den Kopf mit Wasser kühlen'], 0, ['Nicht normal atmen heißt: Herz-Kreislauf in Gefahr.', 'Es geht um Wiederbelebung.'], 'Notruf und Herzdruckmassage (Mitte des Brustkorbs, fest und schnell, etwa 100 bis 120 Mal pro Minute), Defibrillator (AED) holen lassen. Ein Erste-Hilfe-Kurs übt das praktisch. /* PRUEFEN: Tiefe und Frequenz */'),
    T('eh5', 'Erste Hilfe', 2, 'Eigenschutz', 'Du kommst zu einem Unfall mit Strom. Was ist zuerst zu tun?', ['Stromkreis unterbrechen (Not-Aus oder Sicherung) bzw. sich selbst schützen', 'Die Person sofort anfassen und wegziehen', 'Mit Wasser löschen', 'Nur zusehen'], 0, ['Zuerst die eigene Sicherheit.', 'Du darfst nicht selbst zum Opfer werden.'], 'Eigenschutz geht vor: erst die Spannung abschalten, dann helfen. Danach Notruf, Erste Hilfe.'),
    T('eh6', 'Erste Hilfe', 1, 'Fünf W', 'Welche Angabe gehört nicht zum Notruf?', ['Wie alt der Chef ist', 'Wo es passiert ist', 'Wie viele Verletzte es gibt', 'Welche Verletzungen vorliegen'], 0, ['Die fünf W-Fragen fragen nach dem Geschehen.', 'Wo, Was, Wie viele, Welche, Warten.'], 'Notruf: Wo ist es passiert, Was ist geschehen, Wie viele Betroffene, Welche Verletzungen, Warten auf Rückfragen.')
  ];

  /* ===== Wissensseiten (Reiter PSA, Erste Hilfe, Verhalten) ===== */
  const seiten = {
    eh: [
      ['⚠ Wichtiger Hinweis', '<p><b>Dieses Lab ersetzt keinen Erste-Hilfe-Kurs.</b> Hier lernst du die Grundgedanken. Wie man richtig drückt, beatmet und verbindet, übt man im Kurs unter Anleitung. Frag deinen Ausbilder nach dem nächsten Termin und nach dem Erst-Helfer im Betrieb.</p>'],
      ['Rettungskette', '<p>Fünf Glieder, die ineinandergreifen:</p><ol><li><b>Sofortmaßnahmen</b> am Unfallort: Eigenschutz, Unfallstelle absichern, Gefahr beseitigen (z. B. Strom abschalten)</li><li><b>Notruf</b> 112</li><li><b>Erste Hilfe</b> leisten</li><li><b>Rettungsdienst</b> übernimmt</li><li><b>Krankenhaus</b></li></ol>'],
      ['Notruf: die fünf W', '<ol><li><b>Wo</b> ist es passiert? (Adresse, Gebäude, Raum)</li><li><b>Was</b> ist geschehen?</li><li><b>Wie viele</b> Betroffene?</li><li><b>Welche</b> Verletzungen oder Erkrankungen?</li><li><b>Warten</b> auf Rückfragen. Die Leitstelle beendet das Gespräch.</li></ol><p>Die Nummer <b>112</b> gilt für Feuerwehr und Rettungsdienst, der Anruf ist kostenlos.</p>'],
      ['Stabile Seitenlage (Kurzablauf)', '<p>Nur bei <b>Bewusstlosigkeit mit normaler Atmung</b>.</p><ol><li>Ansprechen und an den Schultern rütteln: keine Reaktion?</li><li>Atmung prüfen: Kopf nackenwärts neigen, Kinn anheben, hören, sehen, fühlen</li><li>Atmet normal: Brille abnehmen, nahen Arm angewinkelt nach oben legen, fernen Arm quer über die Brust, Handrücken an die Wange</li><li>Fernes Bein beugen und zu dir ziehen, die Person zu dir drehen</li><li>Kopf nackenwärts neigen, Mund leicht öffnen (zur Erde hin)</li><li>112 rufen, Atmung weiter kontrollieren</li></ol><p>Atmet die Person nicht normal: 112 und Wiederbelebung (Herzdruckmassage), AED holen lassen. Das übt man im Kurs.</p>'],
      ['Verbrennung', '<ul><li>Sofort mit <b>fließendem, lauwarmem Wasser</b> kühlen, etwa 10 Minuten /* PRUEFEN */</li><li>Keine Hausmittel (Mehl, Butter, Öl), kein Eis direkt auf die Haut</li><li>Brandblasen nicht öffnen</li><li>Danach keimfrei abdecken; festklebende Kleidung nicht abziehen</li><li>Große Flächen, Gesicht, Hände, Kinder: Arzt oder 112</li></ul>'],
      ['Schnittverletzung', '<ul><li>Eigenschutz: Einmalhandschuhe anziehen</li><li>Wunde keimfrei abdecken, nicht auswaschen, keine Salben oder Puder</li><li>Starke Blutung: Druckverband anlegen, 112</li><li>Fremdkörper in der Wunde nicht entfernen</li><li>Jede Erste-Hilfe-Leistung im Verbandbuch eintragen und dem Ausbilder melden</li></ul>'],
      ['Augenverletzung', '<ul><li>Chemikalie im Auge: sofort lange mit viel Wasser spülen (Augenspüleinrichtung), dann Augenarzt oder 112</li><li>Fremdkörper oder Funken: nicht reiben, Arzt aufsuchen</li><li>Steckende Gegenstände nicht entfernen</li></ul>']
    ],
    psa: [
      ['Wann welche PSA?', '<p>PSA ist die <b>letzte</b> Maßnahme nach STOP. Der Arbeitgeber stellt sie zur Verfügung; du musst sie benutzen und pflegen. Vor jeder Benutzung prüfen: heil, sauber, passend.</p>'],
      ['Gehörschutz', '<p>Ab 80 dB(A) zur Verfügung stellen, ab 85 dB(A) Pflicht. Lärmbereiche sind mit dem blauen Gebotszeichen gekennzeichnet. /* PRUEFEN: Grenzwerte nach Lärm- und Vibrations-Arbeitsschutzverordnung */</p>'],
      ['Augenschutz', '<p>Bei Funken, Spänen, Spritzern und Staub: Schutzbrille oder Gesichtsschutz. Normale Brillen sind kein Augenschutz.</p>'],
      ['Handschuhe: Pflicht und Verbot', '<p>Schutzhandschuhe gegen Schnitte, Hitze und Chemikalien sind sinnvoll. <b>An rotierenden Teilen</b> (Bohrmaschine, Drehmaschine) dürfen keine Handschuhe getragen werden: Einzugsgefahr. Chemikalienhandschuhe richten sich nach dem Sicherheitsdatenblatt.</p>']
    ],
    ver: [
      ['Fluchtwege und Sammelstelle', '<ul><li>Fluchtwege sind mit grünen Schildern und Pfeilen gekennzeichnet</li><li>Fluchtwege und Notausgänge <b>immer frei halten</b>: nichts abstellen, Türen nicht verschließen</li><li>Brandschutztüren nie verkeilen</li><li>Im Alarmfall: Gebäude verlassen, keinen Aufzug benutzen, zur Sammelstelle gehen und dort melden</li></ul>'],
      ['Ordnung am Arbeitsplatz', '<ul><li>Werkzeug und Material nach Gebrauch wegräumen</li><li>Kabel und Schläuche nicht über Wege legen</li><li>Verschüttetes sofort aufnehmen oder absichern</li><li>Feuerlöscher, Verbandkasten und Not-Halt-Taster nicht verstellen</li></ul>'],
      ['Stolpern, Rutschen, Stürzen', '<ul><li>Gut sehen, gut erkennen: Beleuchtung, Hindernisse melden</li><li>Rutschige Stellen reinigen und mit Warnschild kennzeichnen</li><li>Leitern vor dem Benutzen auf Schäden prüfen und standsicher aufstellen</li><li>Nicht rennen, nicht aus Höhe springen</li></ul>'],
      ['Heben und Tragen', '<ul><li>Hilfsmittel nutzen: Hubwagen, Sackkarre, Kran</li><li>Last nah am Körper, Rücken gerade, aus den Beinen heben</li><li>Keine Drehbewegung mit der Last: Füße mitdrehen</li><li>Schwere Lasten zu zweit tragen, freie Sicht und freier Weg</li></ul>']
    ]
  };

  /* ===== Beispiele (Reiter "Beispiele", Aufruf ?bsp) ===== */
  const beispiele = [
    { id: 'b1', titel: 'Gefährdungsbeurteilung: Ständerbohrmaschine (durchgespielt)', text: 'Alle vier Gefährdungen mit den passenden Maßnahmen nach STOP und den typischen Fehlern.', tab: 'gb', kind: 'gb', wp: 'bohr' },
    { id: 'b2', titel: 'Schild erklärt: Warnung vor elektrischer Spannung', text: 'Form, Farbe, Symbol und Bedeutung Schritt für Schritt, dazu das richtige Verhalten.', tab: 'zei', kind: 'zeichen', sign: 'w_strom' },
    { id: 'b3', titel: 'Löschmittelwahl: Fettbrand in der Pfanne', text: 'Welches Löschmittel geht, welches ist lebensgefährlich, und warum.', tab: 'bra', kind: 'brand', klasse: 'F' },
    { id: 'b4', titel: 'Erste Hilfe: Verbrennung an der Hand', text: 'Der Ablauf vom Unfall bis zur Dokumentation in Schritten.', tab: 'eh', kind: 'eh' },
    { id: 'b5', titel: 'Etikett lesen: Aceton', text: 'Piktogramme, Signalwort und Gefahrenhinweise eines Lösemittels gelesen und daraus Maßnahmen abgeleitet.', tab: 'ghs', kind: 'etikett' }
  ];
  const beispielDaten = {
    zeichen: [
      ['1. Form', 'Dreieckig: Das ist ein Warnzeichen.'],
      ['2. Farbe', 'Gelber Grund, schwarzer Rand und schwarzes Symbol: passt zu einem Warnzeichen.'],
      ['3. Symbol', 'Der Blitzpfeil steht für elektrische Spannung.'],
      ['4. Bedeutung', 'Warnung vor elektrischer Spannung: Es besteht Gefahr durch Strom.'],
      ['5. Wo hängt es?', 'An Schaltschränken, Verteilern und Maschinen mit elektrischen Anlagen.'],
      ['6. Was tue ich?', 'Nicht öffnen, nicht daran arbeiten. Arbeiten an Elektroanlagen machen nur Elektrofachkräfte. Fällt dir ein Schaden auf, melde ihn.'],
      ['7. Brand?', 'Nie mit Wasser löschen. CO₂-Löscher benutzen, wenn gefahrlos möglich zuerst Spannung abschalten.']
    ],
    eh: [
      ['Lage', 'Beim Anfassen eines heißen Werkstücks verbrennst du dir die Handfläche.'],
      ['1. Sofortmaßnahmen', 'Das Werkstück loslassen, Gefahr beenden, Ausbilder rufen.'],
      ['2. Kühlen', 'Hand sofort unter fließendes, lauwarmes Wasser halten, etwa 10 Minuten. /* PRUEFEN */'],
      ['3. Nicht tun', 'Keine Hausmittel (Mehl, Butter, Öl), kein Eis direkt auf die Haut, Brandblasen nicht aufstechen.'],
      ['4. Abdecken', 'Mit keimfreier Wundauflage lose abdecken. Schmuck an der Hand vorher abnehmen, solange sie noch nicht geschwollen ist.'],
      ['5. Wann Arzt oder 112?', 'Bei Blasen auf größerer Fläche, tiefen Wunden oder Verbrennungen an Gesicht und Händen.'],
      ['6. Dokumentieren', 'Eintrag im Verbandbuch und Meldung an den Ausbilder.']
    ],
    etikett: {
      stoff: 'Aceton', pics: ['GHS02', 'GHS07'], signal: 'Gefahr',
      h: [['H225', 'Flüssigkeit und Dampf leicht entzündbar'], ['H319', 'Verursacht schwere Augenreizung'], ['H336', 'Kann Schläfrigkeit und Benommenheit verursachen']],
      p: [['P210', 'Von Hitze, heißen Oberflächen, Funken, offenen Flammen sowie anderen Zündquellenarten fernhalten. Nicht rauchen.'], ['P233', 'Behälter dicht verschlossen halten.'], ['P305+P351+P338', 'Bei Kontakt mit den Augen: Einige Minuten lang behutsam mit Wasser spülen. Eventuell vorhandene Kontaktlinsen nach Möglichkeit entfernen. Weiter spülen.']],
      folge: ['Zündquellen fernhalten (Schild „Keine offene Flamme“)', 'Gut lüften oder absaugen (technische Maßnahme)', 'Schutzbrille tragen', 'Behälter nach Gebrauch verschließen', 'Im Sicherheitsdatenblatt nachlesen: geeignete Handschuhe, Lagerung, Erste Hilfe']
    }
  };

  /* ===== Hilfe ===== */
  const help = [
    ['Zeichenformen und Farben', '<table><tr><th>Gruppe</th><th>Form</th><th>Farbe</th></tr>' + Object.keys(kat).map(k => `<tr><td>${kat[k].name}</td><td>${kat[k].form}</td><td>${kat[k].farbe}</td></tr>`).join('') + '</table>'],
    ['Brandklassen und Löschmittel', '<table><tr><th>Klasse</th><th>Stoffe</th></tr>' + brand.map(b => `<tr><td>${b.k}</td><td>${b.name}: ${b.bsp}</td></tr>`).join('') + '</table><p><b>Nie Wasser</b> bei Fett (F), Metall (D) und elektrischen Anlagen unter Spannung.</p>'],
    ['STOP-Prinzip', '<p>Rangfolge der Maßnahmen: ' + Object.keys(stop).map(k => `<b>${k}</b> ${stop[k].name}`).join(', ') + '.</p><p>Erst die Gefahr beseitigen oder ersetzen, dann abschirmen, dann Regeln aufstellen, zuletzt persönlich schützen.</p>'],
    ['Wichtig zur Einordnung', '<p>Dieses Lab ist eine Übung und Ergänzung. Es <b>ersetzt keine gesetzlich vorgeschriebene Unterweisung</b> durch den Arbeitgeber und keinen Erste-Hilfe-Kurs. Maßgeblich sind deine Betriebsanweisungen, die Hinweise deiner Ausbilder und der Fachkraft für Arbeitssicherheit.</p>']
  ];

  /* ===== Export ===== */
  root.ARB_DATA = { cats, kat, signs, ghs, signal, brand, mittel, matrix, grund, brandMaterial, stop, gb, gbOrder, psaItems, psa, tasks, eh, seiten, beispiele, beispielDaten, help };
  root.ARB_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.ARB_DATA, TASKS: root.ARB_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
