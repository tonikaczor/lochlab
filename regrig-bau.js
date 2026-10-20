/* regrig-bau.js - Regelungstechnik-Lab: Pruefstand 7 `baukasten` (Streckenbaukasten, SPEC 4.7.7)
 * Frei waehlbare Strecke um den Arbeitspunkt x = y = 50 %: P, PT1, PT2, schwingfaehige PT2, PT3, PT1/PT2 mit Totzeit, I und I+PT1.
 * Die Strecke ist eine Blockkette aus REG_CORE.plant (K, PT1, PT2, I, Tt); I-Strecken sind auf 0 ... 100 % begrenzt. Alle Reglerarten inklusive
 * Zweipunkt und Dreipunkt. Live-Werte V0, phiR, AR, wD kommen aus rig.analysis() (REG_CORE.margins).
 * Die gemeinsame Basis liegt in regrig-fuell.js (REG_RIGS.baseA): Diese Datei im Browser NACH regrig-fuell.js laden (in Node per require).
 */
(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.baseA && typeof require === 'function') { try { require('./regrig-fuell.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.baseA;
  if (!B) { if (typeof console !== 'undefined') console.warn('regrig-bau.js: Die Basis aus regrig-fuell.js fehlt (bitte davor laden).'); return; }
  const clamp = B.clamp, num = B.num, fm = B.fm, fn = B.fn, G = B.gfx, COL = G.COL;

  const RANGE = { lo: 0, hi: 100, unit: '%', digits: 1 };
  const SPAN = 100;
  const OP = 50;
  const PAR = { sensorTau: 0 };
  const TYPES = [
    { value: 'p', label: 'P-Strecke: Ks' },
    { value: 'pt1', label: 'PT1: Ks/(1+sT1)' },
    { value: 'pt2', label: 'PT2 aperiodisch: Ks/((1+sT1)(1+sT2))' },
    { value: 'pt2d', label: 'PT2 schwingfähig (D)' },
    { value: 'pt3', label: 'PT3: drei Verzögerungen' },
    { value: 'pt1tt', label: 'PT1 mit Totzeit' },
    { value: 'pt2tt', label: 'PT2 mit Totzeit' },
    { value: 'i', label: 'I-Strecke: Ki/s' },
    { value: 'it1', label: 'I-Strecke mit Verzögerung: Ki/(s(1+sT1))' }
  ];
  const isI = t => t === 'i' || t === 'it1';
  const vis = (list) => s => !!s && list.indexOf(s.type) >= 0;

  const CONTROLS = B.controlSet({
    range: RANGE, ctrls: ['P', 'I', 'PI', 'PD', 'PID', '2P', '3P'], ctrlDefault: 'P', kp: 1, tn: { min: 0.5, max: 500, step: 0.5, value: 20 }, tv: { max: 50, step: 0.5, value: 0 }, u0: OP,
    ta: [0.01, 0.05, 0.2, 1], hyst: { min: 0.2, max: 20, step: 0.2, value: 2 }, dead: { min: 0, max: 10, step: 0.2, value: 1 },
    w: { min: 0, max: 100, step: 0.5, value: 50, label: 'Sollwert w' }, wRamp: { max: 10, step: 0.1 },
    extra: [
      { key: 'type', label: 'Strecke', type: 'select', value: 'pt1', options: TYPES, group: 'Strecke',
        help: 'Wähle die Regelstrecke. Der Arbeitspunkt liegt bei Stellgröße ' + fn(OP, 0) + ' % und Regelgröße ' + fn(OP, 0) + ' %. Beim Umschalten der Strecke geht sie in den Beharrungszustand für die aktuelle Stellgröße.' },
      { key: 'ks', label: 'Streckenverstärkung Ks', type: 'slider', scale: 'log', min: 0.2, max: 5, step: 0.05, unit: '', value: 1, group: 'Strecke',
        visible: s => !!s && !isI(s.type), help: 'Ks = Änderung der Regelgröße je Änderung der Stellgröße im Beharrungszustand (beide in %).' },
      { key: 't1', label: 'Zeitkonstante T1', type: 'slider', scale: 'log', unitKind: 'time', min: 0.2, max: 100, step: 0.1, unit: 's', value: 10, group: 'Strecke',
        visible: vis(['pt1', 'pt2', 'pt2d', 'pt3', 'pt1tt', 'pt2tt', 'it1']), help: 'Erste Zeitkonstante. Bei der schwingfähigen PT2 gilt ω0 = 1/T1.' },
      { key: 't2', label: 'Zeitkonstante T2', type: 'slider', scale: 'log', unitKind: 'time', min: 0.05, max: 100, step: 0.05, unit: 's', value: 3, group: 'Strecke',
        visible: vis(['pt2', 'pt3', 'pt2tt']), help: 'Zweite Zeitkonstante der Kette.' },
      { key: 't3', label: 'Zeitkonstante T3', type: 'slider', scale: 'log', unitKind: 'time', min: 0.02, max: 100, step: 0.02, unit: 's', value: 1, group: 'Strecke',
        visible: vis(['pt3']), help: 'Dritte Zeitkonstante der Kette.' },
      { key: 'tt', label: 'Totzeit Tt', type: 'slider', scale: 'lin', unitKind: 'time', min: 0, max: 20, step: 0.1, unit: 's', value: 2, group: 'Strecke',
        visible: vis(['pt1tt', 'pt2tt']), help: 'Totzeit: Die Strecke reagiert erst nach Tt. Sie wird auf ein Vielfaches des Rechenschritts gerundet.' },
      { key: 'd', label: 'Dämpfung D', type: 'slider', scale: 'lin', min: 0.1, max: 1.5, step: 0.05, unit: '', value: 0.5, group: 'Strecke',
        visible: vis(['pt2d']), help: 'Dämpfung der schwingfähigen PT2: Unter 1 schwingt die Sprungantwort, je kleiner D, desto stärker.' },
      { key: 'ki', label: 'Integrierbeiwert Ki', type: 'slider', scale: 'log', min: 0.01, max: 2, step: 0.01, unit: '1/s', value: 0.1, group: 'Strecke',
        visible: vis(['i', 'it1']), help: 'Die I-Strecke integriert die Stellgröße (abzüglich ' + fn(OP, 0) + ' %): Die Regelgröße steigt je Sekunde um Ki mal Stelländerung. Sie ist auf ' + fn(RANGE.lo, 0) + ' bis ' + fn(RANGE.hi, 0) + ' % begrenzt.' },
      { key: 'z', label: 'Störgröße z', type: 'slider', scale: 'lin', min: -30, max: 30, step: 1, unit: '%', value: 0, group: 'Anlage und Störung',
        help: 'Störgröße: wird am Streckeneingang zur Stellgröße addiert (in %). Ein Sprung an z zeigt das Störverhalten.' }
    ]
  });
  const mr = B.meterRows(RANGE);
  const METERS = [
    { key: 'x', label: 'Regelgröße x', unit: '%', digits: 1, min: 0, max: 100 }, mr.w, mr.e, mr.y,
    { key: 'v0', label: 'Kreisverstärkung V0 = Kp·Ks', unit: '', digits: 2, min: 0, max: 50 }
  ];
  function mkPreset(id, name, params, op) { return { id, name, params, op }; }
  const PRESETS = (function () {
    const base = { mode: 'hand', yHand: OP, w: OP, ks: 1 };
    const P = (o) => Object.assign({}, base, o);
    const pt1 = P({ type: 'pt1', t1: 10 }), pt2 = P({ type: 'pt2', t1: 10, t2: 3 }), pt3 = P({ type: 'pt3', t1: 10, t2: 3, t3: 1 });
    const tt = P({ type: 'pt1tt', t1: 10, tt: 2 }), it = P({ type: 'i', ki: 0.1 }), d = P({ type: 'pt2d', t1: 10, d: 0.3 }), zn = P({ type: 'pt3', t1: 10, t2: 5, t3: 2 });
    const op = { y: OP };
    return [
      mkPreset('pt1', 'PT1 (Ks = ' + fn(pt1.ks, 1) + ', T1 = ' + fn(pt1.t1, 0) + ' s)', pt1, op),
      mkPreset('pt2', 'PT2 aperiodisch (T1 = ' + fn(pt2.t1, 0) + ' s, T2 = ' + fn(pt2.t2, 0) + ' s)', pt2, op),
      mkPreset('pt3', 'PT3 (T1 = ' + fn(pt3.t1, 0) + ' s, T2 = ' + fn(pt3.t2, 0) + ' s, T3 = ' + fn(pt3.t3, 0) + ' s)', pt3, op),
      mkPreset('pt1tt', 'PT1 mit Totzeit (T1 = ' + fn(tt.t1, 0) + ' s, Tt = ' + fn(tt.tt, 0) + ' s)', tt, op),
      mkPreset('i', 'I-Strecke (Ki = ' + fn(it.ki, 2) + ' 1/s)', it, op),
      mkPreset('pt2d', 'schwingfähige PT2 (T1 = ' + fn(d.t1, 0) + ' s, D = ' + fn(d.d, 1) + ')', d, op),
      mkPreset('zn', 'Z-N-Beispiel (PT3 mit T = ' + fn(zn.t1, 0) + ' / ' + fn(zn.t2, 0) + ' / ' + fn(zn.t3, 0) + ' s)', zn, op)
    ];
  })();

  const ICON = { p: 'p', pt1: 'pt1', pt2: 'pt2', pt2d: 'pt2d', pt3: 'pt3', pt1tt: 'pt1tt', pt2tt: 'pt2tt', i: 'i', it1: 'it1' };
  const KEYS = ['type', 'ks', 't1', 't2', 't3', 'tt', 'd', 'ki'];

  function plantBau(P0) {
    const ctl = P0.ctl, p = P0.params, h = P0.h, CORE = P0.CORE;
    let pl = null, xv = OP, yCur = OP, an = { key: '', val: null };
    const vs = { t: -1 };
    function specOf() {
      const t = ctl.type, K = { t: 'K', K: ctl.ks }, T1 = { t: 'PT1', T: ctl.t1 }, T2 = { t: 'PT1', T: ctl.t2 }, T3 = { t: 'PT1', T: ctl.t3 }, TT = { t: 'Tt', Tt: ctl.tt };
      const blocks = t === 'p' ? [K] : t === 'pt1' ? [K, T1] : t === 'pt2' ? [K, T1, T2] : t === 'pt2d' ? [K, { t: 'PT2', w0: 1 / ctl.t1, D: ctl.d }] : t === 'pt3' ? [K, T1, T2, T3]
        : t === 'pt1tt' ? [K, T1, TT] : t === 'pt2tt' ? [K, T1, T2, TT] : t === 'i' ? [{ t: 'I', Ki: ctl.ki }] : [T1, { t: 'I', Ki: ctl.ki }];
      const s = { blocks, op: { y: OP, x: OP }, zIn: 1, zOut: 0, xmin: -500, xmax: 500 };
      if (isI(t)) s.limit = [0, 100];
      return s;
    }
    function build(y, xHold) {
      const r = CORE.plant(specOf(), h);
      if (!r || r.ok === false) return false;
      pl = r; const s = pl.setSteady(y, ctl.z, xHold); xv = s && isFinite(s.x) ? s.x : OP; yCur = y;
      return true;
    }
    function lin() {
      const b = pl.blocks().map(q => q.t === 'Tt' ? { t: 'Tt', Tt: Math.round(q.Tt / h) * h } : q);
      if (p.sensorTau > 0) b.splice(b.length - (b.length && b[b.length - 1].t === 'Tt' ? 1 : 0), 0, { t: 'PT1', T: p.sensorTau });
      return b;
    }
    function formula() {
      const b = lin(); let num = '', den = [], tt = '';
      b.forEach(q => {
        if (q.t === 'K') num += (num ? ' · ' : '') + fm(q.K, 2);
        else if (q.t === 'I') { num += (num ? ' · ' : '') + fm(q.Ki, 2); den.push('s'); }
        else if (q.t === 'PT1') den.push('(1 + ' + fn(q.T, 2) + ' s)');
        else if (q.t === 'PT2') den.push('(1 + ' + fn(2 * q.D / q.w0, 2) + ' s + ' + fn(1 / (q.w0 * q.w0), 2) + ' s²)');
        else if (q.t === 'Tt' && q.Tt > 0) tt = 'e^(−' + fn(q.Tt, 2) + ' s)';
      });
      return 'G(s) = ' + (num || '1') + (tt ? ' · ' + tt : '') + (den.length ? ' / ' + (den.length > 1 ? '(' + den.join('') + ')' : den[0]) : '');
    }
    function analysisCached(fnA) {
      const key = [ctl.type, ctl.ks, ctl.t1, ctl.t2, ctl.t3, ctl.tt, ctl.d, ctl.ki, ctl.ctrl, ctl.kp, ctl.tn, ctl.tv, ctl.ta, ctl.dir].join('|');
      if (an.key !== key || !an.val) { an.key = key; an.val = fnA ? fnA() : null; }
      return an.val;
    }
    build(OP, OP);
    return {
      q() { return isI(ctl.type) ? 1 : 0; },
      reset() { build(OP, OP); an = { key: '', val: null }; },
      setOp(y) { const s = pl.setSteady(y, ctl.z, xv); xv = s && isFinite(s.x) ? s.x : xv; yCur = y; },
      step(y) { yCur = y; xv = pl.step(y, ctl.z); },
      xPct() { return xv; },
      steady(y, z) { return isI(ctl.type) ? NaN : pl.steady(y, z); },
      yFor(x, z) {
        const zz = z === undefined ? ctl.z : z;
        if (isI(ctl.type)) return clamp(OP - zz, 0, 100);
        return clamp(OP + (num(x, OP) - OP) / pl.gain() - zz, 0, 100);
      },
      lin,
      onControl(key) { if (key === '*' || KEYS.indexOf(key) >= 0 || key === 'z') { if (key === 'z') return; build(yCur, xv); an = { key: '', val: null }; } },
      meters() { return { x: xv, v0: ctl.kp * pl.gain() }; },
      extra() { return {}; },
      state(analysis) {
        const a = analysisCached(analysis), m = a && a.margins ? a.margins : null;
        const o = { type: ctl.type, v0: a ? a.V0 : ctl.kp * pl.gain(), phiR: m && m.phiR !== null && isFinite(m.phiR) ? m.phiR : null, AR: m && m.AR !== null && isFinite(m.AR) ? m.AR : null,
          wD: m && m.wD !== null && isFinite(m.wD) ? m.wD : null, bodeStable: m && m.valid ? !!m.stable : null, bodeNote: m ? m.note : (a && a.why ? a.why : ''), formula: formula(), ks: ctl.ks };
        return o;
      },
      curves() {
        const pts = [];
        if (!isI(ctl.type)) for (let y = 0; y <= 100.001; y += 2) pts.push([y, +pl.steady(y, ctl.z).toFixed(3)]);
        return [{ id: 'statisch', title: 'Statische Kennlinie der Strecke (x über y im Beharrungszustand)', xLabel: 'Stellgröße y', xUnit: '%', yLabel: 'Regelgröße x', yUnit: '%',
          series: [{ name: isI(ctl.type) ? 'I-Strecke: kein Beharrungszustand' : 'x(y) bei aktuellem z', points: pts }], marker: { x: yCur, y: xv } }];
      },
      hit(x, y) {
        if (x >= 170 && x <= 340 && y >= 150 && y <= 250) return { key: 'mode', kind: 'switch' };
        return null;
      },
      draw(ctx, W, H, tms, V, D) {
        if (!D) { G.placeholder(ctx, W, H); return; }
        const L = (s, x, y, o) => D.label(ctx, s, x, y, o);
        const a = analysisCached(V.analysis), m = a && a.margins ? a.margins : null;
        L('Streckenbaukasten (Wirkungsplan)', 20, 26, { align: 'left', size: 20, bold: true });
        L('Alle Größen in % des Messbereichs. Arbeitspunkt: Stellgröße ' + fn(OP, 0) + ' %, Regelgröße ' + fn(OP, 0) + ' %.', 20, 50, { align: 'left', size: 13, color: COL.mute });
        // Vergleichsstelle
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 2; ctx.fillStyle = COL.panel; ctx.beginPath(); ctx.arc(110, 200, 20, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(96, 186); ctx.lineTo(124, 214); ctx.moveTo(124, 186); ctx.lineTo(96, 214); ctx.stroke();
        D.arrow(ctx, 30, 200, 88, 200, { head: 9, color: COL.accent, width: 2 });
        L('w = ' + fm(V.ws, 1) + ' %', 50, 178, { size: 13, bold: true, color: COL.accent });
        L(V.dir === 'direkt' ? '+' : '−', 78, 188, { size: 14, bold: true }); L(V.dir === 'direkt' ? '−' : '+', 120, 232, { size: 14, bold: true });
        D.arrow(ctx, 132, 200, 168, 200, { head: 9, width: 2 });
        L('e = ' + fm(V.e, 1), 150, 178, { size: 12, color: COL.fg });
        // Regler
        G.box(ctx, 170, 150, 170, 100, V.mode === 'hand' ? '#4a3b1a' : COL.panel, V.mode === 'hand' ? COL.warn : COL.line);
        L(B.CTRL_LABEL[V.ctrl] || V.ctrl, 255, 168, { size: 12, bold: true, color: COL.accent, maxw: 160 });
        D.icon(ctx, V.ctrl.toLowerCase(), 195, 178, 120, 48, {});
        L(V.mode === 'hand' ? 'HAND (tippen: Automatik)' : 'Kp = ' + fn(V.kp, 1) + ' (tippen: Hand)', 255, 240, { size: 11, color: COL.mute, maxw: 160 });
        // Stoerstelle
        D.arrow(ctx, 340, 200, 400, 200, { head: 9, color: COL.warn, width: 2 });
        L('y = ' + fm(V.y, 1) + ' %', 372, 178, { size: 12, bold: true, color: COL.warn });
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 2; ctx.fillStyle = COL.panel; ctx.beginPath(); ctx.arc(420, 200, 16, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(420, 190); ctx.lineTo(420, 210); ctx.moveTo(410, 200); ctx.lineTo(430, 200); ctx.stroke();
        D.arrow(ctx, 420, 120, 420, 182, { head: 9, color: COL.danger, width: 2 });
        L('z = ' + fn(ctl.z, 0) + ' %', 420, 108, { size: 13, bold: true, color: COL.danger });
        D.arrow(ctx, 436, 200, 470, 200, { head: 9, width: 2 });
        // Strecke
        G.box(ctx, 470, 130, 340, 140, COL.panel, COL.line);
        L('Regelstrecke: ' + (TYPES.find(q => q.value === ctl.type) || { label: ctl.type }).label.split(':')[0], 640, 150, { size: 13, bold: true, maxw: 320 });
        // Kette der Bloecke (Kaestchen mit Kennwert und Sprungantwort-Skizze, Reihenfolge wie in linBlocks)
        const bl = lin(), nb = bl.length, gap = 12, bw = Math.min(110, (324 - gap * (nb - 1)) / nb), bx0 = 478 + (324 - (nb * bw + gap * (nb - 1))) / 2;
        bl.forEach((q, i) => {
          const x = bx0 + i * (bw + gap);
          G.box(ctx, x, 162, bw, 68, COL.panel2, COL.line, 6);
          const lab = q.t === 'K' ? 'Ks = ' + fm(q.K, 2) : q.t === 'PT1' ? 'T = ' + fn(q.T, 2) + ' s' : q.t === 'PT2' ? 'D = ' + fn(q.D, 2) : q.t === 'I' ? 'Ki = ' + fn(q.Ki, 2) + ' 1/s' : 'Tt = ' + fn(q.Tt, 2) + ' s';
          L(lab, x + bw / 2, 175, { size: 11, bold: true, maxw: bw - 6 });
          const ic = q.t === 'K' ? 'p' : q.t === 'PT1' ? 'pt1' : q.t === 'PT2' ? 'pt2d' : q.t === 'I' ? 'i' : null;
          if (ic) D.icon(ctx, ic, x + 8, 184, bw - 16, 38, {});
          else G.line(ctx, [[x + 8, 220], [x + bw * 0.45, 220], [x + bw * 0.45, 190], [x + bw - 8, 190]], COL.accent, 2, []);
          if (i < nb - 1) D.arrow(ctx, x + bw, 196, x + bw + gap, 196, { head: 6, width: 1.5 });
        });
        L(formula(), 640, 248, { size: 11, color: COL.mute, maxw: 326 });
        D.arrow(ctx, 810, 200, 880, 200, { head: 9, color: COL.ok, width: 2 });
        L('x = ' + fm(V.x, 1) + ' %', 862, 178, { size: 13, bold: true, color: COL.ok });
        // Rueckfuehrung
        G.line(ctx, [[880, 200], [930, 200], [930, 330], [110, 330], [110, 222]], COL.ok, 2, [6, 4]);
        D.arrow(ctx, 110, 240, 110, 222, { head: 9, color: COL.ok, width: 2 });
        L('Messglied (Rückführung)', 520, 318, { size: 12, color: COL.mute });
        // Schreiber
        G.box(ctx, 20, 350, 660, 270, COL.panel, COL.line);
        const tr = V.trace(100), n = tr.t.length, gx = 60, gy = 600, gw = 600, gh = 220;
        G.line(ctx, [[gx, gy - gh], [gx, gy], [gx + gw, gy]], COL.line, 1.5, []);
        if (n > 1) {
          const t0 = tr.t[n - 1] - 100, X = t => gx + gw * clamp((t - t0) / 100, 0, 1), Y = v => gy - gh * clamp((v + 10) / 120, 0, 1);
          G.line(ctx, tr.t.map((t, i) => [X(t), Y(tr.w[i])]), COL.accent, 2, [6, 4]);
          G.line(ctx, tr.t.map((t, i) => [X(t), Y(tr.x[i])]), COL.ok, 2.5, []);
          G.line(ctx, tr.t.map((t, i) => [X(t), Y(tr.y[i])]), COL.warn, 1.5, []);
        }
        L('Sollwert w (gestrichelt), Regelgröße x, Stellgröße y der letzten 100 s Prozesszeit', 350, 368, { size: 12, color: COL.mute });
        // Kennwerte
        G.box(ctx, 700, 350, 280, 270, COL.panel, COL.line);
        L('Kreisverstärkung V0 = Kp·Ks = ' + fm(a ? a.V0 : 0, 2), 715, 378, { align: 'left', size: 13, bold: true });
        L(m && m.phiR !== null ? 'Phasenreserve φR = ' + fm(m.phiR, 0) + '°' : 'Phasenreserve: kein Durchtritt', 715, 402, { align: 'left', size: 13 });
        L(m && m.AR !== null ? 'Amplitudenreserve AR = ' + fm(m.AR, 1) + ' dB' : 'Amplitudenreserve: unendlich', 715, 426, { align: 'left', size: 13 });
        L(m && m.wD !== null ? 'Durchtrittsfrequenz ωD = ' + fm(m.wD, 3) + ' rad/s' : 'Durchtrittsfrequenz: –', 715, 450, { align: 'left', size: 13 });
        L(m && m.valid ? (m.stable ? 'Bode-Urteil: stabil' : 'Bode-Urteil: instabil') : 'Kein Bode-Urteil (Schaltregler oder ungültig)', 715, 480, { align: 'left', size: 14, bold: true, color: m && m.valid ? (m.stable ? COL.ok : COL.danger) : COL.mute, maxw: 255 });
        L('Zeitverlauf: ' + V.osc, 715, 506, { align: 'left', size: 13, color: COL.mute });
        let my = 540; V.faults.slice(0, 3).forEach(id => { L('Meldung: ' + id, 715, my, { align: 'left', size: 12, color: COL.danger }); my += 18; });
      }
    };
  }

  R.register({
    id: 'baukasten', name: 'Streckenbaukasten', icon: '🧩',
    info: 'Der Labortisch der Regelungstechnik: Wähle eine Strecke (P, PT1, PT2, PT3, mit Totzeit, schwingfähig, I) und regle sie mit jedem Reglertyp. Hier machst du den Schwingversuch nach Ziegler-Nichols und prüfst Reserven und Stabilität.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeRig({
        id: 'baukasten', range: RANGE, timeScale: 1, tUnit: 's', h: 0.01, spanS: 100, tHold: 5, oscWin: Tdom => Math.max(40, 8 * (isFinite(Tdom) ? Tdom : 5)), sensorTau: PAR.sensorTau, yInit: OP, requiredDir: 'direkt', nonlinear: false,
        params: PAR, controls: CONTROLS, meters: METERS, presets: PRESETS, extraTrace: [], world: { w: 1000, h: 640 },
        roles: { w: 'Sollwert', x: 'Regelgröße x', y: 'Stellgröße y', z: 'Störgröße z', stell: 'Stellglied (Teil der Strecke)', mess: 'Messglied' },
        plant: plantBau
      }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
