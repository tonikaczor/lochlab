'use strict';
/* Tonfunk IT-Sicherheits-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken).
   Wird in itslab.html NACH itsui.js geladen und ergänzt per MutationObserver Karten in den Werkzeug-Reitern:
   Passwörter    -> Entropie je Länge (Diagramm mit Zeitlinien der gewählten Rate), Zeitleiter, Hash-Illustration (SHA-256, Lawineneffekt, Salz)
   Verschlüsseln -> Caesar-Scheibe, Vigenère-Raster, XOR-Bitraster
   Rechte & Firewall -> rwx-Raster mit Oktalziffern, Paketweg durch die Firewall, Schutzschichten (Zwiebelmodell, antippbar)
   Backup        -> Sicherungsgrößen je Tag (inkrementell/differentiell), Reihen- und Parallelschaltung
   Aufgaben, Trainer und Beispiele bleiben absichtlich ohne Grafik (keine Lösungen verraten).
   Farben nur über CSS-Variablen; Bewegung entfällt (rein statisch). Export: window.ITS_VIZ bzw. module.exports (quelle/its/test_itsviz.js). */
(function (root) {
  const C = root.ITS_CORE || (typeof require === 'function' ? require('./itscore.js') : null);
  const D = root.ITS_DATA || (typeof require === 'function' ? (function () { try { return require('./itsdata.js'); } catch (e) { return null; } })() : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const fin = v => typeof v === 'number' && isFinite(v);
  const tw = (s, fs) => String(s).length * (fs || 11) * 0.56;
  const svg = (w, h, aria, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${body}</svg>`;

  /* ---------------------------------------------------------- SHA-256 (rein in JS, nur zur Anschauung) */
  const K256 = [], H256 = [];
  (function () {
    let n = 2, c = 0;
    while (c < 64) {
      let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
      if (p) { if (c < 8) H256[c] = (Math.pow(n, 0.5) % 1) * 4294967296 | 0; K256[c] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0; c++; }
      n++;
    }
  })();
  function utf8(s) { const out = []; for (const ch of String(s)) { let c = ch.codePointAt(0); if (c < 128) out.push(c); else if (c < 2048) out.push(192 | c >> 6, 128 | c & 63); else if (c < 65536) out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63); else out.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63); } return out; }
  function sha256(str) {
    const b = utf8(str), l = b.length; b.push(128); while (b.length % 64 !== 56) b.push(0);
    const hi = Math.floor(l * 8 / 4294967296), lo = (l * 8) >>> 0; b.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255, lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);
    const H = H256.slice(), w = new Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < b.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0, t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const hexBits = hex => hex.split('').map(ch => parseInt(ch, 16).toString(2).padStart(4, '0')).join('');

  /* Hash-Raster: 16 x 16 Bits je Hash; Zellen, die sich vom Vergleichshash unterscheiden, werden rot */
  function hashGrid(hexA, hexB, labA, labB) {
    const a = hexBits(hexA), b = hexBits(hexB), cs = 10, gx = [8, 184], top = 22; let s = '', diff = 0;
    for (let i = 0; i < 256; i++) if (a[i] !== b[i]) diff++;
    [[a, hexA, labA, null], [b, hexB, labB, a]].forEach(([bits, hex, lab, ref], g) => {
      s += `<text x="${gx[g]}" y="13" class="lb">${esc(lab)}</text>`;
      for (let i = 0; i < 256; i++) {
        const x = gx[g] + (i % 16) * cs, y = top + Math.floor(i / 16) * cs, d = ref && ref[i] !== bits[i];
        s += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" class="c ${d ? 'cD' : bits[i] === '1' ? 'cN' : 'cE'}"/>`;
      }
      s += `<text x="${gx[g]}" y="${top + 16 * cs + 14}" class="mono">${hex.slice(0, 16)}…</text>`;
    });
    return { diff, svg: svg(360, top + 16 * cs + 22, 'Zwei SHA-256-Hashes als 16 mal 16 Bits, ' + diff + ' von 256 Bit unterscheiden sich', s) };
  }

  /* ---------------------------------------------------------- Passwort: Entropie je Länge */
  const POOLS = [[10, 'Ziffern (N = 10)'], [26, 'Kleinbuchstaben (N = 26)'], [62, 'Buchstaben und Ziffern (N = 62)'], [94, 'alle vier Gruppen (N = 94)']];
  function pwChart(N, L, rate) {
    const W = 360, X0 = 40, X1 = 322, Y0 = 8, Y1 = 196, LM = 24, BM = 160;
    const x = l => X0 + (l - 1) / (LM - 1) * (X1 - X0), y = b => Y1 - Math.min(b, BM) / BM * (Y1 - Y0);
    let s = '';
    [0, 40, 80, 120, 160].forEach(b => { s += `<line x1="${X0}" y1="${f1(y(b))}" x2="${X1}" y2="${f1(y(b))}" class="gr"/><text x="${X0 - 5}" y="${f1(y(b) + 3.5)}" text-anchor="end" class="m s10">${b}</text>`; });
    [1, 4, 8, 12, 16, 20, 24].forEach(l => { s += `<text x="${f1(x(l))}" y="${Y1 + 13}" text-anchor="middle" class="m s10">${l}</text>`; });
    s += `<text x="${(X0 + X1) / 2}" y="${Y1 + 26}" text-anchor="middle" class="m s10">Länge L (Zeichen)</text><text x="6" y="${Y0 + 4}" class="m s10">Bit</text>`;
    /* Zeitlinien: mittlere Suchzeit t bei gegebener Rate -> Bit = log2(2 * rate * t) */
    if (fin(rate) && rate > 0) [[3600, '1 Stunde'], [86400 * 365, '1 Jahr'], [86400 * 365 * 1000, '1000 Jahre']].forEach(([t, n]) => {
      const b = Math.log2(2 * rate * t); if (b > 0 && b <= BM) s += `<line x1="${X0}" y1="${f1(y(b))}" x2="${X1}" y2="${f1(y(b))}" class="tl"/><text x="${X0 + 4}" y="${f1(y(b) - 3)}" class="s10 tHs">im Mittel ${n}</text>`;
    });
    POOLS.forEach(([n, lab], i) => {
      const pts = [1, LM].map(l => `${f1(x(l))},${f1(y(l * Math.log2(n)))}`).join(' ');
      s += `<polyline points="${pts}" class="ref"/><text x="${X1 + 3}" y="${f1(y(LM * Math.log2(n)) + 3.5)}" class="m s10">N=${n}</text>`;
    });
    if (fin(N) && N >= 2) {
      s += `<polyline points="${[1, LM].map(l => `${f1(x(l))},${f1(y(l * Math.log2(N)))}`).join(' ')}" class="cur"/>`;
      if (fin(L) && L >= 1 && L <= LM) { const px = x(L), py = y(L * Math.log2(N)); s += `<line x1="${f1(px)}" y1="${f1(py)}" x2="${f1(px)}" y2="${Y1}" class="drop"/><circle cx="${f1(px)}" cy="${f1(py)}" r="5" class="pt"/>`; }
    }
    return svg(W, 232, 'Entropie in Bit abhängig von der Passwortlänge für verschiedene Zeichenvorräte; die gewählte Einstellung ist hervorgehoben', s);
  }
  /* Zeitleiter (logarithmisch) mit Marke für die mittlere Suchzeit */
  const LADDER = [[1, '1 s'], [60, '1 min'], [3600, '1 h'], [86400, '1 Tag'], [31536000, '1 Jahr'], [31536000e3, '1000 J.'], [31536000e6, '1 Mio. J.']];
  function timeLadder(avgSec) {
    const L = 14, X0 = 10, X1 = 346, x = v => X0 + Math.max(0, Math.min(L, Math.log10(Math.max(v, 1)))) / L * (X1 - X0);
    let s = `<rect x="${X0}" y="28" width="${X1 - X0}" height="14" rx="4" class="trk"/>`;
    const m = fin(avgSec) ? x(avgSec) : X0, over = fin(avgSec) && avgSec > Math.pow(10, L);
    s += `<rect x="${X0}" y="28" width="${f1(Math.max(2, m - X0))}" height="14" rx="4" class="fill"/>`;
    LADDER.forEach(([v, n], i) => { const px = x(v); s += `<line x1="${f1(px)}" y1="42" x2="${f1(px)}" y2="48" class="tk"/><text x="${f1(Math.min(X1 - 10, Math.max(X0 + 10, px)))}" y="${i % 2 ? 72 : 60}" text-anchor="middle" class="m s10">${n}</text>`; });
    const lbl = !fin(avgSec) ? '' : avgSec < 1 ? 'im Mittel unter 1 Sekunde' : over ? 'im Mittel länger als 10 Billionen Jahre' : 'im Mittel: ' + C.humanTime(avgSec);
    s += `<path d="M${f1(m - 5)} 20L${f1(m + 5)} 20L${f1(m)} 27Z" class="ptr"/><text x="${f1(Math.min(X1 - tw(lbl) / 2, Math.max(X0 + tw(lbl) / 2, m)))}" y="14" text-anchor="middle" class="s11 b">${esc(lbl)}</text>`;
    return svg(360, 80, 'Zeitleiter von einer Sekunde bis zu einer Million Jahren (logarithmisch); ' + lbl, s);
  }

  /* ---------------------------------------------------------- Verschlüsseln */
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function caesarWheel(k, text) {
    const cx = 130, cy = 130, R1 = 110, R2 = 78, kk = ((Math.trunc(k) % 26) + 26) % 26;
    const pos = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 26; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    let s = `<circle cx="${cx}" cy="${cy}" r="124" class="ring"/><circle cx="${cx}" cy="${cy}" r="94" class="ring"/><circle cx="${cx}" cy="${cy}" r="62" class="ring"/>`;
    for (let i = 0; i < 26; i++) {
      const [ox, oy] = pos(i, R1), [ix, iy] = pos(i, R2), inner = ALPHA[(i + kk) % 26];
      s += `<text x="${f1(ox)}" y="${f1(oy + 4)}" text-anchor="middle" class="s12">${ALPHA[i]}</text><text x="${f1(ix)}" y="${f1(iy + 4)}" text-anchor="middle" class="s12 tNs b">${inner}</text>`;
    }
    s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="s16 b">k = ${kk}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="m s10">innen +k</text>`;
    return svg(260, 260, 'Caesar-Scheibe: außen das Alphabet, innen das um ' + kk + ' verschobene Alphabet', s);
  }
  /* Marke für den ersten Buchstaben des Textes: Kreis um äußeren und inneren Buchstaben (vor den Buchstaben zeichnen) */
  function caesarMark(k, text, dec) {
    const first = Array.from(String(text || '')).find(ch => /[A-Za-z]/.test(ch)); if (!first) return '';
    const kk = ((Math.trunc(k) % 26) + 26) % 26, L = first.toUpperCase();
    const i = dec ? (ALPHA.indexOf(L) - kk + 26) % 26 : ALPHA.indexOf(L), a = -Math.PI / 2 + i * 2 * Math.PI / 26;
    const o = [130 + 110 * Math.cos(a), 130 + 110 * Math.sin(a)], n = [130 + 78 * Math.cos(a), 130 + 78 * Math.sin(a)];
    return `<line x1="${f1(o[0])}" y1="${f1(o[1])}" x2="${f1(n[0])}" y2="${f1(n[1])}" class="lnk"/><circle cx="${f1(o[0])}" cy="${f1(o[1])}" r="10" class="mk"/><circle cx="${f1(n[0])}" cy="${f1(n[1])}" r="10" class="mk"/>`;
  }
  function caesarSvg(k, text, dec) {
    const w = caesarWheel(k, text), mk = caesarMark(k, text, dec);
    return w.replace(/(<circle cx="130" cy="130" r="62" class="ring"\/>)/, '$1' + mk);
  }
  /* Vigenère: Spalten aus Text-, Schlüssel- und Ergebnisbuchstaben (nur Buchstaben, wie im Rechenweg) */
  function vigGrid(text, key, dec) {
    const ks = C.keyShifts(key), up = Array.from(String(text || '')).filter(ch => /[A-Za-z]/.test(ch)).map(ch => ch.toUpperCase());
    if (!ks.length || !up.length) return '';
    const N = Math.min(up.length, 16), cw = 19; let s = '';
    const rows = [['Text', 'cP'], ['Schlüssel', 'cH'], ['Ergebnis', 'cB']];
    rows.forEach(([lab, cl], r) => {
      const y = 6 + r * 34; s += `<text x="4" y="${y + 17}" class="s10 m">${lab}</text>`;
      for (let i = 0; i < N; i++) {
        const kk = ks[i % ks.length], ch = r === 0 ? up[i] : r === 1 ? ALPHA[kk] : C.shiftCh(up[i], dec ? -kk : kk);
        s += `<rect x="${56 + i * cw}" y="${y}" width="${cw - 2}" height="26" rx="3" class="c ${cl}"/><text x="${56 + i * cw + (cw - 2) / 2}" y="${y + 18}" text-anchor="middle" class="s12 b">${ch}</text>`;
      }
    });
    return svg(360, 112, 'Vigenère: Text, wiederholtes Schlüsselwort und Ergebnis Buchstabe für Buchstabe', s) + (up.length > N ? '<p class="hint2">Gezeigt werden die ersten 16 Buchstaben.</p>' : '');
  }
  /* XOR: A, B und Ergebnis als Bitzellen */
  function xorGrid(a, b) {
    const r = C.xorBin(a, b); if (r == null) return '';
    a = C.cleanBin(a); b = C.cleanBin(b); const N = Math.min(a.length, 32), cw = Math.min(22, Math.floor(290 / N)); let s = '';
    [['A', a, 'cN'], ['B (Schl.)', b, 'cH'], ['A ⊕ B', r, 'cB']].forEach(([lab, bits, cl], row) => {
      const y = 6 + row * 36; s += `<text x="4" y="${y + 15}" class="s10 m">${esc(lab)}</text>`;
      for (let i = 0; i < N; i++) s += `<rect x="${64 + i * cw}" y="${y}" width="${cw - 2}" height="24" rx="3" class="c ${bits[i] === '1' ? cl : 'cE'}"/><text x="${64 + i * cw + (cw - 2) / 2}" y="${y + 16.5}" text-anchor="middle" class="bt">${bits[i]}</text>`;
    });
    return svg(360, 118, 'XOR: Spalte für Spalte ergibt 1, wenn die Bits verschieden sind', s) + (a.length > N ? '<p class="hint2">Gezeigt werden die ersten 32 Bit.</p>' : '');
  }

  /* ---------------------------------------------------------- Rechte (rwx) */
  function permGrid(perm) {
    if (!/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/.test(perm)) return '';
    const G = ['Besitzer', 'Gruppe', 'Andere']; let s = '';
    G.forEach((g, gi) => {
      const x0 = 8 + gi * 118, bits = perm.substr(gi * 3, 3), sum = [4, 2, 1].reduce((t, w, i) => t + (bits[i] !== '-' ? w : 0), 0);
      s += `<text x="${x0 + 52}" y="13" text-anchor="middle" class="s11 b">${g}</text><text x="${x0 + 52}" y="42" text-anchor="middle" class="s20 b tNs">${sum}</text>`;
      [4, 2, 1].forEach((w, i) => {
        const on = bits[i] !== '-', x = x0 + i * 36;
        s += `<rect x="${x}" y="52" width="32" height="32" rx="6" class="c ${on ? 'cN' : 'cE'}"/><text x="${x + 16}" y="74" text-anchor="middle" class="bt big">${on ? 'rwx'[i] : '−'}</text><text x="${x + 16}" y="99" text-anchor="middle" class="s10 ${on ? '' : 'm'}">${w}</text>`;
      });
    });
    return svg(360, 106, 'Dateirechte ' + perm + ' als Raster mit Wertigkeiten 4, 2, 1 und Summe je Gruppe', s);
  }

  /* ---------------------------------------------------------- Paketweg durch die Firewall */
  const LAN = '192.168.10.0/24';
  function fwPath(pk, ev) {
    const sIn = C.inNet(pk.src, LAN), dIn = C.inNet(pk.dst, LAN), allow = ev.action === 'allow', cross = sIn !== dIn;
    const cxs = sIn ? 296 : 64, xs = cross ? cxs : cxs - 28, xd = cross ? (dIn ? 296 : 64) : cxs + 28;
    let s = `<rect x="8" y="22" width="112" height="108" rx="10" class="zone"/><text x="64" y="38" text-anchor="middle" class="s11 b">Internet</text>`
      + `<rect x="240" y="22" width="112" height="108" rx="10" class="zone"/><text x="296" y="38" text-anchor="middle" class="s11 b">Firmennetz</text><text x="296" y="50" text-anchor="middle" class="m s10">${LAN}</text>`
      + `<rect x="170" y="14" width="20" height="122" rx="3" class="wall ${cross ? (allow ? 'wok' : 'wno') : 'wn'}"/><text x="180" y="150" text-anchor="middle" class="s11 b">Firewall</text>`
      + (cross ? `<text x="180" y="164" text-anchor="middle" class="s10 m">${ev.idx >= 0 ? 'Regel ' + (ev.idx + 1) : 'keine Regel: Standard'}</text>` : '');
    s += `<circle cx="${xs}" cy="82" r="8" class="srcd"/><text x="${xs}" y="104" text-anchor="middle" class="s10">${esc(pk.src)}</text>`;
    s += `<rect x="${xd - 8}" y="74" width="16" height="16" rx="3" class="dstd"/><text x="${xd}" y="${cross ? 104 : 118}" text-anchor="middle" class="s10">${esc(pk.dst)}</text>`;
    if (cross) {
      const dir = sIn ? -1 : 1, a = xs + dir * 14, stop = allow ? xd - dir * 14 : 180 - dir * 14;
      s += `<line x1="${a}" y1="82" x2="${stop}" y2="82" class="arr ${allow ? 'aok' : 'ano'}"/>`;
      s += allow ? `<path d="M${stop + dir * 4} 82l${-dir * 10} -6v12z" class="ah aok"/>` : `<path d="M172 74l16 16M188 74l-16 16" class="xx"/>`;
    } else s += `<line x1="${xs + 14}" y1="82" x2="${xd - 14}" y2="82" class="arr lnk2"/>`;
    s += `<text x="180" y="9" text-anchor="middle" class="s10 b">${esc(pk.proto.toUpperCase())} · Zielport ${esc(pk.port)}</text>`;
    return svg(360, 170, cross ? (allow ? 'Das Paket passiert die Firewall' : 'Das Paket wird an der Firewall geblockt') : 'Quelle und Ziel liegen im selben Netz', s);
  }

  /* ---------------------------------------------------------- Schutzschichten */
  const SHELLS = [
    { n: 'Mensch', full: 'Mensch und Organisation', r: 142, m: ['Schulung und Sensibilisierung', 'klare Richtlinien (z. B. für Passwörter)', 'Meldeweg für Auffälligkeiten'], a: ['Phishing-Mails', 'Social Engineering (Überreden am Telefon oder per Mail)'] },
    { n: 'Physisch', full: 'Physischer Schutz', r: 124, m: ['Zutrittskontrolle, abschließbare Serverräume und Schränke', 'Besucherregelung'], a: ['unbefugter Zutritt', 'Diebstahl von Geräten', 'Anstecken fremder Geräte an Netzdosen'] },
    { n: 'Netzgrenze', full: 'Netzgrenze (Perimeter)', r: 106, m: ['Firewall mit klaren Regeln', 'VPN für den Fernzugriff'], a: ['Portscans', 'Zugriffe von außen auf offene Dienste'] },
    { n: 'Netz', full: 'Internes Netz', r: 88, m: ['Segmentierung (z. B. VLAN, getrennte Netze)', 'Regeln zwischen den Segmenten'], a: ['Ausbreitung von Schadsoftware im Netz', 'Mitlesen von Datenverkehr'] },
    { n: 'Gerät', full: 'Gerät (Host)', r: 70, m: ['Updates einspielen', 'Virenschutz', 'Rechte sparsam vergeben'], a: ['Schadsoftware', 'Ausnutzen bekannter Sicherheitslücken'] },
    { n: 'Anwendung', full: 'Anwendung', r: 52, m: ['sichere Anmeldung', 'Eingaben prüfen', 'sichere Konfiguration'], a: ['SQL-Injection', 'Ausnutzen von Software-Fehlern', 'Erraten von Passwörtern (Brute Force)'] },
    { n: 'Daten', full: 'Daten', r: 34, m: ['Zugriffsrechte', 'Verschlüsselung', 'Backup (3-2-1-Regel)'], a: ['Datendiebstahl', 'Erpressungstrojaner (Ransomware)', 'Datenverlust'] }
  ];
  function shellsSvg(sel) {
    const cx = 170, cy = 150; let s = '';
    SHELLS.forEach((l, i) => { s += `<circle cx="${cx}" cy="${cy}" r="${l.r}" class="shell${i === sel ? ' sel' : ''}" data-nvl="${i}"/>`; });
    SHELLS.forEach((l, i) => {
      const ty = i === SHELLS.length - 1 ? cy + 4 : cy - l.r + 13;
      s += `<text x="${cx}" y="${ty}" text-anchor="middle" class="s10 b${i === sel ? ' tNs' : ''}" pointer-events="none">${esc(l.n)}</text>`;
    });
    if (sel >= 0 && SHELLS[sel]) {
      const xe = cx - SHELLS[sel].r;
      s += `<line x1="4" y1="${cy}" x2="${xe - 8}" y2="${cy}" class="arr ano"/><path d="M${xe - 14} ${cy - 7}l12 14M${xe - 2} ${cy - 7}l-12 14" class="xx" pointer-events="none"/>`;
      s += `<text x="4" y="${cy - 8}" class="s10 tDs b" pointer-events="none">Angriff</text>`;
    }
    return svg(340, 300, 'Schutzschichten wie bei einer Zwiebel: außen der Mensch, innen die Daten. Ausgewählt: ' + (SHELLS[sel] ? SHELLS[sel].full : 'keine'), s);
  }

  /* ---------------------------------------------------------- Backup */
  function backupBars(type, F, c, days) {
    if (![F, c, days].every(fin) || F < 0 || c < 0 || days < 1 || days > 14 || days !== Math.floor(days)) return '';
    const plan = C.backupPlan(type, F, Array(days).fill(c)); if (!plan) return '';
    const n = plan.sizes.length, X0 = 10, slot = 340 / n, base = 112, hMax = 92, mx = Math.max.apply(null, plan.sizes) || 1; let s = '';
    plan.sizes.forEach((v, i) => {
      const need = type === 'inc' ? true : (i === 0 || i === n - 1), h = Math.max(3, v / mx * hMax), x = X0 + i * slot;
      s += `<rect x="${f1(x + 2)}" y="${f1(base - h)}" width="${f1(slot - 4)}" height="${f1(h)}" rx="2" class="${need ? 'cN' : 'cap'} c"/>`;
      s += `<text x="${f1(x + slot / 2)}" y="${base + 13}" text-anchor="middle" class="m s10">${i === 0 ? 'V' : i}</text>`;
    });
    s += `<line x1="${X0}" y1="${base}" x2="${X0 + 340}" y2="${base}" class="tk"/><text x="${X0}" y="${base + 27}" class="m s10">V = Vollsicherung, Zahl = Tag der Sicherung</text>`;
    return svg(360, base + 32, 'Größe jeder Sicherung: ' + (type === 'inc' ? 'inkrementell' : 'differentiell'), s);
  }
  function seriesParallel(mode, a, b) {
    const box = (x, y, t, p) => `<rect x="${x}" y="${y}" width="96" height="34" rx="6" class="nd"/><text x="${x + 48}" y="${y + 14}" text-anchor="middle" class="s10 b">${t}</text><text x="${x + 48}" y="${y + 28}" text-anchor="middle" class="s10 m">${esc(p)} %</text>`;
    let s;
    if (mode === 'serial') s = `<line x1="10" y1="49" x2="60" y2="49" class="ln"/>${box(60, 32, 'Komponente 1', a)}<line x1="156" y1="49" x2="204" y2="49" class="ln"/>${box(204, 32, 'Komponente 2', b)}<line x1="300" y1="49" x2="350" y2="49" class="ln"/><text x="180" y="94" text-anchor="middle" class="s11 m">Reihe: fällt eine aus, fällt der Dienst aus</text>`;
    else s = `<line x1="10" y1="49" x2="50" y2="49" class="ln"/><path d="M50 49V24H100M50 49V74H100M196 24H250V49M196 74H250V49" class="ln fl"/>${box(100, 7, 'Komponente 1', a)}${box(100, 57, 'Komponente 2', b)}<line x1="250" y1="49" x2="350" y2="49" class="ln"/><text x="180" y="108" text-anchor="middle" class="s11 m">Parallel: nur wenn beide ausfallen, fällt der Dienst aus</text>`;
    return svg(360, 116, mode === 'serial' ? 'Zwei Komponenten in Reihe' : 'Zwei Komponenten parallel (redundant)', s);
  }

  /* ---------------------------------------------------------- Regler-Übungen (Passwortlänge, Backup-Abstand) */
  /* PRUEFEN: Übungswerte, Größenordnung: 1 Milliarde Versuche pro Sekunde; Sicherungen laufen zu festen Zeiten ab 0 Uhr im Abstand X; ein Ausfall zur vollen Stunde b verliert alles seit der letzten Sicherung */
  const SL_RATE = 1e9, SL_INT = [1, 2, 3, 4, 6, 8, 12, 24], YEAR = 31536000;
  function pwSlide(N, L) {
    if (!fin(N) || N < 2 || !fin(L) || L < 1 || L !== Math.floor(L)) return null;
    const b = C.brute(N, L, SL_RATE), e = C.entropy(N, L); return { bits: e.bits, max: b.seconds, avg: b.avgSeconds };
  }
  const pwAvg = (N, L) => { const p = pwSlide(N, L); return p ? p.avg : NaN; }, pwBits = (N, L) => { const p = pwSlide(N, L); return p ? p.bits : NaN; };
  const PW_TASKS = [
    { text: 'Stell Ziffern (N = 10) ein und wähle die Länge so, dass die Suche im Mittel länger als 1 Stunde, aber höchstens 1 Tag dauert.', test: s => s.N === 10 && pwAvg(10, s.L) > 3600 && pwAvg(10, s.L) <= 86400, set: { N: 10, L: 13 }, ok: 'Stimmt. Bei Ziffern wird die Zeit mit jeder Stelle zehnmal so lang: 13 Stellen sind etwa 1,4 Stunden, 14 Stellen etwa 14 Stunden.' },
    { text: 'Stell alle vier Zeichengruppen (N = 94) ein. Finde die kleinste Länge, bei der die Suche im Mittel länger als 100 Jahre dauert.', test: s => s.N === 94 && s.L >= 2 && pwAvg(94, s.L) > 100 * YEAR && pwAvg(94, s.L - 1) <= 100 * YEAR, set: { N: 94, L: 10 }, ok: 'Stimmt. 10 Zeichen aus allen vier Gruppen halten im Mittel mehr als 100 Jahre, bei 9 Zeichen sind es nur etwa 9 Jahre.' },
    { text: 'Stell Buchstaben und Ziffern (N = 62) ein. Finde die kleinste Länge mit mindestens 60 Bit Entropie.', test: s => s.N === 62 && s.L >= 2 && pwBits(62, s.L) >= 60 && pwBits(62, s.L - 1) < 60, set: { N: 62, L: 11 }, ok: 'Stimmt. 11 Zeichen ergeben etwa 65,5 Bit, 10 Zeichen nur etwa 59,5 Bit.' },
    { text: 'Stell nur Ziffern (N = 10) ein. Finde die kleinste Länge, bei der die Suche im Mittel mindestens 1 Jahr dauert.', test: s => s.N === 10 && s.L >= 2 && pwAvg(10, s.L) >= YEAR && pwAvg(10, s.L - 1) < YEAR, set: { N: 10, L: 17 }, ok: 'Stimmt. 17 Ziffern sind im Mittel etwa 1,6 Jahre, 16 Ziffern nur etwa 58 Tage.' },
    { text: 'Stell Kleinbuchstaben (N = 26) ein. Finde die größte Länge, bei der ein Angreifer im Mittel noch unter 1 Sekunde braucht.', test: s => s.N === 26 && pwAvg(26, s.L) < 1 && pwAvg(26, s.L + 1) >= 1, set: { N: 26, L: 6 }, ok: 'Stimmt. 6 Kleinbuchstaben fallen im Mittel in unter einer Sekunde, mit 7 sind es etwa 4 Sekunden.' }
  ];
  function pwSlideSvg(N, L) {
    const p = pwSlide(N, L); if (!p) return '';
    const X0 = 12, X1 = 318, D = 14, x = v => X0 + Math.max(0, Math.min(D, Math.log10(Math.max(v, 1)))) / D * (X1 - X0), m = x(p.avg);
    let s = `<rect x="${X0}" y="34" width="${X1 - X0}" height="14" rx="4" class="trk"/><rect x="${X0}" y="34" width="${f1(Math.max(2, m - X0))}" height="14" rx="4" class="fill"/>`;
    LADDER.forEach(([v, n], i) => { const px = x(v); s += `<line x1="${f1(px)}" y1="48" x2="${f1(px)}" y2="54" class="tk"/><text x="${f1(Math.min(X1 - 14, Math.max(X0 + 14, px)))}" y="${i % 2 ? 82 : 68}" text-anchor="middle" class="m">${n}</text>`; });
    const lbl = p.avg < 1 ? 'im Mittel unter 1 Sekunde' : p.avg > 1e14 ? 'im Mittel länger als 10 Billionen Jahre' : 'im Mittel: ' + C.humanTime(p.avg), w = tw(lbl, 12);
    s += `<path d="M${f1(m - 6)} 24L${f1(m + 6)} 24L${f1(m)} 33Z" class="ptr"/><text x="${f1(Math.min(X1 - w / 2, Math.max(X0 + w / 2, m)))}" y="16" text-anchor="middle" class="b">${esc(lbl)}</text>`;
    s += `<text x="${X0}" y="100" class="m">N = ${N}, L = ${L}: ${esc(String(C.rd(p.bits, 1)).replace('.', ','))} Bit, 1 Mrd. Versuche je Sekunde</text>`;
    return `<svg class="nvs" data-lr-buehne="verh" viewBox="0 0 330 108" role="img" aria-label="${esc('Zeitleiter von einer Sekunde bis zu einer Million Jahren (logarithmisch); ' + lbl + '; Zeichenvorrat ' + N + ', Länge ' + L)}">${s}</svg>`;
  }
  function bakSlide(X, b) {
    if (SL_INT.indexOf(X) < 0 || !fin(b) || b < 0 || b > 23 || b !== Math.floor(b)) return null;
    const last = b - b % X; return { last, loss: b - last, worst: X, perDay: 24 / X };
  }
  const BAK_TASKS = [
    { text: 'Stell den Abstand so ein, dass im schlimmsten Fall höchstens 4 Stunden Daten verloren gehen, mit möglichst wenigen Sicherungen am Tag.', test: s => s.X === 4, set: { X: 4, b: 9 }, ok: 'Stimmt. Alle 4 Stunden sind 6 Sicherungen am Tag. Kleinerer Abstand schützt besser, kostet aber mehr Sicherungen.' },
    { text: 'Die Sicherung läuft alle 6 Stunden. Stell den Ausfall so ein, dass der Datenverlust möglichst groß ist.', test: s => s.X === 6 && bakSlide(6, s.b).loss === 5, set: { X: 6, b: 5 }, ok: 'Stimmt. Kurz vor der nächsten Sicherung ist der Verlust am größten, hier 5 volle Stunden.' },
    { text: 'Stell einen Ausfall um 15 Uhr ein und wähle den Abstand so, dass genau 3 Stunden Daten verloren gehen. Mehrere Abstände passen.', test: s => s.b === 15 && bakSlide(s.X, 15).loss === 3, set: { X: 4, b: 15 }, ok: 'Stimmt. Bei 4, 6 oder 12 Stunden Abstand liegt die letzte Sicherung um 12 Uhr, nach 15 Uhr fehlen dann 3 Stunden.' },
    { text: 'Es darf höchstens 1 Stunde Daten verloren gehen. Stell den passenden Abstand ein.', test: s => s.X === 1, set: { X: 1, b: 9 }, ok: 'Stimmt. Stündlich sind 24 Sicherungen am Tag nötig. Wer noch weniger Verlust will, braucht andere Verfahren (zum Beispiel laufende Spiegelung).' }
  ];
  function bakSlideSvg(X, b) {
    const p = bakSlide(X, b); if (!p) return '';
    const X0 = 15, u = 12.5, bx = h => X0 + h * u; let s = `<rect x="${X0}" y="34" width="300" height="24" rx="4" class="trk"/>`;
    if (p.loss > 0) s += `<rect x="${f1(bx(p.last))}" y="34" width="${f1(p.loss * u)}" height="24" class="loss"/>`;
    for (let h = 0; h <= 24; h += X) s += `<line x1="${f1(bx(h))}" y1="30" x2="${f1(bx(h))}" y2="62" class="bk"/>`;
    [0, 6, 12, 18, 24].forEach(h => { s += `<text x="${f1(bx(h))}" y="78" text-anchor="middle" class="m">${h}</text>`; });
    const lbl = 'Ausfall um ' + b + ' Uhr: ' + (p.loss === 0 ? 'kein Datenverlust' : p.loss + (p.loss === 1 ? ' Stunde' : ' Stunden') + ' Daten verloren'), w = tw(lbl, 12);
    s += `<path d="M${f1(bx(b) - 6)} 18L${f1(bx(b) + 6)} 18L${f1(bx(b))} 30Z" class="fail"/><text x="${f1(Math.min(315 - w / 2, Math.max(X0 + w / 2, bx(b))))}" y="12" text-anchor="middle" class="b">${esc(lbl)}</text>`;
    s += `<text x="${X0}" y="98" class="m">Striche = Sicherungen (${p.perDay} am Tag), rot = verloren</text>`;
    return `<svg class="nvs" data-lr-buehne="verh" viewBox="0 0 330 106" role="img" aria-label="${esc('Tag von 0 bis 24 Uhr mit Sicherungen alle ' + X + ' Stunden; ' + lbl)}">${s}</svg>`;
  }

  /* ---------------------------------------------------------- Stil */
  const CSS = `
.nv svg{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0;overflow:visible}
.nv svg text{fill:var(--fg);font:11px system-ui,-apple-system,"Segoe UI",sans-serif}
.nv svg .b{font-weight:700}.nv svg .m{fill:var(--mute)}.nv svg .s10{font-size:10px}.nv svg .s11{font-size:11px}.nv svg .s12{font-size:12px}.nv svg .s16{font-size:16px}.nv svg .s20{font-size:20px}.nv svg .lb{font-size:12px;font-weight:600}
.nv svg .bt{font:600 11px ui-monospace,Menlo,Consolas,monospace}.nv svg .bt.big{font-size:16px}.nv svg .mono{font:10px ui-monospace,Menlo,Consolas,monospace}
.nv svg .tNs{fill:var(--accent)}.nv svg .tHs{fill:var(--hi)}.nv svg .tDs{fill:var(--danger)}
.nv svg .c{stroke-width:1}
.nv svg .cN{fill:var(--accent);fill-opacity:.28;stroke:var(--accent)}
.nv svg .cH{fill:var(--hi);fill-opacity:.28;stroke:var(--hi)}
.nv svg .cB{fill:var(--ok);fill-opacity:.28;stroke:var(--ok)}
.nv svg .cD{fill:var(--danger);fill-opacity:.45;stroke:var(--danger)}
.nv svg .cP{fill:var(--panel2);stroke:var(--mute)}
.nv svg .cE{fill:none;stroke:var(--line)}
.nv svg .cap{fill:none;stroke:var(--mute);stroke-dasharray:4 3}
.nv svg .gr{stroke:var(--line);stroke-width:1}.nv svg .tk{stroke:var(--mute);stroke-width:1}
.nv svg .ref{fill:none;stroke:var(--mute);stroke-width:1.5;stroke-dasharray:5 3}
.nv svg .cur{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round}
.nv svg .drop{stroke:var(--accent);stroke-width:1;stroke-dasharray:3 3}.nv svg .pt{fill:var(--accent);stroke:var(--bg);stroke-width:2}
.nv svg .tl{stroke:var(--hi);stroke-width:1;stroke-dasharray:2 3}
.nv svg .trk{fill:var(--panel2);stroke:var(--line)}.nv svg .fill{fill:var(--accent);fill-opacity:.5}.nv svg .ptr{fill:var(--fg)}
.nv svg .ring{fill:none;stroke:var(--mute);stroke-width:1}.nv svg .mk{fill:var(--accent);fill-opacity:.3;stroke:var(--accent);stroke-width:1.5}.nv svg .lnk{stroke:var(--accent);stroke-width:1.5;stroke-dasharray:3 3}
.nv svg .zone{fill:var(--panel2);stroke:var(--mute);stroke-dasharray:5 3}
.nv svg .wall{stroke-width:2}.nv svg .wn{fill:var(--panel2);stroke:var(--mute)}.nv svg .lnk2{stroke:var(--mute)}.nv svg .wok{fill:var(--ok);fill-opacity:.35;stroke:var(--ok)}.nv svg .wno{fill:var(--danger);fill-opacity:.35;stroke:var(--danger)}
.nv svg .srcd{fill:var(--accent)}.nv svg .dstd{fill:none;stroke:var(--fg);stroke-width:2}
.nv svg .arr{stroke-width:3;stroke-linecap:round}.nv svg .aok{stroke:var(--ok);fill:var(--ok)}.nv svg .ano{stroke:var(--danger)}.nv svg .ah{stroke:none}
.nv svg .xx{stroke:var(--danger);stroke-width:3;stroke-linecap:round;fill:none}
.nv svg .loop{fill:none;stroke:var(--mute);stroke-width:2;stroke-dasharray:3 3}
.nv svg .shell{fill:var(--panel);stroke:var(--mute);stroke-width:1;cursor:pointer}.nv svg .shell:nth-child(even){fill:var(--panel2)}.nv svg .shell.sel{fill:var(--accent);fill-opacity:.3;stroke:var(--accent);stroke-width:2}
.nv svg .nd{fill:var(--panel2);stroke:var(--mute)}.nv svg .ln{stroke:var(--mute);stroke-width:2;fill:none}
.nv .nvc{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.nv .nvc .chip{min-height:44px;height:auto;padding:6px 12px}
.nv .nvc .chip.on{background:var(--accent-bg);border-color:var(--accent-bg);color:#fff}
.nv .seg{margin:0 0 6px}.nv .seg button{min-height:44px}
.nv .nvx{margin:8px 0 0;font-size:14px;line-height:1.5}.nv .nvx ul{margin:2px 0 8px;padding-left:20px}.nv .nvx b{display:block;margin-top:6px}
.nv .nvk{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--mute);margin:6px 0 0}
.nv .nvk i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px;border:3px solid}
.nv .nvk .kN{border-color:var(--accent)}.nv .nvk .kH{border-color:var(--hi)}.nv .nvk .kB{border-color:var(--ok)}.nv .nvk .kD{border-color:var(--danger)}
svg.nvs{display:block;width:100%;height:auto;max-width:560px;margin:0 auto 8px;overflow:visible}
svg.nvs text{fill:var(--fg);font:12px system-ui,-apple-system,"Segoe UI",sans-serif}
svg.nvs .b{font-weight:700}svg.nvs .m{fill:var(--mute)}
svg.nvs .trk{fill:var(--panel2);stroke:var(--line)}svg.nvs .fill{fill:var(--accent);fill-opacity:.55}
svg.nvs .ptr{fill:var(--hi)}svg.nvs .tk{stroke:var(--mute);stroke-width:1.5}
svg.nvs .loss{fill:var(--danger);fill-opacity:.5}svg.nvs .bk{stroke:var(--accent);stroke-width:2.5}svg.nvs .fail{fill:var(--danger)}
.nv .seg.wr{display:flex;flex-wrap:wrap;border-radius:12px}.nv .seg.wr button{flex:1 1 45%;height:auto;min-height:44px;white-space:normal;padding:6px 10px}
.nv .nvl{margin:10px 0 4px;font-size:14px;color:var(--mute)}
.nv .slr{width:100%;min-height:44px}.nv .slv{font-weight:700}
.nv .sltask{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.nv .wgs{margin:0 0 4px;font-weight:700;font-size:15px}.nv .slq{margin:0 0 6px;font-size:15px;line-height:1.45}
@media (max-width:600px){.nv .nvk{font-size:14px}}
@media print{.nv{display:none!important}}`;

  const KEY = { N: ['kN', 'blau'], H: ['kH', 'orange'], B: ['kB', 'grün'], D: ['kD', 'rot'] };
  const key = a => `<div class="nvk">${a.map(([k, t]) => `<span><i class="${KEY[k][0]}"></i>${esc(t)}</span>`).join('')}</div>`;

  const API = { sha256, hashGrid, pwChart, timeLadder, caesarSvg, vigGrid, xorGrid, permGrid, fwPath, shellsSvg, SHELLS, backupBars, seriesParallel, pwSlide, pwSlideSvg, PW_TASKS, bakSlide, bakSlideSvg, BAK_TASKS, SL_INT, CSS, hexBits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ITS_VIZ = API;
  if (typeof document === 'undefined' || !C) return;

  /* ---------------------------------------------------------- Einbau in die Seite (nur im Browser) */
  const $ = id => document.getElementById(id);
  const fld = k => { const e = document.querySelector('[data-s="' + k + '"]'); return e ? e.value : ''; };
  const segv = k => { const e = document.querySelector('[data-seg="' + k + '"].on'); return e ? e.dataset.v : ''; };
  const st = document.createElement('style'); st.id = 'nvCss'; st.textContent = CSS; document.head.appendChild(st);
  function card(view, id, title) {
    let c = $(id), fresh = false;
    if (!c || c.parentNode !== view) { c = document.createElement('div'); c.id = id; c.className = 'card pl nv'; c.innerHTML = '<h4></h4><div class="nvb"></div>'; view.appendChild(c); fresh = true; }
    c.firstChild.textContent = title; return { c, fresh, b: c.lastChild };
  }
  const WATCHERS = [];
  function watch(viewId, build) {
    const v = $(viewId); if (!v) return null; let t = 0;
    /* Alle Beobachter ruhen, solange irgendein Aufbau läuft: mehrere watch() auf derselben Ansicht lösen sich sonst endlos gegenseitig aus */
    const run = () => { t = 0; WATCHERS.forEach(w => w.mo.disconnect()); try { build(v); } catch (e) { if (root.console) console.warn('itsviz', e); } WATCHERS.forEach(w => { w.mo.takeRecords(); w.mo.observe(w.v, { childList: true, subtree: true }); }); };
    const mo = new MutationObserver(() => { if (!t) t = setTimeout(run, 30); });
    WATCHERS.push({ mo, v }); run(); return run;
  }
  const show = (k, html) => { k.c.style.display = html ? '' : 'none'; k.b.innerHTML = html || ''; };
  const num = s => C.parseDe(s);

  /* Passwörter */
  const HS = { mode: 'one', pw: 'Lernen123' };
  function hashOut() {
    const o = $('nvHout'); if (!o) return;
    const pw = HS.pw;
    if (!pw) { o.innerHTML = '<p class="hint2">Gib ein Übungswort ein.</p>'; return; }
    let a, b, la, lb, note;
    if (HS.mode === 'one') {
      const ch = Array.from(pw), last = ch.pop(), alt = String.fromCodePoint(last.codePointAt(0) + 1);
      a = pw; b = ch.join('') + alt; la = 'Hash von „' + (pw.length > 12 ? pw.slice(0, 11) + '…' : pw) + '“'; lb = 'letztes Zeichen geändert';
      note = 'Ein einziges geändertes Zeichen verändert den Hash völlig (Lawineneffekt): etwa die Hälfte aller Bits kippt.';
    } else {
      a = 'k7q' + pw; b = 'm2z' + pw; la = 'Salz k7q + Passwort'; lb = 'Salz m2z + Passwort';
      note = 'Dasselbe Passwort ergibt mit verschiedenem Salz völlig verschiedene Hashes. So sieht man nicht, wer dasselbe Passwort nutzt, und fertige Hash-Tabellen helfen dem Angreifer nicht.';
    }
    const g = hashGrid(sha256(a), sha256(b), la, lb);
    o.innerHTML = g.svg + key([['N', 'Bit = 1'], ['D', 'Bit anders als links']]) + `<p class="hint2"><b>${g.diff} von 256 Bit</b> sind verschieden. ${esc(note)}</p>`;
  }
  watch('v_pw', v => {
    const k = card(v, 'nvPw', 'Grafik: Länge, Zeichenvorrat und Suchzeit');
    const sets = [...v.querySelectorAll('.chip.on[data-set]')].map(b => b.dataset.set), N = C.poolSize(sets), L = num(fld('pw.L')), rate = +fld('pw.rate');
    if (!N || !fin(L) || L !== Math.floor(L) || L < 1 || L > 64) show(k, '');
    else {
      const b = C.brute(N, L, rate);
      show(k, pwChart(N, L, rate) + `<div class="nvk"><span><i class="kN"></i>deine Einstellung</span><span>gestrichelt: andere Zeichenvorräte</span></div>` + (b ? timeLadder(b.avgSeconds) : '')
        + '<p class="hint2">Jedes Zeichen mehr addiert log₂(N) Bit: Die Linien steigen gleichmäßig, aber steiler bei größerem Zeichenvorrat. Die orangen Linien zeigen, wie viele Bit bei deiner Rate für die jeweilige mittlere Suchzeit nötig sind.' + (L > 24 ? ' Das Diagramm endet bei L = 24.' : '') + '</p>');
    }
    const h = card(v, 'nvHash', 'Grafik: Passwort, Hash und Salz');
    if (h.fresh) {
      h.b.innerHTML = `<p class="hint2" style="margin-top:0">Speichert ein System Passwörter richtig, legt es nur den Hash ab, nicht das Passwort. Probiere es mit einem Übungswort aus (kein echtes Passwort eingeben, nichts wird gespeichert).</p>
        <label class="f"><span>Übungswort</span><input id="nvHpw" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40" value="${esc(HS.pw)}"></label>
        <div class="seg" role="group" aria-label="Vergleich"><button data-nvm="one" class="${HS.mode === 'one' ? 'on' : ''}">1 Zeichen ändern</button><button data-nvm="salt" class="${HS.mode === 'salt' ? 'on' : ''}">Anderes Salz</button></div>
        <div id="nvHout"></div><p class="hint2">SHA-256 dient hier nur zur Anschauung. Für echte Passwörter nimmt man bewusst langsame Verfahren wie bcrypt oder Argon2.</p>`;
      hashOut();
    }
  });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'nvHpw') { HS.pw = e.target.value; hashOut(); } });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#nvHash [data-nvm]'); if (!b) return;
    HS.mode = b.dataset.nvm; [...b.parentNode.children].forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); hashOut();
  });

  /* Verschlüsseln */
  watch('v_kry', v => {
    const k = card(v, 'nvKry', 'Grafik: So läuft die Verschlüsselung ab'), mode = segv('kry.mode'), dec = segv('kry.dir') === 'dec';
    let h = '', g = '';
    if (mode === 'caesar') { const kk = num(fld('kry.key')); if (fin(kk) && kk === Math.floor(kk)) h = caesarSvg(kk, fld('kry.text'), dec) + '<p class="hint2">Außen steht das Klartext-Alphabet, innen das um k verschobene. Verschlüsseln: von außen nach innen lesen. Entschlüsseln: von innen nach außen. Der erste Buchstaben des Textes ist markiert.</p>'; }
    else if (mode === 'vig') { g = vigGrid(fld('kry.text'), fld('kry.key'), dec); if (g) h = g + '<p class="hint2">Das Schlüsselwort wird wiederholt unter den Text gelegt. Jeder Schlüsselbuchstabe gibt die Verschiebung dieser Spalte an (A = 0, B = 1, …).</p>'; }
    else { g = xorGrid(fld('kry.a'), fld('kry.b')); if (g) h = g + '<p class="hint2">Pro Spalte: gleiche Bits ergeben 0, verschiedene Bits ergeben 1.</p>'; }
    show(k, h);
  });
  /* Rechte und Firewall */
  const SS = { sel: 2 };
  const shellInfo = i => { const l = SHELLS[i]; return `<b style="margin:0">${esc(l.full)}</b><b>Schutzmaßnahmen</b><ul>${l.m.map(x => `<li>${esc(x)}</li>`).join('')}</ul><b>Typische Angriffe</b><ul>${l.a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; };
  const shellsRun = watch('v_net', v => {
    const k = card(v, 'nvPerm', 'Grafik: Rechte als Raster');
    const perm = [...v.querySelectorAll('[data-pb]')].sort((a, b) => a.dataset.pb - b.dataset.pb).map((b, i) => b.getAttribute('aria-pressed') === 'true' ? 'rwx'[i % 3] : '-').join('');
    show(k, permGrid(perm) + '<p class="hint2">Über jeder Gruppe steht die Summe der eingeschalteten Werte: r = 4, w = 2, x = 1.</p>');
    const f = card(v, 'nvFw', 'Grafik: Paketweg durch die Firewall');
    const pk = { proto: fld('net.proto'), src: fld('net.src').trim(), dst: fld('net.dst').trim(), port: num(fld('net.port')) };
    if (!D || !D.FW1 || C.ipInt(pk.src) == null || C.ipInt(pk.dst) == null || !fin(pk.port) || pk.port !== Math.floor(pk.port) || pk.port < 0 || pk.port > 65535) show(f, '');
    else {
      const ev = C.fwEval(D.FW1, pk), same = C.inNet(pk.src, LAN) === C.inNet(pk.dst, LAN);
      show(f, fwPath(pk, ev) + '<p class="hint2">Die Firewall sitzt zwischen Internet und Firmennetz. ' + (same ? 'Quelle und Ziel liegen hier im selben Netz; eine Firewall an der Netzgrenze sähe so ein Paket gar nicht. Die Übung wendet die Regeln trotzdem an.' : 'Pfeil grün: Das Paket wird durchgelassen. Rotes Kreuz: Es wird an der Firewall geblockt.') + '</p>');
    }
    const s = card(v, 'nvShell', 'Grafik: Schutzschichten (tippe auf eine Schicht)');
    if (s.fresh || !s.b.firstChild) {
      s.b.innerHTML = `<div id="nvShellSvg"></div><div class="nvc" role="group" aria-label="Schicht wählen">${SHELLS.map((l, i) => `<button class="chip" data-nvl="${i}">${esc(l.n)}</button>`).join('')}</div><div class="nvx" id="nvShellTx" aria-live="polite"></div><p class="hint2">Je mehr Schichten ein Angreifer überwinden muss, desto schwerer wird der Angriff. Fällt eine Schicht aus, halten die anderen weiter (gestaffelte Verteidigung).</p>`;
      shellsDraw();
    }
  });
  function shellsDraw() {
    const a = $('nvShellSvg'); if (!a) return;
    a.innerHTML = shellsSvg(SS.sel); $('nvShellTx').innerHTML = shellInfo(SS.sel);
    [...document.querySelectorAll('#nvShell .chip')].forEach((b, i) => { b.classList.toggle('on', i === SS.sel); b.setAttribute('aria-pressed', i === SS.sel); });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#nvShell [data-nvl]'); if (!t) return;
    SS.sel = +t.dataset.nvl; shellsDraw();
  });
  /* Backup */
  watch('v_bak', v => {
    const k = card(v, 'nvBak', 'Grafik: Sicherungen je Tag und Verfügbarkeit'), type = segv('bak.type'), comb = segv('bak.comb');
    let h = backupBars(type, num(fld('bak.F')), num(fld('bak.c')), num(fld('bak.days')));
    if (h) h += key([['N', 'für die Wiederherstellung am letzten Tag nötig']]) + '<p class="hint2">' + (type === 'inc' ? 'Inkrementell: Jede Sicherung enthält nur die Änderungen des Tages. Zum Wiederherstellen braucht man die Vollsicherung und alle Sicherungen bis zum gewünschten Tag.' : 'Differentiell: Jede Sicherung enthält alle Änderungen seit der Vollsicherung und wird täglich größer. Zum Wiederherstellen reichen die Vollsicherung und die letzte Sicherung.') + '</p>';
    const a = num(fld('bak.a')), b = num(fld('bak.b'));
    if (fin(a) && fin(b) && (comb === 'serial' || comb === 'parallel')) h += '<div style="height:8px"></div>' + seriesParallel(comb, fld('bak.a').trim(), fld('bak.b').trim());
    show(k, h);
  });
  /* Regler-Übungen: ein Block (feste Grafik und Karte) steht oben im Reiter; Zustand bleibt beim Reiterwechsel, wird nicht gespeichert */
  const SLP = { N: 26, L: 8, task: 0, shown: false }, SLB = { xi: 4, b: 9, task: 0, shown: false };
  function slSet(sv, html) { const t = document.createElement('div'); t.innerHTML = html; const n = t.firstChild; if (!n) return; sv.innerHTML = n.innerHTML; sv.setAttribute('aria-label', n.getAttribute('aria-label')); }
  function slPanel(view, o) {
    let sv = $(o.id + 'Sv'), c = $(o.id);
    if (!sv || !c || c.parentNode !== view || sv.parentNode !== view) {
      [sv, c].forEach(e => { if (e && e.parentNode) e.parentNode.removeChild(e); });
      const t = document.createElement('div'); t.innerHTML = o.svg(); sv = t.firstChild; sv.id = o.id + 'Sv';
      c = document.createElement('div'); c.id = o.id; c.className = 'card pl nv';
      c.innerHTML = `<h4>${esc(o.title)}</h4>${o.ctl}<div class="sltask"><p class="wgs" id="${o.id}H"></p><p class="slq" id="${o.id}Q"></p><div id="${o.id}F"></div><div class="nvc"><button class="btn" data-sl="tsol">Lösung zeigen</button><button class="btn" data-sl="tnext">Nächste Aufgabe ▶</button></div></div>`;
      view.insertBefore(c, view.firstChild); view.insertBefore(sv, view.firstChild);
      c.addEventListener('input', e => { const r = e.target.closest('[data-sl]'); if (!r) return; o.S.shown = false; o.input(r); slPanel(view, o); });
      c.addEventListener('click', e => {
        const b = e.target.closest('button[data-sl]'); if (!b) return; const w = b.dataset.sl;
        if (w === 'tnext') { o.S.task = (o.S.task + 1) % o.tasks.length; o.S.shown = false; }
        else if (w === 'tsol') { o.sol(o.tasks[o.S.task].set); o.S.shown = true; }
        else { o.S.shown = false; o.click(b); }
        slPanel(view, o);
      });
    }
    slSet(sv, o.svg()); o.upd(c);
    const T = o.tasks[o.S.task], ok = T.test(o.state());
    $(o.id + 'H').textContent = 'Aufgabe ' + (o.S.task + 1) + ' von ' + o.tasks.length; $(o.id + 'Q').textContent = T.text;
    $(o.id + 'F').innerHTML = ok ? `<div class="lr-fb ${o.S.shown ? 'loes' : 'ok'}" role="status"><p>${o.S.shown ? 'Lösung: ' : '✓ '}${esc(T.ok)}</p></div>` : '';
  }
  const slOn = (c, sel, fn) => c.querySelectorAll(sel).forEach(e => { const on = fn(e); e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  watch('v_pw', v => slPanel(v, {
    id: 'slPw', title: 'Regler-Übung: Passwortlänge und Suchzeit', S: SLP, tasks: PW_TASKS, state: () => SLP,
    ctl: `<p class="nvl" id="slPwL1">Zeichenvorrat</p><div class="seg wr" role="group" aria-labelledby="slPwL1">${POOLS.map(([n, l]) => `<button data-sl="pool" data-v="${n}">${esc(l)}</button>`).join('')}</div>
      <label class="f" style="margin-top:10px"><span>Länge L: <b class="slv" id="slPwV"></b> Zeichen</span><input class="slr" type="range" min="1" max="20" step="1" data-sl="L"></label>
      <p class="hint2">Übungswerte, Größenordnung: 1 Milliarde Versuche pro Sekunde, Passwort zufällig gewählt. Die Grafik oben zeigt die mittlere Suchzeit.</p>`,
    svg: () => pwSlideSvg(SLP.N, SLP.L), input: r => { SLP.L = +r.value; }, click: b => { SLP.N = +b.dataset.v; }, sol: s => { SLP.N = s.N; SLP.L = s.L; },
    upd: c => { slOn(c, '[data-sl=pool]', e => +e.dataset.v === SLP.N); const r = c.querySelector('[data-sl=L]'); if (+r.value !== SLP.L) r.value = SLP.L; $('slPwV').textContent = SLP.L; }
  }));
  watch('v_bak', v => slPanel(v, {
    id: 'slBak', title: 'Regler-Übung: Backup-Abstand und Datenverlust', S: SLB, tasks: BAK_TASKS, state: () => ({ X: SL_INT[SLB.xi], b: SLB.b }),
    ctl: `<label class="f"><span>Abstand der Sicherungen: alle <b class="slv" id="slBakX"></b> Stunden</span><input class="slr" type="range" min="0" max="${SL_INT.length - 1}" step="1" data-sl="X"></label>
      <label class="f"><span>Ausfall um <b class="slv" id="slBakB"></b> Uhr</span><input class="slr" type="range" min="0" max="23" step="1" data-sl="B"></label>
      <p class="hint2">Vereinfacht: Die Sicherungen laufen ab 0 Uhr im festen Abstand. Ein Ausfall verliert alles, was seit der letzten Sicherung neu dazukam. Der Abstand wählt nur Teiler von 24 Stunden.</p>`,
    svg: () => bakSlideSvg(SL_INT[SLB.xi], SLB.b), input: r => { if (r.dataset.sl === 'X') SLB.xi = +r.value; else SLB.b = +r.value; }, click: () => { }, sol: s => { SLB.xi = SL_INT.indexOf(s.X); SLB.b = s.b; },
    upd: c => { const x = c.querySelector('[data-sl=X]'), b = c.querySelector('[data-sl=B]'); if (+x.value !== SLB.xi) x.value = SLB.xi; if (+b.value !== SLB.b) b.value = SLB.b; $('slBakX').textContent = SL_INT[SLB.xi]; $('slBakB').textContent = SLB.b; }
  }));
})(typeof window !== 'undefined' ? window : globalThis);
