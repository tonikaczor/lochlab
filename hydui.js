'use strict';
/* Tonfunk Hydraulik-Lab: Oberfläche (Lab-Kennung 'hyd').
   Reiter: Schaltpläne (Simulation), Symbole, Rechner, Aufgaben (inkl. Verschlauchen), Trainer, Hilfe.
   Module: hydcore.js (HYD_CORE, Solver), hyddata.js (HYD_DATA, HYD_TASKS).
   Speicher (Präfix lm4.hyd.): tab, sim (letzte Schaltung), calc, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best), bau ({id:[[a,b],…]} gelegte Leitungen).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.HYD_CORE, D = root.HYD_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.hyd.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const f1 = v => C.fmtDe(v, 1), f2 = v => C.fmtDe(v, 2), f3 = v => C.fmtDe(v, 3), f0 = v => C.fmtDe(v, 0), fa = v => C.fmtAuto(v, 3);

  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => bd.remove();
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  if (!C || !D) {
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Hydraulik-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">hydcore.js oder hyddata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Schaltzeichen (SVG, DIN ISO 1219-1, vereinfacht) */
  const ln = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c || 'hs'}"/>`;
  const pa = (d, c) => `<path d="${d}" class="${c || 'hs'}"/>`;
  const rc = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c || 'hs'}"/>`;
  const ci = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" class="${c || 'hs'}"/>`;
  const tx = (x, y, t, c) => `<text x="${x}" y="${y}" class="${c || 'st'}">${t}</text>`;
  const hd = (x, y, dx, dy) => { const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, bx = x - ux * 7, by = y - uy * 7; return `<polygon points="${x},${y} ${bx - uy * 3.5},${by + ux * 3.5} ${bx + uy * 3.5},${by - ux * 3.5}" class="hf"/>`; };
  const zig = (x0, x1, y, n, a) => { const w = (x1 - x0) / n, p = [x0 + ',' + y]; for (let i = 0; i < n; i++) { p.push((x0 + (i + 0.25) * w).toFixed(1) + ',' + (y - a)); p.push((x0 + (i + 0.75) * w).toFixed(1) + ',' + (y + a)); } p.push(x1 + ',' + y); return `<polyline points="${p.join(' ')}" class="hs"/>`; };
  const magnet = x => rc(x, -14, 18, 28) + ln(x, 14, x + 18, -14);
  const tickT = (x, up) => up ? ln(x, -20, x, -12) + ln(x - 4, -12, x + 4, -12) : ln(x, 20, x, 12) + ln(x - 4, 12, x + 4, 12);
  const arrPar = cx => ln(cx - 10, 18, cx - 10, -18) + hd(cx - 10, -18, 0, -1) + ln(cx + 10, -18, cx + 10, 18) + hd(cx + 10, 18, 0, 1);
  const arrCross = cx => ln(cx - 10, 18, cx + 10, -18) + hd(cx + 10, -18, 20, -36) + ln(cx - 10, -18, cx + 10, 18) + hd(cx + 10, 18, 20, 36);
  const actBox = (cx, act) => act ? `<rect x="${cx - 20}" y="-20" width="40" height="40" class="vact"/>` : '';
  const boxR = cx => rc(cx - 20, -20, 40, 40);

  const SY = {
    pump: o => ({ s: ci(0, 0, 18) + '<polygon points="0,-13 -8,6 8,6" class="hf"/>' + ln(0, -18, 0, -46) + ln(0, 18, 0, 30) + pa('M-11,30 v10 h22 v-10') + (o.motor ? ln(-18, -3, -46, -3) + ln(-18, 3, -46, 3) + ci(-64, 0, 18) + tx(-64, 5, 'M') : ''), ports: { P: [0, -46, 'u'] } }),
    motor: () => ({ s: ci(0, 0, 18) + tx(0, 5, 'M') + ln(18, -3, 40, -3) + ln(18, 3, 40, 3), ports: {} }),
    tank: () => ({ s: ln(0, -22, 0, 6) + pa('M-20,0 V16 H20 V0'), ports: { T: [0, -22, 'u'] } }),
    filter: () => ({ s: '<polygon points="0,-16 16,0 0,16 -16,0" class="hs"/>' + ln(-16, 0, 16, 0, 'hs hd') + ln(0, -16, 0, -30) + ln(0, 16, 0, 30), ports: { 2: [0, -30, 'u'], 1: [0, 30, 'd'] } }),
    dbv: () => ({ s: rc(-14, -14, 28, 28) + ln(-6, 10, -6, -8) + hd(-6, -12, 0, -1) + ln(0, 14, 0, 44) + ln(0, -14, 0, -44) + pa('M0,28 H-26 V0 H-14', 'hs hd') + ci(0, 28, 2, 'hf') + zig(14, 36, 0, 3, 5) + ln(16, 11, 34, -11) + hd(34, -11, 1, -1.2), ports: { P: [0, 44, 'd'], T: [0, -44, 'u'] } }),
    cyl: o => { const p = o.pos == null ? 0.4 : o.pos; return { s: rc(-46, -13, 92, 26, 'hs hbg') + `<g class="pis" data-c="${esc(o.id || '')}" transform="translate(${(72 * p).toFixed(2)},0)">` + rc(-39, -13, 6, 26, 'hf') + rc(-33, -3, 94, 6, 'hf') + '</g>' + ln(-40, 13, -40, 40) + ln(40, 13, 40, 40), ports: { A: [-40, 40, 'd'], B: [40, 40, 'd'] } }; },
    cyle: o => { const p = o.pos == null ? 0.4 : o.pos; return { s: rc(-46, -13, 92, 26, 'hs hbg') + zig(-24, 44, -8, 6, 4) + `<g class="pis" data-c="${esc(o.id || '')}" transform="translate(${(72 * p).toFixed(2)},0)">` + rc(-39, -13, 6, 26, 'hf') + rc(-33, -3, 94, 6, 'hf') + '</g>' + ln(-40, 13, -40, 40) + ln(30, -13, 30, -22) + ln(26, -22, 34, -22), ports: { A: [-40, 40, 'd'] } }; },
    v43: o => {
      const mid = o.mid || 'sperr', act = o.act; let s = actBox(act === 'a' ? -40 : act === 'b' ? 40 : 0, act) + boxR(-40) + boxR(0) + boxR(40) + arrPar(-40) + arrCross(40);
      if (mid === 'sperr') s += tickT(-10, true) + tickT(10, true) + tickT(-10, false) + tickT(10, false);
      else if (mid === 'umlauf') s += tickT(-10, true) + tickT(10, true) + pa('M-10,18 V8 H10 V18') + hd(10, 18, 0, 1);
      else s += pa('M-10,-18 V-6 H10 V-18') + pa('M-10,18 V6 H10 V18') + ln(0, -6, 0, 6) + hd(10, 18, 0, 1);
      s += zig(-76, -60, 0, 2, 5) + magnet(-94) + zig(60, 76, 0, 2, 5) + magnet(76) + tx(-85, 32, 'a', 'st s') + tx(85, 32, 'b', 'st s');
      s += ln(-10, -20, -40, -46) + ln(10, -20, 40, -46) + ln(-10, 20, -40, 46) + ln(10, 20, 40, 46);
      return { s, ports: { A: [-40, -46, 'u'], B: [40, -46, 'u'], P: [-40, 46, 'd'], T: [40, 46, 'd'] } };
    },
    v42: o => {
      const act = o.act; let s = actBox(act === 'a' ? -40 : 0, act) + boxR(-40) + boxR(0) + arrPar(-40) + arrCross(0) + magnet(-78) + zig(20, 36, 0, 2, 5) + tx(-69, 32, 'a', 'st s');
      s += ln(-10, -20, -40, -46) + ln(10, -20, 40, -46) + ln(-10, 20, -40, 46) + ln(10, 20, 40, 46);
      return { s, ports: { A: [-40, -46, 'u'], B: [40, -46, 'u'], P: [-40, 46, 'd'], T: [40, 46, 'd'] } };
    },
    v32: o => {
      const act = o.act; let s = actBox(act === 'a' ? -40 : 0, act) + boxR(-40) + boxR(0);
      s += ln(-50, 18, -40, -18) + hd(-40, -18, 10, -36) + tickT(-30, false) + ln(0, -18, 10, 18) + hd(10, 18, 10, 36) + tickT(-10, false);
      s += magnet(-78) + zig(20, 36, 0, 2, 5) + tx(-69, 32, 'a', 'st s') + ln(0, -20, 0, -46) + ln(-10, 20, -40, 46) + ln(10, 20, 40, 46);
      return { s, ports: { A: [0, -46, 'u'], P: [-40, 46, 'd'], T: [40, 46, 'd'] } };
    },
    v22: o => {
      const act = o.act, open = o.rest === 'open'; let s = actBox(act === 'a' ? -40 : 0, act) + boxR(-40) + boxR(0);
      const openBox = cx => ln(cx, 18, cx, -18) + hd(cx, -18, 0, -1), closedBox = cx => tickT(cx, true) + tickT(cx, false);
      s += open ? closedBox(-40) + openBox(0) : openBox(-40) + closedBox(0);
      s += magnet(-78) + zig(20, 36, 0, 2, 5) + tx(-69, 32, 'a', 'st s') + ln(0, -20, 0, -46) + ln(0, 20, 0, 46);
      return { s, ports: { A: [0, -46, 'u'], P: [0, 46, 'd'] } };
    },
    rv: () => ({ s: ln(0, 38, 0, 10) + pa('M-9,0 L0,10 L9,0') + ci(0, -8, 7) + ln(0, -15, 0, -38), ports: { 1: [0, 38, 'd'], 2: [0, -38, 'u'] } }),
    rve: () => ({ s: ln(0, 38, 0, 10) + pa('M-9,0 L0,10 L9,0') + ci(0, -8, 7) + ln(0, -15, 0, -38) + ln(34, -8, 24, -8, 'hs hd') + rc(16, -14, 8, 12) + ln(16, -8, 7, -8), ports: { 1: [0, 38, 'd'], 2: [0, -38, 'u'], X: [34, -8, 'r'] } }),
    drossel: () => ({ s: ln(0, 38, 0, -38) + pa('M-12,-14 Q6,0 -12,14') + pa('M12,-14 Q-6,0 12,14') + ln(-17, 17, 17, -17, 'hs') + hd(17, -17, 1, -1), ports: { 1: [0, 38, 'd'], 2: [0, -38, 'u'] } }),
    drv: () => ({ s: rc(-36, -46, 72, 92, 'hs hd') + ln(0, 56, 0, 36) + ln(0, -36, 0, -56) + pa('M-20,36 H20 M-20,-36 H20 M-20,36 V-36 M20,36 V10 M20,-36 V-15') + pa('M-26,-12 Q-14,0 -26,12') + pa('M-14,-12 Q-26,0 -14,12') + pa('M11,0 L20,10 L29,0') + ci(20, -8, 7) + ci(0, 36, 2, 'hf') + ci(0, -36, 2, 'hf'), ports: { 1: [0, 56, 'd'], 2: [0, -56, 'u'] } }),
    mano: () => ({ s: ci(0, 0, 15) + ln(0, 0, 8, -8) + hd(8, -8, 1, -1) + pa('M-10,8 A12,12 0 1 1 10,8') + ln(0, 15, 0, 40), ports: { M: [0, 40, 'd'] } })
  };
  /* Bibliothek: Schlüssel -> {kind, opts}; Rahmen (Bounding Box) je Bauart */
  const LIB = { pump: ['pump', {}], motor: ['motor', {}], tank: ['tank', {}], filter: ['filter', {}], dbv: ['dbv', {}], cyl: ['cyl', {}], cyle: ['cyle', {}], v43: ['v43', { mid: 'sperr' }], v43u: ['v43', { mid: 'umlauf' }], v43h: ['v43', { mid: 'H' }], v42: ['v42', {}], v32: ['v32', {}], v22: ['v22', {}], rv: ['rv', {}], rve: ['rve', {}], drossel: ['drossel', {}], drv: ['drv', {}], mano: ['mano', {}] };
  const BOX = { pump: [-30, -64, 30, 52], motor: [-26, -26, 46, 26], tank: [-26, -30, 26, 22], filter: [-24, -42, 24, 42], dbv: [-34, -56, 42, 56], cyl: [-54, -22, 140, 56], cyle: [-54, -28, 140, 56], v43: [-100, -58, 100, 58], v42: [-84, -58, 44, 58], v32: [-84, -58, 44, 58], v22: [-84, -58, 44, 58], rv: [-18, -48, 18, 48], rve: [-18, -48, 46, 48], drossel: [-24, -48, 24, 48], drv: [-42, -66, 42, 66], mano: [-22, -22, 22, 54] };
  function symSvg(key, o) {
    o = o || {}; const L = LIB[key] || [key, {}], kind = L[0], r = SY[kind](Object.assign({}, L[1], o)), b = BOX[kind], w = b[2] - b[0], h = b[3] - b[1];
    let lab = ''; if (o.labels) Object.keys(r.ports).forEach(n => { const p = r.ports[n], d = p[2], dx = d === 'l' ? -9 : d === 'r' ? 9 : 0, dy = d === 'u' ? -9 : d === 'd' ? 16 : 4; lab += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="pt"/>` + tx(p[0] + dx, p[1] + dy, n, 'pl' + (d === 'l' ? ' e' : d === 'r' ? ' b' : '')); });
    return `<svg class="sym" viewBox="${b[0]} ${b[1]} ${w} ${h}" width="${Math.round(w * (o.scale || 0.95))}" height="${Math.round(h * (o.scale || 0.95))}" role="img" aria-label="${esc(o.aria || 'Schaltzeichen')}">${r.s}${lab}</svg>`;
  }
  const symRow = keys => `<div class="symrow">${keys.map(k => symSvg(k, { aria: 'Schaltzeichen' })).join('')}</div>`;

  /* ============================================================ Anlage: Platzierung, Leitungen, Zeichnung */
  const rotP = (x, y, r) => r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
  const rotD = (d, r) => { const o = ['u', 'r', 'd', 'l'], i = o.indexOf(d); return o[(i + (r || 0) / 90) % 4]; };
  const LBL = { pump: [26, -40], tank: [24, -2], dbv: [36, -24], cyl: [-46, -20], cyle: [-46, -20], v43: [-100, -52], v42: [-84, -52], v32: [-84, -52], v22: [-84, -52], rv: [14, -22], rve: [14, -30], drossel: [14, -30], drv: [40, -40], mano: [18, -14] };
  function placed(circ) {
    if (circ._pl) return circ._pl;
    const pl = {};
    circ.parts.forEach(p => {
      const r = p.rot || 0, o = Object.assign({ id: p.id, motor: p.kind === 'pump', mid: p.mid, rest: p.rest }, {}), sym = SY[p.kind](o), ports = {};
      Object.keys(sym.ports).forEach(n => { const q = sym.ports[n], pt = rotP(q[0], q[1], r); ports[n] = { x: p.x + pt[0], y: p.y + pt[1], d: rotD(q[2], r) }; });
      pl[p.id] = { ports };
    });
    circ._pl = pl; return pl;
  }
  const portAbs = (circ, key) => { const a = key.split('.'), pl = placed(circ)[a[0]]; return pl && pl.ports[a[1]]; };
  function route(a, b) {
    const Dd = 14, out = p => ({ u: [0, -Dd], d: [0, Dd], l: [-Dd, 0], r: [Dd, 0] }[p.d]), oa = out(a), ob = out(b), p1 = [a.x + oa[0], a.y + oa[1]], p3 = [b.x + ob[0], b.y + ob[1]];
    const va = a.d === 'u' || a.d === 'd', vb = b.d === 'u' || b.d === 'd'; let mid;
    if (va && vb) { const my = (p1[1] + p3[1]) / 2; mid = [[p1[0], my], [p3[0], my]]; }
    else if (!va && !vb) { const mx = (p1[0] + p3[0]) / 2; mid = [[mx, p1[1]], [mx, p3[1]]]; }
    else if (va) mid = [[p1[0], p3[1]]]; else mid = [[p3[0], p1[1]]];
    const pts = [[a.x, a.y], p1].concat(mid, [p3, [b.x, b.y]]), res = [];
    pts.forEach(p => { const l = res[res.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 0.01 || Math.abs(l[1] - p[1]) > 0.01) res.push(p); });
    return res;
  }
  const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  function pColor(p, ref) { if (p < 1.5) return 'var(--hy-t)'; const t = Math.min(1, Math.max(0, p / (ref || 100))); return `hsl(${Math.round(48 * (1 - t))},92%,${Math.round(52 - 6 * t)}%)`; }

  /* o: { mode:'wire'|'sim'|'view', lines:[[a,b]…] (alle), fixedN (die ersten n sind fest), st, res, sel, probe } */
  function anlageSvg(circ, o) {
    const pl = placed(circ), lines = o.lines || [], st = o.st, res = o.res, sim = o.mode === 'sim', refP = res ? Math.max(40, ...Object.values(res.pset || {}), 40) : 100;
    let s = '', top = '', hit = '';
    /* Teile */
    circ.parts.forEach(p => {
      const r = p.rot || 0, ob = { id: p.id, motor: p.kind === 'pump', mid: p.mid, rest: p.rest, act: st && C.isValve(p) ? st.v[p.id] : null, pos: st && C.isCyl(p) ? st.pos[p.id] : (p.pos0 || 0) };
      const sym = SY[p.kind](ob), lb = LBL[p.kind] || [20, -20];
      s += `<g transform="translate(${p.x},${p.y})${r ? ' rotate(' + r + ')' : ''}">${sym.s}</g>`;
      if (p.label) { let lx = p.x + lb[0], ly = p.y + lb[1]; if (r === 180) { lx = p.x - lb[0] + (p.kind === 'dbv' ? 0 : 0); ly = p.y - lb[1]; if (p.kind === 'dbv') { lx = p.x + 36; ly = p.y + 30; } } s += `<text x="${lx}" y="${ly}" class="plab">${esc(p.label)}</text>`; }
      if (C.isCyl(p)) { const g = C.cylGeom(p); s += `<text x="${p.x - 46}" y="${p.y - 32}" class="pinfo">Ø${p.D || 50}${p.kind === 'cyl' ? '/' + (p.d || 28) : ''} · Hub ${p.stroke || 200} mm${p.load && p.load.F ? ' · Last ' + fa(p.load.F / 1000) + ' kN' : ''}</text>`; }
      if (p.kind === 'dbv' && sim && st) s += `<text x="${p.x + (r === 180 ? 36 : 36)}" y="${p.y + (r === 180 ? 44 : -36)}" class="pinfo">${f0(st.pset[p.id])} bar</text>`;
      if (p.kind === 'mano' && sim && res) { const key = p.id + '.M', pr = res.portP[key]; s += `<text x="${p.x + 20}" y="${p.y + 5}" class="pread">${f1(Math.max(0, pr || 0))} bar</text>`; }
    });
    /* Leitungen */
    lines.forEach((l, i) => {
      const a = portAbs(circ, l[0]), b = portAbs(circ, l[1]); if (!a || !b) return;
      const d = pathD(route(a, b)), fixed = i < (o.fixedN || 0), pilot = /\.X$/.test(l[0]) || /\.X$/.test(l[1]);
      let col = fixed ? 'var(--mute)' : 'var(--accent)', fl = 0;
      if (sim && res) { col = pColor(res.lineP[i] || 0, refP); fl = res.lineFlow[i] || 0; }
      s += `<path d="${d}" class="ln${pilot ? ' pil' : ''}" style="stroke:${col}"/>`;
      if (sim && res && Math.abs(fl) > 0.05) { const dur = Math.max(0.35, Math.min(2.2, 1.6 / (0.4 + Math.abs(fl) / 4))).toFixed(2); s += `<path d="${d}" class="lf ${fl < 0 ? 'rv' : 'fw'}" style="animation-duration:${dur}s"/>`; }
      if (o.mode === 'wire' && !fixed) hit += `<path d="${d}" class="lhit" data-line="${i}"/>`;
    });
    /* Anschlüsse */
    const used = {}; lines.forEach(l => { used[l[0]] = (used[l[0]] || 0) + 1; used[l[1]] = (used[l[1]] || 0) + 1; });
    circ.parts.forEach(p => {
      const pr = pl[p.id].ports; Object.keys(pr).forEach(n => {
        const q = pr[n], key = p.id + '.' + n, dx = q.d === 'l' ? -11 : q.d === 'r' ? 11 : 0, dy = q.d === 'u' ? -9 : q.d === 'd' ? 17 : 4;
        top += `<circle cx="${q.x}" cy="${q.y}" r="${o.sel === key ? 7 : 4.5}" class="pt${used[key] ? ' on' : ''}${o.sel === key ? ' sel' : ''}"/>`;
        top += `<text x="${q.x + dx}" y="${q.y + dy}" class="pl${q.d === 'l' ? ' e' : q.d === 'r' ? ' b' : ''}">${n}</text>`;
        if (o.mode === 'wire') top += `<circle cx="${q.x}" cy="${q.y}" r="28" class="phit" data-port="${key}"><title>${esc(p.id + ' Anschluss ' + n)}</title></circle>`;
      });
    });
    return `<svg viewBox="0 0 ${circ.W} ${circ.H}" class="anl" role="img" aria-label="${esc(circ.title)}">${s}${hit}${top}</svg>`;
  }

  /* ============================================================ Simulation (Schaltpläne lesen, Probelauf) */
  const POSLAB = { v43: { a: 'a', 0: '0 (Mitte)', b: 'b' }, v42: { a: 'a (Magnet)', 0: '0 (Feder)' }, v32: { a: 'a (Magnet)', 0: '0 (Feder)' }, v22: { a: 'a (Magnet)', 0: '0 (Feder)' } };
  function mountSim(host, circId, o) {
    o = o || {}; const circ = D.circuits[circId], lines = o.lines || circ.ref, task = o.mode === 'task';
    let st = C.makeState(circ), res = C.solve(circ, lines, st), speed = 1, readT = 0, last = 0, stopped = false;
    const dbvs = circ.parts.filter(p => p.kind === 'dbv'), valves = circ.parts.filter(C.isValve), cyls = circ.parts.filter(C.isCyl);
    host.classList.add('simhost');
    host.innerHTML = `<div class="inst anl-wrap"><div id="sv_${circId}" class="svgbox"></div></div>
      <div class="ctl" id="sc_${circId}"></div><div id="sr_${circId}"></div>`;
    const box = $('.svgbox', host), ctl = $('.ctl', host), rd = host.lastElementChild;
    function buildCtl() {
      let h = '';
      valves.forEach(v => { const lab = POSLAB[v.kind], pos = C.VALVE_POS[v.kind]; h += `<span class="vgrp"><b>${esc(v.id)}</b><span class="seg" role="group">${pos.map(p => `<button data-v="${v.id}" data-p="${p}" class="${st.v[v.id] === p ? 'on' : ''}" aria-pressed="${st.v[v.id] === p}">${esc(lab[p])}</button>`).join('')}</span></span>`; });
      if (!task) dbvs.forEach(v => { h += `<span class="vgrp"><b>${esc(v.id)}</b><span class="seg"><button data-d="${v.id}" data-s="-10" aria-label="Druck verringern">−</button><button disabled class="val">${f0(st.pset[v.id])} bar</button><button data-d="${v.id}" data-s="10" aria-label="Druck erhöhen">+</button></span></span>`; });
      if (!task) h += `<button class="chip s${st.pumpOn === false ? '' : ' on'}" data-a="pump" aria-pressed="${st.pumpOn !== false}">Pumpe ${st.pumpOn === false ? 'aus' : 'an'}</button><button class="chip s${speed > 1 ? ' on' : ''}" data-a="speed" aria-pressed="${speed > 1}">Zeitraffer ×4</button>`;
      h += '<button class="chip s" data-a="reset">Zurücksetzen</button>';
      ctl.innerHTML = h;
    }
    function readout() {
      let h = ''; const p = res.pump;
      if (p) h += `<div class="rdl"><b>Pumpe</b> ${f1(Math.max(0, p.p))} bar · ${f1(p.q)} l/min · P<sub>hyd</sub> = ${f2(p.kw)} kW</div>`;
      dbvs.forEach(v => { const d = res.dbv[v.id]; if (d) h += `<div class="rdl"><b>${esc(v.id)}</b> Druckbegrenzung ${d.open ? 'öffnet: ' + f1(d.q) + ' l/min fließen zum Tank' : 'geschlossen'}</div>`; });
      cyls.forEach(z => { const r = res.cyl[z.id]; if (!r) return; const v = Math.abs(r.v), txt = r.dir > 0 ? 'fährt aus' : r.dir < 0 ? 'fährt ein' : 'steht'; h += `<div class="rdl"><b>${esc(z.id)}</b> ${txt}${r.dir ? ' mit v = ' + f3(v) + ' m/s (Q = ' + f1(Math.abs(r.q) * (r.dir > 0 ? 1 : (r.AB || r.AA) / r.AA)) + ' l/min)' : ''} · p<sub>A</sub> ${f1(Math.max(0, r.pA))} bar${r.AB ? ' · p<sub>B</sub> ' + f1(Math.max(0, r.pB)) + ' bar' : ''} · Position ${f0(st.pos[z.id] * 100)} %</div>`; });
      if (res.overp) h += '<div class="rdl warn">⚠ Der Druck steigt unzulässig: kein Weg zum Tank über ein Druckbegrenzungsventil. In der Praxis würden Leitungen oder Dichtungen versagen.</div>';
      if (res.kav) h += '<div class="rdl warn">⚠ Unterdruck in einer Kammer (Kavitation): Die Last läuft schneller, als die Pumpe nachfördert. Ohne Bremsventil ist das gefährlich.</div>';
      if (!res.overp && !res.kav && p && p.p > 1.5 && !(cyls[0] && res.cyl[cyls[0].id].dir) && Object.keys(res.dbv).some(k => res.dbv[k].open)) h += '<div class="rdl hint">Der Zylinder steht, der Pumpenstrom fließt über das Druckbegrenzungsventil ab: Der Druck steht auf dem Einstelldruck.</div>';
      rd.innerHTML = `<div class="rdout">${h}</div>` + (o.mode === 'tab' ? `<div class="rdout"><b>Schaltung:</b> ${esc(circ.info)}<ul class="tl" style="margin:6px 0 0">${circ.tryIt.map(t => '<li>' + esc(t) + '</li>').join('')}</ul></div>` : '') + '<p class="hint2">Farben: blau = drucklos (Tank, Rücklauf), gelb bis rot = steigender Druck. Laufende Striche zeigen den Ölstrom.</p>' + (root.HYDVIZ && !task ? root.HYDVIZ.gauges(circ, res, st) : '');
    }
    function draw() { box.innerHTML = anlageSvg(circ, { mode: 'sim', lines, st, res }); }
    function solveAll() { res = C.solve(circ, lines, st); draw(); buildCtl(); readout(); }
    host.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v) { st.v[b.dataset.v] = b.dataset.p; solveAll(); }
      else if (b.dataset.d) { const id = b.dataset.d; st.pset[id] = Math.max(10, Math.min(200, st.pset[id] + (+b.dataset.s))); solveAll(); }
      else if (b.dataset.a === 'pump') { st.pumpOn = st.pumpOn === false; solveAll(); }
      else if (b.dataset.a === 'speed') { speed = speed > 1 ? 1 : 4; buildCtl(); }
      else if (b.dataset.a === 'reset') { st = C.makeState(circ); solveAll(); }
    });
    function tick(ts) {
      if (stopped || !host.isConnected) { stopped = true; return; }
      const dt = Math.min(0.06, last ? (ts - last) / 1000 : 0.016); last = ts; let hit = false;
      cyls.forEach(z => { const r = res.cyl[z.id]; if (!r || !r.dir) return; const s = (z.stroke || 200) / 1000, p0 = st.pos[z.id]; let p1 = p0 + r.v * dt * speed / s; if (p1 >= 1) { p1 = 1; hit = true; } if (p1 <= 0) { p1 = 0; hit = true; } st.pos[z.id] = p1; const g = box.querySelector('.pis[data-c="' + z.id + '"]'); if (g) g.setAttribute('transform', 'translate(' + (72 * p1).toFixed(2) + ',0)'); });
      readT += dt;
      if (hit) solveAll(); else if (readT > 0.25) { readT = 0; readout(); }
      requestAnimationFrame(tick);
    }
    draw(); buildCtl(); readout(); requestAnimationFrame(tick);
    return { st: () => st, res: () => res, set: (k, v) => { st.v[k] = v; solveAll(); } };
  }

  /* ============================================================ Verschlauchen (Leitungen legen) */
  function createWire(taskId, circId) {
    const circ = D.circuits[circId], fixed = circ.fixed, el = document.createElement('div'); el.className = 'wirebox';
    const saved = (lsGet('bau', {})[taskId] || []).filter(l => Array.isArray(l) && l.length === 2 && portAbs(circ, l[0]) && portAbs(circ, l[1]));
    const W = { lines: saved, sel: null, undo: [], probe: false };
    const all = () => fixed.concat(W.lines);
    const save = () => { const b = lsGet('bau', {}); b[taskId] = W.lines; lsSet('bau', b); };
    function render() {
      el.innerHTML = `<div class="fbar" style="margin-bottom:6px"><span class="lbl">${W.sel ? 'Verbinde ' + esc(W.sel) + ' mit …' : 'Tippe einen Anschluss an, dann den zweiten'}</span><span class="lbl" style="margin-left:auto">${W.lines.length} Leitung${W.lines.length === 1 ? '' : 'en'} gelegt</span></div>
        <div class="inst anl-wrap"><div class="svgbox">${anlageSvg(circ, { mode: 'wire', lines: all(), fixedN: fixed.length, sel: W.sel })}</div></div>
        <div class="ctl"><button class="chip s" data-w="undo"${W.undo.length ? '' : ' disabled'}>↶ Rückgängig</button><button class="chip s" data-w="clear"${W.lines.length ? '' : ' disabled'}>Alle Leitungen löschen</button><button class="chip s${W.probe ? ' on' : ''}" data-w="probe" aria-pressed="${W.probe}">▶ Probelauf ${W.probe ? 'ausblenden' : 'zeigen'}</button></div>
        <p class="hint2">Tippe auf eine gelegte Leitung, um sie zu entfernen. Graue Leitungen sind fest verlegt. Ein Anschluss darf mehrere Leitungen haben.</p><div class="probe"></div>`;
      if (W.probe) { const h = $('.probe', el); h.className = 'probe'; mountSim(h, circId, { lines: all(), mode: 'probe' }); }
    }
    el.addEventListener('click', e => {
      const port = e.target.closest('[data-port]'), line = e.target.closest('[data-line]'), b = e.target.closest('button[data-w]');
      if (b) {
        const a = b.dataset.w;
        if (a === 'undo') { const u = W.undo.pop(); if (u) W.lines = u; }
        else if (a === 'clear') { W.undo.push(W.lines.slice()); W.lines = []; W.sel = null; }
        else if (a === 'probe') W.probe = !W.probe;
        save(); render(); if (el.onchange) el.onchange(); return;
      }
      if (port) {
        const k = port.dataset.port;
        if (!W.sel) { W.sel = k; render(); return; }
        if (W.sel === k) { W.sel = null; render(); return; }
        const dup = all().some(l => (l[0] === W.sel && l[1] === k) || (l[0] === k && l[1] === W.sel));
        if (dup) { toast('Diese Leitung gibt es schon.'); W.sel = null; render(); return; }
        const cnt = key => all().filter(l => l[0] === key || l[1] === key).length;
        if (cnt(k) >= 4 || cnt(W.sel) >= 4) { toast('An einem Anschluss sind höchstens 4 Leitungen möglich.'); W.sel = null; render(); return; }
        W.undo.push(W.lines.slice()); W.lines.push([W.sel, k]); W.sel = null; save(); render(); if (el.onchange) el.onchange(); return;
      }
      if (line) { const i = +line.dataset.line - fixed.length; if (i >= 0 && i < W.lines.length) { W.undo.push(W.lines.slice()); W.lines.splice(i, 1); W.sel = null; save(); toast('Leitung entfernt.'); render(); if (el.onchange) el.onchange(); } }
    });
    el.getLines = () => W.lines.slice(); el.getAll = all; el.rerender = render; render();
    return el;
  }

  /* ============================================================ Zustand */
  const TABS = [['sim', '⚙️', 'Schaltpläne'], ['bsp', '💡', 'Beispiele'], ['sym', '🔣', 'Symbole'], ['calc', '🧮', 'Rechner'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();
  const S = {
    tab: lsGet('tab', 'sim'), simId: lsGet('sim', 'C1'),
    calc: Object.assign({ D: '50', d: '28', p: '100', Q: '10', s: '200', eta: '0,85', Vg: '8', n: '1450', ev: '0,92', d1: '25', d2: '100', F1: '1' }, lsGet('calc', {})),
    task: null, inst: null, tAns: {}, tRes: null, simEl: null, wireEl: null,
    tr: { kind: 'mixed', q: null, ans: '', c: null, res: null },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (!D.circuits[S.simId]) S.simId = 'C1';
  if (!TABS.some(t => t[0] === S.tab)) S.tab = 'sim';

  /* ============================================================ Reiter Schaltpläne */
  function renderSim() {
    const V = $('#simView'), id = S.simId, c = D.circuits[id];
    let h = `<div class="card pl"><h4>Schaltpläne lesen und ausprobieren</h4><div class="fbar"><div class="seg" style="flex-wrap:wrap;border-radius:20px">${D.circuitList.map(k => `<button data-circ="${k}" class="${k === id ? 'on' : ''}" aria-pressed="${k === id}">${k.slice(1)} · ${esc(D.circuits[k].short)}</button>`).join('')}</div></div>
      <div class="big" style="font-size:17px">${esc(c.title)}</div><div id="simHost"></div></div>`;
    V.innerHTML = h; mountSim($('#simHost'), id, { mode: 'tab' });
  }
  $('#simView').addEventListener('click', e => { const b = e.target.closest('[data-circ]'); if (b) { S.simId = b.dataset.circ; lsSet('sim', S.simId); renderSim(); } });

  /* ============================================================ Reiter Symbole */
  function renderSym() {
    $('#symView').innerHTML = `<div class="card pl"><h4>Symbolbibliothek (DIN ISO 1219-1, vereinfacht)</h4><p class="hint2" style="margin:0 0 6px">Die Schaltzeichen zeigen die Grundstellung. Die Anschlüsse sind beschriftet. Ventile: Erst die Zahl der Anschlüsse, dann die der Schaltstellungen (4/3 = 4 Anschlüsse, 3 Stellungen).</p></div>` +
      D.symbols.map(s => `<div class="card pl symcard"><div class="symfig">${symSvg(s.k, { labels: true, aria: s.name })}</div><div class="symtx"><div class="big" style="font-size:16px">${esc(s.name)}</div><div class="hint2" style="margin:0 0 4px">Anschlüsse: <b style="color:var(--fg)">${esc(s.ports)}</b></div><div style="font-size:14px;line-height:1.45">${esc(s.text.replace(/ ?\/\* PRUEFEN \*\/.*$/, ''))}</div></div></div>`).join('');
  }

  /* ============================================================ Reiter Rechner */
  function renderCalc() {
    const c = S.calc, inp = (id, lab, v, u) => `<label class="f"><span>${lab}</span><div class="qin"><input id="${id}" inputmode="decimal" autocomplete="off" value="${esc(v)}"><span class="u">${u}</span></div></label>`;
    $('#calcView').innerHTML = `<div class="card pl"><h4>Zylinder: Fläche, Kraft, Geschwindigkeit</h4>
      <div class="dsrow">${inp('cD', 'Kolbendurchmesser D', c.D, 'mm')}${inp('cd', 'Stangendurchmesser d', c.d, 'mm')}${inp('cp', 'Druck p', c.p, 'bar')}${inp('cQ', 'Volumenstrom Q', c.Q, 'l/min')}${inp('cs', 'Hub s', c.s, 'mm')}</div><div id="cylRes"></div><div id="vzCyl"></div></div>
      <div class="card pl"><h4>Pumpe: Förderstrom und Antriebsleistung</h4>
      <div class="dsrow">${inp('cVg', 'Verdrängungsvolumen V<sub>g</sub>', c.Vg, 'cm³/U')}${inp('cn', 'Drehzahl n', c.n, '1/min')}${inp('cev', 'Volumetr. Wirkungsgrad η<sub>v</sub>', c.ev, '')}${inp('ceta', 'Gesamtwirkungsgrad η<sub>ges</sub>', c.eta, '')}</div><div id="pumpRes"></div><div id="vzPump"></div></div>
      <div class="card pl"><h4>Hydraulische Presse (Kraftübersetzung)</h4>
      <div class="dsrow">${inp('cF1', 'Kraft am kleinen Kolben F₁', c.F1, 'kN')}${inp('cd1', 'Durchmesser klein d₁', c.d1, 'mm')}${inp('cd2', 'Durchmesser groß d₂', c.d2, 'mm')}</div><div id="pressRes"></div><div id="vzPress"></div></div>
      <div class="card pl"><h4>Einheiten umrechnen</h4><div class="dsrow">${inp('uV', 'Wert', c.uV || '1', '')}</div><div id="unitRes"></div></div>`;
    updateCalc();
  }
  function updateCalc() {
    const c = S.calc, g = id => C.parseDe($('#' + id) ? $('#' + id).value : ''); lsSet('calc', c);
    const D1 = g('cD'), d1 = g('cd'), p = g('cp'), Q = g('cQ'), s = g('cs'), ok = v => isFinite(v) && v > 0;
    let h = '';
    if (!ok(D1)) h = '<div class="rdout bad">Bitte einen Kolbendurchmesser eingeben.</div>';
    else {
      const r = C.cylinderCalc({ D: D1, d: isFinite(d1) && d1 > 0 && d1 < D1 ? d1 : NaN, p: isFinite(p) ? p : NaN, Q: isFinite(Q) ? Q : NaN, s: isFinite(s) ? s : NaN });
      const hasd = isFinite(d1) && d1 > 0 && d1 < D1;
      h = `<table class="tt"><tr><th>Größe</th><th>Formel</th><th class="n">Ergebnis</th></tr>
        <tr><td>Kolbenfläche A<sub>K</sub></td><td>π/4 · D² / 100</td><td class="n"><b>${f2(r.AA)} cm²</b></td></tr>
        ${hasd ? `<tr><td>Ringfläche A<sub>R</sub></td><td>A<sub>K</sub> − π/4 · d² / 100</td><td class="n"><b>${f2(r.AB)} cm²</b></td></tr>` : ''}
        ${r.Fout != null ? `<tr><td>Kraft Ausfahren</td><td>F = p · A<sub>K</sub> · 10</td><td class="n"><b>${f2(r.Fout / 1000)} kN</b></td></tr>` : ''}
        ${r.Fin != null && hasd ? `<tr><td>Kraft Einfahren</td><td>F = p · A<sub>R</sub> · 10</td><td class="n"><b>${f2(r.Fin / 1000)} kN</b></td></tr>` : ''}
        ${r.vOut != null ? `<tr><td>Geschwindigkeit Ausfahren</td><td>v = Q / (6 · A<sub>K</sub>)</td><td class="n"><b>${f3(r.vOut)} m/s</b></td></tr>` : ''}
        ${r.vIn != null && hasd ? `<tr><td>Geschwindigkeit Einfahren</td><td>v = Q / (6 · A<sub>R</sub>)</td><td class="n"><b>${f3(r.vIn)} m/s</b></td></tr>` : ''}
        ${r.tOut != null ? `<tr><td>Hubzeit Ausfahren</td><td>t = s / v</td><td class="n"><b>${f2(r.tOut)} s</b></td></tr>` : ''}
        ${r.tIn != null && hasd ? `<tr><td>Hubzeit Einfahren</td><td>t = s / v</td><td class="n"><b>${f2(r.tIn)} s</b></td></tr>` : ''}
        ${r.Phyd != null ? `<tr><td>Hydraulische Leistung</td><td>P = p · Q / 600</td><td class="n"><b>${f2(r.Phyd)} kW</b></td></tr>` : ''}</table>
        <p class="hint2">Reibung und Wirkungsgrad sind nicht berücksichtigt. Die Ausfahrkraft ist größer als die Einfahrkraft (A<sub>K</sub> &gt; A<sub>R</sub>), das Einfahren ist schneller.</p>`;
    }
    $('#cylRes').innerHTML = h;
    $('#vzCyl').innerHTML = root.HYDVIZ ? root.HYDVIZ.zylinder({ D: D1, d: d1, p, Q, s }) : '';
    const Vg = g('cVg'), n = g('cn'), ev = g('cev'), et = g('ceta'); let h2 = '';
    if (ok(Vg) && ok(n)) {
      const Qp = C.pumpFlow(Vg, n, ok(ev) && ev <= 1 ? ev : 1), Ph = isFinite(p) && p > 0 ? C.power(p, Qp) : null;
      h2 = `<table class="tt"><tr><td>Förderstrom Q = V<sub>g</sub> · n · η<sub>v</sub> / 1000</td><td class="n"><b>${f2(Qp)} l/min</b></td></tr>${Ph != null ? `<tr><td>Hydraulische Leistung bei ${fa(p)} bar</td><td class="n"><b>${f2(Ph)} kW</b></td></tr>` : ''}${Ph != null && ok(et) && et <= 1 ? `<tr><td>Antriebsleistung P<sub>an</sub> = P<sub>hyd</sub> / η<sub>ges</sub></td><td class="n"><b>${f2(Ph / et)} kW</b></td></tr>` : ''}</table><p class="hint2">Der Druck p wird aus dem Zylinder-Rechner oben übernommen.</p>`;
    } else h2 = '<div class="rdout bad">Bitte V<sub>g</sub> und n eingeben.</div>';
    $('#pumpRes').innerHTML = h2;
    $('#vzPump').innerHTML = root.HYDVIZ ? root.HYDVIZ.pumpe({ Vg, n, ev, et, p }) : '';
    const F1 = g('cF1'), a1 = g('cd1'), a2 = g('cd2'); let h3 = '';
    if (ok(F1) && ok(a1) && ok(a2)) { const A1 = C.areaCircle(a1), A2 = C.areaCircle(a2), p1 = C.pressureOf(F1 * 1000, A1), F2 = C.pressForce(F1, A1, A2); h3 = `<table class="tt"><tr><td>Druck p = F₁ / A₁</td><td class="n"><b>${f1(p1)} bar</b></td></tr><tr><td>Kraft am großen Kolben F₂ = p · A₂</td><td class="n"><b>${f2(F2)} kN</b></td></tr><tr><td>Übersetzung F₂ / F₁ = (d₂ / d₁)²</td><td class="n"><b>${f2(F2 / F1)}</b></td></tr><tr><td>Wegverhältnis s₂ / s₁</td><td class="n"><b>1 : ${f2(F2 / F1)}</b></td></tr></table><p class="hint2">Verlustfrei gerechnet. Wirkungsgrad-Richtwert für reale Pressen: 0,85 bis 0,95 (Reibung).</p>`; } else h3 = '<div class="rdout bad">Bitte alle drei Werte eingeben.</div>';
    $('#pressRes').innerHTML = h3;
    $('#vzPress').innerHTML = root.HYDVIZ ? root.HYDVIZ.presse({ F1, d1: a1, d2: a2 }) : '';
    const v = g('uV'); let h4 = '';
    if (isFinite(v)) h4 = `<table class="tt"><tr><td>${fa(v)} bar</td><td class="n">${fa(v / 10)} MPa · ${fa(v * 1e5)} Pa · ${fa(v * 10)} N/cm²</td></tr><tr><td>${fa(v)} MPa</td><td class="n">${fa(v * 10)} bar</td></tr><tr><td>${fa(v)} l/min</td><td class="n">${fa(v * 1000 / 60)} cm³/s · ${fa(v / 60000)} m³/s</td></tr><tr><td>${fa(v)} cm³/s</td><td class="n">${fa(v * 60 / 1000)} l/min</td></tr><tr><td>${fa(v)} m/s</td><td class="n">${fa(v * 60)} m/min · ${fa(v * 100)} cm/s</td></tr><tr><td>${fa(v)} kN</td><td class="n">${fa(v * 1000)} N</td></tr><tr><td>${fa(v)} kW</td><td class="n">${fa(v * 1000)} W</td></tr></table><p class="hint2">1 bar = 0,1 MPa = 100 000 Pa = 10 N/cm². 1 l/min = 1000 cm³ / 60 s ≈ 16,7 cm³/s.</p>`;
    else h4 = '<div class="rdout bad">Bitte eine Zahl eingeben.</div>';
    $('#unitRes').innerHTML = h4;
  }
  $('#calcView').addEventListener('input', e => {
    const m = { cD: 'D', cd: 'd', cp: 'p', cQ: 'Q', cs: 's', cVg: 'Vg', cn: 'n', cev: 'ev', ceta: 'eta', cF1: 'F1', cd1: 'd1', cd2: 'd2', uV: 'uV' }[e.target.id]; if (!m) return; S.calc[m] = e.target.value; updateCalc();
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  function updateBadge() { const b = $('#tkBd'); if (!b) return; b.textContent = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  const shuffleInst = (inst, R) => { if (!inst.choices) return inst; const order = C.shuffle(R, inst.choices.map((_, i) => i)); return Object.assign({}, inst, { choices: order.map(i => inst.choices[i]), correct: order.indexOf(inst.correct) }); };
  function solutionText(t, inst) {
    if (t.kind === 'choice') return inst.choices[inst.correct];
    if (t.kind === 'num') return fa(inst.value) + ' ' + inst.unit;
    const c = D.circuits[inst.circ]; return c.ref.filter(l => !c.fixed.some(f => f[0] === l[0] && f[1] === l[1])).map(l => l.join(' – ')).join(', ');
  }
  function checkTask(t) {
    const inst = S.inst, a = S.tAns[t.id] || {}; let ok = false, lines = [], given = '', steps = null;
    if (t.kind === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return; } ok = a.c === inst.correct; given = inst.choices[a.c]; lines.push({ ok, text: ok ? 'Richtig: ' + given : 'Deine Antwort „' + given + '“ stimmt nicht.' }); }
    else if (t.kind === 'num') {
      const v = C.parseDe(a.v); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
      ok = Math.abs(v - inst.value) <= inst.tol + 1e-9; given = fa(v) + ' ' + inst.unit; lines.push({ ok, text: ok ? 'Richtig: ' + given : 'Deine Antwort „' + given + '“ stimmt nicht.' }); lines.push({ ok: true, info: true, text: 'Erlaubt ist eine Abweichung von ±' + fa(inst.tol) + ' ' + inst.unit + ' (Rundung).' });
    } else {
      const circ = D.circuits[inst.circ], user = S.wireEl ? S.wireEl.getLines() : [];
      if (!user.length) { toast('Lege zuerst Leitungen.'); return; }
      const r = C.runSeq(circ, circ.fixed.concat(user), circ.seq); ok = r.ok; steps = r.steps;
      steps.forEach(s => { lines.push({ ok: s.ok, text: s.name, head: true }); s.items.filter(i => !i.ok && !i.hidden && i.text).forEach(i => lines.push({ ok: false, text: i.text, sub: true })); });
      if (r.ok) lines.push({ ok: true, text: 'Alle Schritte laufen wie gefordert: Die Anlage funktioniert.' });
      else lines.push({ ok: true, info: true, text: 'Tipp: Mit dem Probelauf kannst du die Anlage selbst ausprobieren. Er zeigt dir, wo Druck und Ölstrom nicht ankommen.' });
    }
    const pct = ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok, pct, lines, sol: solutionText(t, inst) };
    if (ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) {} else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies die Rückmeldung und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam(), inst = S.inst;
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(t.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(t.tips[1] || t.tips[0])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet <b>${esc(solutionText(t, inst))}</b>.</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  /* Frage (Auswahl oder Zahl) für Aufgaben und Trainer */
  function questionHtml(kind, inst, a, r, ids) {
    let h = '';
    if (inst.sym) h += symRow(inst.sym);
    if (kind === 'choice') h += `<div class="opts" id="${ids.opts}">${inst.choices.map((c, i) => `<button data-${ids.attr}="${i}" ${r && (r.ok || ids.lock) ? 'disabled' : ''} class="${r && (r.ok || ids.lock) && i === inst.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else h += `<label class="f"><span>${esc(inst.label || 'Dein Ergebnis')} (${esc(inst.unit)})</span><div class="qin"><input id="${ids.inp}" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${r && (r.ok || ids.lock) ? 'disabled' : ''}><span class="u">${esc(inst.unit)}</span></div></label>`;
    return h;
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const inst = S.inst, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(inst.text)}</p>`;
      if (t.kind === 'wire') h += '<div id="tkWireHost"></div>';
      else { if (inst.circ) h += '<div id="tkSimHost"></div>'; h += questionHtml(t.kind, inst, a, r, { opts: 'tkOpts', attr: 'tc', inp: 'tkIn' }); }
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.info ? '' : l.ok ? 'ok' : 'bad'}"${l.sub ? ' style="margin-left:22px"' : ''}>${l.info ? 'ℹ' : l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (t.kind !== 'wire') { if (r.ok || !exam()) h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(r.sol)}<br>${esc(inst.expl)}</div>`; else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>'; }
        else if (r.ok) h += `<div class="rdout ok"><b>Geschafft.</b> ${esc(D.circuits[inst.circ].info)}</div>`;
        if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h;
    if (t) { const ph = $('#tkSimHost') || $('#tkWireHost'); if (ph) { const el = t.kind === 'wire' ? S.wireEl : S.simEl; if (el) ph.replaceWith(el); } }
    if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.id === 'tkIn') (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.id === 'tkIn') { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; S.simEl = null; S.wireEl = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    const t = TASKS.find(x => x.id === id); if (!t) return;
    S.task = id; S.tAns = {}; S.tRes = null; S.simEl = null; S.wireEl = null;
    const R = C.rng(String(R0()) + id + Date.now()); S.inst = shuffleInst(t.make(R), R);
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    if (t.kind === 'wire') { S.wireEl = createWire(id, S.inst.circ); S.wireEl.onchange = () => { if (S.tRes && !S.tRes.ok) { S.tRes = null; renderTasks(false); } }; }
    else if (S.inst.circ) { S.simEl = document.createElement('div'); S.simEl.className = 'simmount'; mountSim(S.simEl, S.inst.circ, { mode: 'task' }); }
    renderTasks();
  }

  /* ============================================================ Zufalls-Trainer */
  function newTrainer() { const T = S.tr; T.q = D.trainerQuestion(R0, T.kind); T.ans = ''; T.c = null; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr, V = $('#rtView'); if (!T.q) { newTrainer(); return; }
    const st = S.rt, q = T.q, a = { c: T.c, v: T.ans };
    let h = `<div class="card pl"><h4>Zufalls-Trainer: unendlich viele Fragen und Rechnungen</h4>
      <div class="fbar"><div class="seg" role="group">${[['mixed', 'Gemischt'], ['sym', 'Symbole'], ['port', 'Anschlüsse'], ['calc', 'Rechnen']].map(([k, l]) => `<button data-rkind="${k}" class="${T.kind === k ? 'on' : ''}" aria-pressed="${T.kind === k}">${l}</button>`).join('')}</div></div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>
      <div class="hint2" style="margin:0 0 4px">${esc(q.cat)}${q.title ? ' · ' + esc(q.title) : ''}</div><p style="margin:2px 0 8px">${esc(q.text)}</p>`;
    h += questionHtml(q.kind, q, a, T.res, { opts: 'rtOpts', attr: 'rc', inp: 'rtIn', lock: true });
    h += T.res ? `<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>` : `<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>`;
    if (T.res) { const r = T.res; h += `<div class="fb ${r.ok ? 'ok' : 'bad'}"><span class="v">${r.shown ? 'Lösung gezeigt (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz. Serie beginnt neu.'}</span></div><div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(q.kind === 'choice' ? q.choices[q.correct] : fa(q.value) + ' ' + q.unit)}<br>${esc(q.expl)}</div>`; }
    V.innerHTML = h + '</div>';
  }
  function trainerCheck(shown) {
    const T = S.tr, q = T.q, st = S.rt; let ok = false;
    if (!shown) {
      if (q.kind === 'choice') { if (T.c == null) { toast('Wähle zuerst eine Antwort.'); return; } ok = T.c === q.correct; }
      else { const v = C.parseDe(T.ans); if (!isFinite(v)) { toast('Bitte gib eine Zahl ein.'); return; } ok = Math.abs(v - q.value) <= q.tol + 1e-9; }
    }
    st.n++; if (ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', st);
    T.res = { ok, shown }; if (ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) {} }
  }
  $('#rtView').addEventListener('input', e => { if (e.target.id === 'rtIn') S.tr.ans = e.target.value; });
  $('#rtView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rtIn') { e.preventDefault(); if (S.tr.res) newTrainer(); else trainerCheck(false); } });
  $('#rtView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const T = S.tr;
    if (b.dataset.rkind) { T.kind = b.dataset.rkind; newTrainer(); }
    else if (b.dataset.rc != null) { T.c = +b.dataset.rc; renderTrainer(); }
    else if (b.dataset.r === 'chk') trainerCheck(false);
    else if (b.dataset.r === 'show') trainerCheck(true);
    else if (b.dataset.r === 'next') newTrainer();
  });

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sk = k => `<span class="inst" style="display:inline-block;margin:2px 6px 2px 0">${symSvg(k, { scale: 0.7 })}</span>`;
    $('#helpView').innerHTML = `
    <details open><summary>⚠️ Sicherheit: Druckflüssigkeit ist gefährlich</summary><div class="hb2">
      <p><b>Hydrauliköl steht unter hohem Druck</b> (typisch 100 bis 350 bar, also das 15- bis 50-fache eines Autoreifens). Ein feiner Ölstrahl aus einer undichten Stelle kann die Haut durchdringen (Injektionsverletzung) und ist ein medizinischer Notfall: sofort zum Arzt, auch wenn die Wunde klein aussieht.</p>
      <p><b>Vor Arbeiten an der Anlage immer drucklos machen:</b></p>
      <p>1. Pumpe ausschalten und gegen Wiedereinschalten sichern.<br>2. Lasten absenken oder abstützen (hängende oder abgestützte Last hält Druck im Zylinder).<br>3. Druck ablassen: Ventile betätigen, Speicher entladen, am Manometer 0 bar prüfen.<br>4. Erst dann Leitungen oder Verschraubungen lösen.</p>
      <p>Niemals mit der Hand nach Lecks suchen (Pappe oder Holz nehmen), keine Leitungen unter Druck lösen, das Druckbegrenzungsventil nicht verstellen. Öl ist heiß (Verbrennungsgefahr), rutschig und umweltgefährdend: Verschüttetes Öl sofort binden, Altöl nur fachgerecht entsorgen. Betriebsanweisung und Unterweisung der Lehrwerkstatt beachten.</p></div></details>
    <details><summary>🔄 Unterschied zur Pneumatik</summary><div class="hb2">
      <table><tr><th></th><th>Pneumatik</th><th>Hydraulik</th></tr>
      <tr><td>Medium</td><td>Luft, <b>kompressibel</b></td><td>Öl, praktisch <b>inkompressibel</b></td></tr>
      <tr><td>Druck</td><td>etwa 6 bis 10 bar</td><td>etwa 100 bis 350 bar</td></tr>
      <tr><td>Kräfte</td><td>klein bis mittel</td><td>sehr groß bei kleiner Baugröße</td></tr>
      <tr><td>Verhalten</td><td>Zylinder federt, Geschwindigkeit schwankt mit der Last</td><td>Zylinder hält Lage und Geschwindigkeit, folgt dem Ölstrom unmittelbar</td></tr>
      <tr><td>Energiequelle</td><td>Verdichter, Druckluftnetz</td><td>Pumpe mit Antriebsmotor aus dem Tank</td></tr>
      <tr><td>Abluft / Rücklauf</td><td>Abluft ins Freie</td><td>Rücklauf zurück in den <b>Tank</b> (geschlossener Kreislauf)</td></tr>
      <tr><td>Absicherung</td><td>Druckregler, Sicherheitsventil</td><td><b>Druckbegrenzungsventil</b> (DBV) ist Pflicht</td></tr>
      <tr><td>Anschlüsse</td><td>1, 2, 3, 4, 5 (oder P, A, B, R, S)</td><td>P, T, A, B, X (Steuerleitung)</td></tr></table>
      <p>Weil Öl nicht zusammengedrückt wird, bewegt sich der Kolben genau so schnell, wie Öl nachgeliefert wird. Die Pumpe liefert Volumenstrom; der Druck stellt sich nach der Last ein (<b>p = F / A</b>). Die Schaltzeichen sind weitgehend gleich, nur die Anschlussbezeichnungen und das Tanksymbol sind hydraulisch.</p></div></details>
    <details><summary>🔣 Symbole und Anschlüsse</summary><div class="hb2">
      <p>${['pump', 'dbv', 'cyl', 'v43', 'v42', 'rve', 'drv', 'mano'].map(sk).join('')}</p>
      <table><tr><th>Anschluss</th><th>Bedeutung</th></tr>
      <tr><td>P</td><td>Druckanschluss (von der Pumpe)</td></tr>
      <tr><td>T</td><td>Tankanschluss (Rücklauf, 0 bar)</td></tr>
      <tr><td>A, B</td><td>Arbeitsanschlüsse zum Verbraucher; A = Kolbenseite (Ausfahren), B = Stangenseite (Einfahren)</td></tr>
      <tr><td>X</td><td>Steueranschluss (gestrichelte Steuerleitung)</td></tr></table>
      <p><b>Wegeventil lesen:</b> Zahl der Anschlüsse / Zahl der Schaltstellungen. Jedes Kästchen ist eine Stellung, die Anschlüsse liegen am Kästchen der Grundstellung. Pfeile zeigen die Strömungswege, ein T-Strich einen gesperrten Anschluss. Magnet links = Stellung a, rechts = Stellung b, Zickzack = Feder.</p>
      <p><b>Mittelstellungen 4/3:</b> gesperrt (alle Anschlüsse zu, Pumpe arbeitet über das DBV), Umlauf (P mit T, Pumpe drucklos, A und B zu), alle Anschlüsse verbunden (Pumpe drucklos, Zylinder entlastet). /* PRUEFEN */ Herstellerbezeichnungen der Mittelstellungen (Buchstaben) bitte im Katalog nachsehen.</p></div></details>
    <details><summary>🧮 Formeln</summary><div class="hb2">
      <span class="eq">Fläche A = π/4 · d² (in cm², wenn d in mm: A = π/4 · d² / 100)</span>
      <span class="eq">Ringfläche A_R = A_Kolben − A_Stange</span>
      <span class="eq">Kraft F = p · A  (F in N = p in bar · A in cm² · 10)</span>
      <span class="eq">Geschwindigkeit v = Q / A  (v in m/s = Q in l/min / (6 · A in cm²))</span>
      <span class="eq">Volumenstrom Q = A · v  (Q in l/min = 6 · A in cm² · v in m/s)</span>
      <span class="eq">Hydraulische Leistung P = p · Q / 600  (P in kW, p in bar, Q in l/min)</span>
      <span class="eq">Antriebsleistung P_an = P_hyd / η_ges</span>
      <span class="eq">Förderstrom Q = V_g · n · η_v / 1000  (V_g in cm³/U, n in 1/min, Q in l/min)</span>
      <span class="eq">Hydraulische Presse: p = F₁/A₁ = F₂/A₂, also F₂ = F₁ · A₂/A₁</span>
      <p>Umrechnungen: 1 bar = 0,1 MPa = 100 000 Pa = 10 N/cm². 1 l/min ≈ 16,7 cm³/s. 1 kN = 1000 N.</p>
      <p><b>Richtwerte</b> (Lehrwerte, im Datenblatt prüfen): η_ges von Zahnrad- und Kolbenpumpen etwa 0,8 bis 0,9; η_v etwa 0,9 bis 0,95. /* PRUEFEN */</p></div></details>
    <details><summary>🔧 Bauteile und ihre Aufgabe</summary><div class="hb2">
      <table><tr><th>Bauteil</th><th>Aufgabe</th></tr>
      <tr><td>Pumpe (Konstantpumpe)</td><td>fördert festen Volumenstrom je Umdrehung, erzeugt keinen Druck von allein</td></tr>
      <tr><td>Druckbegrenzungsventil</td><td>öffnet beim Einstelldruck und leitet den Überstrom zum Tank</td></tr>
      <tr><td>Wegeventil</td><td>steuert Richtung des Ölstroms (Zylinder aus, ein, halten)</td></tr>
      <tr><td>Rückschlagventil</td><td>sperrt eine Richtung; entsperrbar: Steuerdruck an X öffnet auch die Sperrrichtung</td></tr>
      <tr><td>Drossel, Drosselrückschlagventil</td><td>begrenzt den Volumenstrom und damit die Geschwindigkeit (eine Richtung beim Drosselrückschlagventil); der Rest fließt über das DBV ab, der Druck steigt</td></tr>
      <tr><td>Filter</td><td>hält Schmutz zurück, schützt Pumpe und Ventile</td></tr>
      <tr><td>Manometer</td><td>zeigt den Druck an der Messstelle</td></tr>
      <tr><td>Tank</td><td>nimmt das Öl auf, kühlt und lässt Luft und Schmutz absetzen</td></tr></table></div></details>
    <details><summary>⚙️ So bedienst du das Lab</summary><div class="hb2">
      <p><b>Schaltpläne:</b> Wähle eine Schaltung, stelle die Ventile und beobachte Druckfarben, Ölstrom und Zylinder. Mit + und − änderst du den Einstelldruck des DBV.</p>
      <p><b>Verschlauchen (Aufgaben):</b> Tippe nacheinander zwei Anschlüsse an, dann entsteht eine Leitung. Tippe eine Leitung an, um sie zu löschen. „Prüfen“ lässt die Anlage den geforderten Ablauf fahren und meldet, <b>was</b> nicht funktioniert, nicht welche Leitung. Mit dem Probelauf kannst du die Anlage selbst bedienen.</p>
      <p><b>Prüfmodus (🎓):</b> Tipps kosten 25 % der Punkte je Stufe. Beim normalen Üben kosten sie nichts.</p>
      <p><b>Wie genau ist der Simulator?</b> Vereinfachtes Modell: Öl ist inkompressibel, Leitungen haben keinen Druckverlust, Leckage und Temperatur sind nicht berücksichtigt, Reibung im Zylinder ist pauschal 100 N. Drossel: Q ~ √Δp. Rückschlagventil öffnet ohne Federkraft. Die Zahlen dienen dem Verständnis, nicht der Auslegung einer echten Anlage.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'sim'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'sim') renderSim(); else if (t === 'sym') renderSym(); else if (t === 'calc') renderCalc(); else if (t === 'bsp') renderBsp(); else if (t === 'tasks') renderTasks(false); else if (t === 'rt') renderTrainer(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Hydraulik-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Hydraulik-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length, sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Frage im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('rt'); newTrainer(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('sim');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Fragen mit Serien-Zähler'], ['help', 'Hilfe und Spickzettel', 'Sicherheit, Symbole, Formeln, Unterschied zur Pneumatik'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben, gelegte Leitungen und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => {
        const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m;
        if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m);
      });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps, gelegten Leitungen und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt', 'bau'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; S.simEl = null; S.wireEl = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = D.beispiele || [], BSP_INTRO = 'Die fertigen Schaltungen aus „Schaltpläne“ als Auswahl. „Simulation öffnen“ lädt die Schaltung, dort kannst du Ventil und Drossel verstellen und den Ölstrom verfolgen.', BSP_BTN = 'Simulation öffnen';
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p>' + '' + '<div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTN + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) { S.simId = b.cir; lsSet('sim', b.cir); setTab('sim'); toast('Schaltung geladen: ' + b.titel); }

  /* Schnittstelle für Karriere/Lernpfad */
  root.HYD_LAB = { id: 'hyd', title: 'Hydraulik-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.HYD_TASKS };

  buildTabs(); updatePal(); setTab(S.tab);
  /* Aufruf ?aufgabe=hyd1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { setTab('bsp'); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
