'use strict';
/* Tonfunk Ladungssicherungs-Lab: reine Rechenlogik (Kennung 'lad'). window.LAD_CORE bzw. module.exports.
   ALLE Zurr-, Reib- und Mengenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Konventionen: Kräfte in N (daN = N / 10), Maße der Ladefläche in cm, Ortsfaktor g = 9,81 m/s².
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  /* Aufrunden mit Schutz gegen Rundungsfehler (3,0000000001 bleibt 3) */
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|kg|daN|dan|n|kn|mm|cm|m|°|grad|%|mal|paletten|gurte|punkte)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Kräfte und Reibung ---------- */
  const G = 9.81;
  /* PRUEFEN P1: g = 9,81 m/s². In der Praxis (VDI 2700, EN 12195-1) wird oft mit g ≈ 10 m/s² bzw. "1 kg ≈ 1 daN" gerechnet. Welche Konvention soll in der Ausbildung gelten? */
  const gForce = m => (num(m) >= 0 ? m * G : NAN);
  const massFromForce = F => (num(F) >= 0 ? F / G : NAN);
  const friction = (mu, m) => (num(mu) >= 0 && num(m) >= 0 ? mu * m * G : NAN);
  const accelForce = (m, c) => (num(m) >= 0 && num(c) >= 0 ? m * G * c : NAN);
  const toDaN = N => N / 10;

  /* Reibbeiwerte µ (Gleitreibung) als Übungswerte */
  /* PRUEFEN P2: Die µ-Werte (Holz/Siebdruck trocken 0,45 und nass 0,3, Antirutschmatte 0,6, Kunststoff/Stahl 0,2, Stahl geölt 0,1) sind Übungswerte in Anlehnung an VDI 2700 Blatt 2 / EN 12195-1. Mit der Tabelle im Lehrmaterial vergleichen. */
  const MU = [
    { id: 'holz', n: 'Holzpalette auf Siebdruck-Ladeboden, trocken', mu: 0.45 },
    { id: 'holzn', n: 'Holzpalette auf Siebdruck-Ladeboden, nass', mu: 0.3 },
    { id: 'matte', n: 'Holzpalette auf Antirutschmatte', mu: 0.6 },
    { id: 'kunst', n: 'Kunststoffpalette auf Stahlblech', mu: 0.2 },
    { id: 'stahl', n: 'Stahl auf Stahl, geölt', mu: 0.1 }
  ];
  /* Beschleunigungsbeiwerte c (Vielfaches von g) */
  /* PRUEFEN P3: Vorwärts 0,8 · seitlich 0,5 · rückwärts 0,5 sind die in der Aufgabe vorgegebenen vereinfachten Werte (EN 12195-1 nennt für Straße vorwärts 0,8, seitlich und rückwärts 0,5). Stimmt das so für den Unterricht? */
  const DIRS = [
    { k: 'v', n: 'nach vorn (Vollbremsung)', short: 'vorwärts', c: 0.8 },
    { k: 's', n: 'zur Seite (Kurvenfahrt)', short: 'seitlich', c: 0.5 },
    { k: 'r', n: 'nach hinten (Anfahren, Rückwärtsbewegung)', short: 'rückwärts', c: 0.5 }
  ];
  const dirOf = k => DIRS.find(d => d.k === k) || DIRS[0];
  /* Ladung rutscht, wenn die Reibung kleiner ist als der Beschleunigungsbeiwert (µ < c) */
  const slips = (c, mu) => (num(c) >= 0 && num(mu) >= 0 ? mu < c - 1e-12 : false);
  /* Sicherungskraft in N, die die Zurrmittel aufbringen müssen: m · g · (c − µ), nie kleiner als 0 */
  const secureForce = (m, c, mu) => (num(m) >= 0 && num(c) >= 0 && num(mu) >= 0 ? Math.max(0, m * G * (c - mu)) : NAN);
  /* Direktzurren (vereinfacht): jeder Gurt hält höchstens LC (daN) in Zugrichtung; Zugrichtung = Kraftrichtung, Zurrwinkel vernachlässigt.
     mu = 0: Reibung wird nicht angerechnet. */
  /* PRUEFEN P4: Direktzurren ohne Winkelfaktor und ohne Faktor 2 für Schlingenzurren gerechnet (vereinfachte Übungsformel n = m·g·(c−µ) / LC). Ist diese Vereinfachung für das 1.–2. Lehrjahr in Ordnung? */
  function lashDirect(m, c, mu, LC) {
    const F = secureForce(m, c, mu || 0); if (!(num(LC) > 0) || !fin(F)) return NAN;
    return ceilN(F / (LC * 10));
  }
  /* Niederzurren (vereinfacht): n = m · g · (c − µ) / (2 · µ · STF · sin α); STF in daN, Faktor 2 = zwei Gurtseiten der Schlaufe, µ > 0 nötig */
  /* PRUEFEN P5: Formel n = m·g·(c−µ·cz)/(2·µ·STF·sinα) mit cz = 1, Faktor 2 für beide Gurtseiten, ohne Reibungsverlust der Ratsche (in der Praxis wird die Vorspannkraft oft geringer angesetzt). Passt das zur Lehrbuchform? */
  function lashDown(m, c, mu, STF, alpha) {
    const a = alpha == null ? 90 : alpha;
    if (!(num(mu) > 0) || !(num(STF) > 0) || !(a > 0 && a <= 90)) return NAN;
    const F = secureForce(m, c, mu); if (!fin(F)) return NAN;
    if (F === 0) return 0;
    return ceilN(F / (2 * mu * STF * 10 * Math.sin(a * Math.PI / 180)));
  }

  /* ---------- Stapelung und Standsicherheit ---------- */
  const PAL_H = 144; /* Höhe einer Europalette in mm */
  const palHeight = (lagen, hLage) => (num(lagen) >= 0 && num(hLage) >= 0 ? PAL_H + lagen * hLage : NAN);
  /* Wie viele gleiche Paletten passen übereinander in eine Raumhöhe (mm) */
  const stackCount = (raumH, palH) => (num(raumH) >= 0 && num(palH) > 0 ? Math.floor(raumH / palH + 1e-9) : NAN);
  /* PRUEFEN P6: Schwerpunkt bei gleichmäßig gepackter Ladung vereinfacht in halber Gesamthöhe (inkl. Palette). Das Eigengewicht der Palette wird nicht gesondert berücksichtigt. */
  const cgHeight = H => (num(H) >= 0 ? H / 2 : NAN);
  /* Kippen um die Kante: Die Ladung kippt, wenn c · hs > d / 2 (d = Ladungsmaß in Richtung der Kraft).
     Kippgrenze = größte Schwerpunkthöhe ohne Kippen: hs_max = (d / 2) / c */
  /* PRUEFEN P7: Kippbedingung c·hs > d/2 für einen Quader ohne Zurrung; keine Reserven, keine Kippkante ungleich der Ladungskante. Ausreichend für die Ausbildung? */
  const tipLimit = (d, c) => (num(d) > 0 && num(c) > 0 ? d / 2 / c : NAN);
  const tips = (hs, d, c) => (num(hs) >= 0 && num(d) > 0 && num(c) > 0 ? c * hs > d / 2 + 1e-9 : false);
  /* Kippwinkel: Neigung, bei der der Schwerpunkt senkrecht über der Kippkante steht: tan α = (d/2) / hs */
  const tiltAngle = (d, hs) => (num(d) > 0 && num(hs) > 0 ? Math.atan((d / 2) / hs) * 180 / Math.PI : NAN);

  /* ---------- Ladefläche und Ladeeinheiten ---------- */
  /* PRUEFEN P8: Ladefläche 13,60 m × 2,45 m (Übungswert; reale Innenbreite je nach Auflieger bis ca. 2,48 m) und Europalette 1200 × 800 mm. 33 Paletten längs, 34 quer: stimmt das mit der Lehrbuchaussage überein? */
  const AREA = { L: 1360, W: 245 }; /* cm */
  const EURO = { l: 120, w: 80 };   /* cm, l = lange Seite */
  const perRow = (breite, mass) => (num(breite) > 0 && num(mass) > 0 ? Math.floor(breite / mass + 1e-9) : NAN);
  const rowsFor = (laenge, tiefe) => (num(laenge) > 0 && num(tiefe) > 0 ? Math.floor(laenge / tiefe + 1e-9) : NAN);
  /* orient 'laengs': lange Seite (1200) in Fahrtrichtung, 'quer': kurze Seite (800) in Fahrtrichtung */
  function euroCount(orient, area) {
    const a = area || AREA, tiefe = orient === 'quer' ? EURO.w : EURO.l, breite = orient === 'quer' ? EURO.l : EURO.w;
    const across = perRow(a.W, breite), rows = rowsFor(a.L, tiefe);
    return { across, rows, n: across * rows, tiefe, breite };
  }
  const utilization = (n, area) => { const a = area || AREA; return num(n) >= 0 ? n * EURO.l * EURO.w / (a.L * a.W) * 100 : NAN; };
  const overlaps = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  const inside = (p, area) => { const a = area || AREA; return p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.w <= a.L + 1e-9 && p.y + p.h <= a.W + 1e-9; };
  function canPlace(placed, p, area) {
    if (!inside(p, area)) return { ok: false, reason: 'out' };
    for (const q of placed) if (overlaps(p, q)) return { ok: false, reason: 'overlap' };
    return { ok: true };
  }
  /* Palette mit Mittelpunkt (cx, cy) setzen: auf 5 cm gerastet, an Wände und Nachbarn "magnetisch" angelegt (bis 12 cm) */
  function snapPlace(placed, cx, cy, w, h, area, magnet) {
    const a = area || AREA, mg = magnet == null ? 12 : magnet, cl = (v, mx) => Math.min(Math.max(v, 0), mx);
    const axis = (v, size, max, cands) => {
      v = cl(v, max); let best = null, bd = Infinity;
      cands.concat([0, max]).forEach(c => { const d = Math.abs(c - v); if (c >= -1e-9 && c <= max + 1e-9 && d <= mg && d < bd) { bd = d; best = c; } });
      return best != null ? best : cl(Math.round(v / 5) * 5, max);
    };
    const xs = [], ys = []; placed.forEach(q => { xs.push(q.x + q.w, q.x - w); ys.push(q.y + q.h, q.y - h); });
    return { x: axis(cx - w / 2, w, a.L - w, xs), y: axis(cy - h / 2, h, a.W - h, ys), w, h };
  }
  /* Vollständige Reihen- bzw. Spaltenbelegung der Ladefläche */
  function autoFill(orient, area) {
    const a = area || AREA, e = euroCount(orient, a), out = [], y0 = (a.W - e.across * e.breite) / 2;
    for (let r = 0; r < e.rows; r++) for (let k = 0; k < e.across; k++) out.push({ x: r * e.tiefe, y: y0 + k * e.breite, w: e.tiefe, h: e.breite });
    return out;
  }
  function loadStats(placed, area, kg) {
    const a = area || AREA, n = placed.length, len = placed.reduce((m, p) => Math.max(m, p.x + p.w), 0);
    const pa = placed.reduce((s, p) => s + p.w * p.h, 0);
    return { n, used: len / 100, palArea: pa / 10000, util: pa / (a.L * a.W) * 100, weight: num(kg) >= 0 ? n * kg : NAN };
  }

  /* ---------- Gefahrgut: Mengen-Freigrenze (nur als Beispiel) ---------- */
  /* PRUEFEN P9: Freigrenze nach ADR 1.1.3.6 als Beispiel: Beförderungskategorie 1 (Faktor 50, höchstens 20 kg/l), 2 (Faktor 3, 333), 3 (Faktor 1, 1000), Summe höchstens 1000 Punkte. Kategorie 0 (nie frei) und 4 (unbegrenzt) fehlen bewusst. Ist das so im Unterricht verwendbar? */
  const FREI = [{ cat: 1, faktor: 50, max: 20 }, { cat: 2, faktor: 3, max: 333 }, { cat: 3, faktor: 1, max: 1000 }];
  const FREI_MAX = 1000;
  function points(list) {
    if (!Array.isArray(list)) return NAN; let s = 0;
    for (const it of list) { if (!(num(it.amount) >= 0) || !(num(it.factor) >= 0)) return NAN; s += it.amount * it.factor; }
    return s;
  }
  const exceeded = pts => (fin(pts) ? pts > FREI_MAX + 1e-9 : false);

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    G, gForce, massFromForce, friction, accelForce, toDaN, MU, DIRS, dirOf, slips, secureForce, lashDirect, lashDown,
    PAL_H, palHeight, stackCount, cgHeight, tipLimit, tips, tiltAngle,
    AREA, EURO, perRow, rowsFor, euroCount, utilization, overlaps, inside, canPlace, snapPlace, autoFill, loadStats,
    FREI, FREI_MAX, points, exceeded };
  root.LAD_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
