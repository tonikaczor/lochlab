/* regrig-fuell.js - Regelungstechnik-Lab: gemeinsame Basis der Pruefstaende (REG_RIGS.baseA) und Pruefstand 1 `fuellstand`
 * (Tank, Pumpe, Entnahmeventil).
 *
 * Diese Datei enthaelt ZUSAETZLICH die gemeinsame Basis `REG_RIGS.baseA` (Regelkreis, Messglied, Sollwertrampe, Schreiber,
 * Diagnose, Bedienpult, Linearisierung, Kennlinien-Huelle, Zeichen-Huelle). `regrig-fluss.js` und `regrig-bau.js` benutzen
 * sie (Ladereihenfolge im Browser: regrig-fuell.js VOR regrig-fluss.js und regrig-bau.js; in Node holen sie sich die Basis per require).
 * Abhaengigkeiten: REG_CORE (regcore.js: controller, rng, oscillation, freq, margins, identify, stepResponse), REG_DRAW (regdraw.js)
 * nur zum Zeichnen. Ohne REG_DRAW zeichnet `draw` einen Platzhaltertext.
 *
 * Einheiten: Regler und Kennwerte in Prozent des Messbereichs; Anzeige und Steuerwerte physikalisch (cm, L/min, ...);
 * Zeiten in Prozess-Sekunden. Deterministisch (Rauschen nur ueber REG_CORE.sensor, Seed 1 oder opts.seed). `step` und `stepProcess` werfen nie.
 *
 * Schnittstelle (SPEC 4.1) und Zusaetze dieser Gruppe:
 *  - create(opts): opts.controls = Steuerwerte, opts.params = Anlagenkonstanten ueberschreiben (Tests: sensorTau 0), opts.seed = Rausch-Seed,
 *    opts.noDraw = true erzwingt den Platzhalter in draw (Tests).
 *  - setControl(key, wert) liefert true/false (unbekannter Schluessel, NaN, Text, nicht erlaubte Reglerart: false, Zahlen werden geklemmt; die Kommazahl als Text
 *    "2,5" wird gelesen). Fuer `z` (Fuellstand, Durchfluss) sind true/false Schaltwerte (siehe hitTest).
 *  - hitTest(px, py, w, h) -> null | { key, kind:'switch', to } : `to` ist der Wert, der bei Antippen zu setzen ist (z: Fuellstand 0 <-> 60 %,
 *    Durchfluss 0 -> -30 -> +30 -> 0; mode: 'hand' <-> 'auto'), weil z ein Schieber und mode eine Auswahl ist.
 *  - setOperatingPoint(y) stellt (wie in der SPEC) auf Handbetrieb; steady(y, z?) = Istwert im Beharrungszustand (physikalisch, am Tankrand geklemmt;
 *    I-Strecken: NaN); yFor(x, z?) = Stellgroesse (%), die im Beharrungszustand den Istwert x ergibt; linBlocks(y?) = linearisierte Blockliste im
 *    aktuellen Zustand (ohne Argument) oder im Beharrungszustand fuer y.
 *  - state(): SPEC-Felder plus xm (Messwert), wSet (eingestellter Sollwert, w ist der wirksame Wert nach der Rampe), oscInfo, throttled und Anlagenfelder.
 *    readMeters() enthaelt zusaetzlich w, e, y. trace(span).extra: wPct, xPct, ePct, xm, yu und Anlagenspuren.
 *  - diagnose(): REG_CORE.diagnose (allgemeine Meldungen) plus anlagenspezifische (ueberlauf, leer, ventil-auf, slew); drawError() nur fuer Tests.
 */
(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // =====================================================================================================================
  //  Gemeinsame Basis
  // =====================================================================================================================
  if (!R.baseA) R.baseA = (function () {
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const num = (v, d) => {
      if (typeof v === 'string' && v.trim() !== '') v = Number(v.trim().replace(',', '.'));
      return (typeof v === 'number' && isFinite(v)) ? v : d;
    };
    const fm = (v, d) => { v = +v; if (!isFinite(v)) return '–'; return v.toFixed(d).replace('.', ','); };
    const fn = (v, d) => { let s = fm(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
    function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
    function getCore() {
      const c = root.REG_CORE || tryRequire('./regcore.js') || root.REG_CORE;
      if (!c || !c.controller) throw new Error('REG_CORE (regcore.js) ist nicht geladen.');
      return c;
    }
    const getDraw = () => root.REG_DRAW || tryRequire('./regdraw.js') || root.REG_DRAW || null;

    const CTRL_LABEL = { P: 'P-Regler', I: 'I-Regler', PI: 'PI-Regler', PD: 'PD-Regler', PID: 'PID-Regler', '2P': 'Zweipunktregler (ein/aus)', '3P': 'Dreipunktregler (Plus, Null, Minus)' };
    // Meldungstexte: einzige Quelle ist REG_CORE.TEXTS (Rig-Texte) und REG_CORE.diagnose (Diagnosen); nur anlagenspezifische Texte stehen im Pruefstand.
    const KT = (CORE, id) => (CORE.TEXTS && CORE.TEXTS.rig && CORE.TEXTS.rig[id]) || '';

    // ---------------------------------------------------------------------------------------------------------------
    //  Bedienpult (gemeinsame Schluessel, SPEC 4.7)
    // ---------------------------------------------------------------------------------------------------------------
    function controlSet(cfg) {
      const L = [];
      const hasI = s => !!s && (s.ctrl === 'I' || s.ctrl === 'PI' || s.ctrl === 'PID');
      const hasD = s => !!s && (s.ctrl === 'PD' || s.ctrl === 'PID');
      const isP = s => !!s && (s.ctrl === 'P' || s.ctrl === 'PD');
      const sw = s => !!s && (s.ctrl === '2P' || s.ctrl === '3P');
      const W = cfg.w, ru = cfg.range;
      L.push({ key: 'mode', label: 'Betriebsart', type: 'select', value: 'auto', options: [{ value: 'hand', label: 'Hand' }, { value: 'auto', label: 'Automatik' }], group: 'Regler',
        help: 'Hand: Du bestimmst die Stellgröße selbst, der Regler folgt nur. Automatik: Der Regler stellt. Das Umschalten ist stoßfrei.' });
      L.push({ key: 'ctrl', label: 'Reglerart', type: 'select', value: cfg.ctrlDefault || 'P', options: cfg.ctrls.map(c => ({ value: c, label: CTRL_LABEL[c] })), group: 'Regler',
        help: 'P: schnell, aber mit bleibender Abweichung. I: genau, aber langsam. PI: genau. PD: dämpft. PID: alle drei Anteile. Zweipunkt: schaltet nur ein und aus.' });
      L.push({ key: 'dir', label: 'Wirkungssinn', type: 'select', value: 'direkt', options: [{ value: 'direkt', label: 'direkt' }, { value: 'invers', label: 'invers' }], group: 'Regler',
        help: 'Direkt: Die Stellgröße steigt, wenn der Istwert unter dem Sollwert liegt. Invers: umgekehrt (zum Beispiel beim Kühlen). Falsch eingestellt, läuft die Regelung weg.' });
      L.push({ key: 'kp', label: 'Verstärkung Kp', type: 'slider', scale: 'log', min: 0.1, max: 100, step: 0.1, unit: '', value: cfg.kp || 2, group: 'Regler',
        visible: s => !!s && (s.ctrl === 'P' || s.ctrl === 'PI' || s.ctrl === 'PD' || s.ctrl === 'PID'),
        help: 'Verstärkung Kp des Reglers, Proportionalbereich Xp = 100 % / Kp. Größeres Kp: schneller und kleinere bleibende Abweichung, aber der Kreis schwingt eher.' });
      L.push({ key: 'tn', label: 'Nachstellzeit Tn', type: 'slider', scale: 'log', unitKind: 'time', min: cfg.tn.min, max: cfg.tn.max, step: cfg.tn.step || 0.1, unit: 's', value: cfg.tn.value, group: 'Regler', visible: hasI,
        help: 'Nachstellzeit Tn: Zeit, in der der I-Anteil so viel stellt wie der P-Anteil. Kleineres Tn: schneller, aber der Kreis schwingt eher.' });
      L.push({ key: 'tv', label: 'Vorhaltzeit Tv', type: 'slider', scale: 'lin', unitKind: 'time', min: 0, max: cfg.tv.max, step: cfg.tv.step || 0.1, unit: 's', value: cfg.tv.value || 0, group: 'Regler', visible: hasD,
        help: 'Vorhaltzeit Tv: Der D-Anteil reagiert auf die Änderung des Istwerts und dämpft. Er verstärkt aber auch das Messrauschen.' });
      L.push({ key: 'u0', label: 'Stellgröße im Arbeitspunkt u0', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, unit: '%', value: cfg.u0 || 0, group: 'Regler', visible: isP,
        help: 'Grundwert der Stellgröße beim P- und PD-Regler (so viel stellt der Regler bei Regeldifferenz 0).' });
      L.push({ key: 'aw', label: 'Anti-Windup', type: 'select', value: 'rueck', options: [{ value: 'aus', label: 'aus' }, { value: 'klemmen', label: 'klemmen' }, { value: 'rueck', label: 'Rückrechnung' }], group: 'Regler', visible: hasI,
        help: 'Begrenzt den I-Anteil, wenn die Stellgröße am Anschlag steht. Aus: Der I-Anteil läuft weg (Windup) und überschwingt später stark.' });
      L.push({ key: 'ymax', label: 'Stellgrößenbegrenzung ymax', type: 'slider', scale: 'lin', min: 20, max: 100, step: 1, unit: '%', value: 100, group: 'Regler',
        help: 'Obere Grenze des Stellglieds. Steht die Stellgröße am Anschlag, kann der Regler nicht mehr nachhelfen.' });
      L.push({ key: 'ta', label: 'Abtastzeit Ta', type: 'select', unitKind: 'time', value: cfg.ta[0], options: cfg.ta.map(v => ({ value: v, label: fn(v, 3) + ' s' })), group: 'Regler',
        help: 'Abtastzeit des Reglers: Zwischen zwei Abtastungen hält er die Stellgröße. Eine große Abtastzeit kostet Phasenreserve.' });
      if (cfg.hyst) L.push({ key: 'hyst', label: 'Schaltdifferenz Δ', type: 'slider', scale: 'lin', min: cfg.hyst.min, max: cfg.hyst.max, step: cfg.hyst.step, unit: ru.unit, value: cfg.hyst.value, group: 'Regler',
        visible: sw, help: 'Schaltdifferenz Δ: Der Zweipunkt- oder Dreipunktregler schaltet erst, wenn die Regeldifferenz um Δ/2 über oder unter der Schaltschwelle liegt.' });
      if (cfg.dead) L.push({ key: 'dead', label: 'Totzone', type: 'slider', scale: 'lin', min: cfg.dead.min, max: cfg.dead.max, step: cfg.dead.step, unit: ru.unit, value: cfg.dead.value, group: 'Regler',
        visible: s => !!s && s.ctrl === '3P', help: 'Halbe Breite der Totzone des Dreipunktreglers: Innerhalb schaltet er weder auf Plus noch auf Minus.' });
      L.push({ key: 'w', label: W.label || 'Sollwert w', type: 'slider', scale: 'lin', min: W.min, max: W.max, step: W.step, unit: ru.unit, value: W.value, group: 'Regler',
        help: 'Sollwert (Führungsgröße) von ' + fn(W.min, 1) + ' bis ' + fn(W.max, 1) + ' ' + ru.unit + '. Ein Sprung am Sollwert zeigt das Führungsverhalten.' });
      L.push({ key: 'wRamp', label: 'Sollwertrampe', type: 'slider', scale: 'lin', min: 0, max: cfg.wRamp.max, step: cfg.wRamp.step, unit: '%/s', value: 0, group: 'Regler',
        help: 'Der Sollwert läuft mit dieser Geschwindigkeit (in % des Messbereichs je Sekunde) auf den neuen Wert. 0 = Sprung.' });
      L.push({ key: 'yHand', label: 'Handstellgröße', type: 'slider', scale: 'lin', min: 0, max: 100, step: 0.5, unit: '%', value: 0, group: 'Regler',
        help: 'Stellgröße im Handbetrieb. Im Automatikbetrieb zeigt der Regler hier seine aktuelle Stellgröße.' });
      (cfg.extra || []).forEach(c => L.push(c));
      L.push({ key: 'noise', label: 'Messrauschen', type: 'slider', scale: 'lin', min: 0, max: 5, step: 0.1, unit: '%', value: 0, group: 'Anlage und Störung',
        help: 'Rauschen des Messglieds in % des Messbereichs. Mit Rauschen zittert die Stellgröße, besonders mit D-Anteil.' });
      return L;
    }
    const meterRows = (range) => ({ w: { key: 'w', label: 'Sollwert w', unit: range.unit, digits: range.digits, min: range.lo, max: range.hi },
      e: { key: 'e', label: 'Regeldifferenz e', unit: range.unit, digits: range.digits, min: -(range.hi - range.lo), max: range.hi - range.lo },
      y: { key: 'y', label: 'Stellgröße y', unit: '%', digits: 1, min: 0, max: 100 } });

    // ---------------------------------------------------------------------------------------------------------------
    //  Regelkreis (SPEC 4.5)
    // ---------------------------------------------------------------------------------------------------------------
    function makeRig(def, opts) {
      opts = opts && typeof opts === 'object' ? opts : {};
      const CORE = getCore();
      const h = def.h, lo = def.range.lo, hi = def.range.hi, span = hi - lo;
      const params = Object.freeze(Object.assign({}, def.params, (opts.params && typeof opts.params === 'object') ? opts.params : {}));
      const ctl = {}, dmap = {};
      def.controls.forEach(c => { ctl[c.key] = c.value; dmap[c.key] = c; });
      const ev = [];
      const toPct = v => (v - lo) / span * 100, fromPct = p => lo + p / 100 * span;
      const evEvery = Math.max(1, Math.min(50, Math.round(0.5 / h)));
      const recEvery = Math.max(1, Math.round(def.spanS / 300 / h));
      const MAXPTS = 6000;
      let t = 0, k = 0, acc = 0, ws = 0, xm = 0, xPrev = 0, yLast = 0, userHand = false, throttled = false;
      let se = null, ctrl = null;
      let tHi = 0, tLo = 0, tWind = 0, osc = { cls: 'aperiodisch' }, settled = false, nJ = 0, jv = 0, yPrevS = 0;
      let act = [], prevAct = {}, abCache = { key: '', loss: null, n: 0 };
      let TR = null, P = null;

      const say = (text, kind, fx) => { const e = { t: t, text: text, kind: kind || 'info' }; if (fx) e.fx = fx; ev.push(e); if (ev.length > 120) ev.shift(); };
      const P0 = { ctl, params, h, say, toPct, fromPct, CORE, range: def.range, span };
      P = def.plant(P0);

      // ---- Regler ----
      const nTa = () => Math.max(1, Math.round(ctl.ta / h));
      const hystPct = () => (ctl.hyst === undefined ? 2 : ctl.hyst) / span * 100;
      const deadPct = () => (ctl.dead === undefined ? 1 : ctl.dead) / span * 100;
      function ctlSpec() {
        return { type: ctl.ctrl, Kp: ctl.kp, Tn: ctl.tn, Tv: ctl.tv, N: 10, Ta: ctl.ta, u0: ctl.u0, ymin: 0, ymax: ctl.ymax, aw: ctl.aw, Tr: null, dOn: 'x', dir: ctl.dir,
          hyst: hystPct(), dead: deadPct(), yOn: ctl.ymax, yOff: 0, yPlus: ctl.ymax, yZero: Math.min(50, ctl.ymax), yMinus: 0 };
      }
      const sizeOfI = () => ctl.ctrl === 'I' || ctl.ctrl === 'PI' || ctl.ctrl === 'PID';
      function buildCtrl(keepState) {
        const c = CORE.controller(ctlSpec(), h);
        if (!c || c.ok === false) return false;
        ctrl = c;
        if (keepState && ctl.mode === 'auto' && sizeOfI()) ctrl.bumpless(yLast, ws, xm);
        return true;
      }
      function setParamsLive() {
        if (ctrl && typeof ctrl.setParams === 'function') {
          const r = ctrl.setParams(ctlSpec());
          if (r && r.ok === false) { say((r.why || '') + ' (letzter Wert bleibt)', 'warn'); return false; }
          if (r && r.ok) return true;
        }
        return buildCtrl(true);
      }

      // ---- Schreiber ----
      function resetTrace() {
        TR = { t: [], w: [], x: [], y: [], z: [], e: [], xm: [], yu: [], ex: {} };
        (def.extraTrace || []).forEach(kk => { TR.ex[kk] = []; });
      }
      const dirS = () => ctl.dir === 'direkt' ? 1 : -1;
      function record() {
        const cs = ctrl && ctrl.state ? ctrl.state() : null;
        TR.t.push(t); TR.w.push(ws); TR.x.push(P.xPct()); TR.y.push(yLast); TR.z.push(ctl.z === undefined ? 0 : ctl.z);
        TR.e.push(dirS() * (ws - P.xPct())); TR.xm.push(xm); TR.yu.push(cs && isFinite(cs.yu) ? cs.yu : yLast);
        const ex = P.extra ? P.extra() : null;
        (def.extraTrace || []).forEach(kk => TR.ex[kk].push(ex && isFinite(ex[kk]) ? ex[kk] : 0));
        if (TR.t.length > MAXPTS + 500) {
          const cut = TR.t.length - MAXPTS;
          ['t', 'w', 'x', 'y', 'z', 'e', 'xm', 'yu'].forEach(kk => TR[kk].splice(0, cut));
          Object.keys(TR.ex).forEach(kk => TR.ex[kk].splice(0, cut));
        }
      }
      function pickIdx(spanS, maxPts) {
        const n = TR.t.length; if (!n) return [];
        const t0 = TR.t[n - 1] - spanS;
        let i0 = n - 1; while (i0 > 0 && TR.t[i0 - 1] >= t0) i0--;
        const st = Math.max(1, Math.ceil((n - i0) / maxPts)), idx = [];
        for (let i = n - 1; i >= i0; i -= st) idx.push(i);
        return idx.reverse();
      }
      function trace(spanS) {
        spanS = num(spanS, def.spanS); if (!(spanS > 0)) spanS = def.spanS;
        const idx = pickIdx(spanS, 600), g = a => idx.map(i => a[i]);
        const ex = { wPct: g(TR.w), xPct: g(TR.x), ePct: g(TR.e), xm: g(TR.xm).map(fromPct), yu: g(TR.yu) };
        Object.keys(TR.ex).forEach(kk => { ex[kk] = g(TR.ex[kk]); });
        return { t: g(TR.t), w: g(TR.w).map(fromPct), x: g(TR.x).map(fromPct), y: g(TR.y), z: g(TR.z), e: g(TR.e).map(p => p / 100 * span), extra: ex };
      }

      // ---- Kernschritt ----
      function kernel() {
        k++; t = k * h;
        const wT = toPct(ctl.w), rate = ctl.wRamp;
        if (rate > 0) ws += clamp(wT - ws, -rate * h, rate * h); else ws = wT;
        xm = se.step(xPrev, h);
        let y;
        if (ctl.mode === 'hand') { y = Math.min(ctl.yHand, ctl.ymax); ctrl.bumpless(y, ws, xm); }
        else {
          y = ctrl.step(ws, xm); if (!isFinite(y)) y = yLast;
          if (!userHand) ctl.yHand = y;
          if (k % nTa() === 0) { const dy = y - yPrevS; jv += (dy * dy / 2 - jv) / 40; yPrevS = y; nJ++; }
        }
        yLast = y;
        P.step(y);
        xPrev = P.xPct();
        if (!isFinite(xPrev)) { P.reset(); xPrev = P.xPct(); se.reset(xPrev); xm = xPrev; say(KT(CORE, 'instabil'), 'error'); }
        if (k % recEvery === 0) record();
        if (k % evEvery === 0) evaluate();
      }
      function stepProcess(dtS) {
        dtS = num(dtS, 0); if (!(dtS > 0)) return 0;
        acc += dtS / h;
        const n = Math.floor(acc + 1e-9); acc -= n;
        for (let i = 0; i < n; i++) kernel();
        return n;
      }
      function step(dtMs) {
        dtMs = num(dtMs, 0); if (!(dtMs > 0)) return;
        let dtS = dtMs / 1000 * def.timeScale;
        if (dtS / h > 2000) {
          dtS = 2000 * h;
          if (!throttled) { throttled = true; say(KT(CORE, 'zeitraffer'), 'info'); }
        } else throttled = false;
        stepProcess(dtS);
      }

      // ---- Auswertung (Diagnose, Schwingung, Anschlaege) ----
      function domT(blocks) { let m = NaN; blocks.forEach(b => { const T = b.t === 'PT1' ? b.T : b.t === 'PT2' ? 1 / b.w0 : NaN; if (isFinite(T) && !(T <= m)) m = T; }); return m; }
      function sumTt(blocks) { let s = 0; blocks.forEach(b => { if (b.t === 'Tt') s += b.Tt; }); return s; }
      function gainOf(blocks) { let K = 1, any = false; blocks.forEach(b => { if (b.t === 'K') { K *= b.K; any = true; } else if (b.t === 'I') { K *= b.Ki; any = true; } }); return any ? K : 1; }
      function abtastLoss(blocks) {
        if (!CORE.freq || !CORE.freq.loopBlocks || !CORE.margins) return null;
        if (ctl.ctrl === '2P' || ctl.ctrl === '3P') return null;
        const spec = ctlSpec();
        const key = [ctl.ctrl, ctl.kp, ctl.tn, ctl.tv, ctl.ta, ctl.dir, blocks.length, Math.round(gainOf(blocks) * 20), Math.round(domT(blocks) * 10)].join('|');
        abCache.n++;
        if (key === abCache.key || (abCache.n < 20 && abCache.key !== '' && abCache.key.split('|').slice(0, 6).join('|') === key.split('|').slice(0, 6).join('|'))) return abCache.loss;
        abCache.key = key; abCache.n = 0; abCache.loss = null;
        const a = CORE.freq.loopBlocks(blocks, spec), b = CORE.freq.loopBlocks(blocks, Object.assign({}, spec, { Ta: 0 }));
        if (!a || a.ok === false || !b || b.ok === false) return null;
        const ma = CORE.margins(a), mb = CORE.margins(b);
        if (ma && mb && ma.phiR !== null && mb.phiR !== null && isFinite(ma.phiR) && isFinite(mb.phiR)) abCache.loss = mb.phiR - ma.phiR;
        return abCache.loss;
      }
      function evaluate() {
        const dtE = evEvery * h, auto = ctl.mode === 'auto', sw = ctl.ctrl === '2P' || ctl.ctrl === '3P';
        const cs = ctrl && ctrl.state ? ctrl.state() : {}, y = yLast;
        const yu = isFinite(cs.yu) ? cs.yu : y;
        const blocks = P.lin();
        const Tdom = domT(blocks);
        tHi = (auto && !sw && y >= ctl.ymax - 0.5) ? tHi + dtE : 0;
        tLo = (auto && !sw && y <= 0.5) ? tLo + dtE : 0;
        tWind = (auto && ctl.aw === 'aus' && sizeOfI() && Math.abs(yu - y) > 25) ? tWind + dtE : 0;
        // Schwingung auf dem Schreiberverlauf (letzte oscWin Sekunden)
        const idx = pickIdx(def.oscWin(Tdom), 200);
        if (idx.length >= 8 && CORE.oscillation) {
          const o = CORE.oscillation(idx.map(i => TR.t[i]), idx.map(i => TR.x[i]), { range: 100, noise: ctl.noise, y: idx.map(i => TR.y[i]), ymin: 0, ymax: ctl.ymax });
          if (o && typeof o.cls === 'string') osc = { cls: o.cls, period: o.period, amp: o.amp, ratio: o.ratio, limited: !!o.limited, n: o.n };
        } else osc = { cls: 'aperiodisch' };
        // eingeschwungen: im Fenster 2*Tdom ist x (Spannweite, Mittelwert 1. gegen 2. Haelfte) und y (Mittelwert) unveraendert
        const winS = Math.max(2 * (isFinite(Tdom) ? Tdom : 10), 20 * dtE), sw2 = pickIdx(winS, 100);
        settled = false;
        if (sw2.length >= 8 && (TR.t[TR.t.length - 1] - TR.t[sw2[0]]) >= winS * 0.95) {
          let mn = Infinity, mx = -Infinity; sw2.forEach(i => { const v = TR.x[i]; if (v < mn) mn = v; if (v > mx) mx = v; });
          const half = Math.floor(sw2.length / 2), avg = (a, i0, i1) => { let sum = 0; for (let i = i0; i < i1; i++) sum += a[sw2[i]]; return sum / (i1 - i0); };
          const x1 = avg(TR.x, 0, half), x2 = avg(TR.x, half, sw2.length), y1 = avg(TR.y, 0, half), y2 = avg(TR.y, half, sw2.length);
          settled = (mx - mn) <= 0.3 && Math.abs(x1 - x2) <= 0.15 && Math.abs(y1 - y2) <= 0.5 && Math.abs(P.xPct() - x2) <= 0.15 && Math.abs(yLast - y2) <= 0.5;
        }
        // Liste der aktiven Meldungen: allgemeine Diagnosen aus REG_CORE.diagnose (ohne Blockliste, die Abtastzeit-Pruefung folgt unten mit Zwischenspeicher)
        const tHold = def.tHold, unit = def.range.unit, ctype = ctl.ctrl, eP = dirS() * (ws - P.xPct()), Tt = sumTt(blocks);
        const ctx = { ctrl: ctype, mode: ctl.mode, tHold: tHold, y: y, ymax: ctl.ymax, satHighFor: tHi, satLowFor: tLo, aw: ctl.aw, windup: Math.abs(yu - y), windupFor: tWind, osc: osc,
          tUnit: def.tUnit, settled: auto && settled && osc.cls !== 'dauerschwingung', e: eP / 100 * span, ePct: eP, q: P.q(), unit: unit, tv: ctl.tv, noise: ctl.noise,
          sigmaY: nJ >= 40 ? Math.sqrt(jv) : 0, dir: ctl.dir, requiredDir: def.requiredDir, Tt: Tt, Tdom: Tdom, ta: ctl.ta, kp: ctl.kp, tn: ctl.tn };
        const out = CORE.diagnose(ctx).filter(d => d.id !== 'hand');
        if (!sw && auto) {
          const loss = abtastLoss(blocks);
          if (loss !== null && loss > 10) out.push({ id: 'abtast', kind: 'warn', text: CORE.TEXTS.get('abtast', { Ta: CORE.fmtTime(ctl.ta, def.tUnit), x: CORE.fmt(loss, 0) }) });
        }
        const own = P.diag ? P.diag({ dtE, auto, y, sw, tHold }) : [];
        own.forEach(d => out.push(d));
        const cur = {};
        out.forEach(d => { cur[d.id] = true; if (!prevAct[d.id]) say(d.text, d.kind, d.fx); });
        prevAct = cur; act = out;
      }
      function diagnose() {
        const live = CORE.diagnose({ mode: ctl.mode, dir: ctl.dir, requiredDir: def.requiredDir, ctrl: ctl.ctrl }).filter(d => d.id === 'hand' || d.id === 'wirk');
        return live.concat(act.filter(d => d.id !== 'hand' && d.id !== 'wirk')).map(d => Object.assign({}, d));
      }

      // ---- Lesen ----
      const fin = v => isFinite(v) ? v : 0;
      function analysis() {
        const blocks = P.lin(), spec = ctlSpec();
        const out = { blocks: blocks, V0: fin(ctl.kp * gainOf(blocks)), margins: null, linearised: !!def.nonlinear, info: def.nonlinear ? 'Linearisiert im Arbeitspunkt' : 'Lineare Strecke', ok: true };
        const lb = CORE.freq && CORE.freq.loopBlocks ? CORE.freq.loopBlocks(blocks, spec) : null;
        if (lb && lb.ok === false) { out.ok = false; out.why = lb.why; }
        else if (lb && CORE.margins) { const m = CORE.margins(lb); out.margins = m; if (m && isFinite(m.V0)) out.V0 = m.V0; }
        return out;
      }
      function readMeters() {
        const m = P.meters();
        const wP = ws, xP = P.xPct();
        m.w = fromPct(wP); m.e = (dirS() * (wP - xP)) / 100 * span; m.y = yLast;
        Object.keys(m).forEach(kk => { m[kk] = fin(m[kk]); });
        return m;
      }
      function oscFin(o) { const r = Object.assign({}, o); ['period', 'amp', 'ratio'].forEach(k => { r[k] = (typeof r[k] === 'number' && isFinite(r[k])) ? r[k] : 0; }); r.limited = !!r.limited; return r; }
      function state() {
        const xP = P.xPct(), eP = dirS() * (ws - xP), cs = ctrl && ctrl.state ? ctrl.state() : {};
        const yu = isFinite(cs.yu) ? cs.yu : yLast;
        const s = { t: t, w: fromPct(ws), x: fromPct(xP), y: yLast, z: ctl.z === undefined ? 0 : ctl.z, e: eP / 100 * span, wPct: ws, xPct: xP, yPct: yLast, ePct: eP,
          xm: fromPct(xm), wSet: ctl.w, mode: ctl.mode, ctrl: ctl.ctrl, kp: ctl.kp, tn: ctl.tn, tv: ctl.tv, ta: ctl.ta, dir: ctl.dir, ymax: ctl.ymax,
          satHigh: yLast >= ctl.ymax - 0.5, satLow: yLast <= 0.5, windup: ctl.mode === 'auto' ? Math.abs(yu - yLast) : 0,
          osc: osc.cls, oscInfo: oscFin(osc), faults: diagnose().filter(d => d.kind !== 'info').map(d => d.id), throttled: throttled };
        Object.assign(s, P.state(analysis));
        Object.keys(s).forEach(kk => { if (typeof s[kk] === 'number') s[kk] = fin(s[kk]); });
        return s;
      }

      // ---- Steuerwerte ----
      function validate(key, v) {
        const d = dmap[key]; if (!d) return { ok: false };
        if (d.type === 'slider') {
          if (typeof v === 'boolean' && def.boolKeys && Object.prototype.hasOwnProperty.call(def.boolKeys, key)) v = v ? def.boolKeys[key] : 0;
          v = num(v, NaN); if (!isFinite(v)) return { ok: false };
          return { ok: true, v: clamp(v, d.min, d.max) };
        }
        if (d.type === 'select') {
          for (let i = 0; i < d.options.length; i++) if (d.options[i].value === v || (typeof v !== 'object' && v !== null && v !== undefined && String(d.options[i].value) === String(v))) return { ok: true, v: d.options[i].value };
          return { ok: false };
        }
        return { ok: true, v: !!v };
      }
      function setControl(key, value) {
        const r = validate(key, value);
        if (!r.ok) { if (key === 'ctrl' && typeof value === 'string') say(KT(CORE, 'reglerart'), 'warn'); return false; }
        const old = ctl[key]; ctl[key] = r.v;
        if (key === 'mode') {
          if (r.v === 'hand' && old !== 'hand') { if (!userHand) ctl.yHand = Math.min(yLast, 100); say(CORE.TEXTS.get('hand'), 'info'); }
          else if (r.v === 'auto' && old !== 'auto') { userHand = false; if (ctl.ctrl === '2P' || ctl.ctrl === '3P') say(KT(CORE, 'zweipunkt'), 'info'); }
        } else if (key === 'yHand') { if (ctl.mode === 'auto') userHand = true; }
        else if (key === 'ctrl' || key === 'dir' || key === 'ta' || key === 'aw') {
          if (!buildCtrl(true)) { ctl[key] = old; return false; }
          if (key === 'ctrl' && (r.v === '2P' || r.v === '3P') && ctl.mode === 'auto') say(KT(CORE, 'zweipunkt'), 'info');
        } else if (key === 'kp' || key === 'tn' || key === 'tv' || key === 'u0' || key === 'ymax' || key === 'hyst' || key === 'dead') {
          if (!setParamsLive()) { ctl[key] = old; return false; }
        } else if (key === 'w') { if (!(ctl.wRamp > 0)) ws = toPct(r.v); }
        else if (key === 'noise') se.setNoise(r.v);
        if (P.onControl) P.onControl(key, old);
        return true;
      }
      function getControl(key) { return ctl[key]; }

      function setOperatingPoint(y) {
        y = clamp(num(y, 0), 0, 100);
        y = Math.min(y, ctl.ymax);
        ctl.mode = 'hand'; ctl.yHand = y; userHand = false;
        P.setOp(y);
        xPrev = P.xPct(); se.reset(xPrev); xm = xPrev; yLast = y; yPrevS = y;
        ws = toPct(ctl.w);
        buildCtrl(false); ctrl.bumpless(y, ws, xm);
        tHi = tLo = tWind = 0; nJ = 0; jv = 0; osc = { cls: 'aperiodisch' }; settled = false; act = []; prevAct = {};
        return true;
      }
      function steady(y, z) { return P.steady(clamp(num(y, 0), 0, 100), z === undefined ? ctl.z : num(z, ctl.z)); }
      function applyPreset(id) {
        const p = (def.presets || []).find(q => q.id === id); if (!p) return false;
        def.controls.forEach(c => { ctl[c.key] = c.value; }); userHand = false;
        const prm = Object.assign({}, p.params);
        const wantMode = prm.mode || 'auto'; delete prm.mode;
        Object.keys(prm).forEach(kk => { const r = validate(kk, prm[kk]); if (r.ok) ctl[kk] = r.v; });
        if (P.onControl) P.onControl('*', null);
        se.setNoise(ctl.noise);
        buildCtrl(false);
        if (p.op) {
          const yy = p.op.y !== undefined ? p.op.y : P.yFor(p.op.x, ctl.z);
          setOperatingPoint(yy);
          if (wantMode === 'auto') {
            // Start in Automatik aus dem Beharrungszustand: I-Anteile uebernehmen y (stossfrei), bei P/PD gilt der Steuerwert u0
            ctl.mode = 'auto'; buildCtrl(false); if (sizeOfI()) ctrl.bumpless(yLast, ws, xm);
          }
        } else { ctl.mode = wantMode; if (wantMode === 'hand') ctl.yHand = Math.min(ctl.yHand, ctl.ymax); }
        if (p.then) Object.keys(p.then).forEach(kk => setControl(kk, p.then[kk]));
        return true;
      }
      function initState() {
        k = 0; acc = 0; t = 0; ev.length = 0; throttled = false;
        se = CORE.sensor({ T: num(params.sensorTau, def.sensorTau), noise: ctl.noise, seed: num(opts.seed, 1) });
        P.reset();
        ws = toPct(ctl.w); xPrev = P.xPct(); se.reset(xPrev); xm = xPrev;
        userHand = false;
        yLast = ctl.mode === 'hand' ? Math.min(ctl.yHand, ctl.ymax) : def.yInit;
        if (ctl.mode === 'auto') ctl.yHand = yLast;
        yPrevS = yLast;
        buildCtrl(false); ctrl.reset();
        if (ctl.mode === 'hand') ctrl.bumpless(yLast, ws, xm);
        tHi = tLo = tWind = 0; nJ = 0; jv = 0; osc = { cls: 'aperiodisch' }; settled = false; act = []; prevAct = {};
        abCache = { key: '', loss: null, n: 0 };
        resetTrace(); record();
      }

      // ---- Kennlinien-Huelle ----
      function stepCurve() {
        const blocks = P.lin();
        let T = 0; blocks.forEach(b => { if (b.t === 'PT1') T += b.T; else if (b.t === 'PT2') T += 2 * b.D / b.w0 + 1 / b.w0; else if (b.t === 'Tt') T += b.Tt; });
        const tEnd = Math.max(10 * h, 5 * T), pts = [];
        if (CORE.stepResponse) {
          const r = CORE.stepResponse(blocks, tEnd, Math.max(h, tEnd / 600));
          if (r && Array.isArray(r.t) && Array.isArray(r.x)) for (let i = 0; i < r.t.length; i += Math.max(1, Math.floor(r.t.length / 120))) if (isFinite(r.t[i]) && isFinite(r.x[i])) pts.push([+r.t[i].toFixed(4), +r.x[i].toFixed(5)]);
        }
        return { id: 'modell-sprung', title: 'Modell-Sprungantwort (linearisiert, gestrichelt)', xLabel: 'Prozesszeit', xUnit: 's', yLabel: 'Änderung der Regelgröße je 1 % Stellgröße', yUnit: '%', dashed: true,
          series: [{ name: 'Modell aus linBlocks', points: pts }], marker: { x: 0, y: 0 } };
      }
      function curves() { return P.curves().concat([stepCurve()]); }

      // ---- Zeichnen ----
      const W = def.world;
      let drawError = null;
      function view() {
        return { t: t, ws: fromPct(ws), x: fromPct(P.xPct()), xm: fromPct(xm), y: yLast, z: ctl.z === undefined ? 0 : ctl.z, mode: ctl.mode, ctrl: ctl.ctrl, kp: ctl.kp, tn: ctl.tn, tv: ctl.tv,
          dir: ctl.dir, ymax: ctl.ymax, e: dirS() * (ws - P.xPct()) / 100 * span, faults: act.map(d => d.id), osc: osc.cls, range: def.range, trace: trace, ctl: ctl, analysis: analysis };
      }
      function draw(ctx, w, hh, tms) {
        if (!ctx || !(w > 0) || !(hh > 0) || !isFinite(w) || !isFinite(hh)) return;
        tms = num(tms, 0);
        try {
          const s = Math.min(w / W.w, hh / W.h);
          ctx.save();
          ctx.fillStyle = '#14181c'; ctx.fillRect(0, 0, w, hh);
          ctx.translate((w - W.w * s) / 2, (hh - W.h * s) / 2); ctx.scale(s, s);
          P.draw(ctx, W.w, W.h, tms, view(), opts.noDraw ? null : getDraw());
          ctx.restore();
        } catch (e) { drawError = e && e.message ? String(e.message) : 'Fehler'; try { ctx.restore(); } catch (e2) { /* ignorieren */ } }
      }
      function hitTest(px, py, w, hh) {
        px = num(px, NaN); py = num(py, NaN); w = num(w, NaN); hh = num(hh, NaN);
        if (!isFinite(px) || !isFinite(py) || !(w > 0) || !(hh > 0)) return null;
        const s = Math.min(w / W.w, hh / W.h), x = (px - (w - W.w * s) / 2) / s, y = (py - (hh - W.h * s) / 2) / s;
        const r = P.hit ? P.hit(x, y) : null;
        if (!r) return null;
        if (r.to !== undefined) { /* vom Pruefstand vorgegeben */ }
        else if (r.key === 'mode') r.to = ctl.mode === 'hand' ? 'auto' : 'hand';
        else if (r.key === 'z' && def.boolKeys && def.boolKeys.z !== undefined) r.to = ctl.z > 0 ? 0 : def.boolKeys.z;
        return r;
      }

      initState();
      // Steuerwerte aus opts.controls (wie bei den Antriebs-Pruefstaenden), danach frischer Anfangszustand
      if (opts.controls && typeof opts.controls === 'object') {
        Object.keys(opts.controls).forEach(kk => { const r = validate(kk, opts.controls[kk]); if (r.ok) ctl[kk] = r.v; });
        if (P.onControl) P.onControl('*', null);
        initState();
      }

      return {
        id: def.id, range: Object.assign({}, def.range), timeScale: def.timeScale, tUnit: def.tUnit, h: h, controls: def.controls, meters: def.meters, presets: def.presets, events: ev,
        roles: Object.assign({}, def.roles), requiredDir: def.requiredDir, params: params, spanS: def.spanS,
        setControl, getControl, step, stepProcess, readMeters, state, draw, hitTest, curves, reset() { initState(); },
        trace, setOperatingPoint, steady, linBlocks(opY) { return P.lin(opY); }, analysis,
        identify() { return CORE.identify ? CORE.identify(P.lin()) : { ok: false, why: 'REG_CORE.identify fehlt.' }; },
        diagnose, applyPreset, worldSize() { return { w: W.w, h: W.h }; }, drawError() { return drawError; },
        yFor(x, z) { return P.yFor(x, z === undefined ? ctl.z : z); }
      };
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  Zeichenhilfen fuer die Szenen (zusammen mit REG_DRAW)
    // ---------------------------------------------------------------------------------------------------------------
    const COL = { bg: '#14181c', panel: '#222830', panel2: '#2c343e', line: '#38424d', fg: '#e8ecf0', mute: '#8d99a6', accent: '#3b9eff', ok: '#4cd964', warn: '#ffb340', danger: '#ff5c5c' };
    const gfx = {
      COL,
      box(ctx, x, y, w, h, fill, stroke, r) {
        r = Math.min(r === undefined ? 10 : r, w / 2, h / 2);
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
      },
      line(ctx, pts, col, wd, dash) {
        ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.strokeStyle = col; ctx.lineWidth = wd || 2; ctx.lineJoin = 'round';
        if (ctx.setLineDash) ctx.setLineDash(dash || []);
        ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      },
      placeholder(ctx, W, H, text) {
        ctx.fillStyle = COL.panel; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = COL.mute; ctx.font = '600 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text || 'Der Zeichenhelfer regdraw.js fehlt.', W / 2, H / 2);
      }
    };

    return { version: '1.0', clamp, num, fm, fn, controlSet, meterRows, makeRig, gfx, CTRL_LABEL, getCore, getDraw };
  })();

  const B = R.baseA;
  const clamp = B.clamp, num = B.num, fm = B.fm, fn = B.fn, G = B.gfx, COL = G.COL;

  // =====================================================================================================================
  //  Pruefstand 1: fuellstand (SPEC 4.7.1)
  // =====================================================================================================================
  const RANGE = { lo: 0, hi: 100, unit: 'cm', digits: 1 };
  const PAR = { A: 0.05, hmax: 1.0, Qmax: 2.0e-3, Tp: 2, c0: Math.SQRT2 * 1e-3, cz: 0.5 * Math.SQRT2 * 1e-3, c1: 2.0e-3, cz1: 1.0e-3, sensorTau: 1 };
  const LEER_CM = 0.5;
  const Z_SCHALT = 60;

  const CONTROLS = B.controlSet({
    range: RANGE, ctrls: ['P', 'I', 'PI', 'PD', 'PID', '2P'], ctrlDefault: 'P', kp: 2, tn: { min: 5, max: 500, step: 1, value: 60 }, tv: { max: 50, step: 0.5, value: 0 }, u0: 0,
    ta: [0.05, 0.2, 1, 5], hyst: { min: 0.5, max: 20, step: 0.5, value: 2 },
    w: { min: 5, max: 95, step: 0.5, value: 50, label: 'Sollfüllstand w' }, wRamp: { max: 5, step: 0.1 },
    extra: [
      { key: 'z', label: 'Entnahmeventil z', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'Anlage und Störung',
        help: 'Störgröße: Das Entnahmeventil am Tankboden. Je weiter es offen ist, desto mehr läuft ab. Tippe auf das Handrad im Bild, um es zu öffnen oder zu schließen.' },
      { key: 'outflow', label: 'Abfluss', type: 'select', value: 'sqrt', options: [{ value: 'sqrt', label: 'Düse (√-Auslauf)' }, { value: 'lin', label: 'Kapillare (laminar, linear)' }], group: 'Anlage und Störung',
        help: 'Düse: Der Abfluss wächst mit der Wurzel des Füllstands, die Strecke ist nichtlinear. Kapillare: Der Abfluss wächst linear mit dem Füllstand.' }
    ]
  });
  const mr = B.meterRows(RANGE);
  const METERS = [
    { key: 'level', label: 'Füllstand h', unit: 'cm', digits: 1, min: 0, max: 100, warnAbove: 98 }, mr.w, mr.e, mr.y,
    { key: 'qIn', label: 'Zufluss Pumpe', unit: 'L/s', digits: 2, min: 0, max: 2 },
    { key: 'qOut', label: 'Abfluss', unit: 'L/s', digits: 2, min: 0, max: 2 },
    { key: 'volume', label: 'Volumen', unit: 'L', digits: 1, min: 0, max: 50 }
  ];
  function mkPreset(id, name, params, op, then) { return { id, name, params, op, then }; }
  const PRESETS = (function () {
    const pP = { mode: 'auto', ctrl: 'P', kp: 10, w: 40 };
    const pPI = { mode: 'auto', ctrl: 'PI', kp: 3, tn: 60, w: 40 };
    const pEnt = { mode: 'auto', ctrl: 'PI', kp: 3, tn: 60, w: 50 };
    const pWind = { mode: 'auto', ctrl: 'PI', kp: 3, tn: 60, ymax: 60, aw: 'aus', w: 80 };
    return [
      mkPreset('normal', 'Normalbetrieb (Hand, y = 50 %, eingeschwungen)', { mode: 'hand', yHand: 50, w: 50 }, { y: 50 }),
      mkPreset('p-regler', 'P-Regler (Kp = ' + fn(pP.kp, 0) + ', Soll ' + fn(pP.w, 0) + ' cm)', pP, { y: 50 }),
      mkPreset('pi-regler', 'PI-Regler (Kp = ' + fn(pPI.kp, 0) + ', Tn = ' + fn(pPI.tn, 0) + ' s, Soll ' + fn(pPI.w, 0) + ' cm)', pPI, { y: 50 }),
      mkPreset('entnahme', 'Entnahme offen (z = ' + fn(Z_SCHALT, 0) + ' %)', pEnt, { y: 50 }, { z: Z_SCHALT }),
      mkPreset('windup', 'Windup-Test (PI, ymax = ' + fn(pWind.ymax, 0) + ' %, Anti-Windup aus, Sprung 30 → ' + fn(pWind.w, 0) + ' cm)', pWind, { x: 30 }),
      mkPreset('kapillare', 'Kapillare statt Düse (Hand, y = 50 %)', { mode: 'hand', yHand: 50, w: 50, outflow: 'lin' }, { y: 50 })
    ];
  })();

  function plantFuell(P0) {
    const ctl = P0.ctl, p = P0.params, h = P0.h, say = P0.say;
    const CORE = P0.CORE, pumpLag = CORE.lag(p.Tp, h);
    let hh = 0, ya = 0, qp = 0, qa = 0, ovf = false, tEmpty = 0;
    const cOf = z => ctl.outflow === 'lin' ? p.c1 + p.cz1 * z / 100 : p.c0 + p.cz * z / 100;
    const qaOf = (hv, z) => ctl.outflow === 'lin' ? cOf(z) * Math.max(hv, 0) : cOf(z) * Math.sqrt(Math.max(hv, 0));
    const steadyM = (y, z) => { const Q = p.Qmax * y / 100, c = cOf(z); return ctl.outflow === 'lin' ? Q / c : (Q / c) * (Q / c); };
    const vis = { t: -1, rot: 0, pIn: 0, pOut: 0 };
    function lin(opY) {
      const z = ctl.z;
      const h0 = clamp(opY === undefined ? hh : Math.min(steadyM(clamp(num(opY, 0), 0, 100), z), p.hmax), 0.02, p.hmax);
      const c = cOf(z), rangeM = (RANGE.hi - RANGE.lo) / 100;
      const gm = ctl.outflow === 'lin' ? 1 / c : 2 * Math.sqrt(h0) / c;
      const T = ctl.outflow === 'lin' ? p.A / c : 2 * p.A * Math.sqrt(h0) / c;
      const Ks = gm * p.Qmax / rangeM;
      const b = [{ t: 'K', K: Ks }, { t: 'PT1', T: T }, { t: 'PT1', T: p.Tp }];
      if (p.sensorTau > 0) b.push({ t: 'PT1', T: p.sensorTau });
      return b;
    }
    const linAtH = (h0) => { const sv = hh; hh = h0; const b = lin(); hh = sv; return b; };
    return {
      q() { return 0; },
      reset() { pumpLag.reset(0); hh = 0; ya = 0; qp = 0; qa = 0; ovf = false; tEmpty = 0; },
      setOp(y) { pumpLag.reset(y); ya = y; qp = p.Qmax * ya / 100; hh = Math.min(steadyM(y, ctl.z), p.hmax); qa = qaOf(hh, ctl.z); ovf = hh >= p.hmax - 1e-9 && qp > qaOf(p.hmax, ctl.z); },
      step(y) {
        ya = pumpLag.step(y); qp = p.Qmax * ya / 100;
        const z = ctl.z;
        let hn = CORE.rk4((hv, u) => (u - qaOf(hv, z)) / p.A, hh, qp, h);
        if (!(hn > 0)) hn = 0;
        ovf = false;
        if (hn >= p.hmax) { hn = p.hmax; ovf = qp > qaOf(p.hmax, z); }
        hh = hn; qa = qaOf(hh, z);
      },
      xPct() { return hh / p.hmax * 100; },
      steady(y, z) { return Math.min(steadyM(y, z), p.hmax) * 100; },
      yFor(xCm, z) { const hm = clamp(num(xCm, 0), 0, 100) / 100, c = cOf(z === undefined ? ctl.z : z); return clamp(ctl.outflow === 'lin' ? 100 * c * hm / p.Qmax : 100 * c * Math.sqrt(hm) / p.Qmax, 0, 100); },
      lin,
      meters() { return { level: hh * 100, qIn: qp * 1000, qOut: qa * 1000, volume: 1000 * p.A * hh }; },
      extra() { return { pump: ya }; },
      state() { return { level: hh * 100, qIn: qp * 1000, qOut: qa * 1000, volume: 1000 * p.A * hh, pump: ya, overflow: ovf, empty: hh * 100 < LEER_CM, outflow: ctl.outflow, tank: { A: p.A, hmax: p.hmax, Qmax: p.Qmax } }; },
      diag(a) {
        const out = [];
        tEmpty = hh * 100 < LEER_CM ? tEmpty + a.dtE : 0;
        if (ovf) out.push({ id: 'ueberlauf', kind: 'error', text: 'Überlauf! Der Füllstand erreicht den Tankrand (' + fn(p.hmax * 100, 0) + ' cm). Die Pumpe fördert ' + fm(qp * 1000, 2) + ' L/s, es laufen nur ' + fm(qaOf(p.hmax, ctl.z) * 1000, 2) + ' L/s ab. Verkleinere die Stellgröße oder öffne das Entnahmeventil.', fx: 'splash' });
        if (tEmpty >= a.tHold) out.push({ id: 'leer', kind: 'warn', text: 'Der Tank ist leer (Füllstand unter ' + fn(LEER_CM, 1) + ' cm). Erhöhe die Stellgröße, damit die Pumpe wieder Wasser fördert.' });
        return out;
      },
      curves() {
        const z = ctl.z, ys = [], y0 = [], hs = [], Ts = [], Kss = [];
        for (let y = 0; y <= 100.001; y += 2) { ys.push([y, +(Math.min(steadyM(y, z), p.hmax) * 100).toFixed(3)]); y0.push([y, +(Math.min(steadyM(y, 0), p.hmax) * 100).toFixed(3)]); }
        for (let c = 2; c <= 100.001; c += 2) { const b = linAtH(c / 100); hs.push([c, b[0].K]); Ts.push([c, b[1].T]); }
        Kss.push(...hs);
        const cur = lin(), hNow = hh * 100;
        return [
          { id: 'statisch', title: 'Statische Kennlinie: Füllstand über Stellgröße', xLabel: 'Stellgröße y', xUnit: '%', yLabel: 'Füllstand im Beharrungszustand', yUnit: 'cm',
            series: [{ name: 'bei aktuellem z', points: ys }, { name: 'ohne Entnahme (z = 0)', points: y0 }], marker: { x: ya, y: hNow } },
          { id: 'zeitkonstante', title: 'Zeitkonstante T über dem Füllstand (Arbeitspunktabhängigkeit)', xLabel: 'Füllstand h0', xUnit: 'cm', yLabel: 'Zeitkonstante T', yUnit: 's',
            series: [{ name: 'T(h0)', points: Ts }], marker: { x: clamp(hNow, 2, 100), y: cur[1].T } },
          { id: 'verstaerkung', title: 'Streckenverstärkung Ks über dem Füllstand', xLabel: 'Füllstand h0', xUnit: 'cm', yLabel: 'Streckenverstärkung Ks', yUnit: '%/%',
            series: [{ name: 'Ks(h0)', points: Kss }], marker: { x: clamp(hNow, 2, 100), y: cur[0].K } }
        ];
      },
      hit(x, y) {
        if (x >= 685 && x <= 755 && y >= 395 && y <= 500) return { key: 'z', kind: 'switch' };
        if (Math.hypot(x - 200, y - 505) <= 44 || (x >= 700 && x <= 980 && y >= 300 && y <= 345)) return { key: 'mode', kind: 'switch' };
        return null;
      },
      draw(ctx, W, H, tms, V, D) {
        if (!D) { G.placeholder(ctx, W, H); return; }
        const dt = tms < vis.t || vis.t < 0 ? 0 : clamp(tms - vis.t, 0, 100); vis.t = tms;
        const fIn = clamp(qp / p.Qmax, 0, 1), fOut = clamp(qa / p.Qmax, 0, 1);
        vis.rot += dt * (ya / 100) * 0.012; vis.pIn += dt * fIn * 0.05; vis.pOut += dt * fOut * 0.05;
        const L = (s, x, y, o) => D.label(ctx, s, x, y, o);
        const frac = hh / p.hmax, sp = clamp((V.ws - RANGE.lo) / (RANGE.hi - RANGE.lo), 0, 1);
        L('Füllstandsregelung (Übungsanlage)', 20, 26, { align: 'left', size: 20, bold: true });
        L('Tank ' + fm(p.A, 2) + ' m², Pumpe bis ' + fm(p.Qmax * 1000, 1) + ' L/s, ' + (ctl.outflow === 'lin' ? 'Kapillare' : 'Düse') + ' am Tankboden', 20, 50, { align: 'left', size: 13, color: COL.mute });
        // Rohre
        D.pipe(ctx, [[108, 505], [168, 505]], { flow: fIn, phase: vis.pIn, width: 14 });
        D.pipe(ctx, [[224, 462], [224, 420], [330, 420], [330, 70], [470, 70], [470, 170]], { flow: fIn, phase: vis.pIn, width: 14 });
        D.pipe(ctx, [[626, 470], [720, 470], [800, 470], [800, 600], [990, 600]], { flow: fOut, phase: vis.pOut, width: 14 });
        // Vorlage, Tank, Pumpe, Ventil
        D.tank(ctx, 20, 440, 90, 120, { level: 0.8, ticks: false });
        L('Vorlage', 65, 575, { size: 12, color: COL.mute });
        D.tank(ctx, 400, 110, 230, 380, { level: frac, wave: tms * 0.004, overflow: ovf, setpoint: sp });
        D.pump(ctx, 200, 505, { size: 64, rot: vis.rot });
        L('Pumpe', 200, 550, { size: 13, color: COL.mute });
        D.valve(ctx, 720, 470, { kind: 'hand', open: ctl.z / 100, size: 56 });
        L('Entnahmeventil', 720, 520, { size: 13, color: COL.mute });
        L('z = ' + fn(ctl.z, 0) + ' %', 720, 538, { size: 13, bold: true });
        L('(tippen)', 720, 553, { size: 11, color: COL.mute });
        // Bläschen bei Zufluss
        if (fIn > 0.02) for (let i = 0; i < 6; i++) { const ph = ((tms * 0.0006 * (0.6 + i * 0.13) + i * 0.37) % 1), bx = 440 + ((i * 53) % 150), top = 482 - 372 * frac; const by = 482 - ph * Math.max(0, 482 - top - 4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, 6.2832); ctx.fill(); }
        // Drucksensor und Messwert
        ctx.fillStyle = COL.panel2; ctx.strokeStyle = COL.ok; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(400, 450, 10, 0, 6.2832); ctx.fill(); ctx.stroke();
        L('Drucksensor', 360, 474, { size: 12, color: COL.mute });
        L('x = ' + fm(V.xm, 1) + ' cm', 360, 490, { size: 12, bold: true, color: COL.ok });
        // Regler und Signale
        G.box(ctx, 60, 170, 235, 150, COL.panel, COL.line);
        L('Regler', 80, 192, { align: 'left', size: 16, bold: true });
        L(B.CTRL_LABEL[V.ctrl] || V.ctrl, 80, 214, { align: 'left', size: 13, color: COL.accent });
        L('Sollwert w = ' + fm(V.ws, 1) + ' cm', 80, 240, { align: 'left', size: 13 });
        L('Regeldifferenz e = ' + fm(V.e, 1) + ' cm', 80, 262, { align: 'left', size: 13 });
        L(V.mode === 'hand' ? 'HAND: Regler folgt nur' : 'Kp = ' + fn(V.kp, 1) + (V.ctrl === 'PI' || V.ctrl === 'PID' || V.ctrl === 'I' ? ', Tn = ' + fn(V.tn, 0) + ' s' : ''), 80, 290, { align: 'left', size: 12, color: COL.mute });
        G.line(ctx, [[400, 450], [360, 450], [360, 245], [304, 245]], COL.ok, 2, [6, 4]);
        D.arrow(ctx, 312, 245, 296, 245, { head: 9, color: COL.ok, width: 2 });
        G.line(ctx, [[176, 320], [176, 480]], COL.warn, 2, [6, 4]);
        D.arrow(ctx, 176, 468, 176, 486, { head: 9, color: COL.warn, width: 2 });
        L('y = ' + fm(V.y, 1) + ' %', 120, 400, { size: 13, bold: true, color: COL.warn });
        // Messwerte rechts
        G.box(ctx, 700, 24, 280, 270, COL.panel, COL.line);
        L('Prozesszeit t = ' + fn(V.t, 0) + ' s', 840, 44, { size: 12, color: COL.mute });
        D.gauge(ctx, 775, 130, 58, { value: V.x, lo: RANGE.lo, hi: RANGE.hi, setpoint: V.ws, unit: 'cm', digits: 1, warnFrom: 95 });
        D.gauge(ctx, 905, 130, 58, { value: V.y, lo: 0, hi: 100, unit: '%', digits: 0, warnFrom: Math.max(1, V.ymax - 0.5) });
        L('Füllstand', 775, 205, { size: 12, color: COL.mute }); L('Stellgröße', 905, 205, { size: 12, color: COL.mute });
        L('Zufluss ' + fm(qp * 1000, 2) + ' L/s', 720, 232, { align: 'left', size: 13 });
        L('Abfluss ' + fm(qa * 1000, 2) + ' L/s', 720, 254, { align: 'left', size: 13 });
        L('Volumen ' + fm(1000 * p.A * hh, 1) + ' L', 720, 276, { align: 'left', size: 13 });
        // Betriebsart (tippen)
        G.box(ctx, 700, 300, 280, 45, V.mode === 'hand' ? COL.warn : COL.ok, null, 22);
        L(V.mode === 'hand' ? 'HAND (antippen: Automatik)' : 'AUTOMATIK (antippen: Hand)', 840, 323, { size: 15, bold: true, color: '#10161c' });
        // Meldungen
        let my = 370; V.faults.slice(0, 3).forEach(id => { L('Meldung: ' + id, 710, my, { align: 'left', size: 12, color: COL.danger }); my += 18; });
        if (V.osc === 'dauerschwingung' && V.ctrl !== '2P') L('Der Kreis schwingt dauernd', 515, 90, { size: 14, bold: true, color: COL.warn, bg: 'rgba(0,0,0,0.5)' });
      }
    };
  }

  R.register({
    id: 'fuellstand', name: 'Füllstandsregelung', icon: '🛢️',
    info: 'Übungsanlage: Tank mit Pumpe und Entnahmeventil. Halte den Füllstand auf dem Sollwert, obwohl du das Entnahmeventil öffnest. Die Strecke ist nichtlinear (√-Auslauf): Zeitkonstante und Verstärkung hängen vom Füllstand ab.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) {
      return B.makeRig({
        id: 'fuellstand', range: RANGE, timeScale: 1, tUnit: 's', h: 0.05, spanS: 300, tHold: 20, oscWin: () => 120, sensorTau: PAR.sensorTau, yInit: 0, requiredDir: 'direkt', nonlinear: true,
        params: PAR, controls: CONTROLS, meters: METERS, presets: PRESETS, extraTrace: ['pump'], boolKeys: { z: Z_SCHALT }, world: { w: 1000, h: 640 },
        roles: { w: 'Sollfüllstand', x: 'Füllstand h', y: 'Pumpenleistung', z: 'Entnahmeventil', stell: 'Pumpe', mess: 'Drucksensor' },
        plant: plantFuell
      }, opts);
    }
  });

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
