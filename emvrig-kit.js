/* emvrig-kit.js - EMV-Lab, gemeinsamer Bausatz der Pruefstaende kopplung, schirm und abstrahlung (WP2b, ausgelagert in Schlank Stufe 2).
 * Erzeugt aus quelle/emvlab/emvrig_b_kit.part.js (node quelle/emvlab/build_emvrig_b.js); nicht von Hand aendern. Zahlenhilfen, Kern-Zugriff, Szenen-Bausteine; liegt als EMV_RIGS.kit bereit.
 * Abhaengigkeit: emvrig-base.js (EMV_RIGS.base, WP2a). Im Browser NACH emvrig-base.js und VOR emvrig-kopplung.js, emvrig-schirm.js, emvrig-antenne.js laden (in Node per require).
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./emvrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  if (!R.base) { if (typeof console !== 'undefined') console.warn('emvrig-kit.js: emvrig-base.js (EMV_RIGS.base) fehlt, der Prüfstand wird nicht registriert.'); return; }

  // =====================================================================================================================
  //  Gemeinsamer Bausatz der Pruefstaende kopplung, schirm und abstrahlung (WP2b): Zahlenhilfen, Kern-Zugriff, Szenen-Bausteine.
  //  Steht wortgleich in emvrig-kopplung.js, emvrig-schirm.js und emvrig-antenne.js (erzeugt aus emvrig_b_kit.part.js).
  //  Die Huelle (Steuerwerte, Cache, Ampel, Vorher/Nachher, Partikelpool, Geisterbild/Wischer) liefert EMV_RIGS.base (emvrig-base.js, WP2a).
  // =====================================================================================================================
  const K = (function () {
    const B = R.base;
    const { clamp, num, fm, fn, eng, okv, gfx, isNum } = B;
    const lg = Math.log10;
    const TAU = Math.PI * 2;

    // ---- Kern-Zugriff (nur hier; alle Rechnung steht in EMV_CORE, Regel 7) ----
    const core = () => B.core();
    /** Erste endliche Zahl aus einer Liste moeglicher Feldnamen (tolerant gegen Schreibweisen des Kerns). */
    function pickN(o, names) {
      if (!o || typeof o !== 'object') return NaN;
      for (let i = 0; i < names.length; i++) if (isNum(o[names[i]])) return o[names[i]];
      return NaN;
    }
    /** Zahl aus einer Kernantwort (Zahl oder Objekt mit einem der Feldnamen). */
    function numOf(r, names) { return isNum(r) ? r : pickN(r, names || ['value', 'v', 'SE', 'se']); }
    const dbuv = v => { const C = core(); const x = C && C.db && C.db.uv ? C.db.uv(v) : NaN; return isNum(x) ? x : NaN; };
    /** dBµV aus Volt, nach unten auf -60 dBµV geklemmt (Regel: nie unendlich anzeigen). */
    const dbuvC = v => { const x = dbuv(v); return isNum(x) ? Math.max(-60, x) : -60; };
    const ampelKey = (raw, fallbackMargin) => {
      let a = raw && typeof raw === 'object' ? raw.ampel : raw;
      a = B.ampelNorm(a);
      if (a === 'grau' && isNum(fallbackMargin)) a = B.ampelFromMargin(fallbackMargin);
      return a;
    };
    /** Ampel nach EMV_CORE.assess.margin (eine Quelle; Schwellen 6 und 0 dB stehen im Kern). */
    function ampelOfMargin(m) {
      if (!isNum(m)) return 'grau';
      const C = core(); let r = null;
      try { r = C && C.assess && typeof C.assess.margin === 'function' ? C.assess.margin(m) : null; } catch (e) { r = null; }
      return ampelKey(r, m);
    }
    const logSpace = (a, b, n) => { const out = []; for (let i = 0; i < n; i++) out.push(a * Math.pow(b / a, i / (n - 1))); return out; };
    /** Abbildung eines Kernwerts auf 0..1 (log), fuer Dichte und Geschwindigkeit der Partikel. */
    const rateLog = (v, lo, hi) => (isNum(v) && v > 0 ? clamp(lg(v / lo) / lg(hi / lo), 0, 1) : 0);
    const phaseHzOf = f => (isNum(f) && f > 0 ? Math.min(3, Math.max(0.3, 0.5 * lg(f))) : 0.5);   // SPEC 6.3 (hier auf 3 Hz begrenzt: Zuschauerschutz)
    const optNext = (def, cur) => { const o = def.options; const i = o.findIndex(q => q.value === cur); return o[(i + 1) % o.length].value; };

    // ---- Zeichenhilfen ----
    function plate(ctx, x, y, w, h, pal, title, o) {
      o = o || {};
      gfx.panel(ctx, x, y, w, h, pal.panel, pal.line, 8);
      if (title) gfx.text(ctx, title, x + 10, y + 15, { size: o.size || 12, bold: true, color: pal.fg, max: w - 20 });
    }
    /** Messmarke an der Stelle, an der die Groesse entsteht: Platte mit Text, optional Leitlinie zum Punkt (ax, ay). */
    function tag(ctx, s, x, y, col, pal, o) {
      o = o || {};
      if (!okv(x, y)) return 0;
      if (o.ax !== undefined && okv(o.ax, o.ay)) {
        ctx.strokeStyle = col; ctx.lineWidth = 1; if (ctx.setLineDash) ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(o.ax, o.ay); ctx.lineTo(x, y); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
        gfx.dot(ctx, o.ax, o.ay, 2.5, col);
      }
      return gfx.text(ctx, s, x, y, { size: o.size || 12, bold: o.bold !== false, color: col, bg: pal.panel, pad: 3, align: o.align || 'left', base: 'middle', max: o.max });
    }
    function ring(ctx, x, y, r, col, wd, dash) {
      if (!okv(x, y, r) || r <= 0) return;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = wd || 1.5;
      if (ctx.setLineDash) ctx.setLineDash(dash || []);
      ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
    }
    /** Stromrichtung im Leiterquerschnitt: kleiner Kreis mit Punkt (aus der Bildebene) oder Kreuz (in die Bildebene). */
    function currentDot(ctx, x, y, r, col, out, pal) {
      if (!okv(x, y, r)) return;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = pal.bg; ctx.lineWidth = 2; ctx.beginPath();
      if (out) { ctx.arc(x, y, 1.6, 0, TAU); ctx.fillStyle = pal.bg; ctx.fill(); }
      else { ctx.moveTo(x - r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 0.5, y + r * 0.5); ctx.moveTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.stroke(); }
    }
    function groundMark(ctx, x, y, col, s) { gfx.sym.gnd(ctx, x, y, col, s || 7); }
    /** Sinusspur mit Phase (0..1); amp in Pixeln, cycles Perioden ueber die Breite. */
    function sineTrace(ctx, x, y, w, amp, cycles, phase, col, wd, dash) {
      if (!okv(x, y, w, amp) || w < 4) return;
      const n = Math.max(24, Math.min(120, Math.floor(w / 3))), pts = [];
      for (let i = 0; i <= n; i++) pts.push([x + w * i / n, y - amp * Math.sin(TAU * (cycles * i / n - phase))]);
      gfx.line(ctx, pts, col, wd || 2, dash);
    }
    /** '#rrggbb' mit Deckkraft als rgba()-Text (fuer Verlaeufe). */
    function rgba(hex, a) {
      const m = /^#([0-9a-f]{6})$/i.exec(String(hex)); if (!m) return 'rgba(255,255,255,' + a + ')';
      const v = parseInt(m[1], 16); return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
    }
    /** Leuchthof: Radialverlauf (nur Stufe hoch und mittel, nur dunkles Thema); sonst nichts. */
    function glow(ctx, x, y, r, col, a, sc) {
      if (!okv(x, y, r) || r <= 0 || !sc || !sc.qp.gradients || !sc.pal.glow || sc.ghost) return;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    /** Additive Mischung (Leuchten) ein- und ausschalten, nur wenn die Stufe es erlaubt. */
    const lighter = (ctx, sc, on) => { if (sc && sc.qp.glow && sc.pal.glow) ctx.globalCompositeOperation = on ? 'lighter' : 'source-over'; };
    /** Kopf des Bildes: Wirkungskette (drei Hebel) und Ampelzeile. Liefert die y-Koordinate, ab der der Inhalt beginnt. */
    function header(ctx, w, view, sc) {
      const pal = sc.pal, m = 10;
      if (sc.header === false) return 10;   // die Seite zeigt Wirkungskette und Ampel selbst (Option header:false der Basis)
      gfx.chainBar(ctx, m, 8, w - 2 * m, 46, view.rig.chain, sc.active, { pal, size: sc.fs + 1 });
      gfx.ampelRow(ctx, m, 70, view.ampel, { pal, size: sc.fs + 1, max: w - 2 * m });
      return 90;
    }
    /** Fusszeile: Hinweis Uebungsanlage und Animationshinweis. */
    function footer(ctx, w, h, sc, note) {
      const pal = sc.pal;
      gfx.text(ctx, 'Übungsanlage: Zahlen sind Übungswerte' + (note ? ' · ' + note : ''), 12, h - 7, { size: sc.fs, color: pal.mute, max: w - 24 });
    }
    /** Aufteilung des Bildbereichs: liefert benannte Rechtecke je nach Seitenverhaeltnis (breit: zwei Spalten, hoch: gestapelt). */
    function split(w, h, y0, spec) {
      const m = 10, W = w - 2 * m, H = h - y0 - 24;
      if (!(W > 120 && H > 100)) return null;
      const out = {};
      if (w >= 940) {
        const lw = Math.round(W * spec.left), gap = 10;
        out[spec.a] = { x: m, y: y0, w: lw, h: H };
        const rw = W - lw - gap, h1 = Math.round(H * spec.rightTop);
        out[spec.b] = { x: m + lw + gap, y: y0, w: rw, h: h1 - 5 };
        out[spec.c] = { x: m + lw + gap, y: y0 + h1 + 5, w: rw, h: H - h1 - 5 };
      } else {
        const ha = Math.round(H * spec.stack[0]), hb = Math.round(H * spec.stack[1]), g = 8;
        out[spec.a] = { x: m, y: y0, w: W, h: ha - g };
        out[spec.b] = { x: m, y: y0 + ha, w: W, h: hb - g };
        out[spec.c] = { x: m, y: y0 + ha + hb, w: W, h: H - ha - hb };
      }
      return out;
    }
    /** Mindestgroesse eines Bildfelds (kleiner zeichnet nichts). */
    const big = (r, w, h) => !!r && r.w >= (w || 160) && r.h >= (h || 110);
    const inRect = (px, py, r) => !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    return { B, core, pickN, numOf, dbuv, dbuvC, ampelKey, ampelOfMargin, logSpace, rateLog, phaseHzOf, optNext, plate, tag, ring, currentDot, groundMark, sineTrace, header, footer, split, big, rgba, glow, lighter, inRect, clamp, num, fm, fn, eng, okv, gfx, isNum, lg, TAU };
  })();

  R.kit = K;

})(typeof window !== 'undefined' ? window : globalThis);
