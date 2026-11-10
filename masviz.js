'use strict';
/* Tonfunk Maschinenelemente-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei masviz.js, eingebunden VOR masui.js.
   1) Zahnradtrieb ein- bis dreistufig: Zähne greifen nach der Teilung ineinander, die Räder drehen sich im Verhältnis der Zähnezahlen (Drehrichtung, Drehzahl-Anzeige).
   2) Riemen- und Kettentrieb: Scheiben bzw. Kettenräder in maßstäblicher Größe, Riemen und Kette laufen mit.
   3) Wälzlager im Schnitt aus dem Kurzzeichen (schematisch: nur die Bohrung folgt der Zahl, die Reihe ändert die Kräftigkeit, keine echten Außenmaße).
   4) Federschaltung (Zeichnung) und Federkennlinie, Lagerung fest/los mit Wärmedehnung, Reibungszustände im Gleitlager (Stribeck, qualitativ), Dichtungen im Schnitt.
   Grafiken zeigen Zusammenhänge. Sie erscheinen in Rechnern, Beispielen und Hilfe, nie in den Aufgaben (Verdeckte-Fehler-Prinzip).
   Alle Zahlen sind ÜBUNGSWERTE. Farben nur über CSS-Variablen. Bewegung ist dezent (höchstens etwa 100 Grad pro Sekunde an der schnellsten Welle),
   wird bei prefers-reduced-motion nicht gestartet und lässt sich in der Oberfläche abschalten; ohne Bewegung stehen alle Räder korrekt im Eingriff.
   window.MAS_VIZ bzw. module.exports: reine Funktionen, die SVG-Text liefern (für Tests), dazu motion() und scan() für die Bewegung. */
(function (root) {
  const C = root.MAS_CORE || (typeof require !== 'undefined' ? require('./mascore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const q = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const svg = (w, h, label, body, extra) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"${extra || ''}>${body}</svg>`;
  const T = (x, y, t, o) => { o = o || {}; return `<text x="${q(x)}" y="${q(y)}" font-size="${o.s || 14}" text-anchor="${o.a || 'middle'}" fill="var(--${o.c || 'fg'})"${o.w ? ' font-weight="700"' : ''}${o.halo ? ' stroke="var(--panel2)" stroke-width="3" paint-order="stroke"' : ''}>${esc(t)}</text>`; };
  const msg = (t, w) => svg(w || 480, 60, 'Hinweis', T((w || 480) / 2, 34, t, { c: 'mute' }));
  const COLS = ['accent', 'hi', 'ok', 'warn'];
  const SUB = ['₀', '₁', '₂', '₃', '₄', '₅'];
  let uid = 0;

  /* ============================================================ 1) Zahnradtrieb */
  /* PRUEFEN P22: Die Zahnform im Bild ist bewusst vereinfacht (Trapez statt Evolvente), die Teilung stimmt, die Räder stehen im Eingriff und laufen im Verhältnis der Zähnezahlen. Reicht das für den Unterricht, oder soll die echte Evolventenform gezeigt werden? */
  /* Zahnkontur: Zähne als Trapez zwischen Fuß- und Kopfkreis, mittig auf den Winkeln k · 360°/z (Radien in Pixeln, Mitte im Ursprung) */
  function toothPath(z, rT, rR) {
    const ph = 2 * Math.PI / z, hr = 0.30 * ph, ht = 0.13 * ph, p = (r, a) => q(r * Math.cos(a)) + ' ' + q(r * Math.sin(a));
    let d = 'M' + p(rR, -hr);
    for (let k = 0; k < z; k++) { const a = k * ph; d += 'L' + p(rT, a - ht) + 'L' + p(rT, a + ht) + 'L' + p(rR, a + hr) + 'A' + q(rR) + ' ' + q(rR) + ' 0 0 1 ' + p(rR, a + ph - hr); }
    return d + 'Z';
  }
  function gearBody(z, rT, rR, col, spokes) {
    let s = `<path d="${toothPath(z, rT, rR)}" fill="var(--${col})" fill-opacity=".30" stroke="var(--${col})" stroke-width="1.6" stroke-linejoin="round"/>`;
    s += `<circle r="${q(rR * 0.62)}" fill="none" stroke="var(--${col})" stroke-width="1.2" stroke-opacity=".8"/>`;
    if (spokes) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; s += `<path d="M${q(rR * 0.18 * Math.cos(a))} ${q(rR * 0.18 * Math.sin(a))}L${q(rR * 0.62 * Math.cos(a))} ${q(rR * 0.62 * Math.sin(a))}" stroke="var(--${col})" stroke-width="2" stroke-opacity=".8"/>`; }
    s += `<circle cx="${q(rR * 0.82)}" cy="0" r="${q(Math.max(2.2, rR * 0.07))}" fill="var(--fg)"/><circle r="${q(Math.max(3, rR * 0.16))}" fill="var(--bg)" stroke="var(--${col})" stroke-width="1.5"/>`;
    return s;
  }
  function arcArrow(cx, cy, r, cw) {
    const P = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)], a0 = -2.0, a1 = 2.6, st = cw ? a0 : a1, en = cw ? a1 : a0, sg = cw ? 1 : -1, p0 = P(st), p1 = P(en);
    const tx = sg * -Math.sin(en), ty = sg * Math.cos(en), rx = Math.cos(en), ry = Math.sin(en), tip = [p1[0] + tx * 7, p1[1] + ty * 7];
    return `<path d="M${q(p0[0])} ${q(p0[1])}A${q(r)} ${q(r)} 0 1 ${cw ? 1 : 0} ${q(p1[0])} ${q(p1[1])}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linecap="round"/><path d="M${q(tip[0])} ${q(tip[1])}L${q(p1[0] + rx * 4.5)} ${q(p1[1] + ry * 4.5)}L${q(p1[0] - rx * 4.5)} ${q(p1[1] - ry * 4.5)}Z" fill="var(--fg)"/>`;
  }
  /* Lage und Drehung aller Räder (Millimeter): Rad 1 links, jede Stufe unter dem Winkel al[k] zur nächsten Welle.
     Je Rad: x, y, m, z, rate (Drehgeschwindigkeit relativ zu Rad 1, mit Vorzeichen), ph (Startwinkel in Grad, so dass die Zähne ineinandergreifen), shaft (Wellennummer), coax */
  const AL = [0, 55, -25];
  function trainLayout(st) {
    const G = [];
    st.forEach((s, k) => {
      let A;
      if (k === 0) { A = { x: 0, y: 0, m: s.m1, z: s.z1, rate: 1, ph: AL[0], shaft: 0 }; }
      else { const pb = G.find(g => g.shaft === k && !g.coax); A = { x: pb.x, y: pb.y, m: s.m1, z: s.z1, rate: pb.rate, ph: AL[k], shaft: k, coax: true }; }
      G.push(A);
      const rA = A.m * A.z / 2, rB = s.m2 * s.z2 / 2, a = rA + rB, an = AL[k] * Math.PI / 180;
      G.push({ x: A.x + a * Math.cos(an), y: A.y + a * Math.sin(an), m: s.m2, z: s.z2, rate: -A.rate * A.z / s.z2, ph: AL[k] + 180 + 180 / s.z2, shaft: k + 1 });
    });
    return G;
  }
  /* stages: [{ m1, z1, m2, z2 }] (m1/z1 treibendes Rad der Stufe, m2/z2 getriebenes). Die zweite Stufe sitzt mit ihrem treibenden Rad auf der Welle des getriebenen Rades der ersten.
     o: { n1: Antriebsdrehzahl (nur für die Anzeige und die Geschwindigkeit), dims: Teilkreise und Achsabstand einzeichnen, unit } */
  function gearTrain(o) {
    o = o || {}; const st = (o.stages || []).filter(s => s && C.fin(s.z1) && C.fin(s.z2) && s.z1 >= 3 && s.z2 >= 3 && s.m1 > 0 && s.m2 > 0 && s.z1 <= 200 && s.z2 <= 200);
    if (!st.length || st.length > 3 || st.length !== (o.stages || []).length) return msg('Bitte gültige Zähnezahlen (3 bis 200) und einen Modul größer 0 eingeben.');
    const G = trainLayout(st);
    const H = st.length === 1 ? 270 : 330, W = 480;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    G.forEach(g => { g.rT = g.m * (g.z + 2) / 2; g.rR = g.m * (g.z - 2.5) / 2; g.rP = g.m * g.z / 2; x0 = Math.min(x0, g.x - g.rT); x1 = Math.max(x1, g.x + g.rT); y0 = Math.min(y0, g.y - g.rT); y1 = Math.max(y1, g.y + g.rT); });
    const sc = Math.min((W - 30) / (x1 - x0), (H - 62) / (y1 - y0), 8), ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = 24 + ((H - 62) - (y1 - y0) * sc) / 2 - y0 * sc;
    const maxRate = Math.max.apply(null, G.map(g => Math.abs(g.rate))), base = o.n1 > 0 ? 40 + Math.min(o.n1, 3000) / 3000 * 60 : 0, spd = q(base / maxRate);
    let body = '';
    G.slice().sort((a, b) => b.rT - a.rT).forEach(g => {
      const cx = ox + g.x * sc, cy = oy + g.y * sc;
      body += `<g transform="translate(${q(cx)} ${q(cy)})"><g class="mv-rot" data-r="${q(g.rate * 1000) / 1000}" data-ph="${q(g.ph)}" transform="rotate(${q(g.ph)})">${gearBody(g.z, g.rT * sc, g.rR * sc, COLS[g.shaft % 4], g.rR * sc > 22)}</g></g>`;
    });
    if (o.dims) {
      const a0 = G[0], b0 = G[1];
      [a0, b0].forEach(g => { body += `<circle cx="${q(ox + g.x * sc)}" cy="${q(oy + g.y * sc)}" r="${q(g.rP * sc)}" fill="none" stroke="var(--fg)" stroke-width="1.2" stroke-dasharray="5 4" stroke-opacity=".7"/>`; });
      const mx = ox + (a0.x + b0.x) / 2 * sc, my = oy + (a0.y + b0.y) / 2 * sc;
      body += `<path d="M${q(ox + a0.x * sc)} ${q(oy + a0.y * sc)}L${q(ox + b0.x * sc)} ${q(oy + b0.y * sc)}" stroke="var(--fg)" stroke-width="1.2" stroke-dasharray="8 3 2 3"/>` + T(mx, my - 8, 'a = ' + f((st[0].m1 * st[0].z1 + st[0].m2 * st[0].z2) / 2, 1) + ' mm', { s: 14, w: 1, halo: 1 });
    }
    /* Beschriftung: Zähnezahl in der Mitte, Drehzahl unter dem größten Rad je Welle */
    G.forEach(g => {
      const cx = ox + g.x * sc, cy = oy + g.y * sc, big = G.filter(h => h.x === g.x && h.y === g.y), dy = big.length > 1 ? (g === big[0] ? -9 : 11) : 4;
      if (g.rR * sc >= 15) body += T(cx, cy + dy, 'z = ' + g.z, { s: 13, halo: 1 });
    });
    const dirs = [];
    for (let k = 0; k <= st.length; k++) {
      const sh = G.filter(g => g.shaft === k), g = sh.slice().sort((a, b) => b.rT - a.rT)[0], cw = g.rate > 0, cx = ox + g.x * sc, cy = oy + g.y * sc;
      if (g.rR * sc >= 30) body += arcArrow(cx, cy, g.rR * sc * 0.45, cw);
      const nn = fin(o.n1) ? o.n1 * Math.abs(g.rate) : NaN;
      dirs.push(cw);
      body += T(cx, Math.min(H - 8, cy + g.rT * sc + 15), 'n' + SUB[k + 1] + ' = ' + f(nn, nn < 100 ? 1 : 0) + ' 1/min ' + (cw ? '↻' : '↺'), { s: 13, c: COLS[k % 4], w: 1, halo: 1 });
    }
    const lab = 'Zahnradtrieb mit ' + (st.length === 1 ? 'einer Stufe' : st.length + ' Stufen') + ': ' + G.map(g => 'z ' + g.z).join(', ');
    return svg(W, H, lab, body, ` data-spd="${spd}"`);
  }

  /* ============================================================ 2) Riemen- und Kettentrieb */
  /* o: { kind: 'keil' | 'zahn' | 'kette', d1, d2, a (mm), z1, z2, p (Kette), n1 } */
  function beltDrive(o) {
    o = o || {}; const kind = o.kind === 'zahn' || o.kind === 'kette' ? o.kind : 'keil', ch = kind === 'kette';
    let r1, r2, a = o.a;
    if (ch) { r1 = C.chainR(o.z1, o.p); r2 = C.chainR(o.z2, o.p); } else { r1 = o.d1 / 2; r2 = o.d2 / 2; }
    if (!(r1 > 0 && r2 > 0 && a > 0) || Math.abs(r2 - r1) >= a * 0.98) return msg('Mit diesen Werten lässt sich der Trieb nicht zeichnen (Achsabstand zu klein oder Eingaben fehlen).');
    const W = 480, H = 230, rm = Math.max(r1, r2), x0 = -r1, x1 = a + r2, sc = Math.min((W - 40) / (x1 - x0), (H - 70) / (2 * rm), 6), ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, cy = 30 + (H - 70) / 2 + 8;
    const R1 = r1 * sc, R2 = r2 * sc, cx1 = ox, cx2 = ox + a * sc, sd = (r2 - r1) / a, d = Math.asin(sd), co = Math.cos(d);
    const u1 = [cx1 - sd * R1, cy - co * R1], u2 = [cx2 - sd * R2, cy - co * R2], l1 = [cx1 - sd * R1, cy + co * R1], l2 = [cx2 - sd * R2, cy + co * R2];
    const loop = `M${q(u1[0])} ${q(u1[1])}L${q(u2[0])} ${q(u2[1])}A${q(R2)} ${q(R2)} 0 ${r2 > r1 ? 1 : 0} 1 ${q(l2[0])} ${q(l2[1])}L${q(l1[0])} ${q(l1[1])}A${q(R1)} ${q(R1)} 0 ${r2 > r1 ? 0 : 1} 1 ${q(u1[0])} ${q(u1[1])}Z`;
    const i = ch ? o.z2 / o.z1 : o.d2 / o.d1, rate2 = 1 / i, base = o.n1 > 0 ? 40 + Math.min(o.n1, 3000) / 3000 * 60 : 0, spd = q(base / Math.max(1, rate2));
    let body = '';
    if (ch) {
      body += `<path d="${loop}" fill="none" stroke="var(--fg)" stroke-width="5" stroke-opacity=".9" stroke-linejoin="round"/>`;
      const per = o.p * sc;
      body += `<path class="mv-dash" data-v="${q(R1)}" data-per="${q(per)}" d="${loop}" fill="none" stroke="var(--panel2)" stroke-width="2.6" stroke-dasharray="${q(per * 0.55)} ${q(per * 0.45)}"/>`;
    } else if (kind === 'zahn') {
      body += `<path d="${loop}" fill="none" stroke="var(--fg)" stroke-opacity=".85" stroke-width="6" stroke-linejoin="round"/><path class="mv-dash" data-v="${q(R1)}" data-per="9" d="${loop}" fill="none" stroke="var(--panel2)" stroke-width="3" stroke-dasharray="4.5 4.5"/>`;
    } else {
      body += `<path d="${loop}" fill="none" stroke="var(--fg)" stroke-opacity=".85" stroke-width="8" stroke-linejoin="round"/><path class="mv-dash" data-v="${q(R1)}" data-per="22" d="${loop}" fill="none" stroke="var(--panel2)" stroke-width="2" stroke-dasharray="3 19"/>`;
    }
    const wheel = (cx, R, z, rate, col) => {
      let g = '';
      if (ch) g = `<path d="${toothPath(z, R + Math.min(6, R * 0.14), Math.max(2, R - Math.min(6, R * 0.14)))}" fill="var(--${col})" fill-opacity=".30" stroke="var(--${col})" stroke-width="1.4" stroke-linejoin="round"/>`;
      else g = `<circle r="${q(R)}" fill="var(--${col})" fill-opacity=".28" stroke="var(--${col})" stroke-width="2"/>` + (kind === 'zahn' ? `<circle r="${q(R * 0.9)}" fill="none" stroke="var(--${col})" stroke-dasharray="3 3" stroke-width="1.2"/>` : `<circle r="${q(R * 0.9)}" fill="none" stroke="var(--${col})" stroke-width="1.2" stroke-opacity=".7"/>`);
      for (let k = 0; k < 3; k++) { const an = k * 2 * Math.PI / 3; g += `<path d="M0 0L${q(R * 0.78 * Math.cos(an))} ${q(R * 0.78 * Math.sin(an))}" stroke="var(--${col})" stroke-width="2.4" stroke-opacity=".8"/>`; }
      g += `<circle cx="${q(R * 0.55)}" cy="0" r="${q(Math.max(2, R * 0.07))}" fill="var(--fg)"/><circle r="${q(Math.max(3, R * 0.14))}" fill="var(--bg)" stroke="var(--${col})" stroke-width="1.5"/>`;
      return `<g transform="translate(${q(cx)} ${q(cy)})"><g class="mv-rot" data-r="${q(rate * 1000) / 1000}" data-ph="0" transform="rotate(0)">${g}</g></g>`;
    };
    body += wheel(cx1, R1, o.z1, 1, 'accent') + wheel(cx2, R2, o.z2, rate2, 'hi');
    if (R1 > 22) body += arcArrow(cx1, cy, R1 * 0.4, true);
    if (R2 > 22) body += arcArrow(cx2, cy, R2 * 0.4, true);
    const n1 = o.n1;
    body += T(cx1, Math.min(H - 8, cy + R1 + 16 + (kind === 'kette' ? 6 : 8)), 'n₁ = ' + f(n1, 0) + ' 1/min ↻', { s: 13, c: 'accent', w: 1, halo: 1 }) + T(cx2, Math.min(H - 8, cy + R2 + 16 + 8), 'n₂ = ' + f(n1 / i, n1 / i < 100 ? 1 : 0) + ' 1/min ↻', { s: 13, c: 'hi', w: 1, halo: 1 });
    body += T(cx1, cy + 4, ch ? 'z = ' + o.z1 : 'd₁ ' + f(o.d1, 0), { s: 12, halo: 1 }) + T(cx2, cy + 4, ch ? 'z = ' + o.z2 : 'd₂ ' + f(o.d2, 0), { s: 12, halo: 1 });
    return svg(W, H, (ch ? 'Kettentrieb' : kind === 'zahn' ? 'Zahnriementrieb' : 'Keilriementrieb') + ' mit zwei Rädern, Übersetzung ' + f(i, 2), body, ` data-spd="${spd}"`);
  }

  /* ============================================================ 3) Wälzlager im Schnitt */
  function bearingSection(pb) {
    if (!pb || !pb.ok) return msg((pb && pb.err) || 'Kein gültiges Kurzzeichen.', 360);
    const W = 360, H = 266, cy = 120, cx = 190, rank = pb.rank, Hr = 46 + rank * 8, rb = 30, B = 74 + rank * 3, t = Hr * 0.26, e = Hr - 2 * t, Ro = rb + Hr, id = 'mvh' + (++uid);
    const defs = `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel2)"/><path d="M0 0V6" stroke="var(--mute)" stroke-width="1.6"/></pattern></defs>`;
    const ring = (x, y, w, h) => `<rect x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}" fill="url(#${id})" stroke="var(--fg)" stroke-width="1.5"/>`;
    const ym = rb + t + e / 2, tp = pb.type, K = 'var(--hi)';
    let half = '';
    const ball = (x, y) => `<circle cx="${q(x)}" cy="${q(y)}" r="${q(e / 2)}" fill="${K}" fill-opacity=".4" stroke="${K}" stroke-width="2"/>`;
    if (tp === 'axial') {
      const tw = t * 1.1, xl = cx - e / 2 - tw, xr = cx + e / 2;
      half += ring(xl, rb, tw, Hr) + ring(xr, rb, tw, Hr) + ball(cx, ym);
    } else {
      let xi = cx - B / 2, wi = B, xo = cx - B / 2, wo = B;
      if (tp === 'zyl') { xi = cx - B / 2 - 8; wi = B + 16; }
      half += ring(xi, rb, wi, t) + ring(xo, rb + Hr - t, wo, t);
      if (tp === 'zyl') { half += ring(xo, rb + Hr - t - t * 0.7, 6, t * 0.7) + ring(xo + wo - 6, rb + Hr - t - t * 0.7, 6, t * 0.7); half += `<rect x="${q(cx - B * 0.32)}" y="${q(rb + t)}" width="${q(B * 0.64)}" height="${q(e)}" rx="2" fill="${K}" fill-opacity=".4" stroke="${K}" stroke-width="2"/>`; }
      else if (tp === 'kegel') { half += `<polygon transform="rotate(-14 ${q(cx)} ${q(ym)})" points="${q(cx - B * 0.34)},${q(ym - e * 0.42)} ${q(cx + B * 0.34)},${q(ym - e * 0.5)} ${q(cx + B * 0.34)},${q(ym + e * 0.5)} ${q(cx - B * 0.34)},${q(ym + e * 0.42)}" fill="${K}" fill-opacity=".4" stroke="${K}" stroke-width="2"/>`; }
      else if (tp === 'pendel') { [-1, 1].forEach(sg => { half += `<ellipse transform="rotate(${-9 * sg} ${q(cx + sg * B * 0.2)} ${q(ym)})" cx="${q(cx + sg * B * 0.2)}" cy="${q(ym)}" rx="${q(B * 0.2)}" ry="${q(e / 2)}" fill="${K}" fill-opacity=".4" stroke="${K}" stroke-width="2"/>`; }); }
      else { half += ball(cx, ym); if (tp === 'schraeg') half += `<path transform="rotate(-24 ${q(cx)} ${q(ym)})" d="M${q(cx)} ${q(ym - e * 0.9)}V${q(ym + e * 0.9)}" stroke="var(--fg)" stroke-dasharray="4 3" stroke-width="1.5"/>`; }
      const sl = pb.suffix.some(s => /^2?(RS|Z)/.test(s[0]) || s[0] === 'RS' || s[0] === 'Z');
      if (sl && (tp === 'rill' || tp === 'schraeg')) half += `<rect x="${q(cx - B / 2 + 1)}" y="${q(rb + t)}" width="3" height="${q(e)}" fill="var(--mute)"/><rect x="${q(cx + B / 2 - 4)}" y="${q(rb + t)}" width="3" height="${q(e)}" fill="var(--mute)"/>`;
    }
    let body = defs + `<rect x="14" y="${cy - rb}" width="${W - 28}" height="${2 * rb}" fill="var(--panel)" fill-opacity=".6" stroke="var(--mute)" stroke-width="1" stroke-dasharray="2 3"/>`;
    body += `<g transform="translate(0 ${cy})">${half}</g><g transform="translate(0 ${cy}) scale(1 -1)">${half}</g>`;
    body += `<path d="M10 ${cy}H${W - 10}" stroke="var(--fg)" stroke-width="1.2" stroke-dasharray="14 3 2 3" stroke-opacity=".8"/>`;
    /* Maßpfeil Bohrung */
    const dx = 44;
    body += `<path d="M${dx} ${cy - rb}V${cy + rb}M${dx - 5} ${cy - rb + 7}L${dx} ${cy - rb}L${dx + 5} ${cy - rb + 7}M${dx - 5} ${cy + rb - 7}L${dx} ${cy + rb}L${dx + 5} ${cy + rb - 7}" fill="none" stroke="var(--accent)" stroke-width="2"/>` + T(dx + 8, cy - 8, 'd = ' + pb.d + ' mm', { a: 'start', s: 14, c: 'accent', w: 1, halo: 1 });
    const lx = cx + (tp === 'axial' ? e / 2 + t * 1.1 : B / 2) + 14;
    body += T(lx, cy - rb - t / 2 + 4, 'Innenring', { a: 'start', s: 13, c: 'mute' }) + T(lx, cy - Ro + t / 2 + 4, 'Außenring', { a: 'start', s: 13, c: 'mute' }) + T(lx, cy - ym + 4, tp === 'zyl' || tp === 'kegel' || tp === 'pendel' ? 'Rollen' : 'Kugel', { a: 'start', s: 13, c: 'hi' });
    body += T(W / 2, H - 22, 'Schema nach dem Kurzzeichen: Nur die Bohrung folgt der Zahl,', { s: 11.5, c: 'mute' }) + T(W / 2, H - 8, 'die Außenmaße sind nicht maßstäblich.', { s: 11.5, c: 'mute' });
    return svg(W, H, pb.name + ', Bohrung ' + pb.d + ' Millimeter, im Schnitt', body);
  }

  /* ============================================================ 4) Federn */
  function coil(x1, x2, y, n, amp) {
    const lead = Math.min(14, (x2 - x1) * 0.15), seg = (x2 - x1 - 2 * lead) / (2 * n); let d = `M${q(x1)} ${q(y)}H${q(x1 + lead)}`;
    for (let k = 0; k < 2 * n; k++) d += `L${q(x1 + lead + (k + 0.5) * seg)} ${q(y + (k % 2 ? amp : -amp))}`;
    return d + `L${q(x2 - lead)} ${q(y)}H${q(x2)}`;
  }
  const cLab = (c, k) => 'c' + SUB[k + 1] + ' = ' + f(c, 2) + ' N/mm';
  /* mode: 'einzel' | 'reihe' | 'par'; cs: Federraten */
  function springCircuit(mode, cs) {
    cs = (cs || []).filter(c => fin(c) && c > 0); const W = 480;
    if (!cs.length) return msg('Bitte Federraten größer 0 eingeben.');
    if (mode === 'par') {
      const n = Math.min(3, cs.length), H = 40 + n * 46; let b = `<rect x="22" y="14" width="8" height="${H - 28}" fill="var(--mute)"/><rect x="${W - 90}" y="14" width="8" height="${H - 28}" fill="var(--hi)" fill-opacity=".5" stroke="var(--hi)"/>`;
      for (let k = 0; k < n; k++) { const y = 34 + k * 46; b += `<path d="${coil(30, W - 90, y, 9, 8)}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>` + T(W / 2 - 30, y - 12, cLab(cs[k], k), { s: 13, c: 'mute' }); }
      b += `<path d="M${W - 82} ${H / 2}H${W - 30}M${W - 40} ${H / 2 - 6}L${W - 30} ${H / 2}L${W - 40} ${H / 2 + 6}" stroke="var(--fg)" stroke-width="2.4" fill="none"/>` + T(W - 40, H / 2 - 12, 'F', { s: 15, w: 1 });
      return svg(W, H, 'Parallelschaltung von ' + n + ' Federn zwischen Wand und Lastplatte', b);
    }
    const n = mode === 'reihe' ? Math.min(3, cs.length) : 1, H = 100, x0 = 30, x1 = W - 110, w = (x1 - x0) / n; let b = `<rect x="22" y="22" width="8" height="56" fill="var(--mute)"/><rect x="${x1}" y="26" width="46" height="48" rx="4" fill="var(--hi)" fill-opacity=".4" stroke="var(--hi)" stroke-width="2"/>`;
    for (let k = 0; k < n; k++) b += `<path d="${coil(x0 + k * w, x0 + (k + 1) * w, 50, Math.max(4, Math.round(9 / n)), 9)}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>` + T(x0 + (k + 0.5) * w, 20, n === 1 ? 'c = ' + f(cs[0], 2) + ' N/mm' : cLab(cs[k], k), { s: 12.5, c: 'mute' });
    b += `<path d="M${x1 + 48} 50H${W - 14}M${W - 24} 44L${W - 14} 50L${W - 24} 56" stroke="var(--fg)" stroke-width="2.4" fill="none"/>` + T(W - 28, 36, 'F', { s: 15, w: 1 });
    return svg(W, H, mode === 'reihe' ? 'Reihenschaltung von ' + n + ' Federn hintereinander' : 'Einzelne Feder an einer Wand', b);
  }
  function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  /* lines: [{ c, label, col, w }]; pt: { s, F } Arbeitspunkt (optional) */
  function springChart(lines, pt) {
    lines = (lines || []).filter(l => l && fin(l.c) && l.c > 0); if (!lines.length) return msg('Keine Kennlinie ohne gültige Federrate.');
    const W = 480, H = 270, L = 52, Rr = 14, Tp = 18, Bm = 42, pw = W - L - Rr, ph = H - Tp - Bm;
    const cmax = Math.max.apply(null, lines.map(l => l.c)), cmin = Math.min.apply(null, lines.map(l => l.c));
    let xmax = niceMax(pt && pt.s > 0 ? pt.s * 1.4 : 10), ymax = niceMax(Math.max(pt && pt.F > 0 ? pt.F * 1.3 : 0, cmin * xmax * 1.1));
    if (cmax * xmax < ymax * 0.2) ymax = niceMax(cmax * xmax * 1.1);
    const X = v => L + v / xmax * pw, Y = v => Tp + ph - v / ymax * ph;
    let b = `<rect x="${L}" y="${Tp}" width="${pw}" height="${ph}" fill="var(--bg)" stroke="var(--line)"/>`;
    for (let k = 0; k <= 4; k++) { const xv = xmax * k / 4, yv = ymax * k / 4; b += `<path d="M${q(X(xv))} ${Tp}V${Tp + ph}M${L} ${q(Y(yv))}H${L + pw}" stroke="var(--line)" stroke-width="1"/>` + T(X(xv), H - Bm + 16, f(xv, xv < 10 ? 1 : 0), { s: 12, c: 'mute' }) + T(L - 6, Y(yv) + 4, f(yv, yv < 10 ? 1 : 0), { a: 'end', s: 12, c: 'mute' }); }
    b += T(L + pw / 2, H - 6, 'Federweg s in mm', { s: 12.5, c: 'mute' }) + `<text transform="translate(14 ${Tp + ph / 2}) rotate(-90)" font-size="12.5" text-anchor="middle" fill="var(--mute)">Federkraft F in N</text>`;
    lines.forEach((l, k) => {
      const sEnd = Math.min(xmax, ymax / l.c), col = l.col || COLS[k % 4];
      b += `<path d="M${q(X(0))} ${q(Y(0))}L${q(X(sEnd))} ${q(Y(sEnd * l.c))}" stroke="var(--${col})" stroke-width="${l.w || 2.4}" fill="none" stroke-linecap="round"/>`;
      if (l.label) b += T(Math.min(L + pw - 4, X(sEnd) - 4), Math.max(Tp + 12, Y(sEnd * l.c) - 6), l.label, { a: 'end', s: 12, c: col, w: 1, halo: 1 });
    });
    if (pt && pt.s >= 0 && pt.F >= 0 && pt.s <= xmax && pt.F <= ymax) b += `<path d="M${q(X(pt.s))} ${q(Y(0))}V${q(Y(pt.F))}H${L}" stroke="var(--fg)" stroke-dasharray="4 3" fill="none"/><circle cx="${q(X(pt.s))}" cy="${q(Y(pt.F))}" r="5" fill="var(--fg)"/>`;
    return svg(W, H, 'Federkennlinie: Kraft über Federweg, Gerade durch den Nullpunkt, Steigung ist die Federrate', b);
  }

  /* ============================================================ 5) Lagerung fest/los und Gleitlager */
  /* mode: 'festlos' | 'angestellt' | 'schwimmend'; dL: Wärmedehnung in mm (nur Anzeige, Verschiebung übertrieben dargestellt) */
  function lagerung(mode, dL) {
    mode = ['festlos', 'angestellt', 'schwimmend'].indexOf(mode) >= 0 ? mode : 'festlos'; const W = 480, H = 236, cy = 108, xl = 120, xr = 360, k = fin(dL) ? Math.max(0, Math.min(26, dL * 40)) : 0;
    let b = `<rect x="14" y="40" width="${W - 28}" height="${H - 80}" rx="6" fill="var(--panel)" fill-opacity=".5" stroke="var(--mute)" stroke-width="1.5"/>`;
    b += T(W / 2, 32, 'Gehäuse', { s: 12, c: 'mute' }) + `<rect x="6" y="${cy - 8}" width="${W - 40 + (mode === 'festlos' ? k : 0)}" height="16" fill="var(--accent)" fill-opacity=".3" stroke="var(--accent)" stroke-width="2"/>`;
    const brg = (x, dx, tilt) => { const sh = dx || 0; let s = `<rect x="${x - 15}" y="${cy - 44}" width="30" height="16" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/><rect x="${x - 15}" y="${cy + 28}" width="30" height="16" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/>`;
      s += `<rect x="${x - 15 + sh}" y="${cy - 28}" width="30" height="14" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/><rect x="${x - 15 + sh}" y="${cy + 14}" width="30" height="14" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/>`;
      s += tilt ? `<path d="M${x - 8 + sh} ${cy - 14}L${x + 8 + sh} ${cy - 28}M${x - 8 + sh} ${cy + 14}L${x + 8 + sh} ${cy + 28}" stroke="var(--hi)" stroke-width="5" stroke-linecap="round"/>` : `<circle cx="${x + sh}" cy="${cy - 21}" r="6" fill="var(--hi)" fill-opacity=".5" stroke="var(--hi)" stroke-width="2"/><circle cx="${x + sh}" cy="${cy + 21}" r="6" fill="var(--hi)" fill-opacity=".5" stroke="var(--hi)" stroke-width="2"/>`;
      return s; };
    const stop = (x, w, c) => `<rect x="${x}" y="${cy - 62}" width="${w}" height="18" fill="var(--${c})" fill-opacity=".7"/><rect x="${x}" y="${cy + 44}" width="${w}" height="18" fill="var(--${c})" fill-opacity=".7"/>`;
    const collar = (x, w) => `<rect x="${x}" y="${cy - 28}" width="${w}" height="20" fill="var(--ok)" fill-opacity=".6"/><rect x="${x}" y="${cy + 8}" width="${w}" height="20" fill="var(--ok)" fill-opacity=".6"/>`;
    let cap = '';
    if (mode === 'festlos') {
      b += brg(xl, 0, false) + stop(xl - 24, 8, 'danger') + stop(xl + 16, 8, 'danger') + collar(xl - 24, 8) + collar(xl + 16, 8) + brg(xr, k, false) + collar(xr + k - 24, 8) + collar(xr + k + 16, 8);
      b += T(xl, H - 50, 'Festlager', { s: 14, c: 'danger', w: 1 }) + T(xr, H - 50, 'Loslager', { s: 14, c: 'ok', w: 1 });
      b += T(xr, cy - 50, fin(dL) ? 'Dehnung ' + f(dL, 2) + ' mm (Bild übertrieben)' : '', { s: 12, c: 'ok' });
      cap = ['Festlager: Anschläge beidseitig (rot Gehäuse, grün Welle).', 'Loslager: lässt die Längenänderung der Welle zu.'];
    } else if (mode === 'angestellt') {
      b += brg(xl, 0, true) + brg(xr, 0, true) + stop(xl - 24, 8, 'danger') + stop(xr + 16, 8, 'danger') + collar(xl + 16, 8) + collar(xr - 24, 8);
      b += T(xl, H - 50, 'Kegelrollenlager', { s: 14, c: 'hi', w: 1 }) + T(xr, H - 50, 'Kegelrollenlager', { s: 14, c: 'hi', w: 1 });
      cap = ['Zwei Lager nehmen die Axialkraft jeweils in einer Richtung auf.', 'Das Spiel wird beim Einbau eingestellt (angestellt).'];
    } else {
      b += brg(xl, 0, false) + brg(xr, 0, false) + stop(xl - 33, 8, 'mute') + stop(xl + 25, 8, 'mute') + stop(xr - 33, 8, 'mute') + stop(xr + 25, 8, 'mute');
      b += T(xl, H - 50, 'Lager 1', { s: 14, c: 'hi', w: 1 }) + T(xr, H - 50, 'Lager 2', { s: 14, c: 'hi', w: 1 });
      cap = ['Beide Lager haben axial Spiel (graue Anschläge mit Abstand):', 'Die Welle ist nicht selbst axial festgelegt.'];
    }
    b += T(W / 2, H - 24, cap[0], { s: 11.5, c: 'mute' }) + T(W / 2, H - 9, cap[1], { s: 11.5, c: 'mute' });
    return svg(W, H, 'Wellenlagerung: ' + (mode === 'festlos' ? 'Fest-Los-Lagerung' : mode === 'angestellt' ? 'angestellte Lagerung' : 'schwimmende Lagerung'), b);
  }
  /* PRUEFEN P23: Die Stribeck-Kurve (Reibung über der Gleitgeschwindigkeit mit den Zonen Festkörper-, Misch- und Flüssigkeitsreibung) ist nur qualitativ und ohne Zahlenwerte dargestellt. Stimmen Verlauf und Benennung mit dem Lehrmaterial überein? */
  /* Reibungszustände im Gleitlager (qualitativ, ohne Zahlenwerte); x: 0..1 Position der Marke */
  function stribeck(x) {
    const W = 480, H = 230, L = 40, Rr = 14, Tp = 18, Bm = 44, pw = W - L - Rr, ph = H - Tp - Bm, mu = u => 0.04 + 0.9 * Math.exp(-7 * u) + 0.25 * u;
    x = fin(x) ? Math.max(0, Math.min(1, x)) : 0; const X = u => L + u * pw, Y = m => Tp + ph - (m / 1.05) * ph;
    let pts = ''; for (let k = 0; k <= 60; k++) { const u = k / 60; pts += (k ? 'L' : 'M') + q(X(u)) + ' ' + q(Y(mu(u))); }
    let b = `<rect x="${L}" y="${Tp}" width="${pw}" height="${ph}" fill="var(--bg)" stroke="var(--line)"/><rect x="${L}" y="${Tp}" width="${q(0.2 * pw)}" height="${ph}" fill="var(--danger)" fill-opacity=".14"/><rect x="${q(L + 0.2 * pw)}" y="${Tp}" width="${q(0.15 * pw)}" height="${ph}" fill="var(--warn)" fill-opacity=".16"/><rect x="${q(L + 0.35 * pw)}" y="${Tp}" width="${q(0.65 * pw)}" height="${ph}" fill="var(--ok)" fill-opacity=".14"/>`;
    b += `<path d="${pts}" fill="none" stroke="var(--accent)" stroke-width="3"/>`;
    b += T(X(0.1), Tp + 16, 'Festkörper-', { s: 12, c: 'danger' }) + T(X(0.1), Tp + 30, 'reibung', { s: 12, c: 'danger' }) + T(X(0.275), Tp + 16, 'Misch-', { s: 12, c: 'warn' }) + T(X(0.275), Tp + 30, 'reibung', { s: 12, c: 'warn' }) + T(X(0.675), Tp + 16, 'Flüssigkeitsreibung (Schmierfilm trägt)', { s: 12, c: 'ok' });
    b += T(L + pw / 2, H - 8, 'Gleitgeschwindigkeit (Anlauf bis Betrieb) →', { s: 12.5, c: 'mute' }) + `<text transform="translate(13 ${Tp + ph / 2}) rotate(-90)" font-size="12.5" text-anchor="middle" fill="var(--mute)">Reibung (qualitativ)</text>`;
    b += `<path d="M${q(X(x))} ${Tp}V${Tp + ph}" stroke="var(--fg)" stroke-dasharray="4 3"/><circle cx="${q(X(x))}" cy="${q(Y(mu(x)))}" r="6" fill="var(--fg)"/>`;
    return svg(W, H, 'Reibungszustände im Gleitlager: Festkörperreibung, Mischreibung, Flüssigkeitsreibung über der Geschwindigkeit', b);
  }

  /* ============================================================ 6) Dichtungen im Schnitt */
  function sealSketch(kind) {
    const W = 480, H = 240;
    if (kind === 'oring') {
      let b = `<rect x="40" y="30" width="400" height="70" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/><rect x="40" y="140" width="400" height="70" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/>`;
      b += `<rect x="200" y="100" width="64" height="26" fill="var(--bg)" stroke="var(--fg)" stroke-width="1.5"/><path d="M40 100H200M264 100H440" stroke="var(--fg)" stroke-width="1.5"/>`;
      b += `<ellipse cx="238" cy="113" rx="19" ry="13" fill="var(--hi)" fill-opacity=".45" stroke="var(--hi)" stroke-width="2.4"/><rect x="200" y="100" width="64" height="40" fill="none"/>`;
      b += `<path d="M90 125H180M170 118L180 125L170 132" stroke="var(--danger)" stroke-width="3" fill="none"/>` + T(110, 112, 'Druck', { s: 13, c: 'danger', w: 1 });
      b += T(238, 160, 'O-Ring', { s: 13, c: 'hi', w: 1 }) + T(238, 178, 'in der Nut, leicht verpresst', { s: 12, c: 'mute' }) + T(380, 120, 'schmaler Spalt', { s: 12, c: 'mute' }) + T(238, 75, 'Nut', { s: 13, c: 'mute' }) + T(W / 2, H - 6, 'Der Ring füllt die Nut nicht ganz: Er braucht Platz zum Verformen. Der Druck presst ihn gegen die Dichtfläche.', { s: 11, c: 'mute' });
      return svg(W, H, 'O-Ring in der Nut, Druck von links', b);
    }
    let b = `<rect x="20" y="30" width="440" height="50" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.5"/><rect x="20" y="170" width="440" height="40" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/>`;
    b += `<rect x="20" y="80" width="170" height="90" fill="var(--hi)" fill-opacity=".10"/>` + T(105, 128, 'Öl / Fett', { s: 14, c: 'hi', w: 1 }) + T(105, 146, '(abzudichtende Seite)', { s: 12, c: 'hi' }) + T(380, 128, 'Außenseite', { s: 13, c: 'mute' }) + T(380, 146, '(Luft, Schmutz)', { s: 12, c: 'mute' });
    b += `<rect x="210" y="80" width="60" height="22" fill="var(--fg)" fill-opacity=".35" stroke="var(--fg)" stroke-width="1.5"/>`;
    b += `<path d="M215 102L215 128L204 168L222 168L238 128L238 102Z" fill="var(--ok)" fill-opacity=".5" stroke="var(--ok)" stroke-width="2"/><circle cx="214" cy="144" r="6" fill="none" stroke="var(--fg)" stroke-width="2"/>`;
    b += `<path d="M262 102L262 134L274 168L262 168L252 134L252 102Z" fill="var(--warn)" fill-opacity=".5" stroke="var(--warn)" stroke-width="2"/>`;
    b += T(200, 188, 'Dichtlippe', { s: 12, c: 'ok', w: 1, a: 'end' }) + T(160, 62, 'Gehäuse', { s: 13, c: 'mute' }) + T(240, 200, 'Welle', { s: 13, c: 'accent', w: 1 }) + T(300, 70, 'Metallgehäuse des Dichtrings', { s: 12, c: 'mute', a: 'start' }) + T(285, 160, 'Staublippe', { s: 12, c: 'warn', w: 1, a: 'start' }) + T(160, 160, 'Feder', { s: 12, c: 'fg', a: 'end' });
    b += T(W / 2, H - 6, 'Die Dichtlippe zeigt zur abzudichtenden Seite, die Feder drückt sie an die Welle, die Staublippe hält Schmutz fern.', { s: 11, c: 'mute' });
    return svg(W, H, 'Radial-Wellendichtring im Schnitt', b);
  }

  /* ============================================================ Bewegung */
  let on = false, raf = 0;
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  function frame() {
    raf = 0; if (!on || typeof document === 'undefined') return;
    const els = document.querySelectorAll('.mv-rot,.mv-dash'); if (!els.length) return;
    const t = (root.performance && root.performance.now ? root.performance.now() : Date.now()) / 1000;
    els.forEach(el => {
      const s = el.ownerSVGElement, spd = s ? +s.getAttribute('data-spd') || 0 : 0;
      if (el.classList.contains('mv-rot')) el.setAttribute('transform', 'rotate(' + (((+el.getAttribute('data-ph') || 0) + (+el.getAttribute('data-r') || 0) * spd * t) % 360).toFixed(2) + ')');
      else { const per = +el.getAttribute('data-per') || 10, v = +el.getAttribute('data-v') || 10; el.setAttribute('stroke-dashoffset', (-(spd * Math.PI / 180 * v * t) % per).toFixed(2)); }
    });
    raf = root.requestAnimationFrame(frame);
  }
  function scan() { if (on && !raf && root.requestAnimationFrame && typeof document !== 'undefined') raf = root.requestAnimationFrame(frame); }
  function motion(flag) { on = !!flag && !reduced(); if (on) scan(); else if (raf && root.cancelAnimationFrame) { root.cancelAnimationFrame(raf); raf = 0; } return on; }

  const API = { toothPath, arcArrow, trainLayout, gearTrain, beltDrive, bearingSection, coil, springCircuit, springChart, niceMax, lagerung, stribeck, sealSketch, motion, scan, reduced, COLS };
  root.MAS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
