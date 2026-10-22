/* enrrig-modul.js - Energie-Lab: Pruefstand 1 `modul` (Solarmodul-Kennlinie, SPEC 5.3.1) und gemeinsame Basis der Sonnen-Pruefstaende A (ENR_RIGS.baseS).
 * Physik: ENR_CORE.pv (Ein-Dioden-Modell, exakte Parameter aus Isc und Uoc). Das Feld aus ns x np gleichen Modulen wird exakt skaliert
 * (Spannung mal ns, Strom mal np, SPEC 4.5 Schnellpfad); Arbeitspunkt (Widerstand) per Bisektion auf der Feldkennlinie.
 * Die Basis (Bedienpult, Zeit, Meldungen, Schreiber, Zeichenhelfer) steckt in ENR_RIGS.baseS: enrrig-schatten.js braucht sie und laedt sich
 * diese Datei in Node per require; im Browser diese Datei VOR enrrig-schatten.js laden.
 * Lauffaehig auch ohne ENR_DRAW (eigene Zeichenhelfer, ENR_DRAW wird fuer Himmel, Sonne, Schnitt genutzt, falls vorhanden).
 */
(function (root) {
  'use strict';
  const R = root.ENR_RIGS = root.ENR_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // =====================================================================================================================
  //  Basis (einmal je Seite)
  // =====================================================================================================================
  function makeBase() {
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    const fm = (x, d) => { if (!(typeof x === 'number' && isFinite(x))) return '–'; const dd = d === undefined ? 1 : d, s = Math.abs(x).toFixed(dd); return ((x < 0 && +s !== 0) ? '−' : '') + s.replace('.', ','); };
    const core = () => { if (!root.ENR_CORE && typeof require === 'function') { try { require('./enrcore.js'); } catch (e) { /* fehlt */ } } return root.ENR_CORE; };
    const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
    const COL = { bg: '#14181c', panel: '#1b2127', panel2: '#232b33', line: '#3a4652', fg: '#e8eef4', mute: '#9fb0bf', gold: '#f5c542', ok: '#4cc38a', warn: '#f0a030', danger: '#ef5b5b', cyan: '#4fc3d9', violet: '#a78bfa', blue: '#5aa9ff', shadow: '#0b0f14' };
    const TXT = {
      nacht: 'Nacht: Das Modul liefert nichts.',
      polarnacht: 'Polarnacht: Die Sonne geht nicht auf.',
      unbekannt: k => 'Schlüssel „' + k + '“ gibt es an diesem Prüfstand nicht.',
      wert: (k, why) => 'Der Wert für „' + k + '“ passt nicht: ' + why,
      drossel: 'Zeitraffer gedrosselt: Der Prüfstand rechnet nicht schneller.',
      kern: 'Der Rechenkern (enrcore.js) fehlt: Es gibt keine Messwerte.'
    };
    // ---------------------------------------------------------------- Zeichenhelfer (eigene, ohne Abhaengigkeit)
    const G = {
      text(ctx, s, x, y, o) {
        o = o || {}; const sz = o.size || 13; ctx.font = (o.bold ? 'bold ' : '') + sz + 'px system-ui, sans-serif'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
        if (o.outline !== false) { ctx.lineWidth = 3; ctx.strokeStyle = o.stroke || 'rgba(8,12,16,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(String(s), x, y); }
        ctx.fillStyle = o.color || COL.fg; ctx.fillText(String(s), x, y);
      },
      box(ctx, x, y, w, h, fill, stroke, r) {
        ctx.beginPath(); if (r && ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
      },
      line(ctx, pts, color, w, dash) {
        if (!pts || pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = color; ctx.lineWidth = w || 2; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      },
      circle(ctx, x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); } },
      arrow(ctx, x0, y0, x1, y1, color, w, head) {
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (!(L > 1)) return; const ux = dx / L, uy = dy / L, hd = head || 9;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w || 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5); ctx.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5); ctx.closePath(); ctx.fill();
      },
      mix(c1, c2, t) { const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16), k = clamp(t, 0, 1), r = Math.round((a >> 16) + ((b >> 16) - (a >> 16)) * k), g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k), bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * k); return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1); },
      // Zelltemperatur: kalt (blau) ueber 25 Grad (dunkelblau-grau) bis heiss (rot)
      tempColor(Tc) { const t = clamp((num(Tc, 25) + 10) / 100, 0, 1); return t < 0.35 ? G.mix('#2f6db8', '#26467a', t / 0.35) : G.mix('#26467a', '#b8412f', (t - 0.35) / 0.65); },
      // Himmelsfarbe nach Sonnenhoehe (einfache Linearmischung, SPEC 5.4 Nr. 2); Rueckgabe { top, bot }
      skyColors(alt) {
        const stops = [[-12, '#0a1030', '#101a44'], [-6, '#2b2358', '#6a3a62'], [0, '#6a4a82', '#f08a50'], [6, '#4a7ec0', '#f7c46c'], [20, '#3f8fe0', '#9fd0f5'], [90, '#2f7fd8', '#a8d8f8']];
        const a = clamp(num(alt, 30), -12, 90); let i = 0; while (i < stops.length - 2 && a > stops[i + 1][0]) i++;
        const k = (a - stops[i][0]) / (stops[i + 1][0] - stops[i][0]); return { top: G.mix(stops[i][1], stops[i + 1][1], k), bot: G.mix(stops[i][2], stops[i + 1][2], k) };
      },
      sky(ctx, x, y, w, h, alt, tms, rd) {
        const D = root.ENR_DRAW; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        let done = false;
        if (D && typeof D.sky === 'function') { try { ctx.translate(x, y); done = D.sky(ctx, w, h, { alt, stars: alt < -6, t: rd ? 0 : (tms || 0) / 1000 }) !== false; } catch (e) { done = false; } }
        ctx.restore();
        if (!done) {
          const c = G.skyColors(alt), g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c.top); g.addColorStop(1, c.bot); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
          if (alt < -6) { ctx.fillStyle = '#fff'; for (let i = 0; i < 24; i++) { const sx = x + ((i * 97) % 100) / 100 * w, sy = y + ((i * 53) % 70) / 100 * h, tw = rd ? 1.2 : 1 + 0.6 * Math.sin((tms || 0) / 400 + i); ctx.fillRect(sx, sy, tw, tw); } }
        }
      },
      sun(ctx, x, y, r, intensity, tms, rd) {
        const D = root.ENR_DRAW; if (!(intensity > 0)) return;
        if (D && typeof D.sun === 'function') { try { if (D.sun(ctx, x, y, { r, intensity, t: rd ? 0 : (tms || 0) / 1000 }) !== false) return; } catch (e) { /* eigener Pfad */ } }
        const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6); g.addColorStop(0, 'rgba(255,230,120,' + (0.9 * intensity).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.fill();
        const rot = rd ? 0 : (tms || 0) / 6000; ctx.strokeStyle = 'rgba(255,214,90,' + (0.4 + 0.5 * intensity).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i < 12; i++) { const a = rot + i * 0.5236; ctx.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); ctx.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7); } ctx.stroke();
        G.circle(ctx, x, y, r, '#ffe27a', '#ffb830', 2);
      },
      // Zeigerinstrument: Mitte (x,y), Radius r, Wert zwischen lo und hi
      gauge(ctx, x, y, r, o) {
        const lo = o.lo, hi = o.hi, f = clamp((num(o.value, 0) - lo) / (hi - lo), 0, 1), a0 = 2.356, a = a0 + f * 4.712;
        G.circle(ctx, x, y, r, COL.panel2, COL.line, 2);
        ctx.strokeStyle = o.warn ? COL.danger : COL.mute; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.8, a0, a0 + 4.712); ctx.stroke();
        ctx.strokeStyle = o.color || COL.warn; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke(); ctx.lineCap = 'butt';
        G.text(ctx, o.sym || '', x, y - r * 0.28, { size: Math.max(12, r * 0.55), bold: true, color: o.color || COL.warn, outline: false });
        G.text(ctx, o.read || '', x, y + r * 0.45, { size: Math.max(11, r * 0.42), bold: true });
      },
      // Modulraster: Zellen, Sammelschienen, Teilstraenge; lod 0 = Einzelzellen, 1 = Gitter, 2 = nur Flaeche
      panel(ctx, x, y, w, h, o) {
        const cols = o.cols, rows = o.rows, lod = o.lod === undefined ? 1 : o.lod, base = o.fill || G.tempColor(o.temp), cw = w / cols, ch = h / rows;
        ctx.fillStyle = '#c9d2db'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
        if (lod === 0) {
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const s = o.s ? o.s[r * cols + c] : 1; ctx.fillStyle = s < 1 ? G.mix(base, '#05080c', 0.92 - 0.0 * s - s * 0.5) : base; ctx.fillRect(x + c * cw + 1, y + r * ch + 1, cw - 2, ch - 2);
          }
        } else if (o.s) {
          ctx.fillStyle = 'rgba(5,8,12,0.78)'; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const s = o.s[r * cols + c]; if (s < 1) { ctx.globalAlpha = 0.9 * (1 - s); ctx.fillRect(x + c * cw, y + r * ch, cw, ch); } } ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
        if (lod < 2) { for (let c = 1; c < cols; c++) { ctx.moveTo(x + c * cw, y); ctx.lineTo(x + c * cw, y + h); } for (let r = 1; r < rows; r++) { ctx.moveTo(x, y + r * ch); ctx.lineTo(x + w, y + r * ch); } }
        ctx.stroke();
        if (lod === 0) { ctx.beginPath(); ctx.strokeStyle = 'rgba(240,240,255,0.55)'; ctx.lineWidth = 1.5; for (let c = 0; c < cols; c++) { ctx.moveTo(x + (c + 0.35) * cw, y); ctx.lineTo(x + (c + 0.35) * cw, y + h); ctx.moveTo(x + (c + 0.65) * cw, y); ctx.lineTo(x + (c + 0.65) * cw, y + h); } ctx.stroke(); }
        if (o.subs > 1) { ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); const per = cols / o.subs; for (let k = 1; k < o.subs; k++) { if (o.orient === 'quer') { ctx.moveTo(x, y + k * (h / o.subs)); ctx.lineTo(x + w, y + k * (h / o.subs)); } else { ctx.moveTo(x + k * per * cw, y); ctx.lineTo(x + k * per * cw, y + h); } } ctx.stroke(); ctx.setLineDash([]); }
        if (!o.noGlint) { const gx = x + ((o.glint || 0) % 1) * (w + h) - h; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(gx, y + h); ctx.lineTo(gx + 14, y + h); ctx.lineTo(gx + 14 + h, y); ctx.lineTo(gx + h, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
      },
      // Diode (Dreieck mit Sperrstrich); on = leitet (gelb), kind 'ok' | 'fehlt' | 'kurz'
      diode(ctx, x, y, s, o) {
        const on = o.on, col = on ? COL.gold : COL.mute; ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.fillStyle = on ? 'rgba(245,197,66,0.85)' : 'rgba(150,165,180,0.35)';
        ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.9); ctx.lineTo(x - s, y + s * 0.9); ctx.lineTo(x + s * 0.9, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.9, y - s * 0.9); ctx.lineTo(x + s * 0.9, y + s * 0.9); ctx.stroke();
        if (o.kind === 'kurz' || o.kind === 'fehlt') { ctx.strokeStyle = COL.danger; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - s * 1.3, y - s * 1.2); ctx.lineTo(x + s * 1.3, y + s * 1.2); ctx.moveTo(x - s * 1.3, y + s * 1.2); ctx.lineTo(x + s * 1.3, y - s * 1.2); ctx.stroke(); }
      },
      // Elektronen-/Stromflusspunkte entlang eines Streckenzugs (pts), Phase ph in Pixeln, Anzahl n
      dots(ctx, pts, n, ph, color, rad) {
        let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; } if (!(L > 1) || n < 1) return;
        ctx.fillStyle = color; ctx.beginPath();
        for (let k = 0; k < n; k++) { let s = (((ph + k * L / n) % L) + L) % L, i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; } const f = seg[i] ? s / seg[i] : 0, px = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, py = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f; ctx.moveTo(px + rad, py); ctx.arc(px, py, rad, 0, 6.2832); }
        ctx.fill();
      },
      placeholder(ctx, W, H) { ctx.fillStyle = COL.panel; ctx.fillRect(0, 0, W, H); G.text(ctx, 'Zeichenmodul fehlt', W / 2, H / 2, { size: 20 }); }
    };

    // ---------------------------------------------------------------- Prueffstand-Rumpf
    // def: { id, controls, meters, presets, h, timeScale, tUnit, world:{w,h}, compactWorld?, params, sampleEvery, build(api) -> plant }
    // plant: compute(), tick(k, t), meters(), stateExtra(), diag(), curves(), tables(), analysis(), hit(x,y,L), draw(ctx,W,H,tms,V,L), reset(), traceNow(), onSet(key,val), setClock?
    function makeRig(def, opts) {
      opts = opts || {};
      const params = Object.assign({}, def.params || {}, opts.params || {}), h = def.h, byKey = {};
      def.controls.forEach(c => { byKey[c.key] = c; });
      const ctl = {}; let k = 0, acc = 0, dirty = true, plant = null, drawErr = null;
      const events = [], lastEmit = {}, prevIds = {}, store = { t: [], s: {} }, keysTrace = def.traceKeys || [];
      const resetCtl = () => { def.controls.forEach(c => { ctl[c.key] = c.value; }); };
      resetCtl();
      const api = { ctl, params, core, dirty() { dirty = true; }, t() { return k * h; }, byKey, rig: null };
      function emit(id, kind, text, fx) {
        const t = k * h; if (lastEmit[id] !== undefined && t - lastEmit[id] < 2 && kind !== 'error') return; lastEmit[id] = t;
        const e = { t, id, text, kind }; if (fx) e.fx = fx; events.push(e); if (events.length > 200) events.splice(0, events.length - 200);
      }
      api.emit = emit;
      function ensure() { if (dirty) { dirty = false; try { plant.compute(); } catch (e) { plant.fail = String(e && e.message || e); } } }
      function canon(c, v) {
        if (c.type === 'slider') {
          let x = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v) ? parseFloat(v.replace(',', '.')) : NaN);
          if (!isFinite(x)) return { ok: false, why: 'Das ist keine Zahl.' }; x = clamp(x, c.min, c.max); if (c.int) x = Math.round(x); return { ok: true, v: x };
        }
        if (c.type === 'select') { const o = c.options.find(q => String(q.value) === String(v)); return o ? { ok: true, v: o.value } : { ok: false, why: 'Diese Auswahl gibt es nicht.' }; }
        if (c.type === 'switch') { if (v === true || v === 1 || v === 'true') return { ok: true, v: true }; if (v === false || v === 0 || v === 'false') return { ok: true, v: false }; return { ok: false, why: 'Erwartet wird an oder aus.' }; }
        return { ok: false, why: 'Dieser Bedienelementtyp wird nicht gesetzt.' };
      }
      function setControl(key, value) {
        const c = byKey[key]; if (!c) { emit('unbekannt:' + key, 'warn', TXT.unbekannt(String(key).slice(0, 40))); return false; }
        const r = canon(c, value); if (!r.ok) { emit('wert:' + key, 'warn', TXT.wert(key, r.why)); return false; }
        if (ctl[key] !== r.v) { ctl[key] = r.v; dirty = true; if (plant.onSet) plant.onSet(key, r.v); } return true;
      }
      function advance(dtS, maxTicks) {
        const d = num(dtS, 0); if (!(d > 0)) return; acc += d; let n = Math.floor(acc / h + 1e-9); if (maxTicks && n > maxTicks) { n = maxTicks; acc = 0; emit('drossel', 'info', TXT.drossel); } else acc = Math.max(0, acc - n * h);
        for (let i = 0; i < n; i++) { k++; ensure(); if (plant.tick) plant.tick(k, k * h); sampleTrace(); watch(); }
      }
      function sampleTrace() {
        if (k % (def.sampleEvery || 5) !== 0) return; const now = plant.traceNow ? plant.traceNow() : {}; store.t.push(k * h); keysTrace.forEach(q => { (store.s[q] = store.s[q] || []).push(num(now[q], 0)); });
        if (store.t.length > 7000) { store.t.splice(0, 1000); keysTrace.forEach(q => store.s[q].splice(0, 1000)); }
      }
      function watch() { // Meldungen bei Zustandswechsel (steigende Flanke)
        const list = plant.diag ? plant.diag() : [], now = {};
        list.forEach(d => { now[d.id] = true; if (!prevIds[d.id]) emit(d.id, d.kind, d.text, d.fx); });
        Object.keys(prevIds).forEach(q => { if (!now[q]) delete prevIds[q]; }); Object.keys(now).forEach(q => { prevIds[q] = true; });
      }
      function allCtl() { const o = {}; Object.keys(ctl).forEach(q => { o[q] = ctl[q]; }); return o; }
      function metersFinite() { ensure(); const m = plant.meters() || {}, o = {}; def.meters.forEach(q => { o[q.key] = num(m[q.key], 0); }); return o; }
      function layoutOf(w, hh) { return (def.compactWorld && w / hh < 0.85) ? 'compact' : 'wide'; }
      function worldOf(L) { return L === 'compact' ? def.compactWorld : def.world; }
      const rig = {
        id: def.id, controls: def.controls, meters: def.meters, presets: def.presets, timeScale: def.timeScale, tUnit: def.tUnit, h, params, events,
        setControl, getControl(key) { return byKey[key] ? ctl[key] : undefined; },
        controlInfo(key) { const c = byKey[key]; if (!c || c.type !== 'slider') return null; return { min: c.min, max: c.max, step: c.step, value: ctl[key] }; },
        step(dtMs) { advance(num(dtMs, 0) / 1000 * def.timeScale, 2000); },
        stepProcess(dtS) { advance(dtS, 0); },
        readMeters: metersFinite,
        state() {
          ensure(); const s = Object.assign({}, allCtl(), metersFinite(), plant.stateExtra ? plant.stateExtra() : {});
          s.t = k * h; s.faults = (plant.diag ? plant.diag() : []).map(d => d.id); return s;
        },
        diagnose() { ensure(); return plant.diag ? plant.diag().map(d => Object.assign({}, d)) : []; },
        analysis() { ensure(); return plant.analysis ? plant.analysis() : {}; },
        curves() { ensure(); return plant.curves ? plant.curves() : []; },
        tables() { ensure(); return plant.tables ? plant.tables() : []; },
        trace(spanS) {
          const sp = num(spanS, 60), t1 = k * h, i0 = (() => { let a = 0; while (a < store.t.length && store.t[a] < t1 - sp) a++; return a; })(), n = store.t.length - i0, stride = Math.max(1, Math.ceil(n / 600));
          const out = { t: [], series: {}, marks: [] }; keysTrace.forEach(q => { out.series[q] = []; });
          for (let i = i0; i < store.t.length; i += stride) { out.t.push(store.t[i]); keysTrace.forEach(q => out.series[q].push(store.s[q][i])); }
          events.forEach(e => { if (e.t >= t1 - sp) out.marks.push({ t: e.t, text: e.text, kind: e.kind }); }); return out;
        },
        reset() { k = 0; acc = 0; dirty = true; events.length = 0; Object.keys(lastEmit).forEach(q => delete lastEmit[q]); Object.keys(prevIds).forEach(q => delete prevIds[q]); store.t.length = 0; keysTrace.forEach(q => { store.s[q] = []; }); drawErr = null; if (plant.reset) plant.reset(); },
        applyPreset(id) {
          const p = def.presets.find(q => q.id === id); if (!p) return false; resetCtl(); Object.keys(p.params || {}).forEach(q => { const c = byKey[q]; if (c) { const r = canon(c, p.params[q]); if (r.ok) ctl[q] = r.v; } });
          dirty = true; if (plant.onPreset) plant.onPreset(p); rig.reset(); return true;
        },
        worldSize() { return { w: def.world.w, h: def.world.h }; },
        draw(ctx, w, hh, tms) {
          drawErr = null; if (!ctx || !(w >= 2) || !(hh >= 2) || !isFinite(w) || !isFinite(hh) || w > 20000 || hh > 20000) return false;
          try {
            ensure(); const L = layoutOf(w, hh), W = worldOf(L), s = Math.min(w / W.w, hh / W.h); ctx.save(); ctx.translate((w - W.w * s) / 2, (hh - W.h * s) / 2); ctx.scale(s, s);
            ctx.beginPath(); ctx.rect(0, 0, W.w, W.h); ctx.clip();
            plant.draw(ctx, W.w, W.h, num(tms, 0), L, rig.state()); ctx.restore(); return true;
          } catch (e) { drawErr = String(e && e.message || e); try { ctx.restore(); } catch (x) { /* nichts */ } return false; }
        },
        hitTest(px, py, w, hh) {
          if (!isFinite(px) || !isFinite(py) || !(w >= 2) || !(hh >= 2) || !isFinite(w) || !isFinite(hh)) return null;
          try { ensure(); const L = layoutOf(w, hh), W = worldOf(L), s = Math.min(w / W.w, hh / W.h), x = (px - (w - W.w * s) / 2) / s, y = (py - (hh - W.h * s) / 2) / s; return plant.hit ? (plant.hit(x, y, L) || null) : null; } catch (e) { return null; }
        },
        drag(key, px, py, w, hh) {
          if (!plant.drag || !isFinite(px) || !isFinite(py) || !(w >= 2) || !(hh >= 2)) return false;
          try { const L = layoutOf(w, hh), W = worldOf(L), s = Math.min(w / W.w, hh / W.h); return !!plant.drag(key, (px - (w - W.w * s) / 2) / s, (py - (hh - W.h * s) / 2) / s, L); } catch (e) { return false; }
        },
        applyHit(hit) { // fuehrt das Ergebnis von hitTest aus: erst Zusatzwerte (hit.set), dann hit.key = hit.to
          if (!hit || typeof hit !== 'object') return false; let ok = false; if (hit.set && typeof hit.set === 'object') Object.keys(hit.set).forEach(q => { if (setControl(q, hit.set[q])) ok = true; });
          if (hit.kind === 'switch' && hit.key && hit.to !== undefined) ok = setControl(hit.key, hit.to) || ok; return ok;
        },
        drawError() { return drawErr; }
      };
      if (typeof def.setClockOk === 'boolean' ? def.setClockOk : false) rig.setClock = (N, tS) => { if (plant.setClock) plant.setClock(N, tS); dirty = true; };
      api.rig = rig; plant = def.build(api); rig.reset();
      if (opts.controls) Object.keys(opts.controls).forEach(q => setControl(q, opts.controls[q]));
      if (opts.preset) rig.applyPreset(opts.preset);
      return rig;
    }
    // Bisektion fuer fallende Funktionen f(x) auf [lo, hi] mit f(lo) >= 0 >= f(hi)
    function bisect(f, lo, hi, n) { let a = lo, b = hi; for (let i = 0; i < (n || 56); i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } return (a + b) / 2; }
    return { clamp, num, fm, core, reduced, COL, TXT, G, makeRig, bisect };
  }
  if (!R.baseS) R.baseS = makeBase();
  const B = R.baseS, clamp = B.clamp, num = B.num, fm = B.fm, G = B.G, COL = B.COL, TXT = B.TXT;

  // =====================================================================================================================
  //  Prueffstand modul
  // =====================================================================================================================
  const GRP = { mod: 'Modul und Schaltung', cond: 'Bedingung', last: 'Last', ans: 'Ansicht' };
  const CONTROLS = [
    { key: 'preset', label: 'Modul', type: 'select', value: 'si60', group: GRP.mod, options: [{ value: 'zelle', label: 'Solarzelle (156 mm)' }, { value: 'si36', label: 'Modul 36 Zellen (12 V)' }, { value: 'si60', label: 'Modul 60 Zellen' }, { value: 'si72', label: 'Modul 72 Zellen' }],
      help: 'Welches Bauteil du misst. Die Zelle liefert nur etwa ein halbes Volt, ein Modul reiht 36 bis 72 Zellen in Reihe. Pmpp und Füllfaktor sind Ergebnisse des Modells, keine Eingaben.' },
    { key: 'ns', label: 'In Reihe (ns)', type: 'slider', scale: 'lin', min: 1, max: 6, step: 1, int: true, unit: '', value: 1, group: GRP.mod,
      help: 'Zahl der Module (bei der Zelle: Zellen) in Reihe. In Reihe addieren sich die Spannungen, der Strom bleibt gleich.' },
    { key: 'np', label: 'Parallel (np)', type: 'slider', scale: 'lin', min: 1, max: 3, step: 1, int: true, unit: '', value: 1, group: GRP.mod,
      help: 'Zahl der gleichen Stränge nebeneinander. Parallel addieren sich die Ströme, die Spannung bleibt gleich.' },
    { key: 'G', label: 'Einstrahlung G', type: 'slider', scale: 'lin', min: 0, max: 1200, step: 10, unit: 'W/m²', value: 1000, group: GRP.cond,
      help: 'Bestrahlungsstärke in der Modulebene. Der Kurzschlussstrom wächst fast proportional mit G, die Leerlaufspannung nur logarithmisch. 1000 W/m² ist der Standardwert (STC) im Datenblatt. Unter 1 W/m² ist Nacht.' },
    { key: 'tcMode', label: 'Zelltemperatur bestimmen', type: 'select', value: 'manuell', group: GRP.cond, options: [{ value: 'manuell', label: 'von Hand' }, { value: 'auto', label: 'aus Umgebung und Einstrahlung (NOCT)' }],
      help: 'Von Hand: du stellst die Zelltemperatur ein. NOCT: Die Zelltemperatur folgt der Umgebungstemperatur und der Einstrahlung, Tc = Ta + (NOCT − 20) / 800 · G (stationär, ohne Trägheit).' },
    { key: 'tc', label: 'Zelltemperatur Tc', type: 'slider', scale: 'lin', min: -20, max: 90, step: 1, unit: '°C', value: 25, group: GRP.cond, visible: s => !s || s.tcMode !== 'auto',
      help: 'Temperatur der Zellen. Wärmer bedeutet weniger Spannung und etwas mehr Strom, die Leistung sinkt. 25 °C ist der Standardwert (STC).' },
    { key: 'ta', label: 'Umgebungstemperatur Ta', type: 'slider', scale: 'lin', min: -20, max: 40, step: 1, unit: '°C', value: 20, group: GRP.cond, visible: s => !!s && s.tcMode === 'auto',
      help: 'Lufttemperatur um das Modul. Daraus und aus G folgt die Zelltemperatur nach der NOCT-Formel des Moduls.' },
    { key: 'lastart', label: 'Last', type: 'select', value: 'widerstand', group: GRP.last, options: [{ value: 'widerstand', label: 'Lastwiderstand' }, { value: 'spannung', label: 'Spannung vorgeben' }, { value: 'mpp', label: 'MPP (bester Punkt)' }, { value: 'leerlauf', label: 'Leerlauf' }, { value: 'kurzschluss', label: 'Kurzschluss' }],
      help: 'Wie das Modul belastet wird. Der Arbeitspunkt liegt dort, wo die Kennlinie des Moduls die Kennlinie der Last schneidet. Leerlauf: kein Strom. Kurzschluss: keine Spannung.' },
    { key: 'rLast', label: 'Lastwiderstand R', type: 'slider', scale: 'log', min: 0.05, max: 500, step: 0.05, unit: 'Ω', value: 3, group: GRP.last, visible: s => !s || s.lastart === 'widerstand',
      help: 'Der angeschlossene Widerstand. Die Leistung ist am größten, wenn R gleich Umpp durch Impp ist (Leistungsanpassung). Ein viel kleinerer oder größerer Widerstand holt kaum Leistung heraus.' },
    { key: 'uFrac', label: 'Spannung in % von Uoc', type: 'slider', scale: 'lin', min: 0, max: 105, step: 1, unit: '%', value: 80, group: GRP.last, visible: s => !!s && s.lastart === 'spannung',
      help: 'Die Spannung am Modul als Anteil der Leerlaufspannung der aktuellen Bedingung. Über 100 % fließt Strom in das Modul hinein, es wird zum Verbraucher.' },
    { key: 'view', label: 'Ansicht', type: 'select', value: 'kennlinie', group: GRP.ans, options: [{ value: 'kennlinie', label: 'Kennlinie und Stromkreis' }, { value: 'aufbau', label: 'Aufbau (Schnitt)' }],
      help: 'Kennlinie: das Modul im Stromkreis mit Messgeräten. Aufbau: der Schnitt durch das Modul mit den Schichten, den Photonen und dem Stromweg.' },
    { key: 'compare', label: 'Vergleich', type: 'select', value: 'aus', group: GRP.ans, options: [{ value: 'aus', label: 'aus' }, { value: 'einstrahlung', label: 'Einstrahlung (200 bis 1000 W/m²)' }, { value: 'temperatur', label: 'Temperatur (0 bis 75 °C)' }],
      help: 'Zeichnet in den Kennlinien eine Schar: mehrere Einstrahlungen oder Temperaturen mit sonst gleichen Einstellungen. Deine aktuelle Kurve ist fett.' }
  ];
  const METERS = [
    { key: 'u', label: 'Spannung U', unit: 'V', digits: 1, min: 0, max: 300 }, { key: 'i', label: 'Strom I', unit: 'A', digits: 2, min: 0, max: 30 }, { key: 'p', label: 'Leistung P', unit: 'W', digits: 1, min: 0, max: 6000 },
    { key: 'uoc', label: 'Leerlaufspannung Uoc', unit: 'V', digits: 1, min: 0, max: 350 }, { key: 'isc', label: 'Kurzschlussstrom Isc', unit: 'A', digits: 2, min: 0, max: 30 },
    { key: 'umpp', label: 'Spannung im MPP', unit: 'V', digits: 1, min: 0, max: 300 }, { key: 'impp', label: 'Strom im MPP', unit: 'A', digits: 2, min: 0, max: 30 }, { key: 'pmpp', label: 'Leistung im MPP', unit: 'W', digits: 1, min: 0, max: 6000 },
    { key: 'ff', label: 'Füllfaktor FF', unit: '', digits: 2, min: 0, max: 1 }, { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 25 },
    { key: 'tcell', label: 'Zelltemperatur', unit: '°C', digits: 1, min: -20, max: 120 }, { key: 'anpass', label: 'Leistungsanpassung', unit: '%', digits: 1, min: 0, max: 100 }
  ];
  const PRESETS = [
    { id: 'stc', name: 'STC (1000 W/m², 25 °C)', params: { G: 1000, tcMode: 'manuell', tc: 25 } },
    { id: 'kalt', name: 'Kalter Wintertag klar (600 W/m², 0 °C)', params: { G: 600, tcMode: 'manuell', tc: 0 } },
    { id: 'heiss', name: 'Heißer Sommer (1000 W/m², 65 °C)', params: { G: 1000, tcMode: 'manuell', tc: 65 } },
    { id: 'bedeckt', name: 'Bedeckt (150 W/m², 15 °C)', params: { G: 150, tcMode: 'manuell', tc: 15 } },
    { id: 'reihe', name: 'Reihenschaltung: drei Module', params: { ns: 3 } },
    { id: 'parallel', name: 'Parallelschaltung: drei Stränge', params: { np: 3 } },
    { id: 'anpass-falsch', name: 'Leistungsanpassung falsch (R = 0,2 Ω)', params: { lastart: 'widerstand', rLast: 0.2 } }
  ];
  const P = { uHoch: 120, mppSchwelle: 99, anpassGrenze: 90 };   // Kleinspannungsgrenze fuer Hinweis (A11), MPP-Schwelle, Fehlanpassung

  function plantModul(api) {
    const ctl = api.ctl, vis = { t: -1, ph: 0 }; let M = null, cache = {};
    const zero = () => ({ ok: false, why: TXT.kern, G: 0, Tc: 25, dark: true, ns: 1, np: 1, Uoc: 0, Isc: 0, Umpp: 0, Impp: 0, Pmpp: 0, FF: 0, eta: null, op: { U: 0, I: 0, P: 0 }, anpass: 0, Rop: 0, Rmpp: 0 });
    function compute() {
      cache = {}; const C = api.core(); if (!C || !C.pv) { M = zero(); return; }
      const spec = C.pv.spec(ctl.preset); if (!spec || spec.ok === false) { M = zero(); M.why = (spec && spec.why) || 'Unbekanntes Modul.'; return; }
      const G0 = ctl.G, Tc = ctl.tcMode === 'auto' ? C.pv.cellTemp(ctl.ta, G0, spec.NOCT) : ctl.tc, cond = { G: G0, Tc, fd: 0.12 }, ns = ctl.ns, np = ctl.np, dark = !(G0 >= 1);
      const keys = C.pv.keys(spec, cond), par = C.pv.cond(spec, cond);
      if (!keys || keys.ok === false) { M = zero(); M.why = (keys && keys.why) || 'Keine Kennwerte.'; return; }
      const m = { ok: true, spec, par, G: G0, Tc, dark, ns, np, keys, A: spec.A * ns * np };
      m.Uoc = dark ? 0 : ns * keys.Uoc; m.Isc = dark ? 0 : np * keys.Isc; m.Umpp = dark ? 0 : ns * keys.Umpp; m.Impp = dark ? 0 : np * keys.Impp; m.Pmpp = dark ? 0 : ns * np * keys.Pmpp;
      m.FF = dark ? 0 : keys.FF; m.eta = dark ? null : m.Pmpp / (m.A * G0) * 100; m.Rmpp = m.Impp > 0 ? m.Umpp / m.Impp : 0;
      m.Ifeld = U => (dark ? 0 : np * C.pv.current(par, U / ns));
      let U = 0, I = 0;
      if (!dark) {
        if (ctl.lastart === 'widerstand') { U = B.bisect(u => m.Ifeld(u) - u / ctl.rLast, 0, m.Uoc); I = m.Ifeld(U); }
        else if (ctl.lastart === 'spannung') { U = ctl.uFrac / 100 * m.Uoc; I = m.Ifeld(U); }
        else if (ctl.lastart === 'mpp') { U = m.Umpp; I = m.Impp; } else if (ctl.lastart === 'leerlauf') { U = m.Uoc; I = 0; } else { U = 0; I = m.Isc; }
      }
      m.op = { U, I, P: U * I }; m.anpass = m.Pmpp > 0 ? m.op.P / m.Pmpp * 100 : 0; m.Rop = I > 1e-9 ? U / I : 0; M = m;
    }
    const f0 = x => (typeof x === 'number' && isFinite(x) ? x : 0);
    function meters() {
      const m = M || zero(); return { u: m.op.U, i: m.op.I, p: m.op.P, uoc: m.Uoc, isc: m.Isc, umpp: m.Umpp, impp: m.Impp, pmpp: m.Pmpp, ff: m.FF, eta: f0(m.eta), tcell: m.Tc, anpass: m.anpass };
    }
    function diag() {
      const m = M || zero(), out = []; if (!m.ok) return out;
      if (m.dark) { out.push({ id: 'nacht', kind: 'info', text: TXT.nacht }); return out; }
      if (ctl.lastart === 'leerlauf') out.push({ id: 'leerlauf', kind: 'info', text: 'Leerlauf: Es fließt kein Strom, du misst die Leerlaufspannung Uoc = ' + fm(m.Uoc, 1) + ' V. Die Leistung ist null.' });
      if (ctl.lastart === 'kurzschluss') out.push({ id: 'kurzschluss', kind: 'info', text: 'Kurzschluss: Die Spannung ist null, du misst den Kurzschlussstrom Isc = ' + fm(m.Isc, 2) + ' A. Die Leistung ist null, im MPP fließen ' + fm(m.Impp, 2) + ' A (' + fm(m.Impp / m.Isc * 100, 0) + ' % von Isc).' });
      if (m.anpass >= P.mppSchwelle) out.push({ id: 'mpp', kind: 'info', text: 'Du bist im MPP: Das Modul liefert ' + fm(m.op.P, 1) + ' W, das ist ' + fm(m.anpass, 1) + ' % der möglichen Leistung.' });
      if (ctl.lastart === 'widerstand' && m.anpass < P.anpassGrenze) out.push({ id: 'fehlanpassung', kind: 'info', text: 'Fehlanpassung: Dein Widerstand ist ' + fm(ctl.rLast, 2) + ' Ω, im MPP wären es ' + fm(m.Rmpp, 2) + ' Ω (Umpp durch Impp). Du nutzt nur ' + fm(m.anpass, 1) + ' % der möglichen Leistung.' });
      if (m.Uoc > P.uHoch) out.push({ id: 'uoc-hoch', kind: 'info', text: 'Hohe Gleichspannung: Die Leerlaufspannung ist ' + fm(m.Uoc, 1) + ' V. Das Modul liefert bei Licht immer Spannung, Arbeiten nur durch Elektrofachkraft.' });
      return out;
    }
    // ---- Kennlinien
    function fieldCurve(spec, G0, Tc, npts) {
      const C = api.core(), par = C.pv.cond(spec, { G: G0, Tc, fd: 0.12 }), ns = ctl.ns, np = ctl.np, uo = ns * par.Uoc, pts = [], pp = []; let best = { U: 0, I: 0, P: -1 };
      if (!(G0 >= 1) || !(uo > 0)) return { iu: [[0, 0]], pu: [[0, 0]], mpp: best, Uoc: 0, Isc: 0 };
      for (let i = 0; i <= npts; i++) { const u = uo * i / npts, cur = np * C.pv.current(par, u / ns); pts.push([+u.toFixed(4), +cur.toFixed(5)]); pp.push([+u.toFixed(4), +(u * cur).toFixed(4)]); if (u * cur > best.P) best = { U: u, I: cur, P: u * cur }; }
      return { iu: pts, pu: pp, mpp: best, Uoc: uo, Isc: np * par.Isc };
    }
    function curves() {
      const m = M; if (!m || !m.ok || ctl.view === 'aufbau') return [];
      if (cache.curves) return cache.curves; const C = api.core(), out = [], cur = fieldCurve(m.spec, m.G, m.Tc, 100);
      const marks = m.dark ? [] : [{ x: 0, y: m.Isc, label: 'Isc = ' + fm(m.Isc, 2) + ' A' }, { x: m.Uoc, y: 0, label: 'Uoc = ' + fm(m.Uoc, 1) + ' V' }, { x: m.Umpp, y: m.Impp, label: 'MPP ' + fm(m.Pmpp, 1) + ' W' }];
      out.push({ id: 'iu', title: 'Kennlinie I(U)', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Strom I', yUnit: 'A', series: [{ name: 'Modulkennlinie', points: cur.iu, bold: true }], marker: { x: m.op.U, y: m.op.I }, marks, rects: m.dark ? [] : [{ x0: 0, y0: 0, x1: m.Umpp, y1: m.Impp, name: 'Umpp mal Impp', fill: true }, { x0: 0, y0: 0, x1: m.Uoc, y1: m.Isc, name: 'Uoc mal Isc', dash: [6, 4] }] });
      out.push({ id: 'pu', title: 'Leistung P(U)', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Leistung P', yUnit: 'W', series: [{ name: 'Leistung', points: cur.pu, bold: true }], marker: { x: m.op.U, y: m.op.P }, marks: m.dark ? [] : [{ x: m.Umpp, y: m.Pmpp, label: 'MPP ' + fm(m.Pmpp, 1) + ' W' }] });
      if (ctl.compare !== 'aus') {
        const list = ctl.compare === 'einstrahlung' ? [200, 400, 600, 800, 1000] : [0, 25, 50, 75], dashes = [[2, 3], [6, 3], [10, 3, 2, 3], [14, 4], []], sIU = [], sPU = [], G1 = m.G >= 1 ? m.G : 1000;
        list.forEach((v, j) => {
          const c1 = ctl.compare === 'einstrahlung' ? fieldCurve(m.spec, v, m.Tc, 60) : fieldCurve(m.spec, G1, v, 60), nm = ctl.compare === 'einstrahlung' ? fm(v, 0) + ' W/m²' : fm(v, 0) + ' °C';
          sIU.push({ name: nm, points: c1.iu, dash: dashes[j % dashes.length] }); sPU.push({ name: nm, points: c1.pu, dash: dashes[j % dashes.length] });
        });
        sIU.push({ name: 'aktuell', points: cur.iu, bold: true }); sPU.push({ name: 'aktuell', points: cur.pu, bold: true });
        out.push({ id: 'schar-iu', title: 'Kurvenschar I(U)', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Strom I', yUnit: 'A', series: sIU, marker: { x: m.op.U, y: m.op.I } });
        out.push({ id: 'schar-pu', title: 'Kurvenschar P(U)', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Leistung P', yUnit: 'W', series: sPU, marker: { x: m.op.U, y: m.op.P } });
      }
      // Leistung ueber dem Lastwiderstand: R = U/I(U), Maximum bei R = Umpp/Impp
      const pr = []; if (!m.dark) { for (let i = 1; i <= 120; i++) { const u = m.Uoc * i / 120, cu = m.Ifeld(u); if (cu > 1e-6) { const r = u / cu; if (r >= 0.03 && r <= 800) pr.push([+r.toFixed(4), +(u * cu).toFixed(3)]); } } pr.sort((a, b) => a[0] - b[0]); }
      out.push({ id: 'p-r', title: 'Leistung über dem Lastwiderstand', xLabel: 'Lastwiderstand R', xUnit: 'Ω', yLabel: 'Leistung P', yUnit: 'W', xScale: 'log', series: [{ name: 'P(R)', points: pr.length ? pr : [[1, 0]], bold: true }], marker: m.dark || !(m.Rop > 0) ? null : { x: m.Rop, y: m.op.P }, marks: m.dark ? [] : [{ x: m.Rmpp, y: m.Pmpp, label: 'R = ' + fm(m.Rmpp, 2) + ' Ω' }] });
      cache.curves = out; return out;
    }
    function tables() {
      const C = api.core(); if (!C || !C.pv || !C.pv.build) return [];
      if (ctl.view !== 'aufbau') { const m = M, ds = (m && m.ok) ? C.pv.datasheet && C.pv.datasheet(m.spec) : null; return ds && ds.rows ? [{ id: 'datenblatt', title: 'Datenblatt (Übungsmodul, Werte aus dem Modell)', head: ['Größe', 'Wert', 'Einheit'], rows: ds.rows.map(r => [r.label, r.value, r.unit]) }] : []; }
      return [{ id: 'aufbau', title: 'Aufbau des Moduls (von oben nach unten)', head: ['Schicht', 'Dicke (mm)', 'Aufgabe'], rows: C.pv.build.map(b => [b.name, fm(b.mm, 2), b.rolle]) }];
    }
    function analysis() { const m = M; if (!m || !m.ok) return { ok: false, why: (m && m.why) || TXT.kern }; return { ok: true, keys: { Uoc: m.Uoc, Isc: m.Isc, Umpp: m.Umpp, Impp: m.Impp, Pmpp: m.Pmpp, FF: m.FF, eta: m.eta, Tc: m.Tc, G: m.G, dark: m.dark }, op: m.op, anpass: m.anpass, Rmpp: m.Rmpp, ns: m.ns, np: m.np, spec: m.spec.id }; }

    // ---- Geometrie (Weltkoordinaten) fuer Zeichnen und Treffer
    function geom(L) {
      const wide = L === 'wide', ns = ctl.ns, np = ctl.np, g = wide ? { scene: { x: 20, y: 20, w: 620, h: 330 }, view: { x: 32, y: 32, w: 170, h: 40 }, mods: { x: 60, y: 150, w: 560, h: 170 }, circ: { x: 660, y: 20, w: 320, h: 330 }, info: { x: 20, y: 360, w: 310, h: 260 }, mini: { x: 340, y: 360, w: 300, h: 260 }, last: { x: 660, y: 360, w: 320, h: 260 } }
        : { scene: { x: 10, y: 10, w: 540, h: 310 }, view: { x: 20, y: 20, w: 200, h: 48 }, mods: { x: 40, y: 140, w: 480, h: 160 }, circ: { x: 10, y: 330, w: 540, h: 210 }, last: { x: 10, y: 550, w: 540, h: 230 } };
      const gap = 14, mw = Math.min(150, (g.mods.w - gap * (ns - 1)) / ns), mh = Math.min(mw * (wide ? 0.95 : 0.9), (g.mods.h - gap * (np - 1)) / np), totW = mw * ns + gap * (ns - 1), totH = mh * np + gap * (np - 1);
      g.cells = { x0: g.mods.x + (g.mods.w - totW) / 2, y0: g.mods.y + (g.mods.h - totH) / 2 + 6, mw, mh, gap }; g.wide = wide;
      const bw = wide ? 290 : 255, bh = wide ? 40 : 60; g.btn = ['widerstand', 'spannung', 'mpp', 'leerlauf', 'kurzschluss'].map((v, i) => wide ? { v, x: g.last.x + 15, y: g.last.y + 40 + i * 44, w: bw, h: bh } : { v, x: g.last.x + 10 + (i % 2) * 265, y: g.last.y + 50 + Math.floor(i / 2) * 58, w: bw, h: bh });
      return g;
    }
    const LAB = { widerstand: 'Lastwiderstand', spannung: 'Spannung vorgeben', mpp: 'MPP', leerlauf: 'Leerlauf', kurzschluss: 'Kurzschluss' };
    const inR = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    function crossRect(g) { return { x: g.scene.x + 130, y: g.scene.y + 90, w: g.scene.w - 160, h: g.scene.h - 110 }; }
    function layerBands(rect, build) { // verzerrte Schichthoehen: Mindesthoehe, Summe = rect.h
      const raw = build.filter(b => b.id !== 'rahmen' && b.id !== 'dose').map(b => Math.max(0.9, Math.sqrt(Math.max(0.05, b.mm)))), sum = raw.reduce((a, q) => a + q, 0); let y = rect.y; const out = [];
      build.filter(b => b.id !== 'rahmen' && b.id !== 'dose').forEach((b, i) => { const hh = rect.h * raw[i] / sum; out.push({ b, x: rect.x, y, w: rect.w, h: hh }); y += hh; }); return out;
    }
    function hit(x, y, L) {
      const m = M; if (!m || !m.ok) return null; const g = geom(L), C = api.core();
      if (inR(x, y, g.view)) return { key: 'view', kind: 'switch', to: ctl.view === 'kennlinie' ? 'aufbau' : 'kennlinie' };
      if (ctl.view === 'aufbau') {
        if (C && C.pv && C.pv.build) { const bands = layerBands(crossRect(g), C.pv.build); for (const q of bands) if (inR(x, y, q)) return { key: 'schicht', kind: 'info', id: q.b.id, text: q.b.name + ' (' + fm(q.b.mm, 2) + ' mm): ' + q.b.rolle + '.' }; }
        return null;
      }
      for (const b of g.btn) if (inR(x, y, b)) return { key: 'lastart', kind: 'switch', to: b.v };
      const c = g.cells, spec = m.spec;
      for (let j = 0; j < ctl.np; j++) for (let i = 0; i < ctl.ns; i++) {
        const mx = c.x0 + i * (c.mw + c.gap), my = c.y0 + j * (c.mh + c.gap);
        if (x >= mx && x <= mx + c.mw && y >= my && y <= my + c.mh) {
          const col = clamp(Math.floor((x - mx) / c.mw * spec.cols), 0, spec.cols - 1), row = clamp(Math.floor((y - my) / c.mh * spec.rows), 0, spec.rows - 1);
          const uz = m.dark ? 0 : m.op.U / (m.ns * spec.Ns);
          return { key: 'zellinfo', kind: 'info', col, row, text: 'Zelle in Spalte ' + (col + 1) + ', Zeile ' + (row + 1) + ': Einstrahlung ' + fm(m.G, 0) + ' W/m², Zelltemperatur ' + fm(m.Tc, 1) + ' °C, Zellspannung im Arbeitspunkt ' + fm(uz, 3) + ' V (Modulspannung durch ' + (m.ns * spec.Ns) + ' Zellen in Reihe).' };
        }
      }
      return null;
    }
    // ---- Zeichnen
    function drawScene(ctx, g, tms, V, rd) {
      const m = M, s = g.scene, dark = m.dark, alt = dark ? -20 : 55, fs = g.wide ? 1 : 1.3, C = api.core();
      G.sky(ctx, s.x, s.y, s.w, s.h, alt, tms, rd);
      const sx = s.x + (g.wide ? 90 : 90), sy = s.y + (g.wide ? 90 : 110), inten = dark ? 0 : clamp(m.G / 1000, 0.15, 1);
      if (!dark) G.sun(ctx, sx, sy, g.wide ? 30 : 28, inten, tms, rd);
      else { G.circle(ctx, sx, sy, 20, '#dfe6ee', null); G.text(ctx, 'Nacht', sx + 62, sy, { size: 15 * fs, bold: true }); }
      G.text(ctx, dark ? 'Einstrahlung G = 0 W/m²' : 'Einstrahlung G = ' + fm(m.G, 0) + ' W/m²', s.x + s.w - 12, s.y + 20, { size: 14 * fs, bold: true, align: 'right', color: COL.gold });
      const c = g.cells; const top = c.y0;
      // Strahlen von der Sonne zur Modulflaeche (Zahl und Staerke wachsen mit G)
      if (!dark) {
        const n = clamp(Math.round(2 + 7 * clamp(m.G / 1200, 0, 1)), 3, 9), lw = 1 + 6 * Math.sqrt(clamp(m.G / 1000, 0, 1.2)) * 0.6, off = rd ? 0 : -(tms / 40) % 14, x1 = c.x0, x2 = c.x0 + ctl.ns * c.mw + (ctl.ns - 1) * c.gap;
        ctx.strokeStyle = 'rgba(255,214,90,' + (0.35 + 0.5 * inten).toFixed(2) + ')'; ctx.lineWidth = lw; ctx.setLineDash([9, 5]); ctx.lineDashOffset = off; ctx.beginPath();
        for (let i = 0; i < n; i++) { const px = x1 + (x2 - x1) * (i + 0.5) / n; ctx.moveTo(sx + 26, sy + 20 + (i - n / 2) * 2); ctx.lineTo(px, top - 4); } ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      // Module, Verdrahtung
      const lod = ctl.ns * ctl.np <= 2 ? 0 : ctl.ns * ctl.np <= 6 ? 1 : 2, spec = m.spec, glint = rd ? 0.3 : (tms / 7000) % 1;
      for (let j = 0; j < ctl.np; j++) for (let i = 0; i < ctl.ns; i++) {
        const mx = c.x0 + i * (c.mw + c.gap), my = c.y0 + j * (c.mh + c.gap);
        G.panel(ctx, mx, my, c.mw, c.mh, { cols: spec.cols, rows: spec.rows, subs: spec.subs, temp: dark ? 0 : m.Tc, lod, glint: glint + i * 0.05, noGlint: dark });
      }
      // Verdrahtung: Reihe Plus an Minus, parallel Sammelschienen
      ctx.lineWidth = 3; ctx.strokeStyle = COL.danger; ctx.beginPath(); const yb = c.y0 + ctl.np * c.mh + (ctl.np - 1) * c.gap;
      for (let i = 0; i < ctl.ns - 1; i++) { const xa = c.x0 + i * (c.mw + c.gap) + c.mw, xb = xa + c.gap; ctx.moveTo(xa, c.y0 - 4); ctx.lineTo(xa, c.y0 - 9); ctx.lineTo(xb, c.y0 - 9); ctx.lineTo(xb, c.y0 - 4); } ctx.stroke();
      if (ctl.np > 1) { ctx.strokeStyle = COL.cyan; ctx.beginPath(); ctx.moveTo(c.x0 - 10, c.y0); ctx.lineTo(c.x0 - 10, yb); ctx.stroke(); ctx.strokeStyle = COL.danger; ctx.beginPath(); ctx.moveTo(c.x0 + ctl.ns * c.mw + (ctl.ns - 1) * c.gap + 10, c.y0); ctx.lineTo(c.x0 + ctl.ns * c.mw + (ctl.ns - 1) * c.gap + 10, yb); ctx.stroke(); }
      G.text(ctx, (ctl.ns > 1 ? ctl.ns + ' in Reihe' : '1 in Reihe') + (ctl.np > 1 ? ', ' + ctl.np + ' Stränge parallel' : ''), s.x + s.w / 2, s.y + s.h - 12, { size: 13 * fs, bold: true });
      G.text(ctx, 'Zelltemperatur ' + fm(m.Tc, 1) + ' °C' + (ctl.tcMode === 'auto' ? ' (NOCT-Formel)' : ''), s.x + s.w / 2, s.y + s.h - 32 * fs, { size: 13 * fs, color: m.Tc > 50 ? COL.warn : COL.mute });
      // Ansichtsknopf
      const v = g.view; G.box(ctx, v.x, v.y, v.w, v.h, 'rgba(27,33,39,0.92)', COL.gold, 8); G.text(ctx, ctl.view === 'kennlinie' ? 'Zeige den Aufbau' : 'Zeige die Kennlinie', v.x + v.w / 2, v.y + v.h / 2, { size: 14 * fs, bold: true, outline: false });
    }
    function drawCross(ctx, g, tms, V, rd) {
      const m = M, s = g.scene, C = api.core(), rect = crossRect(g), fs = g.wide ? 1 : 1.3, build = (C && C.pv && C.pv.build) || [];
      G.sky(ctx, s.x, s.y, s.w, s.h, 55, tms, rd); G.sun(ctx, s.x + 90, s.y + 70, 28, m.dark ? 0.2 : 1, tms, rd);
      G.text(ctx, 'Schnitt durch das Modul (Dicken verzerrt)', s.x + s.w - 12, s.y + 20, { size: 14 * fs, bold: true, align: 'right' });
      const bands = layerBands(rect, build), cols = { glas: '#bfe3ee', eva1: '#e8e0b0', zelle: '#1d3b78', eva2: '#e8e0b0', folie: '#d8dde2' };
      bands.forEach(q => {
        ctx.fillStyle = cols[q.b.id] || '#999'; ctx.fillRect(q.x, q.y, q.w, q.h); G.text(ctx, q.b.name, q.x - 8, q.y + q.h / 2, { size: 12 * fs, align: 'right', bold: q.b.id === 'zelle' });
        if (q.b.id === 'zelle') { ctx.fillStyle = 'rgba(70,120,230,0.8)'; ctx.fillRect(q.x, q.y, q.w, q.h * 0.4); ctx.fillStyle = 'rgba(210,90,70,0.75)'; ctx.fillRect(q.x, q.y + q.h * 0.4, q.w, q.h * 0.6); G.text(ctx, 'n-Schicht', q.x + 34, q.y + q.h * 0.2, { size: 11 * fs, outline: false }); G.text(ctx, 'p-Schicht', q.x + 34, q.y + q.h * 0.72, { size: 11 * fs, outline: false }); }
      });
      const zb = bands.find(q => q.b.id === 'zelle'); if (!zb) return;
      // Photonen (Pfeile von oben), Elektron-Loch-Paare am pn-Uebergang, Stromweg
      const ph = rd ? 0 : (tms / 25) % 40, np2 = m.dark ? 0 : clamp(Math.round(2 + 4 * m.G / 1000), 2, 6);
      ctx.strokeStyle = COL.gold; ctx.fillStyle = COL.gold; ctx.lineWidth = 2;
      for (let i = 0; i < np2; i++) { const px = rect.x + rect.w * (i + 0.5) / np2, py0 = s.y + 40 + ph % 40, py1 = zb.y + zb.h * 0.35; G.arrow(ctx, px, Math.min(py0, rect.y - 4), px + 6, Math.min(py0 + 36, py1), COL.gold, 2, 7); }
      const jy = zb.y + zb.h * 0.4; ctx.setLineDash([4, 3]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(zb.x, jy); ctx.lineTo(zb.x + zb.w, jy); ctx.stroke(); ctx.setLineDash([]);
      G.text(ctx, 'pn-Übergang', zb.x + zb.w - 60, jy, { size: 11 * fs });
      if (!m.dark) for (let i = 0; i < np2; i++) { const px = rect.x + rect.w * (i + 0.5) / np2 + 22; G.circle(ctx, px - 6, jy - 3, 4, '#4fc3d9', '#fff', 1); G.circle(ctx, px + 6, jy + 3, 4, '#f0a030', '#fff', 1); }
      G.text(ctx, '− Elektron', rect.x + 60, zb.y - 6 * fs, { size: 11 * fs, color: COL.cyan }); G.text(ctx, '+ Loch', rect.x + 140 * fs, zb.y - 6 * fs, { size: 11 * fs, color: COL.warn });
      G.arrow(ctx, rect.x + rect.w + 6, zb.y + zb.h * 0.2, rect.x + rect.w + 6, rect.y - 20, COL.ok, 3, 10); G.text(ctx, 'Strom über Finger und Sammelschiene zur Anschlussdose', s.x + s.w / 2, s.y + s.h - 14, { size: 12 * fs, color: COL.ok });
      const v = g.view; G.box(ctx, v.x, v.y, v.w, v.h, 'rgba(27,33,39,0.92)', COL.gold, 8); G.text(ctx, 'Zeige die Kennlinie', v.x + v.w / 2, v.y + v.h / 2, { size: 14 * fs, bold: true, outline: false });
    }
    function drawCircuit(ctx, g, tms, V, rd, dt) {
      const m = M, c = g.circ, fs = g.wide ? 1 : 1.3; G.box(ctx, c.x, c.y, c.w, c.h, COL.panel, COL.line, 10);
      G.text(ctx, 'Stromkreis mit Last', c.x + 14, c.y + 20, { size: 15 * fs, bold: true, align: 'left' });
      const x0 = c.x + 50, x1 = c.x + c.w - 60, yt = c.y + (g.wide ? 100 : 90), yb = c.y + c.h - (g.wide ? 70 : 50), ym = (yt + yb) / 2, xm = (x0 + x1) / 2;
      const path = [[x0, ym - 24], [x0, yt], [xm - 40, yt], [xm + 40, yt], [x1, yt], [x1, ym - 30], [x1, ym + 30], [x1, yb], [x0, yb], [x0, ym + 24]];
      G.line(ctx, [[x0, yt], [x1, yt], [x1, yb], [x0, yb]], COL.mute, 3);
      // Modul-Symbol links (Quelle), Pluspol oben
      G.circle(ctx, x0, ym, 26, COL.panel2, COL.gold, 3); G.text(ctx, '+', x0, ym - 8, { size: 16 * fs, bold: true, color: COL.danger, outline: false }); G.text(ctx, '−', x0, ym + 10, { size: 16 * fs, bold: true, color: COL.blue, outline: false });
      G.text(ctx, 'Modul', x0, ym + 42 * fs, { size: 12 * fs, color: COL.mute });
      // Last: Widerstand (glueht nach P/Pmpp)
      const rl = { x: x1 - 16, y: ym - 30, w: 32, h: 60 }, pf = m.Pmpp > 0 ? clamp(m.op.P / m.Pmpp, 0, 1) : 0;
      if (pf > 0.02) { const gl = ctx.createRadialGradient(x1, ym, 6, x1, ym, 60); gl.addColorStop(0, 'rgba(255,150,40,' + (0.85 * pf).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x1, ym, 60, 0, 6.2832); ctx.fill(); }
      G.box(ctx, rl.x, rl.y, rl.w, rl.h, G.mix('#3a4652', '#ff8a2a', pf), COL.fg, 3);
      const lastTxt = ctl.lastart === 'widerstand' ? 'R = ' + fm(ctl.rLast, 2) + ' Ω' : ctl.lastart === 'leerlauf' ? 'Schalter offen' : ctl.lastart === 'kurzschluss' ? 'Kurzschluss' : ctl.lastart === 'mpp' ? 'R = ' + fm(m.Rmpp, 2) + ' Ω' : 'U vorgegeben';
      G.text(ctx, lastTxt, x1 - 4, yb + 18 * fs, { size: 12 * fs, align: 'right' });
      // Strommesser (in Reihe, oben) und Spannungsmesser (parallel, mittig)
      const rr = g.wide ? 32 : 38;
      G.gauge(ctx, xm, yt, rr, { value: m.op.I, lo: 0, hi: Math.max(1, m.Isc * 1.1), sym: 'A', read: fm(m.op.I, 2) + ' A', color: COL.cyan });
      G.line(ctx, [[xm + 70, yt], [xm + 70, ym - 6]], COL.mute, 2); G.line(ctx, [[xm + 70, ym + 6], [xm + 70, yb]], COL.mute, 2);
      G.gauge(ctx, xm + 70, ym, rr, { value: m.op.U, lo: 0, hi: Math.max(1, m.Uoc * 1.1), sym: 'V', read: fm(m.op.U, 1) + ' V', color: COL.warn });
      G.text(ctx, 'P = ' + fm(m.op.P, 1) + ' W', c.x + c.w / 2, c.y + 46 * (g.wide ? 1 : 1), { size: 16 * fs, bold: true, color: COL.gold });
      // Strompfeil (technische Richtung) und Elektronen (gegenlaeufig, blau)
      G.arrow(ctx, x0 + 14, yt, x0 + 70, yt, COL.danger, 3, 10); G.text(ctx, 'Strom I (technische Richtung)', x0 + 20, yt - 14 * fs, { size: 11 * fs, color: COL.danger, align: 'left' });
      if (m.op.I > 0.005) {
        const sp = rd ? 0.2 : 1; vis.ph += dt * sp * clamp(m.op.I / Math.max(0.5, m.Isc), 0.05, 1) * 0.06; const n = clamp(Math.round(6 + m.op.I / Math.max(0.5, m.Isc) * 22), 6, 28), pts = [[x0, yt], [x1, yt], [x1, yb], [x0, yb], [x0, yt]];
        G.dots(ctx, pts, n, -vis.ph, COL.cyan, 3.2);
      }
      G.text(ctx, 'Elektronen (blau) laufen gegen die Stromrichtung', c.x + c.w / 2, c.y + c.h - 14, { size: 11 * fs, color: COL.cyan });
      return path;
    }
    function drawLast(ctx, g, V) {
      const l = g.last, fs = g.wide ? 1 : 1.3; G.box(ctx, l.x, l.y, l.w, l.h, COL.panel, COL.line, 10); G.text(ctx, 'Last wählen (antippen)', l.x + 14, l.y + 22, { size: 15 * fs, bold: true, align: 'left' });
      g.btn.forEach(b => { const on = ctl.lastart === b.v; G.box(ctx, b.x, b.y, b.w, b.h, on ? COL.gold : COL.panel2, on ? COL.gold : COL.line, 8); G.text(ctx, LAB[b.v], b.x + b.w / 2, b.y + b.h / 2, { size: 14 * fs, bold: true, color: on ? '#10161c' : COL.fg, outline: false }); });
    }
    function drawInfo(ctx, g, V) {
      const m = M, i = g.info, mi = g.mini, rows = m.dark ? [['Nacht', 'Das Modul liefert nichts.']] : [['Leerlaufspannung Uoc', fm(m.Uoc, 1) + ' V'], ['Kurzschlussstrom Isc', fm(m.Isc, 2) + ' A'], ['MPP', fm(m.Umpp, 1) + ' V, ' + fm(m.Impp, 2) + ' A'], ['Leistung im MPP', fm(m.Pmpp, 1) + ' W'], ['Füllfaktor FF', fm(m.FF, 2)], ['Wirkungsgrad η', m.eta === null ? '–' : fm(m.eta, 1) + ' %'], ['Leistungsanpassung', fm(m.anpass, 1) + ' %']];
      G.box(ctx, i.x, i.y, i.w, i.h, COL.panel, COL.line, 10); G.text(ctx, 'Kennwerte', i.x + 14, i.y + 22, { size: 15, bold: true, align: 'left' });
      rows.forEach((r, k) => { G.text(ctx, r[0], i.x + 14, i.y + 54 + k * 28, { size: 13, align: 'left', color: COL.mute, outline: false }); G.text(ctx, r[1], i.x + i.w - 14, i.y + 54 + k * 28, { size: 13, bold: true, align: 'right', outline: false }); });
      G.box(ctx, mi.x, mi.y, mi.w, mi.h, COL.panel, COL.line, 10); G.text(ctx, 'Leistung über der Spannung', mi.x + 14, mi.y + 22, { size: 15, bold: true, align: 'left' });
      const cv = curves().find(q => q.id === 'pu'), px = mi.x + 44, py = mi.y + mi.h - 40, pw = mi.w - 64, ph = mi.h - 90;
      G.line(ctx, [[px, py - ph], [px, py], [px + pw, py]], COL.mute, 1.5);
      if (cv && !m.dark) {
        const xs = Math.max(1, m.Uoc), ys = Math.max(1, m.Pmpp * 1.1), pts = cv.series[0].points.map(q => [px + pw * q[0] / xs, py - ph * clamp(q[1] / ys, 0, 1)]); G.line(ctx, pts, COL.gold, 2.5);
        const mx = px + pw * m.Umpp / xs, my = py - ph * m.Pmpp / ys; G.circle(ctx, mx, my, 5, COL.ok, '#fff', 1.5); G.text(ctx, 'MPP', mx, my - 14, { size: 12, color: COL.ok, bold: true });
        const ox = px + pw * m.op.U / xs, oy = py - ph * clamp(m.op.P / ys, 0, 1); G.circle(ctx, ox, oy, 5, COL.danger, '#fff', 1.5); G.text(ctx, 'Arbeitspunkt', ox, oy + 16, { size: 11, color: COL.danger });
      }
      G.text(ctx, 'Spannung U in V', px + pw / 2, py + 22, { size: 11, color: COL.mute }); G.text(ctx, 'P in W', px, py - ph - 10, { size: 11, color: COL.mute, align: 'left' });
    }
    function draw(ctx, W, H, tms, L, V) {
      const m = M; ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
      if (!m || !m.ok) { G.text(ctx, (m && m.why) || TXT.kern, W / 2, H / 2, { size: 18 }); return; }
      const g = geom(L), rd = B.reduced(), dt = vis.t < 0 || tms < vis.t ? 0 : clamp(tms - vis.t, 0, 100); vis.t = tms;
      if (ctl.view === 'aufbau') drawCross(ctx, g, tms, V, rd); else drawScene(ctx, g, tms, V, rd);
      if (g.wide || ctl.view !== 'aufbau') drawCircuit(ctx, g, tms, V, rd, dt);
      drawLast(ctx, g, V); if (g.wide) drawInfo(ctx, g, V);
    }
    return {
      compute, meters, diag, curves, tables, analysis, hit, draw,
      stateExtra() { const m = M || zero(); return { N: 172, tS: 12, dark: !!m.dark, ok: !!m.ok, rOp: m.Rop, rMpp: m.Rmpp, eta: m.eta === null ? null : m.eta, nCells: m.ok ? m.spec.Ns * m.ns * m.np : 0 }; },
      traceNow() { const m = M || zero(); return { u: m.op.U, i: m.op.I, p: m.op.P }; },
      reset() { vis.t = -1; vis.ph = 0; }
    };
  }

  R.register({
    id: 'modul', name: 'Solarmodul-Kennlinie', icon: '☀️',
    info: 'Miss die Kennlinie einer Solarzelle oder eines Moduls: Leerlaufspannung, Kurzschlussstrom, den Punkt maximaler Leistung (MPP) und den Füllfaktor. Ändere Einstrahlung, Temperatur und Last, schalte Module in Reihe oder parallel und schau dir den Aufbau im Schnitt an.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'modul', controls: CONTROLS, meters: METERS, presets: PRESETS, h: 0.1, timeScale: 1, tUnit: 's', world: { w: 1000, h: 640 }, compactWorld: { w: 560, h: 790 }, params: P, traceKeys: ['u', 'i', 'p'], sampleEvery: 5, build: plantModul }, opts); }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
