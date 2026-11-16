'use strict';
/* Tonfunk Kalkulations-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken).
   Wird in kallab.html NACH kalui.js geladen und ergänzt per MutationObserver:
   Rechner   -> Kalkulationsschema als Treppe/Wasserfall (Start, Zuschläge, Abzüge, Zwischensummen) für Bezug, Selbstkosten, Angebot, Rückwärts, Differenz;
                bei „Spanne / Faktor“ ein Balken, der zeigt, dass derselbe Aufschlag je nach Basis einen anderen Prozentsatz ergibt.
                Break-even behält die vorhandene Grafik.
   Beispiele -> dieselbe Grafik im Rechenweg jedes Beispiels
   Aufgaben: nur die "Deine Treppe" unter dem Schema (taskStair), sie baut gesuchte Stufen erst nach richtiger Antwort (keine Lösung verraten).
   Die Werte kommen aus den Eingabefeldern des Rechners und KAL_CORE (dieselbe Rechnung wie die Tabelle).
   Farben nur über CSS-Variablen. Bewegung entfällt. Export: window.KAL_VIZ bzw. module.exports (quelle/kal/test_kalviz.js). */
(function (root) {
  const C = root.KAL_CORE || (typeof require === 'function' ? require('./kalcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const fin = v => typeof v === 'number' && isFinite(v);
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const svg = (w, h, aria, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${body}</svg>`;

  /* gleiche Rechnung wie kalui.js (compute), v = Objekt mit Textwerten */
  function compute(mode, v) {
    const n = k => C.parseDe(v[k]);
    switch (mode) {
      case 'bezug': return C.bezug({ lep: n('lep'), rab: n('rab'), sko: n('sko'), bk: n('bk') });
      case 'sk': return C.selbstkosten({ mek: n('mek'), mgk: n('mgk'), fl: n('fl'), fgk: n('fgk'), vwgk: n('vwgk'), vtgk: n('vtgk') });
      case 'ang': {
        const p = { gew: n('gew'), sko: n('sko'), prov: n('prov'), rab: n('rab'), ust: +v.ust };
        if (v.src === 'handel') { const h = C.handelSk({ bzp: n('bzp'), hk: n('hk') }); if (!h.ok) return h; const a = C.angebot(Object.assign(p, { sk: h.val.sk })); return a.ok ? { ok: true, rows: h.rows.concat(a.rows.slice(1)), val: a.val } : a; }
        p.sk = n('sk'); return C.angebot(p);
      }
      case 'rueck': return C.rueckwaerts({ art: v.art, preis: n('preis'), ust: v.art === 'brutto' ? +v.ust : 0, rab: n('rab'), sko: n('sko'), prov: n('prov'), gew: n('gew'), hk: n('hk'), bk: n('bk'), lsko: n('lsko'), lrab: n('lrab') });
      case 'diff': return C.differenz({ lvp: n('lvp'), rab: n('rab'), sko: n('sko'), prov: n('prov'), sk: n('sk') });
      case 'sp': return v.g === 'pp' ? C.spanne({ bzp: n('bzp'), vp: n('vp') }) : C.spFrom({ g: v.g, wert: n('wert'), bzp: n('bzp') });
      case 'db': return C.db({ p: n('p'), kv: n('kv'), kfix: n('kfix'), x: n('x') });
    }
    return { ok: false, err: 'Unbekanntes Schema.' };
  }

  /* ---------------------------------------------------------- Treppe / Wasserfall (waagerechte Balken) */
  /* Zeilen mit u '€': op '' = Startwert (Balken ab 0), '+' = Zuschlag (schwebt nach rechts), '−' = Abzug (schwebt nach links), '=' = Zwischen-/Endsumme (Balken ab 0).
     Der laufende Wert wird nach Start- und Summenzeilen auf deren Wert gesetzt, wie im Schema. */
  function steps(rows) {
    const out = []; let run = 0;
    (rows || []).forEach(r => {
      if (r.head || r.u !== '€' || !fin(r.v)) return;
      let a, b, t;
      if (r.sum || r.op === '=') { a = 0; b = r.v; t = 'tot'; run = r.v; }
      else if (r.op === '+') { a = run; b = run + r.v; t = 'plus'; run = b; }
      else if (r.op === '−') { a = run; b = run - r.v; t = 'minus'; run = b; }
      else { a = 0; b = r.v; t = 'start'; run = r.v; }
      out.push({ k: r.k, label: r.label, a, b, t, v: r.v, pct: r.pct });
    });
    return out;
  }
  /* o.lo, o.hi: feste Skala (beim Ziehen); o.ghost: Namen noch nicht gezeigter Stufen (gestrichelt, ohne Wert und Länge);
     o.handles: { Zeilenschlüssel: Feldschlüssel } -> Griff am Balkenende (Tippfläche 44 px, ziehen oder Pfeiltasten) */
  function waterfall(rows, o) {
    o = o || {};
    const st = steps(rows), gh = o.ghost || []; if (st.length + gh.length < 2 || !st.length && !gh.length) return '';
    /* hochkant gedacht (Handy zuerst): je Stufe eine Zeile mit Name und Betrag, darunter der Balken. Schrift 12 bei Breite 280, also am Handy mindestens 11 px */
    const W = 280, X0 = 4, X1 = 276, RH = 40, TOP = 4;
    const lo = fin(o.lo) ? o.lo : Math.min(0, Math.min.apply(null, st.map(s => Math.min(s.a, s.b)).concat([0]))), hi = fin(o.hi) ? o.hi : Math.max(1e-9, Math.max.apply(null, st.map(s => Math.max(s.a, s.b)).concat([0])));
    const x = v => Math.max(X0 - 2, Math.min(X1 + 2, X0 + (v - lo) / (hi - lo) * (X1 - X0)));
    const n = st.length + gh.length;
    let s = `<line x1="${f1(x(0))}" y1="${TOP}" x2="${f1(x(0))}" y2="${TOP + n * RH}" class="ax"/>`, hd = '';
    st.forEach((q, i) => {
      const y = TOP + i * RH, xa = x(Math.min(q.a, q.b)), xb = x(Math.max(q.a, q.b)), w = Math.max(2, xb - xa);
      const sign = q.t === 'plus' ? '+ ' : q.t === 'minus' ? '− ' : '';
      s += `<text x="${X0}" y="${y + 13}" class="s12${q.t === 'tot' ? ' b' : ''}">${esc(cut(q.label, 27))}</text>`;
      s += `<text x="${W - 2}" y="${y + 13}" text-anchor="end" class="s12${q.t === 'tot' ? ' b' : ''}">${sign}${esc(C.fmtDe(q.v, 2))} €</text>`;
      if (i) { const p = st[i - 1], xc = x(p.b); s += `<line x1="${f1(xc)}" y1="${y - 4}" x2="${f1(xc)}" y2="${y + 18}" class="cn"/>`; }
      s += `<rect x="${f1(xa)}" y="${y + 18}" width="${f1(w)}" height="16" rx="2" class="c ${q.t}"/>`;
      if (fin(q.pct) && w >= 56) s += `<text x="${f1(xa + w / 2)}" y="${y + 30.5}" text-anchor="middle" class="s12 b">${esc(C.fmtP(q.pct))} %</text>`;
      const fk = o.handles && o.handles[q.k];
      if (fk && fin(q.pct) && (q.t === 'plus' || q.t === 'minus')) {
        const cx = f1(x(q.b)), cy = y + 26;
        hd += `<g class="hd" data-hk="${esc(fk)}" data-rk="${esc(q.k)}" data-a="${q.a}" data-t="${q.t}" tabindex="0" role="slider" aria-label="${esc(q.label)} in Prozent. Ziehen oder Pfeiltasten" aria-valuemin="0" aria-valuenow="${f1(q.pct)}" aria-valuetext="${esc(C.fmtP(q.pct))} Prozent"><circle class="hz" cx="${cx}" cy="${cy}" r="22"/><circle class="hv" cx="${cx}" cy="${cy}" r="9"/></g>`;
      }
    });
    gh.forEach((lab, j) => {
      const y = TOP + (st.length + j) * RH;
      s += `<text x="${X0}" y="${y + 13}" class="s12 m">${esc(cut(lab, 27))}</text><text x="${W - 2}" y="${y + 13}" text-anchor="end" class="s12 m">?</text><rect x="${X0}" y="${y + 18}" width="64" height="16" rx="2" class="c gh"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${TOP + n * RH + 2}" role="img" aria-label="${esc('Kalkulationsschema als Treppe mit ' + st.length + ' Stufen' + (gh.length ? ', ' + gh.length + ' noch offen' : ''))}" data-lo="${lo}" data-hi="${hi}" data-x0="${X0}" data-x1="${X1}">${s}${hd}</svg>`;
  }

  /* Treppe für die Aufgabe: wächst von oben nach unten. Eine gesuchte Zeile baut ihre Stufe erst, wenn sie richtig ist (resRows[k] === 'ok')
     und alle Zeilen davor stehen; sonst bleibt sie gestrichelt, ohne Wert und ohne Länge. all = Lösung gezeigt: alles zeichnen. */
  function taskStair(rows, fill, resRows, all) {
    const vis = [], gh = []; let open = true;
    (rows || []).forEach(r => {
      if (r.head) return;
      const isFill = fill && fill.indexOf(r.k) >= 0, ok = all || !isFill || (resRows && resRows[r.k] === 'ok');
      if (open && ok) vis.push(r); else { open = false; if (r.u === '€' && !r.head) gh.push(r.label); }
    });
    return waterfall(vis, { ghost: gh });
  }

  /* ---------------------------------------------------------- Spanne / Zuschlag: derselbe Aufschlag, zwei Basen */
  function spanneBars(rows) {
    const z = (rows || []).find(r => r.k === 'z'), sp = (rows || []).find(r => r.k === 's');
    if (!z || !sp || !fin(z.v) || !fin(sp.v) || z.v <= 0 || z.v > 1000) return '';
    const W = 280, X0 = 4, X1 = 276, tot = 100 + z.v, sx = v => X0 + v / tot * (X1 - X0), xb = sx(100);
    let s = `<text x="${X0}" y="13" class="s12 b tN">Basis Bezugspreis = 100 %</text>`
      + `<path d="M${X0} 26V21H${f1(xb)}V26" class="br bN"/><text x="${f1((X0 + xb) / 2)}" y="40" text-anchor="middle" class="s12">Bezugspreis 100 %</text>`
      + `<rect x="${X0}" y="46" width="${f1(xb - X0)}" height="30" class="c tot"/><rect x="${f1(xb)}" y="46" width="${f1(X1 - xb)}" height="30" class="c plus"/>`
      + (X1 - xb >= 50 ? `<text x="${f1((xb + X1) / 2)}" y="65" text-anchor="middle" class="s12 b">Aufschlag</text>` : '')
      + `<path d="M${f1(xb)} 84V89H${X1}V84" class="br bH"/><text x="${X1}" y="104" text-anchor="end" class="s12">Zuschlag ${esc(C.fmtP(z.v))} %</text>`
      + `<path d="M${X0} 114V119H${X1}V114" class="br bS"/><text x="${(X0 + X1) / 2}" y="134" text-anchor="middle" class="s12">Verkaufspreis = 100 %:</text><text x="${(X0 + X1) / 2}" y="150" text-anchor="middle" class="s12">Aufschlag = Handelsspanne ${esc(C.fmtP(sp.v))} %</text>`;
    return svg(W, 158, 'Derselbe Aufschlag: ' + C.fmtP(z.v) + ' % vom Bezugspreis, aber ' + C.fmtP(sp.v) + ' % vom Verkaufspreis', s);
  }

  const KEY = '<div class="nvk"><span><i class="kStart"></i>Startwert</span><span><i class="kPlus"></i>Zuschlag (+)</span><span><i class="kMinus"></i>Abzug (−)</span><span><i class="kTot"></i>Zwischen- und Endsumme</span></div>';
  /* Grafik für einen Rechner-Modus; '' wenn keine sinnvoll ist */
  /* Prozentzeilen, die im Rechner per Griff gezogen werden können: Zeilenschlüssel -> Eingabefeld */
  const HANDLES = { bezug: { rab: 'rab', sko: 'sko' }, sk: { mgk: 'mgk', fgk: 'fgk', vwgk: 'vwgk', vtgk: 'vtgk' }, ang: { gew: 'gew', sko: 'sko', prov: 'prov', rab: 'rab', hk: 'hk' }, rueck: { rab: 'rab', sko: 'sko', prov: 'prov', gewinn: 'gew', hkost: 'hk', lsko: 'lsko', lrab: 'lrab' }, diff: { rab: 'rab', sko: 'sko', prov: 'prov' } };
  /* o.drag: Griffe zeigen (nur im Rechner), o.lo/o.hi: feste Skala */
  function vizFor(mode, res, o) {
    o = o || {};
    if (!res || !res.ok) return '';
    if (mode === 'sp') { const b = spanneBars(res.rows); return b ? b + '<p class="hint2">Der Aufschlag in Euro ist derselbe. Bezogen auf den kleineren Bezugspreis ergibt er den größeren Prozentsatz (Zuschlag), bezogen auf den größeren Verkaufspreis den kleineren (Spanne).</p>' : ''; }
    if (mode === 'db') return '';
    const w = waterfall(res.rows, { lo: o.lo, hi: o.hi, handles: o.drag ? HANDLES[mode] : null }); if (!w) return '';
    const hint = { bezug: 'Rabatt und Skonto verkleinern den Preis, die Bezugskosten kommen dazu.', sk: 'Gemeinkosten werden als Zuschlag auf ihre Basis aufgeschlagen. Die Summen (blau) wachsen von Stufe zu Stufe.', ang: 'Gewinn, Skonto, Provision, Rabatt und Steuer werden Stufe für Stufe aufgeschlagen.', rueck: 'Vom Marktpreis geht es Stufe für Stufe nach unten bis zum höchstens zahlbaren Einkaufspreis.', diff: 'Vom Marktpreis bleibt nach Abzügen der Barverkaufspreis; gegen die Selbstkosten ergibt sich Gewinn oder Verlust.' }[mode] || '';
    return w + KEY + (hint ? `<p class="hint2">${esc(hint)}</p>` : '') + (o.drag && /class="hd"/.test(w) ? '<p class="hint2">Zieh den Punkt am Ende eines Zuschlags oder Abzugs nach links oder rechts, oder wähle ihn und nutze die Pfeiltasten (0,5 Prozentpunkte). Die Eingabe oben und die Tabelle rechnen mit.</p>' : '');
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nv svg{display:block;width:100%;height:auto;max-width:440px;margin:4px auto 0;overflow:visible}
.nv svg text{fill:var(--fg);font:12px system-ui,-apple-system,"Segoe UI",sans-serif}
.nv svg .b{font-weight:700}.nv svg .m{fill:var(--mute)}.nv svg .s11{font-size:11px}.nv svg .s12{font-size:12px}.nv svg .tN{fill:var(--accent)}
.nv svg .c{stroke-width:1}
.nv svg .c.start{fill:var(--accent);fill-opacity:.2;stroke:var(--accent)}.nv svg .c.tot{fill:var(--accent);fill-opacity:.5;stroke:var(--accent)}
.nv svg .c.plus{fill:var(--hi);fill-opacity:.4;stroke:var(--hi)}.nv svg .c.gh{fill:none;stroke:var(--mute);stroke-dasharray:4 3}.nv svg .c.minus{fill:var(--danger);fill-opacity:.35;stroke:var(--danger)}
.nv svg .ax{stroke:var(--mute);stroke-width:1}.nv svg .hd{cursor:ew-resize;touch-action:none;outline:none}.nv svg .hz{fill:transparent}.nv svg .hv{fill:var(--bg);stroke:var(--fg);stroke-width:2.5}.nv svg .hd:focus .hv,.nv svg .hd.on .hv{fill:var(--accent);stroke:var(--fg)}.nv svg .cn{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 2}
.nv svg .br{fill:none;stroke-width:1.5}.nv svg .bN{stroke:var(--accent)}.nv svg .bH{stroke:var(--hi)}.nv svg .bS{stroke:var(--ok)}
.nv .nvk{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;color:var(--mute);margin:6px 0 0}
.nv .nvk i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px;border:3px solid}
.nv .nvk .kStart{border-color:var(--accent);opacity:.55}.nv .nvk .kTot{border-color:var(--accent)}.nv .nvk .kPlus{border-color:var(--hi)}.nv .nvk .kMinus{border-color:var(--danger)}
.nv.nvx{margin:8px 0;padding:8px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
@media print{.nv{display:none!important}}`;

  const API = { compute, steps, waterfall, taskStair, spanneBars, vizFor, HANDLES, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.KAL_VIZ = API;
  if (typeof document === 'undefined' || !C) return;

  /* ---------------------------------------------------------- Einbau in die Seite (nur im Browser) */
  const $ = id => document.getElementById(id);
  const st = document.createElement('style'); st.id = 'nvCss'; st.textContent = CSS; document.head.appendChild(st);
  function watch(viewId, build) {
    const v = $(viewId); if (!v) return null; let t = 0;
    const run = () => { t = 0; mo.disconnect(); try { build(v); } catch (e) { if (root.console) console.warn('kalviz', e); } mo.observe(v, { childList: true, subtree: true }); };
    const mo = new MutationObserver(() => { if (!t) t = setTimeout(run, 30); });
    run(); return run;
  }
  let frozen = null, refocus = null;   /* beim Ziehen bleibt die Skala stehen; nach dem Neuzeichnen kommt der Fokus zurück an den Griff */
  const runCalc = watch('calcView', v => {
    const mode = (v.querySelector('.msel .chip.on[data-mode]') || {}).dataset; if (!mode) return;
    const vals = {};
    v.querySelectorAll('input[data-f]').forEach(i => { vals[i.dataset.f] = i.value; });
    v.querySelectorAll('button[data-seg].on').forEach(b => { vals[b.dataset.seg] = b.dataset.val; });
    const html = vizFor(mode.mode, compute(mode.mode, vals), { drag: true, lo: frozen && frozen.lo, hi: frozen && frozen.hi });
    let c = $('nvCalc');
    if (!html) { if (c) c.remove(); return; }
    if (!c || c.parentNode !== v) { c = document.createElement('div'); c.id = 'nvCalc'; c.className = 'card pl nv'; c.innerHTML = '<h4>Grafik: Kalkulation als Treppe</h4><div></div>'; v.appendChild(c); }
    c.lastChild.innerHTML = html;
    if (refocus) { const g = c.querySelector('.hd[data-hk="' + refocus + '"]'); if (g) { try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); } if (drag) g.classList.add('on'); } }
  });
  /* ---- Griffe: ziehen und Pfeiltasten ---- */
  let drag = null;
  const calcView = $('calcView');
  function modeOf() { const m = calcView && calcView.querySelector('.msel .chip.on[data-mode]'); return m ? m.dataset.mode : null; }
  function valsOf() { const vals = {}; calcView.querySelectorAll('input[data-f]').forEach(i => { vals[i.dataset.f] = i.value; }); calcView.querySelectorAll('button[data-seg].on').forEach(b => { vals[b.dataset.seg] = b.dataset.val; }); return vals; }
  /* sucht den Prozentsatz, bei dem die Zeile rk den Wert target (€) hat (Halbierung; Wert wächst mit dem Satz) */
  function solvePct(mode, vals, field, rk, target, max) {
    let lo = 0, hi = max;
    const val = p => { const v = Object.assign({}, vals); v[field] = String(p).replace('.', ','); const res = compute(mode, v); const row = res.ok && res.rows.find(q => q.k === rk); return row && fin(row.v) ? row.v : NaN; };
    if (!fin(val(0)) ) return NaN;
    for (let i = 0; i < 34; i++) { const mid = (lo + hi) / 2, m = val(mid); if (!fin(m)) { hi = mid; continue; } if (m < target) lo = mid; else hi = mid; }
    return Math.round((lo + hi) / 2 * 2) / 2;   /* auf 0,5 Prozentpunkte */
  }
  function setField(field, pct) {
    const inp = calcView.querySelector('input[data-f="' + field + '"]'); if (!inp) return;
    const txt = String(pct).replace('.', ',');
    if (inp.value === txt) return;
    inp.value = txt; inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const card = () => $('nvCalc');
  if (calcView) {
    calcView.addEventListener('pointerdown', e => {
      const g = e.target.closest && e.target.closest('.hd'); const c = card(); if (!g || !c || !c.contains(g)) return;
      const sv = g.ownerSVGElement; if (!sv) return;
      drag = { field: g.dataset.hk, rk: g.dataset.rk, a: +g.dataset.a, t: g.dataset.t, lo: +sv.dataset.lo, hi: +sv.dataset.hi, x0: +sv.dataset.x0, x1: +sv.dataset.x1, vals: valsOf(), mode: modeOf() };
      frozen = { lo: drag.lo, hi: drag.hi }; refocus = drag.field; g.classList.add('on');
      try { c.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    });
    calcView.addEventListener('pointermove', e => {
      if (!drag) return; const sv = card() && card().querySelector('svg'); if (!sv) return;
      const rc = sv.getBoundingClientRect(), vb = sv.viewBox.baseVal, px = (e.clientX - rc.left) / rc.width * vb.width;
      const xv = drag.lo + (px - drag.x0) / (drag.x1 - drag.x0) * (drag.hi - drag.lo);
      const tv = Math.max(0, drag.t === 'plus' ? xv - drag.a : drag.a - xv);
      const p = solvePct(drag.mode, drag.vals, drag.field, drag.rk, tv, drag.t === 'plus' ? 1000 : 99.5);
      if (fin(p)) setField(drag.field, p);
    });
    const ende = () => { if (!drag) return; drag = null; frozen = null; const g = card() && card().querySelector('.hd.on'); if (g) g.classList.remove('on'); if (runCalc) runCalc(); };
    calcView.addEventListener('pointerup', ende); calcView.addEventListener('pointercancel', ende);
    calcView.addEventListener('keydown', e => {
      const g = e.target.closest && e.target.closest('.hd'); if (!g) return;
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0; if (!dir) return;
      e.preventDefault(); const inp = calcView.querySelector('input[data-f="' + g.dataset.hk + '"]'); if (!inp) return;
      const cur = C.parseDe(inp.value), st = e.shiftKey ? 5 : 0.5, nv = Math.max(0, Math.round(((fin(cur) ? cur : 0) + dir * (g.dataset.t === 'minus' ? -1 : 1) * st) * 2) / 2);
      refocus = g.dataset.hk; setField(g.dataset.hk, nv);
    });
    calcView.addEventListener('focusin', e => { if (!(e.target.closest && e.target.closest('.hd'))) refocus = null; });
  }
  watch('bspView', v => {
    const D = root.KAL_DATA; if (!D || !D.examples) return;
    [...v.querySelectorAll('.card')].forEach(cd => {
      const btn = cd.querySelector('[data-ex]'), det = cd.querySelector('details'); if (!btn || !det || det.querySelector('.nvx')) return;
      const ex = D.examples.find(x => x.id === btn.dataset.ex); if (!ex) return;
      const html = vizFor(ex.mode, compute(ex.mode, ex.params)); if (!html) return;
      const d = document.createElement('div'); d.className = 'nv nvx'; d.innerHTML = html; det.appendChild(d);
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
