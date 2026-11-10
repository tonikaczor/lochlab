'use strict';
/* Tonfunk Linux-Terminal-Lab: Visualisierungen (window.LIN_VIZ bzw. module.exports). REIN SIMULIERT, reine Anzeige, inline-SVG, offline, keine Bibliothek.
   - rechte(mode):   Rechte als Bit-Raster (Besitzer/Gruppe/Andere x r/w/x mit Wertigkeit 4/2/1 und Summe)
   - umask(um):      umask als Bit-Rechnung (Start 666 bzw. 777, weggenommene Bits, Ergebnis)
   - cron(expr):     Cron-Felder als Raster (welche Minuten, Stunden, Tage, Monate, Wochentage passen) und Läufe je Stunde
   - tree(sys):      Verzeichnisbaum des virtuellen Dateisystems mit Rechten, aktuellem Ordner (cwd) und neu entstandenen Einträgen
   - pipe(sys, line): Pipe als Fluss: Zeilen nach jeder Stufe (jede Teil-Pipeline läuft auf einer Kopie des Systems, das echte System bleibt unberührt)
   - term(host, ts, line): zeichnet Baum und Pipe-Fluss in das Element host (nur im freien Terminal, NICHT in Terminal-Aufgaben: kein Lösungsverrat)
   Farben nur über die CSS-Variablen der Seite. Keine Bewegung. Aufruf-Stellen: linui.js (Hooks). */
(function (root) {
  const fin = Number.isFinite;
  const core = () => root.LIN_CORE;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  const W = 340;
  const CSS = `.lxv{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 10px 8px;margin:8px 0}
.lxv h5{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--mute);font-weight:600}
.lxv svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.lxv svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg);font-size:12px}
.lxv .mo{font-family:ui-monospace,Menlo,Consolas,monospace!important;font-size:11px}
.lxv .m{fill:var(--mute)!important}.lxv .b{font-weight:700}.lxv .sm{font-size:10.5px}
.lxv .cr{fill:var(--accent)}.lxv .cw{fill:var(--hi)}.lxv .cx{fill:var(--ok)}.lxv .co{fill:none;stroke:var(--mute);stroke-width:1.2;stroke-dasharray:2 2}
.lxv .pr{fill:var(--accent)!important}.lxv .pw{fill:var(--hi)!important}.lxv .px{fill:var(--ok)!important}.lxv .pn{fill:var(--mute)!important}
.lxv .on{fill:var(--bg)!important;font-weight:700}.lxv .cell{fill:var(--panel);stroke:var(--line);stroke-width:1}.lxv .cellon{fill:var(--accent);stroke:var(--accent)}
.lxv .rm{fill:var(--danger);opacity:.85}.lxv .hlc{fill:var(--work);stroke:var(--accent);stroke-width:1.2}.lxv .new{fill:var(--ok)!important;font-weight:700}
.lxv .ar{stroke:var(--mute);stroke-width:1.5;fill:none}.lxv .bx{fill:var(--panel);stroke:var(--line);stroke-width:1.3}.lxv .bxa{fill:var(--panel);stroke:var(--accent);stroke-width:1.8}
.lxv .dir{fill:var(--warn)}.lxv .fil{fill:none;stroke:var(--mute);stroke-width:1.3}.lxv .bar{fill:var(--accent)}.lxv .ln{stroke:var(--line);stroke-width:1}
.lxv-sc{max-height:340px;overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
.lxv-sc svg{max-width:none;min-width:300px}
.lxv-note{margin:6px 0 0;font-size:12.5px;color:var(--mute);line-height:1.4}`;
  function css() { try { if (typeof document === 'undefined' || document.getElementById('lvCss')) return; const s = document.createElement('style'); s.id = 'lvCss'; s.textContent = CSS; document.head.appendChild(s); } catch (e) {} }
  css();
  const wrap = (title, svg, note, scroll) => `<div class="lxv"><h5>${esc(title)}</h5>${scroll ? `<div class="lxv-sc">${svg}</div>` : svg}${note ? `<p class="lxv-note">${note}</p>` : ''}</div>`;
  const svgOf = (h, label, body) => `<svg viewBox="0 0 ${W} ${f(h)}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const WH = ['Besitzer (u)', 'Gruppe (g)', 'Andere (o)'], LET = ['r', 'w', 'x'], CLS = ['cr', 'cw', 'cx'];

  /* ---------- Rechte ---------- */
  function rechte(m) {
    try {
      if (!fin(m) || m < 0 || m > 0o777) return ''; css(); const C = core();
      let s = ''; const x0 = 100, cw = 58, gap = 6, rh = 44, top = 34;
      LET.forEach((l, i) => { s += `<text class="b sm" x="${x0 + i * (cw + gap) + cw / 2}" y="14" text-anchor="middle">${l} · ${[4, 2, 1][i]}</text><text class="m sm" x="${x0 + i * (cw + gap) + cw / 2}" y="27" text-anchor="middle">${['lesen', 'schreiben', 'ausführen'][i]}</text>`; });
      s += `<text class="b sm" x="${W - 8}" y="14" text-anchor="end">Summe</text>`;
      for (let r = 0; r < 3; r++) {
        const dig = (m >> (6 - 3 * r)) & 7, y = top + r * rh, parts = [];
        s += `<text class="b sm" x="8" y="${y + 24}">${WH[r]}</text>`;
        for (let i = 0; i < 3; i++) {
          const on = !!(dig & [4, 2, 1][i]), x = x0 + i * (cw + gap);
          s += on ? `<rect class="${CLS[i]}" x="${x}" y="${y + 4}" width="${cw}" height="36" rx="8"/><text class="on b" x="${x + cw / 2}" y="${y + 29}" text-anchor="middle" style="font-size:18px">${LET[i]}</text>` : `<rect class="co" x="${x + 1}" y="${y + 5}" width="${cw - 2}" height="34" rx="8"/><text class="m" x="${x + cw / 2}" y="${y + 28}" text-anchor="middle" style="font-size:16px">–</text>`;
          if (on) parts.push([4, 2, 1][i]);
        }
        s += `<text class="b" x="${W - 8}" y="${y + 20}" text-anchor="end" style="font-size:20px">${dig}</text><text class="m sm" x="${W - 8}" y="${y + 34}" text-anchor="end">${esc(parts.length ? parts.join('+') : '0')}</text>`;
      }
      const sym = C ? C.modeSym(m) : '', yy = top + 3 * rh + 22;
      s += `<text class="mo b" x="8" y="${yy}" style="font-size:15px">-${sym.split('').map((c, i) => `<tspan class="${c === '-' ? 'pn' : ['pr', 'pw', 'px'][i % 3]}">${esc(c)}</tspan>`).join('')}</text><text class="m sm" x="${W - 8}" y="${yy}" text-anchor="end">so zeigt es ls -l (Datei)</text>`;
      return wrap('Rechte als Bits', svgOf(yy + 10, 'Rechte ' + m.toString(8).padStart(3, '0') + ' als Raster: Besitzer, Gruppe, Andere mit lesen, schreiben, ausführen', s),
        'Jedes Recht ist ein Bit: lesen = 4, schreiben = 2, ausführen = 1. Die Ziffer ist die Summe. Bei einer <b>Datei</b> heißt x „als Programm starten“, bei einem <b>Ordner</b> „betreten“ (r = Inhalt auflisten, w = Einträge anlegen und löschen).');
    } catch (e) { return ''; }
  }

  /* ---------- umask ---------- */
  function umask(um) {
    try {
      if (!fin(um) || um < 0 || um > 0o777) return ''; css();
      const cs = 17, g = 2, gx = 70; let s = '', y = 4;
      const row = (label, bits, cls, mask) => {
        s += `<text class="sm ${mask ? '' : 'b'}" x="8" y="${y + 13}">${esc(label)}</text>`;
        for (let i = 0; i < 9; i++) {
          const on = !!(bits & (1 << (8 - i))), x = gx + i * (cs + g) + Math.floor(i / 3) * 7;
          s += on ? `<rect class="${cls}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="3"/>` : `<rect class="co" x="${x + .6}" y="${y + .6}" width="${cs - 1.2}" height="${cs - 1.2}" rx="3"/>`;
        }
        s += `<text class="mo sm" x="${W - 8}" y="${y + 13}" text-anchor="end">${(bits & 0o777).toString(8).padStart(3, '0')}</text>`; y += cs + 6;
      };
      [['Datei', 0o666], ['Ordner', 0o777]].forEach(b => {
        s += `<text class="b sm m" x="8" y="${y + 9}">${b[0]}</text>`; y += 14;
        row('Start', b[1], 'cr', false); row('umask nimmt weg', b[1] & um, 'rm', true); row('Ergebnis', b[1] & ~um & 0o777, 'cx', false); y += 6;
      });
      return wrap('umask als Bit-Rechnung', svgOf(y, 'umask ' + um.toString(8).padStart(3, '0') + ': welche Bits neuen Dateien und Ordnern weggenommen werden', s), 'Rot: Bits, die die umask wegnimmt. Gruppen von drei Feldern sind Besitzer, Gruppe und Andere (je r, w, x).');
    } catch (e) { return ''; }
  }

  /* ---------- Cron ---------- */
  function cron(expr) {
    try {
      const C = core(); if (!C) return ''; css(); const p = C.cronParse(expr); if (!p.ok) return '';
      const FIELDS = [['Minute', 0, 59, v => v], ['Stunde', 0, 23, v => v], ['Tag des Monats', 1, 31, v => v], ['Monat', 1, 12, v => v], ['Wochentag', 0, 6, v => v]];
      const WDN = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      let s = '', y = 4; const x0 = 8, aw = W - 16;
      FIELDS.forEach((fl, i) => {
        const vals = []; if (i === 4) [1, 2, 3, 4, 5, 6, 0].forEach(v => vals.push(v)); else for (let v = fl[1]; v <= fl[2]; v++) vals.push(v);
        const n = vals.length, cw = aw / n, st = p.sets[i], cnt = st.set.size;
        s += `<text class="b sm" x="${x0}" y="${y + 9}">${fl[0]}</text><text class="m sm" x="${W - 8}" y="${y + 9}" text-anchor="end">${st.star && cnt >= n ? 'jeder Wert' : cnt + ' von ' + n + ' Werten'}</text>`; y += 14;
        vals.forEach((v, k) => { const on = st.set.has(v), x = x0 + k * cw; s += on ? `<rect class="cr" x="${f(x + .4)}" y="${y}" width="${f(Math.max(1, cw - 0.8))}" height="16" rx="${cw > 8 ? 2.5 : 0.5}"/>` : `<rect class="cell" x="${f(x + .4)}" y="${y}" width="${f(Math.max(1, cw - 0.8))}" height="16" rx="${cw > 8 ? 2.5 : 0.5}"/>`; });
        /* Beschriftung unter dem Raster */
        const labs = i === 0 ? [0, 15, 30, 45] : i === 1 ? [0, 6, 12, 18, 23] : i === 2 ? [1, 10, 20, 31] : null;
        if (labs) labs.forEach(v => { const k = vals.indexOf(v); if (k >= 0) s += `<text class="m sm" x="${f(x0 + k * cw + cw / 2)}" y="${y + 27}" text-anchor="middle">${v}</text>`; });
        else vals.forEach((v, k) => { s += `<text class="m sm" x="${f(x0 + k * cw + cw / 2)}" y="${y + 27}" text-anchor="middle">${i === 3 ? MON[v - 1] : WDN[v]}</text>`; });
        y += 34;
      });
      /* Läufe je Stunde (nur Stunden, die passen) */
      const perH = [...Array(24).keys()].map(h => (p.sets[1].set.has(h) ? p.sets[0].set.size : 0)), mx = Math.max.apply(null, perH.concat([1]));
      s += `<text class="b sm" x="${x0}" y="${y + 9}">Läufe je Stunde (an einem passenden Tag)</text>`; y += 16;
      const bw = aw / 24, bh = 36;
      perH.forEach((c, h) => { const hh = c ? Math.max(2, bh * c / mx) : 0; if (hh) s += `<rect class="bar" x="${f(x0 + h * bw + 1)}" y="${f(y + bh - hh)}" width="${f(bw - 2)}" height="${f(hh)}" rx="1.5"/>`; });
      s += `<line class="ln" x1="${x0}" y1="${y + bh}" x2="${x0 + aw}" y2="${y + bh}"/>`;
      [0, 6, 12, 18].forEach(h => { s += `<text class="m sm" x="${f(x0 + h * bw + bw / 2)}" y="${y + bh + 12}" text-anchor="middle">${h}</text>`; });
      s += `<text class="m sm" x="${W - 8}" y="${y + 8}" text-anchor="end">höchstens ${mx}</text>`;
      y += bh + 18;
      return wrap('Wann läuft der Job?', svgOf(y, 'Cron-Felder als Raster: ' + (C.cronExplain(expr) || ''), s), 'Gefüllt: Dieser Wert passt. Der Job läuft, wenn Minute, Stunde und Monat passen und dazu Tag des Monats oder Wochentag (sind beide eingeschränkt, genügt einer der beiden).');
    } catch (e) { return ''; }
  }

  /* ---------- Verzeichnisbaum ---------- */
  const MAXC = 14, MAXROWS = 34;
  function pathsOf(sys) { const out = new Set(); (function rec(n, p) { out.add(p || '/'); if (n.t === 'd') Object.keys(n.ch).forEach(k => rec(n.ch[k], (p === '/' ? '' : p) + '/' + k)); })(sys.fs, ''); return out; }
  function tree(sys, prev) {
    try {
      const C = core(); if (!C || !sys || !sys.fs || sys.fs.t !== 'd') return ''; css();
      const cwd = String(sys.cwd || '/'), ps = cwd.split('/').filter(Boolean), onPath = new Set(['/']); let acc = '';
      ps.forEach(x => { acc += '/' + x; onPath.add(acc); });
      const rows = []; let more = 0;
      const sortKeys = n => Object.keys(n.ch).sort((a, b) => ((n.ch[a].t === 'd') === (n.ch[b].t === 'd') ? (a < b ? -1 : a > b ? 1 : 0) : n.ch[a].t === 'd' ? -1 : 1));
      (function walk(n, p, name, depth) {
        if (rows.length >= MAXROWS) { more++; return; }
        const isD = n.t === 'd', open = isD && (onPath.has(p || '/') || p === cwd);
        rows.push({ depth, name, n, p: p || '/', isD, open, kids: isD ? Object.keys(n.ch).length : 0 });
        if (open) { const keys = sortKeys(n); keys.slice(0, p === cwd || onPath.has(p || '/') ? 40 : MAXC).forEach(k => walk(n.ch[k], (p === '/' ? '' : p) + '/' + k, k, depth + 1)); }
      })(sys.fs, '', '/', 0);
      const RH = 20, h = rows.length * RH + 8; let s = '';
      rows.forEach((r, i) => {
        const y = 4 + i * RH, x = 10 + Math.min(r.depth, 7) * 13, isCwd = r.p === cwd, isNew = prev && !prev.has(r.p);
        if (isCwd) s += `<rect class="hlc" x="2" y="${y}" width="${W - 4}" height="${RH - 1}" rx="5"/>`;
        if (r.isD) s += `<path class="dir" d="M${x} ${y + 5} h5 l2 2.5 h7 v8 h-14 z"/>`; else s += `<path class="fil" d="M${x + 2} ${y + 4} h7 l4 4 v8 h-11 z"/>`;
        const nameMax = Math.max(6, Math.floor((W - 90 - x - 18) / 6.2));
        s += `<text class="sm ${r.isD ? 'b' : ''}" x="${x + 18}" y="${y + 14}">${esc(clip(r.name, nameMax))}${r.isD && r.p !== '/' ? '/' : ''}${r.isD && !r.open ? '  (' + r.kids + ')' : ''}</text>`;
        if (isNew) s += `<text class="new sm" x="${W - 82}" y="${y + 14}" text-anchor="end">neu</text>`;
        if (isCwd) s += `<text class="sm b pr" x="${W - 82}" y="${y + 14}" text-anchor="end">du bist hier</text>`;
        const sym = C.modeSym(r.n.mode);
        s += `<text class="mo" x="${W - 6}" y="${y + 14}" text-anchor="end">${r.isD ? 'd' : '-'}${sym.split('').map((c, k) => `<tspan class="${c === '-' ? 'pn' : ['pr', 'pw', 'px'][k % 3]}">${esc(c)}</tspan>`).join('')}</text>`;
      });
      return wrap('Verzeichnisbaum (virtuelles System)', svgOf(h, 'Verzeichnisbaum, aktueller Ordner ' + cwd, s), (more ? 'Der Baum ist gekürzt. ' : '') + 'Der Weg von <b>/</b> bis zu deinem Ordner ist aufgeklappt, andere Ordner sind zu (Zahl = Einträge). Rechte: <b>r</b> blau, <b>w</b> orange, <b>x</b> grün. Beim Ordner heißt x „betreten“.', true);
    } catch (e) { return ''; }
  }

  /* ---------- Pipe ---------- */
  function splitPipe(line) {
    let q = '', cur = '', parts = []; const s = String(line == null ? '' : line);
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = ''; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '|') { if (s[i + 1] === '|') return null; parts.push(cur.trim()); cur = ''; continue; }
      if (c === ';' || c === '&' || c === '>' || c === '<' || c === '`' || (c === '$' && s[i + 1] === '(')) return null;
      cur += c;
    }
    if (q) return null; parts.push(cur.trim());
    return parts.length > 1 && parts.every(Boolean) && parts.length <= 5 ? parts : null;
  }
  function clone(sys) { return JSON.parse(JSON.stringify(sys)); }
  function pipe(sys, line) {
    try {
      const C = core(); if (!C || !sys) return ''; css(); const parts = splitPipe(line); if (!parts) return '';
      const st = parts.map((cmd, i) => {
        const r = C.run(clone(sys), parts.slice(0, i + 1).join(' | ')), out = String(r.stdout || '').replace(/\n$/, ''), ls = out === '' ? [] : out.split('\n');
        return { cmd, n: ls.length, prev: ls.slice(0, 2), err: !!r.stderr && !ls.length };
      });
      const bw = W - 16, bh = 50; let y = 4, s = '';
      st.forEach((x, i) => {
        if (i > 0) { s += `<path class="ar" d="M${W / 2} ${y} v10 m-4 -4 l4 4 l4 -4"/><text class="sm m" x="${W / 2 + 12}" y="${y + 10}">${st[i - 1].n} Zeile${st[i - 1].n === 1 ? '' : 'n'} fließen weiter</text>`; y += 18; }
        s += `<rect class="${i === st.length - 1 ? 'bxa' : 'bx'}" x="8" y="${y}" width="${bw}" height="${bh}" rx="8"/><text class="mo b" x="16" y="${y + 17}">${esc(clip(x.cmd, 38))}</text><text class="sm b" x="${W - 16}" y="${y + 17}" text-anchor="end">${x.err ? 'Fehler' : x.n + ' Zeile' + (x.n === 1 ? '' : 'n')}</text>`;
        s += x.prev.length ? x.prev.map((l, k) => `<text class="mo m" x="16" y="${y + 31 + k * 13}">${esc(clip(l, 44))}</text>`).join('') : `<text class="sm m" x="16" y="${y + 33}">${x.err ? 'keine Ausgabe (Fehlermeldung)' : 'keine Ausgabe'}</text>`;
        y += bh;
      });
      return wrap('Pipe: Die Zeilen fließen von Stufe zu Stufe', svgOf(y + 6, 'Pipe mit ' + st.length + ' Stufen und der Zeilenzahl nach jeder Stufe', s), 'Jede Stufe bekommt die Ausgabe der vorigen als Eingabe (das Zeichen | verbindet sie). Gezeigt werden die Zeilenzahl und die ersten Zeilen nach jeder Stufe.');
    } catch (e) { return ''; }
  }

  /* ---------- Terminal-Bereich (Baum + Pipe) ---------- */
  function term(host, ts, line) {
    try {
      if (!host || !ts || !ts.sys) return; css();
      const cur = pathsOf(ts.sys), prev = ts._vzPrev || null; ts._vzPrev = cur;
      if (line && String(line).trim()) { const p = pipe(ts.sys, line); if (p) ts._vzPipe = p; }
      host.innerHTML = (ts._vzPipe || '') + tree(ts.sys, prev && line ? prev : null);
      const sc = host.querySelector('.lxv-sc'); if (sc) { const hl = sc.querySelector('.hlc'); if (hl && hl.getBBox) { try { const b = hl.getBBox(), svg = sc.querySelector('svg'), k = svg.getBoundingClientRect().width / W; sc.scrollTop = Math.max(0, b.y * k - 60); } catch (e) {} } }
    } catch (e) {}
  }

  const API = { rechte, umask, cron, tree, pipe, term, splitPipe, pathsOf };
  root.LIN_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  /* Die Oberfläche (linui.js) wird vor dieser Datei geladen und hat den ersten Reiter schon gezeichnet: einmal neu zeichnen, damit die Bilder erscheinen. */
  if (typeof document !== 'undefined') { try { const b = document.querySelector('#tabs .tab.on'); if (b) b.click(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
