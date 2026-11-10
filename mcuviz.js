'use strict';
/* Tonfunk Lab: gemeinsame Bilder für Pi-Lab und CodeLab (SVG ohne Bibliotheken). Wird von pilviz.js und codviz.js benutzt.
   Drei Ansichten im Bereich der Konsole, umschaltbar über die Reiter "Konsole | Pins | Signale":
     Pins     Board-Skizze mit allen Anschlüssen, beschriftet, mit Zustand (hoch/tief, Ausgang/Eingang, PWM) und Bauteilen live (LED, Taster, Poti).
     Signale  Zeitdiagramm der Ausgänge, die das Programm geschaltet hat (aus den echten Schaltzeiten der Simulation, kein Raten).
   Die Bilder lesen nur den Zustand der laufenden Simulation (LochMcuIO-Brücke) und bewerten nichts: keine Hinweise, keine Lösungen.
   Theme nur über CSS-Variablen; keine Animation. Reine Funktionen liefern SVG-Text (für Tests): window.McuViz bzw. module.exports. */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const de = (x, d) => { const k = Math.pow(10, d == null ? 1 : d); return (Math.round(x * k) / k).toString().replace('.', ','); };
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${num(x)}" y="${num(y)}"${extra || ''}>${esc(t)}</text>`;

  /* ============================================================ Raspberry-Pi-Pinleiste (40 Pins, Zählweise wie auf der Platine: ungerade links, gerade rechts) */
  const P = (n, name, kind, alt) => ({ p: n, name, kind, alt: alt || '' });
  const PI_PINS = [
    P(1, '3V3', '3v3'), P(2, '5V', '5v'), P(3, 'GPIO2', 'gpio', 'SDA'), P(4, '5V', '5v'), P(5, 'GPIO3', 'gpio', 'SCL'), P(6, 'GND', 'gnd'),
    P(7, 'GPIO4', 'gpio', 'GPCLK0'), P(8, 'GPIO14', 'gpio', 'TXD'), P(9, 'GND', 'gnd'), P(10, 'GPIO15', 'gpio', 'RXD'),
    P(11, 'GPIO17', 'gpio'), P(12, 'GPIO18', 'gpio', 'PWM0'), P(13, 'GPIO27', 'gpio'), P(14, 'GND', 'gnd'),
    P(15, 'GPIO22', 'gpio'), P(16, 'GPIO23', 'gpio'), P(17, '3V3', '3v3'), P(18, 'GPIO24', 'gpio'),
    P(19, 'GPIO10', 'gpio', 'MOSI'), P(20, 'GND', 'gnd'), P(21, 'GPIO9', 'gpio', 'MISO'), P(22, 'GPIO25', 'gpio'),
    P(23, 'GPIO11', 'gpio', 'SCLK'), P(24, 'GPIO8', 'gpio', 'CE0'), P(25, 'GND', 'gnd'), P(26, 'GPIO7', 'gpio', 'CE1'),
    P(27, 'ID_SD', 'id', 'EEPROM'), P(28, 'ID_SC', 'id', 'EEPROM'), P(29, 'GPIO5', 'gpio'), P(30, 'GND', 'gnd'),
    P(31, 'GPIO6', 'gpio'), P(32, 'GPIO12', 'gpio', 'PWM0'), P(33, 'GPIO13', 'gpio', 'PWM1'), P(34, 'GND', 'gnd'),
    P(35, 'GPIO19', 'gpio'), P(36, 'GPIO16', 'gpio'), P(37, 'GPIO26', 'gpio'), P(38, 'GPIO20', 'gpio'), P(39, 'GND', 'gnd'), P(40, 'GPIO21', 'gpio'),
  ];
  PI_PINS.forEach(q => { q.g = q.kind === 'gpio' ? +q.name.slice(4) : (q.kind === 'id' ? q.p - 27 : null); });
  const piGpio = g => PI_PINS.find(q => q.g === g) || null;

  /* Arduino Uno: Reihenfolge wie im Schaltplan-Symbol (links Versorgung und analog, rechts digital) */
  const UNO_L = [['5V', 'pwr5'], ['3V3', 'pwr3'], ['VIN', 'vin'], ['GND', 'gnd'], ['A0', 'a', 14], ['A1', 'a', 15], ['A2', 'a', 16], ['A3', 'a', 17], ['A4', 'a', 18], ['A5', 'a', 19]];
  const UNO_R = [['5V', 'pwr5']].concat(Array.from({ length: 14 }, (_, i) => ['D' + i, 'd', i])).concat([['GND', 'gnd']]);
  const UNO_PWM = [3, 5, 6, 9, 10, 11];
  const UNO_ALT = { D0: 'RX', D1: 'TX', D2: 'INT0', D3: 'INT1', D13: 'LED', A4: 'SDA', A5: 'SCL', D10: 'SS', D11: 'MOSI', D12: 'MISO' };

  const KIND_CLS = { '3v3': 'k3', '5v': 'k5', pwr3: 'k3', pwr5: 'k5', vin: 'k5', gnd: 'kg', id: 'ki', gpio: 'kp', a: 'kp', d: 'kp' };

  /* Zustandstext eines Pins: { mode, lvl, duty, tone, v } -> Kurztext */
  function stateText(s) {
    if (!s) return '';
    if (s.mode === 'ana') return fin(s.v) ? 'analog ' + de(s.v, 2) + ' V' : 'analog';
    if (s.tone) return 'Ton ' + de(s.tone, 0) + ' Hz';
    if (s.duty != null && s.duty > 0 && s.duty < 1) return 'PWM ' + de(s.duty * 100, 0) + ' %';
    const m = s.mode === 'out' ? 'Ausg.' : s.mode === 'up' ? 'Eing.↑' : s.mode === 'down' ? 'Eing.↓' : s.mode === 'in' ? 'Eing.' : '';
    if (s.lvl == null) return m;
    return (m ? m + ' ' : '') + (s.lvl ? 'hoch' : 'tief');
  }
  /* Zeile einer Pinliste: Punktfarbe nach Art und Zustand; hoch = gefüllt, tief = hohl (nicht nur Farbe) */
  function dot(x, y, kind, s, first) {
    const cls = KIND_CLS[kind] || 'kp', hi = s && s.lvl, pw = s && s.duty != null && s.duty > 0 && s.duty < 1;
    let c = `<circle class="mvd ${cls}${hi ? ' hi' : ''}${pw ? ' pw' : ''}" cx="${num(x)}" cy="${num(y)}" r="6"/>`;
    if (first) c = `<rect class="mvd ${cls} sq" x="${num(x - 6)}" y="${num(y - 6)}" width="12" height="12" rx="2"/>`;
    if (hi) c += `<circle class="mvh" cx="${num(x)}" cy="${num(y)}" r="2.4"/>`;
    else if (pw) c += `<path class="mvh" d="M${num(x - 3)} ${num(y)}a3 3 0 0 1 6 0z"/>`;
    return c;
  }

  /* o: { pins: { [Pin-Nr]: Zustand }, live: bool } */
  function piPins(o) {
    o = o || {}; const S = o.pins || {}, W = 340, RH = 19, top = 26, H = top + 20 * RH + 12, cx = W / 2, xl = cx - 13, xr = cx + 13;
    let b = `<rect class="mvpcb" x="${num(cx - 33)}" y="${top - 14}" width="66" height="${20 * RH + 8}" rx="8"/>`;
    b += `<rect class="mvhdr" x="${num(cx - 21)}" y="${top - 10}" width="42" height="${20 * RH}" rx="3"/>`;
    b += T(cx, 13, 'Pinleiste von oben, Pin 1 = Quadrat', 'mvcap', ' text-anchor="middle"');
    for (let r = 0; r < 20; r++) {
      const y = top + r * RH + RH / 2 - 2, a = PI_PINS[r * 2], c = PI_PINS[r * 2 + 1];
      [[a, xl, 'end', -12], [c, xr, 'start', 12]].forEach(([q, x, anchor, dx]) => {
        const s = S[q.p];
        b += dot(x, y, q.kind, s, q.p === 1);
        const st = stateText(s);
        b += T(x, y + 3, String(q.p), 'mvn', ' text-anchor="middle"');
        b += T(x + dx, y + 4, q.name, 'mvl ' + (KIND_CLS[q.kind] || ''), ` text-anchor="${anchor}"`);
        const sub = st || q.alt, off = q.name.length * 6.1 + 6;
        if (sub) b += T(x + dx + (anchor === 'end' ? -off : off), y + 4, sub, st ? 'mvs live' : 'mvs', ` text-anchor="${anchor}"`);
      });
    }
    return `<svg class="mvsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="GPIO-Pinleiste mit 40 Pins, links ungerade, rechts gerade Pin-Nummern">${b}</svg>`;
  }

  /* o: { pins: { [Name D0..D13, A0..A5]: Zustand }, running: bool } */
  function unoBoard(o) {
    o = o || {}; const S = o.pins || {}, W = 340, RH = 20, top = 34, n = 16, H = top + n * RH + 20, bx = 118, bw = 104, cx = bx + bw / 2;
    let b = `<rect class="mvpcb" x="${bx}" y="${top - 18}" width="${bw}" height="${n * RH + 18}" rx="9"/>`;
    b += `<rect class="mvusb" x="${cx - 22}" y="${top - 24}" width="44" height="26" rx="3"/>` + T(cx, top - 8, 'USB', 'mvtiny', ' text-anchor="middle"');
    b += `<rect class="mvchip" x="${cx - 18}" y="${top + 86}" width="36" height="66" rx="2"/>` + T(cx, top + 123, 'MCU', 'mvtiny', ` text-anchor="middle" transform="rotate(-90 ${cx} ${top + 120})"`);
    const lOn = S.D13 && S.D13.lvl;
    b += `<circle class="mvled${lOn ? ' on' : ''}" cx="${bx + bw - 24}" cy="${top + 13 * RH + 14}" r="5"/>` + T(bx + bw - 24, top + 13 * RH + 29, 'L', 'mvtiny', ' text-anchor="middle"');
    b += `<circle class="mvled${o.running ? ' on' : ''}" cx="${bx + 24}" cy="${top + 11 * RH + 2}" r="3.2"/>` + T(bx + 24, top + 11 * RH + 14, 'ON', 'mvtiny', ' text-anchor="middle"');
    b += `<text class="mvcap" x="${cx}" y="${top + 62}" text-anchor="middle">UNO</text>`;
    const row = (list, side) => list.forEach((q, r) => {
      const y = top + (side === 'L' ? r : r) * RH + 2, name = q[0], kind = q[1], s = S[name], x = side === 'L' ? bx : bx + bw;
      b += dot(x, y, kind, s, false);
      const st = stateText(s), alt = UNO_ALT[name] || (kind === 'd' && UNO_PWM.includes(q[2]) ? 'PWM' : '');
      const nm = name + (kind === 'd' && UNO_PWM.includes(q[2]) ? '~' : '');
      b += T(side === 'L' ? x - 11 : x + 11, y + 4, nm, 'mvl ' + (KIND_CLS[kind] || ''), ` text-anchor="${side === 'L' ? 'end' : 'start'}"`);
      const sub = st || alt;
      if (sub) b += T(side === 'L' ? x - 11 - (nm.length * 6.1 + 6) : x + 11 + (nm.length * 6.1 + 6), y + 4, sub, st ? 'mvs live' : 'mvs', ` text-anchor="${side === 'L' ? 'end' : 'start'}"`);
    });
    row(UNO_L, 'L'); row(UNO_R, 'R');
    b += T(cx, H - 6, 'Digital rechts · Versorgung und analog links', 'mvcap', ' text-anchor="middle"');
    return `<svg class="mvsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Arduino-Uno-Skizze mit Anschlüssen D0 bis D13, A0 bis A5 und Versorgung">${b}</svg>`;
  }

  /* Bauteile live: [{ kind:'led', label, color, lit:0..1 } | { kind:'sw', label, closed } | { kind:'pot', label, pos }] als HTML-Zeilen mit kleiner SVG-Marke */
  function partChips(list) {
    list = (list || []).filter(Boolean); if (!list.length) return '';
    return '<div class="mvparts" role="list" aria-label="Bauteile live">' + list.map(p => {
      let ic = '', tx = '';
      if (p.kind === 'led') { const lit = Math.max(0, Math.min(1, +p.lit || 0)); ic = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="mvled${lit > 0.08 ? ' on' : ''}" cx="10" cy="10" r="6" style="fill-opacity:${num(0.25 + 0.75 * lit)}"/></svg>`; tx = lit > 0.08 ? 'leuchtet' : 'aus'; }
      else if (p.kind === 'sw') { ic = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="mvd kp" cx="4" cy="14" r="2.4"/><circle class="mvd kp" cx="16" cy="14" r="2.4"/><path class="mvsw" d="${p.closed ? 'M4 14L16 14' : 'M4 14L15 6'}"/></svg>`; tx = p.closed ? 'gedrückt' : 'offen'; }
      else if (p.kind === 'pot') { const q = Math.max(0, Math.min(1, +p.pos || 0)); ic = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="mvd kp" cx="10" cy="10" r="7"/><path class="mvsw" d="M10 10L${num(10 + 6 * Math.sin((q - 0.5) * 4.7))} ${num(10 - 6 * Math.cos((q - 0.5) * 4.7))}"/></svg>`; tx = de(q * 100, 0) + ' %'; }
      else return '';
      return `<span class="mvpart" role="listitem">${ic}<span><b>${esc(p.label || '')}</b> ${esc(tx)}</span></span>`;
    }).join('') + '</div>';
  }

  /* ============================================================ Zeitdiagramm */
  /* o: { t: jetzt, win: Fensterbreite in s, lanes: [{ name, ev: [[t, wert, tag?]...] }] }; wert 0/1 digital, 0<wert<1 PWM-Anteil */
  const NICE = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const niceWin = span => NICE.find(x => x >= span) || NICE[NICE.length - 1];
  function laneStats(ev, t0, t1) {   // Frequenz aus den steigenden Flanken im Fenster und Anteil hoch
    const val = t => { let v = 0; for (let i = 0; i < ev.length && ev[i][0] <= t; i++) v = ev[i][1]; return v; };
    const rise = []; let prev = 0;
    ev.forEach(e => { if (e[1] >= 0.999 && prev < 0.999 && e[0] >= t0 && e[0] <= t1) rise.push(e[0]); prev = e[1]; });
    const pts = [[t0, val(t0)]].concat(ev.filter(e => e[0] > t0 && e[0] < t1).map(e => [e[0], e[1]]), [[t1, 0]]);
    let hi = 0; for (let i = 0; i < pts.length - 1; i++) hi += pts[i][1] * (pts[i + 1][0] - pts[i][0]);
    const span = Math.max(1e-9, t1 - t0);
    return { duty: hi / span, f: rise.length >= 2 ? (rise.length - 1) / Math.max(1e-9, rise[rise.length - 1] - rise[0]) : 0, rises: rise.length };
  }
  function timing(o) {
    o = o || {}; const lanes = (o.lanes || []).filter(l => l && l.ev && l.ev.length), W = 340, LH = 34, LB = 70, top = 8, PW = W - LB - 8;
    if (!lanes.length) return `<svg class="mvsvg" viewBox="0 0 ${W} 70" role="img" aria-label="Zeitdiagramm, noch keine Schaltvorgänge">` + T(W / 2, 30, 'Noch kein Pin geschaltet.', 'mvcap', ' text-anchor="middle"') + T(W / 2, 48, 'Programm starten: die Schaltzeiten erscheinen hier.', 'mvcap', ' text-anchor="middle"') + '</svg>';
    const now = fin(o.t) ? o.t : 0, win = o.win || niceWin(Math.max(0.5, now)), t1 = Math.max(now, win > now ? win : now), t0 = t1 - win, H = top + lanes.length * LH + 26;
    const X = t => LB + PW * (t - t0) / win;
    let b = '';
    for (let i = 0; i <= 4; i++) { const x = LB + PW * i / 4; b += `<line class="mvgrid" x1="${num(x)}" y1="${top - 2}" x2="${num(x)}" y2="${H - 22}"/>` + T(x, H - 8, de(t0 + win * i / 4, win < 2 ? 2 : win < 10 ? 1 : 0) + ' s', 'mvtick', ` text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}"`); }
    lanes.forEach((l, i) => {
      const y0 = top + i * LH, yh = y0 + 6, yl = y0 + LH - 10, st = laneStats(l.ev, Math.max(t0, l.ev[0][0]), now > l.ev[0][0] ? now : l.ev[0][0] + 1e-6);
      const txt = st.rises >= 2 ? de(st.f, st.f < 10 ? 2 : 1) + ' Hz · ' + de(st.duty * 100, 0) + ' %' : (st.duty > 0.5 ? 'dauernd hoch' : 'dauernd tief');
      b += T(4, y0 + 15, l.name, 'mvl') + T(4, y0 + 28, l.sub || txt, 'mvs');
      b += `<line class="mvbase" x1="${LB}" y1="${num(yl)}" x2="${W - 8}" y2="${num(yl)}"/>`;
      const evs = l.ev.slice(), segs = [];
      let cur = null; const prior = evs.filter(e => e[0] <= t0); if (prior.length) cur = prior[prior.length - 1];
      const inwin = evs.filter(e => e[0] > t0 && e[0] <= t1);
      const seq = (cur ? [[t0, cur[1], cur[2]]] : []).concat(inwin);
      let path = '', py = null;
      seq.forEach((e, k) => {
        const xa = X(Math.max(e[0], t0)), nx = k + 1 < seq.length ? seq[k + 1][0] : t1, xb = X(Math.min(nx, t1)), v = e[1];
        if (v > 0.001 && v < 0.999) {
          segs.push(`<rect class="mvpwm" x="${num(xa)}" y="${num(yh)}" width="${num(Math.max(0, xb - xa))}" height="${num(yl - yh)}"/>`);
          if (xb - xa > 46) segs.push(T((xa + xb) / 2, (yh + yl) / 2 + 3, e[2] || (de(v * 100, 0) + ' %'), 'mvtiny', ' text-anchor="middle"'));
          path += (path ? `L${num(xa)} ${num(yl)}` : `M${num(xa)} ${num(yl)}`); py = yl;
        } else {
          const y = v >= 0.999 ? yh : yl; path += (path ? (py !== y ? `L${num(xa)} ${num(py)}L${num(xa)} ${num(y)}` : '') : `M${num(xa)} ${num(y)}`) + `L${num(xb)} ${num(y)}`; py = y;
        }
      });
      b += segs.join('') + `<path class="mvtr" d="${path}"/>`;
    });
    b += `<line class="mvnow" x1="${num(X(now))}" y1="${top - 2}" x2="${num(X(now))}" y2="${H - 22}"/>`;
    return `<svg class="mvsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Zeitdiagramm der geschalteten Pins, ${lanes.length} Kanäle, Fenster ${de(win, 1)} Sekunden">${b}</svg>`;
  }

  /* ============================================================ Zustand aus der Simulation holen (nur Browser) */
  const CSS = '.mvbar{display:flex;gap:6px;padding:4px 6px;border-bottom:1px solid var(--line);flex:none}'
    + '.mvtab{min-height:34px;padding:0 12px;border-radius:17px;background:var(--panel2);border:1px solid var(--line);color:var(--fg);font:600 13px system-ui,sans-serif;cursor:pointer}'
    + '.mvtab.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}'
    + '@media(pointer:coarse){.mvtab{min-height:44px;padding:0 14px}}'
    + '.mvpanel{display:none;flex:none;max-height:min(72vh,560px);overflow:auto;padding:8px;background:var(--bg)}'
    + '@media(min-width:901px){.mvpanel{flex:1;min-height:0;max-height:none}}'
    + '#serWrap.mv-pins #mvPins,#serWrap.mv-sig #mvSig{display:block}'
    + '#serWrap.mv-pins #serOut,#serWrap.mv-pins #serPlot,#serWrap.mv-pins #serRow,#serWrap.mv-sig #serOut,#serWrap.mv-sig #serPlot,#serWrap.mv-sig #serRow{display:none!important}'
    + '#dock.mvbig{height:68%;max-height:80%}@media(min-width:901px){#dock.mvbig #serWrap{flex:3;min-width:320px}#dock.mvbig #edWrap{flex:2}}'
    + '.mvz{--mv-pcb:#1d6a4c;--mv-hdr:#10231c;--mv-chip:#2a2f36;--mv-usb:#b3bac2;--mv-3v3:#e08a2c;--mv-5v:#d8453b;--mv-led:#ffd24a}'
    + ':root[data-theme=light] .mvz{--mv-pcb:#58b08a;--mv-hdr:#2c4a3d;--mv-chip:#4a525c;--mv-usb:#8d96a0;--mv-3v3:#b86a10;--mv-5v:#b3261e;--mv-led:#e0a400}'
    + '.mvsvg{display:block;width:100%;max-width:420px;height:auto;margin:0 auto}'
    + '.mvpcb{fill:var(--mv-pcb);stroke:var(--line);stroke-width:1}.mvhdr{fill:var(--mv-hdr)}.mvusb{fill:var(--mv-usb);stroke:var(--line)}.mvchip{fill:var(--mv-chip)}'
    + '.mvd{fill:var(--panel);stroke-width:1.6}.mvd.kp{stroke:var(--accent)}.mvd.k3{stroke:var(--mv-3v3);fill:var(--mv-3v3)}.mvd.k5{stroke:var(--mv-5v);fill:var(--mv-5v)}.mvd.kg{stroke:var(--mute);fill:var(--mute)}.mvd.ki{stroke:var(--mute);stroke-dasharray:2 2}'
    + '.mvd.kp.hi{fill:var(--accent)}.mvd.kp.pw{fill:var(--panel)}.mvh{fill:var(--bg)}'
    + '.mvn{font:600 8px system-ui,sans-serif;fill:var(--mute)}.mvd.k3~.mvn,.mvd.k5~.mvn{fill:var(--bg)}'
    + '.mvl{font:600 11px system-ui,sans-serif;fill:var(--fg)}.mvl.k3{fill:var(--mv-3v3)}.mvl.k5{fill:var(--mv-5v)}.mvl.kg{fill:var(--mute)}'
    + '.mvs{font:10px system-ui,sans-serif;fill:var(--mute)}.mvs.live{fill:var(--fg);font-weight:600}'
    + '.mvcap,.mvtick{font:10px system-ui,sans-serif;fill:var(--mute)}.mvtiny{font:600 8px system-ui,sans-serif;fill:var(--bg)}.mvpcb~.mvtiny{fill:#fff}'
    + '.mvled{fill:var(--panel2);stroke:var(--mute);stroke-width:1}.mvled.on{fill:var(--mv-led);stroke:var(--mv-led)}'
    + '.mvparts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 2px}.mvpart{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:2px 10px 2px 6px;border-radius:16px;border:1px solid var(--line);background:var(--panel);font-size:12px;color:var(--fg)}'
    + '.mvpart svg{width:20px;height:20px;flex:none}.mvsw{stroke:var(--fg);stroke-width:1.8;stroke-linecap:round;fill:none}'
    + '.mvgrid{stroke:var(--line);stroke-width:1}.mvbase{stroke:var(--line);stroke-width:1;stroke-dasharray:2 3}.mvtr{fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linejoin:round}.mvnow{stroke:var(--mute);stroke-width:1;stroke-dasharray:3 3}'
    + '.mvpwm{fill:var(--accent);fill-opacity:.28}.mvnote{margin:8px 2px 0;font-size:12px;color:var(--mute)}'
    + '@media(max-width:600px){.mvl{font-size:11.5px}}';

  /* ============================================================ Anbindung an die laufende Simulation (nur im Browser) */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function attach(kind) {
    const isPi = kind === 'pi', IO = root.LochMcuIO, fname = isPi ? 'pi' : 'ard';
    if (typeof document === 'undefined' || !IO || typeof IO[fname] !== 'function') return null;
    const R = { el: null, X: null, lanes: {}, seen: {}, win: 0, tab: 'con' };
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } } };
    const nowT = () => { try { const t = R.X && R.X.S && R.X.S.t; return fin(t) ? t : 0; } catch (e) { return 0; } };
    const nm = q => (isPi ? 'GPIO' + q : (q < 14 ? 'D' + q : 'A' + (q - 14)));
    const sd = q => R.seen[q] || (R.seen[q] = {});
    function push(q, t, val, tag) {
      const key = String(q), l = R.lanes[key] || (R.lanes[key] = { key: q, name: nm(q), sub: '', ev: [] }), last = l.ev[l.ev.length - 1];
      if (last && last[1] === val && last[2] === tag) return;
      l.ev.push([t, val, tag]); if (l.ev.length > 3000) l.ev.splice(0, 600);
    }
    const reset = (el, X) => { R.el = el; R.X = X; R.lanes = {}; R.seen = {}; };
    function wrap(io) {
      const w = Object.assign({}, io), T0 = vt => (vt == null ? nowT() : vt);
      if (isPi) {
        w.setMode = (g, md) => { sd(g).mode = md; return io.setMode(g, md); };
        w.write = (g, v, vt) => { sd(g).mode = sd(g).mode || 'out'; push(g, T0(vt), v ? 1 : 0); return io.write(g, v, vt); };
        w.pwm = (g, dd) => { sd(g).mode = 'out'; push(g, nowT(), dd == null ? 0 : (dd <= 0 ? 0 : dd >= 1 ? 1 : dd), dd > 0 && dd < 1 ? 'PWM ' + de(dd * 100, 0) + ' %' : undefined); return io.pwm(g, dd); };
        w.tone = (g, f) => { sd(g).mode = 'out'; push(g, nowT(), f ? 0.5 : 0, f ? de(f, 0) + ' Hz' : undefined); return io.tone(g, f); };
        w.read = g => { if (!sd(g).mode) sd(g).mode = 'in'; return io.read(g); };
      } else {
        w.pinMode = (q, md) => { sd(q).mode = md === 1 ? 'out' : md === 2 ? 'up' : 'in'; return io.pinMode(q, md); };
        w.digitalWrite = (q, v, vt) => { sd(q).mode = sd(q).mode || 'out'; push(q, T0(vt), v ? 1 : 0); return io.digitalWrite(q, v, vt); };
        w.analogWrite = (q, v) => { sd(q).mode = 'out'; const pw = UNO_PWM.includes(q), d = clamp(v / 255, 0, 1); push(q, nowT(), pw ? (d <= 0 ? 0 : d >= 1 ? 1 : d) : (v >= 128 ? 1 : 0), pw && d > 0 && d < 1 ? 'PWM ' + de(d * 100, 0) + ' %' : undefined); return io.analogWrite(q, v); };
        w.tone = (q, f, dd) => { sd(q).mode = 'out'; push(q, nowT(), 0.5, de(f, 0) + ' Hz'); return io.tone(q, f, dd); };
        w.noTone = q => { push(q, nowT(), 0); return io.noTone(q); };
        w.digitalRead = q => { if (!sd(q).mode) sd(q).mode = 'in'; return io.digitalRead(q); };
        w.analogRead = q => { sd(q).ana = true; return io.analogRead(q); };
      }
      return w;
    }
    const orig = IO[fname];
    if (!orig.__mv) { const f = function (el, X) { reset(el, X); return wrap(orig.apply(this, arguments)); }; f.__mv = true; IO[fname] = f; }

    /* Zustand je Pin aus der Simulation (m = Pin-Zustand der Schaltung, S.v = Knotenspannungen) */
    function snapshot() {
      const el = R.el, X = R.X; if (!el || !X) return null;
      let S; const m = el.mcu; try { S = X.S; } catch (e) { return null; }
      if (!S || !m) return null;
      const volt = q => { try { const v = S.v[el.nd[el.pinNode(q)]]; return fin(v) ? v : null; } catch (e) { return null; } };
      const pins = {}, hi = isPi ? 1.65 : 2.5;
      const one = q => {
        const sn = R.seen[q]; if (!sn || (!sn.mode && !sn.ana)) return null;
        if (sn.ana && !sn.mode) return { mode: 'ana', v: volt(q) };
        if (sn.mode === 'out') { const d = m.duty[q], tn = m.tone[q]; return { mode: 'out', lvl: m.level[q] ? 1 : 0, duty: d == null ? null : (isPi ? d : d / 255), tone: tn ? tn.f : 0 }; }
        const v = volt(q); return { mode: sn.mode, lvl: v == null ? null : (v > hi ? 1 : 0), v };
      };
      if (isPi) PI_PINS.forEach(q => { if (q.g != null && (!el.hasPin || el.hasPin(q.g))) { const s = one(q.g); if (s) pins[q.p] = s; } });
      else for (let q = 0; q < 20; q++) { const s = one(q); if (s) pins[nm(q)] = s; }
      const parts = [], seenP = new Set();
      try {
        (X.C.elems || []).forEach(e => {
          const p = e.part; if (!p || seenP.has(p.id) || parts.length >= 8) return;
          if (e.type === 'D' && e.led) { seenP.add(p.id); parts.push({ kind: 'led', label: p.l || 'LED ' + (parts.filter(x => x.kind === 'led').length + 1), lit: Math.pow(clamp(Math.abs(e.iav != null ? e.iav : e.i) / 0.02, 0, 1), 0.6) }); }
          else if (e.type === 'S' && p.k === 'SW') { seenP.add(p.id); parts.push({ kind: 'sw', label: p.l || 'Taster ' + (parts.filter(x => x.kind === 'sw').length + 1), closed: !!e.closed }); }
        });
      } catch (e) { /* die Bauteilliste ist nur eine Zugabe */ }
      return { pins, parts, t: nowT() };
    }
    const note = t => '<p class="mvnote">' + t + '</p>';
    function paintPins() {
      const box = document.getElementById('mvPins'); if (!box) return;
      const sn = snapshot(), ok = !!sn;
      const svg = isPi ? piPins({ pins: sn ? sn.pins : {} }) : unoBoard({ pins: sn ? sn.pins : {}, running: ok });
      const h = svg + (ok ? partChips(sn.parts) + note('Zeigt den Zustand der laufenden Simulation. Bedient wird im Schaltplan.') : note('Noch nicht gestartet: Programm mit Start ausführen, dann erscheinen hier Zustand und Bauteile live.'));
      if (box.__h !== h) { box.innerHTML = h; box.__h = h; }
    }
    function paintSig() {
      const box = document.getElementById('mvSig'); if (!box) return;
      const t = nowT(), lanes = Object.values(R.lanes), win = R.win ? R.win : Math.min(10, niceWin(Math.max(0.5, t)));
      const shown = lanes.slice().sort((a, b) => b.ev[b.ev.length - 1][0] - a.ev[a.ev.length - 1][0]).slice(0, 6).sort((a, b) => a.key - b.key);
      const btn = (w, l) => '<button class="mvtab' + ((R.win || 0) === w ? ' on' : '') + '" data-win="' + w + '">' + l + '</button>';
      const h = '<div class="mvbar" style="padding:0 0 6px;border:0">' + btn(0, 'Auto') + btn(2, '2 s') + btn(10, '10 s') + btn(60, '60 s') + '</div>' + timing({ t, win, lanes: shown })
        + (lanes.length > 6 ? note('Es werden die 6 zuletzt geschalteten Pins gezeigt.') : '') + note('Zeit der Simulation. Hoch = Ausgang auf 1, tief = 0; schraffiert: PWM oder Ton laut Programm.');
      if (box.__h !== h) { box.innerHTML = h; box.__h = h; }
    }
    const paint = () => { if (R.tab === 'pins') paintPins(); else if (R.tab === 'sig') paintSig(); };
    function setTab(t) {
      R.tab = t; ls.set('lm4.mv.tab', t);
      const wrapEl = document.getElementById('serWrap'); if (!wrapEl) return;
      wrapEl.classList.toggle('mv-pins', t === 'pins'); wrapEl.classList.toggle('mv-sig', t === 'sig');
      const dk = document.getElementById('dock'); if (dk) dk.classList.toggle('mvbig', t !== 'con');
      wrapEl.querySelectorAll('.mvtab[data-mv]').forEach(b => b.classList.toggle('on', b.dataset.mv === t)); paint();
    }
    function ensure() {
      const wrapEl = document.getElementById('serWrap'), bar = document.getElementById('serBar'); if (!wrapEl || !bar || wrapEl.querySelector('#mvBar')) return;
      if (!document.getElementById('mvStyle')) { const st = document.createElement('style'); st.id = 'mvStyle'; st.textContent = CSS; document.head.appendChild(st); }
      bar.insertAdjacentHTML('afterend', '<div id="mvBar" class="mvbar" role="tablist" aria-label="Ansicht"><button class="mvtab on" data-mv="con" role="tab">Konsole</button><button class="mvtab" data-mv="pins" role="tab">Pins</button><button class="mvtab" data-mv="sig" role="tab">Signale</button></div>');
      wrapEl.insertAdjacentHTML('beforeend', '<div id="mvPins" class="mvpanel mvz"></div><div id="mvSig" class="mvpanel mvz"></div>');
      wrapEl.querySelector('#mvBar').addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (b) setTab(b.dataset.mv); });
      wrapEl.querySelector('#mvSig').addEventListener('click', e => { const b = e.target.closest('[data-win]'); if (b) { R.win = +b.dataset.win; paint(); } });
      const keep = ls.get('lm4.mv.tab'); if (keep === 'pins' || keep === 'sig') setTab(keep); else R.tab = 'con';
    }
    let q = 0; const go = () => { clearTimeout(q); q = setTimeout(ensure, 0); };
    new MutationObserver(go).observe(document.getElementById('dock') || document.body || document.documentElement, { childList: true, subtree: !!document.getElementById('dock') });
    ensure();
    setInterval(() => { if (!document.hidden && R.tab !== 'con') { try { paint(); } catch (e) { /* die Anzeige darf nie stören */ } } }, 160);
    return { R, snapshot, setTab, paint };
  }

  const API = { attach, piPins, unoBoard, partChips, timing, stateText, laneStats, niceWin, PI_PINS, UNO_L, UNO_R, piGpio, CSS };
  root.McuViz = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
