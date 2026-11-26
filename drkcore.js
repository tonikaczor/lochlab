'use strict';
/* Tonfunk 3D-Druck-Lab: reine Rechenlogik (Kennung 'drk'). window.DRK_CORE bzw. module.exports.
   ALLE Zahlen (Temperaturen, Dichten, Geschwindigkeiten, Preise, Zeiten, Maße) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Es gilt immer das Datenblatt der Spule und die Betriebsanweisung des Druckers.
   Themen: Filamente, Slicer-Modell (Schichten, Wände, Füllung, Stützen, Zeit, Material, Kosten), Fehlerbilder aus den Einstellungen,
   Überhang und Ausrichtung (45-Grad-Regel), Rechnen (Filamentlänge, Masse, Kosten, Passung).
   Ungültige Eingaben (negative Werte, Division durch 0, fehlende Zahlen) liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);
  const clamp01 = v => Math.max(0, Math.min(1, v));

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|teile|platten|schichten|stunden|std|min|sek|kg|mm³|cm³|mm|cm|°c|°|grad|%|g|m|s|h)$/i, '');
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
  /* Zeit in Sekunden als "2 h 05 min" bzw. "45 min" */
  function fmtTime(sec) {
    if (!(num(sec) >= 0)) return '-';
    const m = Math.round(sec / 60), h = Math.floor(m / 60), r = m % 60;
    return h ? h + ' h ' + (r < 10 ? '0' : '') + r + ' min' : r + ' min';
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

  /* ============================================================ Filamente */
  /* Übungswerte (typische Bereiche, 1,75 mm Filament). Dichte in g/cm³. dry = Trockentemperatur in °C und Dauer in h.
     fan = günstiger Bereich des Bauteillüfters in %, warp = Neigung zum Verzug (0 bis 1). star = Bewertung 1 bis 5 (fest, hitze, flex, leicht).
     PRUEFEN: Alle Werte sind Richtwerte, verbindlich ist das Datenblatt der Spule. */
  const FIL = [
    { k: 'pla', n: 'PLA', nl: 190, nh: 230, bl: 35, bh: 60, rho: 1.24, dry: [55, 8], fan: [70, 100], warp: 0.6, star: [3, 1, 1, 5], box: false,
      info: ['Einfach zu drucken, wenig Verzug, auch ohne Einhausung.', 'Steif, aber spröde. Wird ab etwa 55 bis 60 °C weich (zum Beispiel im Auto in der Sonne).', 'Für Prototypen, Anschauungsmodelle, Halter ohne Wärmelast.'] },
    { k: 'petg', n: 'PETG', nl: 230, nh: 260, bl: 70, bh: 85, rho: 1.27, dry: [65, 8], fan: [30, 70], warp: 0.8, star: [4, 2, 2, 4], box: false,
      info: ['Zäher als PLA und beständiger gegen Feuchte und viele Chemikalien.', 'Neigt zu Fäden (Stringing) und klebt stark an glatten Platten.', 'Für Gehäuse, Halter und Teile, die etwas aushalten sollen.'] },
    { k: 'abs', n: 'ABS', nl: 240, nh: 270, bl: 90, bh: 100, rho: 1.04, dry: [80, 6], fan: [0, 30], warp: 1, star: [4, 4, 2, 2], box: true,
      info: ['Hitzebeständig und zäh, lässt sich nachbearbeiten.', 'Verzieht sich stark: Einhausung, heißes Bett und wenig Lüfter nötig.', 'Dämpfe: gut lüften, Drucker möglichst in einem belüfteten Raum.'] },
    { k: 'asa', n: 'ASA', nl: 240, nh: 270, bl: 90, bh: 100, rho: 1.07, dry: [80, 6], fan: [0, 30], warp: 1, star: [4, 4, 2, 2], box: true,
      info: ['Ähnlich wie ABS, aber beständiger gegen UV-Licht und Wetter.', 'Auch hier: Einhausung, heißes Bett, wenig Lüfter, gute Lüftung des Raums.', 'Für Teile im Freien und im Fahrzeug.'] },
    { k: 'tpu', n: 'TPU', nl: 200, nh: 230, bl: 30, bh: 45, rho: 1.21, dry: [70, 8], fan: [30, 80], warp: 0.3, star: [2, 2, 5, 2], box: false,
      info: ['Gummiartig und flexibel, gut für Dichtungen, Puffer und Schutzhüllen.', 'Langsam drucken, weil das weiche Filament sonst im Extruder staucht.', 'Nimmt gern Feuchte auf: vor dem Druck trocken lagern.'] }
  ];
  const filOf = k => FIL.find(x => x.k === k) || null;

  /* ============================================================ Rechnen */
  const DFIL = 1.75;                                   /* Filamentdurchmesser in mm */
  const filArea = (d) => (num(d) > 0 ? Math.PI * d * d / 4 : NAN);                /* mm² */
  const massG = (vcm3, rho) => (num(vcm3) >= 0 && num(rho) > 0 ? vcm3 * rho : NAN);     /* g aus cm³ und g/cm³ */
  const lenM = (g, rho, d) => (num(g) >= 0 && num(rho) > 0 && num(d) > 0 ? g / rho * 1000 / filArea(d) / 1000 : NAN); /* m aus g */
  const layersOf = (H, h) => (num(H) > 0 && num(h) > 0 ? ceilN(H / h) : NAN);
  const maxLayer = (nozzle, pct) => (num(nozzle) > 0 && num(pct) > 0 ? nozzle * pct / 100 : NAN);
  const holeDia = (d, spiel, korr) => (num(d) > 0 && num(spiel) >= 0 && num(korr) >= 0 ? d + spiel + korr : NAN);
  const costMat = (g, eurKg) => (num(g) >= 0 && num(eurKg) >= 0 ? g / 1000 * eurKg : NAN);
  const costPower = (h, kW, eurKwh) => (num(h) >= 0 && num(kW) >= 0 && num(eurKwh) >= 0 ? h * kW * eurKwh : NAN);

  /* ============================================================ Slicer-Modell: Halter (Übungsmodell) */
  /* Winkelhalter im Schnitt: Stiel 14 mm breit, Arm 44 mm lang und 8 mm dick, Höhe 40 mm, Tiefe 20 mm. Unter dem Arm hängt 30 mm frei in der Luft.
     Wände und Deckschichten werden als Schale gerechnet, der Rest innen als Füllung. Zeit = Menge / Fluss (Fluss höchstens Q) mal Zuschlag plus Schichtwechsel.
     PRUEFEN: Das Modell ist stark vereinfacht und ersetzt nie die Schätzung des Slicers. */
  const SL = { LW: 0.42, D: 20, SW: 14, AW: 44, H: 40, AT: 8, DECK: 4, VW: 60, VF: 100, VS: 100, Q: 15, FAKT: 1.3, WECHSEL: 2, PW: 120, KWH: 0.3, PREIS: 22 };
  const MUSTER = [{ k: 'lin', n: 'Linien', z: 0.9 }, { k: 'gitter', n: 'Gitter', z: 1 }, { k: 'waben', n: 'Waben', z: 1.15 }, { k: 'gyroid', n: 'Gyroid', z: 1.1 }];
  const STUETZ = [{ k: 'aus', n: 'aus', f: 0 }, { k: 'normal', n: 'normal', f: 0.15 }, { k: 'baum', n: 'Baum', f: 0.07 }];
  const HOEHEN = [0.08, 0.12, 0.16, 0.2, 0.28];
  const musterOf = k => MUSTER.find(x => x.k === k) || null, stuetzOf = k => STUETZ.find(x => x.k === k) || null;
  function sliceModel(p) {
    if (!p) return null;
    const h = num(p.h), w = num(p.walls), inf = num(p.infill), price = num(p.price);
    const m = musterOf(p.pattern), st = stuetzOf(p.support), mat = filOf(p.mat);
    if (!(h > 0 && h <= 0.4) || !(Number.isInteger(w) && w >= 1 && w <= 8) || !(inf >= 0 && inf <= 100) || !(price >= 0) || !m || !st || !mat) return null;
    const t = w * SL.LW, s = SL.DECK * h, D = SL.D;
    const area = SL.SW * (SL.H - SL.AT) + SL.AW * SL.AT;
    const vol = area * D;
    const innerA = Math.max(0, SL.SW - 2 * t) * Math.max(0, SL.H - 2 * s) + (SL.AW - SL.SW) * Math.max(0, SL.AT - 2 * s);
    const inner = innerA * Math.max(0, D - 2 * t);
    const vShell = vol - inner, vInf = inner * inf / 100;
    const vSup = (SL.AW - SL.SW) * (SL.H - SL.AT) * D * st.f;
    const aLine = SL.LW * h, fl = v => Math.min(aLine * v, SL.Q);
    const layers = layersOf(SL.H, h);
    const sec = (vShell / fl(SL.VW) + vInf * m.z / fl(SL.VF) + vSup / fl(SL.VS)) * SL.FAKT + layers * SL.WECHSEL;
    const V = vShell + vInf + vSup, g = massG(V / 1000, mat.rho);
    const cM = costMat(g, price), cS = costPower(sec / 3600, SL.PW / 1000, SL.KWH);
    return { h, walls: w, layers, vol, vShell, vInf, vSup, V, g, m: lenM(g, mat.rho, DFIL), sec, costMat: cM, costPower: cS, cost: cM + cS, lueber: st.f === 0, wallT: t };
  }

  /* ============================================================ Fehlerbilder */
  const FEHLER = [
    { k: 'warp', n: 'Warping', sym: 'Die Ecken des Teils heben sich von der Platte.', ursache: 'Das Bett ist zu kühl oder der Lüfter bläst zu stark. Das Teil kühlt ungleichmäßig ab und zieht sich zusammen.', abhilfe: 'Bett wärmer, Lüfter kleiner, Brim, bei ABS und ASA Einhausung geschlossen halten.' },
    { k: 'string', n: 'Stringing', sym: 'Zwischen zwei Teilen hängen feine Fäden.', ursache: 'Die Düse ist zu heiß, der Rückzug ist zu klein oder das Filament ist feucht.', abhilfe: 'Düse etwas kühler, Rückzug erhöhen, Filament trocknen.' },
    { k: 'under', n: 'Unterextrusion', sym: 'Die Linien sind dünn, haben Lücken oder die Wände sind löchrig.', ursache: 'Die Düse ist zu kalt: Das Filament wird nicht flüssig genug und es kommt zu wenig Material heraus.', abhilfe: 'Düse wärmer, langsamer drucken, Düse und Extruder prüfen.' },
    { k: 'foot', n: 'Elefantenfuß', sym: 'Das Teil ist unten breiter und hat einen Wulst am Fuß.', ursache: 'Das Bett ist zu heiß: Die unteren Schichten bleiben weich und werden vom Gewicht nach außen gedrückt.', abhilfe: 'Bett kühler, erste Schicht nicht zu stark andrücken, Kalibrierung prüfen.' },
    { k: 'spag', n: 'Spaghetti', sym: 'Statt des Teils liegt ein Knäuel aus Filament auf der Platte.', ursache: 'Das Teil hat sich gelöst, der Druck geht ins Leere weiter.', abhilfe: 'Platte reinigen, Bett wärmer, Brim, Druck in den ersten Schichten beobachten.' }
  ];
  const fehlOf = k => FEHLER.find(x => x.k === k) || null;
  const FSTART = { pla: { bed: 55, noz: 215, fan: 100, ret: 0.8 }, petg: { bed: 75, noz: 245, fan: 50, ret: 0.8 }, abs: { bed: 95, noz: 255, fan: 10, ret: 0.8 } };
  /* Schwere je Fehler von 0 bis 1; ab FSCHW gilt der Fehler als erkennbar */
  const FSCHW = 0.35;
  function diagnose(s) {
    if (!s) return null;
    const mat = filOf(s.mat), bed = num(s.bed), noz = num(s.noz), fan = num(s.fan), ret = num(s.ret);
    if (!mat || !(bed >= 0 && bed <= 130) || !(noz >= 100 && noz <= 350) || !(fan >= 0 && fan <= 100) || !(ret >= 0 && ret <= 8)) return null;
    const bedLow = clamp01((mat.bl - bed) / 20), fanHigh = clamp01((fan - mat.fan[1]) / 60);
    const hot = clamp01((noz - mat.nh) / 25), retF = clamp01((0.5 - ret) / 0.5), mid = clamp01((noz - (mat.nl + mat.nh) / 2) / ((mat.nh - mat.nl) / 2));
    const sev = {
      warp: clamp01(mat.warp * (0.9 * bedLow + 0.8 * fanHigh)),
      string: clamp01(0.7 * hot + 0.7 * retF + 0.2 * mid),
      under: clamp01((mat.nl - noz) / 20),
      foot: clamp01((bed - mat.bh) / 15),
      spag: clamp01((bedLow - 0.6) * 2.5)
    };
    const found = FEHLER.map(f => f.k).filter(k => sev[k] >= FSCHW).sort((a, b) => sev[b] - sev[a]);
    return { sev, found, top: found[0] || null };
  }

  /* ============================================================ Überhang und Ausrichtung */
  /* Seitenansicht eines Teils auf der Platte (mm, y nach oben). Außenring gegen den Uhrzeigersinn, Loch im Uhrzeigersinn. Das Teil ist 20 mm tief. */
  const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => { const a = -2 * Math.PI * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const TEILE = [
    { k: 'winkel', n: 'Winkel', rings: [[[0, 0], [40, 0], [40, 10], [10, 10], [10, 35], [0, 35]]] },
    { k: 't', n: 'T-Träger', rings: [[[12, 0], [28, 0], [28, 25], [40, 25], [40, 35], [0, 35], [0, 25], [12, 25]]] },
    { k: 'bohr', n: 'Block mit Bohrung', rings: [[[0, 0], [40, 0], [40, 30], [0, 30]], circle(20, 15, 7, 24)] },
    { k: 'trichter', n: 'Trichter', rings: [[[16, 0], [40, 0], [56, 14], [0, 14]]] }
  ];
  const teilOf = k => TEILE.find(x => x.k === k) || null;
  const OV = Math.SQRT1_2, STEP = 0.5, EPS = 1e-6, DT = 20;
  const r9 = v => Math.round(v * 1e9) / 1e9;
  function rotateRings(rings, deg) {
    const pts = [].concat.apply([], rings), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const rot = rings.map(r => r.map(p => [r9(cx + (p[0] - cx) * c - (p[1] - cy) * s), r9(cy + (p[0] - cx) * s + (p[1] - cy) * c)]));
    const all = [].concat.apply([], rot), minX = Math.min.apply(null, all.map(p => p[0])), minY = Math.min.apply(null, all.map(p => p[1]));
    return rot.map(r => r.map(p => [r9(p[0] - minX), r9(p[1] - minY)]));
  }
  function inside(rings, x, y) {
    let n = 0;
    rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) n++; } });
    return n % 2 === 1;
  }
  /* Auswertung: Kanten als 'ueber' (Neigung gegen die Senkrechte über 45 Grad, Fläche zeigt nach unten), 'auf' (liegt auf der Platte) oder 'ok' */
  function analyse(key, deg) {
    const T = teilOf(key); if (!T || !fin(num(deg))) return null;
    const rings = rotateRings(T.rings, deg), edges = [];
    let ueber = 0, auf = 0;
    rings.forEach(r => { for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ny = -dx / len;
      let kind = 'ok';
      if (ny < -EPS && a[1] < EPS && b[1] < EPS) { kind = 'auf'; auf += len; }
      else if (ny < -OV - EPS) { kind = 'ueber'; ueber += len; }
      edges.push({ a, b, kind, len, ang: ny < 0 ? Math.round(Math.asin(Math.min(1, -ny)) * 180 / Math.PI) : 0 });
    } });
    let area = 0; const cols = [];
    edges.filter(e => e.kind === 'ueber').forEach(e => {
      const dx = e.b[0] - e.a[0]; if (Math.abs(dx) < 1e-9) return;
      const n = Math.ceil(Math.abs(dx) / STEP);
      for (let i = 0; i < n; i++) {
        const xm = e.a[0] + (i + 0.5) * dx / n, ye = e.a[1] + (xm - e.a[0]) * (e.b[1] - e.a[1]) / dx; let h = ye;
        for (let yy = ye - STEP / 2; yy > 0; yy -= STEP) if (inside(rings, xm, yy)) { h = ye - (yy + STEP / 2); break; }
        area += Math.abs(dx) / n * h; cols.push([xm, ye - h, ye, Math.abs(dx) / n]);
      }
    });
    const all = [].concat.apply([], rings), W = Math.max.apply(null, all.map(p => p[0])), H = Math.max.apply(null, all.map(p => p[1]));
    return { rings, edges, cols, w: W, h: H, ueber, auf, stuetzA: area, stuetzV: area * DT / 1000, schichten: layersOf(H, 0.2) };
  }
  /* beste Drehung in 15-Grad-Schritten: wenig Stützen, dann große Auflage, dann geringe Höhe */
  function bestAngle(key) {
    let best = null;
    for (let d = 0; d < 360; d += 15) {
      const a = analyse(key, d); if (!a) return NAN;
      const sc = [Math.round(a.stuetzA * 2), -Math.round(a.auf), Math.round(a.h)];
      if (!best || sc[0] < best.sc[0] || (sc[0] === best.sc[0] && (sc[1] < best.sc[1] || (sc[1] === best.sc[1] && sc[2] < best.sc[2])))) best = { d, sc };
    }
    return best.d;
  }
  /* Neigung einer Fläche gegen die Senkrechte: über 45 Grad braucht Stützen (genau 45 Grad nicht) */
  const needsSupport = ang => (num(ang) >= 0 && num(ang) <= 90 ? ang > 45 + 1e-9 : NAN);

  const API = { parseDe, fmtDe, fmtN, fmtTime, rd, num, ceilN, clamp01, hashStr, rng, ri, pick, shuffle,
    FIL, filOf, DFIL, filArea, massG, lenM, layersOf, maxLayer, holeDia, costMat, costPower,
    SL, MUSTER, STUETZ, HOEHEN, musterOf, stuetzOf, sliceModel,
    FEHLER, fehlOf, FSTART, FSCHW, diagnose,
    TEILE, teilOf, rotateRings, inside, analyse, bestAngle, needsSupport };
  root.DRK_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
