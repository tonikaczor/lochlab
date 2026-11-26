'use strict';
/* Tonfunk Touren-Lab: Zeichenfunktionen (Lab-Kennung 'tou'). Liefern SVG-Text ohne DOM, testbar mit node quelle/tou/test_touviz.js.
   Wird in toulab.html VOR touui.js geladen; touui.js ruft die Funktionen direkt auf.
     mapSvg:   Karte mit Straßen (km), Lager und Kunden als Gebäude, Tour als Linie mit Reihenfolge;
               mit drive: true zeichnet sich die Tour nach, ein Lkw fährt sie ab (SMIL animateMotion, Start per beginElement in touui.js),
               jeder Stopp blinkt kurz, ein verpasstes Zeitfenster ist rot
     truckSvg: Laderaum von oben mit Führerhaus, Paletten in der Farbe des Kunden (mit anim: füllen sich nacheinander), Füllanzeigen Stellplätze und Gewicht
     timeSvg:  Zeitstrahl des Tages (Lenkzeit, Pause, Warten, Entladen) und Zeitfenster je Kunde, Balken wachsen nacheinander
     weekSvg:  Lenkzeit je Tag mit den Grenzen 9 h und 10 h
     kostSvg:  eigene Tour gegen Spediteur über der Palettenzahl
     figSvg:   Bild zur Aufgabe (Karte, Europalette und Lademeter, Last In First Out, Lenkzeitregel, Kostenaufbau)
   Farben nur über CSS-Klassen der Seite (Variablen für Hell und Dunkel). Bewegung nur per CSS/SVG; touui.js schaltet sie bei
   prefers-reduced-motion: reduce ab (kein drive, kein anim), die CSS-Animationen sind zusätzlich per Media-Query geschützt.
   Bei ungültiger Eingabe kommt ein leerer Text. */
(function (root) {
  const C = root.TOU_CORE || (typeof require === 'function' ? require('./toucore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx, extra) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}${extra || ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body, cls) => `<svg ${cls ? 'class="' + cls + '" ' : ''}viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const dl = s => ` style="animation-delay:${q(s * 100) / 100}s"`;
  const pos = k => C.ORTE.find(o => o.k === k);
  /* Karte im Hochformat (auch am Handy lesbar): x gestaucht, y gestreckt */
  const SX = 0.95, SY = 1.3, OX = -13, OY = 22;
  const P = k => { const p = pos(k); return [q(p.x * SX + OX), q(p.y * SY + OY)]; };
  const kcls = k => (C.KUNDEN_KEYS.indexOf(k) < 0 ? 'kw' : 'k' + C.KUNDEN_KEYS.indexOf(k));

  /* Lager: Halle mit Dach und Tor; Kunde: Haus in der Kundenfarbe */
  const lagerIcon = (x, y) => `<g class="lager"><polygon class="lg" points="${x - 22},${y - 4} ${x},${y - 20} ${x + 22},${y - 4} ${x + 22},${y + 16} ${x - 22},${y + 16}"/>${R(x - 9, y + 2, 18, 14, 'tor', 1)}${L(x - 9, y + 7, x + 9, y + 7, 'torl')}${L(x - 9, y + 11.5, x + 9, y + 11.5, 'torl')}</g>` + T(x, y - 25, 'Lager', 'mid b h');
  const hausIcon = (x, y, k, cls) => `<polygon class="kd ${kcls(k)}${cls}" points="${x - 18},${y - 2} ${x},${y - 20} ${x + 18},${y - 2} ${x + 18},${y + 17} ${x - 18},${y + 17}"/>` + T(x, y + 12, k, 'b mid kt');
  /* Lkw von oben (Fahrtrichtung +x): Aufbau mit Spriegeln, Führerhaus mit Scheibe und Spiegeln */
  const lkwIcon = () => `<rect class="tk-box" x="-22" y="-9" width="28" height="18" rx="2"/><line class="tk-rib" x1="-13" y1="-9" x2="-13" y2="9"/><line class="tk-rib" x1="-4" y1="-9" x2="-4" y2="9"/><rect class="tk-cab" x="14" y="-12" width="3" height="24" rx="1"/><rect class="tk-cab" x="8" y="-8.5" width="14" height="17" rx="4"/><rect class="tk-win" x="16.5" y="-6" width="3.5" height="12" rx="1.5"/>`;

  /* Punkte der Tour über die Straßen (mit Rückfahrt) und Anteil der Strecke bis zu jedem Stopp */
  function route(order) {
    const pts = [P('L')], stopAt = []; let cur = 'L', len = 0;
    order.concat(['L']).forEach((k, i) => {
      C.weg(cur, k).slice(1).forEach(n => { const a = pts[pts.length - 1], b = P(n); len += Math.hypot(b[0] - a[0], b[1] - a[1]); pts.push(b); });
      if (i < order.length) stopAt.push(len); cur = k;
    });
    return { pts, len, stops: stopAt.map(v => (len > 0 ? v / len : 0)) };
  }
  const dOf = pts => 'M' + pts.map(p => q(p[0]) + ',' + q(p[1])).join(' L');

  /* ============================================================ Karte */
  /* o: { order: ['A', ...], interactive, mark: ['A', ...] (sonst blass), best: [...] (gestrichelte Vergleichstour),
          drive: Fahrt abspielen, late: { A: true } (Zeitfenster verpasst), dur: Sekunden der Fahrt }
     Ohne Animation ist alles sichtbar: Die Strecke ist fertig gezeichnet, der Lkw steht am Lager. */
  function mapSvg(o) {
    o = o || {}; const order = Array.isArray(o.order) ? o.order : []; if (!C.okOrder(order)) return '';
    const mark = Array.isArray(o.mark) ? o.mark : null, late = o.late || {};
    let s = '';
    C.STRASSEN.forEach(([a, b]) => { const p = P(a), r = P(b); s += L(p[0], p[1], r[0], r[1], 'road'); });
    C.STRASSEN.forEach(([a, b]) => { const p = P(a), r = P(b); s += L(p[0], p[1], r[0], r[1], 'roadm'); });
    if (Array.isArray(o.best) && o.best.length && C.okOrder(o.best)) s += `<path class="rtb" d="${dOf(route(o.best).pts)}"/>`;
    const rt = order.length ? route(order) : null, drive = !!(o.drive && rt), dur = fin(o.dur) && o.dur > 0 ? o.dur : rt ? Math.min(9, Math.max(4, rt.len / 120)) : 0;
    if (rt) s += `<path class="rt${drive ? ' draw' : ''}" pathLength="1" d="${dOf(rt.pts)}"${drive ? ` style="animation-duration:${q(dur)}s"` : ''}/>`;
    /* Entfernung als kleines Schild auf der Straße */
    C.STRASSEN.forEach(([a, b, kmv]) => { const p = P(a), r = P(b), x = (p[0] + r[0]) / 2, y = (p[1] + r[1]) / 2, w = 12 + String(kmv).length * 8.5; s += R(x - w / 2, y - 10, w, 20, 'kms', 5) + T(x, y + 5, kmv, 'kml mid b'); });
    C.ORTE.forEach(p => {
      const [x, y] = P(p.k);
      if (p.k === 'L') { s += lagerIcon(x, y); return; }
      const i = order.indexOf(p.k), n = i + 1, K = C.KUNDEN[p.k], faded = (mark && !mark.includes(p.k)) || (!mark && o.interactive && !n);
      if (o.interactive) s += `<circle class="hit" data-o="${p.k}" tabindex="0" role="button" aria-label="Kunde ${p.k}" cx="${x}" cy="${y}" r="28"><title>Kunde ${p.k}</title></circle>`;
      const cls = (n ? ' on' : '') + (faded ? ' fd' : '') + (late[p.k] ? ' late' : '');
      s += `<g class="kg${drive && n ? ' go' : ''}"${drive && n ? ' style="--d:' + q(rt.stops[i] * dur) + 's"' : ''}>${hausIcon(x, y, p.k, cls)}</g>`;
      s += T(x, y + 34, K.pal + ' Pal', 'mid m h pl');
      if (n) s += `<circle class="nrb${late[p.k] ? ' bad' : ''}" cx="${q(x + 19)}" cy="${q(y - 19)}" r="12"/>` + T(x + 19, y - 13.5, n, 'b mid nrt');
    });
    const [lx, ly] = P('L');
    /* Fahrt: Der Lkw steht am Lager; der Weg ist relativ dazu, damit er auch ohne gestartete Animation richtig steht */
    if (drive) s += `<g transform="translate(${lx} ${ly})"><g class="truck">${lkwIcon()}<animateMotion class="drv" begin="indefinite" dur="${q(dur)}s" fill="freeze" rotate="auto" path="${dOf(rt.pts.map(p => [p[0] - lx, p[1] - ly]))}"/></g></g>`;
    else if (rt) s += `<g class="truck" transform="translate(${q(lx + 40)} ${q(ly + 30)})">${lkwIcon()}</g>`;
    return svg(370, 416, 'Karte mit Lager, Kunden A bis H und Straßen mit Kilometern' + (order.length ? ', Tour ' + order.join(', ') : ''), s, 'svg-map');
  }

  /* ============================================================ Laderaum von oben */
  /* Führerhaus von oben (Fahrtrichtung links): Spiegel, Kabine, Frontscheibe, Dachkante */
  const cabTop = (x, y, w, h) => R(x + 8, y - 5, 5, h + 10, 'mir', 2) + R(x, y, w, h, 'cab', 9) + R(x + 4, y + 5, 9, h - 10, 'tk-win', 4) + L(x + w * 0.5, y + 5, x + w * 0.5, y + h - 5, 'cabl') + L(x + w * 0.5, y + 5, x + w - 6, y + 5, 'cabl') + L(x + w * 0.5, y + h - 5, x + w - 6, y + h - 5, 'cabl');
  const rad = (x, y0, bw) => R(x, y0 - 7, 22, 9, 'whl', 3) + R(x, y0 + bw - 2, 22, 9, 'whl', 3);
  /* Europalette von oben: Fläche in der Farbe des Kunden, zwei Bretter angedeutet, Buchstabe des Kunden */
  const palTop = (x, y, w, h, k) => R(x, y, w, h, 'pal ' + kcls(k), 2) + L(x + 5, y + 1, x + 5, y + h - 1, 'plk') + L(x + w - 5, y + 1, x + w - 5, y + h - 1, 'plk') + (k ? T(x + w / 2, y + h / 2 + 4.5, k, 'b mid dk pt13') : '');
  /* o: { fz: Fahrzeug aus TOU_CORE.FZG, rows: [{ k: 'A', pal: 2, kg: 700 }, ...] in Ladereihenfolge (zuerst geladen = vorn an der Stirnwand), anim }
     Alle Fahrzeuge im gleichen Maßstab (25 Einheiten je m), damit die Längen vergleichbar sind. Ohne Animation stehen alle Paletten an ihrem Platz. */
  function gauge(x, y, w, label, val, max, unit) {
    const p = max > 0 ? val / max : 0, cls = p > 1 ? 'bad' : p > 0.9 ? 'warn' : 'ok';
    return T(x, y - 6, label + ': ' + f(val) + ' von ' + f(max) + (unit ? ' ' + unit : '') + ' (' + f(p * 100) + ' %)', 's' + (p > 1 ? ' bad' : '')) + R(x, y, w, 14, 'gtr', 7) + R(x, y, w * Math.min(1, p), 14, 'gfill ' + cls, 7) + L(x + w, y - 3, x + w, y + 17, 'lim');
  }
  function truckSvg(o) {
    if (!o || !o.fz || !Array.isArray(o.rows) || !o.rows.every(r => r && Number.isInteger(r.pal) && r.pal >= 0)) return '';
    const fz = o.fz, sp = C.stell(fz.l, fz.b), nl = C.nutzlast(fz.zgg, fz.leer); if (!fin(sp) || !fin(nl)) return '';
    const W = 420, sc = 25, x0 = 72, y0 = 44, lw = fz.l * sc, bw = fz.b * sc, sattel = fz.l > 10;
    const quer = C.floorN(fz.b / C.EURO.b), pw = C.EURO.l * sc, ph = C.EURO.b * sc, py = y0 + (bw - quer * ph) / 2;
    let s = '';
    /* Räder (ragen seitlich heraus), Kupplung, Führerhaus, Ladefläche */
    (sattel ? [x0 - 44, x0 + 2, x0 + lw - 112, x0 + lw - 86, x0 + lw - 60] : [x0 - 44, x0 + lw * 0.7 - 11]).forEach(x => { s += rad(x, y0, bw); });
    s += R(x0 - 10, y0 + bw / 2 - 5, 12, 10, 'whl', 2) + cabTop(x0 - 56, y0 + 2, 46, bw - 4);
    s += R(x0, y0, lw, bw, 'deck', 3) + L(x0, y0 - 3, x0, y0 + bw + 3, 'wall') + L(x0 + lw, y0 - 3, x0 + lw, y0 + bw + 3, 'door');
    s += T(14, y0 - 20, '← Fahrtrichtung', 's m') + T(x0 + lw, y0 + bw + 22, 'Tür', 's end m') + T(W - 8, y0 - 20, f(fz.l, 1) + ' m Ladelänge', 's end m');
    let i = 0, zuviel = 0, kg = 0;
    o.rows.forEach(r => {
      kg += fin(r.kg) ? r.kg : 0;
      for (let j = 0; j < r.pal; j++, i++) {
        if (i >= sp) { zuviel++; continue; }
        const row = Math.floor(i / quer), col = i % quer;
        s += `<g class="plt${o.anim ? ' fill' : ''}"${o.anim ? dl(i * 0.05) : ''}>` + palTop(x0 + row * pw + 1, py + col * ph + 1, pw - 2, ph - 2, r.k) + '</g>';
      }
    });
    const gy = y0 + bw + 54;
    s += gauge(20, gy, 380, 'Stellplätze', i, sp, '') + gauge(20, gy + 44, 380, 'Gewicht', kg, nl, 'kg');
    if (zuviel) s += T(20, gy + 82, zuviel + ' Palette(n) passen nicht mehr drauf', 's bad b');
    return svg(W, gy + (zuviel ? 92 : 64), 'Laderaum von oben: ' + fz.n + ', Führerhaus links, Tür rechts, mit Füllanzeige für Stellplätze und Gewicht', s, 'svg-truck');
  }

  /* ============================================================ Zeitstrahl des Tages */
  const EVN = { fahrt: 'Lenkzeit', pause: 'Pause', warten: 'Warten', stand: 'Entladen' };
  function timeSvg(p, anim) {
    if (!p || !Array.isArray(p.ev) || !Array.isArray(p.stops) || !fin(p.start) || !fin(p.ende)) return '';
    const h0 = Math.floor(p.start / 60), h1 = Math.max(h0 + 1, Math.ceil(Math.max(p.ende, ...p.stops.map(s => s.bis)) / 60));
    const W = 420, x0 = 40, x1 = 408, X = m => x0 + (m - h0 * 60) / ((h1 - h0) * 60) * (x1 - x0), H = 96 + p.stops.length * 24;
    let s = '';
    const step = h1 - h0 > 10 ? 2 : 1;
    for (let h = h0; h <= h1; h += step) s += L(X(h * 60), 18, X(h * 60), H - 34, 'gr') + T(X(h * 60), 14, (h < 10 ? '0' : '') + h, 's mid m');
    p.ev.forEach((e, i) => { s += R(X(e.von), 24, X(e.bis) - X(e.von), 20, 'ev ' + e.art + (anim ? ' grow' : ''), 0, anim ? dl(i * 0.12) : ''); });
    s += T(4, 39, 'Tag', 's m');
    p.stops.forEach((st, i) => {
      const y = 56 + i * 24;
      s += T(4, y + 14, st.k, 'b') + R(X(st.von), y + 4, X(st.bis) - X(st.von), 12, 'win', 3);
      s += `<circle class="${st.spaet ? 'arr bad' : 'arr'}" cx="${q(X(st.an))}" cy="${y + 10}" r="6"/>`;
      if (st.spaet) s += T(Math.min(X(st.an) + 10, x1 - 40), y + 15, 'zu spät', 's bad b');
    });
    const ly = H - 14; let lx = 4;
    ['fahrt', 'pause', 'warten', 'stand'].forEach(a => { s += R(lx, ly - 11, 14, 12, 'ev ' + a, 2) + T(lx + 18, ly, EVN[a], 's'); lx += 30 + EVN[a].length * 7.5; });
    return svg(W, H, 'Zeitstrahl des Tages mit Lenkzeit, Pausen, Warten und Entladen sowie Zeitfenstern der Kunden', s, 'svg-time');
  }

  /* ============================================================ Lenkzeit der Woche */
  const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function weekSvg(tage, anim) {
    if (!Array.isArray(tage) || tage.length !== 6 || !tage.every(v => fin(v) && v >= 0)) return '';
    const W = 420, H = 230, x0 = 44, y0 = 200, top = 24, mx = 720, Y = m => y0 - Math.min(m, mx) / mx * (y0 - top);
    let s = '';
    [0, 180, 360, 540, 600, 720].forEach(m => { s += L(x0, Y(m), W - 8, Y(m), m === 540 ? 'lim9' : m === 600 ? 'lim10' : 'gr') + T(x0 - 6, Y(m) + 5, m / 60 + ' h', 's end m'); });
    const bw = (W - 8 - x0) / 6;
    tage.forEach((m, i) => {
      const x = x0 + i * bw + 8, cls = m > 600 ? 'bar bad' : m > 540 ? 'bar warn' : 'bar';
      s += R(x, Y(m), bw - 16, y0 - Y(m), cls + (anim ? ' up' : ''), 3, anim ? dl(i * 0.08) : '') + T(x + (bw - 16) / 2, y0 + 18, TAGE[i], 's mid');
      if (m > 0) s += T(x + (bw - 16) / 2, Y(m) - 5, C.fmtN(m / 60, 2), 's mid h');
    });
    s += T(W - 10, Y(540) - 5, '9 h', 's end ok') + T(W - 10, Y(600) - 5, '10 h', 's end warnt');
    return svg(W, H, 'Lenkzeit je Tag in Stunden mit den Grenzen 9 h und 10 h', s, 'svg-week');
  }

  /* ============================================================ Kostenvergleich */
  /* o: { kost (eigene Tour, €), preis (Spediteur je Palette, €), max (Stellplätze), pal (geplante Paletten) } */
  function kostSvg(o) {
    if (!o || !(o.kost >= 0) || !(o.preis > 0) || !(o.max >= 1) || !fin(o.pal)) return '';
    const W = 420, H = 240, x0 = 60, x1 = 404, y0 = 200, y1 = 30, mx = o.max, my = Math.max(o.kost, o.preis * mx) * 1.1 || 1;
    const X = n => x0 + n / mx * (x1 - x0), Y = v => y0 - v / my * (y0 - y1);
    let s = L(x0, y0, x1, y0, 'ax') + L(x0, y0, x0, y1 - 10, 'ax');
    const stp = mx > 20 ? 5 : mx > 8 ? 2 : 1;
    for (let n = 0; n <= mx; n += stp) s += L(X(n), y0, X(n), y0 + 4, 'ax') + T(X(n), y0 + 18, n, 's mid m');
    s += T(x0 - 6, Y(0) + 5, '0 €', 's end m') + T(x0 - 6, Y(my / 1.1) + 5, f(my / 1.1) + ' €', 's end m');
    s += `<path class="own draw" pathLength="1" d="M${q(X(0))},${q(Y(o.kost))} L${q(X(mx))},${q(Y(o.kost))}"/><path class="sped draw" pathLength="1" d="M${q(X(0))},${q(Y(0))} L${q(X(mx))},${q(Y(o.preis * mx))}"/>`;
    const be = C.abPaletten(o.kost, o.preis);
    if (fin(be) && be <= mx) s += L(X(o.kost / o.preis), y0, X(o.kost / o.preis), Y(o.kost), 'g-be') + T(Math.min(Math.max(X(o.kost / o.preis), 150), 300), 18, 'ab ' + be + ' Pal. eigene Tour günstiger', 's mid h');
    if (o.pal >= 0 && o.pal <= mx) s += `<circle class="pt" cx="${q(X(o.pal))}" cy="${q(Y(o.kost))}" r="6"/><circle class="pt2" cx="${q(X(o.pal))}" cy="${q(Y(o.preis * o.pal))}" r="6"/>`;
    s += T(x1, y0 + 34, 'Paletten', 's end m');
    return svg(W, H + 10, 'Kosten der eigenen Tour (waagrechte Linie) gegen Spediteur (steigende Linie) über der Palettenzahl', s, 'svg-kost');
  }

  /* ============================================================ Bilder zu den Aufgaben */
  /* Europalette, Lademeter und Stellplätze längs */
  function palFig() {
    let s = T(10, 20, 'Europalette von oben', 's b') + R(20, 34, 120, 80, 'pal k1', 3) + T(80, 80, '1,2 m x 0,8 m', 's mid dk b');
    s += T(80, 132, 'Länge 1,2 m', 's mid m') + T(150, 78, '0,8 m', 's m');
    s += T(206, 20, '1 Lademeter (ldm)', 's b') + R(220, 34, 100, 120, 'deck', 2) + T(270, 168, '1 m Ladelänge', 's mid m') + T(326, 98, '2,4 m', 's m');
    s += R(222, 36, 96, 38, 'pal k1 fd', 2) + T(270, 60, '0,4 ldm', 's mid dk b');
    s += T(10, 196, 'Längs geladen: 3 Paletten nebeneinander (3 · 0,8 m = 2,4 m).', 's') + T(10, 218, 'Lademeter = Länge · Breite / 2,4 m.', 's');
    return svg(420, 230, 'Europalette 1,2 m x 0,8 m und ein Lademeter: 1 m Ladelänge über die volle Breite von 2,4 m', s, 'svg-fig');
  }
  /* Last In First Out: zuerst hinein steht vorn, zuletzt hinein steht an der Tür */
  function lifoFig() {
    let s = rad(30, 40, 84) + rad(300, 40, 84) + cabTop(20, 44, 46, 76) + R(76, 40, 300, 84, 'deck', 3) + L(76, 37, 76, 127, 'wall') + L(376, 37, 376, 127, 'door');
    ['k6', 'k4', 'k2', 'k0'].forEach((k, i) => { s += R(80 + i * 74, 46, 68, 72, 'pal ' + k + ' fd', 3) + L(88 + i * 74, 47, 88 + i * 74, 117, 'plk') + L(140 + i * 74, 47, 140 + i * 74, 117, 'plk') + T(114 + i * 74, 88, (i + 1) + '.', 'b mid dk'); });
    s += T(80, 26, '← Fahrtrichtung', 's m') + T(376, 26, 'Tür', 's end m');
    s += T(80, 148, '1. zuerst eingeladen: letzter Kunde der Tour', 's') + T(80, 170, '4. zuletzt eingeladen: erster Kunde, steht an der Tür', 's');
    s += T(80, 196, 'Zuletzt hinein, zuerst hinaus (Last In First Out).', 's b');
    return svg(420, 210, 'Laderaum von oben: zuerst eingeladene Ware steht vorn an der Stirnwand, zuletzt eingeladene Ware an der Tür', s, 'svg-fig');
  }
  /* Lenkzeit-Grundregeln als Band */
  function regelFig() {
    const X = m => 20 + m / 600 * 380;
    let s = T(10, 20, 'Ein Arbeitstag (Beispiel mit 9 h Lenkzeit)', 's b');
    s += R(X(0), 32, X(270) - X(0), 26, 'ev fahrt') + R(X(270), 32, X(315) - X(270), 26, 'ev pause') + R(X(315), 32, X(585) - X(315), 26, 'ev fahrt');
    s += T((X(0) + X(270)) / 2, 50, '4,5 h Lenkzeit', 's mid nrt b') + T((X(315) + X(585)) / 2, 50, '4,5 h Lenkzeit', 's mid nrt b') + T((X(270) + X(315)) / 2, 76, '45 min', 's mid b');
    s += T(10, 104, 'Pause teilbar: erst mindestens 15 min, dann mindestens 30 min.', 's');
    s += T(10, 126, 'Entladen und Warten sind keine Pause.', 's');
    s += T(10, 150, 'Tag höchstens 9 h, zweimal je Woche 10 h.', 's') + T(10, 172, 'Woche höchstens 56 h, zwei Wochen zusammen 90 h.', 's') + T(10, 194, 'Danach mindestens 11 h tägliche Ruhezeit.', 's');
    return svg(420, 206, 'Lenkzeitregeln: nach 4,5 h Lenkzeit 45 min Pause, Tag 9 h, Woche 56 h, Doppelwoche 90 h, Ruhezeit 11 h', s, 'svg-fig');
  }
  /* Aufbau der Kosten einer Tour */
  function kostFig() {
    let s = T(10, 20, 'So setzen sich die Kosten einer Tour zusammen', 's b');
    s += R(20, 34, 180, 34, 'own-b', 3) + T(110, 56, 'km · Kilometersatz', 's mid b') + R(200, 34, 140, 34, 'sped-b', 3) + T(270, 56, 'h · Stundensatz', 's mid b');
    s += T(110, 88, 'Kraftstoff, Reifen, Maut', 's mid m') + T(270, 88, 'Lohn, Fahrzeug je Stunde', 's mid m');
    s += L(20, 104, 340, 104, 'ax') + T(180, 126, '= Kosten der Tour', 's mid b');
    s += T(180, 154, 'Kosten je Palette = Kosten der Tour / Paletten', 's mid') + T(180, 178, 'Spediteur: Paletten · Preis je Palette', 's mid');
    return svg(420, 192, 'Kosten einer Tour: Kilometerkosten plus Zeitkosten, geteilt durch die Paletten ergibt die Kosten je Palette', s, 'svg-fig');
  }
  /* fig: { art: 'map', mark: [...], order: [...] } | { art: 'pal' } | { art: 'lifo' } | { art: 'regel' } | { art: 'kosten' } */
  function figSvg(fig) {
    if (!fig) return '';
    if (fig.art === 'map') return mapSvg({ order: fig.order || [], mark: fig.mark || null });
    if (fig.art === 'pal') return palFig();
    if (fig.art === 'lifo') return lifoFig();
    if (fig.art === 'regel') return regelFig();
    if (fig.art === 'kosten') return kostFig();
    return '';
  }

  const API = { mapSvg, truckSvg, timeSvg, weekSvg, kostSvg, figSvg, route, TAGE };
  root.TOU_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
