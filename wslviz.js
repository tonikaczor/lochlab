'use strict';
/* Tonfunk Wechselstrom-Lab: Visualisierungen (Lab-Kennung 'wsl'), window.WSL_VIZ, per Node testbar (module.exports).
   Hängt sich ohne Änderung an wslui.js an (leiser Takt), Bauteilbilder kommen aus bauteilbild.js:
   1. Schmale Bildschirme (Handy, Tablet hochkant): Das Prüfstandbild bekommt ein hohes Format und verzichtet auf die doppelte
      Ampel-/Sichtenzeile im Bild (die steht schon darüber als Text). Vorher bekamen Schaltbild, Zeitbild, Zeigerbild und Dreieck
      zusammen zu wenig Höhe, und es blieb ein Textrest. Ab 700 px Breite bleibt alles wie bisher.
   2. Karte "Bauteile und Bauformen": echte Bauformen (Widerstand mit Farbringen und Bauform nach Verlustleistung, Spule, Folienkondensator,
      Transformator mit EI-Kern, Drehstromlast) mit den Messwerten des Prüfstands und Balken, die live mitlaufen
      (Spannungen und Ströme geometrisch, Leistungsfluss S, P, Q, Strom vor und nach der Kompensation, Dämpfung am Filter).
   Aufgabenintegrität: Die Karte erscheint nicht während einer Aufgabe (S.task); sie zeigt nur Größen, die der Prüfstand ohnehin als
   Messgerät zeigt. Größen und Bauformen sind Richtwerte (Übungswerte), keine Herstellerdaten. Farben nur über CSS-Variablen (und
   hsl für Objektfarben). Keine Animation. */
(function (root) {
  const B = root.BAUTEILBILD || (typeof require !== 'undefined' ? require('./bauteilbild.js') : null);
  const fin = v => typeof v === 'number' && isFinite(v);
  const num = (v, d) => (fin(v) ? v : (d == null ? 0 : d));
  const eng = B ? B.eng : String, esc = B ? B.esc : String, nde = B ? B.nde : String;
  const W1 = 160, H1 = 124;
  const cap = c => { const u = num(c) * 1e6; return u >= 1 ? nde(u, u >= 100 ? 0 : 1) + ' µF' : nde(num(c) * 1e9, 0) + ' nF'; };
  const tile = (vw, vh, svg, title, sub, wide) => ({ vw, vh, svg, title, sub, wide: !!wide });
  const lab = (x, y, t, o) => B.text(x, y, t, o);
  /* Farben nach der Konvention des Labs: Spannung blau, Strom orange, Wirkleistung grün, Blindanteil violett, Scheinleistung gelb */
  const COL = { u: 'var(--wv-u)', i: 'var(--wv-i)', p: 'var(--wv-p)', q: 'var(--wv-q)', s: 'var(--wv-s)', x: 'var(--mute)' };

  /* ---------- Balkenkachel: items [{ name, val, unit, kind, max?, mark? }]; gemeinsame Skala (max) ---------- */
  function barsTile(title, sub, items, o) {
    o = o || {}; const n = items.length, rh = 28, vh = 12 + n * rh + (o.foot ? 18 : 0), L = 62, R = 232, mx = o.max || Math.max(1e-12, ...items.map(q => num(q.val)));
    let sv = '';
    items.forEach((q, i) => {
      const y = 12 + i * rh, w = B.cl(num(q.val) / mx, 0, 1) * (R - L);
      sv += lab(L - 6, y + 12, q.name, { a: 'end', fill: COL[q.kind] || 'var(--fg)' }) + `<rect x="${L}" y="${y}" width="${R - L}" height="14" rx="4" class="wv-track"/><rect x="${L}" y="${y}" width="${B.r1(Math.max(w, num(q.val) > 0 ? 2 : 0))}" height="14" rx="4" fill="${COL[q.kind] || 'var(--accent)'}"/>`;
      if (q.mark != null && q.mark > 0) { const mxp = L + B.cl(q.mark / mx, 0, 1) * (R - L); sv += `<line x1="${B.r1(mxp)}" y1="${y - 3}" x2="${B.r1(mxp)}" y2="${y + 17}" class="wv-mark"/>`; }
      sv += lab(R + 6, y + 12, q.text || eng(q.val, q.unit), { a: 'start' });
    });
    if (o.foot) sv += lab(170, vh - 4, o.foot, { cls: 'sm mute' });
    return tile(340, vh, sv, title, sub, true);
  }
  /* Widerstand mit Bauform nach Verlustleistung */
  function resTile(name, ohm, p, sub) {
    const known = fin(p) && p > 0, pw = known ? B.pickPw(p) : 0.25, cem = pw > 2, big = cem ? 5 : pw, s = cem ? (pw >= 10 ? 1.7 : 3.4) : (big >= 1 ? 6.6 : 8.5);
    const r = B.resistor(W1 / 2, 54, { ohm, pw: cem ? pw : big, s, lead: cem ? 10 : 18 }), bd = cem ? { n: 0 } : B.resBands(ohm);
    return tile(W1, H1, r.svg + lab(W1 / 2, 92, name + ' = ' + eng(ohm, 'Ω')) + lab(W1 / 2, 110, (known ? 'Bauform ' : 'z. B. ') + (cem ? B.pwName(pw) + (pw > 10 ? ' Leistungs-R.' : ' Zement') : B.pwName(big)), { cls: 'sm mute' }),
      'Widerstand ' + name, (known ? sub + (sub ? ' ' : '') + 'Verlustleistung ' + eng(p, 'W') + '. Faustwert: mindestens die doppelte Belastbarkeit, hier ' + B.pwName(pw) + '.' : (sub || 'Hier entsteht keine Verlustleistung.')) + (bd.n ? ' Farbringe: ' + bd.names.join(', ') + '.' : ''));
  }
  /* Spule: Luftspule bei kleinem L, Ringkern bei mittlerem, Kern mit Blech (EI) bei großem L */
  function coilTile(name, L, sub) {
    let svg, kind;
    if (L < 1e-3) { svg = B.luftspule(W1 / 2, 52, { turns: B.cl(4 + Math.log10(Math.max(1e-7, L) / 1e-7) * 1.2, 4, 9), W: 76 }).svg; kind = 'Luftspule'; }
    else if (L < 0.1) { svg = B.ringspule(W1 / 2, 52, { R: 26, turns: B.cl(10 + Math.log10(L / 1e-3) * 7, 10, 24) }).svg; kind = 'Ringkernspule'; }
    else { svg = B.trafoEI(W1 / 2, 52, { W: 100, H: 76, n1: 400, n2: 4, i1: 1, i2: 0.01 }).svg.replace(/bb-ws/g, 'bb-wp'); kind = 'Spule mit Eisenkern'; }
    return tile(W1, H1, svg + lab(W1 / 2, 110, name + ' = ' + eng(L, 'H')), kind + ' ' + name, sub);
  }
  function capTile(name, c, sub) {
    const f = B.folie(W1 / 2, 78, { c, s: Math.min(4.5, 62 / Math.max(6, (B.folie(0, 0, { c, s: 1 }).H))) });
    return tile(W1, H1, f.svg + lab(W1 / 2, 112, name + ' = ' + cap(c)), 'Folienkondensator ' + name, sub + ' Größe wächst mit C und Spannungsfestigkeit. Ein gepolter Elko ist für Wechselspannung nicht geeignet.');
  }
  function trafoTile(ctl, m) {
    const t = B.trafoEI(170, 88, { n1: ctl.n1, n2: ctl.n2, i1: m.i1, i2: m.i2, W: 200, H: 112, heat: B.cl(num(m.p1) - num(m.p2) > 0 ? (num(m.p1) - num(m.p2)) / Math.max(1, num(m.p1)) * 4 : 0, 0, 1), dc: ctl.dc === 'gleich' });
    return tile(340, 176, t.svg + lab(6, 14, 'Primär N1 = ' + num(ctl.n1), { a: 'start', fill: 'var(--wv-i)' }) + lab(334, 14, 'Sekundär N2 = ' + num(ctl.n2), { a: 'end', fill: 'var(--wv-p)' }) +
      lab(6, 170, 'I₁ = ' + eng(m.i1, 'A'), { a: 'start' }) + lab(334, 170, 'I₂ = ' + eng(m.i2, 'A'), { a: 'end' }) + lab(170, 170, 'ü = ' + nde(num(ctl.n1) / Math.max(1, num(ctl.n2)), 2), { cls: 'b' }),
      'Transformator mit EI-Kern (Schnitt durch die Fenster)', 'Innen die Primärwicklung (orange), außen die Sekundärwicklung (grün). Mehr Windungen heißt mehr Lagen, größerer Strom einen dickeren Draht. Die gestrichelte Linie ist der Wechselfluss im Kern.' + (ctl.dc === 'gleich' ? ' Bei Gleichspannung gibt es keinen Wechselfluss.' : ''), true);
  }
  /* Drehstromlast: Stern oder Dreieck mit drei Widerständen */
  function drehTile(ctl, m) {
    const star = ctl.schaltung !== 'dreieck', rs = num(ctl.rstr), cx = 170, cy = 84;
    let sv = '';
    const res = (x, y, deg, ohm) => B.rot(B.resistor(x, y, { ohm, pw: 2, s: 3.4, lead: 6, bands: false }).svg, x, y, deg);
    if (star) {
      [[-90, 'L1', 0], [30, 'L3', 1], [150, 'L2', 2]].forEach(a => { const r = a[0] * Math.PI / 180, x = cx + Math.cos(r) * 46, y = cy + Math.sin(r) * 46, xo = cx + Math.cos(r) * 76, yo = cy + Math.sin(r) * 76; sv += B.lead(cx, cy, xo, yo) + res(x, y, a[0], rs) + B.text(cx + Math.cos(r) * 92, cy + Math.sin(r) * 92 + 4, a[1], { b: 1 }); });
      sv += `<circle cx="${cx}" cy="${cy}" r="4" class="bb-src" style="fill:var(--fg)"/>` + lab(cx + 12, cy + 4, 'N', { a: 'start', cls: 'sm mute' });
    } else {
      const P = [[cx, cy - 62], [cx - 66, cy + 44], [cx + 66, cy + 44]], nm = ['L1', 'L2', 'L3'];
      [[0, 1], [1, 2], [2, 0]].forEach(e => { const a = P[e[0]], b = P[e[1]], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; sv += B.lead(a[0], a[1], b[0], b[1]) + res(mx, my, deg, rs); });
      P.forEach((q, i) => { sv += `<circle cx="${q[0]}" cy="${q[1]}" r="4" class="bb-src" style="fill:var(--fg)"/>` + lab(q[0] + (i === 0 ? 0 : (i === 1 ? -14 : 14)), q[1] + (i === 0 ? -9 : 16), nm[i], { b: 1 }); });
    }
    return tile(340, 176, sv + lab(6, 14, star ? 'Stern' : 'Dreieck', { a: 'start', cls: 'b' }) + lab(334, 14, 'U_L = ' + eng(ctl.ul, 'V'), { a: 'end', fill: COL.u }) + lab(334, 32, 'U_Str = ' + eng(m.ustr, 'V'), { a: 'end', fill: COL.u }) + lab(6, 170, 'I_Str = ' + eng(m.istr, 'A'), { a: 'start', fill: COL.i }) + lab(334, 170, 'I_L = ' + eng(m.il, 'A'), { a: 'end', fill: COL.i }),
      (star ? 'Sternschaltung' : 'Dreieckschaltung') + ' mit drei gleichen Widerständen', star ? 'Jeder Strang liegt an der Strangspannung U_Str = U_L / √3. Der Leiterstrom ist gleich dem Strangstrom.' : 'Jeder Strang liegt an der vollen Leiterspannung. Der Leiterstrom ist √3-mal so groß wie der Strangstrom.', true);
  }

  /* ---------- Je Prüfstand ---------- */
  const has = (a, e) => a === 'parallel' || String(a).indexOf(e) >= 0;
  const BUILD = {
    rlc(ctl, m) {
      const out = [], a = ctl.aufbau, par = a === 'parallel', I = num(m.i);
      const U = num(ctl.u);
      if (par) {
        out.push(barsTile('Zweigströme (parallel)', 'An allen Zweigen liegt dieselbe Spannung. Der Gesamtstrom ist die geometrische Summe, nicht die Summe der Beträge.', [
          { name: 'I_R', val: m.ir, unit: 'A', kind: 'i' }, { name: 'I_L', val: m.il, unit: 'A', kind: 'q' }, { name: 'I_C', val: m.ic, unit: 'A', kind: 'q' }, { name: 'I', val: I, unit: 'A', kind: 's' }].filter(q => (q.name === 'I' || num(q.val) > 0)), { max: Math.max(num(m.ir), num(m.il), num(m.ic), I) * 1.05 }));
      } else {
        out.push(barsTile('Spannungen (Reihenschaltung)', 'Gleicher Strom überall. Die Spannungen addieren sich geometrisch (Pythagoras), deshalb kann U_L oder U_C größer sein als die Quellenspannung.', [
          { name: 'U_R', val: m.ur, unit: 'V', kind: 'u' }, { name: 'U_L', val: m.ul, unit: 'V', kind: 'q' }, { name: 'U_C', val: m.uc, unit: 'V', kind: 'q' }, { name: 'U', val: U, unit: 'V', kind: 's' }].filter(q => (q.name === 'U' || num(q.val) > 0)), { max: Math.max(num(m.ur), num(m.ul), num(m.uc), U) * 1.05, foot: 'Strom I = ' + eng(I, 'A') }));
      }
      if (has(a, 'R')) { const iR = par ? num(m.ir) : I, p = iR * iR * num(ctl.r); out.push(resTile('R', num(ctl.r), p, '')); }
      if (has(a, 'L')) out.push(coilTile('L', num(ctl.l), 'Blindwiderstand X_L = ' + eng(m.xl, 'Ω') + '.'));
      if (has(a, 'C')) out.push(capTile('C', num(ctl.c), 'Blindwiderstand X_C = ' + eng(m.xc, 'Ω') + '.'));
      return out;
    },
    leistung(ctl, m) {
      const out = [], p = num(m.p), q = Math.abs(num(m.q)), s = num(m.s), pv = num(m.pv), mx = Math.max(s, p, q, 1e-12) * 1.02;
      out.push(barsTile('Leistungsfluss', 'Die Scheinleistung S setzt sich geometrisch aus Wirkleistung P (wird umgesetzt) und Blindleistung Q (pendelt hin und her) zusammen.', [
        { name: 'S', val: s, unit: 'VA', kind: 's' }, { name: 'P', val: p, unit: 'W', kind: 'p' }, { name: 'Q', val: q, unit: 'var', kind: 'q' }], { max: mx, foot: 'cos φ = ' + nde(num(m.cosphi), 2) + '  ·  Leitungsverlust P_V = ' + eng(pv, 'W') }));
      out.push(resTile('R_L (Leitung)', num(ctl.rl), pv, 'Der Strom erwärmt die Zuleitung.'));
      return out;
    },
    kompens(ctl, m) {
      const out = [], i1 = num(m.i1), i2 = num(m.i2), c = num(ctl.c);
      out.push(barsTile('Leiterstrom vor und nach der Kompensation', 'Der Kondensator liefert die Blindleistung vor Ort. Dann fließt weniger Strom durch die Zuleitung, und der Leitungsverlust sinkt.', [
        { name: 'I₁ ohne C', val: i1, unit: 'A', kind: 'i' }, { name: 'I₂ mit C', val: i2, unit: 'A', kind: 'i' }], { max: Math.max(i1, i2, 1e-12) * 1.05, foot: 'Q_C = ' + eng(m.qc, 'var') + '  ·  ΔP_V = ' + eng(m.dpv, 'W') }));
      if (c > 0) out.push(capTile('C', c, 'Parallel zur Last geschaltet.'));
      return out;
    },
    schwing(ctl, m) {
      const out = [], par = ctl.art === 'parallel', f0 = num(m.f0);
      if (par) out.push(barsTile('Ströme im Parallelkreis', 'Im Kreis kann ein großer Strom pendeln, obwohl aus der Quelle nur ein kleiner fließt (Stromüberhöhung).', [{ name: 'I', val: m.i, unit: 'A', kind: 'i' }, { name: 'I_L', val: m.il, unit: 'A', kind: 'q' }, { name: 'I_C', val: m.ic, unit: 'A', kind: 'q' }], { max: Math.max(num(m.i), num(m.il), num(m.ic), 1e-12) * 1.05, foot: 'f₀ = ' + eng(f0, 'Hz') }));
      else out.push(barsTile('Spannungen im Reihenkreis', 'Bei Resonanz heben sich X_L und X_C auf, U_L und U_C können dabei größer sein als die Quellenspannung (Spannungsüberhöhung).', [{ name: 'U', val: ctl.u, unit: 'V', kind: 's' }, { name: 'U_L', val: m.ul, unit: 'V', kind: 'q' }, { name: 'U_C', val: m.uc, unit: 'V', kind: 'q' }], { max: Math.max(num(ctl.u), num(m.ul), num(m.uc), 1e-12) * 1.05, foot: 'f₀ = ' + eng(f0, 'Hz') + '  ·  f = ' + eng(ctl.f, 'Hz') }));
      out.push(coilTile('L', num(ctl.l), 'Speichert Energie im Magnetfeld.'));
      out.push(capTile('C', num(ctl.c), 'Speichert Energie im elektrischen Feld.'));
      const iR = par ? 0 : num(m.i), p = iR * iR * num(ctl.r);
      if (!par && num(ctl.r) > 0) out.push(resTile('R (Verlust)', num(ctl.r), p, 'Dämpft den Kreis.'));
      return out;
    },
    filter(ctl, m) {
      const out = [], h = num(m.h), tief = ctl.typ !== 'hoch', rc = ctl.art !== 'RL';
      out.push(barsTile('Dämpfung bei dieser Frequenz', 'Die Marke zeigt 70,7 % (−3 dB): Dort liegt die Grenzfrequenz. Beim Tiefpass sinkt die Ausgangsspannung oberhalb, beim Hochpass unterhalb davon.', [
        { name: '|H|', val: h, unit: '', text: nde(h, 3), kind: 'u', mark: Math.SQRT1_2 }], { max: 1.05, foot: nde(num(m.a), 1) + ' dB  ·  f = ' + eng(ctl.f, 'Hz') + '  ·  f_g = ' + eng(m.fg, 'Hz') }));
      out.push(resTile('R', num(ctl.r), null, 'Spannungsteiler mit ' + (rc ? 'dem Kondensator.' : 'der Spule.')));
      if (rc) out.push(capTile('C', num(ctl.c), tief ? 'Liegt gegen Masse: tiefe Frequenzen passieren.' : 'Liegt in Reihe: hohe Frequenzen passieren.'));
      else out.push(coilTile('L', num(ctl.l), tief ? 'Liegt in Reihe: tiefe Frequenzen passieren.' : 'Liegt gegen Masse: hohe Frequenzen passieren.'));
      return out;
    },
    trafo(ctl, m) { return [trafoTile(ctl, m)]; },
    drehstrom(ctl, m) {
      const out = [drehTile(ctl, m)];
      out.push(barsTile('Leistungen', 'Wirkleistung P, Blindleistung Q und Scheinleistung S der drei Stränge zusammen.', [{ name: 'S', val: m.s, unit: 'VA', kind: 's' }, { name: 'P', val: m.p, unit: 'W', kind: 'p' }, { name: 'Q', val: Math.abs(num(m.q)), unit: 'var', kind: 'q' }], { max: Math.max(num(m.s), num(m.p), Math.abs(num(m.q)), 1e-12) * 1.02 }));
      return out;
    }
  };
  function tilesFor(rigId, ctl, m) { const f = BUILD[rigId]; if (!f || !B) return []; try { return f(ctl || {}, m || {}).filter(Boolean); } catch (e) { return []; } }
  function tileHtml(t) { return `<div class="wv-t${t.wide ? ' wide' : ''}"><svg viewBox="0 0 ${t.vw} ${t.vh}" role="img" aria-label="${esc(t.title)}">${t.svg}</svg><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div>`; }
  function cardHtml(tiles) { return tiles.map(tileHtml).join(''); }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
:root{--wv-u:var(--accent);--wv-i:var(--warn);--wv-p:var(--ok);--wv-q:hsl(278 55% 62%);--wv-s:hsl(45 90% 48%)}
:root[data-theme=light]{--wv-q:hsl(278 55% 42%);--wv-s:hsl(40 95% 34%)}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]){--wv-q:hsl(278 55% 42%);--wv-s:hsl(40 95% 34%)}}
.wv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:6px 8px 10px}
@media(min-width:700px){.wv-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.wv-t{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:6px 8px 9px;min-width:0}
.wv-t.wide{grid-column:1/-1}.wv-t.wide svg{max-width:460px;margin:0 auto}
.wv-t svg{display:block;width:100%;height:auto}
.wv-t b{display:block;font-size:13.5px;margin:4px 0 2px}.wv-t small{display:block;font-size:12.5px;color:var(--mute);line-height:1.38}
.wv-track{fill:var(--panel);stroke:var(--line);stroke-width:1}.wv-mark{stroke:var(--fg);stroke-width:2;stroke-dasharray:3 2}
#wvCard>summary{min-height:44px}
.wv-note{font-size:12.5px;color:var(--mute);padding:0 12px 8px;line-height:1.4;margin:0}
#cvw.wv-tall{aspect-ratio:var(--wv-ar)!important;max-height:none!important}
`;
  let last = '', tall = null, hdrOff = false;
  const HR = { sinus: 1.75, schwing: 2.45, filter: 2.45 };   /* Höhe zu Breite (Handybreite 353 px); sonst 2,2: vier Teilbilder übereinander */
  function injectCss() { if (document.getElementById('wslviz-css')) return; const st = document.createElement('style'); st.id = 'wslviz-css'; st.textContent = B.CSS + CSS; document.head.appendChild(st); }
  function wrapDraw(rg) {
    if (!rg || rg._wvw || typeof rg.draw !== 'function') return;
    const o = rg.draw; rg._wvw = 1;
    rg.draw = function (ctx, w, h, t, opt) { opt = Object.assign({}, opt || {}); if (hdrOff) opt.header = false; return o.call(rg, ctx, w, h, t, opt); };
  }
  function layout() {
    const cvw = document.getElementById('cvw'), host = document.getElementById('rigMain'); if (!cvw || !host) return;
    /* Breite des Bildes ohne Rand: unter 680 px hohes Format, unter 720 px keine Kopfzeile im Bild (Szenen legen sich ab 680 px nebeneinander) */
    const w = host.clientWidth - 22, t = w > 0 && w < 680; hdrOff = w > 0 && w < 720;
    if (t !== tall) { tall = t; cvw.classList.toggle('wv-tall', t); }
    if (t) { const S = root.WSL_UI && root.WSL_UI.S, k = (S && HR[S.rigId]) || 2.2; cvw.style.setProperty('--wv-ar', Math.round(w) + ' / ' + Math.round(Math.min(w, 353) * k)); }
  }
  function ensureCard() {
    let c = document.getElementById('wvCard'); if (c) return c;
    const anchor = document.getElementById('meters'); if (!anchor) return null;
    c = document.createElement('details'); c.className = 'card'; c.id = 'wvCard'; c.open = true;
    c.innerHTML = '<summary>Bauteile und Bauformen</summary><div class="wv-grid" id="wvGrid"></div><p class="wv-note">Bauformen und Größen sind Richtwerte aus gängigen Datenblättern, schematisch gezeichnet. Alle Zahlen sind Übungswerte (A).</p>';
    anchor.parentNode.insertBefore(c, anchor); return c;
  }
  function refresh(force) {
    const U = root.WSL_UI; if (!U || !U.S) return; const S = U.S; layout(); wrapDraw(S.rig);
    const card = ensureCard(); if (!card) return;
    const show = S.tab === 'rig' && S.rig && !S.task && BUILD[S.rigId];
    card.style.display = show ? '' : 'none'; if (!show) { last = ''; return; }
    let ctl = {}, m = {}; try { ctl = S.rig.getControls(); m = S.rig.readMeters() || {}; } catch (e) { return; }
    const sig = S.rigId + '|' + JSON.stringify(ctl) + '|' + JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v));
    if (!force && sig === last) return; last = sig;
    const g = document.getElementById('wvGrid'); if (g) g.innerHTML = cardHtml(tilesFor(S.rigId, ctl, m));
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const start = () => {
      if (!B) return; injectCss();
      if (window.ResizeObserver) { const h = document.getElementById('rigMain'); if (h) new ResizeObserver(() => layout()).observe(h); }
      window.addEventListener('resize', layout);
      setInterval(() => { if (!document.hidden) { try { refresh(false); } catch (e) {} } }, 350);
      refresh(true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  const API = { tilesFor, tileHtml, cardHtml, barsTile, BUILD, CSS };
  root.WSL_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
