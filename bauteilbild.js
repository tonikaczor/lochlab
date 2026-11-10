'use strict';
/* Tonfunk Bauteilbilder (window.BAUTEILBILD, per Node testbar): realistische Bauformen als SVG-Fragmente für das Netzteil-Lab (ntsviz.js)
   und das Wechselstrom-Lab (wslviz.js). Reine Anzeige, keine Fachrechnung.
   - Alle Funktionen liefern eine Zeichenkette mit SVG-Elementen (kein ganzes <svg>); Koordinaten in px, Ursprung wie angegeben.
   - Größen sind Richtwerte aus gängigen Datenblättern (Körper in mm mal Maßstab s in px je mm). Sie zeigen die Größenordnung,
     keine Herstellerdaten; Texte im Lab sagen das ("Größe schematisch").
   - Farben nur über CSS-Variablen (--bb-*), die BAUTEILBILD.css definiert; Körperfarben der Bauteile sind feste Objektfarben (hsl),
     Umrisse und Text folgen dem Thema (--fg, --mute). Keine Bewegung, kein Hover. */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const r1 = v => Math.round((fin(v) ? v : 0) * 10) / 10;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const nde = (v, d) => { v = fin(v) ? v : 0; let s = v.toFixed(d == null ? 1 : d); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s.replace('.', ',').replace(/^-/, '−'); };
  /* Zahl mit Einheitenvorsatz und Dezimalkomma: eng(0.0047,'A') = "4,7 mA" */
  function eng(v, unit, sig) {
    unit = unit || ''; if (!fin(v)) return '–' + (unit ? ' ' + unit : ''); if (v === 0) return '0' + (unit ? ' ' + unit : '');
    const P = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']]; sig = sig || 3;
    let e3 = cl(Math.floor(Math.log10(Math.abs(v)) / 3) * 3, -12, 9), m = v / Math.pow(10, e3);
    const dg = x => Math.max(0, Math.abs(x) >= 100 ? sig - 3 : Math.abs(x) >= 10 ? sig - 2 : sig - 1);
    let s = nde(m, dg(m));
    if (Math.abs(parseFloat(s.replace(',', '.').replace('−', '-'))) >= 1000 && e3 < 9) { e3 += 3; m = v / Math.pow(10, e3); s = nde(m, dg(m)); }
    return s + ' ' + (P.find(q => q[0] === e3) || [0, ''])[1] + unit;
  }

  /* ---------- Farbcode und Normreihen ---------- */
  const CODE = ['hsl(0 0% 8%)', 'hsl(25 60% 30%)', 'hsl(0 75% 48%)', 'hsl(28 95% 52%)', 'hsl(52 95% 52%)', 'hsl(130 60% 38%)', 'hsl(215 75% 48%)', 'hsl(280 55% 50%)', 'hsl(0 0% 55%)', 'hsl(0 0% 96%)'];
  const GOLD = 'hsl(43 80% 52%)', SILVER = 'hsl(0 0% 78%)';
  const CODENAME = ['schwarz', 'braun', 'rot', 'orange', 'gelb', 'grün', 'blau', 'violett', 'grau', 'weiß'];
  /* Ringe eines Widerstands: {bands:[Farbe..], names:[..]}; 4 Ringe (2 Stellen, Faktor, Gold = 5 %) bei zweistelligen Werten, sonst 5 Ringe (3 Stellen, Faktor, Braun = 1 %) */
  function resBands(ohm) {
    if (!fin(ohm) || ohm <= 0) return { bands: [], names: [], n: 0 };
    const ex = Math.floor(Math.log10(ohm)); let m3 = Math.round(ohm / Math.pow(10, ex - 2)), e = ex - 2;
    if (m3 >= 1000) { m3 = Math.round(m3 / 10); e += 1; }
    const two = m3 % 10 === 0; let d = String(m3).split('').map(Number), mult;
    if (two) { d = d.slice(0, 2); mult = e + 1; } else mult = e;
    const mc = mult === -1 ? GOLD : mult === -2 ? SILVER : (mult >= 0 && mult <= 9 ? CODE[mult] : null), mn = mult === -1 ? 'gold' : mult === -2 ? 'silber' : (mult >= 0 && mult <= 9 ? CODENAME[mult] : '');
    if (!mc) return { bands: [], names: [], n: 0 };
    const bands = d.map(x => CODE[x]).concat([mc, two ? GOLD : CODE[1]]), names = d.map(x => CODENAME[x]).concat([mn, two ? 'gold' : 'braun']);
    return { bands, names, n: bands.length };
  }
  /* Normstufen der Nennleistung (W) und Auswahl: kleinste Stufe, die mindestens die doppelte Verlustleistung trägt (Faustwert, Reserve) */
  const PW = [0.125, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  function pickPw(p) { p = fin(p) && p > 0 ? p : 0; for (let i = 0; i < PW.length; i++) if (PW[i] >= 2 * p - 1e-12) return PW[i]; return PW[PW.length - 1]; }
  const UREIHE = [6.3, 10, 16, 25, 35, 50, 63, 100, 160, 250, 400];
  function pickU(u, reserve) { u = fin(u) && u > 0 ? u : 0; const need = u * (reserve || 1.25); for (let i = 0; i < UREIHE.length; i++) if (UREIHE[i] >= need - 1e-12) return UREIHE[i]; return UREIHE[UREIHE.length - 1]; }
  const pwName = p => nde(p, p < 1 ? (p === 0.125 ? 3 : 2) : 0) + ' W';

  /* ---------- Körpermaße (mm) ---------- */
  const RES = { 0.125: { L: 3.6, D: 1.6 }, 0.25: { L: 6.3, D: 2.5 }, 0.5: { L: 9, D: 3.2 }, 1: { L: 11, D: 4.5 }, 2: { L: 15, D: 5 } };
  const lerpTab = (tab, x) => { if (x <= tab[0][0]) return tab[0].slice(1); for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = (x - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t); } return tab[tab.length - 1].slice(1); };
  /* Elko radial: Durchmesser und Höhe in mm je lg(C in µF), typisch für 25 V */
  const ELKO = [[1, 5, 11], [1.7, 5, 11], [2, 6.3, 11], [2.34, 6.3, 12], [2.67, 8, 12], [3, 10, 16], [3.34, 12.5, 20], [3.67, 16, 25], [4, 18, 35]];
  /* Folienkondensator (Rechteckbecher) Breite und Höhe in mm je lg(C in nF) */
  const FOLIE = [[0, 7, 6], [2, 10, 8], [3, 13, 11], [3.67, 18, 14], [4, 26, 18], [4.67, 32, 25]];

  /* ---------- Hilfen ---------- */
  const g = (inner, cls, tr) => `<g${cls ? ` class="${cls}"` : ''}${tr ? ` transform="${tr}"` : ''}>${inner}</g>`;
  const lead = (x0, y0, x1, y1) => `<line class="bb-lead" x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(x1)}" y2="${r1(y1)}"/>`;
  const text = (x, y, t, o) => { o = o || {}; return `<text class="bb-t${o.b ? ' b' : ''}${o.cls ? ' ' + o.cls : ''}" x="${r1(x)}" y="${r1(y)}" text-anchor="${o.a || 'middle'}"${o.fill ? ` style="fill:${o.fill}"` : ''}>${esc(t)}</text>`; };
  /* Wärmehof (0..1) um ein Bauteil: rot, ohne Zahl; Stärke nur für die Anschauung */
  const halo = (cx, cy, rx, ry, heat) => heat > 0.05 ? `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" class="bb-heat" opacity="${r1(cl(heat, 0, 1) * 0.4)}"/>` : '';

  /* ---------- Bauteile ---------- */
  /* Widerstand axial, waagerecht, Mitte cx cy. o: { ohm, pw (Nennleistung W), s (px/mm), lead (px je Anschluss), heat 0..1 } -> { svg, w, h } */
  function resistor(cx, cy, o) {
    o = o || {}; const s = o.s || 6, pw = RES[o.pw] ? o.pw : (o.pw > 2 ? 5 : 0.25), ld = o.lead == null ? 14 : o.lead;
    if (pw === 5) { /* Zementwiderstand (Quader), ab 10 W länger */
      const big10 = o.pw >= 10, L = (big10 ? 48 : 22) * s, H = (big10 ? 10 : 9) * s, x0 = cx - L / 2, y0 = cy - H / 2;
      return { svg: lead(x0 - ld, cy, x0, cy) + lead(x0 + L, cy, x0 + L + ld, cy) + halo(cx, cy, L * 0.7, H * 1.1, o.heat) + `<rect class="bb-cement" x="${r1(x0)}" y="${r1(y0)}" width="${r1(L)}" height="${r1(H)}" rx="${r1(s * 0.6)}"/>` + text(cx, cy + 3.5, nde(o.pw >= 5 ? o.pw : 5, 0) + ' W', { cls: 'sm', fill: 'hsl(0 0% 15%)' }), w: L + 2 * ld, h: H };
    }
    const d = RES[pw], L = d.L * s, H = d.D * s, x0 = cx - L / 2, y0 = cy - H / 2, big = pw >= 1, bd = o.bands === false ? { n: 0 } : resBands(o.ohm);
    let sv = lead(x0 - ld, cy, x0, cy) + lead(x0 + L, cy, x0 + L + ld, cy) + halo(cx, cy, L * 0.8, H * 1.4, o.heat);
    /* Hantelform: Enden etwas dicker */
    sv += `<rect class="${big ? 'bb-resb' : 'bb-res'}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(L)}" height="${r1(H)}" rx="${r1(H * 0.38)}"/>`;
    if (bd.n) {
      const bw = Math.max(1.4, L * 0.075), span = L * 0.62, x1 = x0 + L * 0.16;
      bd.bands.forEach((c, i) => {
        const last = i === bd.n - 1, x = last ? x0 + L * 0.84 - bw / 2 : x1 + i * (bd.n === 5 ? span / 4.6 : span / 3.4);
        sv += `<rect x="${r1(x)}" y="${r1(y0 + 0.4)}" width="${r1(bw)}" height="${r1(H - 0.8)}" fill="${c}"/>`;
      });
    }
    return { svg: sv, w: L + 2 * ld, h: H };
  }
  /* Elektrolytkondensator radial, stehend; Mitte unten (Anschlüsse nach unten). o: { c (F), s, lead } */
  function elko(cx, cy, o) {
    o = o || {}; const s = o.s || 5, cu = Math.max(1e-6, (o.c || 1e-4) * 1e6), t = lerpTab(ELKO, Math.log10(cu)), D = t[0] * s, H = t[1] * s, ld = o.lead == null ? 10 : o.lead;
    const x0 = cx - D / 2, y0 = cy - H, pitch = Math.max(2, D * 0.4);
    let sv = `<line class="bb-lead" x1="${r1(cx - pitch / 2)}" y1="${r1(cy)}" x2="${r1(cx - pitch / 2)}" y2="${r1(cy + ld)}"/><line class="bb-lead" x1="${r1(cx + pitch / 2)}" y1="${r1(cy)}" x2="${r1(cx + pitch / 2)}" y2="${r1(cy + ld + 3)}"/>`;
    sv += `<rect class="bb-elko" x="${r1(x0)}" y="${r1(y0)}" width="${r1(D)}" height="${r1(H)}" rx="${r1(D * 0.08)}"/>`;
    sv += `<rect class="bb-elkoneg" x="${r1(x0 + D * 0.08)}" y="${r1(y0 + H * 0.1)}" width="${r1(D * 0.2)}" height="${r1(H * 0.8)}"/>`;
    const nm = Math.max(1, Math.min(4, Math.floor(H / (s * 3.2)))); for (let i = 0; i < nm; i++) sv += `<text class="bb-t sm" x="${r1(x0 + D * 0.18)}" y="${r1(y0 + H * 0.1 + (i + 0.62) * (H * 0.8) / nm)}" text-anchor="middle" style="fill:hsl(0 0% 100%)">−</text>`;
    sv += `<ellipse class="bb-elkotop" cx="${r1(cx)}" cy="${r1(y0 + 1.5)}" rx="${r1(D / 2 - 0.5)}" ry="1.6"/>`;
    sv += `<text class="bb-t sm" x="${r1(cx + D * 0.12)}" y="${r1(y0 + H * 0.52)}" text-anchor="middle" style="fill:hsl(0 0% 95%)">${esc(o.label || '')}</text>`;
    return { svg: sv, w: D, h: H + ld, D, H };
  }
  /* Folienkondensator (Rechteckbecher), stehend, Mitte unten. o: { c (F), s } */
  function folie(cx, cy, o) {
    o = o || {}; const s = o.s || 4.5, cn = Math.max(1, (o.c || 1e-7) * 1e9), t = lerpTab(FOLIE, Math.log10(cn)), W = t[0] * s, H = t[1] * s, ld = o.lead == null ? 10 : o.lead;
    const x0 = cx - W / 2, y0 = cy - H, pitch = Math.max(3, W * 0.7);
    return { svg: lead(cx - pitch / 2, cy, cx - pitch / 2, cy + ld) + lead(cx + pitch / 2, cy, cx + pitch / 2, cy + ld) + `<rect class="bb-folie" x="${r1(x0)}" y="${r1(y0)}" width="${r1(W)}" height="${r1(H)}" rx="${r1(s * 0.7)}"/><rect class="bb-folie2" x="${r1(x0 + W * 0.1)}" y="${r1(y0 + H * 0.12)}" width="${r1(W * 0.8)}" height="${r1(H * 0.1)}" rx="1"/>` + (o.label ? text(cx, y0 + H * 0.62, o.label, { cls: 'sm', fill: 'hsl(0 0% 12%)' }) : ''), w: W, h: H + ld, W, H };
  }
  /* Keramikscheibe, stehend */
  function keramik(cx, cy, o) {
    o = o || {}; const s = o.s || 4.5, D = 6 * s, ld = 10;
    return { svg: lead(cx - D * 0.2, cy, cx - D * 0.2, cy + ld) + lead(cx + D * 0.2, cy, cx + D * 0.2, cy + ld) + `<path class="bb-cer" d="M${r1(cx - D / 2)} ${r1(cy)}C${r1(cx - D / 2)} ${r1(cy - D * 0.9)} ${r1(cx + D / 2)} ${r1(cy - D * 0.9)} ${r1(cx + D / 2)} ${r1(cy)}Z"/>`, w: D, h: D * 0.7 + ld };
  }
  /* Diode axial, waagerecht. o: { typ:'si'|'schottky'|'zener', s, heat }, Kathode (Ring) rechts */
  function diode(cx, cy, o) {
    o = o || {}; const z = o.typ === 'zener', s = o.s || 6, L = (z ? 3.04 : 5.2) * s * (z ? 1.5 : 1), H = (z ? 1.6 : 2.7) * s * (z ? 1.5 : 1), x0 = cx - L / 2, y0 = cy - H / 2, ld = o.lead == null ? 14 : o.lead, bw = Math.max(2.2, L * 0.16);
    return { svg: lead(x0 - ld, cy, x0, cy) + lead(x0 + L, cy, x0 + L + ld, cy) + halo(cx, cy, L * 0.8, H * 1.4, o.heat) + `<rect class="${z ? 'bb-glas' : 'bb-diode'}" x="${r1(x0)}" y="${r1(y0)}" width="${r1(L)}" height="${r1(H)}" rx="${r1(H * 0.25)}"/><rect class="${z ? 'bb-glasband' : 'bb-band'}" x="${r1(x0 + L - bw - L * 0.07)}" y="${r1(y0)}" width="${r1(bw)}" height="${r1(H)}"/>`, w: L + 2 * ld, h: H };
  }
  /* Brückengleichrichter-Modul (flach, 4 Anschlüsse) */
  function bruecke(cx, cy, o) {
    o = o || {}; const s = o.s || 3.2, W = 22 * s, H = 18 * s, x0 = cx - W / 2, y0 = cy - H / 2, pin = [['~', 0.14], ['+', 0.38], ['−', 0.62], ['~', 0.86]];
    let sv = ''; pin.forEach(p => { sv += lead(x0 + W * p[1], y0 + H, x0 + W * p[1], y0 + H + 14); sv += text(x0 + W * p[1], y0 + H + 26, p[0], { cls: 'sm' }); });
    return { svg: sv + `<rect class="bb-diode" x="${r1(x0)}" y="${r1(y0)}" width="${r1(W)}" height="${r1(H)}" rx="${r1(s)}"/><circle class="bb-band" cx="${r1(x0 + W * 0.12)}" cy="${r1(y0 + H * 0.16)}" r="${r1(s * 0.9)}"/>` + text(cx, cy + 4, o.label || 'Brücke', { cls: 'sm', fill: 'hsl(0 0% 88%)' }), w: W, h: H + 28 };
  }
  /* Spule: Ringkerndrossel (Kern ocker/grau, Kupferwicklung). o: { turns (Anzahl der gezeichneten Windungen), s } */
  function ringspule(cx, cy, o) {
    o = o || {}; const R = (o.R || 26), r = R * 0.52, n = cl(Math.round(o.turns || 14), 6, 26);
    let sv = `<circle class="bb-ferrit" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R)}"/><circle class="bb-hole" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), x1 = cx + ca * (r - 2), y1 = cy + sa * (r - 2), x2 = cx + ca * (R + 3), y2 = cy + sa * (R + 3); sv += `<path class="bb-cu" d="M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}"/>`; }
    return { svg: sv, w: 2 * R + 8, h: 2 * R + 8 };
  }
  /* Luftspule: Schraubenlinie in Seitenansicht, waagerecht */
  function luftspule(cx, cy, o) {
    o = o || {}; const n = cl(Math.round(o.turns || 6), 3, 10), W = o.W || 70, H = o.H || 18, x0 = cx - W / 2, st = W / n; let sv = lead(x0 - 12, cy + H / 2, x0, cy + H / 2) + lead(x0 + W, cy + H / 2, x0 + W + 12, cy + H / 2);
    for (let i = 0; i < n; i++) sv += `<path class="bb-cu" d="M${r1(x0 + i * st)} ${r1(cy + H / 2)}C${r1(x0 + i * st + st * 0.1)} ${r1(cy - H / 2)} ${r1(x0 + i * st + st * 0.9)} ${r1(cy - H / 2)} ${r1(x0 + (i + 1) * st)} ${r1(cy + H / 2)}"/>`;
    return { svg: sv, w: W + 24, h: H };
  }
  /* Transformator mit EI-Kern. Wicklungen in den Fenstern: innen Primär (orange), außen Sekundär (grün).
     o: { n1, n2, i1, i2 (A, nur für Drahtdicke), W, H, heat (0..1 Kupfer), dc } */
  function trafoEI(cx, cy, o) {
    o = o || {}; const W = o.W || 150, H = o.H || 120, x0 = cx - W / 2, y0 = cy - H / 2, t = W * 0.14, win = (W - 3 * t) / 2 * 1; // Fensterbreite
    const wy0 = y0 + t, wh = H - 2 * t, xl = x0 + t, xr = x0 + t + win + t;
    const wire = (i, ref) => cl(1 + 3.2 * Math.sqrt(Math.max(0, i) / ref), 1, 4.4), stripes = (x, w, y, h, n, th, cls) => { let q = '', k = cl(Math.round(n), 3, 18), st = h / k; for (let i = 0; i < k; i++) q += `<line class="${cls}" x1="${r1(x)}" y1="${r1(y + (i + 0.5) * st)}" x2="${r1(x + w)}" y2="${r1(y + (i + 0.5) * st)}" stroke-width="${r1(Math.min(th, st * 0.8))}"/>`; return q; };
    const n1 = cl(Math.log10(Math.max(2, o.n1 || 100)) * 5, 4, 17), n2 = cl(Math.log10(Math.max(2, o.n2 || 10)) * 5, 4, 17);
    const th1 = wire(o.i1 == null ? 0.2 : o.i1, 3), th2 = wire(o.i2 == null ? 2 : o.i2, 3);
    const w1 = win * 0.5, w2 = win * 0.5;
    let sv = `<rect class="bb-kern" x="${r1(x0)}" y="${r1(y0)}" width="${r1(W)}" height="${r1(H)}" rx="3"/>`;
    [xl, xr].forEach((x, k) => { sv += `<rect class="bb-fenster" x="${r1(x)}" y="${r1(wy0)}" width="${r1(win)}" height="${r1(wh)}"/>`; });
    /* Mittelschenkel zwischen den Fenstern; Wicklungen liegen am Mittelschenkel (innen Primär) */
    const cx1 = xl + win - w1, cx2 = xr; // links: Primär innen (rechts im Fenster), rechts: Primär innen (links im Fenster)
    sv += stripes(cx1, w1, wy0 + 2, wh - 4, n1, th1, 'bb-wp') + stripes(xl, w2, wy0 + 2, wh - 4, n2, th2, 'bb-ws');
    sv += stripes(cx2, w1, wy0 + 2, wh - 4, n1, th1, 'bb-wp') + stripes(xr + win - w2, w2, wy0 + 2, wh - 4, n2, th2, 'bb-ws');
    if (o.heat > 0.02) sv += `<rect class="bb-heat" x="${r1(xl)}" y="${r1(wy0)}" width="${r1(win)}" height="${r1(wh)}" opacity="${r1(cl(o.heat, 0, 1) * 0.35)}"/><rect class="bb-heat" x="${r1(xr)}" y="${r1(wy0)}" width="${r1(win)}" height="${r1(wh)}" opacity="${r1(cl(o.heat, 0, 1) * 0.35)}"/>`;
    /* Flusspfad (gestrichelt) durch Mittelschenkel und Joch, nur bei Wechselspannung */
    if (!o.dc) { const mx = x0 + W / 2, yy = y0 + t / 2; sv += `<path class="bb-fluss" d="M${r1(mx)} ${r1(yy + t * 0.2)}L${r1(x0 + t / 2)} ${r1(yy + t * 0.2)}L${r1(x0 + t / 2)} ${r1(y0 + H - t / 2)}L${r1(mx)} ${r1(y0 + H - t / 2)}M${r1(mx)} ${r1(yy + t * 0.2)}L${r1(x0 + W - t / 2)} ${r1(yy + t * 0.2)}L${r1(x0 + W - t / 2)} ${r1(y0 + H - t / 2)}L${r1(mx)} ${r1(y0 + H - t / 2)}"/>`; }
    return { svg: sv, w: W, h: H, win, wy0, wh, xl, xr };
  }
  /* Gehäuse TO-220 (Leistungs-MOSFET, Spannungsregler), stehend, Mitte der Pinreihe cx, Unterkante der Pins cy. o: { s, pins:[a,b,c], heat 0..1 } */
  function to220(cx, cy, o) {
    o = o || {}; const s = o.s || 4, W = 10.2 * s, Hb = 9 * s, Ht = 6.2 * s, pl = 12.7 * s * 0.7, pitch = 2.54 * s, top = cy - pl - Hb - Ht;
    let sv = '';
    [-1, 0, 1].forEach((k, i) => { sv += lead(cx + k * pitch, cy - pl, cx + k * pitch, cy); if (o.pins && o.pins[i]) sv += text(cx + k * pitch, cy + 12, o.pins[i], { cls: 'sm' }); });
    sv += halo(cx, top + (Ht + Hb) / 2, W * 0.95, (Ht + Hb) * 0.62, o.heat);
    sv += `<rect class="bb-tab" x="${r1(cx - W / 2)}" y="${r1(top)}" width="${r1(W)}" height="${r1(Ht + 1)}" rx="2"/><circle class="bb-hole" cx="${r1(cx)}" cy="${r1(top + Ht * 0.45)}" r="${r1(1.7 * s * 0.5 + 0.6)}"/>`;
    sv += `<rect class="bb-plast" x="${r1(cx - W / 2)}" y="${r1(top + Ht)}" width="${r1(W)}" height="${r1(Hb)}" rx="1.5"/>` + (o.label ? text(cx, top + Ht + Hb * 0.58, o.label, { cls: 'sm', fill: 'hsl(0 0% 88%)' }) : '');
    return { svg: sv, w: W, h: Ht + Hb + pl, top, W };
  }
  /* Z-Diode / Glasdiode kommt über diode({typ:'zener'}). Senkrechte Drehung eines Fragments um (cx,cy) */
  const rot = (svg, cx, cy, deg) => g(svg, '', `rotate(${deg} ${r1(cx)} ${r1(cy)})`);
  /* Quelle als Kreis mit Sinus oder Gleichspannungszeichen */
  function quelle(cx, cy, o) {
    o = o || {}; const R = o.R || 16;
    return { svg: `<circle class="bb-src" cx="${r1(cx)}" cy="${r1(cy)}" r="${R}"/>` + (o.dc ? `<text class="bb-t b" x="${r1(cx)}" y="${r1(cy + 5)}" text-anchor="middle">+ −</text>` : `<path class="bb-wire" d="M${r1(cx - R * 0.55)} ${r1(cy)}C${r1(cx - R * 0.3)} ${r1(cy - R * 0.7)} ${r1(cx - R * 0.1)} ${r1(cy - R * 0.7)} ${r1(cx)} ${r1(cy)}S${r1(cx + R * 0.3)} ${r1(cy + R * 0.7)} ${r1(cx + R * 0.55)} ${r1(cy)}"/>`), w: 2 * R, h: 2 * R };
  }

  const CSS = `
.bb-lead{stroke:var(--bb-lead);stroke-width:2.2;stroke-linecap:round}
.bb-wire{stroke:var(--fg);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.bb-wire.u{stroke:var(--accent)}.bb-wire.i{stroke:var(--warn)}
.bb-res{fill:hsl(40 50% 72%);stroke:var(--bb-edge);stroke-width:1}.bb-resb{fill:hsl(205 40% 62%);stroke:var(--bb-edge);stroke-width:1}
.bb-cement{fill:hsl(35 25% 78%);stroke:var(--bb-edge);stroke-width:1}
.bb-diode{fill:hsl(220 12% 18%);stroke:var(--bb-edge);stroke-width:1}.bb-band{fill:hsl(0 0% 82%)}
.bb-glas{fill:hsl(24 70% 52%);stroke:var(--bb-edge);stroke-width:1}.bb-glasband{fill:hsl(0 0% 10%)}
.bb-elko{fill:hsl(215 55% 30%);stroke:var(--bb-edge);stroke-width:1}.bb-elkoneg{fill:hsl(210 10% 72%);opacity:.55}.bb-elkotop{fill:hsl(210 10% 62%)}
.bb-folie{fill:hsl(38 88% 55%);stroke:var(--bb-edge);stroke-width:1}.bb-folie2{fill:hsl(38 60% 40%);opacity:.5}
.bb-cer{fill:hsl(32 85% 55%);stroke:var(--bb-edge);stroke-width:1}
.bb-ferrit{fill:hsl(30 12% 42%);stroke:var(--bb-edge);stroke-width:1}.bb-hole{fill:var(--panel2);stroke:var(--bb-edge);stroke-width:1}
.bb-cu{stroke:hsl(22 75% 52%);stroke-width:3;fill:none;stroke-linecap:round}
.bb-kern{fill:hsl(210 10% 52%);stroke:var(--bb-edge);stroke-width:1}.bb-fenster{fill:var(--panel2);stroke:var(--bb-edge);stroke-width:1}
.bb-wp{stroke:hsl(28 95% 55%);stroke-linecap:round}.bb-ws{stroke:hsl(140 55% 45%);stroke-linecap:round}
.bb-fluss{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:6 4}
.bb-plast{fill:hsl(220 12% 18%);stroke:var(--bb-edge);stroke-width:1}.bb-tab{fill:hsl(210 8% 70%);stroke:var(--bb-edge);stroke-width:1}
.bb-heat{fill:hsl(8 90% 55%)}
.bb-src{fill:var(--panel2);stroke:var(--fg);stroke-width:2}
.bb-t{fill:var(--fg);font:600 12px system-ui,sans-serif}.bb-t.sm{font-size:11px}.bb-t.b{font-weight:700}.bb-t.mute{fill:var(--mute);font-weight:500}
`;
  const VARS = ':root{--bb-lead:hsl(0 0% 55%);--bb-edge:var(--mute)}';
  const API = { resistor, elko, folie, keramik, diode, bruecke, ringspule, luftspule, trafoEI, to220, quelle, rot, g, lead, text, halo, resBands, pickPw, pickU, pwName, eng, nde, esc, r1, cl, fin, PW, UREIHE, RES, CODENAME, CSS: VARS + CSS };
  root.BAUTEILBILD = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
