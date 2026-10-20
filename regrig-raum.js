(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Gemeinsamer Block (in regrig-raum.js und regrig-thermo.js identisch, damit jede Datei einzeln ladbar bleibt) =====
  const TAU = Math.PI * 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const COL = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fin = (v) => typeof v === 'number' && isFinite(v);
  // Zahl aus Zahl oder Zahlentext (Komma oder Punkt); sonst Rueckfallwert d (kein Wurf)
  const num = (v, d) => {
    if (typeof v === 'string') { const s = v.trim().replace(',', '.'); v = s === '' ? NaN : +s; }
    else if (typeof v !== 'number') return d;
    return isFinite(v) ? v : d;
  };
  const MAX_FRAME_STEPS = 2000;      // Kernschritte je step()-Aufruf (SPEC 4.1)
  const MAX_PROC_STEPS = 2e6;        // Obergrenze je stepProcess()-Aufruf
  const LIMIT_PCT = 1000;            // Klemmung der Anzeigewerte (SPEC 4.1)

  function getCore() {
    let c = root.REG_CORE;
    if (!c && typeof require === 'function') { try { c = require('./regcore.js'); } catch (e) { c = null; } }
    if (!c || typeof c.controller !== 'function' || typeof c.rng !== 'function') throw new Error('REG_CORE (regcore.js) ist nicht geladen.');
    return c;
  }
  // Zahlen- und Zeitformat und Meldungstexte kommen aus dem Kern (einzige Quelle); ohne Kern bleibt nur der Strich
  function fmtWith(CORE) { return (v, d) => { try { const s = CORE.fmt(v, d); return typeof s === 'string' ? s : '–'; } catch (e) { return '–'; } }; }
  function tfmtWith(CORE) { return (s, unit) => { try { const r = CORE.fmtTime(s, unit); return typeof r === 'string' ? r : '–'; } catch (e) { return '–'; } }; }
  function rigText(CORE, id, fallback) { try { const t = CORE.TEXTS.rig[id]; if (typeof t === 'string' && t) return t; } catch (e) { /* Rueckfall */ } return fallback; }
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // Wert fuer ein Bedienelement pruefen und umrechnen: { ok, v }
  function coerce(def, value) {
    if (!def) return { ok: false };
    if (def.type === 'switch') {
      if (typeof value === 'boolean') return { ok: true, v: value };
      if (value === 1 || value === 0) return { ok: true, v: value === 1 };
      if (value === 'true' || value === 'false') return { ok: true, v: value === 'true' };
      return { ok: false };
    }
    if (def.type === 'slider') {
      if (typeof value === 'boolean') return { ok: false };
      const n = num(value, NaN);
      return fin(n) ? { ok: true, v: clamp(n, def.min, def.max) } : { ok: false };
    }
    if (def.type === 'select') {
      const o = def.options.find(o => o.value === value || (typeof value !== 'object' && value !== null && String(o.value) === String(value)));
      return o ? { ok: true, v: o.value } : { ok: false };
    }
    return { ok: false };
  }

  // Ringspeicher fuer den Messschreiber
  function makeTrace(cap, keys, extraKeys) {
    const all = keys.concat(extraKeys || []);
    const T = new Float64Array(cap), A = {};
    all.forEach(k => { A[k] = new Float64Array(cap); });
    let n = 0, head = 0;
    return {
      push(t, v) { T[head] = t; for (let i = 0; i < all.length; i++) A[all[i]][head] = v[all[i]]; head = (head + 1) % cap; if (n < cap) n++; },
      clear() { n = 0; head = 0; },
      count() { return n; },
      lastT() { return n ? T[(head - 1 + cap) % cap] : -Infinity; },
      get(t0, maxPts, live) {
        const idx = [];
        for (let i = 0; i < n; i++) { const j = (head - n + i + 2 * cap) % cap; if (T[j] >= t0) idx.push(j); }
        let stride = idx.length > maxPts ? Math.ceil(idx.length / maxPts) : 1;
        const out = { t: [], extra: {} };
        keys.forEach(k => { if (k !== 't') out[k] = []; });
        (extraKeys || []).forEach(k => { out.extra[k] = []; });
        const take = (j, v) => {
          out.t.push(v ? v.t : T[j]);
          keys.forEach(k => out[k].push(v ? v[k] : A[k][j]));
          (extraKeys || []).forEach(k => out.extra[k].push(v ? v[k] : A[k][j]));
        };
        for (let i = 0; i < idx.length; i += stride) take(idx[i]);
        if (idx.length && (idx.length - 1) % stride !== 0) take(idx[idx.length - 1]);
        if (live && live.t > (idx.length ? T[idx[idx.length - 1]] : -Infinity) && live.t >= t0) take(0, live);
        return out;
      }
    };
  }

  // Meldungsliste; Schaltklicks (quiet) werden zuerst verworfen, wenn die Liste voll ist
  function makeEvents(max) {
    const list = [];
    return {
      list,
      add(t, text, kind, fx, x, y, quiet, id) {
        const e = { t: Math.round(t * 10) / 10, text, kind: kind || 'info' };
        if (id) e.id = id;
        if (fx) { e.fx = fx; e.x = x == null ? 300 : x; e.y = y == null ? 300 : y; }
        if (quiet) e.quiet = true;
        list.push(e);
        while (list.length > max) { const q = list.findIndex(v => v.quiet); list.splice(q >= 0 ? q : 0, 1); }
      },
      clear() { list.length = 0; }
    };
  }

  // Schwingungsklasse aus dem Kern (REG_CORE.oscillation); ohne Kern: aperiodisch (es wird nichts behauptet)
  function oscClass(CORE, t, x, range, noise) {
    try { const r = CORE.oscillation(t, x, { range, noise }); if (r && r.ok !== false && typeof r.cls === 'string') return r; } catch (e) { /* kein Urteil */ }
    return { cls: 'aperiodisch', period: NaN, amp: NaN, ratio: NaN, limited: false };
  }

  // ---------- Zeichenhelfer (nur lokal, ohne REG_DRAW, damit jede Datei auch allein zeichnet) ----------
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
  function glow(ctx, x, y, r, rgb, a) {
    if (!(a > 0.005) || !(r > 0)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + Math.min(1, a) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, col, lw, head) {
    const a = Math.atan2(y1 - y0, x1 - x0), hd = head || 9;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw || 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hd * 0.6, y1 - Math.sin(a) * hd * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * hd, y1 - Math.sin(a - 0.45) * hd); ctx.lineTo(x1 - Math.cos(a + 0.45) * hd, y1 - Math.sin(a + 0.45) * hd); ctx.closePath(); ctx.fill();
  }
  function mix(c0, c1, k) { k = clamp(k, 0, 1); return [Math.round(c0[0] + (c1[0] - c0[0]) * k), Math.round(c0[1] + (c1[1] - c0[1]) * k), Math.round(c0[2] + (c1[2] - c0[2]) * k)]; }
  const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';
  // Standardrahmen: Weltmass W x H zentriert und skaliert; false bei unbrauchbarer Flaeche (dann wird nichts gezeichnet)
  function frame(ctx, w, h, W, H) {
    if (!fin(w) || !fin(h) || w <= 0 || h <= 0) return 0;
    const s = Math.min(w / W, h / H);
    ctx.save(); ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, w, h);
    ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
    return s;
  }
  function toWorld(px, py, w, h, W, H) {
    if (!fin(px) || !fin(py) || !fin(w) || !fin(h) || w <= 0 || h <= 0) return null;
    const s = Math.min(w / W, h / H);
    return { x: (px - (w - W * s) / 2) / s, y: (py - (h - H * s) / 2) / s };
  }
  // ===== Ende des gemeinsamen Blocks =====

  // ===== Pruefstand 3: raumtemp – Raumtemperatur / Heizungsregelung (SPEC 4.7.3) =====
  // Strecke: Thermostatventil -> Heizkoerper (PT1 Thk) -> Waermetransport (Totzeit Tt) -> Raum (Waermebilanz, exakt je Schritt) -> Fuehler (PT1 Ts).
  //   C·dtheta/dt = P_h(t - Tt) + Pz - UA·(theta - theta_a),  P_h = Pmax·y/100 ueber PT1 Thk.
  // Regler rechnet in Prozent des Messbereichs 10 ... 30 Grad C (SPEC 2, A2); Zeit intern in Prozess-Sekunden.
  const W = 1000, H = 600;
  const ID = 'raumtemp', TIMESCALE = 60, TUNIT = 'min', STEP_H = 1;
  const P0 = { Pmax: 3000, Thk: 300, Tt: 120, C: 180000, UA: 100, UAwin: 250, Ts: 60, lo: 10, hi: 30, hyst2P: 1, tHold: 600, spanS: 14400, x0: 15 };
  const TA_OPT = [1, 10, 60, 300];
  const TIME_LABEL = (s) => s < 60 ? s + ' s' : (s / 60) + ' min';

  const CONTROLS = [
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'auto', options: [{ value: 'hand', label: 'Hand' }, { value: 'auto', label: 'Automatik' }], group: 'Regler', help: 'Hand: Du bestimmst die Stellgröße selbst, der Regler folgt nur. Automatik: Der Regler stellt. Das Umschalten ist stoßfrei, nur der Zweipunktregler schaltet sofort.' },
    { key: 'ctrl', label: 'Reglerart', type: 'select', value: 'PI', options: [{ value: 'P', label: 'P' }, { value: 'I', label: 'I' }, { value: 'PI', label: 'PI' }, { value: 'PD', label: 'PD' }, { value: 'PID', label: 'PID' }, { value: '2P', label: 'Zweipunkt' }], group: 'Regler', help: 'P stellt schnell, lässt aber eine bleibende Regelabweichung. I und PI gleichen sie aus. D dämpft. Zweipunkt: Das Thermostatventil ist nur auf oder zu.' },
    { key: 'dir', label: 'Wirkungssinn', type: 'select', value: 'direkt', options: [{ value: 'direkt', label: 'direkt' }, { value: 'invers', label: 'invers' }], group: 'Regler', help: 'Direkt: Der Regler stellt mehr, wenn der Istwert unter dem Sollwert liegt (Heizen). Invers wirkt umgekehrt (Kühlen).' },
    { key: 'kp', label: 'Verstärkung Kp', type: 'slider', scale: 'log', min: 0.1, max: 100, step: 0.1, unit: '', value: 2, group: 'Regler', help: 'Proportionalbeiwert Kp: Um so viel Prozent ändert der Regler die Stellgröße je Prozent Regeldifferenz. Der Proportionalbereich ist Xp = 100 %/Kp.' },
    { key: 'tn', label: 'Nachstellzeit Tn', type: 'slider', scale: 'log', unitKind: 'time', min: 120, max: 7200, step: 10, unit: 's', value: 1800, group: 'Regler', visible: (st) => ['I', 'PI', 'PID'].includes(st.ctrl), help: 'Nachstellzeit Tn: So lange braucht der I-Anteil, um den P-Anteil zu wiederholen. Kleiner Tn wirkt schneller, schwingt aber eher.' },
    { key: 'tv', label: 'Vorhaltzeit Tv', type: 'slider', unitKind: 'time', min: 0, max: 1800, step: 10, unit: 's', value: 0, group: 'Regler', visible: (st) => ['PD', 'PID'].includes(st.ctrl), help: 'Vorhaltzeit Tv: Der D-Anteil reagiert auf die Änderungsgeschwindigkeit des Istwerts und dämpft. Er verstärkt aber das Messrauschen.' },
    { key: 'u0', label: 'Arbeitspunkt u0', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'Regler', visible: (st) => ['P', 'PD'].includes(st.ctrl), help: 'Arbeitspunkt der Stellgröße beim P- und PD-Regler: So viel stellt der Regler bei Regeldifferenz 0.' },
    { key: 'aw', label: 'Anti-Windup', type: 'select', value: 'rueck', options: [{ value: 'aus', label: 'aus' }, { value: 'klemmen', label: 'klemmen' }, { value: 'rueck', label: 'Rückrechnung' }], group: 'Regler', visible: (st) => ['I', 'PI', 'PID'].includes(st.ctrl), help: 'Schützt den I-Anteil, wenn das Stellglied am Anschlag steht. Ohne Schutz läuft der I-Anteil weg (Windup) und gibt später ein großes Überschwingen.' },
    { key: 'ymax', label: 'Stellgrößenbegrenzung oben', type: 'slider', min: 20, max: 100, step: 1, unit: '%', value: 100, group: 'Regler', help: 'Obere Grenze der Stellgröße (Stellglied-Grenze). Das Thermostatventil kann nicht weiter öffnen.' },
    { key: 'ta', label: 'Abtastzeit Ta', type: 'select', unitKind: 'time', value: TA_OPT[0], options: TA_OPT.map(v => ({ value: v, label: TIME_LABEL(v) })), group: 'Regler', help: 'Der Regler rechnet nur alle Ta. Dazwischen hält er die Stellgröße. Eine große Abtastzeit kostet Phasenreserve.' },
    { key: 'w', label: 'Sollwert w', type: 'slider', min: 15, max: 25, step: 0.5, unit: '°C', value: 20, group: 'Regler', help: 'Gewünschte Raumtemperatur (Sollwert).' },
    { key: 'wRamp', label: 'Sollwertrampe', type: 'slider', min: 0, max: 0.1, step: 0.005, unit: '%/s', value: 0, group: 'Regler', help: 'Der Sollwert läuft mit dieser Geschwindigkeit (in Prozent des Messbereichs je Prozess-Sekunde) auf den neuen Wert. 0 = Sprung.' },
    { key: 'yHand', label: 'Handstellgröße', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'Regler', visible: (st) => st.mode === 'hand', help: 'Stellgröße im Handbetrieb: Öffnung des Thermostatventils.' },
    { key: 'z', label: 'Fremdwärme Pz', type: 'slider', min: 0, max: 1500, step: 50, unit: 'W', value: 0, group: 'Anlage und Störung', help: 'Störgröße: Wärme von Sonne und Personen. Sie heizt den Raum mit, ohne dass der Regler sie bestellt hat.' },
    { key: 'tOut', label: 'Außentemperatur', type: 'slider', min: -15, max: 20, step: 1, unit: '°C', value: -5, group: 'Anlage und Störung', help: 'Je kälter es draußen ist, desto mehr Heizleistung braucht der Raum für den Sollwert.' },
    { key: 'window', label: 'Fenster offen', type: 'switch', value: false, group: 'Anlage und Störung', help: 'Offenes Fenster: Der Raum verliert viel mehr Wärme. Dadurch ändern sich Verstärkung und Zeitkonstante der Strecke gleichzeitig.' },
    { key: 'noise', label: 'Messrauschen', type: 'slider', min: 0, max: 5, step: 0.1, unit: '%', value: 0, group: 'Anlage und Störung', help: 'Rauschen des Raumfühlers in Prozent des Messbereichs.' }
  ];
  const METERS = [
    { key: 'tRoom', label: 'Raumtemperatur', unit: '°C', digits: 1, min: 10, max: 30 },
    { key: 'w', label: 'Sollwert', unit: '°C', digits: 1, min: 10, max: 30 },
    { key: 'tSensor', label: 'Fühlertemperatur', unit: '°C', digits: 1, min: 10, max: 30 },
    { key: 'y', label: 'Stellgröße', unit: '%', digits: 0, min: 0, max: 100, warnAbove: 99.5 },
    { key: 'e', label: 'Regeldifferenz', unit: 'K', digits: 1, min: -10, max: 10 },
    { key: 'pHeat', label: 'Heizleistung', unit: 'W', digits: 0, min: 0, max: 3000 },
    { key: 'energy', label: 'Heizenergie', unit: 'kWh', digits: 2, min: 0, max: 100 },
    { key: 'tOutM', label: 'Außentemperatur', unit: '°C', digits: 0, min: -15, max: 20 }
  ];
  const ROLES = { w: 'Solltemperatur', x: 'Raumtemperatur', y: 'Ventilstellung', z: 'Fremdwärme (Sonne, Personen)', stell: 'Thermostatventil mit Heizkörper', mess: 'Raumfühler' };
  const Y_HAND0 = 40, Y_HAND1 = 50, T_COLD = -15;
  const Y_COLD = 66.7; // Stellgroesse, die den Raum bei Soll 20 Grad C und -5 Grad C Aussentemperatur (naeherungsweise) auf 15 Grad C haelt
  const PRESETS = [
    { id: 'sprung', name: 'Sprungantwort aufnehmen (Hand, y ' + Y_HAND0 + ' → ' + Y_HAND1 + ' %)', params: { controls: { mode: 'hand', yHand: Y_HAND0, ctrl: 'PI', z: 0, tOut: -5, window: false, noise: 0, ymax: 100 }, op: { y: Y_HAND0 }, next: { yHand: Y_HAND1 } } },
    { id: 'p', name: 'P-Regler', params: { controls: { mode: 'auto', ctrl: 'P', dir: 'direkt', kp: 2, u0: 50, tv: 0, w: 20, z: 0, tOut: -5, window: false, noise: 0, ymax: 100, ta: 1 }, op: { y: Y_COLD } } },
    { id: 'pi', name: 'PI-Regler', params: { controls: { mode: 'auto', ctrl: 'PI', dir: 'direkt', kp: 2, tn: 1800, tv: 0, aw: 'rueck', w: 20, z: 0, tOut: -5, window: false, noise: 0, ymax: 100, ta: 1 }, op: { y: Y_COLD } } },
    { id: 'kaelte', name: ('Kälteeinbruch (' + T_COLD + ' °C)').replace('-', '−'), params: { controls: { mode: 'auto', ctrl: 'PI', dir: 'direkt', kp: 2, tn: 1800, tv: 0, aw: 'rueck', w: 20, z: 0, tOut: T_COLD, window: false, noise: 0, ymax: 100, ta: 1 }, op: { y: 83.3, x: 20 } } },
    { id: 'fenster', name: 'Fenster auf', params: { controls: { mode: 'auto', ctrl: 'PI', dir: 'direkt', kp: 2, tn: 1800, tv: 0, aw: 'rueck', w: 20, z: 0, tOut: -5, window: true, noise: 0, ymax: 100, ta: 1 }, op: { y: 83.3, x: 20 } } }
  ];
  const INFO = 'Übungsanlage: Ein Raum mit Heizkörper und Thermostatventil. Die Heizung ist träge und hat eine Totzeit, darum regelst du hier langsam. Eine Sekunde Echtzeit entspricht ' + (TIMESCALE / 60) + ' Minute Prozesszeit. Das offene Fenster verändert die Strecke selbst.';

  R.register({ id: ID, name: 'Raumtemperatur (Heizung)', icon: '🏠', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS, create(opts) { return createRig(opts || {}); } });

  function createRig(opts) {
    const CORE = getCore();
    const fmt = fmtWith(CORE), tfmt = tfmtWith(CORE);
    const P = Object.assign({}, P0, opts.params || {});
    if (opts.params && opts.params.sensorTau != null) P.Ts = opts.params.sensorTau;
    P.Ts = Math.max(0, num(P.Ts, P0.Ts));
    const h = STEP_H, lo = P.lo, hi = P.hi, rg = hi - lo;
    const NT = Math.max(0, Math.round(P.Tt / h));           // Totzeit als Vielfaches von h (Fehler <= h/2)
    const defs = CONTROLS.map(c => Object.assign({}, c));   // eigene Kopie je Anlage
    const def = {}; defs.forEach(c => { def[c.key] = c; });
    const ctl = {}; defs.forEach(c => { ctl[c.key] = c.value; });
    const ev = makeEvents(80);
    const recEvery = Math.max(1, Math.round(P.spanS / 1200 / h));   // Spur: 1200 Punkte je Standard-Zeitfenster
    const tr = makeTrace(12000, ['w', 'x', 'y', 'z', 'e'], ['xm', 'pHeat', 'wPct', 'xPct', 'ePct']);
    let S, se = null, cobj = null, cSpec = null, TaEff = h, nTa = 1, good = null;
    const pct = (v) => (v - lo) / rg * 100;
    const phys = (p) => lo + p * rg / 100;
    const UA = () => ctl.window ? P.UAwin : P.UA;
    const T_ROOM = () => P.C / UA();
    const Ks = () => (P.Pmax / 100) / UA() / rg * 100;                 // %/% (SPEC 4.7.3)
    const dirS = () => ctl.dir === 'invers' ? -1 : 1;
    const isSwitch = () => ctl.ctrl === '2P';
    const hasI = () => ['I', 'PI', 'PID'].includes(ctl.ctrl);
    const say = (text, kind, fx, quiet, id) => ev.add(S ? S.t : 0, text, kind, fx, 330, 300, quiet, id);

    // ---------- Regler (Kern) ----------
    function buildSpec() {
      const ta = clamp(num(ctl.ta, TA_OPT[0]), h, 1e6);
      nTa = Math.max(1, Math.round(ta / h)); TaEff = nTa * h;
      return { type: ctl.ctrl, Kp: ctl.kp, Tn: ctl.tn, Tv: ctl.tv, N: 10, Ta: TaEff, u0: ctl.u0, ymin: 0, ymax: ctl.ymax, aw: ctl.aw, Tr: null, dOn: 'x', dir: ctl.dir,
        hyst: P.hyst2P / rg * 100, dead: 0, yOn: ctl.ymax, yOff: 0 };
    }
    // Neuer Regler; bei I-Anteil wird die Stellgroesse uebernommen (kein Sprung durch Parameteraenderung)
    function rebuild(keepY) {
      const spec = buildSpec();
      const c = CORE.controller(spec, TaEff);
      if (!c || c.ok === false) {
        say(((c && c.why) || 'Reglerparameter ungültig') + ' (letzter Wert bleibt)', 'warn');
        if (good) { Object.keys(good).forEach(k => { ctl[k] = good[k]; }); const s2 = buildSpec(); const c2 = CORE.controller(s2, TaEff); if (c2 && c2.ok !== false) { cobj = c2; cSpec = s2; } }
        return false;
      }
      cobj = c; cSpec = spec;
      good = { ctrl: ctl.ctrl, kp: ctl.kp, tn: ctl.tn, tv: ctl.tv, u0: ctl.u0, ymax: ctl.ymax, aw: ctl.aw, ta: ctl.ta, dir: ctl.dir };
      if (keepY && S && hasI() && ctl.mode === 'auto' && typeof c.bumpless === 'function') c.bumpless(S.y, S.wsP, pct(S.xm));
      return true;
    }

    // ---------- Zustand ----------
    function initState() {
      const th0 = P.x0;
      se = CORE.sensor({ T: P.Ts, noise: ctl.noise, seed: 1 }); se.reset(pct(th0));
      S = { t: 0, n: 0, acc: 0, th: th0, pk: 0, buf: new Float64Array(NT), bi: 0, xs: th0, xm: th0, wsP: pct(ctl.w), y: 0, yc: 0, windup: 0,
        qHeat: 0, qLoss: 0, qPz: 0, eJ: 0, act: {}, hiT: null, loT: null, wdT: null, yRing: [], rec: 0, oscCache: null, oscRec: -1, thr: false, lastDiag: [] };
      tr.clear(); ev.clear();
      rebuild(false);
    }
    // Beharrungszustand des Heizkoerpers/Raums fuer y (analytisch); th0 optional fest vorgegeben
    function place(yP, th0) {
      const y = clamp(num(yP, 0), 0, 100), pk = P.Pmax * y / 100;
      S.pk = pk; S.buf.fill(pk); S.bi = 0;
      const th = th0 != null ? th0 : ctl.tOut + (pk + ctl.z) / UA();
      S.th = th; S.xs = th; S.xm = th; S.y = y; S.yc = y; se.reset(pct(th));
    }
    function setOperatingPoint(yP, x0) {   // optional x0: Starttemperatur (Grad C), sonst Beharrungszustand fuer y
      const y = clamp(num(yP, NaN), 0, 100); if (!fin(y)) return false;
      const xs0 = num(x0, NaN);
      ctl.mode = 'hand'; ctl.yHand = y; place(y, fin(xs0) ? xs0 : undefined);
      if (cobj && cobj.bumpless) cobj.bumpless(y, S.wsP, pct(S.xm));
      S.hiT = S.loT = S.wdT = null; S.windup = 0;
      return true;
    }
    function yFor(x, zVal) { // Stellgroesse (%), die im Beharrungszustand den Istwert x ergibt (nicht geklemmt)
      const xv = num(x, NaN), z = zVal == null ? ctl.z : num(zVal, ctl.z);
      return fin(xv) ? ((xv - ctl.tOut) * UA() - z) / P.Pmax * 100 : NaN;
    }
    function steady(yP, zVal) {
      const y = clamp(num(yP, 0), 0, 100), z = zVal == null ? ctl.z : num(zVal, ctl.z);
      return ctl.tOut + (P.Pmax * y / 100 + z) / UA();
    }
    function loopInfo() { // Eingang fuer REG_CORE.steadyState (alles in %): x = off + Ks*(y + zeq); off = Festanteil durch die Aussentemperatur, zeq = Fremdwaerme als Stellgroesse
      return { Ks: Ks(), q: 0, off: 100 * (ctl.tOut - lo) / rg, zeq: ctl.z / (P.Pmax / 100) };
    }
    function linBlocks() {
      const b = [{ t: 'K', K: Ks() }, { t: 'PT1', T: T_ROOM() }, { t: 'PT1', T: P.Thk }];
      if (P.Ts > 0) b.push({ t: 'PT1', T: P.Ts });
      if (NT > 0) b.push({ t: 'Tt', Tt: NT * h });
      return b;
    }

    // ---------- Kernschritt (Reihenfolge nach SPEC 4.5) ----------
    function coreStep() {
      const UAn = UA(), tau = P.C / UAn;
      // 1 Sollwertrampe
      const wP = pct(ctl.w), ramp = ctl.wRamp;
      S.wsP = ramp > 0 ? S.wsP + clamp(wP - S.wsP, -ramp * h, ramp * h) : wP;
      // 2 Messglied (aus x des Vorschritts)
      const xmP = se.step(pct(S.th), h);
      S.xs = phys(se.value()); S.xm = phys(xmP);
      // 3 Reglerschritt
      const hand = ctl.mode === 'hand';
      if (S.n % nTa === 0) {
        const xP = pct(S.xm);
        if (hand) { if (cobj.bumpless) cobj.bumpless(ctl.yHand, S.wsP, xP); }
        else {
          S.yc = cobj.step(S.wsP, xP);
          if (ctl.aw === 'aus' && hasI()) S.windup = windupNow();
          S.yRing.push(S.yc); if (S.yRing.length > 40) S.yRing.shift();
        }
      }
      // 4 Hand / Automatik, Stellgliedgrenze
      S.y = clamp(hand ? ctl.yHand : S.yc, 0, ctl.ymax);
      // 5 Stellglied und Strecke
      S.pk += (1 - Math.exp(-h / P.Thk)) * (P.Pmax * S.y / 100 - S.pk);
      let Pd = S.pk;
      if (NT > 0) { Pd = S.buf[S.bi]; S.buf[S.bi] = S.pk; S.bi = (S.bi + 1) % NT; }
      const th0 = S.th, thInf = ctl.tOut + (Pd + ctl.z) / UAn, ex = Math.exp(-h / tau);
      S.th = thInf + (th0 - thInf) * ex;
      if (!fin(S.th)) { S.th = lo; }
      S.qHeat += Pd * h; S.qPz += ctl.z * h;
      S.qLoss += UAn * ((thInf * h + (th0 - thInf) * tau * (1 - ex)) - ctl.tOut * h);
      S.eJ += S.pk * h;
      S.n++; S.t = S.n * h;   // Zeit aus der Schrittzahl: keine Rundungsdrift
      // Zeitgeber fuer die Meldungen (Anschlag, Windup)
      const auto = !hand && !isSwitch();
      S.hiT = auto && S.y >= ctl.ymax - 0.5 ? (S.hiT == null ? S.t : S.hiT) : null;
      S.loT = auto && S.y <= 0.5 ? (S.loT == null ? S.t : S.loT) : null;
      S.wdT = auto && ctl.aw === 'aus' && hasI() && S.windup > 25 ? (S.wdT == null ? S.t : S.wdT) : null;
      // 6 Spur
      if (S.n % recEvery === 0) { tr.push(S.t, liveSample()); S.rec++; }
      // 7 Meldungen
      if (S.n % 50 === 0) evaluate();
    }
    function windupNow() { // |y_unsat - y| in %, aus dem Kernregler
      if (isSwitch() || !cobj || typeof cobj.state !== 'function') return 0;
      const st = cobj.state(); return fin(st.yu) && fin(st.y) ? Math.abs(st.yu - st.y) : 0;
    }
    function liveSample() {
      const e = dirS() * (S.wsP - pct(S.th)) * rg / 100;
      return { t: S.t, w: phys(S.wsP), x: S.th, y: S.y, z: ctl.z, e, xm: S.xm, pHeat: S.pk, wPct: S.wsP, xPct: pct(S.th), ePct: dirS() * (S.wsP - pct(S.th)) };
    }

    function stepProcess(dtS) {
      dtS = num(dtS, 0); if (dtS <= 0) return 0;
      S.acc += dtS;
      let n = Math.floor(S.acc / h + 1e-9);
      if (n > MAX_PROC_STEPS) n = MAX_PROC_STEPS;
      S.acc -= n * h; if (S.acc < 1e-9) S.acc = 0;
      if (S.acc > h * 1e6) S.acc = 0;
      for (let i = 0; i < n; i++) coreStep();
      return n;
    }
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      let dtS = dtMs / 1000 * TIMESCALE;
      const want = (S.acc + dtS) / h;
      if (want > MAX_FRAME_STEPS) {
        dtS = Math.max(0, MAX_FRAME_STEPS * h - S.acc); S.thr = true;
        if (!S.act.drossel) { S.act.drossel = 1; say(rigText(CORE, 'zeitraffer', 'Zeitraffer gedrosselt'), 'info'); }
      } else if (S.thr) { S.thr = false; delete S.act.drossel; }
      stepProcess(dtS);
    }

    // ---------- Schwingung, Messwerte ----------
    function oscNow() {
      if (S.oscRec === S.rec && S.oscCache) return S.oscCache;
      const win = P.spanS / 3;
      const d = tr.get(S.t - win, 600, null);
      let r = { cls: 'aperiodisch', period: 0, amp: 0, ratio: 0, limited: false };
      if (d.t.length >= 30 && d.t[d.t.length - 1] - d.t[0] >= win * 0.9) r = oscClass(CORE, d.t, d.x, rg, ctl.noise);
      S.oscCache = r; S.oscRec = S.rec; return r;
    }
    function cl(v) { return fin(v) ? clamp(v, -LIMIT_PCT * rg / 100 + lo, LIMIT_PCT * rg / 100 + lo) : 0; }
    function meterVals() {
      const e = dirS() * (S.wsP - pct(S.th)) * rg / 100;
      return { x: cl(S.th), tRoom: cl(S.th), w: cl(phys(S.wsP)), tSensor: cl(S.xm), y: clamp(S.y, 0, 100), e: clamp(e, -LIMIT_PCT * rg / 100, LIMIT_PCT * rg / 100), pHeat: Math.max(0, S.pk), energy: S.eJ / 3.6e6, tOutM: ctl.tOut };
    }
    function readMeters() { const m = meterVals(); Object.keys(m).forEach(k => { if (!fin(m[k])) m[k] = 0; }); return m; }

    // ---------- Diagnose: Kern (REG_CORE.diagnose) liefert Texte und Bedingungen; hier nur die geprueften Messwerte (SPEC 4.11) ----------
    function yStd() { const a = S.yRing; if (a.length < 20) return 0; let m = 0; a.forEach(v => { m += v; }); m /= a.length; let q = 0; a.forEach(v => { q += (v - m) * (v - m); }); return Math.sqrt(q / a.length); }
    function settled() {
      const d = tr.get(S.t - P.tHold, 600, null);
      if (d.t.length < 10 || d.t[d.t.length - 1] - d.t[0] < P.tHold * 0.9) return false;
      let mn = Infinity, mx = -Infinity; d.x.forEach(v => { if (v < mn) mn = v; if (v > mx) mx = v; });
      return (mx - mn) <= 0.005 * rg;
    }
    function diagCtx() {
      const sw2 = isSwitch(), Pben = UA() * (ctl.w - ctl.tOut) - ctl.z, hiFor = S.hiT != null ? S.t - S.hiT : 0;
      const eP = dirS() * (S.wsP - pct(S.th)), o = sw2 ? null : oscNow();
      const c = { ctrl: ctl.ctrl, mode: ctl.mode, dir: ctl.dir, requiredDir: 'direkt', y: S.y, ymax: ctl.ymax, tHold: P.tHold, aw: ctl.aw, tv: ctl.tv, noise: ctl.noise, kp: ctl.kp, tn: ctl.tn, N: 10, tUnit: TUNIT, unit: 'K',
        Tt: NT * h, Tdom: Math.max(T_ROOM(), P.Thk, P.Ts) };
      if (!sw2) {
        c.satHighFor = hiFor; c.satLowFor = S.loT != null ? S.t - S.loT : 0; c.windup = S.windup; c.windupFor = S.wdT != null ? S.t - S.wdT : 0;
        if (o && fin(o.amp) && o.amp >= 0.02 * rg) c.osc = { cls: o.cls, period: o.period };
        c.settled = settled(); c.e = eP * rg / 100; c.ePct = eP; c.sigmaY = yStd();
        if (hiFor >= P.tHold && ctl.ymax >= 99.5) { c.Pben = Pben; c.Pmax = P.Pmax; }
      }
      return c;
    }
    // Abtast-Meldung: Der Kern rechnet dafuer zwei Frequenzgaenge (teuer); das Ergebnis haengt nur von Reglerwerten und Strecke ab und wird je Wertesatz einmal berechnet
    let abKey = '', abDiag = null;
    function abtastDiag() {
      if (isSwitch() || ctl.mode === 'hand') return null;
      const key = [ctl.ctrl, ctl.kp, ctl.tn, ctl.tv, ctl.dir, TaEff, ctl.window ? 1 : 0].join('|');
      if (key !== abKey) {
        abKey = key; abDiag = null;
        try { const r = CORE.diagnose({ ctrl: ctl.ctrl, mode: 'auto', kp: ctl.kp, tn: ctl.tn, tv: ctl.tv, dir: ctl.dir, blocks: linBlocks(), ta: TaEff, tUnit: TUNIT }); abDiag = (Array.isArray(r) ? r : []).find(d => d.id === 'abtast') || null; } catch (e) { abDiag = null; }
      }
      return abDiag;
    }
    function diagnose() {
      if (!S) return [];
      let out = [];
      try { out = CORE.diagnose(diagCtx()) || []; } catch (e) { out = []; }
      if (!Array.isArray(out)) out = [];
      const ab = abtastDiag(); if (ab) out.push(ab);
      if (isSwitch() && ctl.mode === 'hand') out = out.map(d => d.id === 'hand' ? { id: 'hand', kind: 'info', text: 'Handbetrieb: Der Regler ist abgeschaltet. ' + rigText(CORE, 'zweipunkt', 'Zweipunktregler: Stellgröße schaltet sofort') + '.' } : d);
      if (ctl.window && S.pk > 0.5) out.push({ id: 'fenster', kind: 'info', text: 'Fenster offen: Die Heizung heizt nach draußen.' });
      return out;
    }
    function evaluate() {
      const list = diagnose(), now = {};
      list.forEach(d => { now[d.id] = 1; if (!S.act[d.id]) say(d.text, d.kind, d.fx, false, d.id); });
      S.act = Object.assign(now, S.thr ? { drossel: 1 } : {});
      S.lastDiag = list;
    }

    // ---------- Steuerwerte ----------
    function setControl(key, value) {
      const d = def[key];
      if (!d) return false;
      if (key === 'ctrl' && ['P', 'I', 'PI', 'PD', 'PID', '2P', '3P'].includes(value) && !d.options.some(o => o.value === value)) { say(rigText(CORE, 'reglerart', 'Diese Reglerart gibt es an dieser Anlage nicht.'), 'warn'); return false; }
      const c = coerce(d, value);
      if (!c.ok) return false;
      const v = c.v;
      const old = ctl[key];
      ctl[key] = v;
      if (key === 'mode') {
        if (v === 'hand' && old === 'auto') ctl.yHand = clamp(S.y, 0, 100);   // Handwert startet bei der aktuellen Stellgroesse (stossfrei)
        if (v === 'auto' && old === 'hand') {
          if (cobj && cobj.bumpless && !isSwitch()) cobj.bumpless(ctl.yHand, S.wsP, pct(S.xm));
          else if (isSwitch()) say(rigText(CORE, 'zweipunkt', 'Zweipunktregler: Stellgröße schaltet sofort'), 'info');
          S.yc = ctl.yHand;
        }
      } else if (key === 'noise') { se.setNoise(v);
      } else if (key === 'w' || key === 'wRamp') { if (!(ctl.wRamp > 0)) S.wsP = pct(ctl.w);   // ohne Rampe gilt der Sollwert sofort
      } else if (['ctrl', 'kp', 'tn', 'tv', 'u0', 'ymax', 'aw', 'ta', 'dir'].includes(key)) {
        if (!rebuild(S.n > 0)) return false;     // vor dem ersten Schritt gibt es nichts zu uebernehmen
        if (key === 'ctrl' && v === '2P' && ctl.mode === 'auto') say(rigText(CORE, 'zweipunkt', 'Zweipunktregler: Stellgröße schaltet sofort'), 'info');
      }
      return true;
    }
    function getControl(key) { return def[key] ? ctl[key] : undefined; }

    function applyPreset(id) {
      const p = PRESETS.find(q => q.id === id); if (!p) return false;
      reset();
      const pr = p.params, c = pr.controls || {};
      const mode = c.mode;
      Object.keys(c).forEach(k => { if (k !== 'mode') { const d = def[k], cc = coerce(d, c[k]); if (cc.ok) ctl[k] = cc.v; } });
      ctl.mode = mode === 'hand' ? 'hand' : 'auto';
      S.wsP = pct(ctl.w);
      rebuild(false);
      if (pr.op) {
        place(pr.op.y, pr.op.x);
        if (ctl.mode === 'hand') { ctl.yHand = clamp(num(c.yHand, pr.op.y), 0, 100); if (cobj.bumpless) cobj.bumpless(ctl.yHand, S.wsP, pct(S.xm)); }
        else if (hasI() && cobj.bumpless) cobj.bumpless(S.y, S.wsP, pct(S.xm));
      }
      return true;
    }
    function reset() { initState(); }

    // ---------- Anzeige-Daten ----------
    function traceOut(spanS) {
      const sp = fin(spanS) && spanS > 0 ? spanS : P.spanS;
      const d = tr.get(S.t - sp, 600, liveSample());
      return { t: d.t, w: d.w, x: d.x, y: d.y, z: d.z, e: d.e, extra: d.extra };
    }
    function state() {
      const m = readMeters(), st = cobj && cobj.state ? cobj.state() : {};
      const e = dirS() * (S.wsP - pct(S.th)) * rg / 100;
      const o = oscNow();
      const ids = diagnose().map(d => d.id);
      const Pben = UA() * (ctl.w - ctl.tOut) - ctl.z;
      return {
        t: S.t, w: m.w, x: m.x, y: m.y, z: ctl.z, e: fin(e) ? e : 0,
        wPct: pct(m.w), xPct: pct(m.x), yPct: m.y, ePct: dirS() * (S.wsP - pct(S.th)),
        mode: ctl.mode, ctrl: ctl.ctrl, kp: ctl.kp, tn: ctl.tn, tv: ctl.tv, ta: TaEff, dir: ctl.dir, ymax: ctl.ymax,
        satHigh: S.y >= ctl.ymax - 0.5, satLow: S.y <= 0.5, windup: windupNow(), osc: o.cls, faults: ids,
        tRoom: m.x, tSensor: m.tSensor, pHeat: m.pHeat, energy: m.energy, tOut: ctl.tOut, window: !!ctl.window, UA: UA(), Pmax: P.Pmax, Pben,
        Ks: Ks(), T: T_ROOM(), V0: ctl.kp * Ks(), unsat: fin(st.yu) ? st.yu : S.y, xm: m.tSensor, wSet: ctl.w, oscInfo: { period: isFinite(o.period) ? o.period : 0, amp: isFinite(o.amp) ? o.amp : 0, ratio: isFinite(o.ratio) ? o.ratio : 0, limited: !!o.limited },
        qHeat: S.qHeat, qLoss: S.qLoss, qPz: S.qPz, C: P.C, Tt: NT * h, thr: S.thr, throttled: S.thr
      };
    }

    // ---------- Kennlinien ----------
    function stepModel(blocks, tEnd, n) { // Sprungantwort der Linearisierung aus dem Kern
      try { const r = CORE.stepResponse(blocks, tEnd, tEnd / n); if (r && r.ok !== false && r.t && r.x) return r; } catch (e) { /* leer */ }
      return { t: [0, 1], x: [0, 0] };
    }
    function curves() {
      const pts = [], pb = [], b = [];
      for (let y = 0; y <= 100.001; y += 5) pts.push([+y.toFixed(1), +steady(y).toFixed(3)]);
      for (let ta = -15; ta <= 20.001; ta += 1) pb.push([ta, +(UA() * (ctl.w - ta) - ctl.z).toFixed(1)]);
      const dy = 10, blocks = linBlocks(), tEnd = 6 * (T_ROOM() + P.Thk + P.Ts + NT * h), sr = stepModel(blocks, tEnd, 120);
      for (let i = 0; i < sr.t.length; i++) b.push([+(sr.t[i] / 60).toFixed(3), +(sr.x[i] * dy * rg / 100).toFixed(4)]);
      return [
        { id: 'kennlinie', title: 'Beharrungstemperatur über der Stellgröße', xLabel: 'Stellgröße y', xUnit: '%', yLabel: 'Raumtemperatur', yUnit: '°C', series: [{ name: 'ϑ im Beharrungszustand', points: pts }], marker: { x: S.y, y: cl(S.th) } },
        { id: 'heizbedarf', title: 'Heizbedarf über der Außentemperatur', xLabel: 'Außentemperatur', xUnit: '°C', yLabel: 'Heizleistung', yUnit: 'W', series: [{ name: 'Heizbedarf für den Sollwert', points: pb }, { name: 'Maximale Heizleistung', points: [[-15, P.Pmax], [20, P.Pmax]] }], marker: { x: ctl.tOut, y: Pben0() } },
        { id: 'sprung', title: 'Modell-Sprungantwort (Stellgröße +10 %)', xLabel: 'Prozesszeit', xUnit: 'min', yLabel: 'Temperaturänderung', yUnit: 'K', series: [{ name: 'Modell aus der Linearisierung', points: b, dashed: true }], marker: { x: 0, y: 0 } }
      ];
    }
    function Pben0() { return UA() * (ctl.w - ctl.tOut) - ctl.z; }

    // ---------- Analyse ----------
    function analysis() {
      const blocks = linBlocks(), out = { blocks, V0: ctl.kp * Ks(), margins: null, linearised: true, info: { Ks: Ks(), T: T_ROOM(), Thk: P.Thk, Ts: P.Ts, Tt: NT * h } };
      if (isSwitch()) { out.V0 = NaN; out.margins = { ok: false, why: 'Für Schaltregler gibt es keinen Frequenzgang (nichtlinear).' }; return out; }
      try {
        if (CORE.freq && typeof CORE.freq.loopBlocks === 'function' && typeof CORE.margins === 'function') {
          const lb = CORE.freq.loopBlocks(blocks, cSpec);
          out.margins = lb && lb.ok === false ? lb : CORE.margins(lb.blocks || lb);
        } else out.margins = { ok: false, why: 'Der Rechenkern (regcore.js) ist nicht vollständig geladen.' };
      } catch (e) { out.margins = { ok: false, why: 'Die Analyse ist nicht möglich.' }; }
      return out;
    }
    function identify() {
      if (typeof CORE.identify === 'function') { try { return CORE.identify(linBlocks()); } catch (e) { return { ok: false, why: 'Die Identifikation ist nicht möglich.' }; } }
      return { ok: false, why: 'Der Rechenkern (regcore.js) ist nicht vollständig geladen.' };
    }

    // ---------- Zeichnen ----------
    const L = { window: [590, 160, 70, 190], valve: [172, 372, 78, 70] };
    function hitTest(px, py, w, h2) {
      const p = toWorld(px, py, w, h2, W, H); if (!p) return null;
      const inR = (r) => p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3];
      if (inR(L.window)) return { key: 'window', kind: 'switch', to: !ctl.window, value: !ctl.window };
      if (inR(L.valve)) { const to = ctl.mode === 'auto' ? 'hand' : 'auto'; return { key: 'mode', kind: 'switch', to, value: to }; }
      return null;
    }
    function clockText(t) { const s = Math.floor(t), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }
    function draw(ctx, w, h2, t) {
      t = num(t, 0);
      const s = frame(ctx, w, h2, W, H); if (!s) return;
      const m = meterVals(), k = clamp((m.tRoom - lo) / rg, 0, 1), pw = clamp(S.pk / P.Pmax, 0, 1), ua = UA(), UA0 = P.UA;
      // Titel
      txt(ctx, 'Raumtemperatur-Prüfstand (Übungsanlage)', 22, 26, 20, COL.text, 'left', '800');
      txt(ctx, 'Prozesszeit ' + clockText(S.t) + ' · ' + (ctl.mode === 'hand' ? 'Handbetrieb' : 'Automatik') + ' · Regler ' + ctl.ctrl, 22, 48, 13, COL.dim, 'left', '600');
      // Raum: Waende, Boden, Decke
      const tint = mix([40, 70, 120], [170, 80, 50], k);
      ctx.fillStyle = rgb(tint, 0.38); ctx.fillRect(70, 100, 540, 350);
      let g = ctx.createLinearGradient(0, 100, 0, 450); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fillRect(70, 100, 540, 350);
      ctx.fillStyle = '#4a5663'; ctx.fillRect(56, 86, 574, 14); ctx.fillRect(56, 450, 574, 20); ctx.fillRect(56, 86, 14, 384);
      ctx.fillRect(610, 86, 20, 84); ctx.fillRect(610, 340, 20, 130);
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 2; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(60 + i * 36, 470); ctx.lineTo(48 + i * 36, 484); ctx.stroke(); }
      // Fenster
      ctx.fillStyle = 'rgba(150,200,255,0.35)'; ctx.fillRect(610, 170, 20, 170);
      ctx.strokeStyle = '#cfd8e3'; ctx.lineWidth = 4; ctx.strokeRect(610, 170, 20, 170);
      if (ctl.window) {
        ctx.fillStyle = 'rgba(160,210,255,0.55)'; ctx.beginPath(); ctx.moveTo(612, 172); ctx.lineTo(664, 150); ctx.lineTo(664, 316); ctx.lineTo(612, 338); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e6edf3'; ctx.lineWidth = 3; ctx.stroke();
      } else { ctx.strokeStyle = '#cfd8e3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(620, 170); ctx.lineTo(620, 340); ctx.stroke(); }
      txt(ctx, ctl.window ? 'Fenster auf' : 'Fenster zu', 640, 358, 13, ctl.window ? COL.warn : COL.dim, 'center', '700');
      // Waermeverluste (Pfeile nach aussen, Breite ~ Verlustleistung)
      const dT = m.tRoom - ctl.tOut, outward = dT >= 0, lossWall = UA0 * Math.abs(dT), lossWin = (ua - UA0) * Math.abs(dT);
      const lw = (p) => clamp(1.5 + p / 250, 1.5, 14);
      const colL = outward ? 'rgba(255,150,70,0.85)' : 'rgba(110,180,255,0.85)';
      const aw = (x0, y0, x1, y1, p) => outward ? arrow(ctx, x0, y0, x1, y1, colL, lw(p), 12 + lw(p)) : arrow(ctx, x1, y1, x0, y0, colL, lw(p), 12 + lw(p));
      aw(640, 410, 720, 410, lossWall);
      if (ctl.window) aw(670, 250, 760, 250, lossWin);
      else { ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(160,170,180,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(640, 250); ctx.lineTo(700, 250); ctx.stroke(); ctx.setLineDash([]); }
      // Heizkoerper
      const hc = mix([96, 106, 118], [255, 108, 48], pw);
      glow(ctx, 145, 360, 150, '255,120,50', pw * 0.45);
      for (let i = 0; i < 6; i++) { rr(ctx, 100 + i * 15, 300, 11, 130, 5); ctx.fillStyle = rgb(hc); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = '#7b8794'; ctx.fillRect(96, 428, 94, 8); ctx.fillRect(96, 296, 94, 8);
      ctx.strokeStyle = rgb(mix([120, 130, 140], [255, 120, 60], pw)); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(70, 440); ctx.lineTo(96, 440); ctx.stroke();
      txt(ctx, 'Heizkörper', 145, 286, 13, COL.dim, 'center', '700');
      // Konvektion
      for (let i = 0; i < 5; i++) {
        const ph = ((t / 1400 + i * 0.2) % 1), yy = 290 - ph * 120, a = pw * (1 - ph) * 0.9;
        if (a > 0.03) arrow(ctx, 112 + i * 17, yy + 14, 112 + i * 17, yy - 6, 'rgba(255,170,90,' + a.toFixed(3) + ')', 3, 9);
      }
      // Thermostatkopf am Heizkoerper
      const vy = 405, va = (-120 + 240 * clamp(S.y / 100, 0, 1)) * Math.PI / 180;
      rr(ctx, 190, 388, 38, 34, 8); ctx.fillStyle = ctl.mode === 'hand' ? '#6b5a2a' : '#34404c'; ctx.fill(); ctx.strokeStyle = ctl.mode === 'hand' ? COL.warn : COL.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(209, vy, 11, 0, TAU); ctx.fillStyle = '#1b2128'; ctx.fill();
      ctx.strokeStyle = COL.acc; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(209, vy); ctx.lineTo(209 + Math.sin(va) * 10, vy - Math.cos(va) * 10); ctx.stroke();
      txt(ctx, 'Ventil ' + fmt(S.y, 0) + ' %', 209, 440, 12, COL.text, 'center', '700');
      txt(ctx, ctl.mode === 'hand' ? 'HAND (antippen)' : 'AUTO (antippen)', 209, 456 + 6, 11, ctl.mode === 'hand' ? COL.warn : COL.ok, 'center', '800');
      // Raumfuehler an der Wand
      rr(ctx, 330, 300, 40, 28, 6); ctx.fillStyle = '#2d3641'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(350, 314, 6, 0, TAU); ctx.fillStyle = rgb(mix([80, 140, 255], [255, 90, 60], clamp((m.tSensor - lo) / rg, 0, 1))); ctx.fill();
      txt(ctx, 'Raumfühler', 350, 342, 12, COL.dim, 'center', '700'); txt(ctx, fmt(m.tSensor, 1) + ' °C', 350, 358, 13, COL.text, 'center', '700');
      // Raumthermometer mit Sollmarke
      const tx = 500, ty0 = 130, ty1 = 410;
      rr(ctx, tx - 9, ty0, 18, ty1 - ty0, 9); ctx.fillStyle = '#1b2128'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty1 + 12, 17, 0, TAU); ctx.fillStyle = '#d33'; ctx.fill();
      const yl = (v) => ty1 - clamp((v - lo) / rg, 0, 1) * (ty1 - ty0 - 14);
      ctx.fillStyle = '#d33'; ctx.fillRect(tx - 4, yl(m.tRoom), 8, ty1 - yl(m.tRoom) + 4);
      for (let v = lo; v <= hi + 0.01; v += 5) { ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx + 12, yl(v)); ctx.lineTo(tx + 20, yl(v)); ctx.stroke(); txt(ctx, String(v), tx + 24, yl(v), 11, COL.dim, 'left', '600'); }
      const ws = yl(m.w); ctx.fillStyle = COL.ok; ctx.beginPath(); ctx.moveTo(tx - 12, ws); ctx.lineTo(tx - 26, ws - 7); ctx.lineTo(tx - 26, ws + 7); ctx.closePath(); ctx.fill();
      txt(ctx, 'Soll', tx - 30, ws, 12, COL.ok, 'right', '800');
      // Sonne und Personen (Fremdwaerme)
      if (ctl.z > 0) {
        const a = clamp(ctl.z / 1500, 0.25, 1);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(830, 120, 30, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4; for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + t / 2500; ctx.beginPath(); ctx.moveTo(830 + Math.cos(an) * 38, 120 + Math.sin(an) * 38); ctx.lineTo(830 + Math.cos(an) * 52, 120 + Math.sin(an) * 52); ctx.stroke(); }
        arrow(ctx, 800, 140, 668, 215, 'rgba(255,216,74,0.9)', 4, 12);
        const np = Math.min(3, Math.ceil(ctl.z / 500));
        for (let i = 0; i < np; i++) { const px2 = 270 + i * 34; ctx.strokeStyle = '#e6edf3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px2, 392, 7, 0, TAU); ctx.moveTo(px2, 399); ctx.lineTo(px2, 424); ctx.moveTo(px2 - 10, 408); ctx.lineTo(px2 + 10, 408); ctx.moveTo(px2, 424); ctx.lineTo(px2 - 8, 446); ctx.moveTo(px2, 424); ctx.lineTo(px2 + 8, 446); ctx.stroke(); }
        ctx.restore();
        txt(ctx, 'Fremdwärme ' + fmt(ctl.z, 0) + ' W', 830, 186, 13, COL.warn, 'center', '700');
      }
      // Aussenthermometer
      const ox = 880, oy0 = 230, oy1 = 430;
      rr(ctx, ox - 8, oy0, 16, oy1 - oy0, 8); ctx.fillStyle = '#1b2128'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
      const oyl = (v) => oy1 - clamp((v + 15) / 35, 0, 1) * (oy1 - oy0 - 10);
      ctx.fillStyle = '#4aa8ff'; ctx.fillRect(ox - 4, oyl(ctl.tOut), 8, oy1 - oyl(ctl.tOut));
      txt(ctx, 'außen', ox, oy0 - 14, 13, COL.dim, 'center', '700'); txt(ctx, fmt(ctl.tOut, 0) + ' °C', ox, oy1 + 18, 14, COL.text, 'center', '800');
      // Anzeigefeld unten
      const cells = [
        ['Raum ϑ', fmt(m.tRoom, 1) + ' °C', COL.text], ['Sollwert w', fmt(m.w, 1) + ' °C', COL.ok], ['Regeldifferenz e', fmt(m.e, 1) + ' K', Math.abs(m.e) > 1 ? COL.warn : COL.text],
        ['Heizleistung', fmt(m.pHeat, 0) + ' W', COL.text], ['Stellgröße y', fmt(m.y, 0) + ' %', S.y >= ctl.ymax - 0.5 ? COL.warn : COL.text], ['Energie', fmt(m.energy, 2) + ' kWh', COL.text]];
      cells.forEach((c, i) => { const x0 = 40 + i * 156; rr(ctx, x0, 508, 146, 62, 10); ctx.fillStyle = COL.panel; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5; ctx.stroke(); txt(ctx, c[0], x0 + 12, 528, 12, COL.dim, 'left', '700'); txt(ctx, c[1], x0 + 12, 551, 20, c[2], 'left', '800'); });
      ctx.restore();
    }

    // ---------- Aufbau ----------
    initState();
    const rig = {
      get id() { return ID; }, get range() { return { lo, hi, unit: '°C', digits: 1 }; }, get timeScale() { return TIMESCALE; }, get tUnit() { return TUNIT; }, get h() { return h; },
      get requiredDir() { return 'direkt'; }, get roles() { return Object.assign({}, ROLES); }, get params() { return Object.assign({}, P, { Tt: NT * h }); },
      get presets() { return PRESETS; }, get spanS() { return P.spanS; }, controls: defs, meters: METERS, events: ev.list,
      setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, curves, reset,
      worldSize() { return { w: W, h: H }; },
      setOperatingPoint, steady, yFor, trace: traceOut, linBlocks, analysis, identify, diagnose, applyPreset, loopInfo
    };
    return rig;
  }

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
