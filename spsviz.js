'use strict';
/* Tonfunk SPS-Lab: Visualisierung (Lab-Kennung 'sps'). Datei wird in spslab.html NACH spsui.js geladen.
   Ergänzt den Reiter Simulation um einen LIVE-SIGNALVERLAUF (Zeitdiagramm wie am Logikanalysator):
     - alle Eingänge (blau) und Ausgänge (grün) der gewählten Anlage als Rechteckverläufe über der SPS-Zeit,
     - Zeitfenster 5 / 10 / 30 s, Filter Alle / Eingänge / Ausgänge, Leeren,
     - Antippen setzt eine Zeitmarke, die zweite Marke zeigt die Zeitdifferenz (z. B. Verzögerung eines Zeitglieds),
     - Beschriftung wie im Rest des Labs (Symbolname, sonst IEC- oder Siemens-Adresse).
   Es wird nur beobachtet, was die Anlage ohnehin zeigt (Eingänge, Ausgänge der SPS). Keine Lösungen, keine Prüfung, nichts im Aufgaben- oder Trainerbereich.
   Aufzeichnung: ein Haken um plc.scan (jeder 10-ms-Zyklus) merkt nur Änderungen; spscore.js und spsui.js bleiben unverändert.
   Reine Funktionen (liefern Text, ohne DOM) sind mit node quelle/spslab/test_spsviz.js prüfbar.
   Farben nur über CSS-Variablen der Seite; Bewegung dezent: bei prefers-reduced-motion nur 4 Aktualisierungen je Sekunde. */
(function (root) {
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WINDOWS = [5, 10, 30];            // Sekunden
  const KEEP_MS = 65000;                  // so lange werden Flanken aufgehoben (größtes Fenster plus Reserve)
  const MAXEV = 600;                      // höchstens so viele Flanken je Signal

  /* ============================================================ Aufzeichnung (rein) */
  /* rec = { t, rows: [{ k, label, kind: 'i'|'o', ev: [[t_ms, 0|1], ...] }] }; nur Änderungen werden gespeichert. */
  function newRec(rows) { return { t: 0, rows: (rows || []).map(r => ({ k: r.k, label: r.label == null ? r.k : String(r.label), kind: r.kind === 'o' ? 'o' : 'i', ev: [] })) }; }
  function clearRec(rec) { rec.t = 0; rec.rows.forEach(r => { r.ev.length = 0; }); return rec; }
  function trim(r, tNow) {
    const lim = tNow - KEEP_MS;
    while (r.ev.length > 1 && r.ev[1][0] < lim) r.ev.shift();
    while (r.ev.length > MAXEV) r.ev.shift();
  }
  /* Ein Zyklus: dt in ms, vals[i] = Pegel des Signals i nach dem Zyklus. */
  function push(rec, dt, vals) {
    const d = fin(dt) && dt >= 0 ? dt : 10; rec.t += d;
    rec.rows.forEach((r, i) => {
      const v = vals && vals[i] ? 1 : 0, last = r.ev.length ? r.ev[r.ev.length - 1] : null;
      if (!last || last[1] !== v) r.ev.push([rec.t, v]);
      trim(r, rec.t);
    });
    return rec;
  }
  /* Fenster [t0, t1] in ms für Fensterlänge T Sekunden: wächst von links, danach läuft es mit */
  function windowOf(rec, T) { const w = Math.max(1, T) * 1000, t1 = Math.max(rec.t, w); return { t0: t1 - w, t1, w }; }
  /* Pegel eines Signals zur Zeit t (null vor der ersten Aufzeichnung) */
  function levelAt(row, t) {
    let v = null; for (let i = 0; i < row.ev.length; i++) { if (row.ev[i][0] <= t) v = row.ev[i][1]; else break; }
    return v;
  }
  /* Liste der Stücke [ta, tb, pegel] im Fenster (für Tests und Pfad) */
  function segments(row, t0, t1, tNow) {
    const out = [], ev = row.ev; if (!ev.length) return out;
    const tEnd = Math.min(t1, tNow);
    let i = 0; while (i + 1 < ev.length && ev[i + 1][0] <= t0) i++;
    let ta = Math.max(ev[i][0], t0), v = ev[i][1];
    for (let j = i + 1; j < ev.length; j++) {
      const tj = ev[j][0]; if (tj >= tEnd) break;
      if (tj > ta) out.push([ta, tj, v]); ta = tj; v = ev[j][1];
    }
    if (tEnd > ta || !out.length) out.push([ta, Math.max(ta, tEnd), v]);
    return out;
  }
  /* SVG-Pfad eines Rechteckverlaufs: x0..x0+w entspricht t0..t1, yH hoch (1), yL tief (0) */
  function pathD(row, t0, t1, x0, w, yH, yL, tNow) {
    const seg = segments(row, t0, t1, tNow); if (!seg.length) return '';
    const X = t => x0 + (t - t0) / (t1 - t0) * w, Y = v => (v ? yH : yL); let d = '';
    seg.forEach((s, i) => {
      const xa = X(s[0]), xb = X(s[1]);
      if (i === 0) d += 'M' + q(xa) + ' ' + Y(s[2]); else d += 'L' + q(xa) + ' ' + Y(s[2]);
      d += 'L' + q(xb) + ' ' + Y(s[2]);
    });
    return d;
  }
  /* Kurzname für die Beschriftung (feste Spaltenbreite) */
  function shortName(s, n) { s = String(s == null ? '' : s); n = n || 11; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  /* Teilung der Zeitachse in Sekunden: 1 s bis 10-s-Fenster, 5 s darüber */
  function tickStep(T) { return T <= 5 ? 1 : T <= 10 ? 2 : 5; }
  function fmtT(ms) { const s = ms / 1000; return (Math.round(s * 10) / 10).toString().replace('.', ',') + ' s'; }

  /* ============================================================ Zeichnung (rein) */
  /* opt: { T (s), filter: 'alle'|'i'|'o', cursors: [t_ms, ...] (höchstens 2) } -> SVG-Text oder '' ohne Signale */
  const GEO = { W: 360, labW: 88, right: 8, rowH: 23, top: 6, axisH: 22 };
  function signalSvg(rec, opt) {
    opt = opt || {}; const T = WINDOWS.indexOf(opt.T) >= 0 ? opt.T : 10, flt = opt.filter === 'i' || opt.filter === 'o' ? opt.filter : 'alle';
    const rows = rec.rows.filter(r => flt === 'alle' || r.kind === flt); if (!rows.length) return '';
    const g = GEO, x0 = g.labW, w = g.W - g.labW - g.right, H = g.top + rows.length * g.rowH + g.axisH, win = windowOf(rec, T), X = t => x0 + (t - win.t0) / win.w * w;
    let s = '', i;
    rows.forEach((r, k) => { if (k % 2 === 0) s += `<rect class="bg" x="0" y="${g.top + k * g.rowH}" width="${g.W}" height="${g.rowH}"/>`; });
    const step = tickStep(T) * 1000, first = Math.ceil(win.t0 / step) * step;
    for (let t = first; t <= win.t1 + 1; t += step) {
      const x = X(t); if (x < x0 - 0.5 || x > x0 + w + 0.5) continue;
      s += `<line class="gr" x1="${q(x)}" y1="${g.top}" x2="${q(x)}" y2="${H - g.axisH + 2}"/><text class="tk" x="${q(x)}" y="${H - 6}" text-anchor="middle">${esc(fmtT(t))}</text>`;
    }
    rows.forEach((r, k) => {
      const yb = g.top + k * g.rowH, yH = yb + 4, yL = yb + g.rowH - 5, d = pathD(r, win.t0, win.t1, x0, w, yH, yL, rec.t);
      s += `<text class="lb ${r.kind}" x="6" y="${q(yb + g.rowH / 2 + 4.2)}">${esc(shortName(r.label))}</text>`;
      s += `<line class="lo" x1="${x0}" y1="${yL}" x2="${x0 + w}" y2="${yL}"/>`;
      if (d) s += `<path class="tr ${r.kind}" d="${d}"/>`;
    });
    const cs = (opt.cursors || []).filter(t => fin(t) && t >= win.t0 && t <= win.t1).slice(0, 2);
    cs.forEach((t, n) => {
      const x = X(t); s += `<line class="cu" x1="${q(x)}" y1="${g.top}" x2="${q(x)}" y2="${H - g.axisH + 2}"/><text class="cl" x="${q(x < x0 + w - 46 ? x + 4 : x - 4)}" y="${g.top + 11}" text-anchor="${x < x0 + w - 46 ? 'start' : 'end'}">${n ? 'B' : 'A'}</text>`;
    });
    return `<svg viewBox="0 0 ${g.W} ${H}" role="img" aria-label="Signalverlauf: Eingänge und Ausgänge der Anlage über der SPS-Zeit">${s}</svg>`;
  }
  /* Text unter dem Diagramm */
  function caption(rec, opt) {
    opt = opt || {}; const cs = (opt.cursors || []).filter(fin).slice(0, 2);
    if (cs.length === 2) return 'Zeitmarken A und B: Δt = ' + fmtT(Math.abs(cs[1] - cs[0])) + '. Tippe erneut, um neu zu messen.';
    if (cs.length === 1) return 'Marke A bei ' + fmtT(cs[0]) + '. Tippe auf eine zweite Stelle, dann steht hier der Zeitunterschied.';
    return rec && rec.t > 0 ? 'Blau = Eingang, grün = Ausgang (SPS-Zeit). Tippe ins Diagramm, um zwei Zeitmarken zu setzen und Δt abzulesen.' : 'Starte die Simulation (▶), dann zeichnet das Diagramm die Signale auf.';
  }

  const API = { WINDOWS, newRec, clearRec, push, windowOf, levelAt, segments, pathD, shortName, tickStep, fmtT, signalSvg, caption, GEO };
  root.SPS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined') return;
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = 'lm4.sps.vz';
  const lsGet = () => { try { const v = JSON.parse(localStorage.getItem(LS) || ''); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const lsSet = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) {} };
  const CSS = `.vzsig .vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:6px 0;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.vzsig .vzbox svg{display:block;width:100%;height:auto}
.vzsig svg text{font-family:system-ui,sans-serif;font-size:12px;fill:var(--fg)}
.vzsig svg .tk{font-size:10.5px;fill:var(--mute)}.vzsig svg .cl{font-size:12px;font-weight:700;fill:var(--warn,var(--accent))}
.vzsig svg .lb.i{fill:var(--accent)}.vzsig svg .lb.o{fill:var(--ok)}
.vzsig svg .bg{fill:var(--panel);opacity:.7}.vzsig svg .gr{stroke:var(--line);stroke-width:1;stroke-dasharray:2 4}.vzsig svg .lo{stroke:var(--line);stroke-width:1;opacity:.6}
.vzsig svg .tr{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:butt}.vzsig svg .tr.i{stroke:var(--accent)}.vzsig svg .tr.o{stroke:var(--ok)}
.vzsig svg .cu{stroke:var(--warn,var(--accent));stroke-width:1.5;stroke-dasharray:4 3}
.vzsig .vzctl{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
.vzsig .vzctl button{min-height:44px;min-width:44px;padding:0 12px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);font-weight:600;color:var(--fg);font-size:13px}
.vzsig .vzctl button[aria-pressed=true]{background:var(--accent-bg);border-color:var(--accent);color:#fff}
.vzsig .vzcap{margin:2px 2px 6px;font-size:12.5px;color:var(--mute)}`;

  let S = null, rec = null, sig = '', hooked = null, T = 10, flt = 'alle', cursors = [], cardOpen = true, lastDraw = 0, tabNow = '';
  const cfg = lsGet(); if (WINDOWS.indexOf(cfg.T) >= 0) T = cfg.T; if (['alle', 'i', 'o'].indexOf(cfg.flt) >= 0) flt = cfg.flt;
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const ui = () => root.SPS_UI || null;
  const core = () => root.SPS_CORE || null;

  function ioOf() {
    const U = ui(); if (!U || !U.S) return null; S = U.S;
    const pd = root.SPS_PLANTS && root.SPS_PLANTS.defs && root.SPS_PLANTS.defs[S.plantId], io = (S.plant && S.plant.io) || (pd && pd.io);
    return io && io.inputs && io.outputs ? io : null;
  }
  function labelOf(k) {
    const C = core(); let sy = '';
    try { sy = (S.sym && S.prog && S.prog.symbols && S.prog.symbols[k]) || ''; } catch (e) {}
    try { return sy || (C ? C.addr(k, S.addr) : k); } catch (e) { return k; }
  }
  function rowsFor(io) {
    return io.inputs.map(x => ({ k: x.key, kind: 'i', label: labelOf(x.key) })).concat(io.outputs.map(x => ({ k: x.key, kind: 'o', label: labelOf(x.key) })));
  }
  /* Aufzeichnung an die Anlage binden; neu anlegen, wenn sich Anlage oder Signalliste ändert */
  function ensureRec() {
    const io = ioOf(); if (!io) return null;
    const keys = io.inputs.map(x => x.key).concat(io.outputs.map(x => x.key)).join(',') + '|' + S.plantId;
    if (!rec || keys !== sig) { sig = keys; rec = newRec(rowsFor(io)); cursors = []; }
    else rec.rows.forEach(r => { const l = labelOf(r.k); if (l !== r.label) r.label = l; });
    return rec;
  }
  /* Haken um plc.scan und plc.reset: jeder Zyklus landet in der Aufzeichnung */
  function hookPlc() {
    const plc = S && S.plc; if (!plc || plc === hooked || typeof plc.scan !== 'function') return;
    if (hooked && rec) { clearRec(rec); cursors = []; }   // neues Programm: SPS-Zeit beginnt wieder bei 0
    hooked = plc;
    const scan = plc.scan, reset = plc.reset;
    plc.scan = function (dtMs) {
      const r = scan.apply(this, arguments);
      try {
        if (r && ensureRecQuick()) { const dt = typeof dtMs === 'number' && fin(dtMs) && dtMs >= 0 ? dtMs : 10, vals = rec.rows.map(x => (x.kind === 'i' ? plc.getInput(x.k) : plc.getOutput(x.k))); push(rec, dt, vals); }
      } catch (e) {}
      return r;
    };
    if (typeof reset === 'function') plc.reset = function () { const r = reset.apply(this, arguments); try { if (rec) { clearRec(rec); cursors = []; } } catch (e) {} return r; };
  }
  const ensureRecQuick = () => (rec && S && S.plc === hooked ? rec : ensureRec());

  function card() {
    let c = document.getElementById('vzSig'); const P = $('#simPanel'); if (!P) return null;
    if (c && P.contains(c)) return c;
    c = document.createElement('details'); c.id = 'vzSig'; c.className = 'card wide vzsig'; if (cardOpen) c.open = true;
    c.innerHTML = '<summary>Signalverlauf</summary><div class="cb"><div class="vzctl" role="group" aria-label="Darstellung"></div><div class="vzbox" data-vz="svg"></div><p class="vzcap" data-vz="cap"></p></div>';
    c.addEventListener('toggle', () => { cardOpen = c.open; });
    c.querySelector('.vzctl').addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'clr') { if (rec) clearRec(rec); cursors = []; }
      else if (/^t\d+$/.test(a)) T = +a.slice(1); else if (a === 'f-alle') flt = 'alle'; else if (a === 'f-i') flt = 'i'; else if (a === 'f-o') flt = 'o';
      lsSet({ T, flt }); buildCtl(c); draw(true);
    });
    c.querySelector('[data-vz=svg]').addEventListener('pointerdown', e => {
      if (!rec) return; const svg = e.currentTarget.querySelector('svg'); if (!svg) return;
      const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * GEO.W, win = windowOf(rec, T), w = GEO.W - GEO.labW - GEO.right;
      if (vx < GEO.labW - 4 || vx > GEO.W) return; const t = win.t0 + Math.min(1, Math.max(0, (vx - GEO.labW) / w)) * win.w;
      if (cursors.length >= 2) cursors = [t]; else cursors.push(t); draw(true);
    });
    buildCtl(c);
    const anchor = $('#cI', P); P.insertBefore(c, anchor || P.firstChild);
    return c;
  }
  function buildCtl(c) {
    const b = (a, t, on, lab) => `<button type="button" data-a="${a}"${on == null ? '' : ' aria-pressed="' + (on ? 'true' : 'false') + '"'}${lab ? ' aria-label="' + lab + '"' : ''}>${t}</button>`;
    c.querySelector('.vzctl').innerHTML = WINDOWS.map(n => b('t' + n, n + ' s', T === n, 'Zeitfenster ' + n + ' Sekunden')).join('') + b('f-alle', 'Alle', flt === 'alle') + b('f-i', 'Ein', flt === 'i', 'nur Eingänge') + b('f-o', 'Aus', flt === 'o', 'nur Ausgänge') + b('clr', 'Leeren', null, 'Aufzeichnung leeren');
  }
  function draw(force) {
    const c = document.getElementById('vzSig'); if (!c || !rec || !c.open) return;
    const now = performance.now(); if (!force && now - lastDraw < (reduced() ? 250 : 110)) return; lastDraw = now;
    const o = { T, filter: flt, cursors }, h = signalSvg(rec, o);
    const box = c.querySelector('[data-vz=svg]'); if (h !== box.__h) { box.__h = h; box.innerHTML = h || '<p class="vzcap" style="padding:10px">Keine Signale in dieser Auswahl.</p>'; }
    const cap = c.querySelector('[data-vz=cap]'), t = caption(rec, o); if (cap.textContent !== t) cap.textContent = t;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    try {
      const U = ui(); if (!U || !U.S) return; S = U.S;
      const mid = document.getElementById('mid'), tab = mid ? mid.getAttribute('data-tab') : ''; tabNow = tab;
      if (!ensureRec()) return; hookPlc();
      if (tab === 'sim') { card(); draw(false); }
    } catch (e) {}
  }
  function init() {
    if (!ui()) return;
    const st = document.createElement('style'); st.id = 'spsviz-css'; st.textContent = CSS; document.head.appendChild(st);
    const P = $('#simPanel');
    if (P) new MutationObserver(() => { if (tabNow === 'sim' && !document.getElementById('vzSig')) { try { card(); draw(true); } catch (e) {} } }).observe(P, { childList: true });
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
