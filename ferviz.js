'use strict';
/* Tonfunk Fertigungs-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei ferviz.js, eingebunden VOR ferui.js.
   Alle Funktionen liefern SVG-Text (für Oberfläche und Tests). Farben nur über CSS-Variablen (Hell/Dunkel), Bewegung nur über CSS und bei prefers-reduced-motion aus.
   Verdeckte-Fehler-Prinzip: Mit vals = false zeigen die Skizzen nur Buchstaben und Zusammenhänge, keine Zahlen und nie das Ergebnis einer Aufgabe.
   1) landkarte   Fertigungsverfahren nach DIN 8580 (sechs Hauptgruppen zum Antippen)
   2) biegeteil   Biegeteil mit neutraler Faser und gestreckter Länge (Abwicklung)
   3) gewinde     Gewinde im Schnitt mit Kernloch;  schraube: Durchgangsloch
   4) stange, tafel, nest   Zuschnitt aus Stange und Schachtelung auf der Blechtafel mit Ausnutzung
   5) glocke, histogramm, regelkarte   Streuung mit Toleranzgrenzen, Häufigkeit, Qualitätsregelkarte
   6) kostenkurve, vergleich   Kosten je Stück über der Losgröße, zwei Verfahren im Vergleich
   7) block       Werkstück mit 3-2-1-Auflagepunkten und Freiheitsgrad-Leiste
   ALLE Werte sind ÜBUNGSWERTE für die Ausbildung. window.FER_VIZ bzw. module.exports. */
(function (root) {
  const C = root.FER_CORE || (typeof require !== 'undefined' ? require('./fercore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const N = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const svg = (w, h, label, body, defs) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  const T = (x, y, t, cls, extra) => `<text class="vz-t ${cls || ''}" x="${N(x)}" y="${N(y)}"${extra || ''}>${esc(t)}</text>`;
  const TM = (x, y, t, cls) => T(x, y, t, cls, ' text-anchor="middle"');
  const TE = (x, y, t, cls) => T(x, y, t, cls, ' text-anchor="end"');
  const line = (x1, y1, x2, y2, st, extra) => `<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}" style="${st}"${extra || ''}/>`;
  const rect = (x, y, w, h, st, extra) => `<rect x="${N(x)}" y="${N(y)}" width="${N(Math.max(0, w))}" height="${N(Math.max(0, h))}" style="${st}"${extra || ''}/>`;
  const poly = (pts, st) => `<polygon points="${pts.map(p => N(p[0]) + ',' + N(p[1])).join(' ')}" style="${st}"/>`;
  const msg = (t, w) => svg(w || 360, 44, 'Hinweis', TM((w || 360) / 2, 26, t, 'm'));
  const NF = 'fill:none;', STK = c => 'stroke:var(--' + c + ');';

  /* ============================================================ 1) Landkarte der Fertigungsverfahren */
  const GICON = {
    1: '<path d="M2 8h16l-3 12H5z M10 0v5"/><circle cx="10" cy="26" r="2"/>',
    2: '<path d="M3 2v18h20"/><path d="M3 20q0-6 6-6h6"/>',
    3: '<path d="M1 18l4-12 4 12 4-12 4 12 4-12"/>',
    4: '<rect x="1" y="4" width="10" height="16"/><rect x="13" y="4" width="10" height="16"/><path d="M11 12h2"/>',
    5: '<rect x="2" y="12" width="22" height="10"/><path d="M2 8h22"/>',
    6: '<path d="M6 22q-4-5 0-9t0-9M13 22q-4-5 0-9t0-9M20 22q-4-5 0-9t0-9"/>'
  };
  function landkarte(sel, o) {
    o = o || {}; const G = C.GROUPS, tw = 170, th = 94, gx = 10, gy = 10; let b = '';
    G.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 8 + col * (tw + gx), y = 8 + row * (th + gy), on = sel === g.n, c = 'c' + g.col;
      b += `<g class="vz-tile" data-g="${g.n}" role="button" tabindex="0" aria-pressed="${on ? 'true' : 'false'}" aria-label="Hauptgruppe ${g.n}: ${esc(g.t)}">`
        + rect(x, y, tw, th, `fill:var(--${c});fill-opacity:${on ? '.5' : '.2'};stroke:var(--${c});stroke-width:${on ? '4' : '2'};`, ' rx="12"')
        + `<circle cx="${N(x + 24)}" cy="${N(y + 26)}" r="15" style="fill:var(--${c});"/>` + T(x + 24, y + 32, String(g.n), 'vz-num', ' text-anchor="middle"')
        + T(x + 46, y + 31, g.t.length > 14 ? 'Stoffeigenschaft' : g.t, 'vz-b' + (g.t.length > 14 ? ' vz-s' : ''))
        + (g.t.length > 14 ? T(x + 46, y + 45, 'ändern', 'vz-b vz-s') : '')
        + (o.plain ? '' : T(x + 14, y + 76, g.z, 'vz-m'))
        + `<g transform="translate(${N(x + tw - 40)},${N(y + 54)}) scale(1.1)" style="fill:none;stroke:var(--fg);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;">${GICON[g.n]}</g>`
        + `</g>`;
    });
    return svg(360, 8 + 3 * th + 2 * gy + 8, 'Landkarte der sechs Hauptgruppen der Fertigungsverfahren nach DIN 8580', b);
  }

  /* ============================================================ 2) Biegeteil mit neutraler Faser und Abwicklung */
  /* Geometrie per Schildkröte: heading in Grad (math, y nach oben), Segmente { t:'s', l } gerade, { t:'b', a } Biegung links um a Grad mit Radius rho (neutrale Faser) */
  function turtle(segs, rho, h0) {
    let x = 0, y = 0, h = h0 || 0; const pts = [[x, y]], cmds = [{ c: 'M', x, y }], rad = d => d * Math.PI / 180;
    segs.forEach(sg => {
      if (sg.t === 's') { x += sg.l * Math.cos(rad(h)); y += sg.l * Math.sin(rad(h)); pts.push([x, y]); cmds.push({ c: 'L', x, y }); }
      else {
        const cx = x - rho * Math.sin(rad(h)), cy = y + rho * Math.cos(rad(h));
        for (let k = 1; k <= 12; k++) { const a = h + sg.a * k / 12; pts.push([cx + rho * Math.sin(rad(a)), cy - rho * Math.cos(rad(a))]); }
        h += sg.a; x = cx + rho * Math.sin(rad(h)); y = cy - rho * Math.cos(rad(h)); cmds.push({ c: 'A', x, y, big: sg.a > 180 ? 1 : 0 });
      }
    });
    return { pts, cmds };
  }
  function biegeteil(o) {
    o = o || {}; const s = o.s, r = o.r, vals = !!o.vals;
    if (!(s > 0) || !(r >= 0)) return msg('Bitte Blechdicke und Radius angeben.');
    let segs, label = '', tips = null; const rho = r + s / 2;
    if (o.mode === 'bogen') { segs = [{ t: 's', l: 25 }, { t: 'b', a: o.a }, { t: 's', l: 25 }]; label = 'Biegung um ' + (vals ? f(o.a, 0) + '°' : 'α'); }
    else if (o.mode === 'gerade') { segs = [{ t: 's', l: o.l1 }, { t: 'b', a: o.al }, { t: 's', l: o.l2 }]; label = 'zwei gerade Schenkel und ein Bogen'; tips = ['l₁', 'l₂']; }
    else {
      const dims = o.dims && o.dims.length >= 2 ? o.dims : (o.n === 3 ? [40, 60, 40] : [60, 40]);
      if (!C.bendOk(dims, r, s)) return msg('Die Schenkel sind zu kurz für diesen Radius.');
      const parts = C.bendParts(dims, r, s);
      segs = parts.map(p => p.t === 's' ? { t: 's', l: Math.max(p.l, 0) } : { t: 'b', a: 90 });
      tips = dims.length === 3 ? ['a', 'c'] : ['a', 'b']; label = dims.length === 3 ? 'U-Profil, zwei Biegungen zu 90°' : 'Winkel, eine Biegung zu 90°';
    }
    const h0 = o.mode === 'out' || !o.mode ? -90 : 0, tr = turtle(segs, rho, h0);
    if (!tr.pts.every(p => fin(p[0]) && fin(p[1]))) return msg('Die Zeichnung ist mit diesen Werten nicht möglich.');
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; tr.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    const AW = 300, AH = 150, bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1), sc = Math.min(AW / bw, AH / bh, 6), ox = 30 + (AW - bw * sc) / 2 - x0 * sc, oy = 14 + (AH + bh * sc) / 2 + y0 * sc;
    const X = x => ox + x * sc, Y = y => oy - y * sc;
    let d = ''; tr.cmds.forEach(c => { d += c.c === 'A' ? `A${N(rho * sc)} ${N(rho * sc)} 0 ${c.big} 0 ${N(X(c.x))} ${N(Y(c.y))} ` : `${c.c}${N(X(c.x))} ${N(Y(c.y))} `; });
    let b = `<path d="${d}" style="fill:none;stroke:var(--accent);stroke-opacity:.55;stroke-width:${N(Math.max(s * sc, 4))};stroke-linejoin:round;"/>`
      + `<path d="${d}" class="vz-draw" pathLength="1" style="fill:none;stroke:var(--fg);stroke-width:1.4;stroke-dasharray:4 3;"/>`;
    if (tips) { const p0 = tr.pts[0], p1 = tr.pts[tr.pts.length - 1]; b += TM(X(p0[0]) + (o.mode === 'gerade' ? 0 : 14), Y(p0[1]) + (o.mode === 'gerade' ? 16 : 0), tips[0], 'vz-b') + TM(X(p1[0]) + 14, Y(p1[1]) - 6, tips[1], 'vz-b'); }
    b += T(10, 188, label + ' · gestrichelt: neutrale Faser', 'vz-m');
    b += T(10, 204, vals ? 's = ' + f(s, 1) + ' mm, r = ' + f(r, 1) + ' mm (innen)' : 's = Blechdicke, r = Innenradius', 'vz-m');
    /* Abwicklung: gerade Teile und Bögen maßstäblich nebeneinander */
    const parts = segs.map(sg => ({ t: sg.t, l: sg.t === 's' ? sg.l : C.arc(r, s, sg.a) })), tot = parts.reduce((a, p) => a + p.l, 0);
    if (!(tot > 0)) return msg('Keine Abwicklung möglich.');
    const ws = 320, y = 232; let x = 20;
    b += T(10, 222, 'Abgewickelt (gestreckte Länge)', 'vz-m');
    parts.forEach(p => { const w = p.l / tot * ws; b += rect(x, y, w, 26, `fill:var(--${p.t === 's' ? 'accent' : 'hi'});fill-opacity:.45;stroke:var(--${p.t === 's' ? 'accent' : 'hi'});stroke-width:1.5;`); if (vals && w > 34) b += TM(x + w / 2, y + 17, f(p.l, 1), ''); x += w; });
    b += line(20, 272, 340, 272, STK('mute') + 'stroke-width:1.5;') + line(20, 266, 20, 278, STK('mute')) + line(340, 266, 340, 278, STK('mute'));
    b += TM(180, 290, vals ? 'L = ' + f(tot, 1) + ' mm' : 'gestreckte Länge L', 'vz-b');
    b += T(10, 308, 'blau: gerader Teil · orange: Bogen der neutralen Faser', 'vz-m');
    return svg(360, 316, 'Biegeteil mit neutraler Faser und Abwicklung zur gestreckten Länge', b);
  }

  /* ============================================================ 3) Gewinde im Schnitt, Durchgangsloch */
  function gewinde(o) {
    o = o || {}; const th = C.thread(o.d); if (!th) return msg('Gewinde wählen.');
    const vals = !!o.vals, dpx = 130, sc = dpx / th.d, kpx = th.kern * sc, P = th.P * sc, cx = 180, y0 = 34, hh = 130, depth = (dpx - kpx) / 2;
    const fl = Math.min(depth * Math.tan(Math.PI / 6), P * 0.3), tip = Math.max(2, P * 0.14), root = Math.max(2, P - 2 * fl - tip);
    const wall = (sgn, ph) => {
      const xr = cx + sgn * dpx / 2, xt = cx + sgn * kpx / 2; let pts = [], y = y0 - P + ph;
      for (let k = 0; k < 20 && y < y0 + hh + P; k++) { pts.push([xr, y], [xr, y + root], [xt, y + root + fl], [xt, y + root + fl + tip], [xr, y + P]); y += P; }
      return pts.map(p => [p[0], Math.min(y0 + hh, Math.max(y0, p[1]))]);
    };
    const L = wall(-1, 0), Rr = wall(1, P / 2).slice().reverse();
    let b = rect(24, y0, 312, hh, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;')
      + poly(L.concat(Rr), 'fill:var(--bg);stroke:var(--fg);stroke-width:1.4;stroke-linejoin:round;')
      + line(cx - kpx / 2, y0 - 6, cx - kpx / 2, y0 + hh + 6, STK('accent') + 'stroke-width:1.5;stroke-dasharray:5 3;') + line(cx + kpx / 2, y0 - 6, cx + kpx / 2, y0 + hh + 6, STK('accent') + 'stroke-width:1.5;stroke-dasharray:5 3;')
      + line(cx - dpx / 2, y0 + hh + 6, cx - dpx / 2, y0 + hh + 26, STK('hi') + 'stroke-width:1.5;') + line(cx + dpx / 2, y0 + hh + 6, cx + dpx / 2, y0 + hh + 26, STK('hi') + 'stroke-width:1.5;')
      + line(cx - dpx / 2, y0 + hh + 22, cx + dpx / 2, y0 + hh + 22, STK('hi') + 'stroke-width:1.5;')
      + TM(cx, y0 + hh + 40, vals ? 'Nenndurchmesser d = ' + f(th.d, 0) + ' mm (M' + th.d + ')' : 'Nenndurchmesser d', 'vz-b')
      + line(cx - kpx / 2, y0 - 12, cx + kpx / 2, y0 - 12, STK('accent') + 'stroke-width:1.5;')
      + TM(cx, y0 - 18, vals ? 'Kernloch ' + f(th.kern, 1) + ' mm' : 'Kernloch', 'vz-b')
      + line(cx + dpx / 2 + 16, y0 + 0.5, cx + dpx / 2 + 16, y0 + 0.5 + P, STK('ok') + 'stroke-width:2;') + T(cx + dpx / 2 + 22, y0 + P / 2 + 5, vals ? 'P = ' + f(th.P, 2) + ' mm' : 'Steigung P', 'vz-m')
      + T(30, y0 + 16, 'Schnitt', 'vz-m');
    b += T(10, y0 + hh + 62, 'Die Gewindespitzen sitzen am Kernloch,', 'vz-m') + T(10, y0 + hh + 78, 'die Flanken reichen bis zum Nenndurchmesser.', 'vz-m');
    return svg(360, y0 + hh + 88, 'Gewinde im Schnitt: Kernloch, Nenndurchmesser und Steigung', b);
  }
  function schraube(o) {
    o = o || {}; const th = C.thread(o.d); if (!th) return msg('Gewinde wählen.');
    const vals = !!o.vals, sc = 120 / th.d, dpx = th.d * sc, hole = th.durch * sc, cx = 180, y0 = 70, hh = 70;
    let b = rect(40, y0, cx - hole / 2 - 40, hh, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;') + rect(cx + hole / 2, y0, 320 - cx - hole / 2, hh, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;')
      + rect(cx - dpx / 2, 14, dpx, y0 + hh - 4, 'fill:var(--accent);fill-opacity:.5;stroke:var(--accent);stroke-width:1.5;')
      + rect(cx - dpx / 2 - 22, 8, dpx + 44, 14, 'fill:var(--accent);fill-opacity:.7;stroke:var(--accent);stroke-width:1.5;')
      + line(cx - hole / 2, y0 + hh + 10, cx + hole / 2, y0 + hh + 10, STK('hi') + 'stroke-width:2;') + TM(cx, y0 + hh + 30, vals ? 'Durchgangsloch ' + f(th.durch, 1) + ' mm' : 'Durchgangsloch', 'vz-b')
      + TM(cx, y0 + hh + 48, vals ? 'Schraube M' + th.d + ' (Ø ' + f(th.d, 0) + ' mm) steckt mit Spiel im Loch' : 'Die Schraube steckt mit etwas Spiel im Loch', 'vz-m');
    return svg(360, y0 + hh + 58, 'Schraube im Durchgangsloch mit Spiel', b);
  }

  /* ============================================================ 4) Zuschnitt: Stange und Blechtafel */
  function stange(o) {
    o = o || {}; const vals = !!o.vals; let b = '';
    if (!vals) {
      b += rect(20, 40, 320, 30, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;');
      [[40, 70, 'Teil'], [124, 70, 'Teil'], [208, 70, 'Teil']].forEach(p => { b += rect(p[0], 40, p[1], 30, 'fill:var(--accent);fill-opacity:.45;stroke:var(--accent);stroke-width:1.5;') + TM(p[0] + p[1] / 2, 60, p[2], ''); });
      [110, 194, 278].forEach(x => { b += rect(x, 36, 6, 38, 'fill:var(--danger);fill-opacity:.7;'); });
      b += TM(180, 100, 'Jeder Schnitt (rot) kostet die Schnittbreite.', 'vz-m') + TM(180, 118, 'Das letzte Teil endet am Stangenende.', 'vz-m');
      return svg(360, 130, 'Skizze: Stange mit Teilen und Sägeschnitten', b);
    }
    const n = C.partsFromBar(o.L, o.l, o.kerf), rest = C.barRest(o.L, o.l, o.kerf);
    if (!fin(n)) return msg('Bitte Längen angeben.');
    const sc = 320 / o.L; let x = 20;
    b += rect(20, 40, 320, 30, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;');
    for (let i = 0; i < n; i++) { b += rect(x, 40, o.l * sc, 30, 'fill:var(--accent);fill-opacity:.45;stroke:var(--accent);stroke-width:1;'); x += o.l * sc; if (i < n - 1) { b += rect(x, 36, Math.max(2, o.kerf * sc), 38, 'fill:var(--danger);fill-opacity:.8;'); x += o.kerf * sc; } }
    if (rest > 0) b += rect(x, 40, rest * sc, 30, 'fill:var(--mute);fill-opacity:.35;stroke:var(--mute);stroke-width:1;stroke-dasharray:4 3;');
    b += T(20, 98, n + ' Teile · ' + (n > 0 ? n - 1 : 0) + ' Schnitte · Rest ' + f(rest, 1) + ' mm', 'vz-b') + T(20, 116, 'blau: Teil · rot: Sägeschnitt · grau: Rest', 'vz-m');
    return svg(360, 128, 'Stange mit ' + n + ' Teilen, Schnitten und Reststück', b);
  }
  function tafel(o) {
    o = o || {}; const W = o.W, H = o.H;
    if (![W, H, o.w, o.h].every(v => v > 0)) return msg('Bitte Maße angeben.');
    const sc = Math.min(300 / W, 250 / H), tw = W * sc, th = H * sc, x0 = (360 - tw) / 2, y0 = 12; let b = rect(x0, y0, tw, th, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;');
    if (!o.vals) {
      const pw = Math.min(tw * 0.28, o.w * sc), ph = Math.min(th * 0.28, o.h * sc);
      b += rect(x0 + 10, y0 + 10, pw, ph, 'fill:var(--accent);fill-opacity:.45;stroke:var(--accent);stroke-width:1.5;') + T(x0 + 14, y0 + 24, 'Platine', '')
        + rect(x0 + 10 + pw, y0 + 10, 8, ph, 'fill:var(--danger);fill-opacity:.5;') + T(x0 + tw / 2, y0 + th - 14, 'R = Rand, e = Steg zwischen den Teilen', 'vz-m', ' text-anchor="middle"');
      return svg(360, th + 28, 'Skizze der Blechtafel mit einer Platine', b);
    }
    return nest(o);
  }
  function nest(o) {
    o = o || {}; const W = o.W, H = o.H, e = o.e, rr = o.rr, r = C.nest(W, H, o.w, o.h, e, rr);
    if (!fin(r.n)) return msg('Bitte Maße angeben.');
    const sc = Math.min(300 / W, 250 / H), tw = W * sc, th = H * sc, x0 = (360 - tw) / 2, y0 = 12;
    let b = rect(x0, y0, tw, th, 'fill:var(--panel2);stroke:var(--mute);stroke-width:1.5;') + rect(x0 + rr * sc, y0 + rr * sc, tw - 2 * rr * sc, th - 2 * rr * sc, 'fill:none;stroke:var(--mute);stroke-width:1;stroke-dasharray:4 3;');
    const pw = r.w * sc, ph = r.h * sc; let cells = '';
    for (let i = 0; i < r.nx; i++) for (let j = 0; j < r.ny; j++) cells += rect(x0 + (rr + i * (r.w + e)) * sc, y0 + (rr + j * (r.h + e)) * sc, pw, ph, 'fill:var(--accent);fill-opacity:.5;stroke:var(--accent);stroke-width:1;');
    b += cells;
    const ut = C.nestUtil(W, H, o.w, o.h, e, rr), by = y0 + th + 16;
    b += rect(20, by, 320, 14, 'fill:var(--panel2);stroke:var(--mute);') + rect(20, by, 320 * Math.min(100, ut) / 100, 14, 'fill:var(--ok);fill-opacity:.6;')
      + T(20, by + 32, r.n + ' Platinen' + (r.rot ? ' (gedreht)' : '') + ' · Ausnutzung ' + f(ut, 1) + ' % · Verschnitt ' + f(100 - ut, 1) + ' %', 'vz-b');
    return svg(360, by + 42, 'Schachtelung auf der Blechtafel: ' + r.n + ' Platinen, Ausnutzung ' + f(ut, 1) + ' Prozent', b);
  }

  /* ============================================================ 5) Glockenkurve, Histogramm, Regelkarte */
  function glocke(o) {
    o = o || {}; const mu = o.mu, sg = o.sigma, u = o.ugw, g = o.ogw, vals = !!o.vals;
    if (![mu, sg, u, g].every(fin) || !(sg > 0) || !(g > u)) return msg('Bitte Mittelwert, Streuung und Toleranzgrenzen angeben.');
    const lo = Math.min(u, mu - 4 * sg) - (g - u) * 0.12, hi = Math.max(g, mu + 4 * sg) + (g - u) * 0.12, x0 = 20, w = 320, yb = 150, hgt = 110, X = v => x0 + (v - lo) / (hi - lo) * w, pk = C.pdf(mu, mu, sg), Y = v => yb - C.pdf(v, mu, sg) / pk * hgt;
    const pts = []; for (let i = 0; i <= 120; i++) { const v = lo + (hi - lo) * i / 120; pts.push([v, Y(v)]); }
    const area = (a, bb, cls) => { const q = pts.filter(p => p[0] >= a && p[0] <= bb); if (q.length < 2) return ''; return poly([[X(q[0][0]), yb]].concat(q.map(p => [X(p[0]), p[1]])).concat([[X(q[q.length - 1][0]), yb]]), cls); };
    let b = area(Math.max(lo, u), Math.min(hi, g), 'fill:var(--ok);fill-opacity:.28;') + area(lo, Math.min(u, hi), 'fill:var(--danger);fill-opacity:.55;') + area(Math.max(g, lo), hi, 'fill:var(--danger);fill-opacity:.55;');
    b += `<polyline points="${pts.map(p => N(X(p[0])) + ',' + N(p[1])).join(' ')}" class="vz-draw" pathLength="1" style="fill:none;stroke:var(--fg);stroke-width:2;"/>` + line(x0, yb, x0 + w, yb, STK('mute') + 'stroke-width:1.5;');
    b += line(X(u), 20, X(u), yb + 4, STK('accent') + 'stroke-width:3;') + line(X(g), 20, X(g), yb + 4, STK('accent') + 'stroke-width:3;') + line(X(mu), 30, X(mu), yb, STK('fg') + 'stroke-width:1.2;stroke-dasharray:5 3;');
    b += TM(X(u), 14, 'UGW', 'vz-b') + TM(X(g), 14, 'OGW', 'vz-b') + TM(X(mu), 26, 'μ', 'vz-b');
    const a3 = Math.max(lo, mu - 3 * sg), b3 = Math.min(hi, mu + 3 * sg);
    b += line(X(a3), yb + 16, X(b3), yb + 16, STK('hi') + 'stroke-width:3;') + TM(X(mu), yb + 32, vals ? '±3σ = ' + f(6 * sg, 3) + ' mm breit' : 'Streubreite ±3σ', 'vz-m');
    b += line(X(u), yb + 44, X(g), yb + 44, STK('accent') + 'stroke-width:3;') + TM(X(mu), yb + 60, vals ? 'Toleranz = ' + f(g - u, 3) + ' mm' : 'Toleranzbreite', 'vz-m');
    if (vals) { const cpv = C.cp(u, g, sg), ck = C.cpk(u, g, mu, sg), out = C.outShare(u, g, mu, sg); b += T(x0, 196, 'Cp = ' + f(cpv, 2) + ' · Cpk = ' + f(ck, 2) + ' · außerhalb ≈ ' + (out < 0.01 ? '< 0,01' : f(out, 2)) + ' %', 'vz-b'); }
    else b += T(x0, 196, 'rot: außerhalb der Toleranz (nur Form, keine Werte)', 'vz-m');
    return svg(360, 206, 'Normalverteilung mit Toleranzgrenzen und Streubreite', b);
  }
  function histogramm(o) {
    o = o || {}; const v = (o.values || []).filter(fin);
    if (v.length < 3) return msg('Für das Histogramm sind mindestens drei Werte nötig.');
    const k = C.klassenZahl(v.length), mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), wdt = Math.max((mx - mn) / k, 1e-9) * 1.0001, cl = C.classes(v, mn, wdt, k), top = Math.max.apply(null, cl.map(c => c.n)) || 1;
    const lo = Math.min(mn, fin(o.ugw) ? o.ugw : mn), hi = Math.max(mx + wdt, fin(o.ogw) ? o.ogw : mx), X = x => 24 + (x - lo) / (hi - lo) * 312, yb = 150;
    let b = ''; cl.forEach(c => { const h = c.n / top * 110; b += rect(X(c.lo), yb - h, X(c.hi) - X(c.lo) - 1, h, 'fill:var(--accent);fill-opacity:.5;stroke:var(--accent);stroke-width:1;') + (c.n ? TM((X(c.lo) + X(c.hi)) / 2, yb - h - 4, String(c.n), '') : ''); });
    b += line(24, yb, 336, yb, STK('mute') + 'stroke-width:1.5;');
    if (fin(o.ugw)) b += line(X(o.ugw), 20, X(o.ugw), yb + 4, STK('danger') + 'stroke-width:2.5;') + TM(X(o.ugw), 14, 'UGW', 'vz-b');
    if (fin(o.ogw)) b += line(X(o.ogw), 20, X(o.ogw), yb + 4, STK('danger') + 'stroke-width:2.5;') + TM(X(o.ogw), 14, 'OGW', 'vz-b');
    b += T(24, yb + 18, f(lo, 3), 'vz-m') + TE(336, yb + 18, f(hi, 3), 'vz-m') + T(24, yb + 36, v.length + ' Werte in ' + k + ' Klassen (Strichliste als Säulen)', 'vz-m');
    return svg(360, 196, 'Histogramm der Messwerte mit Toleranzgrenzen', b);
  }
  function regelkarte(o) {
    o = o || {}; const s = (o.s || []).filter(fin), lim = o.lim;
    if (s.length < 3 || !lim) return msg('Für die Regelkarte fehlen Werte.');
    const ymin = Math.min(lim.ueg, Math.min.apply(null, s)) - (lim.oeg - lim.ueg) * 0.05, ymax = Math.max(lim.oeg, Math.max.apply(null, s)) + (lim.oeg - lim.ueg) * 0.05, x0 = 16, w = 290, yt = 12, hh = 158;
    const X = i => x0 + (s.length === 1 ? 0 : i / (s.length - 1) * w), Y = v => yt + (ymax - v) / (ymax - ymin) * hh;
    const hl = (v, st, lab) => line(x0, Y(v), x0 + w, Y(v), st) + T(x0 + w + 6, Y(v) + 4, lab, 'vz-m');
    let b = hl(lim.oeg, STK('danger') + 'stroke-width:1.8;stroke-dasharray:7 4;', 'OEG') + hl(lim.ueg, STK('danger') + 'stroke-width:1.8;stroke-dasharray:7 4;', 'UEG') + hl(lim.owg, STK('hi') + 'stroke-width:1.2;stroke-dasharray:2 4;', 'OWG') + hl(lim.uwg, STK('hi') + 'stroke-width:1.2;stroke-dasharray:2 4;', 'UWG') + hl(lim.mid, STK('mute') + 'stroke-width:1.5;', 'Mitte');
    b += `<polyline points="${s.map((v, i) => N(X(i)) + ',' + N(Y(v))).join(' ')}" class="vz-draw" pathLength="1" style="fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;"/>`;
    s.forEach((v, i) => { b += `<circle cx="${N(X(i))}" cy="${N(Y(v))}" r="3.4" style="fill:var(--accent);"/>`; });
    if (o.flags) {
      const r = C.chartRules(s, lim);
      r.aus.forEach(i => { b += `<circle cx="${N(X(i))}" cy="${N(Y(s[i]))}" r="8" style="fill:none;stroke:var(--danger);stroke-width:2.5;"/>`; });
      ['trend', 'lage'].forEach(k => r[k].forEach(i => { b += `<polyline points="${s.slice(i, i + C.RUN).map((v, j) => N(X(i + j)) + ',' + N(Y(v))).join(' ')}" style="fill:none;stroke:var(--danger);stroke-width:4;stroke-opacity:.6;"/>`; }));
    }
    b += T(x0, yt + hh + 22, 'Messwerte in der Reihenfolge der Fertigung', 'vz-m') + T(x0, yt + hh + 40, 'OEG, UEG: Eingriffsgrenzen (±3σ)', 'vz-m') + T(x0, yt + hh + 58, 'OWG, UWG: Warngrenzen (±2σ)', 'vz-m');
    return svg(360, yt + hh + 68, 'Qualitätsregelkarte mit Mittellinie, Warn- und Eingriffsgrenzen', b);
  }

  /* ============================================================ 6) Kosten über der Losgröße */
  function kostenkurve(o) {
    o = o || {}; const kr = o.kr, kv = o.kv, m = o.m;
    if (!(kr >= 0) || !(kv >= 0) || !(m > 0)) return msg('Bitte Rüstkosten, Kosten je Stück und Losgröße angeben.');
    const xmax = Math.max(100, m * 2), K = x => kr / x + kv, xmin = Math.max(1, xmax / 40), ymax = K(xmin) * 1.05, x0 = 36, w = 300, yt = 14, hh = 140;
    const X = v => x0 + (v - xmin) / (xmax - xmin) * w, Y = v => yt + (1 - v / ymax) * hh; const pts = []; for (let i = 0; i <= 60; i++) { const v = xmin + (xmax - xmin) * i / 60; pts.push(N(X(v)) + ',' + N(Y(K(v)))); }
    let b = line(x0, yt + hh, x0 + w, yt + hh, STK('mute') + 'stroke-width:1.5;') + line(x0, yt, x0, yt + hh, STK('mute') + 'stroke-width:1.5;')
      + line(x0, Y(kv), x0 + w, Y(kv), STK('ok') + 'stroke-width:1.5;stroke-dasharray:5 4;') + T(x0 + 4, Y(kv) - 5, 'Fertigung je Stück (ohne Rüsten)', 'vz-m')
      + `<polyline points="${pts.join(' ')}" class="vz-draw" pathLength="1" style="fill:none;stroke:var(--accent);stroke-width:2.5;"/>`
      + `<circle cx="${N(X(m))}" cy="${N(Y(K(m)))}" r="6" style="fill:var(--hi);stroke:var(--bg);stroke-width:2;"/>` + TM(X(m), Y(K(m)) - 12, f(K(m), 2) + ' €', 'vz-b')
      + TM(x0 + w / 2, yt + hh + 18, 'Losgröße (Stück)', 'vz-m') + T(x0 - 28, yt + 8, '€/Stück', 'vz-m');
    b += T(x0, yt + hh + 36, 'Je größer das Los, desto kleiner der Rüstanteil je Stück.', 'vz-m');
    return svg(360, yt + hh + 44, 'Kosten je Stück sinken mit der Losgröße', b);
  }
  function vergleich(o) {
    o = o || {}; const m = C.gleichTeuer(o.kr1, o.kv1, o.kr2, o.kv2);
    if (![o.kr1, o.kv1, o.kr2, o.kv2].every(fin)) return msg('Bitte alle vier Werte angeben.');
    const xmax = fin(m) && m > 0 ? m * 2 : 100, A = x => o.kr1 + x * o.kv1, B = x => o.kr2 + x * o.kv2, ymax = Math.max(A(xmax), B(xmax)) * 1.05 || 1, x0 = 40, w = 296, yt = 14, hh = 140;
    const X = v => x0 + v / xmax * w, Y = v => yt + (1 - v / ymax) * hh;
    let b = line(x0, yt + hh, x0 + w, yt + hh, STK('mute') + 'stroke-width:1.5;') + line(x0, yt, x0, yt + hh, STK('mute') + 'stroke-width:1.5;')
      + line(X(0), Y(A(0)), X(xmax), Y(A(xmax)), STK('accent') + 'stroke-width:2.5;') + line(X(0), Y(B(0)), X(xmax), Y(B(xmax)), STK('hi') + 'stroke-width:2.5;')
      + T(x0 + 4, yt + 12, 'A', 'vz-b') + T(x0 + w - 14, Y(B(xmax)) - 6, 'B', 'vz-b');
    if (fin(m) && m > 0) b += `<circle cx="${N(X(m))}" cy="${N(Y(A(m)))}" r="6" style="fill:var(--ok);stroke:var(--bg);stroke-width:2;"/>` + line(X(m), Y(A(m)), X(m), yt + hh, STK('ok') + 'stroke-dasharray:4 3;') + TM(X(m), yt + hh + 16, f(m, 0) + ' Stück', 'vz-b');
    b += TM(x0 + w / 2, yt + hh + 34, 'Gesamtkosten über der Stückzahl', 'vz-m');
    return svg(360, yt + hh + 44, 'Gesamtkosten zweier Verfahren über der Stückzahl', b);
  }

  /* ============================================================ 7) Werkstück mit 3-2-1-Punkten */
  function block(o) {
    o = o || {}; const X = 170, Y = 100, Z = 64, px = (x, y) => 30 + x + 0.5 * y, py = (y, z) => 150 - z - 0.3 * y, P = (x, y, z) => [px(x, y), py(y, z)];
    const face = (pts, st) => poly(pts.map(p => P(p[0], p[1], p[2])), st), cnt = o.cnt;
    let b = '';
    b += face([[0, 0, 0], [X, 0, 0], [X, Y, 0], [0, Y, 0]], 'fill:var(--accent);fill-opacity:.2;stroke:var(--accent);stroke-width:1.5;stroke-dasharray:5 3;')
      + face([[0, Y, 0], [X, Y, 0], [X, Y, Z], [0, Y, Z]], 'fill:var(--hi);fill-opacity:.2;stroke:var(--hi);stroke-width:1.5;stroke-dasharray:5 3;')
      + face([[0, 0, 0], [X, 0, 0], [X, 0, Z], [0, 0, Z]], 'fill:var(--panel2);fill-opacity:.9;stroke:var(--fg);stroke-width:1.5;')
      + face([[0, 0, Z], [X, 0, Z], [X, Y, Z], [0, Y, Z]], 'fill:var(--panel);fill-opacity:.9;stroke:var(--fg);stroke-width:1.5;')
      + face([[X, 0, 0], [X, Y, 0], [X, Y, Z], [X, 0, Z]], 'fill:var(--ok);fill-opacity:.3;stroke:var(--ok);stroke-width:2;');
    const pin = (p, col, n, dx, dy) => { const c = P(p[0], p[1], p[2]); return line(c[0], c[1], c[0] + dx, c[1] + dy, STK('fg') + 'stroke-width:2;') + `<circle cx="${N(c[0])}" cy="${N(c[1])}" r="8" style="fill:var(--${col});stroke:var(--bg);stroke-width:1.5;"/>` + TM(c[0], c[1] + 4, String(n), 'vz-pin'); };
    if (cnt) {
      [[30, 14], [140, 14], [85, 78], [85, 40]].slice(0, Math.min(4, cnt[0])).forEach((q, i) => { b += pin([q[0], q[1], 0], 'accent', i + 1, 0, 14); });
      [[34, 22], [136, 22], [85, 46]].slice(0, Math.min(3, cnt[1])).forEach((q, i) => { b += pin([q[0], Y, q[1]], 'hi', i + 1, 7, -4); });
      [[44, 30], [44, 50]].slice(0, Math.min(2, cnt[2])).forEach((q, i) => { b += pin([X, q[0], q[1]], 'ok', i + 1, 16, 0); });
    }
    b += `<rect x="8" y="184" width="10" height="10" style="fill:var(--accent);fill-opacity:.5;"/>` + T(24, 193, cnt ? 'Hauptauflage (unten): größte Fläche, 3 Punkte' : 'Hauptauflage (unten): größte Fläche', 'vz-m');
    b += `<rect x="8" y="200" width="10" height="10" style="fill:var(--hi);fill-opacity:.5;"/>` + T(24, 209, cnt ? 'Führungsfläche (hinten): 2 Punkte' : 'Führungsfläche (hinten)', 'vz-m') + `<rect x="8" y="216" width="10" height="10" style="fill:var(--ok);fill-opacity:.5;"/>` + T(24, 225, cnt ? 'Anschlag (rechts): 1 Punkt' : 'Anschlag (rechts)', 'vz-m');
    b += line(10, 124, 10, 98, STK('mute') + 'stroke-width:1.5;') + T(14, 96, 'z', 'vz-m') + line(10, 124, 34, 124, STK('mute') + 'stroke-width:1.5;') + T(36, 128, 'x', 'vz-m') + line(10, 124, 22, 118, STK('mute') + 'stroke-width:1.5;') + T(24, 114, 'y', 'vz-m');
    let h = 236;
    if (o.bar && cnt) {
      const d = C.dof(cnt[0], cnt[1], cnt[2]); h = 292; b += T(8, 248, 'Freiheitsgrade (T = Verschieben, R = Drehen)', 'vz-m');
      ['Tz', 'Rx', 'Ry', 'Ty', 'Rz', 'Tx'].forEach((t, i) => { const lk = d.locked.indexOf(i) >= 0, x = 8 + i * 58; b += rect(x, 256, 52, 30, lk ? 'fill:var(--ok);fill-opacity:.4;stroke:var(--ok);stroke-width:1.5;' : 'fill:none;stroke:var(--danger);stroke-width:2;stroke-dasharray:4 3;', ' rx="6"') + TM(x + 26, 276, t + (lk ? ' ✓' : ''), 'vz-b'); });
    }
    return svg(360, h, 'Quader mit den Auflagepunkten der 3-2-1-Regel: Hauptauflage unten, Führungsfläche hinten, Anschlag rechts', b);
  }

  /* ============================================================ Skizzen für Aufgaben und Trainer (ohne Ergebnisse) */
  function taskSvg(v) {
    if (!v) return '';
    const o = Object.assign({}, v, { vals: false });
    switch (v.k) {
      case 'landkarte': return landkarte(0, { plain: true });
      case 'gewinde': return gewinde(o);
      case 'schraube': return schraube(o);
      case 'bieg': return biegeteil(o);
      case 'stange': return stange(o);
      case 'tafel': return tafel(o);
      case 'glocke': return glocke(o);
      case 'regel': return regelkarte({ s: v.s, lim: v.lim, flags: false });
      case 'block': return block({ cnt: null });
      default: return '';
    }
  }

  const api = { landkarte, biegeteil, gewinde, schraube, stange, tafel, nest, glocke, histogramm, regelkarte, kostenkurve, vergleich, block, taskSvg, turtle };
  root.FER_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
