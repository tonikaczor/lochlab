'use strict';
/* Tonfunk Fachgespräch-Lab: Grafiken (Lab-Kennung 'fgs'). Wird in fgslab.html VOR fgsui.js geladen; fgsui.js ruft window.FGS_VIZ auf.
   ALLE Zahlen (Zeiten, Puffer, Anteile) sind ÜBUNGSWERTE für die Ausbildung, keine Vorgaben einer Prüfung.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/fgs/test_fgsviz.js):
     ganttSvg    Balkenplan: Arbeitsschritte nacheinander, dahinter der Puffer, Endzeit als Fähnchen
     vortragSvg  Bildschirm mit Folie, Vortragende, Zeit-Uhr mit den drei Teilen, Zeitleiste und die Folien als Streifen
     konvSvg     Übungsgespräch: Prüfer und Azubi am Tisch, fünf Phasen als Weg, Sprechblasen je nach Schritt
     wegSvg      Überblick: von der Unterweisung bis zur Rückmeldung in fünf Stationen
   Bewegung nur per CSS und nur bei prefers-reduced-motion: no-preference; jedes Bild ist ohne Bewegung vollständig.
   Schrift: viewBox 420 breit, Schriftgröße mindestens 14 (am Handy bei 350 px Bildbreite etwa 11,7 px). Farben über die CSS-Variablen der Seite (Hell und Dunkel). */
(function (root) {
  const C = root.FGS_CORE || (typeof require === 'function' ? require('./fgscore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 1 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx, extra) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}${extra || ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg class="fv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const W = 420;
  let uidN = 0;

  /* ============================================================ Balkenplan */
  function ganttSvg(g) {
    if (!g || !g.rows || !g.rows.length) return svg(W, 60, 'Kein Plan', T(210, 34, 'Keine gültigen Zeiten', 'm mid'));
    const id = 'fvh' + (uidN++), x0 = 134, x1 = 408, rowH = 32, top = 34, n = g.rows.length + 1, H = top + n * rowH + 52, span = Math.max(1, g.end - g.start), k = (x1 - x0) / span;
    const ck = C.clock, pc = C.bufferPct(g.sum, g.buf.d), xe = x0 + (g.end - g.start) * k;
    let b = `<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="fv-pb"/><rect width="4" height="8" class="fv-pf"/></pattern></defs>`;
    b += T(x0, 20, ck(g.start), 'm') + T(x1, 20, ck(g.end), 'b end');
    for (let t = Math.ceil((g.start + 1) / 60) * 60; t < g.end; t += 60) b += L(x0 + (t - g.start) * k, top - 6, x0 + (t - g.start) * k, top + n * rowH, 'fv-grid');
    b += L(x0, top - 6, x0, top + n * rowH, 'fv-axis');
    g.rows.forEach((r, i) => {
      const y = top + i * rowH, x = x0 + (r.start - g.start) * k, w = r.d * k, lab = f(r.d, 0) + ' min';
      b += T(8, y + 21, cut(String(r.n), 18), '');
      b += `<g class="fv-bar" style="--i:${i}">` + R(x, y + 4, w, rowH - 8, 'fv-c' + (i % 5), 6) + R(x + 1, y + 5, Math.max(0, w - 2), 6, 'fv-gl', 3) + '</g>';
      if (w >= 54) b += T(x + w / 2, y + 21, lab, 'w mid fv-lt', ` style="--i:${i}"`);
      else if (x + w + 5 + 50 < xe - 4) b += T(x + w + 5, y + 21, lab, 'm fv-lt', ` style="--i:${i}"`);
      else b += T(x - 5, y + 21, lab, 'm end fv-lt', ` style="--i:${i}"`);
    });
    const yb = top + g.rows.length * rowH, bi = g.rows.length;
    b += T(8, yb + 21, g.buf.d > 0 ? 'Puffer ' + f(pc, 1) + ' %' : 'Kein Puffer', 'b');
    if (g.buf.d > 0) {
      const x = x0 + (g.buf.start - g.start) * k, w = g.buf.d * k, lab = f(g.buf.d, 1) + ' min';
      b += `<g class="fv-bar" style="--i:${bi}">` + R(x, yb + 4, w, rowH - 8, 'fv-puf', 6, ` fill="url(#${id})"`) + '</g>';
      if (w >= 66) b += T(x + w / 2, yb + 21, lab, 'b mid fv-lt', ` style="--i:${bi}"`);
      else b += T(x - 5, yb + 21, lab, 'm end fv-lt', ` style="--i:${bi}"`);
    }
    b += L(xe, top - 6, xe, top + n * rowH + 6, 'fv-end');
    const lab = 'Fertig um ' + ck(g.end) + ' Uhr', pw = 168, px = Math.min(W - pw - 6, Math.max(6, xe - pw / 2));
    b += `<g class="fv-flag">` + R(px, top + n * rowH + 8, pw, 32, 'fv-pill', 16) + T(px + pw / 2, top + n * rowH + 30, lab, 'w mid') + '</g>';
    return svg(W, H, 'Zeitplan als Balken: ' + g.rows.length + ' Schritte, Puffer, fertig um ' + ck(g.end) + ' Uhr', b);
  }

  /* ============================================================ Vortrag */
  const PCLS = ['fv-c0', 'fv-c2', 'fv-c3'], PNAME = ['Einstieg', 'Hauptteil', 'Schluss'];
  function wedge(cx, cy, r, a0, a1) {
    const p = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)], s = p(a0), e = p(a1);
    return `M${q(cx)} ${q(cy)} L${q(s[0])} ${q(s[1])} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${q(e[0])} ${q(e[1])} Z`;
  }
  function vortragSvg(o) {
    const p = C.partMinutes(o.total, o.pe, o.ps);
    if (!p) return svg(W, 60, 'Kein Vortrag', T(210, 34, 'Anteile passen nicht', 'm mid'));
    const n = C.slideCount(o.total, o.per), sp = C.slideSplit(n, o.pe, o.ps), mins = [p.e, p.h, p.s], pct = [o.pe, 100 - o.pe - o.ps, o.ps];
    let b = '';
    /* Bildschirm mit Folie */
    b += R(10, 12, 164, 100, 'fv-scr', 8) + R(18, 20, 148, 84, 'fv-slide', 3) + R(18, 20, 148, 18, 'fv-c0', 3) + R(26, 26, 60, 6, 'fv-wh', 3);
    b += R(26, 48, 70, 5, 'fv-ln', 2) + R(26, 60, 56, 5, 'fv-ln', 2) + R(26, 72, 64, 5, 'fv-ln', 2);
    b += `<path class="fv-pl" d="M104 90 L116 90 L120 76 L126 98 L132 70 L138 90 L158 90"/>`;
    b += L(92, 112, 92, 124, 'fv-leg') + L(70, 124, 114, 124, 'fv-leg');
    /* Vortragende */
    b += `<circle class="fv-skin" cx="212" cy="50" r="11"/><path class="fv-body" d="M196 112 L196 78 Q196 68 206 68 L218 68 Q228 68 228 78 L228 112 Z"/>`;
    b += `<path class="fv-pt" d="M200 80 L180 64"/><circle class="fv-skin" cx="179" cy="63" r="3.6"/>`;
    /* Zeit-Uhr mit den drei Teilen */
    const cx = 340, cy = 62, r = 48; let a = -Math.PI / 2;
    b += `<circle class="fv-clk" cx="${cx}" cy="${cy}" r="${r + 6}"/>`;
    [0, 1, 2].forEach(i => { const a1 = a + mins[i] / o.total * Math.PI * 2; b += `<path class="${PCLS[i]}" d="${wedge(cx, cy, r, a, a1)}"/>`; a = a1; });
    b += `<g transform="translate(${cx} ${cy})"><g class="fv-hand">${L(0, 0, 0, -r + 4, 'fv-hd')}</g><circle class="fv-hub" r="4"/></g>`;
    b += T(cx, cy + r + 22, f(o.total, 0) + ' min', 'b mid');
    /* Zeitleiste */
    const bx = 10, bw = 400, by = 154, bh = 32; let x = bx;
    [0, 1, 2].forEach(i => {
      const w = bw * pct[i] / 100;
      b += `<g class="fv-bar" style="--i:${i}">` + R(x, by, w, bh, PCLS[i], i === 1 ? 0 : 6) + '</g>';
      if (w >= 40) b += T(x + w / 2, by + 21, f(pct[i], 0) + ' %', 'w mid fv-lt', ` style="--i:${i}"`);
      x += w;
    });
    [0, 1, 2].forEach(i => {
      const lx = 10 + i * 136;
      b += R(lx, 202, 14, 14, PCLS[i], 4) + T(lx + 20, 214, PNAME[i], 'b') + T(lx + 20, 234, f(mins[i], 1) + ' min', 'm');
    });
    /* Folien als Streifen */
    if (!(n >= 1)) return svg(W, 300, 'Vortrag', b + T(10, 270, 'Zu kurz für eine Folie', 'm'));
    b += T(10, 270, sp ? n + ' Folien: ' + sp.e + ' + ' + sp.h + ' + ' + sp.s : n + (n === 1 ? ' Folie' : ' Folien'), 'b');
    const gap = n > 14 ? 3 : 5, sw = Math.min(34, (bw - (n - 1) * gap) / n), sh = Math.max(14, sw * 0.72), counts = sp ? [sp.e, sp.h, sp.s] : [n, 0, 0];
    let part = 0, used = 0;
    for (let i = 0; i < n; i++) {
      while (part < 2 && used >= counts[part]) { part++; used = 0; }
      used++;
      const sx = 10 + i * (sw + gap);
      b += `<g class="fv-sl" style="--i:${i}">` + R(sx, 284, sw, sh, PCLS[part], 3) + R(sx + 2, 286, Math.max(0, sw - 4), 3, 'fv-gl', 1.5) + (sw >= 22 ? T(sx + sw / 2, 284 + sh / 2 + 5, i + 1, 'w mid') : '') + '</g>';
    }
    return svg(W, Math.ceil(284 + sh + 14), 'Vortrag: ' + f(o.total, 0) + ' Minuten, ' + n + ' Folien', b);
  }

  /* ============================================================ Übungsgespräch */
  const PH = ['Einstieg', 'Vorgehen', 'Fehler', 'Alternativen', 'Sicherheit'];
  /* ph 0 bis 4: aktuelle Phase; step: 'denk' | 'sprech' | 'zeig' | 'bew' (nur die Sprechblasen ändern sich) */
  function konvSvg(o) {
    const ph = Math.max(0, Math.min(4, o.ph | 0)), st = o.step || 'denk';
    let b = '';
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 85, cls = i < ph ? 'fv-dn' : i === ph ? 'fv-cur' : 'fv-fu';
      if (i) b += L(x - 85 + 14, 26, x - 14, 26, i <= ph ? 'fv-lk on' : 'fv-lk');
      b += `<circle class="${cls}" cx="${x}" cy="26" r="${i === ph ? 15 : 12}"/>` + T(x, 31, i < ph ? '✓' : i + 1, (i === ph || i < ph ? 'w' : 'm') + ' b mid');
    }
    b += T(210, 66, PH[ph], 'b mid');
    /* Szene: Raum, Personen und Tisch (um 34 nach unten verschoben), darüber die Sprechblasen */
    const gid = 'fvg' + (uidN++);
    b += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fv-gs1"/><stop offset="1" class="fv-gs2"/></linearGradient></defs>`;
    b += R(0, 78, W, 212, 'fv-room', 0, ` fill="url(#${gid})"`) + '<g transform="translate(0 34)">' + R(0, 214, W, 42, 'fv-floor', 0);
    b += R(150, 52, 120, 70, 'fv-board', 6) + R(160, 64, 56, 6, 'fv-c0', 3) + R(160, 78, 84, 5, 'fv-ln', 2.5) + R(160, 90, 72, 5, 'fv-ln', 2.5) + R(160, 102, 90, 5, 'fv-ln', 2.5) + `<path class="fv-ck2" d="M246 62 L251 68 L260 58"/>`;
    b += `<circle class="fv-skin" cx="92" cy="136" r="17"/><path class="fv-hair" d="M75 134 Q76 116 92 116 Q108 116 109 134 Q100 126 92 126 Q84 126 75 134 Z"/>`;
    b += `<path class="fv-bodyA" d="M52 214 L52 178 Q52 158 74 158 L110 158 Q132 158 132 178 L132 214 Z"/><path class="fv-tie" d="M92 158 L86 176 L92 196 L98 176 Z"/>`;
    b += `<circle class="fv-skin" cx="328" cy="136" r="17"/><path class="fv-hair2" d="M311 136 Q310 114 328 114 Q346 114 345 136 Q338 124 328 124 Q318 124 311 136 Z"/>`;
    b += `<path class="fv-bodyB" d="M288 214 L288 178 Q288 158 310 158 L346 158 Q368 158 368 178 L368 214 Z"/>`;
    b += R(34, 204, 352, 12, 'fv-tbl', 4) + R(48, 216, 10, 34, 'fv-tbl2', 2) + R(362, 216, 10, 34, 'fv-tbl2', 2);
    b += R(66, 190, 64, 16, 'fv-pap', 2) + R(72, 195, 10, 6, 'fv-c2', 2) + R(88, 195, 10, 6, 'fv-c2', 2) + R(104, 195, 10, 6, 'fv-ln2', 2);
    b += `<path class="fv-pl2" d="M262 198 L276 198 L280 190 L286 206 L292 190 L298 206 L302 198 L318 198"/></g>`;
    const by = 100;
    b += `<g class="fv-bub">${bubble(92, by, 92)}${T(92, by + 27, '?', 'fv-q mid')}</g>`;
    const bb = `<g class="fv-bub b2">${bubble(328, by, 328)}`;
    if (st === 'denk') b += bb + [304, 328, 352].map((x, i) => `<circle class="fv-dot" cx="${x}" cy="${by + 17}" r="4" style="--i:${i}"/>`).join('') + '</g>';
    else if (st === 'sprech') b += bb + `<path class="fv-wave" d="M300 ${by + 18} L308 ${by + 10} L316 ${by + 24} L324 ${by + 8} L332 ${by + 26} L340 ${by + 12} L348 ${by + 22} L356 ${by + 16}"/></g>`;
    else b += bb + `<path class="fv-ck" d="M312 ${by + 18} L324 ${by + 28} L346 ${by + 6}"/></g>`;
    return svg(W, 290, 'Übungsgespräch: Phase ' + (ph + 1) + ' von 5, ' + PH[ph], b);
  }
  /* Sprechblase (Breite 84, Höhe 34) mit Spitze nach unten zur Mitte cx */
  function bubble(cx, y) {
    const x = cx - 42, w = 84, h = 34;
    return `<path class="fv-bb" d="M${x + 8} ${y} L${x + w - 8} ${y} Q${x + w} ${y} ${x + w} ${y + 8} L${x + w} ${y + h - 8} Q${x + w} ${y + h} ${x + w - 8} ${y + h} L${cx + 7} ${y + h} L${cx} ${y + h + 11} L${cx - 7} ${y + h} L${x + 8} ${y + h} Q${x} ${y + h} ${x} ${y + h - 8} L${x} ${y + 8} Q${x} ${y} ${x + 8} ${y} Z"/>`;
  }

  /* ============================================================ Überblick */
  const WEG = [['Ausbildung und Unterweisungen', 'Lj 1'], ['Arbeitsauftrag planen', 'Lj 2 bis 4'], ['Präsentation vorbereiten', 'Lj 2 bis 4'], ['Fachgespräch führen', 'Lj 3 bis 4'], ['Bewerten und Rückmeldung', 'Lj 3 bis 4']];
  function wegSvg(active) {
    let b = '';
    WEG.forEach((s, i) => {
      const y = 8 + i * 56, on = active === i;
      if (i) b += L(32, y - 10, 32, y, 'fv-flow');
      b += R(6, y, 408, 42, on ? 'fv-st on' : 'fv-st', 12) + `<circle class="fv-c${i}" cx="32" cy="${y + 21}" r="15"/>` + T(32, y + 27, i + 1, 'w b mid') + T(58, y + 27, s[0], on ? 'b' : '') + R(320, y + 9, 86, 24, 'fv-lj', 12) + T(363, y + 26, s[1], 'm mid');
    });
    return svg(W, 8 + 5 * 56, 'Überblick: fünf Stationen von der Unterweisung bis zur Rückmeldung', b);
  }

  const CSS = `.fv{display:block;width:100%;height:auto}.fv text{font-family:system-ui,sans-serif;font-size:14px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.fv .m{fill:var(--mute)}.fv .w{fill:#fff}.fv .b{font-weight:700}.fv .mid{text-anchor:middle}.fv .end{text-anchor:end}
.fv-c0{fill:#1a6fd4}.fv-c1{fill:#7b52c9}.fv-c2{fill:#0f8a7c}.fv-c3{fill:#c25e00}.fv-c4{fill:#b0397a}
.fv-gl{fill:#fff;opacity:.22}.fv-grid{stroke:var(--line);stroke-width:1}.fv-axis{stroke:var(--mute);stroke-width:1.4}
.fv-end{stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4}.fv-pill{fill:var(--accent-bg)}.fv-pb{fill:var(--panel)}.fv-pf{fill:var(--warn);opacity:.75}.fv-puf{stroke:var(--warn);stroke-width:1.6}
.fv-scr{fill:#2b3440;stroke:var(--mute);stroke-width:1.5}.fv-slide{fill:#f4f6f9}.fv-wh{fill:#fff;opacity:.85}.fv-ln{fill:#b7c0cb}.fv-pl{fill:none;stroke:#c25e00;stroke-width:2.4;stroke-linejoin:round}.fv-leg{stroke:var(--mute);stroke-width:3;stroke-linecap:round}
.fv-skin{fill:#e8b88f}.fv-body{fill:var(--accent-bg)}.fv-pt{fill:none;stroke:var(--accent-bg);stroke-width:7;stroke-linecap:round}
.fv-clk{fill:var(--panel2);stroke:var(--mute);stroke-width:1.5}.fv-hd{stroke:var(--fg);stroke-width:3;stroke-linecap:round}.fv-hub{fill:var(--fg)}
.fv-st{fill:var(--panel2);stroke:var(--line);stroke-width:1}.fv-st.on{stroke:var(--accent);stroke-width:2.4}.fv-lj{fill:var(--bg);stroke:var(--line)}.fv-flow{stroke:var(--mute);stroke-width:2.4;stroke-dasharray:4 4}
.fv-dn{fill:var(--ok)}.fv-cur{fill:var(--accent-bg);stroke:var(--accent);stroke-width:2}.fv-fu{fill:none;stroke:var(--mute);stroke-width:1.6}.fv-lk{stroke:var(--line);stroke-width:2.4}.fv-lk.on{stroke:var(--ok)}
.fv-gs1{stop-color:var(--panel2)}.fv-gs2{stop-color:var(--bg)}.fv-floor{fill:var(--line);opacity:.6}.fv-board{fill:#f4f6f9;stroke:var(--mute);stroke-width:2}.fv-ck2{fill:none;stroke:#107a3f;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.fv-hair{fill:#5a3b28}.fv-hair2{fill:#2e2a26}.fv-bodyA{fill:#4a5a70}.fv-bodyB{fill:#0f8a7c}.fv-tie{fill:#c93c3c}
.fv-tbl{fill:#a8794a}.fv-tbl2{fill:#8a5f37}.fv-pap{fill:#fff;stroke:var(--line);stroke-width:1}.fv-ln2{fill:#b7c0cb}.fv-pl2{fill:none;stroke:var(--fg);stroke-width:2.2;stroke-linejoin:round}
.fv-bb{fill:var(--panel);stroke:var(--mute);stroke-width:1.6;stroke-linejoin:round}.fv-q{font-size:22px!important;font-weight:700;fill:var(--accent)!important}.fv-dot{fill:var(--mute)}
.fv-wave{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.fv-ck{fill:none;stroke:var(--ok);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
@media(prefers-reduced-motion:no-preference){
.fv-bar{transform-box:fill-box;transform-origin:left center;animation:fvgrow .6s ease-out both;animation-delay:calc(var(--i,0)*.12s)}
.fv-lt{animation:fvfade .5s ease-out both;animation-delay:calc(var(--i,0)*.12s + .35s)}
.fv-flag{animation:fvfade .6s ease-out both;animation-delay:.9s}
.fv-sl{transform-box:fill-box;transform-origin:center bottom;animation:fvpop .35s ease-out both;animation-delay:calc(var(--i,0)*.04s)}
.fv-hand{animation:fvturn 14s linear infinite}
.fv-bub{transform-box:fill-box;transform-origin:center bottom;animation:fvpop .4s ease-out both}.fv-bub.b2{animation-delay:.25s}
.fv-dot{animation:fvdot 1.4s ease-in-out infinite;animation-delay:calc(var(--i,0)*.22s)}
.fv-wave{stroke-dasharray:90;animation:fvwave 1.6s ease-in-out infinite alternate}
.fv-flow{animation:fvflow 1.4s linear infinite}
@keyframes fvgrow{from{transform:scaleX(0)}}@keyframes fvfade{from{opacity:0}}@keyframes fvpop{from{transform:scale(.2);opacity:0}}
@keyframes fvturn{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes fvdot{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes fvwave{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}@keyframes fvflow{to{stroke-dashoffset:-16}}}`;
  if (typeof document !== 'undefined' && !document.getElementById('fgsvizcss')) { const s = document.createElement('style'); s.id = 'fgsvizcss'; s.textContent = CSS; document.head.appendChild(s); }

  const API = { ganttSvg, vortragSvg, konvSvg, wegSvg, PH, PNAME, CSS };
  root.FGS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
