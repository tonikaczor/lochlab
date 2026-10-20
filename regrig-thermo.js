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

  // ===== Pruefstand 4: thermostat – Zweipunktregler mit Thermostat (SPEC 4.7.4) =====
  // Waermespeicher:  C·dtheta/dt = Ph·sH - Pc·sC + Pz_vz - (theta - theta_a)/Rth   (exakt je Schritt, Schaltzustaende sH, sC),
  // Fuehler (Bimetall) PT1 Ts, Zweipunkt- bzw. Dreipunktregler aus REG_CORE.controller, thermische Rueckfuehrung, Wiedereinschaltsperre.
  const W = 1000, H = 600;
  const ID = 'thermostat', TFB = 30, LOCK_S = 180;
  // Anlagenwerte je Geraet (Uebungsanlage, SPEC 4.7.4 Tabelle; A8)
  const DEV = {
    heizen: { name: 'Bügeleisen-Sohle', Ph: 1000, Pc: 0, C: 1500, Rth: 0.2, ta: 25, lo: 0, hi: 250, w: 150, wMin: 50, wMax: 200, Ts: 8, timeScale: 5, tUnit: 's', h: 0.1, spanS: 2400, zMax: 300, zSign: -1, hyst: 6, hystMax: 40, req: 'direkt', tHold: 20 },
    kuehlen: { name: 'Kühlschrank', Ph: 0, Pc: 60, C: 10000, Rth: 0.4, ta: 22, lo: -10, hi: 30, w: 5, wMin: 2, wMax: 12, Ts: 30, timeScale: 120, tUnit: 'min', h: 1, spanS: 14400, zMax: 60, zSign: 1, hyst: 2, hystMax: 10, req: 'invers', tHold: 20 },
    beides: { name: 'Klimagerät', Ph: 2000, Pc: 2000, C: 200000, Rth: 0.01, ta: 10, lo: 5, hi: 35, w: 21, wMin: 16, wMax: 28, Ts: 20, timeScale: 60, tUnit: 'min', h: 1, spanS: 14400, zMax: 1500, zSign: 1, hyst: 1, hystMax: 10, req: 'direkt', tHold: 20 }
  };
  const DEV_IDS = ['heizen', 'kuehlen', 'beides'];

  const CONTROLS = [
    { key: 'device', label: 'Gerät', type: 'select', value: 'heizen', options: [{ value: 'heizen', label: 'Bügeleisen (heizen)' }, { value: 'kuehlen', label: 'Kühlschrank (kühlen)' }, { value: 'beides', label: 'Klimagerät (heizen und kühlen)' }], group: 'Gerät und Störung', help: 'Welches Gerät geregelt wird. Beim Wechsel starten Sollwert, Schaltdifferenz und Wirkungssinn mit den Werten des Geräts.' },
    { key: 'power', label: 'Netzschalter', type: 'switch', value: true, group: 'Gerät und Störung', help: 'Ohne Netz schaltet das Gerät nichts ein, der Regler ist stromlos.' },
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'auto', options: [{ value: 'hand', label: 'Hand' }, { value: 'auto', label: 'Automatik' }], group: 'Regler', help: 'Hand: Du schaltest Heizen oder Kühlen selbst ein. Automatik: Der Thermostat schaltet. Der Zweipunktregler schaltet sofort, ein stoßfreies Umschalten gibt es hier nicht.' },
    { key: 'ctrl', label: 'Reglerart', type: 'select', value: '2P', options: [{ value: '2P', label: 'Zweipunkt' }, { value: '3P', label: 'Dreipunkt' }], group: 'Regler', help: 'Zweipunkt: ein oder aus. Dreipunkt (nur Klimagerät): heizen, nichts tun oder kühlen, dazwischen liegt die Totzone.' },
    { key: 'dir', label: 'Wirkungssinn', type: 'select', value: 'direkt', options: [{ value: 'direkt', label: 'direkt' }, { value: 'invers', label: 'invers' }], group: 'Regler', help: 'Direkt: Der Regler schaltet ein, wenn der Istwert unter dem Sollwert liegt (Heizen). Invers: Er schaltet ein, wenn der Istwert darüber liegt (Kühlen).' },
    { key: 'w', label: 'Sollwert w', type: 'slider', min: DEV.heizen.wMin, max: DEV.heizen.wMax, step: 1, unit: '°C', value: DEV.heizen.w, group: 'Regler', help: 'Gewünschte Temperatur (Sollwert). Der Regler schaltet um diesen Wert herum.' },
    { key: 'hyst', label: 'Schaltdifferenz Δ', type: 'slider', min: 0.2, max: DEV.heizen.hystMax, step: 0.2, unit: 'K', value: DEV.heizen.hyst, group: 'Regler', help: 'Schaltdifferenz: Abstand zwischen Einschalt- und Ausschaltpunkt. Die tatsächliche Schwankungsbreite der Temperatur ist wegen des trägen Fühlers größer.' },
    { key: 'dead', label: 'Totzone', type: 'slider', min: 0, max: 5, step: 0.1, unit: 'K', value: 1, group: 'Regler', visible: (st) => st.ctrl === '3P', help: 'Halbe Breite der Totzone beim Dreipunktregler: Innerhalb passiert nichts, weder Heizen noch Kühlen.' },
    { key: 'fb', label: 'Thermische Rückführung', type: 'slider', min: 0, max: 10, step: 0.1, unit: 'K', value: 0, group: 'Regler', help: 'Beschleuniger: Der Regler tut so, als wäre der Fühler um diesen Betrag wärmer (beim Heizen) oder kälter (beim Kühlen), solange das Gerät arbeitet. Das schaltet früher ab und verkleinert die Schwankungsbreite, erhöht aber die Zahl der Schaltspiele.' },
    { key: 'lockout', label: 'Wiedereinschaltsperre', type: 'select', value: 'aus', options: [{ value: 'aus', label: 'aus' }, { value: '3min', label: (LOCK_S / 60) + ' min' }], group: 'Regler', visible: (st) => st.device === 'kuehlen', help: 'Schutz des Verdichters: Nach dem Ausschalten darf er für diese Zeit nicht wieder starten.' },
    { key: 'yHand', label: 'Handstellgröße', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'Regler', visible: (st) => st.mode === 'hand', help: 'Handbetrieb: Über der Mitte ist das Gerät an (Klimagerät: über drei Vierteln heizt es, unter einem Viertel kühlt es).' },
    { key: 'z', label: 'Störwärme Pz', type: 'slider', min: 0, max: DEV.heizen.zMax, step: 10, unit: 'W', value: 0, group: 'Gerät und Störung', help: 'Störgröße: Beim Bügeleisen entzieht das Bügelgut Wärme, beim Kühlschrank bringt eine offene Tür oder warme Ware Wärme hinein, beim Klimagerät sind es Personen.' },
    { key: 'noise', label: 'Messrauschen', type: 'slider', min: 0, max: 5, step: 0.1, unit: '%', value: 0, group: 'Gerät und Störung', help: 'Rauschen des Fühlers in Prozent des Messbereichs.' }
  ];
  const METERS = [
    { key: 'temp', label: 'Temperatur', unit: '°C', digits: 1, min: DEV.heizen.lo, max: DEV.heizen.hi },
    { key: 'sensorTemp', label: 'Fühlertemperatur', unit: '°C', digits: 1, min: DEV.heizen.lo, max: DEV.heizen.hi },
    { key: 'sw', label: 'Schaltzustand', unit: '', digits: 0, min: -1, max: 1 },
    { key: 'period', label: 'Schaltspielzeit', unit: 's', digits: 0, min: 0, max: 600 },
    { key: 'ed', label: 'Einschaltdauer', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'swing', label: 'Schwankungsbreite', unit: 'K', digits: 1, min: 0, max: 50 },
    { key: 'spph', label: 'Schaltspiele je Stunde', unit: '1/h', digits: 0, min: 0, max: 600 },
    { key: 'tMax', label: 'Höchsttemperatur', unit: '°C', digits: 1, min: DEV.heizen.lo, max: DEV.heizen.hi },
    { key: 'tMin', label: 'Tiefsttemperatur', unit: '°C', digits: 1, min: DEV.heizen.lo, max: DEV.heizen.hi }
  ];
  const ROLES = {
    heizen: { w: 'Solltemperatur der Sohle', x: 'Sohlentemperatur', y: 'Heizung ein oder aus', z: 'Wärmeentzug durch das Bügelgut', stell: 'Heizwendel mit Schaltkontakt', mess: 'Bimetall' },
    kuehlen: { w: 'Solltemperatur im Kühlschrank', x: 'Innentemperatur', y: 'Verdichter ein oder aus', z: 'Wärmeeintrag (Tür, warme Ware)', stell: 'Verdichter mit Schaltkontakt', mess: 'Bimetall-Thermostat' },
    beides: { w: 'Solltemperatur im Raum', x: 'Raumtemperatur', y: 'Heizen, Aus oder Kühlen', z: 'Wärme von Personen', stell: 'Heiz- und Kühlregister', mess: 'Raumfühler' }
  };
  const PRESETS = [
    { id: 'bue150', name: 'Bügeleisen ' + DEV.heizen.w + ' °C', params: { controls: { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 6, fb: 0, z: 0, noise: 0, power: true }, op: { x: 150 } } },
    { id: 'hystgross', name: 'Schaltdifferenz groß', params: { controls: { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 30, fb: 0, z: 0, noise: 0, power: true }, op: { x: 150 } } },
    { id: 'hystklein', name: 'Schaltdifferenz klein', params: { controls: { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 2, fb: 0, z: 0, noise: 0, power: true }, op: { x: 150 } } },
    { id: 'kuehl', name: 'Kühlschrank (invers)', params: { controls: { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'invers', w: 5, hyst: 2, fb: 0, lockout: 'aus', z: 0, noise: 0, power: true }, op: { x: 5 } } },
    { id: 'kuehlsperre', name: 'Kühlschrank mit Wiedereinschaltsperre', params: { controls: { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'invers', w: 5, hyst: 2, fb: 0, lockout: '3min', z: 0, noise: 0, power: true }, op: { x: 5 } } },
    { id: 'klima3p', name: 'Klimagerät Dreipunkt', params: { controls: { device: 'beides', mode: 'auto', ctrl: '3P', dir: 'direkt', w: 21, hyst: 1, dead: 1, fb: 0, z: 0, noise: 0, power: true }, op: { x: 21 } } }
  ];
  const INFO = 'Übungsanlage: Zweipunktregler mit Bimetall-Thermostat an drei Geräten. Die Schaltdifferenz ist nicht die Schwankungsbreite: Der träge Fühler lässt die Temperatur über die Schaltpunkte hinauslaufen. Probiere Schaltdifferenz, thermische Rückführung und beim Kühlschrank die wirkungsrichtige (inverse) Einstellung.';

  R.register({ id: ID, name: 'Thermostat (Zweipunktregler)', icon: '🌡️', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS, create(opts) { return createRig(opts || {}); } });

  function createRig(opts) {
    const CORE = getCore();
    const fmt = fmtWith(CORE), tfmt = tfmtWith(CORE);
    const over = Object.assign({}, opts.params || {});
    if (over.sensorTau != null) over.Ts = over.sensorTau;
    const defs = CONTROLS.map(c => Object.assign({}, c));
    const def = {}; defs.forEach(c => { def[c.key] = c; });
    const meters = METERS.map(m => Object.assign({}, m));
    const ctl = {}; defs.forEach(c => { ctl[c.key] = c.value; });
    const ev = makeEvents(80);
    let D = null, P = null, devId = 'heizen', h = 0.1, lo = 0, hi = 250, rg = 250;
    let tr = null, S, se = null, cobj = null, recEvery = 1, deviceRev = 0;
    const pct = (v) => (v - lo) / rg * 100;
    const phys = (p) => lo + p * rg / 100;
    const dirS = () => ctl.dir === 'invers' ? -1 : 1;
    const say = (text, kind, fx, quiet, id) => ev.add(S ? S.t : 0, text, kind, fx, 300, 300, quiet, id);
    const k2p = (K) => K / rg * 100;

    function setupDevice(id) {
      devId = DEV[id] ? id : 'heizen';
      D = DEV[devId];
      P = Object.assign({}, D, over);
      P.Ts = Math.max(0, num(P.Ts, D.Ts));
      h = P.h; lo = P.lo; hi = P.hi; rg = hi - lo;
      recEvery = Math.max(1, Math.round(P.spanS / 1200 / h));
      tr = makeTrace(12000, ['w', 'x', 'y', 'z', 'e'], ['xm', 'sw', 'wPct', 'xPct', 'ePct']);
      ctl.device = devId;
      const set = (k, patch) => Object.assign(def[k], patch);
      set('w', { min: P.wMin, max: P.wMax, value: P.w, unit: '°C' });
      set('hyst', { max: P.hystMax, value: P.hyst });
      set('z', { max: P.zMax });
      set('dir', { value: P.req });
      set('device', { value: devId });
      meters.forEach(m => { if (['temp', 'sensorTemp', 'tMax', 'tMin'].includes(m.key)) { m.min = lo; m.max = hi; } });
      deviceRev++;
    }
    function deviceDefaults() {
      ctl.w = P.w; ctl.hyst = P.hyst; ctl.z = 0; ctl.dir = P.req; ctl.lockout = 'aus'; ctl.dead = Math.min(ctl.dead, 5);
      if (ctl.ctrl === '3P' && devId !== 'beides') ctl.ctrl = '2P';
    }
    const zSigned = () => P.zSign * ctl.z;
    // Beharrungstemperatur bei Schaltzustand (sH, sC) und Stoerwaerme
    const thInf = (sH, sC, z) => P.ta + P.Rth * (P.Ph * sH - P.Pc * sC + P.zSign * (z == null ? ctl.z : z));
    const tau = () => P.Rth * P.C;
    // y -> Schaltzustand des Geraets
    function actOf(y) {
      if (devId === 'heizen') return { sH: y > 50 ? 1 : 0, sC: 0 };
      if (devId === 'kuehlen') return { sH: 0, sC: y > 50 ? 1 : 0 };
      return { sH: y > 75 ? 1 : 0, sC: y < 25 ? 1 : 0 };
    }
    const primary = (sH, sC) => devId === 'kuehlen' ? sC : sH;

    // ---------- Regler ----------
    function buildSpec() {
      return { type: ctl.ctrl, Kp: 1, Tn: 10, Tv: 0, N: 10, Ta: h, u0: 0, ymin: 0, ymax: 100, aw: 'aus', Tr: null, dOn: 'x', dir: ctl.dir,
        hyst: k2p(ctl.hyst), dead: ctl.ctrl === '3P' ? k2p(ctl.dead) : 0, yOn: 100, yOff: devId === 'beides' ? 50 : 0, yPlus: 100, yZero: 50, yMinus: 0 };
    }
    function ctlState() { // Schaltzustand des Reglers aus der letzten Stellgroesse
      if (!S) return 0;
      if (ctl.ctrl === '3P') return S.yc >= 75 ? 1 : S.yc <= 25 ? -1 : 0;
      return S.yc >= 75 ? 1 : 0;
    }
    function rebuild(prime) {
      const spec = buildSpec();
      const c = CORE.controller(spec, h);
      if (!c || c.ok === false) { say(((c && c.why) || 'Reglerparameter ungültig') + ' (letzter Wert bleibt)', 'warn'); return false; }
      const old = prime ? ctlState() : 0;
      cobj = c;
      if (old !== 0) { // Schaltzustand des alten Reglers uebernehmen (Hysterese nicht verlieren)
        const wP = pct(ctl.w);
        cobj.step(wP, wP - dirS() * old * 1000);
      }
      return true;
    }

    function initState() {
      const th0 = P.ta;
      se = CORE.sensor({ T: P.Ts, noise: ctl.noise, seed: 1 }); se.reset(pct(th0));
      S = { t: 0, n: 0, acc: 0, th: th0, xs: th0, xm: th0, sf: 0, sH: 0, sC: 0, yc: 0, y: 0, lockUntil: -1, locked: false, edgeT: null, cur: null, cycles: [],
        ever: 0, act: {}, rec: 0, thr: false, onT: 0, offT: 0, swingMax: 0, lastDiag: [] };
      tr.clear(); ev.clear();
      rebuild(false);
    }
    function place(sH, sC, th0) {
      const th = th0 != null ? th0 : thInf(sH, sC);
      S.th = th; S.xs = th; S.xm = th; S.sH = sH; S.sC = sC; se.reset(pct(th));
      S.sf = sH ? 1 : sC ? -1 : 0;
      S.y = sH ? 100 : sC ? 0 : (devId === 'beides' ? 50 : 0); S.yc = S.y;
      S.edgeT = null; S.cycles = []; S.cur = null;
    }
    function setOperatingPoint(yP, x0) {   // optional x0: Starttemperatur (Grad C), sonst Beharrungszustand fuer y
      const y = clamp(num(yP, NaN), 0, 100); if (!fin(y)) return false;
      const xs0 = num(x0, NaN);
      ctl.mode = 'hand'; ctl.yHand = y;
      const a = actOf(y); place(a.sH, a.sC, fin(xs0) ? xs0 : undefined);
      S.y = y; S.yc = y;
      return true;
    }
    function steady(yP, zVal) {
      const y = clamp(num(yP, 0), 0, 100), a = actOf(y);
      return thInf(a.sH, a.sC, zVal == null ? ctl.z : num(zVal, ctl.z));
    }
    function linBlocks() {
      const Pm = devId === 'kuehlen' ? P.Pc : P.Ph;
      const b = [{ t: 'K', K: (Pm / 100) * P.Rth / rg * 100 }, { t: 'PT1', T: tau() }];
      if (P.Ts > 0) b.push({ t: 'PT1', T: P.Ts });
      return b;
    }

    // ---------- Kernschritt ----------
    function coreStep() {
      const hand = ctl.mode === 'hand';
      // 1 Sollwert (keine Rampe am Thermostat)
      const wP = pct(ctl.w);
      // 2 Fuehler (Bimetall, aus theta des Vorschritts) und thermische Rueckfuehrung
      const xmP = se.step(pct(S.th), h);
      S.xs = phys(se.value()); S.xm = phys(xmP);
      const xr = S.xm + ctl.fb * S.sf;
      // 3 Reglerschritt (Netz muss anliegen)
      if (ctl.power) { if (!hand) S.yc = cobj.step(wP, pct(xr)); }
      S.y = !ctl.power ? 0 : hand ? ctl.yHand : S.yc;
      // 4 Schaltzustaende, Wiedereinschaltsperre
      let a = ctl.power ? actOf(S.y) : { sH: 0, sC: 0 };
      S.locked = false;
      if (devId === 'kuehlen' && ctl.lockout === '3min' && a.sC && !S.sC && S.t < S.lockUntil) { a = { sH: 0, sC: 0 }; S.locked = true; }
      const prev = primary(S.sH, S.sC), cur = primary(a.sH, a.sC);
      if (devId === 'kuehlen' && S.sC && !a.sC) S.lockUntil = S.t + LOCK_S;
      const changed = a.sH !== S.sH || a.sC !== S.sC;
      S.sH = a.sH; S.sC = a.sC;
      if (changed) clickEvent();
      S.sf += (1 - Math.exp(-h / TFB)) * ((S.sH ? 1 : S.sC ? -1 : 0) - S.sf);
      // 5 Waermespeicher (exakt)
      const th0 = S.th, tinf = thInf(S.sH, S.sC), ex = Math.exp(-h / tau());
      S.th = tinf + (th0 - tinf) * ex;
      if (!fin(S.th)) S.th = P.ta;
      S.n++; S.t = S.n * h;   // Zeit aus der Schrittzahl: keine Rundungsdrift
      // Schaltspiel-Statistik
      if (cur && !prev) { if (S.edgeT != null && S.cur) { S.cycles.push({ dur: S.t - S.edgeT, onT: S.cur.onT, tMax: S.cur.tMax, tMin: S.cur.tMin }); if (S.cycles.length > 3) S.cycles.shift(); } S.edgeT = S.t; S.cur = { onT: 0, tMax: S.th, tMin: S.th }; }
      if (S.cur) { if (cur) S.cur.onT += h; if (S.th > S.cur.tMax) S.cur.tMax = S.th; if (S.th < S.cur.tMin) S.cur.tMin = S.th; }
      // 6 Spur
      if (S.n % recEvery === 0) { tr.push(S.t, liveSample()); S.rec++; }
      // 7 Meldungen
      if (S.n % 50 === 0) evaluate();
    }
    function clickEvent() {
      let txt;
      if (devId === 'heizen') txt = S.sH ? 'Die Heizung schaltet ein.' : 'Die Heizung schaltet aus.';
      else if (devId === 'kuehlen') txt = S.sC ? 'Der Verdichter schaltet ein.' : 'Der Verdichter schaltet aus.';
      else txt = S.sH ? 'Das Klimagerät heizt.' : S.sC ? 'Das Klimagerät kühlt.' : 'Das Klimagerät schaltet auf Aus.';
      say(txt, 'info', 'tick', true);
    }
    function liveSample() {
      const e = dirS() * (pct(ctl.w) - pct(S.th)) * rg / 100;
      return { t: S.t, w: ctl.w, x: S.th, y: S.y, z: ctl.z, e, xm: S.xm, sw: swVal(), wPct: pct(ctl.w), xPct: pct(S.th), ePct: dirS() * (pct(ctl.w) - pct(S.th)) };
    }
    function swVal() { return ctl.ctrl === '3P' ? (S.sH ? 1 : S.sC ? -1 : 0) : (primary(S.sH, S.sC) ? 1 : 0); }

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
      let dtS = dtMs / 1000 * P.timeScale;
      if ((S.acc + dtS) / h > MAX_FRAME_STEPS) {
        dtS = Math.max(0, MAX_FRAME_STEPS * h - S.acc); S.thr = true;
        if (!S.act.drossel) { S.act.drossel = 1; say(rigText(CORE, 'zeitraffer', 'Zeitraffer gedrosselt'), 'info'); }
      } else if (S.thr) { S.thr = false; delete S.act.drossel; }
      stepProcess(dtS);
    }

    // ---------- Kennwerte des Schaltspiels ----------
    function cycStats() {
      const c = S.cycles;
      if (!c.length) return { n: 0, period: 0, ed: 0, swing: 0, tMax: S.th, tMin: S.th, spph: 0 };
      let dur = 0, on = 0, mx = -Infinity, mn = Infinity;
      c.forEach(q => { dur += q.dur; on += q.onT; if (q.tMax > mx) mx = q.tMax; if (q.tMin < mn) mn = q.tMin; });
      const period = dur / c.length;
      return { n: c.length, period, ed: dur > 0 ? 100 * on / dur : 0, swing: mx - mn, tMax: mx, tMin: mn, spph: period > 0 ? 3600 / period : 0 };
    }
    // Referenz nach Formel (ohne Fuehlerverzoegerung): REG_CORE.twoPoint.period (negatives Ph = Kuehlen)
    function reference() {
      const heat = devId !== 'kuehlen';
      let q = null;
      try { q = CORE.twoPoint.period({ Ph: heat ? P.Ph : -P.Pc, R: P.Rth, C: P.C, thetaA: P.ta, w: ctl.w, hyst: ctl.hyst, Pz: zSigned() }); } catch (e) { q = null; }
      if (!q || q.ok === false) return { ok: false, why: (q && q.why) || 'Der Rechenkern (regcore.js) ist nicht vollständig geladen.' };
      return { ok: true, tEin: q.tEin, tAus: q.tAus, T: q.T, ED: q.ED, f: q.f, swing: q.swing };
    }

    function oscNow() {
      if (S.oscRec === S.rec && S.oscCache) return S.oscCache;
      const win = P.spanS / 3, d = tr.get(S.t - win, 600, null);
      let r = { cls: 'aperiodisch', period: 0, amp: 0, ratio: 0, limited: false };
      if (d.t.length >= 30 && d.t[d.t.length - 1] - d.t[0] >= win * 0.9) r = oscClass(CORE, d.t, d.x, rg, ctl.noise);
      S.oscCache = r; S.oscRec = S.rec; return r;
    }
    function cl(v) { return fin(v) ? clamp(v, lo - LIMIT_PCT * rg / 100, hi + LIMIT_PCT * rg / 100) : lo; }
    function meterVals() {
      const c = cycStats();
      return { temp: cl(S.th), x: cl(S.th), w: ctl.w, sensorTemp: cl(S.xm), sw: swVal(), period: c.period, ed: c.ed, swing: c.swing, spph: c.spph, tMax: cl(c.tMax), tMin: cl(c.tMin),
        y: clamp(S.y, 0, 100), e: clamp(dirS() * (ctl.w - S.th), -LIMIT_PCT * rg / 100, LIMIT_PCT * rg / 100) };
    }
    function readMeters() { const m = meterVals(); Object.keys(m).forEach(k => { if (!fin(m[k])) m[k] = 0; }); return m; }

    // ---------- Diagnose: Kern (REG_CORE.diagnose) liefert Texte und Bedingungen; hier nur die geprueften Messwerte (SPEC 4.11) ----------
    function diagCtx() {
      const hand = ctl.mode === 'hand', c0 = cycStats();
      const c = { ctrl: ctl.ctrl, mode: ctl.mode, dir: ctl.dir, requiredDir: P.req, tUnit: P.tUnit, unit: 'K' };
      if (!hand && ctl.ctrl === '2P' && P.Ts > 0) {
        if (c0.n >= 2) { c.period = c0.period; c.Ts = P.Ts; }
        if (c0.n >= 1 && c0.swing > ctl.hyst * 1.02) { c.swing = c0.swing; c.hyst = ctl.hyst; }
      }
      if (S.locked) c.lockoutLeft = Math.max(0, S.lockUntil - S.t);
      return c;
    }
    function diagnose() {
      if (!S) return [];
      let out = [];
      try { out = CORE.diagnose(diagCtx()) || []; } catch (e) { out = []; }
      if (!Array.isArray(out)) out = [];
      out = out.map(d => d.id === 'hand' ? { id: 'hand', kind: 'info', text: 'Handbetrieb: Der Regler ist abgeschaltet. ' + rigText(CORE, 'zweipunkt', 'Zweipunktregler: Stellgröße schaltet sofort') + '.' } : d);
      if (ctl.mode !== 'hand' && ctl.dir === P.req) {
        const hot = thInf(1, 0), cold = thInf(0, 1);
        if (devId !== 'kuehlen' && P.Ph > 0 && hot < ctl.w && ctl.w >= P.ta) out.push({ id: 'zu-klein', kind: 'warn', text: 'Das Soll ist nicht erreichbar: Das Gerät kann höchstens ' + fmt(hot, 1) + ' °C erreichen, du verlangst ' + fmt(ctl.w, 1) + ' °C.' });
        else if ((devId === 'kuehlen' || (devId === 'beides' && ctl.ctrl === '3P')) && P.Pc > 0 && cold > ctl.w && ctl.w <= P.ta) out.push({ id: 'zu-klein', kind: 'warn', text: 'Das Soll ist nicht erreichbar: Das Gerät kann höchstens bis ' + fmt(cold, 1) + ' °C abkühlen, du verlangst ' + fmt(ctl.w, 1) + ' °C.' });
      }
      return out;
    }
    function evaluate() {
      const list = diagnose(), now = {};
      list.forEach(d => { now[d.id] = 1; if (!S.act[d.id]) say(d.text, d.kind, d.fx, false, d.id); });
      S.act = Object.assign(now, S.thr ? { drossel: 1 } : {});
      S.lastDiag = list;
    }

    // ---------- Steuerwerte ----------
    function setDevice(id) {
      if (!DEV[id]) return false;
      setupDevice(id); deviceDefaults(); initState(); return true;
    }
    function setControl(key, value) {
      const d = def[key];
      if (!d) return false;
      if (key === 'ctrl' && ['P', 'I', 'PI', 'PD', 'PID', '2P', '3P'].includes(value) && (!d.options.some(o => o.value === value) || (value === '3P' && devId !== 'beides'))) { say(rigText(CORE, 'reglerart', 'Diese Reglerart gibt es an dieser Anlage nicht.'), 'warn'); return false; }
      const c = coerce(d, value);
      if (!c.ok) return false;
      const v = c.v;
      if (key === 'device') return v === devId ? true : setDevice(v);
      const old = ctl[key];
      ctl[key] = v;
      if (key === 'mode') {
        if (v === 'hand' && old === 'auto') ctl.yHand = clamp(S.y, 0, 100);
        if (v === 'auto' && old === 'hand') { say(rigText(CORE, 'zweipunkt', 'Zweipunktregler: Stellgröße schaltet sofort'), 'info'); S.yc = ctl.yHand; }
      } else if (key === 'noise') { se.setNoise(v);
      } else if (['ctrl', 'dir', 'hyst', 'dead'].includes(key)) {
        if (!rebuild(key !== 'ctrl')) { ctl[key] = old; return false; }
      }
      return true;
    }
    function getControl(key) { return def[key] ? ctl[key] : undefined; }

    function applyPreset(id) {
      const p = PRESETS.find(q => q.id === id); if (!p) return false;
      const c = p.params.controls || {};
      if (c.device && DEV[c.device]) { setupDevice(c.device); deviceDefaults(); } else reset();
      Object.keys(c).forEach(k => { if (k === 'device') return; const cc = coerce(def[k], c[k]); if (cc.ok) ctl[k] = cc.v; });
      initState();
      const op = p.params.op;
      if (op) { if (ctl.mode === 'hand') { const a = actOf(ctl.yHand); place(a.sH, a.sC, op.x); } else place(0, 0, op.x); }
      return true;
    }
    function reset() { initState(); }

    function traceOut(spanS) {
      const sp = fin(spanS) && spanS > 0 ? spanS : P.spanS;
      const d = tr.get(S.t - sp, 600, liveSample());
      return { t: d.t, w: d.w, x: d.x, y: d.y, z: d.z, e: d.e, extra: d.extra };
    }
    function state() {
      const m = readMeters(), c = cycStats();
      const ids = diagnose().map(d => d.id);
      const tiv = thInf(S.sH, S.sC);
      return {
        t: S.t, w: ctl.w, x: m.x, y: m.y, z: ctl.z, e: m.e,
        wPct: pct(ctl.w), xPct: pct(m.x), yPct: m.y, ePct: dirS() * (pct(ctl.w) - pct(S.th)),
        mode: ctl.mode, ctrl: ctl.ctrl, kp: 1, tn: 0, tv: 0, ta: h, dir: ctl.dir, ymax: 100,
        satHigh: false, satLow: false, windup: 0, osc: oscNow().cls, faults: ids,
        device: devId, power: !!ctl.power, sw: m.sw, heating: !!S.sH, cooling: !!S.sC, locked: S.locked, lockUntil: S.lockUntil,
        temp: m.temp, sensorTemp: m.sensorTemp, period: c.period, ed: c.ed, swing: c.swing, spph: c.spph, tMax: m.tMax, tMin: m.tMin, cycles: c.n,
        hystK: ctl.hyst, deadK: ctl.dead, fb: ctl.fb, ta0: P.ta, thInf: tiv, tau: tau(), Ts: P.Ts, sf: S.sf,
        timeScale: P.timeScale, tUnit: P.tUnit, thr: S.thr, throttled: S.thr, xm: m.sensorTemp, wSet: ctl.w, oscInfo: (function (o) { return { period: isFinite(o.period) ? o.period : 0, amp: isFinite(o.amp) ? o.amp : 0, ratio: isFinite(o.ratio) ? o.ratio : 0, limited: false }; })(oscNow())
      };
    }

    // ---------- Kennlinien ----------
    function curves() {
      const dl = ctl.hyst, dd = ctl.ctrl === '3P' ? ctl.dead : 0, e0 = Math.max(dl, 1) * 2 + dd;
      const lv = ctl.ctrl === '3P' ? [0, 50, 100] : [devId === 'beides' ? 50 : 0, devId === 'beides' ? 50 : 0, 100];
      const up = [], down = [];
      if (ctl.ctrl === '3P') {
        up.push([-e0, lv[0]], [-dd + dl / 2, lv[0]], [-dd + dl / 2, lv[1]], [dd + dl / 2, lv[1]], [dd + dl / 2, lv[2]], [e0, lv[2]]);
        down.push([-e0, lv[0]], [-dd - dl / 2, lv[0]], [-dd - dl / 2, lv[1]], [dd - dl / 2, lv[1]], [dd - dl / 2, lv[2]], [e0, lv[2]]);
      } else {
        up.push([-e0, lv[0]], [dl / 2, lv[0]], [dl / 2, lv[2]], [e0, lv[2]]);
        down.push([-e0, lv[0]], [-dl / 2, lv[0]], [-dl / 2, lv[2]], [e0, lv[2]]);
      }
      const eNow = clamp(dirS() * (ctl.w - S.xm), -e0, e0);
      const dth = (P.Ph * S.sH - P.Pc * S.sC + P.zSign * ctl.z - (S.th - P.ta) / P.Rth) / P.C;
      const d = tr.get(S.t - P.spanS, 300, null), ph = [];
      for (let i = 2; i < d.t.length; i++) { const dt = d.t[i] - d.t[i - 2]; if (dt > 0) ph.push([+d.x[i - 1].toFixed(3), +((d.x[i] - d.x[i - 2]) / dt).toFixed(5)]); }
      const ref = reference(), sawT = [], sawX = [];
      if (ref.ok) {
        const wo = ctl.w + dl / 2, wu = ctl.w - dl / 2, heat = devId !== 'kuehlen', k = 24;
        const tau0 = tau(), tOn = thInf(heat ? 1 : 0, heat ? 0 : 1), tOff = thInf(0, 0);
        for (let cyc = 0; cyc < 2; cyc++) {
          for (let i = 0; i <= k; i++) { const tt = ref.tEin * i / k, a0 = heat ? wu : wo; sawT.push([+((cyc * ref.T + tt) / (P.tUnit === 's' ? 1 : 60)).toFixed(3), +(tOn + (a0 - tOn) * Math.exp(-tt / tau0)).toFixed(3)]); }
          for (let i = 0; i <= k; i++) { const tt = ref.tAus * i / k, a0 = heat ? wo : wu; sawT.push([+((cyc * ref.T + ref.tEin + tt) / (P.tUnit === 's' ? 1 : 60)).toFixed(3), +(tOff + (a0 - tOff) * Math.exp(-tt / tau0)).toFixed(3)]); }
        }
      }
      const cs = cycStats();
      return [
        { id: 'schalt', title: 'Schaltkennlinie des Reglers (Hysterese)', xLabel: 'Regeldifferenz e', xUnit: 'K', yLabel: 'Ausgang des Reglers', yUnit: '%', series: [{ name: 'e wächst', points: up }, { name: 'e fällt', points: down }], marker: { x: eNow, y: S.yc } },
        { id: 'phase', title: 'Phasenbild: Temperatur und Änderungsgeschwindigkeit', xLabel: 'Temperatur', xUnit: '°C', yLabel: 'Änderungsgeschwindigkeit', yUnit: 'K/s', series: [{ name: 'Verlauf (Grenzzyklus)', points: ph }], marker: { x: cl(S.th), y: dth } },
        { id: 'referenz', title: 'Schaltspiel nach der Formel (ohne Fühlerverzögerung)', xLabel: 'Prozesszeit', xUnit: P.tUnit, yLabel: 'Temperatur', yUnit: '°C', series: [{ name: 'Formel (Periode ' + (ref.ok ? fmt(ref.T, 0) + ' s' : 'nicht definiert') + ')', points: sawT, dashed: true }], marker: { x: 0, y: cl(S.th) }, ref: ref.ok ? { T: ref.T, ED: ref.ED, measuredT: cs.period, measuredED: cs.ed } : { why: ref.why } }
      ];
    }

    function analysis() {
      return { blocks: linBlocks(), V0: NaN, margins: { ok: false, why: 'Für Schaltregler gibt es keinen Frequenzgang (nichtlinear).' }, linearised: false, info: { device: devId, tau: tau(), Ts: P.Ts, thInfOn: thInf(1, 0) } };
    }
    function identify() {
      if (typeof CORE.identify === 'function') { try { return CORE.identify(linBlocks()); } catch (e) { return { ok: false, why: 'Die Identifikation ist nicht möglich.' }; } }
      return { ok: false, why: 'Der Rechenkern (regcore.js) ist nicht vollständig geladen.' };
    }

    // ---------- Zeichnen ----------
    const KN = { x: 550, y: 312, r: 38 }, PW = [490, 402, 124, 40];
    function hitTest(px, py, w, h2) {
      const p = toWorld(px, py, w, h2, W, H); if (!p) return null;
      if (p.x >= PW[0] && p.x <= PW[0] + PW[2] && p.y >= PW[1] && p.y <= PW[1] + PW[3]) return { key: 'power', kind: 'switch', to: !ctl.power, value: !ctl.power };
      const dx = p.x - KN.x, dy = p.y - KN.y;
      if (dx * dx + dy * dy <= (KN.r + 14) * (KN.r + 14)) {
        const ang = Math.atan2(dx, -dy) * 180 / Math.PI, f = clamp((ang + 135) / 270, 0, 1);
        const v = Math.round(P.wMin + f * (P.wMax - P.wMin));   // Antippen des Knopfes setzt den Sollwert auf den angetippten Winkel
        return { key: 'w', kind: 'switch', to: v, value: v };
      }
      return null;
    }
    function drawBimetal(ctx, t) {
      const x0 = 492, y0 = 190, L = 112, ref = Math.max(ctl.hyst, 0.5);
      const bend = clamp((S.xs - ctl.w) / ref, -1.5, 1.5) * 12;
      rr(ctx, 470, 96, 158, 180, 12); ctx.fillStyle = COL.panel; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'Thermostat', 549, 114, 14, COL.dim, 'center', '800');
      ctx.fillStyle = '#4a5663'; ctx.fillRect(x0 - 14, y0 - 22, 14, 44);
      ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 7; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + L * 0.55, y0 - bend * 0.25, x0 + L, y0 - bend); ctx.stroke();
      ctx.strokeStyle = '#7d8793'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0 + 5); ctx.quadraticCurveTo(x0 + L * 0.55, y0 + 5 - bend * 0.25, x0 + L, y0 + 5 - bend); ctx.stroke();
      const closed = primary(S.sH, S.sC) === 1, cy = y0 - 12;
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(x0 + L - 12, cy - 22, 24, 7); ctx.fillRect(x0 + L - 3, cy - 22, 6, 28);
      ctx.beginPath(); ctx.arc(x0 + L, cy + 8, 4, 0, TAU); ctx.fillStyle = closed ? COL.ok : COL.bad; ctx.fill();
      txt(ctx, closed ? 'Kontakt zu' : 'Kontakt offen', x0 + L / 2, 232, 12, closed ? COL.ok : COL.bad, 'center', '800');
      txt(ctx, 'Bimetall ' + fmt(S.xs, 1) + ' °C', x0 + L / 2, 252, 12, COL.text, 'center', '700');
      // Sollwert-Drehknopf
      const f = clamp((ctl.w - P.wMin) / (P.wMax - P.wMin), 0, 1), an = (-135 + 270 * f) * Math.PI / 180;
      ctx.beginPath(); ctx.arc(KN.x, KN.y, KN.r, 0, TAU); ctx.fillStyle = '#2d3641'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 3; ctx.stroke();
      for (let i = 0; i <= 10; i++) { const a2 = (-135 + 27 * i) * Math.PI / 180; ctx.strokeStyle = COL.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(KN.x + Math.sin(a2) * (KN.r + 3), KN.y - Math.cos(a2) * (KN.r + 3)); ctx.lineTo(KN.x + Math.sin(a2) * (KN.r + 9), KN.y - Math.cos(a2) * (KN.r + 9)); ctx.stroke(); }
      ctx.strokeStyle = COL.acc; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(KN.x, KN.y); ctx.lineTo(KN.x + Math.sin(an) * (KN.r - 6), KN.y - Math.cos(an) * (KN.r - 6)); ctx.stroke();
      txt(ctx, 'Soll ' + fmt(ctl.w, 0) + ' °C', KN.x, KN.y + KN.r + 26, 13, COL.ok, 'center', '800');
      // Netzschalter
      rr(ctx, PW[0], PW[1], PW[2], PW[3], 10); ctx.fillStyle = ctl.power ? COL.ok : '#1a2026'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, ctl.power ? 'Netz AN' : 'Netz AUS', PW[0] + PW[2] / 2, PW[1] + PW[3] / 2, 15, ctl.power ? '#0b1a10' : COL.dim, 'center', '800');
    }
    function drawDevice(ctx, t, heatK, coolK) {
      const hot = clamp((S.th - lo) / rg, 0, 1);
      if (devId === 'heizen') {
        // Sohle mit Heizwendel, Gehaeuse, Griff
        const sole = mix([110, 118, 128], [255, 90, 40], clamp((S.th - 25) / 175, 0, 1));
        glow(ctx, 250, 400, 240, '255,110,40', clamp((S.th - 60) / 200, 0, 1) * 0.5);
        ctx.fillStyle = rgb(sole); ctx.beginPath(); ctx.moveTo(60, 430); ctx.lineTo(60, 392); ctx.lineTo(420, 392); ctx.lineTo(460, 412); ctx.lineTo(430, 430); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        rr(ctx, 70, 270, 340, 118, 22); ctx.fillStyle = '#3a4350'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6a7886'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(110, 270); ctx.quadraticCurveTo(240, 170, 370, 270); ctx.stroke();
        ctx.strokeStyle = heatK > 0.5 ? 'rgb(255,' + Math.round(150 + 60 * Math.sin(t / 120)) + ',60)' : '#8a6a3a'; ctx.lineWidth = 5; ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const px = 90 + i * 26, py = 372 + (i % 2 ? 10 : -10); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        txt(ctx, 'Heizwendel', 240, 346, 13, COL.dim, 'center', '700'); txt(ctx, 'Sohle ' + fmt(S.th, 0) + ' °C', 200, 412, 14, '#fff', 'center', '800');
        if (S.th >= 0.8 * hi) for (let i = 0; i < 4; i++) { const ph = ((t / 1500 + i * 0.25) % 1); ctx.fillStyle = 'rgba(200,200,210,' + (0.4 * (1 - ph)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(150 + i * 55 + Math.sin(ph * 7 + i) * 8, 260 - ph * 110, 8 + ph * 12, 0, TAU); ctx.fill(); }
        if (ctl.z > 0) { arrow(ctx, 240, 470, 240, 436, 'rgba(110,180,255,0.9)', clamp(2 + ctl.z / 60, 2, 9), 14); txt(ctx, 'Bügelgut entzieht ' + fmt(ctl.z, 0) + ' W', 240, 486, 12, '#8fc4ff', 'center', '700'); }
      } else if (devId === 'kuehlen') {
        const cold = mix([120, 150, 190], [90, 190, 255], 1 - hot);
        rr(ctx, 90, 80, 340, 396, 18); ctx.fillStyle = '#d9dfe6'; ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 3; ctx.stroke();
        rr(ctx, 104, 94, 312, 300, 10); ctx.fillStyle = rgb(cold, 0.55); ctx.fill();
        ctx.strokeStyle = 'rgba(40,60,90,0.5)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(110, 170 + i * 70); ctx.lineTo(410, 170 + i * 70); ctx.stroke(); }
        ctx.strokeStyle = coolK > 0.5 ? '#6fd0ff' : '#5a7a99'; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const px = 120 + i * 28, py = 108 + (i % 2 ? 14 : 0); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        txt(ctx, 'Verdampfer', 260, 140, 12, '#274', 'center', '700');
        rr(ctx, 120, 410, 140, 52, 8); ctx.fillStyle = '#4a5663'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); ctx.translate(190, 436); ctx.rotate(coolK > 0.5 ? t / 90 : 0); ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, 0); ctx.stroke(); } ctx.restore();
        txt(ctx, 'Verdichter', 190, 470, 12, COL.dim, 'center', '700');
        txt(ctx, 'Innen ' + fmt(S.th, 1) + ' °C', 260, 330, 18, '#0c2338', 'center', '800');
        if (S.locked) txt(ctx, 'Sperre', 340, 436, 14, COL.warn, 'center', '800');
        if (ctl.z > 0) { arrow(ctx, 430, 250, 400, 250, 'rgba(255,160,90,0.9)', clamp(2 + ctl.z / 8, 2, 9), 14); txt(ctx, 'Wärmeeintrag ' + fmt(ctl.z, 0) + ' W', 380, 232, 12, COL.warn, 'center', '700'); }
      } else {
        rr(ctx, 60, 130, 400, 270, 18); ctx.fillStyle = '#d9dfe6'; ctx.fill(); ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 3; ctx.stroke();
        const hcol = mix([120, 110, 110], [255, 100, 50], heatK), ccol = mix([110, 120, 130], [60, 170, 255], coolK);
        ctx.strokeStyle = rgb(hcol); ctx.lineWidth = 6; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const px = 90 + i * 14, py = 170 + (i % 2 ? 40 : 0); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        ctx.strokeStyle = rgb(ccol); ctx.beginPath(); for (let i = 0; i <= 8; i++) { const px = 340 + i * 14, py = 170 + (i % 2 ? 40 : 0); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        txt(ctx, 'Heizen', 150, 255, 14, '#7a2a10', 'center', '800'); txt(ctx, 'Kühlen', 400, 255, 14, '#14507a', 'center', '800');
        ctx.save(); ctx.translate(260, 215); ctx.rotate(heatK > 0.5 || coolK > 0.5 ? t / 110 : 0); ctx.fillStyle = '#7d8793'; for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.ellipse(26, 0, 26, 9, 0, 0, TAU); ctx.fill(); } ctx.restore();
        txt(ctx, 'Raum ' + fmt(S.th, 1) + ' °C', 260, 345, 18, '#223', 'center', '800');
        if (ctl.z > 0) txt(ctx, 'Personen ' + fmt(ctl.z, 0) + ' W', 260, 380, 13, COL.warn, 'center', '700');
      }
    }
    function draw(ctx, w, h2, t) {
      t = num(t, 0);
      const s = frame(ctx, w, h2, W, H); if (!s) return;
      const m = meterVals(), cs = cycStats();
      txt(ctx, 'Thermostat-Prüfstand: ' + D.name + ' (Übungsanlage)', 22, 26, 20, COL.text, 'left', '800');
      txt(ctx, 'Prozesszeit ' + tfmt(S.t, P.tUnit) + ' · Regler ' + (ctl.ctrl === '3P' ? 'Dreipunkt' : 'Zweipunkt') + ' · ' + (ctl.mode === 'hand' ? 'Handbetrieb' : 'Automatik'), 22, 48, 13, COL.dim, 'left', '600');
      drawDevice(ctx, t, S.sH ? 1 : 0, S.sC ? 1 : 0);
      drawBimetal(ctx, t);
      const state = S.locked ? 'gesperrt' : S.sH ? (devId === 'beides' ? 'heizt' : 'ein') : S.sC ? (devId === 'beides' ? 'kühlt' : 'ein') : 'aus';
      const cells = [['Temperatur ϑ', fmt(m.temp, 1) + ' °C', COL.text], ['Sollwert w', fmt(m.w, 0) + ' °C', COL.ok], ['Schaltzustand', state, S.sH || S.sC ? COL.warn : COL.dim],
        ['Schaltspielzeit', cs.n ? tfmt(cs.period, P.tUnit) : '–', COL.text], ['Einschaltdauer', cs.n ? fmt(cs.ed, 0) + ' %' : '–', COL.text], ['Schwankung', cs.n ? fmt(cs.swing, 1) + ' K' : '–', cs.n && cs.swing > ctl.hyst * 1.02 ? COL.warn : COL.text]];
      cells.forEach((c, i) => { const x0 = 40 + i * 156; rr(ctx, x0, 508, 146, 62, 10); ctx.fillStyle = COL.panel; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5; ctx.stroke(); txt(ctx, c[0], x0 + 12, 528, 12, COL.dim, 'left', '700'); txt(ctx, c[1], x0 + 12, 551, 20, c[2], 'left', '800'); });
      // Schaltpunkte (Wert am Fuehler) aus dem Regler: Zweipunkt ein/aus, Dreipunkt Heizen/Kuehlen
      const dl = ctl.hyst, dd = ctl.ctrl === '3P' ? ctl.dead : 0, sg = dirS();
      const pts = ctl.ctrl === '3P'
        ? [[ctl.w - sg * (dd + dl / 2), 'Heizen ein'], [ctl.w - sg * (dd - dl / 2), 'Heizen aus'], [ctl.w + sg * (dd - dl / 2), 'Kühlen aus'], [ctl.w + sg * (dd + dl / 2), 'Kühlen ein']]
        : [[ctl.w + dl / 2, sg > 0 ? 'ausschalten' : 'einschalten'], [ctl.w - dl / 2, sg > 0 ? 'einschalten' : 'ausschalten']];
      txt(ctx, 'Schaltdifferenz ' + fmt(ctl.hyst, 1) + ' K' + (ctl.ctrl === '3P' ? ', Totzone ±' + fmt(ctl.dead, 1) + ' K' : ''), 700, 120, 14, COL.text, 'left', '800');
      pts.forEach((q, i) => txt(ctx, q[1] + ' bei ' + fmt(q[0], 1) + ' °C', 700, 146 + i * 20, 13, COL.dim, 'left', '600'));
      txt(ctx, 'Rückführung ' + fmt(ctl.fb, 1) + ' K', 700, 146 + pts.length * 20 + 6, 13, COL.dim, 'left', '600');
      // Schaltband: Schaltpunkte, Fuehler, Temperatur und gemessene Schwankung
      const lo2 = Math.min(...pts.map(q => q[0])), hi2 = Math.max(...pts.map(q => q[0])), mid = (lo2 + hi2) / 2;
      const hs = Math.max((hi2 - lo2) * 0.9, cs.n ? cs.swing * 0.8 : 0, 0.5), bx = 800, by0 = 270, by1 = 480;
      const yv = (v) => by1 - clamp((v - (mid - hs)) / (2 * hs), 0, 1) * (by1 - by0);
      if (ctl.ctrl !== '3P') { ctx.fillStyle = 'rgba(76,217,100,0.18)'; ctx.fillRect(bx - 30, yv(hi2), 60, yv(lo2) - yv(hi2)); }
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by0); ctx.lineTo(bx, by1); ctx.stroke();
      pts.forEach(q => { ctx.strokeStyle = COL.ok; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(bx - 40, yv(q[0])); ctx.lineTo(bx + 40, yv(q[0])); ctx.stroke(); ctx.setLineDash([]); txt(ctx, q[1], bx + 46, yv(q[0]), 11, COL.ok, 'left', '700'); });
      if (cs.n) [[cs.tMax, 'Höchstwert'], [cs.tMin, 'Tiefstwert']].forEach(q => { ctx.strokeStyle = COL.warn; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 40, yv(q[0])); ctx.lineTo(bx + 40, yv(q[0])); ctx.stroke(); txt(ctx, q[1], bx - 46, yv(q[0]), 11, COL.warn, 'right', '700'); });
      ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(bx, yv(S.th), 7, 0, TAU); ctx.fill();
      ctx.fillStyle = COL.acc; ctx.beginPath(); ctx.moveTo(bx + 12, yv(S.xs)); ctx.lineTo(bx + 24, yv(S.xs) - 6); ctx.lineTo(bx + 24, yv(S.xs) + 6); ctx.closePath(); ctx.fill();
      txt(ctx, 'Temperatur (rot) und Fühler (blau)', bx + 20, by0 - 14, 12, COL.dim, 'center', '700');
      ctx.restore();
    }

    // ---------- Aufbau ----------
    setupDevice(opts.device && DEV[opts.device] ? opts.device : 'heizen');
    if (ctl.device !== 'heizen' || devId !== 'heizen') deviceDefaults();
    initState();
    const rig = {
      get id() { return ID; }, get range() { return { lo, hi, unit: '°C', digits: devId === 'heizen' ? 0 : 1 }; }, get timeScale() { return P.timeScale; }, get tUnit() { return P.tUnit; }, get h() { return h; },
      get requiredDir() { return P.req; }, get roles() { return Object.assign({}, ROLES[devId]); }, get params() { return Object.assign({}, P); },
      get presets() { return PRESETS; }, get deviceRev() { return deviceRev; }, get spanS() { return P.spanS; },
      controls: defs, meters, events: ev.list,
      setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, curves, reset,
      worldSize() { return { w: W, h: H }; },
      setOperatingPoint, steady, trace: traceOut, linBlocks, analysis, identify, diagnose, applyPreset, reference
    };
    return rig;
  }

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
