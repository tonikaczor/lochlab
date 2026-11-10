'use strict';
/* Tonfunk Kalkulations-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken).
   Wird in kallab.html NACH kalui.js geladen und ergänzt per MutationObserver:
   Rechner   -> Kalkulationsschema als Treppe/Wasserfall (Start, Zuschläge, Abzüge, Zwischensummen) für Bezug, Selbstkosten, Angebot, Rückwärts, Differenz;
                bei „Spanne / Faktor“ ein Balken, der zeigt, dass derselbe Aufschlag je nach Basis einen anderen Prozentsatz ergibt.
                Break-even behält die vorhandene Grafik.
   Beispiele -> dieselbe Grafik im Rechenweg jedes Beispiels
   Aufgaben und Trainer bleiben absichtlich ohne Grafik (keine Lösungen verraten).
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
  function waterfall(rows) {
    const st = steps(rows); if (st.length < 2) return '';
    const W = 360, LW = 126, X0 = LW + 4, X1 = 292, RH = 24, TOP = 6;
    const lo = Math.min(0, Math.min.apply(null, st.map(s => Math.min(s.a, s.b)))), hi = Math.max(1e-9, Math.max.apply(null, st.map(s => Math.max(s.a, s.b))));
    const x = v => X0 + (v - lo) / (hi - lo) * (X1 - X0);
    let s = `<line x1="${f1(x(0))}" y1="${TOP - 2}" x2="${f1(x(0))}" y2="${TOP + st.length * RH}" class="ax"/>`;
    st.forEach((q, i) => {
      const y = TOP + i * RH, xa = x(Math.min(q.a, q.b)), xb = x(Math.max(q.a, q.b)), w = Math.max(2, xb - xa);
      const sign = q.t === 'plus' ? '+ ' : q.t === 'minus' ? '− ' : '';
      s += `<text x="${LW}" y="${y + 15}" text-anchor="end" class="s10${q.t === 'tot' ? ' b' : ''}">${esc(cut(q.label, 25))}</text>`;
      if (i) { const p = st[i - 1], xc = x(p.b); s += `<line x1="${f1(xc)}" y1="${y - 4}" x2="${f1(xc)}" y2="${y + 3}" class="cn"/>`; }
      s += `<rect x="${f1(xa)}" y="${y + 3}" width="${f1(w)}" height="${RH - 8}" rx="2" class="c ${q.t}"/>`;
      if (fin(q.pct) && w >= 40) s += `<text x="${f1(xa + w / 2)}" y="${y + 15}" text-anchor="middle" class="s9 b">${esc(C.fmtP(q.pct))} %</text>`;
      s += `<text x="${W - 2}" y="${y + 15}" text-anchor="end" class="s10${q.t === 'tot' ? ' b' : ''}">${sign}${esc(C.fmtDe(q.v, 2))} €</text>`;
    });
    return svg(W, TOP + st.length * RH + 2, 'Kalkulationsschema als Treppe mit ' + st.length + ' Stufen', s);
  }

  /* ---------------------------------------------------------- Spanne / Zuschlag: derselbe Aufschlag, zwei Basen */
  function spanneBars(rows) {
    const z = (rows || []).find(r => r.k === 'z'), sp = (rows || []).find(r => r.k === 's');
    if (!z || !sp || !fin(z.v) || !fin(sp.v) || z.v <= 0 || z.v > 1000) return '';
    const W = 360, X0 = 8, X1 = 352, tot = 100 + z.v, sx = v => X0 + v / tot * (X1 - X0), xb = sx(100);
    let s = `<text x="${X0}" y="12" class="s11 b tN">Basis Bezugspreis = 100 %</text>`
      + `<path d="M${X0} 22V17H${f1(xb)}V22" class="br bN"/><text x="${f1((X0 + xb) / 2)}" y="34" text-anchor="middle" class="s10">Bezugspreis 100 %</text>`
      + `<rect x="${X0}" y="40" width="${f1(xb - X0)}" height="30" class="c tot"/><rect x="${f1(xb)}" y="40" width="${f1(X1 - xb)}" height="30" class="c plus"/>`
      + `<text x="${f1((X0 + xb) / 2)}" y="59" text-anchor="middle" class="s11 b">Bezugspreis</text><text x="${f1((xb + X1) / 2)}" y="59" text-anchor="middle" class="s11 b">Aufschlag</text>`
      + `<path d="M${f1(xb)} 78V83H${X1}V78" class="br bH"/><text x="${f1((xb + X1) / 2)}" y="96" text-anchor="middle" class="s10">Zuschlag ${esc(C.fmtP(z.v))} %</text>`
      + `<path d="M${X0} 106V111H${X1}V106" class="br bS"/><text x="${(X0 + X1) / 2}" y="124" text-anchor="middle" class="s10">Verkaufspreis 100 %: Aufschlag = Handelsspanne ${esc(C.fmtP(sp.v))} %</text>`;
    return svg(W, 132, 'Derselbe Aufschlag: ' + C.fmtP(z.v) + ' % vom Bezugspreis, aber ' + C.fmtP(sp.v) + ' % vom Verkaufspreis', s);
  }

  const KEY = '<div class="nvk"><span><i class="kStart"></i>Startwert</span><span><i class="kPlus"></i>Zuschlag (+)</span><span><i class="kMinus"></i>Abzug (−)</span><span><i class="kTot"></i>Zwischen- und Endsumme</span></div>';
  /* Grafik für einen Rechner-Modus; '' wenn keine sinnvoll ist */
  function vizFor(mode, res) {
    if (!res || !res.ok) return '';
    if (mode === 'sp') { const b = spanneBars(res.rows); return b ? b + '<p class="hint2">Der Aufschlag in Euro ist derselbe. Bezogen auf den kleineren Bezugspreis ergibt er den größeren Prozentsatz (Zuschlag), bezogen auf den größeren Verkaufspreis den kleineren (Spanne).</p>' : ''; }
    if (mode === 'db') return '';
    const w = waterfall(res.rows); if (!w) return '';
    const hint = { bezug: 'Rabatt und Skonto verkleinern den Preis, die Bezugskosten kommen dazu.', sk: 'Gemeinkosten werden als Zuschlag auf ihre Basis aufgeschlagen. Die Summen (blau) wachsen von Stufe zu Stufe.', ang: 'Gewinn, Skonto, Provision, Rabatt und Steuer werden Stufe für Stufe aufgeschlagen.', rueck: 'Vom Marktpreis geht es Stufe für Stufe nach unten bis zum höchstens zahlbaren Einkaufspreis.', diff: 'Vom Marktpreis bleibt nach Abzügen der Barverkaufspreis; gegen die Selbstkosten ergibt sich Gewinn oder Verlust.' }[mode] || '';
    return w + KEY + (hint ? `<p class="hint2">${esc(hint)}</p>` : '');
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nv svg{display:block;width:100%;height:auto;max-width:600px;margin:4px auto 0;overflow:visible}
.nv svg text{fill:var(--fg);font:11px system-ui,-apple-system,"Segoe UI",sans-serif}
.nv svg .b{font-weight:700}.nv svg .m{fill:var(--mute)}.nv svg .s9{font-size:9.5px}.nv svg .s10{font-size:10.5px}.nv svg .s11{font-size:11px}.nv svg .tN{fill:var(--accent)}
.nv svg .c{stroke-width:1}
.nv svg .c.start{fill:var(--accent);fill-opacity:.2;stroke:var(--accent)}.nv svg .c.tot{fill:var(--accent);fill-opacity:.5;stroke:var(--accent)}
.nv svg .c.plus{fill:var(--hi);fill-opacity:.4;stroke:var(--hi)}.nv svg .c.minus{fill:var(--danger);fill-opacity:.35;stroke:var(--danger)}
.nv svg .ax{stroke:var(--mute);stroke-width:1}.nv svg .cn{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 2}
.nv svg .br{fill:none;stroke-width:1.5}.nv svg .bN{stroke:var(--accent)}.nv svg .bH{stroke:var(--hi)}.nv svg .bS{stroke:var(--ok)}
.nv .nvk{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--mute);margin:6px 0 0}
.nv .nvk i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px;border:3px solid}
.nv .nvk .kStart{border-color:var(--accent);opacity:.55}.nv .nvk .kTot{border-color:var(--accent)}.nv .nvk .kPlus{border-color:var(--hi)}.nv .nvk .kMinus{border-color:var(--danger)}
.nv.nvx{margin:8px 0;padding:8px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
@media print{.nv{display:none!important}}`;

  const API = { compute, steps, waterfall, spanneBars, vizFor, CSS };
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
  watch('calcView', v => {
    const mode = (v.querySelector('.msel .chip.on[data-mode]') || {}).dataset; if (!mode) return;
    const vals = {};
    v.querySelectorAll('input[data-f]').forEach(i => { vals[i.dataset.f] = i.value; });
    v.querySelectorAll('button[data-seg].on').forEach(b => { vals[b.dataset.seg] = b.dataset.val; });
    const html = vizFor(mode.mode, compute(mode.mode, vals));
    let c = $('nvCalc');
    if (!html) { if (c) c.remove(); return; }
    if (!c || c.parentNode !== v) { c = document.createElement('div'); c.id = 'nvCalc'; c.className = 'card pl nv'; c.innerHTML = '<h4>Grafik: Kalkulation als Treppe</h4><div></div>'; v.appendChild(c); }
    c.lastChild.innerHTML = html;
  });
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
