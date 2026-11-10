'use strict';
/* Tonfunk Warenfluss-Lab: Visualisierungen (Lab-Kennung 'wfl'). Datei wird in wfllab.html NACH wflui.js geladen.
   ALLE Zahlen (Mengen, Fristen, Tarife, Tragfähigkeiten, Maße, Zeiten) sind ÜBUNGSWERTE für die Ausbildung (wie im ganzen Lab).
   Reine Zeichenfunktionen (liefern SVG-Text, ohne DOM, testbar mit node quelle/wfl/test_wflviz.js) plus ein kleiner Haken,
   der die Grafiken in die vorhandenen Reiter einfügt (MutationObserver, wflui.js bleibt unverändert):
     alle Fachreiter:   Fließbild "Warenfluss im Überblick" (Wareneingang, Einlagern, Lager, Kommissionieren, Versand) mit Wegen; die aktuelle Station ist markiert, Tippen wechselt den Reiter
     Lagerstrategien:   Chargen auf der Zeitleiste mit Entnahmereihenfolge (FIFO, LIFO, FEFO), Plätze fest gegen frei als Säulen, Regal mit Gang, Fach und Ebene
     Stapler:           Hebelbild von Vorderachse, Last und Stapler (Kippmoment gegen Standmoment)
     Inventur:          Abweichung je Artikel in Prozent (Blindzählung: Soll bleibt verdeckt, es wird nichts gezeigt)
     Versand:           Paket als Quader mit Gurtmaß und die drei Paketgrenzen
   Verdeckte-Fehler-Prinzip: Wareneingangs-Prüfer, Stapler-Prüfung vor Fahrtantritt, Aufgaben und Trainer bekommen keine Grafik, die Ergebnisse oder Fehler zeigt.
   Farben nur über die CSS-Variablen der Seite, Bewegung nur bei prefers-reduced-motion: no-preference, kein Hover nötig. */
(function (root) {
  const C = root.WFL_CORE || (typeof require === 'function' ? require('./wflcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  function arrow(x1, y1, x2, y2, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 9, p1 = [x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)], p2 = [x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)];
    return `<g class="ar ${cls || ''}"><line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/><polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}"/></g>`;
  }

  /* ============================================================ Fließbild: Warenfluss im Überblick */
  const STATIONS = [
    { k: 'we', n: 'Wareneingang', sub: 'annehmen, prüfen', x: 8, y: 22, w: 112, h: 70, tab: 'we', info: 'Die Lieferung wird angenommen und mit Bestellung und Lieferschein abgeglichen: Menge zählen, Zustand prüfen, Abweichungen vermerken.' },
    { k: 'ein', n: 'Einlagern', sub: 'Stapler', x: 140, y: 22, w: 124, h: 70, tab: 'trag', info: 'Der Stapler bringt die Ware zum Lagerplatz. Dabei zählen Traglast, Lastschwerpunkt und die Prüfung vor Fahrtantritt.' },
    { k: 'lag', n: 'Lager', sub: 'Plätze, Inventur', x: 292, y: 22, w: 120, h: 178, tab: 'lag', info: 'Im Lager entscheidet die Strategie (FIFO, LIFO, FEFO) über die Entnahme, die Platzwahl über den Platzbedarf. Die Inventur prüft den Bestand.' },
    { k: 'kom', n: 'Kommissionieren', sub: 'Ware zusammenstellen', x: 140, y: 130, w: 124, h: 70, tab: 'kom', info: 'Die Ware für einen Auftrag wird aus dem Lager entnommen. Kurze Wege und wenige Fehler sind das Ziel.' },
    { k: 'ver', n: 'Versand', sub: 'packen, kennzeichnen', x: 8, y: 130, w: 112, h: 70, tab: 'ver', info: 'Die Packstücke werden gekennzeichnet, die Versandart wird gewählt und die Fracht bestimmt.' }
  ];
  const TAB2ST = { we: 0, trag: 1, lag: 2, inv: 2, kom: 3, ver: 4 };
  function ico(k, x, y) {
    if (k === 'we') return `<g class="ic"><rect x="${x}" y="${y + 6}" width="26" height="14" rx="1.5"/><rect x="${x + 26}" y="${y + 11}" width="10" height="9" rx="1.5"/><circle cx="${x + 8}" cy="${y + 22}" r="3"/><circle cx="${x + 30}" cy="${y + 22}" r="3"/></g>`;
    if (k === 'ein') return `<g class="ic"><rect x="${x + 10}" y="${y + 9}" width="20" height="10" rx="2"/><line x1="${x + 6}" y1="${y + 2}" x2="${x + 6}" y2="${y + 22}"/><line x1="${x}" y1="${y + 16}" x2="${x + 6}" y2="${y + 16}"/><circle cx="${x + 15}" cy="${y + 22}" r="3"/><circle cx="${x + 28}" cy="${y + 22}" r="3"/></g>`;
    if (k === 'lag') return `<g class="ic"><rect x="${x}" y="${y}" width="36" height="24"/><line x1="${x}" y1="${y + 8}" x2="${x + 36}" y2="${y + 8}"/><line x1="${x}" y1="${y + 16}" x2="${x + 36}" y2="${y + 16}"/><line x1="${x + 12}" y1="${y}" x2="${x + 12}" y2="${y + 24}"/><line x1="${x + 24}" y1="${y}" x2="${x + 24}" y2="${y + 24}"/></g>`;
    if (k === 'kom') return `<g class="ic"><rect x="${x}" y="${y + 2}" width="14" height="20" rx="1.5"/><line x1="${x + 3}" y1="${y + 8}" x2="${x + 11}" y2="${y + 8}"/><line x1="${x + 3}" y1="${y + 13}" x2="${x + 11}" y2="${y + 13}"/><rect x="${x + 20}" y="${y + 10}" width="16" height="12" rx="1.5"/><line x1="${x + 28}" y1="${y + 10}" x2="${x + 28}" y2="${y + 22}"/></g>`;
    return `<g class="ic"><rect x="${x + 2}" y="${y + 4}" width="22" height="18" rx="1.5"/><line x1="${x + 13}" y1="${y + 4}" x2="${x + 13}" y2="${y + 22}"/><rect x="${x + 28}" y="${y + 12}" width="9" height="10" rx="1.5"/></g>`;
  }
  /* active: Index der Station (0 bis 4) oder -1 */
  function flowSvg(active) {
    const W = 420, H = 222, a = fin(active) ? active : -1;
    let s = `<path class="way" d="M 64 57 H 202 H 352 V 165 H 202 H 64"/>`;
    [[130, 57, 0], [278, 57, 0], [278, 165, 1], [130, 165, 1]].forEach(p => { const d = p[2] ? -1 : 1; s += `<polygon class="head" points="${p[0] + 6 * d},${p[1]} ${p[0] - 4 * d},${p[1] - 6} ${p[0] - 4 * d},${p[1] + 6}"/>`; });
    STATIONS.forEach((st, i) => {
      const on = i === a, cx = st.x + st.w / 2;
      s += `<g class="st${on ? ' on' : ''}" data-vz="st" data-tab="${st.tab}" role="button" tabindex="0" aria-label="Station ${i + 1}: ${esc(st.n)}">`;
      s += R(st.x, st.y, st.w, st.h, 'sb', 8);
      s += `<circle class="nb" cx="${st.x + 14}" cy="${st.y + 14}" r="9"/>` + T(st.x + 14, st.y + 18, i + 1, 's b mid nt');
      const iy = i === 2 ? st.y + 38 : st.y + 14;
      s += ico(st.k, cx - 18 + (i === 2 ? 0 : 6), iy);
      s += T(cx, st.y + (i === 2 ? 98 : st.h - 20), st.n, 'b mid');
      s += T(cx, st.y + (i === 2 ? 114 : st.h - 6), st.sub, 's2 m mid');
      s += '</g>';
    });
    s += T(14, 18, 'Weg der Ware: Eingang, Lager, Ausgang', 's m');
    s += T(206, 216, 'U-Form: links oben herein, links unten hinaus.', 's2 m mid');
    return svg(W, H, 'Fließbild des Warenflusses: Wareneingang, Einlagern, Lager, Kommissionieren und Versand', s);
  }

  /* ============================================================ Lagerstrategien: Chargen auf der Zeitleiste */
  /* p: {rows:[{id,ein,mhd,qty}], q, strat} */
  function batchSvg(p) {
    if (!p || !Array.isArray(p.rows) || !p.rows.length) return '';
    const okD = v => Number.isInteger(v) && v >= 1 && v <= 365;
    if (!p.rows.every(r => okD(r.ein) && okD(r.mhd) && r.mhd >= r.ein && r.qty >= 0) || !(p.q >= 0)) return '';
    const n = p.rows.length, W = 420, H = 62 + n * 46, x0 = 100, x1 = 408, X = d => x0 + (d - 1) / 364 * (x1 - x0), y0 = 40;
    const order = C.orderBatches(p.rows, p.strat), w = C.withdraw(p.rows, p.strat, p.q), take = {}; w.picks.forEach(a => { take[a.id] = a.qty; });
    let s = '';
    [1, 91, 182, 274, 365].forEach(d => { s += L(X(d), y0 - 6, X(d), H - 22, 'gr') + T(X(d), y0 - 12, 'Tag ' + d, 's2 m ' + (d === 365 ? 'end' : 'mid')); });
    p.rows.forEach((r, i) => {
      const y = y0 + i * 46, rank = order.findIndex(o => o.id === r.id) + 1, used = take[r.id] > 0;
      s += `<g class="${used ? '' : 'faded'}">`;
      s += `<circle class="${used ? 'bdg on' : 'bdg'}" cx="16" cy="${y + 12}" r="11"/>` + T(16, y + 17, rank > 0 ? rank : '–', 's b mid' + (used ? ' nt' : ''));
      s += T(34, y + 16, r.id, 'b') + T(34, y + 32, f(r.qty) + ' Stück', 's2 m');
      s += R(X(r.ein), y + 4, Math.max(3, X(r.mhd) - X(r.ein)), 16, used ? 'bar on' : 'bar', 4);
      s += `<polygon class="mk" points="${q(X(r.ein))},${y + 2} ${q(X(r.ein) + 6)},${y + 12} ${q(X(r.ein))},${y + 22}"/>` + T(X(r.mhd), y + 17, '✕', 's b mid mk2');
      { const lt = 'ein ' + C.dayStr(r.ein) + ' · Ablauf ' + C.dayStr(r.mhd), late = X(r.ein) > x1 - 150; s += T(late ? x1 : X(r.ein), y + 36, lt, 's2 m' + (late ? ' end' : '')); }
      if (used) s += T((X(r.ein) + X(r.mhd)) / 2, y + 17, '− ' + f(take[r.id]), 's b mid nt');
      s += '</g>';
    });
    s += T(8, H - 6, 'Nummer: Reihenfolge der Entnahme · blau: hier wird entnommen', 's2 m');
    return svg(W, H, 'Zeitleiste der Chargen mit Einlagertag, Ablauftag und Entnahmereihenfolge', s);
  }

  /* ============================================================ Plätze fest gegen frei */
  /* m: 3 Artikel x 4 Monate (Zahlen) */
  function placeSvg(m) {
    const pn = C.placeNeed(m); if (!pn) return '';
    const W = 420, H = 262, l = 40, r = 10, t = 22, b = 44, cols = m[0].length, ymax = Math.max(pn.fixed, pn.free, 1) * 1.1, Y = v => H - b - v / ymax * (H - t - b), bw = (W - l - r) / cols;
    const cl = ['bA', 'bB', 'bC', 'bD'], nm = 'ABCD';
    let s = '';
    const step = ymax > 40 ? 10 : ymax > 16 ? 5 : 2;
    for (let v = 0; v <= ymax; v += step) s += L(l, Y(v), W - r, Y(v), 'gr') + T(l - 6, Y(v) + 4, v, 's m end');
    s += L(l, H - b, W - r, H - b, 'ax');
    for (let j = 0; j < cols; j++) {
      let acc = 0;
      m.forEach((row, i) => { const v = row[j]; if (v > 0) { s += R(l + j * bw + bw * 0.16, Y(acc + v), bw * 0.68, Y(acc) - Y(acc + v), cl[i % 4], 0); if (Y(acc) - Y(acc + v) > 14) s += T(l + j * bw + bw / 2, (Y(acc) + Y(acc + v)) / 2 + 4, nm[i] + ' ' + f(v), 's b mid dk'); } acc += v; });
      s += T(l + j * bw + bw / 2, H - b + 16, 'Monat ' + (j + 1), 's m mid') + T(l + j * bw + bw / 2, Y(acc) - 5, f(acc), 's b mid');
    }
    s += `<line class="lf" x1="${l}" x2="${W - r}" y1="${q(Y(pn.fixed))}" y2="${q(Y(pn.fixed))}"/>` + T(W - r - 2, Y(pn.fixed) - 5, 'fest: ' + f(pn.fixed) + ' Plätze', 's b end h hi');
    s += `<line class="lr" x1="${l}" x2="${W - r}" y1="${q(Y(pn.free))}" y2="${q(Y(pn.free))}"/>` + T(l + 6, Y(pn.free) - 5, 'frei: ' + f(pn.free) + ' Plätze', 's b h ac');
    s += T(l, H - 8, 'Säule = Bestand je Monat (Paletten). Frei braucht nur die höchste Säule.', 's2 m');
    return svg(W, H, 'Säulen: Bestand je Monat und die benötigten Plätze bei fester und freier Platzwahl', s);
  }

  /* ============================================================ Regal mit Gang, Fach und Ebene */
  function rackSvg(occ) {
    const G = 2, Fa = 3, E = 3, W = 420, H = 214, cw = 52, ch = 40, x0 = [24, 232], y0 = 34, set = new Set(occ || []), nx = C.nextFreeSlot(occ || [], G, Fa, E);
    let s = '';
    for (let g = 1; g <= G; g++) {
      const xb = x0[g - 1];
      s += T(xb + Fa * cw / 2, 20, 'Gang ' + g, 'b mid');
      for (let e = E; e >= 1; e--) for (let fa = 1; fa <= Fa; fa++) {
        const id = C.slotStr(g, fa, e), x = xb + (fa - 1) * cw, y = y0 + (E - e) * ch, on = set.has(id), isNx = id === nx;
        s += R(x + 3, y + 3, cw - 6, ch - 6, 'cell' + (on ? ' on' : '') + (isNx ? ' nx' : ''), 3);
        if (on) s += T(x + cw / 2, y + ch / 2 + 4, '▮', 's mid nt'); else if (isNx) s += T(x + cw / 2, y + ch / 2 + 4, 'frei', 's b mid ok');
      }
      for (let fa = 1; fa <= Fa; fa++) s += T(xb + (fa - 1) * cw + cw / 2, y0 + E * ch + 16, 'Fach ' + fa, 's2 m mid');
      for (let e = 1; e <= E; e++) s += T(xb - 4, y0 + (E - e) * ch + ch / 2 + 4, 'E' + e, 's2 m end');
      s += R(xb - 1, y0 + E * ch, Fa * cw + 2, 3, 'rk', 0);
    }
    s += T(210, H - 6, 'Platz = Gang-Fach-Ebene, zum Beispiel ' + (nx || '01-01-1') + '. Grün: nächster freier Platz.', 's2 m mid');
    return svg(W, H, 'Zwei Regalgänge mit je drei Fächern und drei Ebenen, belegte Plätze sind gefüllt', s);
  }

  /* ============================================================ Stapler: Hebelbild */
  /* p: {m, c, e, mS, b} in kg und mm */
  function leverSvg(p) {
    if (!p || !(p.m > 0 && p.c > 0 && p.e >= 0 && p.mS > 0 && p.b > 0)) return '';
    const km = C.tipMoment(p.m, p.c, p.e), sm = C.standMoment(p.mS, p.b); if (!(km > 0) || !(sm > 0)) return '';
    const W = 420, H = 278, px = 210, by = 118, dl = p.c + p.e, sc = Math.min(150 / dl, 150 / p.b), phi = Math.max(-11, Math.min(11, (sm - km) / (sm + km) * 28)), ph = phi * Math.PI / 180;
    const rot = (x, y) => [px + (x - px) * Math.cos(ph) - (y - by) * Math.sin(ph), by + (x - px) * Math.sin(ph) + (y - by) * Math.cos(ph)];
    const lx = px - dl * sc, rx = px + p.b * sc, big = Math.max(p.m, p.mS), sz = v => 16 + 26 * Math.sqrt(v / big);
    const lp = rot(lx, by), rp = rot(rx, by), ok = sm >= km;
    let s = `<g transform="rotate(${q(phi)} ${px} ${by})"><line class="beam" x1="${q(lx - 12)}" y1="${by}" x2="${q(rx + 12)}" y2="${by}"/></g>`;
    s += `<polygon class="piv" points="${px - 16},${by + 44} ${px + 16},${by + 44} ${px},${by + 2}"/>` + T(px, by + 62, 'Vorderachse = Kippkante', 's m mid');
    const bw1 = sz(p.m), bw2 = sz(p.mS);
    s += R(lp[0] - bw1 / 2, lp[1] - bw1 - 2, bw1, bw1, 'wl', 3) + T(lp[0], lp[1] - bw1 / 2 + 3, 'Last', 's b mid dk') + arrow(lp[0], lp[1] + 2, lp[0], lp[1] + 44, 'ar1');
    s += R(rp[0] - bw2 / 2, rp[1] - bw2 - 2, bw2, bw2, 'wr', 3) + T(rp[0], rp[1] - bw2 / 2 + 3, 'Stapler', 's b mid dk') + arrow(rp[0], rp[1] + 2, rp[0], rp[1] + 44, 'ar2');
    s += T(lp[0], 22, 'Kippmoment', 's b mid', ' style="fill:var(--hi)"') + T(rp[0], 22, 'Standmoment', 's b mid', ' style="fill:var(--accent)"');
    const dy = 196, ex = px - p.e * sc;
    s += L(px, dy, ex, dy, 'dm2') + L(ex, dy, lx, dy, 'dm1') + L(px, dy - 5, px, dy + 5, 'dmt') + L(ex, dy - 5, ex, dy + 5, 'dmt') + L(lx, dy - 5, lx, dy + 5, 'dmt');
    s += T((px + ex) / 2, dy + 18, 'e ' + f(p.e), 's m mid') + T((ex + lx) / 2, dy + 18, 'c ' + f(p.c) + ' mm', 's b mid', ' style="fill:var(--hi)"');
    s += L(px, dy + 26, rx, dy + 26, 'dm3') + L(px, dy + 21, px, dy + 31, 'dmt') + L(rx, dy + 21, rx, dy + 31, 'dmt') + T((px + rx) / 2, dy + 44, 'b ' + f(p.b) + ' mm', 's b mid', ' style="fill:var(--accent)"');
    s += T(406, 270, ok ? 'Standmoment ≥ Kippmoment: steht' : 'Standmoment < Kippmoment: kippt', 's b end', ' style="fill:' + (ok ? 'var(--ok)' : 'var(--danger)') + '"');
    return svg(W, H, 'Hebelbild: Last vor der Vorderachse gegen das Eigengewicht des Staplers dahinter', s);
  }

  /* ============================================================ Inventur: Abweichung in Prozent */
  /* rows: [{n, soll, ist}] (Zahlen), blind: Soll verdeckt */
  function invSvg(rows, blind) {
    if (!Array.isArray(rows) || !rows.length) return '';
    if (blind) return svg(420, 70, 'Blindzählung: Der Sollbestand ist verdeckt', T(210, 30, 'Blindzählung: Der Sollbestand ist verdeckt.', 'b mid') + T(210, 52, 'Nach dem Aufdecken siehst du hier die Abweichungen.', 's m mid'));
    if (!rows.every(r => fin(r.soll) && fin(r.ist) && r.soll >= 0 && r.ist >= 0)) return '';
    const n = rows.length, W = 420, rh = 36, H = 54 + n * rh, cx = 262, half = 118, pct = r => (r.soll > 0 ? (r.ist - r.soll) / r.soll * 100 : (r.ist > 0 ? 100 : 0)), mx = Math.max(10, Math.max.apply(null, rows.map(r => Math.abs(pct(r))))), sc = half / mx;
    let s = L(cx, 26, cx, H - 20, 'ax') + T(cx, 20, '0 %', 's2 m mid') + T(cx - half, 20, 'Fehlbestand', 's2 b', ' style="fill:var(--danger)"') + T(cx + half, 20, 'Mehrbestand', 's2 b end', ' style="fill:var(--ok)"');
    rows.forEach((r, i) => {
      const y = 32 + i * rh, v = pct(r), d = r.ist - r.soll, w = Math.abs(v) * sc;
      s += T(8, y + 16, (r.n || 'Artikel ' + (i + 1)).slice(0, 18), 's') + T(8, y + 29, 'Soll ' + f(r.soll) + ' · Ist ' + f(r.ist), 's2 m');
      if (d === 0) s += T(cx + 6, y + 19, 'stimmt', 's2 m');
      else s += R(v < 0 ? cx - w : cx, y + 6, Math.max(2, w), 18, v < 0 ? 'neg' : 'pos', 2) + T(v < 0 ? cx + 6 : cx - 6, y + 20, (d > 0 ? '+' : '−') + f(Math.abs(d)) + ' Stk (' + (v > 0 ? '+' : '−') + f(Math.abs(v), 1) + ' %)', 's2 b' + (v < 0 ? '' : ' end'));
    });
    s += T(8, H - 6, 'Ein kleiner Saldo kann täuschen: Mehr und Fehlbestand heben sich auf.', 's2 m');
    return svg(W, H, 'Abweichung zwischen Soll- und Istbestand je Artikel in Prozent', s);
  }

  /* ============================================================ Versand: Paket mit Gurtmaß */
  /* p: {l, b, h, kg} in cm und kg */
  function parcelSvg(p) {
    if (!p) return '';
    const chk = C.parcelCheck(p.l, p.b, p.h, p.kg); if (!chk) return '';
    const W = 420, H = 258, d = [p.l, p.b, p.h].slice().sort((x, y) => y - x), a = d[0], bb = d[1], cc = d[2], s0 = Math.min(250 / (a + bb * 0.45), 96 / (cc + bb * 0.3)), ox = 56, oy = 146;
    const P = (x, y, z) => [ox + x * s0 + y * s0 * 0.45, oy - z * s0 - y * s0 * 0.3], pts = a => a.map(v => q(v[0]) + ',' + q(v[1])).join(' ');
    const col = chk.ok ? 'var(--ok)' : 'var(--danger)';
    const fr = [P(0, 0, 0), P(a, 0, 0), P(a, 0, cc), P(0, 0, cc)], tp = [P(0, 0, cc), P(a, 0, cc), P(a, bb, cc), P(0, bb, cc)], sd = [P(a, 0, 0), P(a, bb, 0), P(a, bb, cc), P(a, 0, cc)];
    let s = `<g style="--bx:${col}"><polygon class="bxf" points="${pts(fr)}"/><polygon class="bxt" points="${pts(tp)}"/><polygon class="bxs" points="${pts(sd)}"/></g>`;
    const x1 = a * 0.62, lp = [P(x1, 0, 0), P(x1, bb, 0), P(x1, bb, cc), P(x1, 0, cc)];
    s += `<polygon class="loop" points="${pts(lp)}"/>`;
    const m1 = P(a / 2, 0, 0);
    s += T(m1[0], m1[1] + 16, 'längste Seite ' + f(chk.longest) + ' cm', 's b mid');
    s += T(P(0, 0, cc / 2)[0] - 6, P(0, 0, cc / 2)[1] + 4, f(cc) + ' cm', 's2 m end') + T(P(a, bb / 2, 0)[0] + 8, P(a, bb / 2, 0)[1] + 14, f(bb) + ' cm', 's2 m');
    s += T(210, 18, 'Gurtmaß = längste Seite + Umfang (gestrichelt)', 's2 m mid');
    const gauge = (y, lab, v, mx, txt, ok) => T(14, y, lab, 's b') + R(14, y + 6, 392, 12, 'gtr', 3) + R(14, y + 6, 392 * Math.max(0.01, Math.min(1, v / mx)), 12, ok ? 'gok' : 'gbad', 3) + L(14 + 392, y + 2, 14 + 392, y + 22, 'lim') + T(406, y, txt, 's2 m end');
    s += gauge(186, 'längste Seite', chk.longest, C.PAKET.longMax, f(chk.longest) + ' von ' + f(C.PAKET.longMax) + ' cm', chk.okLong);
    s += gauge(212, 'Gurtmaß', chk.girth, C.PAKET.girthMax, f(chk.girth) + ' von ' + f(C.PAKET.girthMax) + ' cm', chk.okGirth);
    s += gauge(238, 'Gewicht', p.kg, C.PAKET.kgMax, f(p.kg, 1) + ' von ' + f(C.PAKET.kgMax, 1) + ' kg', chk.okKg);
    return svg(W, H, 'Paket als Quader mit Gurtmaß und den drei Paketgrenzen', s);
  }

  const API = { STATIONS, TAB2ST, flowSvg, batchSvg, placeSvg, rackSvg, leverSvg, invSvg, parcelSvg };
  root.WFL_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined' || !C) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = 'lm4.wfl.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const P = C.parseDe;
  const CSS = `.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:640px;margin:8px auto}
.vzbox svg{display:block;width:100%;height:auto}
.vzbox svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.vzbox svg text.s{font-size:12px}.vzbox svg text.s2{font-size:11px}.vzbox svg text.m{fill:var(--mute)}.vzbox svg text.b{font-weight:700}.vzbox svg text.mid{text-anchor:middle}.vzbox svg text.end{text-anchor:end}.vzbox svg text.dk{fill:#10151a}.vzbox svg text.nt{fill:#fff}.vzbox svg text.ok{fill:var(--ok)}
.vzbox svg text.hi{fill:var(--hi)}.vzbox svg text.ac{fill:var(--accent)}.vzbox svg text.h{paint-order:stroke;stroke:var(--panel2);stroke-width:3px;stroke-linejoin:round}.vzbox svg text.mk2{fill:var(--danger)}
.vzbox .gr{stroke:var(--line);stroke-width:.7}.vzbox .ax{stroke:var(--mute);stroke-width:1.2}
.vzbox .way{fill:none;stroke:var(--accent);stroke-width:4;stroke-dasharray:9 7;opacity:.8}.vzbox .head{fill:var(--accent)}
.vzbox .st{cursor:pointer}.vzbox .st .sb{fill:var(--panel);stroke:var(--mute);stroke-width:1.6}.vzbox .st.on .sb{fill:var(--accent);fill-opacity:.22;stroke:var(--accent);stroke-width:3}.vzbox .st:focus{outline:none}.vzbox .st:focus .sb{stroke:var(--fg);stroke-width:3}
.vzbox .nb{fill:var(--accent-bg,#1a6fd4)}.vzbox .ic{fill:none;stroke:var(--fg);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.vzbox .faded{opacity:.6}.vzbox .bdg{fill:var(--panel);stroke:var(--mute);stroke-width:1.5}.vzbox .bdg.on{fill:var(--accent-bg,#1a6fd4);stroke:var(--accent-bg,#1a6fd4)}
.vzbox .bar{fill:var(--mute);fill-opacity:.25;stroke:var(--mute);stroke-width:1.2}.vzbox .bar.on{fill:var(--accent);fill-opacity:.45;stroke:var(--accent);stroke-width:1.6}.vzbox .mk{fill:var(--fg)}
.vzbox .bA{fill:#3b9eff}.vzbox .bB{fill:#f5a524}.vzbox .bC{fill:#4cd964}.vzbox .bD{fill:#c084fc}
.vzbox .lf{stroke:var(--hi);stroke-width:2;stroke-dasharray:7 4}.vzbox .lr{stroke:var(--accent);stroke-width:2;stroke-dasharray:7 4}
.vzbox .cell{fill:none;stroke:var(--mute);stroke-width:1.3;stroke-dasharray:4 3}.vzbox .cell.on{fill:var(--accent);fill-opacity:.55;stroke:var(--accent);stroke-dasharray:none}.vzbox .cell.nx{stroke:var(--ok);stroke-width:2.5;stroke-dasharray:none}.vzbox .rk{fill:var(--mute)}
.vzbox .beam{stroke:var(--fg);stroke-width:5;stroke-linecap:round}.vzbox .piv{fill:var(--mute);fill-opacity:.7}.vzbox .wl{fill:var(--hi);fill-opacity:.75;stroke:var(--hi)}.vzbox .wr{fill:var(--accent);fill-opacity:.75;stroke:var(--accent)}
.vzbox .ar{color:var(--fg)}.vzbox .ar line{stroke:currentColor;stroke-width:3;stroke-linecap:round}.vzbox .ar polygon{fill:currentColor}.vzbox .ar.ar1{color:var(--hi)}.vzbox .ar.ar2{color:var(--accent)}
.vzbox .dm1{stroke:var(--hi);stroke-width:3}.vzbox .dm2{stroke:var(--mute);stroke-width:3}.vzbox .dm3{stroke:var(--accent);stroke-width:3}.vzbox .dmt{stroke:var(--fg);stroke-width:1.4}
.vzbox .neg{fill:var(--danger);fill-opacity:.7}.vzbox .pos{fill:var(--ok);fill-opacity:.7}
.vzbox .bxf{fill:var(--bx);fill-opacity:.35;stroke:var(--bx);stroke-width:1.8}.vzbox .bxt{fill:var(--bx);fill-opacity:.2;stroke:var(--bx);stroke-width:1.8}.vzbox .bxs{fill:var(--bx);fill-opacity:.5;stroke:var(--bx);stroke-width:1.8}.vzbox .loop{fill:none;stroke:var(--fg);stroke-width:2;stroke-dasharray:6 4}
.vzbox .gtr{fill:var(--bg);stroke:var(--line);stroke-width:1}.vzbox .gok{fill:var(--ok);fill-opacity:.75}.vzbox .gbad{fill:var(--danger);fill-opacity:.8}.vzbox .lim{stroke:var(--fg);stroke-width:1.5}
.vzcard h4{margin:0 0 8px}
details.vzflow{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:0 0 10px;padding:0 12px}
details.vzflow summary{min-height:48px;display:flex;align-items:center;font-weight:700;font-size:15px;cursor:pointer;gap:8px}
details.vzflow .fl-in{padding:0 0 12px}
.vzsteps{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}.vzsteps button{min-height:44px;padding:0 14px;border-radius:22px;background:var(--panel2);border:1px solid var(--line);font:600 13.5px system-ui;color:var(--fg)}.vzsteps button.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
@media(prefers-reduced-motion:no-preference){.vzbox .way{animation:vzflow 1.6s linear infinite}@keyframes vzflow{to{stroke-dashoffset:-32}}}`;
  const st = document.createElement('style'); st.id = 'wflviz-css'; st.textContent = CSS; document.head.appendChild(st);

  const goTab = tab => { const b = document.querySelector('.tab[data-t="' + tab + '"]'); if (b) b.click(); };
  const STEPS = [['we', '1 Wareneingang'], ['trag', '2 Einlagern (Stapler)'], ['lag', '3 Lager'], ['inv', '3 Inventur'], ['kom', '4 Kommissionieren'], ['ver', '5 Versand']];
  const V = { flowOpen: null };

  function hook(viewId, id, place, init, upd, cls) {
    const view = $(viewId); if (!view) return;
    const ensure = () => {
      let card = document.getElementById(id);
      if (!card || !view.contains(card)) { card = document.createElement(cls === 'details' ? 'details' : 'div'); card.id = id; card.className = cls === 'details' ? 'vzflow' : 'card pl vzcard'; init(card); place(view, card); }
      try { upd(card); } catch (e) {}
    };
    new MutationObserver(() => { const c = document.getElementById(id); if (!c || !view.contains(c)) ensure(); }).observe(view, { childList: true });
    ['input', 'change', 'click'].forEach(ev => view.addEventListener(ev, () => setTimeout(() => { const c = document.getElementById(id); if (c) { try { upd(c); } catch (e) {} } }, 0)));
    if (view.firstChild) ensure();
  }

  /* Fließbild oben in jedem Fachreiter (nicht in Begriffe, Aufgaben, Trainer, Beispiele, Hilfe) */
  [['we', '#weView'], ['trag', '#tragView'], ['lag', '#lagView'], ['inv', '#invView'], ['kom', '#komView'], ['ver', '#verView']].forEach(t => {
    const key = t[0], si = TAB2ST[key];
    hook(t[1], 'vzFlow_' + key, (v, c) => v.insertBefore(c, v.firstChild),
      c => {
        c.open = V.flowOpen == null ? key === 'we' : V.flowOpen;
        c.innerHTML = `<summary>🗺️ Warenfluss im Überblick · Station ${si + 1}: ${esc(STATIONS[si].n)}</summary><div class="fl-in"><div class="vzbox">${flowSvg(si)}</div><p class="hint2" style="margin:8px 0 0">${esc(STATIONS[si].info)}</p><div class="vzsteps">${STEPS.map(s => `<button data-vz="go" data-tab="${s[0]}" class="${s[0] === key ? 'on' : ''}" aria-pressed="${s[0] === key}">${esc(s[1])}</button>`).join('')}</div></div>`;
        $('summary', c).addEventListener('click', () => setTimeout(() => { V.flowOpen = c.open; }, 0));
        c.addEventListener('click', e => { const b = e.target.closest('[data-vz=go],[data-vz=st]'); if (b && b.dataset.tab && b.dataset.tab !== key) goTab(b.dataset.tab); });
        c.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const b = e.target.closest('[data-vz=st]'); if (b && b.dataset.tab !== key) { e.preventDefault(); goTab(b.dataset.tab); } });
      }, () => {}, 'details');
  });

  /* Lagerstrategien */
  const lagState = () => Object.assign({ rows: [], q: '55', strat: 'fefo', m: [], occ: [] }, lsGet('lag', {}));
  const lagRows = () => { const v = $('#lagView'), s = lagState(), rows = []; for (let i = 0; i < 4; i++) { const g = k => { const e = v.querySelector('input[data-r="' + i + '"][data-f="' + k + '"]'); return e ? P(e.value) : P((s.rows[i] || {})[k]); }; rows.push({ id: 'Charge ' + 'ABCD'[i], ein: g('ein'), mhd: g('mhd'), qty: g('qty') }); } return rows; };
  const lagMatrix = () => { const v = $('#lagView'), m = []; for (let i = 0; i < 3; i++) { m.push([]); for (let j = 0; j < 4; j++) { const e = v.querySelector('input[data-mr="' + i + '"][data-mc="' + j + '"]'); m[i].push(e ? P(e.value) : NaN); } } return m; };
  hook('#lagView', 'vzBatch', (v, c) => { const o = $('#lagOut', v); const card = o && o.closest('.card'); if (card && card.nextSibling) v.insertBefore(c, card.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Chargen auf der Zeitleiste</h4><div class="vzbox" data-vz="svg"></div>'; },
    c => { const s = lagState(), h = batchSvg({ rows: lagRows(), q: P($('#lagView input[data-k=q]') ? $('#lagView input[data-k=q]').value : s.q), strat: ($('#lagView [data-st].on') || { dataset: { st: s.strat } }).dataset.st }); $('[data-vz=svg]', c).innerHTML = h || '<p class="hint2" style="padding:12px">Gib Einlagertag, Ablauftag (1 bis 365, Ablauf nicht vor Einlagerung) und Menge ein.</p>'; });
  hook('#lagView', 'vzPlatz', (v, c) => { const o = $('#platzOut', v); const card = o && o.closest('.card'); if (card && card.nextSibling) v.insertBefore(c, card.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Plätze fest oder frei im Bild</h4><div class="vzbox" data-vz="svg"></div>'; },
    c => { const h = placeSvg(lagMatrix()); $('[data-vz=svg]', c).innerHTML = h || '<p class="hint2" style="padding:12px">Gib alle zwölf Bestände als Zahlen ein.</p>'; });
  hook('#lagView', 'vzRack', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Regal mit Gang, Fach und Ebene</h4><div class="vzbox" data-vz="svg"></div><p class="hint2">Die Anzeige folgt den Plätzen oben: Tippe dort auf einen Platz, um ihn zu belegen oder freizugeben.</p>'; },
    c => { const occ = [...document.querySelectorAll('#slotOut .slotg button.on')].map(b => b.dataset.sl); $('[data-vz=svg]', c).innerHTML = rackSvg(occ); });

  /* Stapler: Hebelbild (nach dem Traglast-Ergebnis, vor der Prüfung vor Fahrtantritt) */
  hook('#tragView', 'vzLever', (v, c) => { const o = $('#tragOut', v); if (o && o.nextSibling) v.insertBefore(c, o.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Kippmoment gegen Standmoment</h4><div class="vzbox" data-vz="svg"></div><p class="hint2" data-vz="cap"></p>'; },
    c => {
      const s = Object.assign({ m: '1600', l: '1600', c: '800', h: '3500', mS: '3600', b: '900', e: '450' }, lsGet('trag', {})), p = { m: P(s.m), c: P(s.c), e: P(s.e), mS: P(s.mS), b: P(s.b) }, h = leverSvg(p);
      $('[data-vz=svg]', c).innerHTML = h || '<p class="hint2" style="padding:12px">Gib Last, Lastschwerpunkt, Eigengewicht und Abstände (größer als 0) ein.</p>';
      $('[data-vz=cap]', c).textContent = h ? 'Wie eine Wippe: Die Last vor der Vorderachse will den Stapler nach vorn kippen, sein Eigengewicht hinter der Achse hält dagegen. Je weiter die Last vorn liegt, desto größer ihr Hebelarm. Vereinfachtes statisches Übungsmodell.' : '';
    });

  /* Inventur: Abweichung in Prozent (Blindzählung bleibt verdeckt) */
  hook('#invView', 'vzInv', (v, c) => { const first = v.querySelector('.card'); if (first && first.nextSibling) v.insertBefore(c, first.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Abweichungen im Bild</h4><div class="vzbox" data-vz="svg"></div>'; },
    c => {
      const view = $('#invView'), rows = {}; let blind = false;
      view.querySelectorAll('input[data-r][data-f]').forEach(i => { const r = (rows[i.dataset.r] = rows[i.dataset.r] || { n: i.closest('tr') ? i.closest('tr').firstElementChild.textContent.trim() : '' }); r[i.dataset.f] = P(i.value); });
      const list = Object.keys(rows).sort((a, b) => a - b).map(k => rows[k]); if (list.length && list.some(r => r.soll === undefined)) blind = true;
      $('[data-vz=svg]', c).innerHTML = invSvg(list, blind) || '<p class="hint2" style="padding:12px">Bitte Soll und Ist aller Zeilen als Zahlen eingeben.</p>';
    });

  /* Versand: Paket mit Gurtmaß */
  hook('#verView', 'vzPaket', (v, c) => { const o = $('#verOut', v); const card = o && o.closest('.card'); if (card && card.nextSibling) v.insertBefore(c, card.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Das Paket im Bild</h4><div class="vzbox" data-vz="svg"></div>'; },
    c => { const s = Object.assign({ l: '90', b: '60', h: '40', kg: '18' }, lsGet('ver', {})), h = parcelSvg({ l: P(s.l), b: P(s.b), h: P(s.h), kg: P(s.kg) }); $('[data-vz=svg]', c).innerHTML = h || '<p class="hint2" style="padding:12px">Gib Länge, Breite, Höhe und Gewicht größer als 0 ein.</p>'; });
})(typeof window !== 'undefined' ? window : globalThis);
