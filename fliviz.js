'use strict';
/* Tonfunk Linien-Lab: Visualisierungen (Lab-Kennung 'fli'). Reine Zeichenfunktionen, liefern SVG-Text ohne DOM (testbar mit node quelle/fli/test_fliviz.js).
   Die Breite W (Pixel) kommt von der Oberfläche: 1 Einheit im SVG = 1 Pixel, die Schrift bleibt 14 px groß. Farben nur über CSS-Klassen der Seite
   (g-lab, g-bar, g-barOn, g-barWarn, g-barOk, g-ax). Zustände nie nur durch Farbe: Engpass steht als Text ("Engpass"), abgeschaltete Station als "aus".
   Kein Text darf über den Rand der Zeichnung ragen oder in die Zahl am rechten Rand laufen: Ohne DOM lässt sich Text nicht messen, darum schätzt cw() die Breite
   reichlich (fett 7,4 und normal 6,9 Pixel je Zeichen bei 14 px) und fit() nimmt die längste Fassung, die in den freien Platz passt (schmale Handys: kürzere Fassung). */
(function (root) {
  const C = root.FLI_CORE || (typeof require === 'function' ? require('./flicore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 1 : d, true);
  const okW = W => (fin(W) && W >= 200 ? Math.min(W, 1000) : 320);
  const T = (x, y, t, cls, anc) => `<text class="g-lab ${cls || ''}" x="${q(x)}" y="${q(y)}"${anc ? ' text-anchor="' + anc + '"' : ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls) => `<rect class="${cls}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}" rx="5"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" width="100%" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const ROW = 36, NAMEW = 96, Y0 = 24;
  const cw = (s, fett) => String(s).length * (fett ? 7.4 : 6.9);
  const fit = (arr, platz, fett) => arr.find(s => cw(s, fett) <= platz) || arr[arr.length - 1];
  const kurz = id => (C.ST[id] ? C.ST[id].kurz : id);

  /* Taktzeit je Station als Balken, Engpass beschriftet, Puffer vor dem Engpass als Kästchen, Auslastung rechts */
  function taktSvg(m, Wi, Hmax) {
    const ROW = Hmax > 0 ? Math.max(28, Math.min(36, Math.floor((Hmax - 36) / 9))) : 36, W = okW(Wi), zs = m.zeilen, tmax = Math.max(60, ...C.STATIONEN.map(s => (m.p ? m.p.takt[s.id] : 0)));
    const x0 = NAMEW + 6, aw = 58, bw = Math.max(60, W - x0 - aw - 8); let y = Y0, b = T(4, 16, fit(['Taktzeit in s, Auslastung rechts', 'Taktzeit in s'], W - 8), 'm');
    const byId = {}; zs.forEach(z => { byId[z.id] = z; });
    C.STATIONEN.forEach(s => {
      const z = byId[s.id], t = m.p.takt[s.id];
      b += T(4, y + 22, kurz(s.id), z ? '' : 'm');
      if (!z) { b += T(x0, y + 22, fit(['aus (wird nicht durchlaufen)', 'aus (nicht durchlaufen)', 'aus'], W - 4 - x0), 'm'); y += ROW; return; }
      const eng = m.engpass === s.id, w = bw * t / tmax, re = f(z.auslastung * 100, 0) + ' %', platz = W - 4 - cw(re, eng) - 8 - (x0 + 6);
      b += R(x0, y + 6, w, ROW - 14, eng ? 'g-barWarn' : 'g-barOn');
      b += T(x0 + 6, y + 23, eng ? fit([f(t, 0) + ' s · Engpass', 'Engpass'], platz, true) : f(t, 0) + ' s', 'g-q');
      b += T(W - 4, y + 23, re, eng ? 'g-warn' : '', 'end');
      if (eng && m.puffer > 0) {   // Puffer vor dem Engpass: ein Kästchen je Stück (höchstens zwölf), Zahl dahinter
        const n = Math.min(12, m.puffer); let px = x0 + Math.max(w + 6, 130) + (eng ? 0 : 0);
        if (px + n * 9 + 70 < W - aw) { for (let i = 0; i < n; i++) b += R(px + i * 9, y + 10, 7, ROW - 22, 'g-bar'); b += T(px + n * 9 + 4, y + 23, 'Puffer ' + m.puffer, 'm'); }
      }
      y += ROW;
    });
    return svg(W, y + 6, 'Taktzeit je Station der Linie A, Engpass: ' + (m.engpass ? kurz(m.engpass) : 'keiner'), b);
  }

  /* Anteil guter Stücke nach jeder Station (kumuliert) */
  function ausbeuteSvg(m, Wi) {
    const W = okW(Wi), zs = m.zeilen.filter(z => C.INNEN.indexOf(z.id) >= 0), lo = m.rty >= 0.7 ? 0.7 : 0;
    const x0 = NAMEW + 6, bw = Math.max(60, W - x0 - 64), ab = ' (ab ' + f(lo * 100, 0) + ' %)'; let y = Y0, kum = 1, b = T(4, 16, fit(['Gute Stücke nach der Station' + ab, 'Gute Stücke nach Station' + ab, 'Gute Stücke' + ab], W - 8), 'm');
    zs.forEach(z => {
      kum *= z.y; const w = bw * Math.max(0, (kum - lo)) / (1 - lo), schwach = z.y === Math.min.apply(null, zs.map(r => r.y)) && z.y < 1;
      const re = f(kum * 100, 1) + ' %', e = f(z.y * 100, 1) + ' %', platz = W - 4 - cw(re) - 8 - (x0 + 6);
      b += T(4, y + 22, kurz(z.id), '') + R(x0, y + 6, w, ROW - 14, schwach ? 'g-barWarn' : 'g-barOk') + T(x0 + 6, y + 23, fit(schwach ? [e + ' einzeln · schwächste', e + ' · schwächste', 'schwächste'] : [e + ' einzeln', e], platz, true), 'g-q') + T(W - 4, y + 23, re, '', 'end');
      y += ROW;
    });
    return svg(W, y + 6, 'Gesamtausbeute der Linie A: ' + f(m.rty * 100, 1) + ' Prozent', b);
  }
  const API = { taktSvg, ausbeuteSvg };
  root.FLI_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
