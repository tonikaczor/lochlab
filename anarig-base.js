/* anarig-base.js - ANA-Lab: Registry ANA_RIGS und gemeinsame Huelle der Pruefstaende (ANA_RIGS.base), Paket WP2a.
 *
 * Browser-Ladereihenfolge: anacore.js, anacore-op.js, anacore-res.js, anadraw.js, DIESE Datei, anarig-*.js. In Node holen sich die Rig-Dateien die Basis per require.
 * Abhaengigkeiten: ANA_CORE (anacore.js) wird erst beim Erzeugen eines Pruefstands gebraucht (create); ANA_DRAW (anadraw.js) ist OPTIONAL
 * (ohne ANA_DRAW zeichnen die Szenen mit den einfachen Rueckfall-Helfern `B.gfx`/`B.FB`; mit ANA_DRAW steht es als `sc.D` bereit).
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Alle Anlagenwerte sind Uebungswerte.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  VERTRAG (ANA_RIGS.base.makeRig, Schnittstelle SPEC 5.0; gleiche Huelle wie wslrig-base.js mit diesen Aenderungen)
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  Eine Rig-Datei registriert  ANA_RIGS.register({ id, name, icon, info, controls, meters, presets, create(opts) { return B.makeRig(SPEC, opts); } })
 *  mit der Anlagenbeschreibung SPEC:
 *   { id, name, icon, info, world:{w,h},
 *     sicht:{ kennlinie, signal, formel }   (drei Texte NUR hier; Leiste "Kennlinie - Signal - Formel"; es gibt kein `phasors`, kein `spectrum`, kein `pfad`, kein `chain`, kein `ebene`),
 *     controls:[ { key, label, type:'slider'|'switch'|'select'|'button', min, max, step, scale:'log'|'lin', unit, unitKind, value, options:[{value,label}],
 *                  gruppe:'quelle'|'bauteile'|'last'|'fehler'|'ziel' (Pflicht), group (Anzeigename, wird aus GRUPPEN gesetzt, B.fillControls),
 *                  sicht:'kennlinie'|'signal'|'formel'|null (Schluessel MUSS vorhanden sein, null = reine Vorgabe), help (Pflicht, einzige Quelle der Tooltips),
 *                  visible(state)?, logZero? } ],
 *       JEDE Anlage hat GENAU EIN select `fehler` (gruppe 'fehler', erste Option `keiner`, mindestens vier weitere); B.checkDef prueft das.
 *     meters:[ { key, label, unit, digits, min, max, warnAbove?, warnBelow?, infAbove? (Standard 1e11 -> Anzeige "∞"), help, zeroIsNone?, texts?:[Text je ganzzahligem Messwert] } ],
 *     presets:[ { id, name, info?, controls:{ key:wert } } ],
 *     zielKeys:[ 'ziel', ... ]   Steuerwerte der Vorgabe: ist keiner groesser als 0, liefert assess() IMMER grau ("ohne Vorgabe grau"),
 *     params:{ Anlagenkonstanten },
 *     plant(P0) -> Modell mit
 *        compute(ctl, params, CORE) -> res          (Beharrungszustand, gecacht, nur bei Aenderung neu berechnet; der Fehlerfall wird HIER in Eingaben umgesetzt)
 *        meters(res, ctl) -> { key: Zahl }          (Anzeigeeinheit, immer endlich)
 *        assess(res, ctl, o) -> { ok, ampel, text, margin?, ziel?, rows? }   (nur aufgerufen, wenn eine Vorgabe gesetzt ist; o.verdeckt: Text darf den Fehler NICHT verraten)
 *        diag(res, ctl) -> [ { id, kind:'info'|'warn'|'error', text, verraet? } ]   (verraet:true = die Meldung nennt den Fehlerfall; bei verdecktem Fehler unterdrueckt)
 *        befund?(res, ctl) -> [ { id, kind:'info', text } ]   (nur Messbefunde; wird bei verdecktem Fehler zusaetzlich geliefert, nennt nie die Ursache)
 *        curves(res, ctl) -> [ Kurve ... ]  ,  waveform?(res, ctl, o)
 *        state?(res, ctl)   draw(ctx, w, h, t, view, sc)   phaseHz?(res, ctl)   step?(dtMs, res, ctl)   onControl?(key, old)   fire?()   reset?()
 *   }
 *  STEUERWERTE: Werte stehen in der SI-Einheit des Schluessels (V, A, Ohm, H, F, Hz, s), Ausnahmen stehen am Schluessel (Grad C fuer temp).
 *
 *  Rig-Objekt: id, name, icon, info, sicht, controls, meters, presets, params, events, simOnly,
 *  setControl, getControl, getControls, step, readMeters, state, draw, hitTest, curves, reset, assess, diagnose(opts?), snapshot, restore, applyPreset, worldSize,
 *  fire (wenn die Anlage es hat), waveform (nur wenn die Anlage ein Zeitbild hat), setSpeed/getSpeed (Zeitlupe 0,05 ... 2), ariaLabel(), sichtOf(key), stats(), drawError(),
 *  VERDECKTER FEHLER (Fehlersuche): setLock(keys) sperrt Steuerwerte (setControl, applyPreset und restore lassen sie in Ruhe), setHidden(keys) verdeckt Steuerwerte;
 *  ist `fehler` verdeckt, nennt KEINE Ausgabe der Anlage (Meldungen, Ampeltext, aria-label, Bild) den Fehlerfall; diagnose({verdeckt:true}) liefert nur Messbefunde.
 *  getLock(), getHidden(), isVerdeckt(). opts.lock / opts.hidden setzen beides schon beim Erzeugen. reset() stellt die Werte aus opts wieder her.
 *  HINWEIS: state() und getControls() enthalten den Fehlerwert (Speichern, Aufgabenpruefung); die Oberflaeche zeigt ihn bei verdecktem Fehler NIE an (zeigt "Fehler: ?").
 *  state() enthaelt alle Steuerwerte, dazu simT (s), animT (s, Zeitlupe), speed, zeitlupe, phase (0..1), version, ampel, ok, sicht (zuletzt bediente Sicht), lastKey, fired, verdeckt, ctl.
 *  draw(ctx, w, h, t, opts): opts = { quality:'hoch'|'mittel'|'niedrig', reduced, ghost:snapshot|null, wipe:0..1|null, theme:'dark'|'light', header:false, band:true }.
 *  Das Hinweisband (TEXTS.simOnly) liegt in der Oberflaeche (schliessbar, einmal je Anlage, `rig.simOnly`); im Bild nur mit opts.band === true.
 *  Szene: sc = { rect (Inhaltsflaeche unter Kopf), quality, reduced, header, pal, theme, D, t (Zeitlupenzeit s), gfx, B, view(name, rect, data, o) (ANA_DRAW mit Rueckfall), hit(key,x,y,w,h,to?), ghost, active }.
 *  Einheitliche Regeln: setControl klemmt in den Bereich, lehnt Unbekanntes ab (false), wirft nie, ist idempotent; readMeters/state/curves nur endliche Zahlen.
 *  Tabellen: B.GRUPPEN (fuenf Gruppen), B.SICHTEN (Kennlinie, Signal, Formel), B.devAmpel/devText (Fenster aus ANA_CORE.limits: fenster_gruen/gelb, fenster_op_gruen/gelb).
 */
(function (root) {
  'use strict';
  const R = root.ANA_RIGS = root.ANA_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.ORDER) R.ORDER = ['diode', 'schalter', 'emitter', 'folger', 'opv_inv', 'opv_nin', 'opv_komp', 'opv_aktiv'];
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
  const MINUS = '−';
  const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; let s = v.toFixed(d === undefined ? 1 : d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', MINUS); };
  const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
  const PREF = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']];
  /** Technische Schreibweise mit Einheitenvorsatz und Dezimalkomma (`2,2 nF`, `88,8 Ω`). */
  function eng(v, unit, sig) {
    v = +v; unit = unit || '';
    if (!isFinite(v)) return '–' + (unit ? ' ' + unit : '');
    if (v === 0) return '0' + (unit ? ' ' + unit : '');
    sig = sig || 3;
    let e3 = clamp(Math.floor(Math.log10(Math.abs(v)) / 3) * 3, -12, 9);
    let m = v / Math.pow(10, e3);
    const dg = x => Math.max(0, Math.abs(x) >= 100 ? sig - 3 : Math.abs(x) >= 10 ? sig - 2 : sig - 1);
    let s = fn(m, dg(m));
    if (Math.abs(Number(s.replace(MINUS, '-').replace(',', '.'))) >= 1000 && e3 < 9) { e3 += 3; m = v / Math.pow(10, e3); s = fn(m, dg(m)); }
    const p = (PREF.find(q => q[0] === e3) || [0, ''])[1];
    return s + ' ' + p + unit;
  }
  /** Wert mit vier gueltigen Stellen, Dezimalkomma und Einheit ohne Vorsatz (`325,3 V`); fuer Texte und Ampelmeldungen. */
  function val(v, unit, dec) {
    v = +v; if (!isFinite(v)) return '–' + (unit ? ' ' + unit : '');
    if (dec !== undefined) return fm(v, dec) + (unit ? ' ' + unit : '');
    let s = v === 0 ? '0' : (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3 ? (Math.abs(v) >= 1e4 ? String(Math.round(v)) : v.toExponential(2)) : String(Number(v.toPrecision(4))));
    return s.replace('.', ',').replace('-', MINUS) + (unit ? ' ' + unit : '');
  }
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  function core() {
    const c = tryRequire('./anacore.js') || root.ANA_CORE;      // der echte Kern ersetzt ein geladenes Stub-ANA_CORE
    if (!c) throw new Error('ANA_CORE (anacore.js) ist nicht geladen.');
    tryRequire('./anacore-op.js'); tryRequire('./anacore-res.js');  // Teil 2 und 3 haengen sich an dasselbe Objekt (falls vorhanden)
    return root.ANA_CORE || c;
  }
  const getDraw = () => root.ANA_DRAW || tryRequire('./anadraw.js') || root.ANA_DRAW || null;

  // =====================================================================================================================
  //  Tabellen: Gruppen und Sichten (EINE Tabelle fuer Bedienpult und Sichtenleiste), Ampel, Palette
  // =====================================================================================================================
  const GRUPPEN = { quelle: 'Quelle', bauteile: 'Bauteile', last: 'Last', fehler: 'Fehlerfall', ziel: 'Vorgabe und Anzeige' };
  const SICHTEN = { kennlinie: 'Kennlinie', signal: 'Signal', formel: 'Formel' };
  const AMP = {
    gruen: { id: 'gruen', name: 'grün', sym: '✓' }, gelb: { id: 'gelb', name: 'gelb', sym: '!' },
    rot: { id: 'rot', name: 'rot', sym: '✗' }, grau: { id: 'grau', name: 'grau', sym: '–' }
  };
  function ampelNorm(a) {
    if (a === 'grün' || a === 'gruen' || a === 'green' || a === 'ok') return 'gruen';
    if (a === 'gelb' || a === 'warn') return 'gelb';
    if (a === 'rot' || a === 'bad') return 'rot';
    return 'grau';
  }
  const PAL = {
    dark: { theme: 'dark', bg: '#0f172a', panel: '#1e293b', panel2: '#27364d', line: '#64748b', grid: '#334155', fg: '#f1f5f9', mute: '#a9b6c9',
      u: '#60a5fa', i: '#fb923c', out: '#4ade80', err: '#f87171', gnd: '#a3b0c2', mark: '#ffffff', markEdge: '#0f172a',
      ok: '#4ade80', warn: '#fde047', bad: '#f87171', none: '#a9b6c9' },
    light: { theme: 'light', bg: '#ffffff', panel: '#f1f5f9', panel2: '#e2e8f0', line: '#64748b', grid: '#cbd5e1', fg: '#0f172a', mute: '#475569',
      u: '#1d4ed8', i: '#b45309', out: '#15803d', err: '#b91c1c', gnd: '#475569', mark: '#ffffff', markEdge: '#0f172a',
      ok: '#15803d', warn: '#854d0e', bad: '#b91c1c', none: '#475569' }
  };
  function palette(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    let p = null;
    try { const D = getDraw(); p = D && typeof D.palette === 'function' ? D.palette(t) : null; } catch (e) { p = null; }
    const out = Object.assign({}, PAL[t], p && typeof p === 'object' ? p : {});
    out.theme = t;
    ['gruen', 'gelb', 'rot', 'grau'].forEach((k, i) => { out[k] = out[['ok', 'warn', 'bad', 'none'][i]] || PAL[t][k]; });
    out.panel2 = out.panel2 || PAL[t].panel2;
    return out;
  }
  const ampelColor = (a, pal) => ((pal || PAL.dark)[ampelNorm(a)]);

  const QUAL = {
    hoch: { name: 'hoch', points: 600, glow: true },
    mittel: { name: 'mittel', points: 300, glow: true },
    niedrig: { name: 'niedrig', points: 120, glow: false }
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
        if (k === 'fillText' || k === 'strokeText') return (s, x, y, mw) => { log.calls++; log.by[k] = (log.by[k] || 0) + 1; log.texts.push({ s: String(s), x: x + tx, y: y + ty, mw, align: o.textAlign, px: fontPx(o.font), rot, stroke: k === 'strokeText' }); };
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
        if (t.rot || t.stroke) return;
        const wd = Math.min(t.mw === undefined ? 1e9 : t.mw, t.s.length * t.px * 0.55);
        const x0 = t.align === 'center' ? t.x - wd / 2 : t.align === 'right' || t.align === 'end' ? t.x - wd : t.x;
        if (x0 < -1 || x0 + wd > w + 1 || (h !== undefined && (t.y < 0 || t.y - t.px > h + 1))) n++;
      });
      return n;
    };
    return ctx;
  }

  // =====================================================================================================================
  //  Einfache Zeichenhelfer (gfx): Rueckfall ohne ANA_DRAW; Fehlerfall zeichnet nichts und liefert false
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
      const size = Math.max(11, o.size || 12);
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
    /** Sichtenleiste Kennlinie - Signal - Formel (Rueckfall ohne ANA_DRAW.chainBar); `active` = zuletzt bediente Sicht. Mindestgroesse 220 x 44. */
    function sichtBar(ctx, x, y, w, h, sicht, active, o) {
      o = o || {}; const pal = o.pal || PAL.dark;
      if (!sicht || !okv(x, y, w, h) || w < 220 || h < 44) return false;
      const items = [['kennlinie', pal.u], ['signal', pal.i], ['formel', pal.out]], gap = 10, bw = (w - 2 * gap) / 3, size = o.size || fz(w);
      const dashes = { kennlinie: [], signal: [7, 3], formel: [2, 3] };
      items.forEach((it, i) => {
        const bx = x + i * (bw + gap), on = active === it[0];
        panel(ctx, bx, y, bw, h, pal.panel, null, 8);
        ctx.strokeStyle = on ? pal.fg : it[1]; ctx.lineWidth = on ? 3 : 1.5;
        if (ctx.setLineDash) ctx.setLineDash(dashes[it[0]]);
        rr(ctx, bx, y, bw, h, 8); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
        text(ctx, SICHTEN[it[0]], bx + 9, y + size + 2, { size: size, bold: true, color: it[1], max: bw - 14 });
        text(ctx, sicht[it[0]] || '', bx + 9, y + h - 8, { size: size, color: pal.fg, max: bw - 14 });
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
    /** Textblock aus Zeilen { t, bold?, color?, size? }; jede Zeile wird gekuerzt; liefert die Zahl der gezeichneten Zeilen. */
    function lines(ctx, rect, rows, pal, o) {
      o = o || {}; const size = o.size || 12, lh = o.lh || size + 5;
      let y = rect.y + (o.top === undefined ? 8 : o.top) + size, n = 0;
      for (let i = 0; i < rows.length; i++) {
        if (y > rect.y + rect.h - 2) break;
        const r = rows[i]; if (!r || r.t === undefined || r.t === '') continue;
        text(ctx, r.t, rect.x + 8, y, { size: r.size || size, bold: !!r.bold, color: r.color || pal.fg, max: rect.w - 16 });
        y += lh; n++;
      }
      return n;
    }
    return { font, fz, rr, panel, fit, text, line, arrow, dot, ampelSym, ampelRow, sichtBar, rgba, bar, chip, lines };
  })();

  // =====================================================================================================================
  //  Rueckfall-Zeichner (nur wenn ANA_DRAW fehlt oder false liefert): scope, curve, family, schematic
  //  Datenformate wie ANA_DRAW (SPEC 7); zeichnen sparsam, aber mit Beschriftung und Einheit an jeder Achse.
  // =====================================================================================================================
  const KIND_COL = { u: 'u', i: 'i', out: 'out', err: 'err', line: 'fg', ref: 'mute', ghost: 'mute', tangent: 'mute' };
  const KIND_DASH = { u: [], i: [6, 4], out: [14, 5], err: [2, 4], line: [9, 3, 2, 3], ref: [4, 4], ghost: [3, 4], tangent: [2, 3] };
  const kindName = (kind, name) => { if (KIND_COL[kind]) return kind; const c = String(name || '').charAt(0).toLowerCase(); return c === 'u' ? 'u' : c === 'i' ? 'i' : 'ref'; };
  const FB = {
    scope(ctx, r, d, pal) {
      if (!d || !Array.isArray(d.t) || d.t.length < 2 || !Array.isArray(d.series) || !d.series.length || r.w < 120 || r.h < 80) return false;
      const x0 = r.x + 44, x1 = r.x + r.w - 10, y0 = r.y + 16, y1 = r.y + r.h - 30;
      gfx.panel(ctx, r.x, r.y, r.w, r.h, pal.panel, pal.line, 6);
      const tmin = d.t[0], tmax = d.t[d.t.length - 1];
      if (!(tmax > tmin)) return false;
      const lim = d.series.map(s => (s.y || []).reduce((m, v) => Math.max(m, isNum(v) ? Math.abs(v) : 0), 0) || 1);
      const unit0 = d.series[0].unit, cy = (y0 + y1) / 2, hh = (y1 - y0) / 2 - 2;
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
      d.series.forEach((s, k) => {
        const kn = kindName(s.kind, s.name), scale = (s.unit === unit0 ? Math.max.apply(null, lim.filter((v, j) => d.series[j].unit === unit0)) : lim[k]);
        const pts = (s.y || []).map((v, j) => [x0 + (x1 - x0) * (d.t[j] - tmin) / (tmax - tmin), cy - hh * (isNum(v) ? v : 0) / scale]);
        gfx.line(ctx, pts, pal[KIND_COL[kn]], 2, KIND_DASH[kn]);
        gfx.text(ctx, (s.name || '') + (s.unit ? ' in ' + s.unit : '') + (s.unit !== unit0 ? ' (Maßstab angepasst)' : ''), x0 + 6 + k * 130, y0 + 2, { size: 11, color: pal[KIND_COL[kn]], base: 'top', max: 126 });
      });
      gfx.text(ctx, 't in ' + (d.tUnit || 'ms'), x1, r.y + r.h - 8, { size: 11, color: pal.mute, align: 'right' });
      return true;
    },
    curve(ctx, r, d, pal) {
      if (!d || !Array.isArray(d.series) || !d.series.length || r.w < 120 || r.h < 80) return false;
      gfx.panel(ctx, r.x, r.y, r.w, r.h, pal.panel, pal.line, 6);
      const all = [].concat.apply([], d.series.map(s => s.points || []));
      if (all.length < 2) return false;
      const xs = all.map(p => p[0]), ys = all.map(p => p[1]), xl = d.xScale === 'log';
      const fx = v => (xl ? Math.log10(Math.max(v, 1e-300)) : v), a = Math.min.apply(null, xs.map(fx)), b = Math.max.apply(null, xs.map(fx));
      const c = Math.min.apply(null, ys), e = Math.max.apply(null, ys);
      if (!(b > a)) return false;
      const x0 = r.x + 42, x1 = r.x + r.w - 10, y0 = r.y + 12, y1 = r.y + r.h - 28, de = (e - c) || 1;
      d.series.forEach((s, k) => { const kn = kindName(s.kind, s.name), kk = KIND_COL[kn] ? kn : ['u', 'i', 'out', 'err'][k % 4]; gfx.line(ctx, (s.points || []).map(p => [x0 + (x1 - x0) * (fx(p[0]) - a) / (b - a), y1 - (y1 - y0) * (p[1] - c) / de]), pal[KIND_COL[kk]], 2, KIND_DASH[kk]); });
      if (d.marker && isNum(d.marker.x) && isNum(d.marker.y)) gfx.dot(ctx, x0 + (x1 - x0) * (fx(d.marker.x) - a) / (b - a), y1 - (y1 - y0) * (d.marker.y - c) / de, 5, pal.mark);
      gfx.text(ctx, (d.xLabel || '') + ' in ' + (d.xUnit || ''), x1, r.y + r.h - 8, { size: 11, color: pal.mute, align: 'right', max: r.w - 20 });
      return true;
    },
    family(ctx, r, d, pal) {
      if (!d || !Array.isArray(d.uce) || d.uce.length < 3 || !Array.isArray(d.series) || !d.series.length || r.w < 140 || r.h < 100) return false;
      gfx.panel(ctx, r.x, r.y, r.w, r.h, pal.panel, pal.line, 6);
      const x0 = r.x + 42, x1 = r.x + r.w - 10, y0 = r.y + 12, y1 = r.y + r.h - 28, xm = d.uce[d.uce.length - 1] || 1;
      const ym = d.series.reduce((m, s) => Math.max(m, ...(s.ic || []).filter(isNum)), 0) || 1;
      d.series.forEach(s => gfx.line(ctx, (s.ic || []).map((v, j) => [x0 + (x1 - x0) * d.uce[j] / xm, y1 - (y1 - y0) * v / ym]), pal.i, 2, KIND_DASH.i));
      gfx.text(ctx, 'U_CE in V', x1, r.y + r.h - 8, { size: 11, color: pal.mute, align: 'right' });
      return true;
    },
    schematic(ctx, r, d, pal) {
      if (!d || !d.kind || r.w < 100 || r.h < 50) return false;
      gfx.panel(ctx, r.x, r.y, r.w, r.h, pal.panel, pal.line, 6);
      gfx.text(ctx, 'Schaltbild ' + d.kind, r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: pal.mute, align: 'center', base: 'middle', max: r.w - 10 });
      return true;
    }
  };

  // =====================================================================================================================
  //  Hilfen fuer Ampel und Abweichung (Lehrfaustwerte nur aus ANA_CORE.limits)
  // =====================================================================================================================
  function limV(CORE, id, d) { try { const l = CORE.limit(id); return l && isNum(l.value) ? l.value : d; } catch (e) { return d; } }
  function limF(CORE, id) { try { const l = CORE.limit(id); return l && l.frage ? l.frage : ''; } catch (e) { return ''; } }
  /** Fenster in Prozent: kind 'op' (Operationsverstaerker: 2 % / 5 %) oder Standard (5 % / 10 %), Werte aus ANA_CORE.limits (Uebungswerte, F16). */
  function fenster(CORE, kind) {
    const op = kind === 'op';
    return { g: limV(CORE, op ? 'fenster_op_gruen' : 'fenster_gruen', op ? 0.02 : 0.05) * 100, y: limV(CORE, op ? 'fenster_op_gelb' : 'fenster_gelb', op ? 0.05 : 0.1) * 100 };
  }
  /** Abweichung ist ein Prozentwert; gruen bis zum Gruen-Fenster, gelb bis zum Gelb-Fenster, sonst rot (Grenzen exakt: gleich = noch im Fenster). */
  function devAmpel(pct, CORE, kind) {
    const w = fenster(CORE, kind);
    if (!isNum(pct)) return 'grau';
    const tol = 1e-9;
    return pct <= w.g + tol ? 'gruen' : pct <= w.y + tol ? 'gelb' : 'rot';
  }
  /** Standardtext zur Abweichung: nennt Ist, Soll, Abweichung und das Lehrfenster (als Uebungswert mit F-Nummer gekennzeichnet). */
  function devText(name, ist, soll, unit, pct, CORE, kind) {
    const w = fenster(CORE, kind), f = limF(CORE, kind === 'op' ? 'fenster_op_gruen' : 'fenster_gruen');
    return name + ': ist ' + val(ist, unit) + ', Vorgabe ' + val(soll, unit) + ', Abweichung ' + fm(pct, 1) + ' % (grün bis ' + fm(w.g, 0) + ' %, gelb bis ' + fm(w.y, 0) + ' %; Lehrfaustwert, Übungswert' + (f ? ' ' + f : '') + ').';
  }

  // =====================================================================================================================
  //  Pruefung einer Anlagenbeschreibung (fuer alle Rig-Pakete in den Tests)
  // =====================================================================================================================
  function fillControls(arr) { (arr || []).forEach(c => { if (c && c.gruppe && GRUPPEN[c.gruppe] && !c.group) c.group = GRUPPEN[c.gruppe]; }); return arr; }
  function checkDef(spec) {
    const errs = [], seen = {};
    if (!spec || !spec.id) return ['Anlage ohne id'];
    (spec.controls || []).forEach(c => {
      if (!c.key) { errs.push('Steuerwert ohne key'); return; }
      if (seen[c.key]) errs.push('Schlüssel doppelt: ' + c.key); seen[c.key] = 1;
      if (!c.help) errs.push(c.key + ': help fehlt');
      if (!c.label) errs.push(c.key + ': label fehlt');
      if (!GRUPPEN[c.gruppe]) errs.push(c.key + ': gruppe fehlt oder unbekannt');
      if (!Object.prototype.hasOwnProperty.call(c, 'sicht')) errs.push(c.key + ': sicht fehlt (null = reine Vorgabe)');
      else if (c.sicht !== null && !SICHTEN[c.sicht]) errs.push(c.key + ': unbekannte Sicht ' + c.sicht);
      if (Object.prototype.hasOwnProperty.call(c, 'ebene')) errs.push(c.key + ': ebene ist nicht vorgesehen (gruppe/sicht)');
      if (c.type === 'slider') {
        if (!(c.min < c.max)) errs.push(c.key + ': min < max verletzt');
        if (!(c.value >= c.min && c.value <= c.max)) errs.push(c.key + ': value außerhalb des Bereichs');
        if (c.scale === 'log' && !(c.min > 0) && !(c.logZero === true && c.min === 0)) errs.push(c.key + ': log-Slider mit min <= 0 (nur mit logZero: true und min 0 erlaubt)');
        if (c.unit === undefined) errs.push(c.key + ': unit fehlt');
      } else if (c.type === 'select') {
        if (!c.options || !c.options.length) errs.push(c.key + ': options fehlen');
        else if (!c.options.some(o => o.value === c.value)) errs.push(c.key + ': value nicht in options');
      } else if (c.type !== 'switch' && c.type !== 'button') errs.push(c.key + ': unbekannter Typ ' + c.type);
    });
    // genau ein Fehlerfall-Auswahlfeld (SPEC 5.0)
    const fe = (spec.controls || []).filter(c => c.key === 'fehler');
    if (fe.length !== 1) errs.push('genau ein Steuerwert fehler erforderlich');
    else {
      const f = fe[0];
      if (f.type !== 'select') errs.push('fehler muss ein select sein');
      if (f.gruppe !== 'fehler') errs.push('fehler gehört in die Gruppe fehler');
      if (!f.options || f.options[0].value !== 'keiner') errs.push('fehler: erste Option muss keiner sein');
      if (!f.options || f.options.length < 5) errs.push('fehler: keiner und mindestens vier weitere Optionen');
      if (f.value !== 'keiner') errs.push('fehler: Standard muss keiner sein');
    }
    if ((spec.controls || []).filter(c => c.gruppe === 'fehler').length !== 1) errs.push('Gruppe fehler hat genau einen Steuerwert');
    (spec.meters || []).forEach(m => { if (!m.key || !m.label) errs.push('Messgerät ohne key/label'); else if (!m.help) errs.push(m.key + ': Messgerät ohne help'); });
    const s = spec.sicht;
    if (!s || !s.kennlinie || !s.signal || !s.formel) errs.push('sicht braucht kennlinie, signal und formel');
    ['pfad', 'chain', 'ebene', 'phasors', 'spectrum'].forEach(k => { if (spec[k]) errs.push(k + ' ist nicht vorgesehen'); });
    (spec.zielKeys || []).forEach(k => { if (!seen[k]) errs.push('zielKeys: unbekannter Schlüssel ' + k); });
    (spec.presets || []).forEach(p => {
      if (!p.id || !p.name) errs.push('Voreinstellung ohne id/name');
      Object.keys(p.controls || p.params || {}).forEach(k => { if (!seen[k]) errs.push('Voreinstellung ' + p.id + ': unbekannter Schlüssel ' + k); });
    });
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
    const zielKeys = spec.zielKeys || [];
    const ev = [];
    let version = 0, phase = 0, simT = 0, animT = 0, speed = 1, cache = null, cacheVer = -1, computes = 0, drawCount = 0, drawError = null;
    let lastKey = null, lastSicht = null, actRaw = [], befundRaw = [], prevAct = {}, fired = false;
    let hits = [], hitsW = 0, hitsH = 0;
    const keyList = a => (Array.isArray(a) ? a.filter(k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(dmap, k)) : []);
    let lockKeys = keyList(opts.lock), hiddenKeys = keyList(opts.hidden);
    const anim = { quality: 'hoch', reduced: false, ghost: null };
    const isHidden = () => hiddenKeys.indexOf('fehler') >= 0;
    const isLocked = k => lockKeys.indexOf(k) >= 0;

    function resetControls() { defs.forEach(c => { ctl[c.key] = c.value; }); }
    resetControls();

    const say = (text, kind, fx, verraet) => { const e = { t: simT, text: String(text), kind: kind || 'info' }; if (fx) e.fx = fx; if (verraet) e.verraet = true; ev.push(e); if (ev.length > 120) ev.shift(); };
    const bump = () => { version++; };
    const P0 = { ctl, params, say, CORE, seed, opts, bump, anim, B: null, fired: () => fired, verdeckt: isHidden, setCtl(k, v) { if (dmap[k]) { const r = validate(k, v); if (r.ok) { ctl[k] = r.v; bump(); } } } };
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
        if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (s === 'true' || s === 'ein' || s === 'an' || s === 'ja' || s === '1') return { ok: true, v: true }; if (s === 'false' || s === 'aus' || s === 'nein' || s === '0') return { ok: true, v: false }; }
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
        if (isLocked(key)) return false;
        if (ctl[key] === r.v) return true;
        const old = ctl[key]; ctl[key] = r.v;
        lastKey = key; if (d.sicht) lastSicht = d.sicht;
        bump();
        if (P.onControl) P.onControl(key, old);
        return true;
      } catch (e) { return false; }
    }
    const getControl = key => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(dmap, key) ? ctl[key] : undefined);
    const getControls = () => Object.assign({}, ctl);

    // ---- Sperren und Verdecken (Fehlersuche) ----
    function setLock(keys) { lockKeys = keyList(keys); bump(); return lockKeys.slice(); }
    function setHidden(keys) {
      hiddenKeys = keyList(keys);
      // Meldungen, die den Fehlerfall nennen, werden aus dem Verlauf genommen; der naechste Rechengang meldet nur Erlaubtes
      for (let i = ev.length - 1; i >= 0; i--) if (ev[i].verraet) ev.splice(i, 1);
      const keep = {}; actRaw.forEach(d => { if (!d.verraet) keep[d.id] = true; });
      prevAct = keep; bump();
      return hiddenKeys.slice();
    }

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
    function visibleDiag() {
      const v = isHidden();
      let out = actRaw.filter(d => !(v && d.verraet));
      if (v) out = out.concat(befundRaw);
      return out;
    }
    function evaluate() {
      try { actRaw = (P.diag ? P.diag(cache, ctl) : []) || []; } catch (e) { actRaw = []; }
      try { befundRaw = (P.befund ? P.befund(cache, ctl) : []) || []; } catch (e) { befundRaw = []; }
      const cur = {};
      visibleDiag().forEach(d => { cur[d.id] = true; if (!prevAct[d.id]) say(d.text, d.kind, d.fx, !!d.verraet); });
      prevAct = cur;
    }
    function diagnose(o) {
      res();
      const v = o && typeof o === 'object' && o.verdeckt !== undefined ? !!o.verdeckt : isHidden();
      let out = actRaw.filter(d => !(v && d.verraet));
      if (v) out = out.concat(befundRaw);
      return out.map(d => ({ id: d.id, kind: d.kind, text: d.text }));
    }

    const hasZiel = () => zielKeys.some(k => isNum(ctl[k]) && ctl[k] > 0);
    function assess() {
      if (!hasZiel()) return { ok: false, ampel: 'grau', text: 'Keine Vorgabe gesetzt: Die Ampel bleibt grau.' };
      let a;
      try { a = P.assess(res(), ctl, { verdeckt: isHidden() }); } catch (e) { a = null; }
      if (!a || typeof a !== 'object') return { ok: false, ampel: 'grau', text: 'Die Prüfung ist nicht möglich.' };
      const o = { ok: !!a.ok, ampel: ampelNorm(a.ampel), text: String(a.text || '') };
      if (isNum(a.margin)) o.margin = a.margin;
      if (a.ziel !== undefined && a.ziel !== null) o.ziel = a.ziel;
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
      Object.assign(s, { simT, animT, speed, zeitlupe: speed < 1 ? Math.round(10 / speed) / 10 : 0, phase, version, ampel: a.ampel, ok: a.ok, sicht: lastSicht, lastKey, fired, verdeckt: isHidden(), ctl: Object.assign({}, ctl) });
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
      try { c = P.curves ? (P.curves(res(), ctl) || []) : []; } catch (e) { c = []; }
      return c.map(cv => {
        const o = Object.assign({}, cv, { series: cleanSeries(cv.series), marker: cleanMarker(cv.marker) });
        if (cv.limit && isNum(cv.limit.y)) o.limit = Object.assign({}, cv.limit); else if (cv.limit && isNum(cv.limit.x)) o.limit = Object.assign({}, cv.limit); else delete o.limit;
        return o;
      });
    }
    function waveform(o) {
      let w; try { w = P.waveform(res(), ctl, o || {}); } catch (e) { w = null; }
      if (!w) return null;
      return Object.assign({}, w, { t: (w.t || []).map(v => fin(v, 0)), series: (w.series || []).map(s => Object.assign({}, s, { y: (s.y || []).map(v => fin(v, 0)) })) });
    }

    // ---- Animation (nur Phase und Zeitlupe; die Rechnung ist ein Beharrungszustand) ----
    function setSpeed(v) { v = num(v, NaN); if (!isFinite(v)) return false; speed = clamp(v, 0.05, 2); return true; }
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
      dtMs = Math.min(dtMs, 500);
      simT += dtMs / 1000;
      const sdt = dtMs * speed;
      let hz = 0.15;
      try { if (P.phaseHz) hz = fin(P.phaseHz(res(), ctl), 0.15); } catch (e) { hz = 0.15; }
      if (!anim.reduced) { animT += sdt / 1000; phase += sdt / 1000 * hz; phase -= Math.floor(phase); }
      if (P.step) { try { P.step(sdt, res(), ctl); } catch (e) { /* ignorieren */ } }
    }

    // ---- Vorher / Nachher ----
    function snapshot() { return { id: spec.id, v: 1, ctl: Object.assign({}, ctl) }; }
    function applyValues(src) {
      Object.keys(src).forEach(k => { if (!dmap[k] || isLocked(k)) return; const r = validate(k, src[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    }
    function resetUnlocked() { defs.forEach(c => { if (!isLocked(c.key)) ctl[c.key] = c.value; }); }
    function restore(s) {
      try {
        if (!s || typeof s !== 'object' || s.id !== spec.id || !s.ctl || typeof s.ctl !== 'object') return false;
        resetUnlocked();
        applyValues(s.ctl);
        bump(); if (P.onControl) P.onControl('*', null);
        return true;
      } catch (e) { return false; }
    }
    function applyPreset(id) {
      const p = (spec.presets || []).find(q => q.id === id); if (!p) return false;
      resetUnlocked();
      applyValues(p.controls || p.params || {});
      lastKey = null; lastSicht = null;
      bump(); if (P.onControl) P.onControl('*', null);
      return true;
    }
    function reset() {
      resetControls(); ev.length = 0; actRaw = []; befundRaw = []; prevAct = {}; phase = 0; simT = 0; animT = 0; fired = false; lastKey = null; lastSicht = null;
      lockKeys = keyList(opts.lock); hiddenKeys = keyList(opts.hidden);
      anim.ghost = null; cache = null;
      if (P.reset) P.reset();
      bump();
      if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { if (!dmap[k]) return; const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    }
    function fire() { if (!P.fire) return false; const r = P.fire(res(), ctl); fired = true; bump(); return r === undefined ? true : !!r; }

    // ---- Zeichnen ----
    const world = spec.world || { w: 960, h: 600 };
    function ghostRig(snap) {
      const key = JSON.stringify(snap.ctl) + '|' + isHidden();
      if (anim.ghost && anim.ghost.key === key) return anim.ghost.rig;
      let rig = null;
      try { rig = makeRig(spec, { controls: snap.ctl, params: opts.params, seed, noGhost: true, noDraw: opts.noDraw, hidden: hiddenKeys.slice() }); } catch (e) { rig = null; }
      anim.ghost = { key, rig };
      return rig;
    }
    function viewOf() { return { ctl, res: res(), st: state(), ampel: assess(), diag: visibleDiag(), rig: api, anim, phase, simT, animT, sicht: lastSicht, verdeckt: isHidden() }; }
    function ariaLabel() {
      const a = assess(), D = opts.noDraw ? null : getDraw();
      let t = '';
      if (D && typeof D.ariaText === 'function') { try { t = D.ariaText(a.ampel, ''); } catch (e) { t = ''; } }
      if (!t) t = 'Ampel ' + AMP[a.ampel].name + '. ' + ((CORE.TEXTS && CORE.TEXTS.ampelHinweis) || '');
      return spec.name + ': ' + t + (a.text ? ' ' + a.text : '');
    }
    /** Kopfzeile: Ampelzeile und Sichtenleiste "Kennlinie - Signal - Formel". Liefert die Inhaltsflaeche. */
    function head(ctx, w, h, view, sc) {
      const pad = 10, pal = sc.pal, fs = gfx.fz(w);
      if (!sc.header) return { x: 0, y: 0, w, h };
      let y = 6;
      let drawn = false;
      if (sc.D && typeof sc.D.ampel === 'function') { try { drawn = !!sc.D.ampel(ctx, pad, y + 14, view.ampel.ampel, { text: view.ampel.text, size: fs + 1, maxw: w - 2 * pad, theme: sc.theme }); } catch (e) { drawn = false; } }
      if (!drawn) gfx.ampelRow(ctx, pad, y + 14, view.ampel, { pal, size: fs + 1, max: w - 2 * pad });
      y += 34;
      const cw = w - 2 * pad, ch = w < 520 ? 74 : (h >= 380 ? 58 : 46);
      if (cw >= 220 && h >= 200) {
        let done = false;
        if (sc.D && typeof sc.D.chainBar === 'function') { try { done = !!sc.D.chainBar(ctx, { x: pad, y, w: cw, h: ch }, { kennlinie: spec.sicht.kennlinie, signal: spec.sicht.signal, formel: spec.sicht.formel, active: view.sicht || undefined }, { theme: sc.theme, q: sc.quality, reduced: sc.reduced }); } catch (e) { done = false; } }
        if (!done) gfx.sichtBar(ctx, pad, y, cw, ch, spec.sicht, view.sicht, { pal });
        y += ch + 6;
      }
      if (sc.band) {
        const msg = (CORE.TEXTS && CORE.TEXTS.simOnly) || '';
        if (msg) { gfx.text(ctx, msg, pad, y + 8, { size: fs, color: pal.mute, bg: pal.panel, max: w - 2 * pad, base: 'middle' }); y += 20; }
      }
      return { x: pad, y, w: cw, h: Math.max(0, h - y - pad) };
    }
    function scene(ctx, w, h, t, o, rigView, asGhost, peer) {
      const pal = palette(o.theme);
      const D = opts.noDraw ? null : getDraw();
      const sc = { hit: (key, x, y, w2, h2, to) => { if (!asGhost && key && dmap[key] && okv(x, y, w2, h2)) hits.push({ key, x, y, w: w2, h: h2, to }); },
        quality: o.quality, reduced: !!o.reduced, header: o.header !== false, band: o.band === true, pal, theme: o.theme || 'dark', D, t: animT, gfx, B: base, peer: peer || null,
        fs: gfx.fz(w), ghost: !!asGhost, active: rigView && rigView.sicht,
        /** ANA_DRAW-Funktion mit Rueckfall; Rueckgabe true = gezeichnet. */
        view(name, rect, data, o2) {
          if (!rect || !okv(rect.x, rect.y, rect.w, rect.h) || rect.w <= 0 || rect.h <= 0) return false;
          let done = false;
          if (D && typeof D[name] === 'function') {
            try { done = !!D[name](ctx, rect, data, Object.assign({ theme: o.theme || 'dark', q: o.quality, reduced: !!o.reduced, t: animT }, o2 || {})); } catch (e) { done = false; }
          }
          if (!done && FB[name]) { try { done = !!FB[name](ctx, rect, data, pal, o2 || {}); } catch (e) { done = false; } }
          return done;
        } };
      sc.rect = head(ctx, w, h, rigView, sc);
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
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xw, h); ctx.clip(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, xw, h); scene(ctx, w, h, t, o, gv, true, view); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.rect(xw, 0, w - xw, h); ctx.clip(); scene(ctx, w, h, t, o, view, false, gv); ctx.restore();
          ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xw, 0); ctx.lineTo(xw, h); ctx.stroke();
          const gy = h / 2; ctx.beginPath(); ctx.arc(xw, gy, 22, 0, Math.PI * 2); ctx.fillStyle = pal.panel2; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.stroke();
          gfx.arrow(ctx, xw - 4, gy, xw - 14, gy, pal.fg, 2, 5); gfx.arrow(ctx, xw + 4, gy, xw + 14, gy, pal.fg, 2, 5);
          gfx.text(ctx, 'Vorher', Math.max(8, xw - 30), 16, { size: 12, bold: true, color: pal.fg, bg: pal.panel, align: 'right' });
          gfx.text(ctx, 'Nachher', Math.min(w - 8, xw + 30), 16, { size: 12, bold: true, color: pal.fg, bg: pal.panel });
        } else {
          if (g) { ctx.globalAlpha = 0.3; scene(ctx, w, h, t, o, gv, true, view); ctx.globalAlpha = 1; }
          scene(ctx, w, h, t, o, view, false, gv);
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
      if (!r || !dmap[r.key] || isLocked(r.key)) return null;
      return Object.assign({ kind: dmap[r.key].type }, r);
    }

    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { if (!dmap[k]) return; const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    bump();

    const api = {
      id: spec.id, name: spec.name, icon: spec.icon, info: spec.info, sicht: Object.assign({}, spec.sicht), controls: defs, meters: spec.meters, presets: spec.presets, params, events: ev,
      simOnly: (CORE.TEXTS && CORE.TEXTS.simOnly) || '',
      setControl, getControl, getControls, step, readMeters, state, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, ariaLabel, setSpeed,
      setLock, setHidden,
      getLock() { return lockKeys.slice(); },
      getHidden() { return hiddenKeys.slice(); },
      isVerdeckt() { return isHidden(); },
      getSpeed() { return speed; },
      worldSize() { return { w: world.w, h: world.h }; },
      stats() { return { computes, draws: drawCount, version }; },
      drawError() { return drawError; },
      sichtOf(key) { return dmap[key] ? dmap[key].sicht || null : null; },
      _view: viewOf
    };
    if (P.waveform) api.waveform = waveform;
    if (P.fire) api.fire = fire;
    if (P.extend) P.extend(api, { res, ctl, say, bump });
    return api;
  }

  const base = { version: '1.0', clamp, num, fin, isNum, fm, fn, eng, val, okv, core, getDraw, GRUPPEN, SICHTEN, AMP, ampelNorm, palette, ampelColor, QUAL, quality,
    gfx, FB, mockCtx, checkDef, fillControls, devAmpel, devText, fenster, limV, limF, makeRig, FONT, MINUS };
  R.base = base;
})(typeof window !== 'undefined' ? window : globalThis);
