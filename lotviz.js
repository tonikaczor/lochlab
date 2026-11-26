'use strict';
/* Tonfunk Löt-Lab: Grafiken (Lab-Kennung 'lot'). Wird in lotlab.html VOR lotui.js geladen; lotui.js ruft window.LOT_VIZ auf.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/lot/test_lotviz.js):
     jointSvg    Durchsteck-Lötstelle im Schnitt: Platine, Hülse, Lötauge, Anschluss, Lot mit Hohlkehle; der gezeichnete Benetzungswinkel ist der berechnete
     heatSvg     Temperatur des Lötauges über der Zeit mit Schmelz- und Fließtemperatur und der Zeit, in der das Lot fließen kann
     reflowSvg   Reflow-Profil mit Zonen, Schmelztemperatur, Bauteilgrenze, Zeit über Schmelztemperatur (TAL), kleinem und großem Bauteil
     ofenSvg     Reflow-Ofen mit Zonen und wanderndem Brett (gleiche Zeiteinteilung wie das Profil)
     chipSvg     Chip-Lötstelle im Schnitt: Paste, flüssiges Lot, erstarrtes Lot
     defectSvg   Fehlerbilder (Durchsteck und SMD) für den Reiter Fehlerbilder
   Bewegung nur per CSS und nur bei prefers-reduced-motion: no-preference (Glühen der Lötstelle, Glanz, wandernde Linien). Jedes Bild ist ohne Bewegung vollständig.
   Schrift im Bild: 14 Einheiten bei 440 Einheiten Breite, das sind auf einem iPhone (366 px breit) etwa 11,6 px. Farben von Text und Flächen über CSS-Variablen der Seite, Werkstoffe (Kupfer, Lot, Platine) fest. */
(function (root) {
  const C = root.LOT_CORE || (typeof require === 'function' ? require('./lotcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const PL = (pts, cls) => `<path class="${cls || ''}" d="M${pts.map(p => q(p[0]) + ' ' + q(p[1])).join(' L')}"/>`;
  const grad = (id, a, b, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
  /* Werkstoff-Verläufe: Kupfer, Lot in vier Ansichten, Draht, Platine, Bauteilkörper, Paste */
  const DEFS = `<defs>${grad('lovCu', '#e39a5c', '#b8662f', '#8e4a1f')}${grad('lovGlatt', '#ffffff', '#c9d0d8', '#8b95a1')}${grad('lovSeid', '#e9edf1', '#b4bcc6', '#7f8995')}${grad('lovRau', '#b9bec5', '#8e949c', '#666c74')}${grad('lovBrand', '#a9805a', '#7a5233', '#4b2f1b')}${grad('lovDraht', '#eef1f4', '#b8c0c9', '#7e8892')}${grad('lovPlat', '#3c8a5f', '#2f6b4a', '#24533a')}${grad('lovKoerper', '#5a626d', '#3b414a', '#2a2f36')}${grad('lovPaste', '#c3c8ce', '#a9b0b8', '#8f969f')}<radialGradient id="lovGlow"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".8"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient></defs>`;
  const svg = (W, H, label, body, cls) => `<svg class="lov ${cls || ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${DEFS}${body}</svg>`;
  const LOOK = { glatt: 'lovGlatt', seidenmatt: 'lovSeid', rau: 'lovRau', verbrannt: 'lovBrand' };
  const SOL = (look, d, extra) => `<path class="lsolf" fill="url(#${LOOK[look] || 'lovSeid'})" d="${d}"${extra || ''}/>`;

  /* ============================================================ Durchsteck-Lötstelle im Schnitt */
  const BY = 175, RL = 7, RH = 14, RP = 64, LP = 55, TOP = 130;   /* Lötauge-Unterkante, halbe Drahtbreite, halbe Lochbreite, Lötaugenradius, Drahtüberstand, Plattenoberseite (alles in Bildeinheiten) */
  /* Hohlkehle einer Seite als Bezier-Kurve in Bildkoordinaten. Die Kurve verlässt das Lötauge im Winkel θ (= berechneter Benetzungswinkel). */
  function filletGeom(j, cx) {
    const th = j.theta * Math.PI / 180, xc = RL + (RP - RL) * j.W, h = LP * C.clamp(0.85 * Math.pow(j.p.lot / 100, 0.9), 0.12, 1.25);
    const dome = h >= LP - 3, S = [xc, 0], E = dome ? [0, Math.min(h, LP + 14)] : [RL, h];
    const dist = Math.hypot(E[0] - S[0], E[1] - S[1]), d1 = 0.4 * dist, d2 = dome ? 0.5 * xc : 0.4 * dist;
    const P1 = [S[0] - d1 * Math.cos(th), S[1] + d1 * Math.sin(th)], P2 = dome ? [E[0] + d2, E[1]] : [E[0] + d2 * Math.sin(th), E[1] - d2 * Math.cos(th)];
    const X = (s, p) => q(cx + s * p[0]) + ' ' + q(BY + p[1]);
    return { th, xc, h, dome, S, E, X, side: s => `M${X(s, S)} C${X(s, P1)} ${X(s, P2)} ${X(s, E)}`, mid: [(S[0] + 3 * P1[0] + 3 * P2[0] + E[0]) / 8, (S[1] + 3 * P1[1] + 3 * P2[1] + E[1]) / 8], P1, P2 };
  }
  /* Eine Lötstelle (Mitte cx): Platine, Hülse, Füllung, Draht, Lot, Kupfer. Rückgabe { s, G } */
  function jointLayers(cx, j, x0, x1) {
    const G = filletGeom(j, cx), mass = j.p.mass === 'masse', fillH = j.melted ? j.fill / 100 * 38 : 0, brand = j.look === 'verbrannt' ? ' brand' : '';
    let s = R(x0, TOP, x1 - x0, 40, 'lbrd') + R(x0, TOP, x1 - x0, 3, 'lmask') + R(cx - RH, TOP, 2 * RH, 40, 'lhole');
    if (fillH > 0) s += R(cx + RL, BY - 5 - fillH, RH - RL, fillH, 'lsol' + brand) + R(cx - RH, BY - 5 - fillH, RH - RL, fillH, 'lsol' + brand);
    s += R(cx - RL, 98, 2 * RL, BY + LP - 98, 'ldr');
    if (!j.melted) {   /* nicht geflossen: rauer Klumpen mit Körnern */
      const pts = [[24, 0], [28, 7], [22, 15], [25, 23], [16, 31], [10, 35], [RL, 42]];
      for (const sg of [1, -1]) s += `<path class="lrau" fill="url(#lovRau)" d="M${pts.map(p => q(cx + sg * p[0]) + ' ' + q(BY + p[1])).join(' L')} L${cx + sg * RL} ${BY} Z"/>`;
      for (const p of [[16, 8], [20, 16], [12, 22], [-15, 10], [-20, 18], [-12, 26], [19, 4]]) s += `<circle class="lspk" cx="${cx + p[0]}" cy="${BY + p[1]}" r="1.7"/>`;
    } else if (G.dome) {
      s += SOL(j.look, `${G.side(1)} L${G.X(-1, G.E)} C${G.X(-1, G.P2)} ${G.X(-1, G.P1)} ${G.X(-1, G.S)} Z`);
    } else {
      s += SOL(j.look, `${G.side(1)} L${cx + RL} ${BY} Z`) + SOL(j.look, `${G.side(-1)} L${cx - RL} ${BY} Z`);
    }
    if (j.melted && j.fill >= 95) for (const sg of [1, -1]) s += SOL(j.look, `M${cx + sg * RL} ${TOP - 15} Q${cx + sg * (RL + 3)} ${TOP - 7} ${cx + sg * 26} ${TOP - 5} L${cx + sg * RL} ${TOP - 5} Z`);
    for (const sg of [1, -1]) {   /* Hülse und Lötaugen oben und unten */
      s += R(sg > 0 ? cx + RH : cx - RH - 3, TOP - 5, 3, 50, 'lcu') + R(sg > 0 ? cx + RH : cx - RP, TOP - 5, RP - RH, 5, 'lcu') + R(sg > 0 ? cx + RH : cx - RP, BY - 5, RP - RH, 5, 'lcu');
    }
    if (mass) s += R(x0, BY - 5, cx - RP - x0, 5, 'lcu') + R(cx + RP, BY - 5, x1 - cx - RP, 5, 'lcu');
    if (j.melted && j.look === 'glatt') s += `<path class="lshine" d="${G.side(1)}"/><path class="lshine" d="${G.side(-1)}"/>`;
    return { s, G };
  }
  /* Fehler-Zutaten: Lunker, Lotkugeln, Flussmittelreste */
  function jointDeco(cx, deco) {
    if (deco === 'lunker') return [[34, BY + 9, 4.5], [20, BY + 21, 3.2], [-31, BY + 11, 5], [10, BY - 22, 2.6]].map(p => `<circle class="lvoid" cx="${cx + p[0]}" cy="${p[1]}" r="${p[2]}"/>`).join('');
    if (deco === 'perle') return [[96, 5], [112, 3.2], [-102, 4]].map(p => `<circle class="lball" cx="${cx + p[0]}" cy="${TOP + 40 + p[1]}" r="${p[1]}"/>`).join('');
    if (deco === 'ueberhitzt') return [[70, 4, 3], [-72, 5, 2.6], [82, 9, 2], [-84, 11, 2.2]].map(p => `<circle class="lres" cx="${cx + p[0]}" cy="${BY + p[1]}" r="${p[2]}"/>`).join('');
    return '';
  }
  function jointSvg(j, o) {
    if (!j) return svg(440, 300, 'Lötstelle', T(220, 150, 'keine Daten', 'mid'));
    const cx = 220, B = jointLayers(cx, j, 20, 420), G = B.G, deco = (o && o.deco) || '';
    let s = `<ellipse class="lglow" cx="${cx}" cy="${BY + 14}" rx="96" ry="42" fill="url(#lovGlow)"/>`;
    s += R(cx - 36, 50, 72, 50, 'lkoerper', 5) + T(cx, 80, 'Bauteil', 'mid lw') + B.s + jointDeco(cx, deco);
    /* Beschriftung */
    s += T(14, 114, 'Anschluss', 'b') + L(88, 110, cx - RL - 1, 110, 'lld') + T(30, 156, 'Platine', 'lw');
    s += T(300, 122, 'Lötauge', 'b') + L(296, 118, cx + RP - 6, TOP - 3, 'lld') + T(300, 160, 'Hülse', 'lw') + L(296, 156, cx + RH + 5, 156, 'lld lldw');
    if (j.p.mass === 'masse') s += T(14, 196, 'Massefläche', 'b');
    if (j.melted) {
      s += T(302, 232, 'Hohlkehle', 'b') + L(298, 228, cx + G.mid[0], BY + G.mid[1], 'lld');
      if (G.xc < RP - 12) s += T(302, 204, 'nicht benetzt', 'b hi') + L(298, 200, cx + (G.xc + RP) / 2, BY + 1, 'lld');
      const r0 = 26, aE = j.theta * Math.PI / 180, S0 = [cx - G.xc, BY];
      s += `<path class="larc" d="M${q(S0[0] + r0)} ${BY} A${r0} ${r0} 0 0 1 ${q(S0[0] + r0 * Math.cos(aE))} ${q(BY + r0 * Math.sin(aE))}"/>` + T(14, 262, 'Benetzungswinkel θ ≈ ' + f(j.theta, 0) + '°', 'b') + L(120, 256, S0[0] + r0 * Math.cos(aE / 2) - 3, BY + r0 * Math.sin(aE / 2) + 2, 'lld');
    } else {
      s += T(302, 232, 'kalter Klumpen', 'b hi') + L(298, 228, cx + 22, BY + 22, 'lld') + T(14, 262, 'Lot nicht geflossen', 'b hi');
    }
    return svg(440, 280, 'Durchsteck-Lötstelle im Schnitt: ' + (j.melted ? 'Benetzungswinkel ' + f(j.theta, 0) + ' Grad, Hülse zu ' + f(j.fill, 0) + ' Prozent gefüllt' : 'Lot nicht geflossen'), s, 'lov-joint');
  }
  /* Lötbrücke: zwei Lötstellen und Lot dazwischen */
  function bridgeSvg() {
    const j = C.joint({ lot: 100, temp: 350, zeit: 3, flux: 'normal', alloy: 'sac', mass: 'normal' }), A = jointLayers(120, j, 20, 420), B = jointLayers(320, j, 20, 420);
    let s = R(90, 50, 60, 50, 'lkoerper', 5) + R(290, 50, 60, 50, 'lkoerper', 5) + A.s + B.s;
    s += SOL('glatt', `M150 ${BY} Q220 ${BY + 52} 290 ${BY} Z`) + `<path class="lshine" d="M162 ${BY + 8} Q220 ${BY + 40} 278 ${BY + 8}"/>` + T(220, BY + 72, 'Lot verbindet beide Lötstellen', 'mid b hi');
    return svg(440, 270, 'Lötbrücke: Lot verbindet zwei benachbarte Lötstellen', s, 'lov-joint');
  }

  /* ============================================================ Temperatur des Lötauges über der Zeit */
  function heatSvg(j) {
    if (!j) return svg(440, 276, 'Temperaturverlauf', T(220, 130, 'keine Daten', 'mid'));
    const W = 440, H = 276, ml = 54, mr = 12, mt = 26, mb = 78, TM = 8, YM = 480, p = j.p, tf = j.tm + C.OVER;
    const xs = t => ml + (W - ml - mr) * t / TM, ys = Tv => mt + (H - mt - mb) * (1 - Tv / YM);
    let s = R(ml, mt, W - ml - mr, H - mt - mb, 'lplot');
    for (const Tv of [100, 200, 300, 400]) s += L(ml, ys(Tv), W - mr, ys(Tv), 'lgrid') + T(ml - 6, ys(Tv) + 5, f(Tv, 0), 'end lm');
    for (const t of [0, 2, 4, 6, 8]) s += L(xs(t), mt, xs(t), H - mb, 'lgrid') + T(xs(t), H - mb + 19, f(t, 0), 'mid lm');
    s += T(W - mr, H - mb + 38, 'Zeit in s', 'end lm') + T(4, 16, '°C', 'lm');
    const pts = []; for (let t = 0; t <= TM + 1e-9; t += 0.1) pts.push([xs(t), ys(C.padTemp(p.temp, t, j.tau))]);
    if (j.melted) { const a = [[xs(j.tr), ys(tf)]]; for (let t = j.tr; t < p.zeit; t += 0.1) a.push([xs(t), ys(C.padTemp(p.temp, t, j.tau))]); a.push([xs(p.zeit), ys(C.padTemp(p.temp, p.zeit, j.tau))], [xs(p.zeit), ys(tf)]); s += `<path class="lwet" d="M${a.map(v => q(v[0]) + ' ' + q(v[1])).join(' L')} Z"/>`; }
    s += L(ml, ys(j.tm), W - mr, ys(j.tm), 'lmelt') + L(ml, ys(tf), W - mr, ys(tf), 'lflow') + L(ml, ys(p.temp), W - mr, ys(p.temp), 'ltip');
    s += PL(pts, 'lcurve') + L(xs(p.zeit), mt - 4, xs(p.zeit), H - mb, 'lmark');
    const ex = xs(p.zeit), ey = ys(j.tEnd);
    s += `<circle class="ldot" cx="${q(ex)}" cy="${q(ey)}" r="5.5"/>` + T(Math.min(Math.max(ex, 70), W - 70), mt - 8, 'Lötzeit ' + f(p.zeit, 1) + ' s', 'mid b');
    s += T(ex > W - 150 ? ex - 10 : ex + 10, ey + 22, 'Lötauge ' + f(j.tEnd, 0) + ' °C', ex > W - 150 ? 'end b' : 'b');
    /* Legende unter der Zeitachse (feste Zeilen, nichts liegt auf der Kurve) */
    const ly = H - 20;
    s += L(ml, ly - 5, ml + 22, ly - 5, 'lmelt') + T(ml + 28, ly, 'Schmelztemperatur ' + f(j.tm, 0) + ' °C', 'lm') + L(ml + 224, ly - 5, ml + 246, ly - 5, 'ltip') + T(ml + 252, ly, 'Spitze ' + f(p.temp, 0) + ' °C', 'lm');
    s += L(ml, ly + 15, ml + 22, ly + 15, 'lflow') + T(ml + 28, ly + 20, 'Fließtemperatur ' + f(tf, 0) + ' °C', 'lm');
    return svg(W, H, 'Temperatur des Lötauges über der Zeit: Lot kann ' + (j.melted ? f(j.twet, 1) + ' Sekunden fließen' : 'nicht fließen'), s, 'lov-heat');
  }

  /* ============================================================ Reflow-Profil und Ofen */
  const ZONEN = [['Vorwärmen', 'z1'], ['Halten', 'z2'], ['Spitze', 'z3'], ['Abkühlen', 'z4']];
  const zoneSpans = r => [[0, r.t1], [r.t1, r.t2], [r.t2, r.t4], [r.t4, r.t5]];
  function crossings(pts, Tm) {   /* erster Anstieg und letzter Abfall durch Tm */
    let up = NaN, down = NaN;
    for (let i = 1; i < pts.length; i++) { const [ta, a] = pts[i - 1], [tb, b] = pts[i]; if (a < Tm && b >= Tm && !fin(up)) up = ta + (Tm - a) / (b - a) * (tb - ta); if (a >= Tm && b < Tm) down = ta + (Tm - a) / (b - a) * (tb - ta); }
    return [up, down];
  }
  function reflowSvg(r, o) {
    if (!r) return svg(440, 324, 'Reflow-Profil', T(220, 150, 'keine Daten', 'mid'));
    const W = 440, H = 324, ml = 44, mr = 10, mt = 30, mb = 88, XM = Math.max(240, Math.ceil((r.t5 + 10) / 30) * 30), YM = 300, st = o && fin(o.t) ? o.t : NaN;
    const xs = t => ml + (W - ml - mr) * t / XM, ys = Tv => mt + (H - mt - mb) * (1 - Tv / YM), path = pts => pts.map(v => q(xs(v[0])) + ' ' + q(ys(v[1]))).join(' L');
    let s = '';
    zoneSpans(r).forEach((z, i) => { const x0 = xs(z[0]), x1 = xs(Math.min(z[1], XM)); s += R(x0, mt, x1 - x0, H - mt - mb, 'lzone ' + ZONEN[i][1]); if (x1 - x0 >= 64) s += T((x0 + x1) / 2, mt - 9, ZONEN[i][0], 'mid b lm'); });
    for (const Tv of [100, 200, 300]) s += L(ml, ys(Tv), W - mr, ys(Tv), 'lgrid') + T(ml - 6, ys(Tv) + 5, f(Tv, 0), 'end lm');
    const step = XM <= 300 ? 60 : 120; for (let t = 0; t < XM; t += step) s += T(xs(t), H - mb + 19, f(t, 0), 'mid lm');
    s += T(W - mr, H - mb + 38, 'Zeit in s', 'end lm') + T(4, 16, '°C', 'lm');
    const [cu, cd] = crossings(r.small, r.tm);
    if (fin(cu) && fin(cd)) {
      const a = [[cu, r.tm]].concat(r.small.filter(v => v[0] > cu && v[0] < cd), [[cd, r.tm]]);
      s += `<path class="lwet" d="M${path(a)} Z"/>` + L(xs(cu), ys(r.tm) + 12, xs(cd), ys(r.tm) + 12, 'lbr') + T((xs(cu) + xs(cd)) / 2, ys(r.tm) + 30, 'TAL ' + f(r.talS, 0) + ' s', 'mid b');
    }
    s += L(ml, ys(r.tm), W - mr, ys(r.tm), 'lmelt') + T(ml + 4, ys(r.tm) - 5, f(r.tm, 0) + ' °C Schmelzen', 'lm') + L(ml, ys(r.max), W - mr, ys(r.max), 'llim') + T(ml + 4, ys(r.max) - 5, f(r.max, 0) + ' °C Grenze', 'lm');
    s += `<path class="lbig" d="M${path(r.big)}"/><path class="lcurve" d="M${path(r.small)}"/>`;
    const pk = r.small[3][1]; s += `<circle class="ldot" cx="${q(xs((r.t3 + r.t4) / 2))}" cy="${q(ys(pk))}" r="5"/>` + T(xs((r.t3 + r.t4) / 2), ys(pk) - 10, f(pk, 0) + ' °C', 'mid b');
    if (fin(st)) { const S = C.reflowState(r, st); if (S) s += L(xs(Math.min(st, r.t5)), mt, xs(Math.min(st, r.t5)), H - mb, 'lmark') + `<circle class="ldot now" cx="${q(xs(Math.min(st, r.t5)))}" cy="${q(ys(S.T))}" r="6.5"/>`; }
    const ly = H - 20; s += L(ml, ly - 5, ml + 24, ly - 5, 'lcurve') + T(ml + 30, ly, 'kleines Bauteil', 'lm') + L(ml + 190, ly - 5, ml + 214, ly - 5, 'lbig') + T(ml + 220, ly, 'großes Bauteil, bleibt kälter', 'lm');
    s += R(ml, ly + 8, 14, 10, 'lwet') + T(ml + 20, ly + 18, 'Lot flüssig (TAL)', 'lm');
    return svg(W, H, 'Reflow-Profil: Spitze ' + f(pk, 0) + ' Grad, Zeit über Schmelztemperatur ' + f(r.talS, 0) + ' Sekunden', s, 'lov-reflow');
  }
  function ofenSvg(r, t) {
    if (!r) return svg(440, 150, 'Reflow-Ofen', T(220, 75, 'keine Daten', 'mid'));
    const X0 = 20, WD = 400, xt = v => X0 + WD * v / r.t5, tt = Math.min(Math.max(t || 0, 0), r.t5), S = C.reflowState(r, tt), bx = xt(tt);
    let s = R(X0, 34, WD, 74, 'lofen', 10);
    zoneSpans(r).forEach((z, i) => { const x0 = xt(z[0]), x1 = xt(z[1]); s += R(x0, 38, x1 - x0, 66, 'lzone ' + ZONEN[i][1] + ' lzo') + R(x0 + 6, 38, Math.max(0, x1 - x0 - 12), 6, 'lheat'); if (x1 - x0 >= 66) s += T((x0 + x1) / 2, 134, ZONEN[i][0], 'mid lm'); });
    s += L(14, 116, 426, 116, 'lbelt') + R(bx - 24, 104, 48, 7, 'lbrd', 2) + R(bx - 8, 98, 16, 6, 'lchip', 1.5) + `<ellipse class="lglow" cx="${q(bx)}" cy="104" rx="30" ry="14" fill="url(#lovGlow)"/>`;
    s += T(X0, 20, 'Zeit ' + f(tt, 0) + ' s, Lötstelle ' + f(S.T, 0) + ' °C', 'b');
    return svg(440, 146, 'Reflow-Ofen mit vier Zonen, Brett nach ' + f(tt, 0) + ' Sekunden', s, 'lov-ofen');
  }

  /* ============================================================ Chip-Lötstelle im Schnitt (Paste, flüssig, fest) und SMD-Fehler */
  const PHASEN = { paste: ['Paste', 'Lotpaste noch ungeschmolzen'], fluessig: ['Lot flüssig', 'Lot flüssig, Chip schwimmt auf'], fest: ['Lot erstarrt', 'Lot erstarrt, Hohlkehle am Chip'] };
  function chipFillets(fillCls, glatt) {
    const side = m => { const X = x => (m ? 440 - x : x); return `<path class="lsolf ${fillCls}" fill="url(#${glatt ? 'lovGlatt' : 'lovSeid'})" d="M${X(352)} 125 C${X(336)} 125 ${X(324)} 116 ${X(322)} 96 L${X(322)} 120 L${X(300)} 120 L${X(300)} 125 Z"/>`; };
    return side(0) + side(1);
  }
  function chipSvg(phase, Tc) {
    phase = PHASEN[phase] ? phase : 'fest';
    let s = `<ellipse class="lglow${phase === 'fluessig' ? ' hot' : ''}" cx="220" cy="128" rx="170" ry="30" fill="url(#lovGlow)"/>` + R(20, 130, 400, 30, 'lbrd') + R(20, 130, 400, 3, 'lmask') + R(70, 125, 110, 5, 'lcu') + R(260, 125, 110, 5, 'lcu');
    if (phase === 'paste') {
      for (const x0 of [88, 276]) { s += R(x0, 112, 76, 13, 'lpaste', 3); for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 2; gy++) s += `<circle class="lkorn" cx="${x0 + 6 + gx * 9 + (gy ? 4 : 0)}" cy="${q(117 + gy * 6)}" r="2.6"/>`; }
      s += R(118, 76, 204, 36, 'lchip', 4) + R(118, 76, 22, 36, 'lcap') + R(300, 76, 22, 36, 'lcap');
    } else {
      s += chipFillets(phase === 'fluessig' ? 'flu' : '', phase === 'fluessig') + R(118, 84, 204, 36, 'lchip', 4) + R(118, 84, 22, 36, 'lcap') + R(300, 84, 22, 36, 'lcap');
      if (phase === 'fluessig') s += `<path class="lshine" d="M352 125 C336 125 324 116 322 96"/><path class="lshine" d="M88 125 C104 125 116 116 118 96"/>`;
    }
    s += T(220, 106, 'Chip', 'mid lw') + T(76, 152, 'Lötauge', 'lw') + T(14, 22, PHASEN[phase][0], 'b') + (fin(Tc) ? T(426, 22, f(Tc, 0) + ' °C', 'end b') : '');
    return svg(440, 168, 'Chip-Lötstelle im Schnitt: ' + PHASEN[phase][1], s, 'lov-chip');
  }
  function grabsteinSvg() {
    let s = R(20, 130, 400, 30, 'lbrd') + R(20, 130, 400, 3, 'lmask') + R(50, 125, 130, 5, 'lcu') + R(240, 125, 130, 5, 'lcu');
    s += `<path class="lsolf" fill="url(#lovSeid)" d="M350 125 C334 125 318 118 312 104 L312 125 Z"/><g transform="rotate(68 312 122)">${R(190, 98, 122, 24, 'lchip', 3)}${R(290, 98, 22, 24, 'lcap')}${R(190, 98, 22, 24, 'lcap')}</g>`;
    s += T(50, 112, 'Pad ohne Lot', 'b') + T(288, 82, 'Lot hält nur', 'end b') + T(288, 100, 'ein Ende fest', 'end b');
    return svg(440, 168, 'Grabstein: Chip steht an einem Ende auf', s, 'lov-chip');
  }
  function smdBrueckeSvg() {
    let s = R(20, 130, 400, 30, 'lbrd') + R(20, 130, 400, 3, 'lmask') + R(120, 125, 70, 5, 'lcu') + R(250, 125, 70, 5, 'lcu') + R(100, 38, 240, 44, 'lkoerper', 6) + T(220, 66, 'IC-Gehäuse', 'mid lw');
    for (const x of [150, 290]) s += R(x - 6, 82, 12, 30, 'lpin') + R(x - 22, 112, 52, 8, 'lpin') + SOL('glatt', `M${x - 34} 125 Q${x - 26} 112 ${x - 16} 108 L${x + 40} 108 Q${x + 44} 114 ${x + 46} 125 Z`);
    s += SOL('glatt', 'M190 125 Q220 96 250 125 Z') + `<path class="lshine" d="M196 120 Q220 102 244 120"/>` + T(220, 152, 'Lot verbindet zwei Anschlüsse', 'mid lw');
    return svg(440, 168, 'Brücke am IC: Lot verbindet zwei Anschlüsse', s, 'lov-chip');
  }

  /* ============================================================ Fehlerbilder */
  const DPAR = { ziel: {}, wenig: { lot: 45 }, viel: { lot: 190 }, kalt: { zeit: 0.8 }, benetzt: { flux: 'kein' }, lunker: {}, ueberhitzt: { temp: 430, zeit: 6 }, perle: {} };
  function defectSvg(k) {
    if (k === 'bruecke') return bridgeSvg();
    if (k === 'smdziel') return chipSvg('fest');
    if (k === 'grabstein') return grabsteinSvg();
    if (k === 'smdbruecke') return smdBrueckeSvg();
    const j = C.joint(Object.assign({ lot: 100, temp: 350, zeit: 3, flux: 'normal', alloy: 'sac', mass: 'normal' }, DPAR[k] || {}));
    return jointSvg(j, { deco: k === 'lunker' || k === 'perle' || k === 'ueberhitzt' ? k : '' });
  }

  /* CSS der Grafiken (wird im Browser einmal eingefügt) */
  const CSS = `.lov{display:block;width:100%;height:auto}.lov text{font-family:system-ui,sans-serif;font-size:14px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.lov .b{font-weight:700;paint-order:stroke;stroke:var(--panel2);stroke-width:4px;stroke-linejoin:round}.lov .mid{text-anchor:middle}.lov .end{text-anchor:end}.lov .lm{fill:var(--mute)}.lov .lw{fill:#fff}.lov text.hi{fill:var(--hi)}
.lov .lbrd{fill:url(#lovPlat)}.lov .lmask{fill:#173a29;opacity:.65}.lov .lhole{fill:#10261b}.lov .lcu{fill:url(#lovCu)}
.lov .ldr{fill:url(#lovDraht);stroke:#6f7882;stroke-width:1}.lov .lkoerper{fill:url(#lovKoerper)}.lov .lchip{fill:#2b2f36;stroke:#12151a;stroke-width:1}.lov .lcap{fill:url(#lovDraht);stroke:#6f7882;stroke-width:1}.lov .lpin{fill:url(#lovDraht);stroke:#6f7882;stroke-width:1}
.lov .lsolf{stroke:#59636f;stroke-width:1.2;stroke-linejoin:round}.lov .lsol{fill:#aeb6c0;stroke:#59636f;stroke-width:.8}.lov .lsol.brand{fill:#7a5233}.lov .lrau{stroke:#4d5560;stroke-width:1.4;stroke-linejoin:round}.lov .lspk{fill:#4d5560}
.lov .lshine{fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;opacity:.65}.lov .lvoid{fill:#10261b;stroke:#59636f;stroke-width:1}.lov .lball{fill:url(#lovGlatt);stroke:#59636f;stroke-width:1}.lov .lres{fill:#3b2a1b}
.lov .lpaste{fill:url(#lovPaste);stroke:#7d848d;stroke-width:1}.lov .lkorn{fill:#e6e9ed;stroke:#7d848d;stroke-width:.8}
.lov .lglow{opacity:.4}.lov .lglow.hot{opacity:.8}
.lov .lld{stroke:var(--mute);stroke-width:1.2;fill:none}.lov .lldw{stroke:#fff}.lov .larc{fill:none;stroke:var(--hi);stroke-width:3;stroke-linecap:round}
.lov .lplot{fill:var(--panel);stroke:var(--line)}.lov .lgrid{stroke:var(--line);stroke-width:1}
.lov .lcurve{fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round}.lov .lbig{fill:none;stroke:var(--hi);stroke-width:2.4;stroke-dasharray:7 5;stroke-linejoin:round}
.lov .lmelt{stroke:var(--danger);stroke-width:1.6;stroke-dasharray:6 4}.lov .lflow{stroke:var(--warn);stroke-width:1.6;stroke-dasharray:2 4}.lov .ltip{stroke:var(--mute);stroke-width:1.4;stroke-dasharray:10 4}.lov .llim{stroke:var(--danger);stroke-width:1.6;stroke-dasharray:2 3}
.lov .lmark{stroke:var(--fg);stroke-width:1.2;stroke-dasharray:3 3;opacity:.7}.lov .lbr{stroke:var(--fg);stroke-width:2}.lov .lwet{fill:var(--ok);fill-opacity:.28;stroke:none}
.lov .ldot{fill:var(--accent);stroke:var(--panel);stroke-width:2}.lov .ldot.now{fill:var(--hi)}
.lov .lzone{stroke:none}.lov .z1{fill:var(--accent);fill-opacity:.1}.lov .z2{fill:var(--ok);fill-opacity:.1}.lov .z3{fill:var(--hi);fill-opacity:.16}.lov .z4{fill:var(--accent);fill-opacity:.1}.lov .lzo{fill-opacity:.35}
.lov .lofen{fill:var(--panel2);stroke:var(--mute);stroke-width:1.6}.lov .lheat{fill:var(--hi);opacity:.55}.lov .lbelt{stroke:var(--mute);stroke-width:3;stroke-dasharray:8 6}
.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:560px;margin:8px auto}.vzbox.full{max-width:none}
@media(prefers-reduced-motion:no-preference){
.lov .lglow{animation:lovGl 3.2s ease-in-out infinite}@keyframes lovGl{50%{opacity:.7}}
.lov .lshine{animation:lovSh 4s ease-in-out infinite}@keyframes lovSh{50%{opacity:.25}}
.lov .ldot.now{animation:lovPu 1.6s ease-in-out infinite}@keyframes lovPu{50%{opacity:.5}}
.lov .lheat{animation:lovHt 2.4s ease-in-out infinite}@keyframes lovHt{50%{opacity:.25}}
.lov .lbelt{animation:lovBl 1.2s linear infinite}@keyframes lovBl{to{stroke-dashoffset:-28}}}`;

  const API = { BY, RP, LP, filletGeom, jointSvg, bridgeSvg, heatSvg, reflowSvg, ofenSvg, chipSvg, grabsteinSvg, smdBrueckeSvg, defectSvg, crossings, ZONEN, PHASEN, DPAR, CSS };
  root.LOT_VIZ = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('lotviz-css')) { try { const st = document.createElement('style'); st.id = 'lotviz-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
