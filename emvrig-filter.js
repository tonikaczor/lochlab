/* emvrig-filter.js - EMV-Lab, Pruefstand `filter` (Netzfilter-Pruefstand, SPEC 5.3), Paket WP2a.
 *
 * Ein Netzfilter aus X-Kondensator, Y-Kondensatoren, Gleichtaktdrossel, Differenzdrossel und Ferrit zwischen derselben Uebungsquelle wie im Pruefstand `quelle`
 * (EMV_CORE.source.defaults) und der Netznachbildung (LISN). REALE BAUTEILE: Der Kondensator wird oberhalb seiner Eigenresonanz zur Induktivitaet (ESL), die Drossel
 * oberhalb ihrer Eigenresonanz zum Kondensator (Windungskapazitaet), der Kern saettigt; der Y-Kondensator treibt den Ableitstrom. Alles Rechnen kommt aus EMV_CORE
 * (filter.il/curve/leak/fres/satur, chain.lisn, limits, assess.conducted) ueber den Adapter EMV_RIGS.base.kit. Uebungsanlage: alle Zahlen sind Uebungswerte.
 * Herstellerdokumentation und aktuelle Norm massgeblich.
 *
 * Laden: im Browser NACH emvcore.js, (emvcore-lay.js, emvdraw.js) und emvrig-base.js; in Node holt sich die Datei die Basis per require.
 * Steuerwerte (SI, siehe emvrig-base.js): topo, cx F, cy F, drossel, ld H, lead m (0,015 = 15 mm, wie EMV_CORE.filter), ferrit Schalter, iLast A, klasse, leakReq in mA (Vorgabe, keine SI-Einheit).
 * Zusatz an assess(): rows:[{id:'leak', ampel, text}] (Ableitstrom gegen die Vorgabe der Uebung, getrennt von der Hauptampel).
 */
(function (root) {
  'use strict';
  const R = root.EMV_RIGS = root.EMV_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  if (!R.base) tryRequire('./emvrig-base.js');
  const B = R.base;
  if (!B) {
    if (typeof console !== 'undefined') console.warn('emvrig-filter.js: emvrig-base.js fehlt - Prüfstand filter nicht registriert.');
    if (typeof module !== 'undefined') module.exports = R;
    return;
  }
  if (typeof module !== 'undefined') module.exports = R;
  if (R.defs.filter) return;

  const { clamp, num, fm, fn, eng, isNum, okv, gfx, LEVERS } = B;
  const G = { quelle: LEVERS.quelle.name, pfad: LEVERS.pfad.name, senke: LEVERS.senke.name, anz: 'Anzeige und Vorgaben' };
  const F_LIM_MIN = 1.5e5, F_LIM_MAX = 3e7, FLOOR = -60;           // Rauschboden der Anzeige in dBµV (wie EMV_RIGS.base.spectrum)

  // =====================================================================================================================
  //  Steuerwerte, Messgeraete, Voreinstellungen
  // =====================================================================================================================
  const sel = (key, label, value, options, lever, help, more) => Object.assign({ key, label, type: 'select', value, options, group: G[lever || 'anz'], lever: lever || null, help }, more || {});
  const opt = (value, label) => ({ value, label });
  const CONTROLS = [
    sel('topo', 'Topologie', 'pi', [opt('kein', 'kein Filter (nur Reihenelemente)'), opt('C', 'C (nur Querzweig)'), opt('LC', 'LC (Quer, dann Reihe)'), opt('pi', 'Pi (Quer – Reihe – Quer)')], 'pfad',
      'Aufbau des Filters von der Quelle zur Netznachbildung. Kein Filter: nur Reihenelemente (Drossel). C: nur Querkondensatoren. LC: Querzweig auf der Geräteseite, dann die Drossel. Pi: Querzweig – Drossel – Querzweig.'),
    sel('cx', 'X-Kondensator Cx', 100e-9, [opt(0, 'ohne'), opt(10e-9, '10 nF'), opt(47e-9, '47 nF'), opt(100e-9, '100 nF'), opt(330e-9, '330 nF'), opt(1e-6, '1 µF')], 'pfad',
      'Kondensator zwischen den Leitern (Gegentakt). Er ist ein echtes Bauteil: Seine Anschlussinduktivität macht ihn oberhalb der Eigenresonanz 1/(2π·√(ESL·C)) zur Spule.', { unit: 'F', unitKind: 'cap', visible: s => s.topo !== 'kein' }),
    sel('cy', 'Y-Kondensator Cy (je Leiter)', 2.2e-9, [opt(0, 'ohne'), opt(1e-9, '1 nF'), opt(2.2e-9, '2,2 nF'), opt(4.7e-9, '4,7 nF')], 'pfad',
      'Kondensator von jedem Leiter zum Schutzleiter (Gleichtakt). Er verbessert die Gleichtaktdämpfung, treibt aber den Ableitstrom I = 2π·f·Cy·U.', { unit: 'F', unitKind: 'cap', visible: s => s.topo !== 'kein' }),
    sel('drossel', 'Gleichtaktdrossel', 'd10', [opt('ohne', 'ohne'), opt('d1', '1 mH'), opt('d3', '3,3 mH'), opt('d10', '10 mH'), opt('d22', '22 mH')], 'pfad',
      'Gleichtaktdrossel (Übungsbauteile). Die Drossel sperrt den Gleichtakt, bis ihre Windungskapazität sie oberhalb der Eigenresonanz kapazitiv macht. Ihre Streuung wirkt als kleine Differenzdrossel (1 % von L).', { visible: s => s.topo !== 'C' }),
    { key: 'ld', label: 'Zusätzliche Differenzdrossel Ld', type: 'slider', min: 0, max: 500e-6, step: 10e-6, scale: 'lin', unit: 'H', unitKind: 'ind', value: 0, group: G.pfad, lever: 'pfad',
      help: 'Zusätzliche Reihendrossel für den Gegentakt (nur Differenzanteil). Zur Streuinduktivität der Gleichtaktdrossel kommt sie hinzu.', visible: s => s.topo !== 'C' },
    { key: 'lead', label: 'Anschlusslänge der Kondensatoren', type: 'slider', min: 0, max: 0.03, step: 0.001, scale: 'lin', unit: 'm', unitKind: 'len', value: 0.015, group: G.pfad, lever: 'pfad',
      help: 'Länge der Kondensatoranschlüsse. Jeder Millimeter bringt etwa 1 nH Anschlussinduktivität (ESL); sie senkt die Eigenresonanz und damit die Dämpfung bei hohen Frequenzen.', visible: s => s.topo !== 'kein' },
    { key: 'ferrit', label: 'Ferrit am Netzkabel', type: 'switch', value: false, group: G.pfad, lever: 'pfad',
      help: 'Ferrit auf dem Netzkabel (Gleichtakt): in Reihe ein Verlustwiderstand Rf(f) = 100 Ω·√(f/100 MHz) (Übungswert, rein ohmsch).' },
    { key: 'iLast', label: 'Laststrom', type: 'slider', min: 0.1, max: 10, step: 0.01, scale: 'log', unit: 'A', unitKind: 'amp', value: 1, group: G.senke, lever: 'senke',
      help: 'Strom, den das Gerät aus dem Netz zieht. Er fließt durch die Drossel und sättigt ihren Kern: Die Induktivität sinkt mit 1/(1 + (I/Isat)²).' },
    sel('klasse', 'Grenzlinie', 'B', [opt('A', 'Klasse A'), opt('B', 'Klasse B')], null, 'Klasse der Übungsgrenzlinie (angelehnt an die Grenzwertklassen der Fachgrundnormen; aktuelle Norm maßgeblich). Klasse B ist strenger.', { noLever: true }),
    { key: 'leakReq', label: 'Vorgabe Ableitstrom', type: 'slider', min: 0.1, max: 3.5, step: 0.05, scale: 'lin', unit: 'mA', unitKind: 'plain', value: 0.3, group: G.anz, lever: null,
      help: 'Vorgabe der Übung für den Ableitstrom (kein Normwert): Die Anzeige vergleicht den berechneten Ableitstrom nur mit diesem Wert. Herstellerdokumentation und aktuelle Norm maßgeblich.' }
  ];
  const M = (key, label, unit, digits, min, max, o) => Object.assign({ key, label, unit, digits, min, max }, o || {});
  const METERS = [
    M('ilGG1M', 'Dämpfung GG bei 1 MHz', 'dB', 1, 0, 100, { help: 'Einfügungsdämpfung für den Gegentakt bei 1 MHz im 100-Ω-System (mit Durchkopplungsgrenze 80 dB).' }),
    M('ilGT1M', 'Dämpfung GT bei 1 MHz', 'dB', 1, 0, 100, { help: 'Einfügungsdämpfung für den Gleichtakt bei 1 MHz im 25-Ω-System (mit Durchkopplungsgrenze 80 dB).' }),
    M('fgGG', 'Grenzfrequenz GG (−3 dB)', 'kHz', 1, 0, 10000, { zeroIsNone: true, help: 'Erste Frequenz, bei der das Filter im Gegentakt 3 dB dämpft; 0 bedeutet: keine.' }),
    M('fgGT', 'Grenzfrequenz GT (−3 dB)', 'kHz', 1, 0, 10000, { zeroIsNone: true, help: 'Erste Frequenz, bei der das Filter im Gleichtakt 3 dB dämpft; 0 bedeutet: keine.' }),
    M('leak', 'Ableitstrom', 'mA', 3, 0, 3.5, { help: 'Strom über einen Y-Kondensator bei 230 V und 50 Hz, I = 2π·f·Cy·U. Vergleich nur mit der Vorgabe der Übung.' }),
    M('fresX', 'Resonanz Cx', 'MHz', 2, 0, 50, { zeroIsNone: true, help: 'Eigenresonanz des X-Kondensators 1/(2π·√(ESL·C)); darüber wirkt er als Spule. 0 bedeutet: kein X-Kondensator.' }),
    M('fresD', 'Resonanz Drossel', 'kHz', 0, 0, 5000, { zeroIsNone: true, help: 'Eigenresonanz der Drossel 1/(2π·√(L·Cw)); darüber wirkt sie als Kondensator. 0 bedeutet: keine Drossel im Kreis.' }),
    M('satur', 'Induktivität (Sättigung)', '%', 0, 0, 100, { warnBelow: 90, help: 'Anteil der Induktivität der Drossel beim Laststrom: 1/(1 + (I/Isat)²).' }),
    M('lMax', 'Pegel max.', 'dBµV', 1, 0, 140, { help: 'Größter Spitzenpegel (Gleichtakt und Gegentakt zusammen) nach dem Filter, 150 kHz bis 30 MHz.' }),
    M('margin', 'Marge (Mittelwert)', 'dB', 1, -80, 40, { warnBelow: 6, help: 'Kleinster Abstand zur Mittelwert-Linie der Übungsgrenzlinie; positiv ist gut, ab 6 dB grün.' })
  ];
  // Voreinstellungen: die Beschreibungen setzen die Bauteilwerte aus den Parametern selbst ein (eine Quelle)
  const DNAME = { d1: '1-mH', d3: '3,3-mH', d10: '10-mH', d22: '22-mH' };
  const P_EINFACH = { topo: 'C', cx: 100e-9, cy: 2.2e-9, drossel: 'ohne' };
  const P_PI_D3 = { topo: 'pi', cx: 100e-9, cy: 2.2e-9, drossel: 'd3' };
  const P_SCHLECHT = { topo: 'pi', cx: 100e-9, cy: 2.2e-9, drossel: 'd22', lead: 0.03 };
  const P_GUT = { topo: 'pi', cx: 1e-6, cy: 2.2e-9, drossel: 'd3', ld: 500e-6, lead: 0.005, ferrit: true };
  const PRESET_LIST = [
    { id: 'ohne', name: 'Ohne Filter', info: 'Kein Filterelement: Der Pegel entspricht dem der Störquelle.', params: { topo: 'kein', drossel: 'ohne' } },
    { id: 'einfach', name: 'Einfach (Cx + Cy)', info: 'Nur Querkondensatoren: Cx ' + eng(P_EINFACH.cx, 'F') + ' und Cy ' + eng(P_EINFACH.cy, 'F') + '.', params: P_EINFACH },
    { id: 'pi-d3', name: 'Pi-Filter mit 3,3-mH-Drossel', info: 'Pi-Filter mit Cx ' + eng(P_PI_D3.cx, 'F') + ', Cy ' + eng(P_PI_D3.cy, 'F') + ' und der ' + DNAME[P_PI_D3.drossel] + '-Gleichtaktdrossel.', params: P_PI_D3 },
    { id: 'schlecht', name: 'Schlecht (lange Anschlüsse, große Drossel)', info: 'Lange Anschlüsse (' + fn(P_SCHLECHT.lead * 1e3, 0) + ' mm) und die ' + DNAME[P_SCHLECHT.drossel] + '-Drossel: Die Eigenresonanzen zeigen sich als Einbrüche und Höcker der Dämpfung.', params: P_SCHLECHT },
    { id: 'gut', name: 'Gut (bestes Filter allein)', info: 'Pi-Filter mit Cx ' + eng(P_GUT.cx, 'F') + ', Cy ' + eng(P_GUT.cy, 'F') + ', ' + DNAME[P_GUT.drossel] + '-Drossel, Ld ' + eng(P_GUT.ld, 'H') + ', Anschlüssen von ' + fn(P_GUT.lead * 1e3, 0) + ' mm und Ferrit. Allein bringt das Filter die Ampel nur bis gelb: Der Gleichtakt der Quelle ist zu groß. Für grün musst du auch die Quelle entschärfen (Prüfstand Störquelle).', params: P_GUT }
  ];
  const PRESETS = PRESET_LIST.map(p => Object.assign({}, p, { controls: p.params }));

  // =====================================================================================================================
  //  Die Anlage
  // =====================================================================================================================
  function plant(P0) {
    const CORE = P0.CORE, K = B.kit(CORE);
    const uvOf = v => (CORE.db && typeof CORE.db.uv === 'function' ? CORE.db.uv(v) : NaN);
    const fltOf = c => ({ topo: c.topo, cx: c.cx, cy: c.cy, drossel: c.drossel, ld: c.ld, lead: c.lead, ferrit: !!c.ferrit, iLast: c.iLast });
    const srcDefaults = () => { const d = CORE.source && CORE.source.defaults ? CORE.source.defaults : {}; const o = Object.assign({}, d); o.snub = Object.assign({}, d.snub || {}); return o; };
    const memo = { before: null };
    // Frequenzliste fuer Kurven: 10 kHz ... 100 MHz (logarithmisch) plus die Messmarken
    const FGRID = (function () { const a = []; for (let i = 0; i <= 120; i++) a.push(1e4 * Math.pow(1e4, i / 120)); return a; })();
    function emptyFilter(f) {                                       // kein Querzweig, kein Reihenelement, kein Ferrit
      const sh = f.topo !== 'kein' && (f.cx > 0 || f.cy > 0), ser = f.topo !== 'C' && (f.drossel !== 'ohne' || f.ld > 0);
      return !sh && !ser && !f.ferrit;
    }
    function fgCross(flt, mode) {                                  // erste Frequenz, bei der die Daempfung 3 dB erreicht (Suche 10 Hz ... 1 GHz)
      const f0 = 10, f1 = 1e9, N = 240; let prev = null;
      for (let i = 0; i <= N; i++) {
        const f = f0 * Math.pow(f1 / f0, i / N), il = K.il(flt, f)[mode];
        if (isNum(il) && il >= 3) {
          if (!prev) return f;
          let a = prev, b = f;
          for (let k = 0; k < 40; k++) { const m = Math.sqrt(a * b), v = K.il(flt, m)[mode]; if (v >= 3) b = m; else a = m; }
          return Math.sqrt(a * b);
        }
        prev = f;
      }
      return NaN;
    }

    function compute(c) {
      const flt = fltOf(c), src = srcDefaults();
      const kl = c.klasse === 'A' ? 'A' : 'B';
      const key = kl + '|' + JSON.stringify(src);
      if (!memo.before || memo.before.key !== key) { const L0 = K.lisn(src, null, kl, F_LIM_MAX); memo.before = { key, L0 }; }
      const L0 = memo.before.L0;
      if (!L0.ok) return { ok: false, why: L0.why };
      const L1 = K.lisn(src, emptyFilter(flt) ? null : flt, kl, F_LIM_MAX);          // ohne wirksames Element: exakt die Linien der Quelle
      if (!L1.ok) return { ok: false, why: L1.why };
      const ass = K.assessConducted(L1.lines, kl);
      let lMax = -Infinity, fAtMax = NaN;
      L1.lines.forEach(l => { if (l.f >= F_LIM_MIN && l.f <= F_LIM_MAX && l.L > lMax) { lMax = l.L; fAtMax = l.f; } });
      if (!isNum(lMax)) { lMax = 0; }
      const hasCx = c.topo !== 'kein' && c.cx > 0, hasCy = c.topo !== 'kein' && c.cy > 0, hasDr = c.topo !== 'C' && c.drossel !== 'ohne';
      const fresX = hasCx ? K.fresCap(c.cx, c.lead, 'cx') : null, fresD = hasDr ? K.fresDr(c.drossel) : null;
      const fl = FGRID.concat([F_LIM_MIN, 1e6, 3e7], fresX ? [fresX.f] : [], fresD ? [fresD.f] : []).filter(f => f >= 1e4 && f <= 1e8).sort((a, b) => a - b).filter((f, i, a) => i === 0 || f > a[i - 1] * (1 + 1e-9));
      const empty = emptyFilter(flt);                                // ohne wirksames Element: Daempfung genau 0 dB (der Kern liefert dort durch den Durchkopplungsrest -0,0009 dB)
      const curve = empty ? { f: fl, gg: fl.map(() => 0), gt: fl.map(() => 0) } : K.curve(flt, fl);
      const il1 = empty ? { gg: 0, gt: 0 } : K.il(flt, 1e6), il150 = empty ? { gg: 0, gt: 0 } : K.il(flt, F_LIM_MIN);
      const sat = hasDr ? K.satur(flt) : { pct: 100, Isat: NaN };
      const leakA = hasCy ? K.leak(c.cy) : 0;
      // Eigenresonanz des X-Kondensators: Wirkung kurzer Anschluesse bei der kritischen Frequenz (fuer die Meldung cap-ind)
      const avOf = f => K.limitAt('leit-' + kl + '-AV', f);
      const worstAbove = (f0, key) => {                         // Linie oberhalb f0 mit der kleinsten Marge zur Mittelwert-Linie des Anteils key (nur wenn nicht eingehalten: Marge < 6 dB)
        let b = null;
        L1.lines.forEach(l => { const av = avOf(l.f), v = isNum(l[key]) ? l[key] : l.L; if (av === null || l.f <= f0 || l.f > F_LIM_MAX) return; const m = av - v; if (m < 6 && (!b || m < b.m)) b = { f: l.f, m }; });
        return b;
      };
      let capInd = null;
      if (fresX) {                                                // Gegentakt-Anteil: dort wirkt der X-Kondensator
        const w = worstAbove(fresX.f, 'Ldm');
        if (w) { const ilNow = K.il(flt, w.f).gg, ilShort = K.il(Object.assign({}, flt, { lead: 0 }), w.f).gg; if (isNum(ilNow) && isNum(ilShort) && ilShort - ilNow >= 3) capInd = { f: w.f, now: ilNow, short: ilShort }; }
      }
      const drKap = fresD ? worstAbove(fresD.f, 'Lcm') : null;    // Gleichtakt-Anteil: dort wirkt die Drossel
      return { ok: true, c: Object.assign({}, c), flt, src, kl, L0, L1, lines: L1.lines, before: L0.lines, ass, lMax, fAtMax, hasCx, hasCy, hasDr, fresX, fresD, curve, il1, il150, sat, leakA, capInd, drKap,
        fg: { gg: fgCross(flt, 'gg'), gt: fgCross(flt, 'gt') } };
    }

    function meters(res) {
      if (!res.ok) return { ilGG1M: 0, ilGT1M: 0, fgGG: 0, fgGT: 0, leak: 0, fresX: 0, fresD: 0, satur: 100, lMax: 0, margin: 0 };
      return { ilGG1M: res.il1.gg, ilGT1M: res.il1.gt, fgGG: isNum(res.fg.gg) ? res.fg.gg / 1e3 : 0, fgGT: isNum(res.fg.gt) ? res.fg.gt / 1e3 : 0, leak: res.leakA * 1e3,
        fresX: res.fresX ? res.fresX.f / 1e6 : 0, fresD: res.fresD ? res.fresD.f / 1e3 : 0, satur: res.sat.pct, lMax: res.lMax, margin: isNum(res.ass.margin) ? res.ass.margin : 0 };
    }

    function leakRow(res, c) {
      const mA = res.leakA * 1e3, req = c.leakReq, over = mA > req + 1e-12;
      return { id: 'leak', ampel: over ? 'rot' : 'gruen', text: 'Ableitstrom ' + fm(mA, 3) + ' mA bei 230 V und 50 Hz (ein Y-Kondensator), Vorgabe der Übung ' + fm(req, 2) + ' mA' + (over ? ': über der Vorgabe.' : '.') };
    }
    function assess(res, c) {
      if (!res.ok) return { ok: false, ampel: 'grau', text: res.why, rows: [] };
      const a = res.ass;
      return { ok: a.ok, ampel: a.ampel, text: a.text || 'Für diese Frequenzen gibt es in der Übungsgrenzlinie keinen Grenzwert.', margin: a.margin, freq: a.freq, rows: [leakRow(res, c)] };
    }

    function diag(res, c) {
      if (!res.ok) return [{ id: 'filter-fehler', kind: 'error', text: res.why }];
      const out = [];
      if (res.capInd) {
        out.push({ id: 'cap-ind', kind: 'warn', text: 'Der X-Kondensator ist oberhalb von ' + eng(res.fresX.f, 'Hz') + ' eine Induktivität (Anschlussinduktivität ' + eng(res.fresX.esl, 'H') + '). Bei ' + eng(res.capInd.f, 'Hz') + ' dämpft das Filter im Gegentakt ' + fm(res.capInd.now, 1) + ' dB; mit Anschlusslänge 0 mm wären es ' + fm(res.capInd.short, 1) + ' dB. Kürze die Anschlüsse.' });
      }
      if (res.fresD && res.drKap) {
        out.push({ id: 'dr-kap', kind: 'warn', text: 'Die Drossel ist oberhalb von ' + eng(res.fresD.f, 'Hz') + ' kapazitiv (Windungskapazität ' + eng(res.fresD.Cw, 'F') + '): Die Impedanz der Drossel sinkt dort wieder, hohe Frequenzen sperrt sie schlechter. Eine Linie im Gleichtakt bei ' + eng(res.drKap.f, 'Hz') + ' liegt oberhalb der Resonanz und hält die Mittelwert-Linie nicht mit 6 dB Abstand ein.' });
      }
      if (res.fresD && isNum(res.fresD.Isat) && c.iLast > 0.5 * res.fresD.Isat) {
        out.push({ id: 'sat', kind: 'warn', text: 'Der Laststrom ' + fn(c.iLast, 2) + ' A sättigt die Drossel (Isat ' + fn(res.fresD.Isat, 2) + ' A): Die Induktivität sinkt auf ' + fm(res.sat.pct, 0) + ' %.' });
      }
      if (res.hasCy) {
        const mA = res.leakA * 1e3, over = mA > c.leakReq + 1e-12;
        out.push({ id: 'y-strom', kind: over ? 'warn' : 'info', text: 'Ableitstrom ' + fm(mA, 3) + ' mA bei 230 V und 50 Hz' + (over ? ', über der Vorgabe der Übung (' + fm(c.leakReq, 2) + ' mA).' : ' (Vorgabe der Übung ' + fm(c.leakReq, 2) + ' mA).') });
      }
      return out;
    }

    // ---- Kurven und Spektrum ----
    function reduce(lines, key, nb) {                       // hoechstens nb Punkte: Maximum je logarithmischem Fach
      const a = Math.log10(F_LIM_MIN), b = Math.log10(F_LIM_MAX), best = new Array(nb).fill(null);
      lines.forEach(l => { if (l.f < F_LIM_MIN || l.f > F_LIM_MAX) return; const i = Math.min(nb - 1, Math.floor((Math.log10(l.f) - a) / (b - a) * nb)); const v = Math.max(FLOOR, isNum(l[key]) ? l[key] : l.L); if (!best[i] || v > best[i][1]) best[i] = [l.f, v]; });
      return best.filter(Boolean);
    }
    function curves(res, c) {
      if (!res.ok) return [];
      const cu = res.curve, gg = [], gt = [];
      cu.f.forEach((f, i) => { if (isNum(cu.gg[i]) && isNum(cu.gt[i])) { gg.push([f, cu.gg[i]]); gt.push([f, cu.gt[i]]); } });
      const mk = [{ x: F_LIM_MIN, y: res.il150.gg, text: '150 kHz: GG ' + fm(res.il150.gg, 1) + ' dB' }, { x: 1e6, y: res.il1.gt, text: '1 MHz: GT ' + fm(res.il1.gt, 1) + ' dB' }];
      if (res.fresX) mk.push({ x: res.fresX.f, y: K.il(res.flt, res.fresX.f).gg, text: 'Cx-Resonanz ' + eng(res.fresX.f, 'Hz') });
      if (res.fresD) mk.push({ x: res.fresD.f, y: K.il(res.flt, res.fresD.f).gt, text: 'Drossel-Resonanz ' + eng(res.fresD.f, 'Hz') });
      const il = { id: 'il', title: 'Einfügungsdämpfung im 50-Ω-System (Übungsfilter)', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Einfügungsdämpfung', yUnit: 'dB',
        series: [{ name: 'Gegentakt (GG)', points: gg }, { name: 'Gleichtakt (GT)', points: gt }], marker: mk[1], markers: mk };
      const lim = K.limitPts('leit-' + res.kl + '-AV');
      const pg = { id: 'pegel', title: 'Pegel vor und nach dem Filter', xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV',
        series: [{ name: 'ohne Filter', points: reduce(res.before, 'L', 90) }, { name: 'mit Filter', points: reduce(res.lines, 'L', 90) }].concat(lim ? [{ name: 'Grenzlinie Mittelwert (Übung)', points: lim }] : []),
        marker: isNum(res.ass.freq) ? { x: res.ass.freq, y: (res.lines.find(l => l.f === res.ass.freq) || {}).L, text: 'kritisch ' + eng(res.ass.freq, 'Hz') } : undefined };
      return [il, pg];
    }
    function spectrum(res, c, o) {
      if (!res.ok) return null;
      const view = o && (o.view === 'gt' || o.view === 'gg') ? o.view : 'sum';
      const key = view === 'gt' ? 'Lcm' : view === 'gg' ? 'Ldm' : 'L';
      const map = l => ({ f: l.f, L: Math.max(FLOOR, isNum(l[key]) ? l[key] : l.L), Lcm: Math.max(FLOOR, isNum(l.Lcm) ? l.Lcm : l.L), Ldm: Math.max(FLOOR, isNum(l.Ldm) ? l.Ldm : l.L) });
      const ids = ['leit-' + res.kl + '-QP', 'leit-' + res.kl + '-AV'];
      const limits = ids.map((id, i) => ({ id, name: i ? 'Übungsgrenzlinie Mittelwert (A)' : 'Übungsgrenzlinie Quasi-Spitzenwert (A)', pts: K.limitPts(id) })).filter(q => q.pts);
      return { unit: 'dBµV', fMin: F_LIM_MIN, fMax: F_LIM_MAX, lines: res.lines.filter(l => l.f >= F_LIM_MIN).map(map), before: res.before.filter(l => l.f >= F_LIM_MIN).map(map), limits, floor: -60, view };
    }

    // =================================================================================================================
    //  Zeichnen
    // =================================================================================================================
    function schematic(ctx, rc, v, sc) {
      const pal = sc.pal, c = v.ctl, res = v.res, fs = sc.fs;
      const X = f => rc.x + f * rc.w, Y = f => rc.y + f * rc.h;
      gfx.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 8);
      ctx.save(); ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
      const colQ = pal.quelle, colG = pal.masse, colS = pal.senke, colP = pal.pfad, colF = pal.fg;
      const narrow = rc.w < 480;
      const yL = Y(narrow ? 0.25 : 0.27), yN = Y(narrow ? 0.43 : 0.50), yP = Y(narrow ? 0.61 : 0.74), x0 = X(0.14), x1 = X(0.86);
      const topo = c.topo, hasSh = topo !== 'kein', hasSer = topo !== 'C', hasSh2 = topo === 'pi';
      // Quelle und Netznachbildung
      gfx.panel(ctx, X(0.02), Y(0.16), X(0.12), Y(0.62) - Y(0.16), pal.panel2, colQ, 6);
      gfx.text(ctx, 'Gerät', X(0.08), Y(0.16) + fs + 4, { size: fs, bold: true, color: colQ, align: 'center', max: X(0.12) - 4 });
      gfx.text(ctx, 'Netzteil', X(0.08), Y(0.16) + 2 * fs + 6, { size: fs, color: pal.mute, align: 'center', max: X(0.12) - 4 });
      gfx.panel(ctx, X(0.86), Y(0.16), X(0.12), Y(0.62) - Y(0.16), pal.panel2, colS, 6);
      gfx.text(ctx, 'LISN', X(0.92), Y(0.16) + fs + 4, { size: fs, bold: true, color: colS, align: 'center', max: X(0.12) - 4 });
      gfx.text(ctx, '50 Ω', X(0.92), Y(0.16) + 2 * fs + 6, { size: fs, color: pal.mute, align: 'center', max: X(0.12) - 4 });
      // Leitungen L, N und Schutzleiter
      gfx.line(ctx, [[x0, yL], [x1, yL]], colF, 2); gfx.line(ctx, [[x0, yN], [x1, yN]], colF, 2);
      gfx.line(ctx, [[X(0.03), yP], [X(0.97), yP]], colG, 2.5);
      gfx.text(ctx, 'Schutzleiter (PE)', X(0.03), yP + fs + 1, { size: fs, color: colG, max: 0.3 * rc.w });
      gfx.text(ctx, 'L', x0 + 4, yL - 5, { size: fs, color: pal.mute }); gfx.text(ctx, 'N', x0 + 4, yN - 5, { size: fs, color: pal.mute });
      // Bauteilstufen
      const xa = X(0.22), xs0 = X(0.40), xs1 = X(0.54), xc = X(0.62), xf = X(0.77);
      const stage = (x, on) => {
        const a = on ? 1 : 0.35, dash = !on;
        ctx.globalAlpha = a; if (dash) ctx.setLineDash([3, 3]);
        gfx.capV(ctx, x, yL, yN, colP, 11);                                         // X-Kondensator zwischen den Leitern
        gfx.capV(ctx, x + X(0.045) - X(0), yL, yP, colP, 8); gfx.capV(ctx, x + X(0.08) - X(0), yN, yP, colP, 8);    // Y-Kondensatoren gegen PE
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        sc.hit('cx', x - 14, yL, 28, yN - yL); sc.hit('cy', x + X(0.045) - X(0) - 12, yL + (yN - yL) * 0.5, 24 + X(0.035) - X(0), yP - yL - (yN - yL) * 0.5);
      };
      stage(xa, hasSh); stage(xc, hasSh2);
      // Gleichtaktdrossel (zwei Wicklungen auf einem Kern)
      const dr = hasSer && c.drossel !== 'ohne';
      ctx.globalAlpha = dr ? 1 : 0.35; if (!dr) ctx.setLineDash([3, 3]);
      gfx.sym.coil(ctx, xs0, yL, xs1 - xs0, colP, 4); gfx.sym.coil(ctx, xs0, yN, xs1 - xs0, colP, 4);
      gfx.line(ctx, [[xs0 + 6, (yL + yN) / 2 - 2], [xs1 - 6, (yL + yN) / 2 - 2]], colP, 2); gfx.line(ctx, [[xs0 + 6, (yL + yN) / 2 + 2], [xs1 - 6, (yL + yN) / 2 + 2]], colP, 2);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      sc.hit('drossel', xs0 - 4, yL - 14, xs1 - xs0 + 8, yN - yL + 28);
      // Ferrit am Netzkabel
      const feW = 14;
      if (c.ferrit) gfx.panel(ctx, xf - feW / 2, yL - 9, feW, yN - yL + 18, pal.panel2, pal.fg, 3); else { ctx.setLineDash([3, 3]); gfx.panel(ctx, xf - feW / 2, yL - 9, feW, yN - yL + 18, null, pal.mute, 3); ctx.setLineDash([]); }
      sc.hit('ferrit', xf - 16, yL - 12, 32, yN - yL + 24);
      // Teilchen: Gegentakt (L hin, N zurueck) und Gleichtakt (L und N hin, Rueckweg ueber PE); Dichte nach der Daempfung bei 1 MHz
      if (!sc.ghost) {
        const xSplit = hasSh ? xa : (hasSer ? xs0 : x0 + (x1 - x0) / 2);
        const rGGpost = clamp(Math.pow(10, -res.il1.gg / 40), 0.04, 1), rGTpost = clamp(Math.pow(10, -res.il1.gt / 40), 0.04, 1);
        const seg = (xa0, xb0, rGG, rGT, tag) => [
          { pts: [[xa0, yL - 3], [xb0, yL - 3]], rate: rGG, color: colQ, size: 3 }, { pts: [[xa0, yN + 3], [xb0, yN + 3]], rate: rGG, color: colQ, size: 3, dir: -1 },
          { pts: [[xa0, yL + 3], [xb0, yL + 3]], rate: rGT, color: colG, size: 3 }, { pts: [[xa0, yN - 3], [xb0, yN - 3]], rate: rGT, color: colG, size: 3 },
          { pts: [[xa0, yP - 3], [xb0, yP - 3]], rate: rGT, color: colG, size: 3, dir: -1 }];
        const paths = seg(x0, xSplit, 1, 1).concat(seg(xSplit, x1, rGGpost, rGTpost));
        const ps = sc.ps('filter-sch', paths, { speed: 85 });
        ps.draw(ctx, { glow: sc.qp.glow, reduced: sc.reduced });
        gfx.text(ctx, narrow ? 'Dämpfung bei 1 MHz: GG ' + fm(res.il1.gg, 1) + ' · GT ' + fm(res.il1.gt, 1) + ' dB' : 'Teilchendichte nach der Dämpfung bei 1 MHz: GG ' + fm(res.il1.gg, 1) + ' dB · GT ' + fm(res.il1.gt, 1) + ' dB', X(0.5), Y(0.10) + 4, { size: fs, color: pal.mute, align: 'center', max: rc.w * 0.8 });
      }
      // Beschriftung der Werte (Zahlen stehen im Bild); schmal in drei Zeilen
      const r1 = Y(narrow ? 0.75 : 0.865), r2 = Y(narrow ? 0.85 : 0.955), r3 = Y(0.955);
      const dtxt = c.drossel === 'ohne' || topo === 'C' ? 'Drossel ohne' : 'Drossel ' + eng((res.fresD || {}).L, 'H') + ', ' + fm(res.sat.pct, 0) + ' % Induktivität';
      const qtxt = hasSh ? 'Cx ' + (c.cx > 0 ? eng(c.cx, 'F') : 'ohne') + ' · Cy ' + (c.cy > 0 ? '2×' + eng(c.cy, 'F') : 'ohne') + ' · Anschlüsse ' + fn(c.lead * 1e3, 0) + ' mm' : 'Querzweige: keine';
      const xtxt = dtxt + (hasSer && c.ld > 0 ? ' · Ld ' + eng(c.ld, 'H') : '') + (c.ferrit ? ' · Ferrit ein' : '');
      if (narrow) { gfx.text(ctx, qtxt, X(0.03), r1, { size: fs, color: pal.fg, max: rc.w * 0.95 }); gfx.text(ctx, xtxt, X(0.03), r2, { size: fs, color: pal.fg, max: rc.w * 0.95 }); }
      else gfx.text(ctx, qtxt + ' · ' + xtxt, X(0.03), r1, { size: fs, color: pal.fg, max: rc.w * 0.95 });
      // Ableitstrom: Balken mit Marke der Vorgabe, Symbol und Zahl
      const ly2 = narrow ? r3 : r2;
      const mA = res.leakA * 1e3, req = c.leakReq, over = mA > req + 1e-12, full = Math.max(req * 1.6, mA * 1.05, 0.1), bx = X(0.03), bw = Math.min(0.30 * rc.w, 200), by = ly2 - 9;
      const lab = (over ? '✗ ' : '✓ ') + (narrow ? 'Ableit' : 'Ableitstrom') + ' ' + fm(mA, 3) + ' mA';
      const lw = gfx.text(ctx, lab, bx, ly2, { size: fs, bold: true, color: over ? pal.rot : pal.gruen, max: rc.w * 0.5 });
      const bx2 = bx + lw + 10;
      ctx.fillStyle = pal.grid; ctx.fillRect(bx2, by, bw, 9);
      ctx.fillStyle = over ? pal.rot : pal.gruen; ctx.fillRect(bx2, by, bw * clamp(mA / full, 0, 1), 9);
      gfx.line(ctx, [[bx2 + bw * req / full, by - 3], [bx2 + bw * req / full, by + 12]], pal.fg, 2);
      gfx.text(ctx, narrow ? 'Vorgabe ' + fm(req, 2) + ' mA' : 'Vorgabe der Übung ' + fm(req, 2) + ' mA', bx2 + bw + 8, ly2, { size: fs, color: pal.mute, max: Math.max(30, rc.x + rc.w - (bx2 + bw + 8) - 6) });
      ctx.restore();
    }

    function ilPanel(ctx, rc, v, sc) {
      const pal = sc.pal, res = v.res, cu = curves(res, v.ctl);
      if (!cu.length) return;
      const cv = cu[0];
      gfx.curveChart(ctx, rc.x, rc.y, rc.w, rc.h, cv, { pal, colors: [pal.quelle, pal.masse], markers: rc.w < 480 ? cv.markers.slice(0, 2) : cv.markers, size: sc.fs, yMin: 0, yMax: 80 });
    }

    function spectrumPanel(ctx, rc, v, sc) {
      const pal = sc.pal, res = v.res, c = v.ctl, fs = sc.fs, spc = spectrum(res, c, { view: 'sum' });
      if (!spc) return;
      const kl = res.kl, qpF = f => K.limitAt('leit-' + kl + '-QP', f), avF = f => K.limitAt('leit-' + kl + '-AV', f);
      const top = Math.max(res.lMax, spc.before.reduce((m, l) => Math.max(m, l.L), -1e9)), yMax = Math.max(120, Math.ceil((top + 10) / 20) * 20);
      const yMin = 0;                                                    // feste untere Achse: Vorher und Nachher teilen den Massstab
      const worst = isNum(res.ass.freq) ? res.lines.reduce((b, l) => (!b || Math.abs(Math.log(l.f / res.ass.freq)) < Math.abs(Math.log(b.f / res.ass.freq)) ? l : b), null) : null;
      const mk = worst ? { f: worst.f, L: worst.L, text: eng(worst.f, 'Hz') + ' · ' + fm(worst.L, 1) + ' dBµV' + (isNum(res.ass.margin) && rc.w >= 480 ? ' · Marge ' + fm(res.ass.margin, 1) + ' dB' : '') } : null;
      const d = { lines: spc.lines, before: spc.before, key: v.st.version + '|' + c.klasse, lim: spc.limits.map((q, i) => ({ name: q.name.replace('Übungsgrenzlinie ', ''), pts: q.pts, dash: i ? [3, 3] : [8, 4] })), fMin: spc.fMin, fMax: spc.fMax, yMin, yMax,
        marker: mk, unit: 'dBµV', avLim: avF, qpLim: qpF,
        legend: [{ label: '✓ ≥ 6 dB', color: pal.gruen }, { label: '! < 6 dB', color: pal.gelb }, { label: '! über AV', color: '#ff9a3d' }, { label: '✗ über QP', color: pal.rot }, { label: 'ohne Filter (Kontur)', color: pal.mute, dash: [2, 3] }, { label: 'Grenzlinie (Übung)', color: pal.grenz, dash: [8, 4] }] };
      gfx.spectrumBars(ctx, rc.x, rc.y, rc.w, rc.h, d, { pal, tw: sc.tw.spec || (sc.tw.spec = {}), t: sc.t, reduced: sc.reduced, size: fs });
    }

    function draw(ctx, w, h, t, v, sc) {
      const pal = sc.pal, res = v.res, a = v.ampel, fs = sc.fs;
      if (w < 200 || h < 150) { gfx.text(ctx, 'Netzfilter-Prüfstand', 8, 18, { size: 12, color: pal.fg }); return; }
      const pad = 8, hh = sc.header === false ? 0 : 30;                  // header: false lässt die Ampelzeile weg (die Seite zeigt sie selbst)
      if (!res.ok) {
        if (hh) gfx.ampelRow(ctx, pad, pad + 14, { ampel: 'grau', text: 'Kein Prüfergebnis' }, { pal, size: fs + 1, max: w - 2 * pad });
        gfx.panel(ctx, pad, hh + pad, w - 2 * pad, Math.min(120, h - hh - 2 * pad), pal.panel, pal.rot, 8);
        gfx.text(ctx, res.why || 'Das Filter ist mit diesen Werten nicht berechenbar.', pad + 12, hh + pad + 30, { size: fs + 1, color: pal.fg, max: w - 2 * pad - 24 });
        return;
      }
      const head = isNum(a.margin) ? 'Marge ' + fm(a.margin, 1) + ' dB zur Mittelwert-Linie bei ' + eng(a.freq, 'Hz') : a.text;
      if (hh) gfx.ampelRow(ctx, pad, pad + 14, { ampel: a.ampel, text: head }, { pal, size: fs + 1, max: w >= 700 ? w * 0.62 : w - 2 * pad });
      if (hh && w >= 700) {
        const over = res.leakA * 1e3 > v.ctl.leakReq + 1e-12;
        gfx.text(ctx, (over ? '✗ ' : '✓ ') + 'Ableitstrom ' + fm(res.leakA * 1e3, 3) + ' mA', w - pad, pad + 18, { size: fs, bold: true, color: over ? pal.rot : pal.gruen, align: 'right', max: w * 0.3 });
      }
      const top = hh + pad, avail = h - top - pad, wide = w >= h * 1.15 && w >= 640;
      let rS, rI = null, rP;
      if (wide || (w >= 430 && avail < 540)) {                          // unten nebeneinander: Dämpfungskurve und Spektrum
        const hs = Math.round(avail * (wide ? 0.42 : 0.44)), hw = Math.round((w - 3 * pad) / 2);
        rS = { x: pad, y: top, w: w - 2 * pad, h: hs }; rI = { x: pad, y: top + hs + pad, w: hw, h: avail - hs - pad }; rP = { x: 2 * pad + hw, y: top + hs + pad, w: w - 3 * pad - hw, h: avail - hs - pad };
      } else {                                                           // übereinander; ist die Höhe zu klein, entfällt die Dämpfungskurve (das Spektrum bleibt)
        const hs = Math.round(avail * 0.36), hi = Math.round(avail * 0.31), hp = avail - hs - hi - 2 * pad;
        if (hp >= 130) { rS = { x: pad, y: top, w: w - 2 * pad, h: hs }; rI = { x: pad, y: top + hs + pad, w: w - 2 * pad, h: hi }; rP = { x: pad, y: top + hs + hi + 2 * pad, w: w - 2 * pad, h: hp }; }
        else { const hs2 = Math.round(avail * 0.46); rS = { x: pad, y: top, w: w - 2 * pad, h: hs2 }; rP = { x: pad, y: top + hs2 + pad, w: w - 2 * pad, h: avail - hs2 - pad }; }
      }
      schematic(ctx, rS, v, sc);
      if (rI) ilPanel(ctx, rI, v, sc);
      spectrumPanel(ctx, rP, v, sc);
      if (!sc.reduced) gfx.text(ctx, 'Animation verlangsamt', w - pad, h - 3, { size: fs, color: pal.mute, align: 'right' });
    }

    return { compute, meters, assess, diag, curves, spectrum, draw, phaseHz: () => 1.2 };
  }

  const SPEC = {
    id: 'filter', name: 'Netzfilter-Prüfstand', icon: '🎚️',
    info: 'Netzfilter aus X-, Y-Kondensator, Gleichtaktdrossel, Differenzdrossel und Ferrit zwischen der Störquelle und der Netznachbildung. Echte Bauteile: Eigenresonanzen, Sättigung und Ableitstrom. Alle Zahlen sind Übungswerte.',
    world: { w: 960, h: 600 },
    chain: { quelle: 'Gerät (Netzteil) mit Gleichtakt- und Gegentaktstörung', pfad: 'Netzfilter und Netzleitung', senke: 'Netznachbildung (LISN) beziehungsweise andere Geräte am Netz', art: 'leitungsgebunden', kopplung: ['galvanisch'] },
    controls: CONTROLS, noLever: ['klasse', 'leakReq'], meters: METERS, presets: PRESETS, params: { leakNenn: 230, leakF: 50 },
    plant: plant
  };
  R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, chain: SPEC.chain, create: opts => B.makeRig(SPEC, opts) });
})(typeof window !== 'undefined' ? window : globalThis);
