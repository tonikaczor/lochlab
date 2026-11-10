'use strict';
/* Tonfunk CNC-Lab: Visualisierungen (Lab-Kennung 'cnc'), window.CNC_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen (liefern Markup als Text) plus eine kleine DOM-Anbindung, die ohne Änderung an cncui.js auskommt:
   - Reiter "Beispiele": je Beispielprogramm eine Bahn-Vorschau (Eilgang gestrichelt, Arbeitsgang durchgezogen, Nullpunkt)
     und die Karte "Live-Skizzen" (Absolut/Kettenmaß, Kreisbogen mit I/J, Nullpunkt G54, Drehen: Durchmesser und Radius).
   - Reiter "Hilfe": dieselben Live-Skizzen als eigener Abschnitt.
   Aufgabenintegrität: Die Skizzen zeigen Zusammenhänge mit frei wählbaren Zahlen. Sie lesen nichts aus Aufgaben oder Trainer,
   es gibt keine Zeit- oder Wegberechnung (Hauptzeit bleibt Aufgabe). Farben nur über die CSS-Variablen des Labs. Keine Animation. */
(function (root) {
  const C = root.CNC_CORE || (typeof require !== 'undefined' ? require('./cnccore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : (d || 0);
  const p1 = v => fin(v).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, fin(v, a)));
  /* Zahl für G-Code-Wörter: Punkt als Dezimalzeichen, höchstens 3 Stellen, ohne Nullen am Ende */
  const gn = v => { v = Math.round(fin(v) * 1000) / 1000; if (Object.is(v, -0)) v = 0; return String(v); };
  const sg = v => (v > 0 ? '+' : '') + gn(v);

  /* ---------- gemeinsame Bausteine ---------- */
  const CSS = `
.vz-c{--vz-a:var(--accent);margin-bottom:10px}
.vz-c .vz-seg{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.vz-c .vz-b{flex:1 1 auto;min-height:44px;padding:0 12px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);font:600 13.5px system-ui,sans-serif;color:var(--fg);cursor:pointer;touch-action:manipulation}
.vz-c .vz-b.on{background:var(--accent-bg);border-color:var(--accent-bg);color:#fff}
.vz-c .vz-sl{display:grid;grid-template-columns:minmax(0,1fr);gap:0 12px}
@media(min-width:560px){.vz-c .vz-sl{grid-template-columns:1fr 1fr}}
.vz-c .vz-sl label{display:block;font-size:12.5px;color:var(--mute);margin:2px 0}
.vz-c .vz-sl label b{color:var(--fg);font-variant-numeric:tabular-nums}
.vz-c input[type=range]{width:100%;min-height:44px;margin:0;accent-color:var(--accent-bg)}
.vz-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:6px 0}
.vz-fig svg{display:block;width:100%;max-width:620px;height:auto;margin:0 auto}
.vz-fig svg text{font-family:system-ui,sans-serif;-webkit-user-select:none;user-select:none}
.vz-bg{fill:var(--panel2)}.vz-gr{stroke:var(--line);stroke-width:.7}.vz-tx{fill:var(--mute);font-size:10.5px}.vz-tx2{fill:var(--fg);font-size:12px;font-weight:700}
.vz-st{fill:none;stroke:var(--hi);stroke-width:1.3;stroke-dasharray:5 3}
.vz-stf{fill:var(--work);stroke:var(--accent);stroke-width:1.2}
.vz-feed{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.vz-rap{fill:none;stroke:var(--hi);stroke-width:1.5;stroke-dasharray:6 4}
.vz-ax{stroke:var(--hi);stroke-width:1.6;fill:none}.vz-axt{fill:var(--hi);font-size:12px;font-weight:700}
.vz-d{stroke:var(--mute);stroke-width:1.2;stroke-dasharray:4 3;fill:none}
.vz-dok{stroke:var(--ok);stroke-width:1.6;fill:none}
.vz-ok{fill:var(--ok);font-size:11.5px;font-weight:700}
.vz-pt{fill:var(--accent-bg);stroke:var(--panel2);stroke-width:1.5}
.vz-p0{fill:var(--panel2);stroke:var(--fg);stroke-width:1.8}
.vz-arc{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round}
.vz-cir{fill:none;stroke:var(--line);stroke-width:1.2;stroke-dasharray:3 4}
.vz-bad{fill:var(--danger);font-size:12px;font-weight:700}
.vz-code{font:600 13.5px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0;white-space:pre-wrap;word-break:break-word;color:var(--fg)}
.vz-code i{font-style:normal;color:var(--mute)}
.vz-note{font-size:13px;color:var(--mute);line-height:1.45;margin:6px 0 0}
.vz-th{display:block;background:var(--panel2);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:0 0 8px}
.vz-th svg{display:block;width:100%;height:auto;max-height:190px}
`;

  /* ---------- Skizze 1: Absolut (G90) und Kettenmaß (G91) ---------- */
  /* o: {nul: 'ecke'|'mitte', px, py (Zielpunkt, Maß von der linken unteren Ecke, mm)}; Startpunkt fest bei (20, 15) von der Ecke. */
  const COORD = { W: 80, H: 60, S: [20, 15] };
  function coordSvg(o) {
    o = o || {}; const mid = o.nul === 'mitte', ox = mid ? COORD.W / 2 : 0, oy = mid ? COORD.H / 2 : 0;
    const px = clamp(o.px, 0, COORD.W), py = clamp(o.py, 0, COORD.H), sx = COORD.S[0], sy = COORD.S[1];
    const k = 4.4, L = 46, T = 20, W = 440, H = 330, X = v => L + v * k, Y = v => T + (COORD.H - v) * k;
    let s = `<rect class="vz-bg" width="${W}" height="${H}"/>`;
    for (let v = 0; v <= COORD.W; v += 20) s += `<line class="vz-gr" x1="${p1(X(v))}" y1="${p1(Y(0))}" x2="${p1(X(v))}" y2="${p1(Y(COORD.H))}"/><text class="vz-tx" x="${p1(X(v))}" y="${p1(Y(0) + 15)}" text-anchor="middle">${gn(v - ox)}</text>`;
    for (let v = 0; v <= COORD.H; v += 20) s += `<line class="vz-gr" x1="${p1(X(0))}" y1="${p1(Y(v))}" x2="${p1(X(COORD.W))}" y2="${p1(Y(v))}"/><text class="vz-tx" x="${p1(X(0) - 6)}" y="${p1(Y(v) + 3.5)}" text-anchor="end">${gn(v - oy)}</text>`;
    s += `<rect class="vz-stf" style="fill-opacity:.35" x="${p1(X(0))}" y="${p1(Y(COORD.H))}" width="${p1(COORD.W * k)}" height="${p1(COORD.H * k)}"/>`;
    /* Nullpunkt mit Achsenpfeilen */
    const zx = X(ox), zy = Y(oy);
    s += `<path class="vz-ax" d="M${p1(zx)},${p1(zy)} h38 m-7,-4 l7,4 l-7,4 M${p1(zx)},${p1(zy)} v-38 m-4,7 l4,-7 l4,7"/><circle class="vz-p0" style="stroke:var(--hi)" cx="${p1(zx)}" cy="${p1(zy)}" r="5.5"/><text class="vz-axt" x="${p1(zx + 42)}" y="${p1(zy + 4)}">+X</text><text class="vz-axt" x="${p1(zx + 8)}" y="${p1(zy - 36)}">+Y</text><text class="vz-axt" x="${p1(zx + 9)}" y="${p1(zy + 16)}">Nullpunkt</text>`;
    /* Weg vom Start zum Ziel, Teilwege */
    s += `<line class="vz-d" x1="${p1(X(sx))}" y1="${p1(Y(sy))}" x2="${p1(X(px))}" y2="${p1(Y(sy))}"/><line class="vz-d" x1="${p1(X(px))}" y1="${p1(Y(sy))}" x2="${p1(X(px))}" y2="${p1(Y(py))}"/>`;
    s += `<line class="vz-feed" x1="${p1(X(sx))}" y1="${p1(Y(sy))}" x2="${p1(X(px))}" y2="${p1(Y(py))}"/>`;
    const dx = px - sx, dy = py - sy;
    if (Math.abs(dx) > 0.5) s += `<text class="vz-ok" x="${p1((X(sx) + X(px)) / 2)}" y="${p1(Y(sy) + (dy >= 0 ? 15 : -7))}" text-anchor="middle">ΔX ${sg(dx)}</text>`;
    if (Math.abs(dy) > 0.5) s += `<text class="vz-ok" x="${p1(X(px) + (dx >= 0 ? 7 : -7))}" y="${p1((Y(sy) + Y(py)) / 2 + 4)}" text-anchor="${dx >= 0 ? 'start' : 'end'}">ΔY ${sg(dy)}</text>`;
    s += `<circle class="vz-p0" cx="${p1(X(sx))}" cy="${p1(Y(sy))}" r="6"/><text class="vz-tx2" x="${p1(X(sx) - 9)}" y="${p1(Y(sy) - 9)}" text-anchor="end">Start</text>`;
    s += `<circle class="vz-pt" cx="${p1(X(px))}" cy="${p1(Y(py))}" r="7"/><text class="vz-tx2" x="${p1(X(px))}" y="${p1(Y(py) - 12)}" text-anchor="middle">Ziel</text>`;
    const abs = 'G90 G1 X' + gn(px - ox) + ' Y' + gn(py - oy), inc = 'G91 G1 X' + gn(dx) + ' Y' + gn(dy);
    return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Frästeil von oben mit Nullpunkt, Startpunkt und Zielpunkt">${s}</svg>`, abs, inc, dx, dy, X: px - ox, Y: py - oy };
  }

  /* ---------- Skizze 2: Kreisbogen mit I und J ---------- */
  /* o: {i, j (Mittelpunkt vom Startpunkt aus, mm), dir: 2|3, sweep (Winkel in Grad, 10..360)}; Start fest bei (35, 25). */
  const ARC = { S: [35, 25] };
  function arcGeom(o) {
    o = o || {}; const i = clamp(o.i, -10, 10), j = clamp(o.j, -10, 10), dir = +o.dir === 3 ? 3 : 2, sweep = clamp(o.sweep, 10, 360);
    const r = Math.hypot(i, j); if (r < 1e-9) return { ok: false, i, j, dir, sweep };
    const mx = ARC.S[0] + i, my = ARC.S[1] + j, a0 = Math.atan2(-j, -i), da = (dir === 3 ? 1 : -1) * sweep * Math.PI / 180, a1 = a0 + da;
    return { ok: true, i, j, dir, sweep, r, mx, my, a0, a1, ex: mx + r * Math.cos(a1), ey: my + r * Math.sin(a1), full: sweep >= 359.99 };
  }
  function arcSvg(o) {
    const g = arcGeom(o), W = 440, H = 316, k = 6.2, L = 3, T = 3, X = v => L + v * k, Y = v => T + (50 - v) * k;
    let s = `<rect class="vz-bg" width="${W}" height="${H}"/>`;
    for (let v = 0; v <= 70; v += 10) s += `<line class="vz-gr" x1="${p1(X(v))}" y1="${p1(Y(0))}" x2="${p1(X(v))}" y2="${p1(Y(50))}"/>`;
    for (let v = 0; v <= 50; v += 10) s += `<line class="vz-gr" x1="${p1(X(0))}" y1="${p1(Y(v))}" x2="${p1(X(70))}" y2="${p1(Y(v))}"/>`;
    const sx = X(ARC.S[0]), sy = Y(ARC.S[1]);
    if (!g.ok) return { ok: false, svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kreisbogen: I und J dürfen nicht beide 0 sein">${s}<circle class="vz-p0" cx="${p1(sx)}" cy="${p1(sy)}" r="6"/><text class="vz-bad" x="${W / 2}" y="${H - 14}" text-anchor="middle">I und J dürfen nicht beide 0 sein (Radius 0)</text></svg>`, code: '' };
    const mx = X(g.mx), my = Y(g.my), rr = g.r * k, ex = X(g.ex), ey = Y(g.ey);
    s += `<circle class="vz-cir" cx="${p1(mx)}" cy="${p1(my)}" r="${p1(rr)}"/>`;
    /* Bildschirm: y nach unten; G2 = im Uhrzeigersinn = sweep-flag 1 */
    if (g.full) s += `<circle class="vz-arc" cx="${p1(mx)}" cy="${p1(my)}" r="${p1(rr)}"/>`;
    else s += `<path class="vz-arc" d="M${p1(sx)},${p1(sy)} A${p1(rr)},${p1(rr)} 0 ${g.sweep > 180 ? 1 : 0} ${g.dir === 2 ? 1 : 0} ${p1(ex)},${p1(ey)}"/>`;
    /* Pfeil auf dem Bogen in Mitte */
    const am = g.a0 + (g.a1 - g.a0) / 2, ax = g.mx + g.r * Math.cos(am), ay = g.my + g.r * Math.sin(am), tang = (g.dir === 3 ? 1 : -1), tx = -Math.sin(am) * tang, ty = Math.cos(am) * tang;
    const bx = X(ax), by = Y(ay), ux = tx, uy = -ty;   /* Richtung auf dem Bildschirm */
    s += `<path d="M${p1(bx + ux * 8)},${p1(by + uy * 8)} L${p1(bx - ux * 5 - uy * 6)},${p1(by - uy * 5 + ux * 6)} L${p1(bx - ux * 5 + uy * 6)},${p1(by - uy * 5 - ux * 6)}Z" fill="var(--accent)"/>`;
    /* I (waagerecht) und J (senkrecht) vom Startpunkt zum Mittelpunkt */
    s += `<line class="vz-dok" x1="${p1(sx)}" y1="${p1(sy)}" x2="${p1(mx)}" y2="${p1(sy)}"/><line class="vz-dok" x1="${p1(mx)}" y1="${p1(sy)}" x2="${p1(mx)}" y2="${p1(my)}"/>`;
    if (Math.abs(g.i) > 0.5) s += `<text class="vz-ok" x="${p1((sx + mx) / 2)}" y="${p1(sy + (g.j >= 0 ? 15 : -7))}" text-anchor="middle">I ${sg(g.i)}</text>`;
    if (Math.abs(g.j) > 0.5) s += `<text class="vz-ok" x="${p1(mx + (g.i >= 0 ? -7 : 7))}" y="${p1((sy + my) / 2 + 4)}" text-anchor="${g.i >= 0 ? 'end' : 'start'}">J ${sg(g.j)}</text>`;
    s += `<line class="vz-d" x1="${p1(sx)}" y1="${p1(sy)}" x2="${p1(mx)}" y2="${p1(my)}"/><circle cx="${p1(mx)}" cy="${p1(my)}" r="4.5" fill="var(--hi)"/><text class="vz-axt" x="${p1(mx)}" y="${p1(my - 11)}" text-anchor="middle">Mittelpunkt</text>`;
    s += `<circle class="vz-p0" cx="${p1(sx)}" cy="${p1(sy)}" r="6"/><text class="vz-tx2" x="${p1(sx)}" y="${p1(sy + (g.j > 0 ? -12 : 20))}" text-anchor="middle">Start</text>`;
    if (!g.full) s += `<circle class="vz-pt" cx="${p1(ex)}" cy="${p1(ey)}" r="6.5"/><text class="vz-tx2" x="${p1(ex)}" y="${p1(ey + (ey > my ? 18 : -11))}" text-anchor="middle">Ende</text>`;
    const code = (g.dir === 2 ? 'G2' : 'G3') + ' X' + gn(g.ex) + ' Y' + gn(g.ey) + ' I' + gn(g.i) + ' J' + gn(g.j);
    return { ok: true, svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kreisbogen ${g.dir === 2 ? 'im' : 'gegen den'} Uhrzeigersinn mit Mittelpunkt, I und J">${s}</svg>`, code, g };
  }

  /* ---------- Skizze 3: Nullpunktverschiebung G54 ---------- */
  /* o: {ox, oy (Werkstücknullpunkt in der Maschine), px, py (Punkt im Werkstück)}; Rohteil 80 x 60 */
  function g54Svg(o) {
    o = o || {}; const ox = clamp(o.ox, 10, 110), oy = clamp(o.oy, 10, 70), px = clamp(o.px, 0, 80), py = clamp(o.py, 0, 60);
    const k = 2.2, L = 26, T = 14, W = 440, H = 300, X = v => L + v * k, Y = v => T + (130 - v) * k;
    let s = `<rect class="vz-bg" width="${W}" height="${H}"/>`;
    for (let v = 0; v <= 180; v += 20) s += `<line class="vz-gr" x1="${p1(X(v))}" y1="${p1(Y(0))}" x2="${p1(X(v))}" y2="${p1(Y(130))}"/>`;
    for (let v = 0; v <= 120; v += 20) s += `<line class="vz-gr" x1="${p1(X(0))}" y1="${p1(Y(v))}" x2="${p1(X(180))}" y2="${p1(Y(v))}"/>`;
    s += `<rect fill="none" stroke="var(--mute)" stroke-width="1.4" x="${p1(X(0))}" y="${p1(Y(130))}" width="${p1(180 * k)}" height="${p1(130 * k)}"/><text class="vz-tx" x="${p1(X(180) - 6)}" y="${p1(Y(130) + 14)}" text-anchor="end">Maschinentisch (Maßangaben in mm)</text>`;
    s += `<rect class="vz-stf" x="${p1(X(ox))}" y="${p1(Y(oy + 60))}" width="${p1(80 * k)}" height="${p1(60 * k)}"/>`;
    /* Maschinennullpunkt */
    s += `<path class="vz-d" style="stroke:var(--fg)" d="M${p1(X(0))},${p1(Y(0))} h${p1(36)} m-7,-4 l7,4 l-7,4 M${p1(X(0))},${p1(Y(0))} v-36 m-4,7 l4,-7 l4,7"/><circle class="vz-p0" cx="${p1(X(0))}" cy="${p1(Y(0))}" r="5"/><text class="vz-tx2" x="${p1(X(0) + 10)}" y="${p1(Y(0) - 8)}">M0 Maschine</text>`;
    /* Verschiebung als Pfeil */
    s += `<line class="vz-dok" x1="${p1(X(0))}" y1="${p1(Y(oy))}" x2="${p1(X(ox))}" y2="${p1(Y(oy))}"/><line class="vz-dok" x1="${p1(X(0))}" y1="${p1(Y(0))}" x2="${p1(X(0))}" y2="${p1(Y(oy))}"/>`;
    s += `<path class="vz-ax" d="M${p1(X(ox))},${p1(Y(oy))} h26 m-6,-4 l6,4 l-6,4 M${p1(X(ox))},${p1(Y(oy))} v-26 m-4,6 l4,-6 l4,6"/><circle class="vz-p0" style="stroke:var(--hi)" cx="${p1(X(ox))}" cy="${p1(Y(oy))}" r="5"/><text class="vz-axt" x="${p1(X(ox) + 6)}" y="${p1(Y(oy) + 15)}">W0</text>`;
    const mxp = ox + px, myp = oy + py;
    s += `<circle class="vz-pt" cx="${p1(X(mxp))}" cy="${p1(Y(myp))}" r="6.5"/><text class="vz-tx2" x="${p1(X(mxp))}" y="${p1(Y(myp) - 11)}" text-anchor="middle">P</text>`;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Maschinentisch mit Maschinennullpunkt, Werkstücknullpunkt W0 und Punkt P">${s}</svg>`, g54: 'G54  X' + gn(ox) + ' Y' + gn(oy), wcs: 'X' + gn(px) + ' Y' + gn(py), mcs: 'X' + gn(mxp) + ' Y' + gn(myp) };
  }

  /* ---------- Skizze 4: Drehen, Durchmesser und Radius ---------- */
  /* o: {d (Durchmesser des gedrehten Abschnitts, 10..40)}; Rohteil Ø40, Z0 an der Planfläche */
  function turnSvg(o) {
    o = o || {}; const d = clamp(o.d, 10, 40), D0 = 40, W = 440, H = 250, k = 3, yc = 130, Z = z => 320 + z * 5.2;   /* Z negativ nach links */
    const R = v => v * k / 2;   /* Radius in Pixel aus Durchmesser */
    let s = `<rect class="vz-bg" width="${W}" height="${H}"/>`;
    const xl = Z(-52), xr = Z(0), xs = Z(-30);
    s += `<rect class="vz-st" x="${p1(xl)}" y="${p1(yc - R(D0))}" width="${p1(xr - xl)}" height="${p1(2 * R(D0))}"/>`;
    s += `<path class="vz-stf" style="fill-opacity:.55" d="M${p1(xl)},${p1(yc - R(D0))} H${p1(xs)} V${p1(yc - R(d))} H${p1(xr)} V${p1(yc + R(d))} H${p1(xs)} V${p1(yc + R(D0))} H${p1(xl)}Z"/>`;
    s += `<line class="vz-ax" style="stroke:var(--fg);stroke-dasharray:8 3 2 3;opacity:.6" x1="${p1(xl - 24)}" y1="${yc}" x2="${p1(xr + 40)}" y2="${yc}"/>`;
    /* Nullpunkt Z0 */
    s += `<line class="vz-ax" x1="${p1(xr)}" y1="${yc - 80}" x2="${p1(xr)}" y2="${yc + 80}"/><text class="vz-axt" x="${p1(xr + 6)}" y="${yc - 70}">Z0</text>`;
    /* Durchmesser (X) rechts, Radius links der Mittellinie */
    const dxp = xr + 22;
    s += `<line class="vz-dok" x1="${p1(dxp)}" y1="${p1(yc - R(d))}" x2="${p1(dxp)}" y2="${p1(yc + R(d))}"/><path class="vz-dok" d="M${p1(dxp - 4)},${p1(yc - R(d) + 8)} l4,-8 l4,8 M${p1(dxp - 4)},${p1(yc + R(d) - 8)} l4,8 l4,-8"/>`;
    s += `<text class="vz-ok" x="${p1(dxp + 14)}" y="${yc - 2}">X = Ø ${gn(d)}</text>`;
    const rxp = xs + 16 + (xr - xs) / 2 - 8;
    s += `<line class="vz-d" x1="${p1(rxp)}" y1="${yc}" x2="${p1(rxp)}" y2="${p1(yc - R(d))}"/><text class="vz-tx2" x="${p1(rxp + 5)}" y="${p1(yc - R(d) / 2 + 4)}">r = ${gn(d / 2)}</text>`;
    s += `<line class="vz-d" x1="${p1(xs - 12)}" y1="${p1(yc - R(D0))}" x2="${p1(xs - 12)}" y2="${p1(yc - R(d))}"/><text class="vz-tx" x="${p1(xs - 16)}" y="${p1(yc - (R(D0) + R(d)) / 2 + 4)}" text-anchor="end">Zustellung ${gn((D0 - d) / 2)} je Seite</text>`;
    s += `<text class="vz-tx" x="${p1(xl + 6)}" y="${H - 12}">Rohteil Ø ${D0}, gestrichelt</text>`;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Drehteil im Längsschnitt: Durchmesser X und Radius">${s}</svg>`, radius: d / 2, cut: (D0 - d) / 2 };
  }

  /* ---------- Bahn-Vorschau eines Programms (Beispiele) ---------- */
  function pathSvg(run, machine) {
    if (!run || !run.moves || !run.moves.length) return '';
    const turn = machine === 'turn', hv = p => turn ? [fin(p[2]), fin(p[0]) / 2] : [fin(p[0]), fin(p[1])], st = run.setup && run.setup.stock;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const inc = (h, v) => { if (h < x0) x0 = h; if (h > x1) x1 = h; if (v < y0) y0 = v; if (v > y1) y1 = v; };
    if (st) { if (turn) { inc(st.zmin, 0); inc(st.zmax, st.d / 2); } else { inc(st.x0, st.y0); inc(st.x1, st.y1); } }
    run.moves.forEach(m => { if (m.kind === 'feed') m.pts.forEach(p => { const q = hv(p); inc(q[0], q[1]); }); });
    if (x0 > x1) return '';
    if (turn) { y0 = Math.min(y0, -2); } const mg = Math.max(4, 0.06 * Math.max(x1 - x0, y1 - y0)); x0 -= mg; x1 += mg; y0 -= mg; y1 += mg;
    const W = 360, pad = 8, sc = Math.min((W - 2 * pad) / (x1 - x0), 150 / (y1 - y0)), Hh = (y1 - y0) * sc + 2 * pad, X = h => pad + (h - x0) * sc, Y = v => pad + (y1 - v) * sc;
    const d = kind => run.moves.filter(m => m.kind === kind).map(m => m.pts.map((p, i) => { const q = hv(p); return (i ? 'L' : 'M') + p1(X(q[0])) + ' ' + p1(Y(q[1])); }).join('')).join('');
    let s = `<rect class="vz-bg" width="${W}" height="${p1(Hh)}"/>`;
    if (st) { if (turn) s += `<rect class="vz-st" x="${p1(X(st.zmin))}" y="${p1(Y(st.d / 2))}" width="${p1((st.zmax - st.zmin) * sc)}" height="${p1(st.d / 2 * sc)}"/>`; else s += `<rect class="vz-st" x="${p1(X(st.x0))}" y="${p1(Y(st.y1))}" width="${p1((st.x1 - st.x0) * sc)}" height="${p1((st.y1 - st.y0) * sc)}"/>`; }
    if (turn) s += `<line class="vz-gr" x1="0" x2="${W}" y1="${p1(Y(0))}" y2="${p1(Y(0))}"/>`;
    s += `<path class="vz-rap" d="${d('rapid')}"/><path class="vz-feed" d="${d('feed')}"/>`;
    const zx = X(0), zy = Y(0);
    s += `<path class="vz-ax" d="M${p1(zx)},${p1(zy)} h14 m-4,-3 l4,3 l-4,3 M${p1(zx)},${p1(zy)} v-14 m-3,4 l3,-4 l3,4"/><circle class="vz-p0" style="stroke:var(--hi)" cx="${p1(zx)}" cy="${p1(zy)}" r="3.5"/>`;
    return `<svg viewBox="0 0 ${W} ${p1(Hh)}" role="img" aria-label="Vorschau der Werkzeugbahn: Arbeitsgang durchgezogen, Eilgang gestrichelt, Nullpunkt orange">${s}</svg>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const SK = [['abs', 'Absolut oder Kettenmaß'], ['arc', 'Kreisbogen I/J'], ['g54', 'Nullpunkt G54'], ['turn', 'Drehen: Ø und Radius']];
  const ST = { k: 'abs', nul: 'ecke', px: 50, py: 40, i: -10, j: 0, dir: 2, sweep: 90, ox: 40, oy: 30, gx: 60, gy: 30, d: 30 };
  function liveHTML(uid) {
    const sl = (id, lab, min, max, val, unit) => `<div><label for="${uid}${id}">${lab} <b id="${uid}${id}v">${val}${unit || ''}</b></label><input type="range" id="${uid}${id}" data-vz="${id}" min="${min}" max="${max}" step="1" value="${val}"></div>`;
    const bt = (d, v, l, on) => `<button class="vz-b${on ? ' on' : ''}" data-vzb="${d}" data-v="${v}" aria-pressed="${!!on}">${l}</button>`;
    let ctl = '';
    if (ST.k === 'abs') { const mid = ST.nul === 'mitte', ox = mid ? 40 : 0, oy = mid ? 30 : 0; ctl = `<div class="vz-seg">${bt('nul', 'ecke', 'Nullpunkt in der Ecke', !mid)}${bt('nul', 'mitte', 'Nullpunkt in der Mitte', mid)}</div><div class="vz-sl">${sl('px', 'Ziel X', -ox, 80 - ox, ST.px - ox)}${sl('py', 'Ziel Y', -oy, 60 - oy, ST.py - oy)}</div>`; }
    else if (ST.k === 'arc') ctl = `<div class="vz-seg">${bt('dir', 2, 'G2 im Uhrzeigersinn', ST.dir === 2)}${bt('dir', 3, 'G3 gegen den Uhrzeigersinn', ST.dir === 3)}</div><div class="vz-sl">${sl('i', 'I (Abstand in X zum Mittelpunkt)', -10, 10, ST.i)}${sl('j', 'J (Abstand in Y zum Mittelpunkt)', -10, 10, ST.j)}${sl('sweep', 'Bogenwinkel', 10, 360, ST.sweep, '°')}</div>`;
    else if (ST.k === 'g54') ctl = `<div class="vz-sl">${sl('ox', 'G54 Verschiebung X', 10, 110, ST.ox)}${sl('oy', 'G54 Verschiebung Y', 10, 70, ST.oy)}${sl('gx', 'Punkt P: X im Werkstück', 0, 80, ST.gx)}${sl('gy', 'Punkt P: Y im Werkstück', 0, 60, ST.gy)}</div>`;
    else ctl = `<div class="vz-sl">${sl('d', 'Durchmesser X des gedrehten Abschnitts', 10, 40, ST.d)}</div>`;
    return `<div class="vz-seg" role="group" aria-label="Skizze wählen">${SK.map(x => bt('k', x[0], x[1], ST.k === x[0])).join('')}</div>${ctl}<div class="vz-fig" data-vzfig></div><div data-vzout></div>`;
  }
  function liveOut(host) {
    let r, out = '';
    if (ST.k === 'abs') { r = coordSvg({ nul: ST.nul, px: ST.px, py: ST.py }); out = `<div class="vz-code"><i>absolut:  </i>${esc(r.abs)}\n<i>Kettenmaß:</i> ${esc(r.inc)}</div><p class="vz-note">Absolut (G90) ist die Position im Werkstückkoordinatensystem, Kettenmaß (G91) der Weg vom aktuellen Punkt. Der Startpunkt liegt bei X${gn(COORD.S[0] - (ST.nul === 'mitte' ? 40 : 0))} Y${gn(COORD.S[1] - (ST.nul === 'mitte' ? 30 : 0))}. Schiebe den Nullpunkt in die Mitte und beobachte: Die Absolutwerte ändern sich, die Wege nicht.</p>`; }
    else if (ST.k === 'arc') { r = arcSvg(ST); out = r.ok ? `<div class="vz-code">${esc(r.code)}</div><p class="vz-note">I und J sind Abstände vom <b>Startpunkt</b> zum Mittelpunkt, mit Vorzeichen, nicht vom Nullpunkt. Der Kreis um den Mittelpunkt geht durch Start und Ende, beide haben denselben Radius.</p>` : '<p class="vz-note">Mindestens einer der Werte I und J muss ungleich 0 sein.</p>'; }
    else if (ST.k === 'g54') { r = g54Svg({ ox: ST.ox, oy: ST.oy, px: ST.gx, py: ST.gy }); out = `<div class="vz-code"><i>Nullpunktverschiebung:</i> ${esc(r.g54)}\n<i>Punkt P im Werkstück:</i> ${esc(r.wcs)}\n<i>Punkt P in der Maschine:</i> ${esc(r.mcs)}</div><p class="vz-note">G54 legt fest, wo der Werkstücknullpunkt W0 in der Maschine liegt. Im Programm stehen nur Werkstückmaße, die Steuerung addiert die Verschiebung.</p>`; }
    else { r = turnSvg({ d: ST.d }); out = `<div class="vz-code">G1 X${esc(gn(ST.d))} Z-30 F0.2   <i>(X ist der Durchmesser)</i></div><p class="vz-note">Beim Drehen steht in X der Durchmesser. Der Radius ist halb so groß, die Zustellung je Seite ist die halbe Durchmesserdifferenz.</p>`; }
    host.querySelector('[data-vzfig]').innerHTML = r.svg; host.querySelector('[data-vzout]').innerHTML = out;
  }
  function mountLive(host, uid, titled) {
    host.innerHTML = (titled ? '<h4>Live-Skizzen zum Ausprobieren</h4>' : '') + '<div data-vzbody></div>';
    const body = host.querySelector('[data-vzbody]');
    const full = () => { body.innerHTML = liveHTML(uid); liveOut(body); };
    full();
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-vzb]'); if (!b) return; const d = b.dataset.vzb, v = b.dataset.v;
      if (d === 'k') ST.k = v; else if (d === 'nul') { ST.nul = v; } else if (d === 'dir') ST.dir = +v;
      full();
    });
    body.addEventListener('input', e => {
      const id = e.target.dataset && e.target.dataset.vz; if (!id) return; const v = +e.target.value, mid = ST.nul === 'mitte';
      if (id === 'px') ST.px = v + (mid ? 40 : 0); else if (id === 'py') ST.py = v + (mid ? 30 : 0); else ST[id] = v;
      const lab = body.querySelector('#' + uid + id + 'v'); if (lab) lab.textContent = v + (id === 'sweep' ? '°' : '');
      liveOut(body);
    });
  }
  function injectCss() { if (document.getElementById('cncviz-css')) return; const st = document.createElement('style'); st.id = 'cncviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  function decorateBsp(v) {
    if (v.querySelector('.vz-c') || !v.querySelector('.card') || !C || !root.CNC_DATA) return;
    const cards = v.querySelectorAll(':scope > .card');
    if (cards.length > 1) {
      const D = root.CNC_DATA, BSP = D.beispiele || [];
      BSP.forEach((b, i) => {
        const card = cards[i + 1]; if (!card) return; const ex = D.examples.find(x => x.id === b.ex); if (!ex) return;
        let svg = ''; try { svg = pathSvg(C.run(ex.src, { machine: ex.machine }), ex.machine); } catch (er) { svg = ''; }
        if (!svg) return; const th = document.createElement('div'); th.className = 'vz-th'; th.innerHTML = svg; const btns = card.querySelector('.btns'); card.insertBefore(th, btns);
      });
    }
    const box = document.createElement('div'); box.className = 'card pl vz-c'; mountLive(box, 'vzb', true); v.insertBefore(box, v.children[1] || null);
  }
  function decorateHelp(v) {
    if (v.querySelector('.vz-c') || !v.querySelector('details')) return; const det = document.createElement('details'); det.className = 'vz-c';
    det.innerHTML = '<summary>🎛 Live-Skizzen: Koordinaten, Kreise, Nullpunkt</summary><div class="hb2"></div>';
    v.insertBefore(det, v.children[1] || null); mountLive(det.querySelector('.hb2'), 'vzh', false);
  }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const start = () => {
      injectCss();
      const watch = (id, fn) => { const el = document.getElementById(id); if (!el) return; const run = () => { try { fn(el); } catch (e) {} }; new MutationObserver(run).observe(el, { childList: true }); run(); };
      watch('bspView', decorateBsp); watch('helpView', decorateHelp);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { coordSvg, arcSvg, arcGeom, g54Svg, turnSvg, pathSvg, gn };
  root.CNC_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
