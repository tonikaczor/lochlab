'use strict';
/* Tonfunk LochLab: reale Baugrößen (Millimeter) für die Darstellung im Lochraster-Editor (layout.html).
   Eine Rasterteilung (Lochabstand) sind 2,54 mm; im Editor ist 1 Einheit = 1 Rasterteilung.
   Hier stehen NUR Maße für die Zeichnung (Körper, kleinster Beinabstand). Anschlüsse, Werte und Simulation bleiben unberührt.
   Ein Widerstand ohne Eintrag „pw“ (alle früher gespeicherten Layouts) wird genau so gezeichnet wie bisher (= 0,25 W).
   Alle Zahlen sind Näherungen nach gängigen Datenblättern (Bauform 0204, 0207, 0309, 0411, 0617); offene Fragen: quelle/loch/PRUEFEN_bauteile.md.
   Als Skript (window.LochGr) und als Modul (module.exports) für Tests. Keine Bibliotheken. */
(function (root) {
  const MM = 2.54, fin = Number.isFinite;
  const u = mm => Math.round(mm / MM * 1000) / 1000;           // Millimeter -> Raster-Einheiten

  /* Widerstände: Körperlänge L und -durchmesser D in mm, kleinster Beinabstand in Rasterteilungen (nmin), üblicher Beinabstand (nTyp) */
  const RES = {
    '0125': { id: '0125', name: '0,125 W', form: '0204', L: 3.6, D: 1.6, nmin: 2, nTyp: 2, col: '#d3b77c', edge: '#8a6b3a' },
    '025':  { id: '025',  name: '0,25 W',  form: '0207', L: 6.3, D: 2.5, nmin: 2, nTyp: 4, col: '#d9bd85', edge: '#8a6b3a', legacy: true },
    '05':   { id: '05',   name: '0,5 W',   form: '0309', L: 9.0, D: 3.2, nmin: 4, nTyp: 5, col: '#cdb482', edge: '#7e6238' },
    '1':    { id: '1',    name: '1 W',     form: '0411', L: 11,  D: 4.5, nmin: 5, nTyp: 6, col: '#b9c9d4', edge: '#5d7384' },
    '2':    { id: '2',    name: '2 W',     form: '0617', L: 15,  D: 5.0, nmin: 7, nTyp: 8, col: '#a9bccb', edge: '#53697a' },
  };
  const RES_ORDER = ['0125', '025', '05', '1', '2'], RES_DEF = '025';
  /* Die bisherige Zeichnung (Körper 2,5 × 0,9 Einheiten) bleibt für 0,25 W bestehen, damit alte Layouts unverändert aussehen */
  const LEGACY = { L: 2.5, h: 0.9 };
  const resOf = id => RES[id] || RES[RES_DEF];
  function resDims(id) {
    const r = resOf(id);
    if (r.legacy) return { L: LEGACY.L, h: LEGACY.h, col: r.col, edge: r.edge, bw: 0.09, nmin: r.nmin, id: r.id };
    const L = u(r.L), h = u(r.D);
    return { L, h, col: r.col, edge: r.edge, bw: Math.round(L * 0.036 * 1000) / 1000, nmin: r.nmin, id: r.id };
  }

  /* Keramikkondensatoren (Scheibe, Vielschicht): Körper in mm */
  const CER = {
    'sc5':  { id: 'sc5',  name: 'Scheibe klein', form: 'Scheibe', W: 4.3, H: 3.8, nmin: 1, nTyp: 2, legacy: true },
    'sc8':  { id: 'sc8',  name: 'Scheibe Ø 8 mm', form: 'Scheibe', W: 8, H: 8, nmin: 2, nTyp: 2, col: '#e3a233', edge: '#8a5a10' },
    'sc10': { id: 'sc10', name: 'Scheibe Ø 10 mm', form: 'Scheibe', W: 10, H: 10, nmin: 3, nTyp: 3, col: '#d99a2b', edge: '#8a5a10' },
    'ml':   { id: 'ml',   name: 'Vielschicht RM 5,08', form: 'Vielschicht', W: 5, H: 5, nmin: 2, nTyp: 2, col: '#e0b13c', edge: '#7a5b10', box: true },
  };
  const CER_ORDER = ['sc5', 'sc8', 'sc10', 'ml'], CER_DEF = 'sc5';
  const cerOf = id => CER[id] || CER[CER_DEF];
  function cerDims(id) {
    const c = cerOf(id);
    if (c.legacy) return { rx: 0.85, ry: 0.75, cy: -0.12, col: '#e3a233', edge: '#8a5a10', box: false, nmin: c.nmin, id: c.id };
    return { rx: u(c.W) / 2, ry: u(c.H) / 2, cy: -0.12, col: c.col, edge: c.edge, box: !!c.box, nmin: c.nmin, id: c.id };
  }

  /* kleinster Beinabstand (Rastereinheiten) für Bauteil k mit gewählter Bauform */
  function nMin(k, sel) {
    if (k === 'R') return resOf(sel).nmin;
    if (k === 'C') return cerOf(sel).nmin;
    return 1;
  }
  /* Auswahlliste für die Oberfläche: [id, Beschriftung] */
  const options = k => (k === 'R' ? RES_ORDER.map(i => [i, RES[i].name]) : k === 'C' ? CER_ORDER.map(i => [i, CER[i].name]) : []);
  const optTitle = k => (k === 'R' ? 'Nennleistung' : k === 'C' ? 'Bauform' : '');
  const optKey = k => (k === 'R' ? 'pw' : k === 'C' ? 'bf' : '');
  const defOf = k => (k === 'R' ? RES_DEF : k === 'C' ? CER_DEF : '');
  const isValid = (k, id) => (k === 'R' ? !!RES[id] : k === 'C' ? !!CER[id] : false);

  const de = (x, d) => (Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toString().replace('.', ',');
  /* Text „So groß ist das Bauteil in echt“: nur Zahlen, keine Hinweise zur Lösung. it: Bauteil im Dokument (oder null), V: Variante */
  function massText(k, it, V) {
    const n = it && it.n != null ? it.n : null, pitch = n != null ? ' · Beinabstand ' + de(n * MM, 2) + ' mm' : '';
    if (k === 'R') { const r = resOf(it && it.pw); return 'Gehäuse ca. ' + de(r.L) + ' × ' + de(r.D) + ' mm (Bauform ' + r.form + ')' + pitch; }
    if (k === 'C') { const c = cerOf(it && it.bf); return 'Gehäuse ca. ' + (c.box || c.W !== c.H ? de(c.W) + ' × ' + de(c.H) : 'Ø ' + de(c.W)) + ' mm' + pitch; }
    if (k === 'D' && V && V.bl) return 'Gehäuse ca. ' + de(V.bl * MM) + ' × ' + de((V.bh || 0.56) * MM) + ' mm' + pitch;
    if (k === 'LED' && V && V.r) return 'Linsen-Durchmesser ca. ' + de(V.r * 2 * MM) + ' mm' + pitch;
    if (k === 'CE' && V && V.r) return 'Becher-Durchmesser ca. ' + de(V.r * 2 * MM) + ' mm' + pitch;
    if (k === 'CF' && V && V.bw) return 'Gehäuse ca. ' + de(V.bw * MM) + ' × ' + de((V.bh || 1.3) * MM) + ' mm' + pitch;
    return '';
  }
  /* Einkaufsbegriffe für die Stückliste */
  const shopR = id => 'Widerstand ' + resOf(id).name + ' ' + resOf(id).form;
  const shopC = id => (cerOf(id).id === CER_DEF ? 'Keramikkondensator' : cerOf(id).box ? 'Vielschicht-Keramikkondensator RM 5,08' : 'Keramik-Scheibenkondensator ' + cerOf(id).name.replace('Scheibe ', ''));

  const API = { MM, RES, RES_ORDER, RES_DEF, CER, CER_ORDER, CER_DEF, resOf, cerOf, resDims, cerDims, nMin, options, optTitle, optKey, defOf, isValid, massText, shopR, shopC, u, de, fin };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.LochGr = API;
})(typeof window !== 'undefined' ? window : globalThis);
