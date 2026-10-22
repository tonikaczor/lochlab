/* elsrig-base.js - ELS-Lab: Registry ELS_RIGS und gemeinsame Huelle der Pruefstaende (ELS_RIGS.base), Paket WP2a.
 *
 * Browser-Ladereihenfolge: elscore.js, elscore-pruef.js, elsdraw.js, DIESE Datei, elsrig-*.js. In Node holen sich die Rig-Dateien die Basis per require.
 * Abhaengigkeiten: ELS_CORE (elscore.js) wird erst beim Erzeugen eines Pruefstands gebraucht (create); ELS_DRAW (elsdraw.js) ist OPTIONAL
 * (ohne ELS_DRAW zeichnen die Szenen mit den einfachen Helfern `B.gfx`; mit ELS_DRAW steht es den Szenen als `sc.D` zur Verfuegung).
 * Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. Alle Anlagenwerte sind Uebungswerte.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  VERTRAG (ELS_RIGS.base.makeRig, Schnittstelle SPEC 5.0; gleiche Huelle wie emvrig-base.js mit diesen Aenderungen)
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  Eine Rig-Datei registriert  ELS_RIGS.register({ id, name, icon, info, controls, meters, presets, create(opts) { return B.makeRig(SPEC, opts); } })
 *  mit der Anlagenbeschreibung SPEC:
 *   { id, name, icon, info, world:{w,h},
 *     pfad:{ fehler, weg, schutz, art:'direkt'|'indirekt'|'messung'|'verhalten' }   (Texte nur hier; es gibt kein `chain`),
 *     controls:[ { key, label, type:'slider'|'switch'|'select'|'button', min, max, step, scale:'log'|'lin', unit, unitKind, value, options:[{value,label}],
 *                  group, help, ebene:'basis'|'fehler'|'zusatz'|null (Schluessel MUSS vorhanden sein, null = reine Vorgabe), visible(state)?,
 *                  logZero? (log-Slider darf bei min 0 beginnen: die Oberflaeche bildet 0 gesondert ab) } ],
 *     meters:[ { key, label, unit, digits, min, max, warnAbove?, warnBelow?, help?, zeroIsNone? } ],
 *     presets:[ { id, name, info?, params|controls:{ key:wert } } ],
 *     params:{ Anlagenkonstanten },
 *     plant(P0) -> Modell mit
 *        compute(ctl, params, CORE) -> res          (Beharrungszustand, gecacht, nur bei Aenderung neu berechnet)
 *        meters(res, ctl) -> { key: Zahl }          (Anzeigeeinheit, immer endlich)
 *        assess(res, ctl) -> { ok, ampel, text, margin?, zusatz?, rows? }
 *        diag(res, ctl) -> [ { id, kind:'info'|'warn'|'error', text } ]
 *        curves(res, ctl) -> [ Kurve ... ]  ,  waveform?(res, ctl, o)  (NUR koerper und rcd)
 *        state?(res, ctl)   draw(ctx, w, h, t, view, sc)   hit?(x, y, w, h, view)   phaseHz?   step?(dtMs, res, ctl)   onControl?(key, old)   onButton?(key)   fire?()   reset?()
 *   }
 *  STEUERWERTE: Werte stehen in der SI-Einheit des Schluessels (V, A, Ohm, m, s), Ausnahmen stehen am Schluessel (ms fuer die Einwirkdauer `t`, mA fuer `idn`).
 *
 *  Rig-Objekt: id, name, pfad, roles {basis,fehler,zusatz} (aus controls[].ebene abgeleitet, nicht parallel gepflegt), controls, meters, presets, params, events, simOnly,
 *  setControl, getControl, getControls, step, readMeters, state, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, worldSize, fire (wenn die Anlage
 *  es hat), waveform (nur koerper und rcd), ariaLabel(), ebeneOf(key), stats(), drawError().
 *  state() enthaelt alle Steuerwerte, dazu simT (s), phase (0..1), version, ampel, ok, ebene (zuletzt bediente Schutzebene), lastKey, fired, ctl.
 *  draw(ctx, w, h, t, opts): opts = { quality:'hoch'|'mittel'|'niedrig', reduced, ghost:snapshot|null, wipe:0..1|null, theme:'dark'|'light', header:false, band:true }.
 *  Das Hinweisband (TEXTS.simOnly) liegt in der Oberflaeche (schliessbar, einmal je Anlage, `rig.simOnly`); im Bild nur mit opts.band === true.
 *  Szene: sc = { rect (Inhaltsflaeche unter Kopf), quality, qp, reduced, header, pal, theme, D, t, gfx, B, peer, ps(key, paths, o), hit(key,x,y,w,h,to?), ghost, active }.
 *  Einheitliche Regeln: setControl klemmt in den Bereich, lehnt Unbekanntes ab (false), wirft nie, ist idempotent; readMeters/state/curves nur endliche Zahlen.
 */
(function (root) {
  'use strict';
  const R = root.ELS_RIGS = root.ELS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.ORDER) R.ORDER = ['koerper', 'netz', 'schutz', 'rcd', 'klassen', 'isolation', 'pruefplatz', 'regeln'];
  if (typeof module !== 'undefined') module.exports = R;
  if (R.base) return;

  // =====================================================================================================================
  //  Zahlen, Formate
  // =====================================================================================================================
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fin = (v, d) => isNum(v) ? v : (d === undefined ? 0 : d);
  const num = (v, d) => {
    if (typeof v === 'string' && v.trim() !== '') v = Number(v.trim().replace(',', '.'));
    return isNum(v) ? v : d;
  };
  const okv = (...a) => a.every(v => isNum(v) && Math.abs(v) < 1e7);
  const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; let s = v.toFixed(d === undefined ? 1 : d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); return s.replace('.', ','); };
  const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
  const PREF = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']];
  /** Technische Schreibweise mit Einheitenvorsatz und Dezimalkomma (`230 mA`, `2,2 MΩ`). */
  function eng(v, unit, sig) {
    v = +v; unit = unit || '';
    if (!isFinite(v)) return '–' + (unit ? ' ' + unit : '');
    if (v === 0) return '0' + (unit ? ' ' + unit : '');
    sig = sig || 3;
    let e3 = clamp(Math.floor(Math.log10(Math.abs(v)) / 3) * 3, -12, 9);
    let m = v / Math.pow(10, e3);
    const dg = x => Math.max(0, Math.abs(x) >= 100 ? sig - 3 : Math.abs(x) >= 10 ? sig - 2 : sig - 1);
    let s = fn(m, dg(m));
    if (Math.abs(Number(s.replace(',', '.'))) >= 1000 && e3 < 9) { e3 += 3; m = v / Math.pow(10, e3); s = fn(m, dg(m)); }
    const p = (PREF.find(q => q[0] === e3) || [0, ''])[1];
    return s + ' ' + p + unit;
  }
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  function core() {
    const c = root.ELS_CORE || tryRequire('./elscore.js') || root.ELS_CORE;
    if (!c) throw new Error('ELS_CORE (elscore.js) ist nicht geladen.');
    tryRequire('./elscore-pruef.js');                   // Teil 2 haengt sich an dasselbe Objekt (falls vorhanden)
    return c;
  }
  const getDraw = () => root.ELS_DRAW || tryRequire('./elsdraw.js') || root.ELS_DRAW || null;
  function mulberry32(a) {
    a = (a >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // =====================================================================================================================
  //  Tabellen: Schutzebenen (einzige Quelle: ELS_CORE.levers, sonst Rueckfall), Ampel, Palette
  // =====================================================================================================================
  const EB_FB = {
    basis: { name: 'Basisschutz', short: 'Basis' }, fehler: { name: 'Fehlerschutz', short: 'Fehler' }, zusatz: { name: 'Zusatzschutz', short: 'Zusatz' }
  };
  const EB_COL = { basis: ['#35c6ff', '#0369a1'], fehler: ['#b79cff', '#6d3fd6'], zusatz: ['#ff7a3d', '#c2410c'] };
  const EBENEN = {};
  (function () {
    let L = null; try { const c = root.ELS_CORE || tryRequire('./elscore.js'); L = c && (c.ebenen || c.levers); } catch (e) { L = null; }
    ['basis', 'fehler', 'zusatz'].forEach(k => {
      const s = L && L[k] ? L[k] : EB_FB[k];
      EBENEN[k] = { key: k, name: s.name || EB_FB[k].name, short: s.short || EB_FB[k].short, text: s.text || '', color: EB_COL[k][0], colorLight: EB_COL[k][1] };
    });
  })();
  const AMP = {
    gruen: { id: 'gruen', name: 'grün', sym: '✓' }, gelb: { id: 'gelb', name: 'gelb', sym: '!' },
    rot: { id: 'rot', name: 'rot', sym: '✗' }, grau: { id: 'grau', name: 'grau', sym: '–' }
  };
  function ampelNorm(a) {
    if (a === 'grün' || a === 'gruen' || a === 'green') return 'gruen';
    if (a === 'gelb' || a === 'rot' || a === 'grau') return a;
    return 'grau';
  }
  const PAL = {
    dark: { theme: 'dark', bg: '#0e1621', panel: '#16212f', panel2: '#1d2b3d', line: '#34475c', grid: '#26364a', fg: '#e8eef5', mute: '#9fb2c6',
      fehler: '#ff7a3d', pe: '#c8d64a', neutral: '#5aa9ff', l1: '#a8794a', z1: '#4cd964', z2: '#ffcc3d', z3: '#ff9a3d', z4: '#ff6b6b',
      gruen: '#4cd964', gelb: '#ffcc3d', rot: '#ff6b6b', grau: '#8d99a6', schutz: '#5b9bff', pfad: '#b79cff', glow: true },
    light: { theme: 'light', bg: '#f4f6f8', panel: '#ffffff', panel2: '#e8edf2', line: '#b8c2cc', grid: '#dde3e9', fg: '#1b2430', mute: '#4b5866',
      fehler: '#c2410c', pe: '#5f6b00', neutral: '#1d4ed8', l1: '#7a5230', z1: '#15803d', z2: '#a16207', z3: '#c2410c', z4: '#b91c1c',
      gruen: '#15803d', gelb: '#a16207', rot: '#b91c1c', grau: '#64748b', schutz: '#1d4ed8', pfad: '#6d3fd6', glow: false }
  };
  function palette(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    const fb = PAL[t];
    let p = null;
    try { const D = getDraw(); p = D && typeof D.palette === 'function' ? D.palette(t) : null; } catch (e) { p = null; }
    const out = Object.assign({}, fb, p && typeof p === 'object' ? p : {});
    out.eb = out.eb || { basis: EBENEN.basis.color, fehler: EBENEN.fehler.color, zusatz: EBENEN.zusatz.color };
    return out;
  }
  const ebeneColor = (e, pal) => (EBENEN[e] ? (pal && pal.theme === 'light' ? EBENEN[e].colorLight : EBENEN[e].color) : ((pal || PAL.dark).mute));
  const ampelColor = (a, pal) => ((pal || PAL.dark)[ampelNorm(a)]);

  const QUAL = {
    hoch: { name: 'hoch', particles: 600, fieldLines: 24, glow: true, shadow: true, gradients: true },
    mittel: { name: 'mittel', particles: 300, fieldLines: 16, glow: true, shadow: false, gradients: true },
    niedrig: { name: 'niedrig', particles: 120, fieldLines: 8, glow: false, shadow: false, gradients: false }
  };
  const quality = q => QUAL[q] || QUAL.hoch;

  // =====================================================================================================================
  //  Mock-Zeichenflaeche fuer Tests (zaehlt Aufrufe, merkt Texte, misst Ueberlauf)
  // =====================================================================================================================
  function mockCtx(opts) {
    opts = opts || {};
    const log = { calls: 0, texts: [], by: {}, errors: [] };
    const store = { textAlign: 'left', font: '12px sans-serif', globalAlpha: 1 };
    let tx = 0, ty = 0, rot = false; const stack = [];
    const grad = { addColorStop() { log.calls++; } };
    const fontPx = f => { const m = /(\d+(?:\.\d+)?)px/.exec(f || ''); return m ? +m[1] : 12; };
    const ctx = new Proxy(store, {
      get(o, k) {
        if (k === 'log') return log;
        if (k in o) return o[k];
        if (k === 'measureText') return s => ({ width: String(s).length * fontPx(o.font) * 0.55 });
        if (typeof k === 'symbol') return undefined;
        if (/^create/.test(k)) return () => { log.calls++; log.by[k] = (log.by[k] || 0) + 1; return grad; };
        if (k === 'getLineDash') return () => [];
        if (k === 'canvas') return { width: opts.w || 0, height: opts.h || 0 };
        if (k === 'save') return () => { log.calls++; stack.push({ tx, ty, rot }); };
        if (k === 'restore') return () => { log.calls++; const q = stack.pop(); if (q) { tx = q.tx; ty = q.ty; rot = q.rot; } };
        if (k === 'translate') return (a, b) => { log.calls++; tx += +a || 0; ty += +b || 0; };
        if (k === 'rotate') return a => { log.calls++; if (+a) rot = true; };
        if (k === 'fillText' || k === 'strokeText') return (s, x, y, mw) => { log.calls++; log.by[k] = (log.by[k] || 0) + 1; log.texts.push({ s: String(s), x: x + tx, y: y + ty, mw, align: o.textAlign, px: fontPx(o.font), rot }); };
        return (...a) => {
          log.calls++; log.by[k] = (log.by[k] || 0) + 1;
          if (a.some(v => typeof v === 'number' && !isFinite(v))) log.errors.push(k + ' mit NaN/Infinity');
          return undefined;
        };
      },
      set(o, k, v) { o[k] = v; return true; }
    });
    log.overflow = function (w, h) {
      let n = 0;
      log.texts.forEach(t => {
        if (t.rot) return;
        const wd = Math.min(t.mw === undefined ? 1e9 : t.mw, t.s.length * t.px * 0.55);
        const x0 = t.align === 'center' ? t.x - wd / 2 : t.align === 'right' || t.align === 'end' ? t.x - wd : t.x;
        if (x0 < -1 || x0 + wd > w + 1 || (h !== undefined && (t.y < 0 || t.y - t.px > h + 1))) n++;
      });
      return n;
    };
    return ctx;
  }

  // =====================================================================================================================
  //  Einfache Zeichenhelfer (gfx): Rueckfall ohne ELS_DRAW und Kopfzeile; Fehlerfall zeichnet nichts und liefert false
  // =====================================================================================================================
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const gfx = (function () {
    const font = (px, bold) => (bold ? '600 ' : '') + px + 'px ' + FONT;
    const fz = w => (w < 420 ? 11 : w < 700 ? 12 : 13);
    function rr(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    }
    function panel(ctx, x, y, w, h, fill, stroke, r) {
      if (!okv(x, y, w, h) || w <= 0 || h <= 0) return false;
      rr(ctx, x, y, w, h, r === undefined ? 8 : r);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
      return true;
    }
    function fit(ctx, s, maxW) {
      s = String(s);
      if (!(maxW > 0) || !ctx.measureText) return s;
      if (ctx.measureText(s).width <= maxW) return s;
      let a = 0, b = s.length;
      while (a < b) { const m = (a + b + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) a = m; else b = m - 1; }
      return a > 0 ? s.slice(0, a) + '…' : '';
    }
    /** Text mit optionaler Platte; o = { size, bold, color, align, base, bg, pad, max }; liefert die Breite. */
    function text(ctx, s, x, y, o) {
      o = o || {};
      if (!okv(x, y)) return 0;
      s = String(s);
      const size = o.size || 12;
      ctx.font = font(size, o.bold); ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
      if (o.max > 0) s = fit(ctx, s, o.max);
      if (s === '') return 0;
      const wd = ctx.measureText ? ctx.measureText(s).width : s.length * size * 0.55;
      if (o.bg) {
        const pd = o.pad === undefined ? 3 : o.pad;
        const x0 = o.align === 'center' ? x - wd / 2 : o.align === 'right' ? x - wd : x;
        const top = o.base === 'middle' ? y - size / 2 : o.base === 'top' ? y : y - size * 0.82;
        ctx.globalAlpha = o.bgAlpha === undefined ? 0.82 : o.bgAlpha;
        rr(ctx, x0 - pd, top - pd + 1, wd + 2 * pd, size + 2 * pd - 2, 4); ctx.fillStyle = o.bg; ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = o.color || '#fff';
      if (o.max > 0) ctx.fillText(s, x, y, o.max); else ctx.fillText(s, x, y);
      return wd;
    }
    function line(ctx, pts, col, wd, dash) {
      if (!pts || pts.length < 2) return false;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (!okv(p[0], p[1])) continue; if (first) { ctx.moveTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]); }
      ctx.strokeStyle = col; ctx.lineWidth = wd || 2; ctx.lineJoin = 'round';
      if (ctx.setLineDash) ctx.setLineDash(dash || []);
      ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      return true;
    }
    function arrow(ctx, x0, y0, x1, y1, col, wd, head) {
      if (!okv(x0, y0, x1, y1)) return false;
      head = head || 7;
      const a = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = col; ctx.lineWidth = wd || 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45)); ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      return true;
    }
    function dot(ctx, x, y, r, col) { if (!okv(x, y, r)) return false; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); return true; }
    /** Symbol im Kreis: gruen = Haken, gelb = Ausrufezeichen, rot = Kreuz, grau = Strich. Nie nur Farbe. */
    function ampelSym(ctx, x, y, r, a, pal) {
      a = ampelNorm(a);
      if (!okv(x, y, r)) return false;
      const col = pal[a];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = pal.theme === 'light' ? '#ffffff' : '#101418'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round';
      ctx.beginPath();
      if (a === 'gruen') { ctx.moveTo(x - r * 0.45, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.5, y - r * 0.38); }
      else if (a === 'gelb') { ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y + r * 0.1); ctx.moveTo(x, y + r * 0.42); ctx.lineTo(x, y + r * 0.43); }
      else if (a === 'rot') { ctx.moveTo(x - r * 0.4, y - r * 0.4); ctx.lineTo(x + r * 0.4, y + r * 0.4); ctx.moveTo(x + r * 0.4, y - r * 0.4); ctx.lineTo(x - r * 0.4, y + r * 0.4); }
      else { ctx.moveTo(x - r * 0.4, y); ctx.lineTo(x + r * 0.4, y); }
      ctx.stroke(); ctx.lineCap = 'butt';
      return true;
    }
    /** Ampelzeile: Symbol + Wort + Text; liefert die belegte Breite. o = { pal, size, max } */
    function ampelRow(ctx, x, y, as, o) {
      o = o || {}; const pal = o.pal || PAL.dark, size = o.size || 13;
      if (!as || !okv(x, y)) return 0;
      const a = ampelNorm(as.ampel), r = Math.max(9, size * 0.85);
      ampelSym(ctx, x + r, y, r, a, pal);
      const w0 = text(ctx, AMP[a].name.toUpperCase(), x + 2 * r + 8, y, { size: size, bold: true, color: pal[a], base: 'middle' });
      const rest = (o.max || 400) - (2 * r + 8 + w0 + 8);
      let tw = 0;
      if (as.text && rest > 30) tw = text(ctx, as.text, x + 2 * r + 8 + w0 + 8, y, { size: size, color: pal.fg, base: 'middle', max: rest });
      return 2 * r + 8 + w0 + 8 + tw;
    }
    /** Wirkungskette Fehler - Weg - Schutz (Rueckfall ohne ELS_DRAW.chainBar); `active` = Schutzebene. Mindestgroesse 220 x 44. */
    function pfadBar(ctx, x, y, w, h, pfad, active, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!pfad || !okv(x, y, w, h) || w < 220 || h < 44) return false;
      const items = [['fehler', 'Fehler', pal.fehler], ['weg', 'Weg', pal.pfad], ['schutz', 'Schutz', pal.schutz]], gap = 16, bw = (w - 2 * gap) / 3, size = o.size || fz(w);
      items.forEach((it, i) => {
        const bx = x + i * (bw + gap);
        panel(ctx, bx, y, bw, h, pal.panel, it[2], 8);
        if (active && it[0] === 'schutz') { ctx.lineWidth = 2.5; ctx.strokeStyle = ebeneColor(active, pal); rr(ctx, bx, y, bw, h, 8); ctx.stroke(); }
        text(ctx, it[1], bx + 9, y + size + 2, { size: size, bold: true, color: it[2], max: bw - 14 });
        text(ctx, pfad[it[0]] || '', bx + 9, y + h - 8, { size: size, color: pal.fg, max: bw - 14 });
        if (i < 2) arrow(ctx, bx + bw + 2, y + h / 2, bx + bw + gap - 2, y + h / 2, pal.mute, 2, 5);
      });
      return true;
    }
    function rgba(hex, a) { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex || '#fff'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    /** Waagerechter Balken mit Marke: v/max, optional Grenzmarke `lim` (gleiche Einheit). */
    function bar(ctx, x, y, w, h, v, max, col, pal, lim) {
      if (!okv(x, y, w, h) || !(w > 0) || !(h > 0) || !isNum(v) || !(max > 0)) return false;
      panel(ctx, x, y, w, h, pal.bg, pal.line, 4);
      const f = clamp(v / max, 0, 1);
      if (f > 0) panel(ctx, x + 1, y + 1, Math.max(0, (w - 2) * f), h - 2, col, null, 3);
      if (isNum(lim) && lim > 0 && lim <= max) { const lx = x + w * (lim / max); ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, y - 2); ctx.lineTo(lx, y + h + 2); ctx.stroke(); }
      return true;
    }
    /** Schaltflaeche (Chip) mit Beschriftung; liefert true wenn gezeichnet. */
    function chip(ctx, label, value, x, y, w, h, pal, o) {
      o = o || {};
      if (!okv(x, y, w, h) || w < 20 || h < 14) return false;
      panel(ctx, x, y, w, h, o.on ? pal.panel2 : pal.panel, o.color || pal.line, 7);
      const size = o.size || 12, tw = text(ctx, label, x + 8, y + h / 2, { size, color: pal.mute, base: 'middle', max: w * 0.55 });
      if (value !== undefined && value !== null && value !== '') text(ctx, String(value), x + 8 + tw + 5, y + h / 2, { size, bold: true, color: o.color || pal.fg, base: 'middle', max: w - tw - 22 });
      return true;
    }
    return { font, fz, rr, panel, fit, text, line, arrow, dot, ampelSym, ampelRow, pfadBar, rgba, bar, chip };
  })();

  // =====================================================================================================================
  //  Partikelsystem (Rueckfall; mit ELS_DRAW steht dessen createParticles zur Verfuegung)
  // =====================================================================================================================
  /** createParticles(paths, opts): paths = [{ pts, color, rate (0..1), dir, size }], opts = { max, seed, speed, glow }.
   *  Rueckgabe { step(dtMs, freeze), draw(ctx, o), setRate(i, r), setPaths(paths), count(), positions(i, n) }. */
  function createParticles(paths, opts) {
    opts = opts || {};
    const cap = Math.max(8, Math.floor(opts.max || 300)), rnd = mulberry32(opts.seed || 1), baseSpeed = opts.speed || 90;
    let P = []; const pos = new Float32Array(cap), spd = new Float32Array(cap);
    for (let i = 0; i < cap; i++) { pos[i] = rnd(); spd[i] = 0.75 + 0.5 * rnd(); }
    function prep(list) {
      P = (list || []).map(p => {
        const pts = (p.pts || []).filter(q => okv(q[0], q[1]));
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts, cum, len: cum[cum.length - 1] || 0, color: p.color || '#fff', rate: clamp(fin(p.rate, 0), 0, 1), dir: p.dir === -1 ? -1 : 1, size: p.size || 3, a: 0, n: 0 };
      });
      const tot = P.reduce((s, q) => s + Math.max(q.len, 1), 0) || 1;
      let used = 0;
      P.forEach(q => { q.n = Math.max(4, Math.floor(cap * Math.max(q.len, 1) / tot)); q.a = used; used += q.n; if (used > cap) { q.n = Math.max(0, q.n - (used - cap)); used = cap; } });
    }
    prep(paths);
    const tmp = [0, 0, 0];
    function locate(q, s, out) {
      const d = s * q.len; let i = 1;
      while (i < q.cum.length - 1 && q.cum[i] < d) i++;
      const a = q.pts[i - 1], b = q.pts[i], seg = (q.cum[i] - q.cum[i - 1]) || 1, u = clamp((d - q.cum[i - 1]) / seg, 0, 1);
      out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    return {
      setRate(i, r) { if (P[i]) P[i].rate = clamp(fin(r, 0), 0, 1); },
      setPaths(p) { prep(p); },
      count() { return P.reduce((s, q) => s + (q.len > 0 && q.rate > 0 ? Math.min(q.n, Math.ceil(q.n * q.rate)) : 0), 0); },
      step(dtMs, freeze) {
        dtMs = clamp(num(dtMs, 0), 0, 200); if (!(dtMs > 0) || freeze) return;
        P.forEach(q => {
          if (!(q.len > 0) || !(q.rate > 0)) return;
          const v = baseSpeed * (0.2 + 0.8 * q.rate) / q.len;
          for (let j = 0; j < q.n; j++) { const k = q.a + j; let s = pos[k] + q.dir * v * spd[k] * dtMs / 1000; s -= Math.floor(s); pos[k] = s; }
        });
      },
      positions(i, n) { const q = P[i], out = []; if (!q || !(q.len > 0)) return out; for (let j = 0; j < Math.min(n === undefined ? q.n : n, q.n); j++) { locate(q, pos[q.a + j], tmp); out.push([tmp[0], tmp[1]]); } return out; },
      draw(ctx, o) {
        o = o || {};
        P.forEach(q => {
          if (!(q.len > 0)) return;
          ctx.fillStyle = q.color; ctx.globalAlpha = 0.9;
          locate(q, 0.5, tmp); const a = tmp[2] + (q.dir === -1 ? Math.PI : 0), x = tmp[0], y = tmp[1], hs = 6;
          ctx.beginPath(); ctx.moveTo(x + hs * Math.cos(a), y + hs * Math.sin(a)); ctx.lineTo(x + hs * Math.cos(a + 2.5), y + hs * Math.sin(a + 2.5)); ctx.lineTo(x + hs * Math.cos(a - 2.5), y + hs * Math.sin(a - 2.5)); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          if (o.reduced || !(q.rate > 0)) return;
          const n = Math.min(q.n, Math.ceil(q.n * q.rate));
          ctx.fillStyle = q.color; ctx.beginPath();
          for (let j = 0; j < n; j++) { locate(q, pos[q.a + j], tmp); ctx.rect(tmp[0] - q.size / 2, tmp[1] - q.size / 2, q.size, q.size); }
          ctx.fill();
        });
      }
    };
  }

  // =====================================================================================================================
  //  Pruefung einer Anlagenbeschreibung (fuer alle Rig-Pakete in den Tests)
  // =====================================================================================================================
  const ARTEN = ['direkt', 'indirekt', 'messung', 'verhalten'];
  function checkDef(spec) {
    const errs = [], seen = {};
    if (!spec || !spec.id) return ['Anlage ohne id'];
    (spec.controls || []).forEach(c => {
      if (!c.key) { errs.push('Steuerwert ohne key'); return; }
      if (seen[c.key]) errs.push('Schlüssel doppelt: ' + c.key); seen[c.key] = 1;
      if (!c.help) errs.push(c.key + ': help fehlt');
      if (!c.label) errs.push(c.key + ': label fehlt');
      if (c.type !== 'button' && !Object.prototype.hasOwnProperty.call(c, 'ebene')) errs.push(c.key + ': ebene fehlt (null = reine Vorgabe)');
      if (c.ebene && !EBENEN[c.ebene]) errs.push(c.key + ': unbekannte Schutzebene ' + c.ebene);
      if (c.type === 'slider') {
        if (!(c.min < c.max)) errs.push(c.key + ': min < max verletzt');
        if (!(c.value >= c.min && c.value <= c.max)) errs.push(c.key + ': value außerhalb des Bereichs');
        if (c.scale === 'log' && !(c.min > 0) && !(c.logZero === true && c.min === 0)) errs.push(c.key + ': log-Slider mit min <= 0 (nur mit logZero: true und min 0 erlaubt)');
      } else if (c.type === 'select') {
        if (!c.options || !c.options.length) errs.push(c.key + ': options fehlen');
        else if (!c.options.some(o => o.value === c.value)) errs.push(c.key + ': value nicht in options');
      }
    });
    (spec.meters || []).forEach(m => { if (!m.key || !m.label) errs.push('Messgerät ohne key/label'); });
    const p = spec.pfad;
    if (!p || !p.fehler || !p.weg || !p.schutz) errs.push('pfad braucht fehler, weg und schutz');
    else if (ARTEN.indexOf(p.art) < 0) errs.push('pfad.art unbekannt');
    if (spec.chain) errs.push('chain ist nicht vorgesehen (pfad)');
    return errs;
  }

  // =====================================================================================================================
  //  Die gemeinsame Huelle: makeRig
  // =====================================================================================================================
  function makeRig(spec, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const CORE = core();
    const params = Object.freeze(Object.assign({}, spec.params, (opts.params && typeof opts.params === 'object') ? opts.params : {}));
    const defs = spec.controls;
    const dmap = {};
    defs.forEach(c => { dmap[c.key] = c; });
    const ctl = {};
    const seed = num(opts.seed, 1);
    const ev = [];
    let version = 0, phase = 0, simT = 0, cache = null, cacheVer = -1, computes = 0, drawCount = 0, drawError = null;
    let lastKey = null, lastEbene = null, act = [], prevAct = {}, fired = false;
    let hits = [], hitsW = 0, hitsH = 0;
    const anim = { tw: {}, ps: {}, quality: 'hoch', reduced: false, ghost: null };

    function resetControls() { defs.forEach(c => { ctl[c.key] = c.value; }); }
    resetControls();

    const say = (text, kind, fx) => { const e = { t: simT, text: String(text), kind: kind || 'info' }; if (fx) e.fx = fx; ev.push(e); if (ev.length > 120) ev.shift(); };
    const bump = () => { version++; };
    const P0 = { ctl, params, say, CORE, seed, opts, bump, anim, B: null, fired: () => fired, setCtl(k, v) { if (dmap[k]) { const r = validate(k, v); if (r.ok) { ctl[k] = r.v; bump(); } } } };
    const P = spec.plant(P0);

    // ---- Steuerwerte ----
    function validate(key, v) {
      const d = dmap[key]; if (!d) return { ok: false };
      if (d.type === 'slider') {
        if (typeof v === 'boolean') return { ok: false };
        v = num(v, NaN); if (!isFinite(v)) return { ok: false };
        return { ok: true, v: clamp(v, d.min, d.max) };
      }
      if (d.type === 'select') {
        if (v === null || v === undefined || typeof v === 'object') return { ok: false };
        for (let i = 0; i < d.options.length; i++) if (d.options[i].value === v || String(d.options[i].value) === String(v)) return { ok: true, v: d.options[i].value };
        const nv = num(v, NaN);
        if (isNum(nv)) for (let i = 0; i < d.options.length; i++) { const ov = d.options[i].value; if (isNum(ov) && Math.abs(nv - ov) <= 1e-9 * Math.max(Math.abs(ov), 1e-300)) return { ok: true, v: ov }; }
        return { ok: false };
      }
      if (d.type === 'switch') {
        if (typeof v === 'boolean') return { ok: true, v };
        if (v === 1 || v === 0) return { ok: true, v: !!v };
        if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (s === 'true' || s === 'ein' || s === 'an' || s === '1') return { ok: true, v: true }; if (s === 'false' || s === 'aus' || s === '0') return { ok: true, v: false }; }
        return { ok: false };
      }
      if (d.type === 'button') return { ok: true, v: true };
      return { ok: false };
    }
    function setControl(key, value) {
      try {
        if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(dmap, key)) return false;
        const d = dmap[key], r = validate(key, value);
        if (!r.ok) return false;
        if (d.type === 'button') { if (key === 'fire') return fire(); if (P.onButton) return !!P.onButton(key); return true; }
        if (ctl[key] === r.v) return true;
        const old = ctl[key]; ctl[key] = r.v;
        lastKey = key; if (d.ebene) lastEbene = d.ebene;
        bump();
        if (P.onControl) P.onControl(key, old);
        return true;
      } catch (e) { return false; }
    }
    const getControl = key => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(dmap, key) ? ctl[key] : undefined);
    const getControls = () => Object.assign({}, ctl);

    // ---- Ergebnis (Cache), Diagnose ----
    function res() {
      if (cache === null || cacheVer !== version) {
        const vv = version;
        try { cache = P.compute(ctl, params, CORE); } catch (e) { cache = { ok: false, error: String(e && e.message || e) }; }
        computes++;
        cacheVer = vv;
        evaluate();
      }
      return cache;
    }
    function evaluate() {
      let out = [];
      try { out = (P.diag ? P.diag(cache, ctl) : []) || []; } catch (e) { out = []; }
      const cur = {};
      out.forEach(d => { cur[d.id] = true; if (!prevAct[d.id]) say(d.text, d.kind, d.fx); });
      prevAct = cur; act = out;
    }
    function diagnose() { res(); return act.map(d => Object.assign({}, d)); }

    function assess() {
      let a;
      try { a = P.assess(res(), ctl); } catch (e) { a = null; }
      if (!a || typeof a !== 'object') return { ok: false, ampel: 'grau', text: 'Die Prüfung ist nicht möglich.' };
      const o = { ok: !!a.ok, ampel: ampelNorm(a.ampel), text: String(a.text || '') };
      if (isNum(a.margin)) o.margin = a.margin;
      if (a.zusatz !== undefined && a.zusatz !== null) o.zusatz = typeof a.zusatz === 'number' && !isFinite(a.zusatz) ? 0 : a.zusatz;
      if (Array.isArray(a.rows)) o.rows = a.rows.map(r => ({ id: String(r.id), ampel: ampelNorm(r.ampel), text: String(r.text || '') }));
      return o;
    }
    function readMeters() {
      let m = {};
      try { m = P.meters(res(), ctl) || {}; } catch (e) { m = {}; }
      const out = {};
      Object.keys(m).forEach(k => { out[k] = fin(m[k], 0); });
      return out;
    }
    function state() {
      const r = res(), a = assess();
      const s = Object.assign({}, ctl);
      Object.assign(s, { simT, phase, version, ampel: a.ampel, ok: a.ok, ebene: lastEbene, lastKey, fired, ctl: Object.assign({}, ctl) });
      if (P.state) { try { Object.assign(s, P.state(r, ctl) || {}); } catch (e) { /* ignorieren */ } }
      Object.keys(s).forEach(k => { if (typeof s[k] === 'number' && !isFinite(s[k])) s[k] = 0; });
      return s;
    }
    function cleanSeries(series) {
      return (series || []).map(s => Object.assign({}, s, { points: (s.points || []).filter(p => Array.isArray(p) && isNum(p[0]) && isNum(p[1])) }));
    }
    const cleanMarker = m => (m && isNum(m.x) && isNum(m.y) ? Object.assign({}, m, { label: m.label !== undefined ? m.label : m.text, text: m.text !== undefined ? m.text : m.label }) : undefined);
    function curves() {
      let c = [];
      try { c = P.curves(res(), ctl) || []; } catch (e) { c = []; }
      return c.map(cv => {
        const o = Object.assign({}, cv, { series: cleanSeries(cv.series), marker: cleanMarker(cv.marker) });
        if (cv.limit && isNum(cv.limit.y)) o.limit = Object.assign({}, cv.limit); else delete o.limit;
        return o;
      });
    }
    function waveform(o) {
      let w; try { w = P.waveform(res(), ctl, o || {}); } catch (e) { w = null; }
      if (!w) return null;
      return Object.assign({}, w, { t: (w.t || []).map(v => fin(v, 0)), series: (w.series || []).map(s => Object.assign({}, s, { y: (s.y || []).map(v => fin(v, 0)) })) });
    }

    // ---- Animation ----
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
      dtMs = Math.min(dtMs, 500);
      simT += dtMs / 1000;
      let hz = 0.5;
      try { if (P.phaseHz) hz = fin(P.phaseHz(res(), ctl), 0.5); } catch (e) { hz = 0.5; }
      if (!anim.reduced) { phase += dtMs / 1000 * hz; phase -= Math.floor(phase); }
      Object.keys(anim.ps).forEach(k => { try { anim.ps[k].sys.step(dtMs, anim.reduced); } catch (e) { /* ignorieren */ } });
      if (P.step) { try { P.step(dtMs, res(), ctl); } catch (e) { /* ignorieren */ } }
    }
    function getPS(key, paths, o2) {
      const qp = quality(anim.quality), cap = Math.max(8, Math.floor((o2 && o2.cap ? Math.min(o2.cap, qp.particles) : qp.particles)));
      const sig = cap + '|' + paths.map(p => (p.pts || []).map(q => Math.round(q[0]) + ',' + Math.round(q[1])).join(';')).join('/');
      let e = anim.ps[key];
      if (!e || e.cap !== cap) {
        const D = opts.noDraw ? null : getDraw();
        let sys = null;
        if (D && typeof D.createParticles === 'function') { try { sys = D.createParticles(paths, { quality: anim.quality, reduced: anim.reduced, seed: seed + key.length, speed: (o2 && o2.speed) || 90 }); } catch (e2) { sys = null; } }
        if (!sys) sys = createParticles(paths, { max: cap, seed: seed + key.length, speed: (o2 && o2.speed) || 90, glow: qp.glow });
        e = anim.ps[key] = { sys, cap, sig };
      } else if (e.sig !== sig) { e.sys.setPaths(paths); e.sig = sig; }
      paths.forEach((p, i) => e.sys.setRate(i, p.rate));
      return e.sys;
    }

    // ---- Vorher / Nachher ----
    function snapshot() { return { id: spec.id, v: 1, ctl: Object.assign({}, ctl) }; }
    function restore(s) {
      try {
        if (!s || typeof s !== 'object' || s.id !== spec.id || !s.ctl || typeof s.ctl !== 'object') return false;
        resetControls();
        Object.keys(s.ctl).forEach(k => { if (!dmap[k]) return; const r = validate(k, s.ctl[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
        bump(); if (P.onControl) P.onControl('*', null);
        return true;
      } catch (e) { return false; }
    }
    function applyPreset(id) {
      const p = (spec.presets || []).find(q => q.id === id); if (!p) return false;
      resetControls();
      const pv = p.params || p.controls || {};
      Object.keys(pv).forEach(k => { if (!dmap[k]) return; const r = validate(k, pv[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
      lastKey = null; lastEbene = null;
      bump(); if (P.onControl) P.onControl('*', null);
      return true;
    }
    function reset() {
      resetControls(); ev.length = 0; act = []; prevAct = {}; phase = 0; simT = 0; fired = false; lastKey = null; lastEbene = null;
      anim.tw = {}; anim.ps = {}; anim.ghost = null; cache = null;
      if (P.reset) P.reset();
      bump();
      if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { if (!dmap[k]) return; const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    }
    function fire() { if (!P.fire) return false; const r = P.fire(res(), ctl); fired = true; bump(); return r === undefined ? true : !!r; }

    // ---- Zeichnen ----
    const world = spec.world || { w: 960, h: 600 };
    function ghostRig(snap) {
      const key = JSON.stringify(snap.ctl);
      if (anim.ghost && anim.ghost.key === key) return anim.ghost.rig;
      let rig = null;
      try { rig = makeRig(spec, { controls: snap.ctl, params: opts.params, seed, noGhost: true, noDraw: opts.noDraw }); } catch (e) { rig = null; }
      anim.ghost = { key, rig };
      return rig;
    }
    function viewOf() { return { ctl, res: res(), st: state(), ampel: assess(), diag: act, rig: api, anim, phase, simT, ebene: lastEbene }; }
    function ariaLabel() {
      const a = assess(), D = opts.noDraw ? null : getDraw();
      let t = '';
      if (D && typeof D.ampelText === 'function') { try { t = D.ampelText(a.ampel, ''); } catch (e) { t = ''; } }
      if (!t) t = 'Ampel ' + AMP[a.ampel].name;
      return spec.name + ': ' + t + (a.text ? '. ' + a.text : '');
    }
    /** Kopfzeile: Ampelzeile und Wirkungskette Fehler - Weg - Schutz (ELS_DRAW.chainBar). Liefert die Inhaltsflaeche. */
    function head(ctx, w, h, view, sc, o) {
      const pad = 10, pal = sc.pal, fs = gfx.fz(w);
      if (!sc.header) return { x: 0, y: 0, w, h };
      let y = 6;
      gfx.ampelRow(ctx, pad, y + 14, view.ampel, { pal, size: fs + 1, max: w - 2 * pad });
      y += 34;
      const cw = w - 2 * pad, ch = h >= 380 ? 62 : 50;
      if (cw >= 260 && h >= 200) {
        let done = false;
        if (sc.D && typeof sc.D.chainBar === 'function') { try { done = !!sc.D.chainBar(ctx, { x: pad, y, w: cw, h: ch }, spec.pfad, view.ebene || undefined, { theme: sc.theme }); } catch (e) { done = false; } }
        if (!done) gfx.pfadBar(ctx, pad, y, cw, ch, spec.pfad, view.ebene, { pal });
        y += ch + 6;
      }
      if (sc.band) {
        const msg = (CORE.TEXTS && CORE.TEXTS.simOnly) || '';
        if (msg) { gfx.text(ctx, msg, pad, y + 8, { size: fs, color: pal.mute, bg: pal.panel, max: w - 2 * pad, base: 'middle' }); y += 20; }
      }
      return { x: pad, y, w: cw, h: Math.max(0, h - y - pad) };
    }
    function scene(ctx, w, h, t, o, rigView, tw, asGhost, peer) {
      const qp = quality(o.quality), pal = palette(o.theme);
      const sc = { hit: (key, x, y, w2, h2, to) => { if (!asGhost && key && dmap[key] && okv(x, y, w2, h2)) hits.push({ key, x, y, w: w2, h: h2, to }); },
        quality: o.quality, qp, reduced: !!o.reduced, header: o.header !== false, band: o.band === true, pal, theme: o.theme || 'dark', D: opts.noDraw ? null : getDraw(), t, gfx, B: base, peer: peer || null,
        ps: (key, paths, o2) => getPS(key, paths, o2), tw: tw || anim.tw, fs: gfx.fz(w), ghost: !!asGhost, active: rigView && rigView.ebene };
      sc.rect = head(ctx, w, h, rigView, sc, o);
      if (P.draw) P.draw(ctx, w, h, t, rigView, sc);
    }
    function draw(ctx, w, h, t, o) {
      if (!ctx || !isNum(w) || !isNum(h) || !(w > 0) || !(h > 0) || w >= 1e7 || h >= 1e7) return;
      t = num(t, 0);
      o = o && typeof o === 'object' ? o : {};
      o = { quality: QUAL[o.quality] ? o.quality : 'hoch', reduced: !!o.reduced, header: o.header !== false, band: o.band === true, ghost: o.ghost || null, wipe: isNum(o.wipe) ? clamp(o.wipe, 0, 1) : null, theme: o.theme === 'light' ? 'light' : 'dark' };
      if (o.reduced) o.quality = 'niedrig';
      anim.quality = o.quality; anim.reduced = o.reduced;
      drawCount++;
      hits = []; hitsW = w; hitsH = h;
      try {
        const pal = palette(o.theme);
        ctx.save();
        ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
        const view = viewOf();
        const g = o.ghost && !opts.noGhost ? ghostRig(o.ghost) : null;
        const gv = g ? g._view() : null;
        if (g && o.wipe !== null) {
          const xw = Math.round(w * o.wipe);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xw, h); ctx.clip(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, xw, h); scene(ctx, w, h, t, o, gv, g._tw(), true, view); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.rect(xw, 0, w - xw, h); ctx.clip(); scene(ctx, w, h, t, o, view, null, false, gv); ctx.restore();
          ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xw, 0); ctx.lineTo(xw, h); ctx.stroke();
          const gy = h / 2; ctx.beginPath(); ctx.arc(xw, gy, 22, 0, Math.PI * 2); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.stroke();
          gfx.arrow(ctx, xw - 4, gy, xw - 14, gy, pal.fg, 2, 5); gfx.arrow(ctx, xw + 4, gy, xw + 14, gy, pal.fg, 2, 5);
          gfx.text(ctx, 'Vorher', Math.max(8, xw - 30), 16, { size: 12, bold: true, color: pal.fg, bg: pal.panel, align: 'right' });
          gfx.text(ctx, 'Nachher', Math.min(w - 8, xw + 30), 16, { size: 12, bold: true, color: pal.fg, bg: pal.panel });
        } else {
          if (g) { ctx.globalAlpha = 0.3; scene(ctx, w, h, t, o, gv, g._tw(), true, view); ctx.globalAlpha = 1; }
          scene(ctx, w, h, t, o, view, null, false, gv);
        }
        ctx.restore();
      } catch (e) { drawError = e && e.message ? String(e.message) : 'Fehler'; try { ctx.restore(); } catch (e2) { /* ignorieren */ } }
    }
    function hitTest(px, py, w, h) {
      px = num(px, NaN); py = num(py, NaN); w = num(w, NaN); h = num(h, NaN);
      if (!isFinite(px) || !isFinite(py) || !(w > 0) || !(h > 0)) return null;
      let r = null;
      if (P.hit) { try { r = P.hit(px, py, w, h, viewOf()); } catch (e) { r = null; } }
      else if (hits.length && hitsW > 0 && hitsH > 0) {
        const qx = px * hitsW / w, qy = py * hitsH / h, tol = 6;
        for (let i = hits.length - 1; i >= 0; i--) {
          const q = hits[i];
          if (qx >= q.x - tol && qx <= q.x + q.w + tol && qy >= q.y - tol && qy <= q.y + q.h + tol) {
            const d = dmap[q.key]; let to = q.to;
            if (to === undefined) {
              if (d.type === 'switch') to = !ctl[q.key];
              else if (d.type === 'select') { const k = d.options.findIndex(o2 => o2.value === ctl[q.key]); to = d.options[(k + 1) % d.options.length].value; }
            }
            r = { key: q.key, to }; break;
          }
        }
      }
      if (!r || !dmap[r.key]) return null;
      return Object.assign({ kind: dmap[r.key].type }, r);
    }

    // roles aus controls[].ebene abgeleitet (nicht parallel pflegen)
    const roles = { basis: [], fehler: [], zusatz: [] };
    defs.forEach(c => { if (c.ebene && roles[c.ebene]) roles[c.ebene].push(c.key); });

    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { if (!dmap[k]) return; const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    bump();

    const api = {
      id: spec.id, name: spec.name, icon: spec.icon, info: spec.info, pfad: spec.pfad, roles, controls: defs, meters: spec.meters, presets: spec.presets, params, events: ev,
      simOnly: (CORE.TEXTS && CORE.TEXTS.simOnly) || '',
      setControl, getControl, getControls, step, readMeters, state, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, ariaLabel,
      worldSize() { return { w: world.w, h: world.h }; },
      stats() { return { computes, draws: drawCount, version, particles: Object.keys(anim.ps).map(k => anim.ps[k].sys.count()) }; },
      drawError() { return drawError; },
      ebeneOf(key) { return dmap[key] ? dmap[key].ebene || null : null; },
      _view: viewOf, _tw() { return anim.tw; }
    };
    if (P.waveform) api.waveform = waveform;
    if (P.fire) api.fire = fire;
    if (P.extend) P.extend(api, { res, ctl, say, bump });
    return api;
  }

  const base = { version: '1.0', clamp, num, fin, isNum, fm, fn, eng, okv, core, getDraw, mulberry32, EBENEN, AMP, ampelNorm, palette, ebeneColor, ampelColor, QUAL, quality,
    gfx, createParticles, mockCtx, checkDef, makeRig, FONT, ARTEN };
  R.base = base;
})(typeof window !== 'undefined' ? window : globalThis);
