/* ntsrig-buck.js - Netzteil-Lab (WP2b): Pruefstand 4 `buck` - Tiefsetzsteller (SPEC 5.4).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js (und ntscore-sw.js) laden (in Node holt sie sich beides per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.buck.ccm / wave / lcrit, NTS_CORE.loss.eta / curve); hier steht keine zweite Formel.
 * Gleichspannungsmodell mit idealen Bauteilen, Verluste getrennt (Lehrmodell, Uebungswerte). Eingang Gleichspannung 6..60 V (Kleinspannung, limits u_dc_max).
 * Steuerwerte mit Einheit am Schluessel (Ausnahme zu SI, wie in der Vorlage des Stubs): f in kHz, l in µH, c in µF, esr und rdson in mΩ.
 * Steuerwerte: uin, steuer (geregelt/gesteuert), uout, d, f, l, c, esr, rdson, uf (Diode/Synchron), iout, Taste fire (Lastsprung).
 * Messgeraete: d (%), dIL (A), iLmin (A), iLmax (A), dU (mV), eta (%), modus (1 = nicht lueckend, 0 = lueckend). Wirft nie.
 * Ampelgrenzen (dil_max, eta_ok, d_min, d_max) sind Lehrfaustwerte (A) aus NTS_CORE.limits; Bauteilwerte (R_ds,on, U_F, t_sw, Q_g, R_L) Uebungswerte.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-buck.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, fm, eng } = B;

  const G_E = 'Eingang und Transformator', G_R = 'Regelung', G_S = 'Schalten und Gate', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const gesteuert = s => s.steuer === 'gesteuert', geregelt = s => s.steuer !== 'gesteuert';
  const CONTROLS = [
    { key: 'uin', label: 'Eingangsspannung U_ein', type: 'slider', scale: 'lin', min: 6, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: 12, stufe: 'trafo', group: G_E,
      help: 'Gleichspannung am Eingang des Tiefsetzstellers (Kleinspannung bis 60 V). Bei gleicher Ausgangsspannung wird das Tastverhältnis D = U_aus / U_ein kleiner, wenn U_ein steigt, und die Drosselwelligkeit größer.' },
    { key: 'steuer', label: 'Betriebsart', type: 'select', value: 'geregelt', options: opt([['geregelt', 'Geregelt (Ausgangsspannung fest)'], ['gesteuert', 'Gesteuert (Tastverhältnis fest)']]), stufe: 'regel', group: G_R,
      help: 'Geregelt: Die Regelung stellt D so nach, dass U_aus gleich dem Sollwert bleibt. Gesteuert: D ist fest, die Ausgangsspannung folgt dem Produkt D mal U_ein und ändert sich mit der Eingangsspannung.' },
    { key: 'uout', label: 'Ausgangsspannung U_aus (Soll)', type: 'slider', scale: 'lin', min: 1, max: 30, step: 0.1, unit: 'V', unitKind: 'volt', value: 5, stufe: 'regel', group: G_R, visible: geregelt,
      help: 'Sollwert der Ausgangsspannung im geregelten Betrieb. Er muss kleiner als U_ein sein: Ein Tiefsetzsteller kann die Spannung nur verkleinern. Bei U_aus gleich oder über U_ein meldet der Prüfstand, dass ein Hochsetzsteller nötig ist.' },
    { key: 'd', label: 'Tastverhältnis D', type: 'slider', scale: 'lin', min: 0.05, max: 0.95, step: 0.0001, unit: '', unitKind: 'ratio', value: 0.4167, stufe: 'regel', group: G_R, visible: gesteuert,
      help: 'Anteil der Periode, in dem der Schalter eingeschaltet ist (nur gesteuert, Anzeige als Zahl zwischen 0 und 1). Im nicht lückenden Betrieb gilt U_aus = D · U_ein. 0,4167 entspricht 5 V aus 12 V.' },
    { key: 'f', label: 'Schaltfrequenz f_sw', type: 'slider', scale: 'log', min: 20, max: 500, step: 1, unit: 'kHz', unitKind: 'freq', value: 100, stufe: 'schalt', group: G_S,
      help: 'Schaltfrequenz in kHz. Eine höhere Frequenz verkleinert die Drosselwelligkeit ΔI_L = (U_ein − U_aus) · D / (f · L) und die Ausgangswelligkeit, erhöht aber Schaltverlust und Gate-Verlust.' },
    { key: 'l', label: 'Drossel L', type: 'slider', scale: 'log', min: 10, max: 1000, step: 1, unit: 'µH', unitKind: 'ind', value: 100, stufe: 'schalt', group: G_S,
      help: 'Induktivität der Drossel in µH. Eine größere Drossel verkleinert die Welligkeit ΔI_L. Ist sie zu klein, fällt der Drosselstrom bei kleiner Last auf 0 A (lückender Betrieb).' },
    { key: 'c', label: 'Ausgangskondensator C', type: 'slider', scale: 'log', min: 10, max: 1000, step: 1, unit: 'µF', unitKind: 'cap', value: 100, stufe: 'schalt', group: G_S,
      help: 'Kapazität am Ausgang in µF. Der Kapazitätsanteil der Welligkeit ist ΔU_C = ΔI_L / (8 · f · C); ein größeres C verkleinert ihn. Der ESR-Anteil bleibt davon unberührt.' },
    { key: 'esr', label: 'ESR des Kondensators', type: 'slider', scale: 'lin', min: 0, max: 500, step: 1, unit: 'mΩ', unitKind: 'res', value: 50, stufe: 'schalt', group: G_S,
      help: 'Ersatz-Serienwiderstand des Ausgangskondensators in mΩ (Übungswert 50 mΩ). Er liefert den größten Anteil der Ausgangswelligkeit: ΔU ≈ ΔI_L · ESR plus Kapazitätsanteil.' },
    { key: 'rdson', label: 'Durchlasswiderstand des Schalters R_ds,on', type: 'slider', scale: 'lin', min: 5, max: 500, step: 1, unit: 'mΩ', unitKind: 'res', value: 50, stufe: 'schalt', group: G_S,
      help: 'Durchlasswiderstand des Schalt-MOSFETs in mΩ (Übungswert 50 mΩ, Datenblatt maßgeblich). Er bestimmt den Leitverlust R_ds · D · I_rms². Bei Synchrongleichrichtung gilt derselbe Wert für den zweiten MOSFET.' },
    { key: 'uf', label: 'Gleichrichtung', type: 'select', value: 'diode', options: opt([['diode', 'Diode (Schottky, 0,4 V Übungswert)'], ['sync', 'Synchrongleichrichter (MOSFET)']]), stufe: 'schalt', group: G_S,
      help: 'Die Freilaufdiode (Schottky, Durchlassspannung 0,4 V als Übungswert) oder ein zweiter MOSFET (Synchrongleichrichter). Statt U_F · I fällt nur R_ds · I² ab; der Wirkungsgrad steigt, die Totzeit ist nicht modelliert.' },
    { key: 'iout', label: 'Ausgangsstrom I_aus', type: 'slider', scale: 'lin', min: 0.05, max: 3, step: 0.05, unit: 'A', unitKind: 'amp', value: 1, stufe: 'last', group: G_L,
      help: 'Laststrom am Ausgang. Im gesteuerten Betrieb gilt er bei der Ausgangsspannung D · U_ein (die Last wirkt wie ein Widerstand). Ein kleiner Strom führt zum lückenden Betrieb, ein großer erhöht die Leitverluste.' },
    { key: 'fire', label: 'Lastsprung', type: 'button', stufe: null, group: G_L, help: 'Springt im Modell vom halben auf den eingestellten Laststrom und meldet, was sich beim Drosselstrom ändert (nur Simulation).' }
  ];
  const METERS = [
    { key: 'd', label: 'Tastverhältnis D', unit: '%', digits: 2, min: 0, max: 100, help: 'Anteil der Periode mit eingeschaltetem Schalter. Geregelt D = U_aus / U_ein (12 V auf 5 V: 41,67 %); im lückenden Betrieb stellt sich D nach der Lückformel ein.' },
    { key: 'dIL', label: 'Drosselwelligkeit ΔI_L', unit: 'A', digits: 4, min: 0, max: 20, help: 'Spitze-Spitze-Welligkeit des Drosselstroms: ΔI_L = (U_ein − U_aus) · D / (f · L). Im lückenden Betrieb steht hier der Spitzenstrom, weil der Strom bis 0 A fällt.' },
    { key: 'iLmin', label: 'Kleinster Drosselstrom I_Lmin', unit: 'A', digits: 3, min: 0, max: 20, help: 'Kleinster Wert des Drosselstroms: I_aus minus ΔI_L / 2. Im lückenden Betrieb ist er 0 A.' },
    { key: 'iLmax', label: 'Größter Drosselstrom I_Lmax', unit: 'A', digits: 3, min: 0, max: 20, help: 'Größter Wert des Drosselstroms: I_aus plus ΔI_L / 2. Die Drossel darf bei diesem Strom nicht sättigen (Sättigung ist im Lab nicht modelliert).' },
    { key: 'dU', label: 'Ausgangswelligkeit ΔU (Spitze–Spitze)', unit: 'mV', digits: 2, min: 0, max: 5000, help: 'Summe aus Kapazitätsanteil ΔI_L / (8 · f · C) und ESR-Anteil ΔI_L · ESR (obere Näherung, Lehrmodell).' },
    { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 100, help: 'Wirkungsgrad aus den Einzelverlusten (Leitung, Diode, Schalten, Gate, Drossel, Kondensator), nicht aus einem Schätzwert. Alle Bauteilwerte sind Übungswerte; Eisenverluste der Drossel sind nicht modelliert.' },
    { key: 'modus', label: 'Betriebsart (Code)', unit: '', digits: 0, min: 0, max: 1, texts: { 0: 'lückend (Drosselstrom fällt auf 0 A)', 1: 'nicht lückend (CCM)' },
      help: 'Code: 1 = nicht lückend (der Drosselstrom bleibt über 0 A, Vergleich I_aus gegen ΔI_L / 2), 0 = lückend (der Drosselstrom fällt in jeder Periode auf 0 A).' }
  ];
  const PRESETS = [
    { id: '12v-5v', name: '12 V auf 5 V', info: '12 V auf 5 V bei 1 A, 100 kHz und 100 µH: D = 41,67 %, ΔI_L = 0,2917 A (Lehrmodell, Übungswerte).', params: { uin: 12, steuer: 'geregelt', uout: 5, f: 100, l: 100, c: 100, esr: 50, rdson: 50, uf: 'diode', iout: 1 } },
    { id: 'l-klein-lueckt', name: 'Kleine Drossel lückt', info: 'Mit 10 µH und 0,05 A fällt der Drosselstrom auf 0 A: lückender Betrieb.', params: { uin: 12, steuer: 'geregelt', uout: 5, f: 100, l: 10, c: 100, esr: 50, rdson: 50, uf: 'diode', iout: 0.05 } },
    { id: 'f-hoch-eta', name: 'Hohe Schaltfrequenz', info: 'Mit 500 kHz sinkt die Welligkeit, aber Schalt- und Gate-Verlust steigen: der Wirkungsgrad fällt.', params: { uin: 12, steuer: 'geregelt', uout: 5, f: 500, l: 100, c: 100, esr: 50, rdson: 50, uf: 'diode', iout: 1 } },
    { id: 'sync-gleichrichter', name: 'Synchrongleichrichter', info: 'Der zweite MOSFET ersetzt die Diode: weniger Verlust, höherer Wirkungsgrad.', params: { uin: 12, steuer: 'geregelt', uout: 5, f: 100, l: 100, c: 100, esr: 50, rdson: 50, uf: 'sync', iout: 1 } }
  ];
  const PFAD = { quelle: 'Gleichspannung bis 60 V (Kleinspannung), zum Beispiel hinter Gleichrichter und Ladekondensator', wandlung: 'Getaktet: Schalter, Drossel, Freilaufdiode und Ausgangskondensator setzen die Spannung herunter', senke: 'Last mit kleinerer Ausgangsspannung', art: 'getaktet' };

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);
    /* Kernvorgaben aus den Steuerwerten (SI); io = anderer Laststrom (Lastsprung, Kennlinien) */
    function cfgOf(ctl, ov) {
      ov = ov || {};
      const io = ov.iout !== undefined ? ov.iout : ctl.iout, l = ov.l !== undefined ? ov.l : ctl.l * 1e-6, f = ov.f !== undefined ? ov.f : ctl.f * 1e3;
      const cfg = { Uin: ctl.uin, f, L: l, C: ctl.c * 1e-6, esr: ctl.esr * 1e-3 };
      if (ctl.steuer === 'gesteuert') { cfg.D = ctl.d; cfg.Rlast = ctl.d * ctl.uin / io; } else { cfg.Uout = ctl.uout; cfg.Iout = io; }
      return cfg;
    }
    function lossCfgOf(ctl, cc) {
      return { kind: 'buck', Uin: ctl.uin, Uout: cc.Uabs, Iout: cc.Iout, f: cc.f, L: cc.L, rdson: ctl.rdson * 1e-3, esr: ctl.esr * 1e-3, sync: ctl.uf === 'sync' };
    }
    function compute(ctl) {
      const cfg = cfgOf(ctl), cc = CORE.buck.ccm(cfg);
      if (!cc || !cc.ok) return { ok: false, error: cc && cc.why || 'Eingabe' };
      const wv = CORE.buck.wave(Object.assign({}, cfg, { periods: 3 }), 400);
      if (!wv || !wv.ok) return { ok: false, error: wv && wv.why || 'Eingabe' };
      const lcfg = lossCfgOf(ctl, cc), ls = CORE.loss.eta(lcfg);
      if (!ls || ls.ok === false) return { ok: false, error: ls && ls.why || 'Eingabe' };
      const lk = CORE.buck.lcrit({ D: cc.Uabs / ctl.uin, Rlast: cc.R, f: cc.f, L: cc.L });   /* D = U_aus/U_ein (nicht das D des Lueckbetriebs cc.D), wie NTS_CORE.assess/diagnose */
      return { ok: true, cfg, cc, wv, lcfg, ls, lk: lk && lk.ok ? lk : null, dilMax: L('dil_max'), etaOk: L('eta_ok'), dMin: L('d_min'), dMax: L('d_max') };
    }
    function meters(r) {
      if (!r.ok) return { d: 0, dIL: 0, iLmin: 0, iLmax: 0, dU: 0, eta: 0, modus: 0 };
      const c = r.cc;
      return { d: c.D * 100, dIL: c.dIL, iLmin: c.ILmin, iLmax: c.ILmax, dU: isNum(c.dU) ? c.dU * 1000 : 0, eta: r.ls.eta * 100, modus: c.ccm ? 1 : 0 };
    }
    /* Bilanz: je Stufe summiert (schalt = Leitung + Schalten + Gate, gleich = Diode, sieb = Drossel + Kondensator, regel = Ruhestrom); Summe = P_V des Kerns */
    function bilanz(r) {
      if (!r.ok) return null;
      const p = r.ls, pv = [];
      const add = (stufe, w) => { if (w > 0) pv.push({ stufe, w }); };
      add('schalt', p.leitung + p.schalt + p.gate); add('gleich', p.diode); add('sieb', p.drossel + p.kondensator); add('regel', p.ruhe);
      return { pzu: p.Pzu, pab: p.Pab, pv };
    }
    function assess(r) {
      if (!r.ok) {
        const e = String(r.error || '');
        return { ok: false, ampel: /Ausgangsspannung ≥|Hochsetzsteller/.test(e) ? 'rot' : 'grau', text: e ? e : 'Die Schaltung ist mit diesen Werten nicht rechenbar.' };
      }
      const c = r.cc, why = [];
      const dilG = r.dilMax * c.Iout;
      if (c.lueckt) why.push('Lückbetrieb: Der Drosselstrom fällt in jeder Periode auf 0 A (I_aus = ' + eng(c.Iout, 'A') + ' unter I_krit = ' + eng(c.Ikrit, 'A') + ').');
      else if (c.dIL > dilG + 1e-12) why.push('ΔI_L = ' + eng(c.dIL, 'A') + ' liegt über ' + fm(r.dilMax, 1) + ' mal I_aus = ' + eng(dilG, 'A') + ' (Lehrfaustwert).');
      if (r.ls.eta * 100 < r.etaOk - 1e-9) why.push('η = ' + fm(r.ls.eta * 100, 1) + ' % liegt unter ' + fm(r.etaOk, 0) + ' % (Übungswert).');
      if (c.D * 100 < r.dMin - 1e-9 || c.D * 100 > r.dMax + 1e-9) why.push('D = ' + fm(c.D * 100, 1) + ' % liegt außerhalb ' + fm(r.dMin, 0) + ' bis ' + fm(r.dMax, 0) + ' % (Lehrfaustwert).');
      const margin = !c.lueckt && c.dIL > 0 ? dilG / c.dIL : undefined;
      if (why.length) return { ok: false, ampel: 'gelb', text: why.join(' '), margin };
      return { ok: true, ampel: 'gruen', text: 'Nicht lückend, ΔI_L = ' + eng(c.dIL, 'A') + ' unter ' + fm(r.dilMax, 1) + ' mal I_aus = ' + eng(dilG, 'A') + ', η = ' + fm(r.ls.eta * 100, 1) + ' % über ' + fm(r.etaOk, 0) + ' % und D = ' + fm(c.D * 100, 1) + ' % im Bereich (Lehrfaustwerte, Übungswerte).', margin };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) return out;
      out.push({ id: 'buck-modell', kind: 'info', text: 'Lehrmodell: ideale Bauteile, Verluste getrennt gerechnet (Übungswerte). Eisenverluste der Drossel, Sättigung und Totzeit sind nicht modelliert.' });
      (r.cc.diag || []).forEach(d => out.push({ id: d.id, kind: d.kind || 'info', text: d.text, link: d.link }));
      if (r.lk && r.lk.diag) r.lk.diag.forEach(d => { if (d.id === 'l-zu-klein') out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }); });
      if (ctl.uf === 'sync' && isNum(r.ls.etaSync) && isNum(r.ls.etaDiode) && r.ls.etaSync > r.ls.etaDiode) {
        out.push({ id: 'sync', kind: 'info', text: B.msg(CORE, 'sync', { sync: fm(r.ls.etaSync * 100, 1) + ' %', diode: fm(r.ls.etaDiode * 100, 1) + ' %' }, 'Mit Synchrongleichrichter beträgt η = {sync}, mit Diode wären es {diode}.') });
      }
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const pt = (arr, x, y) => { if (isNum(x) && isNum(y)) arr.push([x, y]); };
      const E1 = [], E2 = [], E3 = [];
      const ci = CORE.loss.curve(r.lcfg, 'I', 0.05, 3, 40), cf = CORE.loss.curve(r.lcfg, 'f', 20e3, 500e3, 40);
      if (ci && ci.ok) ci.x.forEach((x, i) => pt(E1, x, ci.eta[i] * 100));
      if (cf && cf.ok) cf.x.forEach((x, i) => pt(E2, x / 1e3, cf.eta[i] * 100));
      for (let k = 0; k <= 40; k++) {
        const lh = 10e-6 * Math.pow(100, k / 40), q = CORE.buck.ccm(cfgOf(ctl, { l: lh }));
        if (q && q.ok) pt(E3, lh * 1e6, q.dIL);
      }
      return [{ id: 'eta-i', title: 'Wirkungsgrad über dem Ausgangsstrom (Lehrmodell)', xLabel: 'Ausgangsstrom I_aus', xUnit: 'A', xScale: 'lin', yLabel: 'Wirkungsgrad η', yUnit: '%',
        series: [{ name: 'η aus den Einzelverlusten', points: E1 }], marker: { x: ctl.iout, y: r.ls.eta * 100, label: 'jetzt ' + fm(r.ls.eta * 100, 1) + ' %' }, limit: { y: r.etaOk, label: 'Übungswert ' + fm(r.etaOk, 0) + ' %' } },
      { id: 'eta-f', title: 'Wirkungsgrad über der Schaltfrequenz (Lehrmodell)', xLabel: 'Schaltfrequenz f_sw', xUnit: 'kHz', xScale: 'log', yLabel: 'Wirkungsgrad η', yUnit: '%',
        series: [{ name: 'η aus den Einzelverlusten', points: E2 }], marker: { x: ctl.f, y: r.ls.eta * 100, label: 'jetzt ' + fm(r.ls.eta * 100, 1) + ' %' }, limit: { y: r.etaOk, label: 'Übungswert ' + fm(r.etaOk, 0) + ' %' } },
      { id: 'dil-l', title: 'Drosselwelligkeit über der Drossel', xLabel: 'Drossel L', xUnit: 'µH', xScale: 'log', yLabel: 'Drosselwelligkeit ΔI_L', yUnit: 'A',
        series: [{ name: 'ΔI_L = (U_ein − U_aus) · D / (f · L)', points: E3 }], marker: { x: ctl.l, y: r.cc.dIL, label: 'jetzt ' + eng(r.cc.dIL, 'A') }, limit: { y: r.dilMax * r.cc.Iout, label: 'Lehrfaustwert ' + fm(r.dilMax, 1) + ' · I_aus' } }];
    }
    function waveform(r) {
      if (!r.ok) return null;
      const w = r.wv, s = n => (w.series.find(q => q.name === n) || { y: [], unit: '' });
      return { tUnit: 'µs', t: w.t.slice(), series: ['u_sw', 'i_L', 'i_D', 'u_C'].map(n => ({ name: n, y: s(n).y.slice(), unit: s(n).unit })), marks: (w.marks || []).map(m => ({ name: m.name, value: m.t, unit: 'µs' })) };
    }
    function state(r) {
      if (!r.ok) return { modusText: '' };
      return { modusText: r.cc.ccm ? METERS[6].texts[1] : METERS[6].texts[0] };
    }
    function fire(r, ctl) {
      if (!r.ok) { P0.say('Lastsprung nicht möglich: ' + (r.error || 'Eingabe prüfen') + '.', 'warn'); return false; }
      const i2 = ctl.iout, i1 = i2 / 2;
      const a = CORE.buck.ccm(cfgOf(ctl, { iout: i1 })), b = r.cc;
      if (!a || !a.ok) { P0.say('Lastsprung: Beim halben Strom ' + eng(i1, 'A') + ' gibt es keinen Arbeitspunkt (' + (a && a.why || 'Eingabe') + ').', 'warn'); return true; }
      const mt = c => c.ccm ? 'nicht lückend' : 'lückend';
      P0.say('Lastsprung von ' + eng(i1, 'A') + ' auf ' + eng(i2, 'A') + ': ' + mt(a) + ' (ΔI_L ' + eng(a.dIL, 'A') + ', I_Lmax ' + eng(a.ILmax, 'A') + ') gegen ' + mt(b) + ' (ΔI_L ' + eng(b.dIL, 'A') + ', I_Lmax ' + eng(b.ILmax, 'A') + ').', b.ccm && a.ccm ? 'info' : 'warn');
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal, ctl = view.ctl;
      if (!rc || rc.w < 140 || rc.h < 100 || !r.ok) return;
      const wide = rc.w >= 640, gap = 8;
      let a, s, b, v;
      if (wide) {
        const th = Math.floor(rc.h * 0.56) - gap / 2, bh = rc.h - th - gap;
        a = { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.36) - gap, h: th };
        s = { x: a.x + a.w + gap, y: rc.y, w: rc.w - a.w - gap, h: th };
        v = { x: rc.x, y: rc.y + th + gap, w: Math.floor(rc.w * 0.46) - gap, h: bh };
        b = { x: v.x + v.w + gap, y: v.y, w: rc.w - v.w - gap, h: bh };
      } else {
        const h1 = Math.floor(rc.h * 0.26), h2 = Math.floor(rc.h * 0.3), h3 = Math.floor(rc.h * 0.2);
        a = { x: rc.x, y: rc.y, w: rc.w, h: h1 - gap };
        s = { x: rc.x, y: rc.y + h1, w: rc.w, h: h2 - gap };
        v = { x: rc.x, y: rc.y + h1 + h2, w: rc.w, h: h3 - gap };
        b = { x: rc.x, y: rc.y + h1 + h2 + h3, w: rc.w, h: rc.h - h1 - h2 - h3 };
      }
      const opts2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false }, D = sc.D, c = r.cc;
      const on = sc.reduced || sc.phase < c.D;
      let ok = false;
      if (D && D.converterScene) ok = !!D.converterScene(ctx, a, { topo: 'buck', phase: on ? 'on' : 'off', d: c.D, uIn: ctl.uin, uOut: c.Uabs, iL: on ? c.ILmax : c.ILmin }, opts2);
      if (!ok) B.gfx.text(ctx, 'Tiefsetzsteller · D ' + fm(c.D * 100, 1) + ' %', a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
      const wv = r.wv, stride = Math.max(1, Math.ceil(wv.t.length / sc.qp.pts));
      const pts = arr => { const o = []; for (let i = 0; i < wv.t.length; i += stride) o.push([wv.t[i] * 1e-6, arr[i]]); return o; };
      const ser = n => wv.series.find(q => q.name === n).y;
      let ok2 = false;
      if (D && D.scope) ok2 = !!D.scope(ctx, s, { traces: [{ name: 'u_sw', unit: 'V', color: 'sw', points: pts(ser('u_sw')) }, { name: 'i_L', unit: 'A', color: 'il', points: pts(ser('i_L')) }, { name: 'u_C', unit: 'V', color: 'out', points: pts(ser('u_C')) }], beam: sc.beam }, opts2);
      if (!ok2) B.gfx.text(ctx, 'ΔI_L ' + eng(c.dIL, 'A') + ' · ΔU ' + eng(c.dU, 'V'), s.x, s.y + 20, { size: sc.fs, color: pal.fg, max: s.w });
      /* Verlustposten (Einzelverluste aus loss.parts), Balken je Posten */
      const fs = sc.fs, p = r.ls, items = [['Leitung', p.leitung], ['Diode', p.diode], ['Schalten', p.schalt], ['Gate', p.gate], ['Drossel', p.drossel]];
      const mx = Math.max(p.Pv, 1e-12), rowH = Math.max(fs + 8, Math.min(24, (v.h - 4) / items.length));
      items.forEach((q, i) => {
        const y = v.y + 2 + i * rowH;
        if (y + rowH > v.y + v.h + 1) return;
        B.gfx.text(ctx, q[0], v.x + 4, y + fs, { size: fs, color: pal.mute, max: v.w * 0.26 });
        B.gfx.bar(ctx, v.x + v.w * 0.28, y + 2, v.w * 0.46, fs + 2, q[1], mx, pal.loss, pal);
        B.gfx.text(ctx, eng(q[1], 'W'), v.x + v.w * 0.76, y + fs, { size: fs, color: pal.fg, max: v.w * 0.24 - 2 });
      });
      sc.block(b);
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, state, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'buck', name: 'Tiefsetzsteller', icon: '⬇️', info: 'Tiefsetzsteller mit Schalter, Drossel, Diode und Kondensator: Tastverhältnis, Drosselwelligkeit, lückender Betrieb, Wirkungsgrad.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'buck', name: 'Tiefsetzsteller', icon: '⬇️', info: 'Tiefsetzsteller', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
