'use strict';
/* Tonfunk Ladungssicherungs-Lab: Visualisierungen (Lab-Kennung 'lad'). Datei wird in ladlab.html NACH ladui.js geladen.
   ALLE Zurr-, Reib- und Mengenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis (wie im ganzen Lab).
   Reine Zeichenfunktionen (liefern SVG-Text, ohne DOM, testbar mit node quelle/lad/test_ladviz.js) plus ein kleiner Haken,
   der die Grafiken in die vorhandenen Reiter einfügt (MutationObserver, ladui.js bleibt unverändert):
     Kräfte & Zurren:   Kraftpfeile an der Ladung (Gewichtskraft, Massenkraft, Reibkraft, Zurrkraft), Kraftbilanz als Balken, Niederzurren-Skizze mit Zurrwinkel
     Stapeln & Kippen:  Neigungsmodell mit Lotlinie und Regler (Kippwinkel, Wirkung der Beschleunigung c)
     Ladefläche:        Ladungsschwerpunkt (Draufsicht) und Auslastung von Fläche und Gewicht
     Sicherungsarten:   Bildzeichen zu jedem Begriff (Formschluss, Niederzurren, Direktzurren, Ratsche, Matte, Kantenschutz, Luftkissen, Keil)
     Beispiele:         Kraftpfeile bei den Zurr-Beispielen
   Modell wie im Rechner: c · m · g = µ · m · g + Zurrkraft (vereinfacht, Zugrichtung gleich Kraftrichtung, kein Zurrwinkel beim Direktzurren).
   Aufgaben und Trainer bleiben unberührt (Verdeckte-Fehler-Prinzip: Aufgaben bekommen keine Grafik, die Ergebnisse zeigt).
   Farben nur über die CSS-Variablen der Seite, Bewegung nur bei prefers-reduced-motion: no-preference, kein Hover nötig. */
(function (root) {
  const C = root.LAD_CORE || (typeof require === 'function' ? require('./ladcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  function arrow(x1, y1, x2, y2, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 9, p1 = [x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)], p2 = [x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)];
    return `<g class="ar ${cls || ''}"><line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/><polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}"/></g>`;
  }

  /* ============================================================ Kräfte und Zurren */
  /* p: {m, mu, dir, LC, STF, alpha} als Zahlen. Liefert '' bei ungültigen Werten. */
  function krOk(p) { return !!p && p.m > 0 && p.mu >= 0 && p.mu <= 1.5 && C.DIRS.some(d => d.k === p.dir); }
  const DIRTXT = { v: 'Vollbremsung', s: 'Kurvenfahrt', r: 'Anfahren / Rückwärtsbewegung' };
  /* Seitenansicht der Ladung mit Kraftpfeilen. Die Pfeillängen zeigen das Verhältnis, nicht die Größe in N. */
  function krForceSvg(p) {
    if (!krOk(p)) return '';
    const d = C.dirOf(p.dir), c = d.c, sg = p.dir === 'v' ? -1 : 1, W = 420, H = 270, gy = 172, bw = 110, bh = 84, cx = 210, by = gy - 7 - bh;
    const share = Math.min(1, p.mu / c), slip = C.slips(c, p.mu), LEN = 108, lenFr = share * LEN, lenFs = (1 - share) * LEN, cgY = by + bh / 2, X = dx => cx + sg * dx;
    let s = R(12, gy, 396, 9, 'bed', 0) + T(14, 18, p.dir === 's' ? 'Ansicht von hinten' : 'Ansicht von der Seite', 's m');
    s += T(406, 18, DIRTXT[p.dir] + ' (c = ' + f(c, 1) + ')', 's b end');
    if (p.dir !== 's') s += arrow(396, 38, 346, 38, 'mu') + T(340, 42, 'Fahrtrichtung', 's m end');
    if (slip) s += `<rect class="ghost" x="${q(cx - bw / 2 + sg * 16)}" y="${q(by)}" width="${bw}" height="${bh}" rx="3"/>`;
    s += R(cx - bw / 2, by, bw, bh, 'load', 3) + R(cx - bw / 2 - 3, gy - 7, bw + 6, 3, 'pw') + R(cx - bw / 2 + 4, gy - 4, 10, 4, 'pw') + R(cx - 5, gy - 4, 10, 4, 'pw') + R(cx + bw / 2 - 14, gy - 4, 10, 4, 'pw');
    /* Zurrgurt an der Rückseite zum Zurrpunkt hinter der Ladung (nur wenn nötig) */
    const rear = cx - sg * bw / 2, post = cx - sg * (bw / 2 + 96), sy = by + bh * 0.28;
    s += R(post - 4, sy - 6, 8, gy - sy + 6, 'post', 1) + `<circle class="anchor" cx="${q(post)}" cy="${q(sy)}" r="4"/>`;
    s += `<line class="${lenFs > 0.5 ? 'strap' : 'strap slack'}" x1="${q(rear)}" y1="${q(sy)}" x2="${q(post)}" y2="${q(sy)}"/>`;
    s += T(post, gy + 24, 'Zurrpunkt', 's m mid');
    /* Gewichtskraft */
    s += `<circle class="cg" cx="${cx}" cy="${q(cgY)}" r="4.5"/>` + arrow(cx, cgY, cx, cgY + 46, 'g') + T(cx + 8, cgY + 44, 'Gewichtskraft', 's');
    /* Massenkraft am Schwerpunkt */
    s += arrow(cx, cgY, X(bw / 2 + 52), cgY, 'm');
    const tipX = X(bw / 2 + 52);
    s += T(tipX + sg * 6, cgY - 6, 'Massenkraft', 's b h' + (sg < 0 ? ' end' : ''), ' style="fill:var(--hi)"');
    /* Zurrkraft entlang des Gurtes (zieht die Ladung zum Zurrpunkt) */
    if (lenFs > 0.5) { s += arrow(rear, sy, rear - sg * lenFs, sy, 'z'); s += T(rear - sg * (lenFs / 2), sy - 10, 'Zurrkraft', 's b h mid', ' style="fill:var(--accent)"'); }
    else s += T((rear + post) / 2, sy - 10, 'Gurt nicht belastet', 's m mid');
    /* Reibkraft an der Aufstandsfläche, unter der Ladefläche gezeichnet */
    if (lenFr > 0.5) { s += arrow(cx, gy + 22, cx - sg * lenFr, gy + 22, 'r'); s += T(cx - sg * (lenFr / 2), gy + 40, 'Reibkraft', 's b h mid', ' style="fill:var(--ok)"'); }
    s += T(206, 258, slip ? 'µ < c: ohne Gurt rutscht die Ladung (gestrichelt).' : 'µ ≥ c: die Reibung hält die Ladung rechnerisch.', 's b mid');
    return svg(W, H, 'Seitenansicht der Ladung mit Gewichtskraft, Massenkraft, Reibkraft und Zurrkraft', s);
  }
  /* Kraftbilanz: Massenkraft gegen Reibung plus Zurrkraft (Anteile) */
  function krBalanceSvg(p) {
    if (!krOk(p)) return '';
    const c = C.dirOf(p.dir).c, W = 420, H = 150, x0 = 112, wMax = 296, ratio = p.mu / c, tot = Math.max(1, ratio), sc = wMax / tot;
    let s = T(x0 - 8, 41, 'Massenkraft', 's b end') + R(x0, 22, sc * 1, 30, 'bm', 0) + T(x0 + sc / 2, 42, '100 %', 's b mid dk');
    s += T(x0 - 8, 101, 'hält dagegen', 's b end');
    const fr = Math.min(1, ratio), fs = 1 - fr;
    s += R(x0, 82, sc * fr, 30, 'bf', 0);
    if (fr * sc > 54) s += T(x0 + sc * fr / 2, 102, 'Reibung ' + f(fr * 100, 0) + ' %', 's b mid dk');
    if (fs > 0.001) { s += R(x0 + sc * fr, 82, sc * fs, 30, 'bz', 0); if (fs * sc > 54) s += T(x0 + sc * fr + sc * fs / 2, 102, 'Zurrkraft ' + f(fs * 100, 0) + ' %', 's b mid dk'); }
    if (ratio > 1) { s += R(x0 + sc, 82, sc * (ratio - 1), 30, 'res', 0); s += T(x0 + sc + sc * (ratio - 1) / 2, 102, 'Reserve', 's m mid'); }
    s += L(x0 + sc, 14, x0 + sc, 122, 'dim');
    s += T(x0, 140, 'm · g · c = µ · m · g + Zurrkraft', 's m');
    return svg(W, H, 'Balken: Die Massenkraft wird durch Reibung und Zurrkraft aufgebracht', s);
  }
  /* Niederzurren: Gurt über der Ladung, Zurrwinkel α zur Ladefläche */
  function krDownSvg(p) {
    if (!krOk(p) || !(p.STF > 0) || !(p.alpha >= 1 && p.alpha <= 90)) return '';
    const W = 420, H = 236, gy = 176, bw = 100, bh = 62, cx = 210, by = gy - 7 - bh, ad = Math.max(25, p.alpha), al = ad * Math.PI / 180, dx = bh / Math.tan(al), xl = cx - bw / 2, xr = cx + bw / 2;
    const ax1 = xl - dx, ax2 = xr + dx;
    let s = R(12, gy, 396, 9, 'bed', 0);
    s += R(xl, by, bw, bh, 'load', 3) + R(xl - 3, gy - 7, bw + 6, 3, 'pw') + R(xl + 4, gy - 4, 10, 4, 'pw') + R(cx - 5, gy - 4, 10, 4, 'pw') + R(xr - 14, gy - 4, 10, 4, 'pw');
    s += `<polyline class="strap" points="${q(ax1)},${gy} ${q(xl)},${q(by)} ${q(xr)},${q(by)} ${q(ax2)},${gy}"/><circle class="anchor" cx="${q(ax1)}" cy="${gy}" r="4"/><circle class="anchor" cx="${q(ax2)}" cy="${gy}" r="4"/>`;
    s += R(cx - 14, by - 9, 28, 10, 'ratchet', 2) + T(cx, by - 16, 'Ratsche', 's m mid');
    s += arrow(cx - 22, by + 8, cx - 22, by + 46, 'z') + arrow(cx + 22, by + 8, cx + 22, by + 46, 'z') + T(cx, by + 30, 'drückt', 's b mid', ' style="fill:var(--accent)"');
    s += T(ax1, gy + 24, 'Zurrpunkt', 's m mid') + T(ax2, gy + 24, 'Zurrpunkt', 's m mid');
    const r = 30;
    s += `<path class="angle" d="M ${q(ax1 + r)} ${gy} A ${r} ${r} 0 0 0 ${q(ax1 + r * Math.cos(al))} ${q(gy - r * Math.sin(al))}"/>`;
    s += T(ax1 + r + 6, gy - 6, 'α = ' + f(p.alpha, 0) + '°', 's b h');
    s += T(206, 222, 'Je Gurtseite wirkt die Vorspannkraft STF, nach unten 2 · STF · sin α.', 's m mid');
    s += T(206, 24, 'Niederzurren: mehr Anpressung, mehr Reibung', 's b mid');
    if (p.alpha < 25) s += T(206, 40, '(Skizze ab 25° gezeichnet, nicht maßstäblich)', 's m mid');
    return svg(W, H, 'Niederzurren: Gurt über der Ladung mit Zurrwinkel, die Vorspannkraft presst die Ladung nach unten', s);
  }
  const krViz = p => { const a = krForceSvg(p); if (!a) return ''; const b = krBalanceSvg(p), c = krDownSvg(p); return `<div class="vzbox">${a}</div><div class="vzbox">${b}</div>` + (c ? `<h4 style="margin:14px 0 4px">Niederzurren im Bild</h4><div class="vzbox">${c}</div>` : ''); };

  /* ============================================================ Stapeln und Kippen: Neigungsmodell */
  /* p: {lagen, hl, d, dir}, theta in Grad (0 bis 60) */
  function stapGeom(p) {
    const H = C.palHeight(p.lagen, p.hl), hs = C.cgHeight(H), c = C.dirOf(p.dir).c;
    if (!(H > 0) || !(p.d > 0) || !fin(hs)) return null;
    return { H, hs, c, crit: C.tiltAngle(p.d, hs), eq: Math.atan(c) * 180 / Math.PI };
  }
  function tiltSvg(p, theta) {
    const g = stapGeom(p); if (!g || !fin(theta)) return '';
    const W = 420, H = 270, px = 290, py = 196, sc = Math.min(150 / g.H, 170 / p.d), bw = p.d * sc, bh = g.H * sc, pal = 144 * sc, th = theta * Math.PI / 180;
    const rel = [-bw / 2, -g.hs * sc], gx = px + rel[0] * Math.cos(th) - rel[1] * Math.sin(th), gyy = py + rel[0] * Math.sin(th) + rel[1] * Math.cos(th), tips = gx > px + 0.01;
    const col = tips ? 'var(--danger)' : 'var(--ok)';
    let s = L(14, py, 406, py, 'ref') + T(16, py - 6, 'waagerecht', 's m');
    s += `<g transform="rotate(${q(theta)} ${px} ${py})"><line class="floor" x1="${px - 270}" y1="${py}" x2="${px + 50}" y2="${py}"/>`;
    s += `<rect x="${q(px - bw)}" y="${q(py - bh)}" width="${q(bw)}" height="${q(bh)}" style="fill:${col};fill-opacity:.25;stroke:${col};stroke-width:2"/>`;
    s += `<rect class="palb" x="${q(px - bw)}" y="${q(py - pal)}" width="${q(bw)}" height="${q(pal)}"/></g>`;
    s += `<line class="lot" x1="${q(gx)}" y1="${q(gyy)}" x2="${q(gx)}" y2="${q(py + 40)}"/><circle class="cg" cx="${q(gx)}" cy="${q(gyy)}" r="5"/>`;
    s += `<circle class="pivot" cx="${px}" cy="${py}" r="5"/>` + T(px + 10, py + 22, 'Kippkante', 's m');
    s += T(14, py + 56, 'gestrichelt: Lot durch den Schwerpunkt', 's b', ' style="fill:' + col + '"');
    s += T(406, 20, 'Neigung ' + f(theta, 1) + '°', 's b end') + T(406, 38, tips ? 'Lot außerhalb der Kippkante: kippt' : 'Lot innerhalb der Kippkante: steht', 's b end', ' style="fill:' + col + '"');
    s += T(14, 20, 'Länge in Kraftrichtung ' + f(p.d, 0) + ' mm', 's m') + T(14, 38, 'Schwerpunkt in ' + f(g.hs, 0) + ' mm Höhe', 's m');
    return svg(W, H, 'Geneigte Ebene mit Ladeeinheit: Das Lot durch den Schwerpunkt zeigt, ob die Ladung kippt', s);
  }

  /* ============================================================ Ladefläche: Schwerpunkt und Auslastung */
  const NUTZ = 24000; /* PRUEFEN P16: Übungs-Nutzlast wie im Reiter Ladefläche */
  function ladeStats(placed, kg) {
    if (!Array.isArray(placed) || !placed.length) return null;
    const n = placed.length, cx = placed.reduce((s, a) => s + a.x + a.w / 2, 0) / n, cy = placed.reduce((s, a) => s + a.y + a.h / 2, 0) / n, st = C.loadStats(placed, null, kg);
    return { n, cx, cy, util: st.util, weight: st.weight };
  }
  function ladeCgSvg(placed, kg) {
    const st = ladeStats(placed, kg); if (!st) return '';
    const A = C.AREA, W = 420, H = 214, x0 = 14, w = 392, sc = w / A.L, ay = 34, ah = A.W * sc;
    let s = R(x0, ay, w, ah, 'bed2', 0);
    placed.forEach(a => { s += R(x0 + a.x * sc, ay + a.y * sc, a.w * sc, a.h * sc, 'palp', 0); });
    s += L(x0 + w / 2, ay - 8, x0 + w / 2, ay + ah + 8, 'midl');
    const mx = x0 + st.cx * sc, my = ay + st.cy * sc;
    s += `<g class="sp"><line x1="${q(mx - 7)}" y1="${q(my)}" x2="${q(mx + 7)}" y2="${q(my)}"/><line x1="${q(mx)}" y1="${q(my - 7)}" x2="${q(mx)}" y2="${q(my + 7)}"/><circle cx="${q(mx)}" cy="${q(my)}" r="5"/></g>`;
    s += T(x0, ay + ah + 24, '◀ Fahrerhaus', 's m') + T(x0 + w, ay + ah + 24, 'Heck', 's m end') + T(x0 + w / 2, ay + ah + 24, 'Mitte (gestrichelt)', 's m mid') + T(mx, ay - 12, 'Schwerpunkt der Ladung', 's b h mid', ' style="fill:var(--danger)"');
    /* Auslastung */
    const gauge = (y, txt, v, mx2, over) => T(x0, y, txt, 's b') + R(x0, y + 6, w, 12, 'gtr', 3) + R(x0, y + 6, w * Math.max(0, Math.min(1, v / mx2)), 12, over ? 'gbad' : 'gok', 3);
    s += gauge(ay + ah + 44, 'Fläche: ' + f(st.util, 1) + ' % der Ladefläche belegt', st.util, 100, false);
    if (fin(st.weight)) s += gauge(ay + ah + 78, 'Gewicht: ' + f(st.weight, 0) + ' von ' + f(NUTZ, 0) + ' kg (Übungswert)', st.weight, NUTZ, st.weight > NUTZ);
    return svg(W, H, 'Draufsicht der Ladefläche mit dem Schwerpunkt der Ladung und Auslastung von Fläche und Gewicht', s);
  }
  const ladeNote = (placed, st) => {
    if (!st) return '';
    const dev = (st.cx - C.AREA.L / 2) / 100, side = dev < 0 ? 'zum Fahrerhaus hin' : 'zum Heck hin';
    return `Der Schwerpunkt liegt ${f(Math.abs(dev), 1)} m ${Math.abs(dev) < 0.05 ? 'neben der Mitte' : side} von der Mitte der Ladefläche entfernt (alle Paletten gleich schwer angenommen). Ladung möglichst gleichmäßig und mittig verteilen.`;
  };

  /* ============================================================ Sicherungsarten: Bildzeichen */
  function artPic(name) {
    const W = 220, H = 100, gy = 78; let s = /^Zurrgurt/.test(name) ? '' : R(8, gy, 204, 6, 'bed', 0); const box = (x, w, h, cls) => R(x, gy - h, w, h, cls || 'load', 2);
    if (/^Formschluss/.test(name)) { s += R(8, gy - 52, 8, 52, 'post', 1) + box(16, 84, 50) + R(100, gy - 36, 26, 36, 'wood', 1) + R(98, gy - 6, 46, 6, 'wood', 1); s += arrow(190, 40, 150, 40, 'm') + T(110, 18, 'liegt lückenlos an', 's m mid'); }
    else if (/^Kraftschluss/.test(name)) { s += box(60, 86, 46) + `<polyline class="strap" points="48,${gy} 60,${gy - 46} 146,${gy - 46} 158,${gy}"/>` + arrow(88, gy - 40, 88, gy - 12, 'z') + arrow(118, gy - 40, 118, gy - 12, 'z'); s += T(110, 16, 'Anpressen: Reibung steigt', 's m mid'); }
    else if (/^Direktzurren/.test(name)) { s += box(36, 86, 46) + L(122, gy - 34, 190, gy - 34, 'strap') + `<circle class="anchor" cx="190" cy="${gy - 34}" r="4"/>` + R(186, gy - 34, 8, 34, 'post', 1); s += arrow(122, gy - 40, 150, gy - 40, 'z') + T(110, 16, 'Gurt hält direkt am Zurrpunkt', 's m mid'); }
    else if (/^Zurrgurt/.test(name)) { s += L(14, 48, 206, 48, 'strap') + R(88, 36, 44, 24, 'ratchet', 3) + `<circle class="hub2" cx="110" cy="48" r="7"/><circle class="hub2" cx="110" cy="48" r="2.4" style="fill:var(--fg)"/>` + `<path class="hook" d="M 14 48 q -8 0 -8 8 q 0 8 8 8"/><path class="hook" d="M 206 48 q 8 0 8 8 q 0 8 -8 8"/>`; s += T(110, 22, 'Gurtband mit Ratsche und Haken', 's m mid') + T(110, 88, 'Die Ratsche spannt den Gurt vor.', 's m mid'); }
    else if (/^Antirutschmatte/.test(name)) { s += box(56, 108, 46) + `<polyline class="mat" points="${Array.from({ length: 28 }, (_, i) => (40 + i * 5) + ',' + (gy - 2 - (i % 2) * 3)).join(' ')}"/>`; s += arrow(110, gy + 14, 70, gy + 14, 'r') + T(110, 20, 'Matte erhöht den Reibbeiwert µ', 's m mid'); }
    else if (/^Kantenschutz/.test(name)) { s += box(44, 100, 52) + R(40, gy - 56, 12, 4, 'wood', 1) + R(40, gy - 56, 4, 14, 'wood', 1) + `<polyline class="strap" points="30,${gy} 40,${gy - 58} 150,${gy - 58} 164,${gy}"/>`; s += T(110, 14, 'schützt Kante und Gurt', 's m mid'); }
    else if (/^Luftkissen/.test(name)) { s += R(8, gy - 46, 8, 46, 'post', 1) + box(16, 54, 44) + `<rect class="cushion" x="72" y="${gy - 40}" width="20" height="36" rx="9"/>` + box(104, 54, 44) + `<rect class="cushion" x="160" y="${gy - 40}" width="20" height="36" rx="9"/>` + R(186, gy - 46, 8, 46, 'post', 1); s += T(110, 16, 'Lücken füllen, damit nichts rutscht', 's m mid'); }
    else if (/^Kantholz/.test(name)) { s += box(30, 80, 46) + R(112, gy - 12, 34, 12, 'wood', 1) + `<polygon class="wood" points="146,${gy} 146,${gy - 18} 170,${gy}"/>`; s += T(110, 16, 'Holz oder Keil sperrt die Ladung', 's m mid'); }
    else return '';
    return svg(W, H, 'Bildzeichen: ' + name, s);
  }

  const API = { krOk, krForceSvg, krBalanceSvg, krDownSvg, krViz, stapGeom, tiltSvg, ladeStats, ladeCgSvg, ladeNote, artPic, NUTZ };
  root.LAD_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined' || !C) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = 'lm4.lad.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const P = C.parseDe;
  const CSS = `.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:640px;margin:8px auto}
.vzbox svg{display:block;width:100%;height:auto}
.vzbox svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.vzbox svg text.s{font-size:12px}.vzbox svg text.m{fill:var(--mute)}.vzbox svg text.b{font-weight:700}.vzbox svg text.mid{text-anchor:middle}.vzbox svg text.end{text-anchor:end}.vzbox svg text.dk{fill:#10151a}
.vzbox svg text.h{paint-order:stroke;stroke:var(--panel2);stroke-width:3px;stroke-linejoin:round}
.vzbox .bed{fill:var(--mute);fill-opacity:.55}.vzbox .bed2{fill:var(--panel);stroke:var(--mute);stroke-width:1.5}.vzbox .load{fill:var(--accent);fill-opacity:.4;stroke:var(--accent);stroke-width:1.6}.vzbox .load2{fill:var(--hi);fill-opacity:.45;stroke:var(--hi);stroke-width:1.6}
.vzbox .ghost{fill:none;stroke:var(--danger);stroke-width:2;stroke-dasharray:7 5}
.vzbox .pw{fill:var(--mute);fill-opacity:.8}.vzbox .post{fill:var(--mute);fill-opacity:.8}.vzbox .anchor{fill:var(--fg)}.vzbox .cg{fill:var(--fg);stroke:var(--panel2);stroke-width:1.5}
.vzbox .strap{fill:none;stroke:var(--accent);stroke-width:4;stroke-linejoin:round;stroke-linecap:round}.vzbox .strap.slack{stroke-dasharray:3 6;opacity:.6}
.vzbox .ratchet{fill:var(--panel);stroke:var(--accent);stroke-width:2}.vzbox .hub2{fill:var(--panel);stroke:var(--accent);stroke-width:2}.vzbox .hook{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round}
.vzbox .wood{fill:var(--hi);fill-opacity:.55;stroke:var(--hi);stroke-width:1.4}.vzbox .mat{fill:none;stroke:var(--ok);stroke-width:2.5;stroke-linejoin:round}.vzbox .cushion{fill:var(--ok);fill-opacity:.35;stroke:var(--ok);stroke-width:1.6}
.vzbox .ar{color:var(--fg)}.vzbox .ar line{stroke:currentColor;stroke-width:3;stroke-linecap:round}.vzbox .ar polygon{fill:currentColor}.vzbox .ar.g{color:var(--mute)}.vzbox .ar.m{color:var(--hi)}.vzbox .ar.z{color:var(--accent)}.vzbox .ar.r{color:var(--ok)}.vzbox .ar.mu{color:var(--mute)}
.vzbox .bm{fill:var(--hi)}.vzbox .bf{fill:var(--ok)}.vzbox .bz{fill:var(--accent)}.vzbox .res{fill:var(--ok);fill-opacity:.2;stroke:var(--ok);stroke-width:1.2;stroke-dasharray:4 3}.vzbox .dim{stroke:var(--fg);stroke-width:1.2;stroke-dasharray:3 3}
.vzbox .angle{fill:none;stroke:var(--fg);stroke-width:1.5}
.vzbox .ref{stroke:var(--mute);stroke-width:1;stroke-dasharray:4 4}.vzbox .floor{stroke:var(--mute);stroke-width:4}.vzbox .palb{fill:var(--hi);fill-opacity:.45}.vzbox .lot{stroke:var(--fg);stroke-width:1.6;stroke-dasharray:5 4}.vzbox .pivot{fill:var(--fg)}
.vzbox .palp{fill:var(--accent);fill-opacity:.45;stroke:var(--panel);stroke-width:1}.vzbox .midl{stroke:var(--mute);stroke-width:1.2;stroke-dasharray:5 4}.vzbox .sp line{stroke:var(--danger);stroke-width:2.5}.vzbox .sp circle{fill:none;stroke:var(--danger);stroke-width:2.5}
.vzbox .gtr{fill:var(--bg);stroke:var(--line);stroke-width:1}.vzbox .gok{fill:var(--ok);fill-opacity:.75}.vzbox .gbad{fill:var(--danger);fill-opacity:.8}
.vzcard h4{margin:0 0 8px}.vzctl{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.vzctl button{min-height:44px;padding:0 16px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);font-weight:600;color:var(--fg)}
.vzpic{max-width:260px;margin:4px 0 10px}.vzpic .vzbox{margin:0}
@media(prefers-reduced-motion:no-preference){.vzbox svg .ar.m,.vzbox svg .ar.z{animation:vzpulse 2.4s ease-in-out infinite}@keyframes vzpulse{0%,100%{opacity:1}50%{opacity:.6}}}`;
  const st = document.createElement('style'); st.id = 'ladviz-css'; st.textContent = CSS; document.head.appendChild(st);

  const V = { theta: 0 };
  const krState = () => Object.assign({ m: '10000', mid: 'holzn', mu: '0,3', dir: 'v', LC: '2000', STF: '400', alpha: '90' }, lsGet('kr', {}));
  const krParams = s => ({ m: P(s.m), mu: P(s.mu), dir: s.dir, LC: P(s.LC), STF: P(s.STF), alpha: P(s.alpha) });
  const stapState = () => Object.assign({ lagen: '5', hl: '200', room: '3000', d: '1200', dir: 'v' }, lsGet('stap', {}));
  const stapParams = s => ({ lagen: P(s.lagen), hl: P(s.hl), d: P(s.d), dir: s.dir });

  function hook(viewId, id, place, init, upd) {
    const view = $(viewId); if (!view) return;
    const ensure = () => {
      let card = document.getElementById(id);
      if (!card || !view.contains(card)) { card = document.createElement('div'); card.id = id; card.className = 'card pl vzcard'; init(card); place(view, card); }
      try { upd(card); } catch (e) {}
    };
    new MutationObserver(() => { const c = document.getElementById(id); if (!c || !view.contains(c)) ensure(); }).observe(view, { childList: true });
    ['input', 'change', 'click'].forEach(ev => view.addEventListener(ev, () => setTimeout(() => { const c = document.getElementById(id); if (c) { try { upd(c); } catch (e) {} } }, 0)));
    if (view.firstChild) ensure();
  }

  /* Kräfte und Zurren */
  hook('#krView', 'vzKr', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Die Kräfte im Bild</h4><div class="vzout"></div>'; },
    c => { const h = krViz(krParams(krState())); $('.vzout', c).innerHTML = h || '<p class="hint2">Gib eine Masse größer als 0 und einen Reibbeiwert zwischen 0 und 1,5 ein, dann erscheinen hier die Kraftpfeile.</p>'; });

  /* Stapeln und Kippen: Neigungsmodell */
  hook('#stapView', 'vzStap', (v, c) => v.appendChild(c),
    c => {
      c.innerHTML = '<h4>Neigungsmodell: Wann kippt die Ladeeinheit?</h4><div class="vzbox" data-vz="svg"></div><label class="f" style="margin-top:8px"><span>Ebene neigen: <b data-vz="val"></b>°</span><input type="range" data-vz="th" min="0" max="60" step="0.5" value="0"></label><div class="vzctl"><button data-vz="c">Wirkung der Beschleunigung c zeigen</button><button data-vz="z">Waagerecht</button></div><p class="hint2" data-vz="cap"></p>';
      $('[data-vz=th]', c).addEventListener('input', e => { V.theta = +e.target.value; updTilt(c); });
      c.addEventListener('click', e => {
        const b = e.target.closest('[data-vz=c]'), z = e.target.closest('[data-vz=z]'), g = stapGeom(stapParams(stapState()));
        if (b && g) { V.theta = Math.min(60, Math.round(g.eq * 2) / 2); updTilt(c); } else if (z) { V.theta = 0; updTilt(c); }
      });
    }, c => updTilt(c));
  function updTilt(c) {
    const p = stapParams(stapState()), g = stapGeom(p), sv = tiltSvg(p, V.theta);
    $('[data-vz=svg]', c).innerHTML = sv || '<p class="hint2" style="padding:12px">Gib Lagen, Lagenhöhe und Länge ein, dann erscheint das Neigungsmodell.</p>';
    $('[data-vz=th]', c).value = V.theta; $('[data-vz=val]', c).textContent = f(V.theta, 1);
    $('[data-vz=cap]', c).textContent = g ? `Die Ebene wird um die Kippkante gedreht. Die Ladeeinheit kippt, sobald das Lot durch den Schwerpunkt außerhalb der Kippkante liegt, bei ${f(g.crit, 1)}° (tan α = halbe Länge / Schwerpunkthöhe). Eine Beschleunigung c wirkt wie eine Neigung mit tan α = c: bei c = ${f(g.c, 1)} entspricht das ${f(g.eq, 1)}°. Vereinfachtes Modell ohne Zurrung und ohne Rutschen.` : '';
  }

  /* Ladefläche: Schwerpunkt und Auslastung */
  hook('#ladeView', 'vzLade', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Verteilung der Ladung</h4><div class="vzbox" data-vz="svg"></div><p class="hint2" data-vz="cap"></p>'; },
    c => { const s = lsGet('lade', { placed: [], kg: '700' }), placed = (s.placed || []).filter(a => a && ['x', 'y', 'w', 'h'].every(k => fin(a[k]))), kg = P(s.kg), svgT = ladeCgSvg(placed, kg); $('[data-vz=svg]', c).innerHTML = svgT || '<p class="hint2" style="padding:12px">Setze Paletten auf die Ladefläche, dann siehst du hier ihren Schwerpunkt.</p>'; $('[data-vz=cap]', c).textContent = ladeNote(placed, ladeStats(placed, kg)); });

  /* Sicherungsarten: Bildzeichen in den Begriffskarten */
  (function () {
    const view = $('#artView'); if (!view) return;
    const run = () => view.querySelectorAll('details').forEach(dt => {
      if (dt.querySelector('.vzpic')) return; const sm = dt.querySelector('summary'), body = dt.querySelector('.hb2'); if (!sm || !body) return;
      const pic = artPic(sm.textContent.trim()); if (!pic) return; const w = document.createElement('div'); w.className = 'vzpic'; w.innerHTML = '<div class="vzbox">' + pic + '</div>'; body.insertBefore(w, body.firstChild);
    });
    new MutationObserver(() => { if (!view.querySelector('.vzpic')) run(); }).observe(view, { childList: true });
    if (view.firstChild) run();
  })();

  /* Beispiele: Kraftpfeile bei den Zurr-Beispielen */
  (function () {
    const view = $('#bspView'), D = root.LAD_DATA; if (!view || !D || !D.examples) return;
    const run = () => D.examples.forEach(e => {
      if (e.tab !== 'kr') return; const card = document.getElementById('ex_' + e.id); if (!card || card.querySelector('.vzout')) return;
      const h = krViz(e.p); if (!h) return; const w = document.createElement('div'); w.className = 'vzout'; w.innerHTML = h; card.insertBefore(w, card.querySelector('.btns') || null);
    });
    new MutationObserver(() => { if (!view.querySelector('.vzout')) run(); }).observe(view, { childList: true });
    if (view.firstChild) run();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
