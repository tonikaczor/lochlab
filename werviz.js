'use strict';
/* Tonfunk Werkstoff-Lab: Visualisierungen (Lab-Kennung 'wer'), window.WER_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an werui.js auskommt:
   - Reiter "Zugversuch": Das Spannungs-Dehnungs-Diagramm bekommt farbige Bereiche (elastisch, Fließen, Verfestigung, Einschnürung)
     mit Beschriftung, der aktuelle Bereich leuchtet auf, und beim Ziehen erscheint die Entlastungsgerade (parallel zur Hookeschen
     Geraden) mit der bleibenden Dehnung. Schalter "Bereiche zeigen". Darunter die Karte "Werkstoffe im Vergleich".
   Aufgabenintegrität: Betroffen ist nur das Diagramm im Reiter Zugversuch (#zChart). Das Diagramm in Aufgaben und Trainer bleibt
   unverändert (dort wird abgelesen). Die Bereichsbilder nennen keine Zahlenwerte; Re, Rm und A erscheinen weiter nur über
   den vorhandenen Schalter "Kennwerte zeigen". Farben nur über CSS-Variablen (und hsl für die Vergleichslinien). Keine Animation. */
(function (root) {
  const C = root.WER_CORE || (typeof require !== 'undefined' ? require('./wercore.js') : null);
  const D = root.WER_DATA || (typeof require !== 'undefined' ? require('./werdata.js').DATA : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : (d || 0);
  const p1 = v => fin(v).toFixed(1);
  const CH = { L: 54, R: 372, T: 14, B: 236 };   /* wie in werui.js (Rahmen des Diagramms im Viewbox 380 x 274) */

  /* ---------- Bereiche der Kurve ---------- */
  const ZNAME = { elastisch: 'elastisch', fliessen: 'Fließen', verfestigung: 'Verfestigung', einschnuerung: 'Einschnürung', sproed: 'spröder Bruch' };
  const ZLONG = { elastisch: 'Elastischer Bereich', fliessen: 'Fließbereich', verfestigung: 'Verfestigung', einschnuerung: 'Einschnürung', sproed: 'Sprödbruch ohne Fließen' };
  const ZCOL = { elastisch: 'var(--ok)', fliessen: 'var(--warn)', verfestigung: 'var(--accent)', einschnuerung: 'var(--danger)', sproed: 'var(--danger)' };
  const _zc = new Map();
  /* Bereiche aus der Phasenfunktion des Kerns: [{id, e0, e1}] in % Dehnung (ohne Ruhe und Bruch) */
  function zones(m) {
    if (!m || !C) return [];
    let z = _zc.get(m); if (z) return z;
    z = []; const N = 3000, A = m.A;
    if (m.type === 'sprod') z = [{ id: 'sproed', e0: 0, e1: A }];
    else {
      let cur = null;
      for (let i = 1; i < N; i++) {
        const e = A * i / N, ph = C.phaseAt(m, e); if (ph === 'bruch' || ph === 'ruhe') continue;
        if (!cur || cur.id !== ph) { if (cur) cur.e1 = e; cur = { id: ph, e0: cur ? e : 0, e1: A }; z.push(cur); }
      }
      if (z.length) z[z.length - 1].e1 = A;
    }
    _zc.set(m, z); return z;
  }
  const xOf = (m, e, G) => G.L + fin(e) / m.ax.xmax * (G.R - G.L);
  const yOf = (m, s, G) => G.B - fin(s) / m.ax.ymax * (G.B - G.T);

  /* Overlay für das Zugdiagramm. o: {eps (aktuelle Dehnung in %), G (Rahmen), on (Bereiche zeigen)}
     liefert {back, front}: back kommt unter das Gitter, front über die Kurve (beide ohne Pointer-Ereignisse). */
  function zugOverlay(m, o) {
    o = o || {}; const G = o.G || CH, eps = fin(o.eps), on = o.on !== false; let back = '', front = '';
    if (!m || !C) return { back, front, zones: [] };
    const zs = zones(m);
    if (on) {
      let call = 0;
      zs.forEach(zn => {
        const x0 = xOf(m, zn.e0, G), x1 = xOf(m, zn.e1, G), w = x1 - x0, act = eps > zn.e0 - 1e-12 && eps <= zn.e1 + 1e-12 && eps > 0;
        back += `<rect class="wz-band" x="${p1(x0)}" y="${G.T}" width="${p1(Math.max(w, 0.8))}" height="${G.B - G.T}" fill="${ZCOL[zn.id]}" fill-opacity="${act ? 0.26 : 0.11}"/>`;
        const lab = ZNAME[zn.id], need = lab.length * 5.4 + 8;
        if (w >= need) front += `<text class="wz-zt${act ? ' act' : ''}" x="${p1((x0 + x1) / 2)}" y="${G.T + 12}" text-anchor="middle">${esc(lab)}</text>`;
        else {
          const ym = G.B - 30 - 15 * call++, xm = x0 + Math.min(w, 6) / 2;
          front += `<line class="wz-lead" x1="${p1(xm)}" y1="${G.B}" x2="${p1(xm)}" y2="${p1(ym)}" stroke="${ZCOL[zn.id]}"/><text class="wz-zt${act ? ' act' : ''}" x="${p1(xm + 4)}" y="${p1(ym + 3.5)}">${esc(ZLONG[zn.id])}</text>`;
        }
      });
    }
    /* Entlastung: Gerade parallel zur Hookeschen Geraden vom aktuellen Punkt zur Dehnungsachse */
    const ph = eps > 0 && eps < m.A - 1e-9 ? C.phaseAt(m, eps) : 'ruhe';
    if (ph === 'fliessen' || ph === 'verfestigung' || ph === 'einschnuerung') {
      const sg = C.sigmaAt(m, eps), epl = Math.max(0, eps - sg / m.E * 100), cx = xOf(m, eps, G), cy = yOf(m, sg, G), ex = xOf(m, epl, G), ey = G.B;
      front += `<line class="wz-unl" x1="${p1(cx)}" y1="${p1(cy)}" x2="${p1(ex)}" y2="${p1(ey)}"/><line class="wz-pl" x1="${p1(G.L)}" y1="${G.B - 3}" x2="${p1(ex)}" y2="${G.B - 3}"/>`;
      if (cx - ex > 14) front += `<text class="wz-zt" x="${p1(Math.min(G.R - 4, (cx + ex) / 2 + 6))}" y="${p1((cy + ey) / 2)}">Entlastung</text>`;
      if (ex - G.L > 8) front += `<text class="wz-pt" x="${p1((G.L + ex) / 2)}" y="${G.B - 8}" text-anchor="middle">εpl</text>`;
    }
    return { back, front, zones: zs };
  }
  /* kleine Legende zu den Bereichen (Text), für unter dem Diagramm */
  function zoneLegend(m) {
    return zones(m).map(z => ({ id: z.id, name: ZLONG[z.id], col: ZCOL[z.id] }));
  }

  /* ---------- Werkstoffvergleich ---------- */
  const VCOL = { s235: 'hsl(210 85% 58%)', c45: 'hsl(28 92% 52%)', al: 'hsl(145 55% 44%)', cu: 'hsl(350 75% 58%)', gjl: 'hsl(275 55% 64%)' };
  const VDASH = { s235: '', c45: '7 3', al: '2 3', cu: '10 3 2 3', gjl: '' };
  const VIEWS = { ganz: { xmax: 50, xstep: 10, label: 'ganze Kurven' }, anfang: { xmax: 1, xstep: 0.2, label: 'Anfang (bis 1 %)' } };
  const nde = v => String(Math.round(v * 10) / 10).replace('.', ',');
  function compareSvg(ids, view) {
    const V = VIEWS[view] || VIEWS.ganz, W = 380, H = 270, L = 50, R = 368, T = 14, B = 232, ymax = 800, X = e => L + e / V.xmax * (R - L), Y = s => B - s / ymax * (B - T);
    let s = `<rect class="wz-bg" width="${W}" height="${H}"/>`;
    for (let v = 0; v <= ymax; v += 100) s += `<line class="wz-gr" x1="${L}" x2="${R}" y1="${p1(Y(v))}" y2="${p1(Y(v))}"/><text class="wz-ax" x="${L - 6}" y="${p1(Y(v) + 3.5)}" text-anchor="end">${v}</text>`;
    for (let v = 0; v <= V.xmax + 1e-9; v += V.xstep) s += `<line class="wz-gr" x1="${p1(X(v))}" x2="${p1(X(v))}" y1="${T}" y2="${B}"/><text class="wz-ax" x="${p1(X(v))}" y="${B + 14}" text-anchor="middle">${nde(v)}</text>`;
    s += `<text class="wz-ax" x="${(L + R) / 2}" y="${H - 6}" text-anchor="middle">Dehnung ε in %</text><text class="wz-ax" transform="translate(11 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">Spannung σ in N/mm²</text>`;
    s += `<line class="wz-axl" x1="${L}" x2="${R}" y1="${B}" y2="${B}"/><line class="wz-axl" x1="${L}" x2="${L}" y1="${T}" y2="${B}"/>`;
    const used = [], labs = [];
    (D && D.materials || []).filter(m => ids.indexOf(m.id) >= 0).forEach(m => {
      const col = VCOL[m.id] || 'var(--accent)'; let d = '', last = null;
      C.curve(m).forEach(q => { if (q[0] > V.xmax + 1e-9) return; d += (d ? 'L' : 'M') + p1(X(q[0])) + ' ' + p1(Y(q[1])); last = q; });
      if (!d) return;
      /* Kurve bis zum Rand des Bildes fortsetzen, wenn sie darüber hinausgeht */
      if (m.A > V.xmax) { const sg = C.sigmaAt(m, V.xmax); if (isFinite(sg)) { d += 'L' + p1(X(V.xmax)) + ' ' + p1(Y(sg)); last = [V.xmax, sg]; } }
      s += `<path class="wz-cv" d="${d}" stroke="${col}"${VDASH[m.id] ? ` stroke-dasharray="${VDASH[m.id]}"` : ''}/>`;
      if (m.A <= V.xmax) s += `<path d="M${p1(X(last[0]) - 4)} ${p1(Y(last[1]) - 4)} l8 8 m0 -8 l-8 8" stroke="${col}" stroke-width="2" fill="none"/>`;
      labs.push({ x: Math.min(X(last[0]) + 6, R - 2), y: Y(last[1]) - 8, col, name: m.name });
      used.push(m.id);
    });
    labs.sort((a, b) => a.y - b.y); labs.forEach((l, i) => { l.y = Math.max(T + 10, l.y); if (i && l.y < labs[i - 1].y + 12) l.y = labs[i - 1].y + 12; l.y = Math.min(l.y, B - 4); });
    labs.forEach(l => { s += `<text class="wz-nm" x="${p1(l.x)}" y="${p1(l.y)}" text-anchor="${l.x > R - 90 ? 'end' : 'start'}" fill="${l.col}">${esc(l.name)}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spannungs-Dehnungs-Kurven mehrerer Werkstoffe im Vergleich, ${esc(V.label)}">${s}</svg>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.wz-band{pointer-events:none}.wz-zt{fill:var(--mute);font:600 9.5px system-ui,sans-serif;pointer-events:none}.wz-zt.act{fill:var(--fg)}
.wz-lead{stroke-width:1.2;stroke-dasharray:2 2;pointer-events:none}
.wz-unl{stroke:var(--ok);stroke-width:1.8;stroke-dasharray:5 3;pointer-events:none}.wz-pl{stroke:var(--ok);stroke-width:3;stroke-linecap:round;pointer-events:none}
.wz-pt{fill:var(--ok);font:700 10px system-ui,sans-serif;pointer-events:none}
.wz-bg{fill:var(--panel2)}.wz-gr{stroke:var(--line);stroke-width:.7}.wz-ax{fill:var(--mute);font:10px system-ui,sans-serif}.wz-axl{stroke:var(--mute);stroke-width:1.2}
.wz-cv{fill:none;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}.wz-nm{font:700 10.5px system-ui,sans-serif}
.wz-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:6px 0}.wz-fig svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.wz-leg{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
.wz-leg button{min-height:44px;padding:0 14px;border-radius:22px;background:var(--panel2);border:1px solid var(--line);font:600 13.5px system-ui,sans-serif;color:var(--fg);cursor:pointer;touch-action:manipulation;display:inline-flex;align-items:center;gap:7px}
.wz-leg button[aria-pressed=false]{opacity:.55}.wz-leg button.on{background:var(--accent-bg);border-color:var(--accent-bg);color:#fff}
.wz-leg i{width:18px;height:0;border-top:3px solid;display:inline-block}
.wz-note{font-size:13px;color:var(--mute);line-height:1.45;margin:6px 0 0}
.wz-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--mute);margin:4px 0}.wz-key b{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:5px;opacity:.8}
`;
  const ST = { zones: true, cmp: ['s235', 'c45', 'al', 'cu', 'gjl'], view: 'ganz' };
  if (typeof document !== 'undefined') { try { const v = localStorage.getItem('lm4.wer.vzZones'); if (v === '0') ST.zones = false; } catch (e) {} }
  function injectCss() { if (document.getElementById('werviz-css')) return; const st = document.createElement('style'); st.id = 'werviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  const matOf = id => (D.materials.find(m => m.id === id) || D.materials[0]);
  function enhanceChart(host) {
    const svg = host.querySelector('svg[data-chart]'); if (!svg || svg.querySelector('[data-wz]')) return;
    const chip = document.querySelector('#zugView .chip[data-zmat].on'); if (!chip) return; const m = matOf(chip.dataset.zmat);
    const hit = svg.querySelector('rect[data-hit]'), G = hit ? { L: +hit.getAttribute('x'), T: +hit.getAttribute('y'), R: +hit.getAttribute('x') + +hit.getAttribute('width'), B: +hit.getAttribute('y') + +hit.getAttribute('height') } : CH;
    if (![G.L, G.T, G.R, G.B].every(isFinite)) return;
    const mk = svg.querySelector('.c-mark'), eps = mk ? (+mk.getAttribute('cx') - G.L) / (G.R - G.L) * m.ax.xmax : 0, o = zugOverlay(m, { eps: isFinite(eps) ? Math.max(0, eps) : 0, G, on: ST.zones });
    const g1 = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g1.setAttribute('data-wz', 'b'); g1.setAttribute('pointer-events', 'none'); g1.innerHTML = o.back;
    const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g2.setAttribute('data-wz', 'f'); g2.setAttribute('pointer-events', 'none'); g2.innerHTML = o.front;
    svg.insertBefore(g1, svg.firstChild); svg.insertBefore(g2, hit || null);
  }
  function addToggle(view) {
    const ch = view.querySelector('#zChart'); if (!ch) return; const ctl = ch.parentNode.querySelector('.ctl'); if (!ctl || ctl.querySelector('[data-wzt]')) return;
    const b = document.createElement('button'); b.className = 'chip s' + (ST.zones ? ' on' : ''); b.setAttribute('data-wzt', '1'); b.setAttribute('aria-pressed', ST.zones); b.textContent = 'Bereiche zeigen'; ctl.appendChild(b);
  }
  function addKey(view) {
    const ch = view.querySelector('#zChart'), chip = view.querySelector('.chip[data-zmat].on'); if (!ch || !chip) return; let k = ch.parentNode.querySelector('.wz-key');
    const m = matOf(chip.dataset.zmat), html = ST.zones ? zoneLegend(m).map(z => `<span><b style="background:${z.col}"></b>${esc(z.name)}</span>`).join('') : '';
    if (!k) { k = document.createElement('div'); k.className = 'wz-key'; ch.parentNode.appendChild(k); } if (k.dataset.sig !== m.id + ST.zones) { k.dataset.sig = m.id + ST.zones; k.innerHTML = html; }
  }
  function compareCard(view) {
    if (view.querySelector('.wz-cmp')) return; const anchor = view.querySelector('#zEl'); if (!anchor) return;
    const card = document.createElement('div'); card.className = 'card pl wz-cmp'; card.innerHTML = '<h4>Werkstoffe im Vergleich</h4><div class="wz-leg" data-wzm></div><div class="wz-leg" data-wzv></div><div class="wz-fig" data-wzf></div><p class="wz-note" data-wzn></p>';
    anchor.parentNode.parentNode.insertBefore(card, anchor.parentNode.nextSibling);
    const paint = () => {
      card.querySelector('[data-wzm]').innerHTML = D.materials.map(m => { const on = ST.cmp.indexOf(m.id) >= 0; return `<button data-wzm="${m.id}" aria-pressed="${on}"><i style="border-color:${VCOL[m.id] || 'var(--accent)'}${VDASH[m.id] ? ';border-top-style:dashed' : ''}"></i>${esc(m.name)}</button>`; }).join('');
      card.querySelector('[data-wzv]').innerHTML = Object.keys(VIEWS).map(k => `<button class="${ST.view === k ? 'on' : ''}" data-wzv="${k}" aria-pressed="${ST.view === k}">${esc(VIEWS[k].label)}</button>`).join('');
      card.querySelector('[data-wzf]').innerHTML = compareSvg(ST.cmp, ST.view);
      card.querySelector('[data-wzn]').textContent = ST.view === 'ganz' ? 'Hohe Kurve = fest (Rm). Lange Kurve = verformbar (A). Das Kreuz markiert den Bruch. Grauguss reißt schon bei etwa 0,4 % und ist hier nur als kurzer Strich am Rand zu sehen.' : 'Im Anfangsbereich zeigt die Steigung die Steifigkeit: Je steiler die Gerade, desto größer der E-Modul (Stahl steil, Aluminium flacher). Aluminium und Kupfer haben keine ausgeprägte Streckgrenze, ihre Kurven biegen weich ab.';
    };
    card.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.wzm) { const i = ST.cmp.indexOf(b.dataset.wzm); if (i >= 0) { if (ST.cmp.length > 1) ST.cmp.splice(i, 1); } else ST.cmp.push(b.dataset.wzm); }
      else if (b.dataset.wzv) ST.view = b.dataset.wzv;
      paint();
    });
    paint();
  }
  function run(view) {
    try { const ch = view.querySelector('#zChart'); if (!ch) return; addToggle(view); addKey(view); enhanceChart(ch); compareCard(view); } catch (e) {}
  }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && D && C) {
    const start = () => {
      injectCss(); const v = document.getElementById('zugView'); if (!v) return;
      new MutationObserver(() => run(v)).observe(v, { childList: true, subtree: true }); run(v);
      v.addEventListener('click', e => {
        const b = e.target.closest('[data-wzt]'); if (!b) return; ST.zones = !ST.zones; try { localStorage.setItem('lm4.wer.vzZones', ST.zones ? '1' : '0'); } catch (er) {}
        b.classList.toggle('on', ST.zones); b.setAttribute('aria-pressed', ST.zones);
        const svg = v.querySelector('#zChart svg'); if (svg) { svg.querySelectorAll('[data-wz]').forEach(n => n.remove()); enhanceChart(v.querySelector('#zChart')); } addKey(v);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { zones, zugOverlay, zoneLegend, compareSvg, CH, ZNAME };
  root.WER_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
