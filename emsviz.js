'use strict';
/* Tonfunk EMS-Lab: Bilder zu den 15 Schritten des Wertstroms (emsviz.js, vor emsui.js eingebunden).
   EMS_VIZ.schritt(id) liefert ein kleines Schaubild als SVG-Text (in Node testbar), '' bei unbekannter Kennung.
   Farben kommen über die Klassen v* aus emslab.html (hell und dunkel). Die Bilder sind vereinfachte Prinzipskizzen, keine echten Maschinen. */
(function (root) {
  const R = (x, y, w, h, c, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 4 : r}" class="${c || 'vF'}"/>`;
  const L = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c || 'vS'}"/>`;
  const P = (d, c) => `<path d="${d}" class="${c || 'vS'}"/>`;
  const C = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" class="${c || 'vF'}"/>`;
  const T = (x, y, s, c) => `<text x="${x}" y="${y}" text-anchor="middle" class="${c || 'vT'}">${s}</text>`;
  const pfeil = (x1, y, x2) => L(x1, y, x2 - 6, y, 'vAs') + P(`M${x2 - 8} ${y - 5} L${x2} ${y} L${x2 - 8} ${y + 5} Z`, 'vA');
  const haken = (x, y) => P(`M${x - 7} ${y} l5 6 l10 -12`, 'vOk');
  /* Leiterplatte von oben mit ein paar Bauteilen */
  const platte = (x, y, w, h, voll) => R(x, y, w, h, 'vB', 3) + (voll === false ? '' : R(x + 6, y + 6, w * 0.3, h * 0.36, 'vD', 2) + R(x + w * 0.5, y + 6, w * 0.16, h * 0.22, 'vD', 1) + R(x + w * 0.72, y + 6, w * 0.16, h * 0.22, 'vD', 1) + R(x + w * 0.5, y + h * 0.55, w * 0.38, h * 0.28, 'vD', 2));
  /* Blatt Papier mit Zeilen */
  const blatt = (x, y, w, h, n) => R(x, y, w, h, 'vF', 2) + Array.from({ length: n || 3 }, (_, i) => L(x + 6, y + 10 + i * 9, x + w - 6, y + 10 + i * 9, 'vM')).join('');
  const lkw = (x, y) => R(x, y, 44, 26, 'vF', 2) + P(`M${x + 44} ${y + 8} h14 l10 10 v8 h-24 Z`, 'vF') + C(x + 12, y + 28, 6, 'vD') + C(x + 54, y + 28, 6, 'vD');
  const karton = (x, y, w, h) => R(x, y, w, h, 'vK', 2) + L(x, y + h * 0.3, x + w, y + h * 0.3, 'vS') + L(x + w / 2, y, x + w / 2, y + h * 0.3, 'vS');
  const rolle = (x, y, r) => C(x, y, r, 'vF') + C(x, y, r * 0.35, 'vD');
  const B = {
    anf: () => T(52, 16, 'Kunde') + blatt(22, 26, 30, 40, 4) + blatt(40, 38, 30, 40, 4) + T(52, 98, 'Unterlagen', 'vTm') + pfeil(86, 58, 126) + R(132, 30, 66, 56, 'vF') + T(165, 54, 'Menge ×') + T(165, 72, 'Kosten') + T(165, 104, 'Kalkulation', 'vTm') + pfeil(206, 58, 244) + blatt(252, 26, 44, 56, 3) + T(274, 74, '€', 'vTa') + T(274, 98, 'Angebot', 'vTm'),
    npi: () => blatt(18, 26, 48, 60, 5) + C(62, 74, 13, 'vAs') + L(71, 84, 82, 96, 'vAs') + T(46, 112, 'Daten prüfen', 'vTm') + pfeil(96, 58, 128) + platte(136, 36, 62, 44) + T(167, 112, 'Muster bauen', 'vTm') + pfeil(208, 58, 240) + platte(250, 30, 30, 20) + platte(258, 44, 30, 20) + platte(266, 58, 30, 20) + haken(288, 92) + T(270, 112, 'Serie', 'vTm'),
    ein: () => blatt(18, 26, 44, 58, 5) + T(40, 104, 'Stückliste', 'vTm') + pfeil(72, 56, 108) + R(114, 34, 62, 44, 'vF') + T(145, 52, 'Preis') + T(145, 68, 'Termin') + T(145, 104, 'Bestellung', 'vTm') + pfeil(186, 56, 222) + lkw(230, 38) + T(264, 104, 'Lieferant', 'vTm'),
    we: () => karton(16, 40, 50, 40) + T(41, 104, 'Lieferung', 'vTm') + pfeil(76, 60, 110) + blatt(116, 30, 34, 44, 3) + haken(146, 82) + T(134, 104, 'vergleichen', 'vTm') + pfeil(166, 60, 200) + rolle(240, 58, 26) + R(262, 66, 44, 24, 'vF', 2) + [268, 272, 277, 280, 286, 290, 296, 300].map(x => L(x, 70, x, 86, 'vS1')).join('') + T(258, 112, 'Etikett mit Barcode', 'vTm'),
    lag: () => R(14, 22, 116, 78, 'vF') + [48, 74].map(y => L(14, y, 130, y)).join('') + [34, 62, 90].map(x => rolle(x, 36, 9) + rolle(x, 62, 9) + rolle(x, 88, 9)).join('') + T(72, 116, 'feste Lagerplätze', 'vTm') + R(150, 22, 64, 78, 'vF') + R(156, 28, 52, 50, 'vGl') + rolle(172, 52, 9) + rolle(194, 52, 9) + T(182, 94, 'trocken') + T(182, 116, 'Trockenschrank', 'vTm') + P('M236 40 h56', 'vAs') + P('M286 35 l8 5 l-8 5 Z', 'vA') + T(266, 30, 'zuerst rein') + T(266, 62, 'zuerst raus') + rolle(250, 84, 9) + rolle(272, 84, 9) + rolle(294, 84, 9),
    kom: () => rolle(40, 52, 24) + T(40, 96, 'Bauteilrolle', 'vTm') + pfeil(72, 52, 104) + R(110, 40, 78, 24, 'vF') + rolle(124, 52, 8) + P('M132 46 h50', 'vAs') + [142, 152, 162, 172].map(x => R(x, 43, 5, 5, 'vD', 0)).join('') + T(149, 96, 'Feeder (Zuführung)', 'vTm') + pfeil(196, 52, 228) + R(234, 26, 70, 52, 'vF') + [0, 1, 2, 3].map(i => R(240 + i * 15, 60, 11, 22, 'vD', 1)).join('') + T(269, 46, 'Automat') + T(269, 106, 'gerüstet', 'vTm'),
    smt: () => L(6, 78, 314, 78, 'vM') +
      /* Pastendruck */ platte(14, 62, 54, 14, false) + L(12, 58, 70, 58) + P('M36 34 l14 22 h-10 Z', 'vA') + T(41, 104, 'Paste drucken', 'vTm') +
      /* SPI */ platte(92, 62, 54, 14, false) + R(109, 22, 20, 14, 'vD', 2) + P('M112 36 l-10 24 M126 36 l10 24', 'vAs') + T(119, 104, 'Paste prüfen', 'vTm') +
      /* Bestücken */ platte(170, 62, 54, 14, false) + R(174, 56, 10, 6, 'vD', 1) + L(204, 20, 204, 40) + R(197, 40, 14, 8, 'vF', 1) + R(199, 49, 10, 6, 'vD', 1) + T(197, 104, 'bestücken', 'vTm') +
      /* Reflow */ R(246, 30, 64, 46, 'vF') + P('M252 68 C262 66 264 50 274 50 S286 36 292 36 S300 52 306 66', 'vW') + T(278, 104, 'löten im Ofen', 'vTm') + T(160, 124, 'eine Linie, die Platine fährt von links nach rechts', 'vTm'),
    aoi: () => R(52, 14, 30, 20, 'vD', 3) + P('M58 34 L34 76 M76 34 L100 76', 'vAs') + platte(30, 78, 74, 16) + T(67, 114, 'Kamera sieht von oben', 'vTm') + L(160, 12, 160, 112, 'vM') +
      R(206, 14, 70, 12, 'vD', 2) + T(241, 40, 'Bildfläche', 'vTm') + R(206, 58, 70, 8, 'vB', 1) + R(220, 46, 42, 12, 'vD', 2) + [226, 236, 246, 256].map(x => C(x, 70, 3.5, 'vA')).join('') + P('M241 104 L214 68 M241 104 L268 68', 'vAs') + C(241, 106, 6, 'vW') + T(241, 126, 'Röntgen sieht hindurch', 'vTm'),
    tht: () => R(40, 50, 240, 12, 'vB', 2) + R(70, 22, 46, 20, 'vD', 3) + L(80, 42, 80, 74) + L(106, 42, 106, 74) + R(160, 16, 30, 26, 'vD', 3) + L(168, 42, 168, 74) + L(182, 42, 182, 74) + R(226, 26, 34, 16, 'vD', 3) + L(234, 42, 234, 74) + L(252, 42, 252, 74) +
      P('M30 100 C70 100 80 66 120 66 S170 100 210 100 H290 V112 H30 Z', 'vLot') + T(120, 126, 'Lotwelle von unten', 'vTm') + T(250, 126, 'Drähte durch Bohrungen', 'vTm'),
    test: () => R(60, 30, 130, 12, 'vB', 2) + R(80, 18, 36, 12, 'vD', 2) + R(136, 18, 30, 12, 'vD', 2) + R(50, 78, 150, 22, 'vF') + [72, 92, 112, 132, 152, 172].map(x => L(x, 78, x, 46) + P(`M${x - 3} 46 l3 -5 l3 5 Z`, 'vA')).join('') + T(125, 94, 'Nadeladapter') + T(125, 118, 'viele Messpunkte auf einmal', 'vTm') +
      R(224, 30, 76, 50, 'vF') + R(232, 38, 60, 22, 'vGl', 2) + haken(262, 52) + T(262, 74, 'gut') + L(200, 88, 224, 70, 'vAs') + T(262, 98, 'Prüfgerät', 'vTm'),
    mon: () => P('M40 96 h110 v-14 h-110 Z', 'vF') + T(95, 116, 'Gehäuse', 'vTm') + platte(52, 58, 86, 14, false) + R(60, 52, 22, 6, 'vD', 1) + R(98, 52, 30, 6, 'vD', 1) + P('M40 40 h110 v-12 h-110 Z', 'vF') + L(95, 46, 95, 54, 'vAs') + L(95, 74, 95, 80, 'vAs') + T(95, 20, 'Deckel', 'vTm') +
      R(214, 14, 22, 46, 'vD', 4) + L(225, 60, 225, 82) + P('M219 82 h12 l-6 8 Z', 'vA') + R(206, 92, 38, 8, 'vF', 1) + T(276, 40, 'Nm', 'vTa') + T(276, 66, 'Schrauber mit') + T(276, 82, 'Drehmoment') + T(238, 116, 'Jede Schraube gleich fest', 'vTm'),
    lack: () => R(46, 12, 22, 26, 'vD', 3) + P('M57 38 L34 76 M57 38 L80 76 M57 38 V76', 'vAs') + R(20, 80, 110, 10, 'vB', 2) + R(34, 72, 24, 8, 'vD', 1) + R(76, 72, 30, 8, 'vD', 1) + P('M20 80 V78 H34 V70 H58 V78 H76 V70 H106 V78 H130 V80', 'vW') + T(82, 110, 'Schutzlack: dünne Schicht', 'vTm') + L(160, 12, 160, 112, 'vM') +
      P('M190 40 V96 H300 V40', 'vS') + R(192, 60, 106, 34, 'vLot', 0) + R(200, 80, 90, 8, 'vB', 1) + R(214, 70, 26, 10, 'vD', 1) + R(254, 70, 22, 10, 'vD', 1) + P('M232 14 h26 l-8 20 h-10 Z', 'vF') + L(245, 34, 245, 60, 'vW') + T(240, 116, 'Verguss: ganz eingegossen', 'vTm'),
    frei: () => R(20, 30, 96, 60, 'vF', 6) + R(30, 40, 46, 26, 'vGl', 2) + C(94, 46, 5, 'vD') + C(94, 64, 5, 'vD') + T(68, 110, 'fertiges Gerät', 'vTm') + pfeil(126, 60, 158) + R(166, 18, 76, 86, 'vF', 2) + [0, 1, 2].map(i => haken(182, 40 + i * 24) + L(196, 40 + i * 24, 232, 40 + i * 24, 'vM')).join('') + T(204, 122, 'Funktion, Aussehen, Daten', 'vTm') + C(284, 58, 26, 'vOkR') + T(284, 63, 'frei', 'vTa'),
    vers: () => R(14, 44, 46, 30, 'vF', 4) + T(37, 96, 'Gerät', 'vTm') + pfeil(68, 60, 100) + karton(108, 34, 62, 50) + R(120, 60, 28, 16, 'vF', 1) + T(139, 104, 'Kundenverpackung', 'vTm') + pfeil(180, 60, 212) + lkw(222, 42) + T(256, 104, 'Versand', 'vTm'),
    rech: () => blatt(20, 22, 50, 66, 4) + T(45, 80, '€', 'vTa') + T(45, 108, 'Rechnung', 'vTm') + pfeil(80, 54, 116) + C(150, 40, 12, 'vF') + P('M128 84 C128 62 172 62 172 84 Z', 'vF') + T(150, 108, 'Kunde', 'vTm') +
      P('M190 54 A22 22 0 1 1 212 76', 'vAs') + P('M218 70 l-8 6 l8 6 Z', 'vA') + T(276, 42, 'Rückfragen') + T(276, 58, 'Bauteile') + T(276, 74, 'beobachten') + T(250, 108, 'weiter betreuen', 'vTm')
  };
  const ALT = { anf: 'Kunde schickt Unterlagen, daraus entsteht das Angebot', npi: 'Daten prüfen, Muster bauen, dann Serie', ein: 'Aus der Stückliste wird eine Bestellung beim Lieferanten', we: 'Lieferung vergleichen und jede Rolle mit Barcode-Etikett versehen',
    lag: 'Regal mit festen Plätzen, Trockenschrank, zuerst rein und zuerst raus', kom: 'Bauteilrolle kommt in den Feeder und der Feeder in den Automaten', smt: 'Linie: Paste drucken, Paste prüfen, bestücken, im Ofen löten', aoi: 'Kamera prüft von oben, Röntgen sieht durch das Bauteil',
    tht: 'Bauteile mit Drähten stecken in Bohrungen, die Lotwelle lötet von unten', test: 'Nadeladapter berührt viele Messpunkte, das Prüfgerät zeigt gut', mon: 'Leiterplatte kommt ins Gehäuse, Schrauber mit Drehmoment', lack: 'Schutzlack als dünne Schicht, Verguss gießt alles ein',
    frei: 'Fertiges Gerät, Prüfliste mit Haken, Freigabe', vers: 'Gerät kommt in die Kundenverpackung und in den Versand', rech: 'Rechnung an den Kunden, danach weiter betreuen' };
  const schritt = id => B[id] ? `<div class="viz"><svg viewBox="0 0 320 130" role="img" aria-label="${ALT[id]}">${B[id]()}</svg></div>` : '';
  root.EMS_VIZ = { schritt, IDS: Object.keys(B) };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.EMS_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
