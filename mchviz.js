'use strict';
/* Tonfunk Mechanik-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei mchviz.js, eingebunden VOR mchui.js.
   Reine Funktionen, die SVG-Text liefern (testbar mit Node, module.exports), plus attach() für Zeiger-Ereignisse (Maus, Finger, Stift).
   1) forceSvg   Kräfteparallelogramm und Kräfteeck mit ziehbaren Pfeilspitzen; zerlSvg  Kraft in x/y zerlegen (ziehbare Spitze)
   2) leverSvg   Hebel/Wippe mit verschiebbaren Gewichten, Momentenbalken und leichter Neigung
   3) beamSvg    Träger auf zwei Stützen mit Lasten (ziehbar), Auflagerkräften und Querkraft-/Momentenverlauf
   4) rodSvg + hookeSvg  Zugstab mit (stark übertriebener, gekennzeichneter) Verlängerung und Spannungs-Dehnungs-Gerade
   5) rampSvg    schiefe Ebene mit Kräftezerlegung und Reibkegel (Neigung per Ziehen der Spitze)
   6) pressSvg   Bolzen: Flächenpressung (projizierte Fläche), Abscheren (Scherflächen), Lochen
   7) bendSvg    Biegung: Querschnitt und Spannungsverlauf; centroidSvg Schwerpunkt; effSvg Wirkungsgrad-Kette
   8) taskFig    Skizzen für Aufgaben: zeigen NUR gegebene Größen (Lasten, Winkel), nie Auflagerkräfte, Momente oder Ergebnisse (Verdeckte-Fehler-Prinzip).
   Alle Zahlen sind ÜBUNGSWERTE. Farben nur über CSS-Variablen (Hell/Dunkel). Bewegung: nur die Neigung der Wippe (CSS-Übergang, bei prefers-reduced-motion aus).
   Ziehpunkte tragen data-h="Kennung"; eine große unsichtbare Trefferfläche (mind. 44 px bei 375 px Breite) liegt darüber. Kein Hover nötig. */
(function (root) {
  const C = root.MCH_CORE || (typeof require !== 'undefined' ? require('./mchcore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const n = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const cl = (v, a, b) => Math.max(a, Math.min(b, fin(v) ? v : a));
  const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const T = (x, y, t, cls, extra) => `<text class="g-lab ${cls || ''}" x="${n(x)}" y="${n(y)}"${extra || ''}>${esc(t)}</text>`;
  const Tm = (x, y, t, cls) => T(x, y, t, cls, ' text-anchor="middle"');
  const Te = (x, y, t, cls) => T(x, y, t, cls, ' text-anchor="end"');
  const msg = t => svg(480, 44, 'Hinweis', Tm(240, 26, t, 'm'));
  const line = (x1, y1, x2, y2, col, w, dash) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${col}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
  /* Pfeil von (x1,y1) nach (x2,y2) mit Spitze am Ende */
  function arrow(x1, y1, x2, y2, col, w, dash) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (!(L > 2)) return '';
    const ux = dx / L, uy = dy / L, hs = Math.min(11, L * 0.5), bx = x2 - ux * hs, by = y2 - uy * hs;
    return line(x1, y1, bx, by, col, w || 3, dash) + `<polygon points="${n(x2)},${n(y2)} ${n(bx - uy * hs * 0.45)},${n(by + ux * hs * 0.45)} ${n(bx + uy * hs * 0.45)},${n(by - ux * hs * 0.45)}" fill="${col}"/>`;
  }
  /* Ziehpunkt: sichtbarer Kreis + große, fast unsichtbare Trefferfläche */
  const handle = (id, x, y, col) => `<g data-h="${esc(id)}" class="vz-hd"><circle cx="${n(x)}" cy="${n(y)}" r="44" fill="var(--accent)" fill-opacity="0.001"/><circle cx="${n(x)}" cy="${n(y)}" r="9" fill="${col || 'var(--accent)'}" fill-opacity=".9" stroke="var(--bg)" stroke-width="2"/></g>`;
  const hatch = (id, col) => `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${col}" stroke-width="2" stroke-opacity=".55"/></pattern>`;

  /* ============================================================ 1) Kräfte */
  /* Maßstab: KSC Pixel je Newton bei Kräften bis 80 N (Zerlegen bis 160 N); größere Zahlen aus dem Eingabefeld verkleinern den Maßstab, damit alles im Bild bleibt. Ziehen begrenzt auf diese Bereiche. */
  const KSC = 1.3, KO = { x: 240, y: 210 }, KMAX = 80, ZMAX = 160;
  const pos = v => (fin(v) && v > 0 ? v : 0);
  const kp = (F, a, sc) => ({ x: KO.x + F * sc * Math.cos(a * C.RAD), y: KO.y - F * sc * Math.sin(a * C.RAD) });
  function axes() {
    return line(KO.x - 215, KO.y, 580, KO.y, 'var(--line)', 1.5, '5 4') + line(KO.x, KO.y + 195, KO.x, 12, 'var(--line)', 1.5, '5 4') + T(576, KO.y + 18, 'x', 'm', ' text-anchor="end"') + T(KO.x + 8, 26, 'y', 'm');
  }
  /* s: { F1, a1, F2, a2, show: 'para' | 'eck' } */
  function forceSvg(s) {
    s = s || {}; const F1 = pos(s.F1), F2 = pos(s.F2), a1 = fin(s.a1) ? s.a1 : 0, a2 = fin(s.a2) ? s.a2 : 90, r = C.resultant(F1, a1, F2, a2), sc = KSC * Math.min(1, KMAX / Math.max(F1, F2, 1e-9));
    const P1 = kp(F1, a1, sc), P2 = kp(F2, a2, sc), PR = { x: KO.x + r.x * sc, y: KO.y - r.y * sc }, eck = s.show === 'eck'; let b = axes();
    if (!eck) b += line(P1.x, P1.y, PR.x, PR.y, 'var(--hi)', 1.6, '6 4') + line(P2.x, P2.y, PR.x, PR.y, 'var(--accent)', 1.6, '6 4') + arrow(KO.x, KO.y, P1.x, P1.y, 'var(--accent)', 3.5) + arrow(KO.x, KO.y, P2.x, P2.y, 'var(--hi)', 3.5);
    else b += arrow(KO.x, KO.y, P1.x, P1.y, 'var(--accent)', 3.5) + arrow(P1.x, P1.y, PR.x, PR.y, 'var(--hi)', 3.5);
    b += arrow(KO.x, KO.y, PR.x, PR.y, 'var(--ok)', 4.5);
    const lab = (P, t, col, dx, dy) => T(cl(P.x + dx, 6, 470), cl(P.y + dy, 16, 395), t, '', ` style="fill:${col};font-weight:700"`);
    b += (eck ? lab({ x: (KO.x + P1.x) / 2, y: (KO.y + P1.y) / 2 }, 'F1 ' + f(F1) + ' N', 'var(--accent)', -4, 24) : lab(P1, 'F1 ' + f(F1) + ' N', 'var(--accent)', 12, -10)) + (eck ? lab({ x: (P1.x + PR.x) / 2, y: (P1.y + PR.y) / 2 }, 'F2 ' + f(F2) + ' N', 'var(--hi)', 14, 0) : lab(P2, 'F2 ' + f(F2) + ' N', 'var(--hi)', 12, -10));
    b += lab({ x: (KO.x + PR.x) / 2, y: (KO.y + PR.y) / 2 }, 'R ' + f(r.R, 1) + ' N · ' + f(r.ang, 0) + '°', 'var(--ok)', -6, 26);
    b += handle('F1', P1.x, P1.y, 'var(--accent)') + handle('F2', eck ? PR.x : P2.x, eck ? PR.y : P2.y, 'var(--hi)');
    b += T(12, 412, eck ? 'Kräfteeck: F2 an die Spitze von F1 setzen, R verbindet Anfang und Spitze.' : 'Parallelogramm: Die Diagonale ist R. Ziehe die Pfeilspitzen.', 'm');
    return svg(600, 420, 'Kräfteparallelogramm: Kräfte F1 und F2 und ihre Resultierende', b);
  }
  /* s: { F, a } */
  function zerlSvg(s) {
    s = s || {}; const F = pos(s.F), a = cl(s.a, 0, 90), P = kp(F, a, KSC * Math.min(1, ZMAX / Math.max(F, 1e-9))), px = { x: P.x, y: KO.y }, py = { x: KO.x, y: P.y };
    let b = axes() + line(P.x, P.y, px.x, px.y, 'var(--mute)', 1.6, '5 4') + line(P.x, P.y, py.x, py.y, 'var(--mute)', 1.6, '5 4');
    b += arrow(KO.x, KO.y + 4, px.x, KO.y + 4, 'var(--accent)', 3.5) + arrow(KO.x - 4, KO.y, KO.x - 4, py.y, 'var(--hi)', 3.5) + arrow(KO.x, KO.y, P.x, P.y, 'var(--ok)', 4.5);
    const r = 46, ax = KO.x + r * Math.cos(a * C.RAD), ay = KO.y - r * Math.sin(a * C.RAD);
    b += `<path d="M${KO.x + r} ${KO.y} A ${r} ${r} 0 0 0 ${n(ax)} ${n(ay)}" fill="none" stroke="var(--fg)" stroke-width="1.5"/>` + T(KO.x + r + 8, KO.y - 8, 'α ' + f(a) + '°', '');
    const c = C.comp(F, a);
    b += T(cl((KO.x + px.x) / 2 - 24, 6, 500), KO.y + 36, 'Fx ' + f(c.x, 1) + ' N', '', ' style="fill:var(--accent);font-weight:700"') + T(cl(KO.x - 110, 4, 300), (KO.y + py.y) / 2, 'Fy ' + f(c.y, 1) + ' N', '', ' style="fill:var(--hi);font-weight:700"') + T(cl(P.x + 12, 6, 470), cl(P.y - 10, 16, 395), 'F ' + f(F) + ' N', '', ' style="fill:var(--ok);font-weight:700"');
    b += handle('F', P.x, P.y, 'var(--ok)') + T(12, 412, 'Zerlegen: F wird in Fx und Fy aufgeteilt. Ziehe die Spitze.', 'm');
    return svg(600, 420, 'Kraft F in waagerechte und senkrechte Komponente zerlegt', b);
  }

  /* ============================================================ 2) Hebel */
  const LPV = { x: 300, y: 152 }, LSC = 2.5;
  const wBlock = F => cl(26 + Math.sqrt(Math.max(0, F)) * 1.3, 30, 72);
  /* Gewicht am Balken (im Balkensystem): x in cm, positiv rechts */
  function weight(F, x, col, id, lab) {
    const w = wBlock(F), cx = LPV.x + x * LSC;
    return line(cx, LPV.y + 6, cx, LPV.y + 14, 'var(--fg)', 2) + `<rect x="${n(cx - w / 2)}" y="${LPV.y + 14}" width="${n(w)}" height="34" rx="5" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="2"/>` + Tm(cx, LPV.y + 36, lab, '', ' style="font-weight:700"') + (id ? handle(id, cx, LPV.y + 58, col) : '');
  }
  /* s: { F1, x1, F2, x2, prev } F in N, x in cm; links bzw. rechts vom Drehpunkt. Ergebnis: Neigung nach dem Drehsinn der größeren Momente */
  function leverState(s) {
    const F1 = cl(s.F1, 0, 1000), x1 = cl(s.x1, 0, 100), F2 = cl(s.F2, 0, 1000), x2 = cl(s.x2, 0, 100), M1 = F1 * x1 / 100, M2 = F2 * x2 / 100, mx = Math.max(M1, M2, 1e-9);
    return { F1, x1, F2, x2, M1, M2, angle: Math.abs(M1 - M2) < 1e-6 ? 0 : cl((M2 - M1) / mx * 9, -9, 9) };
  }
  /* PRUEFEN P20: Hebel/Wippe: Der Balken ist gewichtslos, die Neigung nur symbolisch (höchstens 9°), die Gewichte hängen unter dem Balken, es gibt zwei Lasten und einen Drehpunkt in der Mitte. Reicht diese Vereinfachung, oder sollen auch einseitige Hebel (Lastarm und Kraftarm auf einer Seite, Winkelhebel) vorkommen? */
  function leverSvg(s) {
    s = s || {}; const st = leverState(s), prev = fin(s.prev) ? s.prev : st.angle;
    let b = `<g class="vz-tilt" id="lvTilt" style="transform:rotate(${n(prev)}deg);transform-origin:${LPV.x}px ${LPV.y}px">`;
    b += `<rect x="${LPV.x - 260}" y="${LPV.y - 6}" width="520" height="12" rx="4" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>`;
    for (let k = -100; k <= 100; k += 20) b += line(LPV.x + k * LSC, LPV.y - 6, LPV.x + k * LSC, LPV.y - (k % 100 === 0 ? 14 : 10), 'var(--mute)', 1.2);
    b += weight(st.F1, -st.x1, 'var(--accent)', 'x1', f(st.F1) + ' N') + weight(st.F2, st.x2, 'var(--hi)', 'x2', f(st.F2) + ' N') + '</g>';
    b += `<polygon points="${LPV.x},${LPV.y + 6} ${LPV.x - 18},${LPV.y + 52} ${LPV.x + 18},${LPV.y + 52}" fill="var(--mute)" fill-opacity=".4" stroke="var(--fg)" stroke-width="2"/>` + line(LPV.x - 90, LPV.y + 52, LPV.x + 90, LPV.y + 52, 'var(--mute)', 2) + Tm(LPV.x, LPV.y + 70, 'Drehpunkt', 'm');
    const yD = 250; b += line(LPV.x - st.x1 * LSC, yD, LPV.x, yD, 'var(--accent)', 2) + line(LPV.x, yD, LPV.x + st.x2 * LSC, yD, 'var(--hi)', 2) + Tm(LPV.x - st.x1 * LSC / 2, yD - 6, 'l1 ' + f(st.x1) + ' cm', '', ' style="fill:var(--accent)"') + Tm(LPV.x + st.x2 * LSC / 2, yD - 6, 'l2 ' + f(st.x2) + ' cm', '', ' style="fill:var(--hi)"');
    const mm = Math.max(st.M1, st.M2, 1e-9), bw = 200, yB = 270;
    b += `<rect x="${n(LPV.x - st.M1 / mm * bw)}" y="${yB}" width="${n(st.M1 / mm * bw)}" height="16" rx="3" fill="var(--accent)" fill-opacity=".6"/><rect x="${LPV.x}" y="${yB}" width="${n(st.M2 / mm * bw)}" height="16" rx="3" fill="var(--hi)" fill-opacity=".6"/>` + line(LPV.x, yB - 4, LPV.x, yB + 20, 'var(--fg)', 2);
    b += Te(LPV.x - 6, yB + 38, 'M1 ' + f(st.M1, 1) + ' Nm (links)', '') + T(LPV.x + 6, yB + 38, 'M2 ' + f(st.M2, 1) + ' Nm (rechts)', '');
    const dif = st.M2 - st.M1, eq = Math.abs(dif) < Math.max(st.M1, st.M2, 1) * 0.005;
    b += Tm(LPV.x, 24, eq ? 'Momente gleich: Gleichgewicht' : (dif > 0 ? 'Rechts überwiegt: Balken neigt sich nach rechts' : 'Links überwiegt: Balken neigt sich nach links'), '', ' style="font-weight:700"') + Tm(LPV.x, 42, 'Neigung klein gezeichnet; Balken gewichtslos angenommen', 'm');
    return svg(600, 326, 'Hebel mit zwei Gewichten, Momente links und rechts vom Drehpunkt', b);
  }

  /* ============================================================ 3) Träger */
  /* o: { react, diag, handles, unit }; loads dürfen id ('F1','F2','q') tragen */
  function beamSvg(bm, o) {
    o = o || {}; if (!C.beamOk(bm)) return msg('Der Träger ist nicht gültig (Lager und Länge prüfen).');
    const unit = o.unit || 'm', x0 = 56, x1 = 584, sx = (x1 - x0) / bm.L, X = x => x0 + x * sx, r = C.reactions(bm), react = !!o.react && fin(r.FA) && fin(r.FB), H0 = react ? 240 : 176, by = 86;
    let b = '';
    bm.loads.forEach(l => {
      if (l.t === 'F') { const x = X(l.x); b += arrow(x, 34, x, by, 'var(--hi)', 3.5) + Tm(cl(x, 40, 580), 24, f(l.F) + ' N', '', ' style="fill:var(--hi);font-weight:700"') + (o.handles && l.id ? handle(l.id, x, 38, 'var(--hi)') : ''); }
      else { const xa = X(l.x1), xb = X(l.x2); b += line(xa, 46, xb, 46, 'var(--hi)', 2.5); const k = Math.max(2, Math.round((xb - xa) / 28)); for (let i = 0; i <= k; i++) { const x = xa + (xb - xa) * i / k; b += arrow(x, 46, x, by, 'var(--hi)', 2); } b += Tm((xa + xb) / 2, 36, f(l.q) + ' N/' + unit + '', '', ' style="fill:var(--hi);font-weight:700"') + (o.handles && l.id ? handle(l.id + '1', xa, 46, 'var(--hi)') + handle(l.id + '2', xb, 46, 'var(--hi)') : ''); }
    });
    b += `<rect x="${x0}" y="${by}" width="${x1 - x0}" height="12" rx="3" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>`;
    const xa = X(bm.a), xb = X(bm.b);
    b += `<polygon points="${n(xa)},${by + 12} ${n(xa - 15)},${by + 40} ${n(xa + 15)},${by + 40}" fill="var(--mute)" fill-opacity=".45" stroke="var(--fg)" stroke-width="2"/>` + `<circle cx="${n(xb)}" cy="${by + 21}" r="9" fill="var(--mute)" fill-opacity=".45" stroke="var(--fg)" stroke-width="2"/>` + line(xb - 16, by + 32, xb + 16, by + 32, 'var(--fg)', 2);
    b += Tm(xa, by + 56, 'A', 'm') + Tm(xb, by + 56, 'B', 'm');
    if (react) {
      const ka = cl(r.FA, 0, 1e12), kb = cl(r.FB, 0, 1e12), mxr = Math.max(ka, kb, 1e-9), len = v => 24 + 40 * v / mxr;
      b += arrow(xa, by + 44 + len(ka), xa, by + 44, 'var(--ok)', 4) + arrow(xb, by + 44 + len(kb), xb, by + 44, 'var(--ok)', 4) + Tm(cl(xa, 50, 560), by + 44 + len(ka) + 16, 'FA ' + f(r.FA, 1) + ' N', '', ' style="fill:var(--ok);font-weight:700"') + Tm(cl(xb, 50, 570), by + 44 + len(kb) + 16, 'FB ' + f(r.FB, 1) + ' N', '', ' style="fill:var(--ok);font-weight:700"');
    }
    b += line(x0, H0 - 12, x1, H0 - 12, 'var(--mute)', 1.2) + T(x0, H0 + 2, '0', 'm') + Te(x1, H0 + 2, f(bm.L, 2) + ' ' + unit, 'm');
    let H = H0 + 12;
    if (o.diag && unit === 'm') {
      const d = C.diagram(bm, 160), vm = Math.max(1e-9, ...d.V.map(Math.abs)), mmx = C.mmax(bm), mm = Math.max(1e-9, Math.abs(mmx.M)), yV = H + 76, yM = H + 206, Vp = d.xs.map((x, i) => (i ? 'L' : 'M') + n(X(x)) + ' ' + n(yV - d.V[i] / vm * 46)).join(' '), Mp = d.xs.map((x, i) => (i ? 'L' : 'M') + n(X(x)) + ' ' + n(yM + d.M[i] / mm * 46)).join(' ');
      b += T(x0, H + 14, 'Querkraft V (Verlauf)', '') + `<path d="${Vp} L${x1} ${yV} L${x0} ${yV} Z" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="2"/>` + line(x0, yV, x1, yV, 'var(--mute)', 1.2) + Te(x1, H + 14, 'größter Betrag ' + f(vm, 0) + ' N', 'm');
      b += T(x0, H + 144, 'Biegemoment M (positiv nach unten gezeichnet)', '') + `<path d="${Mp} L${x1} ${yM} L${x0} ${yM} Z" fill="var(--hi)" fill-opacity=".28" stroke="var(--hi)" stroke-width="2"/>` + line(x0, yM, x1, yM, 'var(--mute)', 1.2) + Te(x1, H + 144 + 16, 'Mmax = ' + f(Math.abs(mmx.M), 1) + ' Nm bei ' + f(mmx.x, 2) + ' m', 'm');
      H += 270;
    }
    return svg(640, H, 'Träger auf zwei Stützen mit Lasten' + (react ? ', Auflagerkräften' : '') + (o.diag ? ' und Verläufen von Querkraft und Biegemoment' : ''), b);
  }

  /* ============================================================ 4) Zugstab und Hooke */
  /* s: { F, L, dL, A, sigma, eps, Re, druck } */
  /* PRUEFEN P19: Zugstab und Reibkegel: Die Verlängerung wird mit einem Vergrößerungsfaktor gezeichnet und als übertrieben gekennzeichnet; der Reibkegel zeigt den halben Öffnungswinkel ρ0 = arctan μ0 um die Flächennormale. Ist das für die Berufsschule verständlich, oder sollen Haftreibung und Reibkegel getrennt eingeführt werden? */
  function rodSvg(s) {
    s = s || {}; const eps = fin(s.eps) && s.eps > 0 ? s.eps : 0, L0 = 300, k = eps > 0 ? cl(Math.round(14 / (eps * L0) / 10) * 10, 1, 5000) : 1, ext = cl(eps * L0 * k, 0, 110), druck = !!s.druck, x0 = 70, y = 110, h = 40, len = druck ? L0 - ext : L0 + ext;
    let b = `<defs>${hatch('hwl', 'var(--mute)')}</defs><rect x="38" y="${y - 30}" width="32" height="${h + 60}" fill="url(#hwl)"/>` + line(70, y - 30, 70, y + h + 30, 'var(--fg)', 3);
    b += `<rect x="${x0}" y="${y}" width="${L0}" height="${h}" fill="none" stroke="var(--mute)" stroke-width="1.6" stroke-dasharray="6 5"/>`;
    b += `<rect x="${x0}" y="${y}" width="${n(len)}" height="${h}" rx="3" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="2.5"/>`;
    const xe = x0 + len; b += druck ? arrow(xe + 70, y + h / 2, xe + 2, y + h / 2, 'var(--hi)', 4.5) : arrow(xe + 2, y + h / 2, xe + 76, y + h / 2, 'var(--hi)', 4.5);
    b += T(cl(xe + 14, 80, 470), y - 14, 'F ' + f(s.F) + ' N', '', ' style="fill:var(--hi);font-weight:700"');
    b += line(x0, y + h + 22, x0 + L0, y + h + 22, 'var(--mute)', 1.2) + Tm(x0 + L0 / 2, y + h + 40, 'Ausgangslänge L ' + f(s.L) + ' mm', 'm');
    if (eps > 0) b += Tm(cl(x0 + L0 + (druck ? -ext / 2 : ext / 2), 120, 520), y + h + 62, (druck ? 'Verkürzung' : 'Verlängerung') + ' ΔL ' + f(s.dL, 3) + ' mm', '', ' style="fill:var(--accent);font-weight:700"');
    b += Tm(300, 22, 'Stark übertrieben gezeichnet: etwa ' + f(k) + '-fach', '', ' style="font-weight:700;fill:var(--warn)"');
    b += Tm(300, 42, 'In Wirklichkeit kaum sichtbar. Gestrichelt: Länge ohne Last', 'm');
    return svg(600, 246, 'Zugstab mit Kraft F, Verformung stark übertrieben', b);
  }
  /* s: { sigma, Re, Rm, E, zaeh } Diagramm Spannung über Dehnung, Gerade bis zur Grenze */
  function hookeSvg(s) {
    s = s || {}; const lim = fin(s.lim) && s.lim > 0 ? s.lim : 235, sg = fin(s.sigma) && s.sigma >= 0 ? s.sigma : 0, x0 = 60, y0 = 190, W = 320, Hh = 150, ymax = Math.max(lim * 1.3, sg * 1.1), Y = v => y0 - cl(v / ymax, 0, 1) * Hh, Xe = v => x0 + cl(v / (lim * 1.6), 0, 1) * W;
    let b = line(x0, y0, x0 + W + 10, y0, 'var(--fg)', 2) + line(x0, y0, x0, y0 - Hh - 10, 'var(--fg)', 2) + Te(x0 + W + 10, y0 + 18, 'Dehnung ε', 'm') + T(x0 + 6, y0 - Hh - 14, 'Spannung σ in N/mm²', 'm');
    b += line(x0, y0, Xe(lim), Y(lim), 'var(--ok)', 3.5) + line(Xe(lim), Y(lim), Xe(lim * 1.5), Y(lim * 1.05), 'var(--danger)', 2.5, '6 5');
    b += line(x0, Y(lim), Xe(lim), Y(lim), 'var(--mute)', 1.2, '4 4') + Te(x0 - 6, Y(lim) + 4, f(lim) + '', 'm') + T(Xe(lim) + 8, Y(lim) - 6, s.zaeh === false ? 'Rm (Bruch)' : 'Re (Streckgrenze)', 'm');
    const over = sg > lim + 1e-9, mx = Xe(Math.min(sg, lim * 1.5)), my = Y(Math.min(sg, ymax));
    b += line(x0, my, mx, my, over ? 'var(--danger)' : 'var(--accent)', 1.5, '4 4') + line(mx, my, mx, y0, over ? 'var(--danger)' : 'var(--accent)', 1.5, '4 4') + `<circle cx="${n(mx)}" cy="${n(my)}" r="7" fill="${over ? 'var(--danger)' : 'var(--accent)'}" stroke="var(--bg)" stroke-width="2"/>`;
    b += Tm(x0 + W / 2, y0 + 40, over ? 'Über der Grenze: Hooke gilt nicht mehr' : 'Gerade: σ = E · ε (elastisch)', '', ' style="font-size:11.5px"');
    return svg(440, 262, 'Spannungs-Dehnungs-Gerade nach Hooke mit der vorhandenen Spannung', b);
  }

  /* ============================================================ 5) Schiefe Ebene */
  const RP0 = { x: 80, y: 290 }, RL = 300;
  /* s: { alpha, mu0, mu } */
  function rampSvg(s, o) {
    s = s || {}; o = o || {}; const a = cl(s.alpha, 0, 60), mu0 = fin(s.mu0) ? Math.max(0, s.mu0) : 0.15, ca = Math.cos(a * C.RAD), sa = Math.sin(a * C.RAD), P1 = { x: RP0.x + RL * ca, y: RP0.y - RL * sa };
    let b = `<defs>${hatch('hrp', 'var(--mute)')}</defs><rect x="40" y="${RP0.y}" width="520" height="12" fill="url(#hrp)"/>` + line(40, RP0.y, 560, RP0.y, 'var(--mute)', 2);
    b += `<polygon points="${RP0.x},${RP0.y} ${n(P1.x)},${n(P1.y)} ${n(P1.x)},${RP0.y}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2.5" stroke-linejoin="round"/>`;
    const t = 0.55, Pc = { x: RP0.x + RL * t * ca, y: RP0.y - RL * t * sa }, C0 = { x: Pc.x - 31 * sa, y: Pc.y - 31 * ca }, rho = C.critAngle(mu0) || 0;
    const full = !o.fig;
    if (full) {
      const ci = { x: sa, y: ca }, ang = (d) => { const r = (d) * C.RAD, c = Math.cos(r), sn = Math.sin(r); return { x: ci.x * c - ci.y * sn, y: ci.x * sn + ci.y * c }; }, e1 = ang(rho), e2 = ang(-rho), CL = Math.max(40, Math.min(130, 366 - Pc.y));
      b += `<polygon points="${n(Pc.x)},${n(Pc.y)} ${n(Pc.x + e1.x * CL)},${n(Pc.y + e1.y * CL)} ${n(Pc.x + e2.x * CL)},${n(Pc.y + e2.y * CL)}" fill="var(--accent)" fill-opacity=".16" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      const inside = a <= rho + 1e-9; b += line(Pc.x, Pc.y, Pc.x, Pc.y + CL, inside ? 'var(--ok)' : 'var(--danger)', 2.5, '2 4') + T(cl(Pc.x + 10, 6, 400), Math.min(Pc.y + CL + 2, 372), 'Reibkegel ρ0 = ' + f(rho, 1) + '°', '', ' style="fill:var(--accent)"');
    }
    b += `<g transform="translate(${n(C0.x)} ${n(C0.y)}) rotate(${n(-a)})"><rect x="-30" y="-30" width="60" height="60" rx="4" fill="var(--hi)" fill-opacity=".3" stroke="var(--hi)" stroke-width="2.5"/></g>`;
    const LG = 100; b += arrow(C0.x, C0.y, C0.x, C0.y + LG, 'var(--fg)', 3.5) + T(C0.x + 8, C0.y + LG + 4, 'G', '', ' style="font-weight:700"');
    if (full) {
      b += arrow(C0.x + 5, C0.y, C0.x + 5 - LG * sa * ca, C0.y + LG * sa * sa, 'var(--hi)', 3) + arrow(C0.x, C0.y, C0.x + LG * ca * sa, C0.y + LG * ca * ca, 'var(--accent)', 3);
      const fr = Math.min(1.4, mu0) * LG * ca; b += arrow(C0.x - 5, C0.y - 6, C0.x - 5 + fr * ca, C0.y - 6 - fr * sa, 'var(--ok)', 3);
      b += T(cl(C0.x - LG * sa * ca - 56, 4, 520), C0.y + LG * sa * sa + 18, 'FH', '', ' style="fill:var(--hi);font-weight:700"') + T(C0.x + LG * ca * sa + 8, C0.y + LG * ca * ca + 14, 'FN', '', ' style="fill:var(--accent);font-weight:700"') + T(C0.x + fr * ca + 4, C0.y - 12 - fr * sa, 'FR0', '', ' style="fill:var(--ok);font-weight:700"');
    }
    const r2 = 56; b += `<path d="M${RP0.x + r2} ${RP0.y} A ${r2} ${r2} 0 0 0 ${n(RP0.x + r2 * ca)} ${n(RP0.y - r2 * sa)}" fill="none" stroke="var(--fg)" stroke-width="1.5"/>` + T(RP0.x + r2 + 8, RP0.y - 8, 'α ' + f(a) + '°', '');
    if (full) { b += handle('alpha', P1.x, P1.y, 'var(--accent)'); b += Tm(300, 20, (a <= rho + 1e-9 ? 'Haftreibung reicht: bleibt liegen' : 'Hangabtrieb größer als Haftreibung: rutscht'), '', ' style="font-weight:700"') + Tm(300, 40, 'Ziehe die obere Ecke der Ebene, um die Neigung zu ändern', 'm'); }
    if (full) b += Tm(300, 372, 'FH Hangabtrieb · FN Normalkraft · FR0 größte Haftreibung · G Gewichtskraft', 'm');
    if (!full) { const sh = Math.round(cl(P1.y - 30, 0, 110)); return svg(600, 320 - sh, 'Schiefe Ebene mit Körper und Neigungswinkel', '<g transform="translate(0 ' + (-sh) + ')">' + b + '</g>'); }
    return svg(600, 380, 'Schiefe Ebene mit Körper' + (full ? ', Kräftezerlegung und Reibkegel' : ''), b);
  }

  /* ============================================================ 6) Bolzen: Pressung, Abscheren, Lochen */
  /* s: { sub, d, t, n, s } */
  function pressSvg(s) {
    s = s || {}; const d = cl(s.d, 2, 40), t = cl(s.t, 1, 30), sc = Math.min(8, 90 / Math.max(d, t * 1.4)), D = d * sc, Tt = t * sc; let b = '';
    if (s.sub === 'schub') {
      const nn = s.n === 2 ? 2 : 1, cx = 290, bw = Math.max(26, D), pt = 26;
      if (nn === 1) {
        b += `<rect x="${cx - 190}" y="100" width="260" height="${pt}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/><rect x="${cx - 70}" y="${100 + pt}" width="260" height="${pt}" fill="var(--hi)" fill-opacity=".25" stroke="var(--hi)" stroke-width="2"/>`;
        b += `<rect x="${n(cx - bw / 2)}" y="84" width="${n(bw)}" height="${pt * 2 + 32}" rx="3" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>` + line(cx - bw / 2 - 8, 100 + pt, cx + bw / 2 + 8, 100 + pt, 'var(--danger)', 3, '5 3');
        b += arrow(cx - 190, 100 + pt / 2, cx - 250, 100 + pt / 2, 'var(--accent)', 4) + arrow(cx + 190, 100 + pt * 1.5, cx + 250, 100 + pt * 1.5, 'var(--hi)', 4) + T(cx - 250, 92, 'F', '', ' style="font-weight:700"') + T(cx + 236, 100 + pt * 2 + 18, 'F', '', ' style="font-weight:700"');
      } else {
        b += `<rect x="${cx - 190}" y="86" width="260" height="${pt}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/><rect x="${cx - 190}" y="${86 + pt * 2}" width="260" height="${pt}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/><rect x="${cx - 70}" y="${86 + pt}" width="260" height="${pt}" fill="var(--hi)" fill-opacity=".25" stroke="var(--hi)" stroke-width="2"/>`;
        b += `<rect x="${n(cx - bw / 2)}" y="70" width="${n(bw)}" height="${pt * 3 + 32}" rx="3" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>` + line(cx - bw / 2 - 8, 86 + pt, cx + bw / 2 + 8, 86 + pt, 'var(--danger)', 3, '5 3') + line(cx - bw / 2 - 8, 86 + pt * 2, cx + bw / 2 + 8, 86 + pt * 2, 'var(--danger)', 3, '5 3');
        b += arrow(cx - 190, 86 + pt * 1.5, cx - 250, 86 + pt * 1.5, 'var(--accent)', 4) + arrow(cx + 190, 86 + pt * 1.5, cx + 250, 86 + pt * 1.5, 'var(--hi)', 4);
      }
      b += T(12, 38, nn === 1 ? 'eine Scherfläche (einschnittig)' : 'zwei Scherflächen (zweischnittig)', '', ' style="fill:var(--danger);font-weight:700"') + T(12, 232, 'Der Bolzen schert an den roten Ebenen ab: A = π · d² / 4 je Fläche.', 'm');
    } else if (s.sub === 'loch') {
      const ss = cl(s.s, 1, 12), sp = Math.min(10, 60 / ss) * ss, dd = Math.min(150, D * 1.4);
      b += `<rect x="150" y="60" width="${n(dd)}" height="70" fill="var(--hi)" fill-opacity=".3" stroke="var(--hi)" stroke-width="2.5"/>` + T(150 + dd + 12, 100, 'Stempel', '', ' style="fill:var(--hi);font-weight:700"');
      b += `<rect x="60" y="140" width="${n(90 - 0)}" height="${n(sp)}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/><rect x="${n(150 + dd)}" y="140" width="${n(250)}" height="${n(sp)}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/><rect x="150" y="140" width="${n(dd)}" height="${n(sp)}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/>`;
      b += line(150, 140, 150, 140 + sp, 'var(--danger)', 3.5, '5 3') + line(150 + dd, 140, 150 + dd, 140 + sp, 'var(--danger)', 3.5, '5 3') + arrow(150 + dd / 2, 20, 150 + dd / 2, 58, 'var(--hi)', 4.5) + T(150 + dd / 2 + 12, 34, 'F', '', ' style="font-weight:700"');
      b += T(12, 228, 'Der Stempel schert einen Zylindermantel ab: A = π · d · s.', 'm') + T(150 + dd + 12, 140 + sp + 18, 's = ' + f(ss) + ' mm', 'm') + Tm(150 + dd / 2, 140 + sp + 18, 'd ' + f(d) + ' mm', 'm');
    } else {
      const px = 40, cy = 110;
      b += `<rect x="${px}" y="${cy}" width="${n(150)}" height="${n(Tt)}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/><rect x="${n(px + 150 + D)}" y="${cy}" width="${n(130)}" height="${n(Tt)}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="2"/>`;
      b += `<rect x="${n(px + 150)}" y="${cy - 26}" width="${n(D)}" height="${n(Tt + 52)}" rx="3" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>` + line(px + 150 + D, cy, px + 150 + D, cy + Tt, 'var(--danger)', 5) + line(px + 150, cy, px + 150, cy + Tt, 'var(--danger)', 5);
      b += arrow(px + 150 + D / 2 - 30, cy - 18, px + 150 + D / 2 + 20, cy - 18, 'var(--hi)', 3.5);
      const rx = 400, ry = cy - 16; b += `<rect x="${rx}" y="${n(ry + 10)}" width="${n(D)}" height="${n(Tt)}" fill="var(--danger)" fill-opacity=".3" stroke="var(--danger)" stroke-width="2"/>` + T(rx - 6, ry + Tt + 38, 'A = d · t', '', ' style="font-weight:700"') + T(rx - 6, ry - 2, 'projizierte Fläche', 'm') + Tm(rx + D / 2, ry + Tt + 56, f(d) + ' mm · ' + f(t) + ' mm', 'm');
      b += T(12, 232, 'Der Bolzen drückt auf die Lochwand (rot): A = d · t.', 'm');
    }
    return svg(600, 244, 'Bolzenverbindung: ' + (s.sub === 'schub' ? 'Abscheren' : s.sub === 'loch' ? 'Lochen' : 'Flächenpressung'), b);
  }

  /* ============================================================ 7) Biegung, Schwerpunkt, Wirkungsgrad */
  /* s: { prof: 'rechteck' | 'kreis' | 'rohr', b, h, d, D, di, sigma } */
  function bendSvg(s) {
    s = s || {}; const prof = s.prof || 'rechteck', cx = 440, cy = 130, box = 140; let w, h;
    if (prof === 'rechteck') { const bb = cl(s.b, 1, 200), hh = cl(s.h, 1, 200), k = box / Math.max(bb, hh); w = bb * k; h = hh * k; } else { const dd = cl(prof === 'rohr' ? s.D : s.d, 1, 200); w = h = dd * box / dd; }
    let b = `<g><path d="M40 150 Q170 190 300 150" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-opacity=".5"/>` + arrow(170, 60, 170, 160, 'var(--hi)', 4) + `<polygon points="40,170 26,196 54,196" fill="var(--mute)" fill-opacity=".45" stroke="var(--fg)" stroke-width="2"/><polygon points="300,170 286,196 314,196" fill="var(--mute)" fill-opacity=".45" stroke="var(--fg)" stroke-width="2"/></g>`;
    b += Tm(170, 48, 'Last in der Mitte', '', ' style="fill:var(--hi);font-weight:700"') + Tm(170, 222, 'Durchbiegung übertrieben gezeichnet', 'm');
    if (prof === 'rechteck') b += `<rect x="${n(cx - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2.5"/>`;
    else b += `<circle cx="${cx}" cy="${cy}" r="${n(w / 2)}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2.5"/>` + (prof === 'rohr' ? `<circle cx="${cx}" cy="${cy}" r="${n(w / 2 * cl(s.di / (s.D || 1), 0, 0.95))}" fill="var(--bg)" stroke="var(--fg)" stroke-width="2"/>` : '');
    const hy = h / 2, sx = cx + w / 2 + 40; b += line(cx - w / 2 - 14, cy, sx + 60, cy, 'var(--mute)', 1.5, '6 4');
    b += `<polygon points="${n(sx)},${cy} ${n(sx + 54)},${n(cy + hy)} ${n(sx)},${n(cy + hy)}" fill="var(--hi)" fill-opacity=".35" stroke="var(--hi)" stroke-width="2"/><polygon points="${n(sx)},${cy} ${n(sx + 54)},${n(cy - hy)} ${n(sx)},${n(cy - hy)}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)" stroke-width="2"/>`;
    b += T(sx - 10, cy + hy + 18, 'Zug', '', ' style="fill:var(--hi)"') + T(sx - 10, cy - hy - 8, 'Druck', '', ' style="fill:var(--accent)"') + Tm(cx, cy + box / 2 + 50, 'Querschnitt und Spannungsverlauf', 'm');
    if (fin(s.sigma)) b += Tm(sx + 30, cy + hy + 34, 'σb,max ' + f(s.sigma, 1) + ' N/mm²', '', ' style="font-weight:700"');
    return svg(600, 262, 'Biegung: Querschnitt und Spannungsverlauf', b);
  }
  /* s: { B, t1, t2, H }: L-Profil aus Grundplatte B x t1 und Steg t2 x H links bündig */
  function centroidSvg(s) {
    s = s || {}; const B = cl(s.B, 5, 300), t1 = cl(s.t1, 2, 100), t2 = cl(s.t2, 2, 100), H = cl(s.H, 5, 300), sc = Math.min(340 / B, 200 / (t1 + H)), x0 = 70, y0 = 236;
    const p1 = C.rectPart(B, t1, 0, 0), p2 = C.rectPart(t2, H, 0, t1), g = C.centroid([p1, p2]), X = v => x0 + v * sc, Y = v => y0 - v * sc;
    let b = `<rect x="${X(0)}" y="${n(Y(t1))}" width="${n(B * sc)}" height="${n(t1 * sc)}" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="2"/><rect x="${X(0)}" y="${n(Y(t1 + H))}" width="${n(t2 * sc)}" height="${n(H * sc)}" fill="var(--hi)" fill-opacity=".28" stroke="var(--hi)" stroke-width="2"/>`;
    b += line(x0 - 20, Y(0), x0 + B * sc + 20, Y(0), 'var(--mute)', 1.5);
    b += line(X(g.x), Y(g.y), x0 - 20, Y(g.y), 'var(--ok)', 1.5, '5 4') + line(X(g.x), Y(g.y), X(g.x), Y(0), 'var(--ok)', 1.5, '5 4') + `<circle cx="${n(X(g.x))}" cy="${n(Y(g.y))}" r="7" fill="var(--bg)" stroke="var(--ok)" stroke-width="3"/>` + line(X(g.x) - 12, Y(g.y), X(g.x) + 12, Y(g.y), 'var(--ok)', 2) + line(X(g.x), Y(g.y) - 12, X(g.x), Y(g.y) + 12, 'var(--ok)', 2);
    b += Te(x0 - 24, Y(g.y) + 4, 'ys ' + f(g.y, 1) + ' mm', '', ' style="fill:var(--ok);font-weight:700"') + Tm(X(g.x), Y(0) + 18, 'xs ' + f(g.x, 1) + ' mm', '', ' style="fill:var(--ok);font-weight:700"') + Tm(x0 + B * sc / 2, Y(0) + 40, 'Teilflächen: A1 = ' + f(p1.A) + ' mm², A2 = ' + f(p2.A) + ' mm²', 'm');
    return svg(600, 290, 'Schwerpunkt eines L-Profils aus zwei Rechtecken', b);
  }
  /* s: { Pzu, e1, e2 } in kW und Anteilen 0..1 */
  function effSvg(s) {
    s = s || {}; const Pz = cl(s.Pzu, 0.001, 1e6), e1 = cl(s.e1, 0.01, 1), e2 = cl(s.e2, 0.01, 1), x0 = 30, W = 540, k = W / Pz, rows = [['zugeführt', Pz, Pz], ['nach Stufe 1 (Motor)', Pz * e1, Pz], ['nach Stufe 2 (Getriebe)', Pz * e1 * e2, Pz * e1]]; let b = '';
    rows.forEach((r, i) => {
      const y = 36 + i * 74; b += T(x0, y - 8, r[0] + ': ' + f(r[1], 2) + ' kW', '', ' style="font-weight:700"') + `<rect x="${x0}" y="${y}" width="${n(r[1] * k)}" height="28" rx="3" fill="var(--ok)" fill-opacity=".4" stroke="var(--ok)" stroke-width="2"/>`;
      if (i) b += `<rect x="${n(x0 + r[1] * k)}" y="${y}" width="${n((r[2] - r[1]) * k)}" height="28" rx="3" fill="var(--danger)" fill-opacity=".25" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="5 4"/>` + T(x0 + r[1] * k + 6, y + 19, 'Verlust ' + f(r[2] - r[1], 2) + ' kW', 'm');
    });
    b += T(x0, 262, 'ηges = ' + f(e1, 2) + ' · ' + f(e2, 2) + ' = ' + f(e1 * e2, 3) + '  (Verluste werden zu Wärme)', '');
    return svg(600, 276, 'Leistungsfluss durch zwei Stufen mit Verlusten', b);
  }

  /* ============================================================ 8) Skizzen für Aufgaben (nur gegebene Größen) */
  function leverFig(g) {
    const rows = [g.l, g.r, g.r2].filter(Boolean); let b = ''; const sc = 2.4, P = { x: 300, y: 80 };
    b += `<rect x="${P.x - 270}" y="${P.y - 6}" width="540" height="12" rx="4" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/><polygon points="${P.x},${P.y + 6} ${P.x - 16},${P.y + 46} ${P.x + 16},${P.y + 46}" fill="var(--mute)" fill-opacity=".4" stroke="var(--fg)" stroke-width="2"/>`;
    const mx = Math.max(60, ...rows.map(r => (fin(r.x) ? r.x : 0)));
    const k = Math.min(sc, 250 / mx);
    const one = (r, side, col, unit, idx) => {
      const x = fin(r.x) ? r.x : mx * 0.7 + idx * 0, px = P.x + side * x * k, un = fin(r.x) ? f(r.x) + ' ' + unit : '?', fu = fin(r.F) ? f(r.F) + ' N' : '?';
      return arrow(px, P.y - 52, px, P.y - 8, col, 3.5) + Tm(px, P.y - 58, fu, '', ` style="fill:${col};font-weight:700"`) + line(P.x, P.y + 70 + idx * 18, px, P.y + 70 + idx * 18, col, 1.5, fin(r.x) ? '' : '5 4') + Tm((P.x + px) / 2, P.y + 66 + idx * 18, un, '', ` style="fill:${col}"`);
    };
    b += one(g.l, -1, 'var(--accent)', g.unit || 'mm', 0) + one(g.r, 1, 'var(--hi)', g.unit || 'mm', 0);
    if (g.r2) b += one(g.r2, 1, 'var(--warn)', g.unit || 'mm', 1);
    return svg(600, 176, 'Skizze des Hebels mit den gegebenen Größen, gesuchte Größen als Fragezeichen', b);
  }
  function taskFig(fig) {
    if (!fig || !C) return '';
    if (fig.type === 'beam') { const bm = fig.bm; return beamSvg(bm, { unit: fig.unit || 'm' }); }
    if (fig.type === 'lever') return leverFig(fig);
    if (fig.type === 'ramp') return rampSvg({ alpha: fig.alpha, mu0: 0 }, { fig: true });
    return '';
  }

  /* ============================================================ Zeigersteuerung (nur im Browser) */
  /* attach(el, cb): cb(id, { x, y }, phase) mit phase 'start' | 'move' | 'end'; Koordinaten in viewBox-Einheiten des ersten <svg> in el */
  function attach(el, cb) {
    if (!el || !el.addEventListener) return;
    let cur = null;
    function pt(e) { const sv = el.querySelector('svg'); if (!sv || !sv.viewBox) return { x: 0, y: 0 }; const r = sv.getBoundingClientRect(), vb = sv.viewBox.baseVal; return { x: vb.x + (e.clientX - r.left) / (r.width || 1) * vb.width, y: vb.y + (e.clientY - r.top) / (r.height || 1) * vb.height }; }
    el.addEventListener('pointerdown', e => { const h = e.target && e.target.closest ? e.target.closest('[data-h]') : null; if (!h) return; cur = h.getAttribute('data-h'); try { el.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); cb(cur, pt(e), 'start'); });
    el.addEventListener('pointermove', e => { if (cur == null) return; e.preventDefault(); cb(cur, pt(e), 'move'); });
    const end = e => { if (cur == null) return; const id = cur; cur = null; cb(id, pt(e), 'end'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  const api = { svg, forceSvg, zerlSvg, leverState, leverSvg, beamSvg, rodSvg, hookeSvg, rampSvg, pressSvg, bendSvg, centroidSvg, effSvg, leverFig, taskFig, attach, KO, KSC, KMAX, ZMAX, LPV, LSC, RP0, RL };
  root.MCH_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
