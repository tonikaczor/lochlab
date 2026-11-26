'use strict';
/* Tonfunk Bus-Lab: Grafiken (Lab-Kennung 'bus'). Wird in buslab.html VOR busui.js geladen; busui.js ruft window.BUS_VIZ auf.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/bus/test_busviz.js):
     uartSvg   Oszilloskopbild eines UART-Rahmens: Startbit, Datenbits (D0 zuerst), Parität, Stoppbits, Abtastpunkte, Bitzeit und Rahmendauer
     canSvg    CAN-Arbitrierung: Bitfolge der IDs je Knoten und Buspegel (dominant 0 gewinnt), Verlierer mit Kreuz; quiz = ohne Auflösung
     rsSvg     RS-485-Leitung mit Abschluss (keiner, nur rechts, beide Enden) und zwei Oszilloskopbildern (Sender links, Sender rechts)
     taskImg   Bild zur Aufgabe aus q.img
   Bewegung nur per CSS und nur bei prefers-reduced-motion: no-preference. Jedes Bild ist ohne Bewegung vollständig.
   Farben nur über die CSS-Variablen der Seite, außer dem dunklen Oszilloskopschirm. Schrift im Bild mindestens 12 Einheiten bei Breite 360. */
(function (root) {
  const C = root.BUS_CORE || (typeof require === 'function' ? require('./buscore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const P = (pts, cls) => `<path class="${cls || ''}" d="M${pts.map(p => q(p[0]) + ' ' + q(p[1])).join(' L')}"/>`;
  const svg = (W, H, label, body, cls) => `<svg class="${cls || ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* Pegelverlauf als Treppe: vals = Pegel je Zelle (0/1), Zelle i liegt zwischen x0 + i·bw und x0 + (i+1)·bw */
  function steps(vals, x0, bw, yHi, yLo, from, to) {
    const y = v => (v ? yHi : yLo), pts = [[from == null ? x0 : from, y(from == null ? vals[0] : 1)]]; let prev = pts[0][1];
    vals.forEach((v, i) => { const bx = x0 + i * bw; if (y(v) !== prev) { pts.push([bx, prev], [bx, y(v)]); prev = y(v); } });
    pts.push([x0 + vals.length * bw, prev]);
    if (to != null) { if (prev !== yHi) pts.push([x0 + vals.length * bw, yHi]); pts.push([to, yHi]); }
    return pts;
  }
  const KIND = { S: 'zks', E: 'zke', P: 'zkp' };
  const kindOf = k => KIND[k] || 'zkd';

  /* ============================================================ UART-Oszilloskop */
  function uartSvg(o) {
    const d = o.d || 8, par = o.par || 'N', stop = o.stop || 1, baud = o.baud || 9600, v = (o.byte || 0) & ((1 << d) - 1), zeit = o.zeit !== false;
    const fr = C.frameList(v, d, par, stop), n = fr.length, bw = 336 / (n + 1), fx = 12 + bw / 2, yHi = 62, yLo = 102;
    const ch = v >= 32 && v < 127 ? '„' + String.fromCharCode(v) + '“' : 'Code';
    let b = T(6, 18, 'Zeichen ' + ch + ' = ' + v + ' · ' + d + par + stop + (zeit || o.baud ? ' · ' + f(baud, 0) + ' Baud' : ''), 'zb');
    b += R(4, 26, 352, 124, 'zscr', 8);
    fr.forEach((x, i) => { b += R(fx + i * bw, 32, bw, 102, 'zcell ' + kindOf(x.k)); b += L(fx + i * bw, 32, fx + i * bw, 134, 'zgrd'); });
    b += L(fx + n * bw, 32, fx + n * bw, 134, 'zgrd');
    b += `<path class="zbase" d="M12 ${yHi} L348 ${yHi}"/>`;
    b += P(steps(fr.map(x => x.v), fx, bw, yHi, yLo, 12, 348), 'ztrc');
    fr.forEach((x, i) => { const cx = fx + (i + 0.5) * bw; b += `<circle class="zsmp" cx="${q(cx)}" cy="${x.v ? yHi : yLo}" r="3.5"/>` + T(cx, 49, x.v, 'zsx zc') + T(cx, 126, x.k, 'zsx zc ' + kindOf(x.k)); });
    b += `<rect class="zscan" x="${q(fx)}" y="32" width="2" height="102" style="--zw:${q(n * bw)}px"/>`;
    const bx = fx + bw;
    b += L(bx, 162, bx + bw, 162, 'zdim') + L(bx, 156, bx, 168, 'zdim') + L(bx + bw, 156, bx + bw, 168, 'zdim');
    b += T(bx + bw / 2 + 14, 186, zeit ? '1 Bit = ' + C.fmtZeit(C.bitTime(baud)) : '1 Bit', 'zc');
    b += L(fx, 198, fx + n * bw, 198, 'zdim') + L(fx, 192, fx, 204, 'zdim') + L(fx + n * bw, 192, fx + n * bw, 204, 'zdim');
    b += T(fx + n * bw / 2, 222, zeit ? 'Rahmen: ' + n + ' Bit = ' + C.fmtZeit(C.frameTime(baud, d, par, stop)) : 'Rahmen: ' + n + ' Bit', 'zc zb');
    b += T(180, 242, 'S Start · D Daten · P Parität · E Stopp · Punkt = Abtastung', 'zc zm');
    return svg(360, 252, 'UART-Rahmen auf dem Oszilloskop mit Startbit, Datenbits, Parität und Stoppbit', b, 'bsv uart');
  }

  /* ============================================================ CAN-Arbitrierung */
  function canSvg(o) {
    const ids = o.ids || [], quiz = !!o.quiz, a = C.arbitrate(ids, 11), N = 'ABC', x0 = 56, bw = (352 - x0) / 11, pitch = 66, top0 = 26, rows = ids.length + (quiz ? 0 : 1);
    if (!a) return svg(360, 40, 'Ungültige Kennungen', T(8, 24, 'Die IDs müssen verschieden sein (0 bis 2047).', 'zbad'), 'bsv can');
    const H = top0 + rows * pitch + 26;
    let b = T(4, 14, 'Bit', 'zm');
    for (let i = 0; i < 11; i++) b += T(x0 + (i + 0.5) * bw, 14, i + 1, 'zm zc');
    for (let i = 0; i <= 11; i++) b += L(x0 + i * bw, top0 - 4, x0 + i * bw, top0 + rows * pitch - 8, 'zgl');
    ids.forEach((id, i) => {
      const top = top0 + i * pitch, yH = top + 10, yL = top + 34, bits = C.idBits(id, 11).split('').map(Number), last = quiz || a.lost[i] < 0 ? 11 : a.lost[i] + 1, win = !quiz && a.winner === i;
      b += T(6, top + 26, N[i], 'zb zbig zn' + i) + T(6, top + 46, 'ID ' + id, 'zs');
      if (!quiz && a.lost[i] >= 0) b += R(x0 + a.lost[i] * bw, top, bw, 54, 'zlostc');
      b += P(steps(bits.slice(0, last), x0, bw, yH, yL), 'zcur zn' + i);
      if (last < 11) b += L(x0 + last * bw, yH, 352, yH, 'zlost');
      bits.slice(0, last).forEach((v, k) => { b += T(x0 + (k + 0.5) * bw, top + 56, v, 'zc' + (win ? ' zb' : '')); });
      if (!quiz && a.lost[i] >= 0) { const cx = x0 + (a.lost[i] + 0.5) * bw; b += L(cx - 6, top + 16, cx + 6, top + 28, 'zx') + L(cx - 6, top + 28, cx + 6, top + 16, 'zx'); }
    });
    if (!quiz) {
      const top = top0 + ids.length * pitch, yH = top + 10, yL = top + 34;
      b += T(6, top + 26, 'Bus', 'zb zbig') + T(6, top + 46, '0 siegt', 'zs zm');
      b += P(steps(a.bus, x0, bw, yH, yL), 'zcur zbus');
      a.bus.forEach((v, k) => { b += T(x0 + (k + 0.5) * bw, top + 56, v, 'zc zb'); });
    }
    b += `<rect class="zcol" x="${q(x0)}" y="${top0 - 4}" width="${q(bw)}" height="${rows * pitch - 4}" style="--zw:${q(bw * 10)}px"/>`;
    b += quiz ? T(180, H - 6, 'Wer gewinnt? Von links: Wer zuerst 0 sendet, setzt sich durch.', 'zc zs zm') : T(180, H - 6, '✕ = verliert (sendet 1, der Bus hat 0) · ' + N[a.winner] + ' gewinnt', 'zc zs zb zok');
    return svg(360, H, quiz ? 'Bitfolgen der CAN-Kennungen' : 'CAN-Arbitrierung: Knoten ' + N[a.winner] + ' gewinnt', b, 'bsv can');
  }

  /* ============================================================ RS-485-Leitung */
  const TERM_TXT = { none: 'ohne Abschluss', end: 'Abschluss nur rechts', both: 'Abschluss an beiden Enden' };
  function scopeBox(y, title, m) {
    const base = y + 58, S = 28, x0 = 40, sw = 50, ov = C.overshoot(m.steps), yy = l => base - l * S;
    let b = T(6, y - 8, title, 'zb zs') + R(4, y, 352, 66, 'zscr', 8) + L(12, yy(1), 348, yy(1), 'zfin') + L(12, base, 348, base, 'zgrd');
    const pts = [[12, base], [x0, base], [x0, yy(m.steps[0])]];
    m.steps.forEach((s, i) => { pts.push([x0 + (i + 1) * sw, yy(s)]); if (i + 1 < m.steps.length) pts.push([x0 + (i + 1) * sw, yy(m.steps[i + 1])]); });
    b += P(pts, 'ztrc') + T(350, y + 16, ov > 5 ? 'Überschwinger ' + f(ov, 0) + ' %' : 'sauberer Verlauf', 'zsx ze ' + (ov > 5 ? 'zbad2' : 'zok2'));
    return b;
  }
  function rsSvg(o) {
    const term = o.term || 'none', rt = o.rt || 120, left = term === 'both', right = term !== 'none';
    const res = (cx, lab, lx, ly, an) => R(cx - 6, 56, 12, 16, 'zres') + L(cx, 52, cx, 56, 'zwire') + L(cx, 72, cx, 76, 'zwire') + T(lx, ly, lab, 'zs ' + (an || ''));
    let b = T(6, 16, 'RS-485-Linie, ' + TERM_TXT[term], 'zb');
    b += R(6, 42, 56, 44, 'zdev', 6) + T(34, 69, 'Sender', 'zc');
    b += L(62, 52, 304, 52, 'zwire') + L(62, 76, 304, 76, 'zwire') + T(112, 46, 'A', 'zs zm') + T(112, 92, 'B', 'zs zm');
    [[130, 'Teiln. 2'], [220, 'Teiln. 3']].forEach(p => { b += R(p[0], 106, 62, 24, 'zdev', 5) + T(p[0] + 31, 123, p[1], 'zs zc') + L(p[0] + 16, 52, p[0] + 16, 106, 'zwire') + L(p[0] + 46, 76, p[0] + 46, 106, 'zwire') + `<circle class="zjn" cx="${p[0] + 16}" cy="52" r="3.5"/><circle class="zjn" cx="${p[0] + 46}" cy="76" r="3.5"/>`; });
    b += left ? res(82, f(rt, 0) + ' Ω', 66, 100) : '';
    if (right) b += res(304, f(rt, 0) + ' Ω', 316, 68); else b += T(316, 68, 'offen', 'zs zbad');
    if (!right) b += L(304, 52, 304, 58, 'zopen') + L(304, 70, 304, 76, 'zopen');
    b += `<circle class="zpul" cx="62" cy="52" r="4" style="--zw:242px"/>`;
    if (!right) b += `<circle class="zrefl" cx="304" cy="52" r="4" style="--zw:242px"/>`;
    b += `<path class="zarr" d="M70 146 L292 146 M284 140 L292 146 L284 152"/>` + T(180, 142, 'Signal läuft nach rechts', 'zc zs zm');
    b += right ? T(180, 168, 'Der Abschluss schluckt das Signal', 'zc zs zok') : `<path class="zarrr" d="M292 166 L70 166 M78 160 L70 166 L78 172"/>` + T(180, 186, 'Reflexion läuft zurück und stört', 'zc zs zbad');
    b += scopeBox(214, 'Empfang am rechten Ende (Sender links)', C.rsModel(term, true)) + scopeBox(302, 'Empfang am linken Ende (Sender rechts)', C.rsModel(term, false));
    return svg(360, 376, 'RS-485-Leitung ' + TERM_TXT[term] + ' mit Signalverlauf an beiden Enden', b, 'bsv rs');
  }

  function taskImg(img) {
    if (!img || !img.k) return '';
    if (img.k === 'uart') return uartSvg(img);
    if (img.k === 'can') return canSvg(img);
    if (img.k === 'rs') return rsSvg(img);
    return '';
  }

  /* CSS der Grafiken (wird im Browser einmal eingefügt). Klassen mit z-Vorsatz, damit nichts mit den Seitenklassen kollidiert. */
  const CSS = `.bsv{display:block;width:100%;height:auto}.bsv text{font-family:system-ui,sans-serif;font-size:13.2px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.bsv .zs{font-size:13.2px}.bsv .zb{font-weight:700}.bsv .zc{text-anchor:middle}.bsv .ze{text-anchor:end}.bsv .zm{fill:var(--mute)}.bsv .zbig{font-size:16px}.bsv .zok{fill:var(--ok)}.bsv .zbad{fill:var(--danger)}
.bsv .zscr{fill:#0d1a12;stroke:var(--line)}.bsv .zgrd{stroke:#2a4a35;stroke-width:.8}.bsv .zbase{stroke:#2a4a35;stroke-width:.8;stroke-dasharray:3 4}.bsv .zfin{stroke:#8fb8a0;stroke-width:1;stroke-dasharray:4 4}
.bsv .ztrc{fill:none;stroke:#5dff8f;stroke-width:2.4;stroke-linejoin:round}.bsv text.zsx{fill:#bfffd2;font-size:13.2px}.bsv text.zok2{fill:#7dffa6}.bsv text.zbad2{fill:#ff9a9a}
.bsv .zcell{fill-opacity:.14}.bsv .zks{fill:#ff6b6b}.bsv .zkd{fill:#4da3ff}.bsv .zkp{fill:#ffb340}.bsv .zke{fill:#4cd964}
.bsv text.zkd{fill:#9cc9ff}.bsv text.zks{fill:#ff9a9a}.bsv text.zkp{fill:#ffcf80}.bsv text.zke{fill:#8dff9d}
.bsv .zsmp{fill:#ffb340;stroke:#0d1a12;stroke-width:1.2}.bsv .zscan{fill:#e6ffe9;fill-opacity:.35;display:none}
.bsv .zdim{stroke:var(--fg);stroke-width:1.4;fill:none}
.bsv .zgl{stroke:var(--line);stroke-width:.8}.bsv .zcur{fill:none;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.bsv .zcur.zn0{stroke:var(--accent)}.bsv .zcur.zn1{stroke:var(--hi)}.bsv .zcur.zn2{stroke:var(--ok)}.bsv text.zn0{fill:var(--accent)}.bsv text.zn1{fill:var(--hi)}.bsv text.zn2{fill:var(--ok)}.bsv .zbus{stroke:var(--fg);stroke-width:3.6}.bsv .zlost{stroke:var(--mute);stroke-width:2;stroke-dasharray:4 4;opacity:.7}.bsv .zlostc{fill:var(--danger);fill-opacity:.14}.bsv .zx{stroke:var(--danger);stroke-width:3;stroke-linecap:round}
.bsv .zcol{fill:var(--accent);fill-opacity:.13;display:none}
.bsv .zjn{fill:var(--fg)}.bsv .zwire{stroke:var(--fg);stroke-width:2.4;fill:none}.bsv .zdev{fill:var(--panel);stroke:var(--fg);stroke-width:1.6}.bsv .zres{fill:var(--panel);stroke:var(--fg);stroke-width:1.8}.bsv .zopen{stroke:var(--danger);stroke-width:2.4;stroke-linecap:round}
.bsv .zarr,.bsv .zarrr{fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.bsv .zarr{stroke:var(--accent)}.bsv .zarrr{stroke:var(--danger)}
.bsv .zpul,.bsv .zrefl{display:none}.bsv .zpul{fill:var(--accent)}.bsv .zrefl{fill:var(--danger)}
.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:560px;margin:8px auto}.vzbox.full{max-width:none}
@media(prefers-reduced-motion:no-preference){
.bsv .zscan{display:inline;animation:zScan 4.5s linear infinite}@keyframes zScan{from{transform:translateX(0)}to{transform:translateX(var(--zw))}}
.bsv .zcol{display:inline;animation:zCol 6s steps(11,jump-none) infinite}@keyframes zCol{from{transform:translateX(0)}to{transform:translateX(var(--zw))}}
.bsv .zpul{display:inline;animation:zGo 3.2s linear infinite}@keyframes zGo{0%{transform:translateX(0);opacity:1}48%{transform:translateX(var(--zw));opacity:1}50%,100%{transform:translateX(var(--zw));opacity:0}}
.bsv .zrefl{display:inline;animation:zBack 3.2s linear infinite}@keyframes zBack{0%,50%{transform:translateX(0);opacity:0}52%{opacity:1}100%{transform:translateX(calc(-1 * var(--zw)));opacity:1}}}`;

  const API = { uartSvg, canSvg, rsSvg, taskImg, CSS };
  root.BUS_VIZ = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('busviz-css')) { try { const st = document.createElement('style'); st.id = 'busviz-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
