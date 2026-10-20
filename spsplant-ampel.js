(function (root) {
  'use strict';
  const P = root.SPS_PLANTS = root.SPS_PLANTS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, io: def.io }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===================================================================
  //  Anlage 2: Ampel / Kreuzung mit Fussgaengerueberweg
  //  Weltkoordinaten 1000 x 560 (Draufsicht). Zwei Fahrspuren:
  //  Spur 0 faehrt nach rechts (unten), Spur 1 nach links (oben).
  //  Fahrzeugposition s = Frontkante in Fahrtrichtung (0..1000), Haltelinie bei s = 440.
  // ===================================================================
  const W = 1000, H = 560;
  const ROAD0 = 215, ROAD1 = 325;
  const LANE_Y = [298, 242];
  const STOP_S = 440, CROSS0 = 455, CROSS1 = 545;
  const CAR_L = 56, CAR_W = 28;
  const LOOP0 = 392, LOOP1 = 432;
  const WAIT_Y = [207, 333];            // Wartelinie oben / unten
  const AMAX = 60, BCOMF = 90, S0 = 6, TH = 1.0, BMAX = 260;

  const IO = {
    inputs: [
      { key: 'I0.0', sym: 'S1_Fussgaengertaster', text: 'S1 Fußgängertaster (Schließer)', kind: 'button', rest: false },
      { key: 'I0.1', sym: 'S2_Betrieb', text: 'S2 Schalter Betrieb ein/aus (1 = ein)', kind: 'switch', rest: false },
      { key: 'I0.2', sym: 'B1_Schleife', text: 'B1 Induktionsschleife (1 = Fahrzeug wartet an der Haltelinie)', kind: 'sensor' }
    ],
    outputs: [
      { key: 'Q0.0', sym: 'H1_Strasse_rot', text: 'H1 Ampel Straße rot' },
      { key: 'Q0.1', sym: 'H2_Strasse_gelb', text: 'H2 Ampel Straße gelb' },
      { key: 'Q0.2', sym: 'H3_Strasse_gruen', text: 'H3 Ampel Straße grün' },
      { key: 'Q0.3', sym: 'H4_Fuss_rot', text: 'H4 Fußgängerampel rot' },
      { key: 'Q0.4', sym: 'H5_Fuss_gruen', text: 'H5 Fußgängerampel grün' }
    ]
  };

  const INFO = 'Auf der Straße fahren Fahrzeuge in beide Richtungen und halten bei Rot an der Haltelinie. Am Überweg warten ' +
    'Fußgänger und drücken den Taster S1 (Anzeige „Signal kommt“). Die Anlage hat keine eigene Steuerung: ' +
    'Die Ampelphasen bestimmt allein dein Programm. Die Induktionsschleife B1 meldet, dass ein Fahrzeug vor der Haltelinie steht. ' +
    'Fußgänger und Fahrzeuge dürfen nie gleichzeitig Grün haben, nach dem Fußgänger-Grün brauchen Fußgänger noch etwa 4 s Räumzeit ' +
    '(Straße bleibt dann rot). Rot, Gelb und Grün der Straße gehören zu einer Ampel (Rot-Gelb vor Grün ist erlaubt). ' +
    'Gelb allein nach Grün: Fahrzeuge halten, wenn sie noch bequem bremsen können.';

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
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
  const DASH = [10, 12], DASH2 = [5, 4], NODASH = [];
  const CAR_COLS = ['#3b9eff', '#ffb340', '#e8edf2', '#8f9bb0', '#4cd964', '#c05cff', '#ff7a5c', '#2fd0c8'];
  const PED_COLS = ['#ff5c5c', '#3b9eff', '#ffb340', '#4cd964', '#c05cff', '#e8edf2', '#2fd0c8'];
  const ST_STOP = 0, ST_GO = 1, ST_YEL = 2, ST_DARK = 3;
  const SCEN = {
    normal: { carMin: 2200, carMax: 6500, pedMin: 6000, pedMax: 14000 },
    dicht: { carMin: 1100, carMax: 2600, pedMin: 6000, pedMax: 14000 },
    viele_fussgaenger: { carMin: 2200, carMax: 6500, pedMin: 1800, pedMax: 4500 },
    nur_fussgaenger: { carMin: 0, carMax: 0, pedMin: 3000, pedMax: 6000 },
    nur_autos: { carMin: 2200, carMax: 6500, pedMin: 0, pedMax: 0 },
    leer: { carMin: 0, carMax: 0, pedMin: 0, pedMax: 0 }
  };
  const SLOTS = 6;

  function create(opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed;
    let rnd = rng(seed);
    const cfg = { carMin: 2200, carMax: 6500, pedMin: 6000, pedMax: 14000 };
    function applyScen(name) {
      const sc = SCEN[name]; if (!sc) return false;
      cfg.carMin = sc.carMin; cfg.carMax = sc.carMax; cfg.pedMin = sc.pedMin; cfg.pedMax = sc.pedMax; return true;
    }
    if (opts.scenario) applyScen(opts.scenario);
    if (opts.cars === false) { cfg.carMin = 0; cfg.carMax = 0; }
    if (opts.peds === false) { cfg.pedMin = 0; cfg.pedMax = 0; }

    const user = { 'I0.0': false, 'I0.1': false };
    const out = { 'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false, 'Q0.4': false };
    const events = [];
    const lanes = [[], []];
    let peds = [];
    const slotUsed = [new Array(SLOTS), new Array(SLOTS)];
    let time, acc, carTimer, pedTimer, pressTimer, req, lastMode, yfg, pedGreenPrev, vioFlags, dayNight;
    let carsPassed, carsCrashed, pedsCrashed, pedsCrossed, redRunners, violations, carWaitSum, carWaitN, maxCarWait, pedWaitSum, pedWaitN, maxPedWait;
    let carsSpawned, pedsSpawned;
    // Phasenprotokoll (nur Aufzeichnung, ohne Einfluss auf den Ablauf): ein Eintrag je Aenderung der Ampelausgaenge Q0.0..Q0.4
    let cyc = [], cycKey = '';

    function ev(text, kind, fxk, x, y) {
      const e = { t: time, text: text, kind: kind || 'info' };
      if (fxk) { e.fx = fxk; e.x = x; e.y = y; }
      events.push(e);
      if (events.length > 300) events.shift();
    }
    function reset() {
      rnd = rng(seed);
      time = 0; acc = 0; pressTimer = 0; req = false; lastMode = ST_DARK; yfg = false; pedGreenPrev = false;
      vioFlags = [false, false, false, false];
      carsPassed = carsCrashed = pedsCrashed = pedsCrossed = redRunners = violations = 0;
      carWaitSum = carWaitN = maxCarWait = pedWaitSum = pedWaitN = maxPedWait = 0;
      carsSpawned = pedsSpawned = 0;
      cyc = []; cycKey = '';
      lanes[0].length = 0; lanes[1].length = 0; peds.length = 0;
      for (let k = 0; k < 2; k++) for (let i = 0; i < SLOTS; i++) slotUsed[k][i] = false;
      for (const k in out) out[k] = false;
      user['I0.0'] = false; user['I0.1'] = false;
      events.length = 0;
      carTimer = [600 + Math.floor(rnd() * 1500), 1800 + Math.floor(rnd() * 2500)];
      pedTimer = 2500 + Math.floor(rnd() * 3000);
    }

    // ----------------- Fahrzeuge -----------------
    function newCar(lane, s, v) {
      const c = { s: s, v: v, v0: 78 + rnd() * 32, len: CAR_L, lane: lane, col: CAR_COLS[Math.floor(rnd() * CAR_COLS.length)],
        react: 500 + Math.floor(rnd() * 600), hold: 0, prevBlk: false, waitMs: 0, passed: s > STOP_S, done: s > CROSS1,
        crash: false, crashT: 0, dead: false, braking: false, kind: rnd() < 0.25 ? 1 : 0 };
      return c;
    }
    function addCar(lane, s, v) {
      const L = lanes[lane];
      // Platz pruefen
      for (let i = 0; i < L.length; i++) if (Math.abs(L[i].s - s) < CAR_L + 8) return false;
      const car = newCar(lane, s, v == null ? 0 : v);
      let idx = L.length;
      for (let i = 0; i < L.length; i++) if (L[i].s < s) { idx = i; break; }
      L.splice(idx, 0, car); carsSpawned++;
      return true;
    }
    function trySpawnCar(lane) {
      const L = lanes[lane];
      if (L.length && L[L.length - 1].s - CAR_L < -70 + 46) return false;
      const car = newCar(lane, -70, 0);
      car.v = car.v0 * 0.8;
      L.push(car); carsSpawned++;
      return true;
    }

    function mode() {
      if (out['Q0.0']) return ST_STOP;
      if (out['Q0.2']) return ST_GO;
      if (out['Q0.1']) return ST_YEL;
      return ST_DARK;
    }
    function idm(v, v0, gap, dv) {
      const sStar = S0 + Math.max(0, v * TH + v * dv / (2 * Math.sqrt(AMAX * BCOMF)));
      const g = gap < 0.1 ? 0.1 : gap;
      const r = v / v0;
      return AMAX * (1 - r * r * r * r - (sStar / g) * (sStar / g));
    }
    function crashCar(car) { if (!car.crash) { car.crash = true; car.crashT = 4000; car.v = 0; } }

    function updateCars(md) {
      const cap = (md === ST_DARK || (md === ST_YEL && !yfg)) ? 55 : 1e9;
      for (let ln = 0; ln < 2; ln++) {
        const L = lanes[ln];
        for (let i = 0; i < L.length; i++) {
          const car = L[i];
          if (car.crash) { car.v = 0; car.braking = true; car.crashT -= 10; if (car.crashT <= 0) car.dead = true; continue; }
          let a = 1e9, blk = false;
          const v0 = Math.min(car.v0, cap);
          if (i > 0) {
            const ld = L[i - 1];
            const gap = (ld.s - ld.len) - car.s;
            if (gap < -1 && car.v > 0) {
              // Auffahrunfall
              const n = ld.crash ? 1 : 2;
              carsCrashed += n; crashCar(car); crashCar(ld);
              ev('Auffahrunfall: Fahrzeug konnte nicht mehr rechtzeitig bremsen', 'error', 'crash', ln === 0 ? car.s : 1000 - car.s, LANE_Y[ln]);
              continue;
            }
            a = idm(car.v, v0, gap, car.v - ld.v);
          }
          if (!car.passed) {
            const d = STOP_S - car.s;
            let stopHere = false;
            if (md === ST_STOP) stopHere = true;
            else if (md === ST_YEL && yfg) stopHere = (car.v * car.v / (2 * Math.max(d, 0.1))) <= 110;
            if (stopHere && d > -1) {
              const as = idm(car.v, v0, d, car.v);
              if (as < a) a = as;
              blk = true;
            }
          }
          if (a === 1e9) a = idm(car.v, v0, 1e6, 0);
          // Anfahrverzoegerung nach Gruen
          if (blk) car.prevBlk = true;
          else if (car.prevBlk && car.v < 0.5) { car.prevBlk = false; car.hold = car.react; }
          else if (car.v >= 0.5) car.prevBlk = false;
          if (car.hold > 0) { car.hold -= 10; a = 0; car.v = 0; }
          if (a < -BMAX) a = -BMAX;
          car.braking = a < -12 || (car.v < 1 && blk);
          car.v += a * 0.01; if (car.v < 0) car.v = 0;
          car.s += car.v * 0.01;
          if (car.v < 3 && !car.passed && car.s > 0) car.waitMs += 10;
          if (!car.passed && car.s > STOP_S) {
            car.passed = true;
            carWaitSum += car.waitMs; carWaitN++; if (car.waitMs > maxCarWait) maxCarWait = car.waitMs;
            if (md === ST_STOP) { redRunners++; ev('Fahrzeug fährt über die Haltelinie, obwohl die Straße Rot hat (Gelbphase fehlt oder zu kurz?)', 'warn', 'redrun', ln === 0 ? STOP_S : 1000 - STOP_S, LANE_Y[ln]); }
          }
          if (!car.done && car.s > CROSS1) { car.done = true; carsPassed++; }
        }
        for (let i = L.length - 1; i >= 0; i--) {
          const car = L[i];
          if (car.dead || car.s - car.len > 1070) L.splice(i, 1);
        }
      }
    }

    // ----------------- Fussgaenger -----------------
    function newPed(side, slot) {
      const x = side === 0 ? 466 + slot * 13 : 472.5 + slot * 13;
      const p = { x: x, y: side === 0 ? WAIT_Y[0] : WAIT_Y[1], side: side, slot: slot, st: 1, spd: 36 + rnd() * 10,
        col: PED_COLS[Math.floor(rnd() * PED_COLS.length)], ph: rnd() * 6, waitMs: 0, tx: x, ty: 0, dir: side === 0 ? 1 : -1, warned: false, hitT: 0 };
      return p;
    }
    function freeSlot(side) {
      const start = Math.floor(rnd() * SLOTS);
      for (let k = 0; k < SLOTS; k++) { const i = (start + k) % SLOTS; if (!slotUsed[side][i]) return i; }
      return -1;
    }
    function trySpawnPed() {
      const side = rnd() < 0.5 ? 0 : 1;
      const slot = freeSlot(side);
      if (slot < 0) return false;
      const p = newPed(side, slot);
      slotUsed[side][slot] = true;
      p.st = 0; p.tx = p.x; p.ty = WAIT_Y[side];
      p.x = rnd() < 0.5 ? 380 + rnd() * 40 : 580 + rnd() * 40;
      p.y = side === 0 ? 160 + rnd() * 25 : 350 + rnd() * 25;
      peds.push(p); pedsSpawned++;
      return true;
    }
    function addPed(side, state) {
      side = side ? 1 : 0;
      const slot = freeSlot(side);
      if (slot < 0) return false;
      const p = newPed(side, slot);
      if (state === 'cross') {
        p.st = 2; p.y = side === 0 ? 232 : 308;   // schon auf der Fahrbahn
      } else { slotUsed[side][slot] = true; }
      peds.push(p); pedsSpawned++;
      return true;
    }
    function press() { if (pressTimer < 400) pressTimer = 400; }

    function updatePeds(pg) {
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        p.ph += 0.01 * (p.st === 1 ? 0.5 : p.spd * 0.16);
        if (p.st === 0) {
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 1.2) {
            p.x = p.tx; p.y = p.ty; p.st = 1; p.waitMs = 0;
            if (!pg && !req) press();
          } else { p.x += dx / d * p.spd * 0.01; p.y += dy / d * p.spd * 0.01; }
        } else if (p.st === 1) {
          p.waitMs += 10;
          if (p.waitMs > maxPedWait) maxPedWait = p.waitMs;
          if (p.waitMs === 60000) ev('Fußgänger wartet seit über 60 s auf Grün', 'warn', 'pedwait', p.x, p.y);
          if (!pg && p.waitMs % 20000 === 0 && !req) press();
          if (pg) {
            p.st = 2; slotUsed[p.side][p.slot] = false;
            pedWaitSum += p.waitMs; pedWaitN++;
          }
        } else if (p.st === 2) {
          p.y += p.dir * p.spd * 0.01;
          if ((p.dir > 0 && p.y >= WAIT_Y[1]) || (p.dir < 0 && p.y <= WAIT_Y[0])) { p.st = 3; pedsCrossed++; p.ty = p.dir > 0 ? 385 : 150; }
        } else if (p.st === 3) {
          p.y += p.dir * p.spd * 0.01;
          if ((p.dir > 0 && p.y > p.ty) || (p.dir < 0 && p.y < p.ty)) p.st = 5;
        } else if (p.st === 4) {
          p.hitT -= 10; if (p.hitT <= 0) p.st = 5;
        }
      }
      for (let i = peds.length - 1; i >= 0; i--) if (peds[i].st === 5) peds.splice(i, 1);
    }

    function collide() {
      for (let ln = 0; ln < 2; ln++) {
        const L = lanes[ln], ly = LANE_Y[ln];
        for (let i = 0; i < L.length; i++) {
          const car = L[i];
          if (car.v < 1.5 || car.crash) continue;
          if (car.s < CROSS0 - 6 || car.s - car.len > CROSS1 + 6) continue;
          for (let j = 0; j < peds.length; j++) {
            const p = peds[j];
            if (p.st < 2 || p.st > 3) continue;
            if (Math.abs(p.y - ly) > CAR_W / 2 + 3) continue;
            const ps = ln === 0 ? p.x : 1000 - p.x;
            if (ps > car.s - car.len - 4 && ps < car.s + 4) {
              p.st = 4; p.hitT = 3000; slotUsed[p.side][p.slot] = false;
              crashCar(car); carsCrashed++; pedsCrashed++;
              ev('Fahrzeug fährt einen Fußgänger an – Fußgänger und Fahrzeuge hatten gleichzeitig freie Fahrt!', 'error', 'pedhit', p.x, p.y);
            }
          }
        }
      }
    }

    function logCyc() {
      const ck = (out['Q0.0'] ? '1' : '0') + (out['Q0.1'] ? '1' : '0') + (out['Q0.2'] ? '1' : '0') + (out['Q0.3'] ? '1' : '0') + (out['Q0.4'] ? '1' : '0');
      if (ck === cycKey) return;
      if (cyc.length) cyc[cyc.length - 1].ms = time - cyc[cyc.length - 1].t;
      cycKey = ck;
      cyc.push({ t: time, street: streetSignal(mode()), ped: pedSignal(), q: ck, ms: 0 });
      if (cyc.length > 400) cyc.shift();
    }
    function streetSignal(md) { return md === ST_STOP ? (out['Q0.1'] ? 'rotgelb' : 'rot') : md === ST_GO ? 'gruen' : md === ST_YEL ? 'gelb' : 'dunkel'; }
    function pedSignal() { return out['Q0.4'] ? 'gruen' : (out['Q0.3'] ? 'rot' : 'dunkel'); }

    function tick() {
      time += 10;
      logCyc();
      const md = mode();
      if (md === ST_YEL && lastMode !== ST_YEL) yfg = lastMode === ST_GO;
      lastMode = md;
      const pg = !!out['Q0.4'];

      // Verstoss-Erkennung (steigende Flanke je Bedingung)
      const v0c = !!out['Q0.2'] || (!!out['Q0.1'] && !out['Q0.0']);
      const cond = [
        v0c && pg,
        !!out['Q0.0'] && !!out['Q0.2'],
        !!out['Q0.3'] && pg,
        !!out['Q0.1'] && !!out['Q0.2']
      ];
      const msg = ['Fußgänger und Fahrzeuge haben gleichzeitig Grün', 'Straße zeigt gleichzeitig Rot und Grün', 'Fußgängerampel zeigt gleichzeitig Rot und Grün', 'Straße zeigt gleichzeitig Gelb und Grün'];
      for (let k = 0; k < 4; k++) {
        if (cond[k] && !vioFlags[k]) { violations++; ev(msg[k], 'error', 'interlock', 500, 130); }
        vioFlags[k] = cond[k];
      }

      // Taster / Anforderung
      if (pressTimer > 0) pressTimer -= 10;
      const btn = user['I0.0'] || pressTimer > 0;
      if (pg && !pedGreenPrev) req = false;
      if (btn && !pg) req = true;
      pedGreenPrev = pg;

      // Zufuhr
      for (let ln = 0; ln < 2; ln++) {
        if (cfg.carMax > 0) {
          carTimer[ln] -= 10;
          if (carTimer[ln] <= 0 && trySpawnCar(ln)) carTimer[ln] = cfg.carMin + Math.floor(rnd() * (cfg.carMax - cfg.carMin + 1));
        }
      }
      if (cfg.pedMax > 0) {
        pedTimer -= 10;
        if (pedTimer <= 0) pedTimer = trySpawnPed() ? cfg.pedMin + Math.floor(rnd() * (cfg.pedMax - cfg.pedMin + 1)) : 1000;
      }
      updateCars(md);
      updatePeds(pg);
      collide();
    }

    function loopBusy() {
      for (let ln = 0; ln < 2; ln++) {
        const L = lanes[ln];
        for (let i = 0; i < L.length; i++) {
          const c = L[i];
          if (c.s > LOOP0 && c.s - c.len < LOOP1) return true;
        }
      }
      return false;
    }
    function loopBusyLane(ln) {
      const L = lanes[ln];
      for (let i = 0; i < L.length; i++) if (L[i].s > LOOP0 && L[i].s - L[i].len < LOOP1) return true;
      return false;
    }

    const CTRL = [
      { key: 'I0.0', kind: 'button', x: 290, y: 482, r: 26 },
      { key: 'I0.0', kind: 'button', x: 452, y: 196, r: 11 },
      { key: 'I0.0', kind: 'button', x: 548, y: 344, r: 11 },
      { key: 'I0.1', kind: 'switch', x: 470, y: 482, r: 28 }
    ];

    const plant = {
      id: 'ampel', name: 'Ampel / Kreuzung', io: IO, events: events,
      setInput(key, v) { if (key === 'I0.0' || key === 'I0.1') user[key] = !!v; },
      readInputs() {
        return { 'I0.0': user['I0.0'] || pressTimer > 0, 'I0.1': user['I0.1'], 'I0.2': loopBusy() };
      },
      writeOutputs(o) {
        if (!o) return;
        for (const k in out) if (k in o) out[k] = !!o[k];
      },
      step(dtMs) { acc += dtMs; while (acc >= 10) { acc -= 10; tick(); } },
      reset: reset,
      worldSize() { return { w: W, h: H }; },
      state() {
        let waiting = 0, curMax = maxCarWait;
        for (let ln = 0; ln < 2; ln++) {
          const L = lanes[ln];
          for (let i = 0; i < L.length; i++) {
            const c = L[i];
            if (c.v < 3 && !c.passed && c.s > 0) { waiting++; if (c.waitMs > curMax) curMax = c.waitMs; }
          }
        }
        let pw = 0, cars = lanes[0].length + lanes[1].length;
        for (let i = 0; i < peds.length; i++) if (peds[i].st === 1) pw++;
        const md = mode();
        return {
          time: time, carsPassed: carsPassed, pedsCrossed: pedsCrossed, carsCrashed: carsCrashed, pedsCrashed: pedsCrashed,
          crash: carsCrashed + pedsCrashed > 0, violations: violations, redRunners: redRunners,
          carsWaiting: waiting, pedsWaiting: pw, cars: cars, peds: peds.length, pedRequest: req, loop: loopBusy(),
          maxCarWaitMs: curMax, maxPedWaitMs: maxPedWait,
          avgCarWaitMs: carWaitN ? Math.round(carWaitSum / carWaitN) : 0,
          avgPedWaitMs: pedWaitN ? Math.round(pedWaitSum / pedWaitN) : 0,
          carsSpawned: carsSpawned, pedsSpawned: pedsSpawned,
          streetSignal: streetSignal(md),
          pedSignal: pedSignal(),
          cyc: cyc.map((e, i) => ({ t: e.t, street: e.street, ped: e.ped, q: e.q, ms: i === cyc.length - 1 ? time - e.t : e.ms }))
        };
      },
      addCar: addCar, addPed: addPed,
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
    function manIcon(c, x, y, sz, walk, col) {
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = sz * 0.16; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y - sz * 0.62, sz * 0.2, 0, 6.2832); c.fill();
      c.beginPath();
      c.moveTo(x, y - sz * 0.38); c.lineTo(x, y + sz * 0.1);
      if (walk) {
        c.moveTo(x, y + sz * 0.1); c.lineTo(x - sz * 0.26, y + sz * 0.62); c.moveTo(x, y + sz * 0.1); c.lineTo(x + sz * 0.26, y + sz * 0.6);
        c.moveTo(x, y - sz * 0.3); c.lineTo(x - sz * 0.3, y + sz * 0.08); c.moveTo(x, y - sz * 0.3); c.lineTo(x + sz * 0.3, y - sz * 0.02);
      } else {
        c.moveTo(x, y + sz * 0.1); c.lineTo(x - sz * 0.14, y + sz * 0.62); c.moveTo(x, y + sz * 0.1); c.lineTo(x + sz * 0.14, y + sz * 0.62);
        c.moveTo(x - sz * 0.28, y - sz * 0.2); c.lineTo(x + sz * 0.28, y - sz * 0.2);
      }
      c.stroke(); c.lineCap = 'butt';
    }
    function lampDisc(c, x, y, r, on, col, dim) {
      c.fillStyle = '#05070a'; c.beginPath(); c.arc(x, y, r + 2.2, 0, 6.2832); c.fill();
      if (on) {
        c.globalAlpha = 0.14; c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 3.0, 0, 6.2832); c.fill();
        c.globalAlpha = 0.24; c.beginPath(); c.arc(x, y, r * 2.0, 0, 6.2832); c.fill();
        c.globalAlpha = 1; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.38, 0, 6.2832); c.fill();
      } else {
        c.fillStyle = dim; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.38, 0, 6.2832); c.fill();
      }
    }
    function street3(c, cx, cy, r) {   // cx, cy = Mitte des Kopfes
      const w = r * 2 + 12, h = r * 6 + 20;
      c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, cx - w / 2 + 3, cy - h / 2 + 4, w, h, 6); c.fill();
      c.fillStyle = '#0d1014'; rr(c, cx - w / 2, cy - h / 2, w, h, 6); c.fill();
      c.strokeStyle = '#3a424d'; c.lineWidth = 1.5; c.stroke();
      lampDisc(c, cx, cy - r * 2.1, r, !!out['Q0.0'], '#ff5c5c', '#3a1518');
      lampDisc(c, cx, cy, r, !!out['Q0.1'], '#ffb340', '#3a2c12');
      lampDisc(c, cx, cy + r * 2.1, r, !!out['Q0.2'], '#4cd964', '#123a1c');
    }
    function ped2(c, cx, cy, r) {
      const w = r * 2 + 12, h = r * 4.6 + 14;
      c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, cx - w / 2 + 3, cy - h / 2 + 4, w, h, 6); c.fill();
      c.fillStyle = '#0d1014'; rr(c, cx - w / 2, cy - h / 2, w, h, 6); c.fill();
      c.strokeStyle = '#3a424d'; c.lineWidth = 1.5; c.stroke();
      const yr = cy - r * 1.15, yg = cy + r * 1.15;
      const rOn = !!out['Q0.3'], gOn = !!out['Q0.4'];
      lampDisc(c, cx, yr, r, rOn, '#ff5c5c', '#3a1518');
      lampDisc(c, cx, yg, r, gOn, '#4cd964', '#123a1c');
      manIcon(c, cx, yr, r * 1.05, false, rOn ? '#2a0a0c' : 'rgba(255,92,92,0.22)');
      manIcon(c, cx, yg, r * 1.05, true, gOn ? '#05240e' : 'rgba(76,217,100,0.22)');
    }
    function drawCar(c, car, t) {
      const ln = car.lane, x = ln === 0 ? car.s : 1000 - car.s, y = LANE_Y[ln];
      if (x < -90 || x > 1090) return;
      c.save(); c.translate(x, y); if (ln === 1) c.scale(-1, 1);
      const L = car.len, hw = CAR_W / 2;
      // Scheinwerferkegel
      if (!car.crash) {
        c.fillStyle = 'rgba(255,244,200,0.07)'; c.beginPath(); c.moveTo(-2, -9); c.lineTo(86, -30); c.lineTo(86, 30); c.lineTo(-2, 9); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,244,200,0.09)'; c.beginPath(); c.moveTo(-2, -9); c.lineTo(48, -20); c.lineTo(48, 20); c.lineTo(-2, 9); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(0,0,0,0.38)'; rr(c, -L + 3, -hw + 4, L, CAR_W, 9); c.fill();
      const g = c.createLinearGradient(0, -hw, 0, hw);
      g.addColorStop(0, car.col); g.addColorStop(0.5, car.col); g.addColorStop(1, car.col);
      c.fillStyle = car.col; rr(c, -L, -hw, L, CAR_W, 9); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.22)'; rr(c, -L, 3, L, hw - 3, 9); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.20)'; rr(c, -L + 4, -hw + 2, L - 8, 5, 3); c.fill();
      // Kabine / Scheiben
      const cl = car.kind ? L * 0.62 : L * 0.5;
      c.fillStyle = '#18202b'; rr(c, -L * 0.66 + (car.kind ? -2 : 0), -hw + 4, cl, CAR_W - 8, 5); c.fill();
      c.fillStyle = 'rgba(160,200,255,0.30)'; c.beginPath();
      c.moveTo(-L * 0.18, -hw + 5); c.lineTo(-L * 0.06, -hw + 7); c.lineTo(-L * 0.06, hw - 7); c.lineTo(-L * 0.18, hw - 5); c.closePath(); c.fill();
      c.fillStyle = car.col; rr(c, -L * 0.60, -hw + 7, cl - L * 0.2, CAR_W - 14, 3); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)'; rr(c, -L * 0.60, -hw + 7, cl - L * 0.2, CAR_W - 14, 3); c.fill();
      // Lichter
      c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(-3, -hw + 5, 3, 0, 6.2832); c.arc(-3, hw - 5, 3, 0, 6.2832); c.fill();
      if (car.braking) {
        c.fillStyle = 'rgba(255,60,60,0.28)'; c.beginPath(); c.arc(-L + 3, -hw + 5, 8, 0, 6.2832); c.arc(-L + 3, hw - 5, 8, 0, 6.2832); c.fill();
        c.fillStyle = '#ff3b3b';
      } else c.fillStyle = '#7a1e1e';
      c.fillRect(-L, -hw + 2, 3.5, 6); c.fillRect(-L, hw - 8, 3.5, 6);
      if (car.crash) {
        c.fillStyle = 'rgba(255,60,60,0.30)'; rr(c, -L, -hw, L, CAR_W, 9); c.fill();
        if (Math.floor(t / 300) % 2 === 0) {
          c.fillStyle = '#ffb340';
          c.beginPath(); c.arc(-2, -hw + 2, 3, 0, 6.2832); c.arc(-2, hw - 2, 3, 0, 6.2832); c.arc(-L + 2, -hw + 2, 3, 0, 6.2832); c.arc(-L + 2, hw - 2, 3, 0, 6.2832); c.fill();
        }
      }
      c.restore();
    }
    function drawPed(c, p, t) {
      if (p.st === 4) {
        c.strokeStyle = '#ff5c5c'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
        c.moveTo(p.x - 8, p.y - 8); c.lineTo(p.x + 8, p.y + 8); c.moveTo(p.x + 8, p.y - 8); c.lineTo(p.x - 8, p.y + 8); c.stroke(); c.lineCap = 'butt';
        c.fillStyle = p.col; c.globalAlpha = 0.6; c.beginPath(); c.ellipse(p.x, p.y, 9, 4.5, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
        return;
      }
      const moving = p.st !== 1;
      const sw = moving ? Math.sin(p.ph * 6) * 4 : 0;
      const dir = p.st === 0 ? (p.ty >= p.y ? 1 : -1) * (p.side === 0 ? 1 : 1) : p.dir;
      const dy = p.st === 0 ? (p.ty - p.y >= 0 ? 1 : -1) : p.dir;
      // Schatten
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 3, 9, 5.5, 0, 0, 6.2832); c.fill();
      // Fuesse
      c.fillStyle = '#10141a';
      c.beginPath(); c.ellipse(p.x - 3, p.y + dy * (5 + sw), 2.4, 3.2, 0, 0, 6.2832); c.ellipse(p.x + 3, p.y + dy * (5 - sw), 2.4, 3.2, 0, 0, 6.2832); c.fill();
      // Schultern / Jacke
      c.fillStyle = p.col; c.beginPath(); c.ellipse(p.x, p.y, 8, 4.8, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(p.x - 1.5, p.y - 1.2, 5, 2.2, 0, 0, 6.2832); c.fill();
      // Kopf
      c.fillStyle = '#e8c8a8'; c.beginPath(); c.arc(p.x, p.y, 3.8, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(30,22,16,0.8)'; c.beginPath(); c.arc(p.x, p.y - dy * 0.8, 3.8, dy > 0 ? 3.14 : 0, dy > 0 ? 6.2832 : 3.14); c.fill();
    }

    function scene(c, t) {
      const ins = plant.readInputs();
      const md = mode();

      // --- Haeuser im Hintergrund ---
      c.fillStyle = '#171c21'; c.fillRect(0, 0, W, 140);
      for (let i = 0; i < 9; i++) {
        const bx = i * 112 - 6, bh = 70 + ((i * 37) % 4) * 14;
        c.fillStyle = i % 2 ? '#1d232a' : '#202730'; c.fillRect(bx, 130 - bh, 106, bh);
        c.fillStyle = '#12161a'; c.fillRect(bx, 130 - bh, 106, 5);
        for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
          if (r * 20 + 14 > bh - 8) continue;
          const lit = ((i * 7 + r * 5 + q * 3) % 5) < 2;
          c.fillStyle = lit ? 'rgba(255,200,110,0.55)' : 'rgba(255,255,255,0.05)';
          c.fillRect(bx + 8 + q * 16, 130 - bh + 12 + r * 20, 9, 11);
        }
      }
      // --- Gehwege ---
      c.fillStyle = '#272e36'; c.fillRect(0, 130, W, ROAD0 - 130); c.fillRect(0, ROAD1, W, 410 - ROAD1);
      c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x < W; x += 30) { c.moveTo(x, 130); c.lineTo(x, ROAD0); c.moveTo(x, ROAD1); c.lineTo(x, 410); }
      for (let y = 160; y < ROAD0; y += 30) { c.moveTo(0, y); c.lineTo(W, y); }
      for (let y = ROAD1 + 30; y < 410; y += 30) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      c.fillStyle = '#3a424d'; c.fillRect(0, ROAD0 - 4, W, 4); c.fillRect(0, ROAD1, W, 4);
      // --- Fahrbahn ---
      const ag = c.createLinearGradient(0, ROAD0, 0, ROAD1);
      ag.addColorStop(0, '#1b2025'); ag.addColorStop(0.5, '#20262c'); ag.addColorStop(1, '#1b2025');
      c.fillStyle = ag; c.fillRect(0, ROAD0, W, ROAD1 - ROAD0);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath();
      c.moveTo(0, ROAD0 + 5); c.lineTo(W, ROAD0 + 5); c.moveTo(0, ROAD1 - 5); c.lineTo(W, ROAD1 - 5); c.stroke();
      c.strokeStyle = 'rgba(232,237,242,0.55)'; c.lineWidth = 2.5; c.setLineDash(DASH);
      c.beginPath(); c.moveTo(0, 270); c.lineTo(CROSS0 - 8, 270); c.moveTo(CROSS1 + 8, 270); c.lineTo(W, 270); c.stroke(); c.setLineDash(NODASH);
      // --- Induktionsschleifen ---
      for (let ln = 0; ln < 2; ln++) {
        const busy = loopBusyLane(ln);
        const lx = ln === 0 ? LOOP0 : 1000 - LOOP1, ly = LANE_Y[ln] - 17;
        c.fillStyle = busy ? 'rgba(255,179,64,0.30)' : 'rgba(255,255,255,0.03)'; rr(c, lx, ly, LOOP1 - LOOP0, 34, 4); c.fill();
        c.strokeStyle = busy ? '#ffb340' : '#5a6572'; c.lineWidth = 1.6; c.setLineDash(DASH2); rr(c, lx, ly, LOOP1 - LOOP0, 34, 4); c.stroke(); c.setLineDash(NODASH);
      }
      // --- Zebrastreifen ---
      c.fillStyle = 'rgba(226,232,240,0.88)';
      for (let y = ROAD0 + 6; y < ROAD1 - 8; y += 15) { rr(c, CROSS0, y, CROSS1 - CROSS0, 8, 2); c.fill(); }
      // --- Haltelinien ---
      c.fillStyle = '#e8edf2'; c.fillRect(STOP_S - 2, LANE_Y[0] - 27, 5, 54);
      c.fillRect(1000 - STOP_S - 3, LANE_Y[1] - 27, 5, 54);
      // --- Fahrzeuge ---
      for (let ln = 0; ln < 2; ln++) { const L = lanes[ln]; for (let i = 0; i < L.length; i++) drawCar(c, L[i], t); }
      // --- Fussgaenger ---
      for (let i = 0; i < peds.length; i++) drawPed(c, peds[i], t);

      // --- Masten und Koepfe am Strassenrand ---
      c.fillStyle = '#10141a';
      c.fillRect(402, 340, 4, 14); c.fillRect(594, 166, 4, 14);
      street3(c, 404, 372, 5.5);
      street3(c, 596, 156, 5.5);
      txt(c, 'Straße', 404, 400, '#6b7683', 9, 'center'); txt(c, 'Straße', 596, 140, '#6b7683', 9, 'center');
      // Fussgaengerampeln mit Taster
      const sigClick = (px, py) => {
        c.fillStyle = '#10141a'; rr(c, px - 11, py - 17, 22, 34, 4); c.fill();
        c.strokeStyle = '#3a424d'; c.lineWidth = 1.2; c.stroke();
        const bp = ins['I0.0'];
        c.fillStyle = '#0b0e11'; c.beginPath(); c.arc(px, py + 5, 7, 0, 6.2832); c.fill();
        c.fillStyle = bp ? '#9a9a9a' : '#d6dde5'; c.beginPath(); c.arc(px, py + 5, bp ? 4.2 : 5, 0, 6.2832); c.fill();
        const on = req && (Math.floor(t / 500) % 2 === 0 || true);
        led(c, px, py - 8, 3.2, on, '#ffb340');
      };
      ped2(c, 430, 178, 6.5); sigClick(452, 196);
      ped2(c, 570, 362, 6.5); sigClick(548, 344);
      txt(c, 'Fußgänger', 430, 150, '#6b7683', 9, 'center'); txt(c, 'Fußgänger', 570, 392, '#6b7683', 9, 'center');
      c.fillStyle = '#10141a'; c.fillRect(428, 196, 3, 6); c.fillRect(569, 336, 3, 6);

      // --- Titel ---
      txt(c, '\u{1F6A6} Ampel mit Fußgängerüberweg', 24, 26, '#8a96a4', 15, 'left', '600');
      txt(c, 'Spur 1 ←', 40, 232, 'rgba(255,255,255,0.18)', 11, 'left'); txt(c, '→ Spur 2', 960, 308, 'rgba(255,255,255,0.18)', 11, 'right');

      // --- Bedien- und Anzeigefeld ---
      c.fillStyle = '#222830'; rr(c, 24, 420, 952, 128, 12); c.fill();
      c.strokeStyle = '#323a44'; c.lineWidth = 1.5; c.stroke();
      txt(c, 'H1–H3 Straße', 64, 436, '#8a96a4', 11, 'center', '600');
      street3(c, 64, 486, 11);
      txt(c, 'H4/H5 Fußgänger', 170, 436, '#8a96a4', 11, 'center', '600');
      ped2(c, 170, 486, 12);
      // S1 Taster
      const s1 = ins['I0.0'];
      c.fillStyle = '#10141a'; c.beginPath(); c.arc(290, 484, 32, 0, 6.2832); c.fill();
      c.fillStyle = '#2c333b'; c.beginPath(); c.arc(290, 484, 29, 0, 6.2832); c.fill();
      c.fillStyle = s1 ? '#a8742a' : '#ffb340'; c.beginPath(); c.arc(290, 484 + (s1 ? 1 : -1), s1 ? 21 : 23, 0, 6.2832); c.fill();
      if (!s1) { c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(283, 475, 8, 0, 6.2832); c.fill(); }
      txt(c, 'S1 Fußgängertaster', 330, 436, '#cfd8e2', 11, 'center', '600');
      c.fillStyle = '#0b0e11'; rr(c, 340, 470, 110, 28, 6); c.fill();
      c.strokeStyle = req ? '#ffb340' : '#323a44'; c.lineWidth = 1.5; c.stroke();
      led(c, 356, 484, 4.5, req, '#ffb340');
      txt(c, 'Signal kommt', 398, 484, req ? '#ffb340' : '#4a5460', 12, 'center', '600');
      // S2 Schalter
      const on2 = ins['I0.1'];
      c.fillStyle = '#10141a'; rr(c, 456, 456, 30, 58, 8); c.fill();
      c.strokeStyle = on2 ? '#4cd964' : '#3a424d'; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = '#9aa7b6'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(471, 485); c.lineTo(471, on2 ? 466 : 504); c.stroke(); c.lineCap = 'butt';
      c.fillStyle = on2 ? '#4cd964' : '#6b7683'; c.beginPath(); c.arc(471, on2 ? 466 : 504, 6, 0, 6.2832); c.fill();
      txt(c, 'S2 Betrieb', 471, 436, '#cfd8e2', 11, 'center', '600');
      txt(c, on2 ? 'EIN' : 'AUS', 505, 486, on2 ? '#4cd964' : '#6b7683', 12, 'left', '700');
      // B1 Schleife
      led(c, 600, 480, 6, ins['I0.2'], '#ffb340');
      txt(c, 'B1 Schleife', 600, 436, '#cfd8e2', 11, 'center', '600');
      txt(c, ins['I0.2'] ? 'Fahrzeug da' : 'frei', 600, 504, ins['I0.2'] ? '#ffb340' : '#6b7683', 11, 'center');
      // Zaehler
      const st = plant.state();
      const cells = [['Fahrzeuge', st.carsPassed, '#4cd964'], ['Fußgänger', st.pedsCrossed, '#3b9eff'], ['Verstöße', st.violations, st.violations ? '#ff5c5c' : '#6b7683'], ['Unfälle', st.carsCrashed + st.pedsCrashed, (st.carsCrashed + st.pedsCrashed) ? '#ff5c5c' : '#6b7683']];
      for (let i = 0; i < 4; i++) {
        const bx = 664 + (i % 2) * 150, by = 434 + Math.floor(i / 2) * 50;
        c.fillStyle = '#0b0e11'; rr(c, bx, by, 138, 42, 6); c.fill();
        txt(c, cells[i][0], bx + 10, by + 21, '#8a96a4', 11, 'left');
        c.textAlign = 'right'; c.textBaseline = 'middle'; c.font = '700 24px "Courier New", ui-monospace, monospace';
        c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillText('88', bx + 130, by + 22);
        c.fillStyle = cells[i][2]; c.fillText(String(Math.min(cells[i][1], 99)), bx + 130, by + 22);
      }
      txt(c, 'Wartend: Autos ' + st.carsWaiting + '   Fußgänger ' + st.pedsWaiting, 664, 538, '#8a96a4', 11, 'left');
      txt(c, 'längste Wartezeit Auto ' + (st.maxCarWaitMs / 1000).toFixed(1) + ' s', 840, 538, '#8a96a4', 11, 'left');

      // --- Unfall-/Verstosshinweis ---
      if (st.crash || st.violations > 0 && (vioFlags[0] || vioFlags[1] || vioFlags[2] || vioFlags[3])) {
        const flash = Math.floor(t / 350) % 2 === 0;
        c.globalAlpha = flash ? 1 : 0.55;
        c.fillStyle = '#6b1a1a'; rr(c, 300, 50, 400, 30, 15); c.fill();
        c.strokeStyle = '#ff5c5c'; c.lineWidth = 2; c.stroke();
        txt(c, st.crash ? '⚠ UNFALL: Fahrzeug und Fußgänger!' : '⚠ Ampelfehler: gleichzeitig Grün / Rot+Grün', 500, 66, '#ffd0d0', 13, 'center', '700');
        c.globalAlpha = 1;
      }
    }

    reset();
    return plant;
  }

  P.register({
    id: 'ampel', name: 'Ampel / Kreuzung', icon: '\u{1F6A6}', info: INFO, io: IO, create: create
  });
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
