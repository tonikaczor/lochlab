/* emvrig-kopplung.js - EMV-Lab, Pruefstand kopplung (Kopplungs-Labor: Leitungen, Koppelkapazitaet, Gegeninduktivitaet, Schirm, Verdrillung, Masseschleife) (WP2b).
 * Erzeugt aus quelle/emvlab/ (Anlagenteil, node quelle/emvlab/build_emvrig_b.js); nicht von Hand aendern. Der gemeinsame Bausatz steht in emvrig-kit.js (EMV_RIGS.kit).
 * Abhaengigkeit: emvrig-base.js (EMV_RIGS.base, WP2a), emvrig-kit.js (EMV_RIGS.kit) und EMV_CORE (emvcore.js); EMV_DRAW (emvdraw.js) ist optional (die Szenen zeichnen mit den Helfern der Basis).
 * Uebungsanlage: Alle Zahlen sind Uebungswerte (Herstellerdokumentation und aktuelle Norm massgeblich). Deterministisch (Seed 1); setControl,
 * step und draw werfen nie. Mit Node ladbar (module.exports = EMV_RIGS). Im Browser NACH emvcore.js, emvdraw.js, emvrig-base.js und emvrig-kit.js laden.
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./emvrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  if (!R.base) { if (typeof console !== 'undefined') console.warn('emvrig-kopplung.js: emvrig-base.js (EMV_RIGS.base) fehlt, der Prüfstand wird nicht registriert.'); return; }
  const B = R.base;
  if (!R.kit && typeof require === 'function') { try { require('./emvrig-kit.js'); } catch (e) { /* Kit fehlt */ } }
  if (!R.kit) { if (typeof console !== 'undefined') console.warn('emvrig-kopplung.js: emvrig-kit.js (EMV_RIGS.kit) fehlt (bitte davor laden), der Prüfstand wird nicht registriert.'); return; }
  const K = R.kit;

  // =====================================================================================================================
  //  Pruefstand kopplung: Kopplungs-Labor (SPEC 5.1). Zwei parallele Leitungen ueber Masse; Modell EMV_CORE.coupling (SPEC 4.2).
  //  Alle Rechnung im Kern; hier stehen Steuerwerte, Meldungen (Wortlaut SPEC 4.10) und die Szene.
  // =====================================================================================================================
  (function () {
    const { clamp, fm, fn, eng, okv, gfx, lg, TAU } = K;
    const FREQ_SNAP = [50, 1.5e5, 1e6, 3e7, 1e8, 1e9];
    const LV = { q: 'quelle', p: 'pfad', s: 'senke' };
    const TXK = {
      dom: ['–', 'kapazitiv', 'induktiv', 'galvanisch', 'Brummen'],
      chain: {
        quelle: 'Störerleitung (Relais, PWM)',
        pfad: 'Koppelkapazität, Gegeninduktivität, gemeinsame Rückleitung, Masseschleife',
        senke: 'Eingang der Opferleitung',
        art: 'leitungsgebunden', kopplung: ['kapazitiv', 'induktiv', 'galvanisch']
      },
      info: 'Zwei parallele Leitungen über Masse: Die Störerleitung führt Spannung und Strom, die Opferleitung (Sensor, Audio, Steuerung) fängt über Koppelkapazität und Gegeninduktivität eine Störung ein. Übungsanlage: Alle Zahlen sind Übungswerte, die Leitung muss elektrisch kurz sein (ℓ ≤ λ/10).',
      help: {
        s: 'Abstand von Mitte zu Mitte der beiden Leitungen. Mehr Abstand verkleinert Koppelkapazität und Gegeninduktivität.',
        h: 'Höhe beider Leitungen über der Bezugsmasse. Eine Leitung dicht über der Masse hat eine kleinere Schleifenfläche und damit eine kleinere Gegeninduktivität.',
        len: 'Länge, auf der die Leitungen parallel laufen. Doppelte Länge bedeutet doppelte Koppelkapazität und doppelte Gegeninduktivität, solange die Leitung elektrisch kurz ist.',
        f: 'Frequenz der Störung. Die kapazitive und die induktive Einkopplung wachsen mit der Frequenz; oberhalb von fCrit (ℓ = λ/10) gilt das Modell nicht mehr.',
        us: 'Spitzenspannung auf der Störerleitung (zum Beispiel eine 24-V-Steuerleitung oder eine Relaisspule).',
        rl: 'Last der Störerleitung. Der Störstrom ist Is = Us/RL: Ein kleiner Lastwiderstand bedeutet einen großen Strom und eine starke induktive Kopplung.',
        ro: 'Abschluss der Opferleitung an beiden Enden. Ein hochohmiger Eingang koppelt kapazitiv stark ein, ein niederohmiger Eingang kaum (Normsignal 4 bis 20 mA über 250 Ω).',
        schirm: 'Schirm der Opferleitung. Einseitig aufgelegt wirkt er nur gegen das elektrische Feld, beidseitig aufgelegt auch gegen das Magnetfeld, aber erst oberhalb der Schirm-Grenzfrequenz fc.',
        twist: 'Verdrillung in Windungen je Meter. Verdrillen verkleinert die wirksame Schleifenfläche und damit die induktive Einkopplung; gegen das elektrische Feld hilft es nicht.',
        sym: 'Symmetrische Übertragung mit Differenzeingang (Gleichtaktunterdrückung 60 dB als Übungswert): Der Differenzeingang unterdrückt den Gleichtakt. Das Brummen sinkt um 60 dB, die kapazitive Einkopplung sinkt etwas, mit Verdrillung deutlich stärker.',
        gem: 'Schaltet eine gemeinsame Rückleitung dazu (galvanische Kopplung): Der Störstrom fließt über denselben Rückleiter wie das Nutzsignal und erzeugt dort einen Spannungsfall.',
        rgem: 'Widerstand der gemeinsamen Rückleitung. Ein kleiner Widerstand verringert die galvanische Kopplung.',
        loop: 'Zweiter Erdungspunkt der Opferleitung: Es entsteht eine Masseschleife, in der eine Potenzialdifferenz einen Brummstrom treibt.',
        dUg: 'Potenzialdifferenz zwischen den beiden Erdungspunkten (zum Beispiel durch Ströme im Schutzleiter). Der Spannungsunterschied treibt den Brummstrom durch die Masseschleife.',
        uNutz: 'Spitzenwert des Nutzsignals am Eingang der Opferleitung. Ein größeres Nutzsignal verbessert bei gleicher Störung den Störabstand.',
        snrReq: 'Vorgabe der Übung: Mindest-Störabstand. Das ist kein Normwert, sondern die Aufgabenstellung.'
      }
    };
    const sl = (key, label, min, max, value, unit, unitKind, lever, group, help, o) => Object.assign({ key, label, type: 'slider', scale: 'log', min, max, step: min, value, unit, unitKind, lever, group, help }, o || {});
    const G = { q: 'Quelle entschärfen', p: 'Kopplung verringern', s: 'Senke härten', a: 'Anzeige und Vorgaben' };
    const controls = [
      sl('s', 'Abstand der Leitungen s', 1e-3, 0.1, 0.01, 'm', 'len', LV.p, G.p, TXK.help.s),
      sl('h', 'Höhe über Masse h', 1e-3, 0.05, 0.01, 'm', 'len', LV.p, G.p, TXK.help.h),
      sl('len', 'Länge ℓ', 0.05, 5, 1, 'm', 'len', LV.p, G.p, TXK.help.len),
      sl('f', 'Störfrequenz f', 50, 1e9, 1e6, 'Hz', 'freq', LV.q, G.q, TXK.help.f, { snap: FREQ_SNAP }),
      sl('us', 'Störspannung Us (Spitze)', 0.1, 400, 24, 'V', 'volt', LV.q, G.q, TXK.help.us),
      sl('rl', 'Last des Störers RL', 1, 1e4, 48, 'Ω', 'res', LV.q, G.q, TXK.help.rl),
      sl('ro', 'Abschluss des Opfers Ro', 50, 1e6, 1e4, 'Ω', 'res', LV.s, G.s, TXK.help.ro),
      { key: 'schirm', label: 'Schirm der Opferleitung', type: 'select', value: 'kein', options: [{ value: 'kein', label: 'kein Schirm' }, { value: 'eine', label: 'einseitig aufgelegt' }, { value: 'beide', label: 'beidseitig aufgelegt' }], lever: LV.p, group: G.p, help: TXK.help.schirm },
      { key: 'twist', label: 'Verdrillung', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, value: 0, unit: '1/m', unitKind: 'perm', lever: LV.p, group: G.p, help: TXK.help.twist },
      { key: 'sym', label: 'Übertragung', type: 'select', value: 'unsym', options: [{ value: 'unsym', label: 'unsymmetrisch' }, { value: 'sym', label: 'symmetrisch (CMRR 60 dB)' }], lever: LV.s, group: G.s, help: TXK.help.sym },
      { key: 'gem', label: 'Gemeinsame Rückleitung', type: 'switch', value: false, lever: LV.p, group: G.p, help: TXK.help.gem },
      sl('rgem', 'Widerstand der gemeinsamen Rückleitung', 0, 0.5, 0.05, 'Ω', 'res', LV.p, G.p, TXK.help.rgem, { scale: 'lin', step: 0.005, visible: s => !!s.gem }),
      { key: 'loop', label: 'Zweiter Erdungspunkt (Masseschleife)', type: 'switch', value: false, lever: LV.p, group: G.p, help: TXK.help.loop },
      sl('dUg', 'Potenzialdifferenz der Erdungspunkte', 0, 2, 0.5, 'V', 'volt', LV.q, G.q, TXK.help.dUg, { scale: 'lin', step: 0.05, visible: s => !!s.loop }),
      sl('uNutz', 'Nutzsignal (Spitze)', 1e-3, 1, 0.1, 'V', 'volt', LV.s, G.s, TXK.help.uNutz),
      sl('snrReq', 'Vorgabe Störabstand', 20, 80, 40, 'dB', 'db', null, G.a, TXK.help.snrReq, { scale: 'lin', step: 1 })
    ];
    const meters = [
      { key: 'uKap', label: 'Kapazitive Störspannung uKap', unit: 'mV', digits: 3 },
      { key: 'uInd', label: 'Induktive Störspannung uInd', unit: 'mV', digits: 3 },
      { key: 'uGalv', label: 'Galvanische Störspannung uGalv', unit: 'mV', digits: 3 },
      { key: 'uSum', label: 'Summe der Störspannungen uSum', unit: 'mV', digits: 3 },
      { key: 'uSumDb', label: 'Summe uSum als Pegel', unit: 'dBµV', digits: 1, min: -20, max: 160 },
      { key: 'uBrumm', label: 'Brummspannung uBrumm (50 Hz)', unit: 'mV', digits: 3 },
      { key: 'snr', label: 'Störabstand', unit: 'dB', digits: 1, min: -40, max: 100 },
      { key: 'fCrit', label: 'Modellgrenze fCrit (ℓ = λ/10)', unit: 'MHz', digits: 1 },
      { key: 'dom', label: 'Dominante Kopplung (0 keine, 1 kapazitiv, 2 induktiv, 3 galvanisch, 4 Brummen)', unit: '', digits: 0, labels: TXK.dom }
    ];
    const presets = [
      { id: 'audio', name: 'Audio: Mikrofonleitung', info: 'Mikrofonleitung (600 Ω, unsymmetrisch) neben einer Netzleitung, mit Masseschleife: Es brummt mit 50 Hz.', params: { s: 0.01, h: 0.01, len: 3, f: 50, us: 325, rl: 460, ro: 600, loop: true, dUg: 0.5, uNutz: 0.005, snrReq: 40 } },
      { id: 'sensor', name: 'Sensor: Normsignal', info: 'Sensorleitung mit Normsignal-Eingang (Ro 250 Ω) neben einer 24-V-Leitung bei 100 kHz; zum Vergleich Ro auf 100 kΩ stellen.', params: { s: 0.01, h: 0.01, len: 2, f: 1e5, us: 24, rl: 48, ro: 250, uNutz: 1, snrReq: 40 } },
      { id: 'relais', name: 'Relaisspule im Kabelbaum', info: 'Relaisspule und Signalleitung liegen eng im Kabelbaum (5 mm Abstand).', params: { s: 0.005, h: 0.01, len: 2, f: 1e5, us: 24, rl: 100, ro: 1e4, uNutz: 0.1, snrReq: 40 } },
      { id: 'flachband', name: 'Flachbandkabel 1,27 mm', info: 'Flachbandkabel mit 1,27 mm Raster und 10 cm Länge: Nachbaradern koppeln bei hohen Frequenzen.', params: { s: 1.27e-3, h: 1e-3, len: 0.1, f: 5e7, us: 3.3, rl: 50, ro: 1e3, uNutz: 1, snrReq: 20 } },
      { id: 'pwm', name: 'PWM-Motorleitung neben Sensor', info: 'Motorleitung (24 V, 5 Ω) neben einer Sensorleitung, PWM-Frequenz 20 kHz.', params: { s: 0.02, h: 0.01, len: 2, f: 2e4, us: 24, rl: 5, ro: 1e4, uNutz: 0.1, snrReq: 40 } }
    ];
    const SPEC = { id: 'kopplung', name: 'Kopplungs-Labor', icon: '🔌', info: TXK.info, world: { w: 960, h: 600 }, chain: TXK.chain, controls, noLever: ['snrReq'], meters, presets, params: { r: 0.25e-3 } };

    // ---- Meldungen: Wortlaut und Bedingungen stehen im Kern (EMV_CORE.diagnose, TEXTS); die Anlage reicht nur das Ergebnis von coupling.total weiter ----
    const mV = v => eng(v, 'V');
    function diagK(res, ctl, CORE) {
      if (!res || !res.ok) return [];
      let out = [];
      try { out = CORE.diagnose({ coup: res.raw }) || []; } catch (e) { out = []; }
      // Elektrisch lange Leitung: nur die Modellgrenze melden, die Anteile sind dann nur Groessenordnungen
      if (!res.valid) out = out.filter(d => d.id === 'lang');
      return out;
    }

    // ---- Geometrie der Szene (eine Funktion fuer Zeichnen und Antippen) ----
    const TOPY = { v: 90 };   // Oberkante des Bildinhalts (nach dem Kopf; 10 ohne Kopf)
    function layoutK(w, h) { return K.split(w, h, TOPY.v, { a: 'cross', b: 'long', c: 'scope', left: 0.46, rightTop: 0.64, stack: [0.36, 0.4] }); }
    function longGeom(r, ctl) {
      const lx = r.x + 12, lw = r.w - 24, ly = r.y + 26, lh = r.h - 32;
      const x0 = lx + 36, x1 = lx + lw - 58, xv0 = x0 + 46, xv1 = x1 - 46;
      const yA = ly + lh * 0.16, yV = ly + lh * 0.5, yG = ly + lh * 0.84;
      const g = { lx, lw, ly, lh, x0, x1, xv0, xv1, yA, yV, yG };
      g.shield = { x: xv0 - 8, y: yV - 13, w: xv1 - xv0 + 16, h: 26 };
      g.gem = { x: x0 + 8, y: yG - 9, w: 34, h: 18 };
      g.sym = { x: x1 - 40, y: yV - 13, w: 32, h: 26 };
      g.loop = { x: xv1 - 4, y: yG - 4, w: 52, h: 22 };
      return g;
    }
    function areasK(w, h, ctl) {
      const L = layoutK(w, h); if (!L || !K.big(L.long, 200, 120)) return [];
      const g = longGeom(L.long, ctl), a = [];
      const R0 = (k, kind, rc, to) => a.push({ key: k, kind, x: rc.x, y: rc.y, w: rc.w, h: rc.h, to });
      R0('schirm', 'select', g.shield, K.optNext(controls.find(c => c.key === 'schirm'), ctl.schirm));
      R0('sym', 'select', g.sym, ctl.sym === 'sym' ? 'unsym' : 'sym');
      R0('gem', 'switch', g.gem, !ctl.gem);
      R0('loop', 'switch', g.loop, !ctl.loop);
      return a;
    }

    // ---- Feldlinien: EMV_DRAW.fieldE und fieldH (Linienanteil folgt dem Kern: E = Cm/(Cm+Cg), H = M/Ls); die Anlage liefert nur die Verhaeltnisse ----
    const aspectOf = ctl => clamp(ctl.s / ctl.h, 0.7, 6);
    function drawFields(D, ctx, rE, rH, view, sc, phaseCycles, caption) {
      const { ctl, res } = view, aspect = aspectOf(ctl), common = { quality: sc.quality, reduced: sc.reduced, theme: sc.theme, caption };
      const ampE = 0.35 + 0.65 * K.rateLog(ctl.us, 0.1, 400), ampH = 0.35 + 0.65 * K.rateLog(res.is, 1e-3, 10);
      const out = sc.reduced || (view.phase % 1) < 0.5;
      let e = false, h = false;
      try { e = D.fieldE(ctx, rE, { ratio: res.shareE, s: ctl.s, h: ctl.h }, Object.assign({ lines: 24, phase: phaseCycles, amp: ampE, victim: 'Opfer' }, common)); } catch (x) { e = false; }
      try { h = D.fieldH(ctx, rH, [{ x: 0, y: 1, i: out ? 1 : -1 }], Object.assign({ victim: { x: aspect, y: 1 }, ratio: res.shareH, lines: 24, phase: phaseCycles, amp: ampH }, common)); } catch (x) { h = false; }
      return { e, h };
    }

    // ---- Zeichnen ----
    function plant(P0) {
      const CORE = P0.CORE;
      const drawn = { eN: 0, eReach: 0, hN: 0, hThrough: 0, eTarget: NaN, hTarget: NaN, arrangement: '' };

      function compute(ctl, par) {
        const cfg = { s: ctl.s, h: ctl.h, r: par.r, len: ctl.len, f: ctl.f, us: ctl.us, rl: ctl.rl, ro: ctl.ro, schirm: ctl.schirm, twist: ctl.twist, sym: ctl.sym, gem: !!ctl.gem, rgem: ctl.rgem, loop: !!ctl.loop, dUg: ctl.dUg, uNutz: ctl.uNutz, snrReq: ctl.snrReq };
        if (par.rPE !== undefined) cfg.rPE = par.rPE;
        const t = CORE.coupling.total(cfg), w = CORE.coupling.wires({ s: ctl.s, h: ctl.h, r: par.r });
        const g = (o, names) => K.pickN(o, names);
        if (!t || t.ok === false || !w || w.ok === false) return { ok: false, why: (t && t.why) || (w && w.why) || 'Die Geometrie ist unmöglich (der Drahtradius muss kleiner als Höhe und halber Abstand sein).', cfg };
        const res = { ok: true, cfg, raw: t, valid: t.valid !== false, why: t.why, uKap: g(t, ['uKap']), uInd: g(t, ['uInd']), uGalv: g(t, ['uGalv']), uSum: g(t, ['uSum']), uBrumm: g(t, ['uBrumm']), iBrumm: g(t, ['iBrumm', 'iLoop']), snr: g(t, ['snr']), fCrit: g(t, ['fCrit']), dominant: t.dominant };
        res.uGalv = isFinite(res.uGalv) ? res.uGalv : 0; res.uBrumm = isFinite(res.uBrumm) ? res.uBrumm : 0; res.iBrumm = isFinite(res.iBrumm) ? res.iBrumm : 0;
        res.margin = isFinite(g(t, ['margin'])) ? g(t, ['margin']) : res.snr - ctl.snrReq;
        res.Cm = g(w, ['Cm']); res.Cg = g(w, ['Cg']); res.M = g(w, ['M']); res.Ls = g(w, ['Ls']);
        res.shareE = isFinite(g(w, ['shareE'])) ? g(w, ['shareE']) : res.Cm / (res.Cm + res.Cg);
        res.shareH = isFinite(g(w, ['shareH'])) ? g(w, ['shareH']) : res.M / res.Ls;
        res.is = isFinite(g(t, ['is'])) ? g(t, ['is']) : ctl.us / ctl.rl;
        res.SF = isFinite(g(t, ['sf'])) ? g(t, ['sf']) : (ctl.schirm === 'beide' ? CORE.coupling.shieldMag(ctl.f) : 1);
        res.fc = isFinite(CORE.coupling.fc) ? CORE.coupling.fc : NaN;
        res.fT = isFinite(g(t, ['twistF'])) ? g(t, ['twistF']) : CORE.coupling.twist(ctl.twist * ctl.len);
        res.CmTot = g(t, ['cm']); res.CgTot = g(t, ['cg']);
        // dominanter Anteil einschliesslich Brummen (fuer Anzeige und Ampeltext)
        const parts = [['kapazitiv', res.uKap], ['induktiv', res.uInd], ['galvanisch', res.uGalv], ['Brummen', res.uBrumm]];
        res.big = parts.reduce((a, b) => (b[1] > a[1] ? b : a), parts[0]);
        return res;
      }
      function meters(res) {
        if (!res.ok) return { uKap: 0, uInd: 0, uGalv: 0, uSum: 0, uSumDb: -60, uBrumm: 0, snr: 0, fCrit: 0, dom: 0 };
        return { uKap: res.uKap * 1e3, uInd: res.uInd * 1e3, uGalv: res.uGalv * 1e3, uSum: res.uSum * 1e3, uSumDb: K.dbuvC(res.uSum), uBrumm: res.uBrumm * 1e3, snr: res.snr, fCrit: res.fCrit / 1e6, dom: res.big && res.big[1] > 0 ? TXK.dom.indexOf(res.big[0]) : 0 };
      }
      function assess(res, ctl) {
        if (!res.ok) return { ok: false, ampel: 'grau', text: res.why };
        if (!res.valid) return { ok: false, ampel: 'grau', text: 'Keine Bewertung: ' + (res.why || 'Die Leitung ist elektrisch lang.') };
        const amp = K.ampelOfMargin(res.margin), part = res.big && res.big[1] > 0 ? ' Größter Anteil: ' + res.big[0] + ' (' + mV(res.big[1]) + ').' : '';
        const verd = amp === 'gruen' ? 'Die Vorgabe ist mit Sicherheitsabstand erfüllt.' : amp === 'gelb' ? 'Die Vorgabe ist knapp erfüllt.' : 'Die Vorgabe wird verfehlt.';
        return { ok: res.margin >= 0, ampel: amp, margin: res.margin, freq: ctl.f, text: 'Marge ' + fm(res.margin, 1) + ' dB: Störabstand ' + fm(res.snr, 1) + ' dB bei Vorgabe ' + fm(ctl.snrReq, 0) + ' dB. ' + verd + part };
      }
      function curves(res, ctl) {
        const C = CORE, fl = K.logSpace(50, 1e9, 90), ser = { kap: [], ind: [], galv: [], sum: [] };
        if (!res.ok) return [{ id: 'stoer', title: 'Störpegel über der Frequenz', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV', series: [{ name: 'keine Rechnung', points: [[50, 0], [1e9, 0]] }] }];
        fl.forEach(f => {
          const t = C.coupling.total(Object.assign({}, res.cfg, { f }));
          if (!t || t.ok === false || t.valid === false) return;
          ser.kap.push([f, K.dbuvC(t.uKap)]); ser.ind.push([f, K.dbuvC(t.uInd)]); ser.galv.push([f, K.dbuvC(t.uGalv || 0)]); ser.sum.push([f, K.dbuvC(t.uSum)]);
        });
        const allowed = K.dbuv(ctl.uNutz) - ctl.snrReq;
        const cv = { id: 'stoer', title: 'Störpegel über der Frequenz (Vorgabe als Linie)', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV',
          series: [{ name: 'kapazitiv', points: ser.kap }, { name: 'induktiv', points: ser.ind }].concat(ctl.gem ? [{ name: 'galvanisch', points: ser.galv }] : [], ctl.loop ? [{ name: 'Brummen (50 Hz)', points: fl.filter((q, i) => i % 3 === 0).map(f => [f, K.dbuvC(res.uBrumm)]) }] : [], [{ name: 'Summe', points: ser.sum }]),
          limit: { y: isFinite(allowed) ? allowed : 0, name: 'zulässige Störung (Vorgabe)' } };
        if (res.valid) cv.marker = { x: ctl.f, y: K.dbuvC(res.uSum), text: 'uSum ' + fm(K.dbuvC(res.uSum), 1) + ' dBµV' };
        cv.note = 'Das Modell gilt nur bis fCrit = ' + eng(res.fCrit, 'Hz') + ' (ℓ = λ/10); die Kurven enden dort.';
        return [cv];
      }

      // ---------------- Szene ----------------
      function cross(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs, D = sc.D;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Querschnitt (Skizze): E-Feld und H-Feld', { size: fs, max: r.w - 20 });
        if (!K.big(r, 200, 150)) return;
        const inner = { x: r.x + 6, y: r.y + 24, w: r.w - 12, h: r.h - 30 }, stacked = inner.h >= 300 || inner.w < 300, gap = 6;
        const rE = stacked ? { x: inner.x, y: inner.y, w: inner.w, h: (inner.h - gap) / 2 } : { x: inner.x, y: inner.y, w: (inner.w - gap) / 2, h: inner.h };
        const rH = stacked ? { x: inner.x, y: inner.y + (inner.h - gap) / 2 + gap, w: inner.w, h: (inner.h - gap) / 2 } : { x: inner.x + (inner.w - gap) / 2 + gap, y: inner.y, w: (inner.w - gap) / 2, h: inner.h };
        if (!D || !D.fieldE || !D.fieldH) { gfx.text(ctx, 'Feldlinienbild: emvdraw.js fehlt', r.x + r.w / 2, r.y + r.h / 2, { size: fs, color: pal.mute, align: 'center', max: r.w - 20 }); return; }
        const cyc = sc.reduced ? 0 : view.simT * K.phaseHzOf(ctl.f), got = drawFields(D, ctx, rE, rH, view, sc, cyc, true);
        drawn.eN = got.e ? got.e.n : 0; drawn.eReach = got.e ? got.e.hits : 0; drawn.eTarget = got.e ? got.e.target : NaN;
        drawn.hN = got.h ? got.h.n : 0; drawn.hThrough = got.h ? got.h.through : 0; drawn.hTarget = got.h ? got.h.target : NaN; drawn.arrangement = stacked ? 'gestapelt' : 'nebeneinander';
        const dom = res.big && res.big[1] > 0 ? res.big[0] : '';
        if (dom) gfx.text(ctx, 'Dominant: ' + dom, r.x + r.w - 10, r.y + 15, { size: fs, bold: true, color: pal.fg, align: 'right', max: r.w * 0.4 });
        if (ctl.schirm !== 'kein') gfx.text(ctx, ctl.schirm === 'beide' ? 'Opferleitung mit Schirm (beidseitig)' : 'Opferleitung mit Schirm (einseitig)', rE.x + rE.w / 2, rE.y + 18, { size: fs, color: pal.schirm, align: 'center', bg: pal.panel, pad: 2, max: rE.w - 8 });
      }

      function longi(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Längsansicht: Strom und Störspannung', { size: fs });
        if (!K.big(r, 220, 130)) return;
        const g = longGeom(r, ctl), { x0, x1, xv0, xv1, yA, yV, yG } = g;
        const gl = pal.masse, rows = Math.max(0, Math.round(g.lh));
        // Masseschiene
        gfx.line(ctx, [[x0 - 14, yG], [x1 + 14, yG]], gl, 3);
        // Masseschleife: Flaeche und zweiter Erdungspunkt
        if (ctl.loop) {
          ctx.beginPath(); ctx.rect(xv0, yV, xv1 - xv0, yG - yV); ctx.fillStyle = pal.masse; ctx.globalAlpha = 0.12 + 0.1 * K.rateLog(res.iBrumm, 1e-3, 10); ctx.fill(); ctx.globalAlpha = 1;
          gfx.text(ctx, 'Masseschleife', (xv0 + xv1) / 2, yV + (yG - yV) * 0.25, { size: fs, color: pal.masse, align: 'center', base: 'middle', bg: pal.panel, pad: 2 });
          // Quelle dUg im rechten Zweig
          const bx = xv1 + 20;
          gfx.line(ctx, [[xv1, yV], [bx, yV], [bx, yG - 24]], pal.senke, 2);
          ctx.beginPath(); ctx.arc(bx, yG - 12, 8, 0, TAU); ctx.strokeStyle = pal.hfeld; ctx.lineWidth = 2; ctx.stroke(); gfx.text(ctx, '≈', bx, yG - 12, { size: 12, bold: true, color: pal.hfeld, align: 'center', base: 'middle' });
          gfx.text(ctx, 'dUg ' + eng(ctl.dUg, 'V'), bx + 12, yG - 14, { size: fs, color: pal.hfeld, bg: pal.panel, pad: 2, max: Math.max(40, r.x + r.w - bx - 14) });
          gfx.line(ctx, [[bx, yG - 4], [bx, yG]], pal.senke, 2);
        }
        // Stoerer: Quelle links, RL rechts
        gfx.line(ctx, [[x0, yA], [x1, yA]], pal.quelle, 3);
        gfx.line(ctx, [[x0, yA], [x0, (yA + yG) / 2 - 11]], pal.quelle, 2); gfx.line(ctx, [[x0, (yA + yG) / 2 + 11], [x0, yG]], gl, 2);
        ctx.beginPath(); ctx.arc(x0, (yA + yG) / 2, 11, 0, TAU); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2; ctx.stroke();
        gfx.text(ctx, '~', x0, (yA + yG) / 2, { size: 14, bold: true, color: pal.quelle, align: 'center', base: 'middle' });
        gfx.text(ctx, 'Us ' + eng(ctl.us, 'V'), x0, (yA + yG) / 2 + 24, { size: fs, color: pal.quelle, align: 'center', base: 'middle', bg: pal.panel, pad: 2, max: 70 });
        gfx.line(ctx, [[x1, yA], [x1, (yA + yG) / 2 - 12]], pal.quelle, 2); gfx.line(ctx, [[x1, (yA + yG) / 2 + 12], [x1, yG]], gl, 2);
        ctx.beginPath(); ctx.rect(x1 - 5, (yA + yG) / 2 - 12, 10, 24); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2; ctx.stroke();
        gfx.text(ctx, 'RL ' + eng(ctl.rl, 'Ω'), x1 + 9, (yA + yG) / 2, { size: fs, color: pal.quelle, base: 'middle', max: Math.max(24, r.x + r.w - x1 - 12) });
        // Opfer: gerade oder verdrillt, Abschluss Ro an beiden Enden
        const Dc = sc.D && sc.D.cable ? sc.D : null, vOpts = { shield: ctl.schirm !== 'kein', earth: ctl.schirm === 'beide' ? 'both' : ctl.schirm === 'eine' ? 'start' : 'none', twisted: ctl.twist > 0, pair: ctl.sym === 'sym' && !(ctl.twist > 0), color: pal.senke, width: 3, theme: sc.theme };
        let cabOk = false;
        if (Dc) { try { cabOk = !!Dc.cable(ctx, [[xv0, yV], [xv1, yV]], vOpts); } catch (x) { cabOk = false; } }
        if (cabOk) { /* gezeichnet von EMV_DRAW.cable */ } else if (ctl.twist > 0) {
          const nC = clamp(Math.ceil(ctl.twist * ctl.len), 1, 14), pts1 = [], pts2 = [], n = 120;
          for (let i = 0; i <= n; i++) { const x = xv0 + (xv1 - xv0) * i / n, s = Math.sin(Math.PI * nC * i / n) * 6; pts1.push([x, yV + s]); pts2.push([x, yV - s]); }
          gfx.line(ctx, pts1, pal.senke, 2.5); gfx.line(ctx, pts2, pal.schutz, 2, [5, 3]);
        } else gfx.line(ctx, [[xv0, yV], [xv1, yV]], pal.senke, 3);
        [[xv0, 'l'], [xv1, 'r']].forEach(p => {
          gfx.line(ctx, [[p[0], yV], [p[0], (yV + yG) / 2 - 6]], pal.senke, 2); ctx.beginPath(); ctx.rect(p[0] - 4, (yV + yG) / 2 - 6, 8, 12); ctx.strokeStyle = pal.senke; ctx.lineWidth = 2; ctx.stroke();
          gfx.line(ctx, [[p[0], (yV + yG) / 2 + 6], [p[0], yG]], pal.senke, 2);
        });
        gfx.text(ctx, 'Ro ' + eng(ctl.ro, 'Ω'), xv0 + 8, (yV + yG) / 2 + 4, { size: fs, color: pal.senke, base: 'middle', max: Math.max(24, (xv1 - xv0) * 0.4) });
        // Schirm
        if (ctl.schirm !== 'kein') {
          const s = g.shield;
          if (!cabOk) {   // Notfall ohne EMV_DRAW.cable: gestrichelter Rahmen mit Erdsymbolen
            ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.strokeStyle = pal.schirm; ctx.lineWidth = 2.5; if (ctx.setLineDash) ctx.setLineDash([6, 4]); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
            gfx.line(ctx, [[s.x, s.y + s.h], [s.x, s.y + s.h + 10]], pal.schirm, 2); K.groundMark(ctx, s.x, s.y + s.h + 10, pal.schirm, 5);
            if (ctl.schirm === 'beide') { gfx.line(ctx, [[s.x + s.w, s.y + s.h], [s.x + s.w, s.y + s.h + 10]], pal.schirm, 2); K.groundMark(ctx, s.x + s.w, s.y + s.h + 10, pal.schirm, 5); }
          }
          gfx.text(ctx, ctl.schirm === 'beide' ? 'Schirm beidseitig' : 'Schirm einseitig', s.x + s.w / 2, s.y - 7, { size: fs, color: pal.schirm, align: 'center', bg: pal.panel, pad: 2 });
        }
        // gemeinsame Rueckleitung
        if (ctl.gem) {
          const q = g.gem; ctx.beginPath(); ctx.rect(q.x, q.y - 2, q.w, 10); ctx.fillStyle = pal.panel; ctx.fill(); ctx.strokeStyle = pal.quelle; ctx.lineWidth = 2; ctx.stroke();
          gfx.text(ctx, 'Rgem ' + eng(ctl.rgem, 'Ω'), q.x + q.w / 2, q.y - 8, { size: fs, color: pal.quelle, align: 'center', bg: pal.panel, pad: 2 });
        }
        // symmetrisch: Differenzeingang
        if (ctl.sym === 'sym') {
          const q = g.sym; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.w, q.y + q.h / 2); ctx.lineTo(q.x, q.y + q.h); ctx.closePath(); ctx.strokeStyle = pal.senke; ctx.lineWidth = 2; ctx.stroke();
          gfx.text(ctx, '+', q.x + 5, q.y + 7, { size: 11, bold: true, color: pal.senke, base: 'middle' }); gfx.text(ctx, '−', q.x + 5, q.y + q.h - 7, { size: 11, bold: true, color: pal.senke, base: 'middle' });
          gfx.line(ctx, [[xv1, yV], [q.x, yV]], pal.senke, 3);
        }
        // Partikel: Strom des Stoerers, Rueckstrom, Stoerstrom im Opfer, Brummstrom
        const rA = K.rateLog(res.is, 1e-3, 10), rV = K.rateLog(res.uSum, 1e-5, 10), rB = ctl.loop ? K.rateLog(res.iBrumm, 1e-3, 10) : 0;
        const paths = [
          { pts: [[x0, yA], [x1, yA], [x1, (yA + yG) / 2 - 12]], color: pal.quelle, rate: rA, dir: 1, size: 3.4 },
          { pts: [[x1, (yA + yG) / 2 + 12], [x1, yG], [x0, yG], [x0, (yA + yG) / 2 + 11]], color: pal.masse, rate: rA, dir: 1, size: 3.4 },
          { pts: [[xv0, yV], [xv1, yV], [xv1, (yV + yG) / 2 - 6]], color: pal.senke, rate: rV, dir: 1, size: 3 }
        ];
        if (ctl.loop) paths.push({ pts: [[xv0 + 6, yG - 6], [xv1 - 6, yG - 6], [xv1 - 6, yV + 6], [xv0 + 6, yV + 6], [xv0 + 6, yG - 6]], color: pal.hfeld, rate: rB, dir: 1, size: 3 });
        const ps = sc.ps('kopplung', paths, { cap: 160, speed: 90 });
        ps.draw(ctx, { reduced: sc.reduced });
        // Messmarken an den Stellen, an denen die Groessen entstehen
        const tags = [['uKap ' + mV(res.uKap), pal.efeld], ['uInd ' + mV(res.uInd), pal.hfeld]];
        if (ctl.gem) tags.push(['uGalv ' + mV(res.uGalv), pal.quelle]);
        if (ctl.loop) tags.push(['uBrumm ' + mV(res.uBrumm), pal.masse]);
        tags.push(['uSum ' + mV(res.uSum) + ' = ' + fm(K.dbuvC(res.uSum), 1) + ' dBµV', pal.fg]);
        const stepY = Math.min(17, Math.max(13, (yV - yA - 16) / tags.length)), tx = xv1 - 2;
        tags.forEach((t, i) => K.tag(ctx, t[0], tx, yV - 14 - (tags.length - 1 - i) * stepY - 6, t[1], pal, { align: 'right', size: fs, bold: i === tags.length - 1, ax: i === tags.length - 1 ? xv1 : undefined, ay: yV, max: Math.max(80, tx - r.x - 20) }));
        gfx.text(ctx, 'Länge ℓ = ' + eng(ctl.len, 'm') + (res.valid ? '' : ' (elektrisch lang)'), r.x + r.w / 2, r.y + r.h - 7, { size: fs, color: res.valid ? pal.mute : pal.rot, align: 'center', max: r.w - 20 });
      }

      function scope(ctx, r, view, sc) {
        const pal = sc.pal, { ctl, res } = view, fs = sc.fs;
        K.plate(ctx, r.x, r.y, r.w, r.h, pal, 'Mini-Oszilloskop (Spuren je auf volle Höhe skaliert)', { size: fs });
        if (!K.big(r, 200, 100)) return;
        const x = r.x + 12, w = r.w - 24, y1 = r.y + 24 + (r.h - 30) * 0.25, y2 = r.y + 24 + (r.h - 30) * 0.75, amp = (r.h - 30) * 0.19, ph = view.phase;
        ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x + w, y1); ctx.moveTo(x, y2); ctx.lineTo(x + w, y2); ctx.stroke();
        K.sineTrace(ctx, x, y1, w, amp, 3, ph, pal.quelle, 2.2);
        K.sineTrace(ctx, x, y2, w, amp, 3, ph, pal.senke, 2.2);
        gfx.text(ctx, 'Störer û = ' + eng(ctl.us, 'V') + ', f = ' + eng(ctl.f, 'Hz'), x + 4, y1 - amp - 4, { size: fs, bold: true, color: pal.quelle, bg: pal.panel, pad: 2, max: w - 8 });
        gfx.text(ctx, 'Opfer û = ' + eng(res.uSum, 'V') + (ctl.loop ? ', Brummen ' + eng(res.uBrumm, 'V') + ' (50 Hz)' : ''), x + 4, y2 - amp - 4, { size: fs, bold: true, color: pal.senke, bg: pal.panel, pad: 2, max: w - 8 });
        gfx.text(ctx, 'Animation verlangsamt (angezeigte Phasenfrequenz ' + fm(K.phaseHzOf(ctl.f), 1) + ' Hz)', x + w, r.y + r.h - 7, { size: fs, color: pal.mute, align: 'right', max: w });
      }

      function draw(ctx, w, h, t, view, sc) {
        const pal = sc.pal, y0 = K.header(ctx, w, view, sc);
        TOPY.v = y0;
        const L = layoutK(w, h);
        if (!view.res.ok) { gfx.text(ctx, view.res.why || 'Keine Rechnung möglich.', w / 2, y0 + 40, { size: sc.fs + 1, color: pal.rot, align: 'center', max: w - 24 }); K.footer(ctx, w, h, sc); return; }
        if (L) { cross(ctx, L.cross, view, sc); longi(ctx, L.long, view, sc); scope(ctx, L.scope, view, sc); }
        K.footer(ctx, w, h, sc, 'Skizze nicht maßstäblich');
      }
      function hit(x, y, w, h, view) {
        const a = areasK(w, h, view.ctl);
        for (let i = 0; i < a.length; i++) if (K.inRect(x, y, a[i])) { const o = a[i]; if (o.key === 'schirm' || o.key === 'sym') return { key: o.key, kind: 'select', to: o.to }; return { key: o.key, kind: 'switch', to: o.to }; }
        return null;
      }
      return {
        compute, meters, assess, curves, draw, hit,
        diag: (res, ctl) => diagK(res, ctl, CORE),
        phaseHz: (res, ctl) => K.phaseHzOf(ctl.f),
        state: res => (res.ok ? { domText: res.big && res.big[1] > 0 ? res.big[0] : '–', eShare: res.shareE, hShare: res.shareH, valid: res.valid, fcSchirm: res.fc } : { domText: '–' }),
        extend(api) {
          api.fieldStats = function (q) {
            const r = api._view().res, D = B.getDraw(), ctl = api.getControls(); if (!r || !r.ok || !D) return null;
            const mock = B.mockCtx({ w: 400, h: 300 }), rc = { x: 0, y: 0, w: 400, h: 300 }, g = drawFields(D, mock, rc, rc, api._view(), { quality: q || 'hoch', reduced: false, theme: 'dark' }, 0, false);
            return { eN: g.e ? g.e.n : 0, eReach: g.e ? g.e.hits : 0, eShare: r.shareE, hN: g.h ? g.h.n : 0, hThrough: g.h ? g.h.through : 0, hShare: r.shareH, aspect: aspectOf(ctl) };
          };
          api.lastScene = () => Object.assign({}, drawn);
          api.areas = (w, h) => areasK(w, h, api.getControls());
        }
      };
    }
    SPEC.plant = plant;
    R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, chain: SPEC.chain, create(opts) { return B.makeRig(SPEC, opts); } });
  })();

})(typeof window !== 'undefined' ? window : globalThis);
