/* elsdraw.js - ELS-Lab Zeichenhelfer (ELS_DRAW, Version 1.0), Paket WP1c
 * Visualisierung des Sicherheits-Labs (SPEC Abschnitt 7): Strichfigur mit Strompfad, Zonenbild, Fehlerschleife, Kennlinienband, LS-Schnitt,
 * Summenstromwandler, Geraeteschnitt, Pruefplatz, Isolations-Schaltbild, Schaltschrank, Wirkungskette, Ampel mit Symbolen, Partikelsystem,
 * Qualitaetsstufen. Vanilla-JS, keine Abhaengigkeiten, kein eval, offline. Muster: emvdraw.js / enrdraw.js.
 * Browser: window.ELS_DRAW, Node: module.exports / globalThis.ELS_DRAW (Zeichnen nur gegen einen Kontext-Mock).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Jede Funktion hat die Form f(ctx, ...), ctx = Canvas-2D-Kontext (im Test ein Mock). Koordinaten in CSS-Pixeln, der Aufrufer setzt Transform und loescht.
 *  - Rueckgabe: false = nichts gezeichnet (dann KEIN Aufruf am ctx: kein save, kein path). Sonst true oder ein Ergebnisobjekt (truthy).
 *    false bei: unbrauchbarem ctx, Daten mit NaN/Infinity/Betrag >= 1e7 (Zahlen als Text sind KEINE Zahlen), unbekanntem Zustandsnamen,
 *    Rechteck zu klein (auch 0 x 0) oder fehlenden Pflichtdaten. Ausnahmen im Zeichenteil werden gefangen (restore, false).
 *  - Alle Optionen optional; ungueltige fallen auf den Vorgabewert zurueck. Nach dem Aufruf sind save/restore ausgeglichen.
 *  - Farben: opts.palette (Objekt oder 'light'/'dark') vor opts.colors vor opts.theme ('dark' Standard). ELS_DRAW.palette(theme) liefert die Palette:
 *    bg panel panel2 line grid fg mute | fehler (Fehlerstrom orange-rot) pe (Schutzleiter gruen-gelb) neutral (blau) l1 l2 l3 (Aussenleiter braun/schwarz/grau)
 *    halo (Umrandung dunkler Leiter) | z1 z2 z3 z4 (Zonen gruen-gelb-orange-rot) | gruen gelb rot grau (Ampel) | schutz pfad | eb{basis,fehler,zusatz} | series[].
 *    Textfarben (TEXT_KEYS) haben >= 4,5:1 Kontrast auf bg, panel und panel2 (Test). Zonen und Ampel tragen IMMER Symbol und Text (Farbenblind-tauglich,
 *    Test mit Simulation Protanopie/Deuteranopie/Tritanopie, cvd()).
 *  - opts.quality 'hoch'|'mittel'|'niedrig' und opts.reduced (prefers-reduced-motion => niedrig, keine Bewegung) wirken auf Partikelpool (600/300/120),
 *    Feldlinien (24/16/8 -> je Leiter 8/6/3), Leuchten, Schatten und Verlaeufe. ELS_DRAW.createGovernor() regelt die Bildzeit (Ziel <= 16 ms bei mittel).
 *  - Zahlen mit Dezimalkomma (fz); Mindestschrift 12 px (11 px bei Breite < 420); Text ueber Linien immer mit Platte; Zahlen stehen immer zusaetzlich im Bild.
 *  - Nichts blinkt: es gibt keinen Blinkzyklus; pulse(tMs, hz) begrenzt auf MAX_FLASH_HZ = 3 (Vorgabe 0,8), die Ampel pulst hoechstens einmal.
 *  - Kein Blut, keine Verletzungsdarstellung: die Strichfigur zeigt nur Strompfad und Zonenfarbe mit Text.
 *
 * ===================================================================================================
 * FUNKTIONEN (Datenformate; alle Zahlen kommen vom Aufrufer; gerechnet wird hier nicht, ausser der Lehrkurve als Rueckfall in zoneChart)
 *  bodyFigure(ctx, rect, st, o)    st = { zone 1..4, current (mA), path 'hand-fuss'|'hand-hand'|'hand-rumpf', rate 0..1, label }; o = { particles (createParticles-Objekt) }.
 *                                  Ergebnis { zone, path, paths:[{id,pts,rate,dir}] }. bodyPaths(rect, path) liefert dieselben Pfade vor dem Zeichnen. Min 120 x 140.
 *  zoneChart(ctx, rect, st, o)     st = { I (mA), t (ms) }; o = { bounds { z1 (mA), z2 (mA), fl (function (tMs) -> mA) } sonst Lehrkurve, caption }.
 *                                  Ergebnis { zone, x, y, plot }. zoneAt(I, t, bounds) liefert 1..4. Min 200 x 140.
 *  loopScene(ctx, rect, st, o)     st = { form 'TN-S'|'TN-C-S'|'TT'|'IT', fault 'ohne'|'koerperschluss'|'pe-unterbrochen', rate, ub (V), ul (V, 50), zs (Ohm), iF (A), tripped }.
 *                                  Ergebnis { paths:[{id:'schleife',pts,rate,dir}], bar }. loopPaths(rect, st). Min 240 x 150.
 *  tripBand(ctx, rect, band, o)    band = [[x (Vielfaches von In), tMin (s), tMax (s)], ...] = prot.curve(); o = { point {x,t}, xa (Ia als Vielfaches), name }. Min 200 x 140.
 *  breakerCut(ctx, rect, st, o)    st = { thermal 0..1, magnet 0..1, tripped, x (I/In) }. Min 200 x 130.
 *  sumTransformer(ctx, rect, st, o) st = { iL, iN (mA), diff (mA), idn (mA), tripped }. Min 200 x 130.
 *  deviceCut(ctx, rect, st, o)     st = { sk 'I'|'II'|'III', pe, fault, rate, tripped }. Ergebnis { paths }. Min 200 x 140.
 *  benchScene(ctx, rect, st, o)    st = { device, sk, steps:[{ id 'sicht'|'rpe'|'riso'|'ipe', status 'offen'|'ok'|'fehler'|'entfaellt' }], reading, ampel }. Min 260 x 140.
 *  isoCircuit(ctx, rect, st, o)    st = { art 'riso'|'rpe', branches:[{ name, r }], mode '2L'|'4L', rk (Ohm), rMeas (Text oder Zahl), unit }. Min 240 x 140.
 *  cabinetScene(ctx, rect, st, o)  st = { done 0..5 } (Anzahl erledigter Sicherheitsregeln in fester Reihenfolge). Min 220 x 150.
 *  chainBar(ctx, rect, chain, active, o)  chain = { fehler, weg, schutz } (rig.pfad), active = 'basis'|'fehler'|'zusatz'|null (Schutzebene). Min 260 x 50.
 *  ampel(ctx, x, y, state, o)      state = 'gruen'|'gelb'|'rot'|'grau' | assess-Objekt; o = { size, text, marginText, hint, pulse, reduced }. ampelText(state, marginText) fuer aria-label.
 *  createParticles(paths, opts)    wie EMV_DRAW (Pool fester Groesse, step, draw, setRate, positions, speedOf).
 *  wipe / wipeHit / wipePos        Vorher/Nachher-Waescher (wie EMV).
 *  Hilfen: label, arrow, icon, palette, cssColors, fz, fzt, ticks, logTicks, mix, rgba, contrast, lum, rng, fsz, cvd (Farbenblind-Simulation), pulse,
 *          EBENEN, ZONES, AMPEL, QUAL, qualityOf, createGovernor, version, fns.
 */
(function (root) {
  'use strict';
  const VERSION = '1.0';
  const MAX_FLASH_HZ = 3;

  /* =================================================================================================================
   *  A. Grundlagen: Pruefungen, Zahlen, Farben, Qualitaetsstufen, Text
   * ================================================================================================================= */
  /* endlich und vernuenftig gross (Betrag < 1e7): schuetzt vor Endlosschleifen und Ueberlauf bei Unsinnswerten (SPEC 6.2) */
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e7;
  const afin = v => typeof v === 'number' && isFinite(v);
  /* Messdaten (Frequenzen bis GHz, Zeiten): weiter gefasst als Pixelkoordinaten */
  const dfin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e13;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  function nz(o, k, def, lo, hi) {
    const v = o[k];
    if (!fin(v)) return def;
    return cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  }
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 80 && !/NaN|undefined|null|Infinity/i.test(v);
  const isRect = r => !!r && typeof r === 'object' && fin(r.x) && fin(r.y) && fin(r.w) && fin(r.h) && r.w > 0 && r.h > 0;

  /* Zufall: mulberry32, deterministisch (Partikelstart, Funke, Rauschteppich) */
  function rng(seed) {
    let a = (afin(seed) ? Math.floor(seed) : 1) >>> 0 || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }


  /* ---------------------------------------------------------------- Palette (SPEC 7; Zonen und Ampel immer mit Symbol und Text) */
  const PAL = {
    dark: {
      theme: 'dark', bg: '#0e1621', panel: '#16212f', panel2: '#1d2b3d', line: '#34475c', grid: '#26364a', fg: '#e8eef5', mute: '#9fb2c6',
      fehler: '#ff8a4c', pe: '#c3dc3c', neutral: '#4fb3ff', l1: '#c8905e', l2: '#1a1f26', l3: '#a3acb5', halo: '#c4ccd4',
      z1: '#5ee38a', z2: '#ffe66b', z3: '#ffa13d', z4: '#ff6e6e',
      gruen: '#5ee38a', gelb: '#ffe66b', rot: '#ff6e6e', grau: '#98a6b5',
      schutz: '#6aa6ff', pfad: '#c1a8ff', basis: '#4fc3f7', ebfehler: '#ffb74d', zusatz: '#d0a4ff',
      glow: true
    },
    light: {
      theme: 'light', bg: '#f4f7fa', panel: '#ffffff', panel2: '#e8eef4', line: '#b7c5d3', grid: '#dde3e9', fg: '#14202c', mute: '#445568',
      fehler: '#b3390a', pe: '#566f00', neutral: '#0369a1', l1: '#7a4a22', l2: '#14202c', l3: '#566371', halo: '#566371',
      z1: '#197647', z2: '#7a6400', z3: '#8a3800', z4: '#d01c34',
      gruen: '#197647', gelb: '#7a6400', rot: '#d01c34', grau: '#566371',
      schutz: '#1d4ed8', pfad: '#6d3fd6', basis: '#0369a1', ebfehler: '#8f4b00', zusatz: '#6d28d9',
      glow: false
    }
  };
  /* Textfarben, die der Kontrastpruefung (>= 4,5:1 auf bg, panel und panel2) unterliegen */
  const TEXT_KEYS = ['fg', 'mute', 'fehler', 'pe', 'neutral', 'l1', 'l3', 'z1', 'z2', 'z3', 'z4', 'gruen', 'gelb', 'rot', 'grau', 'schutz', 'pfad', 'basis', 'ebfehler', 'zusatz'];
  /* Leiterfarben (Linien, kein Text): Mindestkontrast 3:1 gegen den Grund oder gegen halo */
  const WIRE_KEYS = ['fehler', 'pe', 'neutral', 'l1', 'l2', 'l3'];

  /* Schutzebenen: EINE Tabelle (Namen und Farben), die Rigs lesen hier (SPEC 0, Regel 5) */
  const EBENEN = {
    basis: { id: 'basis', name: 'Basisschutz', short: 'Basis', colorKey: 'basis', sym: 'dotout' },
    fehler: { id: 'fehler', name: 'Fehlerschutz', short: 'Fehler', colorKey: 'ebfehler', sym: 'earth' },
    zusatz: { id: 'zusatz', name: 'Zusatzschutz', short: 'Zusatz', colorKey: 'zusatz', sym: 'plus' }
  };
  /* Zonen: Symbol, Name, Text (Lehrdarstellung, Zahlen nur aus dem Kern) */
  const ZONES = [null,
    { id: 1, key: 'z1', sym: 'check', name: 'Z1', text: 'kaum wahrnehmbar' },
    { id: 2, key: 'z2', sym: 'dash', name: 'Z2', text: 'spürbar, Loslassen möglich' },
    { id: 3, key: 'z3', sym: 'warn', name: 'Z3', text: 'Loslassen nicht möglich' },
    { id: 4, key: 'z4', sym: 'cross', name: 'Z4', text: 'Herzkammerflimmern möglich' }
  ];
  const zoneColor = (P, z) => P[ZONES[z] ? ZONES[z].key : 'grau'];

  function parseColor(c) {
    if (typeof c !== 'string') return null;
    const s = c.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(s);
    if (m) return [cl(+m[1], 0, 255), cl(+m[2], 0, 255), cl(+m[3], 0, 255), m[4] === undefined ? 1 : cl(+m[4], 0, 1)];
    return null;
  }
  const hex2 = v => ('0' + Math.round(cl(v, 0, 255)).toString(16)).slice(-2);
  /* Farbmischung a -> b (t 0..1) */
  function mix(a, b, t) {
    const A = parseColor(a), B = parseColor(b);
    if (!B) return typeof b === 'string' && goodColor(b) ? b : '#888888';
    if (!A || !fin(t)) return '#' + hex2(B[0]) + hex2(B[1]) + hex2(B[2]);
    t = cl(t, 0, 1);
    return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t);
  }
  /* Farbe mit Deckkraft als rgba-Text; nicht lesbare Farben bleiben unveraendert */
  function rgba(c, a) {
    const A = parseColor(c);
    if (!A) return goodColor(c) ? c : '#888888';
    return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + (Math.round(cl(fin(a) ? a : 1, 0, 1) * 1000) / 1000) + ')';
  }
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function lum(c) {
    const A = parseColor(c); if (!A) return NaN;
    return 0.2126 * lin(A[0]) + 0.7152 * lin(A[1]) + 0.0722 * lin(A[2]);
  }
  /* Kontrastverhaeltnis nach WCAG (>= 4,5 fuer Text) */
  function contrast(a, b) {
    const x = lum(a), y = lum(b);
    if (!(x >= 0) || !(y >= 0)) return NaN;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* Farbenblind-Simulation (Machado 2009, Schweregrad 1.0, im linearen RGB): 'protan' | 'deutan' | 'tritan' -> '#rrggbb' */
  const CVD = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
  };
  function cvd(c, kind) {
    const A = parseColor(c), M = CVD[kind]; if (!A || !M) return '#888888';
    const v = [lin(A[0]), lin(A[1]), lin(A[2])];
    const out = M.map(r => cl(r[0] * v[0] + r[1] * v[1] + r[2] * v[2], 0, 1));
    const g = u => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055) * 255;
    return '#' + hex2(g(out[0])) + hex2(g(out[1])) + hex2(g(out[2]));
  }
  /* palette(theme | Objekt): immer eine neue, vollstaendige Palette; Objekt ueberschreibt einzelne Farben (z. B. aus cssColors) */
  function palette(c) {
    let base = PAL.dark;
    if (c === 'light') base = PAL.light;
    else if (c && typeof c === 'object') {
      if (c.theme === 'light') base = PAL.light;
      else if (c.theme !== 'dark' && goodColor(c.bg) && lum(c.bg) > 0.45) base = PAL.light;
    }
    const out = Object.assign({}, base);
    if (c && typeof c === 'object') Object.keys(base).forEach(k => { if (typeof base[k] === 'string' && k !== 'theme' && goodColor(c[k])) out[k] = c[k]; });
    out.glow = base.glow;
    out.eb = { basis: out.basis, fehler: out.ebfehler, zusatz: out.zusatz };
    out.zone = [null, out.z1, out.z2, out.z3, out.z4];
    out.series = [out.fehler, out.neutral, out.pe, out.pfad, out.schutz, out.l1];
    return out;
  }
  /* Palette aus den Optionen: opts.palette (Objekt oder Text) vor opts.colors vor opts.theme */
  function pal(o) {
    o = obj(o);
    if (o.palette && (typeof o.palette === 'object' || typeof o.palette === 'string')) return palette(o.palette);
    if (o.colors) return palette(o.colors);
    return palette(o.theme);
  }
  /* liest die CSS-Variablen der Seite (--bg --panel --panel2 --fg --mute --line ...); ohne DOM leeres Objekt */
  function cssColors(el) {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return {};
    const out = {};
    try {
      const cs = getComputedStyle(el && el.nodeType === 1 ? el : document.documentElement);
      [['bg', '--bg'], ['panel', '--panel'], ['panel2', '--panel2'], ['fg', '--fg'], ['mute', '--mute'], ['line', '--line'], ['grid', '--grid'],
        ['fehler', '--els-fehler'], ['pe', '--els-pe'], ['neutral', '--els-neutral'], ['gruen', '--ok'], ['gelb', '--warn'], ['rot', '--danger']].forEach(p => {
        const v = cs.getPropertyValue(p[1]).trim();
        if (goodColor(v) && parseColor(v)) out[p[0]] = v;
      });
      if (out.bg && lum(out.bg) > 0.45) out.theme = 'light'; else if (out.bg) out.theme = 'dark';
    } catch (e) { /* ohne Stile: Standardpalette */ }
    return out;
  }
  function ampelColor(pl, state) { return pl[state === 'gruen' || state === 'gelb' || state === 'rot' ? state : 'grau']; }

  /* ---------------------------------------------------------------- Qualitaetsstufen (SPEC 6.4) */
  const QUAL = {
    hoch: { name: 'hoch', particles: 600, fieldLines: 24, glow: true, shadow: true, gradients: true },
    mittel: { name: 'mittel', particles: 300, fieldLines: 16, glow: true, shadow: false, gradients: true },
    niedrig: { name: 'niedrig', particles: 120, fieldLines: 8, glow: false, shadow: false, gradients: false }
  };
  const QORDER = ['niedrig', 'mittel', 'hoch'];
  /* opts = { quality, reduced }: reduced (prefers-reduced-motion) erzwingt niedrig */
  function qualityOf(o) {
    o = obj(o);
    const q = o.quality && QUAL[o.quality] ? o.quality : 'hoch';
    return QUAL[o.reduced === true ? 'niedrig' : q];
  }
  /* Regler fuer die Qualitaetsstufe (SPEC 6.4): gleitender Mittelwert der Bildzeit ueber 30 Bilder; > 22 ms: EINE Stufe zurueck,
   * < 10 ms ueber 3 s: eine Stufe hoch. frame(dtMs) liefert den Namen der aktuellen Stufe. reduced -> immer niedrig. */
  function createGovernor(opts) {
    opts = obj(opts);
    const N = 30, slow = nz(opts, 'slowMs', 22, 1, 5000), fast = nz(opts, 'fastMs', 10, 0.1, 5000), upMs = nz(opts, 'upAfterMs', 3000, 100, 600000);
    const buf = new Float64Array(N);
    let q = QUAL[opts.start] ? opts.start : 'hoch', cnt = 0, idx = 0, sum = 0, fastFor = 0, reduced = opts.reduced === true;
    function reset() { cnt = 0; idx = 0; sum = 0; fastFor = 0; buf.fill(0); }
    const g = {
      frame(dtMs) {
        if (!afin(dtMs) || dtMs < 0) return reduced ? 'niedrig' : q;
        dtMs = Math.min(dtMs, 1000);
        sum += dtMs - buf[idx]; buf[idx] = dtMs; idx = (idx + 1) % N; if (cnt < N) cnt++;
        if (reduced) return 'niedrig';
        const mean = sum / cnt;
        if (cnt >= N && mean > slow) { const i = QORDER.indexOf(q); if (i > 0) q = QORDER[i - 1]; reset(); return q; }
        if (cnt >= N && mean < fast) fastFor += dtMs; else fastFor = 0;
        if (fastFor >= upMs) { const i = QORDER.indexOf(q); if (i < QORDER.length - 1) q = QORDER[i + 1]; reset(); }
        return q;
      },
      quality() { return reduced ? 'niedrig' : q; },
      mean() { return cnt ? sum / cnt : 0; },
      set(name) { if (QUAL[name]) { q = name; reset(); } return g.quality(); },
      setReduced(f) { reduced = !!f; return g.quality(); }
    };
    return g;
  }

  /* ---------------------------------------------------------------- Zahlen und Text */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    let s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d);
    s = s.replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  /* wie fz, aber ohne nachgestellte Nullen (",50" -> ",5") */
  function fzt(v, d) { let s = fz(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; }
  /* Frequenz mit Einheitenvorsatz: 150 kHz, 30 MHz, 1,5 GHz */
  function fHz(f) {
    if (!fin(f) && !(afin(f) && Math.abs(f) < 1e12)) return '–';
    const a = Math.abs(f);
    if (a >= 1e9) return fzt(f / 1e9, a >= 1e10 ? 1 : 2) + ' GHz';
    if (a >= 1e6) return fzt(f / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + ' MHz';
    if (a >= 1e3) return fzt(f / 1e3, a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2) + ' kHz';
    return fzt(f, a >= 100 ? 0 : 1) + ' Hz';
  }
  function ticks(lo, hi, n) {
    if (!fin(lo) || !fin(hi) || !(hi > lo)) return { t: [], s: NaN };
    n = fin(n) ? Math.max(2, Math.min(20, Math.round(n))) : 4;
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const s = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    const k0 = Math.ceil(lo / s - 1e-9), t = [];
    for (let k = k0; t.length < 60; k++) { const v = k * s; if (v > hi + s * 1e-9) break; t.push(+v.toPrecision(12)); }
    return { t, s };
  }
  /* Ticks einer Logarithmusachse im 1-2-5-Raster: so dicht wie moeglich, hoechstens maxN Stueck */
  function logTicks(lo, hi, maxN) {
    if (!(lo > 0) || !(hi > lo) || !dfin(lo) || !dfin(hi)) return [];
    maxN = fin(maxN) ? Math.max(2, Math.floor(maxN)) : 8;
    const e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi));
    const gen = set => { const r = []; for (let e = e0; e <= e1 && e - e0 < 40; e++) set.forEach(m => { const v = m * Math.pow(10, e); if (v >= lo * 0.9999 && v <= hi * 1.0001) r.push(v); }); return r; };
    const sets = [[1, 2, 3, 5, 7], [1, 2, 5], [1, 3], [1]];
    for (let i = 0; i < sets.length; i++) { const r = gen(sets[i]); if (r.length <= maxN) return r; }
    const r = gen([1]), step = Math.ceil(r.length / maxN);
    return r.filter((v, i) => i % step === 0);
  }
  const digitsOfStep = s => (fin(s) && s > 0 ? Math.max(0, Math.min(4, Math.ceil(-Math.log10(s) - 1e-9))) : 0);
  const fsz = w => (w < 420 ? 11 : 12);      /* Mindestschrift: 12 px, bei 390 px Breite 11 px (SPEC 6.1) */

  /* ---------------------------------------------------------------- Zeichenbasis */
  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && typeof ctx.save === 'function' && typeof ctx.restore === 'function' &&
      typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function' &&
      typeof ctx.stroke === 'function' && typeof ctx.fill === 'function';
  }
  /* save, zeichnen, restore; Ausnahme im Zeichenteil -> restore und false */
  function draw(ctx, fn) {
    ctx.save();
    try { const r = fn(); ctx.restore(); return r === undefined ? true : r; } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorieren */ } return false; }
  }
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '') + (Math.round(size * 10) / 10) + 'px ' + FONT; }
  function tw(ctx, t, size, bold) {
    if (typeof ctx.measureText === 'function') { const m = ctx.measureText(t); if (m && fin(m.width)) return m.width; }
    return t.length * size * (bold ? 0.6 : 0.56);
  }
  function fitText(ctx, t, maxw, size, bold) {
    if (t === '' || !(maxw > 0)) return '';
    if (tw(ctx, t, size, bold) <= maxw) return t;
    let s = t;
    while (s.length > 1 && tw(ctx, s + '…', size, bold) > maxw) s = s.slice(0, -1);
    return s.length > 1 || tw(ctx, s + '…', size, bold) <= maxw ? s.replace(/\s+$/, '') + '…' : '';
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function poly(ctx, pts, close) {
    ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (close) ctx.closePath();
  }
  function normPts(pts, minN, chk) {
    chk = chk || fin;
    if (!Array.isArray(pts) || pts.length < (minN || 2) || pts.length > 4000) return null;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; let x, y;
      if (Array.isArray(p)) { x = p[0]; y = p[1]; } else if (p && typeof p === 'object') { x = p.x; y = p.y; } else return null;
      if (!chk(x) || !chk(y)) return null;
      out.push([x, y]);
    }
    return out;
  }
  function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  const NODASH = [];
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d); if (off !== undefined) ctx.lineDashOffset = off; }
  /* Rechteck pruefen und Mindestgroesse (SPEC 6.2): sonst null */
  function rectMin(rect, minW, minH) { return isRect(rect) && rect.w >= minW && rect.h >= minH ? rect : null; }

  /* ---------------------------------------------------------------- Pfeil und Beschriftung */
  function arrowRaw(ctx, x0, y0, x1, y1, head, color, width, dash) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (!(L > 0)) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(head, L), hw = hl * 0.42;
    const bx = x1 - ux * hl, by = y1 - uy * hl;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
    setDash(ctx, dash || NODASH);
    if (L > hl * 0.8) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx + ux * hl * 0.2, by + uy * hl * 0.2); ctx.stroke(); }
    setDash(ctx, NODASH);
    poly(ctx, [[x1, y1], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, o) {
    if (!okCtx(ctx) || !fin(x0) || !fin(y0) || !fin(x1) || !fin(y1) || !(Math.hypot(x1 - x0, y1 - y0) > 0)) return false;
    o = obj(o); const P = pal(o);
    const dash = Array.isArray(o.dash) && o.dash.length && o.dash.every(v => fin(v) && v >= 0) && o.dash.some(v => v > 0) ? o.dash.slice(0, 6) : null;
    return draw(ctx, () => arrowRaw(ctx, x0, y0, x1, y1, nz(o, 'head', 8, 2, 60), goodColor(o.color) ? o.color : P.fg, nz(o, 'width', 2, 0.5, 20), dash));
  }
  /* Textplatte + Text. align left|center|right, Grundlinie mittig; bg = Plattenfarbe (kein Text ueber Linien ohne Platte, SPEC 6.1) */
  function labelRaw(ctx, text, x, y, align, size, bold, color, bg, maxw) {
    font(ctx, size, bold);
    const t = maxw > 0 ? fitText(ctx, text, maxw, size, bold) : text;
    if (t === '') return false;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const w = tw(ctx, t, size, bold);
    if (bg) {
      const pw = w + 8, x0 = align === 'left' ? x - 4 : align === 'right' ? x - pw + 4 : x - pw / 2;
      ctx.fillStyle = bg; rrect(ctx, x0, y - size * 0.78, pw, size * 1.56, 4); ctx.fill();
    }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
    return w;
  }
  function label(ctx, text, x, y, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y)) return false;
    const t = typeof text === 'number' ? (fin(text) ? fzt(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '') return false;
    o = obj(o); const P = pal(o);
    const align = o.align === 'left' || o.align === 'right' ? o.align : 'center';
    return draw(ctx, () => labelRaw(ctx, t, x, y, align, nz(o, 'size', 12, 6, 80), !!o.bold, goodColor(o.color) ? o.color : P.fg,
      goodColor(o.bg) ? o.bg : null, nz(o, 'maxw', 0, 0, 5000)) !== false);
  }
  /* interne Kurzform ohne Pruefung (Ausnahmen faengt der aeussere draw): liefert Textbreite */
  function lab(ctx, text, x, y, align, size, color, bg, bold, maxw) {
    return labelRaw(ctx, String(text), x, y, align, size, !!bold, color, bg, maxw || 0);
  }

  function sym(ctx, kind, cx, cy, r, color, lw) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; setDash(ctx, NODASH);
    switch (kind) {
      case 'check': ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy + r * 0.02); ctx.lineTo(cx - r * 0.12, cy + r * 0.45); ctx.lineTo(cx + r * 0.6, cy - r * 0.42); ctx.stroke(); break;
      case 'warn': ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx, cy + r * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy + r * 0.52, Math.max(0.8, lw * 0.62), 0, Math.PI * 2); ctx.fill(); break;
      case 'cross': ctx.beginPath(); ctx.moveTo(cx - r * 0.48, cy - r * 0.48); ctx.lineTo(cx + r * 0.48, cy + r * 0.48);
        ctx.moveTo(cx + r * 0.48, cy - r * 0.48); ctx.lineTo(cx - r * 0.48, cy + r * 0.48); ctx.stroke(); break;
      case 'dash': ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx + r * 0.45, cy); ctx.stroke(); break;
      case 'plus': ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.stroke(); break;
      case 'minus': ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke(); break;
      case 'bolt': poly(ctx, [[cx + r * 0.15, cy - r * 0.7], [cx - r * 0.4, cy + r * 0.1], [cx - r * 0.02, cy + r * 0.1], [cx - r * 0.18, cy + r * 0.7], [cx + r * 0.42, cy - r * 0.15], [cx + r * 0.04, cy - r * 0.15]], true); ctx.fill(); break;
      case 'earth': ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy - r * 0.05);
        ctx.moveTo(cx - r * 0.5, cy - r * 0.05); ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
        ctx.moveTo(cx - r * 0.33, cy + r * 0.25); ctx.lineTo(cx + r * 0.33, cy + r * 0.25);
        ctx.moveTo(cx - r * 0.16, cy + r * 0.55); ctx.lineTo(cx + r * 0.16, cy + r * 0.55); ctx.stroke(); break;
      case 'dotout': ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r * 0.2), 0, Math.PI * 2); ctx.fill(); break;
      case 'dotin': ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.3); ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
        ctx.moveTo(cx + r * 0.3, cy - r * 0.3); ctx.lineTo(cx - r * 0.3, cy + r * 0.3); ctx.stroke(); break;
      default: return false;
    }
    return true;
  }
  const SYMS = ['check', 'warn', 'cross', 'dash', 'plus', 'minus', 'bolt', 'earth', 'dotout', 'dotin'];
  /* icon(ctx, kind, x, y, w, h, {color}): Symbol in der Box (x,y,w,h links oben). Unbekannte Art: false, nichts gezeichnet. */
  function icon(ctx, kind, x, y, w, h, o) {
    if (!okCtx(ctx) || SYMS.indexOf(kind) < 0 || !fin(x) || !fin(y) || !fin(w) || !fin(h) || !(w > 0) || !(h > 0)) return false;
    o = obj(o); const P = pal(o), r = Math.min(w, h) / 2;
    return draw(ctx, () => sym(ctx, kind, x + w / 2, y + h / 2, r, goodColor(o.color) ? o.color : P.fg, nz(o, 'width', Math.max(1.5, r * 0.18), 0.5, 12)));
  }

  /* Weltkoordinaten -> Pixel: Welt x0..x1, y0..y1 (y nach oben) in den freien Bereich des Rechtecks, gleicher Massstab */
  function fitWorld(rect, x0, x1, y0, y1, padL, padR, padT, padB) {
    const aw = rect.w - padL - padR, ah = rect.h - padT - padB;
    const s = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const ox = rect.x + padL + (aw - s * (x1 - x0)) / 2 - s * x0;
    const oy = rect.y + padT + (ah - s * (y1 - y0)) / 2 + s * y1;
    return { s, px: x => ox + x * s, py: y => oy - y * s };
  }
  /* Polylinie mit Mindestabstand ausduennen und durch Mittelpunkte glatt zeichnen (wenig Aufrufe) */
  function smoothPath(ctx, pts, minD) {
    if (pts.length < 2) return;
    const q = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const l = q[q.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minD) q.push(pts[i]); }
    q.push(pts[pts.length - 1]);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
    if (q.length === 2) { ctx.lineTo(q[1][0], q[1][1]); return; }
    for (let i = 1; i < q.length - 1; i++) ctx.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    ctx.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
  }
  function hatch(ctx, x, y, w, h, step, color) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -h; k < w; k += step) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  }
  /* ----------------------------------------------------------------- Partikelsystem (Pool fester Groesse) */
  /* createParticles(paths, opts) -> { step(dtMs), draw(ctx, o), setRate(pfad, r), setPaths(paths), count(), speedOf(pfad), pool, quality, reduced }
   *  paths = [{ id?, pts:[[x,y]...] (Polylinie), color?, rate 0..1 (Strom normiert), dir 1|-1, size (px), label? }]
   *  opts  = { quality ('hoch' 600 | 'mittel' 300 | 'niedrig' 120 Teilchen), reduced (statische Pfeile, keine Bewegung), seed, speed (px/s bei rate 1) }
   *  Geschwindigkeit = speed * rate, Dichte = rate * Grundichte (Teilchen je Pixel), Richtung: Farbe (Hin warm, Rueck gruencyan) und kleine Pfeile.
   *  Der Pool (Float32Array) wird einmal angelegt; step und draw erzeugen keine Objekte je Teilchen. */
  function createParticles(paths, opts) {
    opts = obj(opts);
    const Q = qualityOf(opts), cap = Math.max(8, Math.min(Q.particles, fin(opts.max) ? Math.floor(opts.max) : Q.particles));
    const rnd = rng(opts.seed), vmax = nz(opts, 'speed', 120, 1, 2000);
    const pos = new Float32Array(cap), spd = new Float32Array(cap);
    for (let i = 0; i < cap; i++) { pos[i] = rnd(); spd[i] = 0.9 + 0.2 * rnd(); }
    let P = [], reduced = opts.reduced === true;
    const pl = pal(opts);
    function prep(list) {
      P = []; if (!Array.isArray(list)) return;
      for (let k = 0; k < list.length && k < 32; k++) {
        const p = obj(list[k]), pts = normPts(p.pts); if (!pts) continue;
        const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const len = cum[cum.length - 1]; if (!(len > 0)) continue;
        const dir = p.dir === -1 ? -1 : 1;
        P.push({ id: typeof p.id === 'string' ? p.id : String(P.length), pts, cum, len, dir, a: 0, n: 0, rate: nz(p, 'rate', 0, 0, 1), size: nz(p, 'size', 3, 1, 12),
          color: goodColor(p.color) ? p.color : (dir > 0 ? pl.fehler : pl.pe) });
      }
      const tot = P.reduce((s, q) => s + q.len, 0) || 1, rho = Math.min(cap / tot, 0.2);
      let used = 0;
      P.forEach(q => { q.n = Math.max(2, Math.floor(q.len * rho)); if (used + q.n > cap) q.n = Math.max(0, cap - used); q.a = used; used += q.n; });
    }
    prep(paths);
    const find = ref => (typeof ref === 'number' ? P[ref] : P.find(q => q.id === ref));
    const act = q => (q.rate > 0 ? Math.min(q.n, Math.ceil(q.n * q.rate - 1e-9)) : 0);
    const tmp = [0, 0, 0];
    function locate(q, s, out) {
      const d = s * q.len; let i = 1;
      while (i < q.cum.length - 1 && q.cum[i] < d) i++;
      const a = q.pts[i - 1], b = q.pts[i], seg = (q.cum[i] - q.cum[i - 1]) || 1, u = cl((d - q.cum[i - 1]) / seg, 0, 1);
      out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const sys = {
      pool: cap, quality: Q.name,
      get reduced() { return reduced; },
      setReduced(f) { reduced = !!f; },
      setRate(ref, r) { const q = find(ref); if (!q || !afin(r)) return false; q.rate = cl(r, 0, 1); return true; },
      setPaths(list) { prep(list); },
      count() { let c = 0; P.forEach(q => { c += act(q); }); return c; },
      speedOf(ref) { const q = find(ref); return q ? vmax * q.rate : NaN; },
      step(dtMs) {
        if (!afin(dtMs) || reduced) return;
        const dt = cl(dtMs, 0, 100) / 1000;
        P.forEach(q => {
          const na = act(q); if (!na) return;
          const v = vmax * q.rate * dt / q.len * q.dir;
          for (let j = 0; j < na; j++) { const k = q.a + j; let s = pos[k] + v * spd[k]; s -= Math.floor(s); pos[k] = s; }
        });
      },
      /* Lage der Teilchen eines Pfades (Test und Rigs): [[x, y], ...] der aktiven Teilchen */
      positions(ref) { const q = find(ref), out = []; if (!q) return out; for (let j = 0; j < act(q); j++) { locate(q, pos[q.a + j], tmp); out.push([tmp[0], tmp[1]]); } return out; },
      draw(ctx, o) {
        if (!okCtx(ctx)) return false;
        o = obj(o);
        return draw(ctx, () => {
          const glow = Q.glow && !reduced && o.glow !== false;
          P.forEach(q => {
            // Richtungspfeile (statisch, auch bei reduzierter Bewegung): Richtung zusaetzlich zur Farbe
            ctx.fillStyle = q.color; ctx.globalAlpha = q.rate > 0 ? 0.95 : 0.35;
            const na = Math.max(1, Math.min(3, Math.floor(q.len / 90)));
            for (let k = 1; k <= na; k++) {
              locate(q, k / (na + 1), tmp);
              const ang = tmp[2] + (q.dir === -1 ? Math.PI : 0), hs = 5 + q.size;
              poly(ctx, [[tmp[0] + hs * Math.cos(ang), tmp[1] + hs * Math.sin(ang)], [tmp[0] + hs * Math.cos(ang + 2.45), tmp[1] + hs * Math.sin(ang + 2.45)],
                [tmp[0] + hs * Math.cos(ang - 2.45), tmp[1] + hs * Math.sin(ang - 2.45)]], true); ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (reduced) return;
            const na2 = act(q); if (!na2) return;
            if (glow) ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = q.color; ctx.globalAlpha = glow ? 0.85 : 1;
            ctx.beginPath();
            for (let j = 0; j < na2; j++) { locate(q, pos[q.a + j], tmp); ctx.rect(tmp[0] - q.size / 2, tmp[1] - q.size / 2, q.size, q.size); }
            ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          });
        });
      }
    };
    return sys;
  }
  /* ----------------------------------------------------------------- Wischer */
  const HANDLE_W = 44;     /* Griff >= 40 px (SPEC 6.2) */
  /* wipe(ctx, rect, drawA, drawB, pos): A links, B rechts der Teilungslinie (pos 0..1). drawA und drawB = function (ctx, rect).
   *  Rueckgabe false oder { x (Teilung), handle:{ x, y, w, h } }. */
  function wipe(ctx, rect, drawA, drawB, pos, o) {
    if (!okCtx(ctx) || !isRect(rect) || typeof drawA !== 'function' || typeof drawB !== 'function') return false;
    o = obj(o); const P = pal(o);
    const p = cl(fin(pos) ? pos : 0.5, 0, 1), sx = rect.x + rect.w * p;
    const names = Array.isArray(o.labels) ? o.labels : ['Vorher', 'Nachher'];
    return draw(ctx, () => {
      if (sx > rect.x) { ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, sx - rect.x, rect.h); ctx.clip(); try { drawA(ctx, rect); } finally { ctx.restore(); } }
      if (sx < rect.x + rect.w) { ctx.save(); ctx.beginPath(); ctx.rect(sx, rect.y, rect.x + rect.w - sx, rect.h); ctx.clip(); try { drawB(ctx, rect); } finally { ctx.restore(); } }
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, NODASH); ctx.beginPath(); ctx.moveTo(sx, rect.y); ctx.lineTo(sx, rect.y + rect.h); ctx.stroke();
      const hh = Math.max(HANDLE_W, 1), hy = rect.y + rect.h / 2, hx = cl(sx, rect.x + HANDLE_W / 2, rect.x + rect.w - HANDLE_W / 2);
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; dot(ctx, hx, hy, HANDLE_W / 2 - 2, P.panel2, P.fg, 2);
      ctx.fillStyle = P.fg; poly(ctx, [[hx - 15, hy], [hx - 7, hy - 6], [hx - 7, hy + 6]], true); ctx.fill(); poly(ctx, [[hx + 15, hy], [hx + 7, hy - 6], [hx + 7, hy + 6]], true); ctx.fill();
      const fs = fsz(rect.w);
      if (typeof names[0] === 'string' && hx - HANDLE_W / 2 - rect.x > 80) lab(ctx, names[0], hx - HANDLE_W / 2 - 6, hy, 'right', fs, P.fg, rgba(P.bg, 0.88), true);
      if (typeof names[1] === 'string' && rect.x + rect.w - hx - HANDLE_W / 2 > 80) lab(ctx, names[1], hx + HANDLE_W / 2 + 6, hy, 'left', fs, P.fg, rgba(P.bg, 0.88), true);
      return { x: sx, handle: { x: hx - HANDLE_W / 2, y: hy - hh / 2, w: HANDLE_W, h: hh } };
    });
  }
  /* Treffer auf den Griff (Beruehrungsflaeche mindestens 44 px breit, ueber die ganze Hoehe der Teilungslinie) */
  function wipeHit(rect, pos, px, py) {
    if (!isRect(rect) || !fin(pos) || !fin(px) || !fin(py)) return false;
    const sx = rect.x + rect.w * cl(pos, 0, 1);
    return Math.abs(px - sx) <= HANDLE_W / 2 && py >= rect.y && py <= rect.y + rect.h;
  }
  function wipePos(rect, px) { if (!isRect(rect) || !fin(px)) return NaN; return cl((px - rect.x) / rect.w, 0.02, 0.98); }

  /* =================================================================================================================
   *  C. Gemeinsame Helfer der Szenen, Ampel, Wirkungskette
   * ================================================================================================================= */
  const has = v => v !== undefined && v !== null;
  /* true, wenn eines der genannten Felder vorhanden aber keine brauchbare Zahl ist (dann zeichnet die Funktion nichts) */
  function badNums(o, keys) { for (let i = 0; i < keys.length; i++) if (has(o[keys[i]]) && !fin(o[keys[i]])) return true; return false; }
  /* Aufzaehlung: fehlt -> Vorgabe, gueltig -> Wert, sonst null (= ungueltig, false) */
  function enumOf(v, list, def) { if (!has(v)) return def; return list.indexOf(v) >= 0 ? v : null; }
  const textOr = (v, def) => (typeof v === 'string' && v.trim() !== '' ? v : def);
  function chkScene(ctx, rect, minW, minH) { return okCtx(ctx) && typeof ctx.fillText === 'function' && !!rectMin(rect, minW, minH); }
  function base(ctx, P, rect) {
    ctx.fillStyle = P.panel; rrect(ctx, rect.x, rect.y, rect.w, rect.h, 8); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; setDash(ctx, NODASH); ctx.stroke();
  }
  /* Text mit Platte, der garantiert im Rechteck bleibt (Verschiebung statt Ueberlauf); liefert die Textbreite */
  function mkText(ctx, rect, size) {
    return function (text, x, y, align, color, bg, bold, maxw) {
      const s = String(text); if (s === '') return 0;
      const pad = bg ? 8 : 0, room = rect.w - 4 - pad;
      const mw = Math.min(maxw > 0 ? maxw : room, room);
      font(ctx, size, bold);
      const t = fitText(ctx, s, mw, size, bold); if (t === '') return 0;
      const w = tw(ctx, t, size, bold);
      const left = (align === 'left' ? x : align === 'right' ? x - w : x - w / 2) - pad / 2;
      const dx = cl(left, rect.x + 2, rect.x + rect.w - 2 - w - pad) - left;
      const yy = cl(y, rect.y + size, rect.y + rect.h - size);
      labelRaw(ctx, t, x + dx, yy, align, size, !!bold, color, bg, 0);
      return w;
    };
  }
  const NOP = () => {};
  function wire(ctx, pts, color, w, halo) {
    if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = w + 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; setDash(ctx, NODASH); poly(ctx, pts, false); ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; setDash(ctx, NODASH); poly(ctx, pts, false); ctx.stroke();
  }
  /* Schutzleiter gruen-gelb: gruene Linie, gelb gestrichelt darueber (auch in Schwarz-Weiss als Strichmuster erkennbar) */
  function peWire(ctx, P, pts, w) {
    wire(ctx, pts, P.pe, w, null);
    ctx.strokeStyle = P.gelb; ctx.lineWidth = Math.max(1.2, w * 0.55); setDash(ctx, [5, 6]); poly(ctx, pts, false); ctx.stroke(); setDash(ctx, NODASH);
  }
  /* kleine Richtungspfeile entlang einer Polylinie (statisch: Richtung auch ohne Bewegung und ohne Farbe erkennbar) */
  function pathArrows(ctx, pts, color, n, size) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1]; if (!(L > 0)) return;
    ctx.fillStyle = color; setDash(ctx, NODASH);
    for (let k = 1; k <= n; k++) {
      const d = L * k / (n + 1); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const a = pts[i - 1], b = pts[i], sg = (cum[i] - cum[i - 1]) || 1, u = cl((d - cum[i - 1]) / sg, 0, 1);
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      poly(ctx, [[x + size * Math.cos(ang), y + size * Math.sin(ang)], [x + size * Math.cos(ang + 2.5), y + size * Math.sin(ang + 2.5)], [x + size * Math.cos(ang - 2.5), y + size * Math.sin(ang - 2.5)]], true); ctx.fill();
    }
  }
  function drawParticlesOf(o) { try { if (o && o.particles && typeof o.particles.draw === 'function') o.particles.draw(arguments[1]); } catch (e) { /* Partikel sind Beiwerk */ } }
  /* Erdungszeichen (Symbol) */
  function earthMark(ctx, x, y, r, color) { sym(ctx, 'earth', x, y, r, color, Math.max(1.5, r * 0.16)); }
  /* Pulsform fuer einmalige Aufhellungen: hz wird auf MAX_FLASH_HZ begrenzt (nichts blinkt haeufiger als 3 Hz) */
  function pulse(tMs, hz) {
    if (!afin(tMs)) return 0;
    const f = cl(afin(hz) && hz > 0 ? hz : 0.8, 0.05, MAX_FLASH_HZ);
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * f * tMs / 1000);
  }
  const fmtNum = v => fzt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

  /* ----------------------------------------------------------------- Ampel */
  const AMPEL = {
    gruen: { id: 'gruen', name: 'grün', sym: 'check', text: 'grün' },
    gelb: { id: 'gelb', name: 'gelb', sym: 'warn', text: 'gelb' },
    rot: { id: 'rot', name: 'rot', sym: 'cross', text: 'rot' },
    grau: { id: 'grau', name: 'grau', sym: 'dash', text: 'noch nicht geprüft' }
  };
  function ampelKey(a) {
    if (a && typeof a === 'object') a = a.ampel;
    a = typeof a === 'string' ? a.toLowerCase().replace('ü', 'ue') : '';
    return a === 'gruen' || a === 'gelb' || a === 'rot' || a === 'grau' ? a : null;
  }
  /* Text fuer aria-label des Hauptbildes: "Ampel grün, Marge 1,3" (marginText: fertiger Text, z. B. "Reserve 1,3") */
  function ampelText(state, marginText) {
    const k = ampelKey(state); if (!k) return '';
    const m = typeof marginText === 'string' && marginText ? marginText : (state && typeof state === 'object' && typeof state.marginText === 'string' ? state.marginText : '');
    return 'Ampel ' + AMPEL[k].name + (k === 'grau' ? ': noch nicht geprüft' : '') + (m ? ', ' + m : '');
  }
  /* ampel(ctx, x, y, state, o): Ampel mit Symbol (✓ ! ✗ –) und Text; (x, y) links oben.
   *  state = 'gruen'|'gelb'|'rot'|'grau' oder rig.assess()-Objekt ({ ampel, text }); o = { size (Gehaeuse 28...160, Vorgabe 64), text, marginText,
   *  hint (Zusatzzeile, z. B. TEXTS.ampelHinweis aus dem Kern), maxw, pulse (0..1, einmaliger Puls; nicht bei reduced), reduced, theme/palette }.
   *  Rueckgabe false oder { w, h, key } */
  function ampel(ctx, x, y, state, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y)) return false;
    const key = ampelKey(state); if (!key) return false;
    o = obj(o); const P = pal(o), A = AMPEL[key];
    const size = nz(o, 'size', 64, 28, 160), lw = size * 0.46, lr = size / 6.4, fs = Math.max(12, Math.min(18, Math.round(size / 4.4)));
    const mainText = textOr(o.text, state && typeof state === 'object' && typeof state.text === 'string' && state.text ? state.text : A.text);
    const mtxt = typeof o.marginText === 'string' && o.marginText ? o.marginText : (state && typeof state === 'object' && typeof state.marginText === 'string' ? state.marginText : '');
    const hint = typeof o.hint === 'string' ? o.hint : '';
    const color = ampelColor(P, key), pl = o.reduced !== true && fin(o.pulse) && o.pulse >= 0 && o.pulse <= 1 ? o.pulse : -1;
    const sc = pl > 0 && pl < 1 ? 1 + 0.16 * Math.sin(Math.PI * pl) : 1;
    const maxw = nz(o, 'maxw', 0, 0, 5000);
    return draw(ctx, () => {
      const cx = x + lw / 2, cy = y + size / 2;
      ctx.save();
      if (sc !== 1) { ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
      ctx.fillStyle = P.panel2; rrect(ctx, x, y, lw, size, lw * 0.3); ctx.fill();
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; ctx.stroke();
      ['rot', 'gelb', 'gruen'].forEach((k, i) => {
        const lx = x + lw / 2, ly = y + size * (0.2 + 0.3 * i), lit = k === key;
        dot(ctx, lx, ly, lr, rgba(ampelColor(P, k), lit ? 1 : 0.16), lit ? P.fg : P.line, lit ? 1.6 : 1);
        if (lit) sym(ctx, A.sym, lx, ly, lr * 1.5, P.bg, Math.max(1.8, lr * 0.28));
      });
      if (key === 'grau') { dot(ctx, x + lw / 2, y + size * 0.5, lr, rgba(P.grau, 0.9), P.fg, 1.6); sym(ctx, 'dash', x + lw / 2, y + size * 0.5, lr * 1.5, P.bg, Math.max(1.8, lr * 0.28)); }
      ctx.restore();
      const tx = x + lw + size * 0.18, wMax = maxw > 0 ? maxw - lw - size * 0.18 : 0;
      const lines = [{ t: mainText, b: true, c: color }];
      if (mtxt && key !== 'grau') lines.push({ t: mtxt, b: false, c: P.fg });
      if (hint) lines.push({ t: hint, b: false, c: P.mute });
      const gap = fs * 1.5, y0 = y + size / 2 - (lines.length - 1) * gap / 2;
      let wmax = 0;
      lines.forEach((l, i) => { const w = lab(ctx, l.t, tx, y0 + i * gap, 'left', fs, l.c, null, l.b, wMax); if (w) wmax = Math.max(wmax, w); });
      return { w: lw + size * 0.18 + wmax, h: size, key };
    });
  }

  /* ----------------------------------------------------------------- Wirkungskette Fehler - Weg - Schutz mit den drei Schutzebenen */
  /* chainBar(ctx, rect, chain, active, o): chain = { fehler, weg, schutz } (Texte, rig.pfad), active = 'basis'|'fehler'|'zusatz'|null (Schutzebene,
   * faerbt ihren Chip; die Bedienelemente tragen dieselben Farben, EBENEN ist die einzige Tabelle). Min 260 x 50. */
  function chainBar(ctx, rect, chain, active, o) {
    if (!chkScene(ctx, rect, 260, 50) || !chain || typeof chain !== 'object') return false;
    if (has(active) && !EBENEN[active]) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs);
    const gap = 14, bw = (rect.w - 2 * gap) / 3, rows = rect.h >= 74, bh = rows ? rect.h * 0.6 : rect.h;
    const items = [['fehler', 'Fehler', P.fehler, 'bolt'], ['weg', 'Weg', P.pfad, 'dotout'], ['schutz', 'Schutz', P.schutz, 'earth']];
    return draw(ctx, () => {
      items.forEach((it, i) => {
        const x = rect.x + i * (bw + gap), col = it[2], txt = textOr(chain[it[0]], '–');
        ctx.fillStyle = P.panel; rrect(ctx, x, rect.y, bw, bh, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.8; setDash(ctx, NODASH); ctx.stroke();
        sym(ctx, it[3], x + 14, rect.y + bh * 0.3, 7, col, 1.8);
        T(it[1], x + 26, rect.y + bh * 0.3, 'left', col, null, true, bw - 32);
        T(txt, x + 8, rect.y + bh * 0.7, 'left', P.fg, null, false, bw - 14);
        if (i < 2) { const ax = x + bw + 2, ay = rect.y + bh / 2; ctx.fillStyle = P.mute; poly(ctx, [[ax, ay - 6], [ax + gap - 4, ay], [ax, ay + 6]], true); ctx.fill(); }
      });
      if (rows) {
        const cw = (rect.w - 2 * gap) / 3, cy = rect.y + bh + (rect.h - bh) / 2;
        ['basis', 'fehler', 'zusatz'].forEach((k, i) => {
          const E = EBENEN[k], col = P.eb[k], on = active === k, x = rect.x + i * (cw + gap), h = Math.min(rect.h - bh - 4, 26);
          ctx.fillStyle = on ? rgba(col, 0.25) : P.panel; rrect(ctx, x, cy - h / 2, cw, h, 6); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.2; ctx.globalAlpha = on ? 1 : 0.8; ctx.stroke(); ctx.globalAlpha = 1;
          sym(ctx, E.sym, x + 12, cy, 6, col, 1.6);
          T(cw >= 110 ? E.name : E.short, x + 24, cy, 'left', col, null, true, cw - 28);
        });
      }
      return true;
    });
  }

  /* =================================================================================================================
   *  D. Strichfigur und Zonenbild
   * ================================================================================================================= */
  const BODY_PATHS = ['hand-fuss', 'hand-hand', 'hand-rumpf'];
  function figGeom(rect) {
    const H = Math.min(rect.h * 0.82, rect.w * 1.2), cx = rect.x + rect.w * 0.42, top = rect.y + (rect.h - H) / 2 + rect.h * 0.04;
    return {
      H, cx, top, head: [cx, top + 0.07 * H], neck: [cx, top + 0.14 * H], sh: top + 0.2 * H, hip: top + 0.55 * H, foot: top + 0.97 * H,
      rh: [cx + 0.27 * H, top + 0.42 * H], lh: [cx - 0.27 * H, top + 0.42 * H], chest: [cx, top + 0.34 * H]
    };
  }
  /* Strompfade (fuer createParticles und fuer das Zeichnen; gleiche Geometrie) */
  function bodyPaths(rect, path, rate) {
    if (!isRect(rect) || BODY_PATHS.indexOf(path) < 0) return [];
    const g = figGeom(rect), H = g.H, r = nz({ r: rate }, 'r', 0.5, 0, 1);
    let pts;
    if (path === 'hand-fuss') pts = [g.rh, [g.cx + 0.1 * H, g.sh], [g.cx, g.sh + 0.05 * H], [g.cx, g.hip], [g.cx + 0.1 * H, g.foot]];
    else if (path === 'hand-hand') pts = [g.rh, [g.cx + 0.1 * H, g.sh], [g.cx - 0.1 * H, g.sh], g.lh];
    else pts = [g.rh, [g.cx + 0.1 * H, g.sh], g.chest];
    return [{ id: 'koerper', pts, rate: r, dir: 1, color: null, size: 3 }];
  }
  /* bodyFigure: Strichfigur, beruehrtes Teil, Strompfad in der Zonenfarbe, Zonenplatte mit Symbol und Text. Min 120 x 140. */
  function bodyFigure(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 120, 140) || !st || typeof st !== 'object') return false;
    if (badNums(st, ['zone', 'current', 'rate']) || !has(st.zone) || !(st.zone >= 1 && st.zone <= 4) || Math.round(st.zone) !== st.zone) return false;
    const path = enumOf(st.path, BODY_PATHS, 'hand-fuss'); if (!path) return false;
    o = obj(o); const P = pal(o), zone = st.zone, zc = zoneColor(P, zone), Z = ZONES[zone], fs = fsz(rect.w), T = mkText(ctx, rect, fs);
    const rate = nz(st, 'rate', 0.5, 0, 1), paths = bodyPaths(rect, path, rate), pts = paths[0].pts, g = figGeom(rect), H = g.H;
    const label = typeof st.label === 'string' ? st.label : '';
    return draw(ctx, () => {
      base(ctx, P, rect);
      // Boden
      ctx.strokeStyle = P.mute; ctx.lineWidth = 2; setDash(ctx, NODASH); ctx.beginPath(); ctx.moveTo(rect.x + 8, g.foot); ctx.lineTo(rect.x + rect.w - 8, g.foot); ctx.stroke();
      hatch(ctx, rect.x + 8, g.foot, rect.w - 16, Math.min(8, rect.y + rect.h - g.foot - 2), 6, rgba(P.mute, 0.5));
      // beruehrtes Teil rechts (unter Spannung) und bei Hand-Hand links ein geerdetes Teil
      const bx = g.rh[0] + 3, by = g.rh[1] - 0.12 * H, bw = Math.min(0.22 * H, rect.x + rect.w - bx - 8), bh = 0.24 * H;
      if (bw > 10) {
        ctx.fillStyle = P.panel2; rrect(ctx, bx, by, bw, bh, 5); ctx.fill(); ctx.strokeStyle = P.fehler; ctx.lineWidth = 2; ctx.stroke();
        sym(ctx, 'bolt', bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.38, P.fehler, 1.5);
      }
      if (path === 'hand-hand') { ctx.strokeStyle = P.mute; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.lh[0] - 8, g.lh[1] - 0.12 * H); ctx.lineTo(g.lh[0] - 8, g.lh[1] + 0.12 * H); ctx.stroke(); earthMark(ctx, g.lh[0] - 8, g.lh[1] + 0.2 * H, 7, P.pe); }
      // Strompfad: breiter Hof in der Zonenfarbe, darueber Linie, Richtungspfeile
      wire(ctx, pts, rgba(zc, 0.32), 11, null);
      wire(ctx, pts, zc, 3.5, null);
      pathArrows(ctx, pts, zc, 2, 6);
      // Figur (Strichfigur ohne Gesicht, neutral)
      ctx.strokeStyle = P.fg; ctx.fillStyle = P.fg; ctx.lineWidth = Math.max(2.4, H * 0.022); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; setDash(ctx, NODASH);
      ctx.beginPath(); ctx.arc(g.head[0], g.head[1], 0.07 * H, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.neck[0], g.neck[1]); ctx.lineTo(g.cx, g.hip);
      ctx.moveTo(g.cx - 0.1 * H, g.sh); ctx.lineTo(g.cx + 0.1 * H, g.sh);
      ctx.moveTo(g.cx + 0.1 * H, g.sh); ctx.lineTo(g.rh[0], g.rh[1]);
      ctx.moveTo(g.cx - 0.1 * H, g.sh); ctx.lineTo(g.lh[0], g.lh[1]);
      ctx.moveTo(g.cx, g.hip); ctx.lineTo(g.cx - 0.1 * H, g.foot); ctx.moveTo(g.cx, g.hip); ctx.lineTo(g.cx + 0.1 * H, g.foot);
      ctx.stroke();
      // Zonenplatte oben links mit Symbol und Text
      const px = rect.x + 10, py = rect.y + 14;
      ctx.fillStyle = P.panel2; rrect(ctx, px - 4, py - 11, Math.min(rect.w - 12, 8 + 24 + 12 + 6.8 * (Z.name.length + Z.text.length + 2)), 22, 6); ctx.fill();
      ctx.strokeStyle = zc; ctx.lineWidth = 1.6; ctx.stroke();
      sym(ctx, Z.sym, px + 8, py, 8, zc, 2);
      T(Z.name + ' ' + Z.text, px + 22, py, 'left', zc, null, true, rect.w - 44);
      const lines = [];
      if (fin(st.current)) lines.push('Strom ' + fmtNum(st.current) + ' mA');
      if (label) lines.push(label);
      lines.forEach((t, i) => T(t, rect.x + 10, rect.y + rect.h - 12 - (lines.length - 1 - i) * (fs * 1.6), 'left', P.fg, rgba(P.panel, 0.9), false, rect.w - 22));
      drawParticlesOf(o, ctx);
      return { zone, path, paths };
    });
  }

  /* Zonengrenzen: Vorgabe = Lehrkurve (Z1 <= z1 mA, Z2 <= z2 mA, Z3 bis fl(t), darueber Z4); Rigs reichen die Werte aus dem Kern durch */
  function getBounds(b) {
    b = obj(b);
    const z1 = fin(b.z1) && b.z1 > 0 ? b.z1 : 0.5, z2 = fin(b.z2) && b.z2 > z1 ? b.z2 : Math.max(10, z1 * 2);
    let fl = t => 50 * Math.max(1, Math.sqrt(1000 / t));
    if (typeof b.fl === 'function') { try { const v = b.fl(100); if (fin(v) && v > 0 && fin(b.fl(10)) && fin(b.fl(10000))) fl = t => { const w = b.fl(t); return fin(w) && w > 0 ? w : 1e7; }; } catch (e) { /* Vorgabe */ } }
    return { z1, z2, fl };
  }
  /* Zone 1..4 aus Strom (mA), Zeit (ms) und Grenzen; NaN bei Unsinn */
  function zoneAt(I, tMs, bounds) {
    if (!fin(I) || !fin(tMs) || I < 0 || !(tMs > 0)) return NaN;
    const b = getBounds(bounds);
    if (I <= b.z1) return 1;
    if (I <= b.z2) return 2;
    return I <= b.fl(tMs) ? 3 : 4;
  }
  const ZPAT = [null, 'punkt', 'waag', 'schraeg', 'kreuz'];
  function zoneHatch(ctx, plot, kind, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1; setDash(ctx, NODASH); ctx.beginPath();
    if (kind === 'waag' || kind === 'kreuz') for (let y = plot.y; y <= plot.y + plot.h; y += 8) { ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); }
    if (kind === 'schraeg' || kind === 'kreuz') for (let k = -plot.h; k < plot.w; k += 9) { ctx.moveTo(plot.x + k, plot.y + plot.h); ctx.lineTo(plot.x + k + plot.h, plot.y); }
    if (kind === 'kreuz') for (let k = -plot.h; k < plot.w; k += 9) { ctx.moveTo(plot.x + k, plot.y); ctx.lineTo(plot.x + k + plot.h, plot.y + plot.h); }
    ctx.stroke();
    if (kind === 'punkt') { ctx.fillStyle = color; ctx.beginPath(); for (let y = plot.y + 4; y < plot.y + plot.h; y += 10) for (let x = plot.x + 4; x < plot.x + plot.w; x += 10) ctx.rect(x, y, 1.6, 1.6); ctx.fill(); }
  }
  /* zoneChart: Strom ueber Einwirkdauer (log-log), Zonen mit Farbe, Muster, Symbol und Text, Betriebspunkt. Min 200 x 140. */
  function zoneChart(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 200, 140) || !st || typeof st !== 'object') return false;
    if (!fin(st.I) || !fin(st.t) || st.I < 0 || !(st.t > 0)) return false;
    o = obj(o); const P = pal(o), B = getBounds(o.bounds), fs = fsz(rect.w), T = mkText(ctx, rect, fs);
    const zone = zoneAt(st.I, st.t, o.bounds), Z = ZONES[zone], zc = zoneColor(P, zone);
    const small = rect.w < 420, legendH = rect.h >= 210 ? (rect.w >= 440 ? 24 : 44) : 0;
    const plot = { x: rect.x + (small ? 44 : 50), y: rect.y + 26, w: rect.w - (small ? 44 : 50) - 12, h: rect.h - 26 - 38 - legendH };
    if (!(plot.w > 60 && plot.h > 50)) return false;
    const LT0 = 1, LT1 = 4, LI0 = -1, LI1 = 3;           /* log10 t in ms: 10 ms ... 10 s; log10 I in mA: 0,1 ... 1000 */
    const xAt = t => plot.x + plot.w * (Math.log10(cl(t, 10, 10000)) - LT0) / (LT1 - LT0);
    const yAt = i => plot.y + plot.h * (1 - (Math.log10(cl(i, 0.1, 1000)) - LI0) / (LI1 - LI0));
    const N = 48, ts = [], fl = [];
    for (let k = 0; k <= N; k++) { const t = Math.pow(10, LT0 + (LT1 - LT0) * k / N); ts.push(t); fl.push(Math.max(B.fl(t), B.z2)); }
    return draw(ctx, () => {
      base(ctx, P, rect);
      ctx.fillStyle = P.bg; ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
      const polys = [
        [[plot.x, yAt(0.1)], [plot.x + plot.w, yAt(0.1)], [plot.x + plot.w, yAt(B.z1)], [plot.x, yAt(B.z1)]],
        [[plot.x, yAt(B.z1)], [plot.x + plot.w, yAt(B.z1)], [plot.x + plot.w, yAt(B.z2)], [plot.x, yAt(B.z2)]],
        ts.map((t, k) => [xAt(t), yAt(B.z2)]).concat(ts.map((t, k) => [xAt(ts[N - k]), yAt(fl[N - k])])),
        ts.map((t, k) => [xAt(t), yAt(fl[k])]).concat([[plot.x + plot.w, plot.y], [plot.x, plot.y]])
      ];
      polys.forEach((pts, i) => {
        const col = zoneColor(P, i + 1);
        ctx.save(); poly(ctx, pts, true); ctx.clip();
        ctx.fillStyle = rgba(col, 0.26); ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
        zoneHatch(ctx, plot, ZPAT[i + 1], rgba(col, 0.75));
        ctx.restore();
      });
      // Grenzlinien
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.6; setDash(ctx, NODASH);
      ctx.beginPath(); ctx.moveTo(plot.x, yAt(B.z1)); ctx.lineTo(plot.x + plot.w, yAt(B.z1)); ctx.moveTo(plot.x, yAt(B.z2)); ctx.lineTo(plot.x + plot.w, yAt(B.z2)); ctx.stroke();
      ctx.beginPath(); ts.forEach((t, k) => { if (k) ctx.lineTo(xAt(t), yAt(fl[k])); else ctx.moveTo(xAt(t), yAt(fl[k])); }); ctx.stroke();
      // Raster und Achsen
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      [10, 100, 1000, 10000].forEach(t => { ctx.beginPath(); ctx.moveTo(xAt(t), plot.y); ctx.lineTo(xAt(t), plot.y + plot.h); ctx.stroke(); });
      [0.1, 1, 10, 100, 1000].forEach(i => { ctx.beginPath(); ctx.moveTo(plot.x, yAt(i)); ctx.lineTo(plot.x + plot.w, yAt(i)); ctx.stroke(); });
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);
      [10, 100, 1000, 10000].forEach(t => T(t >= 1000 ? fz(t / 1000, 0) + ' s' : fz(t, 0) + ' ms', xAt(t), plot.y + plot.h + 12, t === 10 ? 'left' : t === 10000 ? 'right' : 'center', P.mute, null, false, 60));
      [0.1, 1, 10, 100, 1000].forEach(i => T(fzt(i, 1), plot.x - 5, yAt(i), 'right', P.mute, null, false, plot.x - rect.x - 8));
      T('Einwirkdauer t, Strom I in mA, Lehrdarstellung', plot.x + plot.w / 2, plot.y + plot.h + 27, 'center', P.mute, null, false, rect.w - 12);
      // Zonenkennung rechts im Bild (Symbol + Kurzname)
      const mids = [Math.sqrt(0.1 * B.z1), Math.sqrt(B.z1 * B.z2), Math.sqrt(B.z2 * Math.max(B.fl(10000), B.z2 * 1.01)), Math.sqrt(Math.max(B.fl(10000), B.z2 * 1.01) * 1000)];
      mids.forEach((m, i) => {
        const col = zoneColor(P, i + 1), yy = yAt(m), xr = plot.x + plot.w - 6;
        ctx.fillStyle = rgba(P.panel, 0.92); rrect(ctx, xr - 38, yy - 9, 42, 18, 5); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
        sym(ctx, ZONES[i + 1].sym, xr - 28, yy, 6, col, 1.8);
        T(ZONES[i + 1].name, xr - 18, yy, 'left', col, null, true, 24);
      });
      // Kopfzeile: Zone des Betriebspunkts mit Symbol und Text
      sym(ctx, Z.sym, rect.x + 16, rect.y + 13, 8, zc, 2);
      T(Z.name + ' ' + Z.text, rect.x + 28, rect.y + 13, 'left', zc, null, true, rect.w - 38);
      // Betriebspunkt
      const mx = xAt(st.t), my = yAt(st.I), out = st.t < 10 || st.t > 10000 || st.I < 0.1 || st.I > 1000;
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2.5; setDash(ctx, NODASH); dot(ctx, mx, my, 7, rgba(zc, 0.9), P.fg, 2.5);
      sym(ctx, Z.sym, mx, my, 5, P.bg, 1.6);
      if (out) T('außerhalb', mx, my - 16, 'center', P.fg, rgba(P.panel, 0.92), false, 90);
      const tt = st.t < 1000 ? fz(st.t, st.t < 100 ? 1 : 0) + ' ms' : fz(st.t / 1000, 2) + ' s';
      const tx = mx > plot.x + plot.w * 0.55 ? mx - 12 : mx + 12;
      T(fmtNum(st.I) + ' mA, ' + tt, tx, my + (my < plot.y + 24 ? 18 : -18), tx < mx ? 'right' : 'left', P.fg, rgba(P.panel, 0.92), true, plot.w * 0.8);
      // Legende (nur bei genug Hoehe): Muster, Symbol, Name, Text
      if (legendH) {
        const cols = rect.w >= 440 ? 4 : 2, cw = (rect.w - 16) / cols;
        for (let i = 1; i <= 4; i++) {
          const k = i - 1, cx = rect.x + 8 + (k % cols) * cw, cy = rect.y + rect.h - legendH + 12 + Math.floor(k / cols) * 19, col = zoneColor(P, i);
          ctx.fillStyle = rgba(col, 0.3); ctx.fillRect(cx, cy - 7, 14, 14); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.strokeRect(cx, cy - 7, 14, 14);
          sym(ctx, ZONES[i].sym, cx + 7, cy, 5, col, 1.5);
          T(ZONES[i].name + ' ' + ZONES[i].text, cx + 19, cy, 'left', P.fg, null, false, cw - 24);
        }
      }
      return { zone, x: mx, y: my, plot: { x: plot.x, y: plot.y, w: plot.w, h: plot.h } };
    });
  }

  /* =================================================================================================================
   *  E. Fehlerschleife, Kennlinienband, LS-Schnitt, Summenstromwandler
   * ================================================================================================================= */
  const FORMS = ['TN-S', 'TN-C-S', 'TT', 'IT'], FAULTS = ['ohne', 'koerperschluss', 'pe-unterbrochen'];
  function loopGeom(rect) {
    const A = { x: rect.x + 8, y: rect.y + 8, w: rect.w * 0.74 - 8, h: rect.h - 16 };
    const tx = A.x + A.w * 0.1, ty = A.y + A.h * 0.5, r = Math.min(A.h * 0.15, A.w * 0.07);
    const bx = A.x + A.w * 0.3, bw = A.w * 0.7, by = A.y + A.h * 0.06, bh = A.h * 0.88;
    const dw = bw * 0.36, dx = bx + bw * 0.5, dy = by + bh * 0.34, dh = bh * 0.26, cxd = dx + dw / 2;
    const yL = A.y + A.h * 0.2, yPE = A.y + A.h * 0.8;
    return { A, tx, ty, r, bx, bw, by, bh, dx, dy, dw, dh, cxd, yL, yPE, yG: A.y + A.h * 0.92 };
  }
  /* Schleifenpfad (Partikel): Trafo - L - Gehaeuse (Koerperschluss) - PE - Trafo; gleiche Geometrie wie das Bild */
  function loopPaths(rect, st) {
    if (!isRect(rect)) return [];
    const g = loopGeom(rect), r = nz(obj(st), 'rate', 0, 0, 1);
    const pts = [[g.tx, g.ty - g.r], [g.tx, g.yL], [g.cxd, g.yL], [g.cxd, g.dy], [g.cxd, g.dy + g.dh], [g.cxd, g.yPE], [g.tx, g.yPE], [g.tx, g.ty + g.r]];
    return [{ id: 'schleife', pts, rate: r, dir: 1, color: null, size: 3 }];
  }
  /* loopScene: Gebaeude, Trafo, Netzform-Schild, Fehlerschleife, Gehaeusepotential als Balken. Min 240 x 150. */
  function loopScene(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 240, 150) || !st || typeof st !== 'object') return false;
    if (badNums(st, ['rate', 'ub', 'ul', 'zs', 'iF'])) return false;
    const form = enumOf(st.form, FORMS, 'TN-S'), fault = enumOf(st.fault, FAULTS, 'ohne');
    if (!form || !fault || (has(st.ub) && st.ub < 0) || (has(st.ul) && !(st.ul > 0))) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), g = loopGeom(rect);
    const flow = fault === 'koerperschluss', pebreak = fault === 'pe-unterbrochen', body = flow || pebreak, tripped = st.tripped === true;
    const rate = nz(st, 'rate', flow && !tripped ? 0.8 : 0, 0, 1), ul = nz(st, 'ul', 50, 1e-6), paths = loopPaths(rect, { rate });
    const pts = paths[0].pts;
    const bar = { x: rect.x + rect.w * 0.8, y: rect.y + 30, w: Math.min(30, rect.w * 0.1), h: rect.h - 70 };
    return draw(ctx, () => {
      base(ctx, P, rect);
      // Gebaeude
      ctx.fillStyle = P.panel2; rrect(ctx, g.bx, g.by, g.bw, g.bh, 6); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; setDash(ctx, NODASH); ctx.stroke();
      T('Gebäude', g.bx + 8, g.by + 11, 'left', P.mute, null, false, g.bw * 0.4);
      // Trafo: zwei Spulenkreise
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(g.tx, g.ty - g.r * 0.5, g.r * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(g.tx, g.ty + g.r * 0.5, g.r * 0.8, 0, Math.PI * 2); ctx.stroke();
      T('Trafo', g.tx, g.ty + g.r * 1.9 + 4, 'center', P.mute, null, false, 60);
      // Netzform-Schild
      const sw = Math.min(g.bw * 0.34, 74);
      ctx.fillStyle = P.panel; rrect(ctx, g.bx + g.bw - sw - 8, g.by + 4, sw, 22, 5); ctx.fill(); ctx.strokeStyle = P.neutral; ctx.lineWidth = 1.8; ctx.stroke();
      T(form, g.bx + g.bw - sw / 2 - 8, g.by + 15, 'center', P.neutral, null, true, sw - 6);
      // Leiter L (braun) und Schutzleiter (gruen-gelb)
      const lPts = [[g.tx, g.ty - g.r], [g.tx, g.yL], [g.cxd, g.yL], [g.cxd, g.dy]];
      wire(ctx, lPts, P.l1, 3.2, rgba(P.bg, 0.6));
      const peFrom = [g.cxd, g.dy + g.dh];
      const peGap = pebreak ? g.yPE - (g.yPE - peFrom[1]) * 0.45 : g.yPE;
      if (form === 'TT' || form === 'IT') {
        peWire(ctx, P, [peFrom, [g.cxd, g.yPE]], 3);
        earthMark(ctx, g.cxd, g.yPE + 9, 8, P.pe);
        if (form === 'TT') {
          earthMark(ctx, g.tx, g.yPE + 9, 8, P.pe);
          ctx.strokeStyle = P.mute; ctx.lineWidth = 1.6; setDash(ctx, [3, 4]); ctx.beginPath(); ctx.moveTo(g.tx, g.yG); ctx.lineTo(g.cxd, g.yG); ctx.stroke(); setDash(ctx, NODASH);
          T('Erdreich', (g.tx + g.cxd) / 2, g.yG - 9, 'center', P.mute, rgba(P.panel, 0.9), false, 80);
          peWire(ctx, P, [[g.tx, g.yPE], [g.tx, g.ty + g.r]], 3);
        } else {
          T('Trafo nicht geerdet', g.tx, g.yPE + 4, 'left', P.mute, rgba(P.panel, 0.9), false, g.bx - g.A.x + 10);
        }
      } else {
        peWire(ctx, P, [peFrom, [g.cxd, peGap]], 3);
        if (!pebreak) peWire(ctx, P, [[g.cxd, g.yPE], [g.tx, g.yPE], [g.tx, g.ty + g.r]], 3);
        else peWire(ctx, P, [[g.cxd, g.yPE - (g.yPE - peFrom[1]) * 0.25], [g.cxd, g.yPE], [g.tx, g.yPE], [g.tx, g.ty + g.r]], 3);
      }
      if (pebreak) {
        const by2 = (peGap + g.yPE - (g.yPE - peFrom[1]) * 0.25) / 2;
        sym(ctx, 'cross', g.cxd, by2, 8, P.rot, 2.6);
        T('PE unterbrochen', g.cxd - 12, by2, 'right', P.rot, rgba(P.panel, 0.92), true, g.dx - g.A.x - 6);
      }
      T('L', g.tx + 12, g.yL - 10, 'left', P.l1, null, true, 24);
      if (form !== 'IT' && !pebreak) T('PE', g.tx + 12, g.yPE - 10, 'left', P.pe, null, true, 30);
      // Geraet mit Gehaeuse
      ctx.fillStyle = P.panel; rrect(ctx, g.dx, g.dy, g.dw, g.dh, 5); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.4; ctx.stroke();
      T('Gerät', g.cxd, g.dy + g.dh + 12, 'center', P.mute, null, false, g.dw + 20);
      if (body) { sym(ctx, 'bolt', g.cxd, g.dy + g.dh / 2, Math.min(g.dh * 0.4, 12), P.fehler, 1.4); T('Körperschluss', g.dx + 4, g.dy - 9, 'left', P.fehler, rgba(P.panel, 0.92), true, g.bw * 0.5); }
      // geoeffnetes Schutzorgan (Abschaltung)
      if (tripped) {
        ctx.fillStyle = P.panel2; ctx.fillRect(g.bx - 7, g.yL - 7, 14, 14);
        ctx.strokeStyle = P.fg; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(g.bx - 6, g.yL); ctx.lineTo(g.bx + 4, g.yL - 7); ctx.stroke();
        T('abgeschaltet', g.bx + 10, g.yL + 15, 'left', P.fg, rgba(P.panel, 0.92), true, g.bw * 0.5);
      }
      pathArrows(ctx, pts, rgba(P.fehler, flow ? 1 : 0.35), 3, 5);
      // Messwerte
      const info = [];
      if (fin(st.zs)) info.push('Zs ' + fz(st.zs, 2) + ' Ω');
      if (fin(st.iF)) info.push('I_F ' + fmtNum(st.iF) + ' A');
      info.forEach((t, i) => T(t, g.A.x + 4, g.A.y + 11 + i * fs * 1.7, 'left', P.fg, rgba(P.panel, 0.92), false, g.bx - g.A.x));
      // Gehaeusepotential als Balken mit Grenzmarke
      ctx.fillStyle = P.bg; ctx.fillRect(bar.x, bar.y, bar.w, bar.h); ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
      const top = fin(st.ub) ? Math.max(ul * 2, st.ub * 1.1) : ul * 2;
      const yU = v => bar.y + bar.h * (1 - cl(v / top, 0, 1));
      let bk = 'grau', bsym = 'dash';
      if (fin(st.ub)) {
        bk = st.ub <= ul * 0.8 ? 'gruen' : st.ub <= ul ? 'gelb' : 'rot'; bsym = AMPEL[bk].sym;
        const col = P[bk];
        ctx.fillStyle = rgba(col, 0.6); ctx.fillRect(bar.x, yU(st.ub), bar.w, bar.y + bar.h - yU(st.ub)); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(bar.x, yU(st.ub), bar.w, bar.y + bar.h - yU(st.ub));
        sym(ctx, bsym, bar.x + bar.w / 2, cl(yU(st.ub) + 11, bar.y + 11, bar.y + bar.h - 11), 7, P.fg, 2);
      }
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.6; setDash(ctx, [5, 4]); ctx.beginPath(); ctx.moveTo(bar.x - 6, yU(ul)); ctx.lineTo(bar.x + bar.w + 6, yU(ul)); ctx.stroke(); setDash(ctx, NODASH);
      T('Grenze ' + fmtNum(ul) + ' V', bar.x + bar.w / 2, yU(ul) - 11, 'center', P.fg, rgba(P.panel, 0.92), false, rect.x + rect.w - bar.x + 6);
      T('Gehäuse', bar.x + bar.w / 2, bar.y - 12, 'center', P.mute, null, false, rect.x + rect.w - bar.x + 4);
      T(fin(st.ub) ? 'U_B ' + fmtNum(st.ub) + ' V' : 'U_B –', bar.x + bar.w / 2, bar.y + bar.h + 14, 'center', P.fg, null, true, rect.x + rect.w - bar.x + 4);
      drawParticlesOf(o, ctx);
      return { paths, bar: { x: bar.x, y: bar.y, w: bar.w, h: bar.h }, ampel: bk };
    });
  }

  /* tripBand: Kennlinienband log-log mit Arbeitspunkt. band = [[x, tMin, tMax], ...]. Min 200 x 140. */
  function bandOf(band) {
    if (!Array.isArray(band) || band.length < 2 || band.length > 2000) return null;
    const out = [];
    for (let i = 0; i < band.length; i++) {
      const p = band[i];
      if (!Array.isArray(p) || p.length < 3 || !fin(p[0]) || !fin(p[1]) || !fin(p[2]) || !(p[0] > 0) || !(p[1] > 0) || !(p[2] > 0)) return null;
      out.push([p[0], Math.min(p[1], p[2]), Math.max(p[1], p[2])]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
  function tripBand(ctx, rect, band, o) {
    if (!chkScene(ctx, rect, 200, 140)) return false;
    const B = bandOf(band); if (!B) return false;
    o = obj(o); const pt = o.point;
    if (has(pt) && (typeof pt !== 'object' || !fin(pt.x) || !(pt.x > 0) || (has(pt.t) && (!fin(pt.t) || !(pt.t > 0))))) return false;
    if (has(o.xa) && (!fin(o.xa) || !(o.xa > 0))) return false;
    const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), small = rect.w < 420;
    const plot = { x: rect.x + (small ? 46 : 54), y: rect.y + 26, w: rect.w - (small ? 46 : 54) - 12, h: rect.h - 26 - 38 };
    if (!(plot.w > 60 && plot.h > 50)) return false;
    const X0 = 0, X1 = 2, Y0 = -3, Y1 = 4;                     /* x: 1 ... 100 mal In; t: 1 ms ... 10000 s */
    const xAt = x => plot.x + plot.w * (Math.log10(cl(x, 1, 100)) - X0) / (X1 - X0);
    const yAt = t => plot.y + plot.h * (1 - (Math.log10(cl(t, 1e-3, 1e4)) - Y0) / (Y1 - Y0));
    const step = plot.h < 170 ? 2 : 1;
    return draw(ctx, () => {
      base(ctx, P, rect);
      ctx.fillStyle = P.bg; ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; setDash(ctx, NODASH);
      [1, 2, 5, 10, 20, 50, 100].forEach(x => { ctx.beginPath(); ctx.moveTo(xAt(x), plot.y); ctx.lineTo(xAt(x), plot.y + plot.h); ctx.stroke(); });
      const ye = []; for (let e = Y0; e <= Y1; e += step) ye.push(e);
      ye.forEach(e => { const y = yAt(Math.pow(10, e)); ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke(); });
      // Band
      const up = B.map(p => [xAt(p[0]), yAt(p[2])]), lo = B.map(p => [xAt(p[0]), yAt(p[1])]).reverse();
      ctx.fillStyle = rgba(P.schutz, 0.28); poly(ctx, up.concat(lo), true); ctx.fill();
      ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.2; poly(ctx, up, false); ctx.stroke();
      ctx.lineWidth = 2.2; setDash(ctx, [6, 4]); poly(ctx, lo.slice().reverse(), false); ctx.stroke(); setDash(ctx, NODASH);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);
      // Achsen
      [1, 2, 5, 10, 20, 50, 100].forEach(x => { if (x === 1 || x === 10 || x === 100 || plot.w > 280) T(fz(x, 0), xAt(x), plot.y + plot.h + 12, x === 1 ? 'left' : x === 100 ? 'right' : 'center', P.mute, null, false, 40); });
      ye.forEach(e => T(fzt(Math.pow(10, e), 3), plot.x - 5, yAt(Math.pow(10, e)), 'right', P.mute, null, false, plot.x - rect.x - 8));
      T('Strom als Vielfaches von In', plot.x + plot.w / 2, plot.y + plot.h + 27, 'center', P.mute, null, false, rect.w - 12);
      T(textOr(o.name, 'Auslösekennlinie') + ', t in s', rect.x + 10, rect.y + 13, 'left', P.fg, null, true, rect.w * 0.6);
      // Legende
      const lx = rect.x + rect.w - 8;
      ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.2; setDash(ctx, NODASH); ctx.beginPath(); ctx.moveTo(lx - 74, rect.y + 13); ctx.lineTo(lx - 56, rect.y + 13); ctx.stroke();
      if (rect.w >= 300) T('Band', lx - 50, rect.y + 13, 'left', P.fg, null, false, 50);
      // Ia und Arbeitspunkt
      if (has(o.xa)) {
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1.6; setDash(ctx, [5, 4]); ctx.beginPath(); ctx.moveTo(xAt(o.xa), plot.y); ctx.lineTo(xAt(o.xa), plot.y + plot.h); ctx.stroke(); setDash(ctx, NODASH);
        T('Ia ' + fzt(o.xa, 1) + ' · In', xAt(o.xa), plot.y + 10, o.xa > 50 ? 'right' : 'left', P.fg, rgba(P.panel, 0.92), false, plot.w * 0.6);
      }
      if (has(pt)) {
        const px = xAt(pt.x);
        ctx.strokeStyle = P.fehler; ctx.lineWidth = 1.6; setDash(ctx, [3, 4]); ctx.beginPath(); ctx.moveTo(px, plot.y); ctx.lineTo(px, plot.y + plot.h); ctx.stroke(); setDash(ctx, NODASH);
        if (has(pt.t)) {
          const py = yAt(pt.t); dot(ctx, px, py, 6, P.fehler, P.fg, 2);
          T(fzt(pt.x, 2) + ' · In, ' + fzt(pt.t, 3) + ' s', px > plot.x + plot.w * 0.6 ? px - 10 : px + 10, py + (py < plot.y + 24 ? 16 : -16), px > plot.x + plot.w * 0.6 ? 'right' : 'left', P.fg, rgba(P.panel, 0.92), true, plot.w * 0.8);
        } else T(fzt(pt.x, 2) + ' · In', px, plot.y + plot.h - 12, px > plot.x + plot.w * 0.6 ? 'right' : 'left', P.fg, rgba(P.panel, 0.92), true, plot.w * 0.6);
      }
      return { plot: { x: plot.x, y: plot.y, w: plot.w, h: plot.h } };
    });
  }

  /* breakerCut: Schnitt eines LS-Schalters: Bimetall biegt sich (Ueberlast), Magnetanker schlaegt (Kurzschluss), Kontakt und Handgriff. Min 200 x 130. */
  function breakerCut(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 200, 130) || !st || typeof st !== 'object' || badNums(st, ['thermal', 'magnet', 'x'])) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs);
    const th = nz(st, 'thermal', 0, 0, 1), mg = nz(st, 'magnet', 0, 0, 1), tripped = st.tripped === true, W = rect.w, H = rect.h;
    const hx = rect.x + 10, hy = rect.y + 24, hw = W - 20, hh = H - 38, ym = hy + hh * 0.52;
    return draw(ctx, () => {
      base(ctx, P, rect);
      ctx.fillStyle = P.panel2; rrect(ctx, hx, hy, hw, hh, 8); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.4; setDash(ctx, NODASH); ctx.stroke();
      T('LS-Schalter im Schnitt' + (fin(st.x) ? ', ' + fzt(st.x, 2) + ' · In' : ''), rect.x + 10, rect.y + 12, 'left', P.fg, null, true, W - 20);
      // Anschluss links, Bimetall, Spule, Kontakt, Anschluss rechts
      const x1 = hx + hw * 0.06, x2 = hx + hw * 0.16, x3 = hx + hw * 0.40, x4 = hx + hw * 0.46, x5 = hx + hw * 0.62, x6 = hx + hw * 0.70, x7 = hx + hw * 0.86, x8 = hx + hw * 0.94;
      wire(ctx, [[hx, ym], [x2, ym]], P.l1, 3, null);
      const bend = th * hh * 0.2, hot = mix(P.neutral, P.fehler, th);
      ctx.lineCap = 'butt'; ctx.lineWidth = 3.4; setDash(ctx, NODASH);
      ctx.strokeStyle = P.neutral; ctx.beginPath(); ctx.moveTo(x2, ym - 2); ctx.quadraticCurveTo((x2 + x3) / 2, ym - 2, x3, ym - 2 - bend); ctx.stroke();
      ctx.strokeStyle = hot; ctx.beginPath(); ctx.moveTo(x2, ym + 2); ctx.quadraticCurveTo((x2 + x3) / 2, ym + 2, x3, ym + 2 - bend); ctx.stroke();
      ctx.fillStyle = P.fg; ctx.fillRect(x2 - 4, ym - 9, 6, 18);
      wire(ctx, [[x3, ym - bend], [x4, ym]], P.l1, 3, null);
      ctx.strokeStyle = P.pfad; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x4, ym);
      const n = 4, cw = (x5 - x4) / n; for (let i = 0; i < n; i++) ctx.arc(x4 + cw * (i + 0.5), ym, cw / 2, Math.PI, 0, false);
      ctx.stroke();
      wire(ctx, [[x5, ym], [x6, ym]], P.l1, 3, null);
      // Magnetanker (Schlagbolzen) unter der Spule: kippt mit magnet
      const ax = (x4 + x5) / 2, ay = ym + hh * 0.26, ang = -mg * 0.6, al = hh * 0.3;
      ctx.strokeStyle = P.fg; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax - al * Math.cos(ang), ay - al * Math.sin(ang) * 0 + 0); ctx.lineTo(ax + al * Math.cos(ang), ay + al * Math.sin(ang)); ctx.stroke();
      dot(ctx, ax, ay, 3.5, P.fg, null);
      // Kontakt: beweglicher Arm klappt auf, wenn ausgeloest
      const open = tripped ? 1 : 0, kx = x6, ky = ym, ex = x7 - 4, ey2 = ym - open * hh * 0.28;
      ctx.strokeStyle = P.l1; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ex, ey2); ctx.stroke();
      dot(ctx, x7, ym, 4, P.fg, null); dot(ctx, x6, ym, 3, P.fg, null);
      wire(ctx, [[x7, ym], [x8, ym], [hx + hw, ym]], P.l1, 3, null);
      // Handgriff
      const gx = hx + hw * 0.78, gy = hy + hh * 0.1;
      ctx.strokeStyle = P.fg; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx, gy + 4); ctx.lineTo(gx + (tripped ? 10 : -6), gy - 12 + (tripped ? 8 : 0)); ctx.stroke();
      const hw1 = T(tripped ? 'AUS ausgelöst' : 'EIN', gx - 6, gy + 18, 'right', tripped ? P.rot : P.gruen, rgba(P.panel2, 0.92), true, hw * 0.4);
      sym(ctx, tripped ? 'cross' : 'check', gx - 6 - hw1 - 16, gy + 18, 6, tripped ? P.rot : P.gruen, 2);
      // Beschriftung
      T('Bimetall: Überlast', (x2 + x3) / 2, ym + hh * 0.2, 'center', P.fg, rgba(P.panel2, 0.92), false, hw * 0.34);
      T('Spule, Anker: Kurzschluss', (x4 + x5) / 2, ym + hh * 0.42, 'center', P.fg, rgba(P.panel2, 0.92), false, hw * 0.46);
      T('Kontakt', (x6 + x7) / 2, ym + hh * 0.2, 'center', P.fg, rgba(P.panel2, 0.92), false, hw * 0.3);
      return true;
    });
  }

  /* sumTransformer: Summenstromwandler (Ansicht von oben): Hin- und Rueckleiter durch den Ring, Feldlinien heben sich auf, Differenz sichtbar. Min 200 x 130. */
  function sumTransformer(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 200, 130) || !st || typeof st !== 'object' || badNums(st, ['iL', 'iN', 'diff', 'idn'])) return false;
    if (!fin(st.iL) || !fin(st.iN) || st.iL < 0 || st.iN < 0 || (has(st.idn) && !(st.idn > 0)) || (has(st.diff) && st.diff < 0)) return false;
    o = obj(o); const P = pal(o), Q = qualityOf(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs);
    const diff = fin(st.diff) ? st.diff : Math.abs(st.iL - st.iN), tripped = st.tripped === true, big = Math.max(st.iL, st.iN, 1e-9);
    const R = Math.min(rect.w * 0.2, rect.h * 0.34), r = R * 0.62, cx = rect.x + rect.w * 0.27, cy = rect.y + rect.h * 0.52, lines = Q.name === 'hoch' ? 8 : Q.name === 'mittel' ? 6 : 3;
    const dl = [cx - r * 0.38, cy], dn = [cx + r * 0.38, cy];
    return draw(ctx, () => {
      base(ctx, P, rect);
      T('Summenstromwandler, Ansicht von oben', rect.x + 10, rect.y + 12, 'left', P.fg, null, true, rect.w - 20);
      // Ring
      ctx.fillStyle = P.panel2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, NODASH); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      // Feldkreise um L (gegen den Uhrzeigersinn, orange) und N (im Uhrzeigersinn, blau); Staerke ~ Strom
      [[dl, st.iL, P.fehler, -1], [dn, st.iN, P.neutral, 1]].forEach(a => {
        const k = cl(a[1] / big, 0, 1), rad = r * 0.3, n = Math.max(1, Math.round(lines * 0.4 * k) + 1);
        ctx.strokeStyle = a[2]; ctx.fillStyle = a[2]; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35 + 0.65 * k;
        for (let i = 0; i < Math.min(2, n); i++) { ctx.beginPath(); ctx.arc(a[0][0], a[0][1], rad * (1 + i * 0.55), 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        const aa = a[3] > 0 ? 0.6 : -0.6 + Math.PI;
        poly(ctx, [[a[0][0] + rad * Math.cos(aa) + 4 * -a[3] * Math.sin(aa), a[0][1] + rad * Math.sin(aa) - 4 * -a[3] * Math.cos(aa)], [a[0][0] + rad * Math.cos(aa) - 4 * Math.cos(aa), a[0][1] + rad * Math.sin(aa) - 4 * Math.sin(aa)], [a[0][0] + rad * Math.cos(aa) + 4 * a[3] * Math.sin(aa), a[0][1] + rad * Math.sin(aa) - 4 * a[3] * Math.cos(aa)]], true); ctx.fill();
      });
      sym(ctx, 'dotout', dl[0], dl[1], 6, P.fehler, 2); sym(ctx, 'dotin', dn[0], dn[1], 6, P.neutral, 2);
      // Fluss im Ring nur, wenn die Felder sich nicht aufheben
      const kd = cl(diff / big, 0, 1), nf = diff > 0 ? Math.max(1, Math.round(lines * kd)) : 0;
      if (nf > 0) {
        ctx.fillStyle = P.fehler; ctx.globalAlpha = 0.5 + 0.5 * kd;
        for (let i = 0; i < nf; i++) { const a = -Math.PI / 2 + (i / Math.max(nf, 1)) * Math.PI * 2, rm = (R + r) / 2, x = cx + rm * Math.cos(a), y = cy + rm * Math.sin(a), tg = a + Math.PI / 2;
          poly(ctx, [[x + 5 * Math.cos(tg), y + 5 * Math.sin(tg)], [x + 4 * Math.cos(tg + 2.5), y + 4 * Math.sin(tg + 2.5)], [x + 4 * Math.cos(tg - 2.5), y + 4 * Math.sin(tg - 2.5)]], true); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      T(nf > 0 ? 'Felder heben sich nicht auf' : 'Felder heben sich auf', cx, cy + R + 14, 'center', nf > 0 ? P.fehler : P.fg, rgba(P.panel, 0.92), false, rect.w * 0.5);
      // Spule am Ring und Ausloeser
      const sx = cx + R + 4, ssx = rect.x + rect.w * 0.52;
      ctx.strokeStyle = P.pfad; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx + (R + r) / 2 + 2, cy - 12); for (let i = 0; i < 3; i++) ctx.arc(sx + 6, cy - 10 + i * 10, 5, -Math.PI / 2, Math.PI / 2, false); ctx.stroke();
      wire(ctx, [[sx + 10, cy + 12], [ssx, cy + 12]], P.pfad, 1.8, null);
      ctx.fillStyle = tripped ? rgba(P.rot, 0.25) : P.panel2; rrect(ctx, ssx, cy - 6, 44, 30, 5); ctx.fill(); ctx.strokeStyle = tripped ? P.rot : P.fg; ctx.lineWidth = 2; ctx.stroke();
      sym(ctx, tripped ? 'cross' : 'check', ssx + 22, cy + 9, 8, tripped ? P.rot : P.gruen, 2.2);
      T(tripped ? 'löst aus' : 'bleibt', ssx + 22, cy + 32, 'center', tripped ? P.rot : P.fg, null, true, 60);
      // Werte rechts
      const tx = rect.x + rect.w - 8, ty = rect.y + 30;
      T('L hin ' + fmtNum(st.iL) + ' mA', tx, ty, 'right', P.fehler, null, true, rect.w * 0.4);
      T('N zurück ' + fmtNum(st.iN) + ' mA', tx, ty + fs * 1.7, 'right', P.neutral, null, true, rect.w * 0.4);
      T('Differenz ' + fmtNum(diff) + ' mA', tx, ty + fs * 3.4, 'right', P.fg, null, true, rect.w * 0.4);
      // Differenzbalken gegen IΔn (nur mit Vorgabe), Marken bei 0,5 und 1 mal IΔn
      if (has(st.idn)) {
        const bx = ssx + 56, bw = rect.x + rect.w - 10 - bx, by = rect.y + rect.h - 22;
        if (bw > 40) {
          const top = Math.max(st.idn * 2, diff * 1.05), xx = v => bx + bw * cl(v / top, 0, 1);
          ctx.fillStyle = P.bg; ctx.fillRect(bx, by - 6, bw, 12); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(bx, by - 6, bw, 12);
          const col = diff >= st.idn ? P.rot : diff >= st.idn * 0.5 ? P.gelb : P.gruen;
          ctx.fillStyle = rgba(col, 0.7); ctx.fillRect(bx, by - 6, xx(diff) - bx, 12);
          ctx.strokeStyle = P.fg; ctx.lineWidth = 1.6; [0.5, 1].forEach(m => { ctx.beginPath(); ctx.moveTo(xx(st.idn * m), by - 10); ctx.lineTo(xx(st.idn * m), by + 10); ctx.stroke(); });
          T('IΔn ' + fmtNum(st.idn) + ' mA', xx(st.idn), by - 17, 'right', P.fg, null, false, bw);
        }
      }
      return true;
    });
  }

  /* =================================================================================================================
   *  F. Geraeteschnitt, Pruefplatz, Isolations-Schaltbild, Schaltschrank
   * ================================================================================================================= */
  const SKS = ['I', 'II', 'III'];
  function devGeom(rect) {
    const H = { x: rect.x + rect.w * 0.2, y: rect.y + rect.h * 0.14, w: rect.w * 0.6, h: rect.h * 0.62 };
    const D = { x: H.x + H.w * 0.2, y: H.y + H.h * 0.3, w: H.w * 0.6, h: H.h * 0.42 };
    const cx = D.x + D.w / 2, ly = D.y + D.h * 0.5, ey = rect.y + rect.h - 20;
    return { H, D, cx, ly, ey };
  }
  /* Fehlerpfad im Geraet (Partikel): L - Geraet - Isolationsfehler - Gehaeuse - Schutzleiter - Erde */
  function devicePaths(rect, st) {
    if (!isRect(rect)) return [];
    const g = devGeom(rect), r = nz(obj(st), 'rate', 0, 0, 1);
    return [{ id: 'fehler', pts: [[rect.x + 6, g.ly], [g.D.x, g.ly], [g.cx, g.ly], [g.cx, g.D.y + g.D.h], [g.cx, g.H.y + g.H.h], [g.cx, g.ey]], rate: r, dir: 1, color: null, size: 3 }];
  }
  /* deviceCut: Geraetequerschnitt mit Gehaeuse, Isolierung, Schutzleiter und Fehlerpfad. Min 200 x 140. */
  function deviceCut(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 200, 140) || !st || typeof st !== 'object' || badNums(st, ['rate'])) return false;
    const sk = enumOf(st.sk, SKS, 'I'); if (!sk) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), g = devGeom(rect), H = g.H, D = g.D;
    const pe = has(st.pe) ? st.pe === true : sk === 'I', fault = st.fault === true, tripped = st.tripped === true;
    const rate = nz(st, 'rate', fault && !tripped ? 0.8 : 0, 0, 1), paths = devicePaths(rect, { rate });
    return draw(ctx, () => {
      base(ctx, P, rect);
      // Gehaeuse (aussen) und Isolierung (innen, schraffiert); SK II doppelt
      ctx.fillStyle = P.panel2; rrect(ctx, H.x, H.y, H.w, H.h, 8); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 3; setDash(ctx, NODASH); ctx.stroke();
      if (sk === 'II') { ctx.strokeStyle = P.mute; ctx.lineWidth = 1.5; rrect(ctx, H.x + 5, H.y + 5, H.w - 10, H.h - 10, 6); ctx.stroke(); }
      hatch(ctx, H.x + 8, H.y + H.h - 12, H.w - 16, 8, 5, rgba(P.mute, 0.6));
      T(sk === 'II' ? 'Gehäuse, Schutzisolierung' : 'Gehäuse', H.x + 8, H.y - 10, 'left', P.fg, null, false, H.w);
      // Geraet
      ctx.fillStyle = P.panel; rrect(ctx, D.x, D.y, D.w, D.h, 5); ctx.fill(); ctx.strokeStyle = P.mute; ctx.lineWidth = 2; ctx.stroke();
      T('Gerät', D.x + D.w / 2, D.y + D.h * 0.28, 'center', P.mute, null, false, D.w - 6);
      // Aussenleiter L (braun) in das Geraet
      wire(ctx, [[rect.x + 6, g.ly], [D.x, g.ly]], P.l1, 3.2, rgba(P.bg, 0.6));
      T('L', rect.x + 12, g.ly - 12, 'left', P.l1, null, true, 24);
      // Schutzleiter am Gehaeuse (nur wenn vorhanden)
      if (sk === 'I') {
        if (pe) { peWire(ctx, P, [[g.cx, H.y + H.h], [g.cx, g.ey - 8]], 3); earthMark(ctx, g.cx, g.ey + 2, 8, P.pe); T('PE', g.cx + 14, H.y + H.h + 14, 'left', P.pe, null, true, 30); }
        else { ctx.strokeStyle = P.rot; ctx.lineWidth = 2; setDash(ctx, [3, 4]); ctx.beginPath(); ctx.moveTo(g.cx, H.y + H.h); ctx.lineTo(g.cx, H.y + H.h + 14); ctx.stroke(); setDash(ctx, NODASH); sym(ctx, 'cross', g.cx, H.y + H.h + 24, 7, P.rot, 2.2); T('PE fehlt', g.cx + 14, H.y + H.h + 24, 'left', P.rot, null, true, 80); }
      }
      // Schutzklassen-Symbol
      const sx = H.x + H.w - 22, sy = H.y + 22;
      ctx.strokeStyle = P.fg; ctx.fillStyle = P.fg; ctx.lineWidth = 2;
      if (sk === 'I') earthMark(ctx, sx, sy, 10, P.pe);
      else if (sk === 'II') { ctx.strokeRect(sx - 9, sy - 9, 18, 18); ctx.strokeRect(sx - 4.5, sy - 4.5, 9, 9); }
      else { poly(ctx, [[sx, sy - 11], [sx + 11, sy], [sx, sy + 11], [sx - 11, sy]], true); ctx.stroke(); T('III', sx, sy, 'center', P.fg, null, true, 22); }
      // Isolationsfehler: Blitz vom Geraet zum Gehaeuse
      if (fault) {
        ctx.strokeStyle = P.fehler; ctx.lineWidth = 2.6; setDash(ctx, NODASH);
        ctx.beginPath(); ctx.moveTo(g.cx, D.y + D.h); ctx.lineTo(g.cx - 4, D.y + D.h + (H.y + H.h - D.y - D.h) * 0.4); ctx.lineTo(g.cx + 4, D.y + D.h + (H.y + H.h - D.y - D.h) * 0.7); ctx.lineTo(g.cx, H.y + H.h - 3); ctx.stroke();
        sym(ctx, 'bolt', g.cx + 22, D.y + D.h + (H.y + H.h - D.y - D.h) * 0.5, 7, P.fehler, 1.5);
        T('Körperschluss', g.cx - 24, D.y + D.h + (H.y + H.h - D.y - D.h) * 0.5, 'right', P.fehler, rgba(P.panel, 0.92), true, rect.w * 0.4);
      }
      if (tripped) T('abgeschaltet', rect.x + rect.w - 8, rect.y + rect.h - 10, 'right', P.fg, rgba(P.panel, 0.92), true, rect.w * 0.4);
      pathArrows(ctx, paths[0].pts, rgba(P.fehler, fault ? 1 : 0.3), 2, 5);
      drawParticlesOf(o, ctx);
      return { paths };
    });
  }

  /* benchScene: Pruefplatz mit Pruefling, Messgeraet, Ampel und den vier Pruefschritten in fester Reihenfolge. Min 260 x 140. */
  const STEPS = [['sicht', 'Sichtprüfung', 'Sicht'], ['rpe', 'Schutzleiterwiderstand', 'Rpe'], ['riso', 'Isolationswiderstand', 'Riso'], ['ipe', 'Strom (Schutzleiter, Berührung)', 'Ipe']];
  const STATI = { offen: ['dash', 'offen'], ok: ['check', 'in Ordnung'], fehler: ['cross', 'Fehler'], entfaellt: ['minus', 'entfällt'] };
  function benchScene(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 260, 140) || !st || typeof st !== 'object') return false;
    const sk = enumOf(st.sk, SKS, 'I'); if (!sk) return false;
    let steps = {};
    if (has(st.steps)) {
      if (!Array.isArray(st.steps) || st.steps.length > 8) return false;
      for (let i = 0; i < st.steps.length; i++) { const s = st.steps[i]; if (!s || typeof s !== 'object' || !STEPS.some(q => q[0] === s.id) || !STATI[s.status]) return false; steps[s.id] = s.status; }
    }
    const ak = has(st.ampel) ? ampelKey(st.ampel) : 'grau'; if (!ak) return false;
    if (has(st.reading) && !(typeof st.reading === 'string' || fin(st.reading))) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), narrow = rect.w < 420;
    const reading = typeof st.reading === 'string' ? st.reading : fin(st.reading) ? fmtNum(st.reading) : '–', devName = textOr(st.device, 'Prüfling');
    const chipH = 34, chipY = rect.y + 8, gap = 10, cw = (rect.w - 16 - 3 * gap) / 4, sy = chipY + chipH + 14, tableY = rect.y + rect.h - 22;
    return draw(ctx, () => {
      base(ctx, P, rect);
      STEPS.forEach((s, i) => {
        const x = rect.x + 8 + i * (cw + gap), status = steps[s[0]] || (s[0] === 'rpe' && sk !== 'I' ? 'entfaellt' : 'offen'), cc = status === 'ok' ? P.gruen : status === 'fehler' ? P.rot : P.grau, S = STATI[status];
        ctx.fillStyle = P.panel2; rrect(ctx, x, chipY, cw, chipH, 6); ctx.fill(); ctx.strokeStyle = cc; ctx.lineWidth = status === 'offen' || status === 'entfaellt' ? 1.2 : 2.4; setDash(ctx, status === 'entfaellt' ? [4, 3] : NODASH); ctx.stroke(); setDash(ctx, NODASH);
        sym(ctx, S[0], x + 12, chipY + chipH * 0.32, 6, cc, 2);
        T((i + 1) + ' ' + (narrow ? s[2] : s[1]), x + 22, chipY + chipH * 0.32, 'left', P.fg, null, true, cw - 26);
        T(S[1], x + 8, chipY + chipH * 0.72, 'left', cc, null, false, cw - 12);
        if (i < 3) { ctx.fillStyle = P.mute; poly(ctx, [[x + cw + 2, chipY + chipH / 2 - 5], [x + cw + gap - 2, chipY + chipH / 2], [x + cw + 2, chipY + chipH / 2 + 5]], true); ctx.fill(); }
      });
      // Tisch
      ctx.strokeStyle = P.mute; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rect.x + 8, tableY); ctx.lineTo(rect.x + rect.w - 8, tableY); ctx.stroke();
      const sh = Math.min(tableY - sy - 4, 120), pw = Math.min(rect.w * 0.3, 130), mw = Math.min(rect.w * 0.3, 130);
      // Pruefling links
      ctx.fillStyle = P.panel2; rrect(ctx, rect.x + 14, tableY - sh, pw, sh, 6); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.4; ctx.stroke();
      T(devName, rect.x + 14 + pw / 2, tableY - sh + 14, 'center', P.fg, null, true, pw - 8);
      T('Schutzklasse ' + sk, rect.x + 14 + pw / 2, tableY - sh + 14 + fs * 1.6, 'center', P.mute, null, false, pw - 8);
      if (sk === 'I') earthMark(ctx, rect.x + 14 + pw / 2, tableY - 18, 8, P.pe);
      else if (sk === 'II') { ctx.strokeStyle = P.fg; ctx.lineWidth = 1.8; ctx.strokeRect(rect.x + 14 + pw / 2 - 8, tableY - 28, 16, 16); ctx.strokeRect(rect.x + 14 + pw / 2 - 4, tableY - 24, 8, 8); }
      // Pruefleitung zum Messgeraet
      const mx = rect.x + rect.w / 2 - mw / 2;
      wire(ctx, [[rect.x + 14 + pw, tableY - sh * 0.4], [mx, tableY - sh * 0.4]], P.neutral, 2, null);
      // Messgeraet mit Anzeige
      ctx.fillStyle = P.panel2; rrect(ctx, mx, tableY - sh, mw, sh, 6); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = P.bg; rrect(ctx, mx + 8, tableY - sh + 8, mw - 16, Math.max(18, sh * 0.42), 4); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();
      T(reading, mx + mw / 2, tableY - sh + 8 + Math.max(18, sh * 0.42) / 2, 'center', P.fg, null, true, mw - 22);
      T('Prüfgerät', mx + mw / 2, tableY - 12, 'center', P.mute, null, false, mw - 8);
      // Ampel rechts
      const asz = Math.max(28, Math.min(sh, 64)), ax = rect.x + rect.w - 8 - asz * 0.46 - 8;
      ampel(ctx, Math.max(mx + mw + 10, rect.x + rect.w - 16 - asz * 0.46 - Math.min(rect.w * 0.22, 100)), tableY - sh, ak, Object.assign({}, o, { size: asz, text: ak === 'grau' ? 'offen' : undefined, maxw: Math.min(rect.w * 0.3, 130) }));
      return true;
    });
  }

  /* isoCircuit: Pruefling als Schaltbild: Leckpfade parallel (R_Material || R_Feuchte || ...) oder Schutzleiter in Reihe, Messleitungen mit Kontaktwiderstand. Min 240 x 140. */
  function isoCircuit(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 240, 140) || !st || typeof st !== 'object' || badNums(st, ['rk'])) return false;
    const art = enumOf(st.art, ['riso', 'rpe'], 'riso'), mode = enumOf(st.mode, ['2L', '4L'], '2L'); if (!art || !mode) return false;
    if (has(st.rk) && st.rk < 0) return false;
    if (!Array.isArray(st.branches) || st.branches.length < 1) return false;
    const br = [];
    for (let i = 0; i < st.branches.length && i < 5; i++) { const b = st.branches[i]; if (!b || typeof b !== 'object' || !fin(b.r) || !(b.r > 0)) return false; br.push({ name: textOr(b.name, 'Pfad ' + (i + 1)), r: b.r }); }
    if (has(st.rMeas) && !(typeof st.rMeas === 'string' || fin(st.rMeas))) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), unit = textOr(st.unit, art === 'riso' ? 'MΩ' : 'Ω');
    const meas = typeof st.rMeas === 'string' ? st.rMeas : fin(st.rMeas) ? fmtNum(st.rMeas) + ' ' + unit : '';
    const L = rect.x + 12, Rr = rect.x + rect.w - 12, yT = rect.y + 44, yB = rect.y + rect.h - 40;
    return draw(ctx, () => {
      base(ctx, P, rect);
      T(art === 'riso' ? 'Isolationswiderstand: Leckpfade parallel' : 'Schutzleiterwiderstand: Messung', rect.x + 10, rect.y + 13, 'left', P.fg, null, true, rect.w - 20);
      // Pruefling-Rahmen
      const px = rect.x + rect.w * 0.32, pw = rect.x + rect.w - 12 - px;
      ctx.fillStyle = P.panel2; rrect(ctx, px, yT - 14, pw, yB - yT + 28, 7); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, NODASH); ctx.stroke();
      // Messgeraet und Leitungen links
      const gx = L + 14, gy = (yT + yB) / 2;
      ctx.fillStyle = P.panel; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; dot(ctx, gx, gy, 14, P.panel, P.fg, 2);
      T(art === 'riso' ? 'U' : 'Ω', gx, gy, 'center', P.fg, null, true, 24);
      const rkTxt = fin(st.rk) ? 'R_K ' + fz(st.rk, 2) + ' Ω' : 'R_K';
      [yT, yB].forEach((y, i) => {
        wire(ctx, [[gx, gy + (i ? 14 : -14)], [gx, y], [px - 22, y]], P.neutral, 2, null);
        ctx.fillStyle = P.panel; rrect(ctx, px - 46, y - 5, 22, 10, 2); ctx.fill(); ctx.strokeStyle = P.fehler; ctx.lineWidth = 1.6; ctx.stroke();
        wire(ctx, [[px - 24, y], [px + 6, y]], P.neutral, 2, null);
      });
      T(rkTxt, px - 35, yT - 14, 'center', P.fehler, rgba(P.panel, 0.92), false, 90);
      // 4-Leiter: eigene Messabgriffe direkt am Pruefling
      if (mode === '4L') {
        ctx.strokeStyle = P.pfad; ctx.lineWidth = 1.6; setDash(ctx, [4, 3]);
        ctx.beginPath(); ctx.moveTo(gx + 14, gy - 6); ctx.lineTo(px + 6, yT + 12); ctx.moveTo(gx + 14, gy + 6); ctx.lineTo(px + 6, yB - 12); ctx.stroke(); setDash(ctx, NODASH);
      }
      if (art === 'riso') {
        const n = br.length, cwid = (pw - 30) / n;
        wire(ctx, [[px + 6, yT], [px + pw - 8, yT]], P.neutral, 2, null); wire(ctx, [[px + 6, yB], [px + pw - 8, yB]], P.neutral, 2, null);
        br.forEach((b, i) => {
          const x = px + 20 + cwid * (i + 0.5), h = Math.max(18, (yB - yT) * 0.36);
          wire(ctx, [[x, yT], [x, (yT + yB) / 2 - h / 2]], P.neutral, 2, null); wire(ctx, [[x, (yT + yB) / 2 + h / 2], [x, yB]], P.neutral, 2, null);
          ctx.fillStyle = P.panel; rrect(ctx, x - 7, (yT + yB) / 2 - h / 2, 14, h, 2); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.8; ctx.stroke();
          T(b.name, x, yT + (yB - yT) * 0.12, 'center', P.mute, null, false, cwid - 2);
          T(fzt(b.r, 2) + ' ' + unit, x, yB - (yB - yT) * 0.1, 'center', P.fg, rgba(P.panel2, 0.92), false, cwid + 8);
        });
      } else {
        const b = br[0], x1 = px + 18, x2 = px + pw - 18, h = 16;
        wire(ctx, [[px + 6, yT], [x1, yT], [x1, (yT + yB) / 2 - h]], P.neutral, 2, null); wire(ctx, [[x1, (yT + yB) / 2 + h], [x1, yB], [px + 6, yB]], P.neutral, 2, null);
        peWire(ctx, P, [[x1, (yT + yB) / 2 - h], [x1, (yT + yB) / 2 + h]], 3);
        ctx.fillStyle = P.panel; rrect(ctx, x1 - 8, (yT + yB) / 2 - h, 16, 2 * h, 2); ctx.fill(); ctx.strokeStyle = P.pe; ctx.lineWidth = 2.2; ctx.stroke();
        T(b.name + ' ' + fzt(b.r, 3) + ' ' + unit, x1 + 16, (yT + yB) / 2, 'left', P.fg, rgba(P.panel2, 0.92), false, x2 - x1);
      }
      T(mode === '2L' ? '2-Leiter: Messspitze zählt mit' : '4-Leiter: Abgriff getrennt', rect.x + 10, rect.y + rect.h - 26, 'left', P.fg, null, false, rect.w - 20);
      if (meas) T('Messwert ' + meas, rect.x + rect.w - 10, rect.y + rect.h - 26, 'right', P.fg, rgba(P.panel, 0.92), true, rect.w * 0.5);
      T('Nur am freigeschalteten, getrennten Prüfling', rect.x + 10, rect.y + rect.h - 10, 'left', P.mute, null, false, rect.w - 20);
      return true;
    });
  }

  /* cabinetScene: Schaltschrank mit Hauptschalter, Schloss, Pruefer-Symbol, Erdungsseil und Absperrband; je erledigter Regel erscheint ein Teil. Min 220 x 150. */
  const RULE_NAMES = ['Freischalten', 'Gegen Wiedereinschalten sichern', 'Spannungsfreiheit feststellen', 'Erden und kurzschließen', 'Benachbarte Teile abdecken'];
  function cabinetScene(ctx, rect, st, o) {
    if (!chkScene(ctx, rect, 220, 150) || !st || typeof st !== 'object' || !fin(st.done) || st.done < 0 || st.done > 5 || Math.round(st.done) !== st.done) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w), T = mkText(ctx, rect, fs), n = st.done;
    const names = Array.isArray(o.names) && o.names.length === 5 && o.names.every(s => typeof s === 'string' && s) ? o.names : RULE_NAMES;
    const wide = rect.w >= 420, C = { x: rect.x + 12, y: rect.y + 14, w: Math.min(rect.w * (wide ? 0.34 : 0.4), 200), h: rect.h - 40 };
    return draw(ctx, () => {
      base(ctx, P, rect);
      ctx.fillStyle = P.panel2; rrect(ctx, C.x, C.y, C.w, C.h, 6); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.6; setDash(ctx, NODASH); ctx.stroke();
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.4; ctx.strokeRect(C.x + 8, C.y + 8, C.w - 16, C.h - 16);
      // 1 Hauptschalter: EIN (oben, Blitz) oder AUS (unten, Haken)
      const hx = C.x + C.w * 0.5, hy = C.y + C.h * 0.28;
      ctx.fillStyle = P.panel; rrect(ctx, hx - 15, hy - 16, 30, 32, 5); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = n >= 1 ? P.gruen : P.fehler; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + (n >= 1 ? 10 : -10)); ctx.stroke();
      T(n >= 1 ? 'AUS' : 'EIN', hx + 22, hy, 'left', n >= 1 ? P.gruen : P.fehler, null, true, 40);
      // 2 Schloss
      const lx = hx - 30, ly = hy;
      if (n >= 2) { ctx.fillStyle = P.gelb; rrect(ctx, lx - 8, ly - 3, 16, 13, 2); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(lx, ly - 3, 5.5, Math.PI, 0, false); ctx.stroke(); }
      else { ctx.strokeStyle = P.mute; ctx.lineWidth = 1.4; setDash(ctx, [3, 3]); rrect(ctx, lx - 8, ly - 3, 16, 13, 2); ctx.stroke(); setDash(ctx, NODASH); }
      // 3 Pruefer (nur Symbol)
      const tx = C.x + C.w * 0.3, ty = C.y + C.h * 0.62;
      dot(ctx, tx, ty, 13, n >= 3 ? rgba(P.gruen, 0.25) : P.panel, n >= 3 ? P.gruen : P.mute, 2);
      sym(ctx, n >= 3 ? 'check' : 'dash', tx, ty, 11, n >= 3 ? P.gruen : P.mute, 2.2);
      T('Prüfer', tx, ty + 24, 'center', P.mute, null, false, 60);
      // 4 Erdungsseil
      const ex = C.x + C.w * 0.72, ey = C.y + C.h * 0.62;
      if (n >= 4) { wire(ctx, [[ex, ey - 12], [ex + 12, ey + 6], [ex, ey + 18]], P.pe, 3, null); earthMark(ctx, ex, ey + 30, 8, P.pe); }
      else { ctx.strokeStyle = P.mute; ctx.lineWidth = 1.4; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(ex, ey - 12); ctx.lineTo(ex, ey + 18); ctx.stroke(); setDash(ctx, NODASH); }
      // 5 Absperrband quer vor dem Schrank
      if (n >= 5) {
        const bx = C.x - 6, bw = C.w + 12, by = C.y + C.h - 18, bh = 11;
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); ctx.fillStyle = P.gelb; ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = P.bg; ctx.lineWidth = 4; ctx.beginPath(); for (let x = bx - bh; x < bx + bw; x += 14) { ctx.moveTo(x, by + bh); ctx.lineTo(x + bh, by); } ctx.stroke(); ctx.restore();
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, bw, bh);
      }
      // Regelliste rechts: Nummer, Symbol, Name
      const lx0 = C.x + C.w + 16, lw = rect.x + rect.w - 10 - lx0, rh = (rect.h - 22) / 5;
      names.forEach((nm, i) => {
        const y = rect.y + 14 + rh * (i + 0.5), done = i < n, cur = i === n, col = done ? P.gruen : cur ? P.fg : P.mute;
        ctx.fillStyle = P.panel2; rrect(ctx, lx0, y - rh * 0.4, lw, rh * 0.8, 5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = cur ? 2.4 : 1.2; setDash(ctx, NODASH); ctx.stroke();
        sym(ctx, done ? 'check' : 'dash', lx0 + 12, y, 6, col, 2);
        T((i + 1) + ' ' + nm, lx0 + 24, y, 'left', done ? P.gruen : P.fg, null, cur, lw - 28);
      });
      T(n + ' von 5 erledigt', C.x + C.w / 2, rect.y + rect.h - 11, 'center', P.fg, null, true, C.w + 20);
      return { done: n };
    });
  }

  /* =================================================================================================================
   *  G. Oeffentliche Schnittstelle
   * ================================================================================================================= */
  const api = {
    version: VERSION,
    // Bausteine (SPEC 7)
    bodyFigure, zoneChart, loopScene, tripBand, breakerCut, sumTransformer, deviceCut, benchScene, isoCircuit, cabinetScene, chainBar, ampel, createParticles, wipe,
    // Pfade und Hilfen der Bausteine (vor dem Zeichnen fuer das Partikelsystem)
    bodyPaths, loopPaths, devicePaths, zoneAt, wipeHit, wipePos,
    // Hilfen
    label, arrow, icon, palette, cssColors, fz, fzt, ticks, logTicks, mix, rgba, contrast, lum, rng, fsz, cvd, pulse,
    // Tabellen und Zusatz fuer Rigs und Tests
    EBENEN, ZONES, AMPEL, RULE_NAMES, STEPS, QUAL, qualityOf, createGovernor, ampelText, ampelKey, TEXT_KEYS, WIRE_KEYS, MAX_FLASH_HZ, HANDLE_W
  };
  api.fns = ['bodyFigure', 'zoneChart', 'loopScene', 'tripBand', 'breakerCut', 'sumTransformer', 'deviceCut', 'benchScene', 'isoCircuit', 'cabinetScene', 'chainBar', 'ampel',
    'createParticles', 'wipe', 'label', 'arrow', 'icon', 'palette', 'cssColors', 'fz', 'ticks', 'mix', 'version'];
  root.ELS_DRAW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
