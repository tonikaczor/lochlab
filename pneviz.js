'use strict';
/* Tonfunk Pneumatik-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei wird NACH pneui.js eingebunden.
   window.PNEVIZ = { kraft, luft, verlauf, tick }.
   kraft(v)   Zylinder im Längsschnitt: Druck auf Kolbenfläche bzw. Ringfläche, Kraftpfeile (Länge proportional zur Kraft). v = { p (bar), D, d (mm), r (Reibung in %) }
   luft(v)    Luftverbrauch: Hubvolumen und die (p+1)-fache Normluftmenge. v = { p, D, d, s (mm) }
   verlauf(h) Weg-Zeit- und Druck-Zeit-Diagramm der laufenden Simulation (Taster, Zylinderweg, Kammerdruck), Zeitachse = Simulationszeit
   tick(PL,S) wird aus der Animationsschleife von pneui.js aufgerufen: zeichnet das Diagramm unter den Schaltplan, nur im freien Ausprobieren,
              NIE in Aufgaben (S.task), damit keine Lösung vorweggenommen wird.
   Alle Funktionen liefern SVG-Text, nie NaN im Markup. Farben nur über CSS-Variablen der Seite. Keine Hover-Abhängigkeit, keine dekorative Animation. */
(function (root) {
  const C = root.PNE_CORE || (typeof require !== 'undefined' ? require('./pnecore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = x => typeof x === 'number' && isFinite(x);
  const q = x => (fin(x) ? Math.round(x * 10) / 10 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fm = (v, d) => (fin(v) ? C.calc.fmt(v, d) : '–');

  const CSS = '.pv{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0;text-anchor:start}'
    + '.pv text{font:600 11.5px system-ui,sans-serif;fill:var(--fg,#222);-webkit-user-select:none;user-select:none}'
    + '.pv .m{fill:var(--mute,#667);font-weight:500;font-size:10.5px}'
    + '.pv .t{fill:var(--mute,#667);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase}'
    + '.pv .ln{stroke:var(--fg,#222);stroke-width:1.3;fill:none}'
    + '.pv .gd{stroke:var(--line,#bbb);stroke-width:1;fill:none}'
    + '.pv .body{fill:var(--boxf,var(--panel2,#eee));stroke:var(--fg,#222);stroke-width:1.5}'
    + '.pv .air{fill:var(--air-f,rgba(58,160,255,.28));stroke:var(--air,#3aa0ff);stroke-width:1.4}'
    + '.pv .vent{fill:none;stroke:var(--nil,#889);stroke-width:1.2;stroke-dasharray:4 3}'
    + '.pv .pis{fill:var(--fg,#222)}'
    + '.pv .force{stroke:var(--warn,#c80);stroke-width:3;fill:none}'
    + '.pv .forcef{fill:var(--warn,#c80)}'
    + '.pv .tr-w{stroke:var(--accent,#37f);stroke-width:2;fill:none;stroke-linejoin:round}'
    + '.pv .tr-p{stroke:var(--air,#3aa0ff);stroke-width:2;fill:none;stroke-linejoin:round}'
    + '.pv .tr-t{stroke:var(--warn,#c80);stroke-width:2;fill:none;stroke-linejoin:round}'
    + '.pvbox{margin:10px 0 2px;padding-top:6px;border-top:1px solid var(--line,#ccc)}'
    + '.pvbox h5{margin:0 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute,#667);font-weight:600}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('pneviz-css')) {
    const st = document.createElement('style'); st.id = 'pneviz-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const svg = (h, aria, body) => `<svg class="pv" viewBox="0 0 360 ${q(h)}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
  const box = (title, inner) => (inner ? `<div class="pvbox"><h5>${esc(title)}</h5>${inner}</div>` : '');
  function arrow(x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 9, w = 5, bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx + w * Math.sin(a), by - w * Math.cos(a)], [bx - w * Math.sin(a), by + w * Math.cos(a)]].map(v => q(v[0]) + ',' + q(v[1])).join(' ');
    return `<line x1="${q(x1)}" y1="${q(y1)}" x2="${q(bx)}" y2="${q(by)}" class="force"/><polygon points="${p}" class="forcef"/>`;
  }

  /* ---------- Zylinder im Längsschnitt: Ausfahren (Kolbenfläche) und Einfahren (Ringfläche) ---------- */
  function cyl(y0, mode, o) {
    const hD = clamp(o.D * 0.9, 46, 80), hd = clamp(hD * (o.hasd ? o.d / o.D : 0.3), 6, hD * 0.42), cy = y0 + 18 + hD / 2, top = cy - hD / 2, x0 = 20, x1 = 190, xp = 105, out = mode === 'aus';
    let s = `<text x="20" y="${y0 + 8}" class="t">${out ? 'Ausfahren: Druck auf die Kolbenfläche A' : 'Einfahren: Druck auf die Ringfläche A_Ring'}</text>`;
    s += out
      ? `<rect x="${x0}" y="${q(top)}" width="${xp - x0}" height="${q(hD)}" class="air"/><rect x="${xp + 8}" y="${q(top)}" width="${x1 - xp - 8}" height="${q(hD)}" class="vent"/>`
      : `<rect x="${x0}" y="${q(top)}" width="${xp - x0}" height="${q(hD)}" class="vent"/><rect x="${xp + 8}" y="${q(top)}" width="${x1 - xp - 8}" height="${q(hD)}" class="air"/>`;
    s += `<rect x="${x0}" y="${q(top)}" width="${x1 - x0}" height="${q(hD)}" class="body" style="fill:none"/><rect x="${xp}" y="${q(top)}" width="8" height="${q(hD)}" class="pis"/>`;
    s += `<rect x="${xp + 8}" y="${q(cy - hd / 2)}" width="${x1 + 40 - xp - 8}" height="${q(hd)}" class="pis" style="fill:var(--mute,#889)"/>`;
    s += `<text x="${q((x0 + xp) / 2)}" y="${q(cy + 4)}" text-anchor="middle" class="m">${out ? fm(o.p, 1) + ' bar' : 'Abluft'}</text><text x="${q((xp + 8 + x1) / 2)}" y="${q(top + hD - 6)}" text-anchor="middle" class="m">${out ? 'Abluft' : fm(o.p, 1) + ' bar'}</text>`;
    const len = o.F > 0 ? clamp(o.F / o.Fmax * 96, 8, 96) : 8;
    if (out) {
      s += arrow(246, cy - 12, 246 + len, cy - 12) + `<text x="246" y="${q(cy + 4)}" class="m">F theoretisch</text><text x="246" y="${q(cy + 17)}">${fm(o.F, 0)} N</text>`;
      if (fin(o.Fn)) s += `<text x="246" y="${q(cy + 32)}" class="m">Nutzkraft (−${fm(o.r, 0)} %)</text><text x="246" y="${q(cy + 45)}">${fm(o.Fn, 0)} N</text>`;
    } else s += arrow(246 + 96, cy - 12, 246 + 96 - len, cy - 12) + `<text x="246" y="${q(cy + 4)}" class="m">F theoretisch</text><text x="246" y="${q(cy + 17)}">${fm(o.F, 0)} N</text>`;
    return { s, h: 18 + hD + 36 };
  }
  function kraft(v) {
    if (!v || !C || !fin(v.p) || !fin(v.D) || !(v.D > 0) || v.p < 0) return '';
    const hasd = fin(v.d) && v.d > 0 && v.d < v.D, F = C.calc.kraftAus(v.p, v.D), Fe = hasd ? C.calc.kraftEin(v.p, v.D, v.d) : NaN, r = fin(v.r) && v.r >= 0 && v.r < 100 ? v.r : NaN;
    const o = { p: v.p, D: v.D, d: v.d, hasd, F, Fmax: Math.max(F, 1), Fn: fin(r) ? C.calc.kraftNutz(F, r / 100) : NaN, r };
    const a = cyl(4, 'aus', o); let body = a.s, h = 4 + a.h;
    if (hasd) { const b = cyl(h + 10, 'ein', Object.assign({}, o, { F: Fe, Fn: NaN })); body += b.s; h += 10 + b.h; }
    body += `<text x="20" y="${q(h + 10)}" class="m">Blau: Druckluft · gestrichelt: entlüftet</text><text x="20" y="${q(h + 23)}" class="m">Pfeillänge ~ Kraft (alle Pfeile im gleichen Maßstab)</text>`;
    return box('Wo drückt die Luft? (Längsschnitt, Maße im Verhältnis)', svg(h + 32, 'Zylinder im Längsschnitt: Druck auf Kolbenfläche beim Ausfahren und auf die Ringfläche beim Einfahren mit Kraftpfeilen', body));
  }

  /* ---------- Luftverbrauch: Hubvolumen mal (p+1) ---------- */
  function luft(v) {
    if (!v || !C || ![v.p, v.D, v.s].every(fin) || !(v.D > 0) || !(v.s > 0) || v.p < 0) return '';
    const V = C.calc.luftHub(v.p, v.D, v.s), f = v.p + 1, V0 = V / f, unit = clamp(230 / f, 8, 40), n = Math.max(1, Math.round(f * 10) / 10);
    let s = `<text x="20" y="12" class="t">Ein Ausfahrhub</text>`, x = 20;
    s += `<rect x="${x}" y="22" width="${q(unit)}" height="34" class="air"/><text x="${x}" y="72" class="m">Hubvolumen</text><text x="${x}" y="85">${fm(V0, 3)} l</text>`;
    const gx = x + unit + 12;
    s += `<text x="${q(gx)}" y="44" class="m">× ${fm(n, f % 1 ? 1 : 0)}</text>`;
    const bx = gx + 40, full = Math.floor(f), W = Math.min(full * unit, 350 - bx);
    for (let k = 0; k < full; k++) { const wx = bx + k * (W / full); s += `<rect x="${q(wx)}" y="22" width="${q(W / full - 1)}" height="34" class="air"/>`; }
    const rest = f - full; if (rest > 0.05) s += `<rect x="${q(bx + W + 1)}" y="22" width="${q(Math.min(unit * rest, 350 - bx - W - 1))}" height="34" class="air" style="fill-opacity:.12"/>`;
    s += `<text x="${q(bx)}" y="72" class="m">Luft bei Normdruck: (p + 1) · Hubvolumen</text><text x="${q(bx)}" y="85">${fm(V, 3)} l</text>`;
    s += `<text x="20" y="106" class="m">Der Verbrauch wird in Normlitern angegeben; Atmosphärendruck vereinfacht 1 bar.</text>`;
    return box('Warum (p + 1)?', svg(114, 'Luftverbrauch: Hubvolumen und die entsprechende Luftmenge bei Normdruck', s));
  }

  /* ---------- Verlauf: Signale über der Simulationszeit ---------- */
  const WIN = 10;   /* Sekunden Simulationszeit im Bild */
  function verlauf(h) {
    if (!h || !h.lanes || !h.lanes.length) return '';
    const L = h.lanes, tEnd = Math.max(WIN, fin(h.t) ? h.t : 0), tS = tEnd - WIN, X0 = 84, W = 266, lh = 28, top = 6, H = top + L.length * lh + 22;
    const x = t => q(X0 + (t - tS) / WIN * W);
    let s = '';
    for (let tt = Math.ceil(tS / 2) * 2; tt <= tEnd + 1e-6; tt += 2) { s += `<line x1="${x(tt)}" y1="${top}" x2="${x(tt)}" y2="${top + L.length * lh}" class="gd"/><text x="${x(tt)}" y="${top + L.length * lh + 14}" text-anchor="middle" class="m">${fm(tt, 0)}</text>`; }
    L.forEach((ln, i) => {
      const y0 = top + i * lh + 4, yh = lh - 10, yv = v => q(y0 + yh - clamp(v, 0, 1) * yh);
      s += `<text x="${X0 - 6}" y="${q(y0 + yh / 2 + 4)}" text-anchor="end" class="m" style="font-size:10.5px">${esc(ln.label)}</text>`;
      s += `<line x1="${X0}" y1="${q(y0 + yh)}" x2="${X0 + W}" y2="${q(y0 + yh)}" class="gd"/>`;
      let d = '', last = null, i0 = 0;
      ln.pts.forEach((p, i) => { if (p[0] < tS) i0 = i; });
      ln.pts.slice(i0).forEach(p => {
        if (!fin(p[0]) || !fin(p[1])) return;
        const xx = x(Math.max(tS, p[0])), yy = yv(p[1]);
        if (d === '') d = `M${xx} ${yy}`; else if (ln.step && last !== null && last !== yy) d += `L${xx} ${last}L${xx} ${yy}`; else d += `L${xx} ${yy}`;
        last = yy;
      });
      if (d) s += `<path d="${d}" class="${ln.cls}"/>`;
    });
    return svg(H, 'Zeitdiagramm der Simulation: ' + L.map(l => l.label).join(', '), s);
  }

  /* ---------- Aufzeichnung aus der laufenden Simulation ---------- */
  const R = { st: null, cir: null, last: -1, lanes: null, t: 0, drawn: 0, sig: '' };
  function reset(PL) {
    R.st = PL.st; R.cir = PL.cir; R.last = -1; R.t = 0; R.sig = '';
    const m = PL.model, lab = id => { const p = (PL.cir.parts || []).find(x => x.id === id); return (p && p.label) || id; }, ls = [];
    m.cyls.forEach(id => {
      ls.push({ key: 'w:' + id, label: 'Weg ' + lab(id), cls: 'tr-w', step: false, pts: [] });
      ls.push({ key: 'k:' + id, label: 'p Kolbenseite', cls: 'tr-p', step: true, pts: [] });
      if (m.parts[id].t === 'zyl_da') ls.push({ key: 's:' + id, label: 'p Stangenseite', cls: 'tr-p', step: true, pts: [] });
    });
    m.inputs.forEach(id => ls.push({ key: 'i:' + id, label: 'Taster ' + lab(id), cls: 'tr-t', step: true, pts: [] }));
    R.lanes = ls.slice(0, 12);
  }
  function sample(PL) {
    const s = PL.st, m = PL.model, t = s.t || 0; let ch = false;
    if (R.last >= 0 && t < R.last) { reset(PL); }
    if (R.last >= 0 && t - R.last < 0.05) return false;
    R.last = t; R.t = t;
    R.lanes.forEach(ln => {
      const id = ln.key.slice(2), k = ln.key[0]; let v = 0;
      if (k === 'w') v = s.pos[id] || 0;
      else if (k === 'k') { const i = m.idx[id + '.K']; v = i != null ? s.net[i] : 0; }
      else if (k === 's') { const i = m.idx[id + '.S']; v = i != null ? s.net[i] : 0; }
      else v = s.inp[id] ? 1 : 0;
      const p = ln.pts, lp = p[p.length - 1];
      if (!ln.step) { p.push([t, v]); ch = true; }
      else if (!lp) { p.push([t, v], [t, v]); ch = true; }
      else if (Math.abs(lp[1] - v) < 1e-3) lp[0] = t;
      else { p.push([t, v], [t, v]); ch = true; }
      while (p.length > 3 && p[1][0] < t - WIN - 1) p.shift();
    });
    return ch;
  }
  /* Zustand der Simulation aufzeichnen (ohne DOM, damit in Node testbar); gibt { lanes, t } zurück */
  function track(PL) {
    if (!PL || !PL.model || !PL.st || !PL.cir) return null;
    if (R.st !== PL.st || R.cir !== PL.cir || !R.lanes) reset(PL);
    sample(PL);
    return { lanes: R.lanes, t: R.t };
  }
  function tick(PL, S) {
    if (typeof document === 'undefined' || !PL) return;
    const host = document.getElementById('plViz');
    if (S && S.task) { if (host) host.innerHTML = ''; return; }
    if (!PL.model || !PL.st || !PL.cir || !PL.model.cyls.length) { if (host) host.innerHTML = ''; return; }
    let el = host;
    if (!el) { const st = document.getElementById('plStat'), info = document.getElementById('anlInfo'); if (!st || !info) return; el = document.createElement('div'); el.id = 'plViz'; el.className = 'card pl'; info.parentNode.insertBefore(el, info); R.sig = ''; }
    if (R.st !== PL.st || R.cir !== PL.cir || !R.lanes) { el.innerHTML = ''; R.sig = ''; }
    track(PL);
    const now = Date.now(); if (now - R.drawn < 120 && el.firstChild) return;
    const sig = R.t.toFixed(2) + '|' + R.lanes.map(l => l.pts.length).join(','); if (sig === R.sig && el.firstChild) return;
    R.sig = sig; R.drawn = now;
    el.innerHTML = `<h4>Zeitdiagramm: Weg, Druck und Taster</h4>${verlauf({ lanes: R.lanes, t: R.t })}<p class="hint2" style="margin:4px 0 0">Die letzten ${WIN} Sekunden der Simulation. Weg: 0 % eingefahren bis 100 % ausgefahren. Druck: oben = belüftet, unten = entlüftet. Bei Pause steht auch das Diagramm.</p>`;
  }

  const api = { kraft, luft, verlauf, tick, track };
  root.PNEVIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* pneui.js hat den ersten Reiter schon gezeichnet, bevor diese Datei da war: Rechnen einmal neu zeichnen */
  if (typeof document !== 'undefined') {
    try { const t = document.querySelector('#mid').dataset.tab; if (t === 'rech') { const b = document.querySelector('.tab[data-t="rech"]'); if (b) b.click(); } } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
