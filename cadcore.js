'use strict';
/* Tonfunk 3D-Modellierungs-Lab: reine Rechenlogik (Kennung 'cad'). window.CAD_CORE bzw. module.exports.
   ALLE Zahlen (Maße, Dichten, Preise) sind ÜBUNGSWERTE für die Ausbildung. Firma "Modellbetrieb" und alle Bauteile sind frei erfunden.
   Themen: Koordinaten und Ebenen, Skizzen und Bedingungen, Features, boolesche Operationen und Parameter, Fertigung und 3D-Druck, Baugruppe.
   Koordinatensystem im Lab: X nach rechts, Y nach hinten, Z nach oben (Draufsicht = XY-Ebene).
   Ungültige Eingaben (Division durch 0, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN, PI = Math.PI;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|mm³|cm³|mm²|cm²|mm|cm|kg|g|%|°|grad|Stück|Stk)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '-';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '-'; dec = dec == null ? 2 : dec;
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

  /* ============================================================ Skizze: Freiheitsgrade */
  /* PRUEFEN C1: Zählweise vereinfacht (Punkt 2, Linie 4, Kreis 3; Rechteck aus vier freien Eckpunkten = 8). Echte Programme zählen je Bedingung etwas anders. */
  const DOF = { punkt: 2, linie: 4, kreis: 3 };
  const dofSum = (np, nl, nk) => np * DOF.punkt + nl * DOF.linie + nk * DOF.kreis;
  const SK_TOTAL = dofSum(4, 0, 1); /* Rechteck (vier Eckpunkte) und ein Kreis darin: 11 */
  /* Bedingungen der Übungsskizze, d = so viele Freiheitsgrade nimmt sie weg */
  const SK = [
    { k: 'h', n: 'Oben und unten waagerecht', d: 2 },
    { k: 'v', n: 'Links und rechts senkrecht', d: 2 },
    { k: 'o', n: 'Ecke links unten im Ursprung festlegen', d: 2 },
    { k: 'w', n: 'Breite bemaßen', d: 1 },
    { k: 'hh', n: 'Höhe bemaßen', d: 1 },
    { k: 'm', n: 'Kreismitte symmetrisch in die Mitte legen', d: 2 },
    { k: 'dk', n: 'Kreisdurchmesser bemaßen', d: 1 },
    { k: 'g', n: 'Gleich: Breite = Höhe (Quadrat)', d: 1 }
  ];
  /* on = Liste der eingeschalteten Schlüssel. Breite und Höhe bemaßt UND Gleich: das dritte ist überflüssig (überbestimmt). */
  function sketchState(on) {
    const s = new Set(on); let removed = 0;
    SK.forEach(c => { if (s.has(c.k)) removed += c.d; });
    const over = s.has('g') && s.has('w') && s.has('hh');
    if (over) removed -= 1;
    const dof = SK_TOTAL - removed;
    return { dof, over, status: over ? 'over' : dof === 0 ? 'voll' : 'unter' };
  }

  /* ============================================================ Körper */
  /* PRUEFEN C2: Dichten sind runde Übungswerte (PLA 1,24 g/cm³). */
  const DICHTE = { PLA: 1.24, PETG: 1.27, Aluminium: 2.7, Stahl: 7.85 };
  const boxV = (a, b, c) => a * b * c;
  const cylV = (d, h) => PI * d * d / 4 * h;
  const eckenV = (r, h) => (4 - PI) * r * r * h; /* vier senkrechte Kanten mit Radius r gerundet: je Ecke (1 - π/4)·r²·h */
  const massG = (mm3, rho) => mm3 / 1000 * rho;

  /* Gehäuse (oben offen, Boden so dick wie die Wand): Zustand nach jedem Feature. Reihenfolge wie im Feature-Baum. */
  const FEATURES = [
    ['skizze', 'Skizze', 'Rechteck L × B auf der XY-Ebene'],
    ['extr', 'Extrusion', 'Höhe H nach oben'],
    ['rund', 'Rundung', 'Radius r an den vier senkrechten Kanten'],
    ['schale', 'Schale', 'Wandstärke t, Oberseite offen'],
    ['bohr', 'Bohrungen', 'vier Löcher Ø d im Boden (Muster)']
  ];
  function housing(p) {
    const { L, B, H, t, r, d } = p, n = p.n == null ? 4 : p.n;
    const ao = L * B - (4 - PI) * r * r, ria = Math.max(0, r - t), ai = (L - 2 * t) * (B - 2 * t) - (4 - PI) * ria * ria;
    const v1 = boxV(L, B, H), v2 = v1 - eckenV(r, H), v3 = ao * H - ai * (H - t), v4 = v3 - n * cylV(d, t);
    return [{ v: 0, a: L * B }, { v: v1 }, { v: v2 }, { v: v3 }, { v: v4 }];
  }
  /* Block L × B × Hb und stehender Zylinder Ø d, Höhe Hc, in der Mitte des Blocks. Der Zylinder liegt im Grundriss ganz im Block (d <= B) und ist mindestens so hoch wie der Block. */
  function boolOps(p) {
    const a = boxV(p.L, p.B, p.Hb), b = cylV(p.d, p.Hc), i = cylV(p.d, p.Hb);
    return { a, b, i, union: a + b - i, diff: a - i, inter: i };
  }

  /* ============================================================ Zeichnen: Umriss und Isometrie */
  function circle(cx, cy, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = 2 * PI * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; }
  /* Rechteck mit gerundeten Ecken (r = 0: vier Ecken), gegen den Uhrzeigersinn */
  function rrect(x0, y0, x1, y1, r, seg) {
    if (!(r > 0)) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const o = [], C = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    C.forEach(([cx, cy, a0]) => { for (let i = 0; i <= seg; i++) { const a = (a0 + 90 * i / seg) * PI / 180; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
    return o;
  }
  /* Isometrie: X nach rechts unten, Y nach links unten, Z nach oben. cam = { s: Pixel je mm, ox, oy } */
  function iso(x, y, z, cam) { const c = 0.8660254; return [cam.ox + (x - y) * c * cam.s, cam.oy + ((x + y) * 0.5 - z) * cam.s]; }

  const API = { parseDe, fmtDe, fmtN, rng, ri, pick, shuffle, DOF, dofSum, SK, SK_TOTAL, sketchState, DICHTE, boxV, cylV, eckenV, massG, FEATURES, housing, boolOps, circle, rrect, iso };
  root.CAD_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
