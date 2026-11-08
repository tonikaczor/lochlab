'use strict';
/* Tonfunk Regelungstechnik-Lab: Kurven zum Ablesen (Aufgaben rg31 bis rg47, regtasks3.js).
   Zeichnet das Diagramm einer Aufgabe als SVG (ohne DOM, reine Zeichenkette), damit die Oberfläche (regui.js) es unter dem Aufgabentext zeigen kann.
   Schnittstelle: window.REG_UI_LESEN = { figureHtml(task), panelSvg(panel, opt) }.
   task.figure() liefert { caption?, panels: [panel] } mit
     panel = { title?, tMax, yLabel?, yMin?, yMax?, clip?: { lo, hi }, band?: [lo, hi], vline?: { t, label }, series: [{ name?, kind: 'x'|'w'|'y'|'e', pts: [[t, v], ...] }] }.
   Alle Zahlen im Diagramm kommen aus der Simulation der Aufgabe (regtasks3.js, REG_TASKS.kurve), hier wird nur gezeichnet.
   Farben über die CSS-Variablen der Seite (--accent, --ok, --warn, --mute, --line), mit festen Ersatzwerten. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const fnum = (v, d) => { if (!fin(v)) return '–'; let s = (+v).toFixed(d == null ? 1 : d); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); if (s === '-0') s = '0'; return s.replace('.', ','); };
  const niceStep = (r, n) => { const raw = Math.max(r, 1e-9) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const STYLE = {
    x: 'fill:none;stroke:var(--accent,#3b9eff);stroke-width:2.6',
    w: 'fill:none;stroke:var(--warn,#ffb340);stroke-width:1.8;stroke-dasharray:6 4',
    y: 'fill:none;stroke:var(--ok,#4cd964);stroke-width:2.6',
    e: 'fill:none;stroke:var(--warn,#ffb340);stroke-width:1.8;stroke-dasharray:6 4'
  };
  const LEG = { x: 'var(--accent,#3b9eff)', w: 'var(--warn,#ffb340)', y: 'var(--ok,#4cd964)', e: 'var(--warn,#ffb340)' };
  let uid = 0;
  function panelSvg(p, opt) {
    opt = opt || {};
    if (!p || !Array.isArray(p.series) || !fin(p.tMax) || !(p.tMax > 0)) return '';
    const W = 640, H = opt.h || 250, L = 46, Rr = 14, Tp = 14, B = 36, pw = W - L - Rr, ph = H - Tp - B, tMax = p.tMax;
    let lo = 0, hi = 0;
    p.series.forEach(s => (s.pts || []).forEach(q => { if (fin(q[1])) { if (q[1] < lo) lo = q[1]; if (q[1] > hi) hi = q[1]; } }));
    if (p.band) { lo = Math.min(lo, p.band[0]); hi = Math.max(hi, p.band[1]); }
    if (p.clip) { if (fin(p.clip.hi)) hi = Math.min(hi, p.clip.hi); if (fin(p.clip.lo)) lo = Math.max(lo, p.clip.lo); }
    if (fin(p.yMax)) hi = p.yMax; if (fin(p.yMin)) lo = p.yMin;
    if (hi - lo < 1e-9) hi = lo + 1;
    const st = niceStep(hi - lo, 5), yMax = Math.ceil(hi / st - 1e-9) * st, yMin = Math.floor(lo / st + 1e-9) * st, span = yMax - yMin;
    const sx = t => L + t / tMax * pw, sy = v => Tp + ph - (v - yMin) / span * ph, f1 = v => v.toFixed(1), id = 'rl' + (++uid);
    let g = '';
    for (let v = yMin; v <= yMax + st / 2; v += st) g += `<line x1="${L}" x2="${W - Rr}" y1="${f1(sy(v))}" y2="${f1(sy(v))}" style="stroke:var(--line,#38424d);stroke-width:1"/><text x="${L - 5}" y="${f1(sy(v) + 4)}" text-anchor="end" style="fill:var(--mute,#8d99a6);font-size:11px">${esc(fnum(v, 2))}</text>`;
    const xs = niceStep(tMax, 6);
    for (let t = 0; t <= tMax + 1e-9; t += xs) g += `<line x1="${f1(sx(t))}" x2="${f1(sx(t))}" y1="${Tp}" y2="${Tp + ph}" style="stroke:var(--line,#38424d);stroke-width:1"/><text x="${f1(sx(t))}" y="${Tp + ph + 15}" text-anchor="middle" style="fill:var(--mute,#8d99a6);font-size:11px">${esc(fnum(t, 1))}</text>`;
    g += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" style="stroke:var(--mute,#8d99a6);stroke-width:1.4"/>`;
    if (yMin <= 0 && yMax >= 0) g += `<line x1="${L}" x2="${W - Rr}" y1="${f1(sy(0))}" y2="${f1(sy(0))}" style="stroke:var(--mute,#8d99a6);stroke-width:1.4"/>`;
    g += `<text x="${W - Rr}" y="${Tp + ph + 29}" text-anchor="end" style="fill:var(--mute,#8d99a6);font-size:11px">t in s</text><text x="${L + 4}" y="${Tp + 10}" style="fill:var(--mute,#8d99a6);font-size:11px">${esc(p.yLabel || '')}</text>`;
    let body = '';
    if (p.band) body += `<rect x="${L}" width="${pw}" y="${f1(sy(p.band[1]))}" height="${f1(Math.max(1, sy(p.band[0]) - sy(p.band[1])))}" style="fill:var(--mute,#8d99a6);opacity:.28"/>`;
    if (p.vline && fin(p.vline.t)) body += `<line x1="${f1(sx(p.vline.t))}" x2="${f1(sx(p.vline.t))}" y1="${Tp}" y2="${Tp + ph}" style="stroke:var(--danger,#ff5c5c);stroke-width:1.4;stroke-dasharray:3 3"/><text x="${f1(sx(p.vline.t) + 4)}" y="${Tp + 22}" style="fill:var(--danger,#ff5c5c);font-size:11px">${esc(p.vline.label || '')}</text>`;
    const lim = v => Math.max(yMin - 2 * span, Math.min(yMax + 2 * span, v));
    p.series.forEach(s => {
      const pts = (s.pts || []).filter(q => fin(q[0]) && fin(q[1]));
      if (!pts.length) return;
      let d = ''; pts.forEach((q, i) => { d += (i ? 'L' : 'M') + f1(sx(q[0])) + ' ' + f1(sy(lim(q[1]))); });
      body += `<path d="${d}" style="${STYLE[s.kind] || STYLE.x};stroke-linejoin:round"/>`;
    });
    const leg = p.series.filter(s => s.name).map((s, i) => `<text x="${L + 8 + i * 170}" y="${H - 5}" style="fill:${LEG[s.kind] || LEG.x};font-size:11px">${esc(s.name)}</text>`).join('');
    const label = (p.title ? p.title + ': ' : '') + 'Diagramm ' + (p.yLabel || '') + ' über der Zeit';
    return `<div class="plot" style="margin:6px 0">${p.title ? `<div style="font-weight:700;font-size:13px;margin:0 0 2px">${esc(p.title)}</div>` : ''}<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;background:var(--panel2,#2c343e);border-radius:8px" role="img" aria-label="${esc(label)}"><clipPath id="${id}"><rect x="${L}" y="${Tp}" width="${pw}" height="${ph}"/></clipPath>${g}<g clip-path="url(#${id})">${body}</g>${leg}</svg></div>`;
  }
  /* Diagramme einer Aufgabe: task.figure() -> { caption?, panels } ; fehlt figure oder schlägt es fehl, kommt eine leere Zeichenkette */
  function figureHtml(task) {
    try {
      if (!task || typeof task.figure !== 'function') return '';
      const f = task.figure();
      if (!f || f.error || !Array.isArray(f.panels) || !f.panels.length) return '';
      const h = f.panels.length > 2 ? 190 : 250;
      return `<div class="fig lesen">${f.panels.map(p => panelSvg(p, { h })).join('')}${f.caption ? `<p class="hint2" style="margin:2px 0 6px">${esc(f.caption)}</p>` : ''}</div>`;
    } catch (e) { return ''; }
  }
  const API = { figureHtml, panelSvg, niceStep };
  root.REG_UI_LESEN = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
