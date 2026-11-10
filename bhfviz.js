'use strict';
/* Tonfunk Berichtsheft-Helfer: Visualisierungen (Lab-Kennung 'bhf'). Datei wird in bhflab.html NACH bhfui.js geladen.
   Reine Zeichenfunktionen (liefern SVG-Text, ohne DOM, testbar mit node quelle/bhf/test_bhfviz.js) plus ein kleiner Haken,
   der die Grafiken in die vorhandenen Reiter einfügt (MutationObserver, bhfui.js bleibt unverändert):
     Tagesbericht:  Tagesband (jede Tätigkeit als Abschnitt nach ihrer Dauer, 8 h als Beispielrahmen), Schwerpunkte nach Fachbegriff, Prüfpunkte (Dauer, Fachbegriff, Zeitform, Sachlichkeit, Gelernt)
     Woche:         Säulen je Wochentag nach Fachbegriff gestapelt, Lücken (leere Tage, fehlende Dauer) sichtbar
   Datenschutz: Die Grafiken lesen nur den Entwurf, den der Helfer ohnehin lokal hält (Speicher lm4.bhf.hf und lm4.bhf.wo), und zeichnen ihn auf der Seite.
   Es wird nichts gespeichert, übertragen oder protokolliert; der Name wird nie gelesen. Aufgaben und Trainer bleiben unberührt.
   Der Helfer prüft Stil und Vollständigkeit, nicht die fachliche Richtigkeit; die Grafiken zeigen dasselbe in Bildform.
   Die 8 h sind nur ein Beispielrahmen: Arbeitszeit und Form des Ausbildungsnachweises legt der Betrieb fest.
   Farben nur über die CSS-Variablen der Seite, Bewegung nur bei prefers-reduced-motion: no-preference, kein Hover nötig. */
(function (root) {
  const C = root.BHF_CORE || (typeof require === 'function' ? require('./bhfcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hh = min => C.fmtN(min / 60, 1, true) + ' h';
  const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const DAY = 480; /* Beispielrahmen: 8 Stunden */
  const taet = a => a.items.filter(i => !i.lern);
  const hasWarn = (a, i) => a.findings.some(x => x.sev === 'warn' && x.idx.indexOf(i) >= 0);
  const firstFach = it => (it.fach && it.fach.length ? it.fach[0] : '');

  /* ============================================================ Tagesband */
  /* a: Ergebnis von BHF_CORE.analyze */
  function daySvg(a) {
    if (!a || !a.items) return '';
    const list = []; a.items.forEach((it, i) => { if (!it.lern) list.push({ i, it, min: it.dauer && fin(it.dauer.min) ? it.dauer.min : NaN }); });
    if (!list.length) return '';
    const W = 420, x0 = 14, x1 = 406, by = 44, bh = 34, total = list.reduce((s, r) => s + (fin(r.min) ? r.min : 0), 0), nMiss = list.filter(r => !fin(r.min)).length;
    const mx = Math.max(DAY, total), sc = (x1 - x0) / mx;
    let s = '', x = x0;
    list.forEach((r, k) => {
      if (!fin(r.min)) return;
      const w = Math.max(2, r.min * sc);
      s += R(x, by, w, bh, 'sg c' + (k % 5), 2);
      if (w >= 22) s += T(x + w / 2, by + bh / 2 + 5, k + 1, 's b mid dk');
      if (hasWarn(a, r.i)) s += `<circle class="wd" cx="${q(x + Math.min(w, 14) / 2)}" cy="${by - 7}" r="4"/>`;
      x += w;
    });
    if (total < DAY) s += R(x, by, x1 - x, bh, 'rest', 2);
    s += R(x0, by, x1 - x0, bh, 'frame', 2);
    const lx = x0 + DAY * sc; s += L(lx, by - 6, lx, by + bh + 6, 'lim');
    s += T(14, 18, 'Dein Arbeitstag nach erfasster Dauer', 's b') + T(406, 18, 'gestrichelt: 8 h (Beispiel)', 's2 m end');
    s += T(14, by + bh + 20, '0 h', 's2 m') + T(406, by + bh + 20, hh(mx), 's2 m end');
    s += T(210, by + bh + 20, total ? 'erfasst: ' + hh(total) + (total < DAY ? ' · offen: ' + hh(DAY - total) : '') : 'noch keine Dauer erfasst', 's2 b mid');
    const rows = list.slice(0, 8), ly = by + bh + 44;
    rows.forEach((r, k) => {
      const y = ly + k * 20;
      s += R(14, y - 10, 12, 12, fin(r.min) ? 'sg c' + (k % 5) : 'sg nod', 2) + T(32, y, (k + 1) + '. ' + cut(r.it.text.replace(/\s*\([^)]*\)\s*$/, ''), 34) + (hasWarn(a, r.i) ? ' ⚠' : ''), 's2');
      s += T(406, y, fin(r.min) ? C.fmtDauer(r.min) : 'Dauer fehlt', 's2 end' + (fin(r.min) ? ' m' : ' wn'));
    });
    if (list.length > rows.length) s += T(32, ly + rows.length * 20, '… und ' + (list.length - rows.length) + ' weitere', 's2 m');
    const H = ly + Math.min(list.length, 9) * 20 + (nMiss ? 4 : 0) + 4;
    return svg(W, H, 'Tagesband: jede Tätigkeit als Abschnitt entsprechend ihrer Dauer', s);
  }

  /* Schwerpunkte nach Fachbegriff (Minuten) */
  function fachSvg(a) {
    if (!a || !a.items) return '';
    const by = {}; taet(a).forEach(it => { if (!(it.dauer && fin(it.dauer.min))) return; const k = firstFach(it); if (!k) return; const key = k.toLowerCase(); by[key] = by[key] || { n: k, min: 0 }; by[key].min += it.dauer.min; });
    const rows = Object.keys(by).map(k => by[k]).sort((x, y) => y.min - x.min).slice(0, 6); if (!rows.length) return '';
    const W = 420, x0 = 118, x1 = 360, mx = rows[0].min, H = 16 + rows.length * 30;
    let s = '';
    rows.forEach((r, i) => { const y = 8 + i * 30, w = Math.max(3, r.min / mx * (x1 - x0)); s += T(x0 - 8, y + 18, cut(r.n, 16), 's end') + R(x0, y + 4, w, 20, 'sg c' + (i % 5), 3) + T(x0 + w + 6, y + 19, hh(r.min), 's2 b'); });
    return svg(W, H, 'Schwerpunkte nach Fachbegriff in Stunden', s);
  }

  /* Prüfpunkte als Liste: [{k, ok, label, hint}] */
  function checks(a) {
    if (!a || !a.items) return [];
    const t = taet(a); if (!t.length) return [];
    const dauerOk = t.every(i => i.dauer && fin(i.dauer.min)), fachOk = t.every(i => i.fach && i.fach.length), zeitOk = !a.tense.mixed;
    const sach = !t.some(i => i.flags.some(f => f === 'vage' || f === 'wertung' || f === 'ich'));
    const g = a.gelernt, gelOk = !!g && g.flags.length === 0 && g.words > 0;
    return [
      { k: 'dauer', ok: dauerOk, label: 'Dauer bei jeder Tätigkeit' }, { k: 'fach', ok: fachOk, label: 'Fachbegriff genannt' }, { k: 'zeit', ok: zeitOk, label: 'Zeitform einheitlich' },
      { k: 'sach', ok: sach, label: 'sachlich, konkret, ohne „ich“' }, { k: 'gel', ok: gelOk, label: 'Gelernt konkret' }
    ];
  }
  const checksHtml = a => { const c = checks(a); return c.length ? '<ul class="vzchk">' + c.map(x => `<li class="${x.ok ? 'ok' : 'wn'}"><span aria-hidden="true">${x.ok ? '✓' : '!'}</span> ${esc(x.label)}<span class="vzsr"> (${x.ok ? 'erfüllt' : 'noch offen'})</span></li>`).join('') + '</ul>' : ''; };
  const dayViz = a => { const d = daySvg(a); if (!d) return ''; const f = fachSvg(a); return `<div class="vzbox">${d}</div>` + checksHtml(a) + (f ? `<h4 style="margin:12px 0 4px">Schwerpunkte nach Fachbegriff</h4><div class="vzbox">${f}</div>` : ''); };

  /* ============================================================ Woche */
  /* days: 5 Texte, beruf: Berufskennung */
  function weekSvg(days, beruf) {
    if (!Array.isArray(days) || !days.length) return '';
    const an = days.map(t => C.analyze(t, beruf)), tot = {}, names = {};
    an.forEach(a => taet(a).forEach(it => { if (it.dauer && fin(it.dauer.min)) { const k = firstFach(it); const key = k ? k.toLowerCase() : ''; if (k) names[key] = k; tot[key] = (tot[key] || 0) + it.dauer.min; } }));
    const keys = Object.keys(tot).filter(k => k).sort((x, y) => tot[y] - tot[x] || (x < y ? -1 : 1)), top = keys.slice(0, 4), cls = {}; top.forEach((k, i) => { cls[k] = 'c' + i; });
    const colOf = k => cls[k] || 'c4';
    const sums = an.map(a => taet(a).reduce((s, it) => s + (it.dauer && fin(it.dauer.min) ? it.dauer.min : 0), 0));
    if (!an.some(a => taet(a).length)) return '';
    const n = an.length, W = 420, l = 40, r = 10, t = 28, b = 30, ymax = Math.max(DAY, Math.max.apply(null, sums)) * 1.08, H0 = 236, Y = v => H0 - b - v / ymax * (H0 - t - b), bw = (W - l - r) / n, TG = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    let s = '';
    for (let h = 0; h * 60 <= ymax; h += 2) s += L(l, Y(h * 60), W - r, Y(h * 60), 'gr') + T(l - 6, Y(h * 60) + 4, h + ' h', 's2 m end');
    s += L(l, H0 - b, W - r, H0 - b, 'ax');
    an.forEach((a, j) => {
      const tt = taet(a), x = l + j * bw + bw * 0.16, w = bw * 0.68; let acc = 0;
      const miss = tt.filter(i => !(i.dauer && fin(i.dauer.min))).length;
      const groups = {}; tt.forEach(it => { if (it.dauer && fin(it.dauer.min)) { const k = firstFach(it).toLowerCase(); const ck = colOf(k); groups[ck] = (groups[ck] || 0) + it.dauer.min; } });
      Object.keys(groups).sort().forEach(ck => { const v = groups[ck]; s += R(x, Y(acc + v), w, Y(acc) - Y(acc + v), 'sg ' + ck, 0); acc += v; });
      if (!tt.length) s += R(x, H0 - b - 6, w, 6, 'rest', 1) + T(l + j * bw + bw / 2, H0 - b - 12, 'leer', 's2 m mid');
      else if (acc > 0) s += T(l + j * bw + bw / 2, Y(acc) - 5, hh(acc), 's2 b mid');
      if (miss) s += T(l + j * bw + bw / 2, (acc > 0 ? Y(acc) - 18 : H0 - b - 12), '? ×' + miss, 's2 b mid wn');
      s += T(l + j * bw + bw / 2, H0 - b + 16, TG[j] || 'Tag ' + (j + 1), 's m mid');
    });
    s += L(l, Y(DAY), W - r, Y(DAY), 'lim') + T(W - r - 2, Y(DAY) - 4, '8 h (Beispiel)', 's2 m end h');
    let ly = H0 + 6; const leg = top.map((k, i) => ({ c: 'c' + i, n: names[k] || k, min: tot[k] })), rest = Object.keys(tot).filter(k => !cls[k]).reduce((sum, k) => sum + tot[k], 0);
    if (rest > 0) leg.push({ c: 'c4', n: top.length ? 'weitere / ohne Fachbegriff' : 'ohne Fachbegriff', min: rest });
    leg.forEach((e, i) => { const x = i % 2 ? 214 : 14, y = ly + Math.floor(i / 2) * 20; s += R(x, y, 12, 12, 'sg ' + e.c, 2) + T(x + 18, y + 11, cut(e.n, 18) + ' ' + hh(e.min), 's2'); });
    const H = H0 + 8 + Math.ceil(leg.length / 2) * 20 + 4;
    return svg(W, Math.max(H, H0 + 10), 'Säulen: erfasste Stunden je Wochentag nach Fachbegriff', s);
  }

  const API = { daySvg, fachSvg, checks, checksHtml, dayViz, weekSvg, DAY };
  root.BHF_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined' || !C) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = 'lm4.bhf.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const CSS = `.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:640px;margin:8px auto}
.vzbox svg{display:block;width:100%;height:auto}
.vzbox svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.vzbox svg text.s{font-size:12.5px}.vzbox svg text.s2{font-size:11.5px}.vzbox svg text.m{fill:var(--mute)}.vzbox svg text.b{font-weight:700}.vzbox svg text.mid{text-anchor:middle}.vzbox svg text.end{text-anchor:end}.vzbox svg text.dk{fill:#10151a}.vzbox svg text.wn{fill:var(--warn)}
.vzbox svg text.h{paint-order:stroke;stroke:var(--panel2);stroke-width:3px;stroke-linejoin:round}
.vzbox .gr{stroke:var(--line);stroke-width:.7}.vzbox .ax{stroke:var(--mute);stroke-width:1.2}
.vzbox .sg.c0{fill:#3b9eff}.vzbox .sg.c1{fill:#4cd964}.vzbox .sg.c2{fill:#f5a524}.vzbox .sg.c3{fill:#c084fc}.vzbox .sg.c4{fill:#8d99a6}
.vzbox .sg.nod{fill:none;stroke:var(--warn);stroke-width:1.6;stroke-dasharray:3 3}
.vzbox .rest{fill:var(--mute);fill-opacity:.15;stroke:var(--mute);stroke-width:1;stroke-dasharray:4 3}.vzbox .frame{fill:none;stroke:var(--fg);stroke-opacity:.6;stroke-width:1.2}.vzbox .lim{stroke:var(--fg);stroke-width:1.5;stroke-dasharray:5 4}.vzbox .wd{fill:var(--warn);stroke:var(--panel2);stroke-width:1.5}
.vzcard h4{margin:0 0 8px}
.vzchk{list-style:none;margin:8px 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.vzchk li{min-height:36px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border-radius:18px;border:1px solid var(--line);background:var(--bg);font-size:13.5px}
.vzchk li.ok{border-color:var(--ok)}.vzchk li.ok span:first-child{color:var(--ok);font-weight:700}.vzchk li.wn{border-color:var(--warn)}.vzchk li.wn span:first-child{color:var(--warn);font-weight:700}
.vzsr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`;
  const st = document.createElement('style'); st.id = 'bhfviz-css'; st.textContent = CSS; document.head.appendChild(st);

  function hook(viewId, id, place, init, upd) {
    const view = $(viewId); if (!view) return;
    const ensure = () => {
      let card = document.getElementById(id);
      if (!card || !view.contains(card)) { card = document.createElement('div'); card.id = id; card.className = 'card pl vzcard'; init(card); place(view, card); }
      try { upd(card); } catch (e) {}
    };
    new MutationObserver(() => { const c = document.getElementById(id); if (!c || !view.contains(c)) ensure(); }).observe(view, { childList: true });
    ['input', 'change', 'click'].forEach(ev => view.addEventListener(ev, () => setTimeout(() => { const c = document.getElementById(id); if (c) { try { upd(c); } catch (e) {} } }, 0)));
    if (view.firstChild) ensure();
  }
  const defBeruf = () => { try { const v = localStorage.getItem('lm4.beruf'); if (v && C.BERUFE.some(b => b.k === v)) return v; } catch (e) {} return 'egs'; };

  hook('#helferView', 'vzDay', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Dein Tag im Bild</h4><div class="vzout"></div>'; },
    c => {
      const s = Object.assign({ beruf: defBeruf(), text: '', gel: '' }, lsGet('hf', {})), a = C.analyze(s.text, s.beruf, { gelernt: s.gel }), h = dayViz(a);
      $('.vzout', c).innerHTML = h || '<p class="hint2">Sobald du oben Stichpunkte mit Dauer schreibst, wird dein Arbeitstag hier als Band mit Abschnitten sichtbar. Die 8 h sind nur ein Beispielrahmen: Wie lang dein Arbeitstag ist, legt dein Betrieb fest.</p>';
    });
  hook('#wocheView', 'vzWeek', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Deine Woche im Bild</h4><div class="vzout"></div>'; },
    c => {
      const w = Object.assign({ beruf: defBeruf(), d: ['', '', '', '', ''] }, lsGet('wo', {})), h = weekSvg(Array.isArray(w.d) ? w.d : [], w.beruf);
      $('.vzout', c).innerHTML = h ? `<div class="vzbox">${h}</div><p class="hint2">Jede Säule ist ein Tag, die Farben zeigen die Fachbegriffe. „?“ markiert Tätigkeiten ohne Dauer: Dort stimmt die Stundenzahl noch nicht. Die 8 h sind nur ein Beispielrahmen; Berufsschule, Urlaub und Krankheit trägst du so ein, wie es dein Betrieb vorgibt.</p>` : '<p class="hint2">Schreibe zu mindestens einem Tag Stichpunkte mit Dauer, dann erscheinen hier die Säulen der Woche.</p>';
    });
})(typeof window !== 'undefined' ? window : globalThis);
