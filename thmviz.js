'use strict';
/* Tonfunk Thermik-Lab: Zusatzgrafiken (Lab-Kennung 'thm'), window.THM_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an thmui.js auskommt (liest nur window.THM_UI.S, nichts wird geschrieben):
   Karte "Wärmepfad und Bauform" im Reiter Prüfstand, direkt unter dem Prüfstandsbild:
   - Wärmepfad live: Chip (Sperrschicht) - Gehäuse - [Übergang] - Kühlkörper - Umgebung als senkrechte Kette. Jeder Knoten trägt seine Temperatur (Farbe UND Zahl), jede Strecke ihren
     Wärmewiderstand R_th (aus rig.state()) und den Temperaturabfall im Beharrungszustand P · R_th, dazu ein Balken, der zeigt, welche Strecke den größten Anteil trägt.
     Darunter eine Reservenleiste von T_a bis T_j,max mit der aktuellen und der Beharrungstemperatur (beim MOSFET aus der Rechnung des Prüfstands, sonst T_a + P · R_ges).
   - Bauform im Maßstab: Gehäuse (TO-220 mit Fahne, Loch und drei Anschlüssen; TO-126; axial DO-41; Zementwiderstand; Alu-Gehäuse; Power-LED auf Sternplatine) und Kühlkörper (Profilquerschnitt
     aus den Maßen b, n, L, t des Kerns; Selbstbaublech aus der Fläche) im SELBEN Maßstab nebeneinander, damit man sieht, wie groß ein Kühlkörper gegen das Bauteil ist. Bauteilmaße sind gerundete
     Größenvorstellungen ("ca."), keine Datenblattwerte; die Maße des Kühlkörpers stammen aus THM_CORE.heatsinks.
   - LED-Treiber mit Vorwiderstand: R_V mit Farbring in der Baugröße, die zur Verlustleistung passt (kleinste Nennleistung 0,25/0,5/1/2 W mit mindestens dem Doppelten der Verlustleistung).
   Aufgabenintegrität: Die Karte erscheint NICHT, solange eine Aufgabe läuft (S.task), der Montagezustand "wie geliefert" (verdeckter Fehler, paste/screw 'geliefert') gewählt ist,
   die Notfall-Attrappe läuft oder die Anzeige nicht lesbar ist. Es werden keine Fehlercodes gelesen oder gezeigt. Keine Animation, keine Bibliothek, Farben nur über Variablen (und hsl). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n1 = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  function fz(v, d) { if (!fin(v)) return '–'; return String(+v.toPrecision(d || 3)).replace('.', ',').replace('-', '−'); }
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ']];
  function eng(v, u) { if (!fin(v)) return '–'; if (v === 0) return '0 ' + u; const a = Math.abs(v); let p = PRE[PRE.length - 1]; for (const q of PRE) { if (a >= q[0] * 0.9995) { p = q; break; } } return fz(v / p[0], 4) + ' ' + p[1] + u; }
  const T = (x, y, s, o) => { o = o || {}; return `<text x="${n1(x)}" y="${n1(y)}" font-size="${o.size || 12}" fill="${o.fill || 'var(--fg)'}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>`; };
  function TW(x, y, str, maxc, o) {
    o = o || {}; const size = o.size || 12, lh = size + 3, words = String(str).split(' '), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > maxc) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) lines.push(cur);
    return { svg: lines.map((l, k) => T(x, y + k * lh, l, o)).join(''), h: lines.length * lh };
  }
  const L = (x1, y1, x2, y2, st, w, dash, extra) => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" stroke="${st}" stroke-width="${num(w || 1)}"${dash ? ` stroke-dasharray="${dash}"` : ''}${extra || ''}/>`;
  const R = (x, y, w, h, fill, st, rx, extra) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(Math.max(0, w))}" height="${n1(Math.max(0, h))}" fill="${fill}"${st ? ` stroke="${st}" stroke-width="1"` : ''}${rx ? ` rx="${rx}"` : ''}${extra || ''}/>`;
  const frame = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}" font-family="system-ui,sans-serif" class="tv-svg"><title>${esc(label)}</title>${body}</svg>`;
  function arrowDown(x, y1, y2, col, w) {
    const h = Math.max(7, w * 1.7), by = y2 - h;
    return L(x, y1, x, by, col, w) + `<polygon points="${n1(x)},${n1(y2)} ${n1(x - h * 0.6)},${n1(by)} ${n1(x + h * 0.6)},${n1(by)}" fill="${col}"/>`;
  }
  /* Temperaturfarbe: kalt blau bis heiß rot, bezogen auf T_a ... T_j,max (die Zahl steht immer daneben) */
  function heat(t, ta, tmax) {
    if (!fin(t) || !fin(ta) || !fin(tmax) || tmax <= ta) return { fill: 'hsl(210 60% 50%)', op: 0.18 };
    const f = clamp((t - ta) / (tmax - ta), 0, 1); return { fill: `hsl(${Math.round(210 - 210 * f)} 78% 50%)`, op: num(0.18 + 0.2 * f) };
  }
  const pw = p => (fin(p) && p > 0 ? clamp(2 + 2.2 * Math.log10(1 + p), 2, 9) : 2);

  /* ---------------------------------------------------------------- Wärmepfad */
  const JOINT = { direkt: 'direkt aufgesetzt', glimmer: 'Glimmerscheibe', silikon: 'Silikonfolie' }, PASTE = { keine: 'ohne Paste', duenn: 'dünne Paste', dick: 'dicke Paste' }, FAN = { aus: 'ohne Lüfter', leise: 'Lüfter leise', mittel: 'Lüfter mittel', stark: 'Lüfter stark' };
  /* Strecken und Knoten aus dem Zustand; Rückgabe null, wenn die Zahlen fehlen */
  function chain(st, core) {
    if (!st || !fin(st.rthJC) || !fin(st.rthTotal) || !fin(st.ta) || !fin(st.tj) || !fin(st.tc)) return null;
    const kk = st.mode === 'kk' && fin(st.rthCK) && fin(st.tk), P = fin(st.pv) ? st.pv : fin(st.pTotal) ? st.pTotal : NaN;
    const hs = core && core.heatsinks && core.heatsinks.byId && core.heatsinks.byId[st.heatsink];
    const nodes = [{ id: 'tj', name: 'Chip (Sperrschicht)', sym: 'T_j', t: st.tj }, { id: 'tc', name: 'Gehäuse', sym: 'T_c', t: st.tc }];
    const links = [{ r: st.rthJC, sym: 'R_thJC', text: 'Chip → Gehäuse (innerer Aufbau)' }];
    if (kk) {
      nodes.push({ id: 'tk', name: 'Kühlkörper', sym: 'T_k', t: st.tk });
      const j = JOINT[st.joint], pa = PASTE[st.paste];
      links.push({ r: st.rthCK, sym: 'R_thCK', text: 'Übergang Gehäuse → Kühlkörper' + (j || pa ? ' (' + [j, pa].filter(Boolean).join(', ') + ')' : '') });
      links.push({ r: Math.max(0, st.rthTotal - st.rthJC - st.rthCK), sym: 'R_thK', text: 'Kühlkörper → Luft' + (hs && hs.name ? ' (' + hs.name.replace(/ \(.*\)$/, '') + (FAN[st.fan] && st.fan !== 'aus' ? ', ' + FAN[st.fan] : '') + ')' : '') });
    } else links.push({ r: Math.max(0, st.rthTotal - st.rthJC), sym: 'R_thCA', text: 'Gehäuse → Luft (freistehend)' });
    nodes.push({ id: 'ta', name: 'Umgebung (Luft)', sym: 'T_a', t: st.ta });
    return { nodes, links, P, kk, total: st.rthTotal };
  }
  function chainSvg(st, core) {
    const c = chain(st, core); if (!c) return '';
    const W = 330, nh = 40, ta = st.ta, tmax = fin(st.tjMax) ? st.tjMax : NaN, P = c.P, sum = c.links.reduce((a, l) => a + l.r, 0) || 1;
    let g = T(0, 13, 'Wärmepfad vom Chip bis zur Luft' + (fin(P) ? ' · P = ' + eng(P, 'W') : ''), { size: 12.5, weight: 700 });
    let y = 22; const rows = [];
    c.nodes.forEach((nd, k) => {
      const h = heat(nd.t, ta, tmax), flag = nd.id === 'tj' && (st.destroyed ? 'zerstört' : st.shutdown ? 'abgeschaltet (Übertemperatur)' : '');
      g += R(0, y, W, nh, h.fill, 'var(--line)', 8, ` fill-opacity="${h.op}" data-tv="node"`) + R(0, y, 8, nh, h.fill, '', 4, ' data-tv="strip"');
      g += T(18, y + (flag ? 17 : 25), nd.name, { size: 13, weight: 700 });
      if (flag) g += T(18, y + 32, flag, { size: 11.5, weight: 700, fill: 'var(--danger)' });
      g += T(W - 10, y + 26, nd.sym + ' = ' + fz(nd.t, 4) + ' °C', { size: 15, weight: 700, anchor: 'end' });
      y += nh;
      if (k < c.links.length) {
        const l = c.links[k], dT = fin(P) ? P * l.r : NaN, share = l.r / sum, cy = y, tw = TW(46, cy + 32, l.text, 47, { size: 11.5, fill: 'var(--mute)' }), lh = 50 + (tw.h > 14.5 ? 14 : 0);
        g += arrowDown(24, cy + 4, cy + lh - 4, 'var(--warn)', pw(P));
        g += T(46, cy + 17, l.sym + ' = ' + fz(l.r, 4) + ' K/W', { size: 13, weight: 700 }) + T(W - 10, cy + 17, fin(dT) ? 'ΔT = ' + fz(dT, 3) + ' K' : '', { size: 12.5, anchor: 'end', fill: 'var(--warn)', weight: 700 });
        g += tw.svg;
        g += R(46, cy + lh - 12, W - 56, 6, 'var(--panel2)', '', 3) + R(46, cy + lh - 12, (W - 56) * clamp(share, 0, 1), 6, 'var(--accent)', '', 3, ' data-tv="share"');
        rows.push(l); y += lh;
      }
    });
    /* Reservenleiste T_a ... T_j,max */
    const steady = fin(st.tjSteady) ? st.tjSteady : fin(P) ? ta + P * c.total : NaN, owned = fin(st.tjSteady);
    const hi = Math.max(fin(tmax) ? tmax * 1.12 : 0, fin(steady) ? steady * 1.04 : 0, st.tj * 1.04, ta + 10), lo = ta, bx = 0, bw = W, X = t => bx + clamp((t - lo) / (hi - lo), 0, 1) * bw;
    y += 22; const by = y + 16;
    g += T(0, y, 'Temperaturreserve: T_a bis T_j,max', { size: 12.5, weight: 700 });
    g += R(bx, by, bw, 16, 'var(--panel2)', 'var(--line)', 4);
    if (fin(tmax)) { g += R(bx, by, X(tmax) - bx, 16, 'var(--ok)', '', 4, ' fill-opacity=".28"') + (X(tmax) < bw ? R(X(tmax), by, bw - X(tmax), 16, 'var(--danger)', '', 0, ' fill-opacity=".3"') : '') + L(X(tmax), by - 3, X(tmax), by + 19, 'var(--danger)', 2.2); }
    g += `<circle cx="${n1(X(st.tj))}" cy="${n1(by + 8)}" r="6.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5" data-tv="tj"/>`;
    if (fin(steady)) g += `<circle cx="${n1(X(steady))}" cy="${n1(by + 8)}" r="6" fill="none" stroke="var(--fg)" stroke-width="2" stroke-dasharray="3 2" data-tv="steady"/>`;
    g += T(bx, by + 34, 'T_a ' + fz(ta, 3) + ' °C', { size: 11.5, fill: 'var(--mute)' });
    if (fin(tmax)) g += T(clamp(X(tmax), 60, W - 4), by + 34, 'T_j,max ' + fz(tmax, 3) + ' °C', { size: 11.5, fill: 'var(--danger)', anchor: 'end' });
    let ty = by + 52; const notes = [];
    notes.push('● T_j jetzt ' + fz(st.tj, 4) + ' °C   ○ im Beharrungszustand ' + (fin(steady) ? '≈ ' + fz(steady, 4) + ' °C' : '–') + (owned || !fin(steady) ? '' : ' (T_a + P · R_ges)'));
    if (fin(steady) && fin(tmax)) notes.push(steady > tmax ? 'Im Beharrungszustand liegt T_j über T_j,max: Das Bauteil wird zu heiß.' : 'Reserve im Beharrungszustand: ' + fz(tmax - steady, 3) + ' K bis T_j,max.');
    notes.forEach((s, k) => { const w = TW(0, ty, s, 54, { size: 11.5, fill: k === 1 && steady > tmax ? 'var(--danger)' : 'var(--mute)', weight: k === 1 && steady > tmax ? 700 : 0 }); g += w.svg; ty += w.h + 3; });
    return frame(W, Math.round(ty + 4), g, 'Wärmepfad: ' + c.nodes.map(n => n.name + ' ' + fz(n.t, 4) + ' °C').join(', ') + '; ' + c.links.map(l => l.sym + ' ' + fz(l.r, 4) + ' K/W').join(', '));
  }

  /* ---------------------------------------------------------------- Bauform im Maßstab */
  /* Gehäuse: Breite/Höhe in mm (gerundete Größenvorstellung, "ca.") und Zeichner (Mittelpunkt unten x, Unterkante y, Maßstab s) */
  const PKG = {
    'TO-220': { name: 'TO-220', w: 10, h: 28.5, draw: (x, y, s, tabPin) => {
      const bw = 10 * s, tabH = 6.5 * s, bodyH = 9 * s, lead = 13 * s, x0 = x - bw / 2, ty = y - lead - bodyH - tabH;
      let g = R(x0, ty, bw, tabH, 'hsl(210 8% 62%)', 'var(--fg)', 2, ' data-tv="tab"') + `<circle cx="${n1(x)}" cy="${n1(ty + 3.2 * s)}" r="${n1(1.9 * s)}" fill="var(--bg)" stroke="var(--fg)" stroke-width="1"/>`;
      g += R(x0, ty + tabH, bw, bodyH, 'hsl(220 8% 16%)', 'var(--fg)', 2);
      [-2.54, 0, 2.54].forEach((d, k) => { g += R(x + d * s - 0.4 * s, y - lead, 0.8 * s, lead, k + 1 === tabPin ? 'hsl(43 80% 55%)' : 'hsl(210 8% 70%)', 'var(--fg)', 0, ' data-tv="lead"') + (s >= 4.3 ? T(x + d * s, y + 14, String(k + 1), { size: 11.5, anchor: 'middle', weight: k + 1 === tabPin ? 700 : 0 }) : ''); });
      return g;
    } },
    'TO-126': { name: 'TO-126', w: 8, h: 24, draw: (x, y, s, tabPin) => {
      const bw = 8 * s, tabH = 3.5 * s, bodyH = 7.5 * s, lead = 13 * s, x0 = x - bw / 2, ty = y - lead - bodyH - tabH;
      let g = R(x0, ty, bw, tabH, 'hsl(210 8% 62%)', 'var(--fg)', 2, ' data-tv="tab"') + `<circle cx="${n1(x)}" cy="${n1(ty + 1.9 * s)}" r="${n1(1.5 * s)}" fill="var(--bg)" stroke="var(--fg)" stroke-width="1"/>`;
      g += R(x0, ty + tabH, bw, bodyH, 'hsl(220 8% 16%)', 'var(--fg)', 2);
      [-2.28, 0, 2.28].forEach((d, k) => { g += R(x + d * s - 0.35 * s, y - lead, 0.7 * s, lead, k + 1 === tabPin ? 'hsl(43 80% 55%)' : 'hsl(210 8% 70%)', 'var(--fg)', 0, ' data-tv="lead"') + (s >= 4.3 ? T(x + d * s, y + 14, String(k + 1), { size: 11.5, anchor: 'middle', weight: k + 1 === tabPin ? 700 : 0 }) : ''); });
      return g;
    } },
    'DO-41': { name: 'DO-41 axial', w: 22, h: 3, draw: (x, y, s) => {
      const len = 5.2 * s, d = 2.7 * s, cy = y - d / 2;
      return L(x - 11 * s, cy, x + 11 * s, cy, 'hsl(210 8% 70%)', Math.max(1.5, 0.8 * s)) + R(x - len / 2, cy - d / 2, len, d, 'hsl(220 8% 16%)', 'var(--fg)', 2, ' data-tv="body"') + R(x + len * 0.28, cy - d / 2, len * 0.16, d, 'hsl(0 0% 80%)', '', 0);
    } },
    'Zement': { name: 'Zementwiderstand', w: 34, h: 9.5, draw: (x, y, s) => {
      const len = 22 * s, d = 9.5 * s, cy = y - d / 2;
      return L(x - 17 * s, cy, x + 17 * s, cy, 'hsl(210 8% 70%)', Math.max(1.5, 0.9 * s)) + R(x - len / 2, cy - d / 2, len, d, 'hsl(40 25% 78%)', 'var(--fg)', 2, ' data-tv="body"');
    } },
    'Alu': { name: 'Alu-Gehäuse', w: 50, h: 29, draw: (x, y, s) => {
      const w = 50 * s, h = 29 * s, x0 = x - w / 2;
      return R(x0, y - h, w, h, 'hsl(210 10% 72%)', 'var(--fg)', 3, ' data-tv="body"') + `<circle cx="${n1(x0 + 3.5 * s)}" cy="${n1(y - h / 2)}" r="${n1(1.4 * s)}" fill="var(--bg)" stroke="var(--fg)"/><circle cx="${n1(x0 + w - 3.5 * s)}" cy="${n1(y - h / 2)}" r="${n1(1.4 * s)}" fill="var(--bg)" stroke="var(--fg)"/>` + R(x0 + 8 * s, y - h + 5 * s, w - 16 * s, h - 10 * s, 'hsl(220 8% 20%)', '', 2);
    } },
    'LED': { name: 'Power-LED auf Sternplatine', w: 20, h: 20, draw: (x, y, s) => {
      const r = 10 * s, cy = y - r;
      return `<circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(r)}" fill="hsl(210 10% 72%)" stroke="var(--fg)" data-tv="body"/>` + `<circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(3.2 * s)}" fill="hsl(48 90% 78%)" stroke="var(--fg)"/>` + `<circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(1.4 * s)}" fill="hsl(48 95% 60%)"/>`;
    } }
  };
  /* Kühlkörper: Profilquerschnitt (Breite b, n Rippen der Höhe L und Dicke t), Blech (quadratisch aus der Fläche), Fahne */
  function sinkShape(st, core) {
    const id = st.heatsink; if (st.mode !== 'kk' || !id || id === 'none') return null;
    const hs = core && core.heatsinks && core.heatsinks.byId && core.heatsinks.byId[id];
    if (id === 'blech') { const A = fin(st.blechA) ? st.blechA : NaN; if (!fin(A) || A <= 0) return null; const side = Math.sqrt(A) * 10, d = fin(st.blechD) ? st.blechD : 2; return { kind: 'blech', w: side, h: side, d, name: 'Blech ' + fz(A, 3) + ' cm² (eine Seite)' }; }
    if (hs && hs.geom && fin(hs.geom.b) && fin(hs.geom.L) && fin(hs.geom.n) && fin(hs.geom.t)) { const g = hs.geom; return { kind: 'profil', w: g.b, h: g.L + 2 * g.t, g, name: hs.name }; }
    if (hs) return { kind: 'fahne', w: 0, h: 0, name: hs.name + (fin(hs.massG) ? ', ' + fz(hs.massG, 3) + ' g' : '') };
    return null;
  }
  function drawSink(sh, x, y, s) {
    if (sh.kind === 'profil') {
      const g = sh.g, b = g.b * s, t = Math.max(1.2, g.t * s), base = 2 * g.t * s, x0 = x - b / 2; let o = R(x0, y - base, b, base, 'hsl(210 10% 66%)', 'var(--fg)', 0, ' data-tv="sinkbase"');
      const gap = g.n > 1 ? (b - t) / (g.n - 1) : 0;
      for (let k = 0; k < g.n; k++) o += R(x0 + k * gap, y - base - g.L * s, t, g.L * s, 'hsl(210 10% 66%)', 'var(--fg)', 0, ' data-tv="fin"');
      return o;
    }
    if (sh.kind === 'blech') { const w = sh.w * s, d = Math.max(2, sh.d * s); return R(x - w / 2, y - w, w, w, 'hsl(210 10% 72%)', 'var(--fg)', 2, ' data-tv="blech"') + R(x - w / 2, y, w, d, 'hsl(210 10% 55%)', 'var(--fg)', 0); }
    return '';
  }
  function packageSvg(st, core) {
    if (!st) return '';
    const dev = core && core.devices && core.devices[st.deviceId || st.device], pkgId = dev && dev.pkg, P = PKG[pkgId]; if (!P) return '';
    const W = 330, sh = sinkShape(st, core), gap = 26;
    const wmm = P.w + (sh && sh.w ? sh.w : 0), hmm = Math.max(P.h, sh && sh.h ? sh.h : 0);
    const s = clamp(Math.min((W - 20 - (sh && sh.w ? gap : 0)) / wmm, 170 / hmm), 1.2, 14);
    const base = 22 + hmm * s + (sh && sh.kind === 'blech' ? 0 : 0), pw0 = P.w * s, cx1 = 10 + pw0 / 2;
    let g = T(0, 13, 'Bauform im Maßstab' + (sh ? ': Bauteil und Kühlkörper' : ''), { size: 12.5, weight: 700 });
    const tp = dev && dev.tab && fin(dev.tab.pin) && dev.tab.pin > 0 ? dev.tab.pin : 0;
    g += P.draw(cx1, base, s, tp);
    g += T(Math.max(cx1, 36), base + 30, P.name, { size: 12, weight: 700, anchor: 'middle' });
    const lines = [];
    if (tp && dev.tab.potText && (pkgId === 'TO-220' || pkgId === 'TO-126')) lines.push('Die Metallfahne ist mit Anschluss ' + tp + ' verbunden: liegt auf ' + dev.tab.potText + '.');
    if (sh) {
      if (sh.w) { const sx = 10 + pw0 + gap + sh.w * s / 2; g += drawSink(sh, sx, base, s); }
      else lines.push(sh.name + ' (keine Maße im Kern).');
      if (sh.w && sh.kind !== 'profil') lines.push(sh.name + '.');
      if (sh.kind === 'profil') lines.push('Profil: ' + fz(sh.g.b, 3) + ' mm breit, ' + fz(sh.g.n, 3) + ' Rippen à ' + fz(sh.g.L, 3) + ' mm' + (sh.g.l ? ', ' + fz(sh.g.l, 3) + ' mm lang' : '') + '.');
    }
    const sb = 10 * s, sy = base + 48;
    g += L(10, sy, 10 + sb, sy, 'var(--fg)', 2) + L(10, sy - 4, 10, sy + 4, 'var(--fg)', 2) + L(10 + sb, sy - 4, 10 + sb, sy + 4, 'var(--fg)', 2) + T(10 + sb + 8, sy + 4, '10 mm', { size: 11.5, fill: 'var(--mute)' });
    lines.push('Maße gerundet (ca.), nur zur Größenvorstellung.');
    let ty = sy + 22, rightX = 10 + pw0 + 22, ry = 38;
    /* freier Platz rechts neben dem Bauteil (ohne Kühlkörper) nimmt die Texte auf */
    if (!sh && W - rightX > 120 && base > 80) { lines.forEach(l => { const w = TW(rightX, ry, l, Math.floor((W - rightX) / 6.1), { size: 11.5, fill: 'var(--mute)' }); g += w.svg; ry += w.h + 6; }); ty = sy + 6; }
    else lines.forEach(l => { const w = TW(0, ty, l, 54, { size: 11.5, fill: 'var(--mute)' }); g += w.svg; ty += w.h + 3; });
    return frame(W, Math.round(ty + 2), g, 'Bauform im Maßstab: ' + P.name + (sh ? ' und ' + sh.name : ''));
  }

  /* ---------------------------------------------------------------- Widerstand mit Farbring (LED-Treiber mit Vorwiderstand) */
  const RING = [['schwarz', 'hsl(0 0% 9%)'], ['braun', 'hsl(24 62% 30%)'], ['rot', 'hsl(2 78% 47%)'], ['orange', 'hsl(28 95% 52%)'], ['gelb', 'hsl(52 95% 55%)'], ['grün', 'hsl(130 55% 36%)'], ['blau', 'hsl(220 72% 48%)'], ['violett', 'hsl(285 50% 46%)'], ['grau', 'hsl(0 0% 55%)'], ['weiß', 'hsl(0 0% 96%)']];
  const GOLD = ['gold', 'hsl(43 72% 50%)'], SILVER = ['silber', 'hsl(0 0% 76%)'];
  function bands(Rv) {
    if (!fin(Rv) || Rv <= 0) return null;
    const e = Math.floor(Math.log10(Rv) + 1e-12);
    const tryN = nd => { const mult = e - (nd - 1), dig = Math.round(Rv / Math.pow(10, mult)); if (Math.abs(dig * Math.pow(10, mult) - Rv) > Rv * 1e-9 || dig < Math.pow(10, nd - 1) || dig >= Math.pow(10, nd)) return null; if (mult < -2 || mult > 9) return null; const ds = String(dig).split('').map(Number), mc = mult === -1 ? GOLD : mult === -2 ? SILVER : RING[mult]; return { n: nd + 2, rings: ds.map(d => RING[d]).concat([mc, nd === 2 ? GOLD : RING[1]]) }; };
    return tryN(2) || tryN(3);
  }
  const RATINGS = [{ w: 0.25, l: 6.3, d: 2.5 }, { w: 0.5, l: 9, d: 3.3 }, { w: 1, l: 11.5, d: 4.5 }, { w: 2, l: 15.5, d: 5.5 }];
  const ratingTxt = w => (w === 0.25 ? '0,25 W' : w === 0.5 ? '0,5 W' : w + ' W');
  function ratingFor(p) { if (!fin(p) || p < 0) return RATINGS[0]; for (const r of RATINGS) if (r.w >= 2 * p - 1e-12) return r; return null; }
  function resistor(cx, cy, rt, val, s) {
    const b = bands(val), len = rt.l * s, d = rt.d * s, x0 = cx - len / 2, fifth = b && b.n === 5;
    let g = L(x0 - 9, cy, x0, cy, 'var(--mute)', 2.2) + L(x0 + len, cy, x0 + len + 9, cy, 'var(--mute)', 2.2) + R(x0, cy - d / 2, len, d, fifth ? 'hsl(200 38% 66%)' : 'hsl(38 48% 72%)', 'hsl(30 20% 35%)', Math.min(d / 2, 5), ' data-tv="res"');
    if (b) { const pos = fifth ? [0.12, 0.23, 0.34, 0.45, 0.8] : [0.15, 0.29, 0.43, 0.8], bw = Math.max(2.4, len * 0.065); b.rings.forEach((r, k) => { g += R(x0 + len * pos[k] - bw / 2, cy - d / 2 + 0.6, bw, d - 1.2, r[1], 'hsl(0 0% 20%)', 0, ' data-tv="ring"'); }); }
    return { svg: g, b };
  }
  function ledResistorSvg(st) {
    if (!st || st.device !== 'led' || st.driver !== 'vorwiderstand' || !fin(st.rv) || st.rv <= 0 || !fin(st.pTreiber)) return '';
    const W = 330, rt = ratingFor(st.pTreiber), draw = rt || RATINGS[RATINGS.length - 1], s = 12, cy = 26 + draw.d * s / 2, r = resistor(100, cy, draw, st.rv, s);
    let g = T(0, 13, 'Vorwiderstand der LED-Kette in der passenden Baugröße', { size: 12.5, weight: 700 }) + r.svg + T(215, cy, eng(st.rv, 'Ω'), { size: 14, weight: 700 });
    const ry = cy + draw.d * s / 2 + 16; g += T(0, ry, 'Ringe: ' + (r.b ? r.b.rings.map(x => x[0]).join('–') : 'kein Normfarbring'), { size: 11.5, fill: 'var(--mute)' });
    const tx = TW(0, ry + 20, 'P_R = ' + eng(st.pTreiber, 'W') + ' → ' + (rt ? 'mindestens ' + ratingTxt(rt.w) + ' (Faustregel: Nennleistung ≥ 2 · P_R)' : 'über 2 W: Leistungswiderstand mit Kühlfläche nötig'), 54, { size: 12, fill: rt ? 'var(--fg)' : 'var(--danger)' }); g += tx.svg;
    return frame(W, Math.round(ry + 20 + tx.h + 4), g, 'Vorwiderstand ' + eng(st.rv, 'Ω') + ', Verlustleistung ' + eng(st.pTreiber, 'W'));
  }

  /* ---------------------------------------------------------------- Zusammenbau */
  function build(rigId, st, core) {
    const out = []; if (!st || rigId === 'vergleich') return out;
    const add = (id, html) => { if (html) out.push({ id, html }); };
    add('pfad', chainSvg(st, core)); add('bau', packageSvg(st, core)); if (rigId === 'bauteil') add('rv', ledResistorSvg(st));
    return out;
  }
  const allHtml = (rigId, st, core) => build(rigId, st, core).map(x => `<div class="tv-blk" data-tv-blk="${x.id}">${x.html}</div>`).join('');
  const CSS = `
.thmviz{margin:0 0 10px}
.thmviz>summary{min-height:44px}
.thmviz .tv-blk{border-top:1px solid var(--line);padding:8px 0 4px}.thmviz .tv-blk:first-of-type{border-top:0;padding-top:0}
.thmviz .tv-svg{display:block;width:100%;max-width:440px;height:auto;margin:0 auto}
@media(min-width:760px){.thmviz [data-tv-body]{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:4px 18px;align-items:start}.thmviz .tv-blk,.thmviz .tv-blk:first-of-type{border-top:0;padding:6px 0}}
.thmviz[hidden]{display:none}
`;
  const API = { chain, chainSvg, packageSvg, ledResistorSvg, sinkShape, bands, ratingFor, build, allHtml, eng, fz, heat, RATINGS, PKG, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.THM_VIZ = API;

  /* ---------------------------------------------------------------- DOM-Anbindung (nur Browser) */
  if (typeof document === 'undefined') return;
  let host = null, lastSig = '';
  function inject() { if (document.getElementById('thmviz-css')) return; const st = document.createElement('style'); st.id = 'thmviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  function ensureHost() {
    if (host && host.isConnected) return host; const a = document.getElementById('scopeHost'); if (!a || !a.parentNode) return null;
    host = document.createElement('details'); host.className = 'card thmviz'; host.id = 'thmviz'; host.hidden = true;
    host.innerHTML = '<summary>Wärmepfad und Bauform</summary><div class="cb" data-tv-body></div>';
    let open = true; try { open = localStorage.getItem('lm4.thm.viz') !== '0'; } catch (e) {} host.open = open;
    host.addEventListener('toggle', () => { try { localStorage.setItem('lm4.thm.viz', host.open ? '1' : '0'); } catch (e) {} lastSig = ''; });
    a.parentNode.insertBefore(host, a); return host;
  }
  function tick() {
    try {
      if (document.hidden) return; const U = root.THM_UI, S = U && U.S, h = ensureHost(); if (!h || !S) return;
      const st = S.st, ok = S.tab === 'rig' && st && S.rigId && S.rigId !== 'vergleich' && !S.task && !S.attrappe && !S.readonly && st.paste !== 'geliefert' && st.screw !== 'geliefert';
      if (!ok) { if (!h.hidden) { h.hidden = true; lastSig = ''; } return; }
      if (!h.open) { h.hidden = false; return; }
      let blechD = NaN; try { const c = S.rig && S.rig.cfg && S.rig.cfg(); blechD = c && c.blech && c.blech.d_mm; } catch (e) {}
      const st2 = Object.assign({}, st, { blechD: fin(blechD) ? blechD : undefined });
      const keys = ['tj', 'tc', 'tk', 'ta', 'pv', 'rthJC', 'rthCK', 'rthK', 'rthTotal', 'tjMax', 'tjSteady', 'heatsink', 'blechA', 'joint', 'paste', 'fan', 'mode', 'shutdown', 'destroyed', 'device', 'deviceId', 'rv', 'pTreiber', 'driver', 'pTotal'];
      const sig = S.rigId + '|' + keys.map(k => { const v = st2[k]; return fin(v) ? +v.toPrecision(5) : v; }).join('|') + '|' + st2.blechD;
      if (sig === lastSig && !h.hidden) return; lastSig = sig;
      const html = allHtml(S.rigId, st2, root.THM_CORE), body = h.querySelector('[data-tv-body]');
      if (!html) { h.hidden = true; return; } body.innerHTML = html; h.hidden = false;
    } catch (e) { if (!tick.err) { tick.err = 1; try { console.error('thmviz:', e); } catch (x) {} } }
  }
  inject();
  setInterval(tick, 400);
  document.addEventListener('click', () => setTimeout(tick, 60), true);
})(typeof window !== 'undefined' ? window : globalThis);
