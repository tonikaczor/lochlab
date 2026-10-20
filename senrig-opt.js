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

  // ===== Pruefstand 2: Licht und Naeherung (optische Sensoren, Lichtschranken, Naeherungsschalter) =====
  // Physik (eigenes Modell, bei Bedarf gegen SEN_CORE austauschbar):
  //   LDR   R = R10*(10 lx/E)^0,7 (100 Ohm ... 1 MOhm), Teiler mit rLoad                Fotodiode I = 0,08 uA/lx*E (+2 nA), U = I*rLoad
  //   Fototransistor Ic = 0,4 uA/lx*E, U = Ub - Ic*rLoad (Uce,sat 0,2 V, Ausgang faellt mit dem Licht)
  //   Gabel: LED-Strahl 1000 lx, Objekt (14 mm) schattet ab;  Reflex: E = 3000 lx*rho/(1+(d/80 mm)^2), rho hell 0,9 / dunkel 0,3
  //   Komparator mit Hysterese und Entprellzeit; Rauschen 15 mV und 100-Hz-Flackern des Fremdlichts (20 %)
  //   Induktiv Sn 8 mm, Reduktionsfaktor Stahl 1 / Alu 0,4 / Kupfer 0,3 / Kunststoff und Wasser 0;  Kapazitiv Sn 10 mm;
  //   Ultraschall Schaltabstand 150 mm*sqrt(f), Laufzeit t = 2d/c (343 m/s);  Schaltdifferenz der Naeherungsschalter 10 %
  const SENS = {
    ldr: { label: 'Fotowiderstand (LDR)', short: 'LDR', cls: 'opt', vcc: 5, pol: 1 },
    fotodiode: { label: 'Fotodiode', short: 'Fotodiode', cls: 'opt', vcc: 5, pol: 1 },
    fototransistor: { label: 'Fototransistor', short: 'Fototransistor', cls: 'opt', vcc: 5, pol: -1 },
    gabel: { label: 'Gabellichtschranke', short: 'Gabel-LS', cls: 'opt', vcc: 5, pol: 1, beam: true },
    reflex: { label: 'Reflexionslichttaster (Objekt reflektiert)', short: 'Reflex-Taster', cls: 'opt', vcc: 5, pol: -1, beam: true },
    induktiv: { label: 'Induktiver Näherungsschalter', short: 'induktiv', cls: 'prox', vcc: 24, Sn: 8, F: { stahl: 1, alu: 0.4, kupfer: 0.3, kunststoff: 0, wasser: 0 } },
    kapazitiv: { label: 'Kapazitiver Näherungsschalter', short: 'kapazitiv', cls: 'prox', vcc: 24, Sn: 10, F: { stahl: 1, alu: 1, kupfer: 1, kunststoff: 0.45, wasser: 1 } },
    ultraschall: { label: 'Ultraschall-Abstandssensor', short: 'Ultraschall', cls: 'prox', vcc: 24, Sn: 150, us: true, F: { stahl: 1, alu: 1, kupfer: 1, kunststoff: 0.85, wasser: 0.8 } }
  };
  const MATS = ['stahl', 'alu', 'kupfer', 'kunststoff', 'wasser'], MATLAB = { stahl: 'Stahl', alu: 'Aluminium', kupfer: 'Kupfer', kunststoff: 'Kunststoff', wasser: 'Wasser' };
  const DIST0 = { ldr: 20, fotodiode: 20, fototransistor: 20, gabel: 60, reflex: 100, induktiv: 12, kapazitiv: 18, ultraschall: 120 };
  const ALIAS = { sensor: { 'fotowiderstand': 'ldr', 'foto-transistor': 'fototransistor', 'gabellichtschranke': 'gabel', 'reflexlichtschranke': 'reflex', 'induktiver': 'induktiv', 'kapazitiver': 'kapazitiv', 'ultraschallsensor': 'ultraschall', 'us': 'ultraschall' }, material: { aluminium: 'alu', 'kupfer ': 'kupfer', plastik: 'kunststoff' } };
  const LED_GABEL = 1000, ROH = { hell: 0.9, dunkel: 0.3 }, I_LIM = 0.2, V_RES = 2.0;
  // Ansprechzeit und Schaltfrequenz (Verbund, Paket A5), alle Nennwerte sind Lehrwerte (A):
  //   Naeherungsschalter: Nennschaltfrequenz induktiv 1 kHz (A), kapazitiv 50 Hz (A), Ultraschall 10 Hz (A); Ansprechzeit des Sensors = 1 / (2 * fNenn) (+ Laufzeit des Echos 2d/c)
  //   Optik: Nennschaltfrequenz 5 kHz (A); Ansprechzeit des Sensors = tau * ln 2 (Schwelle in der Mitte des Spannungshubs), tau wie im Modell (LDR 80 ms langsame Flanke, Fotodiode 0,5 ms, sonst 5 ms)
  //   Beide kommen dazu mit der Entprellzeit fdelay; fMax = min(Nennfrequenz, 1 / (2 * tResp)). Montageabstand: mindestens 10 % Sn, hoechstens 0,8 * gesicherter Schaltabstand (20 % Reserve) (A)
  const F_NOM = { ldr: 5000, fotodiode: 5000, fototransistor: 5000, gabel: 5000, reflex: 5000, induktiv: 1000, kapazitiv: 50, ultraschall: 10 };
  const TAU_MAX = { ldr: 0.08, fotodiode: 0.0005, fototransistor: 0.005, gabel: 0.005, reflex: 0.005 };
  const I_Q_PROX = 10;      // Ruhestrom eines Naeherungsschalters an 24 V in mA (A, wie im Verbund-Lastenheft)
  const GAP_C = 30, OBJ_W = 14, BEAM_R = 1.5;     // Gabel: Strahlmitte 30 mm, Objektbreite 14 mm
  const SCENE = { gabel: { x0: 152, k: 3.6 }, reflex: { x0: 120, k: 1.2 }, ultraschall: { x0: 120, k: 1.2 }, induktiv: { x0: 150, k: 13.75 }, kapazitiv: { x0: 150, k: 8.25 } };

  const CONTROLS = [
    { key: 'sensor', label: 'Sensor', type: 'select', value: 'ldr', group: 'Sensor', options: Object.keys(SENS).map(k => ({ value: k, label: SENS[k].label })), help: 'Optische Sensoren (LDR, Fotodiode, Fototransistor, Gabel- und Reflexlichtschranke) und Näherungsschalter (induktiv, kapazitiv, Ultraschall). Beim Umschalten wird der Abstand auf einen passenden Wert gesetzt.' },
    { key: 'lux', label: 'Beleuchtungsstärke', type: 'slider', min: 0.1, max: 100000, step: 0.1, unit: 'lx', value: 500, scale: 'log', group: 'Licht', help: 'Licht der Lampe auf LDR, Fotodiode und Fototransistor. Büro etwa 500 lx, Sonne bis 100 000 lx.' },
    { key: 'dist', label: 'Abstand des Objekts', type: 'slider', min: 0, max: 300, step: 0.5, unit: 'mm', value: 20, curve: 3, group: 'Objekt', help: 'Abstand des Zielobjekts zur Sensorfläche. Du kannst das Objekt auch im Bild ziehen. Gabel: Strahl bei 30 mm.' },
    { key: 'material', label: 'Material des Objekts', type: 'select', value: 'stahl', group: 'Objekt', options: MATS.map(m => ({ value: m, label: MATLAB[m] })), help: 'Beim induktiven Sensor ändert das Material den Schaltabstand (Reduktionsfaktor): Stahl 1, Alu etwa 0,4, Kupfer etwa 0,3. Kunststoff und Wasser erkennt er nicht.' },
    { key: 'target', label: 'Zielfarbe (Reflex)', type: 'select', value: 'hell', group: 'Objekt', options: [{ value: 'hell', label: 'hell (weiß)' }, { value: 'dunkel', label: 'dunkel (schwarz)' }], help: 'Helle Objekte reflektieren viel Licht, dunkle kaum. Das ändert den Schaltabstand der Reflexlichtschranke.' },
    { key: 'rLoad', label: 'Lastwiderstand', type: 'slider', min: 100, max: 100000, step: 100, unit: 'Ω', value: 10000, scale: 'log', group: 'Schaltung', help: 'Arbeitswiderstand des Sensors. Bei Näherungsschaltern die Last am Ausgang: unter 110 Ω schaltet der Kurzschlussschutz bei 200 mA ein.' },
    { key: 'thresh', label: 'Schwelle (Komparator)', type: 'slider', min: 0, max: 5, step: 0.05, unit: 'V', value: 2.5, group: 'Schaltung', help: 'Spannung, bei der der Komparator umschaltet.' },
    { key: 'hyst', label: 'Hysterese', type: 'slider', min: 0, max: 2, step: 0.05, unit: 'V', value: 0.2, group: 'Schaltung', help: 'Abstand zwischen Einschalt- und Ausschaltschwelle. Ohne Hysterese flattert der Ausgang im Rauschen.' },
    { key: 'ambient', label: 'Fremdlicht', type: 'slider', min: 0, max: 50000, step: 10, unit: 'lx', value: 0, scale: 'log', group: 'Störung', help: 'Zusätzliches Licht aus dem Raum (flackert mit 100 Hz). Es verschiebt den Arbeitspunkt und kann den Sensor in die Sättigung treiben.' },
    { key: 'fdelay', label: 'Entprellzeit', type: 'slider', min: 0, max: 200, step: 1, unit: 'ms', value: 0, group: 'Schaltung', help: 'Der Ausgang schaltet erst, wenn der neue Zustand so lange anliegt. Das unterdrückt Flattern, macht aber träge.' }
  ];
  const METERS = [
    { key: 'uOut', label: 'Ausgangsspannung', unit: 'V', digits: 2, min: 0, max: 24 },
    { key: 'iOut', label: 'Ausgangs-/Sensorstrom', unit: 'mA', digits: 3, min: 0, max: 250, warnAbove: 200 },
    { key: 'state', label: 'Schaltzustand', unit: '', digits: 0, min: 0, max: 1 },
    { key: 'lux', label: 'Beleuchtung am Sensor', unit: 'lx', digits: 0, min: 0, max: 100000 },
    { key: 'switchDist', label: 'Schaltabstand', unit: 'mm', digits: 1, min: 0, max: 300 },
    { key: 'hystError', label: 'Schaltdifferenz (Hysterese)', unit: '%', digits: 1, min: 0, max: 50 },
    { key: 'flutter', label: 'Schaltspiele pro Sekunde', unit: '1/s', digits: 0, min: 0, max: 100, warnAbove: 5 }
  ];
  const PRESETS = [
    { id: 'ldr-hell', name: 'LDR im Büro (500 lx)', params: { sensor: 'ldr', lux: 500, rLoad: 10000, thresh: 2.5, hyst: 0.2, ambient: 0, fdelay: 0 } },
    { id: 'ldr-flatter', name: 'Flattern ohne Hysterese (LDR)', params: { sensor: 'ldr', lux: 10, rLoad: 10000, thresh: 2.5, hyst: 0, ambient: 0, fdelay: 0 } },
    { id: 'foto-saett', name: 'Fototransistor in der Sättigung', params: { sensor: 'fototransistor', lux: 20000, rLoad: 10000, thresh: 2.5, hyst: 0.2 } },
    { id: 'gabel', name: 'Gabellichtschranke mit Objekt', params: { sensor: 'gabel', dist: 30, thresh: 2.5, hyst: 0.2, ambient: 0 } },
    { id: 'gabel-fremd', name: 'Gabellichtschranke mit Fremdlicht', params: { sensor: 'gabel', dist: 30, thresh: 2.5, hyst: 0.2, ambient: 3000 } },
    { id: 'reflex-hell', name: 'Reflexlichtschranke, helles Objekt', params: { sensor: 'reflex', dist: 120, target: 'hell', thresh: 2.5, hyst: 0.2, ambient: 0 } },
    { id: 'reflex-dunkel', name: 'Reflexlichtschranke, dunkles Objekt', params: { sensor: 'reflex', dist: 40, target: 'dunkel', thresh: 2.5, hyst: 0.2, ambient: 0 } },
    { id: 'ind-stahl', name: 'Induktiv: Stahl bei 5 mm', params: { sensor: 'induktiv', material: 'stahl', dist: 5 } },
    { id: 'ind-alu', name: 'Induktiv: Alu bei 5 mm (zu weit)', params: { sensor: 'induktiv', material: 'alu', dist: 5 } },
    { id: 'kap-wasser', name: 'Kapazitiv: Wasser bei 8 mm', params: { sensor: 'kapazitiv', material: 'wasser', dist: 8 } },
    { id: 'ultraschall', name: 'Ultraschall-Abstand', params: { sensor: 'ultraschall', material: 'stahl', dist: 100 } }
  ];

  // ---- Modell ----
  const mapOf = id => SCENE[id] || null;
  function matF(c) { const s = SENS[c.sensor]; return s.F ? (s.F[c.material] || 0) : 1; }
  function srOf(c) { const s = SENS[c.sensor]; if (s.cls !== 'prox') return 0; const f = matF(c); return s.us ? (f > 0 ? s.Sn * Math.sqrt(f) : 0) : s.Sn * f; }
  // Lichtstaerke am Empfaenger; flick = Flackerfaktor des Fremdlichts
  function eOf(c, d, flick) {
    const amb = c.ambient * flick;
    if (c.sensor === 'gabel') { const blk = clamp((OBJ_W / 2 + BEAM_R - Math.abs(d - GAP_C)) / (2 * BEAM_R), 0, 1); return LED_GABEL * (1 - blk) + amb; }
    if (c.sensor === 'reflex') { const rho = ROH[c.target] || 0.9; return 3000 * rho / (1 + (d / 80) * (d / 80)) * (d < 5 ? d / 5 : 1) + amb; }
    return c.lux + amb;
  }
  // Spannung und Strom des Sensors bei Beleuchtung E; sat = Sensor am Anschlag
  function uOpt(c, E) {
    const s = SENS[c.sensor], vcc = s.vcc; let U, I, sat = false;
    if (c.sensor === 'ldr') { const R = clamp(10000 * Math.pow(10 / Math.max(E, 1e-6), 0.7), 100, 1e6); U = vcc * c.rLoad / (c.rLoad + R); I = vcc / (c.rLoad + R); sat = R <= 100.0001 || U >= vcc * 0.985; }
    else if (c.sensor === 'fotodiode') { I = 0.08e-6 * E + 2e-9; U = I * c.rLoad; if (U >= vcc) { U = vcc; I = vcc / c.rLoad; sat = true; } }
    else { const Ic = 0.4e-6 * E; U = vcc - Ic * c.rLoad; I = Ic; if (U <= 0.2) { U = 0.2; I = (vcc - 0.2) / c.rLoad; sat = true; } }
    return { U, I, sat };
  }
  const nz = t => (Math.sin(TWO_PI * 2371 * t + 1.3) + Math.sin(TWO_PI * 4817 * t + 0.2) + Math.sin(TWO_PI * 997 * t + 2.1)) / 3;
  const cmpOn = (c, U) => SENS[c.sensor].pol > 0 ? U > c.thresh + c.hyst / 2 : U < c.thresh - c.hyst / 2;
  const cmpOff = (c, U) => SENS[c.sensor].pol > 0 ? U < c.thresh - c.hyst / 2 : U > c.thresh + c.hyst / 2;
  function uStatic(c, d, withAmb) { const cc = withAmb ? c : Object.assign({}, c, { ambient: 0 }); return uOpt(cc, eOf(cc, d, 1)); }
  function findSwitch(c) {
    const s = SENS[c.sensor]; if (!s.beam) return 0;
    if (c.sensor === 'reflex') { for (let d = 300; d >= 0; d -= 1) if (cmpOn(c, uStatic(c, d, true).U)) return d; return 0; }
    for (let d = 0; d <= 300; d += 0.5) if (cmpOn(c, uStatic(c, d, true).U)) return d; return 0;
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const EV = mkEvents(), events = EV.events;
    let S;
    const ev = (text, kind, fx, x, y) => EV.ev(S, text, kind, fx, x, y);
    const ADCP = [800, 330], SENP = [150, 380];

    function cfg() { return { sensor: Cv.sensor, lux: Cv.lux, dist: Cv.dist, material: Cv.material, target: Cv.target, rLoad: Cv.rLoad, thresh: Cv.thresh, hyst: Cv.hyst, ambient: Cv.ambient, fdelay: Cv.fdelay }; }
    function resetState() {
      const c = cfg(), s = SENS[c.sensor];
      S = { t: 0, histAcc: 0, hist: [], state: 0, candT: 0, chg: [], flutter: 0, Uf: 0, If: 0, Un: 0, E: 0, sat: false, ovl: false, ambErr: false, sr: 0, sw: 0, last: 0,
        fl: { sat: false, flat: false, amb: false, ovl: false, mat: false }, matT: 0, uOut: 0, iOut: 0, echo: 0, noEcho: false };
      if (s.cls === 'opt') { const E = eOf(c, c.dist, 1), o = uOpt(c, E); S.Uf = o.U; S.If = o.I; S.E = E; S.Un = o.U; S.sat = o.sat; S.state = cmpOn(c, o.U) ? 1 : 0; }
      events.length = 0;
      S.sr = srOf(c); S.sw = s.cls === 'prox' ? S.sr : findSwitch(c);
      if (s.cls === 'prox') S.state = proxWant(c, 0) ? 1 : 0;
      S.uOut = outputs(c).u; S.iOut = outputs(c).i;
    }
    function proxWant(c, cur) { const sr = srOf(c), s = SENS[c.sensor]; if (!(sr > 0)) return false; if (s.us && c.dist < 20) return false; return cur ? c.dist < sr * 1.1 : c.dist <= sr; }
    function outputs(c) {
      const s = SENS[c.sensor];
      if (s.cls === 'opt') return { u: S ? S.Uf : 0, i: S ? S.If * 1000 : 0 };
      if (s.us) { const inR = c.dist >= 20 && c.dist <= 250 && matF(c) > 0; const u = inR ? 10 * c.dist / 250 : 10; return { u, i: u / c.rLoad * 1000 }; }
      let u = S && S.state ? s.vcc - V_RES : 0.2, i = u / c.rLoad;
      if (i > I_LIM) { i = I_LIM; u = I_LIM * c.rLoad; }
      return { u, i: i * 1000 };
    }
    function refreshStatic(c) {
      const s = SENS[c.sensor];
      S.sr = srOf(c);
      if (s.cls === 'opt') { S.sw = findSwitch(c); const a = uStatic(c, c.dist, true), b = uStatic(c, c.dist, false); S.ambErr = c.ambient > 0 && ((SENS[c.sensor].pol > 0 ? a.U > c.thresh : a.U < c.thresh) !== (SENS[c.sensor].pol > 0 ? b.U > c.thresh : b.U < c.thresh)); }
      else { S.sw = S.sr; S.ambErr = false; }
    }

    function sub(dt) {
      S.t += dt;
      const c = cfg(), s = SENS[c.sensor], tms = S.t * 1000;
      let want = S.state;
      if (s.cls === 'opt') {
        const E = eOf(c, c.dist, 1 + 0.2 * Math.sin(TWO_PI * 100 * S.t)), o = uOpt(c, E);
        const tau = c.sensor === 'ldr' ? (o.U > S.Uf ? 0.03 : 0.08) : c.sensor === 'fotodiode' ? 0.0005 : 0.005;
        const a = 1 - Math.exp(-dt / tau);
        S.Uf += (o.U - S.Uf) * a; S.If += (o.I - S.If) * a; S.E = E; S.sat = o.sat;
        S.Un = clamp(S.Uf + 0.015 * nz(S.t) * 1.7, 0, s.vcc);
        if (cmpOn(c, S.Un)) want = 1; else if (cmpOff(c, S.Un)) want = 0;
      } else {
        want = proxWant(c, S.state) ? 1 : 0; S.E = 0; S.sat = false; S.Un = S.uOut;
        if (s.us) { const x = c.dist; S.echo = 2 * x / 343; }
      }
      if (want !== S.state) { S.candT += dt * 1000; if (S.candT >= c.fdelay) { S.state = want; S.candT = 0; S.chg.push(S.t); onSwitch(c, s); } } else S.candT = 0;
      while (S.chg.length && S.t - S.chg[0] > 1) S.chg.shift();
      S.flutter = S.chg.length;
      const o2 = outputs(c); S.uOut = o2.u; S.iOut = o2.i;
      if (s.cls === 'opt') { S.uOut = S.Uf; }
      // Sensorgesamtzustand fuer Fehler
      S.ovl = s.cls === 'prox' && (s.us ? S.uOut / c.rLoad > I_LIM : (S.state === 1 && (s.vcc - V_RES) / c.rLoad > I_LIM));
      checkFaults(c, s, dt);
      S.histAcc += dt;
      if (S.histAcc >= 0.004) { S.histAcc = 0; S.hist.push([S.t, S.Un, S.state]); if (S.hist.length > 700) S.hist.shift(); }
    }
    function onSwitch(c, s) {
      if (S.chg.length > 3) return;
      const tx = s.cls === 'opt' ? (s.beam ? 'Objekt bei ' + fmt(c.dist, 1) + ' mm' : 'Beleuchtung ' + fmt(S.E, 0) + ' lx') : 'Abstand ' + fmt(c.dist, 1) + ' mm, Schaltabstand ' + fmt(srOf(c), 1) + ' mm';
      ev('Der Sensor schaltet ' + (S.state ? 'EIN' : 'AUS') + ' (' + tx + ').', 'info');
    }
    function checkFaults(c, s, dt) {
      const fl = S.fl;
      if (s.cls === 'opt') {
        if (S.sat && !fl.sat) { fl.sat = true; ev('Sättigung: Der Sensor ist am Anschlag (' + fmt(S.Uf, 2) + ' V bei ' + fmt(S.E, 0) + ' lx). Mehr Licht ändert das Signal nicht mehr, kleinere Rlast oder weniger Licht hilft.', 'warn', 'stall', ADCP[0], ADCP[1]); }
        else if (!S.sat && fl.sat && S.t > 0) fl.sat = false;
        if (S.flutter >= 6 && !fl.flat) { fl.flat = true; ev('Flattern! Die Spannung liegt im Rauschen der Schwelle, der Komparator schaltet ' + S.flutter + '-mal pro Sekunde. Erhöhe die Hysterese oder die Entprellzeit.', 'warn', 'stall', 810, 190); }
        else if (S.flutter <= 1 && fl.flat) fl.flat = false;
        if (c.ambient > 0 && S.ambErr && !fl.amb) { fl.amb = true; ev('Fremdlicht stört: ' + fmt(c.ambient, 0) + ' lx zusätzliches Licht verschieben den Arbeitspunkt. Der Sensor erkennt das Objekt nicht mehr richtig. Schatte den Sensor ab oder hebe die Schwelle an.', 'warn', 'stall', SENP[0], SENP[1]); }
        else if (!S.ambErr && fl.amb) fl.amb = false;
      } else {
        if (S.ovl && !fl.ovl) { fl.ovl = true; ev('Kurzschlussschutz! Der Laststrom wäre größer als 200 mA (Rlast = ' + fmt(c.rLoad, 0) + ' Ω). Der Ausgang begrenzt den Strom und die Spannung bricht ein.', 'error', 'shoot', 300, 380); }
        else if (!S.ovl && fl.ovl) fl.ovl = false;
        if (srOf(c) <= 0 && c.dist < 12) { S.matT += dt; if (S.matT > 0.4 && !fl.mat) { fl.mat = true; ev(MATLAB[c.material] + ' wird vom ' + s.short + 'en Sensor nicht erkannt (Reduktionsfaktor 0). Wähle ein anderes Material.', 'warn'); } }
        else { S.matT = 0; if (srOf(c) > 0) fl.mat = false; }
      }
    }
    function stepCore(dtMs) { let rem = dtMs; refreshStatic(cfg()); while (rem > 1e-9) { const d = Math.min(rem, 1); rem -= d; sub(d / 1000); } }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      const old = Cv[key], v = coerce(d, value, ALIAS[key], old);
      Cv[key] = v;
      if (key === 'sensor' && old !== v) { Cv.dist = DIST0[v] != null ? DIST0[v] : 20; S.state = 0; S.chg.length = 0; S.fl = { sat: false, flat: false, amb: false, ovl: false, mat: false }; settle(); }
      else if (S && key !== 'wait') settle(true);
    }
    // nach einer Aenderung die Zustaende neu setzen, damit die Anzeige sofort stimmt
    function settle(soft) {
      const c = cfg(), s = SENS[c.sensor];
      refreshStatic(c);
      if (s.cls === 'opt') { if (!soft) { const o = uOpt(c, eOf(c, c.dist, 1)); S.Uf = o.U; S.If = o.I; S.state = cmpOn(c, o.U) ? 1 : 0; } }
      else if (!soft) S.state = proxWant(c, 0) ? 1 : 0;
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      if (p.params.sensor != null) setControl('sensor', p.params.sensor);
      Object.keys(p.params).forEach(k => { if (k !== 'sensor') setControl(k, p.params[k]); });
      return true;
    }

    function hystPct(c) { const s = SENS[c.sensor]; return s.cls === 'prox' ? (srOf(c) > 0 ? 10 : 0) : c.hyst / s.vcc * 100; }
    function readMeters() {
      const c = cfg(); const s = SENS[c.sensor];
      return { uOut: S.uOut, iOut: S.iOut, state: S.state, lux: S.E, switchDist: S.sw, hystError: hystPct(c), flutter: S.flutter };
    }
    // Zeiten und Frequenzen in ms bzw. Hz (siehe F_NOM), Montage-Auswertung nur fuer Naeherungsschalter
    function timing(c, s) {
      const fNom = F_NOM[c.sensor], prox = s.cls === 'prox';
      const tSens = prox ? 500 / fNom + (s.us ? S.echo : 0) : Math.LN2 * TAU_MAX[c.sensor] * 1000;
      const tResp = tSens + Math.max(0, c.fdelay);
      return { tSens, tResp, fNom, fMax: Math.min(fNom, tResp > 0 ? 500 / tResp : fNom) };
    }
    function mount(c, s) {
      if (s.cls !== 'prox') return { sn: 0, mountMin: 0, mountMax: 0, mountOk: false, mountReserve: 0 };
      const sr = srOf(c), min = 0.1 * s.Sn, max = 0.8 * sr;
      return { sn: s.Sn, mountMin: min, mountMax: max, mountOk: sr > 0 && c.dist >= min - 1e-9 && c.dist <= max + 1e-9, mountReserve: sr > 0 ? 1 - c.dist / sr : 0 };
    }
    function state() {
      const c = cfg(), s = SENS[c.sensor], faults = [];
      if (s.cls === 'opt' && S.sat) faults.push('saturation');
      if (S.flutter >= 6) faults.push('flutter');
      if (S.ambErr) faults.push('ambient');
      if (S.ovl) faults.push('overload');
      if (s.cls === 'prox' && srOf(c) <= 0) faults.push('material');
      const tm = timing(c, s);
      return { sensor: c.sensor, cls: s.cls, uOut: S.uOut, uNoisy: S.Un, iOut: S.iOut, state: S.state, switched: S.state === 1, lux: S.E, dist: c.dist, switchDist: S.sw, switchOn: s.cls === 'prox' ? srOf(c) : S.sw,
        switchOff: s.cls === 'prox' ? srOf(c) * 1.1 : 0, reduction: matF(c), hystError: hystPct(c), flutter: S.flutter, saturated: !!S.sat, overload: !!S.ovl, ambientError: !!S.ambErr, material: c.material,
        echoMs: S.echo, vcc: s.vcc, faults, fault: faults.length > 0, t: S.t * 1000,
        tSens: tm.tSens, tResp: tm.tResp, fNom: tm.fNom, fMax: tm.fMax, ...mount(c, s),
        iSupplyMa: s.cls === 'prox' ? I_Q_PROX + (S.state ? S.iOut : 0) : S.If * 1000 };
    }

    // ---- Kennlinien ----
    function curves() {
      const c = cfg(), s = SENS[c.sensor], out = [];
      if (s.cls === 'opt') {
        const a = [], b = [], th = [];
        if (s.beam) {
          for (let d = 0; d <= 300; d += 2) { a.push([d, uStatic(c, d, false).U]); b.push([d, uStatic(c, d, true).U]); th.push([d, c.thresh]); }
          out.push({ id: 'ue', title: s.short + ': Ausgangsspannung über dem Objektabstand', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'ohne Fremdlicht', points: a }, { name: 'mit Fremdlicht', points: b }, { name: 'Schwelle', points: th }], marker: { x: c.dist, y: uStatic(c, c.dist, true).U } });
        } else {
          for (let k = 0; k <= 48; k++) { const E = Math.pow(10, -1 + 6 * k / 48); a.push([E, uOpt(c, E).U]); b.push([E, uOpt(c, E + c.ambient).U]); th.push([E, c.thresh]); }
          out.push({ id: 'ue', title: s.short + ': Ausgangsspannung über der Beleuchtung', xLabel: 'Beleuchtungsstärke', xUnit: 'lx', yLabel: 'Spannung', yUnit: 'V', xLog: true, series: [{ name: 'ohne Fremdlicht', points: a }, { name: 'mit Fremdlicht', points: b }, { name: 'Schwelle', points: th }], marker: { x: c.lux, y: uOpt(c, c.lux + c.ambient).U } });
        }
        const vcc = s.vcc, lo = c.thresh - c.hyst / 2, hi = c.thresh + c.hyst / 2, up = [], dn = [];
        const p = s.pol > 0;
        up.push([0, p ? 0 : 1], [p ? hi : lo, p ? 0 : 1], [p ? hi : lo, p ? 1 : 0], [vcc, p ? 1 : 0]);
        dn.push([0, p ? 0 : 1], [p ? lo : hi, p ? 0 : 1], [p ? lo : hi, p ? 1 : 0], [vcc, p ? 1 : 0]);
        out.push({ id: 'hyst', title: 'Komparator mit Hysterese', xLabel: 'Eingangsspannung', xUnit: 'V', yLabel: 'Schaltzustand', yUnit: '', series: [{ name: 'Spannung steigt', points: up }, { name: 'Spannung fällt', points: dn }], marker: { x: S.uOut, y: S.state } });
      } else if (s.us) {
        const a = []; for (let d = 0; d <= 300; d += 5) a.push([d, d >= 20 && d <= 250 && matF(c) > 0 ? 10 * d / 250 : 10]);
        const sr = srOf(c);
        out.push({ id: 'uabst', title: 'Ultraschall: Analogausgang über dem Abstand', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'Ausgang 0…10 V', points: a }], marker: { x: c.dist, y: outputs(c).u } });
        out.push({ id: 'schalt', title: 'Schaltverhalten über dem Abstand', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Schaltzustand', yUnit: '', series: [{ name: 'Annäherung', points: [[0, 0], [20, 0], [20.001, sr > 0 ? 1 : 0], [Math.max(sr, 20.01), sr > 0 ? 1 : 0], [Math.max(sr, 20.01), 0], [300, 0]] }, { name: 'Entfernen', points: [[0, 0], [20, 0], [20.001, sr > 0 ? 1 : 0], [sr * 1.1 + 0.001, sr > 0 ? 1 : 0], [sr * 1.1 + 0.002, 0], [300, 0]] }], marker: { x: c.dist, y: S.state } });
      } else {
        const sr = srOf(c), xm = Math.max(10, s.Sn * 2.4);
        out.push({ id: 'schalt', title: 'Schaltverhalten über dem Abstand', xLabel: 'Abstand', xUnit: 'mm', yLabel: 'Schaltzustand', yUnit: '', series: [{ name: 'Annäherung (EIN bei Sr)', points: [[0, sr > 0 ? 1 : 0], [sr, sr > 0 ? 1 : 0], [sr + 0.001, 0], [xm, 0]] }, { name: 'Entfernen (AUS bei 1,1·Sr)', points: [[0, sr > 0 ? 1 : 0], [sr * 1.1, sr > 0 ? 1 : 0], [sr * 1.1 + 0.001, 0], [xm, 0]] }], marker: { x: Math.min(c.dist, xm), y: S.state } });
        out.push({ id: 'faktor', title: 'Schaltabstand je Material (Reduktionsfaktor)', xLabel: 'Material (1 Stahl, 2 Alu, 3 Kupfer, 4 Kunststoff, 5 Wasser)', xUnit: '', yLabel: 'Schaltabstand', yUnit: 'mm', series: [{ name: 'Sr', points: MATS.map((m, i) => [i + 1, s.Sn * (s.F[m] || 0)]) }], marker: { x: MATS.indexOf(c.material) + 1, y: sr } });
      }
      return out;
    }

    // ================= Zeichnen =================
    const SC = () => SCENE[Cv.sensor] || { x0: 150, k: 1 };
    const xOf = d => { const m = SC(); return clamp(m.x0 + d * m.k, m.x0, 486); };
    function lamp(ctx, t, x, y, f, big) {
      const g = ctx.createRadialGradient(x, y, 4, x, y, 20 + 70 * f); g.addColorStop(0, 'rgba(255,240,180,' + (0.25 + 0.6 * f) + ')'); g.addColorStop(1, 'rgba(255,210,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 20 + 70 * f, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#4a5560'; rr(ctx, x - 12, y - 40, 24, 16, 3); ctx.fill();
      ctx.fillStyle = rgba(mix([90, 85, 70], [255, 245, 190], f), 1); ctx.beginPath(); ctx.arc(x, y - 6, 22, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = rgba(mix([120, 100, 70], [255, 255, 255], f), 1); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 7, y - 24); ctx.lineTo(x - 5, y - 4); ctx.lineTo(x, y - 14); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x + 7, y - 24); ctx.stroke();
    }
    function drawLampScene(ctx, t) {
      panel(ctx, 14, 134, 506, 412, 'MESSGRÖSSE  Licht auf dem Sensor');
      const f = clamp(Math.log10(Cv.lux + 0.1) / 5.1 + 0.02, 0, 1), sx = 260, sy = 470;
      // Fremdlicht
      if (Cv.ambient > 0) {
        const fa = clamp(Math.log10(Cv.ambient + 1) / 4.7, 0, 1), fk = 0.75 + 0.25 * Math.sin(t / 16);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.09 * fa * fk) + ')'; rr(ctx, 14, 134, 506, 412, 12); ctx.fill();
        ctx.fillStyle = '#3a444e'; rr(ctx, 40, 168, 70, 14, 4); ctx.fill(); ctx.fillStyle = rgba([255, 255, 255], 0.25 + 0.7 * fa * fk); rr(ctx, 44, 171, 62, 8, 3); ctx.fill();
        txt(ctx, 'Fremdlicht ' + eng(Cv.ambient, 'lx', 3), 75, 196, 11.5, '#e8ecef', 'center', true);
        for (let k = 0; k < 5; k++) { const a0 = k * 0.12 - 0.1; ctx.strokeStyle = 'rgba(255,255,230,' + (0.12 * fa * fk) + ')'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(75 + k * 12, 184); ctx.lineTo(sx - 60 + k * 30, sy - 40); ctx.stroke(); }
      }
      // Lampe und Strahl
      const lyy = 214;
      if (f > 0.02) {
        const gg = ctx.createLinearGradient(0, lyy + 30, 0, sy - 30); gg.addColorStop(0, 'rgba(255,238,160,' + (0.08 + 0.5 * f) + ')'); gg.addColorStop(1, 'rgba(255,238,160,' + (0.04 + 0.3 * f) + ')');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(sx - 26, lyy + 24); ctx.lineTo(sx + 26, lyy + 24); ctx.lineTo(sx + 70, sy - 36); ctx.lineTo(sx - 70, sy - 36); ctx.closePath(); ctx.fill();
        const n = 6 + Math.floor(14 * f);
        for (let k = 0; k < n; k++) { const ph = fr(t / (1100 - 500 * f) + k / n), xx = sx + (rnd(k + 1) - 0.5) * (52 + 88 * ph), yy = lyy + 26 + ph * (sy - lyy - 62); ctx.fillStyle = 'rgba(255,248,200,' + (0.9 * (1 - ph * 0.3)) + ')'; ctx.beginPath(); ctx.arc(xx, yy, 2.2, 0, TWO_PI); ctx.fill(); }
      }
      lamp(ctx, t, sx, lyy, f);
      txt(ctx, 'Lampe', sx + 38, lyy - 20, 11, C.dim, 'left', true);
      // Sensor
      ctx.fillStyle = '#0f3a2a'; rr(ctx, sx - 90, sy - 8, 180, 40, 6); ctx.fill(); ctx.strokeStyle = '#082418'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#c7a24b'; [-60, -40, 40, 60].forEach(d => { ctx.beginPath(); ctx.arc(sx + d, sy + 24, 3, 0, TWO_PI); ctx.fill(); });
      const sat = S.sat && Math.floor(t / 250) % 2 === 0;
      if (Cv.sensor === 'ldr') {
        ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.arc(sx, sy - 14, 36, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#b88a52'; ctx.beginPath(); ctx.arc(sx, sy - 14, 28, 0, TWO_PI); ctx.fill();
        ctx.strokeStyle = '#4b3a28'; ctx.lineWidth = 3.2; ctx.beginPath(); for (let k = -3; k <= 3; k++) { ctx.moveTo(sx - 20, sy - 14 + k * 6); ctx.lineTo(sx + 20, sy - 14 + k * 6); if (k < 3) { ctx.lineTo(sx + 20 * (k % 2 ? -1 : 1) * -1, sy - 14 + k * 6 + 6); } } ctx.stroke();
        ctx.strokeStyle = '#c4ccd4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 10, sy + 20); ctx.lineTo(sx - 10, sy + 30); ctx.moveTo(sx + 10, sy + 20); ctx.lineTo(sx + 10, sy + 30); ctx.stroke();
        txt(ctx, 'LDR', sx, sy - 14, 11, '#2a1c0c', 'center', true);
      } else if (Cv.sensor === 'fotodiode') {
        ctx.fillStyle = 'rgba(120,170,255,0.4)'; rr(ctx, sx - 34, sy - 46, 68, 62, 6); ctx.fill(); ctx.strokeStyle = '#7fb0ff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#10151a'; rr(ctx, sx - 18, sy - 32, 36, 32, 3); ctx.fill(); ctx.strokeStyle = '#3a6fd0'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sx - 18, sy - 28 + k * 8); ctx.lineTo(sx + 18, sy - 28 + k * 8); ctx.stroke(); }
        txt(ctx, 'Fotodiode', sx, sy + 8, 10.5, '#bcd4ff', 'center', true);
      } else {
        ctx.fillStyle = 'rgba(40,46,54,0.95)'; ctx.beginPath(); ctx.arc(sx, sy - 12, 30, Math.PI, 0); ctx.lineTo(sx + 30, sy + 12); ctx.lineTo(sx - 30, sy + 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0c0f12'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = 'rgba(190,210,255,0.35)'; ctx.beginPath(); ctx.ellipse(sx - 8, sy - 26, 9, 6, -0.5, 0, TWO_PI); ctx.fill();
        txt(ctx, 'Fototransistor', sx, sy + 2, 10, '#cfd8e0', 'center', true);
      }
      if (sat) { ctx.strokeStyle = C.bad; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy - 12, 48, 0, TWO_PI); ctx.stroke(); }
      // Luxmeter
      ctx.fillStyle = '#2d343b'; rr(ctx, 380, 360, 120, 100, 10); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#08120c'; rr(ctx, 390, 372, 100, 38, 5); ctx.fill();
      txt(ctx, eng(S.E, '', 3).trim(), 480, 391, 17, '#8dffa0', 'right', true, MONO); txt(ctx, 'LUX-METER', 440, 428, 10.5, C.dim, 'center', true); txt(ctx, 'lx', 482, 404, 9, '#5fbf78', 'right', true);
      ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.arc(440, 446, 5, 0, TWO_PI); ctx.fill();
      txt(ctx, Cv.lux < 1 ? 'dunkel' : Cv.lux < 100 ? 'Dämmerung' : Cv.lux < 2000 ? 'Zimmer' : Cv.lux < 20000 ? 'Tageslicht' : 'Sonne', 150, 330, 14, C.dim, 'center', true);
      sensorTag(ctx, sx, sy + 46);
    }
    function sensorTag(ctx, x, y) {
      const s = SENS[Cv.sensor];
      txt(ctx, s.short, x, y + 14, 12, C.text, 'center', true);
    }
    function ruler(ctx, y, x0, k, step, maxMM, lab) {
      ctx.strokeStyle = '#6a7480'; ctx.lineWidth = 1.2; line(ctx, [[x0, y], [Math.min(486, x0 + maxMM * k), y]], '#6a7480', 1.4);
      for (let d = 0; d <= maxMM + 1e-6; d += step) { const x = x0 + d * k; if (x > 490) break; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (d % (step * 2) === 0 ? 9 : 6)); ctx.stroke(); if (d % (step * 2) === 0) txt(ctx, d, x, y + 20, 10, C.dim, 'center'); }
      txt(ctx, lab || 'mm', 506, y + 20, 10, C.dim, 'right');
    }
    function drawObject(ctx, t, x, y, h, w) {
      const m = Cv.material, tg = Cv.target, s = Cv.sensor;
      if (s === 'reflex') { ctx.fillStyle = tg === 'hell' ? '#f3f5f7' : '#25292d'; rr(ctx, x, y - h / 2, w, h, 4); ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.stroke(); if (tg === 'dunkel') { ctx.strokeStyle = '#3a4047'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + 3, y - h / 2 + 8 + k * 14); ctx.lineTo(x + w - 3, y - h / 2 + 4 + k * 14); ctx.stroke(); } } return; }
      if (s === 'gabel') { ctx.fillStyle = '#e4b04a'; rr(ctx, x, y - h / 2, w, h, 4); ctx.fill(); ctx.strokeStyle = '#7a5c18'; ctx.lineWidth = 2; ctx.stroke(); return; }
      if (m === 'wasser') { ctx.fillStyle = 'rgba(190,220,255,0.35)'; rr(ctx, x, y - h / 2, w + 18, h, 6); ctx.fill(); ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = 'rgba(70,150,255,0.8)'; rr(ctx, x + 4, y - h / 2 + 18, w + 10, h - 22, 4); ctx.fill(); for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x + 12 + k * 6, y - h / 2 + 30 + ((t / 30 + k * 20) % 50) , 2, 0, TWO_PI); ctx.stroke(); } return; }
      if (m === 'kunststoff') { ctx.fillStyle = '#f08a3c'; rr(ctx, x, y - h / 2, w + 10, h, 6); ctx.fill(); ctx.strokeStyle = '#8a4310'; ctx.lineWidth = 2.5; ctx.stroke(); txt(ctx, 'PVC', x + (w + 10) / 2, y, 11, '#5a2a08', 'center', true); return; }
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      if (m === 'stahl') { g.addColorStop(0, '#6c7782'); g.addColorStop(0.5, '#d4dbe2'); g.addColorStop(1, '#6c7782'); }
      else if (m === 'alu') { g.addColorStop(0, '#9aa4ad'); g.addColorStop(0.5, '#eef2f5'); g.addColorStop(1, '#9aa4ad'); }
      else { g.addColorStop(0, '#9c4d28'); g.addColorStop(0.5, '#ee9a6a'); g.addColorStop(1, '#9c4d28'); }
      ctx.fillStyle = g; rr(ctx, x, y - h / 2, w, h, 3); ctx.fill(); ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 2; ctx.stroke();
      if (w >= 30) txt(ctx, MATLAB[m], x + w / 2, y, 10, '#1a2026', 'center', true);
    }
    function drawRailScene(ctx, t) {
      const id = Cv.sensor, m = SC(), c = cfg(), sr = srOf(c);
      panel(ctx, 14, 134, 506, 412, id === 'gabel' ? 'MESSGRÖSSE  Objekt in der Lichtschranke' : 'MESSGRÖSSE  Objekt vor dem Sensor');
      const yR = 380, ox = xOf(Cv.dist), far = m.x0 + Cv.dist * m.k > 486;
      // Fuehrungsschiene
      ctx.fillStyle = '#2d343b'; rr(ctx, 24, yR + 60, 480, 12, 4); ctx.fill();
      const rulerStep = id === 'induktiv' ? 2 : id === 'kapazitiv' ? 5 : id === 'gabel' ? 10 : 50, maxMM = id === 'induktiv' ? 24 : id === 'kapazitiv' ? 40 : id === 'gabel' ? 90 : 300;
      ruler(ctx, yR + 84, m.x0, m.k, rulerStep, maxMM);
      txt(ctx, 'Abstand ' + fmt(Cv.dist, 1) + ' mm', 30, 168, 16, C.text, 'left', true, MONO);
      const INFO = { induktiv: ['Eine Spule erzeugt ein hochfrequentes Wechselfeld. Metall im Feld', 'bedämpft den Schwingkreis, die Auswertung schaltet den Ausgang.'], kapazitiv: ['Elektrode und Umgebung bilden einen Kondensator. Jedes Objekt in der', 'Nähe ändert die Kapazität und löst die Schaltung aus.'], gabel: ['Eine LED strahlt auf den Fototransistor. Ein Objekt im Strahl', 'unterbricht das Licht, der Komparator schaltet.'], reflex: ['Sender und Empfänger sitzen im selben Gehäuse. Das Objekt wirft', 'Licht zurück, helle Objekte stärker als dunkle.'], ultraschall: ['Der Wandler sendet einen Schallimpuls und wartet auf das Echo.', 'Aus der Laufzeit folgt der Abstand: d = c·t/2.'] };
      (INFO[id] || []).forEach((l, i) => txt(ctx, l, 30, 236 + i * 16, 11.5, C.dim, 'left'));
      if (id === 'induktiv' || id === 'kapazitiv') {
        const ind = id === 'induktiv', x0 = m.x0, k = m.k, f = S.state ? 1 : 0;
        // Sensorgehaeuse
        const g = ctx.createLinearGradient(0, yR - 44, 0, yR + 44); g.addColorStop(0, '#9aa5b0'); g.addColorStop(0.5, '#e0e6ec'); g.addColorStop(1, '#7c8791');
        ctx.fillStyle = g; rr(ctx, 40, yR - 44, x0 - 40, 88, 6); ctx.fill(); ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 2.5; ctx.stroke();
        for (let q = 0; q < 6; q++) { ctx.strokeStyle = 'rgba(40,50,60,0.4)'; ctx.beginPath(); ctx.moveTo(52 + q * 12, yR - 44); ctx.lineTo(52 + q * 12, yR + 44); ctx.stroke(); }
        ctx.fillStyle = f ? '#4cd964' : '#274a31'; ctx.beginPath(); ctx.arc(60, yR - 56, 6, 0, TWO_PI); ctx.fill(); txt(ctx, 'LED', 78, yR - 56, 10, C.dim, 'left');
        ctx.fillStyle = ind ? '#c07a28' : '#b5c0ca'; ctx.beginPath(); ctx.ellipse(x0, yR, 9, 38, 0, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, ind ? 'Spule' : 'Elektrode', x0 - 14, yR - 54, 10, C.dim, 'right');
        // Schaltabstand-Zone
        if (sr > 0) {
          const xs = x0 + sr * k, xh = x0 + sr * 1.1 * k;
          ctx.fillStyle = 'rgba(76,217,100,0.16)'; ctx.beginPath(); ctx.moveTo(x0, yR - 50); ctx.lineTo(xs, yR - 50); ctx.lineTo(xs, yR + 50); ctx.lineTo(x0, yR + 50); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,179,64,0.2)'; ctx.fillRect(xs, yR - 50, xh - xs, 100);
          ctx.strokeStyle = C.ok; ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xs, yR - 92); ctx.lineTo(xs, yR + 58); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
          txt(ctx, 'Sr = ' + fmt(sr, 1) + ' mm', xs, yR - 100, 12.5, C.ok, 'center', true);
          txt(ctx, 'Material-Faktor ' + fmt(matF(c), 2), xs, yR - 114, 10.5, C.dim, 'center');
        } else txt(ctx, 'Sr = 0: ' + MATLAB[Cv.material] + ' wird nicht erkannt', x0 + 20, yR - 70, 12, C.bad, 'left', true);
        // Feldlinien
        const reach = Math.max(sr * 1.1, 4) * k + 14;
        for (let q = 1; q <= 4; q++) {
          const wob = Math.sin(t / 400 - q) * 2, rr1 = reach * q / 4;
          ctx.strokeStyle = ind ? 'rgba(90,170,255,' + (0.5 - q * 0.08) + ')' : 'rgba(255,200,120,' + (0.5 - q * 0.08) + ')'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.ellipse(x0, yR, rr1 + wob, 14 + q * 11, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        }
        // Objekt
        const w = ind ? 22 : 34, inField = Cv.dist < sr * 1.1 + 0.5;
        drawObject(ctx, t, ox, yR, 104, w);
        if (ind && sr > 0 && inField && (Cv.material === 'stahl' || Cv.material === 'alu' || Cv.material === 'kupfer')) { for (let q = 0; q < 3; q++) { const a = t / 300 + q * 2.1; ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + 6, yR - 28 + q * 28, 8, a, a + 4.2); ctx.stroke(); } txt(ctx, 'Wirbelströme', ox + 20, yR - 66, 10.5, '#ffe08a', 'left', true); }
        if (far) txt(ctx, '››› ' + fmt(Cv.dist, 0) + ' mm', 480, yR - 100, 12, C.dim, 'right', true);
      } else if (id === 'gabel') {
        const xc = m.x0 + GAP_C * m.k, bw = 70 + 40, gap = 25 * m.k;
        const g = ctx.createLinearGradient(0, yR - 130, 0, yR + 70); g.addColorStop(0, '#3b434b'); g.addColorStop(1, '#222a31');
        ctx.fillStyle = g; rr(ctx, xc - gap / 2 - 6, yR - 150, gap + 70, 30, 6); ctx.fill(); rr(ctx, xc - gap / 2 - 6, yR + 28, gap + 70, 30, 6); ctx.fill(); rr(ctx, xc + gap / 2 + 24, yR - 150, 40, 208, 6); ctx.fill();
        ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2; rr(ctx, xc + gap / 2 + 24, yR - 150, 40, 208, 6); ctx.stroke();
        ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.arc(xc, yR - 118, 7, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(xc, yR + 36, 7, 0, TWO_PI); ctx.fill();
        txt(ctx, 'LED', xc + 16, yR - 130, 10, C.dim, 'left', true); txt(ctx, 'Fototransistor', xc + 16, yR + 50, 10, C.dim, 'left', true);
        const blk = clamp((OBJ_W / 2 + BEAM_R - Math.abs(Cv.dist - GAP_C)) / (2 * BEAM_R), 0, 1);
        const yb = yR - 118 + (yR + 36 - (yR - 118)) * (blk > 0.5 ? 0.35 : 1);
        ctx.strokeStyle = 'rgba(255,90,90,' + (0.9 * (1 - blk * 0.6)) + ')'; ctx.lineWidth = 3; ctx.setLineDash && ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(xc, yR - 112); ctx.lineTo(xc, blk > 0.5 ? yR - 40 : yR + 30); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
        polyDots(ctx, [[xc, yR - 112], [xc, blk > 0.5 ? yR - 40 : yR + 30]], t, 90, 'rgba(255,200,200,0.95)', 16, 2.4);
        if (S.E - Cv.ambient * 1 > 0 && Cv.ambient > 0) { ctx.fillStyle = 'rgba(255,255,220,' + clamp(Math.log10(Cv.ambient + 1) / 5, 0, 0.5) + ')'; ctx.fillRect(xc - gap / 2, yR - 118, gap, 154); }
        ctx.fillStyle = '#2d343b'; rr(ctx, 24, yR + 60, 480, 12, 4); ctx.fill();
        const ox2 = m.x0 + Cv.dist * m.k - OBJ_W * m.k / 2;
        drawObject(ctx, t, clamp(ox2, 26, 470), yR - 40, 90, OBJ_W * m.k);
        if (Cv.ambient > 0) txt(ctx, 'Fremdlicht ' + eng(Cv.ambient, 'lx', 3), 30, 192, 12, C.warn, 'left', true);
        if (far) txt(ctx, '››› ' + fmt(Cv.dist, 0) + ' mm', 480, yR - 100, 12, C.dim, 'right', true);
      } else if (id === 'reflex') {
        const x0 = m.x0;
        ctx.fillStyle = '#2f3840'; rr(ctx, 40, yR - 50, x0 - 40, 100, 8); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.arc(x0 - 8, yR - 18, 10, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(x0 - 8, yR + 20, 10, 0, TWO_PI); ctx.fill();
        txt(ctx, 'LED', x0 - 30, yR - 18, 10, C.dim, 'right', true); txt(ctx, 'Empfänger', x0 - 30, yR + 20, 10, C.dim, 'right', true);
        const f = clamp((S.E - Cv.ambient) / 1500, 0, 1);
        const xo = xOf(Cv.dist), w = 18;
        ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = 3; ctx.setLineDash && ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(x0, yR - 18); ctx.lineTo(xo, yR - 18); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
        polyDots(ctx, [[x0, yR - 18], [xo, yR - 18]], t, 110, 'rgba(255,190,190,0.95)', 22, 2.4);
        for (let q = 0; q < 5; q++) { ctx.strokeStyle = 'rgba(255,170,170,' + (0.12 + 0.75 * f) * (1 - q * 0.12) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xo, yR - 18 + (q - 2) * 2); ctx.lineTo(x0 + 6, yR + 14 + q * 3); ctx.stroke(); }
        polyDots(ctx, [[xo, yR - 18], [x0 + 6, yR + 18]], t, 110 * f, 'rgba(255,200,200,0.95)', 26, 2.2);
        drawObject(ctx, t, xo, yR, 120, w);
        txt(ctx, 'Reflexion ' + fmt(f * 100, 0) + ' %', 30, 192, 12, f > 0.1 ? C.ok : C.dim, 'left', true);
        if (Cv.ambient > 0) { ctx.fillStyle = 'rgba(255,255,220,' + clamp(Math.log10(Cv.ambient + 1) / 6, 0, 0.35) + ')'; rr(ctx, 14, 134, 506, 412, 12); ctx.fill(); txt(ctx, 'Fremdlicht ' + eng(Cv.ambient, 'lx', 3), 30, 210, 12, C.warn, 'left', true); }
        if (far) txt(ctx, '››› ' + fmt(Cv.dist, 0) + ' mm', 480, yR - 100, 12, C.dim, 'right', true);
      } else {
        const x0 = m.x0, xo = xOf(Cv.dist), sr1 = srOf(c);
        ctx.fillStyle = '#2f3840'; rr(ctx, 40, yR - 56, x0 - 40, 112, 10); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
        const g = ctx.createRadialGradient(x0 - 14, yR, 4, x0 - 14, yR, 40); g.addColorStop(0, '#d9e0e6'); g.addColorStop(1, '#6c7782'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x0 - 10, yR, 14, 42, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
        txt(ctx, 'Schallwandler', 90, yR - 70, 10.5, C.dim, 'center', true);
        const speed = 160, tt = (t / 1000) * speed, L = Math.max(10, xo - x0 - 14), per = 2 * L + 40;
        for (let q = 0; q < 6; q++) {
          const p = (tt + q * 30) % (per + 80); let xw, a;
          if (p < L) { xw = x0 + p; a = 1 - p / L * 0.4; } else if (p < 2 * L) { xw = xo - (p - L); a = 0.6 - (p - L) / L * 0.4; } else continue;
          ctx.strokeStyle = (p < L ? 'rgba(90,170,255,' : 'rgba(255,200,100,') + a + ')'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(xw, yR, 24 + 10 * (p < L ? p / L : 1), p < L ? -0.9 : Math.PI - 0.9, p < L ? 0.9 : Math.PI + 0.9); ctx.stroke();
        }
        if (sr1 > 0 && Cv.dist >= 0) { const xs = x0 + sr1 * m.k; ctx.strokeStyle = C.ok; ctx.lineWidth = 2; ctx.setLineDash && ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xs, yR - 80); ctx.lineTo(xs, yR + 80); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]); txt(ctx, 'Sr = ' + fmt(sr1, 0) + ' mm', xs, yR - 92, 12, C.ok, 'center', true); }
        drawObject(ctx, t, xo, yR, 130, 18);
        txt(ctx, 'Laufzeit t = 2·d/c = ' + fmt(S.echo, 3) + ' ms', 30, 192, 13, '#ffd27a', 'left', true, MONO);
        txt(ctx, 'c = 343 m/s (Schall in Luft)', 30, 210, 11, C.dim, 'left');
        if (far) txt(ctx, '››› ' + fmt(Cv.dist, 0) + ' mm', 480, yR - 110, 12, C.dim, 'right', true);
      }
    }
    function drawSchem(ctx, t) {
      const ox = 548, oy = 250, c = cfg(), s = SENS[c.sensor], wire = '#8b98a5';
      panel(ctx, ox - 12, oy, 450, 174, 'SCHALTUNG  ' + (s.cls === 'opt' ? 'Sensor, Arbeitswiderstand, Komparator' : 'Näherungsschalter, PNP-Ausgang'));
      const on = S.state === 1;
      if (s.cls === 'opt') {
        // Versorgung, Sensor, Rlast
        line(ctx, [[ox + 30, oy + 30], [ox + 120, oy + 30]], wire, 2); txt(ctx, '+' + s.vcc + ' V', ox + 4, oy + 30, 12, C.ok, 'left', true);
        const ldr = c.sensor === 'ldr', trans = !ldr && c.sensor !== 'fotodiode';
        const y1 = oy + 40, y2 = oy + 78, y3 = oy + 126, y4 = oy + 150;
        const xm = ox + 75;
        line(ctx, [[xm, oy + 30], [xm, y1]], wire, 2);
        const box = (yy, h, lab, sub, col) => { ctx.fillStyle = '#10151a'; rr(ctx, xm - 8, yy, 16, h, 3); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, lab, xm + 18, yy + h / 2 - 6, 10.5, col, 'left', true); txt(ctx, sub, xm + 18, yy + h / 2 + 7, 10.5, C.text, 'left', false, MONO); };
        // LDR und Fotodiode: Sensor oben, Rlast unten (Ausgang steigt mit dem Licht).
        // Fototransistor und Lichtschranken: Rlast als Arbeitswiderstand am Kollektor (oben), Transistor unten, Ausgang am Kollektor faellt mit dem Licht.
        const ySens = trans ? y3 - 8 : y1, yR = trans ? y1 + 4 : y3 - 2;
        if (ldr) { box(ySens, 38, 'LDR', eng(clamp(10000 * Math.pow(10 / Math.max(S.E, 1e-6), 0.7), 100, 1e6), 'Ω'), '#c78a4a'); line(ctx, [[xm - 16, ySens + 34], [xm + 16, ySens + 4]], '#ffe08a', 1.6); }
        else { box(ySens, 38, trans ? 'Foto-T' : 'Foto-D', eng(S.If, 'A'), '#7fb0ff'); line(ctx, [[xm - 24, ySens + 6], [xm - 10, ySens + 14]], '#ffe08a', 1.8); line(ctx, [[xm - 24, ySens + 18], [xm - 10, ySens + 26]], '#ffe08a', 1.8); }
        ctx.fillStyle = '#10151a'; rr(ctx, xm - 8, yR, 16, 30, 3); ctx.fill(); ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, 'Rlast', xm + 18, yR + 8, 10.5, C.dim, 'left', true); txt(ctx, eng(c.rLoad, 'Ω'), xm + 18, yR + 21, 10.5, C.text, 'left', false, MONO);
        const yTopEnd = trans ? yR + 30 : ySens + 38, yBotStart = trans ? ySens : yR, yBotEnd = trans ? ySens + 38 : yR + 30;
        line(ctx, [[xm, yTopEnd], [xm, yBotStart]], wire, 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xm, y2 + 4, 3.5, 0, TWO_PI); ctx.fill();
        line(ctx, [[xm, yBotEnd], [xm, y4 + 8]], wire, 2); line(ctx, [[xm - 9, y4 + 8], [xm + 9, y4 + 8]], wire, 2); line(ctx, [[xm - 5, y4 + 12], [xm + 5, y4 + 12]], wire, 2);
        // Messpunkt (Knoten zwischen Sensor und Rlast) zum Komparator
        const yn = y2 + 4;
        line(ctx, [[xm, yn], [ox + 190, yn]], wire, 2);
        polyDots(ctx, [[xm, oy + 30], [xm, y1]], t, S.If > 0 ? 36 : 0, 'rgba(255,226,110,0.95)', 16, 2.4);
        drawCmpAt(ctx, ox + 190, yn, t);
        txt(ctx, 'U = ' + fmt(S.Uf, 2) + ' V', ox + 126, yn - 12, 12, '#4cd964', 'left', true, MONO);
      } else {
        ctx.fillStyle = '#2f3840'; rr(ctx, ox + 20, oy + 40, 120, 90, 8); ctx.fill(); ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, s.short, ox + 80, oy + 66, 13, C.text, 'center', true); txt(ctx, 'Sr ' + fmt(srOf(c), 1) + ' mm', ox + 80, oy + 88, 11, C.dim, 'center'); txt(ctx, on ? 'EIN' : 'AUS', ox + 80, oy + 112, 16, on ? C.ok : C.dim, 'center', true);
        const wy = [oy + 56, oy + 88, oy + 120], wc = ['#8b5a2b', '#3b9eff', '#e8ecef'], wl = ['+24 V (braun)', '0 V (blau)', 'OUT (schwarz)'];
        wy.forEach((yy, i) => { line(ctx, [[ox + 140, yy], [ox + 200, yy]], wc[i], 3); txt(ctx, wl[i], ox + 206, yy, 10.5, C.dim, 'left', true); });
        polyDots(ctx, [[ox + 140, wy[2]], [ox + 200, wy[2]]], t, S.iOut > 0.5 ? 40 : 0, 'rgba(255,226,110,0.95)', 14, 2.4);
        txt(ctx, 'Last Rlast = ' + eng(c.rLoad, 'Ω'), ox + 206, oy + 150, 11.5, C.text, 'left', true, MONO);
        txt(ctx, 'U = ' + fmt(S.uOut, 1) + ' V  I = ' + fmt(S.iOut, 1) + ' mA', ox + 20, oy + 150, 12, S.ovl ? C.bad : '#4cd964', 'left', true, MONO);
      }
    }
    function drawCmpAt(ctx, x, y, t) {
      const on = S.state === 1;
      ctx.fillStyle = 'rgba(76,217,100,0.15)'; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 54, y + 0); ctx.lineTo(x, y + 26); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.ok; ctx.lineWidth = 2.2; ctx.stroke();
      const pol = SENS[Cv.sensor].pol > 0;
      txt(ctx, pol ? '+' : '−', x + 7, y - 12, 13, C.text, 'left', true); txt(ctx, pol ? '−' : '+', x + 7, y + 12, 13, C.text, 'left', true);
      line(ctx, [[x, y + 12], [x - 22, y + 12], [x - 22, y + 28]], '#ffb340', 2); txt(ctx, 'Schwelle ' + fmt(Cv.thresh, 2) + ' V', x - 30, y + 40, 11, '#ffb340', 'left', true); txt(ctx, 'Hysterese ' + fmt(Cv.hyst, 2) + ' V', x - 30, y + 53, 10.5, C.dim, 'left');
      line(ctx, [[x + 54, y], [x + 100, y]], wire2, 2); polyDots(ctx, [[x + 54, y], [x + 100, y]], t, on ? 40 : 0, 'rgba(200,150,255,1)', 14, 2.6);
      ctx.fillStyle = on ? 'rgba(76,217,100,0.9)' : '#1d3a26'; ctx.beginPath(); ctx.arc(x + 124, y, 17, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = on ? '#b8ffc4' : '#2a4a34'; ctx.lineWidth = 2; ctx.stroke();
      if (on) { const gg = ctx.createRadialGradient(x + 124, y, 4, x + 124, y, 36); gg.addColorStop(0, 'rgba(76,217,100,0.5)'); gg.addColorStop(1, 'rgba(76,217,100,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x + 124, y, 36, 0, TWO_PI); ctx.fill(); }
      txt(ctx, on ? 'EIN' : 'AUS', x + 124, y + 36, 12, on ? C.ok : C.dim, 'center', true);
    }
    const wire2 = '#8b98a5';
    function drawTrace(ctx, t) {
      const x0 = 536, y0 = 436, w = 450, h = 110, c = cfg(), s = SENS[c.sensor];
      panel(ctx, x0, y0, w, h, s.cls === 'opt' ? 'SPANNUNG  letzte 2 s mit Schwelle' : 'AUSGANG  letzte 2 s');
      const px = x0 + 36, pw = w - 52, py = y0 + 28, ph = h - 40, hh = S.hist, T0 = S.t - 2;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 5); ctx.fill();
      const vmax = s.cls === 'opt' ? s.vcc : (s.us ? 10 : s.vcc);
      const Y = v => py + ph - clamp(v / vmax, 0, 1) * ph, X = tt => px + pw * (tt - T0) / 2;
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1; for (let k = 0; k <= 2; k++) { const gy = py + ph * k / 2; ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); ctx.stroke(); txt(ctx, fmt(vmax * (1 - k / 2), 0), px - 5, gy, 9.5, C.dim, 'right'); }
      if (s.cls === 'opt') {
        ctx.fillStyle = 'rgba(255,179,64,0.14)'; ctx.fillRect(px, Y(c.thresh + c.hyst / 2), pw, Math.max(1, Y(c.thresh - c.hyst / 2) - Y(c.thresh + c.hyst / 2)));
        ctx.strokeStyle = 'rgba(255,179,64,0.9)'; ctx.lineWidth = 1.4; ctx.setLineDash && ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(px, Y(c.thresh)); ctx.lineTo(px + pw, Y(c.thresh)); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.strokeStyle = 'rgba(76,217,100,1)'; ctx.lineWidth = 1.8; ctx.beginPath(); let first = true;
      for (let i = 0; i < hh.length; i++) { if (hh[i][0] < T0 - 0.02) continue; const x = X(hh[i][0]), y = Y(s.cls === 'opt' ? hh[i][1] : (hh[i][1])); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(235,240,245,0.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); first = true; let ly = 0;
      for (let i = 0; i < hh.length; i++) { if (hh[i][0] < T0 - 0.02) continue; const x = X(hh[i][0]), y = py + ph - 4 - hh[i][2] * 16; if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, ly); ctx.lineTo(x, y); } ly = y; } ctx.stroke();
      ctx.restore();
      txt(ctx, 'Spannung', x0 + w - 130, y0 + 17, 11, C.ok, 'left', true); txt(ctx, 'Zustand', x0 + w - 62, y0 + 17, 11, '#e8ecef', 'left', true);
    }
    function drawPanelA(ctx, t) {
      const x0 = 536, y0 = 134, w = 450, h = 104, c = cfg(), s = SENS[c.sensor];
      panel(ctx, x0, y0, w, h, null);
      const on = S.state === 1, flat = S.flutter >= 6;
      lcd(ctx, x0 + 14, y0 + 16, 190, 50, fmt(S.uOut, 2), 'V', S.sat && Math.floor(t / 250) % 2 ? '#ff7a7a' : '#8dffa0');
      txt(ctx, 'I = ' + fmt(S.iOut, s.cls === 'opt' ? 3 : 1) + ' mA', x0 + 14, y0 + 88, 13, C.warn, 'left', true, MONO);
      // Statuslampe
      const lx = x0 + 262, ly = y0 + 52, blink = flat ? (Math.floor(t / 70) % 2) : 1;
      ctx.fillStyle = on && blink ? 'rgba(76,217,100,0.95)' : '#1d3a26'; ctx.beginPath(); ctx.arc(lx, ly, 24, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = on ? '#b8ffc4' : '#2a4a34'; ctx.lineWidth = 3; ctx.stroke();
      if (on && blink) { const g = ctx.createRadialGradient(lx, ly, 6, lx, ly, 48); g.addColorStop(0, 'rgba(76,217,100,0.5)'); g.addColorStop(1, 'rgba(76,217,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 48, 0, TWO_PI); ctx.fill(); }
      txt(ctx, on ? 'EIN' : 'AUS', lx, ly + 40, 14, on ? C.ok : C.dim, 'center', true);
      let msg = '', col = C.dim;
      if (S.ovl) { msg = 'Kurzschlussschutz aktiv'; col = C.bad; } else if (flat) { msg = 'FLATTERT: ' + S.flutter + ' Schaltspiele/s'; col = Math.floor(t / 250) % 2 ? C.bad : C.warn; } else if (S.sat) { msg = 'SÄTTIGUNG'; col = C.warn; } else if (S.ambErr) { msg = 'Fremdlicht stört'; col = C.warn; } else if (s.cls === 'prox' && srOf(c) <= 0) { msg = 'Material nicht erkennbar'; col = C.warn; }
      txt(ctx, msg, x0 + 300, y0 + 44, 12.5, col, 'left', true);
      txt(ctx, s.cls === 'prox' ? 'Schaltabstand ' + fmt(S.sr, 1) + ' mm' : (s.beam ? 'Schaltpunkt ' + fmt(S.sw, 0) + ' mm' : 'E = ' + eng(S.E, 'lx')), x0 + 300, y0 + 66, 12, C.text, 'left', true, MONO);
      txt(ctx, 'Schaltdifferenz ' + fmt(hystPct(c), 1) + ' %', x0 + 300, y0 + 86, 11, C.dim, 'left');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      if (!begin(ctx, w, h)) { ctx.restore(); return; }
      const c = cfg(), s = SENS[c.sensor], on = S.state === 1;
      txt(ctx, 'Licht- und Näherungs-Messkette', 20, 24, 18, C.text, 'left', true);
      txt(ctx, s.label, 980, 24, 12, C.dim, 'right');
      let b0, b1, b2, b3;
      if (s.cls === 'opt') {
        b0 = s.beam ? { title: 'MESSGRÖSSE', l1: 'd = ' + fmt(c.dist, 1) + ' mm', l2: c.sensor === 'gabel' ? 'Objekt im Strahl' : 'Objekt, ' + c.target, col: SIGC.light } : { title: 'MESSGRÖSSE', l1: eng(S.E, 'lx', 3), l2: 'Beleuchtungsstärke', col: SIGC.light };
        b1 = { title: 'SENSOR', l1: c.sensor === 'ldr' ? eng(clamp(10000 * Math.pow(10 / Math.max(S.E, 1e-6), 0.7), 100, 1e6), 'Ω') : eng(S.If, 'A'), l2: s.short, col: c.sensor === 'ldr' ? SIGC.res : SIGC.cur, bad: S.sat };
        b2 = { title: 'AUFBEREITUNG', l1: fmt(S.Uf, 2) + ' V', l2: 'Rlast ' + eng(c.rLoad, 'Ω', 2), col: SIGC.volt, bad: S.sat };
        b3 = { title: 'KOMPARATOR', l1: on ? 'EIN' : 'AUS', l2: 'Schwelle ' + fmt(c.thresh, 1) + ' V ±' + fmt(c.hyst / 2, 2), col: SIGC.dig, bad: S.flutter >= 6 };
      } else {
        b0 = { title: 'MESSGRÖSSE', l1: 'd = ' + fmt(c.dist, 1) + ' mm', l2: MATLAB[c.material], col: SIGC.light };
        b1 = { title: 'SENSOR', l1: 'Sr ' + fmt(S.sr, 1) + ' mm', l2: s.us ? 'Schallwandler' : s.short + ' (F=' + fmt(matF(c), 2) + ')', col: SIGC.res };
        b2 = { title: 'AUFBEREITUNG', l1: s.us ? 't ' + fmt(S.echo, 2) + ' ms' : 'Trigger', l2: s.us ? 'Laufzeitmessung' : 'Hysterese 10 %', col: SIGC.volt };
        b3 = { title: 'AUSGANG', l1: fmt(S.uOut, 1) + ' V', l2: 'PNP, ' + fmt(S.iOut, 1) + ' mA', col: SIGC.dig, bad: S.ovl };
      }
      chainStrip(ctx, t, [b0, b1, b2, b3, { title: 'ANZEIGE', l1: on ? 'EIN' : 'AUS', l2: s.cls === 'opt' ? 'Schaltausgang' : 'Schaltausgang, LED', col: on ? SIGC.volt : SIGC.disp }],
        [{ col: SIGC.light, act: on || s.cls === 'prox' ? 1 : 0.6, label: s.cls === 'opt' && !s.beam ? 'E' : 'd' }, { col: SIGC.res, act: 0.7, label: 'I' }, { col: SIGC.volt, act: 0.8, label: 'U' }, { col: SIGC.dig, act: on ? 1 : 0.2, label: on ? '1' : '0' }]);
      if (s.cls === 'opt' && !s.beam) drawLampScene(ctx, t); else drawRailScene(ctx, t);
      drawPanelA(ctx, t); drawSchem(ctx, t); drawTrace(ctx, t);
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p) return null;
      const s = SENS[Cv.sensor];
      if (!(s.cls === 'opt' && !s.beam) && p.x > 24 && p.x < 505 && p.y > 290 && p.y < 500) return { key: 'dist', kind: 'drag', min: 0, max: 300 };
      return null;
    }
    function dragTo(key, px, py, w, h) {
      const p = toWorld(num(px, 0), num(py, 0), num(w, 0), num(h, 0)); if (!p || key !== 'dist') return null;
      const m = SC(), v = Math.round((p.x - m.x0) / m.k * 2) / 2; setControl('dist', v); return Cv.dist;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'licht', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, dragTo, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { if (opts.controls.sensor != null) setControl('sensor', opts.controls.sensor); Object.keys(opts.controls).forEach(k => { if (k !== 'sensor') setControl(k, opts.controls[k]); }); resetState(); }
    return rig;
  }

  R.register({
    id: 'licht', name: 'Licht und Näherung', icon: '💡',
    info: 'Optische Sensoren (LDR, Fotodiode, Fototransistor, Gabel- und Reflexlichtschranke) und Näherungsschalter (induktiv, kapazitiv, Ultraschall). Erkunde Schaltabstand, Reduktionsfaktor, Hysterese, Flattern und Fremdlicht und ziehe das Objekt im Bild.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
