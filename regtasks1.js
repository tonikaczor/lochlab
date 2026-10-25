/* regtasks1.js - Regelungstechnik-Lab: Aufgaben rg1 bis rg15 (WP4a), Prüfung headless mit REG_CORE.runSeq und den Prüfständen.
 * Meldet sich mit REG_TASKS.register([...]) bei regdata.js an (Registry, Hilfsfunktionen in REG_TASKS.util). Benötigt regcore.js und die sieben Prüfstände.
 * Regeln: (1) Zahlen in hint[1], hint[2] und im Lösungsweg kommen aus hintVals() (Simulation, Prüfstand, Kern), nie von Hand.
 *   (2) Jede Prüfzeile sagt nur, was geprüft wurde; Zahlen im Warum-Text sind gemessen.
 *   (3) Schwellen stammen aus der simulierten Musterlösung (Reserve 25 % bei Zeiten und Abweichungen, 3 Prozentpunkte beim Überschwingen) und werden zur Laufzeit
 *       neu gerechnet (Funktionen muster*, Stand der Modelle: Kern 1.0); feste Zahlen sind nur Vorgaben aus dem Aufgabentext (mit „Auftrag“ gekennzeichnet).
 *   (4) Die Prüfung bewertet Verhalten: Szenario fest (Seed 1), nur die Steuerwerte der Liste `own` kommen vom Lernenden.
 * Rechenaufgaben (rg10) laufen über REG_CORE.exercise(...).check. Keine Prüfungs-Pool-Fragen, keine festen Kennwerte im Text (alles aus identify()). */
(function (root) {
  'use strict';
  if (!root.REG_TASKS && typeof require === 'function') { try { require('./regdata.js'); } catch (e) { /* ohne regdata.js keine Registry */ } }
  const T = root.REG_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('regtasks1.js: regdata.js fehlt, Aufgaben nicht registriert.'); return; }
  const U = T.util, fm = U.fm, fin = U.fin, smp = U.smp;
  const CORE = () => root.REG_CORE, RIGS = () => root.REG_RIGS;
  const cache = {}; const once = (k, f) => (k in cache ? cache[k] : (cache[k] = f()));
  const mkRig = (id, ctl) => { const r = RIGS().create(id, { seed: 1 }); Object.keys(ctl || {}).forEach(k => r.setControl(k, ctl[k])); return r; };
  const rigName = id => { const d = RIGS() && RIGS().defs[id]; return d ? d.name : id; };
  const round = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const hv = (t, fn) => U.memo(t, 'vals', fn);                              // hintVals() zwischenspeichern
  const hn = (t, fn) => { const h = U.memo(t, 'hint', () => fn(t.hintVals())); return Array.isArray(h) ? h : ['Der Hinweis konnte nicht gerechnet werden (Kern oder Prüfstand fehlt).', 'Der Hinweis konnte nicht gerechnet werden.', 'Der Lösungsweg konnte nicht gerechnet werden.']; };
  const mean = U.mean;
  const bad = x => !fin(x);
  const oscBad = s => !!s && (U.faultHas(s, 'dauer') || U.faultHas(s, 'auf') || (s.final && (s.final.osc === 'dauerschwingung' || s.final.osc === 'aufschaukelnd')));
  const tShow = (s, unit) => (CORE() ? CORE().fmtTime(s, unit) : fm(s, 1) + ' s');

  /* ====================================================================== Simulationen der Aufgaben */
  /* ---- rg2: Handbetrieb Füllstand ---- */
  const OWN2 = ['mode', 'yHand'];
  const sim2 = ci => {
    const ctl = U.fullCtl('fuellstand', { mode: 'hand', yHand: 20, w: 50, z: 0, outflow: 'sqrt', noise: 0 });
    const mode = ci.mode || 'hand', y = fin(ci.yHand) ? ci.yHand : 20;
    return { y, mode, s: U.run('fuellstand', ctl, [], 600, { op: { y: 20 }, after: { mode, yHand: y }, sampleS: 1 }) };
  };
  /* ---- rg3: P-Regler Füllstand ---- */
  const OWN3 = ['mode', 'ctrl', 'kp', 'u0', 'dir'];
  const BASE3 = () => U.fullCtl('fuellstand', { mode: 'auto', ctrl: 'P', kp: 2, tv: 0, u0: 0, dir: 'direkt', w: 40, z: 0, noise: 0, outflow: 'sqrt', ymax: 100 });
  const sim3 = ci => U.run('fuellstand', Object.assign(BASE3(), ci), [], 600, { sampleS: 1 });
  const eLast = (s, w, T0, T1) => w - U.winMean(smp(s), T0, T1, x => x.x);
  /* ---- rg4: Kühlschrank ---- */
  const OWN4 = ['dir'];
  const BASE4 = () => U.fullCtl('thermostat', { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 5, hyst: 2, fb: 0, lockout: 'aus', z: 0, noise: 0, power: true });
  const sim4 = ci => U.run('thermostat', Object.assign(BASE4(), ci), [], 28800, { sampleS: 30 });
  const muster4 = () => once('m4', () => {
    const s = sim4({ dir: 'invers' }), L = smp(s), t0 = 28800 - 10800;
    const mn = U.winMin(L, t0, 28800, x => x.x), mx = U.winMax(L, t0, 28800, x => x.x), w = 5;
    return { mean: U.winMean(L, t0, 28800, x => x.x), min: mn, max: mx, half: Math.max(w - mn, mx - w), band: 1.25 * Math.max(w - mn, mx - w), w };
  });
  /* ---- rg5: Bügeleisen ---- */
  const OWN5 = ['hyst', 'fb'];
  const BASE5 = () => U.fullCtl('thermostat', { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 30, fb: 0, z: 0, noise: 0, power: true });
  const sim5 = ci => U.run('thermostat', Object.assign(BASE5(), ci), [], 2400, { op: { y: 0, x0: 150 }, after: { mode: 'auto' }, sampleS: 0.5 });
  function cyc5(s) {   // Schwankungsbreite und Mittelwert der letzten 5 Schaltspiele (wahre Temperatur)
    const L = smp(s), t0 = U.cycleStart(L, 'sw', 5);
    if (!fin(t0)) return null;
    const tE = L.length ? L[L.length - 1].t : 0;
    return { t0, swing: U.winP2P(L, t0, tE, x => x.x), mean: U.winMean(L, t0, tE, x => x.x), cycles: 5 };
  }
  /* ---- rg8: P-Regler Drehzahl ---- */
  const OWN8 = ['mode', 'ctrl', 'kp', 'u0', 'dir'];
  const BASE8 = () => U.fullCtl('drehzahl', { mode: 'auto', ctrl: 'P', kp: 2, tv: 0, u0: 0, dir: 'direkt', w: 1500, z: 0, noise: 0, ymax: 100, ta: 0.005 });
  const sim8 = ci => U.run('drehzahl', Object.assign(BASE8(), ci), [], 4, { sampleS: 0.005 });
  /* ---- rg9: PI-Regler Lage ---- */
  const OWN9 = ['mode', 'ctrl', 'kp', 'tn', 'tv', 'aw', 'u0', 'dir'];
  const BASE9 = () => U.fullCtl('position', { mode: 'auto', ctrl: 'P', kp: 2, tn: 2, tv: 0, aw: 'rueck', u0: 50, dir: 'direkt', w: 60, z: 10, friction: 0, backlash: 0, noise: 0, ymax: 100, ta: 0.002 });
  const sim9 = ci => U.run('position', Object.assign(BASE9(), ci), [], 30, { sampleS: 0.01 });
  /* ---- rg11: Störung am Füllstand ---- */
  const OWN11 = ['ctrl', 'kp', 'tn', 'tv', 'aw', 'dir'], TZ11 = 30;
  const BASE11 = () => U.fullCtl('fuellstand', { mode: 'auto', ctrl: 'P', kp: 2, tn: 60, tv: 0, aw: 'rueck', u0: 0, dir: 'direkt', w: 50, z: 0, noise: 0, outflow: 'sqrt', ymax: 100, ta: 0.05 });
  const SEQ11 = [{ t: 0, set: { mode: 'auto' } }, { t: TZ11, set: { z: 60 } }];
  const sim11 = ci => U.run('fuellstand', Object.assign(BASE11(), ci), SEQ11, 600, { op: { y: 50 }, sampleS: 0.5 });
  const dist11 = s => CORE().disturbMetrics(smp(s).map(x => x.t), smp(s).map(x => x.x), { w: 50, tz: TZ11, range: 100, unit: 'cm' });
  const muster11 = () => once('m11', () => {   // Musterlösung: PI, Kp 5, Tn 40 s (Stand: Kern 1.0)
    const ci = { ctrl: 'PI', kp: 5, tn: 40, tv: 0, aw: 'rueck' }, s = sim11(ci), d = dist11(s);
    return { ci, xdMax: Math.abs(d.xdMax), tAus: d.tAus, xdLim: 1.25 * Math.abs(d.xdMax), tLim: 1.25 * d.tAus, band: d.band };
  });
  /* ---- rg12: PI-Einstellung Raum ---- */
  const OWN12 = ['ctrl', 'kp', 'tn', 'tv', 'aw', 'dir'];
  const BASE12 = () => U.fullCtl('raumtemp', { mode: 'auto', ctrl: 'PI', kp: 6, tn: 1800, tv: 0, aw: 'rueck', u0: 0, dir: 'direkt', w: 18, z: 0, tOut: -5, window: false, noise: 0, ymax: 100, ta: 1 });
  const op12 = () => ({ y: round(mkRig('raumtemp', { w: 18 }).yFor(18), 2) });
  const SEQ12 = [{ t: 0, set: { mode: 'auto' } }, { t: 600, set: { w: 21 } }];
  const sim12 = (ci, T0) => U.run('raumtemp', Object.assign(BASE12(), ci), SEQ12, T0 || 28800, { op: op12(), sampleS: 30 });
  const muster12 = () => once('m12', () => {   // Musterlösungen: PI nach T-Summe (Betragsoptimum) und nach CHR (Führung, aperiodisch und 20 %), soweit sie höchstens 15 % überschwingen
    const id = U.idAt('raumtemp', { w: 18 }, op12().y).id, out = {};
    ['tsumme', 'chr-fuehr-20', 'chr-fuehr-0'].forEach(mth => {
      const a = CORE().rules.apply(mth, { Ks: id.Ks, Tu: id.Tu, Tg: id.Tg, Tsum: id.Tsum, TsumKlein: id.TsumKlein, T1: id.T1, T2: id.T2 }, 'PI');
      const ci = { ctrl: 'PI', kp: a.Kp, tn: a.Tn, tv: 0, aw: 'rueck' }, m = sim12(ci).metrics.step;
      out[mth] = { ci, ueber: m.ueberPct, tAus2: m.tAus2, apply: a };
    });
    const gueltig = Object.keys(out).filter(k => out[k].ueber <= 15), tMax = Math.max.apply(null, gueltig.map(k => out[k].tAus2));
    return { ci: out.tsumme.ci, ueber: out.tsumme.ueber, tAus2: out.tsumme.tAus2, tLim: 1.25 * tMax, tMax, gueltig, methods: out, id, apply: out.tsumme.apply };
  });
  /* ---- rg13: Z-N Sprungantwort Raum ---- */
  const ref13 = () => once('r13', () => {
    const o = U.idAt('raumtemp', {}, 40), id = o.id, a = CORE().rules.apply('zn-sprung', { Ks: id.Ks, Tu: id.Tu, Tg: id.Tg }, 'PI');
    return { id, Ks: id.Ks, Tu: id.Tu, Tg: id.Tg, Kp: a.Kp, Tn: a.Tn, apply: a };
  });
  /* ---- rg14: Schwingversuch Durchfluss ---- */
  const BASE14 = () => U.fullCtl('durchfluss', { mode: 'auto', ctrl: 'P', kp: 1, tn: 5, tv: 0, u0: 40, dir: 'direkt', w: 50, z: 0, char: 'linear', slew: '0', noise: 0, ymax: 100, ta: 0.02 });
  const ref14 = () => once('r14', () => { const id = U.idAt('durchfluss', { char: 'linear', z: 0 }, 40).id; return { id, Kkrit: id.Kkrit, Tkrit: id.Tkrit }; });
  const sim14 = kp => U.run('durchfluss', Object.assign(BASE14(), { kp }), [{ t: 0, set: { mode: 'auto' } }, { t: 1, set: { w: 60 } }], 90, { op: { y: 40 }, sampleS: 0.02 });
  const verdict14 = kp => once('v14_' + kp, () => { const s = sim14(kp), m = s.metrics && s.metrics.step; return m && m.cls ? m.cls.cls : null; });
  /* ---- rg15: Anti-Windup Drehzahl ---- */
  const OWN15 = ['ctrl', 'kp', 'tn', 'tv', 'aw', 'dir'];
  const BASE15 = () => U.fullCtl('drehzahl', { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, tv: 0, aw: 'aus', u0: 0, dir: 'direkt', w: 0, z: 0, noise: 0, ymax: 60, ta: 0.005 });
  const SEQ15 = [{ t: 0, set: { mode: 'auto' } }, { t: 0.5, set: { w: 1200 } }];
  const sim15 = ci => U.run('drehzahl', Object.assign(BASE15(), ci), SEQ15, 6, { op: { y: 0 }, sampleS: 0.005 });
  const muster15 = () => once('m15', () => {   // Musterlösungen: beide gültigen Verfahren (klemmen, rückrechnen) mit Kp 2, Tn 0,2 s
    const a = sim15({ aw: 'klemmen' }).metrics.step, b = sim15({ aw: 'rueck' }).metrics.step, c = sim15({ aw: 'aus' }).metrics.step;
    const tMax = Math.max(a.tAus2, b.tAus2);
    return { ueberKlemmen: a.ueberPct, ueberRueck: b.ueberPct, ueberAus: c.ueberPct, tKlemmen: a.tAus2, tRueck: b.tAus2, tLim: 1.25 * tMax, w1: 1200, nMax: mkRig('drehzahl').steady(60) };
  });

  /* ====================================================================== rg1: Zuordnung */
  const TERM = { w: 'Führungsgröße w (Sollwert)', x: 'Regelgröße x (Istwert)', y: 'Stellgröße y', z: 'Störgröße z', stell: 'Stellglied', mess: 'Messglied' };
  const GID = { w: 'w', x: 'x', y: 'y', z: 'z', stell: 'stellglied', mess: 'messglied' };
  const KEYS1 = ['w', 'x', 'y', 'z', 'stell', 'mess'], PERM1 = { w: [3, 5, 0, 2, 4, 1], x: [4, 1, 5, 0, 3, 2], y: [2, 3, 1, 5, 0, 4], z: [5, 0, 4, 1, 2, 3], stell: [1, 4, 2, 3, 5, 0] };
  const roles1 = () => mkRig('fuellstand').roles;
  const glossText = id => { const C = CORE(); const g = C && C.glossary && C.glossary.get ? C.glossary.get(id) : null; return g && g.text ? g.text : ''; };
  function check1(a) {
    try {
      const rl = roles1(), ch = U.isObj(a) && U.isObj(a.choices) ? a.choices : {}, rows = [];
      ['w', 'x', 'y', 'z', 'stell'].forEach(k => {
        const got = ch[k], right = got !== undefined && got !== null && String(got) === String(rl[k]);
        let why = '';
        if (!right) {
          if (got === undefined || got === null || got === '') why = 'Du hast noch nichts gewählt.';
          else {
            const k2 = KEYS1.find(q => rl[q] === got);
            why = '„' + got + '“ ist' + (k2 ? ' die Rolle „' + TERM[k2] + '“' : ' hier nicht gemeint') + ', nicht die ' + TERM[k] + '. ' + glossText(GID[k]);
          }
        }
        rows.push({ ok: right, text: TERM[k] + ' richtig zugeordnet', why });
      });
      return rows;
    } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
  }

  /* ====================================================================== rg2 */
  const check2 = U.mk('fuellstand', OWN2, (c, r, a) => {
    const ci = U.initial(c, OWN2), q = sim2(ci), s = q.s, L = smp(s), f = s.final || {};
    U.inputRow(c, r, s, a, 'fuellstand');
    r(q.mode === 'hand', 'Der Prüfstand läuft im Handbetrieb', 'Im Automatikbetrieb stellt der Regler die Pumpe ein, nicht du. Schalte auf „hand“ und stelle die Handstellgröße ein.');
    const x = U.winMean(L, 570, 600, v => v.x), drift = Math.abs(x - U.winMean(L, 540, 570, v => v.x));
    const st = q.mode === 'hand' ? mkRig('fuellstand', { z: 0 }).steady(q.y) : NaN;
    const near = Math.abs(x - 32) <= 2 && drift <= 0.5;
    let why = 'Gemessen: ' + fm(x, 1) + ' cm nach 600 s Prozesszeit (Soll 32 cm, erlaubt ±2 cm).';
    if (drift > 0.5) why += ' Der Füllstand steht noch nicht still (Änderung ' + fm(drift, 1) + ' cm in 30 s).';
    else if (fin(st) && st < 30) why += ' Bei der Handstellgröße ' + fm(q.y, 1) + ' % liegt der Beharrungswert bei ' + fm(st, 1) + ' cm: Die Pumpe fördert zu wenig, erhöhe die Handstellgröße.';
    else if (fin(st) && st > 34) why += ' Bei der Handstellgröße ' + fm(q.y, 1) + ' % liegt der Beharrungswert bei ' + fm(st, 1) + ' cm: Die Pumpe fördert zu viel, verkleinere die Handstellgröße.';
    r(near, 'Der Füllstand pendelt sich bei 32 cm ein (Abweichung höchstens 2 cm)', why);
    r(!U.faultHas(s, 'ueberlauf') && !f.overflow, 'Der Tank läuft nicht über', 'Die Anlage meldet einen Überlauf: Die Pumpe fördert mehr, als die Entnahme abführt, und der Tank ist voll (Füllstand 100 cm).');
  });
  /* ====================================================================== rg3 */
  const check3 = U.mk('fuellstand', OWN3, (c, r, a) => {
    const ci = U.initial(c, OWN3), cc = Object.assign({}, { mode: 'auto', ctrl: 'P' }, ci), s = sim3(ci), L = smp(s), f = s.final || {};
    U.inputRow(c, r, s, a, 'fuellstand');
    r(cc.mode === 'auto', 'Der Prüfstand läuft im Automatikbetrieb', 'Im Handbetrieb ist der Regler abgeschaltet. Schalte auf „auto“.');
    r(cc.ctrl === 'P', 'Der Regler ist ein P-Regler (Reglerart P)', 'Eingestellt ist die Reglerart „' + cc.ctrl + '“. Die Aufgabe verlangt einen reinen P-Regler (ohne I- und D-Anteil).');
    r(!U.faultHas(s, 'ueberlauf') && !f.overflow, 'Der Tank läuft nicht über', 'Die Anlage meldet einen Überlauf. Prüfe Wirkungssinn und Kp.');
    r(!oscBad(s), 'Es gibt keine Dauerschwingung', 'Der Regelkreis schwingt dauernd oder schaukelt sich auf: Die Kreisverstärkung ist zu groß. Verkleinere Kp.');
    const x = U.winMean(L, 540, 600, v => v.x), e = 40 - x;
    let why = 'Gemessen: ' + fm(x, 1) + ' cm, das sind ' + fm(Math.abs(e), 1) + ' cm ' + (e > 0 ? 'unter' : 'über') + ' dem Sollwert 40 cm (erlaubt 6 cm).';
    if (e > 6) why += ' Ein P-Regler lässt eine bleibende Regelabweichung zurück; sie wird mit größerem Kp kleiner. Erhöhe Kp.';
    r(Math.abs(e) <= 6, 'Der Füllstand liegt im Mittel höchstens 6 cm neben dem Sollwert 40 cm', why);
  });
  /* ====================================================================== rg4 */
  const check4 = U.mk('thermostat', OWN4, (c, r, a) => {
    const ci = U.initial(c, OWN4), s = sim4(ci), L = smp(s), m = muster4();
    U.inputRow(c, r, s, a, 'thermostat');
    const dir = ci.dir || 'direkt';
    r(!U.faultHas(s, 'wirk'), 'Die Anlage meldet keinen falschen Wirkungssinn', 'Eingestellt ist der Wirkungssinn „' + dir + '“: Der Regler schaltet den Verdichter ein, wenn der Istwert unter dem Sollwert liegt (e = w − x > 0). Ein Kühlschrank muss einschalten, wenn es zu warm ist.');
    const mean5 = U.winMean(L, 28800 - 10800, 28800, v => v.x);
    let why = 'Gemessen: mittlere Temperatur der letzten 3 h Prozesszeit ' + fm(mean5, 1) + ' °C statt ' + fm(m.w, 0) + ' °C.';
    if (mean5 > m.w + m.band) why += ' Der Kühlschrank kühlt nicht: Er wird wärmer, bis er die Umgebungstemperatur erreicht.';
    r(Math.abs(mean5 - m.w) <= m.band, 'Die Temperatur hält sich im Mittel beim Sollwert ' + fm(m.w, 0) + ' °C (erlaubt ±' + fm(m.band, 1) + ' K)', why);
  });
  /* ====================================================================== rg5 */
  const check5 = U.mk('thermostat', OWN5, (c, r, a) => {
    const ci = U.initial(c, OWN5), s = sim5(ci), k = cyc5(s), hy = fin(ci.hyst) ? ci.hyst : 30;
    U.inputRow(c, r, s, a, 'thermostat');
    let why = k ? 'Gemessen: ' + fm(k.swing, 1) + ' K Spitze-Spitze in den letzten 5 Schaltspielen (Schaltdifferenz ' + fm(hy, 1) + ' K).' : 'In 2400 s Prozesszeit gab es weniger als 5 vollständige Schaltspiele: Es lässt sich keine Schwankungsbreite messen.';
    if (k && k.swing > 12) why += (k.swing > hy ? ' Die Schwankungsbreite ist größer als die Schaltdifferenz, weil der Fühler träge ist und die Sohle nachläuft. ' : ' ') + 'Verkleinere die Schaltdifferenz.';
    r(!!k && k.swing <= 12, 'Die Schwankungsbreite der Sohlentemperatur beträgt höchstens 12 K (letzte 5 Schaltspiele)', why);
    r(!!k && Math.abs(k.mean - 150) <= 5, 'Die mittlere Temperatur liegt bei 150 °C (±5 K)', k ? 'Gemessen: Mittelwert ' + fm(k.mean, 1) + ' °C.' : 'Ohne ausgewertete Schaltspiele gibt es keinen Mittelwert.');
    r(!U.faultHas(s, 'flatter'), 'Der Schalter flattert nicht', 'Der Schalter schaltet schneller, als der Fühler folgen kann (Schaltspielzeit kürzer als das Dreifache der Fühlerzeitkonstante): Die Schaltdifferenz ist zu klein. Vergrößere sie.');
  });
  /* ====================================================================== rg6 */
  const OWN6 = ['mode', 'yHand'], SEQKEYS6 = ['mode', 'yHand'];
  const check6 = U.mk('raumtemp', OWN6, (c, r, a) => {
    const seq = c.seq.map(e => { const o = { t: e.t }; if (e.set) { o.set = {}; SEQKEYS6.forEach(k => { if (e.set[k] !== undefined) o.set[k] = e.set[k]; }); } if (e.ramp && e.ramp.key === 'yHand') o.ramp = e.ramp; return o; });
    const ci = U.initial(c, OWN6), ctl = U.fullCtl('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 });
    const s = U.run('raumtemp', ctl, seq, 21600, { op: { y: 40 }, after: { mode: 'hand', yHand: 40 }, sampleS: 30 }), L = smp(s), f = s.final || {};
    U.inputRow(c, r, s, a, 'raumtemp');
    const ys = L.map(v => v.y), dy = ys.length ? Math.max(...ys) - Math.min(...ys) : 0, kw = U.isObj(a) && U.isObj(a.kennwerte) && fin(a.kennwerte.Ks);
    r(f.mode === 'hand', 'Der Prüfstand bleibt im Handbetrieb (offener Kreis)', 'Im Ablauf wird die Betriebsart auf Automatik umgeschaltet. Für die Sprungantwort musst du im Handbetrieb bleiben: Der Regler würde sonst die Antwort der Strecke verändern.');
    r(dy >= 5 || kw, 'Es liegt eine Sprungantwort vor: Im Ablauf springt die Handstellgröße um mindestens 5 % oder der Tab „Strecke messen“ hat Kennwerte gespeichert', 'Im Ablauf ändert sich die Handstellgröße um höchstens ' + fm(dy, 1) + ' % und im Tab „Strecke messen“ sind keine Kennwerte gespeichert. Ändere die Handstellgröße im Ablauf von 40 % auf 50 % oder nimm die Sprungantwort im Tab „Strecke messen“ auf.');
    const v = U.numAns(a), ref = ref13().Ks, dyU = dy >= 5 ? dy : 10, dxPct = ref * dyU;
    let why = 'Du hast keine Zahl in das Antwortfeld eingetragen.';
    if (v !== null) {
      why = 'Dein Wert ' + fm(v, 3) + ' weicht um mehr als 10 % von der Streckenverstärkung ab.';
      if (Math.abs(v - dxPct * 20 / 100 / dyU) <= 0.1 * Math.abs(dxPct * 20 / 100 / dyU)) why = 'Du hast die Änderung von x in Kelvin durch die Änderung von y in % geteilt. Ks ist dimensionslos: Rechne x in % des Messbereichs (10 bis 30 °C = 20 K gleich 100 %).';
      else if (Math.abs(v - 1 / ref) <= 0.1 / ref) why = 'Du hast den Kehrwert gerechnet (Δy durch Δx). Ks = Δx durch Δy.';
      else if (Math.abs(v - dxPct) <= 0.1 * dxPct) why = 'Das ist die Änderung von x in %. Teile sie noch durch die Änderung von y (' + fm(dyU, 0) + ' %).';
    }
    r(v !== null && Math.abs(v - ref) <= 0.1 * ref, 'Die Streckenverstärkung Ks stimmt (Toleranz 10 %)', why);
  });
  /* ====================================================================== rg7 */
  const PLANTS7 = [{ rig: 'fuellstand', ctl: {} }, { rig: 'position', ctl: {} }, { rig: 'baukasten', ctl: { type: 'pt2' } }, { rig: 'baukasten', ctl: { type: 'it1' } }, { rig: 'drehzahl', ctl: {} }];
  const label7 = p => { const d = RIGS().defs[p.rig]; let t = d.name; if (p.ctl.type) { const o = ((d.controls || []).find(c => c.key === 'type') || {}).options || []; const m = o.find(x => x.value === p.ctl.type); t += ' (Streckenart ' + (m ? String(m.label).split(':')[0] : p.ctl.type) + ')'; } return t; };
  const art7 = p => U.idAt(p.rig, p.ctl, null).id;
  const plantInfo7 = p => once('p7_' + p.rig + (p.ctl.type || ''), () => { const id = art7(p); return { art: id.art, Ks: id.Ks, Kis: id.Kis, label: label7(p), rigName: rigName(p.rig) }; });
  function check7(a) {
    try {
      const ch = U.isObj(a) && U.isObj(a.choices) ? a.choices : {}, rows = [];
      PLANTS7.forEach((p, i) => {
        const info = plantInfo7(p), got = ch['a' + (i + 1)], ok = got === info.art;
        let why = '';
        if (!ok) {
          if (got === undefined || got === null || got === '') why = 'Du hast noch nichts gewählt.';
          else if (info.art === 'I') why = 'Diese Strecke hat einen Integrator (Integrierbeiwert Kis = ' + fm(info.Kis, 3) + ' je Sekunde): Bei einer festen Stellgröße steigt der Istwert immer weiter, er stellt sich nie auf einen Endwert ein.';
          else why = 'Diese Strecke stellt sich bei einer festen Stellgröße auf einen Endwert ein (Streckenverstärkung Ks = ' + fm(info.Ks, 3) + '): Sie hat einen Ausgleich.';
        }
        rows.push({ ok, text: 'Streckenart der Anlage „' + info.label + '“ richtig bestimmt', why });
      });
      return rows;
    } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
  }
  /* ====================================================================== rg8 */
  const check8 = U.mk('drehzahl', OWN8, (c, r, a) => {
    const ci = U.initial(c, OWN8), cc = Object.assign({ mode: 'auto', ctrl: 'P' }, ci), s = sim8(ci), L = smp(s);
    U.inputRow(c, r, s, a, 'drehzahl');
    r(cc.mode === 'auto', 'Der Prüfstand läuft im Automatikbetrieb', 'Im Handbetrieb ist der Regler abgeschaltet. Schalte auf „auto“.');
    r(cc.ctrl === 'P', 'Der Regler ist ein P-Regler (Reglerart P)', 'Eingestellt ist die Reglerart „' + cc.ctrl + '“. Die Aufgabe verlangt einen reinen P-Regler.');
    r(!oscBad(s), 'Die Drehzahl schwingt nicht dauernd', 'Der Regelkreis schwingt dauernd oder schaukelt sich auf: Kp ist zu groß. Verkleinere Kp und gleiche die Abweichung stattdessen mit dem Arbeitspunkt u0 aus.');
    const x = U.winMean(L, 3.5, 4, v => v.x), e = 1500 - x, lim = 0.03 * 1500;
    let why = 'Gemessen: ' + fm(x, 0) + ' 1/min, das sind ' + fm(Math.abs(e) / 15, 1) + ' % von 1500 1/min neben dem Sollwert (erlaubt 3 %).';
    if (e > lim) why += ' Der P-Regler stellt y = u0 + Kp · e. Mit u0 = 0 braucht er eine große Regeldifferenz, um die Stellgröße für 1500 1/min zu erzeugen. Setze u0 auf die Stellgröße, die zu 1500 1/min gehört.';
    r(Math.abs(e) <= lim, 'Die bleibende Abweichung bei 1500 1/min beträgt höchstens 3 % (45 1/min)', why);
  });
  /* ====================================================================== rg9 */
  const check9 = U.mk('position', OWN9, (c, r, a) => {
    const ci = U.initial(c, OWN9), cc = Object.assign({ mode: 'auto', ctrl: 'P' }, ci), s = sim9(ci), L = smp(s);
    U.inputRow(c, r, s, a, 'position');
    r(cc.mode === 'auto', 'Der Prüfstand läuft im Automatikbetrieb', 'Im Handbetrieb ist der Regler abgeschaltet. Schalte auf „auto“.');
    const e20 = 60 - U.winMean(L, 19, 20, v => v.x);
    r(['I', 'PI', 'PID'].includes(cc.ctrl), 'Der Regler hat einen I-Anteil (Reglerart I, PI oder PID)', 'Eingestellt ist die Reglerart „' + cc.ctrl + '“. Bei einer Strecke ohne Ausgleich verschiebt die Last z den Istwert eines P-Reglers bleibend (gemessen nach 20 s: ' + fm(Math.abs(e20), 2) + ' mm Abweichung). Nur ein I-Anteil gleicht die Last aus.');
    r(!oscBad(s), 'Die Position schwingt nicht dauernd', 'Der Regelkreis schwingt dauernd oder schaukelt sich auf: Kp ist zu groß oder die Nachstellzeit Tn zu klein. Verkleinere Kp oder vergrößere Tn.');
    let why = 'Gemessen: Die Position liegt nach 20 s ' + fm(Math.abs(e20), 2) + ' mm neben dem Sollwert 60 mm (erlaubt 0,5 mm).';
    if (Math.abs(e20) > 0.5 && ['I', 'PI', 'PID'].includes(cc.ctrl)) why += ' Der I-Anteil wirkt zu langsam: Verkleinere die Nachstellzeit Tn.';
    r(Math.abs(e20) <= 0.5, 'Die Last verschiebt die Position nach 20 s höchstens um 0,5 mm', why);
  });
  /* ====================================================================== rg10 */
  const SEEDS10 = [3, 1, 6];
  const ex10 = () => once('ex10', () => SEEDS10.map(sd => CORE().exercise('xp', sd)));
  const fields10 = () => ex10().map((e, i) => ({ key: 'a' + (i + 1), question: 'Aufgabe ' + (i + 1) + ': ' + e.question, label: 'Aufgabe ' + (i + 1), unit: e.answer.unit || '' }));
  function check10(a) {
    try {
      const rows = [];
      ex10().forEach((e, i) => {
        const v = U.fieldNum(a, 'a' + (i + 1));
        if (v === null) rows.push({ ok: false, text: 'Aufgabe ' + (i + 1) + ': Das Ergebnis stimmt', why: 'Du hast keine Zahl eingetragen. Schreibe zum Beispiel 2,5.' });
        else { const res = e.check(String(v).replace('.', ',')); rows.push({ ok: !!res.ok, text: 'Aufgabe ' + (i + 1) + ': Das Ergebnis stimmt', why: res.ok ? '' : res.text }); }
      });
      return rows;
    } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
  }
  /* ====================================================================== rg11 */
  const check11 = U.mk('fuellstand', OWN11, (c, r, a) => {
    const ci = U.initial(c, OWN11), s = sim11(ci), m = muster11(), d = dist11(s);
    U.inputRow(c, r, s, a, 'fuellstand');
    const xd = d && d.ok !== false && fin(d.xdMax) ? Math.abs(d.xdMax) : NaN;
    r(fin(xd) && xd <= m.xdLim, 'Die größte Abweichung nach dem Öffnen des Entnahmeventils beträgt höchstens ' + fm(m.xdLim, 1) + ' cm', fin(xd) ? 'Gemessen: ' + fm(xd, 1) + ' cm ' + (d.xdMax < 0 ? 'unter' : 'über') + ' dem Sollwert 50 cm, mehr als der Musterwert mit Reserve erlaubt. Damit der Regler die Störung früher abfängt: Erhöhe Kp oder (bei PI) verkleinere Tn.' : 'Die Abweichung konnte nicht gemessen werden: ' + (d && d.why || ''));
    const tA = d ? d.tAus : null;
    r(tA !== null && tA !== undefined && tA <= m.tLim, 'Der Füllstand ist nach höchstens ' + fm(m.tLim, 0) + ' s wieder im Band von ±' + fm(m.band, 0) + ' cm um den Sollwert', tA === null || tA === undefined ? 'Der Füllstand kommt innerhalb von 600 s Prozesszeit nicht dauerhaft ins Band: ' + (d && d.tAusWhy || '') : 'Gemessen: ' + fm(tA, 1) + ' s, länger als der Musterwert mit Reserve.' + (oscBad(s) ? ' Der Regelkreis schwingt: Verkleinere Kp.' : ' Erhöhe Kp oder verkleinere Tn.'));
    const eb = d && fin(d.eblStoer) ? Math.abs(d.eblStoer) : NaN;
    r(fin(eb) && eb <= 0.5, 'Die Störung wird ausgeregelt: Die bleibende Abweichung ist höchstens 0,5 cm', fin(eb) ? 'Gemessen: ' + fm(eb, 2) + ' cm bleiben übrig. Ein Regler ohne I-Anteil kann eine Störung nicht ganz ausregeln: Nimm einen PI-Regler.' : 'Die bleibende Abweichung konnte nicht gemessen werden.');
    r(!oscBad(s), 'Es gibt keine Dauerschwingung', 'Der Regelkreis schwingt dauernd oder schaukelt sich auf: Kp ist zu groß. Verkleinere Kp.');
  });
  /* ====================================================================== rg12 */
  const check12 = U.mk('raumtemp', OWN12, (c, r, a) => {
    const ci = U.initial(c, OWN12), s = sim12(ci), m = muster12(), st = s.metrics && s.metrics.step;
    U.inputRow(c, r, s, a, 'raumtemp');
    const ue = st && fin(st.ueberPct) ? st.ueberPct : NaN;
    r(fin(ue) && ue <= 15, 'Das Überschwingen beträgt höchstens 15 % des Sollwertsprungs', fin(ue) ? 'Gemessen: ' + fm(ue, 1) + ' %. Der Sprung 18 auf 21 °C ist 3 K groß; die Raumtemperatur steigt also um ' + fm(ue * 3 / 100, 2) + ' K über 21 °C. Verkleinere Kp oder vergrößere die Nachstellzeit Tn.' : 'Das Überschwingen konnte nicht gemessen werden.');
    r(!oscBad(s) && !(st && st.cls && (st.cls.cls === 'dauerschwingung' || st.cls.cls === 'aufschaukelnd')), 'Es gibt keine Dauerschwingung', 'Der Regelkreis schwingt dauernd oder schaukelt sich auf: Die Kreisverstärkung ist zu groß. Verkleinere Kp oder vergrößere Tn.');
    const t2 = st ? st.tAus2 : null;
    r(t2 !== null && t2 !== undefined, 'Die Raumtemperatur wird auf 21 °C ausgeregelt (Ausregelzeit für das 2-%-Band ist endlich)', 'Die Raumtemperatur kommt in 8 h Prozesszeit nicht dauerhaft ins 2-%-Band um 21 °C' + (st && st.tAus2Why ? ': ' + st.tAus2Why : '.') + ' Ein Regler ohne I-Anteil regelt nicht aus; ein sehr kleiner Kp oder ein sehr großes Tn macht den Regler zu träge.');
    r(t2 !== null && t2 !== undefined && t2 <= m.tLim, 'Die Ausregelzeit (2 %) beträgt höchstens ' + fm(m.tLim / 60, 0) + ' min', t2 === null || t2 === undefined ? 'Ohne Ausregelzeit gibt es nichts zu vergleichen.' : 'Gemessen: ' + fm(t2 / 60, 0) + ' min Prozesszeit.' + (fin(ue) && ue > 5 ? ' Die Raumtemperatur überschwingt (' + fm(ue, 1) + ' %) und pendelt lange nach: Verkleinere Kp oder vergrößere Tn.' : ' Der Regler stellt langsamer nach als die Musterlösung: Erhöhe Kp oder verkleinere Tn.'));
  });
  /* ====================================================================== rg13 */
  const OWN13 = [];
  const fields13 = () => [{ key: 'Ks', label: 'Streckenverstärkung Ks', unit: '' }, { key: 'Tu', label: 'Verzugszeit Tu', unit: 'min' }, { key: 'Tg', label: 'Ausgleichszeit Tg', unit: 'min' }, { key: 'kp', label: 'Kp (PI-Regler)', unit: '' }, { key: 'tn', label: 'Nachstellzeit Tn (PI-Regler)', unit: 'min' }];
  const check13 = U.mk('raumtemp', OWN13, (c, r, a) => {
    const f = k => U.fieldNum(a, k), ref = ref13();
    const get = (k, unitMin) => { const v = f(k); if (v !== null) return unitMin ? v * 60 : v; return null; };
    const Ks = get('Ks'), Tu = get('Tu', true), Tg = get('Tg', true), kp = get('kp'), tn = get('tn', true);
    const tol = (v, w, p) => v !== null && Math.abs(v - w) <= p * Math.abs(w);
    const miss = 'Du hast keinen Wert eingetragen.';
    r(tol(Ks, ref.Ks, 0.1), 'Die Streckenverstärkung Ks stimmt (Toleranz 10 %)', Ks === null ? miss : 'Dein Wert ' + fm(Ks, 3) + ' weicht um mehr als 10 % ab. Ks = Änderung von x in % des Messbereichs (20 K gleich 100 %) geteilt durch die Änderung von y in %.');
    const tuWhy = v => v === null ? miss : 'Dein Wert ' + tShow(v, 'min') + ' weicht um mehr als 15 % ab. Lege die Wendetangente an die steilste Stelle der Kurve; Tu ist der Abstand zwischen dem Sprung und dem Schnittpunkt der Tangente mit der Anfangslinie.';
    r(tol(Tu, ref.Tu, 0.15), 'Die Verzugszeit Tu stimmt (Toleranz 15 %)', tuWhy(Tu));
    r(tol(Tg, ref.Tg, 0.15), 'Die Ausgleichszeit Tg stimmt (Toleranz 15 %)', Tg === null ? miss : 'Dein Wert ' + tShow(Tg, 'min') + ' weicht um mehr als 15 % ab. Tg ist der Abstand zwischen den Schnittpunkten der Wendetangente mit der Anfangslinie und mit der Endlinie.');
    const own = Ks !== null && Tu !== null && Tg !== null && Tu > 0 ? CORE().rules.apply('zn-sprung', { Ks, Tu, Tg }, 'PI') : null;
    const okKp = kp !== null && (tol(kp, ref.Kp, 0.2) || (own && own.ok && tol(kp, own.Kp, 0.05)));
    r(okKp, 'Kp stimmt nach Ziegler-Nichols (Sprungantwort, PI-Regler)', kp === null ? miss : 'Dein Wert ' + fm(kp, 2) + ' passt weder zur Rechnung mit den richtigen Kennwerten (±20 %) noch zu deinen eigenen Werten. Rechne Kp = 0,9 · Tg / (Ks · Tu) mit Tg und Tu in derselben Einheit.');
    const alts = [ref.Tn].concat((((CORE().rules.table.find(t => t.id === 'zn-sprung') || {}).rows || {}).PI || {}).Tn ? CORE().rules.table.find(t => t.id === 'zn-sprung').rows.PI.Tn.alt.map(k => k * ref.Tu) : []);
    const okTn = tn !== null && (alts.some(v => tol(tn, v, 0.2)) || (own && own.ok && tol(tn, own.Tn, 0.05)));
    r(okTn, 'Tn stimmt nach Ziegler-Nichols (Sprungantwort, PI-Regler; 3,33 · Tu und 3,3 · Tu gelten beide)', tn === null ? miss : 'Dein Wert ' + tShow(tn, 'min') + ' passt weder zur Rechnung mit den richtigen Kennwerten (±20 %) noch zu deinen eigenen Werten. Rechne Tn = Tu / 0,3 (gleich 3,33 · Tu).');
    let stable = false, why = 'Ohne Kp und Tn lässt sich der Regelkreis nicht simulieren.';
    if (kp !== null && tn !== null) {
      const s = sim12({ ctrl: 'PI', kp, tn, tv: 0, aw: 'rueck' }, 14400), st = s.metrics && s.metrics.step;
      stable = !oscBad(s) && !!st && !!st.cls && st.cls.cls !== 'aufschaukelnd' && st.cls.cls !== 'dauerschwingung' && fin(s.final && s.final.x);
      why = 'In der Simulation mit Kp = ' + fm(kp, 2) + ' und Tn = ' + tShow(tn, 'min') + ' schwingt der Regelkreis dauernd oder schaukelt sich auf. Verkleinere Kp oder vergrößere Tn.';
    }
    r(stable, 'Der Regelkreis mit deinen Werten Kp und Tn ist stabil (Simulation, Sollwertsprung 18 auf 21 °C)', why);
  });
  /* ====================================================================== rg14 */
  const OWN14 = [];
  const fields14 = () => [{ key: 'Kkrit', label: 'Kritische Verstärkung Kkrit', unit: '' }, { key: 'Tkrit', label: 'Periodendauer Tkrit', unit: 's' }];
  const check14 = U.mk('durchfluss', OWN14, (c, r, a) => {
    const ref = ref14(), kk = U.fieldNum(a, 'Kkrit'), tk = U.fieldNum(a, 'Tkrit');
    let why = 'Du hast keinen Wert eingetragen.';
    if (kk !== null) {
      why = 'Dein Wert ' + fm(kk, 2) + ' weicht um mehr als 10 % von der kritischen Verstärkung ab.';
      const v = verdict14(U.clamp(kk, 0.1, 100));
      if (kk < ref.Kkrit && v === 'gedaempft') why += ' Mit Kp = ' + fm(kk, 2) + ' klingt die Schwingung in der Simulation noch ab: Erhöhe Kp, bis sie gleich groß bleibt.';
      else if (kk > ref.Kkrit && (v === 'aufschaukelnd' || v === 'dauerschwingung')) why += ' Mit Kp = ' + fm(kk, 2) + ' klingt die Schwingung in der Simulation nicht mehr ab: Die kritische Verstärkung liegt darunter.';
    }
    r(kk !== null && Math.abs(kk - ref.Kkrit) <= 0.1 * ref.Kkrit, 'Die kritische Verstärkung Kkrit stimmt (Toleranz 10 %)', why);
    let w2 = 'Du hast keinen Wert eingetragen.';
    if (tk !== null) {
      w2 = 'Dein Wert ' + fm(tk, 2) + ' s weicht um mehr als 10 % von der Periodendauer ab.';
      if (Math.abs(tk - ref.Tkrit / 2) <= 0.1 * ref.Tkrit / 2) w2 += ' Das ist etwa die halbe Periode: Miss den Abstand zwischen zwei gleichen Spitzen (zwei Maxima).';
      else if (Math.abs(tk - 2 * ref.Tkrit) <= 0.2 * ref.Tkrit) w2 += ' Das ist etwa die doppelte Periode: Miss den Abstand von einer Spitze zur nächsten gleichartigen.';
    }
    r(tk !== null && Math.abs(tk - ref.Tkrit) <= 0.1 * ref.Tkrit, 'Die Periodendauer Tkrit stimmt (Toleranz 10 %)', w2);
    void c;
  });
  /* ====================================================================== rg15 */
  const check15 = U.mk('drehzahl', OWN15, (c, r, a) => {
    const ci = U.initial(c, OWN15), cc = Object.assign({ aw: 'aus' }, ci), s = sim15(ci), m = muster15(), st = s.metrics && s.metrics.step;
    U.inputRow(c, r, s, a, 'drehzahl');
    r(cc.aw === 'klemmen' || cc.aw === 'rueck', 'Der Anti-Windup ist eingeschaltet (klemmen oder rueck)', 'Eingestellt ist der Anti-Windup „' + cc.aw + '“: Der I-Anteil wird dann weiter aufintegriert, auch wenn die Stellgröße an der Grenze ' + fm(60, 0) + ' % steht (Windup).');
    const ue = st && fin(st.ueberPct) ? st.ueberPct : NaN;
    r(fin(ue) && ue <= 5, 'Das Überschwingen beim Sprung auf 1200 1/min beträgt höchstens 5 % des Sprungs', fin(ue) ? 'Gemessen: ' + fm(ue, 1) + ' %.' + (cc.aw === 'aus' ? ' Während die Stellgröße an der Grenze steht, läuft der I-Anteil weg und treibt die Drehzahl über den Sollwert.' : '') : 'Das Überschwingen konnte nicht gemessen werden.');
    const t2 = st ? st.tAus2 : null;
    r(t2 !== null && t2 !== undefined && t2 <= m.tLim, 'Die Drehzahl ist nach höchstens ' + fm(m.tLim, 2) + ' s im 2-%-Band um 1200 1/min', t2 === null || t2 === undefined ? 'Die Drehzahl kommt innerhalb von 6 s nicht dauerhaft ins 2-%-Band um 1200 1/min. Der Regler ist zu träge oder schwingt: Prüfe Kp und Tn.' : 'Gemessen: ' + fm(t2, 2) + ' s, länger als der Musterwert mit Reserve.' + (fin(ue) && ue > 5 ? ' Das Überschwingen verlängert die Ausregelzeit.' : ' Erhöhe Kp oder verkleinere Tn.'));
  });

  /* ====================================================================== Aufgabenliste */
  const FULL = (rig, over) => U.fullCtl(rig, over);
  const list = [
    { id: 'rg1', lab: 'reg', cat: 'Grundlagen', title: 'Anlagenteile zuordnen', level: 1, rig: 'fuellstand',
      text: 'Die Füllstandsregelung besteht aus Tank, Pumpe, Entnahmeventil und Drucksensor, der Sollwert wird am Prüfstand eingestellt. Ordne den fünf Begriffen Führungsgröße, Regelgröße, Stellgröße, Störgröße und Stellglied den passenden Teil der Anlage zu.',
      get choices() { const rl = roles1(); return ['w', 'x', 'y', 'z', 'stell'].map(k => ({ key: k, q: 'Welcher Teil der Anlage ist die ' + TERM[k] + '?', options: PERM1[k].map(i => ({ value: rl[KEYS1[i]], label: rl[KEYS1[i]] })) })); },
      hintVals() { return hv(this, () => ({ n: 5, nOpt: 6 })); },
      get hint() { return hn(this, () => [
        'Frage bei jedem Teil: Wird die Größe geregelt (Regelgröße), wird sie vom Regler vorgegeben (Stellgröße), kommt sie von außen (Störgröße) oder ist es das Bauteil, das die Stellgröße umsetzt (Stellglied)? Die Führungsgröße ist der Wert, auf den geregelt werden soll.',
        'Der ' + roles1().mess + ' misst die Größe, die geregelt wird: ' + roles1().x + '. Der Regler gibt als Stellgröße ' + roles1().y + ' vor; das Bauteil, das sie umsetzt, ist die ' + roles1().stell + '.',
        'Führungsgröße w: ' + roles1().w + '. Regelgröße x: ' + roles1().x + '. Stellgröße y: ' + roles1().y + '. Störgröße z: ' + roles1().z + '. Stellglied: ' + roles1().stell + '. Das Messglied (' + roles1().mess + ') gehört nicht zu den fünf Begriffen.']); },
      start: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'hand', yHand: 40 }), op: { y: 40 } }),
      sol: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'hand', yHand: 40 }), op: { y: 40 }, choices: { w: roles1().w, x: roles1().x, y: roles1().y, z: roles1().z, stell: roles1().stell } }),
      check: check1 },
    { id: 'rg2', lab: 'reg', cat: 'Grundlagen', title: 'Pumpe von Hand einstellen', level: 1, rig: 'fuellstand',
      text: 'Der Prüfstand läuft im Handbetrieb: Die Pumpe bekommt eine feste Stellgröße, ein Regler greift nicht ein. Stelle die Handstellgröße so ein, dass sich der Füllstand bei 32 cm einpendelt (Abweichung höchstens 2 cm). Die Startvorlage startet mit eingeschwungenem Tank; die Prüfung rechnet 600 s Prozesszeit.',
      hintVals() { return hv(this, () => { const rig = mkRig('fuellstand', { z: 0 }); const y = round(rig.yFor(32), 1); return { hSoll: 32, y, hCheck: rig.steady(y), yStart: 20, hStart: rig.steady(20), hm: 0.32, quot: 0.16, wurzel: 0.4 }; }); },
      get hint() { return hn(this, v => [
        'Im Beharrungszustand fließt genauso viel zu, wie abfließt. Die Pumpenleistung (Stellgröße) bestimmt, bei welchem Füllstand das der Fall ist. Probiere die Handstellgröße am Prüfstand aus und lies den Füllstand ab.',
        'Bei dieser Übungsanlage (Düse, Entnahmeventil zu) gilt im Beharrungszustand h = 2 m · (y / 100)². Mit der Startvorlage (' + fm(v.yStart, 0) + ' %) steht der Füllstand bei ' + fm(v.hStart, 1) + ' cm; für ' + fm(v.hSoll, 0) + ' cm brauchst du eine größere Stellgröße.',
        'Rechenweg: ' + fm(v.hm, 2) + ' m = 2 m · (y / 100)². Daraus (y / 100)² = ' + fm(v.quot, 2) + ', also y / 100 = ' + fm(v.wurzel, 1) + ' und y = ' + fm(v.y, 0) + ' %. Probe am Prüfstand: ' + fm(v.hCheck, 1) + ' cm.']); },
      start: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'hand', yHand: 20, w: 50, z: 0 }), op: { y: 20 } }),
      sol: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'hand', yHand: round(mkRig('fuellstand').yFor(32), 0), w: 50, z: 0 }), op: { y: 20 } }),
      check: check2 },
    { id: 'rg3', lab: 'reg', cat: 'Regler verstehen', title: 'P-Regler: Füllstand auf 40 cm', level: 1, rig: 'fuellstand',
      text: 'Schalte den Prüfstand auf Automatik mit einem P-Regler und bringe den Füllstand auf den Sollwert 40 cm. Der Füllstand darf im Mittel höchstens 6 cm danebenliegen, der Tank darf nicht überlaufen und der Regelkreis darf nicht dauernd schwingen. Die Prüfung startet bei leerem Tank und rechnet 600 s Prozesszeit; Entnahmeventil geschlossen.',
      hintVals() { return hv(this, () => { const a = sim3({ kp: 2 }), b = sim3({ kp: 10 }), c2 = sim3({ kp: 50 }); const e = s => eLast(s, 40, 540, 600); return { kpStart: 2, eStart: e(a), kpMuster: 10, eMuster: e(b), kpHoch: 50, oscHoch: oscBad(c2) ? 1 : 0 }; }); },
      get hint() { return hn(this, v => [
        'Ein P-Regler stellt die Pumpe proportional zur Regeldifferenz e = w − x. Je größer Kp, desto kräftiger regelt er und desto kleiner bleibt die Regeldifferenz. Ganz null wird sie bei einem P-Regler nie. Zu großes Kp lässt den Kreis aber schwingen.',
        'Mit Kp = ' + fm(v.kpStart, 0) + ' bleibt der Füllstand ' + fm(v.eStart, 1) + ' cm unter dem Sollwert. Mit Kp = ' + fm(v.kpMuster, 0) + ' sind es nur noch ' + fm(v.eMuster, 1) + ' cm. Bei Kp = ' + fm(v.kpHoch, 0) + ' meldet der Prüfstand Dauerschwingung.',
        'Stelle auf Automatik, wähle den P-Regler und setze Kp = ' + fm(v.kpMuster, 0) + '. Dann bleibt die Regeldifferenz bei ' + fm(v.eMuster, 1) + ' cm (erlaubt 6 cm).']); },
      start: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'auto', ctrl: 'P', kp: 2, tv: 0, u0: 0, w: 40, z: 0 }) }),
      sol: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', { mode: 'auto', ctrl: 'P', kp: 10, tv: 0, u0: 0, w: 40, z: 0 }) }),
      check: check3 },
    { id: 'rg4', lab: 'reg', cat: 'Grundlagen', title: 'Kühlschrank wird wärmer statt kälter', level: 1, rig: 'thermostat', maskDiag: ['wirk'],
      text: 'Der Kühlschrank (Übungsanlage) soll 5 °C halten, wird aber wärmer statt kälter. Der Fehler liegt im Regler. Finde ihn und behebe ihn. Die Prüfung rechnet 8 h Prozesszeit.',
      hintVals() { return hv(this, () => { const m = muster4(), bad = sim4({ dir: 'direkt' }); return { w: m.w, tMitteFalsch: U.winMean(smp(bad), 28800 - 10800, 28800, x => x.x), tMitte: m.mean, tMin: m.min, tMax: m.max, band: m.band }; }); },
      get hint() { return hn(this, v => [
        'Der Regler schaltet den Verdichter anhand der Regeldifferenz e = w − x. Überlege: Muss ein Kühlschrank einschalten, wenn die Temperatur unter dem Sollwert liegt oder wenn sie darüber liegt? Der Wirkungssinn („direkt“ oder „invers“) legt das fest.',
        'Mit dem Wirkungssinn „direkt“ schaltet der Verdichter nur bei zu niedriger Temperatur ein: Die Temperatur steigt im Mittel auf ' + fm(v.tMitteFalsch, 1) + ' °C. Ein Kühlschrank braucht den umgekehrten Wirkungssinn.',
        'Stelle den Wirkungssinn auf „invers“. Dann schwankt die Temperatur zwischen ' + fm(v.tMin, 1) + ' °C und ' + fm(v.tMax, 1) + ' °C, im Mittel ' + fm(v.tMitte, 1) + ' °C (Sollwert ' + fm(v.w, 0) + ' °C).']); },
      start: () => ({ rig: 'thermostat', controls: FULL('thermostat', { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 5, hyst: 2, fb: 0, lockout: 'aus', z: 0, noise: 0, power: true }) }),
      sol: () => ({ rig: 'thermostat', controls: FULL('thermostat', { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'invers', w: 5, hyst: 2, fb: 0, lockout: 'aus', z: 0, noise: 0, power: true }) }),
      check: check4 },
    { id: 'rg5', lab: 'reg', cat: 'Zweipunkt', title: 'Bügeleisen: Schaltdifferenz einstellen', level: 1, rig: 'thermostat',
      text: 'Das Bügeleisen (Übungsanlage) regelt die Sohle mit einem Zweipunktregler auf 150 °C. In der Startvorlage ist die Schaltdifferenz so groß, dass die Temperatur stark schwankt. Stelle die Schaltdifferenz so ein, dass die Schwankungsbreite (Spitze-Spitze der letzten 5 Schaltspiele) höchstens 12 K beträgt und der Mittelwert bei 150 °C bleibt (±5 K). Der Schalter darf dabei nicht flattern.',
      hintVals() { return hv(this, () => { const m = h => { const k = cyc5(sim5({ hyst: h })); return k ? k.swing : NaN; }; const mu = 4; return { hStart: 30, swStart: m(30), hMid: 6, swMid: m(6), hMuster: mu, swMuster: m(mu), hKlein: 0.2, flatterKlein: U.faultHas(sim5({ hyst: 0.2 }), 'flatter') ? 1 : 0 }; }); },
      get hint() { return hn(this, v => [
        'Die Schaltdifferenz Δ ist der Abstand zwischen der oberen und der unteren Schaltschwelle. Der Fühler ist träge und die Sohle läuft nach dem Schalten noch weiter: Deshalb ist die Schwankungsbreite größer als Δ. Verkleinere Δ, aber nicht zu stark.',
        'Mit Δ = ' + fm(v.hStart, 0) + ' K misst du ' + fm(v.swStart, 1) + ' K Schwankungsbreite, mit Δ = ' + fm(v.hMid, 0) + ' K nur ' + fm(v.swMid, 1) + ' K.' + (v.flatterKlein ? ' Bei Δ = ' + fm(v.hKlein, 1) + ' K meldet der Prüfstand: Der Schalter flattert.' : ''),
        'Stelle die Schaltdifferenz auf ' + fm(v.hMuster, 0) + ' K. Dann beträgt die Schwankungsbreite ' + fm(v.swMuster, 1) + ' K (erlaubt 12 K) und der Mittelwert liegt bei 150 °C.']); },
      start: () => ({ rig: 'thermostat', controls: FULL('thermostat', { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 30, fb: 0, z: 0, noise: 0, power: true }) }),
      sol: () => ({ rig: 'thermostat', controls: FULL('thermostat', { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 4, fb: 0, z: 0, noise: 0, power: true }) }),
      check: check5 },
    { id: 'rg6', lab: 'reg', cat: 'Strecke messen', title: 'Sprungantwort aufnehmen: Ks', level: 1, rig: 'raumtemp',
      text: 'Der Raum (Übungsanlage) läuft im Handbetrieb bei 40 % Ventilstellung, die Raumtemperatur ist eingeschwungen. Nimm die Sprungantwort auf: Erhöhe die Handstellgröße im Ablaufprogramm von 40 % auf 50 % und lass 6 h Prozesszeit laufen (oder nimm die Sprungantwort im Tab „Strecke messen“ auf). Ermittle daraus die Streckenverstärkung Ks: Änderung von x in % des Messbereichs (10 bis 30 °C) geteilt durch die Änderung von y in %. Trage Ks in das Antwortfeld ein.',
      ask: { label: 'Streckenverstärkung Ks', unit: '%/%' },
      hintVals() { return hv(this, () => { const id = ref13().id; return { y0: 40, y1: 50, dy: 10, dxK: id.Ks * 10 * 20 / 100, dxPct: id.Ks * 10, Ks: id.Ks, bereich: 20 }; }); },
      get hint() { return hn(this, v => [
        'Die Streckenverstärkung Ks sagt, um wie viele Prozent des Messbereichs sich der Istwert im Beharrungszustand ändert, wenn du die Stellgröße um 1 % änderst. Du brauchst also den Endwert vor und nach dem Sprung.',
        'Bei einem Sprung der Handstellgröße um ' + fm(v.dy, 0) + ' % steigt die Raumtemperatur im Beharrungszustand um ' + fm(v.dxK, 1) + ' K. Der Messbereich ist ' + fm(v.bereich, 0) + ' K groß. Rechne die Änderung in % des Messbereichs um, bevor du teilst.',
        'Δx = ' + fm(v.dxK, 1) + ' K von ' + fm(v.bereich, 0) + ' K = ' + fm(v.dxPct, 0) + ' %. Ks = ' + fm(v.dxPct, 0) + ' % / ' + fm(v.dy, 0) + ' % = ' + fm(v.Ks, 1) + '.']); },
      start: () => ({ rig: 'raumtemp', controls: FULL('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 40 }, seq: [], dur: 21600 }),
      sol: () => ({ rig: 'raumtemp', controls: FULL('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 40 }, seq: [{ t: 600, set: { yHand: 50 } }], dur: 21600, value: ref13().Ks }),
      check: check6 },
    { id: 'rg7', lab: 'reg', cat: 'Strecke messen', title: 'Strecke mit oder ohne Ausgleich', level: 1, rig: 'baukasten',
      text: 'Eine Regelstrecke hat einen Ausgleich, wenn sich der Istwert bei fester Stellgröße auf einen Endwert einstellt (P-Strecke). Ohne Ausgleich (I-Strecke) steigt oder fällt er immer weiter. Entscheide für jede der fünf Anlagen, ob die Regelstrecke einen Ausgleich hat. Du kannst die Prüfstände im Handbetrieb ausprobieren: Ändere die Handstellgröße und beobachte den Istwert.',
      get choices() { return PLANTS7.map((p, i) => ({ key: 'a' + (i + 1), q: 'Hat die Regelstrecke der Anlage „' + label7(p) + '“ einen Ausgleich?', options: [{ value: 'P', label: 'Ja, mit Ausgleich (P-Strecke)' }, { value: 'I', label: 'Nein, ohne Ausgleich (I-Strecke)' }] })); },
      hintVals() { return hv(this, () => { const o = {}; PLANTS7.forEach((p, i) => { const f = plantInfo7(p); o['art' + (i + 1)] = f.art === 'I' ? 1 : 0; if (fin(f.Ks)) o['Ks' + (i + 1)] = f.Ks; if (fin(f.Kis)) o['Kis' + (i + 1)] = f.Kis; }); return o; }); },
      get hint() { return hn(this, () => [
        'Stelle am Prüfstand die Handstellgröße um einen kleinen Wert aus der Ruhelage heraus und warte: Läuft der Istwert auf einen festen Wert zu (Ausgleich) oder wandert er immer weiter (kein Ausgleich, Integrator)? Ein Tank mit freiem Abfluss hat einen Ausgleich, eine Spindelachse nicht.',
        PLANTS7.map(p => { const f = plantInfo7(p); return f.label + ': ' + (f.art === 'I' ? 'Integrierbeiwert Kis = ' + fm(f.Kis, 3) + ' je Sekunde' : 'Streckenverstärkung Ks = ' + fm(f.Ks, 3)); }).join('. ') + '. Nur Strecken ohne Ausgleich haben einen Integrierbeiwert.',
        PLANTS7.map(p => { const f = plantInfo7(p); return f.label + ': ' + (f.art === 'I' ? 'ohne Ausgleich (I-Strecke)' : 'mit Ausgleich (P-Strecke)'); }).join('. ') + '.']); },
      start: () => ({ rig: 'baukasten', controls: FULL('baukasten', { mode: 'hand', yHand: 50, type: 'it1' }), op: { y: 50 } }),
      sol: () => { const ch = {}; PLANTS7.forEach((p, i) => { ch['a' + (i + 1)] = plantInfo7(p).art; }); return { rig: 'baukasten', controls: FULL('baukasten', { mode: 'hand', yHand: 50, type: 'it1' }), op: { y: 50 }, choices: ch }; },
      check: check7 },
    { id: 'rg8', lab: 'reg', cat: 'Regler verstehen', title: 'P-Regler: Drehzahl und Arbeitspunkt', level: 1, rig: 'drehzahl',
      text: 'Der Drehzahlregler ist ein P-Regler. Stelle ihn so ein, dass die bleibende Abweichung bei der Solldrehzahl 1500 1/min höchstens 3 % von 1500 1/min beträgt, ohne dass die Drehzahl dauernd schwingt. Ein P-Regler stellt y = u0 + Kp · e: Du darfst Kp und den Arbeitspunkt u0 einstellen. Die Prüfung startet im Stillstand ohne Last und rechnet 4 s Prozesszeit.',
      hintVals() { return hv(this, () => { const rig = mkRig('drehzahl'), id = U.idAt('drehzahl', {}, 50).id, yIdle = 100 * 1500 / rig.steady(100); const s = sim8({ kp: 5, u0: round(yIdle, 0) }), x = U.winMean(smp(s), 3.5, 4, v => v.x); const V0 = 100 / 3 - 1; return { w: 1500, yIdle, uMuster: round(yIdle, 0), kpMuster: 5, eMuster: 1500 - x, ePctMuster: 100 * (1500 - x) / 1500, Ks: id.Ks, V0, kpOhneU0: V0 / id.Ks, Kkrit: id.Kkrit }; }); },
      get hint() { return hn(this, v => [
        'Ein P-Regler stellt y = u0 + Kp · e. Ist u0 gleich 0, muss der Regler eine große Regeldifferenz e aufbauen, um überhaupt die nötige Stellgröße zu erzeugen. Mit dem richtigen Arbeitspunkt u0 braucht er fast keine Regeldifferenz mehr.',
        'Im Leerlauf gehört zu ' + fm(v.w, 0) + ' 1/min die Stellgröße ' + fm(v.yIdle, 1) + ' %. Mit u0 = 0 bräuchtest du Kp = ' + fm(v.kpOhneU0, 1) + ' (Kreisverstärkung V0 = ' + fm(v.V0, 1) + ', Ks = ' + fm(v.Ks, 2) + '); die kritische Verstärkung der Strecke liegt aber nur bei Kkrit = ' + fm(v.Kkrit, 1) + '.',
        'Setze u0 = ' + fm(v.uMuster, 0) + ' % und Kp = ' + fm(v.kpMuster, 0) + '. Dann bleiben ' + fm(v.eMuster, 1) + ' 1/min Abweichung, das sind ' + fm(v.ePctMuster, 2) + ' % von ' + fm(v.w, 0) + ' 1/min.']); },
      start: () => ({ rig: 'drehzahl', controls: FULL('drehzahl', { mode: 'auto', ctrl: 'P', kp: 2, tv: 0, u0: 0, w: 1500, z: 0, noise: 0, ymax: 100, ta: 0.005 }) }),
      sol: () => ({ rig: 'drehzahl', controls: FULL('drehzahl', { mode: 'auto', ctrl: 'P', kp: 5, tv: 0, u0: round(100 * 1500 / mkRig('drehzahl').steady(100), 0), w: 1500, z: 0, noise: 0, ymax: 100, ta: 0.005 }) }),
      check: check8 },
    { id: 'rg9', lab: 'reg', cat: 'Regler verstehen', title: 'Lage: aus P wird PI', level: 1, rig: 'position',
      text: 'Die Spindelachse wird von einer Last (Störgröße z = 10 %) belastet, ein P-Regler regelt sie auf den Sollwert 60 mm. Die Last verschiebt die Position. Mache aus dem P-Regler einen PI-Regler, damit die Last die Position nicht mehr verschiebt: Nach 20 s darf die Position höchstens 0,5 mm vom Sollwert abweichen. Die Prüfung startet bei 20 mm und rechnet 30 s Prozesszeit.',
      hintVals() { return hv(this, () => { const a = sim9({ ctrl: 'P', kp: 2 }), b = sim9({ ctrl: 'PI', kp: 2, tn: 2 }); const e = s => 60 - U.winMean(smp(s), 19, 20, v => v.x); return { kp: 2, ePStart: e(a), tn: 2, ePI: e(b), z: 10 }; }); },
      get hint() { return hn(this, v => [
        'Die Achse hat keinen Ausgleich (sie ist eine I-Strecke). Eine Last wirkt wie ein dauernder Versatz der Stellgröße. Ein P-Regler braucht dann eine bleibende Regeldifferenz, um dagegen anzustellen. Ein I-Anteil integriert die Regeldifferenz so lange, bis sie null ist.',
        'Der P-Regler mit Kp = ' + fm(v.kp, 0) + ' lässt bei z = ' + fm(v.z, 0) + ' % nach 20 s ' + fm(Math.abs(v.ePStart), 1) + ' mm Abweichung stehen. Wähle die Reglerart PI und stelle die Nachstellzeit Tn nicht zu groß ein.',
        'Wähle PI mit Kp = ' + fm(v.kp, 0) + ' und Tn = ' + fm(v.tn, 0) + ' s. Dann beträgt die Abweichung nach 20 s nur noch ' + fm(Math.abs(v.ePI), 3) + ' mm (erlaubt 0,5 mm).']); },
      start: () => ({ rig: 'position', controls: FULL('position', { mode: 'auto', ctrl: 'P', kp: 2, tn: 2, tv: 0, aw: 'rueck', u0: 50, w: 60, z: 10, friction: 0, backlash: 0, noise: 0 }) }),
      sol: () => ({ rig: 'position', controls: FULL('position', { mode: 'auto', ctrl: 'PI', kp: 2, tn: 2, tv: 0, aw: 'rueck', u0: 50, w: 60, z: 10, friction: 0, backlash: 0, noise: 0 }) }),
      check: check9 },
    { id: 'rg10', lab: 'reg', cat: 'Grundlagen', title: 'Proportionalbereich und Verstärkung', level: 1,
      text: 'Der Proportionalbereich Xp und die Verstärkung Kp eines P-Reglers hängen zusammen. Rechne die drei Aufgaben aus und trage die Ergebnisse in das Antwortblatt ein (Komma oder Punkt, die Einheit kannst du weglassen).',
      get fields() { return fields10(); },
      hintVals() { return hv(this, () => { const o = {}; ex10().forEach((e, i) => { o['wert' + (i + 1)] = e.answer.value; Object.keys(e.given).forEach(k => { o[k + (i + 1)] = e.given[k]; }); }); return o; }); },
      get hint() { return hn(this, () => [
        'Der Proportionalbereich Xp ist der Bereich der Regeldifferenz (in %), über den die Stellgröße von 0 auf 100 % läuft. Je größer Xp, desto schwächer regelt der Regler. Xp und Kp sind Kehrwerte voneinander, bezogen auf 100 %.',
        ex10().map((e, i) => 'Aufgabe ' + (i + 1) + ': ' + e.steps[0]).join('. ') + '.',
        ex10().map((e, i) => 'Aufgabe ' + (i + 1) + ': ' + e.steps[0] + ' → ' + e.steps[1] + ' ' + e.steps[2]).join('. ') + '.']); },
      start: () => ({ fields: {} }),
      sol: () => { const f = {}; ex10().forEach((e, i) => { f['a' + (i + 1)] = e.answer.value; }); return { fields: f }; },
      check: check10 },
    { id: 'rg11', lab: 'reg', cat: 'Führung und Störung', title: 'Entnahme als Störung ausregeln', level: 2, rig: 'fuellstand',
      text: 'Der Füllstand steht eingeschwungen bei 50 cm. Nach 30 s öffnet das Entnahmeventil auf 60 %: Die Störgröße z springt. Stelle den Regler so ein, dass die größte Abweichung unter dem Musterwert bleibt, der Füllstand schnell wieder im Band von ±2 cm um den Sollwert liegt und die Störung ausgeregelt wird (keine bleibende Abweichung). Die Prüfung rechnet das Szenario der Startvorlage 600 s Prozesszeit lang.',
      hintVals() { return hv(this, () => { const m = muster11(), a = dist11(sim11({ ctrl: 'P', kp: 2 })); return { z: 60, tz: TZ11, xdStart: Math.abs(a.xdMax), eblStart: Math.abs(a.eblStoer), kp: m.ci.kp, tn: m.ci.tn, xdMuster: m.xdMax, xdLim: m.xdLim, tAusMuster: m.tAus, tLim: m.tLim }; }); },
      get hint() { return hn(this, v => [
        'Eine Störung wie das Entnahmeventil wirkt dauernd. Ein P-Regler lässt dabei eine bleibende Abweichung zurück; nur ein I-Anteil regelt sie aus. Für eine kleine Abweichung muss der Regler kräftig und schnell nachstellen: Kp groß genug und die Nachstellzeit Tn nicht zu groß.',
        'Mit dem P-Regler der Startvorlage sinkt der Füllstand um ' + fm(v.xdStart, 1) + ' cm und bleibt ' + fm(v.eblStart, 1) + ' cm daneben. Gesucht: höchstens ' + fm(v.xdLim, 1) + ' cm Abweichung und höchstens ' + fm(v.tLim, 0) + ' s bis zum Band.',
        'Wähle PI mit Kp = ' + fm(v.kp, 0) + ' und Tn = ' + fm(v.tn, 0) + ' s. Dann sinkt der Füllstand um ' + fm(v.xdMuster, 1) + ' cm und ist nach ' + fm(v.tAusMuster, 1) + ' s wieder im Band; die bleibende Abweichung ist 0.']); },
      start: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', Object.assign({}, BASE11(), { ctrl: 'P', kp: 2 })), op: { y: 50 }, seq: clone(SEQ11), dur: 600 }),
      sol: () => ({ rig: 'fuellstand', controls: FULL('fuellstand', Object.assign({}, BASE11(), muster11().ci)), op: { y: 50 }, seq: clone(SEQ11), dur: 600 }),
      check: check11 },
    { id: 'rg12', lab: 'reg', cat: 'Einstellen', title: 'PI-Regler für die Raumtemperatur', level: 2, rig: 'raumtemp',
      text: 'Die Solltemperatur des Raums springt von 18 °C auf 21 °C (Außentemperatur −5 °C). Stelle einen PI-Regler so ein, dass die Raumtemperatur höchstens 15 % des Sprungs überschwingt, der Regelkreis nicht dauernd schwingt und der Sollwert in angemessener Zeit erreicht wird (Ausregelzeit für das 2-%-Band höchstens der Musterwert plus Reserve). Die Prüfung rechnet das Szenario der Startvorlage 8 h Prozesszeit lang.',
      hintVals() { return hv(this, () => { const m = muster12(), a = sim12({ ctrl: 'PI', kp: 6, tn: 1800 }).metrics.step; return { sprungK: 3, ueberLim: 15, kpStart: 6, tnStartMin: 30, ueberStart: a.ueberPct, kp: m.ci.kp, tnMin: m.ci.tn / 60, ueberMuster: m.ueber, tAus2Muster: m.tAus2 / 60, tLimMin: m.tLim / 60, tCHR0Min: m.methods['chr-fuehr-0'].tAus2 / 60, Ks: m.id.Ks, TsumKleinMin: m.id.TsumKlein / 60, T1Min: m.id.T1 / 60 }; }); },
      get hint() { return hn(this, v => [
        'Ein PI-Regler hat zwei Stellschrauben: Kp bestimmt, wie kräftig er auf die Regeldifferenz antwortet, die Nachstellzeit Tn, wie schnell der I-Anteil nachstellt. Zu große Kp oder zu kleine Tn lassen die Raumtemperatur überschwingen; zu kleine Kp und zu große Tn machen den Regler träge. Die T-Summen-Regel (Betragsoptimum) liefert einen vernünftigen Anfang.',
        'Die Startvorlage (Kp = ' + fm(v.kpStart, 0) + ', Tn = ' + fm(v.tnStartMin, 0) + ' min) überschwingt um ' + fm(v.ueberStart, 1) + ' %. Für die T-Summen-Regel brauchst du T1 = ' + fm(v.T1Min, 0) + ' min (größte Zeitkonstante), Ks = ' + fm(v.Ks, 1) + ' und die Summe der kleinen Zeitkonstanten (inklusive Totzeit) TΣk = ' + fm(v.TsumKleinMin, 0) + ' min: Kp = T1 / (2 · Ks · TΣk), Tn = T1.',
        'T-Summe: Kp = ' + fm(v.T1Min, 0) + ' / (2 · ' + fm(v.Ks, 1) + ' · ' + fm(v.TsumKleinMin, 0) + ') = ' + fm(v.kp, 2) + ', Tn = ' + fm(v.tnMin, 0) + ' min. Dann überschwingt die Raumtemperatur um ' + fm(v.ueberMuster, 1) + ' % und ist nach ' + fm(v.tAus2Muster, 0) + ' min im 2-%-Band (erlaubt: ' + fm(v.tLimMin, 0) + ' min; auch die CHR-Regel für Führung ohne Überschwingen braucht ' + fm(v.tCHR0Min, 0) + ' min und gilt).']); },
      start: () => ({ rig: 'raumtemp', controls: FULL('raumtemp', Object.assign({}, BASE12(), { ctrl: 'PI', kp: 6, tn: 1800 })), op: op12(), seq: clone(SEQ12), dur: 28800 }),
      sol: () => ({ rig: 'raumtemp', controls: FULL('raumtemp', Object.assign({}, BASE12(), muster12().ci)), op: op12(), seq: clone(SEQ12), dur: 28800 }),
      check: check12 },
    { id: 'rg13', lab: 'reg', cat: 'Einstellen', title: 'Ziegler-Nichols aus der Sprungantwort', level: 2, rig: 'raumtemp',
      text: 'Nimm die Sprungantwort des Raums im Handbetrieb auf (Handstellgröße 40 % auf 50 %, im Ablauf oder im Tab „Strecke messen“). Lege die Wendetangente an und lies Ks, Tu und Tg ab. Berechne daraus nach Ziegler-Nichols (Sprungantwort) Kp und Tn für einen PI-Regler. Trage alle fünf Werte in das Antwortblatt ein; Zeiten in Minuten Prozesszeit.',
      consts: [0.9, 0.3],
      get fields() { return fields13(); },
      hintVals() { return hv(this, () => { const r = ref13(); return { Ks: r.Ks, TuMin: r.Tu / 60, TgMin: r.Tg / 60, quot: r.Tg / (r.Ks * r.Tu), kp: r.Kp, tnMin: r.Tn / 60, TnFaktor: 1 / 0.3 }; }); },
      get hint() { return hn(this, v => [
        'Die Wendetangente berührt die Sprungantwort an ihrer steilsten Stelle. Der Schnittpunkt der Tangente mit der Anfangslinie liefert die Verzugszeit Tu, der Abstand zwischen den Schnittpunkten mit Anfangs- und Endlinie die Ausgleichszeit Tg. Für den PI-Regler gilt: Kp = 0,9 · Tg / (Ks · Tu) und Tn = Tu / 0,3.',
        'Die Strecke hat Ks = ' + fm(v.Ks, 1) + ', Tu etwa ' + fm(v.TuMin, 1) + ' min und Tg etwa ' + fm(v.TgMin, 1) + ' min. Wichtig: Tg und Tu müssen in derselben Zeiteinheit stehen, bevor du teilst.',
        'Tg / (Ks · Tu) = ' + fm(v.TgMin, 1) + ' / (' + fm(v.Ks, 1) + ' · ' + fm(v.TuMin, 1) + ') = ' + fm(v.quot, 2) + '. Kp = 0,9 · ' + fm(v.quot, 2) + ' = ' + fm(v.kp, 2) + '. Tn = Tu / 0,3 = ' + fm(v.tnMin, 1) + ' min (Faktor ' + fm(v.TnFaktor, 2) + ').']); },
      start: () => ({ rig: 'raumtemp', controls: FULL('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 40 }, seq: [], dur: 21600, fields: {} }),
      sol: () => { const r = ref13(); return { rig: 'raumtemp', controls: FULL('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 40 }, seq: [{ t: 600, set: { yHand: 50 } }], dur: 21600, fields: { Ks: r.Ks, Tu: r.Tu / 60, Tg: r.Tg / 60, kp: r.Kp, tn: r.Tn / 60 } }; },
      check: check13 },
    { id: 'rg14', lab: 'reg', cat: 'Stabilität', title: 'Schwingversuch am Durchfluss', level: 2, rig: 'durchfluss',
      text: 'Mache am Durchfluss-Prüfstand (lineares Ventil, Vordruck unverändert) den Schwingversuch nach Ziegler-Nichols: Stelle einen reinen P-Regler ein (ohne I- und D-Anteil) und erhöhe Kp in kleinen Schritten, bis der Durchfluss nach einem Sollwertsprung dauernd mit gleichbleibender Schwingweite schwingt. Trage die kritische Verstärkung Kkrit (das Kp bei dieser Dauerschwingung) und die Periodendauer Tkrit in Sekunden ein.',
      get fields() { return fields14(); },
      hintVals() { return hv(this, () => { const r = ref14(), kpU = round(r.Kkrit * 0.7, 1), kpO = round(r.Kkrit * 1.3, 1); return { tol: 10, Kkrit: r.Kkrit, Tkrit: r.Tkrit, kpStart: 1, kpUnten: kpU, kpOben: kpO, abklingtUnten: verdict14(kpU) === 'gedaempft' ? 1 : 0, bleibtOben: ['dauerschwingung', 'aufschaukelnd'].includes(verdict14(kpO)) ? 1 : 0, Ks: r.id.Ks, V0krit: r.Kkrit * r.id.Ks, wKrit: 2 * Math.PI / r.Tkrit }; }); },
      get hint() { return hn(this, v => [
        'Bei kleinem Kp klingt die Schwingung nach einem Sollwertsprung ab. Wird Kp größer, klingt sie immer langsamer ab. Bei der kritischen Verstärkung Kkrit bleibt die Schwingweite gleich, darüber wird sie größer. Die Periodendauer Tkrit ist der Abstand zweier gleichartiger Spitzen in dieser Dauerschwingung.',
        (v.abklingtUnten && v.bleibtOben ? 'Mit Kp = ' + fm(v.kpUnten, 1) + ' klingt die Schwingung ab, mit Kp = ' + fm(v.kpOben, 1) + ' klingt sie nicht mehr ab. Dazwischen liegt Kkrit. ' : '') + 'Die Kreisverstärkung V0 = Kp · Ks (Ks = ' + fm(v.Ks, 2) + ') ist dann etwa ' + fm(v.V0krit, 1) + '.',
        'Aus der Frequenzgangrechnung folgt Kkrit = ' + fm(v.Kkrit, 2) + ' und Tkrit = ' + fm(v.Tkrit, 2) + ' s (Kreisfrequenz ' + fm(v.wKrit, 2) + ' 1/s). Dein Versuch darf bis zu ' + fm(v.tol, 0) + ' % davon abweichen.']); },
      start: () => ({ rig: 'durchfluss', controls: FULL('durchfluss', { mode: 'auto', ctrl: 'P', kp: 1, tv: 0, u0: 40, w: 50, z: 0, char: 'linear', slew: '0', noise: 0 }), fields: {} }),
      sol: () => { const r = ref14(); return { rig: 'durchfluss', controls: FULL('durchfluss', { mode: 'auto', ctrl: 'P', kp: round(r.Kkrit, 1), tv: 0, u0: 40, w: 50, z: 0, char: 'linear', slew: '0', noise: 0 }), fields: { Kkrit: r.Kkrit, Tkrit: r.Tkrit } }; },
      check: check14 },
    { id: 'rg15', lab: 'reg', cat: 'Praxis', title: 'Windup: Anti-Windup einstellen', level: 2, rig: 'drehzahl',
      text: 'Die Stellgröße des Drehzahlreglers (PI) ist auf 60 % begrenzt. Beim Hochfahren aus dem Stillstand auf 1200 1/min steht die Stellgröße zuerst an der Grenze, der I-Anteil läuft weg (Windup), und die Drehzahl schießt über. Stelle den Anti-Windup so ein, dass die Drehzahl höchstens 5 % des Sprungs überschwingt und schnell im 2-%-Band ankommt. Die Prüfung rechnet das Szenario der Startvorlage 6 s Prozesszeit lang.',
      hintVals() { return hv(this, () => { const m = muster15(); return { w1: m.w1, ymax: 60, nMax: m.nMax, ueberStart: m.ueberAus, ueberKlemmen: m.ueberKlemmen, ueberRueck: m.ueberRueck, tKlemmen: m.tKlemmen, tRueck: m.tRueck, tLim: m.tLim }; }); },
      get hint() { return hn(this, v => [
        'Wenn die Stellgröße an der Grenze steht, kann der Regler die Regeldifferenz nicht kleiner machen, aber der I-Anteil summiert weiter auf. Beim Anti-Windup wird das verhindert: „klemmen“ hält den I-Anteil an, „rueck“ führt ihn zurück. Stelle einen der beiden ein.',
        'Mit der Startvorlage (Anti-Windup aus) überschwingt die Drehzahl um ' + fm(v.ueberStart, 1) + ' %. Bei der Grenze 60 % erreicht der Motor ohne Last höchstens ' + fm(v.nMax, 0) + ' 1/min; der Sollwert ' + fm(v.w1, 0) + ' 1/min ist also erreichbar.',
        'Setze den Anti-Windup auf „rueck“: Überschwingen ' + fm(v.ueberRueck, 1) + ' %, Ausregelzeit ' + fm(v.tRueck, 2) + ' s. Mit „klemmen“ sind es ' + fm(v.ueberKlemmen, 1) + ' % und ' + fm(v.tKlemmen, 2) + ' s (erlaubt: ' + fm(v.tLim, 2) + ' s).']); },
      start: () => ({ rig: 'drehzahl', controls: FULL('drehzahl', Object.assign({}, BASE15(), { aw: 'aus' })), op: { y: 0 }, seq: clone(SEQ15), dur: 6 }),
      sol: () => ({ rig: 'drehzahl', controls: FULL('drehzahl', Object.assign({}, BASE15(), { aw: 'rueck' })), op: { y: 0 }, seq: clone(SEQ15), dur: 6 }),
      check: check15 }
  ];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* start() und sol() werfen nie (ohne Kern oder Prüfstände liefern sie nur den Rahmen) */
  list.forEach(k => ['start', 'sol'].forEach(f => { const g = k[f]; k[f] = function () { try { return g.apply(k, arguments); } catch (e) { return { rig: k.rig, controls: {}, error: String(e && e.message || e) }; } }; }));
  /* Auswertung der Schwellen für Tests und Selbsttest (Stand der Modelle: REG_CORE 1.0) */
  T.thresholds1 = () => ({ muster4: muster4(), muster11: muster11(), muster12: muster12(), muster15: muster15(), ref13: ref13(), ref14: ref14() });
  T.sims1 = { sim2, sim3, sim4, sim5, sim8, sim9, sim11, sim12, sim14, sim15, cyc5, dist11, plantInfo7, PLANTS7, ex10, roles1, TERM, OWN: { 2: OWN2, 3: OWN3, 4: OWN4, 5: OWN5, 8: OWN8, 9: OWN9, 11: OWN11, 12: OWN12, 15: OWN15 }, verdict14, oscBad };
  T.register(list);
})(typeof window !== 'undefined' ? window : globalThis);
