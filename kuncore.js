'use strict';
/* Tonfunk Kunststoff-Lab: reine Rechenlogik (Kennung 'kun'). window.KUN_CORE bzw. module.exports.
   ALLE Zahlen (Schwindung, Dichte, Dehnung, Zeiten, Kosten, Faustregeln) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Themen: Kunststoffe kennen, Urformverfahren, spritzgussgerecht konstruieren, Schwindung und Maße, Verbindungen, Kosten.
   Nicht hier (siehe werlab/konlab/tollab/zeilab): Metalle, Zugversuch, Härte, Gussteile aus Metall, ISO-Passungen, Normteile.
   Konventionen: Längen in mm, Winkel in Grad, Zeiten in s, Massen in g, Dichte in g/cm³, Kosten in €.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|teile|kg|g|mm|cm|m|°|grad|%|s|min|h|cm³|g\/cm³)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '?';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '?'; dec = dec == null ? 2 : dec;
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

  /* ============================================================ Kunststoffe kennen */
  /* PRUEFEN P1: Übungswerte je Werkstoff (unverstärkt): Dichte, Schwindungs-Bandbreite (smin bis smax in %), Rechenwert s (Mitte), zulässige Kurzzeit-Dehnung am Schnapphaken eps (%).
     Tabellen und Hersteller nennen je nach Typ, Wanddicke und Füllstoff andere Werte. */
  const MATS = [
    { k: 'PE', n: 'Polyethylen (PE-HD)', struk: 'teil', code: '02', rho: 0.95, smin: 1.5, smax: 3.0, s: 2.0, eps: 8, eig: 'zäh, weich, chemikalienbeständig, schwer zu kleben', use: 'Flaschen, Kanister, Rohre, Folien' },
    { k: 'PP', n: 'Polypropylen', struk: 'teil', code: '05', rho: 0.91, smin: 1.0, smax: 2.5, s: 1.5, eps: 6, eig: 'leicht, zäh, gut für Filmscharniere, schwer zu kleben', use: 'Verschlusskappen mit Filmscharnier, Behälter, Innenteile' },
    { k: 'ABS', n: 'Acrylnitril-Butadien-Styrol', struk: 'amorph', code: '07', rho: 1.05, smin: 0.4, smax: 0.7, s: 0.5, eps: 2.5, eig: 'schlagzäh, glänzende Oberfläche, gut zu kleben und zu lackieren', use: 'Gehäuse, Abdeckungen, Griffe' },
    { k: 'PA', n: 'Polyamid (PA 6)', struk: 'teil', code: '07', rho: 1.14, smin: 0.8, smax: 2.0, s: 1.2, eps: 4, eig: 'fest, zäh, verschleißfest, nimmt Wasser auf', use: 'Zahnräder, Gleitteile, Kabelbinder' },
    { k: 'PC', n: 'Polycarbonat', struk: 'amorph', code: '07', rho: 1.20, smin: 0.5, smax: 0.7, s: 0.6, eps: 4, eig: 'glasklar möglich, sehr schlagzäh, maßhaltig', use: 'Schutzhauben, Leuchtenabdeckungen, Sichtscheiben' },
    { k: 'POM', n: 'Polyoxymethylen', struk: 'teil', code: '07', rho: 1.41, smin: 1.8, smax: 2.5, s: 2.0, eps: 6, eig: 'steif, gleitfähig, federnd, maßhaltig nach dem Spritzen', use: 'Zahnräder, Schnapphaken, Clips, Gleitlager' },
    { k: 'PMMA', n: 'Polymethylmethacrylat (Acrylglas)', struk: 'amorph', code: '07', rho: 1.19, smin: 0.3, smax: 0.7, s: 0.5, eps: 1.5, eig: 'glasklar, kratzfest, eher spröde', use: 'Lichtleiter, Abdeckscheiben, Anzeigefenster' }
  ];
  const matOf = k => MATS.find(m => m.k === k) || null;
  const GROUPS = [
    { k: 'thermo', n: 'Thermoplast', d: 'Lange, nicht vernetzte Ketten. Wird beim Erwärmen weich, lässt sich immer wieder schmelzen, spritzen und schweißen.' },
    { k: 'duro', n: 'Duroplast', d: 'Engmaschig vernetzt. Nach dem Aushärten hart und nicht mehr schmelzbar; bei zu viel Hitze zersetzt er sich.' },
    { k: 'elast', n: 'Elastomer', d: 'Weitmaschig vernetzt. Gummielastisch: federt nach dem Dehnen zurück, nicht schmelzbar.' }
  ];
  const STRUK = { amorph: 'amorph', teil: 'teilkristallin' };
  /* PRUEFEN P2: Recycling-Codes 01 bis 07 nach dem üblichen Dreieck mit Kurzzeichen (01 PET, 02 PE-HD, 03 PVC, 04 PE-LD, 05 PP, 06 PS, 07 andere). */
  const RCODES = [['01', 'PET'], ['02', 'PE-HD'], ['03', 'PVC'], ['04', 'PE-LD'], ['05', 'PP'], ['06', 'PS'], ['07', 'andere (z. B. ABS, PA, PC, POM, PMMA)']];
  /* Masse eines Teils: Volumen (cm³) · Dichte (g/cm³) = g */
  const partMass = (v, rho) => (num(v) > 0 && num(rho) > 0 ? v * rho : NAN);
  /* Granulat für n Teile mit Angussanteil a % (bezogen auf die Teilmasse), in kg */
  const granulateKg = (m, n, a) => (num(m) > 0 && num(n) >= 0 && num(a) >= 0 ? m * n * (1 + a / 100) / 1000 : NAN);

  /* ============================================================ Urformverfahren */
  const CYCLE = [
    { k: 'schl', n: 'Schließen', d: 'Das Werkzeug fährt zu und wird mit der Schließkraft zugehalten.' },
    { k: 'einspr', n: 'Einspritzen', d: 'Die Schnecke drückt die Schmelze schnell in die Form.' },
    { k: 'nach', n: 'Nachdruck', d: 'Der Druck bleibt, damit Schmelze nachfließt und die Schwindung ausgleicht (gegen Einfallstellen).' },
    { k: 'kuehl', n: 'Kühlen', d: 'Das Teil erstarrt in der Form. Währenddessen dosiert die Schnecke schon die Schmelze für den nächsten Schuss.' },
    { k: 'oeffn', n: 'Öffnen', d: 'Das Werkzeug fährt auf.' },
    { k: 'ausw', n: 'Auswerfen', d: 'Auswerfer stoßen das Teil vom Kern.' }
  ];
  const cycleTime = ph => { if (!ph) return NAN; const v = CYCLE.map(c => num(ph[c.k])); return v.every(x => x >= 0) ? v.reduce((a, b) => a + b, 0) : NAN; };
  const partsPerHour = (tz, kav) => (num(tz) > 0 && num(kav) >= 1 ? 3600 / tz * kav : NAN);
  /* PRUEFEN P3: Kühlzeit-Faustregel t = k · s² mit Übungswert k = 2 s/mm² (je Werkstoff etwa 1,5 bis 3). Nur die Aussage "doppelte Wand, vierfache Kühlzeit" soll hängen bleiben. */
  const KCOOL = 2;
  const coolTime = (s, k) => (num(s) > 0 && (k == null || num(k) > 0) ? (k == null ? KCOOL : k) * s * s : NAN);
  const printTime = (h, lh, ts) => (num(h) > 0 && num(lh) > 0 && num(ts) > 0 ? Math.ceil(h / lh - 1e-9) * ts : NAN);
  /* PRUEFEN P4: Verfahrensvergleich (typische Teile, Stückzahl, Werkzeug) als grobe Übungsübersicht. Tiefziehen (Thermoformen) ist streng genommen Umformen von Halbzeug, steht aber im LF 6 daneben. */
  const PROC = [
    { k: 'sg', n: 'Spritzgießen', teil: 'Formteile mit Rippen und Domen: Gehäuse, Kappen, Zahnräder', menge: 'groß (ab einigen tausend)', wz: 'teuer', art: 'Urformen' },
    { k: 'ex', n: 'Extrudieren', teil: 'Endlose Profile: Rohre, Schläuche, Platten, Folien', menge: 'Meterware', wz: 'mittel (Düse)', art: 'Urformen' },
    { k: 'bf', n: 'Blasformen', teil: 'Hohlkörper: Flaschen, Kanister, Tanks', menge: 'groß', wz: 'mittel', art: 'Urformen' },
    { k: 'tz', n: 'Tiefziehen (Thermoformen)', teil: 'Dünnwandige Schalen aus Platten oder Folien: Becher, Verpackungen, Verkleidungen', menge: 'klein bis groß', wz: 'günstig', art: 'Umformen von Halbzeug' },
    { k: 'fdm', n: '3D-Druck (FDM)', teil: 'Muster, Prototypen, Einzelteile, Vorrichtungen', menge: 'Einzelstück bis Kleinserie', wz: 'keins', art: 'additiv (Schicht für Schicht)' }
  ];

  /* ============================================================ Spritzgussgerecht konstruieren */
  /* PRUEFEN P5: Faustregeln (Übungswerte): Wanddicke 1 bis 4 mm, Rippendicke 0,5 bis 0,7 · Wanddicke, Entformungsschräge mindestens 0,5°,
     Innenradius mindestens 0,5 · Wanddicke (unter 0,25 · Wanddicke deutlich kritisch), Außenradius = Innenradius + Wanddicke. */
  const RULE = { sMin: 1, sMax: 4, ribMin: 0.5, ribMax: 0.7, draftMin: 0.5, rMin: 0.5, rBad: 0.25 };
  const ribMax = s => (num(s) > 0 ? RULE.ribMax * s : NAN);
  const ribMin = s => (num(s) > 0 ? RULE.ribMin * s : NAN);
  const outerRadius = (ri0, s) => (num(ri0) >= 0 && num(s) > 0 ? ri0 + s : NAN);
  const draftOffset = (h, a) => (num(h) >= 0 && num(a) >= 0 && a < 45 ? h * Math.tan(a * Math.PI / 180) : NAN);
  /* PRUEFEN P6: Schraubdom für direkt eingedrehte Schrauben: Dom-Außendurchmesser etwa 2 · d, Kernloch etwa 0,8 · d (Übungswerte, Herstellerangaben der Schraube gehen vor). */
  const domeOuter = d => (num(d) > 0 ? 2 * d : NAN);
  const domeHole = d => (num(d) > 0 ? 0.8 * d : NAN);
  const domeWall = d => (num(d) > 0 ? (domeOuter(d) - domeHole(d)) / 2 : NAN);
  /* Prüfung des Querschnitts: p = {s, t, a, r} (Wanddicke, Rippendicke, Entformungsschräge in Grad, Innenradius). Liefert null bei ungültiger Eingabe. */
  const ISSUE = {
    einfall: 'Einfallstelle: Die Rippe ist dicker als 0,7 · Wanddicke. Am Rippenfuß sammelt sich Masse, sie kühlt zuletzt ab, schwindet nach und zieht die Sichtfläche gegenüber ein.',
    rippe: 'Rippe zu dünn: unter 0,5 · Wanddicke füllt sie schlecht (die Schmelze erstarrt vorher) und bricht leicht.',
    klemmt: 'Entformen klemmt: Ohne ausreichende Schräge (unter 0,5°) reibt das Teil beim Auswerfen am Kern, es gibt Kratzer, Verzug oder es bleibt hängen.',
    kerb: 'Kerbwirkung: Die Ecke ist fast scharfkantig (Radius unter 0,25 · Wanddicke). Dort sammeln sich Spannungen, das Teil reißt bei Last zuerst an dieser Ecke.',
    kerbl: 'Radius knapp: unter 0,5 · Wanddicke bleibt eine Kerbwirkung. Ein größerer Innenradius verteilt die Spannung und die Schmelze fließt besser um die Ecke.',
    dick: 'Wand sehr dick (über 4 mm): lange Kühlzeit (wächst mit dem Quadrat der Wanddicke), Gefahr von Lunkern und Einfallstellen. Besser dünner und mit Rippen versteifen.',
    duenn: 'Wand sehr dünn (unter 1 mm): Die Form füllt sich schwer, die Schmelze erstarrt vor dem Ende des Fließwegs.'
  };
  function designCheck(p) {
    if (!p || ![p.s, p.t, p.a, p.r].every(v => num(v) >= 0) || !(p.s > 0) || !(p.t > 0)) return null;
    const q = p.t / p.s, out = [];
    if (q > RULE.ribMax + 1e-9) out.push({ k: 'einfall', lvl: 'bad' }); else if (q < RULE.ribMin - 1e-9) out.push({ k: 'rippe', lvl: 'warn' });
    if (p.a < RULE.draftMin - 1e-9) out.push({ k: 'klemmt', lvl: 'bad' });
    if (p.r < RULE.rBad * p.s - 1e-9) out.push({ k: 'kerb', lvl: 'bad' }); else if (p.r < RULE.rMin * p.s - 1e-9) out.push({ k: 'kerbl', lvl: 'warn' });
    if (p.s > RULE.sMax + 1e-9) out.push({ k: 'dick', lvl: 'warn' }); else if (p.s < RULE.sMin - 1e-9) out.push({ k: 'duenn', lvl: 'warn' });
    out.forEach(x => { x.text = ISSUE[x.k]; });
    return { ratio: q, ribMin: ribMin(p.s), ribMax: ribMax(p.s), rMin: RULE.rMin * p.s, rOut: outerRadius(p.r, p.s), cool: coolTime(p.s), issues: out, ok: !out.length };
  }

  /* ============================================================ Schwindung und Maße */
  /* PRUEFEN P7: Schwindung bezogen auf das Werkzeugmaß: S = (L_W − L_F) / L_W · 100 %, also L_W = L_F / (1 − S/100). Manche Bücher rechnen vereinfacht L_W = L_F · (1 + S/100); der Unterschied ist klein. */
  const moldSize = (lf, s) => (num(lf) > 0 && num(s) >= 0 && s < 50 ? lf / (1 - s / 100) : NAN);
  const partSize = (lw, s) => (num(lw) > 0 && num(s) >= 0 && s < 50 ? lw * (1 - s / 100) : NAN);
  const shrinkPct = (lw, lf) => (num(lw) > 0 && num(lf) > 0 && lf <= lw ? (lw - lf) / lw * 100 : NAN);
  /* Schwankung des Fertigmaßes, wenn die Schwindung zwischen smin und smax streut */
  const shrinkSpread = (lw, smin, smax) => (num(lw) > 0 && num(smin) >= 0 && num(smax) >= smin ? lw * (smax - smin) / 100 : NAN);

  /* ============================================================ Verbindungen */
  /* PRUEFEN P8: Dehnung am Fuß eines Schnapphakens mit gleichbleibendem Rechteckquerschnitt: eps = 1,5 · h · y / l² (· 100 für %). Faustformel aus Konstruktionsrichtlinien, ohne Kerbe am Fuß und ohne Fügekraft. */
  const snapStrain = (h, y, l) => (num(h) > 0 && num(y) >= 0 && num(l) > 0 ? 1.5 * h * y / (l * l) * 100 : NAN);
  const snapMaxY = (h, l, eps) => (num(h) > 0 && num(l) > 0 && num(eps) > 0 ? eps / 100 * l * l / (1.5 * h) : NAN);

  /* ============================================================ Kosten */
  /* Gesamtkosten = Werkzeug + Stückkosten · Menge; Stückkosten mit Werkzeuganteil = Werkzeug / Menge + Stückkosten */
  const totalCost = (w, k, n) => (num(w) >= 0 && num(k) >= 0 && num(n) >= 0 ? w + k * n : NAN);
  const unitCost = (w, k, n) => (num(w) >= 0 && num(k) >= 0 && num(n) > 0 ? w / n + k : NAN);
  /* Gleichstand: W + kSG · n = W3 + k3 · n (W3 = Fixkosten 3D-Druck, meist 0) */
  const breakEven = (w, kSG, k3, w3) => { w3 = w3 == null ? 0 : w3; return num(w) >= 0 && num(kSG) >= 0 && num(k3) > kSG && num(w3) >= 0 && w > w3 ? (w - w3) / (k3 - kSG) : NAN; };
  /* kleinste Menge, ab der Spritzgießen billiger ist (echt kleiner) */
  const breakEvenN = (w, kSG, k3, w3) => { const b = breakEven(w, kSG, k3, w3); return fin(b) ? Math.floor(b + 1e-9) + 1 : NAN; };
  const machineHours = (n, tz, kav) => (num(n) >= 0 && num(tz) > 0 && num(kav) >= 1 ? Math.ceil(n / kav - 1e-9) * tz / 3600 : NAN);

  const API = { parseDe, fmtDe, fmtN, rd, num, hashStr, rng, ri, pick, shuffle,
    MATS, matOf, GROUPS, STRUK, RCODES, partMass, granulateKg,
    CYCLE, cycleTime, partsPerHour, KCOOL, coolTime, printTime, PROC,
    RULE, ribMax, ribMin, outerRadius, draftOffset, domeOuter, domeHole, domeWall, ISSUE, designCheck,
    moldSize, partSize, shrinkPct, shrinkSpread,
    snapStrain, snapMaxY,
    totalCost, unitCost, breakEven, breakEvenN, machineHours };
  root.KUN_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
