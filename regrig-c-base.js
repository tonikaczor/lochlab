/* regrig-c-base.js - Regelungstechnik-Lab, gemeinsame Basis der Pruefstaende drehzahl und position (WP2c, ausgelagert in Schlank Stufe 2).
 * Erzeugt aus quelle/reglab/regrig_c_base.part.js (node quelle/reglab/build_regrig_c.js); nicht von Hand aendern. Strecke, Messglied, Spur, Diagnose und Zeitablauf
 * (buildRig); sie liegen als REG_RIGS.cbase bereit. Im Browser VOR regrig-drehz.js und regrig-pos.js laden (in Node holen die beiden sie per require).
 * Abhaengigkeit: REG_CORE (regcore.js: controller, rng, oscillation, TEXTS; freq/margins/identify nur fuer analysis und Diagnose).
 * Einheiten: Regler in Prozent des Messbereichs, Anzeige und Steuerwerte physikalisch, Zeiten in Prozess-Sekunden (timeScale 1).
 * Deterministisch (Rauschen nur ueber REG_CORE.rng, Seed 1); step, stepProcess und setControl werfen nie. Mit Node ladbar (module.exports = REG_RIGS).
 */
(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Gemeinsame Basis der Pruefstaende Gruppe C (drehzahl, position) =====
  // Quelle: quelle/reglab/regrig_c_base.part.js; beide Dateien regrig-drehz.js und regrig-pos.js enthalten diesen Block unveraendert
  // (build_regrig_c.js setzt ihn zusammen), damit jede Datei einzeln ladbar bleibt.
  // Der Kern (REG_CORE, regcore.js) liefert den Regler (controller) und den Zufall (rng). Alles andere (Strecke, Messglied, Spur,
  // Diagnose, Zeitablauf) rechnet dieser Block. Reihenfolge je Kernschritt nach SPEC 4.5: Sollwertrampe, Messglied (aus x des Vorschritts),
  // Reglerschritt, Hand/Automatik, Strecke, Spur, Diagnose (alle 50 Schritte).
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5', steel: '#9aa7b4', steel2: '#6b7886' };
  const TWO_PI = Math.PI * 2;
  const DIAG_EVERY = 50;          // Kernschritte zwischen zwei Diagnosen (SPEC 4.5, Punkt 7)
  const TR_CAP = 6000;            // Spurspeicher (Punkte)
  const DIAG_ORDER = ['wirk', 'dauer', 'auf', 'grenz', 'windup', 'stromgrenze', 'anschlag', 'unreach', 'sat-hoch', 'sat-tief', 'ebl', 'd-rausch', 'abtast', 'totzeit', 'freilauf', 'hand'];
  const ALL_CTRL = ['P', 'I', 'PI', 'PD', 'PID', '2P', '3P'];
  const OSC_CLS = ['aperiodisch', 'gedaempft', 'dauerschwingung', 'aufschaukelnd'];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fin = v => typeof v === 'number' && isFinite(v);
  const fm = (v, d) => fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–';
  // Zeit mit Einheit: unter 1 s in ms, sonst in s (Prozesszeit; timeScale = 1)
  const fmT = s => !fin(s) ? '–' : Math.abs(s) < 1 ? fm(s * 1000, Math.abs(s) * 1000 < 10 ? 1 : 0) + ' ms' : fm(s, Math.abs(s) < 10 ? 2 : 1) + ' s';
  const hasI = t => t === 'I' || t === 'PI' || t === 'PID';
  const hasD = t => t === 'PD' || t === 'PID';
  const core = () => {
    const c = root.REG_CORE || (typeof require === 'function' ? require('./regcore.js') : null);
    if (!c || typeof c.controller !== 'function' || typeof c.rng !== 'function') throw new Error('REG_CORE (regcore.js) mit controller() und rng() ist nicht geladen');
    return c;
  };

  // Steuerelement-Kurzformen (gemeinsames Bedienpult, SPEC 4.7)
  function sel(key, label, value, options, group, help, extra) { return Object.assign({ key, label, type: 'select', value, options, group, help }, extra || {}); }
  function sld(key, label, min, max, step, unit, value, group, help, extra) { return Object.assign({ key, label, type: 'slider', min, max, step, unit, value, group, help }, extra || {}); }

  // ---- Schwingungsklasse (SPEC 4.6): Kern, wenn vorhanden und plausibel, sonst gleichwertige lokale Rechnung ----
  function oscLocal(t, x) {
    const res = { cls: 'aperiodisch', period: null, amp: 0, ratio: null, limited: false };
    const n = x.length; if (n < 8) return res;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { if (x[i] < mn) mn = x[i]; if (x[i] > mx) mx = x[i]; }
    const delta = Math.max(0.5, 0.02 * (mx - mn));                    // 0,5 % des Bereichs bzw. 2 % der Spannweite
    const ex = []; let mode = 0, hiV = x[0], hiI = 0, loV = x[0], loI = 0;
    for (let i = 1; i < n; i++) {
      const v = x[i];
      if (mode === 0) {
        if (v > loV + delta) { ex.push({ i: loI, v: loV }); mode = 1; hiV = v; hiI = i; }
        else if (v < hiV - delta) { ex.push({ i: hiI, v: hiV }); mode = -1; loV = v; loI = i; }
        else { if (v > hiV) { hiV = v; hiI = i; } if (v < loV) { loV = v; loI = i; } }
      } else if (mode === 1) {
        if (v > hiV) { hiV = v; hiI = i; } else if (v < hiV - delta) { ex.push({ i: hiI, v: hiV }); mode = -1; loV = v; loI = i; }
      } else {
        if (v < loV) { loV = v; loI = i; } else if (v > loV + delta) { ex.push({ i: loI, v: loV }); mode = 1; hiV = v; hiI = i; }
      }
    }
    ex.shift();                                                          // das erste Extremum ist nur der Fensteranfang, kein echter Wendepunkt
    const m = ex.length; if (m < 3) return res;
    const tail = ex.slice(Math.max(0, m - 7)), k = tail.length, amps = [];
    for (let j = 1; j < k; j++) amps.push(Math.abs(tail[j].v - tail[j - 1].v));
    // erste und letzte Amplitude je ueber eine volle Periode (zwei Halbschwingungen) gemittelt: unregelmaessige Grenzzyklen (Haftreibung) bleiben stabil eingestuft
    const na = amps.length, aFirst = na >= 4 ? (amps[0] + amps[1]) / 2 : amps[0], aLast = na >= 4 ? (amps[na - 1] + amps[na - 2]) / 2 : amps[na - 1];
    const r = aLast / aFirst;
    res.ratio = r; res.amp = amps.reduce((a, b) => a + b, 0) / na;
    res.period = 2 * (t[tail[k - 1].i] - t[tail[0].i]) / (k - 1);
    if (k >= 5) res.cls = r < 0.8 ? 'gedaempft' : r <= 1.25 ? 'dauerschwingung' : 'aufschaukelnd';
    else res.cls = r < 0.8 ? 'gedaempft' : 'aperiodisch';
    if (t[n - 1] - t[tail[k - 1].i] > res.period) res.cls = 'aperiodisch';      // letztes Extremum liegt laenger als eine Periode zurueck: die Schwingung ist vorbei
    return res;
  }
  function oscClassify(C0, t, x, noise) {
    let r = null;
    if (typeof C0.oscillation === 'function') {
      try { const q = C0.oscillation(t, x, { range: 100, noise: noise }); if (q && OSC_CLS.indexOf(q.cls) >= 0) r = { cls: q.cls, period: fin(q.period) ? q.period : null, amp: fin(q.amp) ? q.amp : 0, ratio: fin(q.ratio) ? q.ratio : null, limited: false }; } catch (e) { r = null; }
    }
    return r || oscLocal(t, x);
  }

  // ---- Zeichenhilfen ----
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(s), x, y);
  }
  // Zeigerinstrument: Bogen 225 Grad, Marke fuer den Sollwert, Warnbereich ab warnFrom
  function dial(ctx, cx, cy, r, v, lo, hi, o) {
    o = o || {};
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, f = x => a0 + (a1 - a0) * clamp((x - lo) / (hi - lo || 1), 0, 1);
    ctx.save();
    ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 7; ctx.lineCap = 'butt';
    ctx.strokeStyle = C.panel2; ctx.beginPath(); ctx.arc(cx, cy, r - 6, a0, a1); ctx.stroke();
    if (o.warnFrom != null) { ctx.strokeStyle = C.bad; ctx.beginPath(); ctx.arc(cx, cy, r - 6, f(o.warnFrom), a1); ctx.stroke(); }
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10, c = Math.cos(a), s = Math.sin(a); ctx.beginPath(); ctx.moveTo(cx + c * (r - 2), cy + s * (r - 2)); ctx.lineTo(cx + c * (r - (i % 5 ? 9 : 14)), cy + s * (r - (i % 5 ? 9 : 14))); ctx.stroke(); }
    if (o.set != null) { const a = f(o.set), c = Math.cos(a), s = Math.sin(a); ctx.fillStyle = C.warn; ctx.beginPath(); ctx.moveTo(cx + c * (r + 7), cy + s * (r + 7)); ctx.lineTo(cx + c * (r - 4) - s * 5, cy + s * (r - 4) + c * 5); ctx.lineTo(cx + c * (r - 4) + s * 5, cy + s * (r - 4) - c * 5); ctx.closePath(); ctx.fill(); }
    const a = f(v); ctx.strokeStyle = C.text; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12)); ctx.stroke();
    ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TWO_PI); ctx.fill();
    txt(ctx, o.label || '', cx, cy + r * 0.45, 13, C.dim, 'center');
    txt(ctx, o.text || '', cx, cy + r * 0.72, 16, o.bad ? C.bad : C.text, 'center', true, MONO);
    ctx.restore();
  }
  function sparks(ctx, x, y, t, n, col) {
    ctx.save(); ctx.strokeStyle = col || C.warn; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TWO_PI + Math.sin(t / 90 + i * 2.1) * 0.7, l = 8 + 14 * Math.abs(Math.sin(t / 60 + i * 1.7));
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.lineTo(x + Math.cos(a) * (6 + l), y + Math.sin(a) * (6 + l)); ctx.stroke();
    }
    ctx.restore();
  }
  // Modell-Sprungantwort aus der Blockliste (K, PT1, I, Tt): Einheitssprung am Eingang, exakte PT1-Schritte; nur fuer die Kennlinienanzeige
  function simLin(blocks, tEnd, nPts) {
    const n = Math.max(20, nPts | 0), sub = 4, dt = tEnd / (n * sub), pts = [];
    const st = blocks.map(() => 0), buf = blocks.map(b => b.t === 'Tt' ? new Float64Array(Math.max(0, Math.round(b.Tt / dt))) : null), bi = blocks.map(() => 0);
    for (let k = 0; k <= n * sub; k++) {
      let u = 1;
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j];
        if (b.t === 'K') u *= b.K;
        else if (b.t === 'PT1') { st[j] += (1 - Math.exp(-dt / b.T)) * (u - st[j]); u = st[j]; }
        else if (b.t === 'I') { st[j] += b.Ki * dt * u; u = st[j]; }
        else if (b.t === 'Tt') { const B = buf[j]; if (B.length) { const o = B[bi[j]]; B[bi[j]] = u; bi[j] = (bi[j] + 1) % B.length; u = o; } }
      }
      if (k % sub === 0) pts.push([k * dt, u]);
    }
    return pts;
  }
  // Meldungstexte: Es gilt REG_CORE.TEXTS (eine Quelle, SPEC 9 lab-spezifisch a). Die Kopie hier greift nur, wenn der Kern die Vorlage nicht kennt.
  const DIAG_FALLBACK = {
    'sat-hoch': 'Die Stellgröße steht am oberen Anschlag ({x} %). Mehr kann das Stellglied nicht liefern; der Regler kann den Sollwert nicht schneller erreichen.',
    'sat-tief': 'Die Stellgröße steht am unteren Anschlag (0 %). Der Regler kann nicht weniger stellen.',
    'windup': 'Der I-Anteil ist weggelaufen (Windup): {x} % über dem Stellbereich. Das gibt später ein großes Überschwingen. Schalte Anti-Windup ein (klemmen oder rueck).',
    'dauer': 'Der Regelkreis schwingt dauernd, Periode etwa T = {T}. Die Kreisverstärkung ist zu groß. Verkleinere Kp{Tn}.',
    'auf': 'Die Schwingung wird immer größer: Der Kreis ist instabil. Verkleinere Kp deutlich.',
    'd-rausch': 'Der D-Anteil verstärkt das Messrauschen: Die Stellgröße zittert (σ = {x} %). Verkleinere Tv oder das Rauschen.',
    'wirk': 'Der Regler wirkt in die falsche Richtung (Wirkungssinn): Hier muss er {dir} wirken.',
    'totzeit': 'Die Totzeit ist groß gegen die Zeitkonstante (Tt/T = {x}). Stelle den Regler langsam ein; ein D-Anteil hilft hier kaum.',
    'abtast': 'Die Abtastzeit Ta = {Ta} kostet etwa {x}° Phasenreserve. Wähle Ta kleiner oder Kp kleiner.',
    'hand': 'Handbetrieb: Der Regler ist abgeschaltet und folgt nur. Beim Umschalten auf Automatik springt die Stellgröße nicht (stoßfrei).',
    'grenz': 'Grenzzyklus: Haftreibung oder Lose und der I-Anteil lassen die Achse um den Sollwert pendeln. Verkleinere den I-Anteil oder nimm PD.'
  };
  function tx(id, vars) {
    vars = vars || {};
    try { const T = (root.REG_CORE || {}).TEXTS; if (T && typeof T.get === 'function') { const r = T.get(id, vars); if (r && !/\{\w+\}/.test(r)) return r; } } catch (e) { /* Kopie nehmen */ }
    return String(DIAG_FALLBACK[id] || id).replace(/\{(\w+)\}/g, (m, k) => vars[k] === undefined ? m : String(vars[k]));
  }
  // Weltkoordinaten (1000 x 560) auf die Zeichenflaeche abbilden; hitTest nutzt dieselbe Abbildung
  function fitOf(w, h) { const s = Math.min(w / WW, h / WH); return { s, ox: (w - WW * s) / 2, oy: (h - WH * s) / 2 }; }

  // ======================================================================================
  // Pruefstand bauen. cfg liefert Anlagenkonstanten, Bedienpult, Messgeraete und die Strecke (makePlant);
  // der Block rechnet Regler, Messglied, Spur, Diagnose und Zeitablauf.
  // ======================================================================================
  function buildRig(cfg, opts) {
    opts = opts || {};
    const C0 = core();
    const h = cfg.h, RG = cfg.range, SPAN = RG.hi - RG.lo;
    const P = Object.assign({}, cfg.params, opts.params || {});
    const SEED = opts.seed !== undefined && isFinite(+opts.seed) && +opts.seed !== 0 ? +opts.seed : 1;      // Rauschen: Seed 1, runSeq darf einen anderen vorgeben
    const defs = cfg.controls.map(d => Object.assign({}, d, d.options ? { options: d.options.map(o => Object.assign({}, o)) } : {}));
    const defOf = {}, Cv = {};
    defs.forEach(c => { defOf[c.key] = c; Cv[c.key] = c.value; });
    const events = [];
    const plant = cfg.makePlant(P, h, Cv);
    const toPct = v => 100 * (v - RG.lo) / SPAN, toPhys = p => RG.lo + p * SPAN / 100;
    const extraTr = cfg.extraTrace || [];
    const TR = { t: new Float64Array(TR_CAP), w: new Float64Array(TR_CAP), x: new Float64Array(TR_CAP), y: new Float64Array(TR_CAP), z: new Float64Array(TR_CAP), e: new Float64Array(TR_CAP), extra: {} };
    extraTr.forEach(q => { TR.extra[q.key] = new Float64Array(TR_CAP); });
    let trN = 0;
    let S, rng, ctrl, goodSpec = null;
    const yRing = new Float64Array(40);

    const dirS = () => Cv.dir === 'invers' ? -1 : 1;
    function limits() { S.ymax = Cv.ymax; S.ymin = cfg.symmetric ? 100 - Cv.ymax : 0; }
    function specNow() {
      return { type: Cv.ctrl, Kp: Cv.kp, Tn: Cv.tn, Tv: hasD(Cv.ctrl) ? Cv.tv : 0, N: 10, Ta: Cv.ta, u0: Cv.u0, ymin: cfg.symmetric ? 100 - Cv.ymax : 0, ymax: Cv.ymax, aw: Cv.aw, Tr: null, dOn: 'x', dir: Cv.dir };
    }
    function ev(text, kind, fx, id) {
      const e = { t: S ? S.t : 0, text, kind: kind || 'info' };
      if (fx) e.fx = fx; if (id) e.id = id;
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    // Regler aufbauen; ungueltige Parameter: letzter gueltiger Wert bleibt (SPEC 4.4)
    function mkCtl(keepY) {
      const spec = specNow();
      const r = C0.controller(spec, h);
      if (!r || r.ok === false) {
        ev((r && r.why ? r.why : 'Reglerparameter ungültig.') + ' (letzter Wert bleibt)', 'warn');
        if (goodSpec) { Cv.kp = goodSpec.Kp; Cv.tn = goodSpec.Tn; Cv.tv = goodSpec.Tv; Cv.ta = goodSpec.Ta; Cv.u0 = goodSpec.u0; Cv.aw = goodSpec.aw; Cv.dir = goodSpec.dir; Cv.ctrl = goodSpec.type; Cv.ymax = goodSpec.ymax; limits(); }
        return false;
      }
      goodSpec = spec; ctrl = r; S.nTa = Math.max(1, Math.round(Cv.ta / h));
      if (keepY && S && S.k > 0) ctrl.bumpless(S.y, S.ws, S.xm);            // Reglerwechsel waehrend des Laufs: Stellgroesse springt nicht (vor dem ersten Schritt: frischer Regler)
      return true;
    }
    function applyCtl(key) {
      limits();
      const spec = specNow();
      if (key === 'ctrl' || key === 'ta' || key === 'dir' || typeof ctrl.setParams !== 'function') { mkCtl(true); return; }
      let ok = true;
      try { const r = ctrl.setParams(spec); ok = !(r === false || (r && r.ok === false)); } catch (e) { ok = false; }
      if (ok) { goodSpec = spec; S.nTa = Math.max(1, Math.round(Cv.ta / h)); } else mkCtl(true);
    }
    function initState() {
      rng = C0.rng(SEED);
      plant.reset();
      S = { k: 0, t: 0, acc: 0, wPct: toPct(Cv.w), ws: toPct(Cv.w), rampPct: Cv.wRamp * 100 / SPAN, sigma: Cv.noise, xTrue: plant.xPct(), xf: 0, xm: 0, y: 0, hand: Cv.mode === 'hand', yHandExpl: false,
        ymin: 0, ymax: 100, nTa: 1, tChange: 0, hold: {}, dg: {}, now: [], osc: { cls: 'aperiodisch', period: null, amp: 0, ratio: null, limited: false }, yrN: 0, throttled: false, divergence: false,
        abtastKey: '', abtastVal: null };
      S.xf = S.xTrue; S.xm = S.xTrue;
      const Ts = P.sensorTau; S.cS = Ts > 0 ? 1 - Math.exp(-h / Ts) : 1;
      limits();
      events.length = 0; trN = 0; yRing.fill(0);
      mkCtl(false);
      S.y = clamp(Cv.mode === 'hand' ? Cv.yHand : (ctrl.state && fin(ctrl.state().y) ? ctrl.state().y : 0), S.ymin, S.ymax);
      if (S.hand) ctrl.bumpless(S.y, S.ws, S.xm);
    }

    // ---- ein Kernschritt (SPEC 4.5) ----
    function coreStep() {
      if (S.rampPct > 0) { const d = S.wPct - S.ws, m = S.rampPct * h; S.ws += d > m ? m : d < -m ? -m : d; } else S.ws = S.wPct;
      S.xf += S.cS * (S.xTrue - S.xf);
      S.xm = S.sigma > 0 ? S.xf + S.sigma * rng.normal() : S.xf;
      let y;
      if (S.hand) { y = Cv.yHand; ctrl.bumpless(clamp(y, S.ymin, S.ymax), S.ws, S.xm); }
      else y = ctrl.step(S.ws, S.xm);
      if (!(y >= -1e6 && y <= 1e6)) {                                       // NaN oder Unsinn aus dem Regler: nie weiterreichen
        if (!S.divergence) { S.divergence = true; ev('Der Regelkreis ist instabil', 'error'); }
        y = S.ymin;
      }
      y = y < S.ymin ? S.ymin : y > S.ymax ? S.ymax : y;
      S.y = y;
      plant.step(y, Cv.z);
      S.xTrue = plant.xPct();
      if (!fin(S.xTrue)) { S.xTrue = 0; if (!S.divergence) { S.divergence = true; ev('Der Regelkreis ist instabil', 'error'); } }
      S.k++; S.t = S.k * h;
      if (S.k % S.nTa === 0) { yRing[S.yrN % 40] = y; S.yrN++; }
      if (S.k % cfg.trEvery === 0) pushTrace();
      if (S.k % DIAG_EVERY === 0) { evalOsc(); evalDiag(DIAG_EVERY * h); }
    }
    function pushTrace() {
      const i = trN % TR_CAP, wp = toPhys(S.ws), xp = toPhys(S.xTrue);
      TR.t[i] = S.t; TR.w[i] = wp; TR.x[i] = xp; TR.y[i] = S.y; TR.z[i] = Cv.z; TR.e[i] = dirS() * (wp - xp);
      for (let q = 0; q < extraTr.length; q++) TR.extra[extraTr[q].key][i] = extraTr[q].fn(S, plant);
      trN++;
    }
    // letzte sec Sekunden der Spur als Indexliste (aelteste zuerst)
    function recentIdx(sec) {
      const out = [], n = Math.min(trN, TR_CAP), t1 = S.t - sec;
      for (let j = 0; j < n; j++) { const i = (trN - 1 - j) % TR_CAP; if (TR.t[i] < t1 - 1e-12) break; out.push(i); }
      return out.reverse();
    }
    function evalOsc() {
      const idx = recentIdx(cfg.oscWin);
      if (idx.length < 8) { S.osc = { cls: 'aperiodisch', period: null, amp: 0, ratio: null, limited: false }; return; }
      const t = new Array(idx.length), x = new Array(idx.length); let lim = 0;
      for (let j = 0; j < idx.length; j++) { const i = idx[j]; t[j] = TR.t[i]; x[j] = toPct(TR.x[i]); if (TR.y[i] >= S.ymax - 0.5 || TR.y[i] <= S.ymin + 0.5) lim++; }
      const r = oscClassify(C0, t, x, Cv.noise); r.limited = lim >= 0.03 * idx.length; S.osc = r;
    }
    function winStat(sec) {                                                  // Streubreite von x (in %) ueber die letzten sec Sekunden
      const idx = recentIdx(sec); if (!idx.length) return { n: 0, range: 0 };
      let mn = Infinity, mx = -Infinity;
      for (let j = 0; j < idx.length; j++) { const v = toPct(TR.x[idx[j]]); if (v < mn) mn = v; if (v > mx) mx = v; }
      return { n: idx.length, range: mx - mn, span: idx.length ? S.t - TR.t[idx[0]] : 0 };
    }
    function yJitter() {                                                     // Zittern der Stellgroesse: robuste Streuung der zweiten Differenzen
      if (S.yrN < 24) return 0;
      const n = Math.min(S.yrN, 40), seq = [];
      for (let j = 0; j < n; j++) seq.push(yRing[(S.yrN - n + j) % 40]);
      const d = []; for (let j = 2; j < n; j++) d.push(Math.abs(seq[j] - 2 * seq[j - 1] + seq[j - 2]));
      d.sort((a, b) => a - b); const med = d[d.length >> 1];
      return med / (0.6745 * Math.sqrt(6));
    }
    function ctlState() { try { return ctrl.state ? ctrl.state() || {} : {}; } catch (e) { return {}; } }
    function windupNow() { const cs = ctlState(), yu = fin(cs.yu) ? cs.yu : (fin(cs.yUnsat) ? cs.yUnsat : S.y); return Math.abs(yu - S.y); }
    function settledNow() {
      if (S.t - S.tChange < cfg.settleWin - 1e-9 || Math.abs(S.ws - S.wPct) > 1e-6) return false;
      const st = winStat(cfg.settleWin); return st.n > 5 && st.span >= cfg.settleWin * 0.9 && st.range <= 0.3;
    }
    function linBlocks() { return plant.linBlocks(); }
    function ctrlForFreq(ta) { const s = specNow(); return { type: s.type, Kp: s.Kp, Tn: s.Tn, Tv: s.Tv, N: 10, Ta: ta == null ? s.Ta : ta }; }
    // Phasenreserve-Verlust durch Abtastung (nur wenn der Kern Frequenzgang und Reserven liefert)
    function abtastLoss() {
      if (!(C0.freq && typeof C0.freq.loopBlocks === 'function' && typeof C0.margins === 'function')) return null;
      const key = [Cv.ctrl, Cv.kp, Cv.tn, hasD(Cv.ctrl) ? Cv.tv : 0, Cv.ta, JSON.stringify(Cv.plantKey || '')].join('|');
      if (S.abtastKey === key) return S.abtastVal;
      let val = null;
      try {
        const bl = linBlocks(), l1 = C0.freq.loopBlocks(bl, ctrlForFreq()), l0 = C0.freq.loopBlocks(bl, (() => { const q = ctrlForFreq(); delete q.Ta; return q; })());
        if (l1 && l1.ok !== false && l0 && l0.ok !== false) { const m1 = C0.margins(l1), m0 = C0.margins(l0); if (m1 && m0 && m1.valid !== false && m0.valid !== false && fin(m1.phiR) && fin(m0.phiR)) val = m0.phiR - m1.phiR; }
      } catch (e) { val = null; }
      S.abtastKey = key; S.abtastVal = val; return val;
    }
    function tDom() { let m = 0; plant.linBlocks().forEach(b => { if (b.t === 'PT1' && b.T > m) m = b.T; }); return m; }
    function ttSum() { let m = 0; plant.linBlocks().forEach(b => { if (b.t === 'Tt') m += b.Tt; }); return m; }

    // ---- Diagnose (SPEC 4.11): jede Meldung nur bei geprueft erfuellter Bedingung ----
    function evalDiag(dt) {
      const now = [], add = (id, kind, text, fx) => now.push({ id, kind, text, fx });
      const held = (id, cond, hold) => { const v = cond ? (S.hold[id] || 0) + dt : 0; S.hold[id] = v; return cond && v >= (hold == null ? cfg.tHold : hold) - 1e-9; };
      const type = Cv.ctrl, ymaxS = S.ymax, yminS = S.ymin;
      const satHi = S.y >= ymaxS - 0.5, satLo = S.y <= yminS + 0.5;
      const wind = windupNow();
      const osc = S.osc;
      const live = Cv.mode !== 'hand';                                      // im Handbetrieb entfallen alle Regler-Meldungen ausser hand und wirk (wie REG_CORE.diagnose)
      const ctx = { S, Cv, P, plant, osc, held, add, dt, settled: settledNow(), wind, satHi, satLo, live, fm, fmT, toPhys, toPct };
      if (Cv.dir !== cfg.requiredDir) add('wirk', 'error', tx('wirk', { dir: cfg.requiredDir }));
      const grenzCond = live && cfg.grenzCond ? cfg.grenzCond(ctx) : false;
      if (live && osc.cls === 'dauerschwingung' && !grenzCond) add('dauer', 'warn', tx('dauer', { T: fmT(osc.period), Tn: type === 'PI' || type === 'PID' ? ' oder vergrößere Tn' : '' }), 'osc');
      if (live && osc.cls === 'aufschaukelnd') add('auf', 'error', tx('auf'), 'osc');
      if (grenzCond) add('grenz', 'warn', tx('grenz'), 'osc');
      if (held('windup', live && Cv.aw === 'aus' && hasI(type) && wind > 25)) add('windup', 'warn', tx('windup', { x: fm(wind, 0) }), 'windup');
      if (held('sat-hoch', live && satHi)) add('sat-hoch', 'warn', tx('sat-hoch', { x: fm(ymaxS, 0) }));
      if (held('sat-tief', live && satLo)) add('sat-tief', 'info', yminS === 0 ? tx('sat-tief') : 'Die Stellgröße steht am unteren Anschlag (' + fm(yminS, 0) + ' %). Der Regler kann nicht weniger stellen.');
      if (live && !hasI(type) && ctx.settled && !satHi && !satLo && cfg.eblText) { const t = cfg.eblText(ctx); if (t) add('ebl', 'info', t); }
      if (live && hasD(type) && Cv.tv > 0 && Cv.noise > 0 && held('d-rausch', yJitter() > 5, 0)) add('d-rausch', 'warn', tx('d-rausch', { x: fm(yJitter(), 1) }));
      if (cfg.diagExtra) cfg.diagExtra(ctx);
      const tt = ttSum(), td = tDom();
      if (td > 0 && tt / td > 0.5) add('totzeit', 'info', tx('totzeit', { x: fm(tt / td, 2) }));
      if (live && type !== '2P' && type !== '3P') { const al = abtastLoss(); if (al != null && al > 10) add('abtast', 'warn', tx('abtast', { Ta: fmT(Cv.ta), x: fm(al, 0) })); }
      if (Cv.mode === 'hand') add('hand', 'info', tx('hand'));
      now.sort((a, b) => DIAG_ORDER.indexOf(a.id) - DIAG_ORDER.indexOf(b.id));
      // Ereignis bei jedem neuen Auftreten (Wiederholung erst nach 1 s ohne die Bedingung)
      const ids = {};
      now.forEach(d => {
        ids[d.id] = true; const g = S.dg[d.id] || (S.dg[d.id] = { on: false, off: 0 });
        g.off = 0; if (!g.on) { g.on = true; ev(d.text, d.kind, d.fx, d.id); }
      });
      Object.keys(S.dg).forEach(id => { const g = S.dg[id]; if (!ids[id] && g.on) { g.off += dt; if (g.off >= 1) g.on = false; } });
      S.now = now;
    }

    // ---- Steuerwerte ----
    function parseVal(d, value) {
      if (d.type === 'slider') {
        let n = value;
        if (typeof n === 'boolean' && d.key === 'z' && cfg.zToggle != null) n = n ? cfg.zToggle : 0;
        else if (typeof n === 'string') { n = n.trim().replace(',', '.'); n = n === '' ? NaN : +n; }
        else if (typeof n !== 'number') return { ok: false };
        if (!fin(n)) return { ok: false };
        return { ok: true, v: clamp(n, d.min, d.max) };
      }
      const o = d.options.find(q => String(q.value) === String(value) || (typeof q.value === 'number' && typeof value === 'number' && Math.abs(q.value - value) < 1e-9));
      return o ? { ok: true, v: o.value } : { ok: false };
    }
    function setControl(key, value) {
      try {
        const d = defOf[key];
        if (!d) return false;
        if (key === 'ctrl' && typeof value === 'string' && ALL_CTRL.indexOf(value) >= 0 && cfg.ctrlOk.indexOf(value) < 0) { ev('Diese Reglerart gibt es an dieser Anlage nicht.', 'warn'); return false; }
        const pv = parseVal(d, value);
        if (!pv.ok) return false;
        const v = pv.v, old = Cv[key];
        if (key === 'mode') {
          if (v === 'hand' && old !== 'hand') { Cv.yHand = S.yHandExpl ? Cv.yHand : clamp(S.y, 0, 100); S.hand = true; }
          if (v === 'auto' && old !== 'auto') { S.hand = false; S.yHandExpl = false; ctrl.bumpless(S.y, S.ws, S.xm); ev('Automatik: Der Regler übernimmt stoßfrei bei y = ' + fm(S.y, 1) + ' %.', 'info', null, 'auto'); }
        }
        Cv[key] = v;
        if (key === 'yHand') S.yHandExpl = true;
        if (key === 'w') { S.wPct = toPct(v); if (S.k === 0) S.ws = S.wPct; }      // vor dem ersten Schritt gibt es noch keinen Sollwertsprung
        if (key === 'wRamp') S.rampPct = v * 100 / SPAN;
        if (key === 'noise') S.sigma = v;
        if (['ctrl', 'dir', 'kp', 'tn', 'tv', 'u0', 'aw', 'ymax', 'ta'].indexOf(key) >= 0 && old !== v) applyCtl(key);
        if (cfg.onControl) cfg.onControl(key, v, old, { S, Cv, plant, ev });
        if (old !== v && key !== 'yHand') S.tChange = S.t;
        evalDiag(0);
        return true;
      } catch (e) { return false; }
    }
    function getControl(key) {
      if (key === 'yHand') return Cv.mode === 'auto' && !S.yHandExpl ? clamp(S.y, 0, 100) : Cv.yHand;
      return Cv[key];
    }
    function applyPreset(id) {
      const p = (cfg.presets || []).find(q => q.id === id); if (!p) return false;
      const keys = Object.keys(p.params), zT = p.params.z;
      if (p.reset) { if (p.params.mode) Cv.mode = p.params.mode; initState(); }   // Start aus der Ruhe (P-Regler: kein Nachfuehren von u0 aus dem Handbetrieb)
      keys.forEach(k => { if (!p.op || (k !== 'z' && k !== 'mode')) setControl(k, p.params[k]); });
      if (!p.op && p.params.mode === 'auto') S.yHandExpl = false;
      if (p.op) {
        setControl('z', p.op.z != null ? p.op.z : (zT != null ? zT : Cv.z));
        setOperatingPoint(p.op.y, p.op.x0);
        if (p.params.mode === 'auto') setControl('mode', 'auto');
        if (zT != null) setControl('z', zT);
      }
      S.tChange = S.t; trN = 0;
      return true;
    }
    function setOperatingPoint(yPct, x0) {
      let y = +yPct; if (!fin(y)) return false;
      y = clamp(y, S.ymin, S.ymax);
      Cv.mode = 'hand'; S.hand = true; Cv.yHand = clamp(y, 0, 100); S.yHandExpl = true;
      plant.setOp(y, Cv.z, fin(+x0) && x0 != null ? +x0 : null);
      S.y = y; S.xTrue = plant.xPct(); S.xf = S.xTrue; S.xm = S.xTrue; S.ws = S.wPct;
      ctrl.bumpless(y, S.ws, S.xm);
      S.hold = {}; S.dg = {}; S.tChange = S.t; S.osc = { cls: 'aperiodisch', period: null, amp: 0, ratio: null, limited: false };
      evalDiag(0);
      return true;
    }
    function steadyPhys(yPct, zVal) {
      const y = +yPct, z = zVal === undefined || zVal === null ? Cv.z : +zVal;
      if (!fin(y) || !fin(z)) return NaN;
      return plant.steady(clamp(y, 0, 100), z);
    }

    // ---- Zeitablauf ----
    function stepProcess(dtS, maxSteps) {
      dtS = +dtS; if (!(dtS > 0) || !fin(dtS)) return 0;
      S.acc += dtS / h;
      let n = Math.floor(S.acc + 1e-6);
      S.acc -= n;
      if (maxSteps != null && n > maxSteps) { n = maxSteps; S.acc = 0; if (!S.throttled) { S.throttled = true; ev('Zeitraffer gedrosselt: Die Anlage rechnet höchstens ' + maxSteps + ' Kernschritte je Bild, die Prozesszeit läuft langsamer als eingestellt.', 'info', null, 'drossel'); } }
      else if (maxSteps != null) S.throttled = false;
      for (let i = 0; i < n; i++) coreStep();
      return n * h;
    }
    function step(dtMs) {
      dtMs = +dtMs; if (!(dtMs > 0) || !fin(dtMs)) return;
      stepProcess(dtMs / 1000 * cfg.timeScale, 2000);
    }

    function readMeters() {
      const xp = toPhys(S.xTrue), wp = Cv.w;
      const m = Object.assign({ x: xp, w: wp, y: S.y, e: dirS() * (toPhys(S.ws) - xp) }, cfg.meterValues(S, plant, Cv));
      Object.keys(m).forEach(k => { if (!fin(m[k])) m[k] = 0; });
      return m;
    }
    function oscFin(o) { const r = Object.assign({}, o); ['period', 'amp', 'ratio'].forEach(k => { r[k] = (typeof r[k] === 'number' && isFinite(r[k])) ? r[k] : 0; }); r.limited = !!r.limited; return r; }
    function state() {
      const xp = toPhys(S.xTrue), wp = toPhys(S.ws), cs = ctlState();
      const yu = fin(cs.yu) ? cs.yu : S.y;
      const faults = S.now.filter(d => d.kind !== 'info').map(d => d.id);
      const st = {
        t: S.t, w: Cv.w, x: xp, xm: toPhys(S.xm), y: S.y, z: Cv.z, e: dirS() * (wp - xp),
        wPct: toPct(Cv.w), xPct: S.xTrue, yPct: S.y, ePct: dirS() * (S.ws - S.xTrue),
        mode: Cv.mode, ctrl: Cv.ctrl, kp: Cv.kp, tn: Cv.tn, tv: Cv.tv, ta: Cv.ta, dir: Cv.dir, ymax: Cv.ymax,
        satHigh: S.y >= S.ymax - 0.5, satLow: S.y <= S.ymin + 0.5, windup: Math.abs(yu - S.y),
        osc: S.osc.cls, oscInfo: oscFin(S.osc), faults, throttled: S.throttled
      };
      return Object.assign(st, cfg.stateExtra(S, plant, Cv));
    }
    function trace(spanS) {
      const sp = fin(+spanS) && +spanS > 0 ? +spanS : cfg.spanS;
      const idx = recentIdx(sp), out = { t: [], w: [], x: [], y: [], z: [], e: [], extra: {} };
      extraTr.forEach(q => { out.extra[q.key] = []; });
      const stride = Math.max(1, Math.ceil(idx.length / 600));
      for (let j = idx.length - 1; j >= 0; j -= stride) {                     // vom neuesten Punkt rueckwaerts, damit der letzte Wert dabei ist
        const i = idx[j];
        out.t.push(TR.t[i]); out.w.push(TR.w[i]); out.x.push(TR.x[i]); out.y.push(TR.y[i]); out.z.push(TR.z[i]); out.e.push(TR.e[i]);
        extraTr.forEach(q => out.extra[q.key].push(TR.extra[q.key][i]));
      }
      ['t', 'w', 'x', 'y', 'z', 'e'].forEach(k => out[k].reverse()); Object.keys(out.extra).forEach(k => out.extra[k].reverse());
      return out;
    }
    function analysis() {
      const blocks = linBlocks(), spec = specNow();
      const out = { blocks, V0: plant.V0(Cv.kp), margins: null, linearised: plant.nonlinear(), info: cfg.analysisInfo(Cv), ctrl: Cv.ctrl };
      if (spec.type === '2P' || spec.type === '3P') return out;
      try {
        if (C0.freq && typeof C0.freq.loopBlocks === 'function' && typeof C0.margins === 'function') {
          const lb = C0.freq.loopBlocks(blocks, ctrlForFreq());
          if (lb && lb.ok !== false) out.margins = C0.margins(lb);
        }
      } catch (e) { out.margins = null; }
      return out;
    }
    function identify() {
      if (typeof C0.identify !== 'function') return { ok: false, why: 'Der Kern (identify) ist nicht geladen.' };
      try { return C0.identify(linBlocks()); } catch (e) { return { ok: false, why: 'Die Identifikation ist fehlgeschlagen.' }; }
    }
    function reset() { initState(); }

    const rig = {
      id: cfg.id, range: Object.assign({}, RG), timeScale: cfg.timeScale, tUnit: cfg.tUnit, h, spanS: cfg.spanS,
      controls: defs, meters: cfg.meters.map(m => Object.assign({}, m)), presets: cfg.presets, roles: Object.assign({}, cfg.roles), requiredDir: cfg.requiredDir,
      params: Object.freeze(Object.assign({}, P)),
      events,
      setControl, getControl, step, stepProcess: dtS => stepProcess(dtS), readMeters, state, trace, reset,
      setOperatingPoint, steady: steadyPhys, linBlocks, analysis, identify, applyPreset,
      diagnose() { return S.now.map(d => ({ id: d.id, kind: d.kind, text: d.text, fx: d.fx })); },
      worldSize() { return { w: WW, h: WH }; },
      curves() { try { return cfg.curves({ S, Cv, P, plant, toPhys, state, linBlocks }); } catch (e) { return []; } },
      draw(ctx, w, hgt, tms) {
        if (!ctx || !(w > 0) || !(hgt > 0) || !fin(w) || !fin(hgt)) return;
        try {
          const f = fitOf(w, hgt); ctx.save(); ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
          ctx.beginPath(); ctx.rect(0, 0, WW, WH); ctx.clip();
          cfg.draw(ctx, fin(+tms) ? +tms : 0, { S, Cv, P, plant, toPhys, state, readMeters });
          ctx.restore();
        } catch (e) { try { ctx.restore(); } catch (e2) { /* nichts */ } }
      },
      hitTest(px, py, w, hgt) {
        try {
          if (!fin(px) || !fin(py) || !(w > 0) || !(hgt > 0)) return null;
          const f = fitOf(w, hgt), x = (px - f.ox) / f.s, y = (py - f.oy) / f.s;
          return cfg.hitTest ? cfg.hitTest(x, y, { S, Cv, plant }) : null;
        } catch (e) { return null; }
      }
    };
    initState();
    if (opts.controls) Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k]));
    return rig;
  }


  /* geteilte Namen der Basis (nur const und function) */
  R.cbase = {
    WW, FONT, MONO, C, TWO_PI, DIAG_EVERY, TR_CAP, DIAG_ORDER, ALL_CTRL, OSC_CLS, clamp, lerp, fin, fm, fmT, hasI, hasD, core, sel, sld, oscLocal,
    oscClassify, rr, txt, dial, sparks, simLin, DIAG_FALLBACK, tx, fitOf, buildRig, WH
  };

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
