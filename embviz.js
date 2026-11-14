/* embviz.js - Embedded vertieft: Zeichenroutinen (Canvas, keine Bibliothek). Alle Zahlen kommen aus EMB_CORE; hier wird nur gezeichnet.
 * window.EMB_VIZ = { cbox(opt), redrawAll(), clear(), pal(), draw: { timer, isr, bounce, adc, uart, spi, i2c, fsm, ram, heap, gantt, cross, debounce } }
 * cbox({h, minW, aria}) -> { wrap, cv, draw:(g,W,H,P)=>..., render() }. Zeichnet in CSS-Pixeln (Schrift 14 px), bei Bedarf breiter als der Platz (waagerecht scrollbar). */
(function (root) {
  'use strict';
  const K = () => root.EMB_CORE, sg = (x, n) => K().sig(x, n || 4);
  const FONT = '14px -apple-system,system-ui,"Segoe UI",Roboto,sans-serif', MONO = '14px ui-monospace,Menlo,Consolas,monospace';
  let REDRAW = [];
  function pal() {
    const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
    return { fg: g('--fg'), mute: g('--mute'), accent: g('--accent'), ok: g('--ok'), warn: g('--warn'), bad: g('--danger'), line: g('--line'), cv: g('--cv'), grid: g('--grid'), well: g('--well'), panel: g('--panel2'), c1: g('--c1'), c2: g('--c2'), c3: g('--c3'), c4: g('--c4') };
  }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function cbox(opt) {
    const wrap = el('div', 'cwrap'), cv = el('canvas'); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', opt.aria || 'Diagramm'); wrap.appendChild(cv);
    const o = {
      wrap, cv, draw: null,
      render() {
        if (!wrap.isConnected) return;
        const avail = Math.max(240, Math.floor(wrap.clientWidth || 300)), need = typeof opt.minW === 'function' ? opt.minW(avail) : (opt.minW || 0), W = Math.max(avail, Math.ceil(need));
        const H = typeof opt.h === 'function' ? Math.ceil(opt.h(W)) : opt.h, dpr = Math.min(3, window.devicePixelRatio || 1);
        wrap.setAttribute('data-wide', W > avail + 1 ? '1' : ''); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.font = FONT; g.textBaseline = 'alphabetic';
        if (o.draw) { try { o.draw(g, W, H, pal()); } catch (e) { g.fillStyle = '#f66'; g.fillText('Zeichenfehler: ' + e.message, 8, 20); } }
      }
    };
    REDRAW.push(o); return o;
  }
  const redrawAll = () => REDRAW.forEach(o => o.render());
  const clear = () => { REDRAW = []; };
  /* ---------- Zeichenhilfen ---------- */
  function T(g, s, x, y, col, al, font) { g.font = font || FONT; g.fillStyle = col; g.textAlign = al || 'left'; g.fillText(s, x, y); }
  function ln(g, x1, y1, x2, y2, col, w, dash) { g.beginPath(); g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w || 1; g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]); }
  function digital(g, a, x0, px, yHi, yLo, col, lw) {
    g.beginPath(); g.strokeStyle = col; g.lineWidth = lw || 2; g.setLineDash([]);
    a.forEach((v, i) => { const x = x0 + i * px, y = v ? yHi : yLo; if (i === 0) g.moveTo(x, y); else { g.lineTo(x, a[i - 1] ? yHi : yLo); g.lineTo(x, y); } if (i === a.length - 1) g.lineTo(x + px, y); });
    g.stroke();
  }
  function fmtT(s) { const a = Math.abs(s); if (a >= 1) return sg(s) + ' s'; if (a >= 1e-3) return sg(s * 1e3) + ' ms'; if (a >= 1e-6) return sg(s * 1e6) + ' µs'; return sg(s * 1e9) + ' ns'; }
  function niceStep(range, maxTicks) { const raw = range / maxTicks, m = Math.pow(10, Math.floor(Math.log10(raw))); for (const f of [1, 2, 2.5, 5, 10]) if (f * m >= raw) return f * m; return 10 * m; }
  function axisT(g, P, x0, x1, y, t0, t1, unitDiv, unitName, maxTicks) {   // Zeitachse in ganzzahligen Einheiten
    ln(g, x0, y, x1, y, P.mute, 1); const st = niceStep(t1 - t0, maxTicks || 8);
    for (let t = Math.ceil(t0 / st) * st; t <= t1 + 1e-9; t += st) { const x = x0 + (t - t0) / (t1 - t0) * (x1 - x0); ln(g, x, y, x, y + 5, P.mute, 1); T(g, sg(t / unitDiv, 5), x, y + 19, P.mute, 'center'); }
    T(g, unitName, x1, y + 36, P.mute, 'right');
  }
  const D = {};

  /* ---------- Timer / PWM ---------- */
  D.timer = function (g, W, H, P, s) {
    const L = 10, R = W - 10, w = R - L, top = s.top, ocr = Math.min(s.ocr, top), mode = s.mode;
    const Tt = mode === 'phase' ? 2 * top : mode === 'ctc' ? ocr + 1 : top + 1, np = 2.5, total = Tt * np, X = t => L + t / total * w;
    const y0 = 38, y1 = 128, Y = v => y1 - (v / Math.max(1, top)) * (y1 - y0);
    T(g, 'Zähler', L, 18, P.fg, 'left'); T(g, '0', L, y1 + 16, P.mute, 'left'); T(g, 'TOP = ' + (mode === 'ctc' ? ocr : top), R, 18, P.mute, 'right');
    ln(g, L, y1, R, y1, P.line, 1); ln(g, L, y0, R, y0, P.line, 1, [4, 4]);
    for (let p = 1; p <= Math.floor(np); p++) ln(g, X(p * Tt), y0 - 4, X(p * Tt), 232, P.grid, 1, [3, 4]);
    g.beginPath(); g.strokeStyle = P.c1; g.lineWidth = 2; g.setLineDash([]);
    if (mode === 'phase') { g.moveTo(X(0), Y(0)); for (let p = 0; p * Tt < total; p++) { g.lineTo(X(Math.min(total, p * Tt + top)), Y(Math.min(top, total - p * Tt))); if (p * Tt + top < total) g.lineTo(X(Math.min(total, (p + 1) * Tt)), Y(Math.max(0, top - (total - p * Tt - top)))); } }
    else { for (let p = 0; p * Tt < total; p++) { const a = p * Tt, b = Math.min(total, a + Tt), v1 = Math.min(1, (b - a) / Tt) * (Tt - 1) / Math.max(1, Tt - 1) * (mode === 'ctc' ? ocr : top); g.moveTo(X(a), Y(0)); g.lineTo(X(b), Y(v1)); if (b < total) g.lineTo(X(b), Y(0)); } }
    g.stroke();
    if (mode !== 'ovf' && mode !== 'ctc') { ln(g, L, Y(ocr), R, Y(ocr), P.warn, 1.5, [6, 4]); T(g, 'OCR = ' + ocr, R, Y(ocr) - 5, P.warn, 'right'); }
    const yh = 168, yl = 212;
    if (mode === 'ovf' || mode === 'ctc') {
      T(g, mode === 'ovf' ? 'Überlauf-Interrupt' : 'Vergleichs-Interrupt (CTC)', L, 160, P.fg, 'left');
      for (let p = 1; p <= Math.floor(np); p++) { const x = X(p * Tt); ln(g, x, yh + 6, x, yl, P.c2, 3); g.beginPath(); g.fillStyle = P.c2; g.moveTo(x - 6, yh + 14); g.lineTo(x + 6, yh + 14); g.lineTo(x, yh + 4); g.fill(); }
    } else {
      T(g, 'Ausgang', L, 160, P.fg, 'left'); g.beginPath(); g.strokeStyle = P.c3; g.lineWidth = 2.5; let first = true, lv = 0;
      const hi = []; for (let p = 0; p * Tt < total; p++) { const a = p * Tt; if (mode === 'fast') hi.push([a, a + ocr + 1]); else { hi.push([a, a + ocr]); hi.push([a + Tt - ocr, a + Tt]); } }
      const segs = hi.map(([a, b]) => [Math.max(0, a), Math.min(total, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]); const merged = [];
      segs.forEach(sg2 => { const l = merged[merged.length - 1]; if (l && sg2[0] <= l[1] + 1e-9) l[1] = Math.max(l[1], sg2[1]); else merged.push(sg2.slice()); });
      let cx = 0; g.moveTo(X(0), yl); lv = 0;
      merged.forEach(([a, b]) => { g.lineTo(X(a), yl); g.lineTo(X(a), yh); g.lineTo(X(b), yh); g.lineTo(X(b), yl); cx = b; });
      g.lineTo(X(total), yl); g.stroke(); void first; void lv; void cx;
    }
    T(g, 'Ausschnitt: 2,5 Perioden = ' + fmtT(s.periodSec * np), L, H - 6, P.mute, 'left');
  };

  /* ---------- ISR-Zeitachse ---------- */
  D.isr = function (g, W, H, P, o) {
    const L = 84, R = W - 12, w = R - L, tEnd = o.tEnd, X = t => L + t / tEnd * w, res = o.sim, lanes = { ev: 24, pend: 62, isr: 100, main: 138 }, lh = 26;
    [['Ereignis', 'ev'], ['Merker', 'pend'], ['ISR', 'isr'], ['main', 'main']].forEach(([n, k]) => { T(g, n, 8, lanes[k] + 19, P.mute, 'left'); ln(g, L, lanes[k] + lh + 2, R, lanes[k] + lh + 2, P.grid, 1); });
    (o.masks || []).forEach(m => { g.fillStyle = P.bad; g.globalAlpha = 0.14; g.fillRect(X(m[0]), 14, X(m[1]) - X(m[0]), 150); g.globalAlpha = 1; T(g, 'cli', X(m[0]) + 3, 12, P.bad, 'left'); });
    g.fillStyle = P.grid; g.fillRect(L, lanes.main + 3, w, lh - 6);
    const lostSet = new Set(res ? res.lost : []);
    o.events.forEach((te, i) => { const x = X(te), lost = lostSet.has(i); ln(g, x, lanes.ev + 2, x, lanes.ev + lh, lost ? P.bad : P.accent, 3); if (lost) { T(g, '✕', x, lanes.ev - 1, P.bad, 'center'); } });
    if (res) {
      res.calls.forEach(c => {
        g.fillStyle = P.warn; g.globalAlpha = 0.55; g.fillRect(X(c.te), lanes.pend + 5, Math.max(1, X(c.start) - X(c.te)), lh - 8); g.globalAlpha = 1;
        g.fillStyle = P.c2; g.fillRect(X(c.start), lanes.isr + 3, Math.max(2, X(Math.min(c.end, tEnd)) - X(c.start)), lh - 6);
        g.fillStyle = P.cv; g.fillRect(X(c.start), lanes.main + 3, Math.max(2, X(Math.min(c.end, tEnd)) - X(c.start)), lh - 6);
        if (X(c.end) - X(c.start) > 28) T(g, 'ISR', (X(c.start) + X(Math.min(c.end, tEnd))) / 2, lanes.isr + 19, '#10151a', 'center');
      });
    }
    axisT(g, P, L, R, 176, 0, tEnd, 1, 'Zeit in µs', 8);
  };

  /* ---------- Prellen ---------- */
  D.bounce = function (g, W, H, P, o) {
    const L = 84, R = W - 12, w = R - L, e = o.edges, tEnd = Math.max(1000, Math.ceil((e[e.length - 1].t * 1.25 + 300) / 100) * 100), X = t => L + t / tEnd * w, yh = 30, yl = 68;
    T(g, 'Pin', 8, 54, P.mute, 'left'); T(g, 'ISR', 8, 126, P.mute, 'left');
    g.beginPath(); g.strokeStyle = P.c1; g.lineWidth = 2.5; g.moveTo(L, yh); let lv = 1;
    e.forEach(ed => { g.lineTo(X(ed.t), lv ? yh : yl); lv = ed.lvl; g.lineTo(X(ed.t), lv ? yh : yl); }); g.lineTo(R, lv ? yh : yl); g.stroke();
    const mode = o.mode || 'fall'; let last = -Infinity; const lock = o.lock || 0;
    e.forEach(ed => {
      const match = mode === 'change' || (mode === 'fall' && ed.lvl === 0) || (mode === 'rise' && ed.lvl === 1); if (!match) return;
      const acc = ed.t - last >= lock; const x = X(ed.t);
      if (acc) { if (lock > 0) { g.fillStyle = P.warn; g.globalAlpha = 0.18; g.fillRect(x, 96, Math.min(R, X(ed.t + lock)) - x, 40); g.globalAlpha = 1; } ln(g, x, 100, x, 136, P.ok, 4); last = ed.t; }
      else if (o.result) { ln(g, x - 4, 108, x + 4, 128, P.mute, 2); ln(g, x + 4, 108, x - 4, 128, P.mute, 2); }
      else ln(g, x, 100, x, 136, P.ok, 3);
    });
    axisT(g, P, L, R, 156, 0, tEnd, 1, 'Zeit in µs', 8);
  };

  /* ---------- ADC ---------- */
  D.adc = function (g, W, H, P, o) {
    const C = K(), L = 52, R = W - 12, tp = 14, bt = H - 44, Tw = 12 / o.fs, X = t => L + t / Tw * (R - L), Y = v => bt - v / o.vref * (bt - tp), lsb = C.adcLsb(o.vref, o.bits);
    ln(g, L, bt, R, bt, P.mute, 1); ln(g, L, tp, L, bt, P.mute, 1);
    T(g, '0', L - 6, bt + 5, P.mute, 'right'); T(g, sg(o.vref, 3) + ' V', L - 6, tp + 5, P.mute, 'right');
    if (o.bits <= 5) for (let c = 1; c < Math.pow(2, o.bits); c++) ln(g, L, Y(c * lsb), R, Y(c * lsb), P.grid, 1);
    const sig = t => o.vref * (0.5 + 0.45 * Math.cos(2 * Math.PI * o.fin * t));
    g.beginPath(); g.strokeStyle = P.c1; g.lineWidth = 1.5; for (let px = 0; px <= R - L; px += 1) { const t = px / (R - L) * Tw, y = Y(sig(t)); if (px === 0) g.moveTo(L + px, y); else g.lineTo(L + px, y); } g.stroke();
    const fa = C.aliasFreq(o.fin, o.fs);
    if (o.fin > o.fs / 2) { g.beginPath(); g.strokeStyle = P.warn; g.lineWidth = 2; g.setLineDash([7, 5]); for (let px = 0; px <= R - L; px += 1) { const t = px / (R - L) * Tw, y = Y(o.vref * (0.5 + 0.45 * Math.cos(2 * Math.PI * fa * t))); if (px === 0) g.moveTo(L + px, y); else g.lineTo(L + px, y); } g.stroke(); g.setLineDash([]); }
    for (let n = 0; n < 12; n++) {
      const ts = n / o.fs, v = sig(ts), code = C.adcCode(v, o.vref, o.bits), vq = (code + 0.5) * lsb, x0 = X(ts), x1 = X(ts + 1 / o.fs);
      ln(g, x0, Y(vq), x1, Y(vq), P.c3, 2.5); ln(g, x1, Y(vq), x1, Y((C.adcCode(sig((n + 1) / o.fs), o.vref, o.bits) + 0.5) * lsb), P.c3, 1, [2, 3]);
      g.beginPath(); g.fillStyle = P.fg; g.arc(x0, Y(v), 3.5, 0, 7); g.fill();
    }
    axisT(g, P, L, R, bt, 0, Tw, 1e-3, 'Zeit in ms', 6);
  };

  /* ---------- UART ---------- */
  D.uart = function (g, W, H, P, o) {
    const nb = o.bits.length, idle = 1, spb = 8, L = 12, R = W - 12, pxb = (R - L) / (nb + 2 * idle), x0 = L + idle * pxb, yh = 78, yl = 118;
    const names = ['S']; for (let i = 0; i < o.cfg.data; i++) names.push('D' + i); if (o.cfg.parity !== 'N') names.push('P'); for (let i = 0; i < o.cfg.stop; i++) names.push('St');
    for (let k = 0; k <= nb; k++) ln(g, x0 + k * pxb, 34, x0 + k * pxb, 134, P.grid, 1, [3, 4]);
    names.forEach((n, k) => { const flip = o.flips && o.flips.indexOf(k) >= 0; if (flip && o.mark) { g.fillStyle = P.bad; g.globalAlpha = 0.18; g.fillRect(x0 + k * pxb, 34, pxb, 100); g.globalAlpha = 1; } T(g, n, x0 + (k + 0.5) * pxb, 28, flip && o.mark ? P.bad : P.mute, 'center'); T(g, String(o.bits[k]), x0 + (k + 0.5) * pxb, 152, P.fg, 'center', MONO); });
    const w = K().uartWave([o.bits], spb, idle); digital(g, w, L, (R - L) / w.length, yh, yl, P.c1, 2.5);
    if (o.decode) o.decode.forEach(f => { for (let k = 0; k < nb; k++) { const x = L + (f.start + (k + 0.5) * spb) / w.length * (R - L); g.beginPath(); g.fillStyle = P.warn; g.arc(x, (f.bits[k] ? yh : yl), 3.5, 0, 7); g.fill(); } });
    T(g, 'Ruhe', L, yh - 4, P.mute, 'left');
  };

  /* ---------- SPI ---------- */
  D.spi = function (g, W, H, P, o) {
    const w = o.wave, L = 54, R = W - 10, px = (R - L) / w.total, lanes = [['CS', w.cs, P.c4], ['SCK', w.sck, P.c1], ['MOSI', w.mosi, P.c3], ['MISO', w.miso, P.c2]], lh = 52;
    lanes.forEach(([n, a, col], i) => { const y = 14 + i * lh; T(g, n, 6, y + 30, P.mute, 'left'); digital(g, a, L, px, y + 12, y + 40, col, 2.5); });
    if (o.sample) o.sample.edges.forEach((e, k) => {
      const x = L + e * px; ln(g, x, 6, x, 14 + 4 * lh - 8, P.warn, 1.5, [4, 4]);
      [2, 3].forEach(li => { const a = li === 2 ? w.mosi : w.miso, y = 14 + li * lh + (a[e - 1] ? 12 : 40); g.beginPath(); g.fillStyle = P.warn; g.arc(x, y, 3.5, 0, 7); g.fill(); });
      T(g, String(k + 1), x, 12, P.warn, 'center');
    });
  };

  /* ---------- I2C ---------- */
  D.i2c = function (g, W, H, P, o) {
    const w = o.wave, L = 46, R = W - 10, px = (R - L) / w.n, yS = 56, yD = 112;
    T(g, 'SCL', 6, yS + 28, P.mute, 'left'); T(g, 'SDA', 6, yD + 28, P.mute, 'left');
    for (let i = 1; i < w.n; i++) if (w.scl[i - 1] === 0 && w.scl[i] === 1) ln(g, L + i * px, 40, L + i * px, 150, P.grid, 1, [2, 4]);
    digital(g, w.scl, L, px, yS + 12, yS + 40, P.c1, 2.5); digital(g, w.sda, L, px, yD + 12, yD + 40, P.c3, 2.5);
    if (o.items) {
      const items = o.items, m = w.marks; let curByte = -1, a = 0, b = 0;
      const flush = () => { if (curByte < 0) return; const kind = items[a].role, x0 = L + m[a][0] * px, x1 = L + m[b][1] * px; ln(g, x0 + 2, 30, x1 - 2, 30, P.warn, 2); ln(g, x0 + 2, 30, x0 + 2, 36, P.warn, 2); ln(g, x1 - 2, 30, x1 - 2, 36, P.warn, 2);
        if (o.annotate) { const val = o.annotate.bytes[curByte]; if (val) T(g, val, (x0 + x1) / 2, 22, P.fg, 'center'); } void kind; };
      items.forEach((it, i) => { if (it.k === 'bit') { if (it.byte !== curByte) { flush(); curByte = it.byte; a = i; } b = i; } else if (it.k === 'start') T(g, 'S', L + (m[i][0] + 1) * px, 22, P.warn, 'center'); else if (it.k === 'stop') T(g, 'P', L + (m[i][0] + 1.5) * px, 22, P.warn, 'center'); });
      flush();
      items.forEach((it, i) => { if (it.k === 'bit' && it.pos === 8) { const x = L + (m[i][0] + 2) * px; T(g, it.v ? 'N' : 'A', x, 168, it.v ? P.bad : P.ok, 'center', MONO); } });
    }
  };

  /* ---------- Zustandsdiagramm ---------- */
  D.fsm = function (g, W, H, P, o) {
    const f = o.fsm, n = f.states.length, cx = W / 2, cy = H / 2, r = Math.max(22, Math.min(26, (Math.min(W, H) - 40) / 5.2)), rad = Math.max(30, Math.min(W / 2 - r - 44, H / 2 - r - 54));
    const pos = {}; f.states.forEach((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; pos[s] = n === 1 ? [cx, cy] : [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
    const edges = {}; f.states.forEach(s => f.inputs.forEach(x => { const t = f.next[s] && f.next[s][x]; if (t === undefined || !pos[t]) return; const k = s + '>' + t; (edges[k] = edges[k] || { from: s, to: t, lab: [] }).lab.push(f.type === 'mealy' ? x + '/' + f.out[s][x] : x); }));
    const lab = Object.keys(edges).map(k => edges[k]);
    const arrow = (x, y, ang, col) => { g.beginPath(); g.fillStyle = col; g.moveTo(x, y); g.lineTo(x - 10 * Math.cos(ang - 0.4), y - 10 * Math.sin(ang - 0.4)); g.lineTo(x - 10 * Math.cos(ang + 0.4), y - 10 * Math.sin(ang + 0.4)); g.closePath(); g.fill(); };
    const labels = [];
    lab.forEach(e => {
      const hot = o.last && o.last.from === e.from && o.last.to === e.to, col = hot ? P.warn : P.mute, lw = hot ? 3 : 1.5, [x1, y1] = pos[e.from], [x2, y2] = pos[e.to], txt = e.lab.join(', ');
      if (e.from === e.to) {
        const dx = x1 - cx, dy = y1 - cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, lx = x1 + ux * (r + 14), ly = y1 + uy * (r + 14); if (n === 1) { }
        g.beginPath(); g.strokeStyle = col; g.lineWidth = lw; g.arc(lx, ly, 14, 0, 7); g.stroke(); labels.push([txt, x1 + ux * (r + 40), y1 + uy * (r + 40) + 5, col]);
      } else {
        const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d, cvx = (x1 + x2) / 2 + nx * 0.22 * d, cvy = (y1 + y2) / 2 + ny * 0.22 * d;
        const a1 = Math.atan2(cvy - y1, cvx - x1), a2 = Math.atan2(y2 - cvy, x2 - cvx), sx = x1 + r * Math.cos(a1), sy = y1 + r * Math.sin(a1), ex = x2 - r * Math.cos(a2), ey = y2 - r * Math.sin(a2);
        g.beginPath(); g.strokeStyle = col; g.lineWidth = lw; g.moveTo(sx, sy); g.quadraticCurveTo(cvx, cvy, ex, ey); g.stroke(); arrow(ex, ey, a2, col);
        labels.push([txt, 0.25 * sx + 0.5 * cvx + 0.25 * ex, 0.25 * sy + 0.5 * cvy + 0.25 * ey + 5, col]);
      }
    });
    f.states.forEach(s => {
      const [x, y] = pos[s], cur = o.cur === s; g.beginPath(); g.fillStyle = cur ? P.accent : P.panel; g.strokeStyle = cur ? P.accent : P.fg; g.lineWidth = 2; g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      if (f.init === s) { ln(g, x - r - 16, y, x - r, y, P.fg, 2); arrow(x - r, y, 0, P.fg); }
      T(g, o.short ? o.short(s) : s, x, y + 5, cur ? '#fff' : P.fg, 'center', FONT);
      if (f.type === 'moore' && f.out[s] !== undefined && o.showOut !== false) T(g, '/' + f.out[s], x, y + r + 16, P.mute, 'center');
    });
    labels.forEach(([t, x, y, col]) => { g.font = FONT; const tw = g.measureText(t).width; g.fillStyle = P.cv; g.globalAlpha = 0.85; g.fillRect(x - tw / 2 - 2, y - 14, tw + 4, 19); g.globalAlpha = 1; T(g, t, x, y, col === P.mute ? P.fg : col, 'center'); });
  };

  /* ---------- RAM / Heap ---------- */
  D.ram = function (g, W, H, P, o) {
    const L = 10, R = W - 10, w = R - L, X = b => L + b / o.ram * w, y = 30, hh = 44, seg = [['.data', o.data, P.c1], ['.bss', o.bss, P.c4], ['Heap', o.heap, P.c2]];
    let at = 0; ln(g, L, y + hh + 2, R, y + hh + 2, P.line, 1);
    seg.forEach(([n, v, col]) => { if (v <= 0) return; g.fillStyle = col; g.fillRect(X(at), y, Math.max(1, X(at + v) - X(at)), hh); if (X(at + v) - X(at) > 52) T(g, n, (X(at) + X(at + v)) / 2, y + 27, '#10151a', 'center'); at += v; });
    const st = o.stack || 0, free = o.ram - at - st;
    if (st > 0) { g.fillStyle = P.c3; g.fillRect(X(Math.max(at, o.ram - st)), y, X(o.ram) - X(Math.max(at, o.ram - st)), hh); if (X(o.ram) - X(o.ram - st) > 52) T(g, 'Stack', (X(o.ram) + X(o.ram - st)) / 2, y + 27, '#10151a', 'center'); }
    if (free > 0) { g.fillStyle = P.grid; g.fillRect(X(at), y, X(at + free) - X(at), hh); if (X(at + free) - X(at) > 52) T(g, 'frei', (X(at) + X(at + free)) / 2, y + 27, P.mute, 'center'); }
    g.strokeStyle = P.fg; g.lineWidth = 1; g.strokeRect(L, y, w, hh);
    T(g, '0', L, y - 8, P.mute, 'left'); T(g, o.ram + ' Byte', R, y - 8, P.mute, 'right');
    if (free < 0) { T(g, 'Heap und Stack überlappen: ' + (-free) + ' Byte zu viel', L, y + hh + 28, P.bad, 'left'); g.fillStyle = P.bad; g.globalAlpha = 0.4; g.fillRect(X(o.ram - st), y, X(at) - X(o.ram - st), hh); g.globalAlpha = 1; }
    else T(g, 'frei zwischen Heap und Stack: ' + free + ' Byte', L, y + hh + 28, P.fg, 'left');
  };
  D.heap = function (g, W, H, P, o) {
    const L = 10, R = W - 10, w = R - L, X = b => L + b / o.size * w, y = 30, hh = 44, cols = [P.c1, P.c2, P.c3, P.c4, P.warn];
    const ids = Object.keys(o.allocs); g.fillStyle = P.grid; g.fillRect(L, y, w, hh);
    ids.forEach((id, i) => { const a = o.allocs[id]; g.fillStyle = cols[i % cols.length]; g.fillRect(X(a.s), y, X(a.s + a.n) - X(a.s), hh); g.strokeStyle = P.cv; g.lineWidth = 2; g.strokeRect(X(a.s), y, X(a.s + a.n) - X(a.s), hh); T(g, id + ' (' + a.n + ')', (X(a.s) + X(a.s + a.n)) / 2, y + 27, '#10151a', 'center'); });
    (o.free || []).forEach(b => { if (X(b.s + b.n) - X(b.s) > 50) T(g, 'frei ' + b.n, (X(b.s) + X(b.s + b.n)) / 2, y + 27, P.mute, 'center'); });
    g.strokeStyle = P.fg; g.lineWidth = 1; g.strokeRect(L, y, w, hh); T(g, '0', L, y - 8, P.mute, 'left'); T(g, o.size + ' Byte Heap', R, y - 8, P.mute, 'right');
  };

  /* ---------- Gantt (Prioritaetsinversion) ---------- */
  D.gantt = function (g, W, H, P, o) {
    const L = 40, R = W - 12, len = o.len, ux = (R - L) / len, names = o.names, lh = 34, y0 = 26, X = t => L + t * ux, col = { H: P.bad, M: P.c2, L: P.c1 };
    if (o.title) T(g, o.title, L, 14, P.fg, 'left');
    names.forEach((nm, i) => { const y = y0 + i * lh; T(g, nm, 8, y + 22, P.fg, 'left'); ln(g, L, y + lh - 2, R, y + lh - 2, P.grid, 1); });
    const step = ux >= 26 ? 1 : 2; for (let t = 0; t <= len; t += step) { ln(g, X(t), y0, X(t), y0 + names.length * lh, P.grid, 1, [2, 4]); T(g, String(t), X(t), y0 + names.length * lh + 17, P.mute, 'center'); }
    (o.arrive || []).forEach(a => { const i = names.indexOf(a.name), y = y0 + i * lh; g.beginPath(); g.fillStyle = P.fg; g.moveTo(X(a.t), y + 4); g.lineTo(X(a.t) - 5, y + 14); g.lineTo(X(a.t) + 5, y + 14); g.fill(); });
    if (o.sim) {
      o.sim.trace.forEach(tk => {
        names.forEach((nm, i) => { const y = y0 + i * lh; if (tk.run === nm) { g.fillStyle = col[nm] || P.c1; g.fillRect(X(tk.t) + 1, y + 6, ux - 2, lh - 14); if (tk.owner === nm) { g.fillStyle = '#10151a'; g.globalAlpha = 0.5; g.fillRect(X(tk.t) + 1, y + lh - 14, ux - 2, 5); g.globalAlpha = 1; } }
          else if (tk.waiting.indexOf(nm) >= 0) { g.strokeStyle = col[nm] || P.warn; g.lineWidth = 1.5; g.strokeRect(X(tk.t) + 2, y + 8, ux - 4, lh - 18); ln(g, X(tk.t) + 2, y + lh - 10, X(tk.t) + ux - 2, y + 8, col[nm] || P.warn, 1); } });
      });
      const d = o.sim.done.H; if (d != null) { ln(g, X(d), y0, X(d), y0 + names.length * lh, P.bad, 2, [5, 3]); T(g, 'H fertig: t = ' + d, Math.min(X(d) + 6, R - 130), y0 + names.length * lh + 36, P.bad, 'left'); }
    }
  };

  /* ---------- Kreuzung / Entprellen ---------- */
  D.cross = function (g, W, H, P, o) {
    const L = 70, R = W - 12, tot = K().cycleTime(o.phases), X = t => L + t / tot * (R - L), cm = { G: P.ok, Y: P.warn, R: P.bad };
    [['Nord-Süd', 'ns', 20], ['Ost-West', 'ew', 70]].forEach(([n, k, y]) => { T(g, n, 6, y + 24, P.mute, 'left'); let t = 0; o.phases.forEach((p, i) => { g.fillStyle = cm[p[k]]; g.fillRect(X(t), y, Math.max(1, X(t + p.dur) - X(t) - 1), 34); if (X(t + p.dur) - X(t) > 22) T(g, String(i + 1), (X(t) + X(t + p.dur)) / 2, y + 23, '#10151a', 'center'); t += p.dur; }); });
    T(g, 'Phasennummer in den Balken; Rot, Gelb, Grün nach Farbe. Zyklus ' + tot + ' s', L, 128, P.mute, 'left');
    axisT(g, P, L, R, 104, 0, tot, 1, 'Zeit in s', 10);
  };
  D.debounce = function (g, W, H, P, o) {
    const raw = o.raw.split('').map(Number), n = raw.length, L = 66, R = W - 10, px = (R - L) / n;
    T(g, 'roh', 8, 52, P.mute, 'left'); digital(g, raw, L, px, 28, 64, P.c1, 2.5);
    if (o.out) { T(g, 'Ausgang', 4, 112, P.mute, 'left'); digital(g, o.out, L, px, 88, 124, P.c3, 2.5); }
    for (let i = 0; i < n; i++) { T(g, String(i), L + (i + 0.5) * px, o.out ? 152 : 92, P.mute, 'center'); ln(g, L + i * px, 22, L + i * px, o.out ? 130 : 70, P.grid, 1, [2, 4]); }
    T(g, 'Probe Nr.', R, o.out ? 170 : 110, P.mute, 'right');
  };

  root.EMB_VIZ = { cbox, redrawAll, clear, pal, draw: D, fmtT, FONT };
})(typeof window !== 'undefined' ? window : globalThis);
