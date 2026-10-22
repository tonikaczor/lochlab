/* emvrig-schirm.js - EMV-Lab, Pruefstand schirm (Schirmung und Gehaeuse: A + R + B, Schlitz, Loecher, Pigtail gegen 360 Grad, Stahl) (WP2b).
 * Erzeugt aus quelle/emvlab/emvrig_b_kit.part.js und dem Anlagenteil (node quelle/emvlab/build_emvrig_b.js); nicht von Hand aendern.
 * Abhaengigkeit: emvrig-base.js (EMV_RIGS.base, WP2a) und EMV_CORE (emvcore.js); EMV_DRAW (emvdraw.js) ist optional (die Szenen zeichnen mit den Helfern der Basis).
 * Uebungsanlage: Alle Zahlen sind Uebungswerte (Herstellerdokumentation und aktuelle Norm massgeblich). Deterministisch (Seed 1); setControl,
 * step und draw werfen nie. Mit Node ladbar (module.exports = EMV_RIGS). Im Browser NACH emvcore.js, emvdraw.js und emvrig-base.js laden.
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./emvrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  if (!R.base) { if (typeof console !== 'undefined') console.warn('emvrig-schirm.js: emvrig-base.js (EMV_RIGS.base) fehlt, der Prüfstand wird nicht registriert.'); return; }
  const B = R.base;

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

  // =====================================================================================================================
  //  Pruefstand schirm: Schirmung und Gehaeuse (SPEC 5.4). Gehaeuse 200 x 150 x 80 mm (Uebungsmass), Modell EMV_CORE.shield (SPEC 4.4).
  //  Alle Rechnung im Kern; hier stehen Steuerwerte, Meldungen (Wortlaut SPEC 4.10) und die Szene.
  // =====================================================================================================================
  (function () {
    const { clamp, fm, fn, eng, okv, gfx, lg, TAU } = K;
    const FREQ_SNAP = [50, 1.5e5, 1e6, 3e7, 1e8, 1e9];
    const LV = { q: 'quelle', p: 'pfad', s: 'senke' };
    const G = { q: 'Quelle entschärfen', p: 'Kopplung verringern', s: 'Senke härten', a: 'Anzeige und Vorgaben' };
    const fmSE = v => (v > 160 ? 'über 160' : fm(v, 1));   // Anzeige: Werte ueber 160 dB nennt die Rechnung, die Praxis erreicht sie nicht (Diagnose se-modell)
    const NONE = 200;   // Anzeige "kein Leck vorhanden" (dB)
    const MATS = { kupfer: { name: 'Kupfer', col: '#d9895a' }, alu: { name: 'Aluminium', col: '#aab5c0' }, stahl: { name: 'Stahl', col: '#778390' }, leitlack: { name: 'Leitlack', col: '#74a35a' } };
    const TXS = {
      chain: { quelle: 'Feld außen oder Schirmstrom auf dem Kabel', pfad: 'Gehäuse: Material, Schlitz, Löcher, Kabeldurchführung', senke: 'Elektronik im Gehäuse', art: 'gestrahlt', kopplung: ['strahlung', 'induktiv', 'kapazitiv'] },
      info: 'Gehäuse 200 × 150 × 80 mm (Übungsmaß) mit einfallender Welle oder Nahfeldquelle. Die Schirmdämpfung ist SE = A + R + B (Absorption, Reflexion, Mehrfachreflexion), ein Schlitz oder ein Lochfeld bildet ein Leck, und die Kabeldurchführung entscheidet, wie viel Störspannung ins Innere kommt. Übungsanlage: Alle Zahlen sind Übungswerte; Herstellerdokumentation und aktuelle Norm maßgeblich.',
      help: {
        mat: 'Material der Gehäusewand. Kupfer und Aluminium reflektieren stark, Stahl absorbiert dank seiner Permeabilität auch tiefe Magnetfelder (Übungswert: konstantes µr), Leitlack ist ein dünner Film mit festem Flächenwiderstand.',
        t: 'Wanddicke. Eine dickere Wand erhöht die Absorption A (A = 8,686 · t/δ); eine dünne Folie schirmt bei niedriger Frequenz kaum.',
        rsq: 'Flächenwiderstand des Leitlacks. Ein kleinerer Wert schirmt besser (Film dünner als die Hauttiefe).',
        feld: 'Art des einfallenden Felds: Fernfeld (ebene Welle), elektrisches Nahfeld (Spannungsquelle, hohe Wellenimpedanz) oder magnetisches Nahfeld (Stromschleife, niedrige Wellenimpedanz). Die Reflexion hängt von der Wellenimpedanz ab.',
        r: 'Abstand zwischen Störquelle und Schirm. Die Nahfeldformeln gelten nur, solange der Abstand kleiner als λ/(2π) ist.',
        f: 'Frequenz des einfallenden Felds. Die Hauttiefe sinkt mit der Frequenz; Schlitz und Löcher verlieren ihre Wirkung, wenn ihre Länge die halbe Wellenlänge erreicht.',
        slot: 'Länge eines Schlitzes in der Wand (zum Beispiel zwischen Gehäuseteilen). Ein Schlitz, der so lang ist wie die halbe Wellenlänge, schirmt nicht mehr; kürzere Schlitze lecken weniger. Faustformel: SE = 20·lg(λ/(2ℓ)).',
        holes: 'Anzahl der Löcher (zum Beispiel Lüftungsbohrungen), nahe beieinander angenommen. Mehr Löcher bedeuten ein größeres Leck.',
        dhole: 'Durchmesser der Löcher. Kleinere Löcher lecken erst bei höheren Frequenzen.',
        kabel: 'Anbindung des Kabelschirms am Gehäuse: 360° rundum (kleine Kopplungsimpedanz) oder als Pigtail (Schirmlitze, die Induktivität der Litze erzeugt eine große Kopplungsimpedanz).',
        lp: 'Länge der Schirmlitze beim Pigtail. Etwa 1 nH je Millimeter: kurze Litze, kleine Kopplungsimpedanz.',
        ish: 'Störstrom, der außen auf dem Kabelschirm fließt (zum Beispiel eingekoppelt). Er erzeugt an der Kopplungsimpedanz Zt die Störspannung im Inneren.',
        seReq: 'Vorgabe der Übung: Mindest-Schirmdämpfung. Das ist kein Normwert, sondern die Aufgabenstellung.',
        uInReq: 'Vorgabe der Übung: höchste zulässige Störspannung im Inneren. Das ist kein Normwert, sondern die Aufgabenstellung.'
      }
    };
    const sl = (key, label, min, max, value, unit, unitKind, lever, group, help, o) => Object.assign({ key, label, type: 'slider', scale: 'log', min, max, step: min, value, unit, unitKind, lever, group, help }, o || {});
    const controls = [
      { key: 'mat', label: 'Material', type: 'select', value: 'alu', options: [{ value: 'kupfer', label: 'Kupfer' }, { value: 'alu', label: 'Aluminium' }, { value: 'stahl', label: 'Stahl' }, { value: 'leitlack', label: 'Leitlack' }], lever: LV.p, group: G.p, help: TXS.help.mat },
      sl('t', 'Wanddicke t', 1e-5, 3e-3, 5e-4, 'm', 'len', LV.p, G.p, TXS.help.t),
      sl('rsq', 'Flächenwiderstand (Leitlack)', 0.02, 2, 0.1, 'Ω', 'res', LV.p, G.p, TXS.help.rsq, { visible: s => s.mat === 'leitlack' }),
      { key: 'feld', label: 'Feldart', type: 'select', value: 'fern', options: [{ value: 'fern', label: 'Fernfeld' }, { value: 'enah', label: 'E-Nahfeld' }, { value: 'hnah', label: 'H-Nahfeld' }], lever: LV.q, group: G.q, help: TXS.help.feld },
      sl('r', 'Abstand Quelle–Schirm r', 0.01, 1, 0.1, 'm', 'len', LV.q, G.q, TXS.help.r),
      sl('f', 'Frequenz f', 10, 1e9, 1e6, 'Hz', 'freq', LV.q, G.q, TXS.help.f, { snap: FREQ_SNAP }),
      { key: 'slot', label: 'Schlitzlänge', type: 'slider', scale: 'lin', min: 0, max: 0.2, step: 0.001, value: 0, unit: 'm', unitKind: 'len', lever: LV.p, group: G.p, help: TXS.help.slot },
      { key: 'holes', label: 'Anzahl Löcher', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, value: 0, unit: '', unitKind: 'count', lever: LV.p, group: G.p, help: TXS.help.holes },
      { key: 'dhole', label: 'Lochdurchmesser', type: 'slider', scale: 'lin', min: 1e-3, max: 0.02, step: 5e-4, value: 5e-3, unit: 'm', unitKind: 'len', lever: LV.p, group: G.p, help: TXS.help.dhole },
      { key: 'kabel', label: 'Schirmanbindung des Kabels', type: 'select', value: '360', options: [{ value: '360', label: '360° rundum' }, { value: 'pigtail', label: 'Pigtail (Schirmlitze)' }], lever: LV.p, group: G.p, help: TXS.help.kabel },
      { key: 'lp', label: 'Länge der Schirmlitze', type: 'slider', scale: 'lin', min: 0, max: 0.1, step: 0.001, value: 0.03, unit: 'm', unitKind: 'len', lever: LV.p, group: G.p, help: TXS.help.lp, visible: s => s.kabel === 'pigtail' },
      sl('ish', 'Schirmstrom', 1e-4, 1e-2, 5e-4, 'A', 'amp', LV.q, G.q, TXS.help.ish),
      { key: 'seReq', label: 'Vorgabe Schirmdämpfung', type: 'slider', scale: 'lin', min: 20, max: 100, step: 1, value: 40, unit: 'dB', unitKind: 'db', lever: null, group: G.a, help: TXS.help.seReq },
      { key: 'uInReq', label: 'Vorgabe Störspannung innen', type: 'slider', scale: 'lin', min: 30, max: 100, step: 1, value: 60, unit: 'dBµV', unitKind: 'dbuv', lever: null, group: G.a, help: TXS.help.uInReq }
    ];
    const meters = [
      { key: 'delta', label: 'Hauttiefe δ (0 = nicht definiert)', unit: 'µm', digits: 2 },
      { key: 'seA', label: 'Absorption A', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'seR', label: 'Reflexion R', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'seB', label: 'Mehrfachreflexion B', unit: 'dB', digits: 1, min: -30, max: 0 },
      { key: 'seMat', label: 'Schirmdämpfung der Wand SE = A + R + B', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'seSlot', label: 'Schirmdämpfung des Schlitzes (200 = kein Schlitz)', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'seHoles', label: 'Schirmdämpfung der Löcher (200 = keine Löcher)', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'seGes', label: 'Schirmdämpfung gesamt', unit: 'dB', digits: 1, min: 0, max: 200 },
      { key: 'uIn', label: 'Störspannung innen (Schirmstrom)', unit: 'dBµV', digits: 1, min: 0, max: 120 },
      { key: 'fSlot', label: 'Kritische Frequenz des Schlitzes (0 = kein Schlitz)', unit: 'MHz', digits: 0 }
    ];
    const presets = [
      { id: 'blech-fern', name: 'Blech im Fernfeld', info: 'Aluminiumblech, 0,5 mm, ebene Welle bei 1 MHz: A und R sind weit über der Vorgabe.', params: { mat: 'alu', t: 5e-4, feld: 'fern', f: 1e6 } },
      { id: 'folie-hnah', name: 'Dünne Folie, niederfrequentes Magnetfeld', info: 'Kupferfolie 0,1 mm bei 1 kHz im magnetischen Nahfeld: Die Folie schirmt kaum.', params: { mat: 'kupfer', t: 1e-4, feld: 'hnah', r: 0.1, f: 1e3 } },
      { id: 'stahl-hnah', name: 'Stahl gegen Magnetfeld', info: 'Stahlblech 1 mm bei 10 kHz im magnetischen Nahfeld: Die Permeabilität erhöht die Absorption stark (Übungswert µr = 200).', params: { mat: 'stahl', t: 1e-3, feld: 'hnah', r: 0.1, f: 1e4, seReq: 60 } },
      { id: 'schlitz', name: 'Gehäuse mit Schlitz', info: 'Aluminium 1 mm, Schlitz 100 mm bei 300 MHz: Das schwächste Leck bestimmt die Schirmdämpfung.', params: { mat: 'alu', t: 1e-3, feld: 'fern', f: 3e8, slot: 0.1 } },
      { id: 'pigtail', name: 'Kabel mit Pigtail', info: 'Kabelschirm als Schirmlitze (50 mm) bei 100 MHz: Die Litze hat eine große Kopplungsimpedanz und lässt Störspannung ins Innere.', params: { mat: 'alu', t: 1e-3, feld: 'fern', f: 1e8, kabel: 'pigtail', lp: 0.05 } }
    ];
    const SPEC = { id: 'schirm', name: 'Schirmung und Gehäuse', icon: '🛡️', info: TXS.info, world: { w: 960, h: 600 }, chain: TXS.chain, controls, noLever: ['seReq', 'uInReq'], meters, presets, params: { box: { w: 0.2, h: 0.15, d: 0.08 } } };

    const nm = id => (MATS[id] ? MATS[id].name : id);
    // Meldungen: Wortlaut und Bedingungen stehen im Kern (EMV_CORE.diagnose, TEXTS); die Anlage reicht das Ergebnis von shield.total weiter.
    function diagS(res, ctl, CORE) {
      if (!res || !res.ok) return [];
      let out = [];
      try { out = CORE.diagnose({ shield: { res: res.raw } }) || []; } catch (e) { out = []; }
      const note = res.raw && res.raw.mat && res.raw.mat.note;
      if (ctl.feld !== 'fern' && !res.thin && typeof note === 'string' && note) out.push({ id: 'nahfeld-fern', kind: 'info', text: note });
      if (res.seGes > 160) out.push({ id: 'se-modell', kind: 'info', text: 'Die Rechnung ergibt ' + fm(res.seGes, 0) + ' dB. In der Praxis begrenzen Fugen, Kabel und andere Leckpfade die Schirmdämpfung weit darunter; über 160 dB wird nichts dargestellt.' });
      return out;
    }

    const TOPY = { v: 90 };   // Oberkante des Bildinhalts (nach dem Kopf; 10 ohne Kopf)
    function layoutS(w, h) { return K.split(w, h, TOPY.v, { a: 'box', b: 'bars', c: 'cab', left: 0.52, rightTop: 0.56, stack: [0.46, 0.24] }); }
    function boxGeom(r, ctl) {
      const ix = r.x + 10, iy = r.y + 26, iw = r.w - 20, ih = r.h - 26 - 26;
      const g = { ix, iy, iw, ih, cy: iy + ih * 0.56 };
      const ur = clamp(lg(ctl.r / 0.01) / 2, 0, 1);
      g.sx = ix + 26; g.dist = 34 + iw * 0.2 * ur;
      g.bw = iw * 0.4; g.bh = ih * 0.7;
      g.xw = Math.min(g.sx + g.dist, ix + iw - g.bw - 70); g.dist = g.xw - g.sx;
      g.yt = g.cy - g.bh / 2; g.yb = g.cy + g.bh / 2;
      g.wallRect = { x: g.xw - 8, y: g.yt, w: 16, h: g.bh };
      g.cabRect = { x: g.xw + g.bw - 6, y: g.cy - 20, w: 70, h: 40 };
      return g;
    }
    function areasS(w, h, ctl) {
      const L = layoutS(w, h); if (!L || !K.big(L.box, 220, 150)) return [];
      const g = boxGeom(L.box, ctl);
      return [{ key: 'kabel', kind: 'select', to: ctl.kabel === '360' ? 'pigtail' : '360', x: g.cabRect.x, y: g.cabRect.y, w: g.cabRect.w, h: g.cabRect.h }, { key: 'mat', kind: 'select', to: K.optNext(controls[0], ctl.mat), x: g.wallRect.x, y: g.wallRect.y, w: g.wallRect.w, h: g.wallRect.h }];
    }
    const waveSpacing = lam => { const D = B.getDraw(); return D && D.waveSpacing ? D.waveSpacing(lam) : (isFinite(lam) && lam > 0 ? clamp(10 + 12 * (lg(lam) + 0.5), 10, 60) : 24); };
    const shieldBright = se => { const D = B.getDraw(); return D && D.shieldBrightness ? D.shieldBrightness(se) : clamp(1 - se / 100, 0.04, 1); };

    function plant(P0) {
      const CORE = P0.CORE;
      const drawn = { rings: 0, alphaOut: 0, alphaIn: 0, alphaSlot: 0, spacing: 0 };
      function compute(ctl, par) {
        const pk = K.pickN, S = CORE.shield;
        const tot = S.total({ mat: ctl.mat, t: ctl.t, f: ctl.f, feld: ctl.feld, r: ctl.r, rsq: ctl.rsq, slot: ctl.slot, holes: ctl.holes, dhole: ctl.dhole, kabel: ctl.kabel, lp: ctl.lp, ish: ctl.ish, seReq: ctl.seReq, uInReq: ctl.uInReq });
        if (!tot || tot.ok === false) return { ok: false, why: (tot && tot.why) || 'Die Schirmdämpfung ist für diese Eingaben nicht berechenbar.' };
        const res = { ok: true, raw: tot, A: tot.A, R: tot.R, Bm: tot.B, seMat: tot.seMat, thin: !!(tot.mat && tot.mat.thin) };
        res.delta = res.thin ? NaN : tot.delta;
        res.lam = K.numOf(CORE.antenna.lambda(ctl.f), ['lambda', 'lam', 'value']);
        res.hasSlot = ctl.slot > 0; res.hasHoles = ctl.holes > 0;
        const list = [res.seMat], names = ['Material'];
        res.seSlot = NONE; res.seHoles = NONE; res.fSlot = 0;
        if (res.hasSlot) { res.seSlot = tot.seSlot; res.fSlot = isFinite(tot.fSlot) ? tot.fSlot : 0; list.push(res.seSlot); names.push('Schlitz'); }
        if (res.hasHoles) { res.seHoles = tot.seHoles; list.push(res.seHoles); names.push('Löcher'); }
        res.nLeak = list.length; res.seGes = tot.seGes; res.list = list; res.names = names;
        let iMin = 0; list.forEach((v, i) => { if (v < list[iMin]) iMin = i; });
        res.seMin = list[iMin]; res.leakName = names[iMin];
        const cab = tot.cable || {};
        res.uIn = tot.uIn; res.zt = pk(cab, ['zt']); res.zt360 = pk(cab, ['zt360']);
        const c360 = S.cable({ mode: '360', lp: 0, f: ctl.f, ish: ctl.ish }); res.uIn360 = pk(c360, ['L', 'uInDb']);
        if (!isFinite(res.seGes) || !isFinite(res.uIn)) return { ok: false, why: 'Die Rechnung liefert für diese Eingaben kein Ergebnis.' };
        res.m1 = tot.marginSE; res.m2 = tot.marginIn;
        res.margin = tot.margin; res.limit = tot.worst === 'se' ? 'Schirmdämpfung' : 'Kabeldurchführung';
        res.alphaIn = shieldBright(res.seGes);
        res.alphaSlot = res.hasSlot ? clamp(1 - res.seSlot / 60, 0.1, 1) : 0;
        res.alphaHoles = res.hasHoles ? clamp(1 - res.seHoles / 60, 0.1, 1) : 0;
        return res;
      }
      function meters(res) {
        if (!res.ok) return { delta: 0, seA: 0, seR: 0, seB: 0, seMat: 0, seSlot: 0, seHoles: 0, seGes: 0, uIn: 0, fSlot: 0 };
        return { delta: isFinite(res.delta) ? res.delta * 1e6 : 0, seA: res.A, seR: res.R, seB: res.Bm, seMat: res.seMat, seSlot: res.seSlot, seHoles: res.seHoles, seGes: res.seGes, uIn: res.uIn, fSlot: res.fSlot / 1e6 };
      }
      function assess(res, ctl) {
        if (!res.ok) return { ok: false, ampel: 'grau', text: res.why };
        const amp = K.ampelOfMargin(res.margin);
        const leak = res.nLeak > 1 ? ' Das schwächste Leck: ' + res.leakName + ' mit ' + fm(res.seMin, 1) + ' dB.' : '';
        const verd = amp === 'gruen' ? 'Beide Vorgaben sind mit Sicherheitsabstand erfüllt.' : amp === 'gelb' ? 'Die Vorgaben sind knapp erfüllt (' + res.limit + ' begrenzt).' : 'Eine Vorgabe wird verfehlt (' + res.limit + ' begrenzt).';
        return { ok: res.margin >= 0, ampel: amp, margin: res.margin, freq: ctl.f, text: 'Marge ' + fm(res.margin, 1) + ' dB: Schirmdämpfung ' + fmSE(res.seGes) + ' dB (Vorgabe ' + fm(ctl.seReq, 0) + ' dB), Störspannung innen ' + fm(res.uIn, 1) + ' dBµV (Vorgabe ' + fm(ctl.uInReq, 0) + ' dBµV). ' + verd + leak };
      }
      function curves(res, ctl) {
        const S = CORE.shield, fl = K.logSpace(10, 1e9, 100), cl = v => (isFinite(v) ? clamp(v, 0, 160) : 0);
        if (!res.ok) return [{ id: 'se', title: 'Schirmdämpfung über der Frequenz', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Schirmdämpfung', yUnit: 'dB', series: [{ name: 'keine Rechnung', points: [[10, 0], [1e9, 0]] }] }];
        const ser = { mat: [], slot: [], holes: [], ges: [] };
        fl.forEach(f => {
          const q = S.se({ mat: ctl.mat, t: ctl.t, f, feld: ctl.feld, r: ctl.r, rsq: ctl.rsq }); const m = K.numOf(q, ['SE', 'se']); if (!isFinite(m)) return;
          const list = [m]; ser.mat.push([f, cl(m)]);
          if (ctl.slot > 0) { const v = K.numOf(S.slot({ len: ctl.slot, f }), ['SE', 'se']); if (isFinite(v)) { list.push(v); ser.slot.push([f, cl(v)]); } }
          if (ctl.holes > 0) { const v = K.numOf(S.holes({ n: ctl.holes, d: ctl.dhole, f }), ['SE', 'se']); if (isFinite(v)) { list.push(v); ser.holes.push([f, cl(v)]); } }
          const g = list.length > 1 ? K.numOf(S.combine(list), ['SE', 'se']) : m; ser.ges.push([f, cl(g)]);
        });
        const series = [{ name: 'Wand', points: ser.mat }];
        if (ctl.slot > 0) series.push({ name: 'Schlitz', points: ser.slot });
        if (ctl.holes > 0) series.push({ name: 'Löcher', points: ser.holes });
        if (series.length > 1) series.push({ name: 'gesamt', points: ser.ges });
        const cv1 = { id: 'se', title: 'Schirmdämpfung über der Frequenz (bis 160 dB dargestellt)', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Schirmdämpfung', yUnit: 'dB', series, limit: { y: ctl.seReq, name: 'Vorgabe (Übung)' }, marker: { x: ctl.f, y: cl(res.seGes), text: fmSE(res.seGes) + ' dB' } };
        const zt = { a: [], b: [] }, fz = K.logSpace(1e4, 1e9, 60);
        fz.forEach(f => { const a = S.cable({ mode: '360', lp: 0, f, ish: ctl.ish }), b = S.cable({ mode: 'pigtail', lp: ctl.lp > 0 ? ctl.lp : 0.03, f, ish: ctl.ish }); const za = K.pickN(a, ['zt', 'Zt']), zb = K.pickN(b, ['zt', 'Zt']); if (isFinite(za) && isFinite(zb)) { zt.a.push([f, 20 * lg(za)]); zt.b.push([f, 20 * lg(zb)]); } });
        const cv2 = { id: 'zt', title: 'Kopplungsimpedanz der Durchführung', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Kopplungsimpedanz', yUnit: 'dBΩ (0 dBΩ = 1 Ω)', series: [{ name: '360°', points: zt.a }, { name: 'Pigtail ' + fm((ctl.lp > 0 ? ctl.lp : 0.03) * 1e3, 0) + ' mm', points: zt.b }], marker: { x: ctl.f, y: isFinite(res.zt) ? 20 * lg(res.zt) : 0, text: fm(res.zt, res.zt < 10 ? 2 : 1) + ' Ω' } };
        return [cv1, cv2];
      }

      // ---------------- Szene ----------------
      function boxScene(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Gehäuse im Schnitt (Skizze)', { size: fs });
        if (!K.big(r, 220, 150)) return;
        const g = boxGeom(r, ctl), ph = view.phase, mat = MATS[ctl.mat] || MATS.alu;
        const spacing0 = waveSpacing(res.lam), spacing = Math.max(spacing0, g.dist / 8);
        ctx.save(); ctx.beginPath(); ctx.rect(r.x + 2, r.y + 22, r.w - 4, r.h - 24); ctx.clip();
        // einfallende Welle (hoechstens 8 Ringe/Fronten); Helligkeit innen ~ 1 - SE/100
        const aOut = 0.9, aIn = res.alphaIn * 0.9, colW = ctl.feld === 'enah' ? pal.efeld : ctl.feld === 'hnah' ? pal.hfeld : pal.fg;
        const nOut = Math.min(8, Math.floor(g.dist / spacing)), off = sc.reduced ? 0 : ph * spacing;
        const near = ctl.feld !== 'fern';
        K.lighter(ctx, sc, true);
        const front = (rad, a, wdt, inside) => {
          ctx.globalAlpha = a; ctx.strokeStyle = colW; ctx.lineWidth = wdt; ctx.beginPath();
          if (near) { const ang = Math.min(1.1, (g.bh * 0.62) / Math.max(rad, 1)); ctx.arc(g.sx, g.cy, rad, -ang, ang); }
          else { const x = g.sx + rad; ctx.moveTo(x, g.yt - 6); ctx.lineTo(x, g.yb + 6); }
          ctx.stroke();
        };
        let rings = 0;
        for (let k = 0; k < 12; k++) {
          const rad = (k + (sc.reduced ? 0.5 : ph)) * spacing; if (rad < 6) continue;
          if (rad < g.dist - 4) { front(rad, aOut * (1 - rad / (g.dist * 1.6)), 2, false); rings++; if (rings >= 8) break; }
        }
        ctx.globalAlpha = 1;
        // innen: gedaempfte Fronten
        for (let k = 0; k < 14; k++) {
          const rad = g.dist + 8 + (k + (sc.reduced ? 0.5 : ph)) * spacing; if (rad > g.dist + g.bw - 6) break;
          front(rad, aIn, 1.6, true);
        }
        ctx.globalAlpha = 1; K.lighter(ctx, sc, false); ctx.restore();
        // Quelle
        if (ctl.feld === 'fern') { gfx.text(ctx, '≈', g.sx, g.cy, { size: 20, bold: true, color: pal.fg, align: 'center', base: 'middle' }); }
        else if (ctl.feld === 'enah') { gfx.dot(ctx, g.sx, g.cy - 7, 4.5, pal.quelle); gfx.dot(ctx, g.sx, g.cy + 7, 4.5, pal.senke); gfx.text(ctx, '+', g.sx, g.cy - 7, { size: 10, bold: true, color: pal.bg, align: 'center', base: 'middle' }); gfx.text(ctx, '−', g.sx, g.cy + 7, { size: 10, bold: true, color: pal.bg, align: 'center', base: 'middle' }); }
        else { K.ring(ctx, g.sx, g.cy, 8, pal.hfeld, 2.5); K.currentDot(ctx, g.sx - 8, g.cy, 3, pal.hfeld, true, pal); K.currentDot(ctx, g.sx + 8, g.cy, 3, pal.hfeld, false, pal); }
        const srcTxt = ctl.feld === 'fern' ? 'Fernfeld' : ctl.feld === 'enah' ? 'E-Nahfeld' : 'H-Nahfeld';
        gfx.text(ctx, srcTxt + ' f = ' + eng(ctl.f, 'Hz'), g.ix + 2, g.iy + 12, { size: fs, bold: true, color: colW, bg: pal.panel, pad: 2, max: g.iw * 0.6 });
        if (ctl.feld !== 'fern') { gfx.arrow(ctx, g.sx, g.cy + g.bh * 0.5 + 14, g.xw - 9, g.cy + g.bh * 0.5 + 14, pal.mute, 1.2, 4); gfx.arrow(ctx, g.xw - 9, g.cy + g.bh * 0.5 + 14, g.sx, g.cy + g.bh * 0.5 + 14, pal.mute, 1.2, 4); gfx.text(ctx, 'r = ' + eng(ctl.r, 'm'), (g.sx + g.xw) / 2, g.cy + g.bh * 0.5 + 27, { size: fs, color: pal.fg, align: 'center', bg: pal.panel, pad: 2 }); }
        // Gehaeuse (Wanddicke ~ t, logarithmisch abgebildet)
        const tPx = clamp(2 + 7 * lg(ctl.t / 1e-5) / lg(300), 2, 9);
        const xw = g.xw, xr = g.xw + g.bw;
        ctx.fillStyle = pal.panel2; ctx.globalAlpha = 0.6; ctx.fillRect(xw, g.yt, g.bw, g.bh); ctx.globalAlpha = 1;
        if (sc.qp.gradients) { const lg2 = ctx.createLinearGradient(xw, g.yt, xr, g.yb); lg2.addColorStop(0, K.rgba(mat.col, 1)); lg2.addColorStop(0.5, '#ffffff'); lg2.addColorStop(1, K.rgba(mat.col, 1)); ctx.strokeStyle = lg2; } else ctx.strokeStyle = mat.col;
        ctx.lineWidth = tPx; ctx.lineJoin = 'miter';
        // Wand mit Schlitz (links) und Loechern
        const slotPx = res.hasSlot ? clamp(8 + g.bh * 0.62 * (ctl.slot / 0.2), 8, g.bh * 0.7) : 0;
        ctx.beginPath();
        ctx.moveTo(xw, g.yt); ctx.lineTo(xr, g.yt); ctx.lineTo(xr, g.yb); ctx.lineTo(xw, g.yb);
        if (res.hasSlot) { ctx.lineTo(xw, g.cy + slotPx / 2); ctx.moveTo(xw, g.cy - slotPx / 2); ctx.lineTo(xw, g.yt); } else ctx.lineTo(xw, g.yt);
        ctx.stroke();
        // Loecher
        let holeN = 0;
        if (res.hasHoles) {
          const nd = Math.min(12, ctl.holes), rows = nd; holeN = nd;
          for (let i = 0; i < nd; i++) { const yy = g.yt + 14 + (g.bh - 28) * (i + 0.5) / rows; if (res.hasSlot && Math.abs(yy - g.cy) < slotPx / 2 + 3) continue; ctx.beginPath(); ctx.arc(xw, yy, Math.max(2, Math.min(6, ctl.dhole * 400)), 0, TAU); ctx.fillStyle = pal.bg; ctx.fill(); ctx.strokeStyle = mat.col; ctx.lineWidth = 1.5; ctx.stroke(); }
        }
        // Leck-Faecher ins Innere (Helligkeit ~ 1 - SE/60)
        if (res.hasSlot) { ctx.save(); ctx.globalAlpha = res.alphaSlot * 0.9; ctx.strokeStyle = pal.rot; ctx.lineWidth = 2.5; const rr0 = [14, 26, 40]; ctx.beginPath(); rr0.forEach(q => { ctx.moveTo(xw + 2 + q, g.cy - Math.min(slotPx / 2, q * 0.9)); ctx.arc(xw + 2, g.cy, q, -0.9, 0.9); }); ctx.stroke(); ctx.restore(); }
        if (res.hasHoles) { ctx.save(); ctx.globalAlpha = res.alphaHoles * 0.8; ctx.strokeStyle = pal.gelb; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(xw + 2, g.yt + g.bh * 0.3, 14, -0.9, 0.9); ctx.stroke(); ctx.restore(); }
        // Elektronik
        const ex = xw + g.bw * 0.34, ey = g.cy - g.bh * 0.22, ew = g.bw * 0.4, eh = g.bh * 0.44;
        ctx.fillStyle = pal.panel; ctx.fillRect(ex, ey, ew, eh); ctx.strokeStyle = pal.senke; ctx.lineWidth = 2; ctx.strokeRect(ex, ey, ew, eh);
        ctx.fillStyle = pal.senke; ctx.globalAlpha = 0.5; ctx.fillRect(ex + ew * 0.25, ey + eh * 0.3, ew * 0.5, eh * 0.4); ctx.globalAlpha = 1;
        gfx.text(ctx, 'Elektronik', ex + ew / 2, ey + eh + 12, { size: fs, color: pal.senke, align: 'center', bg: pal.panel, pad: 2 });
        // Kabel durch die rechte Wand mit Schirmanbindung
        const cy0 = g.cy, cxr = xr, outLen = 56;
        gfx.line(ctx, [[ex + ew, cy0], [cxr + outLen, cy0]], pal.senke, 3);
        ctx.strokeStyle = mat.col; ctx.lineWidth = tPx; ctx.beginPath(); ctx.moveTo(cxr, g.cy - 14 - 10); ctx.lineTo(cxr, g.cy - 14); ctx.moveTo(cxr, g.cy + 14); ctx.lineTo(cxr, g.cy + 14 + 10); ctx.stroke();
        const shieldPath = [];
        if (ctl.kabel === '360') {
          ctx.beginPath(); ctx.rect(cxr - 4, g.cy - 14, 18, 28); ctx.strokeStyle = pal.schirm; ctx.lineWidth = 3; ctx.stroke();
          gfx.text(ctx, '360°', cxr + 5, g.cy - 20, { size: fs, bold: true, color: pal.schirm, align: 'center', bg: pal.panel, pad: 2 });
          shieldPath.push([cxr + outLen, g.cy - 12], [cxr + 6, g.cy - 12], [cxr + 6, g.cy - 2]);
        } else {
          const lpPx = clamp(10 + 56 * (ctl.lp / 0.1), 8, 70), zx = cxr + 12, zy0 = g.cy - 14 - lpPx;
          ctx.strokeStyle = pal.schirm; ctx.lineWidth = 2.5; if (ctx.setLineDash) ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(cxr + outLen, g.cy - 8); ctx.lineTo(cxr + 14, g.cy - 8); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
          const zz = []; for (let i = 0; i <= 8; i++) zz.push([cxr + 14 - (i % 2 ? 6 : 0) + 0 * i, g.cy - 8 - lpPx * i / 8]);
          gfx.line(ctx, zz, pal.rot, 2.5); K.groundMark(ctx, zz[8][0], zz[8][1], pal.rot, 5);
          gfx.text(ctx, 'Pigtail ' + fm(ctl.lp * 1e3, 0) + ' mm', cxr + 24, g.cy - 14 - lpPx * 0.5, { size: fs, bold: true, color: pal.rot, bg: pal.panel, pad: 2, max: Math.max(60, r.x + r.w - cxr - 30) });
          shieldPath.push([cxr + outLen, g.cy - 8], [cxr + 14, g.cy - 8].concat([]), zz[0], zz[8]);
        }
        // Partikel: Schirmstrom (Dichte und Tempo ~ ish)
        const ps = sc.ps('schirm', [{ pts: shieldPath.map(p => [p[0], p[1]]), color: pal.masse, rate: K.rateLog(ctl.ish, 1e-4, 1e-2), dir: -1, size: 3.2 }], { cap: 80, speed: 70 });
        ps.draw(ctx, { reduced: sc.reduced });
        // Messmarken
        const tx = xw + g.bw / 2;
        K.tag(ctx, 'SE gesamt ' + fmSE(res.seGes) + ' dB', tx, g.yt - 11, pal.fg, pal, { align: 'center', size: fs, max: g.bw + 80 });
        K.tag(ctx, (ctl.mat === 'leitlack' ? 'Film: SE ' + fmSE(res.seMat) + ' dB' : 'δ = ' + eng(res.delta, 'm') + ', A = ' + fmSE(res.A) + ' dB'), xw + 4, g.yb + 13, pal.mute, pal, { size: fs, max: g.bw + 60 });
        K.tag(ctx, 'uIn ' + fm(res.uIn, 1) + ' dBµV', ex + ew / 2, ey - 12, pal.senke, pal, { align: 'center', size: fs, max: g.bw });
        if (res.hasSlot) K.tag(ctx, 'Schlitz ' + fm(ctl.slot * 1e3, 0) + ' mm: ' + fm(res.seSlot, 1) + ' dB', xw + 10, g.yt + 18, pal.rot, pal, { size: fs, max: g.bw - 14 });
        if (res.hasHoles) K.tag(ctx, ctl.holes + ' Löcher Ø ' + fm(ctl.dhole * 1e3, 1) + ' mm: ' + fm(res.seHoles, 1) + ' dB', xw + 10, g.yt + (res.hasSlot ? 38 : 18), pal.gelb, pal, { size: fs, max: g.bw - 14 });
        gfx.text(ctx, 'Wand: ' + nm(ctl.mat) + ', t = ' + eng(ctl.t, 'm') + (ctl.mat === 'leitlack' ? ', R□ = ' + eng(ctl.rsq, 'Ω') : ''), r.x + 10, r.y + r.h - 8, { size: fs, color: pal.mute, max: r.w - 20 });
        drawn.rings = rings; drawn.spacing = spacing; drawn.alphaIn = res.alphaIn; drawn.alphaSlot = res.alphaSlot; drawn.alphaOut = aOut; drawn.holes = holeN;
      }

      function barsScene(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Dämpfungsbilanz in dB (A + R + B und Lecks)', { size: fs });
        if (!K.big(r, 200, 120)) return;
        const lx = r.x + 12, lw = r.w - 24, top = r.y + 30, bottom = r.y + r.h - 12;
        const rows = [['Wand A + R + B', res.seMat, 'mat']];
        if (res.hasSlot) rows.push(['Schlitz', res.seSlot, 'slot']);
        if (res.hasHoles) rows.push(['Löcher', res.seHoles, 'holes']);
        rows.push(['gesamt', res.seGes, 'ges']);
        const lab = 112 > lw * 0.4 ? lw * 0.36 : 112, bx = lx + lab, bw = lw - lab - 4;
        const vmax = Math.max(60, Math.ceil(Math.min(160, Math.max(res.seMat, res.seGes, ctl.seReq, res.hasSlot ? res.seSlot : 0, res.hasHoles ? res.seHoles : 0)) / 20) * 20), vx = v => bx + bw * clamp(v, 0, vmax) / vmax;
        const rowH = Math.min(30, (bottom - top - 18) / rows.length), gapY = 6;
        rows.forEach((row, i) => {
          const y = top + i * (rowH + gapY);
          gfx.text(ctx, row[0], lx, y + rowH / 2, { size: fs, color: pal.fg, base: 'middle', max: lab - 6 });
          const weakest = res.nLeak > 1 && row[2] !== 'ges' && Math.abs(row[1] - res.seMin) < 1e-9;
          const ok = row[1] >= ctl.seReq + 6 ? pal.gruen : row[1] >= ctl.seReq ? pal.gelb : pal.rot;
          if (row[2] === 'mat') {
            // A, R, B gestapelt (B negativ: Abzug als Kerbe)
            let x = bx; const A = Math.max(0, res.A), R0 = Math.max(0, res.R), Bn = res.Bm;
            ctx.fillStyle = pal.hfeld; ctx.fillRect(x, y, vx(A) - bx, rowH); x = vx(A);
            ctx.fillStyle = pal.efeld; ctx.fillRect(x, y, vx(A + R0) - vx(A), rowH);
            if (Bn < 0) { const x2 = vx(A + R0), x1 = vx(A + R0 + Bn); ctx.fillStyle = pal.rot; ctx.fillRect(x1, y + rowH - 6, x2 - x1, 6); }
            else if (Bn > 0) { ctx.fillStyle = pal.masse; ctx.fillRect(vx(A + R0), y, vx(A + R0 + Bn) - vx(A + R0), rowH); }
            ctx.strokeStyle = pal.fg; ctx.lineWidth = 1; ctx.strokeRect(bx, y, vx(res.seMat) - bx, rowH);
            gfx.text(ctx, 'A ' + fmSE(res.A) + ' · R ' + fm(res.R, 1) + ' · B ' + fm(res.Bm, 1) + ' = ' + fmSE(res.seMat) + ' dB', bx + 4, y + rowH / 2, { size: fs, bold: true, color: pal.bg, base: 'middle', bg: pal.fg, pad: 2, bgAlpha: 0.78, max: bw - 8 });
          } else {
            ctx.fillStyle = ok; ctx.globalAlpha = 0.9; ctx.fillRect(bx, y, vx(row[1]) - bx, rowH); ctx.globalAlpha = 1;
            if (row[1] < ctl.seReq) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = bx + 4; x < vx(row[1]); x += 7) { ctx.moveTo(x, y + rowH); ctx.lineTo(x + 5, y); } ctx.stroke(); }
            gfx.text(ctx, fmSE(row[1]) + ' dB' + (weakest ? '  ◄ schwächstes Leck' : ''), bx + 4, y + rowH / 2, { size: fs, bold: true, color: pal.fg, base: 'middle', bg: pal.panel, pad: 2, max: bw - 8 });
          }
        });
        // Vorgabe als Linie
        const xr0 = vx(ctl.seReq);
        gfx.line(ctx, [[xr0, top - 4], [xr0, top + rows.length * (rowH + gapY)]], pal.grenz, 2, [6, 4]);
        gfx.text(ctx, 'Vorgabe ' + fm(ctl.seReq, 0) + ' dB', Math.min(xr0 + 4, r.x + r.w - 10), r.y + r.h - 8, { size: fs, color: pal.fg, align: xr0 + 100 > r.x + r.w ? 'right' : 'left', bg: pal.panel, pad: 2 });
      }

      function cabScene(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Kabeldurchführung: Störspannung innen', { size: fs });
        if (!K.big(r, 200, 100)) return;
        const lx = r.x + 14, lw = r.w - 28, y1 = r.y + 50, lo = 0, hi = 120, px = v => lx + lw * clamp((v - lo) / (hi - lo), 0, 1);
        // Skala in dBµV
        gfx.line(ctx, [[lx, y1 + 18], [lx + lw, y1 + 18]], pal.line, 2);
        for (let v = 0; v <= hi; v += 20) { gfx.line(ctx, [[px(v), y1 + 14], [px(v), y1 + 22]], pal.line, 1.5); gfx.text(ctx, fn(v, 0), px(v), y1 + 36, { size: fs, color: pal.mute, align: 'center' }); }
        gfx.text(ctx, 'Pegel in dBµV', lx + lw, y1 + 52, { size: fs, color: pal.mute, align: 'right' });
        // Vorgabe-Bereich (rechts davon zu laut)
        ctx.fillStyle = pal.rot; ctx.globalAlpha = 0.14; ctx.fillRect(px(ctl.uInReq), y1 + 6, lx + lw - px(ctl.uInReq), 24); ctx.globalAlpha = 1;
        gfx.line(ctx, [[px(ctl.uInReq), y1 + 4], [px(ctl.uInReq), y1 + 32]], pal.grenz, 2, [5, 3]);
        gfx.text(ctx, 'Vorgabe ' + fm(ctl.uInReq, 0), px(ctl.uInReq), y1 - 14, { size: fs, color: pal.fg, align: 'center', bg: pal.panel, pad: 2 });
        const col = res.uIn <= ctl.uInReq - 6 ? pal.gruen : res.uIn <= ctl.uInReq ? pal.gelb : pal.rot;
        // 360 Grad als Referenzmarke, aktueller Wert als Marke
        gfx.dot(ctx, px(res.uIn360), y1 + 18, 5, pal.masse);
        gfx.text(ctx, '360°: ' + fm(res.uIn360, 1), px(res.uIn360), y1 + 52 + 0, { size: fs, color: pal.masse, align: res.uIn360 > hi * 0.6 ? 'right' : 'left', bg: pal.panel, pad: 2 });
        ctx.beginPath(); ctx.moveTo(px(res.uIn), y1 + 6); ctx.lineTo(px(res.uIn) - 7, y1 - 6 + 0); ctx.lineTo(px(res.uIn) + 7, y1 - 6); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
        gfx.dot(ctx, px(res.uIn), y1 + 18, 6, col);
        const y2 = y1 + 70;
        gfx.text(ctx, ctl.kabel === '360' ? 'Anbindung: 360° rundum' : 'Anbindung: Pigtail ' + fm(ctl.lp * 1e3, 0) + ' mm', lx, y2, { size: fs, bold: true, color: pal.fg, max: lw });
        gfx.text(ctx, '|Zt| = ' + eng(res.zt, 'Ω') + ' bei ' + eng(ctl.f, 'Hz') + (ctl.kabel === 'pigtail' ? ' (360°: ' + eng(res.zt360, 'Ω') + ')' : ''), lx, y2 + fs + 5, { size: fs, color: pal.fg, max: lw });
        gfx.text(ctx, 'uIn = |Zt| · ish = ' + fm(res.uIn, 1) + ' dBµV bei ish = ' + eng(ctl.ish, 'A'), lx, y2 + 2 * (fs + 5), { size: fs, bold: true, color: col, max: lw });
      }

      function draw(ctx, w, h, t, view, sc) {
        const pal = sc.pal, y0 = K.header(ctx, w, view, sc);
        TOPY.v = y0;
        const L = layoutS(w, h);
        if (!view.res.ok) { gfx.text(ctx, view.res.why || 'Keine Rechnung möglich.', w / 2, y0 + 40, { size: sc.fs + 1, color: pal.rot, align: 'center', max: w - 24 }); K.footer(ctx, w, h, sc); return; }
        if (L) { boxScene(ctx, L.box, view, sc); barsScene(ctx, L.bars, view, sc); cabScene(ctx, L.cab, view, sc); }
        K.footer(ctx, w, h, sc, 'Skizze nicht maßstäblich');
      }
      function hit(x, y, w, h, view) {
        const a = areasS(w, h, view.ctl);
        for (let i = 0; i < a.length; i++) if (K.inRect(x, y, a[i])) return { key: a[i].key, kind: 'select', to: a[i].to };
        return null;
      }
      return {
        compute, meters, assess, curves, draw, hit,
        diag: (res, ctl) => diagS(res, ctl, CORE),
        phaseHz: (res, ctl) => K.phaseHzOf(ctl.f),
        state: res => (res.ok ? { leak: res.leakName, nLeak: res.nLeak, alphaIn: res.alphaIn, alphaSlot: res.alphaSlot, hasSlot: res.hasSlot, hasHoles: res.hasHoles, limit: res.limit, zt: res.zt, zt360: res.zt360 } : { leak: '–' }),
        extend(api) { api.lastScene = () => Object.assign({}, drawn); api.areas = (w, h) => areasS(w, h, api.getControls()); }
      };
    }
    SPEC.plant = plant;
    R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, chain: SPEC.chain, create(opts) { return B.makeRig(SPEC, opts); } });
  })();

})(typeof window !== 'undefined' ? window : globalThis);
