'use strict';
/* Tonfunk Industrie-4.0-Lab: Grafiken (Lab-Kennung 'iot'). Wird in iotlab.html VOR iotui.js geladen; iotui.js ruft window.IOT_VIZ auf.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/iot/test_iotviz.js):
     dkSvg   Datenkette Sensor, Mikrocontroller, Gateway, Netzwerk, Cloud, Dashboard mit Mengen an jeder Stufe und fließenden Datenleitungen
     mqSvg   MQTT: Geräte links, Broker in der Mitte, Abonnenten rechts; die letzte Nachricht ist auf ihren Wegen hervorgehoben
     zuSvg   Zustandskurve einer Maschine mit Grenzwert, Meldung und Trend bis zum gewählten Tag
   Bewegung nur per CSS und nur bei prefers-reduced-motion: no-preference. Jedes Bild ist ohne Bewegung vollständig.
   Farben nur über die CSS-Variablen der Seite. Schrift im Bild mindestens 12,5 Einheiten bei Breite 360 (auf dem iPhone mit 350 px mindestens 12 px). */
(function (root) {
  const C = root.IOT_CORE || (typeof require === 'function' ? require('./iotcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const P = (pts, cls) => `<path class="${cls || ''}" d="M${pts.map(p => q(p[0]) + ' ' + q(p[1])).join(' L')}"/>`;
  const svg = (W, H, label, body, cls) => `<svg class="${cls || ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const fT = t => (t < 1 ? f(t * 1000, 0) + ' ms' : f(t, 0) + ' s');

  /* ============================================================ Datenkette */
  const DK_STAGES = ['Sensor', 'Mikrocontroller', 'Gateway (Edge)', 'Netzwerk', 'Server (Cloud)', 'Dashboard'];
  /* Zeichnung eines Symbols im Feld 44 x 44 (Ursprung links oben) */
  const ICONS = [
    /* Sensor: Thermometer mit Wellen */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><rect class="iline" x="17" y="7" width="8" height="21" rx="4"/><circle class="iacc" cx="21" cy="32" r="6"/><rect class="iacc" x="19.5" y="15" width="3" height="15" rx="1.5"/><path class="iline" d="M30 12 q4 3 0 6 M30 19 q4 3 0 6"/>',
    /* Mikrocontroller: Chip mit Beinchen */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><path class="iline" d="M14 6v6M22 6v6M30 6v6M14 32v6M22 32v6M30 32v6M6 14h6M6 22h6M6 30h6M32 14h6M32 22h6M32 30h6"/><rect class="ichip" x="11" y="11" width="22" height="22" rx="3"/><circle class="iacc" cx="17" cy="17" r="2.2"/>',
    /* Gateway: Kasten mit Antenne und Pfeilen */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><rect class="ichip" x="7" y="22" width="30" height="14" rx="3"/><path class="iline" d="M13 22V10M31 22V10"/><circle class="iacc" cx="13" cy="9" r="2.6"/><circle class="iacc" cx="31" cy="9" r="2.6"/><path class="iarr" d="M12 29h20M28 26l4 3-4 3"/>',
    /* Netzwerk: drei verbundene Knoten */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><path class="iline" d="M22 12L10 32M22 12L34 32M10 32H34"/><circle class="ichip" cx="22" cy="12" r="5"/><circle class="ichip" cx="10" cy="32" r="5"/><circle class="ichip" cx="34" cy="32" r="5"/>',
    /* Server in der Cloud */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><path class="ichip" d="M13 20a7 7 0 0 1 13-3 6 6 0 0 1 8 5.5 5 5 0 0 1-2 9.5H14a6 6 0 0 1-1-12z"/><circle class="iacc" cx="19" cy="25" r="1.8"/><circle class="iacc" cx="25" cy="25" r="1.8"/>',
    /* Dashboard: Bildschirm mit Kurve */
    '<rect class="ibox" x="0" y="0" width="44" height="44" rx="10"/><rect class="ichip" x="7" y="9" width="30" height="21" rx="3"/><path class="iacc2" d="M10 25 l6-6 5 4 7-9 6 5"/><path class="iline" d="M17 36h10M22 30v6"/>'
  ];
  function dkSvg(o) {
    const c = C.chain(o); if (!c) return '';
    const W = 360, pitch = 62, top = 12, H = top + 6 * pitch;
    const sw = bits => q(Math.min(7, 1.5 + 1.2 * Math.log10(1 + bits / 100)));
    const dur = q(0.6 + (Math.log10(o.t) + 1) / (Math.log10(60) + 1) * 3.4);
    const det = [
      f(c.n, 0) + ' Sensoren, je alle ' + fT(c.t) + ' ein Wert',
      f(c.b, 0) + ' Byte je Wert, ' + f(c.rawMsgS, c.rawMsgS < 10 ? 1 : 0) + ' Werte/s',
      c.av > 1 ? 'Mittelwert aus ' + f(c.av, 0) + ' Werten, spart ' + f(c.saved, 0) + ' %' : 'leitet jeden Wert weiter',
      f(c.outMsgS, c.outMsgS < 10 ? 2 : 0) + ' Nachrichten/s, ' + C.fmtRate(c.outBits),
      C.fmtBytes(c.outBytesDay) + ' je Tag, 1 Jahr ' + C.fmtBytes(c.store365),
      'Kurve, Grenzwert und Meldung'
    ];
    const wid = [sw(c.rawBits), sw(c.rawBits), sw(c.outBits), sw(c.outBits), 2];
    let b = '';
    for (let i = 0; i < 5; i++) {
      const y1 = top + i * pitch + 44 + 2, y2 = top + (i + 1) * pitch - 2;
      b += `<path class="idl" d="M32 ${y1} L32 ${y2}" style="stroke-width:${wid[i]}px"/><path class="idf" d="M32 ${y1} L32 ${y2}" style="stroke-width:${Math.max(2, wid[i] - 1)}px;--ivt:${dur}s"/>` + `<path class="iah" d="M27 ${y2 - 6} L32 ${y2} L37 ${y2 - 6}"/>`;
    }
    DK_STAGES.forEach((n, i) => {
      const y = top + i * pitch;
      b += `<g transform="translate(10 ${y})">${ICONS[i]}</g>` + T(66, y + 19, n, 'ib') + T(66, y + 38, det[i], 'im');
    });
    return svg(W, H, 'Datenkette: ' + det[0] + ', ' + det[3] + ', ' + det[4], b, 'ivs dk');
  }

  /* ============================================================ MQTT */
  /* o: { pubs:[{name, val}], subs:[{name}], last: { p, to:[Index] } oder null, retained: Anzahl } */
  function mqSvg(o) {
    const np = o.pubs.length, ns = o.subs.length, W = 360, ps = 60, H = Math.max(np * ps + 12, 250), by = 118, bx = 180;
    const py = i => 12 + i * ps + 20, sy = i => (H - ns * 66) / 2 + i * 66 + 24, last = o.last;
    let b = '';
    o.pubs.forEach((p, i) => { const on = last && last.p === i; b += `<path class="iml ${on ? 'on' : 'off'}" d="M102 ${py(i)} C 132 ${py(i)} 128 ${by} 146 ${by}"/>` + (on ? `<path class="imf" d="M102 ${py(i)} C 132 ${py(i)} 128 ${by} 146 ${by}"/>` : ''); });
    o.subs.forEach((s, i) => { const hit = last && last.to.includes(i); b += `<path class="iml ${hit ? 'on' : 'off'}" d="M214 ${by} C 234 ${by} 236 ${sy(i)} 258 ${sy(i)}"/>` + (hit ? `<path class="imf" d="M214 ${by} C 234 ${by} 236 ${sy(i)} 258 ${sy(i)}"/>` : ''); });
    o.pubs.forEach((p, i) => { const on = last && last.p === i; b += R(6, py(i) - 21, 96, 42, 'imb ' + (on ? 'send' : ''), 9) + T(54, py(i) - 3, p.name, 'ib ic') + T(54, py(i) + 14, on ? p.val : 'bereit', 'im ic'); });
    o.subs.forEach((s, i) => { const hit = last && last.to.includes(i); b += R(258, sy(i) - 24, 96, 48, 'imb ' + (hit ? 'hit' : ''), 9) + T(306, sy(i) - 4, s.name, 'ib ic') + T(306, sy(i) + 14, !last ? 'wartet' : hit ? 'erhält ✓' : 'kein Treffer', 'im ic ' + (hit ? 'iok' : '')); });
    b += `<circle class="imbr" cx="${bx}" cy="${by}" r="35"/><circle class="imbr2" cx="${bx}" cy="${by}" r="25"/>` + T(bx, by + 5, 'Broker', 'ib ic');
    b += R(128, by + 52, 104, 38, 'imb ret', 8) + T(180, by + 68, 'zurückgehalten', 'im ic') + T(180, by + 84, f(o.retained, 0) + (o.retained === 1 ? ' Nachricht' : ' Nachrichten'), 'ib ic');
    return svg(W, H, 'MQTT: ' + np + ' Geräte senden an den Broker, ' + ns + ' Abonnenten bekommen passende Nachrichten', b, 'ivs mq');
  }

  /* ============================================================ Zustand */
  /* o: { kind, vals, day, limit, k } */
  function zuSvg(o) {
    const K = C.KINDS[o.kind], W = 360, H = 224, x0 = 44, x1 = 350, y0 = 38, y1 = 186, N = C.DAYS;
    const X = d => x0 + d / (N - 1) * (x1 - x0), Y = v => y1 - (Math.min(K.hi, Math.max(K.lo, v)) - K.lo) / (K.hi - K.lo) * (y1 - y0);
    const st = C.zustand(o.vals, o.day, o.limit, o.k), alarm = st.alarmDay >= 0, dec = K.dec;
    let b = '';
    for (let i = 0; i <= 4; i++) { const v = K.lo + (K.hi - K.lo) * i / 4; b += L(x0, Y(v), x1, Y(v), 'izg') + T(x0 - 5, Y(v) + 4, f(v, v % 1 ? 1 : 0), 'im ie'); }
    [0, 20, 40, 59].forEach(d => { b += T(X(d), y1 + 18, String(d), 'im ic'); });
    b += T((x0 + x1) / 2, y1 + 31, 'Tag', 'im ic');
    b += L(x0, Y(o.limit), x1, Y(o.limit), 'izl') + T(x0 + 6, Y(o.limit) - 6, 'Grenze ' + f(o.limit, dec) + ' ' + K.unit, 'im iwarn');
    b += P(o.vals.slice(0, o.day + 1).map((v, i) => [X(i), Y(v)]), 'izc');
    o.vals.slice(0, o.day + 1).forEach((v, i) => { if (v >= o.limit) b += `<circle class="izp" cx="${q(X(i))}" cy="${q(Y(v))}" r="3"/>`; });
    if (st.tr && !alarm && fin(st.tr.days)) { const dx = Math.min(st.tr.days, N - 1 - o.day); b += P([[X(o.day), Y(st.tr.fit)], [X(o.day + dx), Y(st.tr.fit + st.tr.slope * dx)]], 'izt'); }
    if (alarm) b += L(X(st.alarmDay), y0 - 8, X(st.alarmDay), y1, 'izm');
    b += `<circle class="izn" cx="${q(X(o.day))}" cy="${q(Y(st.now))}" r="5"/>`;
    b += `<circle class="izlamp ${alarm ? 'bad' : 'ok'}" cx="14" cy="14" r="7"/>` + T(28, 19, alarm ? 'Wartung melden: Tag ' + st.alarmDay : 'in Ordnung', 'ib ' + (alarm ? 'ibad' : 'iok'));
    b += T(x1, 19, 'Tag ' + o.day + ': ' + f(st.now, dec) + ' ' + K.unit, 'im ie');
    return svg(W, H, K.name + ' bis Tag ' + o.day + ', Grenze ' + f(o.limit, dec) + ' ' + K.unit + (alarm ? ', Wartungsmeldung ab Tag ' + st.alarmDay : ', keine Meldung'), b, 'ivs zu');
  }

  /* CSS der Grafiken (wird im Browser einmal eingefügt). Klassen mit i-Vorsatz, nichts mit den Seitenklassen. */
  const CSS = `.ivs{display:block;width:100%;height:auto}.ivs text{font-family:system-ui,sans-serif;font-size:13px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.ivs .ib{font-weight:700;font-size:14px}.ivs .im{fill:var(--mute);font-size:13.5px}.ivs .ic{text-anchor:middle}.ivs .ie{text-anchor:end}.ivs .iok{fill:var(--ok)}.ivs .ibad{fill:var(--danger)}.ivs .iwarn{fill:var(--warn)}
.ivs .ibox{fill:var(--panel);stroke:var(--line);stroke-width:1.5}.ivs .iline{fill:none;stroke:var(--fg);stroke-width:1.8;stroke-linecap:round}.ivs .ichip{fill:var(--panel2);stroke:var(--fg);stroke-width:1.8;stroke-linejoin:round}
.ivs .iacc{fill:var(--accent);stroke:none}.ivs .iacc2{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.ivs .iarr{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ivs .idl{fill:none;stroke:var(--line);stroke-linecap:round}.ivs .idf{fill:none;stroke:var(--accent);stroke-linecap:round;stroke-dasharray:6 8}.ivs .iah{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.ivs .imb{fill:var(--panel);stroke:var(--line);stroke-width:1.6}.ivs .imb.send{stroke:var(--accent);stroke-width:2.6;fill:var(--panel2)}.ivs .imb.hit{stroke:var(--ok);stroke-width:2.6;fill:var(--panel2)}.ivs .imb.ret{stroke-dasharray:5 4}
.ivs .imbr{fill:var(--panel2);stroke:var(--accent);stroke-width:2.6}.ivs .imbr2{fill:none;stroke:var(--line);stroke-width:1.5}
.ivs .iml{fill:none;stroke-linecap:round}.ivs .iml.off{stroke:var(--line);stroke-width:2}.ivs .iml.on{stroke:var(--accent);stroke-width:3.4}.ivs .imf{fill:none;stroke:var(--panel);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:3 9;opacity:.9}
.ivs .izg{stroke:var(--line);stroke-width:1}.ivs .izl{stroke:var(--warn);stroke-width:1.8;stroke-dasharray:6 5}.ivs .izc{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.ivs .izt{fill:none;stroke:var(--hi);stroke-width:2.2;stroke-dasharray:5 5;stroke-linecap:round}.ivs .izm{stroke:var(--danger);stroke-width:1.8;stroke-dasharray:3 4}.ivs .izp{fill:var(--danger)}.ivs .izn{fill:var(--accent);stroke:var(--panel);stroke-width:2}
.ivs .izlamp.ok{fill:var(--ok)}.ivs .izlamp.bad{fill:var(--danger)}
.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:560px;margin:8px auto}.vzbox.full{max-width:none}
@media(prefers-reduced-motion:no-preference){
.ivs .idf{animation:ivFlow var(--ivt,2s) linear infinite}@keyframes ivFlow{from{stroke-dashoffset:0}to{stroke-dashoffset:-14}}
.ivs .imf{animation:ivMq 1.6s linear infinite}@keyframes ivMq{from{stroke-dashoffset:12}to{stroke-dashoffset:0}}
.ivs .izlamp.bad{animation:ivLamp 1.8s ease-in-out infinite}@keyframes ivLamp{0%,100%{opacity:1}50%{opacity:.45}}}`;

  const API = { dkSvg, mqSvg, zuSvg, CSS };
  root.IOT_VIZ = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('iotviz-css')) { try { const st = document.createElement('style'); st.id = 'iotviz-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
