'use strict';
/* Tonfunk CNC-Lab: Oberfläche (Lab-Kennung 'cnc').
   Reiter: Programm (Editor + Simulation), Trainer, Aufgaben, Hilfe.
   Module: cnccore.js (CNC_CORE: Interpreter, Bahn, Zeit), cncdata.js (CNC_DATA, CNC_TASKS: Beispiele, Aufgaben, Trainer).
   Speicher (Präfix lm4.cnc.): tab, mach, src, stk, speed, done ({id:true} nur gelöste), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), rt (Trainer: n, ok, streak, best), tr (Trainer-Einstellungen).
   Tipp-Abzug (25 % je Stufe) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts. */
(function (root) {
  const C = root.CNC_CORE, D = root.CNC_DATA;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.cnc.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const nf = C ? C.fmtNum : String, f3 = v => C.fmtDe(v, 3);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };

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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>CNC-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">cnccore.js oder cncdata.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['prog', '⌨', 'Programm'], ['bsp', '💡', 'Beispiele'], ['tr', '📍', 'Trainer'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']];
  const DEF = { turn: { d: 40, l: 52 }, mill: { w: 80, h: 60, d: 20 } };
  const S = {
    tab: lsGet('tab', 'prog'), mach: lsGet('mach', 'turn'), src: lsGet('src', null), stk: Object.assign({ turn: Object.assign({}, DEF.turn), mill: Object.assign({}, DEF.mill) }, lsGet('stk', {})), speed: lsGet('speed', 3),
    task: null, tAns: {}, tRes: null, tSim: {}, pw: null, wb: null, twb: null,
    tr: Object.assign({ kind: 'coord', mach: 'mill', level: 1 }, lsGet('tr', {}), { item: null, res: null, ans: [], sim: false }),
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  if (S.mach !== 'turn' && S.mach !== 'mill') S.mach = 'turn';
  if (!['coord', 'inc', 'pos', 'zeit'].includes(S.tr.kind)) S.tr.kind = 'coord';
  if (S.tr.mach !== 'turn' && S.tr.mach !== 'mill') S.tr.mach = 'mill';
  if (![1, 2, 3].includes(S.tr.level)) S.tr.level = 1;
  const clamp = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const T0 = S.stk.turn, M0 = S.stk.mill;
  T0.d = clamp(T0.d, 10, 100, 40); T0.l = clamp(T0.l, 20, 200, 52); M0.w = clamp(M0.w, 20, 200, 80); M0.h = clamp(M0.h, 20, 200, 60); M0.d = clamp(M0.d, 5, 60, 20);
  const setupOf = mach => mach === 'turn' ? { machine: 'turn', stock: { d: S.stk.turn.d, zmax: 2, zmin: 2 - S.stk.turn.l } } : { machine: 'mill', stock: { x0: 0, y0: 0, x1: S.stk.mill.w, y1: S.stk.mill.h, depth: S.stk.mill.d } };
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return m ? decodeURIComponent(m[1]) : null; })();
  let seedN = 0;

  /* ============================================================ Zeichnungen (Aufgaben und Hilfe) */
  function svgFig(f) {
    let s = '', W = 440, H, X, Y;
    if (f.kind === 'turn') {
      const pts = f.pts, total = -pts[pts.length - 1][1], maxD = Math.max.apply(null, pts.map(p => p[0])); H = 215; const padL = 26, padR = 22, base = H - 52, sc = Math.min((W - padL - padR) / total, (base - 38) / (maxD / 2));
      X = z => padL + (total + z) * sc; Y = r => base - r * sc;
      const poly = [[0, 0]].concat(pts.map(p => [p[1], p[0] / 2])).concat([[pts[pts.length - 1][1], 0]]);
      s += `<polygon class="sg-poly" points="${poly.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
      s += `<line class="sg-axis" x1="${padL - 12}" y1="${Y(0)}" x2="${W - 6}" y2="${Y(0)}"/><line class="sg-axis" x1="${X(0)}" y1="${Y(maxD / 2) - 22}" x2="${X(0)}" y2="${Y(0) + 8}" style="stroke:#ff9f1c;opacity:1"/>`;
      s += `<text x="${X(0) + 4}" y="${Y(maxD / 2) - 26}" class="sg-lab" style="fill:#ff9f1c">Z0 Planfläche</text>`;
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const a = pts[i], b = pts[i + 1], mx = (X(a[1]) + X(b[1])) / 2;
        s += `<text x="${mx}" y="${Y(a[0] / 2) + 15}" text-anchor="middle" class="sg-dim">${f.dim === 'r' ? 'r ' + nf(a[0] / 2) : 'Ø ' + nf(a[0])}</text>`;
        s += `<text x="${mx}" y="${Y(0) + 17}" text-anchor="middle" class="sg-dim">${nf(a[1] - b[1])} lang</text>`;
      }
      pts.forEach((p, i) => { s += `<circle class="sg-pt" cx="${X(p[1])}" cy="${Y(p[0] / 2)}" r="4"/><text x="${X(p[1]) + (i % 2 ? 3 : 3)}" y="${Y(p[0] / 2) - 7}" class="sg-lab">P${i + 1}</text>`; });
      s += `<path class="sg-arrow" d="M${padL},${H - 12} H${padL + 50} m-7,-4 l7,4 l-7,4"/><text x="${padL + 58}" y="${H - 8}" class="sg-lab">+Z</text>`;
      s += `<path class="sg-arrow" d="M${W - 14},${base + 6} V${base - 44} m-4,7 l4,-7 l4,7"/><text x="${W - 40}" y="${base - 46}" class="sg-lab">+X</text>`;
    } else {
      H = 270; const pad = 20, sc = Math.min((W - 2 * pad - 24) / f.W, (H - 2 * pad - 14) / f.H);
      X = x => pad + 20 + x * sc; Y = y => H - pad - 4 - y * sc;
      s += `<rect class="sg-stock" x="${X(0)}" y="${Y(f.H)}" width="${f.W * sc}" height="${f.H * sc}"/><text x="${X(f.W) - 4}" y="${Y(f.H) - 5}" text-anchor="end" class="sg-dim">Rohteil ${f.W} × ${f.H}</text>`;
      s += `<polygon class="sg-poly" points="${f.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
      const cx = f.pts.reduce((a, p) => a + p[0], 0) / f.pts.length, cy = f.pts.reduce((a, p) => a + p[1], 0) / f.pts.length;
      f.pts.forEach((p, i) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; s += `<circle class="sg-pt" cx="${X(p[0])}" cy="${Y(p[1])}" r="4"/><text x="${X(p[0]) + dx / l * 17 - 8}" y="${Y(p[1]) - dy / l * 17 + 4}" class="sg-lab">P${i + 1}</text>`; });
      const zx = f.zero === 'center' ? f.W / 2 : f.zero === 'tr' ? f.W : 0, zy = f.zero === 'center' ? f.H / 2 : f.zero === 'tr' ? f.H : 0, ox = X(zx), oy = Y(zy), dxs = f.zero === 'tr' ? -1 : 1, dys = f.zero === 'tr' ? -1 : 1;
      s += `<circle cx="${ox}" cy="${oy}" r="6" fill="none" stroke="#ff9f1c" stroke-width="2"/><path class="sg-arrow" style="stroke:#ff9f1c" d="M${ox},${oy} h${dxs * 42} m${-dxs * 7},-4 l${dxs * 7},4 l${-dxs * 7},4 M${ox},${oy} v${-dys * 42} m-4,${dys * 7} l4,${-dys * 7} l4,${dys * 7}"/>`;
      s += `<text x="${ox + dxs * 46 - (dxs < 0 ? 14 : 0)}" y="${oy + 14}" class="sg-lab" style="fill:#ff9f1c">+X</text><text x="${ox + 8}" y="${oy - dys * 46 + (dys < 0 ? 12 : 0)}" class="sg-lab" style="fill:#ff9f1c">+Y</text><text x="${ox + (zx === 0 ? 8 : zx === f.W ? -50 : 8)}" y="${oy + (zy === 0 ? -8 : 28)}" class="sg-dim" style="fill:#ff9f1c">Nullpunkt</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Zeichnung ${f.kind === 'turn' ? 'Drehteil' : 'Frästeil'} mit Punkten P1 bis P${f.pts.length}">${s}</svg>`;
  }
  function figList(f) {
    if (f.kind === 'turn') return `<table class="tt"><tr><th>Punkt</th><th>${f.dim === 'r' ? 'Radius' : 'Durchmesser'}</th><th>Abstand von der Planfläche</th></tr>${f.pts.map((p, i) => `<tr><td>P${i + 1}</td><td>${f.dim === 'r' ? 'r ' + nf(p[0] / 2) : 'Ø ' + nf(p[0])} mm</td><td>${nf(-p[1])} mm</td></tr>`).join('')}</table><p class="hint2">Der Werkstücknullpunkt liegt auf der Planfläche in der Drehachse. Z zeigt aus dem Werkstück heraus, im Werkstück ist Z negativ.</p>`;
    return `<table class="tt"><tr><th>Punkt</th><th>von links</th><th>von unten</th></tr>${f.pts.map((p, i) => `<tr><td>P${i + 1}</td><td>${nf(p[0])} mm</td><td>${nf(p[1])} mm</td></tr>`).join('')}</table><p class="hint2">Maße gemessen von der linken unteren Ecke des Rohteils. Der Werkstücknullpunkt (orange) liegt ${f.zero === 'corner' ? 'in der linken unteren Ecke' : f.zero === 'center' ? 'in der Mitte des Rohteils' : 'in der rechten oberen Ecke'}.</p>`;
  }

  /* ============================================================ Werkbank: Editor + Simulation */
  const SPEEDS = [8, 16, 32, 64, 128, 300];   /* sichtbare Geschwindigkeit des Arbeitsgangs in mm/s, Eilgang vierfach */
  const SPEEDN = ['sehr langsam', 'langsam', 'normal', 'schnell', 'sehr schnell', 'Zeitraffer'];
  const LH = 22;
  function codeLabel(g) { return g == null ? '' : 'G' + g; }
  function Workbench(host, cfg) {
    const wb = { host, cfg, setup: cfg.setup, run: null, ref: cfg.target || null, showRef: true }, ro = !!cfg.readonly;
    host.innerHTML = `<div class="wb ${cfg.sim === false ? 'one' : 'two'}" data-v="ed">
      <div class="wsw seg"><button data-v="ed" class="on">⌨ Programm</button><button data-v="sim">▶ Simulation</button></div>
      <div class="edc"><div class="ed"><div class="gut"><div class="gin"></div></div><div class="gw"><div class="hl2"><div class="hli"></div></div><textarea wrap="off" spellcheck="false" autocapitalize="characters" autocomplete="off" autocorrect="off" inputmode="text" aria-label="CNC-Programm" ${ro ? 'readonly' : ''}></textarea></div></div>
        ${ro ? '' : '<div class="qk" role="toolbar" aria-label="Schnelltasten"></div>'}<div class="msgs"></div></div>
      <div class="simc"><div class="alarm" hidden></div><div class="inst"><div class="svgh"></div></div>
        <div class="ctl"><button class="chip" data-c="reset" title="Zurück zum Anfang">⏮ Anfang</button><button class="chip" data-c="back" title="Einen Satz zurück">◀ Satz</button><button class="chip on" data-c="play">▶ Start</button><button class="chip" data-c="step" title="Einzelsatz: nächsten Satz ausführen">Satz ▶|</button><button class="chip" data-c="end" title="Bis zum Ende">⏭ Ende</button>${wb.ref ? '<button class="chip on" data-c="ref" aria-pressed="true">Sollkontur</button>' : ''}</div>
        <div class="sl"><span>Tempo</span><input type="range" min="1" max="6" step="1" class="spd" aria-label="Simulationsgeschwindigkeit"><span class="spdn" style="min-width:86px"></span></div>
        <div class="rd"></div><div class="rdout stp"></div><div class="rdout tm"></div></div></div>`;
    const el = host.firstElementChild, ta = $('textarea', el), gin = $('.gin', el), hli = $('.hli', el), msgs = $('.msgs', el), qk = $('.qk', el), svgh = $('.svgh', el), rd = $('.rd', el), stp = $('.stp', el), tm = $('.tm', el), alarm = $('.alarm', el), spd = $('.spd', el);
    ta.value = cfg.src || ''; spd.value = S.speed; $('.spdn', el).textContent = SPEEDN[S.speed - 1];
    const P = { mi: 0, d: 0, si: -1, play: false, stopAt: null, last: 0, raf: 0, tm: 0 };
    let stock = null, ap = { mi: 0, d: 0 }, dmi = 0, dR = '', dF = '', stepOf = [], cumT = [], L = null, imgT = 0, dirty = true, cv = null, exLine = -1, els = {};

    /* ---------- Editor ---------- */
    function syncScroll() { gin.style.transform = hli.style.transform = `translateY(${-ta.scrollTop}px)`; }
    ta.addEventListener('scroll', syncScroll);
    function paintGutter() {
      const n = ta.value.split('\n').length, er = new Set(wb.run.errors.map(e => e.line)), wa = new Set(wb.run.warnings.map(e => e.line)); let h = '';
      for (let i = 1; i <= n; i++) h += `<div${er.has(i) ? ' class="er"' : wa.has(i) ? ' class="wa"' : ''}>${i}</div>`;
      gin.innerHTML = h; if (cfg.sim === false) ta.rows = Math.max(3, Math.min(16, n));
    }
    function paintHl() {
      const b = (li, c) => `<div class="${c}" style="top:${8 + li * LH}px"></div>`; let h = '';
      wb.run.warnings.forEach(w => { h += b(w.line - 1, 'wa'); }); wb.run.errors.forEach(e => { h += b(e.line - 1, 'eb'); }); if (exLine >= 0) h += b(exLine, 'ex');
      hli.innerHTML = h;
    }
    function focusLine(n) {
      const lines = ta.value.split('\n'); let a = 0; for (let i = 0; i < n - 1 && i < lines.length; i++) a += lines[i].length + 1;
      ta.focus({ preventScroll: true }); try { ta.setSelectionRange(a, a + (lines[n - 1] || '').length); } catch (e) {}
      ta.scrollTop = Math.max(0, (n - 3) * LH); syncScroll();
    }
    function paintMsgs() {
      const r = wb.run; let h = '';
      r.errors.forEach(e => { h += `<button class="msg er" data-l="${e.line}">⛔ <b>Zeile ${e.line}</b>: ${esc(e.msg)}</button>`; });
      r.warnings.forEach(e => { h += `<button class="msg wa" data-l="${e.line}">⚠ <b>Zeile ${e.line}</b>: ${esc(e.msg)}</button>`; });
      if (!r.errors.length && !r.warnings.length) h = `<div class="msg okk">✓ Keine Fehler. Hauptzeit ${esc(C.fmtTime(r.time.main))}.</div>`;
      msgs.innerHTML = h;
    }
    msgs.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) focusLine(+b.dataset.l); });
    function keys() {
      if (!qk) return; const turn = wb.setup.machine === 'turn';
      const K = [['N⏎', 'nl', 'Neue Zeile mit Satznummer'], ['G0'], ['G1'], ['G2'], ['G3'], ['X'], ['Z'], ['Y', 'Y', 0, turn], ['F'], ['S'], ['M3'], ['M5'], ['I'], ['J', 'J', 0, turn], ['K'], ['R'], ['T'], ['G90'], ['G91'], ['M30'], ['M8'], ['M9'], ['−', '-'], ['.', '.'], ['␣', ' '], ['⌫', 'bs', 'Zeichen löschen']];
      qk.innerHTML = K.filter(k => !k[3]).map(k => `<button class="chip${k[1] === 'nl' ? ' nl' : ''}" data-k="${esc(k[1] || k[0])}" ${k[2] ? 'aria-label="' + esc(k[2]) + '"' : ''}>${esc(k[0])}</button>`).join('');
    }
    function insert(k) {
      ta.focus({ preventScroll: true }); let s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, txt = k;
      if (k === 'bs') { if (s === e && s > 0) s--; ta.setRangeText('', s, e, 'end'); }
      else {
        if (k === 'nl') { let mx = 0; v.split('\n').forEach(l => { const m = /^\s*N(\d+)/i.exec(l); if (m) mx = Math.max(mx, +m[1]); }); const lineStart = v.lastIndexOf('\n', s - 1) + 1, cur = v.slice(lineStart, v.indexOf('\n', s) < 0 ? v.length : v.indexOf('\n', s)).trim(); txt = (cur ? '\n' : '') + 'N' + (mx + 10) + ' '; }
        else if (/^[A-Z]/.test(k)) { const before = v.slice(0, s); if (before && !/[\s(]$/.test(before)) txt = ' ' + k; if (/^[GM]\d/.test(k)) txt += ' '; }
        ta.setRangeText(txt, s, e, 'end');
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (qk) { ['pointerdown', 'mousedown'].forEach(ev => qk.addEventListener(ev, e => { if (e.target.closest('.chip')) e.preventDefault(); })); qk.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) insert(b.dataset.k); }); }

    /* ---------- Simulation: Layout ---------- */
    const turn = () => wb.run.machine === 'turn';
    const hv = p => turn() ? [p[2], p[0] / 2] : [p[0], p[1]];
    const toolR = tn => { const t = wb.run.setup.tools[tn]; return t && t.r != null ? t.r : 0; };
    function layout() {
      const run = wb.run, st = run.setup.stock, tn = turn(); let ax0, ax1, ay0, ay1;
      if (tn) { ax0 = st.zmin; ax1 = st.zmax; ay0 = 0; ay1 = st.d / 2; } else { ax0 = st.x0; ax1 = st.x1; ay0 = st.y0; ay1 = st.y1; }
      let bx0 = ax0, bx1 = ax1, by0 = ay0, by1 = ay1; const cap = 60;
      const inc = p => { const q = hv(p), h = q[0], v = q[1]; if (h > ax0 - cap && h < ax1 + cap && v > ay0 - cap && v < ay1 + cap) { if (h < bx0) bx0 = h; if (h > bx1) bx1 = h; if (v < by0) by0 = v; if (v > by1) by1 = v; } };
      const scan = r => r.moves.forEach(m => { inc(m.pts[0]); inc(m.pts[m.pts.length - 1]); if (m.arc) for (let i = 0; i < m.pts.length; i += Math.max(1, Math.ceil(m.pts.length / 12))) inc(m.pts[i]); });
      scan(run); if (wb.ref) scan(wb.ref);
      if (tn) { bx0 = Math.min(bx0, ax0 - 18); by0 = Math.min(by0, -3); }
      const mg = Math.max(6, 0.05 * (bx1 - bx0)); bx0 -= mg; bx1 += mg; if (!tn) by0 -= mg; by1 += mg;
      const padL = 14, padR = tn ? 12 : 54, pad = 10; let W = 640, sc = (W - padL - padR) / (bx1 - bx0), H = (by1 - by0) * sc + 2 * pad;
      if (H > 470) { sc = (470 - 2 * pad) / (by1 - by0); W = (bx1 - bx0) * sc + padL + padR; H = 470; }
      L = { sc, W, H, padL, pad, bx0, bx1, by0, by1, X: h => padL + (h - bx0) * sc, Y: v => pad + (by1 - v) * sc, tn };
      const X = L.X, Y = L.Y; let s = `<rect class="sg-bg" x="0" y="0" width="${W}" height="${H}"/>`;
      const span = bx1 - bx0, step = span > 130 ? 20 : 10, lab = step * 2;
      for (let h = Math.ceil(bx0 / step) * step; h <= bx1; h += step) { s += `<line class="sg-grid" x1="${X(h)}" y1="${Y(by0)}" x2="${X(h)}" y2="${Y(by1)}"/>`; if (h % lab === 0) s += `<text class="sg-tx" x="${X(h) + 2}" y="${H - 3}">${tn ? 'Z' : 'X'}${h}</text>`; }
      for (let v = Math.ceil(by0 / step) * step; v <= by1; v += step) { s += `<line class="sg-grid" x1="${X(bx0)}" y1="${Y(v)}" x2="${X(bx1)}" y2="${Y(v)}"/>`; if (v % lab === 0 && (!tn || v >= 0)) s += `<text class="sg-tx" x="3" y="${Y(v) - 2}">${tn ? 'X' + v * 2 : 'Y' + v}</text>`; }
      if (tn) {
        s += `<rect class="sg-chuck" x="${X(ax0 - 16)}" y="${Y(ay1 + 8)}" width="${16 * sc}" height="${(ay1 + 8) * sc}"/><text class="sg-tx" x="${X(ax0 - 16) + 2}" y="${Y(ay1 + 8) + 11}">Futter</text>`;
        s += `<rect class="sg-stock" x="${X(ax0)}" y="${Y(ay1)}" width="${(ax1 - ax0) * sc}" height="${ay1 * sc}"/><path class="sg-mat" d="" id="mat${''}" data-r="mat"/>`;
        s += `<line class="sg-axis" x1="${X(bx0)}" y1="${Y(0)}" x2="${X(bx1)}" y2="${Y(0)}"/><line style="stroke:#ff9f1c;stroke-width:1.2" x1="${X(0)}" y1="${Y(ay1 + 10)}" x2="${X(0)}" y2="${Y(0)}"/><text class="sg-tx2" x="${X(0) + 3}" y="${Y(ay1 + 10) + 10}" style="fill:#ff9f1c">Z0</text>`;
        s += `<path class="sg-ref" d="" data-r="refp"/>`;
      } else {
        s += `<image data-r="img" x="${X(ax0)}" y="${Y(ay1)}" width="${(ax1 - ax0) * sc}" height="${(ay1 - ay0) * sc}" preserveAspectRatio="none"/><rect class="sg-stock" style="fill:none" x="${X(ax0)}" y="${Y(ay1)}" width="${(ax1 - ax0) * sc}" height="${(ay1 - ay0) * sc}"/>`;
        s += `<path class="sg-arrow" style="stroke:#ff9f1c" d="M${X(0)},${Y(0)} h30 m-6,-4 l6,4 l-6,4 M${X(0)},${Y(0)} v-30 m-4,6 l4,-6 l4,6"/><text class="sg-tx2" x="${X(0) + 5}" y="${Y(0) + 13}" style="fill:#ff9f1c">X0 Y0</text>`;
        const gx = W - 44, gz0 = 12, gz1 = -st.depth - 3, gy = z => pad + 14 + (gz0 - z) * Math.min(3, (H - 2 * pad - 40) / (gz0 - gz1));
        s += `<text class="sg-tx" x="${gx - 4}" y="${pad + 9}">Z</text><rect x="${gx}" y="${gy(0)}" width="22" height="${gy(-st.depth) - gy(0)}" class="sg-stock" style="stroke-dasharray:none"/><line x1="${gx - 4}" x2="${gx + 26}" y1="${gy(0)}" y2="${gy(0)}" class="sg-axis"/><text class="sg-tx" x="${gx + 24}" y="${gy(0) - 2}">0</text><line data-r="gz" x1="${gx - 6}" x2="${gx + 28}" y1="${gy(0)}" y2="${gy(0)}" style="stroke:#ff5c5c;stroke-width:3"/><text class="sg-tx2" data-r="gzt" x="${gx - 2}" y="${H - 6}"></text>`;
        L.gy = gy; L.gx = gx;
        s += `<path class="sg-ref" d="" data-r="refp"/>`;
      }
      s += `<path class="sg-plan" d="" data-r="plan"/><path class="sg-rapid" d="" data-r="rap"/><path class="sg-feed" d="" data-r="fed"/><g data-r="tool"></g>`;
      svgh.innerHTML = `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="Simulation der Werkzeugbahn">${s}</svg>`;
      els = {}; $$('[data-r]', svgh).forEach(e => { els[e.dataset.r] = e; });
      const mapD = (r, kindF) => r.moves.filter(m => !kindF || m.kind === kindF).map(m => pd(m.pts)).join('');
      els.plan.setAttribute('d', mapD(run));
      if (wb.ref) els.refp.setAttribute('d', wb.showRef ? mapD(wb.ref, 'feed') : '');
      if (tn && wb.ref && wb.showRef) els.refp.setAttribute('d', profD(wb.ref.stock, true));
      if (!tn) { cv = document.createElement('canvas'); cv.width = run.newStock().nx; cv.height = run.newStock().ny; }
    }
    function pd(pts) { return pts.map((p, i) => { const q = hv(p); return (i ? 'L' : 'M') + L.X(q[0]).toFixed(1) + ' ' + L.Y(q[1]).toFixed(1); }).join(''); }
    function profD(stk, open) {
      const sc = (z, r) => L.X(z).toFixed(1) + ' ' + L.Y(r).toFixed(1); let d = '', prev = -1, i = 0;
      for (i = 0; i < stk.n; i++) { const r = stk.rp[i], zl = stk.zmin + i * stk.dz, zr = zl + stk.dz; if (Math.abs(r - prev) > 0.02) { d += (d ? 'L' : 'M') + sc(zl, r); prev = r; } if (i === stk.n - 1 || Math.abs(stk.rp[i + 1] - r) > 0.02) d += 'L' + sc(zr, r); }
      return open ? d : d + 'L' + sc(stk.zmax, 0) + 'L' + sc(stk.zmin, 0) + 'Z';
    }
    function img() {
      const s = stock, n = s.nx * s.ny, ctx = cv.getContext('2d'), id = ctx.createImageData(s.nx, s.ny), dp = Math.max(1, s.depth);
      for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
        const h = s.h[j * s.nx + i], f = h < -0.001 ? 0.4 + 0.6 * Math.min(1, -h / Math.min(dp, 10)) : 0, k = ((s.ny - 1 - j) * s.nx + i) * 4;
        id.data[k] = Math.round(214 - 164 * f); id.data[k + 1] = Math.round(220 - 120 * f); id.data[k + 2] = Math.round(228 - 58 * f); id.data[k + 3] = 255;
      }
      ctx.putImageData(id, 0, 0); els.img.setAttribute('href', cv.toDataURL()); dirty = false; imgT = performance.now();
    }

    /* ---------- Simulation: Ablauf ---------- */
    const moves = () => wb.run.moves, steps = () => wb.run.steps;
    function cutMove(pts, m) { if (turn()) stock.cutPath(pts); else stock.cutPath(pts, toolR(m.tool)); dirty = true; }
    function syncStock() {
      const M = moves();
      while (ap.mi < P.mi && ap.mi < M.length) { const m = M[ap.mi]; if (m.kind === 'feed') cutMove(C.subPath(m, ap.d, m.len), m); ap.mi++; ap.d = 0; }
      if (ap.mi === P.mi && ap.mi < M.length && P.d > ap.d) { const m = M[ap.mi]; if (m.kind === 'feed') cutMove(C.subPath(m, ap.d, P.d), m); ap.d = P.d; }
    }
    function seek(mi, d, si) {
      if (mi < ap.mi || (mi === ap.mi && d < ap.d)) { stock = wb.run.newStock(); ap = { mi: 0, d: 0 }; dirty = true; }
      P.mi = mi; P.d = d; if (si != null) P.si = si; else if (mi < moves().length) P.si = stepOf[mi]; else P.si = steps().length - 1; syncStock();
    }
    function curPos() {
      const M = moves(), start = wb.run.setup.start;
      if (P.mi < M.length) return C.posAt(M[P.mi], P.d);
      return M.length ? M[M.length - 1].pts[M[M.length - 1].pts.length - 1] : [start.x, start.y || 0, start.z];
    }
    function advance(budget) {
      const M = moves(); let hit = false;
      while (budget > 1e-9 && P.mi < M.length) {
        const m = M[P.mi], fac = m.kind === 'rapid' ? 4 : 1, remain = m.len - P.d, mv = budget * fac;
        if (mv >= remain) { budget -= remain / fac; P.mi++; P.d = 0; if (P.stopAt != null && P.mi >= P.stopAt) { P.play = false; P.stopAt = null; hit = true; break; } } else { P.d += mv; budget = 0; }
      }
      if (P.mi >= M.length) { P.play = false; P.stopAt = null; }
      P.si = hit && P.mi > 0 ? stepOf[P.mi - 1] : P.mi < M.length ? stepOf[P.mi] : steps().length - 1;
    }
    /* rAF mit Zeitgeber als Rückfall: In Hintergrund-Tabs pausiert rAF, der Lauf soll trotzdem weitergehen */
    function sched() { if (P.raf || P.tm) return; P.raf = requestAnimationFrame(tick); P.tm = setTimeout(() => tick(performance.now()), 50); }
    function tick(ts) { cancelAnimationFrame(P.raf); clearTimeout(P.tm); P.raf = 0; P.tm = 0; loop(ts); }
    function loop(ts) {
      if (!P.play) { frame(); return; }
      if (!host.isConnected) { P.play = false; return; }
      const dt = Math.min(0.1, (ts - (P.last || ts)) / 1000); P.last = ts; advance(SPEEDS[S.speed - 1] * dt); syncStock(); frame(); sched();
    }
    function play(on) {
      P.play = on; const b = $('[data-c=play]', el); b.textContent = on ? '⏸ Pause' : '▶ Start'; b.setAttribute('aria-pressed', on);
      if (on) { if (P.mi >= moves().length) seek(0, 0, -1); P.last = 0; sched(); }
    }
    function resetPlay() {
      P.play = false; P.stopAt = null; P.mi = 0; P.d = 0; P.si = -1; stock = wb.run.newStock(); ap = { mi: 0, d: 0 }; dmi = 0; dR = ''; dF = ''; dirty = true; exLine = -1;
      const b = $('[data-c=play]', el); if (b) b.textContent = '▶ Start';
    }
    function stepBack() { const st = steps(); if (!st.length) return; P.play = false; P.stopAt = null; const b = P.si - 1; if (b < 0) seek(0, 0, -1); else seek(st[b].m1, 0, b); frame(true); }
    function stepFwd() {
      const st = steps(); if (!st.length) return; let n = P.si < 0 ? 0 : (P.mi >= st[P.si].m1 ? P.si + 1 : P.si); if (n >= st.length) return;
      P.si = n; if (st[n].m1 > P.mi) { P.stopAt = st[n].m1; play(true); } else frame(true);
    }

    /* ---------- Simulation: Anzeige ---------- */
    function gcodes(g) { return [g.motion != null ? 'G' + g.motion : '', 'G' + g.dist, 'G' + g.wcs, 'G' + g.plane, 'G' + g.fm, 'G' + g.comp].filter(Boolean).join(' '); }
    function frame(scroll) {
      if (!L) return; const run = wb.run, M = moves(), tn = turn(), p = curPos(), step = P.si >= 0 ? steps()[P.si] : null, stt = step ? step.state : null;
      const pb = $('[data-c=play]', el); pb.textContent = P.play ? '⏸ Pause' : '▶ Start'; pb.setAttribute('aria-pressed', P.play);
      /* Material */
      if (tn) els.mat && els.mat.setAttribute('d', profD(stock)); else if (dirty && (performance.now() - imgT > 60 || !P.play)) img();
      /* Bahn */
      if (P.mi < dmi) { dmi = 0; dR = ''; dF = ''; }
      while (dmi < Math.min(P.mi, M.length)) { const m = M[dmi]; if (m.kind === 'rapid') dR += pd(m.pts); else dF += pd(m.pts); dmi++; }
      let pr = '', pf = ''; if (P.mi < M.length && P.d > 0) { const m = M[P.mi], seg = pd(C.subPath(m, 0, P.d)); if (m.kind === 'rapid') pr = seg; else pf = seg; }
      els.rap.setAttribute('d', dR + pr); els.fed.setAttribute('d', dF + pf);
      /* Werkzeug */
      const q = hv(p), x = L.X(q[0]), y = L.Y(q[1]); let t = '';
      if (tn) t = `<polygon class="sg-tool" points="${x},${y} ${x + 26},${y - 9} ${x + 26},${y - 30} ${x + 9},${y - 16}"/><circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`;
      else { const tm0 = M[Math.min(P.mi, M.length - 1)], r = tm0 ? toolR(tm0.tool) : toolR(stt && stt.tool); t = `<circle class="sg-tool" cx="${x}" cy="${y}" r="${Math.max(3, r * L.sc)}"/><path d="M${x - 5},${y} h10 M${x},${y - 5} v10" stroke="#fff" stroke-width="1.5"/>`; els.gz.setAttribute('y1', L.gy(Math.max(-run.setup.stock.depth - 3, Math.min(12, p[2])))); els.gz.setAttribute('y2', L.gy(Math.max(-run.setup.stock.depth - 3, Math.min(12, p[2])))); els.gzt.textContent = 'Z ' + nf(Math.round(p[2] * 100) / 100); }
      els.tool.innerHTML = t;
      /* Zeile */
      const li = step ? step.line : -1; if (li !== exLine) { exLine = li; paintHl(); } if (li >= 0 && (scroll || P.play)) { const top = li * LH, vis = ta.clientHeight; if (top < ta.scrollTop || top > ta.scrollTop + vis - 2 * LH) { ta.scrollTop = Math.max(0, top - vis / 2); syncScroll(); } }
      /* Anzeigen */
      const g = stt ? stt.g : { motion: null, dist: 90, plane: tn ? 18 : 17, fm: tn ? 95 : 94, comp: 40, wcs: 54 };
      const fmu = g.fm === 95 ? 'mm/U' : 'mm/min', sp = stt ? (stt.spindle === 'cw' ? 'M3 rechts' : stt.spindle === 'ccw' ? 'M4 links' : 'M5 steht') : 'M5 steht';
      const box = (l, v, c) => `<div class="bx ${c || ''}">${l}<b>${v}</b></div>`;
      rd.innerHTML = (tn ? box('X (Ø)', f3(p[0]), 'pos') + box('Radius', f3(p[0] / 2)) + box('Z', f3(p[2]), 'pos') : box('X', f3(p[0]), 'pos') + box('Y', f3(p[1]), 'pos') + box('Z', f3(p[2]), 'pos')) +
        box('Vorschub F', stt && stt.f != null ? nf(stt.f) + ' ' + fmu : '–') + box('Drehzahl S', stt && stt.s != null ? nf(stt.s) + ' 1/min' : '–') + box('Werkzeug', stt && stt.tool != null ? 'T' + stt.tool : '–') + box('Spindel', sp) + box('Kühlmittel', stt && stt.coolant ? 'M8 ein' : 'aus') + box('Zustand', gcodes(g));
      if (step) {
        const info = step.codes.filter(c => C.CODES[c]).slice(0, 4).map(c => `<b>${c}</b> ${esc(C.CODES[c][0])}: ${esc(C.CODES[c][1])}`).join('<br>');
        stp.innerHTML = `<b>Satz ${step.n != null ? 'N' + step.n : 'Zeile ' + (step.line + 1)}:</b> <code>${esc(step.text)}</code>${info ? '<br>' + info : ''}`;
      } else stp.innerHTML = 'Tippe auf <b>Start</b> für den Programmlauf oder auf <b>Satz ▶|</b> für den Einzelsatz-Betrieb: Das Programm läuft Satz für Satz, die aktuelle Zeile ist im Editor markiert.';
      let tdone = P.mi < M.length ? cumT[P.mi] + (M[P.mi].kind === 'feed' ? M[P.mi].t * (P.d / (M[P.mi].len || 1)) : 0) : cumT[M.length] || 0;
      tm.innerHTML = `<b>Hauptzeit</b> bisher ${esc(C.fmtDe(tdone, 2))} min von ${esc(C.fmtTime(run.time.main))} · Eilgang (Nebenzeit, grob) ${esc(C.fmtDe(run.time.rapid * 60, 1))} s · Bahnlänge Arbeitsgang ${esc(C.fmtDe(run.time.feedLen, 1))} mm`;
    }
    function update() {
      const src = ta.value; wb.run = C.run(src, wb.setup); if (cfg.onChange) cfg.onChange(src);
      stepOf = []; wb.run.steps.forEach((s, k) => { for (let i = s.m0; i < s.m1; i++) stepOf[i] = k; });
      cumT = [0]; wb.run.moves.forEach((m, i) => { cumT[i + 1] = cumT[i] + (m.kind === 'feed' ? m.t : 0); });
      resetPlay(); paintGutter(); paintMsgs(); layout(); paintHl();
      const e = wb.run.errors[0]; alarm.hidden = !e; if (e) alarm.innerHTML = `<b>ALARM Zeile ${e.line}${e.kind === 'syntax' ? ' (Satzfehler)' : ''}:</b> ${esc(e.msg)}<br><span style="color:var(--mute)">Die Simulation läuft bis zu dieser Stelle.</span>`;
      syncScroll(); frame();
    }
    let deb; ta.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(update, 220); });
    $('.wsw', el).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; el.dataset.v = b.dataset.v; $$('.wsw button', el).forEach(x => x.classList.toggle('on', x === b)); });
    $('.ctl', el).addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return; const c = b.dataset.c;
      if (c === 'play') { play(!P.play); if (P.play && el.classList.contains('two')) { el.dataset.v = 'sim'; $$('.wsw button', el).forEach(x => x.classList.toggle('on', x.dataset.v === 'sim')); } }
      else if (c === 'reset') { P.play = false; seek(0, 0, -1); frame(true); play(false); }
      else if (c === 'end') { P.play = false; seek(moves().length, 0); frame(true); play(false); }
      else if (c === 'step') { if (el.classList.contains('two')) { el.dataset.v = 'sim'; $$('.wsw button', el).forEach(x => x.classList.toggle('on', x.dataset.v === 'sim')); } stepFwd(); }
      else if (c === 'back') { stepBack(); play(false); }
      else if (c === 'ref') { wb.showRef = !wb.showRef; b.classList.toggle('on', wb.showRef); b.setAttribute('aria-pressed', wb.showRef); layout(); frame(); }
    });
    spd.addEventListener('input', () => { S.speed = +spd.value; lsSet('speed', S.speed); $('.spdn', el).textContent = SPEEDN[S.speed - 1]; });

    wb.getSrc = () => ta.value;
    wb.setSrc = s => { ta.value = s; ta.scrollTop = 0; update(); };
    wb.setSetup = su => { wb.setup = su; keys(); update(); };
    wb.setTarget = r => { wb.ref = r; };
    wb.focusLine = focusLine;
    keys(); update();
    return wb;
  }

  /* ============================================================ Reiter Programm */
  function renderProg() {
    const V = $('#progView'), turn = S.mach === 'turn', sk = S.stk;
    const tools = m => Object.entries(C.SETUPS[m].tools).map(([k, t]) => `T${k} ${esc(t.name)}`).join(' · ');
    V.innerHTML = `<div class="fbar"><div class="seg" id="mseg" role="group"><button data-m="turn" class="${turn ? 'on' : ''}" aria-pressed="${turn}">⚙ Drehen</button><button data-m="mill" class="${turn ? '' : 'on'}" aria-pressed="${!turn}">🔧 Fräsen</button></div>
      <label class="f" style="flex:1;min-width:190px;margin:0"><select id="exSel" aria-label="Beispielprogramm laden"><option value="">Beispielprogramm laden …</option>${D.examples.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}</select></label><button class="chip" id="exClr">Leeren</button></div>
      <p class="hint2" id="exNote" style="margin:0 0 8px"></p>
      <details class="card" style="padding:0 12px;margin-bottom:10px"><summary style="min-height:46px;display:flex;align-items:center;font-weight:600;cursor:pointer">Rohteil und Werkzeuge</summary><div style="padding:0 0 12px">
        <div class="flds" id="stkF">${turn ? `<label class="f"><span>Rohteil-Ø (mm)</span><input data-s="d" inputmode="decimal" value="${nf(sk.turn.d)}"></label><label class="f"><span>Rohteil-Länge (mm)</span><input data-s="l" inputmode="decimal" value="${nf(sk.turn.l)}"></label>` : `<label class="f"><span>Länge X (mm)</span><input data-s="w" inputmode="decimal" value="${nf(sk.mill.w)}"></label><label class="f"><span>Breite Y (mm)</span><input data-s="h" inputmode="decimal" value="${nf(sk.mill.h)}"></label><label class="f"><span>Höhe/Tiefe Z (mm)</span><input data-s="d" inputmode="decimal" value="${nf(sk.mill.d)}"></label>`}</div>
        <p class="hint2">${turn ? 'Werkstücknullpunkt auf der Planfläche (Z0), das Rohteil ragt 2 mm als Planaufmaß über Z0 hinaus. X ist der Durchmesser.' : 'Werkstücknullpunkt: linke vordere Ecke, Z0 auf der Oberseite des Rohteils.'}</p>
        <p class="hint2"><b>Werkzeuge:</b> ${tools(S.mach)}</p></div></details><div id="pgWb"></div>`;
    S.pw = Workbench($('#pgWb'), { setup: setupOf(S.mach), src: S.src, onChange: s => { S.src = s; lsSet('src', s); } });
  }
  function loadExample(id) {
    const e = D.examples.find(x => x.id === id); if (!e) return;
    S.mach = e.machine; S.stk[e.machine] = Object.assign({}, DEF[e.machine]); lsSet('stk', S.stk); lsSet('mach', S.mach); S.src = e.src; lsSet('src', e.src); renderProg(); $('#exNote').textContent = e.note; $('#exSel').value = id; toast('Beispiel geladen: ' + e.title);
  }
  $('#progView').addEventListener('click', e => {
    const m = e.target.closest('#mseg [data-m]'); if (m) {
      const to = m.dataset.m; if (to === S.mach) return; const cur = S.pw.getSrc().trim(), ex = D.examples.find(x => x.src.trim() === cur);
      S.mach = to; lsSet('mach', to); if (!cur || ex) { const n = D.examples.find(x => x.machine === to); S.src = n.src; lsSet('src', n.src); } renderProg(); return;
    }
    if (e.target.closest('#exClr')) { S.pw.setSrc(''); S.pw.focusLine(1); }
  });
  $('#progView').addEventListener('change', e => {
    if (e.target.id === 'exSel') { if (e.target.value) loadExample(e.target.value); return; }
    const s = e.target.dataset && e.target.dataset.s; if (!s) return;
    const k = S.mach, lim = { d: k === 'turn' ? [10, 100] : [5, 60], l: [20, 200], w: [20, 200], h: [20, 200] }[s], v = clamp(C.parseDe(e.target.value), lim[0], lim[1], S.stk[k][s]);
    S.stk[k][s] = v; e.target.value = nf(v); lsSet('stk', S.stk); S.pw.setSetup(setupOf(k));
  });

  /* ============================================================ Aufgaben */
  const done = () => lsGet('done', {});
  const exam = () => lsGet('exam', '0') === '1';
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return st >= 3 ? 0 : 100 - 25 * st; }   /* Stufe 3 verrät die Lösung: 0 % */
  function markSolved(id, pct) {
    const p = lsGet('prog', {}); if ((p[id] || 0) < pct) p[id] = pct; lsSet('prog', p);
    if (pct > 0) { const d = done(); d[id] = true; lsSet('done', d); }
    updateBadge(); updatePal();
  }
  const nDone = () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)).length;
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + TASKS.length; }
  const curTask = () => S.task && TASKS.find(t => t.id === S.task);
  function checkTask(t) {
    const a = S.tAns[t.id] || {}; let ans;
    if (t.ask.type === 'choice') ans = a.c == null ? -1 : a.c; else if (t.ask.type === 'num') ans = t.ask.fields.map((f, i) => (a.v || [])[i] || ''); else ans = S.wb ? S.wb.getSrc() : (a.src != null ? a.src : t.prog);
    const r = D.check(t, ans); if (r.empty) { toast(r.msg); return; }
    const pct = r.ok ? pctFor(t.id) : 0, ex = exam();
    S.tRes = { id: t.id, ok: r.ok, pct, lines: r.lines, sol: r.sol };
    if (r.ok) { markSolved(t.id, pct); if (pct === 0) toast('Mit angezeigter Lösung zählt die Aufgabe im Prüfmodus nicht.'); else { const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (e) { } else ding(); toast(ex && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintTask(t) {
    const h = lsGet('hints', {}), n = Math.min(3, (h[t.id] || 0) + 1), ex = exam();
    h[t.id] = Math.max(h[t.id] || 0, n); lsSet('hints', h);
    if (ex) { const c = lsGet('ctipps', {}); c[t.id] = Math.max(c[t.id] || 0, n); lsSet('ctipps', c); }
    const sol = t.ask.type === 'prog' ? '<div class="mono">' + esc(t.ref) + '</div>' : '<b>' + esc(D.check(t, t.ask.type === 'choice' ? t.ask.correct : t.solve(C).values.map(String)).sol) + '</b>';
    sheet('Tipp, Stufe ' + n + ' von 3', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(t.tips[0])}</p>`;
      if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(t.tips[1])}</p>`;
      if (n >= 3) x += `<p><b>Stufe 3:</b> Die Lösung lautet ${t.ask.type === 'prog' ? ':' : ''} ${sol}</p>`; else x += '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für die nächste Stufe.</p>';
      x += ex ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte. Mit Stufe 3 zählt die Aufgabe nicht mehr.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
      b.innerHTML = x;
    });
  }
  function mountTaskWb(t, r) {
    const host = $('#tkWb'); S.wb = null; if (!host) return;
    const a = S.tAns[t.id] = S.tAns[t.id] || {}, edit = t.progMode === 'edit', src = a.src != null ? a.src : t.prog;
    S.wb = Workbench(host, { setup: t.setup, src, compact: true, readonly: !edit, sim: edit || !!r, target: edit && t.target ? C.run(t.ref, t.setup) : null, onChange: s => { a.src = s; } });
  }
  function renderTasks(top) {
    const V = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(); let h = '';
    if (t) {
      const r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div><p style="margin:8px 0">${esc(t.text)}</p>`;
      if (t.fig) h += `<div class="inst">${svgFig(t.fig)}</div>${figList(t.fig)}`;
      if (t.prog != null && t.progMode !== 'none') h += `<div id="tkWb" style="margin:8px 0"></div>${t.progMode === 'show' && !r ? '<p class="hint2">Die Simulation gibt es nach der Abgabe. Lies das Programm genau.</p>' : ''}`;
      if (t.ask.type === 'choice') h += `<div class="opts" id="tkOpts">${t.ask.choices.map((c, i) => `<button data-tc="${i}" ${r && r.ok ? 'disabled' : ''} class="${r && r.ok && i === t.ask.correct ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
      else if (t.ask.type === 'num') h += `<div class="flds">${t.ask.fields.map((f, i) => `<label class="f"><span>${esc(f.label)} (${esc(f.unit)})</span><div class="qin"><input data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc((a.v || [])[i] || '')}" ${r && r.ok ? 'disabled' : ''}><span class="u">${esc(f.unit)}</span></div></label>`).join('')}</div>`;
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) {
        h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
        if (r.ok || !exam()) {
          h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? 'Lösung' : 'So geht es'}:</b> ${esc(t.expl)}</div>`;
          h += t.ask.type === 'prog' ? `<details><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer">Lösungsprogramm anzeigen</summary><div class="mono">${esc(t.ref)}</div></details>` : `<div class="rdout"><b>Ergebnis:</b> ${esc(r.sol)}</div>`;
        } else h += '<div class="rdout bad">🎓 Prüfmodus: Die Erklärung gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>';
        if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${nDone()} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    V.innerHTML = h; if (t) mountTaskWb(t, S.tRes && S.tRes.id === t.id ? S.tRes : null); if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  $('#taskView').addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.i != null) { const a = S.tAns[t.id] = S.tAns[t.id] || {}; (a.v = a.v || [])[+e.target.dataset.i] = e.target.value; } });
  $('#taskView').addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.i != null) { e.preventDefault(); checkTask(t); } });
  $('#taskView').addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; if (S.tRes && !S.tRes.ok) S.tRes = null; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintTask(t); else if (a === 'close') { S.task = null; S.tRes = null; S.wb = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });
  function startTask(id) {
    S.task = id; S.tAns = {}; S.tRes = null;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }

  /* ============================================================ Trainer */
  const KINDS = [['coord', 'Koordinaten absolut'], ['inc', 'Kettenmaß G91'], ['pos', 'Position lesen'], ['zeit', 'Hauptzeit']];
  function newItem() {
    const T = S.tr; let it = null;
    for (let i = 0; i < 6 && !it; i++) it = D.gen(C.rng((R0 || String(Math.random()) + Date.now()) + '#' + (seedN++)), T.kind, T.mach, T.level);
    T.item = it; T.res = null; T.ans = []; T.sim = false; renderTrainer();
  }
  function renderTrainer() {
    const T = S.tr, V = $('#trView'); if (!T.item) { newItem(); return; }
    const it = T.item, st = S.rt, segH = (data, items, cur) => `<div class="seg" role="group">${items.map(([k, l]) => `<button data-${data}="${k}" class="${String(cur) === String(k) ? 'on' : ''}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
    let h = `<div class="card pl"><h4>Trainer: unendlich viele Aufgaben</h4><div class="fbar">${segH('rkind', KINDS, T.kind)}</div><div class="fbar">${segH('rmach', [['turn', '⚙ Drehen'], ['mill', '🔧 Fräsen']], T.mach)}${segH('rlevel', [[1, 'leicht'], [2, 'mittel'], [3, 'schwer']], T.level)}</div>
      <div class="stats"><div class="bx"><b>${st.streak}</b>Serie</div><div class="bx"><b>${st.best}</b>Beste Serie</div><div class="bx"><b>${st.ok}/${st.n}</b>Richtig</div></div>`;
    h += `<p style="margin:6px 0"><b>${esc(it.text)}</b></p>`;
    if (it.fig) h += `<div class="inst">${svgFig(it.fig)}</div>${figList(it.fig)}`;
    if (it.src) h += '<div id="trWb" style="margin:8px 0"></div>';
    h += `<div class="flds">${it.fields.map((f, i) => `<label class="f"><span>${esc(f.label)} (${esc(f.unit)})</span><div class="qin"><input data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc(T.ans[i] || '')}" ${T.res ? 'disabled' : ''}><span class="u">${esc(f.unit)}</span></div></label>`).join('')}</div>`;
    h += T.res ? `<div class="btns"><button class="btn pri" data-r="next">Nächste Aufgabe</button></div>` : `<div class="btns"><button class="btn pri" data-r="chk">✓ Prüfen</button><button class="btn" data-r="show">Lösung zeigen</button></div>`;
    if (T.res) {
      const r = T.res; h += `<div class="fb"><b style="color:var(--${r.ok ? 'ok' : 'danger'})">${r.shown ? 'Lösung: ' + esc(r.sol) + ' (zählt als Fehler, Serie beginnt neu)' : r.ok ? '✓ Richtig! Serie: ' + st.streak : '✗ Nicht ganz. Richtig ist: ' + esc(r.sol) + '. Serie beginnt neu.'}</b></div>`;
      if (r.lines && !r.ok && !r.shown) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul>`;
      h += `<div class="rdout ${r.ok ? 'ok' : 'bad'}">${esc(it.expl)}</div>`;
      if (it.src && !T.sim) h += '<div class="btns"><button class="btn" data-r="sim">▶ Probelauf ansehen</button></div>';
    }
    V.innerHTML = h + '</div>';
    if (it.src) Workbench($('#trWb'), { setup: { machine: T.mach }, src: it.src, compact: true, readonly: true, sim: T.sim });
  }
  function trainerResult(r, shown) {
    const T = S.tr, st = S.rt; st.n++; if (r.ok && !shown) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0; lsSet('rt', { n: st.n, ok: st.ok, streak: st.streak, best: st.best });
    T.res = Object.assign({}, r, { shown }); if (shown) T.res.sol = D.checkItem(T.item, T.item.values.map(String)).sol; if (r.ok && !shown) ding(); else sad(); renderTrainer(); updatePal();
    if (r.ok && !shown && st.streak > 0 && st.streak % 5 === 0) { toast('🔥 ' + st.streak + ' richtige in Folge!'); const F = fx(); if (F && F.pass) try { F.pass(100); } catch (e) { } }
  }
  function trainerCheck() { const T = S.tr, r = D.checkItem(T.item, T.item.fields.map((f, i) => T.ans[i] || '')); if (r.empty) toast(r.msg); else trainerResult(r, false); }
  $('#trView').addEventListener('input', e => { if (e.target.dataset.i != null) S.tr.ans[+e.target.dataset.i] = e.target.value; });
  $('#trView').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.i != null) { e.preventDefault(); if (S.tr.res) newItem(); else trainerCheck(); } });
  $('#trView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const T = S.tr, save = () => lsSet('tr', { kind: T.kind, mach: T.mach, level: T.level });
    if (b.dataset.rkind) { T.kind = b.dataset.rkind; save(); newItem(); }
    else if (b.dataset.rmach) { T.mach = b.dataset.rmach; save(); newItem(); }
    else if (b.dataset.rlevel) { T.level = +b.dataset.rlevel; save(); newItem(); }
    else if (b.dataset.r === 'chk') trainerCheck();
    else if (b.dataset.r === 'show') trainerResult({ ok: false }, true);
    else if (b.dataset.r === 'next') newItem();
    else if (b.dataset.r === 'sim') { T.sim = true; renderTrainer(); }
  });

  /* ============================================================ Hilfe */
  function svgAxes(kind) {
    if (kind === 'turn') return `<svg viewBox="0 0 440 170" role="img" aria-label="Drehen: Achsen X und Z"><rect class="sg-bg" width="440" height="170"/><rect x="70" y="60" width="250" height="50" class="sg-poly"/><line class="sg-axis" x1="30" y1="110" x2="400" y2="110"/><line x1="320" y1="30" x2="320" y2="122" stroke="#ff9f1c" stroke-width="1.5"/><text x="326" y="40" class="sg-lab" style="fill:#ff9f1c">Nullpunkt Z0 (Planfläche)</text><rect x="20" y="52" width="48" height="66" class="sg-chuck"/><text x="24" y="86" class="sg-dim">Futter</text><polygon class="sg-tool" points="322,56 352,46 352,24 332,38"/><path class="sg-arrow" d="M70,150 H150 m-8,-4 l8,4 l-8,4"/><text x="158" y="154" class="sg-lab">+Z (vom Futter weg)</text><path class="sg-arrow" d="M410,110 V40 m-4,8 l4,-8 l4,8"/><text x="372" y="34" class="sg-lab">+X (Ø)</text><text x="140" y="92" class="sg-dim">Durchmesser Ø = 2 · Radius</text></svg>`;
    return `<svg viewBox="0 0 440 190" role="img" aria-label="Fräsen: Achsen X, Y und Z"><rect class="sg-bg" width="440" height="190"/><rect x="70" y="30" width="250" height="120" class="sg-stock"/><circle cx="70" cy="150" r="6" fill="none" stroke="#ff9f1c" stroke-width="2"/><path class="sg-arrow" style="stroke:#ff9f1c" d="M70,150 h60 m-8,-4 l8,4 l-8,4 M70,150 v-60 m-4,8 l4,-8 l4,8"/><text x="134" y="154" class="sg-lab" style="fill:#ff9f1c">+X</text><text x="76" y="86" class="sg-lab" style="fill:#ff9f1c">+Y</text><text x="78" y="168" class="sg-dim">Nullpunkt X0 Y0 (Ecke)</text><circle cx="360" cy="90" r="20" fill="none" stroke="var(--fg)" stroke-width="1.6"/><circle cx="360" cy="90" r="2.5" fill="var(--fg)"/><text x="334" y="132" class="sg-dim">+Z zeigt auf dich zu</text><text x="334" y="146" class="sg-dim">(aus dem Material)</text><text x="150" y="95" class="sg-dim">Draufsicht, Z0 = Oberseite</text></svg>`;
  }
  function svgArc() {
    return `<svg viewBox="0 0 440 210" role="img" aria-label="Kreisbogen mit I und J"><rect class="sg-bg" width="440" height="210"/><circle cx="170" cy="85" r="60" fill="none" stroke="var(--line)" stroke-dasharray="3 4"/><path d="M170,145 A60,60 0 0 0 230,85" fill="none" stroke="#3b9eff" stroke-width="3"/><circle cx="170" cy="85" r="4" fill="#ff9f1c"/><circle cx="170" cy="145" r="4" class="sg-pt"/><circle cx="230" cy="85" r="4" class="sg-pt"/><line x1="170" y1="145" x2="170" y2="85" stroke="#ff9f1c" stroke-dasharray="4 3"/><line x1="170" y1="85" x2="230" y2="85" stroke="var(--mute)" stroke-dasharray="4 3"/><text x="176" y="118" class="sg-lab" style="fill:#ff9f1c">J10</text><text x="150" y="168" class="sg-lab">Start</text><text x="236" y="82" class="sg-lab">Ende</text><text x="176" y="78" class="sg-dim">Mittelpunkt</text><text x="258" y="60" class="sg-lab">G3 X30 Y30 I0 J10</text><text x="258" y="80" class="sg-dim">I = Abstand in X, J = in Y</text><text x="258" y="98" class="sg-dim">vom START zum Mittelpunkt</text><text x="258" y="120" class="sg-dim">G3 = gegen den Uhrzeigersinn</text></svg>`;
  }
  /* PRUEFEN (Hilfe, Abschnitt Kreise): I beim Drehen als Radiuswert; Drehrichtung G2/G3 beim Drehen für Werkzeug hinter der Drehmitte (Ansicht Z rechts, X oben) */
  function renderHelp() {
    $('#helpView').innerHTML = `
    <details open><summary>🧭 Koordinaten: Drehen und Fräsen</summary><div class="hb2">
      <p><b>Drehen:</b> Die Werkstückachse ist die Spindelachse. <b>Z</b> läuft längs (vom Futter weg ist +Z, im Werkstück ist Z negativ), <b>X</b> läuft quer. X wird in diesem Lab als <b>Durchmesser</b> programmiert. Eine Änderung von X um 10 mm ändert den Radius nur um 5 mm.</p>
      <div class="inst">${svgAxes('turn')}</div>
      <p><b>Fräsen:</b> X nach rechts, Y nach hinten, Z nach oben aus dem Material heraus. Der Nullpunkt liegt meist an einer Ecke oder in der Mitte der Rohteiloberseite. Z0 ist die Oberseite, im Material ist Z negativ.</p>
      <div class="inst">${svgAxes('mill')}</div>
      <p><b>Absolut (G90):</b> Der Wert ist die Position im Werkstückkoordinatensystem. <b>Kettenmaß/inkremental (G91):</b> Der Wert ist der Weg vom aktuellen Punkt. Beim Drehen ist X dann die Änderung des Durchmessers.</p>
      <p><b>Nullpunkt G54:</b> Nullpunktverschiebung. Sie legt fest, wo der Werkstücknullpunkt in der Maschine liegt. Danach beziehen sich alle Koordinaten auf das Werkstück.</p></div></details>
    <details><summary>🔤 G-Codes (Wegbedingungen)</summary><div class="hb2"><table><tr><th>Code</th><th>Bedeutung</th></tr>
      ${['G0', 'G1', 'G2', 'G3', 'G17', 'G18', 'G19', 'G40', 'G41', 'G42', 'G54', 'G80', 'G81', 'G90', 'G91', 'G94', 'G95', 'G97', 'G98', 'G99'].map(c => `<tr><td>${c}</td><td><b>${esc(C.CODES[c][0])}</b>: ${esc(C.CODES[c][1])}</td></tr>`).join('')}</table>
      <p>G-Befehle sind meistens <b>modal</b>: Sie gelten, bis ein anderer aus derselben Gruppe sie ablöst. Zwei Befehle derselben Gruppe im selben Satz (zum Beispiel G0 und G1) sind ein Fehler.</p>
      <p>Grundstellung in diesem Lab: G90, G54, G40, G97. Fräsen G17 und G94, Drehen G18 und G95. Vor dem ersten Verfahrsatz muss G0 oder G1 stehen.</p></div></details>
    <details><summary>🔌 M-Codes und Adressen</summary><div class="hb2"><table><tr><th>Code</th><th>Bedeutung</th></tr>
      ${['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'M9', 'M30'].map(c => `<tr><td>${c}</td><td><b>${esc(C.CODES[c][0])}</b>: ${esc(C.CODES[c][1])}</td></tr>`).join('')}</table>
      <table><tr><th>Adresse</th><th>Bedeutung</th></tr><tr><td>N</td><td>Satznummer (am Satzanfang, aufsteigend, zum Beispiel N10, N20)</td></tr><tr><td>X Y Z</td><td>Zielkoordinaten. Beim Drehen ist X der Durchmesser.</td></tr><tr><td>U W</td><td>Nur Drehen: inkrementales X (Durchmesseränderung) und Z, unabhängig von G90/G91</td></tr><tr><td>I J K</td><td>Kreismittelpunkt als Abstand vom Startpunkt in X, Y, Z</td></tr><tr><td>R</td><td>Kreisradius (oder Rückzugsebene beim Bohrzyklus G81)</td></tr><tr><td>F</td><td>Vorschub: mm/min (G94) oder mm/Umdrehung (G95)</td></tr><tr><td>S</td><td>Drehzahl in 1/min</td></tr><tr><td>T</td><td>Werkzeugnummer. Beim Fräsen wechselt M6, beim Drehen wirkt T sofort.</td></tr><tr><td>( ... )</td><td>Kommentar in Klammern (auch ; bis zum Zeilenende)</td></tr></table></div></details>
    <details><summary>⭕ Kreise: I, J, K und R</summary><div class="hb2">
      <div class="inst">${svgArc()}</div>
      <p><b>Mittelpunkt mit I/J/K:</b> Die Werte sind immer die Abstände vom <b>Startpunkt</b> des Bogens zum Mittelpunkt, mit Vorzeichen (nicht vom Nullpunkt). I gehört zu X, J zu Y, K zu Z. In G17 (Fräsen) gelten I und J, in G18 (Drehen) I und K. Start- und Endradius müssen gleich sein, sonst meldet die Steuerung einen Fehler.</p>
      <p><b>Beim Drehen</b> ist I ein Radiuswert (Abstand in X als Radius), auch wenn X als Durchmesser programmiert wird.</p>
      <p><b>Mit Radius R:</b> Positives R wählt den kleinen Bogen (höchstens 180°), negatives R den großen Bogen. Einen Vollkreis (Start gleich Ende) gibt es nur mit I/J/K.</p>
      <p><b>Richtung:</b> G2 im Uhrzeigersinn, G3 gegen den Uhrzeigersinn. Beim Fräsen von oben auf die XY-Ebene gesehen. Beim Drehen in der Ansicht mit Z nach rechts und X nach oben (Werkzeug hinter der Drehmitte).</p></div></details>
    <details><summary>⚙ Drehen oder Fräsen?</summary><div class="hb2"><table><tr><th></th><th>Drehen</th><th>Fräsen</th></tr><tr><td>Werkstück</td><td>dreht sich</td><td>steht fest</td></tr><tr><td>Werkzeug</td><td>steht, fährt in X und Z</td><td>dreht sich, fährt in X, Y, Z</td></tr><tr><td>X-Wert</td><td>Durchmesser</td><td>Position</td></tr><tr><td>Ebene</td><td>G18 (Z-X)</td><td>G17 (X-Y)</td></tr><tr><td>Vorschub</td><td>meist G95 (mm/U)</td><td>meist G94 (mm/min)</td></tr><tr><td>Beispiel</td><td>Wellen, Bolzen, Buchsen</td><td>Taschen, Nuten, Bohrbilder</td></tr></table></div></details>
    <details><summary>📐 Werkzeugradiuskorrektur G40, G41, G42</summary><div class="hb2">
      <p>Ohne Korrektur fährt die <b>Werkzeugmitte</b> auf der programmierten Bahn. Beim Fräsen müsstest du den Fräserradius selbst einrechnen. Mit <b>G41</b> (Werkzeug links der Kontur) oder <b>G42</b> (rechts) rechnet die Steuerung den Radius: Du programmierst die Kontur, die Steuerung versetzt die Werkzeugbahn. <b>G40</b> schaltet aus.</p>
      <p>Links und rechts gelten in Vorschubrichtung gesehen. Bei M3 ist G41 Gleichlauf. Die Korrektur wird mit einem Linearsatz (G1) eingeschaltet und ausgeschaltet, mit Anfahr- und Abfahrweg außerhalb der Kontur.</p>
      <p><b>In diesem Lab</b> werden G41/G42 nur erklärt: Die Simulation fährt die programmierte Bahn ohne Radiuskorrektur und zeigt dazu einen Hinweis. Beim Drehen gilt dasselbe für die Schneidenradiuskorrektur.</p></div></details>
    <details><summary>⚠ Typische Fehler</summary><div class="hb2">
      <p><b>1. Radius statt Durchmesser:</b> Beim Drehen steht in X der Durchmesser. Ø30 heißt X30, nicht X15.</p>
      <p><b>2. Modal vergessen:</b> G0 bleibt aktiv, bis G1 kommt. Ein Satz „Z-2 F100“ nach G0 fährt im Eilgang ins Material.</p>
      <p><b>3. G91 nicht abgewählt:</b> Nach dem Kettenmaß muss G90 stehen, sonst werden spätere Absolutwerte als Wege gelesen.</p>
      <p><b>4. Vorzeichen:</b> Im Material ist Z negativ. Beim Nullpunkt in der Mitte sind links und unten die Werte negativ.</p>
      <p><b>5. Kreis:</b> Falsche Richtung (G2/G3) oder I/J vom Nullpunkt statt vom Startpunkt gemessen. Der Endradius muss zum Startradius passen.</p>
      <p><b>6. Spindel:</b> Vor dem Zerspanen M3 mit Drehzahl S. Vor dem Werkzeug T bei Fräsmaschinen M6 nicht vergessen.</p>
      <p><b>7. Vorschub:</b> Fehlt F, meldet die Steuerung einen Fehler. Achte auf die Einheit: G94 mm/min, G95 mm/U.</p>
      <p><b>8. Komma:</b> Dezimalzahlen mit Punkt schreiben (X12.5), nicht mit Komma.</p></div></details>
    <details><summary>🛡 Sicherheit und Probelauf</summary><div class="hb2">
      <p>An der echten Maschine läuft ein neues Programm nie sofort im Automatikbetrieb:</p>
      <p><b>1. Simulation/Grafik</b> prüfen (so wie in diesem Lab). <b>2. Probelauf ohne Werkstück</b> mit Abstand in Z. <b>3. Einzelsatz</b> (jeder Satz einzeln mit Start), dabei Restweg beobachten. <b>4. Vorschub-Override</b> und <b>Eilgang-Override</b> auf niedrige Werte, die Hand am Not-Halt. <b>5. Erst dann</b> Automatik mit Werkstück.</p>
      <p>Kontrolliere Werkzeuglänge, Nullpunkt und Spannmittel. Eilgang nie im Material und nicht in die Nähe von Spannmitteln. Schutzeinrichtungen nie umgehen. Im Lab hilft der Einzelsatz-Betrieb (Satz ▶|) und das Tempo-Regler, genau das zu üben.</p></div></details>
    <details><summary>⏱ Hauptzeit rechnen</summary><div class="hb2">
      <p>Hauptzeit ist die Zeit des Zerspanens: <span class="eq">th = L / vf</span> mit dem Weg L in mm und der Vorschubgeschwindigkeit vf in mm/min.</p>
      <p>Beim Drehen mit Vorschub pro Umdrehung: <span class="eq">vf = f · n</span> (f in mm/U, n in 1/min).</p>
      <p>Der Weg zählt ab dem Punkt, an dem das Werkzeug beim Arbeitsgang steht, also einschließlich Anschnitt. Beim Plandrehen zählt der <b>Radiusweg</b> (halber Durchmesser). Bei Kreisbögen ist der Weg die Bogenlänge: Vollkreis 2·π·r, Viertelkreis π·r/2.</p>
      <p>Der Eilgang gehört zur Nebenzeit und wird hier nur grob mit 10 m/min geschätzt.</p></div></details>
    <details><summary>ℹ Grenzen dieser Simulation</summary><div class="hb2">
      <p>Das Lab ist herstellerneutral und vereinfacht. Es gibt keine Zyklen außer G81, keine Unterprogramme, keine Gewinde und keine Rechenparameter. Die Radiuskorrektur wird nicht berechnet. Das Rohteil wird als Zylinder (Drehen, Längsschnitt) oder Block mit Höhenfeld (Fräsen) dargestellt, der Fräser hat eine ebene Stirn und der Drehmeißel eine Spitze. Hinterschneidungen und genaue Schneidengeometrie sind nicht abgebildet.</p>
      <p>Echte Steuerungen unterscheiden sich in Details (Schreibweise von Zyklen, Bedeutung von I/J/K, Grundstellungen). Die Maschinenbeschreibung gilt vor dem Programmieren.</p></div></details>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'prog'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'bsp') renderBsp(); else if (t === 'tr') renderTrainer(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'CNC-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'CNC-Lab: ' + T[2];
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); palSig = ''; updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), n = nDone(), sig = [F, fxOn, exam(), n, S.rt.streak, S.rt.best].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button class="chip" data-a="rand" title="Zufällige Aufgabe im Trainer">🎲 Zufallsaufgabe</button>
      <span id="stat">Aufgaben gelöst <b>${n}/${TASKS.length}</b> · Serie <b>${S.rt.streak}</b> · Beste Serie <b>${S.rt.best}</b></span>`;
    $('#bExam').classList.toggle('on', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { setTab('tr'); newItem(); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('prog');
  $('#bMenu').onclick = () => {
    const rows = [['prog', 'Programm', 'Editor mit Schnelltasten und Simulation'], ['tr', 'Trainer', 'Koordinaten, Position lesen, Hauptzeit mit Serien-Zähler'], ['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['help', 'Hilfe und Spickzettel', 'G- und M-Codes, Koordinaten, Kreise, Sicherheit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Dein Programmtext bleibt erhalten. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* ============================================================ Beispiele (Reiter "Beispiele", Aufruf ?bsp) */
  const BSP = D.beispiele || [], BSP_INTRO = 'Die Beispielprogramme mit Erklärung. „Programm laden“ öffnet das Programm im Reiter „Programm“, dort kannst du es starten und Satz für Satz verfolgen.', BSP_BTN = 'Programm laden';
  function renderBsp() {
    const V = $('#bspView'); if (!V) return;
    V.innerHTML = '<div class="card pl"><h4>Beispiele</h4><p class="hint2" style="margin:0">' + BSP_INTRO + '</p></div>' +
      BSP.map((b, i) => '<div class="card pl"><h4>' + esc(b.titel) + '</h4><p style="margin:0 0 4px;line-height:1.45">' + esc(b.text) + '</p>' + '<p class="hint2" style="margin:0 0 4px">' + (b.machine === 'turn' ? 'Drehmaschine' : 'Fräsmaschine') + '</p>' + '<div class="btns"><button class="btn pri" data-bsp="' + i + '" style="min-height:44px">' + BSP_BTN + '</button></div></div>').join('');
    V.onclick = e => { const x = e.target.closest('[data-bsp]'); if (x && BSP[+x.dataset.bsp]) loadBsp(BSP[+x.dataset.bsp]); };
  }
  function loadBsp(b) { setTab('prog'); loadExample(b.ex); }

  /* Schnittstelle für Karriere/Lernpfad */
  root.CNC_LAB = { id: 'cnc', title: 'CNC-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.CNC_TASKS };

  if (S.src == null) S.src = (D.examples.find(x => x.machine === S.mach) || D.examples[0]).src;
  buildTabs(); updatePal(); renderProg(); setTab(S.tab);
  /* Aufruf ?aufgabe=cnc1 (Startseite, Lernhefte): Aufgabe gleich öffnen */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
  /* Aufruf ?bsp: gleich die Beispielauswahl zeigen */
  try { const qb = new URLSearchParams(location.search); if (qb.has('bsp') && !qb.get('aufgabe')) { if (BSP.length) { setTab('prog'); loadExample(BSP[0].ex); } setTab('bsp'); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
