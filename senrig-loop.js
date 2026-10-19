(function (root) {
  'use strict';
  const R = root.SEN_RIGS = root.SEN_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 5: Normsignale und Messumformer (4...20 mA Zweileiter, 0...20 mA, 0...10 V, 1...5 V) =====
  // Eigenes, gekapseltes Modell (bei Bedarf gegen SEN_CORE.circuits.loop420 austauschbar):
  //   Messgroesse (Druck, bar) -> PT1 (0,4 s) -> Signal nach NAMUR NE43 begrenzt (3,8...20,5 mA)
  //   Zweileiter: Messumformer braucht 12 V an den Klemmen, Imax = (Uversorgung - 12 V)/(Buerde + Leitung)
  //   Empfaenger: Buerde -> ADU (Referenz 5 V, N = floor(U/Uref*2^n)), Anzeige skaliert auf lo...hi
  //   Einkopplung: 50 Hz, im Strompfad stark gedaempft (Buerde klein gegen Koppelimpedanz), bei Spannungssignalen kaum
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2, D2R = Math.PI / 180;
  const GREEN = [76, 217, 100], BLUE = [59, 158, 255], AMB = [255, 179, 64], RED = [255, 92, 92];
  const U_MIN = 12, U_REF = 5, R_IN = 100000, R_COUPLE = 10000, I_SHORT_LIM = 40, SUB = 1, ADC_MS = 3, TAU = 400;
  const SIG = {
    '420': { name: '4…20 mA', unit: 'mA', cur: true, lo: 4, hi: 20, min: 3.8, max: 20.5, live: true },
    '020': { name: '0…20 mA', unit: 'mA', cur: true, lo: 0, hi: 20, min: 0, max: 20.5, live: false },
    '010': { name: '0…10 V', unit: 'V', cur: false, lo: 0, hi: 10, min: 0, max: 10.5, live: false },
    '15': { name: '1…5 V', unit: 'V', cur: false, lo: 1, hi: 5, min: 0.8, max: 5.25, live: true }
  };

  const CONTROLS = [
    { key: 'value', label: 'Messgröße (Druck)', type: 'slider', min: 0, max: 16, step: 0.1, unit: 'bar', value: 5, group: 'Messgröße', help: 'Der Druck am Messumformer. Über dem Messbereichsende begrenzt das Signal bei 20,5 mA.' },
    { key: 'lo', label: 'Messbereichsanfang', type: 'slider', min: 0, max: 5, step: 0.5, unit: 'bar', value: 0, group: 'Messumformer', help: 'Bei diesem Druck gibt der Messumformer 4 mA (bzw. 0 V) aus.' },
    { key: 'hi', label: 'Messbereichsende', type: 'slider', min: 2, max: 16, step: 0.5, unit: 'bar', value: 10, group: 'Messumformer', help: 'Bei diesem Druck gibt der Messumformer 20 mA (bzw. 10 V) aus.' },
    { key: 'signal', label: 'Normsignal', type: 'select', value: '420', group: 'Messumformer', options: [{ value: '420', label: '4…20 mA (Zweileiter)' }, { value: '020', label: '0…20 mA' }, { value: '010', label: '0…10 V' }, { value: '15', label: '1…5 V' }], help: '4…20 mA hat einen "lebenden Nullpunkt": 4 mA bedeuten Messwert null, 0 mA bedeuten Fehler.' },
    { key: 'uSupply', label: 'Versorgung', type: 'select', value: 24, group: 'Schleife', options: [{ value: 12, label: '12 V' }, { value: 18, label: '18 V' }, { value: 24, label: '24 V' }, { value: 30, label: '30 V' }], help: 'Das Netzteil der Schleife. Der Zweileiter-Messumformer braucht an seinen Klemmen mindestens 12 V.' },
    { key: 'rBurden', label: 'Bürde (Messwiderstand)', type: 'slider', min: 50, max: 1000, step: 10, unit: 'Ω', value: 250, group: 'Schleife', help: 'Wandelt den Strom in eine Spannung: 20 mA · 250 Ω = 5 V. Zu große Bürde drückt den Messumformer in die Sättigung.' },
    { key: 'rLine', label: 'Leitungswiderstand', type: 'slider', min: 0, max: 500, step: 5, unit: 'Ω', value: 20, group: 'Schleife', help: 'Hin- und Rückleitung zusammen. Er zählt zur Bürde, wenn es um die Spannungsreserve geht.' },
    { key: 'adcBits', label: 'Wandler (Auflösung)', type: 'select', value: 12, group: 'Empfänger', options: [{ value: 8, label: '8 Bit' }, { value: 10, label: '10 Bit' }, { value: 12, label: '12 Bit' }, { value: 16, label: '16 Bit' }], help: 'Der ADU misst die Spannung an der Bürde (Referenz 5 V).' },
    { key: 'emi', label: 'Einkopplung (50 Hz)', type: 'slider', min: 0, max: 500, step: 5, unit: 'mV', value: 0, group: 'Störungen', help: 'Eine Störspannung wird in die Leitung eingekoppelt (z. B. von einer Motorleitung). Stromsignale sind dagegen viel unempfindlicher als Spannungssignale.' },
    { key: 'wireBreak', label: 'Drahtbruch', type: 'switch', value: false, group: 'Störungen', help: 'Unterbricht die Leitung. Bei 4…20 mA fällt der Strom unter 3,6 mA und der Fehler wird erkannt.' },
    { key: 'short', label: 'Kurzschluss', type: 'switch', value: false, group: 'Störungen', help: 'Schließt die Klemmen des Messumformers kurz. Der Strom steigt weit über 21 mA.' }
  ];
  const METERS = [
    { key: 'value', label: 'Messgröße (wahr)', unit: 'bar', digits: 2, min: 0, max: 16 },
    { key: 'iLoop', label: 'Schleifenstrom', unit: 'mA', digits: 2, min: 0, max: 24, warnAbove: 21 },
    { key: 'uBurden', label: 'Spannung an der Bürde', unit: 'V', digits: 2, min: 0, max: 10, warnAbove: 5 },
    { key: 'uAdc', label: 'Spannung am Wandler', unit: 'V', digits: 3, min: 0, max: 6, warnAbove: 5 },
    { key: 'adc', label: 'Zählwert', unit: 'Digit', digits: 0, min: 0, max: 65535 },
    { key: 'shown', label: 'Anzeige (skaliert)', unit: 'bar', digits: 2, min: -4, max: 20 },
    { key: 'error', label: 'Anzeigefehler', unit: '%', digits: 2, min: -100, max: 100 },
    { key: 'headroom', label: 'Spannungsreserve', unit: 'V', digits: 2, min: -10, max: 20 },
    { key: 'uTerm', label: 'Spannung am Messumformer', unit: 'V', digits: 2, min: 0, max: 30 }
  ];
  const PRESETS = [
    { id: 'normal', name: '4…20 mA, 24 V, 250 Ω', params: { signal: '420', uSupply: 24, rBurden: 250, rLine: 20, adcBits: 12, emi: 0, wireBreak: false, short: false, value: 5, lo: 0, hi: 10 } },
    { id: 'buerde', name: 'Bürde zu groß (Sättigung)', params: { signal: '420', uSupply: 24, rBurden: 750, rLine: 20, adcBits: 12, emi: 0, wireBreak: false, short: false, value: 10, lo: 0, hi: 10 } },
    { id: 'drahtbruch', name: 'Drahtbruch bei 4…20 mA', params: { signal: '420', uSupply: 24, rBurden: 250, wireBreak: true, short: false, value: 5 } },
    { id: 'spannung', name: '0…10 V mit Einkopplung', params: { signal: '010', rLine: 20, emi: 300, wireBreak: false, short: false, value: 5, lo: 0, hi: 10 } },
    { id: 'strom_emi', name: '4…20 mA mit Einkopplung', params: { signal: '420', uSupply: 24, rBurden: 250, emi: 300, wireBreak: false, short: false, value: 5, lo: 0, hi: 10 } },
    { id: 'schwach', name: 'Netzteil zu schwach (12 V)', params: { signal: '420', uSupply: 12, rBurden: 250, wireBreak: false, short: false, value: 5 } }
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = C.panel; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    if (title) txt(ctx, title, x + 14, y + 16, 12, C.dim, 'left', true);
  }

  // ---- Modell (rein, auch fuer curves() und Tests) ----
  // p = { value, lo, hi, signal, uSupply, rBurden, rLine, wireBreak, short }
  function model(p) {
    const sg = SIG[p.signal] || SIG['420'];
    const span = Math.max(0.1, p.hi - p.lo), f = (p.value - p.lo) / span;
    const out = { span, f, sg, over: p.value > p.hi + 1e-9, under: p.value < p.lo - 1e-9 };
    const rTot = p.rBurden + p.rLine;
    const setRaw = sg.lo + (sg.hi - sg.lo) * f;
    out.set = clamp(setRaw, sg.min, sg.max);
    if (sg.cur) {
      const uMin = p.signal === '420' ? U_MIN : 0;
      const iMax = rTot > 0 ? Math.max(0, (p.uSupply - uMin) / rTot * 1000) : 1e9;
      out.iMax = iMax; out.burdenMax = (p.uSupply - uMin) / 0.02; out.burdenMaxNet = out.burdenMax - p.rLine;
      let I = Math.min(out.set, iMax);
      out.limited = out.set > iMax + 1e-9;
      if (p.short) { I = Math.min(p.uSupply / Math.max(rTot, 1e-3) * 1000, I_SHORT_LIM); out.limited = false; }
      if (p.wireBreak) { I = 0; out.limited = false; }
      out.I = I;
      out.uBurden = I * p.rBurden / 1000;
      out.uTerm = p.wireBreak ? p.uSupply : p.short ? 0 : p.uSupply - I * rTot / 1000;
      out.headroom = p.uSupply - out.set * rTot / 1000 - uMin;
      out.uAdc = out.uBurden;
      out.sig = I;
    } else {
      out.iMax = 0; out.burdenMax = 0; out.burdenMaxNet = 0; out.limited = false;
      let U = out.set;
      if (p.short) U = 0;
      const Uin = p.wireBreak ? 0 : U * R_IN / (R_IN + p.rLine);
      out.I = p.wireBreak ? 0 : Uin / (R_IN + p.rLine) * 1000;
      out.uBurden = Uin; out.uTerm = p.uSupply - 0; out.headroom = p.uSupply - 12;
      out.uAdc = Uin * (p.signal === '010' ? 0.5 : 1);
      out.sig = Uin;
    }
    out.noiseK = sg.cur ? p.rBurden / (p.rBurden + R_COUPLE) : (R_IN / (R_IN + R_COUPLE)) * (p.signal === '010' ? 0.5 : 1);
    return out;
  }
  function adcConvert(uAdc, bits) { const n = Math.pow(2, bits); return clamp(Math.floor(uAdc / U_REF * n), 0, n - 1); }
  function scaleBack(N, bits, p, sg) {
    const u = N / Math.pow(2, bits) * U_REF, span = Math.max(0.1, p.hi - p.lo);
    if (sg.cur) { const i = u / Math.max(p.rBurden, 1e-6) * 1000; return { meas: i, shown: p.lo + (i - sg.lo) / (sg.hi - sg.lo) * span }; }
    const v = u * (p.signal === '010' ? 2 : 1); return { meas: v, shown: p.lo + (v - sg.lo) / (sg.hi - sg.lo) * span };
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    let S, V;

    const params = (valueOverride) => ({ value: valueOverride == null ? S.vf : valueOverride, lo: Cv.lo, hi: Math.max(Cv.hi, Cv.lo + 0.5), signal: Cv.signal, uSupply: Cv.uSupply, rBurden: Cv.rBurden, rLine: Cv.rLine, wireBreak: Cv.wireBreak, short: Cv.short });
    function resetState() {
      S = { t: 0, acc: 0, adcAcc: 0, vf: Cv.value, m: null, N: 0, meas: 0, shown: 0, uAdcInst: 0, flow: 0, hist: [], histAcc: 0, f: { wire: false, short: false, burden: false, adc: false, over: false, emi: false, det: false }, noiseAmp: 0 };
      S.m = model(params()); sample();
      V = { last: null };
      events.length = 0;
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    function sample() {
      const p = params(), m = S.m;
      S.noiseAmp = Cv.emi / 1000 * m.noiseK;
      const u = Math.max(0, m.uAdc + S.noiseAmp * Math.sin(TWO_PI * 50 * S.t / 1000));
      S.uAdcInst = u;
      S.N = adcConvert(u, Cv.adcBits);
      const b = scaleBack(S.N, Cv.adcBits, p, m.sg); S.meas = b.meas; S.shown = b.shown;
    }
    function diag() {
      const m = S.m, sg = m.sg, adcTop = U_REF;
      if (Cv.signal === '420') { if (S.meas < 3.6) return 'wire'; if (S.meas > 21 || m.I > 21) return 'overcurrent'; }
      if (Cv.signal === '15') { if (S.meas < 0.9) return 'wire'; }
      return '';
    }
    function stepCore(dtMs) {
      S.acc += dtMs;
      while (S.acc >= SUB - 1e-9) {
        S.acc -= SUB; S.t += SUB;
        S.vf += (Cv.value - S.vf) * (1 - Math.exp(-SUB / TAU));
        S.m = model(params());
        S.adcAcc += SUB;
        if (S.adcAcc >= ADC_MS - 1e-9) { S.adcAcc -= ADC_MS; sample(); }
        S.flow = (S.flow + S.m.I * SUB * 0.0009) % 1000;
        S.histAcc += SUB;
        if (S.histAcc >= 50) { S.histAcc = 0; S.hist.push([S.t, S.m.I, S.m.uBurden]); if (S.hist.length > 400) S.hist.shift(); }
      }
      checkEvents();
    }
    function checkEvents() {
      const m = S.m, F = S.f, sg = m.sg, d = diag();
      if (Cv.wireBreak && !F.wire) {
        F.wire = true;
        ev(Cv.signal === '420' ? 'Drahtbruch! Der Strom fällt auf 0 mA, also unter 3,6 mA. Der lebende Nullpunkt (4 mA) macht den Fehler eindeutig erkennbar.'
          : Cv.signal === '15' ? 'Drahtbruch! Das Messgerät sieht 0 V, unter 0,9 V. Wegen des lebenden Nullpunkts (1 V) ist der Fehler erkennbar.'
            : 'Drahtbruch! Das Messgerät sieht ' + (Cv.signal === '020' ? '0 mA' : '0 V') + ' – das kannst du von "Messwert null" nicht unterscheiden. Besser wäre ein Signal mit lebendem Nullpunkt (4…20 mA).', 'error', 'shoot', 175, 110);
      } else if (!Cv.wireBreak && F.wire) { F.wire = false; ev('Die Leitung ist wieder verbunden.', 'info'); }
      if (Cv.short && !F.short) { F.short = true; ev('Kurzschluss an den Klemmen des Messumformers! Der Strom steigt auf ' + f1(m.I, 0) + ' mA, weit über 21 mA.', 'error', 'shoot', 305, 110); }
      else if (!Cv.short && F.short) { F.short = false; ev('Der Kurzschluss ist beseitigt.', 'info'); }
      const lim = m.limited && !Cv.wireBreak && !Cv.short;
      if (lim && !F.burden) {
        F.burden = true;
        ev('Bürde zu groß! Der Messumformer braucht ' + U_MIN + ' V an den Klemmen. Bei ' + f1(Cv.rBurden + Cv.rLine, 0) + ' Ω (Bürde + Leitung) reichen ' + Cv.uSupply + ' V nur für ' + f1(m.iMax, 1) + ' mA. Der Strom wird begrenzt (Sättigung), der Messwert wird zu klein angezeigt.', 'warn', 'stall', 305, 110);
      } else if (!lim && F.burden) { F.burden = false; ev('Die Spannungsreserve reicht wieder aus.', 'info'); }
      const clipA = S.m.uAdc > U_REF + 1e-9 && !Cv.wireBreak;
      if (clipA && !F.adc) { F.adc = true; ev('Der Wandler ist übersteuert! An der Bürde liegen ' + f1(m.uAdc, 2) + ' V, der Wandler misst nur bis ' + U_REF + ' V. Verkleinere die Bürde oder teile die Spannung.', 'warn', 'stall', 605, 220); }
      else if (!clipA && F.adc) F.adc = false;
      const ov = m.over && !Cv.wireBreak && !Cv.short;
      if (ov && !F.over) { F.over = true; ev('Messgröße über dem Messbereichsende! Der Messumformer begrenzt das Signal bei ' + f1(m.sg.max, 1) + ' ' + sg.unit + '.', 'warn', 'stall', 305, 110); }
      else if (!ov && F.over) F.over = false;
      const bigEmi = Cv.emi > 0 && S.noiseAmp > 0.003 * U_REF;
      if (bigEmi && !F.emi) { F.emi = true; ev('Einkopplung stört! Auf dem Signal liegt eine 50-Hz-Störung von ' + f1(S.noiseAmp * 1000, 0) + ' mV am Wandler' + (sg.cur ? '.' : '. Ein Stromsignal wäre viel unempfindlicher.'), 'warn'); }
      else if (!bigEmi && F.emi) F.emi = false;
      if (d && !F.det && !Cv.wireBreak && !Cv.short && d !== '') { F.det = true; }
    }

    function setControl(key, value) {
      const dd = defOf[key]; if (!dd) return;
      let v;
      if (dd.type === 'switch' || dd.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (dd.type === 'slider') v = clamp(num(value, dd.value), dd.min, dd.max);
      else { const o = dd.options.find(x => String(x.value) === String(value)); v = o ? o.value : dd.value; }
      Cv[key] = v;
      if (key === 'hi' && Cv.hi < Cv.lo + 0.5) Cv.hi = Math.min(16, Cv.lo + 0.5);
      if (key === 'lo' && Cv.hi < Cv.lo + 0.5) Cv.hi = Math.min(16, Cv.lo + 0.5);
      if (S) { S.m = model(params()); sample(); }
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      Object.keys(p.params).forEach(k => setControl(k, p.params[k]));
      return true;
    }

    function readMeters() {
      const m = S.m, errPct = (S.shown - S.vf) / m.span * 100;
      return { value: Cv.value, iLoop: m.I, uBurden: m.uBurden, uAdc: S.uAdcInst, adc: S.N, shown: S.shown, error: errPct, headroom: m.headroom, uTerm: m.uTerm };
    }
    function state() {
      const m = S.m, d = diag(), faults = [];
      if (Cv.wireBreak) faults.push('wireBreak');
      if (Cv.short) faults.push('short');
      if (m.limited && !Cv.wireBreak && !Cv.short) faults.push('burden');
      if (m.uAdc > U_REF + 1e-9 && !Cv.wireBreak) faults.push('adcOver');
      if (m.over) faults.push('overrange');
      const iNoise = m.sg.cur ? S.noiseAmp / Math.max(Cv.rBurden, 1e-6) * 1000 : 0;
      return {
        value: Cv.value, valueFilt: S.vf, span: m.span, fraction: m.f, signal: Cv.signal, signalName: m.sg.name, sigUnit: m.sg.unit,
        iSet: m.sg.cur ? m.set : 0, uSet: m.sg.cur ? 0 : m.set, iLoop: m.I, iMax: m.iMax, uSig: m.sig, uTerm: m.uTerm, uBurden: m.uBurden,
        uAdc: S.uAdcInst, uAdcTrue: m.uAdc, adc: S.N, adcMax: Math.pow(2, Cv.adcBits) - 1, meas: S.meas, shown: S.shown, error: (S.shown - S.vf) / m.span * 100, errorAbs: S.shown - S.vf,
        headroom: m.headroom, burdenMax: m.burdenMax, burdenMaxNet: m.burdenMaxNet, saturated: m.limited && !Cv.wireBreak && !Cv.short,
        adcClip: m.uAdc > U_REF + 1e-9, wireBroken: Cv.wireBreak, shorted: Cv.short, wireDetected: d === 'wire', diag: d, liveZero: m.sg.live,
        noiseAmp: S.noiseAmp, noiseMV: S.noiseAmp * 1000, iNoise, lsbShown: U_REF / Math.pow(2, Cv.adcBits) / (m.sg.cur ? Math.max(Cv.rBurden, 1e-6) / 1000 : (Cv.signal === '010' ? 0.5 : 1)) / (m.sg.hi - m.sg.lo) * m.span,
        overrange: m.over, underrange: m.under, fault: faults.length > 0, faults, t: S.t
      };
    }

    // ---- Kennlinien ----
    function curves() {
      const sg = SIG[Cv.signal] || SIG['420'], P = params(), m = S.m;
      const c1 = [], c1i = [];
      for (let k = 0; k <= 64; k++) {
        const v = 16 * k / 64, mm = model(Object.assign({}, P, { value: v, wireBreak: false, short: false }));
        c1.push([v, mm.sig]); c1i.push([v, sg.lo + (sg.hi - sg.lo) * (v - P.lo) / Math.max(0.1, P.hi - P.lo)]);
      }
      const out = [{ id: 'sig', title: 'Messgröße → Signal (' + sg.name + ')', xLabel: 'Druck', xUnit: 'bar', yLabel: 'Signal', yUnit: sg.unit,
        series: [{ name: 'Signal (begrenzt)', points: c1 }, { name: 'ideal', points: c1i }], marker: { x: S.vf, y: m.sig } }];
      if (sg.cur) {
        const c2 = [], c20 = [], c3 = [], c35 = [];
        for (let r = 0; r <= 1200; r += 20) {
          const uMin = Cv.signal === '420' ? U_MIN : 0;
          c2.push([r, Math.min(sg.max, Math.max(0, (Cv.uSupply - uMin) / Math.max(r + Cv.rLine, 1e-3) * 1000))]);
          c20.push([r, sg.hi]);
          c3.push([r, r * sg.hi / 1000]); c35.push([r, U_REF]);
        }
        out.push({ id: 'burden', title: 'Bürde-Kennlinie: Arbeitsbereich', xLabel: 'Bürde', xUnit: 'Ω', yLabel: 'größter Strom', yUnit: 'mA',
          series: [{ name: 'Strom, den die Versorgung zulässt', points: c2 }, { name: 'Vollaussteuerung ' + sg.hi + ' mA', points: c20 }], marker: { x: Cv.rBurden, y: m.I } });
        out.push({ id: 'uburden', title: 'Spannung an der Bürde bei Vollaussteuerung', xLabel: 'Bürde', xUnit: 'Ω', yLabel: 'Spannung', yUnit: 'V',
          series: [{ name: 'Bürde · ' + sg.hi + ' mA', points: c3 }, { name: 'Wandler-Referenz', points: c35 }], marker: { x: Cv.rBurden, y: Cv.rBurden * sg.hi / 1000 } });
      } else {
        const c2 = [];
        for (let r = 0; r <= 500; r += 10) c2.push([r, -r / (R_IN + r) * 100]);
        out.push({ id: 'line', title: 'Leitungswiderstand → Anzeigefehler', xLabel: 'Leitungswiderstand', xUnit: 'Ω', yLabel: 'Fehler', yUnit: '%',
          series: [{ name: 'Spannungsteiler mit 100 kΩ Eingang', points: c2 }], marker: { x: Cv.rLine, y: -Cv.rLine / (R_IN + Cv.rLine) * 100 } });
      }
      return out;
    }

    // ================= Zeichnen =================
    const PATH = [[90, 140], [90, 110], [500, 110], [500, 330], [90, 330], [90, 240]];
    const XMIT = { x: 230, y: 56, w: 150, h: 100 };
    function pathLen() { let L = 0; for (let i = 0; i < PATH.length - 1; i++) L += Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); return L; }
    function pathPt(s) {
      for (let i = 0; i < PATH.length - 1; i++) {
        const a = PATH[i], b = PATH[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (s <= l) { const u = s / l; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])]; }
        s -= l;
      }
      return [PATH[0][0], PATH[0][1], 0];
    }
    function inBox(p) {
      const x = p[0], y = p[1];
      return (y === 110 && x > 222 && x < 388) || (x === 500 && y > 170 && y < 270) || (y === 330 && x > 240 && x < 350) || (y === 110 && S && Cv.wireBreak && x > 150 && x < 200);
    }
    function drawWires(ctx, t) {
      const br = Cv.wireBreak, hot = S.m.I;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const wire = (pts, col) => { ctx.strokeStyle = '#0c1014'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke(); };
      const colP = '#c0392b', colN = '#3b6ea8';
      // Plusleitung (rot): Netzteil + -> Messumformer + ... Messumformer - -> Buerde
      if (br) {
        wire([[90, 140], [90, 110], [144, 110], [156, 130]], colP);
        wire([[206, 90], [218, 110], [230, 110]], colP);
      } else wire([[90, 140], [90, 110], [230, 110]], colP);
      wire([[380, 110], [500, 110], [500, 170]], colP);
      wire([[500, 270], [500, 330], [350, 330]], colN);
      wire([[240, 330], [90, 330], [90, 240]], colN);
      // Verbindung Buerde -> ADU
      ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(500, 180); ctx.lineTo(540, 180); ctx.lineTo(560, 180); ctx.moveTo(500, 260); ctx.lineTo(540, 260); ctx.lineTo(560, 260); ctx.stroke();
      [[500, 180], [500, 260]].forEach(q => { ctx.fillStyle = '#c4ccd4'; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TWO_PI); ctx.fill(); });
      // Leitungswiderstaende (je halb)
      const rl = (x, y) => { ctx.fillStyle = '#4a4034'; rr(ctx, x, y - 9, 56, 18, 3); ctx.fill(); ctx.strokeStyle = '#9a7b4f'; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, 'R', x + 28, y, 11, '#e8c98a', 'center', true); txt(ctx, 'L', x + 36, y + 3, 8, '#e8c98a', 'left'); };
      rl(414, 110); rl(414, 330);
      txt(ctx, 'Leitung ' + f1(Cv.rLine, 0) + ' Ω', 442, 134, 11, C.dim, 'center');
      // Stroemungspfeile
      if (!br) {
        const L = pathLen(), sp = 46, n = Math.ceil(L / sp), ph = (S.flow * 40) % sp;
        const a = clamp(hot / 20, 0, 1.6);
        if (hot > 0.05) for (let k = 0; k < n; k++) {
          const p = pathPt(((k * sp + ph) % L));
          if (inBox(p)) continue;
          const sz = 5 + 4 * clamp(a, 0, 1.2);
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(p[2]);
          ctx.fillStyle = Cv.short ? rgba(RED, 1) : hot > 21 ? rgba(RED, 1) : rgba(AMB, 1);
          ctx.beginPath(); ctx.moveTo(sz + 3, 0); ctx.lineTo(-sz, -sz); ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz, sz); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      // Drahtbruch: Funken
      if (br) {
        const gx = 181, gy = 110;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(gx, gy, 34, 0, TWO_PI); ctx.fill();
        for (let k = 0; k < 7; k++) {
          const ph = fr(t / 380 + k * 0.173), ang = rnd(Math.floor(t / 90) + k * 7) * TWO_PI, len = 14 + rnd(k + Math.floor(t / 110)) * 34;
          ctx.strokeStyle = 'rgba(255,' + (200 - k * 10) + ',90,' + (1 - ph) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ang) * len * (0.4 + ph), gy + Math.sin(ang) * len * (0.4 + ph)); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(160,210,255,' + (0.4 + 0.5 * rnd(Math.floor(t / 60))) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(156, 130); ctx.lineTo(170, 114); ctx.lineTo(163, 108); ctx.lineTo(190, 100); ctx.lineTo(206, 90); ctx.stroke();
        txt(ctx, 'Drahtbruch', gx, gy + 40, 14, Math.floor(t / 250) % 2 ? C.bad : C.warn, 'center', true);
        txt(ctx, 'I = 0 mA', gx, gy + 58, 12, C.dim, 'center');
      }
      // Kurzschluss-Bruecke
      if (Cv.short) {
        const fl = 0.6 + 0.4 * rnd(Math.floor(t / 70));
        ctx.strokeStyle = 'rgba(255,255,200,' + fl + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(230, 110); ctx.bezierCurveTo(270, 40, 340, 40, 380, 110); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,60,' + fl + ')'; ctx.lineWidth = 2; ctx.stroke();
        for (let k = 0; k < 6; k++) { const ang = rnd(Math.floor(t / 80) + k * 3) * TWO_PI; ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(305, 52); ctx.lineTo(305 + Math.cos(ang) * 22, 52 + Math.sin(ang) * 22); ctx.stroke(); }
        txt(ctx, 'KURZSCHLUSS', 305, 24, 14, Math.floor(t / 200) % 2 ? C.bad : '#fff', 'center', true);
      }
    }
    function drawPSU(ctx, t) {
      const x = 52, y = 140, w = 76, h = 100;
      const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#3a444e'); g.addColorStop(1, '#262d34');
      ctx.fillStyle = g; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
      txt(ctx, 'NETZTEIL', x + w / 2, y + 14, 10, C.dim, 'center', true);
      ctx.fillStyle = '#0c1014'; rr(ctx, x + 8, y + 24, w - 16, 28, 5); ctx.fill();
      txt(ctx, f1(Cv.uSupply, 0) + ' V', x + w / 2, y + 38, 20, '#7ee0ff', 'center', true, MONO);
      txt(ctx, '+', x + 14, y + 70, 18, '#ff8a80', 'center', true); txt(ctx, '−', x + w - 14, y + 70, 18, '#90b4ff', 'center', true);
      ctx.fillStyle = S.m.I > 0.05 ? C.ok : '#24402b'; ctx.beginPath(); ctx.arc(x + w / 2, y + 84, 5, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#c4ccd4'; [[90, 140], [90, 240]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TWO_PI); ctx.fill(); });
      txt(ctx, '+', 76, 128, 14, '#ff8a80', 'center', true);
    }
    function drawXmit(ctx, t) {
      const { x, y, w, h } = XMIT, m = S.m, ok = m.uTerm >= U_MIN - 1e-6 || !m.sg.cur || Cv.wireBreak;
      const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#4a5560'); g.addColorStop(1, '#2a323a');
      ctx.fillStyle = g; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 3; ctx.stroke();
      txt(ctx, 'MESSUMFORMER', x + w / 2, y + 14, 11, '#c4ccd4', 'center', true);
      // Anzeige-Fenster
      ctx.fillStyle = '#0c1014'; rr(ctx, x + 10, y + 26, 74, 42, 6); ctx.fill();
      txt(ctx, f1(S.vf, 1), x + 47, y + 42, 18, '#7ee0ff', 'center', true, MONO); txt(ctx, 'bar', x + 47, y + 59, 11, C.dim, 'center');
      // Manometer
      const cx = x + 112, cy = y + 50, r = 24;
      ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 3; ctx.stroke();
      const fr2 = clamp((S.vf - Cv.lo) / Math.max(0.1, Cv.hi - Cv.lo), 0, 1.15), ang = (150 + 240 * clamp(fr2 / 1.15, 0, 1)) * D2R;
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 1.5; for (let k = 0; k <= 8; k++) { const a = (150 + 30 * k) * D2R; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ctx.stroke(); }
      ctx.strokeStyle = '#d03030'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 19, cy + Math.sin(ang) * 19); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TWO_PI); ctx.fill();
      // Anschluss (Druckleitung)
      ctx.fillStyle = '#7a8591'; rr(ctx, x + w / 2 - 14, y + h, 28, 12, 2); ctx.fill(); ctx.fillStyle = '#5a6570'; rr(ctx, x + w / 2 - 6, y + h + 12, 12, 22, 2); ctx.fill();
      // Spannung an den Klemmen + LED
      ctx.fillStyle = ok ? C.ok : (Math.floor(t / 200) % 2 ? C.bad : '#5a1c1c'); ctx.beginPath(); ctx.arc(x + w - 14, y + 14, 5, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#c4ccd4'; [[230, 110], [380, 110]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TWO_PI); ctx.fill(); });
      txt(ctx, '+', x + 10, y + h - 12, 14, '#ff8a80', 'left', true); txt(ctx, '−', x + w - 10, y + h - 12, 14, '#90b4ff', 'right', true);
      if (m.sg.cur && Cv.signal === '420') txt(ctx, 'U = ' + f1(m.uTerm, 1) + ' V   (min. 12 V)', x + w / 2, y + h + 56 - 12 + 12, 11, ok ? C.dim : C.bad, 'center', !ok);
      // Druckpfeil
      const ph = fr(t / 900);
      ctx.fillStyle = 'rgba(59,158,255,0.8)';
      for (let k = 0; k < 2; k++) { const yy = y + h + 36 + ((ph + k * 0.5) % 1) * 14 - 14; ctx.beginPath(); ctx.moveTo(x + w / 2, yy - 6); ctx.lineTo(x + w / 2 - 5, yy + 2); ctx.lineTo(x + w / 2 + 5, yy + 2); ctx.closePath(); ctx.fill(); }
    }
    function drawBurden(ctx, t) {
      const x = 480, y = 170, w = 40, h = 100;
      const rin = !S.m.sg.cur;
      ctx.fillStyle = '#2d353d'; rr(ctx, x, y, w, h, 5); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#c9a56a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 6);
      for (let k = 0; k < 7; k++) ctx.lineTo(x + w / 2 + (k % 2 ? -11 : 11), y + 12 + k * 13);
      ctx.lineTo(x + w / 2, y + h - 6); ctx.stroke();
      txt(ctx, rin ? 'Rᵢₙ 100 kΩ' : 'Bürde', x - 8, y + 36, 13, C.text, 'right', true);
      txt(ctx, rin ? 'Eingang' : f1(Cv.rBurden, 0) + ' Ω', x - 8, y + 54, 12, C.dim, 'right');
      txt(ctx, 'U = ' + f1(S.m.uBurden, 2) + ' V', x - 8, y + 74, 13, S.m.uAdc > U_REF ? C.bad : '#7ee0ff', 'right', true, MONO);
    }
    function drawAmmeter(ctx, t) {
      const cx = 295, cy = 330, r = 24;
      ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 3; ctx.stroke();
      txt(ctx, S.m.sg.cur ? 'mA' : 'µA', cx, cy - 7, 13, '#16202a', 'center', true);
      txt(ctx, f1(S.m.sg.cur ? S.m.I : S.m.I * 1000, S.m.sg.cur ? 1 : 0), cx, cy + 9, 12, '#a02020', 'center', true, MONO);
    }
    function drawAdc(ctx, t) {
      const x = 560, y = 150, w = 92, h = 140;
      const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#2d3a48'); g.addColorStop(1, '#212a33');
      ctx.fillStyle = g; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
      txt(ctx, 'ADU', x + w / 2, y + 14, 12, C.text, 'center', true); txt(ctx, Cv.adcBits + ' Bit · ' + U_REF + ' V', x + w / 2, y + 28, 10, C.dim, 'center');
      ctx.fillStyle = '#0c1014'; rr(ctx, x + 6, y + 38, w - 12, 30, 5); ctx.fill();
      txt(ctx, String(S.N), x + w / 2, y + 53, 17, '#7ee0ff', 'center', true, MONO);
      txt(ctx, 'Digit', x + w / 2, y + 79, 10, C.dim, 'center');
      ctx.fillStyle = '#0c1014'; rr(ctx, x + 6, y + 90, w - 12, 40, 5); ctx.fill();
      const d = diag();
      txt(ctx, d === 'wire' ? 'FEHLER' : f1(S.shown, 2), x + w / 2, y + 106, d === 'wire' ? 15 : 17, d === 'wire' ? C.bad : C.ok, 'center', true, MONO);
      txt(ctx, d === 'wire' ? 'Drahtbruch' : 'bar', x + w / 2, y + 122, 10, C.dim, 'center');
      if (S.m.uAdc > U_REF && !Cv.wireBreak) { ctx.strokeStyle = Math.floor(t / 250) % 2 ? C.bad : C.warn; ctx.lineWidth = 3; rr(ctx, x - 2, y - 2, w + 4, h + 4, 9); ctx.stroke(); txt(ctx, 'ÜBERSTEUERT', x + w / 2, y + h + 14, 11, C.bad, 'center', true); }
      ctx.fillStyle = '#c4ccd4'; [[560, 180], [560, 260]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TWO_PI); ctx.fill(); });
    }
    function drawEmi(ctx, t) {
      const x = 590, y = 74;
      const a = clamp(Cv.emi / 500, 0, 1);
      ctx.fillStyle = a > 0 ? '#5a4210' : '#2d353d'; rr(ctx, x - 24, y - 10, 70, 38, 8); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, '⚡', x - 6, y + 9, 22, a > 0 ? '#ffd24a' : '#7a8591', 'center');
      txt(ctx, 'Motor', x + 24, y + 9, 11, C.dim, 'center');
      txt(ctx, 'Störquelle 50 Hz', x + 10, y - 20, 11, a > 0 ? C.warn : C.dim, 'center', a > 0);
      if (a > 0) {
        for (let k = 0; k < 3; k++) {
          const ph = fr(t / 700 + k / 3);
          ctx.strokeStyle = 'rgba(255,200,60,' + (1 - ph) * 0.8 + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); for (let u = 0; u <= 20; u++) { const px = x - 24 - u * ((x - 24 - 470) / 20) * ph, py = y + 28 + (110 - (y + 28)) * (u / 20) * ph + Math.sin(u * 1.6 + t / 90) * 4 * a; if (u === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        }
        txt(ctx, '≈ ' + f1(S.noiseAmp * 1000, 0) + ' mV am Wandler', x - 10, y + 44, 11, C.warn, 'center', true);
      }
    }
    function drawLoopPanel(ctx, t) {
      panel(ctx, 14, 52, 646, 330, null);
      txt(ctx, Cv.signal === '420' ? 'Zweileiter-Schleife' : S.m.sg.cur ? 'Stromschleife' : 'Spannungssignal', 30, 70, 12, C.dim, 'left', true);
      drawWires(ctx, t); drawPSU(ctx, t); drawXmit(ctx, t); drawBurden(ctx, t); drawAmmeter(ctx, t); drawAdc(ctx, t); drawEmi(ctx, t);
      txt(ctx, 'Strom: ' + f1(S.m.I, 2) + ' mA', 175, 356, 13, C.warn, 'center', true);
    }
    function drawBudget(ctx, t) {
      const x0 = 14, y0 = 392, w = 646, h = 82, m = S.m;
      panel(ctx, x0, y0, w, h, 'SPANNUNGSBILANZ der Versorgung ' + Cv.uSupply + ' V');
      const bx = x0 + 16, bw = w - 32, by = y0 + 30, bh = 24;
      ctx.fillStyle = '#0c1014'; rr(ctx, bx, by, bw, bh, 6); ctx.fill();
      if (m.sg.cur) {
        const tot = Cv.uSupply, I = m.I / 1000, uB = I * Cv.rBurden, uL = I * Cv.rLine, uT = Math.max(0, tot - uB - uL);
        let xx = bx;
        const seg = (v, col, label) => { const ww = bw * clamp(v / tot, 0, 1); if (ww < 1) return; ctx.fillStyle = col; ctx.fillRect(xx + 1, by + 2, Math.max(0, ww - 1), bh - 4); if (ww > 46) txt(ctx, label, xx + ww / 2, by + bh / 2, 11, '#0c1014', 'center', true); xx += ww; };
        seg(uB, rgba(BLUE, 1), 'Bürde ' + f1(uB, 1)); seg(uL, '#9a7b4f', 'Leit. ' + f1(uL, 1));
        const okT = uT >= U_MIN - 1e-6 || Cv.signal !== '420';
        seg(uT, okT ? rgba(GREEN, 1) : rgba(RED, 1), 'Messumformer ' + f1(uT, 1) + ' V');
        if (Cv.signal === '420') { const mx = bx + bw * U_MIN / tot; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(bx + bw - (bw * U_MIN / tot), by - 4); ctx.lineTo(bx + bw - (bw * U_MIN / tot), by + bh + 4); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]); }
        const rMax = Cv.signal === '420' ? 'Maximalbürde = (Us − 12 V) / 20 mA = ' + f1(m.burdenMax, 0) + ' Ω (mit Leitung)' : 'Maximalbürde = Us / 20 mA = ' + f1(m.burdenMax, 0) + ' Ω';
        txt(ctx, rMax, x0 + 16, y0 + h - 12, 12, m.limited ? C.bad : C.dim, 'left', m.limited);
        txt(ctx, 'Reserve ' + f1(m.headroom, 1) + ' V', x0 + w - 16, y0 + h - 12, 12, m.headroom < 0 ? C.bad : C.ok, 'right', true);
      } else {
        txt(ctx, 'Spannungssignal: Das Signal wird hochohmig gemessen (100 kΩ), die Leitung belastet kaum.', x0 + 16, y0 + 42, 12, C.dim, 'left');
        txt(ctx, 'Aber: Störspannungen werden voll mitgemessen.', x0 + 16, y0 + 62, 12, C.dim, 'left');
      }
    }
    function drawButtons(ctx, t) {
      const bt = (x, label, on, col) => {
        ctx.fillStyle = on ? rgba(col, 0.35) : '#2a323b'; rr(ctx, x, 484, 160, 56, 12); ctx.fill(); ctx.strokeStyle = on ? rgba(col, 1) : '#556270'; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, label, x + 80, 504, 16, on ? '#fff' : C.text, 'center', true); txt(ctx, on ? 'aktiv – tippen zum Lösen' : 'tippen', x + 80, 526, 11, C.dim, 'center');
      };
      bt(14, '✂ Drahtbruch', Cv.wireBreak, RED); bt(186, '⚡ Kurzschluss', Cv.short, AMB);
      // Statusmeldung
      const d = diag(), m = S.m;
      let msg, col;
      if (Cv.wireBreak) { d === 'wire' ? (msg = 'DRAHTBRUCH erkannt (Strom < 3,6 mA)', col = C.bad) : (msg = 'Drahtbruch – NICHT erkennbar: Messwert null?', col = C.warn); }
      else if (Cv.short) { msg = 'KURZSCHLUSS (Strom ' + f1(m.I, 0) + ' mA)'; col = C.bad; }
      else if (m.limited) { msg = 'Bürde zu groß: Sättigung bei ' + f1(m.iMax, 1) + ' mA'; col = C.bad; }
      else if (m.uAdc > U_REF) { msg = 'Wandler übersteuert'; col = C.warn; }
      else if (m.over) { msg = 'Über Messbereichsende: Signal begrenzt'; col = C.warn; }
      else { msg = 'in Ordnung: ' + f1(S.vf, 2) + ' bar = ' + f1(m.f * 100, 0) + ' % → ' + f1(m.sig, 2) + ' ' + m.sg.unit; col = C.ok; }
      ctx.fillStyle = C.panel; rr(ctx, 358, 484, 302, 56, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, msg, 509, 506, 13, col, 'center', true);
      txt(ctx, 'Anzeige ' + f1(S.shown, 2) + ' bar · Fehler ' + f1((S.shown - S.vf) / m.span * 100, 2) + ' %', 509, 526, 12, C.dim, 'center');
    }
    function drawDial(ctx, t) {
      const x0 = 676, y0 = 14, w = 314, h = 248, m = S.m, sg = m.sg;
      panel(ctx, x0, y0, w, h, 'ZEIGERINSTRUMENT  ' + (sg.cur ? 'Schleifenstrom in mA' : 'Signal in V'));
      const cx = x0 + w / 2, cy = y0 + 150, r = 112;
      const full = sg.cur ? 24 : 12, a0 = 150, span = 240;
      const A = v => (a0 + span * clamp(v / full, 0, 1)) * D2R;
      const g = ctx.createRadialGradient(cx, cy - 20, 20, cx, cy, r + 10); g.addColorStop(0, '#f2efe4'); g.addColorStop(1, '#d9d4c4');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#11161b'; ctx.lineWidth = 4; ctx.stroke();
      const zone = (v1, v2, col) => { ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cx, cy, r - 14, A(v1), A(v2)); ctx.stroke(); };
      if (sg.cur) {
        if (Cv.signal === '420') { zone(0, 3.6, 'rgba(220,50,50,0.85)'); zone(3.6, 3.8, 'rgba(240,160,40,0.9)'); zone(4, 20, 'rgba(40,160,70,0.85)'); zone(20, 20.5, 'rgba(240,160,40,0.9)'); zone(21, 24, 'rgba(220,50,50,0.85)'); zone(20.5, 21, 'rgba(240,160,40,0.9)'); }
        else { zone(0, 20, 'rgba(40,160,70,0.85)'); zone(20, 21, 'rgba(240,160,40,0.9)'); zone(21, 24, 'rgba(220,50,50,0.85)'); }
      } else {
        zone(0, sg.lo > 0 ? sg.lo - 0.1 : 0, 'rgba(220,50,50,0.85)'); zone(sg.lo, sg.hi, 'rgba(40,160,70,0.85)'); zone(sg.hi + 0.5, 12, 'rgba(220,50,50,0.85)');
      }
      for (let v = 0; v <= full; v += sg.cur ? 1 : 0.5) {
        const major = sg.cur ? v % 4 === 0 : v % 2 === 0, a = A(v), r1 = r - (major ? 30 : 24), r2 = r - 6;
        ctx.strokeStyle = '#1b2026'; ctx.lineWidth = major ? 2.5 : 1.3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
        if (major) txt(ctx, String(v), cx + Math.cos(a) * (r - 46), cy + Math.sin(a) * (r - 46), 13, '#1b2026', 'center', true);
      }
      // Live-Zero-Marke
      if (Cv.signal === '420') {
        const a = A(4); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 34), cy + Math.sin(a) * (r - 34)); ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); ctx.stroke();
        txt(ctx, '4 mA', cx + Math.cos(a) * (r + 6) - 4, cy + Math.sin(a) * (r + 6) + 16, 12, '#a02020', 'center', true);
        txt(ctx, 'Live Zero', cx + Math.cos(a) * (r + 6) - 4, cy + Math.sin(a) * (r + 6) + 30, 10, '#a02020', 'center');
        const b = A(20); txt(ctx, '20 mA', cx + Math.cos(b) * (r + 6) + 4, cy + Math.sin(b) * (r + 6) + 16, 12, '#1b6a30', 'center', true);
      }
      txt(ctx, sg.cur ? 'mA' : 'V', cx, cy - 54, 18, '#1b2026', 'center', true);
      // Zeiger (Stoerung = Zittern)
      const iNoise = sg.cur ? S.noiseAmp / Math.max(Cv.rBurden, 1e-6) * 1000 : S.noiseAmp * (sg.hi > 5 ? 2 : 1);
      const val = clamp((sg.cur ? m.I : m.sig) + Math.sin(t / 7) * iNoise * 1.2, 0, full), a = A(val);
      ctx.save(); ctx.translate(cx + 3, cy + 5); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8)); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#b01818'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18); ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TWO_PI); ctx.fill();
      txt(ctx, f1(sg.cur ? m.I : m.sig, 2) + ' ' + sg.unit, cx, y0 + h - 14, 22, C.ok, 'center', true, MONO);
      if (Cv.wireBreak) txt(ctx, Cv.signal === '420' ? 'unter 3,6 mA = Fehler' : 'Nullstellung?', cx, cy + 66, 12, C.bad, 'center', true);
    }
    function drawReadouts(ctx, t) {
      const x0 = 676, y0 = 272, w = 314, h = 276, m = S.m;
      panel(ctx, x0, y0, w, h, 'MESSKETTE');
      const rows = [
        ['Messgröße (wahr)', f1(S.vf, 2), 'bar', C.text], ['Signal', f1(m.sig, 2), m.sg.unit, C.warn],
        ['U an der Bürde', f1(m.uBurden, 2), 'V', m.uAdc > U_REF ? C.bad : C.acc], ['U am Wandler', f1(S.uAdcInst, 3), 'V', C.acc],
        ['Zählwert', String(S.N), '/ ' + (Math.pow(2, Cv.adcBits) - 1), C.text], ['Anzeige', f1(S.shown, 2), 'bar', C.ok],
        ['Fehler', f1((S.shown - S.vf) / m.span * 100, 2), '% v. M.', Math.abs((S.shown - S.vf) / m.span * 100) > 2 ? C.warn : C.ok],
        ['Auflösung', f1(stateLsb(), 3), 'bar/Digit', C.dim]
      ];
      rows.forEach((r2, k) => {
        const y = y0 + 34 + k * 27;
        ctx.fillStyle = k % 2 ? 'transparent' : 'rgba(255,255,255,0.03)'; ctx.fillRect(x0 + 8, y - 12, w - 16, 25);
        txt(ctx, r2[0], x0 + 16, y, 13, C.dim, 'left', true); txt(ctx, r2[1], x0 + w - 86, y, 16, r2[3], 'right', true, MONO); txt(ctx, r2[2], x0 + w - 80, y, 11, C.dim, 'left');
      });
      // Reserve-Balken
      const by = y0 + h - 22;
      txt(ctx, 'Reserve', x0 + 16, by - 8, 11, C.dim, 'left', true);
      ctx.fillStyle = '#0c1014'; rr(ctx, x0 + 16, by, w - 32, 10, 5); ctx.fill();
      const fR = clamp((m.headroom + 5) / 15, 0, 1); ctx.fillStyle = m.headroom < 0 ? rgba(RED, 1) : rgba(GREEN, 1); rr(ctx, x0 + 17, by + 1, Math.max(2, (w - 34) * fR), 8, 4); ctx.fill();
      txt(ctx, f1(m.headroom, 1) + ' V', x0 + w - 16, by - 8, 11, m.headroom < 0 ? C.bad : C.ok, 'right', true);
    }
    function stateLsb() { const m = S.m; return U_REF / Math.pow(2, Cv.adcBits) / (m.sg.cur ? Math.max(Cv.rBurden, 1e-6) / 1000 : (Cv.signal === '010' ? 0.5 : 1)) / (m.sg.hi - m.sg.lo) * m.span; }
    function drawTitle(ctx) {
      txt(ctx, 'Normsignale und Messumformer', 20, 26, 18, C.text, 'left', true);
      txt(ctx, S.m.sg.name + ' · Messbereich ' + f1(Cv.lo, 1) + '…' + f1(Cv.hi, 1) + ' bar', 20, 44, 11, C.dim, 'left');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0); w = num(w, 0); h = num(h, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Math.max(w, 0), Math.max(h, 0));
      if (w > 0 && h > 0) {
        const sc = Math.min(w / WW, h / WH);
        ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
        ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
        drawTitle(ctx); drawLoopPanel(ctx, t); drawBudget(ctx, t); drawButtons(ctx, t); drawDial(ctx, t); drawReadouts(ctx, t);
      }
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      w = num(w, 0); h = num(h, 0); if (!(w > 0 && h > 0)) return null;
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      if (x > 14 && x < 174 && y > 484 && y < 540) return { key: 'wireBreak', kind: 'switch' };
      if (x > 186 && x < 346 && y > 484 && y < 540) return { key: 'short', kind: 'switch' };
      if (x > 140 && x < 225 && y > 80 && y < 145) return { key: 'wireBreak', kind: 'switch' };
      return null;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'normsignal', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k])); S.vf = Cv.value; S.m = model(params()); sample(); }
    return rig;
  }

  R.register({
    id: 'normsignal', name: 'Normsignale und Messumformer', icon: '🔌',
    info: 'Ein Druck-Messumformer liefert ein Normsignal (4…20 mA, 0…20 mA, 0…10 V oder 1…5 V). Der Strom fließt durch Bürde und Leitung zum Wandler. Probiere Drahtbruch, zu große Bürde, schwache Versorgung und Einkopplung aus und sieh, warum 4…20 mA so beliebt ist.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
