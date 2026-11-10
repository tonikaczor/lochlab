'use strict';
/* Tonfunk Schaltschrank-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei sslviz.js, eingebunden NACH sslui.js.
   1) Montageplatte (überall, wo die Platte gezeichnet wird, also auch in Aufgaben und Beispielen): Bauteil-Symbole (Hebel, Spule, Klemmenschrauben ...),
      Schraubklemmen an den Kanten und ein Maßraster (1 TE = 18 mm, Linien alle 5 TE). Das ist reine Optik und sagt nichts über die Regeln.
   2) Nur im Reiter Schrank-Layout und nur ohne Prüfmodus: Ampel der Regelprüfung (grün: alle Regeln erfüllt, gelb: mindestens die Hälfte, rot: weniger) mit einer Lampe je Regel,
      Auslastung der Schienen gegen die 80-%-Marke, Wärmebild als Skizze (Glühen nach Verlustleistung, Wärme steigt auf) und Wärmebilanz gegen die Gehäusewand.
      Die Ampel nutzt dieselbe Prüfung wie die Regelliste darunter (checkLayout) und zeigt keine Einzelheiten.
   3) Reiter Verdrahtung: Skizze zum 24-V-Sensor (Klemmen, Aderfarben) und Aderendhülsen-Farben mit Leiterquerschnitt im Maßstab.
   In Aufgaben und Trainer erscheinen keine Regel-, Wärme- oder Lösungsangaben: Das Verdeckte-Fehler-Prinzip bleibt gewahrt (dort nur die Optik aus 1).
   Alle Zahlen sind ÜBUNGSWERTE. Theme über CSS-Variablen (Aderfarben sind Fachinhalt und deshalb feste Farben); Bewegung gibt es nicht.
   window.SSL_VIZ bzw. module.exports: reine Funktionen, die SVG-Text liefern (für Tests). */
(function (root) {
  const C = root.SSL_CORE || (typeof require !== 'undefined' ? require('./sslcore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const P = s => (C ? C.parseDe(s) : NaN);
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const fl = (col, op) => `fill="var(--${col})"${op != null ? ` fill-opacity="${op}"` : ''}`;
  const svg = (w, h, label, body, defs) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${num(x)}" y="${num(y)}"${extra || ''}>${esc(t)}</text>`;
  const msg = (t, w) => svg(w || 480, 44, 'Hinweis', T((w || 480) / 2, 26, t, 'vz-s m', ' text-anchor="middle"'));

  /* Geometrie der Platte: wie in sslui.js (TEP, ML, RHT, PITCH, TOP); wird beim Zeichnen gegen die viewBox geprüft */
  const TEP = 34, ML = 44, RHT = 56, PITCH = 100, TOP = 20;
  const dims = () => ({ BW: ML + C.RAIL_TE * TEP + 8, BH: TOP + (C.RAILS - 1) * PITCH + RHT + 44 });
  const railY = r => TOP + r * PITCH;

  /* ============================================================ 1) Bauteil-Symbole und Maßraster auf der Platte */
  const ST = 'fill="none" stroke="var(--fg)" stroke-width="1.3" stroke-opacity=".85" stroke-linecap="round" stroke-linejoin="round"';
  /* Symbol unten in der Bauteilfläche: x, y obere linke Ecke der Fläche, w Breite, h Höhe (Platzhalter 52) */
  function symbol(id, x, y, w, h) {
    const p = C.part(id); if (!p) return '';
    const cx = x + w / 2, by = y + h - 13, k = p.w, g = [];
    const lever = (lx, ly) => `<rect x="${num(lx - 4)}" y="${num(ly)}" width="8" height="9" rx="2" ${ST}/>`;
    switch (id) {
      case 'hs': g.push(`<circle cx="${cx}" cy="${by + 5}" r="5" ${ST}/><path d="M${cx} ${by + 5}l3 -4" ${ST}/>`); break;
      case 'fi': g.push(lever(cx - 8, by) + `<circle cx="${cx + 9}" cy="${by + 5}" r="3.5" ${ST}/><path d="M${cx + 9} ${by + 3.5}v3" ${ST}/>`); break;
      case 'ls3': case 'ls1': for (let i = 0; i < k; i++) g.push(lever(x + (i + .5) * (w + 2) / k, by)); break;
      case 'sk': g.push(`<rect x="${cx - 9}" y="${by + 1}" width="18" height="8" rx="1.5" ${ST}/><path d="M${cx - 9} ${by + 9}l18 -8" ${ST}/>`); break;
      case 'rel': g.push(`<rect x="${cx - 6}" y="${by + 1}" width="12" height="8" rx="1.5" ${ST}/><path d="M${cx - 6} ${by + 9}l12 -8" ${ST}/>`); break;
      case 'nt': g.push(`<path d="M${cx - 18} ${by + 5}q4.5 -7 9 0t9 0" ${ST}/><path d="M${cx + 6} ${by + 3}h12M${cx + 6} ${by + 8}h12" ${ST}/>`); break;
      case 'fu': g.push(`<path d="M${cx - 20} ${by + 5}q4 -7 8 0t8 0" ${ST}/><path d="M${cx + 6} ${by + 5}h10m-4 -4l4 4 -4 4" ${ST}/>`); break;
      case 'klL': case 'klS': for (let i = 0; i < k; i++) g.push(`<circle cx="${num(x + (i + .5) * (w + 2) / k)}" cy="${by + 5}" r="3.6" ${ST}/><path d="M${num(x + (i + .5) * (w + 2) / k - 2.2)} ${by + 5}h4.4" ${ST}/>`); break;
      case 'sps': for (let i = 0; i < 3; i++) g.push(`<circle cx="${cx - 40 + i * 9}" cy="${by + 5}" r="2.5" ${fl('ok', .9)}/>`); g.push(`<rect x="${cx + 4}" y="${by}" width="34" height="10" rx="2" ${ST}/>`); break;
      default: break;
    }
    return g.join('');
  }
  /* Schraubklemmen an der oberen und unteren Kante je TE und Lochbild */
  function terminals(x, y, w, h, k) {
    let s = '';
    for (let i = 0; i < k; i++) { const tx = x + (i + .5) * (w + 2) / k; s += `<rect x="${num(tx - 4.5)}" y="${num(y + 1.5)}" width="9" height="4.5" rx="1.5" fill="var(--fg)" fill-opacity=".35"/><rect x="${num(tx - 4.5)}" y="${num(y + h - 6)}" width="9" height="4.5" rx="1.5" fill="var(--fg)" fill-opacity=".35"/>`; }
    return s;
  }
  /* Maßraster: Lineal oben (1 TE = 18 mm) und senkrechte Linien alle 5 TE in jeder Schiene */
  function gridSvg() {
    const n = C.RAIL_TE; let s = '';
    s += T(3, 17, 'TE', 'vz-s m', ' style="font-size:10px"');
    for (let i = 0; i <= n; i++) {
      const x = ML + i * TEP, major = i % 5 === 0;
      s += `<line x1="${x}" x2="${x}" y1="${major ? 12 : 15}" y2="19" stroke="var(--mute)" stroke-width="${major ? 1.6 : 1}"/>`;
      if (major && i > 0) s += T(x, 10, i + ' TE · ' + f(i * C.TE_MM, 0) + ' mm', 'vz-s m', ' text-anchor="middle" style="font-size:9px"');
    }
    s += `<line x1="${ML}" x2="${ML + n * TEP}" y1="19" y2="19" stroke="var(--mute)" stroke-width="1.2"/>`;
    for (let r = 0; r < C.RAILS; r++) for (let i = 5; i < n; i += 5) { const x = ML + i * TEP; s += `<line x1="${x}" x2="${x}" y1="${railY(r) - 2}" y2="${railY(r) + RHT + 8}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 5"/>`; }
    return `<g class="vz-grid" pointer-events="none">${s}</g>`;
  }
  /* Teil-Dekor für ein Bauteil: id, Rechteck der Fläche */
  const partDecor = (id, x, y, w, h) => { const p = C.part(id); return p ? `<g class="vz-sym" pointer-events="none">${terminals(x, y, w, h, p.w)}${symbol(id, x, y, w, h)}</g>` : ''; };
  /* Platte komplett als SVG-Text (für Tests und die Wärmeskizze nicht nötig): nur Dekor je Bauteil */
  function decorAll(L) { return gridSvg() + L.items.filter(i => C.part(i.p)).map(i => partDecor(i.p, ML + i.x * TEP, railY(Math.max(0, Math.min(C.RAILS - 1, i.r))) + 4, C.part(i.p).w * TEP - 2, RHT - 4)).join(''); }
  /* im Browser: bestehende Platte (svg.sl-board) nachträglich schmücken */
  function decorateBoard(el) {
    const D = dims(), vb = (el.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (vb[2] !== D.BW || vb[3] !== D.BH) return;
    if (!el.querySelector(':scope > .vz-grid')) el.insertAdjacentHTML('afterbegin', gridSvg());
    el.querySelectorAll('g.sl-it').forEach(g => {
      if (g.querySelector(':scope > .vz-sym')) return;
      const title = g.querySelector('title'), name = title ? title.textContent.split(' · ')[0] : '', id = Object.keys(C.PARTS).find(k => C.PARTS[k].n === name), r = g.querySelector('rect');
      if (!id || !r) return;
      g.insertAdjacentHTML('beforeend', partDecor(id, +r.getAttribute('x'), +r.getAttribute('y'), +r.getAttribute('width'), +r.getAttribute('height')));
    });
  }

  /* ============================================================ 2) Ampel der Regelprüfung (nur Schrank-Layout) */
  const RSHORT = { pass: 'vollständig', fit: 'passt', haupt: 'Hauptschalter', trenn: 'getrennt', kanal: 'Trennsteg', warm: 'Wärme', stapel: 'Stapel', reserve: 'Reserve', beschr: 'Namen' };
  /* Ergebnis: grün alle erfüllt, gelb mindestens die Hälfte, sonst rot */
  const ampelOf = (ok, total) => (total > 0 && ok === total ? 'ok' : total > 0 && ok * 2 >= total ? 'warn' : 'danger');
  function ampel(L, need, rules) {
    if (!C || !L || !Array.isArray(L.items)) return msg('Noch kein Layout.');
    const chk = C.checkLayout(L, need, rules), tot = chk.rules.length, ok = chk.rules.filter(r => r.ok).length, lamp = ampelOf(ok, tot), W = 480;
    let s = `<rect x="14" y="14" width="46" height="116" rx="10" ${fl('panel')} stroke="var(--mute)" stroke-width="2"/>`;
    [['danger', 36], ['warn', 72], ['ok', 108]].forEach(q => { const on = q[0] === lamp; s += `<circle cx="37" cy="${q[1]}" r="14" ${fl(q[0], on ? .95 : .14)} stroke="var(--${q[0]})" stroke-width="${on ? 3 : 1}"/>`; });
    s += T(74, 38, ok + ' von ' + tot + ' Regeln erfüllt', 'vz-t b', ' style="font-size:17px"');
    s += T(74, 58, lamp === 'ok' ? 'grün: alle Regeln erfüllt' : lamp === 'warn' ? 'gelb: mindestens die Hälfte erfüllt' : 'rot: weniger als die Hälfte erfüllt', 'vz-s', ` style="fill:var(--${lamp})"`);
    const cw = 130, x0 = 74;
    chk.rules.forEach((r, i) => {
      const col = i % 3, row = Math.floor(i / 3), x = x0 + col * cw, y = 76 + row * 26;
      s += `<circle cx="${x + 9}" cy="${y}" r="9" ${fl(r.ok ? 'ok' : 'danger', .9)}/>` + T(x + 9, y + 4.5, r.ok ? '✓' : '✗', 'vz-s b', ' text-anchor="middle" style="fill:var(--bg);font-size:12px"') + T(x + 24, y + 4, RSHORT[r.k] || r.k, 'vz-s', ' style="font-size:11.5px"');
    });
    const H = Math.max(140, 76 + Math.ceil(tot / 3) * 26 + 6);
    return svg(W, H, 'Ampel der Regelprüfung: ' + ok + ' von ' + tot + ' Regeln erfüllt', s);
  }
  /* Schienen: belegte TE gegen 20 TE und die 80-%-Marke */
  function railBars(L) {
    if (!C || !L || !Array.isArray(L.items)) return '';
    const W = 480, bx = 76, bw = 270, max = C.RAIL_TE; let s = T(14, 16, 'Belegung der Schienen', 'vz-t b');
    for (let r = 0; r < C.RAILS; r++) {
      const u = C.railUsed(L, r), y = 30 + r * 34, z = C.zonesOf(L, r), over = u > C.MAX_TE;
      s += T(14, y + 15, 'Schiene ' + (r + 1), 'vz-s') + `<rect x="${bx}" y="${y}" width="${bw}" height="22" rx="5" ${fl('panel')} stroke="var(--line)"/>`;
      s += `<rect x="${bx}" y="${y}" width="${num(Math.min(u, max) / max * bw)}" height="22" rx="5" ${fl(over ? 'danger' : 'ok', .65)}/>`;
      s += `<line x1="${num(bx + C.MAX_TE / max * bw)}" x2="${num(bx + C.MAX_TE / max * bw)}" y1="${y - 3}" y2="${y + 25}" stroke="var(--fg)" stroke-width="2" stroke-dasharray="3 3"/>`;
      s += T(bx + bw + 10, y + 15, u + '/' + max + ' TE' + (z.length ? ' · ' + (z.length > 1 ? 'gemischt' : z[0] === 'L' ? 'Leistung' : 'Steuerung') : ''), 'vz-s', ' style="font-size:11.5px"');
    }
    s += T(bx + C.MAX_TE / max * bw, 30 + 3 * 34 + 8, '80 %', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    return svg(W, 30 + 3 * 34 + 16, 'Balken: belegte Teilungseinheiten je Schiene mit der 80-Prozent-Marke', s);
  }

  /* ============================================================ Wärmebild als Skizze */
  const HZ = { x0: 22, y0: 22, te: 21.5, rh: 40, pitch: 64 };
  function heatPicture(L) {
    if (!C || !L || !Array.isArray(L.items)) return msg('Noch kein Layout.');
    const W = 480, H = 22 + C.RAILS * HZ.pitch + 94, items = L.items.filter(i => C.part(i.p) && Number.isInteger(i.r) && i.r >= 0 && i.r < C.RAILS && Number.isInteger(i.x) && i.x >= 0 && i.x + C.part(i.p).w <= C.RAIL_TE);
    const gid = c => 'vzh' + c, defs = [['c', 'accent'], ['w', 'warn'], ['h', 'danger']].map(q => `<radialGradient id="${gid(q[0])}"><stop offset="0" style="stop-color:var(--${q[1]})" stop-opacity=".95"/><stop offset="1" style="stop-color:var(--${q[1]})" stop-opacity="0"/></radialGradient>`).join('') + `<linearGradient id="vzhl"><stop offset="0" style="stop-color:var(--accent)"/><stop offset=".5" style="stop-color:var(--warn)"/><stop offset="1" style="stop-color:var(--danger)"/></linearGradient><clipPath id="vzhclip"><rect x="${HZ.x0 - 8}" y="${HZ.y0 - 12}" width="${C.RAIL_TE * HZ.te + 16}" height="${C.RAILS * HZ.pitch}" rx="6"/></clipPath>`;
    let s = `<rect x="${HZ.x0 - 8}" y="${HZ.y0 - 12}" width="${C.RAIL_TE * HZ.te + 16}" height="${C.RAILS * HZ.pitch}" rx="6" ${fl('panel')} stroke="var(--mute)" stroke-width="1.5"/><g clip-path="url(#vzhclip)">`;
    for (let r = 0; r < C.RAILS; r++) s += `<rect x="${HZ.x0 - 8}" y="${HZ.y0 + r * HZ.pitch + HZ.rh + 6}" width="${C.RAIL_TE * HZ.te + 16}" height="4" ${fl('mute', .5)}/>`;
    /* Glühen: Radius und Deckkraft wachsen mit der Verlustleistung */
    items.forEach(i => { const p = C.part(i.p), cx = HZ.x0 + (i.x + p.w / 2) * HZ.te, cy = HZ.y0 + i.r * HZ.pitch + HZ.rh / 2, g = p.pv >= 20 ? 'h' : p.pv >= C.HEAT_MIN ? 'w' : 'c', rad = 22 + p.pv * 3.4; s += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(rad)}" fill="url(#${gid(g)})" opacity="${num(Math.min(1, .4 + p.pv / 18))}"/>`; });
    s += '</g>';
    items.forEach(i => {
      const p = C.part(i.p), x = HZ.x0 + i.x * HZ.te, y = HZ.y0 + i.r * HZ.pitch, w = p.w * HZ.te - 1.5;
      s += `<rect x="${num(x)}" y="${y}" width="${num(w)}" height="${HZ.rh}" rx="4" ${fl('panel', .55)} stroke="var(--fg)" stroke-opacity=".8" stroke-width="1.3"${p.sens ? ' stroke-dasharray="4 3"' : ''}/>`;
      s += T(x + w / 2, y + HZ.rh / 2 + 4, p.k, 'vz-s b', ' text-anchor="middle" style="font-size:11px"');
      if (p.heat) for (let a = 0; a < 2; a++) { const ax = x + w * (a + 1) / 3; s += `<path d="M${num(ax)} ${y - 3}v-11m-3.5 4l3.5 -4 3.5 4" fill="none" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>`; }
    });
    if (!items.length) s += T(W / 2, HZ.y0 + 70, 'Baue Bauteile ein, dann siehst du hier ihre Wärme.', 'vz-s m', ' text-anchor="middle"');
    const ly = HZ.y0 + C.RAILS * HZ.pitch + 2;
    s += `<rect x="${HZ.x0}" y="${ly + 4}" width="260" height="10" rx="5" fill="url(#vzhl)"/>`;
    s += T(HZ.x0, ly + 30, 'wenig Wärme', 'vz-s m', ' style="font-size:11px"') + T(HZ.x0 + 260, ly + 30, 'viel Wärme', 'vz-s m', ' text-anchor="end" style="font-size:11px"');
    s += T(HZ.x0, ly + 52, '▲ Pfeil: Wärmequelle ab ' + C.HEAT_MIN + ' W (Wärme steigt auf)', 'vz-s', ' style="font-size:11.5px"') + T(HZ.x0, ly + 70, 'Gestrichelt: wärmeempfindlich (SPS, Relais)', 'vz-s', ' style="font-size:11.5px"');
    return svg(W, H, 'Wärmebild als Skizze: Glühen nach Verlustleistung der eingebauten Bauteile, Wärmequellen mit Pfeil nach oben', s, defs);
  }
  /* Wärmebilanz: Verlust, Abfuhr durch die Wand, Rest für Lüfter oder Kühlgerät */
  function heatBalance(Pv, A, To, Ti) {
    const W = 480;
    if (!(fin(Pv) && Pv >= 0) || !(A > 0) || !fin(To) || !fin(Ti)) return msg('Gib Oberfläche und Temperaturen als Zahlen ein.');
    if (Ti <= To) return msg('Die Innentemperatur muss höher sein als die Außentemperatur.');
    const dT = Ti - To, wall = C.wallHeat(A, dT), need = C.coolNeed(Pv, A, dT), mx = Math.max(Pv, wall, 1) * 1.08, bx = 14, bw = 300, sx = v => v / mx * bw;
    const row = (y, lab, v, col, sub) => `${T(bx, y, lab, 'vz-s b')}<rect x="${bx}" y="${y + 6}" width="${bw}" height="18" rx="4" ${fl('panel')} stroke="var(--line)"/><rect x="${bx}" y="${y + 6}" width="${num(Math.max(0, sx(v)))}" height="18" rx="4" ${fl(col, .7)}/>${T(bx + bw + 10, y + 20, f(v, 1) + ' W', 'vz-s b')}${sub ? T(bx + bw + 10, y + 34, sub, 'vz-s m', ' style="font-size:10.5px"') : ''}`;
    let s = T(14, 16, 'Wärmebilanz bei ' + f(dT, 0) + ' K Temperaturunterschied', 'vz-t b');
    s += row(40, 'Verlustleistung der Bauteile', Pv, 'hi') + row(84, 'Abfuhr durch die Gehäusewand', wall, 'accent') + row(128, need > 0 ? 'Zusätzlich abzuführen' : 'Zusätzlich abzuführen: nichts', need, need > 0 ? 'danger' : 'ok', need > 0 ? 'Lüfter oder Kühlgerät' : '');
    return svg(W, 176, 'Balken: Verlustleistung, Wärmeabfuhr durch die Wand und zusätzlich abzuführende Leistung', s);
  }

  /* ============================================================ 3) Verdrahtung: Skizzen */
  /* Aderfarben sind Fachinhalt (wie COLCSS in sslui.js) und deshalb feste Farben, mit Rand in Textfarbe */
  const WIRE = { braun: '#8a5a2b', schwarz: '#202428', grau: '#9aa1a8', blau: '#1f6feb', hellblau: '#6cc6ff', rot: '#d83b3b', orange: '#ff8a1c', 'weiß': '#f4f4f4', gelb: '#f2d21b', 'grün-gelb': '#8fb83a' };
  const wcol = n => WIRE[n] || 'var(--mute)';
  function sensorSketch() {
    const W = 480, order = ['braun', 'blau', 'schwarz'], names = C.SENSOR_COL; let s = '';
    /* Netzteil, Klemmenleiste X2, Sensor, Eingang */
    const fn = c => names[c] || '';
    s += `<rect x="12" y="22" width="92" height="112" rx="8" ${fl('panel')} stroke="var(--mute)" stroke-width="2"/>` + T(58, 42, 'Netzteil', 'vz-s b', ' text-anchor="middle"') + T(58, 58, '24 V DC', 'vz-s m', ' text-anchor="middle"');
    s += `<rect x="188" y="22" width="86" height="112" rx="8" ${fl('hi', .12)} stroke="var(--hi)" stroke-width="2"/>` + T(231, 42, 'Klemmen X2', 'vz-s b', ' text-anchor="middle"');
    s += `<rect x="372" y="22" width="96" height="112" rx="8" ${fl('panel')} stroke="var(--mute)" stroke-width="2"/>` + T(420, 44, 'Sensor', 'vz-s b', ' text-anchor="middle"') + T(420, 60, '3 Leiter', 'vz-s m', ' text-anchor="middle"') + T(420, 76, 'PNP', 'vz-s m', ' text-anchor="middle"');
    s += `<rect x="188" y="150" width="86" height="32" rx="8" ${fl('panel')} stroke="var(--mute)" stroke-width="2"/>` + T(231, 170, 'SPS-Eingang', 'vz-s b', ' text-anchor="middle"');
    order.forEach((c, i) => {
      const y = 70 + i * 22, fnx = fn(c);
      const src = /\+24/.test(fnx) ? 'p' : /0 V/.test(fnx) ? 'm' : 's';
      if (src !== 's') s += `<path d="M104 ${src === 'p' ? 70 : 92}H188" fill="none" stroke="var(--fg)" stroke-width="5" stroke-linecap="round" stroke-opacity=".5"/><path d="M104 ${src === 'p' ? 70 : 92}H188" fill="none" stroke="${wcol(c === 'braun' ? 'rot' : 'blau')}" stroke-width="3" stroke-linecap="round"/>`;
      s += `<path d="M274 ${y}H372" fill="none" stroke="var(--fg)" stroke-width="6" stroke-linecap="round" stroke-opacity=".55"/><path d="M274 ${y}H372" fill="none" stroke="${wcol(c)}" stroke-width="4" stroke-linecap="round"/>`;
      s += `<circle cx="188" cy="${y}" r="5" ${fl('fg', .6)}/><circle cx="274" cy="${y}" r="5" ${fl('fg', .6)}/>` + T(194, y + 4, fnx, 'vz-s', ' style="font-size:11px"') + T(323, y - 5, c, 'vz-s m', ' text-anchor="middle" style="font-size:10.5px;paint-order:stroke;stroke:var(--panel2);stroke-width:3px"');
    });
    s += `<path d="M231 134V150" fill="none" stroke="var(--mute)" stroke-width="2.5" stroke-dasharray="4 3"/>` + T(146, 64, '+24 V', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"') + T(146, 86, '0 V', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    s += T(W / 2, 202, 'Versorgung und Signal laufen über die Steuerklemmen X2, getrennt von den Leistungsklemmen X1.', 'vz-s m', ' text-anchor="middle" style="font-size:11px"');
    return svg(W, 212, 'Skizze: 24-V-Netzteil, Klemmenleiste X2, Dreileiter-Sensor und SPS-Eingang mit den Aderfarben', s);
  }
  function ferruleSketch() {
    const keys = Object.keys(C.FERRULE).map(Number).sort((a, b) => a - b), W = 480, cw = W / keys.length; let s = '';
    keys.forEach((q, i) => {
      const cx = cw * (i + .5), col = C.FERRULE[q];
      s += `<rect x="${num(cx - 8)}" y="22" width="16" height="44" rx="3" fill="${wcol(col)}" stroke="var(--fg)" stroke-width="1.3"/><rect x="${num(cx - 4.5)}" y="66" width="9" height="20" rx="1.5" fill="var(--fg)" fill-opacity=".45" stroke="var(--fg)" stroke-width="1"/>`;
      const r = Math.sqrt(q / Math.PI) * 5;
      s += `<circle cx="${num(cx)}" cy="116" r="${num(r)}" fill="var(--hi)" fill-opacity=".6" stroke="var(--hi)" stroke-width="1.2"/>`;
      s += T(cx, 150, f(q, 2) + ' mm²', 'vz-s b', ' text-anchor="middle" style="font-size:11px"') + T(cx, 166, col, 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    });
    s += T(14, 14, 'Hülse (Kragen mit Farbe, Metallteil)', 'vz-s m', ' style="font-size:10.5px"') + T(14, 100, 'Kreis: Leiterquerschnitt im Flächenmaßstab', 'vz-s m', ' style="font-size:10.5px"');
    return svg(W, 178, 'Skizze: Aderendhülsen mit Farbcode und Leiterquerschnitt im Maßstab', s);
  }

  /* ============================================================ Einbindung in die Seite */
  const CSS = '.vz-card{margin-bottom:10px}.vz-card .vz-svg{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0}' +
    '.vz-svg svg{display:block;width:100%;height:auto;touch-action:manipulation}.vz-svg text{font-family:system-ui,sans-serif;fill:var(--fg);-webkit-user-select:none;user-select:none}' +
    '.vz-t{font-size:13.5px}.vz-s{font-size:12px}.vz-svg .m{fill:var(--mute)}.vz-svg .b{font-weight:700}.vz-grid text{fill:var(--mute);font-family:system-ui,sans-serif}.vz-sym,.vz-grid{pointer-events:none}';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.ssl.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const card = (t, body) => `<div class="card pl vz-card"><h4>${esc(t)}</h4><div class="vz-svg">${body}</div></div>`;
  const examOn = () => lsGet('exam', '0') === '1';
  function layState() {
    const l = Object.assign({ sc: 'b', Ls: {}, A: '1,6', To: '25', Ti: '35' }, lsGet('lay', {})), sc = root.SSL_DATA && root.SSL_DATA.scenarios && root.SSL_DATA.scenarios[l.sc];
    const raw = l.Ls && l.Ls[l.sc], L = raw && Array.isArray(raw.items) ? { items: raw.items.filter(i => i && C.part(i.p) && Number.isInteger(i.r) && Number.isInteger(i.x)).map(i => ({ p: i.p, r: i.r, x: i.x, lab: !!i.lab })), sep: Array.isArray(raw.sep) ? [!!raw.sep[0], !!raw.sep[1]] : [false, false] } : C.emptyLayout();
    return { l, L, need: sc ? sc.need.slice() : [], rules: sc ? sc.rules.slice() : C.RULE_ORDER.filter(k => k !== 'pass') };
  }
  const VIEWS = [
    { id: 'amp', view: '#layView', anchor: v => { const e = v.querySelector('#edP'); return e && e.closest('.card'); }, mode: 'after', html() { const s = layState(); return card('Regelprüfung als Ampel', ampel(s.L, s.need, s.rules) + railBars(s.L)); } },
    { id: 'heat', view: '#layView', anchor: v => { const e = v.querySelector('#heatOut'); return e && e.closest('.card'); }, mode: 'after', html() { const s = layState(); return card('Wärmebild als Skizze', heatPicture(s.L) + heatBalance(C.pvSum(s.L), P(s.l.A), P(s.l.To), P(s.l.Ti))); } },
    { id: 'ver', view: '#verView', anchor: v => v.querySelector('.card'), mode: 'after', html() { const w = lsGet('ver', { view: 'x1' }).view; return w === 'sensor' ? card('Skizze: Sensor am 24-V-Netzteil', sensorSketch()) : w === 'huelse' ? card('Skizze: Aderendhülsen', ferruleSketch()) : ''; } }
  ];
  const EXAM_FREE = ['ver'];
  function paint(d) {
    const view = document.querySelector(d.view); if (!view) return;
    let box = view.querySelector('.vz-box[data-vz="' + d.id + '"]');
    if (examOn() && EXAM_FREE.indexOf(d.id) < 0) { if (box) box.remove(); return; }
    const a = d.anchor(view); if (!a) return;
    if (!box) { box = document.createElement('div'); box.className = 'vz-box'; box.setAttribute('data-vz', d.id); a.parentNode.insertBefore(box, a.nextSibling); }
    let html = ''; try { html = d.html(); } catch (e) { html = ''; }
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
  }
  function boot() {
    if (!C || typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const mid = document.querySelector('#mid'); if (!mid) return;
    let busy = false;
    const run = () => { if (busy) return; busy = true; try { mid.querySelectorAll('svg.sl-board').forEach(decorateBoard); VIEWS.forEach(paint); } catch (e) { /* Optik darf nie die Seite stören */ } busy = false; };
    new MutationObserver(run).observe(mid, { childList: true, subtree: true });
    ['input', 'change', 'click', 'pointerup', 'keyup'].forEach(ev => mid.addEventListener(ev, () => setTimeout(run, 0)));
    run();
  }
  const API = { symbol, terminals, gridSvg, partDecor, decorAll, ampel, ampelOf, railBars, heatPicture, heatBalance, sensorSketch, ferruleSketch, RSHORT, TEP, ML, RHT, PITCH, TOP };
  root.SSL_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
