'use strict';
/* Tonfunk Mikrocontroller-Lab: Bilder (Lab-Kennung 'mik'). Datei wird in miklab.html VOR mikui.js geladen.
   ALLE Zahlen (Takt, Vorteiler, Spannungen, Ströme, Zeiten) sind ÜBUNGSWERTE.
   Reine Zeichenfunktionen (liefern SVG-Text, ohne DOM, testbar mit node quelle/mik/test_mikviz.js):
     timerSvg   Zähler als Sägezahn mit Vergleichswert, Treffern und Ausgangssignal (CTC oder Fast-PWM)
     adcSvg     Treppenstufen des AD-Wandlers mit 1 LSB, Rohwert und Bits
     fsmSvg     Ampel-Zustandsautomat mit Zeitleiste
     sleepSvg   Stromverlauf, Ladungsanteil und Batterielaufzeit
   Ungültige Eingaben liefern ''. Bewegung: run(box) lässt Marken ruhig laufen (nur bei prefers-reduced-motion: no-preference);
   ohne Bewegung zeigt das Bild denselben Endzustand (Marke an der Stelle p0). Farben nur über CSS-Variablen der Seite. */
(function (root) {
  const C = root.MIK_CORE || (typeof require === 'function' ? require('./mikcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const tage = v => f(v, 1) + (Math.abs(v - 1) < 0.05 ? ' Tag' : ' Tage');
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const PL = (pts, cls) => `<polyline class="${cls}" points="${pts.map(p => q(p[0]) + ',' + q(p[1])).join(' ')}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function arrow(x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 9, p1 = [x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)], p2 = [x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)];
    return `<g class="vz-ar">${L(x1, y1, x2, y2)}<polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}"/></g>`;
  }
  /* Klammer waagerecht von x1 bis x2 auf Höhe y mit kurzen Enden */
  const bracket = (x1, x2, y) => `<g class="vz-br">${L(x1, y, x2, y)}${L(x1, y - 5, x1, y + 5)}${L(x2, y - 5, x2, y + 5)}</g>`;

  /* Marke auf der Zeichnung: x läuft linear von x0 bis x1, y läuft n-mal von yB nach yT (Sägezahn). p von 0 bis unter 1. */
  function tracePos(sp, p) {
    if (!sp || !fin(p)) return null;
    const m = ((p % 1) + 1) % 1;
    return [q(sp.x0 + (sp.x1 - sp.x0) * m), q(sp.yB + (sp.yT - sp.yB) * ((m * sp.n) % 1))];
  }
  /* Marke als <g>, an der Stelle p0 gezeichnet; run() verschiebt sie. extra: zusätzliche Attribute (zum Beispiel data-d) */
  function tracer(sp, inner, extra) {
    const pos = tracePos(sp, sp.p0);
    return `<g data-an="tr" data-sp="${esc(JSON.stringify(sp))}"${extra || ''} transform="translate(${pos[0]} ${pos[1]})">${inner}</g>`;
  }

  /* ============================================================ Timer: Sägezahn, Vergleichswert, Ausgang */
  /* o = { f: Takt in Hz, N: Vorteiler, bits: 8 oder 16, ocr: Vergleichswert, mode: 'ctc' oder 'pwm' } */
  function timerSvg(o) {
    o = o || {};
    const max = C.pow2(o.bits), pwm = o.mode === 'pwm';
    if (!(o.f > 0 && o.N > 0 && fin(max) && Number.isInteger(o.ocr) && o.ocr >= 0 && o.ocr <= max - 1 && (o.mode === 'ctc' || pwm))) return '';
    const top = max - 1, W = 420, H = 296, X0 = 64, X1 = 408, NP = 4, pw = (X1 - X0) / NP, YB = 134, YT = 46, YH = 172, YL = 204;
    const scale = pwm ? top : Math.max(o.ocr, 1), yv = v => YB - (YB - YT) * v / scale, yc = yv(o.ocr);
    const tick = C.tick(o.f, o.N), duty = C.duty(o.ocr, o.bits);
    let b = T(8, 22, 'Zählerstand TCNT', 'm') + T(8, 160, 'Ausgang', 'm');
    b += L(X0, YB, X1, YB, 'ax') + L(X0, YT - 10, X0, YB, 'ax');
    for (let k = 1; k < NP; k++) b += L(X0 + k * pw, YT - 10, X0 + k * pw, YL + 8, 'grid');
    b += T(X0 - 6, YB + 5, '0', 'm end') + T(X0 - 6, YT + 5, f(pwm ? top : o.ocr), 'm end');
    const saw = [[X0, YB]]; for (let k = 1; k <= NP; k++) saw.push([X0 + k * pw, YT], [X0 + k * pw, YB]);
    b += PL(saw, 'vz-saw');
    b += L(X0, yc, X1, yc, 'vz-cmp') + T(X1, yc - 7, 'OCR = ' + f(o.ocr), 'b end');
    const out = [], dots = [];
    if (pwm) {
      for (let k = 0; k < NP; k++) { const xd = X0 + k * pw + pw * o.ocr / top; out.push([X0 + k * pw, YH], [xd, YH], [xd, YL], [X0 + (k + 1) * pw, YL]); dots.push([xd, yc]); }
      out.push([X1, YH]);
    } else {
      out.push([X0, YL]); for (let k = 1; k <= NP; k++) { const hi = k % 2 === 1; out.push([X0 + k * pw, hi ? YL : YH], [X0 + k * pw, hi ? YH : YL]); dots.push([X0 + k * pw, YT]); }
      out.push([X1, out[out.length - 1][1]]);
    }
    b += PL(out, 'vz-sig') + T(X0 - 6, YH + 5, '1', 'm end') + T(X0 - 6, YL + 5, '0', 'm end');
    b += dots.map(d => `<circle class="vz-hit" cx="${q(d[0])}" cy="${q(d[1])}" r="4.5"/>`).join('');
    const per = pwm ? 1 / C.pwmHz(o.f, o.N, o.bits) : (o.ocr + 1) * tick;
    b += bracket(X0 + pw, X0 + 2 * pw, 224) + T(X0 + 1.5 * pw, 242, (pwm ? 'PWM-Periode ' : 'Eine Periode ') + C.fmtTime(per), 'mid');
    b += T(8, 266, '1 Zählschritt = ' + C.fmtTime(tick) + ' · Überlauf nach ' + C.fmtTime(C.overflow(o.f, o.N, o.bits)), '');
    b += T(8, 286, pwm ? 'PWM ' + C.fmtHz(C.pwmHz(o.f, o.N, o.bits)) + ' · Tastgrad ' + f(duty * 100, 1) + ' %' : 'Treffer ' + C.fmtHz(C.cmpHz(o.f, o.N, o.ocr)) + ' · Ausgang ' + C.fmtHz(C.toggleHz(o.f, o.N, o.ocr)), 'b');
    const sp = { x0: X0, x1: X1, n: NP, yB: YB, yT: YT, dur: 8, p0: 0.4 }, line = { x0: X0, x1: X1, n: 1, yB: 0, yT: 0, dur: 8, p0: 0.4 };
    b += tracer(line, `<line class="vz-cur" x1="0" x2="0" y1="${YT - 10}" y2="${YL + 8}"/>`) + tracer(sp, '<circle class="vz-dot" r="6"/>');
    return svg(W, H, (pwm ? 'Fast-PWM' : 'CTC-Modus') + ': Zähler bis ' + (pwm ? top : o.ocr) + ', Vergleichswert ' + o.ocr + ', Zählschritt ' + C.fmtTime(tick), b);
  }

  /* ============================================================ AD-Wandler: Treppenstufen */
  /* o = { u: Eingangsspannung in V, uref: Referenz in V, n: Bits (4 bis 12) } */
  function adcSvg(o) {
    o = o || {};
    const raw = C.rawOf(o.u, o.uref, o.n);
    if (!fin(raw) || !(o.u <= o.uref) || !(o.n >= 4 && o.n <= 12)) return '';
    const max = C.pow2(o.n) - 1, s0 = clamp(raw - 3, 0, max - 7), lsb = C.lsb(o.uref, o.n), k = raw - s0;
    const W = 420, H = 308, PX0 = 72, PX1 = 408, sw = (PX1 - PX0) / 8, YB = 186, sh = 19, yk = i => YB - i * sh;
    const ux = PX0 + (o.u / lsb - s0) * sw, uy = YB - (ux - PX0) / (PX1 - PX0) * (YB - 34);
    let b = T(8, 20, 'Rohwert', 'm') + L(PX0, YB, PX1, YB, 'ax') + L(PX0, 34, PX0, YB, 'ax');
    b += R(PX0 + k * sw, 34, sw, YB - 34, 'vz-act');
    b += L(PX0, YB, PX1, 34, 'vz-ideal');
    const st = []; for (let i = 0; i < 8; i++) st.push([PX0 + i * sw, yk(i)], [PX0 + (i + 1) * sw, yk(i)]);
    b += PL(st, 'vz-stair') + L(PX0 + k * sw, yk(k), PX0 + (k + 1) * sw, yk(k), 'vz-stair on');
    for (let i = 0; i < 8; i++) b += T(PX0 - 6, yk(i) + 5, f(s0 + i), i === k ? 'b end' : 'm end');
    b += L(ux, 34, ux, YB, 'vz-u') + T(ux, 26, 'U', 'b mid') + `<circle class="vz-hit" cx="${q(ux)}" cy="${q(yk(k))}" r="5"/>`;
    b += T(PX0, 206, f(s0 * lsb, 3) + ' V', 'm') + T(PX1, 206, f((s0 + 8) * lsb, 3) + ' V', 'm end') + T((PX0 + PX1) / 2, 206, 'Eingang', 'm mid');
    const bx = PX0 + k * sw;
    b += bracket(bx, bx + sw, 224) + T(clamp(bx + sw / 2, 130, 352), 244, '1 LSB = ' + f(lsb * 1000, 3) + ' mV', 'mid');
    const bits = C.binStr(raw, o.n); b += T(8, 270, 'Bits', 'm');
    for (let i = 0; i < o.n; i++) b += R(PX0 + i * 28, 254, 28, 26, 'vz-bit' + (bits[i] === '1' ? ' one' : ''), 4) + T(PX0 + i * 28 + 14, 273, bits[i], 'b mid');
    b += T(8, 300, 'Rohwert ' + f(raw) + ' ergibt ' + f(C.uOf(raw, o.uref, o.n), 3) + ' V (Eingang ' + f(o.u, 3) + ' V)', '');
    const sp = { x0: PX0, x1: PX1, n: 1, yB: YB, yT: 34, dur: 9, p0: clamp((ux - PX0) / (PX1 - PX0), 0, 0.999) };
    b += tracer(sp, '<circle class="vz-dot" r="6"/>');
    return svg(W, H, 'AD-Wandler mit ' + f(C.steps(o.n)) + ' Stufen, 1 LSB gleich ' + f(lsb * 1000, 3) + ' Millivolt, Rohwert ' + raw, b);
  }

  /* ============================================================ Zustandsautomat: Ampel */
  const LIGHTS = [[1, 0, 0], [1, 1, 0], [0, 0, 1], [0, 1, 0]], LCOL = ['mr', 'my', 'mg'];
  /* o = { d: [ms ROT, ms ROTGELB, ms GRUEN, ms GELB], active: 0 bis 3 } */
  function fsmSvg(o) {
    o = o || {};
    const cyc = o.d ? C.cycle(o.d) : NaN, act = o.active == null ? 0 : o.active;
    if (!fin(cyc) || !Number.isInteger(act) || act < 0 || act > 3) return '';
    const W = 420, H = 314, BW = 182, BH = 84, POS = [[12, 30], [226, 30], [226, 144], [12, 144]], segs = C.segs(o.d);
    let b = '';
    b += arrow(198, 72, 224, 72) + arrow(317, 116, 317, 142) + arrow(224, 186, 198, 186) + arrow(103, 142, 103, 116);
    b += '<g class="vz-states">' + POS.map((p, i) => {
      const x = p[0], y = p[1], A = C.AMPEL[i];
      return `<g class="vz-state${i === act ? ' on' : ''}" data-st="${i}">${R(x, y, BW, BH, 'vz-sb', 12)}${R(x + 10, y + 10, 24, 64, 'vz-house', 12)}` +
        LIGHTS[i].map((on, j) => `<circle class="vz-light${on ? ' ' + LCOL[j] : ''}" cx="${x + 22}" cy="${y + 24 + j * 18}" r="7"/>`).join('') +
        T(x + 46, y + 38, A.n, 'b') + T(x + 46, y + 60, C.fmtTime(o.d[i] / 1000), 'm') + '</g>';
    }).join('') + '</g>';
    b += T(210, 252, 'Weiter, wenn millis() − tLast ≥ Dauer', 'mid');
    const X0 = 12, X1 = 408, bw = X1 - X0, YB = 266, BHt = 20;
    segs.forEach(s => {
      const x = X0 + bw * s.from / cyc, w = bw * (s.to - s.from) / cyc;
      if (s.i === 1) b += R(x, YB, w / 2, BHt, 'vz-seg mr') + R(x + w / 2, YB, w / 2, BHt, 'vz-seg my'); else b += R(x, YB, w, BHt, 'vz-seg ' + LCOL[s.i === 0 ? 0 : s.i === 2 ? 2 : 1]);
    });
    const a = segs[act], sp = { x0: X0, x1: X1, n: 1, yB: 0, yT: 0, dur: 12, p0: (a.from + a.to) / 2 / cyc };
    b += tracer(sp, `<line class="vz-cur" x1="0" x2="0" y1="${YB - 8}" y2="${YB + BHt + 8}"/><circle class="vz-dot" cx="0" cy="${YB - 8}" r="5"/>`, ' data-d="' + o.d.join(',') + '"');
    b += T(210, 306, 'Ein Durchlauf: ' + C.fmtTime(cyc / 1000), 'b mid');
    return svg(W, H, 'Ampel mit vier Zuständen, ein Durchlauf dauert ' + C.fmtTime(cyc / 1000), b);
  }

  /* ============================================================ Energiesparen */
  /* o = { ia: Aktivstrom µA, ta: Aktivzeit ms, is: Schlafstrom µA, T: Periode ms, cap: Kapazität mAh } */
  function sleepSvg(o) {
    o = o || {};
    const avg = C.avgI(o.ia, o.ta, o.is, o.T), share = C.shareActive(o.ia, o.ta, o.is, o.T), dYes = C.runDays(o.cap, avg), dNo = C.runDays(o.cap, o.ia);
    if (!(fin(avg) && fin(share) && fin(dYes) && fin(dNo) && o.ia > 0)) return '';
    const W = 420, H = 346, YP = 50, YS = 112, YB = 120;
    let b = T(8, 20, 'Stromverlauf (nicht maßstäblich)', 'm') + L(12, YB, 408, YB, 'ax');
    const prof = [[12, YS]];
    for (let k = 0; k < 2; k++) { const x = 20 + k * 194; prof.push([x, YS], [x, YP], [x + 32, YP], [x + 32, YS]); b += R(x, YP, 32, YS - YP, 'vz-pulse'); }
    prof.push([408, YS]); b += PL(prof, 'vz-saw');
    const r = o.ia > o.is ? (avg - o.is) / (o.ia - o.is) : 0, ya = YS - 8 - (YS - YP - 16) * Math.sqrt(clamp(r, 0, 1));
    b += L(12, ya, 408, ya, 'vz-cmp') + T(408, ya - 6, 'Mittel ' + f(avg, 1) + ' µA', 'b end');
    b += T(52, YP - 6, 'ta = ' + f(o.ta) + ' ms', '') + T(60, YP + 18, 'Ia = ' + f(o.ia) + ' µA', '') + T(250, 137, 'Is = ' + f(o.is) + ' µA', 'm');
    b += bracket(20, 214, 134) + T(117, 154, 'T = ' + f(o.T) + ' ms', 'mid');
    b += T(8, 182, 'Anteil an der Ladung', 'm');
    const bw = 396, wa = share > 0 ? Math.max(2, bw * share / 100) : 0;
    b += R(12, 190, bw, 24, 'vz-seg my') + R(12, 190, wa, 24, 'vz-seg mr');
    b += R(12, 224, 14, 14, 'vz-seg mr') + T(32, 237, 'Aktiv ' + f(share, 1) + ' %', '') + R(226, 224, 14, 14, 'vz-seg my') + T(246, 237, 'Schlaf ' + f(100 - share, 1) + ' %', '');
    b += T(8, 266, 'Laufzeit mit ' + f(o.cap) + ' mAh', 'm');
    const BX = 104, BWm = 304, w1 = BWm * dNo / dYes;
    b += T(8, 288, 'ohne Schlaf', '') + R(BX, 272, w1, 22, 'vz-bar') + T(BX + w1 + 8, 288, tage(dNo), 'b');
    b += T(8, 318, 'mit Schlaf', '') + R(BX, 302, BWm, 22, 'vz-bar on') + T(BX + BWm - 8, 318, tage(dYes), 'b end');
    b += T(8, 340, 'Schlafen macht die Laufzeit ' + f(dYes / dNo, 1) + '-mal so lang', 'b');
    return svg(W, H, 'Mittlerer Strom ' + f(avg, 1) + ' Mikroampere, Laufzeit ' + f(dYes, 1) + ' Tage statt ' + f(dNo, 1) + ' Tage', b);
  }

  /* ============================================================ Stil und Bewegung (nur im Browser) */
  const CSS = `.vzbox{--mr:#e5484d;--my:#f5a524;--mg:#30a46c;background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:520px;margin:8px auto}
.vzbox svg{display:block;width:100%;height:auto}
.vzbox text{font:14px system-ui,sans-serif;fill:var(--fg);paint-order:stroke;stroke:var(--panel2);stroke-width:3px;stroke-linejoin:round;-webkit-user-select:none;user-select:none}
.vzbox text.m{fill:var(--mute)}.vzbox text.b{font-weight:700}.vzbox text.mid{text-anchor:middle}.vzbox text.end{text-anchor:end}
.vzbox .ax{stroke:var(--mute);stroke-width:1.3;fill:none}.vzbox .grid{stroke:var(--line);stroke-width:1}
.vzbox .vz-saw{fill:none;stroke:var(--accent);stroke-width:2.6;stroke-linejoin:round}
.vzbox .vz-cmp{stroke:var(--hi);stroke-width:1.8;stroke-dasharray:6 4}
.vzbox .vz-sig{fill:none;stroke:var(--ok);stroke-width:2.8;stroke-linejoin:round}
.vzbox .vz-hit{fill:var(--hi);stroke:var(--fg);stroke-width:1}
.vzbox .vz-cur{stroke:var(--fg);stroke-width:1.3;stroke-dasharray:3 3;opacity:.75}
.vzbox .vz-dot{fill:var(--accent);stroke:var(--fg);stroke-width:1.6}
.vzbox .vz-br line{stroke:var(--mute);stroke-width:1.5}
.vzbox .vz-ar line{stroke:var(--mute);stroke-width:2}.vzbox .vz-ar polygon{fill:var(--mute)}
.vzbox .vz-act{fill:var(--accent);opacity:.2}
.vzbox .vz-ideal{stroke:var(--mute);stroke-width:1.5;stroke-dasharray:5 4}
.vzbox .vz-stair{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round}.vzbox .vz-stair.on{stroke:var(--hi);stroke-width:4.5}
.vzbox .vz-u{stroke:var(--hi);stroke-width:1.8}
.vzbox .vz-bit{fill:var(--bg);stroke:var(--line);stroke-width:1.2}.vzbox .vz-bit.one{fill:var(--accent);fill-opacity:.35;stroke:var(--accent)}
.vzbox .vz-sb{fill:var(--bg);stroke:var(--line);stroke-width:1.5}.vzbox .vz-state.on .vz-sb{stroke:var(--accent);stroke-width:3.5;fill:var(--panel)}
.vzbox .vz-house{fill:var(--panel2);stroke:var(--line);stroke-width:1.2}
.vzbox .vz-light{fill:var(--line)}.vzbox .vz-light.mr{fill:var(--mr)}.vzbox .vz-light.my{fill:var(--my)}.vzbox .vz-light.mg{fill:var(--mg)}
.vzbox .vz-seg{stroke:var(--panel2);stroke-width:1.5}.vzbox .vz-seg.mr{fill:var(--mr)}.vzbox .vz-seg.my{fill:var(--my)}.vzbox .vz-seg.mg{fill:var(--mg)}
.vzbox .vz-pulse{fill:var(--hi);opacity:.4}
.vzbox .vz-bar{fill:var(--mute);opacity:.4}.vzbox .vz-bar.on{fill:var(--ok);opacity:.5}
@media(prefers-reduced-motion:no-preference){.vzbox .vz-pulse{animation:vzp 2.6s ease-in-out infinite}@keyframes vzp{50%{opacity:.8}}.vzbox .vz-state .vz-sb{transition:stroke .2s}}`;
  if (typeof document !== 'undefined' && !document.getElementById('mikviz-css')) { const s = document.createElement('style'); s.id = 'mikviz-css'; s.textContent = CSS; document.head.appendChild(s); }

  const reduziert = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  /* Setzt die Marken in box in Bewegung (eine Schleife je Box; ein neuer Aufruf ersetzt die alte); ohne Bewegung bleibt der Endzustand stehen */
  function run(box) {
    if (!box || typeof requestAnimationFrame !== 'function') return;
    if (box._raf) cancelAnimationFrame(box._raf); box._raf = 0;
    if (reduziert()) return;
    const trs = Array.from(box.querySelectorAll('[data-an="tr"]')).map(e => ({ e, sp: JSON.parse(e.getAttribute('data-sp')), d: e.getAttribute('data-d') ? e.getAttribute('data-d').split(',').map(Number) : null }));
    if (!trs.length) return;
    const t0 = performance.now();
    const step = now => {
      if (!box.isConnected) { box._raf = 0; return; }
      trs.forEach(t => {
        const p = (t.sp.p0 + (now - t0) / 1000 / t.sp.dur) % 1, pos = tracePos(t.sp, p);
        t.e.setAttribute('transform', 'translate(' + pos[0] + ' ' + pos[1] + ')');
        if (t.d) { const i = C.stateAt(p * C.cycle(t.d), t.d); box.querySelectorAll('[data-st]').forEach(g => g.classList.toggle('on', +g.getAttribute('data-st') === i)); }
      });
      box._raf = requestAnimationFrame(step);
    };
    box._raf = requestAnimationFrame(step);
  }

  const API = { timerSvg, adcSvg, fsmSvg, sleepSvg, tracePos, run };
  root.MIK_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
