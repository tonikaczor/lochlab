'use strict';
/* Tonfunk Leiterplatten-Lab: Visualisierungen (Lab-Kennung 'pcb'). Datei wird in pcblab.html NACH pcbui.js geladen.
   Reine Zeichenfunktionen (liefern SVG-/HTML-Text, ohne DOM, testbar mit node quelle/pcblab/test_pcbviz.js) plus ein kleiner Haken,
   der die Bilder in vorhandene Reiter einfügt (MutationObserver; pcbui.js, pcbfab.js und die Aufgaben bleiben unverändert):
     Lernen:           "Bauformen: Größen maßstäblich": Widerstände nach Nennleistung 0,25 / 0,5 / 1 / 2 W, SMD-Chips 0402 bis 2512,
                       Kondensatoren (Elko, Keramik, Folie) und Gehäuse TO-92, TO-220, SOT-23, SOIC-8, DIP-8 mit Pads und Lötaugen
                       (Pads und Bohrungen kommen aus der Footprint-Bibliothek PCB_CORE.footprints, die Gehäusemaße aus den Daten unten)
     Lagen > Aufbau:   Lagenaufbau als isometrische 3D-Skizze, auf Wunsch auseinandergezogen (Dicken nur lesbar, nicht maßstäblich)
   Alle Maße sind typische Richtwerte (Normreihen und gängige Bauformen). Die Hersteller-Datenblätter gelten.
   Nur Lehrbilder, keine Aufgaben und keine Lösungen. Farben: Text, Linien und Flächen über CSS-Variablen der Seite;
   die Bauteil- und Lagenfarben (Kupfer, Lötstopplack, FR-4, Widerstands-Farbcode) sind physikalische Standardfarben und gelten in jedem Theme. */
(function (root) {
  const CORE = root.PCB_CORE || (typeof require === 'function' ? require('./pcbcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de = (v, d) => (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toString().replace('.', ',');
  const T = (x, y, t, cls, anchor) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${anchor ? ' text-anchor="' + anchor + '"' : ''}>${esc(t)}</text>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;

  /* ============================================================ Daten: typische Baugrößen (mm) */
  /* Widerstand bedrahtet (Kohle-/Metallschicht): Nennleistung, Gehäuselänge L, Durchmesser D, Rastermaß liegend (Mindest), Name nach DIN-Bauform */
  const RES_AXIAL = [
    { w: 0.25, L: 6.3, D: 2.5, pitch: 10.16, din: '0207' },
    { w: 0.5, L: 9.0, D: 3.2, pitch: 12.7, din: '0309' },
    { w: 1, L: 11.5, D: 4.5, pitch: 15.24, din: '0411' },
    { w: 2, L: 15.0, D: 5.5, pitch: 20.32, din: '0614' }
  ];
  /* SMD-Chip: Kurzname (Zoll), metrisch, Länge, Breite, übliche Nennleistung in W */
  const RES_SMD = [
    { code: '0402', metric: '1005', L: 1.0, W: 0.5, P: 0.063, fp: 'R0402' },
    { code: '0603', metric: '1608', L: 1.6, W: 0.8, P: 0.1, fp: 'R0603' },
    { code: '0805', metric: '2012', L: 2.0, W: 1.25, P: 0.125, fp: 'R0805' },
    { code: '1206', metric: '3216', L: 3.2, W: 1.6, P: 0.25, fp: 'R1206' },
    { code: '2512', metric: '6332', L: 6.3, W: 3.2, P: 1, fp: '' }
  ];
  /* Kondensatoren (Seitenansicht): D Durchmesser oder B Breite, H Höhe, Raster */
  const CAP_ELKO = [
    { D: 5, H: 11, pitch: 2.5 }, { D: 6.3, H: 11, pitch: 2.5 }, { D: 8, H: 11.5, pitch: 3.5 }, { D: 10, H: 16, pitch: 5 }
  ];
  const CAP_OTHER = [
    { k: 'mlcc', name: 'Keramik (Vielschicht)', B: 5, H: 5.5, pitch: 5.08 },
    { k: 'disc', name: 'Keramik (Scheibe)', B: 5, H: 8, pitch: 5 },
    { k: 'mkt1', name: 'Folie (Box) klein', B: 7.2, H: 7.5, pitch: 5 },
    { k: 'mkt2', name: 'Folie (Box) groß', B: 13, H: 11.5, pitch: 10 }
  ];
  /* Gehäuse: Kurzname, Footprint, Körper b x t (Breite in x, Tiefe in y der Draufsicht), Bauhöhe */
  const PACKS = [
    { id: 'TO-92', name: 'TO-92', fp: 'TO-92', kind: 'THT', body: [4.6, 3.8], height: '4,5 bis 5 mm', info: '3 Beine, Raster 2,54 mm, Transistor klein' },
    { id: 'TO-220', name: 'TO-220', fp: 'TO-220', kind: 'THT', body: [10.2, 4.5], height: 'etwa 16 mm mit Kühlfahne', info: '3 Beine, Raster 2,54 mm, Kühlfahne mit Loch, Leistungstransistor, Spannungsregler' },
    { id: 'SOT-23', name: 'SOT-23', fp: 'SOT-23', kind: 'SMD', body: [1.3, 2.9], height: 'etwa 1 mm', info: '3 Anschlüsse, Raster 0,95 mm, Transistor oder Diode klein' },
    { id: 'SOIC-8', name: 'SOIC-8', fp: 'SOIC-8', kind: 'SMD', body: [3.9, 4.9], height: 'etwa 1,7 mm', info: '8 Pins, Raster 1,27 mm, Breite mit Beinen etwa 6 mm' },
    { id: 'DIP-8', name: 'DIP-8', fp: 'DIP-8', kind: 'THT', body: [6.35, 9.3], height: 'etwa 4 bis 5 mm', info: '8 Pins, Raster 2,54 mm, Reihenabstand 7,62 mm, steckbar im Sockel' }
  ];

  /* ============================================================ Widerstände bedrahtet (maßstäblich) */
  const BANDS = ['band-y', 'band-v', 'band-r', 'band-g'];   // 4,7 kΩ ±5 %: gelb, violett, rot, gold
  /* Maßstab: px je mm in der Zeichnung der Widerstände */
  const SR = 9;
  function resAxialSvg() {
    const W = 360, rh = 46, H = RES_AXIAL.length * rh + 34, xs = 104, lead = 3.5 * SR; let s = '';
    RES_AXIAL.forEach((r, i) => {
      const yc = 24 + i * rh, L = r.L * SR, D = r.D * SR, x0 = xs + lead;
      s += `<line class="lead" x1="${xs}" y1="${yc}" x2="${q(x0)}" y2="${yc}"/><line class="lead" x1="${q(x0 + L)}" y1="${yc}" x2="${q(x0 + L + lead)}" y2="${yc}"/>`;
      s += `<rect class="rbody" x="${q(x0)}" y="${q(yc - D / 2)}" width="${q(L)}" height="${q(D)}" rx="${q(Math.min(D / 2.4, 6))}"/>`;
      [0.17, 0.31, 0.45, 0.74].forEach((f, k) => { s += `<rect class="${BANDS[k]}" x="${q(x0 + L * f)}" y="${q(yc - D / 2)}" width="${q(Math.max(2.2, L * 0.07))}" height="${q(D)}"/>`; });
      s += T(6, yc - 2, de(r.w, 2) + ' W', 'b') + T(6, yc + 13, de(r.L, 1) + ' × ' + de(r.D, 1) + ' mm', 'm');
    });
    const yb = H - 14; s += `<line class="sb" x1="${xs}" y1="${yb}" x2="${xs + 5 * SR}" y2="${yb}"/><line class="sb" x1="${xs}" y1="${yb - 4}" x2="${xs}" y2="${yb + 4}"/><line class="sb" x1="${xs + 5 * SR}" y1="${yb - 4}" x2="${xs + 5 * SR}" y2="${yb + 4}"/>` + T(xs + 5 * SR + 8, yb + 4, '5 mm', 'm');
    return svg(W, H, 'Bedrahtete Widerstände 0,25, 0,5, 1 und 2 Watt im gleichen Maßstab nebeneinander', s);
  }

  /* ============================================================ SMD-Chips mit Pads */
  const SS = 13;   // px je mm
  function smdSvg() {
    const W = 360, gap = 14, items = RES_SMD.map(r => {
      const f = r.fp && CORE && CORE.footprints && CORE.footprints[r.fp], pads = f ? f.pads : null;
      const wTot = pads ? Math.max(r.L, Math.max.apply(null, pads.map(p => Math.abs(p.x) + p.w / 2)) * 2) : r.L;
      return { r, pads, wTot };
    }), total = items.reduce((a, i) => a + i.wTot * SS, 0) + gap * (items.length - 1), H = 86;
    let x = Math.max(6, (W - total) / 2), s = '';
    items.forEach(it => {
      const r = it.r, wpx = it.wTot * SS, cx = x + wpx / 2, cy = 34, Lp = r.L * SS, Wp = r.W * SS;
      if (it.pads) it.pads.forEach(p => { s += `<rect class="pad" x="${q(cx + (p.x - p.w / 2) * SS)}" y="${q(cy + (p.y - p.h / 2) * SS)}" width="${q(p.w * SS)}" height="${q(p.h * SS)}"/>`; });
      s += `<rect class="chip" x="${q(cx - Lp / 2)}" y="${q(cy - Wp / 2)}" width="${q(Lp)}" height="${q(Wp)}"/>`;
      const ec = Math.max(1.2, Lp * 0.14);
      s += `<rect class="cap" x="${q(cx - Lp / 2)}" y="${q(cy - Wp / 2)}" width="${q(ec)}" height="${q(Wp)}"/><rect class="cap" x="${q(cx + Lp / 2 - ec)}" y="${q(cy - Wp / 2)}" width="${q(ec)}" height="${q(Wp)}"/>`;
      s += T(cx, 74, r.code, 'b', 'middle');
      x += wpx + gap;
    });
    return svg(W, H, 'SMD-Widerstände 0402, 0603, 0805, 1206 und 2512 im gleichen Maßstab, die Kupferflächen (Pads) darunter', s);
  }

  /* ============================================================ Kondensatoren (Seitenansicht, gleicher Maßstab) */
  const SC = 6.5;
  function capSvg() {
    const W = 360, base1 = 124, base2 = 262, H = 322; let s = '';
    let x = 14;
    s += T(6, 14, 'Elektrolyt (Elko), radial', 'b');
    CAP_ELKO.forEach(c => {
      const w = c.D * SC, h = c.H * SC, y0 = base1 - h, pp = c.pitch * SC, cx = x + w / 2;
      s += `<line class="lead" x1="${q(cx - pp / 2)}" y1="${base1}" x2="${q(cx - pp / 2)}" y2="${base1 + 12}"/><line class="lead" x1="${q(cx + pp / 2)}" y1="${base1}" x2="${q(cx + pp / 2)}" y2="${base1 + 12}"/>`;
      s += `<rect class="elko" x="${q(x)}" y="${q(y0)}" width="${q(w)}" height="${q(h)}" rx="2"/><rect class="elkoneg" x="${q(x + 1)}" y="${q(y0 + 3)}" width="${q(Math.max(4, w * 0.22))}" height="${q(h - 6)}"/>`;
      s += `<line class="elkotop" x1="${q(x + 2)}" y1="${q(y0 + 4)}" x2="${q(x + w - 2)}" y2="${q(y0 + 4)}"/>`;
      s += T(cx, base1 + 28, 'Ø' + de(c.D, 1) + '×' + de(c.H, 1), 's', 'middle');
      x += w + 18;
    });
    s += T(6, 184, 'Keramik und Folie', 'b');
    x = 14;
    CAP_OTHER.forEach(c => {
      const w = c.B * SC, h = c.H * SC, y0 = base2 - h, pp = c.pitch * SC, cx = x + w / 2, cls = c.k === 'mlcc' ? 'mlcc' : c.k === 'disc' ? 'disc' : 'mkt';
      const lx1 = Math.max(x + 3, cx - pp / 2), lx2 = Math.min(x + w - 3, cx + pp / 2);
      s += `<line class="lead" x1="${q(c.k === 'mkt2' ? x + 4 : lx1)}" y1="${base2}" x2="${q(c.k === 'mkt2' ? x + 4 : lx1)}" y2="${base2 + 10}"/><line class="lead" x1="${q(c.k === 'mkt2' ? x + w - 4 : lx2)}" y1="${base2}" x2="${q(c.k === 'mkt2' ? x + w - 4 : lx2)}" y2="${base2 + 10}"/>`;
      s += c.k === 'disc' ? `<path class="${cls}" d="M${q(x)} ${base2} L${q(x)} ${q(y0 + w / 2)} A${q(w / 2)} ${q(w / 2)} 0 0 1 ${q(x + w)} ${q(y0 + w / 2)} L${q(x + w)} ${base2} Z"/>` : `<rect class="${cls}" x="${q(x)}" y="${q(y0)}" width="${q(w)}" height="${q(h)}" rx="${c.k === 'mlcc' ? 3 : 1.5}"/>`;
      s += T(cx, base2 + 28, de(c.B, 1) + '×' + de(c.H, 1), 's', 'middle');
      x += w + 18;
    });
    const yb = H - 8; s += `<line class="sb" x1="14" y1="${yb}" x2="${14 + 10 * SC}" y2="${yb}"/><line class="sb" x1="14" y1="${yb - 4}" x2="14" y2="${yb + 4}"/><line class="sb" x1="${14 + 10 * SC}" y1="${yb - 4}" x2="${14 + 10 * SC}" y2="${yb + 4}"/>` + T(14 + 10 * SC + 8, yb + 4, '10 mm', 'm');
    return svg(W, H, 'Kondensatoren im gleichen Maßstab: Elkos in vier Größen, Keramik und Folie', s);
  }

  /* ============================================================ Gehäuse mit Pads (Draufsicht) */
  const SP = 11.5;   // px je mm
  function bodyShape(id, cx, cy) {
    const X = v => cx + v * SP, Y = v => cy + v * SP;
    if (id === 'TO-92') return `<path class="pbody" d="M${q(X(-2.3))} ${q(Y(-0.6))} L${q(X(-2.3))} ${q(Y(-2.1))} A${q(2.3 * SP)} ${q(2.3 * SP)} 0 0 1 ${q(X(2.3))} ${q(Y(-2.1))} L${q(X(2.3))} ${q(Y(-0.6))} Z"/>`;
    if (id === 'TO-220') return `<rect class="pbody" x="${q(X(-5.1))}" y="${q(Y(-6.1))}" width="${q(10.2 * SP)}" height="${q(4.5 * SP)}" rx="1.5"/><rect class="ptab" x="${q(X(-5.1))}" y="${q(Y(-6.1))}" width="${q(10.2 * SP)}" height="${q(1.3 * SP)}" rx="1.5"/>`;
    if (id === 'SOT-23') return `<rect class="pbody" x="${q(X(-0.65))}" y="${q(Y(-1.45))}" width="${q(1.3 * SP)}" height="${q(2.9 * SP)}" rx="1"/>` + [[-1.2, -0.95], [-1.2, 0.95], [1.2, 0]].map(l => `<line class="pleg" x1="${q(X(l[0] < 0 ? -0.65 : 0.65))}" y1="${q(Y(l[1]))}" x2="${q(X(l[0]))}" y2="${q(Y(l[1]))}"/>`).join('');
    if (id === 'SOIC-8') { let s = `<rect class="pbody" x="${q(X(-1.95))}" y="${q(Y(-2.45))}" width="${q(3.9 * SP)}" height="${q(4.9 * SP)}" rx="1"/>`; [-1.905, -0.635, 0.635, 1.905].forEach(y => { s += `<line class="pleg" x1="${q(X(-3))}" y1="${q(Y(y))}" x2="${q(X(-1.95))}" y2="${q(Y(y))}"/><line class="pleg" x1="${q(X(1.95))}" y1="${q(Y(y))}" x2="${q(X(3))}" y2="${q(Y(y))}"/>`; }); return s; }
    if (id === 'DIP-8') return `<rect class="pbody" x="${q(X(-3.175))}" y="${q(Y(-4.65))}" width="${q(6.35 * SP)}" height="${q(9.3 * SP)}" rx="1.5"/><path class="pnotch" d="M${q(X(-0.8))} ${q(Y(-4.65))} A${q(0.8 * SP)} ${q(0.8 * SP)} 0 0 0 ${q(X(0.8))} ${q(Y(-4.65))}"/>`;
    return '';
  }
  function padShape(p, cx, cy) {
    const x = cx + (p.x - p.w / 2) * SP, y = cy + (p.y - p.h / 2) * SP, w = p.w * SP, h = p.h * SP;
    let s = p.shape === 'round' ? `<circle class="pad" cx="${q(cx + p.x * SP)}" cy="${q(cy + p.y * SP)}" r="${q(p.w * SP / 2)}"/>`
      : p.shape === 'oval' ? `<rect class="pad" x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}" rx="${q(Math.min(w, h) / 2)}"/>`
        : `<rect class="pad" x="${q(x)}" y="${q(y)}" width="${q(w)}" height="${q(h)}"/>`;
    if (p.drill) s += `<circle class="drill" cx="${q(cx + p.x * SP)}" cy="${q(cy + p.y * SP)}" r="${q(p.drill * SP / 2)}"/>`;
    return s;
  }
  /* Bounding box (mm) eines Gehäuses aus Pads und Körper, für die Zentrierung */
  function packBox(pk) {
    const f = CORE && CORE.footprints && CORE.footprints[pk.fp], pads = f ? f.pads : [];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pads.forEach(p => { x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2); y0 = Math.min(y0, p.y - p.h / 2); y1 = Math.max(y1, p.y + p.h / 2); });
    const bx = pk.id === 'TO-92' ? [-2.3, 2.3, -3.8 - 0.6, -0.6] : pk.id === 'TO-220' ? [-5.1, 5.1, -6.1, -1.6] : pk.id === 'DIP-8' ? [-3.175, 3.175, -4.65, 4.65] : pk.id === 'SOIC-8' ? [-3, 3, -2.45, 2.45] : [-1.2, 1.2, -1.45, 1.45];
    return { x0: Math.min(x0, bx[0]), x1: Math.max(x1, bx[1]), y0: Math.min(y0, bx[2]), y1: Math.max(y1, bx[3]) };
  }
  function packSvg() {
    const W = 360, cw = 168, chh = 158, rowsN = Math.ceil((PACKS.length + 1) / 2), H = rowsN * chh + 6; let s = '';
    PACKS.forEach((pk, i) => {
      const col = i % 2, row = Math.floor(i / 2), ox = 6 + col * (cw + 18), oy = 4 + row * chh, f = CORE && CORE.footprints && CORE.footprints[pk.fp], b = packBox(pk);
      s += `<rect class="cell" x="${ox}" y="${oy}" width="${cw}" height="${chh - 8}" rx="8"/>`;
      const cx = ox + cw / 2 - (b.x0 + b.x1) / 2 * SP, cy = oy + 16 + (chh - 8 - 16 - 26) / 2 - (b.y0 + b.y1) / 2 * SP + 4;
      if (f) f.pads.forEach(p => { s += padShape(p, cx, cy); });
      s += bodyShape(pk.id, cx, cy);
      if (pk.id === 'TO-220') { s += `<circle class="drill" cx="${q(cx)}" cy="${q(cy - 3.6 * SP)}" r="${q(1.9 * SP / 2)}"/>`; }
      if (f && f.pads[0]) s += `<circle class="pin1" cx="${q(cx + f.pads[0].x * SP)}" cy="${q(cy + f.pads[0].y * SP)}" r="2.4"/>`;
      s += T(ox + 8, oy + 15, pk.name, 'b') + T(ox + cw - 8, oy + 15, pk.kind, 'm', 'end');
      s += T(ox + cw / 2, oy + chh - 16, de(b.x1 - b.x0, 1) + ' × ' + de(b.y1 - b.y0, 1) + ' mm (mit Pads)', 's', 'middle');
    });
    const i = PACKS.length, col = i % 2, row = Math.floor(i / 2), ox = 6 + col * (cw + 18), oy = 4 + row * chh;
    s += `<rect class="cell" x="${ox}" y="${oy}" width="${cw}" height="${chh - 8}" rx="8"/>`;
    s += T(ox + 8, oy + 20, 'So liest du die Bilder', 'b');
    s += `<rect class="pad" x="${ox + 10}" y="${oy + 34}" width="14" height="10"/>` + T(ox + 32, oy + 43, 'Pad (Kupfer)', 's');
    s += `<circle class="pad" cx="${ox + 17}" cy="${oy + 62}" r="7"/><circle class="drill" cx="${ox + 17}" cy="${oy + 62}" r="3"/>` + T(ox + 32, oy + 66, 'Lötauge, Bohrung', 's');
    s += `<rect class="pbody" x="${ox + 10}" y="${oy + 78}" width="14" height="10" rx="1.5"/>` + T(ox + 32, oy + 87, 'Gehäuse', 's');
    s += `<circle class="pin1" cx="${ox + 17}" cy="${oy + 104}" r="3"/>` + T(ox + 32, oy + 108, 'Pin 1', 's');
    const sbx = ox + 10, sby = oy + 126; s += `<line class="sb" x1="${sbx}" y1="${sby}" x2="${q(sbx + 5 * SP)}" y2="${sby}"/><line class="sb" x1="${sbx}" y1="${sby - 4}" x2="${sbx}" y2="${sby + 4}"/><line class="sb" x1="${q(sbx + 5 * SP)}" y1="${sby - 4}" x2="${q(sbx + 5 * SP)}" y2="${sby + 4}"/>` + T(sbx + 5 * SP + 8, sby + 4, '5 mm', 'm');
    return svg(W, H, 'Gehäuse TO-92, TO-220, SOT-23, SOIC-8 und DIP-8 von oben im gleichen Maßstab mit ihren Pads', s);
  }

  /* ============================================================ Tabellen und Seite */
  function tableRes() {
    return '<table><tr><th>Leistung</th><th>Bauform</th><th>Länge × Ø</th><th>Raster (Footprint)</th></tr>' + RES_AXIAL.map(r => `<tr><td><b>${de(r.w, 2)} W</b></td><td>${r.din}</td><td>${de(r.L, 1)} × ${de(r.D, 1)} mm</td><td>${de(r.pitch, 2)} mm</td></tr>`).join('') + '</table>';
  }
  function tableSmd() {
    return '<table><tr><th>Bauform</th><th>metrisch</th><th>L × B</th><th>Leistung</th></tr>' + RES_SMD.map(r => `<tr><td><b>${r.code}</b></td><td>${r.metric}</td><td>${de(r.L, 2)} × ${de(r.W, 2)} mm</td><td>${de(r.P, 3)} W</td></tr>`).join('') + '</table>';
  }
  function tablePack() {
    return '<table><tr><th>Gehäuse</th><th>Art</th><th>Bauhöhe</th></tr>' + PACKS.map(p => `<tr><td><b>${p.name}</b><br><span class="mu">${esc(p.info)}</span></td><td>${p.kind}</td><td>${esc(p.height)}</td></tr>`).join('') + '</table>';
  }
  function catalogHtml() {
    return '<div class="pcbviz">'
      + '<p>Alle Bilder hier haben <b>denselben Maßstab</b> innerhalb einer Zeichnung (Maßstabsbalken). Die Werte sind typische Richtwerte; im Datenblatt steht das genaue Maß.</p>'
      + '<h4>Widerstand: Größe nach Nennleistung</h4><p>Ein Widerstand wandelt Leistung in Wärme um. Je mehr Leistung er dauerhaft aushalten soll, desto größer muss der Körper sein, damit er die Wärme abgeben kann. Die Ringe zeigen als Beispiel 4,7 kΩ ± 5 % (gelb, violett, rot, gold).</p>'
      + `<div class="vzbox">${resAxialSvg()}</div>${tableRes()}`
      + '<p class="hint2">Merke: Ein 2-W-Widerstand ist mehr als doppelt so lang wie ein 0,25-W-Widerstand. Das Raster ist der Lochabstand für liegenden Einbau. Im Layout findest du die Größen unter „Bauteil“ als R_AXIAL_10 (0,25 W), R_AXIAL_12.7 (0,5 W), R_AXIAL_15 (1 W) und R_AXIAL_20 (2 W).</p>'
      + '<h4>SMD-Chip: Bauform und Pads</h4><p>Der Name der Bauform ist das Maß in Hundertstel Zoll: 0603 heißt 0,06 × 0,03 Zoll, also 1,6 × 0,8 mm. Unter dem Chip liegen zwei Kupferflächen, die <b>Pads</b>, an denen das Lot den Chip hält. Die Pads sind etwas größer als die Anschlusskappen.</p>'
      + `<div class="vzbox">${smdSvg()}</div>${tableSmd()}`
      + '<p class="hint2">Für den Footprint-Entwurf gilt: Kleine Bauform, kleine Leistung. Für 1 W oder mehr nimmst du 2512 oder ein bedrahtetes Bauteil.</p>'
      + '<h4>Kondensatoren: Elko, Keramik, Folie</h4><p>Der <b>Elko</b> (Elektrolytkondensator) hat viel Kapazität auf kleinem Raum, ist aber <b>gepolt</b>: Der Streifen am Becher markiert den Minuspol, das längere Bein ist Plus. Größere Kapazität oder Spannung braucht einen größeren Becher. <b>Keramik</b>- und <b>Folienkondensatoren</b> sind nicht gepolt und eher für kleine Kapazitäten (pF bis µF), Abblocken und Filter.</p>'
      + `<div class="vzbox">${capSvg()}</div>`
      + '<table><tr><th>Typ</th><th>Maße</th><th>Raster</th></tr>' + CAP_ELKO.map(c => `<tr><td><b>Elko</b> Ø${de(c.D, 1)}</td><td>Ø ${de(c.D, 1)} × ${de(c.H, 1)} mm</td><td>${de(c.pitch, 1)} mm</td></tr>`).join('') + CAP_OTHER.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${de(c.B, 1)} × ${de(c.H, 1)} mm</td><td>${de(c.pitch, 2)} mm</td></tr>`).join('') + '</table>'
      + '<h4>Gehäuse von Transistoren und ICs</h4><p>Dieselben Bauteile gibt es in vielen Gehäusen. <b>THT</b>-Gehäuse (TO-92, TO-220, DIP) haben Beine und brauchen <b>Lötaugen mit Bohrung</b>. <b>SMD</b>-Gehäuse (SOT-23, SOIC) liegen auf <b>Pads</b> ohne Bohrung. Das Raster (Abstand von Pin zu Pin) ist bei THT meist 2,54 mm, bei SOIC 1,27 mm, bei SOT-23 nur 0,95 mm.</p>'
      + `<div class="vzbox">${packSvg()}</div>${tablePack()}`
      + '</div>';
  }

  /* ============================================================ Lagenaufbau als isometrische 3D-Skizze */
  /* rows: Ergebnis von PCB_CORE.stackup(board) (von oben nach unten). exploded: Lagen auseinanderziehen. */
  const VIS = { silk: 2, mask: 3, copper: 5, prepreg: 9, core: 16 };
  const KCLS = { silk: 'silk', mask: 'mask', copper: 'cu', prepreg: 'pp', core: 'fr' };
  function layerLabel(r) {
    const t = r.thickness, mu = Math.round(t * 1000 * 10) / 10;
    return r.name + ' (' + (mu >= 100 ? Math.round(mu) : de(mu, 1)) + ' µm)';
  }
  function stack3dSvg(rows, exploded) {
    if (!Array.isArray(rows) || rows.length < 3) return '';
    const n = rows.length, gap = exploded ? (n > 11 ? 12 : 17) : 0, A = 104, B = 62, ux = 0.866, uy = 0.5, W = 360, ox = 8, LH = 15, lx = 168;
    const th = rows.map(r => VIS[r.kind] || 5), body = th.reduce((a, b) => a + b, 0) + gap * (n - 1), top = 12;
    const H = Math.max(top + body + (A + B) * uy + 36, top + n * LH + 36);
    let s = '', labs = '', y = top + B * uy, lyPrev = -1e9;
    for (let i = 0; i < n; i++) {
      const r = rows[i], t = th[i], cls = KCLS[r.kind] || 'fr';
      // Ecken der Deckfläche: p0 hinten, p1 rechts, p2 vorne, p3 links
      const p0 = [ox + B * ux, y - B * uy], p1 = [ox + (A + B) * ux, y - B * uy + A * uy], p2 = [ox + A * ux, y + A * uy - B * uy + B * uy], p3 = [ox, y];
      const P = a => q(a[0]) + ',' + q(a[1]), D = a => q(a[0]) + ',' + q(a[1] + t);
      s += `<polygon class="lay ${cls} side" points="${P(p3)} ${P(p2)} ${D(p2)} ${D(p3)}"/><polygon class="lay ${cls} side2" points="${P(p2)} ${P(p1)} ${D(p1)} ${D(p2)}"/>`;
      s += `<polygon class="lay ${cls} top" points="${P(p0)} ${P(p1)} ${P(p2)} ${P(p3)}"/>`;
      const ly = Math.max(p1[1] + t / 2, lyPrev + LH); lyPrev = ly;
      labs += `<line class="lead2" x1="${q(p1[0] + 2)}" y1="${q(p1[1] + t / 2)}" x2="${lx - 4}" y2="${q(ly)}"/>` + T(lx, ly + 4, layerLabel(r), 'l');
      y += t + gap;
    }
    s += labs + T(6, H - 10, exploded ? 'Auseinandergezogen: beim Pressen werden die Lagen verklebt.' : 'Zusammengesetzt: Hitze und Druck verpressen die Lagen.', 'm');
    return svg(W, H, 'Lagenaufbau als 3D-Skizze: ' + n + ' Schichten von oben nach unten', s);
  }

  const API = { RES_AXIAL, RES_SMD, CAP_ELKO, CAP_OTHER, PACKS, resAxialSvg, smdSvg, capSvg, packSvg, packBox, catalogHtml, stack3dSvg, layerLabel, tableRes, tableSmd, tablePack };
  root.PCB_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined') return;
  const $ = (s, r) => (r || document).querySelector(s);
  const CSS = `.pcbviz h4{margin:16px 0 6px;font-size:15px}.pcbviz p{margin:6px 0}
.pcbviz{--vz-cu:#c8873a;--vz-mask:#1f8a3f;--vz-fr:#3d7a4c;--vz-pp:#7c8f5a;--vz-silk:#ececec;--vz-res:#d6b676;--vz-chip:#2b2b30;--vz-cap:#b9bcc2;--vz-elko:#233a73;--vz-mlcc:#c99a3b;--vz-disc:#c9772f;--vz-mkt:#3a63b0;--vz-ic:#26262b}
.pcbviz .vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:640px;margin:8px 0}
.pcbviz .vzbox svg,.pcbvz3 .vzbox svg{display:block;width:100%;height:auto}
.pcbviz svg text,.pcbvz3 svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.pcbviz svg text.b,.pcbvz3 svg text.b{font-weight:700}.pcbviz svg text.m,.pcbvz3 svg text.m{fill:var(--mute)}.pcbviz svg text.s{font-size:11.5px;fill:var(--mute)}.pcbvz3 svg text.l{font-size:12px}
.pcbviz svg .lead{stroke:var(--mute);stroke-width:2.2;stroke-linecap:round}.pcbviz svg .sb{stroke:var(--fg);stroke-width:1.6}
.pcbviz svg .rbody{fill:var(--vz-res);stroke:var(--fg);stroke-opacity:.45;stroke-width:1}
.pcbviz svg .band-y{fill:#e6c619}.pcbviz svg .band-v{fill:#7a3fa0}.pcbviz svg .band-r{fill:#d2362b}.pcbviz svg .band-g{fill:#c9a227}
.pcbviz svg .pad{fill:var(--vz-cu)}.pcbviz svg .drill{fill:var(--panel2);stroke:var(--fg);stroke-opacity:.5;stroke-width:.8}
.pcbviz svg .chip{fill:var(--vz-chip);stroke:var(--fg);stroke-opacity:.5;stroke-width:1}.pcbviz svg .cap{fill:var(--vz-cap)}
.pcbviz svg .elko{fill:var(--vz-elko);stroke:var(--fg);stroke-opacity:.45;stroke-width:1}.pcbviz svg .elkoneg{fill:var(--vz-cap);opacity:.85}.pcbviz svg .elkotop{stroke:var(--fg);stroke-opacity:.35;stroke-width:1}
.pcbviz svg .mlcc{fill:var(--vz-mlcc);stroke:var(--fg);stroke-opacity:.45}.pcbviz svg .disc{fill:var(--vz-disc);stroke:var(--fg);stroke-opacity:.45}.pcbviz svg .mkt{fill:var(--vz-mkt);stroke:var(--fg);stroke-opacity:.45}
.pcbviz svg .cell{fill:none;stroke:var(--line);stroke-width:1}
.pcbviz svg .pbody{fill:var(--vz-ic);stroke:var(--fg);stroke-opacity:.55;stroke-width:1.2}.pcbviz svg .ptab{fill:var(--vz-cap);opacity:.9}.pcbviz svg .pleg{stroke:var(--vz-cap);stroke-width:2.4}.pcbviz svg .pnotch{fill:none;stroke:var(--vz-cap);stroke-width:1.2}
.pcbviz svg .pin1{fill:var(--danger)}
.pcbviz table{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0}.pcbviz th,.pcbviz td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--line);vertical-align:top}.pcbviz th{color:var(--mute);font-weight:600;font-size:12.5px}.pcbviz .mu{color:var(--mute);font-size:12.5px}
.pcbvz3 .vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:520px;margin:8px 0}
.pcbvz3{--vz-cu:#c8873a;--vz-mask:#1f8a3f;--vz-fr:#3d7a4c;--vz-pp:#7c8f5a;--vz-silk:#ececec}
.pcbvz3 svg .lay{stroke:#0b0e11;stroke-opacity:.55;stroke-width:.8;stroke-linejoin:round}.pcbvz3 svg .lay.cu{fill:var(--vz-cu)}.pcbvz3 svg .lay.mask{fill:var(--vz-mask)}.pcbvz3 svg .lay.fr{fill:var(--vz-fr)}.pcbvz3 svg .lay.pp{fill:var(--vz-pp)}.pcbvz3 svg .lay.silk{fill:var(--vz-silk)}
.pcbvz3 svg .lay.side{filter:brightness(.78)}.pcbvz3 svg .lay.side2{filter:brightness(.62)}
.pcbvz3 svg .lead2{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 3}
.pcbvz3 .vzctl{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.pcbvz3 .vzctl button{min-height:44px;padding:0 16px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);font-weight:600;color:var(--fg)}
.pcbvz3 .vzctl button[aria-pressed=true]{background:var(--accent-bg);border-color:var(--accent);color:#fff}`;
  const st = document.createElement('style'); st.id = 'pcbviz-css'; st.textContent = CSS; document.head.appendChild(st);

  /* Lernen: neuer Abschnitt vor den Tastenkürzeln */
  (function () {
    const view = $('#helpView'); if (!view) return;
    const run = () => {
      if ($('#pvBauf', view)) return; const ds = view.querySelectorAll('details'); if (!ds.length) return;
      const d = document.createElement('details'); d.id = 'pvBauf'; d.innerHTML = '<summary>Bauformen: Größen maßstäblich</summary><div class="hb2">' + catalogHtml() + '</div>';
      const last = ds[ds.length - 1]; view.insertBefore(d, /Tastenkürzel/.test(last.textContent.slice(0, 40)) ? last : null);
    };
    new MutationObserver(() => { if (!$('#pvBauf', view)) run(); }).observe(view, { childList: true });
    run();
  })();

  /* Lagen > Aufbau: 3D-Skizze unter dem Querschnitt */
  (function () {
    const host = $('#vh-stack'); if (!host) return;
    let exploded = true;
    const draw = c => {
      const U = root.PCB_UI, b = U && U.S && U.S.board; if (!b || !CORE) return;
      let rows = []; try { rows = CORE.stackup(b); } catch (e) {}
      c.querySelector('[data-vz=svg]').innerHTML = stack3dSvg(rows, exploded) || '<p class="hint2" style="padding:12px">Kein Lagenaufbau verfügbar.</p>';
      c.querySelectorAll('[data-vz-x]').forEach(bt => bt.setAttribute('aria-pressed', String((bt.dataset.vzX === '1') === exploded)));
    };
    const run = () => {
      if (document.getElementById('pvStack3d')) return;
      const lbl = [...host.querySelectorAll('.pf-lbl')].find(e => /Lagenzahl/.test(e.textContent)); if (!lbl) return;
      const card = lbl.closest('.pf-card'); if (!card || !card.parentNode) return;
      const c = document.createElement('div'); c.id = 'pvStack3d'; c.className = 'pf-card pcbvz3';
      c.innerHTML = '<h3>3D-Skizze des Lagenaufbaus</h3><div class="vzctl" role="group" aria-label="Darstellung"><button type="button" data-vz-x="0">Zusammengesetzt</button><button type="button" data-vz-x="1">Auseinandergezogen</button></div><div class="vzbox" data-vz="svg"></div><p class="pf-muted">Die Dicken sind nur lesbar gezeichnet, nicht maßstäblich. Die Zahlen sind die echten Schichtdicken.</p>';
      c.addEventListener('click', e => { const bt = e.target.closest('[data-vz-x]'); if (!bt) return; exploded = bt.dataset.vzX === '1'; draw(c); });
      card.parentNode.insertBefore(c, card.nextSibling); draw(c);
    };
    let t = 0; new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 30); }).observe(host, { childList: true, subtree: true });
    run();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
