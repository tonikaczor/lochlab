'use strict';
/* Tonfunk Zeichnungs-Lab: Visualisierungen (zeiviz.js, wird NACH zeiui.js eingebunden).
   Reine SVG-Funktionen (ZEI_VIZ.*, in Node testbar) plus eine kleine Anbindung an die Reiter:
   Werkstatt: Klapp-Schema der Ansichten (Methode 1) und Schnitt-Schema, Linien: beschriftete Beispielzeichnung,
   Maßstab: Bauteil im Blatt (A4). Es werden KEINE Aufgaben-Reiter (Aufgaben, Trainer) verändert und keine Lösungen gezeigt.
   Farben nur über CSS-Variablen der Seite, Bewegung nur bei erlaubter Animation (prefers-reduced-motion). */
(function (root) {
  const N = v => (isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let uid = 0;
  const V = {};

  const STYLE = '.vz svg{display:block;width:100%;height:auto;max-width:440px;margin:0 auto}.vz svg text{font-family:system-ui,sans-serif;fill:var(--fg)}'
    + '.vz .m{fill:var(--mute)!important}.vz .ln{stroke:var(--fg);fill:none;stroke-linecap:round}.vz .ac{stroke:var(--accent);fill:var(--accent)}'
    + '.vz .pl-a{fill:var(--accent);fill-opacity:.16;stroke:var(--accent);stroke-width:1.2}.vz .pl-h{fill:var(--hi);fill-opacity:.16;stroke:var(--hi);stroke-width:1.2}'
    + '.vz .pl-b{fill:var(--panel);stroke:var(--fg);stroke-width:1.4}.vz .hide{opacity:.2}'
    + '.vz .cap{margin:6px 0 0;font-size:13px;color:var(--mute);line-height:1.4;min-height:2.8em}.vz .sl{display:flex;align-items:center;gap:8px}.vz .sl input{flex:1}';

  /* ---------- Klapp-Schema (Projektionsmethode 1) ---------- */
  /* dims {w,h,d} in Würfeln, t 0..1 (0 = Projektionskasten, 1 = in die Zeichenebene geklappt) */
  V.klapp = function (dims, t) {
    const W = Math.max(1, dims.w | 0), H = Math.max(1, dims.h | 0), D = Math.max(1, dims.d | 0);
    t = Math.min(1, Math.max(0, +t || 0));
    const q = 0.38, a = t * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const s = Math.min(300 / (W + D + q * D), 250 / (H + D + q * D));
    const ox = 24 + q * D * s, oy = 14 + H * s;
    const X = x => N(ox + x * s), Y = y => N(oy + y * s);
    const pt = (x, y) => X(x) + ',' + Y(y);
    const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(p => pt(p[0], p[1])).join(' ')}"/>`;
    const back = [[0, -H], [W, -H], [W, 0], [0, 0]];
    const floor = [[0, 0], [W, 0], [W - q * D * ca, D * sa + q * D * ca], [-q * D * ca, D * sa + q * D * ca]];
    const side = [[W, -H], [W, 0], [W + D * sa - q * D * ca, q * D * ca], [W + D * sa - q * D * ca, -H + q * D * ca]];
    const cen = p => [p.reduce((u, v) => u + v[0], 0) / p.length, p.reduce((u, v) => u + v[1], 0) / p.length];
    const lab = (p, txt, wid) => { const c = cen(p), fs = N(Math.max(8, Math.min(12, wid * s / (txt.length * 0.62)))); return `<text x="${X(c[0])}" y="${N(Y(c[1]) + fs / 3)}" text-anchor="middle" font-size="${fs}" font-weight="700" style="paint-order:stroke;stroke:var(--panel);stroke-width:3px">${txt}</text>`; };
    let g = poly(back, 'pl-b') + poly(floor, 'pl-a') + poly(side, 'pl-h');
    /* Körper (Quader) im Kasten, blendet beim Klappen aus */
    const o = 1 - t;
    if (o > 0.02) {
      const fz = [[0, 0], [W, 0], [W, -H], [0, -H]].map(p => [p[0] - q * D, p[1] + q * D]);
      g += `<g style="opacity:${N(o * 10) / 10}" class="ln"><polygon points="${fz.map(p => pt(p[0], p[1])).join(' ')}" style="stroke-width:1.6;fill:var(--fg);fill-opacity:.08"/>`
        + [[0, -H], [W, -H], [W, 0], [0, 0]].map((p, i) => `<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(fz[i][0])}" y2="${Y(fz[i][1])}" style="stroke-width:1.1;stroke-dasharray:4 3"/>`).join('') + '</g>';
    }
    g += lab(back, 'Vorderansicht', W);
    if (t > 0.3) g += lab(floor, 'Draufsicht', W) + lab(side, 'Seitenansicht', Math.max(0.4, D * sa));
    /* Scharnierkanten */
    g += `<line class="ln" x1="${X(0)}" y1="${Y(0)}" x2="${X(W)}" y2="${Y(0)}" style="stroke-width:2.4"/><line class="ln" x1="${X(W)}" y1="${Y(-H)}" x2="${X(W)}" y2="${Y(0)}" style="stroke-width:2.4"/>`;
    const vh = N(oy + (D + q * D) * s + 12);
    return `<svg viewBox="0 0 360 ${vh}" role="img" aria-label="Klappschema: Draufsicht und Seitenansicht werden in die Ebene der Vorderansicht geklappt">${g}</svg>`;
  };
  V.klappText = function (t) {
    t = +t || 0;
    if (t < 0.05) return 'Der Körper steht im Projektionskasten. Du schaust von vorn, von oben und von links auf ihn.';
    if (t > 0.95) return 'Fertig geklappt: Die Draufsicht liegt unter der Vorderansicht, die Seitenansicht von links liegt rechts daneben.';
    return 'Die untere Ebene (Draufsicht) klappt nach unten, die rechte Ebene (Seitenansicht von links) nach rechts. Die Vorderansicht bleibt liegen.';
  };

  /* ---------- Schnitt-Schema ---------- */
  /* dims {w,h,d}, cy = Schicht von vorn (0-basiert), t 0..1 = vorderen Teil abnehmen */
  V.cutScheme = function (dims, cy, t) {
    const W = Math.max(1, dims.w | 0), H = Math.max(1, dims.h | 0), D = Math.max(1, dims.d | 0);
    cy = Math.min(D - 1, Math.max(0, cy | 0)); t = Math.min(1, Math.max(0, +t || 0));
    const q = 0.38, zc = D - (cy + 0.5), shift = t * 1.6;
    const s = Math.min(280 / (W + (D + 1.8) * q), 190 / (H + (D + 1.8) * q)), ox = 26 + (D + 1.8) * q * s, oy = 20 + H * s;
    const P = (x, y, z) => [N(ox + (x - q * z) * s), N(oy + (-y + q * z) * s)];
    const pg = (pts, st) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" ${st}/>`;
    const id = 'vzh' + (++uid);
    const bz = [P(0, 0, 0), P(W, 0, 0), P(W, H, 0), P(0, H, 0)];
    let g = `<defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="ln" style="stroke-width:1"/></pattern></defs>`;
    /* hinterer Teil: Oberseite, rechte Seite, Schnittfläche */
    g += pg([P(0, H, 0), P(W, H, 0), P(W, H, zc), P(0, H, zc)], 'class="pl-b" style="fill:var(--panel2)"');
    g += pg([P(W, 0, 0), P(W, 0, zc), P(W, H, zc), P(W, H, 0)], 'class="pl-b" style="fill:var(--panel2)"');
    g += pg([P(0, 0, zc), P(W, 0, zc), P(W, H, zc), P(0, H, zc)], 'class="pl-b" style="fill:var(--panel)"');
    g += pg([P(0, 0, zc), P(W, 0, zc), P(W, H, zc), P(0, H, zc)], `style="fill:url(#${id});stroke:none"`);
    /* vorderer Teil (weggenommen): gestrichelter Umriss, nach vorn verschoben */
    const z0 = zc + shift, z1 = D + shift;
    g += `<g class="ln" style="stroke-dasharray:5 4;stroke-width:1.4;opacity:.75">` + pg([P(0, 0, z1), P(W, 0, z1), P(W, H, z1), P(0, H, z1)], 'style="fill:var(--accent);fill-opacity:.07"')
      + pg([P(0, H, z0), P(W, H, z0), P(W, H, z1), P(0, H, z1)], 'style="fill:none"') + pg([P(W, 0, z0), P(W, 0, z1), P(W, H, z1), P(W, H, z0)], 'style="fill:none"') + '</g>';
    /* Blickpfeil auf die Schnittfläche */
    const a0 = P(W / 2, H / 2, D + 1.6 + shift), a1 = P(W / 2, H / 2, zc + 0.15);
    g += `<line class="ac" x1="${a0[0]}" y1="${a0[1]}" x2="${a1[0]}" y2="${a1[1]}" style="stroke-width:2.2"/>`;
    const dx = a1[0] - a0[0], dy = a1[1] - a0[1], L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L;
    g += `<polygon class="ac" points="${N(a1[0])},${N(a1[1])} ${N(a1[0] - ux * 9 - uy * 4.5)},${N(a1[1] - uy * 9 + ux * 4.5)} ${N(a1[0] - ux * 9 + uy * 4.5)},${N(a1[1] - uy * 9 - ux * 4.5)}"/>`;
    const tl = P(0, H, zc);
    g += `<text x="${N(tl[0] - 4)}" y="${N(tl[1] - 6)}" font-size="12" font-weight="700" text-anchor="end">A</text>`;
    const vh = N(oy + (D + 1.8) * q * s + 22);
    return `<svg viewBox="0 0 360 ${vh}" role="img" aria-label="Schnittschema: Schnittebene A, vorderer Teil abgenommen, Schnittfläche schraffiert">${g}</svg>`;
  };

  /* ---------- Linien in der Beispielzeichnung ---------- */
  /* active: null | 'breit' | 'strich' | 'mittel' | 'schmal' */
  V.linienDemo = function (active) {
    const dim = k => (active && active !== k ? ' hide' : '');
    const arrH = (x1, x2, y) => `<polygon points="${x1},${y} ${x1 + 6},${y - 2} ${x1 + 6},${y + 2}" class="za"/><polygon points="${x2},${y} ${x2 - 6},${y - 2} ${x2 - 6},${y + 2}" class="za"/>`;
    const ar = (x1, x2, y) => arrH(x1, x2, y).replace(/class="za"/g, 'style="fill:var(--fg)"');
    const arV = (y1, y2, x) => `<polygon points="${x},${y1} ${x - 2},${y1 + 6} ${x + 2},${y1 + 6}" style="fill:var(--fg)"/><polygon points="${x},${y2} ${x - 2},${y2 - 6} ${x + 2},${y2 - 6}" style="fill:var(--fg)"/>`;
    let g = '';
    /* breite Volllinien: sichtbare Kanten */
    g += `<g class="ln${dim('breit')}" style="stroke-width:2.8"><rect x="40" y="30" width="160" height="80"/><circle cx="120" cy="70" r="22"/><rect x="236" y="30" width="32" height="80"/></g>`;
    /* Strichlinie: verdeckte Kanten (Bohrung in der Seitenansicht) */
    g += `<g class="ln${dim('strich')}" style="stroke-width:1.5;stroke-dasharray:6 4"><line x1="236" y1="48" x2="268" y2="48"/><line x1="236" y1="92" x2="268" y2="92"/></g>`;
    /* Strich-Punkt schmal: Mittellinien */
    g += `<g class="ln${dim('mittel')}" style="stroke-width:1.1;stroke-dasharray:12 3 2 3"><line x1="86" y1="70" x2="154" y2="70"/><line x1="120" y1="36" x2="120" y2="104"/><line x1="226" y1="70" x2="278" y2="70"/></g>`;
    /* Volllinie schmal: Maßlinien, Maßhilfslinien */
    g += `<g class="ln${dim('schmal')}" style="stroke-width:1"><line x1="40" y1="112" x2="40" y2="140"/><line x1="200" y1="112" x2="200" y2="140"/><line x1="40" y1="134" x2="200" y2="134"/>`
      + `<line x1="38" y1="30" x2="14" y2="30"/><line x1="38" y1="110" x2="14" y2="110"/><line x1="20" y1="30" x2="20" y2="110"/>`
      + `<line x1="236" y1="112" x2="236" y2="140"/><line x1="268" y1="112" x2="268" y2="140"/><line x1="236" y1="134" x2="268" y2="134"/>`
      + `<line x1="136" y1="56" x2="168" y2="38"/></g>`;
    g += `<g class="${dim('schmal')}">${ar(40, 200, 134)}${arV(30, 110, 20)}${ar(236, 268, 134)}</g>`;
    g += `<g class="${dim('schmal')}"><text x="120" y="129" font-size="12" text-anchor="middle">80</text><text x="6" y="74" font-size="12" transform="rotate(-90 6 74)" text-anchor="middle">40</text><text x="252" y="129" font-size="12" text-anchor="middle">16</text><text x="170" y="34" font-size="12">⌀22</text></g>`;
    g += `<text x="120" y="22" font-size="11" class="m" text-anchor="middle">Vorderansicht</text><text x="252" y="22" font-size="11" class="m" text-anchor="middle">Seitenansicht</text>`;
    return `<svg viewBox="0 0 300 150" role="img" aria-label="Platte mit Bohrung in zwei Ansichten, Linienarten beschriftet">${g}</svg>`;
  };

  /* ---------- Maßstab: Bauteil im Blatt ---------- */
  /* nat, zei in mm; a, b = Maßstab a:b; Rechteck mit Länge Naturmaß und halber Höhe (nur Beispiel) */
  V.sheet = function (nat, a, b) {
    nat = +nat; a = +a; b = +b;
    if (!(nat > 0) || !(a > 0) || !(b > 0)) return '';
    const zei = nat * a / b, k = 320 / 297, sx = 10, sy = 8, sw = 297 * k, sh = 210 * k;
    const x0 = sx + 12, y0 = sy + 14;
    const pw = zei * k, ph = zei * k / 2, nw = nat * k, nh = nat * k / 2;
    const over = pw > sw - 24 || ph > sh - 70;
    const cw = Math.min(pw, sw - 24), chh = Math.min(ph, sh - 70);
    let g = `<rect x="${sx}" y="${sy}" width="${N(sw)}" height="${N(sh)}" rx="2" style="fill:var(--panel);stroke:var(--mute);stroke-width:1.2"/>`
      + `<text x="${N(sx + sw - 6)}" y="${N(sy + sh - 6)}" font-size="10" class="m" text-anchor="end">Blatt A4 (297 × 210 mm)</text>`;
    /* Naturgröße als Vergleich (gestrichelt, gleicher mm-Maßstab wie das Blatt) */
    g += `<rect x="${N(x0)}" y="${N(y0)}" width="${N(Math.min(nw, sw - 24))}" height="${N(Math.min(nh, sh - 70))}" style="fill:none;stroke:var(--mute);stroke-width:1.2;stroke-dasharray:5 4"/>`;
    g += `<rect x="${N(x0)}" y="${N(y0)}" width="${N(cw)}" height="${N(chh)}" style="fill:${over ? 'var(--danger)' : 'var(--accent)'};fill-opacity:.22;stroke:${over ? 'var(--danger)' : 'var(--fg)'};stroke-width:2.2"/>`;
    /* Maßlinie mit Naturmaß */
    const my = N(Math.min(y0 + chh + 20, sy + sh - 22)), ex = N(x0 + cw);
    if (cw > 18) g += `<line x1="${N(x0)}" y1="${N(y0 + chh)}" x2="${N(x0)}" y2="${my + 4}" class="ln" style="stroke-width:1"/><line x1="${ex}" y1="${N(y0 + chh)}" x2="${ex}" y2="${my + 4}" class="ln" style="stroke-width:1"/>`
      + `<line x1="${N(x0)}" y1="${my}" x2="${ex}" y2="${my}" class="ln" style="stroke-width:1"/><polygon points="${N(x0)},${my} ${N(x0 + 6)},${my - 2} ${N(x0 + 6)},${my + 2}" style="fill:var(--fg)"/><polygon points="${ex},${my} ${N(x0 + cw - 6)},${my - 2} ${N(x0 + cw - 6)},${my + 2}" style="fill:var(--fg)"/>`
      + `<text x="${N(x0 + cw / 2)}" y="${my - 4}" font-size="12" font-weight="700" text-anchor="middle">${esc(fmt(nat))}</text>`;
    const lg = sy + sh + 14;
    g += `<rect x="${sx}" y="${lg - 9}" width="14" height="9" style="fill:var(--accent);fill-opacity:.3;stroke:var(--fg)"/><text x="${sx + 20}" y="${lg - 1}" font-size="11">Zeichnung M ${a}:${b}</text>`
      + `<rect x="${sx + 150}" y="${lg - 9}" width="14" height="9" style="fill:none;stroke:var(--mute);stroke-dasharray:3 2"/><text x="${sx + 170}" y="${lg - 1}" font-size="11">Bauteil 1:1</text>`;
    return `<svg viewBox="0 0 340 ${N(sy + sh + 24)}" role="img" aria-label="Bauteil im Maßstab ${a} zu ${b} auf einem A4-Blatt, daneben die Naturgröße gestrichelt">${g}${over ? `<text x="${N(sx + sw / 2)}" y="${N(sy + sh - 22)}" font-size="12" font-weight="700" text-anchor="middle" style="fill:var(--danger)">Passt in diesem Maßstab nicht aufs Blatt</text>` : ''}</svg>`;
  };
  function fmt(v) { return (Math.round(v * 1e4) / 1e4).toString().replace('.', ','); }

  root.ZEI_VIZ = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  if (typeof document === 'undefined' || !document.getElementById) return;

  /* ============================================================ Anbindung an die Seite */
  const C = root.ZEI_CORE;
  const reduce = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.zei.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const $ = (s, r) => (r || document).querySelector(s);

  function werkModel() {
    try { const w = lsGet('werk', {}); return w.model === 'rand' ? C.genBody(C.rng('werk' + (w.seed || 1)), 3) : C.modelByName(w.model || 'winkel'); } catch (e) { return null; }
  }
  const dimsOf = m => ({ w: m.nx, h: m.nz, d: m.ny });
  const card = (key, title, inner) => { const d = document.createElement('div'); d.className = 'card pl vz'; d.setAttribute('data-vz', key); d.innerHTML = `<h4>${title}</h4>${inner}`; return d; };
  let anim = null;
  function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }

  const W = {
    klapp: {
      view: 'werkView', ok: () => { const b = $('#wMode .on'); return !b || b.dataset.wmode === 'ans'; }, t: 0,
      make(host) {
        const self = this, n = card('klapp', 'Wie entstehen die Ansichten? Klappen des Projektionskastens',
          `<div class="inst zc1" data-b="1"></div><div class="sl"><button class="btn" data-pl="1" style="min-width:132px">Aufklappen</button><input type="range" min="0" max="100" step="1" value="${Math.round(self.t * 100)}" aria-label="Klappwinkel der Ebenen"></div><p class="cap" data-c="1"></p>`);
        const r = $('input', n), btn = $('[data-pl]', n);
        r.addEventListener('input', () => { stopAnim(); self.t = r.value / 100; self.upd(n); });
        btn.addEventListener('click', () => {
          stopAnim(); const to = self.t < 0.5 ? 1 : 0;
          if (reduce()) { self.t = to; r.value = to * 100; self.upd(n); return; }
          const from = self.t, t0 = performance.now(), dur = 1400 * Math.abs(to - from);
          const step = now => { const k = Math.min(1, (now - t0) / Math.max(1, dur)); self.t = from + (to - from) * (k * k * (3 - 2 * k)); r.value = Math.round(self.t * 100); self.upd(n); anim = k < 1 ? requestAnimationFrame(step) : null; };
          anim = requestAnimationFrame(step);
        });
        return n;
      },
      upd(n) {
        const m = werkModel(); if (!m) return;
        $('[data-b]', n).innerHTML = V.klapp(dimsOf(m), this.t); $('[data-c]', n).textContent = V.klappText(this.t);
        $('[data-pl]', n).textContent = this.t >= 0.5 ? 'Zurückklappen' : 'Aufklappen';
      }
    },
    cut: {
      view: 'werkView', ok: () => { const b = $('#wMode .on'); return !!b && b.dataset.wmode === 'cut'; }, t: 0.6,
      make() {
        const self = this, n = card('cut', 'Schnittschema: Körper durchsägen',
          `<div class="inst zc1" data-b="1"></div><div class="sl"><span style="font-size:13px;white-space:nowrap">Vorderen Teil abnehmen</span><input type="range" min="0" max="100" step="1" value="${Math.round(self.t * 100)}" aria-label="Vorderen Teil abnehmen"></div>
           <p class="cap">Schema mit einem Quader. Der Pfeil zeigt die Blickrichtung auf die Schnittfläche. Beim echten Körper wird nur dort schraffiert, wo das Material wirklich getroffen wird.</p>`);
        const r = $('input', n); r.addEventListener('input', () => { self.t = r.value / 100; self.upd(n); });
        return n;
      },
      upd(n) { const m = werkModel(); if (!m) return; const w = lsGet('werk', {}); $('[data-b]', n).innerHTML = V.cutScheme(dimsOf(m), w.cy == null ? 1 : w.cy, this.t); }
    },
    lin: {
      view: 'linView', ok: () => true, a: null,
      make() {
        const self = this, n = card('lin', 'Wo steht welche Linie?',
          `<p class="hint2" style="margin:0 0 6px">Tippe eine Linienart an, dann wird sie in der Beispielzeichnung hervorgehoben.</p><div class="ctl" role="group" aria-label="Linienart wählen">`
          + [['breit', 'Volllinie breit'], ['strich', 'Strichlinie'], ['mittel', 'Strich-Punkt-Linie'], ['schmal', 'Volllinie schmal']].map(x => `<button class="chip s" data-la="${x[0]}" aria-pressed="false">${x[1]}</button>`).join('')
          + `</div><div class="inst zc1" data-b="1"></div><p class="cap" data-c="1"></p>`);
        n.addEventListener('click', e => { const b = e.target.closest('[data-la]'); if (!b) return; self.a = self.a === b.dataset.la ? null : b.dataset.la; self.upd(n); });
        return n;
      },
      upd(n) {
        const T = { breit: 'Sichtbare Kanten und Umrisse: Volllinie breit.', strich: 'Verdeckte Kanten, hier die Bohrung in der Seitenansicht: Strichlinie.', mittel: 'Mittellinien an der Bohrung und Symmetrieachsen: Strich-Punkt-Linie schmal.', schmal: 'Maßlinien und Maßhilfslinien: Volllinie schmal. Die Maßzahl ist das Naturmaß.' };
        $('[data-b]', n).innerHTML = V.linienDemo(this.a); $('[data-c]', n).textContent = this.a ? T[this.a] : 'Alle Linienarten auf einen Blick. Die Maße stehen für eine Platte 80 × 40 mm, 16 mm dick, mit Durchgangsbohrung ⌀22.';
        n.querySelectorAll('[data-la]').forEach(b => { const on = b.dataset.la === this.a; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
    },
    mas: {
      view: 'masView', ok: () => true,
      make() { return card('mas', 'Bauteil im Zeichenblatt', '<div class="inst zc1" data-b="1"></div><p class="cap" data-c="1"></p>'); },
      upd(n) {
        const on = $('[data-ms].on'), mm = on && /(\d+):(\d+)/.exec(on.dataset.ms), ni = $('#mNat');
        const nat = ni && C ? C.parseDe(ni.value) : NaN, a = mm ? +mm[1] : 1, b = mm ? +mm[2] : 1, svg = V.sheet(nat, a, b);
        $('[data-b]', n).innerHTML = svg || '<p class="hint2" style="padding:8px;margin:0">Gib ein Naturmaß ein.</p>';
        $('[data-c]', n).textContent = 'Beispielbauteil: Rechteck, Höhe halb so groß wie die Länge. Gestrichelt siehst du die Naturgröße. In die Maßlinie schreibt man immer das Naturmaß.';
      }
    }
  };

  function sync(key) {
    const w = W[key], host = document.getElementById(w.view); if (!host) return;
    let n = host.querySelector(':scope > [data-vz="' + key + '"]');
    const ok = host.firstElementChild && w.ok();
    if (!ok) { if (n) n.remove(); return; }
    if (!n) { n = w.make(host); const cs = host.querySelectorAll(':scope > .card'); if (key === 'mas' && cs[0]) cs[0].after(n); else if (key === 'lin' && cs[1]) cs[1].before(n); else host.appendChild(n); }
    w.upd(n);
  }
  Object.keys(W).forEach(key => {
    const host = document.getElementById(W[key].view); if (!host) return;
    new MutationObserver(() => sync(key)).observe(host, { childList: true });
    ['input', 'change', 'click'].forEach(ev => host.addEventListener(ev, e => { if (!e.target.closest('.vz')) sync(key); }));
    sync(key);
  });
  /* beide Werkstatt-Karten hängen am selben Host: Umschalter Ansichten/Schnitt rendert neu, die Beobachter greifen dann */
})(typeof window !== 'undefined' ? window : globalThis);
