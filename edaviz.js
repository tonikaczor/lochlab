'use strict';
/* Tonfunk Simulations- und EDA-Lab: Zeichnungen (reine Funktionen, liefern SVG-Text, ohne DOM, testbar mit node).
   ALLE Zahlen sind ÜBUNGSWERTE. Farben nur über CSS-Variablen der Seite (Klassen ev-*), Bewegung nur über CSS bei prefers-reduced-motion: no-preference.
   Der Endzustand jeder Zeichnung steht ohne Bewegung da. Breite aller Bilder 420 Einheiten, Schrift 14 Einheiten (am Handy bei 334 px Bildbreite rund 11,1 px).
     Simulation:  apPlot (LED-Arbeitspunkt), zeitPlot (Gleichrichter mit Elko), bodePlot (RC-Tiefpass mit Sinuspaar), sweepPlot (Brumm über Kapazität)
     ERC:         ercPlot (Schaltplan aus der Netzliste), ercMarks (Ort einer Meldung)
     Gerber:      gerberTop (Draufsicht, Lagen schaltbar), gerberStack (Lagen übereinander), dfmPlot (Pad, Bohrung, Bahn, Abstand) */
(function (root) {
  const C = root.EDA_CORE || (typeof require === 'function' ? require('./edacore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 1 : d, true);
  const W = 420;
  const svg = (H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const T = (x, y, t, cls, anc) => `<text class="ev-t ${cls || ''}" x="${q(x)}" y="${q(y)}"${anc ? ` text-anchor="${anc}"` : ''}>${esc(t)}</text>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const pts = a => a.map((p, i) => (i ? 'L' : 'M') + q(p[0]) + ' ' + q(p[1])).join('');
  const PA = (d, cls) => `<path class="${cls || ''}" d="${d}"/>`;
  const CI = (x, y, r, cls) => `<circle class="${cls || ''}" cx="${q(x)}" cy="${q(y)}" r="${q(r)}"/>`;
  const RE = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ` rx="${rx}"` : ''}/>`;
  const empty = msg => svg(60, msg, T(210, 34, msg, 'm', 'middle'));
  const dm = v => f(v, 2) + ' mm';
  /* Achsenkreuz mit Gitter; X(k)/Y(k) liefern Pixel. xt/yt: Teilstriche [[Pixel, Beschriftung]] */
  function axes(x0, y0, x1, y1, xt, yt, xtitle, ytitle) {
    let s = '';
    yt.forEach(t => { s += L(x0, t[0], x1, t[0], 'ev-grid') + T(x0 - 6, t[0] + 5, t[1], 'm', 'end'); });
    xt.forEach(t => { s += L(t[0], y0, t[0], y0 + 4, 'ev-ax') + T(t[0], y0 + 19, t[1], 'm', 'middle'); });
    return s + L(x0, y0, x1, y0, 'ev-ax') + L(x0, y0, x0, y1, 'ev-ax') + T((x0 + x1) / 2, y0 + 38, xtitle, 'm', 'middle') + T(x0, y1 - 8, ytitle, 'm');
  }
  const nice = (v, list) => list.find(x => x >= v) || list[list.length - 1];

  /* ============================================================ Arbeitspunkt: LED mit Vorwiderstand */
  function apPlot(ub, r) {
    const op = C.operatingPoint(ub, r); if (!op) return empty('Keine gültigen Werte.');
    const x0 = 52, x1 = 400, y0 = 212, y1 = 28, ym = nice(op.i * 1000 * 1.4, [10, 20, 30, 50, 100, 150, 200]);
    const X = u => x0 + u / 3 * (x1 - x0), Y = i => y0 - i / ym * (y0 - y1);
    const xt = [0, 1, 2, 3].map(u => [X(u), f(u, 0)]), yt = [0, 1, 2, 3, 4].map(k => [Y(ym * k / 4), f(ym * k / 4, ym <= 10 ? 1 : 0)]);
    const led = [[X(0), Y(0)]]; for (let k = 0; k <= 60; k++) { const i = 0.001 * Math.pow(ym / 0.001, k / 60); led.push([X(C.ledU(i / 1000)), Y(i)]); }
    const lo = [[X(0), Y(ub / r * 1000)], [X(3), Y(Math.max(0, ub - 3) / r * 1000)]];
    const px = X(op.u), py = Y(op.i * 1000), right = px < 250;
    return svg(256, 'Arbeitspunkt: Schnittpunkt von LED-Kennlinie und Widerstandsgerade',
      `<defs><clipPath id="evap"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath></defs>` + axes(x0, y0, x1, y1, xt, yt, 'LED-Spannung in V', 'Strom in mA') +
      `<g clip-path="url(#evap)">${PA(pts(led), 'ev-c1')}${PA(pts(lo), 'ev-c2')}</g>` +
      L(px, py, px, y0, 'ev-dash') + L(x0, py, px, py, 'ev-dash') + CI(px, py, 11, 'ev-pulse') + CI(px, py, 6, 'ev-pt') +
      T(right ? px + 14 : px - 14, Math.min(y0 - 18, py + 26), 'AP ' + f(op.u, 2) + ' V · ' + f(op.i * 1000, 1) + ' mA', 'b', right ? 'start' : 'end') +
      T(X(0.1), y1 + 14, 'Widerstandsgerade', 'o') + T(x1 - 4, y0 - 8, 'LED-Kennlinie', 'a', 'end'));
  }

  /* ============================================================ Zeitverlauf: Brücke mit Ladeelko */
  function zeitPlot(ueff, c, i) {
    const s = C.rectSim({ ueff, c, i }); if (!s) return empty('Keine gültigen Werte.');
    const x0 = 50, x1 = 404, y0 = 206, y1 = 52, T6 = 0.06, ym = nice(ueff * Math.SQRT2 + 1, [10, 15, 20, 25, 30, 40]);
    const X = t => x0 + t / T6 * (x1 - x0), Y = v => y0 - Math.min(v, ym) / ym * (y0 - y1);
    const src = [], uc = []; for (let k = 0; k < s.t.length; k += 4) { src.push([X(s.t[k]), Y(s.src[k])]); uc.push([X(s.t[k]), Y(s.uc[k])]); }
    const xt = [0, 10, 20, 30, 40, 50, 60].map(m => [X(m / 1000), f(m, 0)]), yt = [0, 1, 2, 3, 4].map(k => [Y(ym * k / 4), f(ym * k / 4, 0)]);
    const wx = X(0.04), ax = X(0.054), ym1 = Y(s.vmax), ym0 = Y(s.vmin);
    return svg(254, 'Zeitverlauf der Elkospannung mit Brummspannung',
      axes(x0, y0, x1, y1, xt, yt, 'Zeit in ms', 'Spannung in V') + RE(wx, y1, x1 - wx, y0 - y1, 'ev-win') +
      PA(pts(src), 'ev-c3') + PA(pts(uc), 'ev-c1') + L(wx, ym1, x1, ym1, 'ev-dash') + L(wx, ym0, x1, ym0, 'ev-dash') +
      L(ax, ym1, ax, ym0, 'ev-ar') + T(wx + 4, y0 - 8, 'Messfenster', 'm') +
      T(ax - 8, Math.max(y1 + 14, ym1 - 10), 'ΔU = ' + f(s.vpp, 2) + ' V', 'b', 'end') +
      L(x0, 14, x0 + 20, 14, 'ev-c3 ev-key') + T(x0 + 26, 19, 'nach der Brücke', 'm') + L(x0 + 168, 14, x0 + 188, 14, 'ev-c1 ev-key') + T(x0 + 194, 19, 'am Elko', 'm') +
      L(x0, y1, x0, y0, 'ev-scan'));
  }

  /* ============================================================ Frequenzgang RC-Tiefpass mit Sinuspaar */
  const FNAME = { 10: '10', 100: '100', 1000: '1k', 10000: '10k', 100000: '100k' };
  function bodePlot(r, c, fq) {
    const fg = C.fgRC(r, c); if (!fin(fg) || !(fq > 0)) return empty('Keine gültigen Werte.');
    const x0 = 50, x1 = 404, y1 = 28, y0 = 150, FX = h => x0 + Math.log10(h / 10) / 4 * (x1 - x0), Y = d => y1 + Math.min(40, d) / 40 * (y0 - y1);
    const curve = []; for (let k = 0; k <= 80; k++) { const h = 10 * Math.pow(10, k / 20); curve.push([FX(h), Y(C.attenDb(h, fg))]); }
    const xt = [10, 100, 1000, 10000, 100000].map(h => [FX(h), FNAME[h]]), yt = [0, 10, 20, 30, 40].map(d => [Y(d), d ? '−' + d : '0']);
    const gx = FX(Math.min(Math.max(fg, 10), 100000)), tx = FX(fq), dB = C.attenDb(fq, fg), am = C.ampRC(fq, fg), ph = C.phaseRC(fq, fg);
    /* Sinuspaar: Periode P, Ausgang um die Phase nach rechts verschoben; ein Pfad über 2 Perioden mehr als sichtbar, die Bewegung schiebt ihn um genau P */
    const P = 88.5, cy = 242, A = 20, sine = (amp, ph0) => { const a = []; for (let x = x0 - P; x <= x1 + P + 0.1; x += 3) a.push([x, cy - A * amp * Math.sin(2 * Math.PI * ((x - x0) / P) - ph0)]); return pts(a); };
    return svg(292, 'Frequenzgang: Dämpfung über der Frequenz und Sinuspaar',
      `<defs><clipPath id="evbo"><rect x="${x0}" y="${cy - A - 4}" width="${x1 - x0}" height="${2 * A + 8}"/></clipPath></defs>` + axes(x0, y0, x1, y1, xt, yt, 'Frequenz in Hz', 'Dämpfung in dB') +
      L(x0, Y(3.01), x1, Y(3.01), 'ev-dash') + T(x1, Y(3.01) - 5, '−3 dB', 'm', 'end') + PA(pts(curve), 'ev-c1') +
      L(gx, y1, gx, y0, 'ev-dash') + T(gx > 300 ? gx - 5 : gx + 5, y0 - 8, 'fg ' + C.fmtHz(fg), 'o', gx > 300 ? 'end' : 'start') + L(tx, y1, tx, y0, 'ev-tst') + CI(tx, Y(dB), 5.5, 'ev-pt') +
      T(x0, 212, 'Bei ' + C.fmtHz(fq) + ': ' + f(dB, 1) + ' dB, ' + f(ph, 0) + '° Phase', 'b') +
      `<g clip-path="url(#evbo)"><g class="ev-sh" style="--p:${P}px">${PA(sine(1, 0), 'ev-c3')}${PA(sine(am, ph * Math.PI / 180), 'ev-c2')}</g></g>` +
      L(x0, cy, x1, cy, 'ev-grid') + L(x0, 278, x0 + 20, 278, 'ev-c3 ev-key') + T(x0 + 26, 283, 'Eingang', 'm') + L(x0 + 120, 278, x0 + 140, 278, 'ev-c2 ev-key') + T(x0 + 146, 283, 'Ausgang', 'm'));
  }

  /* ============================================================ Sweep: Brumm über Kapazität (cs in µF; sim = Simulation, form = Formel, in V) */
  function sweepPlot(cs, form, sim, lim) {
    if (!cs || !cs.length || !(lim > 0)) return empty('Keine gültigen Werte.');
    const x0 = 56, x1 = 396, y0 = 190, y1 = 52, n = cs.length, ym = nice(Math.max(lim * 3, form[Math.min(3, n - 1)]), [1, 2, 3, 5, 10, 20, 30, 50]);
    const X = k => x0 + (k + 0.5) / n * (x1 - x0), Y = v => y0 - v / ym * (y0 - y1);
    const first = sim.findIndex(v => v <= lim), xt = cs.map((c, k) => [X(k), f(c, 0)]), yt = [0, 1, 2, 3, 4, 5].map(k => [Y(ym * k / 5), f(ym * k / 5, ym <= 3 ? 1 : 0)]);
    let dots = ''; sim.forEach((v, k) => { if (v <= ym * 1.02) dots += CI(X(k), Y(v), k === first ? 7 : 5, k === first ? 'ev-ptok' : 'ev-pt2'); });
    return svg(252, 'Brummspannung in Abhängigkeit von der Kapazität',
      `<defs><clipPath id="evsw"><rect x="${x0}" y="${y1 - 4}" width="${x1 - x0}" height="${y0 - y1 + 8}"/></clipPath></defs>` + axes(x0, y0, x1, y1, xt, yt, 'Kapazität in µF', 'Brummspannung in V') +
      `<g clip-path="url(#evsw)">${PA(pts(form.map((v, k) => [X(k), Y(v)])), 'ev-c1')}</g>` + L(x0, Y(lim), x1, Y(lim), 'ev-lim') + T(x1, Y(lim) - 6, 'Grenze ' + f(lim, 1) + ' V', 'd', 'end') + dots +
      (first >= 0 ? T(X(first), Y(sim[first]) - 14, 'ab hier', 'k', 'middle') : '') +
      L(x0, 14, x0 + 20, 14, 'ev-c1 ev-key') + T(x0 + 26, 19, 'Formel', 'm') + CI(x0 + 136, 14, 5, 'ev-pt2') + T(x0 + 148, 19, 'Simulation', 'm'));
  }

  /* ============================================================ ERC: Schaltplan aus der Netzliste */
  const STUB = 8;
  /* Anschlusspunkt am Bauteilrand (x, y) und Ende des Stummels (ex, ey) */
  function pinXY(c, p) {
    const s = p.side;
    if (s === 'l') return { x: c.x, y: c.y + p.off, ex: c.x - STUB, ey: c.y + p.off };
    if (s === 'r') return { x: c.x + c.w, y: c.y + p.off, ex: c.x + c.w + STUB, ey: c.y + p.off };
    if (s === 't') return { x: c.x + p.off, y: c.y, ex: c.x + p.off, ey: c.y - STUB };
    return { x: c.x + p.off, y: c.y + c.h, ex: c.x + p.off, ey: c.y + c.h + STUB };
  }
  const isIC = c => c.ref[0] === 'U';
  function ground(x, y, dir) { return L(x, y, x, y + 6 * dir, 'ev-wire') + [0, 1, 2].map(k => L(x - 7 + k * 2.5, y + (6 + k * 3.5) * dir, x + 7 - k * 2.5, y + (6 + k * 3.5) * dir, 'ev-wire')).join(''); }
  /* hi: Markierungen aus ercMarks */
  function ercPlot(sch, hi) {
    if (!sch || !sch.comps) return empty('Kein Schaltplan.');
    const N = C.nets(sch); let wires = '', body = '', labels = '', marks = '';
    sch.comps.forEach(c => {
      body += RE(c.x, c.y, c.w, c.h, 'ev-box' + (isIC(c) ? ' ic' : ''), 6);
      body += isIC(c) ? T(c.x, c.y - 5, c.ref, 'b') : T(c.x + c.w / 2, c.y + c.h / 2 + 5, c.ref, 'b', 'middle');
      c.pins.forEach(p => {
        const a = pinXY(c, p), n = p.net, cnt = n == null ? 0 : N[n].length;
        body += L(a.x, a.y, a.ex, a.ey, 'ev-wire');
        if (isIC(c)) {
          const sd = p.side, nx = sd === 'l' ? a.x + 5 : sd === 'r' ? a.x - 5 : a.x, ny = sd === 't' ? a.y + 17 : sd === 'b' ? a.y - 6 : a.y + 5;
          body += T(nx, ny, p.name, 'm', sd === 'l' ? 'start' : sd === 'r' ? 'end' : 'middle');
        }
        if (n == null) { labels += L(a.ex - 4, a.ey - 4, a.ex + 4, a.ey + 4, 'ev-x') + L(a.ex - 4, a.ey + 4, a.ex + 4, a.ey - 4, 'ev-x'); return; }
        labels += CI(a.ex, a.ey, 2.6, 'ev-dot');
        if (n === 'GND') { labels += ground(a.ex, a.ey, p.side === 't' ? -1 : 1); return; }
        if (cnt === 2) return;
        const sd = p.side; labels += T(sd === 'l' ? a.ex - 4 : sd === 'r' ? a.ex + 4 : a.ex, sd === 't' ? a.ey - 6 : sd === 'b' ? a.ey + 17 : a.ey + 5, n, 'n', sd === 'l' ? 'end' : sd === 'r' ? 'start' : 'middle');
      });
    });
    Object.keys(N).forEach(n => {
      if (N[n].length !== 2 || n === 'GND') return;
      const a = pinXY(N[n][0].c, N[n][0].p), b = pinXY(N[n][1].c, N[n][1].p), mx = (a.ex + b.ex) / 2;
      wires += PA(a.ey === b.ey ? `M${q(a.ex)} ${q(a.ey)}H${q(b.ex)}` : `M${q(a.ex)} ${q(a.ey)}H${q(mx)}V${q(b.ey)}H${q(b.ex)}`, 'ev-wire');
    });
    (hi || []).forEach(m => { marks += m.w ? RE(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 'ev-ring', 8) : CI(m.x, m.y, 13, 'ev-ring'); });
    return svg(266, 'Schaltplan des Modellbetriebs mit Pins und Netznamen', wires + body + labels + marks);
  }
  /* Ort einer ERC-Meldung: Pin (Kreis), Bauteil (Rahmen) oder alle Pins eines Netzes */
  function ercMarks(sch, m) {
    const comp = id => sch.comps.find(c => c.id === id);
    if (m.cid && m.pin) { const c = comp(m.cid), p = c && c.pins.find(x => x.name === m.pin); if (p) { const a = pinXY(c, p); return [{ x: a.ex, y: a.ey }]; } }
    if (m.cid) { const c = comp(m.cid); return c ? [{ x: c.x, y: c.y, w: c.w, h: c.h }] : []; }
    const out = []; (C.nets(sch)[m.net] || []).forEach(e => { const a = pinXY(e.c, e.p); out.push({ x: a.ex, y: a.ey }); }); return out;
  }

  /* ============================================================ Gerber: Platine 40 x 30 mm, Maße in mm */
  const SMDP = [], THT = [], TOP = [[[5, 11], [17, 11], [17, 13.095]], [[10.95, 20], [15, 20], [15, 15.635], [17, 15.635]], [[10.95, 25], [16, 25], [16, 16.905], [17, 16.905]], [[29.05, 8], [26, 8], [26, 13.095], [23, 13.095]], [[28, 22], [25, 22], [25, 16.905], [23, 16.905]]],
    BOT = [[[5, 13.54], [5, 28], [33.08, 28], [33.08, 22]], [[5, 11], [8, 11], [8, 18], [28, 18], [28, 22]]], HOLES = [[3.5, 3.5], [36.5, 26.5]];
  for (let k = 0; k < 4; k++) { const y = 15 + (k - 1.5) * 1.27; SMDP.push({ x: 17, y, w: 1.6, h: 0.6 }, { x: 23, y, w: 1.6, h: 0.6 }); }
  [[9.05, 20], [10.95, 20], [9.05, 25], [10.95, 25], [29.05, 8], [30.95, 8]].forEach(p => SMDP.push({ x: p[0], y: p[1], w: 1, h: 1.4 }));
  [[5, 11, 1], [5, 13.54, 1], [28, 22, 0.8], [33.08, 22, 0.8]].forEach(p => THT.push({ x: p[0], y: p[1], d: 1.8, dr: p[2] }));
  const SILK = [[15.9, 11.9, 8.2, 6.2], [8.3, 19.1, 3.4, 1.8], [8.3, 24.1, 3.4, 1.8], [28.3, 7.1, 3.4, 1.8], [3.5, 9.5, 3, 5.4], [26.5, 20.8, 8.1, 2.4]];
  const SILKT = [['U1', 17.9, 10.9], ['R1', 8.3, 18.8], ['R2', 8.3, 23.8], ['C1', 28.3, 6.6], ['J1', 3.5, 8.6], ['R3', 29, 20.2]];
  const hole = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  /* Inhalt einer Lage in mm; txt = Bezeichnungen auf dem Bestückungsdruck */
  function layerG(k, txt) {
    const tr = a => a.map(t => `<path class="ev-tr" d="${pts(t)}"/>`).join(''), rr = (p, g) => `<rect x="${q(p.x - p.w / 2 - g)}" y="${q(p.y - p.h / 2 - g)}" width="${q(p.w + 2 * g)}" height="${q(p.h + 2 * g)}"/>`;
    if (k === 'cuTop') return `<g class="ev-l-cuTop">${tr(TOP)}${SMDP.map(p => rr(p, 0)).join('')}${THT.map(p => CI(p.x, p.y, p.d / 2)).join('')}</g>`;
    if (k === 'cuBot') return `<g class="ev-l-cuBot">${tr(BOT)}${THT.map(p => CI(p.x, p.y, p.d / 2)).join('')}</g>`;
    if (k === 'mask') return `<path class="ev-l-mask" fill-rule="evenodd" d="M0 0H40V30H0Z${SMDP.map(p => `M${q(p.x - p.w / 2 - 0.1)} ${q(p.y - p.h / 2 - 0.1)}h${q(p.w + 0.2)}v${q(p.h + 0.2)}h${q(-p.w - 0.2)}Z`).join('')}${THT.map(p => hole(p.x, p.y, p.d / 2 + 0.1)).join('')}"/>`;
    if (k === 'silk') return `<g class="ev-l-silk">${SILK.map(r => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`).join('')}${CI(15.4, 12.5, 0.3, 'ev-fill')}${txt ? SILKT.map(t => `<text class="ev-sk" x="${t[1]}" y="${t[2]}" font-size="1.8">${t[0]}</text>`).join('') : ''}</g>`;
    if (k === 'paste') return `<g class="ev-l-paste">${SMDP.map(p => rr(p, -0.05)).join('')}</g>`;
    if (k === 'edge') return `<rect class="ev-l-edge" x="0" y="0" width="40" height="30" rx="1"/>`;
    return `<g class="ev-l-drill">${THT.map(p => CI(p.x, p.y, p.dr / 2)).join('')}${HOLES.map(h => CI(h[0], h[1], 1.6)).join('')}</g>`;
  }
  /* Draufsicht; on = Menge der sichtbaren Lagen (Schlüssel aus LAYERS); Reihenfolge von unten nach oben */
  const ORDER = ['cuBot', 'mask', 'cuTop', 'paste', 'silk', 'drill', 'edge'];
  function gerberTop(on) {
    const g = ORDER.filter(k => on[k]).map(k => layerG(k, true)).join('');
    return svg(298, 'Draufsicht auf die Platine 40 mal 30 Millimeter mit den gewählten Lagen',
      `<g transform="translate(50 24) scale(8)"><rect class="ev-plate" width="40" height="30" rx="1"/>${g}</g>` +
      T(210, 288, '40 mm', 'm', 'middle') + T(44, 148, '30 mm', 'm', 'end') + (ORDER.some(k => on[k]) ? '' : T(210, 150, 'Wähle unten eine Lage.', 'm', 'middle')));
  }
  /* Lagen übereinander (schräg von vorn); sel = hervorgehobene Lagen (leer = alle) */
  const STACK = ['silk', 'paste', 'mask', 'cuTop', 'cuBot'];
  function gerberStack(sel) {
    const any = STACK.some(k => sel[k]); let b = '';
    for (let i = STACK.length - 1; i >= 0; i--) {
      const k = STACK[i], y = 12 + i * 52, lay = C.LAYERS.find(l => l.k === k), dim = any && !sel[k];
      b += `<g class="${dim ? 'ev-dim' : ''}"><g transform="matrix(5 0 -1.1 1.5 ${150 + 33} ${y})"><rect class="ev-plate" width="40" height="30" rx="1"/>${layerG(k, false)}<rect class="ev-l-edge" width="40" height="30" rx="1"/></g>` +
        L(8, y + 45, 150, y + 45, 'ev-dash') + T(8, y + 38, lay.n, 'b') + T(8, y + 14, lay.ext, 'm') + '</g>';
    }
    return svg(284, 'Die Gerber-Lagen liegen übereinander', b);
  }
  /* Pad, Bohrung, Leiterbahn und Abstand im Maßstab 60 px je mm; p = {track, gap, drill, pad} */
  function dfmPlot(p) {
    const res = C.dfmCheck(p); if (!res) return empty('Keine gültigen Werte.');
    const S = 60, cx = 105, cy = 78, ok = k => res.find(x => x.k === k).ok, rg = res.find(x => x.k === 'ring'), R = p.pad / 2 * S, r = p.drill / 2 * S;
    const tw = p.track * S, gp = p.gap * S, ty = 78 - gp / 2;
    const line = (x, y, k, t) => T(x, y, t + (ok(k) ? ' ok' : ' zu klein'), ok(k) ? 'g' : 'd', x === cx ? 'middle' : 'start');
    return svg(214, 'Pad mit Bohrung, zwei Leiterbahnen mit Abstand und Prüfung gegen die Mindestwerte',
      CI(cx, cy, R, 'ev-copper') + CI(cx, cy, r, 'ev-hole') + L(cx + r, cy, cx + R, cy, ok('ring') ? 'ev-dimok' : 'ev-dimbad') +
      RE(235, ty - tw, 170, tw, 'ev-copper') + RE(235, ty + gp, 170, tw, 'ev-copper') + L(420 - 12, ty, 420 - 12, ty + gp, ok('gap') ? 'ev-dimok' : 'ev-dimbad') +
      line(cx, 170, 'ring', 'Restring ' + dm(rg.val)) + line(cx, 190, 'drill', 'Bohrung ' + dm(p.drill)) + line(235, 170, 'track', 'Bahnbreite ' + dm(p.track)) + line(235, 190, 'gap', 'Abstand ' + dm(p.gap)));
  }

  root.EDA_VIZ = { apPlot, zeitPlot, bodePlot, sweepPlot, ercPlot, ercMarks, gerberTop, gerberStack, dfmPlot, STACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.EDA_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
