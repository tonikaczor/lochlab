/* enrtasks2.js - Energie-Lab: Aufgaben en16 bis en30 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig) (WP5b)
 * Registrierung: ENR_TASKS.register([ ... ]) (ENR_TASKS und ENR_TASKS.util kommen aus enrdata.js; enrdata.js VOR dieser Datei laden, in Node holt sich die
 * Datei fehlende Teile per require). Format, Regeln und answer-Objekt wie in enrtasks1.js und enrdata.js.
 * Schwellwerte: aus der gerechneten Musterloesung (Reserven: 25 % bei Verlusten, 3 Prozentpunkte bei Anteilen, siehe Konstanten je Aufgabe), ENR_TASKS.thresholds2() nennt sie.
 * Tagesaufgaben laufen mit ENR_RIGS (Seed 1) und brauchen ENR_CORE.sys (enrsys.js, WP1b): en15, en17-en19, en21, en24, en27-en30; ohne sys melden sie
 * "Rechenkern fehlt" statt eine Behauptung. en20, en22, en25, en16, en26 rechnen allein mit ENR_CORE (pv, sun, inv, calc); en23 braucht ENR_CORE.design.
 * Abweichungen von der SPEC (siehe AUSBILDER.md): en30 benutzt einen 5-kW-Wechselrichter (die Typentabelle kennt keinen 6-kW-Typ) und 26 Module (6,97 kWp);
 *   en29 nimmt die Schwelle als Muster minus 3 Prozentpunkte (Muster 4 kWh Speicher), en23 verlangt Gartenhaus mit zwei Tagen Autonomie am 21.12.
 * Benoetigt: enrcore.js, enrcalc.js, enrsys.js (sys, design, loads), enrdata.js und die Pruefstaende enrrig-*.js. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.ENR_TASKS) nodeReq('./enrdata.js');
  const T = root.ENR_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('enrtasks2.js: enrdata.js fehlt, die Aufgaben en16 bis en30 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, numRow = U.numRow, exRow = U.exRow, def = U.def, choiceOf = U.choiceOf;
  const C = () => U.core();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const vk = (v, d) => (fin(v) ? f(v, d) : '–');
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const A = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const DAY = 86400, TAGEND = 86400 - 60;
  const keys = (G, Tc, preset) => C().pv.keys(preset || 'si60', { G, Tc });
  const RFIX = { modul: 'si36', ns: 1, np: 1, ctrl: 'pwm', imax: 20, chem: 'blei', usys: 12, cap: 100, soc0: 50, tbat: 25, load: 0, lvd: true, tempComp: true, lPv: 2, aPv: 4, lBat: 1, aBat: 10, quelle: 'konstant', G: 800, ta: 20, ort: 'mitte', datum: 'sommer', uhr: 8, wetter: 'klar', seed: 1, lauf: 'aus' };
  const IFIX = { ort: 'mitte', datum: 'sommer', uhr: 0, wetter: 'klar', seed: 1, lauf: 'aus', modul: 'si60', ns: 1, np: 2, neigung: 35, azimut: 0, regler: 'mppt', imax: 40, chem: 'blei', usys: 12, cap: 200, soc0: 50, lvd: true, wr: 'kein', sparmodus: false, lastprofil: 'gartenhaus', pFrei: 100, lPv: 2, aPv: 4, lBat: 1, aBat: 10 };
  const NFIX = { ort: 'mitte', datum: 'sommer', uhr: 0, wetter: 'klar', seed: 1, lauf: 'aus', modul: 'si60', ns: 10, np: 1, neigung: 35, azimut: 0, wrP: 3000, wrTyp: 'standard', limit: 100, netz: true, last: 'haushalt', lastF: 1, speicher: 0, bezug: 35, verg: 8 };
  const sref = (rig, fix, T, o) => U.snap(rig, U.fullCtl(rig, fix), T, o || { sampleS: 600 });
  const socs = (res, t0, t1) => U.smp(res).filter(x => x.t >= t0 - 1e-9 && x.t <= t1 + 1e-9).map(x => x.state.soc);
  const minSoc = (res, t0, t1) => Math.min.apply(null, socs(res, t0, t1));
  const maxSoc = (res, t0, t1) => Math.max.apply(null, socs(res, t0, t1));
  const lvdSeen = res => U.smp(res).some(x => x.state && x.state.lvdAktiv) || U.eventHas(res, 'lvd-aus') || U.faultHas(res, 'lvd-aus');
  const maxOf = (res, key) => U.smp(res).reduce((m, x) => Math.max(m, fin(x.state[key]) ? x.state[key] : -Infinity), -Infinity);

  /* ====================================================================== en16: C-Rate, Ladezeit, Autonomie */
  const M16 = (() => {
    const KINDS = [{ key: 'crate', seed: 3, label: 'C-Rate', unit: 'C' }, { key: 'ladezeit', seed: 3, label: 'Ladezeit', unit: 'h' }, { key: 'autonomie', seed: 3, label: 'Autonomie', unit: 'Tage' }];
    const ex = k => once('e16' + k, () => C().calc.exercise(k, KINDS.find(x => x.key === k).seed));
    const vals = () => once('v16', () => { const a = ex('crate'), b = ex('ladezeit'), c = ex('autonomie'); return { i1: a.given.i, c1: a.given.c, crate: a.answer.value, c2: b.given.c, ds: b.given.dsoc, fehl: b.given.c * b.given.dsoc / 100, dodAnt: c.given.dod / 100, eta: b.given.eta, i2: b.given.i, t: b.answer.value, c3: c.given.c, u3: c.given.usys, dod: c.given.dod, ed: c.given.ed, tage: c.answer.value, wh: c.given.c * c.given.usys }; });
    const check = mk('regler', [], (c, r, a) => { KINDS.forEach(k => exRow(r, ex(k.key), U.rawOf(a, k.key), k.label + ' richtig berechnet')); });
    return { vals, check,
      text: () => 'Rechne drei Aufgaben zum Akku. (a) ' + ex('crate').question + ' (b) ' + ex('ladezeit').question + ' (c) ' + ex('autonomie').question,
      fields: () => KINDS.map(k => ({ key: k.key, label: k.label, unit: k.unit })),
      hint: () => { const v = vals(); return [
        'Die C-Rate ist der Strom im Verhältnis zur Kapazität. Die Ladezeit folgt aus der Ladung, die fehlt, geteilt durch den Ladestrom (mit Wirkungsgrad). Die Autonomie ist die nutzbare Energie geteilt durch den Tagesverbrauch.',
        'Zu (a): ' + f(v.i1, 0) + ' A bei ' + f(v.c1, 0) + ' Ah. Zu (b): fehlende Ladung ' + f(v.fehl, 1) + ' Ah, Ladestrom ' + f(v.i2, 0) + ' A, Wirkungsgrad ' + f(v.eta, 0) + ' %. Zu (c): Energie ' + f(v.wh, 0) + ' Wh.',
        'Musterlösung: (a) ' + f(v.i1, 0) + ' A / ' + f(v.c1, 0) + ' Ah = ' + f(v.crate, 2) + ' C. (b) ' + f(v.t, 2) + ' h. (c) ' + f(v.c3, 0) + ' Ah · ' + f(v.u3, 0) + ' V · ' + f(v.dodAnt, 1) + ' / ' + f(v.ed, 0) + ' Wh = ' + f(v.tage, 1) + ' Tage.'
      ]; },
      start: () => A('regler', {}, { fields: { crate: null, ladezeit: null, autonomie: null } }),
      sol: () => { const v = vals(); return A('regler', {}, { fields: { crate: v.crate, ladezeit: v.t, autonomie: v.tage } }); },
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('regler', {}, { fields: { crate: v.crate * 0.5, ladezeit: v.t * 0.5, autonomie: v.tage * 0.5 } }) }, { name: 'zu groß', answer: A('regler', {}, { fields: { crate: v.crate * 2, ladezeit: v.t * 2, autonomie: v.tage * 2 } }) }]; } };
  })();

  /* ====================================================================== en17: Ladeschlussspannung richtig einstellen (regler, sys) */
  const M17 = (() => {
    const OWN = ['uAbs', 'uFloat'], FIX = Object.assign({}, RFIX, { modul: 'si36', ns: 1, np: 3, ctrl: 'pwm', cap: 100, soc0: 60, load: 20, quelle: 'tagesgang', datum: 'sommer', uhr: 6, wetter: 'klar', lauf: 'normal', uAbs: 13.2 });   // FIX = Anfangszustand der Aufgabe (zu niedrige Ladeschlussspannung)
    const T17 = DAY, MINSOC = 95, GASRES = 1.25, GASABS = 0.2;   // 95 % Ladezustand (SPEC 7.2, en17); Gasung: Muster mal 1,25 plus 0,2 Ah
    const dflt = () => C().batt.defaults('blei', 12);
    const sim = ov => U.snap('regler', U.fullCtl('regler', Object.assign({}, FIX, ov || {})), T17, { sampleS: 600 });
    const meas = s => ({ socMax: maxSoc(s.res, 0, T17), gas: maxOf(s.res, 'gasAh') });
    const vals = () => once('v17', () => { const d = dflt(), m = meas(sim({ uAbs: d.uAbs, uFloat: d.uFloat })), hi = meas(sim({ uAbs: 15.2 })), lo = meas(sim({ uAbs: 13.2 })); return { uAbs: d.uAbs, uFloat: d.uFloat, uGas: d.uGas, socMax: m.socMax, gas: m.gas, thr: GASRES * m.gas + GASABS, min: MINSOC, gasHoch: hi.gas, socNiedrig: lo.socMax, uHoch: 15.2, uNiedrig: 13.2 }; });
    const check = mk('regler', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'regler', OWN, FIX), s = U.snap('regler', eff, T17, { sampleS: 600 }), m = s.ok ? meas(s) : { socMax: NaN, gas: NaN }, d = dflt();
      inputRow(c, r, s, a, 'regler');
      r(fin(m.socMax) && m.socMax >= MINSOC, 'Der Akku wird am Tag voll (mindestens ' + f(MINSOC, 0) + ' % Ladezustand)',
        'Mit der Ladeschlussspannung ' + vk(eff.uAbs, 1) + ' V erreicht der Akku höchstens ' + vk(m.socMax, 0) + ' % Ladezustand. ' + (eff.uAbs < d.uAbs ? 'Der Standardwert für Blei liegt bei ' + vk(d.uAbs, 1) + ' V; dein Wert liegt darunter.' : ''));
      r(fin(m.gas) && m.gas <= v.thr, 'Der Akku gast höchstens ' + f(v.thr, 2) + ' Ah',
        'Der Akku sammelt ' + vk(m.gas, 2) + ' Ah Gasung. Die Gasung beginnt oberhalb von ' + vk(d.uGas, 1) + ' V; deine Ladeschlussspannung ist ' + vk(eff.uAbs, 1) + ' V.');
    });
    return { vals, check,
      text: () => 'Der Blei-Akku (100 Ah, 12 V) soll am Sonnentag voll werden, ohne zu gasen (Prüfstand „Laderegler“, drei parallele 36-Zellen-Module, PWM-Regler, 20 W Last, Tagesgang im Sommer von 6 Uhr an). Stelle die Ladeschlussspannung (und bei Bedarf die Erhaltungsspannung) richtig ein. Prüfmaß: mindestens ' + f(MINSOC, 0) + ' % Ladezustand im Lauf über 24 Stunden Prozesszeit, Gasung höchstens Musterwert plus Reserve.',
      hint: () => { const v = vals(); return [
        'Ist die Ladeschlussspannung zu niedrig, hört die Absorption zu früh auf und der Akku wird nicht voll. Ist sie zu hoch, beginnt die Gasung. Die Gasung beginnt bei einer festen Spannung.',
        'Der Standardwert für Blei bei 12 V ist ' + f(v.uAbs, 1) + ' V (Erhaltung ' + f(v.uFloat, 1) + ' V), die Gasung beginnt bei ' + f(v.uGas, 1) + ' V. Mit ' + f(v.uNiedrig, 1) + ' V wird der Akku nur ' + f(v.socNiedrig, 0) + ' % voll, mit ' + f(v.uHoch, 1) + ' V gast er ' + f(v.gasHoch, 2) + ' Ah.',
        'Musterlösung: Ladeschlussspannung ' + f(v.uAbs, 1) + ' V. Der Akku erreicht ' + f(v.socMax, 0) + ' % und gast ' + f(v.gas, 2) + ' Ah (Grenze ' + f(v.thr, 2) + ' Ah).'
      ]; },
      start: () => A('regler', Object.assign({}, FIX), {}),
      sol: () => A('regler', Object.assign({}, FIX, { uAbs: vals().uAbs, uFloat: vals().uFloat }), {}),
      wrong: () => [{ name: 'Ladeschluss zu niedrig', answer: A('regler', Object.assign({}, FIX, { uAbs: 13.2 }), {}) }, { name: 'Ladeschluss zu hoch', answer: A('regler', Object.assign({}, FIX, { uAbs: 15.2 }), {}) }] };
  })();

  /* ====================================================================== en18: Akku gast (Regler fehlt) (regler, sys) */
  const M18 = (() => {
    const OWN = ['ctrl', 'uAbs'], FIX = Object.assign({}, RFIX, { modul: 'si60', ns: 1, np: 1, ctrl: 'direkt', cap: 50, soc0: 90, G: 1000, load: 0, quelle: 'konstant' }), T18 = 14400, GASRES = 1.25, GASABS = 0.2;
    const sim = ov => U.snap('regler', U.fullCtl('regler', Object.assign({}, FIX, ov || {})), T18, { sampleS: 120 });
    const vals = () => once('v18', () => { const ok = sim({ ctrl: 'pwm' }).st, bad = sim({ ctrl: 'direkt' }).st; return { gasOk: ok.gasAh, gasBad: bad.gasAh, thr: GASRES * ok.gasAh + GASABS, uBad: bad.uBat, uOk: ok.uBat, stunden: T18 / 3600 }; });
    const check = mk('regler', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'regler', OWN, FIX), s = U.snap('regler', eff, T18, { sampleS: 120 }), st = s.st;
      inputRow(c, r, s, a, 'regler');
      r(eff.ctrl !== 'direkt' && eff.ctrl !== 'geliefert', 'Das Modul hängt nicht mehr direkt am Akku', 'Das Modul liegt noch ohne Laderegler am Akku. Stelle einen Reglertyp ein, der die Ladespannung begrenzt.');
      r(fin(st.gasAh) && st.gasAh <= v.thr, 'Der Akku gast nicht mehr (höchstens ' + f(v.thr, 2) + ' Ah in ' + f(v.stunden, 0) + ' h)',
        'Der Akku sammelt ' + vk(st.gasAh, 2) + ' Ah Gasung bei bis zu ' + vk(st.uBat, 1) + ' V. Ohne Fehler sind es ' + vk(v.gasOk, 2) + ' Ah, mit dem Fehler ' + vk(v.gasBad, 1) + ' Ah.');
    });
    return { vals, check,
      text: () => 'Der Blei-Akku (50 Ah, Ladezustand 90 %) wird bei starker Sonne (1000 W/m², 60-Zellen-Modul) heiß und gast: Im Prüfstand „Laderegler“ zeigt die Anzeige „Gasung“ steigende Werte. Finde den Fehler im Aufbau und behebe ihn. Die Prüfung rechnet ' + f(14400 / 3600, 0) + ' Stunden Prozesszeit.',
      hint: () => { const v = vals(); return [
        'Schau, wie das Modul am Akku angeschlossen ist. Ohne Regler hängt das Modul direkt an den Klemmen und die Spannung wird nicht begrenzt.',
        'Mit dem Fehler entstehen ' + f(v.gasBad, 1) + ' Ah Gasung bei bis zu ' + f(v.uBad, 1) + ' V; mit einem Regler bleibt die Gasung bei ' + f(v.gasOk, 2) + ' Ah.',
        'Musterlösung: Reglertyp PWM oder MPPT statt „direkt“. Die Prüfung lässt bis ' + f(v.thr, 2) + ' Ah Gasung zu.'
      ]; },
      start: () => A('regler', Object.assign({}, FIX, { ctrl: 'geliefert' }), {}),   // 'geliefert' verhält sich wie 'direkt', zeigt den Aufbau aber nicht an (Verdeckte-Fehler-Muster)
      sol: () => A('regler', Object.assign({}, FIX, { ctrl: 'pwm' }), {}),
      wrong: () => [{ name: 'Fehler nicht behoben', answer: A('regler', Object.assign({}, FIX, { ctrl: 'direkt' }), {}) }, { name: 'Regler mit zu hoher Ladeschlussspannung', answer: A('regler', Object.assign({}, FIX, { ctrl: 'pwm', uAbs: 16.4 }), {}) }] };
  })();

  /* ====================================================================== en19: Tiefentladeschutz einstellen (regler, sys) */
  const M19 = (() => {
    const OWN = ['lvd', 'lvdU'], MIN = 20, T19 = 43200, RESERVE = 1;   // 20 % Ladezustand (SPEC 7.2, en19), Muster mit 1 Prozentpunkt Reserve
    const FIX = Object.assign({}, RFIX, { modul: 'si36', ns: 1, np: 1, quelle: 'tagesgang', datum: 'winter', uhr: 20, wetter: 'bedeckt', cap: 100, soc0: 60, load: 100, lvd: true });
    const sim = ov => U.snap('regler', U.fullCtl('regler', Object.assign({}, FIX, ov || {})), T19, { sampleS: 300 });
    const muster = () => once('m19', () => { const dflt = C().batt.defaults('blei', 12); for (let u = 10.0; u <= 12.5001; u += 0.1) { const s = sim({ lvd: true, lvdU: Math.round(u * 10) / 10 }); if (s.ok && minSoc(s.res, 0, T19) >= MIN + RESERVE) return { lvdU: Math.round(u * 10) / 10, socMin: minSoc(s.res, 0, T19), standard: dflt.uLvd }; } return { lvdU: 12.5, socMin: minSoc(sim({ lvd: true, lvdU: 12.5 }).res, 0, T19), standard: dflt.uLvd }; });
    const vals = () => once('v19', () => { const m = muster(), s0 = sim({ lvd: true }), off = sim({ lvd: false }); return { lvdU: m.lvdU, socMin: m.socMin, standard: m.standard, socStd: minSoc(s0.res, 0, T19), socOhne: minSoc(off.res, 0, T19), min: MIN, last: FIX.load }; });
    const check = mk('regler', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'regler', OWN, FIX), s = U.snap('regler', eff, T19, { sampleS: 300 }), mn = s.ok ? minSoc(s.res, 0, T19) : NaN;
      inputRow(c, r, s, a, 'regler');
      r(eff.lvd === true, 'Der Tiefentladeschutz ist eingeschaltet', 'Der Schalter „Tiefentladeschutz“ steht auf aus: Der Regler trennt die Last nie, der Akku wird leergezogen.');
      r(fin(mn) && mn >= MIN, 'Der Ladezustand fällt nie unter ' + f(MIN, 0) + ' %', 'Der Ladezustand fällt auf ' + vk(mn, 0) + ' %. ' + (eff.lvd ? 'Dein Abschaltwert ' + vk(eff.lvdU, 1) + ' V liegt zu niedrig: Der Regler trennt die Last erst, wenn der Akku schon zu leer ist. Standard: ' + vk(v.standard, 1) + ' V.' : ''));
      r(s.ok && eff.lvd === true && lvdSeen(s.res), 'Der Tiefentladeschutz hat die Last getrennt', 'Bei deinen Einstellungen hat der Regler in dieser Nacht die Last nicht getrennt.');
    });
    return { vals, check,
      text: () => 'Eine Dauerlast von ' + f(FIX.load, 0) + ' W hängt in der Winternacht (bedeckt, von 20 Uhr an, 12 Stunden Prozesszeit) am Blei-Akku (100 Ah, 60 % Ladezustand). Stelle im Prüfstand „Laderegler“ den Tiefentladeschutz so ein, dass der Akku nie unter ' + f(MIN, 0) + ' % Ladezustand fällt. Der Regler muss die Last wirklich trennen („Last getrennt“ in der Meldungsliste).',
      hint: () => { const v = vals(); return [
        'Der Tiefentladeschutz trennt die Last bei einer Akkuspannung. Die Spannung hängt vom Ladezustand ab (Ruhespannungstabelle im Kennlinien-Tab). Stelle den Abschaltwert so hoch ein, dass er bei etwa ' + f(v.min, 0) + ' % Ladezustand erreicht wird.',
        'Der Standardwert ' + f(v.standard, 1) + ' V schützt hier nicht ausreichend: Der Ladezustand fällt auf ' + f(v.socStd, 0) + ' %. Ohne Schutz fällt er auf ' + f(v.socOhne, 0) + ' %.',
        'Musterlösung: Abschaltwert ' + f(v.lvdU, 1) + ' V. Der Ladezustand bleibt bei mindestens ' + f(v.socMin, 0) + ' %.'
      ]; },
      start: () => A('regler', Object.assign({}, FIX), {}),
      sol: () => A('regler', Object.assign({}, FIX, { lvd: true, lvdU: vals().lvdU }), {}),
      wrong: () => [{ name: 'Schutz aus', answer: A('regler', Object.assign({}, FIX, { lvd: false }), {}) }, { name: 'Abschaltwert zu niedrig', answer: A('regler', Object.assign({}, FIX, { lvd: true, lvdU: 10.5 }), {}) }] };
  })();

  /* ====================================================================== en20: Kabelquerschnitt (nur Kern) */
  const M20 = (() => {
    const OWN = ['aPv'], FIX = Object.assign({}, RFIX, { modul: 'si36', ns: 1, np: 1, usys: 12, lPv: 10, aPv: 1.5, quelle: 'konstant', G: 1000 }), MAXFALL = 0.03;   // 3 % Spannungsfall (SPEC 4.15 kabel-spannungsfall)
    const kappa = () => (C().calc.skal && C().calc.skal.kappa && C().calc.skal.kappa.kupfer) || 56;
    const kappaMax = () => { const k = C().calc.skal && C().calc.skal.kappa; return Math.max(kappa(), ...((k && k.alt) || [])); };   // Tabellenbuch-Varianten 56, 57, 58: die Prüfung gilt für den größten Leitwert (Regel 4)
    const dU = (L, I, A, k) => 2 * L * I / ((k || kappa()) * A);
    const vals = () => once('v20', () => {
      const k = keys(1000, 25, 'si36'), I = k.Impp, L = FIX.lPv, du = MAXFALL * FIX.usys, F = C().calc.formulas, amin = F.querschnitt.fn(L, I, du, kappa());
      const norm = C().calc.skal.upQuerschnitt(amin);
      return { impp: I, l: L, kappa: kappa(), kappaMax: kappaMax(), aminTol: F.querschnitt.fn(L, I, du, kappaMax()), duMax: du, amin, norm, falls: dU(L, I, FIX.aPv), fallProz: 100 * dU(L, I, FIX.aPv) / FIX.usys, verlust: I * I * 2 * L / (kappa() * FIX.aPv), maxProz: 100 * MAXFALL, usys: FIX.usys, aStart: FIX.aPv };
    });
    const check = mk('regler', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'regler', OWN, FIX), A_ = eff.aPv;
      inputRow(c, r, null, a, 'regler');
      r(fin(A_) && A_ + 1e-9 >= v.aminTol, 'Der Querschnitt reicht für den Mindestquerschnitt (' + f(v.amin, 1) + ' mm² mit κ = ' + f(v.kappa, 0) + ')', 'Dein Querschnitt ' + vk(A_, 1) + ' mm² ist kleiner als der Mindestquerschnitt ' + vk(v.amin, 1) + ' mm² (mit κ = ' + vk(v.kappa, 0) + '; mit κ = ' + vk(v.kappaMax, 0) + ' sind es ' + vk(v.aminTol, 1) + ' mm²). Wähle mehr Querschnitt, der nächste Normquerschnitt ist ' + vk(v.norm, 0) + ' mm².');
      const proz = 100 * dU(v.l, v.impp, A_, v.kappaMax) / v.usys;
      r(fin(proz) && proz <= v.maxProz + 1e-9, 'Der Spannungsfall bleibt bei höchstens ' + f(v.maxProz, 0) + ' %', 'Mit ' + vk(A_, 1) + ' mm² fallen auf der Leitung ' + vk(dU(v.l, v.impp, A_, v.kappaMax), 2) + ' V ab, das sind ' + vk(proz, 1) + ' % der Systemspannung und ' + vk(v.impp * v.impp * 2 * v.l / (v.kappaMax * A_), 1) + ' W Verlustleistung (mit κ = ' + vk(v.kappaMax, 0) + ').');
    });
    return { vals, check,
      text: () => 'Ein 36-Zellen-Modul lädt über eine ' + f(FIX.lPv, 0) + ' m lange Leitung (einfache Länge) einen 12-V-Akku, die Leitung wird warm und der Ertrag ist schwach (Prüfstand „Laderegler“, Querschnitt ' + f(FIX.aPv, 1) + ' mm²). Finde den Fehler und wähle den Querschnitt, bei dem der Spannungsfall höchstens ' + f(100 * MAXFALL, 0) + ' % der Systemspannung beträgt. Rechne mit dem Strom im MPP bei 1000 W/m² und κ = 56 m/(Ω·mm²) für Kupfer (Tabellenbücher nennen auch 57 oder 58; die Prüfung lässt das zu).',
      hint: () => { const v = vals(); return [
        'Der Spannungsfall hängt vom Strom, von der Länge (Hin- und Rückleiter, also zweimal) und vom Querschnitt ab. Rechne zuerst die zulässige Spannung in Volt aus, dann den Mindestquerschnitt, dann wähle den nächsten Normquerschnitt.',
        'Der Strom im MPP beträgt ' + f(v.impp, 2) + ' A. Zulässig sind ' + f(v.duMax, 2) + ' V. Mit ' + f(v.aStart, 1) + ' mm² fallen ' + f(v.falls, 2) + ' V ab (' + f(v.fallProz, 1) + ' %), das sind ' + f(v.verlust, 1) + ' W Verlust.',
        'Musterlösung: A = 2 · ' + f(v.l, 0) + ' m · ' + f(v.impp, 2) + ' A / (' + f(v.kappa, 0) + ' · ' + f(v.duMax, 2) + ' V) = ' + f(v.amin, 2) + ' mm², aufgerundet auf den Normquerschnitt ' + f(v.norm, 0) + ' mm².'
      ]; },
      start: () => A('regler', Object.assign({}, FIX), {}),
      sol: () => A('regler', Object.assign({}, FIX, { aPv: vals().norm }), {}),
      wrong: () => [{ name: 'Querschnitt unverändert', answer: A('regler', Object.assign({}, FIX, { aPv: 1.5 }), {}) }, { name: 'Querschnitt zu klein', answer: A('regler', Object.assign({}, FIX, { aPv: 2.5 }), {}) }] };
  })();

  /* ====================================================================== en21: Tagesenergie des Moduls (insel, sys) */
  const M21 = (() => {
    const FIX = Object.assign({}, IFIX, { datum: 'sommer', wetter: 'klar', uhr: 0, cap: 800, soc0: 20 }), TOL = 0.10;
    const sim = () => U.snap('insel', U.fullCtl('insel', FIX), TAGEND, { sampleS: 600 });
    const vals = () => once('v21', () => {
      const s = sim(), K = C(), lat = K.sun.site('mitte').lat, hKwh = K.sun.dayEnergy({ N: 172, lat, beta: FIX.neigung, gam: 0, c: 0 }), sp = K.pv.presets.si60, area = FIX.ns * FIX.np * sp.A, eta = keys(1000, 25).eta;
      return { e: U.dayMax(s.res, 'ePv'), pmax: maxOf(s.res, 'pPv'), hKwh, area, eta, etaP: 100 * eta, faust: hKwh * area * eta * 1000, tol: 10, np: FIX.np };
    });
    const check = mk('insel', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.numAns(a), { label: 'Energie des Feldes an einem klaren Sommertag in Wh', refs: [{ v: v.e }], tol: TOL, unit: 'Wh', digits: 0, wrong: [
        { v: v.e / 1000, msg: 'Das ist die Energie in kWh. Gefragt ist die Angabe in Wh.' },
        { v: v.pmax, msg: 'Das ist die höchste Leistung in W. Gefragt ist die Energie über den ganzen Tag in Wh.' }] });
    });
    return { vals, check,
      text: () => 'Zwei 60-Zellen-Module parallel (Neigung ' + f(FIX.neigung, 0) + '°, Süd, Standort Ermsleben, MPPT-Regler, großer Akku mit 800 Ah bei 20 % Ladezustand, damit der Regler nichts abregeln muss) stehen an einem klaren Sommertag (21.6.) in der Sonne. Wie viel Energie in Wh liefert das Feld von 0 bis 24 Uhr Sonnenzeit? Lass im Prüfstand „Inselanlage“ den Tag laufen (Tagessprung „Mitternacht“) und lies „Solarenergie heute“ kurz vor Mitternacht ab.',
      ask: { label: 'Energie des Feldes an diesem Tag', unit: 'Wh' },
      hint: () => { const v = vals(); return [
        'Die Energie ist die Fläche unter der Kurve der Solarleistung über der Zeit. Die Anzeige „Solarenergie heute“ zählt sie mit. Lies sie vor Mitternacht ab, danach beginnt der Zähler neu.',
        'Zur Kontrolle: Auf die Moduloberfläche treffen ' + f(v.hKwh, 1) + ' kWh/m². Das Feld hat ' + f(v.area, 1) + ' m² Fläche und ' + f(v.etaP, 1) + ' % Wirkungsgrad, das gibt als Faustrechnung etwa ' + f(v.faust, 0) + ' Wh (ohne Verluste im Regler).',
        'Musterlösung: Der Tageslauf liefert ' + f(v.e, 0) + ' Wh (Toleranz ' + f(v.tol, 0) + ' %); die höchste Leistung ist ' + f(v.pmax, 0) + ' W.'
      ]; },
      start: () => A('insel', Object.assign({}, FIX), { value: null }),
      sol: () => A('insel', Object.assign({}, FIX), { value: vals().e }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein (kWh)', answer: A('insel', {}, { value: v.e / 1000 }) }, { name: 'zu groß', answer: A('insel', {}, { value: v.e * 1.6 }) }]; } };
  })();

  /* ====================================================================== en22: Neigung im Winter (nur Kern) */
  const M22 = (() => {
    const OWN = ['neigung', 'azimut'], FIX = { ort: 'mitte', datum: 'winter', wetter: 'klar', azimut: 0 }, MIN = 0.95;   // 95 % von bestTilt (SPEC 7.2, en22)
    const lat = () => C().sun.site('mitte').lat;
    const de = (b, g) => C().sun.dayEnergy({ N: 355, lat: lat(), beta: b, gam: g || 0, c: 0 });
    const vals = () => once('v22', () => { const best = C().sun.bestTilt(355, lat(), 0, 0), bs = C().sun.bestTilt(172, lat(), 0, 0); return { best, eBest: de(best), e35: de(35), q35: de(35) / de(best), q35p: 100 * de(35) / de(best), min: MIN, bestSommer: bs, e10: de(10), lat: lat() }; });
    const check = mk('insel', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'insel', OWN, FIX);
      inputRow(c, r, null, a, 'insel');
      const e = de(eff.neigung, eff.azimut), q = e / v.eBest;
      r(fin(q) && q >= MIN, 'Der Tagesertrag am 21.12. beträgt mindestens ' + f(100 * MIN, 0) + ' % des Ertrags bei der besten Neigung',
        'Bei ' + vk(eff.neigung, 0) + '° Neigung und ' + vk(eff.azimut, 0) + '° Abweichung von Süd treffen ' + vk(e, 2) + ' kWh/m² auf das Modul, bei der besten Neigung (' + vk(v.best, 0) + '°, Süd) sind es ' + vk(v.eBest, 2) + ' kWh/m²: ' + vk(100 * q, 0) + ' %. ' + (eff.azimut !== 0 ? 'Das Modul steht nicht nach Süden.' : (eff.neigung < v.best ? 'Dein Modul steht zu flach für die tiefe Wintersonne.' : 'Dein Modul steht zu steil.')));
    });
    return { vals, check,
      text: () => 'Im Winter steht die Sonne tief. Stelle im Prüfstand „Inselanlage“ die Neigung des Moduls (Süd, 21.12., klarer Himmel, Ermsleben) so ein, dass der Tagesertrag möglichst groß ist: mindestens ' + f(100 * MIN, 0) + ' % des Ertrags bei der besten Neigung. Das Diagramm „Ertrag über Neigung“ im Tab Kennlinien hilft.',
      hint: () => { const v = vals(); return [
        'Für die tiefe Wintersonne muss das Modul steiler stehen als im Sommer. Im Diagramm „Ertrag über Neigung“ steht das Maximum der Kurve.',
        'Bei ' + f(35, 0) + '° (der Voreinstellung) treffen ' + f(v.e35, 2) + ' kWh/m² auf das Modul, das sind nur ' + f(v.q35p, 0) + ' % des Besten. Im Sommer liegt die beste Neigung bei ' + f(v.bestSommer, 0) + '°.',
        'Musterlösung: Neigung ' + f(v.best, 0) + '° mit ' + f(v.eBest, 2) + ' kWh/m². Die Prüfung lässt ab ' + f(100 * v.min, 0) + ' % zu.'
      ]; },
      consts: [35],
      start: () => A('insel', Object.assign({}, FIX, { neigung: 35 }), {}),
      sol: () => A('insel', Object.assign({}, FIX, { neigung: vals().best }), {}),
      wrong: () => [{ name: 'zu flach', answer: A('insel', Object.assign({}, FIX, { neigung: 10 }), {}) }, { name: 'nicht nach Süden', answer: A('insel', Object.assign({}, FIX, { neigung: Math.round(vals().best), azimut: 90 }), {}) }] };
  })();

  /* ====================================================================== en23: Auslegung Gartenhaus (design, sys) */
  const M23 = (() => {
    const GER = [{ name: 'LED-Licht (2 × 5 W)', P: 10, stunden: 4, typ: 'dc' }, { name: 'Wasserpumpe', P: 60, stunden: 1, typ: 'dc' }, { name: 'Radio', P: 10, stunden: 3, typ: 'dc' }, { name: 'Handy und Laptop laden', P: 30, stunden: 2, typ: 'dc' }];
    const INP = () => ({ geraete: GER.map(g => Object.assign({}, g)), Usys: 12, tage: 2, ort: 'mitte', tag: 355, wetter: 'wolkig', neigung: null, azimut: 0, chem: 'blei', dod: null, PR: 0.65, modul: 'si60', laenge: { pv: 5, akku: 1, wr: 1 }, spannungsfall: 0.02, wrSparmodus: false });
    const MAXF = 1.8, MINSTEPS = 7;   // 1,8 mal Mindestauslegung (SPEC 7.2, en23), Rechenweg mit allen Schritten
    const D = () => C() && C().design;
    const hasDesign = () => !!(D() && typeof D().autoDesign === 'function' && typeof D().verify === 'function');
    const muster = () => once('m23', () => { const inp = INP(), res = D().autoDesign(inp); return { inp, res }; });
    const wh = g => g.reduce((s, x) => s + x.P * x.stunden, 0);
    const pMod = res => { const k = keys(1000, 25, 'si60'); return (res.nModule || 0) * k.Pmpp; };
    const aWh = (res, inp) => (res.akkuAh || 0) * inp.Usys;
    const vals = () => once('v23', () => { if (!hasDesign()) return { err: 'design fehlt' }; const m = muster(), r = m.res; return { eTag: wh(GER), tage: m.inp.tage, psh: r.psh, pPv: r.pPv, nModule: r.nModule, akkuAh: r.akkuAh, reglerA: r.reglerA, maxF: MAXF, pMin: pMod(r), aMinWh: aWh(r, m.inp), usys: m.inp.Usys }; });
    const check = mk('insel', [], (c, r, a) => {
      if (!hasDesign()) { r(false, 'Der Auslegungskern ist geladen', 'ENR_CORE.design fehlt (enrsys.js): Die Auslegung kann nicht geprüft werden.'); return; }
      const d = a && a.design, m = muster(), inp = d && d.inp, res0 = d && d.result;
      r(!!(inp && Array.isArray(inp.geraete) && inp.geraete.length), 'Eine Auslegung liegt vor (Tab Auslegen)', 'Es liegt noch keine Auslegung vor. Öffne den Tab „Auslegen“ und durchlaufe den Assistenten.');
      if (!(inp && Array.isArray(inp.geraete) && inp.geraete.length)) return;
      const ok1 = Math.abs(wh(inp.geraete) - wh(GER)) < 1e-6 && inp.tag === 355 && inp.tage >= 2 && inp.Usys === 12;
      r(ok1, 'Die Eingaben stimmen mit der Aufgabe überein (Geräteliste, 21.12., zwei Tage Autonomie, 12 V)', 'Die Auslegung rechnet mit ' + vk(wh(inp.geraete), 0) + ' Wh pro Tag, ' + f(inp.tage, 0) + ' Tag(en) Autonomie am Tag ' + f(inp.tag, 0) + ' des Jahres und ' + f(inp.Usys, 0) + ' V. Verlangt sind ' + f(wh(GER), 0) + ' Wh pro Tag (Geräteliste), mindestens ' + f(m.inp.tage, 0) + ' Tage, Tag ' + f(m.inp.tag, 0) + ' und ' + f(m.inp.Usys, 0) + ' V.');
      let result = res0; if (!(result && fin(result.nModule))) { try { result = D().autoDesign(inp); } catch (e) { result = null; } }
      const steps = result && Array.isArray(result.steps) ? result.steps : [];
      r(steps.length >= MINSTEPS && steps.every(s => typeof s === 'string' ? s.length > 0 : !!s), 'Der Rechenweg ist vollständig (' + f(MINSTEPS, 0) + ' Posten mit eingesetzten Zahlen)', 'Der Rechenweg hat ' + f(steps.length, 0) + ' Posten, verlangt sind mindestens ' + f(MINSTEPS, 0) + '.');
      let ver = null; try { ver = result ? D().verify(inp, result, {}) : null; } catch (e) { ver = null; }
      r(!!(ver && ver.ok), 'Die Simulation der Schlechtwettertage besteht (kein Tiefentladeschutz)', ver ? 'Die Simulation fällt durch: tiefster Ladezustand ' + vk(100 * (ver.socMin <= 1 ? ver.socMin : ver.socMin / 100), 0) + ' %, Tiefentladeschutz bei ' + (fin(ver.tLvd) ? vk(ver.tLvd, 1) + ' h' : 'unbekannter Zeit') + '. Modul, Akku oder beides sind zu klein.' : 'Die Simulation konnte nicht laufen.');
      const pm = result ? pMod(result) : NaN, am = result ? aWh(result, inp) : NaN, v = vals();
      r(fin(pm) && fin(am) && pm <= MAXF * v.pMin + 1e-9 && am <= MAXF * v.aMinWh + 1e-9, 'Die Anlage ist nicht größer als ' + f(MAXF, 1) + ' mal die Mindestauslegung',
        'Deine Auslegung hat ' + vk(pm, 0) + ' W Modulleistung und ' + vk(am, 0) + ' Wh Akku; die Mindestauslegung ' + vk(v.pMin, 0) + ' W und ' + vk(v.aMinWh, 0) + ' Wh, die Grenze das ' + f(MAXF, 1) + '-Fache.');
    });
    return { vals, check,
      text: () => 'Gartenhaus: Dimensioniere eine Inselanlage (12 V, Ermsleben) für den Winter. Verbraucher: LED-Licht 2 × 5 W (4 Stunden), Wasserpumpe 60 W (1 Stunde), Radio 10 W (3 Stunden), Handy und Laptop laden 30 W (2 Stunden). Auslegungstag 21.12. (wolkig), zwei Tage Autonomie. Wähle Modul, Akku, Regler, Leitungen und Sicherungen im Tab „Auslegen“, prüfe sie mit „Simulation prüfen“ und gib die Auslegung ab. Die Anlage darf höchstens das 1,8-Fache der Mindestauslegung groß sein.',
      hint: () => { const v = vals(); if (v.err) return ['Schritt für Schritt: Tagesenergie, Sonnenstunden, Modulleistung, Akku, Regler, Wechselrichter, Kabel, Sicherung.', 'Der Auslegungskern ist nicht geladen.', 'Der Auslegungskern ist nicht geladen.']; return [
        'Gehe die Schritte des Assistenten der Reihe nach durch: Tagesenergie, Sonnenstunden am Auslegungstag, Modulleistung, Akku, Regler, Leitungen, Sicherungen. Danach „Simulation prüfen“.',
        'Der Tagesverbrauch beträgt ' + f(v.eTag, 0) + ' Wh. Die Sonnenstunden am 21.12. (wolkig) betragen ' + f(v.psh, 2) + ' h. Die Modulleistung folgt aus Tagesenergie geteilt durch Sonnenstunden und Systemfaktor.',
        'Musterlösung (Mindestauslegung): ' + f(v.nModule, 0) + ' Modul(e) mit zusammen ' + f(v.pMin, 0) + ' W, Akku ' + f(v.akkuAh, 0) + ' Ah, Regler ' + f(v.reglerA, 0) + ' A. Die Grenze ist das ' + f(v.maxF, 1) + '-Fache.'
      ]; },
      start: () => A('insel', {}, { design: null }),
      sol: () => { if (!hasDesign()) return A('insel', {}, { design: null }); const m = muster(); return A('insel', {}, { design: { inp: m.inp, result: m.res } }); },
      wrong: () => {
        if (!hasDesign()) return [{ name: 'keine Auslegung', answer: A('insel', {}, { design: null }) }, { name: 'leer', answer: A('insel', {}, { design: {} }) }];
        const m = muster(), small = Object.assign({}, m.res, { nModule: 1, akkuAh: 50 }), big = Object.assign({}, m.res, { nModule: Math.max(6, 4 * m.res.nModule), akkuAh: Math.max(600, 4 * m.res.akkuAh) });
        return [{ name: 'zu klein', answer: A('insel', {}, { design: { inp: m.inp, result: small } }) }, { name: 'zu groß', answer: A('insel', {}, { design: { inp: m.inp, result: big } }) }];
      } };
  })();

  /* ====================================================================== en24: Camper, 24 V (insel, sys) */
  const M24 = (() => {
    const OWN = ['cap', 'ns', 'np', 'modul', 'chem'], FIX = Object.assign({}, IFIX, { usys: 24, lastprofil: 'frei', pFrei: 60, datum: 'sommer', wetter: 'klar', uhr: 6, soc0: 50, wr: 'kein', imax: 40, cap: 20, ns: 1, np: 1, chem: 'blei', modul: 'si60' }), T24 = 2 * DAY, VOLL = 95;   // FIX = Anfangszustand der Aufgabe (20-Ah-Blei-Akku, ein Modul)   // 95 % am zweiten Tag (SPEC 7.2, en24)
    const batt = chem => C().batt.defaults(chem, 24);
    const meas = res => ({ socMin: minSoc(res, 0, T24), socMax2: maxSoc(res, DAY, T24), lvd: lvdSeen(res) });
    const sim = ov => U.snap('insel', U.fullCtl('insel', Object.assign({}, FIX, ov || {})), T24, { sampleS: 900 });
    const muster = () => once('m24', () => {
      for (const np of [1, 2]) for (const cap of [50, 100, 150, 200, 300, 400]) {
        const ov = { chem: 'lifepo4', modul: 'si60', ns: 1, np, cap }, s = sim(ov); if (!s.ok) continue; const m = meas(s.res);
        if (m.socMin >= 1 - batt('lifepo4').dodMax - 1e-9 && m.socMin >= 20 && !m.lvd && m.socMax2 >= VOLL) return Object.assign({}, ov, { socMin: m.socMin, socMax2: m.socMax2 });
      }
      return { chem: 'lifepo4', modul: 'si60', ns: 1, np: 2, cap: 400, socMin: NaN, socMax2: NaN };
    });
    const vals = () => once('v24', () => { const m = muster(), K = C(), lp = K.loads && K.loads.profile ? K.loads.profile('camper') : null; return { cap: m.cap, np: m.np, socMin: m.socMin, socMax2: m.socMax2, eTag: FIX.pFrei * 24, dodBlei: 100 * batt('blei').dodMax, dodLi: 100 * batt('lifepo4').dodMax, socMinBlei: 100 * (1 - batt('blei').dodMax), socMinLi: 100 * (1 - batt('lifepo4').dodMax), voll: VOLL, kwh: m.cap * 24 / 1000 }; });
    const check = mk('insel', OWN, (c, r, a) => {
      const eff = U.effOf(c, 'insel', OWN, FIX), s = U.snap('insel', eff, T24, { sampleS: 900 }), m = s.ok ? meas(s.res) : { socMin: NaN, socMax2: NaN, lvd: false };
      inputRow(c, r, s, a, 'insel');
      const lim = 100 * (1 - batt(eff.chem).dodMax);
      r(fin(m.socMin) && m.socMin >= lim - 1e-9 && !m.lvd, 'Der Akku übersteht die Nächte, ohne tiefer als zulässig entladen zu werden (nicht unter ' + f(lim, 0) + ' % Ladezustand, kein Tiefentladeschutz)',
        'Der Ladezustand fällt auf ' + vk(m.socMin, 0) + ' % (zulässig für diese Akkuart: nicht unter ' + vk(lim, 0) + ' %)' + (m.lvd ? '; der Tiefentladeschutz hat die Last getrennt' : '') + '. Der Akku ist für die Kühlbox zu klein.');
      r(fin(m.socMax2) && m.socMax2 >= VOLL, 'Der Akku wird am zweiten Tag wieder voll (mindestens ' + f(VOLL, 0) + ' % Ladezustand)', 'Am zweiten Tag erreicht der Akku nur ' + vk(m.socMax2, 0) + ' % Ladezustand. Das Modul liefert nicht genug Energie, um ihn wieder zu füllen.');
    });
    return { vals, check,
      text: () => 'Camper mit 24 V: Die Kühlbox und die übrigen Dauerverbraucher ziehen zusammen rund um die Uhr ' + f(FIX.pFrei, 0) + ' W (Lastprofil „frei“ im Prüfstand „Inselanlage“, Sommer, klar, Start um 6 Uhr bei 50 % Ladezustand, zwei Tage Prozesszeit). Wähle Akku (Chemie, Kapazität) und Modul (Typ, Zahl) so, dass die Kühlbox die Nächte übersteht und der Akku am zweiten Tag wieder voll wird.',
      hint: () => { const v = vals(); return [
        'Zwei Bedingungen: Der Akku muss für den Verbrauch zwischen zwei Sonnentagen reichen (Kapazität, nutzbare Entladetiefe) und das Modul muss ihn am Tag wieder füllen.',
        'Die Last verbraucht ' + f(v.eTag, 0) + ' Wh pro Tag. Blei darf nur bis ' + f(v.socMinBlei, 0) + ' % Ladezustand entladen werden, Li-Ion bis ' + f(v.socMinLi, 0) + ' %.',
        'Musterlösung: Li-Ion, ' + f(v.cap, 0) + ' Ah (' + f(v.kwh, 1) + ' kWh) und ' + f(v.np, 0) + ' Modul(e) 60-Zellen. Tiefster Ladezustand ' + f(v.socMin, 0) + ' %, am zweiten Tag ' + f(v.socMax2, 0) + ' %.'
      ]; },
      start: () => A('insel', Object.assign({}, FIX), {}),
      sol: () => { const m = muster(); return A('insel', Object.assign({}, FIX, { chem: m.chem, modul: m.modul, ns: m.ns, np: m.np, cap: m.cap }), {}); },
      wrong: () => [{ name: 'Akku zu klein', answer: A('insel', Object.assign({}, FIX, { cap: 20, chem: 'blei', np: 2 }), {}) }, { name: 'Modul zu klein für den Akku', answer: A('insel', Object.assign({}, FIX, { chem: 'lifepo4', modul: 'si36', ns: 1, np: 1, cap: 800 }), {}) }] };
  })();

  /* ====================================================================== en25: Wechselrichter-Standby (nur Kern) */
  const M25 = (() => {
    const SN = 1000, SPARW = 1.5, SCHWELLE = 25;   // 1000 VA im Aufgabentext; Sparmodus 1,5 W und Erkennungsschwelle 25 W (SPEC 4.10, A14)
    const vals = () => once('v25', () => { const a = C().inv.models.insel.a, p = a * SN, wh = p * 24; return { sn: SN, aProz: 100 * a, p, wh, spar: SPARW * 24, sparW: SPARW, schwelle: SCHWELLE, kwh: wh / 1000, diff: wh - SPARW * 24 }; });
    const check = mk('insel', [], (c, r, a) => {
      const v = vals(), g = choiceOf(a, 'spar'), none = g === undefined || g === null || g === '';
      numRow(r, U.numAns(a), { label: 'Energie, die der Wechselrichter ohne Last in 24 Stunden verbraucht, in Wh', refs: [{ v: v.wh }], tol: 0.10, unit: 'Wh', digits: 0, wrong: [
        { v: v.kwh, msg: 'Das ist die Energie in kWh. Gefragt ist die Angabe in Wh.' },
        { v: v.spar, msg: 'Das ist der Verbrauch im Sparmodus. Gefragt ist der Normalbetrieb ohne Sparmodus.' },
        { v: v.p, msg: 'Das ist die Leistung in W, nicht die Energie in 24 Stunden.' }] });
      r(g === 'ja', 'Die Frage zum Sparmodus ist richtig beantwortet', none ? 'Wähle eine Antwort aus.' : 'Im Sparmodus verbraucht der Wechselrichter ' + vk(v.spar, 0) + ' Wh in 24 Stunden statt ' + vk(v.wh, 0) + ' Wh, er spart ' + vk(v.diff, 0) + ' Wh. Er erkennt dafür aber Lasten unter ' + vk(v.schwelle, 0) + ' W nicht.');
    });
    return { vals, check,
      text: () => 'Ein Inselwechselrichter mit ' + f(SN, 0) + ' VA ist eingeschaltet, aber es ist kein Verbraucher angeschlossen. Wie viel Energie in Wh verbraucht er in 24 Stunden allein für seinen Eigenbedarf (Normalbetrieb)? Lohnt der Sparmodus? Stelle im Prüfstand „Inselanlage“ den Wechselrichter auf ' + f(SN, 0) + ' VA, das Lastprofil auf „frei“ mit 0 W feste Last und beobachte die Akkuleistung, oder rechne mit dem Verlustmodell.',
      choices: () => [{ key: 'spar', q: 'Lohnt sich der Sparmodus, wenn die Verbraucher größer als die Erkennungsschwelle sind?', options: [{ value: 'ja', label: 'Ja, er spart Energie' }, { value: 'nein', label: 'Nein, er verbraucht mehr' }] }],
      ask: { label: 'Verbrauch ohne Last in 24 Stunden', unit: 'Wh' },
      hint: () => { const v = vals(); return [
        'Ohne Last frisst der Wechselrichter nur seinen Eigenbedarf: einen festen Anteil der Nennleistung (der Anteil a im Verlustmodell). Multipliziere die Leistung mit der Zeit.',
        'Das Modell rechnet ' + f(v.aProz, 1) + ' % der Nennleistung als Eigenbedarf: ' + f(v.p, 0) + ' W bei ' + f(v.sn, 0) + ' VA. Im Sparmodus sind es ' + f(v.sparW, 1) + ' W.',
        'Musterlösung: ' + f(v.p, 0) + ' W · 24 h = ' + f(v.wh, 0) + ' Wh. Im Sparmodus: ' + f(v.sparW, 1) + ' W · 24 h = ' + f(v.spar, 0) + ' Wh, also ' + f(v.diff, 0) + ' Wh weniger.'
      ]; },
      start: () => A('insel', { wr: '1000', sparmodus: false, lastprofil: 'frei', pFrei: 0 }, { value: null, choices: {} }),
      sol: () => A('insel', { wr: '1000', sparmodus: false, lastprofil: 'frei', pFrei: 0 }, { value: vals().wh, choices: { spar: 'ja' } }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('insel', {}, { value: v.spar, choices: { spar: 'ja' } }) }, { name: 'zu groß', answer: A('insel', {}, { value: v.wh * 2, choices: { spar: 'nein' } }) }]; } };
  })();

  /* ====================================================================== en26: Europaeischer Wirkungsgrad (calc) */
  const M26 = (() => {
    const SEED = 3;
    const ex = () => once('e26', () => C().calc.exercise('euroeta', SEED));
    const vals = () => once('v26', () => { const e = ex(); return { euro: e.answer.value, etas: e.given.eta.slice(), min: Math.min.apply(null, e.given.eta), max: Math.max.apply(null, e.given.eta), g50: e.given.eta[4] }; });
    const check = mk('netz', [], (c, r, a) => { exRow(r, ex(), U.rawOf(a, 'value'), 'Europäischer Wirkungsgrad richtig berechnet'); });
    return { vals, check,
      text: () => ex().question,
      table: () => ex().table,
      ask: { label: 'Europäischer Wirkungsgrad', unit: '%' },
      hint: () => { const v = vals(); return [
        'Der Europäische Wirkungsgrad ist ein gewichteter Mittelwert der Wirkungsgrade bei sechs Lasten. Die Last mit 50 % der Nennleistung zählt am stärksten.',
        'Der Wirkungsgrad bei 50 % Last beträgt ' + f(v.g50, 1) + ' %. Der Mittelwert muss zwischen ' + f(v.min, 1) + ' % und ' + f(v.max, 1) + ' % liegen.',
        'Musterlösung: Summe aus Gewicht mal Wirkungsgrad = ' + f(v.euro, 2) + ' %.'
      ]; },
      start: () => A('netz', {}, { value: null }),
      sol: () => A('netz', {}, { value: vals().euro }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('netz', {}, { value: v.euro * 0.8 }) }, { name: 'zu groß', answer: A('netz', {}, { value: v.euro * 1.15 }) }]; } };
  })();

  /* ====================================================================== en27: Wechselrichter richtig waehlen (netz, sys) */
  const M27 = (() => {
    const OWN = ['wrP'], FIX = Object.assign({}, NFIX, { ns: 10, np: 2, wrP: 800 }), MAXV = 0.03, GROESSEN = [800, 1500, 3000, 5000, 8000];   // 3 % Verlust (SPEC 7.2, en27)
    const measure = s => { const b = s.res && s.res.balance && s.res.balance.rig; return { ePv: b && fin(b.ePv) ? b.ePv : NaN, eCurt: b && fin(b.eCurt) ? b.eCurt : NaN, dead: U.faultHas(s.res, 'wr-zerstoert') || !!(s.st && s.st.dead) }; };
    const loss = m => (m.ePv + m.eCurt > 0 ? m.eCurt / (m.ePv + m.eCurt) : NaN);
    const sim = ov => U.snap('netz', U.fullCtl('netz', Object.assign({}, FIX, ov || {})), TAGEND, { sampleS: 900 });
    const muster = () => once('m27', () => { for (const w of GROESSEN) { const s = sim({ wrP: w }); if (!s.ok) continue; const m = measure(s); if (!m.dead && fin(loss(m)) && loss(m) <= MAXV) return { wrP: w, verlust: loss(m) }; } return { wrP: 8000, verlust: NaN }; });
    const vals = () => once('v27', () => { const m = muster(), kleiner = GROESSEN[Math.max(0, GROESSEN.indexOf(m.wrP) - 1)], s = sim({ wrP: kleiner }), mk_ = measure(s); return { wrP: m.wrP, verlust: 100 * m.verlust, max: 100 * MAXV, kleiner, verlKleiner: 100 * loss(mk_), kWp: FIX.ns * FIX.np * keys(1000, 25).Pmpp / 1000 }; });
    const check = mk('netz', OWN, (c, r, a) => {
      const v = vals(), mu = muster(), eff = U.effOf(c, 'netz', OWN, FIX), s = U.snap('netz', eff, TAGEND, { sampleS: 900 }), m = s.ok ? measure(s) : { ePv: NaN, eCurt: NaN, dead: false };
      inputRow(c, r, s, a, 'netz');
      const L = loss(m);
      r(!m.dead && fin(L) && L <= MAXV, 'Der Wechselrichter lebt und begrenzt höchstens ' + f(100 * MAXV, 0) + ' % der Energie',
        m.dead ? 'Der Wechselrichter wurde überspannt (die Leerlaufspannung des Strangs liegt über seiner Eingangsgrenze). Er braucht einen Typ mit höherer Eingangsspannung.' : 'Der Wechselrichter mit ' + vk(eff.wrP, 0) + ' W begrenzt ' + vk(100 * L, 1) + ' % der Energie des Feldes (erlaubt: ' + vk(100 * MAXV, 0) + ' %).');
      r(eff.wrP <= mu.wrP, 'Der Wechselrichter ist nicht größer als nötig', 'Mit ' + vk(eff.wrP, 0) + ' W ist der Wechselrichter größer als nötig; ' + vk(mu.wrP, 0) + ' W reichen (Verlust ' + vk(v.verlust, 1) + ' %).');
    });
    return { vals, check,
      text: () => 'Das Feld (' + f(FIX.ns, 0) + ' Module in Reihe, ' + f(FIX.np, 0) + ' Stränge parallel, 60-Zellen-Module, ' + f(keys(1000, 25).Pmpp * FIX.ns * FIX.np / 1000, 1) + ' kWp) ist größer als der Wechselrichter. Wähle im Prüfstand „Netzeinspeisung“ die Wechselrichterleistung so, dass an einem klaren Sommertag nicht mehr als ' + f(100 * MAXV, 0) + ' % der Energie wegen Begrenzung (Clipping) verloren gehen, aber nicht größer als nötig.',
      hint: () => { const v = vals(); return [
        'Ein zu kleiner Wechselrichter begrenzt die Leistung um die Mittagszeit (Clipping). Ein zu großer kostet unnötig Geld. Probiere die Größen der Reihe aus und vergleiche die Tagesverluste.',
        'Mit dem Wechselrichter ' + f(v.kleiner, 0) + ' W gehen ' + f(v.verlKleiner, 1) + ' % der Energie verloren, mit ' + f(v.wrP, 0) + ' W nur ' + f(v.verlust, 1) + ' %. Das Feld hat ' + f(v.kWp, 1) + ' kWp.',
        'Musterlösung: Wechselrichter ' + f(v.wrP, 0) + ' W (Verlust ' + f(v.verlust, 1) + ' %, Grenze ' + f(v.max, 0) + ' %).'
      ]; },
      start: () => A('netz', Object.assign({}, FIX), {}),
      sol: () => A('netz', Object.assign({}, FIX, { wrP: muster().wrP }), {}),
      wrong: () => [{ name: 'Wechselrichter zu klein', answer: A('netz', Object.assign({}, FIX, { wrP: 800 }), {}) }, { name: 'Wechselrichter zu groß', answer: A('netz', Object.assign({}, FIX, { wrP: 8000 }), {}) }] };
  })();

  /* ====================================================================== en28: Keine Einspeisung trotz Sonne (netz, sys) */
  const M28 = (() => {
    const OWN = ['netz'], FIX = Object.assign({}, NFIX, { uhr: 12, netz: false, wrP: 3000 }), T28 = 3600;
    const OPT = [{ value: 'netzausfall', label: 'Netzausfall: Der Wechselrichter hat abgeschaltet' }, { value: 'nacht', label: 'Es ist Nacht' }, { value: 'zerstoert', label: 'Der Wechselrichter-Eingang wurde überspannt' }, { value: 'clipping', label: 'Der Wechselrichter ist zu klein' }];
    const base = () => U.snap('netz', U.fullCtl('netz', FIX), T28, { sampleS: 300 });
    const reason = () => once('r28', () => { const b = base(); if (!b.ok) return null; const res = b.res; if (U.faultHas(res, 'netzausfall')) return 'netzausfall'; if (U.faultHas(res, 'wr-zerstoert')) return 'zerstoert'; if (b.st.elev <= 0) return 'nacht'; return 'clipping'; });
    const vals = () => once('v28', () => { const b = base(), ok = U.snap('netz', U.fullCtl('netz', Object.assign({}, FIX, { netz: true })), T28, { sampleS: 300 }); return { pAcAus: b.st.pAc, pAcAn: ok.st.pAc, pDc: ok.st.pDc, h: T28 / 3600, uhr: FIX.uhr }; });
    const check = mk('netz', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'netz', OWN, FIX), s = U.snap('netz', eff, T28, { sampleS: 300 }), g = choiceOf(a, 'grund'), none = g === undefined || g === null || g === '';
      inputRow(c, r, s, a, 'netz');
      r(eff.netz === true, 'Das Netz ist wieder eingeschaltet', 'Der Netzschalter steht noch auf „aus“: Ohne Netz darf der Wechselrichter nicht einspeisen.');
      r(s.ok && fin(s.st.pAc) && s.st.pAc > 0, 'Die Anlage speist wieder ein', 'Die Wechselstromleistung beträgt ' + vk(s.st.pAc, 0) + ' W, obwohl das Feld ' + vk(s.st.pDc, 0) + ' W liefern könnte.');
      r(!none && g === reason(), 'Der Grund ist richtig benannt', none ? 'Wähle eine Antwort aus.' : 'Die Meldungen des Prüfstands (Diagnose) nennen im Ausgangszustand „' + (OPT.find(o => o.value === reason()) || {}).label + '“; deine Auswahl „' + ((OPT.find(o => o.value === g) || {}).label || g) + '“ passt dazu nicht.');
    });
    return { vals, check, maskDiag: ['netzausfall'],
      text: () => 'Es ist ' + f(FIX.uhr, 0) + ' Uhr mittags (Sonnenzeit), die Sonne scheint, aber die Anlage speist nichts ein: Die Wechselstromleistung im Prüfstand „Netzeinspeisung“ ist null. Finde den Grund (Messwerte und Anzeigen), benenne ihn und behebe ihn, sodass die Anlage wieder einspeist.',
      choices: () => [{ key: 'grund', q: 'Warum speist die Anlage nicht ein?', options: OPT }],
      hint: () => { const v = vals(); return [
        'Schau in die Meldungsliste und auf die Anzeigen: Das Feld liefert Gleichstromleistung, aber am Ausgang des Wechselrichters kommt nichts an. Was muss vorhanden sein, damit ein Netzwechselrichter einspeisen darf?',
        'Bei Netzspannung könnte das Feld jetzt etwa ' + f(v.pDc, 0) + ' W Gleichstrom liefern, aber im Ausgangszustand kommen nur ' + f(v.pAcAus, 0) + ' W Wechselstrom heraus.',
        'Musterlösung: Netzausfall. Der Wechselrichter schaltet ab und speist nicht ein (kein Inselbetrieb). Nach dem Einschalten des Netzes speist er mit ' + f(v.pAcAn, 0) + ' W ein.'
      ]; },
      start: () => A('netz', Object.assign({}, FIX), { choices: {} }),
      sol: () => A('netz', Object.assign({}, FIX, { netz: true }), { choices: { grund: 'netzausfall' } }),
      wrong: () => [{ name: 'Fehler nicht behoben, falscher Grund', answer: A('netz', Object.assign({}, FIX, { netz: false }), { choices: { grund: 'nacht' } }) }, { name: 'behoben, aber falscher Grund', answer: A('netz', Object.assign({}, FIX, { netz: true }), { choices: { grund: 'clipping' } }) }] };
  })();

  /* ====================================================================== en29: Autarkie mit moeglichst kleinem Speicher (netz, sys) */
  const M29 = (() => {
    const OWN = ['speicher'], FIX = Object.assign({}, NFIX, { ns: 10, np: 2, wrP: 5000, datum: 'fruehling', wetter: 'heiter', speicher: 0 }), MUSTER = 4, MAXF = 1.3, RESERVE = 3;   // Muster 4 kWh Speicher, Schwelle = Autarkie des Musters minus 3 Prozentpunkte (SPEC 7: Anteile), Speicher höchstens 1,3-fach
    const aut = sp => U.snap('netz', U.fullCtl('netz', Object.assign({}, FIX, { speicher: sp })), TAGEND, { sampleS: 900 });
    const vals = () => once('v29', () => { const m = aut(MUSTER).st, o = aut(0).st; return { muster: MUSTER, autM: m.autarkie, aut0: o.autarkie, thr: Math.floor(m.autarkie - RESERVE), maxSp: MAXF * MUSTER, reserve: RESERVE, quote0: o.quote, quoteM: m.quote }; });
    const check = mk('netz', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'netz', OWN, FIX), s = U.snap('netz', eff, TAGEND, { sampleS: 900 });
      inputRow(c, r, s, a, 'netz');
      r(s.ok && fin(s.st.autarkie) && s.st.autarkie >= v.thr, 'Der Autarkiegrad beträgt mindestens ' + f(v.thr, 0) + ' %', 'Mit ' + vk(eff.speicher, 1) + ' kWh Speicher erreicht die Anlage ' + vk(s.st.autarkie, 0) + ' % Autarkie (ohne Speicher: ' + vk(v.aut0, 0) + ' %). Ein Speicher nimmt den Überschuss vom Tag und gibt ihn am Abend ab.');
      r(eff.speicher <= v.maxSp + 1e-9, 'Der Speicher ist nicht größer als nötig (höchstens ' + f(v.maxSp, 1) + ' kWh)', 'Dein Speicher mit ' + vk(eff.speicher, 1) + ' kWh ist größer als nötig; mit ' + vk(v.muster, 1) + ' kWh erreicht die Anlage ' + vk(v.autM, 0) + ' %.');
    });
    return { vals, check,
      text: () => 'Eine netzgekoppelte Anlage (' + f(FIX.ns * FIX.np, 0) + ' Module, Wechselrichter ' + f(FIX.wrP, 0) + ' W, Haushaltslast, Frühlingstag, heiter) deckt ohne Speicher nur einen Teil des Verbrauchs. Erhöhe im Prüfstand „Netzeinspeisung“ den Autarkiegrad auf mindestens die Schwelle, ohne den Speicher größer als nötig zu wählen. Die Schwelle und die Obergrenze für den Speicher entnimmst du der Musterlösung (siehe Tipps); die Prüfung rechnet einen ganzen Tag.',
      hint: () => { const v = vals(); return [
        'Der Speicher puffert den Überschuss vom Mittag für den Abend. Mit wachsender Größe steigt der Autarkiegrad, aber immer langsamer. Suche die kleinste Größe, die die Schwelle schafft.',
        'Ohne Speicher beträgt der Autarkiegrad ' + f(v.aut0, 0) + ' %. Gefordert sind mindestens ' + f(v.thr, 0) + ' %; der Speicher darf höchstens ' + f(v.maxSp, 1) + ' kWh groß sein.',
        'Musterlösung: ' + f(v.muster, 0) + ' kWh Speicher erreichen ' + f(v.autM, 0) + ' % Autarkie (Schwelle: Muster minus ' + f(v.reserve, 0) + ' Prozentpunkte).'
      ]; },
      start: () => A('netz', Object.assign({}, FIX, { speicher: 0 }), {}),
      sol: () => A('netz', Object.assign({}, FIX, { speicher: MUSTER }), {}),
      wrong: () => [{ name: 'Speicher zu klein', answer: A('netz', Object.assign({}, FIX, { speicher: 0 }), {}) }, { name: 'Speicher zu groß', answer: A('netz', Object.assign({}, FIX, { speicher: 10 }), {}) }] };
  })();

  /* ====================================================================== en30: Teil-B-Stil, mehrteilig (netz, sys) */
  const M30 = (() => {
    const FIX = Object.assign({}, NFIX, { ns: 13, np: 2, wrP: 5000, datum: 'sommer', wetter: 'klar', last: 'haushalt', speicher: 0, bezug: 35, verg: 8 });
    const INVEST_KWP = 1400, H = 1000, PR = 0.8, BEZUG = 0.35, VERG = 0.08, TMIN = -10, THEISS = 60;   // Annahmen laut Aufgabentext (A7, bitte aktualisieren)
    const sp = () => C().pv.presets.si60;
    const kWp = () => FIX.ns * FIX.np * keys(1000, 25).Pmpp / 1000;
    const gt = () => C().inv.gridTable.find(g => g.Pn === FIX.wrP) || {};
    const sim = () => U.snap('netz', U.fullCtl('netz', FIX), TAGEND, { sampleS: 900 });
    const amorti = quote => { const F = C().calc.formulas, ea = F.ertrag.fn(kWp(), H, PR), eig = quote * ea, einsp = (1 - quote) * ea; return F.amortisation.fn(INVEST_KWP * kWp(), eig, BEZUG, einsp, VERG); };
    const vals = () => once('v30', () => {
      const s = sim().st, g = gt(), uocK = FIX.ns * keys(1000, TMIN).Uoc, umppH = FIX.ns * keys(1000, THEISS).Umpp, q = s.quote / 100, ea = C().calc.formulas.ertrag.fn(kWp(), H, PR);
      return { uocKalt: uocK, umppHeiss: umppH, udcMax: g.udcMax, mppMin: g.mppMin, mppMax: g.mppMax, ertrag: (s.eEigen + s.eEinsp) / 1000, quote: s.quote, amorti: amorti(q), kwp: kWp(), uocMod: uocK / FIX.ns, umppMod: umppH / FIX.ns, invest: INVEST_KWP * kWp(), jahr: ea, bezug: BEZUG, verg: VERG, investKwp: INVEST_KWP, h: H, pr: PR, tmin: TMIN, theiss: THEISS, wrP: FIX.wrP, ns: FIX.ns, uocOk: uocK <= g.udcMax, fensterOk: umppH >= g.mppMin && umppH <= g.mppMax };
    });
    const OPT_JN = [{ value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' }];
    const check = mk('netz', [], (c, r, a) => {
      const v = vals(), qIn = U.fieldNum(a, 'quote'), refs = [{ v: v.amorti }]; if (qIn !== null && qIn >= 0 && qIn <= 100) refs.push({ v: amorti(qIn / 100) });
      numRow(r, U.fieldNum(a, 'uocKalt'), { label: 'Leerlaufspannung des Strangs bei ' + f(v.tmin, 0) + ' °C', refs: [{ v: v.uocKalt }], tol: 0.03, unit: 'V', digits: 0, wrong: [{ v: v.uocKalt / v.ns, msg: 'Das ist die Spannung eines einzelnen Moduls. Der Strang hat ' + f(v.ns, 0) + ' Module in Reihe.' }] });
      r(choiceOf(a, 'uocok') === (v.uocOk ? 'ja' : 'nein'), 'Eingangsspannung des Wechselrichters bei Kälte richtig beurteilt', choiceOf(a, 'uocok') === undefined ? 'Wähle eine Antwort aus.' : 'Die Leerlaufspannung ' + vk(v.uocKalt, 0) + ' V wird mit der höchsten Eingangsspannung ' + vk(v.udcMax, 0) + ' V des Wechselrichters verglichen.');
      r(choiceOf(a, 'fenster') === (v.fensterOk ? 'ja' : 'nein'), 'MPP-Fenster bei Hitze richtig beurteilt', choiceOf(a, 'fenster') === undefined ? 'Wähle eine Antwort aus.' : 'Die MPP-Spannung des Strangs bei ' + f(v.theiss, 0) + ' °C beträgt ' + vk(v.umppHeiss, 0) + ' V, das Fenster des Wechselrichters reicht von ' + vk(v.mppMin, 0) + ' V bis ' + vk(v.mppMax, 0) + ' V.');
      numRow(r, U.fieldNum(a, 'ertrag'), { label: 'Tagesertrag an einem klaren Sommertag in kWh (Wechselstrom)', refs: [{ v: v.ertrag }], tol: 0.10, unit: 'kWh', digits: 1, wrong: [{ v: v.ertrag * 1000, msg: 'Das ist die Energie in Wh. Gefragt ist die Angabe in kWh.' }] });
      numRow(r, qIn, { label: 'Eigenverbrauchsquote', refs: [{ v: v.quote }], absTol: 3, unit: '%', digits: 0, wrong: [{ v: 100 - v.quote, msg: 'Das ist der Anteil, der ins Netz geht. Die Eigenverbrauchsquote ist der Anteil des Ertrags, der selbst verbraucht wird.' }] });
      numRow(r, U.fieldNum(a, 'amorti'), { label: 'Amortisationszeit in Jahren (Annahmen im Text, ohne Zins und Alterung)', refs, tol: 0.15, unit: 'Jahre', digits: 1 });
    });
    return { vals, check,
      text: () => { const v = vals(); return 'Teil-B-Stil (fiktives Beispiel): Eine Anlage mit ' + f(v.kwp, 1) + ' kWp (' + f(FIX.ns * FIX.np, 0) + ' Module, ' + f(FIX.np, 0) + ' Stränge zu ' + f(FIX.ns, 0) + ' Modulen) speist über einen Wechselrichter mit ' + f(v.wrP, 0) + ' W ein (Eingangsspannung höchstens ' + f(v.udcMax, 0) + ' V, MPP-Fenster ' + f(v.mppMin, 0) + ' bis ' + f(v.mppMax, 0) + ' V). Haushaltslast, kein Speicher, Sommer, klar. (a) Berechne die Leerlaufspannung eines Strangs bei ' + f(v.tmin, 0) + ' °C und beurteile die Eingangsspannung bei Kälte und das MPP-Fenster bei ' + f(v.theiss, 0) + ' °C. (b) Gib den Tagesertrag und die Eigenverbrauchsquote an (Prüfstand „Netzeinspeisung“). (c) Rechne die Amortisationszeit grob: Annahmen (bitte aktualisieren): Anlagenpreis ' + f(v.investKwp, 0) + ' € je kWp, Jahresertrag ' + f(v.h, 0) + ' kWh je kWp mal Systemfaktor ' + f(v.pr, 1) + ', Bezugspreis ' + f(100 * v.bezug, 0) + ' ct/kWh, Vergütung ' + f(100 * v.verg, 0) + ' ct/kWh. Zins und Alterung bleiben unberücksichtigt, die Zahl ist nur eine grobe Größenordnung.'; },
      fields: () => [{ key: 'uocKalt', label: 'Leerlaufspannung des Strangs bei −10 °C', unit: 'V' }, { key: 'ertrag', label: 'Tagesertrag (Wechselstrom)', unit: 'kWh' }, { key: 'quote', label: 'Eigenverbrauchsquote', unit: '%' }, { key: 'amorti', label: 'Amortisationszeit', unit: 'Jahre' }],
      choices: () => [{ key: 'uocok', q: 'Bleibt die Leerlaufspannung bei Kälte unter der höchsten Eingangsspannung des Wechselrichters?', options: OPT_JN }, { key: 'fenster', q: 'Liegt die MPP-Spannung des Strangs bei Hitze im MPP-Fenster des Wechselrichters?', options: OPT_JN }],
      hint: () => { const v = vals(); return [
        'Rechne in Teilen: Strangspannung aus Modulspannung mal Modulzahl (Kälte für die Obergrenze, Hitze für die Untergrenze), Ertrag und Quote aus dem Prüfstand, Amortisation als Investition geteilt durch die Einsparung pro Jahr.',
        'Ein Modul hat bei ' + f(v.tmin, 0) + ' °C ' + f(v.uocMod, 1) + ' V Leerlaufspannung, bei ' + f(v.theiss, 0) + ' °C ' + f(v.umppMod, 1) + ' V MPP-Spannung. Der Jahresertrag wird mit ' + f(v.jahr, 0) + ' kWh angenommen, die Investition mit ' + f(v.invest, 0) + ' €.',
        'Musterlösung: Uoc des Strangs = ' + f(v.uocKalt, 0) + ' V; Tagesertrag ' + f(v.ertrag, 1) + ' kWh; Eigenverbrauchsquote ' + f(v.quote, 0) + ' %; Amortisation rund ' + f(v.amorti, 1) + ' Jahre.'
      ]; },
      start: () => A('netz', Object.assign({}, FIX), { fields: { uocKalt: null, ertrag: null, quote: null, amorti: null }, choices: {} }),
      sol: () => { const v = vals(); return A('netz', Object.assign({}, FIX), { fields: { uocKalt: v.uocKalt, ertrag: v.ertrag, quote: v.quote, amorti: v.amorti }, choices: { uocok: v.uocOk ? 'ja' : 'nein', fenster: v.fensterOk ? 'ja' : 'nein' } }); },
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('netz', {}, { fields: { uocKalt: v.uocKalt * 0.5, ertrag: v.ertrag * 0.5, quote: Math.max(0, v.quote - 30), amorti: v.amorti * 0.5 }, choices: { uocok: v.uocOk ? 'nein' : 'ja', fenster: v.fensterOk ? 'nein' : 'ja' } }) }, { name: 'zu groß', answer: A('netz', {}, { fields: { uocKalt: v.uocKalt * 1.6, ertrag: v.ertrag * 2, quote: Math.min(100, v.quote + 30), amorti: v.amorti * 2 }, choices: { uocok: v.uocOk ? 'nein' : 'ja', fenster: v.fensterOk ? 'nein' : 'ja' } }) }]; } };
  })();

  /* ====================================================================== Registrierung */
  T.register([
    def('en16', 'Akku', 'C-Rate, Ladezeit und Autonomie rechnen', 1, 'regler', M16),
    def('en17', 'Laderegler', 'Ladeschlussspannung für Blei einstellen', 2, 'regler', M17),
    def('en18', 'Fehlersuche', 'Der Akku gast bei starker Sonne', 2, 'regler', M18),
    def('en19', 'Laderegler', 'Tiefentladeschutz in der Nacht einstellen', 2, 'regler', M19),
    def('en20', 'Fehlersuche', 'Das Kabel wird warm: Querschnitt wählen', 2, 'regler', M20),
    def('en21', 'Auslegung', 'Energie des Moduls an einem Sommertag', 2, 'insel', M21),
    def('en22', 'Auslegung', 'Neigung im Winter', 2, 'insel', M22),
    def('en23', 'Auslegung', 'Gartenhaus auslegen', 3, 'insel', M23),
    def('en24', 'Auslegung', 'Camper mit 24 V: Akku und Modul wählen', 3, 'insel', M24),
    def('en25', 'Wechselrichter', 'Standby-Verbrauch des Wechselrichters', 2, 'insel', M25),
    def('en26', 'Wechselrichter', 'Europäischen Wirkungsgrad berechnen', 2, 'netz', M26),
    def('en27', 'Wechselrichter', 'Wechselrichter nicht zu klein, nicht zu groß', 2, 'netz', M27),
    def('en28', 'Fehlersuche', 'Die Sonne scheint, aber nichts wird eingespeist', 2, 'netz', M28),
    def('en29', 'Prüfungsstil', 'Autarkie mit möglichst kleinem Speicher', 3, 'netz', M29),
    def('en30', 'Prüfungsstil', 'Teil-B-Stil: 7-kWp-Anlage prüfen und rechnen', 3, 'netz', M30)
  ]);
  /* Musterwerte der Aufgaben en16-en30 (Schwellen aus Musterloesung, Stand 2026-10-22) fuer Tests und Ausbilder */
  T.thresholds2 = () => ({ en16: M16.vals(), en17: M17.vals(), en18: M18.vals(), en19: M19.vals(), en20: M20.vals(), en21: M21.vals(), en22: M22.vals(), en23: M23.vals(), en24: M24.vals(), en25: M25.vals(), en26: M26.vals(), en27: M27.vals(), en28: M28.vals(), en29: M29.vals(), en30: M30.vals() });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
