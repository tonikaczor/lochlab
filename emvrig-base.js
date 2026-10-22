/* emvrig-base.js - EMV-Lab: Registry EMV_RIGS und gemeinsame Huelle der Pruefstaende (EMV_RIGS.base), Paket WP2a.
 *
 * Diese Datei im Browser NACH emvcore.js (und emvcore-lay.js) laden, VOR allen emvrig-*.js (in Node holen sich die Rig-Dateien die Basis per require).
 * Abhaengigkeiten: EMV_CORE (emvcore.js) wird erst beim Erzeugen eines Pruefstands gebraucht (create); EMV_DRAW (emvdraw.js) ist OPTIONAL
 * (die Szenen zeichnen mit den Helfern `B.gfx` dieser Datei, siehe ABWEICHUNGEN.md WP2a; EMV_DRAW steht den Szenen als `sc.D` zur Verfuegung).
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  VERTRAG (EMV_RIGS.base.makeRig, Schnittstelle SPEC 5.0)
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  Eine Rig-Datei registriert  EMV_RIGS.register({ id, name, icon, info, controls, meters, presets, create(opts) { return B.makeRig(SPEC, opts); } })
 *  mit der Anlagenbeschreibung SPEC:
 *   { id, name, icon, info, world:{w,h} (nur Seitenverhaeltnis-Hinweis, die Szene legt sich nach der echten Pixelgroesse aus),
 *     chain:{ quelle, pfad, senke, art, kopplung:[...] }  (Texte nur hier),
 *     controls:[ { key, label, type:'slider'|'switch'|'select'|'button', min, max, step, scale:'log'|'lin', unit, unitKind, value, options:[{value,label}],
 *                  group, help, lever:'quelle'|'pfad'|'senke'|null, visible(state)? } ],
 *     noLever:[Schluessel ohne Hebel (reine Vorgaben/Anzeige)],
 *     meters:[ { key, label, unit, digits, min, max, warnAbove?, warnBelow?, help?, zeroIsNone? (0 bedeutet: nicht vorhanden) } ],
 *     presets:[ { id, name, info?, params:{ key:wert } } ],
 *     params:{ Anlagenkonstanten },
 *     plant(P0) -> Modell mit
 *        compute(ctl, params, CORE) -> res          (Beharrungszustand, wird gecacht und nur bei Aenderung neu berechnet)
 *        meters(res, ctl) -> { key: Zahl }          (Anzeigeeinheit, immer endlich)
 *        assess(res, ctl) -> { ok, ampel, text, margin?, freq?, kriterium? }
 *        diag(res, ctl) -> [ { id, kind:'info'|'warn'|'error', text, fx? } ]
 *        curves(res, ctl) -> [ Kurve ... ]  (mindestens eine)
 *        spectrum?(res, ctl, o) , waveform?(res, ctl, o)
 *        state?(res, ctl) -> Zusatzfelder fuer state()
 *        draw(ctx, w, h, t, view, sc)  Szene (view = { ctl, res, st, ampel, rig }, sc = Zeichen-Kontext, siehe unten)
 *        hit?(x, y, w, h, view) -> { key, kind, to? } | null,  phaseHz?(res, ctl), step?(dtMs, res, ctl), onControl?(key, old), fire?()
 *   }
 *
 *  STEUERWERTE (wichtig fuer alle Rig-Pakete und die Aufgaben): Werte stehen in der SI-Einheit des Schluessels (Hz, V, A, F, H, Ohm, m, s), Prozentwerte in %
 *  (`duty`, `jitter`), Pegel in dB. `unit` ist das Einheitenzeichen dieses Werts, `unitKind` ('freq','len','cap','ind','res','volt','amp','db','pct',...) sagt
 *  der Oberflaeche, wie sie den Einheitenvorsatz bildet. Beispiel: fs = 1e5 (Hz), cp = 20e-12 (F), rg = 10 (Ohm), idm = 0.02 (A), duty = 50 (%).
 *
 *  Rig-Objekt (SPEC 5.0): id, name, chain, roles, controls, meters, presets, params, events, setControl, getControl, getControls, step, readMeters, state, draw,
 *  hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, worldSize, [spectrum], [waveform], [fire], [fieldAt], stats() (Tests), drawError() (Tests).
 *  state() enthaelt alle Steuerwerte (damit `visible(state)` einfach `s.snub === 'ein'` schreiben kann), dazu die festen Felder
 *  simT (Sekunden), phase (0..1), version (zaehlt jede Aenderung), ampel, lever (zuletzt bedienter Hebel), lastKey, ctl (Kopie).
 *  draw(ctx, w, h, t, opts): opts = { quality:'hoch'|'mittel'|'niedrig', reduced, ghost:snapshot|null, wipe:0..1|null, theme:'dark'|'light', header:false (Szene ohne Kopfzeile, Standard true) }; t = Zeit in ms.
 *  Die Szene bekommt sc = { quality, qp, reduced, header, pal, theme, D (EMV_DRAW oder null), t, gfx, B, peer (Gegenzustand bei Vorher/Nachher oder null), ps(key, paths, o), tw, fs, ghost, active, hit(...) }.
 *  Die Anlage bekommt P0 = { ctl, params, say, CORE, seed, opts, bump, anim, setCtl, fired() }.
 *
 *  Gemeinsame Hilfen: B.clamp, num, fm, fn, eng, AMP, LEVERS, palette(theme), gfx (Zeichenhelfer), createParticles, quality(q), mockCtx(), checkDef(spec), core().
 *
 *  Erweiterungen (WP2a, fuer alle Rig-Pakete nutzbar, nur additiv):
 *   - B.kit(CORE): Kernadapter der Rigs von WP2a (flyback, lisn, il, curve, leak, part, fresCap, fresDr, satur, limitAt, limitPts, assessConducted, envelope): ruft EMV_CORE mit
 *     SI-Konfigurationen und normiert die Ergebnisse; Notfallpfade nur fuer fehlende Zusatzfelder (gekennzeichnet). B.NOFILTER = Konfiguration ohne Filterelement.
 *   - assess() darf `rows:[{id, ampel, text}]` liefern (zusaetzliche Pruefzeilen mit eigener Ampel, zum Beispiel Ableitstrom); sie werden unveraendert (Ampel normiert) durchgereicht.
 *   - Szenen melden Trefferflaechen mit `sc.hit(key, x, y, w, h, to?)`; hitTest(x, y, w, h) liefert { key, kind, to } (to = Umkehrung eines Schalters bzw. das naechste Element einer
 *     Auswahl), skaliert auf die Zeichengroesse. Hat die Anlage eine eigene `hit`-Funktion, gilt diese.
 *   - Voreinstellungen duerfen `params` oder `controls` tragen (applyPreset liest beides).
 *   - curves(): Marker erhalten `label` und `text` (EMV_DRAW.curveChart liest label); zusaetzlich `markers` (Array) je Kurve.
 *   - gfx: Zeichenhelfer mit Mindestschrift (11 px unter 420 px Breite, sonst 12 px): panel, text (mit Platte), line, arrow, ampelSym/ampelRow, chainBar, spectrumBars (Farbklassen nach
 *     Pruefmodell: gruen >= 6 dB unter der Mittelwert-Linie, gelb < 6 dB, orange ueber der Mittelwert-Linie, rot ueber der Quasi-Spitzenwert-Linie, grau ohne Grenzwert), curveChart (Legende,
 *     Marker mit Kollisionsvermeidung), traceChart, sym (cap, coil, res, gnd, box), capV, resVs, coilVs, mosfet, glow, waveRings, chip.
 *   - mockCtx() zaehlt Aufrufe, verfolgt translate/rotate/save/restore und misst Textueberlauf (log.overflow(w, h); gedrehte Beschriftungen werden nicht gemessen).
 *  Einheitliche Regeln: setControl klemmt in den Bereich, lehnt Unbekanntes ab (false), wirft nie, ist idempotent; readMeters/state/curves liefern nur endliche Zahlen.
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
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
  const okv = (...a) => a.every(v => isNum(v) && Math.abs(v) < 1e7);                  // Pixelwerte
  const dok = (...a) => a.every(v => isNum(v) && Math.abs(v) < 1e13);                 // Messdaten (Frequenzen bis GHz, Zeiten, Pegel)
  const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; let s = v.toFixed(d === undefined ? 1 : d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); return s.replace('.', ','); };
  const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
  const PREF = [[-15, 'f'], [-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']];
  /** Technische Schreibweise: 1...999 vor dem Komma, Einheitenvorsatz, Dezimalkomma (`2,41 pF`, `34,2 MHz`, `100 nF`). */
  function eng(v, unit, sig) {
    v = +v; unit = unit || '';
    if (!isFinite(v)) return '–' + (unit ? ' ' + unit : '');
    if (v === 0) return '0' + (unit ? ' ' + unit : '');
    sig = sig || 3;
    const a = Math.abs(v);
    let e3 = Math.floor(Math.log10(a) / 3) * 3;
    e3 = clamp(e3, -15, 9);
    let m = v / Math.pow(10, e3);
    let dig = Math.abs(m) >= 100 ? sig - 3 : Math.abs(m) >= 10 ? sig - 2 : sig - 1;
    if (dig < 0) dig = 0;
    let s = fn(m, dig);
    if (Math.abs(Number(s.replace(',', '.'))) >= 1000 && e3 < 9) { e3 += 3; m = v / Math.pow(10, e3); dig = Math.abs(m) >= 100 ? sig - 3 : Math.abs(m) >= 10 ? sig - 2 : sig - 1; s = fn(m, Math.max(0, dig)); }
    const p = (PREF.find(q => q[0] === e3) || [0, ''])[1];
    return s + ' ' + p + unit;
  }
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  function core() {
    const c = root.EMV_CORE || tryRequire('./emvcore.js') || root.EMV_CORE;
    if (!c) throw new Error('EMV_CORE (emvcore.js) ist nicht geladen.');
    return c;
  }
  const getDraw = () => root.EMV_DRAW || tryRequire('./emvdraw.js') || root.EMV_DRAW || null;
  function mulberry32(a) {
    a = (a >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // =====================================================================================================================
  //  Tabellen: Hebel (einzige Quelle fuer Namen und Farben), Ampel
  // =====================================================================================================================
  const LEVERS = {
    quelle: { key: 'quelle', name: 'Quelle entschärfen', short: 'Quelle', color: '#ff7a3d', colorLight: '#c2410c' },
    pfad: { key: 'pfad', name: 'Kopplung verringern', short: 'Pfad', color: '#b79cff', colorLight: '#6d3fd6' },
    senke: { key: 'senke', name: 'Senke härten', short: 'Senke', color: '#35c6ff', colorLight: '#0369a1' }
  };
  const AMP = {
    gruen: { id: 'gruen', name: 'grün', sym: '✓', color: '#4cd964', colorLight: '#15803d' },
    gelb: { id: 'gelb', name: 'gelb', sym: '!', color: '#ffcc3d', colorLight: '#a16207' },
    rot: { id: 'rot', name: 'rot', sym: '✗', color: '#ff6b6b', colorLight: '#b91c1c' },
    grau: { id: 'grau', name: 'grau', sym: '–', color: '#8d99a6', colorLight: '#64748b' }
  };
  function ampelNorm(a) {
    if (a === 'grün' || a === 'gruen' || a === 'green') return 'gruen';
    if (a === 'gelb' || a === 'rot' || a === 'grau') return a;
    return 'grau';
  }
  /** Ampel aus Marge in dB (allgemeiner Fall, wie EMV_CORE.assess.margin): >= 6 gruen, 0...6 gelb, < 0 rot. Nur Hilfe fuer Rigs ohne eigene Pruefregel. */
  function ampelFromMargin(m) { return !isNum(m) ? 'grau' : m >= 6 ? 'gruen' : m >= 0 ? 'gelb' : 'rot'; }

  const PAL = {
    dark: { bg: '#14181c', panel: '#1c2229', panel2: '#262e37', line: '#3a4552', grid: '#2b343e', fg: '#e8ecf0', mute: '#a3afbb',
      quelle: '#ff7a3d', senke: '#35c6ff', pfad: '#b79cff', masse: '#34d6a4', efeld: '#a78bfa', hfeld: '#ffc233', grenz: '#ffffff', schutz: '#5b9bff', schirm: '#9aa6b2',
      gruen: '#4cd964', gelb: '#ffcc3d', rot: '#ff6b6b', grau: '#8d99a6', glow: true },
    light: { bg: '#f4f6f8', panel: '#ffffff', panel2: '#e8edf2', line: '#b8c2cc', grid: '#dde3e9', fg: '#1b2430', mute: '#4b5866',
      quelle: '#c2410c', senke: '#0369a1', pfad: '#6d3fd6', masse: '#0f766e', efeld: '#6d28d9', hfeld: '#a16207', grenz: '#1b2430', schutz: '#1d4ed8', schirm: '#64748b',
      gruen: '#15803d', gelb: '#a16207', rot: '#b91c1c', grau: '#64748b', glow: false }
  };
  const palette = theme => PAL[theme === 'light' ? 'light' : 'dark'];
  const leverColor = (lv, pal) => (LEVERS[lv] ? (pal === PAL.light ? LEVERS[lv].colorLight : LEVERS[lv].color) : (pal || PAL.dark).mute);
  const ampelColor = (a, pal) => ((pal || PAL.dark)[ampelNorm(a)]);

  // Qualitaetsstufen (SPEC 6.4)
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
        if (/^create/.test(k)) return () => { log.calls++; log.by[k] = (log.by[k] || 0) + 1; if (/Gradient$/.test(k)) log.gradients = (log.gradients || 0) + 1; return grad; };
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
        if (t.rot) return;                       // gedrehte Achsenbeschriftungen werden nicht gemessen
        const wd = Math.min(t.mw === undefined ? 1e9 : t.mw, t.s.length * t.px * 0.55);
        const x0 = t.align === 'center' ? t.x - wd / 2 : t.align === 'right' || t.align === 'end' ? t.x - wd : t.x;
        if (x0 < -1 || x0 + wd > w + 1 || (h !== undefined && (t.y < 0 || t.y - t.px > h + 1))) n++;
      });
      return n;
    };
    return ctx;
  }

  // =====================================================================================================================
  //  Zeichenhelfer (gfx): rein zeichnend, alle Parameter optional, Fehlerfall zeichnet nichts und liefert false
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
    /** Text mit optionaler Hintergrundplatte; o = { size, bold, color, align, base, bg, pad, max }; liefert die Breite. */
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
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (!okv(p[0], p[1])) continue; if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
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
    function dot(ctx, x, y, r, col) { if (!okv(x, y, r)) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); }
    /** Symbol im Kreis: sym = 'gruen' (Haken), 'gelb' (Ausrufezeichen), 'rot' (Kreuz), 'grau' (Strich). Nie nur Farbe. */
    function ampelSym(ctx, x, y, r, a, pal) {
      a = ampelNorm(a);
      if (!okv(x, y, r)) return false;
      const col = pal[a];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = pal === PAL.light ? '#ffffff' : '#101418'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round';
      ctx.beginPath();
      if (a === 'gruen') { ctx.moveTo(x - r * 0.45, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.5, y - r * 0.38); }
      else if (a === 'gelb') { ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y + r * 0.1); ctx.moveTo(x, y + r * 0.42); ctx.lineTo(x, y + r * 0.43); }
      else if (a === 'rot') { ctx.moveTo(x - r * 0.4, y - r * 0.4); ctx.lineTo(x + r * 0.4, y + r * 0.4); ctx.moveTo(x + r * 0.4, y - r * 0.4); ctx.lineTo(x - r * 0.4, y + r * 0.4); }
      else { ctx.moveTo(x - r * 0.4, y); ctx.lineTo(x + r * 0.4, y); }
      ctx.stroke(); ctx.lineCap = 'butt';
      return true;
    }
    /** Ampelzeile: Symbol + Wort + Text (Marge, Ort); liefert die belegte Breite. o = { pal, size, max } */
    function ampelRow(ctx, x, y, as, o) {
      o = o || {}; const pal = o.pal || PAL.dark, size = o.size || 13;
      if (!as || !okv(x, y)) return 0;
      const a = ampelNorm(as.ampel), r = Math.max(9, size * 0.85);
      ampelSym(ctx, x + r, y, r, a, pal);
      let s = AMP[a].name.toUpperCase();
      const w0 = text(ctx, s, x + 2 * r + 8, y, { size: size, bold: true, color: pal[a], base: 'middle' });
      const rest = (o.max || 400) - (2 * r + 8 + w0 + 8);
      let tw = 0;
      if (as.text && rest > 30) tw = text(ctx, as.text, x + 2 * r + 8 + w0 + 8, y, { size: size, color: pal.fg, base: 'middle', max: rest });
      return 2 * r + 8 + w0 + 8 + tw;
    }
    /** Wirkungskette Quelle - Pfad - Senke mit den drei Hebeln; `active` (Hebel-Schluessel) hebt den zuletzt bedienten Hebel hervor. Mindestgroesse 220 x 44. */
    function chainBar(ctx, x, y, w, h, chain, active, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!chain || !okv(x, y, w, h) || w < 220 || h < 44) return false;
      const keys = ['quelle', 'pfad', 'senke'], gap = 18, bw = (w - 2 * gap) / 3, size = o.size || fz(w);
      keys.forEach((k, i) => {
        const bx = x + i * (bw + gap), col = leverColor(k, pal), on = active === k;
        panel(ctx, bx, y, bw, h, on ? pal.panel2 : pal.panel, col, 8);
        if (on) { ctx.lineWidth = 2.5; ctx.strokeStyle = col; rr(ctx, bx, y, bw, h, 8); ctx.stroke(); }
        ctx.fillStyle = col; ctx.fillRect(bx + 1, y + 6, 4, h - 12);
        text(ctx, LEVERS[k].short.toUpperCase() + ' · ' + LEVERS[k].name, bx + 11, y + size + 2, { size: size, bold: true, color: col, max: bw - 16 });
        text(ctx, chain[k] || '', bx + 11, y + h - 8, { size: size, color: pal.fg, max: bw - 16 });
        if (i < 2) arrow(ctx, bx + bw + 2, y + h / 2, bx + bw + gap - 2, y + h / 2, pal.mute, 2, 5);
      });
      return true;
    }
    // ---- Achsen ----
    const lg = Math.log10;
    function logTicks(a, b) {
      const out = [], e0 = Math.floor(lg(a)), e1 = Math.ceil(lg(b));
      for (let e = e0; e <= e1; e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e); if (v >= a * 0.999 && v <= b * 1.001) out.push({ v, major: m === 1 }); });
      return out;
    }
    function niceStep(range, n) {
      const raw = range / n, e = Math.pow(10, Math.floor(lg(raw))), m = raw / e;
      return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
    }
    const fAxis = f => eng(f, 'Hz').replace(' ', '');

    // ---- Spektrum-Balkenbild (Analysator-Ansicht) ----
    // d = { lines:[{f,L}], key, lim:[{name,pts:[[f,L]],dash,color,cls}], env:[[f,L]], before:[[f,L]]|lines, fMin,fMax,yMin,yMax, marker:{f,L,text}, unit, avLim:fn(f)|null, qpLim:fn(f)|null, legend:[...] }
    // o = { pal, tw (Tween-Zustand), t (ms), reduced, qp }; Mindestgroesse 200 x 120. Balken wachsen in 300 ms (Tween), Farbe nach Marge zur AV-Linie, Schraffur ueber QP.
    function spectrumBars(ctx, x, y, w, h, d, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!d || !okv(x, y, w, h) || w < 200 || h < 120) return false;
      const fs = o.size || fz(w);
      const lm = 44, rm = 10, tm = d.legend ? 20 : 8, bm = 32;
      const px0 = x + lm, py0 = y + tm, pw = w - lm - rm, ph = h - tm - bm;
      if (pw < 100 || ph < 50) return false;
      const fMin = d.fMin > 0 ? d.fMin : 1.5e5, fMax = d.fMax > fMin ? d.fMax : 3e7, yMin = isNum(d.yMin) ? d.yMin : 0, yMax = isNum(d.yMax) && d.yMax > yMin ? d.yMax : 100;
      const x0l = lg(fMin), x1l = lg(fMax);
      const xp = f => px0 + (lg(f) - x0l) / (x1l - x0l) * pw, yp = L => py0 + ph - clamp((L - yMin) / (yMax - yMin), 0, 1) * ph;
      panel(ctx, x, y, w, h, pal.panel, pal.line, 8);
      // Legende
      if (d.legend) {
        let lx = px0;
        d.legend.forEach(L0 => {
          if (lx + 34 + String(L0.label || '').length * (fs) * 0.55 > px0 + pw) return;
          const col = L0.color || pal.fg;
          if (L0.dash) line(ctx, [[lx, y + 11], [lx + 16, y + 11]], col, 2, L0.dash); else { ctx.fillStyle = col; ctx.fillRect(lx, y + 7, 14, 8); }
          const wd = text(ctx, L0.label, lx + 20, y + 11, { size: fs, color: pal.mute, base: 'middle', max: Math.max(60, px0 + pw - lx - 24) });
          lx += 20 + wd + 14;
        });
      }
      // Gitter und Achsen
      ctx.lineWidth = 1;
      const ys = niceStep(yMax - yMin, Math.max(3, Math.floor(ph / 34)));
      for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) {
        const yy = yp(v); line(ctx, [[px0, yy], [px0 + pw, yy]], pal.grid, 1);
        text(ctx, fn(v, 0), px0 - 5, yy, { size: fs, color: pal.mute, align: 'right', base: 'middle' });
      }
      let lastLab = -1e9;
      logTicks(fMin, fMax).forEach(t => {
        const xx = xp(t.v); line(ctx, [[xx, py0], [xx, py0 + ph]], pal.grid, 1);
        if (t.major || (pw > 520 && (t.v / Math.pow(10, Math.floor(lg(t.v)))) === 2 || (pw > 520 && (t.v / Math.pow(10, Math.floor(lg(t.v)))) === 5))) {
          if (xx - lastLab > 44) { text(ctx, fAxis(t.v), xx, py0 + ph + fs + 3, { size: fs, color: pal.mute, align: 'center' }); lastLab = xx; }
        }
      });
      text(ctx, 'Frequenz in Hz (log. Achse)', px0 + pw / 2, y + h - 5, { size: fs, color: pal.mute, align: 'center' });
      ctx.save(); ctx.translate(x + 10, py0 + ph / 2); ctx.rotate(-Math.PI / 2);
      text(ctx, 'Pegel in ' + (d.unit || 'dBµV'), 0, 0, { size: fs, color: pal.mute, align: 'center' }); ctx.restore();
      // Bins (zwischengespeichert nach key und Breite), Tween
      const bw = pw >= 500 ? 3 : 2, nb = Math.max(8, Math.floor(pw / bw));
      const tw = o.tw || (o.tw = {});
      const ck = (d.key === undefined ? 'k' : d.key) + '|' + nb + '|' + fMin + '|' + fMax + '|' + yMin;
      if (tw.ck !== ck) {
        const to = new Float32Array(nb), cls = new Uint8Array(nb);
        to.fill(yMin);
        const lines = d.lines || [];
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i]; if (!(ln.f >= fMin && ln.f <= fMax) || !isNum(ln.L)) continue;
          const b = Math.min(nb - 1, Math.max(0, Math.floor((lg(ln.f) - x0l) / (x1l - x0l) * nb)));
          if (ln.L > to[b]) {
            to[b] = ln.L;
            let c = 0;
            const av = d.avLim ? d.avLim(ln.f) : null, qp = d.qpLim ? d.qpLim(ln.f) : null;
            if (isNum(av)) c = ln.L > av ? 1 : (av - ln.L < 6 ? 2 : 0); else if (d.avLim) c = 4;
            if (isNum(qp) && ln.L > qp) c = 3;
            // c: 0 gruen, 2 gelb, 1 gelb-rot (ueber AV), 3 rot (ueber QP), 4 ohne Grenzwert (grau, nie gruen)
            cls[b] = c;
          }
        }
        // Anzeige: bei neuem Wert von der aktuell gezeigten Hoehe aus wachsen
        const prev = tw.cur && tw.cur.length === nb ? tw.cur : null;
        tw.from = prev ? Float32Array.from(prev) : (() => { const a0 = new Float32Array(nb); a0.fill(yMin); return a0; })();
        tw.to = to; tw.cls = cls; tw.t0 = o.t || 0; tw.ck = ck;
        if (!tw.cur || tw.cur.length !== nb) tw.cur = new Float32Array(nb);
        // Vor-Linien (Referenz) als Hoehenprofil
        if (d.before) {
          const bf = new Float32Array(nb); bf.fill(yMin);
          d.before.forEach(ln => { if (ln.f >= fMin && ln.f <= fMax && isNum(ln.L)) { const b = Math.min(nb - 1, Math.max(0, Math.floor((lg(ln.f) - x0l) / (x1l - x0l) * nb))); if (ln.L > bf[b]) bf[b] = ln.L; } });
          tw.before = bf;
        } else tw.before = null;
      }
      const p = o.reduced ? 1 : clamp(((o.t || 0) - tw.t0) / 300, 0, 1), e = 1 - Math.pow(1 - p, 3);
      for (let i = 0; i < nb; i++) tw.cur[i] = tw.from[i] + (tw.to[i] - tw.from[i]) * e;
      tw.progress = p;
      // Balken (nach Klassen gruppiert: 1 Pfad je Farbe)
      const colOf = [pal.gruen, pal.gelb, pal.gelb, pal.rot];
      const groups = [[], [], [], [], []];
      for (let i = 0; i < nb; i++) { if (tw.cur[i] > yMin + 0.05 && tw.to[i] > yMin) groups[tw.cls[i] === 1 ? 2 : tw.cls[i]].push(i); }
      const cols2 = [pal.gruen, pal.gelb, '#ff9a3d', pal.rot, pal.grau];
      groups.forEach((g, gi) => {
        if (!g.length) return;
        ctx.beginPath();
        g.forEach(i => { const yy = yp(tw.cur[i]); ctx.rect(px0 + i * bw, yy, Math.max(1, bw - (bw > 2 ? 1 : 0.5)), py0 + ph - yy); });
        ctx.fillStyle = cols2[gi]; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
      });
      // Schraffur auf Balken ueber der QP-Linie (Muster: kurze Schraegstriche)
      const hatch = groups[3];
      if (hatch.length) {
        ctx.beginPath(); let k = 0;
        hatch.forEach(i => { if ((k++) % 2) return; const yy = yp(tw.cur[i]), hh = Math.min(16, py0 + ph - yy); ctx.moveTo(px0 + i * bw, yy + hh); ctx.lineTo(px0 + i * bw + bw + 2, yy); });
        ctx.strokeStyle = pal === PAL.light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // Referenz (Vorher): Kontur
      if (tw.before) {
        ctx.beginPath(); let first = true;
        for (let i = 0; i < nb; i++) if (tw.before[i] > yMin) { const xx = px0 + i * bw + bw / 2, yy = yp(tw.before[i]); if (first) { ctx.moveTo(xx, yy); first = false; } else ctx.lineTo(xx, yy); }
        ctx.strokeStyle = pal.mute; ctx.lineWidth = 1; if (ctx.setLineDash) ctx.setLineDash([2, 3]); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      }
      // Einhuellende
      if (d.env && d.env.length > 1) {
        const pts = d.env.filter(q => q[0] >= fMin * 0.98 && q[0] <= fMax * 1.02).map(q => [xp(clamp(q[0], fMin, fMax)), yp(q[1])]);
        line(ctx, pts, pal.hfeld, 1.5, [6, 4]);
      }
      // Grenzlinien (weiss gestrichelt, Stufen sauber)
      (d.lim || []).forEach((lm0, li) => {
        if (!lm0.pts || lm0.pts.length < 2) return;
        const pts = lm0.pts.map(q => [xp(clamp(q[0], fMin, fMax)), yp(q[1])]);
        line(ctx, pts, lm0.color || pal.grenz, 2, lm0.dash || (li ? [3, 3] : [8, 4]));
        const lp = pts[Math.min(pts.length - 1, Math.max(0, Math.floor(pts.length * (li ? 0.3 : 0.12))))];
        if (lm0.name) text(ctx, lm0.name, lp[0] + 4, lp[1] - 5, { size: fs, color: pal.fg, bg: pal.panel, pad: 2, max: Math.max(40, px0 + pw - lp[0] - 6) });
      });
      // Marker
      if (d.marker && dok(d.marker.f, d.marker.L) && d.marker.f >= fMin && d.marker.f <= fMax) {
        const mx = xp(d.marker.f), my = yp(d.marker.L);
        line(ctx, [[mx, py0], [mx, py0 + ph]], pal.fg, 1, [2, 3]);
        ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.stroke();
        if (d.marker.text) {
          const right = mx < px0 + pw * 0.62;
          text(ctx, d.marker.text, right ? mx + 8 : mx - 8, Math.max(py0 + fs + 2, my - 6), { size: fs, bold: true, color: pal.fg, bg: pal.panel, pad: 3, align: right ? 'left' : 'right', max: Math.max(40, right ? px0 + pw - (mx + 8) - 4 : mx - 8 - px0 - 4) });
        }
      }
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(px0, py0, pw, ph);
      return { x0: px0, y0: py0, w: pw, h: ph, xp, yp, progress: tw.progress };
    }

    // ---- Kurvenbild (Bode-artig) ----
    // curves[] nach SPEC 5.0 ([{id,title,xLabel,xUnit,xScale,yLabel,yUnit,series:[{name,points}],marker,limit}]); gezeichnet wird curves[idx]; o.ghost = Referenzreihen
    function curveChart(ctx, x, y, w, h, cv, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!cv || !cv.series || !okv(x, y, w, h) || w < 200 || h < 120) return false;
      const fs = o.size || fz(w);
      const legend = cv.series.length > 1 && o.legend !== false;
      const lm = 46, rm = 10, tm = 24 + (legend ? 16 : 0), bm = 34, px0 = x + lm, py0 = y + tm, pw = w - lm - rm, ph = h - tm - bm;
      if (pw < 100 || ph < 50) return false;
      const all = [];
      cv.series.forEach(s => (s.points || []).forEach(p => { if (dok(p[0], p[1])) all.push(p); }));
      (o.ghost || []).forEach(s => (s.points || []).forEach(p => { if (dok(p[0], p[1])) all.push(p); }));
      if (!all.length) return false;
      const logx = cv.xScale === 'log';
      let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
      all.forEach(p => { if (p[0] < xa) xa = p[0]; if (p[0] > xb) xb = p[0]; if (p[1] < ya) ya = p[1]; if (p[1] > yb) yb = p[1]; });
      if (isNum(o.xMin)) xa = o.xMin; if (isNum(o.xMax)) xb = o.xMax;
      if (isNum(o.yMin)) ya = o.yMin; if (isNum(o.yMax)) yb = o.yMax;
      if (cv.limit && isNum(cv.limit.y)) { ya = Math.min(ya, cv.limit.y); yb = Math.max(yb, cv.limit.y); }
      if (logx && xa <= 0) xa = Math.min(...all.filter(p => p[0] > 0).map(p => p[0]));
      if (!(xb > xa)) xb = xa * 1.1 + 1e-9;
      const ys = niceStep(Math.max(1e-9, yb - ya), Math.max(3, Math.floor(ph / 40)));
      if (!isNum(o.yMin)) ya = Math.floor(ya / ys) * ys; if (!isNum(o.yMax)) yb = Math.ceil(yb / ys) * ys; if (!(yb > ya)) yb = ya + ys;
      const xp = v => px0 + (logx ? (lg(Math.max(v, xa)) - lg(xa)) / (lg(xb) - lg(xa)) : (v - xa) / (xb - xa)) * pw;
      const yp = v => py0 + ph - clamp((v - ya) / (yb - ya), 0, 1) * ph;
      panel(ctx, x, y, w, h, pal.panel, pal.line, 8);
      text(ctx, cv.title || '', px0, y + 14, { size: fs, bold: true, color: pal.fg, max: pw });
      for (let v = Math.ceil(ya / ys) * ys; v <= yb + 1e-9; v += ys) { const yy = yp(v); line(ctx, [[px0, yy], [px0 + pw, yy]], pal.grid, 1); text(ctx, fn(v, ys < 1 ? 1 : 0), px0 - 5, yy, { size: fs, color: pal.mute, align: 'right', base: 'middle' }); }
      let lastLab = -1e9;
      if (logx) logTicks(xa, xb).forEach(t => { const xx = xp(t.v); line(ctx, [[xx, py0], [xx, py0 + ph]], pal.grid, 1); if (t.major && xx - lastLab > 44) { const tl = eng(t.v, cv.xUnit || '').replace(' ', ''), half = tl.length * fs * 0.3; text(ctx, tl, Math.min(xx, x + w - 3 - half), py0 + ph + fs + 3, { size: fs, color: pal.mute, align: xx > x + w - 3 - half ? 'right' : 'center' }); lastLab = xx; } });
      else { const xs = niceStep(xb - xa, 5); for (let v = Math.ceil(xa / xs) * xs; v <= xb + 1e-9; v += xs) { const xx = xp(v); line(ctx, [[xx, py0], [xx, py0 + ph]], pal.grid, 1); text(ctx, fn(v, 0), xx, py0 + ph + fs + 3, { size: fs, color: pal.mute, align: 'center' }); } }
      text(ctx, (cv.xLabel || '') + (cv.xUnit ? ' in ' + cv.xUnit : ''), px0 + pw / 2, y + h - 5, { size: fs, color: pal.mute, align: 'center', max: pw });
      ctx.save(); ctx.translate(x + 10, py0 + ph / 2); ctx.rotate(-Math.PI / 2);
      text(ctx, (cv.yLabel || '') + (cv.yUnit ? ' in ' + cv.yUnit : ''), 0, 0, { size: fs, color: pal.mute, align: 'center', max: ph }); ctx.restore();
      if (cv.limit && isNum(cv.limit.y)) { line(ctx, [[px0, yp(cv.limit.y)], [px0 + pw, yp(cv.limit.y)]], pal.grenz, 2, [8, 4]); if (cv.limit.name) text(ctx, cv.limit.name, px0 + pw - 4, yp(cv.limit.y) - 5, { size: fs, color: pal.fg, align: 'right', bg: pal.panel, pad: 2 }); }
      const dashes = [[], [8, 4], [2, 3], [10, 3, 2, 3]], cols = o.colors || [pal.senke, pal.quelle, pal.masse, pal.hfeld];
      (o.ghost || []).forEach(s => line(ctx, (s.points || []).map(p => [xp(p[0]), yp(p[1])]), pal.mute, 1.5, [3, 3]));
      cv.series.forEach((s, i) => {
        const pts = (s.points || []).filter(p => dok(p[0], p[1])).map(p => [xp(p[0]), yp(p[1])]);
        line(ctx, pts, cols[i % cols.length], 2.5, dashes[i % dashes.length]);
      });
      if (legend) {                                 // Legende unter dem Titel: Linienart und Name (nie nur Farbe)
        let lx = px0;
        cv.series.forEach((s, i) => {
          const nm = String(s.name || ''), need = 34 + nm.length * (fs) * 0.55;
          if (lx + need > px0 + pw) return;
          line(ctx, [[lx, y + 30], [lx + 20, y + 30]], cols[i % cols.length], 2.5, dashes[i % dashes.length]);
          text(ctx, nm, lx + 25, y + 30, { size: fs, color: pal.fg, base: 'middle', max: Math.max(40, px0 + pw - lx - 28) });
          lx += need;
        });
      }
      // Marker mit einfacher Kollisionsvermeidung der Beschriftungen
      const placed = [];
      (o.markers || (cv.marker ? [cv.marker] : [])).forEach(m => {
        if (!dok(m.x, m.y)) return;
        const mx = xp(m.x), my = yp(m.y);
        line(ctx, [[mx, py0], [mx, py0 + ph]], pal.fg, 1, [2, 3]);
        ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.stroke();
        if (!m.text) return;
        const right = mx < px0 + pw * 0.55, tx = right ? mx + 8 : mx - 8, wd = Math.min(pw * 0.55, String(m.text).length * fs * 0.58 + 8), x0 = right ? tx : tx - wd, x1 = x0 + wd;
        const cand = [my - 8, my + fs + 8, my - 8 - (fs + 5), my + 2 * (fs + 5) + 3, my - 8 - 2 * (fs + 5), my + 3 * (fs + 5) + 3];
        let ty = clamp(cand[0], py0 + fs + 2, py0 + ph - 4);
        for (let k = 0; k < cand.length; k++) {
          const yy = clamp(cand[k], py0 + fs + 2, py0 + ph - 4);
          if (!placed.some(q => x0 < q.x1 && x1 > q.x0 && yy - fs < q.y1 && yy + 3 > q.y0)) { ty = yy; break; }
        }
        placed.push({ x0, x1, y0: ty - fs, y1: ty + 3 });
        text(ctx, m.text, tx, ty, { size: fs, bold: true, color: pal.fg, bg: pal.panel, pad: 3, align: right ? 'left' : 'right', max: Math.max(40, right ? px0 + pw - tx - 2 : tx - px0 - 2) });
      });
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(px0, py0, pw, ph);
      return { x0: px0, y0: py0, w: pw, h: ph, xp, yp };
    }

    // ---- Zeitverlauf ----
    function traceChart(ctx, x, y, w, h, wv, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!wv || !wv.series || !wv.t || !okv(x, y, w, h) || w < 200 || h < 100) return false;
      const fs = o.size || fz(w), lm = 46, rm = 10, tm = 22, bm = 32, px0 = x + lm, py0 = y + tm, pw = w - lm - rm, ph = h - tm - bm;
      if (pw < 80 || ph < 40) return false;
      let ta = Infinity, tb = -Infinity, ya = Infinity, yb = -Infinity;
      wv.t.forEach(v => { if (isNum(v)) { if (v < ta) ta = v; if (v > tb) tb = v; } });
      wv.series.forEach(s => (s.y || []).forEach(v => { if (isNum(v)) { if (v < ya) ya = v; if (v > yb) yb = v; } }));
      if (isNum(o.t0)) ta = o.t0; if (isNum(o.t1) && o.t1 > ta) tb = o.t1;          // feste Zeitachse (Vorher/Nachher mit gleichem Massstab)
      if (!(tb > ta) || !(yb >= ya)) return false;
      if (isNum(o.yMin)) ya = Math.min(ya, o.yMin); if (isNum(o.yMax)) yb = Math.max(yb, o.yMax);
      if (!(yb > ya)) { yb = ya + 1; }
      const ys = niceStep(yb - ya, Math.max(3, Math.floor(ph / 36)));
      ya = Math.floor(ya / ys) * ys; yb = Math.ceil(yb / ys) * ys;
      const xp = v => px0 + (v - ta) / (tb - ta) * pw, yp = v => py0 + ph - clamp((v - ya) / (yb - ya), 0, 1) * ph;
      panel(ctx, x, y, w, h, pal.panel, pal.line, 8);
      text(ctx, o.title || '', px0, y + 14, { size: fs, bold: true, color: pal.fg, max: pw });
      for (let v = Math.ceil(ya / ys) * ys; v <= yb + 1e-9; v += ys) { const yy = yp(v); line(ctx, [[px0, yy], [px0 + pw, yy]], pal.grid, 1); text(ctx, fn(v, ys < 1 ? 1 : 0), px0 - 5, yy, { size: fs, color: pal.mute, align: 'right', base: 'middle' }); }
      const xs = niceStep(tb - ta, Math.max(3, Math.floor(pw / 90)));
      for (let v = Math.ceil(ta / xs) * xs; v <= tb + 1e-9; v += xs) { const xx = xp(v); line(ctx, [[xx, py0], [xx, py0 + ph]], pal.grid, 1); text(ctx, fn(v, xs < 1 ? 1 : 0), xx, py0 + ph + fs + 3, { size: fs, color: pal.mute, align: 'center' }); }
      text(ctx, 'Zeit in ' + (wv.tUnit || 's'), px0 + pw / 2, y + h - 5, { size: fs, color: pal.mute, align: 'center' });
      ctx.save(); ctx.translate(x + 10, py0 + ph / 2); ctx.rotate(-Math.PI / 2);
      text(ctx, o.yLabel || ((wv.series[0] && wv.series[0].name) || '') + ' in ' + ((wv.series[0] && wv.series[0].unit) || ''), 0, 0, { size: fs, color: pal.mute, align: 'center', max: ph }); ctx.restore();
      const cols = o.colors || [pal.quelle, pal.senke, pal.masse], dashes = [[], [6, 4], [2, 3]];
      ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip();
      wv.series.forEach((s, i) => {
        const step = Math.max(1, Math.floor(wv.t.length / 400)), pts = [];
        for (let k = 0; k < wv.t.length; k += step) if (dok(wv.t[k], s.y[k])) pts.push([xp(wv.t[k]), yp(s.y[k])]);
        line(ctx, pts, s.color || cols[i % cols.length], 2, s.dash || dashes[i % dashes.length]);
      });
      ctx.restore();
      (wv.marks || []).forEach((m, i) => { if (!dok(m.t) || m.t < ta || m.t > tb) return; const mx = xp(m.t); line(ctx, [[mx, py0], [mx, py0 + ph]], pal.fg, 1, [2, 3]); text(ctx, m.text || '', mx + 4, py0 + fs + 2 + i * (fs + 4), { size: fs, color: pal.fg, bg: pal.panel, pad: 2, max: pw * 0.6 }); });
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(px0, py0, pw, ph);
      return { x0: px0, y0: py0, w: pw, h: ph, xp, yp };
    }

    // ---- Schaltsymbole (alle zeichnen mit Strichstaerke 2, Farbe col) ----
    const sym = {
      wire(ctx, pts, col) { return line(ctx, pts, col, 2); },
      cap(ctx, x, y, len, col, vertical) {            // Kondensator: Anschluss (x,y) oben bzw. links, Gesamtlaenge len
        if (!okv(x, y, len)) return false;
        const m = len / 2, g = 4, pl = len * 0.32;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        if (vertical) { ctx.moveTo(x, y); ctx.lineTo(x, y + m - g); ctx.moveTo(x - pl, y + m - g); ctx.lineTo(x + pl, y + m - g); ctx.moveTo(x - pl, y + m + g); ctx.lineTo(x + pl, y + m + g); ctx.moveTo(x, y + m + g); ctx.lineTo(x, y + len); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + m - g, y); ctx.moveTo(x + m - g, y - pl); ctx.lineTo(x + m - g, y + pl); ctx.moveTo(x + m + g, y - pl); ctx.lineTo(x + m + g, y + pl); ctx.moveTo(x + m + g, y); ctx.lineTo(x + len, y); }
        ctx.stroke(); return true;
      },
      coil(ctx, x, y, len, col, loops) {              // Spule (waagerecht), Anschluss links (x,y)
        if (!okv(x, y, len)) return false;
        loops = loops || 4; const r = len / (2 * loops + 1) ;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r / 2, y);
        for (let i = 0; i < loops; i++) ctx.arc(x + r / 2 + r * (i + 0.5), y, r / 2, Math.PI, 0, false);
        ctx.moveTo(x + len - r / 2, y); ctx.lineTo(x + len, y); ctx.stroke(); return true;
      },
      res(ctx, x, y, len, col) {                      // Widerstand (waagerecht)
        if (!okv(x, y, len)) return false;
        const h = 7, a = len * 0.15;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a, y); ctx.rect(x + a, y - h / 2, len - 2 * a, h); ctx.moveTo(x + len - a, y); ctx.lineTo(x + len, y); ctx.stroke(); return true;
      },
      gnd(ctx, x, y, col, s) {
        if (!okv(x, y)) return false; s = s || 8;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s * 0.6);
        ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x + s, y + s * 0.6); ctx.moveTo(x - s * 0.6, y + s * 1.0); ctx.lineTo(x + s * 0.6, y + s * 1.0); ctx.moveTo(x - s * 0.25, y + s * 1.4); ctx.lineTo(x + s * 0.25, y + s * 1.4); ctx.stroke(); return true;
      },
      box(ctx, x, y, w, h, col, fill, label, o) {
        o = o || {};
        panel(ctx, x, y, w, h, fill || 'rgba(0,0,0,0)', col, 6); ctx.lineWidth = 2; ctx.strokeStyle = col; rr(ctx, x, y, w, h, 6); ctx.stroke();
        if (label) text(ctx, label, x + w / 2, y + h / 2, { size: o.size || 12, bold: true, color: o.color || col, align: 'center', base: 'middle', max: w - 6 });
      }
    };


    // ---- Zusatz-Helfer fuer Szenen (WP2a): Leuchten, Wellenringe, Schaltsymbole, Marken ----
    function rgba(hex, a) { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex || '#fff'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    /** Leuchtfleck (radialer Verlauf); ohne Verlaeufe (Qualitaet niedrig) ein flacher Kreis. */
    function glow(ctx, x, y, r, col, a, qp) {
      if (!okv(x, y, r) || !(r > 0)) return false;
      a = a === undefined ? 0.9 : a;
      if (qp && qp.gradients === false) { ctx.globalAlpha = a * 0.35; dot(ctx, x, y, r * 0.6, col); ctx.globalAlpha = 1; return true; }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, 1)); g.addColorStop(1, rgba(col, 0));
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      return true;
    }
    /** Wellenringe (Symbolik): n Ringe, Radius waechst mit phase (0..1), Helligkeit nimmt nach aussen ab. Mit reduced: statische Ringe. */
    function waveRings(ctx, x, y, phase, col, n, maxR, alpha, reduced) {
      if (!okv(x, y, maxR) || !(maxR > 0)) return false;
      n = Math.max(1, Math.min(8, n | 0 || 3)); alpha = alpha === undefined ? 0.8 : alpha;
      for (let i = 0; i < n; i++) {
        const u = reduced ? (i + 0.5) / n : ((phase + i / n) % 1), r = Math.max(1, u * maxR);
        ctx.globalAlpha = Math.max(0, alpha * (1 - u)); ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1; return true;
    }
    /** Senkrechte Spule (Anschluss oben bei (x,y)), Laenge len. */
    function coilV(ctx, x, y, len, col, loops) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); const r = sym.coil(ctx, 0, 0, len, col, loops); ctx.restore(); return r; }
    function resV(ctx, x, y, len, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); const r = sym.res(ctx, 0, 0, len, col); ctx.restore(); return r; }
    /** MOSFET senkrecht: Mitte (x,y), halbe Hoehe s; Gate links. Liefert die Anschlusspunkte { gate, drain, source }. */
    function mosfet(ctx, x, y, s, col) {
      if (!okv(x, y, s)) return null;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.lineTo(x, y - s * 0.55);
      ctx.moveTo(x, y + s); ctx.lineTo(x, y + s * 0.55);
      ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x, y - s * 0.3); ctx.moveTo(x, y - s * 0.15); ctx.lineTo(x, y + s * 0.15); ctx.moveTo(x, y + s * 0.3); ctx.lineTo(x, y + s * 0.55);
      ctx.moveTo(x - s * 0.22, y - s * 0.55); ctx.lineTo(x - s * 0.22, y + s * 0.55);          // Gate-Platte
      ctx.moveTo(x - s * 0.57, y); ctx.lineTo(x - s * 0.22, y); ctx.stroke();
      return { gate: [x - s * 0.57, y], drain: [x, y - s], source: [x, y + s] };
    }
    /** beschriftete Messmarke "label wert" mit Hintergrundplatte; liefert die Breite. */
    /** Kondensator senkrecht von (x,y0) nach (x,y1): feste Plattengroesse, Platten in der Mitte. */
    function capV(ctx, x, y0, y1, col, plate) {
      if (!okv(x, y0, y1)) return false;
      plate = plate || 10; const m = (y0 + y1) / 2, g = 3;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(x, m - g); ctx.moveTo(x - plate, m - g); ctx.lineTo(x + plate, m - g);
      ctx.moveTo(x - plate, m + g); ctx.lineTo(x + plate, m + g); ctx.moveTo(x, m + g); ctx.lineTo(x, y1); ctx.stroke(); return true;
    }
    /** Widerstand senkrecht von (x,y0) nach (x,y1): Koerper fester Laenge in der Mitte. */
    function resVs(ctx, x, y0, y1, col, body) {
      if (!okv(x, y0, y1)) return false;
      body = Math.min(body || 22, Math.abs(y1 - y0) * 0.7); const m = (y0 + y1) / 2, a = m - body / 2, b = m + body / 2;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, a); ctx.rect(x - 4, a, 8, body); ctx.moveTo(x, b); ctx.lineTo(x, y1); ctx.stroke(); return true;
    }
    /** Spule senkrecht von (x,y0) nach (x,y1): Wicklung fester Laenge in der Mitte (Halbkreise nach rechts). */
    function coilVs(ctx, x, y0, y1, col, loops, body) {
      if (!okv(x, y0, y1)) return false;
      loops = loops || 4; body = Math.min(body || 50, Math.abs(y1 - y0) * 0.8); const m = (y0 + y1) / 2, a = m - body / 2, r = body / (2 * loops);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, a);
      for (let i = 0; i < loops; i++) ctx.arc(x, a + r * (2 * i + 1), r, -Math.PI / 2, Math.PI / 2, false);
      ctx.moveTo(x, a + body); ctx.lineTo(x, y1); ctx.stroke(); return true;
    }
    function chip(ctx, label, value, x, y, o) {
      o = o || {}; const pal = o.pal || PAL.dark, size = o.size || 12;
      const w1 = text(ctx, label, x, y, { size: size, color: pal.mute, bg: o.bg || pal.panel, pad: 2, max: o.max });
      return w1 + (value ? text(ctx, ' ' + value, x + w1, y, { size, bold: true, color: o.color || pal.fg, max: o.max }) : 0);
    }

    return { font, fz, rr, panel, fit, text, line, arrow, dot, ampelSym, ampelRow, chainBar, logTicks, niceStep, spectrumBars, curveChart, traceChart, sym, lg, rgba, glow, waveRings, coilV, resV, mosfet, chip, capV, resVs, coilVs };
  })();

  // =====================================================================================================================
  //  Partikelsystem (Pool fester Groesse, seed-gesteuert, kein `new` je Frame)
  // =====================================================================================================================
  /** createParticles(paths, opts): paths = [{ pts:[[x,y]...], color, rate (0..1), dir (1|-1), size, label? }], opts = { max (Poolgroesse), seed, speed (px/s), glow }.
   *  Rueckgabe { step(dtMs, freeze), draw(ctx, o), setRate(i, r), setPaths(paths), count(), positions(i, n) }. Dichte und Geschwindigkeit wachsen mit `rate`. */
  function createParticles(paths, opts) {
    opts = opts || {};
    const cap = Math.max(8, Math.floor(opts.max || 300)), rnd = mulberry32(opts.seed || 1), baseSpeed = opts.speed || 90;
    let P = [], pos = new Float32Array(cap), spd = new Float32Array(cap);
    for (let i = 0; i < cap; i++) { pos[i] = rnd(); spd[i] = 0.75 + 0.5 * rnd(); }
    function prep(paths0) {
      P = (paths0 || []).map(p => {
        const pts = (p.pts || []).filter(q => okv(q[0], q[1]));
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts, cum, len: cum[cum.length - 1] || 0, color: p.color || '#fff', rate: clamp(fin(p.rate, 0), 0, 1), dir: p.dir === -1 ? -1 : 1, size: p.size || 3, a: 0, n: 0 };
      });
      const tot = P.reduce((s, q) => s + Math.max(q.len, 1), 0) || 1;
      let used = 0;
      P.forEach((q, i) => { q.n = Math.max(4, Math.floor(cap * Math.max(q.len, 1) / tot)); q.a = used; used += q.n; if (used > cap) { q.n = Math.max(0, q.n - (used - cap)); used = cap; } });
    }
    prep(paths);
    function locate(q, s, out) {
      const d = s * q.len; let i = 1;
      while (i < q.cum.length - 1 && q.cum[i] < d) i++;
      const a = q.pts[i - 1], b = q.pts[i], seg = (q.cum[i] - q.cum[i - 1]) || 1, u = clamp((d - q.cum[i - 1]) / seg, 0, 1);
      out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const tmp = [0, 0, 0];
    const sys = {
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
        const glow = o.glow !== false && !!opts.glow && !o.reduced;
        P.forEach(q => {
          if (!(q.len > 0)) return;
          // Richtungspfeile (statisch), auch im reduzierten Modus
          ctx.fillStyle = q.color; ctx.globalAlpha = 0.9;
          [0.5].forEach(s => {
            locate(q, s, tmp); const a = tmp[2] + (q.dir === -1 ? Math.PI : 0), x = tmp[0], y = tmp[1], hs = 6;
            ctx.beginPath(); ctx.moveTo(x + hs * Math.cos(a), y + hs * Math.sin(a)); ctx.lineTo(x + hs * Math.cos(a + 2.5), y + hs * Math.sin(a + 2.5)); ctx.lineTo(x + hs * Math.cos(a - 2.5), y + hs * Math.sin(a - 2.5)); ctx.closePath(); ctx.fill();
          });
          ctx.globalAlpha = 1;
          if (o.reduced || !(q.rate > 0)) return;
          const n = Math.min(q.n, Math.ceil(q.n * q.rate));
          if (glow) ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = q.color; ctx.globalAlpha = glow ? 0.85 : 1;
          ctx.beginPath();
          for (let j = 0; j < n; j++) { locate(q, pos[q.a + j], tmp); ctx.rect(tmp[0] - q.size / 2, tmp[1] - q.size / 2, q.size, q.size); }
          ctx.fill(); ctx.globalAlpha = 1;
          if (glow) ctx.globalCompositeOperation = 'source-over';
        });
      }
    };
    return sys;
  }

  // =====================================================================================================================
  //  Kernadapter B.kit(CORE): EINZIGE Stelle, an der die Pruefstaende von WP2a (quelle, filter) den Kern aufrufen.
  //  Er ruft die Kernfunktionen mit den SI-Konfigurationen der SPEC (Laengen in m, duty und jitter als Bruchteil) und bringt die Ergebnisse in eine
  //  feste Form; fehlende Zusatzfelder (pSw, pSnub, Bauteilwerte) ergaenzt er nur im Notfall aus den Formeln der SPEC (gekennzeichnet "Notfall").
  //  Es gibt hier KEINE zweite Kernrechnung: Spektrum, Filter, LISN-Kette, Grenzlinien und Ampel kommen aus EMV_CORE (Regel 7).
  // =====================================================================================================================
  const kitCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  const NOFILTER = Object.freeze({ topo: 'kein', cx: 0, cy: 0, drossel: 'ohne', ld: 0, lead: 0.015, ferrit: false, iLast: 1 });
  function kit(CORE) {
    if (kitCache && kitCache.has(CORE)) return kitCache.get(CORE);
    const K = buildKit(CORE);
    if (kitCache) kitCache.set(CORE, K);
    return K;
  }
  function buildKit(CORE) {
    const K = { CORE };
    const pickN = (r, keys) => { if (isNum(r)) return r; if (r && typeof r === 'object') for (let i = 0; i < keys.length; i++) if (isNum(r[keys[i]])) return r[keys[i]]; return NaN; };
    const normLines = a => {
      const out = [];
      if (!Array.isArray(a)) return out;
      for (let i = 0; i < a.length; i++) {
        const l = a[i]; if (!l || !isNum(l.f) || !isNum(l.L)) continue;
        const o = { f: l.f, L: l.L }; if (isNum(l.n)) o.n = l.n; if (isNum(l.Lcm)) o.Lcm = l.Lcm; if (isNum(l.Ldm)) o.Ldm = l.Ldm; out.push(o);
      }
      return out;
    };
    K.normLines = normLines;
    // ---- Quelle ----
    function normFly(r, cfg) {
      if (!r || typeof r !== 'object') return { ok: false, why: 'Der Kern liefert für diese Quelle kein Ergebnis.' };
      if (r.ok === false) return { ok: false, why: String(r.why || 'Die Quelle ist mit diesen Werten nicht berechenbar.') };
      const g = r.ring && typeof r.ring === 'object' ? r.ring : {};
      const o = { ok: true, tr: pickN(r, ['tr']), tf: pickN(r, ['tf']), dudt: pickN(r, ['dudt']), f1: pickN(r, ['f1']), f2: pickN(r, ['f2']), pSw: pickN(r, ['pSw', 'psw', 'pSwitch']),
        ring: { fr: isNum(g.fr) ? g.fr : 0, zeta: isNum(g.zeta) ? g.zeta : 1, os: isNum(g.os) ? g.os : 0, Z0: pickN(g, ['Z0', 'z0']), ur: isNum(g.ur) ? g.ur : 0, pSnub: pickN(g, ['pSnub', 'pSn', 'pSnubber']),
          alpha: pickN(g, ['alpha']), wd: pickN(g, ['wd']), wn: pickN(g, ['wn']), bump: pickN(g, ['bump']) },
        clamped: !!r.clamped, note: typeof r.why === 'string' ? r.why : '', cm: normLines(r.cm), dm: normLines(r.dm), raw: r };
      if (!isNum(o.tr) || !isNum(o.tf) || !o.cm.length) return { ok: false, why: 'Der Kern liefert für diese Quelle kein vollständiges Ergebnis.' };
      if (!isNum(o.pSw) && cfg) o.pSw = 0.5 * cfg.u * cfg.isw * (o.tr + o.tf) * cfg.fs;                                       // Notfall (SPEC 4.6)
      if (!isNum(o.ring.pSnub)) o.ring.pSnub = cfg && cfg.snub && cfg.snub.on ? cfg.snub.cs * cfg.u * cfg.u * cfg.fs : 0;           // Notfall (SPEC 4.1)
      if (!isNum(o.ring.Z0)) o.ring.Z0 = 0;
      return o;
    }
    K.flyback = function (cfg) {
      let r = null;
      try { r = CORE.source.flyback(cfg); } catch (e) { r = null; }
      return normFly(r, cfg);
    };
    K.envelope = function (cfg) {
      let r = null; try { r = CORE.spec.envelope(cfg); } catch (e) { r = null; }
      if (!r || r.ok === false || typeof r.at !== 'function') return null;
      return r;
    };
    // ---- LISN-Kette (Quelle -> Filter -> Netznachbildung) ----
    K.lisn = function (src, flt, klasse, fMax) {
      const s2 = Object.assign({}, src, { fMax }), f2 = flt || null;                 // ohne Filter: exakt die Linien der Quelle (kein Durchkopplungsrest)
      const cfg = { src: s2, source: s2, filter: f2, flt: f2, klasse: klasse === 'A' ? 'A' : 'B', fMax };
      let r = null;
      try { r = CORE.chain.lisn(cfg); } catch (e) { r = null; }
      if (r && r.ok !== false && Array.isArray(r.lines) && r.lines.length) {
        const lines = normLines(r.lines);
        if (lines.length) {
          let S = null; try { S = r.src && r.src.cm ? normFly(r.src, s2) : null; } catch (e) { S = null; }
          return { ok: true, lines, worst: r.worst || null, ring: r.ring || null, S: S && S.ok ? S : null, raw: r };
        }
      }
      if (r && r.ok === false && r.why) return { ok: false, why: String(r.why) };
      // Notfall: Kette aus den Kernbausteinen zusammensetzen (flyback, filter.apply, db.sum)
      const S = K.flyback(s2);
      if (!S.ok) return { ok: false, why: S.why };
      const ap = (ls, mode) => {
        let a = null; try { a = f2 ? CORE.filter.apply(ls, f2, mode) : null; } catch (e) { a = null; }
        const arr = Array.isArray(a) ? a : (a && Array.isArray(a.lines) ? a.lines : null);
        return arr && arr.length === ls.length ? arr.map(x => (isNum(x) ? x : (x && isNum(x.L) ? x.L : NaN))) : ls.map(l => l.L);
      };
      const gt = ap(S.cm, 'gt'), gg = ap(S.dm, 'gg');
      const lines = S.cm.map((c, i) => ({ f: c.f, L: CORE.db.sum([gt[i], gg[i]]), Lcm: gt[i], Ldm: gg[i] })).filter(l => isNum(l.L));
      return { ok: true, lines, worst: null, ring: S.ring, S, raw: null, notfall: true };
    };
    // ---- Filter ----
    K.il = function (flt, f) {
      let r = null; try { r = CORE.filter.il(flt, f); } catch (e) { r = null; }
      if (!r) return { gg: NaN, gt: NaN, ggRaw: NaN, gtRaw: NaN };
      return { gg: pickN(r, ['ggEff', 'gg', 'GG']), gt: pickN(r, ['gtEff', 'gt', 'GT']), ggRaw: pickN(r, ['gg', 'GG']), gtRaw: pickN(r, ['gt', 'GT']) };
    };
    K.curve = function (flt, fList) {
      let r = null; try { r = CORE.filter.curve(flt, fList); } catch (e) { r = null; }
      const take = (keys) => {
        if (Array.isArray(r)) { const a = r.map(e => pickN(e, keys)); return a.length === fList.length && a.every(isNum) ? a : null; }
        if (r && typeof r === 'object') for (let i = 0; i < keys.length; i++) { const v = r[keys[i]]; if (Array.isArray(v) && v.length === fList.length) { const a = v.map(e => pickN(e, ['il', 'y', 'v', 'dB'])); if (a.every(isNum)) return a; } }
        return null;
      };
      let gg = take(['ggEff', 'gg', 'GG']), gt = take(['gtEff', 'gt', 'GT']);
      if (!gg || !gt) { gg = []; gt = []; fList.forEach(f => { const q = K.il(flt, f); gg.push(q.gg); gt.push(q.gt); }); }
      return { f: fList, gg, gt };
    };
    K.leak = function (cy) {                                       // Ableitstrom in A (ein Y-Kondensator, 230 V, 50 Hz); Einheit des Kerns wird gegen die Formel erkannt
      let r = NaN; try { r = pickN(CORE.filter.leak({ cy, u: 230, f: 50 }), ['i', 'I', 'a', 'A', 'leak', 'ia']); } catch (e) { r = NaN; }
      const ref = 2 * Math.PI * 50 * cy * 230;
      if (!isNum(r)) return ref;                                    // Notfall
      if (ref > 0 && Math.abs(r * 1e-3 - ref) < 0.05 * ref) return r * 1e-3;     // der Kern lieferte mA
      return r;
    };
    K.part = function (id) {
      const P = CORE.filter && CORE.filter.parts; if (!P || !id) return null;
      const cand = [P.drossel && P.drossel[id], P.cmc && P.cmc[id], P.chokes && P.chokes[id], P.drosseln && P.drosseln[id], P[id]];
      [P.drossel, P.cmc, P.chokes, P.drosseln].forEach(a => { if (Array.isArray(a)) cand.push(a.find(q => q && q.id === id)); });
      const o = cand.find(q => q && typeof q === 'object' && isNum(pickN(q, ['L', 'Lcm', 'l'])));
      if (!o) return null;
      return { id, L: pickN(o, ['L', 'Lcm', 'l']), Cw: pickN(o, ['Cw', 'cw']), Isat: pickN(o, ['Isat', 'isat']), In: pickN(o, ['In', 'in']) };
    };
    K.eslOf = function (kind, lead) {                               // Anschlussinduktivitaet (SPEC 4.3: 5 nH bzw. 6 nH plus 1 nH/mm)
      const P = CORE.filter && CORE.filter.parts, e0 = P && P[kind] ? pickN(P[kind], ['esl0', 'esl', 'ESL0']) : NaN, pm = P ? pickN(P, ['eslPerMm', 'eslMm']) : NaN;
      const a = isNum(e0) ? e0 : (kind === 'cy' ? 6e-9 : 5e-9), b = isNum(pm) ? pm : 1e-9;      // Notfall-Werte aus SPEC 4.3
      return a + b * (lead * 1e3);
    };
    K.fresCap = function (C, lead, kind) {
      const esl = K.eslOf(kind || 'cx', lead);
      let r = NaN; try { r = pickN(CORE.filter.fres({ type: kind === 'cy' ? 'cy' : 'cx', c: C, lead, esl }), ['f', 'fres', 'hz']); } catch (e) { r = NaN; }
      return { f: isNum(r) ? r : 1 / (2 * Math.PI * Math.sqrt(esl * C)), esl };      // Notfall: Formel SPEC 4.3
    };
    K.fresDr = function (id) {
      const p = K.part(id); if (!p || !(p.L > 0) || !(p.Cw > 0)) return null;
      let r = NaN; try { r = pickN(CORE.filter.fres({ type: 'drossel', kind: 'drossel', id, L: p.L, Cw: p.Cw }), ['f', 'fres', 'hz']); } catch (e) { r = NaN; }
      return { f: isNum(r) ? r : 1 / (2 * Math.PI * Math.sqrt(p.L * p.Cw)), L: p.L, Cw: p.Cw, Isat: p.Isat, In: p.In };
    };
    K.satur = function (flt) {                                      // Anteil der Induktivitaet in % (Saettigung) und Isat
      const p = K.part(flt.drossel);
      let pct = NaN;
      try { const r = CORE.filter.satur(flt); pct = pickN(r, ['pct', 'percent', 'prozent', 'satur']); if (!isNum(pct) && r && isNum(r.ratio)) pct = r.ratio * 100; if (isNum(pct) && pct <= 1.0001 && pct > 0 && !(r && isNum(r.pct))) pct *= 100; } catch (e) { pct = NaN; }
      if (!isNum(pct)) pct = p && p.Isat > 0 ? 100 / (1 + Math.pow(flt.iLast / p.Isat, 2)) : 100;            // Notfall (SPEC 4.3)
      return { pct: clamp(pct, 0, 100), Isat: p ? p.Isat : NaN };
    };
    // ---- Grenzlinien und Pruefmodell ----
    K.limitAt = (id, f) => { let v = null; try { v = CORE.limits.at(id, f); } catch (e) { v = null; } return isNum(v) ? v : null; };
    K.limitPts = function (id) {
      let r = null; try { r = CORE.limits.pts(id); } catch (e) { r = null; }
      if (r && !Array.isArray(r) && Array.isArray(r.pts)) r = r.pts;
      if (Array.isArray(r) && r.length > 1) { const a = r.map(q => (Array.isArray(q) ? [q[0], q[1]] : [q && q.f, q && q.L])).filter(q => isNum(q[0]) && isNum(q[1])); if (a.length > 1) return a; }
      const a = []; for (let i = 0; i <= 60; i++) { const f = 1.5e5 * Math.pow(30e6 / 1.5e5, i / 60), v = K.limitAt(id, f); if (v !== null) a.push([f, v]); }
      return a.length > 1 ? a : null;
    };
    K.assessConducted = function (lines, klasse) {
      let r = null; try { r = CORE.assess.conducted(lines, klasse === 'A' ? 'A' : 'B'); } catch (e) { r = null; }
      if (!r || typeof r !== 'object') return { ok: false, ampel: 'grau', text: 'Die Prüfung ist nicht möglich.' };
      return { ok: r.ok !== false && ampelNorm(r.ampel) !== 'rot', ampel: ampelNorm(r.ampel), margin: isNum(r.margin) ? r.margin : NaN, freq: isNum(r.freq) ? r.freq : NaN, text: typeof r.text === 'string' ? r.text : '', raw: r };
    };
    return K;
  }

  // =====================================================================================================================
  //  Pruefung einer Anlagenbeschreibung (fuer alle Rig-Pakete in den Tests)
  // =====================================================================================================================
  function checkDef(spec) {
    const errs = [], seen = {};
    if (!spec || !spec.id) return ['Anlage ohne id'];
    (spec.controls || []).forEach(c => {
      if (!c.key) { errs.push('Steuerwert ohne key'); return; }
      if (seen[c.key]) errs.push('Schlüssel doppelt: ' + c.key); seen[c.key] = 1;
      if (!c.help) errs.push(c.key + ': help fehlt');
      if (!c.label) errs.push(c.key + ': label fehlt');
      if (!c.lever && !(spec.noLever || []).includes(c.key) && c.type !== 'button') errs.push(c.key + ': lever fehlt');
      if (c.lever && !LEVERS[c.lever]) errs.push(c.key + ': unbekannter Hebel ' + c.lever);
      if (c.type === 'slider') {
        if (!(c.min < c.max)) errs.push(c.key + ': min < max verletzt');
        if (!(c.value >= c.min && c.value <= c.max)) errs.push(c.key + ': value außerhalb des Bereichs');
        if (c.scale === 'log' && !(c.min > 0)) errs.push(c.key + ': log-Slider mit min <= 0');
      } else if (c.type === 'select') {
        if (!c.options || !c.options.length) errs.push(c.key + ': options fehlen');
        else if (!c.options.some(o => o.value === c.value)) errs.push(c.key + ': value nicht in options');
      }
    });
    (spec.meters || []).forEach(m => { if (!m.key || !m.label) errs.push('Messgerät ohne key/label'); });
    if (!spec.chain || !spec.chain.quelle || !spec.chain.pfad || !spec.chain.senke) errs.push('chain braucht quelle, pfad und senke');
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
    let lastKey = null, lastLever = null, act = [], prevAct = {}, fired = false;
    let hits = [], hitsW = 0, hitsH = 0;
    const anim = { tw: {}, ps: {}, quality: 'hoch', reduced: false, lastT: null, ghost: null };

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
        const nv = num(v, NaN);                                   // Zahlenwerte als Text (zum Beispiel '1e-6' oder '4,7e-9') und kleine Rundungsabweichungen
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
        if (typeof key !== 'string' || !dmap[key]) return false;
        const d = dmap[key], r = validate(key, value);
        if (!r.ok) return false;
        if (d.type === 'button') { if (key === 'fire') return fire(); if (P.onButton) return !!P.onButton(key); return true; }
        if (ctl[key] === r.v) return true;
        const old = ctl[key]; ctl[key] = r.v;
        lastKey = key; if (d.lever) lastLever = d.lever;
        bump();
        if (P.onControl) P.onControl(key, old);
        return true;
      } catch (e) { return false; }
    }
    const getControl = key => ctl[key];
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
      if (isNum(a.freq)) o.freq = a.freq;
      if (a.kriterium !== undefined) o.kriterium = a.kriterium;
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
      Object.assign(s, { simT, phase, version, ampel: a.ampel, ok: a.ok, lever: lastLever, lastKey, fired, ctl: Object.assign({}, ctl) });
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
      return c.map(cv => { const o = Object.assign({}, cv, { series: cleanSeries(cv.series), marker: cleanMarker(cv.marker) }); if (Array.isArray(cv.markers)) o.markers = cv.markers.map(cleanMarker).filter(Boolean); return o; });
    }
    function spectrum(o) {
      let s; try { s = P.spectrum(res(), ctl, o || {}); } catch (e) { s = null; }
      if (!s) return null;
      const fl = isNum(s.floor) ? s.floor : -60;
      const lines = (s.lines || []).filter(l => l && isNum(l.f) && isNum(l.L)).map(l => {
        const q = { f: l.f, L: Math.max(fl, l.L) };
        if (isNum(l.Lcm)) q.Lcm = Math.max(fl, l.Lcm); if (isNum(l.Ldm)) q.Ldm = Math.max(fl, l.Ldm);
        return q;
      });
      return Object.assign({}, s, { lines, floor: fl });
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
      if (!e || e.cap !== cap) { e = anim.ps[key] = { sys: createParticles(paths, { max: cap, seed: seed + key.length, speed: (o2 && o2.speed) || 90, glow: qp.glow }), cap, sig }; }
      else if (e.sig !== sig) { e.sys.setPaths(paths); e.sig = sig; }
      paths.forEach((p, i) => e.sys.setRate(i, p.rate));
      return e.sys;
    }

    // ---- Vorher / Nachher ----
    function snapshot() { return { id: spec.id, v: 1, ctl: Object.assign({}, ctl) }; }
    function restore(s) {
      try {
        if (!s || typeof s !== 'object' || s.id !== spec.id || !s.ctl || typeof s.ctl !== 'object') return false;
        resetControls();
        Object.keys(s.ctl).forEach(k => { const r = validate(k, s.ctl[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
        bump(); if (P.onControl) P.onControl('*', null);
        return true;
      } catch (e) { return false; }
    }
    function applyPreset(id) {
      const p = (spec.presets || []).find(q => q.id === id); if (!p) return false;
      resetControls();
      const pv = p.params || p.controls || {};
      Object.keys(pv).forEach(k => { const r = validate(k, pv[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
      lastKey = null; lastLever = null;
      bump(); if (P.onControl) P.onControl('*', null);
      return true;
    }
    function reset() {
      resetControls(); ev.length = 0; act = []; prevAct = {}; phase = 0; simT = 0; fired = false; lastKey = null; lastLever = null;
      anim.tw = {}; anim.ps = {}; anim.ghost = null; cache = null;
      if (P.reset) P.reset();
      bump();
      if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
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
    function viewOf() { return { ctl, res: res(), st: state(), ampel: assess(), diag: act, rig: api, anim, phase, simT, lever: lastLever }; }
    function scene(ctx, w, h, t, o, rigView, tw, asGhost, peer) {
      const qp = quality(o.quality), pal = palette(o.theme);
      const sc = { hit: (key, x, y, w2, h2, to) => { if (!asGhost && key && dmap[key] && okv(x, y, w2, h2)) hits.push({ key, x, y, w: w2, h: h2, to }); }, quality: o.quality, qp, reduced: !!o.reduced, header: o.header !== false, pal, theme: o.theme || 'dark', D: opts.noDraw ? null : getDraw(), t, gfx, B: base, peer: peer || null, ps: asGhost ? ((k, p) => createParticles(p, { max: 8 })) : getPS, tw: tw || anim.tw, fs: gfx.fz(w), ghost: !!asGhost, active: lastLever };
      if (P.draw) P.draw(ctx, w, h, t, rigView, sc);
    }
    function draw(ctx, w, h, t, o) {
      if (!ctx || !isNum(w) || !isNum(h) || !(w > 0) || !(h > 0) || w >= 1e7 || h >= 1e7) return;
      t = num(t, 0);
      o = o && typeof o === 'object' ? o : {};
      o = { quality: QUAL[o.quality] ? o.quality : 'hoch', reduced: !!o.reduced, header: o.header !== false, ghost: o.ghost || null, wipe: isNum(o.wipe) ? clamp(o.wipe, 0, 1) : null, theme: o.theme === 'light' ? 'light' : 'dark' };
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
          // Teilungslinie, Griff (>= 40 px) und Beschriftung
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
      return Object.assign({ kind: dmap[r.key].type === 'select' ? 'select' : dmap[r.key].type }, r);
    }

    // roles aus controls[].lever abgeleitet (nicht parallel pflegen)
    const roles = { quelle: [], pfad: [], senke: [] };
    defs.forEach(c => { if (c.lever && roles[c.lever]) roles[c.lever].push(c.key); });

    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    bump();

    const api = {
      id: spec.id, name: spec.name, icon: spec.icon, info: spec.info, chain: spec.chain, roles, controls: defs, meters: spec.meters, presets: spec.presets, params, events: ev,
      setControl, getControl, getControls, step, readMeters, state, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset,
      worldSize() { return { w: world.w, h: world.h }; },
      stats() { return { computes, draws: drawCount, version, particles: Object.keys(anim.ps).map(k => anim.ps[k].sys.count()) }; },
      drawError() { return drawError; },
      leverOf(key) { return dmap[key] ? dmap[key].lever || null : null; },
      _view: viewOf, _tw() { return anim.tw; }
    };
    if (P.spectrum) api.spectrum = spectrum;
    if (P.waveform) api.waveform = waveform;
    if (P.fire) api.fire = fire;
    if (P.fieldAt) api.fieldAt = (x, y) => { try { return P.fieldAt(x, y, res(), ctl); } catch (e) { return NaN; } };
    if (P.extend) P.extend(api, { res, ctl, say, bump });
    return api;
  }

  const base = { version: '1.0', clamp, num, fin, isNum, fm, fn, eng, okv, dok, core, getDraw, mulberry32, LEVERS, AMP, ampelNorm, ampelFromMargin, palette, leverColor, ampelColor, QUAL, quality,
    gfx, createParticles, mockCtx, checkDef, makeRig, FONT, kit, NOFILTER };
  R.base = base;
})(typeof window !== 'undefined' ? window : globalThis);
