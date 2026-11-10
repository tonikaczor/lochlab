'use strict';
/* Tonfunk Zerspan-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei wird NACH zerui.js eingebunden.
   window.ZERVIZ = { sim, task, tafel, nBand, fill }.
   sim(sim, m)     Schnittgrößen im Bild für Drehen / Fräsen / Bohren, live aus den Werten des Rechenmodells m (zerui.js)
   task(id, exam)  Skizze OHNE Zahlen und OHNE Formeln zu einer Aufgabe (im Prüfmodus leer, damit nichts verraten wird)
   tafel(proc)     vc-Fenster aller Werkstoffe für HSS und Hartmetall auf einer Achse (Zahlen aus zercore.js, keine eigenen)
   nBand(win,d,sel) Drehzahlreihe der Maschine mit dem Fenster, das zum Richtwert gehört (nur im Modus "Frei probieren")
   Alle Funktionen liefern SVG-Text, nie NaN im Markup. Farben nur über CSS-Variablen der Seite; keine Animation, keine Hover-Abhängigkeit. */
(function (root) {
  const C = root.ZER_CORE || (typeof require !== 'undefined' ? require('./zercore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = x => typeof x === 'number' && isFinite(x);
  const q = x => (fin(x) ? Math.round(x * 10) / 10 : 0);
  const F = (v, d) => (fin(v) ? C.fmt(v, d) : '–');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RAD = Math.PI / 180;

  const CSS = '.zv{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0;text-anchor:start}'
    + '.zv text{font:600 11.5px system-ui,sans-serif;fill:var(--fg,#222);-webkit-user-select:none;user-select:none}'
    + '.zv .m{fill:var(--sv-dim,var(--mute,#667));font-weight:500;font-size:10.5px}'
    + '.zv .t{fill:var(--sv-dim,var(--mute,#667));font-size:10.5px;letter-spacing:.05em;text-transform:uppercase}'
    + '.zv .ln{stroke:var(--sv-ln,var(--fg,#222));stroke-width:1.2;fill:none}'
    + '.zv .th{stroke:var(--sv-ln,var(--fg,#222));stroke-width:1.8;fill:none}'
    + '.zv .wp{fill:var(--sv-wp,#aab);stroke:var(--sv-ln,#222);stroke-width:1.2}'
    + '.zv .wp2{fill:var(--sv-wp2,#889);stroke:var(--sv-ln,#222);stroke-width:1.2}'
    + '.zv .cut{fill:var(--sv-tool,var(--warn,#c80));fill-opacity:.55;stroke:var(--sv-tool,var(--warn,#c80));stroke-width:1.4}'
    + '.zv .okf{fill:var(--ok,#2a2);fill-opacity:.35;stroke:var(--ok,#2a2);stroke-width:1.2}'
    + '.zv .acf{fill:var(--accent,#37f);fill-opacity:.35;stroke:var(--accent,#37f);stroke-width:1.2}'
    + '.zv .wnf{fill:var(--warn,#c80);fill-opacity:.35;stroke:var(--warn,#c80);stroke-width:1.2}'
    + '.zv .vec{stroke:var(--sv-tool,var(--warn,#c80));stroke-width:2.2;fill:none}'
    + '.zv .vecf{fill:var(--sv-tool,var(--warn,#c80))}'
    + '.zv .gd{stroke:var(--sv-dim,#667);stroke-width:.8;stroke-dasharray:3 3;fill:none}'
    + '.zvbox{margin:8px 0 0;padding-top:4px}'
    + '.zvbox h5{margin:0 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute,#667);font-weight:600}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('zerviz-css')) {
    const st = document.createElement('style'); st.id = 'zerviz-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const svg = (h, aria, body) => `<svg class="zv" viewBox="0 0 360 ${h}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
  const box = (title, inner) => `<div class="zvbox"><h5>${esc(title)}</h5>${inner}</div>`;

  /* Pfeil von (x1,y1) nach (x2,y2); cls steuert Linien- und Spitzenfarbe */
  function arrow(x1, y1, x2, y2, cls, head) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = head || 7, w = h * 0.5;
    const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx + w * Math.sin(a), by - w * Math.cos(a)], [bx - w * Math.sin(a), by + w * Math.cos(a)]].map(v => q(v[0]) + ',' + q(v[1])).join(' ');
    return `<line x1="${q(x1)}" y1="${q(y1)}" x2="${q(bx)}" y2="${q(by)}" class="${cls || 'vec'}"/><polygon points="${p}" class="${cls === 'ln' ? 'zvh' : 'vecf'}"${cls === 'ln' ? ' style="fill:var(--sv-ln,#222)"' : ''}/>`;
  }
  /* Maßlinie mit Pfeilen an beiden Enden */
  const dim = (x1, y1, x2, y2) => arrow(x1, y1, x2, y2, 'ln', 5) + arrow(x2, y2, x1, y1, 'ln', 5);

  /* ---------- Stirnansicht mit Drehrichtung und Schnittgeschwindigkeit ---------- */
  function kreis(cx, cy, r, o) {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" class="${o.hole ? 'wp2' : 'wp'}"/>`;
    const z = o.z | 0;
    for (let k = 0; k < z && z <= 12; k++) {
      const a = (k * 360 / z + 90) * RAD, a1 = a - 0.16, a2 = a + 0.16, R = r + 7;
      s += `<polygon points="${q(cx + r * Math.cos(a1))},${q(cy - r * Math.sin(a1))} ${q(cx + R * Math.cos(a))},${q(cy - R * Math.sin(a))} ${q(cx + r * Math.cos(a2))},${q(cy - r * Math.sin(a2))}" class="cut"/>`;
    }
    s += `<line x1="${cx - 5}" y1="${cy}" x2="${cx + 5}" y2="${cy}" class="ln"/><line x1="${cx}" y1="${cy - 5}" x2="${cx}" y2="${cy + 5}" class="ln"/>`;
    s += dim(cx - r + 3, cy + r * 0.45, cx + r - 3, cy + r * 0.45);
    s += `<text x="${cx}" y="${q(cy + r * 0.45 - 5)}" text-anchor="middle">${o.dTxt}</text>`;
    /* vc tangential oben, Drehrichtung im Uhrzeigersinn (von vorn gesehen) */
    const ty = cy - r - 11 + (z ? -4 : 0);
    s += arrow(cx - 2, ty, cx + 50, ty, 'vec') + `<text x="${cx + 54}" y="${q(ty + 4)}" style="fill:var(--sv-tool,var(--warn,#c80))">${o.vcTxt}</text>`;
    const R = r + 13, a0 = 215 * RAD, a1 = 152 * RAD, ex = cx + R * Math.cos(a1), ey = cy - R * Math.sin(a1);
    s += `<path d="M${q(cx + R * Math.cos(a0))} ${q(cy - R * Math.sin(a0))}A${R} ${R} 0 0 1 ${q(ex)} ${q(ey)}" class="th"/>`;
    s += arrow(ex - 6 * Math.sin(a1 + 0.2), ey - 6 * Math.cos(a1 + 0.2), ex, ey, 'ln', 7);
    s += `<text x="${q(cx - R - 4)}" y="${q(cy - 4)}" text-anchor="end">${o.nTxt}</text>`;
    return s;
  }

  /* ---------- Spanquerschnitt A = ap · f (Rechteck) ---------- */
  function span(x0, y0, ap, f, o) {
    const sc = (fin(ap) && fin(f) && ap > 0 && f > 0) ? Math.min(110 / f, 70 / ap) : 1, w = clamp((fin(f) && f > 0 ? f : 0.2) * sc, 24, 112), h = clamp((fin(ap) && ap > 0 ? ap : 1) * sc, 12, 72);
    let s = `<rect x="${x0}" y="${y0}" width="${q(w)}" height="${q(h)}" class="cut"/><text x="${q(x0 + w / 2)}" y="${q(y0 + h / 2 + 4)}" text-anchor="middle">A</text>`;
    s += dim(x0, y0 + h + 12, x0 + w, y0 + h + 12) + `<text x="${q(x0 + w / 2)}" y="${q(y0 + h + 26)}" text-anchor="middle">${o.fTxt}</text>`;
    s += dim(x0 + w + 12, y0, x0 + w + 12, y0 + h) + `<text x="${q(x0 + w + 18)}" y="${q(y0 + h / 2 + 4)}">${o.apTxt}</text>`;
    return s;
  }

  /* ---------- Zahnvorschub: z Schneiden, je Schneide fz, zusammen f je Umdrehung ---------- */
  function zahn(x0, y0, z, o) {
    const n = clamp(z | 0, 1, 12), W = 150, w = W / n; let s = '';
    for (let k = 0; k < n; k++) s += `<rect x="${q(x0 + k * w)}" y="${y0}" width="${q(w)}" height="22" class="${k % 2 ? 'acf' : 'okf'}"/>`;
    if (o.nums && n <= 8) for (let k = 0; k < n; k++) s += `<text x="${q(x0 + k * w + w / 2)}" y="${y0 + 15}" text-anchor="middle" class="m">${k + 1}</text>`;
    s += dim(x0, y0 + 34, x0 + w, y0 + 34) + `<text x="${q(x0 + w / 2)}" y="${y0 + 52}" text-anchor="middle">${o.fzTxt}</text>`;
    s += dim(x0, y0 + 64, x0 + W, y0 + 64) + `<text x="${q(x0 + W / 2)}" y="${y0 + 82}" text-anchor="middle">${o.fTxt}</text>`;
    s += `<text x="${q(x0 + W / 2)}" y="${y0 - 6}" text-anchor="middle" class="m">${o.zTxt}</text>`;
    return s;
  }

  /* ---------- Bohrerspitze mit Spitzenwinkel σ und Anschnitt la ---------- */
  function spitze(cx, y0, sigma, o) {
    const sg = fin(sigma) && sigma > 60 && sigma < 170 ? sigma : 118, hw = 34, la = hw / Math.tan(sg / 2 * RAD), yb = y0 + 40;
    let s = `<rect x="${cx - hw}" y="${y0}" width="${2 * hw}" height="40" class="wp2"/>`;
    s += `<polygon points="${cx - hw},${yb} ${cx + hw},${yb} ${cx},${q(yb + la)}" class="wp"/>`;
    s += `<line x1="${cx - hw - 6}" y1="${yb}" x2="${cx + hw + 40}" y2="${yb}" class="gd"/>`;
    s += dim(cx - hw, y0 - 8, cx + hw, y0 - 8) + `<text x="${cx}" y="${y0 - 13}" text-anchor="middle">${o.dTxt}</text>`;
    s += dim(cx + hw + 24, yb, cx + hw + 24, yb + la) + `<text x="${cx + hw + 30}" y="${q(yb + la / 2 + 4)}">${o.laTxt}</text>`;
    const r = 14, a = (sg / 2) * RAD;
    s += `<path d="M${q(cx - r * Math.sin(a))} ${q(yb + la - r * Math.cos(a))}A${r} ${r} 0 0 1 ${q(cx + r * Math.sin(a))} ${q(yb + la - r * Math.cos(a))}" class="ln"/>`;
    s += `<text x="${cx}" y="${q(yb + la + 24)}" text-anchor="middle">${o.sTxt}</text>`;
    return s;
  }

  /* ---------- Wegbalken: Anlauf, Länge, Überlauf ---------- */
  function weg(y0, segs, o) {
    const tot = segs.reduce((a, g) => a + g.v, 0); if (!(tot > 0)) return '';
    const W = 320, MIN = 18; let raw = segs.map(g => g.v / tot * W), fixed = 0, free = 0;
    raw.forEach(w => { if (w < MIN) fixed += MIN; else free += w; });
    const k = free > 0 ? (W - fixed) / free : 1, ws = raw.map(w => (w < MIN ? MIN : w * k));
    let x = 20, s = `<text x="20" y="${y0 - 8}" class="t">Weg der Schneide</text>`;
    segs.forEach((g, i) => {
      s += `<rect x="${q(x)}" y="${y0}" width="${q(ws[i])}" height="26" class="${g.cls}"/>`;
      if (ws[i] >= 20) s += `<text x="${q(x + ws[i] / 2)}" y="${y0 + 17}" text-anchor="middle">${g.sym}</text>`;
      x += ws[i];
    });
    s += arrow(20, y0 + 32, 340, y0 + 32, 'ln', 6);
    s += o.legend.map((t, i) => `<text x="20" y="${y0 + 48 + i * 14}" class="${i ? 'm' : ''}">${t}</text>`).join('');
    return s;
  }
  const sgm = (cls, sym, v) => ({ cls, sym, v: fin(v) && v > 0 ? v : 0 });

  /* ---------- Bilder in den drei Simulationen (live aus dem Modell m) ---------- */
  function sim(kind, m) {
    if (!m || !C) return '';
    let s = '', h = 0, aria = '';
    if (kind === 'dreh') {
      s += `<text x="20" y="14" class="t">Schnittgeschwindigkeit</text><text x="205" y="14" class="t">Spanquerschnitt</text>`;
      s += kreis(86, 88, 42, { dTxt: 'Ø ' + F(m.d), vcTxt: 'vc', nTxt: 'n' });
      s += span(210, 36, m.ap, m.f, { fTxt: 'f = ' + F(m.f, 2) + ' mm/U', apTxt: 'ap = ' + F(m.ap, 1) + ' mm' });
      s += `<text x="205" y="150" class="m">A = ${F(m.A, 3)} mm²</text>`;
      s += weg(170, [sgm('wnf', 'la', m.la), sgm('okf', 'l', m.l), sgm('wnf', 'lü', m.lu)].filter(g => g.v > 0), { legend: [`la = ${F(m.la)} mm · l = ${F(m.l)} mm · lü = ${F(m.lu)} mm → L = ${F(m.L)} mm`, `${F(m.i)} Schnitt${m.i === 1 ? '' : 'e'} · vf = ${F(m.vf)} mm/min · th = ${F(m.th, 2)} min`] });
      h = 244; aria = 'Drehen: Stirnansicht mit Schnittgeschwindigkeit, Spanquerschnitt aus Zustellung und Vorschub, Weg der Schneide';
    } else if (kind === 'fraes') {
      s += `<text x="20" y="14" class="t">Fräser, Stirnansicht</text><text x="205" y="14" class="t">Vorschub je Umdrehung</text>`;
      s += kreis(86, 92, 42, { dTxt: 'Ø ' + F(m.d), vcTxt: 'vc', nTxt: 'n', z: m.z });
      s += zahn(200, 52, m.z, { fzTxt: 'fz = ' + F(m.fz, 2) + ' mm', fTxt: 'f = fz · z = ' + F(m.f, 2) + ' mm/U', zTxt: 'z = ' + F(m.z) + ' Schneiden', nums: true });
      s += weg(180, [sgm('wnf', 'la', m.la), sgm('okf', 'l', m.l), sgm('wnf', 'lü', m.lu)].filter(g => g.v > 0), { legend: [`la = ${F(m.la)} mm · l = ${F(m.l)} mm · lü = ${F(m.lu)} mm → L = ${F(m.L)} mm`, `n = ${F(m.n)} min⁻¹ · vf = ${F(m.vf)} mm/min · th = ${F(m.th, 2)} min`] });
      h = 254; aria = 'Fräsen: Fräser mit Schneiden, Zahnvorschub und Vorschub je Umdrehung, Weg des Fräsers';
    } else if (kind === 'bohr') {
      s += `<text x="20" y="14" class="t">Bohrer, Stirnansicht</text><text x="205" y="14" class="t">Bohrerspitze</text>`;
      s += kreis(86, 88, 42, { dTxt: 'Ø ' + F(m.d), vcTxt: 'vc', nTxt: 'n', z: 2 });
      s += spitze(262, 40, m.sigma, { dTxt: 'Ø ' + F(m.d), laTxt: 'la', sTxt: 'σ = ' + F(m.sigma) + '°' });
      s += weg(176, [sgm('wnf', 'la', m.la), sgm('okf', 't', m.t), sgm('wnf', 'lü', m.durch ? m.lu : 0)].filter(g => g.v > 0), { legend: [`la = ${F(m.la, 1)} mm · t = ${F(m.t)} mm${m.durch ? ' · lü = ' + F(m.lu) + ' mm' : ' (Sackloch)'} → L = ${F(m.L, 1)} mm`, `n = ${F(m.n)} min⁻¹ · vf = ${F(m.vf)} mm/min · th = ${F(m.th, 2)} min`] });
      h = 246; aria = 'Bohren: Stirnansicht mit Schnittgeschwindigkeit, Bohrerspitze mit Spitzenwinkel und Anschnitt, Bohrweg';
    } else return '';
    return `<svg class="zv" viewBox="0 0 360 ${h}" role="img" aria-label="${esc(aria)}">${s}</svg><p class="hint2" style="margin:4px 0 0">Skizzen nicht maßstäblich zueinander; die Zahlen unter den Bildern stammen aus dem Rechenweg.</p>`;
  }

  /* ---------- Skizzen zu Aufgaben: nur Größen, keine Zahlen, keine Formeln; im Prüfmodus leer ---------- */
  function schnitte() {
    let s = `<text x="20" y="14" class="t">Querschnitt Werkstück</text>`;
    const cx = 110, cy = 96, R1 = 58, R2 = 26;
    s += `<circle cx="${cx}" cy="${cy}" r="${R1}" class="wnf"/><circle cx="${cx}" cy="${cy}" r="${q(R2 + (R1 - R2) * 2 / 3)}" class="acf"/><circle cx="${cx}" cy="${cy}" r="${q(R2 + (R1 - R2) / 3)}" class="okf"/><circle cx="${cx}" cy="${cy}" r="${R2}" class="wp"/>`;
    s += dim(cx - R1, cy + R1 + 12, cx + R1, cy + R1 + 12) + `<text x="${cx}" y="${cy + R1 + 28}" text-anchor="middle">d₁ (Rohmaß)</text>`;
    s += dim(cx - R2, cy + 8, cx + R2, cy + 8) + `<text x="${cx}" y="${cy + 3}" text-anchor="middle">d₂</text>`;
    s += arrow(cx + R1 + 26, cy - R1 + 6, cx + R1 + 2, cy - 14, 'ln', 6);
    s += `<text x="${cx + R1 + 30}" y="${cy - R1 + 10}">ap je Schnitt (radial)</text><text x="${cx + R1 + 30}" y="${cy - R1 + 26}" class="m">Die Ringe sind die Schnitte.</text>`;
    s += `<text x="${cx + R1 + 30}" y="${cy + 30}" class="m">d₂ = Fertigmaß</text>`;
    return svg(206 + 0, 'Skizze: Rohling mit Fertigmaß und mehreren Schnitten als Ringe', s);
  }
  function sketchTask(kind) {
    if (kind === 'vc') return svg(176, 'Skizze: Stirnansicht mit Drehzahl und Schnittgeschwindigkeit', `<text x="20" y="14" class="t">Stirnansicht</text>` + kreis(110, 98, 44, { dTxt: 'd', vcTxt: 'vc', nTxt: 'n' }) + `<text x="190" y="70" class="m">Die Schneide läuft am Umfang.</text><text x="190" y="86" class="m">Je Umdrehung legt sie den</text><text x="190" y="102" class="m">Umfang zurück.</text>`);
    if (kind === 'span') return svg(150, 'Skizze: Spanquerschnitt aus Zustellung und Vorschub', `<text x="20" y="14" class="t">Spanquerschnitt</text>` + span(60, 30, 2, 0.5, { fTxt: 'f', apTxt: 'ap' }) + `<text x="215" y="70" class="m">Das Rechteck ist der</text><text x="215" y="86" class="m">Querschnitt des Spans.</text>`);
    if (kind === 'weg') return svg(112, 'Skizze: Anlaufweg, Länge und Überlaufweg', weg(26, [sgm('wnf', 'la', 1), sgm('okf', 'l', 5), sgm('wnf', 'lü', 1)], { legend: ['la = Anlaufweg · l = Länge · lü = Überlaufweg'] }));
    if (kind === 'fraes') return svg(176, 'Skizze: Fräser mit Schneiden und Zahnvorschub', `<text x="20" y="14" class="t">Fräser</text>` + kreis(86, 100, 42, { dTxt: 'd', vcTxt: 'vc', nTxt: 'n', z: 5 }) + zahn(200, 52, 5, { fzTxt: 'fz', fTxt: 'f', zTxt: 'z Schneiden' }));
    if (kind === 'bohr') return svg(148, 'Skizze: Bohrerspitze mit Spitzenwinkel', `<text x="20" y="14" class="t">Bohrerspitze</text>` + spitze(110, 34, 118, { dTxt: 'd', laTxt: 'la', sTxt: 'σ' }) + `<text x="200" y="56" class="m">Die Spitze taucht zuerst ein.</text><text x="200" y="72" class="m">Ihr Weg gehört zur Bohrzeit.</text>`);
    if (kind === 'schnitte') return schnitte();
    return '';
  }
  const TASK_KIND = {
    zer1: ['vc'], zer2: ['vc'], zer5: ['vc'], zer7: ['vc'], zer9: ['weg'], zer10: ['weg'], zer11: ['schnitte'], zer12: ['schnitte', 'weg'], zer13: ['span'], zer14: ['span'], zer15: ['span'],
    zer17: ['fraes'], zer18: ['fraes'], zer19: ['fraes'], zer20: ['fraes', 'weg'], zer21: ['fraes'], zer22: ['vc'], zer23: ['bohr'], zer24: ['bohr', 'weg'], zer25: ['bohr', 'weg']
  };
  function task(id, exam) {
    if (exam) return '';
    const k = TASK_KIND[id]; if (!k) return '';
    return box('Skizze zur Aufgabe (Größen ohne Zahlen)', k.map(sketchTask).join(''));
  }

  /* ---------- Richtwert-Tafel als Balken (log. Achse) ---------- */
  function tafel(proc) {
    const P = C.VC_TAB && C.VC_TAB[proc]; if (!P) return '';
    const lo = Math.log10(10), hi = Math.log10(600), x = v => q(130 + (Math.log10(clamp(v, 10, 600)) - lo) / (hi - lo) * 210);
    let s = '', y = 36;
    [10, 20, 50, 100, 200, 500].forEach(t => { s += `<line x1="${x(t)}" y1="28" x2="${x(t)}" y2="${28 + C.GRUPPEN.length * 34}" class="gd"/><text x="${x(t)}" y="22" text-anchor="middle" class="m">${t}</text>`; });
    C.GRUPPEN.forEach(g => {
      const w = P[g[0]] || {}; s += `<text x="124" y="${y + 13}" text-anchor="end">${esc(g[1])}</text>`;
      if (w.hss) s += `<rect x="${x(w.hss[0])}" y="${y}" width="${q(Math.max(3, x(w.hss[1]) - x(w.hss[0])))}" height="10" class="acf"/>`;
      if (w.hm) s += `<rect x="${x(w.hm[0])}" y="${y + 13}" width="${q(Math.max(3, x(w.hm[1]) - x(w.hm[0])))}" height="10" class="wnf"/>`;
      else s += `<text x="134" y="${y + 22}" class="m">Hartmetall: Herstellerangaben</text>`;
      y += 34;
    });
    s += `<rect x="20" y="${y + 4}" width="14" height="9" class="acf"/><text x="38" y="${y + 13}" class="m">HSS</text><rect x="72" y="${y + 4}" width="14" height="9" class="wnf"/><text x="90" y="${y + 13}" class="m">Hartmetall</text><text x="340" y="${y + 13}" text-anchor="end" class="m">vc in m/min, Achse logarithmisch</text>`;
    return `<svg class="zv" viewBox="0 0 360 ${y + 22}" role="img" aria-label="Richtwert-Fenster der Schnittgeschwindigkeit für ${esc(C.PROCS[proc] || proc)} je Werkstoff, HSS und Hartmetall">${s}</svg>`;
  }

  /* ---------- Drehzahlreihe mit Fenster ---------- */
  function nBand(win, d, sel) {
    const S = C.SERIES_STD; if (!win || !fin(d) || d <= 0 || !S) return '';
    const nLo = C.nFromVc(win[0], d), nHi = C.nFromVc(win[1], d); if (!fin(nLo) || !fin(nHi)) return '';
    const lo = Math.log10(30), hi = Math.log10(2600), x = v => q(20 + (Math.log10(clamp(v, 30, 2600)) - lo) / (hi - lo) * 320);
    let s = `<rect x="${x(nLo)}" y="20" width="${q(Math.max(3, x(nHi) - x(nLo)))}" height="46" class="okf"/><line x1="20" y1="43" x2="340" y2="43" class="ln"/>`;
    S.forEach((n, i) => {
      const inw = C.vcStatus(C.vc(d, n), win) === 'ok', on = sel === n;
      s += `<circle cx="${x(n)}" cy="43" r="${on ? 7 : 4.5}" style="fill:${on ? 'var(--accent,#37f)' : inw ? 'var(--ok,#2a2)' : 'var(--mute,#889)'};stroke:var(--sv-ln,#222);stroke-width:${on ? 1.8 : .8}"/><text x="${x(n)}" y="${i % 2 ? 84 : 76}" text-anchor="middle" class="m">${n}</text>`;
    });
    s += `<text x="${q((+x(nLo) + +x(nHi)) / 2)}" y="14" text-anchor="middle" class="m">Fenster: ${F(nLo, 0)} bis ${F(nHi, 0)} min⁻¹</text>`;
    return `<svg class="zv" viewBox="0 0 360 94" role="img" aria-label="Drehzahlreihe der Maschine mit dem Drehzahlfenster zum Richtwert">${s}</svg><p class="hint2" style="margin:2px 0 6px">Punkte: Stufen der Maschine in min⁻¹ (grün: im Fenster), Achse logarithmisch.</p>`;
  }

  /* leere Platzhalter nachfüllen (Aufgaben, die vor dem Laden dieser Datei gezeichnet wurden) */
  function fill() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-zv]:empty').forEach(e => { try { e.innerHTML = task(e.dataset.zv, e.dataset.exam === '1'); } catch (x) {} });
  }

  const api = { sim, task, tafel, nBand, fill };
  root.ZERVIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* zerui.js hat den ersten Reiter schon gezeichnet, bevor diese Datei da war: betroffenen Reiter einmal neu zeichnen */
  if (typeof document !== 'undefined') {
    try {
      fill();
      const on = document.querySelector('#mid').dataset.tab, tb = document.getElementById('tab-' + on);
      if (tb && ['dreh', 'fraes', 'bohr'].indexOf(on) >= 0) tb.click();
      else if (on === 'tafel') { const p = document.querySelector('#tfProc .on'); if (p) p.click(); }
    } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
