'use strict';
/* Tonfunk Maschinen-Lab: Zeichnungen (inline-SVG, ohne Bibliotheken). Datei makviz.js, eingebunden NACH makui.js. window.MAK_VIZ bzw. module.exports (reine Funktionen, liefern SVG-Text).
   1) machine(id, o): Frontansicht der Maschine als Zeichnung mit antippbaren Bauteilen (Hotspots: <g data-hs="...">, per Tastatur fokussierbar). Optionen:
      sel (gewählter Hotspot), mark (Aufgabenmodus: ein Bauteil gestrichelt markiert, ohne Namen und ohne Bedienbarkeit), spin (0..1 relative Drehgeschwindigkeit, dezente Drehung des Symbols neben der Spindel;
      bei prefers-reduced-motion steht sie still), inter (false = keine Hotspots, z. B. in Aufgaben).
   2) tafel(id, picks, o): Drehzahltafel bzw. Vorschubtafel als Tabelle; picks = gewählte Hebelstellungen (Zelle und Hebel werden hervorgehoben), o.feed = Vorschubtafel. In Aufgaben ohne picks: Tafel ohne Markierung.
   3) panel(o): CNC-Bedienfeld mit Bildschirm und Tasten (data-key), Zustand aus MAK_CORE.cncNew/cncPress.
   4) pratze(o): Schnittskizze einer Spannung mit Pratze (Stütze: gleich | hoch | tief, Schraube: werkstueck | stuetze).
   Farben nur über CSS-Variablen der Seite (Hell/Dunkel). Alle Zeichnungen verraten keine Aufgabenlösung: In Aufgaben wird nur markiert, nie benannt (keine aria-labels an markierten Teilen). Keine Hersteller- oder Markennamen. */
(function (root) {
  const C = root.MAK_CORE || (typeof require !== 'undefined' ? require('./makcore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n2 = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const fm = (v, d) => (fin(v) && C ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const R = (x, y, w, h, cls, rx) => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"${rx ? ` rx="${n2(rx)}"` : ''} class="${cls}"/>`;
  const O = (x, y, r, cls) => `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" class="${cls}"/>`;
  const L = (x1, y1, x2, y2, cls) => `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" class="${cls || 'mk-line'}"/>`;
  const Pt = (d, cls) => `<path d="${d}" class="${cls || 'mk-line'}"/>`;
  const T = (x, y, t, cls, anchor) => `<text x="${n2(x)}" y="${n2(y)}" class="${cls || 'mk-t'}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(t)}</text>`;
  const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const MIN_HIT = 50;

  /* Hotspot: sichtbare Form (inner), Rahmen, unsichtbare Trefferfläche (mindestens 50 Einheiten = rund 44 px) */
  function hs(o, id, name, x, y, w, h, inner) {
    const sel = o.sel === id ? ' sel' : '', mk = o.mark === id ? ' mark' : '', inter = o.inter !== false && !o.mark;
    const hw = Math.max(w, MIN_HIT), hh = Math.max(h, MIN_HIT), hx = x + w / 2 - hw / 2, hy = y + h / 2 - hh / 2;
    return `<g class="mk-hs${sel}${mk}" data-hs="${esc(id)}"${inter ? ` tabindex="0" role="button" aria-label="${esc(name)}"` : ''}>${inner}${R(x - 3, y - 3, w + 6, h + 6, 'mk-ring', 5)}${inter ? R(hx, hy, hw, hh, 'mk-hit') : ''}</g>`;
  }
  /* dezent drehendes Symbol (Speichenrad); spin 0..1 = relative Geschwindigkeit, nicht maßstäblich */
  function spinner(o, x, y, r) {
    if (!(o.spin > 0)) return `<g>${O(x, y, r, 'mk-metal')}${L(x - r + 2, y, x + r - 2, y, 'mk-line')}${L(x, y - r + 2, x, y + r - 2, 'mk-line')}</g>`;
    const dur = n2(3.2 - 2.8 * Math.min(1, o.spin));
    return `<g class="mk-spin" style="animation-duration:${dur}s">${O(x, y, r, 'mk-metal')}${L(x - r + 2, y, x + r - 2, y, 'mk-line')}${L(x - r * 0.5, y - r * 0.87 + 1, x + r * 0.5, y + r * 0.87 - 1, 'mk-line')}${L(x + r * 0.5, y - r * 0.87 + 1, x - r * 0.5, y + r * 0.87 - 1, 'mk-line')}${O(x + r - 3, y, 2.2, 'mk-acc')}</g>`;
  }
  const slots = (x, y, w, n) => { let s = ''; for (let i = 1; i <= n; i++) s += L(x + w * i / (n + 1), y + 1, x + w * i / (n + 1), y + 8, 'mk-line'); return s; };
  const floor = () => Pt('M8 288H392', 'mk-line');
  const lever = (x1, y1, x2, y2, r) => L(x1, y1, x2, y2, 'mk-lev') + O(x2, y2, r || 6, 'mk-dark');
  const notaus = (x, y, r) => O(x, y, r + 3, 'mk-yellow') + O(x, y, r, 'mk-red');

  /* ============================================================ Bohrmaschinen */
  function bohrBase(o, c) {
    let s = floor() + R(c.bx, 268, c.bw, 16, 'mk-body', 3) + R(c.cx, 60, c.cw, 210, 'mk-body') + R(c.tx, c.ty, c.tw, 10, 'mk-body') + slots(c.tx, c.ty, c.tw, 3);
    return s;
  }
  function bohr(m, o) {
    const id = m.id; let s = '';
    if (id === 'tb1') {
      s += bohrBase(o, { bx: 120, bw: 160, cx: 186, cw: 28, tx: 130, ty: 205, tw: 140 });
      s += R(180, 8, 50, 32, 'mk-body', 4);
      s += hs(o, 'kopf', m.hot[0].name, 140, 40, 130, 64, R(140, 40, 130, 64, 'mk-body', 10));
      s += R(192, 104, 16, 50, 'mk-metal');
      s += hs(o, 'schild', 'Typenschild', 222, 52, 34, 24, R(222, 52, 34, 24, 'mk-fill', 2) + L(226, 58, 252, 58) + L(226, 64, 252, 64) + L(226, 70, 244, 70));
      s += hs(o, 'schalter', 'Schalter', 278, 76, 26, 34, R(278, 76, 26, 34, 'mk-dark', 3) + R(284, 82, 14, 8, 'mk-fill'));
      s += hs(o, 'handhebel', 'Handhebel', 262, 18, 80, 56, lever(262, 66, 336, 26, 8));
      s += hs(o, 'futter', 'Bohrfutter', 186, 152, 28, 28, R(186, 152, 28, 28, 'mk-dark', 4) + L(200, 180, 200, 204, 'mk-line'));
      s += hs(o, 'tisch', 'Bohrtisch', 130, 203, 140, 14, R(130, 205, 140, 10, 'mk-body') + R(124, 213, 152, 4, 'mk-metal'));
      s += spinner(o, 160, 140, 8);
      return s;
    }
    if (id === 'tb2') {
      s += bohrBase(o, { bx: 110, bw: 180, cx: 186, cw: 28, tx: 125, ty: 205, tw: 150 });
      s += R(175, 4, 50, 32, 'mk-body', 4) + R(158, 36, 84, 70, 'mk-body', 6) + R(186, 106, 28, 44, 'mk-body');
      s += hs(o, 'tafel', 'Drehzahltafel', 168, 50, 64, 44, R(168, 50, 64, 44, 'mk-fill', 2) + L(168, 64, 232, 64) + L(168, 79, 232, 79) + L(200, 64, 200, 94));
      s += hs(o, 'schalter', 'Stufenschalter am Sockel', 124, 271, 44, 12, R(124, 271, 44, 12, 'mk-fill', 3) + O(146, 277, 5, 'mk-dark'));
      s += hs(o, 'notaus', 'Not-Aus', 236, 262, 36, 24, notaus(254, 274, 8));
      s += hs(o, 'vorschub', 'Vorschubhebel', 240, 36, 76, 50, lever(240, 84, 308, 44, 8));
      s += hs(o, 'futter', 'Bohrfutter', 186, 148, 28, 30, R(186, 148, 28, 30, 'mk-dark', 4) + L(200, 178, 200, 204));
      s += hs(o, 'tisch', 'Bohrtisch mit Nut', 125, 203, 150, 14, R(125, 205, 150, 10, 'mk-body') + R(122, 213, 156, 4, 'mk-metal'));
      s += spinner(o, 138, 80, 9);
      return s;
    }
    if (id === 'tba') {
      s += bohrBase(o, { bx: 110, bw: 180, cx: 186, cw: 28, tx: 120, ty: 205, tw: 160 });
      s += R(150, 34, 100, 102, 'mk-body', 10) + R(186, 136, 28, 18, 'mk-body');
      s += hs(o, 'anzeige', 'Drehzahlanzeige', 164, 74, 72, 26, R(164, 74, 72, 26, 'mk-screen', 3) + T(228, 93, '0', 'mk-t mk-scr', 'end'));
      s += hs(o, 'notaus', 'Not-Aus', 186, 38, 28, 28, notaus(200, 52, 9));
      s += hs(o, 'knopf', 'Drehknopf Drehzahl', 186, 106, 28, 28, O(200, 120, 13, 'mk-dark') + L(200, 120, 200, 109, 'mk-lev'));
      s += hs(o, 'vorschub', 'Vorschubhebel', 250, 50, 72, 46, lever(250, 92, 314, 56, 8));
      s += hs(o, 'futter', 'Schnellspannfutter', 186, 152, 28, 28, R(186, 152, 28, 28, 'mk-dark', 4) + L(200, 180, 200, 204));
      s += hs(o, 'tisch', 'Bohrtisch', 120, 203, 160, 14, R(120, 205, 160, 10, 'mk-body') + R(116, 213, 168, 4, 'mk-metal'));
      s += hs(o, 'spanner', 'Spannelement', 232, 188, 26, 18, R(232, 196, 26, 10, 'mk-metal') + L(236, 196, 244, 186, 'mk-lev') + O(244, 186, 3, 'mk-red'));
      s += spinner(o, 130, 120, 9);
      return s;
    }
    if (id === 'sbA') {
      s += floor() + R(150, 268, 150, 16, 'mk-body', 3) + R(262, 30, 34, 238, 'mk-body') + R(110, 233, 180, 12, 'mk-body') + slots(110, 233, 180, 4);
      s += R(160, 4, 60, 34, 'mk-body', 4);
      s += R(120, 38, 146, 118, 'mk-body', 6) + R(182, 156, 20, 42, 'mk-metal');
      s += hs(o, 'tafel', 'Drehzahltafel', 128, 46, 60, 52, R(128, 46, 60, 52, 'mk-fill', 2) + L(128, 60, 188, 60) + L(128, 73, 188, 73) + L(128, 86, 188, 86) + L(148, 46, 148, 98) + L(168, 46, 168, 98));
      s += hs(o, 'hebelA', 'Hebel Buchstabe', 94, 100, 30, 28, lever(120, 112, 98, 122, 6));
      s += hs(o, 'hebelZ', 'Hebel Zeile', 94, 142, 30, 28, lever(120, 150, 98, 162, 6));
      s += hs(o, 'vorschubtafel', 'Vorschubtafel', 204, 48, 44, 32, R(204, 48, 44, 32, 'mk-fill', 2) + L(204, 59, 248, 59) + L(204, 70, 248, 70) + L(226, 48, 226, 80));
      s += hs(o, 'richtwerte', 'Richtwerte-Tafel', 204, 96, 46, 42, R(204, 96, 46, 42, 'mk-fill', 2) + slots(204, 100, 46, 5) + L(208, 126, 246, 126));
      s += hs(o, 'handhebel', 'Handhebel', 262, 130, 80, 80, lever(272, 134, 336, 202, 8));
      s += hs(o, 'spindel', 'Bohrspindel', 176, 156, 32, 60, R(176, 196, 32, 22, 'mk-dark', 4) + L(192, 218, 192, 232));
      s += hs(o, 'tisch', 'Tisch mit T-Nuten', 110, 231, 180, 16, R(104, 243, 192, 4, 'mk-metal'));
      s += spinner(o, 236, 176, 9);
      return s;
    }
    /* sbB */
    s += floor() + R(130, 268, 120, 16, 'mk-body', 3) + R(168, 90, 32, 180, 'mk-body') + R(118, 200, 134, 10, 'mk-body') + slots(118, 200, 134, 3);
    s += R(158, 2, 52, 24, 'mk-body', 4) + R(120, 26, 134, 70, 'mk-body', 10);
    s += hs(o, 'spindel', 'Pinole mit Bohrfutter', 176, 96, 20, 82, R(176, 96, 16, 60, 'mk-metal') + R(172, 150, 24, 26, 'mk-dark', 4) + L(184, 176, 184, 198));
    s += hs(o, 'taster', 'Ein/Aus-Taster', 212, 100, 36, 56, R(212, 100, 36, 56, 'mk-dark', 4) + O(230, 118, 9, 'mk-red') + O(230, 142, 9, 'mk-green'));
    s += hs(o, 'notaus', 'Not-Aus', 124, 106, 40, 38, R(124, 106, 40, 38, 'mk-yellow', 4) + O(144, 125, 11, 'mk-red'));
    s += hs(o, 'handhebel', 'Handhebel', 252, 8, 96, 108, L(254, 60, 336, 18, 'mk-lev') + O(336, 18, 8, 'mk-dark') + L(254, 70, 340, 112, 'mk-lev') + O(340, 112, 8, 'mk-dark') + O(254, 65, 9, 'mk-dark'));
    s += hs(o, 'kurbel', 'Tischverstellung', 236, 188, 54, 40, L(246, 206, 284, 190, 'mk-lev') + O(284, 190, 6, 'mk-dark'));
    s += hs(o, 'tisch', 'Tisch mit Nuten', 118, 198, 134, 14, R(114, 208, 142, 4, 'mk-metal'));
    s += spinner(o, 140, 76, 9);
    return s;
  }

  /* ============================================================ Drehmaschinen */
  function dreh(m, o) {
    const id = m.id; let s = floor();
    s += R(30, 213, 90, 70, 'mk-body') + R(290, 213, 80, 70, 'mk-body');
    s += hs(o, 'bett', 'Bett', 20, 195, 360, 18, R(20, 195, 360, 18, 'mk-body', 3));
    s += R(20, 78, 118, 117, 'mk-body', 4);
    if (id === 'dgr') {
      s += hs(o, 'gruppe', 'Knopf Gruppe', 30, 100, 40, 40, O(50, 120, 13, 'mk-dark') + L(50, 120, 56, 111, 'mk-lev'));
      s += hs(o, 'stufe', 'Knopf Stufe', 72, 100, 40, 40, O(92, 120, 13, 'mk-dark') + L(92, 120, 86, 111, 'mk-lev'));
      s += hs(o, 'tafel', 'Drehzahltafel', 34, 146, 76, 40, R(34, 146, 76, 40, 'mk-fill', 2) + L(34, 159, 110, 159) + L(34, 172, 110, 172) + L(60, 146, 60, 186) + L(85, 146, 85, 186));
      s += hs(o, 'notaus', 'Not-Aus', 96, 82, 30, 30, notaus(111, 97, 8));
    } else {
      s += R(30, 20, 76, 36, 'mk-screen', 3) + T(100, 44, '0', 'mk-t mk-scr', 'end');
      s += hs(o, 'bereich', 'Hebel Drehzahlreihe', 40, 92, 52, 44, O(66, 112, 14, 'mk-dark') + lever(70, 108, 92, 96, 5));
      s += hs(o, 'anzeige', 'Drehzahlanzeige', 100, 64, 36, 18, R(100, 64, 36, 18, 'mk-screen', 2) + T(132, 77, '0', 'mk-t mk-scr', 'end'));
      s += R(34, 148, 80, 38, 'mk-fill', 2) + L(34, 160, 114, 160) + L(34, 173, 114, 173);
      s += hs(o, 'notaus', 'Not-Aus', 344, 196, 34, 34, R(344, 196, 34, 34, 'mk-yellow', 4) + O(361, 213, 10, 'mk-red'));
    }
    s += R(138, 108, 24, 72, 'mk-dark', 3) + R(162, 134, 62, 16, 'mk-metal');
    s += hs(o, 'futter', id === 'dgr' ? 'Dreibackenfutter' : 'Dreibackenfutter', 136, 106, 28, 76, R(136, 106, 28, 76, 'mk-dark', 4) + L(140, 118, 160, 118, 'mk-line') + L(140, 170, 160, 170, 'mk-line'));
    if (id === 'dsl') s += hs(o, 'futterschutz', 'Futterschutz', 128, 84, 50, 42, R(128, 84, 50, 42, 'mk-yellow2', 6));
    if (id === 'dgr') s += hs(o, 'leitspindel', 'Leit- und Zugspindel', 140, 188, 150, 12, R(140, 189, 150, 4, 'mk-metal') + R(140, 196, 150, 3, 'mk-metal'));
    s += R(190, 168, 84, 27, 'mk-body', 3) + R(205, 156, 52, 14, 'mk-body', 2);
    s += hs(o, 'support', 'Support', 188, 154, 88, 42, R(188, 168, 88, 27, 'mk-body', 3) + R(205, 156, 52, 14, 'mk-body', 2));
    s += hs(o, 'stahlhalter', id === 'dgr' ? 'Stahlhalter' : 'Revolver-Stahlhalter', 212, 128, 40, 30, R(212, 136, 40, 20, 'mk-dark', 3) + Pt('M216 136L212 126L224 136Z', 'mk-metal'));
    s += R(282, 156, 20, 14, 'mk-metal');
    s += hs(o, 'reitstock', 'Reitstock', 282, 128, 96, 68, R(302, 128, 52, 67, 'mk-body', 4) + R(280, 154, 24, 14, 'mk-metal') + O(366, 152, 14, 'mk-fill') + O(366, 152, 3, 'mk-dark'));
    s += spinner(o, 150, 70, 8);
    return s;
  }

  /* ============================================================ Fräsmaschinen */
  function fraes(m, o) {
    const id = m.id; let s = floor();
    if (id === 'frd') {
      s += R(110, 266, 170, 18, 'mk-body', 3) + R(140, 218, 110, 50, 'mk-body') + R(150, 18, 100, 202, 'mk-body') + R(128, 22, 142, 78, 'mk-body', 6);
      s += hs(o, 'tafel', 'Drehzahlschild', 150, 30, 70, 22, R(150, 30, 70, 22, 'mk-fill', 2) + L(163, 30, 163, 52) + L(177, 30, 177, 52) + L(191, 30, 191, 52) + L(205, 30, 205, 52));
      s += hs(o, 'gruppe', 'Hebel Gruppe', 124, 58, 44, 44, O(150, 80, 11, 'mk-dark') + lever(150, 80, 128, 66, 4));
      s += hs(o, 'stufe', 'Hebel Stufe', 196, 58, 44, 44, O(218, 80, 11, 'mk-dark') + lever(218, 80, 240, 66, 4));
      s += R(186, 100, 28, 54, 'mk-metal') + hs(o, 'spindel', 'Frässpindel', 184, 100, 32, 90, R(190, 154, 20, 34, 'mk-dark', 2) + L(194, 188, 206, 188));
      s += hs(o, 'kuehl', 'Kühlmittelschlauch', 236, 44, 36, 110, Pt('M252 46C282 70 262 110 236 150', 'mk-hose'));
      s += hs(o, 'anzeige', 'Digitalanzeige X/Y', 286, 56, 100, 52, R(286, 56, 100, 22, 'mk-screen', 2) + R(286, 82, 100, 22, 'mk-screen', 2) + T(380, 72, 'X', 'mk-t mk-scr', 'end') + T(380, 98, 'Y', 'mk-t mk-scr', 'end'));
      s += hs(o, 'tisch', 'Frästisch mit T-Nuten', 50, 200, 300, 18, R(50, 204, 300, 14, 'mk-body') + slots(50, 204, 300, 5));
      s += hs(o, 'handrad', 'Handräder', 284, 220, 56, 56, O(312, 246, 22, 'mk-fill') + O(312, 246, 4, 'mk-dark') + L(312, 246, 334, 226, 'mk-lev'));
      s += spinner(o, 100, 90, 9);
      return s;
    }
    if (id === 'bfr') {
      s += R(150, 214, 100, 70, 'mk-body') + R(158, 10, 62, 205, 'mk-body') + R(140, 30, 92, 110, 'mk-body', 6);
      s += hs(o, 'bedienfeld', 'Bedienfeld', 10, 18, 110, 96, R(10, 18, 110, 96, 'mk-fill', 4) + O(30, 40, 6, 'mk-green') + O(60, 40, 6, 'mk-dark') + O(90, 40, 6, 'mk-green') + O(30, 66, 6, 'mk-dark') + O(90, 66, 6, 'mk-red') + O(30, 92, 6, 'mk-dark') + O(90, 92, 6, 'mk-dark'));
      s += hs(o, 'notaus', 'Not-Aus', 38, 116, 54, 30, notaus(65, 130, 11));
      s += hs(o, 'tafel', 'Tafel Spindeldrehzahl', 150, 62, 70, 52, R(150, 62, 70, 52, 'mk-fill', 2) + L(150, 76, 220, 76) + L(150, 89, 220, 89) + L(150, 102, 220, 102) + L(185, 62, 185, 114));
      s += hs(o, 'bereich', 'Hebel L/H', 140, 34, 40, 26, lever(160, 56, 148, 40, 5));
      s += hs(o, 'gang', 'Hebel 1/2/3', 188, 34, 40, 26, lever(208, 56, 224, 40, 5));
      s += hs(o, 'anzeige', 'Digitalanzeige', 260, 60, 110, 54, R(260, 60, 110, 54, 'mk-screen', 3) + T(364, 78, 'X', 'mk-t mk-scr', 'end') + T(364, 92, 'Y', 'mk-t mk-scr', 'end') + T(364, 106, 'Z', 'mk-t mk-scr', 'end'));
      s += R(180, 140, 24, 36, 'mk-metal') + hs(o, 'spindel', 'Frässpindel', 168, 140, 48, 52, R(172, 172, 36, 18, 'mk-dark', 3) + L(180, 190, 200, 190));
      s += hs(o, 'rundtisch', 'Rundtisch', 120, 192, 130, 26, Pt('M130 205Q190 180 250 205Q190 228 130 205Z', 'mk-body'));
      s += hs(o, 'absaugung', 'Späneabsaugung', 236, 140, 54, 66, Pt('M232 150C280 130 300 170 262 204', 'mk-hose') + R(252, 198, 26, 12, 'mk-dark', 2));
      s += R(50, 218, 270, 12, 'mk-body') + slots(50, 218, 270, 6);
      s += spinner(o, 255, 130, 8);
      return s;
    }
    /* srv */
    s += R(20, 262, 360, 22, 'mk-body', 3) + R(24, 196, 352, 34, 'mk-body', 3) + slots(24, 196, 352, 8);
    s += R(150, 12, 100, 110, 'mk-body', 6) + R(186, 122, 28, 30, 'mk-metal');
    s += hs(o, 'antrieb', 'Servoantrieb', 326, 100, 56, 80, R(326, 100, 56, 80, 'mk-dark', 4) + O(354, 140, 14, 'mk-fill'));
    s += hs(o, 'spindel', 'Frässpindel mit Fräser', 176, 120, 48, 70, R(184, 150, 32, 24, 'mk-dark', 3) + L(194, 174, 206, 174) + L(200, 174, 200, 190));
    s += hs(o, 'schutz', 'Schutz', 150, 126, 100, 64, R(156, 130, 88, 58, 'mk-glass', 6));
    s += hs(o, 'pratzen', 'Spannpratzen', 80, 168, 190, 32, [100, 160, 220].map(x => R(x, 178, 36, 18, 'mk-metal') + L(x + 5, 182, x + 31, 176, 'mk-lev') + R(x + 14, 168, 8, 12, 'mk-dark')).join('') + R(90, 192, 170, 6, 'mk-dark'));
    s += hs(o, 'tisch', 'Tisch mit T-Nuten', 24, 194, 352, 40, R(24, 214, 352, 16, 'mk-body') + slots(24, 214, 352, 8));
    s += hs(o, 'kuehl', 'Kühlmittelschlauch', 40, 40, 76, 100, Pt('M106 46C60 60 60 110 98 160', 'mk-hose'));
    s += spinner(o, 130, 60, 9);
    return s;
  }

  /* ============================================================ Vertikalbandsäge */
  function saege(m, o) {
    let s = floor() + R(20, 10, 200, 270, 'mk-body', 12) + R(120, 150, 100, 56, 'mk-bg', 2);
    s += hs(o, 'kompass', 'Kompass-Scheibe', 74, 26, 92, 92, O(120, 72, 44, 'mk-fill') + Pt('M120 28V116M76 72H164', 'mk-line') + O(120, 72, 6, 'mk-acc') + Pt('M120 72L132 50', 'mk-lev'));
    s += hs(o, 'manometer', 'Manometer', 28, 14, 50, 112, O(50, 40, 20, 'mk-fill') + Pt('M50 40L60 28', 'mk-lev') + O(50, 96, 20, 'mk-fill') + Pt('M50 96L40 84', 'mk-lev'));
    s += hs(o, 'schalter', 'Drehschalter', 28, 150, 120, 42, [48, 88, 128].map(x => O(x, 168, 12, 'mk-dark') + L(x, 168, x + 6, 160, 'mk-lev') + O(x, 188, 3, 'mk-red')).join(''));
    s += R(30, 216, 80, 60, 'mk-fill', 3) + R(120, 216, 90, 44, 'mk-fill', 3);
    s += R(190, 198, 190, 14, 'mk-body', 2) + slots(190, 198, 190, 4);
    s += hs(o, 'tisch', 'Tisch mit Anschlag', 190, 190, 190, 30, R(262, 186, 12, 14, 'mk-metal') + R(190, 210, 190, 4, 'mk-metal'));
    s += hs(o, 'band', 'Sägeband', 196, 112, 20, 170, L(206, 112, 206, 276, 'mk-band') + Pt('M200 194l6 8l6-8', 'mk-line'));
    s += hs(o, 'taster', 'Taster-Kasten', 348, 222, 38, 54, R(348, 222, 38, 54, 'mk-dark', 4) + O(367, 240, 8, 'mk-red') + O(367, 262, 8, 'mk-green'));
    s += spinner(o, 190, 40, 9);
    return s;
  }

  /* ============================================================ CNC-Fräsmaschine */
  function cnc(m, o) {
    let s = floor() + R(10, 50, 330, 232, 'mk-body', 6) + R(30, 70, 290, 150, 'mk-bg', 3);
    s += R(156, 12, 50, 60, 'mk-body', 4) + R(170, 72, 22, 42, 'mk-metal');
    s += hs(o, 'spindel', 'Frässpindel', 150, 70, 62, 70, R(166, 110, 30, 22, 'mk-dark', 3) + L(176, 132, 186, 132) + L(181, 132, 181, 146));
    s += R(80, 190, 190, 14, 'mk-body', 2);
    s += hs(o, 'palette', 'Palette mit Aufspannung', 80, 196, 190, 26, R(80, 202, 190, 10, 'mk-dark', 2) + slots(80, 202, 190, 7));
    s += hs(o, 'spanner', 'Spannelemente', 94, 168, 164, 28, [104, 140, 176, 212, 244].map(x => R(x - 8, 180, 18, 12, 'mk-metal') + L(x - 6, 182, x + 8, 174, 'mk-lev') + O(x + 8, 174, 3, 'mk-red')).join(''));
    s += hs(o, 'haube', 'Schutzhaube', 20, 60, 312, 170, R(24, 64, 304, 160, 'mk-glass', 6) + R(24, 64, 304, 6, 'mk-metal') + R(318, 120, 5, 36, 'mk-metal'));
    s += R(20, 232, 320, 44, 'mk-body', 3);
    s += hs(o, 'notaus', 'Not-Aus am Handbediengerät', 344, 165, 48, 46, R(346, 171, 44, 36, 'mk-dark', 4) + notaus(368, 189, 9));
    s += hs(o, 'handbedien', 'Handbediengerät', 344, 214, 48, 62, R(346, 214, 44, 62, 'mk-dark', 4) + [0, 1, 2, 3].map(i => R(352, 220 + i * 13, 32, 9, 'mk-fill', 2)).join(''));
    s += spinner(o, 120, 48, 9);
    return s;
  }

  function machine(id, o) {
    o = o || {}; const m = C && C.machine(id); if (!m) return svg(400, 60, 'Keine Zeichnung', T(200, 34, 'Maschine unbekannt', 'mk-t', 'middle'));
    let body;
    if (m.kind === 'bohr') body = bohr(m, o); else if (m.kind === 'dreh') body = dreh(m, o); else if (m.kind === 'saege') body = saege(m, o); else if (m.kind === 'cnc') body = cnc(m, o); else body = fraes(m, o);
    const label = o.mark ? 'Zeichnung einer Maschine mit einem markierten Bauteil' : 'Frontansicht ' + m.name + ' mit antippbaren Bauteilen';
    return svg(400, 300, label, body);
  }
  const hotIds = id => (C && C.machine(id) ? C.machine(id).hot.map(h => h.id) : []);

  /* ============================================================ Tafeln */
  function tafel(id, picks, o) {
    o = o || {}; const m = C && C.machine(id); if (!m) return svg(360, 50, 'Keine Tafel', T(180, 30, 'Maschine unbekannt', 'mk-t', 'middle'));
    if (o.feed && m.feed) return grid(m, { sel: m.feed.sel, f: m.feed.f }, picks, 'Vorschubtafel in mm je Umdrehung', 2, o);
    if (C.hasTable(m)) return grid(m, m, picks, 'Drehzahlen in min⁻¹', 0, o);
    if (C.isCont(m) && fin(m.cont.ranges[0].lo)) return ranges(m, picks, o);
    return svg(360, 56, 'Tafel', T(180, 24, 'Die Drehzahlen stehen auf der Maschine.', 'mk-t', 'middle') + T(180, 42, 'Auf dem Foto waren sie nicht lesbar.', 'mk-tm', 'middle'));
  }
  function grid(m, spec, picks, title, dec, o) {
    const g = C.gridOf({ sel: spec.sel, f: spec.f }), m3 = spec.sel.length === 3, nc = g.cols.length, W = 360, LW = 90, CW = (W - LW - 10) / nc, H0 = 26, RH = 28, top = 30, H = top + H0 + g.rows.length * RH + 12;
    const hi = Array.isArray(picks) && picks.length === spec.sel.length ? g.cell(picks) : null;
    let s = T(W / 2, 18, title, 'mk-t mk-b', 'middle');
    const ab1 = m3 ? '' : (spec.sel[1].ab || ''), ab0 = m3 ? '' : (spec.sel[0].ab || '');
    g.cols.forEach((c, j) => { const x = LW + j * CW; s += R(x, top, CW, H0, 'mk-th' + (hi && hi[1] === j ? ' on' : '')) + T(x + CW / 2, top + 17, (ab1 ? ab1 + ' ' : '') + c.label, 'mk-t', 'middle'); });
    g.rows.forEach((r, i) => {
      const y = top + H0 + i * RH; s += R(5, y, LW - 5, RH, 'mk-th' + (hi && hi[0] === i ? ' on' : '')) + T(10, y + 18, (ab0 && r.short.length < 4 ? ab0 + ' ' : '') + r.short, 'mk-t');
      g.cols.forEach((c, j) => { const x = LW + j * CW, on = hi && hi[0] === i && hi[1] === j; s += R(x, y, CW, RH, 'mk-cell' + (on ? ' on' : '')) + T(x + CW / 2, y + 18, fm(g.vals[i][j], dec), 'mk-t mk-v', 'middle'); });
    });
    return svg(W, H, title + (m.name ? ' der ' + m.name : ''), s);
  }
  function ranges(m, picks, o) {
    const W = 360, x0 = 20, x1 = 340, lg = v => Math.log(v), lo = lg(30), hi = lg(3000), X = v => x0 + (lg(v) - lo) / (hi - lo) * (x1 - x0);
    let s = T(W / 2, 18, 'Drehzahlreihen in min⁻¹ (logarithmische Skala)', 'mk-t mk-b', 'middle');
    m.cont.ranges.forEach((r, i) => { const y = 36 + i * 44; s += R(X(r.lo), y, X(r.hi) - X(r.lo), 20, 'mk-cell rng', 4) + T(X(r.lo) + 6, y + 15, 'Reihe ' + r.id + ': ' + fm(r.lo) + ' bis ' + fm(r.hi), 'mk-t') ; });
    const n = o && o.n; if (fin(n) && n >= 30 && n <= 3000) s += L(X(n), 30, X(n), 122, 'mk-mark') + T(X(n), 136, fm(n), 'mk-t mk-b', 'middle');
    [50, 100, 200, 500, 1000, 2000].forEach(v => { s += L(X(v), 112, X(v), 118, 'mk-line') + T(X(v), 128 + (fin(n) ? 12 : 0), fm(v), 'mk-tm', 'middle'); });
    return svg(W, fin(n) ? 156 : 142, 'Drehzahlreihen der ' + m.name, s);
  }

  /* ============================================================ CNC-Bedienfeld */
  const SHORT = { auto: 'AUTO', single: 'SINGLE', manual: 'MANUAL', teach: 'TEACH IN', start: 'START', stop: 'STOP', xm: '−X', xp: '+X', ym: '−Y', yp: '+Y', zm: '−Z', zp: '+Z', s1: '1', s10: '10', s100: '100', s1000: '1000', ovr0: '0 %', ovr100: '100 %', ovrmin: '− %', ovrplus: '+ %', reset: 'RESET', mason: 'MACHINE ON', klemm: 'KLEMM TISCH', memlock: 'MEMORY LOCK', notaus: 'NOT-AUS' };
  const KROW = [['auto', 'single', 'manual', 'teach', 'start', 'stop'], ['xm', 'xp', 'ym', 'yp', 'zm', 'zp'], ['s1', 's10', 's100', 's1000', 'ovr0', 'ovr100'], ['ovrmin', 'ovrplus', 'reset']];
  const KBOT = ['mason', 'klemm', 'memlock'];
  function panel(o) {
    o = o || {}; const st = o.state || null, sc = o.screen || {}, inter = o.inter !== false;
    const mode = sc.mode || (st ? st.mode : 'MANUAL'), ovr = fin(sc.ovr) ? sc.ovr : (st ? st.ovr : 100), pos = sc.ist || (st ? st.pos : { x: 0, y: 0, z: 50 }), prog = sc.prog || (st ? st.prog : C.PROG0), blk = fin(sc.blk) ? sc.blk : (st ? st.blk : 0);
    const soll = sc.soll || (prog[Math.min(blk, prog.length - 1)] ? C.targetOf(prog[Math.min(blk, prog.length - 1)], pos) : pos);
    let s = R(16, 8, 368, 150, 'mk-screen', 6);
    const hd = st && st.estop ? 'NOT-AUS' : st && !st.on ? 'MASCHINE AUS' : '';
    s += T(26, 26, mode + (hd ? '   ' + hd : ''), 'mk-t mk-scr mk-b');
    s += T(160, 26, 'SOLL', 'mk-t mk-scr', 'end') + T(240, 26, 'IST', 'mk-t mk-scr', 'end') + T(330, 26, 'RESTWEG', 'mk-t mk-scr', 'end');
    ['x', 'y', 'z'].forEach((a, i) => { const y = 44 + i * 15; s += T(26, y, a.toUpperCase(), 'mk-t mk-scr') + T(160, y, fm(soll[a], 3), 'mk-t mk-scr', 'end') + T(240, y, fm(pos[a], 3), 'mk-t mk-scr', 'end') + T(330, y, fm(C.restweg(soll[a], pos[a]), 3), 'mk-t mk-scr', 'end'); });
    s += T(26, 100, 'F-OVR ' + fm(ovr) + ' %', 'mk-t mk-scr');
    const lines = sc.lines || prog.slice(Math.max(0, Math.min(blk, prog.length - 2)), Math.max(0, Math.min(blk, prog.length - 2)) + 3);
    lines.slice(0, 3).forEach((l, i) => { s += T(26, 120 + i * 14, String(l), 'mk-t mk-scr' + (!sc.lines && prog.indexOf(l) === blk ? ' mk-b' : '')); });
    const key = (id, x, y, w, h) => {
      const k = C.KEYS[id], cls = 'mk-key' + (id === 'start' ? ' g' : id === 'stop' ? ' r' : '') + (st && (st.mode === k.l) ? ' on' : '') + (o.press === id ? ' press' : '') + (o.mark === id ? ' mark' : '');
      const parts = SHORT[id].split(' '), lab = parts.length > 1 && SHORT[id].length > 7 ? parts.map((p, i) => T(x + w / 2, y + h / 2 + (i - (parts.length - 1) / 2) * 11 + 3, p, 'mk-t mk-k', 'middle')).join('') : T(x + w / 2, y + h / 2 + 4, SHORT[id], 'mk-t mk-k', 'middle');
      return `<g class="${cls}" data-key="${id}"${inter ? ` tabindex="0" role="button" aria-label="${esc(o.mark || o.quiz ? 'Taste' : k.l)}"` : ''}>${R(x, y, w, h, 'mk-keyr', 7)}${lab}${R(x - 3, y - 3, w + 6, h + 6, 'mk-ring', 8)}</g>`;
    };
    KROW.forEach((row, r) => row.forEach((id, c) => { s += key(id, 32 + c * 56, 172 + r * 56, 50, 50); }));
    const by = 172 + 4 * 56 + 6;
    s += `<g class="mk-key${st && st.estop ? ' press' : ''}${o.mark === 'notaus' ? ' mark' : ''}" data-key="notaus"${inter ? ` tabindex="0" role="button" aria-label="${esc(o.mark || o.quiz ? 'Taste' : 'NOT-AUS')}"` : ''}>${O(60, by + 30, 31, 'mk-yellow')}${O(60, by + 30, 25, 'mk-red')}${T(60, by + 34, 'NOT-AUS', 'mk-t mk-k mk-w', 'middle')}${O(60, by + 30, 36, 'mk-ring')}</g>`;
    KBOT.forEach((id, i) => { s += key(id, 112 + i * 62, by + 6, 56, 50); });
    return svg(400, by + 70, o.mark || o.quiz ? 'Bedienfeld einer CNC-Steuerung' : 'CNC-Bedienfeld mit Bildschirm und Tasten', s);
  }

  /* ============================================================ Spannen mit Pratze */
  function pratze(o) {
    o = o || {}; const sv = o.stuetze || 'gleich', sc = o.schraube || 'werkstueck', yw = 110, ys = sv === 'hoch' ? 96 : sv === 'tief' ? 124 : 110, xb = sc === 'stuetze' ? 128 : 234;
    const X0 = 56, X1 = 270, yAt = x => ys + (yw - ys) * (x - X0) / (X1 - X0);
    let s = R(14, 150, 332, 24, 'mk-body', 2) + R(xb - 12, 150, 24, 24, 'mk-bg') + R(xb - 20, 160, 40, 10, 'mk-metal');
    s += R(52, ys, 56, 150 - ys, 'mk-metal', 2) + R(250, yw, 84, 40, 'mk-dark', 2);
    s += `<polygon points="${X0},${n2(ys - 10)} ${X1},${n2(yw - 10)} ${X1},${yw} ${X0},${n2(ys)}" class="mk-body"/>`;
    s += R(xb - 4, n2(yAt(xb) - 28), 8, n2(188 - yAt(xb)), 'mk-dark');
    s += R(xb - 11, n2(yAt(xb) - 18), 22, 8, 'mk-metal', 2) + R(xb - 7, n2(yAt(xb) - 26), 14, 8, 'mk-dark', 2);
    s += T(180, 196, 'Schnitt durch Tisch, Werkstück, Pratze und Stütze', 'mk-tm', 'middle');
    return svg(360, 204, o.quiz ? 'Skizze einer Spannung mit Pratze auf dem Maschinentisch' : 'Skizze: Pratze, Stütze und Schraube', s);
  }

  const api = { machine, tafel, panel, pratze, hotIds, hs, MIN_HIT, KROW, KBOT, SHORT };
  root.MAK_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
