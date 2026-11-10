'use strict';
/* Tonfunk Rechen-Lab: Visualisierungen (Lab-Kennung 'mat'), window.MAT_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an matui.js auskommt. Sie reagieren live auf die Eingabefelder
   der Rechner-Reiter:
   - Dreisatz: Diagramm (direkt: Gerade durch den Nullpunkt, indirekt: Hyperbel) mit den beiden Punkten, dazu Balken für Mischungsverhältnis
     und Maßstab.
   - Prozent: Balken (Grundwert, Prozentwert, Aufschlag und Abschlag, Mehrwertsteuer, Skonto, Toleranz).
   - Geometrie (Flächen und Körper): maßstäbliche Skizze der gewählten Form mit den eingegebenen Maßen.
   - Messwerte: Punktreihe mit Mittelwert, Median und Streuung.
   Aufgabenintegrität: Gelesen werden ausschließlich die Eingabefelder der Rechner (data-s=...), nie Aufgaben oder Trainer. Die Rechner zeigen ihr
   Ergebnis ohnehin selbst an. Farben nur über die CSS-Variablen des Labs (und hsl für Mischungsanteile). Keine Animation. */
(function (root) {
  const C = root.MAT_CORE || (typeof require !== 'undefined' ? require('./matcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const p1 = v => (fin(v) ? v : 0).toFixed(1);
  const fm = v => fin(v) ? C.fmt(C.rd(v, 4)) : '–';
  const short = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* schöne Achsenteilung: Schrittweite 1, 2, 2,5 oder 5 mal Zehnerpotenz, höchstens ~5 Striche */
  function niceStep(max) { if (!(max > 0)) return 1; const raw = max / 4, e = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * e + 1e-12) return m * e; return 10 * e; }

  /* ---------- Dreisatz ---------- */
  function dreiSvg(typ, a, b, x, la, lb) {
    if (![a, b, x].every(fin) || a <= 0 || b <= 0 || x <= 0) return '';
    const ind = typ === 'indirekt', y = ind ? a * b / x : b * x / a; if (!fin(y) || y <= 0) return '';
    const W = 440, H = 270, L = 58, R = 424, T = 16, B = 212, xm = Math.max(a, x) * 1.3, ym = Math.max(b, y) * 1.3, sx = xm / 1, X = v => L + v / xm * (R - L), Y = v => B - v / ym * (B - T);
    let s = `<rect class="mz-bg" width="${W}" height="${H}"/>`;
    const xs = niceStep(xm), ys = niceStep(ym);
    for (let v = 0; v <= xm + 1e-9; v += xs) s += `<line class="mz-gr" x1="${p1(X(v))}" x2="${p1(X(v))}" y1="${T}" y2="${B}"/><text class="mz-ax" x="${p1(X(v))}" y="${B + 15}" text-anchor="middle">${esc(fm(v))}</text>`;
    for (let v = 0; v <= ym + 1e-9; v += ys) s += `<line class="mz-gr" x1="${L}" x2="${R}" y1="${p1(Y(v))}" y2="${p1(Y(v))}"/><text class="mz-ax" x="${L - 6}" y="${p1(Y(v) + 4)}" text-anchor="end">${esc(fm(v))}</text>`;
    s += `<line class="mz-axl" x1="${L}" x2="${R}" y1="${B}" y2="${B}"/><line class="mz-axl" x1="${L}" x2="${L}" y1="${T}" y2="${B}"/>`;
    s += `<text class="mz-ax" x="${(L + R) / 2}" y="${H - 22}" text-anchor="middle">erste Größe${la ? ' (' + esc(short(la, 14)) + ')' : ''}</text><text class="mz-ax" transform="translate(13 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">zweite Größe${lb ? ' (' + esc(short(lb, 14)) + ')' : ''}</text>`;
    let d = '';
    if (!ind) d = `M${p1(X(0))} ${p1(Y(0))}L${p1(X(xm))} ${p1(Y(b / a * xm))}`;
    else { const k = a * b; for (let i = 0; i <= 80; i++) { const v = xm * (0.04 + 0.96 * i / 80), w = k / v; if (w > ym * 1.02) continue; d += (d ? 'L' : 'M') + p1(X(v)) + ' ' + p1(Y(Math.min(w, ym))); } }
    if (d) s += `<path class="mz-cv" d="${d}"/>`;
    const pt = (px, py, cls, lab, dx) => `<line class="mz-d" x1="${p1(X(px))}" y1="${p1(Y(py))}" x2="${p1(X(px))}" y2="${B}"/><line class="mz-d" x1="${L}" y1="${p1(Y(py))}" x2="${p1(X(px))}" y2="${p1(Y(py))}"/><circle class="${cls}" cx="${p1(X(px))}" cy="${p1(Y(py))}" r="6.5"/><text class="mz-tx" x="${p1(X(px) + dx)}" y="${p1(Y(py) - 11)}" text-anchor="${dx < 0 ? 'end' : 'start'}">${esc(lab)}</text>`;
    s += pt(a, b, 'mz-p1', 'gegeben', -6) + pt(x, y, 'mz-p2', 'gesucht', 8);
    return svg(W, H, ind ? 'Diagramm zum indirekten Dreisatz: Hyperbel mit zwei Punkten' : 'Diagramm zum direkten Dreisatz: Gerade durch den Nullpunkt mit zwei Punkten', s);
  }
  const MC = ['hsl(210 80% 58%)', 'hsl(28 90% 52%)', 'hsl(145 55% 44%)', 'hsl(350 75% 58%)', 'hsl(275 55% 64%)', 'hsl(190 70% 45%)'];
  /* Mischungsverhältnis als Balken, parts z. B. [1, 9] */
  function mixSvg(parts, total) {
    const t = C.teilung(parts, total); if (!t || !parts || parts.length < 2 || parts.length > 6) return '';
    const sh = t.shares; if (!sh.every(v => fin(v) && v >= 0)) return '';
    const sum = sh.reduce((q, v) => q + v, 0); if (!(sum > 0)) return '';
    const W = 440, H = 112, L = 14, R = 426, Y = 30; let s = `<rect class="mz-bg" width="${W}" height="${H}"/>`, x = L;
    sh.forEach((v, i) => { const w = v / sum * (R - L); s += `<rect x="${p1(x)}" y="${Y}" width="${p1(w)}" height="30" fill="${MC[i % MC.length]}" fill-opacity=".85" stroke="var(--panel2)" stroke-width="1.5"/>`; if (w > 34) s += `<text class="mz-wt" x="${p1(x + w / 2)}" y="${Y + 20}" text-anchor="middle">${esc(fm(v))}</text>`; x += w; });
    s += `<text class="mz-ax" x="${L}" y="${Y - 9}">Gesamtmenge ${esc(fm(sum))}, aufgeteilt im Verhältnis ${esc(parts.map(fm).join(' : '))}</text>`;
    sh.forEach((v, i) => { const lx = L + (i % 3) * 140, ly = Y + 52 + Math.floor(i / 3) * 18; s += `<rect x="${lx}" y="${ly - 10}" width="11" height="11" rx="2" fill="${MC[i % MC.length]}"/><text class="mz-tx" x="${lx + 16}" y="${ly}">Teil ${i + 1}: ${esc(fm(v))}</text>`; });
    return svg(W, H, 'Mischungsverhältnis als geteilter Balken', s);
  }
  /* Maßstab: Zeichnung und Wirklichkeit als Balkenpaar */
  function scaleSvg(m1, m2, len) {
    const r = (fin(m1) && fin(m2) && fin(len) && m1 > 0 && m2 > 0 && len > 0) ? C.massstab(m1, m2, len) : null; if (!r || !fin(r.value) || r.value <= 0) return '';
    const W = 440, H = 112, L = 14, R = 426, big = Math.max(len, r.value), w1 = len / big * (R - L), w2 = r.value / big * (R - L);
    let s = `<rect class="mz-bg" width="${W}" height="${H}"/>`;
    s += `<text class="mz-ax" x="${L}" y="22">Länge auf der Zeichnung ${esc(fm(len))}</text><rect x="${L}" y="28" width="${p1(Math.max(w1, 2))}" height="16" rx="3" fill="var(--accent-bg)" fill-opacity=".85"/>`;
    s += `<text class="mz-ax" x="${L}" y="66">Länge in Wirklichkeit ${esc(fm(r.value))}</text><rect x="${L}" y="72" width="${p1(Math.max(w2, 2))}" height="16" rx="3" fill="var(--hi)" fill-opacity=".85"/>`;
    s += `<text class="mz-ax" x="${R}" y="${H - 6}" text-anchor="end">Maßstab ${esc(fm(m1))} : ${esc(fm(m2))} (${m2 >= m1 ? 'verkleinert' : 'vergrößert'})</text>`;
    return svg(W, H, 'Maßstab: Länge auf der Zeichnung im Vergleich zur Wirklichkeit', s);
  }

  /* ---------- Prozent ---------- */
  /* liefert ein Modell {type:'part'|'cmp'|'tol'|'pm', ...} oder null */
  function percentModel(kind, x, y) {
    if (!C || !fin(x) || !fin(y)) return null; const r = C.proz(kind, x, y, 0); if (!r || !fin(r.value)) return null; const v = r.value;
    switch (kind) {
      case 'pw': return { type: 'part', G: x, W: v, p: y, unit: '%' };
      case 'ps': return { type: 'part', G: x, W: y, p: v, unit: '%' };
      case 'gw': return { type: 'part', G: v, W: x, p: y, unit: '%' };
      case 'promille': return { type: 'part', G: x, W: v, p: y / 10, unit: '‰', raw: y };
      case 'mehr': return { type: 'cmp', base: x, res: v, p: y, sign: 1, bl: 'Grundwert', rl: 'vermehrter Wert' };
      case 'minder': return { type: 'cmp', base: x, res: v, p: y, sign: -1, bl: 'Grundwert', rl: 'verminderter Wert' };
      case 'gwMehr': return { type: 'cmp', base: v, res: x, p: y, sign: 1, bl: 'Grundwert', rl: 'vermehrter Wert' };
      case 'gwMinder': return { type: 'cmp', base: v, res: x, p: y, sign: -1, bl: 'Grundwert', rl: 'verminderter Wert' };
      case 'mwst': return { type: 'cmp', base: x, res: v, p: y, sign: 1, bl: 'Netto', rl: 'Brutto' };
      case 'netto': return { type: 'cmp', base: v, res: x, p: y, sign: 1, bl: 'Netto', rl: 'Brutto' };
      case 'skonto': return { type: 'cmp', base: x, res: v, p: y, sign: -1, bl: 'Rechnungsbetrag', rl: 'Zahlbetrag' };
      case 'toleranz': return { type: 'tol', nenn: x, ab: y, pct: v };
      default: return null;
    }
  }
  function percentSvg(kind, x, y) {
    const m = percentModel(kind, x, y); if (!m) return '';
    const W = 440; let s, H;
    if (m.type === 'part') {
      if (!(m.G > 0) || m.W < 0) return ''; H = 118; const L = 14, R = 426, full = Math.max(m.G, m.W), gw = m.G / full * (R - L), ww = m.W / full * (R - L);
      s = `<rect class="mz-bg" width="${W}" height="${H}"/><text class="mz-ax" x="${L}" y="20">Grundwert G = ${esc(fm(m.G))} (100 %)</text><rect x="${L}" y="26" width="${p1(gw)}" height="26" rx="4" fill="var(--panel)" stroke="var(--mute)" stroke-width="1.4"/>`;
      s += `<rect x="${L}" y="26" width="${p1(Math.max(Math.min(ww, gw), 0))}" height="26" rx="4" fill="var(--accent-bg)" fill-opacity=".85"/>`;
      if (ww > gw) s += `<rect x="${p1(L + gw)}" y="26" width="${p1(ww - gw)}" height="26" fill="var(--hi)" fill-opacity=".85"/>`;
      s += `<text class="mz-ax" x="${L}" y="78">Prozentwert W = ${esc(fm(m.W))}  entspricht  ${esc(fm(m.p))} ${m.unit}</text>`;
      s += `<text class="mz-ax" x="${L}" y="${H - 8}">Der Balken zeigt, welcher Teil des Grundwerts der Prozentwert ist.</text>`;
      return svg(W, H, 'Balken: Prozentwert als Teil des Grundwerts', s);
    }
    if (m.type === 'cmp') {
      if (!(m.base > 0) || !(m.res > 0)) return ''; H = 132; const L = 14, R = 426, full = Math.max(m.base, m.res), bw = m.base / full * (R - L), rw = m.res / full * (R - L), up = m.sign > 0;
      s = `<rect class="mz-bg" width="${W}" height="${H}"/><text class="mz-ax" x="${L}" y="20">${esc(m.bl)} ${esc(fm(m.base))} (100 %)</text><rect x="${L}" y="26" width="${p1(bw)}" height="24" rx="4" fill="var(--accent-bg)" fill-opacity=".85"/>`;
      s += `<text class="mz-ax" x="${L}" y="72">${esc(m.rl)} ${esc(fm(m.res))} (${esc(fm(100 + m.sign * m.p))} %)</text>`;
      const common = Math.min(bw, rw); s += `<rect x="${L}" y="78" width="${p1(common)}" height="24" rx="4" fill="var(--accent-bg)" fill-opacity=".85"/>`;
      if (up) s += `<rect x="${p1(L + common)}" y="78" width="${p1(Math.max(rw - bw, 0))}" height="24" fill="var(--ok)" fill-opacity=".85"/>`;
      else s += `<rect x="${p1(L + rw)}" y="78" width="${p1(Math.max(bw - rw, 0))}" height="24" fill="var(--danger)" fill-opacity=".35" stroke="var(--danger)" stroke-dasharray="4 3"/>`;
      s += `<text class="mz-tx" x="${R}" y="${H - 8}" text-anchor="end">${up ? 'Aufschlag' : 'Abschlag'} ${esc(fm(m.p))} %: ${up ? 'grün' : 'gestrichelt'}</text>`;
      return svg(W, H, 'Balkenpaar: Grundwert und veränderter Wert', s);
    }
    if (m.type === 'tol') {
      if (!(m.nenn > 0) || !(m.ab >= 0)) return ''; H = 116; const L = 24, R = 416, span = Math.max(m.ab * 1.6, m.nenn * 0.0001), lo = m.nenn - span, hi = m.nenn + span, X = v => L + (v - lo) / (hi - lo) * (R - L);
      s = `<rect class="mz-bg" width="${W}" height="${H}"/><line class="mz-axl" x1="${L}" x2="${R}" y1="60" y2="60"/>`;
      s += `<rect x="${p1(X(m.nenn - m.ab))}" y="48" width="${p1(Math.max(X(m.nenn + m.ab) - X(m.nenn - m.ab), 2))}" height="24" fill="var(--ok)" fill-opacity=".4" stroke="var(--ok)"/><line x1="${p1(X(m.nenn))}" x2="${p1(X(m.nenn))}" y1="40" y2="80" stroke="var(--fg)" stroke-width="2"/>`;
      s += `<text class="mz-tx" x="${p1(X(m.nenn))}" y="34" text-anchor="middle">Nennmaß ${esc(fm(m.nenn))}</text><text class="mz-ax" x="${p1(X(m.nenn - m.ab))}" y="92" text-anchor="middle">${esc(fm(m.nenn - m.ab))}</text><text class="mz-ax" x="${p1(X(m.nenn + m.ab))}" y="92" text-anchor="middle">${esc(fm(m.nenn + m.ab))}</text>`;
      s += `<text class="mz-ax" x="${W / 2}" y="${H - 6}" text-anchor="middle">Grün: erlaubter Bereich (Nennmaß ± Abmaß)</text>`;
      return svg(W, H, 'Toleranzbereich um das Nennmaß', s);
    }
    return '';
  }

  /* ---------- Geometrie: Skizzen ---------- */
  /* Maße in beliebiger Einheit; die Zeichnung ist maßstäblich, sehr schlanke Formen werden auf 12 % der längsten Seite gestreckt. */
  function shapeSvg(shape, p, unit) {
    const S = C && C.SHAPES[shape]; if (!S) return '';
    const v = {}; for (const [k] of S.p) { v[k] = p && p[k]; if (!fin(v[k]) || v[k] <= 0) return ''; }
    if (shape === 'ring' && !(v.d < v.D)) return '';
    const W = 440, H = 250, u = esc(unit || ''), lab = (k, x) => k + ' = ' + fm(x) + (u ? ' ' + u : '');
    let s = `<rect class="mz-bg" width="${W}" height="${H}"/>`; const cx = W / 2, cy = H / 2;
    const dim = (x1, y1, x2, y2, t, off, anc) => `<line class="mz-dm" x1="${p1(x1)}" y1="${p1(y1)}" x2="${p1(x2)}" y2="${p1(y2)}"/><text class="mz-tx" x="${p1((x1 + x2) / 2 + (off ? off[0] : 0))}" y="${p1((y1 + y2) / 2 + (off ? off[1] : 0))}" text-anchor="${anc || 'middle'}">${esc(t)}</text>`;
    const fitBox = (wv, hv, bw, bh) => { const mx = Math.max(wv, hv), a = Math.max(wv, 0.12 * mx), b = Math.max(hv, 0.12 * mx), k = Math.min(bw / a, bh / b); return [a * k, b * k]; };
    if (shape === 'rechteck') { const [w, h] = fitBox(v.a, v.b, 300, 140); s += `<rect class="mz-sh" x="${p1(cx - w / 2)}" y="${p1(cy - h / 2)}" width="${p1(w)}" height="${p1(h)}"/>` + dim(cx - w / 2, cy + h / 2 + 22, cx + w / 2, cy + h / 2 + 22, lab('a', v.a)) + dim(cx + w / 2 + 14, cy - h / 2, cx + w / 2 + 14, cy + h / 2, lab('b', v.b), [8, 4], 'start'); }
    else if (shape === 'kreis') { const r = 80; s += `<circle class="mz-sh" cx="${cx}" cy="${cy}" r="${r}"/><line class="mz-dm" x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--fg)"/><text class="mz-tx" x="${cx}" y="${cy - 8}" text-anchor="middle">${esc(lab('d', v.d))}</text>`; }
    else if (shape === 'dreieck') { const [w, h] = fitBox(v.g, v.h, 300, 140), x0 = cx - w / 2, y0 = cy + h / 2; s += `<polygon class="mz-sh" points="${p1(x0)},${p1(y0)} ${p1(x0 + w)},${p1(y0)} ${p1(x0 + w * 0.3)},${p1(y0 - h)}"/><line class="mz-dm" x1="${p1(x0 + w * 0.3)}" y1="${p1(y0 - h)}" x2="${p1(x0 + w * 0.3)}" y2="${p1(y0)}"/><text class="mz-tx" x="${p1(x0 + w * 0.3 + 6)}" y="${p1(y0 - h / 2)}">${esc(lab('h', v.h))}</text>` + dim(x0, y0 + 22, x0 + w, y0 + 22, lab('g', v.g)); }
    else if (shape === 'trapez') { const mx = Math.max(v.a, v.c), [w, h] = fitBox(mx, v.h, 300, 130), wa = v.a / mx * w, wc = v.c / mx * w, x0 = cx - w / 2, y0 = cy + h / 2, xa = cx - wa / 2, xc = cx - wc / 2; s += `<polygon class="mz-sh" points="${p1(xa)},${p1(y0)} ${p1(xa + wa)},${p1(y0)} ${p1(xc + wc)},${p1(y0 - h)} ${p1(xc)},${p1(y0 - h)}"/><line class="mz-dm" x1="${p1(xc + wc)}" y1="${p1(y0 - h)}" x2="${p1(xc + wc)}" y2="${p1(y0)}"/><text class="mz-tx" x="${p1(xc + wc + 6)}" y="${p1(y0 - h / 2)}">${esc(lab('h', v.h))}</text>` + dim(xa, y0 + 22, xa + wa, y0 + 22, lab('a', v.a)) + dim(xc, y0 - h - 12, xc + wc, y0 - h - 12, lab('c', v.c)); void x0; }
    else if (shape === 'ring') { const R0 = 84, r0 = Math.max(8, R0 * v.d / v.D); s += `<circle class="mz-sh" cx="${cx}" cy="${cy}" r="${R0}"/><circle cx="${cx}" cy="${cy}" r="${p1(r0)}" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.8"/><line class="mz-dm" x1="${cx - R0}" y1="${cy + R0 + 12}" x2="${cx + R0}" y2="${cy + R0 + 12}"/><text class="mz-tx" x="${cx}" y="${cy + R0 + 26}" text-anchor="middle">${esc(lab('D', v.D))}</text><line class="mz-dm" x1="${p1(cx - r0)}" y1="${cy}" x2="${p1(cx + r0)}" y2="${cy}"/><text class="mz-tx" x="${cx}" y="${cy - 6}" text-anchor="middle">${esc(lab('d', v.d))}</text>`; }
    else if (shape === 'quader') { const mx = Math.max(v.a, v.b, v.c), k = 150 / mx, a = Math.max(v.a, 0.12 * mx) * k, c = Math.max(v.c, 0.12 * mx) * k, d = Math.max(v.b, 0.12 * mx) * k * 0.5, x0 = cx - (a + d) / 2, y0 = cy + (c + d) / 2 + 4;
      s += `<polygon class="mz-sh2" points="${p1(x0)},${p1(y0 - c)} ${p1(x0 + d)},${p1(y0 - c - d)} ${p1(x0 + a + d)},${p1(y0 - c - d)} ${p1(x0 + a)},${p1(y0 - c)}"/><polygon class="mz-sh2" points="${p1(x0 + a)},${p1(y0 - c)} ${p1(x0 + a + d)},${p1(y0 - c - d)} ${p1(x0 + a + d)},${p1(y0 - d)} ${p1(x0 + a)},${p1(y0)}"/><rect class="mz-sh" x="${p1(x0)}" y="${p1(y0 - c)}" width="${p1(a)}" height="${p1(c)}"/>` + dim(x0, y0 + 20, x0 + a, y0 + 20, lab('a', v.a)) + dim(x0 - 12, y0 - c, x0 - 12, y0, lab('c', v.c), [-6, 4], 'end') + `<text class="mz-tx" x="${p1(x0 + a + d + 6)}" y="${p1(y0 - c / 2 - d / 2)}">${esc(lab('b', v.b))}</text>`; }
    else if (shape === 'zylinder') { const mx = Math.max(v.d, v.h), k = 150 / mx, dd = Math.max(v.d, 0.12 * mx) * k, h = Math.max(v.h, 0.12 * mx) * k, rx = dd / 2, ry = Math.max(6, rx * 0.28), y0 = cy + h / 2; s += `<path class="mz-sh" d="M${p1(cx - rx)},${p1(y0 - h)} v${p1(h)} a${p1(rx)},${p1(ry)} 0 0 0 ${p1(dd)},0 v${p1(-h)}"/><ellipse class="mz-sh" cx="${cx}" cy="${p1(y0 - h)}" rx="${p1(rx)}" ry="${p1(ry)}"/><line class="mz-dm" x1="${p1(cx - rx)}" y1="${p1(y0 - h)}" x2="${p1(cx + rx)}" y2="${p1(y0 - h)}"/><text class="mz-tx" x="${cx}" y="${p1(y0 - h - ry - 6)}" text-anchor="middle">${esc(lab('d', v.d))}</text>` + dim(cx + rx + 16, y0 - h, cx + rx + 16, y0, lab('h', v.h), [8, 4], 'start'); }
    else if (shape === 'kegel') { const mx = Math.max(v.d, v.h), k = 150 / mx, dd = Math.max(v.d, 0.12 * mx) * k, h = Math.max(v.h, 0.12 * mx) * k, rx = dd / 2, ry = Math.max(6, rx * 0.28), y0 = cy + h / 2; s += `<path class="mz-sh" d="M${p1(cx - rx)},${p1(y0)} L${cx},${p1(y0 - h)} L${p1(cx + rx)},${p1(y0)} a${p1(rx)},${p1(ry)} 0 0 1 ${p1(-dd)},0Z"/><line class="mz-dm" x1="${cx}" y1="${p1(y0 - h)}" x2="${cx}" y2="${p1(y0)}"/><text class="mz-tx" x="${cx + 8}" y="${p1(y0 - h / 2)}">${esc(lab('h', v.h))}</text>` + dim(cx - rx, y0 + ry + 18, cx + rx, y0 + ry + 18, lab('d', v.d)); }
    else if (shape === 'kugel') { const r = 80; s += `<circle class="mz-sh" cx="${cx}" cy="${cy}" r="${r}"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.28}" fill="none" stroke="var(--mute)" stroke-dasharray="4 3"/><line class="mz-dm" x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--fg)"/><text class="mz-tx" x="${cx}" y="${cy - 8}" text-anchor="middle">${esc(lab('d', v.d))}</text>`; }
    else return '';
    return svg(W, H, 'Maßstäbliche Skizze: ' + S.name, s);
  }

  /* ---------- Messwerte ---------- */
  function strip(values) {
    if (!Array.isArray(values) || values.length < 1 || !values.every(fin)) return '';
    const st = C.stats(values, 3); if (!st) return '';
    const vs = values.slice().sort((a, b) => a - b), mn = vs[0], mx = vs[vs.length - 1], W = 440, H = 168, L = 20, R = 420, Y0 = 96;
    let pad = (mx - mn) * 0.2; if (!(pad > 0)) pad = Math.max(Math.abs(mn) * 0.01, 0.5); const lo = Math.min(mn, st.mean - (st.stdev || 0)) - pad * 0.4, hi = Math.max(mx, st.mean + (st.stdev || 0)) + pad * 0.4, X = v => L + (v - lo) / (hi - lo) * (R - L);
    let s = `<rect class="mz-bg" width="${W}" height="${H}"/><line class="mz-axl" x1="${L}" x2="${R}" y1="${Y0}" y2="${Y0}"/>`;
    if (st.stdev != null && st.stdev > 0) s += `<rect x="${p1(X(st.mean - st.stdev))}" y="30" width="${p1(X(st.mean + st.stdev) - X(st.mean - st.stdev))}" height="${Y0 - 30}" fill="var(--accent)" fill-opacity=".14"/><text class="mz-ax" x="${p1(X(st.mean))}" y="24" text-anchor="middle">Streuung ± s</text>`;
    s += `<line x1="${p1(X(st.mean))}" x2="${p1(X(st.mean))}" y1="30" y2="${Y0 + 8}" stroke="var(--hi)" stroke-width="2"/><text class="mz-hi" x="${p1(X(st.mean))}" y="${Y0 + 24}" text-anchor="middle">x̄ ${esc(fm(st.mean))}</text>`;
    s += `<path d="M${p1(X(st.median))} ${Y0 + 3} l-5 9 h10Z" fill="var(--ok)"/><text class="mz-ok" x="${p1(Math.max(L + 40, Math.min(R - 40, X(st.median))))}" y="${Y0 + 42}" text-anchor="middle">Median ${esc(fm(st.median))}</text>`;
    const stack = {}; vs.slice(0, 60).forEach(v => { const key = Math.round(X(v) / 9); const k = stack[key] = (stack[key] || 0) + 1; s += `<circle cx="${p1(X(v))}" cy="${p1(Y0 - 9 - (k - 1) * 14)}" r="5.5" fill="var(--accent-bg)" stroke="var(--panel2)" stroke-width="1.4"/>`; });
    s += `<text class="mz-ax" x="${L}" y="${H - 8}">${esc(fm(mn))}</text><text class="mz-ax" x="${R}" y="${H - 8}" text-anchor="end">${esc(fm(mx))}</text><text class="mz-ax" x="${W / 2}" y="${H - 8}" text-anchor="middle">${vs.length} Messwerte${vs.length > 60 ? ' (60 gezeichnet)' : ''}</text>`;
    return svg(W, H, 'Punktreihe der Messwerte mit Mittelwert, Median und Streuung', s);
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.mz-bg{fill:var(--panel2)}.mz-gr{stroke:var(--line);stroke-width:.7}.mz-axl{stroke:var(--mute);stroke-width:1.2}.mz-ax{fill:var(--mute);font:12px system-ui,sans-serif}.mz-tx{fill:var(--fg);font:700 12.5px system-ui,sans-serif}
.mz-wt{fill:var(--panel);font:700 12.5px system-ui,sans-serif}.mz-hi{fill:var(--hi);font:700 12.5px system-ui,sans-serif}.mz-ok{fill:var(--ok);font:700 12.5px system-ui,sans-serif}
.mz-cv{fill:none;stroke:var(--accent);stroke-width:2.8;stroke-linecap:round}.mz-d{stroke:var(--mute);stroke-width:1.2;stroke-dasharray:4 3}
.mz-p1{fill:var(--accent-bg);stroke:var(--panel2);stroke-width:2}.mz-p2{fill:var(--hi);stroke:var(--panel2);stroke-width:2}
.mz-sh{fill:var(--work);stroke:var(--accent);stroke-width:2.2;stroke-linejoin:round}.mz-sh2{fill:var(--work);stroke:var(--accent);stroke-width:2;stroke-linejoin:round;fill-opacity:.55}.mz-dm{stroke:var(--hi);stroke-width:1.6;fill:none}
.mz-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0}.mz-fig svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.mz-fig svg text{-webkit-user-select:none;user-select:none}
`;
  function injectCss() { if (document.getElementById('matviz-css')) return; const st = document.createElement('style'); st.id = 'matviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  const val = id => { const e = document.querySelector('[data-s="' + id + '"]'); return e ? e.value : ''; };
  const num = id => { const x = C.parseDe(val(id)); return typeof x === 'number' ? x : NaN; };
  const fig = (anchorSel, key, view, before) => {
    const a = view.querySelector(anchorSel); if (!a) return null; let f = view.querySelector('[data-mzk="' + key + '"]');
    if (!f) { f = document.createElement('div'); f.className = 'mz-fig'; f.setAttribute('data-mzk', key); if (before) a.parentNode.insertBefore(f, a); else a.parentNode.insertBefore(f, a.nextSibling); }
    return f;
  };
  const put = (f, html) => { if (!f) return; f.style.display = html ? '' : 'none'; if (f.dataset.sig !== html) { f.dataset.sig = html; f.innerHTML = html; } };
  const upd = {
    v_drei(v) {
      const on = document.querySelector('[data-seg="drei.typ"].on'); put(fig('#dOut', 'drei', v), dreiSvg(on ? on.dataset.v : 'direkt', num('drei.a'), num('drei.b'), num('drei.x'), val('drei.la'), val('drei.lb')));
      const mr = val('drei.mr').split(':').map(s => C.parseDe(s)); put(fig('#mOut', 'mix', v), mr.every(fin) ? mixSvg(mr, num('drei.mt')) : '');
      const ms = val('drei.ms').split(':').map(s => C.parseDe(s)); put(fig('#sOut2', 'scale', v), ms.length === 2 ? scaleSvg(ms[0], ms[1], num('drei.ml')) : '');
    },
    v_proz(v) { const sel = document.querySelector('[data-s="proz.k"]'); put(fig('#pOut', 'proz', v), sel ? percentSvg(sel.value, num('proz.x'), num('proz.y')) : ''); },
    v_geo(v) {
      const sh = document.querySelector('[data-s="geo.shape"]'); const o = v.querySelector('#gOut');
      if (!sh || !o) { const f = v.querySelector('[data-mzk="shape"]'); if (f) f.remove(); return; }
      const S = C.SHAPES[sh.value]; if (!S) return; const p = {}; S.p.forEach(([k]) => { p[k] = num('geo.p.' + sh.value + k); });
      const un = document.querySelector('[data-s="geo.unit"]'); put(fig('#gOut', 'shape', v, true), shapeSvg(sh.value, p, un ? un.value : ''));
    },
    v_mess(v) { put(fig('#tOut', 'strip', v), strip(C.parseList(val('mess.txt')))); }
  };
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && C) {
    const start = () => {
      injectCss();
      const wire = id => { const el = document.getElementById(id); if (!el) return; const run = () => { try { upd[id](el); } catch (e) {} }; new MutationObserver(run).observe(el, { childList: true }); el.addEventListener('input', run); el.addEventListener('change', run); el.addEventListener('click', () => setTimeout(run, 0)); run(); };
      Object.keys(upd).forEach(wire);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { dreiSvg, mixSvg, scaleSvg, percentModel, percentSvg, shapeSvg, strip, niceStep };
  root.MAT_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
