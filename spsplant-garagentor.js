(function (root) {
  'use strict';
  const P = root.SPS_PLANTS = root.SPS_PLANTS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, io: def.io }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Anlage 4: Garagentor (Rolltor) mit Endschaltern =====
  // Physik: Tor faehrt in 6 s von 0 (unten) nach 100 (oben). Endschalter oben (I0.2) ab 98, unten (I0.3) bis 2.
  // Hindernis: Lichtschranke I0.4 = 1. Faehrt das Tor abwaerts auf das Hindernis, ist das ein crash.
  const SPEED = 100 / 6; // % pro Sekunde
  const TOP_SW = 98, BOT_SW = 2;
  const LW = 800, LH = 480;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const OBST = [
    { name: 'Auto', h: 0.45, id: 'auto' },
    { name: 'Person', h: 0.80, id: 'person' },
    { name: 'Katze', h: 0.15, id: 'katze' }
  ];

  const IO = {
    inputs: [
      { key: 'I0.0', sym: 'S1_Auf', text: 'Taster Auf (Schließer)', kind: 'button' },
      { key: 'I0.1', sym: 'S2_Ab', text: 'Taster Ab (Schließer)', kind: 'button' },
      { key: 'I0.2', sym: 'B1_EndeOben', text: 'Endschalter oben (1 = Tor ganz oben)', kind: 'sensor' },
      { key: 'I0.3', sym: 'B2_EndeUnten', text: 'Endschalter unten (1 = Tor ganz unten)', kind: 'sensor' },
      { key: 'I0.4', sym: 'B3_Lichtschranke', text: 'Lichtschranke (1 = Hindernis im Tor)', kind: 'sensor' },
      { key: 'I0.5', sym: 'S3_Stopp', text: 'Taster Stopp (Öffner, Ruhe = 1)', kind: 'button' }
    ],
    outputs: [
      { key: 'Q0.0', sym: 'K1_MotorAuf', text: 'Schütz Motor Auf' },
      { key: 'Q0.1', sym: 'K2_MotorAb', text: 'Schütz Motor Ab' },
      { key: 'Q0.2', sym: 'H1_Blinklicht', text: 'Blinklicht' },
      { key: 'Q0.3', sym: 'H2_Beleuchtung', text: 'Beleuchtung' }
    ]
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function led(ctx, x, y, on, col, r) {
    r = r || 6; col = col || C.ok;
    if (on) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 6.2832); ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = on ? col : '#2e353d'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#ffffff88' : '#00000088'; ctx.stroke();
    if (on) { ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.2832); ctx.fillStyle = '#ffffffaa'; ctx.fill(); }
  }
  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + a); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  P.register({
    id: 'garagentor',
    name: 'Garagentor mit Endschaltern',
    icon: '🚪',
    info: 'Rolltor aus Lamellen mit Motor auf/ab, Endschalter oben und unten, Lichtschranke gegen Einklemmen (Auto, Person oder Katze lässt sich per Tippen ins Tor stellen), Blinklicht, Beleuchtung und Tastern. Das Tor braucht etwa 6 s für die ganze Fahrt. Motor Auf und Ab gleichzeitig, überfahrene Endschalter und Einklemmen sind Fehler.',
    io: IO,
    create(opts) {
      opts = opts || {};
      const seed = opts.seed != null ? opts.seed : 1;
      let rnd = mulberry32(seed);
      const events = [];
      let st, layout = { s: 1, ox: 0, oy: 0 }, hits = [], held = {};

      function ev(kind, text, fxk, x, y, what) { const e = { t: st.t, text: text, kind: kind }; if (fxk) { e.fx = fxk; e.x = x; e.y = y; if (what) e.what = what; } events.push(e); if (events.length > 300) events.shift(); }
      function fresh() {
        rnd = mulberry32(seed);
        return {
          t: 0, acc: 0, in0: false, in1: false, in5: true,
          out: { 'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false },
          pos: clamp(opts.doorPos != null ? opts.doorPos : 0, 0, 100),
          obst: false, obstType: opts.obstacleType || 'auto', obsIdx: 0, obsA: 0,
          crash: false, crashes: 0, crashReason: '', jammed: false, interlockNow: false,
          overrun: false, overrunTop: false, overrunBottom: false, pushT: 0, dir: 0, moving: 0,
          motRot: 0, travelMs: 0, trips: 0, lastEnd: 0, dentY: 0, dentT: -1
        };
      }
      function obstDef() { return OBST.find((o) => o.id === st.obstType) || OBST[0]; }

      function setObstacle(on, type) {
        on = !!on;
        if (type) st.obstType = type;
        if (on === st.obst) return;
        if (on && !type) { st.obstType = OBST[st.obsIdx % OBST.length].id; st.obsIdx++; }
        st.obst = on;
        ev('info', on ? 'Hindernis im Tor: ' + obstDef().name : 'Hindernis aus dem Tor entfernt');
      }

      function tick() {
        const dt = 0.01, o = st.out, up = o['Q0.0'], dn = o['Q0.1'];
        const both = up && dn;
        if (both) {
          if (!st.interlockNow) { st.interlockNow = true; st.crash = true; st.crashes++; st.crashReason = 'interlock'; st.dentY = OY1 - st.pos / 100 * OH - 20; st.dentT = st.t; ev('error', 'Motor Auf und Ab gleichzeitig (Verriegelung verletzt)', 'interlock', OCX, OY0 + 20); }
        } else st.interlockNow = false;
        const step = SPEED * dt;
        let dir = 0, jam = false;
        if (!both && up) {
          dir = 1; st.pos = Math.min(100, st.pos + step);
          if (st.pos >= 100) { st.pushT += 10; if (st.pushT >= 100 && !st.overrunTop) { st.overrunTop = true; st.overrun = true; ev('error', 'Endschalter oben überfahren', 'overrun', OCX, OY0 + 10); } } else st.pushT = 0;
        } else if (!both && dn) {
          dir = -1;
          const top = st.obst ? obstDef().h * 100 : -1;
          if (st.obst && st.pos <= top + 1e-9) { jam = true; }
          else {
            let np = st.pos - step;
            if (st.obst && np <= top + 1e-9) { np = top; jam = true; }
            st.pos = Math.max(0, np);
            if (st.pos <= 0) { st.pushT += 10; if (st.pushT >= 100 && !st.overrunBottom) { st.overrunBottom = true; st.overrun = true; ev('error', 'Endschalter unten überfahren', 'overrun', OCX, OY1 - 10); } } else st.pushT = 0;
          }
        } else st.pushT = 0;
        if (jam) {
          if (!st.jammed) { st.crash = true; st.crashes++; st.crashReason = 'obstacle'; st.dentY = OY1 - st.pos / 100 * OH - 20; st.dentT = st.t; ev('error', 'Tor fährt gegen Hindernis', 'obstacle', OCX, OY1 - obstDef().h * OH, obstDef().id); }
          st.jammed = true;
        } else st.jammed = false;
        st.dir = dir; st.moving = dir !== 0 && !jam && !(st.pos >= 100 && dir > 0) && !(st.pos <= 0 && dir < 0) ? dir : 0;
        if (st.moving) { st.motRot += st.moving * dt * 12; st.travelMs += 10; }
        // Fahrten zaehlen (komplett von einem Ende zum anderen)
        const end = st.pos >= TOP_SW ? 1 : st.pos <= BOT_SW ? -1 : 0;
        if (end !== 0) { if (st.lastEnd !== 0 && end !== st.lastEnd) st.trips++; st.lastEnd = end; }
        // Hindernis einblenden
        const tgt = st.obst ? 1 : 0;
        st.obsA += clamp(tgt - st.obsA, -dt * 5, dt * 5);
        st.t += 10;
      }

      const p = {
        io: IO,
        events: events,
        worldSize() { return { w: LW, h: LH }; },
        setInput(key, v) {
          v = !!v;
          if (key === 'I0.0') st.in0 = v; else if (key === 'I0.1') st.in1 = v; else if (key === 'I0.5') st.in5 = v;
          else if (key === 'I0.4') setObstacle(v);
        },
        readInputs() {
          return { 'I0.0': st.in0, 'I0.1': st.in1, 'I0.2': st.pos >= TOP_SW, 'I0.3': st.pos <= BOT_SW, 'I0.4': st.obst, 'I0.5': st.in5 };
        },
        writeOutputs(o) { for (const k in o) if (k in st.out) st.out[k] = !!o[k]; },
        step(dtMs) {
          st.acc += dtMs;
          while (st.acc >= 10 - 1e-9) { st.acc -= 10; tick(); }
        },
        toggleObstacle() { setObstacle(!st.obst); return st.obst; },
        setObstacle(on, type) { setObstacle(on, type); return st.obst; },
        reset() { events.length = 0; held = {}; st = fresh(); },
        state() {
          const od = obstDef();
          return {
            doorPos: st.pos, crash: st.crash, overrun: st.overrun, crashes: st.crashes, crashReason: st.crashReason,
            jammed: st.jammed, interlock: st.interlockNow, obstacle: st.obst, obstacleType: st.obst ? od.name : '',
            obstacleHeight: st.obst ? od.h * 100 : 0, moving: st.moving, trips: st.trips, travelMs: st.travelMs, timeMs: st.t,
            outputs: Object.assign({}, st.out), top: st.pos >= TOP_SW, bottom: st.pos <= BOT_SW
          };
        },
        scenarios: null,
        pointer(kind, x, y) {
          const lx = (x - layout.ox) / layout.s, ly = (y - layout.oy) / layout.s;
          if (kind === 'down') {
            for (const h of hits) {
              const inside = h.r ? Math.hypot(lx - h.cx, ly - h.cy) <= h.r + 8 : (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h);
              if (!inside) continue;
              held[h.id] = true;
              if (h.id === 'S1') st.in0 = true; else if (h.id === 'S2') st.in1 = true; else if (h.id === 'S3') st.in5 = false;
              else if (h.id === 'OBST') { held[h.id] = false; setObstacle(!st.obst); }
              return h.id;
            }
            return null;
          }
          if (kind === 'up') {
            let r = null;
            if (held.S1) { st.in0 = false; r = 'S1'; } if (held.S2) { st.in1 = false; r = 'S2'; } if (held.S3) { st.in5 = true; r = 'S3'; }
            held = {}; return r;
          }
          return null;
        },
        draw(ctx, w, h, t) { drawScene(ctx, w, h, t); }
      };

      const scen = function (name) {
        const defs = {
          zu: { pos: 0 }, offen: { pos: 100 }, halboffen: { pos: 50 },
          hindernis_auto: { pos: 100, obstacle: 'auto' }, hindernis_person: { pos: 100, obstacle: 'person' }, hindernis_katze: { pos: 100, obstacle: 'katze' }
        };
        const d = typeof name === 'string' ? defs[name] : name;
        if (!d) return false;
        p.reset();
        st.pos = clamp(d.pos != null ? d.pos : 0, 0, 100);
        if (d.obstacle) { setObstacle(true, d.obstacle); st.obsA = 1; events.length = 0; }
        return true;
      };
      scen.list = ['zu', 'offen', 'halboffen', 'hindernis_auto', 'hindernis_person', 'hindernis_katze'];
      p.scenarios = scen;

      // ===== Zeichnen =====
      const OX0 = 240, OX1 = 560, OY0 = 130, OY1 = 390, OH = OY1 - OY0, BEAM_Y = OY1 - 0.08 * OH, OCX = 400;

      function drawObstacle(ctx, def, tt) {
        const k = def.h * OH, fy = OY1, cx = OCX;
        ctx.save();
        ctx.globalAlpha = clamp(st.obsA, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, fy + 2, def.id === 'auto' ? 112 : 36, 6, 0, 0, 6.2832); ctx.fill();
        if (def.id === 'auto') {
          const s = k / 118;
          ctx.save(); ctx.translate(cx, fy); ctx.scale(s, s);
          ctx.fillStyle = '#b02a30'; rr(ctx, -105, -72, 210, 46, 12); ctx.fill();
          ctx.fillStyle = '#8c2026'; ctx.beginPath(); ctx.moveTo(-62, -72); ctx.lineTo(-40, -118); ctx.lineTo(38, -118); ctx.lineTo(66, -72); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#9fd0ee'; ctx.beginPath(); ctx.moveTo(-52, -76); ctx.lineTo(-35, -110); ctx.lineTo(-2, -110); ctx.lineTo(-2, -76); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -76); ctx.lineTo(6, -110); ctx.lineTo(33, -110); ctx.lineTo(54, -76); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe9a0'; rr(ctx, 90, -62, 14, 9, 3); ctx.fill(); ctx.fillStyle = '#ff6a6a'; rr(ctx, -104, -62, 10, 9, 3); ctx.fill();
          [-62, 64].forEach((wx) => { ctx.fillStyle = '#15191d'; ctx.beginPath(); ctx.arc(wx, -22, 21, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(wx, -22, 10, 0, 6.2832); ctx.fill(); });
          ctx.restore();
        } else if (def.id === 'person') {
          const s = k / 208, sw = Math.sin(tt * 2) * 1.5;
          ctx.save(); ctx.translate(cx + sw, fy); ctx.scale(s, s);
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#2d3a50'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-8, -100); ctx.lineTo(-10, -6); ctx.moveTo(8, -100); ctx.lineTo(10, -6); ctx.stroke();
          ctx.fillStyle = '#3b9eff'; rr(ctx, -22, -168, 44, 78, 14); ctx.fill();
          ctx.strokeStyle = '#3b9eff'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-22, -158); ctx.lineTo(-30, -108); ctx.moveTo(22, -158); ctx.lineTo(30, -108); ctx.stroke();
          ctx.fillStyle = '#f0c39a'; ctx.beginPath(); ctx.arc(0, -190, 18, 0, 6.2832); ctx.fill();
          ctx.fillStyle = '#4a3426'; ctx.beginPath(); ctx.arc(0, -196, 18, Math.PI, 6.2832); ctx.fill();
          ctx.restore();
        } else {
          const s = k / 39, wag = Math.sin(tt * 4) * 0.35;
          ctx.save(); ctx.translate(cx, fy); ctx.scale(s, s);
          ctx.fillStyle = '#e8a45a'; ctx.beginPath(); ctx.ellipse(0, -14, 20, 16, 0, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.arc(14, -28, 11, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -35); ctx.lineTo(8, -46); ctx.lineTo(14, -38); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(15, -38); ctx.lineTo(21, -46); ctx.lineTo(23, -34); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#e8a45a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-18, -6); ctx.quadraticCurveTo(-36, -8 + wag * 20, -32, -28 + wag * 10); ctx.stroke();
          ctx.fillStyle = '#16301a'; ctx.beginPath(); ctx.ellipse(11, -29, 1.6, 3, 0, 0, 6.2832); ctx.ellipse(18, -29, 1.6, 3, 0, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      function drawScene(ctx, w, h, t) {
        const tt = typeof t === 'number' ? t / 1000 : st.t / 1000;
        const s = Math.min(w / LW, h / LH), ox = (w - LW * s) / 2, oy = (h - LH * s) / 2;
        layout = { s: s, ox: ox, oy: oy }; hits = [];
        const o = st.out, inp = p.readInputs(), pos = st.pos;
        ctx.save();
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
        ctx.translate(ox, oy); ctx.scale(s, s);
        ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
        // Himmel / Hintergrund
        const bg = ctx.createLinearGradient(0, 0, 0, LH); bg.addColorStop(0, '#161b21'); bg.addColorStop(1, '#101316');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, LW, LH);
        // Vorplatz
        const dg = ctx.createLinearGradient(0, OY1, 0, 444); dg.addColorStop(0, '#2a3038'); dg.addColorStop(1, '#1a1f25');
        ctx.fillStyle = dg; ctx.fillRect(0, OY1, LW, 54);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        for (let x = -100; x < 900; x += 70) { ctx.beginPath(); ctx.moveTo(OX0 + (x - 400) * 0.4 + 160, OY1); ctx.lineTo(x, 444); ctx.stroke(); }
        // Wand
        const wg = ctx.createLinearGradient(0, 56, 0, OY1); wg.addColorStop(0, '#222a32'); wg.addColorStop(1, '#1b2128');
        ctx.fillStyle = wg; ctx.fillRect(150, 56, 500, OY1 - 56);
        ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1;
        for (let y = 70, r = 0; y < OY1; y += 16, r++) {
          ctx.beginPath(); ctx.moveTo(150, y); ctx.lineTo(650, y); ctx.stroke();
          for (let x = 150 + (r % 2) * 20; x < 650; x += 40) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke(); }
        }
        ctx.fillStyle = '#2c353f'; ctx.fillRect(144, 50, 512, 8); ctx.fillStyle = '#10151a'; ctx.fillRect(144, 58, 512, 2);
        // Innenraum
        const ig = ctx.createLinearGradient(0, OY0, 0, OY1); ig.addColorStop(0, '#07090b'); ig.addColorStop(1, '#14181d');
        ctx.fillStyle = ig; ctx.fillRect(OX0, OY0, OX1 - OX0, OH);
        ctx.fillStyle = '#1b2128'; ctx.fillRect(OX0, OY1 - 30, OX1 - OX0, 30);
        ctx.fillStyle = '#11151a'; rr(ctx, OX0 + 14, OY1 - 96, 70, 66, 4); ctx.fill(); rr(ctx, OX1 - 90, OY1 - 70, 76, 40, 4); ctx.fill();
        const lampOn = o['Q0.3'];
        if (lampOn) {
          const lg = ctx.createLinearGradient(0, OY0, 0, OY1); lg.addColorStop(0, 'rgba(255,224,150,0.55)'); lg.addColorStop(1, 'rgba(255,224,150,0.12)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(OCX - 18, OY0 + 12); ctx.lineTo(OCX + 18, OY0 + 12); ctx.lineTo(OX1 - 6, OY1); ctx.lineTo(OX0 + 6, OY1); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = lampOn ? '#fff1c4' : '#4a5460'; rr(ctx, OCX - 22, OY0 + 4, 44, 9, 4); ctx.fill();
        if (lampOn) glow(ctx, OCX, OY0 + 14, 80, '#ffe9a0', '99');
        // Hindernis (hinter dem Tor, vor dem Innenraum)
        const od = obstDef();
        if (st.obsA > 0.01) drawObstacle(ctx, od, tt);
        // Tor: Lamellen
        const edge = OY1 - pos / 100 * OH, SH = OH / 10;
        ctx.save(); ctx.beginPath(); ctx.rect(OX0, OY0, OX1 - OX0, OH); ctx.clip();
        if (edge > OY0) {
          for (let k = 0; ; k++) {
            const yb = edge - k * SH, yt = yb - SH;
            if (yb < OY0) break;
            const sg = ctx.createLinearGradient(0, yt, 0, yb);
            sg.addColorStop(0, '#cfd6dd'); sg.addColorStop(0.12, '#b4bdc6'); sg.addColorStop(0.85, '#8d98a4'); sg.addColorStop(1, '#6f7a86');
            ctx.fillStyle = sg; ctx.fillRect(OX0, yt, OX1 - OX0, SH);
            ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(OX0, yb - 2, OX1 - OX0, 2);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(OX0, yt + 1, OX1 - OX0, 1.5);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(OX0, yt + SH * 0.42, OX1 - OX0, 1.5);
          }
          // Rundung beim Aufrollen
          const cg = ctx.createLinearGradient(0, OY0, 0, OY0 + 46); cg.addColorStop(0, 'rgba(0,0,0,0.7)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg; ctx.fillRect(OX0, OY0, OX1 - OX0, 46);
          const sh = ctx.createLinearGradient(OX0, 0, OX1, 0); sh.addColorStop(0, 'rgba(0,0,0,0.30)'); sh.addColorStop(0.08, 'rgba(0,0,0,0)'); sh.addColorStop(0.92, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.30)');
          ctx.fillStyle = sh; ctx.fillRect(OX0, OY0, OX1 - OX0, OH);
          // Bodenprofil
          const jam = st.jammed;
          ctx.fillStyle = jam && Math.floor(tt * 4) % 2 === 0 ? C.bad : '#4b5560'; ctx.fillRect(OX0, edge - 8, OX1 - OX0, 8);
          ctx.fillStyle = '#10151a'; ctx.fillRect(OX0, edge - 2, OX1 - OX0, 2);
          ctx.fillStyle = '#2a323b'; rr(ctx, OCX - 26, edge - 26, 52, 8, 4); ctx.fill();
          ctx.fillStyle = '#10151a'; rr(ctx, OCX - 20, edge - 24, 40, 4, 2); ctx.fill();
        }
        ctx.restore();
        // Rollkasten mit Trommel
        const rg = ctx.createLinearGradient(0, 92, 0, OY0); rg.addColorStop(0, '#46515c'); rg.addColorStop(0.5, '#2f3842'); rg.addColorStop(1, '#222a32');
        ctx.fillStyle = rg; rr(ctx, 224, 90, 352, 40, 6); ctx.fill(); ctx.strokeStyle = '#10151a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); rr(ctx, 236, 98, 328, 24, 4); ctx.clip();
        const dr = ctx.createLinearGradient(0, 98, 0, 122); dr.addColorStop(0, '#6b7783'); dr.addColorStop(0.35, '#c4cdd6'); dr.addColorStop(1, '#4a5560');
        ctx.fillStyle = dr; ctx.fillRect(236, 98, 328, 24);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.6;
        const bandOff = (((st.motRot * 6) % 8) + 8) % 8;
        for (let y = 94 + bandOff; y < 124; y += 8) { ctx.beginPath(); ctx.moveTo(236, y); ctx.lineTo(564, y); ctx.stroke(); }
        const fill = pos < 100 ? 0 : 1; if (fill) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(236, 98, 328, 24); }
        ctx.restore();
        // Fuehrungsschienen
        [OX0 - 10, OX1].forEach((x) => { const g = ctx.createLinearGradient(x, 0, x + 10, 0); g.addColorStop(0, '#79848f'); g.addColorStop(0.5, '#4b5661'); g.addColorStop(1, '#2a323b'); ctx.fillStyle = g; ctx.fillRect(x, OY0 - 2, 10, OH + 2); });

        // Motor rechts am Rollkasten
        const mx = 596, my = 110;
        ctx.fillStyle = '#2f3842'; rr(ctx, 570, 94, 56, 32, 6); ctx.fill(); ctx.strokeStyle = '#59646f'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(604 + i * 5, 98); ctx.lineTo(604 + i * 5, 122); ctx.stroke(); }
        const mcol = o['Q0.0'] && o['Q0.1'] ? C.bad : o['Q0.0'] ? C.ok : o['Q0.1'] ? C.warn : '#556070';
        ctx.save(); ctx.translate(mx, my); ctx.rotate(st.motRot);
        ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.2832); ctx.fill(); ctx.strokeStyle = mcol; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#c4cdd6'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { ctx.rotate(1.5708); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke(); }
        ctx.restore();
        txt(ctx, 'M', 640, 110, 14, mcol === '#556070' ? C.dim : mcol, 'left', '800');
        // Drehrichtungspfeil
        const dirA = o['Q0.0'] && !o['Q0.1'] ? 1 : o['Q0.1'] && !o['Q0.0'] ? -1 : 0;
        if (o['Q0.0'] || o['Q0.1']) {
          const bad = o['Q0.0'] && o['Q0.1'];
          const c = bad ? C.bad : dirA > 0 ? C.ok : C.warn;
          ctx.save(); ctx.translate(mx, my); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -tt * 30 * (dirA || 1);
          ctx.beginPath(); ctx.arc(0, 0, 20, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
          ctx.fillStyle = c;
          const ay = 150, ax = 598, bob = Math.sin(tt * 8) * 3 * (dirA || 1);
          if (bad) { txt(ctx, '⚠', ax, 146, 24, c, 'center', '800'); }
          else { ctx.beginPath(); if (dirA > 0) { ctx.moveTo(ax, ay - 12 - bob); ctx.lineTo(ax - 12, ay + 6 - bob); ctx.lineTo(ax + 12, ay + 6 - bob); } else { ctx.moveTo(ax, ay + 12 - bob); ctx.lineTo(ax - 12, ay - 6 - bob); ctx.lineTo(ax + 12, ay - 6 - bob); } ctx.closePath(); ctx.fill(); }
        }

        // Endschalter an der linken Schiene
        const sw = [['B1', OY0 + 18, inp['I0.2'], 'oben'], ['B2', OY1 - 44, inp['I0.3'], 'unten']];
        sw.forEach((q) => {
          const y = q[1], on = q[2];
          ctx.fillStyle = '#39424d'; rr(ctx, OX0 - 40, y - 9, 30, 18, 4); ctx.fill(); ctx.strokeStyle = '#59646f'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.strokeStyle = on ? C.ok : '#8b98a5'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(OX0 - 10, y); ctx.lineTo(OX0 - (on ? 2 : 4), y + (on ? 0 : -7)); ctx.stroke(); ctx.lineCap = 'butt';
          led(ctx, OX0 - 56, y, on, C.ok, 6);
          txt(ctx, q[0] + ' ' + q[3], OX0 - 64, y, 11, on ? C.ok : C.dim, 'right', '700');
        });

        // Lichtschranke
        const rcv = inp['I0.4'];
        ctx.fillStyle = '#39424d'; rr(ctx, 160, BEAM_Y - 12, 20, 24, 4); ctx.fill(); rr(ctx, 620, BEAM_Y - 12, 20, 24, 4); ctx.fill();
        ctx.strokeStyle = '#59646f'; ctx.lineWidth = 1.5; rr(ctx, 160, BEAM_Y - 12, 20, 24, 4); ctx.stroke(); rr(ctx, 620, BEAM_Y - 12, 20, 24, 4); ctx.stroke();
        led(ctx, 170, BEAM_Y, true, C.ok, 3.5); led(ctx, 630, BEAM_Y, rcv, C.warn, 3.5);
        const bx1 = rcv && st.obsA > 0.5 ? OCX - (od.id === 'auto' ? 105 : od.id === 'person' ? 24 : 24) : 620;
        ctx.save();
        ctx.strokeStyle = rcv ? 'rgba(255,92,92,0.9)' : 'rgba(255,92,92,0.75)'; ctx.lineWidth = 2.2; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -tt * 60;
        ctx.shadowColor = '#ff5c5c'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(180, BEAM_Y); ctx.lineTo(bx1, BEAM_Y); ctx.stroke();
        ctx.restore();
        if (rcv && bx1 < 620) { glow(ctx, bx1, BEAM_Y, 16, '#ff5c5c', '88'); }
        txt(ctx, 'B3', 170, BEAM_Y + 24, 10, C.dim, 'center', '700'); txt(ctx, 'B3', 630, BEAM_Y + 24, 10, rcv ? C.warn : C.dim, 'center', '700');

        // Blinklicht (links oben auf der Wand)
        const bl = o['Q0.2'];
        ctx.fillStyle = '#39424d'; ctx.fillRect(176, 104, 6, 26); rr(ctx, 168, 98, 22, 8, 3); ctx.fill();
        if (bl) glow(ctx, 179, 88, 70, '#ffb340', 'aa');
        const bg2 = ctx.createRadialGradient(177, 86, 1, 179, 90, 14); bg2.addColorStop(0, bl ? '#fff2cc' : '#8a6a2a'); bg2.addColorStop(0.5, bl ? '#ffb340' : '#6b4f1c'); bg2.addColorStop(1, bl ? '#e88a10' : '#3a2b0e');
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(179, 90, 13, Math.PI, 0); ctx.lineTo(192, 98); ctx.lineTo(166, 98); ctx.closePath(); ctx.fill();
        txt(ctx, 'H1', 179, 118, 10, bl ? C.warn : C.dim, 'center', '700');
        // Aussenleuchte (Beleuchtung H2)
        ctx.fillStyle = '#39424d'; ctx.fillRect(398, 62, 4, 14); rr(ctx, 384, 74, 32, 8, 3); ctx.fill();
        if (lampOn) {
          const og = ctx.createLinearGradient(0, 82, 0, 440); og.addColorStop(0, 'rgba(255,236,170,0.40)'); og.addColorStop(1, 'rgba(255,236,170,0.05)');
          ctx.fillStyle = og; ctx.beginPath(); ctx.moveTo(388, 82); ctx.lineTo(412, 82); ctx.lineTo(520, 440); ctx.lineTo(280, 440); ctx.closePath(); ctx.fill();
          glow(ctx, 400, 84, 52, '#ffe9a0', 'cc');
        }
        ctx.fillStyle = lampOn ? '#fff4cf' : '#59646f'; rr(ctx, 388, 80, 24, 6, 3); ctx.fill();
        txt(ctx, 'H2', 428, 80, 10, lampOn ? C.warn : C.dim, 'left', '700');

        // Torstellung links
        ctx.fillStyle = C.panel; rr(ctx, 40, 116, 70, 296, 10); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
        txt(ctx, 'Tor', 75, 132, 11, C.dim, 'center', '800');
        ctx.fillStyle = '#10151a'; rr(ctx, 62, 146, 26, 232, 5); ctx.fill();
        const fh = pos / 100 * 228, fg = ctx.createLinearGradient(0, 376 - fh, 0, 376); fg.addColorStop(0, '#6bb8ff'); fg.addColorStop(1, C.acc);
        ctx.fillStyle = fg; rr(ctx, 64, 376 - fh, 22, Math.max(fh, 0), 3); if (fh > 0.5) ctx.fill();
        for (let i = 0; i <= 4; i++) { const yy = 376 - i * 57; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(56, yy); ctx.lineTo(62, yy); ctx.stroke(); txt(ctx, (i * 25) + '', 52, yy, 9, C.dim, 'right', '500'); }
        txt(ctx, Math.round(pos) + ' %', 75, 396, 15, C.text, 'center', '800');
        // Zustandstext oben
        const mv = st.jammed ? 'KLEMMT' : st.moving > 0 ? 'fährt auf' : st.moving < 0 ? 'fährt ab' : pos >= TOP_SW ? 'offen' : pos <= BOT_SW ? 'geschlossen' : 'steht';
        const mcl = st.jammed ? C.bad : st.moving ? C.acc : C.dim;
        txt(ctx, 'Garagentor', 20, 26, 17, C.text, 'left', '700');
        ctx.fillStyle = C.panel; rr(ctx, 600, 10, 180, 28, 14); ctx.fill();
        led(ctx, 620, 24, !!st.moving || st.jammed, mcl === C.dim ? C.ok : mcl, 5);
        txt(ctx, mv, 634, 24, 13, mcl, 'left', '700');

        // Bedientafel rechts
        ctx.fillStyle = C.panel; rr(ctx, 668, 150, 116, 252, 10); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
        txt(ctx, 'Bedienung', 726, 166, 11, C.dim, 'center', '800');
        const btn = (id, cx, cy, colr, pressed, sym, label, labelCol) => {
          hits.push({ id: id, cx: cx, cy: cy, r: 17 });
          ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(cx, cy + 2, 21, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = '#4a5460'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 6.2832); ctx.stroke();
          const dy = pressed ? 2 : 0;
          const g = ctx.createRadialGradient(cx - 5, cy - 5 + dy, 1, cx, cy, 17); g.addColorStop(0, pressed ? colr + 'dd' : '#ffffffaa'); g.addColorStop(0.4, colr); g.addColorStop(1, '#00000066');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy + dy, 17 - dy, 0, 6.2832); ctx.fill();
          ctx.fillStyle = '#0d1114'; ctx.beginPath();
          if (sym === 'up') { ctx.moveTo(cx, cy - 7 + dy); ctx.lineTo(cx - 7, cy + 5 + dy); ctx.lineTo(cx + 7, cy + 5 + dy); ctx.closePath(); ctx.fill(); }
          else if (sym === 'down') { ctx.moveTo(cx, cy + 7 + dy); ctx.lineTo(cx - 7, cy - 5 + dy); ctx.lineTo(cx + 7, cy - 5 + dy); ctx.closePath(); ctx.fill(); }
          else if (sym === 'stop') { ctx.fillRect(cx - 6, cy - 6 + dy, 12, 12); }
          else { rr(ctx, cx - 8, cy - 2 + dy, 16, 7, 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - 5, cy - 2 + dy); ctx.lineTo(cx - 2, cy - 7 + dy); ctx.lineTo(cx + 3, cy - 7 + dy); ctx.lineTo(cx + 6, cy - 2 + dy); ctx.closePath(); ctx.fill(); }
          txt(ctx, label[0], cx + 28, cy - 7, 12, labelCol || C.text, 'left', '800'); txt(ctx, label[1], cx + 28, cy + 8, 10, C.dim, 'left', '600');
        };
        btn('S1', 696, 198, '#2fbf4f', st.in0, 'up', ['S1', 'Auf']);
        btn('S2', 696, 250, '#3b9eff', st.in1, 'down', ['S2', 'Ab']);
        btn('S3', 696, 302, '#d94a4a', !st.in5, 'stop', ['S3', 'Stopp']);
        btn('OBST', 696, 362, st.obst ? '#ffb340' : '#59646f', st.obst, 'car', [st.obst ? od.name : 'Hindernis', st.obst ? 'tippen: weg' : 'tippen']);
        // Tippflaeche im Tor
        hits.push({ id: 'OBST', x: OX0, y: OY1 - 160, w: OX1 - OX0, h: 160 });
        if (!st.obst) txt(ctx, 'Tippen: Hindernis ins Tor', OCX, OY1 - 12, 11, 'rgba(255,255,255,0.35)', 'center', '600');
        // Schadensbild: Beule im Tor und kurz Qualm
        if (st.dentT >= 0 && st.crashes > 0 && st.dentY > OY0 + 6 && st.dentY < edge - 6) {
          ctx.save(); ctx.beginPath(); ctx.rect(OX0, OY0, OX1 - OX0, OH); ctx.clip();
          const dy = st.dentY, dg2 = ctx.createRadialGradient(OCX, dy, 2, OCX, dy, 62);
          dg2.addColorStop(0, 'rgba(0,0,0,0.8)'); dg2.addColorStop(0.6, 'rgba(0,0,0,0.35)'); dg2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dg2; ctx.beginPath(); ctx.ellipse(OCX, dy, 62, 26, 0, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(OCX - 44, dy + 8); ctx.quadraticCurveTo(OCX, dy - 18, OCX + 44, dy + 8); ctx.stroke();
          ctx.strokeStyle = '#1b2026'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(OCX - 26, dy - 4); ctx.lineTo(OCX - 10, dy + 6); ctx.lineTo(OCX - 2, dy - 4); ctx.lineTo(OCX + 12, dy + 8); ctx.lineTo(OCX + 28, dy - 2); ctx.stroke(); ctx.lineCap = 'butt';
          ctx.restore();
          const age = st.t - st.dentT;
          if (age < 9000) {
            for (let k = 0; k < 4; k++) {
              const ph = (tt * 0.6 + k / 4) % 1;
              ctx.globalAlpha = 0.7 * (1 - ph) * (1 - age / 9000); ctx.fillStyle = '#4a5058';
              ctx.beginPath(); ctx.arc(OCX + Math.sin(ph * 6 + k * 2) * 20, dy - ph * 50, 6 + ph * 14, 0, 6.2832); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
        // Warnbanner
        let by = 56;
        const banner = (text) => { ctx.fillStyle = 'rgba(255,92,92,0.92)'; rr(ctx, 232, by - 14, 336, 24, 12); ctx.fill(); txt(ctx, text, 400, by - 2, 13, '#fff', 'center', '800'); by += 28; };
        if (st.jammed) banner('KOLLISION: Tor fährt gegen Hindernis');
        else if (st.crash && st.crashReason === 'obstacle') banner('Fehler: Hindernis eingeklemmt');
        if (st.interlockNow) banner('VERRIEGELUNG: Auf und Ab gleichzeitig');
        else if (st.crash && st.crashReason === 'interlock') banner('Fehler: Motor Auf und Ab gleichzeitig');
        if (st.overrun) banner('Endschalter überfahren');

        // E/A-Leiste unten
        const pills = [['S1', inp['I0.0'], C.ok], ['S2', inp['I0.1'], C.ok], ['B1', inp['I0.2'], C.ok], ['B2', inp['I0.3'], C.ok], ['B3', inp['I0.4'], C.warn], ['S3', inp['I0.5'], C.ok], null, ['K1', o['Q0.0'], C.ok], ['K2', o['Q0.1'], C.warn], ['H1', o['Q0.2'], C.warn], ['H2', o['Q0.3'], C.warn]];
        let px = 150;
        pills.forEach((q) => {
          if (!q) { px += 22; return; }
          ctx.fillStyle = C.panel; rr(ctx, px, 450, 50, 24, 12); ctx.fill();
          led(ctx, px + 14, 462, q[1], q[2], 5); txt(ctx, q[0], px + 25, 462, 12, q[1] ? C.text : C.dim, 'left', '800');
          px += 56;
        });
        txt(ctx, 'Eingänge', 150, 442, 9, C.dim, 'left', '700'); txt(ctx, 'Ausgänge', 150 + 6 * 56 + 22, 442, 9, C.dim, 'left', '700');
        ctx.restore();
      }

      p.reset();
      return p;
    }
  });
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
