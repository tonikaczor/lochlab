'use strict';
/* Tonfunk Datenblatt-Lab: Oberfläche.
   Tabs: Bibliothek (Datenblatt-Betrachter DS_VIEW), Lesen üben (Fragen aus DS_LIB berechnet), Fachenglisch (Leitner-Karteikarten, DS_CORE.glossary()),
   Bauteilwahl (Szenarien gegen Datenblattwerte), Rechnen (Rechner mit Rechenweg), Aufgaben (DS_TASKS), Lernen.
   Module: dscore.js (DS_CORE, DS_SCHEMA), dslib-semi.js / dslib-ic.js (DS_LIB), dsview.js (DS_VIEW.mount), dsdata.js (DS_DATA.examples, DS_TASKS). Alles fehlertolerant: fehlt eine Datei, erscheint ein Platzhalter mit "Erneut prüfen".
   Speicher (Präfix ds.): ds.cur (laufender Stand), ds.saves, ds.tab, ds.seen, ds.leitner, ds.read, ds.pick, ds.calcused, ds.curves, ds.opens; sim.done (Aufgaben, gemeinsam mit den anderen Labs).
   Antwortobjekt für Aufgaben (collectAnswer): { ds, tab, value, text, choice, choiceText, calc:{id,vals,res}, marks:[{ds,section,key}], reads:[{graphId,series,x,y}], lastRead, readsN, simTime }.
   Startzustand start()/sol() einer Aufgabe: { ds?, tab?, focus?:{section,key,graphId}, calc?:{id,vals}, mode? }. Beispiele: { id, name, cat, desc, ds, tab?, focus?, calc?, mode? }. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsRaw = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stat = (k, v, m) => { if (root.Badges) try { root.Badges.stat(k, v, m); } catch (e) {} };
  const fin = v => typeof v === 'number' && isFinite(v);
  const parseNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pk = a => a[Math.floor(Math.random() * a.length)];
  function shuffle(a, r) { a = a.slice(); const R = r || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = hashStr(seed) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* Zahlen deutsch: n signifikante Stellen, ohne Nullen am Ende */
  function fx(v, sig) {
    if (!fin(v)) return '–'; if (v === 0) return '0'; sig = sig || 4; const a = Math.abs(v);
    let d = Math.max(0, sig - 1 - Math.floor(Math.log10(a))); d = Math.min(d, 9); let s = (+v).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  const PFX = { p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 }, BASEU = ['V', 'A', 'W', 'Hz', 'Ω', 'F', 's', 'H'];
  /* Einheit -> Faktor zur Basiseinheit (V, A, W, Hz, Ω, F, s); sonst 1 */
  function unitF(u) { u = String(u || '').trim(); if (u.length > 1 && PFX[u[0]] && BASEU.includes(u.slice(1))) return PFX[u[0]]; return 1; }
  const si = (v, u) => (fin(v) ? v * unitF(u) : null);
  function eng(v, u) {   /* 0,0123 A -> 12,3 mA */
    if (!fin(v)) return '–'; if (v === 0) return '0 ' + (u || '');
    const a = Math.abs(v), P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    const f = P.find(p => a >= p[0] * 0.9995) || P[P.length - 1];
    return fx(v / f[0], 3) + ' ' + f[1] + (u || '');
  }
  /* Zahl mit Vorsatz: "4,7k", "100n", "2.2M", "47 k" -> Zahl; Vorsatz nur wenn erlaubt */
  function pv(s, sfx) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/[ΩΩ]+$/, '').replace(/ohm$/i, '').replace(',', '.');
    if (!s) return NaN;
    const iec = s.match(/^(\d+)([pnuµmkMG])(\d+)$/); if (iec) return sfx ? parseFloat(iec[1] + '.' + iec[3]) * PFX[iec[2]] : NaN;   /* 4k7, 2u2, 1M5 */
    const m = s.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([pnuµmkMG]?)$/); if (!m) return NaN;
    if (!m[2]) return parseFloat(m[1]); if (!sfx) return NaN; return parseFloat(m[1]) * PFX[m[2]];
  }

  /* ============================================================ Fenster, Meldungen, Dialoge */
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2400, m.length * 55)); }
  function sheet(title, build, onClose) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    let closed = false;
    const close = () => { if (closed) return; closed = true; bd.remove(); if (onClose) onClose(); };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close;
    build($('.sh-b', bd), close);
    return close;
  }
  function pick(title, options, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        const search = options.length > 14;
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + (search ? '<input id="pq" type="search" placeholder="Suchen …" autocomplete="off" style="margin-bottom:6px">' : '') + '<div id="pl"></div>';
        const draw = q => {
          let last = null, html = '';
          options.forEach((o, i) => {
            if (q && !((o.label || '') + ' ' + (o.sub || '') + ' ' + (o.group || '') + ' ' + (o.value == null ? '' : o.value)).toLowerCase().includes(q)) return;
            if (o.group !== last) { last = o.group; if (o.group) html += `<div class="gh">${esc(o.group)}</div>`; }
            html += `<button class="row" data-i="${i}"${o.disabled ? ' disabled' : ''}>${o.icon ? `<span style="font-size:22px">${o.icon}</span>` : ''}<div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.mark ? `<span class="lv">${esc(o.mark)}</span>` : ''}</button>`;
          });
          $('#pl', b).innerHTML = html || '<p class="hint2">Nichts gefunden.</p>';
        };
        draw('');
        if (search) $('#pq', b).addEventListener('input', e => draw(e.target.value.trim().toLowerCase()));
        b.addEventListener('click', e => { const r = e.target.closest('.row[data-i]'); if (!r || r.disabled) return; fin2(options[+r.dataset.i].value); close(); });
      }, () => fin2(null));
    });
  }
  function ask(title, fields, opt) {
    opt = opt || {};
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = (opt.intro ? `<p class="hint2" style="margin-top:0">${esc(opt.intro)}</p>` : '') + fields.map((f, i) =>
          `<label class="f"><span>${esc(f.label)}</span><input id="ak${i}" type="text" inputmode="${f.type === 'number' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(f.value == null ? '' : f.value)}"></label>`).join('') +
          '<div id="akErr" class="hint2" style="color:#ff8a7a;min-height:18px"></div><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
        const ok = () => {
          const out = {};
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i], raw = $('#ak' + i, b).value;
            if (f.type === 'number') { const v = parseNum(raw); if (!isFinite(v)) { $('#akErr', b).textContent = f.label + ': Bitte eine Zahl eingeben.'; return; } out[f.key] = v; } else out[f.key] = raw;
          }
          fin2(out); close();
        };
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = ok;
        b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        if (!('ontouchstart' in window)) setTimeout(() => { const i = $('#ak0', b); if (i) { i.focus(); i.select(); } }, 60);
      }, () => fin2(null));
    });
  }
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false; const fin2 = v => { if (!done) { done = true; res(v); } };
      sheet(title, (b, close) => {
        b.innerHTML = `<p style="margin-top:0">${text}</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel || 'OK')}</button></div>`;
        $('[data-c]', b).onclick = close; $('[data-ok]', b).onclick = () => { fin2(true); close(); };
      }, () => fin2(false));
    });
  }
  root.LabUI = { sheet, esc, toast, userName: () => lsRaw('lm4.name', ''), LAB: 'ds' };
  root.sheet = sheet; root.toast = toast;

  /* ============================================================ Effekte (immer mit LochFX-Schutz) */
  const fxOn = () => !!(root.LochFX && !root.LochFX.isMuted());
  const FXS = {
    ding() { const F = root.LochFX; if (F) try { F.sound('ding', 0.6); } catch (e) {} },
    tada(text) { const F = root.LochFX; if (F) try { F.sound('tada', 0.7); if (F.isFun && F.isFun()) { F.say(text || 'Gut gelesen! Das stand klein gedruckt dabei.'); F.confetti(false); } } catch (e) {} },
    zap(text) { const F = root.LochFX; if (F) try { F.sound('zap', 0.5); setTimeout(() => { try { F.sound('sad', 0.45); } catch (e) {} }, 380); F.say(text || 'Absolute Maximum Rating ist kein Zielwert!'); } catch (e) {} },
    sad(text) { const F = root.LochFX; if (F) try { F.sound('buzz', 0.35); if (text) F.say(text); } catch (e) {} },
    say(text) { const F = root.LochFX; if (F) try { F.say(text); } catch (e) {} },
    pass(p) { const F = root.LochFX; if (F) try { F.pass(p); } catch (e) {} },
    confetti() { const F = root.LochFX; if (F) try { if (F.isFun && F.isFun()) F.confetti(false); } catch (e) {} }
  };
  /* Wird dem Betrachter als ctx.fx gegeben: aufrufbar (fx('ding')) und mit Methoden (fx.ding()) */
  const fxApi = function (kind, text) { const f = FXS[kind]; if (f) f(text); };
  Object.keys(FXS).forEach(k => { fxApi[k] = FXS[k]; });

  /* ============================================================ Datenzugriff (DS_LIB, DS_CORE, Notfall-Bibliothek) */
  const LIBX = () => (root.DS_LIB && Array.isArray(root.DS_LIB.list) && root.DS_LIB.list.length ? root.DS_LIB.list : null);
  /* Notfall-Datenblatt: nur für die drei Notfall-Fragen, solange DS_LIB leer ist */
  const EMERG = [{
    id: 'tf-notfall', part: 'TF-1N4148 (Notfall)', family: 'Diode', mfr: 'Tonfunk Übung (fiktiv)', lang: 'en', ref: '1N4148', title: 'High-speed switching diode',
    desc: 'Mini-Datenblatt für den Notfall, wenn die Bibliothek nicht geladen ist. Übungsdatenblatt, Werte angelehnt an typische Bauteile.',
    features: ['Fast switching, trr 4 ns typical', 'Reverse voltage up to 100 V'],
    pins: { pkg: 'DO-35', pins: [{ n: 1, name: 'K', type: 'io', desc: 'Cathode' }, { n: 2, name: 'A', type: 'io', desc: 'Anode' }] },
    abs: [{ key: 'vr', param: 'Reverse voltage', sym: 'VR', cond: '', min: null, max: 100, unit: 'V' }, { key: 'if', param: 'Continuous forward current', sym: 'IF', cond: '', min: null, max: 200, unit: 'mA' }, { key: 'ptot', param: 'Total power dissipation', sym: 'Ptot', cond: 'Tamb = 25 °C', min: null, max: 500, unit: 'mW' }],
    rec: [{ key: 'vr', param: 'Reverse voltage', sym: 'VR', min: null, max: 75, unit: 'V' }],
    elec: [{ key: 'vf', param: 'Forward voltage', sym: 'VF', cond: 'IF = 10 mA', min: null, typ: 0.72, max: 1.0, unit: 'V', tj: 25 }, { key: 'ir', param: 'Reverse leakage current', sym: 'IR', cond: 'VR = 20 V', min: null, typ: 5, max: 25, unit: 'nA', tj: 25 }],
    graphs: [{ id: 'if-vf', title: 'Forward current vs. forward voltage', xLabel: 'Forward voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Forward current', yUnit: 'mA', yScale: 'log', series: [{ name: 'Tj = 25 °C', cond: '', points: [[0.5, 0.1], [0.6, 0.8], [0.7, 7], [0.8, 40], [0.9, 120], [1.0, 250]] }], note: '' }],
    thermal: { rthJA: 250, rthJC: null, tjMax: 150, ptotMax: 0.5, note: '' },
    pkgDraw: { name: 'DO-35', dims: [], kind: 'do35' }, app: [], order: [{ type: 'TF-1N4148', pkg: 'DO-35', note: '' }], glossary: [{ en: 'forward voltage', de: 'Flussspannung', note: '' }]
  }];
  const libList = () => LIBX() || [];
  const dsById = id => { const L = LIBX() || EMERG; return (root.DS_LIB && root.DS_LIB.byId && root.DS_LIB.byId[id]) || L.find(d => d.id === id) || null; };
  const CORE = () => root.DS_CORE || null;
  const famIcon = d => { const t = ((d.family || '') + ' ' + (d.title || '') + ' ' + (d.id || '')).toLowerCase(); return /led/.test(t) ? '💡' : /z-?diode|zener|zd/.test(t) ? '⚡' : /diode/.test(t) ? '🔺' : /mosfet|fet\b|2n7000|irlz/.test(t) ? '🔀' : /transistor|bc547|bd139/.test(t) ? '🔀' : /regler|regulator|lm317|7805/.test(t) ? '🔋' : /timer|555/.test(t) ? '⏱️' : /op-?amp|opv|verstärker|lm358/.test(t) ? '📐' : /logik|nand|74hc|gate/.test(t) ? '🧮' : /i²c|i2c|pcf|expander/.test(t) ? '🔗' : /spi|mcp|potentiometer/.test(t) ? '🎚️' : /temperatur|temperature|lm75/.test(t) ? '🌡️' : '📄'; };

  /* ---- Kennlinien-Interpolation (linear oder log), unabhängig vom Kern; außerhalb: null ---- */
  function interpPts(pts, x, xs, ys) {
    if (!pts || pts.length < 2 || !fin(x)) return null;
    const lx = xs === 'log', ly = ys === 'log', X = v => (lx ? Math.log10(v) : v), Y = v => (ly ? Math.log10(v) : v);
    if (x < pts[0][0] - 1e-12 || x > pts[pts.length - 1][0] + 1e-12) return null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (x >= a[0] - 1e-12 && x <= b[0] + 1e-12) { const t = (X(x) - X(a[0])) / (X(b[0]) - X(a[0]) || 1); const y = Y(a[1]) + t * (Y(b[1]) - Y(a[1])); return ly ? Math.pow(10, y) : y; }
    }
    return null;
  }
  const graphY = (g, si2, x) => interpPts(g.series[si2].points, x, g.xScale, g.yScale);
  /* Umkehrung für monotone Kennlinien: x zu gegebenem y; sonst null */
  function graphX(g, si2, y) {
    const pts = g.series[si2].points, ly = g.yScale === 'log', lx = g.xScale === 'log', Y = v => (ly ? Math.log10(v) : v), X = v => (lx ? Math.log10(v) : v);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
      if (y >= lo - 1e-12 && y <= hi + 1e-12 && a[1] !== b[1]) { const t = (Y(y) - Y(a[1])) / (Y(b[1]) - Y(a[1])); const x = X(a[0]) + t * (X(b[0]) - X(a[0])); return lx ? Math.pow(10, x) : x; }
    }
    return null;
  }
  const monotone = pts => { let up = true, dn = true; for (let i = 1; i < pts.length; i++) { if (pts[i][1] <= pts[i - 1][1]) up = false; if (pts[i][1] >= pts[i - 1][1]) dn = false; } return up || dn; };
  /* auf "schöne" Zahl (1; 1,5; 2; 3; 4; 5; 6; 8) runden */
  function niceNum(v) { if (!fin(v) || v <= 0) return v; const e = Math.floor(Math.log10(v)), f = v / Math.pow(10, e), m = f < 1.25 ? 1 : f < 1.75 ? 1.5 : f < 2.5 ? 2 : f < 3.5 ? 3 : f < 4.5 ? 4 : f < 5.5 ? 5 : f < 7 ? 6 : f < 9 ? 8 : 10; return +(m * Math.pow(10, e)).toPrecision(6); }

  /* ============================================================ Zustand */
  const S = { tab: lsRaw('ds.tab', 'lib'), dsId: null, fam: 'Alle', q: '', task: null, readonly: false, name: 'Arbeitsstand', id: null, dirty: false, note: '', marks: {}, calcId: 'led', calcVals: {}, reads: [], lastRead: null, readsN: 0, lastRes: null, simT: 0, seen: lsGet('ds.seen', {}), opens: +lsGet('ds.opens', 0) || 0, curves: lsGet('ds.curves', []) };
  const seenN = () => (LIBX() ? Object.keys(S.seen).filter(id => LIBX().some(d => d.id === id)).length : 0);
  function markSeen(id) {
    S.opens++; lsSet('ds.opens', S.opens); stat('dsread', S.opens, 'max');
    if (!S.seen[id]) { S.seen[id] = 1; lsSet('ds.seen', S.seen); }
    stat('dslibs', seenN(), 'max'); updateChrome();
  }
  function dirty() { S.dirty = true; saveCurSoon(); updateChrome(); }
  let curT = 0;
  function saveCurSoon() { clearTimeout(curT); curT = setTimeout(saveCur, 400); }
  function saveCur() { lsSet('ds.cur', { ds: S.dsId, marks: S.marks, calcId: S.calcId, calcVals: S.calcVals, name: S.name, id: S.id, task: S.task ? S.task.id : null, dirty: S.dirty, note: S.note || '' }); }

  /* ============================================================ Betrachter (DS_VIEW) einbinden */
  const VW = {};   /* key -> { el, inst, getDs } */
  const FILES = ['dscore.js', 'dslib-semi.js', 'dslib-ic.js', 'dsview.js', 'dsdata.js'];
  const libHas = re => !!(root.DS_LIB && root.DS_LIB.list && root.DS_LIB.list.some(d => re.test(d.id)));
  const missingFiles = () => FILES.filter(f => (f === 'dscore.js' && !root.DS_CORE) || (f === 'dslib-semi.js' && !libHas(/^tf-(1n|zd|led|bc|bd|2n|irlz)/)) || (f === 'dslib-ic.js' && !libHas(/^tf-(lm|78|ne|74|pcf|mcp)/)) || (f === 'dsview.js' && !root.DS_VIEW) || (f === 'dsdata.js' && !root.DS_DATA && !root.DS_TASKS));
  function placeholder(el, what, extra) {
    el.innerHTML = `<div class="ph2"><b>${esc(what || 'Noch nicht geladen')}</b>${esc(extra || 'Die benötigte Datei ist noch nicht geladen.')}<br><button class="btn" data-retry>Erneut prüfen</button></div>`;
  }
  const marksOf = ds => (ds && S.marks[ds.id]) || {};
  const marksArr = ds => Object.keys(marksOf(ds)).map(k => { const i = k.indexOf(':'); return { section: k.slice(0, i), key: k.slice(i + 1) }; });
  let onReadHook = null, curQ = null;
  function onViewRead(r) {
    if (!r || typeof r !== 'object') return;
    const rec = { graphId: r.graphId, series: r.series, x: r.x, y: r.y }; S.lastRead = rec; S.readsN++; S.reads.push(rec); if (S.reads.length > 40) S.reads.shift();
    const key = (S.tab === 'read' && curQ ? curQ.ds : S.dsId) + ':' + r.graphId + ':' + (r.series && r.series.name ? r.series.name : r.series);
    if (!S.curves.includes(key)) { S.curves.push(key); lsSet('ds.curves', S.curves); stat('dscurve', S.curves.length, 'max'); }
    if (typeof onReadHook === 'function') onReadHook(rec);
  }
  function onViewMark(m) {
    if (!m || typeof m !== 'object') return;
    const ds = dsById(S.tab === 'read' && curQ ? curQ.ds : S.dsId); if (!ds) return;
    const mk = S.marks[ds.id] || (S.marks[ds.id] = {}), key = (m.section || '') + ':' + (m.key == null ? '' : m.key);
    const on = m.on != null ? !!m.on : m.marked != null ? !!m.marked : m.value != null ? !!m.value : !mk[key];
    if (on) mk[key] = 1; else delete mk[key]; if (!Object.keys(mk).length) delete S.marks[ds.id];
    dirty(); if (S.tab === 'lib') libHead();
  }
  function mountView(key, el, getDs, mode) {
    if (VW[key] && VW[key].el === el && VW[key].inst) return VW[key];
    if (!root.DS_VIEW || typeof root.DS_VIEW.mount !== 'function') { placeholder(el, 'Betrachter noch nicht geladen', 'Die Datei dsview.js fehlt oder ist noch nicht geladen.'); VW[key] = { el, inst: null, getDs }; return VW[key]; }
    el.innerHTML = '';
    let inst = null;
    try {
      inst = root.DS_VIEW.mount(el, { getDs, marks: marksArr(getDs()), getMarks: () => marksArr(getDs()), onRead: onViewRead, onMark: onViewMark, toast, fx: fxApi, mode: mode || 'lesen' });
      if (inst && mode && inst.setMode) try { inst.setMode(mode); } catch (e) {}
    } catch (e) { console.error('Betrachter:', e); placeholder(el, 'Betrachter konnte nicht gestartet werden', String(e && e.message || e)); }
    VW[key] = { el, inst, getDs, mode }; return VW[key];
  }
  function viewRefresh(key) { const v = VW[key]; if (v && v.inst && v.inst.refresh) try { v.inst.refresh(); } catch (e) { console.error(e); } }
  /* anderes Datenblatt (oder geänderte Markierungen): Betrachter neu einhängen, damit seine Markierungen zum Datenblatt passen */
  function viewReload(key) {
    const v = VW[key]; if (!v) return null; const el = v.el, g = v.getDs, m = v.mode;
    try { if (v.inst && v.inst.destroy) v.inst.destroy(); } catch (e) {} delete VW[key]; el.innerHTML = '';
    return mountView(key, el, g, m);
  }
  function viewFocus(key, tgt) { const v = VW[key]; if (v && v.inst && v.inst.focus && tgt) try { v.inst.focus(tgt); } catch (e) { console.error(e); } }
  function viewMode(key, m) { const v = VW[key]; if (v && v.inst && v.inst.setMode) try { v.inst.setMode(m); } catch (e) {} }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-retry]')) retryLoad(); });
  function retryLoad() {
    const want = missingFiles();
    if (!want.length) { Object.keys(VW).forEach(k => { delete VW[k]; }); rebuildAll(); toast('Alles geladen'); return Promise.resolve(); }
    toast('Lade fehlende Dateien …');
    return Promise.all(want.map(f => new Promise(res => { const s = document.createElement('script'); s.src = f + '?t=' + Date.now(); s.onload = s.onerror = () => res(); document.head.appendChild(s); }))).then(() => {
      Object.keys(VW).forEach(k => { delete VW[k]; }); rebuildAll();
      const still = missingFiles().length; toast(still ? still + ' Datei' + (still > 1 ? 'en fehlen' : ' fehlt') + ' noch' : 'Alles geladen');
    });
  }
  function rebuildAll() {
    if (LIBX() && !(S.dsId && LIBX().some(d => d.id === S.dsId))) S.dsId = lsRaw('ds.last', '') && LIBX().some(d => d.id === lsRaw('ds.last', '')) ? lsRaw('ds.last', '') : LIBX()[0].id;
    glossCache = null; qBank = null; buildLib(); setTab(S.tab, true); updateTaskBadge();
  }

  /* ============================================================ Tab Bibliothek */
  const famsOf = () => { const o = []; libList().forEach(d => { if (d.family && !o.includes(d.family)) o.push(d.family); }); return o; };
  const hay = d => d._h || (d._h = [d.part, d.title, d.family, d.ref, d.desc, (d.features || []).join(' '), (d.glossary || []).map(g => g.en).join(' ')].join(' ').toLowerCase());
  function filteredLib() {
    const q = S.q.trim().toLowerCase();
    return libList().filter(d => (S.fam === 'Alle' || d.family === S.fam) && (!q || hay(d).includes(q)));
  }
  function buildLib() {
    const L = libList(), fl = $('#libFam'), li = $('#libList');
    if (!L.length) { fl.innerHTML = ''; $('#libQ').style.display = 'none'; li.innerHTML = '<div class="ph2"><b>Keine Datenblätter geladen</b>Die Bibliothek (dslib-semi.js, dslib-ic.js) ist noch nicht geladen.<br><button class="btn" data-retry>Erneut prüfen</button></div>'; $('#libHead').innerHTML = ''; placeholder($('#vwLib'), 'Noch nicht geladen', 'Ohne Datenblätter gibt es nichts anzuzeigen.'); $('#libSum').textContent = 'Datenblätter'; return; }
    $('#libQ').style.display = '';
    const fams = ['Alle'].concat(famsOf());
    fl.innerHTML = fams.map(f => `<button class="chip s${S.fam === f ? ' on' : ''}" data-fam="${esc(f)}">${esc(f)}${f === 'Alle' ? ' (' + L.length + ')' : ''}</button>`).join('');
    const arr = filteredLib();
    li.innerHTML = arr.length ? arr.map(d => `<button class="row${d.id === S.dsId ? ' on' : ''}" data-ds="${esc(d.id)}"><span class="ic">${famIcon(d)}</span><div class="grow"><b>${esc(d.part)}</b><small>${esc(d.title || d.family || '')}</small></div>${S.seen[d.id] ? '<span class="dot g" style="width:20px;height:20px;font-size:11px">✓</span>' : ''}</button>`).join('') : '<p class="hint2">Nichts gefunden. Probiere einen anderen Suchbegriff oder die Familie „Alle“.</p>';
    const cur = dsById(S.dsId); $('#libSum').textContent = cur ? 'Datenblatt wählen: ' + cur.part : 'Datenblatt wählen';
  }
  function libHead() {
    const d = dsById(S.dsId), h = $('#libHead'); if (!d || !LIBX()) { h.innerHTML = ''; return; }
    const nm = Object.keys(marksOf(d)).length, i = libList().findIndex(x => x.id === d.id);
    h.innerHTML = `<div class="nm">${famIcon(d)} ${esc(d.part)} <span style="font-weight:500;color:var(--mute);font-size:14px">· ${esc(d.family || '')}</span></div>
      <div class="sub">${esc(d.title || '')} · Vorbild: ${esc(d.ref || '–')} · ${esc(d.mfr || '')} · Übungsdatenblatt, Werte angelehnt an typische Bauteile, maßgeblich sind immer die Datenblätter des Herstellers.</div>
      <div class="chips"><button class="chip s" data-lh="prev" aria-label="Vorheriges Datenblatt"${i <= 0 ? ' disabled' : ''}>◀</button><button class="chip s" data-lh="next" aria-label="Nächstes Datenblatt"${i >= libList().length - 1 ? ' disabled' : ''}>▶</button><button class="chip s" data-lh="rand">🎲 Zufällig</button><button class="chip s" data-lh="read">🔍 Fragen dazu</button><button class="chip s" data-lh="calc">🧮 Rechnen</button>${nm ? `<button class="chip s warnc" data-lh="marks"><span class="mark-i"></span>${nm} Markierung${nm > 1 ? 'en' : ''}</button>` : ''}</div>`;
  }
  function selectDs(id, o) {
    o = o || {}; const d = dsById(id); if (!d || !LIBX()) return false;
    const chg = S.dsId !== id; S.dsId = id; if (chg || o.count) markSeen(id);
    if (chg) lsPut('ds.last', id);
    buildLib(); libHead();
    const v = VW.lib && VW.lib.inst ? VW.lib : mountView('lib', $('#vwLib'), () => dsById(S.dsId), 'lesen');
    if (chg && v && v.inst) viewReload('lib');
    if (o.mode) viewMode('lib', o.mode);
    if (o.focus) setTimeout(() => viewFocus('lib', o.focus), 150);
    if (chg && !o.quiet) dirty();
    return true;
  }
  function libStep(dir) { const L = libList(), i = L.findIndex(x => x.id === S.dsId), n = L[i + dir]; if (n) selectDs(n.id); }
  $('#libQ').addEventListener('input', e => { S.q = e.target.value; buildLib(); });
  $('#libSide').addEventListener('click', e => {
    const f = e.target.closest('[data-fam]'), r = e.target.closest('[data-ds]');
    if (f) { S.fam = f.dataset.fam; buildLib(); }
    else if (r) { selectDs(r.dataset.ds); if (window.innerWidth < 900) { const dt = $('#libDet'); if (dt) dt.open = false; } }
  });
  $('#libHead').addEventListener('click', e => {
    const b = e.target.closest('[data-lh]'); if (!b) return; const a = b.dataset.lh;
    if (a === 'prev') libStep(-1); else if (a === 'next') libStep(1); else if (a === 'rand') { const L = libList().filter(x => x.id !== S.dsId); if (L.length) selectDs(pk(L).id); }
    else if (a === 'read') { readFilter.ds = S.dsId; qCur = null; setTab('read'); } else if (a === 'calc') { setTab('calc'); }
    else if (a === 'marks') marksSheet();
  });
  function markText(ds, key) {
    const i = key.indexOf(':'), sec = key.slice(0, i), k = key.slice(i + 1); let r = null, lab = sec;
    const find = (arr, kk) => (arr || []).find(x => String(x.key) === kk || x.sym === kk || x.param === kk);
    if (sec === 'abs') { r = find(ds.abs, k); lab = 'Absolute Maximum Ratings'; } else if (sec === 'rec') { r = find(ds.rec, k); lab = 'Recommended Operating Conditions'; } else if (sec === 'elec') { r = find(ds.elec, k); lab = 'Electrical Characteristics'; }
    else if (sec === 'graphs' || sec === 'graph') { const g = (ds.graphs || []).find(x => x.id === k); r = g ? { param: g.title } : null; lab = 'Kennlinie'; } else if (sec === 'pins') { const p = ((ds.pins || {}).pins || []).find(x => String(x.n) === k || x.name === k); r = p ? { param: 'Pin ' + p.n + ' ' + p.name } : null; lab = 'Pinbelegung'; }
    return lab + ': ' + (r ? (r.param || '') + (r.sym ? ' (' + r.sym + ')' : '') : k);
  }
  function marksSheet() {
    sheet('Meine Markierungen', (b, close) => {
      let rows = [];
      const draw = () => {
        rows = []; Object.keys(S.marks).forEach(id => { const d = dsById(id); if (d) Object.keys(S.marks[id]).forEach(k => rows.push({ d, k })); });
        b.innerHTML = rows.length ? rows.map((r, i) => `<div class="row"><button class="grow" data-go="${i}" style="text-align:left"><b>${esc(r.d.part)}</b><small>${esc(markText(r.d, r.k))}</small></button><button class="chip danger s" data-rm="${i}">Weg</button></div>`).join('') : '<p class="hint2">Keine Markierungen. Im Betrachter kannst du Zeilen markieren, die du dir merken willst.</p>';
      };
      draw();
      b.addEventListener('click', e => {
        const g = e.target.closest('[data-go]'), rm = e.target.closest('[data-rm]');
        if (g) { const r = rows[+g.dataset.go], i = r.k.indexOf(':'); close(); setTab('lib'); selectDs(r.d.id, { focus: { section: r.k.slice(0, i), key: r.k.slice(i + 1) } }); }
        else if (rm) { const r = rows[+rm.dataset.rm]; delete S.marks[r.d.id][r.k]; if (!Object.keys(S.marks[r.d.id]).length) delete S.marks[r.d.id]; dirty(); draw(); libHead(); viewReload('lib'); }
      });
    });
  }

  /* ============================================================ Lesen üben: Fragenbank aus DS_LIB berechnet */
  const CATS = ['Grundlagen', 'Grenzwerte', 'Tabellen', 'Kennlinien', 'Thermik', 'Pins & Gehäuse', 'Fallen'];
  const readFilter = { cat: 'Alle', ds: 'Alle' };
  let qBank = null, qCurSel = null;
  const RD = Object.assign({ ok: {}, n: 0, nOk: 0, streak: 0, best: 0 }, lsGet('ds.read', {}));
  const saveRD = () => lsSet('ds.read', RD);
  const sectionName = { abs: 'Absolute Maximum Ratings', rec: 'Recommended Operating Conditions', elec: 'Electrical Characteristics' };
  const cond = r => (r.cond ? ' bei „' + r.cond + '“' : '');
  const rowLab = r => (r.param || r.key || '') + (r.sym ? ' (' + r.sym + ')' : '');
  const unitTxt = u => (u ? ' ' + u : '');
  function seq(ds, tag, arr, n) { const R = seeded(ds.id + tag); return shuffle(arr, R).slice(0, n); }
  function mkQ(ds, kind, key, o) { return Object.assign({ id: kind + ':' + ds.id + ':' + key, ds: ds.id, type: 'num', tol: 0.5, tolAbs: 0, level: 1 }, o); }
  const UNITGROUPS = [['V', 'mV', 'µV', 'kV'], ['A', 'mA', 'µA', 'nA'], ['W', 'mW', 'µW', 'kW'], ['ns', 'µs', 'ms', 's'], ['Hz', 'kHz', 'MHz', 'GHz'], ['°C', 'K', '°C/W', '%'], ['Ω', 'kΩ', 'MΩ', 'mΩ'], ['pF', 'nF', 'µF', 'F']];
  const GENERIC_PINS = ['VCC', 'GND', 'OUT', 'IN', 'NC', 'ADJ', 'SDA', 'SCL'];
  /* Zahl mit passendem Vorsatz für Fragen und Antworten (0,0476 A wird 47,6 mA); f = Faktor zur Einheit des Datenblatts */
  function nUnit(v, u) {
    if (!BASEU.includes(u) || !fin(v) || v === 0) return { v, u, f: 1 };
    const P = [[1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']], a = Math.abs(v), p = P.find(q => a >= q[0] * 0.9995) || P[P.length - 1];
    return { v: +(v / p[0]).toPrecision(8), u: p[1] + u, f: p[0] };
  }
  const fu = (v, u) => { const n = nUnit(v, u); return fx(n.v, 4) + ' ' + n.u; };
  /* zugehörige Grenzwert-Zeile zu einer Betriebsbedingung (gleicher Schlüssel, gleiches Symbol oder Schlüssel als Vorsilbe, zum Beispiel vce und vceo) */
  const absFor = (ds, r) => (ds.abs || []).find(x => fin(x.max) && x.unit === r.unit && (x.key === r.key || (r.sym && x.sym === r.sym))) || (ds.abs || []).find(x => fin(x.max) && x.unit === r.unit && r.key && x.key && x.key.startsWith(r.key) && x.key.length <= r.key.length + 2);

  /* Generatoren: jede Funktion liefert Fragen für ein Datenblatt; alle Antworten werden aus den Datenblattwerten berechnet */
  const QGEN = [
    function genAbs(ds) {
      const rows = (ds.abs || []).filter(r => fin(r.max) && r.sym !== undefined); return seq(ds, 'abs', rows, 3).map(r => mkQ(ds, 'abs', r.key || r.sym, {
        cat: 'Grenzwerte', level: 1, unit: r.unit, ans: r.max, focus: { section: 'abs', key: r.key },
        text: `Absolute Maximum Ratings: Wie groß darf ${rowLab(r)} höchstens werden${cond(r)}?`,
        where: `Tabelle „Absolute Maximum Ratings“, Zeile ${r.sym || r.param}, Spalte „Max“. Diese Werte sind Grenzen, die du nie überschreiten darfst, aber keine Betriebswerte.`
      }));
    },
    function genTyp(ds) {
      const rows = (ds.elec || []).filter(r => fin(r.typ)); return seq(ds, 'typ', rows, 3).map(r => mkQ(ds, 'typ', r.key || r.sym, {
        cat: 'Tabellen', level: 1, unit: r.unit, ans: r.typ, focus: { section: 'elec', key: r.key },
        text: `Electrical Characteristics: Welchen typischen Wert (Typ) hat ${rowLab(r)}${cond(r)}?`,
        where: `Tabelle „Electrical Characteristics“, Zeile ${r.sym || r.param}, Spalte „Typ“. Achte auf die Testbedingungen: Der Wert gilt nur dort${r.tj != null ? ' (Tj = ' + r.tj + ' °C)' : ''}.`
      }));
    },
    function genWorst(ds) {
      const rows = (ds.elec || []).filter(r => fin(r.min) && fin(r.max)); return seq(ds, 'worst', rows, 2).map((r, i) => {
        const up = (hashStr(ds.id + r.key) & 1) === 0, v = up ? r.max : r.min;
        return mkQ(ds, 'worst', (r.key || r.sym) + (up ? 'max' : 'min'), {
          cat: 'Tabellen', level: 2, unit: r.unit, ans: v, focus: { section: 'elec', key: r.key },
          text: `Worst Case: Wie ${up ? 'groß' : 'klein'} kann ${rowLab(r)}${cond(r)} laut Tabelle im ungünstigsten Fall ${up ? 'höchstens' : 'mindestens'} sein?`,
          where: `Electrical Characteristics, Zeile ${r.sym || r.param}, Spalte „${up ? 'Max' : 'Min'}“. Für eine sichere Auslegung rechnest du mit dem ungünstigsten Wert, nicht mit dem typischen.`
        });
      });
    },
    function genRec(ds) {
      const rows = (ds.rec || []).filter(r => fin(r.max)); return seq(ds, 'rec', rows, 2).map(r => {
        const a = absFor(ds, r);
        return mkQ(ds, 'rec', r.key || r.sym, {
          cat: 'Grenzwerte', level: 2, unit: r.unit, ans: r.max, focus: { section: 'rec', key: r.key },
          text: `Recommended Operating Conditions: Bis zu welchem Wert ${r.min != null ? '(oberes Ende des Bereichs) ' : ''}ist ${rowLab(r)} für den Dauerbetrieb empfohlen?`,
          where: `Tabelle „Recommended Operating Conditions“, Zeile ${r.sym || r.param}, Spalte „Max“.${a ? ' In „Absolute Maximum Ratings“ steht mit ' + fx(a.max) + unitTxt(a.unit) + ' ein anderer Wert: das ist nur die Zerstörungsgrenze.' : ''}`
        });
      });
    },
    function genTrap(ds) {
      const rows = (ds.rec || []).filter(r => { const a = absFor(ds, r); return fin(r.max) && r.max > 0 && a && a.max > r.max * 1.05; });
      return seq(ds, 'trap', rows, 1).map(r => {
        const a = absFor(ds, r), v = niceNum(r.max + (a.max - r.max) * 0.5);
        if (!(v > r.max && v < a.max)) return null;
        return mkQ(ds, 'trap', r.key || r.sym, {
          cat: 'Fallen', level: 2, type: 'choice', trap: true, focus: { section: 'rec', key: r.key },
          text: `Das Absolute Maximum Rating für ${r.sym || r.param} beträgt ${fx(a.max)}${unitTxt(a.unit)}. Du willst ${ds.part} dauerhaft mit ${fx(v)}${unitTxt(a.unit)} betreiben (${rowLab(r)}). Ist das in Ordnung? Sieh im Datenblatt nach, bevor du antwortest.`,
          options: ['Ja, der Wert liegt unter dem Absolute Maximum Rating.', 'Nein, der empfohlene Betriebsbereich (Recommended Operating Conditions) endet bei einem kleineren Wert.', 'Nein, der Wert liegt über dem Absolute Maximum Rating.'], correct: 1,
          where: `In „Recommended Operating Conditions“ steht für ${r.sym || r.param} höchstens ${fx(r.max)}${unitTxt(r.unit)}. Die Absolute Maximum Ratings (${fx(a.max)}${unitTxt(a.unit)}) darfst du nicht dauerhaft ausnutzen: Das ist kein Zielwert, bei Überschreiten des empfohlenen Bereichs sind Funktion und Lebensdauer nicht mehr garantiert.`
        });
      }).filter(Boolean);
    },
    function genCurve(ds) {
      const out = [];
      (ds.graphs || []).forEach((g, gi) => {
        if (!g.series || !g.series.length) return;
        const R = seeded(ds.id + 'cv' + g.id), si2 = Math.floor(R() * g.series.length), pts = g.series[si2].points;
        if (!pts || pts.length < 3) return;
        const x0 = pts[0][0], x1 = pts[pts.length - 1][0], f = [0.3, 0.5, 0.7][Math.floor(R() * 3)];
        let x = g.xScale === 'log' ? x0 * Math.pow(x1 / x0, f) : x0 + f * (x1 - x0);
        x = niceNum(x); if (!(x > x0 && x < x1)) x = g.xScale === 'log' ? Math.sqrt(x0 * x1) : (x0 + x1) / 2;
        const y = graphY(g, si2, x); if (y == null || !isFinite(y)) return;
        const sn = g.series[si2].name || '', ny = nUnit(y, g.yUnit);
        out.push(mkQ(ds, 'curve', g.id, {
          cat: 'Kennlinien', level: 2, unit: ny.u, scale: ny.f, ans: ny.v, tol: g.yScale === 'log' ? 12 : 8, curve: { graphId: g.id, series: si2, x }, focus: { section: 'graphs', key: g.id, graphId: g.id },
          text: `Kennlinie „${g.title}“${sn ? ' (Kurve „' + sn + '“)' : ''}: Lies ${g.yLabel} bei ${g.xLabel} = ${fu(x, g.xUnit)} ab.`,
          where: `Gehe auf der x-Achse (${g.xLabel}, ${g.xScale === 'log' ? 'logarithmisch' : 'linear'}) zu ${fu(x, g.xUnit)}, dann senkrecht bis zur Kurve${sn ? ' „' + sn + '“' : ''} und waagerecht zur y-Achse (${g.yLabel}, ${g.yScale === 'log' ? 'logarithmisch' : 'linear'}). Erwartet: etwa ${fu(y, g.yUnit)}.${g.yScale === 'log' || g.xScale === 'log' ? ' Bei logarithmischen Achsen sind gleiche Abstände gleiche Faktoren, nicht gleiche Differenzen.' : ''}`
        }));
        if (monotone(pts)) {
          const R2 = seeded(ds.id + 'cvi' + g.id), fr = [0.25, 0.45, 0.65, 0.8][Math.floor(R2() * 4)], ys = pts.map(p => p[1]), lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
          let yt = g.yScale === 'log' ? lo * Math.pow(hi / lo, fr) : lo + fr * (hi - lo); yt = niceNum(yt); const xt = graphX(g, si2, yt);
          if (xt != null && yt > lo && yt < hi) { const nx = nUnit(xt, g.xUnit); out.push(mkQ(ds, 'curvei', g.id, {
            cat: 'Kennlinien', level: 3, unit: nx.u, scale: nx.f, ans: nx.v, tol: g.xScale === 'log' ? 12 : 8, curve: { graphId: g.id, series: si2, y: yt }, focus: { section: 'graphs', key: g.id, graphId: g.id },
            text: `Kennlinie „${g.title}“${sn ? ' (Kurve „' + sn + '“)' : ''}: Bei welchem ${g.xLabel} erreicht die Kurve ${g.yLabel} = ${fu(yt, g.yUnit)}? (Umkehrablesung)`,
            where: `Hier liest du umgekehrt ab: Auf der y-Achse (${g.yLabel}) zu ${fu(yt, g.yUnit)}, waagerecht bis zur Kurve, dann senkrecht nach unten zur x-Achse (${g.xLabel}). Erwartet: etwa ${fu(xt, g.xUnit)}.`
          })); }
        }
      });
      return out;
    },
    function genThermal(ds) {
      const th = ds.thermal, o = []; if (!th || !fin(th.rthJA) || !fin(th.tjMax)) return o;
      if (fin(th.ptotMax) && th.ptotMax > 0) {
        const P = niceNum(th.ptotMax * 0.5), ta = pk([40, 50, 60]), tj = ta + P * th.rthJA;
        if (tj < th.tjMax) o.push(mkQ(ds, 'tj', 'a', { cat: 'Thermik', level: 2, unit: '°C', ans: tj, tol: 1.5, tolAbs: 1, focus: { section: 'thermal' }, text: `${ds.part} soll ohne Kühlkörper eine Verlustleistung von ${fx(P)} W bei ${ta} °C Umgebungstemperatur abgeben. Wie hoch wird die Sperrschichttemperatur Tj? (Rth(j-a) steht im Abschnitt Thermik.)`, where: `Abschnitt „Thermal characteristics“: Rth(j-a) = ${fx(th.rthJA)} K/W. Tj = Tamb + P · Rth(j-a) = ${ta} °C + ${fx(P)} W · ${fx(th.rthJA)} K/W = ${fx(tj, 4)} °C.` }));
        const t2 = 70;
        if (th.tjMax > 90) { const pm = (th.tjMax - t2) / th.rthJA, mw = pm < 1; o.push(mkQ(ds, 'tj', 'derate', { cat: 'Fallen', level: 3, trap: true, unit: mw ? 'mW' : 'W', ans: mw ? pm * 1000 : pm, tol: 4, focus: { section: 'thermal' }, text: `Falle Ptot: Wie viel Verlustleistung darf ${ds.part} bei ${t2} °C Umgebungstemperatur (ohne Kühlkörper) höchstens abgeben? Der Tabellenwert für Ptot gilt nur bei 25 °C.`, where: `Aus Tj max = ${fx(th.tjMax)} °C und Rth(j-a) = ${fx(th.rthJA)} K/W folgt Ptot(${t2} °C) = (Tj max − Tamb) / Rth(j-a) = (${fx(th.tjMax)} − ${t2}) / ${fx(th.rthJA)} = ${fx(pm, 4)} W. Der Wert Ptot in der Tabelle (${fx(th.ptotMax)} W) gilt nur bei 25 °C und sinkt mit steigender Temperatur (Derating).` })); }
      }
      o.push(mkQ(ds, 'tj', 'max', { cat: 'Thermik', level: 1, unit: '°C', ans: th.tjMax, tol: 0.5, focus: { section: 'thermal' }, text: `Welche Sperrschichttemperatur Tj max ist für ${ds.part} höchstens zulässig?`, where: `Abschnitt „Thermal characteristics“ bzw. „Absolute Maximum Ratings“, Zeile Junction temperature (Tj max).` }));
      return o;
    },
    function genPins(ds) {
      const pins = ((ds.pins || {}).pins || []), o = []; if (pins.length < 3) return o;
      const names = pins.map(p => p.name), pkg = (ds.pins || {}).pkg || '';
      seq(ds, 'pin', pins.filter(p => p.name && p.type !== 'nc' && names.filter(n => n === p.name).length === 1), 2).forEach(p => {
        let dis = shuffle(names.filter(n => n !== p.name), seeded(ds.id + 'pd' + p.n)).slice(0, 3); GENERIC_PINS.forEach(n => { if (dis.length < 3 && n !== p.name && !dis.includes(n) && !names.includes(n)) dis.push(n); });
        const opts = shuffle([p.name].concat(dis), seeded(ds.id + 'po' + p.n)), L = lab => lab;
        o.push(mkQ(ds, 'pin', String(p.n), { cat: 'Pins & Gehäuse', level: 1, type: 'choice', options: opts.map(L), correct: opts.indexOf(p.name), focus: { section: 'pins', key: String(p.n) }, text: `Welche Funktion (welchen Namen) hat Pin ${p.n} des ${ds.part} im Gehäuse ${pkg}?`, where: `Tabelle „Pin description“ bzw. Gehäusezeichnung: Pin ${p.n} heißt ${p.name}${p.desc ? ' (' + p.desc + ')' : ''}. Pin 1 erkennst du an der Kerbe oder dem Punkt am Gehäuse.` }));
      });
      const g = pins.find(p => p.type === 'gnd');
      if (g) { const nums = shuffle(pins.map(p => p.n).filter(n => n !== g.n), seeded(ds.id + 'gn')).slice(0, 3).concat([g.n]); const opts = shuffle(nums, seeded(ds.id + 'go')).map(String); o.push(mkQ(ds, 'pin', 'gnd', { cat: 'Pins & Gehäuse', level: 1, type: 'choice', options: opts, correct: opts.indexOf(String(g.n)), focus: { section: 'pins', key: String(g.n) }, text: `An welchem Pin des ${ds.part} (${pkg}) liegt die Masse (${g.name})?`, where: `Pinbelegung: Pin ${g.n} ist ${g.name}${g.desc ? ' (' + g.desc + ')' : ''}.` })); }
      o.push(mkQ(ds, 'pincnt', 'n', { cat: 'Pins & Gehäuse', level: 1, unit: '', ans: pins.length, tol: 0, focus: { section: 'pins' }, text: `Wie viele Anschlüsse listet die Pinbelegung des ${ds.part} im Gehäuse ${pkg}?`, where: 'Zähle die Zeilen der Pin-Tabelle (oder die Anschlüsse in der Gehäusezeichnung).' }));
      return o;
    },
    function genPkg(ds) {
      const pkg = (ds.pins || {}).pkg; if (!pkg) return [];
      const others = []; libList().forEach(d => { const p = (d.pins || {}).pkg; if (p && p !== pkg && !others.includes(p)) others.push(p); }); ['TO-220', 'DIP-8', 'SOT-23', 'TO-92', 'SOIC-8', 'TO-126'].forEach(p => { if (p !== pkg && !others.includes(p)) others.push(p); });
      const opts = shuffle([pkg].concat(shuffle(others, seeded(ds.id + 'pk')).slice(0, 3)), seeded(ds.id + 'pko'));
      return [mkQ(ds, 'pkg', 'x', { cat: 'Pins & Gehäuse', level: 1, type: 'choice', options: opts, correct: opts.indexOf(pkg), focus: { section: 'pkg' }, text: `In welchem Gehäuse (Package) wird das ${ds.part} laut Datenblatt geliefert?`, where: `Titelseite und Abschnitt „Package outline“ bzw. „Ordering information“: ${pkg}.` })];
    },
    function genTruth(ds) {
      const t = ds.truth; if (!t || !t.rows || !t.inputs) return [];
      const ni = t.inputs.length; return seq(ds, 'tr', t.rows.map((r, i) => i), 2).map(i => {
        const r = t.rows[i], v = r[ni], inp = t.inputs.map((n, k) => n + ' = ' + r[k]).join(', ');
        return mkQ(ds, 'truth', String(i), { cat: 'Tabellen', level: 1, type: 'choice', options: ['0 (Low)', '1 (High)'], correct: v ? 1 : 0, focus: { section: 'truth' }, text: `Wahrheitstabelle des ${ds.part}: Welchen Pegel hat der Ausgang ${t.outputs[0]} bei ${inp}?`, where: `Abschnitt „Function table“ bzw. Wahrheitstabelle, Zeile mit ${inp}: ${t.outputs[0]} = ${v}.` });
      });
    },
    function genRegs(ds) {
      const rg = (ds.regs || []).filter(r => r.name && /^0x[0-9a-f]+$/i.test(String(r.reset)) && !/ADDRESS|layout|pointer|command/i.test(r.name)); if (rg.length < 2) return [];
      const rs = []; rg.forEach(r => { if (!rs.includes(String(r.reset))) rs.push(String(r.reset)); });
      return seq(ds, 'rg', rg, 2).map(r => {
        const all = rs.filter(x => x !== String(r.reset)); ['0x00', '0xFF', '0x80', '0x01', '0x7F'].forEach(x => { if (all.length < 3 && x !== String(r.reset) && !all.includes(x)) all.push(x); });
        const opts = shuffle([String(r.reset)].concat(shuffle(all, seeded(ds.id + r.name)).slice(0, 3)), seeded(ds.id + r.name + 'o'));
        return mkQ(ds, 'reg', r.name, { cat: 'Tabellen', level: 2, type: 'choice', options: opts, correct: opts.indexOf(String(r.reset)), focus: { section: 'regs', key: r.addr }, text: `Registerbeschreibung des ${ds.part}: Welchen Reset-Wert hat das Register „${r.name}“ (Adresse ${r.addr})?`, where: `Registertabelle, Zeile ${r.name} (${r.addr}), Spalte „Reset“: ${r.reset}.` });
      });
    },
    function genUnit(ds) {
      const rows = (ds.elec || []).concat(ds.abs || []).filter(r => r.unit && UNITGROUPS.some(g => g.includes(r.unit))); return seq(ds, 'un', rows, 1).map(r => {
        const g = UNITGROUPS.find(x => x.includes(r.unit)), opts = shuffle(g, seeded(ds.id + r.key + 'u'));
        return mkQ(ds, 'unit', r.key || r.sym, { cat: 'Grundlagen', level: 1, type: 'choice', options: opts, correct: opts.indexOf(r.unit), focus: { section: (ds.elec || []).includes(r) ? 'elec' : 'abs', key: r.key }, text: `In welcher Einheit ist „${r.param}“ (${r.sym}) im Datenblatt angegeben?`, where: `Die Spalte „Unit“ (Einheit) steht rechts in der Tabelle. Achte auf Vorsätze: ${r.unit} ist nicht dasselbe wie ${opts.find(x => x !== r.unit)}.` });
      });
    },
    function genTjCond(ds) {
      const rows = (ds.elec || []).filter(r => fin(r.tj)); if (!rows.length) return [];
      const r = rows.find(x => x.tj !== 25) || rows[0];
      return [mkQ(ds, 'tjc', r.key || r.sym, { cat: 'Tabellen', level: 2, unit: '°C', ans: r.tj, tol: 0.5, focus: { section: 'elec', key: r.key }, text: `Bei welcher Sperrschichttemperatur Tj gilt der Wert für ${rowLab(r)} in der Tabelle „Electrical Characteristics“?`, where: `Die Testbedingungen stehen in der Spalte „Test conditions“ bzw. in der Tabellenüberschrift${r.tj != null ? ': Tj = ' + r.tj + ' °C' : ''}. Bei anderen Temperaturen können die Werte stark abweichen.` })];
    }
  ];
  function emergBank() {
    const ds = EMERG[0], all = []; QGEN.forEach(g => { try { all.push.apply(all, g(ds)); } catch (e) {} });
    const take = ['abs', 'typ', 'curve'].map(k => all.find(q => q.id.startsWith(k + ':'))).filter(Boolean);
    return take.slice(0, 3);
  }
  function bank() {
    if (qBank) return qBank;
    if (!LIBX()) { qBank = emergBank(); return qBank; }
    const all = []; libList().forEach(ds => QGEN.forEach(g => { try { all.push.apply(all, g(ds)); } catch (e) { console.error('Frage:', ds.id, e); } }));
    const ids = new Set(); qBank = all.filter(q => q && !ids.has(q.id) && ids.add(q.id) && (q.type !== 'choice' || (q.options && q.options.length >= 2 && q.correct >= 0)));
    return qBank;
  }
  const rdPool = () => bank().filter(q => (readFilter.cat === 'Alle' || q.cat === readFilter.cat) && (readFilter.ds === 'Alle' || q.ds === readFilter.ds));
  let qCur = null;
  function nextRead(avoid) {
    const p = rdPool(); if (!p.length) { qCur = null; return null; }
    const fresh = p.filter(q => !RD.ok[q.id] && (!avoid || q.id !== avoid)), src = fresh.length ? fresh : p.filter(q => !avoid || q.id !== avoid);
    qCur = Object.assign({}, pk(src.length ? src : p), { done: false, res: null }); curQ = qCur; qCurSel = null; return qCur;
  }
  function showQuestion(id) { const q = bank().find(x => x.id === id); if (!q) return false; qCur = Object.assign({}, q, { done: false, res: null }); curQ = qCur; qCurSel = null; if (S.tab === 'read') { renderRead(); readQSetup(); } return true; }
  const qAnsText = q => (q.type === 'num' ? fx(q.ans, 4) + unitTxt(q.unit) : q.options[q.correct]);
  function curveHint(q) {
    const g = (dsById(q.ds).graphs || []).find(x => x.id === q.curve.graphId); if (!g) return '';
    return q.curve.x != null ? `Tippe in der Kennlinie auf die Stelle x = ${fu(q.curve.x, g.xUnit)}: der abgelesene Wert wird übernommen.` : `Tippe in der Kennlinie auf die Stelle y = ${fu(q.curve.y, g.yUnit)}: der x-Wert wird übernommen.`;
  }
  function renderRead() {
    const P = $('#rdPanel'), B = bank(), pool = rdPool();
    if (!qCur && pool.length) nextRead();
    if (!B.length) { P.innerHTML = '<div class="ph2"><b>Keine Fragen</b>Es sind keine Datenblätter geladen.<br><button class="btn" data-retry>Erneut prüfen</button></div>'; return; }
    const solved = pool.filter(q => RD.ok[q.id]).length, cats = ['Alle'].concat(CATS.filter(c => B.some(q => q.cat === c)));
    let h = `<div class="big" style="margin:0 0 4px">Lesen üben</div><p class="hint2" style="margin:0 0 8px">${B.length} Fragen, alle Antworten werden live aus den Datenblättern berechnet.${LIBX() ? '' : ' <b style="color:var(--warn)">Notfall-Modus: Bibliothek nicht geladen.</b>'}</p>
      <div class="fbar">${cats.map(c => `<button class="chip s${readFilter.cat === c ? ' on' : ''}" data-rc="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    if (LIBX()) h += `<label class="f" style="margin-bottom:8px"><span>Datenblatt</span><select id="rdDs"><option value="Alle">Alle Datenblätter</option>${libList().map(d => `<option value="${esc(d.id)}"${readFilter.ds === d.id ? ' selected' : ''}>${esc(d.part)}</option>`).join('')}</select></label>`;
    h += `<div class="stbar" aria-label="Fortschritt"><i style="width:${pool.length ? Math.round(100 * solved / pool.length) : 0}%"></i></div><div class="hint2" style="margin:0 0 8px">${solved} von ${pool.length} gelöst${RD.streak > 1 ? ' · ' + RD.streak + ' in Folge' : ''}</div>`;
    const q = qCur;
    if (!q) { h += '<div class="card pl"><p class="hint2">Zu diesem Filter gibt es keine Fragen. Wähle „Alle“.</p></div>'; P.innerHTML = h; return; }
    h += `<div class="qcard on"><div class="qm"><span class="tag">${esc(q.cat)}</span><span class="tag">${'●'.repeat(q.level)}${'○'.repeat(3 - q.level)}</span>${q.trap ? '<span class="tag trap">Falle</span>' : ''}${RD.ok[q.id] ? '<span class="tag">schon gelöst</span>' : ''}<span class="tag">${esc((dsById(q.ds) || {}).part || '')}</span></div><div class="qt">${esc(q.text)}</div>`;
    if (q.type === 'num') h += `<div class="qin"><input id="rdIn" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Antwort"${q.done ? ' disabled' : ''}><span class="u">${esc(q.unit || '')}</span></div>${q.curve ? '<p class="hint2" style="margin:6px 0 0">Tipp: ' + esc(curveHint(q)) + '</p>' : ''}`;
    else h += `<div class="opts" id="rdOpts">${q.options.map((o, i) => `<button data-o="${i}"${q.done ? ' disabled' : ''} class="${q.res ? (i === q.correct ? 'ok' : i === qCurSel ? 'bad' : '') : i === qCurSel ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
    h += `<div class="btns"><button class="btn pri" data-r="chk"${q.done ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-r="where">📍 Wo steht das?</button><button class="btn" data-r="next">${q.done ? 'Nächste Frage' : 'Überspringen'}</button></div><div id="rdFb">${q.res ? q.res : ''}</div></div>`;
    P.innerHTML = h;
    if (q.type === 'num' && !q.done && !('ontouchstart' in window)) setTimeout(() => { const i = $('#rdIn'); if (i && S.tab === 'read') i.focus(); }, 80);
  }
  function readQSetup() {
    const want = qCur ? qCur.ds : (LIBX() ? LIBX()[0].id : EMERG[0].id);
    if (!VW.read || !VW.read.inst) { mountView('read', $('#vwRead'), () => dsById(qCur ? qCur.ds : want), 'ablesen'); VW.read.dsId = want; }
    else if (VW.read.dsId !== want) { viewReload('read'); VW.read.dsId = want; } else viewRefresh('read');
    viewMode('read', 'ablesen');
  }
  function readCheck() {
    const q = qCur; if (!q || q.done) return; let ok = false, given = '';
    if (q.type === 'num') {
      const raw = ($('#rdIn') || {}).value || '', m = String(raw).replace(',', '.').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
      if (!m) { toast('Bitte eine Zahl eingeben.'); return; }
      const x = parseFloat(m[0]), tol = Math.max(Math.abs(q.ans) * q.tol / 100, q.tolAbs || 0); ok = Math.abs(x - q.ans) <= tol + 1e-12; given = fx(x) + unitTxt(q.unit);
    } else { if (qCurSel == null) { toast('Wähle zuerst eine Antwort.'); return; } ok = qCurSel === q.correct; given = q.options[qCurSel]; }
    q.done = true; RD.n++; if (ok) { RD.nOk++; RD.ok[q.id] = 1; RD.streak++; RD.best = Math.max(RD.best, RD.streak); } else RD.streak = 0; saveRD();
    if (ok && q.curve) { const key = 'q:' + q.id; if (!S.curves.includes(key)) { S.curves.push(key); lsSet('ds.curves', S.curves); stat('dscurve', S.curves.length, 'max'); } }
    if (ok) { if (q.trap) FXS.tada(); else FXS.ding(); if (RD.streak > 0 && RD.streak % 5 === 0) { FXS.say(RD.streak + ' richtig in Folge!'); FXS.confetti(); } } else FXS.sad(q.trap ? 'Falle! Lies Recommended und Absolute getrennt.' : '');
    const tolTxt = q.type === 'num' ? (q.tol >= 5 ? ' Beim Ablesen aus Kennlinien sind ' + q.tol + ' % Abweichung in Ordnung.' : q.tol > 0.5 ? ' (Toleranz ' + q.tol + ' %)' : '') : '';
    q.res = `<div class="ex ${ok ? 'ok' : 'bad'}"><b>${ok ? (q.trap ? '✓ Gut gelesen! Das stand klein gedruckt dabei.' : '✓ Richtig!') : '✗ Nicht ganz.'}</b>${ok ? '' : ' Du hast „' + esc(given) + '“ angegeben, richtig ist ' + esc(qAnsText(q)) + '.'}${esc(tolTxt)}</div><div class="wh${q.trap ? ' trap' : ''}"><b>Wo steht das?</b> ${esc(q.where || '')}</div>`;
    renderRead(); viewFocus('read', q.focus);
    if (S.task) updateTaskBar();
  }
  onReadHook = rec => {
    if (S.tab !== 'read' || !qCur || qCur.done || !qCur.curve) return;
    const q = qCur, g = (dsById(q.ds).graphs || []).find(x => x.id === q.curve.graphId); if (!g || rec.graphId !== g.id) return;
    if (rec.series != null && q.curve.series != null && +rec.series !== q.curve.series) { toast('Das ist eine andere Kurve. Gefragt ist „' + (g.series[q.curve.series].name || 'Kurve ' + (q.curve.series + 1)) + '“: Wähle sie in der Legende.'); return; }
    const inp = $('#rdIn'); const dxr = q.curve.x != null ? Math.abs(rec.x - q.curve.x) : 0, pts = g.series[q.curve.series].points, span = Math.abs(pts[pts.length - 1][0] - pts[0][0]) || 1;
    if (q.type === 'num' && q.curve.x != null) {
      const near = g.xScale === 'log' ? Math.abs(Math.log10(rec.x / q.curve.x)) < 0.06 : dxr < span * 0.04;
      if (!near) { toast('Du hast bei x = ' + fx(rec.x, 3) + ' abgelesen, gefragt ist x = ' + fx(q.curve.x) + '.'); return; }
      if (inp) inp.value = fx(rec.y / (q.scale || 1), 3);
    } else if (q.type === 'num' && q.curve.y != null && inp) { inp.value = fx(rec.x / (q.scale || 1), 3); }
    toast('Abgelesen: x = ' + fx(rec.x, 3) + ', y = ' + fx(rec.y, 3));
  };
  $('#rdPanel').addEventListener('click', e => {
    const rc = e.target.closest('[data-rc]'), o = e.target.closest('[data-o]'), r = e.target.closest('[data-r]');
    if (rc) { readFilter.cat = rc.dataset.rc; qCur = null; renderRead(); readQSetup(); return; }
    if (o && qCur && !qCur.done) { qCurSel = +o.dataset.o; $$('#rdOpts button').forEach(b => b.classList.toggle('on', +b.dataset.o === qCurSel)); return; }
    if (!r) return; const a = r.dataset.r;
    if (a === 'chk') readCheck();
    else if (a === 'where') { if (qCur) { viewFocus('read', qCur.focus); toast('Die Stelle ist im Datenblatt markiert.'); } }
    else if (a === 'next') { nextRead(qCur && qCur.id); renderRead(); readQSetup(); }
  });
  $('#rdPanel').addEventListener('change', e => { if (e.target.id === 'rdDs') { readFilter.ds = e.target.value; qCur = null; renderRead(); readQSetup(); } });
  $('#rdPanel').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rdIn') { e.preventDefault(); if (qCur && qCur.done) { nextRead(qCur.id); renderRead(); readQSetup(); } else readCheck(); } });

  /* ============================================================ Fachenglisch: Karteikarten mit Leitner-Kasten */
  const BASE_GLOSS = `absolute maximum ratings|Grenzwerte (absolute Maximalwerte)|Nie überschreiten, keine Betriebswerte
recommended operating conditions|Empfohlene Betriebsbedingungen|Hier arbeitet das Bauteil sicher und wie beschrieben
electrical characteristics|Elektrische Kennwerte|Tabelle mit Min, Typ und Max
forward voltage|Durchlassspannung (Flussspannung)
reverse voltage|Sperrspannung
reverse leakage current|Sperrstrom (Leckstrom)
breakdown voltage|Durchbruchspannung
quiescent current|Ruhestrom|Strom ohne Last
supply current|Versorgungsstrom
supply voltage|Versorgungsspannung
dropout voltage|Mindest-Spannungsdifferenz zwischen Eingang und Ausgang
propagation delay|Signallaufzeit (Verzögerung)
rise time|Anstiegszeit
fall time|Abfallzeit
thermal resistance|Wärmewiderstand|Einheit K/W
junction-to-ambient|von der Sperrschicht zur Umgebung
junction temperature|Sperrschichttemperatur|Tj, die Temperatur im Chip
ambient temperature|Umgebungstemperatur
case temperature|Gehäusetemperatur
storage temperature|Lagertemperatur
operating temperature range|Betriebstemperaturbereich
power dissipation|Verlustleistung
total power dissipation|Gesamtverlustleistung|Ptot, gilt nur bei 25 °C
derating|Leistungsminderung (Derating)|Zulässige Leistung sinkt mit der Temperatur
tolerance|Toleranz
typical|typisch
minimum|Minimalwert
maximum|Maximalwert
test conditions|Testbedingungen (Messbedingungen)
pin assignment|Pinbelegung
pin configuration|Anschlussbelegung
package|Gehäuse
package outline|Gehäusemaße (Zeichnung)
ordering information|Bestellinformation
top view|Draufsicht
datasheet|Datenblatt
features|Merkmale
applications|Anwendungen
general description|Allgemeine Beschreibung
block diagram|Blockschaltbild
typical application|Typische Anwendungsschaltung
application circuit|Anwendungsschaltung
characteristic curve|Kennlinie
output current|Ausgangsstrom
input current|Eingangsstrom
output voltage|Ausgangsspannung
input voltage|Eingangsspannung
load regulation|Lastregelung|Änderung der Ausgangsspannung bei Laständerung
line regulation|Netzregelung|Änderung der Ausgangsspannung bei Eingangsspannungsänderung
ripple rejection|Brummunterdrückung
reference voltage|Referenzspannung
short-circuit current|Kurzschlussstrom
current limit|Strombegrenzung
thermal shutdown|Thermische Abschaltung
overtemperature protection|Übertemperaturschutz
input offset voltage|Eingangsoffsetspannung
input bias current|Eingangsruhestrom (Eingangs-Bias-Strom)
common-mode rejection ratio|Gleichtaktunterdrückung
gain bandwidth product|Verstärkungs-Bandbreite-Produkt
slew rate|Anstiegsgeschwindigkeit (Flankensteilheit)
open-loop gain|Leerlaufverstärkung
unity gain|Verstärkung eins
single supply|einfache Versorgungsspannung (unipolar)
dual supply|symmetrische Versorgung
rail-to-rail|bis an die Versorgungsspannungen (Rail-to-Rail)
threshold voltage|Schwellenspannung
gate-source voltage|Gate-Source-Spannung
on-resistance|Durchlasswiderstand (RDS(on))
drain current|Drain-Strom
collector current|Kollektorstrom
base current|Basisstrom
saturation voltage|Sättigungsspannung
current gain|Stromverstärkung
transition frequency|Transitfrequenz
switching time|Schaltzeit
turn-on time|Einschaltzeit
turn-off time|Ausschaltzeit
reverse recovery time|Sperrverzugszeit
capacitance|Kapazität
continuous|dauerhaft (Dauerwert)
peak|Spitzenwert
pulsed|gepulst (Impulsbetrieb)
duty cycle|Tastverhältnis
frequency|Frequenz
clock|Takt
enable|Freigabe (aktivieren)
chip select|Chipauswahl
serial clock|serieller Takt
serial data|serielle Daten
pull-up resistor|Pull-up-Widerstand
open drain|offener Drain (Open-Drain)
high level|High-Pegel
low level|Low-Pegel
input high voltage|Eingangsspannung für High-Pegel
output low voltage|Ausgangsspannung bei Low-Pegel
hysteresis|Hysterese
noise margin|Störabstand
fan-out|Ausgangslastfaktor
quasi-bidirectional|quasi-bidirektional|Ausgang mit schwachem Pull-up
address|Adresse
register|Register
accuracy|Genauigkeit
resolution|Auflösung
sensitivity|Empfindlichkeit
sink current|Senkenstrom (Strom, den der Ausgang aufnimmt)
source current|Quellenstrom (Strom, den der Ausgang liefert)
heat sink|Kühlkörper
lead-free|bleifrei
pitch|Rastermaß
notch|Kerbe|Markiert die Seite von Pin 1
tab|Kühlfahne
caution|Vorsicht
warning|Warnung
stress|Belastung
functional operation|Funktionsbetrieb
guaranteed|garantiert
unless otherwise specified|sofern nicht anders angegeben
free-air|freie Luft (ohne Kühlkörper)
bias|Vorspannung
gate|Gate (Steueranschluss)
emitter|Emitter
collector|Kollektor
base|Basis
drain|Drain
source|Source
anode|Anode
cathode|Kathode
ground|Masse
output|Ausgang
input|Eingang
supply|Versorgung`;
  const GAPS_FALLBACK = [
    ['The absolute maximum ratings must not be exceeded, not even for a short time.', 'absolute maximum ratings'], ['The forward voltage is measured at a forward current of 10 mA.', 'forward voltage'],
    ['The dropout voltage is the minimum difference between input and output voltage.', 'dropout voltage'], ['Typical values are given at an ambient temperature of 25 °C.', 'ambient temperature'],
    ['The thermal resistance from junction to ambient depends on the board layout.', 'thermal resistance'], ['The device has a built-in thermal shutdown to protect it against overheating.', 'thermal shutdown'],
    ['Pin 1 is marked by a notch on the package.', 'notch'], ['Use a pull-up resistor on the open-drain output.', 'pull-up resistor'], ['The input offset voltage is typically 2 mV.', 'input offset voltage'],
    ['The reverse leakage current increases strongly with temperature.', 'reverse leakage current'], ['Unless otherwise specified, all values apply at a supply voltage of 5 V.', 'unless otherwise specified'],
    ['Above 25 °C the permissible power dissipation must be reduced linearly (derating).', 'derating']
  ];
  let glossCache = null, gapCache = null;
  const gk = g => String(g.en).trim().toLowerCase();
  function glossary() {
    if (glossCache) return glossCache; const map = new Map();
    const add = (g, src, dsn) => { if (!g || !g.en || !g.de) return; const k = String(g.en).trim().toLowerCase(); if (!k || map.has(k)) return; map.set(k, { en: String(g.en).trim(), de: String(g.de).trim(), note: g.note || '', src, ds: dsn || g.ds || '' }); };
    try { const c = CORE() && CORE().glossary && CORE().glossary(); if (Array.isArray(c)) c.forEach(g => add(g, 'core')); } catch (e) { console.error('Glossar:', e); }
    libList().forEach(d => (d.glossary || []).forEach(g => add(g, 'ds', d.part)));
    BASE_GLOSS.split('\n').forEach(l => { const p = l.split('|'); add({ en: p[0], de: p[1], note: p[2] }, 'base'); });
    glossCache = [...map.values()]; return glossCache;
  }
  /* Lückentext-Sätze: aus den Texten der Datenblätter (Merkmale, Beschreibung, Anwendung, Kennlinientitel), sonst eingebaute Sätze */
  function gapSentences() {
    if (gapCache) return gapCache; const G = glossary(), terms = G.filter(g => g.en.length >= 6).sort((a, b) => b.en.length - a.en.length), out = [], seen = new Set();
    const consider = (txt, dsn) => {
      String(txt || '').split(/(?<=[.!?])\s+|\n/).forEach(s0 => {
        const s = s0.trim(); if (s.split(/\s+/).length < 5 || s.length > 170 || seen.has(s)) return; const low = s.toLowerCase();
        for (const g of terms) {
          const k = g.en.toLowerCase(), i = low.indexOf(k); if (i < 0) continue;
          const pre = i > 0 ? low[i - 1] : ' ', post = low[i + k.length] || ' '; if (/[a-z]/.test(pre) || /[a-z]/.test(post)) continue;
          const rest = s.slice(0, i) + s.slice(i + k.length); if (rest.trim().split(/\s+/).length < 3) continue;
          seen.add(s); out.push({ s, a: s.slice(i, i + k.length), t: g.en, i, ds: dsn }); return;
        }
      });
    };
    libList().forEach(d => { [d.desc].concat(d.features || [], (d.app || []).map(a => a.text), (d.graphs || []).map(g => g.title + '. ' + (g.note || '')), d.thermal ? [d.thermal.note] : []).forEach(t => consider(t, d.part)); });
    GAPS_FALLBACK.forEach(([s, t]) => { if (seen.has(s)) return; const i = s.toLowerCase().indexOf(t); if (i >= 0) { out.push({ s, a: s.slice(i, i + t.length), t, i, ds: 'Standardsatz' }); seen.add(s); } });
    gapCache = out; return out;
  }
  const EN = { mode: lsRaw('ds.en.mode', 'en2de'), how: lsRaw('ds.en.how', 'card'), cur: null, flip: false, sel: null, sess: { n: 0, ok: 0 }, recent: [], q: '', done: false };
  let LT = lsGet('ds.leitner', {}); if (!LT || typeof LT !== 'object' || Array.isArray(LT)) LT = {};
  const saveLT = () => lsSet('ds.leitner', LT);
  const DAY = 86400000, INTERVAL = [0, 0, 1, 3, 7, 21];
  const learnedN = () => { const k = new Set(glossary().map(gk)); return Object.keys(LT).filter(x => k.has(x) && (LT[x].b || 0) >= 2).length; };
  function grade(g, ok) {
    const k = gk(g), r = LT[k] || (LT[k] = { b: 0, ok: 0, bad: 0, due: 0 }); const now = Date.now();
    if (ok) { r.ok++; r.b = Math.min(5, Math.max(1, r.b) + 1); } else { r.bad++; r.b = 1; }
    r.due = now + INTERVAL[r.b] * DAY; r.last = now; saveLT(); EN.sess.n++; if (ok) EN.sess.ok++;
    EN.recent.push(k); if (EN.recent.length > 6) EN.recent.shift(); stat('dsengl', learnedN(), 'max');
    if (ok && r.b >= 2 && EN.sess.ok % 10 === 0) { FXS.say(EN.sess.ok + ' Begriffe gewusst!'); FXS.confetti(); }
  }
  function pickCard() {
    const G = glossary(), now = Date.now(); let pool = G;
    if (EN.mode === 'gap') { const ts = new Set(gapSentences().map(x => x.t.toLowerCase())); pool = G.filter(g => ts.has(gk(g))); }
    const ok2 = g => !EN.recent.includes(gk(g)), due = pool.filter(g => { const r = LT[gk(g)]; return r && r.due <= now && ok2(g); }), neu = pool.filter(g => !LT[gk(g)] && ok2(g));
    let g = null;
    if (due.length && (Math.random() < 0.7 || !neu.length)) { const w = due.map(x => 6 - LT[gk(x)].b); let t = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < due.length; i++) { t -= w[i]; if (t <= 0) { g = due[i]; break; } } g = g || due[0]; }
    else if (neu.length) g = pk(neu);
    return g;
  }
  function nextCard(practice) {
    let g = pickCard(); EN.done = false;
    if (!g && practice) { const G = glossary().filter(x => !EN.recent.includes(gk(x))); g = G.length ? pk(G) : pk(glossary()); }
    EN.cur = null; EN.flip = false; EN.sel = null; if (!g) return;
    const c = { g };
    if (EN.mode === 'gap') { const ss = gapSentences().filter(x => x.t.toLowerCase() === gk(g)); const s = pk(ss); c.s = s; c.opts = gapOpts(g, s); c.correct = c.opts.indexOf(g.en.toLowerCase() === s.a.toLowerCase() ? g.en : g.en); }
    else if (EN.how === 'mc') { c.opts = mcOpts(g); c.correct = c.opts.indexOf(EN.mode === 'en2de' ? g.de : g.en); }
    EN.cur = c;
  }
  function mcOpts(g) {
    const G = glossary(), side = EN.mode === 'en2de' ? 'de' : 'en', ans = g[side], L = ans.length;
    const dis = shuffle(G.filter(x => x[side] !== ans && Math.abs(x[side].length - L) < Math.max(14, L)), null).slice(0, 3).map(x => x[side]);
    while (dis.length < 3) { const x = pk(G); if (x[side] !== ans && !dis.includes(x[side])) dis.push(x[side]); }
    return shuffle([ans].concat(dis));
  }
  function gapOpts(g, s) {
    const G = glossary(), n = g.en.split(/\s+/).length, low = s.s.toLowerCase();
    const dis = shuffle(G.filter(x => x !== g && x.en.length >= 5 && !low.includes(x.en.toLowerCase()) && Math.abs(x.en.split(/\s+/).length - n) <= 1), null).slice(0, 3).map(x => x.en);
    while (dis.length < 3) { const x = pk(G); if (x !== g && !dis.includes(x.en)) dis.push(x.en); }
    return shuffle([g.en].concat(dis));
  }
  function renderEngl() {
    const V = $('#enView'), G = glossary(), now = Date.now(), N = G.length;
    if (!N) { V.innerHTML = '<div class="card pl"><h4>Fachenglisch</h4><p class="big">Noch keine Begriffe</p><p class="hint2">Das Glossar ist nicht geladen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>'; return; }
    const cnt = [0, 0, 0, 0, 0, 0]; G.forEach(g => { const r = LT[gk(g)]; cnt[r ? Math.max(1, r.b) : 0]++; });
    const dueN = G.filter(g => { const r = LT[gk(g)]; return r && r.due <= now; }).length, learned = learnedN();
    if (!EN.cur && !EN.done && !EN.empty) { nextCard(false); if (!EN.cur) EN.empty = true; }
    const modes = [['en2de', 'Englisch → Deutsch'], ['de2en', 'Deutsch → Englisch'], ['gap', 'Lückentext']];
    let h = `<div class="card pl"><h4>Fachenglisch · ${N} Begriffe</h4>
      <div class="stbar"><i style="width:${Math.round(100 * learned / N)}%"></i></div><div class="hint2" style="margin:0 0 6px">${learned} von ${N} Begriffen gelernt · ${dueN} zur Wiederholung fällig · diese Runde: ${EN.sess.ok} von ${EN.sess.n} gewusst</div>
      <div class="boxes">${['Neu', 'Kasten 1', 'Kasten 2', 'Kasten 3', 'Kasten 4', 'Kasten 5'].map((n, i) => `<div class="bx${EN.cur && ((LT[gk(EN.cur.g)] || {}).b || 0) === i ? ' cur' : ''}"><b>${cnt[i]}</b>${n}</div>`).join('')}</div>
      <div class="fbar" style="margin-top:6px">${modes.map(m => `<button class="chip s${EN.mode === m[0] ? ' on' : ''}" data-em="${m[0]}">${m[1]}</button>`).join('')}</div>
      ${EN.mode !== 'gap' ? `<div class="fbar"><span class="seg"><button data-eh="card" class="${EN.how === 'card' ? 'on' : ''}">Karteikarte</button><button data-eh="mc" class="${EN.how === 'mc' ? 'on' : ''}">Auswahl</button></span></div>` : ''}</div>`;
    const c = EN.cur;
    if (!c) {
      h += `<div class="card pl"><p class="big">${EN.mode === 'gap' ? 'Keine Sätze zum Üben' : 'Für heute ist alles gelernt'}</p><p class="hint2">${EN.mode === 'gap' ? 'Aus den geladenen Datenblättern ließen sich keine passenden Sätze bilden.' : 'Alle fälligen Karten sind beantwortet. Die nächsten kommen nach den Kasten-Zeiten (1, 3, 7, 21 Tage) wieder. Du kannst trotzdem frei üben.'}</p><div class="btns"><button class="btn pri" data-ea="free">Frei üben</button></div></div>`;
    } else if (EN.mode === 'gap') {
      const s = c.s, left = s.s.slice(0, s.i), right = s.s.slice(s.i + s.a.length), shown = EN.done ? `<span style="color:var(--ok);font-weight:800">${esc(s.a)}</span>` : '<span class="gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>';
      h += `<div class="card-fc" style="cursor:default"><div class="sent">${esc(left)}${shown}${esc(right)}</div><div class="sub">Aus dem Datenblatt ${esc(s.ds || '')} · Tipp: Das Wort heißt auf Deutsch „${esc(c.g.de)}“</div></div><div class="opts">${c.opts.map((o, i) => `<button data-eo="${i}"${EN.done ? ' disabled' : ''} class="${EN.done ? (i === c.correct ? 'ok' : i === EN.sel ? 'bad' : '') : ''}">${esc(o)}</button>`).join('')}</div>`;
    } else {
      const front = EN.mode === 'en2de' ? c.g.en : c.g.de, back = EN.mode === 'en2de' ? c.g.de : c.g.en;
      if (EN.how === 'mc') {
        h += `<div class="card-fc" style="cursor:default"><div class="term">${esc(front)}</div><div class="sub">${EN.mode === 'en2de' ? 'Was heißt das auf Deutsch?' : 'Wie heißt das im Datenblatt auf Englisch?'}</div></div><div class="opts">${c.opts.map((o, i) => `<button data-eo="${i}"${EN.done ? ' disabled' : ''} class="${EN.done ? (i === c.correct ? 'ok' : i === EN.sel ? 'bad' : '') : ''}">${esc(o)}</button>`).join('')}</div>`;
      } else {
        h += `<div class="card-fc${EN.flip ? ' back' : ''}" data-ea="flip" role="button" tabindex="0" aria-label="Karte umdrehen"><div class="term">${esc(EN.flip ? back : front)}</div><div class="sub">${EN.flip ? (esc(front) + (c.g.note ? ' · ' + esc(c.g.note) : '') + (c.g.ds ? ' · aus ' + esc(c.g.ds) : '')) : 'Tippe auf die Karte oder drücke die Leertaste, um sie umzudrehen'}</div></div>`;
        h += EN.flip ? '<div class="btns"><button class="btn danger" data-ea="bad">✗ Nicht gewusst</button><button class="btn pri" data-ea="good">✓ Gewusst</button></div>' : '<div class="btns"><button class="btn" data-ea="flip">Umdrehen</button></div>';
      }
      if (EN.done) h += `<div class="ex ${EN.good ? 'ok' : 'bad'}"><b>${EN.good ? '✓ Richtig!' : '✗ Leider nicht.'}</b> ${esc(c.g.en)} = ${esc(c.g.de)}${c.g.note ? '<br><span class="hint2">' + esc(c.g.note) + '</span>' : ''}</div>`;
    }
    if (c && EN.done && EN.mode === 'gap') h += `<div class="ex ${EN.good ? 'ok' : 'bad'}"><b>${EN.good ? '✓ Richtig!' : '✗ Leider nicht.'}</b> ${esc(c.g.en)} = ${esc(c.g.de)}${c.g.note ? '<br><span class="hint2">' + esc(c.g.note) + '</span>' : ''}</div>`;
    if (c && EN.done) h += '<div class="btns"><button class="btn pri" data-ea="next">Nächste Karte</button></div>';
    h += `<details class="card" style="margin-top:12px"><summary>Wörterbuch (${N} Begriffe)</summary><div class="cb"><input id="enQ" type="search" placeholder="Begriff suchen (Englisch oder Deutsch)" autocomplete="off" value="${esc(EN.q)}"><div id="enDict"></div><div class="btns"><button class="btn danger s" data-ea="reset">Lernstand zurücksetzen</button></div></div></details>`;
    V.innerHTML = h; fillDict();
  }
  function fillDict() {
    const el = $('#enDict'); if (!el) return; const q = EN.q.trim().toLowerCase(), G = glossary().filter(g => !q || g.en.toLowerCase().includes(q) || g.de.toLowerCase().includes(q)).sort((a, b) => a.en.localeCompare(b.en));
    el.innerHTML = `<table class="iot" style="margin-top:6px"><tr><th>Englisch</th><th>Deutsch</th></tr>${G.slice(0, 100).map(g => `<tr><td><b>${esc(g.en)}</b></td><td>${esc(g.de)}${g.note ? '<br><small style="color:var(--mute)">' + esc(g.note) + '</small>' : ''}</td></tr>`).join('')}</table>${G.length > 100 ? '<p class="hint2">… weitere ' + (G.length - 100) + ' Begriffe, nutze die Suche.</p>' : ''}${G.length ? '' : '<p class="hint2">Nichts gefunden.</p>'}`;
  }
  function enAnswer(sel) {
    const c = EN.cur; if (!c || EN.done) return; EN.sel = sel; EN.good = sel === c.correct; EN.done = true; grade(c.g, EN.good);
    if (EN.good) FXS.ding(); else FXS.sad(); renderEngl();
  }
  function enFlip() { if (EN.cur && !EN.flip && EN.mode !== 'gap' && EN.how === 'card') { EN.flip = true; clickSnd0(); renderEngl(); } }
  function clickSnd0() { if (root.LochFX) try { root.LochFX.sound('tick'); } catch (e) {} }
  function enGrade(ok) { const c = EN.cur; if (!c || !EN.flip) return; EN.good = ok; grade(c.g, ok); if (ok) FXS.ding(); else FXS.sad(); EN.done = false; EN.empty = false; nextCard(false); if (!EN.cur) EN.empty = true; renderEngl(); }
  $('#enView').addEventListener('click', async e => {
    const em = e.target.closest('[data-em]'), eh = e.target.closest('[data-eh]'), ea = e.target.closest('[data-ea]'), eo = e.target.closest('[data-eo]');
    if (em) { EN.mode = em.dataset.em; lsPut('ds.en.mode', EN.mode); EN.cur = null; EN.empty = false; EN.done = false; nextCard(false); if (!EN.cur) EN.empty = true; renderEngl(); }
    else if (eh) { EN.how = eh.dataset.eh; lsPut('ds.en.how', EN.how); EN.cur = null; EN.empty = false; EN.done = false; nextCard(false); if (!EN.cur) EN.empty = true; renderEngl(); }
    else if (eo) enAnswer(+eo.dataset.eo);
    else if (ea) {
      const a = ea.dataset.ea;
      if (a === 'flip') enFlip(); else if (a === 'good') enGrade(true); else if (a === 'bad') enGrade(false);
      else if (a === 'next') { EN.empty = false; nextCard(false); if (!EN.cur) EN.empty = true; renderEngl(); }
      else if (a === 'free') { EN.empty = false; nextCard(true); renderEngl(); }
      else if (a === 'reset') { if (await confirmSheet('Lernstand zurücksetzen?', 'Alle Karten beginnen wieder bei „Neu“. Das lässt sich nicht rückgängig machen.', 'Zurücksetzen', true)) { LT = {}; saveLT(); EN.cur = null; EN.empty = false; EN.sess = { n: 0, ok: 0 }; nextCard(false); renderEngl(); toast('Lernstand zurückgesetzt'); } }
    }
  });
  $('#enView').addEventListener('input', e => { if (e.target.id === 'enQ') { EN.q = e.target.value; fillDict(); } });
  $('#enView').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.ea === 'flip') { e.preventDefault(); enFlip(); } });

  /* ============================================================ Bauteilwahl: Anforderungen gegen Datenblattwerte prüfen */
  const rt = r => ((r.key || '') + ' ' + (r.sym || '') + ' ' + (r.param || '')).toLowerCase();
  /* Zeile aus abs/rec/elec nach Muster suchen; Wert in SI; mehrere Treffer: der kleinste Höchstwert (vorsichtig) */
  function rowBy(list, pats, ex, field, pickMax, unitReq) {
    pats = Array.isArray(pats) ? pats : [pats];
    for (const re of pats) {
      const rows = (list || []).filter(r => fin(r[field]) && re.test(rt(r)) && !(ex && ex.test(rt(r))) && (!unitReq || String(r.unit || '').endsWith(unitReq)));
      if (!rows.length) continue;
      rows.sort((a, b) => (si(a[field], a.unit) - si(b[field], b.unit)) * (pickMax ? -1 : 1)); const r = rows[0];
      return { v: si(r[field], r.unit), row: r, txt: (r.sym || r.param) + ' = ' + fx(r[field]) + ' ' + (r.unit || ''), focus: null };
    }
    return null;
  }
  const EXV = /common|logic|output|\bvicm\b|terminal|differential input|clamp|current/;
  const ROLE = {
    vsw: ds => rowBy(ds.abs, /ceo|vce\b|vds\b|drain.?source|collector.?emitter/, /gate|vgs|emitter.?base|ebo|cbo|collector.?base|drain.?gate|vdg|breakdown|v\(br\)/, 'max', false, 'V'),
    vrev: ds => rowBy(ds.abs, /vrrm|repetitive peak reverse|reverse voltage|\bvr\b/, /recovery|trr|current|leak/, 'max', false, 'V'),
    vsup: ds => rowBy(ds.abs, [/supply|\bvcc\b|\bvdd\b/, /input.?voltage|\bvin\b|\bvi\b|voltage differential|differential voltage/], EXV, 'max', false, 'V'),
    icont: ds => rowBy(ds.abs, /continuous|collector current|drain current|forward current|output current|\bic\b|\bid\b|\bif\b|\bio\b|average/, /peak|pulse|surge|repetitive|base|gate|clamp|\bicm\b|\bidm\b|\bifsm\b|\bifrm\b|\bib\b|input/, 'max', false, 'A'),
    vth: ds => rowBy(ds.elec, /threshold|vgs\(th\)|vgs_th|\bvth\b/, null, 'max', false, 'V'),
    vsupMin: ds => rowBy(ds.rec, [/supply|\bvcc\b|\bvdd\b/, /input.?voltage|\bvin\b/], EXV, 'min', true, 'V'),
    vsupMax: ds => rowBy(ds.rec, [/supply|\bvcc\b|\bvdd\b/, /input.?voltage|\bvin\b/], EXV, 'max', false, 'V'),
    vz: ds => { const r = (ds.elec || []).find(x => x.key === 'vz' && fin(x.typ)) || (ds.elec || []).find(x => /^vz/i.test(x.sym || '') && fin(x.typ) && x.unit === 'V'); return r ? { v: si(r.typ, r.unit), row: r, txt: (r.sym || r.param) + ' = ' + fx(r.typ) + ' ' + (r.unit || ''), focus: null } : null; }
  };
  /* Ersatz, wenn der Wert nicht bei den Absolute Maximum Ratings steht (zum Beispiel Ausgangsstrom unter Recommended Operating Conditions) */
  const ROLE_FB = {
    icont: ds => rowBy(ds.rec, /output current|\bio\b|collector current|\bic\b|drain current|forward current|\bif\b/, /peak|pulse|surge|base|gate|\bib\b/, 'max', false, 'A'),
    vsup: ds => rowBy(ds.rec, /supply|\bvcc\b|\bvdd\b|input.?voltage|\bvin\b|\bvi\b/, /logic|output|low|high|common/, 'max', false, 'V')
  };
  const roleF = (role, ds) => { try { const r = ROLE[role](ds) || (ROLE_FB[role] && ROLE_FB[role](ds)); if (r && r.row) r.focus = { section: (ds.abs || []).includes(r.row) ? 'abs' : (ds.rec || []).includes(r.row) ? 'rec' : 'elec', key: r.row.key }; return r; } catch (e) { return null; } };
  function clsOf(ds) {
    const t = ((ds.id || '') + ' ' + (ds.family || '') + ' ' + (ds.title || '')).toLowerCase(), c = [];
    if (/\bled\b|^tf-led/.test(t)) c.push('led');
    if (/z-?diode|zener|^tf-zd/.test(t)) c.push('zener');
    if (!c.length && (/diode|^tf-1n/.test(t))) c.push('diode');
    if (/mosfet|^tf-2n7000|^tf-irlz/.test(t)) c.push('mosfet'); else if (/transistor|^tf-bc|^tf-bd/.test(t)) c.push('bjt');
    if (/regulator|spannungsregler|^tf-lm317|^tf-78/.test(t)) c.push('reg');
    if (/op.?amp|operational|^tf-lm358/.test(t)) c.push('opamp');
    if (/timer|^tf-ne555/.test(t)) c.push('timer');
    if (/^tf-74|logik-ic|nand gate/.test(t)) c.push('logic');
    if (/expander|^tf-pcf/.test(t)) c.push('expander');
    if (/potentiometer|^tf-mcp/.test(t)) c.push('dpot');
    if (/temperature sensor|^tf-lm75/.test(t)) c.push('temp');
    return c;
  }
  const CLSNAME = { led: 'eine LED', zener: 'eine Z-Diode', diode: 'eine Diode', bjt: 'ein Bipolartransistor', mosfet: 'ein MOSFET', reg: 'ein Spannungsregler', opamp: 'ein Operationsverstärker', timer: 'ein Timer-IC', logic: 'ein Logik-IC', expander: 'ein Port-Expander', dpot: 'ein Digitalpotentiometer', temp: 'ein Temperatursensor' };
  const U = (v, u) => fx(v) + ' ' + u;
  /* Prüfungen: liefern { st:'ok'|'bad'|'nn', text, over?, focus } */
  const chkGE = (role, val, raw, label, unit, overCheck) => ds => {
    const r = roleF(role, ds); if (!r) return { st: 'nn', text: label + ': im Datenblatt nicht eindeutig gefunden', focus: null };
    const have = r.v / unitF(unit), ok = r.v >= val - 1e-12;
    return { st: ok ? 'ok' : 'bad', text: `${label}: ${r.txt} ${ok ? '≥' : '<'} geforderte ${fx(val / unitF(unit))} ${unit}`, over: overCheck && raw != null && r.v < raw, focus: r.focus };
  };
  const chkVth = lim => ds => {
    const r = roleF('vth', ds); if (!r) return { st: 'nn', text: 'Gate-Schwellenspannung: nicht gefunden', focus: null };
    const ok = r.v <= lim + 1e-9; return { st: ok ? 'ok' : 'bad', text: `Logikpegel-tauglich für 3,3 V am Gate: Schwellenspannung ${r.txt} (Max) ${ok ? '≤' : '>'} ${fx(lim)} V (Faustregel: Schwelle mindestens 1 V unter der Steuerspannung; voll durchgeschaltet ist der MOSFET erst bei der VGS, für die RDS(on) angegeben ist)`, focus: r.focus };
  };
  const chkSupplyIn = u => ds => {
    const a = roleF('vsupMin', ds), b = roleF('vsupMax', ds); if (!a && !b) return { st: 'nn', text: 'Betriebsspannungsbereich: nicht gefunden', focus: null };
    const lo = a ? a.v : -Infinity, hi = b ? b.v : Infinity, ok = u >= lo - 1e-9 && u <= hi + 1e-9;
    return { st: ok ? 'ok' : 'bad', text: `Betriebsspannung ${fx(u)} V im empfohlenen Bereich (${a ? fx(lo) : '?'} bis ${b ? fx(hi) : '?'} V, Recommended Operating Conditions): ${ok ? 'ja' : 'nein'}`, focus: (a || b).focus };
  };
  const chkThermal = (P, ta, label) => ds => {
    const th = ds.thermal; if (!th || !fin(th.rthJA) || !fin(th.tjMax)) return { st: 'nn', text: 'Thermik: Rth(j-a) oder Tj max fehlt', focus: { section: 'thermal' } };
    const tj = ta + P * th.rthJA, ok = tj <= th.tjMax;
    return { st: ok ? 'ok' : 'bad', text: `${label || 'Sperrschichttemperatur'} ohne Kühlkörper: Tj = ${ta} °C + ${fx(P)} W · ${fx(th.rthJA)} K/W = ${fx(tj, 4)} °C ${ok ? '≤' : '>'} Tj max ${fx(th.tjMax)} °C`, over: !ok, focus: { section: 'thermal' } };
  };
  const chkVz = target => ds => {
    const r = roleF('vz', ds); if (!r) return { st: 'nn', text: 'Zenerspannung: nicht gefunden', focus: null };
    const ok = Math.abs(r.v - target) / target <= 0.05; return { st: ok ? 'ok' : 'bad', text: `Zenerspannung ${r.txt} (Typ) ${ok ? 'passt zu' : 'weicht ab von'} ${fx(target)} V`, focus: r.focus };
  };
  const SCEN = [
    () => { const u = pk([5, 12, 24]), i = pk([0.06, 0.15, 0.3, 1, 3]); return { id: 'last', title: 'Last schalten', text: `Ein Mikrocontroller soll eine induktive Last (Relais oder Motor mit Freilaufdiode) mit ${fx(u)} V und ${fx(i)} A einschalten. Welches Bauteil schaltet das?`, cls: ['bjt', 'mosfet'], reqs: [`Sperrspannung ≥ 1,5 · ${fx(u)} V`, `Dauerstrom ≥ 1,5 · ${fx(i)} A`], checks: [chkGE('vsw', 1.5 * u, u, 'Sperrspannung', 'V', true), chkGE('icont', 1.5 * i, i, 'Dauerstrom', 'A', true)] }; },
    () => { const u = pk([12, 24, 30]), i = pk([0.5, 1, 2, 5]); return { id: 'logic', title: 'Last an 3,3-V-Logik', text: `Ein 3,3-V-Mikrocontroller soll direkt (ohne Treiberstufe) eine Last mit ${fx(u)} V und ${fx(i)} A schalten. Welches Bauteil ist geeignet?`, cls: ['mosfet'], reqs: [`Drain-Source-Spannung ≥ 1,5 · ${fx(u)} V`, `Drain-Strom ≥ 1,5 · ${fx(i)} A`, 'Gate-Schwelle (Max) ≤ 2,3 V (Logic Level)'], checks: [chkGE('vsw', 1.5 * u, u, 'Drain-Source-Spannung', 'V', true), chkGE('icont', 1.5 * i, i, 'Drain-Strom', 'A', true), chkVth(2.3)] }; },
    () => { const i = pk([0.3, 0.5, 0.8]); return { id: 'netz', title: 'Netzgleichrichter', text: `In einem Netzteil für 230 V~ (Spitzenwert etwa 325 V) soll eine Diode im Einweg-Gleichrichter mit Ladekondensator ${fx(i)} A führen. Beim Einweggleichrichter mit Ladekondensator sperrt die Diode in der negativen Halbwelle die doppelte Spitzenspannung (Kondensator plus Trafo), also etwa 650 V. Welche Diode nimmst du?`, cls: ['diode'], reqs: ['Sperrspannung ≥ 650 V (2 · 325 V, Einweg mit Ladekondensator)', `Dauerstrom ≥ ${fx(i)} A`], checks: [chkGE('vrev', 650, 650, 'Sperrspannung', 'V', true), chkGE('icont', i, i, 'Dauerstrom', 'A', true)] }; },
    () => { const u = pk([12, 24]), i = pk([0.05, 0.1, 0.15]); return { id: 'freilauf', title: 'Freilaufdiode', text: `Parallel zu einer Relaisspule (${fx(u)} V, ${fx(i * 1000)} mA) soll eine Freilaufdiode die Abschaltspannungsspitze aufnehmen. Welche Diode reicht?`, cls: ['diode'], reqs: [`Sperrspannung ≥ 2 · ${fx(u)} V`, `Dauerstrom ≥ ${fx(i * 1000)} mA`], checks: [chkGE('vrev', 2 * u, u, 'Sperrspannung', 'V', true), chkGE('icont', i, i, 'Dauerstrom', 'A', true)] }; },
    () => { const ui = pk([9, 12, 15]), i = pk([0.1, 0.2, 0.5, 1]), ta = pk([25, 40]); const P = (ui - 5) * i; return { id: 'regler', title: 'Spannungsregler', text: `Aus einem Netzteil mit ${fx(ui)} V soll eine stabile Spannung von 5 V für ${fx(i)} A erzeugt werden (Umgebung ${ta} °C, kein Kühlkörper). Verlustleistung im Regler: (${fx(ui)} V − 5 V) · ${fx(i)} A = ${fx(P)} W. Welches Bauteil nimmst du?`, cls: ['reg'], reqs: [`Eingangsspannung ≥ ${fx(ui)} V (Absolute Maximum)`, `Ausgangsstrom ≥ ${fx(i)} A`, `Tj ≤ Tj max bei ${fx(P)} W und ${ta} °C ohne Kühlkörper`], checks: [chkGE('vsup', ui, ui, 'Eingangsspannung', 'V', true), chkGE('icont', i, i, 'Ausgangsstrom', 'A', true), chkThermal(P, ta)] }; },
    () => { const u = pk([3, 5, 9]); return { id: 'opv', title: 'Sensorverstärker', text: `Ein Sensorsignal soll mit einem Operationsverstärker aus einer einzigen Batteriespannung von ${fx(u)} V verstärkt werden. Welches Bauteil nimmst du?`, cls: ['opamp'], reqs: [`Betrieb an ${fx(u)} V (einfache Versorgung)`], checks: [chkSupplyIn(u)] }; },
    () => ({ id: 'port', title: 'Mehr Ausgänge', text: 'Ein 3,3-V-Mikrocontroller hat keine freien Pins mehr. Mit nur zwei Leitungen (I²C) sollen acht zusätzliche digitale Ein- und Ausgänge entstehen. Welches Bauteil nimmst du?', cls: ['expander'], reqs: ['Betrieb an 3,3 V', 'Port-Expander mit I²C'], checks: [chkSupplyIn(3.3)] }),
    () => ({ id: 'ref', title: 'Referenzspannung', text: 'Für einen Mess-Eingang wird eine feste Referenzspannung von etwa 5,1 V aus einer höheren Versorgung benötigt (Z-Diode mit Vorwiderstand). Welches Bauteil nimmst du?', cls: ['zener'], reqs: ['Zenerspannung 5,1 V (±5 %)'], checks: [chkVz(5.1)] }),
    () => { const u = pk([5, 9, 12]); return { id: 'timer', title: 'Zeitgeber', text: `Eine Blinkschaltung mit etwa 1 Hz soll mit einem Timer-IC aufgebaut werden, Versorgung ${fx(u)} V. Welches Bauteil nimmst du?`, cls: ['timer'], reqs: [`Betrieb an ${fx(u)} V`], checks: [chkSupplyIn(u)] }; },
    () => ({ id: 'temp', title: 'Temperatur messen', text: 'Eine Platine soll die Temperatur digital über I²C melden (kein ADC nötig), Versorgung 3,3 V. Welches Bauteil nimmst du?', cls: ['temp'], reqs: ['Digitaler Temperatursensor, Betrieb an 3,3 V'], checks: [chkSupplyIn(3.3)] }),
    () => ({ id: 'dpot', title: 'Einstellbarer Widerstand', text: 'Ein Wert soll per Mikrocontroller (SPI) digital wie mit einem Poti eingestellt werden, Versorgung 5 V. Welches Bauteil nimmst du?', cls: ['dpot'], reqs: ['Digitalpotentiometer mit SPI, Betrieb an 5 V'], checks: [chkSupplyIn(5)] }),
    () => ({ id: 'gatter', title: 'Logikgatter', text: 'Eine Verriegelungslogik braucht vier unabhängige NAND-Gatter in CMOS-Technik an 5 V. Welches Bauteil nimmst du?', cls: ['logic'], reqs: ['NAND-Gatter, Betrieb an 5 V'], checks: [chkSupplyIn(5)] }),
    () => ({ id: 'anzeige', title: 'Betriebsanzeige', text: 'Eine Betriebsanzeige soll mit etwa 15 mA an 5 V leuchten (mit Vorwiderstand). Welches Bauteil ist die Anzeige?', cls: ['led'], reqs: ['Leuchtdiode, Dauerstrom ≥ 15 mA'], checks: [chkGE('icont', 0.015, 0.015, 'Dauerstrom', 'A', true)] })
  ];
  const PKS = Object.assign({ n: 0, ok: 0, streak: 0 }, lsGet('ds.pick', {}));
  let pkSc = null, pkSel = null, pkRes = null;
  function evalPick(sc, ds) {
    const lines = []; let ok = true, over = false; const cl = clsOf(ds), clOk = sc.cls.some(c => cl.includes(c));
    lines.push({ st: clOk ? 'ok' : 'bad', text: clOk ? `Funktion passt: ${ds.part} ist ${ds.title || ds.family}` : `Funktion passt nicht: ${ds.part} ist ${ds.title || ds.family}. Gesucht ist ${sc.cls.map(c => CLSNAME[c] || c).join(' oder ')}.`, focus: null });
    if (!clOk) ok = false;
    if (clOk || sc.id === 'x') sc.checks.forEach(ch => { let r; try { r = ch(ds); } catch (e) { r = { st: 'nn', text: 'nicht prüfbar' }; } lines.push(r); if (r.st === 'bad') ok = false; if (r.over) over = true; });
    return { ok, lines, over, clOk };
  }
  function newScenario() {
    const L = libList(); if (!L.length) { pkSc = null; return; }
    for (let t = 0; t < 40; t++) {
      const sc = pk(SCEN)(); if (!L.some(d => sc.cls.some(c => clsOf(d).includes(c)))) continue;
      const sols = L.filter(d => evalPick(sc, d).ok); if (!sols.length) continue; if (pkSc && sc.id === pkSc.id && t < 30 && sc.text === pkSc.text) continue;
      sc.sols = sols.map(d => d.id); pkSc = sc; pkSel = null; pkRes = null; return;
    }
    pkSc = null;
  }
  function renderPick() {
    const V = $('#pkView'), L = libList();
    if (!L.length) { V.innerHTML = '<div class="card pl"><h4>Bauteilwahl</h4><p class="big">Keine Datenblätter geladen</p><p class="hint2">Ohne Bibliothek gibt es nichts auszuwählen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>'; return; }
    if (!pkSc) newScenario(); const sc = pkSc;
    if (!sc) { V.innerHTML = '<div class="card pl"><h4>Bauteilwahl</h4><p class="big">Kein Szenario möglich</p><p class="hint2">Zu den geladenen Datenblättern passt gerade keine Aufgabe.</p></div>'; return; }
    let h = `<div class="card pl"><h4>Bauteilwahl · ${esc(sc.title)}</h4><div class="stbar"><i style="width:${PKS.n ? Math.round(100 * PKS.ok / PKS.n) : 0}%"></i></div><div class="hint2" style="margin:0 0 8px">${PKS.ok} von ${PKS.n} richtig gewählt${PKS.streak > 1 ? ' · ' + PKS.streak + ' in Folge' : ''}</div>
      <p style="margin:6px 0">${esc(sc.text)}</p><div class="pk-req">${sc.reqs.map(r => `<span>${esc(r)}</span>`).join('')}</div>
      <p class="hint2" style="margin:0 0 8px">Wähle ein Datenblatt aus der Bibliothek. Danach werden die Anforderungen mit den Werten aus dem Datenblatt verglichen. Mit dem Kreis-Symbol siehst du zuerst nach.</p>
      <div class="pk-grid">${L.map(d => `<div style="display:flex;gap:4px"><button data-ps="${esc(d.id)}" class="${pkSel === d.id ? 'on' : ''}" style="flex:1"><b>${famIcon(d)} ${esc(d.part)}</b><small>${esc(d.title || d.family || '')}</small></button><button class="chip s" data-pv="${esc(d.id)}" aria-label="Datenblatt ansehen" title="Datenblatt ansehen" style="align-self:center;width:40px;padding:0;justify-content:center">👁</button></div>`).join('')}</div>
      <div class="btns"><button class="btn pri" data-pa="chk"${pkSel && !(pkRes && pkRes.done) ? '' : ' disabled'}>✓ Prüfen: ${pkSel ? esc((dsById(pkSel) || {}).part || '') : 'erst auswählen'}</button><button class="btn" data-pa="new">Neues Szenario</button></div>`;
    if (pkRes && pkRes.done) {
      const r = pkRes, ds = dsById(pkSel);
      h += `<div class="res"><div class="big2" style="color:${r.ok ? 'var(--ok)' : '#ff8a7a'}">${r.ok ? '✓ Passt!' : '✗ Passt nicht.'} ${esc(ds.part)}</div><ul class="vt">${r.lines.map((l, i) => `<li class="${l.st}"><span class="m">${l.st === 'ok' ? '✓' : l.st === 'bad' ? '✗' : '–'}</span><div style="flex:1">${esc(l.text)}${l.focus ? ` <button class="chip s" data-pw="${i}" style="height:28px;font-size:12px;padding:0 8px">Wo steht das?</button>` : ''}</div></li>`).join('')}</ul>
        ${r.over ? '<div class="wh trap"><b>Achtung:</b> Der Betriebspunkt überschreitet einen Grenzwert. Absolute Maximum Rating ist kein Zielwert!</div>' : ''}
        <div class="wh"><b>Geeignet wären:</b> ${sc.sols.map(id => esc((dsById(id) || {}).part || id)).join(', ')}.${r.ok ? '' : ' Prüfe immer erst den Typ (Funktion), dann Spannung, Strom und Thermik mit Reserve.'}</div></div>`;
    }
    h += `<div class="btns" style="margin-top:12px"><button class="btn s" data-pc="led">🧮 LED-Vorwiderstand</button><button class="btn s" data-pc="derate">🧮 Derating</button><button class="btn s" data-pc="wc317">🧮 Worst-Case</button><button class="btn s" data-pc="pd">🧮 Tj berechnen</button></div></div>`;
    V.innerHTML = h;
  }
  function pickCheck() {
    if (!pkSc || !pkSel || (pkRes && pkRes.done)) return;
    const ds = dsById(pkSel); if (!ds) return; const r = evalPick(pkSc, ds); r.done = true; pkRes = r; PKS.n++;
    if (r.ok) { PKS.ok++; PKS.streak++; FXS.ding(); if (PKS.streak % 3 === 0) { FXS.say(PKS.streak + ' richtige Bauteile in Folge!'); FXS.confetti(); } } else { PKS.streak = 0; if (r.over) FXS.zap('Absolute Maximum Rating ist kein Zielwert!'); else FXS.sad(); }
    lsSet('ds.pick', PKS); stat('dspick', PKS.ok, 'max'); markSeen(ds.id); renderPick();
  }
  $('#pkView').addEventListener('click', e => {
    const ps = e.target.closest('[data-ps]'), pv = e.target.closest('[data-pv]'), pa = e.target.closest('[data-pa]'), pw = e.target.closest('[data-pw]'), pc = e.target.closest('[data-pc]');
    if (ps) { if (pkRes && pkRes.done) return; pkSel = ps.dataset.ps; renderPick(); }
    else if (pv) { setTab('lib'); selectDs(pv.dataset.pv); }
    else if (pa) { if (pa.dataset.pa === 'chk') pickCheck(); else { pkSc = null; newScenario(); renderPick(); } }
    else if (pw) { const l = pkRes.lines[+pw.dataset.pw]; if (l && l.focus) { setTab('lib'); selectDs(pkSel, { focus: l.focus }); } }
    else if (pc) { S.calcId = pc.dataset.pc; setTab('calc'); }
  });

  /* ============================================================ Rechnen: Rechner mit Rechenweg */
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
  const E96 = [1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.30, 1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.00, 2.05, 2.10, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.50, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76];
  const ESER = { E12, E24, E96 };
  /* nächster Normwert: dir 'up' | 'down' | 'nearest' */
  function eSnap(series, v, dir) {
    const L = ESER[series] || E12; if (!(v > 0) || !isFinite(v)) return NaN;
    const e = Math.floor(Math.log10(v) + 1e-12), m = v / Math.pow(10, e), c = [L[L.length - 1] / 10].concat(L, [10]);
    let best = null;
    if (dir === 'up') { best = c.find(x => x >= m * (1 - 1e-9)); } else if (dir === 'down') { for (let i = c.length - 1; i >= 0; i--) if (c[i] <= m * (1 + 1e-9)) { best = c[i]; break; } }
    else { let bd = Infinity; c.forEach(x => { const d = Math.abs(Math.log(x / m)); if (d < bd) { bd = d; best = x; } }); }
    return +(best * Math.pow(10, e)).toPrecision(6);
  }
  const g4 = x => fx(x, 4), g3 = x => fx(x, 3);
  const dsRow = (ds, list, re) => (ds[list] || []).find(r => re.test(rt(r)));
  const CALC = [
    {
      id: 'led', name: 'LED-Vorwiderstand', inp: [{ k: 'us', l: 'Versorgungsspannung Us', u: 'V', d: 5 }, { k: 'uf', l: 'Flussspannung UF der LED', u: 'V', d: 2 }, { k: 'if', l: 'Gewünschter LED-Strom IF', u: 'mA', d: 15 }],
      fn(v) {
        if (v.us <= v.uf) return { err: 'Die Versorgungsspannung muss größer sein als die Flussspannung der LED.' }; if (v.if <= 0) return { err: 'Der Strom muss größer als 0 sein.' };
        const I = v.if / 1000, du = v.us - v.uf, R = du / I, r12 = eSnap('E12', R, 'up'), r24 = eSnap('E24', R, 'up'), i12 = du / r12, i24 = du / r24, P = du * I;
        return { res: [['Vorwiderstand R (rechnerisch)', R, 'Ω', 4], ['E12 (aufgerundet)', r12, 'Ω', 3], ['E24 (aufgerundet)', r24, 'Ω', 3], ['Strom mit E12', i12 * 1000, 'mA', 3], ['Verlustleistung im Widerstand', P * 1000, 'mW', 3]],
          steps: ['R = (Us − UF) / IF', `R = (${g4(v.us)} V − ${g4(v.uf)} V) / ${g4(v.if)} mA = ${g4(du)} V / ${g4(I)} A = ${g4(R)} Ω`, `Normwert aufrunden (dann wird IF nicht größer als gewünscht): E12 → ${g3(r12)} Ω, E24 → ${g3(r24)} Ω`, `Tatsächlicher Strom mit E12: I = ${g4(du)} V / ${g3(r12)} Ω = ${g3(i12 * 1000)} mA`, `Verlustleistung im Widerstand: P = (Us − UF) · IF = ${g4(du)} V · ${g4(I)} A = ${g3(P * 1000)} mW (0,25-W-Widerstand reicht)`] };
      }
    },
    {
      id: 'pd', name: 'Verlustleistung und Sperrschichttemperatur', ds: ['rth', 'tjmax'], inp: [{ k: 'p', l: 'Verlustleistung P', u: 'W', d: 0.5 }, { k: 'ta', l: 'Umgebungstemperatur Tamb', u: '°C', d: 40 }, { k: 'rth', l: 'Wärmewiderstand Rth(j-a)', u: 'K/W', d: 100 }, { k: 'tjmax', l: 'Tj max laut Datenblatt', u: '°C', d: 150 }],
      fromDs(ds) { const t = ds.thermal || {}, o = {}; if (fin(t.rthJA)) o.rth = t.rthJA; if (fin(t.tjMax)) o.tjmax = t.tjMax; return o; },
      fn(v) {
        if (v.rth <= 0) return { err: 'Rth muss größer als 0 sein.' };
        const tj = v.ta + v.p * v.rth, pm = (v.tjmax - v.ta) / v.rth, ok = tj <= v.tjmax;
        return { res: [['Sperrschichttemperatur Tj', tj, '°C', 4], ['Reserve bis Tj max', v.tjmax - tj, 'K', 4], ['Höchste Verlustleistung bei dieser Umgebung', pm, 'W', 3]], warn: ok ? '' : 'Tj liegt über Tj max: weniger Verlustleistung, besserer Kühlkörper oder kühlere Umgebung nötig!', good: ok ? 'Tj liegt unter Tj max. Rechne immer mit etwas Reserve.' : '',
          steps: ['Tj = Tamb + P · Rth(j-a)', `Tj = ${g4(v.ta)} °C + ${g4(v.p)} W · ${g4(v.rth)} K/W = ${g4(tj)} °C`, `Vergleich: Tj max = ${g4(v.tjmax)} °C → ${ok ? 'eingehalten' : 'ÜBERSCHRITTEN'}`, 'Höchste Verlustleistung: Pmax = (Tj max − Tamb) / Rth(j-a)', `Pmax = (${g4(v.tjmax)} − ${g4(v.ta)}) K / ${g4(v.rth)} K/W = ${g4(pm)} W`] };
      }
    },
    {
      id: 'derate', name: 'Derating (Leistungsminderung)', ds: ['p25', 'tjmax'], inp: [{ k: 'p25', l: 'Ptot bei 25 °C', u: 'mW', d: 500 }, { k: 'tjmax', l: 'Tj max', u: '°C', d: 150 }, { k: 'ta', l: 'Umgebungstemperatur Tamb', u: '°C', d: 70 }],
      fromDs(ds) { const t = ds.thermal || {}, o = {}; if (fin(t.ptotMax)) o.p25 = +(t.ptotMax * 1000).toPrecision(6); if (fin(t.tjMax)) o.tjmax = t.tjMax; return o; },
      fn(v) {
        if (v.tjmax <= 25) return { err: 'Tj max muss größer als 25 °C sein.' };
        const slope = v.p25 / (v.tjmax - 25), pt = v.ta <= 25 ? v.p25 : Math.max(0, v.p25 * (v.tjmax - v.ta) / (v.tjmax - 25)), rth = (v.tjmax - 25) * 1000 / v.p25;
        return { res: [['Zulässige Verlustleistung bei Tamb', pt, 'mW', 4], ['Derating-Steigung', slope, 'mW/K', 3], ['Entspricht Rth(j-a)', rth, 'K/W', 3]],
          steps: ['Ab 25 °C sinkt Ptot linear bis 0 bei Tj max.', 'Steigung = Ptot(25 °C) / (Tj max − 25 °C)', `Steigung = ${g4(v.p25)} mW / (${g4(v.tjmax)} − 25) K = ${g4(slope)} mW/K`, 'Ptot(Tamb) = Ptot(25 °C) · (Tj max − Tamb) / (Tj max − 25 °C)', `Ptot(${g4(v.ta)} °C) = ${g4(v.p25)} mW · (${g4(v.tjmax)} − ${g4(v.ta)}) / (${g4(v.tjmax)} − 25) = ${g4(pt)} mW`, `Rth(j-a) = (Tj max − 25 °C) / Ptot(25 °C) = ${g4(rth)} K/W`] };
      }
    },
    {
      id: 'es', name: 'E-Reihe: Normwert wählen', inp: [{ k: 'r', l: 'Rechenwert (Widerstand, z. B. 4,7k)', u: 'Ω', d: '3300', sfx: true }, { k: 'ser', l: 'Reihe', opts: [['E12', 'E12 (10 %)'], ['E24', 'E24 (5 %)'], ['E96', 'E96 (1 %)']], d: 'E24' }],
      fn(v) {
        if (!(v.r > 0)) return { err: 'Der Wert muss größer als 0 sein.' };
        const up = eSnap(v.ser, v.r, 'up'), dn = eSnap(v.ser, v.r, 'down'), nr = eSnap(v.ser, v.r, 'nearest'), dev = (nr - v.r) / v.r * 100;
        return { res: [['Nächster Wert nach oben', up, 'Ω', 4, 'e'], ['Nächster Wert nach unten', dn, 'Ω', 4, 'e'], ['Nächstliegender Wert', nr, 'Ω', 4, 'e'], ['Abweichung des nächstliegenden', dev, '%', 3]],
          steps: [`Reihe ${v.ser}: ${v.ser === 'E12' ? '12' : v.ser === 'E24' ? '24' : '96'} Werte je Dekade, z. B. ${(ESER[v.ser] || []).slice(0, 8).map(x => String(x).replace('.', ',')).join('; ')} …`, `Rechenwert ${eng(v.r, 'Ω')} liegt zwischen ${eng(dn, 'Ω')} und ${eng(up, 'Ω')}.`, `Abweichung: (${eng(nr, 'Ω')} − ${eng(v.r, 'Ω')}) / ${eng(v.r, 'Ω')} = ${g3(dev)} %`, 'Aufrunden oder abrunden hängt von der Aufgabe ab: Ist ein Strom zu begrenzen (LED), rundest du den Widerstand auf.'] };
      }
    },
    {
      id: 'tol', name: 'Toleranz: Reihen- und Parallelschaltung', inp: [{ k: 'r1', l: 'R1', u: 'Ω', d: '1k', sfx: true }, { k: 'r2', l: 'R2', u: 'Ω', d: '2k2', sfx: true }, { k: 't', l: 'Toleranz beider Widerstände', u: '%', d: 5 }],
      fn(v) {
        if (!(v.r1 > 0 && v.r2 > 0) || v.t < 0) return { err: 'Die Widerstände müssen größer als 0 sein, die Toleranz nicht negativ.' };
        const f = 1 - v.t / 100, h = 1 + v.t / 100, s = v.r1 + v.r2, sMin = s * f, sMax = s * h, p = v.r1 * v.r2 / s, pMin = p * f, pMax = p * h;
        return { res: [['Reihenschaltung Nennwert', s, 'Ω', 4, 'e'], ['Reihenschaltung Minimum', sMin, 'Ω', 4, 'e'], ['Reihenschaltung Maximum', sMax, 'Ω', 4, 'e'], ['Parallelschaltung Nennwert', p, 'Ω', 4, 'e'], ['Parallelschaltung Minimum', pMin, 'Ω', 4, 'e'], ['Parallelschaltung Maximum', pMax, 'Ω', 4, 'e']],
          steps: ['Reihe: Rges = R1 + R2, beide Toleranzen wirken in die gleiche Richtung.', `Rges = ${eng(v.r1, 'Ω')} + ${eng(v.r2, 'Ω')} = ${eng(s, 'Ω')}; Min = ${eng(sMin, 'Ω')}, Max = ${eng(sMax, 'Ω')} (± ${g3(v.t)} %)`, 'Parallel: Rges = R1 · R2 / (R1 + R2); sind beide Widerstände gleich genau, gilt dieselbe relative Toleranz.', `Rges = ${eng(p, 'Ω')}; Min = ${eng(pMin, 'Ω')}, Max = ${eng(pMax, 'Ω')}`, 'Bei verschiedenen Toleranzen rechnest du mit allen Kombinationen der Grenzwerte (Worst Case).'] };
      }
    },
    {
      id: 'wc317', name: 'Worst-Case: LM317-Ausgangsspannung', ds: ['vref', 'iadj'], inp: [{ k: 'vmin', l: 'Vref Min', u: 'V', d: 1.2 }, { k: 'vtyp', l: 'Vref Typ', u: 'V', d: 1.25 }, { k: 'vmax', l: 'Vref Max', u: 'V', d: 1.3 }, { k: 'r1', l: 'R1 (zwischen Out und Adj)', u: 'Ω', d: 240, sfx: true }, { k: 'r2', l: 'R2 (Adj nach Masse)', u: 'Ω', d: 720, sfx: true }, { k: 't', l: 'Toleranz R1 und R2', u: '%', d: 1 }, { k: 'ia', l: 'Adjust-Strom Iadj (Max)', u: 'µA', d: 100 }],
      fromDs(ds) { const o = {}, r = dsRow(ds, 'elec', /reference voltage|vref/), a = dsRow(ds, 'elec', /adjust.*current|iadj|\badj\b.*current/); if (r) { if (fin(r.min)) o.vmin = r.min; if (fin(r.typ)) o.vtyp = r.typ; if (fin(r.max)) o.vmax = r.max; } if (a && fin(a.max)) o.ia = a.max * (a.unit === 'mA' ? 1000 : a.unit === 'nA' ? 0.001 : 1); return o; },
      fn(v) {
        if (!(v.r1 > 0 && v.r2 >= 0)) return { err: 'R1 muss größer als 0 sein.' };
        const f = 1 - v.t / 100, h = 1 + v.t / 100, ia = v.ia * 1e-6, typ = v.vtyp * (1 + v.r2 / v.r1) + ia * 0.5 * v.r2, lo = v.vmin * (1 + v.r2 * f / (v.r1 * h)), hi = v.vmax * (1 + v.r2 * h / (v.r1 * f)) + ia * v.r2 * h;
        return { res: [['Ausgang typisch', typ, 'V', 4], ['Ausgang Minimum (Worst Case)', lo, 'V', 4], ['Ausgang Maximum (Worst Case)', hi, 'V', 4], ['Abweichung nach unten', (lo - typ) / typ * 100, '%', 3], ['Abweichung nach oben', (hi - typ) / typ * 100, '%', 3]],
          steps: ['Uout = Vref · (1 + R2 / R1) + Iadj · R2', `Typisch (mit halbem Iadj): ${g4(v.vtyp)} V · (1 + ${g4(v.r2)} / ${g4(v.r1)}) + ${g3(ia * 0.5 * 1e6)} µA · ${g4(v.r2)} Ω = ${g4(typ)} V`, `Minimum: kleinste Vref, R2 klein, R1 groß, Iadj = 0: ${g4(v.vmin)} V · (1 + ${g4(v.r2 * f)} / ${g4(v.r1 * h)}) = ${g4(lo)} V`, `Maximum: größte Vref, R2 groß, R1 klein, Iadj max: ${g4(v.vmax)} V · (1 + ${g4(v.r2 * h)} / ${g4(v.r1 * f)}) + ${g3(ia * 1e6)} µA · ${g4(v.r2 * h)} Ω = ${g4(hi)} V`, 'Worst Case heißt: alle Größen gleichzeitig im ungünstigsten Eckwert.'] };
      }
    },
    {
      id: 'divider', name: 'Spannungsteiler mit Toleranz', inp: [{ k: 'u', l: 'Eingangsspannung Uin', u: 'V', d: 5 }, { k: 'tu', l: 'Toleranz Uin', u: '%', d: 2 }, { k: 'r1', l: 'R1 (oben)', u: 'Ω', d: '10k', sfx: true }, { k: 'r2', l: 'R2 (unten)', u: 'Ω', d: '10k', sfx: true }, { k: 'tr', l: 'Toleranz R1 und R2', u: '%', d: 1 }, { k: 'rl', l: 'Lastwiderstand RL (0 = keine Last)', u: 'Ω', d: 0, sfx: true }],
      fn(v) {
        if (!(v.r1 > 0 && v.r2 > 0) || v.rl < 0) return { err: 'R1 und R2 müssen größer als 0 sein.' };
        const out = (u, r1, r2, rl) => { const rb = rl > 0 ? r2 * rl / (r2 + rl) : r2; return u * rb / (r1 + rb); };
        const typ = out(v.u, v.r1, v.r2, v.rl); let lo = Infinity, hi = -Infinity;
        [1 - v.tu / 100, 1 + v.tu / 100].forEach(a => [1 - v.tr / 100, 1 + v.tr / 100].forEach(b => [1 - v.tr / 100, 1 + v.tr / 100].forEach(c => { const x = out(v.u * a, v.r1 * b, v.r2 * c, v.rl); lo = Math.min(lo, x); hi = Math.max(hi, x); })));
        const iq = v.u / (v.r1 + v.r2);
        return { res: [['Ausgangsspannung typisch', typ, 'V', 4], ['Ausgang Minimum (Worst Case)', lo, 'V', 4], ['Ausgang Maximum (Worst Case)', hi, 'V', 4], ['Streubreite (± um den Typwert)', (hi - lo) / typ * 50, '%', 3], ['Querstrom ohne Last', iq * 1000, 'mA', 3]],
          steps: ['Uout = Uin · R2 / (R1 + R2)' + (v.rl > 0 ? ' (R2 parallel zu RL)' : ''), `Typisch: Uout = ${g4(v.u)} V · ${eng(v.rl > 0 ? v.r2 * v.rl / (v.r2 + v.rl) : v.r2, 'Ω')} / (${eng(v.r1, 'Ω')} + ${eng(v.rl > 0 ? v.r2 * v.rl / (v.r2 + v.rl) : v.r2, 'Ω')}) = ${g4(typ)} V`, 'Worst Case: alle Eckwerte (Uin ± Toleranz, R1 und R2 jeweils ± Toleranz) durchrechnen, kleinster und größter Wert zählen.', `Ergebnis: ${g4(lo)} V bis ${g4(hi)} V`, 'Eine Last an Uout senkt die Spannung: Der Teiler sollte hochohmig gegen die Last und niederohmig gegen den Eingang der Folgeschaltung sein.'] };
      }
    },
    { id: 'curve', name: 'Kennlinie ablesen (rechnerisch)', custom: true },
    {
      id: 'rb', name: 'Basiswiderstand für Transistor-Schalter', ds: ['hfe'], inp: [{ k: 'ic', l: 'Kollektorstrom IC', u: 'mA', d: 50 }, { k: 'hfe', l: 'hFE (Minimalwert bei diesem IC)', u: '', d: 110 }, { k: 'ust', l: 'Steuerspannung Ust', u: 'V', d: 5 }, { k: 'ube', l: 'UBE im Betrieb', u: 'V', d: 0.7 }, { k: 'ue', l: 'Übersteuerungsfaktor (2 bis 5)', u: '', d: 3 }],
      fromDs(ds) { const o = {}, r = dsRow(ds, 'elec', /hfe|current gain|dc current/); if (r && fin(r.min)) o.hfe = r.min; return o; },
      fn(v) {
        if (!(v.hfe > 0 && v.ic > 0 && v.ust > v.ube && v.ue > 0)) return { err: 'IC, hFE und Übersteuerung müssen größer als 0 sein, Ust größer als UBE.' };
        const ib = v.ue * v.ic / 1000 / v.hfe, rb = (v.ust - v.ube) / ib, e12 = eSnap('E12', rb, 'down'), ibr = (v.ust - v.ube) / e12;
        return { res: [['Basisstrom IB', ib * 1000, 'mA', 4], ['Basiswiderstand RB (rechnerisch)', rb, 'Ω', 4, 'e'], ['E12 (abgerundet)', e12, 'Ω', 3, 'e'], ['Basisstrom mit E12', ibr * 1000, 'mA', 3]],
          steps: ['Ein Schalttransistor wird übersteuert: IB = ü · IC / hFE (ü = 2 bis 5, mit dem Minimalwert hFE!)', `IB = ${g3(v.ue)} · ${g4(v.ic)} mA / ${g4(v.hfe)} = ${g4(ib * 1000)} mA`, 'RB = (Ust − UBE) / IB', `RB = (${g4(v.ust)} V − ${g4(v.ube)} V) / ${g4(ib * 1000)} mA = ${g4(rb)} Ω`, `Normwert abrunden (mehr Basisstrom ist sicherer): E12 → ${eng(e12, 'Ω')}, damit IB = ${g3(ibr * 1000)} mA`] };
      }
    },
    {
      id: 'lm317', name: 'LM317: R2 für gewünschte Ausgangsspannung', inp: [{ k: 'uo', l: 'Gewünschte Ausgangsspannung', u: 'V', d: 9 }, { k: 'r1', l: 'R1', u: 'Ω', d: 240, sfx: true }, { k: 'vref', l: 'Referenzspannung Vref', u: 'V', d: 1.25 }],
      fn(v) {
        if (!(v.uo > v.vref && v.r1 > 0 && v.vref > 0)) return { err: 'Die Ausgangsspannung muss größer als Vref sein.' };
        const r2 = v.r1 * (v.uo / v.vref - 1), n24 = eSnap('E24', r2, 'nearest'), n96 = eSnap('E96', r2, 'nearest'), u24 = v.vref * (1 + n24 / v.r1), u96 = v.vref * (1 + n96 / v.r1);
        return { res: [['R2 (rechnerisch)', r2, 'Ω', 4, 'e'], ['R2 aus E24', n24, 'Ω', 3, 'e'], ['Ausgang mit E24', u24, 'V', 4], ['R2 aus E96', n96, 'Ω', 3, 'e'], ['Ausgang mit E96', u96, 'V', 4]],
          steps: ['Uout = Vref · (1 + R2 / R1)  (Iadj vernachlässigt)', 'umgestellt: R2 = R1 · (Uout / Vref − 1)', `R2 = ${g4(v.r1)} Ω · (${g4(v.uo)} V / ${g4(v.vref)} V − 1) = ${g4(r2)} Ω`, `E24: ${eng(n24, 'Ω')} → Uout = ${g4(u24)} V; E96: ${eng(n96, 'Ω')} → Uout = ${g4(u96)} V`, 'Tipp: Der Adjust-Strom (rund 50 µA) wirkt über R2 mit und verschiebt die Spannung leicht nach oben.'] };
      }
    },
    {
      id: 't555', name: 'NE555: Frequenz und Zeiten', inp: [{ k: 'mode', l: 'Betriebsart', opts: [['a', 'Astabil (Blinker)'], ['m', 'Monostabil (Einzelimpuls)']], d: 'a' }, { k: 'r1', l: 'R1 (astabil) bzw. R (monostabil)', u: 'Ω', d: '10k', sfx: true }, { k: 'r2', l: 'R2 (nur astabil)', u: 'Ω', d: '47k', sfx: true }, { k: 'c', l: 'Kondensator C', u: 'F', d: '10u', sfx: true }],
      fn(v) {
        if (!(v.r1 > 0 && v.c > 0)) return { err: 'R und C müssen größer als 0 sein.' };
        if (v.mode === 'm') { const T = 1.1 * v.r1 * v.c; return { res: [['Impulsdauer T', T, 's', 4, 'e']], steps: ['Monostabil: T = 1,1 · R · C', `T = 1,1 · ${eng(v.r1, 'Ω')} · ${eng(v.c, 'F')} = ${eng(T, 's')}`] }; }
        if (!(v.r2 > 0)) return { err: 'R2 muss größer als 0 sein.' };
        const th = 0.693 * (v.r1 + v.r2) * v.c, tl = 0.693 * v.r2 * v.c, f = 1 / (th + tl), d = th / (th + tl) * 100;
        return { res: [['Frequenz f', f, 'Hz', 4, 'e'], ['Periodendauer T', th + tl, 's', 4, 'e'], ['High-Zeit', th, 's', 4, 'e'], ['Low-Zeit', tl, 's', 4, 'e'], ['Tastgrad', d, '%', 3]],
          steps: ['Astabil: tH = 0,693 · (R1 + R2) · C und tL = 0,693 · R2 · C', `tH = 0,693 · ${eng(v.r1 + v.r2, 'Ω')} · ${eng(v.c, 'F')} = ${eng(th, 's')};  tL = 0,693 · ${eng(v.r2, 'Ω')} · ${eng(v.c, 'F')} = ${eng(tl, 's')}`, `f = 1 / (tH + tL) = 1 / ${eng(th + tl, 's')} = ${eng(f, 'Hz')} (Faustformel: 1,44 / ((R1 + 2·R2)·C))`, `Tastgrad = tH / (tH + tL) = ${g3(d)} % (immer über 50 % ohne Zusatzdiode)`] };
      }
    },
    {
      id: 'i2c', name: 'I²C: Pull-up-Widerstand', inp: [{ k: 'vcc', l: 'Versorgungsspannung', u: 'V', d: 3.3 }, { k: 'cb', l: 'Buskapazität Cb', u: 'pF', d: 100 }, { k: 'mode', l: 'Geschwindigkeit', opts: [['s', 'Standard-Mode 100 kHz (tr max 1000 ns)'], ['f', 'Fast-Mode 400 kHz (tr max 300 ns)']], d: 's' }, { k: 'iol', l: 'Low-Strom IOL (Senke)', u: 'mA', d: 3 }, { k: 'vol', l: 'VOL max', u: 'V', d: 0.4 }],
      fn(v) {
        if (!(v.cb > 0 && v.iol > 0 && v.vcc > v.vol)) return { err: 'Cb und IOL müssen größer als 0 sein, Vcc größer als VOL.' };
        const tr = v.mode === 'f' ? 300e-9 : 1000e-9, rmin = (v.vcc - v.vol) / (v.iol / 1000), rmax = tr / (0.8473 * v.cb * 1e-12), ok = rmin <= rmax;
        return { res: [['Rp minimal', rmin, 'Ω', 4, 'e'], ['Rp maximal', rmax, 'Ω', 4, 'e'], ['Empfehlung (E12, geometrische Mitte)', eSnap('E12', Math.sqrt(rmin * rmax), 'nearest'), 'Ω', 3, 'e']], warn: ok ? '' : 'Rp min ist größer als Rp max: Die Buskapazität ist zu groß oder der Takt zu schnell. Weniger Teilnehmer, kürzere Leitung oder langsamer takten.',
          steps: ['Untergrenze: Der Low-Pegel muss mit IOL erreichbar sein.', `Rp,min = (Vcc − VOL) / IOL = (${g3(v.vcc)} V − ${g3(v.vol)} V) / ${g3(v.iol)} mA = ${eng(rmin, 'Ω')}`, 'Obergrenze: Die Anstiegszeit tr darf nicht überschritten werden (RC-Glied, 30 % bis 70 %).', `Rp,max = tr / (0,8473 · Cb) = ${eng(tr, 's')} / (0,8473 · ${g3(v.cb)} pF) = ${eng(rmax, 'Ω')}`, 'Der Pull-up liegt zwischen beiden Grenzen, typisch 2,2 kΩ bis 10 kΩ.'] };
      }
    }
  ];
  const calcUsed = new Set(lsGet('ds.calcused', []));
  function calcDefaults(c) { const o = {}; (c.inp || []).forEach(i => { o[i.k] = String(i.d).replace('.', ','); }); return o; }
  const calcVals = S.calcVals;
  let calcDsSel = '';
  function renderCalc() {
    const V = $('#calcView'), c = CALC.find(x => x.id === S.calcId) || CALC[0]; S.calcId = c.id;
    let h = `<div class="card pl"><h4>Rechner mit Rechenweg</h4><div class="cgrid">${CALC.map(x => `<button class="chip s${x.id === c.id ? ' on' : ''}" data-c="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
    if (c.custom) { h += '<div id="cuForm"></div><div id="cRes"></div></div>'; V.innerHTML = h; curveCalc(); return; }
    if (!calcVals[c.id]) calcVals[c.id] = calcDefaults(c);
    if (c.fromDs && libList().length) h += `<label class="f"><span>Werte aus einem Datenblatt übernehmen</span><select id="cDs"><option value="">– eigene Werte –</option>${libList().map(d => `<option value="${esc(d.id)}"${calcDsSel === d.id ? ' selected' : ''}>${esc(d.part)}</option>`).join('')}</select></label>`;
    h += `<div class="frm" id="cForm">${c.inp.map(i => i.opts ? `<label class="f"><span>${esc(i.l)}</span><select data-k="${i.k}">${i.opts.map(o => `<option value="${o[0]}"${calcVals[c.id][i.k] === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>` : `<label class="f"><span>${esc(i.l)}${i.u ? ' in ' + esc(i.u) : ''}</span><input data-k="${i.k}" inputmode="decimal" autocomplete="off" autocapitalize="off" value="${esc(calcVals[c.id][i.k])}"></label>`).join('')}</div><div id="cRes"></div></div>`;
    V.innerHTML = h; calcOut();
  }
  function calcVals2(c) {
    const v = {}; let ok = true; const raw = calcVals[c.id] || {};
    c.inp.forEach(i => { if (i.opts) { v[i.k] = raw[i.k] != null ? raw[i.k] : i.d; return; } const x = pv(raw[i.k], !!i.sfx); v[i.k] = x; if (!isFinite(x)) ok = false; });
    return ok ? v : null;
  }
  function resHtml(r) {
    return `<div class="res">${r.res.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(x[0])}</span><span class="big2">${x[4] === 'e' ? esc(eng(x[1], x[2])) : esc(fx(x[1], x[3] || 4)) + ' ' + esc(x[2])}</span></div>`).join('')}${r.warn ? `<div class="wh trap" style="margin-top:8px"><b>Achtung:</b> ${esc(r.warn)}</div>` : ''}${r.good ? `<div class="wh" style="margin-top:8px">${esc(r.good)}</div>` : ''}<details open><summary style="cursor:pointer;color:var(--accent);min-height:34px;display:flex;align-items:center">Rechenweg</summary><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details></div>`;
  }
  function calcOut() {
    const c = CALC.find(x => x.id === S.calcId), box = $('#cRes'); if (!c || !box || c.custom) return;
    const v = calcVals2(c); if (!v) { box.innerHTML = '<div class="res"><span class="hint2">Bitte in alle Felder Zahlen eintragen (Komma oder Punkt; bei Widerständen auch 4,7k oder 100n).</span></div>'; S.lastRes = null; return; }
    let r; try { r = c.fn(v); } catch (e) { r = { err: 'Das lässt sich nicht berechnen.' }; }
    if (!r || r.err) { box.innerHTML = `<div class="res"><span class="hint2">${esc((r && r.err) || 'Das lässt sich nicht berechnen.')}</span></div>`; S.lastRes = null; return; }
    box.innerHTML = resHtml(r); S.lastRes = { id: c.id, vals: v, res: r.res.map(x => ({ label: x[0], value: x[1], unit: x[2] })) };
    if (!calcUsed.has(c.id)) { calcUsed.add(c.id); lsSet('ds.calcused', [...calcUsed]); stat('dscalc', calcUsed.size, 'max'); }
  }
  /* ---- Kennlinien-Ablesen als Rechnung ---- */
  const CV = Object.assign({ ds: '', g: 0, s: 0, dir: 'x', val: '' }, S.calcVals.curve || {});
  function curveCalc() {
    const f = $('#cuForm'), box = $('#cRes'); const L = libList();
    if (!L.length) { f.innerHTML = '<p class="hint2">Dafür brauchst du die Datenblatt-Bibliothek.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div>'; box.innerHTML = ''; return; }
    if (!CV.ds || !dsById(CV.ds)) { CV.ds = S.dsId && dsById(S.dsId) ? S.dsId : L[0].id; CV.g = 0; CV.s = 0; }
    const ds = dsById(CV.ds), gr = ds.graphs || []; if (CV.g >= gr.length) CV.g = 0; const g = gr[CV.g]; if (g && CV.s >= g.series.length) CV.s = 0;
    f.innerHTML = `<div class="dsrow"><label class="f"><span>Datenblatt</span><select data-cu="ds">${L.map(d => `<option value="${esc(d.id)}"${d.id === CV.ds ? ' selected' : ''}>${esc(d.part)}</option>`).join('')}</select></label>
      <label class="f"><span>Kennlinie</span><select data-cu="g">${gr.map((x, i) => `<option value="${i}"${i === CV.g ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>
      <label class="f"><span>Kurve</span><select data-cu="s">${g ? g.series.map((x, i) => `<option value="${i}"${i === CV.s ? ' selected' : ''}>${esc(x.name || 'Kurve ' + (i + 1))}</option>`).join('') : ''}</select></label>
      <label class="f"><span>Richtung</span><select data-cu="dir"><option value="x"${CV.dir === 'x' ? ' selected' : ''}>x gegeben, y gesucht</option><option value="y"${CV.dir === 'y' ? ' selected' : ''}>y gegeben, x gesucht</option></select></label>
      <label class="f"><span>${g ? esc(CV.dir === 'x' ? g.xLabel + ' in ' + g.xUnit : g.yLabel + ' in ' + g.yUnit) : 'Wert'}</span><input data-cu="val" inputmode="decimal" autocomplete="off" value="${esc(CV.val)}"></label></div>`;
    curveOut();
  }
  function curveOut() {
    const box = $('#cRes'), ds = dsById(CV.ds), g = ds && (ds.graphs || [])[CV.g]; if (!g) { box.innerHTML = '<div class="res"><span class="hint2">Dieses Datenblatt hat keine Kennlinien.</span></div>'; return; }
    const val = pv(CV.val, false); if (!isFinite(val)) { box.innerHTML = '<div class="res"><span class="hint2">Gib einen Wert ein (Komma oder Punkt).</span></div>'; return; }
    const pts = g.series[CV.s].points, ly = g.yScale === 'log', lx = g.xScale === 'log', xs = CV.dir === 'x';
    const res = xs ? graphY(g, CV.s, val) : graphX(g, CV.s, val);
    if (res == null) { box.innerHTML = `<div class="res"><span class="hint2">Der Wert liegt außerhalb der Kurve (${xs ? 'x' : 'y'} von ${fx(xs ? pts[0][0] : Math.min.apply(null, pts.map(p => p[1])))} bis ${fx(xs ? pts[pts.length - 1][0] : Math.max.apply(null, pts.map(p => p[1])))}). Außerhalb ablesen ist Raten, nicht Lesen.</span></div>`; return; }
    let i0 = 0; for (let i = 0; i < pts.length - 1; i++) { const a = xs ? pts[i][0] : pts[i][1], b = xs ? pts[i + 1][0] : pts[i + 1][1]; if (val >= Math.min(a, b) - 1e-12 && val <= Math.max(a, b) + 1e-12) { i0 = i; break; } }
    const a = pts[i0], b = pts[i0 + 1], sc = xs ? (lx ? 'log' : 'lin') : (ly ? 'log' : 'lin'), sr = xs ? (ly ? 'log' : 'lin') : (lx ? 'log' : 'lin');
    const fv = (v, u) => (BASEU.includes(u) ? eng(v, u) : fx(v) + ' ' + u);
    const steps = [`Kurve „${g.series[CV.s].name || ''}“ in „${g.title}“. Achsen: x ${lx ? 'logarithmisch' : 'linear'}, y ${ly ? 'logarithmisch' : 'linear'}.`, `Der Wert ${fv(val, xs ? g.xUnit : g.yUnit)} liegt zwischen den Messpunkten (${fv(a[0], g.xUnit)} | ${fv(a[1], g.yUnit)}) und (${fv(b[0], g.xUnit)} | ${fv(b[1], g.yUnit)}).`];
    const ia = xs ? a[0] : a[1], ib = xs ? b[0] : b[1], oa = xs ? a[1] : a[0], ob = xs ? b[1] : b[0];
    if (sc === 'lin' && sr === 'lin') steps.push('Linear zwischen den Punkten: y = y1 + (x − x1) · (y2 − y1) / (x2 − x1)', `= ${fx(oa)} + (${fx(val)} − ${fx(ia)}) · (${fx(ob)} − ${fx(oa)}) / (${fx(ib)} − ${fx(ia)}) = ${fx(res, 4)}`);
    else steps.push('Auf logarithmischen Achsen wird im Logarithmus interpoliert: ' + (sc === 'log' ? 'x' : '') + (sc === 'log' && sr === 'log' ? ' und ' : '') + (sr === 'log' ? 'y' : '') + ' ersetzt du durch log10(…), rechnest linear und potenzierst zurück.', `Ergebnis: ${fv(res, xs ? g.yUnit : g.xUnit)}`);
    steps.push('Beim Ablesen im Diagramm liegt die Genauigkeit meist bei einigen Prozent.');
    box.innerHTML = resHtml({ res: [[xs ? g.yLabel : g.xLabel, res, xs ? g.yUnit : g.xUnit, 4, BASEU.includes(xs ? g.yUnit : g.xUnit) ? 'e' : undefined]], steps });
    S.lastRes = { id: 'curve', vals: { ds: CV.ds, graph: g.id, series: CV.s, dir: CV.dir, val }, res: [{ label: xs ? g.yLabel : g.xLabel, value: res, unit: xs ? g.yUnit : g.xUnit }] };
    const key = 'calc:' + CV.ds + ':' + g.id; if (!S.curves.includes(key)) { S.curves.push(key); lsSet('ds.curves', S.curves); stat('dscurve', S.curves.length, 'max'); }
    if (!calcUsed.has('curve')) { calcUsed.add('curve'); lsSet('ds.calcused', [...calcUsed]); stat('dscalc', calcUsed.size, 'max'); }
  }
  (function () {
    const Vw = $('#calcView');
    Vw.addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (c) { S.calcId = c.dataset.c; dirty(); renderCalc(); } });
    Vw.addEventListener('input', e => {
      const i = e.target.closest('#cForm [data-k]'); if (i) { if (!calcVals[S.calcId]) calcVals[S.calcId] = calcDefaults(CALC.find(x => x.id === S.calcId)); calcVals[S.calcId][i.dataset.k] = i.value; calcOut(); dirty(); return; }
      const u = e.target.closest('[data-cu="val"]'); if (u) { CV.val = u.value; S.calcVals.curve = CV; curveOut(); dirty(); }
    });
    Vw.addEventListener('change', e => {
      const sel = e.target.closest('#cForm select[data-k]'); if (sel) { calcVals[S.calcId][sel.dataset.k] = sel.value; calcOut(); dirty(); return; }
      if (e.target.id === 'cDs') {
        calcDsSel = e.target.value; const c = CALC.find(x => x.id === S.calcId), d = dsById(calcDsSel);
        if (c && d && c.fromDs) { const o = c.fromDs(d); Object.keys(o).forEach(k => { calcVals[c.id][k] = String(o[k]).replace('.', ','); }); renderCalc(); dirty(); toast('Werte aus ' + d.part + ' übernommen' + (Object.keys(o).length ? '' : ' (nichts Passendes gefunden)')); } return;
      }
      const cu = e.target.closest('[data-cu]'); if (cu && cu.dataset.cu !== 'val') { const k = cu.dataset.cu; CV[k] = k === 'ds' || k === 'dir' ? cu.value : +cu.value; if (k === 'ds') { CV.g = 0; CV.s = 0; } if (k === 'g') CV.s = 0; S.calcVals.curve = CV; curveCalc(); dirty(); }
    });
  })();

  /* ============================================================ Zustand wechseln (Beispiele, Aufgaben, Öffnen) */
  const CVsync = () => { Object.assign(CV, { ds: '', g: 0, s: 0, dir: 'x', val: '' }, calcVals.curve || {}); calcVals.curve = CV; };
  function setCalc(cs, dsid) {
    const c = CALC.find(x => x.id === cs.id); if (!c) return; S.calcId = c.id;
    if (c.custom) { const o = cs.vals || {}; Object.assign(CV, { ds: dsid || o.ds || CV.ds, g: o.g != null ? o.g : 0, s: o.s != null ? o.s : 0, dir: o.dir || 'x', val: o.val != null ? String(o.val).replace('.', ',') : '' }); calcVals.curve = CV; return; }
    const base = calcDefaults(c); let o = {};
    const d = dsid && dsById(dsid); if (cs.fromDs && d && c.fromDs) { try { o = c.fromDs(d); } catch (e) {} calcDsSel = d.id; }
    Object.keys(cs.vals || {}).forEach(k => { o[k] = cs.vals[k]; });
    Object.keys(o).forEach(k => { base[k] = String(o[k]).replace('.', ','); }); calcVals[c.id] = base;
  }
  function resolveFocus(f, ds) {
    if (!f) return null; const o = Object.assign({}, f);
    if ((o.section === 'graphs' || o.section === 'graph') && o.key == null && ds) { const g = (ds.graphs || [])[o.index || 0]; if (g) { o.key = g.id; o.graphId = g.id; } }
    return o;
  }
  function goState(o) {
    o = o || {}; const tab = o.tab || (o.calc ? 'calc' : o.ds ? 'lib' : S.tab);
    if (o.calc) setCalc(o.calc, o.ds);
    setTab(tab);
    if (o.ds && LIBX() && dsById(o.ds)) selectDs(o.ds, { focus: resolveFocus(o.focus, dsById(o.ds)), mode: o.mode, count: true, quiet: true });
    if (S.tab === 'calc') renderCalc();
  }

  /* ============================================================ Beispiele (DS_DATA.examples hat Vorrang, sonst eingebaute) */
  const BUILTIN = [
    { id: 'b-abs', name: 'Grenzwerte lesen: 1N4148', cat: 'Grundlagen', ds: 'tf-1n4148', focus: { section: 'abs' }, desc: 'Absolute Maximum Ratings finden und von den empfohlenen Betriebswerten unterscheiden.' },
    { id: 'b-uf', name: 'Kennlinie ablesen: Flussspannung', cat: 'Kennlinien', ds: 'tf-1n4148', focus: { section: 'graphs', index: 0 }, mode: 'ablesen', desc: 'Im Betrachter in den Kennlinienmodus wechseln und die Flussspannung bei 10 mA ablesen.' },
    { id: 'b-led', name: 'LED-Vorwiderstand aus dem Datenblatt', cat: 'Auslegung', ds: 'tf-led-r', calc: { id: 'led', vals: { us: 5, uf: 2, if: 15 } }, desc: 'UF und IF aus dem LED-Datenblatt, daraus Vorwiderstand und E-Reihe.' },
    { id: 'b-bc547', name: 'Basiswiderstand für den BC547-Schalter', cat: 'Auslegung', ds: 'tf-bc547', calc: { id: 'rb', fromDs: true, vals: { ic: 50, ust: 5 } }, desc: 'Mit dem kleinsten hFE aus der Tabelle den Basiswiderstand für einen übersteuerten Schalter berechnen.' },
    { id: 'b-lm317', name: 'LM317: Worst-Case der Ausgangsspannung', cat: 'Toleranzen', ds: 'tf-lm317', calc: { id: 'wc317', fromDs: true, vals: { r1: 240, r2: 720, t: 1 } }, desc: 'Streuung von Vref und der Widerstände: Wie weit kann der Ausgang von 5 V abweichen?' },
    { id: 'b-7805', name: 'Thermik: 7805 mit Verlustleistung', cat: 'Thermik', ds: 'tf-7805', calc: { id: 'pd', fromDs: true, vals: { p: 1.5, ta: 40 } }, desc: 'Verlustleistung (12 V zu 5 V bei 0,2 A) und Sperrschichttemperatur ohne Kühlkörper.' },
    { id: 'b-derate', name: 'Derating beim Leistungstransistor', cat: 'Thermik', ds: 'tf-bd139', calc: { id: 'derate', fromDs: true, vals: { ta: 70 } }, focus: { section: 'thermal' }, desc: 'Ptot gilt nur bei 25 °C: Wie viel bleibt bei 70 °C Umgebungstemperatur?' },
    { id: 'b-555', name: 'NE555: Blinkfrequenz berechnen', cat: 'Auslegung', ds: 'tf-ne555', calc: { id: 't555', vals: { mode: 'a', r1: '10k', r2: '47k', c: '10u' } }, desc: 'Aus R1, R2 und C Frequenz und Tastgrad bestimmen.' },
    { id: 'b-i2c', name: 'PCF8574: Adressen und Pull-ups', cat: 'Bussysteme', ds: 'tf-pcf8574', calc: { id: 'i2c', vals: { vcc: 3.3, cb: 100 } }, focus: { section: 'pins' }, desc: 'Pinbelegung und Adresspins lesen, danach den Pull-up für den I²C-Bus bestimmen.' },
    { id: 'b-quasi', name: 'Quasi-bidirektional: PCF8574-Ausgang', cat: 'Fallen', ds: 'tf-pcf8574', focus: { section: 'elec' }, desc: 'Schau, wie groß IOH und IOL sind: Eine LED gehört hier gegen +V, nicht gegen Masse.' },
    { id: 'b-nand', name: 'Wahrheitstabelle und Timing: 74HC00', cat: 'Tabellen', ds: 'tf-74hc00', focus: { section: 'truth' }, desc: 'Funktionstabelle und Laufzeit tpd bei verschiedenen Versorgungsspannungen.' },
    { id: 'b-reg', name: 'Register lesen: LM75', cat: 'Bussysteme', ds: 'tf-lm75', focus: { section: 'regs' }, desc: 'Registertabelle, Adresse und Reset-Werte im I²C-Temperatursensor.' },
    { id: 'b-pkg', name: 'Gehäuse und Pin 1: TO-220', cat: 'Gehäuse', ds: 'tf-lm317', focus: { section: 'pkg' }, desc: 'Gehäusezeichnung, Maße und Pinreihenfolge am Spannungsregler.' },
    { id: 'b-pick', name: 'Bauteilwahl üben', cat: 'Bauteilwahl', ds: null, tab: 'pick', desc: 'Szenario lesen, Datenblatt wählen und prüfen lassen.' },
    { id: 'b-engl', name: 'Fachenglisch: Karteikarten', cat: 'Fachenglisch', ds: null, tab: 'engl', desc: 'Datenblattbegriffe mit dem Leitner-Kasten lernen.' }
  ];
  function exampleList() {
    const src = root.DS_DATA && Array.isArray(root.DS_DATA.examples) && root.DS_DATA.examples.length ? root.DS_DATA.examples : BUILTIN;
    return src.filter(e => e && e.name && (!e.ds || !LIBX() || dsById(e.ds)));
  }
  function loadExample(e) {
    if (!e) { toast('Beispiel nicht gefunden'); return false; }
    if (e.ds && !LIBX()) { toast('Die Datenblätter sind noch nicht geladen.'); return false; }
    stash(); S.task = null; taskRes = null;
    goState({ ds: e.ds || undefined, tab: e.tab, focus: e.focus, calc: e.calc, mode: e.mode });
    S.name = e.name; S.id = null; S.dirty = false; updateChrome(); saveCurSoon(); toast('Beispiel geladen: ' + e.name); return true;
  }
  function loadExampleByName(n) { n = String(n || '').toLowerCase(); const e = exampleList().find(x => x.name.toLowerCase().includes(n) || x.id === n); return loadExample(e); }
  function openExamples() {
    const ex = exampleList();
    sheet('Beispiele', (b, close) => {
      if (!ex.length) { b.innerHTML = '<p class="hint2">Noch keine Beispiele geladen.</p>'; return; }
      let last = '', h = '';
      ex.forEach((e, i) => { if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat || '')}</div>`; } h += `<button class="row" data-i="${i}"><div class="grow"><b>${esc(e.name)}</b>${e.desc ? `<small>${esc(e.desc)}</small>` : ''}</div></button>`; });
      b.innerHTML = h;
      b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); loadExample(ex[+r.dataset.i]); });
    });
  }

  /* ============================================================ Speichern, Öffnen, Teilen */
  const PK = 'ds.saves';
  const saves = () => { const a = lsGet(PK, []); return Array.isArray(a) ? a : []; };
  const snapshot = () => ({ ds: S.dsId, tab: S.tab, marks: clone(S.marks), calcId: S.calcId, calcVals: clone(calcVals), note: S.note || '', name: S.name });
  function saveItem(name) {
    const a = saves(), id = S.id || uid(); S.id = id; S.name = name || S.name;
    const e = Object.assign(snapshot(), { id, name: S.name, t: Date.now() });
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = e; else a.push(e);
    lsSet(PK, a.slice(-100)); S.dirty = false; updateChrome(); saveCur();
  }
  const hasWork = () => Object.keys(S.marks).length > 0 || !!S.note || Object.keys(calcVals).some(k => k !== 'curve') || false;
  function stash() { if (!S.dirty || S.readonly || S.task) return false; if (!hasWork()) return false; saveItem(S.name || 'Arbeitsstand'); S.id = null; return true; }
  async function doSave() {
    const r = await ask('Arbeitsstand speichern', [{ key: 'n', label: 'Name', type: 'text', value: S.name }], { intro: 'Gespeichert werden Datenblatt, Markierungen und Rechner-Eingaben auf diesem Gerät.' });
    if (!r) return; const n = r.n.trim() || 'Arbeitsstand'; saveItem(n); toast('Gespeichert: ' + n);
  }
  function openList() {
    sheet('Gespeicherte Arbeitsstände', (b, close) => {
      const draw = () => {
        const items = saves().slice().sort((a, b2) => b2.t - a.t);
        if (!items.length) { b.innerHTML = '<p class="hint2">Noch nichts gespeichert. Speichern findest du im Menü („Speichern unter …“).</p>'; return; }
        b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${i.id}" style="text-align:left"><b>${esc(i.name)}</b><small>${esc((dsById(i.ds) || {}).part || 'Datenblatt')} · ${new Date(i.t).toLocaleDateString('de-DE')}</small></button><button class="chip danger s" data-d="${i.id}">Löschen</button></div>`).join('');
      };
      draw();
      b.addEventListener('click', async e => {
        const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
        if (o) { const it = saves().find(x => x.id === o.dataset.o); if (!it) return; close(); loadItem(it); }
        else if (d) { if (!await confirmSheet('Löschen?', 'Der gespeicherte Arbeitsstand wird gelöscht.', 'Löschen', true)) return; lsSet(PK, saves().filter(x => x.id !== d.dataset.d)); draw(); }
      });
    });
  }
  function applyItem(it, suffix) {
    S.task = null; taskRes = null; S.marks = clone(it.marks || {});
    Object.keys(calcVals).forEach(k => { delete calcVals[k]; }); Object.assign(calcVals, clone(it.calcVals || {})); CVsync(); S.calcId = it.calcId || S.calcId;
    S.note = it.note || ''; S.name = (it.name || 'Arbeitsstand') + (suffix || '');
    const tab = ['lib', 'read', 'engl', 'pick', 'calc', 'help'].includes(it.tab) ? it.tab : 'lib';
    goState({ ds: it.ds && dsById(it.ds) ? it.ds : undefined, tab }); if (VW.lib && VW.lib.inst) viewReload('lib'); S.dirty = false; updateChrome(); saveCurSoon();
  }
  function loadItem(it) { stash(); applyItem(it); S.id = it.id; toast('Geöffnet: ' + it.name); }
  async function packShare(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj)); let out = bytes, tag = 's';
    if (root.CompressionStream) { try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); out = new Uint8Array(await new Response(cs.readable).arrayBuffer()); tag = 'z'; } catch (e) {} }
    let bin = ''; out.forEach(b => { bin += String.fromCharCode(b); });
    return tag + '=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function unpackShare(h) {
    const m = String(h).match(/^#?([sz])=([\w-]+)$/); if (!m) return null;
    let b64 = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); let txt;
    if (m[1] === 'z') { const dsm = new DecompressionStream('deflate-raw'), w = dsm.writable.getWriter(); w.write(bytes); w.close(); txt = new TextDecoder().decode(await new Response(dsm.readable).arrayBuffer()); }
    else txt = new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }
  async function shareNow() {
    let url; try { url = location.href.split('#')[0].split('?')[0] + '#' + await packShare(Object.assign({ k: 'ds' }, snapshot())); } catch (e) { toast('Teilen nicht möglich'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Datenblatt-Lab: ' + S.name, text: 'Schau dir meinen Datenblatt-Arbeitsstand „' + S.name + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    sheet('Teilen', b => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deines Arbeitsstands mit Datenblatt, Markierungen und Rechner-Eingaben.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
      const ta = $('#shTx', b); ta.value = url; ta.addEventListener('focus', () => ta.select());
      $('#shCp', b).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
    });
  }
  async function loadShared(h) {
    let d = null; try { d = await unpackShare(h); } catch (e) {}
    if (!d || d.k !== 'ds') { toast('Der Link oder Code ist ungültig'); return false; }
    stash(); applyItem(d, ' (geteilt)'); S.id = null; S.dirty = true; toast('Geteilter Arbeitsstand geladen'); return true;
  }
  function importSheet() {
    sheet('Aus Code oder Link laden', (b, close) => {
      b.innerHTML = '<p class="hint2" style="margin-top:0">Füge einen Teilen-Link oder Code ein.</p><textarea id="tx" rows="6"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>';
      $('#ld', b).onclick = async () => { const t = $('#tx', b).value.trim(), h = t.includes('#') ? t.slice(t.indexOf('#')) : t; if (await loadShared(h.startsWith('#') ? h : '#' + h)) close(); };
    });
  }
  /* ---- Drucken: Lernprotokoll mit Datenblatt-Kerndaten, Markierungen und letzter Rechnung ---- */
  function printNow() {
    const who = lsRaw('lm4.name', ''), ds = dsById(S.dsId); const tb = (rows, cols) => `<table><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    let h = `<div class="proto"><h1>${esc(S.name)}</h1><p>Tonfunk Datenblatt-Lab · ${new Date().toLocaleDateString('de-DE')}${who ? ' · ' + esc(who) : ''}</p>`;
    if (ds) {
      h += `<h2>${esc(ds.part)} · ${esc(ds.title || '')}</h2><p>${esc(ds.desc || '')}</p><p><i>Übungsdatenblatt, Werte angelehnt an typische Bauteile; maßgeblich sind immer die Datenblätter des Herstellers.</i></p>`;
      if ((ds.abs || []).length) h += '<h2>Absolute Maximum Ratings</h2>' + tb(ds.abs.map(r => [r.param, r.sym || '', r.cond || '', r.min == null ? '' : fx(r.min), r.max == null ? '' : fx(r.max), r.unit || '']), ['Parameter', 'Symbol', 'Bedingung', 'Min', 'Max', 'Einheit']);
      if ((ds.rec || []).length) h += '<h2>Recommended Operating Conditions</h2>' + tb(ds.rec.map(r => [r.param, r.sym || '', r.min == null ? '' : fx(r.min), r.max == null ? '' : fx(r.max), r.unit || '']), ['Parameter', 'Symbol', 'Min', 'Max', 'Einheit']);
      if ((ds.elec || []).length) h += '<h2>Electrical Characteristics</h2>' + tb(ds.elec.map(r => [r.param, r.sym || '', r.cond || '', r.min == null ? '' : fx(r.min), r.typ == null ? '' : fx(r.typ), r.max == null ? '' : fx(r.max), r.unit || '']), ['Parameter', 'Symbol', 'Testbedingungen', 'Min', 'Typ', 'Max', 'Einheit']);
      if (ds.thermal) h += `<h2>Thermik</h2><p>Rth(j-a) = ${fx(ds.thermal.rthJA)} K/W · Tj max = ${fx(ds.thermal.tjMax)} °C · Ptot (25 °C) = ${fx(ds.thermal.ptotMax)} W</p>`;
    }
    const mk = []; Object.keys(S.marks).forEach(id => { const d = dsById(id); if (d) Object.keys(S.marks[id]).forEach(k => mk.push([d.part, markText(d, k)])); });
    if (mk.length) h += '<h2>Meine Markierungen</h2>' + tb(mk, ['Datenblatt', 'Stelle']);
    const c = CALC.find(x => x.id === S.calcId), lr = S.lastRes;
    if (lr && c) h += `<h2>Letzte Rechnung: ${esc(c.name)}</h2>` + tb(lr.res.map(r => [r.label, fx(r.value, 5) + ' ' + (r.unit || '')]), ['Größe', 'Ergebnis']);
    if (S.note) h += `<h2>Notiz</h2><pre>${esc(S.note)}</pre>`;
    $('#printArea').innerHTML = h + '</div>'; setTimeout(() => window.print(), 80);
  }

  /* ============================================================ Aufgaben (DS_TASKS) */
  const TK = () => (root.DS_TASKS && Array.isArray(root.DS_TASKS.tasks) && root.DS_TASKS.tasks.length ? root.DS_TASKS.tasks : null);
  const taskDone = () => lsGet('sim.done', {});
  function markDone(id, pct) {
    try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {}
    if (root.Badges) root.Badges.result(id, pct);
  }
  let taskRes = null; const taskAns = {};
  const curTask = () => { const a = TK(); return a && S.task ? a.find(t => t.id === S.task.id) : null; };
  function updateTaskBadge() {
    const a = TK(), b = $('#tkBd'); if (!b) return;
    if (!a) { b.style.display = 'none'; return; }
    const d = taskDone(), n = a.filter(t => (d[t.id] || 0) >= 100).length; b.style.display = ''; b.textContent = n + '/' + a.length;
  }
  function updateTaskBar() {
    const t = curTask(), el = $('#taskBar'); if (!el) return;
    if (!t) { el.className = ''; el.innerHTML = ''; el.dataset.s = ''; return; }
    el.className = 'on'; const sig = t.id + S.readonly; if (el.dataset.s === sig) return; el.dataset.s = sig;
    el.innerHTML = `<span>📝</span><b>${esc(t.title)}</b><button class="chip s" data-ta="info">Aufgabe</button><button class="chip s on" data-ta="check"${S.readonly ? ' disabled' : ''}>✓ Prüfen</button>`;
  }
  $('#taskBar').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; if (b.dataset.ta === 'info') setTab('tasks'); else checkTask(); });
  async function startTask(id) {
    const t = (TK() || []).find(x => x.id === id); if (!t) return;
    const had = stash(); taskRes = null; S.reads.length = 0; S.lastRead = null; S.readsN = 0; S.lastRes = null;
    if (root.Auswertung) root.Auswertung.hintReset(id);
    let o; try { o = typeof t.start === 'function' ? t.start() : {}; } catch (e) { console.error(e); toast('Die Startvorlage der Aufgabe fehlt'); return; }
    S.task = { id }; S.name = t.title; S.id = null; delete taskAns[id]; S.marks = {};
    goState(Object.assign({ ds: t.ds }, o || {})); S.dirty = false; updateChrome();
    toast(had ? 'Aufgabe gestartet, dein Arbeitsstand ist gesichert' : 'Aufgabe gestartet'); renderTasksIfOpen();
  }
  const renderTasksIfOpen = () => { if (S.tab === 'tasks') renderTasks(); };
  function collectAnswer(t) {
    const a = taskAns[t.id] || {}, v = a.v != null && a.v !== '' ? pv(String(a.v).replace(/[^\d,.\-+eE]/g, ''), false) : NaN, ask2 = t.ask && typeof t.ask === 'object' ? t.ask : null;
    const marks = []; Object.keys(S.marks).forEach(id => Object.keys(S.marks[id]).forEach(k => { const i = k.indexOf(':'); marks.push({ ds: id, section: k.slice(0, i), key: k.slice(i + 1) }); }));
    return { ds: S.dsId, tab: S.tab === 'tasks' && S.workTab ? S.workTab : S.tab, value: isFinite(v) ? v : null, text: a.v == null ? '' : String(a.v), choice: a.c != null ? a.c : null, choiceText: a.c != null && ask2 && ask2.choices ? ask2.choices[a.c] : '', calc: S.lastRes ? clone(S.lastRes) : null, calcId: S.calcId, marks, reads: clone(S.reads), lastRead: S.lastRead ? clone(S.lastRead) : null, readsN: S.readsN, question: qCur ? { id: qCur.id, done: !!qCur.done } : null, simTime: S.simT };
  }
  async function checkTask() {
    const t = curTask(); if (!t) return; const R = root.DS_TASKS;
    S.readonly = true; updateChrome(); updateTaskBar();
    const ans = collectAnswer(t); let lines;
    try { lines = await (R.run ? R.run(t, ans) : t.check(ans)); } catch (e) { console.error(e); lines = [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden: ' + (e && e.message || e), why: '' }]; }
    S.readonly = false; lines = Array.isArray(lines) ? lines : [];
    const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
    taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); updateTaskBadge();
    const F = root.LochFX; if (F) try { if (pct === 100) { F.pass(100); if (F.isFun && F.isFun()) F.confetti(false); } else F.pass(pct); } catch (e) {}
    updateChrome(); updateTaskBar(); if (S.tab !== 'tasks') setTab('tasks'); else renderTasks();
    toast(pct === 100 ? '🎉 Geschafft!' : pct + ' % richtig');
  }
  function hintTask() {
    const t = curTask(); if (!t) return; const h = t.hint, arr = Array.isArray(h) ? h : null;
    const open = () => {
      const had = stash(); let o; try { o = t.sol(); } catch (e) { console.error(e); toast('Die Musterlösung fehlt'); return; }
      S.task = null; taskRes = null; goState(Object.assign({ ds: t.ds }, o || {})); S.name = t.title + ' (Musterlösung)'; S.id = null; S.dirty = false; updateChrome(); toast(had ? 'Musterlösung geöffnet, dein Stand ist gesichert' : 'Musterlösung geöffnet');
    };
    const o = { id: t.id, hint: arr ? arr[0] : h, concrete: () => { if (arr && arr[1]) return arr[1]; const l = taskRes && taskRes.id === t.id ? taskRes.lines.find(x => !x.ok) : null; return l ? 'Noch nicht erfüllt: ' + l.text : taskRes && taskRes.id === t.id ? 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.' : 'Tippe zuerst auf „Lösung prüfen“, dann kann ich dir den ersten offenen Punkt nennen.'; }, reveal: arr && arr[2] ? () => arr[2] : null, solution: typeof t.sol === 'function' ? open : null };
    if (root.Auswertung) root.Auswertung.hint(o); else sheet('Tipp', b => { b.innerHTML = '<p style="margin-top:0">' + esc(o.hint || '') + '</p>'; });
  }
  const dsName = id => ((dsById(id) || {}).part) || '';
  function renderTasks() {
    const V = $('#taskView'), A = TK();
    if (!A) { V.innerHTML = '<div class="card pl"><h4>Aufgaben</h4><p class="big">Aufgaben folgen</p><p class="hint2">Hier erscheinen bald Aufgaben mit automatischer Prüfung: Grundlagen, Grenzwerte, Tabellen, Kennlinien, Thermik, Gehäuse, Fachenglisch, Auslegung und Prüfungsaufgaben. Bis dahin kannst du mit „Lesen üben“, den Beispielen und den Rechnern üben.</p><div class="btns"><button class="btn pri" id="tkEx">Beispiele ansehen</button><button class="btn" id="tkRetry" data-retry>Erneut prüfen</button></div></div>'; $('#tkEx', V).onclick = openExamples; return; }
    const d = taskDone(), t = curTask(); let h = '';
    const n100 = A.filter(x => (d[x.id] || 0) >= 100).length;
    if (t) {
      const r = taskRes && taskRes.id === t.id ? taskRes : null, ask2 = t.ask ? (typeof t.ask === 'string' ? { label: t.ask } : t.ask) : null, cur = taskAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat || '')}</h4><div class="big">${esc(t.title)}</div><div class="lv">${'●'.repeat(t.level || 1)}${'○'.repeat(3 - (t.level || 1))}</div>
        <p style="margin:8px 0">${esc(t.text)}</p>${S.dsId && LIBX() ? `<p class="hint2" style="margin-top:0">Datenblatt: ${esc(dsName(S.dsId))} · Tab „${esc((TABS.find(x => x[0] === S.tab) || [0, 0, ''])[2])}“</p>` : ''}
        ${ask2 && ask2.choices ? `<div class="opts" id="tkOpts" style="margin:8px 0">${ask2.choices.map((c, i) => `<button data-tc="${i}" class="${cur.c === i ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>` : ''}
        ${ask2 && !ask2.choices ? `<label class="f"><span>${esc(ask2.label || 'Dein Ergebnis')}${ask2.unit ? ' (' + esc(ask2.unit) + ')' : ''}</span><input id="tkAns" inputmode="decimal" autocomplete="off" value="${esc(cur.v || '')}"></label>` : ''}
        <div class="btns"><button class="btn pri" data-ta="check">✓ Lösung prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button></div>
        <div class="btns"><button class="btn" data-ta="go">Zum Datenblatt</button><button class="btn" data-ta="hand">Abgeben (QR)</button><button class="btn danger" data-ta="end">Aufgabe beenden</button></div>`;
      if (r) h += `<ul class="tl">${r.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details><summary>Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul><div class="score ${r.pct === 100 ? 'ok' : ''}">${r.pct === 100 ? '🎉 Geschafft!' : r.pct + ' % richtig'}</div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${A.length} Aufgaben vollständig gelöst. Wähle eine Aufgabe: Du bekommst eine Startvorlage, liest im Datenblatt oder rechnest und lässt die Lösung prüfen.</p>`;
    let last = '';
    A.forEach(x => {
      if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; }
      const p = d[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${p >= 100 ? 'g' : p > 0 ? 'p' : ''}">${p >= 100 ? '✓' : p > 0 ? p : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${'●'.repeat(x.level || 1)}${'○'.repeat(3 - (x.level || 1))}</span>${x.ds && dsName(x.ds) ? ' ' + esc(dsName(x.ds)) : ''}${p != null ? ' · bisher ' + p + ' %' : ''}</small></div></button>`;
    });
    V.innerHTML = h;
  }
  $('#taskView').addEventListener('input', e => { if (e.target.id === 'tkAns' && S.task) { const a = taskAns[S.task.id] || (taskAns[S.task.id] = {}); a.v = e.target.value; } });
  $('#taskView').addEventListener('click', async e => {
    const tb = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]'), tc = e.target.closest('[data-tc]');
    if (tc && S.task) { const a = taskAns[S.task.id] || (taskAns[S.task.id] = {}); a.c = +tc.dataset.tc; a.v = tc.textContent; $$('#tkOpts button').forEach(b => b.classList.toggle('on', +b.dataset.tc === a.c)); return; }
    if (tb) {
      const a = tb.dataset.ta;
      if (a === 'check') checkTask(); else if (a === 'hint') hintTask(); else if (a === 'go') { setTab(S.workTab && S.workTab !== 'tasks' ? S.workTab : 'lib'); }
      else if (a === 'hand') { const t = curTask(); if (t && root.Auswertung) root.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); }
      else if (a === 'end') { S.task = null; taskRes = null; updateChrome(); renderTasks(); toast('Aufgabe beendet'); }
    } else if (row) startTask(row.dataset.t);
  });

  /* ============================================================ Lernen: neun ausklappbare Abschnitte */
  const SV = (inner, label) => `<svg class="dr" viewBox="0 0 360 200" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const TX = (x, y, t, o) => `<text x="${x}" y="${y}" fill="${(o && o.c) || '#e8ecf0'}" font-size="${(o && o.s) || 12}" text-anchor="${(o && o.a) || 'middle'}" font-family="system-ui"${o && o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  function svgStruct() {
    const bands = [['1', 'Titel, Merkmale, Pinbild', 12, 24, '#3b9eff'], ['2', 'Pinbelegung (Pin description)', 40, 18, '#8d99a6'], ['3', 'Absolute Maximum Ratings', 62, 18, '#ff5c5c'], ['4', 'Recommended Operating Conditions', 84, 18, '#4cd964'], ['5', 'Electrical Characteristics (Min, Typ, Max)', 106, 22, '#3b9eff'], ['6', 'Kennlinien (Typical characteristics)', 132, 22, '#c77dff'], ['7', 'Thermik und Gehäuse (Package)', 158, 16, '#ffb340'], ['8', 'Anwendung, Bestellinfo', 178, 14, '#5be3d9']];
    return SV('<rect x="40" y="6" width="290" height="190" rx="6" fill="#161c22" stroke="#38424d"/>' + bands.map(b => `<rect x="48" y="${b[2]}" width="274" height="${b[3]}" rx="3" fill="${b[4]}" fill-opacity=".22" stroke="${b[4]}"/><circle cx="26" cy="${b[2] + b[3] / 2}" r="9" fill="${b[4]}"/>${TX(26, b[2] + b[3] / 2 + 4, b[0], { c: '#10151a', s: 11, w: 1 })}${TX(185, b[2] + b[3] / 2 + 4, b[1], { s: 11.5 })}`).join(''), 'Aufbau einer Datenblattseite');
  }
  function svgRatings() {
    return SV(`${TX(180, 24, 'Beispiel: Versorgungsspannung eines Bauteils', { s: 12.5, w: 1 })}
      <rect x="20" y="70" width="70" height="34" fill="#8d99a6" fill-opacity=".3" stroke="#8d99a6"/><rect x="90" y="70" width="130" height="34" fill="#4cd964" fill-opacity=".35" stroke="#4cd964"/><rect x="220" y="70" width="50" height="34" fill="#ffb340" fill-opacity=".3" stroke="#ffb340"/><rect x="270" y="70" width="70" height="34" fill="#ff5c5c" fill-opacity=".35" stroke="#ff5c5c"/>
      ${TX(55, 91, 'zu wenig', { s: 11 })}${TX(155, 91, 'Betriebsbereich', { s: 12, w: 1 })}${TX(245, 91, '?', { s: 14, w: 1 })}${TX(305, 91, 'Zerstörung', { s: 11 })}
      <path d="M90 108v10M220 108v10M270 108v10" stroke="#e8ecf0"/>${TX(90, 132, '4,5 V', { s: 11 })}${TX(220, 132, '16 V', { s: 11 })}${TX(270, 132, '18 V', { s: 11 })}
      ${TX(155, 150, 'Recommended Operating Conditions', { c: '#4cd964', s: 11 })}${TX(305, 150, 'Absolute Maximum', { c: '#ff8a7a', s: 11 })}
      ${TX(180, 178, 'Zwischen 16 V und 18 V: nichts ist garantiert, auch kein Dauerbetrieb.', { s: 11, c: '#8d99a6' })}${TX(180, 193, '(Zahlenwerte nur zur Veranschaulichung)', { s: 10, c: '#8d99a6' })}`, 'Betriebsbereich und Absolute Maximum Rating auf einem Zahlenstrahl');
  }
  function svgTMM() {
    return SV(`${TX(180, 18, 'Wie streut ein Parameter?', { w: 1, s: 12.5 })}
      <path d="M40 120 C90 118 110 40 180 40 C250 40 270 118 320 120" fill="none" stroke="#3b9eff" stroke-width="2"/><path d="M40 120H320" stroke="#8d99a6"/>
      <path d="M70 120V50M180 120V40M290 120V50" stroke="#ffb340" stroke-dasharray="4 3"/>${TX(70, 44, 'Min', { c: '#ffb340', w: 1 })}${TX(180, 34, 'Typ', { c: '#ffb340', w: 1 })}${TX(290, 44, 'Max', { c: '#ffb340', w: 1 })}
      <rect x="40" y="136" width="280" height="54" rx="6" fill="#161c22" stroke="#38424d"/>${TX(100, 154, 'Min', { c: '#8d99a6', s: 11 })}${TX(180, 154, 'Typ', { c: '#8d99a6', s: 11 })}${TX(260, 154, 'Max', { c: '#8d99a6', s: 11 })}
      ${TX(100, 176, '–', { s: 14 })}${TX(180, 176, '0,72', { s: 14, w: 1 })}${TX(260, 176, '1,0', { s: 14 })}`, 'Min, Typ und Max als Streuung');
  }
  function svgLog() {
    const X = v => 60 + Math.log10(v) * 100;
    return SV(`<rect x="60" y="30" width="200" height="140" fill="#161c22" stroke="#38424d"/>
      ${[1, 10, 100].map(v => `<path d="M${X(v)} 30V170" stroke="#38424d"/>${TX(X(v), 186, String(v), { s: 11 })}`).join('')}${[2, 3, 4, 5, 6, 7, 8, 9, 20, 30, 40, 50, 60, 70, 80, 90].map(v => `<path d="M${X(v)} 160V170" stroke="#8d99a6"/>`).join('')}
      <polyline fill="none" stroke="#3b9eff" stroke-width="2.4" points="${[[1, 150], [3.16, 134], [10, 112], [31.6, 82], [100, 44]].map(p => X(p[0]) + ',' + p[1]).join(' ')}"/>
      <path d="M${X(3.16)} 170V134H60" stroke="#ffb340" stroke-dasharray="4 3" fill="none"/><circle cx="${X(3.16)}" cy="134" r="4" fill="#ffb340"/>
      ${TX(150, 17, 'x-Achse logarithmisch (1 · 10 · 100)', { s: 11.5 })}${TX(X(3.16) + 8, 150, '3,16', { c: '#ffb340', a: 'start', s: 11 })}${TX(300, 80, 'Mitte einer', { s: 11.5 })}${TX(300, 94, 'Dekade = √10', { s: 11.5 })}${TX(300, 108, '= 3,16, nicht 5,5', { s: 11.5 })}`, 'Kennlinie mit logarithmischer x-Achse und Ablesung');
  }
  function svgDerate() {
    return SV(`${TX(180, 16, 'Derating: Ptot sinkt mit der Umgebungstemperatur', { w: 1, s: 12 })}<path d="M50 40V160H335" stroke="#8d99a6" fill="none"/>
      <polyline points="50,40 97,40 330,160" fill="none" stroke="#3b9eff" stroke-width="2.4"/><path d="M181 160V83H50" stroke="#ffb340" stroke-dasharray="4 3" fill="none"/><circle cx="181" cy="83" r="4" fill="#ffb340"/>
      ${TX(52, 34, 'Ptot', { a: 'start', s: 11 })}${TX(97, 176, '25 °C', { s: 11 })}${TX(181, 176, '70 °C', { s: 11, c: '#ffb340' })}${TX(330, 176, 'Tj max', { s: 11 })}${TX(335, 192, 'Tamb', { a: 'end', s: 10.5, c: '#8d99a6' })}
      ${TX(190, 76, 'bei 70 °C: schon deutlich weniger', { a: 'start', s: 11, c: '#ffb340' })}${TX(110, 56, 'Tabellenwert gilt nur hier', { a: 'start', s: 11 })}
      <rect x="226" y="108" width="100" height="22" rx="4" fill="#161c22" stroke="#38424d"/>${TX(276, 123, 'Tj = Tamb + P · Rth', { s: 11 })}`, 'Derating-Kurve von Ptot über der Umgebungstemperatur');
  }
  function svgPkg() {
    const left = [1, 2, 3, 4], right = [8, 7, 6, 5];
    return SV(`<rect x="62" y="34" width="68" height="132" rx="4" fill="#2c343e" stroke="#8d99a6"/><path d="M82 34a14 14 0 0 0 28 0" fill="#14181c" stroke="#8d99a6"/><circle cx="74" cy="50" r="3.5" fill="#e8ecf0"/>
      ${left.map((n, i) => `<rect x="42" y="${46 + i * 30}" width="20" height="10" fill="#cfd6dd"/>${TX(34, 55 + i * 30, String(n), { a: 'end', s: 11 })}`).join('')}${right.map((n, i) => `<rect x="130" y="${46 + i * 30}" width="20" height="10" fill="#cfd6dd"/>${TX(158, 55 + i * 30, String(n), { a: 'start', s: 11 })}`).join('')}
      ${TX(96, 22, 'DIP-8 von oben', { s: 11.5, w: 1 })}${TX(96, 186, 'Pin 1: Kerbe links oben / Punkt', { s: 10.5, c: '#ffb340' })}
      <path d="M232 50a36 36 0 0 1 72 0v62h-72z" fill="#2c343e" stroke="#8d99a6"/><path d="M232 112h72" stroke="#14181c" stroke-width="2"/>
      ${[0, 1, 2].map(i => `<rect x="${244 + i * 24}" y="112" width="8" height="40" fill="#cfd6dd"/>${TX(248 + i * 24, 168, String(i + 1), { s: 11 })}`).join('')}${TX(268, 22, 'TO-92 (flache Seite vorn)', { s: 11.5, w: 1 })}${TX(268, 186, 'Belegung je nach Typ verschieden!', { s: 10.5, c: '#ffb340' })}`, 'DIP-8 mit Kerbe und Pin 1, TO-92 von vorn');
  }
  function svgTol() {
    return SV(`${TX(180, 18, 'Spannungsteiler 10 kΩ / 10 kΩ, ±1 %, 5 V', { w: 1, s: 12 })}<path d="M30 110H330" stroke="#8d99a6"/>
      <rect x="150" y="88" width="60" height="22" fill="#4cd964" fill-opacity=".35" stroke="#4cd964"/><path d="M150 84V118M180 84V118M210 84V118" stroke="#e8ecf0"/>${TX(150, 134, '2,475 V', { s: 11.5 })}${TX(180, 150, '2,5 V', { s: 11.5, w: 1 })}${TX(210, 134, '2,525 V', { s: 11.5 })}
      ${TX(180, 76, 'Min … Nenn … Max', { s: 11.5, c: '#4cd964' })}${TX(180, 176, 'Worst Case: R1 groß und R2 klein ergibt das Minimum.', { s: 11, c: '#8d99a6' })}${TX(180, 191, 'R1 klein und R2 groß ergibt das Maximum.', { s: 11, c: '#8d99a6' })}`, 'Toleranzband eines Spannungsteilers');
  }
  const GL16 = [['absolute maximum ratings', 'Grenzwerte, nie überschreiten'], ['recommended operating conditions', 'empfohlene Betriebsbedingungen'], ['forward voltage', 'Durchlassspannung'], ['reverse leakage current', 'Sperrstrom'], ['quiescent current', 'Ruhestrom'], ['dropout voltage', 'Mindest-Spannungsabfall am Regler'], ['propagation delay', 'Signallaufzeit'], ['rise time / fall time', 'Anstiegs- / Abfallzeit'], ['thermal resistance', 'Wärmewiderstand (K/W)'], ['junction temperature', 'Sperrschichttemperatur'], ['derating', 'Leistungsminderung'], ['test conditions', 'Messbedingungen'], ['pin assignment', 'Pinbelegung'], ['package', 'Gehäuse'], ['typical / minimum / maximum', 'typisch / Min / Max'], ['pull-up resistor', 'Pull-up-Widerstand']];
  const LEARN = [
    { t: 'Aufbau eines Datenblatts', open: true, exT: 'Datenblatt öffnen', ex: { ds: 'tf-lm317', focus: { section: 'abs' } }, h: () => `<p>Fast alle Datenblätter sind gleich aufgebaut. Wer die Reihenfolge kennt, findet jede Zahl in Sekunden.</p>${svgStruct()}<ol><li><b>Titelseite:</b> Typ, Kurzbeschreibung, Merkmale (Features), oft schon das Gehäusebild und ein Blockschaltbild.</li><li><b>Pinbelegung:</b> welcher Anschluss was tut, mit Gehäuse von oben gesehen.</li><li><b>Absolute Maximum Ratings:</b> Grenzwerte, bei deren Überschreiten das Bauteil Schaden nehmen kann.</li><li><b>Recommended Operating Conditions:</b> der Bereich, in dem das Bauteil wie beschrieben arbeitet.</li><li><b>Electrical Characteristics:</b> die Tabelle mit Min, Typ, Max und den Testbedingungen.</li><li><b>Kennlinien:</b> Diagramme, wie sich Werte mit Strom, Spannung oder Temperatur ändern.</li><li><b>Thermik und Gehäuse:</b> Wärmewiderstand, Maße, Lötflächen.</li><li><b>Anwendung und Bestellinfo:</b> Beispielschaltungen und genaue Typbezeichnungen.</li></ol><p class="hint2">Tipp: Beginne immer bei der Titelseite und bei den Absolute Maximum Ratings, dann bei den Kennwerten, die du brauchst.</p>` },
    { t: 'Absolute Maximum Ratings und Betriebswerte', exT: 'Am 1N4148 ansehen', ex: { ds: 'tf-1n4148', focus: { section: 'abs' } }, h: () => `<p>Die <b>Absolute Maximum Ratings</b> sind Zerstörungsgrenzen: Darüber kann das Bauteil dauerhaft Schaden nehmen. Sie sind <b>keine Betriebswerte</b> und kein Ziel, an das du dich heranarbeiten darfst.</p>${svgRatings()}<ul><li>Innerhalb der <b>Recommended Operating Conditions</b> funktioniert das Bauteil wie in den Kennwerten beschrieben.</li><li>Zwischen Betriebsbereich und Grenzwert ist nichts garantiert: keine Genauigkeit, keine Lebensdauer.</li><li>Die Grenzwerte gelten <b>einzeln</b> und nicht gleichzeitig ausgereizt: Spannung und Strom und Temperatur an der Grenze gleichzeitig führt fast sicher zum Ausfall.</li><li>Plane immer <b>Reserve</b> ein (zum Beispiel 20 bis 50 % bei Spannung und Strom, bei induktiven Lasten mehr).</li></ul>` },
    { t: 'Min, Typ, Max und Testbedingungen', exT: 'Kennwerte-Tabelle öffnen', ex: { ds: 'tf-bc547', focus: { section: 'elec' } }, h: () => `<p>In der Tabelle <b>Electrical Characteristics</b> stehen je Parameter bis zu drei Werte.</p>${svgTMM()}<table><tr><th>Spalte</th><th>Bedeutung</th><th>Wofür?</th></tr><tr><td>Min</td><td>garantiert mindestens</td><td>Auslegung, wenn ein Mindestwert nötig ist (zum Beispiel Stromverstärkung hFE)</td></tr><tr><td>Typ</td><td>typischer Wert, nicht garantiert</td><td>Orientierung, Berechnungen im Mittel</td></tr><tr><td>Max</td><td>garantiert höchstens</td><td>Auslegung, wenn ein Höchstwert gefährlich ist (zum Beispiel Sperrstrom)</td></tr></table><p><b>Testbedingungen</b> (Test conditions) gehören zum Wert: Eine Flussspannung von 0,72 V gilt nur bei dem angegebenen Strom und der angegebenen Temperatur. Bei anderen Bedingungen musst du in die Kennlinien schauen. Ein Strich „–“ bedeutet: nicht spezifiziert, nicht „null“. Rechne bei Sicherheitsfragen mit dem <b>ungünstigsten</b> Wert (Worst Case).</p>` },
    { t: 'Kennlinien lesen (linear und logarithmisch)', exT: 'Kennlinie im Betrachter ablesen', ex: { ds: 'tf-1n4148', focus: { section: 'graphs', index: 0 }, mode: 'ablesen' }, h: () => `<p>Kennlinien zeigen, wie sich ein Wert mit einer anderen Größe ändert. Achte zuerst auf die <b>Achsen</b>: Beschriftung, Einheit und ob sie <b>linear</b> oder <b>logarithmisch</b> geteilt sind.</p>${svgLog()}<ul><li>Linear: gleiche Abstände sind gleiche <b>Differenzen</b>.</li><li>Logarithmisch: gleiche Abstände sind gleiche <b>Faktoren</b>. Eine Dekade ist ein Faktor 10 (1, 10, 100). Die Mitte zwischen 1 und 10 liegt bei etwa 3,16, nicht bei 5,5.</li><li>Ablesen: auf der x-Achse zum Wert, senkrecht bis zur Kurve, waagerecht zur y-Achse. Ablesegenauigkeit: einige Prozent.</li><li>Mehrere Kurven gehören meist zu verschiedenen Temperaturen oder Spannungen: lies die Legende.</li><li>Kennlinien zeigen oft <b>typische</b> Werte, keine Garantie. Außerhalb der gezeichneten Kurve ablesen ist Raten.</li></ul>` },
    { t: 'Thermik und Derating', exT: 'Thermik am Leistungstransistor', ex: { ds: 'tf-bd139', focus: { section: 'thermal' } }, h: () => `<p>Jedes Bauteil, das Leistung umsetzt, wird warm. Entscheidend ist die Temperatur im Chip, die <b>Sperrschichttemperatur</b> Tj, nicht die Temperatur der Umgebung.</p>${svgDerate()}<ul><li><b>Tj = Tamb + P · Rth(j-a)</b> mit dem Wärmewiderstand Rth(j-a) in K/W.</li><li>Beispiel: P = 1 W, Rth(j-a) = 62,5 K/W, Tamb = 40 °C ergibt Tj = 40 °C + 62,5 K = 102,5 °C.</li><li><b>Ptot(Tamb) = (Tj max − Tamb) / Rth(j-a):</b> Der Tabellenwert Ptot gilt nur bei 25 °C und sinkt bei höherer Umgebungstemperatur (Derating).</li><li>Mit Kühlkörper addieren sich die Wärmewiderstände: Rth(j-a) = Rth(j-c) + Rth(c-k) + Rth(k-a).</li><li>Bei Gleichspannungsreglern ist die Verlustleistung P = (Uin − Uout) · Iout. Das ist bei großem Spannungsunterschied schnell viel.</li></ul>` },
    { t: 'Gehäuse und Pinbelegung', exT: 'Gehäuse und Pinbelegung ansehen', ex: { ds: 'tf-lm317', focus: { section: 'pkg' } }, h: () => `<p>Die Pinbelegung steht im Datenblatt immer <b>von oben</b> gesehen (Top View). Beim Einlöten schaust du oft von der Lötseite: Dann ist alles gespiegelt.</p>${svgPkg()}<ul><li><b>DIP:</b> Pin 1 liegt links neben der Kerbe oder beim Punkt. Gezählt wird gegen den Uhrzeigersinn. Raster 2,54 mm (0,1 Zoll), Reihenabstand beim schmalen DIP 7,62 mm.</li><li><b>TO-92:</b> Flache Seite zu dir, Pins nach unten: Pin 1 links. Welche Funktion Pin 1 hat, steht im Datenblatt und ist je Typ verschieden (zum Beispiel BC547 und 2N3904 sind unterschiedlich belegt!).</li><li><b>TO-220:</b> Beschriftung zu dir, Pins nach unten, Pin 1 links. Die Metallfahne ist meist mit einem Anschluss verbunden (Isolierung beachten).</li><li><b>SMD:</b> Pin 1 am Punkt oder an der abgeschrägten Ecke, Reihenfolge wie beim DIP.</li><li>Gleiches Bauteil, anderes Gehäuse: Pinbelegung und Wärmewiderstand können abweichen. Bestell-Typ genau lesen.</li></ul>` },
    { t: 'Fachenglisch: Grundwortschatz', exT: 'Karteikarten üben', ex: { tab: 'engl' }, h: () => `<p>Fast alle Datenblätter sind auf Englisch. Mit etwa 100 Begriffen kommst du schon sehr weit. Diese 16 solltest du sofort kennen:</p><div class="glo">${GL16.map(g => `<div><b>${esc(g[0])}</b><br><span style="color:var(--mute)">${esc(g[1])}</span></div>`).join('')}</div><p class="hint2">Im Tab „Fachenglisch“ übst du mit Karteikarten (Leitner-Kasten): Was du weißt, kommt seltener, was du nicht weißt, wieder und wieder. Dazu gibt es Lückentexte aus echten Datenblattsätzen.</p>` },
    { t: 'Typische Fallstricke', exT: 'Am PCF8574 nachlesen', ex: { ds: 'tf-pcf8574', focus: { section: 'elec' } }, h: () => `<ul><li><b>Ptot gilt nur bei 25 °C.</b> Bei 70 °C Umgebung darf das Bauteil deutlich weniger. Rechne mit Tj, nicht mit dem Tabellenwert.</li><li><b>Tj statt Tamb:</b> Grenzwerte beziehen sich auf die Sperrschicht, nicht auf die Raumtemperatur.</li><li><b>Strom pro Pin und Gesamtstrom:</b> Ein Pin darf zum Beispiel 25 mA, aber alle zusammen dürfen nur einen kleineren Gesamtstrom über VCC und GND ziehen.</li><li><b>Quasi-bidirektionaler Ausgang</b> (Beispiel im Übungsdatenblatt PCF8574): Low kann viel Strom aufnehmen (IOL 25 mA), High liefert nur sehr wenig (IOH 1 mA). Eine LED schaltest du also von +V gegen den Pin, nicht gegen Masse.</li><li><b>Peak ist nicht Dauer:</b> Spitzen- oder Impulswerte (peak, pulsed) dürfen nur kurz auftreten, Dauerwerte (continuous) gelten ständig.</li><li><b>Einheiten:</b> µA, mA und A, nF und µF, kΩ und MΩ nie verwechseln.</li><li><b>Fußnoten</b> (hochgestellte Zahlen) enthalten oft die wichtigste Einschränkung.</li><li><b>Typ ist nicht Max:</b> Für die Auslegung zählen Min und Max, Typ ist nur ein Mittelwert.</li><li><b>Testbedingungen übersehen:</b> Ein Wert bei 25 °C gilt nicht bei 85 °C.</li><li><b>Absolute Maximum Rating ist kein Zielwert!</b></li></ul>` },
    { t: 'Toleranzen und Worst-Case-Rechnung', exT: 'Worst-Case beim LM317 rechnen', ex: { ds: 'tf-lm317', calc: { id: 'wc317', fromDs: true, vals: { r1: 240, r2: 720, t: 1 } } }, h: () => `<p>Kein Bauteil hat genau den Nennwert. Widerstände haben eine Toleranz (zum Beispiel ±1 %), Referenzspannungen streuen zwischen Min und Max. Bei der <b>Worst-Case-Rechnung</b> setzt du jede Größe so ungünstig ein, wie es die Datenblattgrenzen erlauben.</p>${svgTol()}<ul><li>Spannungsteiler: Uout = Uin · R2 / (R1 + R2). Minimum bei R1 am oberen und R2 am unteren Toleranzrand, Maximum umgekehrt.</li><li>Beispiel LM317: Uout = Vref · (1 + R2 / R1) + Iadj · R2. Mit Vref 1,2 bis 1,3 V und R1 = 240 Ω, R2 = 720 Ω (je ±1 %) liegt der Ausgang nicht bei 5,0 V, sondern etwa zwischen 4,73 V und 5,28 V (ohne Adjust-Strom).</li><li>Prüfe dann, ob die Schaltung auch bei den Eckwerten noch funktioniert.</li></ul>` }
  ];
  let helpDone = false;
  function renderHelp() {
    const V = $('#helpView'); if (helpDone) return; helpDone = true;
    V.innerHTML = `<p class="big">Lernen und Hilfe</p><p class="hint2" style="margin:0 0 12px">Kurz erklärt, wie du Datenblätter liest und verstehst. Mit „Beispiel öffnen“ siehst du die Stelle direkt im Datenblatt.</p>` +
      LEARN.map((s, i) => `<details${s.open ? ' open' : ''}><summary>${i + 1} · ${esc(s.t)}</summary><div class="hb2">${s.h()}<div class="tryit"><button class="chip s on" data-lx="${i}" title="${esc(s.exT)}">▶ Beispiel öffnen: ${esc(s.exT)}</button></div></div></details>`).join('') +
      `<details><summary>${LEARN.length + 1} · Tastenkürzel</summary><div class="hb2">${keysHtml()}</div></details>`;
  }
  $('#helpView').addEventListener('click', e => {
    const b = e.target.closest('[data-lx]'); if (!b) return; const s = LEARN[+b.dataset.lx], ex = Object.assign({ id: 'l' + b.dataset.lx, name: 'Lernen: ' + s.t }, clone(s.ex));
    if (ex.ds && LIBX() && !dsById(ex.ds)) ex.ds = LIBX()[0].id;
    if (ex.calc && ex.calc.fromDs) { /* Werte aus dem Datenblatt */ }
    loadExample(ex);
  });
  function keysHtml() {
    const k = (a, t) => `<tr><td style="white-space:nowrap"><code>${a}</code></td><td>${t}</td></tr>`;
    return '<table>' + k('1 bis 7', 'Tab wechseln (Bibliothek, Lesen üben, Fachenglisch, Bauteilwahl, Rechnen, Aufgaben, Lernen)') + k('/', 'Datenblatt suchen (Bibliothek)') + k('← →', 'Vorheriges / nächstes Datenblatt (Bibliothek)') + k('N', 'Neue Frage, neues Szenario oder nächste Karte') + k('Leertaste', 'Karteikarte umdrehen (Fachenglisch)') + k('J / N', 'Karte gewusst / nicht gewusst (nach dem Umdrehen)') + k('E', 'Effekte und Ton ein oder aus') + k('Strg + S', 'Arbeitsstand speichern') + k('?', 'Diese Übersicht') + '</table><p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>';
  }

  /* ============================================================ Oberfläche: Kopf, Tabs, Leiste */
  const TABS = [['lib', '📚', 'Bibliothek'], ['read', '🔍', 'Lesen üben'], ['engl', '🇬🇧', 'Fachenglisch'], ['pick', '🧩', 'Bauteilwahl'], ['calc', '🧮', 'Rechnen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Lernen']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd" style="display:none"></span>' : ''}</button>`).join('');
    updateTaskBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t, force) {
    if (!TABS.some(x => x[0] === t)) t = 'lib'; const prev = S.tab; S.tab = t; lsPut('ds.tab', t); if (t !== 'tasks') S.workTab = t;
    $('#mid').dataset.tab = t; $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (t === 'lib') {
      buildLib();
      if (LIBX()) {
        if (!S.dsId || !dsById(S.dsId)) S.dsId = LIBX()[0].id; libHead();
        if (!VW.lib || !VW.lib.inst) mountView('lib', $('#vwLib'), () => dsById(S.dsId), 'lesen'); else if (force || prev !== t) viewRefresh('lib');
        if (!S.seen[S.dsId]) markSeen(S.dsId);
      }
    } else if (t === 'read') { renderRead(); readQSetup(); }
    else if (t === 'engl') renderEngl(); else if (t === 'pick') renderPick(); else if (t === 'calc') renderCalc(); else if (t === 'tasks') renderTasks(); else if (t === 'help') renderHelp();
    updateChrome();
  }
  function updateTitle() {
    const ds = dsById(S.dsId), sub = S.tab === 'lib' && ds && LIBX() ? ds.part : ((TABS.find(x => x[0] === S.tab) || [0, 0, ''])[2]);
    $('#title').innerHTML = esc(S.name) + (S.dirty ? ' •' : '') + '\n<small>' + esc(sub) + '</small>';
    document.title = 'Datenblatt-Lab: ' + S.name;
  }
  $('#title').onclick = async () => { const r = await ask('Name des Arbeitsstands', [{ key: 'n', label: 'Name', type: 'text', value: S.name }]); if (r && r.n.trim()) { S.name = r.n.trim(); S.dirty = true; updateChrome(); saveCurSoon(); } };
  let palSig = '';
  function buildPal() {
    const fxOn2 = fxOn(), F = !!root.LochFX, seen = seenN(), nL = libList().length, sig = [fxOn2, F, seen, nL, RD.nOk, learnedN2(), PKS.ok].join('|');
    if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button class="chip ${fxOn2 ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn2}" aria-label="Effekte und Ton" title="Effekte und Ton">${fxOn2 ? '🎉' : '🔇'} Effekte</button>` : ''}<button class="chip" data-a="rand" title="Zufälliges Datenblatt öffnen">🎲 Zufälliges Datenblatt</button><span class="sep"></span>
      <span id="stat">Datenblätter <b>${seen}${nL ? '/' + nL : ''}</b> angesehen · Fragen gelöst <b>${RD.nOk}</b> · Begriffe gelernt <b>${learnedN2()}</b> · Bauteile richtig gewählt <b>${PKS.ok}</b></span>`;
  }
  const learnedN2 = () => { try { return learnedN(); } catch (e) { return 0; } };
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') toggleFx(); else if (b.dataset.a === 'rand') { const L = libList().filter(x => x.id !== S.dsId); if (!L.length) { toast('Keine Datenblätter geladen'); return; } setTab('lib'); selectDs(pk(L).id); }
  });
  function toggleFx() {
    const F = root.LochFX; if (!F) return; F.setMuted(fxOn()); palSig = ''; updateChrome(); toast(fxOn() ? 'Effekte und Ton an' : 'Ton aus');
    if (fxOn()) F.sound('ding', 0.6);
  }
  function updateChrome() { updateTitle(); buildPal(); updateTaskBar(); }
  $('#bEx').onclick = openExamples; $('#bOpen').onclick = openList; $('#bTasks').onclick = () => setTab('tasks'); $('#bShare').onclick = shareNow; $('#bPrint').onclick = printNow;

  /* ============================================================ Menü */
  function openMenu() {
    const nT = (TK() || []).length;
    const rows = [
      ['tasks', 'Aufgaben', nT ? nT + ' Aufgaben mit automatischer Prüfung' : 'Aufgaben folgen'], ['new', 'Neuer Arbeitsstand', 'Markierungen und Rechner leeren und von vorn beginnen'], ['ex', 'Beispiele', exampleList().length + ' Beispiele zum Ausprobieren'],
      ['open', 'Öffnen', 'Gespeicherte Arbeitsstände auf diesem Gerät'], ['save', 'Speichern unter …', S.name], ['share', 'Teilen', 'Link zum Weitergeben (Arbeitsstand steckt im Link)'], ['import', 'Aus Code oder Link laden', 'Geteilten Arbeitsstand einfügen'],
      ['fx', 'Effekte und Ton: ' + (fxOn() ? 'an' : 'aus'), 'Sprüche, Konfetti und lustige Töne ein- oder ausschalten'], ['print', 'Drucken', 'Datenblatt-Kerndaten, Markierungen und letzte Rechnung'], ['calc', 'Taschenrechner', 'Ohm, Farbcode, Leitung und mehr'],
      ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'],
      ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten (Taste ? drücken)'], ['help', 'Hilfe und Lernen', 'Datenblätter lesen, kurz erklärt'], ['start', 'Zur Startseite', '']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
    });
  }
  async function newWork() {
    if (S.task) { toast('Beende zuerst die Aufgabe.'); return; }
    if (S.dirty && hasWork() && !(await confirmSheet('Neuer Arbeitsstand?', 'Dein bisheriger Stand wird gesichert (Menü „Öffnen“) und der Arbeitsplatz geleert.', 'Neu beginnen'))) return;
    const had = stash(); S.marks = {}; Object.keys(calcVals).forEach(k => { delete calcVals[k]; }); CVsync(); S.note = ''; S.name = 'Arbeitsstand'; S.id = null; S.dirty = false; S.calcId = 'led'; viewReload('lib'); setTab(S.tab, true); toast(had ? 'Neu begonnen, dein bisheriger Stand ist gesichert' : 'Neu begonnen');
  }
  function menuAct(m) {
    switch (m) {
      case 'tasks': setTab('tasks'); break; case 'new': newWork(); break; case 'ex': openExamples(); break; case 'open': openList(); break; case 'save': doSave(); break;
      case 'share': shareNow(); break; case 'import': importSheet(); break; case 'fx': toggleFx(); break;
      case 'print': printNow(); break; case 'calc': if (root.Rechner) root.Rechner.open(); break; case 'abz': if (root.Badges) root.Badges.open(); break;
      case 'kamp': if (root.Kampagne) root.Kampagne.open(); break; case 'trainer': if (root.Trainer) root.Trainer.start(); break; case 'neu': if (root.LabNeu) root.LabNeu(); break;
      case 'erg': if (root.Auswertung) root.Auswertung.openSend(); break; case 'keys': if (root.LochKeys) root.LochKeys.help(); else keysSheet(); break;
      case 'help': setTab('help'); break; case 'start': location.href = 'index.html'; break;
    }
  }
  $('#bMenu').onclick = openMenu;
  const keysSheet = () => sheet('Tastenkürzel', b => { b.innerHTML = keysHtml(); });

  /* ============================================================ Tastatur */
  const typing = e => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  root.addEventListener('keydown', e => {
    if (typing(e) || e.altKey || document.querySelector('.backdrop')) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, l = k.toLowerCase();
    if (mod) { if (l === 's') { e.preventDefault(); doSave(); } return; }
    if (k >= '1' && k <= '7') { setTab(TABS[+k - 1][0]); return; }
    if (S.tab === 'lib') { if (k === 'ArrowLeft') { libStep(-1); return; } if (k === 'ArrowRight') { libStep(1); return; } }
    if (l === 'e') { toggleFx(); return; }
    if (S.tab === 'engl') {
      if ((k === ' ' || k === 'Enter') && EN.cur && !EN.flip && EN.mode !== 'gap' && EN.how === 'card') { e.preventDefault(); enFlip(); return; }
      if (l === 'j' && EN.flip) { enGrade(true); return; } if (l === 'n') { if (EN.flip) enGrade(false); else if (EN.done) { EN.empty = false; nextCard(false); renderEngl(); } return; }
    } else if (l === 'n') {
      if (S.tab === 'read') { nextRead(qCur && qCur.id); renderRead(); readQSetup(); } else if (S.tab === 'pick') { pkSc = null; newScenario(); renderPick(); }
    }
  });

  /* ============================================================ Schnittstellen für Trainer, Tasten, Tests */
  root.LabTrainerAPI = {
    lab: 'ds', tab: () => S.tab, go: setTab, simMode: () => false, running: () => false, ds: () => S.dsId, load: loadExampleByName, examples: () => exampleList().map(e => e.name), task: () => (S.task ? S.task.id : null), saved: () => saves().length,
    seen: () => seenN(), opened: () => S.opens, marks: () => Object.keys(S.marks).reduce((n, k) => n + Object.keys(S.marks[k]).length, 0), reads: () => S.readsN, questions: () => RD.n, answered: () => RD.nOk, cards: () => learnedN2(), picks: () => PKS.n, calcUsed: () => calcUsed.size > 0, faults: () => 0
  };
  root.LabKeysAdapter = {
    lab: 'ds', sheet: (title, build) => (title === 'Tastenkürzel' ? sheet(title, b => { b.innerHTML = keysHtml(); }) : sheet(title, build)), esc, toast,
    sim: null, busy: () => true, has: () => false, search: () => { setTab('lib'); const q = $('#libQ'); if (q) { const d = $('#libDet'); if (d) d.open = true; q.focus(); q.select(); } }
  };
  /* kleine Testschnittstelle */
  root.DS_UI = { S, resetCaches: () => { qBank = null; glossCache = null; gapCache = null; qCur = null; pkSc = null; }, showQuestion, readFilter, setTab, selectDs, goState, loadExample, loadExampleByName, startTask, checkTask, collectAnswer, exampleList, BUILTIN, retryLoad, bank, QGEN, rdPool, nextRead, readCheck, RD, glossary, gapSentences, EN, LT: () => LT, grade, pickCard, nextCard, SCEN, evalPick, clsOf, ROLE, roleF, newScenario, PKS, CALC, eSnap, calcVals, CV, snapshot, applyItem, saveItem, LEARN, interpPts, graphY, graphX, fx, eng, pv, curveOut, calcOut, renderCalc, renderRead, renderEngl, renderPick, mountView, VW, missingFiles, state: () => ({ qCur, pkSc, pkSel, pkRes }) };

  /* ============================================================ Start */
  function init() {
    const cur = lsGet('ds.cur', null);
    if (cur) {
      S.marks = cur.marks && typeof cur.marks === 'object' ? cur.marks : {}; Object.assign(calcVals, cur.calcVals || {}); CVsync(); S.calcId = CALC.some(c => c.id === cur.calcId) ? cur.calcId : 'led';
      S.name = cur.name || 'Arbeitsstand'; S.id = cur.id || null; S.task = cur.task ? { id: cur.task } : null; S.dirty = !!cur.dirty; S.note = cur.note || ''; S.dsId = cur.ds || null;
    } else CVsync();
    const last = lsRaw('ds.last', ''); if (LIBX()) { if (!S.dsId || !dsById(S.dsId)) S.dsId = last && dsById(last) ? last : LIBX()[0].id; }
    const dt = $('#libDet'); if (dt) dt.open = window.innerWidth >= 900;
    buildTabs(); buildLib(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'lib');
    if (!lsRaw('ds.welcome', '')) { lsPut('ds.welcome', '1'); setTimeout(() => toast('Willkommen im Datenblatt-Lab! Wähle links ein Datenblatt oder übe im Tab „Lesen üben“.'), 900); }
    /* Aufrufparameter von Startseite, Lernpfad, Kampagne und Lernheften: ?aufgabe=ds1, ?ex=Name, ?bsp, ?neu */
    try {
      const q = new URLSearchParams(location.search), qa = q.get('aufgabe'), qe = q.get('ex');
      if (qa && (TK() || []).some(x => x.id === qa)) setTimeout(() => startTask(qa), 250);
      else if (qe) setTimeout(() => loadExampleByName(qe), 250);
      else if (q.has('bsp')) setTimeout(openExamples, 400);
      else if (q.has('neu')) setTimeout(newWork, 400);
    } catch (e) { console.error(e); }
    if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); }
    root.addEventListener('hashchange', () => { if (/^#[sz]=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); loadShared(h); } });
    root.addEventListener('beforeunload', saveCur);
  }
  init();
})(window);
