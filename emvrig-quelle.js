/* emvrig-quelle.js - EMV-Lab, Pruefstand `quelle` (Stoerquelle Schalter / Schaltnetzteil, SPEC 5.2), Paket WP2a.
 *
 * Die Uebungsquelle "Sperrwandler 325 V": Das Spektrum der Gleichtakt- und Gegentaktstoerung an der Netznachbildung (LISN) OHNE Filter gegen die
 * Uebungsgrenzlinien. Alles Rechnen kommt aus EMV_CORE (source.flyback, chain.lisn, spec.envelope, limits, assess.conducted) ueber den Adapter
 * EMV_RIGS.base.kit; dieser Pruefstand zeichnet, bewertet und meldet nur. Uebungsanlage: alle Zahlen sind Uebungswerte, keine Vorhersage echter Geraete.
 * Herstellerdokumentation und aktuelle Norm massgeblich.
 *
 * Laden: im Browser NACH emvcore.js, (emvcore-lay.js, emvdraw.js) und emvrig-base.js; in Node holt sich die Datei die Basis per require.
 * Fehlt die Basis, meldet die Datei console.warn und registriert nichts.
 *
 * Steuerwerte (SI, siehe emvrig-base.js): u V, fs Hz, duty %, rg Ohm, cp F, isw A, idm A, snub 'aus'|'ein', rsn Ohm, csn F, ferrit Schalter, jitter %, band '30M'|'300M'.
 * Zusatzfunktionen am Rig: spectrum({view:'sum'|'gt'|'gg'}), waveform({view:'flanke'|'perioden'}), curves() (Einhuellende, Schaltspannung).
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
    if (typeof console !== 'undefined') console.warn('emvrig-quelle.js: emvrig-base.js fehlt - Prüfstand quelle nicht registriert.');
    if (typeof module !== 'undefined') module.exports = R;
    return;
  }
  if (typeof module !== 'undefined') module.exports = R;
  if (R.defs.quelle) return;

  const { clamp, num, fm, fn, eng, isNum, okv, gfx, LEVERS } = B;
  const G = { quelle: LEVERS.quelle.name, pfad: LEVERS.pfad.name, senke: LEVERS.senke.name, anz: 'Anzeige und Vorgaben' };
  const BAND = { '30M': 3e7, '300M': 3e8 };
  const F_LIMIT_MAX = 3e7;            // obere Grenze der leitungsgebundenen Uebungsgrenzlinie
  const F_LIMIT_MIN = 1.5e5;

  // =====================================================================================================================
  //  Steuerwerte, Messgeraete, Voreinstellungen
  // =====================================================================================================================
  const sl = (key, label, min, max, value, unit, unitKind, scale, lever, help, more) => Object.assign({ key, label, type: 'slider', min, max, step: scale === 'log' ? 0.01 : 1, scale, unit, unitKind, value, group: G[lever || 'anz'], lever: lever || null, help }, more || {});
  const CONTROLS = [
    sl('u', 'Schaltspannung u', 5, 400, 325, 'V', 'volt', 'log', 'quelle', 'Spitzenwert der Spannung am Schaltknoten. Die Spannung bestimmt die Amplitude des Trapezsignals und damit den Gleichtaktpegel (ohne Ringing): Halbe Spannung gibt 6 dB weniger. Der Gegentaktpegel hängt am Welligkeitsstrom.'),
    sl('fs', 'Schaltfrequenz fs', 1e4, 2e6, 1e5, 'Hz', 'freq', 'log', 'quelle', 'Grundfrequenz des Trapezes. Die Linien des Spektrums liegen bei ganzzahligen Vielfachen von fs. Bei gleicher Frequenz steht eine höhere Schaltfrequenz höher im Spektrum (die Amplitude je Linie wächst mit fs).'),
    sl('duty', 'Tastverhältnis D', 5, 95, 50, '%', 'pct', 'lin', 'quelle', 'Verhältnis von Impulsbreite zu Periode (D = τ/T). Bei genau 50 % fehlen die geraden Oberwellen (bei gleicher Anstiegs- und Abfallzeit); bei jedem anderen Wert gibt es alle Linien.', { step: 0.5 }),
    sl('rg', 'Gate-Widerstand Rg', 1, 330, 10, 'Ω', 'res', 'log', 'quelle', 'Der Gate-Widerstand lädt die Miller-Kapazität und bestimmt die Flankensteilheit: dU/dt = (Ugate − Uplateau)/(Rg·Cgd). Ein größerer Rg macht die Flanke langsamer und senkt die Oberwellen oberhalb des Knicks f2 = 1/(π·tr). Das kostet Schaltverlust.'),
    sl('cp', 'Parasitäre Kapazität cp', 1e-12, 200e-12, 20e-12, 'F', 'cap', 'log', 'pfad', 'Kapazität zwischen Schaltknoten und Gehäuse (zum Beispiel über den Kühlkörper). Über sie fließt der Gleichtaktstrom I = ω·cp·U zum Gehäuse und durch die Netznachbildung zurück. Eine kleinere Kapazität verringert den Gleichtaktpegel.'),
    sl('isw', 'Schaltstrom isw', 0.05, 5, 0.5, 'A', 'amp', 'log', 'quelle', 'Strom, der beim Ausschalten in der Streuinduktivität steht. Er treibt das Ringing (Amplitude Ur = Isw·Z0) und die Schaltverluste.'),
    sl('idm', 'Welligkeitsstrom idm', 1e-3, 1, 0.02, 'A', 'amp', 'log', 'quelle', 'Gegentakt-Welligkeitsstrom in der Netzleitung (Spitze, nach dem Zwischenkreiskondensator). Er bestimmt den Gegentaktpegel an der Netznachbildung.'),
    { key: 'snub', label: 'Snubber', type: 'select', value: 'aus', options: [{ value: 'aus', label: 'aus' }, { value: 'ein', label: 'ein' }], group: G.quelle, lever: 'quelle', help: 'Ein RC-Glied parallel zur Ausgangskapazität der Schaltzelle dämpft das Ringing. Es setzt die Leistung Cs·U²·fs in Wärme um.' },
    sl('rsn', 'Snubber-Widerstand Rs', 5, 200, 39, 'Ω', 'res', 'lin', 'quelle', 'Widerstand des Snubbers. Wähle ihn in der Größenordnung der Kennimpedanz Z0 der Schaltzelle; die Meldung nennt den Wert.', { visible: s => s.snub === 'ein' }),
    sl('csn', 'Snubber-Kondensator Cs', 10e-12, 330e-12, 100e-12, 'F', 'cap', 'lin', 'quelle', 'Kapazität des Snubbers. Wähle sie größer als die Ausgangskapazität der Schaltzelle; der Verlust wächst aber mit Cs.', { visible: s => s.snub === 'ein' }),
    { key: 'ferrit', label: 'Ferritperle im Drainzweig', type: 'switch', value: false, group: G.quelle, lever: 'quelle', help: 'Eine Ferritperle bringt bei der Ringfrequenz einen Verlustwiderstand Rf(f) = 100 Ω·√(f/100 MHz) (Übungswert) in den Schwingkreis und dämpft das Ringing ohne Snubber-Verlust.' },
    sl('jitter', 'Frequenzjitter', 0, 10, 0, '%', 'pct', 'lin', 'quelle', 'Die Schaltfrequenz wird um diesen Anteil verwackelt. Die n-te Oberwelle verteilt sich über 2·n·fs·Jitter; ist das mehr als die Auflösebandbreite (9 kHz), sinkt ihre Spitze um 10·lg(Spreizung/Auflösebandbreite). Die Energie bleibt gleich, sie liegt nur breiter verteilt.', { step: 0.5 }),
    { key: 'band', label: 'Anzeigebereich', type: 'select', value: '30M', options: [{ value: '30M', label: '9 kHz bis 30 MHz' }, { value: '300M', label: '9 kHz bis 300 MHz' }], group: G.anz, lever: null, help: 'Bis 30 MHz gilt die leitungsgebundene Übungsgrenzlinie. Die Ringfrequenz der Schaltzelle liegt darüber: Im Bereich bis 300 MHz siehst du den Ring-Buckel, aber es gibt dort keine Grenzlinie.' }
  ];
  const M = (key, label, unit, digits, min, max, o) => Object.assign({ key, label, unit, digits, min, max }, o || {});
  const METERS = [
    M('tr', 'Anstiegszeit tr', 'ns', 1, 0, 400, { help: 'Zeit der Flanke von 0 auf 100 % (Modell), aus Schaltspannung und Flankensteilheit.' }),
    M('dudt', 'Flankensteilheit', 'V/ns', 1, 0, 200, { help: 'dU/dt = (Ugate − Uplateau)/(Rg·Cgd) in der Miller-Phase.' }),
    M('f1', 'Knick f1', 'MHz', 3, 0, 50, { help: 'f1 = 1/(π·τ): Ab hier fällt die Einhüllende der Oberwellen mit 20 dB je Dekade.' }),
    M('f2', 'Knick f2', 'MHz', 2, 0, 500, { help: 'f2 = 1/(π·tr): Ab hier fällt die Einhüllende mit 40 dB je Dekade.' }),
    M('fr', 'Ringfrequenz', 'MHz', 1, 0, 400, { zeroIsNone: true, help: 'Frequenz der Nachschwingung der Schaltzelle; 0 bedeutet: kein Ringing (überdämpft).' }),
    M('zeta', 'Dämpfung ζ', '', 3, 0, 1.2, { help: 'Dämpfungsgrad der Schaltzelle; kleiner als 1 schwingt nach, ab 1 gibt es kein Ringing.' }),
    M('ringBump', 'Ring-Buckel', 'dB', 1, 0, 40, { warnAbove: 3, help: 'Anhebung der Gleichtaktlinien durch das Ringing gegenüber der Einhüllenden (größter Wert).' }),
    M('lMax', 'Pegel max.', 'dBµV', 1, 0, 140, { help: 'Größter Spitzenpegel (Gleichtakt und Gegentakt zusammen) zwischen 150 kHz und 30 MHz.' }),
    M('margin', 'Marge (Mittelwert)', 'dB', 1, -80, 40, { warnBelow: 6, help: 'Kleinster Abstand zur Mittelwert-Linie der Übungsgrenzlinie (Klasse B); positiv ist gut, ab 6 dB grün.' }),
    M('pSw', 'Schaltverlust', 'W', 2, 0, 10, { help: 'Verlust beim Schalten, ½·u·isw·(tr + tf)·fs: Langsame Flanken kosten Wirkungsgrad.' }),
    M('pSn', 'Snubber-Verlust', 'W', 2, 0, 5, { help: 'Leistung im Snubber, Cs·U²·fs.' })
  ];
  const PRESET_LIST = [
    { id: 'netz325', name: 'Netzteil 325 V (Standard)', info: 'Übungsquelle Sperrwandler: 325 V, 100 kHz, 50 %, Rg 10 Ω, ohne Maßnahmen.', params: {} },
    { id: 'tiefsetzer12', name: 'Tiefsetzer 12 V', info: '12 V, 400 kHz, schnelle Flanke (Rg 3,3 Ω) und größerer Schaltstrom.', params: { u: 12, fs: 4e5, rg: 3.3, isw: 2, idm: 0.2, cp: 5e-12 } },
    { id: 'rechteck50', name: 'Rechteck 50 % (Lehrbeispiel)', info: 'Lehrbeispiel ohne Flankenverlangsamung: schnellste Flanke, nur ungerade Oberwellen.', params: { rg: 1, isw: 0.05 } },
    { id: 'gut', name: 'Entschärfte Quelle', info: 'Rg 68 Ω, Snubber und 4 % Jitter: weniger Pegel, aber mehr Verlust.', params: { rg: 68, snub: 'ein', jitter: 4 } },
    { id: 'schlecht', name: 'Schlechte Quelle', info: 'Schnelle Flanke, große Koppelkapazität und großer Schaltstrom.', params: { rg: 2, cp: 100e-12, isw: 2, duty: 30 } }
  ];
  const PRESETS = PRESET_LIST.map(p => Object.assign({}, p, { controls: p.params }));

  const T = {
    uebung: 'Übungsanlage: Alle Zahlen sind Übungswerte, keine Vorhersage echter Geräte.',
    ohneGrenze: 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert.'
  };
  const ordZ = n => fn(n, 0) + '. Oberwelle';

  // =====================================================================================================================
  //  Die Anlage
  // =====================================================================================================================
  function plant(P0) {
    const CORE = P0.CORE, K = B.kit(CORE);
    const srcOf = c => ({ u: c.u, fs: c.fs, duty: c.duty / 100, rg: c.rg, cp: c.cp, isw: c.isw, idm: c.idm, snub: { on: c.snub === 'ein', rs: c.rsn, cs: c.csn }, ferrit: !!c.ferrit, jitter: c.jitter / 100 });
    const uvOf = v => (CORE.db && typeof CORE.db.uv === 'function' ? CORE.db.uv(v) : 20 * Math.log10(v / 1e-6));
    const sumDb = l => (CORE.db && typeof CORE.db.sum === 'function' ? CORE.db.sum(l) : 10 * Math.log10(l.reduce((s, x) => s + Math.pow(10, x / 10), 0)));

    // Einhuellende der GT-, GG- und Summenlinien (aus spec.envelope; Umrechnung wie die Linien: GT 25 Ohm, GG 50 Ohm, Spitze -> Effektwert)
    function envelopes(c, S, fMax) {
      const base = { f0: c.fs, duty: c.duty / 100, tr: S.tr, tf: S.tf };
      const eu = K.envelope(Object.assign({ A: c.u }, base)), ei = K.envelope(Object.assign({ A: c.idm }, base));
      if (!eu || !ei) return null;
      const pts = [];
      const fMin = 9e3;
      for (let i = 0; i <= 90; i++) pts.push(fMin * Math.pow(fMax / fMin, i / 90));
      [eu.f1, eu.f2].forEach(f => { if (isNum(f) && f > fMin && f < fMax) pts.push(f); });
      pts.sort((a, b) => a - b);
      const gt = [], gg = [], sum = [];
      pts.forEach(f => {
        const ug = 2 * Math.PI * f * c.cp * eu.at(f) / Math.SQRT2 * 25, ud = ei.at(f) / Math.SQRT2 * 50;
        const a = uvOf(ug), b = uvOf(ud);
        if (!isNum(a) || !isNum(b)) return;
        gt.push([f, a]); gg.push([f, b]); sum.push([f, sumDb([a, b])]);
      });
      return { gt, gg, sum, eu, ei };
    }

    function compute(c) {
      const fBand = c.band === '300M' ? BAND['300M'] : BAND['30M'];
      const src = srcOf(c);
      const L = K.lisn(src, null, 'B', fBand);
      if (!L.ok) return { ok: false, why: L.why };
      const S = L.S || K.flyback(Object.assign({}, src, { fMax: fBand }));
      if (!S.ok) return { ok: false, why: S.why };
      const ass = K.assessConducted(L.lines, 'B');
      const lines = L.lines;
      const inLim = lines.filter(l => l.f >= F_LIMIT_MIN && l.f <= F_LIMIT_MAX), use = inLim.length ? inLim : lines;
      let lMax = -Infinity, fAtMax = NaN, cmMax = -Infinity, dmMax = -Infinity;
      use.forEach(l => {
        if (l.L > lMax) { lMax = l.L; fAtMax = l.f; }
        const a = isNum(l.Lcm) ? l.Lcm : l.L, b = isNum(l.Ldm) ? l.Ldm : l.L;
        if (a > cmMax) cmMax = a; if (b > dmMax) dmMax = b;
      });
      const bump = isNum(S.ring.bump) ? Math.max(0, S.ring.bump) : 0;
      return { ok: true, c: Object.assign({}, c), src, fBand, S, lines, ass, lMax, fAtMax, cmMax, dmMax, bump, env: envelopes(c, S, fBand), wf: {} };
    }

    function meters(res) {
      if (!res.ok) return { tr: 0, dudt: 0, f1: 0, f2: 0, fr: 0, zeta: 0, ringBump: 0, lMax: 0, margin: 0, pSw: 0, pSn: 0 };
      const S = res.S, rg = S.ring;
      return { tr: S.tr * 1e9, dudt: S.dudt / 1e9, f1: S.f1 / 1e6, f2: S.f2 / 1e6, fr: rg.os > 0 && rg.fr > 0 ? rg.fr / 1e6 : 0, zeta: rg.zeta, ringBump: res.bump,
        lMax: res.lMax, margin: isNum(res.ass.margin) ? res.ass.margin : 0, pSw: S.pSw, pSn: rg.pSnub };
    }

    function assess(res) {
      if (!res.ok) return { ok: false, ampel: 'grau', text: res.why };
      const a = res.ass;
      return { ok: a.ok, ampel: a.ampel, text: a.text || T.ohneGrenze, margin: a.margin, freq: a.freq };
    }

    function diag(res, c) {
      if (!res.ok) return [{ id: 'flanke-lang', kind: 'error', text: res.why }];
      const S = res.S, rg = S.ring, out = [];
      if (S.clamped && S.note) out.push({ id: 'flanke-klemmt', kind: 'warn', text: S.note });
      if (rg.os > 0.2 && rg.fr > 0) {
        const snub = c.snub === 'ein';
        out.push({ id: 'ringing', kind: 'warn', text: 'Die Schaltzelle schwingt bei ' + eng(rg.fr, 'Hz') + ' nach (Überschwingen ' + fm(rg.os * 100, 0) + ' %). ' +
          (snub ? 'Der Snubber dämpft noch nicht genug: Wähle Rs nahe Z0 = ' + eng(rg.Z0, 'Ω') + ' und Cs größer als die Ausgangskapazität.' : 'Dämpfe mit einem Snubber (Rs etwa Z0 = ' + eng(rg.Z0, 'Ω') + ') oder einer Ferritperle.') });
      }
      if (S.tr < 3e-9 && isNum(res.ass.margin) && res.ass.margin < 0) {
        out.push({ id: 'flanke', kind: 'warn', text: 'Die Flanke von ' + eng(S.tr, 's') + ' erzeugt starke Oberwellen bis zum Knick f2 = ' + eng(S.f2, 'Hz') + ' (danach fällt der Pegel mit 40 dB je Dekade). Verlangsame sie mit dem Gate-Widerstand: Das kostet Wirkungsgrad, jetzt ' + fm(S.pSw, 2) + ' W Schaltverlust.' });
      }
      if (c.duty === 50) out.push({ id: 'gerade', kind: 'info', text: 'Bei 50 % Tastverhältnis fehlen die geraden Oberwellen.' });
      if (c.snub === 'ein' && rg.pSnub > 0) out.push({ id: 'snub-verlust', kind: 'info', text: 'Der Snubber setzt ' + fm(rg.pSnub, 2) + ' W in Wärme um (Cs·U²·fs): Das ist zusätzlicher Verlust.' });
      if (res.fBand > F_LIMIT_MAX) out.push({ id: 'limit-frei', kind: 'info', text: 'Oberhalb von 30 MHz: ' + ((CORE.TEXTS && CORE.TEXTS.ohneGrenzwert) || T.ohneGrenze) });
      return out;
    }

    // ---- Kurven ----
    function curves(res) {
      if (!res.ok || !res.env) return [];
      const e = res.env, S = res.S, out = [];
      const mk = (id, title, series, markers) => ({ id, title, xLabel: 'Frequenz', xUnit: 'Hz', xScale: 'log', yLabel: 'Pegel', yUnit: 'dBµV', series, marker: markers[0], markers });
      const top = e.sum.reduce((m, q) => Math.max(m, q[1]), -Infinity);
      out.push(mk('huelle', 'Einhüllende der Störpegel am LISN', [{ name: 'Summe', points: e.sum }, { name: 'Gleichtakt (GT)', points: e.gt }, { name: 'Gegentakt (GG)', points: e.gg }],
        [{ x: S.f1, y: e.eu.at(S.f1) > 0 ? sumAt(e.sum, S.f1) : top, text: 'f1 ' + eng(S.f1, 'Hz') }, { x: S.f2, y: sumAt(e.sum, S.f2), text: 'f2 ' + eng(S.f2, 'Hz') }].filter(m => m.x >= 9e3 && m.x <= res.fBand && isNum(m.y))));
      const vp = e.sum.map(q => [q[0], uvOf(e.eu.at(q[0]) / Math.SQRT2)]).filter(q => isNum(q[1]));
      const vm = [{ x: S.f1, y: uvOf(e.eu.at(S.f1) / Math.SQRT2), text: 'f1 ' + eng(S.f1, 'Hz') }, { x: S.f2, y: uvOf(e.eu.at(S.f2) / Math.SQRT2), text: 'f2 ' + eng(S.f2, 'Hz') }].filter(m => m.x >= 9e3 && m.x <= res.fBand && isNum(m.y));
      out.push(mk('knick', 'Oberwellen-Einhüllende der Schaltspannung (−20 und −40 dB je Dekade)', [{ name: 'Spitzenwert der Oberwellen, als Pegel', points: vp }], vm));
      return out;
    }
    function sumAt(pts, f) { let b = null; pts.forEach(q => { if (!b || Math.abs(Math.log(q[0] / f)) < Math.abs(Math.log(b[0] / f))) b = q; }); return b ? b[1] : NaN; }

    // ---- Spektrum (Analysator-Ansicht) ----
    function spectrum(res, c, o) {
      if (!res.ok) return null;
      const view = o && (o.view === 'gt' || o.view === 'gg') ? o.view : 'sum';
      const key = view === 'gt' ? 'Lcm' : view === 'gg' ? 'Ldm' : 'L';
      const lines = res.lines.map(l => ({ f: l.f, L: isNum(l[key]) ? l[key] : l.L, Lcm: isNum(l.Lcm) ? l.Lcm : l.L, Ldm: isNum(l.Ldm) ? l.Ldm : l.L }));
      const lim = ['leit-B-QP', 'leit-B-AV'].map(id => ({ id, name: id === 'leit-B-QP' ? 'Übungsgrenzlinie Quasi-Spitzenwert (A)' : 'Übungsgrenzlinie Mittelwert (A)', pts: K.limitPts(id) })).filter(q => q.pts);
      const env = res.env ? (view === 'gt' ? res.env.gt : view === 'gg' ? res.env.gg : res.env.sum) : null;
      return { unit: 'dBµV', fMin: 9e3, fMax: res.fBand, lines, env, limits: lim, floor: -60, view, ring: { f: res.S.ring.fr, bump: res.bump } };
    }

    // ---- Zeitverlauf ----
    function ringParams(rg) {
      const wd = rg.wd > 0 ? rg.wd : 2 * Math.PI * rg.fr;
      let alpha = rg.alpha > 0 ? rg.alpha : (rg.zeta < 1 ? rg.zeta * wd / Math.sqrt(1 - rg.zeta * rg.zeta) : 0);
      return { wd, alpha };
    }
    function waveform(res, c, o) {
      if (!res.ok) return null;
      const view = o && o.view === 'perioden' ? 'perioden' : 'flanke';
      if (res.wf[view]) return res.wf[view];
      const S = res.S, u = c.u, tr = S.tr, tf = S.tf, T = 1 / c.fs, tau = c.duty / 100 * T, w = { tUnit: 'ns', t: [], series: [], marks: [] };
      if (view === 'perioden') {
        const t2 = tau + tr / 2 - tf / 2, t = [], y = [];
        for (let k = 0; k < 2; k++) { const o0 = k * T; [[0, 0], [tr, u], [t2, u], [t2 + tf, 0]].forEach(q => { t.push((o0 + q[0]) * 1e6); y.push(q[1]); }); }
        t.push(2 * T * 1e6); y.push(0);
        w.tUnit = 'µs'; w.t = t; w.series = [{ name: 'Schaltspannung', y, unit: 'V' }];
        w.marks = [{ t: T * 1e6, text: 'T = ' + eng(T, 's') + ' (fs ' + eng(c.fs, 'Hz') + ')' }];
      } else {
        const rg = S.ring, ringing = rg.os > 0.02 && rg.ur > 0 && rg.fr > 0, rp = ringParams(rg);
        const Tr = ringing ? 1 / rg.fr : 0;
        const span = ringing ? tr + Math.min(5 * Tr, rp.alpha > 0 ? 3 / rp.alpha : 5 * Tr) : tr * 4, tEnd = Math.max(span, 3 * tr), t0 = -0.4 * tr, n = 240;
        const t = [], y = [], yi = [];
        for (let i = 0; i < n; i++) {
          const tt = t0 + (tEnd - t0) * i / (n - 1), ideal = tt <= 0 ? 0 : (tt < tr ? u * tt / tr : u), tp = tt - tr;
          t.push(tt * 1e9); yi.push(ideal);
          y.push(ringing && tp > 0 ? ideal + rg.ur * Math.exp(-rp.alpha * tp) * Math.sin(rp.wd * tp) : ideal);
        }
        w.t = t; w.series = [{ name: 'Schaltknoten mit Ringing', y, unit: 'V' }, { name: 'ideale Flanke', y: yi, unit: 'V', dash: [6, 4] }];
        w.marks = [{ t: tr * 1e9, text: 'tr = ' + eng(tr, 's') }];
        if (ringing) w.marks.push({ t: (tr + Tr) * 1e9, text: 'Ring ' + eng(rg.fr, 'Hz') + ', Ur = ' + eng(rg.ur, 'V') });
      }
      res.wf[view] = w;
      return w;
    }

    // =================================================================================================================
    //  Zeichnen
    // =================================================================================================================
    function schematic(ctx, rc, v, sc) {
      const pal = sc.pal, c = v.ctl, res = v.res, S = res.S, rg = S.ring, fs = sc.fs;
      const X = f => rc.x + f * rc.w, Y = f => rc.y + f * rc.h, hasRing = rg.os > 0.05 && rg.fr > 0, snubOn = c.snub === 'ein', narrow = rc.w < 480;
      gfx.panel(ctx, rc.x, rc.y, rc.w, rc.h, pal.panel, pal.line, 8);
      ctx.save(); ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
      const colQ = pal.quelle, colG = pal.masse, colS = pal.senke, colF = pal.fg;
      const yRail = Y(0.12), yL = Y(0.20), yN = Y(0.28), yNode = Y(0.38), yPE = Y(0.80);
      // Geraetebereich (gestrichelt) und Gehaeuse-/PE-Linie
      ctx.setLineDash([5, 4]); gfx.panel(ctx, X(0.02), Y(0.06), 0.62 * rc.w, 0.79 * rc.h, null, pal.line, 8); ctx.setLineDash([]);
      if (!narrow) gfx.text(ctx, 'Gerät: Sperrwandler (Übungsquelle)', X(0.035), Y(0.06) + fs + 1, { size: fs, color: pal.mute, max: 0.58 * rc.w });
      gfx.line(ctx, [[X(0.03), yPE], [X(0.97), yPE]], colG, 2.5);
      gfx.text(ctx, 'Gehäuse / Schutzleiter (PE)', X(0.035), yPE - 5, { size: fs, color: colG, max: 0.5 * rc.w });
      // Primaerwicklung, Schaltknoten, Ferritperle, MOSFET
      const nx = X(0.36), ny = yNode, s = Math.max(10, 0.085 * rc.h), drainY = Y(0.46), yc = drainY + s;
      gfx.line(ctx, [[nx - 10, yRail], [nx + 10, yRail]], colF, 2);
      gfx.coilVs(ctx, nx, yRail, ny, colF, 4, 0.8 * (ny - yRail));
      gfx.text(ctx, eng(c.u, 'V'), narrow ? nx + 14 : nx - 14, yRail + 4, { size: fs, color: pal.fg, align: narrow ? 'left' : 'right', bg: pal.panel, pad: 2 });
      gfx.line(ctx, [[nx, ny], [nx, drainY]], colF, 2);
      const feY = (ny + drainY) / 2, feW = 14, feH = Math.max(7, (drainY - ny) * 0.7);
      if (c.ferrit) gfx.panel(ctx, nx - feW / 2, feY - feH / 2, feW, feH, pal.panel2, pal.fg, 3);
      else { ctx.setLineDash([3, 3]); gfx.panel(ctx, nx - feW / 2, feY - feH / 2, feW, feH, null, pal.mute, 3); ctx.setLineDash([]); }
      sc.hit('ferrit', nx - 16, feY - 14, 32, 28);
      const mos = gfx.mosfet(ctx, nx, yc, s, colF);
      gfx.line(ctx, [[nx, yc + s], [nx, yPE]], colF, 2);
      sc.hit('isw', nx - s * 0.7, drainY, s * 1.4, 2 * s);
      // Gate: Treiber und Gate-Widerstand
      const gx = mos ? mos.gate[0] : nx - s, gy = yc, xR0 = X(0.115), xR1g = X(0.215);
      gfx.line(ctx, [[gx, gy], [xR1g, gy]], colF, 2);
      gfx.sym.res(ctx, xR0, gy, xR1g - xR0, colF);
      gfx.line(ctx, [[X(0.095), gy], [xR0, gy]], colF, 2);
      gfx.panel(ctx, X(0.025), gy - 13, X(0.07), 26, pal.panel2, colQ, 4);
      gfx.text(ctx, rc.w > 440 ? 'Treiber' : 'Trb.', X(0.06), gy + 4, { size: fs, color: pal.mute, align: 'center', max: X(0.07) - 2 });
      gfx.text(ctx, 'Rg ' + eng(c.rg, 'Ω'), (xR0 + xR1g) / 2, gy - 9, { size: fs, bold: true, color: pal.fg, align: 'center', bg: pal.panel, pad: 2 });
      sc.hit('rg', X(0.095), gy - 16, xR1g - X(0.095), 32);
      // Knotenleitung nach rechts: Snubber-Zweig (RC) und parasitaere Kapazitaet cp
      const xs = X(0.47), xcp = X(0.57), colSn = snubOn ? colQ : pal.mute;
      gfx.line(ctx, [[nx, ny], [xcp, ny]], colF, 2);
      ctx.globalAlpha = snubOn ? 1 : 0.5; if (!snubOn) ctx.setLineDash([3, 3]);
      gfx.resVs(ctx, xs, ny, Y(0.56), colSn, 20); gfx.capV(ctx, xs, Y(0.56), yPE, colSn, 9);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      sc.hit('snub', xs - 16, ny, 32, yPE - ny);
      gfx.capV(ctx, xcp, ny, yPE, colG, 10);
      sc.hit('cp', xcp - 16, ny, 32, yPE - ny);
      gfx.text(ctx, (narrow ? '' : 'cp ') + eng(c.cp, 'F'), xcp + 14, (ny + yPE) / 2 + 4, { size: fs, bold: true, color: colG, bg: pal.panel, pad: 2, max: X(0.72) - xcp - 16 });
      gfx.text(ctx, 'RC', xs - 12, Y(0.56) + 4, { size: fs, color: colSn, align: 'right', bg: pal.panel, pad: 1 });
      // Netzleitung L und N, Netznachbildung (LISN)
      const xB = X(0.64), xl = X(0.72), xr = X(0.97), xR1 = X(0.80), xR2 = X(0.90);
      gfx.line(ctx, [[nx, yL], [xl, yL]], colF, 2); gfx.line(ctx, [[xB, yN], [xl, yN]], colF, 2);
      gfx.text(ctx, 'L', xB + 4, yL - 4, { size: fs, color: pal.mute }); gfx.text(ctx, 'N', xB + 4, yN - 4, { size: fs, color: pal.mute });
      sc.hit('idm', xB - 18, yL - 10, xl - xB + 18, yN - yL + 20);
      gfx.panel(ctx, xl, Y(0.10), xr - xl, Y(0.84) - Y(0.10), pal.panel2, colS, 6);
      gfx.text(ctx, narrow ? 'LISN' : 'LISN 2×50 Ω', (xl + xr) / 2, Y(0.10) + fs + 2, { size: fs, bold: true, color: colS, align: 'center', max: xr - xl - 4 });
      gfx.line(ctx, [[xl, yL], [xR1, yL]], colF, 2); gfx.line(ctx, [[xl, yN], [xR2, yN]], colF, 2);
      gfx.resVs(ctx, xR1, yL, yPE, colS, 26); gfx.resVs(ctx, xR2, yN, yPE, colS, 26);
      // elektrisches Feld vom Schaltknoten zum Gehaeuse (violett gestrichelt): Zahl der Linien waechst mit cp, das Muster laeuft mit der verlangsamten Phase
      {
        const nl = clamp(Math.round(2 + 2.4 * Math.log10(c.cp / 1e-12)), 2, 9), x0 = X(0.385), x1 = X(0.55);
        ctx.save(); ctx.strokeStyle = pal.efeld; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.45; if (ctx.setLineDash) ctx.setLineDash([4, 5]);
        if (!sc.reduced && 'lineDashOffset' in ctx) ctx.lineDashOffset = -v.phase * 18;
        for (let k = 0; k < nl; k++) { const ex = x0 + (x1 - x0) * (k + 0.5) / nl; ctx.beginPath(); ctx.moveTo(nx + 5, ny + 5); ctx.quadraticCurveTo(nx + (ex - nx) * 0.92, ny + (yPE - ny) * 0.22, ex, yPE - 2); ctx.stroke(); }
        ctx.restore();
      }
      // Teilchen: Gleichtakt ueber cp zum Gehaeuse und durch die LISN zurueck, Gegentakt zwischen L und N (Dichte folgt dem Pegel)
      if (!sc.ghost) {
        const rGT = clamp((res.cmMax - 20) / 90, 0.06, 1), rGG = clamp((res.dmMax - 20) / 90, 0.06, 1);
        const pathGT = [[nx, ny], [xcp, ny], [xcp, yPE], [xR1 + 4, yPE], [xR1 + 4, yL + 3], [nx, yL + 3], [nx, ny]];
        const pathGG = [[nx + 14, yL - 3], [xR1 - 4, yL - 3], [xR1 - 4, yPE - 4], [xR2 - 4, yPE - 4], [xR2 - 4, yN], [xB, yN]];
        const ps = sc.ps('quelle-sch', [{ pts: pathGT, rate: rGT, color: colG, size: 3 }, { pts: pathGG, rate: rGG, color: colQ, size: 3 }], { speed: 85 });
        ps.draw(ctx, { glow: sc.qp.glow, reduced: sc.reduced });
      }
      // Schaltknoten: Leuchten und Wellenringe (Staerke nach Ring-Ueberschwingen)
      if (sc.qp.gradients) gfx.glow(ctx, nx, ny, 0.09 * rc.h, colQ, 0.55, sc.qp);
      gfx.dot(ctx, nx, ny, 4, colQ);
      if (hasRing) gfx.waveRings(ctx, nx, ny, v.phase, colQ, 3, 0.11 * rc.h, 0.3 + 0.5 * Math.min(1, rg.os), sc.reduced);
      // Messmarken links (Zahlen stehen im Bild)
      let ly = Y(0.185);
      const row = (label, val, col) => { gfx.chip(ctx, label, val, X(0.035), ly, { pal, size: fs, color: col || pal.fg, max: X(0.30) - X(0.035) }); ly += Math.max(fs + 5, 0.075 * rc.h); };
      const low = rc.h < 240;                                            // niedriges Bild: nur die wichtigsten Marken, damit nichts mit dem Gate-Zweig kollidiert
      row('tr', eng(S.tr, 's'));
      if (!low) row('dU/dt', fm(S.dudt / 1e9, 1) + ' V/ns');
      if (!narrow) row('f2', eng(S.f2, 'Hz'));
      if (hasRing) row('Ring', eng(rg.fr, 'Hz') + ', ' + fm(rg.os * 100, 0) + ' %', pal.rot); else row('Ring', 'keins', pal.gruen);
      row('Verlust', fm(S.pSw, 2) + ' W' + (rg.pSnub > 0 ? ' + ' + fm(rg.pSnub, 2) + ' W' : ''));
      // Legende unten: Pegel am LISN und Stand der Maßnahmen
      const ly2 = Y(0.915), ly3 = Y(0.975);
      gfx.dot(ctx, X(0.04), ly2 - 4, 4, colG); const w1 = gfx.text(ctx, 'Gleichtakt GT ' + fm(res.cmMax, 1) + ' dBµV', X(0.04) + 8, ly2, { size: fs, color: pal.fg, max: 0.46 * rc.w });
      const x2 = X(0.04) + 8 + w1 + 14; gfx.dot(ctx, x2, ly2 - 4, 4, colQ); gfx.text(ctx, 'Gegentakt GG ' + fm(res.dmMax, 1) + ' dBµV', x2 + 8, ly2, { size: fs, color: pal.fg, max: rc.x + rc.w - x2 - 12 });
      gfx.text(ctx, 'Snubber ' + (snubOn ? eng(c.rsn, 'Ω') + '/' + eng(c.csn, 'F') : 'aus') + ' · Ferrit ' + (c.ferrit ? 'ein' : 'aus') + ' · Jitter ' + fn(c.jitter, 1) + ' %', X(0.04), ly3, { size: fs, color: pal.mute, max: rc.w * 0.92 });
      ctx.restore();
    }

    function spectrumPanel(ctx, rc, v, sc) {
      const pal = sc.pal, res = v.res, c = v.ctl, fs = sc.fs;
      const spc = spectrum(res, c, { view: 'sum' });
      if (!spc) return;
      const pr = sc.peer && sc.peer.res && sc.peer.res.ok ? sc.peer.res : null;           // Vorher/Nachher: gemeinsame Achsen
      const yMax = Math.max(120, Math.ceil((Math.max(res.lMax, pr ? pr.lMax : -1e9) + 10) / 20) * 20);
      const lowOf = r => r.lines.reduce((m, l) => Math.min(m, Math.max(-60, l.L)), 1e9), lowest = Math.min(lowOf(res), pr ? lowOf(pr) : 1e9), yMin = Math.max(0, Math.floor((Math.min(lowest, 46) - 12) / 10) * 10);
      const qpF = f => K.limitAt('leit-B-QP', f), avF = f => K.limitAt('leit-B-AV', f);
      const worst = res.ass && isNum(res.ass.freq) ? res.lines.reduce((b, l) => (!b || Math.abs(Math.log(l.f / res.ass.freq)) < Math.abs(Math.log(b.f / res.ass.freq)) ? l : b), null) : null;
      const mk = worst ? { f: worst.f, L: worst.L, text: eng(worst.f, 'Hz') + ' · ' + fm(worst.L, 1) + ' dBµV' + (isNum(res.ass.margin) && rc.w >= 480 ? ' · Marge ' + fm(res.ass.margin, 1) + ' dB' : '') } : null;
      const d = { lines: spc.lines, key: v.st.version + '|' + c.band, lim: spc.limits.map((q, i) => ({ name: q.name.replace('Übungsgrenzlinie ', ''), pts: q.pts, dash: i ? [3, 3] : [8, 4] })), env: spc.env, fMin: spc.fMin, fMax: spc.fMax, yMin, yMax,
        marker: mk, unit: 'dBµV', avLim: avF, qpLim: qpF,
        legend: [{ label: '✓ ≥ 6 dB', color: pal.gruen }, { label: '! < 6 dB', color: pal.gelb }, { label: '! über AV', color: '#ff9a3d' }, { label: '✗ über QP', color: pal.rot }, { label: 'ohne Grenzwert', color: pal.grau }, { label: 'Einhüllende', color: pal.hfeld, dash: [6, 4] }, { label: 'Grenzlinie (Übung)', color: pal.grenz, dash: [8, 4] }] };
      const ax = gfx.spectrumBars(ctx, rc.x, rc.y, rc.w, rc.h, d, { pal, tw: sc.tw.spec || (sc.tw.spec = {}), t: sc.t, reduced: sc.reduced, size: fs });
      if (ax && res.bump > 3 && res.S.ring.fr >= spc.fMin && res.S.ring.fr <= spc.fMax) {
        const near = res.lines.reduce((b, l) => (!b || Math.abs(Math.log(l.f / res.S.ring.fr)) < Math.abs(Math.log(b.f / res.S.ring.fr)) ? l : b), null);
        if (near) {
          const bx = ax.xp(near.f), by = ax.yp(near.L);
          gfx.arrow(ctx, bx, by - 22, bx, by - 4, pal.rot, 2, 5);
          gfx.text(ctx, 'Ring-Buckel +' + fm(res.bump, 1) + ' dB bei ' + eng(res.S.ring.fr, 'Hz'), Math.min(bx, rc.x + rc.w - 8), by - 26, { size: fs, bold: true, color: pal.rot, align: bx > rc.x + rc.w * 0.6 ? 'right' : 'left', bg: pal.panel, pad: 2, max: rc.w * 0.7 });
        }
      }
    }

    function wavePanel(ctx, rc, v, sc) {
      const pal = sc.pal, res = v.res, fs = sc.fs, wf = waveform(res, v.ctl, { view: 'flanke' });
      if (!wf) return;
      const pr = sc.peer && sc.peer.res && sc.peer.res.ok ? waveform(sc.peer.res, sc.peer.ctl, { view: 'flanke' }) : null;   // gemeinsame Achsen
      const yHi = Math.max(Math.max.apply(null, wf.series[0].y), pr ? Math.max.apply(null, pr.series[0].y) : -1e9), yLo = Math.min(Math.min.apply(null, wf.series[0].y), pr ? Math.min.apply(null, pr.series[0].y) : 1e9);
      const ax = gfx.traceChart(ctx, rc.x, rc.y, rc.w, rc.h, wf, { pal, title: 'Schaltknoten, Flanke in Zeitlupe', size: fs, yLabel: 'Spannung in V', t0: Math.min(wf.t[0], pr ? pr.t[0] : 1e9), t1: Math.max(wf.t[wf.t.length - 1], pr ? pr.t[pr.t.length - 1] : -1e9), yMin: yLo, yMax: yHi });
      if (ax && !sc.reduced && !sc.ghost) {
        const n = wf.t.length, i = Math.min(n - 1, Math.floor(v.phase * n)), y = wf.series[0].y[i];
        if (okv(wf.t[i], y)) { gfx.dot(ctx, ax.xp(wf.t[i]), ax.yp(y), 4, pal.quelle); }
      }
    }

    function draw(ctx, w, h, t, v, sc) {
      const pal = sc.pal, res = v.res, a = v.ampel, fs = sc.fs;
      if (w < 200 || h < 150) { gfx.text(ctx, 'Störquelle Schalter', 8, 18, { size: 12, color: pal.fg }); return; }
      const pad = 8, hh = sc.header === false ? 0 : 30;                  // header: false lässt die Ampelzeile weg (die Seite zeigt sie selbst)
      if (!res.ok) {
        if (hh) gfx.ampelRow(ctx, pad, pad + 14, { ampel: 'grau', text: 'Kein Prüfergebnis' }, { pal, size: fs + 1, max: w - 2 * pad });
        gfx.panel(ctx, pad, hh + pad, w - 2 * pad, Math.min(120, h - hh - 2 * pad), pal.panel, pal.rot, 8);
        gfx.text(ctx, res.why || 'Die Quelle ist mit diesen Werten nicht berechenbar.', pad + 12, hh + pad + 30, { size: fs + 1, color: pal.fg, max: w - 2 * pad - 24 });
        return;
      }
      const head = isNum(a.margin) ? 'Marge ' + fm(a.margin, 1) + ' dB zur Mittelwert-Linie bei ' + eng(a.freq, 'Hz') : a.text;
      if (hh) gfx.ampelRow(ctx, pad, pad + 14, { ampel: a.ampel, text: head }, { pal, size: fs + 1, max: w - 2 * pad });
      const top = hh + pad, avail = h - top - pad, wide = w >= h * 1.15 && w >= 640;
      let rS, rP, rW;
      if (wide) {
        const cw = Math.round(w * 0.46), hs = Math.round(avail * 0.6);
        rS = { x: pad, y: top, w: cw - pad * 1.5, h: hs }; rW = { x: pad, y: top + hs + pad, w: rS.w, h: avail - hs - pad };
        rP = { x: cw + pad / 2, y: top, w: w - cw - pad * 1.5, h: avail };
      } else {
        const hs = Math.round(avail * 0.37), hp = Math.round(avail * 0.37);
        rS = { x: pad, y: top, w: w - 2 * pad, h: hs }; rP = { x: pad, y: top + hs + pad, w: w - 2 * pad, h: hp }; rW = { x: pad, y: top + hs + hp + 2 * pad, w: w - 2 * pad, h: avail - hs - hp - 2 * pad };
      }
      const showWave = rW.h >= 100;
      if (!showWave) { if (wide) rS.h += rW.h + pad; else rP.h += rW.h + pad; }      // kein Platz fuer den Zeitverlauf: die uebrige Flaeche bekommt das Bild darueber
      schematic(ctx, rS, v, sc);
      spectrumPanel(ctx, rP, v, sc);
      if (showWave) wavePanel(ctx, rW, v, sc);
      if (!sc.reduced) gfx.text(ctx, 'Animation verlangsamt', w - pad, h - 3, { size: fs, color: pal.mute, align: 'right' });
    }

    return { compute, meters, assess, diag, curves, spectrum, waveform, draw, phaseHz: (res, c) => Math.min(2.5, 0.5 * Math.log10(Math.max(10, c.fs))) };
  }

  const SPEC = {
    id: 'quelle', name: 'Störquelle Schalter', icon: '⚡',
    info: 'Übungsquelle Sperrwandler 325 V: Das Spektrum der Störungen im Gleichtakt und im Gegentakt an der Netznachbildung, noch ohne Filter, gegen die Übungsgrenzlinie. Flanke, Ringing, Snubber und Jitter wirken auf den Pegel; alle Zahlen sind Übungswerte.',
    world: { w: 960, h: 600 },
    chain: { quelle: 'Schaltknoten des MOSFET: schnelle Flanken und der Stromimpuls beim Ausschalten', pfad: 'Parasitäre Kapazität zum Gehäuse und die Netzleitung', senke: 'Netznachbildung (LISN) beziehungsweise Funkempfang', art: 'leitungsgebunden', kopplung: ['kapazitiv', 'galvanisch'] },
    controls: CONTROLS, noLever: ['band'], meters: METERS, presets: PRESETS, params: { klasse: 'B', fLimit: F_LIMIT_MAX },
    plant: plant
  };
  R.register({ id: SPEC.id, name: SPEC.name, icon: SPEC.icon, info: SPEC.info, controls: SPEC.controls, meters: SPEC.meters, presets: SPEC.presets, chain: SPEC.chain, create: opts => B.makeRig(SPEC, opts) });
})(typeof window !== 'undefined' ? window : globalThis);
