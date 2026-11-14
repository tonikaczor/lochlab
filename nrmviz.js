'use strict';
/* Tonfunk Normen und Konformität: Visualisierungen (Lab-Kennung 'nrm'). Reine Zeichenfunktionen: liefern SVG-Text, ohne DOM, testbar mit
   node quelle/nrm/test_nrmviz.js. Die Breite W (in Pixeln) kommt von der Oberfläche; dadurch entspricht 1 Einheit im SVG einem Bildschirm-Pixel
   und die Schrift bleibt überall 14 px groß (viewBox = Breite × Höhe, Anzeige width:100%). Farben nur über CSS-Klassen der Seite
   (g-ax, g-grid, g-lab, g-c1 ... g-c4, g-box, g-on, g-okb, g-badb, g-warnb, g-dim), keine externen Ressourcen, keine Bewegung.
   Zustände werden nie nur durch Farbe gezeigt: immer zusätzlich Text oder Symbol (✓, ✗, !). */
(function (root) {
  const C = root.NRM_CORE || (typeof require === 'function' ? require('./nrmcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls, anc) => `<text class="g-lab ${cls || ''}" x="${q(x)}" y="${q(y)}"${anc ? ' text-anchor="' + anc + '"' : ''}>${esc(t)}</text>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const RC = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}" rx="${rx == null ? 8 : rx}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" width="100%" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const okW = W => (fin(W) && W >= 200 ? Math.min(W, 1200) : 320);
  const CW = 7.7;
  function wrap(s, w) {
    const maxc = Math.max(6, Math.floor(w / CW)), out = []; let cur = '';
    String(s).split(' ').forEach(wd => { if (cur && (cur + ' ' + wd).length > maxc) { out.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; });
    if (cur) out.push(cur); return out;
  }
  const LN = (x, y, arr, cls, anc, lh) => arr.map((s, i) => T(x, y + i * (lh || 19), s, cls, anc)).join('');
  /* Absatz mit Umbruch: liefert {s: SVG-Text, h: Höhe in px} */
  const para = (x, y, text, cls, w, anc) => { const ls = wrap(text, w); return { s: LN(x, y, ls, cls, anc), h: ls.length * 19 }; };
  const legend = items => '<div class="lgd">' + items.map(i => `<span class="lg"><i class="sw ${i[0]}"></i>${esc(i[1])}</span>`).join('') + '</div>';
  function arrowDown(x, y1, y2, cls) { return L(x, y1, x, y2 - 6, cls || 'g-ax') + `<polygon class="g-arr" points="${q(x)},${q(y2)} ${q(x - 5)},${q(y2 - 9)} ${q(x + 5)},${q(y2 - 9)}"/>`; }

  /* ============================================================ 1. Entscheidungsbaum Richtlinien */
  const TREE = [
    { id: 'RED', q: 'Sendet oder empfängt das Gerät absichtlich Funk?', yes: 'RED gilt (ersetzt LVD und EMV)', no: 'weiter zur nächsten Frage' },
    { id: 'MD', q: 'Ist es eine Maschine mit angetriebenen, beweglichen Teilen?', yes: 'Maschinenrichtlinie gilt', no: 'weiter zur nächsten Frage' },
    { id: 'LVD', q: 'Elektrisches Gerät mit eigener Funktion, ohne Funk und keine Maschine, 50 bis 1000 V AC oder 75 bis 1500 V DC?', yes: 'Niederspannungsrichtlinie gilt', no: 'LVD gilt nicht' },
    { id: 'EMV', q: 'Elektrisches Gerät mit eigener Funktion und ohne Funk?', yes: 'EMV-Richtlinie gilt', no: 'EMV-Richtlinie gilt nicht' },
    { id: 'ROHS', q: 'Elektrogerät mit eigener Funktion bis 1000 V AC bzw. 1500 V DC, keine Ausnahme?', yes: 'RoHS und WEEE gelten', no: 'RoHS und WEEE gelten nicht' },
    { id: 'REACH', q: 'Stoffe im Produkt (gilt immer)', yes: 'REACH gilt immer', no: '' }
  ];
  function treeSvg(p, W) {
    W = okW(W); const d = C.directives(p), by = {}; d.rows.forEach(r => { by[r.id] = r; });
    const wide = W >= 640, bw = wide ? Math.round((W - 50) * 0.56) : W - 52, px = wide ? 44 + bw + 24 : 44, pw = wide ? W - px - 8 : W - 52;
    let y = 10, body = '', first = true, lastY = 0;
    TREE.forEach((n, i) => {
      const r = by[n.id], app = r.applies, ql = wrap((i + 1) + '. ' + n.q, bw - 20), rl = wrap(r.text, bw - 20);
      const bh = 12 + ql.length * 19 + 4 + rl.length * 19 + 6, pill = (app ? 'Ja: ' : 'Nein: ') + (app ? n.yes : n.no), pl = wrap(pill, pw - 24), ph = pl.length * 19 + 14;
      const ny = y, hh = wide ? Math.max(bh, ph) : bh + ph + 10;
      body += RC(44, ny, bw, bh, 'g-box');
      body += `<circle class="g-node" cx="22" cy="${q(ny + 20)}" r="6"/>`;
      body += LN(54, ny + 24, ql, 'g-q') + LN(54, ny + 24 + ql.length * 19 + 4, rl, 'm');
      const py = wide ? ny + Math.round((bh - ph) / 2) : ny + bh + 10;
      if (wide) body += L(44 + bw, ny + bh / 2, px, ny + bh / 2, 'g-ax');
      body += RC(px, py, pw, ph, app ? 'g-okb' : 'g-dim') + LN(px + 10, py + 21, pl, app ? 'g-ok' : 'm');
      if (!first) body += arrowDown(22, lastY, ny + 14);
      lastY = ny + 26; first = false;
      y += hh + 16;
    });
    const SH = { LVD: 'LVD', EMV: 'EMV', MD: 'MD', RED: 'RED', ROHS: 'RoHS' };
    const ce = d.ce ? 'CE-Kennzeichnung nötig: ja (' + d.ceList.map(x => SH[x]).join(', ') + ')' : 'CE-Kennzeichnung nötig: nein (keine der fünf CE-pflichtigen Vorschriften gilt)';
    const cl = wrap(ce, W - 40);
    body += RC(10, y, W - 20, cl.length * 19 + 16, d.ce ? 'g-on' : 'g-box') + LN(22, y + 24, cl, 'g-q');
    return svg(W, y + cl.length * 19 + 28, 'Entscheidungsbaum der Rechtsvorschriften: ' + d.list.join(', '), body);
  }

  /* ============================================================ Kette der Konformitätsbewertung (Fortschritt) */
  function stepsSvg(done, W) {
    W = okW(W); const n = C.STEPS.length, avail = C.stepsAvailable(done), colW = (W - 24) / n;
    let b = L(12 + colW / 2, 30, 12 + colW * (n - 0.5), 30, 'g-ax');
    C.STEPS.forEach((s, i) => {
      const cx = 12 + colW * (i + 0.5), isDone = done.includes(s.id), isAv = avail.includes(s.id);
      b += `<circle class="${isDone ? 'g-okc' : isAv ? 'g-onc' : 'g-dimc'}" cx="${q(cx)}" cy="30" r="${W < 400 ? 11 : 14}"/>` + T(cx, W < 400 ? 34 : 35, isDone ? '✓' : String(i + 1), isDone ? 'g-ok' : isAv ? 'g-c1' : 'm', 'middle');
    });
    const cnt = done.length, pr = para(12, 66, cnt + ' von ' + n + ' Schritten erledigt' + (cnt === n ? ': Produkt darf in Verkehr gebracht werden' : ''), 'm', W - 24);
    return svg(W, 66 + pr.h + 4, 'Fortschritt: ' + cnt + ' von ' + n + ' Schritten der Konformitätsbewertung', b + pr.s);
  }

  /* ============================================================ 2. Schutzklassen */
  function skSvg(sel, W) {
    W = okW(W); const gap = 10, tw = (W - 2 * gap) / 3, H = 150; let b = '';
    for (let k = 1; k <= 3; k++) {
      const x = (k - 1) * (tw + gap), cx = x + tw / 2, on = sel === k;
      b += RC(x, 4, tw, H - 8, on ? 'g-on' : 'g-box');
      if (k === 1) { b += RC(cx - 28, 20, 56, 44, 'g-sym') + L(cx, 64, cx, 74, 'g-sym2') + L(cx - 14, 74, cx + 14, 74, 'g-sym2') + L(cx - 9, 80, cx + 9, 80, 'g-sym2') + L(cx - 4, 86, cx + 4, 86, 'g-sym2'); }
      else if (k === 2) { b += RC(cx - 30, 20, 60, 60, 'g-sym', 2) + RC(cx - 16, 34, 32, 32, 'g-sym', 2); }
      else { b += `<polygon class="g-sym" points="${q(cx)},${q(18)} ${q(cx + 34)},${q(52)} ${q(cx)},${q(86)} ${q(cx - 34)},${q(52)}"/>` + T(cx, 58, 'III', 'g-q', 'middle'); }
      b += T(cx, 108, 'Klasse ' + ['I', 'II', 'III'][k - 1], 'g-q', 'middle');
      const sub = ['Schutzleiter', 'Doppelquadrat', 'Kleinspannung'][k - 1]; b += T(cx, 128, sub, 'm', 'middle');
    }
    return svg(W, H, 'Schutzklassen I, II und III mit ihren Zeichen', b);
  }

  /* ============================================================ IP-Code */
  function ipSvg(a, b, W) {
    W = okW(W); const code = C.ipStr(a, b), H = 190; let s = '';
    s += T(W / 2, 30, code, 'g-big', 'middle');
    const gx = 10, gw = W - 20;
    /* erste Ziffer: 7 Felder 0 bis 6 */
    s += T(gx, 62, 'Fremdkörper und Staub (erste Ziffer)', 'm');
    const w1 = gw / 7;
    for (let i = 0; i <= 6; i++) { const on = a != null && i <= a; s += RC(gx + i * w1 + 1, 70, w1 - 2, 28, on ? 'g-okb' : 'g-box', 4) + T(gx + (i + 0.5) * w1, 90, String(i), on ? 'g-ok' : 'm', 'middle'); }
    s += T(gx, 130, 'Wasser (zweite Ziffer)', 'm');
    const w2 = gw / 10;
    for (let i = 0; i <= 9; i++) { const on = b != null && (i === b || (b <= 6 && i <= b)), sep = i === 7 || i === 9; s += RC(gx + i * w2 + (sep ? 4 : 1), 138, w2 - (sep ? 5 : 2), 28, on ? 'g-okb' : 'g-box', 4) + T(gx + (i + 0.5) * w2 + (sep ? 1.5 : 0), 158, String(i), on ? 'g-ok' : 'm', 'middle'); }
    s += T(gx + w2 * 3.5, 184, '0–6 bauen aufeinander auf', 'm', 'middle');
    return svg(W, H, 'IP-Code ' + code + ' als Skala', s);
  }

  /* ============================================================ Überspannungskategorie */
  function catSvg(uLn, cat, W) {
    W = okW(W); const vals = [4, 3, 2, 1].map(c => C.impulseV(uLn, c)); if (vals.some(v => !fin(v))) return '';
    const max = vals[0], left = 10, rowH = 58, H = 4 * rowH + 8; let s = '';
    [4, 3, 2, 1].forEach((c, i) => {
      const y = 4 + i * rowH, v = vals[i], bw = Math.max(40, (W - 30) * v / max), on = c === cat;
      s += T(left, y + 18, 'Kategorie ' + ['I', 'II', 'III', 'IV'][c - 1] + (c === 4 ? ' (Einspeisung)' : c === 3 ? ' (Festinstallation)' : c === 2 ? ' (Steckdose)' : ' (Elektronik)'), on ? 'g-q' : '');
      s += RC(left, y + 26, bw, 24, on ? 'g-barOn' : 'g-bar', 4) + T(left + bw + 6 > W - 70 ? left + bw - 6 : left + bw + 6, y + 44, f(v / 1000, 2) + ' kV', on ? 'g-q' : '', left + bw + 6 > W - 70 ? 'end' : 'start');
    });
    return svg(W, H, 'Bemessungs-Stoßspannung je Überspannungskategorie bei ' + uLn + ' V', s);
  }

  /* ============================================================ Luft- und Kriechstrecke */
  function gapSvg(res, aClr, aCrp, W) {
    W = okW(W); if (!res || !res.ok) return ''; const H0 = 130; let s = '';
    /* Schemabild: zwei Leiter auf einer Platine mit Schlitz, nicht maßstäblich */
    const x0 = W / 2 - 110, bw = 220; if (W >= 300) {
      s += RC(x0, 60, bw, 40, 'g-pcb', 4) + RC(x0 + 20, 36, 56, 24, 'g-cu', 2) + RC(x0 + bw - 76, 36, 56, 24, 'g-cu', 2) + RC(x0 + bw / 2 - 6, 60, 12, 24, 'g-slot', 0);
      s += L(x0 + 76, 36, x0 + bw - 76, 36, 'g-c1 g-dash'); s += T(x0 + bw / 2, 26, 'Luftstrecke (kürzester Weg durch Luft)', 'g-c1', 'middle');
      s += `<polyline class="g-line g-c2" points="${q(x0 + 76)},${q(60)} ${q(x0 + bw / 2 - 6)},${q(60)} ${q(x0 + bw / 2 - 6)},${q(84)} ${q(x0 + bw / 2 + 6)},${q(84)} ${q(x0 + bw / 2 + 6)},${q(60)} ${q(x0 + bw - 76)},${q(60)}"/>`;
      s += T(x0 + bw / 2, 118, 'Kriechstrecke (Weg entlang der Oberfläche)', 'g-c2', 'middle');
    } else s += T(W / 2, 40, 'Schemabild erst ab 300 px Breite', 'm', 'middle');
    const rows = [['Luftstrecke', res.clearance, aClr], ['Kriechstrecke', res.creepage, aCrp]], max = Math.max(res.clearance, res.creepage, aClr, aCrp) * 1.12, left = 10, bwMax = W - 20;
    let y = H0 + 10;
    rows.forEach(r => {
      const need = r[1], have = r[2], ok = have >= need - 1e-9, h1 = para(left, y + 16, r[0] + ': gefordert ' + f(need, 2) + ' mm, vorhanden ' + f(have, 2) + ' mm', 'g-q', W - 20);
      s += h1.s;
      const by = y + h1.h + 4;
      s += RC(left, by, bwMax * need / max, 14, 'g-barReq', 3) + RC(left, by + 18, Math.max(2, bwMax * have / max), 14, ok ? 'g-barOk' : 'g-barBad', 3);
      const h2 = para(left, by + 50, (ok ? '✓ reicht' : '✗ zu klein') + ' (oberer Balken: gefordert, unterer: vorhanden)', ok ? 'g-ok' : 'g-bad', W - 20);
      s += h2.s; y = by + 50 + h2.h + 4;
    });
    return svg(W, y + 4, 'Luftstrecke und Kriechstrecke: gefordert und vorhanden', s);
  }

  /* ============================================================ 3. Risikograph */
  function riskSvg(S, F, P, W) {
    W = okW(W); const rowH = 38, top = 36, H = top + 8 * rowH + 10, cols = [16, 0.27, 0.5, 0.73, 0.97].map((v, i) => (i === 0 ? 16 : v * (W - 12))), pad = 16;
    let s = '';
    ['Start', 'S', 'F', 'P', 'PLr'].forEach((h, i) => { s += T(i === 0 ? cols[0] : cols[i], 22, h, 'm', i === 4 ? 'end' : 'middle'); });
    const leaf = (si, fi, pi) => (si - 1) * 4 + (fi - 1) * 2 + (pi - 1), yL = i => top + i * rowH + rowH / 2;
    const yS = si => (yL(leaf(si, 1, 1)) + yL(leaf(si, 2, 2))) / 2, yF = (si, fi) => (yL(leaf(si, fi, 1)) + yL(leaf(si, fi, 2))) / 2, yStart = (yS(1) + yS(2)) / 2;
    const onS = si => S === si, onF = (si, fi) => onS(si) && F === fi, onP = (si, fi, pi) => onF(si, fi) && P === pi;
    let lines = '', nodes = '';
    const seg = (x1, y1, x2, y2, on) => { lines += L(x1, y1, x2, y2, on ? 'g-pathOn' : 'g-path'); };
    [1, 2].forEach(si => {
      seg(cols[0], yStart, cols[1], yS(si), onS(si)); nodes += T(cols[1], yS(si) + 5, 'S' + si, onS(si) ? 'g-q' : '', 'middle');
      [1, 2].forEach(fi => {
        seg(cols[1] + 14, yS(si), cols[2] - 14, yF(si, fi), onF(si, fi)); nodes += T(cols[2], yF(si, fi) + 5, 'F' + fi, onF(si, fi) ? 'g-q' : '', 'middle');
        [1, 2].forEach(pi => {
          const y = yL(leaf(si, fi, pi)); seg(cols[2] + 14, yF(si, fi), cols[3] - 14, y, onP(si, fi, pi)); nodes += T(cols[3], y + 5, 'P' + pi, onP(si, fi, pi) ? 'g-q' : '', 'middle');
          const pl = C.riskGraph(si, fi, pi), on = onP(si, fi, pi); seg(cols[3] + 14, y, cols[4] - 44, y, on);
          nodes += RC(cols[4] - 40, y - 15, 40, 28, on ? 'g-on' : 'g-box', 5) + T(cols[4] - 20, y + 5, pl, on ? 'g-q' : '', 'middle');
        });
      });
    });
    s += lines + nodes + `<circle class="g-node" cx="${q(cols[0])}" cy="${q(yStart)}" r="6"/>`;
    const pl = C.riskGraph(S, F, P);
    return svg(W, H, 'Risikograph: S' + S + ' F' + F + ' P' + P + ' ergibt PLr ' + pl, s);
  }

  /* ============================================================ PFH-Skala */
  function pfhSvg(pfh, W) {
    W = okW(W); const lo = -9, hi = -4, l = 14, r = 14, pw = W - l - r, X = v => l + (Math.log10(v) - lo) / (hi - lo) * pw;
    let s = '', y1 = 40, y2 = 104; const H = 190;
    const bands = [['e', 1e-8, 1e-7], ['d', 1e-7, 1e-6], ['c', 1e-6, 3e-6], ['b', 3e-6, 1e-5], ['a', 1e-5, 1e-4]], sils = [['3', 1e-8, 1e-7], ['2', 1e-7, 1e-6], ['1', 1e-6, 1e-5]];
    s += T(l, 22, 'Performance Level (PL)', 'm'); s += T(l, 88, 'Sicherheits-Integritätslevel (SIL)', 'm');
    const o = pfh > 0 ? C.plFromPfh(pfh) : null, so = pfh > 0 ? C.silFromPfh(pfh) : null;
    bands.forEach(b => { const on = o && o.pl === b[0] && !o.none; s += RC(X(b[1]), y1, X(b[2]) - X(b[1]), 30, on ? 'g-okb' : 'g-box', 3) + T((X(b[1]) + X(b[2])) / 2, y1 + 21, b[0], on ? 'g-ok' : 'm', 'middle'); });
    sils.forEach(b => { const on = so && so.sil === +b[0]; s += RC(X(b[1]), y2, X(b[2]) - X(b[1]), 30, on ? 'g-okb' : 'g-box', 3) + T((X(b[1]) + X(b[2])) / 2, y2 + 21, b[0], on ? 'g-ok' : 'm', 'middle'); });
    for (let e = lo; e <= hi; e++) { const x = X(Math.pow(10, e)); s += L(x, y1 - 4, x, y2 + 40, 'g-grid') + T(x, y2 + 58, '10' + String(e).replace('-', '⁻').replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]), 'm', e === lo ? 'start' : e === hi ? 'end' : 'middle'); }
    if (pfh > 0) { const v = Math.min(Math.pow(10, hi), Math.max(Math.pow(10, lo), pfh)), x = X(v); s += `<polygon class="g-mark" points="${q(x)},${y1 - 6} ${q(x - 7)},${y1 - 20} ${q(x + 7)},${y1 - 20}"/>` + L(x, y1 - 6, x, y2 + 34, 'g-markl'); }
    return svg(W, H, 'PFH-Skala mit PL-Bändern und SIL-Bändern', s);
  }

  /* ============================================================ Not-Halt-Zustände */
  function nhSvg(st, W) {
    W = okW(W); const s0 = st || C.nhInit(), c1 = !s0.b && !s0.d1, c2 = !s0.b, run = s0.st === 'LAEUFT'; let s = '';
    const lamp = (i, label, on, txt) => `<circle class="${on ? 'g-okc' : 'g-badc'}" cx="22" cy="${q(18 + i * 28)}" r="9"/>` + T(40, 23 + i * 28, label + ': ' + txt, on ? 'g-ok' : 'g-bad');
    s += lamp(0, 'Kanal 1', c1, c1 ? 'geschlossen' : 'offen') + lamp(1, 'Kanal 2', c2, c2 ? 'geschlossen' : 'offen') + lamp(2, 'Maschine', run, run ? 'läuft' : 'steht');
    const y0 = 100, bh = 44, gap = 36, bx = 10, bw = W - 20;
    const order = [['NOTHALT', 'Not-Halt wirkt'], ['WARTEN_RESET', 'wartet auf Rücksetzen'], ['BEREIT', 'bereit, wartet auf Start'], ['LAEUFT', 'Maschine läuft']], ev = ['entriegeln', 'Rücksetzen', 'Start'];
    order.forEach((o, i) => {
      const y = y0 + i * (bh + gap), on = s0.st === o[0]; s += RC(bx, y, bw, bh, on ? 'g-on' : 'g-box') + T(bx + 14, y + 27, (on ? '● ' : '') + o[1], on ? 'g-q' : '');
      if (i < 3) s += arrowDown(bx + 30, y + bh, y + bh + gap, 'g-ax') + T(bx + 44, y + bh + 23, ev[i], 'm');
    });
    const yf = y0 + 4 * (bh + gap) - 8, onF = s0.st === 'FEHLER';
    s += RC(bx, yf, bw, bh, onF ? 'g-badb' : 'g-box') + T(bx + 14, yf + 27, (onF ? '● ' : '') + 'Fehler: Kanäle uneinig, verriegelt', onF ? 'g-bad' : '');
    const nt = wrap('Not-Halt drücken stoppt aus jedem Zustand sofort. Fehler lösen sich nur über Not-Halt, Entriegeln, Rücksetzen.', W - 20);
    s += LN(bx, yf + bh + 24, nt, 'm');
    return svg(W, yf + bh + 24 + nt.length * 19 + 6, 'Zustände des Not-Halt: ' + (C.NH_TEXT[s0.st] || ''), s);
  }

  /* ============================================================ Sicherheitsabstand */
  function distSvg(d, T_, W) {
    W = okW(W); const Sd = C.safetyDistance(d, T_); if (!fin(Sd)) return ''; const H = 170, mx = Math.max(Sd, 500) * 1.08, X = v => 20 + (W - 40 - 70) * v / mx, px = X(Sd) + 0; let s = '';
    s += RC(W - 80, 30, 66, 100, 'g-box', 4) + T(W - 47, 86, 'Gefahr', 'g-c4', 'middle');
    s += RC(X(0) + 0 - 4, 30, 8, 100, 'g-curt', 2) + T(X(0) + 12, 24, 'Lichtvorhang', 'g-c1');
    s += `<circle class="g-sym" cx="${q(X(Sd))}" cy="${q(70)}" r="14"/>` + L(X(Sd), 84, X(Sd), 112, 'g-sym2') + L(X(Sd) - 14, 96, X(Sd) + 14, 96, 'g-sym2');
    s += L(X(0), 142, X(Sd), 142, 'g-ax') + L(X(0), 136, X(0), 148, 'g-ax') + L(X(Sd), 136, X(Sd), 148, 'g-ax');
    s += T((X(0) + X(Sd)) / 2, 162, 'S = ' + f(Sd, 0) + ' mm', 'g-q', 'middle');
    return svg(W, H, 'Sicherheitsabstand S = ' + f(Sd, 0) + ' mm zwischen Lichtvorhang und Gefahrstelle', s);
  }
  /* Der Lichtvorhang steht im Bild links, die Gefahrstelle rechts; die Person steht im Abstand S vom Vorhang an der Gefahrseite. */

  /* ============================================================ 4. Prüfablauf mit Messwerten */
  function pruefSvg(ev, W) {
    W = okW(W); let y = 6, s = '';
    const box = (cls, tcls, text) => { const h = para(18, y + 24, text, tcls, W - 40); s += RC(8, y, W - 16, h.h + 20, cls) + h.s; y += h.h + 30; };
    ev.steps.forEach(st => {
      if (st.applies === false) { box('g-dim', 'm', '– ' + st.name + ': ' + st.note); return; }
      const head = st.skipped ? '– ' + st.name + ': nicht mehr geprüft (Prüfung abgebrochen)' : (st.ok ? '✓ ' : '✗ ') + st.name + (st.limit == null ? ': ' + st.note : '');
      if (st.limit == null) { box(st.skipped ? 'g-dim' : st.ok ? 'g-okb' : 'g-badb', st.skipped ? 'm' : st.ok ? 'g-ok' : 'g-bad', head); return; }
      const gx = 18, gw = W - 36, cls = st.skipped ? 'g-dim' : st.ok ? 'g-okb' : 'g-badb', tc = st.skipped ? 'm' : st.ok ? 'g-ok' : 'g-bad';
      const hd = para(18, y + 24, head, tc, W - 40), info = st.skipped ? 'Messwert ' + (fin(st.value) ? f(st.value, 2) + ' ' + st.unit : '–') + ', Grenzwert ' + st.cmp + ' ' + f(st.limit, 2) + ' ' + st.unit : (fin(st.value) ? f(st.value, 2) + ' ' + st.unit : 'kein Messwert') + ' gemessen, Grenzwert ' + st.cmp + ' ' + f(st.limit, 2) + ' ' + st.unit;
      const inf = para(18, y + 24 + hd.h, info, '', W - 40), gy = y + 24 + hd.h + inf.h + 22, mid = gx + gw / 2; let pos;
      s += RC(8, y, W - 16, gy - y + 44, cls) + hd.s + inf.s;
      if (st.cmp === '≤') { pos = fin(st.value) ? gx + Math.min(2, Math.max(0, st.value / st.limit)) / 2 * gw : gx + gw; s += RC(gx, gy, gw / 2, 12, 'g-barOk', 3) + RC(mid, gy, gw / 2, 12, 'g-barBad', 3); s += T(gx, gy + 30, '0', 'm') + T(mid, gy + 30, f(st.limit, 2), 'm', 'middle') + T(gx + gw, gy + 30, f(2 * st.limit, 2), 'm', 'end'); }
      else { const lg = Math.log10(Math.max(1e-6, st.value)) - Math.log10(st.limit); pos = fin(st.value) && st.value > 0 ? gx + Math.min(1, Math.max(-1, lg)) / 2 * gw + gw / 2 : gx; s += RC(gx, gy, gw / 2, 12, 'g-barBad', 3) + RC(mid, gy, gw / 2, 12, 'g-barOk', 3); s += T(gx, gy + 30, f(st.limit / 10, 3), 'm') + T(mid, gy + 30, f(st.limit, 2), 'm', 'middle') + T(gx + gw, gy + 30, f(st.limit * 10, 2), 'm', 'end'); }
      if (!st.skipped) s += `<polygon class="g-mark" points="${q(pos)},${q(gy - 2)} ${q(pos + 7)},${q(gy - 16)} ${q(pos - 7)},${q(gy - 16)}"/>`;
      y = gy + 54;
    });
    const vl = (ev.verdict === 'bestanden' ? '✓ Prüfergebnis: bestanden' : '✗ Prüfergebnis: nicht bestanden' + (ev.failAt ? ' (bei: ' + ev.steps.find(x => x.id === ev.failAt).name + ')' : ''));
    box(ev.verdict === 'bestanden' ? 'g-on' : 'g-badb', ev.verdict === 'bestanden' ? 'g-ok' : 'g-bad', vl);
    return svg(W, y + 4, 'Prüfablauf: ' + ev.verdict, s);
  }

  /* ============================================================ 5. Prüfmittel-Zeitstrahl */
  function calSvg(items, today, W) {
    W = okW(W); const t0 = C.dayNum(today); if (!fin(t0) || !items.length) return '';
    const rows = items.map(it => { const st = C.calStatus(it.last, it.months, today), a = C.dayNum(it.last), b = C.dayNum(st.due); return { it, st, a, b }; });
    const lo = Math.min(t0 - 30, ...rows.map(r => r.a)), hi = Math.max(t0 + 60, ...rows.map(r => r.b + 20)), l = 10, pw = W - 20, X = d => l + (d - lo) / (hi - lo) * pw;
    let s = '', y = 6;
    rows.forEach(r => {
      const cls = r.st.status === 'gueltig' ? 'g-barOk' : r.st.status === 'bald' ? 'g-barWarn' : 'g-barBad', sym = r.st.status === 'gueltig' ? '✓' : r.st.status === 'bald' ? '!' : '✗';
      const h1 = para(l, y + 18, sym + ' ' + r.it.name + ': ' + C.CAL_TEXT[r.st.status], r.st.status === 'gueltig' ? 'g-ok' : r.st.status === 'bald' ? 'g-warn' : 'g-bad', W - 20);
      s += h1.s; const by = y + h1.h + 4;
      s += RC(X(r.a), by, Math.max(3, X(r.b) - X(r.a)), 14, cls, 3);
      const h2 = para(l, by + 34, 'fällig am ' + C.fmtDate(r.st.due) + (r.st.left >= 0 ? ' (noch ' + r.st.left + ' Tage)' : ' (seit ' + (-r.st.left) + ' Tagen überfällig)'), 'm', W - 20);
      s += h2.s; y = by + 34 + h2.h + 10;
    });
    s += L(X(t0), 0, X(t0), y, 'g-todayl') + T(Math.min(W - 10, Math.max(10, X(t0))), y + 18, 'heute ' + C.fmtDate(today), 'g-q', X(t0) > W * 0.7 ? 'end' : X(t0) < W * 0.15 ? 'start' : 'middle');
    return svg(W, y + 28, 'Zeitstrahl der Prüfmittel-Kalibrierung, heute ' + C.fmtDate(today), s);
  }

  /* ============================================================ PDCA */
  function pdcaSvg(sel, W) {
    W = okW(W); const gap = 28, bw = (W - 20 - gap) / 2, bh = 92, H = 2 * bh + gap + 10, pos = { P: [10, 4], D: [10 + bw + gap, 4], C: [10 + bw + gap, 4 + bh + gap], A: [10, 4 + bh + gap] }, sub = { P: 'Abschnitt 6 (Grundlage: 4, 5)', D: 'Abschnitte 7 und 8', C: 'Abschnitt 9', A: 'Abschnitt 10' }, nm = { P: 'Plan: planen', D: 'Do: durchführen', C: 'Check: prüfen', A: 'Act: handeln' };
    let s = '';
    ['P', 'D', 'C', 'A'].forEach(k => { const [x, y] = pos[k], on = sel === k; s += RC(x, y, bw, bh, on ? 'g-on' : 'g-box') + T(x + 12, y + 30, (on ? '● ' : '') + nm[k], on ? 'g-q' : 'g-q') + T(x + 12, y + 56, sub[k], 'm'); });
    s += L(10 + bw, 4 + bh / 2, 10 + bw + gap - 4, 4 + bh / 2, 'g-ax') + L(10 + bw + gap + bw / 2, 4 + bh, 10 + bw + gap + bw / 2, 4 + bh + gap - 4, 'g-ax') + L(10 + bw + gap, 4 + bh + gap + bh / 2, 10 + bw + 4, 4 + bh + gap + bh / 2, 'g-ax') + L(10 + bw / 2, 4 + bh + gap, 10 + bw / 2, 4 + bh + 4, 'g-ax');
    s += T(W / 2, 4 + bh + gap / 2 + 5, 'kontinuierliche Verbesserung', 'm', 'middle');
    return svg(W, H, 'PDCA-Kreislauf der ISO 9001', s);
  }

  const API = { wrap, legend, treeSvg, stepsSvg, skSvg, ipSvg, catSvg, gapSvg, riskSvg, pfhSvg, nhSvg, distSvg, pruefSvg, calSvg, pdcaSvg };
  root.NRM_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
