/* ntsrig-topo.js - Netzteil-Lab (WP2c): Pruefstand 5 `topo` - Hochsetzsteller, Inverswandler, Sperrwandler (SPEC 5.5).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.boost / bb / fly .ccm und .wave, NTS_CORE.topology, NTS_CORE.loss.parts / curve, NTS_CORE.fly.power); hier steht keine zweite Formel.
 * Alle Zahlen sind ideales Lehrmodell mit Uebungswerten fuer die Verluste (limits, Status A); der Eingang ist Gleichspannung bis 60 V (limits u_dc_max): Kleinspannung.
 * Der Sperrwandler am Netz ist NUR Begriff; der Pruefstand rechnet ihn mit Kleinspannung am Eingang. Simulation, keine Anleitung fuer Arbeiten an Netzspannung.
 * Steuerwerte: topo (boost/invers/sperr), uin (V), uout (V, Betrag), f (Hz, log), l (µH, log), c (µF, log), iout (A), n (N2/N1, nur Sperrwandler), Taste fire (Lastsprung).
 * Messgeraete: d (%), iL (A), dIL (A; im Lueckbetrieb der Spitzenstrom), iLmax (A), dU (mV), eta (%), trennung (1 ja, 0 nein), modus (0 nicht lueckend, 1 lueckend). Wirft nie.
 * Lastsprung (fire): Last auf das Doppelte (ueber 1,5 A auf die Haelfte); beide Arbeitspunkte kommen aus dem Kern, der Pruefstand zeigt den Vergleich als Meldung.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-topo.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, fm, eng } = B;

  const G_E = 'Eingang und Transformator', G_G = 'Gleichrichtung und Siebung', G_R = 'Regelung', G_S = 'Schalten und Gate', G_L = 'Last und Anzeige';
  const opt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const KIND = { boost: 'boost', invers: 'bb', sperr: 'fly' };
  const SCENE = { boost: 'boost', invers: 'invers', sperr: 'sperr' };
  const NAME = { boost: 'Hochsetzsteller', invers: 'Inverswandler', sperr: 'Sperrwandler' };

  const CONTROLS = [
    { key: 'topo', label: 'Grundschaltung', type: 'select', value: 'boost', options: opt([['boost', 'Hochsetzsteller'], ['invers', 'Inverswandler'], ['sperr', 'Sperrwandler']]), stufe: 'schalt', group: G_S,
      help: 'Hochsetzsteller: Ausgang größer als Eingang, gleiches Vorzeichen. Inverswandler: Ausgang mit umgekehrtem Vorzeichen. Sperrwandler: Übertrager mit Luftspalt, Eingang und Ausgang sind getrennt. Netzseitig nur Begriff, der Prüfstand rechnet mit Kleinspannung.' },
    { key: 'uin', label: 'Eingangsspannung U_ein (Gleichspannung)', type: 'slider', scale: 'lin', min: 3, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: 5, stufe: 'gleich', group: G_E,
      help: 'Gleichspannung am Eingang des Wandlers, zum Beispiel hinter Gleichrichter und Ladekondensator. Das Modell rechnet nur mit Kleinspannung bis 60 V. Bei gleicher Ausgangsspannung ändert eine größere Eingangsspannung das Tastverhältnis.' },
    { key: 'uout', label: 'Ausgangsspannung U_aus (Betrag)', type: 'slider', scale: 'lin', min: 3, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: 12, stufe: 'regel', group: G_R,
      help: 'Sollwert der Ausgangsspannung als Betrag. Die Regelung stellt das Tastverhältnis so ein, dass der Wert erreicht wird. Beim Inverswandler ist der Ausgang gegenüber dem Eingang negativ, die Zahl bleibt der Betrag. Der Hochsetzsteller braucht einen Wert über der Eingangsspannung.' },
    { key: 'f', label: 'Schaltfrequenz f', type: 'slider', scale: 'log', min: 20000, max: 500000, step: 1000, unit: 'Hz', unitKind: 'freq', value: 100000, stufe: 'schalt', group: G_S,
      help: 'Taktfrequenz des Schalters. Eine höhere Schaltfrequenz verkleinert die Drosselwelligkeit, erhöht aber Schalt- und Gate-Verluste. Vorgabe 100 kHz (Übungswert).' },
    { key: 'l', label: 'Drossel L', type: 'slider', scale: 'log', min: 10, max: 1000, step: 1, unit: 'µH', unitKind: 'ind', value: 100, stufe: 'schalt', group: G_S,
      help: 'Induktivität der Speicherdrossel (beim Sperrwandler die Primärinduktivität des Übertragers). Eine größere Drossel verkleinert die Drosselwelligkeit ΔI_L, eine zu kleine führt zum Lückbetrieb. Vorgabe 100 µH (Übungswert).' },
    { key: 'c', label: 'Ausgangskondensator C', type: 'slider', scale: 'log', min: 10, max: 1000, step: 1, unit: 'µF', unitKind: 'cap', value: 100, stufe: 'sieb', group: G_G,
      help: 'Kapazität am Ausgang. Der Kondensator glättet die Ausgangsspannung: Mit größerem C sinkt der Kapazitätsanteil der Welligkeit. Der ESR-Anteil (Übungswert) bleibt. Vorgabe 100 µF (Übungswert).' },
    { key: 'iout', label: 'Ausgangsstrom I_aus', type: 'slider', scale: 'lin', min: 0.05, max: 3, step: 0.05, unit: 'A', unitKind: 'amp', value: 0.5, stufe: 'last', group: G_L,
      help: 'Strom, den die Last am Ausgang entnimmt. Bei zu kleinem Strom lückt die Drossel (der Drosselstrom fällt auf null), die Formeln für nicht lückenden Betrieb gelten dann nicht mehr. Vorgabe 0,5 A.' },
    { key: 'n', label: 'Übersetzung N2 / N1 (nur Sperrwandler)', type: 'slider', scale: 'lin', min: 0.25, max: 4, step: 0.05, unit: '', unitKind: 'plain', value: 1, stufe: 'schalt', group: G_S, visible: st => st && st.topo === 'sperr',
      help: 'Windungsverhältnis des Übertragers des Sperrwandlers. Ein größeres Verhältnis verkleinert das nötige Tastverhältnis (D = U_aus / (U_aus + n · U_ein)). Nur beim Sperrwandler wirksam.' },
    { key: 'fire', label: 'Lastsprung', type: 'button', stufe: null, group: G_L, help: 'Verdoppelt den Ausgangsstrom im Modell (über 1,5 A halbiert er ihn) und meldet den Vergleich beider Arbeitspunkte: Drosselwelligkeit, Lückbetrieb und Wirkungsgrad. Der eingestellte Wert bleibt unverändert.' }
  ];
  const lv = id => { try { return B.lim(B.core(), id); } catch (e) { return NaN; } };
  const METERS = [
    { key: 'd', label: 'Tastverhältnis D', unit: '%', digits: 1, min: 0, max: 100, help: 'Einschaltdauer des Schalters im Verhältnis zur Periode. Für nicht lückenden Betrieb aus den Spannungen gerechnet, im Lückbetrieb aus der Lückformel.' },
    { key: 'iL', label: 'Drosselstrom I_L (Mittelwert)', unit: 'A', digits: 2, min: 0, max: 40, help: 'Mittelwert des Drosselstroms. Beim Hochsetzsteller und Inverswandler fließt er größer als der Ausgangsstrom (I_aus / (1 − D)), beim Sperrwandler gilt die Primärseite.' },
    { key: 'dIL', label: 'Drosselwelligkeit ΔI_L', unit: 'A', digits: 3, min: 0, max: 20, help: 'Spitze-Spitze-Anteil des Drosselstroms. Im Lückbetrieb steht hier der Spitzenstrom, weil der Strom bis auf null fällt.' },
    { key: 'iLmax', label: 'Drosselstrom Spitze I_Lmax', unit: 'A', digits: 2, min: 0, max: 40, help: 'Größter Drosselstrom. Er darf die Sättigungsgrenze der Drossel nicht erreichen (Datenblatt maßgeblich, im Modell nicht gerechnet).' },
    { key: 'dU', label: 'Welligkeit Ausgang ΔU', unit: 'mV', digits: 1, min: 0, max: 5000, help: 'Spitze-Spitze-Welligkeit am Ausgang: Kapazitätsanteil plus ESR-Anteil (Summe, obere Näherung, ESR 50 mΩ ist ein Übungswert).' },
    { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 100, warnBelow: lv('eta_ok'), help: 'Abgegebene Leistung geteilt durch zugeführte Leistung, aus den Einzelverlusten gerechnet (Leitung, Diode, Schalten, Gate, Drossel, ESR). Alle Bauteilwerte sind Übungswerte.' },
    { key: 'trennung', label: 'Potentialtrennung (1 = ja, 0 = nein)', unit: '', digits: 0, min: 0, max: 1, help: '1 beim Sperrwandler: Der Übertrager trennt Eingang und Ausgang galvanisch. 0 bei Hochsetzsteller und Inverswandler.' },
    { key: 'modus', label: 'Betrieb (0 = nicht lückend, 1 = lückend)', unit: '', digits: 0, min: 0, max: 1, help: '1, wenn der Drosselstrom in jeder Periode auf null fällt (Lückbetrieb). Das ergibt der Vergleich von I_L mit der halben Drosselwelligkeit.' }
  ];
  const PRESETS = [
    { id: 'boost-5-12', name: 'Hochsetzsteller 5 V auf 12 V', info: 'Der Hochsetzsteller erzeugt aus 5 V die 12 V: Tastverhältnis und Drosselstrom folgen aus den Spannungen.', params: { topo: 'boost', uin: 5, uout: 12, f: 100000, l: 100, c: 100, iout: 0.5, n: 1 } },
    { id: 'invers-12-m5', name: 'Inverswandler 12 V auf −5 V', info: 'Aus +12 V entsteht −5 V (Betrag 5 V). Der Drosselstrom ist größer als der Ausgangsstrom.', params: { topo: 'invers', uin: 12, uout: 5, f: 100000, l: 220, c: 100, iout: 0.5, n: 1 } },
    { id: 'sperr-n1', name: 'Sperrwandler mit n = 1', info: 'Gleiches Tastverhältnis wie der Inverswandler, aber Eingang und Ausgang sind getrennt (Kleinspannung, Netzseite nur Begriff).', params: { topo: 'sperr', uin: 12, uout: 5, f: 100000, l: 220, c: 100, iout: 0.5, n: 1 } },
    { id: 'lueckt', name: 'Lückbetrieb bei kleiner Last', info: 'Der Hochsetzsteller bei 50 mA: Der Drosselstrom fällt auf null, die Formel für nicht lückenden Betrieb gilt nicht mehr.', params: { topo: 'boost', uin: 5, uout: 12, f: 100000, l: 100, c: 100, iout: 0.05, n: 1 } }
  ];
  const PFAD = { quelle: 'Gleichspannung bis 60 V (Kleinspannung), zum Beispiel hinter Gleichrichter und Ladekondensator', wandlung: 'Schalter, Drossel (Sperrwandler: Übertrager mit Luftspalt), Diode und Ausgangskondensator setzen die Spannung hoch oder um', senke: 'Konstanter Laststrom am Ausgang', art: 'getaktet' };
  const STUFE_VON = { leitung: 'schalt', schalt: 'schalt', gate: 'schalt', diode: 'gleich', drossel: 'sieb', kondensator: 'sieb', ruhe: 'regel' };

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);
    let jump = null;

    /* Arbeitspunkt, Verlaeufe und Verluste zu einem Satz Steuerwerte (nur Kernaufrufe) */
    function point(ctl) {
      const kind = KIND[ctl.topo], Uab = ctl.uout, Uin = ctl.uin, esr = L('esr');
      const sig = kind === 'bb' ? -Uab : Uab;
      const need = { Uin, Uout: sig, getrennt: kind === 'fly' };
      const tp = CORE.topology(need);
      const cfg = { Uin, Uout: sig, Iout: ctl.iout, Rlast: Uab / ctl.iout, f: ctl.f, L: ctl.l * 1e-6, C: ctl.c * 1e-6, esr };
      if (kind === 'fly') cfg.n = ctl.n;
      const rep = CORE[kind].ccm(cfg);
      if (!rep || rep.ok === false) return { ok: false, error: rep && rep.why || 'Eingabe', kind, tp: tp && tp.ok !== false ? tp : null, cfg };
      const lossCfg = { kind, Uin, Uout: Uab, Iout: ctl.iout, f: ctl.f, L: ctl.l * 1e-6, esr };
      if (kind === 'fly') lossCfg.n = ctl.n;
      const loss = CORE.loss.parts(lossCfg);
      return { ok: true, kind, cfg, rep, tp: tp && tp.ok !== false ? tp : null, loss: loss && loss.ok !== false ? loss : null, lossCfg, Uab, Uin, esr };
    }
    function compute(ctl) {
      const r = point(ctl);
      if (!r.ok) return r;
      r.passt = !!(r.tp && r.tp.topo === (r.kind === 'bb' ? 'bb' : r.kind));
      r.wave = CORE[r.kind].wave(r.cfg, 400);
      if (r.wave && r.wave.ok === false) r.wave = null;
      r.fly = r.kind === 'fly' && r.rep.lueckt ? CORE.fly.power({ Uin: r.Uin, D: r.rep.D, f: ctl.f, L: ctl.l * 1e-6 }) : null;
      r.dmin = L('d_min'); r.dmax = L('d_max'); r.dwarn = L('d_warn');
      return r;
    }
    function meters(r) {
      const z = { d: 0, iL: 0, dIL: 0, iLmax: 0, dU: 0, eta: 0, trennung: 0, modus: 0 };
      if (!r.ok) return z;
      const q = r.rep;
      return { d: q.D * 100, iL: q.ILavg, dIL: q.dIL, iLmax: q.ILmax, dU: q.dU * 1000, eta: r.loss ? r.loss.eta * 100 : 0, trennung: r.kind === 'fly' ? 1 : 0, modus: q.lueckt ? 1 : 0 };
    }
    /* Leistungsbilanz aus den Einzelverlusten des Kerns, Stufen: Schalter = schalt, Diode = gleich, Drossel/Kondensator = sieb, Ruhe = regel */
    function bilanz(r) {
      if (!r.ok || !r.loss) return null;
      const sum = {};
      r.loss.parts.forEach(p => { const s = STUFE_VON[p.id] || 'schalt'; sum[s] = (sum[s] || 0) + p.w; });
      const pv = ['schalt', 'gleich', 'sieb', 'regel'].filter(s => sum[s] > 0).map(s => ({ stufe: s, w: sum[s] }));
      if (!pv.length) pv.push({ stufe: 'schalt', w: 0 });
      return { pzu: r.loss.Pzu, pab: r.loss.Pab, pv, eta: r.loss.eta };
    }
    /* Ampel nach SPEC 4.10 (Zeile topo), Abweichungen in ABWEICHUNGEN WP2c: D ausserhalb 5 bis 80 % und Lueckbetrieb gelb. Vergleiche in Prozent mit Toleranz 1e-9. */
    function assess(r) {
      if (!r.ok) {
        const emp = r.tp ? ' Empfohlen: ' + r.tp.name + '.' : '';
        return { ok: false, ampel: 'rot', text: 'Topologie unmöglich oder kein Arbeitspunkt: ' + r.error + emp };
      }
      if (!r.passt) return { ok: false, ampel: 'rot', text: 'Die Grundschaltung passt nicht zur Aufgabe: ' + (r.tp ? r.tp.grund : '') };
      const dp = r.rep.D * 100, dmin = r.dmin, dmax = r.dmax, dwarn = r.dwarn;
      const bnd = fm(dmin, 0) + ' % bis ' + fm(dwarn, 0) + ' % (Lehrfaustwerte, Übungswerte)';
      const why = [];
      if (dp > dmax + 1e-9) why.push('D = ' + fm(dp, 1) + ' % liegt über ' + fm(dmax, 0) + ' %: Die Regelung hat kaum noch Spielraum.');
      else if (dp > dwarn + 1e-9) why.push('D = ' + fm(dp, 1) + ' % liegt über ' + fm(dwarn, 0) + ' %: Der Wandler ist nah an der Grenze.');
      else if (dp < dmin - 1e-9) why.push('D = ' + fm(dp, 1) + ' % liegt unter ' + fm(dmin, 0) + ' %.');
      if (r.rep.lueckt) why.push('Der Drosselstrom fällt auf 0 A (Lückbetrieb): Die Formeln für nicht lückenden Betrieb gelten nicht.');
      const margin = dp > 0 ? dwarn / dp : undefined;
      if (why.length) return { ok: false, ampel: 'gelb', text: why.join(' '), margin };
      return { ok: true, ampel: 'gruen', text: r.rep.name + ' passt zur Aufgabe, D = ' + fm(dp, 1) + ' % liegt im Bereich ' + bnd + ', der Betrieb ist nicht lückend.', margin };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) {
        out.push({ id: 'topologie-falsch', kind: 'error', text: B.msg(CORE, 'topologie-falsch', { grund: r.error + (r.tp ? ' Empfohlen: ' + r.tp.name + '.' : '') }, 'Diese Grundschaltung kann die gewünschte Ausgangsspannung nicht erzeugen: {grund}') });
        return out;
      }
      (r.rep.diag || []).forEach(d => { if (d && d.text) out.push({ id: d.id || 'diag', kind: d.kind || 'info', text: d.text, link: d.link }); });
      if (r.kind === 'bb') out.push({ id: 'invers-negativ', kind: 'info', text: 'Der Ausgang liegt gegenüber dem Eingang auf umgekehrter Polarität (' + eng(-r.Uab, 'V') + '); die Zahlen im Prüfstand sind Beträge.' });
      if (r.kind === 'fly') {
        out.push({ id: 'sperr-trennung', kind: 'info', text: 'Der Sperrwandler trennt Eingang und Ausgang durch den Übertrager. Am Netz ist er nur ein Begriff, hier rechnet das Modell mit Kleinspannung (Simulation).' });
        out.push({ id: 'sperr-streu', kind: 'info', text: 'Die Streuinduktivität des Übertragers erzeugt primärseitig Spannungsspitzen, die ein Dämpfungsglied begrenzt (nur Begriff, Link EMV).', link: 'emvlab.html' });
        if (r.fly && r.fly.ok !== false) out.push({ id: 'sperr-energie', kind: 'info', text: 'Im Lückbetrieb speichert der Übertrager je Takt ' + eng(r.fly.E, 'J') + ' und gibt im Mittel ' + eng(r.fly.P, 'W') + ' ab (Lehrmodell).' });
      }
      if (r.loss && r.loss.diag) r.loss.diag.forEach(d => { if (d && d.id && !out.some(o => o.id === d.id)) out.push({ id: d.id, kind: d.kind || 'info', text: d.text }); });
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const kind = r.kind, A = [], Dc = [], E = [];
      for (let k = 0; k <= 40; k++) {
        const l = 10 * Math.pow(100, k / 40), q = CORE[kind].ccm(Object.assign({}, r.cfg, { L: l * 1e-6 }));
        if (q && q.ok !== false) A.push([l, q.dIL]);
      }
      const sg = kind === 'bb' ? -1 : 1, noI = Object.assign({}, r.cfg); delete noI.Iout; delete noI.Rlast;
      for (let k = 0; k <= 40; k++) {
        const u = 3 + 57 * k / 40, q = CORE[kind].ccm(Object.assign({}, noI, { Uout: sg * u }));
        if (q && q.ok !== false) Dc.push([u, q.D * 100]);
      }
      const dNow = CORE[kind].ccm(Object.assign({}, noI));
      const lc = CORE.loss.curve(r.lossCfg, 'I', 0.05, 3, 40);
      if (lc && lc.ok !== false) for (let k = 0; k < lc.x.length; k++) E.push([lc.x[k], lc.eta[k] * 100]);
      const limDil = L('dil_max') * r.rep.ILavg;
      return [
        { id: 'dil-l', title: 'Drosselwelligkeit über der Drossel', xLabel: 'Drossel L', xUnit: 'µH', xScale: 'log', yLabel: 'Drosselwelligkeit ΔI_L (Lückbetrieb: Spitzenstrom)', yUnit: 'A', series: [{ name: 'ΔI_L', points: A }],
          marker: { x: ctl.l, y: r.rep.dIL, label: 'jetzt ' + eng(r.rep.dIL, 'A') }, limit: { y: limDil, label: 'Lehrfaustwert ' + fm(L('dil_max'), 1) + ' · I_L (Übungswert)' } },
        { id: 'd-uaus', title: 'Tastverhältnis über der Ausgangsspannung (nicht lückend)', xLabel: 'Ausgangsspannung U_aus (Betrag)', xUnit: 'V', xScale: 'lin', yLabel: 'Tastverhältnis D', yUnit: '%', series: [{ name: 'D', points: Dc }],
          marker: dNow && dNow.ok !== false ? { x: ctl.uout, y: dNow.D * 100, label: 'jetzt ' + fm(dNow.D * 100, 1) + ' %' } : undefined, limit: { y: r.dwarn, label: 'Lehrfaustwert ' + fm(r.dwarn, 0) + ' % (Übungswert)' } },
        { id: 'eta-i', title: 'Wirkungsgrad über dem Ausgangsstrom', xLabel: 'Ausgangsstrom I_aus', xUnit: 'A', xScale: 'lin', yLabel: 'Wirkungsgrad η', yUnit: '%', series: [{ name: 'η', points: E }],
          marker: r.loss ? { x: ctl.iout, y: r.loss.eta * 100, label: 'jetzt ' + fm(r.loss.eta * 100, 1) + ' %' } : undefined, limit: { y: L('eta_ok'), label: 'Lehrfaustwert ' + fm(L('eta_ok'), 0) + ' % (Übungswert)' } }
      ];
    }
    function waveform(r) {
      if (!r.ok || !r.wave) return null;
      const w = r.wave;
      return { tUnit: w.tUnit, t: w.t.slice(), series: w.series.map(s => ({ name: s.name, y: s.y.slice(), unit: s.unit })), marks: (w.marks || []).map(m => ({ name: m.name, value: m.t, unit: w.tUnit })) };
    }
    function state(r, ctl) {
      const o = { topoName: NAME[ctl.topo] || '', empfohlen: r.tp ? r.tp.topo : '', sprungVon: jump ? jump.von : 0, sprungNach: jump ? jump.nach : 0 };
      return o;
    }
    function fire(r, ctl) {
      if (!r.ok) { P0.say('Lastsprung nicht möglich: ' + r.error, 'warn'); return false; }
      const nach = ctl.iout <= 1.5 ? Math.min(3, ctl.iout * 2) : ctl.iout / 2;
      const r2 = point(Object.assign({}, ctl, { iout: nach }));
      jump = { von: ctl.iout, nach };
      if (!r2.ok) { P0.say('Lastsprung von ' + eng(ctl.iout, 'A') + ' auf ' + eng(nach, 'A') + ': ' + r2.error, 'warn'); return true; }
      const m1 = r.rep.lueckt ? 'lückend' : 'nicht lückend', m2 = r2.rep.lueckt ? 'lückend' : 'nicht lückend';
      const e1 = r.loss ? fm(r.loss.eta * 100, 1) + ' %' : '–', e2 = r2.loss ? fm(r2.loss.eta * 100, 1) + ' %' : '–';
      P0.say('Lastsprung von ' + eng(ctl.iout, 'A') + ' auf ' + eng(nach, 'A') + ': Betrieb ' + m1 + ' → ' + m2 + ', D ' + fm(r.rep.D * 100, 1) + ' % → ' + fm(r2.rep.D * 100, 1) + ' %, ΔI_L ' + eng(r.rep.dIL, 'A') + ' → ' + eng(r2.rep.dIL, 'A') + ', η ' + e1 + ' → ' + e2 + '.', 'info');
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal;
      if (!rc || rc.w < 140 || rc.h < 100) return;
      const wide = rc.w >= 640, gap = 8;
      let a, i2, s, b;
      if (wide) {
        const th = Math.floor(rc.h * 0.38), sh = Math.floor(rc.h * 0.30);
        a = { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.40) - gap, h: th - gap };
        i2 = { x: a.x + a.w + gap, y: rc.y, w: rc.w - a.w - gap, h: th - gap };
        s = { x: rc.x, y: rc.y + th, w: rc.w, h: sh - gap };
        b = { x: rc.x, y: rc.y + th + sh, w: rc.w, h: rc.h - th - sh };
      } else {
        const h1 = Math.floor(rc.h * 0.28), h2 = Math.floor(rc.h * 0.21), h3 = Math.floor(rc.h * 0.24);
        a = { x: rc.x, y: rc.y, w: rc.w, h: h1 - gap };
        i2 = { x: rc.x, y: rc.y + h1, w: rc.w, h: h2 - gap };
        s = { x: rc.x, y: rc.y + h1 + h2, w: rc.w, h: h3 - gap };
        b = { x: rc.x, y: rc.y + h1 + h2 + h3, w: rc.w, h: rc.h - h1 - h2 - h3 };
      }
      if (!r.ok) { B.gfx.text(ctx, r.error || 'Kein Arbeitspunkt', rc.x, rc.y + 20, { size: sc.fs, color: pal.rot, max: rc.w }); return; }
      const q = r.rep, o2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false }, D = sc.D;
      const on = sc.reduced || sc.phase < q.D;
      let ok = false;
      if (D && D.converterScene) ok = !!D.converterScene(ctx, a, { topo: SCENE[view.ctl.topo], phase: on ? 'on' : 'off', d: q.D, uIn: r.Uin, uOut: r.kind === 'bb' ? -r.Uab : r.Uab, iL: q.ILavg }, o2);
      if (!ok) B.gfx.text(ctx, r.rep.name + ' · D ' + fm(q.D * 100, 1) + ' %', a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
      ok = false;
      if (D && D.inductorCurrent) ok = !!D.inductorCurrent(ctx, i2, { iAvg: q.ILavg, dI: q.dIL, d: q.D, mode: q.lueckt ? 'dcm' : 'ccm', tf: q.lueckt ? q.D2 : undefined }, o2);
      if (!ok) B.gfx.text(ctx, 'I_L ' + eng(q.ILavg, 'A') + ' · ΔI_L ' + eng(q.dIL, 'A'), i2.x, i2.y + 20, { size: sc.fs, color: pal.fg, max: i2.w });
      ok = false;
      if (D && D.scope && r.wave) {
        const wv = r.wave, stride = Math.max(1, Math.ceil(wv.t.length / sc.qp.pts));
        const pts = arr => { const o = []; for (let k = 0; k < wv.t.length; k += stride) o.push([wv.t[k] * 1e-6, arr[k]]); return o; };
        const sr = n => wv.series.find(x => x.name === n).y;
        ok = !!D.scope(ctx, s, { traces: [{ name: 'u_sw', unit: 'V', color: 'sw', points: pts(sr('u_sw')) }, { name: 'i_L', unit: 'A', color: 'il', points: pts(sr('i_L')) }, { name: 'u_C', unit: 'V', color: 'out', points: pts(sr('u_C')) }], beam: sc.beam }, o2);
      }
      if (!ok) B.gfx.text(ctx, 'ΔU ' + eng(q.dU, 'V') + ' · f ' + eng(view.ctl.f, 'Hz'), s.x, s.y + 20, { size: sc.fs, color: pal.fg, max: s.w });
      sc.block(b);
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, fire, draw, state, phaseHz: () => 0.5, reset() { jump = null; } };
  }

  R.register({ id: 'topo', name: 'Hochsetzsteller, Inverswandler, Sperrwandler', icon: '🔀', info: 'Drei Grundschaltungen im Lehrmodell: Tastverhältnis, Drosselstrom, Lückbetrieb, Welligkeit und Wirkungsgrad.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'topo', name: 'Hochsetzsteller, Inverswandler, Sperrwandler', icon: '🔀', info: 'Grundschaltungen der Schaltregler', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
