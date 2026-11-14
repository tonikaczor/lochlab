'use strict';
/* Tonfunk Projekt-und-Wirtschaftlichkeits-Lab: Grafiken als inline-SVG (ohne Bibliothek), reine Funktionen: Daten rein, SVG-Text raus.
   Alle Breiten (w) kommen vom Container, die Schrift bleibt dadurch immer 14 px groß (Stil .viz text in prjlab.css).
   Farben nur über CSS-Klassen (Variablen): f-acc, f-warn, f-ok, f-bad, s-acc, …  Keine Animation.
   Export: window.PRJ_VIZ bzw. module.exports (Node, quelle/prj/test_prjviz.js). */
(function (root) {
  const C = root.PRJ_CORE || (typeof require === 'function' ? require('./prjcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const cut = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const N = (v, d) => C.fmtN(v, d == null ? 2 : d);
  const svg = (w, h, aria, body, extra) => `<svg class="viz" viewBox="0 0 ${f1(w)} ${f1(h)}" width="${f1(w)}" height="${f1(h)}" role="img" aria-label="${esc(aria)}"${extra || ''}>${body}</svg>`;
  const T = (x, y, s, cls, anchor) => `<text x="${f1(x)}" y="${f1(y)}"${cls ? ' class="' + cls + '"' : ''}${anchor ? ' text-anchor="' + anchor + '"' : ''}>${esc(s)}</text>`;
  function niceStep(max, n) { if (!(max > 0)) return 1; const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag; }
  const niceMax = (max, n) => { const s = niceStep(max, n); return Math.ceil(max / s - 1e-9) * s; };
  const ticks = (a, b, n) => { const s = niceStep(b - a, n), out = []; for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + 1e-9; v += s) out.push(Math.abs(v) < 1e-9 ? 0 : Math.round(v / s * 1e6) / 1e6 * s); return out; };
  const fmtK = v => C.fmtDe(v, 0);

  /* ============================================================ Netzplan (Vorgangsknoten) */
  const NW = 124, NH = 70, NH_H = 48, GX = 40, GY = 16, PAD = 10;
  function layout(res, hide) {
    const L = {}, ids = res.order, h = hide ? NH_H : NH;
    ids.forEach(id => { const o = res.map.get(id); L[id] = o.pre.length ? Math.max.apply(null, o.pre.map(p => L[p])) + 1 : 0; });
    const nl = Math.max.apply(null, ids.map(id => L[id])) + 1, cols = Array.from({ length: nl }, () => []);
    res.list.forEach(o => cols[L[o.id]].push(o.id));
    const row = {}; cols[0].forEach((id, k) => { row[id] = k; });
    for (let sweep = 0; sweep < 2; sweep++) {
      for (let c = 1; c < nl; c++) {
        const bary = id => { const o = res.map.get(id), r = o.pre.map(p => row[p]); return r.length ? r.reduce((s, x) => s + x, 0) / r.length : 0; };
        cols[c].sort((a, b) => bary(a) - bary(b)); cols[c].forEach((id, k) => { row[id] = k; });
      }
      for (let c = nl - 2; c >= 0; c--) {
        const bary = id => { const o = res.map.get(id), r = o.succ.map(s => row[s]); return r.length ? r.reduce((s, x) => s + x, 0) / r.length : row[id]; };
        cols[c].sort((a, b) => bary(a) - bary(b)); cols[c].forEach((id, k) => { row[id] = k; });
      }
    }
    const maxRows = Math.max.apply(null, cols.map(c => c.length)), pos = {};
    ids.forEach(id => { const col = cols[L[id]], off = (maxRows - col.length) * (h + GY) / 2; pos[id] = { x: PAD + L[id] * (NW + GX), y: PAD + off + row[id] * (h + GY), layer: L[id], row: row[id] }; });
    return { pos, w: PAD * 2 + nl * NW + (nl - 1) * GX, h: PAD * 2 + maxRows * h + (maxRows - 1) * GY, layers: nl, nh: h };
  }
  function netzplan(res, opt) {
    opt = opt || {}; const hide = !!opt.hide, lay = layout(res, hide), nh = lay.nh, uid = opt.uid || 'n';
    let body = `<defs><marker id="${uid}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" class="f-mute"/></marker><marker id="${uid}c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" class="f-warn"/></marker></defs>`;
    res.list.forEach(o => o.succ.forEach(s => {
      const a = lay.pos[o.id], b = lay.pos[s], so = res.map.get(s), x1 = a.x + NW, y1 = a.y + nh / 2, x2 = b.x, y2 = b.y + nh / 2, mx = (x1 + x2) / 2, crit = !hide && o.crit && so.crit && Math.abs(so.es - o.ef) < 1e-9;
      body += `<path d="M${f1(x1)} ${f1(y1)}C${f1(mx)} ${f1(y1)} ${f1(mx)} ${f1(y2)} ${f1(x2 - 1)} ${f1(y2)}" class="${crit ? 's-warn e-crit' : 's-mute e-norm'}" fill="none" marker-end="url(#${uid}${crit ? 'c' : 'a'})"/>`;
    }));
    res.list.forEach(o => {
      const p = lay.pos[o.id], crit = !hide && o.crit, ms = o.d === 0, x = p.x, y = p.y;
      body += `<g class="nd${crit ? ' crit' : ''}${ms ? ' ms' : ''}" data-id="${esc(o.id)}"><title>${esc(o.id + ' ' + o.name)}</title><rect x="${x}" y="${y}" width="${NW}" height="${nh}" rx="${ms ? nh / 2 : 8}" class="nbox ${crit ? 's-warn' : 's-mute'}"/>`;
      if (hide) {
        body += T(x + 8, y + 20, (ms ? '◆ ' : '') + o.id + '  ' + cut(o.name, 11), 'b') + T(x + 8, y + 40, 'Dauer ' + N(o.d) + ' AT', 'mu');
      } else {
        const cw = NW / 3, r1 = y + 17, r3 = y + nh - 6;
        body += `<path d="M${x} ${y + 22}H${x + NW}M${x} ${y + nh - 22}H${x + NW}M${x + cw} ${y}V${y + 22}M${x + 2 * cw} ${y}V${y + 22}M${x + cw} ${y + nh - 22}V${y + nh}M${x + 2 * cw} ${y + nh - 22}V${y + nh}" class="s-mute nline" fill="none"/>`;
        body += T(x + cw / 2, r1, N(o.es), '', 'middle') + T(x + 1.5 * cw, r1, N(o.d), 'mu', 'middle') + T(x + 2.5 * cw, r1, N(o.ef), '', 'middle');
        body += T(x + NW / 2, y + nh / 2 + 5, (ms ? '◆ ' : '') + o.id + ' ' + cut(o.name, 11), 'b', 'middle');
        body += T(x + cw / 2, r3, N(o.ls), '', 'middle') + T(x + 1.5 * cw, r3, N(o.gp), o.gp === 0 ? 'b w' : 'mu', 'middle') + T(x + 2.5 * cw, r3, N(o.lf), '', 'middle');
      }
      body += '</g>';
    });
    const aria = 'Netzplan mit ' + res.list.length + ' Vorgängen' + (hide ? '' : ', Projektdauer ' + N(res.duration) + ' Arbeitstage, kritischer Pfad ' + (res.paths[0] || []).join(' ') );
    return { svg: svg(lay.w, lay.h, aria, body), w: lay.w, h: lay.h, pos: lay.pos, layout: lay };
  }

  /* ============================================================ Gantt */
  function gantt(res, w, opt) {
    opt = opt || {}; const rows = C.gantt(res), rh = 32, top = 8, axisH = 30, nameW = w >= 560 ? 150 : 0, idW = 28, lw = idW + nameW + 6, x0 = lw, x1 = Math.max(x0 + 60, w - 14), dur = Math.max(res.duration, 1e-9);
    const X = t => x0 + t / dur * (x1 - x0), h = top + rows.length * rh + axisH; let body = '';
    const tk = ticks(0, dur, Math.max(2, Math.floor((x1 - x0) / 60)));
    tk.forEach(v => { body += `<line x1="${f1(X(v))}" y1="${top}" x2="${f1(X(v))}" y2="${top + rows.length * rh}" class="grid"/>` + T(X(v), top + rows.length * rh + 20, N(v, 1), 'mu', 'middle'); });
    rows.forEach((r, k) => {
      const y = top + k * rh, cy = y + rh / 2;
      body += T(4, cy + 5, r.id, 'b') + (nameW ? T(idW + 4, cy + 5, cut(r.name, 17), 'mu') : '');
      if (r.ms) {
        const cx = X(r.start), d = 11; body += `<path d="M${f1(cx)} ${f1(cy - d)}L${f1(cx + d)} ${f1(cy)}L${f1(cx)} ${f1(cy + d)}L${f1(cx - d)} ${f1(cy)}z" class="${r.crit ? 'f-warn' : 'f-acc'}"><title>${esc(r.id + ' Meilenstein bei ' + N(r.start))}</title></path>`;
      } else {
        if (r.bufEnd > r.end + 1e-9) body += `<rect x="${f1(X(r.end))}" y="${y + 9}" width="${f1(X(r.bufEnd) - X(r.end))}" height="${rh - 18}" rx="3" class="buf"><title>${esc('Gesamtpuffer ' + N(r.gp))}</title></rect>`;
        body += `<rect x="${f1(X(r.start))}" y="${y + 5}" width="${f1(Math.max(3, X(r.end) - X(r.start)))}" height="${rh - 10}" rx="4" class="${r.crit ? 'f-warn' : 'f-acc'}"><title>${esc(r.id + ' ' + r.name + ': ' + N(r.start) + ' bis ' + N(r.end))}</title></rect>`;
        if (X(r.end) - X(r.start) > 34) body += T((X(r.start) + X(r.end)) / 2, cy + 5, N(r.end - r.start), 'on', 'middle');
      }
    });
    body += `<line x1="${f1(X(dur))}" y1="${top - 2}" x2="${f1(X(dur))}" y2="${top + rows.length * rh}" class="s-warn" stroke-dasharray="5 4"/>`;
    return svg(w, h, 'Gantt-Diagramm, ' + rows.length + ' Vorgänge, Projektdauer ' + N(res.duration), body);
  }

  /* ============================================================ Break-even */
  function breakeven(p, w) {
    const d = C.db(p), h = Math.round(Math.min(340, Math.max(250, w * 0.64))), padT = 16, padB = 44;
    const xs = [10, d.be || 0, p.x || 0].filter(fin), xmax = niceMax(Math.max.apply(null, xs) * (d.be ? 1.7 : 1.2) + 1e-9, 5) || 10, y = x => p.kfix + p.kv * x, e = x => p.p * x;
    const ymax = niceMax(Math.max(y(xmax), e(xmax), 1), 5), padL = 14 + String(fmtK(ymax)).length * 8.2, padR = 14, x0 = padL, x1 = w - padR, yb = h - padB, yt = padT;
    const X = v => x0 + v / xmax * (x1 - x0), Y = v => yb - v / ymax * (yb - yt);
    let b = '';
    ticks(0, ymax, 5).forEach(v => { b += `<line x1="${x0}" y1="${f1(Y(v))}" x2="${x1}" y2="${f1(Y(v))}" class="grid"/>` + T(x0 - 6, Y(v) + 5, fmtK(v), 'mu', 'end'); });
    ticks(0, xmax, Math.max(2, Math.floor((x1 - x0) / 80))).forEach(v => { b += `<line x1="${f1(X(v))}" y1="${yb}" x2="${f1(X(v))}" y2="${yb + 5}" class="s-mute"/>` + T(X(v), yb + 22, fmtK(v), 'mu', 'middle'); });
    b += `<line x1="${x0}" y1="${yb}" x2="${x1}" y2="${yb}" class="s-mute"/><line x1="${x0}" y1="${yt}" x2="${x0}" y2="${yb}" class="s-mute"/>`;
    if (!d.noBE) {
      const bx = X(d.be), by = Y(e(d.be));
      b += `<path d="M${f1(x0)} ${f1(Y(y(0)))}L${f1(bx)} ${f1(by)}L${f1(x0)} ${f1(Y(0))}z" class="zone-bad"/><path d="M${f1(bx)} ${f1(by)}L${f1(x1)} ${f1(Y(e(xmax)))}L${f1(x1)} ${f1(Y(y(xmax)))}z" class="zone-ok"/>`;
    }
    b += `<line x1="${f1(x0)}" y1="${f1(Y(p.kfix))}" x2="${f1(x1)}" y2="${f1(Y(p.kfix))}" class="s-mute" stroke-dasharray="5 4"/>`;
    b += `<line x1="${f1(x0)}" y1="${f1(Y(y(0)))}" x2="${f1(x1)}" y2="${f1(Y(y(xmax)))}" class="s-warn line"/><line x1="${f1(x0)}" y1="${f1(Y(0))}" x2="${f1(x1)}" y2="${f1(Y(e(xmax)))}" class="s-acc line"/>`;
    if (!d.noBE) {
      const bx = X(d.be), by = Y(e(d.be)), right = bx > x0 + (x1 - x0) * 0.6;
      b += `<circle cx="${f1(bx)}" cy="${f1(by)}" r="6" class="f-ok dot"/>` + T(right ? bx - 10 : bx + 10, Math.min(yb - 8, by - 12), 'Break-even ' + fmtK(Math.ceil(d.be - 1e-9)) + ' Stück', 'b', right ? 'end' : 'start');
    } else b += T((x0 + x1) / 2, yt + 20, 'Kein Break-even: Preis ≤ variable Kosten', 'b w', 'middle');
    if (p.x > 0 && p.x <= xmax) { const px = X(p.x); b += `<line x1="${f1(px)}" y1="${yt}" x2="${f1(px)}" y2="${yb}" class="s-acc" stroke-dasharray="2 4"/>` + T(px + (px > x1 - 70 ? -4 : 4), yt + 14, 'Plan ' + fmtK(p.x), 'mu', px > x1 - 70 ? 'end' : 'start'); }
    b += T((x0 + x1) / 2, h - 4, 'Menge in Stück  ·  Euro', 'mu', 'middle');
    return svg(w, h, d.noBE ? 'Kosten und Erlös ohne Schnittpunkt' : 'Break-even-Grafik: Erlös und Gesamtkosten schneiden sich bei ' + fmtK(d.be) + ' Stück', b);
  }

  /* ============================================================ Preis-Zusammensetzung */
  function priceBar(v, w) {
    const parts = [['Personal', v.pers, 's1'], ['Material (mit MGK)', v.mat + v.mgk, 's2'], ['Fremdleistung', v.fremd, 's3'], ['Wagnis', v.wag, 's4'], ['Gewinn', v.gew, 's5'], ['Skonto', v.sko, 's6']].filter(x => x[1] > 0), tot = parts.reduce((s, x) => s + x[1], 0) || 1, bx = 6, bw = w - 12, h = 56 + parts.length * 24; let x = bx, b = '';
    parts.forEach(pt => { const sw = pt[1] / tot * bw; b += `<rect x="${f1(x)}" y="8" width="${f1(Math.max(1, sw))}" height="32" class="${pt[2]}"><title>${esc(pt[0] + ' ' + C.eur(pt[1]))}</title></rect>`; x += sw; });
    parts.forEach((pt, k) => { b += `<rect x="6" y="${54 + k * 24}" width="14" height="14" rx="3" class="${pt[2]}"/>` + T(28, 66 + k * 24, pt[0] + ': ' + C.eur(pt[1]) + '  (' + N(pt[1] / tot * 100, 1) + ' %)'); });
    return svg(w, h, 'Zusammensetzung des Angebotspreises netto ' + C.eur(tot), b);
  }

  /* ============================================================ Kapitalwertfunktion */
  function npvCurve(curves, o, w) {
    o = o || {}; const h = Math.round(Math.min(330, Math.max(250, w * 0.66))), padT = 16, padB = 44;
    const irrs = curves.map(c => C.irr(c.cf)).filter(x => fin(x) && x > -50), fisher = fin(o.fisher) ? o.fisher : NaN, cand = irrs.concat(fin(fisher) ? [fisher] : [], [o.i || 0]);
    const xmax = Math.max(10, niceMax(Math.min(100, Math.max.apply(null, cand) * 1.4 + 2), 5)), xmin = 0, pts = [], M = 60;
    curves.forEach(c => { const a = []; for (let k = 0; k <= M; k++) { const i = xmin + (xmax - xmin) * k / M; a.push([i, C.npv(i / 100, c.cf)]); } pts.push(a); });
    const all = [].concat.apply([], pts).map(p => p[1]).filter(fin).concat([0]), ymin0 = Math.min.apply(null, all), ymax0 = Math.max.apply(null, all), step = niceStep((ymax0 - ymin0) || 1, 5), ymin = Math.floor(ymin0 / step) * step, ymax = Math.max(Math.ceil(ymax0 / step) * step, ymin + step);
    const padL = 14 + Math.max(String(fmtK(ymax)).length, String(fmtK(ymin)).length) * 8.2, x0 = padL, x1 = w - 14, yb = h - padB, yt = padT, X = v => x0 + (v - xmin) / (xmax - xmin) * (x1 - x0), Y = v => yb - (v - ymin) / (ymax - ymin) * (yb - yt);
    let b = '';
    ticks(ymin, ymax, 5).forEach(v => { b += `<line x1="${x0}" y1="${f1(Y(v))}" x2="${x1}" y2="${f1(Y(v))}" class="${v === 0 ? 's-mute' : 'grid'}"/>` + T(x0 - 6, Y(v) + 5, fmtK(v), 'mu', 'end'); });
    ticks(xmin, xmax, Math.max(2, Math.floor((x1 - x0) / 60))).forEach(v => { b += `<line x1="${f1(X(v))}" y1="${yb + 0}" x2="${f1(X(v))}" y2="${yb + 5}" class="s-mute"/>` + T(X(v), yb + 22, N(v, 0), 'mu', 'middle'); });
    b += `<line x1="${x0}" y1="${yt}" x2="${x0}" y2="${yb}" class="s-mute"/>`;
    const cls = ['s-acc', 's-warn'];
    curves.forEach((c, k) => { b += `<polyline points="${pts[k].filter(p => fin(p[1])).map(p => f1(X(p[0])) + ',' + f1(Y(p[1]))).join(' ')}" class="${cls[k % 2]} line" fill="none"/>`; });
    if (fin(o.i)) { const px = X(o.i); b += `<line x1="${f1(px)}" y1="${yt}" x2="${f1(px)}" y2="${yb}" class="s-ok" stroke-dasharray="3 4"/>`; curves.forEach((c, k) => { const kv = C.npv(o.i / 100, c.cf); if (fin(kv) && kv >= ymin && kv <= ymax) b += `<circle cx="${f1(px)}" cy="${f1(Y(kv))}" r="5" class="${k % 2 ? 'f-warn' : 'f-acc'} dot"/>`; }); b += T(px + (px > x1 - 90 ? -6 : 6), yt + 12, 'Zins ' + N(o.i, 1) + ' %', 'mu', px > x1 - 90 ? 'end' : 'start'); }
    curves.forEach((c, k) => { const r = C.irr(c.cf); if (fin(r) && r >= xmin && r <= xmax) b += `<circle cx="${f1(X(r))}" cy="${f1(Y(0))}" r="6" class="f-ok dot"/>` + (curves.length === 1 ? T(X(r) + (X(r) > x1 - 150 ? -10 : 10), Y(0) - 10, 'interner Zinsfuß ' + N(r, 2) + ' %', 'b', X(r) > x1 - 150 ? 'end' : 'start') : ''); });
    if (fin(fisher) && fisher >= xmin && fisher <= xmax) { const kf = C.npv(fisher / 100, curves[0].cf); b += `<circle cx="${f1(X(fisher))}" cy="${f1(Y(kf))}" r="6" class="f-bad dot"/>` + T(X(fisher) + (X(fisher) > x1 - 140 ? -10 : 10), Y(kf) - 10, 'Schnittpunkt ' + N(fisher, 1) + ' %', 'b', X(fisher) > x1 - 140 ? 'end' : 'start'); }
    b += T((x0 + x1) / 2, h - 4, 'Kalkulationszins in %  ·  Kapitalwert in €', 'mu', 'middle');
    return svg(w, h, 'Kapitalwert in Abhängigkeit vom Zinssatz' + (irrs.length ? ', interner Zinsfuß ' + N(irrs[0], 1) + ' Prozent' : ''), b);
  }
  /* Zahlungen je Jahr und kumulierte Barwerte */
  function cfBars(cf, i, w) {
    const n = cf.length, h = Math.round(Math.min(300, Math.max(230, w * 0.6))), padT = 14, padB = 44, q = 1 + i / 100, cum = []; let s = 0; cf.forEach((z, t) => { s += z / Math.pow(q, t); cum.push(s); });
    const vals = cf.concat(cum, [0]), ymin0 = Math.min.apply(null, vals), ymax0 = Math.max.apply(null, vals), step = niceStep((ymax0 - ymin0) || 1, 5), ymin = Math.floor(ymin0 / step) * step, ymax = Math.max(Math.ceil(ymax0 / step) * step, ymin + step);
    const padL = 14 + Math.max(String(fmtK(ymax)).length, String(fmtK(ymin)).length) * 8.2, x0 = padL, x1 = w - 10, yb = h - padB, yt = padT, Y = v => yb - (v - ymin) / (ymax - ymin) * (yb - yt), bw = (x1 - x0) / n, X = t => x0 + (t + 0.5) * bw;
    let b = '';
    ticks(ymin, ymax, 5).forEach(v => { b += `<line x1="${x0}" y1="${f1(Y(v))}" x2="${x1}" y2="${f1(Y(v))}" class="${v === 0 ? 's-mute' : 'grid'}"/>` + T(x0 - 6, Y(v) + 5, fmtK(v), 'mu', 'end'); });
    cf.forEach((z, t) => { const y0 = Y(0), y1 = Y(z); b += `<rect x="${f1(X(t) - bw * 0.32)}" y="${f1(Math.min(y0, y1))}" width="${f1(bw * 0.64)}" height="${f1(Math.max(1, Math.abs(y1 - y0)))}" class="${z < 0 ? 'f-bad' : 'f-acc'} bar"><title>${esc('Jahr ' + t + ': ' + C.eur(z, 0))}</title></rect>` + T(X(t), yb + 22, String(t), 'mu', 'middle'); });
    b += `<polyline points="${cum.map((v, t) => f1(X(t)) + ',' + f1(Y(v))).join(' ')}" class="s-ok line" fill="none"/>` + cum.map((v, t) => `<circle cx="${f1(X(t))}" cy="${f1(Y(v))}" r="4" class="f-ok dot"/>`).join('');
    b += T((x0 + x1) / 2, h - 4, 'Jahr  ·  Balken: Zahlung  ·  Linie: kumulierter Barwert', 'mu', 'middle');
    return svg(w, h, 'Zahlungen je Jahr und kumulierter Barwert, Endwert ' + C.eur(cum[n - 1], 0), b);
  }
  /* Tornado: Änderung des Kapitalwerts bei +/- Änderung der Eingaben */
  function tornado(items, base, w) {
    const rh = 38, top = 8, lw = Math.min(160, Math.max(110, w * 0.42)), x0 = lw + 8, x1 = w - 12, vals = [0].concat([].concat.apply([], items.map(it => [it.lo - base, it.hi - base])).filter(fin)), lim = Math.max(1, Math.max.apply(null, vals.map(Math.abs))), cx = (x0 + x1) / 2, sc = (x1 - x0) / 2 / lim * 0.84, h = top + items.length * rh + 30;
    let b = `<line x1="${f1(cx)}" y1="${top - 2}" x2="${f1(cx)}" y2="${top + items.length * rh}" class="s-mute"/>`;
    items.forEach((it, k) => {
      const y = top + k * rh, lo = it.lo - base, hi = it.hi - base;
      b += T(4, y + rh / 2 + 5, it.label) ;
      [[lo, 'f-bad'], [hi, 'f-ok']].forEach(([d, c]) => { if (!fin(d)) return; b += `<rect x="${f1(Math.min(cx, cx + d * sc))}" y="${y + 6}" width="${f1(Math.max(1.5, Math.abs(d * sc)))}" height="${rh - 12}" class="${c}"><title>${esc(it.label + ': Kapitalwert ' + C.fmtDe(base + d, 0, true) + ' €')}</title></rect>`; });
    });
    b += T(cx, h - 6, 'Änderung des Kapitalwerts in €  (grün: besser, rot: schlechter)', 'mu', 'middle');
    return svg(w, h, 'Sensitivität: Wirkung von Änderungen auf den Kapitalwert', b);
  }

  /* ============================================================ Risikomatrix, RPZ, Pareto */
  function riskMatrix(risks, w) {
    const lab = 30, cs = Math.max(44, Math.min(70, Math.floor((w - lab - 8) / 5))), gw = cs * 5, h = gw + 62; let b = '';
    for (let p = 5; p >= 1; p--) for (let s = 1; s <= 5; s++) {
      const z = C.riskScore(p, s), cl = C.riskClass(z).id, x = lab + (s - 1) * cs, y = 6 + (5 - p) * cs;
      b += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" class="rk-${cl}"><title>${esc('P ' + p + ' · S ' + s + ' = ' + z + ' (' + cl + ')')}</title></rect>` + T(x + 4, y + 16, String(z), 'rkn');
    }
    for (let k = 1; k <= 5; k++) { b += T(lab - 8, 6 + (5 - k) * cs + cs / 2 + 5, String(k), 'mu', 'end') + T(lab + (k - 1) * cs + cs / 2, 6 + gw + 20, String(k), 'mu', 'middle'); }
    b += T(lab + gw / 2, 6 + gw + 42, 'Schaden S →', 'mu', 'middle');
    b += `<text transform="translate(10 ${6 + gw / 2}) rotate(-90)" class="mu" text-anchor="middle">Wahrscheinlichkeit P →</text>`;
    const cellCount = {};
    risks.forEach((r, k) => {
      if (!(r.p >= 1 && r.p <= 5 && r.s >= 1 && r.s <= 5)) return; const key = r.p + '_' + r.s, c = cellCount[key] = (cellCount[key] || 0) + 1, cx = lab + (r.s - 1) * cs + cs / 2 + ((c - 1) % 2 ? 11 : -11) * (c > 1 ? 1 : 0), cy = 6 + (5 - r.p) * cs + cs / 2 + (c > 2 ? 12 : c > 1 ? 0 : 6);
      b += `<g class="rdot"><circle cx="${f1(cx)}" cy="${f1(cy)}" r="12" class="dotbg"/>` + T(cx, cy + 5, String(k + 1), 'b', 'middle') + `<title>${esc((k + 1) + ' ' + r.name)}</title></g>`;
    });
    return svg(lab + gw + 6, h, 'Risikomatrix 5 mal 5 mit ' + risks.length + ' Risiken', b);
  }
  function rpzBars(items, grenze, w) {
    const rh = 36, top = 8, lw = Math.min(170, Math.max(110, w * 0.45)), x0 = lw + 8, x1 = w - 40, mx = Math.max(grenze * 1.2, Math.max.apply(null, items.map(i => i.rpz).filter(fin)) * 1.05, 10), X = v => x0 + v / mx * (x1 - x0), h = top + items.length * rh + 12; let b = '';
    items.forEach((it, k) => { const y = top + k * rh; b += T(4, y + rh / 2 + 5, cut(it.name, 20)); if (fin(it.rpz)) b += `<rect x="${x0}" y="${y + 6}" width="${f1(Math.max(2, X(it.rpz) - x0))}" height="${rh - 12}" rx="3" class="${it.over ? 'f-bad' : 'f-acc'}"/>` + T(X(it.rpz) + 6, y + rh / 2 + 5, String(it.rpz), 'b'); });
    b += `<line x1="${f1(X(grenze))}" y1="${top - 4}" x2="${f1(X(grenze))}" y2="${top + items.length * rh}" class="s-warn" stroke-dasharray="5 4"/>`;
    return svg(w, h, 'Risikoprioritätszahlen, absteigend sortiert, Grenzwert ' + grenze, b);
  }
  function paretoChart(p, w) {
    const h = Math.round(Math.min(300, Math.max(230, w * 0.62))), padT = 14, padB = 40, x0 = 44, x1 = w - 40, yb = h - padB, yt = padT, n = p.items.length, bw = (x1 - x0) / n, mx = Math.max.apply(null, p.items.map(i => i.v)), Y = v => yb - v / mx * (yb - yt), YC = c => yb - c / 100 * (yb - yt), X = k => x0 + (k + 0.5) * bw;
    let b = '';
    [0, 50, 100].forEach(c => { b += `<line x1="${x0}" y1="${f1(YC(c))}" x2="${x1}" y2="${f1(YC(c))}" class="grid"/>` + T(x1 + 6, YC(c) + 5, c + ' %', 'mu'); });
    b += `<line x1="${x0}" y1="${f1(YC(80))}" x2="${x1}" y2="${f1(YC(80))}" class="s-warn" stroke-dasharray="5 4"/>` + T(x0 + 4, YC(80) - 5, '80 %', 'mu');
    ticks(0, mx, 4).forEach(v => { b += T(x0 - 6, Y(v) + 5, N(v, 0), 'mu', 'end'); });
    p.items.forEach((it, k) => { b += `<rect x="${f1(X(k) - bw * 0.34)}" y="${f1(Y(it.v))}" width="${f1(bw * 0.68)}" height="${f1(Math.max(1, yb - Y(it.v)))}" class="cl-${it.cls}"><title>${esc(it.label + ': ' + it.v + ' (' + N(it.share, 1) + ' %), kumuliert ' + N(it.cum, 1) + ' %, Klasse ' + it.cls)}</title></rect>` + T(X(k), yb + 20, String(k + 1), 'mu', 'middle'); });
    b += `<polyline points="${p.items.map((it, k) => f1(X(k)) + ',' + f1(YC(it.cum))).join(' ')}" class="s-ink line" fill="none"/>` + p.items.map((it, k) => `<circle cx="${f1(X(k))}" cy="${f1(YC(it.cum))}" r="4" class="f-ink dot"/>`).join('');
    b += T((x0 + x1) / 2, h - 4, 'Ursache (Nummer)  ·  Balken: Anzahl  ·  Linie: kumuliert', 'mu', 'middle');
    return svg(w, h, 'Pareto-Diagramm mit ' + n + ' Ursachen, ' + p.nA + ' in Klasse A', b);
  }

  /* ============================================================ Seitenbudget und Ablaufbild */
  function pagesBar(chapters, whole, w) {
    const tot = whole.reduce((s, x) => s + x, 0) || 1, bw = w - 12, h = 56; let x = 6, b = '';
    chapters.forEach((c, k) => { const sw = whole[k] / tot * bw; b += `<rect x="${f1(x)}" y="8" width="${f1(Math.max(0, sw))}" height="38" class="s${(k % 6) + 1}"><title>${esc(c.n + ': ' + whole[k] + ' Seiten')}</title></rect>`; if (sw > 22) b += T(x + sw / 2, 33, String(whole[k]), 'on b', 'middle'); x += sw; });
    return svg(w, h, 'Seitenverteilung auf ' + chapters.length + ' Kapitel, insgesamt ' + tot + ' Seiten', b);
  }
  function lhFlow(w) {
    const steps = [['Auftraggeber', 'Lastenheft', 'WAS und WOFÜR'], ['Auftragnehmer', 'Pflichtenheft', 'WIE und WOMIT'], ['Umsetzung', 'Entwurf, Bau, Test', 'nach Pflichtenheft'], ['Abnahme', 'Prüfung', 'gegen die Anforderungen']], horiz = w >= 640, bw = horiz ? (w - 12 - 3 * 28) / 4 : Math.min(w - 12, 360), bh = 74, gap = 28, h = horiz ? bh + 20 : 4 * bh + 3 * gap + 12, mx = horiz ? 6 : (w - bw) / 2;
    let b = `<defs><marker id="lha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" class="f-mute"/></marker></defs>`;
    steps.forEach((s, k) => {
      const x = horiz ? 6 + k * (bw + gap) : mx, y = horiz ? 8 : 6 + k * (bh + gap), cls = k < 2 ? 'lhb hl' : 'lhb';
      b += `<rect x="${f1(x)}" y="${y}" width="${f1(bw)}" height="${bh}" rx="10" class="${cls}"/>` + T(x + bw / 2, y + 20, s[0], 'mu', 'middle') + T(x + bw / 2, y + 42, s[1], 'b', 'middle') + T(x + bw / 2, y + 62, s[2], '', 'middle');
      if (k < 3) b += horiz ? `<path d="M${f1(x + bw + 3)} ${y + bh / 2}H${f1(x + bw + gap - 4)}" class="s-mute" marker-end="url(#lha)"/>` : `<path d="M${f1(x + bw / 2)} ${y + bh + 3}V${y + bh + gap - 4}" class="s-mute" marker-end="url(#lha)"/>`;
    });
    return svg(w, h, 'Ablauf: Lastenheft des Auftraggebers, Pflichtenheft des Auftragnehmers, Umsetzung, Abnahme', b);
  }

  root.PRJ_VIZ = { layout, netzplan, gantt, breakeven, priceBar, npvCurve, cfBars, tornado, riskMatrix, rpzBars, paretoChart, pagesBar, lhFlow, niceStep, ticks };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PRJ_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
