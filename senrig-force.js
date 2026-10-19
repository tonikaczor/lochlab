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

  // ===== Pruefstand 3: Druck, Kraft, Dehnung (DMS-Messbruecke, Messverstaerker, ADU) =====
  // Physik (eigenes Modell, bei Bedarf gegen SEN_CORE austauschbar):
  //   DMS  dR/R = k*eps, k = 2,0, R0 = 350 Ohm;  Nenndehnung 1000 um/m bei Nennlast (Vollbruecke 2 mV/V)
  //   Viertel Ud/Ue = k*eps/(4 + 2*k*eps) (leicht nichtlinear), Halb Ud/Ue = k*eps/2, Voll Ud/Ue = k*eps
  //   Messverstaerker Uout = G*Ud + 0,05*Uref (Referenzanhebung), ADU N = floor(U/Uref*2^n), Uref = 3,3 V
  //   Fehler: Bruecken-Unsymmetrie 0,02 mV/V, Temperaturdrift (Viertel 6 um/m je K, Halb 0,6, Voll 0,3; Spanne -0,012 %/K),
  //           Selbsterwaermung des DMS durch Speisung (P = Ue^2/(4*R0), 6 mW/K), Hysterese 1 % (Play-Operator), Kriechen 0,4 % (tau 40 s),
  //           Netzbrummen 50 Hz am Eingang, Tiefpass, Ueberlast: bleibende Verformung ab Streckgrenze, Bruch ab Bruchlast
  const K_GF = 2.0, R0 = 350, EPS_NOM = 1000e-6, UD0 = 0.02e-3, VREF = 3.3, HYS_W = 0.004, CREEP = 0.004, CREEP_TAU = 40, DELTA_G = 6;
  const MODES = { kraft: { unit: 'N', nom: 100, max: 200, yld: 1.5, brk: 1.8, label: 'Biegebalken', key: 'force' }, druck: { unit: 'bar', nom: 10, max: 16, yld: 1.2, brk: 1.5, label: 'Druckmessdose', key: 'pressure' } };
  const BR = { viertel: { sens: 0.5e-3, th: 6e-6, label: 'Viertelbrücke' }, halb: { sens: 1e-3, th: 0.6e-6, label: 'Halbbrücke' }, voll: { sens: 2e-3, th: 0.3e-6, label: 'Vollbrücke' } };
  const ALIAS = { bridge: { 'viertelbruecke': 'viertel', quarter: 'viertel', half: 'halb', halbbruecke: 'halb', full: 'voll', vollbruecke: 'voll' }, mode: { force: 'kraft', pressure: 'druck', biegebalken: 'kraft', druckmessdose: 'druck' } };

  const CONTROLS = [
    { key: 'mode', label: 'Aufnehmer', type: 'select', value: 'kraft', group: 'Messgröße', options: [{ value: 'kraft', label: 'Biegebalken (Kraft in N)' }, { value: 'druck', label: 'Druckmessdose (Druck in bar)' }], help: 'Biegebalken misst Kraft bis 100 N Nennlast, die Druckmessdose Druck bis 10 bar. Beide haben DMS auf einem Federkörper.' },
    { key: 'force', label: 'Kraft', type: 'slider', min: 0, max: 200, step: 0.5, unit: 'N', value: 0, group: 'Messgröße', help: 'Kraft am Balkenende, Nennlast 100 N. Ab 150 N bleibt der Balken verformt, ab 180 N bricht er. Du kannst den Kraftpfeil im Bild ziehen.' },
    { key: 'pressure', label: 'Druck', type: 'slider', min: 0, max: 16, step: 0.1, unit: 'bar', value: 0, group: 'Messgröße', help: 'Druck auf die Membran der Druckmessdose, Nenndruck 10 bar. Ab 12 bar bleibt die Membran verformt, ab 15 bar platzt sie.' },
    { key: 'bridge', label: 'Brückenschaltung', type: 'select', value: 'voll', group: 'DMS-Brücke', options: [{ value: 'viertel', label: 'Viertelbrücke (1 DMS)' }, { value: 'halb', label: 'Halbbrücke (2 DMS)' }, { value: 'voll', label: 'Vollbrücke (4 DMS)' }], help: 'Viertel: 0,5 mV/V, Halb: 1 mV/V, Voll: 2 mV/V bei Nennlast. Je mehr aktive DMS, desto mehr Signal und desto weniger Temperaturdrift.' },
    { key: 'uBridge', label: 'Speisespannung der Brücke', type: 'select', value: 5, group: 'DMS-Brücke', options: [{ value: 2.5, label: '2,5 V' }, { value: 5, label: '5 V' }, { value: 10, label: '10 V' }], help: 'Mehr Speisespannung gibt mehr Signal, heizt aber den DMS auf (Drift).' },
    { key: 'gain', label: 'Verstärkung G (Instrumentenverstärker)', type: 'slider', min: 1, max: 1000, step: 1, unit: '×', value: 100, scale: 'log', group: 'Messverstärker', help: 'Verstärkt die kleine Brückenspannung auf den Bereich des ADU (0 bis 3,3 V). Zu viel: Übersteuerung.' },
    { key: 'offset', label: 'Nullabgleich (Offset)', type: 'slider', min: -5, max: 5, step: 0.005, unit: 'mV', value: 0, group: 'Messverstärker', help: 'Gleicht die Brücken-Unsymmetrie am Verstärkereingang aus. Stelle ihn so ein, dass bei Last 0 die Anzeige 0 zeigt.' },
    { key: 'filter', label: 'Tiefpass-Grenzfrequenz', type: 'select', value: 20, group: 'Messverstärker', options: [{ value: 0, label: 'aus' }, { value: 1, label: '1 Hz' }, { value: 5, label: '5 Hz' }, { value: 20, label: '20 Hz' }, { value: 100, label: '100 Hz' }], help: 'Unterdrückt Brummen und Rauschen, macht die Anzeige aber träger.' },
    { key: 'adcBits', label: 'ADU-Auflösung', type: 'select', value: 12, group: 'Wandler', options: [{ value: 8, label: '8 Bit' }, { value: 10, label: '10 Bit' }, { value: 12, label: '12 Bit' }, { value: 16, label: '16 Bit' }], help: 'Referenzspannung 3,3 V.' },
    { key: 'temp', label: 'Temperatur am DMS', type: 'slider', min: -20, max: 80, step: 1, unit: '°C', value: 25, group: 'Fehlerquellen', help: 'Umgebungstemperatur. Abweichung von 25 °C verschiebt den Nullpunkt (Temperaturdrift), besonders bei der Viertelbrücke.' },
    { key: 'cal', label: 'Kalibrierung verwenden', type: 'switch', value: true, group: 'Kalibrierung', help: 'Ein: Die gespeicherte Kalibrierung (Nullpunkt und Endwert) rechnet die Anzeige. Aus: Werkseinstellung.' },
    { key: 'calZero', label: 'Nullpunkt abgleichen (Taster)', type: 'button', value: false, group: 'Kalibrierung', help: 'Speichert den aktuellen Messwert als Nullpunkt. Mache das bei Last 0.' },
    { key: 'calSpan', label: 'Endwert abgleichen (Taster)', type: 'button', value: false, group: 'Kalibrierung', help: 'Lege eine bekannte Last auf (mindestens 20 % der Nennlast) und drücke den Taster: Die Anzeige wird auf diese Last skaliert.' },
    { key: 'repair', label: 'Federkörper tauschen (Taster)', type: 'button', value: false, group: 'Kalibrierung', help: 'Ersetzt einen gebrochenen oder bleibend verformten Federkörper durch einen neuen.' }
  ];
  const METERS = [
    { key: 'strain', label: 'Dehnung', unit: 'µm/m', digits: 0, min: 0, max: 2000 },
    { key: 'dR', label: 'Widerstandsänderung des DMS', unit: 'Ω', digits: 3, min: 0, max: 1.5 },
    { key: 'uBridge', label: 'Brückenspannung', unit: 'mV', digits: 3, min: -2, max: 25 },
    { key: 'uOut', label: 'Ausgangsspannung (ADU-Eingang)', unit: 'V', digits: 3, min: 0, max: 3.3 },
    { key: 'adc', label: 'ADU-Zählwert', unit: 'Digit', digits: 0, min: 0, max: 65535 },
    { key: 'value', label: 'Anzeige', unit: 'N', digits: 2, min: 0, max: 200 },
    { key: 'error', label: 'Anzeigefehler', unit: '% v. E.', digits: 2, min: -20, max: 20, warnAbove: 2 },
    { key: 'hysteresis', label: 'Hysterese', unit: '% v. E.', digits: 2, min: -1, max: 1 }
  ];
  const PRESETS = [
    { id: 'standard', name: 'Biegebalken, Vollbrücke (Grundeinstellung)', params: { mode: 'kraft', bridge: 'voll', uBridge: 5, gain: 100, offset: 0, filter: 20, adcBits: 12, temp: 25, force: 0 } },
    { id: 'viertel-drift', name: 'Viertelbrücke bei 60 °C (Drift)', params: { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, adcBits: 12, temp: 60, force: 0 } },
    { id: 'selbst', name: 'Zu hohe Speisespannung (DMS wird warm)', params: { mode: 'kraft', bridge: 'viertel', uBridge: 10, gain: 100, adcBits: 12, temp: 25, force: 50 } },
    { id: 'saett', name: 'Verstärkung zu groß (Übersteuerung)', params: { mode: 'kraft', bridge: 'voll', uBridge: 10, gain: 500, adcBits: 12, force: 60 } },
    { id: 'brumm', name: 'Brummen ohne Filter', params: { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 800, adcBits: 16, filter: 0, force: 30 } },
    { id: 'ueberlast', name: 'Überlast (Balken bricht)', params: { mode: 'kraft', bridge: 'voll', force: 190 } },
    { id: 'druck', name: 'Druckmessdose bei 5 bar', params: { mode: 'druck', bridge: 'voll', uBridge: 5, gain: 100, adcBits: 12, pressure: 5 } },
    { id: 'kalib', name: 'Viertelbrücke zum Kalibrieren', params: { mode: 'kraft', bridge: 'viertel', uBridge: 5, gain: 200, adcBits: 12, temp: 25, force: 100 } }
  ];

  function bridgeUd(type, Ue, eps) {
    const x = K_GF * eps;
    return type === 'viertel' ? Ue * x / (4 + 2 * x) : type === 'halb' ? Ue * x / 2 : Ue * x;
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const EV = mkEvents(), events = EV.events;
    const meters = METERS.map(m => Object.assign({}, m));
    let S;
    const ev = (text, kind, fx, x, y) => EV.ev(S, text, kind, fx, x, y);
    const BEAMP = [150, 340], MEMP = [250, 330], ADCP = [830, 350];
    const M = () => MODES[Cv.mode];
    const trueVal = () => Cv[M().key];

    function resetState() {
      S = { t: 0, y: 0, c: 0, p: 0, broken: false, Tg: Cv.temp, Uin: 0, Uf: 0, uClean: 0, hist: [], histAcc: 0, calU: 0.05 * VREF, calS: 1, calN: 0, btn: { z: false, s: false, r: false },
        fl: { sat: false, yld: false, brk: false, drift: false, heat: false, zero: false }, N: 0, uOut: 0, raw: 0, value: 0, eps: 0, epsTh: 0, dR: 0, hum: 0, lastX: 0 };
      events.length = 0;
      applyMode();
      settle();
    }
    function applyMode() { const m = M(); const mv = meters.find(x => x.key === 'value'); mv.unit = m.unit; mv.max = m.max; mv.digits = Cv.mode === 'kraft' ? 2 : 3; }
    const spanF = () => 1 - 1.2e-4 * (S.Tg - 25);
    function epsThermal() { return BR[Cv.bridge].th * (S.Tg - 25); }
    function xEff() { return S.broken ? 0 : S.y + S.c + S.p; }
    // statische Eingangsspannung (V) am Verstaerker fuer Lastanteil xe und Glastemperatur Tg
    function udOf(xe, Tg, bridge) {
      const eps = EPS_NOM * xe * (1 - 1.2e-4 * (Tg - 25)) + BR[bridge].th * (Tg - 25);
      return bridgeUd(bridge, Cv.uBridge, eps) + UD0 * Cv.uBridge + Cv.offset * 1e-3;
    }
    const uOutOf = (ud, G) => clamp(G * ud + 0.05 * VREF, 0, VREF);
    const dUfs = () => Cv.gain * Cv.uBridge * BR[Cv.bridge].sens;
    function valueFrom(Uh) {
      const m = M(), uz = Cv.cal ? S.calU : 0.05 * VREF, sc = Cv.cal ? S.calS : 1;
      return (Uh - uz) / dUfs() * m.nom * sc;
    }
    function tgTarget() { return Cv.temp + Cv.uBridge * Cv.uBridge / (4 * R0) * 1000 / DELTA_G; }

    function settle() {
      const ud = udOf(xEff(), S.Tg, Cv.bridge);
      S.Uin = ud; S.Uf = ud; S.uClean = ud; compute();
    }
    function compute() {
      S.raw = Cv.gain * S.Uf + 0.05 * VREF; S.uOut = clamp(S.raw, 0, VREF);
      const n = Math.pow(2, Cv.adcBits); S.N = clamp(Math.floor(S.uOut / VREF * n), 0, n - 1);
      S.sat = S.raw >= VREF - 1e-9 || S.raw <= 1e-9; S.maxN = n - 1;
      S.value = valueFrom((S.N + 0.5) / n * VREF);
      S.epsTh = epsThermal(); S.eps = S.broken ? 0 : EPS_NOM * (S.y + S.c + S.p) * spanF();
      S.dR = R0 * K_GF * (S.eps + S.epsTh);
    }

    function sub(dt) {
      S.t += dt;
      const m = M(), tv = trueVal(), x = tv / m.nom;
      // Federkoerper: Hysterese (Play), Kriechen, bleibende Verformung, Bruch
      if (!S.broken) {
        S.y = clamp(S.y, x - HYS_W, x + HYS_W);
        S.c += (CREEP * x - S.c) * (1 - Math.exp(-dt / CREEP_TAU));
        if (x > m.yld) S.p = Math.max(S.p, 0.2 * (x - m.yld));
        if (x >= m.brk) { S.broken = true; S.brkAt = S.t; }
      }
      S.Tg += (tgTarget() - S.Tg) * (1 - Math.exp(-dt / 10));
      const ud = udOf(xEff(), S.Tg, Cv.bridge), t = S.t;
      S.uClean = ud;
      const hum = 15e-6 * Math.sin(TWO_PI * 50 * t) + 5e-6 * (Math.sin(TWO_PI * 173 * t + 0.7) + Math.sin(TWO_PI * 811 * t + 1.9));
      S.Uin = ud + hum;
      const fc = Cv.filter, a = fc > 0 ? 1 - Math.exp(-TWO_PI * fc * dt) : 1;
      S.Uf += (S.Uin - S.Uf) * a;
      compute();
      faults(m, x);
      S.histAcc += dt;
      if (S.histAcc >= 0.1) { S.histAcc = 0; S.hist.push([S.t, tv, S.value]); if (S.hist.length > 400) S.hist.shift(); }
    }
    function faults(m, x) {
      const fl = S.fl;
      if (x >= m.brk && !fl.brk) {
        fl.brk = true;
        ev((Cv.mode === 'kraft' ? 'Überlast! Der Biegebalken ist bei ' + fmt(trueVal(), 0) + ' N gebrochen.' : 'Überdruck! Die Membran der Druckmessdose ist bei ' + fmt(trueVal(), 1) + ' bar geplatzt.') + ' Der Aufnehmer ist zerstört. Tausche den Federkörper und bleibe unter der Nennlast.', 'error', 'shoot', Cv.mode === 'kraft' ? BEAMP[0] : MEMP[0], Cv.mode === 'kraft' ? BEAMP[1] : MEMP[1]);
      } else if (x >= m.yld && x < m.brk && !fl.yld) {
        fl.yld = true;
        ev('Überlast: ' + fmt(x * 100, 0) + ' % der Nennlast. Der Federkörper wird bleibend verformt, der Nullpunkt wandert dauerhaft. Reduziere die Last sofort.', 'warn', 'shoot', Cv.mode === 'kraft' ? BEAMP[0] : MEMP[0], Cv.mode === 'kraft' ? BEAMP[1] : MEMP[1]);
      } else if (x < m.yld * 0.95 && fl.yld) fl.yld = false;
      if (S.sat && !fl.sat) { fl.sat = true; ev('Messverstärker übersteuert: Die Ausgangsspannung ' + (S.raw >= VREF ? 'liegt über der Referenzspannung (3,3 V)' : 'ist an 0 V gestoßen') + ', der ADU zeigt Anschlag. Verkleinere die Verstärkung oder die Speisespannung.', 'warn', 'stall', ADCP[0], ADCP[1]); }
      else if (!S.sat && fl.sat && S.N > 2 && S.N < S.maxN - 2) fl.sat = false;
      const heat = tgTarget() - Cv.temp;
      if (heat > 8 && !fl.heat) { fl.heat = true; ev('Der DMS erwärmt sich durch den Brückenstrom um ' + fmt(heat, 0) + ' K (' + fmt(Cv.uBridge, 1) + ' V Speisung). Das erzeugt Nullpunktdrift. Nimm eine kleinere Speisespannung.', 'warn', 'overheat', 200, 330); }
      else if (heat < 4 && fl.heat) fl.heat = false;
      const drift = Math.abs(S.epsTh / EPS_NOM) * 100;
      if (drift > 2 && !fl.drift) { fl.drift = true; ev('Temperaturdrift: Bei ' + fmt(S.Tg, 0) + ' °C am DMS verschiebt sich der Nullpunkt um ' + fmt(drift, 1) + ' % des Endwerts. Eine Voll- oder Halbbrücke kompensiert das, oder gleiche den Nullpunkt neu ab.', 'warn'); }
      else if (drift < 1 && fl.drift) fl.drift = false;
    }
    function stepCore(dtMs) { let rem = dtMs; while (rem > 1e-9) { const d = Math.min(rem, 2); rem -= d; sub(d / 1000); } }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      const old = Cv[key], v = coerce(d, value, ALIAS[key], old);
      Cv[key] = v;
      if (key === 'mode' && old !== v) { applyMode(); S.y = 0; S.c = 0; S.p = 0; S.broken = false; S.fl.yld = false; S.fl.brk = false; settle(); }
      else if (key === 'bridge' || key === 'uBridge') settle();
      else if (key === 'offset') { S.Uf += (v - old) * 1e-3; S.uClean += (v - old) * 1e-3; compute(); }
      else if (key === 'gain' || key === 'adcBits') compute();
      if (key === 'calZero') { if (v && !S.btn.z) { S.btn.z = true; calZero(); } if (!v) S.btn.z = false; }
      if (key === 'calSpan') { if (v && !S.btn.s) { S.btn.s = true; calSpan(); } if (!v) S.btn.s = false; }
      if (key === 'repair') { if (v && !S.btn.r) { S.btn.r = true; repair(); } if (!v) S.btn.r = false; }
      if (key === 'cal') compute();
    }
    function calZero() {
      const n = Math.pow(2, Cv.adcBits); S.calU = (S.N + 0.5) / n * VREF; S.calN++;
      compute();
      ev('Nullpunkt abgeglichen: Bei der jetzigen Last (' + fmt(trueVal(), 1) + ' ' + M().unit + ') zeigt das Gerät jetzt 0 (ADU-Zählwert ' + S.N + ').', 'info');
    }
    function calSpan() {
      const m = M(), ref = trueVal(), n = Math.pow(2, Cv.adcBits);
      if (ref < 0.2 * m.nom) { ev('Endwertabgleich nicht möglich: Lege mindestens ' + fmt(0.2 * m.nom, 0) + ' ' + m.unit + ' (20 % der Nennlast) als bekannte Last auf.', 'warn'); return; }
      const raw = (((S.N + 0.5) / n * VREF) - S.calU) / dUfs() * m.nom;
      if (!(Math.abs(raw) > 1e-9)) { ev('Endwertabgleich nicht möglich: Der Messwert liegt noch auf dem Nullpunkt.', 'warn'); return; }
      S.calS = clamp(ref / raw, 0.2, 5); S.calN++;
      compute();
      ev('Endwert abgeglichen: Bei ' + fmt(ref, 1) + ' ' + m.unit + ' zeigt das Gerät jetzt genau diesen Wert (Faktor ' + fmt(S.calS, 3) + ').', 'info');
    }
    function repair() {
      S.broken = false; S.p = 0; S.y = 0; S.c = 0; S.fl.brk = false; S.fl.yld = false;
      ev('Der Federkörper wurde getauscht, der Aufnehmer ist wieder neu.', 'info');
      settle();
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      ['mode', 'bridge', 'uBridge'].forEach(k => { if (p.params[k] != null) setControl(k, p.params[k]); });
      Object.keys(p.params).forEach(k => { if (k !== 'mode' && k !== 'bridge' && k !== 'uBridge') setControl(k, p.params[k]); });
      return true;
    }

    function errPct() { return (S.value - trueVal()) / M().nom * 100; }
    function readMeters() {
      return { strain: S.eps * 1e6, dR: S.dR, uBridge: S.uClean * 1000, uOut: S.uOut, adc: S.N, value: S.value, error: errPct(), hysteresis: (S.broken ? 0 : S.y - trueVal() / M().nom) * 100 };
    }
    function zeroErr() { const n = Math.pow(2, Cv.adcBits), Uo = uOutOf(udOf(S.broken ? 0 : S.p, S.Tg, Cv.bridge), Cv.gain); return valueFrom((Math.floor(Uo / VREF * n) + 0.5) / n * VREF) / M().nom * 100; }
    function state() {
      const m = M(), tv = trueVal(), faults = [];
      if (S.sat) faults.push('saturation');
      if (S.broken) faults.push('broken');
      else if (S.p > 0) faults.push('overload');
      if (Math.abs(S.epsTh / EPS_NOM) * 100 > 2) faults.push('drift');
      if (tgTarget() - Cv.temp > 8) faults.push('selfheat');
      const ze = zeroErr(); if (Math.abs(ze) > 2.5) faults.push('zero');
      return {
        mode: Cv.mode, bridge: Cv.bridge, force: Cv.force, pressure: Cv.pressure, load: tv, loadFrac: tv / m.nom, unit: m.unit, nominal: m.nom, strain: S.eps * 1e6, strainThermal: S.epsTh * 1e6, dR: S.dR,
        uBridge: S.uClean * 1000, ud: S.uClean, uOut: S.uOut, uOutRaw: S.raw, adc: S.N, adcMax: S.maxN, value: S.value, trueValue: tv, error: errPct(), zeroError: ze,
        hysteresis: (S.broken ? 0 : S.y - tv / m.nom) * 100, creep: S.c * 100, permanentSet: S.p * 100, tGauge: S.Tg, sensitivity: dUfs() / m.nom, fullScaleOut: dUfs(),
        saturated: !!S.sat, broken: S.broken, overloaded: S.p > 0 || S.broken, calZeroU: S.calU, calScale: S.calS, calCount: S.calN, faults, fault: faults.length > 0, t: S.t * 1000
      };
    }

    // ---- Kennlinien ----
    function curves() {
      const m = M(), n = 41, ld = [], ul = [], idl = [], err = [], xm = m.max / m.nom, G = Cv.gain;
      const Tg = S.Tg;
      for (let k = 0; k < n; k++) {
        const xf = xm * k / (n - 1), X = xf * m.nom;
        const yl = Math.max(0, xf - HYS_W), yu = Math.min(xf + HYS_W, Math.max(0, xm - HYS_W));
        ld.push([X, uOutOf(udOf(yl + S.p, Tg, Cv.bridge), G)]);
        ul.push([X, uOutOf(udOf(yu + S.p, Tg, Cv.bridge), G)]);
        idl.push([X, uOutOf(bridgeUd(Cv.bridge, Cv.uBridge, EPS_NOM * xf), G)]);
        const Uo = uOutOf(udOf(yl + S.p, Tg, Cv.bridge), G), nn = Math.pow(2, Cv.adcBits);
        err.push([X, (valueFrom((Math.floor(Uo / VREF * nn) + 0.5) / nn * VREF) - X) / m.nom * 100]);
      }
      const tl = [], tz = [], xe = xEff();
      for (let T = -20; T <= 80; T += 4) { tz.push([T, uOutOf(udOf(S.p, T + (tgTarget() - Cv.temp), Cv.bridge), G)]); tl.push([T, uOutOf(udOf(xe, T + (tgTarget() - Cv.temp), Cv.bridge), G)]); }
      const tvv = trueVal(), uo = uOutOf(udOf(xe, S.Tg, Cv.bridge), G);
      return [
        { id: 'uf', title: 'Ausgangsspannung über der Last mit Hysterese', xLabel: Cv.mode === 'kraft' ? 'Kraft' : 'Druck', xUnit: m.unit, yLabel: 'Ausgangsspannung', yUnit: 'V', series: [{ name: 'Belasten', points: ld }, { name: 'Entlasten', points: ul }, { name: 'ideal (ohne Fehler)', points: idl }], marker: { x: tvv, y: uo } },
        { id: 'temp', title: 'Temperaturgang der Ausgangsspannung', xLabel: 'Temperatur am DMS', xUnit: '°C', yLabel: 'Ausgangsspannung', yUnit: 'V', series: [{ name: 'Nullpunkt (Last 0)', points: tz }, { name: 'bei aktueller Last', points: tl }], marker: { x: Cv.temp, y: uOutOf(udOf(xe, Cv.temp + (tgTarget() - Cv.temp), Cv.bridge), G) } },
        { id: 'fehler', title: 'Anzeigefehler über der Last', xLabel: Cv.mode === 'kraft' ? 'Kraft' : 'Druck', xUnit: m.unit, yLabel: 'Fehler', yUnit: '% v. E.', series: [{ name: 'Anzeigefehler (Belasten)', points: err }], marker: { x: tvv, y: errPct() } }
      ];
    }

    // ================= Zeichnen =================
    function gaugePatch(ctx, x, y, w, h, vert, glow, sign) {
      ctx.fillStyle = '#3a2a14'; rr(ctx, x - 2, y - 2, w + 4, h + 4, 3); ctx.fill();
      ctx.fillStyle = glow > 0.1 ? rgba(mix([226, 160, 70], [255, 80, 40], glow), 1) : '#e2a046'; rr(ctx, x, y, w, h, 2); ctx.fill();
      ctx.strokeStyle = '#6a4a14'; ctx.lineWidth = 1.5; ctx.beginPath();
      const n = 5;
      for (let k = 0; k < n; k++) { if (vert) { const yy = y + 4 + (h - 8) * k / (n - 1); ctx.moveTo(x + 4, yy); ctx.lineTo(x + w - 4, yy); } else { const xx = x + 4 + (w - 8) * k / (n - 1); ctx.moveTo(xx, y + 3); ctx.lineTo(xx, y + h - 3); } }
      ctx.stroke();
      if (sign) txt(ctx, sign, x + w / 2, y + h / 2, 11, '#1a1204', 'center', true);
    }
    function drawBeam(ctx, t) {
      const m = M(), x = S.broken ? 0 : S.y + S.c, pf = S.p, L = 340, x0 = 50, yB = 322, th = 34;
      const defl = (xx, sc) => 70 * sc * (xx / L) * (xx / L) * (3 - xx / L) / 2;
      const sc = S.broken ? 0 : x + pf, heat = clamp((S.Tg - Cv.temp) / 12, 0, 1);
      panel(ctx, 14, 134, 506, 412, 'MESSGRÖSSE  ' + (Cv.mode === 'kraft' ? 'Biegebalken mit DMS' : 'Druckmessdose mit DMS'));
      // Einspannung
      ctx.fillStyle = '#39424b'; rr(ctx, 28, 250, 22, 190, 4); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#6a7480'; ctx.lineWidth = 1.5; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(28, 262 + k * 20); ctx.lineTo(16, 274 + k * 20); ctx.stroke(); }
      const seg = (a, b, s0, dy) => { const pts = []; for (let xx = a; xx <= b + 1e-6; xx += 10) pts.push([x0 + xx, yB + defl(xx, s0) + (dy || 0)]); return pts; };
      const drawSeg = (a, b, s0, ox, oy, rot) => {
        ctx.save(); ctx.translate(ox || 0, oy || 0); if (rot) { ctx.translate(x0 + a, yB); ctx.rotate(rot); ctx.translate(-(x0 + a), -yB); }
        const top = seg(a, b, s0, -th / 2), bot = seg(a, b, s0, th / 2);
        const g = ctx.createLinearGradient(0, yB - 40, 0, yB + 40); g.addColorStop(0, '#d7dee5'); g.addColorStop(0.5, '#9ea8b2'); g.addColorStop(1, '#6a7480');
        ctx.fillStyle = g; ctx.beginPath(); top.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      };
      if (!S.broken) {
        drawSeg(0, L, sc, 0, 0, 0);
        // DMS auf der Oberseite (Zug) und Unterseite (Druck)
        const dy = xx => defl(xx, sc), mkG = (xx, w, top, sign) => { const ang = Math.atan2(defl(xx + 5, sc) - defl(xx - 5, sc), 10); ctx.save(); ctx.translate(x0 + xx + w / 2, yB + dy(xx + w / 2) + (top ? -th / 2 - 5 : th / 2 + 5)); ctx.rotate(ang); gaugePatch(ctx, -w / 2, -5, w, 10, false, heat, sign); ctx.restore(); };
        mkG(26, 46, true, Cv.bridge === 'viertel' ? 'R1' : '+');
        if (Cv.bridge !== 'viertel') mkG(26, 46, false, '−');
        if (Cv.bridge === 'voll') { mkG(84, 46, true, '+'); mkG(84, 46, false, '−'); }
        txt(ctx, 'DMS', x0 + 49, yB - th / 2 - 26, 11, C.warn, 'center', true);
        // Kraftpfeil
        const tipX = x0 + L, tipY = yB + dy(L) - th / 2, f = x, len = 30 + 55 * clamp(Cv.force / m.nom, 0, 2);
        if (Cv.force > 0.05) {
          const col = Cv.force / m.nom >= m.yld ? C.bad : Cv.force / m.nom > 1 ? C.warn : '#ff7a7a';
          ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tipX, tipY - 8 - len); ctx.lineTo(tipX, tipY - 16); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(tipX, tipY - 2); ctx.lineTo(tipX - 14, tipY - 22); ctx.lineTo(tipX + 14, tipY - 22); ctx.closePath(); ctx.fill();
          txt(ctx, 'F = ' + fmt(Cv.force, 1) + ' N', tipX - 14, tipY - 12 - len, 14, col, 'right', true, MONO);
        } else txt(ctx, 'Kraftpfeil ziehen', tipX - 10, tipY - 70, 11, C.dim, 'right');
        // Dehnungsanzeige
        txt(ctx, 'Oberseite wird gedehnt (+ε), Unterseite gestaucht (−ε)', 40, 232, 11.5, C.dim, 'left');
        txt(ctx, 'ε = ' + fmt(S.eps * 1e6, 0) + ' µm/m', 40, 214, 15, C.warn, 'left', true, MONO);
        txt(ctx, '(Verformung stark übertrieben)', 40, 250, 10.5, C.dim, 'left');
        if (pf > 0.001) txt(ctx, 'bleibend verformt!', tipX - 90, yB + 100, 12, C.bad, 'right', true);
      } else {
        const pr = clamp((S.t - (S.brkAt || 0)) / 0.6, 0, 1); drawSeg(0, 130, 0, 0, 0, 0); drawSeg(130, L, 0, 6 * pr, 26 * pr, 0.28 * pr);
        sparks(ctx, x0 + 130, yB, t, 1.2);
        txt(ctx, 'BRUCH!', x0 + 130, yB - 56, 22, Math.floor(t / 250) % 2 ? C.bad : C.warn, 'center', true);
        mkBroken(ctx, t);
      }
      // Waerme/Temperatur
      txt(ctx, 'DMS-Temperatur ' + fmt(S.Tg, 1) + ' °C', 500, 214, 12, heat > 0.2 ? C.warn : C.dim, 'right', heat > 0.2);
    }
    function mkBroken(ctx, t) { txt(ctx, 'Federkörper tauschen (Taster)', 500, 232, 11, C.dim, 'right'); }
    function drawCell(ctx, t) {
      const m = M(), xe = S.broken ? 0 : S.y + S.c + S.p, pf = S.p, cx = 260, yTop = 330, heat = clamp((S.Tg - Cv.temp) / 12, 0, 1);
      panel(ctx, 14, 134, 506, 412, 'MESSGRÖSSE  Druckmessdose mit DMS');
      // Rohr mit Druck
      const f = clamp(Cv.pressure / m.nom, 0, 1.6);
      ctx.fillStyle = '#39424b'; rr(ctx, cx - 22, 160, 44, 172, 6); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = rgba(mix([60, 110, 190], [255, 90, 70], clamp(f - 0.8, 0, 0.6) / 0.6), 0.35 + 0.5 * clamp(f, 0, 1)); rr(ctx, cx - 14, 166, 28, 166, 4); ctx.fill();
      polyDots(ctx, [[cx, 170], [cx, yTop - 4]], t, Cv.pressure > 0.05 ? 20 + 40 * f : 0, 'rgba(210,235,255,0.95)', 18, 3);
      if (Cv.pressure > 0.05) { ctx.fillStyle = f >= m.yld ? C.bad : '#9ccaff'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx - 50 + k * 50, 206); ctx.lineTo(cx - 62 + k * 50, 190); ctx.lineTo(cx - 38 + k * 50, 190); ctx.closePath(); } }
      txt(ctx, 'p = ' + fmt(Cv.pressure, 2) + ' bar', cx + 36, 180, 14, f >= m.yld ? C.bad : '#9ccaff', 'left', true, MONO);
      // Koerper
      const g = ctx.createLinearGradient(cx - 100, 0, cx + 100, 0); g.addColorStop(0, '#5a646e'); g.addColorStop(0.5, '#d4dbe2'); g.addColorStop(1, '#5a646e');
      ctx.fillStyle = g; rr(ctx, cx - 100, yTop, 200, 150, 8); ctx.fill(); ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#10151a'; rr(ctx, cx - 78, yTop + 16, 156, 100, 6); ctx.fill();
      // Membran
      const bulge = S.broken ? 0 : 36 * (xe);
      ctx.strokeStyle = '#d9dfe5'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 78, yTop + 16); ctx.quadraticCurveTo(cx, yTop + 16 + bulge * 2, cx + 78, yTop + 16); ctx.stroke();
      if (!S.broken) {
        const mx = cx, my = yTop + 16 + bulge + 8, mk = (xx, yy, w, h, sign) => gaugePatch(ctx, xx - w / 2, yy - h / 2, w, h, false, heat, sign);
        mk(mx, my, 40, 12, Cv.bridge === 'viertel' ? 'R1' : '+'); if (Cv.bridge !== 'viertel') { ctx.save(); ctx.translate(cx - 58, yTop + 28 + bulge * 0.15); mk(0, 0, 20, 12, '−'); ctx.restore(); }
        if (Cv.bridge === 'voll') { ctx.save(); ctx.translate(cx + 58, yTop + 28 + bulge * 0.15); mk(0, 0, 20, 12, '−'); ctx.restore(); mk(mx, my + 20, 40, 12, '+'); }
        txt(ctx, 'DMS auf der Membran (Innenseite)', cx, yTop + 128, 11, C.dim, 'center');
      } else { sparks(ctx, cx, yTop + 16, t, 1.2); txt(ctx, 'MEMBRAN GEPLATZT!', cx, yTop - 22, 18, Math.floor(t / 250) % 2 ? C.bad : C.warn, 'center', true); }
      txt(ctx, 'ε = ' + fmt(S.eps * 1e6, 0) + ' µm/m', 40, 214, 15, C.warn, 'left', true, MONO);
      txt(ctx, '(Verformung stark übertrieben)', 40, 232, 10.5, C.dim, 'left');
      if (pf > 0.001 && !S.broken) txt(ctx, 'Membran bleibend verformt!', 500, 214, 12, C.bad, 'right', true);
      txt(ctx, 'DMS-Temperatur ' + fmt(S.Tg, 1) + ' °C', 500, 232, 12, heat > 0.2 ? C.warn : C.dim, 'right', heat > 0.2);
    }
    function drawButtons(ctx, t) {
      const btn = (x, y, w, lab, sub, on, col) => { ctx.fillStyle = on ? rgba(col, 0.4) : '#2a323b'; rr(ctx, x, y, w, 46, 11); ctx.fill(); ctx.strokeStyle = on ? rgba(col, 1) : '#556270'; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, lab, x + w / 2, y + 17, 14, on ? '#fff' : C.text, 'center', true); txt(ctx, sub, x + w / 2, y + 34, 10, C.dim, 'center'); };
      btn(28, 486, 150, '⌀ Nullpunkt', 'bei Last 0 drücken', S.btn.z, SIGC.volt);
      btn(190, 486, 150, '⇧ Endwert', 'mit bekannter Last drücken', S.btn.s, SIGC.volt);
      if (S.broken || S.p > 0) btn(352, 486, 156, '🔧 Teil tauschen', 'neuer Federkörper', S.btn.r, SIGC.cur);
      else { txt(ctx, 'Kalibrierung ' + (Cv.cal ? 'aktiv' : 'aus') + (S.calN ? ' · ' + S.calN + '×' : ''), 352 + 78, 509, 11.5, Cv.cal && S.calN ? C.ok : C.dim, 'center', true); }
    }
    function drawBridgeSchem(ctx, t) {
      const ox = 548, oy = 250, wire = '#8b98a5', br = Cv.bridge, actv = (i) => (br === 'voll') || (br === 'halb' && (i === 0 || i === 3)) || (br === 'viertel' && i === 0);
      panel(ctx, ox - 12, oy, 450, 174, 'MESSBRÜCKE  ' + BR[br].label + ' · Messverstärker · ADU');
      const cx = ox + 80, top = [cx, oy + 30], lf = [cx - 50, oy + 90], rt = [cx + 50, oy + 90], bt = [cx, oy + 150];
      line(ctx, [top, lf, bt, rt, top], wire, 2);
      // vier Zweige: R1 oben links, R2 oben rechts, R3 unten links, R4 unten rechts. Aktive DMS: orange mit Vorzeichen
      const arm = (a, b, lab, active, sign, side) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; ctx.fillStyle = active ? '#4a3414' : '#10151a'; ctx.beginPath(); ctx.arc(mx, my, 11, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = active ? '#e2a046' : '#c9d1d9'; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, sign || '', mx, my, 11, '#ffd27a', 'center', true); txt(ctx, lab, mx + side * 18, my, 10.5, active ? C.warn : C.dim, side < 0 ? 'right' : 'left', true); };
      const dR = S.dR / R0 * 0 + 0;
      arm(top, lf, 'R1', actv(0), actv(0) ? (br === 'viertel' ? '+' : '+') : '', -1); arm(top, rt, 'R2', br === 'voll', br === 'voll' ? '−' : '', 1);
      arm(lf, bt, 'R3', br === 'voll', br === 'voll' ? '−' : '', -1); arm(rt, bt, 'R4', br !== 'viertel', br !== 'viertel' ? '+' : '', 1);
      [top, bt, lf, rt].forEach(p => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, TWO_PI); ctx.fill(); });
      txt(ctx, '+' + fmt(Cv.uBridge, 1) + ' V', top[0] + 10, top[1] - 8, 11.5, C.ok, 'left', true); txt(ctx, '0 V', bt[0] + 8, bt[1] + 10, 10.5, C.dim, 'left');
      txt(ctx, 'Ud', cx, oy + 90, 12, '#4cd964', 'center', true);
      polyDots(ctx, [top, lf, bt], t, 30, 'rgba(255,226,110,0.95)', 18, 2.4); polyDots(ctx, [top, rt, bt], t, 30, 'rgba(255,226,110,0.95)', 18, 2.4);
      // Zum Verstaerker
      const ax = ox + 196, ay = oy + 90;
      line(ctx, [rt, [rt[0] + 10, rt[1]], [ax, ay - 10]], wire, 2); line(ctx, [lf, [lf[0] - 16, lf[1]], [lf[0] - 16, oy + 166], [ox + 170, oy + 166], [ox + 170, ay + 10], [ax, ay + 10]], wire, 2);
      const satc = S.sat && Math.floor(t / 250) % 2 === 0;
      ctx.fillStyle = satc ? 'rgba(255,92,92,0.35)' : 'rgba(76,217,100,0.15)'; ctx.beginPath(); ctx.moveTo(ax, ay - 30); ctx.lineTo(ax + 62, ay); ctx.lineTo(ax, ay + 30); ctx.closePath(); ctx.fill(); ctx.strokeStyle = satc ? C.bad : C.ok; ctx.lineWidth = 2.2; ctx.stroke();
      txt(ctx, '+', ax + 6, ay - 10, 12, C.text, 'left', true); txt(ctx, '−', ax + 6, ay + 10, 12, C.text, 'left', true); txt(ctx, '×' + Cv.gain, ax + 36, ay, 12, C.text, 'center', true, MONO);
      txt(ctx, 'Instrumentenverstärker', ax + 30, ay - 40, 10, C.dim, 'center', true);
      line(ctx, [[ax + 62, ay], [ax + 100, ay]], wire, 2); polyDots(ctx, [[ax + 62, ay], [ax + 100, ay]], t, 40, 'rgba(76,217,100,1)', 14, 2.6);
      txt(ctx, fmt(S.uOut, 3) + ' V', ax + 80, ay + 16, 11.5, satc ? C.bad : '#4cd964', 'center', true, MONO);
      const bx = ax + 100, bw = 64;
      ctx.fillStyle = 'rgba(200,150,255,0.14)'; rr(ctx, bx, ay - 32, bw, 64, 8); ctx.fill(); ctx.strokeStyle = '#c796ff'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'ADU', bx + bw / 2, ay - 18, 12, '#c796ff', 'center', true); txt(ctx, Cv.adcBits + ' Bit', bx + bw / 2, ay - 4, 10.5, C.dim, 'center'); txt(ctx, String(S.N), bx + bw / 2, ay + 16, 14, '#e6d3ff', 'center', true, MONO);
      txt(ctx, 'Ud = ' + fmt(S.uClean * 1000, 3) + ' mV', ox + 190, oy + 168, 11, C.dim, 'left');
    }
    function drawTrace(ctx, t) {
      const x0 = 536, y0 = 436, w = 450, h = 110, m = M();
      panel(ctx, x0, y0, w, h, 'VERLAUF  letzte 40 s');
      const px = x0 + 44, pw = w - 60, py = y0 + 28, ph = h - 40, hh = S.hist, T0 = S.t - 40;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 5); ctx.fill();
      let hi = Math.max(m.nom * 0.5, trueVal(), S.value); for (let i = 0; i < hh.length; i++) if (hh[i][0] >= T0) hi = Math.max(hi, hh[i][1], hh[i][2]);
      hi *= 1.1; const lo = Math.min(0, S.value);
      const X = tt => px + pw * (tt - T0) / 40, Y = v => py + ph - (v - lo) / (hi - lo) * ph;
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1; for (let k = 0; k <= 3; k++) { const gy = py + ph * k / 3; ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); ctx.stroke(); txt(ctx, fmt(hi - (hi - lo) * k / 3, 0), px - 5, gy, 9.5, C.dim, 'right'); }
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      const tr = (idx, col, wd, dash) => { ctx.strokeStyle = col; ctx.lineWidth = wd; if (dash && ctx.setLineDash) ctx.setLineDash(dash); ctx.beginPath(); let first = true; for (let i = 0; i < hh.length; i++) { if (hh[i][0] < T0 - 0.2) continue; const x = X(hh[i][0]), y = Y(hh[i][idx]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } ctx.stroke(); if (dash && ctx.setLineDash) ctx.setLineDash([]); };
      tr(1, 'rgba(255,179,64,0.95)', 2, [6, 4]); tr(2, 'rgba(76,217,100,1)', 2.4);
      ctx.restore();
      txt(ctx, 'Last (wahr)', x0 + w - 150, y0 + 17, 11, C.warn, 'left', true); txt(ctx, 'Anzeige', x0 + w - 62, y0 + 17, 11, C.ok, 'left', true);
    }
    function drawPanelA(ctx, t) {
      const x0 = 536, y0 = 134, w = 450, h = 104, m = M(), err = errPct(), bad = Math.abs(err) > 2;
      panel(ctx, x0, y0, w, h, null);
      needle(ctx, x0 + 62, y0 + 54, 44, 0, m.max, clamp(S.value, 0, m.max), { warnFrom: m.nom * m.yld, digits: 0, label: m.unit, col: '#ffb340' });
      lcd(ctx, x0 + 126, y0 + 14, 310, 52, fmt(S.value, Cv.mode === 'kraft' ? 1 : 2), m.unit, S.sat ? (Math.floor(t / 250) % 2 ? '#ff7a7a' : '#8dffa0') : '#8dffa0');
      txt(ctx, 'wahr ' + fmt(trueVal(), Cv.mode === 'kraft' ? 1 : 2) + ' ' + m.unit, x0 + 130, y0 + 84, 13, C.warn, 'left', true, MONO);
      txt(ctx, 'Fehler ' + (err >= 0 ? '+' : '') + fmt(err, 2) + ' % v. E.', x0 + w - 14, y0 + 84, 13, bad ? C.bad : C.ok, 'right', true, MONO);
      txt(ctx, 'Nennlast ' + m.nom + ' ' + m.unit, x0 + 130, y0 + 98, 10.5, C.dim, 'left');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      if (!begin(ctx, w, h)) { ctx.restore(); return; }
      const m = M(), tv = trueVal(), err = errPct(), dec = Cv.mode === 'kraft' ? 1 : 2;
      txt(ctx, 'Kraft- und Druck-Messkette (DMS)', 20, 24, 18, C.text, 'left', true);
      txt(ctx, m.label + ' · ' + BR[Cv.bridge].label + ' · ' + Cv.adcBits + ' Bit', 980, 24, 12, C.dim, 'right');
      chainStrip(ctx, t, [
        { title: 'MESSGRÖSSE', l1: (Cv.mode === 'kraft' ? 'F ' : 'p ') + fmt(tv, dec) + ' ' + m.unit, l2: 'Nennlast ' + m.nom + ' ' + m.unit, col: SIGC.force, bad: S.p > 0 || S.broken },
        { title: 'SENSOR (DMS)', l1: 'ε ' + fmt(S.eps * 1e6, 0) + ' µm/m', l2: 'ΔR = ' + fmt(S.dR, 3) + ' Ω', col: SIGC.res, bad: S.broken },
        { title: 'AUFBEREITUNG', l1: fmt(S.uClean * 1000, 2) + ' mV', l2: 'Brücke · G=' + Cv.gain + ' · ' + fmt(Cv.uBridge, 1) + ' V', col: SIGC.volt, bad: S.sat },
        { title: 'WANDLER', l1: 'N = ' + S.N, l2: 'ADU ' + Cv.adcBits + ' Bit · ' + fmt(S.uOut, 2) + ' V', col: SIGC.dig, bad: S.sat },
        { title: 'ANZEIGE', l1: fmt(S.value, dec) + ' ' + m.unit, l2: 'Fehler ' + (err >= 0 ? '+' : '') + fmt(err, 1) + ' % v. E.', col: SIGC.disp, bad: Math.abs(err) > 5 }
      ], [{ col: SIGC.force, act: tv > 0.05 ? 1 : 0.15, label: 'F' }, { col: SIGC.res, act: 0.7, label: 'ΔR' }, { col: SIGC.volt, act: 0.8, label: 'U' }, { col: SIGC.dig, act: 1, label: 'N' }]);
      if (Cv.mode === 'kraft') drawBeam(ctx, t); else drawCell(ctx, t);
      drawButtons(ctx, t); drawPanelA(ctx, t); drawBridgeSchem(ctx, t); drawTrace(ctx, t);
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p) return null;
      if (p.y > 482 && p.y < 536) {
        if (p.x > 24 && p.x < 182) return { key: 'calZero', kind: 'button' };
        if (p.x > 186 && p.x < 344) return { key: 'calSpan', kind: 'button' };
        if (p.x > 348 && p.x < 512 && (S.broken || S.p > 0)) return { key: 'repair', kind: 'button' };
      }
      if (Cv.mode === 'kraft' && p.x > 370 && p.x < 430 && p.y > 150 && p.y < 330) return { key: 'force', kind: 'drag', min: 0, max: 200 };
      if (Cv.mode === 'druck' && p.x > 232 && p.x < 288 && p.y > 160 && p.y < 330) return { key: 'pressure', kind: 'drag', min: 0, max: 16 };
      return null;
    }
    function dragTo(key, px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p) return null;
      if (key === 'force') { const v = Math.round(clamp((300 - p.y - 30) / 55, 0, 2) * 100 * 2) / 2; setControl('force', v); return Cv.force; }
      if (key === 'pressure') { const v = Math.round(clamp((330 - p.y) / 170, 0, 1) * 16 * 10) / 10; setControl('pressure', v); return Cv.pressure; }
      return null;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'kraft', controls: ctl, meters, presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, dragTo, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { ['mode', 'bridge', 'uBridge'].forEach(k => { if (opts.controls[k] != null) setControl(k, opts.controls[k]); }); Object.keys(opts.controls).forEach(k => { if (k !== 'mode' && k !== 'bridge' && k !== 'uBridge') setControl(k, opts.controls[k]); }); S.Tg = Cv.temp; S.hist.length = 0; settle(); }
    return rig;
  }

  R.register({
    id: 'kraft', name: 'Druck, Kraft, Dehnung (DMS)', icon: '⚖️',
    info: 'Biegebalken und Druckmessdose mit Dehnungsmessstreifen: Viertel-, Halb- und Vollbrücke, Messverstärker, ADU und Anzeige. Gleiche Nullpunkt und Endwert ab und erlebe Temperaturdrift, Hysterese, Übersteuerung und Überlast mit Funken.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
