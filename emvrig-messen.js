/* emvrig-messen.js - EMV-Lab, Pruefstaende tastkopf (Tastkopf am Oszilloskop) und vorpruef (Vorpruefung Entstoerung), Paket WP2d.
 *
 * Browser: NACH emvcore.js, emvcore-lay.js, emvdraw.js und emvrig-base.js laden. Node: holt emvrig-base.js (und der Kern) per require.
 * Beide Anlagen rechnen NUR mit EMV_CORE (Regel 7, keine zweite Formel): tastkopf mit EMV_CORE.meas.probe, vorpruef mit EMV_CORE.chain.lisn,
 * EMV_CORE.assess.conducted, EMV_CORE.meas.nearField, EMV_CORE.source.flyback, EMV_CORE.filter.leak. Alle Aufrufe des Kerns stehen gebuendelt
 * in den Funktionen `K.probe`, `K.lisn`, `K.near`, `K.flyback`, `K.leak`, `K.limitPts`, `K.ilCurve` (dort, und nur dort, ist bei einer anderen
 * Kern-Signatur anzupassen).
 *
 * STEUERWERTE (Anzeigeeinheiten, wie in SPEC 5.8/5.9 genannt):
 *   tastkopf: lead 'klemme'|'kurz'|'feder'; teiler 'x10'|'x1'; bwTk 60|100|200 (MHz); bwOsz 100|200|500 (MHz); rsrc (Ohm); trs (ns); amp (V);
 *             didt (A/us); dnear (mm); errReq (%).
 *   vorpruef: modus 'lisn'|'nahfeld'; klasse 'A'|'B'; rg 10|33|68|100 (Ohm); snub (Schalter); jitter (%); layout 'standard'|'optimiert';
 *             topo 'kein'|'C'|'LC'|'pi'; cx, cy (F, 0 = nicht bestueckt); drossel 'ohne'|'d1'|'d3'|'d10'|'d22'; ld (H, 0...500 uH); lead (m, 0...30 mm, wie emvrig-filter.js);
 *             nord (1|3|5|51|301); px, py (0...1, Sondenposition); budget (Punkte); leakReq (mA); pswReq (W).
 *   vorpruef: rig.fieldAt(x01, y01) -> relative Feldstaerke in dB (<= 0); rig.fieldGrid() -> { nx, ny, data (Float32Array dB relativ), max:{x01,y01,xmm,ymm} };
 *             rig.probeTo(x01, y01) setzt px und py zugleich; hitTest in der Nahfeldkarte liefert { key:'px', kind:'slider', to, set:{ px, py } } (Form wie emvui.js sie erwartet).
 * Uebungsanlage: Alle Zahlen sind Uebungswerte. Die Vorpruefung ersetzt keine Pruefung im akkreditierten Labor. Herstellerdokumentation und aktuelle Norm massgeblich.
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./emvrig-base.js'); } catch (e) { /* unten gemeldet */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('emvrig-messen.js: emvrig-base.js fehlt (im Browser vor dieser Datei laden); tastkopf und vorpruef werden nicht registriert.'); return; }
  const { clamp, num, fin, isNum, fm, fn, eng, okv, gfx } = B;
  const lg = Math.log10, PI = Math.PI;
  const TXT_NORM = 'Herstellerdokumentation und aktuelle Norm maßgeblich.';
  const G = { quelle: B.LEVERS.quelle.name, pfad: B.LEVERS.pfad.name, senke: B.LEVERS.senke.name, vorgabe: 'Anzeige und Vorgaben' };

  // =====================================================================================================================
  //  Zugriff auf den Kern (einzige Stelle mit den Signaturen von EMV_CORE)
  // =====================================================================================================================
  const K = {
    probe(CORE, c) {
      const r = CORE.meas.probe(c);
      if (!r || r.ok === false) return { ok: false, why: (r && r.why) || 'Der Tastkopf-Kern liefert kein Ergebnis.' };
      const arr = v => (Array.isArray(v) ? v : []);
      return { ok: isNum(r.zeta) && isNum(r.fr) && isNum(r.trMess), zeta: r.zeta, fr: r.fr, os: isNum(r.os) ? r.os : 0, osMeas: isNum(r.osMeas) ? r.osMeas : NaN, trMess: r.trMess, trFehler: isNum(r.trFehler) ? r.trFehler : NaN, trLoad: isNum(r.trLoad) ? r.trLoad : NaN,
        bw: isNum(r.bwSys) ? r.bwSys : (isNum(r.bw) ? r.bw : NaN), pick: isNum(r.pick) ? r.pick : 0, t: arr(r.t), vTrue: arr(r.vTrue), vMeas: arr(r.vMeas), valid: r.valid, why: r.why };
    },
    flyback(CORE, c) { const r = CORE.source.flyback(c); return r && r.ok !== false ? r : { ok: false, why: (r && r.why) || 'Die Quelle lässt sich nicht berechnen.' }; },
    lisn(CORE, srcCfg, fltCfg, klasse) {
      const cfg = Object.assign({}, srcCfg, { source: srcCfg, src: srcCfg, filter: fltCfg, klasse, fMax: srcCfg.fMax });
      const r = CORE.chain.lisn(cfg);
      if (!r || r.ok === false || !Array.isArray(r.lines)) return { ok: false, why: (r && r.why) || 'Die Netznachbildung lässt sich nicht berechnen.', lines: [] };
      return r;
    },
    leak(CORE, cy) {   // Ableitstrom in mA (der Kern liefert A; ein Wert ueber 0,05 wird als mA gelesen)
      let v = CORE.filter.leak({ cy, u: 230, f: 50 }); if (v && typeof v === 'object') v = v.value !== undefined ? v.value : v.i;
      if (!isNum(v)) return NaN; return Math.abs(v) > 0.05 ? v : v * 1000;
    },
    near(CORE, cfg, xmm, ymm) {   // Position in mm auf der 100 x 70 mm grossen Platine; Wert in dB relativ zum Maximum der Karte (<= 0)
      const r = CORE.meas.nearField(cfg, xmm, ymm), v = typeof r === 'number' ? r : (r && (isNum(r.db) ? r.db : NaN));
      return isNum(v) ? v : NaN;
    },
    nearGrid(CORE, cfg) { const g = CORE.meas.nearField.grid(cfg); return g && g.ok !== false && Array.isArray(g.db) ? g : null; },
    analyzer(CORE, lines, o) { try { const a = CORE.meas.analyzer(lines, o); return a && a.ok !== false ? a : null; } catch (e) { return null; } },
    limitPts(CORE, id, f0, f1, n) {   // Grenzlinie als Linienzug: Stuetzpunkte des Kerns (limits.pts), sonst ueber limits.at abgetastet
      if (typeof CORE.limits.pts === 'function') { const g = CORE.limits.pts(id); if (Array.isArray(g) && g.length > 1) return g.map(q => [q[0], q[1]]); }
      const pts = []; let prev = null;
      for (let i = 0; i <= n; i++) {
        const f = f0 * Math.pow(f1 / f0, i / n), v = CORE.limits.at(id, f);
        if (!isNum(v)) { prev = null; continue; }
        if (prev !== null && Math.abs(v - prev[1]) > 1.5 && Math.abs(v - prev[1]) > 2 * Math.abs(prev[2] || 0.0001)) { pts.push([prev[0] * 1.0001, prev[1]], [f * 0.9999, v]); }
        const slope = prev ? Math.abs(v - prev[1]) : 0;
        pts.push([f, v]); prev = [f, v, slope];
      }
      return pts;
    },
    ilCurve(CORE, fltCfg, fl) {   // Einfuegungsdaempfung GG und GT; fehlt ein Wert, bleibt die Reihe leer
      let c = null; try { c = CORE.filter.curve(fltCfg, fl); } catch (e) { c = null; }
      const take = (o, k) => (Array.isArray(o && o[k]) ? o[k].map(v => (isNum(v) ? v : (v && isNum(v.il) ? v.il : NaN))) : null);
      let gg = null, gt = null;
      if (c && !Array.isArray(c)) { gg = take(c, 'ggEff') || take(c, 'gg') || take(c, 'GG'); gt = take(c, 'gtEff') || take(c, 'gt') || take(c, 'GT'); }
      else if (Array.isArray(c) && c.length === fl.length && c[0] && typeof c[0] === 'object') { gg = c.map(q => (isNum(q.gg) ? q.gg : NaN)); gt = c.map(q => (isNum(q.gt) ? q.gt : NaN)); }
      return { gg: gg && gg.length === fl.length ? gg : null, gt: gt && gt.length === fl.length ? gt : null };
    }
  };

  // Hilfen fuer beide Anlagen ------------------------------------------------------------------------------------------
  const S2 = (v, d) => fm(v, d === undefined ? 1 : d);
  const ampWord = a => (B.AMP[a] ? B.AMP[a].name : '');
  function chipRow(ctx, x, y, w, chips, pal, o) {   // beschriftete Zahlenfelder (Zahlen stehen immer im Bild)
    o = o || {}; const n = chips.length; if (!n || !okv(x, y, w)) return 0;
    const per = o.perRow || n, rows = Math.ceil(n / per), gap = 6, ch = o.h || 36, cw = (w - gap * (per - 1)) / per;
    chips.forEach((c, i) => {
      const r = Math.floor(i / per), q = i % per, cx0 = x + q * (cw + gap), cy0 = y + r * (ch + gap);
      gfx.panel(ctx, cx0, cy0, cw, ch, pal.panel, c.col || pal.line, 7);
      if (c.col) { ctx.fillStyle = c.col; ctx.fillRect(cx0 + 1, cy0 + 6, 3, ch - 12); }
      gfx.text(ctx, c.label, cx0 + 9, cy0 + 13, { size: o.size - 1 || 11, color: pal.mute, max: cw - 12 });
      gfx.text(ctx, c.value, cx0 + 9, cy0 + ch - 9, { size: o.size || 12, bold: true, color: pal.fg, max: cw - 12 });
    });
    return rows * (ch + gap) - gap;
  }
  function arrowHead(ctx, x, y, ang, s, col) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * Math.cos(ang - 0.45), y - s * Math.sin(ang - 0.45)); ctx.lineTo(x - s * Math.cos(ang + 0.45), y - s * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function fieldMark(ctx, x, y, r, out, col, a) {   // Feld aus der Ebene (Punkt im Kreis) oder in die Ebene (Kreuz im Kreis)
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.stroke();
    ctx.beginPath();
    if (out) { ctx.arc(x, y, Math.max(1.4, r * 0.28), 0, PI * 2); ctx.fillStyle = col; ctx.fill(); }
    else { ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  const RF = { klemme: 150, kurz: 50, feder: 12 };   // Masseanschluss in mm (A23)
  const LEADNAME = { klemme: 'Masseklemme', kurz: 'kurze Klemme', feder: 'Federkontakt' };
  const CPF = { x10: 10e-12, x1: 100e-12 };          // Tastkopfeingangskapazitaet (A23)

  // Gemeinsame Zeichenbausteine: Chrome (Wirkungskette, Ampelzeile), Kopfbereich
  function head(ctx, w, h, view, sc, L) {
    const pal = sc.pal;
    if (L.chain && L.chain.w >= 220) gfx.chainBar(ctx, L.chain.x, L.chain.y, L.chain.w, L.chain.h, view.rig.chain, view.lever, { pal, size: sc.fs });
    const a = view.ampel;
    if (a) gfx.ampelRow(ctx, L.amp.x, L.amp.y + L.amp.h / 2, a, { pal, size: sc.fs + 1, max: L.amp.w });
  }

  // =====================================================================================================================
  //  tastkopf
  // =====================================================================================================================
  const TK = {
    id: 'tastkopf', name: 'Tastkopf am Oszilloskop', icon: '🔍',
    info: 'Du misst eine schnelle Flanke mit einem Tastkopf. Der Masseanschluss hat eine Induktivität, die mit der Eingangskapazität des Tastkopfs einen Schwingkreis bildet, und seine Schleife fängt das Störfeld eines Nachbarn ein. Sieh, wie Masseklemme und Federkontakt die Anzeige verfälschen. Übungsanlage: Alle Zahlen sind Übungswerte (' + TXT_NORM + ')',
    world: { w: 960, h: 600 },
    chain: { quelle: 'Signal und Nachbarstörer', pfad: 'Masseanschluss (L, Schleifenfläche)', senke: 'Oszilloskopeingang (Anzeige)', art: 'leitungsgebunden', kopplung: ['induktiv'] },
    noLever: ['errReq'],
    params: { amp0: 3.3, ghostAlpha: 0.3 },
    controls: [
      { key: 'lead', label: 'Masseanschluss', type: 'select', value: 'klemme', group: G.senke, lever: 'senke', options: [{ value: 'klemme', label: 'Masseklemme (150 mm)' }, { value: 'kurz', label: 'kurze Klemme (50 mm)' }, { value: 'feder', label: 'Federkontakt (12 mm)' }],
        help: 'Länge des Massewegs am Tastkopf: Masseklemme 150 mm, kurze Klemme 50 mm, Federkontakt 12 mm (Übungswerte, je 1 nH pro mm). Je länger, desto größer die Induktivität (Schwingneigung) und die Schleifenfläche (eingefangenes Störfeld).' },
      { key: 'teiler', label: 'Teilerverhältnis', type: 'select', value: 'x10', group: G.senke, lever: 'senke', options: [{ value: 'x10', label: '10:1 (10 pF)' }, { value: 'x1', label: '1:1 (100 pF)' }],
        help: 'Tastkopf 10:1 hat etwa 10 pF Eingangskapazität, 1:1 etwa 100 pF (Übungswerte). Die Kapazität bildet mit dem Masseanschluss den Schwingkreis und belastet die Quelle.' },
      { key: 'bwTk', label: 'Tastkopf-Bandbreite', type: 'select', value: 100, unit: 'MHz', group: G.senke, lever: 'senke', options: [{ value: 60, label: '60 MHz' }, { value: 100, label: '100 MHz' }, { value: 200, label: '200 MHz' }],
        help: 'Bandbreite des Tastkopfs. Die gemessene Anstiegszeit folgt aus der Quadratsumme von Signal, Tastkopf und Oszilloskop (tr = 0,35 / Bandbreite, Näherung).' },
      { key: 'bwOsz', label: 'Oszilloskop-Bandbreite', type: 'select', value: 200, unit: 'MHz', group: G.senke, lever: 'senke', options: [{ value: 100, label: '100 MHz' }, { value: 200, label: '200 MHz' }, { value: 500, label: '500 MHz' }],
        help: 'Bandbreite des Oszilloskops. Ein zu langsames Gerät rundet die Flanke ab und zeigt sie zu langsam an.' },
      { key: 'rsrc', label: 'Quellwiderstand', type: 'slider', min: 10, max: 500, step: 1, scale: 'log', unit: 'Ω', unitKind: 'res', value: 50, group: G.quelle, lever: 'quelle',
        help: 'Innenwiderstand der gemessenen Quelle. Ein kleiner Widerstand dämpft den Schwingkreis aus Masseanschluss und Tastkopfkapazität kaum (kleines ζ, großer Überschwinger).' },
      { key: 'trs', label: 'Flankenzeit des Signals', type: 'slider', min: 0.5, max: 50, step: 0.1, scale: 'log', unit: 'ns', value: 5, group: G.quelle, lever: 'quelle',
        help: 'Anstiegszeit der gemessenen Flanke (linear von 0 auf 100 %). Je schneller die Flanke, desto mehr Bandbreite braucht die Messung.' },
      { key: 'amp', label: 'Amplitude', type: 'slider', min: 0.1, max: 10, step: 0.1, unit: 'V', unitKind: 'volt', value: 3.3, group: G.quelle, lever: 'quelle',
        help: 'Spitzenwert des gemessenen Signals. Die eingefangene Störspannung wird gegen diese Amplitude bewertet.' },
      { key: 'didt', label: 'Störstromanstieg des Nachbarn', type: 'slider', min: 0, max: 100, step: 1, unit: 'A/µs', value: 10, group: G.quelle, lever: 'quelle',
        help: 'Stromanstieg dI/dt auf dem benachbarten Leiter (zum Beispiel Schaltstrom). Sein Magnetfeld induziert Spannung in der Masseschleife.' },
      { key: 'dnear', label: 'Abstand zum Nachbarn', type: 'slider', min: 10, max: 200, step: 1, unit: 'mm', value: 50, group: G.pfad, lever: 'pfad',
        help: 'Abstand der Messstelle zum Nachbarleiter. Je weiter weg, desto schwächer das Störfeld in der Masseschleife (u_pick = µ0 / (2π·d) · A · dI/dt).' },
      { key: 'errReq', label: 'Vorgabe Messfehler', type: 'slider', min: 2, max: 20, step: 1, unit: '%', unitKind: 'pct', value: 10, group: G.vorgabe,
        help: 'Vorgabe der Übung: Größter erlaubter Fehleranteil der Messung. Grün bis zur Hälfte, gelb bis zur Vorgabe, rot darüber.' }
    ],
    meters: [
      { key: 'os', label: 'Überschwinger (Sprung)', unit: '%', digits: 1, min: 0, max: 100, warnAbove: 10 },
      { key: 'fr', label: 'Resonanz Masseanschluss + Tastkopf', unit: 'MHz', digits: 0, min: 0, max: 1000 },
      { key: 'zeta', label: 'Dämpfung ζ', unit: '', digits: 2, min: 0, max: 2 },
      { key: 'trMess', label: 'gemessene Anstiegszeit', unit: 'ns', digits: 1, min: 0, max: 80 },
      { key: 'trFehler', label: 'Fehler der Anstiegszeit', unit: '%', digits: 1, min: 0, max: 200, warnAbove: 10 },
      { key: 'pick', label: 'eingefangene Störspannung', unit: 'mV', digits: 1, min: 0, max: 500, warnAbove: 50 },
      { key: 'bwSys', label: 'Systembandbreite', unit: 'MHz', digits: 0, min: 0, max: 500 }
    ],
    presets: [
      { id: 'klemme', name: 'Masseklemme', info: 'Langer Masseanschluss: starkes Überschwingen.', params: { lead: 'klemme', teiler: 'x10', bwTk: 100, bwOsz: 200 } },
      { id: 'feder', name: 'Federkontakt', info: 'Kürzester Masseweg: kaum Überschwingen, wenig Störfeld.', params: { lead: 'feder', teiler: 'x10', bwTk: 200, bwOsz: 500 } },
      { id: 'x1-lastet', name: '1:1-Tastkopf belastet', info: 'Der 1:1-Tastkopf hat 100 pF Eingangskapazität.', params: { lead: 'klemme', teiler: 'x1', bwTk: 60, bwOsz: 100 } },
      { id: 'pickup', name: 'Störfeld eingefangen', info: 'Starker Nachbar dicht am Messpunkt: Die Masseschleife fängt Störspannung ein.', params: { lead: 'klemme', teiler: 'x10', rsrc: 200, trs: 20, amp: 3.3, didt: 30, dnear: 20, bwTk: 200, bwOsz: 500 } },
      { id: 'schnell', name: 'Schnelle Flanke', info: 'Flanke von 1 ns: Die Bandbreite des Systems entscheidet.', params: { lead: 'feder', teiler: 'x10', trs: 1, bwTk: 200, bwOsz: 500 } }
    ],
    plant(P0) {
      const cache = { key: '', cv: null };
      const nameOf = id => ({ os: 'Überschwinger', tr: 'Anstiegszeit', pick: 'eingefangene Störspannung' }[id]);
      function cfgOf(ctl, over) {
        const leadMm = RF[ctl.lead] || 150, cp = CPF[ctl.teiler] || 10e-12;
        return Object.assign({ amp: ctl.amp, rsrc: ctl.rsrc, trs: ctl.trs * 1e-9, lead: leadMm * 1e-3, leadMm, lg: leadMm * 1e-9, cp, teiler: ctl.teiler, bwTk: ctl.bwTk * 1e6, bwOsz: ctl.bwOsz * 1e6, didt: ctl.didt * 1e6, d: ctl.dnear * 1e-3, dnear: ctl.dnear * 1e-3 }, over || {});
      }
      return {
        compute(ctl, params, CORE) {
          const cfg = cfgOf(ctl), pr = K.probe(CORE, cfg);
          if (!pr.ok) return { ok: false, why: pr.why, cfg };
          const osPct = pr.os * 100, trErr = isNum(pr.trFehler) ? pr.trFehler : (pr.trMess / (ctl.trs * 1e-9) - 1) * 100, pickPct = pr.pick / ctl.amp * 100;
          const comps = [{ id: 'os', v: osPct }, { id: 'tr', v: Math.max(0, trErr) }, { id: 'pick', v: pickPct }];
          const worst = comps.reduce((a, b) => (b.v > a.v ? b : a));
          let pk = -Infinity, ipk = 0; (pr.vMeas || []).forEach((v, i) => { if (v > pk) { pk = v; ipk = i; } });
          return { ok: true, cfg, pr, osPct, trErr, pickPct, comps, worst, peakV: isFinite(pk) ? pk : ctl.amp, peakT: pr.t[ipk] || 0, peakPct: isNum(pr.osMeas) ? pr.osMeas * 100 : (isFinite(pk) ? (pk / ctl.amp - 1) * 100 : 0), lgNh: cfg.leadMm };
        },
        meters(r, ctl) {
          if (!r.ok) return {};
          return { os: r.osPct, fr: r.pr.fr / 1e6, zeta: r.pr.zeta, trMess: r.pr.trMess * 1e9, trFehler: r.trErr, pick: r.pr.pick * 1e3, bwSys: isNum(r.pr.bw) ? r.pr.bw / 1e6 : 0 };
        },
        assess(r, ctl) {
          if (!r.ok) return { ok: false, ampel: 'grau', text: 'Die Messung lässt sich nicht berechnen: ' + (r.why || 'unbekannter Fehler') };
          const w = r.worst, req = ctl.errReq, marg = req - w.v;
          const list = r.comps.map(c => nameOf(c.id) + ' ' + S2(c.v) + ' %').join(', ');
          const ampel = w.v <= req / 2 ? 'gruen' : w.v <= req ? 'gelb' : 'rot';
          const head0 = ampel === 'gruen' ? 'Alle Fehleranteile liegen bei höchstens der Hälfte der Vorgabe (' + S2(req / 2) + ' %): ' : ampel === 'gelb' ? 'Größter Fehleranteil ' + nameOf(w.id) + ' ' + S2(w.v) + ' % liegt zwischen der halben Vorgabe und der Vorgabe (' + S2(req) + ' %): ' : 'Größter Fehleranteil ' + nameOf(w.id) + ' ' + S2(w.v) + ' % liegt über der Vorgabe (' + S2(req) + ' %): ';
          return { ok: ampel !== 'rot', ampel, margin: marg, text: head0 + list + '.' };
        },
        diag(r, ctl) {
          if (!r.ok) return [{ id: 'tk-fehler', kind: 'error', text: 'Die Messung lässt sich nicht berechnen: ' + (r.why || '') }];
          const out = [], pr = r.pr, CORE = P0.CORE;
          let cd = []; try { cd = typeof CORE.diagnose === 'function' ? CORE.diagnose({ probe: { os: pr.os, lgH: r.cfg.lg, fr: pr.fr }, pick: { v: pr.pick, amp: ctl.amp } }) || [] : []; } catch (e) { cd = []; }
          cd.forEach(d => { if (d.id === 'tk-ring' || d.id === 'tk-pick') out.push(d); });   // Texte einzige Quelle: EMV_CORE.TEXTS
          if (pr.os > 0.1 && !cd.some(d => d.id === 'tk-ring')) out.push({ id: 'tk-ring-q', kind: 'warn', text: 'Der Masseanschluss (' + S2(r.lgNh, 0) + ' nH) schwingt mit der Tastkopfkapazität bei ' + S2(pr.fr / 1e6, 0) + ' MHz: Überschwinger ' + S2(r.osPct) + ' %. Der Quellwiderstand (' + S2(ctl.rsrc, 0) + ' Ω) dämpft zu wenig.' });
          if (r.trErr > 10) out.push({ id: 'tk-bw', kind: 'warn', text: 'Die Anzeige ist langsamer als das Signal: gemessene Anstiegszeit ' + S2(pr.trMess * 1e9) + ' ns gegen ' + S2(ctl.trs) + ' ns (Systembandbreite ' + S2(pr.bw / 1e6, 0) + ' MHz). Nimm schnellere Geräte.' });
          if (ctl.teiler === 'x1') out.push({ id: 'tk-last', kind: 'info', text: 'Der 1:1-Tastkopf hat 100 pF Eingangskapazität und belastet die Schaltung stärker als der 10:1-Tastkopf (10 pF)' + (isNum(pr.trLoad) ? ': Mit dem Quellwiderstand (' + S2(ctl.rsrc, 0) + ' Ω) bildet sie ein RC-Glied mit etwa ' + S2(pr.trLoad * 1e9) + ' ns Anstiegszeit (2,2·R·C), das in der gemessenen Anstiegszeit nicht mitgerechnet ist.' : '.') });
          return out;
        },
        curves(r, ctl) {
          const CORE = P0.CORE, key = JSON.stringify([ctl.teiler, ctl.rsrc, ctl.trs, ctl.amp, ctl.didt, ctl.dnear, ctl.bwTk, ctl.bwOsz, ctl.lead, ctl.errReq]);
          if (cache.key === key && cache.cv) return cache.cv;
          const cvs = [];
          const lens = []; for (let i = 0; i <= 20; i++) lens.push(5 * Math.pow(40, i / 20));   // 5 ... 200 mm
          const pts = lens.map(lm => { const p = K.probe(CORE, cfgOf(ctl, { lead: lm * 1e-3, leadMm: lm, lg: lm * 1e-9 })); return p.ok ? [lm, p.os * 100] : null; }).filter(Boolean);
          const leadMm = RF[ctl.lead] || 150;
          cvs.push({ id: 'os-lead', title: 'Überschwinger über der Länge des Masseanschlusses', xLabel: 'Länge des Masseanschlusses', xUnit: 'mm', xScale: 'log', yLabel: 'Überschwinger', yUnit: '%',
            series: [{ name: 'Überschwinger (Sprung)', points: pts }], marker: r.ok ? { x: leadMm, y: r.osPct, text: S2(r.osPct) + ' % bei ' + S2(leadMm, 0) + ' mm' } : undefined, limit: { y: ctl.errReq, name: 'Vorgabe ' + S2(ctl.errReq, 0) + ' %' } });
          const dl = []; for (let i = 0; i <= 12; i++) dl.push(10 * Math.pow(20, i / 12));
          const ser = ['klemme', 'kurz', 'feder'].map(k => ({ name: LEADNAME[k], points: dl.map(d => { const p = K.probe(CORE, cfgOf(ctl, { lead: RF[k] * 1e-3, leadMm: RF[k], lg: RF[k] * 1e-9, d: d * 1e-3, dnear: d * 1e-3 })); return p.ok ? [d, p.pick * 1e3] : null; }).filter(Boolean) }));
          cvs.push({ id: 'pick-d', title: 'Eingefangene Störspannung über dem Abstand zum Nachbarn', xLabel: 'Abstand zum Nachbarn', xUnit: 'mm', xScale: 'log', yLabel: 'Störspannung', yUnit: 'mV', series: ser, marker: r.ok ? { x: ctl.dnear, y: r.pr.pick * 1e3, text: S2(r.pr.pick * 1e3) + ' mV bei ' + S2(ctl.dnear, 0) + ' mm' } : undefined });
          const tl = []; for (let i = 0; i <= 14; i++) tl.push(0.5 * Math.pow(100, i / 14));
          const tm = tl.map(t => { const p = K.probe(CORE, cfgOf(ctl, { trs: t * 1e-9 })); return p.ok ? [t, p.trMess * 1e9] : null; }).filter(Boolean);
          cvs.push({ id: 'tr-sys', title: 'Gemessene Anstiegszeit über der Flankenzeit des Signals', xLabel: 'Flankenzeit des Signals', xUnit: 'ns', xScale: 'log', yLabel: 'gemessene Anstiegszeit', yUnit: 'ns',
            series: [{ name: 'Anzeige', points: tm }, { name: 'Signal (ideal)', points: tl.map(t => [t, t]) }], marker: r.ok ? { x: ctl.trs, y: r.pr.trMess * 1e9, text: S2(r.pr.trMess * 1e9) + ' ns' } : undefined });
          cache.key = key; cache.cv = cvs; return cvs;
        },
        waveform(r, ctl) {
          if (!r.ok) return { tUnit: 'ns', t: [0, 1], series: [{ name: 'wahres Signal', y: [0, 0], unit: 'V' }, { name: 'Anzeige', y: [0, 0], unit: 'V' }], marks: [] };
          const pr = r.pr, t = pr.t.map(v => v * 1e9);
          return { tUnit: 'ns', t, series: [{ name: 'wahres Signal', y: pr.vTrue.slice(), unit: 'V', dash: [6, 4] }, { name: 'Anzeige', y: pr.vMeas.slice(), unit: 'V' }], marks: [{ t: r.peakT * 1e9, text: 'Spitze ' + S2(r.peakV, 2) + ' V' }] };
        },
        phaseHz() { return 0.6; },
        hit(px, py, w, h, view) {
          const L = layTK(w, h), G = geoTK(L.board, view.ctl);
          if (px >= G.barrel.x0 - 6 && px <= G.barrel.x1 + 6 && py >= G.barrel.y0 - 6 && py <= G.barrel.y1 + 6) return { key: 'teiler', kind: 'select', to: view.ctl.teiler === 'x10' ? 'x1' : 'x10' };
          if (px >= G.xGP - 8 && px <= G.xTP + 8 && py >= G.yS - 6 && py <= G.yG + 12) { const o = ['klemme', 'kurz', 'feder'], i = o.indexOf(view.ctl.lead); return { key: 'lead', kind: 'select', to: o[(i + 1) % 3] }; }
          return null;
        },
        draw(ctx, w, h, t, view, sc) { drawTK(ctx, w, h, t, view, sc); }
      };
    }
  };

  // ---- Zeichnen tastkopf ----------------------------------------------------------------------------------------------
  function layTK(w, h) {
    const pad = w < 420 ? 8 : 12, narrow = w < 640;
    const chain = { x: pad, y: 8, w: w - 2 * pad, h: 46 }, amp = { x: pad, y: chain.y + chain.h + 8, w: w - 2 * pad, h: 30 };
    const top = amp.y + amp.h + 8, ah = Math.max(60, h - top - pad);
    const chipsH = narrow ? 2 * 36 + 6 : 36, chipsY = h - pad - chipsH;
    const ch = Math.max(60, chipsY - top - 8), aw = w - 2 * pad;
    let board, scope;
    if (!narrow) { const bw = Math.round(aw * 0.56); board = { x: pad, y: top, w: bw, h: ch }; scope = { x: pad + bw + 10, y: top, w: aw - bw - 10, h: ch }; }
    else { const bh = Math.round(ch * 0.52); board = { x: pad, y: top, w: aw, h: bh }; scope = { x: pad, y: top + bh + 8, w: aw, h: ch - bh - 8 }; }
    return { pad, narrow, chain, amp, board, scope, chips: { x: pad, y: chipsY, w: aw, h: chipsH, perRow: narrow ? 4 : 7 } };
  }
  function geoTK(b, ctl) {
    const lead = RF[ctl.lead] || 150, LM = 58, xTP = b.x + b.w * 0.66, sMM = Math.max(0.5, (xTP - (b.x + LM + 8)) / 150);
    const yS = b.y + b.h * 0.40, Wpx = clamp(b.h * 0.1, 26, 46), yG = yS + Wpx, xGP = xTP - lead * sMM;
    const t = Math.log(clamp(ctl.dnear, 10, 200) / 10) / Math.log(20), xN = Math.min(b.x + b.w - 14, xTP + (0.12 + 0.2 * t) * b.w);
    const xRing = xTP + 0.55 * Wpx, bl = Wpx + 78, x1 = xTP + 0.55 * bl, y1 = yS + bl;
    return { lead, xTP, yS, yG, Wpx, xGP, xN, sMM, xRing, barrel: { x0: Math.min(xTP, x1) - 6, x1: Math.max(xTP, x1) + 6, y0: yS, y1: y1 + 4, ex: x1, ey: y1 } };
  }
  function drawTK(ctx, w, h, t, view, sc) {
    const pal = sc.pal, L = layTK(w, h), ctl = view.ctl, r = view.res, ghost = !!sc.ghost && ctx.globalAlpha < 0.99, fs = sc.fs;
    if (!ghost) head(ctx, w, h, view, sc, L);
    const b = L.board, s = L.scope;
    drawBoardTK(ctx, b, view, sc, ghost, t);
    drawScopeTK(ctx, s, view, sc, ghost);
    if (!ghost && r.ok) {
      const rr0 = r.worst.id, col = id => (rr0 === id ? pal.rot : pal.line);
      const chips = [
        { label: 'Überschwinger', value: S2(r.osPct) + ' %', col: col('os') }, { label: 'Resonanz', value: S2(r.pr.fr / 1e6, 0) + ' MHz' }, { label: 'Dämpfung ζ', value: S2(r.pr.zeta, 2) },
        { label: 'Anstiegszeit', value: S2(r.pr.trMess * 1e9) + ' ns', col: col('tr') }, { label: 'Fehler Anstieg', value: S2(r.trErr) + ' %', col: col('tr') },
        { label: 'Störspannung', value: S2(r.pr.pick * 1e3) + ' mV', col: col('pick') }, { label: 'Bandbreite', value: S2(r.pr.bw / 1e6, 0) + ' MHz' }];
      chipRow(ctx, L.chips.x, L.chips.y, L.chips.w, chips, pal, { perRow: L.chips.perRow, size: fs, h: 36 });
    }
  }
  function drawBoardTK(ctx, b, view, sc, ghost, t) {
    if (b.w < 160 || b.h < 110) return;
    const pal = sc.pal, ctl = view.ctl, r = view.res, G = geoTK(b, ctl), fs = sc.fs, red = sc.reduced;
    const ph = view.phase, pulse = red ? 0.5 : 0.5 + 0.5 * Math.sin(ph * PI * 2);
    if (!ghost) {
      gfx.panel(ctx, b.x, b.y, b.w, b.h, null, pal.line, 10);
      // Bezugsmasse als Band
      ctx.fillStyle = pal.masse; ctx.globalAlpha = 0.16; ctx.fillRect(b.x + 6, G.yG + 8, b.w - 12, b.y + b.h - 8 - (G.yG + 8)); ctx.globalAlpha = 1;
      gfx.text(ctx, 'Bezugsmasse', b.x + 12, b.y + b.h - 14, { size: fs - 1, color: pal.masse, bg: pal.panel, max: b.w - 24 });
      // Quellkasten und Leiterbahn
      gfx.panel(ctx, b.x + 8, G.yS - 16, 46, 32, pal.panel2, pal.quelle, 6);
      gfx.text(ctx, 'Quelle', b.x + 31, G.yS + 4, { size: fs - 1, bold: true, color: pal.quelle, align: 'center', max: 42 });
    }
    // Leiterbahn
    gfx.line(ctx, [[b.x + 54, G.yS], [G.xTP + 12, G.yS]], ghost ? pal.mute : '#d9a05b', 4);
    if (!ghost) {
      ctx.beginPath(); ctx.arc(G.xTP, G.yS, 5, 0, PI * 2); ctx.fillStyle = pal.fg; ctx.fill();
      gfx.text(ctx, 'Messpunkt', G.xTP + 8, G.yS - 10, { size: fs - 1, color: pal.mute, bg: pal.panel });
    }
    // Schleifenflaeche: Trapez zwischen Leiterbahn und Masseleitung (Helligkeit steigt mit der eingefangenen Spannung)
    const pk = r.ok ? clamp(r.pickPct / 5, 0, 1.2) : 0;
    ctx.beginPath(); ctx.moveTo(G.xGP, G.yS); ctx.lineTo(G.xTP, G.yS); ctx.lineTo(G.xRing, G.yG); ctx.lineTo(G.xGP, G.yG); ctx.closePath();
    const A0 = ctx.globalAlpha; ctx.globalAlpha = A0 * (ghost ? 0.5 : clamp(0.12 + 0.3 * pk + 0.08 * pulse, 0, 0.6)); ctx.fillStyle = ghost ? pal.mute : pal.hfeld; ctx.fill(); ctx.globalAlpha = A0;
    ctx.strokeStyle = ghost ? pal.mute : pal.hfeld; ctx.lineWidth = 1.5; ctx.setLineDash && ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
    // Masseleitung (Draht) mit Anschlusspunkt
    gfx.line(ctx, [[G.xRing, G.yG], [G.xGP, G.yG]], ghost ? pal.mute : pal.masse, 3);
    // Tastkopf (Barrel von der Spitze schraeg nach rechts unten)
    const bd = G.barrel, ang = Math.atan2(bd.ey - G.yS, bd.ex - G.xTP), nx = -Math.sin(ang) * 8, ny = Math.cos(ang) * 8;
    ctx.beginPath(); ctx.moveTo(G.xTP + nx, G.yS + ny); ctx.lineTo(bd.ex + nx, bd.ey + ny); ctx.lineTo(bd.ex - nx, bd.ey - ny); ctx.lineTo(G.xTP - nx, G.yS - ny); ctx.closePath();
    ctx.fillStyle = ghost ? pal.mute : pal.panel2; ctx.fill(); ctx.strokeStyle = ghost ? pal.mute : (ctl.teiler === 'x1' ? pal.hfeld : pal.senke); ctx.lineWidth = 2; ctx.stroke();
    if (!ghost) {
      gfx.dot(ctx, G.xGP, G.yG, 4.5, pal.masse); gfx.dot(ctx, G.xRing, G.yG, 3.5, pal.fg);
      gfx.text(ctx, 'Masseanschluss ' + S2(G.lead, 0) + ' mm' + (r.ok ? ' · ' + S2(r.lgNh, 0) + ' nH' : ''), (G.xGP + G.xTP) / 2, G.yG + 22, { size: fs, bold: true, color: pal.masse, bg: pal.panel, align: 'center', max: Math.max(80, G.xTP - G.xGP + 60) });
      gfx.text(ctx, 'Tastkopf ' + (ctl.teiler === 'x10' ? '10:1 · 10 pF' : '1:1 · 100 pF'), Math.min(b.x + b.w - 8, bd.ex + 10), Math.min(b.y + b.h - 36, bd.ey + 14), { size: fs - 1, bold: true, color: pal.senke, bg: pal.panel, align: bd.ex + 130 > b.x + b.w ? 'right' : 'left', max: b.w * 0.5 });
      // Nachbarleiter mit Stromteilchen und Feld (aus der Ebene links, in die Ebene rechts); Dichte folgt dI/dt
      const yTop = b.y + 46, yBot = b.y + b.h - 22, dd = clamp(ctl.didt / 100, 0, 1);
      gfx.line(ctx, [[G.xN, yBot], [G.xN, yTop]], pal.quelle, 4);
      const ps = sc.ps('nb', [{ pts: [[G.xN, yBot], [G.xN, yTop]], color: pal.quelle, rate: dd > 0 ? 0.2 + 0.8 * dd : 0, dir: 1, size: 3 }, { pts: [[b.x + 54, G.yS], [G.xTP + 8, G.yS]], color: pal.senke, rate: clamp(ctl.amp / 10, 0.15, 1), dir: 1, size: 3 }], { cap: 160, speed: 70 });
      ps.draw(ctx, { reduced: red, glow: sc.qp.glow });
      gfx.text(ctx, 'Nachbar: ' + S2(ctl.didt, 0) + ' A/µs · ' + S2(ctl.dnear, 0) + ' mm', Math.min(b.x + b.w - 8, G.xN + 8), b.y + b.h - 36, { size: fs - 1, bold: true, color: pal.quelle, bg: pal.panel, align: G.xN > b.x + b.w * 0.7 ? 'right' : 'left', max: b.w * 0.6 });
      if (ctl.didt > 0) {
        const K0 = sc.qp.fieldLines >= 24 ? 6 : sc.qp.fieldLines >= 16 ? 4 : 3, gap = (G.xN - (G.xGP - 14)) / (K0 + 1), rowH = clamp((yBot - yTop) / 7, 20, 34);
        for (let k = 1; k <= K0; k++) {
          const xk = G.xN - k * gap, a0 = clamp(0.95 / (0.55 + k * 0.45), 0.15, 0.9) * (0.35 + 0.65 * dd) * (red ? 1 : 0.8 + 0.2 * Math.sin(ph * PI * 2 - k * 0.5));
          for (let y = yTop + rowH * 0.5; y < yBot; y += rowH) {
            const inLoop = xk >= G.xGP && xk <= G.xTP && y >= G.yS - 4 && y <= G.yG + 4;
            fieldMark(ctx, xk, y, inLoop ? 6.5 : 4.4, true, inLoop ? pal.hfeld : pal.efeld, inLoop ? Math.min(1, a0 + 0.35) : Math.min(1, a0 * 1.1));
          }
        }
        for (let k = 1; k <= 2; k++) for (let y = yTop + rowH * 0.5; y < yBot; y += rowH) fieldMark(ctx, G.xN + k * gap * 0.8, y, 4.2, false, pal.efeld, clamp(0.6 / k, 0.1, 0.6) * (0.35 + 0.65 * dd));
      }
      // Ersatzschaltbild des Messkreises
      const ex = b.x + 12, ey = b.y + 20;
      {
        const lbl = [['Rsrc ' + S2(ctl.rsrc, 0) + ' Ω', pal.quelle], ['Lg ' + (r.ok ? S2(r.lgNh, 0) : '–') + ' nH', pal.masse], ['Cp ' + (ctl.teiler === 'x10' ? '10' : '100') + ' pF', pal.senke]];
        if (b.w >= 420) {
          gfx.sym.res(ctx, ex, ey, 40, pal.quelle); gfx.sym.coil(ctx, ex + 104, ey, 44, pal.masse, 3); gfx.sym.cap(ctx, ex + 206, ey, 30, pal.senke, false);
          [0, 104, 206].forEach((dx, i) => gfx.text(ctx, lbl[i][0], ex + dx, ey + 18, { size: fs - 1, bold: true, color: lbl[i][1], bg: pal.panel, max: 96 }));
          gfx.text(ctx, 'Schwingkreis: fr ' + (r.ok ? S2(r.pr.fr / 1e6, 0) : '–') + ' MHz, ζ ' + (r.ok ? S2(r.pr.zeta, 2) : '–'), ex + 262, ey + 4, { size: fs - 1, color: pal.fg, bg: pal.panel, max: b.w - ex - 262 + b.x - 8 });
        } else gfx.text(ctx, lbl.map(q => q[0]).join(' · '), ex, ey, { size: fs - 1, bold: true, color: pal.fg, bg: pal.panel, max: b.w - 24 });
      }
    }
  }
  function drawScopeTK(ctx, s, view, sc, ghost) {
    if (s.w < 160 || s.h < 100) return;
    const pal = sc.pal, r = view.res, fs = sc.fs;
    const wv = view.rig.waveform(), lm = 44, rm = 10, tm = 26, bm = 30, px = s.x + lm, py = s.y + tm, pw = s.w - lm - rm, ph = s.h - tm - bm;
    if (!wv || !(pw > 60 && ph > 40)) return;
    let ta = Infinity, tb = -Infinity, yb = 0;
    wv.t.forEach(v => { if (v < ta) ta = v; if (v > tb) tb = v; }); wv.series.forEach(q => q.y.forEach(v => { if (v > yb) yb = v; }));
    yb = Math.max(yb * 1.1, 0.5); if (r.ok && r.pr.pick > 0.002 * (view.ctl.amp || 1)) yb = Math.max(yb, (yb / 1.1 + r.pr.pick) * 1.08); if (!(tb > ta)) { ta = 0; tb = 1; }
    const xp = v => px + (v - ta) / (tb - ta) * pw, yp = v => py + ph - clamp(v / yb, -0.1, 1.1) * ph;
    if (!ghost) {
      gfx.panel(ctx, s.x, s.y, s.w, s.h, null, pal.line, 10);
      if (s.w >= 440) gfx.text(ctx, 'Oszilloskop', s.x + 10, s.y + 17, { size: fs, bold: true, color: pal.fg });
      for (let i = 0; i <= 4; i++) { const yy = py + ph * i / 4, v = yb * (1 - i / 4); gfx.line(ctx, [[px, yy], [px + pw, yy]], pal.grid, 1); gfx.text(ctx, S2(v, v < 10 ? 1 : 0), px - 5, yy, { size: fs - 1, color: pal.mute, align: 'right', base: 'middle' }); }
      for (let i = 0; i <= 5; i++) { const xx = px + pw * i / 5, v = ta + (tb - ta) * i / 5; gfx.line(ctx, [[xx, py], [xx, py + ph]], pal.grid, 1); gfx.text(ctx, S2(v, 0), xx, py + ph + fs + 2, { size: fs - 1, color: pal.mute, align: 'center' }); }
      gfx.text(ctx, 'Zeit in ns', px + pw / 2, s.y + s.h - 4, { size: fs - 1, color: pal.mute, align: 'center' });
      ctx.save(); ctx.translate(s.x + 11, py + ph / 2); ctx.rotate(-PI / 2); gfx.text(ctx, 'Spannung in V', 0, 0, { size: fs - 1, color: pal.mute, align: 'center' }); ctx.restore();
    }
    const step = Math.max(2, Math.floor(wv.t.length / 130)), stepB = Math.max(4, Math.floor(wv.t.length / 48));
    wv.series.forEach((q, i) => {
      const pts = []; for (let k = 0; k < wv.t.length; k += step) pts.push([xp(wv.t[k]), yp(q.y[k])]);
      gfx.line(ctx, pts, ghost ? pal.mute : (i === 0 ? pal.quelle : pal.senke), i === 0 ? 2 : 2.8, i === 0 ? [6, 4] : []);
    });
    if (!ghost && r.ok && r.pr.pick > 0.002 * (view.ctl.amp || 1)) {
      const up = [], dn = [], pk = r.pr.pick; for (let k = 0; k < wv.t.length; k += stepB) { up.push([xp(wv.t[k]), yp(wv.series[1].y[k] + pk)]); dn.push([xp(wv.t[k]), yp(wv.series[1].y[k] - pk)]); }
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip(); ctx.beginPath(); up.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]); ctx.closePath();
      ctx.fillStyle = pal.hfeld; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
      gfx.text(ctx, '± ' + S2(pk * 1e3) + ' mV eingefangene Störspannung', px + pw - 6, py + ph - 8, { size: fs - 1, bold: true, color: pal.hfeld, bg: pal.panel, align: 'right', max: pw - 12 });
    }
    if (!ghost && r.ok) {
      const mx = xp(r.peakT * 1e9), my = yp(r.peakV);
      ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, PI * 2); ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.stroke();
      gfx.text(ctx, 'Spitze ' + S2(r.peakV, 2) + ' V (' + (r.peakPct >= 0 ? '+' : '−') + S2(Math.abs(r.peakPct)) + ' %)', clamp(mx + 8, px + 4, px + pw - 4), Math.max(py + fs + 4, my - 8), { size: fs - 1, bold: true, color: pal.fg, bg: pal.panel, align: mx > px + pw * 0.6 ? 'right' : 'left', max: pw * 0.7 });
      // Legende
      gfx.line(ctx, [[px + pw - 150, s.y + 14], [px + pw - 132, s.y + 14]], pal.quelle, 2, [6, 4]); gfx.text(ctx, 'wahres Signal', px + pw - 128, s.y + 14, { size: fs - 2, color: pal.mute, base: 'middle' });
      if (pw > 260) { gfx.line(ctx, [[px + pw - 330, s.y + 14], [px + pw - 312, s.y + 14]], pal.senke, 2.8); gfx.text(ctx, 'Anzeige', px + pw - 308, s.y + 14, { size: fs - 2, color: pal.mute, base: 'middle' }); }
    }
  }

  R.register({ id: TK.id, name: TK.name, icon: TK.icon, info: TK.info, controls: TK.controls, meters: TK.meters, presets: TK.presets, create(opts) { return B.makeRig(TK, opts); } });

  // =====================================================================================================================
  //  vorpruef
  // =====================================================================================================================
  // ---- Kosten in Uebungspunkten (A27): eine Tabelle fuer Rechnung und Anzeige ----
  const COST = {
    rg: { 10: 0, 33: 1, 68: 2, 100: 3 }, snub: 2, jitter: 3, layout: 4,
    cx: [[10e-9, 1], [47e-9, 1], [100e-9, 1], [330e-9, 2], [1e-6, 3]], cy: [[1e-9, 1], [2.2e-9, 1], [4.7e-9, 2]],
    topo: { kein: 0, C: 0, LC: 1, pi: 2 }, dr: { ohne: 0, d1: 3, d3: 4, d10: 6, d22: 8 }
  };
  const near1 = (tab, v) => { if (!(v > 0)) return 0; let best = 0, bd = Infinity; tab.forEach(q => { const d = Math.abs(Math.log(q[0] / v)); if (d < bd) { bd = d; best = q[1]; } }); return best; };
  function costItems(ctl) {   // [{ id, text, pts }]: Summe = Punkte
    const it = [], sh = ctl.topo !== 'kein';
    if (COST.rg[ctl.rg]) it.push({ id: 'rg', text: 'Rg ' + ctl.rg + ' Ω', pts: COST.rg[ctl.rg] });
    if (ctl.snub) it.push({ id: 'snub', text: 'Snubber', pts: COST.snub });
    if (ctl.jitter > 0) it.push({ id: 'jitter', text: 'Frequenzjitter', pts: COST.jitter });
    if (ctl.layout === 'optimiert') it.push({ id: 'layout', text: 'Layout optimiert', pts: COST.layout });
    if (COST.topo[ctl.topo]) it.push({ id: 'topo', text: 'Topologie ' + ctl.topo, pts: COST.topo[ctl.topo] });
    if (sh && ctl.cx > 0) it.push({ id: 'cx', text: 'Cx ' + eng(ctl.cx, 'F'), pts: near1(COST.cx, ctl.cx) });
    if (sh && ctl.cy > 0) it.push({ id: 'cy', text: 'Cy ' + eng(ctl.cy, 'F'), pts: near1(COST.cy, ctl.cy) });
    if (COST.dr[ctl.drossel]) it.push({ id: 'dr', text: 'Drossel ' + ctl.drossel, pts: COST.dr[ctl.drossel] });
    if (ctl.ld > 0) it.push({ id: 'ld', text: 'Differenzdrossel ' + S2(ctl.ld * 1e6, 0) + ' µH', pts: Math.ceil(ctl.ld / 100e-6 - 1e-6) });
    return it;
  }

  // ---- Konfiguration fuer den Kern ----
  function srcCfgVP(CORE, ctl, params) {
    const D = (CORE.source && CORE.source.defaults) || {}, c = Object.assign({}, D);
    const pct = !(D.duty <= 1.5);   // Prozent- oder Bruchwert-Konvention des Kerns aus den Standardwerten lesen
    c.rg = ctl.rg; c.jitter = pct ? ctl.jitter : ctl.jitter / 100; c.ferrit = false;
    const sn = D.snub && typeof D.snub === 'object' ? D.snub : {};
    c.snub = { on: !!ctl.snub, rs: sn.rs !== undefined ? sn.rs : 39, cs: sn.cs !== undefined ? sn.cs : 100e-12 };
    if (ctl.layout === 'optimiert') { c.cp = (isNum(D.cp) ? D.cp : 20e-12) * params.layoutFak; c.isw = (isNum(D.isw) ? D.isw : 0.5) * params.layoutFak; }
    c.fMax = params.fMax;
    return c;
  }
  const fltCfgVP = (ctl, params) => ({ topo: ctl.topo, cx: ctl.cx, cy: ctl.cy, drossel: ctl.drossel, ld: ctl.ld, lead: ctl.lead, ferrit: false, iLast: params.iLast });

  // ---- Nahfeldkarte: Cache nach den Werten, von denen die Karte abhaengt ----
  const NX = 40, NY = 28, BW = 100, BH = 70;
  const nearCache = new Map();
  function nearData(CORE, ctl, sc) {   // Karte, Maximum und Hot-Spots kommen aus EMV_CORE.meas.nearField.grid; sie haengt nur von Oberwelle, Layout und Snubber ab
    const key = [ctl.nord, ctl.snub ? 1 : 0, ctl.layout].join('|');
    const hit = nearCache.get(CORE); if (hit && hit.key === key) return hit.data;
    const cfg = Object.assign({}, sc, { source: sc, src: sc, n: ctl.nord, nord: ctl.nord, layout: ctl.layout, snub: !!ctl.snub });
    const g = K.nearGrid(CORE, cfg), data = new Float32Array(NX * NY), lev = new Uint8Array(NX * NY);
    if (!g) throw new Error('Die Nahfeldkarte lässt sich nicht berechnen.');
    let dmin = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const v = g.db[j] && isNum(g.db[j][i]) ? g.db[j][i] : -120; data[j * NX + i] = Math.min(0, Math.max(-120, v)); if (data[j * NX + i] < dmin) dmin = data[j * NX + i]; }
    const lo = clamp(Math.floor((dmin - 1) / 5) * 5, -40, -10);   // Farbumfang: Minimum der Karte, abgerundet auf 5 dB
    for (let i = 0; i < data.length; i++) lev[i] = Math.round(31 * clamp(1 - data[i] / lo, 0, 1));
    const mp = Array.isArray(g.maxAt) ? g.maxAt : [50, 35];
    const out = { key, cfg, data, lev, lo, max: { x01: mp[0] / BW, y01: mp[1] / BH, xmm: mp[0], ymm: mp[1], db: 0 }, spots: [] };
    out.spots = (g.hot || []).filter(q => q && isNum(q.x) && isNum(q.y)).map(q => ({ id: q.id, name: q.name || q.id, xmm: q.x, ymm: q.y, db: Math.min(0, isNum(q.db) ? q.db : -120) }));
    nearCache.set(CORE, { key, data: out }); return out;
  }
  function nearAt(CORE, ctl, sc, x01, y01) {
    const nd = nearData(CORE, ctl, sc), qx = clamp(x01, 0, 1), qy = clamp(y01, 0, 1);
    if (nd.q && nd.q.x === qx && nd.q.y === qy) return nd.q.v;   // gleiche Sondenposition im selben Bild: nicht noch einmal rechnen
    const v = K.near(CORE, nd.cfg, qx * BW, qy * BH), out = isNum(v) ? Math.min(0, Math.max(-120, v)) : -120;
    nd.q = { x: qx, y: qy, v: out }; return out;
  }
  const HEATC = [];
  (function () { const st = [[0, [10, 12, 22]], [0.3, [96, 42, 14]], [0.65, [250, 196, 30]], [1, [255, 255, 255]]]; for (let i = 0; i <= 31; i++) { const t = i / 31; let c = st[3][1]; for (let k = 1; k < st.length; k++) if (t <= st[k][0]) { const a = st[k - 1], b = st[k], u = (t - a[0]) / (b[0] - a[0]); c = [0, 1, 2].map(m => Math.round(a[1][m] + (b[1][m] - a[1][m]) * u)); break; } HEATC.push('rgb(' + c.join(',') + ')'); } })();

  const VP = {
    id: 'vorpruef', name: 'Vorprüfung Entstörung', icon: '🚦',
    info: 'Prüfling „Steckernetzteil“ an der Netznachbildung (LISN): Der Spektrumanalysator misst die Störspannung, die Nahfeldsonde sucht Hot-Spots. Entstöre mit Maßnahmen, die Übungspunkte kosten, und rechne gegen: Eine langsame Flanke senkt den Pegel, kostet aber Schaltverlust. Diese Vorprüfung ersetzt keine Prüfung im akkreditierten Labor. Übungsanlage: Alle Zahlen sind Übungswerte (' + TXT_NORM + ')',
    world: { w: 960, h: 640 },
    chain: { quelle: 'Schaltknoten des Steckernetzteils', pfad: 'Layout, Filter und Netzleitung', senke: 'Netznachbildung (LISN) und Analysator', art: 'leitungsgebunden', kopplung: ['galvanisch', 'kapazitiv', 'induktiv'] },
    noLever: ['modus', 'klasse', 'nord', 'px', 'py', 'budget', 'leakReq', 'pswReq'],
    params: { layoutFak: 0.5, iLast: 0.5, floor: 10, rbw: 9e3, fMin: 9e3, fMax: 30e6, noNear: false },   // noNear: nur Tests und Suchskripte (Nahfeld-Messgeraet nicht rechnen)
    controls: [
      { key: 'modus', label: 'Ansicht', type: 'select', value: 'lisn', group: G.vorgabe, options: [{ value: 'lisn', label: 'LISN-Spektrum' }, { value: 'nahfeld', label: 'Nahfeldkarte' }], help: 'Wechselt zwischen der Messung an der Netznachbildung (Spektrum gegen Grenzlinie) und der Nahfeldkarte der Platine (Hot-Spots).' },
      { key: 'klasse', label: 'Grenzlinie', type: 'select', value: 'B', group: G.vorgabe, options: [{ value: 'A', label: 'Klasse A (Übung)' }, { value: 'B', label: 'Klasse B (Übung)' }], help: 'Übungsgrenzlinie, angelehnt an die Klassen A und B der Fachgrundnormen (Wohnbereich strenger). ' + TXT_NORM },
      { key: 'rg', label: 'Gate-Widerstand', type: 'select', value: 10, unit: 'Ω', unitKind: 'res', group: G.quelle, lever: 'quelle', options: [{ value: 10, label: '10 Ω' }, { value: 33, label: '33 Ω' }, { value: 68, label: '68 Ω' }, { value: 100, label: '100 Ω' }],
        help: 'Ein größerer Gate-Widerstand verlangsamt die Flanke und senkt die Oberwellen. Er kostet Schaltverlust (Wirkungsgrad) und Übungspunkte.' },
      { key: 'snub', label: 'Snubber', type: 'switch', value: false, group: G.quelle, lever: 'quelle', help: 'RC-Glied am Schaltknoten: Es dämpft das Ringing der Schaltzelle, setzt aber selbst Leistung in Wärme um (Cs·U²·fs).' },
      { key: 'jitter', label: 'Frequenzjitter', type: 'slider', min: 0, max: 8, step: 0.5, unit: '%', unitKind: 'pct', value: 0, group: G.quelle, lever: 'quelle', help: 'Die Schaltfrequenz wird verteilt: Die Spitzen der Oberwellen werden breiter und niedriger (bei 9 kHz Auflösebandbreite).' },
      { key: 'layout', label: 'Layout', type: 'select', value: 'standard', group: G.quelle, lever: 'quelle', options: [{ value: 'standard', label: 'Standard' }, { value: 'optimiert', label: 'Hot-Loop optimiert' }], help: 'Ein kompaktes Layout verkleinert die Hot-Loop: Kapazität zum Gehäuse und Schaltstrom wirken nur noch halb (Übungsannahme).' },
      { key: 'topo', label: 'Filter-Topologie', type: 'select', value: 'kein', group: G.pfad, lever: 'pfad', options: [{ value: 'kein', label: 'kein Querzweig' }, { value: 'C', label: 'C' }, { value: 'LC', label: 'LC' }, { value: 'pi', label: 'π' }], help: 'Aufbau des Netzfilters: nur Reihenelemente, nur Querzweig (C), LC oder π (Querzweig, Reihenzweig, Querzweig).' },
      { key: 'cx', label: 'X-Kondensator', type: 'select', value: 100e-9, unit: 'F', unitKind: 'cap', group: G.pfad, lever: 'pfad', visible: st => st.topo !== 'kein', options: [{ value: 0, label: 'keiner' }, { value: 10e-9, label: '10 nF' }, { value: 47e-9, label: '47 nF' }, { value: 100e-9, label: '100 nF' }, { value: 330e-9, label: '330 nF' }, { value: 1e-6, label: '1 µF' }], help: 'Kondensator zwischen den Netzleitern (Gegentakt). Er wirkt nur mit einer Topologie mit Querzweig.' },
      { key: 'cy', label: 'Y-Kondensator', type: 'select', value: 2.2e-9, unit: 'F', unitKind: 'cap', group: G.pfad, lever: 'pfad', visible: st => st.topo !== 'kein', options: [{ value: 0, label: 'keiner' }, { value: 1e-9, label: '1 nF' }, { value: 2.2e-9, label: '2,2 nF' }, { value: 4.7e-9, label: '4,7 nF' }], help: 'Kondensator von jedem Netzleiter zum Schutzleiter (Gleichtakt). Größer dämpft mehr, erhöht aber den Ableitstrom.' },
      { key: 'drossel', label: 'Gleichtaktdrossel', type: 'select', value: 'ohne', group: G.pfad, lever: 'pfad', visible: st => st.topo !== 'C', options: [{ value: 'ohne', label: 'ohne' }, { value: 'd1', label: 'd1 (1 mH)' }, { value: 'd3', label: 'd3 (3,3 mH)' }, { value: 'd10', label: 'd10 (10 mH)' }, { value: 'd22', label: 'd22 (22 mH)' }], help: 'Gleichtaktdrossel (fiktive Übungsdrosseln): Mehr Induktivität dämpft tiefe Frequenzen, aber die Windungskapazität begrenzt die Wirkung bei hohen Frequenzen.' },
      { key: 'ld', label: 'Differenzdrossel', type: 'slider', min: 0, max: 500e-6, step: 10e-6, unit: 'H', unitKind: 'ind', value: 0, group: G.pfad, lever: 'pfad', visible: st => st.topo !== 'C', help: 'Zusätzliche Induktivität im Reihenzweig gegen die Gegentakt-Störung (Kosten: ein Punkt je 100 µH).' },
      { key: 'lead', label: 'Anschlusslänge der Kondensatoren', type: 'slider', min: 0, max: 0.03, step: 0.001, unit: 'm', unitKind: 'len', value: 0.015, group: G.pfad, lever: 'pfad', visible: st => st.topo !== 'kein', help: 'Kurze Anschlüsse haben wenig Induktivität (etwa 1 nH pro mm) und halten die Kondensatoren bei hohen Frequenzen wirksam.' },
      { key: 'nord', label: 'Oberwelle für die Nahfeldkarte', type: 'select', value: 3, group: G.vorgabe, options: [{ value: 1, label: '1. Oberwelle' }, { value: 3, label: '3. Oberwelle' }, { value: 5, label: '5. Oberwelle' }, { value: 51, label: '51. Oberwelle' }, { value: 301, label: '301. Oberwelle' }], help: 'Welche Oberwelle die Nahfeldsonde zeigt. Hohe Oberwellen haben andere Hot-Spots als tiefe.' },
      { key: 'px', label: 'Sonde, Position x', type: 'slider', min: 0, max: 1, step: 0.005, value: 0.5, group: G.vorgabe, help: 'Position der Nahfeldsonde (0 bis 1 über die Plattenbreite). Ziehe die Sonde in der Nahfeldkarte.' },
      { key: 'py', label: 'Sonde, Position y', type: 'slider', min: 0, max: 1, step: 0.005, value: 0.5, group: G.vorgabe, help: 'Position der Nahfeldsonde (0 bis 1 über die Plattenhöhe). Ziehe die Sonde in der Nahfeldkarte.' },
      { key: 'budget', label: 'Kostenvorgabe', type: 'slider', min: 0, max: 30, step: 1, unit: 'Punkte', value: 30, group: G.vorgabe, help: 'Vorgabe der Übung: Höchstens so viele Übungspunkte dürfen die Maßnahmen kosten.' },
      { key: 'leakReq', label: 'Vorgabe Ableitstrom', type: 'slider', min: 0.1, max: 3.5, step: 0.05, unit: 'mA', value: 0.3, group: G.vorgabe, help: 'Vorgabe der Übung (kein Normwert): Der Ableitstrom über einen Y-Kondensator darf höchstens so groß sein.' },
      { key: 'pswReq', label: 'Vorgabe Schaltverlust', type: 'slider', min: 0.05, max: 5, step: 0.05, scale: 'log', unit: 'W', unitKind: 'power', value: 1, group: G.vorgabe, help: 'Vorgabe der Übung: Der Schaltverlust darf höchstens so groß sein. Er steigt mit langsamen Flanken.' }
    ],
    meters: [
      { key: 'lMax', label: 'höchster Pegel (Spitzenwert)', unit: 'dBµV', digits: 1, min: 0, max: 130 },
      { key: 'fMax', label: 'Frequenz des höchsten Pegels', unit: 'MHz', digits: 2, min: 0, max: 30 },
      { key: 'margin', label: 'Marge zur AV-Linie', unit: 'dB', digits: 1, min: -60, max: 40, warnBelow: 6 },
      { key: 'punkte', label: 'Kosten', unit: 'Punkte', digits: 0, min: 0, max: 40, warnAbove: 30 },
      { key: 'pSw', label: 'Schaltverlust', unit: 'W', digits: 2, min: 0, max: 5, warnAbove: 1 },
      { key: 'leak', label: 'Ableitstrom', unit: 'mA', digits: 3, min: 0, max: 3.5, warnAbove: 0.3 },
      { key: 'nahfeld', label: 'Nahfeld an der Sonde (relativ)', unit: 'dB', digits: 1, min: -60, max: 0 }
    ],
    presets: [
      { id: 'ohne', name: 'ohne Maßnahmen', info: 'Standardzustand ohne Filter: deutlich über der Grenzlinie.', params: {} },
      { id: 'knapp', name: 'knapp', info: 'Filter und Flanke, aber noch knapp: Ampel gelb.', params: { rg: 33, layout: 'optimiert', topo: 'pi', cx: 330e-9, cy: 2.2e-9, drossel: 'd3', jitter: 4 } },
      { id: 'gut', name: 'gut (Musterlösung em32)', info: 'Ampel grün, Ableitstrom unter der Vorgabe, Verlust und Kosten unter den Vorgaben.', params: { rg: 33, snub: true, layout: 'optimiert', topo: 'pi', cx: 330e-9, cy: 2.2e-9, drossel: 'd3', jitter: 8 } },
      { id: 'nur-flanke', name: 'nur Flanke (Rg 100 Ω)', info: 'Der Pegel sinkt, der Schaltverlust steigt.', params: { rg: 100 } },
      { id: 'nur-filter', name: 'nur Filter', info: 'Nur das π-Filter mit d10: Der Pegel sinkt, es kostet Punkte und erzeugt Ableitstrom.', params: { topo: 'pi', cx: 100e-9, cy: 2.2e-9, drossel: 'd10' } }
    ],
    plant(P0) {
      const CORE = P0.CORE, prm = P0.params, cvCache = { key: '', cv: null };
      const specOf = (r, ctl) => ({ unit: 'dBµV', fMin: prm.fMin, fMax: prm.fMax, lines: r.shown.map(l => ({ f: l.f, L: l.L, Lcm: l.Lcm, Ldm: l.Ldm })), limits: r.limPts.map(q => ({ id: q.id, name: q.name, pts: q.pts.map(p => p.slice()) })), floor: r.floor, hidden: r.hidden.length, rbw: prm.rbw, det: 'peak' });
      return {
        compute(ctl, params, C) {
          const sc = srcCfgVP(C, ctl, params), fc = fltCfgVP(ctl, params);
          const li = K.lisn(C, sc, fc, ctl.klasse);
          if (!li.ok) return { ok: false, why: li.why, sc, fc };
          const fly = li.src && li.src.ok ? li.src : K.flyback(C, sc);
          if (!fly.ok) return { ok: false, why: fly.why, sc, fc };
          const lines = li.lines.filter(l => l && isNum(l.f) && isNum(l.L)).map(l => ({ f: l.f, L: l.L, Lcm: isNum(l.Lcm) ? l.Lcm : l.L, Ldm: isNum(l.Ldm) ? l.Ldm : l.L }));
          if (!lines.length) return { ok: false, why: 'Die Netznachbildung liefert keine Linien.', sc, fc };
          const as = (li.assess && isNum(li.assess.margin) ? li.assess : C.assess.conducted(lines, ctl.klasse)) || {};
          let top = null, topAll = lines[0]; lines.forEach(l => { if (l.L > topAll.L) topAll = l; if (isNum(C.limits.at('leit-' + ctl.klasse + '-AV', l.f)) && (!top || l.L > top.L)) top = l; });
          if (!top) top = topAll;
          const an = K.analyzer(C, lines.map(l => ({ f: l.f, L: l.L })), { fStart: params.fMin, fStop: params.fMax, rbw: params.rbw, points: 2 }), floor = an && isNum(an.floor) ? an.floor : params.floor;
          const hidden = lines.filter(l => l.L < floor), shown = lines.filter(l => l.L >= floor);
          const lim = ['QP', 'AV'].map(k => ({ id: 'leit-' + ctl.klasse + '-' + k, name: (k === 'QP' ? 'QP-Linie' : 'AV-Linie') + ' (Übungsgrenzlinie)' }));
          const limPts = lim.map(q => ({ id: q.id, name: q.name, pts: K.limitPts(C, q.id, 1.5e5, 3e7, 160) }));
          let freeTop = null; lines.forEach(l => { if (l.L >= floor && !isNum(C.limits.at(lim[1].id, l.f)) && (!freeTop || l.L > freeTop.L)) freeTop = l; });
          const items = costItems(ctl), cyEff = ctl.topo === 'kein' ? 0 : ctl.cy;
          return { ok: true, sc, fc, fly, li, lines, as, top, topAll, floor, hidden, shown, lim, limPts, freeTop, leak: K.leak(C, cyEff), cyEff, items, punkte: items.reduce((s, q) => s + q.pts, 0), pSw: isNum(fly.pSw) ? fly.pSw : 0, ring: fly.ring || li.ring || {}, tr: fly.tr };
        },
        meters(r, ctl) {
          if (!r.ok) return {};
          const safeNear = (c, q) => { if (prm.noNear) return 0; try { return nearAt(CORE, c, q.sc, c.px, c.py); } catch (e) { return 0; } };
          return { lMax: r.top.L, fMax: r.top.f / 1e6, margin: isNum(r.as.margin) ? r.as.margin : 0, punkte: r.punkte, pSw: r.pSw, leak: isNum(r.leak) ? r.leak : 0, nahfeld: safeNear(ctl, r) };
        },
        assess(r, ctl) {
          if (!r.ok) return { ok: false, ampel: 'grau', text: 'Die Vorprüfung lässt sich nicht berechnen: ' + (r.why || 'unbekannter Fehler') };
          const a = r.as, amp = B.ampelNorm(a.ampel);
          let txt = a.text;
          if (!txt) txt = amp === 'gruen' ? 'Vorprüfung bestanden: Alle Linien liegen mindestens 6 dB unter der AV-Linie (Spitzenwert, Übungsgrenzlinie).' : amp === 'gelb' ? 'Vorprüfung knapp: Im Labor mit Quasi-Spitzenwert und Mittelwert nachmessen.' : amp === 'rot' ? 'Der Spitzenwert liegt über der QP-Linie.' : 'Keine Bewertung möglich.';
          if (isNum(a.margin) && isNum(a.freq) && amp !== 'grau') txt += ' Marge zur AV-Linie ' + S2(a.margin) + ' dB bei ' + eng(a.freq, 'Hz') + '.';
          const o = { ok: !!a.ok, ampel: amp, text: txt };
          if (isNum(a.margin)) o.margin = a.margin; if (isNum(a.freq)) o.freq = a.freq;
          return o;
        },
        diag(r, ctl) {
          if (!r.ok) return [{ id: 'vp-fehler', kind: 'error', text: 'Die Vorprüfung lässt sich nicht berechnen: ' + (r.why || '') }];
          const out = [], ring = r.ring, CORE = P0.CORE, KEEP = ['ringing', 'flanke', 'y-strom', 'cap-ind', 'dr-kap', 'sat', 'floor', 'limit-frei'];
          const fw = isNum(r.as.freq) ? r.as.freq : r.top.f;
          const ctx = { src: r.fly, lisn: r.li, margin: r.as.margin, filt: { cfg: Object.assign({}, r.fc, { cy: r.cyEff }), f: fw }, leakA: r.leak / 1000, leakReq: ctl.leakReq / 1000, floorHit: r.hidden.length };
          if (r.freeTop) ctx.noLimit = { id: r.lim[1].id, f: r.freeTop.f };
          let cd = []; try { cd = typeof CORE.diagnose === 'function' ? CORE.diagnose(ctx) || [] : []; } catch (e) { cd = []; }
          cd.forEach(d => { if (KEEP.indexOf(d.id) >= 0 && !(d.id === 'ringing' && ctl.snub)) out.push(d); });   // Texte einzige Quelle: EMV_CORE.TEXTS
          if (isNum(ring.os) && ring.os > 0.2 && ctl.snub) out.push({ id: 'ringing-snub', kind: 'warn', text: 'Der Snubber dämpft das Ringing bei ' + S2(ring.fr / 1e6) + ' MHz noch nicht genug (Überschwingen ' + S2(ring.os * 100, 0) + ' %, Z0 = ' + S2(ring.Z0, 0) + ' Ω).' });
          if (ctl.snub && isNum(ring.pSnub) && ring.pSnub > 0) out.push({ id: 'snub-p', kind: 'info', text: 'Der Snubber setzt ' + S2(ring.pSnub, 2) + ' W in Wärme um (Cs·U²·fs).' });
          if (r.pSw > ctl.pswReq) out.push({ id: 'psw', kind: 'warn', text: 'Der Schaltverlust ' + S2(r.pSw, 2) + ' W liegt über der Vorgabe der Übung (' + S2(ctl.pswReq, 2) + ' W): Die Flanke ist zu langsam.' });
          if (r.punkte > ctl.budget) out.push({ id: 'kosten', kind: 'warn', text: 'Die Maßnahmen kosten ' + r.punkte + ' Punkte, die Vorgabe der Übung ist ' + ctl.budget + ' Punkte.' });
          return out;
        },
        spectrum(r, ctl) { return r.ok ? specOf(r, ctl) : { unit: 'dBµV', fMin: prm.fMin, fMax: prm.fMax, lines: [], limits: [], floor: prm.floor }; },
        curves(r, ctl) {
          const key = [ctl.klasse, ctl.rg, ctl.snub, ctl.jitter, ctl.layout, ctl.topo, ctl.cx, ctl.cy, ctl.drossel, ctl.ld, ctl.lead, ctl.px, ctl.py, ctl.nord].join('|');
          if (cvCache.key === key && cvCache.cv) return cvCache.cv;
          const cvs = [];
          if (r.ok) {
            const sp = specOf(r, ctl), near = r.lines.reduce((b, l) => (isNum(r.as.freq) && Math.abs(l.f - r.as.freq) < Math.abs(b.f - r.as.freq) ? l : b), r.lines[0]);
            cvs.push({ id: 'pegel', title: 'Pegel der Linien gegen die Übungsgrenzlinie', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV',
              series: [{ name: 'Linien (Spitzenwert)', points: sp.lines.map(l => [l.f, l.L]) }].concat(sp.limits.map(q => ({ name: q.name, points: q.pts }))),
              marker: isNum(r.as.freq) ? { x: near.f, y: near.L, text: 'Marge ' + S2(r.as.margin) + ' dB' } : undefined });
            const fl = []; for (let i = 0; i <= 40; i++) fl.push(1e4 * Math.pow(3e3, i / 40));
            const il = K.ilCurve(CORE, r.fc, fl), ser = [];
            if (il.gg) ser.push({ name: 'Gegentakt (GG)', points: fl.map((f, i) => [f, il.gg[i]]).filter(p => isNum(p[1])) });
            if (il.gt) ser.push({ name: 'Gleichtakt (GT)', points: fl.map((f, i) => [f, il.gt[i]]).filter(p => isNum(p[1])) });
            if (ser.length && ser.every(s => s.points.length)) cvs.push({ id: 'il', title: 'Einfügungsdämpfung des Filters', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Einfügungsdämpfung', yUnit: 'dB', series: ser });
            const nd = nearData(CORE, ctl, r.sc), jr = clamp(Math.round(ctl.py * NY - 0.5), 0, NY - 1), pts = [], nv = nearAt(CORE, ctl, r.sc, ctl.px, ctl.py);
            for (let i = 0; i < NX; i++) pts.push([(i + 0.5) / NX * BW, nd.data[jr * NX + i]]);
            cvs.push({ id: 'nah', title: 'Nahfeld entlang der Sondenzeile', xLabel: 'Position x', xUnit: 'mm', xScale: 'lin', yLabel: 'Nahfeld relativ zum Maximum', yUnit: 'dB', series: [{ name: 'Zeile y = ' + S2(ctl.py * BH, 0) + ' mm', points: pts }], marker: { x: ctl.px * BW, y: nv, text: S2(nv) + ' dB' } });
          } else cvs.push({ id: 'pegel', title: 'Pegel der Linien', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV', series: [{ name: 'keine Daten', points: [[1e5, 0], [3e7, 0]] }] });
          cvCache.key = key; cvCache.cv = cvs; return cvs;
        },
        fieldAt(x, y, r, ctl) { return r.ok ? nearAt(CORE, ctl, r.sc, x, y) : -120; },
        extend(api, h) {
          api.fieldGrid = () => { const r = h.res(); if (!r.ok) return { nx: NX, ny: NY, data: new Float32Array(NX * NY), max: { x01: 0.5, y01: 0.5, xmm: 50, ymm: 35 }, spots: [] }; const nd = nearData(CORE, h.ctl, r.sc); return { nx: NX, ny: NY, data: nd.data, max: Object.assign({}, nd.max), spots: nd.spots.map(q => Object.assign({}, q)) }; };
          api.probeTo = (x, y) => { const a = api.setControl('px', x), b = api.setControl('py', y); return a && b; };
          api.costs = () => costItems(h.ctl).map(q => Object.assign({}, q));
        },
        phaseHz() { return 0.5; },
        hit(px, py, w, h, view) {
          const L = layVP(w, h, view.ctl);
          for (let i = 0; i < L.tabs.length; i++) { const q = L.tabs[i]; if (px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h) return { key: 'modus', kind: 'select', to: q.v }; }
          if (view.ctl.modus === 'nahfeld' && L.map && px >= L.map.x && px <= L.map.x + L.map.w && py >= L.map.y && py <= L.map.y + L.map.h) { const x01 = clamp((px - L.map.x) / L.map.w, 0, 1), y01 = clamp((py - L.map.y) / L.map.h, 0, 1); return { key: 'px', kind: 'slider', to: x01, set: { px: x01, py: y01 } }; }
          return null;
        },
        draw(ctx, w, h, t, view, sc) { drawVP(ctx, w, h, t, view, sc, CORE); }
      };
    }
  };

  // ---- Zeichnen vorpruef ----------------------------------------------------------------------------------------------
  function layVP(w, h, ctl) {
    const pad = w < 420 ? 8 : 12, narrow = w < 640, aw = w - 2 * pad;
    const chain = { x: pad, y: 8, w: aw, h: 46 }, amp = { x: pad, y: chain.y + chain.h + 8, w: aw, h: 30 };
    const tabsY = amp.y + amp.h + 6, tabH = 40, tw = Math.min(200, (aw - 8) / 2);
    const tabs = [{ v: 'lisn', label: 'LISN-Spektrum', x: pad, y: tabsY, w: tw, h: tabH }, { v: 'nahfeld', label: 'Nahfeldkarte', x: pad + tw + 8, y: tabsY, w: tw, h: tabH }];
    const chipsH = narrow ? 2 * 36 + 6 : 36, chipsY = h - pad - chipsH, noteY = chipsY - 18, top = tabsY + tabH + 8, ch = Math.max(40, noteY - top - 2);
    const L = { pad, narrow, chain, amp, tabs, chips: { x: pad, y: chipsY, w: aw, h: chipsH, perRow: narrow ? 4 : 7 }, noteY, top, ch, aw };
    if (ctl.modus === 'nahfeld') {
      const legH = 44;   // Farbskala unter der Karte
      if (!narrow) { const mw = Math.min(aw * 0.62 - 8, (ch - 8 - legH) * BW / BH); L.map = { x: pad + 4, y: top + 4, w: mw, h: mw * BH / BW }; L.side = { x: pad + mw + 20, y: top, w: aw - mw - 20, h: ch }; }
      else { const mh = Math.min((aw - 8) * BH / BW, (ch - 8 - legH) * 0.62), mw = mh * BW / BH; L.map = { x: pad + 4, y: top + 4, w: mw, h: mh }; L.side = { x: pad, y: top + mh + legH + 12, w: aw, h: ch - mh - legH - 12 }; }
      L.legH = legH;
    } else {
      const sh = ch > 340 ? (narrow ? 70 : 64) : 0;
      L.strip = { x: pad, y: top, w: aw, h: sh }; L.spec = { x: pad, y: top + (sh ? sh + 8 : 0), w: aw, h: ch - (sh ? sh + 8 : 0) };
    }
    return L;
  }
  function drawVP(ctx, w, h, t, view, sc, CORE) {
    const pal = sc.pal, ctl = view.ctl, r = view.res, ghost = !!sc.ghost && ctx.globalAlpha < 0.99, fs = sc.fs, L = layVP(w, h, ctl);
    if (!ghost) {
      head(ctx, w, h, view, sc, L);
      L.tabs.forEach(q => {
        const on = ctl.modus === q.v;
        gfx.panel(ctx, q.x, q.y, q.w, q.h, on ? pal.panel2 : pal.panel, on ? pal.senke : pal.line, 9);
        if (on) { ctx.lineWidth = 2.5; ctx.strokeStyle = pal.senke; gfx.rr(ctx, q.x, q.y, q.w, q.h, 9); ctx.stroke(); }
        gfx.text(ctx, (q.v === 'lisn' ? '📊 ' : '🌡️ ') + q.label, q.x + q.w / 2, q.y + q.h / 2, { size: fs + 1, bold: on, color: on ? pal.fg : pal.mute, align: 'center', base: 'middle', max: q.w - 10 });
      });
      gfx.text(ctx, 'Diese Vorprüfung ersetzt keine Prüfung im akkreditierten Labor.', L.pad, L.noteY + 6, { size: fs - 1, color: pal.mute, max: L.aw });
    }
    if (!r.ok) { gfx.text(ctx, r.why || 'Keine Daten.', w / 2, h / 2, { size: fs + 1, color: pal.rot, align: 'center', max: w - 24 }); return; }
    if (!ghost) {
      const a = view.ampel, cost = r.punkte, req = ctl.budget;
      const chips = [
        { label: 'höchster Pegel', value: S2(r.top.L) + ' dBµV' }, { label: 'Frequenz', value: eng(r.top.f, 'Hz') }, { label: 'Marge (AV-Linie)', value: S2(isNum(r.as.margin) ? r.as.margin : 0) + ' dB', col: B.ampelColor(a.ampel, pal) },
        { label: 'Kosten', value: cost + ' / ' + req + ' Punkte', col: cost > req ? pal.rot : null }, { label: 'Schaltverlust', value: S2(r.pSw, 2) + ' W', col: r.pSw > ctl.pswReq ? pal.rot : null },
        { label: 'Ableitstrom', value: S2(r.leak, 3) + ' mA', col: r.leak > ctl.leakReq ? pal.rot : null }, { label: 'Nahfeld (Sonde)', value: S2(nearAt(CORE, ctl, r.sc, ctl.px, ctl.py)) + ' dB' }];
      chipRow(ctx, L.chips.x, L.chips.y, L.chips.w, chips, pal, { perRow: L.chips.perRow, size: fs, h: 36 });
    }
    if (ctl.modus === 'nahfeld') drawNear(ctx, L, view, sc, CORE, ghost); else drawLisn(ctx, L, t, view, sc, CORE, ghost);
  }
  function drawLisn(ctx, L, t, view, sc, CORE, ghost) {
    const pal = sc.pal, ctl = view.ctl, r = view.res, fs = sc.fs, st = L.strip, sp = L.spec;
    if (!ghost && st.h > 0) {   // Pruefling - Filter - Netznachbildung - Analysator
      const nb = st.w < 520 ? 3 : 4, gap = 20, bw = (st.w - gap * (nb - 1)) / nb;
      const blocks = [
        { c: pal.quelle, t: 'Prüfling Steckernetzteil', s: 'Rg ' + ctl.rg + ' Ω · tr ' + (isNum(r.tr) ? S2(r.tr * 1e9) : '–') + ' ns' + (ctl.snub ? ' · Snubber' : '') },
        { c: pal.pfad, t: 'Filter', s: ctl.topo === 'kein' && ctl.drossel === 'ohne' && !(ctl.ld > 0) ? 'kein Filter' : (ctl.topo === 'kein' ? 'nur Reihenelemente' : ctl.topo) + (ctl.topo !== 'kein' ? ' · Cx ' + eng(ctl.cx, 'F') + ' · Cy ' + eng(ctl.cy, 'F') : '') + (ctl.drossel !== 'ohne' ? ' · ' + ctl.drossel : '') },
        { c: pal.senke, t: 'Netznachbildung (LISN)', s: '50 Ω ∥ 50 µH je Leiter' },
        { c: pal.senke, t: 'Analysator', s: 'Spitzenwert · RBW ' + S2(VP.params.rbw / 1e3, 0) + ' kHz' }];
      const pth = [[st.x + bw * 0.5, st.y + st.h - 10], [st.x + st.w - bw * 0.5, st.y + st.h - 10]], pth2 = [[st.x + bw * 0.5, st.y + st.h - 5], [st.x + st.w - bw * 0.5, st.y + st.h - 5]];
      for (let i = 0; i < nb; i++) {
        const bx = st.x + i * (bw + gap), b = blocks[i];
        gfx.panel(ctx, bx, st.y, bw, st.h - 14, pal.panel, b.c, 8);
        gfx.text(ctx, b.t, bx + 8, st.y + 15, { size: fs, bold: true, color: b.c, max: bw - 14 });
        gfx.text(ctx, b.s, bx + 8, st.y + st.h - 24, { size: fs - 1, color: pal.fg, max: bw - 14 });
        if (i < nb - 1) gfx.arrow(ctx, bx + bw + 2, st.y + (st.h - 14) / 2, bx + bw + gap - 2, st.y + (st.h - 14) / 2, pal.mute, 2, 5);
      }
      gfx.line(ctx, pth, pal.line, 2); gfx.line(ctx, pth2, pal.line, 2);
      const rate = clamp((r.top.L - 30) / 70, 0.12, 1), ps = sc.ps('lisn', [{ pts: pth, color: pal.quelle, rate, dir: 1, size: 3 }, { pts: pth2, color: pal.masse, rate, dir: -1, size: 3 }], { cap: 120, speed: 80 });
      ps.draw(ctx, { reduced: sc.reduced, glow: sc.qp.glow });
    }
    if (sp.w < 200 || sp.h < 120) return;
    const fl = r.floor, avId = r.lim[1].id, qpId = r.lim[0].id, D = sc.D;
    const topL = r.topAll.L, yMax = Math.min(150, Math.max(100, Math.ceil((topL + 6) / 20) * 20));
    const near = r.lines.reduce((b, l) => (isNum(r.as.freq) && Math.abs(l.f - r.as.freq) < Math.abs(b.f - r.as.freq) ? l : b), r.lines[0]);
    let g = null;
    if (D && typeof D.spectrumBars === 'function' && typeof D.spectrumState === 'function') {   // Analysator-Ansicht von EMV_DRAW: Tween, Spitzenwert-Halten, Schraffur, Marker mit Marge
      const spec = { unit: 'dBµV', fMin: VP.params.fMin, fMax: VP.params.fMax, lines: r.shown, limits: r.limPts, floor: fl };
      g = D.spectrumBars(ctx, sp, spec, { yMin: 0, yMax, marker: isNum(r.as.freq) ? near.f : 'peak', anim: sc.tw.d2 || (sc.tw.d2 = D.spectrumState()), t: sc.t, reduced: sc.reduced, quality: sc.quality, theme: sc.theme });
    }
    if (!g) {   // Rueckfall: Balkenbild der gemeinsamen Huelle
      const d = { lines: r.shown, key: view.st.version, lim: r.limPts.map((q, i) => ({ name: q.name, pts: q.pts, dash: i ? [3, 3] : [8, 4] })), fMin: VP.params.fMin, fMax: VP.params.fMax, yMin: 0, yMax, unit: 'dBµV',
        avLim: f => CORE.limits.at(avId, f), qpLim: f => CORE.limits.at(qpId, f), legend: [{ label: 'Linie (Spitzenwert)', color: pal.gruen }, { label: 'QP-Linie (Übung)', color: pal.grenz, dash: [8, 4] }, { label: 'AV-Linie (Übung)', color: pal.grenz, dash: [3, 3] }],
        marker: isNum(r.as.freq) ? { f: near.f, L: near.L, text: S2(near.L) + ' dBµV · Marge ' + S2(r.as.margin) + ' dB' } : null };
      const g0 = gfx.spectrumBars(ctx, sp.x, sp.y, sp.w, sp.h, d, { pal, tw: sc.tw.spec || (sc.tw.spec = {}), t: sc.t, reduced: sc.reduced });
      if (g0 && !ghost) { const yf = g0.yp(fl); if (yf < g0.y0 + g0.h) { ctx.fillStyle = pal.mute; ctx.globalAlpha = 0.2; ctx.fillRect(g0.x0, yf, g0.w, g0.y0 + g0.h - yf); ctx.globalAlpha = 1; gfx.text(ctx, 'Eigenrauschen ' + S2(fl, 0) + ' dBµV', g0.x0 + g0.w - 6, Math.min(g0.y0 + g0.h - 6, yf + fs + 2), { size: fs - 1, color: pal.fg, bg: pal.panel, align: 'right', max: g0.w * 0.5 }); } }
      if (g0) g = { plot: { x: g0.x0, y: g0.y0, w: g0.w, h: g0.h }, xAt: f => g0.xp(f) };
    }
    if (g && !ghost && g.plot && g.xAt) {   // der Bereich ohne Grenzlinie beginnt bei 150 kHz
      const x150 = g.xAt(1.5e5), pl = g.plot; gfx.line(ctx, [[x150, pl.y], [x150, pl.y + pl.h]], pal.mute, 1, [4, 4]);
      gfx.text(ctx, 'ab 150 kHz Grenzlinie', Math.min(pl.x + pl.w - 4, x150 + 4), pl.y + pl.h - 26, { size: fs - 1, color: pal.mute, bg: pal.panel, max: pl.w * 0.4 });
    }
  }
  function drawNear(ctx, L, view, sc, CORE, ghost) {
    const pal = sc.pal, ctl = view.ctl, r = view.res, fs = sc.fs, m = L.map, D = sc.D;
    if (!m || m.w < 112 || m.h < 70) return;
    const nd = nearData(CORE, ctl, r.sc), cw = m.w / NX, chh = m.h / NY;
    let usedD = false;
    if (D && typeof D.heatmap === 'function') {   // geglaettete Karte, Farbskala, Maximum und Sonde von EMV_DRAW
      const legH = (typeof D.fsz === 'function' ? D.fsz(m.w + 8) : 12) * 2.6 + 6;
      usedD = !!D.heatmap(ctx, { x: m.x - 4, y: m.y - 4, w: m.w + 8, h: m.h + 8 + legH }, { w: NX, h: NY, data: nd.data }, { range: [nd.lo, 0], probe: null, peak: !ghost, theme: sc.theme });
    }
    if (!usedD) {
      ctx.fillStyle = HEATC[0]; ctx.fillRect(m.x, m.y, m.w, m.h);
      for (let k = 1; k <= 31; k++) {
        let any = false;
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (nd.lev[j * NX + i] === k) { if (!any) { ctx.beginPath(); any = true; } ctx.rect(m.x + i * cw, m.y + j * chh, cw + 0.6, chh + 0.6); }
        if (any) { ctx.fillStyle = HEATC[k]; ctx.fill(); }
      }
    }
    if (ghost) return;
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2; ctx.strokeRect(m.x, m.y, m.w, m.h);
    nd.spots.forEach((q, n) => {   // Hot-Spots: Quellen der Platine
      const sx = m.x + q.xmm / BW * m.w, sy = m.y + q.ymm / BH * m.h;
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, PI * 2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); gfx.dot(ctx, sx, sy, 1.8, '#ffffff');
      gfx.text(ctx, (n + 1) + ' ' + q.name, sx + 9, sy - 9, { size: fs - 1, bold: true, color: pal.fg, bg: pal.panel, align: sx > m.x + m.w * 0.62 ? 'right' : 'left', max: m.w * 0.45 });
    });
    const rd = nearAt(CORE, ctl, r.sc, ctl.px, ctl.py), px = m.x + ctl.px * m.w, py = m.y + ctl.py * m.h;
    {   // Sonde (ziehbar); ihr Wert kommt vom Kern an der genauen Position, nicht aus dem Raster der Karte
      const pr = Math.max(10, Math.min(16, m.w / 24));
      gfx.line(ctx, [[px - pr * 1.8, py], [px + pr * 1.8, py]], '#00e5ff', 2); gfx.line(ctx, [[px, py - pr * 1.8], [px, py + pr * 1.8]], '#00e5ff', 2);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, PI * 2); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3; ctx.stroke();
      gfx.text(ctx, 'Sonde ' + S2(rd) + ' dB', px + (px > m.x + m.w * 0.7 ? -pr - 6 : pr + 6), py + (py < m.y + 24 ? pr + 12 : -pr - 4), { size: fs, bold: true, color: pal.fg, bg: pal.panel, align: px > m.x + m.w * 0.7 ? 'right' : 'left', max: m.w * 0.5 });
    }
    gfx.text(ctx, 'Platine 100 × 70 mm · Sondenhöhe 5 mm', m.x + 6, m.y + m.h - 8, { size: fs - 1, color: '#ffffff', bg: '#000000', bgAlpha: 0.55, max: m.w - 12 });
    // Seitenfeld: Oberwelle, Messwert, Hot-Spots
    const sd = L.side; if (!sd || sd.w < 100 || sd.h < 50) return;
    let yy = sd.y + 14;
    gfx.text(ctx, S2(ctl.nord, 0) + '. Oberwelle' + (isNum(r.sc.fs) ? ' (' + eng(ctl.nord * r.sc.fs, 'Hz') + ')' : ''), sd.x, yy, { size: fs + 1, bold: true, color: pal.fg, max: sd.w }); yy += fs + 8;
    gfx.text(ctx, 'Sonde: ' + S2(rd) + ' dB gegen das Maximum', sd.x, yy, { size: fs, bold: true, color: '#00e5ff', max: sd.w }); yy += fs + 10;
    nd.spots.forEach((q, n) => { if (yy < sd.y + sd.h - 4) { gfx.text(ctx, (n + 1) + '  ' + q.name + ': ' + S2(q.db) + ' dB', sd.x, yy, { size: fs, color: pal.fg, max: sd.w }); yy += fs + 6; } });
    if (yy < sd.y + sd.h - 4) { gfx.text(ctx, 'Maximum bei x = ' + S2(nd.max.xmm, 0) + ' mm, y = ' + S2(nd.max.ymm, 0) + ' mm', sd.x, yy, { size: fs - 1, color: pal.mute, max: sd.w }); yy += fs + 8; }
    if (yy < sd.y + sd.h - 4) gfx.text(ctx, 'Nur relativ, keine absolute Feldstärke.', sd.x, yy, { size: fs - 1, color: pal.mute, max: sd.w });
  }

  R.register({ id: VP.id, name: VP.name, icon: VP.icon, info: VP.info, controls: VP.controls, meters: VP.meters, presets: VP.presets, create(opts) { return B.makeRig(VP, opts); } });

})(typeof window !== 'undefined' ? window : globalThis);
