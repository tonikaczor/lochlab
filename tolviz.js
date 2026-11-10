'use strict';
/* Tonfunk Toleranz-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei wird NACH tolui.js eingebunden.
   window.TOLVIZ = { fit, fitSection, fitRange, shape, arten, task, resolution }.
   Alle Funktionen liefern einen SVG-Text (oder '' bei ungültiger Eingabe), nie NaN im Markup.
   Farben nur über die CSS-Variablen der Seite (Hell/Dunkel/Auto). Keine Animation, keine Hover-Abhängigkeit.
   Maßstab: Abweichungen sind stark überhöht dargestellt (steht jeweils im Bild); es stimmen Reihenfolge und Abstandsverhältnisse.
   Aufgaben: task() liefert Bilder nur NACH der Lösung (Aufruf aus tolui.js im Lösungszweig), nie vorher. */
(function (root) {
  const C = root.TOL_CORE || (typeof require !== 'undefined' ? require('./tolcore.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = x => typeof x === 'number' && isFinite(x);
  const q = x => (fin(x) ? (Math.round(x * 10) / 10) : 0);                 /* Koordinate */
  const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');
  const um = v => sg(fin(v) ? Math.round(v * 10) / 10 : 0) + ' µm';
  const mmTxt = (v, d) => (fin(v) ? C.fmtDe(v, d == null ? 3 : d) : '–');

  /* Stil einmal in den Kopf der Seite schreiben (nur im Browser) */
  const CSS = '.tv{display:block;width:100%;height:auto;max-width:520px;margin:8px auto 0;text-anchor:start}'
    + '.tv text{font:600 11.5px system-ui,sans-serif;fill:var(--fg,#222);-webkit-user-select:none;user-select:none}'
    + '.tv .m{fill:var(--mute,#667);font-weight:500;font-size:10.5px}'
    + '.tv .ln{stroke:var(--mute,#667);stroke-width:1;fill:none}'
    + '.tv .zero{stroke:var(--fg,#222);stroke-width:1.4;stroke-dasharray:6 4}'
    + '.tv .okf{fill:var(--ok,#2a2);fill-opacity:.35;stroke:var(--ok,#2a2);stroke-width:1.2}'
    + '.tv .badf{fill:var(--danger,#c33);fill-opacity:.30;stroke:var(--danger,#c33);stroke-width:1.2}'
    + '.tv .warnf{fill:var(--warn,#c80);fill-opacity:.35;stroke:var(--warn,#c80);stroke-width:1.2}'
    + '.tv .plate{fill:var(--panel2,#ddd);stroke:var(--line,#aaa);stroke-width:1.2}'
    + '.tv .holeo{fill:none;stroke:var(--accent,#37f);stroke-width:2}'
    + '.tv .shaftf{fill:var(--hi,#e80);fill-opacity:.5;stroke:var(--hi,#e80);stroke-width:2}'
    + '.tv .dash{fill:none;stroke:var(--mute,#667);stroke-width:1.2;stroke-dasharray:4 3}'
    + '.tv .acc{fill:none;stroke:var(--accent,#37f);stroke-width:2.4}'
    + '.tv .cap{font-size:11px}'
    + '.tvbox{margin:10px 0 2px;padding-top:6px;border-top:1px solid var(--line,#ccc)}'
    + '.tvbox h5{margin:0 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute,#667);font-weight:600}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('tolviz-css')) {
    const st = document.createElement('style'); st.id = 'tolviz-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const svg = (w, h, aria, body) => `<svg class="tv" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${body}</svg>`;
  const box = (title, inner) => (inner ? `<div class="tvbox"><h5>${esc(title)}</h5>${inner}</div>` : '');
  /* Beschriftungen untereinander schieben, damit sie sich nicht überdecken */
  function nudge(ys, gap) { const o = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]), r = []; let prev = -1e9; o.forEach(p => { const y = Math.max(p[0], prev + gap); r[p[1]] = y; prev = y; }); return r; }

  /* ---------- Welle in Bohrung: Querschnitt, Grenzfälle ---------- */
  function fitSection(F) {
    if (!F || !F.hole || !F.shaft || ![F.Pso, F.Psu, F.hole.ES, F.hole.EI, F.shaft.es, F.shaft.ei].every(fin)) return '';
    const mx = Math.max(Math.abs(F.hole.ES), Math.abs(F.hole.EI), Math.abs(F.shaft.es), Math.abs(F.shaft.ei), 1), k = 11 / mx, R0 = 44;
    const cases = [
      { cx: 90, title: 'kleinste Bohrung, größte Welle', rh: R0 + F.hole.EI * k, rs: R0 + F.shaft.es * k, v: F.Psu, lab: F.Psu >= 0 ? 'Mindestspiel' : 'Höchstübermaß' },
      { cx: 270, title: 'größte Bohrung, kleinste Welle', rh: R0 + F.hole.ES * k, rs: R0 + F.shaft.ei * k, v: F.Pso, lab: F.Pso >= 0 ? 'Höchstspiel' : 'Mindestübermaß' }
    ];
    let s = '', cy = 96;
    cases.forEach(c => {
      const rh = q(Math.max(4, c.rh)), rs = q(Math.max(4, c.rs)), cx = c.cx;
      s += `<text x="${cx}" y="14" text-anchor="middle" class="cap">${c.title}</text>`;
      s += `<path class="plate" fill-rule="evenodd" d="M${cx - 74} ${cy - 74}h148v148h-148z M${q(cx + rh)} ${cy}a${rh} ${rh} 0 1 0 ${q(-2 * rh)} 0a${rh} ${rh} 0 1 0 ${q(2 * rh)} 0z"/>`;
      s += `<circle class="shaftf" cx="${cx}" cy="${cy}" r="${rs}"/><circle class="holeo" cx="${cx}" cy="${cy}" r="${rh}"/>`;
      const n = Math.abs(c.v), lab = `${c.lab} ${C.fmtDe(Math.round(n * 10) / 10, n % 1 ? 1 : 0)} µm`;
      s += `<text x="${cx}" y="${cy + 92}" text-anchor="middle" style="fill:${c.v >= 0 ? 'var(--ok)' : 'var(--danger)'}">${esc(lab)}</text>`;
    });
    s += `<text x="180" y="198" text-anchor="middle" class="m">Blau: Bohrung · Orange: Welle</text><text x="180" y="211" text-anchor="middle" class="m">Abweichungen stark überhöht gezeichnet</text>`;
    return svg(360, 218, 'Querschnitt Welle in Bohrung für die beiden Grenzfälle der Passung ' + esc(F.code), s);
  }

  /* ---------- Zahlenstrahl: von Übermaß bis Spiel ---------- */
  function fitRange(F) {
    if (!F || ![F.Pso, F.Psu].every(fin)) return '';
    let lo = Math.min(F.Psu, 0), hi = Math.max(F.Pso, 0); const pad = Math.max(6, (hi - lo) * 0.18); lo -= pad; hi += pad;
    const x = v => q(20 + (v - lo) / (hi - lo) * 320), x0 = x(0), xa = x(F.Psu), xb = x(F.Pso), narrow = xb - xa < 80;
    let s = `<text x="20" y="14" class="m">◀ Übermaß (Welle größer)</text><text x="340" y="14" text-anchor="end" class="m">Spiel (Bohrung größer) ▶</text>`;
    if (F.Psu < 0) s += `<rect x="${xa}" y="26" width="${q(Math.max(0, Math.min(xb, x0) - xa))}" height="26" class="badf"/>`;
    if (F.Pso > 0) s += `<rect x="${Math.max(xa, x0)}" y="26" width="${q(Math.max(0, xb - Math.max(xa, x0)))}" height="26" class="okf"/>`;
    s += `<line x1="${x0}" y1="20" x2="${x0}" y2="60" class="zero"/><text x="${x0}" y="72" text-anchor="middle" class="m">0</text>`;
    s += `<line x1="${xa}" y1="52" x2="${xa}" y2="62" class="ln"/><line x1="${xb}" y1="52" x2="${xb}" y2="62" class="ln"/>`;
    s += `<text x="${xa}" y="${narrow ? 86 : 76}" text-anchor="${narrow ? 'end' : 'middle'}">${esc(um(F.Psu))}</text><text x="${xb}" y="${narrow ? 86 : 76}" text-anchor="${narrow ? 'start' : 'middle'}">${esc(um(F.Pso))}</text>`;
    s += `<text x="180" y="104" text-anchor="middle" class="m">Passungstoleranz = Höchstspiel − Mindestspiel = ${C.fmtDe(Math.round((F.Pso - F.Psu) * 10) / 10, 0)} µm</text><text x="180" y="117" text-anchor="middle" class="m">(= Toleranz Bohrung + Toleranz Welle)</text>`;
    return svg(360, 124, 'Spielbereich der Passung ' + esc(F.code) + ' von Mindestspiel bis Höchstspiel', s);
  }
  const fit = F => (F && F.hole && F.shaft ? box('Welle in der Bohrung (Querschnitt)', fitSection(F)) + box('Spiel und Übermaß auf einen Blick', fitRange(F)) : '');

  /* ---------- Toleranz-Rechner: Welle bzw. Bohrung im Querschnitt mit Grenzmaßen und Istmaß ---------- */
  function shape(part, d, m) {
    if (!d || !d.ok || ![d.N, d.Go, d.Gu].every(fin)) return '';
    const welle = part !== 'bohrung', hasM = fin(m), vals = [d.N, d.Go, d.Gu].concat(hasM ? [m] : []);
    const vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals), span = Math.max(vmax - vmin, 1e-6), r = v => q(26 + (v - vmin) / span * 36), cx = 86, cy = 82;
    const kl = hasM ? C.classify(part, m, d) : null;
    let s = '';
    if (!welle) s += `<rect class="plate" x="${cx - 74}" y="${cy - 74}" width="148" height="148" rx="6"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r(d.Go)}" class="okf"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r(d.Gu)}" style="fill:${welle ? 'var(--panel2,#ddd)' : 'var(--bg,#fff)'};stroke:var(--mute,#667);stroke-width:1.2;stroke-dasharray:4 3"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r(d.Go)}" class="dash"/>`;
    if (Math.abs(r(d.N) - r(d.Go)) > 0.4 && Math.abs(r(d.N) - r(d.Gu)) > 0.4) s += `<circle cx="${cx}" cy="${cy}" r="${r(d.N)}" style="fill:none;stroke:var(--fg,#222);stroke-width:1.2;stroke-dasharray:6 4"/>`;
    if (hasM) s += `<circle cx="${cx}" cy="${cy}" r="${r(m)}" class="acc" style="stroke:${kl && kl.state === 'gut' ? 'var(--ok)' : kl && kl.state === 'nacharbeit' ? 'var(--warn)' : 'var(--danger)'}"/>`;
    const items = [[d.Go, 'Höchstmaß ' + mmTxt(d.Go), 'var(--fg,#222)'], [d.Gu, 'Mindestmaß ' + mmTxt(d.Gu), 'var(--fg,#222)']];
    if (Math.abs(r(d.N) - r(d.Go)) > 0.4 && Math.abs(r(d.N) - r(d.Gu)) > 0.4) items.push([d.N, 'Nennmaß ' + mmTxt(d.N, d.N % 1 ? 3 : 0), 'var(--mute,#667)']);
    if (hasM) items.push([m, 'gemessen ' + mmTxt(m), 'var(--hi,#e80)']);
    const ys = nudge(items.map(it => cy - r(it[0]) * 0.62), 16);
    items.forEach((it, i) => {
      const ang = Math.asin(Math.max(-0.95, Math.min(0.95, (cy - ys[i]) / Math.max(1, r(it[0]))))), px = q(cx + r(it[0]) * Math.cos(ang)), py = q(cy - r(it[0]) * Math.sin(ang));
      s += `<line x1="${px}" y1="${py}" x2="176" y2="${q(ys[i])}" class="ln"/><circle cx="${px}" cy="${py}" r="2.2" style="fill:${it[2]}"/><text x="180" y="${q(ys[i] + 4)}" style="fill:${it[2]}">${esc(it[1])}</text>`;
    });
    s += `<text x="180" y="${cy + 98}" text-anchor="middle" class="m">${welle ? 'Welle im Querschnitt' : 'Bohrung in der Platte'}, Abweichungen stark überhöht</text>`;
    return box(welle ? 'Wellenquerschnitt: Grenzmaße und Istmaß' : 'Bohrung: Grenzmaße und Istmaß', svg(360, 190, (welle ? 'Welle' : 'Bohrung') + ' im Querschnitt mit Höchstmaß, Mindestmaß' + (hasM ? ' und gemessenem Maß' : ''), s));
  }

  /* ---------- Passungsarten nebeneinander (Hilfe) ---------- */
  function arten() {
    const cs = [['H7', 'f7', 'Spielpassung H7/f7'], ['H7', 'j6', 'Übergangspassung H7/j6'], ['H7', 's6', 'Übermaßpassung H7/s6']];
    return cs.map(c => { const F = C.fit(c[0], c[1], 25); return F ? box(c[2] + ', Ø25: Grenzfälle im Querschnitt', fitSection(F)) : ''; }).join('');
  }

  /* ---------- Bilder zu Aufgaben (nur nach der Lösung) ---------- */
  const TASK_DIM = {
    tol10: { N: 40, hi: 0.05, lo: 0.01 }, tol11: { N: 25, hi: -0.020, lo: -0.041, part: 'welle' }, tol12: { N: 60, hi: 0.03, lo: -0.02 }, tol13: { N: 12, hi: 0.05, lo: -0.03 },
    tol15: { N: 30, hi: -0.010, lo: -0.030, part: 'welle', m: 29.992 }, tol16: { N: 20, hi: 0.021, lo: 0, part: 'bohrung', m: 19.998 }, tol17: { N: 50, hi: 0.025, lo: 0, part: 'bohrung', m: 50.030 },
    tol18: { N: 16, hi: 0, lo: -0.018, part: 'welle', m: 15.979 }, tol19: { N: 20, hi: -0.020, lo: -0.033, part: 'welle', m: 19.980 }
  };
  const TASK_FIT = { tol20: ['H7', 'f7', 30], tol21: ['H7', 'g6', 25], tol22: ['H7', 'n6', 40], tol23: ['H7', 's6', 10], tol24: ['H8', 'h6', 15], tol25: ['H7', 'k6', 20], tol26: ['H7', 'f7', 25], tol27: ['H7', 'j6', 25], tol28: ['H7', 's6', 25] };
  const TASK_RES = { tol31: 0.5, tol32: 0.1, tol33: 0.013 };
  /* Maßband mit Gut/Nacharbeit/Ausschuss für Welle oder Bohrung */
  function strip(d, m, part) {
    const T = Math.max(d.T, 0.002); let lo = d.Gu - 0.8 * T, hi = d.Go + 0.8 * T; if (fin(m)) { lo = Math.min(lo, m - 0.15 * T); hi = Math.max(hi, m + 0.15 * T); }
    const x = v => q(20 + (v - lo) / (hi - lo) * 320), xa = x(d.Gu), xb = x(d.Go), neutral = !part, welle = part !== 'bohrung';
    const left = neutral ? 'badf' : welle ? 'badf' : 'warnf', right = neutral ? 'badf' : welle ? 'warnf' : 'badf';
    let s = `<rect x="20" y="24" width="${q(xa - 20)}" height="26" class="${left}"/><rect x="${xa}" y="24" width="${q(Math.max(xb - xa, 2))}" height="26" class="okf"/><rect x="${q(Math.max(xb, xa + 2))}" y="24" width="${q(340 - Math.max(xb, xa + 2))}" height="26" class="${right}"/>`;
    const nar = xb - xa < 70;
    s += `<text x="${xa}" y="68" text-anchor="${nar ? 'end' : 'middle'}" class="cap">Mindestmaß ${mmTxt(d.Gu)}</text><text x="${xb}" y="68" text-anchor="${nar ? 'start' : 'middle'}" class="cap">Höchstmaß ${mmTxt(d.Go)}</text>`;
    s += `<text x="${q((xa + xb) / 2)}" y="16" text-anchor="middle" class="m">erlaubt</text>`;
    if (fin(m)) { const mx = x(m); s += `<polygon points="${mx - 6},22 ${mx + 6},22 ${mx},34" style="fill:var(--hi,#e80)"/><line x1="${mx}" y1="34" x2="${mx}" y2="50" style="stroke:var(--hi,#e80);stroke-width:2"/><text x="${mx}" y="88" text-anchor="middle" style="fill:var(--hi,#e80)">gemessen ${mmTxt(m)}</text>`; }
    if (!neutral) s += `<text x="24" y="44" class="m">${welle ? 'Ausschuss' : 'Nacharbeit'}</text><text x="336" y="44" text-anchor="end" class="m">${welle ? 'Nacharbeit' : 'Ausschuss'}</text>`;
    return svg(360, 96, 'Toleranzbereich mit Grenzmaßen' + (fin(m) ? ' und Messwert' : ''), s);
  }
  /* Ablesung der Messmittel gegen die Faustregel T/10 (logarithmische Achse) */
  function resolution(T, devices) {
    const dv = devices || (root.TOL_DATA && root.TOL_DATA.devices) || []; if (!fin(T) || T <= 0 || !dv.length) return '';
    const lo = Math.log10(0.0005), hi = Math.log10(1), x = v => q(176 + (Math.log10(Math.max(v, 0.0005)) - lo) / (hi - lo) * 170), lim = T / 10;
    let s = '', y = 30;
    dv.forEach(d => {
      const ok = d.r <= lim + 1e-9, xx = x(d.r);
      s += `<text x="170" y="${y + 4}" text-anchor="end" class="cap">${esc(d.name.replace(/ \(.*\)$/, ''))}</text><line x1="176" y1="${y}" x2="${xx}" y2="${y}" style="stroke:var(--${ok ? 'ok' : 'danger'},#888);stroke-width:5;stroke-linecap:round"/><text x="${xx + 6}" y="${y + 4}" class="m" style="fill:var(--${ok ? 'ok' : 'danger'},#888)">${mmTxt(d.r, d.r < 0.01 ? 3 : 2)} mm</text>`;
      y += 24;
    });
    const lx = x(lim);
    s += `<line x1="${lx}" y1="14" x2="${lx}" y2="${y - 12}" style="stroke:var(--accent,#37f);stroke-width:1.6;stroke-dasharray:5 3"/><text x="${lx}" y="10" text-anchor="${lx > 250 ? 'end' : 'middle'}" style="fill:var(--accent,#37f)">T/10 = ${mmTxt(lim, lim < 0.01 ? 4 : 3)} mm</text>`;
    s += `<text x="20" y="${y + 6}" class="m">Grün: erfüllt die Faustregel · Rot: zu grob</text><text x="20" y="${y + 19}" class="m">Kürzerer Balken = feinere Ablesung (Achse logarithmisch)</text>`;
    return svg(360, y + 26, 'Ablesung verschiedener Messmittel im Vergleich zu einem Zehntel der Toleranz', s);
  }
  function task(id) {
    if (TASK_DIM[id]) { const t = TASK_DIM[id], d = C.dimensions(t.N, t.hi, t.lo, 'mm'); if (!d.ok) return ''; return box('Toleranzbereich im Bild', strip(d, t.m, t.part)); }
    if (TASK_FIT[id]) { const t = TASK_FIT[id], F = C.fit(t[0], t[1], t[2]); return F ? box('So sieht die Passung ' + t[0] + '/' + t[1] + ' aus', fitSection(F) + fitRange(F)) : ''; }
    if (TASK_RES[id]) return box('Welches Messmittel reicht? (Faustregel Ablesung ≤ T/10)', resolution(TASK_RES[id]));
    return '';
  }

  const api = { fit, fitSection, fitRange, shape, arten, task, resolution, strip };
  root.TOLVIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* tolui.js hat den ersten Reiter schon gezeichnet, bevor diese Datei da war: betroffene Reiter einmal neu zeichnen */
  if (typeof document !== 'undefined') { try { const on = document.querySelector('#tabs .tab.on'); if (on && ['fit', 'calc', 'help'].indexOf(on.dataset.t) >= 0) on.click(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
