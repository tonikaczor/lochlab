'use strict';
/* Tonfunk Pneumatik-Lab: Oberflaeche (SVG-Symbole, Anlage mit Schlaeuchen und Simulation, Aufgaben, Rechnen, Trainer, Hilfe).
   Module: pnecore.js (PNE_CORE: Solver, Rechenhilfen), pnedata.js (PNE_DATA, PNE_TASKS).
   Tabs: sym (Symbole), anl (Schaltplaene lesen und verschlauchen), aufg (Aufgaben), rech (Rechnen), trn (Trainer), help (Hilfe).
   Speicher (Praefix lm4.pne.): done {id:true}, score {id:pct}, hints {id:stufe}, tab, mode (ueben|pruef), bau {aufgabe:[[a,b],...]}, latch, trainer, calc.
   Aufrufparameter: ?aufgabe=pne7 . Tipp-Abzug (Stufe 1/2/3 = 10/25/50 %) gilt nur im Pruefmodus. */
(function (root) {
  const C = root.PNE_CORE, D = root.PNE_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const K = { done: 'lm4.pne.done', score: 'lm4.pne.score', prog: 'lm4.pne.prog', hints: 'lm4.pne.hints', tab: 'lm4.pne.tab', mode: 'lm4.pne.mode', bau: 'lm4.pne.bau', latch: 'lm4.pne.latch', tr: 'lm4.pne.trainer', cir: 'lm4.pne.cir', zoom: 'lm4.pne.zoom' };
  const fm = C.calc.fmt, parseNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pk = a => a[Math.floor(Math.random() * a.length)];
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  /* ============================================================ Fenster, Meldungen */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, m.length * 55)); }
  function sheet(title, build, onClose) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    let closed = false;
    const close = () => { if (closed) return; closed = true; bd.remove(); if (onClose) onClose(); };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close;
    build($('.sh-b', bd), close);
    return close;
  }
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin(true); close(); };
      }, () => fin(false));
    });
  }
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'pne' };

  /* ============================================================ Symbole (SVG) */
  const ln = (d, c) => `<path class="ln ${c || ''}" d="${d}"/>`;
  const fl = (pts, c) => `<polygon class="fl ${c || ''}" points="${pts}"/>`;
  const tx = (x, y, t, c, a) => `<text class="tx ${c || ''}" x="${x}" y="${y}" text-anchor="${a || 'start'}">${esc(t)}</text>`;
  function arrow(x1, y1, x2, y2, c) {   /* Linie mit Pfeilspitze bei (x2,y2) */
    const a = Math.atan2(y2 - y1, x2 - x1), L = 7, w = 0.45;
    const p = [x2, y2, x2 - L * Math.cos(a - w), y2 - L * Math.sin(a - w), x2 - L * Math.cos(a + w), y2 - L * Math.sin(a + w)].map(v => v.toFixed(1));
    return ln(`M${x1} ${y1}L${x2} ${y2}`, c) + fl(`${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]}`, c);
  }
  const block = (x, c) => ln(`M${x} 60V51M${x - 6} 51H${x + 6}`, c);   /* gesperrter Anschluss unten */
  const spring = (x1, x2, y) => { const n = 6, dx = (x2 - x1) / n; let d = `M${x1} ${y}`; for (let i = 0; i < n; i++) d += `L${(x1 + dx * (i + 0.5)).toFixed(1)} ${y + (i % 2 ? 8 : -8)}`; return ln(d + `L${x2} ${y}`); };
  const exh = (x, y, c) => ln(`M${x - 5} ${y + 1}H${x + 5}L${x} ${y + 9}Z`, c);
  const PORTNAME = { '1a': '1', '1b': '1', P: '', ein: '', aus: '', E: '' };
  const pname = n => (n in PORTNAME ? PORTNAME[n] : n);

  function actuator(side, kind, on, x0, w, midY, boxW) {   /* side 'l' | 'r' */
    const c = on ? 'ac' : '';
    if (side === 'r') {
      if (kind === 'feder') return spring(x0 + w, x0 + w + 32, midY);
      if (kind === 'pilot') return ln(`M${x0 + w + 40}  ${midY}H${x0 + w + 12}`, c) + fl(`${x0 + w + 12},${midY - 6} ${x0 + w + 12},${midY + 6} ${x0 + w + 2},${midY}`, c);
      return '';
    }
    const e = x0;   /* Kante des ersten Feldes */
    if (kind === 'taster' || kind === 'schalter') return ln(`M${e} ${midY}H${e - 24}M${e - 24} ${midY - 10}V${midY + 10}M${e - 31} ${midY - 10}V${midY + 10}M${e - 31} ${midY}H${e - 24}`, c) + (kind === 'schalter' ? fl(`${e - 12},${midY - 1} ${e - 6},${midY - 7} ${e - 6},${midY + 5}`, c) : '');
    if (kind === 'rolle') return ln(`M${e} ${midY}H${e - 10}`, c) + `<circle class="ln ${c}" cx="${e - 17}" cy="${midY}" r="7"/>` + `<circle class="fl ${c}" cx="${e - 17}" cy="${midY}" r="1.6"/>`;
    if (kind === 'pilot') return ln(`M${e - 40} ${midY}H${e - 12}`, c) + fl(`${e - 12},${midY - 6} ${e - 12},${midY + 6} ${e - 2},${midY}`, c);
    return '';
  }

  /* drawPart(p, st): Symbol in lokalen Koordinaten (Ursprung links oben). st = { vpos, p(port)->0/1, hi(bool), pos (Zylinder 0..1), ball (-1,0,1), ports(bool), tap(bool) } */
  function drawPart(p, st) {
    st = st || {};
    const q = C.norm(Object.assign({}, p)), g = D.geom(q);
    const pc = n => (st.p ? (st.p(n) ? 'air' : 'nil') : '');
    let s = '';
    if (q.t === 'v32' || q.t === 'v52') {
      const is32 = q.t === 'v32', bw = is32 ? 40 : 50, x0 = 40, vpos = st.vpos;
      /* linkes Feld = betaetigte Stellung, rechtes Feld = Ruhestellung (Federseite): hier liegen die Anschluesse */
      let lk, rk, leftOn, rightOn;
      if (is32) { const nc = q.rest === 'NC'; lk = nc ? 'f' : 'z'; rk = nc ? 'z' : 'f'; leftOn = vpos === lk; rightOn = vpos === rk; }
      else { lk = '14'; rk = '12'; leftOn = vpos === '14'; rightOn = vpos === '12'; }
      const hi = !!st.hi;
      s += `<rect class="bx ${hi && leftOn ? 'on' : ''}" x="${x0}" y="20" width="${bw}" height="40"/><rect class="bx ${hi && rightOn ? 'on' : ''}" x="${x0 + bw}" y="20" width="${bw}" height="40"/>`;
      const content = (X, kind) => {
        if (is32) return kind === 'f' ? arrow(X + 10, 60, X + 20, 20) + block(X + 30) : block(X + 10) + arrow(X + 20, 20, X + 30, 60);
        return kind === '14' ? arrow(X + 25, 60, X + 13, 20) + arrow(X + 37, 20, X + 42, 60) : arrow(X + 25, 60, X + 37, 20) + arrow(X + 13, 20, X + 8, 60);
      };
      s += content(x0, lk) + content(x0 + bw, rk);
      /* Anschlussleitungen am rechten (Ruhe-)Feld */
      const R = x0 + bw;
      Object.keys(g.ports).forEach(n => {
        const a = g.ports[n];
        if (n === '14' || n === '12' || n === '10') return;
        const top = a.y < 40;
        s += ln(top ? `M${a.x} ${a.y}V20` : `M${a.x} ${a.y}V60`, pc(n));
        if (n === '3' || n === '5') s += exh(a.x, a.y, '');
      });
      const lKind = is32 ? q.act : q.s14, rKind = is32 ? 'feder' : q.s12;
      const lOn = !!st.hi && (is32 ? (vpos === lk) : vpos === '14') && lKind !== 'feder';
      const rOn = !!st.hi && !is32 && vpos === '12' && rKind !== 'feder';
      s += actuator('l', lKind, lOn, x0, bw, 40);
      s += actuator('r', rKind, rOn, x0 + 2 * bw, 0, 40);
      if (lKind === 'pilot') s += ln('M0 40H28', pc(is32 ? (q.rest === 'NO' ? '10' : '12') : '14'));
      if (rKind === 'pilot') s += ln(`M${g.w} 40H${x0 + 2 * bw + 12}`, pc('12'));
    } else if (q.t === 'wv' || q.t === 'uv') {
      s += `<rect class="bx" x="20" y="25" width="60" height="40"/>`;
      s += ln('M0 45H20', pc('1a')) + ln('M80 45H100', pc('1b')) + ln('M50 25V0', pc('2'));
      if (q.t === 'wv') { const bx = 50 + (st.ball || 0) * 11; s += `<circle class="ln" cx="${bx}" cy="45" r="8"/>` + ln('M30 38L38 45L30 52') + ln('M70 38L62 45L70 52'); }
      else s += fl('27,37 27,53 41,45') + fl('73,37 73,53 59,45');
    } else if (q.t === 'dr') {
      const inner = () => {
        let t = ln('M0 35H15', pc('V')) + ln('M85 35H100', pc('Z')) + ln('M15 35V23M15 35V50M85 35V23M85 35V50');
        t += ln('M15 23H38') + ln('M62 23H85') + ln('M38 16Q46 23 38 30') + ln('M62 16Q54 23 62 30') + arrow(36, 33, 64, 13);
        let chk = ln('M15 50H34') + `<circle class="ln" cx="40" cy="50" r="5"/>` + ln('M34 44L36 50L34 56') + ln('M45 50H85') + fl('68,45 68,55 76,50');
        if (q.rev) chk = `<g transform="translate(100 0) scale(-1 1)">${chk}</g>`;
        return t + chk;
      };
      s += q.vert ? `<g transform="translate(0 100) rotate(-90)">${inner()}</g>` : inner();
    } else if (q.t === 'zyl_ea' || q.t === 'zyl_da') {
      const pos = st.pos == null ? 0 : st.pos, px = 30 + 60 * pos, da = q.t === 'zyl_da';
      if (st.p) {
        if (st.p('K')) s += `<rect class="air-f" x="20" y="20" width="${(px - 20).toFixed(1)}" height="30"/>`;
        if (da && st.p('S')) s += `<rect class="air-f" x="${px.toFixed(1)}" y="20" width="${(120 - px).toFixed(1)}" height="30"/>`;
      }
      s += `<rect class="bx cy" x="20" y="20" width="100" height="30"/>`;
      if (!da) { const sp = spring(px + 4, 117, 35).replace(/<path/, '<path style="stroke-width:1.5"'); s += sp + ln('M113 20V10') + `<circle class="ln" cx="113" cy="8" r="2.5"/>`; }
      s += `<path class="ln" style="stroke-width:3.4" d="M${px.toFixed(1)} 23V47"/>` + ln(`M${px.toFixed(1)} 35H${(px + 100).toFixed(1)}`) + ln(`M${(px + 100).toFixed(1)} 25V45`);
      s += ln('M34 50V76', pc('K')) + (da ? ln('M106 50V76', pc('S')) : '');
      (q.marks || []).forEach(m => { const x = m.at === 'in' ? 30 : 90; s += fl(`${x - 4},12 ${x + 4},12 ${x},20`, 'ac') + tx(x, 9, m.label, 'm', 'middle'); });
    } else if (q.t === 'quelle') {
      s += `<circle class="ln" cx="22" cy="20" r="14"/>` + `<polygon class="ln ${pc('P') || ''}" points="16,12 16,28 30,20"/>` + ln('M36 20H60', pc('P'));
    } else if (q.t === 'we') {
      s += ln('M0 25H15', pc('ein')) + ln('M55 25H70', pc('aus')) + ln('M35 5L55 25L35 45L15 25Z') + fl('26,19 26,31 37,25') + ln('M44 17V33', '') ;
    } else if (q.t === 'sd') {
      s += ln('M15 0V12', pc('E')) + ln('M5 12H25L15 30Z');
    }
    /* Beschriftung und Anschlussnamen */
    if (q.label) s += tx(g.lab.x, g.lab.y, q.label, 'lab');
    if (st.ports || st.tap) Object.keys(g.ports).forEach(n => {
      const a = g.ports[n], t = pname(n); if (!t && !st.tap) return;
      const L = { u: [a.x + 4, a.y + 11, 'start'], d: [a.x + 4, a.y - 5, 'start'], l: [a.x + 3, a.y - 5, 'start'], r: [a.x - 3, a.y - 5, 'end'] }[a.d];
      if (t && st.ports && !st.tap) s += tx(L[0], L[1], t, 'pn', L[2]);
    });
    return s;
  }
  /* freistehendes Symbol als SVG (Bibliothek, Aufgaben, Hilfe) */
  function symSVG(spec, o) {
    o = o || {};
    const p = Object.assign({}, spec), g = D.geom(p), m = 12;
    const st = { ports: o.ports, hi: o.hi, vpos: o.vpos, tap: o.tap, p: o.air ? (() => 1) : null, pos: o.pos };
    let dots = '';
    if (o.tap) Object.keys(g.ports).forEach(n => { const a = g.ports[n]; const sel = o.sel === n, shown = o.reveal; dots += `<g class="tapport${sel ? ' on' : ''}" data-port="${n}"><circle cx="${a.x}" cy="${a.y}" r="15" class="hit"/><circle cx="${a.x}" cy="${a.y}" r="5" class="pd"/>${shown ? tx(a.x + 8, a.y + (a.d === 'd' ? -6 : 14), pname(n) || n, 'pn') : ''}</g>`; });
    return `<svg class="sym" viewBox="${-m} ${-m - 6} ${g.w + 2 * m} ${g.h + 2 * m + 12}" style="width:${Math.round((g.w + 2 * m) * (o.scale || 1.15))}px;max-width:100%" role="img" aria-label="${esc(D.partName(p))}"><g>${drawPart(p, st)}${dots}</g></svg>`;
  }
  root.PNE_SYM = { drawPart, symSVG };

  /* ============================================================ Anlage: Zustand, Schlaeuche, Zeichnen */
  const PL = { cir: null, task: null, mode: 'ref', user: [], model: null, st: null, running: true, speed: 1, sel: null, del: false, latch: LS_latch(), zoom: lsGet(K.zoom, null), hist: [], acc: 0, sig: '', host: null, touched: false };
  function LS_latch() { return lsRaw(K.latch, '0') === '1'; }
  const DIRV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

  function plLoad(cirId, taskId) {
    const c = D.CIRCUITS[cirId]; if (!c) return;
    PL.cir = c; PL.task = taskId || null;
    const t = taskId ? D.TASKS[taskId] : null;
    PL.mode = t && t.type === 'verschl' ? 'bau' : 'ref';
    PL.user = PL.mode === 'bau' ? ((lsGet(K.bau, {})[taskId] || []).filter(h => Array.isArray(h) && h.length === 2)) : [];
    PL.sel = null; PL.del = false; PL.hist = []; PL.touched = false;
    if (!taskId) lsPut(K.cir, cirId);
    plRebuild();
  }
  function plRebuild() {
    PL.model = C.build(PL.cir, PL.mode === 'bau' ? PL.user : PL.cir.ref);
    PL.st = C.init(PL.model); PL.acc = 0; PL.sig = '';
  }
  function plSaveUser() { if (PL.mode !== 'bau' || !PL.task) return; const b = lsGet(K.bau, {}); b[PL.task] = PL.user; lsSet(K.bau, b); }
  const partOf = id => PL.cir.parts.find(p => p.id === id);
  function anchor(key) {
    const [id, n] = key.split('.'), p = partOf(id); if (!p) return null;
    const a = D.geom(p).ports[n]; return a ? { x: p.x + a.x, y: p.y + a.y, d: a.d } : null;
  }
  function route(a, b, lane) {
    const S = 14, v = d => d === 'u' || d === 'd';
    const s0 = [a.x + DIRV[a.d][0] * S, a.y + DIRV[a.d][1] * S], s1 = [b.x + DIRV[b.d][0] * S, b.y + DIRV[b.d][1] * S];
    let pts;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 30) pts = [[a.x, a.y], [b.x, b.y]];
    else if (v(a.d) && v(b.d)) {
      if (a.d !== b.d) {
        const facing = (a.d === 'u' && a.y > b.y) || (a.d === 'd' && a.y < b.y);
        if (facing) { const my = (a.y + b.y) / 2 + lane; pts = [[a.x, a.y], [a.x, my], [b.x, my], [b.x, b.y]]; }
        else { const mx = Math.max(a.x, b.x) + 40 + lane; pts = [[a.x, a.y], s0, [mx, s0[1]], [mx, s1[1]], s1, [b.x, b.y]]; }
      } else { const yy = a.d === 'd' ? Math.max(s0[1], s1[1]) + 6 + lane : Math.min(s0[1], s1[1]) - 6 - lane; pts = [[a.x, a.y], s0, [s0[0], yy], [s1[0], yy], s1, [b.x, b.y]]; }
    } else if (!v(a.d) && !v(b.d)) {
      if (a.d !== b.d) {
        const facing = (a.d === 'r' && a.x < b.x) || (a.d === 'l' && a.x > b.x);
        if (facing) { const mx = (a.x + b.x) / 2 + lane; pts = [[a.x, a.y], [mx, a.y], [mx, b.y], [b.x, b.y]]; }
        else { const my = Math.max(a.y, b.y) + 40 + lane; pts = [[a.x, a.y], s0, [s0[0], my], [s1[0], my], s1, [b.x, b.y]]; }
      } else { const xx = a.d === 'r' ? Math.max(s0[0], s1[0]) + 6 + lane : Math.min(s0[0], s1[0]) - 6 - lane; pts = [[a.x, a.y], s0, [xx, s0[1]], [xx, s1[1]], s1, [b.x, b.y]]; }
    } else if (v(a.d)) pts = [[a.x, a.y], [a.x, s1[1]], s1, [b.x, b.y]];
    else pts = [[a.x, a.y], [s1[0], a.y], s1, [b.x, b.y]];
    return pts;
  }
  function hoseList() {
    const L = [], mark = (h, fixed, ui) => L.push({ a: h[0], b: h[1], fixed, ui });
    (PL.cir.fixed || []).forEach(h => mark(h, true, -1));
    if (PL.mode === 'bau') PL.user.forEach((h, i) => mark(h, false, i)); else (PL.cir.ref || []).forEach(h => mark(h, true, -1));
    return L;
  }
  function distSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function nearestPort(pt, R) {
    let best = null, bd = R;
    PL.cir.parts.forEach(p => { const g = D.geom(C.norm(Object.assign({}, p))); Object.keys(g.ports).forEach(n => { const a = g.ports[n], d = Math.hypot(pt.x - (p.x + a.x), pt.y - (p.y + a.y)); if (d < bd) { bd = d; best = p.id + '.' + n; } }); });
    return best;
  }
  function nearestHose(pt, R) {
    let best = null, bd = R;
    hoseList().forEach((h, hi) => { if (h.fixed) return; const a = anchor(h.a), b = anchor(h.b); if (!a || !b) return; const pts = route(a, b, (hi % 4) * 5); for (let i = 0; i < pts.length - 1; i++) { const d = distSeg(pt.x, pt.y, pts[i], pts[i + 1]); if (d < bd) { bd = d; best = h; } } });
    return best;
  }

  function plSvg() {
    const c = PL.cir, m = PL.model, s = PL.st, z = zoomEff();
    const pr = key => { const i = m.idx[key]; return i == null ? 0 : s.net[i]; };
    let h = '';
    /* Schlaeuche */
    hoseList().forEach((hs, hi) => {
      const a = anchor(hs.a), b = anchor(hs.b); if (!a || !b) return;
      const pts = route(a, b, (hi % 4) * 5), d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
      const cls = pr(hs.a) ? 'air' : 'nil';
      h += `<path class="hose ${cls}${hs.fixed ? ' fx' : ''}${PL.del && !hs.fixed ? ' del' : ''}" d="${d}"/>`;
    });
    /* Bauteile */
    c.parts.forEach(p => {
      const q = m.parts[p.id], st = { p: n => pr(p.id + '.' + n), vpos: s.vpos[p.id], hi: true, pos: s.pos[p.id], ports: true };
      if (q.t === 'wv') { const l = s.sh[p.id] || []; st.ball = l.length === 1 ? (l[0][0] === m.idx[p.id + '.1a'] ? 1 : -1) : 0; }
      h += `<g transform="translate(${p.x} ${p.y})" data-part="${p.id}">${drawPart(p, st)}</g>`;
    });
    /* Anschlusspunkte beim Verschlauchen */
    if (PL.mode === 'bau') {
      const used = new Set(); hoseList().forEach(x => { used.add(x.a); used.add(x.b); });
      c.parts.forEach(p => { const g = D.geom(C.norm(Object.assign({}, p))); Object.keys(g.ports).forEach(n => { const k = p.id + '.' + n, a = g.ports[n]; if (n === 'E') return; h += `<circle class="pdot ${used.has(k) ? 'used' : ''}${PL.sel === k ? ' sel' : ''}" cx="${p.x + a.x}" cy="${p.y + a.y}" r="${PL.sel === k ? 8 : 5}"/>`; }); });
    }
    return `<svg id="plSvg" viewBox="0 0 ${c.W} ${c.H}" width="${Math.round(c.W * z)}" height="${Math.round(c.H * z)}" role="img" aria-label="${esc(c.title)}">${h}</svg>`;
  }
  function zoomEff() {
    if (PL.zoom) return PL.zoom;
    const host = PL.host, w = host ? host.clientWidth : 360;
    return Math.max(0.75, Math.min(1.5, (w - 16) / PL.cir.W));
  }
  function plSig() {
    const s = PL.st, m = PL.model; if (!s) return '';
    return m.cyls.map(id => s.pos[id].toFixed(3)).join(',') + '|' + Object.values(s.vpos).join('') + '|' + s.net.join('') + '|' + JSON.stringify(s.inp) + '|' + PL.sel + PL.del + PL.mode + PL.user.length + '|' + (PL.zoom || '') + (PL.host ? PL.host.clientWidth : 0) + '|' + Object.values(s.sh).map(l => l.length + (l[0] ? l[0][0] : '')).join('');
  }
  function plDraw(force) {
    if (!PL.host || !PL.cir) return;
    const sig = plSig(); if (!force && sig === PL.sig) return; PL.sig = sig;
    PL.host.innerHTML = plSvg();
    plStatus();
  }
  function plStatus() {
    const el = $('#plStat'); if (!el) return;
    const s = PL.st, m = PL.model; let t = '';
    if (PL.mode === 'bau') {
      if (PL.sel) t = 'Anschluss <b>' + esc(portName(PL.sel)) + '</b> gewählt. Tippe jetzt den zweiten Anschluss, um den Schlauch zu legen.';
      else t = PL.del ? 'Löschen ist an: Tippe auf einen selbst gelegten Schlauch, um ihn zu entfernen.' : 'Tippe einen Anschluss, dann den zweiten Anschluss: Der Schlauch wird gelegt. Taster kannst du zum Ausprobieren drücken.';
    } else t = 'Tippe auf einen Taster und halte ihn gedrückt' + (PL.latch ? ' (Rasten ist an: Antippen schaltet um)' : '') + '. Blau = Druck, grau = drucklos.';
    const cy = m.cyls.map(id => { const lb = (partOf(id) || {}).label || id; return lb + ': ' + Math.round(s.pos[id] * 100) + ' %'; }).join(' · ');
    if (s.leak) t += ' <span class="wn">Achtung: Druckluft strömt ungenutzt ab (Kurzschluss/Leckage).</span>';
    el.innerHTML = t + (cy ? '<br><small>' + esc(cy) + '</small>' : '');
  }
  const portName = k => { const [id, n] = k.split('.'), p = partOf(id); return (p && p.label ? p.label : id) + ' · ' + (pname(n) || n) + (n === 'K' || n === 'S' ? ' (' + (n === 'K' ? 'Kolbenseite' : 'Stangenseite') + ')' : ''); };

  /* Bedienung */
  const isManual = p => (p.t === 'v32' && (p.act === 'taster' || p.act === 'schalter')) || (p.t === 'v52' && (p.s14 === 'taster' || p.s14 === 'schalter'));
  function toSvg(e) {
    const svg = $('#plSvg'); if (!svg) return null;
    const r = svg.getBoundingClientRect(), z = r.width / PL.cir.W;
    return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z, z };
  }
  function partAt(pt) {
    for (const p of PL.cir.parts) { if (!isManual(p)) continue; const g = D.geom(p); if (pt.x >= p.x - 4 && pt.x <= p.x + g.w + 4 && pt.y >= p.y - 4 && pt.y <= p.y + g.h + 4) return p; }
    return null;
  }
  function onDown(e) {
    if (!PL.cir || (e.button != null && e.button > 0)) return;
    const pt = toSvg(e); if (!pt) return;
    if (PL.mode === 'bau') {
      const port = nearestPort(pt, 26 / pt.z);
      if (port) { e.preventDefault(); portTap(port); return; }
      if (PL.del) { const h = nearestHose(pt, 14 / pt.z); if (h) { e.preventDefault(); removeHose(h.ui); return; } }
    }
    const p = partAt(pt); if (!p) return;
    e.preventDefault();
    const id = p.id;
    if (PL.latch) { C.setInput(PL.st, id, !PL.st.inp[id]); PL.touched = true; plDraw(); return; }
    C.setInput(PL.st, id, 1); PL.touched = true; plDraw();
    const up = () => { C.setInput(PL.st, id, 0); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); plDraw(); };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function hoseExists(a, b) { return hoseList().some(h => (h.a === a && h.b === b) || (h.a === b && h.b === a)); }
  function portTap(k) {
    if (!PL.sel) { PL.sel = k; plDraw(); return; }
    if (PL.sel === k) { PL.sel = null; plDraw(); return; }
    if (hoseExists(PL.sel, k)) { toast('Diese Verbindung gibt es schon.'); PL.sel = null; plDraw(); return; }
    PL.user.push([PL.sel, k]); PL.hist.push(['add']); PL.sel = null; plSaveUser(); plRebuild(); plDraw(true); taskPanelRefresh(true);
  }
  function removeHose(i) { if (i < 0 || i >= PL.user.length) return; PL.hist.push(['del', PL.user[i], i]); PL.user.splice(i, 1); plSaveUser(); plRebuild(); plDraw(true); taskPanelRefresh(true); toast('Schlauch entfernt'); }
  function undoHose() {
    const h = PL.hist.pop(); if (!h) { toast('Nichts zum Rückgängigmachen.'); return; }
    if (h[0] === 'add') PL.user.pop(); else if (h[0] === 'del') PL.user.splice(h[2], 0, h[1]); else if (h[0] === 'all') PL.user = h[1];
    plSaveUser(); plRebuild(); plDraw(true); taskPanelRefresh(true);
  }
  async function clearHoses() {
    if (!PL.user.length) return;
    if (!(await confirmSheet('Alle Schläuche entfernen?', 'Alle von dir gelegten Schläuche werden entfernt. Vorgegebene Schläuche bleiben.', 'Entfernen', true))) return;
    PL.hist.push(['all', PL.user.slice()]); PL.user = []; plSaveUser(); plRebuild(); plDraw(true); taskPanelRefresh(true);
  }

  /* Zeitschleife */
  let lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
    if (S.tab !== 'anl' || !PL.model || document.hidden) return;
    if (PL.running) { PL.acc += dt * PL.speed; let n = 0; while (PL.acc >= C.DT && n++ < 40) { C.step(PL.model, PL.st, C.DT); PL.acc -= C.DT; } }
    plDraw();
    if (root.PNEVIZ) root.PNEVIZ.tick(PL, S);
  }

  /* ============================================================ Fortschritt, Aufgaben */
  const doneMap = () => lsGet(K.done, {});
  const HP = [0, 10, 25, 50];
  const mode = () => lsRaw(K.mode, 'ueben');
  function markDone(id) {
    const d = doneMap(), first = !d[id]; d[id] = true; lsSet(K.done, d);
    const hs = lsGet(K.hints, {}), pct = mode() === 'pruef' ? 100 - HP[Math.min(3, hs[id] || 0)] : 100;
    const sc = lsGet(K.score, {}); if ((sc[id] || 0) < pct) { sc[id] = pct; lsSet(K.score, sc); }
    lsSet(K.prog, sc);   // gemeinsamer Fortschritt (aufgaben.js spiegelt lm4.<lab>.prog nach lm4.tdone: Lernpfad, Ausbildungsplan, Rückmeldung, Nächste Aufgabe)
    buildTabs(); if (S.tab === 'aufg') renderTasks();
    return { first, pct };
  }
  const TASKS = () => D.LIST;
  const S = { tab: 'sym', cat: '', task: null, sel: null, res: null, lastCheck: null, symDet: null, trn: { mode: 'sym', q: null, ans: null, stat: lsGet(K.tr, { n: 0, ok: 0, streak: 0, best: 0 }) }, calc: null };

  function tipStages(t) {
    const a = t.tips || [];
    let two = a[1];
    if (t.type === 'verschl' && S.lastCheck && S.lastCheck.id === t.id) { const bad = S.lastCheck.res.items.find(i => !i.ok); if (bad) two = 'Noch nicht erfüllt: „' + bad.text + '“. Prüfe, welche Verbindung dafür nötig ist.'; else if (S.lastCheck.res.leak) two = 'Irgendwo strömt Druckluft ungenutzt ab: Eine Leitung verbindet Druck mit einer Entlüftung.'; }
    return [a[0], two, a[2]];
  }
  function solutionText(t) {
    if (t.type !== 'verschl') return t.tips[2];
    const c = D.CIRCUITS[t.cir], nm = k => { const [id, n] = k.split('.'), p = c.parts.find(x => x.id === id); return (p && p.label ? p.label : id) + ' ' + (n === 'aus' ? 'Ausgang' : n === 'ein' ? 'Eingang' : 'Anschluss ' + pname(n)); };
    return c.ref.map(h => nm(h[0]) + ' → ' + nm(h[1])).join('; ');
  }
  function tipSheet(t) {
    const hs = lsGet(K.hints, {}), n = Math.min(3, (hs[t.id] || 0) + 1);
    const pruef = mode() === 'pruef' && !doneMap()[t.id];
    const go = () => {
      hs[t.id] = Math.max(hs[t.id] || 0, n); lsSet(K.hints, hs);
      const st = tipStages(t);
      sheet('Tipp, Stufe ' + n + ' von 3', (b, close) => {
        let h = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(st[0])}</p>`;
        if (n >= 2) h += `<p><b>Stufe 2:</b> ${esc(st[1])}</p>`;
        if (n >= 3) h += `<p><b>Stufe 3:</b> ${esc(t.type === 'verschl' ? 'Lösung: ' + solutionText(t) : st[2])}</p>` + (t.type === 'verschl' ? '<button class="btn pri" id="hSol">Lösung einblenden</button>' : '');
        else h += '<p class="hint2">Brauchst du mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
        if (mode() === 'pruef') h += `<p class="hint2">Prüfmodus: Mit Tipp-Stufe ${Math.min(3, hs[t.id])} sind höchstens ${100 - HP[Math.min(3, hs[t.id])]} % der Punkte möglich.</p>`;
        b.innerHTML = h;
        const bs = $('#hSol', b); if (bs) bs.onclick = () => { close(); PL.user = D.CIRCUITS[t.cir].ref.map(x => x.slice()); PL.hist = []; plSaveUser(); plRebuild(); plDraw(true); taskPanelRefresh(true); toast('Lösung eingeblendet. Du kannst sie ansehen, verändern und prüfen.'); };
      });
    };
    if (pruef && n >= 1 && (hs[t.id] || 0) < n) confirmSheet('Tipp im Prüfmodus', `Dieser Tipp (Stufe ${n}) kostet ${HP[n]} % der Punkte. Trotzdem ansehen?`, 'Tipp zeigen').then(ok => { if (ok) go(); });
    else go();
  }

  function checkTask(t, host) {
    const out = { ok: false, lines: [], msg: '' };
    if (t.type === 'mc') { out.ok = S.sel === t.ans; out.msg = S.sel == null ? 'Wähle zuerst eine Antwort.' : ''; }
    else if (t.type === 'tap') { const ans = [].concat(t.ans); out.ok = ans.includes(S.sel); out.msg = S.sel == null ? 'Tippe zuerst auf einen Anschluss im Symbol.' : ''; }
    else if (t.type === 'num') {
      const inp = $('#tpIn', host), v = parseNum(inp ? inp.value : ''); out.val = v;
      if (!isFinite(v)) out.msg = 'Gib zuerst eine Zahl ein.'; else out.ok = Math.abs(v - t.ans) <= Math.abs(t.ans) * t.tol;
    } else if (t.type === 'lesen') {
      if (t.goal) {
        const g = t.goal, s = PL.st; if (PL.cir.id !== t.cir || !s) { out.msg = 'Öffne zuerst die Schaltung und probiere sie aus.'; return out; }
        const c = s.cnt.z1 || { out: 0, in: 0 };
        out.lines.push([c.out >= (g.cnt.z1.out || 0), 'Der Zylinder ist vollständig ausgefahren worden.']);
        out.lines.push([c.in >= (g.cnt.z1.in || 0), 'Der Zylinder ist danach wieder vollständig eingefahren.']);
        if (g.hold) out.lines.push([!!s.hold[g.hold], 'Der Zylinder blieb ausgefahren, obwohl kein Taster mehr gedrückt war.']);
        out.ok = out.lines.every(l => l[0]);
      } else { out.ok = S.sel === t.mcq.ans; out.msg = S.sel == null ? 'Wähle zuerst eine Antwort.' : ''; }
    } else if (t.type === 'verschl') {
      if (PL.task !== t.id) { out.msg = 'Öffne zuerst die Anlage.'; return out; }
      if (!PL.user.length) { out.msg = 'Es sind noch keine Schläuche gelegt.'; return out; }
      const res = C.runChecks(PL.cir, PL.user, PL.cir.checks);
      S.lastCheck = { id: t.id, res };
      res.items.forEach(i => out.lines.push([i.ok, i.text]));
      if (res.leak) out.lines.push([false, 'Es strömt keine Druckluft ungenutzt ab (kein Kurzschluss zwischen Druck und Entlüftung).']);
      out.ok = res.ok;
    }
    return out;
  }
  function taskBody(t) {
    let h = '';
    if (t.type === 'mc') {
      if (t.sym) h += `<div class="symbox">${symSVG(t.sym, { scale: 1.3 })}</div>`;
      h += `<div class="opts">${t.opts.map((o, i) => `<button data-o="${i}" class="${S.sel === i ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
    } else if (t.type === 'tap') {
      h += `<div class="symbox" id="tapBox">${symSVG(t.sym, { scale: 1.6, tap: true, sel: S.sel, reveal: !!(S.res && S.res.ok) })}</div><p class="hint2">${S.sel ? 'Gewählt: Anschluss ' + esc(S.sel) : 'Noch nichts gewählt.'}</p>`;
    } else if (t.type === 'num') {
      h += `<div class="qin"><input id="tpIn" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Antwort"><span class="u">${esc(t.unit)}</span></div><p class="hint2">Richtwerte: 1 bar = 0,1 N/mm². Rechne mit π = 3,14159.</p>`;
    } else if (t.type === 'lesen') {
      if (t.mcq) h += `<p><b>${esc(t.mcq.q)}</b></p><div class="opts">${t.mcq.opts.map((o, i) => `<button data-o="${i}" class="${S.sel === i ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
      else h += '<p class="hint2">Probiere die Schaltung aus und tippe dann auf „Prüfen“.</p>';
    } else if (t.type === 'verschl') {
      h += '<p class="hint2">Die Anlage prüft Verhalten, nicht einzelne Schläuche. Du erfährst, was nicht funktioniert, nicht welcher Schlauch fehlt.</p>';
    }
    return h;
  }
  function resultHtml(t, r) {
    if (!r) return '';
    let h = '';
    if (r.msg && !r.lines.length) h = `<div class="res bad">${esc(r.msg)}</div>`;
    else {
      if (r.lines.length) h += `<ul class="vt">${r.lines.map(l => `<li class="${l[0] ? 'ok' : 'bad'}"><span class="m">${l[0] ? '✓' : '✗'}</span><span>${esc(l[1])}</span></li>`).join('')}</ul>`;
      if (r.ok) {
        const sc = lsGet(K.score, {})[t.id];
        h += `<div class="res ok"><b>✓ Richtig gelöst!</b>${mode() === 'pruef' && sc != null ? ' Punkte: ' + sc + ' %' : ''}<br>${esc(t.expl)}</div>`;
        if (t.steps) h += `<ul class="steps">${t.steps.map(x => '<li>' + esc(x) + '</li>').join('')}</ul>`;
      } else h += `<div class="res bad">${t.type === 'num' && r.val != null ? 'Dein Wert ' + esc(fm(r.val, 2)) + ' ' + esc(t.unit) + ' stimmt noch nicht. Prüfe Einheiten und Rechenweg.' : 'Noch nicht richtig. Probiere es noch einmal oder nimm einen Tipp.'}</div>`;
    }
    return h;
  }
  function taskPanel(host, t) {
    const d = doneMap()[t.id];
    host.innerHTML = `<div class="tp"><div class="tph"><span class="lv">${stars(t.level)}</span> <b>${esc(t.title)}</b>${d ? ' <span class="okb">✓ gelöst</span>' : ''}<small>${esc(t.cat)} · Aufgabe ${esc(t.id)}</small></div><p class="tpt">${esc(t.text)}</p>${taskBody(t)}<div class="btns"><button class="btn pri" data-a="check">✓ Prüfen</button><button class="btn" data-a="tip">💡 Tipp</button></div><div id="tpRes" aria-live="polite">${S.res && S.res.id === t.id ? resultHtml(t, S.res.r) : ''}</div></div>`;
    const bind = () => {
      $$('[data-o]', host).forEach(b => b.onclick = () => { if (S.res && S.res.r.ok) return; S.sel = +b.dataset.o; $$('[data-o]', host).forEach(x => x.classList.toggle('on', x === b)); });
      $$('.tapport', host).forEach(g => g.addEventListener('click', () => { if (S.res && S.res.r.ok) return; S.sel = g.dataset.port; taskPanel(host, t); }));
    };
    bind();
    $('[data-a=check]', host).onclick = () => {
      const r = checkTask(t, host); S.res = { id: t.id, r };
      if (r.ok) { markDone(t.id); if (root.LochFX && root.LochFX.say) try { root.LochFX.say('Richtig!'); } catch (e) {} }
      const keep = $('#tpIn', host) ? $('#tpIn', host).value : null;
      const el = $('#tpRes', host); el.innerHTML = resultHtml(t, r);
      if (t.type === 'tap') { const tb = $('#tapBox', host); if (tb && r.ok) tb.innerHTML = symSVG(t.sym, { scale: 1.6, tap: true, sel: S.sel, reveal: true }); }
      void keep; el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (t.type === 'verschl') taskReqRefresh(t);
    };
    $('[data-a=tip]', host).onclick = () => tipSheet(t);
  }
  function taskPanelRefresh(soft) { const t = S.task && D.TASKS[S.task]; if (!t || t.type !== 'verschl') return; if (soft) { S.res = null; const el = $('#tpRes'); if (el) el.innerHTML = ''; taskReqRefresh(t); } }
  function taskReqRefresh(t) {
    const el = $('#reqList'); if (!el) return;
    const r = S.lastCheck && S.lastCheck.id === t.id && PL.user.length ? S.lastCheck.res : null;
    el.innerHTML = PL.cir.checks.map((c, i) => { const it = r && r.items[i]; return `<li class="${it ? (it.ok ? 'ok' : 'bad') : 'nn'}"><span class="m">${it ? (it.ok ? '✓' : '✗') : '○'}</span><span>${esc(c.text)}</span></li>`; }).join('');
  }

  /* ============================================================ Tabs */
  const TABS = [['sym', 'Symbole'], ['anl', 'Schaltpläne'], ['bsp', 'Beispiele'], ['aufg', 'Aufgaben'], ['rech', 'Rechnen'], ['trn', 'Trainer'], ['help', 'Hilfe']];
  function buildTabs() {
    const d = doneMap(), n = TASKS().filter(t => d[t.id]).length;
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab${S.tab === t[0] ? ' on' : ''}" role="tab" aria-selected="${S.tab === t[0]}" data-t="${t[0]}">${t[1]}${t[0] === 'aufg' ? `<span class="bd">${n}/${TASKS().length}</span>` : ''}</button>`).join('');
    $$('#tabs .tab').forEach(b => b.onclick = () => setTab(b.dataset.t));
    const bt = $('#bTasks'); if (bt) bt.title = n + '/' + TASKS().length + ' Aufgaben gelöst';
  }
  function setTab(t) {
    S.tab = t; lsPut(K.tab, t); $('#mid').dataset.tab = t; buildTabs();
    if (t === 'sym') renderSym(); else if (t === 'anl') renderAnl(); else if (t === 'bsp') renderBsp(); else if (t === 'aufg') renderTasks(); else if (t === 'rech') renderCalc(); else if (t === 'trn') renderTrn(); else renderHelp();
    buildPal();
    const s = $('#pg' + { sym: 'Sym', anl: 'Anl', bsp: 'Bsp', aufg: 'Tasks', rech: 'Calc', trn: 'Trn', help: 'Help' }[t]); if (s) s.scrollTop = 0;
    $('#title').textContent = 'Pneumatik-Lab';
  }

  /* ---- Symbole */
  function renderSym() {
    const v = $('#symView');
    v.innerHTML = `<p class="hint2" style="margin-top:0">Symbole nach DIN ISO 1219-1. Tippe ein Symbol an: Du siehst Anschlüsse, Schaltstellungen und die Bedeutung.</p><div class="symgrid">${D.SYMS.map(s => `<button class="symcard" data-s="${s.id}">${symSVG(s.part, { scale: 0.6 })}<b>${esc(s.name)}</b></button>`).join('')}</div>`;
    $$('.symcard', v).forEach(b => b.onclick = () => symDetail(b.dataset.s));
  }
  function symDetail(id) {
    const s = D.SYMS.find(x => x.id === id); if (!s) return;
    sheet(s.name, (b, close) => {
      const part = Object.assign({}, s.part), valve = part.t === 'v32' || part.t === 'v52';
      const defPos = () => (part.t === 'v32' ? (part.rest === 'NC' ? 'z' : 'f') : '12');
      const actPos = () => (part.t === 'v32' ? (part.rest === 'NC' ? 'f' : 'z') : '14');
      let pos = defPos(), act = false, cyl = 0;
      const draw = () => {
        b.innerHTML = `<div class="symbox">${symSVG(part, { scale: 1.5, ports: true, hi: valve, vpos: valve ? pos : null, pos: cyl, air: part.t === 'quelle' })}</div><p>${esc(s.desc)}</p>
          ${valve ? `<div class="btns"><button class="btn ${act ? '' : 'pri'}" data-p="rest">Ruhestellung</button><button class="btn ${act ? 'pri' : ''}" data-p="act">${part.t === 'v32' || part.s14 === 'pilot' ? 'Betätigt (geschaltet)' : 'Betätigt'}</button></div><p class="hint2">Das farbig hinterlegte Feld ist die aktive Stellung. Die Anschlüsse sind am Feld der Ruhestellung (Federseite) gezeichnet.</p>` : ''}
          ${part.t === 'zyl_da' || part.t === 'zyl_ea' ? `<div class="btns"><button class="btn" data-c="0">Eingefahren</button><button class="btn" data-c="1">Ausgefahren</button></div>` : ''}
          <table class="iot"><tr><th>Anschluss</th><th>Bedeutung</th></tr>${s.ports.map(p => `<tr><td class="a">${esc(p[0] === '1a' || p[0] === '1b' ? '1' : p[0])}</td><td>${esc(p[1])}</td></tr>`).join('')}</table>`;
        $$('[data-p]', b).forEach(x => x.onclick = () => { act = x.dataset.p === 'act'; pos = act ? actPos() : defPos(); draw(); });
        $$('[data-c]', b).forEach(x => x.onclick = () => { cyl = +x.dataset.c; draw(); });
      };
      draw();
    });
  }

  /* ---- Anlage */
  function renderAnl() {
    const v = $('#anlView'); const t = S.task && D.TASKS[S.task];
    const cirs = Object.keys(D.CIRCUITS);
    if (!PL.cir) plLoad(t ? t.cir : (D.CIRCUITS[lsRaw(K.cir, '')] ? lsRaw(K.cir, '') : cirs[0]), t ? t.id : null);
    const c = PL.cir;
    let top = '';
    if (t) top = `<div class="taskhead"><b>${esc(t.title)}</b><button class="chip s" id="bTaskEnd">Aufgabe beenden</button></div>`;
    else top = `<div class="chips cirsel" role="tablist">${cirs.map(id => `<button class="chip${id === c.id ? ' on' : ''}" data-c="${id}">${esc(D.CIRCUITS[id].title)}</button>`).join('')}</div>`;
    v.innerHTML = `${top}<div class="plant"><div id="plHost"></div></div><div id="plStat" class="plstat"></div><div id="anlInfo"></div>`;
    PL.host = $('#plHost'); PL.host.onpointerdown = onDown; PL.sig = '';
    $$('[data-c]', v).forEach(b => b.onclick = () => { S.task = null; S.res = null; S.sel = null; plLoad(b.dataset.c); renderAnl(); buildPal(); });
    const te = $('#bTaskEnd'); if (te) te.onclick = () => { S.task = null; S.res = null; PL.cir = null; renderAnl(); buildPal(); };
    const info = $('#anlInfo');
    if (t) {
      info.innerHTML = `<div id="tpHost"></div>${t.type === 'verschl' ? `<div class="card pl"><h4>Anforderungen</h4><ul class="vt" id="reqList"></ul></div>` : ''}<details class="card"><summary>Bauteile dieser Schaltung</summary><div class="cb">${partList(c)}</div></details>`;
      taskPanel($('#tpHost'), t); taskReqRefresh(t);
    } else {
      info.innerHTML = `<div class="card pl"><h4>${esc(c.title)}</h4><p style="margin:0;line-height:1.45">${esc(c.desc)}</p></div><details class="card" open><summary>Bauteile dieser Schaltung</summary><div class="cb">${partList(c)}</div></details><div class="card pl"><h4>Probiere es aus</h4><p class="hint2" style="margin:0">Tippe auf einen Taster oder Handhebel und halte ihn gedrückt. Mit „Taster rasten“ (unten) bleibt er geschaltet. Beobachte, wie sich Druckfarben und Ventilstellungen ändern.</p></div>`;
    }
    plDraw(true);
  }
  function partList(c) {
    return `<table class="iot">${c.parts.filter(p => p.t !== 'quelle').map(p => `<tr><td class="a">${esc(p.label || p.id)}</td><td>${esc(D.partDesc(p))}</td></tr>`).join('')}</table>`;
  }

  /* ---- Aufgaben */
  function renderTasks() {
    const v = $('#taskView'), d = doneMap(), sc = lsGet(K.score, {});
    const n = TASKS().filter(t => d[t.id]).length;
    if (S.task && D.TASKS[S.task] && !['lesen', 'verschl'].includes(D.TASKS[S.task].type) && S.tab === 'aufg') {
      const t = D.TASKS[S.task];
      v.innerHTML = `<button class="btn s" id="tBack">‹ Alle Aufgaben</button><div id="tpHost2" style="margin-top:10px"></div>`;
      $('#tBack').onclick = () => { S.task = null; S.res = null; S.sel = null; renderTasks(); };
      taskPanel($('#tpHost2'), t); return;
    }
    const cats = D.CATS;
    let h = `<div class="stbar" aria-label="Fortschritt"><i style="width:${Math.round(100 * n / TASKS().length)}%"></i></div><div class="modebar"><b>${n} von ${TASKS().length} gelöst</b><div class="seg"><button data-m="ueben" class="${mode() === 'ueben' ? 'on' : ''}">Üben</button><button data-m="pruef" class="${mode() === 'pruef' ? 'on' : ''}">Prüfen</button></div></div><p class="hint2" style="margin:2px 0 8px">${mode() === 'pruef' ? 'Prüfmodus: Tipps kosten Punkte (Stufe 1: 10 %, Stufe 2: 25 %, Stufe 3: 50 %).' : 'Übungsmodus: Tipps sind frei und kosten nichts.'}</p><div class="fbar"><button class="chip s${S.cat ? '' : ' on'}" data-f="">Alle</button>${cats.map(c => `<button class="chip s${S.cat === c ? ' on' : ''}" data-f="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    cats.filter(c => !S.cat || S.cat === c).forEach(c => {
      h += `<div class="gh">${esc(c)}</div><div class="card" style="padding:0 6px">` + TASKS().filter(t => t.cat === c).map(t => `<button class="row" data-t="${t.id}"><span class="dot ${d[t.id] ? 'g' : ''}">${d[t.id] ? '✓' : ''}</span><div class="grow"><b>${esc(t.title)}</b><small>${t.type === 'verschl' ? 'Verschlauchen in der Anlage' : t.type === 'lesen' ? 'Schaltplan lesen und ausprobieren' : ''}</small></div>${mode() === 'pruef' && sc[t.id] != null ? `<span class="hint2" style="margin:0">${sc[t.id]} %</span>` : ''}<span class="lv">${stars(t.level)}</span></button>`).join('') + '</div>';
    });
    v.innerHTML = h;
    $$('[data-f]', v).forEach(b => b.onclick = () => { S.cat = b.dataset.f; renderTasks(); });
    $$('[data-m]', v).forEach(b => b.onclick = () => { lsPut(K.mode, b.dataset.m); renderTasks(); });
    $$('.row[data-t]', v).forEach(b => b.onclick = () => openTask(b.dataset.t));
  }
  function openTask(id) {
    const t = D.TASKS[id]; if (!t) return;
    S.task = id; S.res = null; S.sel = null; S.lastCheck = null;
    if (t.type === 'lesen' || t.type === 'verschl') { PL.cir = null; plLoad(t.cir, id); setTab('anl'); }
    else setTab('aufg');
  }

  /* ---- Rechnen */
  function genCalc() {
    const Ds = [20, 25, 32, 40, 50, 63, 80], dk = { 20: 8, 25: 10, 32: 12, 40: 16, 50: 20, 63: 20, 80: 25 }, ps = [4, 5, 6, 7, 8];
    const Dm = pk(Ds), d = dk[Dm], p = pk(ps), s = pk([50, 80, 100, 160, 200, 250, 320]), ty = pk(['kaus', 'kein', 'druck', 'verb', 'gesch', 'nutz']);
    const A = C.calc.flaeche(Dm), AR = C.calc.flaecheRing(Dm, d);
    if (ty === 'kaus') { const F = C.calc.kraftAus(p, Dm); return { text: `Ein Zylinder mit ${Dm} mm Kolbendurchmesser wird mit ${p} bar betrieben. Wie groß ist die theoretische Kolbenkraft beim Ausfahren?`, unit: 'N', ans: F, steps: [`A = π/4 · d² = ${fm(A, 1)} mm²`, `F = p · A = ${fm(p / 10, 1)} N/mm² · ${fm(A, 1)} mm² = ${fm(F, 0)} N`] }; }
    if (ty === 'kein') { const F = C.calc.kraftEin(p, Dm, d); return { text: `Zylinder: Kolben ${Dm} mm, Kolbenstange ${d} mm, Druck ${p} bar. Wie groß ist die theoretische Kraft beim Einfahren?`, unit: 'N', ans: F, steps: [`A_Ring = π/4 · (D² − d²) = ${fm(AR, 1)} mm²`, `F = p · A_Ring = ${fm(p / 10, 1)} N/mm² · ${fm(AR, 1)} mm² = ${fm(F, 0)} N`] }; }
    if (ty === 'druck') { const F = Math.round(C.calc.kraftAus(5, Dm) / 10) * 10, pp = C.calc.druckFuerKraft(F, Dm); return { text: `Ein Zylinder mit ${Dm} mm Kolbendurchmesser soll beim Ausfahren theoretisch ${F} N aufbringen. Welcher Druck in bar ist nötig?`, unit: 'bar', ans: pp, steps: [`A = π/4 · d² = ${fm(A, 1)} mm²`, `p = F / A = ${F} N / ${fm(A, 1)} mm² = ${fm(pp / 10, 3)} N/mm² = ${fm(pp, 2)} bar`] }; }
    if (ty === 'verb') { const V = C.calc.luftHub(p, Dm, s); return { text: `Ein Zylinder (Kolben ${Dm} mm, Hub ${s} mm) arbeitet mit ${p} bar Überdruck. Wie viel Luft in Normlitern verbraucht ein Ausfahrhub? (Atmosphärendruck vereinfacht 1 bar)`, unit: 'l', ans: V, steps: [`V = A · s = ${fm(A, 1)} mm² · ${s} mm = ${fm(A * s / 1e6, 4)} l`, `Verbrauch = V · (p + 1) = ${fm(A * s / 1e6, 4)} l · ${p + 1} = ${fm(V, 2)} l`] }; }
    if (ty === 'gesch') { const t = pk([0.5, 0.8, 1, 1.25, 1.6, 2, 2.5]), v = C.calc.geschw(s, t); return { text: `Der Kolben eines Zylinders fährt ${s} mm Hub in ${fm(t, 2)} s aus. Wie groß ist die mittlere Geschwindigkeit in mm/s?`, unit: 'mm/s', ans: v, steps: [`v = s / t = ${s} mm / ${fm(t, 2)} s = ${fm(v, 1)} mm/s`] }; }
    const F = C.calc.kraftAus(p, Dm), Fn = C.calc.kraftNutz(F, 0.15);
    return { text: `Zylinder mit ${Dm} mm Kolbendurchmesser, ${p} bar. Rechne mit 15 % Reibungsverlust (Richtwert 10 bis 20 %). Wie groß ist die Nutzkraft beim Ausfahren?`, unit: 'N', ans: Fn, steps: [`F_theor = p · A = ${fm(F, 0)} N`, `Nutzkraft = F_theor · (1 − 0,15) = ${fm(Fn, 0)} N`] };
  }
  function renderCalc() {
    const v = $('#calcView'), cv = lsGet('lm4.pne.calc', { p: '6', D: '50', d: '20', s: '100', t: '1,2', r: '15' });
    v.innerHTML = `
    <div class="card pl"><h4>Kolbenkraft  F = p · A</h4>
      <div class="dsrow"><label class="f"><span>Druck p (bar)</span><input id="cP" inputmode="decimal" value="${esc(cv.p)}"></label><label class="f"><span>Kolben D (mm)</span><input id="cD" inputmode="decimal" value="${esc(cv.D)}"></label><label class="f"><span>Kolbenstange d (mm)</span><input id="cd" inputmode="decimal" value="${esc(cv.d)}"></label><label class="f"><span>Reibung (%) Richtwert 10 bis 20</span><input id="cR" inputmode="decimal" value="${esc(cv.r)}"></label></div>
      <div id="outF" class="calcout"></div><div id="vzF"></div></div>
    <div class="card pl"><h4>Luftverbrauch  V = A · s · (p + 1)</h4>
      <div class="dsrow"><label class="f"><span>Hub s (mm)</span><input id="cS" inputmode="decimal" value="${esc(cv.s)}"></label><label class="f"><span>Doppelhübe je Minute</span><input id="cN" inputmode="decimal" value="${esc(cv.n || '10')}"></label></div>
      <div id="outV" class="calcout"></div><div id="vzV"></div><p class="hint2">Druck und Durchmesser kommen aus der Kraftrechnung oben. Atmosphärendruck vereinfacht 1 bar (Richtwert).</p></div>
    <div class="card pl"><h4>Kolbengeschwindigkeit  v = s / t</h4>
      <div class="dsrow"><label class="f"><span>Hub s (mm), wie oben</span><input id="cS2" disabled></label><label class="f"><span>Zeit t (s)</span><input id="cT" inputmode="decimal" value="${esc(cv.t)}"></label></div>
      <div id="outG" class="calcout"></div></div>
    <div class="card pl"><h4>Übungsaufgabe mit Zufallswerten</h4><div id="cuHost"></div></div>`;
    const g = id => parseNum($('#' + id).value);
    const upd = () => {
      const p = g('cP'), Dm = g('cD'), d = g('cd'), r = g('cR'), s = g('cS'), t = g('cT'), n = g('cN');
      $('#cS2').value = $('#cS').value;
      const ok = isFinite(p) && isFinite(Dm) && Dm > 0 && p >= 0;
      let h = '';
      if (ok) {
        const A = C.calc.flaeche(Dm), F = C.calc.kraftAus(p, Dm);
        h += `<table class="iot"><tr><td>Kolbenfläche A</td><td class="a">${fm(A, 1)} mm²</td></tr><tr><td>Kraft Ausfahren (theoretisch)</td><td class="a"><b>${fm(F, 0)} N</b></td></tr>`;
        if (isFinite(d) && d > 0 && d < Dm) { const Fe = C.calc.kraftEin(p, Dm, d); h += `<tr><td>Ringfläche A<sub>Ring</sub></td><td class="a">${fm(C.calc.flaecheRing(Dm, d), 1)} mm²</td></tr><tr><td>Kraft Einfahren (theoretisch)</td><td class="a"><b>${fm(Fe, 0)} N</b></td></tr>`; }
        if (isFinite(r) && r >= 0 && r < 100) h += `<tr><td>Nutzkraft Ausfahren (−${fm(r, 0)} % Reibung)</td><td class="a"><b>${fm(C.calc.kraftNutz(F, r / 100), 0)} N</b></td></tr>`;
        h += '</table><p class="hint2">Reibung (Dichtungen, Führung) macht etwa 10 bis 20 % aus: Richtwert, für genaue Auslegung zählen die Herstellerangaben.</p>';
      } else h = '<p class="hint2">Gib Druck und Kolbendurchmesser ein.</p>';
      $('#outF').innerHTML = h;
      $('#vzF').innerHTML = root.PNEVIZ ? root.PNEVIZ.kraft({ p, D: Dm, d, r }) : '';
      let hv = '';
      if (ok && isFinite(s) && s > 0) {
        const a = C.calc.luftHub(p, Dm, s), e = isFinite(d) && d > 0 && d < Dm ? C.calc.luftHub(p, Dm, s, d, 'ein') : null;
        hv = `<table class="iot"><tr><td>Ausfahrhub</td><td class="a"><b>${fm(a, 3)} l</b></td></tr>${e != null ? `<tr><td>Einfahrhub (Ringfläche)</td><td class="a"><b>${fm(e, 3)} l</b></td></tr><tr><td>Doppelhub</td><td class="a"><b>${fm(a + e, 3)} l</b></td></tr>${isFinite(n) && n > 0 ? `<tr><td>Je Minute (${fm(n, 0)} Doppelhübe)</td><td class="a"><b>${fm((a + e) * n, 1)} l/min</b></td></tr>` : ''}` : ''}</table>`;
      } else hv = '<p class="hint2">Gib den Hub ein.</p>';
      $('#outV').innerHTML = hv;
      $('#vzV').innerHTML = root.PNEVIZ ? root.PNEVIZ.luft({ p, D: Dm, d, s }) : '';
      $('#outG').innerHTML = isFinite(s) && isFinite(t) && t > 0 ? `<table class="iot"><tr><td>Geschwindigkeit</td><td class="a"><b>${fm(C.calc.geschw(s, t), 1)} mm/s = ${fm(C.calc.geschw(s, t) / 1000, 3)} m/s</b></td></tr></table>` : '<p class="hint2">Gib Hub und Zeit ein.</p>';
      lsSet('lm4.pne.calc', { p: $('#cP').value, D: $('#cD').value, d: $('#cd').value, s: $('#cS').value, t: $('#cT').value, r: $('#cR').value, n: $('#cN').value });
    };
    $$('input', v).forEach(i => i.addEventListener('input', upd)); upd();
    newCalcTask($('#cuHost'));
  }
  function newCalcTask(host, after) {
    const q = genCalc(); let solved = false;
    host.innerHTML = `<p style="margin-top:0">${esc(q.text)}</p><div class="qin"><input id="cuIn" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Antwort"><span class="u">${esc(q.unit)}</span></div><div class="btns"><button class="btn pri" data-a="ck">✓ Prüfen</button><button class="btn" data-a="nw">Neue Aufgabe</button></div><div id="cuRes" aria-live="polite"></div>`;
    $('[data-a=nw]', host).onclick = () => newCalcTask(host, after);
    const ck = () => {
      const val = parseNum($('#cuIn', host).value), el = $('#cuRes', host);
      if (!isFinite(val)) { el.innerHTML = '<div class="res bad">Gib zuerst eine Zahl ein.</div>'; return; }
      const ok = Math.abs(val - q.ans) <= Math.abs(q.ans) * 0.02;
      el.innerHTML = ok ? `<div class="res ok"><b>✓ Richtig!</b></div><ul class="steps">${q.steps.map(x => '<li>' + esc(x) + '</li>').join('')}</ul>` : `<div class="res bad">Noch nicht richtig. Prüfe Einheiten und Rechenweg.</div><details class="card" style="margin-top:8px"><summary>Rechenweg anzeigen</summary><div class="cb"><ul class="steps">${q.steps.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div></details>`;
      if (after && !solved) { solved = true; after(ok); }
    };
    $('[data-a=ck]', host).onclick = ck; $('#cuIn', host).addEventListener('keydown', e => { if (e.key === 'Enter') ck(); });
  }

  /* ---- Trainer */
  function renderTrn() {
    const v = $('#trnView'), T = S.trn, st = T.stat;
    v.innerHTML = `<div class="modebar"><div class="seg"><button data-m="sym" class="${T.mode === 'sym' ? 'on' : ''}">Symbole</button><button data-m="kraft" class="${T.mode === 'kraft' ? 'on' : ''}">Kraft und Luft</button></div><span class="hint2" style="margin:0">Richtig: <b>${st.ok}</b> von ${st.n} · Serie: <b>${st.streak}</b> (Rekord ${st.best})</span></div><div id="trnHost"></div>`;
    $$('[data-m]', v).forEach(b => b.onclick = () => { T.mode = b.dataset.m; T.q = null; renderTrn(); });
    const host = $('#trnHost'), upd = ok => { st.n++; if (ok) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet(K.tr, st); };
    if (T.mode === 'kraft') {
      newCalcTask(host, ok => { upd(ok); $('.hint2 b', v).textContent = st.ok; });
      const bn = $('[data-a=nw]', host); bn.onclick = () => renderTrn();
      return;
    }
    const pool = D.SYMS.filter(s => s.id !== 'v32s');
    if (!T.q) { const c = pk(pool), opts = [c]; while (opts.length < 4) { const o = pk(pool); if (!opts.includes(o)) opts.push(o); } T.q = { c, opts: opts.sort(() => Math.random() - 0.5), done: null }; }
    const q = T.q;
    host.innerHTML = `<p style="margin-top:0"><b>Welches Bauteil zeigt das Symbol?</b></p><div class="symbox">${symSVG(q.c.part, { scale: 1.4 })}</div><div class="opts">${q.opts.map((o, i) => `<button data-o="${i}" class="${q.done == null ? '' : (o === q.c ? 'ok' : q.done === i ? 'bad' : '')}"${q.done != null ? ' disabled' : ''}>${esc(o.name)}</button>`).join('')}</div>${q.done != null ? `<div class="res ${q.opts[q.done] === q.c ? 'ok' : 'bad'}"><b>${q.opts[q.done] === q.c ? '✓ Richtig!' : 'Leider falsch.'}</b><br>${esc(q.c.desc)}</div><div class="btns"><button class="btn pri" data-a="nx">Nächstes Symbol</button></div>` : ''}`;
    $$('[data-o]', host).forEach(b => b.onclick = () => { q.done = +b.dataset.o; upd(q.opts[q.done] === q.c); renderTrn(); });
    const nx = $('[data-a=nx]', host); if (nx) nx.onclick = () => { T.q = null; renderTrn(); };
  }

  /* ---- Hilfe */
  function renderHelp() {
    const v = $('#helpView'), sy = id => symSVG(D.SYMS.find(s => s.id === id).part, { scale: 0.85, ports: true });
    v.innerHTML = `
    <details open><summary>Symbole (Spickzettel)</summary><div class="hb2"><p>Tippe im Tab „Symbole“ ein Bauteil an, dort siehst du Anschlüsse und Schaltstellungen.</p><table><tr><th>Bauteil</th><th>Merkmal</th></tr>${D.SYMS.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.desc)}</td></tr>`).join('')}</table></div></details>
    <details><summary>Anschlussbezeichnungen</summary><div class="hb2"><table><tr><th>Nr.</th><th>Bedeutung</th></tr><tr><td><code>1</code></td><td>Druckluftanschluss (Versorgung)</td></tr><tr><td><code>2, 4</code></td><td>Arbeitsanschlüsse (zum Zylinder). Die 2 gehört zur Verbindung 1→2 (3/2: Ausgang)</td></tr><tr><td><code>3, 5</code></td><td>Entlüftung. 3 entlüftet 2, 5 entlüftet 4</td></tr><tr><td><code>12</code></td><td>Steueranschluss: Signal verbindet 1 mit 2</td></tr><tr><td><code>14</code></td><td>Steueranschluss: Signal verbindet 1 mit 4</td></tr><tr><td><code>10</code></td><td>Steueranschluss: Signal sperrt Anschluss 1 (bei 3/2 in Ruhe offen)</td></tr><tr><td><code>K, S</code></td><td>Zylinder (in diesem Lab): K = Kolbenseite (Ausfahren), S = Stangenseite (Einfahren)</td></tr><tr><td><code>V, Z</code></td><td>Drossel-Rückschlagventil (in diesem Lab): V = zum Ventil, Z = zum Zylinder. Frei von V nach Z, gedrosselt von Z nach V</td></tr></table><div class="symrow">${sy('v52p')}${sy('v32nc')}</div><p class="hint2">Bei den Wegeventilen sind die Anschlüsse am Feld der Ruhestellung gezeichnet (Federseite, rechts).</p></div></details>
    <details><summary>Ventilarten und Funktionen</summary><div class="hb2"><p><b>3/2-Wegeventil</b>: drei Anschlüsse, zwei Stellungen. Steuert einfachwirkende Zylinder oder liefert Signale. „In Ruhe gesperrt“: 1 zu, 2 entlüftet. „In Ruhe offen“: 1 nach 2.</p><p><b>5/2-Wegeventil</b>: fünf Anschlüsse, zwei Stellungen. Steuert doppeltwirkende Zylinder. Ruhe (Feder): 1→2 und 4 entlüftet über 5. Betätigt (14): 1→4 und 2 entlüftet über 3.</p><p><b>Impulsventil</b>: 5/2 mit zwei Steueranschlüssen ohne Feder. Bleibt in der zuletzt geschalteten Stellung (Speicher, Selbsthaltung).</p><p><b>Wechselventil (ODER)</b>: Druck am Ausgang, wenn mindestens ein Eingang Druck hat.</p><p><b>Zweidruckventil (UND)</b>: Druck am Ausgang nur, wenn beide Eingänge Druck haben.</p><p><b>Drossel-Rückschlagventil</b>: Geschwindigkeit einstellen. <b>Abluftdrosselung</b> (Standard bei Zylindern): Die Abluft wird gedrosselt, der Kolben fährt gleichmäßig. Zuluftdrosselung neigt zum Rucken.</p><p><b>Rollenhebelventil</b>: wird von der Kolbenstange betätigt, meldet die Endlage.</p></div></details>
    <details><summary>Schaltpläne lesen und verschlauchen</summary><div class="hb2"><ol><li>Beginne bei der Druckluftquelle und Wartungseinheit. Verfolge die Druckluft Leitung für Leitung.</li><li>Ermittle die Stellung jedes Ventils in Ruhe: Welche Anschlüsse sind verbunden?</li><li>Prüfe, welche Signale ein Ventil betätigen (Taster, Rollenhebel, Steuerluft).</li><li>Farben in der Simulation: <b>blau</b> = Druckluft, <b>grau</b> = drucklos. Das aktive Feld eines Ventils ist farbig hinterlegt.</li></ol><p><b>Verschlauchen:</b> Tippe einen Anschluss, dann den zweiten: Der Schlauch wird gelegt. Zum Entfernen schalte „Schlauch löschen“ ein und tippe den Schlauch an. Ein unbelegter Ventilanschluss gilt als verschlossen, die Entlüftungen 3 und 5 sind offen. „Prüfen“ spielt die Abläufe durch und sagt dir, was nicht funktioniert. Welcher Schlauch fehlt, musst du selbst herausfinden.</p><p><b>Bedienung:</b> Taster gedrückt halten. Mit „Taster rasten“ unten schaltet jedes Antippen um (praktisch, wenn zwei Taster gleichzeitig gedrückt sein sollen).</p></div></details>
    <details><summary>Formeln (Richtwerte)</summary><div class="hb2"><table><tr><th>Größe</th><th>Formel</th></tr><tr><td>Kolbenfläche</td><td><code>A = π/4 · D²</code></td></tr><tr><td>Ringfläche (Einfahren)</td><td><code>A = π/4 · (D² − d²)</code></td></tr><tr><td>Kolbenkraft</td><td><code>F = p · A</code> (1 bar = 0,1 N/mm²)</td></tr><tr><td>Nutzkraft</td><td><code>F<sub>N</sub> = F · (1 − Reibung)</code>, Reibung rund 10 bis 20 % (Richtwert)</td></tr><tr><td>Luftverbrauch je Hub</td><td><code>V = A · s · (p + 1)</code> in Normlitern (p in bar Überdruck, Atmosphärendruck vereinfacht 1 bar)</td></tr><tr><td>Geschwindigkeit</td><td><code>v = s / t</code></td></tr></table><p class="hint2">Beispiel: D = 50 mm, p = 6 bar: A = 1963,5 mm², F = 1178 N.</p></div></details>
    <details><summary>Sicherheit in der Werkstatt</summary><div class="hb2"><p>Druckluft nie auf Personen richten. Vor dem Umbau Anlage entlüften, Schläuche nicht unter Druck abziehen. Zylinder können unerwartet ausfahren: nicht in den Bewegungsbereich greifen. Schutzbrille tragen.</p></div></details>`;
  }

  /* ---- Bedienleiste */
  function buildPal() {
    const pal = $('#pal'); pal.style.display = S.tab === 'anl' ? '' : 'none';
    if (S.tab !== 'anl') return;
    const t = S.task && D.TASKS[S.task], bau = PL.mode === 'bau';
    pal.innerHTML = `<button class="chip${PL.running ? '' : ' on'}" data-p="run" aria-label="Simulation anhalten oder fortsetzen">${PL.running ? '⏸ Pause' : '▶ Weiter'}</button><button class="chip" data-p="reset" aria-label="Zurücksetzen">⟲ Zurücksetzen</button><div class="seg" aria-label="Tempo"><button data-p="sp" data-v="0.5" class="${PL.speed === 0.5 ? 'on' : ''}">½×</button><button data-p="sp" data-v="1" class="${PL.speed === 1 ? 'on' : ''}">1×</button><button data-p="sp" data-v="2" class="${PL.speed === 2 ? 'on' : ''}">2×</button></div><button class="chip${PL.latch ? ' on' : ''}" data-p="latch">Taster rasten</button><button class="chip s" data-p="zm" data-v="-1" aria-label="Verkleinern">－</button><button class="chip s" data-p="zm" data-v="1" aria-label="Vergrößern">＋</button>${bau ? `<span class="sep"></span><button class="chip${PL.del ? ' warnc on' : ''}" data-p="del">Schlauch löschen</button><button class="chip" data-p="undo">↶ Rückgängig</button><button class="chip danger" data-p="clear">Alle entfernen</button>` : ''}${t ? `<span class="sep"></span><button class="chip go" data-p="chk">✓ Prüfen</button><button class="chip" data-p="tip">💡 Tipp</button>` : ''}<span id="stat"></span>`;
    $$('[data-p]', pal).forEach(b => b.onclick = () => palAct(b));
  }
  function palAct(b) {
    const a = b.dataset.p;
    if (a === 'run') { PL.running = !PL.running; buildPal(); }
    else if (a === 'reset') { if (PL.mode === 'bau') { plRebuild(); } else plRebuild(); plDraw(true); toast('Anlage zurückgesetzt'); }
    else if (a === 'sp') { PL.speed = +b.dataset.v; buildPal(); }
    else if (a === 'latch') { PL.latch = !PL.latch; lsPut(K.latch, PL.latch ? '1' : '0'); if (!PL.latch) Object.keys(PL.st.inp).forEach(k => { PL.st.inp[k] = 0; }); buildPal(); plDraw(true); }
    else if (a === 'zm') { const z = zoomEff(), n = Math.max(0.5, Math.min(2.4, z * (b.dataset.v > 0 ? 1.25 : 0.8))); PL.zoom = +n.toFixed(2); lsSet(K.zoom, PL.zoom); plDraw(true); }
    else if (a === 'del') { PL.del = !PL.del; PL.sel = null; buildPal(); plDraw(true); }
    else if (a === 'undo') undoHose();
    else if (a === 'clear') clearHoses();
    else if (a === 'chk') { const bt = $('#tpHost [data-a=check]'); if (bt) { bt.click(); } }
    else if (a === 'tip') { const t = S.task && D.TASKS[S.task]; if (t) tipSheet(t); }
  }

  /* ---- Menue */
  function openMenu() {
    const d = doneMap(), n = TASKS().filter(t => d[t.id]).length;
    const rows = [['tasks', 'Aufgaben', n + ' von ' + TASKS().length + ' gelöst'], ['mode', 'Modus: ' + (mode() === 'pruef' ? 'Prüfen' : 'Üben'), 'Im Prüfmodus kosten Tipps Punkte'], ['help', 'Hilfe und Spickzettel', 'Symbole, Anschlüsse, Formeln'], ['reset', 'Fortschritt zurücksetzen', 'Gelöste Aufgaben und Tipps dieses Labs löschen'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', async e => {
        const r = e.target.closest('.row'); if (!r) return; const m = r.dataset.m; close();
        if (m === 'tasks') setTab('aufg'); else if (m === 'help') setTab('help'); else if (m === 'start') location.href = 'index.html';
        else if (m === 'mode') { lsPut(K.mode, mode() === 'pruef' ? 'ueben' : 'pruef'); toast('Modus: ' + (mode() === 'pruef' ? 'Prüfen' : 'Üben')); if (S.tab === 'aufg') renderTasks(); }
        else if (m === 'reset' && await confirmSheet('Fortschritt zurücksetzen?', 'Alle gelösten Aufgaben, Punkte, Tipps und gelegten Schläuche im Pneumatik-Lab werden gelöscht.', 'Zurücksetzen', true)) { [K.done, K.score, K.prog, K.hints, K.bau].forEach(k => { try { localStorage.removeItem(k); } catch (e2) {} }); S.task = null; PL.cir = null; buildTabs(); setTab('aufg'); toast('Fortschritt gelöscht'); }
      });
    });
  }

  /* ============================================================ Start */
  function init() {
    try { const sc0 = lsGet(K.score, null); if (sc0 && Object.keys(sc0).length) lsSet(K.prog, sc0); } catch (e) { }   // früher gelöste Aufgaben in den gemeinsamen Fortschritt übernehmen
    const bm = $('#bMenu');
  root.LabGoto = id => { try { if (D.TASKS[id]) { openTask(id); return true; } } catch (e) {} return false; }; if (bm) bm.onclick = openMenu;
    const bt = $('#bTasks'); if (bt) bt.onclick = () => { S.task = null; setTab('aufg'); };
    const bh = $('#bHelp'); if (bh) bh.onclick = () => setTab('help');
    window.addEventListener('resize', () => { PL.sig = ''; });
    let tab = lsRaw(K.tab, 'sym'); if (!TABS.some(t => t[0] === tab)) tab = 'sym';
    S.tab = tab; buildTabs(); setTab(tab);
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { setTab('bsp'); } } catch (e) {}
    try {
      const q = new URLSearchParams(location.search), a = q.get('aufgabe');
      if (a && D.TASKS[a]) setTimeout(() => openTask(a), 200);
    } catch (e) {}
    requestAnimationFrame(frame);
  }
  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = D.BEISPIELE || [], BSP_INTRO = 'Die fertigen Schaltungen aus „Schaltpläne“ als Auswahl. „Simulation öffnen“ lädt die Schaltung, dort kannst du Taster betätigen und die Luft verfolgen.', BSP_BTN = 'Simulation öffnen';
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p>' + '' + '<div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTN + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) { S.task = null; S.res = null; S.sel = null; plLoad(b.cir); setTab('anl'); toast('Schaltung geladen: ' + b.titel); }
  root.PNE_UI = { S, PL, setTab, openTask, plLoad, plDraw, checkTask, symSVG, drawPart, genCalc, route, markDone };
  init();
})(window);
