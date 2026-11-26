'use strict';
/* Tonfunk Systemanalyse-Lab: Grafiken (Lab-Kennung 'sya'). Wird in syalab.html VOR syaui.js geladen; syaui.js ruft window.SYA_VIZ auf.
   Reine Zeichenfunktionen (liefern SVG-Text ohne DOM, testbar mit node quelle/sya/test_syaviz.js):
     blockSvg      Blockschaltbild des Temperaturwächters TW-1 mit Bauteilsymbolen, Messpunkten MP1 bis MP8 und laufendem Signalfluss,
                   Netzteil und Steuerung als farbige Zonen; bei einem Fehler endet der Fluss an der Stelle, an der nichts mehr ankommt.
     benchSvg      Messplatz für den Reiter Gerät: Blockschaltbild, Messgerät bzw. Oszilloskop mit roter und schwarzer Messleitung zum Messpunkt,
                   Gerätefront (Anzeige, Kontroll-LED, Relaiskontakt, Lüfter). wide = Geräte neben dem Bild (Tablet), sonst darunter (Handy).
     meterSvg      Vielfachmessgerät mit Ziffernanzeige, Skala mit Zahlen, Bereichsanzeige und Zeiger, der beim Messen ausschlägt
     scopeSvg      Oszilloskop mit Kurve (Sinus oder Brummen), der Strahl läuft über den Schirm
     rippleSvg     gleichgerichtete Spannung und Elko-Spannung mit Scheitelwert und Brummspannung
     drvSvg        Relaistreiber (RB, NPN-Transistor, Spule, Freilaufdiode) mit Stromfluss
     ledSvg        LED mit Vorwiderstand
     thermSvg      Wärmewiderstände in Reihe von der Sperrschicht bis zur Umgebung, Wärmefluss läuft
     pruefSvg      Prüfaufbau für Schutzleiter-, Isolations- und Ableitstrommessung mit Messweg
     kvaSvg        Aufbau eines Kostenvoranschlags (Material, Arbeitszeit, Mehrwertsteuer) ohne Zahlen
     taskImg       Bild zur Aufgabe aus q.img
   Bewegung nur per CSS/SVG und nur bei prefers-reduced-motion: no-preference. Jedes Bild ist ohne Bewegung vollständig (nichts wird erst durch eine Animation sichtbar). Farben nur über die CSS-Variablen der Seite (Hell und Dunkel). */
(function (root) {
  const C = root.SYA_CORE || (typeof require === 'function' ? require('./syacore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const P = (pts, cls) => `<path class="${cls || ''}" d="M${pts.map(p => q(p[0]) + ' ' + q(p[1])).join(' L')}"/>`;
  const svg = (W, H, label, body, cls) => `<svg class="${cls || ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;

  /* ============================================================ Bauteilsymbole (Mitte cx, cy) */
  const SYM = {
    netz: (x, y) => `<g class="sy">${R(x - 16, y - 10, 20, 20, '', 3)}${L(x + 4, y - 5, x + 14, y - 5)}${L(x + 4, y + 5, x + 14, y + 5)}${L(x - 16, y, x - 24, y)}<path d="M${x - 9} ${y + 10} q 3 6 6 0"/></g>${T(x + 22, y + 4, '~', 'sl')}`,
    f1: (x, y) => `<g class="sy">${R(x - 30, y - 5, 22, 10, '')}${L(x - 34, y, x - 4, y)}${L(x + 4, y + 2, x + 24, y - 8)}<circle cx="${x + 4}" cy="${y + 2}" r="2"/><circle cx="${x + 26}" cy="${y + 2}" r="2"/></g>`,
    trafo: (x, y) => { let s = '<g class="sy">'; for (let i = 0; i < 3; i++) s += `<path d="M${x - 12} ${y - 15 + i * 10} a 5 5 0 0 0 0 10"/><path d="M${x + 12} ${y - 15 + i * 10} a 5 5 0 0 1 0 10"/>`; return s + L(x - 3, y - 16, x - 3, y + 16) + L(x + 3, y - 16, x + 3, y + 16) + '</g>'; },
    gl: (x, y) => `<g class="sy"><path d="M${x} ${y - 17} L${x + 17} ${y} L${x} ${y + 17} L${x - 17} ${y} Z"/><path class="fl" d="M${x - 6} ${y - 5} L${x + 4} ${y} L${x - 6} ${y + 5} Z"/>${L(x + 5, y - 6, x + 5, y + 6)}</g>`,
    c1: (x, y) => `<g class="sy">${L(x - 24, y, x - 4, y)}${L(x + 4, y, x + 24, y)}${R(x - 6, y - 13, 3, 26, 'fl')}<path d="M${x + 6} ${y - 13} q -4 13 0 26"/></g>${T(x - 16, y - 8, '+', 'sl')}`,
    reg: (x, y) => `<g class="sy">${R(x - 18, y - 9, 36, 22, '', 2)}${L(x - 14, y - 9, x - 14, y - 17)}${L(x - 5, y - 9, x - 5, y - 17)}${L(x + 4, y - 9, x + 4, y - 17)}${L(x + 13, y - 9, x + 13, y - 17)}${L(x, y + 13, x, y + 18)}</g>${T(x, y + 7, '5 V', 'sl mid')}`,
    mc: (x, y, disp) => `<g class="sy">${R(x - 34, y - 14, 30, 28, '', 2)}${[0, 1, 2, 3].map(i => L(x - 38, y - 9 + i * 6, x - 34, y - 9 + i * 6) + L(x - 4, y - 9 + i * 6, x, y - 9 + i * 6)).join('')}</g>${R(x + 4, y - 11, 36, 22, 'lcd', 3)}${T(x + 22, y + 5, disp == null ? '' : disp, 'lcdt mid')}`,
    ntc: (x, y) => `<g class="sy">${R(x - 14, y - 6, 28, 12, '')}${L(x - 26, y, x - 14, y)}${L(x + 14, y, x + 26, y)}${L(x - 12, y + 10, x + 12, y - 10)}${L(x - 16, y + 10, x - 12, y + 10)}</g>${T(x + 16, y - 9, 'ϑ', 'sl')}`,
    drv: (x, y) => `<g class="sy">${R(x - 36, y - 4, 16, 8, '')}${L(x - 40, y, x - 36, y)}${L(x - 20, y, x - 6, y)}<circle cx="${x + 4}" cy="${y}" r="13"/>${L(x - 6, y - 8, x - 6, y + 8)}${L(x - 6, y - 4, x + 9, y - 14)}${L(x - 6, y + 4, x + 9, y + 14)}<path class="fl" d="M${x + 9} ${y + 14} l -7 -1 l 3 -5 Z"/></g>`,
    rel: (x, y, on) => `<g class="sy">${R(x - 34, y - 9, 18, 18, '')}${L(x - 34, y + 9, x - 16, y - 9)}${L(x - 12, y, x - 2, y, 'dsh')}${L(x + 2, y + 8, x + 6, y + 8)}<g transform="translate(${x + 6} ${y + 8})"><line class="kon${on ? ' on' : ''}" x1="0" y1="0" x2="20" y2="-14"/></g><circle cx="${x + 30}" cy="${y + 4}" r="2"/></g>`,
    out: (x, y, on) => `<g class="sy"><circle cx="${x}" cy="${y}" r="16"/></g><g transform="translate(${x} ${y})"><g class="fan${on ? ' on' : ''}">${[0, 120, 240].map(a => `<path class="fl" transform="rotate(${a})" d="M0 0 q 4 -12 0 -13 q -6 2 0 13"/>`).join('')}</g></g>`
  };

  /* ============================================================ Blockschaltbild (Zeichenfläche DW x DH) */
  const BW = 96, BH = 70, DW = 416, DH = 450;
  const BL = {
    netz: [12, 28, 'Netz'], f1: [158, 28, 'F1 + S1'], trafo: [304, 28, 'Trafo T1'],
    gl: [304, 138, 'Brücke V1'], c1: [158, 138, 'Elko C1'], reg: [12, 138, 'Regler U1'],
    mc: [12, 250, 'Steuerung'], drv: [158, 250, 'Treiber V2'], rel: [304, 250, 'Relais K1'],
    ntc: [12, 358, 'Fühler NTC'], out: [304, 358, 'Lüfter']
  };
  /* Leitungen: Punkte, Messpunkt darauf (Mitte), Schlüssel für den Fluss */
  const WI = [
    { k: 'nf', pts: [[108, 63], [158, 63]] }, { k: 'ft', pts: [[254, 63], [304, 63]], mp: 'MP1' },
    { k: 'tg', pts: [[352, 98], [352, 138]], mp: 'MP2' }, { k: 'gc', pts: [[304, 173], [254, 173]] },
    { k: 'cr', pts: [[158, 173], [108, 173]], mp: 'MP3' }, { k: 'rm', pts: [[60, 208], [60, 250]], mp: 'MP4' },
    { k: 'nm', pts: [[60, 358], [60, 320]], mp: 'MP5' }, { k: 'md', pts: [[108, 285], [158, 285]], mp: 'MP6' },
    { k: 'dr', pts: [[254, 285], [304, 285]], mp: 'MP8' }, { k: 'ro', pts: [[352, 320], [352, 358]] },
    { k: 'cs', pts: [[206, 208], [206, 217], [336, 217], [336, 250]], dash: true }
  ];
  const mid = pts => { const a = pts[0], b = pts[pts.length - 1]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  /* Lage der Messpunkte und des Bezugspunkts (für die schwarze Messleitung) */
  const MPPOS = { MP7: [206, 345] }, GND = [206, 374];
  WI.forEach(w => { if (w.mp) MPPOS[w.mp] = mid(w.pts); });
  /* Fluss je Leitung aus der Simulation: 'on' läuft, 'stot' stockt, '' kein Fluss */
  function flows(s) {
    if (!s) return {};
    const m = s.mp, v = k => m[k].dc, F = {};
    F.nf = 'on'; F.ft = m.MP1.ac > 1 ? 'on' : ''; F.tg = m.MP2.ac > 1 ? 'on' : ''; F.gc = v('MP3') > 1 ? 'on' : '';
    F.cr = F.gc; F.cs = F.gc;
    F.rm = v('MP4') > 4.9 ? 'on' : v('MP4') > 0.5 ? 'stot' : '';
    F.nm = F.rm && !s.sensErr ? F.rm : '';
    F.md = v('MP6') > 1 ? (m.MP6.jump ? 'stot' : F.rm) : '';
    F.dr = s.relay === true ? 'on' : s.relay ? 'stot' : '';
    F.ro = F.dr;
    return F;
  }
  /* o: { sim, sel (Messpunkt), def (Block rot), mps (hervorgehobene Messpunkte), noflow } */
  function blockBody(o) {
    const s = o.sim || null, F = o.noflow ? {} : flows(s), hi = new Set(o.mps || []);
    let b = R(4, 4, DW - 8, 208, 'zone z1', 14) + T(206, 21, 'Netzteil', 'zl mid') + R(4, 222, DW - 8, 224, 'zone z2', 14) + T(206, 438, 'Steuerung und Last', 'zl mid');
    WI.forEach(w => {
      const d = 'M' + w.pts.map(p => p[0] + ' ' + p[1]).join(' L');
      b += `<path class="wire${w.dash ? ' d' : ''}${s && !F[w.k] ? ' off' : ''}" d="${d}"/>`;
      if (F[w.k]) b += `<path class="flow ${F[w.k]}" data-w="${w.k}" d="${d}"/>`;
    });
    b += L(206, 320, 206, 334, 'wire');
    Object.keys(BL).forEach(k => {
      const [x, y, n] = BL[k], cx = x + BW / 2, cy = y + 27;
      const disp = k === 'mc' && s ? (s.display === 'dunkel' ? '' : s.sensErr || (s.fault === 'regler' ? '?' : Math.round(s.T) + '°')) : k === 'mc' ? '25°' : null;
      b += `<g class="blk${o.def === k ? ' def' : ''}" data-b="${k}">${R(x, y, BW, BH, 'bf', 8)}${SYM[k](cx, cy, k === 'mc' ? disp : k === 'rel' || k === 'out' ? !!(s && s.relay) : null)}${T(cx, y + BH - 8, n, 'bn mid')}</g>`;
    });
    b += T(214, 242, '+U für die Spule', 'sl');
    b += `<g class="sy"><circle class="fl" cx="${GND[0]}" cy="${GND[1]}" r="3"/>${L(206, 374, 206, 386)}${L(194, 386, 218, 386)}${L(198, 391, 214, 391)}${L(202, 396, 210, 396)}</g>` + T(206, 414, 'Bezug (COM)', 'sl mid');
    const tag = (k, x, y) => `<g class="mp${o.sel === k ? ' on' : ''}${hi.has(k) ? ' hi' : ''}" data-mp="${k}" role="button" tabindex="0" aria-label="Messpunkt ${k}"><circle class="hit" cx="${q(x)}" cy="${q(y)}" r="22"/>${R(x - 20, y - 11, 40, 22, 'tg', 11)}${T(x, y + 4, k, 'tt mid')}</g>`;
    C.MPS.forEach(m => { b += tag(m.k, MPPOS[m.k][0], MPPOS[m.k][1]); });
    if (s && s.relay) b += T(352, 441, 'dreht', 'sl mid');
    return b;
  }
  const blockSvg = o => svg(DW, DH, 'Blockschaltbild Temperaturwächter TW-1 mit Messpunkten MP1 bis MP8', blockBody(o || {}), 'syv bsv');

  /* ============================================================ Messgerät (300 x 200), Buchsen links: rot V, schwarz COM */
  const RANGES = [0.2, 2, 20, 200, 600];
  const rangeFor = v => RANGES.find(r => Math.abs(v) <= r * 1.0001) || RANGES[RANGES.length - 1];
  const needleDeg = (v, r) => (fin(v) && r > 0 ? -60 + 120 * Math.min(1, Math.abs(v) / r) : -60);
  const JACK = { m: [[20, 34], [20, 70]], s: [[18, 40], [18, 76]] };
  const jacks = k => `<circle class="jk r" cx="${JACK[k][0][0]}" cy="${JACK[k][0][1]}" r="8"/><circle class="jk" cx="${JACK[k][1][0]}" cy="${JACK[k][1][1]}" r="8"/>`;
  /* m: { v, mode ('dc'|'ac'), jump } oder null; der Zielwinkel steht in data-deg und als Drehung am Zeiger */
  function meterBody(m) {
    const cx = 158, cy = 176, r = 84, has = !!m && fin(m.v);
    const rg = has ? rangeFor(m.v) : 20, deg = has ? needleDeg(m.v, rg) : -60, unit = m && m.mode === 'ac' ? 'V~' : 'V=';
    let b = R(4, 4, 292, 192, 'mbody', 16) + R(70, 14, 146, 40, 'lcd', 6);
    b += T(208, 44, has ? f(m.v, Math.abs(m.v) >= 100 ? 1 : 2) + ' ' + unit : '- - -', 'lcdt big end');
    b += T(226, 30, 'Bereich', 'sl') + T(226, 48, f(rg, 1) + ' ' + unit, 'sl b');
    for (let i = 0; i <= 20; i++) {
      const a = (-60 + 6 * i) * Math.PI / 180, r1 = i % 5 ? r - 6 : r - 13;
      b += L(cx + r * Math.sin(a), cy - r * Math.cos(a), cx + r1 * Math.sin(a), cy - r1 * Math.cos(a), 'tick');
      if (i % 5 === 0) b += T(cx + (r + 14) * Math.sin(a), cy - (r + 14) * Math.cos(a) + 4, f(rg * i / 20, 2), 'sn mid');
    }
    b += `<path class="arc" d="M${q(cx - r * Math.sin(Math.PI / 3))} ${q(cy - r * Math.cos(Math.PI / 3))} A ${r} ${r} 0 0 1 ${q(cx + r * Math.sin(Math.PI / 3))} ${q(cy - r * Math.cos(Math.PI / 3))}"/>`;
    b += `<g transform="translate(${cx} ${cy})"><g class="ndl${m && m.jump ? ' jit' : ''}" data-deg="${q(deg)}" style="transform:rotate(${q(deg)}deg)">${L(0, 0, 0, -(r - 8), 'ndll')}</g></g><circle class="piv" cx="${cx}" cy="${cy}" r="6"/>`;
    return b + jacks('m') + T(33, 38, 'V', 'sl') + T(33, 74, 'COM', 'sl');
  }
  const meterSvg = m => svg(300, 200, m && fin(m.v) ? 'Messgerät zeigt ' + f(m.v, 2) + (m.mode === 'ac' ? ' V~' : ' V=') : 'Messgerät ohne Messwert', meterBody(m), 'syv msv');

  /* ============================================================ Oszilloskop (300 x 190) */
  const VDIV = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  /* m: { v (Uss), dc, f, art ('ac'|'dc'), jump } */
  function scopeBody(m) {
    const x0 = 36, y0 = 10, w = 254, h = 150, nx = 10, ny = 6, cyv = y0 + h / 2;
    let b = R(2, 2, 296, 186, 'mbody', 12) + R(x0, y0, w, h, 'scr', 6);
    for (let i = 1; i < nx; i++) b += L(x0 + i * w / nx, y0, x0 + i * w / nx, y0 + h, 'grd');
    for (let j = 1; j < ny; j++) b += L(x0, y0 + j * h / ny, x0 + w, y0 + j * h / ny, 'grd');
    const pp = m && fin(m.v) ? m.v : 0, fr = m && m.f > 0 ? m.f : 0, vd = VDIV.find(x => pp <= x * 5) || 200, sc = (h / ny) / vd;
    const pts = [], per = fr ? 2 : 1, N = 160;
    for (let i = 0; i <= N; i++) {
      const t = i / N * per, ph = t - Math.floor(t); let y = 0;
      if (m && m.jump) y = (t < 0.5 ? 0.5 : -0.5) * pp;
      else if (!fr || pp < 0.02) y = 0;
      else if (m.art === 'ac') y = Math.sin(2 * Math.PI * t) * pp / 2;
      else y = (ph < 0.15 ? -0.5 + ph / 0.15 : 0.5 - (ph - 0.15) / 0.85) * pp;
      pts.push([x0 + i / N * w, cyv - y * sc]);
    }
    const d = 'M' + pts.map(p => q(p[0]) + ' ' + q(Math.max(y0 + 1, Math.min(y0 + h - 1, p[1])))).join(' L');
    b += `<path class="trc" d="${d}"/><path class="beam" pathLength="100" d="${d}"/>`;
    const tdiv = fr ? 2 / fr * 1000 / nx : 0;
    b += T(x0 + 6, y0 + 16, (m && m.art === 'dc' ? 'AC-Kopplung  ' : '') + f(vd, 2) + ' V/div' + (tdiv ? '  ' + f(tdiv, 1) + ' ms/div' : ''), 'stx');
    b += T(12, 178, m ? 'Uss = ' + f(pp, 2) + ' V' + (fr ? '   f = ' + f(fr, 0) + ' Hz' : m.jump ? '   springt (Sekunden)' : '') + (m.art === 'dc' && fin(m.dc) ? '   Mittelwert ' + f(m.dc, 2) + ' V' : '') : 'Oszilloskop: kein Signal', 'sl');
    return b + jacks('s');
  }
  const scopeSvg = m => svg(300, 190, 'Oszilloskop: Spannungsverlauf am Messpunkt', scopeBody(m), 'syv scv');

  /* ============================================================ Gerätefront (300 x 150): Anzeige, Kontroll-LED, Relaiskontakt, Lüfter */
  function frontBody(s) {
    const on = !s || s.display !== 'dunkel', led = !!(s && s.led === 'an'), rel = !!(s && s.relay);
    const txt = !s ? '25 °C' : !on ? '' : s.sensErr || Math.round(s.T) + ' °C', unruhig = !!s && on && (s.fault === 'regler' || s.fault === 'elko');
    let b = R(2, 2, 296, 146, 'mbody', 14) + T(14, 21, 'Gerätefront TW-1', 'sl b');
    b += R(14, 30, 104, 44, 'lcd' + (on ? '' : ' aus'), 6) + `<g class="${unruhig ? 'blink' : 'still'}">${T(66, 60, txt, 'lcdt big mid')}</g>`;
    b += `<circle class="ledg${led ? ' on' : ''}" cx="150" cy="52" r="15"/><circle class="led${led ? ' on' : ''}" cx="150" cy="52" r="9"/>` + SYM.rel(212, 52, rel) + SYM.out(268, 52, rel);
    b += T(66, 92, 'Anzeige', 'sn mid') + T(150, 92, 'LED', 'sn mid') + T(208, 92, 'Relais K1', 'sn mid') + T(268, 92, 'Lüfter', 'sn mid');
    const l1 = !s ? '' : !on ? 'Anzeige dunkel' : s.fault === 'regler' ? 'Anzeige fällt nach Minuten aus, kommt wieder' : s.fault === 'elko' ? 'Anzeige flackert, manchmal Neustart' : s.sensErr ? 'Anzeige meldet Fühlerfehler ' + s.sensErr : 'Anzeige zeigt die Temperatur';
    const l2 = 'Relais ' + (s && s.relay === true ? 'angezogen, Lüfter läuft' : rel ? 'zieht ab und zu an' : 'aus, Lüfter steht') + ', LED ' + (led ? 'an' : 'aus');
    return b + T(14, 116, l1, 'sl') + T(14, 136, l2, 'sl');
  }

  /* ============================================================ Messplatz: Bild, Messgerät oder Oszilloskop, Messleitungen, Gerätefront */
  /* o: { sim, sel, def, m (Ergebnis von measure), mode ('dc'|'ac'|'osz'), wide } */
  function benchSvg(o) {
    o = o || {}; const wide = !!o.wide, k = wide ? 1.28 : 1, osz = o.mode === 'osz', m = o.sel ? o.m || null : null;
    const ix = wide ? 552 : 58, W = wide ? 860 : DW, H = wide ? 576 : 816;
    const at = (x, y, body, cls) => `<g class="${cls}" transform="translate(${x} ${y})">${body}</g>`;
    let b = `<g transform="scale(${k})">${blockBody(o)}</g>`, jy;
    if (wide) { b += at(ix, 6, meterBody(osz ? null : m), osz ? 'mtg idle' : 'mtg') + at(ix, 214, scopeBody(osz ? m : null), osz ? 'scg' : 'scg idle') + at(ix, 412, frontBody(o.sim), 'frg'); jy = osz ? 214 : 6; }
    else { b += at(ix, 456, osz ? scopeBody(m) : meterBody(m), osz ? 'scg' : 'mtg') + at(ix, 662, frontBody(o.sim), 'frg'); jy = 456; }
    if (o.sel && MPPOS[o.sel]) {
      const J = JACK[osz ? 's' : 'm'], p = MPPOS[o.sel];
      const lead = (a, t, cls) => `<path class="lead ${cls}" d="M${q(a[0])} ${q(a[1])} C${q(a[0] - 40)} ${q(a[1] - 40)} ${q(t[0] + (a[0] - t[0]) * 0.3)} ${q(t[1] + 70)} ${q(t[0])} ${q(t[1])}"/><circle class="tip ${cls}" cx="${q(t[0])}" cy="${q(t[1])}" r="4.5"/>`;
      b += lead([ix + J[1][0], jy + J[1][1]], [GND[0] * k, GND[1] * k], 'k') + lead([ix + J[0][0], jy + J[0][1]], [p[0] * k, (p[1] + 11) * k], 'r');
    }
    return svg(W, H, 'Messplatz: Blockschaltbild TW-1 mit Messpunkten, ' + (osz ? 'Oszilloskop' : 'Messgerät') + ' und Gerätefront', b, 'syv bench');
  }

  /* ============================================================ Gleichrichtung und Glättung */
  /* p: { up (Scheitelwert am Elko), pp (Brummspannung Uss), f (100 oder 50) }; zeigt pulsierende Spannung und Elko-Spannung */
  function rippleSvg(p) {
    p = p || {}; const W = 360, H = 200, x0 = 40, x1 = 350, y0 = 160, y1 = 22, up = fin(p.up) && p.up > 0 ? p.up : 10, pp = fin(p.pp) ? Math.max(0, Math.min(p.pp, up)) : 1, half = p.f === 50;
    const Y = v => y0 - v / up * (y0 - y1), X = t => x0 + t * (x1 - x0);
    let b = L(x0, y0, x1, y0, 'ax') + L(x0, y0, x0, y1 - 8, 'ax');
    const sin = [], cap = []; const N = 240;
    for (let i = 0; i <= N; i++) { const t = i / N, ph = t * 4, s = Math.abs(Math.sin(Math.PI * ph)), g = half && Math.floor(ph) % 2 ? 0 : s; sin.push([X(t), Y(g * up)]); }
    let u = up; const dec = pp / (half ? 2 : 1) / (N / 4);
    for (let i = 0; i <= N; i++) { const t = i / N, ph = t * 4, s = Math.abs(Math.sin(Math.PI * ph)), g = (half && Math.floor(ph) % 2 ? 0 : s) * up; u = Math.max(g, u - dec); cap.push([X(t), Y(u)]); }
    b += P(sin, 'rs1') + `<path class="rs2" d="M${cap.map(c => q(c[0]) + ' ' + q(c[1])).join(' L')}"/>`;
    b += L(x0 - 4, Y(up), x1, Y(up), 'lim') + T(x0 - 6, Y(up) + 4, 'Û', 'sl end');
    b += L(x1 - 14, Y(up), x1 - 14, Y(up - pp), 'dim') + T(x1 - 18, Y(up - pp / 2) + 4, 'ΔU', 'sl end');
    b += T(x0 + 4, H - 14, half ? 'eine Halbwelle fehlt: Brummen mit 50 Hz' : 'Brückengleichrichter: Brummen mit 100 Hz', 'sl');
    b += T(x0 + 150, y1 - 6, 'Elko-Spannung', 'sl ac') + T(x0 + 4, y1 - 6, 'gleichgerichtet', 'sl m');
    return svg(W, H, 'Gleichgerichtete Spannung und geglättete Spannung am Ladeelko', b, 'syv rpv');
  }

  /* ============================================================ Relaistreiber und LED */
  /* p: { on, labels } Schaltung: µC-Ausgang, RB, NPN, Spule mit Freilaufdiode an +U */
  function drvSvg(p) {
    p = p || {}; const W = 360, H = 230, on = !!p.on;
    let b = '';
    const wire = (pts, k) => { const d = 'M' + pts.map(x => x[0] + ' ' + x[1]).join(' L'); return `<path class="wire" d="${d}"/>` + (on && k ? `<path class="flow on" d="${d}"/>` : ''); };
    b += wire([[30, 140], [70, 140]], 1) + R(70, 133, 40, 14, 'cmp') + wire([[110, 140], [170, 140]], 1);
    b += `<circle class="cmp" cx="188" cy="140" r="24"/>` + L(170, 124, 170, 156, 'sym') + L(170, 132, 196, 116, 'sym') + L(170, 148, 196, 164, 'sym') + `<path class="fl" d="M196 164 l -9 -2 l 4 -7 Z"/>`;
    b += wire([[196, 116], [196, 100]], 1) + R(181, 60, 30, 40, 'cmp') + L(181, 100, 211, 60, 'sym') + wire([[196, 60], [196, 30]], 1);
    b += L(196, 30, 196, 22, 'wire') + T(204, 26, '+U', 'sl');
    b += wire([[196, 104], [260, 104], [260, 92]]) + `<path class="cmp" d="M250 72 L270 72 L260 88 Z"/>` + L(250, 88, 270, 88, 'sym') + wire([[260, 72], [260, 50], [196, 50]]);
    b += wire([[196, 164], [196, 200]], 1) + L(182, 200, 210, 200, 'sym') + L(186, 205, 206, 205, 'sym') + L(191, 210, 201, 210, 'sym');
    b += T(16, 128, 'µC', 'sl') + T(90, 126, 'RB', 'sl mid') + T(222, 82, 'Spule', 'sl') + T(276, 84, 'V3', 'sl') + T(222, 145, 'V2', 'sl') + T(120, 162, 'IB', 'sl ac') + T(140, 82, 'IC', 'sl ac');
    if (p.labels) b += T(16, 222, p.labels, 'sl');
    return svg(W, H, 'Relaistreiber mit Basiswiderstand, NPN-Transistor, Relaisspule und Freilaufdiode', b, 'syv drvv');
  }
  function ledSvg(p) {
    p = p || {}; const W = 360, H = 150;
    let b = `<path class="wire" d="M40 40 L120 40"/><path class="flow on" d="M40 40 L120 40 L160 40 L210 40 L290 40 L290 110 L40 110"/>` + R(120, 33, 40, 14, 'cmp') + `<path class="wire" d="M160 40 L210 40"/>`;
    b += `<path class="cmp" d="M210 28 L234 40 L210 52 Z"/>` + L(234, 28, 234, 52, 'sym') + `<path class="wire" d="M234 40 L290 40 L290 110 L40 110"/>`;
    b += L(240, 22, 252, 10, 'ray') + L(248, 26, 260, 14, 'ray');
    b += `<circle class="cmp" cx="40" cy="75" r="16"/>` + L(40, 40, 40, 59, 'wire') + L(40, 91, 40, 110, 'wire') + T(40, 72, '+', 'sl mid') + T(40, 86, '−', 'sl mid');
    b += T(140, 26, 'R', 'sl mid') + T(222, 70, 'LED', 'sl mid') + T(8, 79, p.u || 'U', 'sl') + T(140, 66, 'UR', 'sl mid ac') + T(222, 88, 'UF', 'sl mid ac') + T(180, 132, 'I', 'sl ac');
    return svg(W, H, 'LED mit Vorwiderstand an einer Spannungsquelle', b, 'syv ledv');
  }

  /* ============================================================ Wärmewiderstände */
  /* p: { P, tj, tu, rjg, rgk, rk } (Zahlen optional) */
  function thermSvg(p) {
    p = p || {}; const W = 372, H = 160, X = i => 52 + i * 90;
    const nodes = [['Sperrschicht', 'ϑj'], ['Gehäuse', 'ϑG'], ['Kühlkörper', 'ϑK'], ['Umgebung', 'ϑu']], res = [['Rth,JG', p.rjg], ['Rth,GK', p.rgk], ['Rth,K', p.rk]];
    let b = `<path class="heat" d="M${X(0)} 70 L${X(3)} 70"/>`;
    nodes.forEach((n, i) => { b += `<circle class="nd" cx="${X(i)}" cy="70" r="7"/>` + T(X(i), 46, n[1], 'sl mid b') + T(X(i), 102, n[0], 'sl mid'); });
    res.forEach((r, i) => { const x = X(i) + 45; b += R(x - 22, 61, 44, 18, 'cmp', 3) + T(x, 122, r[0], 'sl mid') + (fin(r[1]) ? T(x, 140, f(r[1], 2) + ' K/W', 'sl mid ac') : ''); });
    if (fin(p.tj)) b += T(X(0), 24, f(p.tj, 0) + ' °C', 'sl mid');
    if (fin(p.tu)) b += T(X(3), 24, f(p.tu, 0) + ' °C', 'sl mid');
    b += T(W / 2, 24, fin(p.P) ? 'Wärmestrom P = ' + f(p.P, 2) + ' W' : 'Wärmestrom P', 'sl mid hi');
    return svg(W, H, 'Wärmewiderstände in Reihe von der Sperrschicht bis zur Umgebung', b, 'syv thv');
  }

  /* ============================================================ Prüfaufbau */
  /* m: 'rpe' | 'riso' | 'ileak' | '' ; sk: 1 oder 2. Prüfgerät mit Prüfdose und Sonde, Netzleitung, Gerät, Prüfspitze am Gehäuse.
     Bei Schutzklasse II gibt es keinen Schutzleiter: Die Schutzleitermessung entfällt (steht im Bild). */
  const PR_TXT = {
    rpe1: ['Schutzleiterwiderstand: Prüfstrom mindestens 0,2 A', 'Weg: Schutzleiter, Gehäuse, Prüfspitze. Leitung dabei bewegen.'],
    rpe2: ['Schutzklasse II hat keinen Schutzleiter.', 'Die Schutzleitermessung entfällt.'],
    riso1: ['Isolationswiderstand: 500 V Gleichspannung', 'L und N verbunden, gemessen gegen den Schutzleiter'],
    riso2: ['Isolationswiderstand: 500 V Gleichspannung', 'L und N verbunden, gegen berührbare leitfähige Teile'],
    ileak1: ['Schutzleiterstrom: Das Gerät ist eingeschaltet', 'Gemessen wird der Strom im Schutzleiter'],
    ileak2: ['Berührungsstrom: Das Gerät ist eingeschaltet', 'Prüfspitze an berührbaren leitfähigen Teilen']
  };
  function pruefSvg(m, sk) {
    const W = 396, H = 236, k2 = sk === 2, nix = m === 'rpe' && k2, mess = !!PR_TXT[m + '1'] && !nix, spitze = mess && (m === 'rpe' || k2);
    const cab = 'M68 118 C130 118 190 96 250 96', prb = 'M124 149 C150 226 290 228 312 178', txt = PR_TXT[m + (k2 ? 2 : 1)] || ['Prüfaufbau: Das Gerät steckt in der Prüfdose', ''];
    let b = T(8, 22, txt[0], 'sl b') + T(8, 228, txt[1], 'sl');
    b += R(8, 36, 136, 128, 'cmp', 12) + T(76, 54, 'Prüfgerät', 'sl mid b') + R(22, 62, 108, 28, 'lcd', 4);
    b += T(76, 82, nix ? '- - -' : m === 'riso' ? 'RISO 500 V' : m === 'rpe' ? 'RPE in Ω' : m === 'ileak' ? (k2 ? 'IB in mA' : 'IPE in mA') : 'bereit', 'lcdt mid');
    b += `<circle class="cmp" cx="48" cy="118" r="18"/><circle class="fl" cx="41" cy="118" r="2.5"/><circle class="fl" cx="55" cy="118" r="2.5"/>` + T(48, 154, 'Prüfdose', 'sn mid') + `<circle class="jk r" cx="118" cy="144" r="7"/>` + T(118, 130, 'Sonde', 'sn mid');
    b += R(250, 44, 122, 112, k2 ? 'hous sk2' : 'hous', 10) + T(311, 66, 'TW-1', 'bn mid') + T(311, 84, k2 ? 'Kunststoffgehäuse' : 'Metallgehäuse', 'sl mid') + T(311, 102, 'Schutzklasse ' + (k2 ? 'II' : 'I'), 'sl mid');
    b += k2 ? R(299, 112, 24, 24, 'sym') + R(304, 117, 14, 14, 'sym') : `<circle class="sym" cx="311" cy="126" r="13"/>` + L(311, 117, 311, 125, 'sym') + L(303, 125, 319, 125, 'sym') + L(306, 129, 316, 129, 'sym') + L(309, 133, 313, 133, 'sym');
    b += `<path class="cable" d="${cab}"/>` + R(56, 110, 14, 16, 'fl', 3) + T(198, 130, 'Netzleitung', 'sl mid') + T(198, 146, k2 ? '(L, N)' : '(L, N, PE)', 'sl mid');
    if (mess) b += `<path class="flow on" d="${cab}"/>`;
    if (spitze) b += `<path class="cable p" d="${prb}"/><path class="flow on" d="${prb}"/>` + L(312, 178, 317, 162, 'hdl') + L(317, 162, 318.5, 156, 'sym') + T(326, 182, 'Prüfspitze', 'sl');
    return svg(W, H, 'Prüfaufbau für die Prüfung nach Instandsetzung', b, 'syv prv');
  }

  /* ============================================================ Kostenvoranschlag (ohne Zahlen) */
  function kvaSvg() {
    const W = 360, H = 128;
    let b = R(10, 30, 120, 34, 'k1', 4) + R(130, 30, 150, 34, 'k2', 4) + R(280, 30, 60, 34, 'k3', 4);
    b += T(70, 52, 'Material', 'sl mid b') + T(205, 52, 'Arbeitszeit', 'sl mid b') + T(310, 52, 'MwSt', 'sl mid b');
    b += `<path class="dim" d="M10 76 L280 76"/>` + T(145, 94, 'Netto = Material + Stunden · Stundensatz', 'sl mid') + `<path class="dim" d="M10 104 L340 104"/>` + T(175, 118, 'Brutto = Netto + 19 %', 'sl mid');
    return svg(W, H, 'Aufbau eines Kostenvoranschlags', b, 'syv kvv');
  }

  /* ============================================================ Bild zur Aufgabe */
  function taskImg(img) {
    if (!img || !img.k) return '';
    if (img.k === 'block') return blockSvg({ mps: img.mps || [], noflow: true });
    if (img.k === 'ripple') return rippleSvg(img);
    if (img.k === 'scope') return scopeSvg(img);
    if (img.k === 'drv') return drvSvg({ on: true });
    if (img.k === 'led') return ledSvg({});
    if (img.k === 'therm') return thermSvg({});
    if (img.k === 'pruef') return pruefSvg(img.m || '', img.sk || 1);
    if (img.k === 'kva') return kvaSvg();
    return '';
  }

  /* CSS der Grafiken (wird im Browser einmal eingefügt) */
  const CSS = `.syv{display:block;width:100%;height:auto}.syv text{font-family:system-ui,sans-serif;font-size:13px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.syv .sl{font-size:12.5px}.syv .sn{font-size:11.5px;fill:var(--mute)}.syv .b{font-weight:700}.syv .mid{text-anchor:middle}.syv .end{text-anchor:end}.syv .m{fill:var(--mute)}.syv .ac{fill:var(--accent)}.syv .hi{fill:var(--hi)}
.syv .bn{font-size:13px;font-weight:700}
.syv .zone{stroke-width:1.2;stroke-dasharray:5 4}.syv .z1{fill:var(--accent);fill-opacity:.09;stroke:var(--accent)}.syv .z2{fill:var(--ok);fill-opacity:.1;stroke:var(--ok)}.syv .zl{font-size:12.5px;font-weight:700;fill:var(--mute)}
.syv .bf{fill:var(--panel);stroke:var(--mute);stroke-width:1.4}.syv .blk.def .bf{stroke:var(--danger);stroke-width:3.5;fill:var(--danger);fill-opacity:.12}
.syv .sy,.syv .sym{fill:none;stroke:var(--fg);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.syv .sy .fl,.syv .fl{fill:var(--fg)}.syv .sy .dsh,.syv .dsh{stroke-dasharray:2 3}
.syv .kon.on{transform:rotate(25deg)}
.syv .lcd{fill:#c9d8b6;stroke:var(--line)}.syv .lcd.aus{opacity:.35}.syv .lcdt{fill:#1d2a12;font:700 13px ui-monospace,Menlo,Consolas,monospace}.syv .lcdt.big{font-size:22px}
.syv .wire{fill:none;stroke:var(--fg);stroke-width:2.4;stroke-linejoin:round}.syv .wire.d{stroke-dasharray:6 4;stroke:var(--mute)}.syv .wire.off{stroke:var(--mute);opacity:.5}
.syv .flow{fill:none;stroke:var(--accent);stroke-width:5.5;stroke-linecap:round;stroke-dasharray:3 13;stroke-linejoin:round}
.syv .mp .tg{fill:var(--panel2);stroke:var(--accent);stroke-width:1.8}.syv .mp .tt{fill:var(--accent);font-size:12.5px;font-weight:700;pointer-events:none}.syv .mp{cursor:pointer}.syv .mp .hit{fill:transparent}
.syv .mp.on .tg,.syv .mp.hi .tg{fill:var(--accent-bg)}.syv .mp.on .tt,.syv .mp.hi .tt{fill:#fff}.syv .mp:focus{outline:none}.syv .mp:focus .tg{stroke:var(--fg);stroke-width:3}
.syv .mbody{fill:var(--panel2);stroke:var(--mute);stroke-width:1.6}.syv .tick,.syv .arc{stroke:var(--fg);stroke-width:1.5;fill:none}.syv .ndll{stroke:var(--danger);stroke-width:3;stroke-linecap:round}.syv .piv{fill:var(--fg)}
.syv .jk{fill:var(--fg);stroke:var(--line);stroke-width:2}.syv .jk.r{fill:var(--danger)}
.syv .lead{fill:none;stroke-width:3.5;stroke-linecap:round;pointer-events:none}.syv .tip{pointer-events:none;stroke:var(--panel);stroke-width:1.5}.syv .lead.r{stroke:var(--danger)}.syv .tip.r{fill:var(--danger)}.syv .lead.k{stroke:var(--fg)}.syv .tip.k{fill:var(--fg)}
.syv .idle{opacity:.4}
.syv .led{fill:var(--panel);stroke:var(--fg);stroke-width:1.6}.syv .led.on{fill:var(--ok)}.syv .ledg{fill:none}.syv .ledg.on{fill:var(--ok);opacity:.3}
.syv .scr{fill:#0d1a12;stroke:var(--line)}.syv .grd{stroke:#2a4a35;stroke-width:.7}.syv .trc{fill:none;stroke:#5dff8f;stroke-width:2.2;stroke-linejoin:round}.syv .beam{fill:none;stroke:#e6ffe9;stroke-width:4;stroke-linecap:round;stroke-dasharray:3 97;display:none}.syv .stx{fill:#bfffd2;font-size:12.5px}
.syv .ax{stroke:var(--mute);stroke-width:1.2}.syv .rs1{fill:none;stroke:var(--mute);stroke-width:1.6;stroke-dasharray:4 3}.syv .rs2{fill:none;stroke:var(--accent);stroke-width:2.6}.syv .lim{stroke:var(--hi);stroke-width:1.4;stroke-dasharray:5 4}.syv .dim{stroke:var(--fg);stroke-width:1.4;fill:none}
.syv .cmp{fill:var(--panel);stroke:var(--fg);stroke-width:1.7}.syv .ray{stroke:var(--hi);stroke-width:2}
.syv .nd{fill:var(--accent)}.syv .heat{fill:none;stroke:var(--hi);stroke-width:5;stroke-dasharray:3 14;stroke-linecap:round}
.syv .hous{fill:var(--panel2);stroke:var(--fg);stroke-width:2.5}.syv .hous.sk2{stroke-dasharray:8 4}
.syv .cable{fill:none;stroke:var(--mute);stroke-width:6;stroke-linecap:round}.syv .cable.p{stroke:var(--danger);stroke-width:3;opacity:.55}.syv .hdl{stroke:var(--danger);stroke-width:8;stroke-linecap:round}
.syv .k1{fill:var(--accent);fill-opacity:.35;stroke:var(--accent)}.syv .k2{fill:var(--ok);fill-opacity:.3;stroke:var(--ok)}.syv .k3{fill:var(--hi);fill-opacity:.35;stroke:var(--hi)}
.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:560px;margin:8px auto}.vzbox.full{max-width:none}
@media(prefers-reduced-motion:no-preference){
.syv .flow.on{animation:syaFlow 1s linear infinite}.syv .flow.stot{animation:syaFlow 1s linear infinite,syaStot 1.4s steps(2) infinite}
@keyframes syaFlow{to{stroke-dashoffset:-32}}@keyframes syaStot{50%{opacity:.15}}
.syv .fan.on{animation:syaFan .8s linear infinite}@keyframes syaFan{to{transform:rotate(360deg)}}
.syv .ndl{animation:syaSwing .9s cubic-bezier(.3,1.6,.5,1)}@keyframes syaSwing{from{transform:rotate(-60deg)}}
.syv .ndl.jit{animation:syaJit 1.6s ease-in-out infinite}@keyframes syaJit{0%,100%{transform:rotate(-60deg)}50%{transform:rotate(-5deg)}}
.syv .kon.on{animation:syaKon .35s ease-out}@keyframes syaKon{from{transform:rotate(0deg)}}
.syv .lead,.syv .tip{animation:syaLead .45s ease-out}@keyframes syaLead{from{opacity:.25;stroke-width:9}}
.syv .ledg.on{animation:syaGlow 1.4s ease-in-out infinite}@keyframes syaGlow{50%{opacity:.6}}
.syv .blink{animation:syaStot 1.4s steps(2) infinite}
.syv .beam{display:inline;animation:syaBeam 1.6s linear infinite}@keyframes syaBeam{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.syv .heat{animation:syaFlow 1.2s linear infinite}
.syv .mp.on .tg{animation:syaPuls 1.2s ease-in-out infinite}@keyframes syaPuls{50%{stroke-width:5}}}`;

  const API = { SYM, BL, WI, MPPOS, flows, blockSvg, benchSvg, RANGES, rangeFor, needleDeg, meterSvg, scopeSvg, rippleSvg, drvSvg, ledSvg, thermSvg, pruefSvg, kvaSvg, taskImg, CSS };
  root.SYA_VIZ = API;
  if (typeof document !== 'undefined' && document.head && !document.getElementById('syaviz-css')) { try { const st = document.createElement('style'); st.id = 'syaviz-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {} }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
