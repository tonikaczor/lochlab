'use strict';
/* Tonfunk Konstruktions-Lab: Visualisierungen (konviz.js, wird NACH konui.js eingebunden).
   Reine SVG-Funktionen (KON_VIZ.*, in Node testbar) plus kleine Anbindung an die Reiter (die Rechner-Reiter, nicht Aufgaben/Trainer):
   Schrauben: Schraubverbindung im Schnitt und Kernloch/Durchgangsloch, Toleranzrahmen: Toleranzzone, Lager & Federn: Wälzlager im Schnitt
   und Federkennlinien. Alle Skizzen sind vereinfacht und tragen nur Buchstaben, keine Rechenergebnisse. Maße der Skizzen sind
   Übungswerte wie im Lab (keine Konstruktionsvorgabe). */
(function (root) {
  const N = v => (isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let uid = 0;
  const V = {};
  const STYLE = '.vz svg{display:block;width:100%;height:auto;max-width:440px;margin:0 auto}.vz svg text{font-family:system-ui,sans-serif;fill:var(--fg)}.vz .m{fill:var(--mute)!important}'
    + '.vz .cap{margin:6px 0 0;font-size:13px;color:var(--mute);line-height:1.4}';
  const LN = 'fill="none" style="stroke:var(--fg);stroke-width:1.4;stroke-linejoin:round"';
  const hatchDefs = (id, ang) => `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--mute);stroke-width:1"/></pattern>`;

  /* ---------- Schraubverbindung im Schnitt ---------- */
  /* t: Gewindedaten {d,P,kern,dg,sw,m,s}, t1, t2 in mm, w Scheiben unter der Mutter, len Schraubenlänge in mm */
  V.schraube = function (t, t1, t2, w, len) {
    if (!t || !(t1 > 0) || !(t2 > 0) || !(len > 0)) return '';
    w = Math.max(0, Math.min(2, w | 0));
    const d = t.d, hk = 0.65 * d, ws = w * t.s, sum = t1 + t2, over = Math.max(0, len - sum - ws - t.m);
    const pw = Math.max(t.sw * 1.15, 2 * d), total = hk + len, k = Math.min(190 / total, 62 / pw), cx = 36 + pw * k;
    const Y = v => N(14 + v * k), X = v => N(cx + v * k);
    const id1 = 'vzp' + (++uid), id2 = 'vzq' + uid;
    const y0 = hk, y1 = y0 + t1, y2 = y1 + t2, y3 = y2 + ws, y4 = y3 + t.m, y5 = hk + len;
    const rect = (x, y, wd, h, extra) => `<rect x="${X(x)}" y="${Y(y)}" width="${N(wd * k)}" height="${N(h * k)}" ${extra}/>`;
    let g = `<defs>${hatchDefs(id1, 45)}${hatchDefs(id2, -45)}</defs>`;
    /* Teile 1 und 2 geschnitten: gegenläufig schraffiert, mit Durchgangsloch */
    const plate = (ya, yb, id) => `<g ${LN}>` + rect(-pw, ya, pw - t.dg / 2, yb - ya, `style="fill:var(--panel);stroke:var(--fg);stroke-width:1.4"`) + rect(t.dg / 2, ya, pw - t.dg / 2, yb - ya, `style="fill:var(--panel);stroke:var(--fg);stroke-width:1.4"`)
      + rect(-pw, ya, pw - t.dg / 2, yb - ya, `style="fill:url(#${id});stroke:none"`) + rect(t.dg / 2, ya, pw - t.dg / 2, yb - ya, `style="fill:url(#${id});stroke:none"`) + '</g>';
    g += plate(y0, y1, id1) + plate(y1, y2, id2);
    /* Schaft (nicht geschnitten dargestellt) mit Gewinde im unteren Teil */
    g += rect(-d / 2, y0, d, y5 - y0, 'style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.4"');
    for (let y = y2 + 1; y < y5 - 0.5; y += Math.max(0.9, t.P)) g += `<line x1="${X(-d / 2)}" y1="${Y(y)}" x2="${X(d / 2)}" y2="${Y(y)}" style="stroke:var(--mute);stroke-width:.8"/>`;
    /* Kopf, Scheibe(n), Mutter: Ansicht */
    g += rect(-t.sw / 2, 0, t.sw, hk, 'style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.6"');
    if (w > 0) g += rect(-d, y2, 2 * d, ws, 'style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.4"');
    g += rect(-t.sw / 2, y3, t.sw, t.m, 'style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.6"');
    g += `<line x1="${X(0)}" y1="${Y(-1)}" x2="${X(0)}" y2="${Y(y5 + 2)}" style="stroke:var(--mute);stroke-width:1;stroke-dasharray:12 3 2 3"/>`;
    /* Beschriftung rechts (Buchstaben), Führungslinien */
    const items = [['Kopf', hk / 2], ['Teil 1 (t₁)', (y0 + y1) / 2], ['Teil 2 (t₂)', (y1 + y2) / 2]];
    if (w > 0) items.push([w > 1 ? 'Scheiben (s)' : 'Scheibe (s)', y2 + ws / 2]);
    items.push(['Mutter (m)', y3 + t.m / 2]);
    if (over > 0.3) items.push(['Überstand', (y4 + y5) / 2]);
    let last = -99; const ys = items.map(it => { let y = Y(it[1]); if (y < last + 15) y = last + 15; last = y; return y; });
    items.forEach((it, i) => {
      const x0 = it[0] === 'Kopf' ? X(t.sw / 2) : it[0].indexOf('Teil') === 0 ? X(pw) : it[0].indexOf('Scheibe') === 0 ? X(d) : it[0] === 'Mutter (m)' ? X(t.sw / 2) : X(d / 2);
      g += `<line x1="${x0}" y1="${Y(it[1])}" x2="196" y2="${ys[i]}" style="stroke:var(--mute);stroke-width:1"/><text x="200" y="${N(ys[i] + 4)}" font-size="12">${esc(it[0])}</text>`;
    });
    const H = Math.max(N(Y(y5) + 18), ys.length ? ys[ys.length - 1] + 14 : 0, 80);
    g += `<line x1="${X(-pw) - 8}" y1="${Y(y0)}" x2="${X(-pw) - 8}" y2="${Y(y2)}" style="stroke:var(--fg);stroke-width:1"/><text x="${X(-pw) - 12}" y="${N(Y((y0 + y2) / 2) + 4)}" font-size="12" text-anchor="end">Σt</text>`;
    return `<svg viewBox="0 0 300 ${H}" role="img" aria-label="Schraubverbindung im Längsschnitt: Schraube mit Kopf, zwei Teile, Scheibe, Mutter und Überstand">${g}</svg>`;
  };

  /* ---------- Kernloch und Durchgangsloch ---------- */
  V.loecher = function (t) {
    if (!t) return '';
    const k = Math.min(6, 34 / (t.dg / 2)), Y0 = 28, hh = 70, id = 'vzk' + (++uid);
    const cut = (x, w) => `<rect x="${N(x)}" y="${Y0}" width="${N(w)}" height="${hh}" style="fill:var(--panel);stroke:none"/><rect x="${N(x)}" y="${Y0}" width="${N(w)}" height="${hh}" style="fill:url(#${id});stroke:none"/>`;
    let g = `<defs>${hatchDefs(id, 45)}</defs>`;
    /* links: Gewindebohrung: Kernloch ⌀k, Gewindeflanken bis ⌀d */
    const cxA = 80, rK = t.kern / 2 * k, rD = t.d / 2 * k;
    g += cut(cxA - 60, 60 - rK) + cut(cxA + rK, 60 - rK);
    const teeth = Math.floor(hh / Math.max(5, t.P * k));
    let p = `M${N(cxA - rK)} ${Y0}`; for (let i = 0; i < teeth; i++) { const y = Y0 + i * hh / teeth; p += `L${N(cxA - rD)} ${N(y + hh / teeth / 2)}L${N(cxA - rK)} ${N(y + hh / teeth)}`; } p += ` L${N(cxA - rK)} ${Y0 + hh}`;
    g += `<path d="${p}" fill="none" style="stroke:var(--fg);stroke-width:1.2"/>`;
    p = `M${N(cxA + rK)} ${Y0}`; for (let i = 0; i < teeth; i++) { const y = Y0 + i * hh / teeth; p += `L${N(cxA + rD)} ${N(y + hh / teeth / 2)}L${N(cxA + rK)} ${N(y + hh / teeth)}`; }
    g += `<path d="${p}" fill="none" style="stroke:var(--fg);stroke-width:1.2"/>`;
    g += `<line x1="${cxA - 60}" y1="${Y0}" x2="${cxA + 60}" y2="${Y0}" style="stroke:var(--fg);stroke-width:1.6"/><line x1="${cxA - 60}" y1="${Y0 + hh}" x2="${cxA + 60}" y2="${Y0 + hh}" style="stroke:var(--fg);stroke-width:1.6"/>`;
    g += `<line x1="${N(cxA - rK)}" y1="${Y0 + hh + 10}" x2="${N(cxA + rK)}" y2="${Y0 + hh + 10}" style="stroke:var(--accent);stroke-width:2"/><text x="${cxA}" y="${Y0 + hh + 26}" font-size="12" text-anchor="middle">Kernloch</text><text x="${cxA}" y="${Y0 + hh + 40}" font-size="11" class="m" text-anchor="middle">kleiner als d</text>`;
    g += `<text x="${cxA}" y="16" font-size="12" font-weight="700" text-anchor="middle">Gewindebohrung</text>`;
    /* rechts: Durchgangsloch ⌀dg, Schraube ⌀d mit Luft */
    const cxB = 232, rG = t.dg / 2 * k, rS = t.d / 2 * k;
    g += cut(cxB - 60, 60 - rG) + cut(cxB + rG, 60 - rG);
    g += `<line x1="${cxB - 60}" y1="${Y0}" x2="${N(cxB - rG)}" y2="${Y0}" style="stroke:var(--fg);stroke-width:1.6"/><line x1="${N(cxB + rG)}" y1="${Y0}" x2="${cxB + 60}" y2="${Y0}" style="stroke:var(--fg);stroke-width:1.6"/>`
      + `<line x1="${cxB - 60}" y1="${Y0 + hh}" x2="${N(cxB - rG)}" y2="${Y0 + hh}" style="stroke:var(--fg);stroke-width:1.6"/><line x1="${N(cxB + rG)}" y1="${Y0 + hh}" x2="${cxB + 60}" y2="${Y0 + hh}" style="stroke:var(--fg);stroke-width:1.6"/>`
      + `<line x1="${N(cxB - rG)}" y1="${Y0}" x2="${N(cxB - rG)}" y2="${Y0 + hh}" style="stroke:var(--fg);stroke-width:1.2"/><line x1="${N(cxB + rG)}" y1="${Y0}" x2="${N(cxB + rG)}" y2="${Y0 + hh}" style="stroke:var(--fg);stroke-width:1.2"/>`;
    g += `<rect x="${N(cxB - rS)}" y="${Y0 - 12}" width="${N(2 * rS)}" height="${hh + 24}" style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.2"/>`;
    g += `<line x1="${N(cxB - rG)}" y1="${Y0 + hh + 10}" x2="${N(cxB + rG)}" y2="${Y0 + hh + 10}" style="stroke:var(--accent);stroke-width:2"/><text x="${cxB}" y="${Y0 + hh + 26}" font-size="12" text-anchor="middle">Durchgangsloch</text><text x="${cxB}" y="${Y0 + hh + 40}" font-size="11" class="m" text-anchor="middle">größer als d, Luft rundum</text>`;
    g += `<text x="${cxB}" y="16" font-size="12" font-weight="700" text-anchor="middle">Schraube im Loch</text>`;
    return `<svg viewBox="0 0 310 150" role="img" aria-label="Gewindebohrung mit Kernloch im Schnitt, daneben Schraube im Durchgangsloch">${g}</svg>`;
  };

  /* ---------- Toleranzzone ---------- */
  V.ZONE = {
    gerad: 'zwei parallele Geraden im Abstand t', eben: 'zwei parallele Ebenen im Abstand t', rund: 'zwei konzentrische Kreise, Radiendifferenz t',
    zyl: 'zwei koaxiale Zylinder, Radiendifferenz t', par: 'zwei parallele Geraden im Abstand t, parallel zum Bezug', recht: 'zwei parallele Geraden im Abstand t, rechtwinklig zum Bezug',
    koax: 'Zylinder ⌀t um die Achse des Bezugs', pos: 'Kreis ⌀t um den theoretisch genauen Ort', rundl: 'zwei konzentrische Kreise um die Bezugsachse, Radiendifferenz t'
  };
  V.zoneText = function (sym, dia) {
    if (dia && sym === 'gerad') return 'Zylinder ⌀t um die Achse (Seitenansicht)';
    if (dia && sym === 'par') return 'Zylinder ⌀t, Achse parallel zum Bezug (Seitenansicht)';
    if (dia && sym === 'recht') return 'Zylinder ⌀t, Achse rechtwinklig zum Bezug (Seitenansicht)';
    return V.ZONE[sym] || '';
  };
  V.zone = function (sym, dia, tolText, datum) {
    const ZN = 'style="fill:var(--hi);fill-opacity:.2;stroke:var(--hi);stroke-width:1.6;stroke-dasharray:5 3"', FE = 'fill="none" style="stroke:var(--accent);stroke-width:2.4;stroke-linecap:round"';
    const dt = (x, y) => `<g><line x1="${x - 20}" y1="${y}" x2="${x + 20}" y2="${y}" style="stroke:var(--fg);stroke-width:3"/><polygon points="${x - 5},${y + 9} ${x + 5},${y + 9} ${x},${y + 1}" style="fill:var(--fg)"/><text x="${x}" y="${y + 21}" font-size="12" font-weight="700" text-anchor="middle">${esc(datum || 'A')}</text></g>`;
    const band = (y, h) => `<rect x="30" y="${y}" width="160" height="${h}" ${ZN}/>`;
    const wave = y => `<path d="M30 ${y + 2}C60 ${y - 6} 80 ${y + 6} 110 ${y} S160 ${y - 5} 190 ${y + 1}" ${FE}/>`;
    const cir = (cx, cy, r, extra) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${extra || ZN}/>`;
    const cross = (cx, cy) => `<g style="stroke:var(--fg);stroke-width:1;stroke-dasharray:10 3 2 3"><line x1="${cx - 36}" y1="${cy}" x2="${cx + 36}" y2="${cy}"/><line x1="${cx}" y1="${cy - 36}" x2="${cx}" y2="${cy + 36}"/></g>`;
    let g = '', t = '';
    if (sym === 'gerad' || sym === 'eben') { g = band(44, 28) + wave(58); t = sym === 'eben' ? V.ZONE.eben : dia ? 'Zylinder ⌀t um die Achse (Seitenansicht)' : V.ZONE.gerad; }
    else if (sym === 'par') { g = band(40, 28) + wave(53) + dt(110, 108); t = dia ? 'Zylinder ⌀t, Achse parallel zum Bezug (Seitenansicht)' : V.ZONE.par; }
    else if (sym === 'recht') { g = `<rect x="96" y="14" width="28" height="84" ${ZN}/><path d="M110 14C102 36 118 56 110 98" ${FE}/>` + dt(110, 112); t = dia ? 'Zylinder ⌀t, Achse rechtwinklig zum Bezug (Seitenansicht)' : V.ZONE.recht; }
    else if (sym === 'rund' || sym === 'zyl') {
      g = `<path d="M110 20A40 40 0 1 1 109.9 20ZM110 32A28 28 0 1 0 110.1 32Z" style="fill:var(--hi);fill-opacity:.2;fill-rule:evenodd;stroke:var(--hi);stroke-width:1.6;stroke-dasharray:5 3"/><path d="M144 60C144 76 130 92 110 94S76 80 76 60 92 28 110 26 144 44 144 60Z" ${FE}/>`;
      t = V.ZONE[sym];
    } else if (sym === 'koax') { g = cross(110, 60) + cir(110, 60, 20) + `<circle cx="115" cy="56" r="3.5" style="fill:var(--accent)"/>` + `<circle cx="110" cy="60" r="44" fill="none" style="stroke:var(--fg);stroke-width:2"/>` + dt(110, 118); t = V.ZONE.koax; }
    else if (sym === 'pos') { g = cross(110, 60) + cir(110, 60, 20) + `<circle cx="116" cy="65" r="3.5" style="fill:var(--accent)"/><circle cx="116" cy="65" r="9" fill="none" style="stroke:var(--accent);stroke-width:1.6"/>`; t = V.ZONE.pos; }
    else if (sym === 'rundl') {
      g = `<path d="M110 22A38 38 0 1 1 109.9 22ZM110 32A28 28 0 1 0 110.1 32Z" style="fill:var(--hi);fill-opacity:.2;fill-rule:evenodd;stroke:var(--hi);stroke-width:1.6;stroke-dasharray:5 3"/><path d="M142 58C144 78 126 94 108 92S76 76 78 58 92 28 110 28 140 40 142 58Z" ${FE}/><circle cx="110" cy="60" r="3" style="fill:var(--fg)"/>` + dt(110, 118);
      t = V.ZONE.rundl;
    } else return '';
    const lab = `<text x="110" y="${sym === 'koax' || sym === 'rundl' || sym === 'recht' || sym === 'par' ? 150 : 128}" font-size="12" font-weight="700" text-anchor="middle">t = ${esc(tolText || '?')} mm</text>`;
    return `<svg viewBox="0 0 220 154" role="img" aria-label="Toleranzzone: ${esc(t)}">${g}${lab}</svg>`;
  };

  /* ---------- Wälzlager im Schnitt ---------- */
  /* info: Ergebnis von KON_CORE.brgInfo, oder null */
  V.lager = function (info) {
    if (!info || !(info.bore > 0)) return '';
    const bore = info.bore, D = info.D || Math.round(bore * 1.9 + 6), B = info.B || Math.round(D * 0.26);
    const typ = info.type, ax = /Axial/.test(typ);
    const k = 150 / D, cx = 150, cy = 94, RO = D / 2 * k, RI = bore / 2 * k, bh = (ax ? B * 1.1 : B) * k;
    const T = Math.max(3, (RO - RI) * 0.3), gap = (RO - RI) - 2 * T, rr = gap / 2;
    const ring = (x, y, w, h) => `<rect x="${N(x)}" y="${N(y)}" width="${N(w)}" height="${N(h)}" rx="2" style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.5"/>`;
    const half = s => {   /* s = -1 oben, +1 unten */
      const yO = s < 0 ? cy - RO : cy + RO - T, yI = s < 0 ? cy - RI - T : cy + RI, ym = s < 0 ? cy - (RO + RI) / 2 : cy + (RO + RI) / 2;
      let h = '';
      if (ax) {
        const x0 = cx - bh / 2, wd = bh * 0.3, y1 = s < 0 ? cy - RO : cy + RI, hh = RO - RI;
        h += `<rect x="${N(x0)}" y="${N(y1)}" width="${N(wd)}" height="${N(hh)}" rx="2" style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.5"/><rect x="${N(cx + bh / 2 - wd)}" y="${N(y1)}" width="${N(wd)}" height="${N(hh)}" rx="2" style="fill:var(--panel2);stroke:var(--fg);stroke-width:1.5"/>`
          + `<circle cx="${cx}" cy="${N(ym)}" r="${N(Math.min(hh * 0.4, (bh - 2 * wd) / 2))}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>`;
        return h;
      }
      h += ring(cx - bh / 2, yO, bh, T) + ring(cx - bh / 2, yI, bh, T);
      if (/Rillenkugel|Schrägkugel/.test(typ)) h += `<circle cx="${cx}" cy="${N(ym)}" r="${N(rr)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>`;
      else if (/Pendelkugel/.test(typ)) h += `<circle cx="${N(cx - bh * 0.2)}" cy="${N(ym)}" r="${N(rr * 0.8)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/><circle cx="${N(cx + bh * 0.2)}" cy="${N(ym)}" r="${N(rr * 0.8)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>`;
      else if (/Zylinder/.test(typ)) h += `<rect x="${N(cx - bh * 0.38)}" y="${N(ym - rr)}" width="${N(bh * 0.76)}" height="${N(2 * rr)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>`;
      else if (/Kegel/.test(typ)) { h += `<polygon points="${N(cx - bh * 0.36)},${N(s < 0 ? ym - rr : ym - rr * 0.5)} ${N(cx + bh * 0.36)},${N(s < 0 ? ym - rr * 0.5 : ym - rr)} ${N(cx + bh * 0.36)},${N(s < 0 ? ym + rr : ym + rr * 0.5)} ${N(cx - bh * 0.36)},${N(s < 0 ? ym + rr * 0.5 : ym + rr)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>` }
      else if (/Pendelrollen/.test(typ)) h += `<ellipse cx="${N(cx - bh * 0.2)}" cy="${N(ym)}" rx="${N(bh * 0.2)}" ry="${N(rr * 0.9)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/><ellipse cx="${N(cx + bh * 0.2)}" cy="${N(ym)}" rx="${N(bh * 0.2)}" ry="${N(rr * 0.9)}" style="fill:var(--accent);fill-opacity:.35;stroke:var(--fg);stroke-width:1.2"/>`;
      return h;
    };
    let g = `<line x1="40" y1="${cy}" x2="260" y2="${cy}" style="stroke:var(--mute);stroke-width:1;stroke-dasharray:12 3 2 3"/>` + half(-1) + half(1);
    /* Maßbuchstaben d, D, B */
    const dl = (x, y1, y2, txt, side) => `<line x1="${x}" y1="${N(y1)}" x2="${x}" y2="${N(y2)}" style="stroke:var(--fg);stroke-width:1"/><line x1="${x - 3}" y1="${N(y1)}" x2="${x + 3}" y2="${N(y1)}" style="stroke:var(--fg)"/><line x1="${x - 3}" y1="${N(y2)}" x2="${x + 3}" y2="${N(y2)}" style="stroke:var(--fg)"/><text x="${x + side}" y="${N((y1 + y2) / 2 + 4)}" font-size="13" font-weight="700" text-anchor="${side < 0 ? 'end' : 'start'}">${txt}</text>`;
    g += dl(N(cx - bh / 2 - 22), cy - RI, cy + RI, 'd', -6) + dl(N(cx + bh / 2 + 22), cy - RO, cy + RO, 'D', 6);
    g += `<line x1="${N(cx - bh / 2)}" y1="${N(cy + RO + 14)}" x2="${N(cx + bh / 2)}" y2="${N(cy + RO + 14)}" style="stroke:var(--fg);stroke-width:1"/><text x="${cx}" y="${N(cy + RO + 28)}" font-size="13" font-weight="700" text-anchor="middle">B</text>`;
    return `<svg viewBox="0 0 300 ${N(cy + RO + 36)}" role="img" aria-label="${esc(typ)} im Schnitt, vereinfachte Skizze mit Bohrung d, Außendurchmesser D und Breite B">${g}</svg>`;
  };

  /* ---------- Federkennlinien ---------- */
  V.federn = function (r1, r2, F) {
    if (!(r1 > 0) || !(r2 > 0)) return '';
    const par = r1 + r2, ser = 1 / (1 / r1 + 1 / r2), hasF = F > 0;
    const xmax = hasF ? F / ser * 1.2 : 10, ymax = hasF ? F * 1.25 : par * 10 * 0.8;
    const gx = 40, gy = 112, gw = 250, gh = 100, X = s => N(gx + s / xmax * gw), Y = f => N(gy + gh - f / ymax * gh);
    const lineTo = (R, col, dash) => { const s = Math.min(xmax, ymax / R); return `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(s)}" y2="${Y(R * s)}" style="stroke:${col};stroke-width:2.2${dash ? ';stroke-dasharray:' + dash : ''}"/>`; };
    const tag = (R, txt, col) => { const s = Math.min(xmax, ymax / R); return `<text x="${N(Math.min(parseFloat(X(s)) + 3, 292))}" y="${N(Math.max(parseFloat(Y(R * s)) + 4, 118))}" font-size="11" font-weight="700" style="fill:${col}" text-anchor="${parseFloat(X(s)) > 250 ? 'end' : 'start'}">${txt}</text>`; };
    let g = `<line x1="${gx}" y1="${gy + gh}" x2="${gx + gw}" y2="${gy + gh}" style="stroke:var(--fg)"/><line x1="${gx}" y1="${gy}" x2="${gx}" y2="${gy + gh}" style="stroke:var(--fg)"/>`
      + `<text x="${gx + gw}" y="${gy + gh + 14}" font-size="11" class="m" text-anchor="end">Federweg s</text><text x="${gx - 4}" y="${gy + 4}" font-size="11" class="m" text-anchor="end">F</text>`;
    g += lineTo(par, 'var(--ok)') + lineTo(r1, 'var(--accent)', '6 3') + lineTo(r2, 'var(--hi)', '6 3') + lineTo(ser, 'var(--danger)');
    g += tag(par, 'parallel', 'var(--ok)') + tag(ser, 'Reihe', 'var(--danger)');
    if (hasF) {
      g += `<line x1="${gx}" y1="${Y(F)}" x2="${gx + gw}" y2="${Y(F)}" style="stroke:var(--mute);stroke-width:1;stroke-dasharray:3 3"/>`
        + [[par, 'var(--ok)'], [ser, 'var(--danger)']].map(a => `<line x1="${X(F / a[0])}" y1="${Y(F)}" x2="${X(F / a[0])}" y2="${gy + gh}" style="stroke:${a[1]};stroke-width:1.4"/><circle cx="${X(F / a[0])}" cy="${Y(F)}" r="4" style="fill:${a[1]}"/>`).join('');
    }
    /* Schaltskizzen: Feder als Zickzack */
    const zig = (x, y1, y2) => { let p = `M${x} ${y1}L${x} ${y1 + 6}`; const n = 6, h = (y2 - y1 - 12) / n; for (let i = 0; i < n; i++) p += `L${x + (i % 2 ? -6 : 6)} ${N(y1 + 6 + h * (i + 0.5))}`; return p + `L${x} ${y2 - 6}L${x} ${y2}`; };
    g += `<g style="fill:none;stroke:var(--fg);stroke-width:1.6;stroke-linejoin:round"><line x1="30" y1="10" x2="100" y2="10" style="stroke-width:3"/><line x1="30" y1="86" x2="100" y2="86" style="stroke-width:3"/><path d="${zig(50, 10, 86)}"/><path d="${zig(80, 10, 86)}"/>`
      + `<line x1="190" y1="10" x2="260" y2="10" style="stroke-width:3"/><line x1="190" y1="86" x2="260" y2="86" style="stroke-width:3"/><path d="${zig(225, 10, 46)}"/><path d="${zig(225, 50, 86)}"/></g>`;
    g += `<text x="65" y="102" font-size="12" font-weight="700" text-anchor="middle">parallel</text><text x="225" y="102" font-size="12" font-weight="700" text-anchor="middle">in Reihe</text>`;
    return `<svg viewBox="0 0 310 240" role="img" aria-label="Zwei Federn parallel und in Reihe und ihre Kennlinien Kraft über Federweg">${g}</svg>`;
  };

  root.KON_VIZ = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  if (typeof document === 'undefined' || !document.getElementById) return;

  /* ============================================================ Anbindung an die Seite */
  const C = root.KON_CORE;
  if (!C) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.kon.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const P = s => C.parseDe(s);
  const DEF = { schr: { d: '8', fk: '8.8', t1: '12', t2: '10', w: '1' }, tol: { sym: 'rundl', tol: '0,03', dia: false, d1: 'A' }, lag: { code: '6204', r1: '12', r2: '4', F: '120' } };
  const stGet = k => Object.assign({}, DEF[k], lsGet(k, {}));
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const card = (key, title, inner) => { const d = document.createElement('div'); d.className = 'card pl vz'; d.setAttribute('data-vz', key); d.innerHTML = `<h4>${title}</h4>${inner}`; return d; };

  const W = {
    schr: {
      view: 'schrView', place: cs => [cs[0], 'after'],
      make() { return card('schr', 'So sieht die Verbindung aus', '<div class="inst fit" data-b="1"></div><p class="cap">Längsschnitt, vereinfachte Skizze. Die Teile sind gegenläufig schraffiert. Schraube, Scheibe und Mutter werden im Längsschnitt nicht geschnitten gezeichnet. Σt ist die Summe der Dicken beider Teile.</p><div class="inst fit" data-k="1"></div>'); },
      upd(n) {
        const s = stGet('schr'), t = C.thread(P(s.d)), t1 = P(s.t1), t2 = P(s.t2), w = +s.w;
        const r = t && t1 > 0 && t2 > 0 ? C.screwLen(t1 + t2, t.d, w) : null, len = r ? (Number.isFinite(r.norm) ? r.norm : r.min) : 0;
        $('[data-b]', n).innerHTML = (r && V.schraube(t, t1, t2, w, len)) || '<p class="hint2" style="padding:8px;margin:0">Gib die Dicken beider Teile ein, dann zeichne ich die Verbindung.</p>';
        $('[data-k]', n).innerHTML = V.loecher(t);
      }
    },
    tol: {
      view: 'tolView', place: cs => [cs[0], 'after'],
      make() { return card('tol', 'Die Toleranzzone', '<div class="inst fit" data-b="1"></div><p class="cap" data-c="1" style="font-weight:600;color:var(--fg)"></p><p class="cap">Gestrichelt: Toleranzzone. Blau: das Istmerkmal, das innerhalb der Zone liegen muss. Die Zone ist zur Anschauung stark vergrößert gezeichnet.</p>'); },
      upd(n) { const s = stGet('tol'); $('[data-c]', n).textContent = V.zoneText(s.sym, !!s.dia) ? 'Die Zone ist: ' + V.zoneText(s.sym, !!s.dia) + '.' : ''; $('[data-b]', n).innerHTML = V.zone(s.sym, !!s.dia, String(s.tol || '').trim(), String(s.d1 || '').trim().toUpperCase().slice(0, 1) || 'A'); }
    },
    lager: {
      view: 'lagView', place: cs => [cs[0], 'after'],
      make() { return card('lager', 'Das Lager im Schnitt', '<div class="inst fit" data-b="1"></div><p class="cap">Vereinfachte Skizze nach dem Kurzzeichen: d Bohrung (Welle), D Außendurchmesser, B Breite. Die Wälzkörper sind je nach Lagerart Kugeln oder Rollen.</p>'); },
      upd(n) { const i = C.brgInfo(stGet('lag').code); $('[data-b]', n).innerHTML = V.lager(i) || '<p class="hint2" style="padding:8px;margin:0">Gib ein erkanntes Kurzzeichen ein, dann sehe ich das Lager im Schnitt.</p>'; }
    },
    fed: {
      view: 'lagView', place: cs => [cs[1], 'after'],
      make() { return card('fed', 'Federkennlinien', '<div class="inst fit" data-b="1"></div><p class="cap">Je steiler die Linie, desto härter die Feder. Parallel ist steiler als jede Einzelfeder, in Reihe flacher. Gestrichelt: die Einzelfedern R1 (blau) und R2 (orange).</p>'); },
      upd(n) { const s = stGet('lag'); $('[data-b]', n).innerHTML = V.federn(P(s.r1), P(s.r2), P(s.F)) || '<p class="hint2" style="padding:8px;margin:0">Gib beide Federraten ein.</p>'; }
    }
  };

  function sync(key) {
    const w = W[key], host = document.getElementById(w.view); if (!host) return;
    let n = host.querySelector(':scope > [data-vz="' + key + '"]');
    const cs = [...host.querySelectorAll(':scope > .card:not(.vz)')];
    if (!cs.length) { if (n) n.remove(); return; }
    if (!n) { n = w.make(); const p = w.place(cs); if (p[0]) p[0].after(n); else host.appendChild(n); }
    w.upd(n);
  }
  Object.keys(W).forEach(key => {
    const host = document.getElementById(W[key].view); if (!host) return;
    new MutationObserver(() => sync(key)).observe(host, { childList: true });
    ['input', 'change', 'click'].forEach(ev => host.addEventListener(ev, e => { if (!e.target.closest('.vz')) sync(key); }));
    sync(key);
  });
})(typeof window !== 'undefined' ? window : globalThis);
