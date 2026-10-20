(function (root) {
  'use strict';
  const P = root.SPS_PLANTS = root.SPS_PLANTS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, io: def.io }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Anlage 3: Fuellstand und Mischbehaelter =====
  // Physik: Zulauf je Ventil 8 %/s, Ablauf 10 %/s (Ablaufventil ODER Pumpe), Abnehmer an Behaelter 2 4 %/s.
  // Sensoren: B1 min >= 10 %, B2 mitte >= 50 %, B3 max >= 90 %, B4 = Behaelter 2 unter 1 %.
  // Ruehrwerk mischt nur bei Fuellstand >= 50 % (4 s bis vollstaendig durchmischt).
  // Optionen (alle freiwillig, ohne sie bleibt der Verlauf bitgleich): opts.thr {min,mid,max} in %, opts.pumpLpm (Pumpe in l/min),
  // opts.tankL (Behaelterinhalt in Liter, Vorgabe 100, (A): 1 % = 1 l). state().pumpedL zaehlt die bei laufender Pumpe abgepumpten Liter.
  const TH_DEF = { min: 10, mid: 50, max: 90 };
  const TANK_L = 100;
  const RATE_IN = 8, RATE_OUT = 10, RATE_CONS = 4, MIX_S = 4;
  const LW = 800, LH = 480;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const BLUE = [59, 158, 255], YEL = [255, 205, 70], GRN = [84, 205, 115];

  const IO = {
    inputs: [
      { key: 'I0.0', sym: 'S1_Start', text: 'Taster Start (Schließer)', kind: 'button' },
      { key: 'I0.1', sym: 'S2_Stopp', text: 'Taster Stopp (Öffner, Ruhe = 1)', kind: 'button' },
      { key: 'I0.2', sym: 'B1_Min', text: 'Füllstand min (ab 10 %)', kind: 'sensor' },
      { key: 'I0.3', sym: 'B2_Mitte', text: 'Füllstand mitte (ab 50 %)', kind: 'sensor' },
      { key: 'I0.4', sym: 'B3_Max', text: 'Füllstand max (ab 90 %)', kind: 'sensor' },
      { key: 'I0.5', sym: 'B4_Beh2Leer', text: 'Behälter 2 leer (Ablauf möglich)', kind: 'sensor' },
      { key: 'I0.6', sym: 'S3_NotHalt', text: 'Not-Halt (Öffner, Ruhe = 1)', kind: 'switch' }
    ],
    outputs: [
      { key: 'Q0.0', sym: 'Y1_ZulaufA', text: 'Ventil Zulauf A (blau)' },
      { key: 'Q0.1', sym: 'Y2_ZulaufB', text: 'Ventil Zulauf B (gelb)' },
      { key: 'Q0.2', sym: 'M1_Ruehrwerk', text: 'Rührwerk' },
      { key: 'Q0.3', sym: 'Y3_Ablauf', text: 'Ablaufventil' },
      { key: 'Q0.4', sym: 'P1_Pumpe', text: 'Pumpe Ablauf' },
      { key: 'Q0.5', sym: 'H1_Stoerung', text: 'Lampe Störung' }
    ]
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mixCol(fb) { return fb < 0.5 ? lerpC(BLUE, GRN, fb * 2) : lerpC(GRN, YEL, (fb - 0.5) * 2); }
  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function polyAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= l || i === pts.length - 1) { const f = l ? clamp(d / l, 0, 1) : 0; return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; }
      d -= l;
    }
    return pts[0];
  }
  function strokePoly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function tankPath(ctx, x0, y0, x1, y1, r) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1 - r); ctx.quadraticCurveTo(x0, y1, x0 + r, y1); ctx.lineTo(x1 - r, y1); ctx.quadraticCurveTo(x1, y1, x1, y1 - r); ctx.lineTo(x1, y0); ctx.closePath(); }
  function led(ctx, x, y, on, col, r) {
    r = r || 6; col = col || C.ok;
    if (on) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 6.2832); ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = on ? col : '#2e353d'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#ffffff88' : '#00000088'; ctx.stroke();
    if (on) { ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.2832); ctx.fillStyle = '#ffffffaa'; ctx.fill(); }
  }
  function drawPipe(ctx, pts, col, flow, phase) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    ctx.strokeStyle = '#38414b'; ctx.lineWidth = 17; strokePoly(ctx, pts);
    ctx.strokeStyle = '#0d1114'; ctx.lineWidth = 12; strokePoly(ctx, pts);
    if (flow) {
      ctx.strokeStyle = rgb(col, 0.9); ctx.lineWidth = 9; strokePoly(ctx, pts);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 15]); ctx.lineDashOffset = -phase * 45; strokePoly(ctx, pts); ctx.setLineDash([]);
      const L = polyLen(pts);
      for (let d = (phase * 55) % 36; d < L; d += 36) { const q = polyAt(pts, d); ctx.beginPath(); ctx.arc(q[0], q[1], 2.3, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2; ctx.lineDashOffset = 0;
  }
  function drawValve(ctx, x, y, open, rot, label, lx, ly) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const col = open ? C.ok : C.bad;
    ctx.fillStyle = col; ctx.strokeStyle = '#0d1114'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(0, 0); ctx.lineTo(-13, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13, -10); ctx.lineTo(0, 0); ctx.lineTo(13, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -17); ctx.stroke();
    ctx.fillStyle = '#2f3842'; rr(ctx, -9, -26, 18, 10, 3); ctx.fill(); ctx.strokeStyle = '#0d1114'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(open ? -6 : -1.5, open ? -23 : -25, open ? 12 : 3, open ? 4 : 8);
    ctx.restore();
    txt(ctx, label, lx, ly, 12, open ? C.ok : C.bad, 'center', '700');
  }

  P.register({
    id: 'tank',
    name: 'Füllstand und Mischbehälter',
    icon: '🧪',
    info: 'Zwei Zulaufventile (A blau, B gelb), Rührwerk, Ablaufventil mit Pumpe und ein zweiter Behälter. Der Behälter füllt und leert sich mit festen Flussraten (8 %/s je Zulauf, 10 %/s Ablauf). Füllstandssensoren bei 10 %, 50 % und 90 %. Läuft er über oder läuft die Pumpe trocken, meldet die Anlage einen Fehler.',
    io: IO,
    create(opts) {
      opts = opts || {};
      const seed = opts.seed != null ? opts.seed : 1;
      let rnd = mulberry32(seed);
      const events = [];
      const num = (v) => typeof v === 'number' && isFinite(v);
      // Schwellen: nur gueltig, wenn 0 < min < mid < max <= 100, sonst gelten die bisherigen Werte
      const TH = Object.assign({}, TH_DEF);
      if (opts.thr && typeof opts.thr === 'object') {
        const t = { min: num(opts.thr.min) ? opts.thr.min : TH_DEF.min, mid: num(opts.thr.mid) ? opts.thr.mid : TH_DEF.mid, max: num(opts.thr.max) ? opts.thr.max : TH_DEF.max };
        if (t.min > 0 && t.min < t.mid && t.mid < t.max && t.max <= 100) { TH.min = t.min; TH.mid = t.mid; TH.max = t.max; }
      }
      const tankL = num(opts.tankL) && opts.tankL > 0 ? opts.tankL : TANK_L;
      const pumpLpm = num(opts.pumpLpm) && opts.pumpLpm > 0 ? opts.pumpLpm : null;
      const PUMP_RATE = pumpLpm === null ? RATE_OUT : pumpLpm / 60 / tankL * 100;   // % pro Sekunde
      // E/A-Beschreibung: bei eigenen Schwellen mit den richtigen Prozentwerten im Text
      const IOI = (TH.min === TH_DEF.min && TH.mid === TH_DEF.mid && TH.max === TH_DEF.max) ? IO : {
        inputs: IO.inputs.map((x) => ({ key: x.key, sym: x.sym, text: x.key === 'I0.2' ? 'Füllstand min (ab ' + TH.min + ' %)' : x.key === 'I0.3' ? 'Füllstand mitte (ab ' + TH.mid + ' %)' : x.key === 'I0.4' ? 'Füllstand max (ab ' + TH.max + ' %)' : x.text, kind: x.kind })),
        outputs: IO.outputs
      };
      let st, layout = { s: 1, ox: 0, oy: 0 }, hits = [], held = {};

      function ev(kind, text, fxk, x, y) { const e = { t: st.t, text: text, kind: kind }; if (fxk) { e.fx = fxk; e.x = x; e.y = y; } events.push(e); if (events.length > 300) events.shift(); }
      function fresh() {
        rnd = mulberry32(seed);
        return {
          t: 0, acc: 0, in0: false, in1: true, in6: true,
          out: { 'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false, 'Q0.4': false, 'Q0.5': false },
          level: 0, level2: 0, amtA: 0, amtB: 0, mixed: 0, mixTimeMs: 0, mixTimeFullMs: 0,
          batches: 0, badBatches: 0, fills: 0, spilled: 0, spilled2: 0, pumpedL: 0,
          overflow: false, overflow2: false, dryRun: false, dryTimer: 0, dryNow: false,
          ovMs: 0, ov2Ms: 0, batchOpen: false, fillReached: false, batchA: 0, batchB: 0,
          fA: 0, fB: 0, fOut: 0, c2: BLUE.slice(), phA: 0, phB: 0, phO: 0, rot: 0, pumpRot: 0, cons: 0
        };
      }
      function layerCol(pos, fracA, m) {
        const fa = clamp(fracA, 0, 1);
        const s = fa <= 0 ? 1 : fa >= 1 ? 0 : clamp((pos - fa) / 0.07 + 0.5, 0, 1);
        return lerpC(lerpC(BLUE, YEL, s), mixCol(1 - fa), m);
      }
      function fracA() { const tot = st.amtA + st.amtB; return tot > 1e-9 ? st.amtA / tot : 1; }
      function curColor() { return layerCol(0.4, fracA(), st.mixed); }

      function tick() {
        const dt = 0.01, o = st.out;
        const inA = o['Q0.0'] ? RATE_IN * dt : 0, inB = o['Q0.1'] ? RATE_IN * dt : 0;
        const add = inA + inB, old = st.level;
        st.fA = inA > 0 ? 1 : 0; st.fB = inB > 0 ? 1 : 0;
        if (inA > 0) st.phA += dt; if (inB > 0) st.phB += dt;
        if (add > 0 && !st.batchOpen) { st.batchOpen = true; st.fillReached = false; st.batchA = 0; st.batchB = 0; st.mixTimeMs = 0; st.mixTimeFullMs = 0; }
        st.level += add; st.amtA += inA; st.amtB += inB; st.batchA += inA; st.batchB += inB;
        if (add > 0 && st.level > 0) st.mixed *= old / st.level;
        let spilling = false;
        if (st.level > 100) {
          const sc = 100 / st.level; st.spilled += st.level - 100; st.amtA *= sc; st.amtB *= sc; st.level = 100; spilling = true;
        }
        if (spilling) {
          if (st.ovMs <= 0) { ev('error', 'Behälter läuft über', 'overflow', 360, 120); }
          st.overflow = true; st.ovMs = 1500;
        } else if (st.ovMs > 0) st.ovMs -= 10;
        // Ablauf
        let outF = 0;
        const drain = o['Q0.3'] || o['Q0.4'];
        if (drain && st.level > 0) {
          const rate = o['Q0.3'] ? (o['Q0.4'] && PUMP_RATE > RATE_OUT ? PUMP_RATE : RATE_OUT) : PUMP_RATE;   // Ventil 10 %/s, Pumpe PUMP_RATE (ohne opts.pumpLpm ebenfalls 10 %/s)
          outF = Math.min(rate * dt, st.level);
          if (o['Q0.4']) st.pumpedL += outF * tankL / 100;
          const sc = (st.level - outF) / st.level;
          st.amtA *= sc; st.amtB *= sc; st.level -= outF;
          if (st.level < 1e-9) { st.level = 0; st.amtA = 0; st.amtB = 0; }
          const nl2 = st.level2 + outF;
          st.c2 = lerpC(st.c2, curColor(), nl2 > 0 ? outF / nl2 : 1);
          st.level2 = nl2;
          st.phO += dt;
        }
        st.fOut = outF > 0 ? 1 : 0;
        if (st.level2 > 100) {
          st.spilled2 += st.level2 - 100; st.level2 = 100;
          if (st.ov2Ms <= 0) ev('error', 'Behälter 2 läuft über', 'overflow', 682, 250);
          st.overflow2 = true; st.ov2Ms = 1500;
        } else if (st.ov2Ms > 0) st.ov2Ms -= 10;
        if (st.level2 > 0) { st.level2 = Math.max(0, st.level2 - RATE_CONS * dt); st.cons = 1; } else st.cons = 0;
        // Trockenlauf
        st.dryNow = !!o['Q0.4'] && st.level < 1;
        if (st.dryNow) { st.dryTimer += 10; if (st.dryTimer >= 300 && !st.dryRun) { st.dryRun = true; ev('error', 'Pumpe läuft trocken', 'dry', 465, 440); } } else st.dryTimer = 0;
        if (o['Q0.4']) st.pumpRot += dt * (st.dryNow ? 4 : 10);
        // Ruehrwerk
        if (o['Q0.2']) {
          st.rot += dt * 9;
          if (st.level >= TH.mid) { st.mixed = Math.min(1, st.mixed + dt / MIX_S); st.mixTimeMs += 10; if (st.level >= TH.max) st.mixTimeFullMs += 10; }
        }
        // Chargen
        if (st.level >= TH.max && st.batchOpen && !st.fillReached) { st.fillReached = true; st.fills++; ev('info', 'Behälter voll (Füllstand max erreicht)'); }
        if (st.batchOpen && outF > 0) {
          if (st.fillReached && st.level < TH.min) {
            const both = st.batchA > 0.5 && st.batchB > 0.5;
            if (!both || st.mixed >= 0.95) { st.batches++; ev('info', 'Charge fertig abgepumpt (Charge ' + st.batches + ')', 'batch', 682, 320); }
            else { st.badBatches++; ev('warn', 'Charge nicht durchmischt in Behälter 2 gelangt', 'badbatch', 682, 320); }
            st.batchOpen = false;
          } else if (!st.fillReached && st.level < 1) st.batchOpen = false;
        }
        st.t += 10;
      }

      const p = {
        io: IOI,
        events: events,
        worldSize() { return { w: LW, h: LH }; },
        setInput(key, v) {
          v = !!v;
          if (key === 'I0.0') st.in0 = v; else if (key === 'I0.1') st.in1 = v; else if (key === 'I0.6') st.in6 = v;
        },
        readInputs() {
          return { 'I0.0': st.in0, 'I0.1': st.in1, 'I0.2': st.level >= TH.min, 'I0.3': st.level >= TH.mid, 'I0.4': st.level >= TH.max, 'I0.5': st.level2 < 1, 'I0.6': st.in6 };
        },
        writeOutputs(o) { for (const k in o) if (k in st.out) st.out[k] = !!o[k]; },
        step(dtMs) {
          st.acc += dtMs;
          while (st.acc >= 10 - 1e-9) { st.acc -= 10; tick(); }
        },
        reset() {
          events.length = 0; held = {};
          st = fresh();
          if (opts.level) p.scenarios.applyState({ level: opts.level, level2: opts.level2 || 0, fracB: opts.fracB, mixed: opts.mixed });
        },
        state() {
          const tot = st.amtA + st.amtB;
          return {
            level: st.level, level2: st.level2, overflow: st.overflow, overflow2: st.overflow2, dryRun: st.dryRun,
            mixTimeMs: st.mixTimeMs, mixTimeFullMs: st.mixTimeFullMs, mixed: st.mixed, fracB: tot > 1e-9 ? st.amtB / tot : 0,
            batches: st.batches, badBatches: st.badBatches, fills: st.fills, spilled: st.spilled, timeMs: st.t,
            pumpedL: st.pumpedL, pumpLpm: pumpLpm, tankL: tankL, thr: { min: TH.min, mid: TH.mid, max: TH.max },
            overflowNow: st.ovMs > 0, dryRunNow: st.dryNow, outputs: Object.assign({}, st.out),
            crash: st.overflow || st.dryRun
          };
        },
        // Szenarien: p.scenarios('halbvoll') oder p.scenarios.applyState({level, level2, fracB, mixed})
        scenarios: null,
        pointer(kind, x, y) {
          const lx = (x - layout.ox) / layout.s, ly = (y - layout.oy) / layout.s;
          if (kind === 'down') {
            for (const h of hits) if (Math.hypot(lx - h.cx, ly - h.cy) <= h.r + 8) {
              held[h.id] = true;
              if (h.id === 'S1') st.in0 = true; else if (h.id === 'S2') st.in1 = false; else if (h.id === 'S3') st.in6 = !st.in6;
              return h.id;
            }
            return null;
          }
          if (kind === 'up') {
            let r = null;
            if (held.S1) { st.in0 = false; r = 'S1'; } if (held.S2) { st.in1 = true; r = 'S2'; }
            held = {}; return r;
          }
          return null;
        },
        draw(ctx, w, h, t) { drawScene(ctx, w, h, t); }
      };

      const scen = function (name) {
        const defs = {
          leer: { level: 0, level2: 0 },
          halbvoll: { level: 50, level2: 0, fracB: 0.5, mixed: 1 },
          voll: { level: 95, level2: 0, fracB: 0.5, mixed: 1 },
          voll_ungemischt: { level: 95, level2: 0, fracB: 0.5, mixed: 0 },
          behaelter2voll: { level: 0, level2: 100 }
        };
        const d = typeof name === 'string' ? defs[name] : name;
        if (!d) return false;
        p.reset();
        st.level = d.level || 0; st.level2 = d.level2 || 0;
        const fb = d.fracB == null ? 0 : d.fracB;
        st.amtA = st.level * (1 - fb); st.amtB = st.level * fb;
        st.mixed = d.mixed || 0; st.c2 = mixCol(fb);
        if (st.level >= 1) { st.batchOpen = true; st.batchA = st.amtA; st.batchB = st.amtB; st.fillReached = st.level >= TH.max; }
        return true;
      };
      // reset() innerhalb von scenarios darf nicht rekursiv Szenario anwenden
      scen.applyState = function (d) { const lv = opts.level; opts.level = 0; const r = scen(d); opts.level = lv; return r; };
      scen.list = ['leer', 'halbvoll', 'voll', 'voll_ungemischt', 'behaelter2voll'];
      p.scenarios = scen;

      // ===== Zeichnen =====
      function liquidTank(ctx, x0, y0, x1, y1, r, level, tt, opt) {
        const iy0 = y0 + 6, iy1 = y1 - 3;
        const surf = iy1 - clamp(level, 0, 100) / 100 * (iy1 - iy0);
        if (level > 0.05) {
          ctx.save(); tankPath(ctx, x0 + 2, y0, x1 - 2, y1 - 2, r); ctx.clip();
          const a1 = 1.4 + (opt.stir ? 2.4 : 0) + (opt.inflow ? 1.3 : 0), a2 = a1 * 0.6;
          const wave = (x) => surf + Math.sin(x * 0.06 + tt * 2.6) * a1 + Math.sin(x * 0.115 - tt * 3.7) * a2;
          const g = ctx.createLinearGradient(0, surf, 0, y1);
          for (let i = 0; i <= 12; i++) {
            const pos = 1 - i / 12; // 1 oben, 0 unten
            const c = opt.col ? opt.col(pos) : BLUE;
            const dark = 1 - 0.28 * (i / 12);
            g.addColorStop(i / 12, rgb([c[0] * dark, c[1] * dark, c[2] * dark], 0.93));
          }
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, wave(x0));
          for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, wave(x));
          ctx.lineTo(x1, y1 + 2); ctx.lineTo(x0, y1 + 2); ctx.closePath(); ctx.fill();
          // Oberflaechenglanz
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0, wave(x0));
          for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, wave(x)); ctx.stroke();
          // Rundung (Zylinderwirkung)
          const cg = ctx.createLinearGradient(x0, 0, x1, 0);
          cg.addColorStop(0, 'rgba(255,255,255,0.20)'); cg.addColorStop(0.18, 'rgba(255,255,255,0.04)'); cg.addColorStop(0.7, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0.32)');
          ctx.fillStyle = cg; ctx.fillRect(x0, surf - 6, x1 - x0, y1 - surf + 8);
          // Blasen / Wirbel beim Ruehren
          if (opt.stir) {
            for (let i = 0; i < 14; i++) {
              const hh = y1 - surf; if (hh < 12) break;
              const bx = x0 + 12 + hash(i + 1) * (x1 - x0 - 24) + Math.sin(tt * 3 + i) * 4;
              const by = y1 - ((tt * (22 + hash(i + 9) * 30) + hash(i + 5) * 400) % hh);
              ctx.beginPath(); ctx.arc(bx, by, 1.4 + hash(i + 3) * 2.4, 0, 6.2832); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
            }
          }
          ctx.restore();
        }
        return surf;
      }

      function drawScene(ctx, w, h, t) {
        const tt = typeof t === 'number' ? t / 1000 : st.t / 1000;
        const s = Math.min(w / LW, h / LH), ox = (w - LW * s) / 2, oy = (h - LH * s) / 2;
        layout = { s: s, ox: ox, oy: oy }; hits = [];
        const o = st.out, inp = p.readInputs();
        ctx.save();
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
        ctx.translate(ox, oy); ctx.scale(s, s);
        ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
        const bgG = ctx.createLinearGradient(0, 0, 0, LH); bgG.addColorStop(0, '#171c21'); bgG.addColorStop(1, '#101316');
        ctx.fillStyle = bgG; ctx.fillRect(0, 0, LW, LH);
        ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
        for (let x = 0; x <= LW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LH); ctx.stroke(); }
        for (let y = 0; y <= LH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke(); }
        // Boden
        ctx.fillStyle = '#1b2127'; ctx.fillRect(0, 466, LW, 14); ctx.fillStyle = '#2b333c'; ctx.fillRect(0, 466, LW, 2);

        // Titel und Status
        txt(ctx, 'Mischbehälter', 20, 26, 17, C.text, 'left', '700');
        const flowIn = o['Q0.0'] || o['Q0.1'];
        let stat = 'Bereit', scol = C.dim;
        if (st.overflow && st.ovMs > 0) { stat = 'STÖRUNG: Überlauf'; scol = C.bad; }
        else if (st.dryNow) { stat = 'STÖRUNG: Pumpe trocken'; scol = C.bad; }
        else if (st.out['Q0.3'] || st.out['Q0.4']) { if (st.level > 0) { stat = 'Entleeren'; scol = C.acc; } }
        else if (o['Q0.2'] && st.level >= TH.mid) { stat = st.mixed < 0.95 ? 'Mischen' : 'Gemischt'; scol = C.ok; }
        else if (flowIn) { stat = 'Füllen'; scol = C.acc; }
        ctx.fillStyle = C.panel; rr(ctx, 600, 10, 180, 28, 14); ctx.fill();
        led(ctx, 620, 24, stat !== 'Bereit', scol, 5);
        txt(ctx, stat, 634, 24, 13, scol === C.dim ? C.dim : scol, 'left', '700');

        // Zulaufbehaelter A/B
        const srcs = [[75, 'A', BLUE], [725, 'B', YEL]];
        srcs.forEach((sc) => {
          const x = sc[0], col = sc[2];
          ctx.fillStyle = C.panel; rr(ctx, x - 34, 52, 68, 62, 8); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
          const g = ctx.createLinearGradient(0, 62, 0, 112); g.addColorStop(0, rgb(col, 0.9)); g.addColorStop(1, rgb(col, 0.45));
          ctx.fillStyle = g; rr(ctx, x - 29, 70, 58, 38, 5); ctx.fill();
          txt(ctx, 'Zulauf ' + sc[1], x, 60, 11, C.dim, 'center', '600');
          txt(ctx, sc[1], x, 90, 22, '#0d1114', 'center', '800');
        });
        const x0 = 260, x1 = 460, y0 = 126, y1 = 392;
        const col = (pos) => layerCol(pos, fracA(), st.mixed);
        const tankCol = curColor();
        // Rohre
        drawPipe(ctx, [[109, 85], [310, 85], [310, y0 - 2]], BLUE, o['Q0.0'], st.phA);
        drawPipe(ctx, [[691, 85], [410, 85], [410, y0 - 2]], YEL, o['Q0.1'], st.phB);
        drawPipe(ctx, [[360, y1 - 6], [360, 446], [570, 446], [570, 300], [622, 300]], tankCol, st.fOut > 0, st.phO);
        drawValve(ctx, 175, 85, o['Q0.0'], 0, 'Y1', 175, 52);
        drawValve(ctx, 560, 85, o['Q0.1'], 0, 'Y2', 560, 52);
        drawValve(ctx, 360, 418, o['Q0.3'], Math.PI / 2, 'Y3', 392, 418);

        // Tankkoerper (Glas)
        ctx.fillStyle = 'rgba(160,200,255,0.05)'; tankPath(ctx, x0, y0, x1, y1, 30); ctx.fill();
        const stir = o['Q0.2'];
        const surf = liquidTank(ctx, x0, y0, x1, y1, 30, st.level, tt, { stir: stir && st.level > 8, inflow: st.fA || st.fB, col: col });
        // Zulaufstrahlen
        const streams = [[310, st.fA, BLUE, st.phA], [410, st.fB, YEL, st.phB]];
        streams.forEach((sm) => {
          if (!sm[1]) return;
          const ey = Math.max(y0, surf) - 0; const top = y0 - 1;
          ctx.save(); ctx.lineCap = 'butt';
          ctx.strokeStyle = rgb(sm[2], 0.92); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(sm[0], top); ctx.lineTo(sm[0], ey); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.setLineDash([6, 12]); ctx.lineDashOffset = -sm[3] * 120; ctx.beginPath(); ctx.moveTo(sm[0] - 1, top); ctx.lineTo(sm[0] - 1, ey); ctx.stroke(); ctx.setLineDash([]);
          for (let k = 0; k < 3; k++) { const ph = (tt * 2 + k / 3) % 1; ctx.beginPath(); ctx.ellipse(sm[0], ey + 1, 6 + ph * 14, 2 + ph * 2.5, 0, 0, 6.2832); ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - ph)) + ')'; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.restore();
        });
        // Ruehrwerk (Welle und Fluegel)
        const bladeY = (y1 - 3) - 0.3 * ((y1 - 3) - (y0 + 6));
        ctx.fillStyle = '#4a5460'; ctx.fillRect(357, y0 - 10, 6, bladeY - y0 + 10);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(358, y0 - 10, 1.5, bladeY - y0 + 10);
        for (let k = 0; k < 3; k++) {
          const a = st.rot + k * 2.0944, cx = Math.cos(a), sy = Math.sin(a);
          const dep = sy >= 0;
          ctx.save(); ctx.translate(360, bladeY + sy * 5);
          ctx.fillStyle = dep ? '#c5ced8' : '#7f8a96';
          ctx.beginPath(); ctx.ellipse(cx * 24, 0, Math.max(3, Math.abs(cx) * 24), 5, 0, 0, 6.2832); ctx.globalAlpha = 0.9; ctx.fill(); ctx.restore();
        }
        ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(360, bladeY, 5, 0, 6.2832); ctx.fill();
        // Glasrand und Glanz
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(190,220,255,0.6)'; tankPath(ctx, x0, y0, x1, y1, 30); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; tankPath(ctx, x0 + 5, y0 + 3, x1 - 5, y1 - 5, 26); ctx.stroke();
        const hg = ctx.createLinearGradient(0, y0, 0, y1); hg.addColorStop(0, 'rgba(255,255,255,0.0)'); hg.addColorStop(0.2, 'rgba(255,255,255,0.35)'); hg.addColorStop(0.8, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = hg; rr(ctx, x0 + 11, y0 + 14, 6, 190, 3); ctx.fill();
        // Deckel
        ctx.fillStyle = '#3a444f'; rr(ctx, x0 - 8, y0 - 10, x1 - x0 + 16, 12, 5); ctx.fill(); ctx.strokeStyle = '#0d1114'; ctx.lineWidth = 1.5; ctx.stroke();
        // Motor
        ctx.fillStyle = '#2f3842'; rr(ctx, 336, y0 - 38, 48, 28, 6); ctx.fill(); ctx.strokeStyle = '#4a5460'; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, 'M1', 360, y0 - 25, 12, stir ? C.ok : C.dim, 'center', '800');
        led(ctx, 396, y0 - 28, stir, C.ok, 4);
        // Skala links
        for (let i = 0; i <= 10; i++) {
          const yy = (y1 - 3) - i / 10 * ((y1 - 3) - (y0 + 6));
          ctx.strokeStyle = 'rgba(255,255,255,' + (i % 5 === 0 ? 0.5 : 0.22) + ')'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x0 - 4, yy); ctx.lineTo(x0 - (i % 5 === 0 ? 14 : 9), yy); ctx.stroke();
          if (i % 5 === 0) txt(ctx, i * 10 + '', x0 - 18, yy, 10, C.dim, 'right', '500');
        }
        // Sensormarken rechts
        const sens = [['B1', TH.min, 'I0.2', 'min'], ['B2', TH.mid, 'I0.3', 'mitte'], ['B3', TH.max, 'I0.4', 'max']];
        sens.forEach((sn) => {
          const yy = (y1 - 3) - sn[1] / 100 * ((y1 - 3) - (y0 + 6)), on = inp[sn[2]];
          ctx.strokeStyle = on ? C.ok : '#6b7886'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x1 - 10, yy); ctx.lineTo(x1 + 14, yy); ctx.stroke();
          ctx.fillStyle = '#39424d'; rr(ctx, x1 + 12, yy - 8, 14, 16, 3); ctx.fill();
          led(ctx, x1 + 36, yy, on, C.ok, 6);
          txt(ctx, sn[0] + ' ' + sn[3], x1 + 50, yy, 11, on ? C.ok : C.dim, 'left', '700');
        });
        // Prozentanzeige
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
        txt(ctx, Math.round(st.level) + ' %', 360, 268, 38, '#ffffff', 'center', '800'); ctx.restore();
        txt(ctx, 'Behälter 1', 360, 300, 12, 'rgba(255,255,255,0.7)', 'center', '600');
        // Ueberlauf
        if (st.ovMs > 0 || st.overflow) {
          const act = st.ovMs > 0;
          const pud = clamp(st.spilled * 2.5, 0, 200);
          if (pud > 1) { ctx.fillStyle = rgb(tankCol, 0.6); ctx.beginPath(); ctx.ellipse(360, 463, 30 + pud * 0.5, 4.5, 0, 0, 6.2832); ctx.fill(); }
          if (act) {
            [[x0 - 5, -1], [x1 + 5, 1]].forEach((sd) => {
              const bx = sd[0], dr = sd[1];
              ctx.strokeStyle = rgb(tankCol, 0.9); ctx.lineWidth = 6; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(bx, y0 - 8); ctx.quadraticCurveTo(bx + dr * 14, y0 - 12, bx + dr * 15, y0 + 10); ctx.lineTo(bx + dr * 15, 462); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 14]); ctx.lineDashOffset = -tt * 140;
              ctx.beginPath(); ctx.moveTo(bx + dr * 15, y0 + 10); ctx.lineTo(bx + dr * 15, 462); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
              for (let k = 0; k < 4; k++) { const ph = (tt * 3 + k / 4 + (dr > 0 ? 0.1 : 0)) % 1; ctx.beginPath(); ctx.arc(bx + dr * (18 + ph * 10), 462 - (1 - ph) * 40, 2, 0, 6.2832); ctx.fillStyle = rgb(tankCol, 0.9); ctx.fill(); }
            });
            if (Math.floor(tt * 3) % 2 === 0) txt(ctx, 'ÜBERLAUF!', 360, y0 - 58, 20, C.bad, 'center', '800');
          } else txt(ctx, 'übergelaufen', 360, y0 - 58, 14, C.bad, 'center', '700');
        }

        // Pumpe
        const run = !!o['Q0.4'];
        ctx.fillStyle = '#2a323b'; ctx.beginPath(); ctx.arc(465, 446, 21, 0, 6.2832); ctx.fill();
        ctx.lineWidth = 3.5; ctx.strokeStyle = st.dryNow && Math.floor(tt * 4) % 2 === 0 ? C.bad : st.dryRun && !run ? C.bad : run ? C.ok : '#556070'; ctx.stroke();
        ctx.save(); ctx.translate(465, 446); ctx.rotate(st.pumpRot);
        ctx.fillStyle = run ? '#dfe8f1' : '#7b8794';
        for (let k = 0; k < 6; k++) { ctx.rotate(1.0472); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -3, 15, -9); ctx.lineTo(15, -3); ctx.quadraticCurveTo(7, 4, 0, 4); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(465, 446, 3.5, 0, 6.2832); ctx.fill();
        txt(ctx, 'P1', 465, 478 - 8, 12, run ? C.ok : C.dim, 'center', '800');
        if (st.dryRun) txt(ctx, 'trocken!', 465, 417, 12, C.bad, 'center', '800');
        if (st.dryRun || st.dryNow) {
          for (let k = 0; k < 4; k++) {
            const ph = (tt * 0.7 + k / 4) % 1;
            ctx.globalAlpha = 0.5 * (1 - ph); ctx.fillStyle = '#7b838c';
            ctx.beginPath(); ctx.arc(465 + Math.sin(ph * 6 + k) * 7, 428 - ph * 44, 4 + ph * 10, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Behaelter 2
        const bx0 = 622, bx1 = 742, by0 = 250, by1 = 402;
        ctx.fillStyle = 'rgba(160,200,255,0.05)'; tankPath(ctx, bx0, by0, bx1, by1, 16); ctx.fill();
        liquidTank(ctx, bx0, by0, bx1, by1, 16, st.level2, tt * 0.9 + 1, { stir: false, inflow: st.fOut > 0, col: () => st.c2 });
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(190,220,255,0.6)'; tankPath(ctx, bx0, by0, bx1, by1, 16); ctx.stroke();
        ctx.fillStyle = hg; ctx.globalAlpha = 0.7; rr(ctx, bx0 + 8, by0 + 10, 4, 100, 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a444f'; rr(ctx, bx0 - 5, by0 - 8, bx1 - bx0 + 10, 10, 4); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6; txt(ctx, Math.round(st.level2) + ' %', 682, 322, 24, '#fff', 'center', '800'); ctx.restore();
        txt(ctx, 'Behälter 2', 682, 236, 13, C.dim, 'center', '700');
        const b4 = inp['I0.5'];
        led(ctx, bx1 + 14, by1 - 8, b4, C.ok, 6); txt(ctx, 'B4', bx1 + 14, by1 + 8, 10, b4 ? C.ok : C.dim, 'center', '700');
        ctx.strokeStyle = b4 ? C.ok : '#6b7886'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx1 - 8, by1 - 8); ctx.lineTo(bx1 + 6, by1 - 8); ctx.stroke();
        if (st.ov2Ms > 0 && Math.floor(tt * 3) % 2 === 0) txt(ctx, 'ÜBERLAUF 2!', 682, by0 - 24, 14, C.bad, 'center', '800');
        // Abnehmer
        ctx.fillStyle = '#2f3842'; ctx.fillRect(674, by1, 16, 24);
        if (st.cons) {
          for (let k = 0; k < 3; k++) { const ph = (tt * 2.2 + k / 3) % 1; ctx.beginPath(); ctx.ellipse(682, by1 + 10 + ph * 38, 2, 3, 0, 0, 6.2832); ctx.fillStyle = rgb(st.c2, 1 - ph * 0.6); ctx.fill(); }
        }
        txt(ctx, 'Abnahme', 722, by1 + 28, 10, C.dim, 'center', '500');

        // Statuspanel links
        ctx.fillStyle = C.panel; rr(ctx, 14, 116, 208, 284, 10); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
        let yy = 134; txt(ctx, 'SENSOREN', 28, yy, 11, C.dim, 'left', '800'); yy += 20;
        [['B1', 'Füllstand min', 'I0.2'], ['B2', 'Füllstand mitte', 'I0.3'], ['B3', 'Füllstand max', 'I0.4'], ['B4', 'Behälter 2 leer', 'I0.5']].forEach((r) => {
          led(ctx, 36, yy, inp[r[2]], C.ok, 5); txt(ctx, r[0], 52, yy, 12, C.text, 'left', '800'); txt(ctx, r[1], 76, yy, 12, C.dim, 'left', '500'); txt(ctx, inp[r[2]] ? '1' : '0', 205, yy, 12, inp[r[2]] ? C.ok : C.dim, 'right', '800'); yy += 21;
        });
        yy += 6; txt(ctx, 'AKTOREN', 28, yy, 11, C.dim, 'left', '800'); yy += 20;
        [['Y1', 'Ventil Zulauf A', 'Q0.0', C.ok], ['Y2', 'Ventil Zulauf B', 'Q0.1', C.ok], ['M1', 'Rührwerk', 'Q0.2', C.ok], ['Y3', 'Ablaufventil', 'Q0.3', C.ok], ['P1', 'Pumpe', 'Q0.4', C.ok], ['H1', 'Störung', 'Q0.5', C.bad]].forEach((r) => {
          led(ctx, 36, yy, o[r[2]], r[3], 5); txt(ctx, r[0], 52, yy, 12, C.text, 'left', '800'); txt(ctx, r[1], 76, yy, 12, C.dim, 'left', '500'); txt(ctx, o[r[2]] ? '1' : '0', 205, yy, 12, o[r[2]] ? r[3] : C.dim, 'right', '800'); yy += 21;
        });

        // Taster
        const btn = (id, cx, cy, r, colr, pressed, label) => {
          hits.push({ id: id, cx: cx, cy: cy, r: r });
          ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(cx, cy + 2, r + 4, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = '#4a5460'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, 6.2832); ctx.stroke();
          const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3 + (pressed ? 2 : 0), 1, cx, cy, r);
          g.addColorStop(0, pressed ? colr + 'cc' : '#ffffffbb'); g.addColorStop(0.35, colr); g.addColorStop(1, '#00000066');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy + (pressed ? 2 : 0), r - (pressed ? 2 : 0), 0, 6.2832); ctx.fill();
          txt(ctx, label, cx, cy + r + 15, 11, C.dim, 'center', '700');
        };
        btn('S1', 52, 424, 15, '#2fbf4f', st.in0, 'S1 Start');
        btn('S2', 118, 424, 15, '#d94a4a', !st.in1, 'S2 Stopp');
        ctx.fillStyle = '#d6b21d'; ctx.beginPath(); ctx.arc(184, 424, 24, 0, 6.2832); ctx.fill();
        btn('S3', 184, 424, 17, st.in6 ? '#e63232' : '#7a1d1d', !st.in6, 'S3 Not-Halt');
        // Stoerlampe
        const hon = !!o['Q0.5'];
        led(ctx, 258, 438, hon, C.bad, 9); txt(ctx, 'H1', 258, 460, 11, hon ? C.bad : C.dim, 'center', '700');
        ctx.restore();
      }

      p.reset();
      return p;
    }
  });
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
