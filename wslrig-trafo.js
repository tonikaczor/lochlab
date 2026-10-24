/* wslrig-trafo.js - WSL-Lab (WP2d): Pruefstand 7 `trafo` - Transformator (SPEC 5.7).
 * Die gemeinsame Huelle liegt in wslrig-base.js: Diese Datei im Browser NACH wslrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (WSL_CORE.trafo.ideal / real / load / dc); hier steht keine zweite Formel.
 * Alle Zahlen sind Uebungswerte (Uebungsschaltung, F8). Simulation, kein Hinweis fuer Arbeiten an Netzspannung. Modell: Lehrmodell, Beharrungszustand.
 * Steuerwerte: u1 (V), n1, n2 (Windungen), rlast (Ohm; oberer Anschlag = Leerlauf), modus (ideal, real), sn (VA), r1, r2 (Ohm), pfe (W) (Uebungswerte, nur real bzw. Gleichspannung),
 *   dc (wechsel, gleich: Fehlerbild), ziel (V, Vorgabe Sekundaerspannung, 0 = keine Vorgabe), Taste fire (Last zuschalten, Rechenvorgang ueber 3 s).
 * Messgeraete: u2, i2, i1, ueb, p1, p2, eta. Bei Gleichspannung: u2, i2 = 0, i1 = U / R1 (Fehlerbild, nur Simulation). Wirft nie.
 * Zeigerbild: U1, Phi (um 90 Grad nacheilend, Massstab frei), U2; Kennlinien U2(I2) und eta(I2) aus WSL_CORE.trafo.load bzw. ideal.
 */
(function (root) {
  'use strict';
  const R = root.WSL_RIGS = root.WSL_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./wslrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('wslrig-trafo.js: Die Basis wslrig-base.js fehlt (bitte davor laden).'); return; }
  const { clamp, num, fm, isNum, eng, val } = B;

  let C0 = null; try { C0 = B.core(); } catch (e) { C0 = null; }
  const T0 = (C0 && C0.TEXTS) || {};
  const K = fn => { try { return C0 ? fn(C0) : ''; } catch (e) { return ''; } };
  const MODELL = T0.trafoModell || 'Trafo-Lehrmodell: Wicklungswiderstände, konstanter Eisenverlust und Kurzschlussspannung als Übungswerte; kein Anlauf-, Sättigungs- oder Kurzschlussmodell.';
  const UN = K(c => c.limit('u_netz').value) || 230;       // Nennspannung der Primaerseite (belegt, limits)
  const PFE0 = K(c => c.limit('trafo_pfe').value);          // Eisenverlust (Uebungswert A, F8)
  const RMAX = 10000;                                        // oberer Anschlag des Lastwiderstands = Leerlauf
  const RAMP_S = 3;                                          // Dauer des Zuschaltens (s, Zeitlupe verlaengert)
  const AM = x => (Math.abs(x) >= 1 ? fm(x, 2) : fm(x, 3)) + ' A';
  const wopt = arr => arr.map(a => ({ value: a[0], label: a[1] }));
  const UEB = 'Übungswert (F8), kein Datenblattwert.';

  const CONTROLS = B.fillControls([
    { key: 'u1', label: 'Primärspannung U₁', type: 'slider', scale: 'lin', min: 1, max: 400, step: 1, unit: 'V', unitKind: 'volt', value: 230, gruppe: 'quelle', sicht: 'zeiger',
      help: 'Effektivwert der Wechselspannung an der Primärseite. Übungswert; die Simulation ist kein Aufbau an Netzspannung.' },
    { key: 'n1', label: 'Windungen N₁ (primär)', type: 'slider', scale: 'log', min: 10, max: 5000, step: 1, unit: '', unitKind: 'num', value: 1150, gruppe: 'bauteile', sicht: 'formel',
      help: 'Windungszahl der Primärwicklung. Das Übersetzungsverhältnis ist ü = N₁ / N₂; die Spannungen verhalten sich wie die Windungszahlen.' },
    { key: 'n2', label: 'Windungen N₂ (sekundär)', type: 'slider', scale: 'log', min: 10, max: 5000, step: 1, unit: '', unitKind: 'num', value: 69, gruppe: 'bauteile', sicht: 'formel',
      help: 'Windungszahl der Sekundärwicklung. Weniger Windungen auf der Sekundärseite ergeben eine kleinere Sekundärspannung und einen größeren Sekundärstrom.' },
    { key: 'rlast', label: 'Lastwiderstand R', type: 'slider', scale: 'log', min: 0.1, max: RMAX, step: 0.01, unit: 'Ω', unitKind: 'res', value: 5.52, gruppe: 'last', sicht: 'zeiger',
      help: 'Lastwiderstand an der Sekundärseite. Ein kleinerer Widerstand ergibt einen größeren Sekundär- und Primärstrom; die Spannungen bleiben annähernd gleich. Am oberen Anschlag (10 kΩ) ist der Transformator im Leerlauf.' },
    { key: 'modus', label: 'Modell', type: 'select', value: 'ideal', options: wopt([['ideal', 'Ideal (ohne Verluste)'], ['real', 'Lehrmodell mit Verlusten']]), gruppe: 'bauteile', sicht: 'formel',
      help: 'Ideal: nur die Übersetzung nach den Windungszahlen. Lehrmodell: Wicklungswiderstände, konstanter Eisenverlust und Kurzschlussspannung (Übungswerte); die Spannung sinkt unter Last leicht, die Verluste erwärmen.' },
    { key: 'sn', label: 'Nennleistung S_n', type: 'slider', scale: 'log', min: 1, max: 1000, step: 0.5, unit: 'VA', unitKind: 'va', value: 40, gruppe: 'bauteile', sicht: 'formel',
      visible: s => s.modus === 'real', help: 'Nennscheinleistung im Lehrmodell. Aus ihr und der Kurzschlussspannung folgt der Spannungsabfall unter Last. ' + UEB },
    { key: 'r1', label: 'Wicklungswiderstand R₁', type: 'slider', scale: 'log', min: 0.1, max: 100, step: 0.1, unit: 'Ω', unitKind: 'res', value: 25, gruppe: 'bauteile', sicht: 'formel',
      visible: s => s.modus === 'real' || s.dc === 'gleich', help: 'Wicklungswiderstand der Primärseite (Kupferverluste P_Cu = I² · R). Bei Gleichspannung begrenzt nur er den Strom. ' + UEB },
    { key: 'r2', label: 'Wicklungswiderstand R₂', type: 'slider', scale: 'log', min: 0.001, max: 10, step: 0.001, unit: 'Ω', unitKind: 'res', value: 0.02, gruppe: 'bauteile', sicht: 'formel',
      visible: s => s.modus === 'real', help: 'Wicklungswiderstand der Sekundärseite (Kupferverluste). ' + UEB + ' Passen R₁, R₂ und die Kurzschlussspannung nicht zusammen, meldet der Prüfstand das.' },
    { key: 'pfe', label: 'Eisenverlust P_Fe', type: 'slider', scale: 'lin', min: 0, max: 50, step: 0.1, unit: 'W', unitKind: 'watt', value: PFE0 > 0 ? PFE0 : 3, gruppe: 'bauteile', sicht: 'formel',
      visible: s => s.modus === 'real', help: 'Eisenverlust im Leerlauf (Lehrmodell, wächst mit dem Quadrat der Primärspannung). ' + UEB },
    { key: 'dc', label: 'Spannungsart', type: 'select', value: 'wechsel', options: wopt([['wechsel', 'Wechselspannung'], ['gleich', 'Gleichspannung (Fehlerbild)']]), gruppe: 'quelle', sicht: 'zeit',
      help: 'Gleichspannung am Netztransformator ist ein Fehlerbild und nur Simulation: Ohne Wechselfeld gibt es keine Sekundärspannung und keinen induktiven Widerstand; der Strom wird nur vom Wicklungswiderstand begrenzt, die Wicklung ist gefährdet.' },
    { key: 'ziel', label: 'Vorgabe Spannung U₂', type: 'slider', scale: 'lin', min: 0, max: 400, step: 0.01, unit: 'V', unitKind: 'volt', value: 0, gruppe: 'ziel', sicht: null,
      help: 'Vorgabe für die Sekundärspannung U₂. Bei 0 V ist keine Vorgabe gesetzt und die Ampel bleibt grau. Die Ampelfenster sind Lehrfaustwerte.' },
    { key: 'fire', label: 'Last zuschalten', type: 'button', gruppe: 'ziel', sicht: 'zeiger',
      help: 'Schaltet die eingestellte Last zu: Der Transformator läuft erst im Leerlauf, dann steigen Sekundär- und Primärstrom. Im Lehrmodell sinkt U₂ dabei leicht. Ein zweiter Druck bricht ab.' }
  ]);
  const METERS = [
    { key: 'u2', label: 'Sekundärspannung U₂', unit: 'V', digits: 2, min: 0, max: 400, zeroIsNone: true, help: 'Effektivwert der Sekundärspannung; im Lehrmodell unter Last etwas kleiner als im Leerlauf.' },
    { key: 'i2', label: 'Sekundärstrom I₂', unit: 'A', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Strom durch die Last an der Sekundärseite.' },
    { key: 'i1', label: 'Primärstrom I₁', unit: 'A', digits: 3, min: 0, max: 100, zeroIsNone: true, help: 'Strom an der Primärseite; beim idealen Transformator I₁ = I₂ · N₂ / N₁. Bei Gleichspannung ist es der Fehlerstrom U / R₁.' },
    { key: 'ueb', label: 'Übersetzung ü', unit: '', digits: 3, min: 0, max: 500, zeroIsNone: true, help: 'ü = N₁ / N₂. Bei Gleichspannung gilt die Übersetzung nicht (Anzeige 0).' },
    { key: 'p1', label: 'Primärleistung P₁', unit: 'W', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Aufgenommene Wirkleistung. Im Lehrmodell die Summe aus P₂, P_Cu und P_Fe.' },
    { key: 'p2', label: 'Sekundärleistung P₂', unit: 'W', digits: 2, min: 0, max: 1000, zeroIsNone: true, help: 'Abgegebene Wirkleistung an der Last.' },
    { key: 'eta', label: 'Wirkungsgrad η', unit: '%', digits: 1, min: 0, max: 100, zeroIsNone: true, help: 'η = P₂ / P₁. Der ideale Transformator hat 100 %; das Maximum des Lehrmodells liegt dort, wo P_Cu = P_Fe ist.' }
  ];
  const PRESETS = [
    { id: 'klingel', name: 'Klingeltrafo', info: 'Übungsschaltung: ' + K(c => { const q = c.trafo.ideal({ u1: 230, n1: 1150, n2: 40, rlast: 8 }); return 'Aus 230 V werden bei N₁ = 1150 und N₂ = 40 ' + val(q.u2, 'V', 1) + '; bei 8 Ω fließen ' + AM(q.i2) + ' sekundär und ' + AM(q.i1) + ' primär.'; }),
      controls: { modus: 'ideal', dc: 'wechsel', u1: 230, n1: 1150, n2: 40, rlast: 8 } },
    { id: 'labor-230-12', name: 'Kleintrafo 230/12 V', info: 'Übungsschaltung (Lehrmodell): ' + K(c => { const q = c.trafo.real({ u1: 230, n1: 1150, n2: 60, sn: 30, r1: 25, r2: 0.02, u1n: UN, pfe: PFE0, rlast: 4.8 }); return q && q.ok ? 'Bei 230 V, N₂ = 60 und 4,8 Ω ist U₂ = ' + val(q.u2, 'V', 2) + ' (Leerlauf ' + val(q.u20, 'V', 2) + '), I₂ = ' + AM(q.i2) + ', η = ' + fm(q.etaProzent, 1) + ' %.' : ''; }),
      controls: { modus: 'real', dc: 'wechsel', u1: 230, n1: 1150, n2: 60, rlast: 4.8, sn: 30, r1: 25, r2: 0.02, pfe: PFE0 > 0 ? PFE0 : 3 } },
    { id: 'leerlauf', name: 'Leerlauf', info: 'Übungsschaltung (Lehrmodell): Ohne Last fließt sekundär kein Strom; primär nimmt der Transformator nur die Eisenverluste auf.',
      controls: { modus: 'real', dc: 'wechsel', u1: 230, n1: 1150, n2: 69, rlast: RMAX, sn: 30, r1: 25, r2: 0.02, pfe: PFE0 > 0 ? PFE0 : 3 } },
    { id: 'last-doppelt', name: 'Last verdoppelt', info: 'Übungsschaltung (Pool H2022-N07, H2021-N02): ' + K(c => { const a = c.trafo.ideal({ u1: 230, n1: 1150, n2: 69, rlast: 5.52 }), b = c.trafo.ideal({ u1: 230, n1: 1150, n2: 69, rlast: 2.76 }); return 'Der halbe Lastwiderstand (2,76 Ω statt 5,52 Ω) verdoppelt den Strom: I₂ von ' + AM(a.i2) + ' auf ' + AM(b.i2) + ', I₁ von ' + AM(a.i1) + ' auf ' + AM(b.i1) + '; die Spannungen bleiben gleich.'; }),
      controls: { modus: 'ideal', dc: 'wechsel', u1: 230, n1: 1150, n2: 69, rlast: 2.76 } },
    { id: 'gleichspannung', name: 'Gleichspannung (Fehlerbild)', info: 'Fehlerbild (Pool F2023-N17, nur Simulation): ' + K(c => { const q = c.trafo.dc({ u: 230, rw: 25 }); return q && q.ok ? 'Bei Gleichspannung fließt nur U / R₁ = ' + AM(q.i) + ' bei R₁ = 25 Ω; es gibt keine Sekundärspannung, die Wicklung ist gefährdet.' : ''; }),
      controls: { modus: 'real', dc: 'gleich', u1: 230, n1: 1150, n2: 69, rlast: 5.52, sn: 30, r1: 25, r2: 0.02, pfe: PFE0 > 0 ? PFE0 : 3 } }
  ];
  const SICHT = { zeit: 'Der Fluss Φ pulsiert im Kern', zeiger: 'U₁, Φ und U₂ als Zeiger', formel: 'U₁ / U₂ = N₁ / N₂ = I₂ / I₁' };
  const INFO = 'Transformator mit Übersetzung, Last und Verlusten. ' + MODELL + ' Gleichspannung am Netztransformator ist nur ein Fehlerbild der Simulation.';

  function plant(P0) {
    const CORE = P0.CORE;
    const sw = { active: false, p: 1 };
    const fmt = (x, d) => { try { return CORE.fmt(x, d); } catch (e) { return fm(x, d); } };

    function realCfg(ctl, rl) {
      const cfg = { u1: ctl.u1, n1: ctl.n1, n2: ctl.n2, sn: ctl.sn, r1: ctl.r1, r2: ctl.r2, u1n: UN, pfe: ctl.pfe };
      if (rl !== undefined) cfg.rlast = rl;
      return cfg;
    }
    /** Betriebspunkt bei Lastfaktor p (0 = Leerlauf, 1 = eingestellte Last); alles aus dem Kern. */
    function calc(ctl, p) {
      const leer = !(p > 1e-3) || ctl.rlast >= RMAX, rl = leer ? undefined : ctl.rlast / p;
      if (ctl.modus === 'real') {
        const q = CORE.trafo.real(realCfg(ctl, rl));
        if (!q || q.ok === false || q.valid === false) return { ok: false, why: (q && (q.why || q.text)) || CORE.TEXTS.eingabe, mode: 'real' };
        return { ok: true, mode: 'real', leer, q, ueb: q.ueb, u20: q.u20, u2: q.u2, i2: q.i2, i1: q.i1, p1: q.p1, p2: q.p2, eta: q.etaProzent, pcu: q.pcu, pfe: q.pfe, du: q.duProzent };
      }
      const q = CORE.trafo.ideal(leer ? { u1: ctl.u1, n1: ctl.n1, n2: ctl.n2, i2: 0 } : { u1: ctl.u1, n1: ctl.n1, n2: ctl.n2, rlast: rl });
      if (!q || q.ok === false || q.valid === false) return { ok: false, why: (q && (q.why || q.text)) || CORE.TEXTS.eingabe, mode: 'ideal' };
      const pw = isNum(q.p) ? q.p : 0;
      return { ok: true, mode: 'ideal', leer, q, ueb: q.ueb, u20: q.u2, u2: q.u2, i2: isNum(q.i2) ? q.i2 : 0, i1: isNum(q.i1) ? q.i1 : 0, p1: pw, p2: pw, eta: pw > 0 ? 100 : 0, pcu: 0, pfe: 0, du: 0 };
    }
    function compute(ctl) {
      if (ctl.dc === 'gleich') {
        const d = CORE.trafo.dc({ u: ctl.u1, rw: ctl.r1 });
        const ac = calc(ctl, sw.p);
        if (!d || d.ok === false) return { ok: false, dc: true, why: (d && d.why) || CORE.TEXTS.eingabe };
        return { ok: true, dc: true, d, why: d.why, ac: ac.ok ? ac : null };
      }
      const r = calc(ctl, sw.p);
      r.dc = false;
      return r;
    }
    function meters(r, ctl) {
      const z = { u2: 0, i2: 0, i1: 0, ueb: 0, p1: 0, p2: 0, eta: 0 };
      if (!r.ok) return z;
      if (r.dc) { z.i1 = r.d.i; return z; }                              // Fehlerbild: nur der Strom U / R1 aus dem Kern, keine Leistungsrechnung
      return { u2: r.u2, i2: r.i2, i1: r.i1, ueb: r.ueb, p1: r.p1, p2: r.p2, eta: r.eta };
    }
    function assess(r, ctl) {
      if (!r.ok) return { ok: false, ampel: 'rot', text: r.why };
      if (r.dc) return { ok: false, ampel: 'rot', text: 'Gleichspannung: Es gibt keine Sekundärspannung, die Vorgabe U₂ = ' + val(ctl.ziel, 'V') + ' ist nicht erreichbar.' };
      const soll = ctl.ziel, ist = r.u2, pct = Math.abs(ist - soll) / soll * 100;
      const amp = B.devAmpel(pct, CORE);
      let text = B.devText('Sekundärspannung', ist, soll, 'V', pct, CORE);
      if (amp === 'gruen') text += ' Die Vorgabe ist erreicht.';
      else text += ist < soll ? ' Die Sekundärspannung ist zu klein.' : ' Die Sekundärspannung ist zu groß.';
      return { ok: amp === 'gruen', ampel: amp, text, margin: pct, ziel: { text: 'Sekundärspannung ' + val(soll, 'V'), soll, ist, unit: 'V' } };
    }
    function diag(r, ctl) {
      const out = [];
      if (!r.ok) { out.push({ id: 'ungueltig', kind: 'error', text: r.why }); return out; }
      if (r.dc) {
        out.push({ id: 'gleichspannung', kind: 'error', text: r.why });
        if (r.ac) out.push({ id: 'vergleich', kind: 'info', text: 'Zum Vergleich: Bei Wechselspannung fließt im eingestellten Betriebspunkt nur I₁ = ' + AM(r.ac.i1) + '.' });
        return out;
      }
      if (r.leer) out.push({ id: 'leerlauf', kind: 'info', text: 'Leerlauf: Sekundär fließt kein Strom' + (r.mode === 'real' ? '; primär nimmt der Transformator nur I₁ = ' + AM(r.i1) + ' für den Eisenverlust auf.' : ', und der ideale Transformator nimmt auch primär nichts auf.') });
      if (r.mode === 'real') {
        if (!r.leer && r.du > 0) out.push({ id: 'abfall', kind: 'info', text: 'Unter Last sinkt U₂ von ' + val(r.u20, 'V') + ' (Leerlauf) auf ' + val(r.u2, 'V') + ' (Abfall ' + fm(r.du, 2) + ' %); P_Cu = ' + val(r.pcu, 'W') + ', P_Fe = ' + val(r.pfe, 'W') + '.' });
        const s2 = r.u2 * r.i2;
        if (s2 > ctl.sn * (1 + 1e-9)) out.push({ id: 'ueberlast', kind: 'warn', text: 'Die Sekundärscheinleistung ' + val(s2, 'VA') + ' liegt über der Nennleistung ' + val(ctl.sn, 'VA') + ' (Übungswert): Der Transformator wäre überlastet und erwärmt sich stark (Lehrmodell).' });
      }
      if (sw.active) out.push({ id: 'zuschalten', kind: 'info', text: 'Die Last wird zugeschaltet (' + fm(sw.p * 100, 0) + ' %).' });
      return out;
    }
    function phasors(r, ctl) {
      if (!r.ok) return { ok: false, why: r.why };
      if (r.dc) return { ok: false, why: 'Gleichspannung: kein Wechselfluss, daher kein Zeigerbild.' };
      if (!(ctl.u1 > 0)) return { ok: false, why: CORE.TEXTS.eingabe };
      // U1 und U2 sind in Phase, der Fluss eilt der Spannung um 90 Grad nach (u = N dPhi/dt); Phi hat freien Massstab
      const list = [{ name: 'U₁', len: ctl.u1, angle: 0, kind: 'u' }, { name: 'Φ (Maßstab frei)', len: ctl.u1 * 0.8, angle: -90, kind: 's' }, { name: 'U₂', len: r.u2, angle: 0, kind: 'p' }];
      return { ok: true, art: 'trafo', bezug: 'spannung', effektiv: true, unit: 'V', list };
    }
    function curves(r, ctl) {
      if (!r.ok || r.dc) return [];
      const out = [];
      let xs = [], us = [], es = [], opt = null;
      if (r.mode === 'real') {
        const L = CORE.trafo.load(Object.assign(realCfg(ctl), { n: 41 }));
        if (!L || L.ok === false) return [];
        xs = L.i2; us = L.u2; es = L.eta.map(e => e * 100); opt = L.opt || null;
      } else {
        const top = Math.max(r.i2 * 1.5, 0.1);
        for (let k = 0; k <= 20; k++) { const x = top * k / 20, q = CORE.trafo.ideal({ u1: ctl.u1, n1: ctl.n1, n2: ctl.n2, i2: x }); if (q && q.ok !== false && isNum(q.u2)) { xs.push(x); us.push(q.u2); } }
      }
      const mk = (x, y, lab) => ({ x, y, label: lab });
      out.push({ id: 'u2i2', title: 'Sekundärspannung über dem Sekundärstrom', xLabel: 'Sekundärstrom I₂', xUnit: 'A', xScale: 'lin', yLabel: 'Sekundärspannung U₂', yUnit: 'V',
        series: [{ name: 'U₂', points: xs.map((x, k) => [x, us[k]]) }], marker: mk(r.i2, r.u2, 'jetzt') });
      if (r.mode === 'real') {
        const c = { id: 'eta', title: 'Wirkungsgrad über dem Sekundärstrom', xLabel: 'Sekundärstrom I₂', xUnit: 'A', xScale: 'lin', yLabel: 'Wirkungsgrad η', yUnit: '%',
          series: [{ name: 'η', points: xs.map((x, k) => [x, es[k]]) }], marker: mk(r.i2, r.eta, 'jetzt') };
        if (opt) c.marks = [{ x: opt.i2, label: 'η max (P_Cu = P_Fe)' }];
        out.push(c);
      }
      return out;
    }
    function state(r, ctl) {
      const base = { modus: ctl.modus, gleich: ctl.dc === 'gleich', zuschalten: sw.active, last: sw.p, hinweis: MODELL, uk: K(c => c.limit('trafo_uk').value) };
      if (!r.ok) return Object.assign(base, { valid: false, why: r.why, text: r.why });
      if (r.dc) return Object.assign(base, { valid: false, why: r.why, text: r.why, iGleich: r.d.i, iWechsel: r.ac ? r.ac.i1 : 0 });
      return Object.assign(base, { valid: true, text: r.q.text, ueb: r.ueb, u20: r.u20, u2: r.u2, i1: r.i1, i2: r.i2, p1: r.p1, p2: r.p2, etaProzent: r.eta, duProzent: r.du, pcu: r.pcu, pfe: r.pfe, leerlauf: r.leer, s2: r.u2 * r.i2 });
    }
    function wrapLines(ctx, g, s, w, size, maxLines) {
      ctx.font = g.font(size, false);
      const words = String(s).split(' '), lines = []; let cur = '';
      words.forEach(wd => {
        const t = cur ? cur + ' ' + wd : wd;
        if (!cur || ctx.measureText(t).width <= w) cur = t; else { lines.push(cur); cur = wd; }
      });
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines);
    }
    function draw(ctx, w, h, t, view, sc) {
      const r = view.res, pal = sc.pal, R0 = sc.rect, gap = 8, g = sc.gfx;
      if (!r || !r.ok) {
        const ls = wrapLines(ctx, g, (r && r.why) || '', R0.w - 16, 13, 6);
        ls.forEach((l, k) => g.text(ctx, l, R0.x + 8, R0.y + 20 + k * 18, { size: 13, color: pal.fg, max: R0.w - 16 }));
        return;
      }
      const ctl = view.ctl, chipsH = R0.h >= 330 ? 30 : 0, bodyH = R0.h - chipsH - gap, wide = R0.w >= 680;
      let cR, sR, pR;
      if (wide) {
        const lw = Math.round(R0.w * 0.5) - gap / 2, rw = R0.w - lw - gap, h1 = Math.round(bodyH * 0.36);
        cR = { x: R0.x, y: R0.y, w: lw, h: bodyH }; sR = { x: R0.x + lw + gap, y: R0.y, w: rw, h: h1 }; pR = { x: R0.x + lw + gap, y: R0.y + h1 + gap, w: rw, h: bodyH - h1 - gap };
      } else {
        const hs = [0.44, 0.18, 0.38].map(q => Math.round(bodyH * q) - gap);
        let y = R0.y;
        cR = { x: R0.x, y, w: R0.w, h: hs[0] }; y += hs[0] + gap; sR = { x: R0.x, y, w: R0.w, h: hs[1] }; y += hs[1] + gap; pR = { x: R0.x, y, w: R0.w, h: hs[2] };
      }
      const dcOn = !!r.dc;
      const cd = { n1: ctl.n1, n2: ctl.n2, u1: ctl.u1, dc: dcOn };
      if (dcOn) { cd.i1 = r.d.i; } else { cd.u2 = r.u2; cd.i1 = r.i1; cd.i2 = r.i2; if (r.mode === 'real') cd.loss = { cu: r.pcu, fe: r.pfe }; }
      if (!sc.view('trafoCore', cR, cd, {})) {
        g.panel(ctx, cR.x, cR.y, cR.w, cR.h, pal.panel, pal.line, 6);
        g.text(ctx, 'Transformator: N₁ = ' + ctl.n1 + ', N₂ = ' + ctl.n2, cR.x + 10, cR.y + 22, { size: 12, color: pal.fg, max: cR.w - 20 });
        if (!dcOn) g.text(ctx, 'U₂ = ' + val(r.u2, 'V') + ', I₂ = ' + val(r.i2, 'A'), cR.x + 10, cR.y + 42, { size: 12, color: pal.fg, max: cR.w - 20 });
      }
      sc.view('schematic', sR, { kind: 'trafo', labels: { u: 'U₁ = ' + val(ctl.u1, 'V'), n1: 'N₁ = ' + fm(ctl.n1, 0), n2: 'N₂ = ' + fm(ctl.n2, 0), r: ctl.rlast >= RMAX ? 'Leerlauf' : 'R = ' + eng(ctl.rlast, 'Ω') } }, {});
      const ph = phasors(r, ctl);
      if (ph.ok) sc.view('phasor', pR, { list: ph.list, unit: 'V', bezug: 'spannung', rotate: true, project: false }, {});
      else {
        g.panel(ctx, pR.x, pR.y, pR.w, pR.h, pal.panel, pal.line, 6);
        const ls = wrapLines(ctx, g, ph.why || '', pR.w - 20, 12, 4);
        ls.forEach((l, k) => g.text(ctx, l, pR.x + 10, pR.y + 24 + k * 16, { size: 12, color: pal.bad, max: pR.w - 20 }));
      }
      if (chipsH) {
        const y = R0.y + bodyH + gap;
        const items = dcOn ? [['U₁', val(ctl.u1, 'V')], ['U₂', '0 V'], ['I₁ (Fehlerbild)', val(r.d.i, 'A')]] : [['ü', fm(r.ueb, 2)], ['U₂', val(r.u2, 'V')], ['I₁', val(r.i1, 'A')], ['η', fm(r.eta, 1) + ' %']];
        const cw = (R0.w - gap * (items.length - 1)) / items.length;
        items.forEach((it, k) => g.chip(ctx, it[0], it[1], R0.x + k * (cw + gap), y, cw, chipsH - 2, pal, { size: 12 }));
      }
    }
    return {
      compute, meters, assess, diag, curves, phasors, state, draw,
      phaseHz: () => 0.15,
      step(dtMs, r, ctl) {
        if (!sw.active) return;
        sw.p += dtMs / (RAMP_S * 1000);
        if (sw.p >= 1) {
          sw.p = 1; sw.active = false;
          const a = calc(ctl, 0), b = calc(ctl, 1);
          if (a.ok && b.ok && ctl.dc !== 'gleich') P0.say('Die Last ist zugeschaltet: U₂ ist von ' + val(a.u2, 'V') + ' (Leerlauf) auf ' + val(b.u2, 'V') + ' gegangen, I₂ beträgt ' + AM(b.i2) + ' und I₁ ' + AM(b.i1) + '.', 'info');
          else P0.say('Das Zuschalten der Last ist beendet.', 'info');
        }
        P0.bump();
      },
      fire(r, ctl) {
        if (sw.active) { sw.active = false; sw.p = 1; P0.say('Das Zuschalten der Last wurde abgebrochen.', 'info'); return true; }
        if (ctl.dc === 'gleich') { P0.say('Bei Gleichspannung gibt es keine Sekundärspannung, die Last hat nichts zu übernehmen.', 'warn'); return false; }
        if (ctl.rlast >= RMAX) { P0.say('Es ist keine Last eingestellt (Leerlauf): Stelle einen kleineren Lastwiderstand ein.', 'warn'); return false; }
        sw.active = true; sw.p = 0;
        P0.say('Die Last wird zugeschaltet: erst Leerlauf, dann steigt der Strom.', 'info');
        return true;
      },
      reset() { sw.active = false; sw.p = 1; },
      onControl(key) { if (key === 'rlast' || key === 'modus' || key === 'dc' || key === '*') { sw.active = false; sw.p = 1; } }
    };
  }

  R.register({ id: 'trafo', name: 'Transformator', icon: '🔄', info: INFO, controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'trafo', name: 'Transformator', icon: '🔄', info: INFO, world: { w: 960, h: 640 }, sicht: SICHT, controls: CONTROLS, meters: METERS, presets: PRESETS,
      zielKeys: ['ziel'], params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
