/* thmrig-mosfet.js - Thermik-Lab, Pruefstand mosfet (MOSFET als Schalter, IRLZ34N) (WP2b).
 * Erzeugt aus quelle/thmlab/thmrig_b_*.part.js und dem Anlagenteil (node quelle/thmlab/build_thmrig_b.js); nicht von Hand aendern.
 * Abhaengigkeit: THM_CORE (thmcore.js: chain, steady, thermal, pzul, pulseTj, zth, mountControls, mountPresets); THM_DRAW (thmdraw.js) optional (Ansichten, Effekte).
 * Einheiten: Temperaturen in Grad C, Differenzen in K, Zeiten in Prozess-Sekunden (timeScale 30, Anzeige in Prozess-Minuten).
 * Deterministisch (kein Zufall); step, stepProcess und setControl werfen nie. Mit Node ladbar (module.exports = THM_RIGS).
 */
(function (root) {
  'use strict';
  const R = root.THM_RIGS = root.THM_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Gemeinsamer Block 1/3: Grundlagen, Kernadapter, Zeichenbausteine (in thmrig-mosfet.js und thmrig-bauteil.js identisch) =====
  const TAU = Math.PI * 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  // Farben: werden bei jedem draw() aus Seitenthema (data-theme, prefers-color-scheme) und THM_DRAW.cssColors gesetzt (Hell und Dunkel)
  const PALS = {
    dark: { theme: 'dark', bg: '#14181c', panel: '#1b222a', panel2: '#252e38', line: '#3a4653', fg: '#e8eef4', mute: '#a0acb8', accent: '#4aa3ff', ok: '#4cd964', warn: '#ffb340', danger: '#ff6b6b', leit: '#4aa3ff', sw: '#ffa040', badge: 'rgba(14,19,24,0.9)', ink: '255,255,255', jc: '#ff6b4a', ck: '#ffc233', k: '#38b6d8' },
    light: { theme: 'light', bg: '#f3f5f8', panel: '#ffffff', panel2: '#e7ecf1', line: '#b8c2ce', fg: '#1a222b', mute: '#566473', accent: '#0b63c5', ok: '#17843a', warn: '#a85f00', danger: '#c62828', leit: '#0b63c5', sw: '#c25e00', badge: 'rgba(255,255,255,0.94)', ink: '0,0,0', jc: '#d9432b', ck: '#c98a00', k: '#1a85a8' }
  };
  const COL = { bg: PALS.dark.bg, panel: PALS.dark.panel, panel2: PALS.dark.panel2, line: PALS.dark.line, acc: PALS.dark.accent, ok: PALS.dark.ok, warn: PALS.dark.warn, bad: PALS.dark.danger, text: PALS.dark.fg, dim: PALS.dark.mute, leit: PALS.dark.leit, sw: PALS.dark.sw, badge: PALS.dark.badge, ink: PALS.dark.ink };
  const MEMBER_COL = { jc: PALS.dark.jc, ck: PALS.dark.ck, k: PALS.dark.k };   // Farben der Glieder (Schnitt, Balken, Ersatzschaltbild gleich, wie THM_DRAW)
  const ink = (a) => 'rgba(' + COL.ink + ',' + a + ')';
  let PAL_NOW = PALS.dark;
  function themeName(opt) {
    if (opt === 'light' || opt === 'dark') return opt;
    try { const a = root.document && root.document.documentElement.getAttribute('data-theme'); if (a === 'light' || a === 'dark') return a; } catch (e) { /* ohne Seite */ }
    try { return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function applyTheme(opt, over) {
    const th = themeName(opt); let css = {};
    try { const T = root.THM_DRAW; if (T && typeof T.cssColors === 'function' && root.document) css = T.cssColors(root.document.documentElement) || {}; } catch (e) { css = {}; }
    const p = Object.assign({}, PALS[th] || PALS.dark, css, over && typeof over === 'object' ? over : {}, { theme: th });
    COL.panel = p.panel; COL.panel2 = p.panel2; COL.line = p.line; COL.acc = p.accent; COL.ok = p.ok; COL.warn = p.warn; COL.bad = p.danger; COL.text = p.fg; COL.dim = p.mute;
    COL.leit = (PALS[th] || PALS.dark).leit; COL.sw = (PALS[th] || PALS.dark).sw; COL.badge = (PALS[th] || PALS.dark).badge; COL.ink = (PALS[th] || PALS.dark).ink;
    MEMBER_COL.jc = (PALS[th] || PALS.dark).jc; MEMBER_COL.ck = (PALS[th] || PALS.dark).ck; MEMBER_COL.k = (PALS[th] || PALS.dark).k;
    PAL_NOW = p; return p;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fin = (v) => typeof v === 'number' && isFinite(v);
  // Zahl aus Zahl oder Zahlentext (Komma oder Punkt, Einheit wird toleriert); sonst Rueckfallwert d (kein Wurf)
  const num = (v, d) => {
    if (typeof v === 'string') { const m = v.trim().replace(',', '.').match(/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i); v = m ? +m[0] : NaN; }
    else if (typeof v !== 'number') return d;
    return isFinite(v) ? v : d;
  };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TS = 30;                  // timeScale: Prozess-Sekunden je Echt-Sekunde bei Zeitraffer x1 (SPEC 5)
  const STEP = 0.25;              // Kernschritt h in Prozess-Sekunden
  const REC = 16;                 // Schreiber: ein Punkt je 16 Kernschritte (4 s Prozesszeit)
  const MAX_FRAME_STEPS = 2000;   // Kernschritte je step()-Aufruf
  const MAX_PROC_STEPS = 2e6;     // Obergrenze je stepProcess()-Aufruf
  const PMAX = 5000;              // Klemmung der Leistung in W (nur gegen Ueberlauf im Weglauf-Fall)
  const MSG_NO = 'Diesen Wert gibt es an dieser Anlage nicht.';

  // ---------- Kernadapter ----------
  function getCore() {
    let c = root.THM_CORE;
    if (!c && typeof require === 'function') { try { c = require('./thmcore.js'); } catch (e) { c = null; } }
    if (!c || typeof c.chain !== 'function' || typeof c.steady !== 'function' || typeof c.thermal !== 'function') throw new Error('THM_CORE (thmcore.js) ist nicht geladen.');
    return c;
  }
  const nk = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  // erster endlicher Zahlenwert unter den Feldnamen (Gross-/Kleinschreibung und Trennzeichen egal)
  function pick(o, names, d) {
    if (!o || typeof o !== 'object') return d;
    for (let i = 0; i < names.length; i++) if (fin(o[names[i]])) return o[names[i]];
    const m = {}; Object.keys(o).forEach(k => { m[nk(k)] = o[k]; });
    for (let i = 0; i < names.length; i++) { const v = m[nk(names[i])]; if (fin(v)) return v; }
    return d;
  }
  function fmtWith(CORE) {
    return (v, d) => {
      if (!fin(v)) return '–';
      try { const s = CORE.fmt(v, d == null ? 1 : d); if (typeof s === 'string') return s; } catch (e) { /* lokales Format */ }
      return v.toFixed(d == null ? 1 : d).replace('.', ',');
    };
  }
  // Kette normalisieren: frei = Reihe JC + (Gehaeuse-Umgebung), dann ist rthK der Gehaeuse-Umgebungs-Wert und rthCK 0
  function normChain(r) {
    if (!r || r.ok === false) return null;
    const mode = r.mode === 'frei' ? 'frei' : 'kk';
    const jc = Math.max(0, pick(r, ['rthJC', 'rth_jc'], 0));
    let ck = Math.max(0, pick(r, ['rthCK', 'rth_ck'], 0)), k = pick(r, ['rthK', 'rth_k'], NaN);
    let tot = pick(r, ['rthTotal', 'rthGes', 'rth_ges'], NaN);
    if (mode === 'frei') { ck = 0; if (fin(tot)) k = tot - jc; }
    else if (!fin(tot) && fin(k)) tot = jc + ck + k;
    if (!fin(k) && fin(tot)) k = tot - jc - ck;
    if (!fin(tot) || !fin(k) || tot <= 0) return null;
    const cth = r.cth && typeof r.cth === 'object' ? { j: pick(r.cth, ['j'], 0), c: pick(r.cth, ['c'], 0), k: pick(r.cth, ['k'], 0) } : { j: 0, c: 0, k: 0 };
    const faults = Array.isArray(r.faults) ? r.faults.map(f => typeof f === 'string' ? f : (f && f.id)).filter(x => typeof x === 'string') : [];
    return { ok: true, mode, rthJC: jc, rthCK: ck, rthK: k, rthTotal: tot, cth, faults, notes: Array.isArray(r.notes) ? r.notes.slice() : [] };
  }
  // Zustand des Waermenetzes lesen: Objekt { tj, tc, tk } (oder j, c, k) oder Feld [tj, tc, tk]
  function stateReader(st) {
    if (Array.isArray(st)) return (s) => [s[0], s[1] == null ? s[0] : s[1], s[2] == null ? (s[1] == null ? s[0] : s[1]) : s[2]];
    const ks = st && typeof st === 'object' ? Object.keys(st) : [];
    const find = (names) => { for (const n of names) { const k = ks.find(q => nk(q) === n); if (k) return k; } return null; };
    const kj = find(['tj', 'j']), kc = find(['tc', 'c']), kk = find(['tk', 'k']);
    if (!kj) return null;
    return (s) => { const a = s[kj], b = kc ? s[kc] : a, c = kk ? s[kk] : b; return [a, fin(b) ? b : a, fin(c) ? c : (fin(b) ? b : a)]; };
  }
  function normSteady(r, ch, p, ta) {   // Temperaturen aus dem Kern; fehlen sie, aus der Kette (Reihenschaltung)
    const kk = ch.mode === 'kk';
    let tj = pick(r, ['tj'], NaN), tc = pick(r, ['tc'], NaN), tk = pick(r, ['tk'], NaN);
    if (!fin(tj) || !fin(tc) || (kk && !fin(tk))) { tk = ta + p * (kk ? ch.rthK : 0); tc = ta + p * (ch.rthK + ch.rthCK); tj = tc + p * ch.rthJC; }
    if (!kk) tk = tc;
    return { tj, tc, tk, dJC: tj - tc, dCK: tc - tk, dK: tk - ta };
  }

  // Wert fuer ein Bedienelement pruefen und umrechnen: { ok, v }
  function coerce(def, value) {
    if (!def) return { ok: false };
    if (def.type === 'switch') {
      if (typeof value === 'boolean') return { ok: true, v: value };
      if (value === 1 || value === 0) return { ok: true, v: value === 1 };
      if (value === 'true' || value === 'false') return { ok: true, v: value === 'true' };
      return { ok: false };
    }
    if (def.type === 'slider') {
      if (typeof value === 'boolean') return { ok: false };
      const n = num(value, NaN);
      return fin(n) ? { ok: true, v: clamp(n, def.min, def.max) } : { ok: false };
    }
    if (def.type === 'select') {
      if (value !== null && typeof value === 'object') return { ok: false };
      let o = def.options.find(q => q.value === value || String(q.value) === String(value));
      if (!o && (typeof value === 'string' || typeof value === 'number')) { const n = num(value, NaN); if (fin(n)) o = def.options.find(q => typeof q.value === 'number' && Math.abs(q.value - n) <= 1e-3 * Math.max(1, Math.abs(q.value))); }
      return o ? { ok: true, v: o.value } : { ok: false };
    }
    return { ok: false };
  }

  // Ringspeicher fuer den Messschreiber
  function makeTrace(cap, keys) {
    const T = new Float64Array(cap), A = {};
    keys.forEach(k => { A[k] = new Float64Array(cap); });
    let n = 0, head = 0;
    return {
      push(t, v) { T[head] = t; for (let i = 0; i < keys.length; i++) A[keys[i]][head] = v[keys[i]]; head = (head + 1) % cap; if (n < cap) n++; },
      clear() { n = 0; head = 0; },
      get(t0, maxPts, live) {
        const idx = [];
        for (let i = 0; i < n; i++) { const j = (head - n + i + 2 * cap) % cap; if (T[j] >= t0) idx.push(j); }
        const stride = idx.length > maxPts ? Math.ceil(idx.length / maxPts) : 1;
        const out = { t: [] }; keys.forEach(k => { out[k] = []; });
        const take = (j, v) => { out.t.push(v ? v.t : T[j]); keys.forEach(k => out[k].push(v ? v[k] : A[k][j])); };
        for (let i = 0; i < idx.length; i += stride) take(idx[i]);
        if (idx.length && (idx.length - 1) % stride !== 0) take(idx[idx.length - 1]);
        if (live && live.t > (idx.length ? T[idx[idx.length - 1]] : -Infinity) && live.t >= t0) take(0, live);
        return out;
      }
    };
  }
  // Meldungsliste; Schaltklicks (quiet) werden zuerst verworfen, wenn die Liste voll ist
  function makeEvents(max) {
    const list = [];
    return {
      list,
      add(t, text, kind, fx, x, y, quiet, id) {
        const e = { t: Math.round(t * 10) / 10, text, kind: kind || 'info' };
        if (id) e.id = id;
        if (fx) { e.fx = fx; e.x = x == null ? 330 : x; e.y = y == null ? 250 : y; }
        if (quiet) e.quiet = true;
        list.push(e);
        while (list.length > max) { const q = list.findIndex(v => v.quiet); list.splice(q >= 0 ? q : 0, 1); }
      },
      clear() { list.length = 0; }
    };
  }

  // ---------- Falschfarben (perzeptuell geordnet: dunkelblau, violett, rot, orange, gelb, weiss; keine Regenbogenpalette) ----------
  const HEAT = [[0, [34, 52, 138]], [0.18, [98, 58, 178]], [0.38, [188, 52, 138]], [0.58, [232, 78, 54]], [0.78, [250, 156, 28]], [0.92, [250, 226, 90]], [1, [255, 255, 236]]];
  const HEAT_LUT = (function () {
    const out = [];
    for (let i = 0; i < 256; i++) {
      const f = i / 255; let k = 1; while (k < HEAT.length - 1 && HEAT[k][0] < f) k++;
      const a = HEAT[k - 1], b = HEAT[k], u = (f - a[0]) / (b[0] - a[0] || 1);
      out.push([Math.round(a[1][0] + (b[1][0] - a[1][0]) * u), Math.round(a[1][1] + (b[1][1] - a[1][1]) * u), Math.round(a[1][2] + (b[1][2] - a[1][2]) * u)]);
    }
    return out;
  })();
  const HEAT_STR = HEAT_LUT.map(c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
  const heatIdx = (T, lo, hi) => { const f = (T - lo) / ((hi - lo) || 1); return fin(f) ? Math.round(clamp(f, 0, 1) * 255) : 0; };
  const heat = (T, lo, hi) => HEAT_STR[heatIdx(T, lo, hi)];
  const heatA = (T, lo, hi, a) => { const c = HEAT_LUT[heatIdx(T, lo, hi)]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : Math.round(a * 1000) / 1000) + ')'; };
  const heatLum = (T, lo, hi) => { const c = HEAT_LUT[heatIdx(T, lo, hi)]; return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
  const onHeat = (T, lo, hi) => heatLum(T, lo, hi) > 0.55 ? '#10151a' : '#ffffff';   // lesbare Schrift auf Falschfarbe

  // ---------- Zeichenbausteine (lokal, damit jede Datei auch allein zeichnet) ----------
  let FZ_MIN = 0;   // kleinste Schrift in Weltmass (Hochformat: Bild wird auf 390 px Breite verkleinert)
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, col, align, weight) {
    ctx.font = (weight || '600') + ' ' + Math.max(size, FZ_MIN) + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  const tw = (s, size, weight) => String(s).length * Math.max(size, FZ_MIN) * (weight && +weight >= 800 ? 0.6 : 0.56);   // grobe Textbreite (kein measureText: Mock-tauglich)
  function glow(ctx, x, y, r, rgb, a) {
    if (!(a > 0.004) || !(r > 0.5)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + Math.min(1, a) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, col, lw, head) {
    const a = Math.atan2(y1 - y0, x1 - x0), hd = head || 9;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw || 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hd * 0.6, y1 - Math.sin(a) * hd * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * hd, y1 - Math.sin(a - 0.45) * hd); ctx.lineTo(x1 - Math.cos(a + 0.45) * hd, y1 - Math.sin(a + 0.45) * hd); ctx.closePath(); ctx.fill();
  }
  // Waermefluss-Pfeil (SPEC 5.7 Punkt 3): Breite 3 + 2,2 * wurzel(P) px (begrenzt), Strichelung wandert mit dem Fluss (Geschwindigkeit ~ P)
  function flowArrow(ctx, x0, y0, x1, y1, P, t, alpha, reduced, col) {
    const w = clamp(3 + 2.2 * Math.sqrt(Math.max(0, P)), 3, 15), L = Math.hypot(x1 - x0, y1 - y0);
    if (!(L > 2)) return w;
    const hd = Math.min(w * 1.7 + 4, L * 0.7), ux = (x1 - x0) / L, uy = (y1 - y0) / L, bx = x1 - ux * hd, by = y1 - uy * hd;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0.25, 1); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(10,14,18,0.7)'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = col || '#ffffff'; ctx.lineWidth = w; ctx.setLineDash([w * 1.6 + 4, w * 1.1 + 3]);
    ctx.lineDashOffset = reduced ? 0 : -((t || 0) / 1000) * (24 + 16 * Math.sqrt(Math.max(0, P)));
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx + ux * 2, by + uy * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(10,14,18,0.7)'; ctx.beginPath(); ctx.moveTo(x1 + ux * 2, y1 + uy * 2); ctx.lineTo(bx - uy * (w * 0.9 + 3), by + ux * (w * 0.9 + 3)); ctx.lineTo(bx + uy * (w * 0.9 + 3), by - ux * (w * 0.9 + 3)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col || '#ffffff'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx - uy * w * 0.9, by + ux * w * 0.9); ctx.lineTo(bx + uy * w * 0.9, by - ux * w * 0.9); ctx.closePath(); ctx.fill();
    ctx.restore();
    return w;
  }
  // Badge mit Text (Rahmen in Falschfarbe), Rueckgabe Breite
  function badge(ctx, x, y, s, size, edge, fill) {
    const w = tw(s, size, '700') + 12, h = Math.max(size, FZ_MIN) + 8;
    rr(ctx, x, y, w, h, 5); ctx.fillStyle = fill || COL.badge; ctx.fill(); ctx.strokeStyle = edge || COL.line; ctx.lineWidth = 1.6; ctx.stroke();
    txt(ctx, s, x + 6, y + h / 2 + 0.5, size, COL.text, 'left', '700');
    return w;
  }
  function panel(ctx, x, y, w, h, r) { rr(ctx, x, y, w, h, r == null ? 12 : r); ctx.fillStyle = COL.panel; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5; ctx.stroke(); }
  // Symbole: THM_CORE.sym(key, satz) (einzige Quelle), sonst Datenblattschreibweise
  const SYM_FB = { db: { Tj: 'Tj', Tc: 'Tc', Tk: 'Tk', Ta: 'Ta', Tjmax: 'Tj,max', Rth_JC: 'Rth_JC', Rth_CK: 'Rth_CK', Rth_K: 'Rth_K', Rth_JA: 'Rth_JA', Rth_CA: 'Rth_CA', P: 'P_V' },
                   de: { Tj: 'ϑj', Tc: 'ϑG', Tk: 'ϑK', Ta: 'ϑU', Tjmax: 'ϑj,max', Rth_JC: 'R_thJG', Rth_CK: 'R_thGK', Rth_K: 'R_thKU', Rth_JA: 'R_thJU', Rth_CA: 'R_thGU', P: 'P_V' } };
  function symOf(CORE, key, set) {
    set = set === 'de' ? 'de' : 'db';
    { try { if (CORE && typeof CORE.sym === 'function') { const s = CORE.sym(key, set); if (typeof s === 'string' && s && s !== 'undefined' && s !== key.toLowerCase()) return s; } } catch (e) { /* Rueckfall */ } }
    return SYM_FB[set][key] || key;
  }
  // Standardrahmen: Weltmass W x H zentriert und skaliert; 0 bei unbrauchbarer Flaeche (dann wird nichts gezeichnet)
  function frame(ctx, w, h, W, H) {
    if (!fin(w) || !fin(h) || w <= 0 || h <= 0) return 0;
    const s = Math.min(w / W, h / H);
    ctx.save();   // der Hintergrund gehoert der Seite (Zeichenflaeche wird vom Aufrufer geloescht und gefuellt)
    ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
    return s;
  }
  function toWorld(px, py, w, h, W, H) {
    if (!fin(px) || !fin(py) || !fin(w) || !fin(h) || w <= 0 || h <= 0) return null;
    const s = Math.min(w / W, h / H);
    return { x: (px - (w - W * s) / 2) / s, y: (py - (h - H * s) / 2) / s };
  }
  // Teilchen (Konvektion, Rauch): Position nur aus Zeit und Index (kein Zustand, keine Allokation je Frame ausser Gradients)
  function plumes(ctx, x0, x1, yBase, hRise, P, t, tAir, lo, hi, opt) {
    const n = Math.min(70, Math.round(8 + 14 * Math.sqrt(Math.max(0, P))));
    if (opt.reduced) return n;
    const v = (26 + 34 * Math.sqrt(Math.max(0, P))) * (opt.speed || 1), bend = opt.bend || 0;
    for (let i = 0; i < n; i++) {
      const hx = hash(i + 1), ph = ((t / 1000) * v / hRise + hash(i + 200)) % 1, rise = ph * hRise;
      const x = x0 + hx * (x1 - x0) + Math.sin(rise / 16 + i * 1.7) * 5 + rise * bend, y = yBase - rise;
      const a = (1 - ph) * (opt.alpha == null ? 0.55 : opt.alpha) * Math.min(1, ph * 6);
      ctx.fillStyle = heatA(tAir + (1 - ph) * (opt.tHot - tAir), lo, hi, a); ctx.beginPath(); ctx.arc(x, y, 2 + 3.2 * (1 - ph) + hash(i + 50) * 1.6, 0, TAU); ctx.fill();
    }
    return n;
  }
  function smokePuffs(ctx, x, y, t, k, reduced) {
    const n = reduced ? 0 : Math.round(8 + 50 * clamp(k, 0, 1));
    for (let i = 0; i < n; i++) {
      const ph = ((t / 1800) + hash(i + 7)) % 1, yy = y - ph * (60 + 80 * k), xx = x + Math.sin(ph * 6 + i) * (6 + 22 * ph) + (hash(i + 31) - 0.5) * 18;
      ctx.fillStyle = 'rgba(190,196,204,' + (0.5 * (1 - ph) * Math.min(1, ph * 8)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(xx, yy, 5 + ph * 16, 0, TAU); ctx.fill();
    }
    return n;
  }
  function flame(ctx, x, y, t, s) {
    for (let i = 0; i < 3; i++) {
      const fl = 1 + 0.25 * Math.sin(t / 90 + i * 2), hh = (34 + i * -8) * s * fl;
      const g = ctx.createLinearGradient(x, y, x, y - hh); g.addColorStop(0, 'rgba(255,200,60,0.95)'); g.addColorStop(1, 'rgba(255,70,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 11 * s + (i - 1) * 9 * s, y); ctx.quadraticCurveTo(x + (i - 1) * 9 * s, y - hh * 0.6, x + (i - 1) * 7 * s, y - hh); ctx.quadraticCurveTo(x + 11 * s + (i - 1) * 9 * s, y - hh * 0.4, x + 11 * s + (i - 1) * 9 * s, y); ctx.closePath(); ctx.fill();
    }
  }
  function sparks(ctx, x, y, t, reduced) {
    const n = reduced ? 5 : 12;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ph = ((t / 420) + hash(i + 3)) % 1, a = hash(i + 90) * TAU, r = ph * 26 + 4;
      ctx.strokeStyle = 'rgba(255,' + Math.round(210 - 90 * ph) + ',90,' + (1 - ph).toFixed(3) + ')'; ctx.lineWidth = 2.4 * (1 - ph) + 0.6;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)); ctx.stroke();
    }
  }
  // Effekte: bevorzugt THM_DRAW (WP1b), sonst die lokalen Fassungen oben
  function fxSmoke(ctx, x, y, t, k, reduced) { const D = root.THM_DRAW; if (D && typeof D.rauch === 'function') { try { D.rauch(ctx, x, y, { t, intensity: k, reduced }); return; } catch (e) { /* lokal */ } } smokePuffs(ctx, x, y, t, k, reduced); }
  function fxSparks(ctx, x, y, t, reduced) { const D = root.THM_DRAW; if (D && typeof D.funken === 'function') { try { D.funken(ctx, x, y, { t, reduced }); return; } catch (e) { /* lokal */ } } sparks(ctx, x, y, t, reduced); }
  function fanWheel(ctx, x, y, r, rot, factorText) {
    const D = root.THM_DRAW;
    if (D && typeof D.luefter === 'function') { try { D.luefter(ctx, x, y, { rot, size: r * 2 }); if (factorText) txt(ctx, factorText, x, y + r + 12, 12, COL.text, 'center', '700'); return; } catch (e) { /* lokal */ } }
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.fillStyle = '#252e38'; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.fillStyle = 'rgba(150,170,190,0.9)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.55, -r * 0.55, r * 0.95, -r * 0.1); ctx.quadraticCurveTo(r * 0.55, r * 0.1, 0, 0); ctx.fill(); }
    ctx.restore(); ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fillStyle = '#c3ced8'; ctx.fill();
    if (factorText) txt(ctx, factorText, x, y + r + 12, 12, COL.text, 'center', '700');
  }

  // ===== Gemeinsamer Block 2/3: die vier Ansichten (Schnittbild, Waermebild, Ersatzschaltbild, Balken) und Bedienelemente im Bild =====
  // Jede Ansicht bevorzugt THM_DRAW (WP1b) mit dem Datenobjekt D (rig.drawData()); fehlt THM_DRAW oder die Funktion, zeichnen die lokalen Fassungen unten.
  // Alle Zahlen im Bild stehen zusaetzlich in den Messgeraeten (Zellen unter dem Bild).
  const HS_VIS = { fahne: { n: 0, len: 0.12, plate: true, bw: 6 }, s: { n: 4, len: 0.38 }, m: { n: 6, len: 0.58 }, l: { n: 8, len: 0.8 }, xl: { n: 10, len: 1 }, blech: { n: 0, len: 0.1, plate: true, bw: 8, tall: true } };
  const ML = 1.6;   // m·L der Rippe nur fuer die Veranschaulichung des Rippenverlaufs (kein Rechenwert)
  const finT = (u, ta, tk) => ta + (tk - ta) * Math.cosh(ML * (1 - u)) / Math.cosh(ML);   // u = 0 Fuss, 1 Spitze
  const fz = (n) => Math.max(n, FZ_MIN);

  // ---------- Schnittbild ----------
  function vSchnitt(ctx, R, D) {
    const w = R.w, h = R.h, t = D.t, lo = D.lo, hi = D.hi, ta = D.ta;
    ctx.save(); ctx.translate(R.x, R.y);
    panel(ctx, 0, 0, w, h, 12); rr(ctx, 1, 1, w - 2, h - 2, 11); ctx.clip();
    const bh = fz(12) + 8, rowH = bh + 3, hCards = 2 * fz(13) + 24, hLeg = fz(12) * 2 + 38;
    const kk = D.mode === 'kk', hs = HS_VIS[D.mount.heatsink] || null;
    const body = D.shape;   // 'to220' | 'to126' | 'axial' | 'zement' | 'alu' | 'led'
    // Luftgrund: leicht warm um die Teile
    let fanZone = kk && D.mount.fan !== 'aus' ? 54 : 6;
    const x0 = 12;
    // Bauteil
    const bodyW = clamp((w - 24) * (body === 'axial' ? 0.2 : 0.16), 52, 112), tabW = kk ? 9 : 8;
    const xBody = kk ? x0 + 6 : Math.max(x0 + 6, w * 0.16);
    const xTab = xBody + bodyW, xDie = xTab - 22;
    // Uebergang und Kuehlkoerper
    const pasteW = !kk ? 0 : D.mount.paste === 'dick' ? 8 : D.mount.paste === 'duenn' ? 3.5 : 3;
    const isoW = !kk || D.mount.joint === 'direkt' ? 0 : 12;
    const baseW = kk && hs ? (hs.bw || clamp((w - 24) * 0.09, 24, 46)) : 0;
    const xPaste = xTab + tabW, xIso = xPaste + pasteW, xBase = xIso + isoW, xFin = xBase + baseW;
    const finZone = Math.max(30, w - 12 - fanZone - xFin);
    const finLen = kk && hs ? Math.max(hs.plate ? 14 : 24, finZone * hs.len) : 0, xTip = xFin + finLen;
    // Temperatur-Badges: Zeilen vorab bestimmen (nur x-Lage), damit das Bild unter den benutzten Zeilen beginnt
    const items = [{ x: xDie + 7, s: D.sym.tj + ' ' + D.f(D.tj, 1) + ' °C', T: D.tj }, { x: xTab + tabW / 2, s: D.sym.tc + ' ' + D.f(D.tc, 1) + ' °C', T: D.tc }];
    if (kk) items.push({ x: xBase + baseW / 2, s: D.sym.tk + ' ' + D.f(D.tk, 1) + ' °C', T: D.tk });
    items.push({ x: kk && finLen > 0 ? xTip : Math.min(w - 70, xTab + 100), s: D.sym.ta + ' ' + D.f(ta, 0) + ' °C', T: ta });
    items.sort((a, b) => a.x - b.x);
    const rowsT = [[], [], []]; let rowsUsed = 1;
    items.forEach(it => {
      const bw = tw(it.s, 12, '700') + 12; it.bw = bw; it.l = clamp(it.x - bw / 2, 6, w - bw - 6);
      let r = 0; while (r < 2 && rowsT[r].some(o => it.l < o.l + o.bw + 4 && it.l + bw + 4 > o.l)) r++;
      it.r = r; rowsT[r].push(it); if (r + 1 > rowsUsed) rowsUsed = r + 1;
    });
    const hTop = rowsUsed * rowH + 10;
    const picTop = hTop + 2, picBot = h - hCards - hLeg - 8, picH = Math.max(60, picBot - picTop), mid = picTop + picH / 2;
    const caseH = clamp(picH * (body === 'axial' ? 0.36 : 0.58), 40, 130);
    const yBodyTop = mid - caseH / 2 + 8, tabTop = yBodyTop - 22, tabBot = yBodyTop + caseH;
    const baseH = kk ? clamp(picH * (hs && hs.tall ? 1 : 0.94), (tabBot - tabTop) + 16, picH) : 0;
    const baseTop = mid - baseH / 2, baseBot = mid + baseH / 2;
    const tTip = kk ? finT(1, ta, D.tk) : ta;
    const tAt = (x) => {   // Temperatur laengs der Kette (nur fuer Isothermen)
      if (x <= xTab + tabW) return D.tj + (D.tc - D.tj) * clamp((x - xDie) / ((xTab + tabW) - xDie), 0, 1);
      if (!kk) return ta;
      if (x <= xBase) return D.tc + (D.tk - D.tc) * clamp((x - (xTab + tabW)) / ((xBase - (xTab + tabW)) || 1), 0, 1);
      if (x <= xFin) return D.tk;
      return finT(clamp((x - xFin) / (finLen || 1), 0, 1), ta, D.tk);
    };
    // 1 Luft: warmer Hof um Rippen bzw. Gehaeuse
    if (kk && finLen > 0) {
      const g = ctx.createLinearGradient(xFin, 0, xTip + 24, 0);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, heatA(finT(i / 4, ta, D.tk), lo, hi, 0.32 * (1 - i / 5)));
      ctx.fillStyle = g; rr(ctx, xFin, picTop, finLen + 24, picH, 8); ctx.fill();
    } else if (!kk) {
      glow(ctx, xTab, mid, Math.min(w * 0.4, 200), HEAT_LUT[heatIdx(D.tc, lo, hi)].join(','), 0.38);
    }
    // 2 Rippen / Grundplatte / Blech
    if (kk && hs) {
      const g = ctx.createLinearGradient(xFin, 0, Math.max(xTip, xFin + 4), 0);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, heat(finT(i / 4, ta, D.tk), lo, hi));
      ctx.fillStyle = heat(D.tk, lo, hi); rr(ctx, xBase, baseTop, baseW, baseH, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.4; ctx.stroke();
      if (hs.n > 0) {
        const th = 5, gap = (baseH - 12 - hs.n * th) / (hs.n - 1 || 1);
        ctx.fillStyle = g;
        for (let i = 0; i < hs.n; i++) { const fy = baseTop + 6 + i * (th + gap); ctx.fillRect(xFin, fy, finLen, th); }
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        for (let i = 0; i < hs.n; i++) { const fy = baseTop + 6 + i * (th + gap); ctx.strokeRect(xFin, fy, finLen, th); }
      } else if (finLen > 0) { ctx.fillStyle = g; ctx.fillRect(xFin, baseTop + 2, finLen, baseH - 4); }
    }
    // 3 Konvektion (Teilchen, Raumtemperatur bis Rippenfuss)
    let nPart = 0;
    const pAir = Math.max(0, D.p);
    if (kk && hs) {
      const px0 = xFin + 4, px1 = hs.n > 0 ? xTip : xFin + Math.max(30, finLen + 30);
      nPart = plumes(ctx, px0, px1, baseBot, baseBot - picTop - 4, pAir, t, ta, lo, hi, { reduced: D.reduced, tHot: D.tk, bend: D.mount.orient === 'waagrecht' ? 0.55 : 0, speed: (D.mount.orient === 'waagrecht' ? 0.6 : 1) * (D.mount.fan === 'aus' ? 1 : 1.5) });
    } else if (!kk) {
      nPart = plumes(ctx, xBody, xTab + 30, yBodyTop, yBodyTop - picTop - 4, pAir, t, ta, lo, hi, { reduced: D.reduced, tHot: D.tc, bend: 0 });
    }
    // 4 Gehaeuse (Kunststoff, Fahne), Chip
    {
      const gb = ctx.createLinearGradient(xBody, 0, xTab, 0);
      gb.addColorStop(0, heat(ta + (D.tc - ta) * 0.7, lo, hi)); gb.addColorStop(1, heat(D.tc, lo, hi));
      ctx.fillStyle = gb; rr(ctx, xBody, yBodyTop, bodyW, caseH, 6); ctx.fill();
      ctx.strokeStyle = ink(0.4); ctx.lineWidth = 1.6; ctx.stroke();
      // Kunststoff-Muster (Material erkennbar, ohne die Falschfarbe zu verdecken)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(xBody + 6, yBodyTop + caseH * i / 5); ctx.lineTo(xTab - 6, yBodyTop + caseH * i / 5); ctx.stroke(); }
      if (body === 'to220' || body === 'to126' || kk) {
        const gt = ctx.createLinearGradient(xTab, 0, xTab + tabW, 0); gt.addColorStop(0, heat(D.tj, lo, hi)); gt.addColorStop(1, heat(D.tc, lo, hi));
        ctx.fillStyle = gt; ctx.fillRect(xTab, tabTop, tabW, tabBot - tabTop);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4; ctx.strokeRect(xTab, tabTop, tabW, tabBot - tabTop);
      }
      // Chip mit Glühen nach Tj
      const dw = 14, dh = Math.min(46, caseH * 0.5), dy = yBodyTop + caseH / 2 - dh / 2;
      glow(ctx, xDie + dw / 2, dy + dh / 2, 34 + 10 * clamp((D.tj - ta) / 100, 0, 1), HEAT_LUT[heatIdx(D.tj, lo, hi)].join(','), 0.6);
      ctx.fillStyle = heat(D.tj, lo, hi); ctx.fillRect(xDie, dy, dw, dh);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; ctx.strokeRect(xDie, dy, dw, dh);
      // Anschlussbeinchen
      ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xBody + 14, yBodyTop + caseH); ctx.lineTo(xBody + 14, yBodyTop + caseH + 14); ctx.moveTo(xBody + bodyW * 0.5, yBodyTop + caseH); ctx.lineTo(xBody + bodyW * 0.5, yBodyTop + caseH + 14); ctx.stroke();
      if (D.destroyed) { ctx.fillStyle = 'rgba(8,8,8,0.55)'; rr(ctx, xBody, yBodyTop, bodyW, caseH, 6); ctx.fill(); }
    }
    // 5 Paste, Isolierscheibe, Buchse, Schraube
    if (kk) {
      // Paste: glaenzende Schicht; ohne Paste ein Luftspalt (gepunktet)
      const gp = ctx.createLinearGradient(xPaste, 0, xIso || xPaste + pasteW, 0); gp.addColorStop(0, heat(D.tc, lo, hi)); gp.addColorStop(1, heat(D.tc + (D.tk - D.tc) * (isoW > 0 ? 0.35 : 1), lo, hi));
      ctx.fillStyle = gp; ctx.fillRect(xPaste, tabTop, pasteW, tabBot - tabTop);
      if (D.mount.paste === 'keine') { ctx.fillStyle = 'rgba(12,16,20,0.85)'; ctx.fillRect(xPaste + 0.5, tabTop, pasteW - 1, tabBot - tabTop); ctx.fillStyle = 'rgba(190,200,210,0.7)'; for (let yy = tabTop + 4; yy < tabBot; yy += 7) ctx.fillRect(xPaste + pasteW / 2 - 0.8, yy, 1.6, 2.4); }
      else { ctx.strokeStyle = 'rgba(235,242,250,0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(xPaste + 0.8, tabTop); ctx.lineTo(xPaste + 0.8, tabBot); ctx.stroke(); }
      if (isoW > 0) {
        const gi = ctx.createLinearGradient(xIso, 0, xIso + isoW, 0); gi.addColorStop(0, heat(D.tc + (D.tk - D.tc) * 0.4, lo, hi)); gi.addColorStop(1, heat(D.tk, lo, hi));
        ctx.fillStyle = gi; ctx.fillRect(xIso, baseTop + 3, isoW, baseH - 6);
        const sil = D.mount.joint === 'silikon';
        ctx.strokeStyle = sil ? 'rgba(120,175,205,0.95)' : 'rgba(205,165,100,0.95)'; ctx.lineWidth = sil ? 2.2 : 1.2;
        if (sil) { ctx.strokeRect(xIso + 0.5, baseTop + 3, isoW - 1, baseH - 6); ctx.fillStyle = 'rgba(150,200,230,0.55)'; for (let yy = baseTop + 8; yy < baseBot - 6; yy += 9) { ctx.beginPath(); ctx.arc(xIso + isoW / 2, yy, 1.6, 0, TAU); ctx.fill(); } }
        else for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(xIso + isoW * i / 4, baseTop + 3); ctx.lineTo(xIso + isoW * i / 4, baseBot - 3); ctx.stroke(); }
      }
      // Schraube (Kopf links vom Gehaeuse; locker = Spalt) und Buchse
      const sy = tabTop + 11, gap = D.mount.screw === 'locker' ? 7 : 0;
      ctx.fillStyle = '#9aa7b4'; ctx.fillRect(xTab - 14 - gap, sy - 3, xBase + baseW * 0.7 - (xTab - 14 - gap), 6);
      ctx.fillStyle = '#c4ced8'; rr(ctx, xTab - 22 - gap, sy - 9, 8, 18, 2); ctx.fill(); ctx.strokeStyle = '#59636e'; ctx.lineWidth = 1; ctx.stroke();
      if (isoW > 0 && D.mount.bushing) { ctx.fillStyle = 'rgba(244,236,205,0.95)'; ctx.fillRect(xTab, sy - 5, tabW + pasteW + isoW, 2); ctx.fillRect(xTab, sy + 3, tabW + pasteW + isoW, 2); ctx.fillRect(xTab - 1, sy - 6, 2, 12); }
      if (D.short) fxSparks(ctx, xTab + tabW + 1, sy, t, D.reduced);
    }
    // 6 Isothermen (alle 10 K), Zahlen an den Linien
    {
      const x0i = xDie + 7, x1i = kk ? (finLen > 0 ? xTip : xFin) : Math.min(w - 12, xTab + 120), y0i = picTop + 2, y1i = picBot - 2;
      const tTop = Math.max(D.tj, D.tc), tBot = ta;
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      let lastX = -1e9;
      const segs = [];   // (xa, xb, Ta, Tb)
      segs.push([xDie + 7, xTab + tabW, D.tj, D.tc]);
      if (kk) { segs.push([xTab + tabW, xBase, D.tc, D.tk]); if (finLen > 0) for (let i = 0; i < 12; i++) segs.push([xFin + finLen * i / 12, xFin + finLen * (i + 1) / 12, finT(i / 12, ta, D.tk), finT((i + 1) / 12, ta, D.tk)]); }
      const xs = [];
      segs.forEach(sg => {
        const a = sg[2], b = sg[3]; if (Math.abs(a - b) < 1e-9) return;
        const hiT = Math.max(a, b), loT = Math.min(a, b);
        for (let L = Math.ceil(loT / 10) * 10; L <= hiT; L += 10) { if (L <= loT || L >= hiT) continue; const x = sg[0] + (sg[1] - sg[0]) * (a - L) / (a - b); xs.push([x, L]); }
      });
      if (!kk) { // freistehend: Halbkreise um das Gehaeuse
        const rBase = 34;
        for (let L = Math.ceil(ta / 10) * 10; L < D.tc; L += 10) { if (L <= ta + 1) continue; const r = rBase + 52 * Math.log(Math.max(1.0001, (D.tc - ta) / (L - ta))); if (xTab + r > x1i || r > picH) continue; ctx.beginPath(); ctx.arc(xTab, mid, r, -1.1, 1.1); ctx.stroke(); xs.push([xTab + r, L, 'arc']); }
      }
      xs.sort((a, b) => a[0] - b[0]);
      xs.forEach(q => { if (q[2] !== 'arc') { ctx.beginPath(); ctx.moveTo(q[0], y0i); ctx.lineTo(q[0], y1i); ctx.stroke(); } });
      ctx.setLineDash([]);
      xs.forEach(q => {
        if (q[0] - lastX < 34) return; lastX = q[0];
        const s = Math.round(q[1]) + ' °C', ty = q[2] === 'arc' ? mid - 4 : y1i - 7;
        rr(ctx, q[0] - tw(s, 11) / 2 - 3, ty - 8, tw(s, 11) + 6, 15, 4); ctx.fillStyle = 'rgba(10,14,18,0.72)'; ctx.fill();
        txt(ctx, s, q[0], ty, 11, '#ffffff', 'center', '700');
      });
      ctx.restore();
      void tTop; void tBot; void y0i;
    }
    // 7 Waermefluss-Pfeile (Staerke nach P, laufende Striche, blasser beim Aufheizen)
    {
      const alpha = 0.3 + 0.7 * D.steadyFrac, ay = mid;
      const wA = flowArrow(ctx, xBody + 8, ay, xTab + tabW + 2, ay, D.p, t, alpha, D.reduced, '#ffffff');
      if (kk) {
        flowArrow(ctx, xTab + tabW + 1, ay, Math.max(xBase + baseW * 0.5, xTab + tabW + 22), ay, D.p, t, alpha, D.reduced, '#ffffff');
        if (finLen > 6) flowArrow(ctx, xFin + 2, ay, xTip - 2, ay, D.p, t, alpha, D.reduced, '#ffffff');
      } else flowArrow(ctx, xTab + tabW + 2, ay - caseH * 0.15, Math.min(w - 20, xTab + tabW + 110), ay - caseH * 0.15, D.p, t, alpha, D.reduced, '#ffffff');
      void wA;
      const pl = 'P = ' + D.f(D.p, 1) + ' W';
      badge(ctx, clamp(xBody + 4, 6, w - tw(pl, 12) - 20), yBodyTop + caseH + 18 > picBot - 20 ? picTop + 4 : yBodyTop + caseH + 18, pl, 12, '#ffffff');
    }
    // 8 Luefter
    if (kk && D.mount.fan !== 'aus') {
      const fx0 = w - 12 - fanZone / 2, fy0 = mid, rps = D.mount.fan === 'leise' ? 1.2 : D.mount.fan === 'mittel' ? 2.2 : 3.4;
      fanWheel(ctx, fx0, fy0, 21, D.reduced ? 0.5 : (t / 1000) * rps * TAU, '× ' + D.f(D.fanFactor, 2).replace(',00', ',0'));
      for (let i = -1; i <= 1; i++) { ctx.save(); ctx.globalAlpha = 0.8; arrow(ctx, fx0 - 26, fy0 + i * 28, Math.max(xFin + 8, fx0 - 26 - Math.min(finLen, 50)), fy0 + i * 28, 'rgba(160,215,255,0.9)', 2.2, 7); ctx.restore(); }
    }
    // 9 Rauch, Flamme (Defekt)
    if (D.smoke > 0 && !D.destroyed) fxSmoke(ctx, xBody + bodyW * 0.45, tabTop - 4, t, D.smoke, D.reduced);
    if (D.destroyed) { flame(ctx, xBody + bodyW * 0.5, yBodyTop + 6, t, 1); fxSmoke(ctx, xBody + bodyW * 0.5, tabTop - 4, t, 0.9, D.reduced); }
    // 10 Temperatur-Badges (mit Fuehrungslinien) in bis zu drei Zeilen
    {
      const ys = [yBodyTop + 6, tabTop, kk ? baseTop : mid, kk ? baseTop + 6 : mid];
      items.forEach(it => { it.y = it.s.indexOf(D.sym.tj) === 0 ? ys[0] : it.s.indexOf(D.sym.tc) === 0 ? ys[1] : it.s.indexOf(D.sym.tk) === 0 ? ys[2] : ys[3]; });
      items.forEach(it => { const yb = 4 + it.r * rowH + bh, ye = Math.max(it.y, yb + 2); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(it.x, yb); ctx.lineTo(it.x, ye); ctx.stroke(); ctx.beginPath(); ctx.arc(it.x, ye, 2.6, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); });
      items.forEach(it => { badge(ctx, it.l, 4 + it.r * rowH, it.s, 12, heat(it.T, lo, hi)); });
    }
    // 11 Klammern der Glieder und Beschriftung der Teile
    {
      const by = picBot + 8, bars = [['jc', xDie + 7, xTab + tabW], kk ? ['ck', xTab + tabW, xBase] : null, ['k', kk ? xBase : xTab + tabW, kk ? (finLen > 0 ? xTip : xFin) : Math.min(w - 12, xTab + 120)]].filter(Boolean);
      bars.forEach(b => { ctx.strokeStyle = MEMBER_COL[b[0]]; ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(b[1] + 1, by); ctx.lineTo(Math.max(b[2], b[1] + 6) - 1, by); ctx.stroke(); });
      txt(ctx, kk ? 'Gehäuse mit Chip' : D.shapeName, clamp(xBody + bodyW / 2, 6 + tw('Gehäuse mit Chip', 12) / 2, w - 20), by + 15, 12, COL.dim, 'center', '600');
      if (kk) txt(ctx, hs && hs.plate ? (D.mount.heatsink === 'blech' ? 'Kühlblech' : 'Fahne') : 'Kühlkörper', clamp((xBase + (finLen > 0 ? xTip : xFin)) / 2, 40, w - 40), by + 15, 12, COL.dim, 'center', '600');
    }
    // 12 Farbskala (Ta bis Tj,max + 30 K) mit Zahlen und Marke Tj,max
    {
      const lx = 14, lw = w - 28, ly = picBot + 8 + fz(12) + 26;
      const g = ctx.createLinearGradient(lx, 0, lx + lw, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, HEAT_STR[Math.round(i / 8 * 255)]);
      ctx.fillStyle = g; rr(ctx, lx, ly, lw, 10, 4); ctx.fill(); ctx.strokeStyle = ink(0.4); ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, x = lx + lw * i / 4; txt(ctx, Math.round(v) + (i === 4 ? ' °C' : ''), clamp(x, lx + 10, lx + lw - (i === 4 ? 16 : 6)), ly + 22, 12, COL.dim, i === 0 ? 'left' : i === 4 ? 'right' : 'center', '600'); }
      const mx = lx + lw * clamp((D.tjMax - lo) / ((hi - lo) || 1), 0, 1);
      ctx.fillStyle = COL.bad; ctx.beginPath(); ctx.moveTo(mx, ly - 1); ctx.lineTo(mx - 5, ly - 8); ctx.lineTo(mx + 5, ly - 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COL.bad; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(mx, ly - 1); ctx.lineTo(mx, ly + 12); ctx.stroke();
    }
    // 13 Karten der Glieder: Wärmewiderstand und Temperaturabfall
    {
      const cw = (w - 24 - 12) / 3, cy = h - hCards + 4, chh = hCards - 10;
      const cards = [['jc', D.sym.rthJC, D.rthJC, D.dJC, 'Chip → Gehäuse'], kk ? ['ck', D.sym.rthCK, D.rthCK, D.dCK, 'Paste, Scheibe'] : ['ck', D.sym.rthCK, 0, 0, 'entfällt (freistehend)'], ['k', kk ? D.sym.rthK : D.sym.rthCA, D.rthK, D.dK, kk ? 'Kühlkörper → Luft' : 'Gehäuse → Luft']];
      cards.forEach((c, i) => {
        const cx = 12 + i * (cw + 6);
        rr(ctx, cx, cy, cw, chh, 8); ctx.fillStyle = ink(0.05); ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = MEMBER_COL[c[0]]; rr(ctx, cx, cy, 5, chh, 3); ctx.fill();
        const off = !(c[2] > 0) && !(c[0] !== 'ck' || kk);
        txt(ctx, off ? c[1] : c[1] + ' ' + D.f(c[2], 2).replace(/,?0+$/, '').replace(/^$/, '0') + ' K/W', cx + 12, cy + chh * 0.3, 13, off ? COL.dim : COL.text, 'left', '800');
        const l2 = off ? c[4] : 'ΔT ' + D.f(c[3], 1) + ' K  ·  ' + c[4], l2s = off ? c[4] : 'ΔT ' + D.f(c[3], 1) + ' K';
        txt(ctx, tw(l2, 12) + 18 <= cw ? l2 : l2s, cx + 12, cy + chh * 0.72, 12, COL.dim, 'left', '600');
      });
    }
    ctx.restore();
    return nPart;
  }

  // ---------- Waermebild (Falschfarben-Kamera, Draufsicht) ----------
  function camLayout(D, w, h) {
    const legW = 74, bx = 18, by = 20, bw = w - bx - legW, bh = h - by - 54, kk = D.mode === 'kk';
    const dev = { cx: 0, cy: 0, w: 40, h: 46 };
    const sh = D.shape;
    if (sh === 'axial') { dev.w = 58; dev.h = 20; } else if (sh === 'zement') { dev.w = 76; dev.h = 28; } else if (sh === 'alu') { dev.w = 78; dev.h = 46; } else if (sh === 'led') { dev.w = 62; dev.h = 62; }
    const hsR = kk ? { x: bx + bw * 0.5, y: by + bh * 0.12, w: bw * 0.4, h: bh * 0.76 } : null;
    dev.cx = kk ? hsR.x - dev.w / 2 - 2 : bx + bw * 0.34; dev.cy = kk ? hsR.y + hsR.h * 0.5 : by + bh * 0.48;
    return { legW, bx, by, bw, bh, dev, hs: hsR, kk };
  }
  function camField(D, L, x, y) {   // Temperatur an der Stelle (x, y) im Bild: dieselbe Funktion fuer Farbe und Fadenkreuz
    const dTc = Math.max(0, D.tc - D.ta), dTk = Math.max(0, D.tk - D.ta);
    const sd = 22 + 4.2 * Math.sqrt(dTc), ss = 14 + 2.2 * Math.sqrt(dTk);
    const dx = Math.max(Math.abs(x - L.dev.cx) - L.dev.w / 2, 0), dy = Math.max(Math.abs(y - L.dev.cy) - L.dev.h / 2, 0);
    let T = D.ta + dTc * Math.exp(-Math.pow(Math.hypot(dx, dy) / sd, 2));
    if (L.hs) {
      const hx = Math.max(L.hs.x - x, 0, x - (L.hs.x + L.hs.w)), hy = Math.max(L.hs.y - y, 0, y - (L.hs.y + L.hs.h));
      const inside = hx === 0 && hy === 0;
      const surf = inside ? D.ta + (D.tk - D.ta) * (1 - 0.35 * clamp((x - L.hs.x) / L.hs.w, 0, 1)) : D.ta + dTk * Math.exp(-Math.pow(Math.hypot(hx, hy) / ss, 2));
      if (surf > T) T = surf;
    }
    return T;
  }
  function vKamera(ctx, R, D) {
    const w = R.w, h = R.h, lo = D.lo, hi = D.hi, ta = D.ta;
    ctx.save(); ctx.translate(R.x, R.y);
    panel(ctx, 0, 0, w, h, 12); rr(ctx, 1, 1, w - 2, h - 2, 11); ctx.clip();
    const L = camLayout(D, w, h);
    // Bildgrund = Umgebungstemperatur
    ctx.fillStyle = heat(ta, lo, hi); ctx.fillRect(L.bx, L.by, L.bw, L.bh);
    ctx.save(); ctx.beginPath(); ctx.rect(L.bx, L.by, L.bw, L.bh); ctx.clip();
    // Orientierungsbauteile (kalt) als Umriss
    const outline = 'rgba(210,225,240,0.55)';
    ctx.strokeStyle = outline; ctx.lineWidth = 1.4;
    const comps = [[0.1, 0.16, 'c'], [0.1, 0.8, 'c'], [0.32, 0.9, 'r'], [0.9, 0.9, 'i']];
    comps.forEach(c => {
      const x = L.bx + L.bw * c[0], y = L.by + L.bh * c[1];
      const T = camField(D, L, x, y); ctx.fillStyle = heatA(T, lo, hi, 0.9);
      if (c[2] === 'c') { ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
      else if (c[2] === 'r') { rr(ctx, x - 20, y - 7, 40, 14, 3); ctx.fill(); ctx.stroke(); }
      else { rr(ctx, x - 20, y - 12, 40, 24, 3); ctx.fill(); ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 14 + i * 9, y - 12); ctx.lineTo(x - 14 + i * 9, y - 17); ctx.moveTo(x - 14 + i * 9, y + 12); ctx.lineTo(x - 14 + i * 9, y + 17); ctx.stroke(); } }
    });
    // Waermehoefe: weiche Radialverlaeufe aus der Feldfunktion
    const dTc = Math.max(0, D.tc - ta), dTk = Math.max(0, D.tk - ta), sd = 22 + 4.2 * Math.sqrt(dTc), ss = 14 + 2.2 * Math.sqrt(dTk);
    const halo = (cx, cy, r0, sg, Tpk, aMax) => {
      const R2 = r0 + sg * 2.2, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R2);
      for (let i = 0; i <= 8; i++) { const d = i / 8 * R2, T = ta + (Tpk - ta) * Math.exp(-Math.pow(Math.max(0, d - r0) / sg, 2)); g.addColorStop(i / 8, heatA(T, lo, hi, aMax * (1 - Math.pow(i / 8, 3)))); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R2, 0, TAU); ctx.fill();
    };
    halo(L.dev.cx, L.dev.cy, Math.max(L.dev.w, L.dev.h) / 2, sd, D.tc, 1);
    if (L.hs) {
      for (let i = 4; i >= 1; i--) { const e = i * ss * 0.55; ctx.fillStyle = heatA(ta + dTk * Math.exp(-Math.pow(e / ss, 2)), lo, hi, 0.5); rr(ctx, L.hs.x - e, L.hs.y - e, L.hs.w + 2 * e, L.hs.h + 2 * e, e + 6); ctx.fill(); }
      const g = ctx.createLinearGradient(L.hs.x, 0, L.hs.x + L.hs.w, 0); g.addColorStop(0, heat(D.tk, lo, hi)); g.addColorStop(1, heat(ta + (D.tk - ta) * 0.65, lo, hi));
      ctx.fillStyle = g; rr(ctx, L.hs.x, L.hs.y, L.hs.w, L.hs.h, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
      const nf = Math.max(3, Math.round(L.hs.h / 12)); for (let i = 1; i < nf; i++) { const yy = L.hs.y + L.hs.h * i / nf; ctx.beginPath(); ctx.moveTo(L.hs.x + 14, yy); ctx.lineTo(L.hs.x + L.hs.w - 4, yy); ctx.stroke(); }
      ctx.strokeStyle = outline; ctx.lineWidth = 1.6; rr(ctx, L.hs.x, L.hs.y, L.hs.w, L.hs.h, 4); ctx.stroke();
    }
    // Bauteil selbst (Oberflaeche = Tc)
    const dv = L.dev;
    ctx.fillStyle = heat(D.tc, lo, hi);
    if (D.shape === 'led') { ctx.beginPath(); ctx.arc(dv.cx, dv.cy, dv.w / 2, 0, TAU); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 1.8; ctx.stroke(); ctx.beginPath(); ctx.arc(dv.cx, dv.cy, 11, 0, TAU); ctx.fillStyle = heat(D.tc + 0.5 * Math.max(0, D.tj - D.tc), lo, hi); ctx.fill(); ctx.stroke(); }
    else { rr(ctx, dv.cx - dv.w / 2, dv.cy - dv.h / 2, dv.w, dv.h, 4); ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 1.8; ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(210,225,240,0.5)'; ctx.lineWidth = 1.5; rr(ctx, L.bx, L.by, L.bw, L.bh, 6); ctx.stroke();
    // Beschriftung (immer mit Zahl)
    const lab = [[dv.cx, dv.cy - dv.h / 2 - 18, D.sym.tc + ' (Oberfläche) ' + D.f(D.tc, 1) + ' °C', D.tc]];
    if (L.hs) lab.push([L.hs.x + L.hs.w / 2, L.hs.y + L.hs.h + 14, D.sym.tk + ' (Kühlkörper) ' + D.f(D.tk, 1) + ' °C', D.tk]);
    lab.forEach(q => { const bw2 = tw(q[2], 12, '700') + 12, bx2 = clamp(q[0] - bw2 / 2, L.bx + 2, L.bx + L.bw - bw2 - 2), by2 = clamp(q[1] - 10, L.by + 2, L.by + L.bh - 22); badge(ctx, bx2, by2, q[2], 12, heat(q[3], lo, hi)); });
    // Fadenkreuz (Zeiger der Oberflaeche, Pixel im Rechteck der Ansicht); dieselbe Feldfunktion wie die Farbe
    if (D.cursor && D.cursor.x >= L.bx && D.cursor.x <= L.bx + L.bw && D.cursor.y >= L.by && D.cursor.y <= L.by + L.bh) {
      const mx = D.cursor.x, my = D.cursor.y, T = camField(D, L, mx, my);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.lineTo(mx + 14, my); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my + 14); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.lineTo(mx + 14, my); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my + 14); ctx.stroke(); ctx.beginPath(); ctx.arc(mx, my, 6, 0, TAU); ctx.stroke();
      const s = D.f(T, 1) + ' °C', bw3 = tw(s, 13, '800') + 14; badge(ctx, clamp(mx + 12, L.bx + 2, L.bx + L.bw - bw3 - 2), clamp(my - 28, L.by + 2, L.by + L.bh - 26), s, 13, '#ffffff');
    }
    // Farbskala am Rand
    {
      const lx = w - L.legW + 8, ly = L.by, lh = L.bh;
      const g = ctx.createLinearGradient(0, ly + lh, 0, ly); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, HEAT_STR[Math.round(i / 8 * 255)]);
      ctx.fillStyle = g; rr(ctx, lx, ly, 14, lh, 5); ctx.fill(); ctx.strokeStyle = ink(0.4); ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = ly + lh - lh * i / 4; txt(ctx, Math.round(v) + (i === 4 ? ' °C' : ''), lx + 20, clamp(y, ly + 6, ly + lh - 6), 12, COL.dim, 'left', '600'); }
      const my2 = ly + lh - lh * clamp((D.tjMax - lo) / ((hi - lo) || 1), 0, 1);
      ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 5, my2); ctx.lineTo(lx + 19, my2); ctx.stroke();
    }
    txt(ctx, 'Die Kamera sieht ' + D.sym.tc + ' und ' + D.sym.tk + ', nicht ' + D.sym.tj + '. Tippe ins Bild für die Temperatur dort.', 18, h - 30, 12, COL.dim, 'left', '600');
    txt(ctx, D.sym.tj + ' im Chip: ' + D.f(D.tj, 1) + ' °C (von außen nicht sichtbar)', 18, h - 12, 12, COL.text, 'left', '700');
    ctx.restore();
    return L;
  }

  // ---------- Thermisches Ersatzschaltbild ----------
  const ANALOGIE_FB = [['Spannung U', 'Temperaturdifferenz ΔT'], ['Strom I', 'Verlustleistung P'], ['Widerstand R', 'Wärmewiderstand Rth'], ['Kondensator C', 'Wärmekapazität Cth'], ['Masse', 'Umgebung Ta'], ['Spannungsquelle', 'Umgebungstemperatur Ta'], ['Stromquelle', 'Verlustleistung'], ['Reihenschaltung', 'Kette']];
  function vErsatz(ctx, R, D) {
    const w = R.w, h = R.h, lo = D.lo, hi = D.hi, ta = D.ta, t = D.t;
    ctx.save(); ctx.translate(R.x, R.y);
    panel(ctx, 0, 0, w, h, 12); rr(ctx, 1, 1, w - 2, h - 2, 11); ctx.clip();
    const side = w >= 560, lw = side ? w * 0.64 : w - 12;
    const nodes = [{ n: D.sym.tj, T: D.tj, C: D.cth.j, cn: 'Cth_j' }];
    const res = [];
    if (D.mode === 'kk') { nodes.push({ n: D.sym.tc, T: D.tc, C: D.cth.c, cn: 'Cth_c' }, { n: D.sym.tk, T: D.tk, C: D.cth.k, cn: 'Cth_k' }); res.push(['jc', D.sym.rthJC, D.rthJC, D.dJC], ['ck', D.sym.rthCK, D.rthCK, D.dCK], ['k', D.sym.rthK, D.rthK, D.dK]); }
    else if (!D.singleNode) { nodes.push({ n: D.sym.tc, T: D.tc, C: D.cth.c, cn: 'Cth_c' }); res.push(['jc', D.sym.rthJC, D.rthJC, D.dJC], ['k', D.sym.rthCA, D.rthK, D.dK]); }
    else res.push(['k', D.sym.rthJA, D.rthTotal, D.tj - ta]);
    txt(ctx, 'Thermisches Ersatzschaltbild: Wärme fließt wie Strom', 14, 16, 13, COL.text, 'left', '800');
    const nN = nodes.length, yT = 118, yB = h - 62, xS = 36, xE = lw - 34, xFirst = xS + 58, sl = (xE - xFirst) / res.length;
    const nx = nodes.map((_, i) => xFirst + i * sl);
    // Schienen
    ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(xS, yT); ctx.lineTo(xE, yT); ctx.moveTo(xS, yB); ctx.lineTo(xE, yB); ctx.stroke();
    // Stromquelle P (Waermepumpe: Kreis mit Pfeil)
    ctx.beginPath(); ctx.moveTo(xS, yT); ctx.lineTo(xS, yT + 24); ctx.moveTo(xS, yB - 24); ctx.lineTo(xS, yB); ctx.stroke();
    ctx.beginPath(); ctx.arc(xS, (yT + yB) / 2, 24, 0, TAU); ctx.fillStyle = COL.panel2; ctx.fill(); ctx.strokeStyle = '#8fa3b5'; ctx.stroke();
    arrow(ctx, xS, (yT + yB) / 2 + 12, xS, (yT + yB) / 2 - 14, '#ffffff', 3, 9);
    txt(ctx, 'P = ' + D.f(D.p, 1) + ' W', xS, yB + 26, 13, COL.text, 'center', '800');
    txt(ctx, 'Stromquelle', xS, yB + 44, 12, COL.dim, 'center', '600');
    // Spannungsquelle Ta
    ctx.beginPath(); ctx.moveTo(xE, yT); ctx.lineTo(xE, yT + 24); ctx.moveTo(xE, yB - 24); ctx.lineTo(xE, yB); ctx.stroke();
    ctx.beginPath(); ctx.arc(xE, (yT + yB) / 2, 24, 0, TAU); ctx.fillStyle = COL.panel2; ctx.fill(); ctx.strokeStyle = '#8fa3b5'; ctx.stroke();
    txt(ctx, '+', xE, (yT + yB) / 2 - 9, 15, COL.text, 'center', '800'); txt(ctx, '−', xE, (yT + yB) / 2 + 10, 15, COL.text, 'center', '800');
    txt(ctx, D.sym.ta + ' = ' + D.f(ta, 0) + ' °C', xE, yB + 26, 13, COL.text, 'center', '800');
    txt(ctx, 'Umgebung', xE, yB + 44, 12, COL.dim, 'center', '600');
    // Widerstaende zwischen den Knoten (letzter: Knoten -> Ta)
    const fillLvl = (T) => clamp((T - ta) / ((hi - ta) || 1), 0, 1);
    const alpha = 0.3 + 0.7 * D.steadyFrac;
    for (let i = 0; i < res.length; i++) {
      const xa = nx[i], xb = i < nN - 1 ? nx[i + 1] : xE, xm = (xa + xb) / 2, r = res[i];
      ctx.strokeStyle = MEMBER_COL[r[0]]; ctx.lineWidth = 3;
      rr(ctx, xm - 28, yT - 11, 56, 22, 3); ctx.fillStyle = COL.panel2; ctx.fill(); ctx.stroke();
      txt(ctx, r[1], xm, yT - 24, 12, MEMBER_COL[r[0]], 'center', '800');
      txt(ctx, D.f(r[2], 2).replace(/,?0+$/, '') + ' K/W', xm, yT + 1, 12, COL.text, 'center', '700');
      // Spannungsabfall als Temperaturabfall
      const ya = yT + 26; ctx.strokeStyle = MEMBER_COL[r[0]]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, ya); ctx.moveTo(xa, ya - 5); ctx.lineTo(xa, ya + 5); ctx.moveTo(xb, ya - 5); ctx.lineTo(xb, ya + 5); ctx.stroke();
      txt(ctx, 'ΔT = ' + D.f(r[3], 1) + ' K', xm, ya + 14, 12, COL.text, 'center', '700');
    }
    // Waermefluss laengs der oberen Schiene
    flowArrow(ctx, xS + 6, yT - 40, xE - 6, yT - 40, D.p, t, alpha, D.reduced, '#ffffff');
    // Knoten, Temperaturen, Kondensatoren (Fuellstand)
    nodes.forEach((nd, i) => {
      const x = nx[i];
      ctx.fillStyle = heat(nd.T, lo, hi); ctx.beginPath(); ctx.arc(x, yT, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, yT + 7); ctx.lineTo(x, (yT + yB) / 2 - 7); ctx.moveTo(x, (yT + yB) / 2 + 7); ctx.lineTo(x, yB); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 14, (yT + yB) / 2 - 7); ctx.lineTo(x + 14, (yT + yB) / 2 - 7); ctx.moveTo(x - 14, (yT + yB) / 2 + 7); ctx.lineTo(x + 14, (yT + yB) / 2 + 7); ctx.stroke();
      // Fuellstand-Glas neben dem Kondensator
      const gx = x + 22, gy = (yT + yB) / 2 - 30, gh = 60, gw = 12, f = fillLvl(nd.T);
      rr(ctx, gx, gy, gw, gh, 3); ctx.fillStyle = ink(0.06); ctx.fill(); ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = heat(nd.T, lo, hi); ctx.fillRect(gx + 1.5, gy + gh - gh * f, gw - 3, gh * f);
      txt(ctx, nd.cn, x + 8, yB - 38, 12, COL.dim, 'center', '600');
      txt(ctx, D.f(nd.C, 1) + ' J/K', x + 8, yB - 22, 12, COL.dim, 'center', '600');
      const s = nd.n + ' ' + D.f(nd.T, 1) + ' °C';
      badge(ctx, clamp(x - tw(s, 12, '700') / 2 - 6, 4, lw - tw(s, 12, '700') - 16), 32, s, 12, heat(nd.T, lo, hi));
    });
    // Analogietabelle (nur seitlich); im Hochformat eine Zeile
    {
      const rows = D.analogie && D.analogie.length ? D.analogie : ANALOGIE_FB;
      if (side) {
        const tx = lw + 8, ty = 14, tW = w - lw - 20, rh = fz(12) + 9, nrow = Math.min(rows.length, 8);
        txt(ctx, 'Elektrisch ↔ Thermisch', tx, ty + 6, 12, COL.text, 'left', '800');
        for (let i = 0; i < nrow; i++) {
          const yy = ty + 22 + i * rh;
          rr(ctx, tx, yy, tW, rh - 2, 4); ctx.fillStyle = i % 2 ? ink(0.03) : ink(0.07); ctx.fill();
          txt(ctx, rows[i][0], tx + 6, yy + rh / 2 - 1, 12, COL.dim, 'left', '600'); txt(ctx, rows[i][1], tx + tW - 6, yy + rh / 2 - 1, 12, COL.text, 'right', '700');
        }
      } else {
        txt(ctx, rows.slice(0, 4).map(r => r[0].split(' ')[0] + ' ↔ ' + r[1].split(' ').pop()).join('  ·  '), 14, 52 + 4, 12, COL.dim, 'left', '600');
      }
    }
    ctx.restore();
  }

  // ---------- Balken: gestapelte Temperaturabfaelle ----------
  function vBalken(ctx, R, D) {
    const w = R.w, h = R.h, ta = D.ta;
    ctx.save(); ctx.translate(R.x, R.y);
    panel(ctx, 0, 0, w, h, 12); rr(ctx, 1, 1, w - 2, h - 2, 11); ctx.clip();
    const kk = D.mode === 'kk';
    const segs = [['k', kk ? D.sym.rthK : D.sym.rthCA, D.dK, D.rthK]];
    if (kk) segs.push(['ck', D.sym.rthCK, D.dCK, D.rthCK]);
    if (!D.singleNode) segs.push(['jc', D.sym.rthJC, D.dJC, D.rthJC]); else segs[0][1] = D.sym.rthJA;
    const total = segs.reduce((s, q) => s + Math.max(0, q[2]), 0), lim = Math.max(0, D.tjMax - ta);
    const top = 36, bot = h - 34, ax = 58, bw = clamp(w * 0.2, 60, 120), maxV = Math.max(total, lim, 10) * 1.12;
    const yv = (v) => bot - (bot - top) * clamp(v / maxV, 0, 1);
    // Achse in K ueber Ta und absolute Temperatur
    const stp = maxV > 120 ? 40 : maxV > 60 ? 20 : maxV > 30 ? 10 : 5;
    ctx.strokeStyle = ink(0.18); ctx.lineWidth = 1;
    for (let v = 0; v <= maxV; v += stp) { const y = yv(v); ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(w - 12, y); ctx.stroke(); txt(ctx, Math.round(ta + v) + ' °C', ax - 6, y, 12, COL.dim, 'right', '600'); }
    txt(ctx, 'Temperaturabfälle von ' + D.sym.ta + ' bis ' + D.sym.tj + ' (gestapelt)', 14, 16, 13, COL.text, 'left', '800');
    // Saeule: unten Kuehlkoerper-Luft, oben Chip-Gehaeuse
    const bx = ax + 26;
    let acc = 0;
    const PAT = { k: 'dots', ck: 'diag', jc: 'solid' };
    segs.forEach(q => {
      const v = Math.max(0, q[2]), y1 = yv(acc + v), y0 = yv(acc);
      ctx.fillStyle = MEMBER_COL[q[0]]; ctx.fillRect(bx, y1, bw, Math.max(0.5, y0 - y1));
      ctx.save(); ctx.beginPath(); ctx.rect(bx, y1, bw, Math.max(0.5, y0 - y1)); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 2;
      if (PAT[q[0]] === 'diag') for (let k = -bw; k < bw + (y0 - y1); k += 9) { ctx.beginPath(); ctx.moveTo(bx + k, y0); ctx.lineTo(bx + k + (y0 - y1), y1); ctx.stroke(); }
      else if (PAT[q[0]] === 'dots') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let yy = y1 + 4; yy < y0; yy += 8) for (let xx = bx + 5; xx < bx + bw; xx += 10) { ctx.beginPath(); ctx.arc(xx + ((yy / 8) % 2 ? 5 : 0), yy, 1.7, 0, TAU); ctx.fill(); } }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; ctx.strokeRect(bx, y1, bw, Math.max(0.5, y0 - y1));
      const s = D.f(v, 1) + ' K';
      if (y0 - y1 >= fz(12) + 6) { rr(ctx, bx + bw / 2 - tw(s, 12, '800') / 2 - 4, (y0 + y1) / 2 - 9, tw(s, 12, '800') + 8, 18, 4); ctx.fillStyle = 'rgba(10,14,18,0.82)'; ctx.fill(); txt(ctx, s, bx + bw / 2, (y0 + y1) / 2, 12, '#ffffff', 'center', '800'); }
      acc += v;
    });
    // Legende der Glieder mit allen Zahlen (Farbe ist nie der einzige Traeger)
    segs.slice().reverse().forEach((q, i) => {
      const ly = top + 6 + i * (fz(12) + 8), lx = bx + bw + 20;
      ctx.fillStyle = MEMBER_COL[q[0]]; ctx.fillRect(lx, ly - 5, 11, 11); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly - 5, 11, 11);
      txt(ctx, q[1] + ' ' + D.f(q[3], 2).replace(/,?0+$/, '') + ' K/W → ΔT ' + D.f(Math.max(0, q[2]), 1) + ' K', lx + 17, ly, 12, COL.text, 'left', '700');
    });
    // Summe und Grenze
    const ySum = yv(total);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 8, ySum); ctx.lineTo(bx + bw + 8, ySum); ctx.stroke();
    const sum = D.sym.tj + ' − ' + D.sym.ta + ' = ' + D.f(total, 1) + ' K (' + D.sym.tj + ' = ' + D.f(D.tj, 1) + ' °C)';
    badge(ctx, bx + bw + 14, clamp(ySum - 12, top - 6, bot - 24), sum, 12, '#ffffff');
    const yl = yv(lim);
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(ax, yl); ctx.lineTo(w - 12, yl); ctx.stroke(); ctx.setLineDash([]);
    const ls = D.sym.tjMax + ' − ' + D.sym.ta + ' = ' + D.f(lim, 0) + ' K (' + D.f(D.tjMax, 0) + ' °C)';
    txt(ctx, ls, w - 14, yl - (Math.abs(yl - ySum) < 18 && ySum >= yl ? -12 : 9), 12, COL.bad, 'right', '800');
    // Anteile
    const parts = segs.slice().reverse().map(q => D.sym.rthShort[q[0]] + ' ' + D.f(total > 0 ? 100 * Math.max(0, q[2]) / total : 0, 0) + ' %');
    txt(ctx, 'Anteile: ' + parts.join(' · '), 14, h - 14, 12, COL.dim, 'left', '600');
    ctx.restore();
  }
  const VIEW_FN = { schnitt: vSchnitt, kamera: vKamera, ersatz: vErsatz, balken: vBalken };
  // THM_DRAW zuerst (gleiches Aufrufmuster wie thmrig-linear.js: Daten A), sonst die lokalen Fassungen oben. Rueckgabe: true, wenn THM_DRAW gezeichnet hat.
  function drawView(ctx, view, R, D, A, sc) {
    const T = root.THM_DRAW;
    let drawn = false;
    sc = sc > 0 ? sc : 1;
    if (T && A) {
      try {
        panel(ctx, R.x, R.y, R.w, R.h, 12);
        const w = R.w * sc, h = R.h * sc, cur = D.cursor ? { x: D.cursor.x * sc, y: D.cursor.y * sc } : null;
        ctx.save(); rr(ctx, R.x, R.y, R.w, R.h, 12); ctx.clip(); ctx.translate(R.x, R.y); ctx.scale(1 / sc, 1 / sc);
        if (view === 'schnitt' && typeof T.schnitt === 'function') drawn = !!T.schnitt(ctx, w, h, A);
        else if (view === 'kamera' && typeof T.kamera === 'function') drawn = !!T.kamera(ctx, w, h, cur ? Object.assign({ cursor: cur }, A) : A);
        else if (view === 'ersatz' && typeof T.ersatz === 'function') drawn = !!T.ersatz(ctx, w, h, D.analogie ? Object.assign({ analogie: D.analogie }, A) : A);
        else if (view === 'balken' && typeof T.balken === 'function' && typeof T.balkenData === 'function') drawn = !!T.balken(ctx, { x: 0, y: 0, w, h }, T.balkenData([A], { names: [A.deviceName || ''] }));
        ctx.restore();
      } catch (e) { try { ctx.restore(); } catch (e2) { /* nichts */ } drawn = false; }
    }
    if (!drawn) (VIEW_FN[view] || vSchnitt)(ctx, R, D);
    return drawn;
  }

  // ---------- Bedienelemente im Bild (THM_DRAW bevorzugt, sonst lokal mit gleicher Geometrie) ----------
  const KNOB_A0 = 0.75 * Math.PI, KNOB_SWEEP = 1.5 * Math.PI;
  function localKnob(ctx, k) {
    const f = k.f, a = KNOB_A0 + KNOB_SWEEP * f, x = k.cx, y = k.cy, r = k.r;
    ctx.lineCap = 'round';
    ctx.strokeStyle = COL.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 7, KNOB_A0, KNOB_A0 + KNOB_SWEEP); ctx.stroke();
    ctx.strokeStyle = COL.acc; ctx.beginPath(); ctx.arc(x, y, r + 7, KNOB_A0, a); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = COL.panel2; ctx.fill(); ctx.strokeStyle = COL.dim; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = COL.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); ctx.stroke();
    txt(ctx, k.label, x, y - r - 20, 12, COL.text, 'center', '700');
    txt(ctx, k.text, x, y + r + 20, 12, COL.text, 'center', '800');
  }
  function wKnob(ctx, k, sc) {
    const T = root.THM_DRAW; sc = sc > 0 ? sc : 1;
    if (T && !k.log && typeof T.drehregler === 'function') {   // Bildpunkte: Schrift 12 px unabhaengig vom Weltmassstab; Log-Regler zeichnet die lokale Fassung (Zeigerstellung im Log-Mass)
      try { ctx.save(); ctx.scale(1 / sc, 1 / sc); const ok = T.drehregler(ctx, k.cx * sc, k.cy * sc, k.r * sc, { value: k.value, lo: k.lo, hi: k.hi, label: k.label, unit: k.unit, digits: k.digits, colors: PAL_NOW }); ctx.restore(); if (ok) return; } catch (e) { try { ctx.restore(); } catch (e2) { /* nichts */ } }
    }
    localKnob(ctx, k);
  }
  function localToggle(ctx, s) {
    const tw0 = 52, th = 26, x = s.cx, cy = s.cy - 6;
    rr(ctx, x - tw0 / 2, cy - th / 2, tw0, th, th / 2); ctx.fillStyle = s.on ? 'rgba(76,217,100,0.25)' : COL.panel2; ctx.fill(); ctx.strokeStyle = s.on ? COL.ok : COL.dim; ctx.lineWidth = 2; ctx.stroke();
    const kx = x + (s.on ? 1 : -1) * (tw0 / 2 - th / 2);
    ctx.beginPath(); ctx.arc(kx, cy, th / 2 - 3, 0, TAU); ctx.fillStyle = s.on ? COL.ok : COL.dim; ctx.fill();
    txt(ctx, s.on ? 'AN' : 'AUS', x + (s.on ? -1 : 1) * (tw0 / 2 - th / 2 - 2), cy, 12, s.on ? COL.text : COL.dim, 'center', '800');
    txt(ctx, s.label, x, s.cy + th / 2 + 4, 12, COL.text, 'center', '700');
  }
  function wToggle(ctx, s, sc) {
    const T = root.THM_DRAW; sc = sc > 0 ? sc : 1;
    if (T && typeof T.kippschalter === 'function') { try { ctx.save(); ctx.scale(1 / sc, 1 / sc); const ok = T.kippschalter(ctx, s.cx * sc, s.cy * sc, { on: s.on, label: s.label, colors: PAL_NOW }); ctx.restore(); if (ok) return; } catch (e) { try { ctx.restore(); } catch (e2) { /* nichts */ } } }
    localToggle(ctx, s);
  }
  // Thermometer: Roehre (x, y) = Mitte oben, Hoehe h; Skalenzonen gruen bis Tj,max - 10 K, gelb bis Tj,max, rot darueber, schwarz bei Defekt
  function localThermo(ctx, x, y, h, o) {
    const bw = 16, bx = x - bw / 2, top = y, bot = y + h, yv = (v) => bot - (bot - top) * clamp((v - o.lo) / ((o.hi - o.lo) || 1), 0, 1), T = o.value;
    rr(ctx, bx, top - 6, bw, bot - top + 12, 8); ctx.fillStyle = ink(0.07); ctx.fill(); ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.6; ctx.stroke();
    [[o.lo, o.tjMax - 10, 'rgba(76,217,100,0.55)'], [o.tjMax - 10, o.tjMax, 'rgba(255,179,64,0.7)'], [o.tjMax, o.hi, 'rgba(255,92,92,0.65)']].forEach(z => { const a = clamp(z[0], o.lo, o.hi), b = clamp(z[1], o.lo, o.hi); if (b > a) { ctx.fillStyle = z[2]; ctx.fillRect(bx + bw + 3, yv(b), 5, yv(a) - yv(b)); } });
    const col = o.destroyed ? '#0b0b0b' : T > o.tjMax ? COL.bad : T > o.tjMax - 10 ? COL.warn : COL.ok;
    ctx.fillStyle = col; ctx.fillRect(bx + 3, yv(T), bw - 6, bot - yv(T) + 4);
    ctx.beginPath(); ctx.arc(x, bot + 8, 11, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.6; ctx.stroke();
    const step = (o.hi - o.lo) > 160 ? 50 : (o.hi - o.lo) > 80 ? 25 : 10;
    for (let v = Math.ceil(o.lo / step) * step; v <= o.hi; v += step) { ctx.strokeStyle = ink(0.45); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 4, yv(v)); ctx.lineTo(bx, yv(v)); ctx.stroke(); txt(ctx, String(Math.round(v)), bx - 7, yv(v), 12, COL.dim, 'right', '600'); }
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 6, yv(o.tjMax)); ctx.lineTo(bx + bw + 10, yv(o.tjMax)); ctx.stroke();
    txt(ctx, o.name + ' ' + Math.round(T) + ' °C', x, y - 12, 12, o.destroyed ? COL.bad : COL.text, 'center', '800');
  }
  function wThermo(ctx, x, y, h, o, sc) {
    const T = root.THM_DRAW; sc = sc > 0 ? sc : 1;
    if (T && typeof T.thermometer === 'function') { try { ctx.save(); ctx.scale(1 / sc, 1 / sc); const ok = T.thermometer(ctx, x * sc, y * sc, h * sc, { value: o.value, lo: o.lo, hi: o.hi, tjMax: o.tjMax, shut: o.shut, destroyed: o.destroyed, name: o.name, unit: '°C', colors: PAL_NOW }); ctx.restore(); if (ok) return; } catch (e) { try { ctx.restore(); } catch (e2) { /* nichts */ } } }
    localThermo(ctx, x, y, h, o);
  }

  // ===== Gemeinsamer Block 3/3: Montage-Steuerwerte, Meldungen, Layout, Pruefstand-Motor (makeEngine) =====
  const MOUNT_KEYS = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient', 'ta'];   // 'nonlin' (Vertiefung, Streichliste 3) gibt es an diesen Anlagen nicht
  const GRP_MOUNT = 'Montage und Umgebung';
  const O = (value, label) => ({ value, label });
  // Rueckfall, falls THM_CORE.mountControls() fehlt (SPEC 5.0); mit Kern wird dessen Liste benutzt
  const MOUNT_FB = [
    { key: 'heatsink', label: 'Kühlkörper', type: 'select', value: 'none', options: [O('none', 'ohne (freistehend)'), O('fahne', 'Fahnenkühlkörper'), O('s', 'Profil klein'), O('m', 'Profil mittel'), O('l', 'Profil groß'), O('xl', 'Rippenkörper sehr groß'), O('blech', 'Kühlblech (Selbstbau)')], help: 'Der Kühlkörper nimmt die Wärme vom Gehäuse auf und gibt sie an die Luft ab. Ohne Kühlkörper gilt der Wärmewiderstand Sperrschicht–Umgebung aus dem Datenblatt.' },
    { key: 'blechA', label: 'Fläche des Kühlbleches', type: 'slider', min: 10, max: 400, step: 10, unit: 'cm²', value: 100, visible: (s) => s.heatsink === 'blech', help: 'Fläche des Kühlbleches (beide Seiten zusammen). Mehr Fläche gibt weniger Wärmewiderstand.' },
    { key: 'joint', label: 'Übergang', type: 'select', value: 'direkt', visible: (s) => s.heatsink !== 'none', options: [O('direkt', 'direkt (ohne Isolierscheibe)'), O('glimmer', 'Glimmerscheibe'), O('silikon', 'Silikonfolie')], help: 'Zwischen Gehäuse und Kühlkörper: direkt ist am kühlsten, die Isolierscheibe isoliert elektrisch, kostet aber Wärmeleitung.' },
    { key: 'paste', label: 'Wärmeleitpaste', type: 'select', value: 'duenn', visible: (s) => s.heatsink !== 'none', options: [O('keine', 'keine'), O('duenn', 'dünn'), O('dick', 'dick')], help: 'Die Paste füllt die Luftspalte zwischen den rauen Flächen. Dünn auftragen: Zu viel Paste verschlechtert den Übergang.' },
    { key: 'bushing', label: 'Isolierbuchse', type: 'switch', value: true, visible: (s) => s.heatsink !== 'none' && s.joint !== 'direkt', help: 'Die Kunststoffbuchse isoliert die Schraube. Ohne Buchse verbindet die Schraube Fahne und Kühlkörper elektrisch.' },
    { key: 'screw', label: 'Schraube', type: 'select', value: 'fest', visible: (s) => s.heatsink !== 'none', options: [O('fest', 'fest'), O('locker', 'locker')], help: 'Eine lockere Schraube drückt das Gehäuse nicht an: Der Übergang wird schlechter.' },
    { key: 'ksPot', label: 'Kühlkörper', type: 'select', value: 'masse', visible: (s) => s.heatsink !== 'none', options: [O('masse', 'an Gerätemasse'), O('frei', 'frei (isoliert eingebaut)')], help: 'Der Kühlkörper liegt an Gerätemasse oder ist frei eingebaut. Liegt die Fahne nicht an Masse, kann der Kühlkörper Spannung führen oder einen Kurzschluss verursachen.' },
    { key: 'fan', label: 'Lüfter', type: 'select', value: 'aus', visible: (s) => s.heatsink !== 'none', options: [O('aus', 'aus'), O('leise', 'leise'), O('mittel', 'mittel'), O('stark', 'stark')], help: 'Der Lüfter verkleinert nur den Wärmewiderstand des Kühlkörpers zur Luft, nicht den des Gehäuses oder des Übergangs.' },
    { key: 'orient', label: 'Einbaulage', type: 'select', value: 'senkrecht', visible: (s) => s.heatsink !== 'none', options: [O('senkrecht', 'senkrecht'), O('waagrecht', 'waagrecht')], help: 'Stehen die Rippen senkrecht, steigt die warme Luft (Kamineffekt). Waagrecht ist der Wärmewiderstand des Kühlkörpers größer.' },
    { key: 'ta', label: 'Umgebungstemperatur', type: 'slider', min: 0, max: 70, step: 1, unit: '°C', value: 25, help: 'Temperatur der Luft am Kühlkörper. Im Gerät ist es wärmer als im Raum.' }
  ];
  const MOUNT_PRESETS_FB = [
    { id: 'frei', name: 'Freistehend', values: { heatsink: 'none' } },
    { id: 'kk-m-glimmer-paste', name: 'Kühlkörper m, Glimmer, Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus' } },
    { id: 'kk-m-glimmer-trocken', name: 'Kühlkörper m, Glimmer ohne Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'keine', bushing: true, screw: 'fest', fan: 'aus' } },
    { id: 'kk-m-direkt-paste', name: 'Kühlkörper m, direkt mit Paste', values: { heatsink: 'm', joint: 'direkt', paste: 'duenn', screw: 'fest', fan: 'aus' } },
    { id: 'kk-l-lüfter', name: 'Kühlkörper l mit Lüfter', values: { heatsink: 'l', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'mittel' } }
  ];
  function mountPresetList(CORE) {
    let r = null;
    try { r = CORE.mountPresets; if (typeof r === 'function') r = r(); } catch (e) { r = null; }
    let arr = Array.isArray(r) ? r : (r && typeof r === 'object' ? Object.keys(r).map(k => Object.assign({ id: k }, r[k])) : null);
    if (!arr || !arr.length) arr = MOUNT_PRESETS_FB;
    return arr.filter(p => p && p.id).map(p => ({ id: String(p.id), name: String(p.name || p.id), values: Object.assign({}, p.values || p.params || p.controls || {}) }));
  }
  function mountDefs(CORE, spec) {
    let base = null;
    try { if (typeof CORE.mountControls === 'function') { const r = CORE.mountControls(); if (Array.isArray(r) && r.length) base = r; } } catch (e) { base = null; }
    const have = {}; (base || []).forEach(c => { if (c && c.key) have[c.key] = true; });
    const list = (base || []).concat(MOUNT_FB.filter(c => !have[c.key]));
    const out = [];
    MOUNT_KEYS.forEach(k => {
      const c = list.find(q => q && q.key === k); if (!c) return;
      const d = Object.assign({}, c, { group: GRP_MOUNT });
      if (Array.isArray(d.options)) d.options = d.options.map(o => Object.assign({}, o));
      const ov = typeof c.visible === 'function' ? c.visible : null;
      d.visible = (st) => { try { if (spec.mountVisible && !spec.mountVisible(d.key, st || {})) return false; return ov ? !!ov(st || {}) : true; } catch (e) { return true; } };
      out.push(d);
    });
    return out;
  }
  const HS_NAME = { none: 'freistehend', fahne: 'Fahnenkühlkörper', s: 'Kühlkörper klein', m: 'Kühlkörper mittel', l: 'Kühlkörper groß', xl: 'Kühlkörper sehr groß' };
  const JOINT_NAME = { direkt: 'direkt', glimmer: 'Glimmerscheibe', silikon: 'Silikonfolie' };
  const PASTE_NAME = { keine: 'ohne Paste', duenn: 'Paste dünn', dick: 'Paste dick' };
  const PKG_OF = { to220: 'TO-220', to126: 'TO-126', axial: 'DO-201', zement: 'Zement', alu: 'Alu', led: 'LED' };
  const SEV = { error: 0, warn: 1, info: 2 };

  // ---------- Layout (Weltmass, elastisch in der Breite): Hochformat (Hoehe 880) oder Querformat (Hoehe 640), je nachdem, was die Flaeche besser ausnutzt ----------
  function layout(w, h) {
    const ok = fin(w) && fin(h) && w > 0 && h > 0, a = ok ? w / h : 1.5625;
    const sL = ok ? Math.min(w / 1000, h / 640) : 1, sP = ok ? Math.min(w / 430, h / 880) : 0;
    if (sP > sL) {
      const W = clamp(Math.round(880 * a), 430, 760);
      return { portrait: true, W, H: 880, head: { x: 0, y: 0, w: W, h: 56 }, view: { x: 8, y: 60, w: W - 16, h: 322 }, therm: { x: W - 108, y: 388, w: 100, h: 164 }, scene: { x: 8, y: 388, w: W - 124, h: 164 }, ctrl: { x: 8, y: 558, w: W - 16, h: 124 }, cells: { x: 8, y: 688, w: W - 16, h: 188, cols: 2, rows: 6 } };
    }
    const W = clamp(Math.round(640 * a), 900, 1400);
    return { portrait: false, W, H: 640, head: { x: 0, y: 0, w: W, h: 52 }, view: { x: 14, y: 58, w: W - 360, h: 392 }, therm: { x: W - 336, y: 58, w: 64, h: 236 }, scene: { x: W - 266, y: 58, w: 252, h: 236 }, ctrl: { x: W - 336, y: 300, w: 322, h: 150 }, cells: { x: 14, y: 458, w: W - 28, h: 174, cols: 4, rows: 3 } };
  }
  function fitText(s, maxW, size, weight) { s = String(s); while (s.length > 4 && tw(s, size, weight) > maxW) s = s.slice(0, -2).replace(/\s+$/, '') + '…'; return s; }
  const tmin = (f, s) => f(s / 60, s < 600 ? 1 : 0) + ' min';
  // Weltmass nach der Breite der Zeichenflaeche (Parameter, sonst #cvw, sonst Fensterbreite): unter 640 px Hochformat 430 x 880, sonst Querformat 1000 x 640
  const worldOf = (cssW) => {
    let w = num(cssW, NaN);
    if (!(w > 0)) { try { const el = root.document && root.document.getElementById && root.document.getElementById('cvw'); w = el && el.clientWidth ? el.clientWidth : 0; } catch (e) { w = 0; } }
    if (!(w > 0)) { try { w = root.innerWidth || 0; } catch (e) { w = 0; } }
    return w > 0 && w < 640 ? { w: 430, h: 880 } : { w: 1000, h: 640 };
  };
  // Konfiguration aus den Steuerwerten: THM_CORE.cfgFromControls (einzige Quelle), sonst lokal
  function cfgFrom(CORE, c, devId, hs) {
    const src = { heatsink: hs, blechA: c.blechA, joint: c.joint, paste: c.paste, bushing: !!c.bushing, screw: c.screw, ksPot: c.ksPot, fan: c.fan, orient: c.orient };
    try { if (CORE && typeof CORE.cfgFromControls === 'function') { const r = CORE.cfgFromControls(src, devId); if (r && typeof r === 'object' && r.device === devId) return Object.assign({ count: 1 }, r); } } catch (e) { /* lokal */ }
    return { device: devId, heatsink: hs, joint: c.joint, paste: c.paste, bushing: !!c.bushing, screw: c.screw, ksPot: c.ksPot, fan: c.fan, orient: c.orient, count: 1, blech: hs === 'blech' ? { A_cm2: c.blechA, d_mm: 2, material: 'al' } : undefined };
  }

  function makeEngine(CORE, spec, opts) {
    opts = opts || {};
    const fmt = fmtWith(CORE);
    const own = spec.controls.map(c => Object.assign({ group: 'Bauteil und Last' }, c));
    const defs = own.concat(mountDefs(CORE, spec));
    const def = {}; defs.forEach(c => { def[c.key] = c; if (c.type === 'select') c.optionsAll = c.options.slice(); });
    const ctl = {}; defs.forEach(c => { ctl[c.key] = c.value; });
    const meters = spec.meterDefs.map(m => Object.assign({}, m));
    const ev = makeEvents(80);
    const tr = makeTrace(12000, ['tj', 'tc', 'tk', 'ta', 'p', 'tjMax']);
    const TX = (CORE && CORE.TEXTS) || {}, TR = TX.rig || {};
    const MSG_NO = TR.wertAblehnen || 'Diesen Wert gibt es an dieser Anlage nicht.';
    let cfg = null, ch = null, th = null, rd = null, S = null, lim = null, view = 'schnitt', symSet = 'db', reduced, pointer = null, themeOpt = opts.theme || 'auto', colorsOver = opts.colors || null, ctlRev = 0, deviceRev = 0, stCache = null, idCache = null, dgCache = null, drawErr = '';
    const SYM = { rthShort: { jc: 'JC', ck: 'CK', k: 'K' } };
    function refreshSym() {
      [['tj', 'Tj'], ['tc', 'Tc'], ['tk', 'Tk'], ['ta', 'Ta'], ['tjMax', 'Tjmax'], ['rthJC', 'Rth_JC'], ['rthCK', 'Rth_CK'], ['rthK', 'Rth_K'], ['rthCA', 'Rth_CA'], ['rthJA', 'Rth_JA'], ['P', 'P']].forEach(q => { SYM[q[0]] = symOf(CORE, q[1], symSet); });
    }
    refreshSym();

    const say = (text, kind, fx, quiet, id) => ev.add(S ? S.t : 0, text, kind, fx, 330, 250, quiet, id);
    const fanF = (k) => { try { const v = CORE.fan && CORE.fan[k]; if (fin(v)) return v; } catch (e) { /* Rueckfall */ } return { aus: 1, leise: 0.55, mittel: 0.4, stark: 0.3 }[k] || 1; };
    const orientF = (k) => { try { const v = CORE.orient && CORE.orient[k]; if (fin(v)) return v; } catch (e) { /* Rueckfall */ } return k === 'waagrecht' ? 1.25 : 1; };
    const chainOf = (c2) => normChain(CORE.chain(spec.cfgOf(c2)));

    function newThermal() {
      const t2 = CORE.thermal(cfg);
      if (typeof t2.reset === 'function') t2.reset(ctl.ta);
      const r2 = stateReader(t2.state());
      if (!r2) throw new Error('THM_CORE.thermal().state() liefert keine Temperaturen.');
      rd = r2; return t2;
    }
    let enCache = null;
    function rebuild(keep) {
      cfg = spec.cfgOf(ctl);
      const c2 = normChain(CORE.chain(cfg));
      if (c2) ch = c2; else if (!ch) throw new Error('THM_CORE.chain liefert keine Kette.');
      lim = spec.limits(ctl);
      if (keep && th && typeof th.setCfg === 'function') { try { th.setCfg(cfg); } catch (e) { th = newThermal(); } }
      else if (!keep || !th) th = newThermal();
      stCache = null; idCache = null; dgCache = null; enCache = null;
    }
    function temps() {
      const q = rd(th.state());
      let tj = q[0], tc = q[1], tk = q[2];
      if (ch.mode !== 'kk') tk = tc;
      if (!fin(tj)) tj = ctl.ta; if (!fin(tc)) tc = tj; if (!fin(tk)) tk = tc;
      return [tj, tc, tk];
    }
    function initState() {
      rebuild(false);
      S = { t: 0, n: 0, acc: 0, tj: ctl.ta, tc: ctl.ta, tk: ctl.ta, p: 0, destroyed: false, destroyT: -1, thr: false, act: {}, hotEver: false, ding: false, last: [] };
      tr.clear(); ev.clear(); ctlRev++; enCache = null;
    }

    // ---------- Beharrungszustand (geschlossen) ----------
    function steadyInfo(c2, cf2, ch2) {
      cf2 = cf2 || cfg; ch2 = ch2 || ch;
      const sp = spec.steadyP(c2, c2.ta, ch2.rthTotal, ch2);
      if (!sp || !sp.ok) { const l2 = spec.limits(c2); return { ok: false, runaway: !!(sp && sp.runaway), G: sp && sp.G ? sp.G : 0, p: sp && fin(sp.p) ? sp.p : 0, tj: l2.destroyAt, tc: l2.destroyAt, tk: l2.destroyAt, dJC: 0, dCK: 0, dK: 0, rthTotal: ch2.rthTotal, why: sp && sp.why }; }
      let r = null; try { r = CORE.steady(cf2, sp.p, c2.ta); } catch (e) { r = null; }
      const q = normSteady(r, ch2, sp.p, c2.ta);
      return { ok: true, runaway: false, G: sp.G || 0, p: sp.p, parts: sp.parts, tj: q.tj, tc: q.tc, tk: q.tk, dJC: q.dJC, dCK: q.dCK, dK: q.dK, rthTotal: ch2.rthTotal, steps: r && r.steps };
    }
    function stNow() { if (!stCache || stCache.rev !== ctlRev) stCache = { rev: ctlRev, v: steadyInfo(ctl) }; return stCache.v; }
    function steadyOf(c2) { const cf2 = spec.cfgOf(c2), ch2 = normChain(CORE.chain(cf2)); return ch2 ? steadyInfo(c2, cf2, ch2) : null; }
    function pzulFor(c2, cf2) {
      let v = NaN; try { const r = CORE.pzul(cf2, c2.ta); v = typeof r === 'number' ? r : pick(r, ['pzul', 'p', 'value'], NaN); } catch (e) { v = NaN; }
      const l2 = spec.limits(c2);
      if (!fin(v)) return 0;
      return Math.max(0, Math.min(v, l2.pNom));
    }

    // ---------- Kernschritt ----------
    function eNow() {   // momentane Leistung bei der aktuellen Temperatur (nach Defekt null)
      if (enCache && enCache.n === S.n && enCache.rev === ctlRev && enCache.d === S.destroyed) return enCache.v;
      let e = spec.electric(ctl, S.tj, ch);
      if (S.destroyed) { const z = {}; Object.keys(e).forEach(k => { z[k] = typeof e[k] === 'number' ? 0 : e[k]; }); e = z; }
      enCache = { n: S.n, rev: ctlRev, d: S.destroyed, v: e };
      return e;
    }
    let stepE = null, stepRev = -1;
    function coreStep() {
      const ta = ctl.ta;
      let p = 0;
      if (!S.destroyed) {
        let e;
        if (spec.tjDependent) e = spec.electric(ctl, S.tj, ch);
        else { if (stepRev !== ctlRev || !stepE) { stepE = spec.electric(ctl, S.tj, ch); stepRev = ctlRev; } e = stepE; }
        p = e.p; if (!fin(p) || p < 0) p = 0; else if (p > PMAX) p = PMAX;
      }
      S.p = p;
      th.step(STEP, p, ta);
      const q = temps(); S.tj = q[0]; S.tc = q[1]; S.tk = q[2];
      S.n++; S.t = S.n * STEP;   // Zeit aus der Schrittzahl: keine Rundungsdrift
      if (!S.destroyed && lim.destroyAt != null && S.tj >= lim.destroyAt) {
        S.destroyed = true; S.destroyT = S.t;
        say(DIAG_TEXT.defekt(lim, fmt), 'error', 'defekt', false, 'defekt');
      }
      if (S.n % REC === 0) tr.push(S.t, liveSample());
      if (S.n % 40 === 0) evaluate();
    }
    function liveSample() { return { t: S.t, tj: S.tj, tc: S.tc, tk: S.tk, ta: ctl.ta, p: S.p, tjMax: lim.tjMax }; }
    function stepProcess(dtS) {
      dtS = num(dtS, 0); if (dtS <= 0) return 0;
      S.acc += dtS;
      let n = Math.floor(S.acc / STEP + 1e-9);
      if (n > MAX_PROC_STEPS) n = MAX_PROC_STEPS;
      S.acc -= n * STEP; if (S.acc < 1e-9) S.acc = 0;
      if (S.acc > STEP * 1e6) S.acc = 0;
      for (let i = 0; i < n; i++) coreStep();
      return n;
    }
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      let dtS = dtMs / 1000 * TS;
      if ((S.acc + dtS) / STEP > MAX_FRAME_STEPS) {
        dtS = Math.max(0, MAX_FRAME_STEPS * STEP - S.acc); S.thr = true;
        if (!S.act.drossel) { S.act.drossel = 1; say((TR.zeitraffer || 'Zeitraffer gedrosselt') + ': Die Anlage rechnet nicht schneller, als der Rechner schafft.', 'info'); }
      } else if (S.thr) { S.thr = false; delete S.act.drossel; }
      stepProcess(dtS);
    }
    function settle() {
      if (S.destroyed) { say('Das Bauteil ist defekt: Setze den Prüfstand zurück.', 'warn'); return false; }
      const si = stNow();
      if (!si.ok) { say(spec.noSteadyText ? spec.noSteadyText(si, fmt) : 'Es gibt keinen Beharrungszustand.', 'warn'); return false; }
      if (typeof th.settle === 'function') { try { th.settle(si.p, ctl.ta); } catch (e) { th.step(1e7, si.p, ctl.ta); } } else th.step(1e7, si.p, ctl.ta);
      const q = temps(); S.tj = q[0]; S.tc = q[1]; S.tk = q[2]; S.p = si.p; enCache = null;
      if (lim.destroyAt != null && S.tj >= lim.destroyAt) { S.destroyed = true; S.destroyT = S.t; say(DIAG_TEXT.defekt(lim, fmt), 'error', 'defekt', false, 'defekt'); return true; }
      say((TR.beharrung || 'Beharrungszustand') + ': Alle Temperaturen sind eingeschwungen (' + SYM.tj + ' = ' + fmt(S.tj, 1) + ' °C).', 'info', null, false, 'settle');
      evaluate();
      return true;
    }

    // ---------- Messwerte ----------
    const dts = () => ({ dJC: S.tj - S.tc, dCK: S.tc - S.tk, dK: S.tk - ctl.ta });
    function readMeters() {
      const d = dts();
      const m = Object.assign({ tj: S.tj, tc: S.tc, tk: S.tk, rthTot: ch.rthTotal, pzul: pzulFor(ctl, cfg), dtJC: d.dJC, dtCK: d.dCK, dtK: d.dK }, spec.meterVals(E, S) || {});
      Object.keys(m).forEach(k => { if (!fin(m[k])) m[k] = 0; });
      return m;
    }

    // ---------- Meldungen (SPEC 4.8): THM_CORE.diagnose (einzige Quelle der Texte), dazu die Meldungen der Anlage ----------
    function coreCtxOf(X) {
      const c = X.ctl, cx = { cfg: X.cfg, p: X.p, ta: c.ta, tj: X.tj, tc: X.tc, tk: X.tk, destroyed: !!X.destroyed, set: symSet };
      if (spec.coreCtx) spec.coreCtx(X, cx);
      return cx;
    }
    function localDiag(X) {   // Rueckfall ohne THM_CORE.diagnose (gleiche Bedingungen, Texte nach SPEC 4.8)
      const out = [], add = (id, kind, text, fx) => out.push(fx ? { id, kind, text, fx } : { id, kind, text });
      const c = X.ctl, ta = c.ta, L = X.lim, kk = X.ch.mode === 'kk', f = fmt;
      const contact = c.joint === 'direkt' || c.bushing === false;
      if (X.destroyed) add('defekt', 'error', DIAG_TEXT.defekt(L, f), 'defekt');
      else if (X.tj > L.tjMax + 1e-9) add('heiss', 'error', DIAG_TEXT.heiss(L, f, X.tj), 'smoke');
      else if (L.tjMax - X.tj < 10 && X.p > 0) add('reserve', 'info', DIAG_TEXT.reserve(L, f, L.tjMax - X.tj));
      if (!kk && !X.destroyed && X.p > X.pzul + 1e-9) add('frei-zu-heiss', 'warn', DIAG_TEXT.freiZuHeiss(L, f, X.pzul, X.p));
      if (kk && X.cfg.paste === 'keine' && X.p > 0) {
        const c2 = normChain(CORE.chain(Object.assign({}, X.cfg, { paste: 'duenn' })));
        if (c2 && c2.rthCK < X.ch.rthCK - 1e-9) add('paste-fehlt', 'warn', DIAG_TEXT.pasteFehlt(f, X.ch.rthCK, c2.rthCK, X.p * (X.ch.rthCK - c2.rthCK)));
      }
      if (kk && X.ch.faults.indexOf('kurzschluss') >= 0) add('kurzschluss', 'error', DIAG_TEXT.kurzschluss(spec.potText ? spec.potText(c) : 'dem Anschluss der Fahne'), 'spark');
      if (kk && c.ksPot === 'frei' && contact && spec.fahneV && spec.fahneV(c) > 0) add('beruehr', 'warn', DIAG_TEXT.beruehr(f, spec.fahneV(c)));
      if (kk && X.cfg.screw === 'locker') { const c2 = normChain(CORE.chain(Object.assign({}, X.cfg, { screw: 'fest' }))); if (c2 && c2.rthCK < X.ch.rthCK - 1e-9) add('locker', 'warn', DIAG_TEXT.locker(f, c2.rthCK, X.ch.rthCK)); }
      if (kk && X.cfg.paste === 'dick') { const c2 = normChain(CORE.chain(Object.assign({}, X.cfg, { paste: 'duenn' }))); if (c2 && c2.rthCK < X.ch.rthCK - 1e-9) add('dick', 'info', DIAG_TEXT.dick(f, c2.rthCK, X.ch.rthCK)); }
      if (kk && X.cfg.fan === 'aus' && !X.destroyed && X.tj > L.tjMax + 1e-9) {
        const c3 = Object.assign({}, c, { fan: 'mittel' }), s3 = steadyOf(c3);
        if (s3 && s3.ok && s3.tj <= L.tjMax) add('luefter-hilft', 'info', DIAG_TEXT.luefterHilft(f, s3.tj));
      }
      if (kk && X.tk > 70) add('hand-heiss', 'info', DIAG_TEXT.handHeiss(f, X.tk));
      if (ta > 55) add('ta-hoch', 'info', DIAG_TEXT.taHoch(f, ta, kk));
      return out;
    }
    function evalDiag(X) {
      let list = null;
      if (typeof CORE.diagnose === 'function') {
        try { const r = CORE.diagnose(coreCtxOf(X)); if (Array.isArray(r)) list = r.map(d => Object.assign({}, d)); } catch (e) { list = null; }
      }
      if (!list) list = localDiag(X);
      const add = (id, kind, text, fx) => { const i = list.findIndex(d => d.id === id); const o = fx ? { id, kind, text, fx } : { id, kind, text }; if (i >= 0) list[i] = o; else list.push(o); };
      const del = (id) => { const i = list.findIndex(d => d.id === id); if (i >= 0) list.splice(i, 1); };
      const has = (id) => list.some(d => d.id === id);
      if (spec.diagPost) spec.diagPost(Object.assign({ sym: SYM }, X), list, add, del, fmt, has);
      list.sort((a, b) => SEV[a.kind] - SEV[b.kind]);
      return list;
    }
    function diagX() {
      const e = eNow();
      return { ctl, cfg, ch, lim, tj: S.tj, tc: S.tc, tk: S.tk, p: e.p, destroyed: S.destroyed, pzul: pzulFor(ctl, cfg), e, steady: stNow(), steadyOf, S };
    }
    function diagnose() {
      if (!S) return [];
      if (dgCache && dgCache.n === S.n && dgCache.rev === ctlRev) return dgCache.v;
      let out = [];
      try { out = evalDiag(diagX()); } catch (e) { out = []; }
      dgCache = { n: S.n, rev: ctlRev, v: out };
      return out;
    }
    // Meldungen fuer angenommene Werte (Beharrungszustand dieses Aufbaus), ohne den Pruefstand zu veraendern (Tests, Aufgaben)
    function diagFor(over) {
      const c2 = Object.assign({}, ctl, over || {}), cf2 = spec.cfgOf(c2), ch2 = normChain(CORE.chain(cf2)); if (!ch2) return [];
      const l2 = spec.limits(c2), si = steadyInfo(c2, cf2, ch2);
      const X = { ctl: c2, cfg: cf2, ch: ch2, lim: l2, tj: si.ok ? si.tj : l2.destroyAt, tc: si.tc, tk: si.tk, p: si.p, destroyed: false, pzul: pzulFor(c2, cf2), e: spec.electric(c2, si.ok ? si.tj : l2.destroyAt, ch2), steady: si, steadyOf, S: null };
      try { return evalDiag(X); } catch (e) { return []; }
    }
    function evaluate() {
      const list = diagnose(), now = {};
      list.forEach(d => {
        now[d.id] = 1;
        if (!S.act[d.id]) say(d.text, d.kind, d.fx, false, d.id);
        if (d.id === 'heiss' || d.id === 'kurzschluss') S.hotEver = true;
      });
      if (S.hotEver && !S.ding && !S.destroyed && !now.heiss && !now.kurzschluss && S.tj <= lim.tjMax && S.n > 0) { S.ding = true; say('Zurück im grünen Bereich: ' + fmt(S.tj, 1) + ' °C bei höchstens ' + fmt(lim.tjMax, 0) + ' °C.', 'info', 'ding', false, 'ding'); }
      S.act = Object.assign(now, S.thr ? { drossel: 1 } : {});
      S.last = list;
    }

    // ---------- Steuerwerte ----------
    const cfgKeysOf = (k) => MOUNT_KEYS.indexOf(k) >= 0 && k !== 'ta';
    function sync(key, old) { if (spec.sync) spec.sync(ctl, def, key, old, E); }
    function setControl(key, value) {
      const d = def[key];
      if (!d) return false;
      const c = coerce(d, value);
      if (!c.ok) return false;
      if (spec.accept && !spec.accept(key, c.v, ctl)) { say(MSG_NO, 'warn'); return false; }
      const old = ctl[key];
      if (old === c.v) return true;
      ctl[key] = c.v;
      sync(key, old);
      ctlRev++;
      if (spec.deviceKeys && spec.deviceKeys.indexOf(key) >= 0) { deviceRev++; initState(); sync(key, old); ctlRev++; }
      else if (cfgKeysOf(key)) { rebuild(true); say('Montage geändert.', 'info', 'tick', true); }
      else if (spec.cfgKeys && spec.cfgKeys.indexOf(key) >= 0) rebuild(true);
      stCache = null; idCache = null; dgCache = null; enCache = null;
      return true;
    }
    const getControl = (key) => def[key] ? ctl[key] : undefined;
    function applyPreset(id) {
      const p = spec.presets.find(q => q.id === id); if (!p) return false;
      defs.forEach(c => { ctl[c.key] = c.value; });
      if (spec.resetDefs) spec.resetDefs(ctl, def);
      const vals = (p.params && p.params.controls) || p.params || {};
      const first = ['device', 'pulse'], keys = Object.keys(vals);
      const ordered = first.filter(k => keys.indexOf(k) >= 0).concat(keys.filter(k => first.indexOf(k) < 0));
      sync(null);
      ordered.forEach(k => { const d = def[k]; if (!d) return; const c = coerce(d, vals[k]); if (c.ok && (!spec.accept || spec.accept(k, c.v, ctl))) { const old = ctl[k]; ctl[k] = c.v; sync(k, old); } });
      sync(null);
      deviceRev++; initState(); return true;
    }
    function reset() { initState(); }

    // ---------- Kennwerte ----------
    const sigOfCtl = () => JSON.stringify(ctl);
    function identify() {
      const key = ctlRev + '|' + sigOfCtl();
      if (idCache && idCache.key === key) return idCache.val;
      const si = stNow();
      let tauDom = NaN, tauList = [];
      try { const t2 = CORE.thermal(cfg); if (typeof t2.tauDominant === 'function') { const v = t2.tauDominant(); tauDom = typeof v === 'number' ? v : pick(v, ['tau', 'value'], NaN); } if (typeof t2.tauList === 'function') { const tl = t2.tauList(); if (Array.isArray(tl)) tauList = tl.slice(); } } catch (e) { /* ohne Zeitkonstante */ }
      let tau63 = NaN;
      if (si.ok && si.tj - ctl.ta > 1e-6) {
        try {   // gleiche Rueckkopplung wie der Kernschritt, nur groeberer Schritt (Schattenlauf aus kalt)
          const t2 = CORE.thermal(cfg); if (typeof t2.reset === 'function') t2.reset(ctl.ta);
          const rd2 = stateReader(t2.state()), hs = Math.max(STEP, fin(tauDom) ? tauDom / 500 : 1), target = ctl.ta + 0.632120558828558 * (si.tj - ctl.ta);
          let tj = ctl.ta, t = 0, prev = ctl.ta, tprev = 0;
          const tmax = (fin(tauDom) ? tauDom : 3600) * 40;
          while (t < tmax) {
            const e = spec.electric(ctl, tj, ch), p = e.p > PMAX ? PMAX : e.p;
            t2.step(hs, p, ctl.ta); tprev = t; prev = tj; t += hs;
            tj = rd2(t2.state())[0];
            if (tj >= target) { tau63 = tprev + hs * (target - prev) / ((tj - prev) || 1); break; }
          }
        } catch (e) { tau63 = NaN; }
      }
      let rk = null;
      if (si.ok && si.p > 0 && typeof CORE.rthKerf === 'function') { try { const r = CORE.rthKerf(cfg, si.p, ctl.ta); rk = r && typeof r === 'object' ? { ok: r.ok !== false, kind: r.kind, value: pick(r, ['value', 'rthK', 'rthKerf', 'rth'], NaN), why: r.why } : { ok: true, value: +r }; } catch (e) { rk = null; } }
      const val = { ok: true, tau: fin(tauDom) ? tauDom : null, tau63: fin(tau63) ? tau63 : null, tauList, tjSteady: si.ok ? si.tj : null, pSteady: si.p, pzul: pzulFor(ctl, cfg), rthKerf: rk, runaway: !!si.runaway, G: si.G };
      idCache = { key, val };
      return val;
    }

    // ---------- Anzeige-Daten ----------
    const shapeOf = () => spec.shape(ctl);
    function drawData(t, rdc) {
      const si = stNow(), d = dts(), kk = ch.mode === 'kk', ta = ctl.ta;
      let frac = 1;
      if (si.ok && si.tj - ta > 0.05) frac = clamp((S.tj - ta) / (si.tj - ta), 0, 1);
      const hs = kk ? ctl.heatsink : 'none';
      const k = S.destroyed ? 0 : S.tj > lim.tjMax ? clamp(0.25 + (S.tj - lim.tjMax) / 40, 0, 1) : 0;
      let analogie = null;
      try { if (CORE.analogie && typeof CORE.analogie.resolved === 'function') analogie = CORE.analogie.resolved(symSet).map(a => [a.elek, a.therm]); } catch (e) { analogie = null; }
      return {
        view, t: num(t, 0), reduced: !!rdc, shape: shapeOf(), shapeName: spec.shapeName(ctl), deviceName: spec.deviceName(ctl), noun: lim.noun,
        tj: S.tj, tc: S.tc, tk: S.tk, ta, tjMax: lim.tjMax, lo: ta, hi: lim.tjMax + 30, p: eNow().p, mode: ch.mode, singleNode: !!spec.singleNode(ctl),
        rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: ch.rthK, rthTotal: ch.rthTotal, dJC: d.dJC, dCK: d.dCK, dK: d.dK,
        mount: { heatsink: hs, joint: ctl.joint, paste: ctl.paste, bushing: !!ctl.bushing, screw: ctl.screw, fan: kk ? ctl.fan : 'aus', orient: ctl.orient, ksPot: ctl.ksPot, blechA: ctl.blechA },
        fanFactor: fanF(kk ? ctl.fan : 'aus'), orientFactor: orientF(ctl.orient), cth: ch.cth, steadyFrac: frac, smoke: k, destroyed: S.destroyed,
        short: kk && ch.faults.indexOf('kurzschluss') >= 0, cursor: null, analogie, f: fmt, sym: SYM
      };
    }
    // Aufbau-Objekt fuer THM_DRAW (Schema im Kopf von thmdraw.js; wie thmrig-linear.js; freistehend: rthK 0, rthCA, dCA)
    let layoutNow = layout(1000, 640), layoutScale = 1;
    function aufbau(D) {
      const frei = D.mode === 'frei', dv = (CORE.devices && CORE.devices[spec.deviceKey(ctl)]) || {}, tab = dv.tab || {};
      let hsName = '';
      if (!frei) { try { hsName = ctl.heatsink === 'blech' ? 'Kühlblech ' + fmt(ctl.blechA, 0) + ' cm²' : ((CORE.heatsinks && CORE.heatsinks.byId && CORE.heatsinks.byId[ctl.heatsink]) || {}).name || HS_NAME[ctl.heatsink] || ''; } catch (e) { hsName = HS_NAME[ctl.heatsink] || ''; } }
      let jn = ''; try { const o = CORE.mount && CORE.mount.options && CORE.mount.options.joint ? CORE.mount.options.joint.find(q => q.value === ctl.joint) : null; jn = o ? o.label : JOINT_NAME[ctl.joint]; } catch (e) { jn = JOINT_NAME[ctl.joint]; }
      return {
        device: spec.deviceKey(ctl), deviceName: spec.deviceName(ctl), pkg: PKG_OF[D.shape] || 'TO-220', mode: D.mode, count: 1, heatsink: D.mount.heatsink, blechA: ctl.blechA, joint: ctl.joint, paste: ctl.paste, bushing: !!ctl.bushing, screw: ctl.screw, ksPot: ctl.ksPot, fan: D.mount.fan, orient: ctl.orient,
        P: D.p, ta: D.ta, tj: D.tj, tc: D.tc, tk: frei ? D.tc : D.tk, tjMax: D.tjMax, tL: D.tc,
        rthJC: D.rthJC, rthCK: frei ? 0 : D.rthCK, rthK: frei ? 0 : D.rthK, rthTotal: D.rthTotal, rthCA: frei ? D.rthK : 0, fanFactor: D.fanFactor, orientFactor: D.orientFactor,
        dJC: D.dJC, dCK: frei ? 0 : D.dCK, dK: frei ? 0 : D.dK, dCA: frei ? D.tc - D.ta : 0, cth: D.cth, shutdown: false, destroyed: D.destroyed, short: D.short, level: D.steadyFrac, t: D.t / 1000,
        lo: D.lo, hi: D.hi, sym: { tj: SYM.tj, tc: SYM.tc, tk: SYM.tk, ta: SYM.ta, rthJC: SYM.rthJC, rthCK: SYM.rthCK, rthK: SYM.rthK, rthJA: SYM.rthJA, P: SYM.P, tjMax: SYM.tjMax },
        heatsinkName: hsName, jointName: jn || '', fahneText: tab.potText || '', ksText: ctl.ksPot === 'masse' ? 'Masse' : 'frei', reduced: D.reduced, colors: PAL_NOW, compact: layoutNow.view.w * layoutScale < 520,
        fin: finOf(D)
      };
    }
    function finOf(D) {   // Rippentemperaturen vom Fuss zur Spitze (nur Profile s, m, l, xl; THM_CORE.heatsink.finProfile)
      if (D.mode !== 'kk' || ['s', 'm', 'l', 'xl'].indexOf(ctl.heatsink) < 0) return undefined;
      try { const fp = CORE.heatsink && CORE.heatsink.finProfile; if (typeof fp !== 'function') return undefined; const r = fp(ctl.heatsink, D.tk, D.ta, 12); const a = Array.isArray(r) ? r : (r && Array.isArray(r.t) ? r.t : null); return a && a.length >= 2 && a.every(fin) ? a : undefined; } catch (e) { return undefined; }
    }
    function mountText() {
      const kk = ch.mode === 'kk';
      if (!kk) return 'freistehend';
      const hsn = ctl.heatsink === 'blech' ? 'Kühlblech ' + fmt(ctl.blechA, 0) + ' cm²' : HS_NAME[ctl.heatsink];
      return hsn + ' · ' + JOINT_NAME[ctl.joint] + ' · ' + PASTE_NAME[ctl.paste] + (ctl.screw === 'locker' ? ' · Schraube locker' : '') + ' · Lüfter ' + ctl.fan + ' · ' + (ctl.orient === 'waagrecht' ? 'waagrecht' : 'senkrecht');
    }

    // ---------- Bedienelemente im Bild: Lage (Weltmass) und Treffer ----------
    function widgets(L) {
      const out = { knobs: [], toggles: [] };
      const kn = (spec.knobs ? spec.knobs(E) : []).filter(k => def[k.key]), tg = (spec.toggles ? spec.toggles(E) : []).slice(0, 4);
      const cr = L.ctrl, nK = Math.max(1, kn.length), kr = 22;
      const kx0 = L.portrait ? cr.x + 6 : cr.x, kw = L.portrait ? cr.w * 0.55 - 6 : cr.w, ky = L.portrait ? cr.y + 64 : cr.y + 52;
      kn.forEach((k, i) => {
        const v = clamp(ctl[k.key], k.lo, k.hi);
        const f = k.log ? Math.log(v / k.lo) / Math.log(k.hi / k.lo) : (v - k.lo) / ((k.hi - k.lo) || 1);
        out.knobs.push({ key: k.key, cx: kx0 + (kw / nK) * (i + 0.5), cy: ky, r: kr, f: clamp(f, 0, 1), lo: k.lo, hi: k.hi, step: k.step, log: !!k.log, label: k.label, text: k.fmt(ctl[k.key]), value: v, unit: k.unit || '', digits: k.digits });
      });
      const nT = Math.max(1, tg.length);
      tg.forEach((s, i) => {
        const cx = L.portrait ? cr.x + cr.w * 0.55 + 52 + (i % 2) * 86 : cr.x + (cr.w / nT) * (i + 0.5), cy = L.portrait ? cr.y + 30 + Math.floor(i / 2) * 56 : cr.y + 124;
        out.toggles.push({ key: s.key, label: L.portrait && s.short ? s.short : s.label, on: s.isOn(), onVal: s.onVal, offVal: s.offVal, cx, cy });
      });
      return out;
    }
    function hitTest(px, py, w, h) {
      try {
        const L = layout(w, h), p = toWorld(px, py, w, h, L.W, L.H); if (!p) return null;
        const wg = widgets(L);
        for (const t of wg.toggles) {
          if (p.x >= t.cx - 34 && p.x <= t.cx + 34 && p.y >= t.cy - 22 && p.y <= t.cy + 26) { const to = t.on ? t.offVal : t.onVal; return { key: t.key, kind: 'switch', value: to, to }; }
        }
        for (const k of wg.knobs) {
          const dx = p.x - k.cx, dy = p.y - k.cy;
          if (dx * dx + dy * dy <= (k.r + 16) * (k.r + 16)) return { key: k.key, kind: 'knob' };
        }
        return null;
      } catch (e) { return null; }
    }
    function hotspots(w, h) {   // fuer Tests: Treffbereiche in Weltmass
      const L = layout(w, h), wg = widgets(L);
      return wg.knobs.map(k => ({ key: k.key, kind: 'knob', cx: k.cx, cy: k.cy, r: k.r })).concat(wg.toggles.map(t => ({ key: t.key, kind: 'switch', cx: t.cx, cy: t.cy })));
    }

    // ---------- Zeichnen ----------
    function cellsOf(L) {
      const d = dts(), mm = readMeters(), tjCol = S.destroyed ? COL.bad : S.tj > lim.tjMax ? COL.bad : S.tj > lim.tjMax - 10 ? COL.warn : COL.ok;
      const kk = ch.mode === 'kk';
      const own3 = spec.cells ? spec.cells(E, S) : [];
      const all = own3.concat([
        [SYM.tj + ' ' + lim.noun, fmt(S.tj, 1) + ' °C', tjCol], [SYM.tc + ' Gehäuse', fmt(S.tc, 1) + ' °C', COL.text], [kk ? SYM.tk + ' Kühlkörper' : 'Kühlfläche = ' + SYM.tc, kk ? fmt(S.tk, 1) + ' °C' : fmt(S.tc, 1) + ' °C', COL.text],
        ['Rth_ges (' + SYM.tj + '–' + SYM.ta + ')', fmt(ch.rthTotal, 2) + ' K/W', COL.text], ['P_zul bei ' + fmt(ctl.ta, 0) + ' °C', fmt(mm.pzul, 2) + ' W', COL.text],
        ['Reserve bis ' + SYM.tjMax, fmt(lim.tjMax - S.tj, 1) + ' K', lim.tjMax - S.tj < 0 ? COL.bad : lim.tjMax - S.tj < 10 ? COL.warn : COL.ok],
        ['ΔT Chip → Gehäuse', fmt(d.dJC, 1) + ' K', MEMBER_COL.jc], [kk ? 'ΔT Paste + Scheibe' : 'ΔT Übergang', kk ? fmt(d.dCK, 1) + ' K' : '–', MEMBER_COL.ck], [kk ? 'ΔT Kühlkörper → Luft' : 'ΔT Gehäuse → Luft', fmt(d.dK, 1) + ' K', MEMBER_COL.k]
      ]);
      return all.slice(0, L.cells.cols * L.cells.rows);
    }
    function draw(ctx, w, h, t) {
      t = num(t, 0);
      const L = layout(w, h), s = frame(ctx, w, h, L.W, L.H); if (!s) return;
      layoutNow = L; layoutScale = s;
      try {
        FZ_MIN = s < 1 ? Math.min(17, 12.3 / s) : 0;
        applyTheme(themeOpt, colorsOver); refreshSym();
        const rdc = reduced !== undefined ? !!reduced : (function () { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } })();
        const D = drawData(t, rdc);
        if (view === 'kamera' && pointer && fin(pointer.x) && fin(pointer.y)) { const wp = toWorld(pointer.x, pointer.y, w, h, L.W, L.H); if (wp && wp.x >= L.view.x && wp.x <= L.view.x + L.view.w && wp.y >= L.view.y && wp.y <= L.view.y + L.view.h) D.cursor = { x: wp.x - L.view.x, y: wp.y - L.view.y }; }
        const A = aufbau(D);
        // Kopf
        const ttl = L.portrait ? spec.shortTitle : spec.title, pz = 'Prozesszeit ' + tmin(fmt, S.t);
        txt(ctx, fitText(ttl, L.W - 40 - tw(pz, 14, '700'), L.portrait ? 18 : 20, '800'), 16, 20, L.portrait ? 18 : 20, COL.text, 'left', '800');
        txt(ctx, pz, L.W - 16, 20, 14, COL.dim, 'right', '700');
        txt(ctx, fitText(spec.deviceName(ctl) + ' · ' + mountText() + ' · ' + SYM.ta + ' ' + fmt(ctl.ta, 0) + ' °C', L.W - 32, 13, '600'), 16, 42, 13, COL.dim, 'left', '600');
        // Ansicht (Rahmen und Inhalt)
        try { drawView(ctx, view, L.view, D, A, s); } catch (e) { drawErr = String(e && e.message || e); try { ctx.restore(); } catch (e2) { /* nichts */ } txt(ctx, 'Ansicht nicht verfügbar', L.view.x + 14, L.view.y + 24, 14, COL.bad, 'left', '700'); }
        // Szene und Thermometer
        panel(ctx, L.scene.x, L.scene.y, L.scene.w, L.scene.h, 12);
        ctx.save(); rr(ctx, L.scene.x + 1, L.scene.y + 1, L.scene.w - 2, L.scene.h - 2, 11); ctx.clip();
        try { spec.scene(ctx, L.scene, E, D, t, L); } catch (e) { drawErr = String(e && e.message || e); }
        ctx.restore();
        panel(ctx, L.therm.x, L.therm.y, L.therm.w, L.therm.h, 12);
        wThermo(ctx, L.therm.x + L.therm.w / 2 + 4, L.therm.y + 34, L.therm.h - 70, { value: S.tj, lo: D.lo, hi: D.hi, tjMax: lim.tjMax, shut: NaN, destroyed: S.destroyed, name: SYM.tj }, s);
        // Bedienpult im Bild
        panel(ctx, L.ctrl.x, L.ctrl.y, L.ctrl.w, L.ctrl.h, 12);
        const wg = widgets(L);
        wg.knobs.forEach(k => wKnob(ctx, k, s));
        wg.toggles.forEach(q => wToggle(ctx, q, s));
        // Zellen
        const cl = cellsOf(L), C = L.cells, gap = 6, cwid = (C.w - gap * (C.cols - 1)) / C.cols, chh = (C.h - gap * (C.rows - 1)) / C.rows;
        cl.forEach((c, i) => {
          const col = i % C.cols, row = Math.floor(i / C.cols), x = C.x + col * (cwid + gap), y = C.y + row * (chh + gap);
          rr(ctx, x, y, cwid, chh, 9); ctx.fillStyle = COL.panel; ctx.fill(); ctx.strokeStyle = COL.line; ctx.lineWidth = 1.2; ctx.stroke();
          if (L.portrait) { txt(ctx, c[0], x + 10, y + chh / 2, 12, COL.dim, 'left', '600'); txt(ctx, c[1], x + cwid - 10, y + chh / 2, 15, c[2] || COL.text, 'right', '800'); }
          else { txt(ctx, c[0], x + 12, y + chh * 0.3, 12, COL.dim, 'left', '600'); txt(ctx, c[1], x + 12, y + chh * 0.7, 20, c[2] || COL.text, 'left', '800'); }
        });
        if (S.destroyed) { rr(ctx, L.view.x + L.view.w / 2 - 110, L.view.y + 8, 220, 28, 8); ctx.fillStyle = 'rgba(180,30,30,0.92)'; ctx.fill(); txt(ctx, 'DEFEKT: zurücksetzen', L.view.x + L.view.w / 2, L.view.y + 22, 14, '#ffffff', 'center', '800'); }
        if (S.thr) txt(ctx, TR.zeitraffer || 'Zeitraffer gedrosselt', L.W - 16, 42, 12, COL.warn, 'right', '700');
      } catch (e) { drawErr = String(e && e.message || e); }
      ctx.restore();
    }

    // ---------- Kennlinien und Schreiber ----------
    function curves() { return spec.curves(E, S); }
    function spanOf() { const hs = ch.mode === 'kk' ? ctl.heatsink : 'none'; return (hs === 'l' || hs === 'xl') ? 7200 : (hs === 's' || hs === 'm' || hs === 'blech') ? 3600 : 1800; }
    function traceOut(spanS) {
      const sp = fin(spanS) && spanS > 0 ? spanS : spanOf();
      const d = tr.get(S.t - sp, 600, liveSample());
      return { t: d.t, tj: d.tj, tc: d.tc, tk: d.tk, ta: d.ta, p: d.p, tjMax: lim.tjMax, shut: null, extra: { tjMax: d.tjMax, p: d.p } };
    }
    function state() {
      const m = readMeters(), d = dts(), si = stNow(), e = eNow();
      const base = {
        t: S.t, device: ctl.device !== undefined ? ctl.device : spec.deviceKey(ctl), deviceId: spec.deviceKey(ctl), pv: e.p, tj: S.tj, tc: S.tc, tk: S.tk, ta: ctl.ta, rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: ch.rthK, rthTotal: ch.rthTotal,
        dJC: d.dJC, dCK: d.dCK, dK: d.dK, pzul: m.pzul, mode: ch.mode, shutdown: false, shutCount: 0, destroyed: S.destroyed, short: ch.mode === 'kk' && ch.faults.indexOf('kurzschluss') >= 0,
        tjMax: lim.tjMax, faults: diagnose().filter(q => q.kind !== 'info').map(q => q.id), tau: (identify().tau || 0), timeScale: TS, tUnit: 'min', thr: S.thr, throttled: S.thr,
        tjSteady: si.ok ? si.tj : lim.destroyAt, runaway: !!si.runaway, view
      };
      const ex = spec.stateExtra ? spec.stateExtra(E, S) : {};
      const out = Object.assign({}, ctl, base, ex);
      Object.keys(out).forEach(k => { if (typeof out[k] === 'number' && !fin(out[k])) out[k] = 0; });
      return out;
    }
    function recipeSteps(r) {   // Schritte des Kerns als Text (die Oberflaeche zeigt Zeichenketten)
      return r.steps.map(q => typeof q === 'string' ? q : (q && typeof q === 'object' ? ((q.n != null ? q.n + '. ' : '') + (q.title ? q.title + ': ' : '') + (Array.isArray(q.lines) ? q.lines.join(' ') : (q.text || ''))).trim() : String(q)));
    }
    function analysis() {
      const si = stNow(), P = si.ok ? si.p : 0, pz = pzulFor(ctl, cfg);
      if (typeof CORE.recipe === 'function' && si.ok) {
        try { const inp = { cfg, device: spec.deviceKey(ctl), ta: ctl.ta, p: P }; const r = CORE.recipe(inp); if (r && r.ok !== false && Array.isArray(r.steps) && r.steps.length) return { ok: true, steps: recipeSteps(r), result: r.result || {}, warn: Array.isArray(r.warn) ? r.warn.slice() : [] }; } catch (e) { /* Rueckfall */ }
      }
      const kk = ch.mode === 'kk', steps = [];
      steps.push('Verlustleistung P = ' + fmt(P, 2) + ' W');
      steps.push(kk ? SYM.rthJC + ' + ' + SYM.rthCK + ' + ' + SYM.rthK + ' = ' + fmt(ch.rthJC, 2) + ' + ' + fmt(ch.rthCK, 2) + ' + ' + fmt(ch.rthK, 2) + ' = ' + fmt(ch.rthTotal, 2) + ' K/W' : SYM.rthJA + ' = ' + fmt(ch.rthTotal, 2) + ' K/W');
      steps.push(SYM.tj + ' = ' + SYM.ta + ' + P · Rth_ges = ' + fmt(ctl.ta, 1) + ' + ' + fmt(P, 2) + ' · ' + fmt(ch.rthTotal, 2) + ' = ' + fmt(si.tj, 1) + ' °C');
      steps.push('Vergleich: ' + SYM.tjMax + ' = ' + fmt(lim.tjMax, 0) + ' °C, Reserve ' + fmt(lim.tjMax - si.tj, 1) + ' K: ' + (si.tj <= lim.tjMax ? 'in Ordnung' : 'zu heiß'));
      return { ok: si.ok, steps, result: { p: P, rthTotal: ch.rthTotal, tj: si.tj, tc: si.tc, tk: si.tk, pzul: pz, reserve: lim.tjMax - si.tj }, warn: diagnose().filter(q => q.kind !== 'info').map(q => q.text) };
    }
    function steadyOut() {
      const si = stNow();
      return { ok: si.ok, tj: si.tj, tc: si.tc, tk: si.tk, pv: si.p, p: si.p, rthTotal: si.rthTotal, dJC: si.dJC, dCK: si.dCK, dK: si.dK, runaway: !!si.runaway, G: si.G, parts: si.parts, steps: si.steps };
    }

    // ---------- Aufbau ----------
    const E = {
      CORE, ctl, def, fmt, SYM, spec, layout, opts,
      get S() { return S; }, get ch() { return ch; }, get cfg() { return cfg; }, get lim() { return lim; }, get ctlRev() { return ctlRev; },
      stNow, steadyInfo, steadyOf, pzulFor, chainOf, dts, view: () => view, fanF, orientF, readMeters, say, mountText, eNow, meters
    };
    sync(null);
    initState();
    sync(null);
    const rig = {
      get id() { return spec.id; },
      get range() { return { lo: 0, hi: lim.tjMax + 30, unit: '°C', digits: 0 }; },
      get timeScale() { return TS; }, get tUnit() { return 'min'; }, get h() { return STEP; },
      get params() { return Object.assign({}, spec.params ? spec.params(ctl) : {}, { tjMax: lim.tjMax, destroyAt: lim.destroyAt, step: STEP, timeScale: TS }); },
      get presets() { return spec.presets; }, get deviceRev() { return deviceRev; }, get spanS() { return spanOf(); },
      get view() { return view; }, set view(v) { if (VIEW_FN[v]) view = v; },
      get symSet() { return symSet; }, set symSet(v) { symSet = v === 'de' ? 'de' : 'db'; refreshSym(); },
      get reduced() { return reduced; }, set reduced(v) { reduced = v === undefined ? undefined : !!v; },
      get pointer() { return pointer; }, set pointer(v) { pointer = v && typeof v === 'object' ? v : null; },
      get theme() { return themeOpt; }, set theme(v) { themeOpt = v === 'light' || v === 'dark' ? v : 'auto'; },
      get colors() { return colorsOver; }, set colors(v) { colorsOver = v && typeof v === 'object' ? v : null; },
      controls: defs, meters, events: ev.list,
      setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, hotspots, curves, reset, settle,
      worldSize: worldOf, drawError() { return drawErr; },
      steady: steadyOut, chain() { return Object.assign({}, ch); }, cfg() { return JSON.parse(JSON.stringify(cfg)); },
      analysis, identify, diagnose, diagFor, applyPreset, trace: traceOut,
      thermalInfo() { return { P: eNow().p, rth: { jc: ch.rthJC, ck: ch.rthCK, k: ch.rthK }, ta: ctl.ta, cth: Object.assign({}, ch.cth), tjMax: lim.tjMax }; },
      drawData(t) { return aufbau(drawData(t, !!reduced)); }
    };
    return rig;
  }

  // Meldungstexte des Rueckfalls (SPEC 4.8; mit THM_CORE.diagnose stammen die Texte aus dem Kern)
  const DIAG_TEXT = {
    heiss: (L, f, tj) => 'Die ' + L.noun + ' ist mit ' + f(tj, 1) + ' °C heißer als erlaubt (' + f(L.tjMax, 0) + ' °C): Das Bauteil wird geschädigt. Verkleinere die Verlustleistung oder den Wärmewiderstand.',
    reserve: (L, f, k) => 'Die Reserve beträgt nur ' + f(k, 1) + ' K bis zur zulässigen ' + L.tempWord + '.',
    defekt: (L, f) => 'Bauteil defekt: Die ' + L.noun + ' war zu heiß. Setze den Prüfstand zurück.',
    freiZuHeiss: (L, f, pz, p) => 'Freistehend darfst du höchstens ' + f(pz, 1) + ' W umsetzen, du hast ' + f(p, 1) + ' W. ' + (L.freeHint || 'Du brauchst einen Kühlkörper.'),
    pasteFehlt: (f, x, y, dT) => 'Ohne Wärmeleitpaste ist Rth_CK = ' + f(x, 2) + ' K/W statt ' + f(y, 2) + ' K/W mit Paste: Die Sperrschicht ist ' + f(dT, 1) + ' K heißer.',
    kurzschluss: (pot) => 'Kurzschluss: Die Fahne des Bauteils liegt ' + pot + '.',
    beruehr: (f, u) => 'Der Kühlkörper führt Spannung (' + f(u, 0) + ' V gegen Masse). Isoliere ihn oder baue ihn berührgeschützt ein.',
    locker: (f, x, y) => 'Die Schraube ist locker: Rth_CK steigt von ' + f(x, 2) + ' auf ' + f(y, 2) + ' K/W.',
    dick: (f, x, y) => 'Zu viel Wärmeleitpaste: Rth_CK steigt von ' + f(x, 2) + ' auf ' + f(y, 2) + ' K/W. Trage sie dünn auf.',
    luefterHilft: (f, tj) => 'Ein Lüfter (mittel) würde Tj auf ' + f(tj, 1) + ' °C senken.',
    handHeiss: (f, tk) => 'Der Kühlkörper ist ' + f(tk, 0) + ' °C heiß: Berührungsgefahr.',
    taHoch: (f, ta, kk) => 'Im Gerät ist es warm: Die Umgebung für ' + (kk ? 'den Kühlkörper' : 'das Bauteil') + ' ist ' + f(ta, 0) + ' °C.'
  };

  // ===== Pruefstand 3: mosfet – MOSFET als Schalter (IRLZ34N), SPEC 5.3 =====
  // Verlustleistung: P_leit = D·I²·RDS(on)(Tj), P_sw = ½·U·I·(tr + tf)·f (nur beim Schalten, 0 < D < 1), P = P_leit + P_sw.
  // Waerme: THM_CORE.chain/steady/thermal (exakter Schritt); die Rueckkopplung RDS(on)(Tj) wird im Kernschritt h = 0,25 s nachgefuehrt,
  // der Beharrungswert ist die geschlossene Loesung P = (P_leit,25·(1 + α·(Ta − 25)) + P_sw)/(1 − G), G = P_leit,25·α·Rth_ges (G >= 1: Weglaufen).
  const ID = 'mosfet';
  // Zahlen aus dslib-semi.js (tf-irlz): RDS(on) typ/max bei VGS 4,5/5/10 V, tr, tf bei VDD 28 V, RG 4,5 Ω; α aus dem Faktor 1,65 bei 125 °C (test_thmrig_b.js prueft)
  const FB = {
    rds: { typ: { '4.5': 0.040, '5': 0.037, '10': 0.028 }, max: { '4.5': 0.050, '5': 0.046, '10': 0.035 } },
    alpha: 0.65 / 100, tr: 100e-9, tf: 45e-9, tjMax: 175, destroyAt: 200, idRec: 20, idm: 100, idmTp: 80e-6, vdsRec: 44, vdsAbs: 55
  };
  // Werte aus THM_CORE.devices.irlz34n (einzige Quelle); fehlt der Kern, gelten die Datenblattwerte FB (test_thmrig_b.js vergleicht beide)
  function elecOf(CORE) {
    let dv = {}; try { dv = (CORE && CORE.devices && CORE.devices.irlz34n) || {}; } catch (e) { dv = {}; }
    const lim = dv.limits || {}, g = (v, d) => fin(v) ? v : d;
    return {
      rds: { typ: Object.assign({}, FB.rds.typ, dv.rdsTyp), max: Object.assign({}, FB.rds.max, dv.rdsMax) },
      alpha: g(dv.alpha, FB.alpha), tr: g(dv.tr, FB.tr), tf: g(dv.tf, FB.tf), tjMax: g(dv.tjMax, FB.tjMax), destroyAt: g(dv.destroyAt, FB.destroyAt),
      idRec: g(lim.iRec, FB.idRec), idm: FB.idm, idmTp: FB.idmTp, vdsRec: g(lim.vdsRec, FB.vdsRec), vdsAbs: g(lim.vdsAbs, FB.vdsAbs)
    };
  }
  let ELEC = FB;
  const VGS_OPT = [O(4.5, '4,5 V'), O(5, '5 V'), O(10, '10 V')];
  const F_OPT = [O(100, '100 Hz'), O(1000, '1 kHz'), O(20000, '20 kHz'), O(100000, '100 kHz')];
  const TP_OPT = [O(0.001, '1 ms'), O(0.01, '10 ms'), O(0.1, '100 ms'), O(1, '1 s')];
  const TP_PER = [O(0.01, '10 ms'), O(0.1, '100 ms'), O(1, '1 s'), O(10, '10 s')];
  const OWN = [
    { key: 'id', label: 'Laststrom ID', type: 'slider', min: 0, max: 20, step: 0.5, unit: 'A', value: 5, help: 'Strom durch den eingeschalteten MOSFET. Die Leitverluste wachsen mit dem Quadrat des Stromes: Doppelter Strom gibt vierfache Verlustleistung.' },
    { key: 'u', label: 'Betriebsspannung U', type: 'slider', min: 5, max: 44, step: 1, unit: 'V', value: 24, help: 'Spannung am Schalter im ausgeschalteten Zustand. Sie bestimmt die Schaltverluste, nicht die Leitverluste.' },
    { key: 'duty', label: 'Tastgrad D', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 100, visible: (s) => !s.pulse, help: 'Anteil der Periode, in dem der MOSFET leitet. 100 % ist Dauerlast ohne Schalten, darunter schaltet er mit der gewählten Frequenz.' },
    { key: 'f', label: 'Schaltfrequenz f', type: 'select', value: 20000, options: F_OPT, visible: (s) => !s.pulse && s.duty < 100, help: 'Schaltfrequenz der PWM. Bei jedem Schaltvorgang entstehen Verluste: Die Schaltverluste wachsen linear mit f.' },
    { key: 'vgs', label: 'Gate-Spannung VGS', type: 'select', value: 5, options: VGS_OPT, help: 'Steuerspannung am Gate (Betriebswert, nicht die Schwellspannung). Je größer VGS, desto kleiner RDS(on).' },
    { key: 'spec', label: 'RDS(on) aus dem Datenblatt', type: 'select', value: 'typ', options: [O('typ', 'typisch (typ.)'), O('max', 'Höchstwert (max.), Prüfungsauslegung')], help: 'Typischer Wert oder Höchstwert aus dem Datenblatt. Mit dem Höchstwert rechnest du auf der sicheren Seite.' },
    { key: 'hot', label: 'RDS(on) steigt mit Tj', type: 'switch', value: true, help: 'An: RDS(on) wächst mit der Sperrschichttemperatur (Faktor 1,65 bei 125 °C). Aus: Du rechnest mit dem kalten Wert.' },
    { key: 'pulse', label: 'Impulsbetrieb', type: 'switch', value: false, help: 'Vertiefung: Die Last kommt als Impuls (Dauer tp, Periode T) statt als Dauerbetrieb. Die Simulation läuft mit der mittleren Leistung, die Spitze steht im Messgerät.' },
    { key: 'tp', label: 'Impulsdauer tp', type: 'select', value: 0.001, options: TP_OPT, visible: (s) => !!s.pulse, help: 'Dauer eines Impulses.' },
    { key: 'T', label: 'Periode T', type: 'select', value: 0.1, options: TP_PER, visible: (s) => !!s.pulse, help: 'Zeit von Impuls zu Impuls. Ist tp so lang wie T, ist es Dauerbetrieb.' }
  ];
  const METERS = [
    { key: 'pLeit', label: 'Leitverluste P_leit', unit: 'W', digits: 2, min: 0, max: 40 },
    { key: 'pSw', label: 'Schaltverluste P_sw', unit: 'W', digits: 2, min: 0, max: 10 },
    { key: 'pTotal', label: 'Verlustleistung P', unit: 'W', digits: 2, min: 0, max: 40 },
    { key: 'rdsHot', label: 'RDS(on) bei Tj', unit: 'Ω', digits: 3, min: 0, max: 0.2 },
    { key: 'tj', label: 'Sperrschichttemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'tc', label: 'Gehäusetemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'tk', label: 'Kühlkörpertemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'rthTot', label: 'Gesamt-Wärmewiderstand', unit: 'K/W', digits: 2, min: 0, max: 100 },
    { key: 'pzul', label: 'zulässige Verlustleistung', unit: 'W', digits: 2, min: 0, max: 100 },
    { key: 'G', label: 'Schleifenverstärkung G', unit: '', digits: 2, min: 0, max: 3 },
    { key: 'dtJC', label: 'Temperaturabfall Chip–Gehäuse', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'dtCK', label: 'Temperaturabfall Übergang', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'dtK', label: 'Temperaturabfall Kühlkörper–Luft', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'tjPeak', label: 'Spitzen-Sperrschichttemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30, visible: (s) => !!s.pulse }
  ];
  const INFO = 'Übungsanlage: MOSFET IRLZ34N als Schalter. Verlustleistung = Leitverluste (Strom² · RDS(on), RDS(on) steigt mit der Temperatur) plus Schaltverluste (wachsen mit der Frequenz). Zu wenig Kühlung führt zur thermischen Mitkopplung: Die Temperatur läuft weg. Probiere Strom, Frequenz, Kühlkörper und den Impulsbetrieb.';
  const MS = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus', orient: 'senkrecht', ta: 25 };
  const P_BASE = (o) => Object.assign({ id: 10, u: 24, duty: 100, f: 20000, vgs: 5, spec: 'typ', hot: true, pulse: false }, MS, o);

  // Betriebspunkt (Strom, Tastgrad, Frequenz) aus den Steuerwerten; Impulsbetrieb = Tastgrad tp/T und Frequenz 1/T
  function opPoint(c) {
    if (c.pulse) { const D = Math.min(1, c.tp / c.T); return { I: c.id, D, f: 1 / c.T, U: c.u, cont: c.tp >= c.T }; }
    return { I: c.id, D: clamp(c.duty / 100, 0, 1), f: c.f, U: c.u, cont: c.duty >= 100 };
  }
  const rds25Of = (c) => ELEC.rds[c.spec === 'max' ? 'max' : 'typ'][String(c.vgs)] || ELEC.rds.typ['5'];
  const alphaOf = (c) => c.hot ? ELEC.alpha : 0;
  function pSwOf(c, op) { return op.D > 0 && op.D < 1 ? 0.5 * op.U * op.I * (ELEC.tr + ELEC.tf) * op.f : 0; }
  function electric(c, tj) {
    const op = opPoint(c), r25 = rds25Of(c), rds = r25 * Math.max(0.1, 1 + alphaOf(c) * (tj - 25));
    const pLeit = op.D * op.I * op.I * rds, pSw = pSwOf(c, op);
    return { p: pLeit + pSw, pLeit, pSw, rds, op };
  }
  function steadyP(c, ta, rth) {
    const op = opPoint(c), r25 = rds25Of(c), al = alphaOf(c), pl25 = op.D * op.I * op.I * r25, pSw = pSwOf(c, op), G = pl25 * al * rth;
    if (G >= 1) return { ok: false, runaway: true, G, p: 0, why: 'Thermische Mitkopplung' };
    const p = (pl25 * (1 + al * (ta - 25)) + pSw) / (1 - G);
    return { ok: true, p, G, parts: { pLeit: p - pSw, pSw } };
  }

  function buildSpec(CORE) {
    ELEC = elecOf(CORE);
    const mp = mountPresetList(CORE).map(q => ({ id: q.id, name: q.name, params: Object.assign({ id: 5, u: 24, duty: 100, vgs: 5, spec: 'typ', hot: true, pulse: false }, q.values) }));
    const presets = [
      { id: 'dauer10', name: 'Dauerlast 10 A, 5 V Gate', params: P_BASE({ u: 12 }) },
      { id: 'pwm20k', name: 'PWM 20 kHz, 10 A, 24 V', params: P_BASE({ duty: 50, f: 20000, u: 24 }) },
      { id: 'rdsmax', name: 'RDS(on) max statt typ', params: P_BASE({ spec: 'max', u: 12 }) },
      { id: 'mitkopplung', name: 'Mitkopplung (kleiner Kühlkörper, 18 A)', params: P_BASE({ id: 18, u: 12, heatsink: 's' }) },
      { id: 'impuls100', name: 'Impuls 100 A, 1 ms, 100 ms', params: P_BASE({ pulse: true, id: 100, u: 24, tp: 0.001, T: 0.1 }) }
    ].concat(mp);
    const spec = {
      id: ID, title: 'MOSFET-Prüfstand: IRLZ34N als Schalter (Übungsanlage)', shortTitle: 'MOSFET-Prüfstand', controls: OWN, meterDefs: METERS, presets, info: INFO,
      deviceKey: () => 'irlz34n', deviceName: () => 'IRLZ34N (TO-220)', shape: () => 'to220', shapeName: () => 'TO-220-Gehäuse', singleNode: () => false,
      cfgOf: (c) => cfgFrom(CORE, c, 'irlz34n', c.heatsink),
      limits: () => ({ tjMax: ELEC.tjMax, destroyAt: ELEC.destroyAt, noun: 'Sperrschicht', tempWord: 'Sperrschichttemperatur', pNom: Infinity }),
      mountVisible: () => true,
      fahneV: (c) => c.u,
      potText: (c) => 'am Drain (bis zu ' + fmtWith(CORE)(c.u, 0) + ' V) und berührt den Kühlkörper, der an Masse liegt',
      electric, steadyP, tjDependent: true, EL: ELEC,
      noSteadyText: (si, f) => si.runaway ? 'Es gibt keinen Beharrungszustand: Mit G = ' + f(si.G, 2) + ' (mindestens 1) läuft die Temperatur weg.' : 'Es gibt keinen Beharrungszustand.',
      sync(c, def) { const mx = c.pulse ? ELEC.idm : ELEC.idRec; def.id.max = mx; def.id.step = c.pulse ? 5 : 0.5; if (c.id > mx) c.id = mx; },
      resetDefs(c, def) { def.id.max = ELEC.idRec; def.id.step = 0.5; },
      meterVals(E, S) {
        const c = E.ctl, e = E.eNow(), si = E.stNow();
        let peak = S.tj;
        if (c.pulse && si.ok) {
          const op = opPoint(c), ppk = op.I * op.I * rds25Of(c) * (1 + alphaOf(c) * (si.tj - 25));
          try { const r = CORE.pulseTj(E.cfg, ppk, c.tp, c.T, c.ta); const v = typeof r === 'number' ? r : pick(r, ['tj', 'value'], NaN); if (fin(v)) peak = v; } catch (x) { peak = S.tj; }
        }
        return { pLeit: e.pLeit, pSw: e.pSw, pTotal: e.p, rdsHot: e.rds, G: si.G || 0, tjPeak: peak };
      },
      stateExtra(E, S) {
        const c = E.ctl, e = E.eNow(), op = opPoint(c), si = E.stNow(), m = E.readMeters();
        return { pv: e.p, pLeit: e.pLeit, pSw: e.pSw, pTotal: e.p, rdsHot: e.rds, rds25: rds25Of(c), alpha: alphaOf(c), G: si.G || 0, dEff: op.D, fEff: op.f, tjAvg: S.tj, tjPeak: m.tjPeak, ip: op.I, spec: c.spec };
      },
      cells(E, S) { const e = E.eNow(), f = E.fmt; return [['Verlustleistung P', f(e.p, 2) + ' W', COL.text], ['Leitverluste P_leit', f(e.pLeit, 2) + ' W', COL.leit], ['Schaltverluste P_sw', f(e.pSw, 2) + ' W', COL.sw]]; },
      knobs(E) {
        const c = E.ctl, f = E.fmt, k = [{ key: 'id', lo: 0, hi: E.def.id.max, step: E.def.id.step, label: 'Strom I_D', unit: 'A', digits: c.pulse ? 0 : 1, fmt: (v) => f(v, c.pulse ? 0 : 1) + ' A' }, { key: 'u', lo: 5, hi: 44, step: 1, label: 'Spannung U', unit: 'V', digits: 0, fmt: (v) => f(v, 0) + ' V' }];
        if (!c.pulse) k.push({ key: 'duty', lo: 0, hi: 100, step: 1, label: 'Tastgrad D', unit: '%', digits: 0, fmt: (v) => f(v, 0) + ' %' });
        return k;
      },
      toggles(E) {
        const c = E.ctl, hs = c.heatsink !== 'none', out = [{ key: 'heatsink', label: 'Kühlkörper', short: 'Kühlk.', isOn: () => hs, onVal: 'm', offVal: 'none' }];
        if (hs) out.push({ key: 'paste', label: 'Paste', short: 'Paste', isOn: () => c.paste !== 'keine', onVal: 'duenn', offVal: 'keine' }, { key: 'joint', label: 'Glimmer', short: 'Glimmer', isOn: () => c.joint !== 'direkt', onVal: 'glimmer', offVal: 'direkt' }, { key: 'fan', label: 'Lüfter', short: 'Lüfter', isOn: () => c.fan !== 'aus', onVal: 'mittel', offVal: 'aus' });
        return out;
      },
      // Kontext fuer THM_CORE.diagnose: Betriebspunkt (Grenzwerte), Fahnenspannung nur bei Kontakt, Mitkopplung
      coreCtx(X, cx) {
        const c = X.ctl, op = opPoint(c);
        cx.op = { i: c.id, d: op.D, u: c.u, f: op.f, vgs: c.vgs, spec: c.spec, tj: X.tj, hot: c.hot };
        cx.tabV = X.cfg.heatsink !== 'none' && (c.joint === 'direkt' || c.bushing === false) ? c.u : 0;
        if (X.steady && X.steady.runaway) cx.runaway = true;
      },
      diagPost(X, list, add, del, f, has) {
        const c = X.ctl, si = X.steady, sy = X.sym || {};
        if (si && si.runaway && !X.destroyed && !has('runaway')) add('runaway', 'error', 'Thermische Mitkopplung: RDS(on) steigt mit der Temperatur schneller, als der Kühlkörper die zusätzliche Wärme abführt. Die Temperatur läuft weg.');
        if (c.pulse) {
          del('i-hoch');
          if (c.id > ELEC.idRec + 1e-9) add('puls-idm', 'info', 'Der Impulsstrom liegt über dem empfohlenen Dauerwert (' + f(ELEC.idRec, 0) + ' A): Der Datenblattwert IDM = ' + f(ELEC.idm, 0) + ' A gilt nur für Impulse bis ' + f(ELEC.idmTp * 1e6, 0) + ' µs.');
          if (c.tp >= c.T) add('puls-dauer', 'info', 'Der Impuls ist so lang wie die Periode: Das ist Dauerbetrieb.');
        } else if (!has('i-hoch') && c.id > ELEC.idRec + 1e-9) add('i-hoch', 'warn', 'Der Strom liegt über dem empfohlenen Wert (' + f(ELEC.idRec, 0) + ' A).');
        if (c.u > ELEC.vdsAbs + 1e-9) { if (!has('ue-abs')) add('ue-abs', 'error', 'Die Spannung am Schalter (' + f(c.u, 0) + ' V) liegt über dem absoluten Grenzwert (' + f(ELEC.vdsAbs, 0) + ' V): Das Bauteil kann beschädigt werden.'); }
        else if (c.u > ELEC.vdsRec + 1e-9 && !has('ue-hoch')) add('ue-hoch', 'warn', 'Die Spannung am Schalter (' + f(c.u, 0) + ' V) liegt über dem empfohlenen Wert (' + f(ELEC.vdsRec, 0) + ' V).');
        if (c.spec === 'typ' && !(si && si.runaway) && !X.destroyed) {
          let s2 = null; try { s2 = X.steadyOf ? X.steadyOf(Object.assign({}, c, { spec: 'max' })) : null; } catch (e) { s2 = null; }
          if (s2 && s2.ok && s2.tj > X.lim.tjMax && X.tj <= X.lim.tjMax) add('spec', 'info', 'Mit RDS(on,max) rechnest du auf der sicheren Seite: Dann läge ' + (sy.tj || 'Tj') + ' bei ' + f(s2.tj, 1) + ' °C.');
        }
      },
      curves(E, S) {
        const c = E.ctl, f = E.fmt, op = opPoint(c), r25 = rds25Of(c), al = alphaOf(c) || ELEC.alpha, e = E.eNow(), ta = c.ta;
        const out = [], nI = 40, imax = E.def.id.max, pz = E.pzulFor(c, E.cfg);
        const pAt = (I, rds, ff) => { const o2 = Object.assign({}, op, { I }); return o2.D * I * I * rds + pSwOf(c, Object.assign({}, o2, { f: ff == null ? op.f : ff })); };
        const s1 = [], s2 = [], s3 = [];
        for (let i = 0; i <= nI; i++) { const I = imax * i / nI; s1.push([+I.toFixed(3), +pAt(I, r25).toFixed(4)]); s2.push([+I.toFixed(3), +pAt(I, r25 * (1 + al * 100)).toFixed(4)]); }
        out.push({ id: 'pi', title: 'Verlustleistung über dem Strom', xLabel: 'Strom I_D', xUnit: 'A', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'RDS(on) bei 25 °C', points: s1 }, { name: 'RDS(on) heiß (125 °C, Faktor ' + f(1 + ELEC.alpha * 100, 2) + ')', points: s2, dashed: true }], marker: { x: op.I, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        const sf = [], rdsNow = e.rds;
        for (let i = 0; i <= 20; i++) { const ff = 100000 * i / 20; sf.push([+(ff / 1000).toFixed(2), +(op.D * op.I * op.I * rdsNow + (op.D > 0 && op.D < 1 ? 0.5 * op.U * op.I * (ELEC.tr + ELEC.tf) * ff : 0)).toFixed(4)]); }
        out.push({ id: 'pf', title: 'Verlustleistung über der Frequenz', xLabel: 'Schaltfrequenz f', xUnit: 'kHz', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'P_leit + P_sw (Schaltverluste wachsen linear mit f)', points: sf }], marker: { x: op.f / 1000, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        const pmax = Math.max(4, e.p * 1.6, pz * 1.2), chF = E.chainOf(Object.assign({}, c, { heatsink: 'none' })), chB = E.ch, chC = E.chainOf(Object.assign({}, c, { fan: 'stark' }));
        const lineTj = (chx) => { const a = []; for (let i = 0; i <= 20; i++) { const P = pmax * i / 20; a.push([+P.toFixed(3), +(ta + P * (chx ? chx.rthTotal : 0)).toFixed(3)]); } return a; };
        out.push({ id: 'tjp', title: 'Sperrschichttemperatur über der Verlustleistung', xLabel: 'Verlustleistung P', xUnit: 'W', yLabel: 'Sperrschichttemperatur Tj', yUnit: '°C', series: [{ name: 'freistehend', points: lineTj(chF) }, { name: 'aktueller Aufbau', points: lineTj(chB) }, { name: 'aktuell mit Lüfter (stark)', points: lineTj(chC), dashed: true }], marker: { x: e.p, y: S.tj }, hlines: [{ y: ELEC.tjMax, label: 'Tj,max' }] });
        let zs = [];
        try { const ts = []; for (let i = 0; i <= 36; i++) ts.push(Math.pow(10, -3 + 7 * i / 36)); const z = E.CORE.zth(E.cfg, ts); const za = Array.isArray(z) ? z : (z && Array.isArray(z.zth) ? z.zth : (z && Array.isArray(z.z) ? z.z : [])); zs = za.length === ts.length ? ts.map((t2, i) => [+t2.toPrecision(4), +za[i].toPrecision(5)]) : []; } catch (x) { zs = []; }
        out.push({ id: 'zth', title: 'Wärmeimpedanz über der Zeit (Prozesszeit)', xLabel: 'Zeit', xUnit: 's', xScale: 'log', xLog: true, yLabel: 'Zth', yUnit: 'K/W', series: [{ name: 'Zth(t) der Wärmekette', points: zs }], marker: c.pulse && zs.length ? { x: c.tp, y: zs.reduce((b, q) => Math.abs(Math.log(q[0] / c.tp)) < Math.abs(Math.log(b[0] / c.tp)) ? q : b, zs[0])[1] } : null, hlines: [{ y: E.ch.rthTotal, label: 'Rth_ges' }], ref: zs.length ? null : { why: 'THM_CORE.zth fehlt.' } });
        const sr = []; for (let T = 25; T <= ELEC.tjMax + 25; T += 5) sr.push([T, +(r25 * (1 + al * (T - 25))).toFixed(5)]);
        out.push({ id: 'rds', title: 'RDS(on) über der Sperrschichttemperatur', xLabel: 'Sperrschichttemperatur Tj', xUnit: '°C', yLabel: 'RDS(on)', yUnit: 'Ω', series: [{ name: (c.spec === 'max' ? 'max.' : 'typ.') + ', VGS ' + f(c.vgs, 1).replace(',0', '') + ' V', points: sr }], marker: { x: S.tj, y: e.rds } });
        return out;
      },
      params: () => ({ rds: ELEC.rds, alpha: ELEC.alpha, tr: ELEC.tr, tf: ELEC.tf, idRec: ELEC.idRec, idm: ELEC.idm, vdsRec: ELEC.vdsRec, vdsAbs: ELEC.vdsAbs }),
      scene: sceneMos
    };
    return spec;
  }

  // Szene: Schaltung mit Last, MOSFET, Gate-Signal und getrennten Verlustbalken (Aufteilung nach Platz: Hochformat hat weniger Hoehe)
  function sceneMos(ctx, R, E, D, t, L) {
    const c = E.ctl, e = E.eNow(), f = E.fmt, op = opPoint(c), w = R.w, h = R.h, ox = R.x, oy = R.y, port = L.portrait;
    txt(ctx, 'Schalter mit Last', ox + 12, oy + 14, 13, COL.text, 'left', '800');
    const barsH = port ? 46 : 54, aTop = oy + 26, aBot = oy + h - barsH - 8, ah = aBot - aTop, cwid = port ? w * 0.42 : w * 0.47;
    const sc = clamp(Math.min(ah / 128, cwid / 120), 0.6, 1.3), cxc = ox + w - cwid / 2 - 6;
    const X = (lx) => cxc + lx * sc, Y = (ly) => aTop + ly * sc;
    ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Schiene mit Betriebsspannung
    ctx.beginPath(); ctx.moveTo(X(-40), Y(4)); ctx.lineTo(X(14), Y(4)); ctx.moveTo(X(0), Y(4)); ctx.lineTo(X(0), Y(16)); ctx.stroke();
    txt(ctx, '+' + f(c.u, 0) + ' V', X(18), Y(4), 13, COL.text, 'left', '800');
    // Last: Lampe leuchtet nach Strom und Tastgrad
    const lv = clamp(op.D * Math.min(1, op.I / 20) * 1.4, 0, 1), lyC = Y(32), lr = 14 * sc;
    glow(ctx, X(0), lyC, 38 * sc + 14 * lv, '255,210,90', 0.15 + 0.6 * lv);
    ctx.beginPath(); ctx.arc(X(0), lyC, lr, 0, TAU); ctx.fillStyle = 'rgba(255,225,140,' + (0.2 + 0.7 * lv).toFixed(3) + ')'; ctx.fill(); ctx.strokeStyle = '#c9d4de'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0) - lr * 0.65, lyC - lr * 0.65); ctx.lineTo(X(0) + lr * 0.65, lyC + lr * 0.65); ctx.moveTo(X(0) - lr * 0.65, lyC + lr * 0.65); ctx.lineTo(X(0) + lr * 0.65, lyC - lr * 0.65); ctx.stroke();
    txt(ctx, 'Last', X(0) - lr - 8, lyC, 12, COL.dim, 'right', '600');
    // Drain, Kanal, Gate, Source, Masse
    const yD = Y(62), yS = Y(98), yG = Y(80), yGnd = Y(112);
    ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(X(0), lyC + lr); ctx.lineTo(X(0), yD); ctx.lineTo(X(16), yD); ctx.moveTo(X(16), yS); ctx.lineTo(X(0), yS); ctx.lineTo(X(0), yGnd); ctx.stroke();
    ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(X(16), yD - 6); ctx.lineTo(X(16), yS + 6); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(8), yD - 8); ctx.lineTo(X(8), yS + 8); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(8), yG); ctx.lineTo(X(-22), yG); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(-10), yGnd); ctx.lineTo(X(10), yGnd); ctx.moveTo(X(-6), yGnd + 4); ctx.lineTo(X(6), yGnd + 4); ctx.moveTo(X(-2.5), yGnd + 8); ctx.lineTo(X(2.5), yGnd + 8); ctx.stroke();
    txt(ctx, 'D', X(26), yD - 3, 12, COL.dim, 'left', '700'); txt(ctx, 'S', X(26), yS + 7, 12, COL.dim, 'left', '700'); txt(ctx, 'G', X(-26), yG, 12, COL.dim, 'right', '700');
    // Strom im Kanal: blau Leitverluste, orange Schaltverluste (Breite nach Anteil an P)
    const pt = Math.max(1e-9, e.pLeit + e.pSw), wl = 2 + 6 * e.pLeit / pt, ws = e.pSw > 0 ? 2 + 6 * e.pSw / pt : 0;
    ctx.save(); ctx.lineCap = 'butt'; ctx.setLineDash([8, 5]); ctx.lineDashOffset = D.reduced ? 0 : -(t / 1000) * (30 + 3 * op.I);
    ctx.strokeStyle = COL.leit; ctx.lineWidth = wl; ctx.beginPath(); ctx.moveTo(X(30) + 8, yD + 2); ctx.lineTo(X(30) + 8, yS + 2); ctx.stroke();
    if (ws > 0) { ctx.strokeStyle = COL.sw; ctx.lineWidth = ws; ctx.beginPath(); ctx.moveTo(X(30) + 18, yD + 2); ctx.lineTo(X(30) + 18, yS + 2); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
    // Gate-Signal links (zwei Perioden, Flanken stark vergroessert)
    const gx0 = ox + 12, gw = Math.max(70, cxc - cwid / 2 - gx0 - 6), gy0 = aTop + 20, gh = Math.min(44, ah * 0.36);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; rr(ctx, gx0, gy0 - 8, gw, gh + 16, 6); ctx.fill();
    txt(ctx, fitText(port && op.D > 0 && op.D < 1 ? 'Gate-Signal (Flanken ×50)' : 'Gate-Signal', gw, 12, '700'), gx0 + 2, aTop + 4, 12, COL.dim, 'left', '700');
    const period = op.cont ? gw : gw / 2, ed = clamp(op.f * (ELEC.tr + ELEC.tf) * 50, 0.012, 0.22) * period;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.beginPath();
    const yHi = gy0, yLo = gy0 + gh;
    if (op.D >= 1 || op.cont) { ctx.moveTo(gx0 + 3, yHi); ctx.lineTo(gx0 + gw - 3, yHi); }
    else if (op.D <= 0) { ctx.moveTo(gx0 + 3, yLo); ctx.lineTo(gx0 + gw - 3, yLo); }
    else {
      const per = c.pulse ? gw - 6 : (gw - 6) / 2, np = c.pulse ? 1 : 2;
      for (let k = 0; k < np; k++) {
        const x0 = gx0 + 3 + k * per, on = Math.max(per * op.D, ed * 2.2), x1 = x0 + ed, x2 = x0 + on, x3 = x2 + ed;
        if (k === 0) ctx.moveTo(x0, yLo); else ctx.lineTo(x0, yLo);
        ctx.lineTo(x1, yHi); ctx.lineTo(x2, yHi); ctx.lineTo(x3, yLo); ctx.lineTo(x0 + per, yLo);
      }
    }
    ctx.stroke();
    const tms = (v) => v >= 1 ? f(v, 0) + ' s' : f(v * 1000, 0) + ' ms';
    const l1 = c.pulse ? 'tp ' + tms(c.tp) : (op.D >= 1 ? 'Dauerlast' : 'D = ' + f(c.duty, 0) + ' %'), l2 = c.pulse ? 'T ' + tms(c.T) : (op.D >= 1 ? 'D = 100 %' : 'f = ' + (c.f >= 1000 ? f(c.f / 1000, 0) + ' kHz' : f(c.f, 0) + ' Hz'));
    if (port) txt(ctx, fitText(c.pulse ? l1 + ' · ' + l2 : (op.D >= 1 ? 'Dauerlast 100 %' : 'D ' + f(c.duty, 0) + ' % · ' + (c.f >= 1000 ? f(c.f / 1000, 0) + ' kHz' : f(c.f, 0) + ' Hz')), gw, 12, '700'), gx0 + 2, gy0 + gh + 20, 12, COL.text, 'left', '700');
    else { txt(ctx, fitText(l1, gw, 12, '700'), gx0 + 2, gy0 + gh + 22, 12, COL.text, 'left', '700'); txt(ctx, fitText(l2, gw, 12, '700'), gx0 + 2, gy0 + gh + 38, 12, COL.text, 'left', '700'); }
    if (!port && op.D > 0 && op.D < 1) txt(ctx, fitText('Flanken ×50 gedehnt', gw, 12, '600'), gx0 + 2, gy0 + gh + 54, 12, COL.dim, 'left', '600');
    // Verlustbalken (gleicher Massstab fuer beide)
    const bx = ox + 12, bw = w - 24, by = oy + h - barsH + 2, scl = (bw - 112) / Math.max(pt, 0.5);
    [['P_leit', e.pLeit, COL.leit, 0], ['P_sw', e.pSw, COL.sw, 1]].forEach(q => {
      const y = by + q[3] * 22;
      txt(ctx, q[0], bx, y + 8, 12, COL.dim, 'left', '700');
      rr(ctx, bx + 44, y, Math.max(2, q[1] * scl), 16, 4); ctx.fillStyle = q[2]; ctx.fill();
      txt(ctx, f(q[1], 2) + ' W', bx + 44 + Math.max(2, q[1] * scl) + 6, y + 8, 12, COL.text, 'left', '800');
    });
    if (D.destroyed) { ctx.strokeStyle = COL.bad; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X(-14), yD - 10); ctx.lineTo(X(44), yS + 10); ctx.moveTo(X(44), yD - 10); ctx.lineTo(X(-14), yS + 10); ctx.stroke(); }
    if (D.smoke > 0) fxSmoke(ctx, X(16), yD - 6, t, D.smoke * 0.6, D.reduced);
  }

  const SPEC0 = buildSpec({});
  R.register({ id: ID, name: 'MOSFET als Schalter (IRLZ34N)', icon: '🔌', info: INFO, controls: SPEC0.controls.concat(mountDefs({}, SPEC0)), meters: METERS, presets: SPEC0.presets, create(opts) { const CORE = getCore(); return makeEngine(CORE, buildSpec(CORE), opts || {}); } });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
