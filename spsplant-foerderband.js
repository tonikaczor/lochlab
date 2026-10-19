(function (root) {
  'use strict';
  const P = root.SPS_PLANTS = root.SPS_PLANTS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, io: def.io }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===================================================================
  //  Anlage 1: Foerderband mit Sortierung
  //  Weltkoordinaten 1000 x 560 (Draufsicht). Band laeuft in +x-Richtung.
  // ===================================================================
  const W = 1000, H = 560;
  const BX0 = 60, BX1 = 760, BY0 = 230, BY1 = 310, BYC = 270;   // Band
  const PW = 40, HALF = 20;                                       // Werkstueck 40 x 40
  const SPEED = 80;                                               // Einheiten pro Sekunde
  const X_METAL = 360;      // induktiver Sensor B2 (Mitte)
  const X_PUSH = 480;       // Mitte des Ausschiebers
  const X_BEAM = 502;       // Lichtschranke B1: Teil ist zentriert vor dem Ausschieber, wenn die Vorderkante den Strahl erreicht
  const X_END = 736;        // Bandende-Sensor B5
  const HEADW = 36, HEADT = 12, HEAD_REST = 226, STROKE = 104, CYL_MS = 400;
  const CAPTURE = 12;       // Toleranz, mit der ein Teil vom Ausschieber mitgenommen wird
  const SPAWN_X = 100;
  const NP = 24, NFX = 32;

  const IO = {
    inputs: [
      { key: 'I0.0', sym: 'S1_Start', text: 'S1 Taster Start (Schließer)', kind: 'button', rest: false },
      { key: 'I0.1', sym: 'S2_Stopp', text: 'S2 Taster Stopp (Öffner, Ruhe = 1)', kind: 'button', rest: true },
      { key: 'I0.2', sym: 'B1_Lichtschranke', text: 'B1 Lichtschranke am Ausschieber (1 = Werkstück im Strahl)', kind: 'sensor' },
      { key: 'I0.3', sym: 'B2_Metall', text: 'B2 Induktiver Sensor (1 = Metallteil davor)', kind: 'sensor' },
      { key: 'I0.4', sym: 'B3_Zyl_hinten', text: 'B3 Ausschieber eingefahren (hintere Endlage)', kind: 'sensor' },
      { key: 'I0.5', sym: 'B4_Zyl_vorn', text: 'B4 Ausschieber ausgefahren (vordere Endlage)', kind: 'sensor' },
      { key: 'I0.6', sym: 'B5_Bandende', text: 'B5 Sensor Bandende (1 = Werkstück am Ende)', kind: 'sensor' },
      { key: 'I0.7', sym: 'S3_NotHalt', text: 'S3 Not-Halt (Öffner, Ruhe = 1)', kind: 'switch', rest: true }
    ],
    outputs: [
      { key: 'Q0.0', sym: 'K1_Band', text: 'K1 Schütz Bandmotor vorwärts' },
      { key: 'Q0.1', sym: 'Y1_Ausschieber', text: 'Y1 Zylinder ausfahren (Ausschieber)' },
      { key: 'Q0.2', sym: 'H1_Betrieb', text: 'H1 Lampe Betrieb' },
      { key: 'Q0.3', sym: 'H2_Stoerung', text: 'H2 Lampe Störung' },
      { key: 'Q0.4', sym: 'K2_Rueckwaerts', text: 'K2 Schütz Bandmotor rückwärts' }
    ]
  };

  const INFO = 'Werkstücke (hell = Kunststoff, dunkel = Metall) kommen alle paar Sekunden auf das Band (80 Einheiten/s). ' +
    'Der induktive Sensor B2 erkennt Metallteile, die Lichtschranke B1 sitzt direkt am Ausschieber: ' +
    'Wenn sie ein Teil meldet, steht es vor dem Zylinder Y1. Dunkle Teile sollen in die Rutsche geschoben werden, ' +
    'helle laufen bis zum Bandende (B5). Der Zylinder braucht etwa 0,4 s zum Aus- und Einfahren. ' +
    'Fährt er aus, während ein Teil schief davorliegt oder ein Teil auf den ausgefahrenen Zylinder läuft, gibt es einen Crash.';

  // ---- kleine Helfer (jede Anlagendatei ist eigenstaendig) ----
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mod(a, b) { return ((a % b) + b) % b; }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function txt(c, s, x, y, col, size, align, weight) {
    c.font = (weight || '') + ' ' + size + 'px system-ui, "Segoe UI", sans-serif';
    c.fillStyle = col; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y);
  }
  function led(c, x, y, r, on, col) {
    c.fillStyle = '#0b0e11'; c.beginPath(); c.arc(x, y, r + 2, 0, 6.2832); c.fill();
    if (on) {
      c.globalAlpha = 0.18; c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 2.6, 0, 6.2832); c.fill();
      c.globalAlpha = 0.28; c.beginPath(); c.arc(x, y, r * 1.7, 0, 6.2832); c.fill();
      c.globalAlpha = 1; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.65)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 6.2832); c.fill();
    } else {
      c.fillStyle = '#2a3038'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 6.2832); c.fill();
    }
  }
  const DASH = [7, 5], NODASH = [];

  const SCEN = {
    zufall: { auto: true, ratio: 0.4, mode: 'rnd', tmin: 3000, tmax: 5000 },
    nur_hell: { auto: true, ratio: 0, mode: 'rnd', tmin: 3000, tmax: 5000 },
    nur_metall: { auto: true, ratio: 1, mode: 'rnd', tmin: 3000, tmax: 5000 },
    abwechselnd: { auto: true, ratio: 0.5, mode: 'alt', tmin: 3500, tmax: 3500 },
    dicht: { auto: true, ratio: 0.4, mode: 'rnd', tmin: 1700, tmax: 2600 },
    leer: { auto: false, ratio: 0.4, mode: 'rnd', tmin: 3000, tmax: 5000 }
  };

  function create(opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed;
    let rnd = rng(seed);
    const cfg = { auto: true, ratio: 0.4, mode: 'rnd', tmin: 3000, tmax: 5000 };
    function applyScen(name) {
      const sc = SCEN[name]; if (!sc) return false;
      cfg.auto = sc.auto; cfg.ratio = sc.ratio; cfg.mode = sc.mode; cfg.tmin = sc.tmin; cfg.tmax = sc.tmax; return true;
    }
    if (opts.scenario) applyScen(opts.scenario);
    if (opts.spawn === false) cfg.auto = false;
    if (opts.metalRatio != null) cfg.ratio = opts.metalRatio;
    if (opts.tmin != null) cfg.tmin = opts.tmin;
    if (opts.tmax != null) cfg.tmax = opts.tmax;

    const pcs = [], fx = [];
    for (let i = 0; i < NP; i++) pcs.push({ on: false, x: 0, y: BYC, metal: false, st: 1, drop: 0 });
    for (let i = 0; i < NFX; i++) fx.push({ on: false, kind: '', x: 0, y: 0, metal: false, age: 0, dur: 1 });
    let fxNext = 0;

    const user = { 'I0.0': false, 'I0.1': true, 'I0.7': true };
    const out = { 'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false, 'Q0.4': false };
    const events = [];
    let time, acc, trav, speed, cylMs, prevCyl, spawnTimer, altFlip;
    let delivered, deliveredLight, deliveredMetal, sorted, sortedMetal, sortedLight, lost, crash, violations, spawned, dualFault;

    function ev(text, kind, fxk, x, y) {
      const e = { t: time, text: text, kind: kind || 'info' };
      if (fxk) { e.fx = fxk; e.x = x; e.y = y; }
      events.push(e);
      if (events.length > 300) events.shift();
    }
    function addFx(kind, x, y, metal, dur) {
      let f = null;
      for (let i = 0; i < NFX; i++) if (!fx[i].on) { f = fx[i]; break; }
      if (!f) { f = fx[fxNext]; fxNext = (fxNext + 1) % NFX; }
      f.on = true; f.kind = kind; f.x = x; f.y = y; f.metal = metal; f.age = 0; f.dur = dur;
    }
    function reset() {
      rnd = rng(seed);
      time = 0; acc = 0; trav = 0; speed = 0; cylMs = 0; prevCyl = 0; altFlip = false;
      spawnTimer = 800 + Math.floor(rnd() * 1200);
      delivered = deliveredLight = deliveredMetal = sorted = sortedMetal = sortedLight = lost = violations = spawned = 0;
      crash = false; dualFault = false;
      for (let i = 0; i < NP; i++) pcs[i].on = false;
      for (let i = 0; i < NFX; i++) fx[i].on = false;
      for (const k in out) out[k] = false;
      user['I0.0'] = false; user['I0.1'] = true; user['I0.7'] = true;
      events.length = 0;
    }

    function freePiece() { for (let i = 0; i < NP; i++) if (!pcs[i].on) return pcs[i]; return null; }
    function addPiece(metal, x, y) {
      x = x == null ? SPAWN_X : x;
      for (let i = 0; i < NP; i++) if (pcs[i].on && Math.abs(pcs[i].x - x) < PW + 4) return false;
      const p = freePiece(); if (!p) return false;
      p.on = true; p.x = x; p.y = y == null ? BYC : y; p.metal = !!metal; p.st = 1; p.drop = 0; spawned++;
      return true;
    }
    function trySpawn() {
      for (let i = 0; i < NP; i++) if (pcs[i].on && pcs[i].x < SPAWN_X + PW + 30 && pcs[i].x > SPAWN_X - PW - 30) return false;
      const p = freePiece(); if (!p) return false;
      let metal;
      if (cfg.mode === 'alt') { altFlip = !altFlip; metal = altFlip; rnd(); }
      else metal = rnd() < cfg.ratio;
      p.on = true; p.x = SPAWN_X; p.y = BYC; p.metal = metal; p.st = 1; p.drop = 300; spawned++;
      return true;
    }

    function tick() {
      time += 10;
      const fwd = !!out['Q0.0'], rev = !!out['Q0.4'];
      let v = 0;
      if (fwd && rev) {
        if (!dualFault) { dualFault = true; violations++; ev('Band vorwärts und rückwärts gleichzeitig angesteuert – Motor blockiert (Schütze verriegeln!)', 'error', 'interlock', BX0 + 20, BYC - 70); }
      } else {
        dualFault = false;
        v = fwd ? SPEED : (rev ? -SPEED : 0);
      }
      speed = v;
      const dx = v * 0.01;
      trav += dx;

      prevCyl = cylMs;
      if (out['Q0.1']) { if (cylMs < CYL_MS) cylMs += 10; } else if (cylMs > 0) cylMs -= 10;
      const front = HEAD_REST + STROKE * cylMs / CYL_MS;
      const moving = cylMs !== prevCyl;

      // Zufuhr
      if (cfg.auto) {
        if (spawnTimer > 0) spawnTimer -= 10;
        if (spawnTimer <= 0) {
          if (trySpawn()) spawnTimer = cfg.tmin + Math.floor(rnd() * (cfg.tmax - cfg.tmin + 1));
        }
      }

      for (let i = 0; i < NP; i++) {
        const p = pcs[i]; if (!p.on) continue;
        if (p.drop > 0) p.drop -= 10;
        if (p.st === 1) p.x += dx;
        const ddx = p.x - X_PUSH;
        if (p.st === 1 && front > p.y - HALF && Math.abs(ddx) < (HEADW + PW) / 2) {
          if (Math.abs(ddx) <= CAPTURE) p.st = 2;
          else {
            crash = true; lost++; p.on = false;
            ev(moving ? 'Ausschieber fährt gegen ein Werkstück (Teil lag nicht mittig davor) – Crash!' : 'Werkstück läuft gegen den ausgefahrenen Ausschieber – Crash!', 'error', 'crash', p.x, p.y);
            ev('Werkstück ist heruntergefallen', 'error', 'lost', p.x, p.y + 30);
            addFx('lost', p.x, p.y, p.metal, 900);
            continue;
          }
        }
        if (p.st === 2) {
          const ny = front + HALF;
          if (ny > p.y) p.y = ny; else if (ny < p.y - 1) p.st = 1;
          if (p.y > BY1) {
            p.on = false; sorted++;
            if (p.metal) { sortedMetal++; ev('Metallteil wurde in die Rutsche geschoben', 'info', 'sorted', p.x, p.y); }
            else { sortedLight++; ev('Helles Teil wurde fälschlich ausgeschoben', 'warn', 'wrong', p.x, p.y); }
            addFx('chute', p.x, p.y, p.metal, 700);
            continue;
          }
        }
        if (p.st === 1) {
          if (p.x > BX1) {
            p.on = false; delivered++;
            if (p.metal) { deliveredMetal++; ev('Metallteil ist nicht ausgeschoben am Bandende angekommen', 'warn', 'wrong', p.x, p.y); }
            else { deliveredLight++; ev('Helles Teil am Bandende angekommen', 'info', 'delivered', p.x, p.y); }
            addFx('end', p.x, p.y, p.metal, 600);
          } else if (p.x < BX0) {
            p.on = false; lost++;
            ev('Werkstück ist am Bandanfang heruntergefallen (Band lief rückwärts)', 'error', 'lost', p.x, p.y);
            addFx('lost', p.x, p.y, p.metal, 900);
          }
        }
      }
      for (let i = 0; i < NFX; i++) { const f = fx[i]; if (f.on) { f.age += 10; if (f.age >= f.dur) f.on = false; } }
    }

    function sensors() {
      let b1 = false, b2 = false, b5 = false;
      for (let i = 0; i < NP; i++) {
        const p = pcs[i]; if (!p.on) continue;
        if (Math.abs(p.x - X_BEAM) < HALF) b1 = true;
        if (p.metal && Math.abs(p.x - X_METAL) < 22) b2 = true;
        if (Math.abs(p.x - X_END) < HALF) b5 = true;
      }
      return [b1, b2, b5];
    }

    const plant = {
      id: 'foerderband', name: 'Förderband mit Sortierung', io: IO, events: events,
      setInput(key, v) {
        if (key === 'I0.0' || key === 'I0.1' || key === 'I0.7') user[key] = !!v;
      },
      readInputs() {
        const s = sensors();
        return {
          'I0.0': user['I0.0'], 'I0.1': user['I0.1'], 'I0.2': s[0], 'I0.3': s[1],
          'I0.4': cylMs === 0, 'I0.5': cylMs === CYL_MS, 'I0.6': s[2], 'I0.7': user['I0.7']
        };
      },
      writeOutputs(o) {
        if (!o) return;
        for (const k in out) if (k in o) out[k] = !!o[k];
      },
      step(dtMs) {
        acc += dtMs;
        while (acc >= 10) { acc -= 10; tick(); }
      },
      reset: reset,
      worldSize() { return { w: W, h: H }; },
      state() {
        const px = [], pm = [];
        let n = 0;
        for (let i = 0; i < NP; i++) if (pcs[i].on) { n++; px.push(Math.round(pcs[i].x * 10) / 10); pm.push(pcs[i].metal); }
        return {
          time: time, delivered: delivered, deliveredLight: deliveredLight, deliveredMetal: deliveredMetal,
          sorted: sorted, sortedMetal: sortedMetal, sortedLight: sortedLight, lost: lost, crash: crash,
          violations: violations, spawned: spawned, pieces: n, pieceX: px, pieceMetal: pm,
          cylinder: Math.round(cylMs / CYL_MS * 100), bandSpeed: speed, motorFault: dualFault,
          workpiecesDelivered: delivered, workpiecesSorted: sorted, workpiecesLost: lost
        };
      },
      addPiece: addPiece,
      scenarios: null,
      hitTest(px, py, w, h) {
        const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
        const x = (px - ox) / s, y = (py - oy) / s;
        for (let i = 0; i < CTRL.length; i++) {
          const c = CTRL[i];
          if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) <= (c.r + 8) * (c.r + 8)) return { key: c.key, kind: c.kind };
        }
        return null;
      },
      draw(ctx, w, h, t) {
        if (t == null) t = time;
        const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
        ctx.save();
        ctx.fillStyle = '#14181c'; ctx.fillRect(0, 0, w, h);
        ctx.translate(ox, oy); ctx.scale(s, s);
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        scene(ctx, t);
        ctx.restore();
      }
    };
    const scenFn = function (name) {
      if (name == null) return Object.keys(SCEN);
      return applyScen(name);
    };
    scenFn.list = Object.keys(SCEN);
    plant.scenarios = scenFn;

    // ------------------------------------------------------------------
    //  Zeichnen
    // ------------------------------------------------------------------
    const CTRL = [
      { key: 'I0.0', kind: 'button', x: 610, y: 452, r: 26 },
      { key: 'I0.1', kind: 'button', x: 704, y: 452, r: 26 },
      { key: 'I0.7', kind: 'switch', x: 806, y: 452, r: 30 }
    ];

    function drawPiece(c, x, y, metal, drop, alpha) {
      const k = drop > 0 ? 1 + drop / 300 * 0.3 : 1;
      const sh = drop > 0 ? 4 + drop / 300 * 14 : 4;
      if (alpha != null) c.globalAlpha = alpha;
      c.fillStyle = 'rgba(0,0,0,0.38)'; rr(c, x - HALF * k + sh, y - HALF * k + sh + 1, PW * k, PW * k, 7); c.fill();
      const x0 = x - HALF * k, y0 = y - HALF * k, sz = PW * k;
      const g = c.createLinearGradient(x0, y0, x0 + sz, y0 + sz);
      if (metal) { g.addColorStop(0, '#6a727d'); g.addColorStop(0.5, '#3d444e'); g.addColorStop(1, '#262b32'); }
      else { g.addColorStop(0, '#fbfdff'); g.addColorStop(0.55, '#dbe3ec'); g.addColorStop(1, '#b4bfcc'); }
      c.fillStyle = g; rr(c, x0, y0, sz, sz, 7); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = metal ? '#14181c' : '#8f9cab'; c.stroke();
      // Facette und Details
      c.strokeStyle = metal ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x0 + 6, y0 + sz - 7); c.lineTo(x0 + 6, y0 + 6); c.lineTo(x0 + sz - 7, y0 + 6); c.stroke();
      if (metal) {
        c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x0 + sz * 0.5, y0 + 4, 5, sz - 8);
        c.fillStyle = '#9aa4b0';
        c.beginPath(); c.arc(x0 + sz * 0.28, y0 + sz * 0.28, 2.4 * k, 0, 6.2832); c.arc(x0 + sz * 0.72, y0 + sz * 0.72, 2.4 * k, 0, 6.2832); c.fill();
      } else {
        c.fillStyle = 'rgba(120,135,150,0.35)'; c.beginPath(); c.arc(x, y, 8 * k, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x - 1.5, y - 1.5, 5 * k, 0, 6.2832); c.fill();
      }
      c.globalAlpha = 1;
    }

    function roller(c, cx, ang, run) {
      // Walze (Draufsicht) mit Schattierung und umlaufenden Marken
      const r = 14;
      for (let i = 0; i < 7; i++) {
        const a0 = -1 + i * 2 / 7, a1 = -1 + (i + 1) * 2 / 7;
        const mid = (a0 + a1) / 2, lum = Math.round(60 + 85 * Math.sqrt(Math.max(0, 1 - mid * mid)) * (mid < 0 ? 1 : 0.8));
        c.fillStyle = 'rgb(' + lum + ',' + (lum + 6) + ',' + (lum + 12) + ')';
        c.fillRect(cx + a0 * r, 227, (a1 - a0) * r + 0.6, 86);
      }
      c.strokeStyle = 'rgba(20,24,28,0.9)'; c.lineWidth = 2.2;
      for (let k = 0; k < 4; k++) {
        const a = ang + k * Math.PI / 2;
        if (Math.cos(a) > 0.05) { const xx = cx + Math.sin(a) * r; c.beginPath(); c.moveTo(xx, 228); c.lineTo(xx, 312); c.stroke(); }
      }
      c.fillStyle = '#20262d'; c.fillRect(cx - r - 3, 225, 6, 90); c.fillRect(cx + r - 3, 225, 6, 90);
    }

    function beam(c, x, y0, y1, blockTop, col, t) {
      const yEnd = blockTop == null ? y1 : Math.max(y0, Math.min(y1, blockTop));
      c.setLineDash(NODASH);
      c.globalAlpha = 0.22; c.strokeStyle = col; c.lineWidth = 6;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, yEnd); c.stroke();
      c.globalAlpha = 1; c.lineWidth = 1.6; c.setLineDash(DASH); c.lineDashOffset = -(t * 0.04) % 12;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, yEnd); c.stroke();
      c.setLineDash(NODASH);
      if (blockTop != null && yEnd < y1) {
        c.globalAlpha = 0.18; c.lineWidth = 1.2; c.setLineDash(DASH);
        c.beginPath(); c.moveTo(x, yEnd + PW); c.lineTo(x, y1); c.stroke(); c.setLineDash(NODASH); c.globalAlpha = 1;
      }
    }

    function smokeAt(c, x, y, t) {
      for (let k = 0; k < 4; k++) {
        const ph = ((t / 1600) + k / 4) % 1;
        c.globalAlpha = 0.5 * (1 - ph); c.fillStyle = '#7b838c';
        c.beginPath(); c.arc(x + Math.sin(ph * 6 + k) * 8, y - ph * 46, 5 + ph * 11, 0, 6.2832); c.fill();
      }
      c.globalAlpha = 1;
    }
    function scene(c, t) {
      const ins = plant.readInputs();
      const run = speed !== 0;
      // --- Boden mit feinem Raster ---
      c.fillStyle = '#171c21'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.028)'; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x <= W; x += 40) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0; y <= H; y += 40) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      txt(c, '\u{1F4E6} Förderband mit Sortierung', 24, 26, '#8a96a4', 15, 'left', '600');

      // --- Zufuhr (Magazin) ---
      c.fillStyle = '#10141a'; rr(c, 66, 138, 74, 86, 6); c.fill();
      c.strokeStyle = '#3a424d'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#262d36'; c.beginPath(); c.moveTo(72, 144); c.lineTo(134, 144); c.lineTo(120, 220); c.lineTo(86, 220); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(76, 150, 6, 66);
      txt(c, 'Zufuhr', 103, 126, '#6b7683', 11, 'center');

      // --- Rutsche und Behaelter unter dem Ausschieber ---
      c.fillStyle = '#2b323b'; c.beginPath(); c.moveTo(438, 316); c.lineTo(522, 316); c.lineTo(512, 436); c.lineTo(448, 436); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.moveTo(450, 316); c.lineTo(470, 316); c.lineTo(466, 436); c.lineTo(452, 436); c.closePath(); c.fill();
      c.strokeStyle = '#4a5460'; c.lineWidth = 3; c.beginPath(); c.moveTo(438, 316); c.lineTo(448, 436); c.moveTo(522, 316); c.lineTo(512, 436); c.stroke();
      c.fillStyle = '#12161a'; rr(c, 430, 432, 100, 70, 6); c.fill();
      c.strokeStyle = '#4a5460'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#1b2026'; rr(c, 438, 440, 84, 54, 3); c.fill();
      { // ausgeschobene Teile im Behaelter (max 9 Stueck)
        const nm = Math.min(sortedMetal, 9), nl = Math.min(sortedLight, 9 - nm);
        for (let i = 0; i < nm + nl; i++) {
          const cx = 452 + (i % 3) * 26, cy = 454 + Math.floor(i / 3) * 14;
          c.fillStyle = i < nm ? '#4a525d' : '#d3dbe4'; rr(c, cx - 9, cy - 5, 18, 10, 3); c.fill();
          c.strokeStyle = i < nm ? '#14181c' : '#8f9cab'; c.lineWidth = 1; c.stroke();
        }
      }
      txt(c, 'Rutsche', 480, 515, '#6b7683', 11, 'center');

      // --- Behaelter am Bandende ---
      c.fillStyle = '#2b323b'; c.beginPath(); c.moveTo(770, 236); c.lineTo(812, 226); c.lineTo(812, 314); c.lineTo(770, 304); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(772, 238, 38, 6);
      c.fillStyle = '#12161a'; rr(c, 808, 210, 110, 120, 6); c.fill();
      c.strokeStyle = '#4a5460'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#1b2026'; rr(c, 816, 218, 94, 104, 3); c.fill();
      { // Teile im Endbehaelter (max 12)
        const nd = Math.min(delivered, 12);
        for (let i = 0; i < nd; i++) {
          const cx = 832 + (i % 3) * 28, cy = 236 + Math.floor(i / 3) * 22;
          c.fillStyle = '#d3dbe4'; rr(c, cx - 10, cy - 7, 20, 14, 3); c.fill();
          c.strokeStyle = '#8f9cab'; c.lineWidth = 1; c.stroke();
        }
      }
      txt(c, 'Behälter', 863, 346, '#6b7683', 11, 'center');

      // --- Seitenschienen ---
      const rg = c.createLinearGradient(0, 220, 0, 232);
      rg.addColorStop(0, '#59636f'); rg.addColorStop(1, '#2e353d');
      c.fillStyle = rg; c.fillRect(BX0 - 10, 220, BX1 - BX0 + 20, 10);
      const rg2 = c.createLinearGradient(0, 310, 0, 322);
      rg2.addColorStop(0, '#2e353d'); rg2.addColorStop(1, '#59636f');
      c.fillStyle = rg2; c.fillRect(BX0 - 10, 310, BX1 - BX0 + 20, 10);
      // Schatten unter dem Band
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(BX0, 322, BX1 - BX0, 8);

      // --- Bandflaeche mit laufenden Chevrons ---
      c.save();
      c.beginPath(); c.rect(BX0, BY0, BX1 - BX0, BY1 - BY0); c.clip();
      const bg = c.createLinearGradient(0, BY0, 0, BY1);
      bg.addColorStop(0, '#222930'); bg.addColorStop(0.5, '#2c343c'); bg.addColorStop(1, '#222930');
      c.fillStyle = bg; c.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
      c.strokeStyle = '#3a434d'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
      const off = mod(trav, 28);
      for (let x = BX0 - 28 + off; x < BX1 + 28; x += 28) {
        c.moveTo(x - 10, BY0 + 3); c.lineTo(x, BYC); c.lineTo(x - 10, BY1 - 3);
      }
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1; c.beginPath();
      c.moveTo(BX0, BY0 + 2); c.lineTo(BX1, BY0 + 2); c.moveTo(BX0, BY1 - 2); c.lineTo(BX1, BY1 - 2); c.stroke();
      c.restore();

      // --- Walzen ---
      const ang = trav / 14;
      roller(c, BX0, ang, run); roller(c, BX1, ang, run);

      // --- Antriebsmotor K1/K2 am Bandende ---
      const mFwd = !!out['Q0.0'], mRev = !!out['Q0.4'];
      c.fillStyle = '#10141a'; rr(c, 718, 334, 78, 46, 8); c.fill();
      c.strokeStyle = (mFwd || mRev) ? (mFwd && mRev ? '#ff5c5c' : '#3b9eff') : '#3a424d'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#1d232a'; c.beginPath(); c.arc(745, 357, 17, 0, 6.2832); c.fill();
      c.strokeStyle = '#5a6572'; c.lineWidth = 2; c.beginPath(); c.arc(745, 357, 17, 0, 6.2832); c.stroke();
      c.strokeStyle = '#9aa7b6'; c.lineWidth = 2.4; c.beginPath();
      const ma = -ang * 1.0;
      c.moveTo(745 + Math.cos(ma) * 13, 357 + Math.sin(ma) * 13); c.lineTo(745 - Math.cos(ma) * 13, 357 - Math.sin(ma) * 13);
      c.moveTo(745 + Math.cos(ma + 1.5708) * 13, 357 + Math.sin(ma + 1.5708) * 13); c.lineTo(745 - Math.cos(ma + 1.5708) * 13, 357 - Math.sin(ma + 1.5708) * 13);
      c.stroke();
      txt(c, 'M', 745, 357, '#cfd8e2', 11, 'center', '700');
      c.strokeStyle = '#5a6572'; c.lineWidth = 3; c.beginPath(); c.moveTo(745, 334); c.lineTo(745, 320); c.stroke();
      led(c, 782, 345, 4, mFwd, '#4cd964'); led(c, 782, 367, 4, mRev, '#ffb340');
      txt(c, 'M1', 765, 345, '#6b7683', 9, 'center');
      txt(c, 'Motor  ▶ / ◀', 757, 392, '#6b7683', 11, 'center');

      // --- Teile auf dem Band ---
      let blk1 = null, blk5 = null;
      for (let i = 0; i < NP; i++) {
        const p = pcs[i]; if (!p.on) continue;
        drawPiece(c, p.x, p.y, p.metal, p.drop);
        if (Math.abs(p.x - X_BEAM) < HALF && (blk1 == null || p.y - HALF < blk1)) blk1 = p.y - HALF;
        if (Math.abs(p.x - X_END) < HALF && (blk5 == null || p.y - HALF < blk5)) blk5 = p.y - HALF;
      }

      // --- Lichtschranke B1 am Ausschieber (Sender oben, Empfaenger unten) ---
      beam(c, X_BEAM, 232, 308, blk1, '#ff5c5c', t);
      c.fillStyle = '#10141a'; rr(c, X_BEAM - 5, 205, 10, 20, 2); c.fill();
      c.strokeStyle = '#4a5460'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = '#ff5c5c'; c.fillRect(X_BEAM - 3, 221, 6, 3);
      c.fillStyle = '#10141a'; rr(c, X_BEAM - 5, 315, 10, 20, 2); c.fill();
      c.strokeStyle = '#4a5460'; c.stroke();
      led(c, X_BEAM + 14, 328, 3.6, ins['I0.2'], '#4cd964');
      txt(c, 'B1', X_BEAM + 22, 213, '#8a96a4', 10, 'left', '600');

      // --- Bandende-Sensor B5 (Reflexlichtschranke) ---
      beam(c, X_END, 232, 308, blk5, '#ffb340', t);
      c.fillStyle = '#10141a'; rr(c, X_END - 5, 208, 10, 17, 2); c.fill();
      c.fillStyle = '#e8edf2'; c.fillRect(X_END - 3, 220, 6, 3); c.fillStyle = '#ff5c5c'; c.fillRect(X_END - 3, 222, 6, 1.5);
      c.fillStyle = '#10141a'; rr(c, X_END - 5, 315, 10, 18, 2); c.fill();
      led(c, X_END - 16, 326, 3.6, ins['I0.6'], '#4cd964');
      txt(c, 'B5', X_END - 20, 212, '#8a96a4', 10, 'left', '600');

      // --- Induktiver Sensor B2 (ueber dem Band) ---
      c.strokeStyle = '#4a5460'; c.lineWidth = 6; c.beginPath(); c.moveTo(X_METAL, 220); c.lineTo(X_METAL, 252); c.stroke();
      if (ins['I0.3']) {
        c.globalAlpha = 0.22; c.fillStyle = '#3b9eff'; c.beginPath(); c.arc(X_METAL, 270, 34, 0, 6.2832); c.fill();
        c.globalAlpha = 0.28; c.beginPath(); c.arc(X_METAL, 270, 24, 0, 6.2832); c.fill(); c.globalAlpha = 1;
      } else {
        c.strokeStyle = 'rgba(59,158,255,0.18)'; c.lineWidth = 1; c.setLineDash(DASH);
        c.beginPath(); c.arc(X_METAL, 270, 26, 0, 6.2832); c.stroke(); c.setLineDash(NODASH);
      }
      const sg = c.createLinearGradient(X_METAL - 14, 256, X_METAL + 14, 284);
      sg.addColorStop(0, '#7e8895'); sg.addColorStop(1, '#2d343c');
      c.fillStyle = sg; c.beginPath(); c.arc(X_METAL, 270, 15, 0, 6.2832); c.fill();
      c.strokeStyle = '#14181c'; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(X_METAL, 270, 10, 0, 6.2832); c.stroke();
      led(c, X_METAL, 270, 4, ins['I0.3'], ins['I0.3'] ? '#4cd964' : '#4cd964');
      txt(c, 'B2 Metall', X_METAL, 205, '#8a96a4', 10, 'center', '600');

      // --- Ausschieber-Zylinder (oben, Kolbenstange) ---
      const front = HEAD_REST + STROKE * cylMs / CYL_MS;
      c.fillStyle = '#1b2127'; rr(c, X_PUSH - 24, 108, 48, 8, 3); c.fill();   // Befestigung
      const cg = c.createLinearGradient(X_PUSH - 15, 0, X_PUSH + 15, 0);
      cg.addColorStop(0, '#3a424b'); cg.addColorStop(0.35, '#8a95a2'); cg.addColorStop(0.7, '#555e69'); cg.addColorStop(1, '#2c333b');
      c.fillStyle = cg; rr(c, X_PUSH - 15, 112, 30, 66, 4); c.fill();
      c.strokeStyle = '#14181c'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#20262d'; c.fillRect(X_PUSH - 15, 112, 30, 7); c.fillRect(X_PUSH - 15, 170, 30, 8);
      c.fillStyle = '#2a3038'; c.fillRect(X_PUSH - 20, 124, 6, 7); c.fillRect(X_PUSH + 14, 164, 6, 7);   // Druckluftanschluesse
      // Kolbenstange und Kopf
      const rodg = c.createLinearGradient(X_PUSH - 4, 0, X_PUSH + 4, 0);
      rodg.addColorStop(0, '#6a7480'); rodg.addColorStop(0.4, '#e3e9f0'); rodg.addColorStop(1, '#6a7480');
      c.fillStyle = rodg; c.fillRect(X_PUSH - 4, 178, 8, front - HEADT - 176);
      const hg = c.createLinearGradient(0, front - HEADT, 0, front);
      hg.addColorStop(0, '#c8d1db'); hg.addColorStop(1, '#6b7683');
      c.fillStyle = 'rgba(0,0,0,0.3)'; rr(c, X_PUSH - HEADW / 2 + 4, front - HEADT + 5, HEADW, HEADT, 3); c.fill();
      c.fillStyle = hg; rr(c, X_PUSH - HEADW / 2, front - HEADT, HEADW, HEADT, 3); c.fill();
      c.strokeStyle = '#2c333b'; c.lineWidth = 1.5; c.stroke();
      // Endlagenschalter B3/B4 am Zylinder
      led(c, X_PUSH + 24, 124, 4, ins['I0.4'], '#4cd964');
      led(c, X_PUSH + 24, 166, 4, ins['I0.5'], '#4cd964');
      txt(c, 'B3', X_PUSH + 34, 124, '#8a96a4', 10, 'left', '600');
      txt(c, 'B4', X_PUSH + 34, 166, '#8a96a4', 10, 'left', '600');
      // Magnetventil Y1
      c.fillStyle = '#10141a'; rr(c, X_PUSH - 62, 130, 30, 28, 4); c.fill();
      c.strokeStyle = out['Q0.1'] ? '#ffb340' : '#3a424d'; c.lineWidth = 1.5; c.stroke();
      led(c, X_PUSH - 47, 144, 4.5, !!out['Q0.1'], '#ffb340');
      txt(c, 'Y1', X_PUSH - 47, 168, '#8a96a4', 10, 'center', '600');
      c.strokeStyle = '#3a424d'; c.lineWidth = 2; c.beginPath(); c.moveTo(X_PUSH - 32, 138); c.lineTo(X_PUSH - 20, 128); c.moveTo(X_PUSH - 32, 152); c.lineTo(X_PUSH - 20, 166); c.stroke();

      // --- fallende / rutschende Teile ---
      for (let i = 0; i < NFX; i++) {
        const f = fx[i]; if (!f.on) continue;
        const u = f.age / f.dur;
        if (f.kind === 'chute') {
          const y = 320 + u * u * 110, a = u < 0.8 ? 1 : (1 - u) * 5;
          drawPiece(c, X_PUSH + (f.x - X_PUSH) * (1 - u), y, f.metal, 0, a);
        } else if (f.kind === 'end') {
          const y = BYC + u * u * 36, x = BX1 + 14 + u * 60;
          c.save(); c.translate(x, y); c.rotate(u * 0.5); c.translate(-x, -y);
          drawPiece(c, x, y, f.metal, 0, u < 0.75 ? 1 : (1 - u) * 4); c.restore();
        } else {
          const dirx = f.x < BX0 + 100 ? -1 : 0;
          const x = f.x + dirx * u * 40, y = f.y + (dirx ? u * 60 : u * 90);
          c.save(); c.translate(x, y); c.rotate(u * 1.4); c.translate(-x, -y);
          drawPiece(c, x, y, f.metal, 0, 1 - u); c.restore();
        }
      }

      // --- Zaehleranzeige ---
      c.fillStyle = '#222830'; rr(c, 596, 22, 384, 112, 10); c.fill();
      c.strokeStyle = '#323a44'; c.lineWidth = 1.5; c.stroke();
      txt(c, 'Zähler', 612, 40, '#8a96a4', 12, 'left', '600');
      const cnt = [['am Bandende', delivered, '#4cd964'], ['ausgeschoben', sorted, '#3b9eff'], ['verloren', lost, lost > 0 ? '#ff5c5c' : '#6b7683']];
      for (let i = 0; i < 3; i++) {
        const bx = 610 + i * 122;
        c.fillStyle = '#0b0e11'; rr(c, bx, 52, 108, 54, 6); c.fill();
        c.textAlign = 'right'; c.textBaseline = 'middle'; c.font = '700 34px "Courier New", ui-monospace, monospace';
        c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillText('888', bx + 98, 80);
        c.fillStyle = cnt[i][2]; c.fillText(String(Math.min(cnt[i][1], 999)), bx + 98, 80);
        txt(c, cnt[i][0], bx + 54, 120, '#8a96a4', 11, 'center');
      }

      // --- Bedienfeld unten rechts ---
      c.fillStyle = '#222830'; rr(c, 562, 400, 418, 148, 12); c.fill();
      c.strokeStyle = '#323a44'; c.lineWidth = 1.5; c.stroke();
      txt(c, 'Bedienfeld', 580, 416, '#8a96a4', 12, 'left', '600');
      // S1 Start
      const s1 = ins['I0.0'];
      c.fillStyle = '#10141a'; c.beginPath(); c.arc(610, 454, 33, 0, 6.2832); c.fill();
      c.fillStyle = '#2c333b'; c.beginPath(); c.arc(610, 454, 30, 0, 6.2832); c.fill();
      c.fillStyle = s1 ? '#2e8f45' : '#4cd964'; c.beginPath(); c.arc(610, 454 + (s1 ? 1 : -1), s1 ? 22 : 24, 0, 6.2832); c.fill();
      if (!s1) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.arc(603, 445, 8, 0, 6.2832); c.fill(); }
      c.strokeStyle = '#0d3a1a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(610, 444); c.lineTo(610, 458); c.stroke();
      txt(c, 'S1 Start', 610, 500, '#cfd8e2', 12, 'center', '600');
      txt(c, 'Schließer', 610, 516, '#6b7683', 10, 'center');
      // S2 Stopp (Oeffner)
      const s2 = !ins['I0.1'];
      c.fillStyle = '#10141a'; c.beginPath(); c.arc(704, 454, 33, 0, 6.2832); c.fill();
      c.fillStyle = '#2c333b'; c.beginPath(); c.arc(704, 454, 30, 0, 6.2832); c.fill();
      c.fillStyle = s2 ? '#a83a3a' : '#ff5c5c'; c.beginPath(); c.arc(704, 454 + (s2 ? 1 : -1), s2 ? 22 : 24, 0, 6.2832); c.fill();
      if (!s2) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.arc(697, 445, 8, 0, 6.2832); c.fill(); }
      c.strokeStyle = '#4a1313'; c.lineWidth = 4; c.beginPath(); c.arc(704, 454, 8, 0, 6.2832); c.stroke();
      txt(c, 'S2 Stopp', 704, 500, '#cfd8e2', 12, 'center', '600');
      txt(c, 'Öffner', 704, 516, '#6b7683', 10, 'center');
      // S3 Not-Halt (Pilztaster auf gelber Platte)
      const s3 = !ins['I0.7'];
      c.fillStyle = '#ffb340'; rr(c, 770, 418, 72, 72, 10); c.fill();
      c.fillStyle = '#10141a'; c.beginPath(); c.arc(806, 454, 31, 0, 6.2832); c.fill();
      c.fillStyle = '#6b1a1a'; c.beginPath(); c.arc(806, 456, 28, 0, 6.2832); c.fill();
      c.fillStyle = s3 ? '#b82a2a' : '#ff3b3b'; c.beginPath(); c.arc(806, 454 + (s3 ? 3 : -2), s3 ? 23 : 27, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,' + (s3 ? 0.1 : 0.3) + ')'; c.beginPath(); c.arc(798, 445 + (s3 ? 3 : -2), 9, 0, 6.2832); c.fill();
      txt(c, 'S3 Not-Halt', 806, 500, '#cfd8e2', 12, 'center', '600');
      txt(c, s3 ? 'gedrückt (rastet)' : 'Öffner', 806, 516, s3 ? '#ff5c5c' : '#6b7683', 10, 'center');
      // Meldelampen H1/H2
      const lamp = function (x, y, on, col, label) {
        c.fillStyle = '#10141a'; c.beginPath(); c.arc(x, y, 21, 0, 6.2832); c.fill();
        if (on) {
          c.globalAlpha = 0.16; c.fillStyle = col; c.beginPath(); c.arc(x, y, 38, 0, 6.2832); c.fill();
          c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, 29, 0, 6.2832); c.fill(); c.globalAlpha = 1;
          c.fillStyle = col; c.beginPath(); c.arc(x, y, 17, 0, 6.2832); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(x - 5, y - 5, 6, 0, 6.2832); c.fill();
        } else {
          c.fillStyle = '#2b3139'; c.beginPath(); c.arc(x, y, 17, 0, 6.2832); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(x - 5, y - 5, 6, 0, 6.2832); c.fill();
        }
        txt(c, label, x, y + 36, '#cfd8e2', 12, 'center', '600');
      };
      lamp(900, 442, !!out['Q0.2'], '#4cd964', 'H1 Betrieb');
      lamp(900, 502, !!out['Q0.3'] && (Math.floor(t / 300) % 2 === 0 || true), '#ff5c5c', 'H2 Störung');
      c.lineCap = 'butt';

      // --- Signalliste unten links ---
      c.fillStyle = '#222830'; rr(c, 24, 400, 380, 148, 12); c.fill();
      c.strokeStyle = '#323a44'; c.lineWidth = 1.5; c.stroke();
      txt(c, 'Signale (grün = 1)', 40, 416, '#8a96a4', 12, 'left', '600');
      const il = ['S1 Start', 'S2 Stopp', 'B1 Lichtschr.', 'B2 Metall', 'B3 Zyl. hinten', 'B4 Zyl. vorn', 'B5 Bandende', 'S3 Not-Halt'];
      for (let i = 0; i < 8; i++) {
        const col = Math.floor(i / 4), row = i % 4;
        const x = 42 + col * 128, y = 442 + row * 26;
        led(c, x, y, 5, ins['I0.' + i], '#4cd964');
        txt(c, 'I0.' + i, x + 14, y - 5, '#6b7683', 9, 'left');
        txt(c, il[i], x + 14, y + 6, '#cfd8e2', 11, 'left');
      }
      const ol = ['K1 Band vor', 'Y1 Ausschieber', 'H1 Betrieb', 'H2 Störung', 'K2 Band zurück'];
      for (let i = 0; i < 5; i++) {
        const x = 298, y = 436 + i * 21;
        led(c, x, y, 5, !!out['Q0.' + i], '#ffb340');
        txt(c, 'Q0.' + i + '  ' + ol[i], x + 12, y, '#cfd8e2', 10, 'left');
      }

      // --- Schadensbild: Beule und Qualm am Ausschieber, Qualm am Motor ---
      if (crash) {
        c.strokeStyle = '#0d1114'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(X_PUSH - 12, HEAD_REST + 4); c.lineTo(X_PUSH - 3, HEAD_REST + 12); c.lineTo(X_PUSH + 6, HEAD_REST + 6); c.lineTo(X_PUSH + 13, HEAD_REST + 14); c.stroke(); c.lineCap = 'butt';
        smokeAt(c, X_PUSH, HEAD_REST - 8, t);
      }
      if (dualFault) smokeAt(c, BX0 + 20, BYC - 50, t);

      // --- Crash-/Stoerungshinweis ---
      if (crash || dualFault) {
        const on = Math.floor(t / 350) % 2 === 0;
        c.globalAlpha = on ? 1 : 0.55;
        c.fillStyle = '#6b1a1a'; rr(c, 250, 54, 300, 30, 15); c.fill();
        c.strokeStyle = '#ff5c5c'; c.lineWidth = 2; c.stroke();
        txt(c, crash ? '⚠ ANLAGENSCHADEN: Crash am Ausschieber' : '⚠ Motor: vorwärts und rückwärts!', 400, 70, '#ffd0d0', 13, 'center', '700');
        c.globalAlpha = 1;
      }
    }

    reset();
    return plant;
  }

  P.register({
    id: 'foerderband', name: 'Förderband mit Sortierung', icon: '\u{1F4E6}', info: INFO, io: IO,
    positions: { metalSensor: X_METAL, pusher: X_PUSH, lightBarrier: X_BEAM, beltEnd: X_END },
    create: create
  });
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
