'use strict';
/* Tonfunk Pneumatik-Lab: Logik und Solver (reines JS, ohne DOM, in Node testbar).
   window.PNE_CORE = { build, init, step, simulate, runChecks, setInput, pressure, calc, ... }

   Modell
   - Schaltung: { parts:[{id,t,...}], fixed:[[a,b],...] }  a/b = "teilId.anschluss".  Schlaeuche: fixed (vorgegeben) + user (vom Azubi gelegt).
   - Bauteiltypen: quelle, we (Wartungseinheit), zyl_ea, zyl_da, v32, v52, wv (Wechselventil, ODER), uv (Zweidruckventil, UND), dr (Drossel-Rueckschlagventil), sd (Schalldaempfer).
   - Druckzustand je Anschluss: 1 belueftet, 0 entlueftet. Eingeschlossene Luft (kein Weg zu Quelle oder Entlueftung) behaelt ihren Zustand.
   - Ein Netz mit Quelle UND Entlueftung = Kurzschluss/Leckage (s.leak), Druck gilt dort als 0.
   - Ventilstellungen: v32 'f' (durchgeschaltet 1-2, 3 gesperrt) / 'z' (gesperrt, 2-3 entlueftet);
     v52 '12' (1-2, 4-5) / '14' (1-4, 2-3). Anschluss 3 entlueftet 2, Anschluss 5 entlueftet 4 (DIN ISO 5599).
   - Zylinder: Position 0 (eingefahren) .. 1 (ausgefahren), freie Geschwindigkeit V_BASE Hub/s, Drossel in Abluft bzw. Zuluft bremst.
   - Unbelegte Ventilanschluesse gelten als verschlossen, unbelegte Zylinderanschluesse atmen frei (Entlueftung); 3/5 entlueften immer.
   Alle Zahlenwerte der Rechenhilfen sind Richtwerte fuer die Ausbildung. */
(function (root) {
  const TH = 0.001;                /* Rollenhebel gilt als betaetigt erst in der Endlage (Hubende) */
  const V_BASE = 1.0;              /* freie Kolbengeschwindigkeit, Hub je Sekunde Simulationszeit */
  const F_SUP = 0.45, F_EXH = 0.3; /* Drosselfaktoren (qualitativ, nur fuer die Animation) */
  const DT = 0.02;

  function norm(p) {
    if (p.t === 'v32') { p.rest = p.rest || 'NC'; p.act = p.act || 'taster'; }
    if (p.t === 'v52') { p.s14 = p.s14 || 'pilot'; p.s12 = p.s12 || 'feder'; p.init = p.init || '12'; }
    if (p.t === 'dr') p.rev = !!p.rev;
    return p;
  }
  function portsOf(p) {
    switch (p.t) {
      case 'quelle': return ['P'];
      case 'we': return ['ein', 'aus'];
      case 'zyl_ea': return ['K'];
      case 'zyl_da': return ['K', 'S'];
      case 'v32': { const a = ['1', '2', '3']; if (p.act === 'pilot') a.push(p.rest === 'NO' ? '10' : '12'); return a; }
      case 'v52': { const a = ['1', '2', '3', '4', '5']; if (p.s14 === 'pilot') a.push('14'); if (p.s12 === 'pilot') a.push('12'); return a; }
      case 'wv': case 'uv': return ['1a', '1b', '2'];
      case 'dr': return ['V', 'Z'];
      case 'sd': return ['E'];
    }
    return [];
  }

  /* ---------------------------------------------------------------- Aufbau */
  function build(circuit, user) {
    const m = { parts: {}, ids: [], nodes: [], idx: {}, hoses: [], valves: [], shuttles: [], cyls: [], inputs: [], src: [], vent: [] };
    (circuit.parts || []).forEach(src => {
      const p = norm(Object.assign({}, src)); p.ports = portsOf(p);
      m.parts[p.id] = p; m.ids.push(p.id);
      p.ports.forEach(n => { m.idx[p.id + '.' + n] = m.nodes.length; m.nodes.push({ part: p.id, port: n }); });
      if (p.t === 'v32' || p.t === 'v52') m.valves.push(p.id);
      if (p.t === 'wv' || p.t === 'uv') m.shuttles.push(p.id);
      if (p.t === 'zyl_ea' || p.t === 'zyl_da') m.cyls.push(p.id);
      if ((p.t === 'v32' && (p.act === 'taster' || p.act === 'schalter')) || (p.t === 'v52' && (p.s14 === 'taster' || p.s14 === 'schalter'))) m.inputs.push(p.id);
    });
    const hs = (circuit.fixed || []).concat(user || []);
    const hosed = new Set();
    hs.forEach(h => {
      const a = m.idx[h[0]], b = m.idx[h[1]];
      if (a == null || b == null || a === b) return;
      m.hoses.push([a, b]); hosed.add(a); hosed.add(b);
    });
    m.nodes.forEach((nd, i) => {
      const p = m.parts[nd.part];
      m.src[i] = p.t === 'quelle' ? 1 : 0;
      let v = 0;
      if (p.t === 'v32' && nd.port === '3') v = 1;
      if (p.t === 'v52' && (nd.port === '3' || nd.port === '5')) v = 1;
      if (p.t === 'sd') v = 1;
      if ((p.t === 'zyl_ea' || p.t === 'zyl_da') && !hosed.has(i)) v = 1;
      m.vent[i] = v;
    });
    return m;
  }

  function init(m) {
    const s = { t: 0, pos: {}, vpos: {}, sh: {}, inp: {}, net: new Int8Array(m.nodes.length), cnt: {}, hold: {}, leak: false, leakSeen: false, edges: [], vel: {} };
    m.cyls.forEach(id => { s.pos[id] = m.parts[id].start || 0; s.cnt[id] = { out: 0, in: 0 }; s.hold[id] = false; s.vel[id] = 0; });
    m.valves.forEach(id => { const p = m.parts[id]; s.vpos[id] = p.t === 'v52' ? p.init : (p.rest === 'NC' ? 'z' : 'f'); });
    m.shuttles.forEach(id => { s.sh[id] = []; });
    solve(m, s);
    return s;
  }
  const setInput = (s, id, v) => { s.inp[id] = v ? 1 : 0; };
  const pressure = (m, s, key) => { const i = m.idx[key]; return i == null ? 0 : s.net[i]; };

  /* ---------------------------------------------------------------- Ventile */
  function rolleOn(s, sn) {
    if (!sn || s.pos[sn.cyl] == null) return false;
    return sn.at === 'in' ? s.pos[sn.cyl] <= TH : s.pos[sn.cyl] >= 1 - TH;
  }
  function actv(m, s, p, spec, key, port, sensor) {
    if (spec === 'taster' || spec === 'schalter') return !!s.inp[key];
    if (spec === 'rolle') return rolleOn(s, sensor);
    if (spec === 'pilot') return !!s.net[m.idx[p.id + '.' + port]];
    return false;
  }
  function valvePos(m, s, p) {
    if (p.t === 'v32') {
      const a = actv(m, s, p, p.act, p.id, p.rest === 'NO' ? '10' : '12', p.sensor);
      return p.rest === 'NO' ? (a ? 'z' : 'f') : (a ? 'f' : 'z');
    }
    const a14 = actv(m, s, p, p.s14, p.id, '14', p.sensor), a12 = actv(m, s, p, p.s12, p.id + '/12', '12', p.sensor12), prev = s.vpos[p.id];
    if (a14 && !a12) return '14';
    if (a12 && !a14) return '12';
    if (!a14 && !a12) return p.s12 === 'feder' ? '12' : (p.s14 === 'feder' ? '14' : prev);
    return prev;   /* beide Signale: Impulsventil behaelt die letzte Stellung */
  }
  function baseEdges(m, s) {
    const E = [];
    m.hoses.forEach(h => E.push([h[0], h[1], 0]));
    m.ids.forEach(id => {
      const p = m.parts[id], I = n => m.idx[id + '.' + n];
      if (p.t === 'we') E.push([I('ein'), I('aus'), 0]);
      else if (p.t === 'dr') E.push([I('V'), I('Z'), 1, p.rev ? 1 : 0]);
      else if (p.t === 'v32') { if (s.vpos[id] === 'f') E.push([I('1'), I('2'), 0]); else E.push([I('2'), I('3'), 0]); }
      else if (p.t === 'v52') {
        if (s.vpos[id] === '12') { E.push([I('1'), I('2'), 0]); E.push([I('4'), I('5'), 0]); } else { E.push([I('1'), I('4'), 0]); E.push([I('2'), I('3'), 0]); }
      }
    });
    return E;
  }
  function evalNets(m, E, old) {
    const n = m.nodes.length, par = new Int16Array(n);
    for (let i = 0; i < n; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    E.forEach(e => { const a = find(e[0]), b = find(e[1]); if (a !== b) par[a] = b; });
    const hp = new Uint8Array(n), hv = new Uint8Array(n), or = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const r = find(i); if (m.src[i]) hp[r] = 1; if (m.vent[i]) hv[r] = 1; if (old[i]) or[r] = 1; }
    const val = new Int8Array(n); let leak = false;
    for (let i = 0; i < n; i++) { const r = find(i); val[i] = hp[r] && !hv[r] ? 1 : (hv[r] ? 0 : or[r]); if (hp[r] && hv[r]) leak = true; }
    return { val, leak };
  }
  function solve(m, s) {
    for (let it = 0; it < 12; it++) {
      let ch = false;
      m.valves.forEach(id => { const np = valvePos(m, s, m.parts[id]); if (np !== s.vpos[id]) { s.vpos[id] = np; ch = true; } });
      const base = baseEdges(m, s);
      m.shuttles.forEach(id => {
        const others = [];
        m.shuttles.forEach(o => { if (o !== id) s.sh[o].forEach(l => others.push([l[0], l[1], 0])); });
        const r = evalNets(m, base.concat(others), s.net), p = m.parts[id];
        const a = m.idx[id + '.1a'], b = m.idx[id + '.1b'], o = m.idx[id + '.2'], va = r.val[a], vb = r.val[b];
        let links;
        if ((va && vb) || (!va && !vb)) links = [[a, o], [b, o]];
        else if (p.t === 'wv') links = va ? [[a, o]] : [[b, o]];   /* ODER: Ausgang am Eingang mit Druck */
        else links = va ? [[b, o]] : [[a, o]];                     /* UND: Ausgang nur zur Seite ohne Druck, also kein Druck am Ausgang */
        if (JSON.stringify(links) !== JSON.stringify(s.sh[id])) { s.sh[id] = links; ch = true; }
      });
      const all = base.slice();
      m.shuttles.forEach(id => s.sh[id].forEach(l => all.push([l[0], l[1], 0])));
      const r = evalNets(m, all, s.net);
      for (let i = 0; i < r.val.length; i++) if (r.val[i] !== s.net[i]) { ch = true; break; }
      s.net = r.val; s.leak = r.leak; s.edges = all;
      if (!ch) break;
    }
  }

  /* ---------------------------------------------------------------- Zylinder */
  /* Gibt es auf dem Weg von node zur Quelle (inward) bzw. zur Entlueftung (outward) nur gedrosselte Richtung? true = gedrosselt */
  function throttled(m, s, node, outward) {
    const n = m.nodes.length, dist = new Array(n).fill(Infinity); dist[node] = 0;
    const cost = (e, a, b) => {
      if (e[2] !== 1) return 0;
      const from = outward ? a : b, to = outward ? b : a;   /* Luftrichtung */
      const v = e[0], z = e[1];
      return (e[3] ? (from === v && to === z) : (from === z && to === v)) ? 1 : 0;
    };
    let ch = true, guard = 0;
    while (ch && guard++ < n + 2) {
      ch = false;
      s.edges.forEach(e => {
        const c1 = dist[e[0]] + cost(e, e[0], e[1]); if (c1 < dist[e[1]]) { dist[e[1]] = c1; ch = true; }
        const c2 = dist[e[1]] + cost(e, e[1], e[0]); if (c2 < dist[e[0]]) { dist[e[0]] = c2; ch = true; }
      });
    }
    let best = Infinity;
    for (let i = 0; i < n; i++) if ((outward ? m.vent[i] : m.src[i]) && dist[i] < best) best = dist[i];
    return isFinite(best) && best > 0;
  }
  function moveCyl(m, s, dt) {
    m.cyls.forEach(id => {
      const p = m.parts[id], da = p.t === 'zyl_da', kN = m.idx[id + '.K'], sN = da ? m.idx[id + '.S'] : -1;
      const K = s.net[kN], S = da ? s.net[sN] : 0;
      let d = 0, f = 1;
      if (da) {
        if (K && !S) { d = 1; if (throttled(m, s, kN, false)) f *= F_SUP; if (throttled(m, s, sN, true)) f *= F_EXH; }
        else if (!K && S) { d = -1; if (throttled(m, s, sN, false)) f *= F_SUP; if (throttled(m, s, kN, true)) f *= F_EXH; }
        else if (K && S) d = 1;   /* beide belueftet: Kolbenflaeche groesser, faehrt aus */
      } else if (K) { d = 1; if (throttled(m, s, kN, false)) f *= F_SUP; }
      else { d = -1; if (throttled(m, s, kN, true)) f *= F_EXH; }
      const old = s.pos[id], v = d * V_BASE * f;
      let np = Math.min(1, Math.max(0, old + v * dt));
      s.pos[id] = np; s.vel[id] = np === old ? 0 : v;
      if (old < 1 && np >= 1) s.cnt[id].out++;
      if (old > 0 && np <= 0) s.cnt[id].in++;
    });
  }
  function step(m, s, dt) {
    dt = dt || DT;
    solve(m, s); moveCyl(m, s, dt); solve(m, s);
    s.t += dt; if (s.leak) s.leakSeen = true;
    const anyIn = Object.keys(s.inp).some(k => s.inp[k]);
    m.cyls.forEach(id => { if (s.pos[id] >= 1 && !anyIn) s.hold[id] = true; });
  }
  function simulate(m, s, secs, dt) {
    dt = dt || DT; const n = Math.round(secs / dt);
    for (let i = 0; i < n; i++) step(m, s, dt);
  }

  /* ---------------------------------------------------------------- Pruefszenarien */
  const IN = z => z <= 0.03, OUT = z => z >= 0.97;
  const cylIs = (s, id, what) => what === 'out' ? OUT(s.pos[id]) : what === 'in' ? IN(s.pos[id]) : what === 'end' ? (OUT(s.pos[id]) || IN(s.pos[id])) : (s.pos[id] > 0.03 && s.pos[id] < 0.97);
  /* Ziel einer Leseaufgabe: { cnt:{z1:{out:1,in:1}}, hold:'z1' } gegen den Simulationszustand */
  function goalOk(s, g) {
    if (!g) return false;
    if (g.cnt && Object.keys(g.cnt).some(c => Object.keys(g.cnt[c]).some(k => (s.cnt[c] ? s.cnt[c][k] : 0) < g.cnt[c][k]))) return false;
    if (g.hold && !s.hold[g.hold]) return false;
    return true;
  }
  /* check = { text, steps:[ {set:{taster:1}, wait:s, reach:{z1:'out'}, max, tmin, tmax, expect:{z1:'in'}, cycles:{z1:2}, net:{'v1.2':1}} ] }
     liefert { ok, why } ; why nennt nur die fehlgeschlagene Beobachtung, nie den Schlauch */
  function runCheck(m, check) {
    const s = init(m); let why = '';
    for (const st of check.steps) {
      if (st.set) Object.keys(st.set).forEach(k => setInput(s, k, st.set[k]));
      if (st.reach) {
        const t0 = s.t, max = st.max || 8, keys = Object.keys(st.reach);
        let hit = false;
        while (s.t - t0 < max + 1e-9) { step(m, s); if (keys.every(k => cylIs(s, k, st.reach[k]))) { hit = true; break; } }
        const el = s.t - t0;
        if (!hit) { why = 'Ziel nicht erreicht'; break; }
        if (st.tmin != null && el < st.tmin) { why = 'zu schnell'; break; }
        if (st.tmax != null && el > st.tmax) { why = 'zu langsam'; break; }
      } else if (st.wait) simulate(m, s, st.wait);
      if (st.expect) { const bad = Object.keys(st.expect).find(k => !cylIs(s, k, st.expect[k])); if (bad) { why = 'Zylinder ' + bad + ' nicht ' + st.expect[bad]; break; } }
      if (st.cycles) { const bad = Object.keys(st.cycles).find(k => s.cnt[k].out < st.cycles[k]); if (bad) { why = 'zu wenige Hübe'; break; } }
      if (st.net) { const bad = Object.keys(st.net).find(k => pressure(m, s, k) !== st.net[k]); if (bad) { why = 'Druck an ' + bad; break; } }
    }
    return { ok: !why, why, leak: s.leakSeen, s };
  }
  function runChecks(circuit, user, checks) {
    const m = build(circuit, user), items = []; let leak = false;
    (checks || []).forEach(c => { const r = runCheck(m, c); if (r.leak) leak = true; items.push({ text: c.text, ok: r.ok, why: r.why }); });
    const ok = items.every(i => i.ok) && !leak;
    return { items, leak, ok };
  }

  /* ---------------------------------------------------------------- Rechnen (Richtwerte) */
  const PI4 = Math.PI / 4;
  const flaeche = d => PI4 * d * d;                                   /* mm^2 */
  const flaecheRing = (d, dk) => PI4 * (d * d - dk * dk);            /* mm^2 */
  const kraftAus = (pBar, dMm) => 0.1 * pBar * flaeche(dMm);         /* F = p * A, N  (1 bar = 0,1 N/mm^2) */
  const kraftEin = (pBar, dMm, dkMm) => 0.1 * pBar * flaecheRing(dMm, dkMm);
  const kraftNutz = (F, reibung) => F * (1 - (reibung == null ? 0.15 : reibung));   /* Reibung 10..20 % Richtwert */
  const druckFuerKraft = (F, dMm) => F / (0.1 * flaeche(dMm));      /* bar */
  /* Luftverbrauch je Hub in Normliter, Atmosphaerendruck vereinfacht 1 bar: V = A * s * (p + 1) */
  const luftHub = (pBar, dMm, hubMm, dkMm, was) => {
    const aK = flaeche(dMm), aR = dkMm != null ? flaecheRing(dMm, dkMm) : aK;
    const a = was === 'ein' ? aR : (was === 'zyklus' ? aK + aR : aK);
    return a * hubMm * (pBar + 1) / 1e6;
  };
  const geschw = (hubMm, tS) => hubMm / tS;                          /* mm/s */
  const round = (x, n) => { const f = Math.pow(10, n == null ? 2 : n); return Math.round(x * f) / f; };
  const fmt = (x, n) => (isFinite(x) ? round(x, n == null ? 2 : n).toFixed(n == null ? 2 : n).replace('.', ',') : '–');
  const calc = { flaeche, flaecheRing, kraftAus, kraftEin, kraftNutz, druckFuerKraft, luftHub, geschw, round, fmt };

  const API = { build, init, step, simulate, solve, setInput, pressure, runCheck, runChecks, goalOk, portsOf, norm, calc, throttled, DT, TH, V_BASE };
  root.PNE_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
