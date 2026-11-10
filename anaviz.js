'use strict';
/* Tonfunk Analogtechnik-Lab: Zusatzgrafiken (Lab-Kennung 'ana'), window.ANA_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an anaui.js auskommt (liest nur window.ANA_UI.S, nichts wird geschrieben):
   Karte "Bauteile und Signal im Bild" im Reiter Prüfstand, zwischen Ampel/Bild und Messgeräten:
   - Schaltbild groß: das Schaltbild des Prüfstands (ANA_DRAW.schematic, gleiche Daten wie im Bild oben) noch einmal in voller Kartenbreite, damit auf dem Handy die Beschriftungen nicht kollidieren.
     Dazu merkt sich ein dünner Wrapper um ANA_DRAW.schematic nur die zuletzt übergebenen Daten; gezeichnet wird mit der Originalfunktion.
   - Bauteil mit realer Bauform und Anschlussbelegung, live: Diode/LED/Z-Diode (Glas DO-35, Kunststoff DO-41, LED 5 mm mit flacher Seite und kurzem Bein),
     Transistor im TO-92 (Anschlüsse C, B, E, Stromdicke ~ Strom, Betriebsbereich, Verlustleistung gegen die Grenze aus ANA_CORE.limit), Operationsverstärker im DIP-8 (Belegung eines
     Einzel-OPV) mit SOIC-8 im gleichen Maßstab und den Spannungen an den Anschlüssen.
   - Widerstände mit Farbring (aus dem aktuellen Wert gerechnet: 4 Ringe E24, 5 Ringe bei drei gültigen Stellen), Baugröße nach Nennleistung 0,25/0,5/1/2 W; beim Vorwiderstand der LED
     wird die kleinste Baugröße gezeigt, deren Nennleistung mindestens das Doppelte der Verlustleistung ist (Faustregel).
   - Verstärkung im Bild: Ein- und Ausgangssignal aus rig.waveform() groß, mit Scheitelwerten, Verstärkung, Phase und Begrenzung (rot); beim Komparator die Schaltschwellen.
   Aufgabenintegrität: Die Karte erscheint NICHT, solange eine Aufgabe läuft (S.task), ein Fehler verdeckt ist (Fehlersuche, S.hidden/state().verdeckt) oder die Anzeige nicht gelesen werden kann.
   Es werden keine Fehlerstellen markiert und keine Fehlercodes gelesen; alle Zahlen stammen aus rig.state(), rig.waveform() und ANA_CORE.limit. Keine Animation, keine Bibliothek, Farben nur über Variablen (und hsl für Farbringe). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n1 = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  /* Zahl mit Dezimalkomma, drei gültige Stellen, echtes Minus */
  function fz(v, d) { if (!fin(v)) return '–'; const s = String(+v.toPrecision(d || 3)); return s.replace('.', ',').replace('-', '−'); }
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
  function eng(v, u) {
    if (!fin(v)) return '–'; if (v === 0) return '0 ' + u;
    const a = Math.abs(v); let p = PRE[PRE.length - 1]; for (const q of PRE) { if (a >= q[0] * 0.9995) { p = q; break; } }
    return fz(v / p[0], 4) + ' ' + p[1] + u;
  }
  /* größte runde Zahl 1, 2 oder 5 mal Zehnerpotenz, die nicht über v liegt */
  function niceBelow(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  /* ---------------------------------------------------------------- Farbring */
  const RING = [
    ['schwarz', 'hsl(0 0% 9%)'], ['braun', 'hsl(24 62% 30%)'], ['rot', 'hsl(2 78% 47%)'], ['orange', 'hsl(28 95% 52%)'], ['gelb', 'hsl(52 95% 55%)'],
    ['grün', 'hsl(130 55% 36%)'], ['blau', 'hsl(220 72% 48%)'], ['violett', 'hsl(285 50% 46%)'], ['grau', 'hsl(0 0% 55%)'], ['weiß', 'hsl(0 0% 96%)']
  ];
  const GOLD = ['gold', 'hsl(43 72% 50%)'], SILVER = ['silber', 'hsl(0 0% 76%)'];
  /* Ringe eines Widerstands: 2 gültige Stellen -> 4 Ringe (gold ±5 %), 3 gültige Stellen -> 5 Ringe (braun ±1 %), sonst null */
  function bands(R) {
    if (!fin(R) || R <= 0) return null;
    const e = Math.floor(Math.log10(R) + 1e-12);
    const tryN = nd => {
      const mult = e - (nd - 1), dig = Math.round(R / Math.pow(10, mult));
      if (Math.abs(dig * Math.pow(10, mult) - R) > R * 1e-9 || dig < Math.pow(10, nd - 1) || dig >= Math.pow(10, nd)) return null;
      if (mult < -2 || mult > 9) return null;
      const ds = String(dig).split('').map(Number), mc = mult === -1 ? GOLD : mult === -2 ? SILVER : RING[mult];
      return { n: nd + 2, digits: ds, rings: ds.map(d => RING[d]).concat([mc, nd === 2 ? GOLD : RING[1]]) };
    };
    return tryN(2) || tryN(3);
  }
  const RATINGS = [{ w: 0.25, l: 6.3, d: 2.5 }, { w: 0.5, l: 9, d: 3.3 }, { w: 1, l: 11.5, d: 4.5 }, { w: 2, l: 15.5, d: 5.5 }];
  const ratingTxt = w => (w === 0.25 ? '0,25 W' : w === 0.5 ? '0,5 W' : w + ' W');
  /* kleinste Baugröße, deren Nennleistung mindestens das Doppelte der Verlustleistung ist (Faustregel); null = über 2 W */
  function ratingFor(p) { if (!fin(p) || p < 0) return RATINGS[0]; for (const r of RATINGS) if (r.w >= 2 * p - 1e-12) return r; return null; }

  /* ---------------------------------------------------------------- kleine SVG-Bausteine */
  const T = (x, y, s, o) => {
    o = o || {}; return `<text x="${n1(x)}" y="${n1(y)}" font-size="${o.size || 12}" fill="${o.fill || 'var(--fg)'}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${esc(s)}</text>`;
  };
  /* Text in mehreren Zeilen (Zeichen je Zeile begrenzt); Rückgabe { svg, h } */
  function TW(x, y, str, maxc, o) {
    o = o || {}; const size = o.size || 12, lh = size + 3, words = String(str).split(' '), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > maxc) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) lines.push(cur);
    return { svg: lines.map((l, k) => T(x, y + k * lh, l, o)).join(''), h: lines.length * lh };
  }
  const L = (x1, y1, x2, y2, st, w, dash, extra) => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" stroke="${st}" stroke-width="${num(w || 1)}"${dash ? ` stroke-dasharray="${dash}"` : ''}${extra || ''}/>`;
  const R = (x, y, w, h, fill, st, rx, extra) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(Math.max(0, w))}" height="${n1(Math.max(0, h))}" fill="${fill}"${st ? ` stroke="${st}" stroke-width="1"` : ''}${rx ? ` rx="${rx}"` : ''}${extra || ''}/>`;
  /* Pfeil entlang einer senkrechten oder waagerechten Linie, Dicke ~ Strom (stark gestaucht) */
  const iw = i => (fin(i) ? clamp(2 + 2.2 * Math.log10(1 + Math.abs(i) / 1e-4), 2, 9) : 2);
  function arrow(x1, y1, x2, y2, col, w) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, h = Math.max(6, w * 1.6), px = -uy, py = ux;
    const bx = x2 - ux * h, by = y2 - uy * h;
    return L(x1, y1, bx, by, col, w) + `<polygon points="${n1(x2)},${n1(y2)} ${n1(bx + px * h * 0.6)},${n1(by + py * h * 0.6)} ${n1(bx - px * h * 0.6)},${n1(by - py * h * 0.6)}" fill="${col}"/>`;
  }
  const frame = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}" font-family="system-ui,sans-serif" class="av-svg"><title>${esc(label)}</title>${body}</svg>`;
  const lim = (core, id) => { try { const l = core && core.limit && core.limit(id); return l && fin(+l.value) ? +l.value : NaN; } catch (e) { return NaN; } };

  /* ---------------------------------------------------------------- Widerstand mit Farbring (Baugröße nach Nennleistung) */
  /* Zeichnet einen Widerstand mit Mittelpunkt (cx, cy) im Maßstab s Pixel je mm; Rückgabe { svg, w } */
  function resistor(cx, cy, rt, val, s) {
    const b = bands(val), len = rt.l * s, d = rt.d * s, x0 = cx - len / 2, fifth = b && b.n === 5;
    let g = L(x0 - 9, cy, x0, cy, 'var(--mute)', 2.2) + L(x0 + len, cy, x0 + len + 9, cy, 'var(--mute)', 2.2);
    g += R(x0, cy - d / 2, len, d, fifth ? 'hsl(200 38% 66%)' : 'hsl(38 48% 72%)', 'hsl(30 20% 35%)', Math.min(d / 2, 5), ' data-av="res"');
    if (b) {
      const pos = fifth ? [0.12, 0.23, 0.34, 0.45, 0.8] : [0.15, 0.29, 0.43, 0.8], bw = Math.max(2.4, len * 0.065);
      b.rings.forEach((r, k) => { g += R(x0 + len * pos[k] - bw / 2, cy - d / 2 + 0.6, bw, d - 1.2, r[1], 'hsl(0 0% 20% / .5)', 0, ' data-av="ring"'); });
    }
    return { svg: g, w: len + 18, b };
  }
  const ringText = b => (b ? b.rings.map(r => r[0]).join('–') : 'kein Normfarbring');

  /* ---------------------------------------------------------------- Widerstandsstreifen (mehrere Widerstände der Schaltung) */
  function resistorStrip(items) {
    items = (items || []).filter(it => it && fin(it.v) && it.v > 0 && it.v < 1e11); if (!items.length) return '';
    const two = items.length > 3, W = 330, rt = RATINGS[0], s = 8, cw = two ? 165 : 330, ch = two ? 58 : 44, rows = Math.ceil(items.length / (two ? 2 : 1)), H = 22 + rows * ch;
    let g = T(0, 13, 'Widerstände mit Farbring (Baugröße 0,25 W im Maßstab)', { size: 12, fill: 'var(--mute)' });
    items.forEach((it, k) => {
      const col = two ? k % 2 : 0, row = two ? Math.floor(k / 2) : k, x = col * cw, y = 22 + row * ch;
      if (two) { const r = resistor(x + 40, y + 28, rt, it.v, s); g += T(x, y + 12, it.n + '  ' + eng(it.v, 'Ω'), { size: 13, weight: 700 }) + r.svg + T(x, y + 52, ringText(r.b), { size: 11, fill: 'var(--mute)' }); }
      else { const cy = y + 16, r = resistor(70, cy, rt, it.v, s); g += T(0, cy + 4, it.n, { size: 13, weight: 700 }) + r.svg + T(130, cy - 2, eng(it.v, 'Ω'), { size: 13, weight: 700 }) + T(130, cy + 13, ringText(r.b), { size: 11.5, fill: 'var(--mute)' }); }
    });
    return frame(W, H, g, 'Widerstände mit Farbring: ' + items.map(it => it.n + ' ' + eng(it.v, 'Ω')).join(', '));
  }

  /* ---------------------------------------------------------------- Diode, LED, Z-Diode */
  const LEDCOL = { led_rot: 'hsl(2 82% 50%)', led_gelb: 'hsl(48 96% 52%)', led_gruen: 'hsl(130 64% 40%)', led_blau: 'hsl(215 86% 56%)' };
  const TYPNAME = { si: 'Silizium-Diode, Glasgehäuse (DO-35)', schottky: 'Schottky-Diode, Kunststoffgehäuse (DO-41)', z: 'Z-Diode, Glasgehäuse (DO-35)', led_rot: 'LED rot, 5 mm', led_gelb: 'LED gelb, 5 mm', led_gruen: 'LED grün, 5 mm', led_blau: 'LED blau, 5 mm' };
  function diodeSvg(st, core) {
    const typ = String(st.typ || 'led_rot'), W = 330, isLed = typ.indexOf('led') === 0, id = fin(st.id) ? Math.abs(st.id) : 0, iz = fin(st.iz) ? Math.abs(st.iz) : 0;
    const cur = typ === 'z' ? Math.max(id, iz) : id, rev = typ === 'z', ud = fin(st.ud) ? Math.abs(st.ud) : NaN;
    const col = 'var(--warn)', ucol = 'var(--accent)', w = iw(cur);
    let g = '', H;
    if (isLed) {
      const s = 12, cx = 62, top = 10, rD = 2.5 * s, rimY = top + rD + (8.7 - 2.5 - 1) * s, flange = 2.9 * s;
      const c = LEDCOL[typ] || LEDCOL.led_rot, imax = lim(core, 'led_imax'), frac = fin(imax) && imax > 0 ? clamp(cur / imax, 0, 1.4) : clamp(cur / 0.02, 0, 1.4);
      const legY = rimY + s, legL = 62;
      /* Leuchtfeld hinter der Linse: Deckkraft folgt dem Strom */
      g += `<circle cx="${cx}" cy="${n1(top + rD)}" r="${n1(rD + 16)}" fill="${c}" opacity="${num(clamp(frac, 0, 1) * 0.4)}"/>`;
      g += `<path d="M${cx - rD},${n1(rimY)} L${cx - rD},${n1(top + rD)} A${rD},${rD} 0 0 1 ${cx + rD},${n1(top + rD)} L${cx + rD},${n1(rimY)} Z" fill="${c}" fill-opacity="${num(0.45 + 0.4 * clamp(frac, 0, 1))}" stroke="var(--fg)" stroke-width="1.2"/>`;
      /* Flansch mit flacher Seite (Kathode, rechts) */
      g += `<path d="M${cx - flange},${n1(rimY)} L${cx + flange - 5},${n1(rimY)} L${cx + flange - 5},${n1(rimY + s)} L${cx - flange},${n1(rimY + s)} Z" fill="${c}" fill-opacity=".55" stroke="var(--fg)" stroke-width="1.2"/>`;
      g += L(cx + flange - 5, rimY, cx + flange - 5, rimY + s, 'var(--fg)', 2.4);
      g += L(cx - 14, top + rD - 4, cx - 14, rimY - 6, 'var(--fg)', 1, '', ' opacity=".35"') + L(cx + 14, top + rD - 4, cx + 14, rimY - 6, 'var(--fg)', 1, '', ' opacity=".35"');
      const ax = cx - 16, kx = cx + 16;
      g += L(ax, legY, ax, legY + legL, 'var(--mute)', 3) + L(kx, legY, kx, legY + legL - 20, 'var(--mute)', 3);
      g += arrow(ax - 9, legY + legL - 4, ax - 9, legY + 8, col, w) + arrow(kx + 9, legY + 6, kx + 9, legY + legL - 28, col, w);
      g += T(ax, legY + legL + 15, 'A', { size: 13, weight: 700, anchor: 'middle' }) + T(kx, legY + legL + 15, 'K', { size: 13, weight: 700, anchor: 'middle' });
      H = Math.round(legY + legL + 24);
      const x0 = 142;
      g += T(x0, 22, TYPNAME[typ] || 'LED', { size: 13, weight: 700 });
      g += T(x0, 42, 'I_D = ' + eng(cur, 'A'), { size: 14, weight: 700, fill: col });
      g += T(x0, 62, 'U_F = ' + (fin(ud) ? eng(ud, 'V') : '–'), { size: 14, weight: 700, fill: ucol });
      g += T(x0, 84, 'Anode (+): längeres Bein', { size: 12, fill: 'var(--mute)' }) + T(x0, 100, 'Kathode (−): flache Seite,', { size: 12, fill: 'var(--mute)' }) + T(x0, 115, 'kürzeres Bein', { size: 12, fill: 'var(--mute)' });
      if (fin(imax)) {
        const bw = 170, y = 134; g += R(x0, y, bw, 12, 'var(--panel2)', 'var(--line)', 6) + R(x0, y, bw * clamp(cur / imax, 0, 1), 12, frac > 1 ? 'var(--danger)' : col, '', 6, ' data-av="bar"');
        g += TW(x0, y + 26, 'Strom im Verhältnis zu ' + eng(imax, 'A') + ' (Grenzwert, Übungswert)', 31, { size: 11.5, fill: 'var(--mute)' }).svg;
      }
      H = Math.max(H, 190);
    } else {
      const s = 16, y = 52, glass = typ !== 'schottky', len = (glass ? 3.5 : 5.2) * s, d = (glass ? 1.6 : 2.7) * s, cx = 150, x0 = cx - len / 2;
      const body = glass ? (typ === 'z' ? 'hsl(25 45% 36%)' : 'hsl(28 88% 56%)') : 'hsl(220 8% 16%)', band = glass ? 'hsl(0 0% 8%)' : 'hsl(0 0% 78%)';
      g += L(24, y, x0, y, 'var(--mute)', 3) + L(x0 + len, y, 276, y, 'var(--mute)', 3);
      g += R(x0, y - d / 2, len, d, body, 'var(--fg)', glass ? d / 2 : 3, ' fill-opacity=".92"');
      g += R(x0 + len * 0.74, y - d / 2 + 0.6, len * 0.12, d - 1.2, band, '', 0);
      const flowRight = !rev, ay = y - d / 2 - 18;
      g += flowRight ? arrow(34, ay, 266, ay, col, w) : arrow(266, ay, 34, ay, col, w);
      g += T(24, y + d / 2 + 22, 'Anode (+)', { size: 12.5, weight: 600 }) + T(276, y + d / 2 + 22, 'Kathode (−)', { size: 12.5, weight: 600, anchor: 'end' });
      g += T(x0 + len * 0.8, y + d / 2 + 38, 'Ring = Kathode', { size: 11.5, fill: 'var(--mute)', anchor: 'middle' });
      g += T(0, 118, TYPNAME[typ] || 'Diode', { size: 13, weight: 700 });
      g += T(0, 138, (typ === 'z' ? 'I_Z = ' : 'I_D = ') + eng(cur, 'A'), { size: 14, weight: 700, fill: col }) + T(150, 138, (typ === 'z' ? 'U_Z = ' : 'U_F = ') + (fin(ud) ? eng(ud, 'V') : '–'), { size: 14, weight: 700, fill: ucol });
      H = 150;
    }
    const lbl = (TYPNAME[typ] || 'Diode') + ', I = ' + eng(cur, 'A') + (fin(ud) ? ', U = ' + eng(ud, 'V') : '');
    return frame(W, H, g, lbl);
  }
  /* Vorwiderstand der Diodenschaltung in der kleinsten passenden Baugröße */
  function diodeResistor(st) {
    const rv = fin(st.rv) ? st.rv : NaN, pr = fin(st.pr) ? st.pr : NaN; if (!fin(rv) || rv <= 0) return '';
    const rt = ratingFor(pr), draw = rt || RATINGS[RATINGS.length - 1], W = 330, s = 12, r = resistor(100, 38, draw, rv, s);
    let g = T(0, 13, 'Vorwiderstand R_V in der passenden Baugröße', { size: 12, fill: 'var(--mute)' });
    g += r.svg;
    g += T(215, 38, eng(rv, 'Ω'), { size: 14, weight: 700 });
    const ry = 38 + draw.d * s / 2 + 16;
    g += T(0, ry, 'Ringe: ' + ringText(r.b), { size: 11.5, fill: 'var(--mute)' });
    const tx = TW(0, ry + 20, 'P_R = ' + eng(pr, 'W') + ' → ' + (rt ? 'mindestens ' + ratingTxt(rt.w) + ' (Faustregel: Nennleistung ≥ 2 · P_R)' : 'über 2 W: Leistungswiderstand nötig'), 54, { size: 12, fill: rt ? 'var(--fg)' : 'var(--danger)' });
    g += tx.svg; const H = Math.round(ry + 20 + tx.h + 4);
    return frame(W, H, g, 'Vorwiderstand ' + eng(rv, 'Ω') + ', Verlustleistung ' + eng(pr, 'W') + ', ' + (rt ? 'Baugröße ' + ratingTxt(rt.w) : 'über 2 W'));
  }

  /* ---------------------------------------------------------------- Transistor im TO-92 */
  const ZUSTAND = { sperrt: 'Sperrbereich', sperr: 'Sperrbereich', aktiv: 'aktiver Bereich', saettigung: 'Sättigung', sattigung: 'Sättigung' };
  function transistorSvg(st, core) {
    const W = 330, s = 15, bw = 4.8 * s, cx = 78, top = 14, bodyH = 5.4 * s, pitch = 1.27 * s * 1.4, leadY = top + bodyH, leadL = 64;
    const ic = fin(st.ic) ? Math.abs(st.ic) : 0, hasB = fin(st.ib), ib = hasB ? Math.abs(st.ib) : NaN, ie = hasB ? ic + ib : ic, uce = fin(st.uce) ? st.uce : NaN, zs = String(st.zustand || '');
    const xs = [cx - pitch, cx, cx + pitch], col = 'var(--warn)';
    let g = `<path d="M${n1(cx - bw / 2)},${n1(leadY)} L${n1(cx - bw / 2)},${n1(top + bw / 2)} A${n1(bw / 2)},${n1(bw / 2)} 0 0 1 ${n1(cx + bw / 2)},${n1(top + bw / 2)} L${n1(cx + bw / 2)},${n1(leadY)} Z" fill="hsl(220 8% 16%)" stroke="var(--fg)" stroke-width="1.2"/>`;
    g += `<path d="M${n1(cx - bw / 2 + 5)},${n1(leadY - 5)} L${n1(cx - bw / 2 + 5)},${n1(top + bw / 2 + 1)} A${n1(bw / 2 - 5)},${n1(bw / 2 - 5)} 0 0 1 ${n1(cx + bw / 2 - 5)},${n1(top + bw / 2 + 1)} L${n1(cx + bw / 2 - 5)},${n1(leadY - 5)} Z" fill="none" stroke="hsl(0 0% 60% / .35)" stroke-width="1"/>`;
    g += T(cx, top + bw / 2 + 12, 'flache Seite', { size: 11, fill: 'hsl(0 0% 78%)', anchor: 'middle' });
    xs.forEach(x => { g += L(x, leadY, x, leadY + leadL, 'var(--mute)', 3.2); });
    g += arrow(xs[0] - 8, leadY + 52, xs[0] - 8, leadY + 8, col, iw(ic)) + (hasB ? arrow(xs[1], leadY + 52, xs[1], leadY + 8, col, iw(ib)) : '') + arrow(xs[2] + 8, leadY + 8, xs[2] + 8, leadY + 52, col, iw(ie));
    ['C', 'B', 'E'].forEach((c, k) => { g += T(xs[k], leadY + leadL + 16, c, { size: 14, weight: 700, anchor: 'middle' }); });
    const x0 = 150;
    g += T(x0, 22, 'NPN im TO-92 (von vorn)', { size: 13, weight: 700 });
    let ry = 44; const row = (t, c) => { g += T(x0, ry, t, { size: 14, weight: 700, fill: c }); ry += 20; };
    row('I_C = ' + eng(ic, 'A'), col); if (hasB) row('I_B = ' + eng(ib, 'A'), col); row('I_E = ' + eng(ie, 'A'), col); if (fin(uce)) row('U_CE = ' + eng(uce, 'V'), 'var(--accent)');
    const zt = ZUSTAND[zs] || '', zc = zs === 'saettigung' ? 'var(--accent)' : zs === 'aktiv' ? 'var(--ok)' : 'var(--mute)';
    if (zt) { g += R(x0, ry - 6, 160, 24, 'var(--panel2)', zc, 12) + T(x0 + 80, ry + 11, zt, { size: 13, weight: 700, anchor: 'middle', fill: zc }); ry += 30; }
    const ptot = lim(core, 'ptot'), pc = fin(uce) ? Math.abs(uce * ic) : NaN;
    let y = Math.max(ry + 8, 150);
    if (fin(pc)) g += T(x0, y, 'P_C = U_CE · I_C = ' + eng(pc, 'W'), { size: 12.5, weight: 600 });
    if (fin(ptot) && fin(pc)) { y += 10; g += R(x0, y, 160, 10, 'var(--panel2)', 'var(--line)', 5) + R(x0, y, 160 * clamp(pc / ptot, 0, 1), 10, pc > ptot ? 'var(--danger)' : 'var(--ok)', '', 5, ' data-av="bar"'); g += T(x0, y + 24, 'von ' + eng(ptot, 'W') + ' (Übungswert)', { size: 11.5, fill: 'var(--mute)' }); y += 28; }
    const ny = Math.max(200, y + 14), nt = TW(0, ny, 'Anschlussfolge je Typ verschieden (hier Beispiel C – B – E): im Datenblatt nachsehen. Pfeildicke wächst mit dem Strom (stark gestaucht).', 54, { size: 11.5, fill: 'var(--mute)' });
    g += nt.svg;
    return frame(W, Math.round(ny + nt.h + 6), g, 'Transistor im TO-92, I_C ' + eng(ic, 'A') + (hasB ? ', I_B ' + eng(ib, 'A') : '') + (fin(uce) ? ', U_CE ' + eng(uce, 'V') : '') + (zt ? ', ' + zt : ''));
  }
  /* Widerstände je Schaltung (Namen wie im Schaltbild) */
  function transistorResistors(rigId, st) {
    const it = (n, v) => ({ n, v });
    if (rigId === 'schalter') return [it('R_B', st.rb)].concat(st.last === 'led' ? [it('R_V', st.rv)] : st.last === 'ohm' ? [it('R_L', st.rlast)] : []);
    if (rigId === 'emitter') return [it('R_1', st.r1), it('R_2', st.r2), it('R_C', st.rc), it('R_E1', st.re1), it('R_E2', st.re2), it('R_G', st.rg), it('R_L', st.rl < 1e6 ? st.rl : NaN)];
    if (rigId === 'folger' && st.betrieb === 'signal') return st.schaltung === 'kollektor' ? [it('R_1', st.r1), it('R_2', st.r2), it('R_E1', st.re1), it('R_E2', st.re2), it('R_G', st.rg), it('R_L', st.rl)] : st.schaltung === 'basis' ? [it('R_1', st.r1), it('R_2', st.r2), it('R_C', st.rc), it('R_E1', st.re1), it('R_L', st.rl)] : [it('R_1', st.r1), it('R_2', st.r2), it('R_C', st.rc), it('R_E1', st.re1), it('R_E2', st.re2), it('R_G', st.rg), it('R_L', st.rl)];
    return [];
  }

  /* ---------------------------------------------------------------- Operationsverstärker im DIP-8 und SOIC-8 */
  function opvSvg(rigId, st) {
    const W = 330, s = 10, bx = 130, bw = 6.35 * s, bl = 9.3 * s, top = 22, pitch = 2.54 * s, uv = fin(st.uv) ? st.uv : NaN, sch = String(st.schaltung || '');
    const ua = fin(st.uaPeak) ? st.uaPeak : NaN, usat = fin(st.usat) ? st.usat : NaN, ue = fin(st.ue) ? st.ue : NaN;
    const inv = rigId === 'opv_inv' || (rigId === 'opv_aktiv' && sch !== 'real'), nin = rigId === 'opv_nin' && (sch === 'nichtinvertierend' || sch === 'folger');
    let g = `<rect x="${n1(bx - bw / 2)}" y="${top}" width="${n1(bw)}" height="${n1(bl)}" rx="3" fill="hsl(220 8% 16%)" stroke="var(--fg)" stroke-width="1.2"/>`;
    g += `<path d="M${n1(bx - 8)},${top} A8,8 0 0 0 ${n1(bx + 8)},${top}" fill="none" stroke="hsl(0 0% 70%)" stroke-width="1.4"/>`;
    g += `<circle cx="${n1(bx - bw / 2 + 10)}" cy="${top + 12}" r="3.4" fill="hsl(0 0% 70% / .55)"/>`;
    g += T(bx, top + bl / 2 + 4, 'OPV', { size: 13, weight: 700, anchor: 'middle', fill: 'hsl(0 0% 85%)' });
    const ys = [0, 1, 2, 3].map(k => top + 14 + k * pitch);
    /* Anschlüsse 1 bis 4 links (oben nach unten), 8 bis 5 rechts */
    const left = [
      { n: 1, t: 'Offset', sub: '', c: 'var(--mute)' }, { n: 2, t: '− Eingang', sub: inv ? '≈ 0 V' : '', c: 'var(--accent)' },
      { n: 3, t: '+ Eingang', sub: nin && fin(ue) ? 'û ' + eng(ue, 'V') : inv ? '0 V (Masse)' : '', c: 'var(--accent)' }, { n: 4, t: '−U_v', sub: fin(uv) ? '−' + eng(uv, 'V').replace('-', '') : '', c: 'var(--danger)' }];
    const right = [
      { n: 8, t: 'n. c.', sub: '', c: 'var(--mute)' }, { n: 7, t: '+U_v', sub: fin(uv) ? '+' + eng(uv, 'V') : '', c: 'var(--danger)' },
      { n: 6, t: 'Ausgang', sub: fin(ua) ? 'û ' + eng(ua, 'V') : '', c: 'var(--ok)' }, { n: 5, t: 'Offset', sub: '', c: 'var(--mute)' }];
    left.forEach((p, k) => { const y = ys[k]; g += R(bx - bw / 2 - 12, y - 2.5, 12, 5, 'var(--mute)', '', 1) + T(bx - bw / 2 - 18, y - 2, p.n + '  ' + p.t, { size: 12, weight: 700, anchor: 'end', fill: p.c }) + (p.sub ? T(bx - bw / 2 - 18, y + 11, p.sub, { size: 11.5, anchor: 'end', fill: 'var(--mute)' }) : ''); });
    right.forEach((p, k) => { const y = ys[k]; g += R(bx + bw / 2, y - 2.5, 12, 5, 'var(--mute)', '', 1) + T(bx + bw / 2 + 18, y - 2, p.n + '  ' + p.t, { size: 12, weight: 700, fill: p.c }) + (p.sub ? T(bx + bw / 2 + 18, y + 11, p.sub, { size: 11.5, fill: 'var(--mute)' }) : ''); });
    /* SOIC-8 im gleichen Maßstab: Körper 4,9 x 3,9 mm, Anschlussraster 1,27 mm */
    const sx = 282, sw = 3.9 * s, sl = 4.9 * s, sp = 1.27 * s, sy = top + 18;
    g += `<rect x="${n1(sx - sw / 2)}" y="${n1(sy)}" width="${n1(sw)}" height="${n1(sl)}" rx="2" fill="hsl(220 8% 16%)" stroke="var(--fg)" stroke-width="1"/>`;
    for (let k = 0; k < 4; k++) { const y = sy + 4 + k * sp; g += R(sx - sw / 2 - 5, y - 1.2, 5, 2.4, 'var(--mute)', '', 0.5) + R(sx + sw / 2, y - 1.2, 5, 2.4, 'var(--mute)', '', 0.5); }
    g += `<circle cx="${n1(sx - sw / 2 + 6)}" cy="${n1(sy + 6)}" r="1.8" fill="hsl(0 0% 70% / .6)"/>`;
    g += T(sx, sy + sl + 17, 'SOIC-8', { size: 12, weight: 700, anchor: 'middle' }) + T(sx, sy + sl + 31, '(SMD, gleicher', { size: 11, anchor: 'middle', fill: 'var(--mute)' }) + T(sx, sy + sl + 43, 'Maßstab)', { size: 11, anchor: 'middle', fill: 'var(--mute)' });
    g += T(bx, top + bl + 22, 'DIP-8, Draufsicht (Kerbe oben)', { size: 12, weight: 700, anchor: 'middle' });
    const note = 'Belegung eines Einzel-OPV (typisch, Datenblatt prüfen). Bei dieser Schaltung sind die Anschlüsse 1, 5 und 8 unbeschaltet.';
    const H = top + bl + 56;
    return frame(W, H, g, 'Operationsverstärker im DIP-8 mit Anschlussbelegung und im SOIC-8 gleichen Maßstabs') + `<p class="av-note">${esc(note)}</p>`;
  }
  function opvResistors(rigId, st) {
    const it = (n, v) => ({ n, v }), sch = String(st.schaltung || '');
    if (rigId === 'opv_inv') return sch === 'summierer' ? [it('R_1', st.r1), it('R_2', st.r2), it('R_3', st.r3), it('R_f', st.rf), it('R_L', st.rl)] : [it('R_1', st.r1), it('R_f', st.rf), it('R_L', st.rl)];
    if (rigId === 'opv_nin') return sch === 'folger' ? [it('R_L', st.rl)] : sch === 'differenz' ? [it('R_1', st.r1), it('R_2', st.r2), it('R_3', st.r3), it('R_4', st.r4), it('R_L', st.rl)] : [it('R_g', st.rg), it('R_f', st.rf), it('R_L', st.rl)];
    if (rigId === 'opv_komp') return sch === 'komparator' ? [] : sch === 'rechteck' ? [it('R_T', st.rt), it('R_2', st.r2), it('R_3', st.r3)] : sch === 'schmitt_nin' ? [it('R_1', st.r1), it('R_2', st.r2)] : [it('R_2', st.r2), it('R_3', st.r3)];
    if (rigId === 'opv_aktiv') return [it('R_1', st.r1), it('R_f', st.rf < 1e10 ? st.rf : NaN)];
    return [];
  }

  /* ---------------------------------------------------------------- Signalbild */
  function thin(a, n) { if (!Array.isArray(a)) return []; if (a.length <= n) return a; const o = [], k = (a.length - 1) / (n - 1); for (let i = 0; i < n; i++) o.push(a[Math.round(i * k)]); return o; }
  const clean = a => Array.isArray(a) && a.length >= 8 && a.every(fin);
  /* wf = rig.waveform(): { tUnit, t[], series:[{name, unit, kind, y[]}], marks:{h:[{y,name}]} }; opts: { title, usat, vu, komp } */
  function signalSvg(wf, opts) {
    opts = opts || {}; if (!wf || !Array.isArray(wf.series) || wf.series.length < 2 || !clean(wf.t)) return '';
    const a = wf.series[0], b = wf.series[1]; if (!a || !b || !clean(a.y) || !clean(b.y) || a.y.length !== wf.t.length || b.y.length !== wf.t.length) return '';
    const W = 330, H = 196, left = 44, right = 8, top = 34, bot = 28, pw = W - left - right, ph = H - top - bot, N = 200;
    const pk = arr => arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0), pa = pk(a.y), pb = pk(b.y), usat = fin(opts.usat) && opts.usat > 0 ? opts.usat : NaN;
    const marks = ((wf.marks && wf.marks.h) || []).filter(m => m && fin(m.y));
    let A = Math.max(pa, pb, ...marks.map(m => Math.abs(m.y)), fin(usat) && pb >= usat * 0.98 ? usat : 0) * 1.12; if (!(A > 0)) A = 1;
    const t0 = wf.t[0], t1 = wf.t[wf.t.length - 1], dt = t1 - t0 || 1, X = t => left + (t - t0) / dt * pw, Y = v => top + ph / 2 - v / A * (ph / 2);
    let g = T(0, 14, opts.title || 'Eingang und Ausgang', { size: 12.5, weight: 700 });
    g += R(left, top, pw, ph, 'var(--panel2)', 'var(--line)', 4, ' opacity=".55"');
    g += L(left, Y(0), left + pw, Y(0), 'var(--chart-axis)', 1);
    const tk = niceBelow(A * 0.9);
    g += L(left, Y(tk), left + pw, Y(tk), 'var(--chart-grid)', 1) + L(left, Y(-tk), left + pw, Y(-tk), 'var(--chart-grid)', 1);
    g += T(left - 5, Y(tk) + 4, eng(tk, 'V'), { size: 11, anchor: 'end', fill: 'var(--mute)' }) + T(left - 5, Y(0) + 4, '0', { size: 11, anchor: 'end', fill: 'var(--mute)' }) + T(left - 5, Y(-tk) + 4, eng(-tk, 'V'), { size: 11, anchor: 'end', fill: 'var(--mute)' });
    if (fin(usat) && usat < A) { const gc = opts.komp ? 'var(--mute)' : 'var(--danger)'; [usat, -usat].forEach(u => { g += L(left, Y(u), left + pw, Y(u), gc, 1, '2 4'); }); g += T(left + pw - 3, Y(-usat) + 12, '±' + eng(usat, 'V') + ' (Aussteuergrenze)', { size: 10.5, anchor: 'end', fill: gc }); }
    marks.forEach(m => { g += L(left, Y(m.y), left + pw, Y(m.y), 'var(--warn)', 1, '5 3') + T(left + 3, Y(m.y) - 3, String(m.name || '') + ' = ' + eng(m.y, 'V'), { size: 10.5, fill: 'var(--warn)' }); });
    const tthin = thin(wf.t, N), path = arr => thin(arr, N).map((v, k) => (k ? 'L' : 'M') + n1(X(tthin[k])) + ' ' + n1(Y(clamp(v, -A * 1.5, A * 1.5)))).join('');
    g += `<path d="${path(a.y)}" fill="none" stroke="var(--accent)" stroke-width="2.2" data-av="in"/>`;
    g += `<path d="${path(b.y)}" fill="none" stroke="var(--ok)" stroke-width="2.4" stroke-dasharray="8 4" data-av="out"/>`;
    /* begrenzte Abschnitte des Ausgangs rot */
    if (fin(usat) && !opts.komp) { const ty = thin(b.y, N), tt = thin(wf.t, N); let seg = ''; ty.forEach((v, k) => { if (Math.abs(v) >= usat * 0.995) seg += `<circle cx="${n1(X(tt[k]))}" cy="${n1(Y(v))}" r="2.2" fill="var(--danger)"/>`; }); g += seg; }
    const clipped = fin(usat) && !opts.komp && pb >= usat * 0.995;
    g += T(left, H - 8, 'Zeit in ' + (wf.tUnit || 's'), { size: 11, fill: 'var(--mute)' });
    /* Scheitelwerte und Verstärkung */
    const tx = left + pw;
    g += T(tx, H - 8, 'û_e ' + eng(pa, 'V') + ' · û_a ' + eng(pb, 'V'), { size: 11.5, anchor: 'end', weight: 700 });
    const ratio = pa > 1e-12 ? pb / pa : NaN;
    let leg = '';
    leg += L(left, 24, left + 18, 24, 'var(--accent)', 2.2) + T(left + 22, 28, String(a.name || 'Eingang'), { size: 11.5 });
    const x2 = left + 22 + Math.min(110, String(a.name || 'Eingang').length * 6.4) + 12;
    leg += L(x2, 24, x2 + 18, 24, 'var(--ok)', 2.4, '8 4') + T(x2 + 22, 28, String(b.name || 'Ausgang'), { size: 11.5 });
    g += leg;
    const parts = []; if (opts.komp) { /* keine Verstärkung beim Komparator */ } else if (!opts.noV) { if (fin(opts.vu)) parts.push((opts.vlabel || 'V') + ' = ' + fz(opts.vu, 4)); else if (fin(ratio) && !clipped) parts.push('V ≈ ' + fz(ratio, 3)); if (fin(opts.vu) && opts.vu < 0) parts.push('Phase 180°'); }
    if (clipped) parts.push('Ausgang begrenzt');
    const desc = (opts.title || 'Signal') + ': Eingang Scheitel ' + eng(pa, 'V') + ', Ausgang Scheitel ' + eng(pb, 'V') + (parts.length ? ', ' + parts.join(', ') : '');
    return frame(W, H, g, desc) + (parts.length ? `<p class="av-note av-strong"${clipped ? ' data-clip="1"' : ''}>${esc(parts.join(' · '))}</p>` : '');
  }

  /* ---------------------------------------------------------------- Zusammenbau je Prüfstand */
  function build(rigId, st, wf, core) {
    const out = []; st = st || {};
    const add = (id, title, html) => { if (html) out.push({ id, title, html }); };
    if (rigId === 'diode') { add('teil', 'Bauteil und Strom', diodeSvg(st, core)); add('rv', 'Widerstand', diodeResistor(st)); }
    else if (rigId === 'schalter' || rigId === 'emitter' || (rigId === 'folger' && st.betrieb !== 'zener' && st.betrieb !== 'konstantstrom' && st.schaltung)) {
      if (rigId === 'folger' && !fin(st.ic)) { /* keine Transistorzahlen */ } else add('teil', 'Transistor', transistorSvg(st, core));
      add('rw', 'Widerstände', resistorStrip(transistorResistors(rigId, st)));
      if (rigId === 'emitter' || (rigId === 'folger' && st.betrieb === 'signal')) add('sig', 'Signal', signalSvg(wf, { title: 'Verstärkung im Bild', vu: fin(st.vus) ? st.vus : fin(st.vu) ? st.vu : NaN, vlabel: fin(st.vus) ? 'V_u,Quelle' : 'V_u' }));
    } else if (rigId === 'folger') { add('rw', 'Widerstände', resistorStrip([])); }
    else if (rigId.indexOf('opv_') === 0) {
      add('teil', 'Operationsverstärker', opvSvg(rigId, st));
      add('rw', 'Widerstände', resistorStrip(opvResistors(rigId, st)));
      const komp = rigId === 'opv_komp', usat = fin(st.usat) ? st.usat : NaN;
      add('sig', 'Signal', signalSvg(wf, { title: komp ? 'Kippen an den Schaltschwellen' : rigId === 'opv_aktiv' ? 'Eingang und Ausgang' : 'Verstärkung im Bild', usat, vu: !komp && rigId !== 'opv_aktiv' && fin(st.v) ? st.v : NaN, vlabel: 'V_u', komp, noV: rigId === 'opv_aktiv' }));
    }
    return out;
  }
  function allHtml(rigId, st, wf, core) {
    const b = build(rigId, st, wf, core); if (!b.length) return '';
    return b.map(x => `<div class="av-blk" data-av-blk="${x.id}">${x.html}</div>`).join('');
  }

  const CSS = `
.anaviz{margin:0 0 10px}
.anaviz .av-blk{border-top:1px solid var(--line);padding:8px 0 4px}.anaviz .av-blk:first-of-type{border-top:0;padding-top:0}
.anaviz .av-svg{display:block;width:100%;max-width:440px;height:auto;margin:0 auto}
@media(min-width:760px){.anaviz [data-av-body]{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:4px 18px;align-items:start}.anaviz .av-blk,.anaviz .av-blk:first-of-type{border-top:0;padding:6px 0}}
.anaviz .av-cv{display:block;margin:0 auto;max-width:100%;border-radius:8px}
.anaviz .av-note{font-size:12.5px;color:var(--mute);line-height:1.4;margin:4px 0 2px}
.anaviz .av-strong{color:var(--fg);font-weight:600}
.anaviz>summary{min-height:44px}
.anaviz[hidden]{display:none}
`;
  const API = { niceBelow, bands, ratingFor, resistor, resistorStrip, diodeSvg, diodeResistor, transistorSvg, opvSvg, signalSvg, build, allHtml, eng, fz, RATINGS, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ANA_VIZ = API;

  /* ---------------------------------------------------------------- DOM-Anbindung (nur Browser, ohne Änderung an anaui.js) */
  if (typeof document === 'undefined') return;
  let host = null, lastSig = '', lastSch = null, origSch = null;
  /* Wrapper: merkt sich die Daten des zuletzt gezeichneten Schaltbilds (ändert nichts am Zeichnen) */
  function patchDraw() {
    const D = root.ANA_DRAW; if (!D || D.__avp || typeof D.schematic !== 'function') return;
    const o = D.schematic; origSch = o;
    try { D.schematic = function (ctx, rect, data, opts) { try { if (data && typeof data === 'object') lastSch = { data: data, opts: opts || {}, at: Date.now() }; } catch (e) {} return o.apply(this, arguments); }; D.__avp = 1; } catch (e) { origSch = null; }
  }
  const DWd = 440, DHd = 300;
  function schemBlock() { return '<div class="av-blk" data-av-blk="sch"><canvas class="av-cv" data-av-cv role="img" aria-label="Schaltbild groß mit den aktuellen Werten"></canvas><p class="av-note">Dasselbe Schaltbild wie oben, hier in voller Breite.</p></div>'; }
  function drawSchem(h) {
    const cv = h.querySelector('[data-av-cv]'); if (!cv || !lastSch || !origSch) return; const body = h.querySelector('[data-av-body]');
    const w = Math.max(200, Math.min(460, Math.round((cv.parentNode.clientWidth || body.clientWidth || 330)))), sc = Math.min((w - 8) / DWd, 2), hh = Math.round(DHd * sc + 8), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = hh + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    const g = cv.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const op = Object.assign({}, lastSch.opts, { ghost: false, wipe: null, reduced: true });
    try { origSch.call(root.ANA_DRAW, g, { x: 0, y: 0, w, h: hh }, lastSch.data, op); } catch (e) {}
  }
  function inject() { if (document.getElementById('anaviz-css')) return; const st = document.createElement('style'); st.id = 'anaviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  function ensureHost() {
    if (host && host.isConnected) return host; const m = document.getElementById('meters'); if (!m || !m.parentNode) return null;
    host = document.createElement('details'); host.className = 'card anaviz'; host.id = 'anaviz'; host.hidden = true;
    host.innerHTML = '<summary>Bauteile und Signal im Bild</summary><div class="cb" data-av-body></div>';
    let open = true; try { open = localStorage.getItem('lm4.ana.viz') !== '0'; } catch (e) {} host.open = open;
    host.addEventListener('toggle', () => { try { localStorage.setItem('lm4.ana.viz', host.open ? '1' : '0'); } catch (e) {} lastSig = ''; });
    m.parentNode.insertBefore(host, m); return host;
  }
  function tick() {
    try {
      if (document.hidden) return; const U = root.ANA_UI, S = U && U.S; const h = ensureHost(); if (!h || !S) return;
      const st = S.st, rig = S.rig, ok = S.tab === 'rig' && st && rig && !S.task && !(S.hidden && S.hidden.length) && !st.verdeckt && !S.readonly;
      if (!ok) { if (!h.hidden) { h.hidden = true; lastSig = ''; } return; }
      if (!h.open) { h.hidden = false; return; }
      let wf = null; try { wf = typeof rig.waveform === 'function' ? rig.waveform() : null; } catch (e) { wf = null; }
      patchDraw(); const schOk = !!(lastSch && origSch && Date.now() - lastSch.at < 3000), schSig = schOk ? JSON.stringify(lastSch.data) + '|' + (lastSch.opts.theme || '') : '';
      const rid = S.rigId, keys = ['typ', 'id', 'iz', 'ud', 'rv', 'pr', 'ic', 'ib', 'uce', 'zustand', 'uaPeak', 'uv', 'usat', 'ue', 'v', 'vu', 'vus', 'schaltung', 'betrieb', 'rb', 'last', 'rlast', 'r1', 'r2', 'r3', 'r4', 'rc', 're1', 're2', 'rg', 'rl', 'rf', 'rt'];
      const w0 = wf && wf.series && wf.series[1] && wf.series[1].y ? wf.series[1].y : [], wsig = w0.length ? [w0.length, w0[0], w0[w0.length >> 2], w0[w0.length >> 1], w0[w0.length - 1]].map(v => (fin(v) ? Math.round(v * 1000) : v)).join(',') : '';
      const sig = rid + '|' + keys.map(k => { const v = st[k]; return fin(v) ? +v.toPrecision(4) : v; }).join('|') + '|' + wsig + '|' + schSig + '|' + (root.devicePixelRatio || 1);
      if (sig === lastSig && !h.hidden) return; lastSig = sig;
      const html = (schOk ? schemBlock() : '') + allHtml(rid, st, wf, root.ANA_CORE); const body = h.querySelector('[data-av-body]');
      if (!html) { h.hidden = true; return; } body.innerHTML = html; h.hidden = false; if (schOk) drawSchem(h);
    } catch (e) { if (!tick.err) { tick.err = 1; try { console.error('anaviz:', e); } catch (x) {} } }
  }
  inject(); patchDraw();
  setInterval(tick, 300);
  document.addEventListener('click', () => setTimeout(tick, 60), true);
})(typeof window !== 'undefined' ? window : globalThis);
