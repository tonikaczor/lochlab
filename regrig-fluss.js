/* regrig-fluss.js - Regelungstechnik-Lab: Pruefstand 2 `durchfluss` (Rohrleitung mit Regelventil, SPEC 4.7.2)
 * Physik: Stellantrieb PT1 (Tact, optionale Stellgeschwindigkeit), Ventilkennlinie (linear oder gleichprozentig, R = 30), Wurzel aus dem
 * Vordruck, Rohr-Totzeit, Durchflussmessung PT1 (Hammerstein-Struktur). Alle Bausteine aus REG_CORE (lag, delay, valveChar, valveSlope, sensor).
 * Die gemeinsame Basis (Regelkreis, Schreiber, Diagnose, Bedienpult) liegt in regrig-fuell.js (REG_RIGS.baseA): Diese Datei im Browser
 * NACH regrig-fuell.js laden (in Node holt sie sich die Basis per require).
 */
(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.baseA && typeof require === 'function') { try { require('./regrig-fuell.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.baseA;
  if (!B) { if (typeof console !== 'undefined') console.warn('regrig-fluss.js: Die Basis aus regrig-fuell.js fehlt (bitte davor laden).'); return; }
  const clamp = B.clamp, num = B.num, fm = B.fm, fn = B.fn, G = B.gfx, COL = G.COL;

  const RANGE = { lo: 0, hi: 120, unit: 'L/min', digits: 1 };
  const SPAN = RANGE.hi - RANGE.lo;
  const PAR = { Qmax: 100, R: 30, Tact: 2.0, Tt: 0.4, sensorTau: 0.5 };
  const Z_SCHALT = -30;
  const SLEW_OPTS = [{ value: 0, label: 'aus' }, { value: 10, label: '10 %/s' }, { value: 25, label: '25 %/s' }];

  const CONTROLS = B.controlSet({
    range: RANGE, ctrls: ['P', 'I', 'PI', 'PD', 'PID'], ctrlDefault: 'P', kp: 1, tn: { min: 1, max: 60, step: 0.5, value: 5 }, tv: { max: 5, step: 0.1, value: 0 }, u0: 0,
    ta: [0.02, 0.1, 0.5, 2], w: { min: 5, max: 110, step: 0.5, value: 50, label: 'Solldurchfluss w' }, wRamp: { max: 20, step: 0.5 },
    extra: [
      { key: 'z', label: 'Vordruckänderung z', type: 'slider', scale: 'lin', min: -50, max: 50, step: 1, unit: '%', value: 0, group: 'Anlage und Störung',
        help: 'Störgröße: Änderung des Vordrucks vor dem Ventil. Ein höherer Vordruck gibt mehr Durchfluss bei gleichem Hub, ein Einbruch gibt weniger. Tippe auf den Drehknopf im Bild.' },
      { key: 'char', label: 'Ventilkennlinie', type: 'select', value: 'linear', options: [{ value: 'linear', label: 'linear' }, { value: 'gleichprozentig', label: 'gleichprozentig' }], group: 'Anlage und Störung',
        help: 'Linear: gleicher Hub, gleiche Durchflussänderung. Gleichprozentig: Bei kleinem Hub ändert sich der Durchfluss wenig, bei großem Hub stark. Die Streckenverstärkung hängt dann vom Hub ab.' },
      { key: 'slew', label: 'Stellgeschwindigkeit des Antriebs', type: 'select', value: 0, options: SLEW_OPTS, group: 'Anlage und Störung',
        help: 'Begrenzt, wie schnell sich der Ventilhub ändern darf. Der Stellantrieb kann dem Regler dann nicht mehr schnell folgen.' }
    ]
  });
  const mr = B.meterRows(RANGE);
  const METERS = [
    { key: 'flow', label: 'Durchfluss Q', unit: 'L/min', digits: 1, min: 0, max: 120, warnAbove: 115 }, mr.w, mr.e, mr.y,
    { key: 'valve', label: 'Ventilhub', unit: '%', digits: 1, min: 0, max: 100, warnAbove: 99.5 },
    { key: 'gain', label: 'Streckenverstärkung Ks', unit: '', digits: 2, min: 0, max: 3 },
    { key: 'pRel', label: 'Vordruck (relativ)', unit: '%', digits: 0, min: 50, max: 150 }
  ];
  function mkPreset(id, name, params, op, then) { return { id, name, params, op, then }; }
  const PRESETS = (function () {
    const pLin = { mode: 'hand', yHand: 20, char: 'linear', w: 20 };
    const pGp = { mode: 'hand', yHand: 20, char: 'gleichprozentig', w: 20 };
    const pPI = { mode: 'auto', ctrl: 'PI', kp: 1.2, tn: 3, w: 70 };
    const pVor = { mode: 'auto', ctrl: 'PI', kp: 1.2, tn: 3, w: 60 };
    return [
      mkPreset('linear-hand', 'Linear Hand (Hub ' + fn(pLin.yHand, 0) + ' %)', pLin, { y: pLin.yHand }),
      mkPreset('gleichprozentig-hand', 'Gleichprozentig Hand (Hub ' + fn(pGp.yHand, 0) + ' %)', pGp, { y: pGp.yHand }),
      mkPreset('pi-regler', 'PI-Regler Durchfluss (Kp = ' + fn(pPI.kp, 1) + ', Tn = ' + fn(pPI.tn, 0) + ' s, Soll ' + fn(pPI.w, 0) + ' L/min)', pPI, { x: 50 }),
      mkPreset('vordruck', 'Vordruck-Einbruch (z = ' + fn(Z_SCHALT, 0) + ' %, PI-Regler)', pVor, { x: 60 }, { z: Z_SCHALT })
    ];
  })();

  function plantFluss(P0) {
    const ctl = P0.ctl, p = P0.params, h = P0.h, CORE = P0.CORE;
    const alpha = CORE.lag(p.Tact, h).alpha, del = CORE.delay(p.Tt, h), Ttq = del.Tt;
    let a = 0, q = 0, qss = 0, limited = false, limAge = 1e9, tFull = 0;
    const vis = { t: -1, rot: 0, ph: 0 };
    const pr = z => Math.sqrt(1 + z / 100);
    const qssOf = (y, z, kind) => p.Qmax * CORE.valveChar(y, kind || ctl.char, p.R) * pr(z);
    function lin(opY) {
      const y0 = opY === undefined ? a : clamp(num(opY, 0), 0, 100);
      const Ks = p.Qmax * pr(ctl.z) * CORE.valveSlope(y0, ctl.char, p.R) / SPAN * 100;
      const b = [{ t: 'K', K: Ks }, { t: 'PT1', T: p.Tact }];
      if (p.sensorTau > 0) b.push({ t: 'PT1', T: p.sensorTau });
      b.push({ t: 'Tt', Tt: Ttq });
      return b;
    }
    function nextZ() { return ctl.z === 0 ? Z_SCHALT : ctl.z < 0 ? -Z_SCHALT : 0; }
    return {
      q() { return 0; },
      reset() { a = 0; qss = qssOf(0, ctl.z); q = qss; del.reset(qss); limited = false; limAge = 1e9; tFull = 0; },
      setOp(y) { a = y; qss = qssOf(a, ctl.z); q = qss; del.reset(qss); limited = false; limAge = 1e9; },
      step(y) {
        let da = alpha * (y - a), sl = num(ctl.slew, 0);
        limited = false;
        if (sl > 0) { const m = sl * h; if (da > m) { da = m; limited = true; } else if (da < -m) { da = -m; limited = true; } }
        a = clamp(a + da, 0, 100);
        limAge = limited ? 0 : limAge + h;
        qss = qssOf(a, ctl.z); q = del.step(qss);
      },
      xPct() { return (q - RANGE.lo) / SPAN * 100; },
      steady(y, z) { return qssOf(y, z); },
      yFor(Q, z) {
        const f = clamp(num(Q, 0) / (p.Qmax * pr(z === undefined ? ctl.z : z)), 0, 1);
        if (ctl.char === 'linear') return clamp(100 * f, 0, 100);
        return clamp(100 * Math.log(1 + f * (p.R - 1)) / Math.log(p.R), 0, 100);
      },
      lin,
      meters() { return { flow: q, valve: a, gain: lin()[0].K, pRel: 100 + ctl.z }; },
      extra() { return { valve: a }; },
      state() { return { flow: q, valve: a, gain: lin()[0].K, pRel: 100 + ctl.z, char: ctl.char, slew: num(ctl.slew, 0), slewLimited: limited || limAge < 0.5, tt: Ttq }; },
      diag(d) {
        const out = [];
        tFull = a >= 99.5 ? tFull + d.dtE : 0;
        if (tFull >= d.tHold) out.push({ id: 'ventil-auf', kind: 'warn', text: 'Das Ventil ist voll geöffnet (Hub 100 %). Mehr Durchfluss ist bei diesem Vordruck nicht möglich (Maximum ' + fm(qssOf(100, ctl.z), 1) + ' L/min).' });
        if (num(ctl.slew, 0) > 0 && limAge < 0.5) out.push({ id: 'slew', kind: 'info', text: 'Die Stellgeschwindigkeit des Ventils ist auf ' + fn(num(ctl.slew, 0), 0) + ' %/s begrenzt: Der Stellantrieb kann dem Regler nicht schneller folgen.' });
        return out;
      },
      curves() {
        const z = ctl.z, kinds = [['linear', 'linear'], ['gleichprozentig', 'gleichprozentig']], qs = [], ks = [];
        kinds.forEach(k => {
          const pq = [], pk = [];
          for (let y = 0; y <= 100.001; y += 2) { pq.push([y, +qssOf(y, z, k[0]).toFixed(3)]); pk.push([y, +(p.Qmax * pr(z) * CORE.valveSlope(y, k[0], p.R) / SPAN * 100).toFixed(4)]); }
          const cur = ctl.char === k[0], nm = k[1] + (cur ? ' (aktuell)' : '');
          qs.push({ name: nm, points: pq, current: cur }); ks.push({ name: nm, points: pk, current: cur });
        });
        return [
          { id: 'q-y', title: 'Durchfluss über Ventilhub (Beharrung)', xLabel: 'Ventilhub', xUnit: '%', yLabel: 'Durchfluss Q', yUnit: 'L/min', series: qs, marker: { x: a, y: q } },
          { id: 'ks-y', title: 'Streckenverstärkung Ks über Ventilhub', xLabel: 'Ventilhub', xUnit: '%', yLabel: 'Streckenverstärkung Ks', yUnit: '%/%', series: ks, marker: { x: a, y: lin()[0].K } }
        ];
      },
      hit(x, y) {
        if (Math.hypot(x - 260, y - 236) <= 40) return { key: 'z', kind: 'switch', to: nextZ() };
        if (x >= 700 && x <= 980 && y >= 300 && y <= 345) return { key: 'mode', kind: 'switch' };
        return null;
      },
      draw(ctx, W, H, tms, V, D) {
        if (!D) { G.placeholder(ctx, W, H); return; }
        const dt = tms < vis.t || vis.t < 0 ? 0 : clamp(tms - vis.t, 0, 100); vis.t = tms;
        const f = clamp(q / 120, 0, 1);
        vis.rot += dt * f * 0.02; vis.ph += dt * f * 0.08;
        const L = (s, x, y, o) => D.label(ctx, s, x, y, o);
        L('Durchflussregelung (Übungsanlage)', 20, 26, { align: 'left', size: 20, bold: true });
        L('Regelventil mit Stellantrieb, ' + (ctl.char === 'linear' ? 'lineare' : 'gleichprozentige') + ' Kennlinie, Durchflussmesser mit Totzeit durch die Rohrleitung', 20, 50, { align: 'left', size: 13, color: COL.mute });
        // Rohrleitung
        D.pipe(ctx, [[30, 380], [130, 380], [420, 380], [640, 380], [970, 380]], { flow: f, phase: vis.ph, width: 18 });
        D.pump(ctx, 130, 380, { size: 70, rot: vis.rot });
        L('Pumpe', 130, 432, { size: 13, color: COL.mute });
        D.valve(ctx, 420, 380, { kind: 'regel', open: a / 100, size: 70 });
        L('Regelventil', 420, 432, { size: 13, color: COL.mute });
        L('Hub ' + fm(a, 1) + ' %', 420, 450, { size: 13, bold: true });
        // Durchflussmesser mit Fluegelrad
        ctx.fillStyle = COL.panel2; ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(640, 380, 32, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = COL.accent; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const an = vis.rot * 0.6 + i * 2.0944; ctx.beginPath(); ctx.moveTo(640, 380); ctx.lineTo(640 + Math.cos(an) * 22, 380 + Math.sin(an) * 22); ctx.stroke(); }
        L('Durchflussmesser', 640, 432, { size: 13, color: COL.mute });
        L('Q = ' + fm(V.x, 1) + ' L/min', 640, 450, { size: 13, bold: true, color: COL.ok });
        // Manometer und Drehknopf (Vordruck)
        D.pipe(ctx, [[156, 330], [156, 302]], { flow: 0, width: 8 });
        D.gauge(ctx, 156, 252, 50, { value: 100 + ctl.z, lo: 50, hi: 150, unit: '%', digits: 0 });
        L('Vordruck (relativ)', 156, 312, { size: 12, color: COL.mute });
        const ang = -2.356 + (ctl.z + 50) / 100 * 4.712;
        ctx.fillStyle = COL.panel2; ctx.strokeStyle = COL.warn; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(260, 236, 30, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(260, 236); ctx.lineTo(260 + Math.sin(ang) * 24, 236 - Math.cos(ang) * 24); ctx.stroke(); ctx.lineCap = 'butt';
        L('z = ' + fn(ctl.z, 0) + ' %', 260, 282, { size: 13, bold: true });
        L('Drehknopf (tippen)', 260, 298, { size: 11, color: COL.mute });
        // Regler und Signale
        G.box(ctx, 330, 80, 300, 130, COL.panel, COL.line);
        L('Regler', 350, 102, { align: 'left', size: 16, bold: true });
        L(B.CTRL_LABEL[V.ctrl] || V.ctrl, 350, 124, { align: 'left', size: 13, color: COL.accent });
        L('Sollwert w = ' + fm(V.ws, 1) + ' L/min', 350, 150, { align: 'left', size: 13 });
        L('Regeldifferenz e = ' + fm(V.e, 1) + ' L/min', 350, 172, { align: 'left', size: 13 });
        L(V.mode === 'hand' ? 'HAND: Regler folgt nur' : 'Kp = ' + fn(V.kp, 1) + (V.ctrl === 'PI' || V.ctrl === 'PID' || V.ctrl === 'I' ? ', Tn = ' + fn(V.tn, 1) + ' s' : ''), 350, 196, { align: 'left', size: 12, color: COL.mute });
        G.line(ctx, [[640, 346], [640, 145]], COL.ok, 2, [6, 4]);
        D.arrow(ctx, 640, 145, 630, 145, { head: 9, color: COL.ok, width: 2 });
        G.line(ctx, [[420, 210], [420, 290]], COL.warn, 2, [6, 4]);
        D.arrow(ctx, 420, 276, 420, 296, { head: 9, color: COL.warn, width: 2 });
        L('y = ' + fm(V.y, 1) + ' %', 470, 255, { size: 13, bold: true, color: COL.warn });
        // Kennlinie
        G.box(ctx, 330, 480, 300, 140, COL.panel, COL.line);
        L('Kennlinie Q(Hub) bei z = ' + fn(ctl.z, 0) + ' %', 480, 498, { size: 12, color: COL.mute });
        const gx = 360, gy = 590, gw = 250, gh = 80;
        G.line(ctx, [[gx, gy - gh], [gx, gy], [gx + gw, gy]], COL.line, 1.5, []);
        const pts = []; for (let y = 0; y <= 100.001; y += 4) pts.push([gx + gw * y / 100, gy - gh * clamp(qssOf(y, ctl.z) / (p.Qmax * 1.25), 0, 1)]);
        G.line(ctx, pts, COL.accent, 2.5, []);
        ctx.fillStyle = COL.warn; ctx.beginPath(); ctx.arc(gx + gw * a / 100, gy - gh * clamp(qssOf(a, ctl.z) / (p.Qmax * 1.25), 0, 1), 5, 0, 6.2832); ctx.fill();
        // Messwerte rechts
        G.box(ctx, 700, 24, 280, 270, COL.panel, COL.line);
        L('Prozesszeit t = ' + fn(V.t, 1) + ' s', 840, 44, { size: 12, color: COL.mute });
        D.gauge(ctx, 775, 130, 58, { value: V.x, lo: 0, hi: 120, setpoint: V.ws, unit: 'L/min', digits: 1, warnFrom: 115 });
        D.gauge(ctx, 905, 130, 58, { value: a, lo: 0, hi: 100, unit: '%', digits: 0, warnFrom: Math.max(1, V.ymax - 0.5) });
        L('Durchfluss', 775, 205, { size: 12, color: COL.mute }); L('Ventilhub', 905, 205, { size: 12, color: COL.mute });
        L('Streckenverstärkung Ks = ' + fm(lin()[0].K, 2), 720, 236, { align: 'left', size: 13 });
        L('Stellgröße y = ' + fm(V.y, 1) + ' %', 720, 258, { align: 'left', size: 13 });
        L('Vordruck ' + fn(100 + ctl.z, 0) + ' %', 720, 280, { align: 'left', size: 13 });
        G.box(ctx, 700, 300, 280, 45, V.mode === 'hand' ? COL.warn : COL.ok, null, 22);
        L(V.mode === 'hand' ? 'HAND (antippen: Automatik)' : 'AUTOMATIK (antippen: Hand)', 840, 323, { size: 15, bold: true, color: '#10161c' });
        if (limited) L('Stellgeschwindigkeit begrenzt', 840, 360, { size: 13, bold: true, color: COL.warn });
        let my = 480; V.faults.slice(0, 3).forEach(id => { L('Meldung: ' + id, 710, my, { align: 'left', size: 12, color: COL.danger }); my += 18; });
      }
    };
  }

  R.register({
    id: 'durchfluss', name: 'Durchflussregelung', icon: '💧',
    info: 'Übungsanlage: Rohrleitung mit Regelventil und Durchflussmesser. Das Ventil hat eine Kennlinie (linear oder gleichprozentig), der Antrieb ist träge und die Leitung hat eine Totzeit. Ein Einbruch des Vordrucks ist die Störgröße.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeRig({
        id: 'durchfluss', range: RANGE, timeScale: 1, tUnit: 's', h: 0.02, spanS: 60, tHold: 5, oscWin: () => 30, sensorTau: PAR.sensorTau, yInit: 0, requiredDir: 'direkt', nonlinear: true,
        params: PAR, controls: CONTROLS, meters: METERS, presets: PRESETS, extraTrace: ['valve'], boolKeys: { z: Z_SCHALT }, world: { w: 1000, h: 640 },
        roles: { w: 'Solldurchfluss', x: 'Durchfluss Q', y: 'Stellsignal Ventilhub', z: 'Vordruck', stell: 'Regelventil mit Stellantrieb', mess: 'Durchflussmesser' },
        plant: plantFluss
      }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
