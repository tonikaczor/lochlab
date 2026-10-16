'use strict';
/* Tonfunk HausLab: Elektroinstallation im 3D-Haus.
   Das Haus (Räume, Steckdosen, Schalter, Lampen, Geräte, Leitungen, Verteilerkasten) ist ein Modell (sch.haus).
   HAUS_COMPILE übersetzt das Modell in einen Stromkreis aus den Bauteilen des SimLab (Netz, FI, Automaten, Leitungen, Schalter, Lampen),
   die Engine in schaltplan.js rechnet ihn, die 3D-Ansicht hier zeigt das Ergebnis.
   Leitungen laufen nur an Wänden und Decke entlang (Installationszonen), nie quer durch den Raum. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (x, d) => (isFinite(x) ? x : 0).toFixed(d == null ? 1 : d).replace('.', ',');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };

  /* ---------------- Objektarten ---------------- */
  const TYPES = {
    sock: { n: 'Steckdose', z: 0.3, icon: '🔌', w: 0 },
    swi: { n: 'Ausschalter', z: 1.05, icon: '⏻' },
    swc: { n: 'Wechselschalter', z: 1.05, icon: '⇅' },
    lamp: { n: 'Deckenlampe', z: 2.5, icon: '💡', w: 60 },
    dev: { n: 'Festes Gerät', z: 0.9, icon: '♨', w: 2000 },
    junc: { n: 'Abzweigdose', z: 2.2, icon: '▣' },
    panel: { n: 'Verteilerkasten', z: 1.5, icon: '▤' },
    dev3: { n: 'Drehstromgerät', z: 0.9, icon: '3~', w: 7000 },
    sock3: { n: 'CEE-Steckdose 400 V', z: 0.3, icon: '⚡3', w: 0 }
  };
  const DEVS = [['Heizlüfter', 2000], ['Backofen', 3500], ['Wasserkocher', 2000], ['Kaffeemaschine', 1000], ['Kühlschrank', 150], ['PC-Arbeitsplatz', 300], ['Server', 1500], ['Fernseher', 120], ['Waschmaschine', 2200], ['Durchlauferhitzer', 3500]];
  const DEV3 = [['Herd', 7000], ['Durchlauferhitzer', 18000], ['Wallbox', 11000], ['Klimagerät', 8000], ['Kompressor', 4000], ['Lüftung (Motor)', 3000, 1], ['Kreissäge (Motor)', 2200, 1]];
  const LS_TYPES = ['B10', 'B13', 'B16', 'B20', 'B25', 'C16'], FI_TYPES = ['30mA', '300mA'];
  const SLOTS = 10;
  const SECS = [1.5, 2.5, 4, 6, 10];

  /* ---------------- Modell ---------------- */
  const newHouse = name => ({ name: name || 'Neues Haus', h: 2.5, rooms: [], objs: [], cables: [], panel: { fi: [{ type: '' }, { type: '' }], slots: Array.from({ length: SLOTS }, () => ({ ls: '', fi: 0, on: 1, p3: 0, ph: 0 })) }, nid: 1 });
  const nid = h => h.nid++;
  const room = (h, id) => h.rooms.find(r => r.id === id);
  const obj = (h, id) => h.objs.find(o => o.id === id);
  const cab = (h, id) => h.cables.find(c => c.id === id);
  const objName = (h, o) => o.n || TYPES[o.t].n;
  const pos = (h, o) => {
    const r = room(h, o.room); if (!r) return [0, 0, 0];
    switch (o.face) {
      case 'S': return [r.x + o.u, r.y, o.z]; case 'N': return [r.x + o.u, r.y + r.d, o.z];
      case 'W': return [r.x, r.y + o.u, o.z]; case 'E': return [r.x + r.w, r.y + o.u, o.z];
      default: return [r.x + o.u, r.y + o.v, h.h];
    }
  };
  const bounds = h => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; h.rooms.forEach(r => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.d); }); return h.rooms.length ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 8, y1: 8 }; };

  /* ---------------- Leitungswege: nur an Wänden und Decke ---------------- */
  const EPS = 1e-6;
  const perT = r => 2 * (r.w + r.d);
  const perS = (r, x, y) => {
    if (Math.abs(y - r.y) < EPS) return x - r.x;
    if (Math.abs(x - (r.x + r.w)) < EPS) return r.w + (y - r.y);
    if (Math.abs(y - (r.y + r.d)) < EPS) return r.w + r.d + (r.x + r.w - x);
    return 2 * r.w + r.d + (r.y + r.d - y);
  };
  const corners = r => [[0, [r.x, r.y]], [r.w, [r.x + r.w, r.y]], [r.w + r.d, [r.x + r.w, r.y + r.d]], [2 * r.w + r.d, [r.x, r.y + r.d]]];
  /* kürzester Weg entlang der Wände eines Raumes von a nach b (beide liegen auf dem Umfang), Eckpunkte inklusive */
  function walk(r, a, b) {
    const T = perT(r), s1 = perS(r, a[0], a[1]), s2 = perS(r, b[0], b[1]);
    const ccw = ((s2 - s1) % T + T) % T, cw = T - ccw, out = [a];
    const dir = ccw <= cw ? 1 : -1, dist = dir === 1 ? ccw : cw;
    const cs = corners(r).map(c => ({ d: dir === 1 ? (((c[0] - s1) % T + T) % T) : (((s1 - c[0]) % T + T) % T), p: c[1] })).filter(c => c.d > EPS && c.d < dist - EPS).sort((p, q) => p.d - q.d);
    cs.forEach(c => out.push(c.p)); out.push(b); return out;
  }
  function shared(ra, rb) {
    const ov = (a0, a1, b0, b1) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return hi - lo >= 0.9 ? (lo + hi) / 2 : null; };
    let m;
    if (Math.abs(ra.x + ra.w - rb.x) < EPS && (m = ov(ra.y, ra.y + ra.d, rb.y, rb.y + rb.d)) != null) return [rb.x, m];
    if (Math.abs(rb.x + rb.w - ra.x) < EPS && (m = ov(ra.y, ra.y + ra.d, rb.y, rb.y + rb.d)) != null) return [ra.x, m];
    if (Math.abs(ra.y + ra.d - rb.y) < EPS && (m = ov(ra.x, ra.x + ra.w, rb.x, rb.x + rb.w)) != null) return [m, rb.y];
    if (Math.abs(rb.y + rb.d - ra.y) < EPS && (m = ov(ra.x, ra.x + ra.w, rb.x, rb.x + rb.w)) != null) return [m, ra.y];
    return null;
  }
  function endPath(h, o, zone) {
    const r = room(h, o.room), p = pos(h, o);
    if (o.face === 'C') {
      const dl = p[0] - r.x, dr = r.x + r.w - p[0], db = p[1] - r.y, dt = r.y + r.d - p[1], m = Math.min(dl, dr, db, dt);
      const q = m === dl ? [r.x, p[1]] : m === dr ? [r.x + r.w, p[1]] : m === db ? [p[0], r.y] : [p[0], r.y + r.d];
      return { pts: [[p[0], p[1], h.h], [q[0], q[1], h.h], [q[0], q[1], zone]], at: q };
    }
    return { pts: [[p[0], p[1], p[2]], [p[0], p[1], zone]], at: [p[0], p[1]] };
  }
  /* Weg einer Leitung als 3D-Linienzug und Länge in Metern (mit 0,5 m Reserve) */
  function route(h, c) {
    const a = obj(h, c.a), b = obj(h, c.b); if (!a || !b) return { ok: false, why: 'Objekt fehlt', pts: [], len: 0 };
    const za = a.face === 'C' ? h.h : a.z, zb = b.face === 'C' ? h.h : b.z;
    const zones = [0.3, 1.05, h.h - 0.3]; let zone = zones[0], best = 1e9;
    zones.forEach(z => { const t = Math.abs(za - z) + Math.abs(zb - z); if (t < best) { best = t; zone = z; } });
    const ra = room(h, a.room), rb = room(h, b.room), ea = endPath(h, a, zone), eb = endPath(h, b, zone);
    let pts, extra = 0;
    const at = (xy) => [xy[0], xy[1], zone];
    if (a.room === b.room) pts = ea.pts.concat(walk(ra, ea.at, eb.at).slice(1).map(at), eb.pts.slice().reverse());
    else {
      const m = shared(ra, rb); if (!m) return { ok: false, why: 'Die Räume grenzen nicht aneinander. Führe die Leitung über einen Zwischenraum (Abzweigdose).', pts: [], len: 0 };
      pts = ea.pts.concat(walk(ra, ea.at, m).slice(1).map(at), walk(rb, m, eb.at).map(at), eb.pts.slice().reverse()); extra = 0.3;
    }
    let len = extra + 0.5;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    return { ok: true, pts, len };
  }

  /* ---------------- Modell -> Stromkreis ---------------- */
  /* Jede Leitung besteht aus drei Adern (L, N, PE) mit Querschnitt und berechneter Länge. Zeilen: {k, v, pins:[Netz-Nummern], o:{sw, hx, defect}} */
  function buildNet(h) {
    const rows = [], warn = []; let nn = 0; const net = () => ++nn;
    const add = (k, v, pins, o) => { rows.push({ k, v, pins, o: o || {} }); return rows.length - 1; };
    const L = [net(), net(), net()], N0 = net(), PE0 = net();
    add('NETZ3', '400V', [L[0], L[1], L[2], N0, PE0], { hx: { role: 'netz' } });
    const P = h.panel || newHouse().panel, grp = [{ L, N: N0 }];
    [0, 1].forEach(g => { const f = P.fi[g]; if (f && f.type) { const Lg = [net(), net(), net()], Ng = net(); add('RCD4', f.type, [L[0], L[1], L[2], N0, Lg[0], Lg[1], Lg[2], Ng], { sw: f.on === 0 ? 0 : 1, hx: { role: 'rcd', g } }); grp[g + 1] = { L: Lg, N: Ng }; } });
    const roots = [];
    P.slots.forEach((s, i) => {
      if (!s || !s.ls) return; const g = s.fi > 0 && grp[s.fi] ? grp[s.fi] : grp[0], sw = s.on === 0 ? 0 : 1;
      if (s.p3) { const Lc = [net(), net(), net()]; [0, 1, 2].forEach(k => add('LSS', s.ls, [g.L[k], Lc[k]], { sw, hx: { role: 'lss', slot: i, k } })); roots[i] = { three: true, L: Lc, N: g.N, PE: PE0, ph: 0 }; }
      else { const ph = s.ph || ((i % 3) + 1), Lc = net(); add('LSS', s.ls, [g.L[ph - 1], Lc], { sw, hx: { role: 'lss', slot: i, k: 0 } }); roots[i] = { three: false, L: Lc, N: g.N, PE: PE0, ph }; }
    });
    const panel = h.objs.find(o => o.t === 'panel'), adj = {};
    h.cables.forEach(c => { (adj[c.a] = adj[c.a] || []).push(c); (adj[c.b] = adj[c.b] || []).push(c); });
    const visited = new Set(), powered = new Set(), up = {}, slotOf = {}, phOf = {}, cabPh = {}, cabUp3 = {}, objPick = {}; let curSlot = -1;
    const single = (Ln, Nn, Pn, ph) => ({ three: false, L: Ln, N: Nn, PE: Pn, ph });
    function cableParts(c, ups) {
      const r = route(h, c), v = c.s + 'mm2 ' + (r.ok ? r.len : 10).toFixed(1) + 'm', bad = c.bad ? 'open' : undefined; cabUp3[c.id] = !!ups.three;
      if (c.ph3) {
        if (!ups.three) { warn.push('Eine Drehstromleitung braucht eine Drehstrom-Speisung (dreipoliger Abgang)'); return null; }
        const Ls = [net(), net(), net()], Nn = net(), Pn = net();
        ['L1', 'L2', 'L3'].forEach((w, k) => add('CABLE', v, [ups.L[k], Ls[k]], { hx: { role: 'cab', c: c.id, w }, defect: k === 0 ? bad : undefined }));
        add('CABLE', v, [ups.N, Nn], { hx: { role: 'cab', c: c.id, w: 'N' } }); add('CABLE', v, [ups.PE, Pn], { hx: { role: 'cab', c: c.id, w: 'PE' } });
        cabPh[c.id] = 3; return { three: true, L: Ls, N: Nn, PE: Pn, ph: 0 };
      }
      const ph = ups.three ? (c.pi || 1) : ups.ph, Lin = ups.three ? ups.L[ph - 1] : ups.L, Ln = net(), Nn = net(), Pn = net();
      add('CABLE', v, [Lin, Ln], { hx: { role: 'cab', c: c.id, w: 'L' }, defect: bad });
      add('CABLE', v, [ups.N, Nn], { hx: { role: 'cab', c: c.id, w: 'N' } }); add('CABLE', v, [ups.PE, Pn], { hx: { role: 'cab', c: c.id, w: 'PE' } });
      cabPh[c.id] = ph; return single(Ln, Nn, Pn, ph);
    }
    function down(o, nets, via, skip) {
      const kids = (adj[o.id] || []).filter(c => c !== via && c !== skip);
      kids.forEach(c => {
        const other = obj(h, c.a === o.id ? c.b : c.a); if (!other || other.t === 'panel') return;
        if (!route(h, c).ok) { warn.push('Leitung zu ' + objName(h, other) + ' erreicht den Raum nicht'); return; }
        if (visited.has(other.id)) { warn.push('Leitung führt im Kreis (Ring): ' + objName(h, other)); return; }
        arrive(other, c, nets, o);
      });
    }
    function arrive(o, c, ups, from) {
      const needs3 = o.t === 'dev3' || o.t === 'sock3';
      if (needs3 && !(c.ph3 && ups.three)) { warn.push(objName(h, o) + ' braucht eine Drehstromleitung (5-adrig) an einem dreipoligen Abgang'); return; }
      let n = cableParts(c, ups); if (!n) return;
      visited.add(o.id); powered.add(o.id); slotOf[o.id] = curSlot; up[o.id] = c.id;
      if (n.three && !needs3 && o.t !== 'junc') { const pi = o.ph || 1; n = single(n.L[pi - 1], n.N, n.PE, pi); objPick[o.id] = true; }
      phOf[o.id] = needs3 ? 0 : n.ph; let dn = n;
      const mk1 = (L1, nn_, pe_, ph_) => ({ three: false, L: L1, N: nn_, PE: pe_, ph: ph_ });
      if (o.t === 'lamp') add('LAMP', '230V ' + (o.w || 60) + 'W', [n.L, n.N], { hx: { role: 'lamp', o: o.id } });
      else if (o.t === 'swi') { const Lo = net(); add('SPST', '', [n.L, Lo], { sw: o.on ? 1 : 0, hx: { role: 'sw', o: o.id } }); dn = mk1(Lo, n.N, n.PE, n.ph); }
      else if (o.t === 'sock' || o.t === 'dev') {
        add('SD', '0W', [n.L, n.N, n.PE], { sw: o.f ? 1 : 0, hx: { role: 'sd', o: o.id } });
        if (o.w > 0) { const Ld = net(); add('SPST', '', [n.L, Ld], { sw: o.on === 0 ? 0 : 1, hx: { role: 'dev', o: o.id } }); add('SD', o.w + 'W', [Ld, n.N, n.PE], { sw: 0, hx: { role: 'devR', o: o.id } }); }
      } else if (needs3) {
        add('SD', '0W', [n.L[0], n.N, n.PE], { sw: o.f ? 1 : 0, hx: { role: 'sd', o: o.id } });
        if (o.w > 0) {
          const Ld = [net(), net(), net()]; [0, 1, 2].forEach(k => add('SPST', '', [n.L[k], Ld[k]], { sw: o.on === 0 ? 0 : 1, hx: { role: 'dev', o: o.id, k } }));
          if (o.motor) add('MOTOR3', '400V ' + o.w + 'W', [Ld[0], Ld[1], Ld[2], n.PE], { hx: { role: 'motor', o: o.id } });
          else [0, 1, 2].forEach(k => add('SD', (o.w / 3) + 'W', [Ld[k], n.N, n.PE], { sw: 0, hx: { role: 'devR', o: o.id, k } }));
        }
      } else if (o.t === 'swc') {
        const partner = o.partner && obj(h, o.partner), pc = partner && (adj[o.id] || []).find(x => x !== c && (x.a === partner.id || x.b === partner.id));
        if (partner && pc && !visited.has(partner.id)) {
          const T1 = net(), T2 = net(); add('SPDT', '', [n.L, T1, T2], { sw: o.on ? 1 : 0, hx: { role: 'swc', o: o.id } });
          visited.add(partner.id); powered.add(partner.id); slotOf[partner.id] = curSlot; phOf[partner.id] = n.ph; up[partner.id] = pc.id;
          const r = route(h, pc), v = pc.s + 'mm2 ' + (r.ok ? r.len : 10).toFixed(1) + 'm', T1b = net(), T2b = net(), Nb = net(), Pb = net(), Lo = net(); cabPh[pc.id] = n.ph; cabUp3[pc.id] = false;
          add('CABLE', v, [T1, T1b], { hx: { role: 'cab', c: pc.id, w: 'T1' }, defect: pc.bad ? 'open' : undefined }); add('CABLE', v, [T2, T2b], { hx: { role: 'cab', c: pc.id, w: 'T2' } });
          add('CABLE', v, [n.N, Nb], { hx: { role: 'cab', c: pc.id, w: 'N' } }); add('CABLE', v, [n.PE, Pb], { hx: { role: 'cab', c: pc.id, w: 'PE' } });
          add('SPDT', '', [Lo, T1b, T2b], { sw: partner.on ? 1 : 0, hx: { role: 'swc', o: partner.id } });
          down(partner, mk1(Lo, Nb, Pb, n.ph), pc); down(o, mk1(n.L, n.N, n.PE, n.ph), c, pc);
          return;
        }
        const Lo = net(); add('SPDT', '', [n.L, Lo, net()], { sw: o.on ? 1 : 0, hx: { role: 'swc', o: o.id } }); dn = mk1(Lo, n.N, n.PE, n.ph);
      }
      down(o, dn, c);
    }
    if (panel) {
      visited.add(panel.id);
      h.cables.forEach(c => { if ((c.a === panel.id || c.b === panel.id) && c.slot != null) { const other = obj(h, c.a === panel.id ? c.b : c.a); if (!other) return; if (!roots[c.slot]) { warn.push('Abgang ' + (c.slot + 1) + ' hat keinen Sicherungsautomaten'); return; } if (!route(h, c).ok) { warn.push('Leitung zu ' + objName(h, other) + ' erreicht den Raum nicht'); return; } if (visited.has(other.id)) { warn.push('Leitung führt im Kreis'); return; } curSlot = c.slot; arrive(other, c, roots[c.slot], panel); } });
    } else if (h.cables.length) warn.push('Kein Verteilerkasten im Haus');
    return { rows, warn, powered, slotOf, phOf, cabPh, cabUp3, objPick };
  }
  function compile(h) {
    const B = buildNet(h), api = root.LabDigiAPI, K = api.KINDS;
    const rows = B.rows.map((r, i) => [r.k, (i % 24) * 14 + 2, Math.floor(i / 24) * 14 + 2, 0, r.v === '' ? K[r.k].v : r.v]);
    const pins = api.pinPts(rows), parts = [], wires = []; let id = 1;
    const hub = n => [3000 + n * 2, 3000];
    B.rows.forEach((r, i) => {
      const [k, x, y, , v] = rows[i], p = Object.assign({ id: id++, k, x, y, r: 0, v, sw: r.o.sw != null ? r.o.sw : (K[k].sw0 || 0), pos: 0.5, vr: K[k].vr }, r.o.defect ? { defect: r.o.defect } : {}, { hx: r.o.hx });
      parts.push(p);
      pins[i].forEach((pt, j) => { const hb = hub(r.pins[j]); wires.push({ id: 0, x1: pt[0], y1: pt[1], x2: hb[0], y2: hb[1] }); });
    });
    wires.forEach(w => { w.id = id++; });
    return { parts, wires, nid: id, warn: B.warn, powered: B.powered, slotOf: B.slotOf, phOf: B.phOf, cabPh: B.cabPh, cabUp3: B.cabUp3, objPick: B.objPick };
  }
  let lastWarn = [], poweredSet = new Set(), lastInfo = { cabPh: {}, cabUp3: {}, objPick: {}, phOf: {} };
  root.HAUS_COMPILE = function (sch) {
    syncModel(sch);
    const r = compile(sch.haus); sch.parts = r.parts; sch.wires = r.wires; sch.nid = r.nid; lastWarn = r.warn; poweredSet = r.powered; lastInfo = r;
  };
  /* Schalterstellungen aus den Bauteilen ins Modell übernehmen (Betrieb, Auslösungen) */
  function syncModel(sch) {
    const h = sch.haus; if (!h || !sch.parts) return;
    sch.parts.forEach(p => {
      const x = p.hx; if (!x) return;
      if (x.role === 'lss') { const s = h.panel.slots[x.slot]; if (s) s.on = p.sw ? 1 : 0; }
      else if (x.role === 'rcd') { const f = h.panel.fi[x.g]; if (f) f.on = p.sw ? 1 : 0; }
      else { const o = x.o != null ? obj(h, x.o) : null; if (!o) return; if (x.role === 'sw' || x.role === 'swc') o.on = p.sw ? 1 : 0; else if (x.role === 'dev') o.on = p.sw ? 1 : 0; else if (x.role === 'sd') o.f = p.sw ? 1 : 0; }
    });
  }

  root.HAUS_DEF = function (api) {
    const S = () => api.sch, H = () => api.sch.haus;
    /* ---------------- Ansicht ---------------- */
    const cam = { yaw: 0.62, pitch: 0.62, s: 30, ox: 0, oy: 0, cx: 4, cy: 4 };
    const stt = { tool: 'sel', place: null, cabA: null, sel: null, hover: null, drag: null, pan: null, rubber: null, ptrs: new Map(), pinch: null, top: false, dev: DEVS[0], dev3: DEV3[0] };
    const proj = (x, y, z) => { const dx = x - cam.cx, dy = y - cam.cy, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw), xr = dx * c - dy * s, yr = dx * s + dy * c; return [cam.ox + xr * cam.s, cam.oy - (z * Math.cos(cam.pitch) + yr * Math.sin(cam.pitch)) * cam.s, yr]; };
    const nyr = (nx, ny) => nx * Math.sin(cam.yaw) + ny * Math.cos(cam.yaw);
    const topView = () => cam.pitch > 1.4;
    /* Bildschirmpunkt -> Welt auf einer Ebene */
    function unplane(sx, sy, plane) {
      const xr = (sx - cam.ox) / cam.s, t = (cam.oy - sy) / cam.s, cy = Math.cos(cam.yaw), sy_ = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const back = (yr, dx, dy) => [dx + cam.cx, dy + cam.cy];
      if (plane.z != null) { if (sp < 0.15) return null; const yr = (t - plane.z * cp) / sp, dx = xr * cy + yr * sy_, dy = -xr * sy_ + yr * cy; return { x: dx + cam.cx, y: dy + cam.cy, z: plane.z, yr }; }
      if (plane.x != null) { const k = plane.x - cam.cx; if (Math.abs(sy_) < 0.12) return null; const yr = (k - xr * cy) / sy_, dy = -xr * sy_ + yr * cy, z = (t - yr * sp) / (cp < 0.05 ? 0.05 : cp); return { x: plane.x, y: dy + cam.cy, z, yr }; }
      const k = plane.y - cam.cy; if (Math.abs(cy) < 0.12) return null; const yr = (k + xr * sy_) / cy, dx = xr * cy + yr * sy_, z = (t - yr * sp) / (cp < 0.05 ? 0.05 : cp); return { x: dx + cam.cx, y: plane.y, z, yr };
    }
    root.HAUS_FIT = function () {
      const h = H(); if (!h) return; stt.userCam = false; const b = bounds(h), r = api.rectOf();
      cam.cx = (b.x0 + b.x1) / 2; cam.cy = (b.y0 + b.y1) / 2; const wx = b.x1 - b.x0, wy = b.y1 - b.y0, span = Math.hypot(wx, wy) + 1;
      cam.s = clamp(Math.min(r.width, r.height * 1.25) / (span * 1.15), 8, 80); cam.ox = r.width / 2; cam.oy = r.height * 0.58;
    };
    const turn = d => { cam.yaw += d * Math.PI / 2; stt.userCam = true; api.draw(); };
    const toggleTop = () => { stt.top = !stt.top; cam.pitch = stt.top ? 1.5 : 0.62; api.draw(); api.refreshUI(); };
    const zoom = (f, x, y) => { stt.userCam = true; const r = api.rectOf(), px = x == null ? r.width / 2 : x, py = y == null ? r.height / 2 : y, ns = clamp(cam.s * f, 8, 90); cam.ox = px - (px - cam.ox) * ns / cam.s; cam.oy = py - (py - cam.oy) * ns / cam.s; cam.s = ns; api.draw(); };

    /* ---------------- Auswahl und Änderungen ---------------- */
    const apply = (keepSel) => { const sch = S(); const r = compile(sch.haus); sch.parts = r.parts; sch.wires = r.wires; sch.nid = r.nid; lastWarn = r.warn; poweredSet = r.powered; lastInfo = r; api.commit(); };
    const isSim = () => api.simMode;
    const selObj = () => stt.sel && stt.sel.t === 'obj' ? obj(H(), stt.sel.id) : null;
    const selCab = () => stt.sel && stt.sel.t === 'cab' ? cab(H(), stt.sel.id) : null;
    const selRoom = () => stt.sel && stt.sel.t === 'room' ? room(H(), stt.sel.id) : null;
    const partOf = (oid, role) => S().parts.find(p => p.hx && p.hx.o === oid && p.hx.role === role);
    const cabParts = cid => S().parts.filter(p => p.hx && p.hx.role === 'cab' && p.hx.c === cid);

    /* ---------------- Rechnen im Betrieb: Effektivwerte je Schritt ---------------- */
    const rms = {};   // partId -> {u2, i2, p}
    /* dreipolige Automaten löschen gemeinsam aus */
    let gang = { src: null, groups: [] };
    const gangCheck = () => {
      const ps = S().parts;
      if (gang.src !== ps) { const m = {}; ps.forEach(p => { if (p.hx && p.hx.role === 'lss') (m[p.hx.slot] = m[p.hx.slot] || []).push(p); }); gang = { src: ps, groups: Object.values(m).filter(g => g.length > 1) }; }
      gang.groups.forEach(g => { if (g.some(p => !p.sw) && g.some(p => p.sw)) g.forEach(p => { if (p.sw) api.setSw(p.id, 0); }); });
    };
    root.LAB_STEP = dt => {
      if (!api.sim || !api.circ) return;
      gangCheck();
      const al = Math.min(1, dt / 0.04);
      S().parts.forEach(p => {
        if (!p.hx || !['lamp', 'sd', 'devR', 'cab', 'lss', 'motor'].includes(p.hx.role) || (p.hx.role === 'cab' && !['L', 'L1', 'T1'].includes(p.hx.w)) || (p.hx.role === 'lss' && p.hx.k > 0)) return;
        const [v, i] = api.scopeValues({ t: 'part', id: p.id }); if (!isFinite(v)) return;
        let r = rms[p.id]; if (!r) r = rms[p.id] = { u2: 0, i2: 0, p: 0 };
        r.u2 += al * (v * v - r.u2); const ii = isFinite(i) ? i : 0; r.i2 += al * (ii * ii - r.i2); r.p += al * (v * ii - r.p);
      });
    };
    const U = pid => { const r = rms[pid]; return r ? Math.sqrt(Math.max(r.u2, 0)) : 0; };
    const I = pid => { const r = rms[pid]; return r ? Math.sqrt(Math.max(r.i2, 0)) : 0; };

    /* ---------------- Zeichnen ---------------- */
    let hits = [], cabHits = [], roomHits = [];
    const WALLC = ['#c9d3de', '#b4c0cd', '#d6dde5', '#a9b6c4'];
    function drawLamp(cx, x, y, k, b) {
      if (b > 0.02) { const g = cx.createRadialGradient(x, y, 1, x, y, k * 4.5); g.addColorStop(0, 'rgba(255,230,120,' + Math.min(.85, b * .85) + ')'); g.addColorStop(1, 'rgba(255,230,120,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, k * 4.5, 0, 7); cx.fill(); }
      cx.fillStyle = b > 0.2 ? '#fff3b0' : '#e7e2c6'; cx.strokeStyle = '#4a4a3a'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x, y, k * .8, 0, 7); cx.fill(); cx.stroke();
      cx.beginPath(); cx.moveTo(x - k * .55, y - k * .55); cx.lineTo(x + k * .55, y + k * .55); cx.moveTo(x + k * .55, y - k * .55); cx.lineTo(x - k * .55, y + k * .55); cx.stroke();
    }
    function drawObj(cx, o, h, k, sim) {
      const p = pos(h, o), q = proj(p[0], p[1], p[2]), x = q[0], y = q[1];
      const sel = stt.sel && stt.sel.t === 'obj' && stt.sel.id === o.id, cabA = stt.cabA === o.id, hov = stt.hover === o.id;
      const live = sim && api.circ;
      let b = 0, uTxt = '';
      const lp = partOf(o.id, 'lamp'), dp = partOf(o.id, 'devR'), mp = partOf(o.id, 'motor');
      if (live && lp) { const e = api.circ.elems.find(el => el.part && el.part.id === lp.id && el.lamp); b = e ? clamp((e.pav || 0) / e.lamp, 0, 1.2) : 0; }
      else if (live && dp) b = I(dp.id) > 0.05 ? 1 : 0;
      else if (live && mp) b = I(mp.id) > 0.05 ? 1 : 0;
      const connected = poweredSet.has(o.id) || o.t === 'panel';
      cx.save();
      if (o.t === 'lamp') { drawLamp(cx, x, y, k, b); if (!connected && !sim) { cx.strokeStyle = '#ff8a5c'; cx.setLineDash([3, 3]); cx.beginPath(); cx.arc(x, y, k * 1.1, 0, 7); cx.stroke(); } }
      else if (o.t === 'panel') {
        const w = k * 1.5, hh = k * 2; cx.fillStyle = '#7d8793'; cx.strokeStyle = '#2a323b'; cx.lineWidth = 2; cx.fillRect(x - w / 2, y - hh / 2, w, hh); cx.strokeRect(x - w / 2, y - hh / 2, w, hh);
        cx.fillStyle = '#e8eaed'; for (let i = 0; i < 4; i++) cx.fillRect(x - w / 2 + 3 + (i % 2) * (w / 2 - 2), y - hh / 2 + 4 + Math.floor(i / 2) * hh * .38, w / 2 - 6, hh * .3);
      } else {
        const w = k * 1.5; cx.fillStyle = o.t === 'junc' ? '#a8744c' : '#f2f4f6'; cx.strokeStyle = '#2a323b'; cx.lineWidth = 1.5; cx.beginPath(); (cx.roundRect ? cx.roundRect(x - w / 2, y - w / 2, w, w, 3) : cx.rect(x - w / 2, y - w / 2, w, w)); cx.fill(); cx.stroke();
        cx.fillStyle = '#2a323b';
        if (o.t === 'sock') { cx.beginPath(); cx.arc(x - w * .18, y, w * .09, 0, 7); cx.arc(x + w * .18, y, w * .09, 0, 7); cx.fill(); cx.beginPath(); cx.arc(x, y, w * .3, 0, 7); cx.stroke(); }
        else if (o.t === 'swi' || o.t === 'swc') { cx.fillStyle = o.on ? '#4cd964' : '#8a949f'; cx.fillRect(x - w * .22, y - w * .32 + (o.on ? 0 : w * .32), w * .44, w * .32); if (o.t === 'swc') { cx.fillStyle = '#2a323b'; cx.font = '700 ' + Math.round(k * .7) + 'px sans-serif'; cx.textAlign = 'center'; cx.fillText('W', x, y + w * .08); } }
        else if (o.t === 'dev') { cx.fillStyle = b > 0.2 ? '#ff7a45' : '#b8a69a'; cx.fillRect(x - w * .4, y - w * .3, w * .8, w * .6); if (b > 0.2) { cx.fillStyle = 'rgba(255,120,60,.35)'; cx.beginPath(); cx.arc(x, y, w * 1.1, 0, 7); cx.fill(); } }
        if (o.t === 'dev3' || o.t === 'sock3') {
          cx.fillStyle = o.t === 'sock3' ? '#c0392b' : (b > 0.2 ? '#ff7a45' : '#b8a69a'); if (o.t === 'sock3') { cx.beginPath(); cx.arc(x, y, w * .42, 0, 7); cx.fill(); } else cx.fillRect(x - w * .42, y - w * .34, w * .84, w * .68);
          cx.fillStyle = '#fff'; cx.font = '700 ' + Math.round(k * .75) + 'px sans-serif'; cx.textAlign = 'center'; cx.fillText('3~', x, y + k * .27);
          if (b > 0.2) { cx.fillStyle = 'rgba(255,120,60,.35)'; cx.beginPath(); cx.arc(x, y, w * 1.1, 0, 7); cx.fill(); }
        }
        if (o.t === 'sock' && o.w > 0 && (!live || b > 0.2)) { cx.fillStyle = b > 0.2 ? '#ff7a45' : '#8a949f'; cx.fillRect(x + w * .55, y - w * .2, w * .4, w * .4); }
        if (o.f && sim) { cx.fillStyle = '#ff4d4d'; cx.font = '700 ' + Math.round(k * 1.1) + 'px sans-serif'; cx.textAlign = 'center'; cx.fillText('⚡', x + w * .75, y - w * .5); }
        if (!connected && !sim && o.t !== 'junc') { cx.strokeStyle = '#ff8a5c'; cx.lineWidth = 1.5; cx.setLineDash([3, 3]); cx.strokeRect(x - w * .75, y - w * .75, w * 1.5, w * 1.5); }
      }
      cx.restore();
      if (sel || cabA || hov) { cx.strokeStyle = cabA ? '#ffb340' : sel ? '#3b9eff' : 'rgba(255,255,255,.7)'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, y, k * 1.35, 0, 7); cx.stroke(); }
      {
        const lab = objName(h, o) + (o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3' ? (o.w ? ' ' + o.w + ' W' : '') : o.t === 'lamp' ? ' ' + (o.w || 60) + ' W' : '');
        let u = ''; const measurable = o.t === 'lamp' || o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3';
        if (live && measurable) { const sd = partOf(o.id, 'sd') || partOf(o.id, 'lamp'); if (sd && poweredSet.has(o.id)) u = Math.round(U(sd.id)) + ' V'; else u = 'ohne Spannung'; }
        const t = (sel || hov) ? (u ? lab + ' · ' + u : lab) : (live ? u : '');
        if (t && !(live && !sel && !hov && o.t === 'lamp' && b > 0.2)) { cx.font = '600 ' + Math.max(10, Math.round(k * .62)) + 'px sans-serif'; cx.textAlign = 'center'; const tw = cx.measureText(t).width + 8; cx.fillStyle = 'rgba(14,17,21,.82)'; cx.fillRect(x - tw / 2, y + k * 1.2, tw, k * .9); cx.fillStyle = u === 'ohne Spannung' ? '#ffb340' : '#e8ecf0'; cx.fillText(t, x, y + k * 1.2 + k * .66); }
      }
      hits.push({ id: o.id, x, y, r: Math.max(k * 1.3, 11) });
    }
    const PHCOL = { 1: '#a0662b', 2: '#5a6068', 3: '#8f98a3' };
    function cabColor(c, sim) {
      if (!sim || !api.circ) { const ph = lastInfo.cabPh[c.id]; return ph === 3 ? '#d96a5b' : ph ? PHCOL[ph] : (c.s >= 2.5 ? '#d9a441' : '#8fb4d9'); }
      const ps = cabParts(c.id).filter(p => ['L', 'L1', 'L2', 'L3', 'T1'].includes(p.hx.w)); if (!ps.length) return '#667';
      const iz = root.LochSim.cableOf(ps[0].v).iz, ratio = Math.max(...ps.map(p => I(p.id))) / iz;
      return ratio > 1 ? '#ff4d4d' : ratio > 0.6 ? '#ffb340' : ratio > 0.02 ? '#5ee27d' : '#7d8793';
    }
    root.HAUS_RENDER = function (cx, W, Ht) {
      const h = H(); hits = []; cabHits = []; roomHits = [];
      if (!h) return; syncModel(S());
      const sim = isSim() && !!api.circ, k = clamp(cam.s * 0.42, 7, 24), top = topView();
      // Raster am Boden
      cx.fillStyle = '#0d1217'; cx.fillRect(0, 0, W, Ht);
      const rs = h.rooms.map(r => ({ r, d: proj(r.x + r.w / 2, r.y + r.d / 2, 0)[2] })).sort((a, b) => b.d - a.d);
      // Böden
      rs.forEach(({ r }) => {
        const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].map(p => proj(p[0], p[1], 0));
        cx.beginPath(); pts.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.closePath(); cx.fillStyle = r.c || '#33404d'; cx.fill();
        cx.strokeStyle = 'rgba(255,255,255,.08)'; cx.lineWidth = 1; for (let gx = Math.ceil(r.x); gx < r.x + r.w; gx++) { const a = proj(gx, r.y, 0), b = proj(gx, r.y + r.d, 0); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
        for (let gy = Math.ceil(r.y); gy < r.y + r.d; gy++) { const a = proj(r.x, gy, 0), b = proj(r.x + r.w, gy, 0); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
        roomHits.push({ id: r.id, pts });
      });
      // Wände und Objekte je Raum von hinten nach vorn
      rs.forEach(({ r }) => {
        const faces = [['S', [r.x, r.y], [r.x + r.w, r.y], 0, 1], ['E', [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], -1, 0], ['N', [r.x + r.w, r.y + r.d], [r.x, r.y + r.d], 0, -1], ['W', [r.x, r.y + r.d], [r.x, r.y], 1, 0]];
        const front = [];
        faces.forEach(([f, a, b, nx, ny], i) => {
          const vis = !top && nyr(nx, ny) < -0.15;
          if (vis) {
            const pts = [proj(a[0], a[1], 0), proj(b[0], b[1], 0), proj(b[0], b[1], h.h), proj(a[0], a[1], h.h)];
            cx.beginPath(); pts.forEach((p, j) => (j ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.closePath(); cx.fillStyle = WALLC[i]; cx.globalAlpha = .93; cx.fill(); cx.globalAlpha = 1; cx.strokeStyle = '#5b6672'; cx.lineWidth = 1.5; cx.stroke();
            // Installationszonen andeuten
            if (cam.s > 24) { cx.strokeStyle = 'rgba(40,60,90,.18)'; cx.setLineDash([4, 4]); [0.3, 1.05, h.h - 0.3].forEach(z => { const p1 = proj(a[0], a[1], z), p2 = proj(b[0], b[1], z); cx.beginPath(); cx.moveTo(p1[0], p1[1]); cx.lineTo(p2[0], p2[1]); cx.stroke(); }); cx.setLineDash([]); }
          } else front.push([a, b]);
        });
        // Raumname auf dem Boden
        const c = proj(r.x + r.w / 2, r.y + r.d / 2, 0.02); cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = '600 ' + clamp(Math.round(cam.s * .45), 10, 18) + 'px sans-serif'; cx.textAlign = 'center'; cx.fillText(r.n, c[0], c[1]);
        h.objs.filter(o => o.room === r.id && o.t !== 'lamp').forEach(o => drawObj(cx, o, h, k, sim));
        // vordere Wände: nur Kante und niedriger Sockel (Durchsicht)
        front.forEach(([a, b]) => { const pts = [proj(a[0], a[1], 0), proj(b[0], b[1], 0), proj(b[0], b[1], 0.25), proj(a[0], a[1], 0.25)]; cx.beginPath(); pts.forEach((p, j) => (j ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.closePath(); cx.fillStyle = 'rgba(180,195,210,.35)'; cx.fill(); cx.strokeStyle = 'rgba(210,220,232,.7)'; cx.lineWidth = 1.5; cx.stroke(); const t1 = proj(a[0], a[1], h.h), t2 = proj(b[0], b[1], h.h); cx.strokeStyle = 'rgba(210,220,232,.35)'; cx.beginPath(); cx.moveTo(t1[0], t1[1]); cx.lineTo(t2[0], t2[1]); cx.stroke(); });
        if (top) { const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].map(p => proj(p[0], p[1], 0)); cx.beginPath(); pts.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.closePath(); cx.strokeStyle = '#d6dde5'; cx.lineWidth = 3; cx.stroke(); }
      });
      // Leitungen
      h.cables.forEach(c => {
        const r = route(h, c); if (!r.ok) return; const pp = r.pts.map(p => proj(p[0], p[1], p[2]));
        const col = cabColor(c, sim), sel = stt.sel && stt.sel.t === 'cab' && stt.sel.id === c.id;
        cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 2 + c.s * .55 + 2; cx.beginPath(); pp.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.stroke();
        cx.strokeStyle = sel ? '#3b9eff' : col; cx.lineWidth = 1.5 + c.s * .55; cx.beginPath(); pp.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.stroke();
        if (c.bad && !sim) { /* defekte Leitung bleibt unsichtbar markiert */ }
        cabHits.push({ id: c.id, pp });
      });
      // Deckenlampen zuletzt (hängen über allem)
      h.objs.filter(o => o.t === 'lamp').forEach(o => drawObj(cx, o, h, k, sim));
      // Vorschau
      if (stt.rubber) { const a = stt.rubber, pts = [[a.x0, a.y0], [a.x1, a.y0], [a.x1, a.y1], [a.x0, a.y1]].map(p => proj(p[0], p[1], 0)); cx.beginPath(); pts.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]))); cx.closePath(); cx.fillStyle = 'rgba(59,158,255,.25)'; cx.fill(); cx.strokeStyle = '#3b9eff'; cx.lineWidth = 2; cx.stroke(); cx.fillStyle = '#fff'; cx.font = '700 13px sans-serif'; cx.textAlign = 'center'; const c = proj((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, 0); cx.fillText(num(Math.abs(a.x1 - a.x0), 1) + ' × ' + num(Math.abs(a.y1 - a.y0), 1) + ' m', c[0], c[1]); }
      if (stt.ghost) { const g = stt.ghost; const o = g.o, p = pos(h, Object.assign({ room: g.room }, o)); const q = proj(p[0], p[1], p[2]); cx.globalAlpha = .6; cx.fillStyle = '#3b9eff'; cx.beginPath(); cx.arc(q[0], q[1], k, 0, 7); cx.fill(); cx.globalAlpha = 1; }
      if (stt.cabA) { const a = obj(h, stt.cabA); if (a) { const p = pos(h, a), q = proj(p[0], p[1], p[2]); cx.fillStyle = '#ffb340'; cx.font = '600 13px sans-serif'; cx.textAlign = 'left'; cx.fillText('Leitung von ' + objName(h, a) + ' … Ziel antippen', 12, Ht - 16); } }
      // Hinweise
      cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = '12px sans-serif'; cx.textAlign = 'left';
      if (!h.rooms.length) { cx.fillStyle = 'rgba(255,255,255,.8)'; cx.font = '16px sans-serif'; cx.textAlign = 'center'; cx.fillText('Noch leer: Wähle unten „Raum“ und ziehe ein Rechteck auf, oder lade ein Haus über „Beispiele“.', W / 2, Ht / 2); }
      if (lastWarn.length && !sim) { cx.fillStyle = '#ffb340'; cx.font = '600 12px sans-serif'; cx.textAlign = 'left'; lastWarn.slice(0, 3).forEach((t, i) => cx.fillText('⚠ ' + t, 12, 20 + i * 16)); }
    };
    root.HAUS_WHEEL = e => { const r = api.rectOf(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); return true; };

    /* ---------------- Zeigen und Treffen ---------------- */
    function hitObj(x, y) { let best = null, bd = 1e9; hits.forEach(h0 => { const d = Math.hypot(h0.x - x, h0.y - y); if (d < h0.r && d < bd) { bd = d; best = h0.id; } }); return best; }
    function hitCab(x, y) {
      let best = null, bd = 7;
      cabHits.forEach(c => { for (let i = 1; i < c.pp.length; i++) { const a = c.pp[i - 1], b = c.pp[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1), d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y); if (d < bd) { bd = d; best = c.id; } } });
      return best;
    }
    function hitRoom(x, y) { for (let i = roomHits.length - 1; i >= 0; i--) { const pts = roomHits[i].pts; let ins = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { if ((pts[a][1] > y) !== (pts[b][1] > y) && x < (pts[b][0] - pts[a][0]) * (y - pts[a][1]) / (pts[b][1] - pts[a][1]) + pts[a][0]) ins = !ins; } if (ins) return roomHits[i].id; } return null; }
    const snap = (v, g) => Math.round(v / g) * g;
    /* Fläche unter dem Zeiger: Wand (für Schalter, Steckdosen, Geräte) oder Boden (für Deckenlampen) */
    function pick(sx, sy, type) {
      const h = H(); if (!h.rooms.length) return null;
      if (type === 'lamp') {
        const p = unplane(sx, sy, { z: 0 }); if (!p) return null;
        const r = h.rooms.find(r => p.x >= r.x + 0.2 && p.x <= r.x + r.w - 0.2 && p.y >= r.y + 0.2 && p.y <= r.y + r.d - 0.2); if (!r) return null;
        return { room: r.id, face: 'C', u: snap(p.x - r.x, 0.25), v: snap(p.y - r.y, 0.25), z: h.h };
      }
      if (topView()) {
        const p = unplane(sx, sy, { z: 0 }); if (!p) return null; let best = null, bd = 0.9;
        h.rooms.forEach(r => { [['S', Math.abs(p.y - r.y), p.x - r.x, r.w, p.y >= r.y - 0.9 && p.y <= r.y + 0.9], ['N', Math.abs(p.y - (r.y + r.d)), p.x - r.x, r.w], ['W', Math.abs(p.x - r.x), p.y - r.y, r.d], ['E', Math.abs(p.x - (r.x + r.w)), p.y - r.y, r.d]].forEach(([f, d, u, len]) => { if (d < bd && u > 0.2 && u < len - 0.2) { bd = d; best = { room: r.id, face: f, u: snap(u, 0.25), z: (TYPES[type] || {}).z || 1 }; } }); });
        return best;
      }
      let best = null;
      h.rooms.forEach(r => {
        [['S', { y: r.y }, 0, 1], ['N', { y: r.y + r.d }, 0, -1], ['W', { x: r.x }, 1, 0], ['E', { x: r.x + r.w }, -1, 0]].forEach(([f, pl, nx, ny]) => {
          if (nyr(nx, ny) >= -0.15) return; const p = unplane(sx, sy, pl); if (!p) return;
          const u = f === 'S' || f === 'N' ? p.x - r.x : p.y - r.y, len = f === 'S' || f === 'N' ? r.w : r.d;
          if (u < 0.2 || u > len - 0.2 || p.z < 0.05 || p.z > h.h - 0.05) return;
          if (!best || p.yr < best.yr) best = { yr: p.yr, room: r.id, face: f, u: snap(u, 0.25), z: snap(p.z, 0.05) };
        });
      });
      return best;
    }
    function newObj(t, pk) {
      const h = H(), T = TYPES[t], o = { id: nid(h), t, room: pk.room, face: pk.face, u: pk.u, z: t === 'lamp' ? h.h : (t === 'sock' || t === 'dev' || t === 'sock3' || t === 'dev3' ? T.z : (pk.z == null ? T.z : T.z)), on: t === 'swi' || t === 'swc' ? 0 : 1 };
      if (pk.face === 'C') o.v = pk.v;
      if (t === 'lamp') o.w = 60; if (t === 'dev') { o.n = stt.dev[0]; o.w = stt.dev[1]; } if (t === 'sock') o.w = 0;
      if (t === 'dev3') { o.n = stt.dev3[0]; o.w = stt.dev3[1]; if (stt.dev3[2]) o.motor = 1; } if (t === 'sock3') o.w = 0;
      return o;
    }
    function removeObj(id) { const h = H(); h.objs = h.objs.filter(o => o.id !== id); h.cables = h.cables.filter(c => c.a !== id && c.b !== id); h.objs.forEach(o => { if (o.partner === id) o.partner = null; }); }
    function addCable(a, b, slot) {
      const h = H(), A = obj(h, a), B = obj(h, b); if (!A || !B || a === b) return false;
      if (h.cables.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a))) { api.toast('Diese Leitung gibt es schon'); return false; }
      const probe = { a, b, s: 1.5 }, r = route(h, probe); if (!r.ok) { api.toast(r.why); return false; }
      const heavy = (o => o.t === 'sock' || (o.t === 'dev' && o.w > 800))(A) || (o => o.t === 'sock' || (o.t === 'dev' && o.w > 800))(B);
      const is3 = o => o.t === 'dev3' || o.t === 'sock3', pn = A.t === 'panel' ? A : (B.t === 'panel' ? B : null);
      const c = { id: nid(h), a, b, s: heavy || is3(A) || is3(B) ? 2.5 : 1.5 }; if (pn) c.slot = slot;
      if (is3(A) || is3(B) || (pn && h.panel.slots[slot] && h.panel.slots[slot].p3) || h.cables.some(x => x.ph3 && (x.a === a || x.b === a || x.a === b || x.b === b))) { if (is3(A) || is3(B) || (pn && h.panel.slots[slot] && h.panel.slots[slot].p3)) c.ph3 = 1; }
      if (A.t === 'swc' && B.t === 'swc' && !A.partner && !B.partner) { A.partner = B.id; B.partner = A.id; }
      h.cables.push(c); return c;
    }
    function chooseSlot(done) {
      const h = H(), used = new Set(h.cables.filter(c => c.slot != null).map(c => c.slot));
      root.LabUI.sheet('Abgang im Verteiler wählen', (b, close) => {
        b.innerHTML = '<p class="hint2" style="margin-top:0">Jede Leitung vom Verteiler geht von einem Sicherungsautomaten ab. Wähle den Abgang für diese Leitung. Ein Abgang ohne Automat bleibt ohne Strom.</p>' + h.panel.slots.map((s, i) => `<button class="row" data-s="${i}"><div class="grow"><b>Abgang ${i + 1}: ${s.ls ? s.ls : 'kein Automat'}</b><small>${used.has(i) ? 'schon belegt, die Leitung wird parallel angeschlossen' : 'frei'}</small></div></button>`).join('');
        b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); done(+r.dataset.s); });
      });
    }
    const partsOf = (oid, role) => S().parts.filter(p => p.hx && p.hx.o === oid && p.hx.role === role);
    function operate(o) {
      const h = H();
      if (o.t === 'swi' || o.t === 'swc') { o.on = o.on ? 0 : 1; const p = partOf(o.id, o.t === 'swi' ? 'sw' : 'swc'); if (p) { api.setSw(p.id, o.on); api.commit(true, true); } stat('hausSchalter', 1); }
      else if ((o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') && o.w > 0) { o.on = o.on === 0 ? 1 : 0; partsOf(o.id, 'dev').forEach(p => api.setSw(p.id, o.on)); api.commit(true, true); if (o.t === 'sock3' || o.t === 'dev3') stat('hausDrehstrom', 1); }
      api.refreshUI();
    }

    /* ---------------- Eingabe ---------------- */
    root.HAUS_PTR = function (e) {
      const r = api.rectOf(), p = { x: e.clientX - r.left, y: e.clientY - r.top }, h = H(); if (!h) return true;
      const pt = stt.ptrs;
      if (e.type === 'pointerdown') {
        if (e.pointerType === 'mouse' && e.button !== 0) return true;
        try { api.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        pt.set(e.pointerId, p);
        if (pt.size === 2) { const [a, b] = [...pt.values()]; stt.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; stt.drag = null; stt.pan = null; stt.rubber = null; return true; }
        down(p); return true;
      }
      if (e.type === 'pointermove') {
        if (!pt.has(e.pointerId)) { if (e.pointerType === 'mouse') { const id = hitObj(p.x, p.y); if (id !== stt.hover) { stt.hover = id; api.draw(); } if (stt.tool === 'place' && stt.place) { const pk = pick(p.x, p.y, stt.place); stt.ghost = pk ? { room: pk.room, o: pk } : null; api.draw(); } } return true; }
        pt.set(e.pointerId, p);
        if (stt.pinch && pt.size >= 2) { const [a, b] = [...pt.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; zoom(d / stt.pinch.d, c.x, c.y); cam.ox += c.x - stt.pinch.cx; cam.oy += c.y - stt.pinch.cy; stt.pinch = { d, cx: c.x, cy: c.y }; return true; }
        move(p); return true;
      }
      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        if (!pt.has(e.pointerId)) return true; pt.delete(e.pointerId); if (stt.pinch) { if (!pt.size) stt.pinch = null; return true; }
        up(p, e.type === 'pointercancel'); return true;
      }
      return true;
    };
    function down(p) {
      const h = H(), sim = isSim(); stt.moved = false; stt.start = p;
      const oid = hitObj(p.x, p.y);
      if (sim) { if (oid != null) { const o = obj(h, oid); stt.sel = { t: 'obj', id: oid }; operate(o); api.refreshUI(); api.draw(); } else { const cid = hitCab(p.x, p.y); stt.sel = cid ? { t: 'cab', id: cid } : null; stt.pan = { x: p.x, y: p.y, ox: cam.ox, oy: cam.oy }; api.refreshUI(); api.draw(); } return; }
      const tool = stt.tool;
      if (tool === 'sel') {
        if (oid != null) { stt.sel = { t: 'obj', id: oid }; stt.drag = { id: oid, moved: false, snapshot: JSON.stringify(h) }; }
        else { const cid = hitCab(p.x, p.y); if (cid) { stt.sel = { t: 'cab', id: cid }; } else { const rid = hitRoom(p.x, p.y); stt.sel = rid ? { t: 'room', id: rid } : null; stt.pan = { x: p.x, y: p.y, ox: cam.ox, oy: cam.oy }; } }
        api.refreshUI(); api.draw(); return;
      }
      if (tool === 'room') { const w = unplane(p.x, p.y, { z: 0 }); if (!w) return; stt.rubber = { x0: snap(w.x, 0.5), y0: snap(w.y, 0.5), x1: snap(w.x, 0.5), y1: snap(w.y, 0.5) }; api.draw(); return; }
      if (tool === 'place') {
        const pk = pick(p.x, p.y, stt.place); if (!pk) { api.toast(stt.place === 'lamp' ? 'Tippe auf den Boden eines Raumes: Die Lampe hängt darüber an der Decke' : 'Tippe auf eine Wand, die du siehst. Mit den Pfeilen unten drehst du das Haus'); return; }
        if (stt.place === 'panel' && h.objs.some(o => o.t === 'panel')) { api.toast('Es gibt schon einen Verteilerkasten (zum Verschieben antippen und ziehen)'); return; }
        const o = newObj(stt.place, pk); h.objs.push(o); stt.sel = { t: 'obj', id: o.id }; stat('hausObjekte', h.objs.length, 'max'); apply(); return;
      }
      if (tool === 'cable') {
        if (oid == null) { stt.cabA = null; api.draw(); return; }
        if (stt.cabA == null) { stt.cabA = oid; api.draw(); return; }
        const a = stt.cabA, b = oid; if (a === b) { stt.cabA = null; api.draw(); return; }
        const A = obj(h, a), B = obj(h, b), mk = slot => { const c = addCable(a, b, slot); stt.cabA = null; if (c) { stt.sel = { t: 'cab', id: c.id }; stat('hausLeitungen', h.cables.length, 'max'); apply(); } else api.draw(); };
        if (A.t === 'panel' || B.t === 'panel') chooseSlot(mk); else mk(null);
        return;
      }
      if (tool === 'del') {
        if (oid != null) { removeObj(oid); stt.sel = null; apply(); return; }
        const cid = hitCab(p.x, p.y); if (cid) { h.cables = h.cables.filter(c => c.id !== cid); stt.sel = null; apply(); return; }
        const rid = hitRoom(p.x, p.y); if (rid) { h.objs.filter(o => o.room === rid).forEach(o => removeObj(o.id)); h.rooms = h.rooms.filter(r => r.id !== rid); stt.sel = null; apply(); }
      }
    }
    function move(p) {
      const h = H(); if (!stt.start) return; if (Math.hypot(p.x - stt.start.x, p.y - stt.start.y) > 4) stt.moved = true;
      if (stt.rubber) { const w = unplane(p.x, p.y, { z: 0 }); if (w) { stt.rubber.x1 = snap(w.x, 0.5); stt.rubber.y1 = snap(w.y, 0.5); api.draw(); } return; }
      if (stt.drag && stt.moved) { const o = obj(h, stt.drag.id); if (!o) return; const pk = pick(p.x, p.y, o.t); if (pk && !(o.t === 'panel' && false)) { o.room = pk.room; o.face = pk.face; o.u = pk.u; if (pk.face === 'C') { o.v = pk.v; o.z = h.h; } else { o.z = (o.t === 'sock' || o.t === 'dev' || o.t === 'panel' || o.t === 'swi' || o.t === 'swc' || o.t === 'junc') ? o.z : o.z; delete o.v; } stt.drag.moved = true; api.draw(); } return; }
      if (stt.pan) { stt.userCam = true; cam.ox = stt.pan.ox + p.x - stt.pan.x; cam.oy = stt.pan.oy + p.y - stt.pan.y; api.draw(); }
    }
    function up(p, cancelled) {
      const h = H();
      if (stt.rubber) { const a = stt.rubber; stt.rubber = null; const x0 = Math.min(a.x0, a.x1), y0 = Math.min(a.y0, a.y1), w = Math.abs(a.x1 - a.x0), d = Math.abs(a.y1 - a.y0); if (!cancelled && w >= 2 && d >= 2) { if (h.rooms.some(r => x0 < r.x + r.w - EPS && x0 + w > r.x + EPS && y0 < r.y + r.d - EPS && y0 + d > r.y + EPS)) api.toast('Der Raum überschneidet einen anderen Raum'); else { const r = { id: nid(h), n: 'Raum ' + (h.rooms.length + 1), x: x0, y: y0, w, d, c: ['#3b4756', '#44503f', '#4d4458', '#3f5253', '#56493f'][h.rooms.length % 5] }; h.rooms.push(r); stt.sel = { t: 'room', id: r.id }; apply(); HAUS_FITSOFT(); return; } } else if (!cancelled) api.toast('Zu klein: Räume sind mindestens 2 × 2 m'); api.draw(); return; }
      if (stt.drag) { const d = stt.drag; stt.drag = null; if (d.moved) { const o = obj(h, d.id); const bad = h.cables.some(c => (c.a === o.id || c.b === o.id) && !route(h, c).ok); if (bad) { Object.assign(h, JSON.parse(d.snapshot)); api.toast('Dort erreicht die Leitung den Nachbarraum nicht mehr'); api.draw(); api.refreshUI(); return; } apply(); } else api.refreshUI(); }
      stt.pan = null;
    }
    const HAUS_FITSOFT = () => { if (H().rooms.length === 1) root.HAUS_FIT(); };

    /* ---------------- Palette ---------------- */
    root.HAUS_PALETTE = function (sim) {
      const chip = (id, label, on, data) => `<button class="chip ${on ? 'on' : ''}" data-hx="${id}" ${data || ''}>${label}</button>`;
      let h = '';
      if (sim) h += chip('sel', '☝ Bedienen', true) + chip('reset', '↺ Zurück', false) + '<span class="sep"></span>';
      else {
        h += chip('sel', '☝ Auswahl', stt.tool === 'sel') + chip('room', '▭ Raum', stt.tool === 'room') + '<span class="sep"></span>';
        [['sock', 'Steckdose'], ['swi', 'Schalter'], ['swc', 'Wechselschalter'], ['lamp', 'Lampe'], ['dev', 'Gerät'], ['dev3', 'Drehstromgerät'], ['sock3', 'CEE 400 V'], ['junc', 'Abzweigdose'], ['panel', 'Verteiler']].forEach(([t, n]) => { h += chip('place', TYPES[t].icon + ' ' + n, stt.tool === 'place' && stt.place === t, `data-t="${t}"`); });
        h += '<span class="sep"></span>' + chip('cable', '〰 Leitung', stt.tool === 'cable') + chip('del', '⌫ Löschen', stt.tool === 'del') + '<span class="sep"></span>';
      }
      h += chip('turnl', '↺', false) + chip('turnr', '↻', false) + chip('top', stt.top ? '◫ Schräg' : '◫ Oben', false) + chip('zin', '＋', false) + chip('zout', '−', false) + chip('fit', '⤢', false);
      if (!sim) h += '<span class="sep"></span>' + chip('verteiler', '▤ Verteiler öffnen', false);
      else h += '<span class="sep"></span>' + chip('verteiler', '▤ Verteiler', false);
      return h;
    };
    document.addEventListener('click', e => {
      const b = e.target.closest('#pal [data-hx]'); if (!b || api.canvas == null) return; e.stopPropagation(); e.preventDefault();
      const x = b.dataset.hx;
      if (x === 'sel' || x === 'room' || x === 'cable' || x === 'del') { stt.tool = x; stt.place = null; stt.cabA = null; stt.ghost = null; if (x === 'cable') api.toast('Erst das eine Gerät antippen, dann das andere'); }
      else if (x === 'place') { stt.tool = 'place'; stt.place = b.dataset.t; stt.ghost = null; }
      else if (x === 'turnl') turn(-1); else if (x === 'turnr') turn(1); else if (x === 'top') toggleTop(); else if (x === 'zin') zoom(1.25); else if (x === 'zout') zoom(0.8); else if (x === 'fit') { root.HAUS_FIT(); api.draw(); }
      else if (x === 'verteiler') { openPanel(); return; }
      else if (x === 'reset') { api.setSimMode(false); return; }
      api.refreshUI(); api.draw(); const pal = document.getElementById('pal'); if (pal) { const bar = root.HAUS_PALETTE(isSim()); pal.innerHTML = bar; }
    }, true);

    /* Tastatur und Rechtsklick wie in den anderen Labs: Esc beendet das Werkzeug, Entf löscht, Pfeile drehen, + und − zoomen */
    function exitTool() { if (isSim()) return; stt.cabA = null; stt.ghost = null; stt.rubber = null; if (stt.tool !== 'sel') { stt.tool = 'sel'; stt.place = null; api.toast('Werkzeug beendet'); } api.refreshUI(); api.draw(); const pal = document.getElementById('pal'); if (pal) pal.innerHTML = root.HAUS_PALETTE(isSim()); }
    api.canvas.addEventListener('contextmenu', e => { e.preventDefault(); exitTool(); });
    window.addEventListener('keydown', e => {
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return; if (!H()) return;
      if (e.key === 'Escape') { exitTool(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isSim() && stt.sel) { const h = H(), s = stt.sel; if (s.t === 'obj') removeObj(s.id); else if (s.t === 'cab') h.cables = h.cables.filter(c => c.id !== s.id); else if (s.t === 'room') { h.objs.filter(o => o.room === s.id).forEach(o => removeObj(o.id)); h.rooms = h.rooms.filter(r => r.id !== s.id); } stt.sel = null; apply(); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); } else if (e.key === 'ArrowRight') { turn(1); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') zoom(1.2); else if (e.key === '-') zoom(0.83); else if (e.key === 'o' || e.key === 'O') toggleTop(); else if (e.key === '0') { root.HAUS_FIT(); api.draw(); }
    });
    root.LAB_HELP = () => `<p><b>Ansicht:</b> Pfeil links und rechts oder die Knöpfe unten drehen das Haus in 90-Grad-Schritten, <b>O</b> schaltet auf Draufsicht, <b>+</b> und <b>−</b> oder das Mausrad zoomen, <b>0</b> zeigt das ganze Haus. Auf freier Fläche ziehen verschiebt die Ansicht, mit zwei Fingern zoomst du.</p>
      <p><b>Bauen:</b> Werkzeug unten wählen und auf eine sichtbare Wand tippen (Lampen auf den Boden). <b>Raum</b> ziehst du als Rechteck auf dem Boden auf. <b>Leitung</b>: erst das eine Gerät, dann das andere antippen. Leitungen laufen immer an Wänden und Decke. Der Verteilerkasten fragt nach dem Abgang.</p>
      <p><b>Tastatur:</b> <b>Esc</b> oder Rechtsklick beendet das Werkzeug, <b>Entf</b> löscht die Auswahl, Strg + Z macht rückgängig.</p>
      <p><b>Betrieb:</b> Oben auf „Sim“ stellen. Schalter und Geräte antippen oder links im <b>Bedienfeld</b> schalten. Dort sind „Alle an“ und „Alle aus“. An jedem Gerät steht die Spannung, „ohne Spannung“ in Orange zeigt eine Lücke.</p>
      <p><b>Verteiler:</b> Der Knopf „Verteiler“ öffnet den Kasten: FI und Automaten einsetzen, Phase und FI-Zuordnung wählen, im Betrieb Hebel bedienen. Leitungen färben sich im Betrieb nach Last: grün normal, orange hoch, rot überlastet.</p>`;

    /* ---------------- Seitenleiste ---------------- */
    const cabExtra = c => {
      let t = `<div class="kv"><span>Leitungsart</span><span><button class="mini ${c.ph3 ? 'on' : ''}" data-a="hx" data-op="ph3" data-v="1">Drehstrom 5-adrig</button><button class="mini ${c.ph3 ? '' : 'on'}" data-a="hx" data-op="ph3" data-v="0">Wechselstrom 3-adrig</button></span></div>`;
      if (!c.ph3 && lastInfo.cabUp3[c.id]) t += `<div class="kv"><span>Phase</span><span>${[1, 2, 3].map(p => `<button class="mini ${(c.pi || 1) === p ? 'on' : ''}" data-a="hx" data-op="pi" data-v="${p}">L${p}</button>`).join('')}</span></div>`;
      else if (!c.ph3 && lastInfo.cabPh[c.id]) t += `<div class="kv"><span>Phase</span><b>L${lastInfo.cabPh[c.id]}</b></div>`;
      return t;
    };
    const secBtns = (cur) => SECS.map(s => `<button class="chip ${cur === s ? 'on' : ''}" data-a="hx" data-op="sec" data-v="${s}">${String(s).replace('.', ',')} mm²</button>`).join('');
    root.HAUS_SIDE = function (sim) {
      const h = H(); let out = '';
      const o = selObj(), c = selCab(), r = selRoom();
      if (o) {
        const T = TYPES[o.t], rm = room(h, o.room);
        out += `<div class="card"><h4>${esc(T.icon + ' ' + T.n)}</h4>`;
        out += `<div class="kv"><span>Raum</span><b>${esc(rm ? rm.n : '?')}</b></div>`;
        if (o.t === 'sock') out += `<label class="f"><span>Angeschlossenes Gerät</span><select data-hx="dev">${[['', 'keines'], ...DEVS.map(d => [d[0], d[0] + ' (' + d[1] + ' W)'])].map(d => `<option value="${esc(d[0])}" ${((o.n || '') === d[0] && (o.w > 0) || (!o.w && d[0] === '')) ? 'selected' : ''}>${esc(d[1])}</option>`).join('')}</select></label>`;
        if (o.t === 'dev') out += `<label class="f"><span>Gerät</span><select data-hx="dev">${DEVS.map(d => `<option value="${esc(d[0])}" ${o.n === d[0] ? 'selected' : ''}>${esc(d[0] + ' (' + d[1] + ' W)')}</option>`).join('')}</select></label>`;
        if (o.t === 'dev3' || o.t === 'sock3') out += `<label class="f"><span>${o.t === 'sock3' ? 'Angeschlossenes Gerät' : 'Gerät'}</span><select data-hx="dev3">${(o.t === 'sock3' ? [['', 'keines', 0]] : []).concat(DEV3.map(d => [d[0], d[0] + ' (' + (d[1] / 1000) + ' kW)', d[1]])).map(d => `<option value="${esc(d[0])}" ${((o.n || '') === d[0] && o.w > 0) || (!o.w && d[0] === '') ? 'selected' : ''}>${esc(d[1])}</option>`).join('')}</select></label>`;
        if (lastInfo.objPick[o.id] && !sim) out += `<div class="kv"><span>Phase (Drehstromleitung)</span><span>${[1, 2, 3].map(p => `<button class="mini ${(o.ph || 1) === p ? 'on' : ''}" data-a="hx" data-op="oph" data-v="${p}">L${p}</button>`).join('')}</span></div>`;
        else if (lastInfo.phOf[o.id] > 0) out += `<div class="kv"><span>Phase</span><b>L${lastInfo.phOf[o.id]}</b></div>`;
        if (o.t === 'lamp') out += `<label class="f"><span>Leistung (W)</span><select data-hx="lampw">${[10, 40, 60, 100, 150].map(w => `<option ${o.w === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>`;
        if (!sim && o.t !== 'lamp' && o.t !== 'junc') out += `<div class="kv"><span>Höhe über dem Boden</span><span>${[0.3, 1.05, 1.2, 2.2].map(z => `<button class="mini ${Math.abs(o.z - z) < 0.01 ? 'on' : ''}" data-a="hx" data-op="z" data-v="${z}">${String(z).replace('.', ',')}</button>`).join('')}</span></div>`;
        if (o.t === 'swi' || o.t === 'swc') out += `<div class="row2"><button class="btn" data-a="hx" data-op="toggle">Schalter ${o.on ? 'aus' : 'ein'}schalten</button></div>`;
        if ((o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') && o.w > 0) out += `<div class="row2"><button class="btn" data-a="hx" data-op="toggle">Gerät ${o.on === 0 ? 'ein' : 'aus'}schalten</button></div>`;
        if (o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') out += `<div class="row2"><button class="btn ${o.f ? 'danger' : ''}" data-a="hx" data-op="fault">${o.f ? 'Körperschluss beheben' : '⚡ Körperschluss am Gerät'}</button></div>`;
        if (o.t === 'swc') out += `<div class="kv"><span>Partner</span><b>${o.partner ? 'verbunden' : 'noch keiner (Leitung zu zweitem Wechselschalter ziehen)'}</b></div>`;
        const lp = partOf(o.id, 'lamp') || partOf(o.id, 'sd');
        if (sim && lp && poweredSet.has(o.id)) { const cp = cabParts(o.id && cabIdUp(o.id)).filter(p => ['L', 'L1', 'T1'].includes(p.hx.w))[0]; out += `<div class="kv"><span>Spannung</span><b>${Math.round(U(lp.id))} V</b></div>` + (cp ? `<div class="kv"><span>Strom in der Zuleitung</span><b>${api.fmt(I(cp.id), 'A')}</b></div>` : ''); }
        else if (!poweredSet.has(o.id) && o.t !== 'panel') out += `<p class="hint2">Nicht angeschlossen: Es führt noch keine Leitung vom Verteiler hierher.</p>`;
        if (o.t === 'panel') out += `<div class="row2"><button class="btn pri" data-a="hx" data-op="panel">▤ Verteiler öffnen</button></div>`;
        if (!sim) out += `<label class="f"><span>Bezeichnung</span><input data-hx="name" value="${esc(o.n || '')}" placeholder="${esc(T.n)}"></label><div class="row2"><button class="btn danger" data-a="hx" data-op="delobj">Löschen</button></div>`;
        out += '</div>';
      } else if (c) {
        const rt = route(h, c), A = obj(h, c.a), B = obj(h, c.b);
        out += `<div class="card"><h4>〰 Leitung</h4><div class="kv"><span>Von</span><b>${esc(A ? objName(h, A) : '?')}</b></div><div class="kv"><span>Nach</span><b>${esc(B ? objName(h, B) : '?')}</b></div><div class="kv"><span>Länge (an Wänden und Decke)</span><b>${num(rt.len, 1)} m</b></div>`;
        if (c.slot != null) out += `<div class="kv"><span>Abgang im Verteiler</span><b>${c.slot + 1}</b></div>`;
        if (!sim) out += `<div class="kv" style="align-items:flex-start"><span>Querschnitt</span></div><div class="wc">${secBtns(c.s)}</div>${cabExtra(c)}<p class="hint2">Licht: 1,5 mm², Steckdosen und Geräte: 2,5 mm² (mit höchstens B16). Starke Geräte brauchen mehr.</p><div class="row2"><button class="btn danger" data-a="hx" data-op="delcab">Leitung löschen</button></div>`;
        else { const p = cabParts(c.id).find(x => ['L', 'L1', 'T1'].includes(x.hx.w)); if (p) out += `<div class="kv"><span>Strom</span><b>${api.fmt(I(p.id), 'A')}</b></div><div class="kv"><span>Belastbarkeit</span><b>${api.fmt(root.LochSim.cableOf(p.v).iz, 'A')}</b></div>`; }
        out += '</div>';
      } else if (r) {
        out += `<div class="card"><h4>▭ Raum</h4><label class="f"><span>Name</span><input data-hx="rname" value="${esc(r.n)}"></label><div class="kv"><span>Größe</span><b>${num(r.w, 1)} × ${num(r.d, 1)} m</b></div>`;
        if (!sim) out += `<div class="row2"><button class="btn" data-a="hx" data-op="rw" data-v="-0.5">Breite −</button><button class="btn" data-a="hx" data-op="rw" data-v="0.5">Breite +</button></div><div class="row2"><button class="btn" data-a="hx" data-op="rd" data-v="-0.5">Tiefe −</button><button class="btn" data-a="hx" data-op="rd" data-v="0.5">Tiefe +</button></div><div class="row2"><button class="btn danger" data-a="hx" data-op="delroom">Raum löschen</button></div>`;
        out += '</div>';
      } else {
        const tips = { sel: 'Antippen zum Auswählen, Gerät ziehen zum Verschieben, auf freie Fläche ziehen zum Verschieben der Ansicht. Mit den Pfeilen unten drehst du das Haus.', room: 'Auf den Boden tippen und ein Rechteck aufziehen (mindestens 2 × 2 m, Raster 0,5 m).', place: stt.place === 'lamp' ? 'Auf den Boden eines Raumes tippen: Die Lampe hängt darüber an der Decke.' : 'Auf eine Wand tippen, die du siehst. Drehe das Haus mit den Pfeilen, um andere Wände zu sehen.', cable: 'Erst das eine Gerät antippen, dann das andere. Die Leitung läuft an Wänden und Decke entlang, nie quer durch den Raum. Der Verteiler fragt nach dem Abgang.', del: 'Gerät, Leitung oder Raum antippen, um es zu löschen.' };
        out += `<div class="card"><h4>${esc(h.name)}</h4><p class="hint2" style="margin-top:0">${sim ? 'Schalter antippen = ein oder aus. Geräte an Steckdosen antippen schaltet sie. „Verteiler“ öffnet den Kasten.' : esc(tips[stt.tool] || tips.sel)}</p><div class="kv"><span>Räume</span><b>${h.rooms.length}</b></div><div class="kv"><span>Geräte und Schalter</span><b>${h.objs.length}</b></div><div class="kv"><span>Leitungen (gesamt)</span><b>${num(h.cables.reduce((s, c) => s + (route(h, c).len || 0), 0), 0)} m</b></div>`;
        if (stt.tool === 'place' && stt.place === 'dev') out += `<label class="f"><span>Gerät, das du setzt</span><select data-hx="newdev">${DEVS.map(d => `<option value="${esc(d[0])}" ${stt.dev[0] === d[0] ? 'selected' : ''}>${esc(d[0] + ' (' + d[1] + ' W)')}</option>`).join('')}</select></label>`;
        out += '</div>';
      }
      if (lastWarn.length) out += `<div class="card warn"><h4>Hinweise</h4><ul>${lastWarn.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
      return out;
    };
    const cabIdUp = oid => { const p = S().parts.find(q => q.hx && q.hx.role === 'cab'); const h = H(); const cs = h.cables.filter(c => c.a === oid || c.b === oid); const up = cs.find(c => cabParts(c.id).length); return up ? up.id : null; };
    root.LAB_EXTRA_CLICK = (a, b) => {
      if (a !== 'hx') return false; const h = H(), op = b.dataset.op, v = b.dataset.v, o = selObj(), c = selCab(), r = selRoom();
      if (op === 'sec' && c) { c.s = parseFloat(v); apply(); }
      else if (op === 'z' && o) { o.z = parseFloat(v); const bad = h.cables.some(cc => (cc.a === o.id || cc.b === o.id) && !route(h, cc).ok); apply(); }
      else if (op === 'toggle' && o) operate(o);
      else if (op === 'fault' && o) { o.f = o.f ? 0 : 1; const p = partOf(o.id, 'sd'); if (p && api.simMode) { api.setSw(p.id, o.f); api.commit(true, true); api.refreshUI(); } else apply(); }
      else if (op === 'delobj' && o) { removeObj(o.id); stt.sel = null; apply(); }
      else if (op === 'delcab' && c) { h.cables = h.cables.filter(x => x.id !== c.id); stt.sel = null; apply(); }
      else if (op === 'delroom' && r) { h.objs.filter(x => x.room === r.id).forEach(x => removeObj(x.id)); h.rooms = h.rooms.filter(x => x.id !== r.id); stt.sel = null; apply(); }
      else if ((op === 'rw' || op === 'rd') && r) { const nw = op === 'rw' ? r.w + parseFloat(v) : r.w, nd = op === 'rd' ? r.d + parseFloat(v) : r.d; if (nw < 2 || nd < 2) { api.toast('Mindestens 2 m'); return true; } if (h.rooms.some(q => q !== r && r.x < q.x + q.w - EPS && r.x + nw > q.x + EPS && r.y < q.y + q.d - EPS && r.y + nd > q.y + EPS)) { api.toast('Dann überschneidet der Raum einen anderen'); return true; } const old = { w: r.w, d: r.d }; r.w = nw; r.d = nd; h.objs.forEach(x => { if (x.room !== r.id) return; const len = x.face === 'S' || x.face === 'N' ? r.w : r.d; if (x.u > len - 0.2) x.u = len - 0.25; }); apply(); }
      else if (op === 'ph3' && c) { c.ph3 = v === '1' ? 1 : 0; if (c.ph3 && c.s < 2.5) c.s = 2.5; apply(); }
      else if (op === 'pi' && c) { c.pi = +v; apply(); }
      else if (op === 'oph' && o) { o.ph = +v; apply(); }
      else if (op === 'panel') openPanel();
      return true;
    };
    document.addEventListener('change', e => {
      const t = e.target; if (!t.dataset || !t.dataset.hx || !document.getElementById('side').contains(t)) return; const h = H(), o = selObj(), r = selRoom();
      if (t.dataset.hx === 'name' && o) { o.n = t.value.trim(); apply(); }
      else if (t.dataset.hx === 'rname' && r) { r.n = t.value.trim() || r.n; apply(); }
      else if (t.dataset.hx === 'lampw' && o) { o.w = +t.value; apply(); }
      else if (t.dataset.hx === 'dev' && o) { const d = DEVS.find(x => x[0] === t.value); if (o.t === 'sock') { if (d) { o.n = d[0]; o.w = d[1]; } else { o.n = ''; o.w = 0; } } else if (d) { o.n = d[0]; o.w = d[1]; } apply(); }
      else if (t.dataset.hx === 'dev3' && o) { const d = DEV3.find(x => x[0] === t.value); if (d) { o.n = d[0]; o.w = d[1]; o.motor = d[2] ? 1 : 0; } else { o.n = ''; o.w = 0; o.motor = 0; } apply(); }
      else if (t.dataset.hx === 'newdev') { stt.dev = DEVS.find(x => x[0] === t.value) || DEVS[0]; }
    });

    /* ---------------- Verteilerkasten ---------------- */
    function openPanel() {
      const h = H(); if (!h) return;
      root.LabUI.sheet('Verteilerkasten', (b, close) => {
        const draw = () => {
          const P = h.panel, sim = isSim(); syncModel(S());
          const modLs = i => `<div class="hmod"><div class="hlab">${i + 1}</div>${P.slots[i].ls ? `<button class="hmb ${P.slots[i].on ? 'on' : 'off'}" data-m="lss" data-i="${i}"><b>${P.slots[i].p3 ? '3×' : ''}${P.slots[i].ls}</b><small>${P.slots[i].on ? 'I' : '0'}</small></button>` : `<button class="hmb empty" data-m="lss" data-i="${i}">${sim ? '–' : '＋'}</button>`}${P.slots[i].ls ? `<select class="hsel" data-m="fi" data-i="${i}" ${sim ? 'disabled' : ''}><option value="0" ${!P.slots[i].fi ? 'selected' : ''}>ohne FI</option><option value="1" ${P.slots[i].fi === 1 ? 'selected' : ''}>hinter FI 1</option><option value="2" ${P.slots[i].fi === 2 ? 'selected' : ''}>hinter FI 2</option></select>` : ''}${P.slots[i].ls && !P.slots[i].p3 ? `<select class="hsel" data-m="ph" data-i="${i}" ${sim ? 'disabled' : ''}>${[[0, 'Phase auto'], [1, 'Phase L1'], [2, 'Phase L2'], [3, 'Phase L3']].map(x => `<option value="${x[0]}" ${(P.slots[i].ph || 0) === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>` : (P.slots[i].p3 ? '<div class="hwire" style="color:#d9a441">Drehstrom L1 L2 L3</div>' : '')}<div class="hwire">${(() => { const cs = h.cables.filter(c => c.slot === i); return cs.length ? cs.map(c => { const o2 = obj(h, c.a === (h.objs.find(x => x.t === 'panel') || {}).id ? c.b : c.a); return '→ ' + esc(o2 ? objName(h, o2) : '?') + ' (' + c.s + ' mm²)'; }).join('<br>') : (P.slots[i].ls ? 'nicht verdrahtet' : ''); })()}</div></div>`;
          b.innerHTML = '<style>.hrail{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px;padding:10px;background:#1b2127;border-radius:10px;border-bottom:6px solid #6f7882}.hmod{width:84px;display:flex;flex-direction:column;gap:4px;align-items:stretch}.hlab{font-size:11px;color:var(--mute);text-align:center}.hmb{height:78px;border-radius:6px;background:#e4e7ea;color:#222;border:2px solid #8b939c;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:16px}.hmb small{margin-top:6px;padding:2px 12px;border-radius:4px;background:#c04a3a;color:#fff;font-weight:700}.hmb.on small{background:#3aa655}.hmb.empty{background:#2a323b;color:#8d99a6;border-style:dashed;font-size:22px}.hsel{height:30px;font-size:12px;padding:0 2px}.hwire{font-size:11px;color:var(--mute);min-height:30px}.hfi{width:120px}.hfi .hmb{height:96px}.hfi small{background:#3aa655}.hfi .off small{background:#c04a3a}</style>'
            + '<p class="hint2" style="margin-top:0">' + (sim ? 'Hebel antippen: ein und aus. Ausgelöste Automaten zeigen „0“.' : '<b>Bestücken:</b> Leere Plätze antippen und einen Automaten oder FI einsetzen. <b>Verdrahten:</b> Im Haus mit „Leitung“ den Verteilerkasten antippen und den Abgang wählen. Tippe auf einen Automaten, um ihn zu tauschen.') + '</p>'
            + '<div class="gh">FI-Schutzschalter</div><div class="hrail">' + [0, 1].map(g => `<div class="hmod hfi"><div class="hlab">FI ${g + 1}</div>${P.fi[g].type ? `<button class="hmb ${P.fi[g].on === 0 ? 'off' : 'on'}" data-m="rcd" data-i="${g}"><b>4P ${P.fi[g].type}</b><small>${P.fi[g].on === 0 ? '0' : 'I'}</small></button>` : `<button class="hmb empty" data-m="rcd" data-i="${g}">${sim ? '–' : '＋'}</button>`}</div>`).join('') + '</div>'
            + '<div class="gh">Leitungsschutzschalter (Abgänge)</div><div class="hrail">' + P.slots.map((s, i) => modLs(i)).join('') + '</div>';
        };
        draw();
        const menu = (title, opts, cur, done) => { const old = b.innerHTML; b.innerHTML = `<p style="margin-top:0"><b>${title}</b></p>` + opts.map(o => `<button class="row" data-o="${esc(o[0])}"><div class="grow"><b>${esc(o[1])}</b><small>${esc(o[2] || '')}</small></div></button>`).join('') + '<button class="row" data-o="__x"><div class="grow"><b>Zurück</b></div></button>'; b.onclick = e => { const r = e.target.closest('.row'); if (!r) return; b.onclick = main; if (r.dataset.o === '__x') { draw(); return; } done(r.dataset.o); }; };
        const main = e => {
          const t = e.target.closest('[data-m]'); if (!t || t.tagName === 'SELECT') return; const P = h.panel, i = +t.dataset.i, sim = isSim();
          if (t.dataset.m === 'lss') {
            if (sim) { const ps = S().parts.filter(q => q.hx && q.hx.role === 'lss' && q.hx.slot === i); if (ps.length) { const nv = ps[0].sw ? 0 : 1; ps.forEach(p => api.setSw(p.id, nv)); api.commit(true, true); syncModel(S()); draw(); } return; }
            menu('Sicherungsautomat für Abgang ' + (i + 1), [...LS_TYPES.map(x => [x, x + ' (' + x.replace(/\D/g, '') + ' A, einpolig, ' + (x[0] === 'B' ? 'für Licht und Steckdosen' : 'für Geräte mit Anlaufstrom') + ')']), ...['B16', 'B20', 'B25', 'B32', 'C16'].map(x => [x + '|3', x + ' dreipolig (Drehstrom)', 'für Herd, Wallbox, Motoren, Klimagerät']), ['', 'entfernen']], P.slots[i].ls, v0 => { const pr = v0.split('|'), v = pr[0]; P.slots[i].p3 = pr[1] ? 1 : 0; P.slots[i].ls = v; if (!v) { P.slots[i].fi = 0; P.slots[i].p3 = 0; } apply(); stat('hausVerteiler', P.slots.filter(s => s.ls).length, 'max'); draw(); });
          } else if (t.dataset.m === 'rcd') {
            if (sim) { const p = S().parts.find(q => q.hx && q.hx.role === 'rcd' && q.hx.g === i); if (p) { api.setSw(p.id, p.sw ? 0 : 1); api.commit(true, true); syncModel(S()); draw(); } return; }
            menu('FI-Schutzschalter ' + (i + 1), [['30mA', 'FI 4-polig 30 mA', 'Personenschutz, schützt alle drei Phasen und N, Pflicht für Steckdosen und Bäder'], ['300mA', 'FI 4-polig 300 mA', 'Brandschutz'], ['', 'entfernen']], P.fi[i].type, v => { P.fi[i].type = v; if (!v) P.slots.forEach(s => { if (s.fi === i + 1) s.fi = 0; }); apply(); stat('hausVerteiler', P.slots.filter(s => s.ls).length, 'max'); draw(); });
          }
        };
        b.onclick = main;
        b.onchange = e => { const t = e.target; if (t.dataset.m === 'ph') { h.panel.slots[+t.dataset.i].ph = +t.value; apply(); draw(); return; } if (t.dataset.m === 'fi') { const i = +t.dataset.i, v = +t.value; if (v > 0 && !h.panel.fi[v - 1].type) { api.toast('FI ' + v + ' ist noch nicht eingesetzt'); t.value = h.panel.slots[i].fi; return; } h.panel.slots[i].fi = v; apply(); draw(); } };
        const iv = setInterval(() => { if (!document.body.contains(b)) { clearInterval(iv); return; } if (isSim() && !b.querySelector('.row')) draw(); }, 700);
      });
    }

    /* Haus auswerten, ohne die Zeichnung zu verändern: Lampen, Spannungen, Auslösungen; Strom je Abgang aus den Nennleistungen */
    function evalHouse(h, opt) {
      opt = opt || {}; const r = compile(h), tmp = { name: 'tmp', parts: r.parts, wires: r.wires, nid: r.nid, scopes: [], haus: h }, out = { lit: {}, v: {}, ph3: {}, trip: [], burn: [], powered: r.powered, slotOf: r.slotOf, warn: r.warn };
      api.withSch(tmp, () => {
        const E = api.simEval(); E.run(opt.t || 0.3);
        /* eine volle Netzperiode (20 ms) abtasten: Spitzenwerte je Bauteil, damit alle drei Phasen erfasst sind */
        const pv = {}, pi = {}, lampOn = new Set();
        const dev = E.c.elems.filter(e => e.part && e.part.item && e.part.item.hx && ((e.device && e.part.item.hx.role === 'devR') || e.part.item.hx.role === 'motor'));
        for (let k = 0; k < 100; k++) {
          E.run(0.0002);
          r.parts.forEach(p => { const x = p.hx; if (x && (x.role === 'lamp' || x.role === 'sd')) { const v = Math.abs(api.vAcross(E, p)); if (!(v <= (pv[p.id] || 0))) pv[p.id] = v; } });
          dev.forEach(e => { const a = Math.abs(e.i || 0); if (a > (pi[e.part.id] || 0)) pi[e.part.id] = a; });
        }
        const lamps = E.lamps();
        r.parts.forEach(p => { const x = p.hx; if (!x) return; if (x.role === 'lamp' && lamps.get(p.id)) out.lit[x.o] = true; if (x.role === 'lamp' || x.role === 'sd') out.v[x.o] = Math.max(out.v[x.o] || 0, pv[p.id] || 0); if ((x.role === 'devR' || x.role === 'motor') && (pi[p.id] || 0) > 0.05) out.lit[x.o] = true; if (x.role === 'devR' && x.k != null) (out.ph3[x.o] = out.ph3[x.o] || [0, 0, 0])[x.k] = pi[p.id] || 0; });
        E.ev.forEach(e => { if (e.kind === 'trip') out.trip.push(e.text); if (e.kind === 'burn') out.burn.push(e.text); });
        out.E = E;
      });
      return out;
    }
    /* Strom je Phase aus den Nennleistungen: {slot: [I1, I2, I3]} (eingeschaltete Geräte, alle Lampen) */
    function phaseLoads(h) {
      const B = buildNet(h), cur = {};
      h.objs.forEach(o => {
        const s = B.slotOf[o.id]; if (s == null || s < 0) return; let w = 0;
        if (o.t === 'lamp') w = o.w || 60; else if ((o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') && o.on !== 0) w = o.w || 0;
        if (!w) return; const a = cur[s] = cur[s] || [0, 0, 0];
        if (o.t === 'sock3' || o.t === 'dev3') { const i3 = w / (400 * Math.sqrt(3)) * (o.motor ? 1.25 : 1); a[0] += i3; a[1] += i3; a[2] += i3; }
        else { const ph = B.phOf[o.id] || 1; a[ph - 1] += w / 230; }
      });
      return cur;
    }
    function slotLoads(h) { const pl = phaseLoads(h), out = {}; Object.keys(pl).forEach(s => { out[s] = Math.max(...pl[s]); }); return out; }
    /* Last je Phase im ganzen Haus */
    function houseLoads(h) { const pl = phaseLoads(h), t = [0, 0, 0]; Object.values(pl).forEach(a => a.forEach((v, k) => { t[k] += v; })); return t; }
    /* ---------------- Bedienfeld links (Betrieb): Licht, Geräte, Verteiler ---------------- */
    let partsEl = null, ctlSig = '';
    const wide = () => window.innerWidth >= 900;
    function setAllLights(on) {
      const h = H(), done = new Set();
      h.objs.forEach(o => {
        if (o.t === 'swi') { o.on = on ? 1 : 0; const p = partOf(o.id, 'sw'); if (p) api.setSw(p.id, o.on); }
        else if (o.t === 'swc' && !done.has(o.id)) { const q = o.partner ? obj(h, o.partner) : null; done.add(o.id); if (q) done.add(q.id); o.on = on ? 0 : 1; if (q) q.on = 0; else o.on = on ? 0 : 1; [o, q].forEach(x => { if (!x) return; const p = partOf(x.id, 'swc'); if (p) api.setSw(p.id, x.on); }); }
      });
      api.commit(true, true); api.refreshUI(); renderControls(true);
    }
    function setAllDevices(on) {
      const h = H();
      h.objs.forEach(o => { if ((o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') && o.w > 0) { o.on = on ? 1 : 0; partsOf(o.id, 'dev').forEach(p => api.setSw(p.id, o.on)); } });
      api.commit(true, true); api.refreshUI(); renderControls(true);
    }
    function setPanel(on) {
      const h = H(); S().parts.forEach(p => { if (p.hx && (p.hx.role === 'lss' || p.hx.role === 'rcd')) api.setSw(p.id, on ? 1 : 0); });
      syncModel(S()); api.commit(true, true); api.refreshUI(); renderControls(true);
    }
    function controlsHtml() {
      const h = H(); if (!h) return ''; syncModel(S());
      const chip = (op, id, label, on, cls, tOn, tOff) => `<button class="hcb ${on ? 'on' : 'off'} ${cls || ''}" data-hc="${op}" data-id="${id}"><span>${esc(label)}</span><i>${on ? (tOn || 'an') : (tOff || 'aus')}</i></button>`;
      let t = '<div class="hcp"><style>.hcp h5{margin:12px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute)}.hcp .hrow{display:flex;gap:6px;margin:4px 0}.hcp .hbt{flex:1;height:32px;border-radius:8px;background:var(--panel2);border:1px solid var(--line);font-size:12px;font-weight:600}.hcb{display:flex;justify-content:space-between;align-items:center;gap:6px;width:100%;padding:6px 8px;margin:3px 0;border-radius:8px;border:1px solid var(--line);background:var(--panel2);font-size:12px;text-align:left}.hcb i{font-style:normal;font-weight:700;font-size:11px;padding:1px 7px;border-radius:8px;background:#4a5561;color:#fff}.hcb.on i{background:#2fae45}.hcb.trip i{background:#e04b3a}.hcb small{display:block;color:var(--mute);font-size:10px}</style><b>Bedienfeld</b>';
      const sw = h.objs.filter(o => o.t === 'swi' || o.t === 'swc').sort((a, b) => (room(h, a.room) ? room(h, a.room).n : '').localeCompare(room(h, b.room) ? room(h, b.room).n : ''));
      t += '<h5>Licht</h5><div class="hrow"><button class="hbt" data-hc="lights" data-id="1">Alle an</button><button class="hbt" data-hc="lights" data-id="0">Alle aus</button></div>';
      sw.forEach(o => { const r = room(h, o.room); t += o.t === 'swc' ? chip('sw', o.id, (r ? r.n : '?') + ' · Wechselschalter ' + (o.partner && o.id > o.partner ? 'B' : 'A'), !!o.on, '', 'Stellung 2', 'Stellung 1') : chip('sw', o.id, (r ? r.n : '?') + ' · Schalter', !!o.on); });
      const dv = h.objs.filter(o => (o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3') && o.w > 0);
      if (dv.length) {
        t += '<h5>Geräte</h5><div class="hrow"><button class="hbt" data-hc="devs" data-id="1">Alle an</button><button class="hbt" data-hc="devs" data-id="0">Alle aus</button></div>';
        dv.forEach(o => { const r = room(h, o.room); t += chip('dev', o.id, (o.n || TYPES[o.t].n) + ' (' + (o.w >= 1000 ? (o.w / 1000) + ' kW' : o.w + ' W') + ')', o.on !== 0); });
      }
      const P = h.panel, mods = [];
      [0, 1].forEach(g => { if (P.fi[g].type) mods.push(['rcd', g, 'FI ' + (g + 1) + ' (' + P.fi[g].type.replace('mA', ' mA') + ')', P.fi[g].on !== 0]); });
      P.slots.forEach((s, i) => { if (s.ls) mods.push(['lss', i, 'Abgang ' + (i + 1) + ' · ' + (s.p3 ? '3×' : '') + s.ls, s.on !== 0]); });
      if (mods.length) {
        t += '<h5>Verteiler</h5><div class="hrow"><button class="hbt" data-hc="panel" data-id="1">Alle ein</button><button class="hbt" data-hc="panel" data-id="0">Alle aus</button></div>';
        mods.forEach(m => { t += chip(m[0], m[1], m[2], m[3], m[3] ? '' : 'trip'); });
      }
      return t + '</div>';
    }
    function renderControls(force) {
      if (!partsEl) return; const sim = isSim() && wide();
      partsEl.style.display = sim ? 'block' : 'none'; if (!sim) { ctlSig = ''; return; }
      partsEl.style.width = '216px'; partsEl.style.padding = '10px';
      const sig = JSON.stringify([H().objs.map(o => [o.id, o.on, o.f]), H().panel, H().cables.length]);
      if (!force && sig === ctlSig) return; ctlSig = sig; const keep = partsEl.scrollTop; partsEl.innerHTML = controlsHtml(); partsEl.scrollTop = keep;
    }
    root.HAUS_PARTS = (el, sim) => { partsEl = el; ctlSig = ''; el.dataset.h = ''; renderControls(true); };
    document.addEventListener('click', e => {
      const b = e.target.closest('#parts [data-hc]'); if (!b || !isSim()) return; e.stopPropagation(); const h = H(), op = b.dataset.hc, id = +b.dataset.id;
      if (op === 'lights') setAllLights(id === 1); else if (op === 'devs') setAllDevices(id === 1); else if (op === 'panel') setPanel(id === 1);
      else if (op === 'sw' || op === 'dev') { const o = obj(h, id); if (o) operate(o); renderControls(true); }
      else if (op === 'lss') { const ps = S().parts.filter(q => q.hx && q.hx.role === 'lss' && q.hx.slot === id); if (ps.length) { const nv = ps[0].sw ? 0 : 1; ps.forEach(p => api.setSw(p.id, nv)); syncModel(S()); api.commit(true, true); api.refreshUI(); renderControls(true); } }
      else if (op === 'rcd') { const p = S().parts.find(q => q.hx && q.hx.role === 'rcd' && q.hx.g === id); if (p) { api.setSw(p.id, p.sw ? 0 : 1); syncModel(S()); api.commit(true, true); api.refreshUI(); renderControls(true); } }
    }, true);
    setInterval(() => { if (isSim() && partsEl) renderControls(false); }, 600);
    window.addEventListener('resize', () => renderControls(true));

    root.HAUS_NEW = () => ({ name: 'Neues Haus', parts: [], wires: [], nid: 1, scopes: [], haus: newHouse('Neues Haus') });
    root.HAUS = { evalHouse, slotLoads, phaseLoads, houseLoads, DEV3, TYPES, DEVS, SLOTS, newHouse, route, buildNet, compile, pos, room, obj, cab, nid, cam, stt, proj, pick, unplane, hits: () => hits, apply, openPanel, U, I, partOf, cabParts, poweredSet: () => poweredSet, warn: () => lastWarn, syncModel, newObj, addCable, removeObj, operate };
    if (root.HAUS_DATA) root.HAUS_DATA(api, root.HAUS);
    const css = document.createElement('style'); css.textContent = '#pal .chip{flex:none}'; document.head.appendChild(css);
    window.addEventListener('resize', () => { if (!stt.userCam && H()) { root.HAUS_FIT(); api.draw(); } });
  };
})(window);
