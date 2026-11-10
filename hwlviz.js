'use strict';
/* Tonfunk PC-Hardware-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei hwlviz.js, eingebunden NACH hwlui.js.
   Reiter PC und Netzteil: Mainboard-Skizze (Steckplätze nach Stückzahlen) und Leistungsbilanz-Balken gegen das Netzteil.
   Reiter RAID: Datenverteilung auf den Platten (Streifen, Spiegel, Parität) und Kapazitätsvergleich aller Stufen.
   Reiter Konfigurator: Mainboard-Skizze mit Formfaktor, Sockel und Speichertyp; Maßvergleich (Kühler, Grafikkarte, Netzteil).
   Reiter Einheiten und Daten: Umrechnungsleiter dezimal (SI) gegen binär (IEC) und Anzeige-Unterschied einer Datenträgerangabe.
   Die Bilder lesen nur den Zustand aus localStorage (lm4.hwl.*) und rechnen mit HWL_CORE. Sie ändern weder Eingaben noch Aufgaben
   und kommen in den Reitern Aufgaben und Trainer nicht vor (Lösungen bleiben verdeckt). Alle Zahlen sind ÜBUNGSWERTE.
   Theme nur über CSS-Variablen; Bewegung nur als CSS-Animation und nur bei prefers-reduced-motion: no-preference.
   window.HWL_VIZ bzw. module.exports: reine Funktionen, die SVG-Text liefern (für Tests). */
(function (root) {
  const C = root.HWL_CORE || (typeof require !== 'undefined' ? require('./hwlcore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n0 = (v, d) => (fin(v) ? v : d || 0);
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const P = s => (C ? C.parseDe(s) : NaN);
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  /* Füllfarben: Fallback über Attribut, Mischung über style (alte Browser ignorieren color-mix) */
  const mix = (a, b, p) => `color-mix(in srgb,var(--${a}) ${p}%,var(--${b}))`;
  const fl = (col, op, alt) => `fill="var(--${col})"${op != null ? ` fill-opacity="${op}"` : ''}${alt ? ` style="fill:${alt}"` : ''}`;
  const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${num(x)}" y="${num(y)}"${extra || ''}>${esc(t)}</text>`;

  /* ============================================================ Mainboard-Skizze */
  /* Abmessungen der Formfaktoren (Millimeter, Fachwissen) und Steckplätze der Skizze (beispielhaft) */
  const FF = { ATX: { w: 440, h: 352, mm: '305 × 244 mm', slots: 4, x1: 2, nm: 'ATX' }, mATX: { w: 352, h: 352, mm: '244 × 244 mm', slots: 4, x1: 1, nm: 'Micro-ATX' }, ITX: { w: 245, h: 245, mm: '170 × 170 mm', slots: 2, x1: 0, nm: 'Mini-ITX' } };
  /* o: { ff, sock, ramType, mods, gpu, m2, sata, fans, temp, coolBad, showFF } */
  function mainboard(o) {
    o = o || {};
    const key = FF[o.ff] ? o.ff : 'ATX', ff = FF[key], W = 480, H = 428, x0 = (W - 440) / 2, by = 10, bw = ff.w, bh = ff.h, bx = x0;
    const X = q => bx + q * bw, Y = q => by + q * bh, small = bw < 300, mods = Math.max(0, Math.floor(n0(o.mods))), nSl = ff.slots;
    let s = ''; const lab = (x, y, t, extra) => (small ? '' : T(x, y, t, 'vz-s m', extra)), info = [];
    if (o.showFF) Object.keys(FF).forEach(k => { if (k !== key) s += `<rect x="${x0}" y="${by}" width="${FF[k].w}" height="${FF[k].h}" rx="6" fill="none" stroke="var(--mute)" stroke-width="1" stroke-dasharray="4 4" stroke-opacity=".6"/>` + T(x0 + FF[k].w - 4, by + FF[k].h - 5, FF[k].nm, 'vz-s m', ' text-anchor="end"'); });
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" ${fl('panel')} style="fill:${mix('ok', 'panel', 14)}" stroke="var(--mute)" stroke-width="2"/>`;
    /* Leiterbahnen als Dekor */
    s += `<path d="M${X(.12)} ${Y(.55)}H${X(.30)}L${X(.36)} ${Y(.48)}H${X(.60)}M${X(.50)} ${Y(.30)}H${X(.60)}M${X(.30)} ${Y(.62)}V${Y(.66)}M${X(.64)} ${Y(.66)}V${Y(.55)}H${X(.84)}" fill="none" stroke="var(--ok)" stroke-opacity=".35" stroke-width="1.5"/>`;
    /* E/A-Blech */
    s += `<rect x="${bx - 4}" y="${Y(.08)}" width="${Math.round(bw * .09)}" height="${Math.round(bh * .42)}" rx="3" ${fl('mute', .45)} stroke="var(--mute)"/>` + (small ? '' : T(bx + 6, Y(.50) + 12, 'E/A', 'vz-s m'));
    /* Prozessor-Sockel mit Kühler */
    const cs = Math.round(bh * .27), cx = X(.36), cy = Y(.28), temp = o.temp, th = (C && C.THROTTLE) || 90, hot = fin(temp) && temp > th, col = o.coolBad || hot ? 'danger' : 'ok';
    s += `<rect x="${num(cx - cs / 2 - 8)}" y="${num(cy - cs / 2 - 8)}" width="${cs + 16}" height="${cs + 16}" rx="5" ${fl('mute', .25)} stroke="var(--mute)" stroke-dasharray="3 3"/>`;
    s += `<rect x="${num(cx - cs / 2)}" y="${num(cy - cs / 2)}" width="${cs}" height="${cs}" rx="4" ${fl('panel2')} stroke="var(--fg)" stroke-width="1.5"/>`;
    s += `<circle class="vz-glow" cx="${num(cx)}" cy="${num(cy)}" r="${num(cs * .62)}" ${fl(col, .16)} stroke="var(--${col})" stroke-width="2.5"/>`;
    for (let i = 0; i < 4; i++) s += `<ellipse cx="${num(cx)}" cy="${num(cy - cs * .27)}" rx="${num(cs * .07)}" ry="${num(cs * .2)}" ${fl('mute', .55)} transform="rotate(${i * 90} ${num(cx)} ${num(cy)})"/>`;
    s += T(cx, cy + 4, fin(temp) ? f(temp, 0) + ' °C' : (o.sock || 'CPU'), 'vz-t b', ' text-anchor="middle" style="paint-order:stroke;stroke:var(--panel);stroke-width:3px"');
    s += lab(cx, cy + cs * .62 + 15, o.sock ? 'Sockel ' + o.sock : 'Prozessor-Sockel', ' text-anchor="middle"');
    /* Stromstecker CPU */
    s += `<rect x="${num(cx - 18)}" y="${Y(.012)}" width="36" height="9" rx="2" ${fl('hi', .8)}/>` + (small ? '' : T(cx - 22, Y(.012) + 8, '8-pol CPU', 'vz-s m', ' text-anchor="end"'));
    /* Arbeitsspeicher */
    const sw = Math.max(7, Math.round(bw * .03)), sp = Math.round(bw * .045), rx0 = X(.62), sh = Math.round(bh * .44), sy = Y(.07);
    for (let i = 0; i < nSl; i++) {
      const on = i < mods;
      s += `<rect x="${num(rx0 + i * sp)}" y="${num(sy)}" width="${sw}" height="${sh}" rx="2" ${on ? fl('accent', .75) : fl('bg')} stroke="${on ? 'var(--accent)' : 'var(--mute)'}" stroke-width="1.5"/>`;
      if (on) s += `<rect x="${num(rx0 + i * sp + 1.5)}" y="${num(sy + 6)}" width="${sw - 3}" height="${Math.round(sh * .18)}" rx="1" ${fl('fg', .75)}/>`;
    }
    const ramTxt = 'RAM ' + Math.min(mods, nSl) + '/' + nSl + (o.ramType ? ' ' + o.ramType : ''); info.push(ramTxt); s += lab(rx0, sy + sh + 13, ramTxt);
    /* ATX-Strom 24-polig */
    s += `<rect x="${num(X(.945))}" y="${Y(.16)}" width="${Math.round(bw * .035)}" height="${Math.round(bh * .3)}" rx="2" ${fl('hi', .8)}/>`;
    s += lab(X(.945) + 6, Y(.16) - 4, '24-pol', ' text-anchor="end"');
    /* M.2, Chipsatz, Batterie */
    const m2 = Math.min(2, Math.max(0, Math.floor(n0(o.m2))));
    for (let i = 0; i < 2; i++) { const on = i < m2; s += `<rect x="${num(X(.2))}" y="${num(Y(.56 + i * .075))}" width="${Math.round(bw * .2)}" height="${Math.round(bh * .035)}" rx="2" ${on ? fl('accent', .8) : fl('bg')} stroke="${on ? 'var(--accent)' : 'var(--mute)'}"/>`; }
    info.push('M.2 ' + m2 + '/2'); s += lab(X(.2), Y(.56) - 4, 'M.2 ' + m2 + '/2');
    s += `<rect x="${num(X(.64))}" y="${num(Y(.6))}" width="${Math.round(bw * .13)}" height="${Math.round(bh * .14)}" rx="3" ${fl('mute', .5)} stroke="var(--mute)"/>` + T(X(.64) + bw * .065, Y(.6) + bh * .08, 'Chipsatz', 'vz-s', ' text-anchor="middle"');
    s += `<circle cx="${num(X(.50))}" cy="${num(Y(.84))}" r="${Math.round(bw * .028)}" ${fl('mute', .6)} stroke="var(--fg)" stroke-opacity=".6"/>` + (small ? '' : T(X(.50), Y(.84) + 24, 'Batterie', 'vz-s m', ' text-anchor="middle"'));
    /* Erweiterungssteckplätze */
    const gpu = !!o.gpu, y16 = Y(.76);
    s += `<rect x="${num(X(.06))}" y="${num(y16)}" width="${Math.round(bw * .54)}" height="9" rx="2" ${gpu ? fl('hi', .85) : fl('bg')} stroke="${gpu ? 'var(--hi)' : 'var(--mute)'}" stroke-width="1.5"/>` + lab(X(.06), y16 + 22, 'PCIe x16' + (gpu ? ' · Grafikkarte' : ' · frei'));
    info.push('PCIe x16 ' + (gpu ? 'belegt' : 'frei'));
    for (let i = 0; i < ff.x1; i++) s += `<rect x="${num(X(.06))}" y="${num(Y(.85 + i * .07))}" width="${Math.round(bw * .22)}" height="7" rx="2" ${fl('bg')} stroke="var(--mute)"/>` + (i === 0 && !small ? T(X(.06) + bw * .24, Y(.85) + 7, 'PCIe x1', 'vz-s m') : '');
    if (gpu) s += `<rect class="vz-gpu" x="${num(X(.04))}" y="${num(y16 - 15)}" width="${Math.round(bw * .54)}" height="14" rx="3" ${fl('hi', .3)} stroke="var(--hi)" stroke-width="2"/><circle cx="${num(X(.22))}" cy="${num(y16 - 8)}" r="5" ${fl('mute', .6)}/><circle cx="${num(X(.40))}" cy="${num(y16 - 8)}" r="5" ${fl('mute', .6)}/>`;
    /* SATA-Anschlüsse */
    const sata = Math.min(4, Math.max(0, Math.floor(n0(o.sata))));
    for (let i = 0; i < 4; i++) { const on = i < sata; s += `<rect x="${num(X(.86))}" y="${num(Y(.60 + i * .075))}" width="${Math.round(bw * .1)}" height="${Math.round(bh * .045)}" rx="2" ${on ? fl('ok', .8) : fl('bg')} stroke="${on ? 'var(--ok)' : 'var(--mute)'}"/>`; }
    info.push('SATA ' + sata + '/4'); s += lab(X(.86) + bw * .1, Y(.60) - 5, 'SATA ' + sata + '/4', ' text-anchor="end"');
    /* Lüfteranschlüsse */
    const fans = Math.min(5, Math.max(0, Math.floor(n0(o.fans)))), fp = [[.50, .006], [.60, .006], [.92, .91], [.66, .93], [.04, .64]];
    fp.forEach((p, i) => { const on = i < fans; s += `<rect x="${num(X(p[0]))}" y="${num(Y(p[1]))}" width="16" height="8" rx="2" ${on ? fl('accent', .8) : fl('bg')} stroke="${on ? 'var(--accent)' : 'var(--mute)'}"/>`; });
    info.push('Lüfter ' + fans + '/5');
    s += T(bx, by + 352 + 18, ff.nm + ' · ' + ff.mm, 'vz-s b');
    s += small ? T(bx, by + 352 + 36, info.join(' · '), 'vz-s m') : T(bx + 440, by + 352 + 18, 'Lüfteranschlüsse belegt: ' + fans + ' von 5', 'vz-s m', ' text-anchor="end"');
    s += T(W / 2, H - 4, 'Skizze, Lage und Zahl der Steckplätze beispielhaft', 'vz-s m', ' text-anchor="middle"');
    return svg(W, H, 'Skizze eines Mainboards (' + ff.nm + ') mit Prozessorsockel, Speichersteckplätzen, Erweiterungssteckplätzen und Anschlüssen', s);
  }

  /* ============================================================ Leistungsbilanz */
  const PWR = [['cpu', 'Prozessor', 'accent', null], ['gpu', 'Grafikkarte', 'hi', null], ['mb', 'Mainboard', 'ok', null], ['ram', 'RAM', 'accent', mix('accent', 'fg', 45)], ['ssd', 'SSD', 'hi', mix('hi', 'fg', 45)], ['hdd', 'Festplatte', 'ok', mix('ok', 'fg', 45)], ['fan', 'Lüfter', 'mute', null], ['other', 'Sonstiges', 'mute', mix('mute', 'bg', 45)]];
  /* p: Zahlen wie pcParams des UI. Ergebnis: Balken der Bauteilleistungen, Netzteilgröße, Reserve, Aufnahme/Verlust */
  function power(p) {
    const ks = ['cpu', 'gpu', 'mb', 'ram', 'ssd', 'hdd', 'fan', 'other'];
    if (!C || !ks.every(k => fin(p[k]) && p[k] >= 0)) return svg(480, 40, 'Leistungsbilanz', T(240, 24, 'Gib alle Leistungs- und Stückzahlfelder als Zahlen ein (nicht negativ).', 'vz-s m', ' text-anchor="middle"'));
    const L = C.LOAD, w = { cpu: p.cpu, gpu: p.gpu, mb: p.mb, ram: p.ram * L.ram, ssd: p.ssd * L.ssd, hdd: p.hdd * L.hdd, fan: p.fan * L.fan, other: p.other };
    const sum = C.loadSum(p), rec = C.psuNeed(sum), pick = C.psuPick(sum), top = Math.max(fin(pick) ? pick : 0, rec, sum, 1) * 1.04;
    const W = 480, bx = 14, bw = 452, sx = v => v / top * bw, y = 52, h = 34;
    let s = T(bx, 16, 'Last der Bauteile gegen das Netzteil', 'vz-t b');
    const util = fin(pick) ? sum / pick * 100 : NaN;
    s += T(bx + bw, 16, fin(pick) ? 'Netzteil ' + f(pick, 0) + ' W · Auslastung ' + f(util, 0) + ' %' : 'Netzteil über 1.200 W nötig', 'vz-s m', ' text-anchor="end"');
    s += `<rect x="${bx}" y="${y}" width="${num(fin(pick) ? sx(pick) : bw)}" height="${h}" rx="6" ${fl('panel')} stroke="var(--mute)" stroke-width="1.5"/>`;
    let acc = 0; PWR.forEach(k => { const v = w[k[0]]; if (!(v > 0)) return; s += `<rect x="${num(bx + sx(acc))}" y="${y}" width="${num(Math.max(1, sx(v)))}" height="${h}" ${fl(k[2], .8, k[3])} stroke="var(--panel)" stroke-width="1.5"/>`; acc += v; });
    /* Reserve und Normgröße */
    s += `<line x1="${num(bx + sx(rec))}" x2="${num(bx + sx(rec))}" y1="${y - 8}" y2="${y + h + 8}" stroke="var(--warn)" stroke-width="2.5" stroke-dasharray="5 3"/>`;
    const sumEnd = sx(sum), recX = sx(rec), lab1 = 'Last ' + f(sum, 0) + ' W', lab2 = 'mit 30 % Reserve ' + f(rec, 0) + ' W';
    s += T(bx + sumEnd, y + h + 24, lab1, 'vz-s b', ` text-anchor="${sumEnd > bw - 100 ? 'end' : 'start'}"`);
    s += T(bx + recX, y - 12, lab2, 'vz-s', ` text-anchor="${recX > bw - 150 ? 'end' : 'start'}" style="fill:var(--warn)"`);
    if (fin(pick) && util > 100) s += T(bx + bw, y + h + 24, 'Netzteil überlastet', 'vz-s b', ' text-anchor="end" style="fill:var(--danger)"');
    /* Legende (Text mit Wert, nicht nur Farbe) */
    let ly = y + h + 48; const colw = 225;
    PWR.forEach((k, i) => { const cx = bx + (i % 2) * colw, cy = ly + Math.floor(i / 2) * 20; s += `<rect x="${cx}" y="${cy - 10}" width="12" height="12" rx="2" ${fl(k[2], .8, k[3])}/>` + T(cx + 18, cy, k[1] + ': ' + f(w[k[0]], 0) + ' W', 'vz-s'); });
    ly += 4 * 20 + 18;
    /* Steckdose, Netzteil, Bauteile */
    const eff = p.eff;
    if (fin(eff) && eff > 0 && eff <= 100 && sum > 0) {
      const pin = C.inputPower(sum, eff), loss = C.lossPower(sum, eff), sc = bw / (pin * 1.0);
      s += T(bx, ly, 'Von der Steckdose zu den Bauteilen (Wirkungsgrad ' + f(eff, 0) + ' %)', 'vz-t b');
      s += `<rect x="${bx}" y="${ly + 10}" width="${num(sum * sc)}" height="26" rx="5" ${fl('accent', .6)}/><rect class="vz-loss" x="${num(bx + sum * sc)}" y="${ly + 10}" width="${num(Math.max(1, loss * sc))}" height="26" rx="5" ${fl('danger', .5)}/>`;
      s += T(bx + 8, ly + 28, 'nutzbar ' + f(sum, 0) + ' W', 'vz-s b');
      s += T(bx + bw, ly + 52, 'Verlust (Wärme im Netzteil) ' + f(loss, 1) + ' W · Aufnahme ' + f(pin, 1) + ' W', 'vz-s', ' text-anchor="end"');
      ly += 58;
    }
    return svg(W, ly + 8, 'Balken: Leistung der Bauteile im Verhältnis zur Netzteilgröße, mit 30 Prozent Reserve', s);
  }

  /* ============================================================ RAID */
  /* Blockraster: Zeile = Streifen, Spalte = Platte; t: D Nutzdaten, M Kopie, P/Q Parität */
  function raidGrid(l, nd, R) {
    const g = []; let cnt = 1;
    for (let r = 0; r < R; r++) {
      const row = [];
      if (l === 0) for (let d = 0; d < nd; d++) row.push({ t: 'D', lab: 'A' + cnt++ });
      else if (l === 1) for (let d = 0; d < nd; d++) row.push({ t: d === 0 ? 'D' : 'M', lab: 'A' + (r + 1) });
      else if (l === 10) for (let d = 0; d < nd; d++) row.push({ t: d % 2 ? 'M' : 'D', lab: 'A' + (r * (nd / 2) + Math.floor(d / 2) + 1) });
      else {
        const pd = nd - 1 - (r % nd), qd = (pd + 1) % nd;
        for (let d = 0; d < nd; d++) row.push(d === pd ? { t: 'P', lab: 'P' + (r + 1) } : l === 6 && d === qd ? { t: 'Q', lab: 'Q' + (r + 1) } : { t: 'D', lab: 'A' + cnt++ });
      }
      g.push(row);
    }
    return g;
  }
  /* Zustand eines Blocks auf ausgefallener Platte: 'rec' rekonstruierbar, 'lost' verloren */
  function blockState(l, nd, d, failed) {
    const fl2 = failed.filter(i => i < nd).length;
    if (l === 0) return 'lost';
    if (l === 1) return fl2 < nd ? 'rec' : 'lost';
    if (l === 5) return failed.length <= 1 ? 'rec' : 'lost';
    if (l === 6) return failed.length <= 2 ? 'rec' : 'lost';
    return failed.indexOf(d ^ 1) < 0 ? 'rec' : 'lost';
  }
  function raidMap(o) {
    const l = o.level, n = o.n, W = 480;
    if (!C) return svg(W, 30, 'RAID', '');
    const chk = C.raidOk(l, n);
    if (!chk.ok) return svg(W, 50, 'Datenverteilung im RAID', T(W / 2, 28, chk.why, 'vz-s m', ' text-anchor="middle"'));
    if (n > 8) return svg(W, 50, 'Datenverteilung im RAID', T(W / 2, 28, 'Die Verteilung der Blöcke wird bis 8 Platten gezeigt.', 'vz-s m', ' text-anchor="middle"'));
    const failed = (o.failed || []).filter(i => Number.isInteger(i) && i >= 0 && i < n), R = 4, g = raidGrid(l, n, R), gap = 6, cw = Math.min(56, (W - 80 - gap * (n - 1)) / n), rh = 30, top = 44, lx = Math.max(44, Math.round((W - (n * cw + gap * (n - 1))) / 2));
    let s = T(14, 16, 'Datenverteilung (vier Streifen als Beispiel)', 'vz-t b');
    for (let d = 0; d < n; d++) s += T(lx + d * (cw + gap) + cw / 2, top - 8, 'Platte ' + (d + 1), 'vz-s' + (failed.indexOf(d) >= 0 ? ' b' : ' m'), ' text-anchor="middle"');
    g.forEach((row, r) => {
      s += T(lx - 8, top + r * (rh + gap) + rh / 2 + 4, 'Z' + (r + 1), 'vz-s m', ' text-anchor="end"');
      row.forEach((b, d) => {
        const x = lx + d * (cw + gap), y = top + r * (rh + gap), isF = failed.indexOf(d) >= 0, st = isF ? blockState(l, n, d, failed) : 'ok';
        const base = b.t === 'D' ? fl('accent', .7) : b.t === 'M' ? fl('accent', .28) : b.t === 'P' ? fl('hi', .75) : fl('hi', .45);
        if (!isF) s += `<rect x="${num(x)}" y="${y}" width="${num(cw)}" height="${rh}" rx="5" ${base} stroke="${b.t === 'M' ? 'var(--accent)' : 'var(--panel)'}" stroke-width="1.5"${b.t === 'M' ? ' stroke-dasharray="4 3"' : ''}/>`;
        else if (st === 'rec') s += `<rect x="${num(x)}" y="${y}" width="${num(cw)}" height="${rh}" rx="5" ${fl('panel')} stroke="var(--ok)" stroke-width="2" stroke-dasharray="5 3"/>`;
        else s += `<rect x="${num(x)}" y="${y}" width="${num(cw)}" height="${rh}" rx="5" ${fl('danger', .45)} stroke="var(--danger)" stroke-width="2"/>`;
        s += T(x + cw / 2, y + rh / 2 + 4, isF && st === 'lost' ? '✕' : b.lab, 'vz-s b', ' text-anchor="middle"');
      });
    });
    const yb = top + R * (rh + gap) + 6, items = [['accent', .7, 'Nutzdaten', 0], ['accent', .28, 'Kopie (Spiegel)', 1], ['hi', .75, 'Parität', 0], ['ok', 0, 'fehlt, aus Rest rekonstruierbar', 2], ['danger', .45, 'verloren', 0]];
    let lxp = 14, lyp = yb + 8;
    items.forEach(it => {
      if ((it[3] === 1 && l !== 1 && l !== 10) || (it[2] === 'Parität' && l !== 5 && l !== 6)) return;
      const wlab = it[2].length * 6.2 + 26; if (lxp + wlab > W) { lxp = 14; lyp += 20; }
      s += `<rect x="${lxp}" y="${lyp - 10}" width="12" height="12" rx="2" ${it[3] === 2 ? fl('panel') + ' stroke="var(--ok)" stroke-dasharray="3 2"' : fl(it[0], it[1])}${it[3] === 1 ? ' stroke="var(--accent)" stroke-dasharray="3 2"' : ''}/>` + T(lxp + 17, lyp, it[2], 'vz-s');
      lxp += wlab;
    });
    return svg(W, lyp + 12, 'Verteilung der Datenblöcke auf ' + n + ' Platten im RAID ' + l, s);
  }
  function raidCompare(o) {
    const n = o.n, sz = o.s, W = 480;
    if (!C || !Number.isInteger(n) || !(sz > 0)) return svg(W, 40, 'Kapazitätsvergleich', T(W / 2, 24, 'Gib eine ganze Plattenzahl und eine Größe größer als 0 ein.', 'vz-s m', ' text-anchor="middle"'));
    const raw = C.raidRaw(n, sz), lx = 66, bw = 190, rh = 30;
    let s = T(14, 16, 'Nutzbare Kapazität im Vergleich (' + n + ' × ' + f(sz, 2) + ' TB = ' + f(raw, 2) + ' TB roh)', 'vz-t b');
    C.RAIDS.forEach((r, i) => {
      const y = 30 + i * rh, ok = C.raidOk(r.l, n).ok, cur = r.l === o.level;
      s += T(14, y + 17, 'RAID ' + r.l, 'vz-s' + (cur ? ' b' : ' m'));
      s += `<rect x="${lx}" y="${y + 3}" width="${bw}" height="18" rx="4" ${fl('panel')} stroke="${cur ? 'var(--accent)' : 'var(--line)'}" stroke-width="${cur ? 2.5 : 1}"/>`;
      if (ok) {
        const u = C.raidUsable(r.l, n, sz), t = C.raidTol(r.l, n);
        s += `<rect x="${lx}" y="${y + 3}" width="${num(u / raw * bw)}" height="18" rx="4" ${fl(cur ? 'accent' : 'mute', cur ? .8 : .55)}/>`;
        s += T(lx + bw + 10, y + 17, f(u, 2) + ' TB · ' + f(u / raw * 100, 0) + ' %', 'vz-s' + (cur ? ' b' : '')) + T(W - 14, y + 17, 'Ausfälle ' + t, 'vz-s m', ' text-anchor="end"');
      } else s += T(lx + bw + 10, y + 17, 'braucht ' + (r.l === 10 ? 'gerade Zahl ≥ 4' : '≥ ' + r.min + ' Platten'), 'vz-s m');
    });
    s += T(14, 30 + 5 * rh + 14, 'Ausfälle: so viele beliebige Platten dürfen garantiert ausfallen.', 'vz-s m');
    return svg(W, 30 + 5 * rh + 24, 'Balkenvergleich der nutzbaren Kapazität aller RAID-Stufen', s);
  }

  /* ============================================================ Maßvergleich im Konfigurator */
  function meter(y, lab, val, lim, unit, ok, vl, ll) {
    const bx = 14, bw = 340, mx = Math.max(val, lim, 1) * 1.15, sx = v => v / mx * bw;
    let s = T(bx, y, lab, 'vz-s b') + `<rect x="${bx}" y="${y + 6}" width="${bw}" height="16" rx="4" ${fl('panel')} stroke="var(--line)"/>`;
    s += `<rect x="${bx}" y="${y + 6}" width="${num(sx(val))}" height="16" rx="4" ${fl(ok ? 'ok' : 'danger', .7)}/>`;
    s += `<line x1="${num(bx + sx(lim))}" x2="${num(bx + sx(lim))}" y1="${y + 2}" y2="${y + 26}" stroke="var(--fg)" stroke-width="2.5"/>`;
    s += T(bx + bw + 10, y + 12, vl + f(val, 0) + ' ' + unit, 'vz-s b');
    s += T(bx + bw + 10, y + 26, ll + f(lim, 0) + ' ' + unit, 'vz-s m');
    return s;
  }
  function fitBars(sel) {
    const W = 480; if (!C) return svg(W, 20, '', '');
    const r = C.checkBuild(sel); if (r.invalid) return svg(W, 30, 'Maßvergleich', T(W / 2, 20, 'Bitte für jede Baugruppe ein Bauteil wählen.', 'vz-s m', ' text-anchor="middle"'));
    const cpu = C.part('cpu', sel.cpu), cool = C.part('cool', sel.cool), gpu = C.part('gpu', sel.gpu), cs = C.part('case', sel.case), psu = C.part('psu', sel.psu);
    const mb = C.part('mb', sel.mb), ram = C.part('ram', sel.ram);
    const pairs = [['Sockel', cpu.sock, mb.sock, cpu.sock === mb.sock], ['Speichertyp', ram.type, mb.ram, ram.type === mb.ram], ['Formfaktor', mb.ff, cs.ff.join('/'), cs.ff.indexOf(mb.ff) >= 0], ['Speichermenge', f(ram.gib, 0) + ' GiB', 'bis ' + f(mb.max, 0) + ' GiB', ram.gib <= mb.max], ['Kühler und Sockel', cpu.sock, cool.socks.length < 4 ? cool.socks.join('/') : 'alle', cool.socks.indexOf(cpu.sock) >= 0]];
    let s = T(14, 16, 'Passt es? Stecken und Maße', 'vz-t b'), y = 24;
    pairs.forEach(q => { y += 26; s += `<rect x="14" y="${y - 17}" width="452" height="22" rx="5" ${fl(q[3] ? 'ok' : 'danger', .14)} stroke="var(--${q[3] ? 'ok' : 'danger'})" stroke-width="1.2"/>` + T(22, y - 2, q[0], 'vz-s b') + T(165, y - 2, q[1] + '  ↔  ' + q[2], 'vz-s') + T(458, y - 2, q[3] ? '✓ passt' : '✗ passt nicht', 'vz-s b', ' text-anchor="end"'); });
    y += 22; s += T(14, y, 'Wert gegen Grenze (Strich)', 'vz-s m'); y += 22;
    s += meter(y, 'Kühlerhöhe im Gehäuse', cool.h, cs.cool, 'mm', cool.h <= cs.cool, '', 'Grenze '); y += 50;
    if (gpu.len > 0) { s += meter(y, 'Länge der Grafikkarte', gpu.len, cs.gpu, 'mm', gpu.len <= cs.gpu, '', 'Grenze '); y += 50; }
    s += meter(y, 'Kühlleistung gegen Wärme des Prozessors', cool.tdp, cpu.tdp, 'W', cool.tdp >= cpu.tdp, 'Kühler ', 'Prozessor '); y += 50;
    s += meter(y, 'Netzteil gegen Last mit Reserve', psu.w, r.rec, 'W', psu.w >= r.rec - 1e-9, 'Netzteil ', 'Bedarf ');
    y += 42;
    return svg(W, y, 'Balken: Kühlerhöhe, Grafikkartenlänge, Kühlleistung und Netzteil im Vergleich zu den Grenzen', s);
  }

  /* ============================================================ Umrechnungsleiter */
  const compact = v => (!fin(v) ? '–' : v === 0 ? '0' : v < 0.0001 ? '< 0,0001' : f(v, v >= 100 ? 0 : v >= 1 ? 2 : 4));
  function ladder(o) {
    const W = 480, v = o.v, u = o.u, names = C ? C.DEC : [], bin = C ? C.BIN : [], rh = 34, gapY = 26, top = 34, wx = 150;
    const rungs = [4, 3, 2, 1, 0];
    let s = T(14 + wx / 2, 18, 'dezimal (SI)', 'vz-s b', ' text-anchor="middle"') + T(W - 14 - wx / 2, 18, 'binär (IEC)', 'vz-s b', ' text-anchor="middle"');
    rungs.forEach((k, i) => {
      const y = top + i * (rh + gapY), cur = (c) => (fin(v) && u === c);
      [[14, names[k], k === 0 ? 'B' : names[k]], [W - 14 - wx, bin[k], bin[k]]].forEach((b, j) => {
        const on = cur(b[1]), val = fin(v) && C ? C.convert(v, u, b[1]) : NaN;
        s += `<rect x="${b[0]}" y="${y}" width="${wx}" height="${rh}" rx="7" ${fl(on ? 'accent' : 'panel', on ? .35 : null)} stroke="${on ? 'var(--accent)' : 'var(--mute)'}" stroke-width="${on ? 3 : 1.5}"/>`;
        s += T(b[0] + 12, y + 21, b[2], 'vz-t b') + T(b[0] + wx - 10, y + 21, compact(val), 'vz-s', ' text-anchor="end"');
      });
      if (k > 0) {
        const pct = (Math.pow(1024 / 1000, k) - 1) * 100;
        s += T(W / 2, y + 21, '≈ +' + f(pct, 1) + ' %', 'vz-s m', ' text-anchor="middle"') + `<path d="M${14 + wx + 6} ${y + 17}H${W / 2 - 38}M${W / 2 + 38} ${y + 17}H${W - 14 - wx - 6}" stroke="var(--mute)" stroke-dasharray="3 3" fill="none"/>`;
      }
      if (i < 4) {
        s += `<path d="M${14 + wx / 2} ${y + rh + 2}V${y + rh + gapY - 5}" stroke="var(--mute)" stroke-width="2" fill="none"/><path d="M${14 + wx / 2 - 5} ${y + rh + gapY - 10}l5 6 5-6" fill="none" stroke="var(--mute)" stroke-width="2"/>` + T(14 + wx / 2 + 12, y + rh + 17, '× 1.000', 'vz-s m');
        s += `<path d="M${W - 14 - wx / 2} ${y + rh + 2}V${y + rh + gapY - 5}" stroke="var(--mute)" stroke-width="2" fill="none"/><path d="M${W - 14 - wx / 2 - 5} ${y + rh + gapY - 10}l5 6 5-6" fill="none" stroke="var(--mute)" stroke-width="2"/>` + T(W - 14 - wx / 2 + 12, y + rh + 17, '× 1.024', 'vz-s m');
      }
    });
    const H = top + 5 * rh + 4 * gapY + 40;
    s += T(W / 2, H - 22, 'Eine Stufe nach unten: Zahl mal 1.000 (dezimal) bzw. mal 1.024 (binär).', 'vz-s m', ' text-anchor="middle"');
    s += T(W / 2, H - 5, '„≈ +x %“: die binäre Einheit ist so viel größer als die dezimale.', 'vz-s m', ' text-anchor="middle"');
    return svg(W, H, 'Umrechnungsleiter: Byte, Kilo, Mega, Giga, Tera dezimal und binär', s);
  }
  /* Datenträgerangabe (dezimal) gegen die Anzeige des Betriebssystems (binär) */
  function shownBars(o) {
    const W = 480; if (!C || !(o.v > 0) || !C.BIN_OF[o.u]) return '';
    const sh = C.shown(o.v, o.u), bu = C.BIN_OF[o.u], bw = 300, y = 30;
    let s = T(14, 16, 'Datenträgerangabe und Anzeige im Betriebssystem', 'vz-t b');
    s += `<rect x="14" y="${y}" width="${bw}" height="22" rx="5" ${fl('accent', .6)}/>` + T(14 + bw + 10, y + 16, f(o.v, 2) + ' ' + o.u + ' (Aufdruck)', 'vz-s b');
    s += `<rect x="14" y="${y + 30}" width="${num(sh / o.v * bw)}" height="22" rx="5" ${fl('hi', .7)}/><rect class="vz-gapbar" x="${num(14 + sh / o.v * bw)}" y="${y + 30}" width="${num(bw - sh / o.v * bw)}" height="22" rx="5" fill="none" stroke="var(--mute)" stroke-dasharray="4 3"/>` + T(14 + bw + 10, y + 46, f(sh, 2) + ' ' + bu + ' (Anzeige)', 'vz-s b');
    s += T(14, y + 72, 'Es geht nichts verloren: dieselben Bytes, nur anders gezählt', 'vz-s m') + T(14, y + 88, '(Zahl ' + f((1 - sh / o.v) * 100, 1) + ' % kleiner, weil 1 ' + bu + ' größer ist als 1 ' + o.u + ').', 'vz-s m');
    return svg(W, y + 98, 'Balken: Angabe in dezimaler Einheit gegen Anzeige in binärer Einheit', s);
  }

  /* ============================================================ Einbindung in die Seite */
  const CSS = '.vz-card{margin-bottom:10px}.vz-card .vz-svg{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0}' +
    '.vz-svg svg{display:block;width:100%;height:auto;touch-action:manipulation}.vz-svg text{font-family:system-ui,sans-serif;fill:var(--fg);-webkit-user-select:none;user-select:none}' +
    '.vz-t{font-size:13.5px}.vz-s{font-size:12px}.vz-svg .m{fill:var(--mute)}.vz-svg .b{font-weight:700}' +
    '@media(prefers-reduced-motion:no-preference){.vz-glow{animation:vzp 3.2s ease-in-out infinite}.vz-loss{animation:vzp 3.2s ease-in-out infinite}@keyframes vzp{50%{fill-opacity:.32}}}';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.hwl.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const PCD = { cpu: '95', gpu: '200', mb: '40', ram: '4', ssd: '1', hdd: '1', fan: '4', other: '0', eff: '85', h: '4', days: '365', ct: '35', tamb: '25', rth: '0,3' };
  const KFD = { cpu: 'c1', mb: 'b1', ram: 'r2', gpu: 'g1', cool: 'k2', psu: 'p450', case: 't1' };
  const card = (t, body) => `<div class="card pl vz-card"><h4>${esc(t)}</h4><div class="vz-svg">${body}</div></div>`;
  const VIEWS = {
    pc() {
      const s = Object.assign({}, PCD, lsGet('pc', {})), p = {}; Object.keys(s).forEach(k => { p[k] = P(s[k]); });
      const ok = p.cpu >= 0 && p.rth >= 0;
      const ramN = fin(p.ram) ? p.ram : 0, ssd = fin(p.ssd) ? p.ssd : 0, hdd = fin(p.hdd) ? p.hdd : 0;
      return card('Mainboard-Skizze: was steckt wo?', mainboard({ ff: 'ATX', mods: ramN, gpu: fin(p.gpu) && p.gpu > 0, m2: Math.min(1, ssd), sata: hdd + Math.max(0, ssd - 1), fans: fin(p.fan) ? p.fan : 0, temp: ok && fin(p.tamb) ? C.cpuTemp(p.tamb, p.cpu, p.rth) : NaN })) +
        '<p class="hint2" style="margin:-4px 0 6px">Die Skizze zeigt die Eingaben von oben: RAM-Riegel, Grafikkarte, SSD (erste im M.2-Steckplatz, weitere an SATA), Festplatten an SATA und Lüfter. Der Ring um den Prozessor zeigt die Temperatur nach dem Übungsmodell.</p>' +
        card('Leistungsbilanz', power(pcParamsOf(p)));
    },
    raid() {
      const s = Object.assign({ level: 5, n: '4', s: '4', failed: [] }, lsGet('raid', {})), n = P(s.n), sz = P(s.s), lv = +s.level;
      return card('Datenverteilung auf den Platten', raidMap({ level: lv, n, failed: Array.isArray(s.failed) ? s.failed : [] })) + card('Welche Stufe bringt wie viel?', raidCompare({ level: lv, n, s: sz }));
    },
    kfg() {
      const s = Object.assign({}, KFD, lsGet('kfg', {})); Object.keys(KFD).forEach(k => { if (!C.part(k, s[k])) s[k] = KFD[k]; });
      const mb = C.part('mb', s.mb), cpu = C.part('cpu', s.cpu), ram = C.part('ram', s.ram), gpu = C.part('gpu', s.gpu), cool = C.part('cool', s.cool), r = C.checkBuild(s);
      return card('Mainboard mit gewählten Teilen', mainboard({ ff: mb.ff, sock: mb.sock, ramType: mb.ram, mods: ram.mods, gpu: gpu.tdp > 0, m2: 1, sata: 1, fans: 2, showFF: true, coolBad: !!(cool.tdp < cpu.tdp) })) + card('Maße und Leistung', fitBars(s));
    },
    bit() {
      const b = Object.assign({ v: '500', u: 'GB' }, lsGet('bit', {})), v = P(b.v), u = C.UNITS[b.u] ? b.u : 'GB';
      const sb = shownBars({ v, u });
      return card('Umrechnungsleiter', ladder({ v: v >= 0 ? v : NaN, u })) + (sb ? card('Aufdruck gegen Anzeige', sb) : '');
    }
  };
  function pcParamsOf(p) { return { cpu: p.cpu, gpu: p.gpu, mb: p.mb, ram: p.ram, ssd: p.ssd, hdd: p.hdd, fan: p.fan, other: p.other, eff: p.eff }; }
  const SLOT = { pc: ['#pcView', '#pcOut'], raid: ['#raidView', '#raidOut'], kfg: ['#kfgView', '#kfgOut'], bit: ['#bitView', '#bitOut'] };
  function paint(k) {
    const view = document.querySelector(SLOT[k][0]), out = view && view.querySelector(SLOT[k][1]); if (!view || !out) return;
    let box = view.querySelector('.vz-box[data-vz="' + k + '"]');
    if (!box) { box = document.createElement('div'); box.className = 'vz-box'; box.setAttribute('data-vz', k); out.parentNode.insertBefore(box, out); }
    let html = ''; try { html = VIEWS[k](); } catch (e) { html = ''; }
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
  }
  function boot() {
    if (!C || typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    Object.keys(SLOT).forEach(k => {
      const view = document.querySelector(SLOT[k][0]); if (!view) return;
      let q = 0; const go = () => { clearTimeout(q); q = setTimeout(() => paint(k), 0); };
      new MutationObserver(go).observe(view, { childList: true });
      ['input', 'change', 'click'].forEach(ev => view.addEventListener(ev, go));
      paint(k);
    });
  }
  const API = { mainboard, power, raidGrid, raidMap, raidCompare, fitBars, ladder, shownBars, FF };
  root.HWL_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
