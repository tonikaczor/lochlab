/* ntsrig-base.js - Netzteil-Lab: Registry NTS_RIGS und gemeinsame Huelle der Pruefstaende (NTS_RIGS.base), Paket WP2a.
 *
 * Browser-Ladereihenfolge: ntscore.js, ntscore-sw.js, ntscore-diag.js, ntsdraw.js, DIESE Datei, ntsrig-*.js. In Node holen sich die Rig-Dateien die Basis per require.
 * Abhaengigkeiten: NTS_CORE (ntscore.js) wird erst beim Erzeugen eines Pruefstands gebraucht (create); NTS_DRAW (ntsdraw.js) ist OPTIONAL
 * (ohne NTS_DRAW zeichnen die Szenen mit den einfachen Helfern `B.gfx`; mit NTS_DRAW steht es den Szenen als `sc.D` zur Verfuegung).
 * Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. Alle Anlagenwerte sind Uebungswerte (Status A) oder belegte Werte aus `NTS_CORE.limits`.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  VERTRAG (NTS_RIGS.base.makeRig, Schnittstelle SPEC 5.0; gleiche Huelle wie elsrig-base.js mit diesen Aenderungen)
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *  Eine Rig-Datei registriert  NTS_RIGS.register({ id, name, icon, info, controls, meters, presets, create(opts) { return B.makeRig(SPEC, opts); } })
 *  mit der Anlagenbeschreibung SPEC:
 *   { id, name, icon, info, world:{w,h},
 *     pfad:{ quelle, wandlung, senke, art:'linear'|'getaktet'|'passiv'|'diagnose' }   (Texte nur hier; es gibt kein `chain`, kein `lever`, kein `ebene`),
 *     controls:[ { key, label, type:'slider'|'switch'|'select'|'button', min, max, step, scale:'log'|'lin', unit, unitKind, value, options:[{value,label}],
 *                  group, help, stufe:'trafo'|'gleich'|'sieb'|'regel'|'schalt'|'last'|null (Schluessel MUSS vorhanden sein, null = reine Vorgabe), visible(state)?, logZero? } ],
 *     meters:[ { key, label, unit, digits, min, max, warnAbove?, warnBelow?, help?, zeroIsNone? } ],
 *     presets:[ { id, name, info?, params|controls:{ key:wert } } ],
 *     params:{ Anlagenkonstanten },
 *     plant(P0) -> Modell mit
 *        compute(ctl, params, CORE) -> res          (Beharrungszustand, gecacht, nur bei Aenderung neu berechnet; Rechnung NUR im Kern)
 *        meters(res, ctl) -> { key: Zahl }          (Anzeigeeinheit, immer endlich)
 *        bilanz(res, ctl) -> { pzu, pab, pv:[{stufe,w}], eta? }   (einzige Quelle fuer Blockschaltbild und Verlustbalken)
 *        assess(res, ctl) -> { ok, ampel, text, margin? }
 *        diag(res, ctl) -> [ { id, kind:'info'|'warn'|'error', text, fx?, link? } ]
 *        curves(res, ctl) -> [ Kurve ... ]  ,  waveform?(res, ctl, o) -> { tUnit, t[], series:[{name,y[],unit}], marks? }
 *        state?(res, ctl)   draw(ctx, w, h, t, view, sc)   hit?(x, y, w, h, view)   phaseHz?   step?(dtMs, res, ctl)   onControl?(key, old)   onButton?(key)   fire?()   reset?()
 *   }
 *  STEUERWERTE: Werte stehen in der SI-Einheit des Schluessels (V, A, Ohm, Hz, s), Ausnahmen stehen am Schluessel (µF fuer Kapazitaeten wie im Kern `rect`).
 *
 *  Rig-Objekt: id, name, pfad, roles {trafo,gleich,sieb,regel,schalt,last} (aus controls[].stufe abgeleitet, nicht parallel gepflegt), controls, meters, presets, params, events, simOnly,
 *  setControl, getControl, getControls, step, readMeters, state, bilanz, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, worldSize,
 *  fire (wenn die Anlage es hat), waveform (wenn die Anlage es hat), ariaLabel(), stufeOf(key), stats(), drawError().
 *  state() enthaelt alle Steuerwerte, dazu simT (s), phase (0..1), version, ampel, ok, stufe (zuletzt bediente Stufe), lastKey, fired, ctl.
 *  draw(ctx, w, h, t, opts): opts = { quality:'hoch'|'mittel'|'niedrig', reduced, ghost:snapshot|null, wipe:0..1|null, theme:'dark'|'light', header:false, band:true }.
 *  Das Hinweisband (TEXTS.simOnly) liegt in der Oberflaeche (schliessbar, einmal je Anlage, `rig.simOnly`); im Bild nur mit opts.band === true.
 *  Szene: sc = { rect (Inhaltsflaeche unter Kopf), quality, qp, reduced, header, pal, theme, D, t, beam (Schreibstrahl 0..1, bei reduced 1), phase, gfx, B, peer, hit(key,x,y,w,h,to?),
 *               block(rect) (Blockschaltbild und Verlustbalken aus bilanz()), ghost, active }.
 *  Einheitliche Regeln: setControl klemmt in den Bereich, lehnt Unbekanntes ab (false), wirft nie, ist idempotent; readMeters/state/curves nur endliche Zahlen.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (!R.ORDER) R.ORDER = ['trafo', 'gleich', 'stabil', 'buck', 'topo', 'gate', 'regel', 'fehler'];
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
  const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; let s = v.toFixed(d === undefined ? 1 : d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace(/^-/, '−'); };
  const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
  const PREF = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']];
  /** Technische Schreibweise mit Einheitenvorsatz und Dezimalkomma (`230 mA`, `2,2 kΩ`). */
  function eng(v, unit, sig) {
    v = +v; unit = unit || '';
    if (!isFinite(v)) return '–' + (unit ? ' ' + unit : '');
    if (v === 0) return '0' + (unit ? ' ' + unit : '');
    sig = sig || 3;
    let e3 = clamp(Math.floor(Math.log10(Math.abs(v)) / 3) * 3, -12, 9);
    let m = v / Math.pow(10, e3);
    const dg = x => Math.max(0, Math.abs(x) >= 100 ? sig - 3 : Math.abs(x) >= 10 ? sig - 2 : sig - 1);
    let s = fn(m, dg(m));
    if (Math.abs(Number(s.replace(',', '.').replace('−', '-'))) >= 1000 && e3 < 9) { e3 += 3; m = v / Math.pow(10, e3); s = fn(m, dg(m)); }
    const p = (PREF.find(q => q[0] === e3) || [0, ''])[1];
    return s + ' ' + p + unit;
  }
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  function core() {
    const c = root.NTS_CORE || tryRequire('./ntscore.js') || root.NTS_CORE;
    if (!c) throw new Error('NTS_CORE (ntscore.js) ist nicht geladen.');
    tryRequire('./ntscore-sw.js'); tryRequire('./ntscore-diag.js');    // Teil 2 und 3 haengen sich an dasselbe Objekt (falls vorhanden)
    return c;
  }
  const getDraw = () => root.NTS_DRAW || tryRequire('./ntsdraw.js') || root.NTS_DRAW || null;
  function mulberry32(a) {
    a = (a >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Grenzwert aus NTS_CORE.limits (einzige Quelle); NaN, wenn es ihn nicht gibt. */
  function lim(CORE, id) { try { const v = CORE.limitValue(id); return isNum(v) ? v : NaN; } catch (e) { return NaN; } }
  /** Statuskennzeichen eines Grenzwerts fuer Texte: "Übungswert" oder leer (belegt). */
  function stat(CORE, id) { try { const l = CORE.limit(id); return l && l.status === 'A' ? 'Übungswert' : ''; } catch (e) { return ''; } }
  /** Meldungstext: erst NTS_CORE.TEXTS (einzige Quelle), sonst der lokale Rueckfalltext (wenn die Vorlage dort noch fehlt). */
  function msg(CORE, id, vars, fallback) {
    let t = ''; try { t = CORE.TEXTS.get(id, vars).text || ''; } catch (e) { t = ''; }
    if (t) return t;
    try { return CORE.TEXTS.tpl(fallback, vars) || fallback; } catch (e) { return fallback; }
  }

  // =====================================================================================================================
  //  Tabellen: Stufen (EINE Tabelle: NTS_DRAW.STUFEN, sonst Rueckfall), Ampel, Palette
  // =====================================================================================================================
  const ST_FB = {
    trafo: { name: 'Transformator', sym: 'T' }, gleich: { name: 'Gleichrichtung', sym: 'G' }, sieb: { name: 'Glättung', sym: 'C' },
    regel: { name: 'Regelung', sym: 'R' }, schalt: { name: 'Schalten', sym: 'S' }, last: { name: 'Last', sym: 'L' }
  };
  const ST_COL = { trafo: ['#fbbf24', '#92400e'], gleich: ['#2dd4bf', '#0f766e'], sieb: ['#38bdf8', '#0369a1'], regel: ['#c084fc', '#7e22ce'], schalt: ['#f472b6', '#be185d'], last: ['#a3e635', '#4d7c0f'] };
  const STUFEN = {};
  (function () {
    let L = null; try { const d = root.NTS_DRAW || tryRequire('./ntsdraw.js'); L = d && d.STUFEN; } catch (e) { L = null; }
    Object.keys(ST_FB).forEach(k => {
      const s = L && L[k] ? L[k] : ST_FB[k];
      STUFEN[k] = { key: k, name: s.name || ST_FB[k].name, sym: s.sym || ST_FB[k].sym, color: ST_COL[k][0], colorLight: ST_COL[k][1] };
    });
  })();
  const AMP = {
    gruen: { id: 'gruen', name: 'grün', sym: '✓' }, gelb: { id: 'gelb', name: 'gelb', sym: '!' },
    rot: { id: 'rot', name: 'rot', sym: '✗' }, grau: { id: 'grau', name: 'grau', sym: '–' }
  };
  function ampelNorm(a) {
    if (a === 'grün' || a === 'gruen' || a === 'green' || a === 'ok') return 'gruen';
    if (a === 'gelb' || a === 'rot' || a === 'grau') return a;
    return 'grau';
  }
  const PAL = {
    dark: { theme: 'dark', bg: '#0f172a', panel: '#1e293b', panel2: '#273449', line: '#64748b', grid: '#334155', fg: '#f1f5f9', mute: '#a9b6c9',
      in: '#fb923c', out: '#4ade80', loss: '#f87171', gnd: '#a3b0c2', sw: '#c4b5fd', il: '#60a5fa', gate: '#fde047', gruen: '#4ade80', gelb: '#fde047', rot: '#f87171', grau: '#a9b6c9' },
    light: { theme: 'light', bg: '#ffffff', panel: '#f1f5f9', panel2: '#e2e8f0', line: '#64748b', grid: '#cbd5e1', fg: '#0f172a', mute: '#475569',
      in: '#b45309', out: '#15803d', loss: '#b91c1c', gnd: '#475569', sw: '#6d28d9', il: '#1d4ed8', gate: '#854d0e', gruen: '#15803d', gelb: '#854d0e', rot: '#b91c1c', grau: '#475569' }
  };
  function palette(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    const fb = PAL[t];
    let p = null;
    try { const D = getDraw(); p = D && typeof D.palette === 'function' ? D.palette(t) : null; } catch (e) { p = null; }
    const out = Object.assign({}, fb, p && typeof p === 'object' ? p : {});
    out.theme = t;
    ['gruen', 'gelb', 'rot', 'grau'].forEach(k => { if (!out[k]) out[k] = fb[k]; });
    out.gruen = out.gruen || out.ok || fb.gruen; out.gelb = out.gelb || out.warn || fb.gelb; out.rot = out.rot || out.bad || fb.rot;
    return out;
  }
  const stufeColor = (s, pal) => (STUFEN[s] ? (pal && pal.theme === 'light' ? STUFEN[s].colorLight : STUFEN[s].color) : ((pal || PAL.dark).mute));
  const ampelColor = (a, pal) => ((pal || PAL.dark)[ampelNorm(a)]);

  const QUAL = {
    hoch: { name: 'hoch', pts: 400, particles: 600, glow: true },
    mittel: { name: 'mittel', pts: 240, particles: 300, glow: true },
    niedrig: { name: 'niedrig', pts: 120, particles: 120, glow: false }
  };
  const quality = q => QUAL[q] || QUAL.hoch;

  // =====================================================================================================================
  //  Einfache Zeichenhelfer (gfx): Rueckfall ohne NTS_DRAW; Fehlerfall zeichnet nichts und liefert false
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
    function dot(ctx, x, y, r, col) { if (!okv(x, y, r)) return false; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); return true; }
    /** Symbol im Kreis: gruen = Haken, gelb = Ausrufezeichen, rot = Kreuz, grau = Strich. Nie nur Farbe. */
    function ampelSym(ctx, x, y, r, a, pal) {
      a = ampelNorm(a);
      if (!okv(x, y, r)) return false;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = pal[a]; ctx.fill();
      ctx.strokeStyle = pal.bg; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round';
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
      o = o || {}; const pal = o.pal || PAL.dark, size = Math.max(11, o.size || 13);
      if (!as || !okv(x, y)) return 0;
      const a = ampelNorm(as.ampel), r = Math.max(9, size * 0.85);
      ampelSym(ctx, x + r, y, r, a, pal);
      const w0 = text(ctx, AMP[a].name.toUpperCase(), x + 2 * r + 8, y, { size: size, bold: true, color: pal[a], base: 'middle' });
      const rest = (o.max || 400) - (2 * r + 8 + w0 + 8);
      let tw = 0;
      if (as.text && rest > 30) tw = text(ctx, as.text, x + 2 * r + 8 + w0 + 8, y, { size: size, color: pal.fg, base: 'middle', max: rest });
      return 2 * r + 8 + w0 + 8 + tw;
    }
    /** Waagerechter Balken: v/max (Rueckfall fuer die Verlustbalken). */
    function bar(ctx, x, y, w, h, v, max, col, pal) {
      if (!okv(x, y, w, h) || !(w > 0) || !(h > 0) || !isNum(v) || !(max > 0)) return false;
      panel(ctx, x, y, w, h, pal.bg, pal.line, 4);
      const f = clamp(v / max, 0, 1);
      if (f > 0) panel(ctx, x + 1, y + 1, Math.max(0, (w - 2) * f), h - 2, col, null, 3);
      return true;
    }
    return { font, fz, rr, panel, fit, text, line, arrow, dot, ampelSym, ampelRow, bar };
  })();

  // =====================================================================================================================
  //  Pruefung einer Anlagenbeschreibung (fuer alle Rig-Pakete in den Tests)
  // =====================================================================================================================
  const ARTEN = ['linear', 'getaktet', 'passiv', 'diagnose'];
  function checkDef(spec) {
    const errs = [], seen = {};
    if (!spec || !spec.id) return ['Anlage ohne id'];
    (spec.controls || []).forEach(c => {
      if (!c.key) { errs.push('Steuerwert ohne key'); return; }
      if (seen[c.key]) errs.push('Schlüssel doppelt: ' + c.key); seen[c.key] = 1;
      if (!c.help) errs.push(c.key + ': help fehlt');
      if (!c.label) errs.push(c.key + ': label fehlt');
      if (c.ebene !== undefined) errs.push(c.key + ': ebene ist nicht vorgesehen (stufe)');
      if (c.type !== 'button' && !Object.prototype.hasOwnProperty.call(c, 'stufe')) errs.push(c.key + ': stufe fehlt (null = reine Vorgabe)');
      if (c.stufe && !STUFEN[c.stufe]) errs.push(c.key + ': unbekannte Stufe ' + c.stufe);
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
    if (!p || !p.quelle || !p.wandlung || !p.senke) errs.push('pfad braucht quelle, wandlung und senke');
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
    let lastKey = null, lastStufe = null, act = [], prevAct = {}, fired = false;
    let hits = [], hitsW = 0, hitsH = 0;
    const anim = { tw: {}, quality: 'hoch', reduced: false, ghost: null };

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
        lastKey = key; if (d.stufe) lastStufe = d.stufe;
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
      return o;
    }
    function readMeters() {
      let m = {};
      try { m = P.meters(res(), ctl) || {}; } catch (e) { m = {}; }
      const out = {};
      Object.keys(m).forEach(k => { out[k] = fin(m[k], 0); });
      return out;
    }
    function bilanz() {
      let b = null;
      try { b = P.bilanz ? P.bilanz(res(), ctl) : null; } catch (e) { b = null; }
      if (!b || typeof b !== 'object') return { pzu: 0, pab: 0, pv: [], eta: 0 };
      const pzu = Math.max(0, fin(b.pzu, 0)), pab = Math.max(0, fin(b.pab, 0));
      const pv = (Array.isArray(b.pv) ? b.pv : []).filter(x => x && STUFEN[x.stufe]).map(x => ({ stufe: x.stufe, w: Math.max(0, fin(x.w, 0)) }));
      const eta = isNum(b.eta) ? clamp(b.eta, 0, 1) : (pzu > 0 ? clamp(pab / pzu, 0, 1) : 0);
      return { pzu, pab, pv, eta };
    }
    function state() {
      const r = res(), a = assess();
      const s = Object.assign({}, ctl);
      Object.assign(s, { simT, phase, version, ampel: a.ampel, ok: a.ok, stufe: lastStufe, lastKey, fired, ctl: Object.assign({}, ctl) });
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

    // ---- Animation (nur Phase und Schreibstrahl; die Physik ist ein Beharrungszustand) ----
    function step(dtMs) {
      dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
      dtMs = Math.min(dtMs, 500);
      simT += dtMs / 1000;
      let hz = 0.5;
      try { if (P.phaseHz) hz = fin(P.phaseHz(res(), ctl), 0.5); } catch (e) { hz = 0.5; }
      hz = clamp(hz, 0, 3);                                   // nichts blinkt haeufiger als 3 Hz
      if (!anim.reduced) { phase += dtMs / 1000 * hz; phase -= Math.floor(phase); }
      if (P.step) { try { P.step(dtMs, res(), ctl); } catch (e) { /* ignorieren */ } }
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
      lastKey = null; lastStufe = null;
      bump(); if (P.onControl) P.onControl('*', null);
      return true;
    }
    function reset() {
      resetControls(); ev.length = 0; act = []; prevAct = {}; phase = 0; simT = 0; fired = false; lastKey = null; lastStufe = null;
      anim.tw = {}; anim.ghost = null; cache = null;
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
    function viewOf() { return { ctl, res: res(), st: state(), ampel: assess(), diag: act, rig: api, anim, phase, simT, stufe: lastStufe, bilanz: bilanz() }; }
    function ariaLabel() {
      const a = assess(), D = opts.noDraw ? null : getDraw();
      let t = '';
      if (D && typeof D.ariaText === 'function') { try { t = D.ariaText(a.ampel, a.text); } catch (e) { t = ''; } }
      if (t) return spec.name + ': ' + t;
      return spec.name + ': Ampel ' + AMP[a.ampel].name + (a.text ? '. ' + a.text : '');
    }
    /** Kopfzeile: Ampelzeile (NTS_DRAW.ampel, sonst Rueckfall). Liefert die Inhaltsflaeche. */
    function head(ctx, w, h, view, sc) {
      const pad = 10, pal = sc.pal, fs = gfx.fz(w);
      if (!sc.header) return { x: 0, y: 0, w, h };
      let y = 8;
      let done = false;
      if (sc.D && typeof sc.D.ampel === 'function') {
        try { done = !!sc.D.ampel(ctx, pad, y + 12, view.ampel.ampel, { text: view.ampel.text, size: fs + 1, maxw: w - 2 * pad, theme: sc.theme }); } catch (e) { done = false; }
      }
      if (!done) gfx.ampelRow(ctx, pad, y + 12, view.ampel, { pal, size: fs + 1, max: w - 2 * pad });
      y += 32;
      if (sc.band) {
        const m = (CORE.TEXTS && CORE.TEXTS.simOnly) || '';
        if (m) { gfx.text(ctx, m, pad, y + 8, { size: fs, color: pal.mute, bg: pal.panel, max: w - 2 * pad, base: 'middle' }); y += 22; }
      }
      return { x: pad, y, w: w - 2 * pad, h: Math.max(0, h - y - pad) };
    }
    /** Blockschaltbild mit Leistungsbilanz und Verlustbalken (einzige Datenquelle: bilanz()). */
    function block(ctx, rect, view, sc) {
      const b = view.bilanz || bilanz();
      if (!rect || !okv(rect.x, rect.y, rect.w, rect.h) || rect.w < 120 || rect.h < 90) return false;
      const blocks = b.pv.map(x => ({ stufe: x.stufe, pLoss: x.w }));
      if (!blocks.length) blocks.push({ stufe: 'trafo', pLoss: 0 });
      const data = { pIn: b.pzu, pOut: b.pab, eta: b.eta, blocks: blocks.slice(0, 8) };
      if (sc.D && typeof sc.D.blockDiagram === 'function') { try { if (sc.D.blockDiagram(ctx, rect, data, { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false })) return true; } catch (e) { /* Rueckfall */ } }
      const pal = sc.pal, fs = gfx.fz(rect.w), mx = Math.max(b.pzu, 1e-9);
      gfx.text(ctx, 'Zugeführt ' + eng(b.pzu, 'W') + ' · abgegeben ' + eng(b.pab, 'W') + ' · η ' + fm(b.eta * 100, 1) + ' %', rect.x, rect.y + fs + 2, { size: fs, color: pal.fg, max: rect.w });
      blocks.forEach((q, i) => {
        const y = rect.y + fs + 14 + i * (fs + 10);
        gfx.text(ctx, (STUFEN[q.stufe] ? STUFEN[q.stufe].name : q.stufe), rect.x, y + fs - 2, { size: fs, color: pal.mute, max: rect.w * 0.3 });
        gfx.bar(ctx, rect.x + rect.w * 0.32, y, rect.w * 0.45, fs + 2, q.pLoss, mx, pal.loss, pal);
        gfx.text(ctx, eng(q.pLoss, 'W'), rect.x + rect.w * 0.79, y + fs - 2, { size: fs, color: pal.fg, max: rect.w * 0.21 });
      });
      return true;
    }
    function scene(ctx, w, h, t, o, rigView, tw, asGhost, peer) {
      const qp = quality(o.quality), pal = palette(o.theme);
      const sc = { hit: (key, x, y, w2, h2, to) => { if (!asGhost && key && dmap[key] && okv(x, y, w2, h2)) hits.push({ key, x, y, w: w2, h: h2, to }); },
        quality: o.quality, qp, reduced: !!o.reduced, header: o.header !== false, band: o.band === true, pal, theme: o.theme || 'dark', D: opts.noDraw ? null : getDraw(), t,
        beam: o.reduced ? 1 : phase, phase, gfx, B: base, peer: peer || null, tw: tw || anim.tw, fs: gfx.fz(w), ghost: !!asGhost, active: rigView && rigView.stufe };
      sc.block = rect => block(ctx, rect, rigView, sc);
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

    // roles aus controls[].stufe abgeleitet (nicht parallel pflegen)
    const roles = { trafo: [], gleich: [], sieb: [], regel: [], schalt: [], last: [] };
    defs.forEach(c => { if (c.stufe && roles[c.stufe]) roles[c.stufe].push(c.key); });

    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(k => { if (!dmap[k]) return; const r = validate(k, opts.controls[k]); if (r.ok && dmap[k].type !== 'button') ctl[k] = r.v; });
    bump();

    const api = {
      id: spec.id, name: spec.name, icon: spec.icon, info: spec.info, pfad: spec.pfad, roles, controls: defs, meters: spec.meters, presets: spec.presets, params, events: ev,
      simOnly: (CORE.TEXTS && CORE.TEXTS.simOnly) || '',
      setControl, getControl, getControls, step, readMeters, state, bilanz, draw, hitTest, curves, reset, assess, diagnose, snapshot, restore, applyPreset, ariaLabel,
      worldSize() { return { w: world.w, h: world.h }; },
      stats() { return { computes, draws: drawCount, version }; },
      drawError() { return drawError; },
      stufeOf(key) { return dmap[key] ? dmap[key].stufe || null : null; },
      _view: viewOf, _tw() { return anim.tw; }
    };
    if (P.waveform) api.waveform = waveform;
    if (P.fire) api.fire = fire;
    if (P.extend) P.extend(api, { res, ctl, say, bump });
    return api;
  }

  const base = { version: '1.0', clamp, num, fin, isNum, fm, fn, eng, okv, core, getDraw, mulberry32, lim, stat, msg, STUFEN, AMP, ampelNorm, palette, stufeColor, ampelColor, QUAL, quality,
    gfx, checkDef, makeRig, FONT, ARTEN };
  R.base = base;
})(typeof window !== 'undefined' ? window : globalThis);
