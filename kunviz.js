'use strict';
/* Tonfunk Kunststoff-Lab: Bilder und Animationen (Lab-Kennung 'kun'). Datei wird in kunlab.html VOR kunui.js geladen.
   Reine Zeichenfunktionen: liefern SVG-Text ohne DOM (testbar mit node quelle/kun/test_kunviz.js), '' bei ungültigen Werten.
     groupsSvg   Ketten von Thermoplast, Duroplast, Elastomer          strukSvg   amorph gegen teilkristallin
     cycleSvg    Spritzgießzyklus in 6 Schritten (Klasse ph-0 bis ph-5 an der SVG; die Bewegung macht das CSS in kunlab.html)
     barSvg      Zeitanteile der 6 Schritte als Balken                 formSvg    Querschnitt eines Gehäusedeckels mit Rippe, live nach den Reglern
     domSvg      Schraubdom im Schnitt                                 shrinkSvg  Schwindung: Formnest und Teil übereinander (überzeichnet)
     snapSvg     Schnapphaken beim Fügen (SVG-Animation nur mit o.anim) costSvg    Kostengeraden Spritzgießen gegen 3D-Druck mit Gleichstand
     img(spec)   Bild für die Aufgabenansicht (spec kommt aus kundata.js als q.img)
   Farben nur über CSS-Klassen der Seite (Variablen für Hell und Dunkel). Bewegung nur bei prefers-reduced-motion: no-preference (CSS)
   bzw. wenn die Oberfläche o.anim setzt. Alle Zahlen sind Übungswerte; Schrägen und Schwindung sind zur Deutlichkeit überzeichnet. */
(function (root) {
  const C = root.KUN_CORE || (typeof require === 'function' ? require('./kuncore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const P = (d, cls, extra) => `<path class="${cls || ''}" d="${d}"${extra || ''}/>`;
  const svg = (W, H, label, body, cls) => `<svg class="kv${cls ? ' ' + cls : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const pl = pts => pts.map((p, i) => (i ? 'L' : 'M') + q(p[0]) + ' ' + q(p[1])).join(' ');
  function arrow(x1, y1, x2, y2, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 8, p1 = [x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)], p2 = [x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)];
    return `<g class="ar ${cls || ''}"><line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/><polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}"/></g>`;
  }
  /* geschlossener Linienzug mit gerundeten Ecken: pts = [[x, y, radius], ...] */
  function rounded(pts) {
    const n = pts.length; let d = '';
    pts.forEach((p, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], r = p[2] || 0;
      if (r <= 0.2) { d += (i ? ' L' : 'M') + q(p[0]) + ' ' + q(p[1]); return; }
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), rr = Math.min(r, la / 2, lb / 2);
      const A = [p[0] + (a[0] - p[0]) / la * rr, p[1] + (a[1] - p[1]) / la * rr], B = [p[0] + (b[0] - p[0]) / lb * rr, p[1] + (b[1] - p[1]) / lb * rr];
      d += (i ? ' L' : 'M') + q(A[0]) + ' ' + q(A[1]) + ' Q' + q(p[0]) + ' ' + q(p[1]) + ' ' + q(B[0]) + ' ' + q(B[1]);
    });
    return d + ' Z';
  }

  /* ============================================================ Ketten: Kunststoffgruppen und Aufbau */
  const wave = (x0, x1, y, amp, ph, k) => { const pts = []; for (let x = x0; x <= x1 + 0.1; x += 6) pts.push([x, y + amp * Math.sin(x * (k || 0.16) + ph)]); return pl(pts); };
  /* o.names = false: ohne Gruppennamen (Aufgabenbild, verrät die Antwort nicht) */
  function groupsSvg(o) {
    o = o || {}; const W = 420, H = 180, kinds = [['Thermoplast', 'nicht vernetzt', 0], ['Duroplast', 'eng vernetzt', 9], ['Elastomer', 'weit vernetzt', 3]];
    let s = '';
    kinds.forEach((k, i) => {
      const x0 = 10 + i * 138, w = 126;
      s += R(x0, 22, w, 104, 'box', 8);
      for (let j = 0; j < 5; j++) s += P(wave(x0 + 8, x0 + w - 8, 38 + j * 18, 4, j * 1.3 + i, 0.14 + j * 0.01), 'chain');
      for (let c = 0; c < k[2]; c++) { const cx = x0 + 16 + ((c * 37 + i * 11) % (w - 32)), j = c % 4, y1 = 38 + j * 18; s += L(cx, y1 + 2, cx, y1 + 16, 'xl') + `<circle class="xd" cx="${q(cx)}" cy="${q(y1 + 9)}" r="2.4"/>`; }
      if (o.names !== false) s += T(x0 + w / 2, 16, k[0], 'b mid');
      s += T(x0 + w / 2, 144, k[1], 'm mid');
    });
    s += T(W / 2, 170, 'rot: Vernetzungsstellen zwischen den Ketten', 's m mid');
    return svg(W, H, 'Molekülketten: nicht vernetzt, eng vernetzt und weit vernetzt', s);
  }
  function strukSvg(o) {
    o = o || {}; const W = 420, H = o.names === false ? 156 : 180; let s = '';
    s += R(10, 22, 190, 104, 'box', 8) + R(220, 22, 190, 104, 'box', 8);
    for (let j = 0; j < 6; j++) s += P(wave(18, 192, 34 + j * 16, 6, j * 2.1, 0.09 + j * 0.025), 'chain');
    for (let j = 0; j < 6; j++) s += P(wave(228, 402, 34 + j * 16, 6, j * 1.7, 0.1 + j * 0.02), 'chain');
    s += R(282, 40, 70, 70, 'cryst', 4);
    for (let j = 0; j < 6; j++) s += L(288, 48 + j * 11, 346, 48 + j * 11, 'chain cr');
    s += T(105, 16, o.names === false ? 'Aufbau 1' : 'amorph', 'b mid') + T(315, 16, o.names === false ? 'Aufbau 2' : 'teilkristallin', 'b mid');
    s += T(105, 144, 'ungeordnet wie Watte', 'm mid') + T(315, 144, 'teils dicht geordnet (Kasten)', 'm mid');
    if (o.names !== false) s += T(W / 2, 170, 'Geordnete Bereiche streuen Licht und schwinden stärker.', 's m mid');
    return svg(W, H, 'Amorpher und teilkristalliner Aufbau eines Thermoplasts', s);
  }

  /* ============================================================ Spritzgießzyklus */
  /* ph: 0 bis 5 (Schließen bis Auswerfen). Die Grafik enthält alle Teile; die Klasse ph-N an der SVG legt fest, was zu sehen ist und wo es steht.
     Bewegung (Werkzeug fährt, Schmelze füllt vom Anguss aus, Farbe kühlt ab, Auswerfer stößt das Teil aus) kommt aus den CSS-Übergängen in kunlab.html.
     o.labels = false: ohne Schrittleiste unten (Aufgabenbild). */
  function cycleSvg(ph, o) {
    o = o || {}; if (!(Number.isInteger(ph) && ph >= 0 && ph <= 5)) return '';
    const W = 420, H = o.labels === false ? 190 : 258; let s = '';
    /* Spritzeinheit: Zylinder, Trichter, Schnecke */
    s += P('M34 46 h30 l-9 26 h-12 Z', 'hop') + T(49, 40, 'Granulat', 's m mid');
    s += R(10, 76, 106, 34, 'barrel', 4) + `<g class="scr">${R(14, 86, 80, 14, 'screw', 3)}${[22, 34, 46, 58, 70, 82].map(x => L(x, 86, x + 6, 100, 'flight')).join('')}</g>`;
    s += P('M116 82 L130 89 L130 97 L116 104 Z', 'barrel') + T(60, 128, 'Schnecke', 's m mid');
    s += `<g class="pr">${arrow(96, 70, 118, 70, 'arh')}${T(96, 64, 'Nachdruck', 's hi')}</g>`;
    /* feste Werkzeughälfte mit Formnest (Tasche) und Angusskanal */
    s += R(130, 26, 88, 138, 'mold', 3) + R(172, 56, 46, 78, 'cav') + R(130, 90, 42, 8, 'cav');
    [[150, 44], [150, 146], [198, 44], [198, 146]].forEach(c => { s += `<circle class="cw" cx="${c[0]}" cy="${c[1]}" r="5"/>`; });
    /* Schmelze: Anguss, Boden (wächst von der Mitte), Wände (wachsen nach rechts) */
    s += `<g class="prt">${R(130, 90, 42, 8, 'melt ms')}${R(172, 56, 8, 78, 'melt mw')}${R(180, 56, 38, 8, 'melt mf')}${R(180, 126, 38, 8, 'melt mf')}</g>`;
    /* bewegliche Hälfte mit Kern und Auswerfern */
    s += `<g class="mov">${R(218, 26, 66, 138, 'mold', 3)}${R(180, 64, 38, 62, 'core')}<g class="ej">${R(180, 76, 120, 5, 'pin')}${R(180, 109, 120, 5, 'pin')}${R(298, 70, 8, 50, 'pin')}</g>`;
    [[250, 44], [250, 146]].forEach(c => { s += `<circle class="cw" cx="${c[0]}" cy="${c[1]}" r="5"/>`; });
    s += '</g>';
    s += T(214, 18, 'feste Hälfte', 's m end') + `<g class="mov">${T(222, 18, 'bewegliche Hälfte', 's m')}</g>`;
    s += T(372, 60, 'Kern', 's m mid') + L(352, 64, 222, 95, 'lead');
    s += T(166, 182, 'blaue Punkte: Kühlkanäle', 's m mid');
    if (o.labels !== false) C.CYCLE.forEach((c, i) => { const x = 8 + (i % 3) * 137, y = 196 + Math.floor(i / 3) * 31; s += `<g class="stp st${i}">${R(x, y, 131, 26, 'chipr', 13)}${T(x + 65.5, y + 17, (i + 1) + ' ' + c.n, 's mid')}</g>`; });
    return svg(W, H, 'Spritzgießmaschine im Schnitt: Schnecke, Werkzeug mit Formnest, Kern und Auswerfern, Schritt ' + (ph + 1) + ' ' + C.CYCLE[ph].n, s, 'cyc ph-' + ph);
  }
  /* Zeitanteile: ph = {schl, einspr, nach, kuehl, oeffn, ausw} in s; act = Index des hervorgehobenen Schritts oder -1 */
  function barSvg(ph, act) {
    const tz = C.cycleTime(ph); if (!(tz > 0)) return '';
    const W = 420, H = 66, x0 = 8, w = 404; let s = '', x = x0;
    C.CYCLE.forEach((c, i) => {
      const bw = ph[c.k] / tz * w; s += R(x, 10, bw, 26, 'seg' + i + (i === act ? ' on' : ''));
      if (bw > 30) s += T(x + bw / 2, 28, f(ph[c.k], 1) + ' s', 's mid nt');
      x += bw;
    });
    s += T(x0, 54, 'Zykluszeit ' + f(tz, 1) + ' s, davon Kühlen ' + f(ph.kuehl / tz * 100, 0) + ' %', 's m');
    return svg(W, H, 'Balken der Zeitanteile im Spritzgießzyklus', s, 'bar');
  }

  /* ============================================================ Querschnitt Gehäusedeckel */
  /* p = {s, t, a, r} in mm und Grad. o.plain: ohne Prüfung und ohne Bewegung (Aufgabenbild), o.lab: eigene Beschriftung {s, t, a, r} */
  const KF = 4, EXA = 4;
  function formSvg(p, o) {
    o = o || {};
    if (!p || ![p.s, p.t, p.a, p.r].every(v => fin(v) && v >= 0) || !(p.s > 0) || !(p.t > 0)) return '';
    const chk = o.plain ? null : C.designCheck(p), has = k => !!(chk && chk.issues.some(x => x.k === k)), lvl = k => (chk && (chk.issues.find(x => x.k === k) || {}).lvl) || '';
    const W = 420, H = 276, Wp = 240, Hp = 144, x0 = 80, y0 = 48;
    const sp = Math.min(Math.max(p.s, 0.4), 8) * KF, tp = Math.min(Math.max(p.t, 0.3), 12) * KF, rp = Math.min(p.r, 10) * KF, rop = Math.min(p.r + p.s, 14) * KF;
    const ang = Math.min(p.a * EXA, 22) * Math.PI / 180, dx = Hp * Math.tan(ang), xc = x0 + Wp / 2;
    const OTL = [x0 + dx, y0], OTR = [x0 + Wp - dx, y0], OBL = [x0, y0 + Hp], OBR = [x0 + Wp, y0 + Hp];
    const ITL = [x0 + dx + sp, y0 + sp], ITR = [x0 + Wp - dx - sp, y0 + sp], IBL = [x0 + sp, y0 + Hp], IBR = [x0 + Wp - sp, y0 + Hp];
    const ry = y0 + sp + Math.max(20, Hp - sp - 30), hr = ry - (y0 + sp), tb = Math.max(3, tp - 2 * hr * Math.tan(ang));
    const dent = has('einfall') ? Math.min(11, 3 + (chk.ratio - 0.7) * p.s * KF * 1.4) : 0;
    /* Außenkontur oben mit Einfallstelle als Delle über der Rippe */
    const top = [];
    if (dent) for (let i = 0; i <= 8; i++) { const u = i / 8, x = xc - 2.2 * tp + u * 4.4 * tp; top.push([x, y0 + dent * (1 - Math.cos(u * 2 * Math.PI)) / 2, 0]); }
    const part = [[OBL[0], OBL[1], 0], [OTL[0], OTL[1], rop]].concat(top, [[OTR[0], OTR[1], rop], [OBR[0], OBR[1], 0], [IBR[0], IBR[1], 0], [ITR[0], ITR[1], rp],
      [xc + tp / 2, y0 + sp, 0], [xc + tb / 2, ry, 0], [xc - tb / 2, ry, 0], [xc - tp / 2, y0 + sp, 0], [ITL[0], ITL[1], rp], [IBL[0], IBL[1], 0]]);
    const core = [[x0 - 26, IBL[1] + 36, 0], [x0 - 26, IBL[1], 0], [IBL[0], IBL[1], 0], [ITL[0], ITL[1], rp], [xc - tp / 2, y0 + sp, 0], [xc - tb / 2, ry, 0], [xc + tb / 2, ry, 0], [xc + tp / 2, y0 + sp, 0], [ITR[0], ITR[1], rp], [IBR[0], IBR[1], 0], [x0 + Wp + 26, IBR[1], 0], [x0 + Wp + 26, IBR[1] + 36, 0]];
    const kl = has('klemmt'), ej = o.plain ? '' : kl ? ' ej-bad' : ' ej-ok';
    let s = '';
    s += P(rounded(core), 'core') + T(xc, IBL[1] + 22, 'Kern (Werkzeug)', 's m mid');
    s += `<g class="part${ej}">` + P(rounded(part), 'pa');
    if (!o.plain && has('einfall')) s += `<ellipse class="hot" cx="${q(xc)}" cy="${q(y0 + sp)}" rx="${q(tp * 0.8 + 3)}" ry="${q(sp * 0.7 + 3)}"/>`;
    if (kl) for (let i = 0; i < 5; i++) { const yy = y0 + sp + 14 + i * 17, fx = (yy - y0) / Hp; s += L(x0 + dx * (1 - fx) + sp - 1, yy, x0 + dx * (1 - fx) + sp + 6, yy + 6, 'scr2') + L(x0 + Wp - dx * (1 - fx) - sp + 1, yy, x0 + Wp - dx * (1 - fx) - sp - 6, yy + 6, 'scr2'); }
    s += '</g>';
    /* Markierungen */
    if (!o.plain) {
      const kc = lvl('kerb') || lvl('kerbl');
      if (kc) [ITL, ITR].forEach(c => { s += `<circle class="${kc === 'bad' ? 'mk-bad' : 'mk-warn'}" cx="${q(c[0])}" cy="${q(c[1])}" r="9"/>`; });
      if (kc) s += T(ITL[0] + 12, ITL[1] + 22, kc === 'bad' ? 'Kerbe' : 'Radius knapp', 's b ' + (kc === 'bad' ? 'bad' : 'warn'));
      if (dent) s += arrow(xc + 70, y0 - 22, xc + 2.2 * tp * 0.5, y0 + dent * 0.6, 'arbad') + T(xc + 74, y0 - 24, 'Einfallstelle', 's b bad');
      if (kl) s += T(x0 + Wp + 30, y0 + 74, 'klemmt', 's b bad'); else s += T(x0 + Wp + 30, y0 + 74, 'frei', 's b ok');
      if (has('dick')) s += T(x0 + 4, y0 + Hp + 54, 'Wand sehr dick: lange Kühlzeit', 's b warn');
      if (has('duenn')) s += T(x0 + 4, y0 + Hp + 54, 'Wand sehr dünn: füllt schlecht', 's b warn');
    }
    s += arrow(x0 + Wp + 22, y0 + Hp - 6, x0 + Wp + 22, y0 + 8, o.plain ? 'arm' : kl ? 'arbad' : 'arok') + T(x0 + Wp + 30, y0 + 52, 'Entformen', 's m');
    /* Beschriftung */
    const lab = Object.assign({ s: 's = ' + f(p.s, 1) + ' mm', t: 't = ' + f(p.t, 2) + ' mm', a: 'α = ' + f(p.a, 2) + '°', r: 'r = ' + f(p.r, 1) + ' mm' }, o.lab || {});
    s += T(x0 - 6, y0 + Hp / 2, lab.s, 's b end') + L(x0 - 2, y0 + Hp / 2 + 4, x0 + dx * 0.5 + sp / 2, y0 + Hp / 2 + 4, 'lead');
    s += T(xc, ry + 16, lab.t, 's b mid');
    if (lab.a) s += T(x0 + Wp + 20, y0 + Hp + 22, lab.a, 's b end');
    if (lab.r) s += T(ITL[0] + 14, ITL[1] + 38, lab.r, 's m');
    s += T(6, 16, 'Sichtseite (außen)', 's m') + T(6, H - 6, p.a > 0 ? 'Schräge ' + EXA + '-fach überzeichnet' : 'ohne Entformungsschräge', 's m');
    return svg(W, H, 'Querschnitt eines Gehäusedeckels mit Rippe auf dem Kern', s, 'form');
  }
  /* Schraubdom: d = Schraubendurchmesser in mm; o.lab ersetzt die Wandangabe */
  function domSvg(d, o) {
    o = o || {}; if (!(fin(d) && d > 0)) return '';
    const W = 380, H = 200, K = Math.min(14, 60 / d), D = C.domeOuter(d) * K, h0 = C.domeHole(d) * K, xc = 190; let s = '';
    s += R(40, 30, 300, 14, 'pa') + R(xc - D / 2, 44, D, 110, 'pa') + R(xc - h0 / 2, 52, h0, 102, 'holebg');
    s += P(`M${q(xc - D / 2)} 44 L${q(xc - D / 2 - 26)} 44 L${q(xc - D / 2)} 104 Z`, 'pa') + P(`M${q(xc + D / 2)} 44 L${q(xc + D / 2 + 26)} 44 L${q(xc + D / 2)} 104 Z`, 'pa');
    s += L(xc - D / 2, 172, xc + D / 2, 172, 'dim') + T(xc, 188, 'außen 2 · d = ' + f(C.domeOuter(d), 2) + ' mm', 's b mid');
    s += L(xc - h0 / 2, 162, xc + h0 / 2, 162, 'dim') + T(xc + D / 2 + 34, 140, 'Kernloch 0,8 · d', 's m');
    s += T(xc + D / 2 + 34, 120, o.lab || ('Wand ' + f(C.domeWall(d), 2) + ' mm'), 's b');
    s += T(60, 22, 'Schraube d = ' + f(d, 1) + ' mm', 's b') + T(320, 70, 'Rippe', 's m end');
    return svg(W, H, 'Schraubdom im Schnitt mit Außendurchmesser, Kernloch und Anbindungsrippen', s, 'dom');
  }

  /* ============================================================ Schwindung */
  /* p = {lw, s, smin, smax} (Werkzeugmaß in mm, Schwindung in %); o.plain ohne Bewegung, o.lab {lw, lf} eigene Beschriftung */
  const EXS = 8;
  function shrinkSvg(p, o) {
    o = o || {}; if (!p || !(p.lw > 0) || !(fin(p.s) && p.s >= 0 && p.s < 10)) return '';
    const smin = fin(p.smin) ? p.smin : p.s, smax = fin(p.smax) ? p.smax : p.s; if (!(smin >= 0 && smax >= smin && smax < 10)) return '';
    const W = 400, H = 200, x0 = 40, y0 = 46, wm = 300, hm = 96, k = 1 - p.s * EXS / 100, wf = wm * k, hf = hm * k;
    const lab = Object.assign({ lw: 'Werkzeugmaß ' + f(p.lw, 2) + ' mm', lf: 'Fertigmaß ' + f(C.partSize(p.lw, p.s), 2) + ' mm', s: f(p.s, 1) + ' %' }, o.lab || {});
    let s = '';
    s += R(x0, y0, wm, hm, 'nest', 6) + T(x0, y0 - 8, lab.lw + ' (Formnest)', 's b');
    s += `<rect class="pa${o.plain ? '' : ' shr'}" x="${x0}" y="${y0}" width="${q(wf)}" height="${q(hf)}" rx="6" style="--k0:${q(1 / k * 1000) / 1000}"/>`;
    s += T(x0 + 8, y0 + hf - 10, lab.lf + ' (Teil)', 's b');
    if (smax > smin) {
      const a = x0 + wm * (1 - smax * EXS / 100), b = x0 + wm * (1 - smin * EXS / 100);
      s += R(a, y0 + hm + 10, Math.max(2, b - a), 10, 'band', 3) + T(a, y0 + hm + 34, 'Streuung ' + f(smin, 1) + ' bis ' + f(smax, 1) + ' %', 's m');
    }
    if (p.s > 0) s += arrow(x0 + wm, y0 + hm / 2, x0 + wf + 2, y0 + hm / 2, 'arh') + T(x0 + wm + 4, y0 + hm / 2 - 8, lab.s, 's b hi');
    s += T(6, H - 6, 'Schwindung ' + EXS + '-fach überzeichnet', 's m');
    return svg(W, H, 'Schwindung: Formnest im Werkzeug und kleineres Teil nach dem Abkühlen', s, 'shrink');
  }

  /* ============================================================ Schnapphaken */
  /* p = {l, h, y, eps} in mm und % (eps = zulässige Dehnung, optional); o.anim: Fügen als SVG-Animation; o.plain ohne Urteil; o.lab {l, h, y} */
  function snapSvg(p, o) {
    o = o || {}; if (!p || !(p.l > 0) || !(p.h > 0) || !(fin(p.y) && p.y >= 0)) return '';
    const W = 320, H = 286, K = 120 / p.l, Lp = 120, hp = Math.min(26, Math.max(5, p.h * K)), yp = Math.min(30, Math.max(3, p.y * K)), nh = Math.min(22, Math.max(10, yp * 1.6));
    const ax = 104, yL = 86, yR = yL + 14, yb = yR + Lp, Ly = yb - nh - 12;
    const e = C.snapStrain(p.h, p.y, p.l), bad = !o.plain && fin(p.eps) && e > p.eps + 1e-9, cls = o.plain ? 'arm0' : bad ? 'arm-bad' : 'arm-ok';
    /* Haken als Umriss, delta = Ausbiegung nach links in px */
    const armD = delta => {
      const v = z => -delta * (z / Lp) * (z / Lp) * (3 - z / Lp) / 2, n = 8, lft = [], rgt = [];
      for (let i = 0; i <= n; i++) { const z = Lp * i / n, zr = (Lp - nh) * (n - i) / n; lft.push([ax + v(z), yR + z]); rgt.push([ax + hp + v(zr), yR + zr]); }
      const vb = v(Lp), nose = [[ax + vb, yb], [ax + hp + vb, yb], [ax + hp + yp + vb, yb - nh * 0.35], [ax + hp + yp + vb, yb - nh]];
      return pl(lft.concat(nose, rgt)) + ' Z';
    };
    const d0 = armD(0), d1 = armD(yp + 1);
    const ty1 = -(12 + nh), ty2 = -(12 + nh * 0.65), ty0 = ty1 - 24;
    let s = '';
    /* Gegenstück mit Kante (fest) */
    s += R(ax + hp + 1, Ly, 170, 12, 'base') + R(14, yb + 16, 292, 14, 'base') + R(ax + hp + 171 - 12, Ly, 12, yb + 30 - Ly, 'base');
    s += T(ax + hp + 90, Ly - 6, 'Gegenstück mit Kante', 's m mid');
    let arm = `<path class="${cls}" d="${d0}">`;
    if (o.anim) arm += `<animate attributeName="d" dur="3.4s" repeatCount="indefinite" keyTimes="0;0.3;0.55;0.8;0.86;1" values="${d0};${d0};${d1};${d1};${d0};${d0}"/>`;
    arm += '</path>';
    s += `<g class="lid">` + R(14, yL, 220, 14, 'pa') + arm + T(24, yL - 6, 'Deckel mit Haken', 's m');
    if (o.anim) s += `<animateTransform attributeName="transform" type="translate" dur="3.4s" repeatCount="indefinite" keyTimes="0;0.3;0.55;0.8;0.86;1" values="0 ${q(ty0)};0 ${q(ty1)};0 ${q(ty2)};0 -0.5;0 0;0 0"/>`;
    s += '</g>';
    if (!o.anim) s += `<g transform="translate(0 ${q(ty2)})">${P(d1, 'ghost')}</g>` + T(ax - 8, yb - 30, 'ausgefedert', 's m end');
    if (bad) s += `<circle class="mk-bad" cx="${q(ax + hp / 2)}" cy="${q(yR + 2)}" r="10"/>`;
    const lab = Object.assign({ l: 'l = ' + f(p.l, 1) + ' mm', h: 'h = ' + f(p.h, 2) + ' mm', y: 'y = ' + f(p.y, 2) + ' mm' }, o.lab || {});
    s += L(ax - 14, yR, ax - 14, yb, 'dim') + T(ax - 18, yR + Lp / 2, lab.l, 's b end');
    s += T(ax + hp + 6, yR + 26, lab.h, 's b');
    s += T(ax + hp + yp + 8, yb - 2, lab.y, 's b');
    if (!o.plain && fin(e)) s += T(10, H - 8, 'Dehnung am Fuß ' + f(e, 2) + ' %' + (fin(p.eps) ? (bad ? ', zulässig ' + f(p.eps, 1) + ' %: bricht' : ', zulässig ' + f(p.eps, 1) + ' %: hält') : ''), 's b ' + (bad ? 'bad' : 'ok'));
    return svg(W, H, 'Schnapphaken beim Fügen: Der Haken federt an der Kante aus und rastet ein', s, 'snap');
  }

  /* ============================================================ Kosten */
  /* p = {w, k, k3, n}: Werkzeug in €, Stückkosten Spritzguss, Stückkosten 3D-Druck, Menge; o.plain ohne Gleichstand-Angabe */
  function costSvg(p, o) {
    o = o || {}; if (!p || ![p.w, p.k, p.k3, p.n].every(v => fin(v) && v >= 0) || !(p.n > 0)) return '';
    const be = C.breakEven(p.w, p.k, p.k3), nmax = Math.max(p.n * 1.25, fin(be) ? be * 1.6 : 0, 10);
    const cmax = Math.max(C.totalCost(p.w, p.k, nmax), C.totalCost(0, p.k3, nmax), 1) * 1.08;
    const W = 420, H = 240, x0 = 64, x1 = 404, y0 = 16, y1 = 196, X = n => x0 + n / nmax * (x1 - x0), Y = c => y1 - c / cmax * (y1 - y0);
    let s = '';
    /* runde Teilstriche (1, 2, 2,5 oder 5 mal Zehnerpotenz) */
    const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }, dc = nice(cmax / 4.5), dn = nice(nmax / 4.5);
    for (let c = 0; c <= cmax + 1e-9; c += dc) s += L(x0, Y(c), x1, Y(c), 'grid') + T(x0 - 4, Y(c) + 4, f(c, 0) + ' €', 's m end');
    for (let n = 0; n <= nmax + 1e-9; n += dn) s += T(X(n), y1 + 16, f(n, 0), 's m mid');
    s += L(x0, y1, x1, y1, 'axis') + L(x0, y0, x0, y1, 'axis') + T(x1, y1 + 32, 'Stückzahl', 's m end');
    if (!o.plain && fin(be) && be < nmax) s += R(X(be), y0, x1 - X(be), y1 - y0, 'win');
    s += `<path class="lsg drw" pathLength="1" d="M${q(X(0))} ${q(Y(p.w))} L${q(X(nmax))} ${q(Y(C.totalCost(p.w, p.k, nmax)))}"/>`;
    s += `<path class="l3d drw" pathLength="1" d="M${q(X(0))} ${q(Y(0))} L${q(X(nmax))} ${q(Y(C.totalCost(0, p.k3, nmax)))}"/>`;
    s += L(X(p.n), y0, X(p.n), y1, 'nline') + T(X(p.n) + (X(p.n) > W * 0.7 ? -4 : 4), y0 + 30, f(p.n, 0) + ' Teile', 's b' + (X(p.n) > W * 0.7 ? ' end' : ''));
    if (!o.plain && fin(be) && be < nmax) s += `<circle class="bep" cx="${q(X(be))}" cy="${q(Y(C.totalCost(p.w, p.k, be)))}" r="6"/>` + L(X(be), Y(C.totalCost(p.w, p.k, be)), X(be), y1, 'nline2') + T(X(be) + (X(be) > W / 2 ? -8 : 8), Math.min(Y(C.totalCost(p.w, p.k, be)) + 20, y1 - 6), 'lohnt ab ' + f(C.breakEvenN(p.w, p.k, p.k3), 0) + ' Teilen', 's b ok' + (X(be) > W / 2 ? ' end' : ''));
    s += R(x0 + 8, y0 + 2, 12, 4, 'k-sg') + T(x0 + 24, y0 + 8, 'Spritzgießen', 's') + R(x0 + 112, y0 + 2, 12, 4, 'k-3d') + T(x0 + 128, y0 + 8, '3D-Druck', 's');
    return svg(W, H, 'Gesamtkosten über der Stückzahl: Spritzgießen mit Werkzeug gegen 3D-Druck', s, 'cost');
  }

  /* ============================================================ Aufgabenbild */
  /* spec = {k, p, o} aus kundata.js; liefert HTML mit Rahmen oder '' */
  function img(spec) {
    if (!spec || !spec.k) return '';
    const p = spec.p || {}, o = Object.assign({ plain: true }, spec.o || {});
    const m = { groups: () => groupsSvg({ names: false }), struk: () => strukSvg(o), cycle: () => cycleSvg(p.ph, { labels: false }), form: () => formSvg(p, o), dom: () => domSvg(p.d, o), shrink: () => shrinkSvg(p, o), snap: () => snapSvg(p, o), cost: () => costSvg(p, o) }[spec.k];
    const s = m ? m() : ''; return s ? `<div class="kvz tkimg">${s}</div>` : '';
  }

  root.KUN_VIZ = { groupsSvg, strukSvg, cycleSvg, barSvg, formSvg, domSvg, shrinkSvg, snapSvg, costSvg, img };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KUN_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
