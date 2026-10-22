/* emvrig-antenne.js - EMV-Lab, Pruefstand abstrahlung (Kabel als Antenne: Leitungsmodell, Lambda/4, Ferrit, Schirm) (WP2b).
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
  if (!R.base) { if (typeof console !== 'undefined') console.warn('emvrig-antenne.js: emvrig-base.js (EMV_RIGS.base) fehlt, der Prüfstand wird nicht registriert.'); return; }
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
  //  Pruefstand abstrahlung: Kabel als Antenne (SPEC 5.5). Geraet mit Takt (Oberwellen aus EMV_CORE.spec.lines, A = 3,3 V), der Gleichtaktanteil
  //  treibt das Kabel (Leitungsmodell EMV_CORE.antenna.cableE, SPEC 4.5); Bewertung gegen die Uebungsgrenzlinie (EMV_CORE.assess.radiated).
  // =====================================================================================================================
  (function () {
    const { clamp, fm, fn, eng, okv, gfx, lg, TAU } = K;
    const LV = { q: 'quelle', p: 'pfad', s: 'senke' };
    const G = { q: 'Quelle entschärfen', p: 'Kopplung verringern', s: 'Senke härten', a: 'Anzeige und Vorgaben' };
    // Kabelart (ungeschirmt 0 dB, geschirmt360 -20 dB, geschirmtPigtail -8 dB) und Ferrit (x1 100 Ohm, x2 200 Ohm bei 100 MHz) rechnet der Kern (EMV_CORE.antenna.takt), Uebungswerte (A)
    const TXA = {
      chain: { quelle: 'Taktschaltkreis (Flanken, Oberwellen)', pfad: 'Gleichtaktspannung auf dem Kabel, Kabelresonanz', senke: 'Funkempfang bzw. Messantenne', art: 'gestrahlt', kopplung: ['strahlung'] },
      info: 'Ein Gerät mit Takt hat ein angeschlossenes Kabel. Ein kleiner Anteil der Taktoberwellen liegt als Gleichtaktspannung auf dem Kabel und macht es zur Antenne: bei einem Viertel der Wellenlänge (λ/4) strahlt es besonders gut. Die Wellenringe im Bild sind Symbolik und keine Strahlungskeule. Übungsanlage: Alle Zahlen sind Übungswerte, die Grenzlinie ist eine Übungsgrenzlinie (Herstellerdokumentation und aktuelle Norm maßgeblich).',
      help: {
        fclk: 'Taktfrequenz des Geräts. Die Oberwellen liegen bei ganzzahligen Vielfachen; bei 50 % Tastverhältnis fehlen die geraden. Die Linien zwischen 30 MHz und 1 GHz werden bewertet.',
        tr: 'Anstiegs- und Abfallzeit der Taktflanke (linear von 0 auf 100 %). Langsamere Flanken verringern die Oberwellen oberhalb der Knickfrequenz f2 = 1/(π·tr).',
        kcm: 'Gleichtaktanteil: Verhältnis der Gleichtaktspannung auf dem Kabel zur Taktamplitude. Ein kleinerer Wert (zum Beispiel durch symmetrisches Layout und Filter) bedeutet weniger Störspannung auf dem Kabel.',
        len: 'Länge des angeschlossenen Kabels. Bei einem Viertel der Wellenlänge (und bei ungeraden Vielfachen davon) strahlt das Kabel am stärksten; bei der halben Wellenlänge kaum.',
        kabel: 'Art des Kabels: ungeschirmt, Schirm 360° rundum angebunden (Übungswert −20 dB) oder Schirm als Pigtail angebunden (Übungswert −8 dB). Der Pigtail verschenkt den größten Teil der Schirmwirkung.',
        ferrit: 'Ferrit am Gerät (Ferritperle auf dem Kabel): rein ohmscher Anteil von 100 Ω oder 200 Ω bei 100 MHz, der mit der Wurzel der Frequenz wächst. Er verkleinert den Gleichtaktstrom auf dem Kabel.',
        r: 'Abstand der Messantenne zum Prüfling. Die Grenzlinie wird mit 20·lg(10 m/Abstand) auf den Abstand umgerechnet.',
        klasse: 'Grenzlinie der Klasse A (Industrie) oder B (Wohnbereich), angelehnt an die Fachgrundnormen. Übungsgrenzlinie, Herstellerdokumentation und aktuelle Norm maßgeblich.'
      }
    };
    const sl = (key, label, min, max, value, unit, unitKind, lever, group, help, o) => Object.assign({ key, label, type: 'slider', scale: 'log', min, max, step: min, value, unit, unitKind, lever, group, help }, o || {});
    const controls = [
      { key: 'fclk', label: 'Takt fclk', type: 'select', value: 25e6, options: [8e6, 16e6, 25e6, 50e6, 100e6].map(v => ({ value: v, label: eng(v, 'Hz') })), unit: 'Hz', unitKind: 'freq', lever: LV.q, group: G.q, help: TXA.help.fclk },
      sl('tr', 'Flankenzeit tr', 0.3e-9, 10e-9, 2e-9, 's', 'time', LV.q, G.q, TXA.help.tr),
      { key: 'kcm', label: 'Gleichtaktanteil kcm', type: 'select', value: -70, options: [-80, -70, -60, -50].map(v => ({ value: v, label: (v + ' dB').replace('-', '−') })), unit: 'dB', unitKind: 'db', lever: LV.q, group: G.q, help: TXA.help.kcm },
      sl('len', 'Kabellänge ℓ', 0.1, 5, 1.5, 'm', 'len', LV.p, G.p, TXA.help.len),
      { key: 'kabel', label: 'Kabelart', type: 'select', value: 'ungeschirmt', options: [{ value: 'ungeschirmt', label: 'ungeschirmt' }, { value: 'geschirmt360', label: 'geschirmt, 360° angebunden' }, { value: 'geschirmtPigtail', label: 'geschirmt, Pigtail' }], lever: LV.p, group: G.p, help: TXA.help.kabel },
      { key: 'ferrit', label: 'Ferrit am Gerät', type: 'select', value: 'kein', options: [{ value: 'kein', label: 'kein Ferrit' }, { value: 'x1', label: 'Ferrit 100 Ω bei 100 MHz' }, { value: 'x2', label: 'Ferrit 200 Ω bei 100 MHz' }], lever: LV.p, group: G.p, help: TXA.help.ferrit },
      { key: 'r', label: 'Messabstand', type: 'select', value: 3, options: [{ value: 3, label: '3 m' }, { value: 10, label: '10 m' }], unit: 'm', unitKind: 'len', lever: null, group: G.a, help: TXA.help.r },
      { key: 'klasse', label: 'Grenzlinie (Übung)', type: 'select', value: 'B', options: [{ value: 'A', label: 'Klasse A' }, { value: 'B', label: 'Klasse B' }], lever: null, group: G.a, help: TXA.help.klasse }
    ];
    const meters = [
      { key: 'fRes', label: 'Viertelwellen-Resonanz λ/4', unit: 'MHz', digits: 2, min: 0, max: 1000 },
      { key: 'eMax', label: 'Größte Feldstärke', unit: 'dBµV/m', digits: 1, min: -10, max: 80 },
      { key: 'fMax', label: 'Frequenz der größten Feldstärke', unit: 'MHz', digits: 1, min: 0, max: 1000 },
      { key: 'margin', label: 'Kleinste Marge zur Grenzlinie', unit: 'dB', digits: 1, min: -30, max: 40 },
      { key: 'iCm', label: 'Gleichtaktstrom am Kabelfuß (kritische Linie)', unit: 'µA', digits: 2 }
    ];
    const presets = [
      { id: 'gut', name: 'Gut: Schirm 360° und Ferrit', info: 'Kabel geschirmt (360° angebunden) mit Ferrit am Gerät und kleinem Gleichtaktanteil.', params: { fclk: 25e6, tr: 3e-9, kcm: -80, len: 1.5, kabel: 'geschirmt360', ferrit: 'x2' } },
      { id: 'schlecht', name: 'Schlecht: ungeschirmt', info: 'Ungeschirmtes Kabel (1,5 m) am 25-MHz-Takt mit sehr großem Gleichtaktanteil (−50 dB).', params: { fclk: 25e6, tr: 2e-9, kcm: -50, len: 1.5, kabel: 'ungeschirmt', ferrit: 'kein' } },
      { id: 'resonanz', name: 'Resonanz: Kabel 1,5 m bei 50 MHz', info: 'Kabel von 1,5 m Länge bei 50 MHz Takt: Das Kabel ist bei 50 MHz eine Viertelwellen-Antenne und der Takt trifft die Resonanz.', params: { fclk: 50e6, tr: 2e-9, kcm: -70, len: 1.5, kabel: 'ungeschirmt', ferrit: 'kein' } },
      { id: 'ferrit', name: 'Mit Ferrit am Gerät', info: 'Wie im Standardzustand, aber mit einem Ferrit (200 Ω bei 100 MHz) am Gerät.', params: { fclk: 25e6, tr: 2e-9, kcm: -70, len: 1.5, kabel: 'ungeschirmt', ferrit: 'x2' } },
      { id: 'geschirmt', name: 'Geschirmtes Kabel, 360°', info: 'Wie im Standardzustand, aber mit einem Kabelschirm, der 360° angebunden ist.', params: { fclk: 25e6, tr: 2e-9, kcm: -70, len: 1.5, kabel: 'geschirmt360', ferrit: 'kein' } }
    ];
    const SPEC = { id: 'abstrahlung', name: 'Kabel als Antenne', icon: '📡', info: TXA.info, world: { w: 960, h: 600 }, chain: TXA.chain, controls, noLever: ['r', 'klasse'], meters, presets,
      params: { amp: 3.3, fMin: 30e6, fMax: 1e9 } };

    // ---- Helligkeit der Wellenringe aus der Marge (Symbolik; Test gegen die Kernwerte) ----
    const ringAlpha = margin => { const D = B.getDraw(); return D && D.waveBrightness ? D.waveBrightness(margin) : clamp(0.5 - margin / 40, 0.12, 1); };
    const ringSpacing = lam => { const D = B.getDraw(); return D && D.waveSpacing ? D.waveSpacing(lam) : (isFinite(lam) && lam > 0 ? clamp(10 + 12 * (lg(lam) + 0.5), 10, 60) : 24); };

    // Meldungen: Wortlaut und Bedingungen stehen im Kern (EMV_CORE.diagnose, TEXTS); die Anlage reicht Kabellaenge und Linien weiter.
    function diagA(res, ctl, CORE) {
      if (!res || !res.ok || !res.lines.length) return [];
      try { return CORE.diagnose({ antenna: { len: ctl.len, lines: res.lines } }) || []; } catch (e) { return []; }
    }

    const TOPY = { v: 90 };   // Oberkante des Bildinhalts (nach dem Kopf; 10 ohne Kopf)
    function layoutA(w, h) { return K.split(w, h, TOPY.v, { a: 'scene', b: 'spec', c: 'fac', left: 0.52, rightTop: 0.55, stack: [0.38, 0.32] }); }
    function sceneGeom(r, ctl) {
      const ix = r.x + 10, iy = r.y + 26, iw = r.w - 20, ih = r.h - 26 - 24;
      const g = { ix, iy, iw, ih };
      g.dev = { x: ix + 6, y: iy + ih * 0.52, w: 60, h: 46 };
      g.cx = g.dev.x + g.dev.w; g.cy = g.dev.y + g.dev.h * 0.5;
      const ul = clamp(lg(ctl.len / 0.1) / lg(50), 0, 1);
      g.cabLen = iw * (0.2 + 0.52 * ul); g.x1 = Math.min(g.cx + g.cabLen, ix + iw - 8);
      g.cabLen = g.x1 - g.cx;
      g.gy = iy + ih - 6;                       // Bezugsmasse
      g.cabY = g.cy;
      g.ferr = { x: g.cx + 8, y: g.cy - 11, w: 20, h: 22 };
      g.cab = { x: g.cx, y: g.cy - 12, w: g.cabLen, h: 24 };
      return g;
    }
    function areasA(w, h, ctl) {
      const L = layoutA(w, h); if (!L || !K.big(L.scene, 220, 150)) return [];
      const g = sceneGeom(L.scene, ctl);
      return [{ key: 'ferrit', kind: 'select', to: K.optNext(controls.find(c => c.key === 'ferrit'), ctl.ferrit), x: g.ferr.x - 4, y: g.ferr.y - 6, w: g.ferr.w + 24, h: g.ferr.h + 12 },
        { key: 'kabel', kind: 'select', to: K.optNext(controls.find(c => c.key === 'kabel'), ctl.kabel), x: g.cab.x + 40, y: g.cab.y, w: Math.max(10, g.cab.w - 40), h: g.cab.h }];
    }

    function plant(P0) {
      const CORE = P0.CORE;
      const drawn = { rings: 0, alpha: 0, spacing: 0, color: '', lambda: 0 };
      function limAt(klasse, f, r) { const v = CORE.limits.atDist(klasse === 'A' ? 'str-A-10m' : 'str-B-10m', f, r); return isFinite(v) && v !== null ? v : null; }

      function compute(ctl, par) {
        const em = (CORE.antenna.takt || CORE.antenna.emission)({ fclk: ctl.fclk, tr: ctl.tr, kcm: ctl.kcm, len: ctl.len, kabel: ctl.kabel, ferrit: ctl.ferrit, klasse: ctl.klasse, r: ctl.r, A: par.amp });
        if (!em || em.ok === false) return { ok: false, why: (em && em.why) || 'Die Flanken sind länger als der Impuls oder die Pause: Das Signal ist kein Trapez mehr.' };
        const lines = (em.lines || []).filter(l => isFinite(l.L)).map(l => Object.assign({}, l));
        if (!lines.length) return { ok: false, why: 'Keine Taktlinie zwischen 30 MHz und 1 GHz: Die Grenzlinie wird nicht berührt.' };
        const as = em.assess || {};
        const crit = em.worst || lines[0];
        let emax = lines[0];
        lines.forEach(l => { if (l.L > emax.L) emax = l; });
        const m = isFinite(as.margin) ? as.margin : crit.margin, fq = isFinite(as.freq) ? as.freq : crit.f;
        const res = { ok: true, raw: em, lines, crit, emax, amp: K.ampelKey(as, m), margin: m, freq: fq };
        const rr = CORE.antenna.resonances(ctl.len, 3); res.res = Array.isArray(rr) ? rr : [];
        res.fRes = isFinite(em.fRes) ? em.fRes : (res.res.length ? res.res[0] : NaN);
        res.lam = K.numOf(CORE.antenna.lambda(crit.f), ['lambda', 'lam', 'value']);
        res.iCm = isFinite(em.iCm) ? em.iCm : crit.iFoot;
        res.limit = isFinite(crit.lim) ? crit.lim : limAt(ctl.klasse, crit.f, ctl.r);
        // Abstrahlfaktor des Kabels ueber der Frequenz (100 uV Gleichtaktspannung am Kabelfuss; EMV_CORE.antenna.factor)
        const fl = K.logSpace(par.fMin, par.fMax, 160), fa = CORE.antenna.factor({ len: ctl.len, r: ctl.r, ferrit: ctl.ferrit }, fl);
        res.fac = fa && fa.ok !== false && Array.isArray(fa.f) ? fa.f.map((f, i) => [f, isFinite(fa.L[i]) ? Math.max(-60, fa.L[i]) : -60]) : [];
        // Grenzlinie als Punktefolge (Stufen sauber: je zwei Punkte um die Stufe)
        const lp = [], pf = K.logSpace(par.fMin, par.fMax, 60).concat([2.3e8 * 0.9999, 2.3e8 * 1.0001]).sort((x, y) => x - y);
        pf.forEach(f => { const v = limAt(ctl.klasse, f, ctl.r); if (v !== null && isFinite(v)) lp.push([f, v]); });
        res.limPts = lp;
        return res;
      }
      function meters(res) {
        if (!res.ok) return { fRes: 0, eMax: -60, fMax: 0, margin: 0, iCm: 0 };
        return { fRes: res.fRes / 1e6, eMax: Math.max(-60, res.emax.L), fMax: res.emax.f / 1e6, margin: res.margin, iCm: res.iCm * 1e6 };
      }
      function assess(res, ctl) {
        if (!res.ok) return { ok: false, ampel: 'grau', text: res.why };
        const amp = res.amp, lim = res.limit;
        const verd = amp === 'gruen' ? 'Mit Sicherheitsabstand unter der Übungsgrenzlinie.' : amp === 'gelb' ? 'Knapp unter der Übungsgrenzlinie: im Labor mit Quasi-Spitzenwert nachmessen.' : 'Über der Übungsgrenzlinie.';
        return { ok: res.margin >= 0, ampel: amp, margin: res.margin, freq: res.freq, text: 'Marge ' + fm(res.margin, 1) + ' dB bei ' + eng(res.freq, 'Hz') + ': ' + fm(res.crit.L, 1) + ' dBµV/m gegen ' + fm(lim, 1) + ' dBµV/m (Übungsgrenzlinie Klasse ' + ctl.klasse + ', ' + fm(ctl.r, 0) + ' m). ' + verd };
      }
      function spectrumOf(res, ctl) { return { unit: 'dBµV/m', fMin: SPEC.params.fMin, fMax: SPEC.params.fMax, lines: res.lines.map(l => ({ f: l.f, L: Math.max(-60, l.L) })), limits: [{ id: ctl.klasse === 'A' ? 'str-A-10m' : 'str-B-10m', name: 'Übungsgrenzlinie (A) Klasse ' + ctl.klasse + ' bei ' + fm(ctl.r, 0) + ' m', pts: res.limPts }], floor: -60 }; }
      function spectrum(res, ctl, o) {
        if (!res.ok) return null;
        return { unit: 'dBµV/m', fMin: SPEC.params.fMin, fMax: SPEC.params.fMax, lines: res.lines.map(l => ({ f: l.f, L: l.L })), limits: [{ id: ctl.klasse === 'A' ? 'str-A-10m' : 'str-B-10m', name: 'Übungsgrenzlinie (A) Klasse ' + ctl.klasse + ' bei ' + fm(ctl.r, 0) + ' m', pts: res.limPts }], floor: -60 };
      }
      function curves(res, ctl) {
        if (!res.ok) return [{ id: 'faktor', title: 'Abstrahlfaktor des Kabels', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Feldstärke', yUnit: 'dBµV/m', series: [{ name: 'keine Rechnung', points: [[3e7, 0], [1e9, 0]] }] }];
        const cv1 = { id: 'faktor', title: 'Abstrahlfaktor des Kabels bei 100 µV Gleichtaktspannung', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Feldstärke', yUnit: 'dBµV/m', series: [{ name: 'ℓ = ' + eng(ctl.len, 'm'), points: res.fac }] };
        if (isFinite(res.fRes) && res.fRes >= SPEC.params.fMin && res.fRes <= SPEC.params.fMax) {
          const q = CORE.antenna.factor({ len: ctl.len, r: ctl.r, ferrit: ctl.ferrit }, [res.fRes]); const y = q && q.ok !== false && q.L ? q.L[0] : NaN;
          cv1.marker = { x: res.fRes, y: isFinite(y) ? Math.max(-60, y) : 0, text: 'λ/4 bei ' + eng(res.fRes, 'Hz') };
        }
        cv1.vlines = res.lines.map(l => l.f);
        const cv2 = { id: 'pegel', title: 'Pegel der Taktlinien gegen die Grenzlinie', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Feldstärke', yUnit: 'dBµV/m', series: [{ name: 'Taktlinien', points: res.lines.map(l => [l.f, Math.max(-60, l.L)]) }, { name: 'Übungsgrenzlinie', points: res.limPts }], marker: { x: res.crit.f, y: Math.max(-60, res.crit.L), text: fm(res.margin, 1) + ' dB Marge' } };
        return [cv1, cv2];
      }

      // ---------------- Szene ----------------
      function sceneDraw(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Gerät, Kabel und Strahlung (Skizze, Wellenringe sind Symbolik)', { size: fs });
        if (!K.big(r, 220, 150)) return;
        const g = sceneGeom(r, ctl), ph = view.phase, crit = res.crit;
        const lam = res.lam, over = res.margin < 0, col = over ? pal.rot : pal.gruen, alpha = ringAlpha(res.margin), sp = ringSpacing(lam);
        // Wellenringe (hoechstens 8, Abstand ~ lambda logarithmisch, Helligkeit ~ Pegel zur Grenzlinie; Linienart: rot durchgezogen, gruen gestrichelt)
        ctx.save(); ctx.beginPath(); ctx.rect(r.x + 2, r.y + 22, r.w - 4, r.h - 24); ctx.clip();
        K.glow(ctx, g.dev.x + g.dev.w / 2, g.cy, 70, over ? pal.rot : pal.gruen, 0.28, sc);
        let rings = 0, wv = null;
        if (sc.D && sc.D.waves) { try { wv = sc.D.waves(ctx, g.dev.x + g.dev.w / 2, g.cy, { t: sc.t, lambda: lam, margin: res.margin, rings: 8, maxR: Math.min(g.iw * 0.8, 300), labels: false, quality: sc.quality, reduced: sc.reduced, theme: sc.theme }); } catch (e) { wv = null; } }
        if (wv) rings = wv.rings;
        K.lighter(ctx, sc, !wv);
        for (let k = 0; k < 9 && rings < 8 && !wv; k++) {
          const rad = (k + (sc.reduced ? 0.5 : ph)) * sp; if (rad < 10) continue;
          ctx.globalAlpha = alpha * Math.max(0.12, 1 - rad / (g.iw * 0.75)); ctx.strokeStyle = col; ctx.lineWidth = over ? 2.4 : 1.6;
          if (ctx.setLineDash) ctx.setLineDash(over ? [] : [6, 5]);
          ctx.beginPath(); ctx.arc(g.dev.x + g.dev.w / 2, g.cy, rad, -1.35, 1.35); ctx.stroke(); rings++;
        }
        if (ctx.setLineDash) ctx.setLineDash([]); ctx.globalAlpha = 1; K.lighter(ctx, sc, false); ctx.restore();
        // Bezugsmasse
        ctx.fillStyle = pal.masse; ctx.globalAlpha = 0.8; ctx.fillRect(g.ix, g.gy, g.iw, 6); ctx.globalAlpha = 1;
        gfx.text(ctx, 'Bezugsmasse', g.ix + g.iw - 4, g.gy - 6, { size: fs, color: pal.masse, align: 'right', bg: pal.panel, pad: 2 });
        // Geraet
        ctx.fillStyle = pal.panel2; ctx.fillRect(g.dev.x, g.dev.y, g.dev.w, g.dev.h); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2.5; ctx.strokeRect(g.dev.x, g.dev.y, g.dev.w, g.dev.h);
        gfx.text(ctx, 'Gerät', g.dev.x + g.dev.w / 2, g.dev.y + 17, { size: fs, bold: true, color: pal.quelle, align: 'center' });
        K.sineTrace(ctx, g.dev.x + 8, g.dev.y + 32, g.dev.w - 16, 5, 2, sc.reduced ? 0 : ph, pal.quelle, 1.8);
        gfx.line(ctx, [[g.dev.x + g.dev.w / 2, g.dev.y + g.dev.h], [g.dev.x + g.dev.w / 2, g.gy]], pal.line, 1.5, [3, 3]);
        // Kabel
        const kab = ctl.kabel;
        gfx.line(ctx, [[g.cx, g.cy], [g.x1, g.cy]], pal.fg, 3);
        if (kab !== 'ungeschirmt') {
          ctx.beginPath(); ctx.rect(g.cx + 2, g.cy - 8, g.cabLen - 4, 16); ctx.strokeStyle = pal.schirm; ctx.lineWidth = 3; if (ctx.setLineDash) ctx.setLineDash([6, 4]); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
          if (kab === 'geschirmt360') { ctx.beginPath(); ctx.arc(g.cx, g.cy, 12, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = pal.schirm; ctx.lineWidth = 3; ctx.stroke(); gfx.text(ctx, '360°', g.cx + 14, g.cy + 24, { size: fs, bold: true, color: pal.schirm, bg: pal.panel, pad: 2 }); }
          else { gfx.line(ctx, [[g.cx + 3, g.cy - 8], [g.cx - 6, g.cy - 22], [g.cx - 2, g.cy - 30]], pal.rot, 2.5); gfx.text(ctx, 'Pigtail', g.cx + 4, g.cy - 36, { size: fs, bold: true, color: pal.rot, bg: pal.panel, pad: 2 }); }
        }
        // Ferrit als Zylinder
        if (ctl.ferrit !== 'kein') {
          const n = ctl.ferrit === 'x2' ? 2 : 1;
          for (let i = 0; i < n; i++) { const fx = g.ferr.x + i * 12; ctx.fillStyle = '#4b5563'; ctx.fillRect(fx, g.ferr.y, 10, g.ferr.h); ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.strokeRect(fx, g.ferr.y, 10, g.ferr.h); }
          gfx.text(ctx, 'Ferrit ' + (ctl.ferrit === 'x2' ? '200' : '100') + ' Ω', g.ferr.x + 6, g.cy + 28 + (kab === 'geschirmt360' ? 12 : 0), { size: fs, color: pal.fg, bg: pal.panel, pad: 2 });
        }
        // offenes Kabelende
        gfx.text(ctx, 'offen', g.x1 - 2, g.cy + 22, { size: fs, color: pal.mute, align: 'right', bg: pal.panel, pad: 2 });
        ctx.beginPath(); ctx.arc(g.x1, g.cy, 4, 0, TAU); ctx.fillStyle = pal.bg; ctx.fill(); ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.stroke();
        // Stehwellenprofil I(z) der kritischen Linie (Amplitude aus dem Kern: Fussstrom), Form sin(beta (l - z)) / Maximum
        const bz = TAU / lam, n = 120, prof = [], top = g.cy - 34, ampPx = Math.min(g.ih * 0.26, 62);
        let imax = 0; for (let i = 0; i <= n; i++) { const z = ctl.len * i / n; imax = Math.max(imax, Math.abs(Math.sin(bz * (ctl.len - z)))); }
        const env = [], inst = [], cosp = sc.reduced ? 1 : Math.cos(TAU * ph);
        for (let i = 0; i <= n; i++) { const z = ctl.len * i / n, v = Math.sin(bz * (ctl.len - z)) / (imax || 1), x = g.cx + g.cabLen * i / n; env.push([x, top - ampPx * Math.abs(v)]); inst.push([x, top - ampPx * v * cosp]); }
        ctx.beginPath(); ctx.moveTo(g.cx, top); env.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(g.x1, top); ctx.closePath(); ctx.fillStyle = pal.hfeld; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
        gfx.line(ctx, [[g.cx, top], [g.x1, top]], pal.line, 1);
        gfx.line(ctx, inst, pal.hfeld, 2.2);
        gfx.text(ctx, 'I(z) bei ' + eng(crit.f, 'Hz') + ', Fuß ' + eng(res.iCm, 'A'), g.cx + 4, top - ampPx - 8, { size: fs, bold: true, color: pal.hfeld, bg: pal.panel, pad: 2, max: g.cabLen + 100 });
        // lambda/4-Marke (an der kritischen Linie) und Resonanz des Kabels
        const q4 = lam / 4, q4px = g.cabLen * Math.min(1, q4 / ctl.len), yy = g.cy + 40 + (kab === 'geschirmt360' ? 6 : 0);
        gfx.arrow(ctx, g.cx, yy, g.cx + q4px, yy, pal.fg, 1.6, 5); gfx.arrow(ctx, g.cx + q4px, yy, g.cx, yy, pal.fg, 1.6, 5);
        gfx.text(ctx, 'λ/4 = ' + eng(q4, 'm') + (q4 > ctl.len ? ' (länger als das Kabel)' : '') + ' bei ' + eng(crit.f, 'Hz'), g.cx + q4px / 2, yy + 14, { size: fs, color: pal.fg, align: q4px < 140 ? 'left' : 'center', bg: pal.panel, pad: 2, max: g.iw - 20 });
        // Messantenne
        const ax = g.ix + g.iw - 14, ay = g.gy - 52;
        gfx.line(ctx, [[ax, ay + 14], [ax, ay - 4]], pal.fg, 2); gfx.line(ctx, [[ax - 8, ay - 4], [ax, ay + 6], [ax + 8, ay - 4]], pal.fg, 2);
        gfx.text(ctx, 'Messantenne ' + fm(ctl.r, 0) + ' m', ax - 12, ay + 4, { size: fs, color: pal.fg, align: 'right', bg: pal.panel, pad: 2, max: g.iw * 0.45 });
        gfx.text(ctx, (over ? '✗ ' : '✓ ') + 'Marge ' + fm(res.margin, 1) + ' dB bei ' + eng(crit.f, 'Hz') + ': ' + fm(crit.L, 1) + ' gegen ' + fm(res.limit, 1) + ' dBµV/m', r.x + 10, r.y + r.h - 8, { size: fs, bold: true, color: over ? pal.rot : pal.gruen, max: r.w - 20 });
        drawn.rings = rings; drawn.alpha = wv ? wv.brightness : alpha; drawn.spacing = wv ? wv.spacing : sp; drawn.color = wv ? (wv.color === pal.rot ? 'rot' : 'gruen') : (over ? 'rot' : 'gruen'); drawn.lambda = lam; drawn.viaDraw = !!wv;
      }

      function specDraw(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view;
        if (!K.big(r, 200, 120)) return;
        if (sc.D && sc.D.spectrumBars) {
          const anim = sc.tw.dspec || (sc.tw.dspec = sc.D.spectrumState());
          let ok = false; try { ok = !!sc.D.spectrumBars(ctx, r, spectrumOf(res, ctl), { t: sc.t, anim, marker: res.crit.f, quality: sc.quality, reduced: sc.reduced, theme: sc.theme }); } catch (e) { ok = false; }
          if (ok) return;
        }
        const lines = res.lines.map(l => ({ f: l.f, L: l.L }));
        let ymax = 60; lines.forEach(l => { ymax = Math.max(ymax, Math.ceil((l.L + 6) / 10) * 10); }); ymax = Math.min(ymax, 120);
        const limFn = f => limAt(ctl.klasse, f, ctl.r);
        const tw = sc.tw.spec || (sc.tw.spec = {});
        const d = { lines, key: 'ab|' + ctl.fclk + '|' + ctl.tr + '|' + ctl.kcm + '|' + ctl.len + '|' + ctl.kabel + '|' + ctl.ferrit + '|' + ctl.r, fMin: SPEC.params.fMin, fMax: SPEC.params.fMax, yMin: 0, yMax: ymax, unit: 'dBµV/m',
          lim: [{ name: 'Übungsgrenzlinie (A) Klasse ' + ctl.klasse + ', ' + fm(ctl.r, 0) + ' m', pts: res.limPts }], avLim: limFn, qpLim: limFn,
          marker: { f: res.crit.f, L: Math.max(0, res.crit.L), text: fm(res.crit.L, 1) + ' dBµV/m, Marge ' + fm(res.margin, 1) + ' dB' } };
        gfx.spectrumBars(ctx, r.x, r.y, r.w, r.h, d, { pal, t: sc.t, reduced: sc.reduced, tw, size: sc.fs + 1 });
      }
      let cvRes = null, cvList = null;
      function facDraw(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view;
        if (!K.big(r, 200, 120)) return;
        if (cvRes !== res) { cvRes = res; cvList = curves(res, ctl); }
        if (sc.D && sc.D.curveChart) {
          const c1 = cvList[0]; let ok = false;
          try { ok = !!sc.D.curveChart(ctx, r, c1, { markers: c1.marker ? [{ x: c1.marker.x, y: c1.marker.y, label: c1.marker.text }] : [], quality: sc.quality, theme: sc.theme }); } catch (e) { ok = false; }
          if (ok) return;
        }
        // Die Basis-Zeichnung lehnt Zahlen ab 1e7 ab (Schutz): Frequenzachse daher in MHz
        const c0 = curves(res, ctl)[0], mhz = pts => pts.map(p => [p[0] / 1e6, p[1]]);
        const cv = Object.assign({}, c0, { xUnit: 'MHz', series: c0.series.map(q => Object.assign({}, q, { points: mhz(q.points) })), marker: c0.marker ? Object.assign({}, c0.marker, { x: c0.marker.x / 1e6 }) : undefined });
        gfx.curveChart(ctx, r.x, r.y, r.w, r.h, cv, { pal, size: sc.fs + 1, markers: cv.marker ? [cv.marker] : [], yMin: Math.min(0, Math.floor(Math.min.apply(null, cv.series[0].points.map(p => p[1])) / 10) * 10) });
      }
      function draw(ctx, w, h, t, view, sc) {
        const pal = sc.pal, y0 = K.header(ctx, w, view, sc);
        TOPY.v = y0;
        const L = layoutA(w, h);
        if (!view.res.ok) { gfx.text(ctx, view.res.why || 'Keine Rechnung möglich.', w / 2, y0 + 40, { size: sc.fs + 1, color: pal.rot, align: 'center', max: w - 24 }); K.footer(ctx, w, h, sc); return; }
        if (L) { sceneDraw(ctx, L.scene, view, sc); specDraw(ctx, L.spec, view, sc); facDraw(ctx, L.fac, view, sc); }
        K.footer(ctx, w, h, sc, 'Wellenringe sind Symbolik');
      }
      function hit(x, y, w, h, view) {
        const a = areasA(w, h, view.ctl);
        for (let i = 0; i < a.length; i++) if (K.inRect(x, y, a[i])) return { key: a[i].key, kind: 'select', to: a[i].to };
        return null;
      }
      return {
        compute, meters, assess, curves, spectrum, draw, hit,
        diag: (res, ctl) => diagA(res, ctl, CORE),
        phaseHz: (res, ctl) => K.phaseHzOf(res && res.ok ? res.crit.f : 1e8),
        state: res => (res.ok ? { fCrit: res.crit.f, lCrit: res.crit.L, ringAlpha: ringAlpha(res.margin), ringSpacing: ringSpacing(res.lam), ringColor: res.margin < 0 ? 'rot' : 'gruen', fRes: res.fRes, nLines: res.lines.length } : { fCrit: 0 }),
        extend(api) { api.lastScene = () => Object.assign({}, drawn); api.areas = (w, h) => areasA(w, h, api.getControls()); api.lines = () => { const r = api._view().res; return r && r.ok ? r.lines.map(l => Object.assign({}, l)) : []; }; }
      };
    }
    SPEC.plant = plant;
    R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, chain: SPEC.chain, create(opts) { return B.makeRig(SPEC, opts); } });
  })();

})(typeof window !== 'undefined' ? window : globalThis);
