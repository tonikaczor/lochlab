'use strict';
/* Tonfunk Algorithmen-Lab: Visualisierungen (window.ALG_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   - trace(res, idx):  zum Programmablauf des Editors (Ergebnis von ALG_CORE.run mit trace): "Wo steht das Programm?" (Zeile über Schritt, Schleifen
                       werden zu Zickzack-Mustern), Variablenverlauf (Treppenkurven) und das erste Zahlenfeld als Balken mit hervorgehobenen Änderungen
   - legend():         Symbole von Programmablaufplan und Struktogramm (dieselben Formen wie die Zeichner in algcore.js)
   - sortSteps / searchSteps / mount(el): eigener Reiter "Sortieren und Suchen": Bubble-, Selection-, Insertion-Sort sowie lineare und binäre Suche
                       Schritt für Schritt als Balken (Vergleiche, Tausche, sortierter Bereich, Suchbereich) mit Zählern und Aufwandsvergleich
   Nichts hier berechnet Aufgabenlösungen; die Aufgaben des Labs sind nicht angebunden. Farben nur über die CSS-Variablen der Seite.
   Keine Animation (Schritte schaltet die Person selbst weiter; Autoplay nur ohne prefers-reduced-motion). Aufruf-Stellen: algui.js (Hooks). */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  const W = 340;
  const num = v => { if (typeof v !== 'number' || !fin(v)) return ''; let s = (Math.round(v * 1e4) / 1e4).toString(); if (/e/i.test(s)) s = v.toFixed(2); return s.replace('.', ','); };
  const CSS = `.av{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 10px 8px;margin:8px 0}
.av h5{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.av svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.av svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg);font-size:12px}
.av .m{fill:var(--mute)!important}.av .b{font-weight:700}.av .sm{font-size:10.5px}
.av .axl{stroke:var(--line);stroke-width:1}.av .pth{fill:none;stroke:var(--accent);stroke-width:1.6;stroke-linejoin:round}.av .pthf{fill:none;stroke:var(--accent);stroke-width:1.6;opacity:.3}
.av .cur{stroke:var(--hi);stroke-width:1.6}.av .curd{fill:var(--hi)}
.av .bar{fill:var(--accent);opacity:.5}.av .barc{fill:var(--hi)}.av .bars{fill:var(--accent)}.av .barf{fill:var(--ok);opacity:.85}.av .bard{fill:var(--accent);opacity:.14}
.av .barg{fill:none;stroke:var(--mute);stroke-width:1.3;stroke-dasharray:3 3}.av .barx{fill:var(--work);stroke:var(--hi);stroke-width:2}
.av .rng{fill:var(--accent);opacity:.12}
.av-note{margin:6px 0 0;font-size:12.5px;color:var(--mute);line-height:1.4}
.av-ctl{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}.av-ctl label{flex:1 1 140px;display:block}.av-ctl label span{display:block;font-size:12px;color:var(--mute);margin-bottom:3px}
.av-btns{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.av-btns .btn{flex:1 1 70px;min-width:60px;padding:0 8px}
.av-st{display:flex;gap:8px;margin:8px 0}.av-st .bx{flex:1;text-align:center;font-size:12px;color:var(--mute);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:6px 2px}.av-st .bx b{display:block;font-size:20px;color:var(--fg)}
.av-msg{background:var(--bg);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:8px 12px;margin:8px 0;font-size:14px;line-height:1.45;min-height:44px}
.av-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--mute);margin:4px 0 0}.av-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
@media (prefers-reduced-motion:reduce){.av [data-av=auto]{display:none}}`;
  function css() { try { if (typeof document === 'undefined' || document.getElementById('avCss')) return; const s = document.createElement('style'); s.id = 'avCss'; s.textContent = CSS; document.head.appendChild(s); } catch (e) {} }
  css();
  const wrap = (title, body, note) => `<div class="av"><h5>${esc(title)}</h5>${body}${note ? `<p class="av-note">${note}</p>` : ''}</div>`;
  const svgOf = (h, label, body, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${W} ${f(h)}" role="img" aria-label="${esc(label)}">${body}</svg>`;

  /* ============================================================ Ablauf-Bilder zum Editor */
  /* res = Ergebnis von ALG_CORE.run(..., {trace:true}); idx = Schritt-Index des Cursors (-1: kein Cursor, alles gleich hell) */
  function lineChart(tr, idx) {
    const n = tr.length, lines = tr.map(e => e.line).filter(fin); if (!lines.length) return '';
    const lo = Math.min.apply(null, lines), hi = Math.max.apply(null, lines), rows = hi - lo + 1, ph = Math.min(150, Math.max(44, rows * 9)), x0 = 40, x1 = W - 10, top = 10;
    const X = i => x0 + (n <= 1 ? 0 : i / (n - 1) * (x1 - x0)), Y = l => top + (rows <= 1 ? ph / 2 : (l - lo) / (hi - lo) * ph), stride = Math.max(1, Math.ceil(n / 280));
    const pts = []; for (let i = 0; i < n; i += stride) pts.push(i); if (pts[pts.length - 1] !== n - 1) pts.push(n - 1);
    const seg = (a, b) => pts.filter(i => i >= a && i <= b).map((i, k) => (k ? 'L' : 'M') + f(X(i)) + ' ' + f(Y(tr[i].line))).join(' ');
    let s = `<line class="axl" x1="${x0}" y1="${top + ph + 8}" x2="${x1}" y2="${top + ph + 8}"/><text class="m sm" x="${x0}" y="${top + ph + 21}">Schritt 1</text><text class="m sm" x="${x1}" y="${top + ph + 21}" text-anchor="end">Schritt ${n}</text>`;
    [lo, hi].concat(rows > 2 ? [Math.round((lo + hi) / 2)] : []).forEach(l => { s += `<line class="axl" x1="${x0 - 4}" y1="${f(Y(l))}" x2="${x0}" y2="${f(Y(l))}"/><text class="m sm" x="${x0 - 7}" y="${f(Y(l) + 3.5)}" text-anchor="end">Z. ${l}</text>`; });
    if (idx >= 0 && idx < n - 1) s += `<path class="pth" d="${seg(0, idx)}"/><path class="pthf" d="${seg(idx, n - 1)}"/>`; else s += `<path class="pth" d="${seg(0, n - 1)}"/>`;
    if (idx >= 0 && idx < n) s += `<line class="cur" x1="${f(X(idx))}" y1="${top - 4}" x2="${f(X(idx))}" y2="${top + ph + 8}"/><circle class="curd" cx="${f(X(idx))}" cy="${f(Y(tr[idx].line))}" r="4"/>`;
    return wrap('Wo steht das Programm?', svgOf(top + ph + 28, 'Zeilennummer über den Schritten: Schleifen erscheinen als wiederkehrendes Muster', s),
      'Nach oben geht es zu kleineren, nach unten zu größeren Zeilennummern. Eine Schleife zeigt sich als Muster, das sich wiederholt; die Anzahl der Wiederholungen siehst du an der Länge.');
  }
  function series(tr) {
    const main = tr.filter(e => !e.depth), names = [], by = {};
    main.forEach((e, k) => Object.keys(e.vars).forEach(nm => { if (typeof e.vars[nm] === 'number' && fin(e.vars[nm])) { if (!by[nm]) { by[nm] = []; names.push(nm); } by[nm].push([e.n, e.vars[nm], k]); } }));
    return { names, by, main };
  }
  function varCharts(tr, idx) {
    const { names, by } = series(tr); if (!names.length) return '';
    const shown = names.slice(0, 5), n = tr.length, x0 = 8, x1 = W - 70, rh = 52, nmax = tr[tr.length - 1].n || n;
    let s = ''; let any = false;
    shown.forEach((nm, r) => {
      const pts = by[nm], vs = pts.map(p => p[1]), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), y0 = r * rh + 20, ph = 26, flat = hi === lo;
      const X = st => x0 + (nmax <= 1 ? 0 : (st - 1) / (nmax - 1) * (x1 - x0)), Y = v => y0 + (flat ? ph / 2 : (hi - v) / (hi - lo) * ph);
      const curStep = idx >= 0 && idx < n ? tr[idx].n : null; let d1 = '', d2 = '', last = null;
      pts.forEach(p => { const x = X(p[0]), y = Y(p[1]); const past = curStep === null || p[0] <= curStep; const seg = (past ? 'a' : 'b');
        if (last) { const hv = 'H' + f(x) + 'V' + f(y); if (last.past && !past) { d1 += 'H' + f(x); d2 += 'M' + f(X(last.st)) + ' ' + f(last.y) + 'H' + f(x) + 'V' + f(y); } else if (past) d1 += hv; else d2 += hv; }
        else { if (past) d1 += 'M' + f(x) + ' ' + f(y); else d2 += 'M' + f(x) + ' ' + f(y); }
        last = { st: p[0], y, past, seg }; });
      if (last) { const xe = X(nmax); if (last.past && curStep === null) d1 += 'H' + f(xe); else if (last.past && curStep !== null && curStep >= pts[pts.length - 1][0]) d1 += 'H' + f(Math.min(xe, X(curStep))); }
      const cv = curStep === null ? null : (pts.filter(p => p[0] <= curStep).pop() || null);
      s += `<text class="b sm" x="${x0}" y="${y0 - 8}">${esc(nm)}</text><text class="m sm" x="${x0 + 28}" y="${y0 - 8}">${cv ? 'jetzt ' + esc(num(cv[1])) : curStep === null ? 'Endwert ' + esc(num(vs[vs.length - 1])) : 'noch ohne Wert'}</text>`;
      s += `<line class="axl" x1="${x0}" y1="${y0 + ph + 3}" x2="${x1}" y2="${y0 + ph + 3}"/>`;
      if (d1) s += `<path class="pth" d="${d1}"/>`; if (d2) s += `<path class="pthf" d="${d2}"/>`;
      if (curStep !== null) s += `<line class="cur" x1="${f(X(curStep))}" y1="${y0 - 2}" x2="${f(X(curStep))}" y2="${y0 + ph + 3}"/>`;
      s += `<text class="m sm" x="${W - 8}" y="${y0 + 7}" text-anchor="end">max ${esc(num(hi))}</text><text class="m sm" x="${W - 8}" y="${y0 + ph}" text-anchor="end">min ${esc(num(lo))}</text>`; any = true;
    });
    if (!any) return '';
    return wrap('Variablen im Verlauf', svgOf(shown.length * rh + 14, 'Verlauf der Zahlenvariablen ' + shown.join(', ') + ' über die Schritte', s), (names.length > shown.length ? 'Gezeigt werden die ersten ' + shown.length + ' Zahlenvariablen. ' : '') + 'Jede Kurve ist eine Treppe: Sie springt, wenn die Variable einen neuen Wert bekommt. Orange: der aktuelle Schritt, blass: noch nicht erreicht.');
  }
  function arrBars(tr, idx) {
    const main = tr.map((e, i) => [e, i]).filter(x => !x[0].depth); let name = null;
    for (const x of main) { for (const k of Object.keys(x[0].vars)) { const v = x[0].vars[k]; if (Array.isArray(v) && v.length && v.length <= 24 && v.every(q => typeof q === 'number' && fin(q))) { name = k; break; } } if (name) break; }
    if (!name) return '';
    const pos = idx >= 0 && idx < tr.length ? idx : tr.length - 1; let e = tr[pos]; if (e.depth || !Array.isArray(e.vars[name])) { const alt = main.filter(x => x[1] <= pos && Array.isArray(x[0].vars[name])).pop(); if (!alt) return ''; e = alt[0]; }
    const a = e.vars[name], pe = tr[Math.max(0, tr.indexOf(e) - 1)], prev = pe && Array.isArray(pe.vars[name]) && pe.vars[name].length === a.length ? pe.vars[name] : null;
    return wrap('Feld ' + name + (idx >= 0 ? ' im aktuellen Schritt' : ' (Endzustand)'), bars(a, { chg: a.map((v, i) => (prev && prev[i] !== v ? i : -1)).filter(i => i >= 0), cls: {} }), 'Orange: Elemente, die sich im letzten Schritt geändert haben. Die Höhe der Balken entspricht dem Wert.');
  }
  function trace(res, idx) {
    try {
      if (!res || !Array.isArray(res.trace) || res.trace.length < 2) return ''; css(); const tr = res.trace;
      if (!tr.every(e => e && fin(e.line) && e.vars)) return '';
      return lineChart(tr, idx) + varCharts(tr, idx) + arrBars(tr, idx);
    } catch (e) { return ''; }
  }

  /* ============================================================ Balken (Feld) */
  /* o: { c:[idx] verglichen, sw:[idx] getauscht, fin:[a,b] fertig (inklusive), lo, hi, mid, found, hole, key:{v}, chg:[idx], dim:[a,b] ausgeschlossen } */
  function bars(a, o) {
    o = o || {}; const n = a.length; if (!n) return '';
    const vs = a.concat(o.key ? [o.key.v] : []), mn = Math.min.apply(null, vs.concat([0])), mx = Math.max.apply(null, vs.concat([1])), span = mx - mn || 1;
    const top = 26, H = 118, base = top + H + 4, bw = (W - 20) / n, gap = Math.min(4, bw * .2), has = (arr, i) => arr && arr.indexOf(i) >= 0;
    const hOf = v => Math.max(3, (v - mn) / span * H), inFin = i => o.fin && i >= o.fin[0] && i <= o.fin[1], inDim = i => o.dim && i >= o.dim[0] && i <= o.dim[1], outRng = i => o.lo !== undefined && (i < o.lo || i > o.hi);
    let s = '';
    if (o.lo !== undefined && o.hi >= o.lo) s += `<rect class="rng" x="${f(10 + o.lo * bw)}" y="${top - 6}" width="${f((o.hi - o.lo + 1) * bw)}" height="${H + 14}" rx="6"/>`;
    for (let i = 0; i < n; i++) {
      const x = 10 + i * bw + gap / 2, w = Math.max(2, bw - gap), h = hOf(a[i]), y = base - h;
      let cls = 'bar'; if (i === o.found) cls = 'barf'; else if (has(o.sw, i)) cls = 'bars'; else if (has(o.c, i) || i === o.mid) cls = 'barc'; else if (inFin(i)) cls = 'barf'; else if (inDim(i) || outRng(i)) cls = 'bard'; else if (has(o.chg, i)) cls = 'barc';
      if (o.hole === i) s += `<rect class="barg" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="3"/>`; else s += `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="3"/>`;
      if (o.hole !== i && (n <= 14 || bw >= 17)) s += `<text class="sm b" x="${f(x + w / 2)}" y="${f(y - 4)}" text-anchor="middle">${esc(clip(num(a[i]), 5))}</text>`;
      s += `<text class="m sm" x="${f(x + w / 2)}" y="${base + 13}" text-anchor="middle">${i}</text>`;
    }
    if (o.key && o.hole !== undefined) { const x = 10 + o.hole * bw + gap / 2, w = Math.max(2, bw - gap), h = hOf(o.key.v), y = Math.max(8, base - h - 18); s += `<rect class="barx" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(Math.min(h, base - y - 2))}" rx="3"/><text class="sm b" x="${f(x + w / 2)}" y="${f(y - 4)}" text-anchor="middle">${esc(clip(num(o.key.v), 5))}</text>`; }
    if (o.sw && o.sw.length === 2) { const xa = 10 + o.sw[0] * bw + bw / 2, xb = 10 + o.sw[1] * bw + bw / 2; s += `<path d="M${f(xa)} 14 H${f(xb)} m-5 -4 l5 4 l-5 4 M${f(xa)} 14 m5 -4 l-5 4 l5 4" fill="none" stroke="var(--accent)" stroke-width="1.6"/>`; }
    if (o.mid !== undefined) s += `<text class="b sm" x="${f(10 + o.mid * bw + bw / 2)}" y="12" text-anchor="middle" style="fill:var(--hi)">Mitte</text>`;
    return svgOf(base + 22, 'Balkendiagramm des Feldes: ' + a.map(num).join(', '), s);
  }

  /* ============================================================ Schritt-Erzeuger (Sortieren, Suchen) */
  function sortSteps(kind, arr) {
    const a = arr.slice(), n = a.length, st = []; let cmp = 0, mov = 0;
    const push = (msg, o) => st.push(Object.assign({ a: a.slice(), cmp, mov, msg }, o || {}));
    push('Startzustand: Das Feld ist noch unsortiert.');
    if (n >= 2 && kind === 'bubble') {
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1 - i; j++) {
          cmp++; const sw = a[j] > a[j + 1];
          push('Vergleiche a[' + j + '] = ' + num(a[j]) + ' mit a[' + (j + 1) + '] = ' + num(a[j + 1]) + ': ' + (sw ? 'Falsche Reihenfolge, die beiden werden getauscht.' : 'Die Reihenfolge stimmt, nichts passiert.'), { c: [j, j + 1], fin: n - i < n ? [n - i, n - 1] : null });
          if (sw) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; mov++; push('Getauscht: ' + num(a[j]) + ' steht jetzt links von ' + num(a[j + 1]) + '.', { sw: [j, j + 1], fin: n - i < n ? [n - i, n - 1] : null }); }
        }
        push('Durchlauf ' + (i + 1) + ' fertig: ' + num(a[n - 1 - i]) + ' steht an seinem endgültigen Platz (rechts).', { fin: [n - 1 - i, n - 1] });
      }
      push('Fertig: Das Feld ist sortiert.', { fin: [0, n - 1] });
    } else if (n >= 2 && kind === 'selection') {
      for (let i = 0; i < n - 1; i++) {
        let m = i; push('Durchlauf ' + (i + 1) + ': Das kleinste Element ab Index ' + i + ' wird gesucht. Vorerst ist es a[' + i + '] = ' + num(a[i]) + '.', { c: [m], fin: i ? [0, i - 1] : null });
        for (let j = i + 1; j < n; j++) { cmp++; const less = a[j] < a[m]; push('Vergleiche a[' + j + '] = ' + num(a[j]) + ' mit dem bisher Kleinsten a[' + m + '] = ' + num(a[m]) + ': ' + (less ? 'Neues Kleinstes gefunden.' : 'Das Kleinste bleibt.'), { c: [j, m], fin: i ? [0, i - 1] : null }); if (less) m = j; }
        if (m !== i) { const t = a[i]; a[i] = a[m]; a[m] = t; mov++; push('Das Kleinste (' + num(a[i]) + ') wird mit a[' + m + '] getauscht und steht nun an Index ' + i + '.', { sw: [i, m], fin: [0, i] }); } else push(num(a[i]) + ' steht schon richtig, es wird nicht getauscht.', { fin: [0, i] });
      }
      push('Fertig: Das Feld ist sortiert.', { fin: [0, n - 1] });
    } else if (n >= 2 && kind === 'insertion') {
      for (let i = 1; i < n; i++) {
        const key = a[i]; let j = i - 1;
        push('Das nächste Element ' + num(key) + ' (Index ' + i + ') wird herausgenommen und in den sortierten Teil links eingefügt.', { key: { v: key }, hole: i, fin: [0, i - 1] });
        while (j >= 0) {
          cmp++; const gt = a[j] > key;
          push('Vergleiche a[' + j + '] = ' + num(a[j]) + ' mit ' + num(key) + ': ' + (gt ? 'größer, also eine Stelle nach rechts schieben.' : 'nicht größer, hier ist der Platz.'), { c: [j], key: { v: key }, hole: j + 1, fin: [0, i - 1] });
          if (!gt) break; a[j + 1] = a[j]; mov++;
          push(num(a[j + 1]) + ' ist nach rechts gerutscht, die Lücke wandert nach links.', { key: { v: key }, hole: j, fin: [0, i - 1] }); j--;
        }
        a[j + 1] = key; push(num(key) + ' wird an Index ' + (j + 1) + ' eingefügt. Die Elemente 0 bis ' + i + ' sind jetzt sortiert.', { fin: [0, i], chg: [j + 1] });
      }
      push('Fertig: Das Feld ist sortiert.', { fin: [0, n - 1] });
    } else push(n < 2 ? 'Mit weniger als zwei Elementen gibt es nichts zu sortieren.' : 'Unbekanntes Verfahren.', { fin: n ? [0, n - 1] : null });
    return st;
  }
  const isSorted = a => a.every((v, i) => !i || a[i - 1] <= v);
  function searchSteps(kind, arr, t) {
    let a = arr.slice(); const n = a.length, st = []; let cmp = 0; const pre = [];
    if (kind === 'binary' && !isSorted(a)) { a = a.slice().sort((x, y) => x - y); pre.push('Die binäre Suche braucht ein sortiertes Feld. Darum wird das Feld hier zuerst aufsteigend sortiert gezeigt.'); }
    const push = (msg, o) => st.push(Object.assign({ a: a.slice(), cmp, mov: 0, msg }, o || {}));
    push((pre[0] ? pre[0] + ' ' : '') + 'Gesucht wird ' + num(t) + '.', kind === 'binary' ? { lo: 0, hi: n - 1 } : {});
    if (!n) { push('Das Feld ist leer.'); return st; }
    if (kind === 'linear') {
      for (let i = 0; i < n; i++) {
        cmp++; const eq = a[i] === t;
        push('Vergleiche a[' + i + '] = ' + num(a[i]) + ' mit ' + num(t) + ': ' + (eq ? 'gleich, gefunden!' : 'nicht gleich, weiter zum nächsten.'), eq ? { c: [i], found: i } : { c: [i], dim: i ? [0, i - 1] : null });
        if (eq) return st;
      }
      push(num(t) + ' kommt im Feld nicht vor (alle ' + n + ' Elemente verglichen).', { dim: [0, n - 1] });
    } else {
      let l = 0, r = n - 1;
      while (l <= r) {
        const mid = Math.floor((l + r) / 2); cmp++;
        const eq = a[mid] === t, less = a[mid] < t;
        push('Suchbereich Index ' + l + ' bis ' + r + '. Die Mitte ist Index ' + mid + ' mit a[' + mid + '] = ' + num(a[mid]) + '. ' + (eq ? 'Das ist der gesuchte Wert: gefunden!' : less ? num(a[mid]) + ' ist kleiner als ' + num(t) + ': Der gesuchte Wert kann nur rechts liegen.' : num(a[mid]) + ' ist größer als ' + num(t) + ': Der gesuchte Wert kann nur links liegen.'), eq ? { lo: l, hi: r, mid, found: mid } : { lo: l, hi: r, mid });
        if (eq) return st; if (less) l = mid + 1; else r = mid - 1;
      }
      push('Der Suchbereich ist leer (l > r): ' + num(t) + ' kommt im Feld nicht vor.', { lo: 0, hi: -1, dim: [0, n - 1] });
    }
    return st;
  }

  /* ============================================================ Reiter "Sortieren und Suchen" */
  const ALGOS = [['bubble', 'Bubble-Sort', 'sort'], ['selection', 'Selection-Sort', 'sort'], ['insertion', 'Insertion-Sort', 'sort'], ['linear', 'Lineare Suche', 'search'], ['binary', 'Binäre Suche', 'search']];
  const MAXN = 16;
  function parseList(s) {
    const parts = String(s == null ? '' : s).split(/[\s;]+/).filter(Boolean); if (!parts.length || parts.length > MAXN) return null;
    const out = []; for (const p of parts) { const v = Number(p.replace(',', '.')); if (!fin(v) || Math.abs(v) > 9999 || !/^[+-]?\d*[.,]?\d+$/.test(p)) return null; out.push(v); }
    return out;
  }
  function compare(arr) {
    return ['bubble', 'selection', 'insertion'].map(k => { const st = sortSteps(k, arr), l = st[st.length - 1]; return { k, name: ALGOS.find(x => x[0] === k)[1], cmp: l.cmp, mov: l.mov }; });
  }
  function stepsFor(S) {
    const a = parseList(S.list); if (!a) return null;
    const algo = ALGOS.find(x => x[0] === S.algo) || ALGOS[0];
    if (algo[2] === 'sort') return { a, st: sortSteps(algo[0], a), algo };
    const t = Number(String(S.target).replace(',', '.')); if (!fin(t) || String(S.target).trim() === '') return { a, st: null, algo, badTarget: true };
    return { a, st: searchSteps(algo[0], a, t), algo };
  }
  function viewHtml(S) {
    const R = stepsFor(S); let h = '';
    const opts = ALGOS.map(x => `<option value="${x[0]}"${x[0] === S.algo ? ' selected' : ''}>${esc(x[1])}</option>`).join('');
    const search = (ALGOS.find(x => x[0] === S.algo) || ALGOS[0])[2] === 'search';
    h += `<div class="card pl"><h4>Sortieren und Suchen Schritt für Schritt</h4><div class="av-ctl"><label><span>Verfahren</span><select data-av="algo">${opts}</select></label>${search ? `<label><span>Gesuchter Wert</span><input data-av="target" inputmode="decimal" autocomplete="off" value="${esc(S.target)}"></label>` : ''}</div>
      <label class="f"><span>Zahlen (bis ${MAXN}, mit Leerzeichen getrennt)</span><input data-av="list" inputmode="decimal" autocomplete="off" value="${esc(S.list)}"></label>
      <div class="av-ctl" style="margin:0"><button class="chip s" data-av="pre" data-v="std">5 2 4 1 3</button><button class="chip s" data-av="pre" data-v="rand">🎲 Zufall</button><button class="chip s" data-av="pre" data-v="asc">aufsteigend</button><button class="chip s" data-av="pre" data-v="desc">absteigend</button><button class="chip s" data-av="pre" data-v="dup">mit Doppelten</button></div></div>`;
    if (!R) return h + `<div class="rdout warn">Bitte gib 1 bis ${MAXN} Zahlen ein, getrennt durch Leerzeichen (Dezimalkomma ist erlaubt, Beträge bis 9999).</div>`;
    if (R.badTarget) return h + `<div class="rdout warn">Bitte gib den gesuchten Wert als Zahl ein.</div>`;
    const st = R.st, i = Math.max(0, Math.min(S.i, st.length - 1)), c = st[i], last = i === st.length - 1;
    S.i = i;
    h += `<div class="av"><h5>${esc(R.algo[1])}</h5>${bars(c.a, c)}<div class="av-leg"><span><i style="background:var(--accent);opacity:.5"></i>unbearbeitet</span><span><i style="background:var(--hi)"></i>wird verglichen</span>${R.algo[2] === 'sort' ? '<span><i style="background:var(--accent)"></i>gerade getauscht</span><span><i style="background:var(--ok)"></i>endgültig sortiert</span>' : '<span><i style="background:var(--ok)"></i>gefunden</span><span><i style="background:var(--accent);opacity:.14"></i>ausgeschlossen</span>'}</div>
      <div class="av-st"><div class="bx"><b>${i + 1}/${st.length}</b>Schritt</div><div class="bx"><b>${c.cmp}</b>Vergleiche</div>${R.algo[2] === 'sort' ? `<div class="bx"><b>${c.mov}</b>${R.algo[0] === 'insertion' ? 'Verschiebungen' : 'Tausche'}</div>` : ''}</div>
      <div class="av-msg" role="status" aria-live="polite">${esc(c.msg)}</div>
      <div class="av-btns"><button class="btn" data-av="first" ${i === 0 ? 'disabled' : ''} aria-label="Zum Anfang">⏮</button><button class="btn" data-av="prev" ${i === 0 ? 'disabled' : ''}>◀ Zurück</button><button class="btn pri" data-av="next" ${last ? 'disabled' : ''}>Weiter ▶</button><button class="btn" data-av="end" ${last ? 'disabled' : ''} aria-label="Zum Ende">⏭</button><button class="btn" data-av="auto" ${last ? 'disabled' : ''}>${S.playing ? '⏸ Pause' : '▶ Auto'}</button></div></div>`;
    if (R.algo[2] === 'sort') {
      const cmpd = compare(R.a), mx = Math.max.apply(null, cmpd.map(x => x.cmp).concat([1])), mm = Math.max.apply(null, cmpd.map(x => x.mov).concat([1]));
      let s = ''; cmpd.forEach((x, k) => { const y = 6 + k * 50; s += `<text class="b sm" x="8" y="${y + 9}">${esc(x.name)}</text><rect class="bar" x="8" y="${y + 14}" width="${f(Math.max(2, (W - 120) * x.cmp / mx))}" height="10" rx="3"/><text class="sm" x="${f(14 + (W - 120) * x.cmp / mx)}" y="${y + 23}">${x.cmp} Vergleiche</text><rect class="bars" x="8" y="${y + 28}" width="${f(Math.max(2, (W - 120) * x.mov / mm))}" height="10" rx="3"/><text class="sm" x="${f(14 + (W - 120) * x.mov / mm)}" y="${y + 37}">${x.mov} ${x.k === 'insertion' ? 'Verschiebungen' : 'Tausche'}</text>`; });
      h += wrap('Aufwand im Vergleich (für dieses Feld, bis zum Ende)', svgOf(160, 'Anzahl der Vergleiche und Tausche der drei Sortierverfahren für das eingegebene Feld', s), 'Bubble-Sort und Selection-Sort vergleichen hier immer gleich oft, nämlich n·(n−1)/2 mal (bei n = ' + R.a.length + ' sind das ' + (R.a.length * (R.a.length - 1) / 2) + '). Sie unterscheiden sich vor allem in der Zahl der Tausche. Insertion-Sort braucht bei fast sortierten Feldern am wenigsten.');
    }
    return h;
  }
  const STATE = { algo: 'bubble', list: '5 2 4 1 3', target: '4', i: 0, playing: false, timer: null };
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  function mount(el) {
    try {
      if (!el) return; css(); const S = STATE; S.playing = false; if (S.timer) { clearTimeout(S.timer); S.timer = null; }
      const draw = (keepFocus) => { const act = keepFocus && typeof document !== 'undefined' ? document.activeElement : null, key = act && act.dataset ? act.dataset.av : null, pos = act && act.selectionStart; el.innerHTML = viewHtml(S); if (key && el.querySelector) { const n = el.querySelector('[data-av=' + key + ']'); if (n && n.focus && (key === 'list' || key === 'target')) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } } };
      const tick = () => { if (!S.playing) return; const R = stepsFor(S); if (!R || !R.st || S.i >= R.st.length - 1) { S.playing = false; draw(); return; } S.i++; draw(); S.timer = setTimeout(tick, 900); };
      if (el._avBound !== true) {
        el._avBound = true;
        el.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.av; if (!k) return; if (k === 'list') { S.list = e.target.value; S.i = 0; } else if (k === 'target') { S.target = e.target.value; S.i = 0; } else if (k === 'algo') { S.algo = e.target.value; S.i = 0; } else return; S.playing = false; draw(k !== 'algo'); });
        el.addEventListener('click', e => {
          const b = e.target.closest && e.target.closest('[data-av]'); if (!b) return; const k = b.dataset.av, R = stepsFor(S), len = R && R.st ? R.st.length : 1;
          if (k === 'next') S.i = Math.min(len - 1, S.i + 1); else if (k === 'prev') S.i = Math.max(0, S.i - 1); else if (k === 'first') S.i = 0; else if (k === 'end') S.i = len - 1;
          else if (k === 'auto') { S.playing = !S.playing; if (S.playing && !reduced()) { if (S.i >= len - 1) S.i = 0; draw(); S.timer = setTimeout(tick, 900); return; } if (S.timer) { clearTimeout(S.timer); S.timer = null; } S.playing = false; }
          else if (k === 'pre') { const v = b.dataset.v; S.list = v === 'std' ? '5 2 4 1 3' : v === 'rand' ? Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 30)).join(' ') : v === 'asc' ? '1 2 3 4 5 6 7' : v === 'desc' ? '7 6 5 4 3 2 1' : '3 1 3 2 1'; S.i = 0; S.playing = false; }
          else return; if (k !== 'auto') { S.playing = false; if (S.timer) { clearTimeout(S.timer); S.timer = null; } } draw();
        });
      }
      draw();
    } catch (e) {}
  }

  /* ============================================================ Symbol-Legende (PAP und Struktogramm) */
  function legend() {
    try {
      css(); const P = (x, y, w, h, txt, shape) => {
        const cx = x + w / 2, cy = y + h / 2;
        let g = shape === 'term' ? `<rect class="pp-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` : shape === 'io' ? `<polygon class="pp-shape" points="${x + 12},${y} ${x + w},${y} ${x + w - 12},${y + h} ${x},${y + h}"/>` : shape === 'dia' ? `<polygon class="pp-shape" points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}"/>` : `<rect class="pp-shape" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
        return g + `<text class="pp-txt" x="${cx}" y="${cy + 4}" text-anchor="middle" style="font-size:12px">${esc(txt)}</text>`;
      };
      let s = `<text class="b sm m" x="8" y="14">Programmablaufplan (PAP)</text>`;
      s += P(8, 24, 96, 30, 'Start / Ende', 'term') + `<text class="sm m" x="112" y="43">Anfang und Ende des Ablaufs</text>`;
      s += P(8, 62, 96, 30, 'Ein-/Ausgabe', 'io') + `<text class="sm m" x="112" y="81">Eingabe x, Ausgabe y</text>`;
      s += P(8, 100, 96, 30, 'x := x + 1', 'rect') + `<text class="sm m" x="112" y="119">Anweisung (Zuweisung, Rechnung)</text>`;
      s += P(8, 138, 96, 38, 'x > 0 ?', 'dia') + `<text class="sm m" x="112" y="154">Verzweigung oder Schleifenkopf:</text><text class="sm m" x="112" y="167">Ja / Nein, zwei Ausgänge</text>`;
      s += `<text class="b sm m" x="8" y="204">Struktogramm (Nassi-Shneiderman)</text>`;
      /* Anweisung */
      s += `<rect class="ns-box pp-shape" x="8" y="214" width="96" height="24"/><text class="pp-txt" x="56" y="230" text-anchor="middle" style="font-size:12px">Anweisung</text><text class="sm m" x="112" y="230">ein Kästchen, von oben nach unten</text>`;
      /* Verzweigung */
      s += `<rect class="ns-box pp-shape" x="8" y="246" width="96" height="40"/><path class="pp-l" d="M8 246 L56 270 L104 246"/><text class="pp-txt" x="56" y="258" text-anchor="middle" style="font-size:11px">x &gt; 0</text><text class="pp-lab" x="12" y="282" style="font-size:10px">Ja</text><text class="pp-lab" x="100" y="282" text-anchor="end" style="font-size:10px">Nein</text><path class="pp-l" d="M56 270 V286"/><text class="sm m" x="112" y="262">Verzweigung: Dreieck oben,</text><text class="sm m" x="112" y="275">links Ja, rechts Nein</text>`;
      /* kopfgesteuert */
      s += `<rect class="ns-box pp-shape" x="8" y="294" width="96" height="22"/><text class="pp-txt" x="14" y="309" style="font-size:11px">Solange x &lt; 9</text><rect class="ns-box pp-shape" x="8" y="316" width="16" height="22"/><rect class="ns-box pp-shape" x="24" y="316" width="80" height="22"/><text class="sm m" x="112" y="308">Schleife mit Bedingung oben:</text><text class="sm m" x="112" y="321">Der Körper läuft, solange wahr</text>`;
      /* Zählschleife */
      s += `<rect class="ns-box pp-shape" x="8" y="346" width="96" height="22"/><text class="pp-txt" x="14" y="361" style="font-size:11px">Für i von 1 bis 5</text><rect class="ns-box pp-shape" x="8" y="368" width="16" height="22"/><rect class="ns-box pp-shape" x="24" y="368" width="80" height="22"/><text class="sm m" x="112" y="360">Zählschleife: i läuft von</text><text class="sm m" x="112" y="373">Start bis Ende</text>`;
      /* fußgesteuert */
      s += `<rect class="ns-box pp-shape" x="8" y="398" width="16" height="22"/><rect class="ns-box pp-shape" x="24" y="398" width="80" height="22"/><rect class="ns-box pp-shape" x="8" y="420" width="96" height="22"/><text class="pp-txt" x="14" y="435" style="font-size:11px">Bis x = 0</text><text class="sm m" x="112" y="418">Schleife mit Bedingung unten:</text><text class="sm m" x="112" y="431">Der Körper läuft mindestens einmal</text>`;
      return wrap('Symbole im Überblick', svgOf(454, 'Symbole von Programmablaufplan und Struktogramm: Start/Ende, Ein-/Ausgabe, Anweisung, Verzweigung, Schleifen', s, 'algsvg'), 'Die Zeichner oben verwenden genau diese Formen. Im Ablaufplan sind Schleifen Verzweigungen mit einem Pfeil zurück; im Struktogramm sind sie Kästchen mit Einrückung.');
    } catch (e) { return ''; }
  }

  const API = { trace, legend, mount, bars, sortSteps, searchSteps, parseList, compare };
  root.ALG_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  /* Die Oberfläche (algui.js) wird vor dieser Datei geladen und hat den ersten Reiter schon gezeichnet: einmal neu zeichnen, damit die Bilder erscheinen. */
  if (typeof document !== 'undefined') { try { const b = document.querySelector('#tabs .tab.on'); if (b) b.click(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
