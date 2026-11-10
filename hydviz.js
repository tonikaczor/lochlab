'use strict';
/* Tonfunk Hydraulik-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei wird NACH hydui.js eingebunden.
   window.HYDVIZ = { zylinder, pumpe, presse, gauges }.
   zylinder(v)  Zylinder im Längsschnitt beim Ausfahren und Einfahren mit Kraft- und Geschwindigkeitspfeilen. v = { D, d (mm), p (bar), Q (l/min), s (mm) }
   pumpe(v)     Förderstrom (theoretisch und nutzbar) und Leistungsfluss (Antrieb, hydraulisch, Verluste). v = { Vg (cm3/U), n (1/min), ev, et, p (bar) }
   presse(v)    Hydraulische Presse: gleicher Druck, Kraft- und Wegverhältnis. v = { F1 (kN), d1, d2 (mm) }
   gauges(circ,res,st)  Druckanzeigen der laufenden Schaltung (Pumpe, Zylinderkammern, Einstelldruck); nur im freien Ausprobieren, nicht in Aufgaben.
   Alle Zahlen kommen aus hydcore.js (gleiche Formeln wie die Tabellen im Rechner). Funktionen liefern SVG-Text, nie NaN im Markup.
   Farben nur über CSS-Variablen der Seite (Hell/Dunkel/Auto). Keine Hover-Abhängigkeit, keine dekorative Animation. */
(function (root) {
  const C = root.HYD_CORE || (typeof require !== 'undefined' ? require('./hydcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = x => typeof x === 'number' && isFinite(x);
  const q = x => (fin(x) ? Math.round(x * 10) / 10 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fd = (v, d) => (fin(v) ? C.fmtDe(v, d == null ? 2 : d) : '–');
  /* Druckfarbe wie im Schaltplan: drucklos blau, dann gelb bis rot */
  const pcol = (p, ref) => (!(p >= 1.5) ? 'var(--hy-t,#3b9eff)' : (t => `hsl(${Math.round(48 * (1 - t))},92%,${Math.round(52 - 6 * t)}%)`)(clamp(p / (ref || 200), 0, 1)));

  const CSS = '.hv{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0;text-anchor:start}'
    + '.hv text{font:600 11.5px system-ui,sans-serif;fill:var(--fg,#222);-webkit-user-select:none;user-select:none}'
    + '.hv .m{fill:var(--mute,#667);font-weight:500;font-size:10.5px}'
    + '.hv .t{fill:var(--mute,#667);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase}'
    + '.hv .gd{stroke:var(--line,#bbb);stroke-width:1;fill:none}'
    + '.hv .body{fill:none;stroke:var(--fg,#222);stroke-width:1.5}'
    + '.hv .tank{fill:none;stroke:var(--hy-t,#3b9eff);stroke-width:1.2;stroke-dasharray:4 3}'
    + '.hv .pis{fill:var(--fg,#222)}'
    + '.hv .rod{fill:var(--mute,#889)}'
    + '.hv .force{stroke:var(--hi,var(--warn,#c80));stroke-width:3;fill:none}'
    + '.hv .forcef{fill:var(--hi,var(--warn,#c80))}'
    + '.hv .speed{stroke:var(--accent,#37f);stroke-width:3;fill:none}'
    + '.hv .speedf{fill:var(--accent,#37f)}'
    + '.hv .okb{fill:var(--accent,#37f);fill-opacity:.55}'
    + '.hv .lossb{fill:var(--warn,#c80);fill-opacity:.45}'
    + '.hv .track{fill:var(--panel2,#eee);stroke:var(--line,#bbb);stroke-width:1}'
    + '.hv .lim{stroke:var(--danger,#c33);stroke-width:1.6;stroke-dasharray:4 3}'
    + '.hvbox{margin:10px 0 2px;padding-top:6px;border-top:1px solid var(--line,#ccc)}'
    + '.hvbox h5{margin:0 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute,#667);font-weight:600}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('hydviz-css')) {
    const st = document.createElement('style'); st.id = 'hydviz-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const svg = (h, aria, body) => `<svg class="hv" viewBox="0 0 360 ${q(h)}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
  const box = (title, inner) => (inner ? `<div class="hvbox"><h5>${esc(title)}</h5>${inner}</div>` : '');
  function arrow(x1, y1, x2, y2, kind) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 9, w = 5, bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx + w * Math.sin(a), by - w * Math.cos(a)], [bx - w * Math.sin(a), by + w * Math.cos(a)]].map(v => q(v[0]) + ',' + q(v[1])).join(' ');
    return `<line x1="${q(x1)}" y1="${q(y1)}" x2="${q(bx)}" y2="${q(by)}" class="${kind}"/><polygon points="${p}" class="${kind}f"/>`;
  }

  /* ---------- Zylinder: Ausfahren (Kolbenfläche) und Einfahren (Ringfläche) ---------- */
  function row(y0, out, o) {
    const hD = clamp(o.D * 0.55, 46, 70), hd = clamp(hD * (o.hasd ? o.d / o.D : 0.4), 6, hD * 0.42), cy = y0 + 18 + hD / 2, top = cy - hD / 2, x0 = 16, x1 = 166, xp = 96, col = pcol(o.p, 250);
    let s = `<text x="16" y="${y0 + 8}" class="t">${out ? 'Ausfahren: Öl auf der Kolbenseite (Fläche A_K)' : 'Einfahren: Öl auf der Stangenseite (Ringfläche A_R)'}</text>`;
    const oil = (x, w) => `<rect x="${x}" y="${q(top)}" width="${q(w)}" height="${q(hD)}" style="fill:${col};fill-opacity:.5;stroke:${col};stroke-width:1.4"/>`;
    const ret = (x, w) => `<rect x="${x}" y="${q(top)}" width="${q(w)}" height="${q(hD)}" class="tank"/>`;
    s += out ? oil(x0, xp - x0) + ret(xp + 8, x1 - xp - 8) : ret(x0, xp - x0) + oil(xp + 8, x1 - xp - 8);
    s += `<rect x="${x0}" y="${q(top)}" width="${x1 - x0}" height="${q(hD)}" class="body"/><rect x="${xp}" y="${q(top)}" width="8" height="${q(hD)}" class="pis"/>`;
    s += `<rect x="${xp + 8}" y="${q(cy - hd / 2)}" width="${x1 + 36 - xp - 8}" height="${q(hd)}" class="rod"/>`;
    s += `<text x="${q(out ? (x0 + xp) / 2 : (xp + 8 + x1) / 2)}" y="${q(out ? cy + 4 : top + hD - 6)}" text-anchor="middle" class="m">${fin(o.p) ? fd(o.p, 0) + ' bar' : 'Druck'}</text><text x="${q(out ? (xp + 8 + x1) / 2 : (x0 + xp) / 2)}" y="${q(out ? top + hD - 6 : cy + 4)}" text-anchor="middle" class="m">zum Tank</text>`;
    const zx = 214;   /* Pfeilzone 214 bis 346 */
    if (fin(o.F)) { const len = clamp(o.F / o.Fmax * 110, 8, 110); s += out ? arrow(zx, cy - 14, zx + len, cy - 14, 'force') : arrow(zx + 110, cy - 14, zx + 110 - len, cy - 14, 'force'); }
    if (fin(o.v)) { const len = clamp(o.v / o.vmax * 110, 8, 110); s += out ? arrow(zx, cy + 14, zx + len, cy + 14, 'speed') : arrow(zx + 110, cy + 14, zx + 110 - len, cy + 14, 'speed'); }
    const bot = top + hD, parts = [];
    if (fin(o.F)) parts.push('F = ' + fd(o.F / 1000, 2) + ' kN');
    if (fin(o.v)) parts.push('v = ' + fd(o.v, 3) + ' m/s');
    if (fin(o.t)) parts.push('Hubzeit ' + fd(o.t, 2) + ' s');
    s += `<text x="16" y="${q(bot + 15)}">${esc(parts.join(' · '))}</text>`;
    return { s, h: 18 + hD + 24 };
  }
  function zylinder(v) {
    if (!v || !C || !fin(v.D) || !(v.D > 0)) return '';
    const hasd = fin(v.d) && v.d > 0 && v.d < v.D, r = C.cylinderCalc({ D: v.D, d: hasd ? v.d : NaN, p: fin(v.p) ? v.p : NaN, Q: fin(v.Q) ? v.Q : NaN, s: fin(v.s) && v.s > 0 ? v.s : NaN });
    if (!fin(r.Fout) && !fin(r.vOut)) return '';
    const o = { D: v.D, d: v.d, hasd, p: v.p, Fmax: Math.max(r.Fout || 0, 1), vmax: Math.max(hasd && fin(r.vIn) ? r.vIn : 0, r.vOut || 0, 1e-9) };
    const a = row(4, true, Object.assign({}, o, { F: r.Fout, v: r.vOut, t: r.tOut })); let s = a.s, h = 4 + a.h;
    if (hasd) { const b = row(h + 8, false, Object.assign({}, o, { F: r.Fin, v: r.vIn, t: r.tIn })); s += b.s; h += 8 + b.h; }
    s += `<text x="16" y="${q(h + 10)}" class="m">Pfeile: orange = Kraft, blau = Geschwindigkeit (je im gleichen Maßstab)</text><text x="16" y="${q(h + 23)}" class="m">Beim Einfahren ist die Fläche kleiner: weniger Kraft, aber schneller.</text>`;
    return box('Ausfahren und Einfahren im Vergleich (Längsschnitt)', svg(h + 32, 'Zylinder im Längsschnitt beim Ausfahren und Einfahren mit Kraft- und Geschwindigkeitspfeilen', s));
  }

  /* ---------- Pumpe: Förderstrom und Leistungsfluss ---------- */
  function bar(y, label, total, parts, unit, dec) {
    let s = `<text x="16" y="${y}" class="t">${esc(label)}</text>`, x = 16;
    parts.forEach(p => { const w = clamp(p.v / total, 0, 1) * 328; s += `<rect x="${q(x)}" y="${y + 6}" width="${q(w)}" height="26" class="${p.cls}"/>`; if (w > 36) s += `<text x="${q(x + w / 2)}" y="${y + 23}" text-anchor="middle">${esc(p.txt)}</text>`; x += w; });
    s += `<rect x="16" y="${y + 6}" width="328" height="26" class="track" style="fill:none"/>`;
    s += `<text x="16" y="${y + 47}" class="m">${parts.map(p => p.name + ' ' + fd(p.v, dec) + ' ' + unit).join(' · ')}</text>`;
    return s;
  }
  function pumpe(v) {
    if (!v || !C || !fin(v.Vg) || !fin(v.n) || !(v.Vg > 0) || !(v.n > 0)) return '';
    const ev = fin(v.ev) && v.ev > 0 && v.ev <= 1 ? v.ev : 1, Qt = C.pumpFlow(v.Vg, v.n, 1), Qn = C.pumpFlow(v.Vg, v.n, ev);
    let s = bar(10, 'Förderstrom', Qt, [{ v: Qn, cls: 'okb', txt: 'Q', name: 'Q nutzbar' }, { v: Math.max(0, Qt - Qn), cls: 'lossb', txt: 'Leckage', name: 'Leckverlust' }], 'l/min', 2), h = 66;
    const et = fin(v.et) && v.et > 0 && v.et <= 1 ? v.et : null;
    if (fin(v.p) && v.p > 0 && et != null) {
      const Ph = C.power(v.p, Qn), Pa = Ph / et;
      s += bar(h + 6, 'Leistung', Pa, [{ v: Ph, cls: 'okb', txt: 'P hyd', name: 'P hydraulisch' }, { v: Math.max(0, Pa - Ph), cls: 'lossb', txt: 'Verluste', name: 'Verluste' }], 'kW', 2); h += 66;
      s += `<text x="16" y="${h + 8}" class="m">P Antrieb = ${fd(Pa, 2)} kW (P hyd geteilt durch η gesamt)</text>`; h += 14;
    }
    return box('Wohin geht die Antriebsleistung der Pumpe?', svg(h + 10, 'Förderstrom der Pumpe mit Leckverlust und Leistungsfluss von der Antriebsleistung zur hydraulischen Leistung', s));
  }

  /* ---------- Hydraulische Presse: gleicher Druck, Kraft und Weg ---------- */
  function presse(v) {
    if (!v || !C || ![v.F1, v.d1, v.d2].every(fin) || !(v.F1 > 0) || !(v.d1 > 0) || !(v.d2 > 0)) return '';
    const A1 = C.areaCircle(v.d1), A2 = C.areaCircle(v.d2), p = C.pressureOf(v.F1 * 1000, A1), F2 = C.pressForce(v.F1, A1, A2), ratio = A2 / A1;
    const wL = 40, wR = clamp(40 * Math.sqrt(ratio), 22, 130), xl = 30, xr = 330 - wR, ytop = 84, wallTop = ytop - 26, ybot = ytop + 66, col = pcol(p, 250);
    const dL = 24, dR = clamp(dL / ratio, 2, 24), pL = ytop + dL, pR = ytop - dR;
    let s = `<path d="M${xl} ${ybot + 14}V${pL + 8}H${xl + wL}V${ybot}H${xr}V${q(pR + 8)}H${xr + wR}V${ybot + 14}Z" style="fill:${col};fill-opacity:.5;stroke:none"/>`;
    s += `<path d="M${xl} ${wallTop}V${ybot + 14}H${xr + wR}V${wallTop}M${xl + wL} ${wallTop}V${ybot}H${xr}V${wallTop}" class="body"/>`;
    s += `<rect x="${xl + 1}" y="${pL}" width="${wL - 2}" height="8" class="pis"/><rect x="${xr + 1}" y="${q(pR)}" width="${wR - 2}" height="8" class="pis"/>`;
    const l1 = 30, l2 = clamp(l1 * ratio, 8, 60);
    s += arrow(xl + wL / 2, pL - 4 - l1, xl + wL / 2, pL - 4, 'force') + `<text x="${xl + wL + 8}" y="${q(pL - l1 / 2)}">F₁ = ${fd(v.F1, 1)} kN</text>`;
    s += arrow(xr + wR / 2, pR - 4, xr + wR / 2, pR - 4 - l2, 'speed') + `<text x="${xr - 8}" y="${q(pR - l2 / 2)}" text-anchor="end">F₂ = ${fd(F2, 1)} kN</text>`;
    s += `<text x="${q((xl + wL + xr) / 2)}" y="${ybot - 16}" text-anchor="middle">p = ${fd(p, 0)} bar</text><text x="${q((xl + wL + xr) / 2)}" y="${ybot - 3}" text-anchor="middle" class="m">überall gleich</text>`;
    s += `<text x="16" y="${ybot + 38}" class="m">Kraft: F₂ / F₁ = ${fd(ratio, 2)} · Weg: s₂ / s₁ = 1 : ${fd(ratio, 2)}</text><text x="16" y="${ybot + 51}" class="m">Pfeile und Wege nicht maßstäblich. Was an Kraft gewonnen wird,</text><text x="16" y="${ybot + 64}" class="m">geht an Weg verloren.</text>`;
    return box('Presse: gleicher Druck, mehr Kraft, weniger Weg', svg(ybot + 74, 'Hydraulische Presse mit kleinem und großem Kolben, gleichem Druck und den beiden Kräften', s));
  }

  /* ---------- Druckanzeigen der laufenden Schaltung ---------- */
  function gauges(circ, res, st) {
    if (!circ || !res || !st) return '';
    const items = [];
    if (res.pump && fin(res.pump.p)) items.push({ label: 'Pumpe', p: res.pump.p });
    (circ.parts || []).forEach(pt => {
      const r = res.cyl && res.cyl[pt.id]; if (!r) return;
      if (fin(r.pA)) items.push({ label: pt.id + ' Kolbenseite', p: r.pA });
      if (fin(r.pB) && r.AB) items.push({ label: pt.id + ' Stangenseite', p: r.pB });
    });
    const sets = Object.keys(st.pset || {}).map(k => ({ id: k, p: st.pset[k] })).filter(x => fin(x.p));
    if (!items.length) return '';
    const mx = Math.max(100, Math.ceil(Math.max.apply(null, items.map(i => Math.max(0, i.p)).concat(sets.map(x => x.p), [0])) / 50) * 50), X0 = 100, W = 244, top = 22, lh = 24, H = top + items.length * lh + 22, x = p => q(X0 + clamp(p, 0, mx) / mx * W);
    let s = `<text x="${X0}" y="12" class="m">0</text><text x="${X0 + W}" y="12" text-anchor="end" class="m">${mx} bar</text>`;
    items.forEach((it, i) => {
      const y = top + i * lh, p = Math.max(0, it.p);
      s += `<text x="${X0 - 6}" y="${y + 13}" text-anchor="end" class="m">${esc(it.label)}</text><rect x="${X0}" y="${y + 2}" width="${W}" height="16" class="track"/>`;
      if (p > 0.05) s += `<rect x="${X0}" y="${y + 2}" width="${q(Math.max(1, x(p) - X0))}" height="16" style="fill:${pcol(p, 250)};fill-opacity:.85"/>`;
      s += `<text x="${Math.min(X0 + W - 4, Math.max(X0 + 4, +x(p) + 4))}" y="${y + 14}" ${x(p) > X0 + W - 60 ? 'text-anchor="end" style="fill:#fff;paint-order:stroke;stroke:#000;stroke-width:2.5px"' : ''}>${fd(it.p, 0)}</text>`;
    });
    sets.forEach(se => { s += `<line x1="${x(se.p)}" y1="${top - 2}" x2="${x(se.p)}" y2="${top + items.length * lh}" class="lim"/>`; });
    s += `<text x="${X0}" y="${top + items.length * lh + 14}" class="m">Rote Linie: Einstelldruck ${sets.map(se => se.id + ' ' + fd(se.p, 0) + ' bar').join(', ')}</text>`;
    return box('Druck an Pumpe und Zylinder', svg(H, 'Druck an Pumpe und Zylinderkammern in bar im Verhältnis zum Einstelldruck des Druckbegrenzungsventils', s));
  }

  const api = { zylinder, pumpe, presse, gauges };
  root.HYDVIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* hydui.js hat den ersten Reiter schon gezeichnet, bevor diese Datei da war: Rechner bzw. Schaltpläne einmal neu zeichnen */
  if (typeof document !== 'undefined') {
    try { const t = document.querySelector('#mid').dataset.tab, b = (t === 'calc' || t === 'sim') ? document.querySelector('.tab[data-t="' + t + '"]') : null; if (b) b.click(); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
