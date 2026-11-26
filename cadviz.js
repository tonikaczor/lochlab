'use strict';
/* Tonfunk 3D-Modellierungs-Lab: Grafiken (Lab-Kennung 'cad'). Wird in cadlab.html VOR cadui.js geladen; cadui.js ruft window.CAD_VIZ auf.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/cad/test_cadviz.js):
     sketchSvg    Skizze (Rechteck mit Kreis) mit Bedingungs-Zeichen, Maßen, Ursprung; Farbe nach Zustand (blau unterbestimmt, grün voll bestimmt, rot überbestimmt),
                  freie Bewegungsrichtungen als Pfeile (nur mit info)
     housingSvg   Gehäuse in Isometrie nach dem n-ten Feature (Skizze, Extrusion, Rundung, Schale, Bohrungen) mit Maßen
     boolSvg      Block und Zylinder als Eingang, Ergebnis der Vereinigung, Differenz oder Schnittmenge
     axesSvg      Koordinatensystem mit den drei Standardebenen
     printSvg     3D-Druck im Schnitt: Bauplatte, Schichten, Überhang mit Stützen, Düse
     pcbSvg       Platine im Gehäuse im Schnitt mit Spiel und Wandstärke
     taskImg      Bild zur Aufgabe aus q.img
   Bewegung nur per CSS und nur bei prefers-reduced-motion: no-preference. Jedes Bild ist ohne Bewegung vollständig. Farben: Variablen der Seite, die Körperfarben stehen im CSS unten (Hell und Dunkel). */
(function (root) {
  const C = root.CAD_CORE || (typeof require === 'function' ? require('./cadcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 1 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const RC = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const D = pts => 'M' + pts.map(p => q(p[0]) + ' ' + q(p[1])).join(' L') + ' Z';
  const svg = (W, H, label, body) => `<svg class="cdv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* Pfeil mit zwei Spitzen */
  function dar(x1, y1, x2, y2, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), hd = (x, y, an) => `<path class="hd" d="M${q(x)} ${q(y)} L${q(x - 7 * Math.cos(an - 0.4))} ${q(y - 7 * Math.sin(an - 0.4))} L${q(x - 7 * Math.cos(an + 0.4))} ${q(y - 7 * Math.sin(an + 0.4))} Z"/>`;
    return `<g class="${cls || 'dm'}">${L(x1, y1, x2, y2)}${hd(x2, y2, a)}${hd(x1, y1, a + Math.PI)}</g>`;
  }
  let uid = 0;

  /* ============================================================ Körper in Isometrie */
  const area = o => { let a = 0; o.forEach((p, i) => { const r = o[(i + 1) % o.length]; a += p[0] * r[1] - r[0] * p[1]; }); return a / 2; };
  const lvl = (nx, ny) => Math.max(0, Math.min(4, Math.round((nx - ny + 1) / 2 * 4)));
  /* Prisma über dem Umriss o von z0 bis z1: sichtbare Seiten (hinten zuerst), dann die Deckfläche. m = Werkstoff a oder b */
  function prism(o, z0, z1, cam, m) {
    const sg = area(o) > 0 ? 1 : -1, fa = [];
    o.forEach((p, i) => {
      const r = o[(i + 1) % o.length], dx = r[0] - p[0], dy = r[1] - p[1], len = Math.hypot(dx, dy) || 1, nx = sg * dy / len, ny = -sg * dx / len;
      if (nx + ny > 1e-6) fa.push({ d: p[0] + p[1] + r[0] + r[1], s: `<path class="f${m}${lvl(nx, ny)}" d="${D([C.iso(p[0], p[1], z0, cam), C.iso(r[0], r[1], z0, cam), C.iso(r[0], r[1], z1, cam), C.iso(p[0], p[1], z1, cam)])}"/>` });
    });
    return fa.sort((a, b) => a.d - b.d).map(x => x.s).join('') + `<path class="t${m}" d="${D(o.map(p => C.iso(p[0], p[1], z1, cam)))}"/>`;
  }
  /* Vertiefung im Umriss o (Öffnung bei zTop, Boden bei zBot): dunkle Öffnung, sichtbare Innenwände, Boden (wenn floor) und extra, alles in der Öffnung beschnitten */
  function cavity(o, zTop, zBot, cam, floor, extra) {
    const id = 'cdc' + (++uid), sg = area(o) > 0 ? 1 : -1, wa = [], open = D(o.map(p => C.iso(p[0], p[1], zTop, cam)));
    o.forEach((p, i) => {
      const r = o[(i + 1) % o.length], dx = r[0] - p[0], dy = r[1] - p[1], len = Math.hypot(dx, dy) || 1, nx = sg * dy / len, ny = -sg * dx / len;
      if (nx + ny < -1e-6) wa.push({ d: p[0] + p[1] + r[0] + r[1], s: `<path class="fc${lvl(-nx, -ny)}" d="${D([C.iso(p[0], p[1], zBot, cam), C.iso(r[0], r[1], zBot, cam), C.iso(r[0], r[1], zTop, cam), C.iso(p[0], p[1], zTop, cam)])}"/>` });
    });
    return `<clipPath id="${id}"><path d="${open}"/></clipPath><path class="hole" d="${open}"/><g clip-path="url(#${id})">${floor ? `<path class="tc" d="${D(o.map(p => C.iso(p[0], p[1], zBot, cam)))}"/>` : ''}${wa.sort((a, b) => a.d - b.d).map(x => x.s).join('')}${extra || ''}</g><path class="glow" d="${open}"/>`;
  }

  /* ============================================================ Gehäuse nach dem n-ten Feature */
  function housingSvg(p, step) {
    const W = 430, H = 350, c = 0.8660254, Lr = 100, Br = 70, Hr = 45;
    const s = Math.min((W - 60) / ((Lr + Br) * c), (H - 90) / ((Lr + Br) / 2 + Hr)), cam = { s, ox: W / 2 - (Lr - Br) * c / 2 * s, oy: H / 2 + 8 - ((Lr + Br) / 2 - Hr) / 2 * s };
    const I = (x, y, z) => C.iso(x, y, z, cam), lb = (pt, dx, dy, t, cls) => T(pt[0] + dx, pt[1] + dy, t, cls);
    const { L: Lx, B, H: Hz, t, r, d } = p, st = Math.max(0, Math.min(4, step));
    let b = `<path class="shadow" d="${D([I(-4, -4, 0), I(Lx + 6, -4, 0), I(Lx + 6, B + 6, 0), I(-4, B + 6, 0)])}"/>`;
    if (st === 0) {
      b += `<path class="plane" d="${D([I(-14, -14, 0), I(Lx + 14, -14, 0), I(Lx + 14, B + 14, 0), I(-14, B + 14, 0)])}"/><path class="skf" d="${D([I(0, 0, 0), I(Lx, 0, 0), I(Lx, B, 0), I(0, B, 0)])}"/>`;
      b += lb(I(Lx / 2, B + 12, 0), -4, 22, 'Skizze auf der XY-Ebene', 'b mid') ;
    } else {
      const out = C.rrect(0, 0, Lx, B, st >= 2 ? r : 0, 6);
      b += prism(out, 0, Hz, cam, 'a');
      if (st >= 3) {
        const holes = st >= 4 ? [[1, 1], [0, 1], [0, 0], [1, 0]].map(([a, e]) => { const e0 = t + 6; return `<path class="hole" d="${D(C.circle(a ? Lx - e0 : e0, e ? B - e0 : e0, d / 2, 18).map(pt => I(pt[0], pt[1], t)))}"/>`; }).join('') : '';
        b += cavity(C.rrect(t, t, Lx - t, B - t, Math.max(0, r - t), 6), Hz, t, cam, true, holes);
        b += lb(I(Lx - t / 2, B * 0.35, Hz), 16, -16, 'Wand t', 'sl') + L(...I(Lx - t / 2, B * 0.35, Hz), ...I(Lx - t / 2, B * 0.35, Hz).map((v, i) => v + (i ? -12 : 14)), 'lead');
      } else b += `<path class="glow" d="${D(out.map(pt => I(pt[0], pt[1], Hz)))}"/>`;
    }
    const pl = I(0, B, 0), pr = I(Lx, B, 0), pb = I(Lx, 0, 0);
    b += lb([(pl[0] + pr[0]) / 2, (pl[1] + pr[1]) / 2], -12, 18, 'L = ' + f(Lx, 0) + ' mm', 'sl end') + lb([(pr[0] + pb[0]) / 2, (pr[1] + pb[1]) / 2], 12, 18, 'B = ' + f(B, 0) + ' mm', 'sl');
    if (st >= 1) b += L(pl[0] - 8, pl[1], pl[0] - 8, I(0, B, Hz)[1], 'dm') + lb(I(0, B, Hz / 2), -12, 5, 'H = ' + f(Hz, 0), 'sl end');
    if (st >= 2) b += T(14, 24, st >= 4 ? 'Bohrungen Ø ' + f(d, 1) + ' mm' : st >= 3 ? 'Schale, Wand ' + f(t, 1) + ' mm' : 'Rundung r = ' + f(r, 1) + ' mm', 'b');
    else if (st === 1) b += T(14, 24, 'Extrusion um ' + f(Hz, 0) + ' mm', 'b');
    return svg(W, H, 'Gehäuse in Isometrie, Feature ' + (st + 1) + ' von 5', b);
  }

  /* ============================================================ Boolesche Operationen */
  const OPN = { union: 'Vereinigung (A + B)', diff: 'Differenz (A − B)', inter: 'Schnittmenge (A ∩ B)' };
  function boolSvg(o) {
    const W = 430, H = 310, Lx = 60, B = 40, Hc = 50, d = o.d, hb = o.hb, op = OPN[o.op] ? o.op : 'union', c = 0.8660254;
    const cam = { s: 2.1, ox: 305 - (Lx - B) * c / 2 * 2.1, oy: 180 }, cA = { s: 1, ox: 88 - (Lx - B) * c / 2, oy: 108 }, cB = { s: 1, ox: 88 - (Lx - B) * c / 2, oy: 252 };
    const blk = C.rrect(0, 0, Lx, B, 0, 1), cyl = C.circle(Lx / 2, B / 2, d / 2, 40);
    let b = T(12, 22, 'A: Block', 'sl b') + T(12, 42, Lx + ' × ' + B + ' × ' + f(hb, 0), 'sl') + prism(blk, 0, hb, cA, 'a') + T(12, 176, 'B: Zylinder', 'sl b') + T(12, 196, 'Ø ' + f(d, 0) + ' × ' + Hc, 'sl') + prism(cyl, 0, Hc, cB, 'b');
    b += L(176, 16, 176, 300, 'sep') + T(305, 24, 'Ergebnis', 'sl m mid') + T(305, 46, OPN[op], 'b mid');
    if (op === 'union') b += prism(blk, 0, hb, cam, 'a') + prism(cyl, hb, Hc, cam, 'a');
    else if (op === 'diff') b += prism(blk, 0, hb, cam, 'a') + cavity(cyl, hb, 0, cam, false, '');
    else b += prism(cyl, 0, hb, cam, 'a');
    return svg(W, H, 'Block A und Zylinder B, Ergebnis: ' + OPN[op], b);
  }

  /* ============================================================ Skizze */
  function sketchSvg(o) {
    const on = new Set(o.on || []), st = C.sketchState(o.on || []), plain = !o.info, k = 3.2, X0 = 74, Y0 = 250, w = 80, h = 50, S = (x, y) => [X0 + x * k, Y0 - y * k];
    let pts = [[0, 0], [w, 0], [w, h], [0, h]];
    if (!on.has('h')) { pts[1][1] += 5; pts[2][1] -= 4; }
    if (!on.has('v')) { pts[2][0] += 6; pts[3][0] += 1; }
    const sh = on.has('o') ? [0, 0] : [7, 6], ps = pts.map(p => S(p[0] + sh[0], p[1] + sh[1])), cm = on.has('m') ? [40, 25] : [31, 31];
    const cc = S(cm[0] + sh[0], cm[1] + sh[1]), cr = 10 * k, cls = plain ? 'sku' : 's-' + st.status;
    const bdg = (x, y, t) => `<g class="bdg">${RC(x - 12, y - 13, 24, 24, 'bx', 5)}${T(x, y + 6, t, 'bt mid')}</g>`, mid = (a, b2) => [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2];
    let b = L(X0, Y0, X0 + 52, Y0, 'ax') + L(X0, Y0, X0, Y0 - 52, 'ax') + T(X0 + 56, Y0 + 5, 'X', 'sl m') + T(X0 - 4, Y0 - 58, 'Y', 'sl m mid') + `<circle class="org" cx="${X0}" cy="${Y0}" r="4"/>` + T(X0 - 8, Y0 + 20, 'Ursprung', 'sl m end');
    b += `<path class="skf ${cls}" d="${D(ps)}"/><circle class="skc ${cls}" cx="${q(cc[0])}" cy="${q(cc[1])}" r="${q(cr)}"/>`;
    if (on.has('h')) { const m1 = mid(ps[0], ps[1]), m2 = mid(ps[2], ps[3]); b += bdg(m1[0], m1[1] - 18, 'H') + bdg(m2[0], m2[1] + 18, 'H'); }
    if (on.has('v')) { const m1 = mid(ps[1], ps[2]), m2 = mid(ps[3], ps[0]); b += bdg(m1[0] - 18, m1[1], 'V') + bdg(m2[0] + 18, m2[1], 'V'); }
    if (on.has('o')) b += bdg(X0 - 22, Y0 - 20, 'F');
    if (on.has('m')) b += bdg(cc[0], cc[1], 'S');
    if (on.has('g')) b += bdg(ps[3][0] + 24, ps[3][1] + 24, '=');
    if (on.has('w')) { const y = Y0 + 34; b += L(ps[0][0], ps[0][1] + 4, ps[0][0], y + 6, 'ext') + L(ps[1][0], ps[1][1] + 4, ps[1][0], y + 6, 'ext') + dar(ps[0][0], y, ps[1][0], y) + T((ps[0][0] + ps[1][0]) / 2, y - 6, f(w, 0), 'sl mid b'); }
    if (on.has('hh')) { const x = Math.max(ps[1][0], ps[2][0]) + 34; b += L(ps[1][0] + 4, ps[1][1], x + 6, ps[1][1], 'ext') + L(ps[2][0] + 4, ps[2][1], x + 6, ps[2][1], 'ext') + dar(x, ps[1][1], x, ps[2][1]) + T(x + 8, (ps[1][1] + ps[2][1]) / 2 + 5, f(h, 0), 'sl b'); }
    if (on.has('dk')) { const a = Math.PI / 4; b += dar(cc[0] - cr * Math.cos(a), cc[1] + cr * Math.sin(a), cc[0] + cr * Math.cos(a), cc[1] - cr * Math.sin(a)) + T(cc[0] + cr + 8, cc[1] - cr + 2, 'Ø ' + f(20, 0), 'sl b'); }
    if (!plain) {
      b += T(14, 24, 'Freiheitsgrade: ' + st.dof, 'b big') + T(14, 46, { unter: 'unterbestimmt (blau)', voll: 'voll bestimmt (grün)', over: 'überbestimmt (rot)' }[st.status], 'sl ' + cls);
      let fr = '';
      if (!on.has('w')) fr += dar(ps[1][0] - 15, mid(ps[1], ps[2])[1], ps[1][0] + 15, mid(ps[1], ps[2])[1], 'dm');
      if (!on.has('hh')) fr += dar(mid(ps[2], ps[3])[0], ps[2][1] - 15, mid(ps[2], ps[3])[0], ps[2][1] + 15, 'dm');
      if (!on.has('o')) fr += dar(ps[0][0] - 20, ps[0][1] - 8, ps[0][0] - 4, ps[0][1] - 8, 'dm') + dar(ps[0][0] + 8, ps[0][1] + 4, ps[0][0] + 8, ps[0][1] + 20, 'dm');
      if (!on.has('h') || !on.has('v')) fr += `<path class="dm arc" d="M${q(ps[3][0] - 22)} ${q(ps[3][1] + 4)} A18 18 0 0 1 ${q(ps[3][0] - 4)} ${q(ps[3][1] - 16)}"/>` + dar(ps[3][0] - 4, ps[3][1] - 16, ps[3][0] + 1, ps[3][1] - 19, 'dm');
      if (!on.has('m')) fr += dar(cc[0] - 10, cc[1], cc[0] + 10, cc[1], 'dm') + dar(cc[0], cc[1] - 10, cc[0], cc[1] + 10, 'dm');
      if (!on.has('dk')) fr += dar(cc[0] + cr - 9, cc[1] + 2, cc[0] + cr + 9, cc[1] + 2, 'dm');
      if (fr) b += `<g class="free">${fr}</g>`;
    }
    return svg(440, 300, 'Skizze: Rechteck mit Kreis' + (plain ? '' : ', ' + st.dof + ' Freiheitsgrade'), b);
  }

  /* ============================================================ Koordinatensystem */
  function axesSvg() {
    const cam = { s: 1.35, ox: 220, oy: 176 }, I = (x, y, z) => C.iso(x, y, z, cam), pl = (a, cls) => `<path class="${cls}" d="${D(a.map(p => I(...p)))}"/>`;
    let b = pl([[0, 0, 0], [80, 0, 0], [80, 80, 0], [0, 80, 0]], 'pl1') + pl([[0, 0, 0], [80, 0, 0], [80, 0, 70], [0, 0, 70]], 'pl2') + pl([[0, 0, 0], [0, 80, 0], [0, 80, 70], [0, 0, 70]], 'pl3');
    b += L(...I(0, 0, 0), ...I(112, 0, 0), 'ax2') + L(...I(0, 0, 0), ...I(0, 112, 0), 'ax2') + L(...I(0, 0, 0), ...I(0, 0, 92), 'ax2');
    const at = (x, y, z, dx, dy, t, cls) => T(I(x, y, z)[0] + dx, I(x, y, z)[1] + dy, t, cls);
    b += at(112, 0, 0, 8, 10, 'X', 'b') + at(0, 112, 0, -16, 12, 'Y', 'b') + at(0, 0, 92, 0, -8, 'Z', 'b mid');
    b += at(42, 46, 0, 0, 5, 'XY (Draufsicht)', 'sl mid c1') + at(44, 0, 38, -22, 4, 'XZ (Vorderansicht)', 'sl c2') + at(0, 40, 38, 22, 4, 'YZ (Seitenansicht)', 'sl end c3');
    b += `<circle class="org" cx="${q(I(0, 0, 0)[0])}" cy="${q(I(0, 0, 0)[1])}" r="5"/>` + at(0, 0, 0, 12, 22, 'Ursprung (0, 0, 0)', 'sl');
    return svg(440, 300, 'Koordinatensystem mit XY-, XZ- und YZ-Ebene, Z zeigt nach oben', b);
  }

  /* ============================================================ 3D-Druck im Schnitt */
  function printSvg() {
    let b = RC(30, 238, 380, 14, 'bed', 3) + T(220, 270, 'Bauplatte', 'sl mid m');
    b += RC(130, 100, 70, 138, 'part') + RC(200, 100, 130, 28, 'part') + `<path class="sup" d="M200 128 L330 128 L330 238 L200 238 Z"/>`;
    for (let y = 108; y < 238; y += 12) b += L(130, y, 200, y, 'lay');
    for (let y = 108; y < 128; y += 12) b += L(200, y, 330, y, 'lay');
    b += `<g class="noz"><path class="nz" d="M-9 -22 L9 -22 L0 -4 Z"/>${L(0, -4, 0, 0, 'lay')}</g>`;
    b += T(352, 92, 'Überhang', 'sl b') + L(346, 98, 330, 112, 'lead') + T(344, 190, 'Stützen', 'sl b') + L(340, 186, 300, 176, 'lead') + T(14, 160, 'Schichten', 'sl b') + L(100, 156, 130, 148, 'lead') + T(256, 50, 'Düse', 'sl b');
    return svg(440, 290, 'Schnitt durch einen 3D-Druck: Bauplatte, Schichten, Überhang mit Stützen', b);
  }

  /* ============================================================ Platine im Gehäuse */
  function pcbSvg() {
    let b = RC(60, 50, 320, 150, 'bodyw', 6) + RC(80, 50, 280, 130, 'cav') + RC(110, 168, 12, 12, 'post') + RC(318, 168, 12, 12, 'post') + RC(96, 156, 248, 12, 'board', 2);
    b += dar(60, 120, 80, 120, 'dm') + T(70, 114, 't', 'sl b mid') + dar(80, 140, 96, 140, 'dm') + T(88, 134, 's', 'sl b mid') + dar(96, 100, 344, 100, 'dm') + T(220, 94, 'Platine P', 'sl b mid');
    b += dar(80, 36, 360, 36, 'dm') + T(220, 28, 'Innenmaß = P + 2 · s', 'sl b mid') + dar(60, 222, 380, 222, 'dm') + T(220, 244, 'Außenmaß = P + 2 · s + 2 · t', 'sl b mid');
    return svg(440, 260, 'Querschnitt: Platine im Gehäuse mit Spiel s und Wandstärke t', b);
  }

  function taskImg(img) {
    if (!img || !img.k) return '';
    if (img.k === 'axes') return axesSvg();
    if (img.k === 'sketch') return sketchSvg({ on: img.on || [], info: false });
    if (img.k === 'feat') return housingSvg(img.p, img.step == null ? 4 : img.step);
    if (img.k === 'bool') return boolSvg(img);
    if (img.k === 'print') return printSvg();
    if (img.k === 'pcb') return pcbSvg();
    return '';
  }

  /* Körperfarben: Stufe 0 (Fläche zeigt nach +Y) bis 4 (zeigt nach +X) */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), mixc = (a, b2, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b2)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const PAL = {
    dark: { a: ['#86b9ff', '#2f5f9f', '#4f8fe0'], b: ['#ffc27d', '#b8661a', '#e8913a'], c: ['#4a7bbf', '#213f66', '#2f5688'], hole: '#0b1016', pl1: '#3b9eff', pl2: '#4cd964', pl3: '#ff9f1c' },
    light: { a: ['#a9ceff', '#3c78c8', '#6aa5f2'], b: ['#ffd29c', '#c57a22', '#f19d45'], c: ['#86aee0', '#4a76b0', '#6a96cf'], hole: '#1b2733', pl1: '#0a4fb3', pl2: '#107a3f', pl3: '#c25e00' }
  };
  const rules = (pre, P) => ['a', 'b', 'c'].map(m => `${pre}.cdv .t${m}{fill:${P[m][0]}}` + [0, 1, 2, 3, 4].map(i => `${pre}.cdv .f${m}${i}{fill:${mixc(P[m][1], P[m][2], i / 4)}}`).join('')).join('') + `${pre}.cdv .hole{fill:${P.hole}}${pre}.cdv .c1{fill:${P.pl1}}${pre}.cdv .c2{fill:${P.pl2}}${pre}.cdv .c3{fill:${P.pl3}}${pre}.cdv .pl1{fill:${P.pl1}}${pre}.cdv .pl2{fill:${P.pl2}}${pre}.cdv .pl3{fill:${P.pl3}}`;
  const CSS = `.cdv{display:block;width:100%;height:auto}.cdv text{font-family:system-ui,sans-serif;font-size:16px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.cdv .sl{font-size:16px}.cdv .b{font-weight:700}.cdv .big{font-size:20px}.cdv .mid{text-anchor:middle}.cdv .end{text-anchor:end}.cdv .m{fill:var(--mute)}
.cdv .ta,.cdv .tb,.cdv .tc,.cdv .fa0,.cdv .fa1,.cdv .fa2,.cdv .fa3,.cdv .fa4,.cdv .fb0,.cdv .fb1,.cdv .fb2,.cdv .fb3,.cdv .fb4,.cdv .fc0,.cdv .fc1,.cdv .fc2,.cdv .fc3,.cdv .fc4{stroke:var(--fg);stroke-opacity:.5;stroke-width:1;stroke-linejoin:round}
.cdv .shadow{fill:#000;opacity:.16}.cdv .plane{fill:var(--accent);fill-opacity:.07;stroke:var(--mute);stroke-width:1}.cdv .skf{fill:var(--accent);fill-opacity:.14;stroke:var(--accent);stroke-width:2.6;stroke-dasharray:7 4;stroke-linejoin:round}
.cdv .glow{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-opacity:.85;stroke-linejoin:round}
.cdv .dm{stroke:var(--fg);stroke-width:1.5;fill:none}.cdv .hd{fill:var(--fg);stroke:none}.cdv .ext,.cdv .lead,.cdv .sep{stroke:var(--mute);stroke-width:1.2;fill:none}.cdv .ax,.cdv .ax2{stroke:var(--mute);stroke-width:2;fill:none}.cdv .ax2{stroke:var(--fg);stroke-width:2.2}
.cdv .org{fill:var(--fg)}
.cdv .skf.sku,.cdv .skc.sku{stroke:var(--accent);fill-opacity:.12;stroke-dasharray:none}.cdv .skf.s-unter,.cdv .skc.s-unter{stroke:var(--accent);fill:var(--accent);stroke-dasharray:none}
.cdv .skf.s-voll,.cdv .skc.s-voll{stroke:var(--ok);fill:var(--ok);stroke-dasharray:none}.cdv .skf.s-over,.cdv .skc.s-over{stroke:var(--danger);fill:var(--danger);stroke-dasharray:none}
.cdv .skc{fill-opacity:.2;stroke-width:2.6}.cdv .skf.s-unter,.cdv .skf.s-voll,.cdv .skf.s-over{fill-opacity:.12}
.cdv text.s-unter{fill:var(--accent)}.cdv text.s-voll{fill:var(--ok)}.cdv text.s-over{fill:var(--danger)}
.cdv .bx{fill:var(--panel);stroke:var(--fg);stroke-width:1.3}.cdv .bt{font-size:16px;font-weight:700}.cdv .free .dm{stroke:var(--hi)}.cdv .free .hd{fill:var(--hi)}
.cdv .pl1,.cdv .pl2,.cdv .pl3{fill-opacity:.22;stroke:var(--fg);stroke-opacity:.4;stroke-width:1}
.cdv .bed{fill:var(--mute);stroke:var(--fg);stroke-opacity:.5}.cdv .part{fill:var(--accent);fill-opacity:.55;stroke:var(--fg);stroke-opacity:.6;stroke-width:1.4}.cdv .lay{stroke:var(--fg);stroke-opacity:.35;stroke-width:1}
.cdv .sup{fill:var(--hi);fill-opacity:.18;stroke:var(--hi);stroke-width:1.5;stroke-dasharray:5 4}.cdv .nz{fill:var(--hi);stroke:var(--fg);stroke-opacity:.6}.cdv .noz{transform:translate(272px,100px)}
.cdv .bodyw{fill:var(--accent);fill-opacity:.55;stroke:var(--fg);stroke-opacity:.6;stroke-width:1.4}.cdv .cav{fill:var(--panel)}.cdv .post{fill:var(--accent);fill-opacity:.55;stroke:var(--fg);stroke-opacity:.5}.cdv .board{fill:var(--ok);stroke:var(--fg);stroke-opacity:.6}
.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:520px;margin:8px auto}
@media(prefers-reduced-motion:no-preference){
.cdv .glow{animation:cdGlow 3.2s ease-in-out infinite}@keyframes cdGlow{50%{stroke-opacity:.3}}
.cdv .free{animation:cdFree 2.2s ease-in-out infinite}@keyframes cdFree{50%{opacity:.45}}
.cdv .noz{animation:cdNoz 4s ease-in-out infinite alternate}@keyframes cdNoz{from{transform:translate(150px,100px)}to{transform:translate(312px,100px)}}
.cdv .org{animation:cdOrg 2.6s ease-in-out infinite}@keyframes cdOrg{50%{opacity:.35}}}`;
  const ALLCSS = CSS + rules('', PAL.dark) + '@media(prefers-color-scheme:light){' + rules(':root:not([data-theme=dark]) ', PAL.light) + '}' + rules(':root[data-theme=light] ', PAL.light);

  const API = { prism, cavity, housingSvg, boolSvg, sketchSvg, axesSvg, printSvg, pcbSvg, taskImg, OPN, CSS: ALLCSS };
  root.CAD_VIZ = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('cadviz-css')) { try { const st = document.createElement('style'); st.id = 'cadviz-css'; st.textContent = ALLCSS; document.head.appendChild(st); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
