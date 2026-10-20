(function (root) {
  'use strict';
  const R = root.SEN_RIGS = root.SEN_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  // ---------- gemeinsame Hilfen (in jeder senrig-Datei enthalten, damit jede Datei einzeln ladbar bleibt) ----------
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2, D2R = Math.PI / 180;
  // Signalfarben der Messkette: Waerme, Widerstand, Spannung, digital, Anzeige, Licht, Kraft
  const SIGC = { heat: [255, 140, 60], res: [90, 170, 255], volt: [76, 217, 100], dig: [200, 150, 255], disp: [235, 240, 245], light: [255, 226, 110], force: [255, 120, 120], cur: [255, 179, 64] };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const num = (v, d) => { v = (typeof v === 'string' && v.trim() === '') ? NaN : +v; return isFinite(v) ? v : d; };
  const fmt = (v, d) => { v = +v; if (!isFinite(v)) return '–'; return v.toFixed(d == null ? 1 : d).replace('.', ',').replace('-', '−'); };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // Zahl mit Vorsatz: eng(1234,'Ω') = "1,23 kΩ"
  function eng(v, unit, sig) {
    v = +v; if (!isFinite(v)) return '∞ ' + unit; const a = Math.abs(v); sig = sig || 3;
    if (a < 1e-12) return '0 ' + unit;
    const P = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
    let p = P[P.length - 1];
    for (let i = 0; i < P.length; i++) if (a >= P[i][0] * 0.9995) { p = P[i]; break; }
    const x = v / p[0], dg = clamp(sig - 1 - Math.floor(Math.log10(Math.abs(x) + 1e-12)), 0, 3);
    return x.toFixed(dg).replace('.', ',').replace('-', '−') + ' ' + p[1] + unit;
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(s), x, y);
  }
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = C.panel; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    if (title) txt(ctx, title, x + 14, y + 17, 11.5, C.dim, 'left', true);
  }
  function line(ctx, pts, color, w, dash) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = w || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash && ctx.setLineDash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    if (dash && ctx.setLineDash) ctx.setLineDash([]);
  }
  // laufende Signalpunkte entlang eines Linienzugs
  function polyDots(ctx, pts, t, speed, col, spacing, size) {
    if (!(speed > 0) || pts.length < 2) return;
    let L = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    if (L < 1) return;
    spacing = spacing || 18; const n = Math.max(1, Math.floor(L / spacing)), off = (t / 1000 * speed) % spacing;
    ctx.fillStyle = col;
    for (let k = 0; k < n; k++) {
      let d = (k * spacing + off) % L, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const f = seg[i] > 0 ? d / seg[i] : 0, x = lerp(pts[i][0], pts[i + 1][0], f), y = lerp(pts[i][1], pts[i + 1][1], f);
      ctx.beginPath(); ctx.arc(x, y, size || 3, 0, TWO_PI); ctx.fill();
    }
  }
  // Messkette als Blockbild: blocks [{title,l1,l2,col,bad}], links [{col,act,broken,label}]
  function chainStrip(ctx, t, blocks, links) {
    const x0 = 15, y0 = 44, bw = 150, bh = 76, gap = 55;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i], x = x0 + i * (bw + gap), bad = b.bad && Math.floor(t / 300) % 2 === 0;
      ctx.fillStyle = C.panel; rr(ctx, x, y0, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = bad ? C.bad : C.line; ctx.lineWidth = bad ? 2.6 : 1.5; ctx.stroke();
      ctx.fillStyle = rgba(b.col || SIGC.res, 0.95); rr(ctx, x, y0, 6, bh, 3); ctx.fill();
      txt(ctx, b.title, x + 16, y0 + 14, 11, C.dim, 'left', true);
      txt(ctx, b.l1, x + 16, y0 + 38, 17, b.bad ? C.bad : C.text, 'left', true, MONO);
      txt(ctx, b.l2, x + 16, y0 + 60, 11.5, C.dim, 'left');
    }
    for (let i = 0; i < links.length; i++) {
      const L = links[i], xa = x0 + i * (bw + gap) + bw + 4, xb = xa + gap - 8, ym = y0 + bh / 2, col = L.col || SIGC.res;
      const xe = L.broken ? (xa + xb) / 2 - 5 : xb;
      line(ctx, [[xa, ym], [xe, ym]], 'rgba(139,152,165,0.55)', 2);
      if (!L.broken) { ctx.fillStyle = 'rgba(139,152,165,0.8)'; ctx.beginPath(); ctx.moveTo(xb + 4, ym); ctx.lineTo(xb - 6, ym - 5); ctx.lineTo(xb - 6, ym + 5); ctx.closePath(); ctx.fill(); }
      else { txt(ctx, '✕', (xa + xb) / 2 + 2, ym, 15, C.bad, 'center', true); }
      if (L.act > 0 && !L.broken) polyDots(ctx, [[xa, ym], [xb, ym]], t, 22 + 60 * clamp(L.act, 0, 1), rgba(col, 1), 15, 3.2);
      if (L.label) txt(ctx, L.label, (xa + xb) / 2, ym - 13, 11, rgba(col, 1), 'center', true);
    }
  }
  // Zeigerinstrument (Bogen ca. 216 Grad)
  function needle(ctx, cx, cy, r, vmin, vmax, v, o) {
    o = o || {}; const a0 = Math.PI * 0.9, a1 = Math.PI * 2.1, f = clamp((v - vmin) / ((vmax - vmin) || 1), 0, 1);
    const ang = lerp(a0, a1, f);
    ctx.fillStyle = '#12171b'; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = '#3a444f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(76,217,100,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, a1); ctx.stroke();
    if (o.warnFrom != null) { const fw = clamp((o.warnFrom - vmin) / ((vmax - vmin) || 1), 0, 1); ctx.strokeStyle = 'rgba(255,92,92,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, r - 4, lerp(a0, a1, fw), a1); ctx.stroke(); }
    for (let k = 0; k <= 10; k++) {
      const a = lerp(a0, a1, k / 10), maj = k % 5 === 0, r1 = r - (maj ? 14 : 10), r2 = r - 7;
      ctx.strokeStyle = maj ? '#c4ccd4' : '#6a7480'; ctx.lineWidth = maj ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
      if (maj) txt(ctx, fmt(vmin + (vmax - vmin) * k / 10, o.digits || 0), cx + Math.cos(a) * (r * 0.5), cy + Math.sin(a) * (r * 0.5), 9, C.dim, 'center');
    }
    if (o.label) txt(ctx, o.label, cx, cy + r * 0.62, 10.5, C.dim, 'center', true);
    ctx.strokeStyle = o.col || '#ffb340'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * 8, cy - Math.sin(ang) * 8); ctx.lineTo(cx + Math.cos(ang) * (r - 12), cy + Math.sin(ang) * (r - 12)); ctx.stroke();
    ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TWO_PI); ctx.fill();
  }
  function lcd(ctx, x, y, w, h, text, unit, col, dim) {
    ctx.fillStyle = '#08120c'; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = '#1f3a28'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, '8888888', x + w - 70, y + h / 2, h * 0.62, 'rgba(76,217,100,0.06)', 'right', true, MONO);
    txt(ctx, text, x + w - 70, y + h / 2 + 1, h * 0.62, col || '#8dffa0', 'right', true, MONO);
    txt(ctx, unit, x + w - 10, y + h / 2 + 2, h * 0.3, dim || '#5fbf78', 'right', true);
  }
  function sparks(ctx, x, y, t, k) {
    k = k == null ? 1 : k;
    for (let i = 0; i < 14; i++) {
      const ph = fr(t / 520 + i * 0.137), ang = rnd(i + 3) * TWO_PI, d = ph * 46 * (0.5 + rnd(i + 9)) * k;
      const ax = x + Math.cos(ang) * d * 0.55, ay = y + Math.sin(ang) * d * 0.55 + ph * ph * 16, bx = x + Math.cos(ang) * d, by = y + Math.sin(ang) * d + ph * ph * 22;
      ctx.strokeStyle = 'rgba(255,' + (210 - 90 * ph | 0) + ',' + (110 - 80 * ph | 0) + ',' + (1 - ph) + ')'; ctx.lineWidth = 2.2 - ph;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, 1, x, y, 26 * k);
    g.addColorStop(0, 'rgba(255,240,180,' + (0.55 + 0.35 * Math.sin(t / 40)) + ')'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26 * k, 0, TWO_PI); ctx.fill();
  }
  // Zeichenflaeche: Hintergrund, Weltmass zentriert und skaliert. Liefert Skalierung (0 = nichts zu zeichnen)
  function begin(ctx, w, h) {
    w = num(w, 0); h = num(h, 0);
    ctx.save(); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Math.max(0, w), Math.max(0, h));
    const sc = Math.min(w / WW, h / WH);
    if (!(sc > 0) || !isFinite(sc)) return 0;
    ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
    ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
    return sc;
  }
  function toWorld(px, py, w, h) {
    const sc = Math.min(w / WW, h / WH);
    if (!(sc > 0) || !isFinite(sc)) return null;
    return { x: (px - (w - WW * sc) / 2) / sc, y: (py - (h - WH * sc) / 2) / sc };
  }
  // Steuerelement-Wert zurechtstutzen (Typ, Grenzen, Auswahl)
  function coerce(d, value, alias, old) {
    if (d.type === 'switch' || d.type === 'button') return !!value && value !== 'false' && value !== '0' && value !== 0;
    if (d.type === 'slider') return clamp(num(value, d.value), d.min, d.max);
    if (alias && typeof value === 'string' && alias[value.toLowerCase()] != null) value = alias[value.toLowerCase()];
    const o = d.options.find(x => String(x.value) === String(value)); return o ? o.value : (old !== undefined ? old : d.value);
  }
  function mkEvents() {
    const events = [];
    return { events, ev(S, text, kind, fx, x, y) {
      const e = { t: Math.round(S.t * 1000), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = clamp(x, 0, WW); e.y = clamp(y, 0, WH); } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    } };
  }

  // ===== Pruefstand 1: Temperaturmessung (Messkette Sensor -> Schaltung -> ADU -> Anzeige) =====
  // Physik (eigenes Modell, bei Bedarf gegen SEN_CORE austauschbar):
  //   NTC   R = R25*exp(B*(1/T - 1/T25)), B = 3950 K            PT   R = R0*(1 + A*T + B*T^2), A = 3,9083e-3, B = -5,775e-7
  //   Halbleiter LM35 10 mV/K, TMP36 0,5 V + 10 mV/K             Thermoelement Typ K nach ITS-90 mit Vergleichsstelle 25 Grad C
  //   Spannungsteiler / Wheatstone-Bruecke / Konstantstromquelle (1 V / rRef) mit Verstaerker G
  //   Selbsterwaermung dT = P/delta (Fixpunkt-Iteration), Waermetraegheit der Sonde (Zeitkonstante je Sonde)
  //   ADU N = floor(U/Uref*2^n);  Anzeige: Steinhart-Hart/Kennlinie, Tabelle (20 K) oder 2-Punkt-Gerade
  const T_AMB = 25, T_COLD = 25;
  const R_NTC = { R25: 10000, B: 3950 }, PT_A = 3.9083e-3, PT_B = -5.775e-7, PT_C = -4.183e-12;
  const SENS = {
    ntc: { label: 'NTC 10 kΩ (B 3950)', short: 'NTC 10k', kind: 'R', tau: 5, delta: 3, tmax: 150 },
    pt100: { label: 'Pt100', short: 'Pt100', kind: 'R', R0: 100, tau: 8, delta: 25, tmax: 400 },
    pt1000: { label: 'Pt1000', short: 'Pt1000', kind: 'R', R0: 1000, tau: 6, delta: 25, tmax: 400 },
    lm35: { label: 'LM35 (Halbleiter, 10 mV/K)', short: 'LM35', kind: 'V', tau: 12, delta: 6, tmax: 150 },
    tmp36: { label: 'TMP36 (Halbleiter, 0,5 V + 10 mV/K)', short: 'TMP36', kind: 'V', tau: 12, delta: 6, tmax: 125 },
    tck: { label: 'Thermoelement Typ K', short: 'Typ K', kind: 'TC', tau: 2, delta: 0, tmax: 1200 }
  };
  const ALIAS = { sensor: { thermoelement: 'tck', typk: 'tck', tc: 'tck', typ_k: 'tck', 'pt-100': 'pt100', 'pt-1000': 'pt1000', ntc10k: 'ntc', halbleiter: 'lm35' },
    circuit: { divider: 'teiler', spannungsteiler: 'teiler', bridge: 'bruecke', wheatstone: 'bruecke', konstantstrom: 'strom', currentsource: 'strom' },
    lin: { off: 'aus', table: 'tabelle', steinhart: 'sh', 'steinhart-hart': 'sh' } };
  const CIRC = { teiler: 'Spannungsteiler', bruecke: 'Wheatstone-Brücke', strom: 'Konstantstromquelle' };
  // sinnvolle Auslegung (rRef, Verstaerkung) je Sensor und Schaltung
  const AUTO = { ntc: { teiler: [10000, 1], bruecke: [10000, 1], strom: [10000, 1] }, pt100: { teiler: [100, 1], bruecke: [100, 2], strom: [1000, 10] },
    pt1000: { teiler: [1000, 1], bruecke: [1000, 2], strom: [10000, 10] }, lm35: { teiler: [10000, 1], bruecke: [10000, 1], strom: [10000, 1] },
    tmp36: { teiler: [10000, 1], bruecke: [10000, 1], strom: [10000, 1] }, tck: { teiler: [10000, 250], bruecke: [10000, 250], strom: [10000, 250] } };

  const CONTROLS = [
    { key: 'tMeas', label: 'Temperatur der Messstelle', type: 'slider', min: -40, max: 300, step: 0.5, unit: '°C', value: 25, group: 'Messgröße', help: 'Temperatur des Heizbads. Die Sonde folgt mit ihrer Zeitkonstante (Wärmeträgheit), du kannst sie auch am Thermometer im Bild ziehen.' },
    { key: 'sensor', label: 'Sensor', type: 'select', value: 'ntc', group: 'Sensor', options: Object.keys(SENS).map(k => ({ value: k, label: SENS[k].label })), help: 'NTC, Pt100, Pt1000, Halbleiter-IC oder Thermoelement. Beim Umschalten werden Rref und Verstärkung sinnvoll vorbelegt.' },
    { key: 'circuit', label: 'Schaltung', type: 'select', value: 'teiler', group: 'Aufbereitung', options: [{ value: 'teiler', label: 'Spannungsteiler' }, { value: 'bruecke', label: 'Wheatstone-Brücke' }, { value: 'strom', label: 'Konstantstromquelle + Verstärker' }], help: 'Gilt für NTC und Pt-Sensoren. IC und Thermoelement brauchen nur den Verstärker.' },
    { key: 'rRef', label: 'Referenzwiderstand Rref', type: 'slider', min: 10, max: 100000, step: 10, unit: 'Ω', value: 10000, scale: 'log', group: 'Aufbereitung', help: 'Teiler und Brücke: Festwiderstand. Konstantstromquelle: Strom I = 1 V / Rref. Zu klein heizt den Sensor auf.' },
    { key: 'gain', label: 'Verstärkung G', type: 'slider', min: 1, max: 1000, step: 1, unit: '×', value: 1, scale: 'log', group: 'Aufbereitung', help: 'Instrumentenverstärker vor dem ADU. Zu groß: Der Ausgang läuft an den Anschlag (Sättigung).' },
    { key: 'adcBits', label: 'ADU-Auflösung', type: 'select', value: 10, group: 'Wandler', options: [{ value: 8, label: '8 Bit' }, { value: 10, label: '10 Bit' }, { value: 12, label: '12 Bit' }, { value: 16, label: '16 Bit' }], help: 'Mehr Bit = kleinere Stufen (°C pro Digit).' },
    { key: 'vref', label: 'Referenzspannung', type: 'select', value: 3.3, group: 'Wandler', options: [{ value: 3.3, label: '3,3 V' }, { value: 5, label: '5 V' }], help: 'Versorgung der Schaltung und Messbereich des ADU.' },
    { key: 'lin', label: 'Linearisierung', type: 'select', value: 'sh', group: 'Auswertung', options: [{ value: 'aus', label: 'aus (Gerade 0 bis 100 °C)' }, { value: 'tabelle', label: 'Tabelle (alle 20 K)' }, { value: 'sh', label: 'Rechnung (Steinhart-Hart / Kennlinie)' }], help: 'Wie aus dem ADU-Zählwert die Temperatur berechnet wird. Aus: nur eine Gerade, bei NTC groß falsch.' },
    { key: 'selfHeat', label: 'Selbsterwärmung berücksichtigen', type: 'switch', value: true, group: 'Fehlerquellen', help: 'Der Messstrom heizt den Sensor auf: P = I²·R. Aus: Idealfall ohne Selbsterwärmung.' },
    { key: 'lead', label: 'Leitungswiderstand je Ader', type: 'slider', min: 0, max: 20, step: 0.1, unit: 'Ω', value: 0, group: 'Fehlerquellen', help: 'Widerstand einer Zuleitung. Beim Pt100 ergeben 2 Ω je Ader in 2-Leiter-Technik schon rund 10 K Fehler (beide Adern zählen: 4 Ω / 0,385 Ω/K).' },
    { key: 'wires', label: 'Anschlusstechnik', type: 'select', value: 2, group: 'Fehlerquellen', options: [{ value: 2, label: '2-Leiter' }, { value: 3, label: '3-Leiter' }, { value: 4, label: '4-Leiter' }], help: '2-Leiter: beide Leitungen verfälschen. 3-Leiter: in der Brücke kompensiert. 4-Leiter: Messspannung direkt am Sensor.' },
    { key: 'cjc', label: 'Vergleichsstellen-Kompensation', type: 'switch', value: true, group: 'Thermoelement', help: 'Das Thermoelement misst nur die Differenz zur Vergleichsstelle (25 °C). Ohne Kompensation zeigt es 25 K zu wenig.' },
    { key: 'wireBreak', label: 'Drahtbruch (Taster halten)', type: 'button', value: false, group: 'Fehlerquellen', help: 'Halten = die Zuleitung ist unterbrochen. Beobachte, was der ADU dann anzeigt.' }
  ];
  const METERS = [
    { key: 'tTrue', label: 'Wahre Temperatur (Messstelle)', unit: '°C', digits: 1, min: -40, max: 300 },
    { key: 'tShown', label: 'Angezeigte Temperatur', unit: '°C', digits: 1, min: -40, max: 300 },
    { key: 'error', label: 'Anzeigefehler', unit: 'K', digits: 2, min: -20, max: 20, warnAbove: 2 },
    { key: 'rSensor', label: 'Sensorwiderstand', unit: 'Ω', digits: 1, min: 0, max: 400000 },
    { key: 'uOut', label: 'Ausgangsspannung (ADU-Eingang)', unit: 'V', digits: 3, min: 0, max: 5 },
    { key: 'adc', label: 'ADU-Zählwert', unit: 'Digit', digits: 0, min: 0, max: 65535 },
    { key: 'current', label: 'Sensorstrom', unit: 'mA', digits: 3, min: 0, max: 20 },
    { key: 'resolution', label: 'Auflösung', unit: '°C/Digit', digits: 3, min: 0, max: 5 },
    { key: 'dTself', label: 'Selbsterwärmung', unit: 'K', digits: 2, min: 0, max: 30, warnAbove: 1 }
  ];
  const PRESETS = [
    { id: 'ntc-teiler', name: 'NTC im Spannungsteiler', params: { sensor: 'ntc', circuit: 'teiler', rRef: 10000, gain: 1, adcBits: 10, vref: 3.3, lin: 'sh', selfHeat: true, lead: 0, wires: 2, tMeas: 25 } },
    { id: 'ntc-aus', name: 'NTC ohne Linearisierung (Gerade)', params: { sensor: 'ntc', circuit: 'teiler', rRef: 10000, gain: 1, adcBits: 12, lin: 'aus', lead: 0, tMeas: 60 } },
    { id: 'ntc-selbst', name: 'Selbsterwärmung (Rref zu klein)', params: { sensor: 'ntc', circuit: 'teiler', rRef: 100, vref: 5, adcBits: 12, lin: 'sh', selfHeat: true, tMeas: 100 } },
    { id: 'pt100-2', name: 'Pt100 2-Leiter mit Leitungsfehler', params: { sensor: 'pt100', circuit: 'bruecke', rRef: 100, gain: 5, adcBits: 12, lin: 'sh', lead: 2, wires: 2, tMeas: 60 } },
    { id: 'pt100-3', name: 'Pt100 3-Leiter in der Brücke', params: { sensor: 'pt100', circuit: 'bruecke', rRef: 100, gain: 5, adcBits: 12, lin: 'sh', lead: 2, wires: 3, tMeas: 60 } },
    { id: 'pt100-4', name: 'Pt100 4-Leiter mit Konstantstrom', params: { sensor: 'pt100', circuit: 'strom', rRef: 1000, gain: 10, adcBits: 12, lin: 'sh', lead: 2, wires: 4, tMeas: 60 } },
    { id: 'lm35', name: 'Halbleiter LM35', params: { sensor: 'lm35', gain: 1, adcBits: 12, lin: 'sh', tMeas: 40 } },
    { id: 'tck', name: 'Thermoelement Typ K', params: { sensor: 'tck', gain: 250, adcBits: 12, vref: 3.3, lin: 'sh', cjc: true, tMeas: 150 } }
  ];

  // ---- Sensorkennlinien ----
  function rNtc(T) { return R_NTC.R25 * Math.exp(R_NTC.B * (1 / (T + 273.15) - 1 / (T_AMB + 273.15))); }
  function rPt(T, R0) { return R0 * (1 + PT_A * T + PT_B * T * T + (T < 0 ? PT_C * (T - 100) * T * T * T : 0)); }
  function ptInv(R, R0) {
    const x = R / R0;
    if (!isFinite(x)) return x > 0 ? 600 : -273;
    if (x >= 1) { const dsc = PT_A * PT_A - 4 * PT_B * (1 - x); return (-PT_A + Math.sqrt(Math.max(0, dsc))) / (2 * PT_B); }
    let T = (x - 1) / PT_A;
    for (let i = 0; i < 12; i++) { const f = rPt(T, 1) - x, d = PT_A + 2 * PT_B * T; T -= f / (d || 1); }
    return T;
  }
  // Steinhart-Hart aus drei Punkten der Kennlinie (0, 50, 100 Grad C)
  const SH = (function () {
    const Ts = [0, 50, 100], L = Ts.map(T => Math.log(rNtc(T))), y = Ts.map(T => 1 / (T + 273.15));
    const g2 = (y[1] - y[0]) / (L[1] - L[0]), g3 = (y[2] - y[0]) / (L[2] - L[0]);
    const c = (g3 - g2) / (L[2] - L[1]) / (L[0] + L[1] + L[2]), b = g2 - c * (L[0] * L[0] + L[0] * L[1] + L[1] * L[1]), a = y[0] - (b + c * L[0] * L[0]) * L[0];
    return { a, b, c };
  })();
  function shInv(R) { if (!(R > 0)) return R === 0 ? 600 : -273; if (!isFinite(R)) return -273; const l = Math.log(R); return 1 / (SH.a + SH.b * l + SH.c * l * l * l) - 273.15; }
  // Thermospannung Typ K (ITS-90), mV
  const KP = [-1.7600413686e-2, 3.8921204975e-2, 1.8558770032e-5, -9.9457592874e-8, 3.1840945719e-10, -5.6072844889e-13, 5.6075059059e-16, -3.2020720003e-19, 9.7151147152e-23, -1.2104721275e-26];
  const KN = [0, 3.9450128025e-2, 2.3622373598e-5, -3.2858906784e-7, -4.9904828777e-9, -6.7509059173e-11, -5.7410327428e-13, -3.1088872894e-15, -1.0451609365e-17, -1.9889266878e-20, -1.6322697486e-23];
  function eK(T) {
    T = clamp(T, -200, 1300);
    const p = T < 0 ? KN : KP; let e = 0; for (let i = p.length - 1; i >= 0; i--) e = e * T + p[i];
    if (T >= 0) e += 0.118597600000 * Math.exp(-0.000118343200 * (T - 126.9686) * (T - 126.9686));
    return e;
  }
  function eKinv(mv) { let T = mv / 0.041; for (let i = 0; i < 30; i++) { const f = eK(T) - mv, d = (eK(T + 0.05) - eK(T - 0.05)) / 0.1; if (!(Math.abs(d) > 1e-6)) break; T = clamp(T - f / d, -200, 1300); } return T; }

  // ---- Messkette ----
  // c = { sensor, circuit, rRef, gain, bits, vref, wires, lead, selfHeat, brk, dmg, cjc }
  function chain(c, Tp, o) {
    o = o || {};
    const S = SENS[c.sensor] || SENS.ntc, vcc = c.vref, G = c.gain, lead = o.noLead ? 0 : c.lead, brk = o.noBrk ? false : c.brk;
    const dmg = o.noDmg ? 0 : c.dmg, kS = c.wires === 2 ? 2 : c.wires === 3 ? 1 : 0, kU = c.wires === 3 ? 1 : 0;
    const res = { Ts: Tp, dT: 0, Rs: 0, I: 0, P: 0, uSens: 0, raw: 0, uOut: 0, N: 0, sat: false, brk };
    const useSelf = c.selfHeat && !o.noSelf;
    if (S.kind === 'R') {
      let dT = 0, Rs = 0, I = 0, P = 0, Um = 0, raw = 0;
      for (let it = 0; it < 16; it++) {
        const Ts = Tp + dT;
        Rs = (c.sensor === 'ntc' ? rNtc(Ts) : rPt(Ts, S.R0)) * (1 + 0.06 * dmg);
        if (c.circuit === 'teiler') {
          if (brk) { I = 0; Um = vcc; } else { I = vcc / (c.rRef + Rs + 2 * lead); Um = I * (Rs + kS * lead); }
          raw = G * Um;
        } else if (c.circuit === 'bruecke') {
          const Rlow = Rs + kS * lead, Rup = c.rRef + kU * lead;
          const Ud = brk ? vcc / 2 : vcc * (Rlow / (Rlow + Rup) - 0.5);
          I = brk ? 0 : vcc / (Rlow + Rup); Um = Ud; raw = vcc / 2 + G * Ud;
        } else {
          const I0 = 1 / c.rRef;
          if (brk) { I = 0; Um = vcc; } else { I = I0; Um = Math.min(I0 * (Rs + kS * lead), vcc); }
          raw = G * Um;
        }
        P = I * I * Rs * 1000;
        const dn = useSelf && !brk ? Math.min(P / S.delta, 120) : 0;
        if (Math.abs(dn - dT) < 1e-7) { dT = dn; break; }
        dT += (dn - dT) * 0.6;
        if (!useSelf) break;
      }
      Object.assign(res, { Ts: Tp + dT, dT, Rs, I, P, uSens: Um, raw });
    } else if (S.kind === 'V') {
      const dT = useSelf ? 0.05 : 0, Ts = Tp + dT + 3 * dmg;
      const u = brk ? 0 : (c.sensor === 'lm35' ? Math.max(0, 0.01 * Ts) : 0.5 + 0.01 * Ts);
      Object.assign(res, { Ts: Tp + dT, dT, uSens: u, I: brk ? 0 : 60e-6, P: 0.3, raw: G * u });
    } else {
      const e = brk ? 0 : (eK(Tp) - eK(T_COLD)) / 1000;
      Object.assign(res, { uSens: e, raw: brk ? vcc : 0.1 * vcc + G * e });
    }
    res.uOut = clamp(res.raw, 0, vcc);
    const maxN = Math.pow(2, c.bits) - 1;
    res.N = clamp(Math.floor(res.uOut / vcc * (maxN + 1)), 0, maxN);
    res.maxN = maxN;
    res.sat = res.raw >= vcc - 1e-9 || res.raw <= 1e-9;
    return res;
  }
  const idealCache = { key: '', T: [], U: [] };
  function idealU(c, T) { return chain(Object.assign({}, c, { lead: 0, selfHeat: false, brk: false, dmg: 0 }), T).uOut; }
  function idealTable(c) {
    const key = [c.sensor, c.circuit, c.rRef, c.gain, c.vref, c.cjc].join('|');
    if (idealCache.key !== key) { idealCache.key = key; idealCache.T = []; idealCache.U = []; for (let i = 0; i < 18; i++) { const T = -40 + 20 * i; idealCache.T.push(T); idealCache.U.push(idealU(c, T)); } }
    return idealCache;
  }
  function toTemp(c, N) {
    const S = SENS[c.sensor] || SENS.ntc, vcc = c.vref, n = Math.pow(2, c.bits);
    const Uh = (N + 0.5) / n * vcc;
    let T;
    if (c.lin === 'aus') {
      const u0 = idealU(c, 0), u1 = idealU(c, 100);
      T = Math.abs(u1 - u0) > 1e-9 ? (Uh - u0) / (u1 - u0) * 100 : 0;
    } else if (c.lin === 'tabelle') {
      const tb = idealTable(c);
      let found = false; T = 0;
      for (let i = 0; i < tb.T.length - 1 && !found; i++) {
        const a = tb.U[i], b = tb.U[i + 1];
        if (a !== b && ((Uh >= a && Uh <= b) || (Uh <= a && Uh >= b))) { T = tb.T[i] + (Uh - a) / (b - a) * (tb.T[i + 1] - tb.T[i]); found = true; }
      }
      if (!found) T = Math.abs(Uh - tb.U[0]) < Math.abs(Uh - tb.U[tb.U.length - 1]) ? tb.T[0] : tb.T[tb.T.length - 1];
    } else if (S.kind === 'R') {
      let Rm;
      if (c.circuit === 'teiler') { const Um = Uh / c.gain; Rm = Um >= vcc ? Infinity : c.rRef * Um / (vcc - Um); }
      else if (c.circuit === 'bruecke') { const x = (Uh - vcc / 2) / c.gain / vcc + 0.5; Rm = x >= 1 ? Infinity : x <= 0 ? 0 : c.rRef * x / (1 - x); }
      else Rm = Uh / c.gain * c.rRef;
      T = c.sensor === 'ntc' ? shInv(Rm) : ptInv(Rm, S.R0);
    } else if (S.kind === 'V') {
      const u = Uh / c.gain; T = c.sensor === 'lm35' ? u / 0.01 : (u - 0.5) / 0.01;
    } else {
      const e = (Uh - 0.1 * vcc) / c.gain * 1000 + (c.cjc ? eK(T_COLD) : 0); T = eKinv(e);
    }
    return isFinite(T) ? clamp(T, -100, 700) : 0;
  }
  function evalFull(c, Tp, o) {
    const r = chain(c, Tp, o); r.shown = toTemp(c, r.N); return r;
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const EV = mkEvents(), events = EV.events;
    let S;
    const ev = (text, kind, fx, x, y) => EV.ev(S, text, kind, fx, x, y);
    const PROBE = [290, 452], LEADP = [455, 156], ADCP = [610, 320];

    function cfg() {
      return { sensor: Cv.sensor, circuit: Cv.circuit, rRef: Cv.rRef, gain: Cv.gain, bits: Cv.adcBits, vref: Cv.vref, wires: Cv.wires, lead: Cv.lead, selfHeat: Cv.selfHeat, brk: Cv.wireBreak, dmg: S ? S.dmg : 0, cjc: Cv.cjc, lin: Cv.lin };
    }
    function resetState() {
      S = { t: 0, Tp: Cv.tMeas, r: null, dmg: 0, hotT: 0, hist: [], histAcc: 0, shown: 25, leadErr: 0, errStatic: 0, res: 0,
        fl: { sat: false, brk: false, selfW: false, selfE: false, hot: false, lead: false, cjc: false }, satT: 0, btn: false };
      events.length = 0;
      refresh();
    }
    function refresh() {
      const c = cfg(), r = evalFull(c, S.Tp);
      S.r = r; S.shown = r.shown;
      S.leadErr = 0;
      if (c.lead > 0 && c.wires !== 4 && SENS[c.sensor].kind === 'R' && !c.brk) S.leadErr = r.shown - evalFull(c, S.Tp, { noLead: true }).shown;
      const r2 = chain(c, S.Tp + 0.5), dU = Math.abs(r2.raw - chain(c, S.Tp - 0.5).raw);
      S.res = (dU > 1e-9 && !r.sat) ? Math.min(999, (c.vref / Math.pow(2, c.bits)) / dU) : 999;
    }
    function flags() {
      const f = [], r = S.r, c = cfg();
      if (r.dT >= 1) f.push('selfheat');
      if (c.brk) f.push('wirebreak');
      if (r.sat) f.push('saturation');
      if (S.dmg) f.push('overheat');
      if (S.hotT > 0 && !S.dmg) f.push('hot');
      if (Math.abs(S.leadErr) >= 1) f.push('leadwire');
      if (c.sensor === 'tck' && !c.cjc) f.push('nocjc');
      return f;
    }

    function sub(dt) {
      S.t += dt;
      const sn = SENS[Cv.sensor];
      S.Tp += (Cv.tMeas - S.Tp) * (1 - Math.exp(-dt / sn.tau));
      refresh();
      const r = S.r, c = cfg(), fl = S.fl;
      // Drahtbruch
      if (c.brk && !fl.brk) {
        fl.brk = true;
        const eff = sn.kind === 'TC' ? 'Der Verstärker sieht einen offenen Eingang: Er wird nach oben gezogen (Fühlerbruch-Erkennung) und der ADU läuft an den Anschlag.'
          : sn.kind === 'V' ? 'Der Ausgang hängt in der Luft und wird nach 0 V gezogen: Die Anzeige springt auf einen falschen, aber normal wirkenden Wert!'
          : c.circuit === 'strom' ? 'Die Stromquelle läuft in die Spannungsgrenze, der ADU zeigt Vollausschlag.' : 'Ohne Strom durch den Sensor springt die Spannung auf den oberen Anschlag, der ADU zeigt Vollausschlag.';
        ev('Drahtbruch! Die Zuleitung zum Sensor ist unterbrochen. ' + eff, 'error', 'shoot', LEADP[0], LEADP[1]);
      } else if (!c.brk && fl.brk) { fl.brk = false; ev('Die Leitung ist wieder verbunden, die Messung läuft normal weiter.', 'info'); }
      // Saettigung
      if (r.sat && !fl.sat) {
        fl.sat = true;
        ev('ADU übersteuert: Die Spannung am Eingang liegt ' + (r.raw >= c.vref - 1e-9 ? 'über der Referenzspannung (' + fmt(c.vref, 1) + ' V)' : 'bei 0 V') + ', der Zählwert bleibt am Anschlag. Verkleinere die Verstärkung oder wähle einen anderen Rref.', 'warn', 'stall', ADCP[0], ADCP[1]);
      } else if (fl.sat && !r.sat && r.N > 2 && r.N < r.maxN - 2) fl.sat = false;
      // Selbsterwaermung
      if (r.dT >= 20 && !fl.selfE) {
        fl.selfE = true; fl.selfW = true;
        ev('Selbsterwärmung außer Kontrolle: Der Messstrom (' + fmt(r.I * 1000, 1) + ' mA) heizt den Sensor um ' + fmt(r.dT, 0) + ' K auf. Der Sensor glüht und misst nur noch seine eigene Wärme. Vergrößere Rref!', 'error', 'overheat', PROBE[0], PROBE[1]);
      } else if (r.dT >= 1 && !fl.selfW) {
        fl.selfW = true;
        ev('Selbsterwärmung: Der Sensor verbraucht ' + fmt(r.P, 1) + ' mW und wird dadurch um ' + fmt(r.dT, 1) + ' K wärmer als die Messstelle. Verkleinere den Messstrom (größeres Rref).', 'warn', 'overheat', PROBE[0], PROBE[1]);
      } else if (r.dT < 0.5) { fl.selfW = false; fl.selfE = false; }
      // zu heiss im Dauerbetrieb
      const tsn = r.Ts;
      if (tsn > sn.tmax) S.hotT += dt; else S.hotT = Math.max(0, S.hotT - dt * 0.5);
      if (S.hotT > 10 && !S.dmg) {
        S.dmg = 1;
        ev('Der Sensor war zu lange über ' + sn.tmax + ' °C. Im Dauerbetrieb ist das nicht zulässig: Die Kennlinie hat sich dauerhaft verschoben (Drift). Wechsle den Sensor oder setze Reset.', 'error', 'overheat', PROBE[0], PROBE[1]);
      }
      // Leitungswiderstand
      if (Math.abs(S.leadErr) >= 1 && !fl.lead) {
        fl.lead = true;
        ev((c.wires === 2 ? '2-Leiter' : '3-Leiter') + ': Der Leitungswiderstand verfälscht die Messung um ' + fmt(S.leadErr, 1) + ' K. Nimm eine 4-Leiter-Schaltung oder bei der Brücke 3-Leiter.', 'warn');
      } else if (Math.abs(S.leadErr) < 0.5) fl.lead = false;
      if (c.sensor === 'tck' && !c.cjc && !fl.cjc) { fl.cjc = true; ev('Ohne Vergleichsstellen-Kompensation fehlt die Temperatur der Klemmstelle: Die Anzeige liegt etwa 25 K zu niedrig.', 'warn'); }
      else if ((c.sensor !== 'tck' || c.cjc) && fl.cjc) fl.cjc = false;
      // Verlauf
      S.histAcc += dt;
      if (S.histAcc >= 0.1) { S.histAcc = 0; S.hist.push([S.t, Cv.tMeas, S.shown, S.Tp]); if (S.hist.length > 600) S.hist.shift(); }
    }
    function stepCore(dtMs) { let rem = dtMs; while (rem > 1e-9) { const d = Math.min(rem, 20); rem -= d; sub(d / 1000); } }

    function auto(sensor, circuit) { const a = (AUTO[sensor] || AUTO.ntc)[circuit] || [10000, 1]; Cv.rRef = a[0]; Cv.gain = a[1]; }
    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      const old = Cv[key], v = coerce(d, value, ALIAS[key], old);
      Cv[key] = v;
      if ((key === 'sensor' || key === 'circuit') && old !== v) { auto(Cv.sensor, Cv.circuit); S.dmg = 0; S.hotT = 0; }
      if (key === 'wireBreak') S.btn = v;
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      ['sensor', 'circuit'].forEach(k => { if (p.params[k] != null) setControl(k, p.params[k]); });
      Object.keys(p.params).forEach(k => { if (k !== 'sensor' && k !== 'circuit') setControl(k, p.params[k]); });
      return true;
    }

    function readMeters() {
      const r = S.r;
      return { tTrue: Cv.tMeas, tShown: S.shown, error: S.shown - Cv.tMeas, rSensor: r.Rs, uOut: r.uOut, adc: r.N, current: r.I * 1000, resolution: S.res, dTself: r.dT };
    }
    function state() {
      const r = S.r, c = cfg(), faults = flags();
      const st = evalFull(c, Cv.tMeas);
      return {
        tTrue: Cv.tMeas, tMeas: Cv.tMeas, tProbe: S.Tp, tSensor: r.Ts, tShown: S.shown, error: S.shown - Cv.tMeas, errorStatic: st.shown - Cv.tMeas,
        rSensor: r.Rs, uSens: r.uSens, uOut: r.uOut, uOutRaw: r.raw, adc: r.N, adcMax: r.maxN, current: r.I, power: r.P, dTself: r.dT,
        resolution: S.res, saturated: r.sat, wireBreak: !!c.brk, leadError: S.leadErr, damaged: !!S.dmg, hotTime: S.hotT,
        sensor: Cv.sensor, circuit: Cv.circuit, tau: SENS[Cv.sensor].tau, faults, fault: faults.length > 0, t: S.t * 1000
      };
    }

    // ---- Kennlinien ----
    function curves() {
      const c = cfg(), sn = SENS[c.sensor], real = [], idl = [], rs = [], err = [], self = [], top = [];
      for (let T = -40; T <= 300; T += 5) {
        const a = evalFull(c, T), b = chain(Object.assign({}, c, { lead: 0, selfHeat: false, brk: false, dmg: 0 }), T);
        real.push([T, a.uOut]); idl.push([T, b.uOut]); err.push([T, a.shown - T]); self.push([T, a.dT]); top.push([T, c.vref]);
        rs.push([T, sn.kind === 'R' ? (c.sensor === 'ntc' ? rNtc(T) : rPt(T, sn.R0)) : sn.kind === 'V' ? (c.sensor === 'lm35' ? Math.max(0, 0.01 * T) : 0.5 + 0.01 * T) : (eK(T) - eK(T_COLD))]);
      }
      const st = evalFull(c, Cv.tMeas), r = S.r;
      const k1 = sn.kind === 'R' ? { yLabel: 'Widerstand', yUnit: 'Ω' } : sn.kind === 'V' ? { yLabel: 'Ausgangsspannung', yUnit: 'V' } : { yLabel: 'Thermospannung', yUnit: 'mV' };
      const my = sn.kind === 'R' ? r.Rs : sn.kind === 'V' ? r.uSens : (eK(S.Tp) - eK(T_COLD));
      return [
        { id: 'sensor', title: 'Sensorkennlinie ' + sn.short, xLabel: 'Temperatur', xUnit: '°C', yLabel: k1.yLabel, yUnit: k1.yUnit, yLog: c.sensor === 'ntc', series: [{ name: sn.short, points: rs }], marker: { x: sn.kind === 'R' ? r.Ts : S.Tp, y: my } },
        { id: 'uout', title: 'Ausgangsspannung der Messschaltung', xLabel: 'Temperatur', xUnit: '°C', yLabel: 'Spannung am ADU', yUnit: 'V', series: [{ name: 'ideal', points: idl }, { name: 'real (Leitung, Selbsterwärmung)', points: real }, { name: 'ADU-Anschlag', points: top }], marker: { x: Cv.tMeas, y: st.uOut } },
        { id: 'fehler', title: 'Anzeigefehler über der Temperatur', xLabel: 'Temperatur', xUnit: '°C', yLabel: 'Fehler', yUnit: 'K', series: [{ name: 'Anzeigefehler', points: err }, { name: 'Selbsterwärmung', points: self }], marker: { x: Cv.tMeas, y: st.shown - Cv.tMeas } }
      ];
    }

    // ================= Zeichnen =================
    function heatCol(T) { const f = clamp((T + 40) / 340, 0, 1); return f < 0.3 ? mix([80, 170, 255], [120, 220, 160], f / 0.3) : f < 0.55 ? mix([120, 220, 160], [255, 200, 70], (f - 0.3) / 0.25) : mix([255, 200, 70], [255, 70, 50], (f - 0.55) / 0.45); }
    function drawBath(ctx, t) {
      const T = Cv.tMeas, x0 = 190, x1 = 390, yT = 330, yB = 486, yF = 372;
      panel(ctx, 14, 134, 506, 412, 'MESSSTELLE  Heizbad');
      // Heizplatte
      const hot = clamp((T - 40) / 250, 0, 1);
      ctx.fillStyle = '#2d343b'; rr(ctx, 160, 506, 260, 34, 8); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'HEIZPLATTE', 290, 530, 11, '#8b98a5', 'center', true);
      ctx.fillStyle = '#3b444c'; rr(ctx, 168, 488, 244, 20, 6); ctx.fill(); ctx.stroke();
      if (hot > 0.02) {
        const g = ctx.createLinearGradient(168, 0, 412, 0); g.addColorStop(0, rgba([255, 80, 30], 0.15 + hot * 0.7)); g.addColorStop(0.5, rgba([255, 150, 50], 0.25 + hot * 0.7)); g.addColorStop(1, rgba([255, 80, 30], 0.15 + hot * 0.7));
        ctx.fillStyle = g; rr(ctx, 168, 488, 244, 20, 6); ctx.fill();
        ctx.strokeStyle = rgba([255, 220, 150], 0.4 + 0.4 * hot); ctx.lineWidth = 2; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(180 + k * 38, 492); ctx.lineTo(196 + k * 38, 504); ctx.stroke(); }
      }
      if (T < 3) { ctx.fillStyle = 'rgba(160,215,255,0.35)'; rr(ctx, 168, 488, 244, 20, 6); ctx.fill(); }
      // Becherglas
      const fc = T < 0 ? [170, 220, 255] : T > 100 ? mix([110, 170, 230], [255, 150, 70], clamp((T - 100) / 200, 0, 1)) : mix([110, 175, 235], [140, 150, 215], clamp(T / 100, 0, 1));
      ctx.fillStyle = rgba(fc, 0.55); ctx.beginPath(); ctx.moveTo(x0 + 3, yF); ctx.lineTo(x0 + 3, yB - 10); ctx.arcTo(x0 + 3, yB, x0 + 13, yB, 10); ctx.lineTo(x1 - 13, yB); ctx.arcTo(x1 - 3, yB, x1 - 3, yB - 10, 10); ctx.lineTo(x1 - 3, yF); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(fc, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 3, yF); ctx.lineTo(x1 - 3, yF); ctx.stroke();
      // Blasen und Eis
      if (T > 70) for (let k = 0; k < 9; k++) { const ph = fr(t / (1500 - 700 * clamp((T - 70) / 100, 0, 1)) + k / 9); ctx.strokeStyle = 'rgba(235,245,255,' + (0.7 * (1 - ph)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0 + 20 + rnd(k) * 160, yB - 8 - ph * (yB - yF - 14), 2 + rnd(k + 5) * 4, 0, TWO_PI); ctx.stroke(); }
      if (T < 4) { ctx.fillStyle = 'rgba(235,248,255,0.8)'; for (let k = 0; k < 4; k++) { const ix = x0 + 25 + k * 42 + Math.sin(t / 900 + k) * 3, iy = yF + 6 + (k % 2) * 8 + Math.sin(t / 700 + k * 2) * 2; rr(ctx, ix, iy, 26, 22, 4); ctx.fill(); } }
      ctx.strokeStyle = 'rgba(210,225,240,0.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, yT); ctx.lineTo(x0, yB - 10); ctx.arcTo(x0, yB, x0 + 10, yB, 10); ctx.lineTo(x1 - 10, yB); ctx.arcTo(x1, yB, x1, yB - 10, 10); ctx.lineTo(x1, yT); ctx.stroke();
      if (T < 8) { ctx.strokeStyle = 'rgba(235,248,255,0.7)'; ctx.lineWidth = 2; for (let k = 0; k < 14; k++) { const fx = x0 + k * 14.5, fy = yB - rnd(k) * 60 - 10; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 4, fy - 6 - rnd(k + 3) * 6); ctx.stroke(); } }
      // Dampf
      if (T > 60) {
        const k0 = clamp((T - 60) / 120, 0, 1);
        for (let k = 0; k < 10; k++) {
          const ph = fr(t / 2600 + k / 10), x = x0 + 30 + rnd(k + 2) * 140 + Math.sin(ph * 6 + k) * 14, y = yF - 4 - ph * 150;
          ctx.fillStyle = 'rgba(225,232,240,' + (1 - ph) * 0.35 * k0 + ')'; ctx.beginPath(); ctx.arc(x, y, 8 + ph * 26, 0, TWO_PI); ctx.fill();
        }
      }
      txt(ctx, fmt(T, 1) + ' °C', x0 + 14, yB - 22, 20, '#ffffff', 'left', true, MONO);
    }
    function drawProbe(ctx, t) {
      const [px, py] = PROBE, r = S.r, sn = SENS[Cv.sensor], hd = 232;
      // Schaft
      const g = ctx.createLinearGradient(px - 6, 0, px + 6, 0); g.addColorStop(0, '#6c7782'); g.addColorStop(0.5, '#dfe6ec'); g.addColorStop(1, '#5a646e');
      ctx.fillStyle = g; rr(ctx, px - 6, hd, 12, py - hd, 5); ctx.fill(); ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI); ctx.fillStyle = '#c8d0d8'; ctx.fill();
      // Kopf
      ctx.fillStyle = '#394149'; rr(ctx, px - 24, 198, 48, 38, 6); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4a5560'; rr(ctx, px - 18, 192, 36, 10, 3); ctx.fill();
      txt(ctx, sn.short, px, 217, 11, '#cfd8e0', 'center', true);
      // Selbsterwaermung / zu heiss: Gluehen
      const heat = clamp(r.dT / 12, 0, 1), over = S.dmg || r.Ts > sn.tmax;
      if (heat > 0.03 || over) {
        const rad = 16 + heat * 30 + (over ? 8 : 0), gg = ctx.createRadialGradient(px, py, 2, px, py, rad);
        gg.addColorStop(0, 'rgba(255,230,160,' + (0.35 + 0.5 * heat) + ')'); gg.addColorStop(0.5, 'rgba(255,110,40,' + (0.2 + 0.4 * heat) + ')'); gg.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, rad, 0, TWO_PI); ctx.fill();
        if (r.dT >= 20) for (let k = 0; k < 5; k++) { const ph = fr(t / 800 + k / 5); ctx.fillStyle = 'rgba(120,120,126,' + (0.5 * (1 - ph)) + ')'; ctx.beginPath(); ctx.arc(px + Math.sin(ph * 7 + k) * 10, py - 10 - ph * 70, 5 + ph * 12, 0, TWO_PI); ctx.fill(); }
      }
      // Lupe
      const lx = 96, ly = 408, lr = 66;
      line(ctx, [[px - 6, py - 2], [lx + lr * 0.95, ly + 6]], 'rgba(139,152,165,0.6)', 1.5, [4, 4]);
      ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TWO_PI); ctx.clip();
      ctx.fillStyle = rgba(mix([30, 42, 58], heatCol(Cv.tMeas), 0.22), 1); ctx.fillRect(lx - lr, ly - lr, 2 * lr, 2 * lr);
      this_drawElement(ctx, lx, ly - 4, t, r, sn);
      ctx.restore();
      ctx.strokeStyle = (heat > 0.3 && Math.floor(t / 300) % 2 === 0) ? C.bad : '#8b98a5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TWO_PI); ctx.stroke();
      txt(ctx, 'Sensorelement vergrößert', lx, ly - lr - 12, 11, C.dim, 'center', true);
      const l1 = sn.kind === 'R' ? 'Rs = ' + eng(r.Rs, 'Ω') : sn.kind === 'V' ? 'U = ' + fmt(r.uSens, 3) + ' V' : 'E = ' + fmt(r.uSens * 1000, 2) + ' mV';
      txt(ctx, l1, lx, ly + lr + 14, 14, C.text, 'center', true, MONO);
      txt(ctx, 'Sensor ' + fmt(r.Ts, 1) + ' °C' + (r.dT >= 0.3 ? '  (+' + fmt(r.dT, 1) + ' K)' : ''), lx, ly + lr + 32, 12, r.dT >= 1 ? C.warn : C.dim, 'center', r.dT >= 1);
      if (S.dmg) txt(ctx, 'DRIFT: Sensor überhitzt!', lx, ly + lr + 50, 12, Math.floor(t / 400) % 2 ? C.bad : C.warn, 'center', true);
    }
    // Sensorelement (wird in der Lupe gezeichnet)
    function this_drawElement(ctx, x, y, t, r, sn) {
      const heat = clamp(r.dT / 10, 0, 1), id = Cv.sensor;
      ctx.lineCap = 'round';
      if (id === 'ntc') {
        line(ctx, [[x - 12, y - 70], [x - 9, y - 4]], '#c9d1d9', 3); line(ctx, [[x + 12, y - 70], [x + 9, y - 4]], '#c9d1d9', 3);
        const g = ctx.createRadialGradient(x - 8, y + 10, 3, x, y + 16, 28); g.addColorStop(0, rgba(mix([200, 90, 60], [255, 200, 120], heat), 1)); g.addColorStop(1, rgba(mix([90, 36, 30], [255, 90, 40], heat), 1));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 14, 20, 24, 0, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#2a1410'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - 7, y + 5, 5, 8, -0.4, 0, TWO_PI); ctx.fill();
      } else if (id === 'pt100' || id === 'pt1000') {
        line(ctx, [[x - 14, y - 70], [x - 14, y - 14]], '#c9d1d9', 3); line(ctx, [[x + 14, y - 70], [x + 14, y - 14]], '#c9d1d9', 3);
        ctx.fillStyle = rgba(mix([226, 210, 180], [255, 150, 80], heat), 1); rr(ctx, x - 30, y - 16, 60, 56, 4); ctx.fill(); ctx.strokeStyle = '#6b5b3c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#7d8793'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 14, y - 12);
        for (let k = 0; k < 7; k++) { ctx.lineTo(x - 22 + (k % 2) * 44 + (k % 2 ? 0 : 0), y - 4 + k * 6); ctx.lineTo(x - 22 + ((k + 1) % 2) * 44, y - 4 + k * 6); } ctx.stroke();
        txt(ctx, id === 'pt100' ? 'Pt 100' : 'Pt 1000', x, y + 46, 10, C.dim, 'center');
      } else if (id === 'lm35' || id === 'tmp36') {
        [-14, 0, 14].forEach(d => line(ctx, [[x + d, y - 70], [x + d, y + 6]], '#c9d1d9', 3));
        ctx.fillStyle = rgba(mix([42, 46, 52], [255, 110, 50], heat), 1); ctx.beginPath(); ctx.moveTo(x - 26, y + 4); ctx.lineTo(x - 26, y + 22); ctx.arc(x, y + 22, 26, Math.PI, 0, true); ctx.lineTo(x + 26, y + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0c0f12'; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, id === 'lm35' ? 'LM35' : 'TMP36', x, y - 8, 10, '#aeb8c2', 'center', true);
        ctx.fillStyle = rgba(mix([42, 46, 52], [255, 110, 50], heat), 1); ctx.beginPath(); ctx.moveTo(x - 26, y + 4); ctx.lineTo(x + 26, y + 4); ctx.lineTo(x + 26, y + 40); ctx.lineTo(x - 26, y + 40); ctx.closePath(); ctx.fill(); ctx.stroke();
        txt(ctx, id === 'lm35' ? 'LM35' : 'TMP36', x, y + 22, 11, '#cfd8e0', 'center', true);
      } else {
        line(ctx, [[x - 10, y - 70], [x - 4, y - 20], [x - 2, y + 4]], '#b7c25a', 3.5); line(ctx, [[x + 10, y - 70], [x + 4, y - 20], [x + 2, y + 4]], '#d9dde2', 3.5);
        const g = ctx.createRadialGradient(x, y + 10, 1, x, y + 10, 16 + heat * 12); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, rgba(mix([210, 215, 220], [255, 140, 60], heat), 1)); g.addColorStop(1, 'rgba(120,120,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 10, 16 + heat * 12, 0, TWO_PI); ctx.fill();
        txt(ctx, 'Lötperle (Messstelle)', x, y + 42, 10, C.dim, 'center');
      }
    }
    function drawLeads(ctx, t) {
      const sn = SENS[Cv.sensor], r = S.r, px = PROBE[0], brk = Cv.wireBreak;
      const n = sn.kind === 'R' ? Cv.wires : sn.kind === 'V' ? 3 : 2;
      const cols = sn.kind === 'TC' ? ['#7bd880', '#e8ecef'] : sn.kind === 'V' ? ['#ff6b6b', '#ffd36b', '#8b98a5'] : ['#ff6b6b', '#e8ecef', '#4a4f55', '#ffd36b'];
      const act = r.I > 0 || sn.kind !== 'R' ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const hx = px - 15 + i * (30 / Math.max(1, n - 1 || 1)), ly = 158 + i * 12, pts = [[hx, 198], [hx, ly], [506, ly]];
        const cut = brk && i === 0;
        if (cut) {
          line(ctx, [[hx, 198], [hx, ly], [448, ly]], cols[i], 3); line(ctx, [[466, ly], [506, ly]], cols[i], 3);
          line(ctx, [[448, ly], [457, ly - 7]], cols[i], 3); line(ctx, [[466, ly], [458, ly + 7]], cols[i], 3);
          sparks(ctx, 457, ly, t, 0.8); txt(ctx, 'Drahtbruch!', 457, ly + 30, 13, Math.floor(t / 250) % 2 ? C.bad : C.warn, 'center', true);
        } else {
          line(ctx, pts, cols[i], 3);
        }
        if (act && !cut) polyDots(ctx, pts, t, 30, 'rgba(255,255,255,0.9)', 22, 2.2);
        if (sn.kind === 'R' && Cv.lead > 0 && !cut) {
          ctx.fillStyle = '#10151a'; rr(ctx, 372, ly - 4.5, 36, 9, 2); ctx.fill(); ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 1.2; ctx.stroke();
          if (i === 0) txt(ctx, 'Rl = ' + fmt(Cv.lead, 1) + ' Ω', 390, ly + 13, 10, C.warn, 'center', true);
        }
      }
      txt(ctx, 'zur Messschaltung →', 506, 146, 11, C.dim, 'right');
      const errTxt = sn.kind === 'R' && Cv.lead > 0 ? ((Cv.wires === 4 ? '4-Leiter: kein Leitungsfehler' : Cv.wires === 3 ? '3-Leiter' : '2-Leiter') + (Cv.wires === 4 ? '' : ': Fehler ' + (S.leadErr >= 0 ? '+' : '') + fmt(S.leadErr, 1) + ' K')) : '';
      if (errTxt && !brk) txt(ctx, errTxt, 506, 214, 12, Math.abs(S.leadErr) >= 1 ? C.warn : C.dim, 'right', Math.abs(S.leadErr) >= 1);
      if (sn.kind === 'TC') {
        ctx.fillStyle = '#10151a'; rr(ctx, 400, 150, 106, 30, 5); ctx.fill(); ctx.strokeStyle = Cv.cjc ? C.ok : C.bad; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, 'Vergleichsstelle', 453, 160, 10, C.dim, 'center', true); txt(ctx, Cv.cjc ? '25 °C kompensiert' : 'unkompensiert!', 453, 173, 10.5, Cv.cjc ? C.ok : (Math.floor(t / 300) % 2 ? C.bad : C.warn), 'center', true);
      }
      // Drahtbruch-Taster
      const on = !!Cv.wireBreak;
      ctx.fillStyle = on ? 'rgba(255,92,92,0.4)' : '#2a323b'; rr(ctx, 28, 214, 136, 44, 11); ctx.fill(); ctx.strokeStyle = on ? C.bad : '#556270'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, '✂ Drahtbruch', 96, 236, 15, on ? '#fff' : C.text, 'center', true);
      txt(ctx, 'halten = Leitung getrennt', 96, 270, 10.5, C.dim, 'center');
    }
    function drawThermo(ctx, t) {
      const x = 440, y0 = 190, y1 = 490, w = 14;
      ctx.fillStyle = '#10151a'; rr(ctx, x - 2, y0 - 4, w + 4, y1 - y0 + 8, 8); ctx.fill(); ctx.strokeStyle = '#4a545e'; ctx.lineWidth = 1.5; ctx.stroke();
      const yOf = T => y1 - clamp((T + 40) / 340, 0, 1) * (y1 - y0);
      const g = ctx.createLinearGradient(0, y1, 0, y0); g.addColorStop(0, '#4aa3ff'); g.addColorStop(0.3, '#6fe0a0'); g.addColorStop(0.55, '#ffc84a'); g.addColorStop(1, '#ff4a3a');
      ctx.fillStyle = g; rr(ctx, x, yOf(Cv.tMeas), w, y1 - yOf(Cv.tMeas), 5); ctx.fill();
      for (let T = -40; T <= 300; T += 20) { const yy = yOf(T), maj = T % 100 === 0 || T === -40; ctx.strokeStyle = maj ? '#c4ccd4' : '#6a7480'; ctx.lineWidth = maj ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(x + w + 3, yy); ctx.lineTo(x + w + (maj ? 12 : 8), yy); ctx.stroke(); if (maj && T !== -40) txt(ctx, T, x + w + 15, yy, 10, C.dim, 'left'); }
      txt(ctx, '−40', x + w + 15, y1, 10, C.dim, 'left');
      // Sondentemperatur (traege)
      const yp = yOf(S.Tp);
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(x - 4, yp); ctx.lineTo(x - 15, yp - 7); ctx.lineTo(x - 15, yp + 7); ctx.closePath(); ctx.fill();
      txt(ctx, 'Sonde ' + fmt(S.Tp, 1), x - 19, yp, 10.5, C.acc, 'right', true);
      const ym = yOf(Cv.tMeas); ctx.fillStyle = C.warn; ctx.beginPath(); ctx.moveTo(x + w + 3, ym); ctx.lineTo(x + w + 14, ym - 6); ctx.lineTo(x + w + 14, ym + 6); ctx.closePath(); ctx.fill();
      txt(ctx, 'Thermometer ziehen', 508, y1 + 18, 10.5, C.dim, 'right');
    }

    function drawRes(ctx, x, y, w, h) {
      ctx.fillStyle = '#10151a'; rr(ctx, x, y, w, h, 2); ctx.fill(); ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    function drawSchem(ctx, t) {
      const ox = 548, oy = 250, r = S.r, sn = SENS[Cv.sensor], c = cfg();
      panel(ctx, ox - 12, oy, 450, 174, 'MESSSCHALTUNG  ' + (sn.kind === 'R' ? CIRC[Cv.circuit] : sn.kind === 'V' ? 'Halbleiter-IC' : 'Thermoelement'));
      if (Cv.wireBreak) txt(ctx, '✕ Leitung unterbrochen', ox + 428, oy + 17, 12, Math.floor(t / 300) % 2 ? C.bad : C.warn, 'right', true);
      const wire = '#8b98a5', vcc = Cv.vref, flow = r.I > 0 ? 36 : 0;
      const sensorSym = (x, y0, y1, hot) => {
        ctx.fillStyle = hot ? 'rgba(255,120,50,0.35)' : '#10151a'; rr(ctx, x - 8, y0, 16, y1 - y0, 3); ctx.fill(); ctx.strokeStyle = hot ? C.warn : '#5aaaff'; ctx.lineWidth = 2; ctx.stroke();
        line(ctx, [[x - 16, y1 - 4], [x + 16, y0 + 4]], hot ? C.warn : '#5aaaff', 1.8); txt(ctx, 'ϑ', x + 22, (y0 + y1) / 2, 14, '#5aaaff', 'left', true);
      };
      const gnd = (x, y) => { line(ctx, [[x, y], [x, y + 6]], wire, 2); line(ctx, [[x - 9, y + 6], [x + 9, y + 6]], wire, 2); line(ctx, [[x - 6, y + 10], [x + 6, y + 10]], wire, 2); line(ctx, [[x - 3, y + 14], [x + 3, y + 14]], wire, 2); };
      let nodeX = 0, nodeY = 0, sigTxt = '';
      if (sn.kind === 'R' && Cv.circuit === 'teiler') {
        line(ctx, [[ox + 40, oy + 32], [ox + 110, oy + 32]], wire, 2); txt(ctx, '+' + fmt(vcc, 1) + ' V', ox + 6, oy + 32, 12, C.ok, 'left', true);
        line(ctx, [[ox + 75, oy + 32], [ox + 75, oy + 42]], wire, 2); drawRes(ctx, ox + 67, oy + 42, 16, 38); line(ctx, [[ox + 75, oy + 80], [ox + 75, oy + 104]], wire, 2);
        txt(ctx, 'Rref', ox + 92, oy + 55, 11, C.dim, 'left', true); txt(ctx, eng(Cv.rRef, 'Ω'), ox + 92, oy + 69, 11, C.text, 'left', true, MONO);
        line(ctx, [[ox + 75, oy + 104], [ox + 75, oy + 114]], wire, 2); sensorSym(ox + 75, oy + 114, oy + 148, r.dT >= 1); gnd(ox + 75, oy + 148);
        if (Cv.lead > 0) txt(ctx, (Cv.wires === 2 ? '2·' : Cv.wires === 3 ? '1·' : '0·') + 'Rl', ox + 28, oy + 128, 10.5, C.warn, 'center', true);
        txt(ctx, eng(r.Rs, 'Ω'), ox + 110, oy + 132, 11, '#5aaaff', 'left', true, MONO);
        nodeX = ox + 75; nodeY = oy + 104; sigTxt = 'U = ' + fmt(r.uSens, 3) + ' V';
        line(ctx, [[nodeX, nodeY], [ox + 190, nodeY]], wire, 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(nodeX, nodeY, 3.5, 0, TWO_PI); ctx.fill();
        polyDots(ctx, [[ox + 75, oy + 32], [ox + 75, oy + 104]], t, flow, 'rgba(255,226,110,0.95)', 16, 2.4);
        polyDots(ctx, [[ox + 75, oy + 114], [ox + 75, oy + 148]], t, flow, 'rgba(255,226,110,0.95)', 16, 2.4);
      } else if (sn.kind === 'R' && Cv.circuit === 'bruecke') {
        const cx = ox + 85, top = [cx, oy + 30], lf = [cx - 48, oy + 88], rt = [cx + 48, oy + 88], bt = [cx, oy + 146];
        line(ctx, [top, lf, bt, rt, top], wire, 2);
        const mark = (a, b, lab, sub, hot, dx, dy) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; ctx.fillStyle = hot ? 'rgba(255,120,50,0.45)' : '#10151a'; ctx.beginPath(); ctx.arc(mx, my, 10, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = hot ? C.warn : '#c9d1d9'; ctx.lineWidth = 1.8; ctx.stroke(); txt(ctx, lab, mx + dx, my + dy, 10.5, hot ? C.warn : C.dim, dx < 0 ? 'right' : 'left', true); txt(ctx, sub, mx + dx, my + dy + 12, 10, C.text, dx < 0 ? 'right' : 'left', false, MONO); };
        mark(top, lf, 'R1', eng(Cv.rRef, 'Ω', 3), false, -16, -4); mark(top, rt, 'R2', eng(Cv.rRef, 'Ω', 3), false, 16, -4); mark(rt, bt, 'R3', eng(Cv.rRef, 'Ω', 3), false, 16, 4); mark(lf, bt, 'Rϑ', eng(r.Rs, 'Ω'), r.dT >= 1, -16, 4);
        [top, bt, lf, rt].forEach(p => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, TWO_PI); ctx.fill(); });
        txt(ctx, '+' + fmt(vcc, 1) + ' V', top[0] + 12, top[1] + 4, 11, C.ok, 'left', true); gnd(bt[0], bt[1]);
        txt(ctx, 'Ud', cx, oy + 88, 12, '#4cd964', 'center', true);
        line(ctx, [rt, [ox + 190, rt[1]]], wire, 2); line(ctx, [lf, [lf[0] - 18, lf[1]], [lf[0] - 18, oy + 164], [ox + 190, oy + 164], [ox + 190, rt[1] + 20]], wire, 2);
        nodeX = rt[0]; nodeY = rt[1]; sigTxt = 'Ud = ' + fmt((r.raw - vcc / 2) / Cv.gain * 1000, 1) + ' mV';
        polyDots(ctx, [top, lf, bt], t, flow, 'rgba(255,226,110,0.95)', 18, 2.4); polyDots(ctx, [top, rt, bt], t, flow, 'rgba(255,226,110,0.95)', 18, 2.4);
      } else if (sn.kind === 'R') {
        ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2; ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(ox + 75, oy + 56, 20, 0, TWO_PI); ctx.fill(); ctx.stroke();
        line(ctx, [[ox + 75, oy + 70], [ox + 75, oy + 42]], '#ffb340', 2.4); ctx.fillStyle = '#ffb340'; ctx.beginPath(); ctx.moveTo(ox + 75, oy + 38); ctx.lineTo(ox + 70, oy + 46); ctx.lineTo(ox + 80, oy + 46); ctx.closePath(); ctx.fill();
        line(ctx, [[ox + 75, oy + 76], [ox + 75, oy + 114]], wire, 2); sensorSym(ox + 75, oy + 114, oy + 148, r.dT >= 1); gnd(ox + 75, oy + 148);
        txt(ctx, 'I = ' + eng(Cv.brk ? 0 : 1 / Cv.rRef, 'A'), ox + 102, oy + 52, 12, C.warn, 'left', true, MONO); txt(ctx, '1 V / Rref', ox + 102, oy + 68, 10.5, C.dim, 'left');
        txt(ctx, eng(r.Rs, 'Ω'), ox + 110, oy + 132, 11, '#5aaaff', 'left', true, MONO);
        nodeX = ox + 75; nodeY = oy + 104; sigTxt = 'U = ' + fmt(r.uSens, 3) + ' V';
        line(ctx, [[nodeX, nodeY], [ox + 190, nodeY]], wire, 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(nodeX, nodeY, 3.5, 0, TWO_PI); ctx.fill();
        polyDots(ctx, [[ox + 75, oy + 76], [ox + 75, oy + 148]], t, flow, 'rgba(255,226,110,0.95)', 16, 2.4);
      } else if (sn.kind === 'V') {
        ctx.fillStyle = '#10151a'; rr(ctx, ox + 40, oy + 50, 80, 70, 8); ctx.fill(); ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, sn.short, ox + 80, oy + 78, 16, C.text, 'center', true); txt(ctx, 'Temperatursensor', ox + 80, oy + 98, 9.5, C.dim, 'center');
        line(ctx, [[ox + 20, oy + 62], [ox + 40, oy + 62]], wire, 2); txt(ctx, '+' + fmt(vcc, 1), ox + 14, oy + 50, 10.5, C.ok, 'left', true);
        line(ctx, [[ox + 20, oy + 108], [ox + 40, oy + 108]], wire, 2); gnd(ox + 20, oy + 108);
        line(ctx, [[ox + 120, oy + 85], [ox + 190, oy + 85]], wire, 2); nodeX = ox + 120; nodeY = oy + 85; sigTxt = 'U = ' + fmt(r.uSens, 3) + ' V';
        txt(ctx, Cv.sensor === 'lm35' ? '10 mV/K' : '0,5 V + 10 mV/K', ox + 80, oy + 138, 11, C.dim, 'center');
      } else {
        const e = (r.uSens * 1000);
        line(ctx, [[ox + 20, oy + 70], [ox + 58, oy + 70], [ox + 58, oy + 100], [ox + 150, oy + 100]], '#7bd880', 3); line(ctx, [[ox + 20, oy + 96], [ox + 40, oy + 96]], '#e8ecef', 3);
        line(ctx, [[ox + 40, oy + 96], [ox + 40, oy + 124], [ox + 150, oy + 124]], '#e8ecef', 3);
        ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(ox + 20, oy + 83, 6, 0, TWO_PI); ctx.fill(); txt(ctx, 'Messstelle', ox + 20, oy + 56, 10.5, C.dim, 'center', true);
        ctx.fillStyle = Cv.cjc ? 'rgba(76,217,100,0.2)' : 'rgba(255,92,92,0.2)'; rr(ctx, ox + 150, oy + 84, 36, 54, 6); ctx.fill(); ctx.strokeStyle = Cv.cjc ? C.ok : C.bad; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, '25°C', ox + 168, oy + 111, 11, C.text, 'center', true); txt(ctx, 'Vergleichs-', ox + 168, oy + 148, 9.5, C.dim, 'center'); txt(ctx, 'stelle', ox + 168, oy + 159, 9.5, C.dim, 'center');
        nodeX = ox + 186; nodeY = oy + 100; sigTxt = 'E = ' + fmt(e, 2) + ' mV'; line(ctx, [[ox + 186, oy + 100], [ox + 200, oy + 100]], wire, 2);
        polyDots(ctx, [[ox + 58, oy + 100], [ox + 150, oy + 100]], t, 30, 'rgba(255,226,110,0.95)', 20, 2.4);
      }
      // Verstaerker
      const ax = ox + 200, ay = nodeY || oy + 100;
      const satc = r.sat && Math.floor(t / 250) % 2 === 0;
      ctx.fillStyle = satc ? 'rgba(255,92,92,0.35)' : 'rgba(76,217,100,0.15)'; ctx.beginPath(); ctx.moveTo(ax, ay - 26); ctx.lineTo(ax + 56, ay); ctx.lineTo(ax, ay + 26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = satc ? C.bad : C.ok; ctx.lineWidth = 2.2; ctx.stroke();
      txt(ctx, '×' + Cv.gain, ax + 18, ay, 13, C.text, 'center', true, MONO); txt(ctx, 'Verstärker', ax + 28, ay - 36, 10.5, C.dim, 'center', true);
      line(ctx, [[ax + 56, ay], [ax + 98, ay]], wire, 2); polyDots(ctx, [[ax + 56, ay], [ax + 98, ay]], t, 40, 'rgba(76,217,100,1)', 14, 2.6);
      txt(ctx, fmt(r.uOut, 3) + ' V', ax + 76, ay + 16, 12, satc ? C.bad : '#4cd964', 'center', true, MONO);
      // ADU
      const bx = ax + 98, bw = 80;
      ctx.fillStyle = 'rgba(200,150,255,0.14)'; rr(ctx, bx, ay - 32, bw, 64, 8); ctx.fill(); ctx.strokeStyle = '#c796ff'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'ADU', bx + bw / 2, ay - 18, 12, '#c796ff', 'center', true); txt(ctx, Cv.adcBits + ' Bit', bx + bw / 2, ay - 4, 11, C.dim, 'center');
      txt(ctx, String(r.N), bx + bw / 2, ay + 16, 16, '#e6d3ff', 'center', true, MONO);
      txt(ctx, sigTxt, ox + 214, oy + 168, 11, C.dim, 'left');
      const f = r.N / Math.max(1, r.maxN);
      ctx.fillStyle = '#10151a'; rr(ctx, bx, ay + 40, bw, 9, 4); ctx.fill(); ctx.fillStyle = r.sat ? C.bad : '#c796ff'; rr(ctx, bx + 1, ay + 41, Math.max(2, (bw - 2) * f), 7, 3); ctx.fill();
    }
    function drawTrace(ctx, t) {
      const x0 = 536, y0 = 436, w = 450, h = 110;
      panel(ctx, x0, y0, w, h, 'VERLAUF  letzte 30 s');
      const px = x0 + 44, pw = w - 60, py = y0 + 28, ph = h - 40, hh = S.hist, T0 = S.t - 30;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 5); ctx.fill();
      let lo = Math.min(Cv.tMeas, S.shown, S.Tp), hi = Math.max(Cv.tMeas, S.shown, S.Tp);
      for (let i = 0; i < hh.length; i++) if (hh[i][0] >= T0) { lo = Math.min(lo, hh[i][1], hh[i][2]); hi = Math.max(hi, hh[i][1], hh[i][2]); }
      const span = Math.max(20, hi - lo), mid = (hi + lo) / 2; lo = mid - span * 0.6; hi = mid + span * 0.6;
      const X = tt => px + pw * (tt - T0) / 30, Y = v => py + ph - (v - lo) / (hi - lo) * ph;
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1; for (let k = 0; k <= 3; k++) { const gy = py + ph * k / 3; ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); ctx.stroke(); txt(ctx, fmt(hi - (hi - lo) * k / 3, 0), px - 5, gy, 9.5, C.dim, 'right'); }
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      const tr = (idx, col, wd, dash) => { ctx.strokeStyle = col; ctx.lineWidth = wd; if (dash && ctx.setLineDash) ctx.setLineDash(dash); ctx.beginPath(); let first = true; for (let i = 0; i < hh.length; i++) { if (hh[i][0] < T0 - 0.2) continue; const x = X(hh[i][0]), y = Y(hh[i][idx]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } ctx.stroke(); if (dash && ctx.setLineDash) ctx.setLineDash([]); };
      tr(1, 'rgba(255,179,64,0.95)', 2, [6, 4]); tr(3, 'rgba(59,158,255,0.9)', 1.6); tr(2, 'rgba(76,217,100,1)', 2.4);
      ctx.restore();
      txt(ctx, 'wahr', x0 + w - 150, y0 + 17, 11, C.warn, 'left', true); txt(ctx, 'Sonde', x0 + w - 108, y0 + 17, 11, C.acc, 'left', true); txt(ctx, 'Anzeige', x0 + w - 62, y0 + 17, 11, C.ok, 'left', true);
    }
    function drawPanelA(ctx, t) {
      const x0 = 536, y0 = 134, w = 450, h = 104, r = S.r;
      panel(ctx, x0, y0, w, h, null);
      needle(ctx, x0 + 62, y0 + 54, 44, -40, 300, S.shown, { warnFrom: 250, digits: 0, label: '°C', col: '#ffb340' });
      const err = S.shown - Cv.tMeas, bad = Math.abs(err) > 2;
      lcd(ctx, x0 + 126, y0 + 14, 310, 52, fmt(S.shown, 1), '°C', r.sat ? (Math.floor(t / 250) % 2 ? '#ff7a7a' : '#8dffa0') : '#8dffa0');
      txt(ctx, 'wahr ' + fmt(Cv.tMeas, 1) + ' °C', x0 + 130, y0 + 84, 13, C.warn, 'left', true, MONO);
      txt(ctx, 'Fehler ' + (err >= 0 ? '+' : '') + fmt(err, 2) + ' K', x0 + w - 14, y0 + 84, 13, bad ? C.bad : C.ok, 'right', true, MONO);
      txt(ctx, fmt(S.res, 3) + ' °C/Digit', x0 + 130, y0 + 98, 10.5, C.dim, 'left');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      if (!begin(ctx, w, h)) { ctx.restore(); return; }
      const r = S.r, sn = SENS[Cv.sensor], c = cfg();
      txt(ctx, 'Temperatur-Messkette', 20, 24, 18, C.text, 'left', true);
      txt(ctx, sn.label + ' · ' + (sn.kind === 'R' ? CIRC[Cv.circuit] : 'Verstärker') + ' · ' + Cv.adcBits + ' Bit', 980, 24, 12, C.dim, 'right');
      const tu = sn.kind === 'R' ? [eng(r.Rs, 'Ω'), 'res'] : sn.kind === 'V' ? [fmt(r.uSens, 3) + ' V', 'volt'] : [fmt(r.uSens * 1000, 2) + ' mV', 'volt'];
      const err = S.shown - Cv.tMeas;
      chainStrip(ctx, t, [
        { title: 'MESSGRÖSSE', l1: fmt(Cv.tMeas, 1) + ' °C', l2: 'Messstelle (Heizbad)', col: SIGC.heat },
        { title: 'SENSOR', l1: tu[0], l2: sn.short + ' · ' + fmt(r.Ts, 1) + ' °C', col: tu[1] === 'res' ? SIGC.res : SIGC.volt, bad: !!S.dmg || r.dT >= 5 },
        { title: 'AUFBEREITUNG', l1: fmt(r.uOut, 3) + ' V', l2: (sn.kind === 'R' ? { teiler: 'Teiler', bruecke: 'Brücke', strom: 'Stromquelle' }[Cv.circuit] : 'Direkt') + ' · G=' + Cv.gain, col: SIGC.volt, bad: r.sat },
        { title: 'WANDLER', l1: 'N = ' + r.N, l2: 'ADU ' + Cv.adcBits + ' Bit · ' + fmt(Cv.vref, 1) + ' V', col: SIGC.dig, bad: r.sat },
        { title: 'ANZEIGE', l1: fmt(S.shown, 1) + ' °C', l2: 'Fehler ' + (err >= 0 ? '+' : '') + fmt(err, 1) + ' K', col: SIGC.disp, bad: Math.abs(err) > 5 }
      ], [
        { col: SIGC.heat, act: 1, label: 'T' }, { col: SIGC.res, act: r.I > 0 || sn.kind !== 'R' ? 0.7 : 0, broken: !!Cv.wireBreak, label: sn.kind === 'R' ? 'R' : 'U' },
        { col: SIGC.volt, act: 0.8, label: 'U' }, { col: SIGC.dig, act: 1, label: 'N' }
      ]);
      drawBath(ctx, t); drawThermo(ctx, t); drawLeads(ctx, t); drawProbe(ctx, t);
      drawPanelA(ctx, t); drawSchem(ctx, t); drawTrace(ctx, t);
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p) return null;
      if (p.x > 22 && p.x < 170 && p.y > 208 && p.y < 264) return { key: 'wireBreak', kind: 'button' };
      if (p.x > 418 && p.x < 470 && p.y > 176 && p.y < 500) return { key: 'tMeas', kind: 'drag', min: -40, max: 300 };
      return null;
    }
    function dragTo(key, px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p || key !== 'tMeas') return null;
      const v = Math.round((-40 + clamp((490 - p.y) / 300, 0, 1) * 340) * 2) / 2; setControl('tMeas', v); return v;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'temperatur', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, dragTo, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { ['sensor', 'circuit'].forEach(k => { if (opts.controls[k] != null) setControl(k, opts.controls[k]); }); Object.keys(opts.controls).forEach(k => { if (k !== 'sensor' && k !== 'circuit') setControl(k, opts.controls[k]); }); S.Tp = Cv.tMeas; S.hist.length = 0; refresh(); }
    return rig;
  }

  R.register({
    id: 'temperatur', name: 'Temperatur', icon: '🌡️',
    info: 'Messkette für Temperatur: Heizbad, Sensor (NTC, Pt100, Pt1000, LM35, Thermoelement), Spannungsteiler, Brücke oder Konstantstrom, Verstärker, ADU und Anzeige. Entdecke Selbsterwärmung, Leitungswiderstand bei 2-Leiter und Drahtbruch.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
