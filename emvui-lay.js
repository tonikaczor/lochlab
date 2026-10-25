'use strict';
/* Tonfunk EMV-Lab: Tab "Layout-Fälle" (WP3b), Fallbuch zum Prüfstand `layout`.
   Fallliste (zwölf Karten mit Vorschau, Haken bei "gelöst", Zähler emvcases), Detailansicht mit großer Leiterplatte (Hin- und Rückstrom als Partikel, Schleifenfläche, Fläche, Schlitz),
   Frequenz- und Stromregler, Stapelwahl, Maßnahmen als Schalter, Messgeräte, Ampel, Wischer Vorher | Nachher (Ausgangszustand gegen aktuellen Zustand), Ansicht Impedanz (z) und der Modus "Fehler finden".
   Zahlen kommen aus dem Prüfstand (rig.readMeters(), rig.assess(), rig.curves()); die Geometrie der Leiterplatte aus EMV_CORE.layout.solve (dieselbe Funktion wie im Prüfstand, SPEC Regel 7), Fehlerstellen aus EMV_CORE.layout.hit.
   Das Bild zeichnet diese Datei selbst, weil "Fehler finden" die Geometrie der Zeichenfläche (Pixel in Millimeter) braucht (siehe ABWEICHUNGEN.md WP3b).
   Schnittstelle (SPEC 8.8): window.EMV_UI_EXT.lay = { render(host, api), refresh(), redraw(), fn }. Die reinen Funktionen (ohne DOM) hängen unter EMV_UI_EXT.lay.fn und werden von test_emvui_ext.js geprüft.
   Antipper beim Fehlerfinden landen in api.S.clicks als { x, y, hit: Fehler-Id oder null, fall } (Abgabe der Aufgabe em21). */
(function (root) {
  const E = root.EMV_UI_EXT = root.EMV_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn) => { host.__emvl = host.__emvl || {}; if (host.__emvl[name + ty]) return; host.__emvl[name + ty] = 1; host.addEventListener(ty, fn); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const UT = () => E.util || null;
  /* Töne nur nach einer Bedienung durch den Nutzer (sonst Warnung des Browsers) */
  const beep = v => { try { if (root.LochFX && (!root.navigator || !navigator.userActivation || navigator.userActivation.hasBeenActive)) root.LochFX.sound('ding', v); } catch (e) {} };
  const CORE = () => root.EMV_CORE;
  const AMP = { gruen: ['✓', 'grün', 'ok'], gelb: ['!', 'gelb', 'warnc'], rot: ['✗', 'rot', 'bad'], grau: ['–', 'grau', ''] };
  const ampKey = a => { a = String(a || 'grau').toLowerCase().replace('ü', 'ue'); return AMP[a] ? a : 'grau'; };

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* die zwölf Fälle: aus EMV_CORE.layout.cases, sonst aus der Auswahl "fall" des Prüfstands */
  function casesOf(core, rig) {
    const L = core && core.layout, a = L && Array.isArray(L.cases) ? L.cases : null;
    if (a && a.length) return a.map((c, i) => ({ idx: i, id: c.id, title: c.title || c.id, kurz: c.kurz || '', world: c.world || { w: 100, h: 70 }, c }));
    const d = rig && Array.isArray(rig.controls) ? rig.controls.find(x => x.key === 'fall') : null;
    return d ? (d.options || []).map((o, i) => ({ idx: i, id: o.value, title: String(o.label).replace(/^\d+\s+/, ''), kurz: '', world: { w: 100, h: 70 }, c: null })) : [];
  }
  const caseById = (list, id) => list.find(x => x.id === id) || null;
  /* Zeichenfläche: Platine in Pixel (Seitenverhältnis erhalten) und Umrechnung in beide Richtungen */
  function fitBoard(W, H, world, pad) {
    pad = pad == null ? 8 : pad; const ww = (world && world.w) || 100, wh = (world && world.h) || 70; const s = Math.min((W - 2 * pad) / ww, (H - 2 * pad) / wh);
    if (!(s > 0)) return null; return { s, ox: (W - ww * s) / 2, oy: (H - wh * s) / 2, w: ww, h: wh };
  }
  const toWorld = (geo, px, py) => [(px - geo.ox) / geo.s, (py - geo.oy) / geo.s];
  const toPx = (geo, x, y) => [geo.ox + x * geo.s, geo.oy + y * geo.s];
  const fixesOf = ctl => ({ fix1: !!ctl.fix1, fix2: !!ctl.fix2, fix3: !!ctl.fix3 });
  /* Lösung des Falls für die aktuellen Einstellungen (Strom in mA im Prüfstand, in A im Kern) */
  function solveFor(core, ctl) {
    if (!core || !core.layout || typeof core.layout.solve !== 'function' || !ctl) return null;
    try { const r = core.layout.solve(ctl.fall, { fixes: fixesOf(ctl), stack: ctl.stack, f: ctl.f, i: (+ctl.i) / 1000 }); return r && r.ok !== false ? r : null; } catch (e) { return null; }
  }
  /* Ausgangszustand des Falls (ohne Maßnahmen, Stapel, Frequenz und Strom des Falls) */
  function baseSolve(core, cs) {
    if (!core || !core.layout || !cs || !cs.c) return null;
    try { const c = cs.c, r = core.layout.solve(cs.id, { fixes: { fix1: false, fix2: false, fix3: false }, stack: c.stackDefault, f: c.f0, i: c.i0 }); return r && r.ok !== false ? r : null; } catch (e) { return null; }
  }
  /* Partikelzahlen (Anzeige, Symbolik): Dichte wächst mit dem Strom, Aufteilung des Rückstroms nach returnSplit */
  function partCounts(i_mA, split, cap) {
    const n = Math.round(clamp(10 + 28 * Math.log10(Math.max(1, +i_mA * 10)), 8, cap || 120)), hf = split && fin(split.hf) ? clamp(split.hf, 0, 1) : 1;
    const nh = Math.round(n * hf), nl = n - nh; return { forward: n, hf: nh, lf: nl };
  }
  const solvedList = api => { const a = api && api.lsGet ? api.lsGet('emv.cases', []) : []; return Array.isArray(a) ? a : []; };
  /* gelöst: Ampel grün mit mindestens einer Maßnahme (der Ausgangszustand ist rot, sonst wäre der Fall nichts) */
  function isSolved(ampel, ctl) { return ampKey(ampel) === 'gruen' && !!(ctl && (ctl.fix1 || ctl.fix2 || ctl.fix3)); }
  function markSolved(api, id) {
    const a = solvedList(api); if (a.includes(id)) return false; a.push(id); if (api.lsSet) api.lsSet('emv.cases', a); if (api.stat) api.stat('emvcases', a.length, 'max'); return true;
  }
  /* Fehlersuche: Antippen → layout.hit; Ergebnis { hit: Defekt oder null } und Eintrag in S.clicks */
  function tapDefect(core, fall, x, y, ctl) {
    if (!core || !core.layout || typeof core.layout.hit !== 'function') return null; let d = null;
    try { d = core.layout.hit(fall, x, y, fixesOf(ctl || {})); } catch (e) { d = null; } return d || null;
  }
  const WRONG = 'An dieser Stelle findest du keinen Fehler. Schau dir den Weg von Hin- und Rückstrom und die Fläche an, die beide einschließen.';
  E.lay = E.lay || {};
  E.lay.fn = { casesOf, caseById, fitBoard, toWorld, toPx, fixesOf, solveFor, baseSolve, partCounts, solvedList, isSolved, markSolved, tapDefect, ampKey, WRONG };

  /* ============================================================ Oberfläche */
  const CSS = `.lyg{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px;margin-top:8px}
.lyc{display:flex;flex-direction:column;gap:4px;text-align:left;padding:8px;border-radius:12px;background:var(--panel);border:1px solid var(--line);min-width:0;position:relative}
.lyc canvas{width:100%;height:auto;aspect-ratio:10/7;border-radius:8px;background:var(--well);display:block}
.lyc b{font-size:13.5px;line-height:1.2}.lyc small{color:var(--mute);font-size:12px;line-height:1.25}
.lyc .ok{position:absolute;right:10px;top:10px;width:26px;height:26px;border-radius:50%;background:var(--ok);color:#06210d;display:grid;place-items:center;font-weight:800}
.lyc.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent) inset}
.lybd{position:relative;width:100%;touch-action:none}.lybd canvas{display:block;width:100%;height:auto;max-height:64vh;aspect-ratio:10/7;border-radius:10px;background:var(--well);border:1px solid var(--line);touch-action:none}
.lybd.z canvas{aspect-ratio:16/9}
.lywipe{position:absolute;top:0;bottom:0;left:var(--wp,50%);width:56px;transform:translateX(-50%);cursor:ew-resize;touch-action:none}
.lywipe[hidden]{display:none}
.lymet{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;margin-top:8px}
.lymet div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 9px}.lymet small{display:block;color:var(--mute);font-size:12px}.lymet b{font-size:18px;font-variant-numeric:tabular-nums}.lymet span{color:var(--mute);font-size:12px;margin-left:3px}
.lyctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px 16px;margin-top:8px}
.lyfx{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:52px;padding:4px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);text-align:left;margin-top:6px}
.lyfx[disabled]{opacity:.45}.lyfx .tg{flex:none;width:52px;height:30px;border-radius:15px;background:var(--tgl);position:relative}.lyfx .tg i{position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:var(--knob);transition:left .12s}
.lyfx[aria-checked=true] .tg{background:#2fae45}.lyfx[aria-checked=true] .tg i{left:27px;background:#fff}
.lyfd{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:8px}.lyfd li{margin:4px 0}.lyfd .f{color:var(--ok);font-weight:700}
.lyrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}`;
  const PCB = { dark: { board: '#12301f', plane: 'rgba(40,200,190,.22)', copper: '#e0a63c', via: '#c8d0d8', slit: '#0b0f13', grid: 'rgba(255,255,255,.05)' }, light: { board: '#bfe0c9', plane: 'rgba(0,150,140,.22)', copper: '#9a6a12', via: '#4a5560', slit: '#f4f6f8', grid: 'rgba(0,0,0,.06)' } };
  const ST = { open: null, find: true, found: {}, shown: false, mode: 'nachher', wipe: 0.5, host: null, api: null, loop: 0, parts: null, view: 'strom', pool: null, poolKey: '', geo: null, dirty: true, base: null, baseKey: '', last: null };

  function themeName() { try { const a = document.documentElement.getAttribute('data-theme'); if (a === 'light') return 'light'; if (a === 'dark') return 'dark'; return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  const polyOf = (fw, rt) => (fw && fw.length > 1 && rt && rt.length > 1 ? fw.concat(rt.slice().reverse()) : []);

  /* ---- Platine zeichnen: Rand, Fläche, Schlitze, Bahnen, Bauteile, Via, Schleifenfläche, Partikel (Symbolik), Fehlermarken ---- */
  function drawBoard(g, W, H, cs, res, ctl, o) {
    const P = (UT() && UT().pal()) || {}, th = PCB[themeName()], world = cs.world || { w: 100, h: 70 }, geo = fitBoard(W, H, world, o.pad == null ? 8 : o.pad); if (!geo) return null;
    const px = x => geo.ox + x * geo.s, py = y => geo.oy + y * geo.s, c = cs.c || {};
    g.fillStyle = P.bg || '#10151a'; g.fillRect(0, 0, W, H);
    g.fillStyle = th.board; g.beginPath(); g.roundRect ? g.roundRect(geo.ox, geo.oy, world.w * geo.s, world.h * geo.s, 6) : g.rect(geo.ox, geo.oy, world.w * geo.s, world.h * geo.s); g.fill(); g.strokeStyle = P.line || '#38424d'; g.lineWidth = 2; g.stroke();
    const pl = (res && res.plane) || c.plane;
    if (pl && pl.rect) { const r = pl.rect; g.fillStyle = th.plane; g.fillRect(px(r[0]), py(r[1]), r[2] * geo.s, r[3] * geo.s); g.strokeStyle = P.mass || '#3fd7c0'; g.lineWidth = 1; g.strokeRect(px(r[0]), py(r[1]), r[2] * geo.s, r[3] * geo.s); }
    else if (ctl.stack && ctl.stack !== '2') { g.fillStyle = th.plane; g.fillRect(px(1), py(1), (world.w - 2) * geo.s, (world.h - 2) * geo.s); }
    ((res && res.slits) || (pl && pl.slits) || []).forEach(sl => { g.strokeStyle = th.slit; g.lineWidth = Math.max(4, 2 * geo.s); g.lineCap = 'round'; g.beginPath(); g.moveTo(px(sl.x0), py(sl.y0)); g.lineTo(px(sl.x1), py(sl.y1)); g.stroke(); g.lineCap = 'butt'; });
    const fw = (res && res.forward) || [], rt = (res && res.ret) || [], poly = polyOf(fw, rt);
    const refA = o.refArea > 0 ? o.refArea : (res && res.area) || 1, rel = clamp(((res && res.area) || 0) / refA, 0, 1.5), pulse = o.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(o.t / 1000 * Math.PI * 2 * 1.2);
    if (poly.length >= 3) { g.beginPath(); poly.forEach((p, k) => (k ? g.lineTo(px(p[0]), py(p[1])) : g.moveTo(px(p[0]), py(p[1])))); g.closePath(); g.fillStyle = P.src || '#ff8a5c'; g.globalAlpha = clamp(0.10 + 0.40 * rel * (0.7 + 0.3 * pulse), 0.05, 0.6); g.fill(); g.globalAlpha = 1; g.setLineDash([5, 4]); g.strokeStyle = P.src || '#ff8a5c'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); }
    ((res && res.parts) || c.parts || []).forEach(p => drawPart(g, p, geo, P));
    ((res && res.vias) || []).forEach(v => { const x = Array.isArray(v) ? v[0] : v.x, y = Array.isArray(v) ? v[1] : v.y; g.beginPath(); g.arc(px(x), py(y), Math.max(3, 1.1 * geo.s), 0, 7); g.fillStyle = th.via; g.fill(); g.strokeStyle = P.bg || '#10151a'; g.lineWidth = 1.2; g.stroke(); });
    g.lineJoin = 'round';
    if (rt.length > 1) { g.strokeStyle = P.mass || '#3fd7c0'; g.lineWidth = 2; g.setLineDash([6, 4]); path(g, rt, px, py); g.stroke(); g.setLineDash([]); }
    if (fw.length > 1) { g.strokeStyle = th.copper; g.lineWidth = Math.max(3, 1.4 * geo.s); path(g, fw, px, py); g.stroke(); }
    if (o.view === 'feld' && poly.length >= 3) drawRings(g, poly, px, py, rel, o, P);
    else if (o.view !== 'z' && !o.ghost) drawParticles(g, o.pool, px, py, o, P);
    /* Fehlermarken: gefundene (oder aufgelöste) Fehler als gestrichelter Rahmen mit Nummer */
    (cs.c && cs.c.defects || []).forEach((d, i) => { if (!o.found || !(o.found[d.id] || o.showAll)) return; const r = d.rect; g.strokeStyle = P.bad || '#ff5c5c'; g.lineWidth = 2.5; g.setLineDash([4, 3]); g.strokeRect(px(r[0]), py(r[1]), r[2] * geo.s, r[3] * geo.s); g.setLineDash([]); if (UT()) UT().label(g, String(i + 1), px(r[0]) + 2, py(r[1]) - 8, { size: 12, bold: true, W, bgc: P.bad, color: '#fff' }); });
    if (res && fin(res.area) && poly.length && UT()) { let cx = 0, cy = 0; poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length; UT().label(g, 'A = ' + fnum(res.area, 1) + ' mm²', clamp(px(cx), 60, W - 60), clamp(py(cy), 14, H - 14), { size: W < 460 ? 11 : 12, bold: true, align: 'center', W }); }
    return geo;
  }
  const path = (g, pts, px, py) => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(px(p[0]), py(p[1])) : g.moveTo(px(p[0]), py(p[1])))); };
  function drawPart(g, p, geo, P) {
    if (!p) return; const kind = String(p.kind || p.type || p.t || ''), x = fin(p.x) ? p.x : (Array.isArray(p) ? p[0] : 0), y = fin(p.y) ? p.y : (Array.isArray(p) ? p[1] : 0);
    const w = fin(p.w) ? p.w : kind === 'ic' ? 12 : 4, h = fin(p.h) ? p.h : kind === 'ic' ? 12 : 2.4, name = p.label || p.name || p.id || '';
    const cx = p.cx !== undefined ? p.cx : x + w / 2, cy = p.cy !== undefined ? p.cy : y + h / 2, X = geo.ox + (cx - w / 2) * geo.s, Y = geo.oy + (cy - h / 2) * geo.s, pw = w * geo.s, ph = h * geo.s;
    g.fillStyle = kind === 'ic' ? '#2b3340' : /xtal|quarz/.test(kind) ? '#9aa5b1' : /conn|stecker/.test(kind) ? '#5a6572' : '#2a5fb0'; g.fillRect(X, Y, pw, ph); g.strokeStyle = P.fg || '#e8ecf0'; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, pw, ph);
    if (name && pw > 22 && UT()) { g.font = '11px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(name), X + pw / 2, Y + ph / 2, pw - 2); }
  }
  /* Partikelsystem (klein): feste Zahl, Pfade als Polylinien, kein new im Bild */
  function mkPool(paths, counts, seed) {
    const items = []; let s = seed || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    paths.forEach((pp, k) => { const len = pathLen(pp.pts); (pp.n > 0 ? Array.from({ length: pp.n }) : []).forEach(() => items.push({ k, u: rnd(), len })); });
    return { items, paths, step(dt, speed) { items.forEach(it => { const L = Math.max(1, it.len); it.u += (speed * dt / L) * (paths[it.k].dir || 1); it.u -= Math.floor(it.u); }); } };
  }
  const pathLen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
  function atU(pts, u) { const L = pathLen(pts); let d = u * L; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l || i === pts.length - 1) { const t = l > 0 ? clamp(d / l, 0, 1) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, (pts[i][0] - pts[i - 1][0]) / (l || 1), (pts[i][1] - pts[i - 1][1]) / (l || 1)]; } d -= l; } return [pts[0][0], pts[0][1], 1, 0]; }
  function drawParticles(g, pool, px, py, o, P) {
    if (!pool) return; const prev = g.globalCompositeOperation; if (o.quality !== 'niedrig') g.globalCompositeOperation = 'lighter';
    pool.paths.forEach((pp, k) => { if (!pp.n || pp.pts.length < 2) return; g.fillStyle = pp.color; g.globalAlpha = 0.95; g.beginPath(); pool.items.forEach(it => { if (it.k !== k) return; const q = atU(pp.pts, o.reduced ? (it.u * 0 + (pool.items.indexOf(it) % 12) / 12) : it.u); g.rect(px(q[0]) - 1.5, py(q[1]) - 1.5, 3, 3); }); g.fill(); });
    g.globalAlpha = 1; g.globalCompositeOperation = prev;
    /* Richtungspfeile (auch bei reduzierter Bewegung) */
    pool.paths.forEach(pp => { if (!pp.n || pp.pts.length < 2) return; const q = atU(pp.pts, 0.5), dx = q[2] * (pp.dir || 1), dy = q[3] * (pp.dir || 1), x = px(q[0]), y = py(q[1]); g.fillStyle = pp.color; g.beginPath(); g.moveTo(x + dx * 7, y + dy * 7); g.lineTo(x - dx * 4 - dy * 4, y - dy * 4 + dx * 4); g.lineTo(x - dx * 4 + dy * 4, y - dy * 4 - dx * 4); g.closePath(); g.fill(); });
  }
  function drawRings(g, poly, px, py, rel, o, P) {
    let cx = 0, cy = 0; poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length; const n = 4;
    for (let k = 1; k <= n; k++) { const ph = o.reduced ? 0 : ((o.t / 1800) % 1), r = (k + ph) * 5; g.strokeStyle = P.h || '#ffc64d'; g.globalAlpha = clamp(0.5 * rel * (1 - k / (n + 1)), 0.05, 0.6); g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.ellipse(px(cx), py(cy), px(r) - px(0), py(r * 0.7) - py(0), 0, 0, 7); g.stroke(); g.setLineDash([]); }
    g.globalAlpha = 1;
  }

  E.lay.render = function (host, api) {
    if (!host) return; ST.host = host; ST.api = api; const UTL = UT(); if (UTL) UTL.injectCss('emv-lay-css', CSS); else if (typeof document !== 'undefined' && !document.getElementById('emv-lay-css')) { const s = document.createElement('style'); s.id = 'emv-lay-css'; s.textContent = CSS; document.head.appendChild(s); }
    const rig = api.rig, core = api.EMV_CORE || CORE();
    if (!rig || (api.S && api.S.rigId !== 'layout')) { host.innerHTML = `<div class="card pl"><h4>Layout-Fälle</h4><p class="big">Dieser Tab braucht den Prüfstand Leiterplatten-Layout</p><p class="hint2">${api.S && api.S.task ? 'Die laufende Aufgabe nutzt einen anderen Prüfstand. Beende sie, um die Fälle zu öffnen.' : 'Der Prüfstand Leiterplatten-Layout ist noch nicht geladen.'}</p><div class="btns"><button class="btn" data-ly="retry">Erneut prüfen</button></div></div>`; wire(host, api); return; }
    const cases = casesOf(core, rig); ST.cases = cases;
    if (!cases.length) { host.innerHTML = '<div class="card pl"><h4>Layout-Fälle</h4><p class="big">Keine Fälle</p><p class="hint2">Der Prüfstand nennt keine Fälle.</p></div>'; return; }
    const cur = (rig.getControl && rig.getControl('fall')) || cases[0].id; if (ST.open && !caseById(cases, ST.open)) ST.open = null;
    const done = solvedList(api);
    host.innerHTML = `<div class="card pl"><h4>Fallbuch Leiterplatten-Layout</h4>
      <p class="hint2" style="margin:0">Zwölf vorgegebene Fälle: Finde, wo der Rückstrom einen Umweg nimmt oder wo die Schleife groß ist, und behebe es. <b data-n>${done.length}</b> von ${cases.length} gelöst. Ein Fall ist gelöst, wenn die Ampel mit mindestens einer Maßnahme grün ist. Alle Zahlen sind Übungswerte.</p>
      <label class="chk"><input type="checkbox" id="lyFind"${ST.find ? ' checked' : ''}> Erst erkennen, dann beheben: Die Maßnahmen schalten sich erst frei, wenn du alle Fehler des Falls gefunden hast.</label></div>
      <div id="lyBook" ${ST.open ? 'hidden' : ''}><div class="lyg">${cases.map(c => `<button class="lyc${c.id === cur ? ' on' : ''}" data-case="${esc(c.id)}" aria-label="Fall ${c.idx + 1}: ${esc(c.title)}${done.includes(c.id) ? ', gelöst' : ''}"><canvas data-mini="${esc(c.id)}" aria-hidden="true"></canvas>${done.includes(c.id) ? '<span class="ok" aria-hidden="true">✓</span>' : ''}<b>${c.idx + 1} ${esc(c.title)}</b><small>${esc(c.kurz)}</small></button>`).join('')}</div></div>
      <div id="lyDetail" ${ST.open ? '' : 'hidden'}></div>`;
    wire(host, api); drawMinis(host, api, core, cases);
    if (ST.open) openCase(ST.open, true);
    startLoop(host, api);
  };
  E.lay.refresh = function () { if (ST.host && ST.api) { if (ST.open) renderDetail(); else ST.dirty = true; } };
  E.lay.redraw = function () { ST.dirty = true; };

  function drawMinis(host, api, core, cases) {
    if (!host.querySelectorAll) return; host.querySelectorAll('canvas[data-mini]').forEach(cv => {
      const cs = caseById(cases, cv.dataset.mini); if (!cs || !cv.getContext) return; const W = cv.clientWidth || 150, H = Math.round(W * 0.7), dpr = Math.min(2, root.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const res = baseSolve(core, cs); drawBoard(g, W, H, cs, res || { forward: (cs.c && cs.c.forward) || [] }, { stack: cs.c && cs.c.stackDefault }, { t: 0, reduced: true, pad: 4, view: 'mini', ghost: true, quality: 'niedrig' });
    });
  }

  function ctlNow() { const rig = ST.api && ST.api.rig; try { return rig && rig.getControls ? rig.getControls() : {}; } catch (e) { return {}; } }
  function openCase(id, keep) {
    const api = ST.api; if (!api || !api.rig) return; const cases = ST.cases || [], cs = caseById(cases, id); if (!cs) return;
    if (!keep || (api.rig.getControl && api.rig.getControl('fall') !== id)) { if (api.rig.getControl('fall') !== id) api.setCtl('fall', id); ST.found = {}; ST.shown = false; ST.msg = ''; ST.mode = 'nachher'; ST.view = 'strom'; ST.pool = null; }
    ST.open = id; const b = ST.host.querySelector('#lyBook'), d = ST.host.querySelector('#lyDetail'); if (b) b.hidden = true; if (d) d.hidden = false; renderDetail();
  }
  function closeCase() { ST.open = null; const b = ST.host.querySelector('#lyBook'), d = ST.host.querySelector('#lyDetail'); if (b) b.hidden = false; if (d) d.hidden = true; const n = ST.host.querySelector('[data-n]'); if (n) n.textContent = String(solvedList(ST.api).length); drawMinis(ST.host, ST.api, ST.api.EMV_CORE || CORE(), ST.cases); }
  function defectsOf(cs) { return (cs && cs.c && Array.isArray(cs.c.defects)) ? cs.c.defects : []; }
  const allFound = cs => { const ds = defectsOf(cs); return ds.length === 0 || ds.every(d => ST.found[d.id]) || ST.shown; };
  const locked = cs => ST.find && !allFound(cs);

  function renderDetail() {
    const host = ST.host, api = ST.api, rig = api.rig, el = host.querySelector('#lyDetail'); if (!el || !ST.open) return; const cs = caseById(ST.cases, ST.open); if (!cs) return;
    const ctl = ctlNow(), ds = defectsOf(cs), ctlDef = k => (rig.controls || []).find(c => c.key === k) || null, fixLab = n => { const f = cs.c && cs.c.fixes && cs.c.fixes[n - 1]; return f ? f.text : (ctlDef('fix' + n) || {}).label || 'Maßnahme ' + n; };
    const nFix = cs.c && cs.c.fixes ? cs.c.fixes.length : [1, 2, 3].filter(n => ctlDef('fix' + n)).length, lock = locked(cs), stk = ctlDef('stack'), hasZ = (rig.meters || []).some(m => m.key === 'z100') && (ctl.fall === 'abblock-weit' || ctl.fall === 'abblock-viel');
    const fd = ctlDef('f'), idf = ctlDef('i'), snaps = [];
    el.innerHTML = `<div class="card pl"><div class="lyrow" style="margin:0 0 6px"><button class="chip s" data-ly="back">← Alle Fälle</button><span class="hint2" style="margin:0"><b>${cs.idx + 1} ${esc(cs.title)}</b></span></div>
      <p class="hint2" style="margin:0 0 6px">${esc(cs.kurz)}</p>
      <div class="lyrow" role="group" aria-label="Anzeige"><span class="seg" role="group" aria-label="Vorher und Nachher">${[['nachher', 'Nachher'], ['vorher', 'Vorher'], ['wischer', 'Wischer']].map(([k, n]) => `<button data-lm="${k}" class="${ST.mode === k ? 'on' : ''}" aria-pressed="${ST.mode === k}">${n}</button>`).join('')}</span>
        <span class="seg" role="group" aria-label="Ansicht"><button data-lv="strom" class="${ST.view === 'strom' ? 'on' : ''}" aria-pressed="${ST.view === 'strom'}">Strom</button><button data-lv="feld" class="${ST.view === 'feld' ? 'on' : ''}" aria-pressed="${ST.view === 'feld'}">Feld</button>${hasZ ? `<button data-lv="z" class="${ST.view === 'z' ? 'on' : ''}" aria-pressed="${ST.view === 'z'}">Impedanz (z)</button>` : ''}</span></div>
      <div class="lybd${ST.view === 'z' ? ' z' : ''}" id="lyBd"><canvas id="lyCv" role="img" aria-label="Leiterplatte von oben"></canvas><div class="lywipe" id="lyWipe" ${ST.mode === 'wischer' ? '' : 'hidden'} role="slider" tabindex="0" aria-label="Wischer zwischen Ausgangszustand und aktuellem Zustand"></div></div>
      <div id="lyAmp" class="amprow" role="status"></div><div class="lymet" id="lyMet"></div></div>
      <div class="card pl"><h4>Einstellungen</h4><div class="lyctl">
        <label class="f"><span>Frequenz f <b id="lyFv"></b></span><input type="range" id="lyF" min="0" max="1000" step="1" aria-label="Frequenz"></label>
        <label class="f"><span>Strom i <b id="lyIv"></b></span><input type="range" id="lyI" min="0" max="1000" step="1" aria-label="Strom"></label></div>
        <div class="lyrow" id="lySnap"></div>
        ${stk ? `<div class="lyrow"><span class="hint2" style="margin:0">Lagenaufbau</span><span class="seg" role="group" aria-label="Lagenaufbau">${(stk.options || []).map((o, i) => `<button data-ls="${i}" class="${String(ctl.stack) === String(o.value) ? 'on' : ''}" aria-pressed="${String(ctl.stack) === String(o.value)}">${esc(o.label)}</button>`).join('')}</span></div>` : ''}
        <div class="gh" style="padding-left:0">Maßnahmen${lock ? ' (erst Fehler finden)' : ''}</div>
        ${Array.from({ length: nFix }, (_, k) => k + 1).map(n => `<button class="lyfx" data-fx="${n}" role="switch" aria-checked="${!!ctl['fix' + n]}"${lock ? ' disabled' : ''}><span>${esc(fixLab(n))}</span><span class="tg"><i></i></span></button>`).join('')}
        ${lock ? '<p class="hint2">Tippe im Bild auf die Stellen, die du für Fehler hältst. Hast du alle gefunden, schalten sich die Maßnahmen frei. Mit „Auflösen“ siehst du alle Fehler sofort.</p>' : ''}
      </div>
      ${ds.length ? `<div class="card pl"><h4>Fehler finden</h4><p class="hint2" style="margin:0">Tippe ins Bild auf die Stelle, an der du einen Fehler vermutest. <b>${ds.filter(d => ST.found[d.id] || ST.shown).length}</b> von ${ds.length} gefunden.</p><ul class="lyfd" id="lyFd" style="list-style:none;padding-left:10px">${ds.map((d, i) => (ST.found[d.id] || ST.shown) ? `<li><span class="f">✓ Fehler ${i + 1}:</span> ${esc(d.text)}</li>` : `<li class="hint2">Fehler ${i + 1}: noch nicht gefunden</li>`).join('')}</ul><div class="btns"><button class="btn" data-ly="solve"${allFound(cs) ? ' disabled' : ''}>Auflösen</button></div><div class="readout" id="lyMsg" aria-live="polite">${esc(ST.msg || '')}</div></div>` : ''}`;
    syncDetail(); ST.dirty = true; if (UT() && ST.view === 'z') ST.zDirty = true;
  }
  const sliderPos = (c, v) => (c.scale === 'log' && c.min > 0 ? Math.round(1000 * Math.log(clamp(v, c.min, c.max) / c.min) / Math.log(c.max / c.min)) : Math.round(1000 * (clamp(v, c.min, c.max) - c.min) / ((c.max - c.min) || 1)));
  const sliderVal = (c, p) => (c.scale === 'log' && c.min > 0 ? c.min * Math.pow(c.max / c.min, p / 1000) : c.min + (c.max - c.min) * p / 1000);
  function syncDetail() {
    const host = ST.host, api = ST.api, rig = api.rig; if (!ST.open || !host.querySelector) return; const cs = caseById(ST.cases, ST.open), ctl = ctlNow(), $ = s => host.querySelector(s); if (!cs) return;
    const fd = (rig.controls || []).find(c => c.key === 'f'), idf = (rig.controls || []).find(c => c.key === 'i'), F = $('#lyF'), I = $('#lyI');
    const act = typeof document !== 'undefined' ? document.activeElement : null;
    if (fd && F && act !== F) F.value = sliderPos(fd, ctl.f); if (idf && I && act !== I) I.value = sliderPos(idf, ctl.i);
    const fv = $('#lyFv'), iv = $('#lyIv'); if (fv) fv.textContent = api.fe ? api.fe(ctl.f, 'Hz') : fnum(ctl.f, 0) + ' Hz'; if (iv) iv.textContent = fnum(ctl.i, ctl.i < 10 ? 2 : 1) + ' mA';
    const res = solveFor(api.EMV_CORE || CORE(), ctl); ST.last = res; const sn = $('#lySnap');
    if (sn) { const sp = [[res && fin(res.ft) ? res.ft : null, 'ft = ' + (res && fin(res.ft) ? (api.fe ? api.fe(res.ft, 'Hz') : fnum(res.ft, 0) + ' Hz') : '')], [1e6, '1 MHz'], [1e8, '100 MHz']].filter(x => x[0] != null); const h = '<span class="hint2" style="margin:0">Schnellwahl</span>' + sp.map(x => `<button class="chip s" data-fs="${x[0]}">${esc(x[1])}</button>`).join(''); if (sn.dataset.h !== h) { sn.dataset.h = h; sn.innerHTML = h; } }
    const a = api.assessOf ? api.assessOf(rig) : (rig.assess ? rig.assess() : null), ak = ampKey(a && a.ampel), A = AMP[ak], am = $('#lyAmp');
    if (am) { am.className = 'amprow ' + A[2]; const h = `<span class="asym" aria-hidden="true">${A[0]}</span><div class="atx"><b>${A[1].charAt(0).toUpperCase() + A[1].slice(1)}${a && fin(a.margin) ? ': Marge ' + fnum(a.margin, 1) + ' dB' : ''}</b><small>${esc((a && a.text) || '')}</small></div>`; if (am.dataset.h !== h) { am.dataset.h = h; am.innerHTML = h; } }
    let mv = {}; try { mv = rig.readMeters(); } catch (e) {} const ml = $('#lyMet'); if (ml) { const h = (rig.meters || []).filter(m => !m.visible || m.visible(ctl)).filter(m => ['area', 'lloop', 'ft', 'hf', 'eDb', 'margin', 'z100', 'xtalk'].includes(m.key)).map(m => `<div><small>${esc(m.label)}</small><b>${fnum(mv[m.key], m.digits == null ? 1 : m.digits)}</b><span>${esc(m.unit || '')}</span></div>`).join(''); if (ml.dataset.h !== h) { ml.dataset.h = h; ml.innerHTML = h; } }
    const wasSolved = solvedList(api).includes(ST.open); if (!wasSolved && isSolved(ak, ctl)) { if (markSolved(api, ST.open)) { if (api.toast) api.toast('Fall gelöst: ' + cs.title); beep(0.5); } }
    if (host.querySelectorAll) host.querySelectorAll('[data-fx]').forEach(b => { const on = !!ctl['fix' + b.dataset.fx]; if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  }

  function wire(host, api) {
    if (!host.addEventListener) return;
    once(host, 'lay', 'click', e => {
      const t = e.target; if (!t || !t.closest) return;
      const cs = t.closest('[data-case]'), ly = t.closest('[data-ly]'), lm = t.closest('[data-lm]'), lv = t.closest('[data-lv]'), ls = t.closest('[data-ls]'), fx = t.closest('[data-fx]'), fs = t.closest('[data-fs]');
      if (cs) { openCase(cs.dataset.case, false); return; }
      if (ly) { const a = ly.dataset.ly; if (a === 'back') closeCase(); else if (a === 'solve') { ST.shown = true; renderDetail(); } else if (a === 'retry' && api.setTab) api.setTab('lay'); return; }
      if (lm) { ST.mode = lm.dataset.lm; renderDetail(); return; }
      if (lv) { ST.view = lv.dataset.lv; renderDetail(); return; }
      if (ls) { const c = (api.rig.controls || []).find(x => x.key === 'stack'); if (c) { api.setCtl('stack', c.options[+ls.dataset.ls].value); renderDetail(); } return; }
      if (fx && !fx.disabled) { const k = 'fix' + fx.dataset.fx; api.setCtl(k, !api.rig.getControl(k)); syncDetail(); ST.dirty = true; return; }
      if (fs) { api.setCtl('f', +fs.dataset.fs); syncDetail(); ST.dirty = true; }
    });
    once(host, 'lay', 'change', e => {
      const t = e.target; if (!t) return; if (t.id === 'lyFind') { ST.find = !!t.checked; if (ST.open) renderDetail(); }
    });
    once(host, 'lay', 'input', e => {
      const t = e.target; if (!t || !t.id) return; const rig = api.rig; if (t.id === 'lyF' || t.id === 'lyI') { const key = t.id === 'lyF' ? 'f' : 'i', c = (rig.controls || []).find(x => x.key === key); if (c) { let v = sliderVal(c, +t.value); if (key === 'f') { const res = ST.last, sn = [res && res.ft, 1e6, 1e8].filter(fin); sn.forEach(s => { if (Math.abs(Math.log(v / s)) < 0.04 * Math.log(c.max / c.min)) v = s; }); } api.setCtl(key, v); syncDetail(); ST.dirty = true; } }
    });
    const cv = host.querySelector('#lyCv'); void cv;
  }
  function bindCanvas(cv) {
    if (!cv || cv.dataset.b || !cv.addEventListener) return; cv.dataset.b = '1'; const api = ST.api;
    cv.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.lywipe')) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, geo = ST.geo; if (!geo || ST.view === 'z') return; const cs = caseById(ST.cases, ST.open); if (!cs) return;
      const w = toWorld(geo, px, py), ctl = ctlNow(), d = tapDefect(api.EMV_CORE || CORE(), ctl.fall, w[0], w[1], ctl), msg = ST.host.querySelector('#lyMsg');
      if (api.S) { if (!Array.isArray(api.S.clicks)) api.S.clicks = []; api.S.clicks.push({ x: +w[0].toFixed(2), y: +w[1].toFixed(2), hit: d ? d.id : null, fall: ctl.fall }); }
      if (d) { const fresh = !ST.found[d.id]; ST.found[d.id] = true; ST.msg = 'Gefunden: ' + d.text; if (fresh && api.toast) api.toast('Fehler gefunden'); beep(0.3); renderDetail(); }
      else { ST.msg = WRONG; if (msg) msg.textContent = WRONG; }
    });
    const wp = ST.host.querySelector('#lyWipe'); if (wp) { let drag = null; const set = e => { const r = cv.getBoundingClientRect(); ST.wipe = clamp((e.clientX - r.left) / Math.max(1, r.width), 0.03, 0.97); ST.host.querySelector('#lyBd').style.setProperty('--wp', (ST.wipe * 100).toFixed(1) + '%'); ST.dirty = true; };
      wp.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = e.pointerId; try { wp.setPointerCapture(e.pointerId); } catch (x) {} set(e); }); wp.addEventListener('pointermove', e => { if (drag === e.pointerId) set(e); }); wp.addEventListener('pointerup', e => { if (drag === e.pointerId) drag = null; });
      wp.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); ST.wipe = clamp(ST.wipe + (e.key === 'ArrowLeft' ? -0.05 : 0.05), 0.03, 0.97); ST.host.querySelector('#lyBd').style.setProperty('--wp', (ST.wipe * 100).toFixed(1) + '%'); ST.dirty = true; } }); ST.host.querySelector('#lyBd').style.setProperty('--wp', (ST.wipe * 100).toFixed(1) + '%'); }
  }

  function startLoop(host, api) {
    if (typeof requestAnimationFrame === 'undefined') return; const my = ++ST.loop; let last = 0, lastSync = 0;
    const tick = ts => {
      if (my !== ST.loop || !host.isConnected) return; requestAnimationFrame(tick);
      if (!api.S || api.S.tab !== 'lay' || !ST.open) { last = ts; return; }
      const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; const cv = host.querySelector('#lyCv'); if (!cv) return; bindCanvas(cv);
      if (ts - lastSync > 150) { lastSync = ts; syncDetail(); }
      const cs = caseById(ST.cases, ST.open); if (!cs) return; const ctl = ctlNow(), core = api.EMV_CORE || CORE();
      const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; const dpr = Math.min(2, root.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ST.view === 'z') { drawZ(g, W, H, api); return; }
      const res = ST.last || solveFor(core, ctl); if (!res) { g.fillStyle = (UT() && UT().pal().bg) || '#10151a'; g.fillRect(0, 0, W, H); return; }
      const key = [ctl.fall, ctl.fix1, ctl.fix2, ctl.fix3, ctl.stack, Math.round(ctl.f), (+ctl.i).toFixed(3), ST.view].join('|');
      if (key !== ST.poolKey) { ST.poolKey = key; const P = UT() ? UT().pal() : {}, sp = res.split || { hf: 1, lf: 0 }, c = partCounts(ctl.i, sp, api.quality === 'niedrig' ? 40 : api.quality === 'mittel' ? 70 : 110), fw = res.forward || [], rt = res.ret || [], lf = fw.length > 1 ? [fw[fw.length - 1], fw[0]] : [];
        ST.pool = mkPool([{ pts: fw, color: P.src || '#ff8a5c', dir: 1, n: c.forward }, { pts: rt.length > 1 ? rt : fw.slice().reverse(), color: P.acc || '#52c4f5', dir: -1, n: c.hf }, { pts: lf, color: P.mass || '#3fd7c0', dir: -1, n: c.lf }], c, 7); ST.counts = c; }
      if (ST.pool && !api.reduced && api.S && api.S.running !== false) ST.pool.step(dt * (api.S ? api.S.speed || 1 : 1), 28);
      const base = baseFor(core, cs, ctl), refA = base && fin(base.area) ? base.area : res.area, o = { t: ts, reduced: !!api.reduced, quality: api.quality, view: ST.view, pool: ST.pool, refArea: refA, found: ST.found, showAll: ST.shown, pad: 8 };
      if (ST.mode === 'vorher' && base) ST.geo = drawBoard(g, W, H, cs, base, Object.assign({}, ctl, baseCtl(cs)), Object.assign({}, o, { pool: null, ghost: true }));
      else if (ST.mode === 'wischer' && base) {
        const xw = Math.round(W * ST.wipe); g.save(); g.beginPath(); g.rect(0, 0, xw, H); g.clip(); ST.geo = drawBoard(g, W, H, cs, base, Object.assign({}, ctl, baseCtl(cs)), Object.assign({}, o, { pool: null, ghost: true })); g.restore();
        g.save(); g.beginPath(); g.rect(xw, 0, W - xw, H); g.clip(); drawBoard(g, W, H, cs, res, ctl, o); g.restore(); const P = UT() ? UT().pal() : {}; g.strokeStyle = P.fg || '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(xw, 0); g.lineTo(xw, H); g.stroke(); g.beginPath(); g.arc(xw, H / 2, 20, 0, 7); g.fillStyle = P.panel || '#222'; g.fill(); g.stroke();
        if (UT()) { UT().label(g, 'Vorher (Ausgangszustand)', Math.max(8, xw - 8), 14, { size: 12, align: 'right', W }); UT().label(g, 'Nachher', Math.min(W - 8, xw + 8), 14, { size: 12, W }); }
      } else ST.geo = drawBoard(g, W, H, cs, res, ctl, o);
      if (UT() && ST.mode === 'vorher') UT().label(g, 'Vorher: Ausgangszustand des Falls', 8, 14, { size: 12, W });
      if (UT() && ctl.view !== 'z') UT().label(g, 'Animation verlangsamt (Symbolik, Übungsanlage)', W - 6, H - 10, { size: W < 460 ? 11 : 12, align: 'right', W, bg: false, color: (UT().pal().mute) });
    };
    requestAnimationFrame(tick);
  }
  function baseCtl(cs) { const c = cs.c || {}; return { fall: cs.id, fix1: false, fix2: false, fix3: false, stack: c.stackDefault, f: c.f0, i: (c.i0 || 0.01) * 1000, view: 'strom' }; }
  function baseFor(core, cs, ctl) { const k = cs.id; if (ST.baseKey !== k) { ST.baseKey = k; ST.base = baseSolve(core, cs); } return ST.base; }
  function drawZ(g, W, H, api) {
    const U = UT(), P = U ? U.pal() : {}; g.fillStyle = P.bg || '#10151a'; g.fillRect(0, 0, W, H); let cv = null; try { cv = (api.rig.curves() || []).find(c => /impedanz|\|z\|/i.test((c.title || '') + ' ' + (c.yLabel || ''))); } catch (e) { cv = null; }
    if (!cv || !U) { if (U) U.label(g, 'Dieser Fall hat keine Abblockkondensatoren: Wähle Fall 5 oder 6 für die Impedanzkurve.', 8, H / 2, { size: 13, W }); return; }
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity; cv.series.forEach(s => (s.points || []).forEach(p => { if (fin(p[1]) && fin(p[0]) && p[0] > 0) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); } }));
    if (!fin(y0) || !(y1 > y0)) return; const pad = (y1 - y0) * 0.08, cols = [P.acc, P.src, P.warn, P.mass], dashes = [[], [8, 4], [2, 4]];
    U.lineChart(g, W, H, { xMin: x0, xMax: x1, xLog: true, yMin: Math.max(0, y0 - pad), yMax: y1 + pad, series: cv.series.map((s, i) => ({ name: s.name, pts: s.points, color: cols[i % 4], dash: dashes[i % 3], width: 2 })), marker: cv.marker, xLabel: (cv.xLabel || 'Frequenz') + ' in ' + (cv.xUnit || 'Hz'), yLabel: (cv.yLabel || '|Z|') + ' in ' + (cv.yUnit || 'Ω'), xTick: v => (U.fe || String)(v, 'Hz') });
  }
  if (typeof module !== 'undefined') module.exports = E.lay;
})(typeof window !== 'undefined' ? window : globalThis);
