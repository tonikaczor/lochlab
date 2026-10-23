/* ntsrig-gate.js - Netzteil-Lab (WP2c): Pruefstand 6 `gate` - Gate-Ansteuerung und Schaltverluste (SPEC 5.6).
 * Die gemeinsame Huelle liegt in ntsrig-base.js: Diese Datei im Browser NACH ntsrig-base.js laden (in Node holt sie sich die Basis per require).
 * Gerechnet wird NUR im Kern (NTS_CORE.gate.drive / switching / sweepRg / deadtime); hier steht keine zweite Formel. Die Spannungs- und Stromverlaeufe
 * (waveform) sind aus den Kernzeiten t_R, t_F, t_On, t_Off zusammengesetzte Linienzuege (Lehrmodell, nicht massstaeblich); ihre Verlustflaeche
 * ergibt je Schaltspiel genau 1/2 · U · I · (t_R + t_F) wie im Kern (Test). Alle Bauteilwerte sind Uebungswerte (limits, Status A), Datenblatt massgeblich.
 * Steuerwerte: ug (V), rg (Ohm, log), qg und qgd (nC), uin (V), i (A), f (Hz, log), halbbruecke (Totzeit-Pruefung an/aus), ton (ns, Totzeit),
 * toff (ns, Ausschaltzeit des oberen Schalters; 0 = aus Q_g und R_g gerechnet), Taste fire (Schaltvorgang, Zeitlupe).
 * Messgeraete: igPeak (A), tsw (ns), psw (mW), pg (mW), querstrom (ns Ueberlappung, 0 = keiner), tAus (ns). Wirft nie.
 * Simulation, kein Eigenbau; Bootstrap und High-Side-Treiber sind nur Begriff.
 */
(function (root) {
  'use strict';
  const R = root.NTS_RIGS = root.NTS_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id] ? this.defs[id].create(opts || {}) : null; } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.base && typeof require === 'function') { try { require('./ntsrig-base.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.base;
  if (!B) { if (typeof console !== 'undefined') console.warn('ntsrig-gate.js: Die Basis ntsrig-base.js fehlt (bitte davor laden).'); return; }
  const { isNum, fm, eng } = B;

  /* Uebungswert der Totzeit in die einzige Quelle `limits` eintragen (einmalig) */
  try {
    const C0 = B.core();
    if (C0 && Array.isArray(C0.limits) && !C0.limits.some(l => l.id === 'totzeit')) C0.limits.push({ id: 'totzeit', value: 1e-7, unit: 's', cmp: '=', status: 'A', quelle: '—', frage: 'F31', text: 'Totzeit der Halbbrücke im Gate-Prüfstand (Vorgabe).' });
  } catch (e) { /* ohne Kern keine Grenzwerte */ }
  const lv = id => { try { return B.lim(B.core(), id); } catch (e) { return NaN; } };

  const G_E = 'Eingang und Transformator', G_S = 'Schalten und Gate', G_L = 'Last und Anzeige';
  const CONTROLS = [
    { key: 'ug', label: 'Gate-Spannung U_G', type: 'slider', scale: 'lin', min: 1, max: 20, step: 0.1, unit: 'V', unitKind: 'volt', value: 10, stufe: 'schalt', group: G_S,
      help: 'Spannung, mit der der Treiber das Gate lädt. Liegt sie nicht über der Plateauspannung (Übungswert 4,5 V), schaltet der MOSFET nicht durch. Ab 2 V Reserve über dem Plateau gilt der Prüfstand als sicher geschaltet (Lehrfaustwert).' },
    { key: 'rg', label: 'Gate-Widerstand R_g', type: 'slider', scale: 'log', min: 1, max: 100, step: 0.1, unit: 'Ω', unitKind: 'res', value: 10, stufe: 'schalt', group: G_S,
      help: 'Widerstand zwischen Treiber und Gate. Ein größerer R_g begrenzt den Gate-Strom: Der MOSFET schaltet langsamer, der Schaltverlust steigt, die Störung (EMV) sinkt. Vorgabe 10 Ω (Übungswert).' },
    { key: 'qg', label: 'Gate-Ladung Q_g', type: 'slider', scale: 'lin', min: 5, max: 100, step: 1, unit: 'nC', unitKind: 'charge', value: 20, stufe: 'schalt', group: G_S,
      help: 'Gesamte Ladung, die das Gate bis zum Durchschalten braucht. Die Ladung bestimmt den Gate-Verlust P_G = Q_g · U_G · f und die Ein- und Ausschaltzeit. Vorgabe 20 nC (Übungswert, Datenblatt maßgeblich).' },
    { key: 'qgd', label: 'Gate-Drain-Ladung Q_gd', type: 'slider', scale: 'lin', min: 1, max: 30, step: 0.5, unit: 'nC', unitKind: 'charge', value: 5, stufe: 'schalt', group: G_S,
      help: 'Ladung der Miller-Kapazität: Die Ladung bestimmt die Länge des Miller-Plateaus, in dem die Drain-Source-Spannung fällt. Q_gd muss kleiner als Q_g sein. Vorgabe 5 nC (Übungswert).' },
    { key: 'f', label: 'Schaltfrequenz f', type: 'slider', scale: 'log', min: 20000, max: 500000, step: 1000, unit: 'Hz', unitKind: 'freq', value: 100000, stufe: 'schalt', group: G_S,
      help: 'Zahl der Schaltspiele je Sekunde. Schaltverlust und Gate-Verlust wachsen mit der Schaltfrequenz. Vorgabe 100 kHz (Übungswert).' },
    { key: 'uin', label: 'Schaltspannung U_ein', type: 'slider', scale: 'lin', min: 3, max: 60, step: 0.5, unit: 'V', unitKind: 'volt', value: 12, stufe: 'gleich', group: G_E,
      help: 'Spannung, die der MOSFET schaltet (Drain-Source im Aus-Zustand). Eine größere Spannung vergrößert die Verlustfläche beim Schalten. Das Modell rechnet nur mit Kleinspannung bis 60 V.' },
    { key: 'i', label: 'Schaltstrom I', type: 'slider', scale: 'lin', min: 0.1, max: 10, step: 0.1, unit: 'A', unitKind: 'amp', value: 1, stufe: 'last', group: G_L,
      help: 'Strom, den der MOSFET im Durchlass führt und beim Schalten übernimmt. Ein größerer Strom vergrößert die Verlustfläche beim Schalten.' },
    { key: 'halbbruecke', label: 'Halbbrücke mit Totzeit prüfen', type: 'switch', value: false, stufe: 'schalt', group: G_S,
      help: 'Schaltet die Prüfung einer Halbbrücke ein: Zwei Schalter in Reihe dürfen nie gleichzeitig leiten, sonst entsteht ein Querstrom (Kurzschluss der Versorgung). Bootstrap und High-Side-Treiber sind nur Begriff.' },
    { key: 'ton', label: 'Totzeit zum Einschalten des unteren Schalters', type: 'slider', scale: 'lin', min: 0, max: 500, step: 5, unit: 'ns', unitKind: 'time', value: 100, stufe: 'schalt', group: G_S, visible: st => st && st.halbbruecke === true,
      help: 'Pause zwischen dem Ausschaltbefehl des oberen und dem Einschaltbefehl des unteren Schalters. Die Totzeit muss mindestens so lang sein wie die Ausschaltzeit des oberen Schalters, sonst leiten beide gleichzeitig. Vorgabe 100 ns (Übungswert).' },
    { key: 'toff', label: 'Ausschaltzeit des oberen Schalters (0 = berechnet)', type: 'slider', scale: 'lin', min: 0, max: 300, step: 1, unit: 'ns', unitKind: 'time', value: 0, stufe: 'schalt', group: G_S, visible: st => st && st.halbbruecke === true,
      help: 'Ausschaltzeit des oberen Schalters der Halbbrücke. 0 heißt: aus Gate-Ladung und Gate-Widerstand gerechnet. Ein Wert über 0 ersetzt die Rechnung, zum Beispiel für einen Datenblattwert.' },
    { key: 'fire', label: 'Schaltvorgang (Zeitlupe)', type: 'button', stufe: null, group: G_L, help: 'Zeigt einen Einschalt- und Ausschaltvorgang in Zeitlupe und meldet Miller-Zeit, Schaltzeiten und Schaltverlust. Die Zeitachse ist ein Lehrmodell und nicht maßstäblich.' }
  ];
  const METERS = [
    { key: 'igPeak', label: 'Gate-Spitzenstrom I_g', unit: 'A', digits: 2, min: 0, max: 20, help: 'Höchster Gate-Strom beim Einschalten: U_G / R_g.' },
    { key: 'tsw', label: 'Miller-Zeit t_sw', unit: 'ns', digits: 2, min: 0, max: 600, help: 'Dauer des Miller-Plateaus beim Einschalten: Q_gd geteilt durch den Plateau-Strom (U_G − U_Plateau) / R_g. In dieser Zeit fällt die Drain-Source-Spannung.' },
    { key: 'psw', label: 'Schaltverlust P_sw', unit: 'mW', digits: 2, min: 0, max: 20000, help: 'Mittlere Verlustleistung beim Schalten: ½ · U · I · (t_R + t_F) · f. Der Verlust wächst mit der Schaltfrequenz und mit R_g.' },
    { key: 'pg', label: 'Gate-Verlust P_G', unit: 'mW', digits: 1, min: 0, max: 5000, help: 'Leistung für das Umladen des Gates: Q_g · U_G · f. Der Verlust hängt nicht vom Laststrom ab.' },
    { key: 'querstrom', label: 'Überlappung der Schalter', unit: 'ns', digits: 1, min: 0, max: 600, zeroIsNone: true, help: 'Zeit, in der beide Schalter der Halbbrücke gleichzeitig leiten (Ausschaltzeit minus Totzeit). 0 heißt: kein Querstrom oder Halbbrücke aus.' },
    { key: 'tAus', label: 'Ausschaltzeit t_Off', unit: 'ns', digits: 1, min: 0, max: 600, help: 'Zeit bis zum Ausschalten: gesamte Gate-Ladung geteilt durch den Entladestrom (obere Näherung).' }
  ];
  const PRESETS = [
    { id: 'rg-klein-gross', name: 'Gate-Widerstand groß', info: 'R_g = 47 Ω: Der Gate-Strom sinkt, der MOSFET schaltet langsamer und der Schaltverlust steigt.', params: { ug: 10, rg: 47, qg: 20, qgd: 5, f: 100000, uin: 12, i: 1, halbbruecke: false, ton: 100, toff: 0 } },
    { id: 'ug-zu-klein', name: 'Gate-Spannung zu klein', info: 'U_G = 4 V liegt unter der Plateauspannung: Der MOSFET schaltet nicht durch.', params: { ug: 4, rg: 10, qg: 20, qgd: 5, f: 100000, uin: 12, i: 1, halbbruecke: false, ton: 100, toff: 0 } },
    { id: 'totzeit', name: 'Halbbrücke mit zu kurzer Totzeit', info: 'Totzeit 20 ns ist kürzer als die Ausschaltzeit: Beide Schalter leiten gleichzeitig.', params: { ug: 10, rg: 10, qg: 20, qgd: 5, f: 100000, uin: 12, i: 1, halbbruecke: true, ton: 20, toff: 0 } }
  ];
  const PFAD = { quelle: 'Treiber mit Gate-Spannung U_G und Gate-Widerstand R_g, Schaltspannung bis 60 V (Kleinspannung)', wandlung: 'MOSFET: Gate-Ladung bestimmt Schaltzeit, Schaltverlust und Gate-Verlust', senke: 'Last mit konstantem Strom am Schalter (Halbbrücke nur als Begriff und Prüfung der Totzeit)', art: 'getaktet' };

  function plant(P0) {
    const CORE = P0.CORE;
    const L = id => B.lim(CORE, id);

    function point(ctl) {
      const Uplat = L('uplat');
      const g = { UG: ctl.ug, Rg: ctl.rg, Qg: ctl.qg * 1e-9, Qgd: ctl.qgd * 1e-9, Uplat, f: ctl.f };
      if (!(ctl.qgd < ctl.qg)) return { ok: false, kind: 'eingabe', error: 'Q_gd muss kleiner als Q_g sein.', g, Uplat };
      const drv = CORE.gate.drive(g);
      if (!drv || drv.ok === false) return { ok: false, kind: 'ug', error: drv && drv.why || 'Eingabe', g, Uplat, diag: drv && drv.diag || [] };
      const sw = CORE.gate.switching(Object.assign({}, g, { Vsw: ctl.uin, Uout: ctl.uin, I: ctl.i }));
      if (!sw || sw.ok === false) return { ok: false, kind: 'eingabe', error: sw && sw.why || 'Eingabe', g, Uplat };
      let dt = null;
      if (ctl.halbbruecke) {
        const c2 = Object.assign({}, g, { tot: ctl.ton * 1e-9 });
        if (ctl.toff > 0) c2.tOffHi = ctl.toff * 1e-9;
        dt = CORE.gate.deadtime(c2);
        if (dt && dt.ok === false) dt = null;
      }
      return { ok: true, g, drv, sw, dt, Uplat, uin: ctl.uin, i: ctl.i };
    }
    function compute(ctl) { return point(ctl); }
    function meters(r) {
      const z = { igPeak: 0, tsw: 0, psw: 0, pg: 0, querstrom: 0, tAus: 0 };
      if (!r.ok) return z;
      return { igPeak: r.drv.Ig_peak, tsw: r.drv.t_sw * 1e9, psw: r.sw.Psw * 1000, pg: r.drv.PG * 1000, querstrom: r.dt && r.dt.querstrom ? r.dt.tUeber * 1e9 : 0, tAus: (r.dt ? r.dt.tOff : r.drv.tOff) * 1e9 };
    }
    /* Bilanz: abgegeben = Schaltleistung U · I (Kern: Pab), Verluste P_sw und P_G (beide Stufe schalt) */
    function bilanz(r) {
      if (!r.ok) return null;
      const pab = r.sw.Pab, pv = r.sw.Psw + r.drv.PG;
      return { pzu: pab + pv, pab, pv: [{ stufe: 'schalt', w: pv }] };
    }
    /* Ampel nach SPEC 4.10 (Zeile gate): rot U_G <= U_Plateau oder Ueberlappung, gelb Reserve < 2 V oder P_sw > 1 % von P_ab, sonst gruen. Grenzen aus dem Kern. */
    function assess(r, ctl) {
      if (!r.ok) {
        if (r.kind === 'ug') return { ok: false, ampel: 'rot', text: r.error + ' (Plateauspannung ' + eng(r.Uplat, 'V') + ', Übungswert).' };
        return { ok: false, ampel: 'grau', text: 'Die Anlage ist mit diesen Werten nicht rechenbar: ' + r.error };
      }
      const resv = r.drv.reserve, pct = r.sw.anteil * 100;
      if (r.dt && r.dt.querstrom) return { ok: false, ampel: 'rot', text: 'Überlappung der Gates: Die Totzeit ' + eng(r.dt.tot, 's') + ' ist kürzer als die Ausschaltzeit ' + eng(r.dt.tOff, 's') + ', beide Schalter leiten ' + eng(r.dt.tUeber, 's') + ' gleichzeitig (Querstrom).' };
      const why = [];
      if (r.drv.knapp) why.push('U_G liegt nur ' + eng(resv, 'V') + ' über dem Plateau (unter 2 V Reserve, Lehrfaustwert).');
      if (r.sw.diag.some(d => d.id === 'schaltverlust-gross')) why.push('P_sw = ' + eng(r.sw.Psw, 'W') + ' beträgt ' + fm(pct, 2) + ' % von P_ab (Lehrfaustwert: über 1 % ist gelb).');
      if (why.length) return { ok: false, ampel: 'gelb', text: why.join(' '), margin: r.sw.anteil > 0 ? 0.01 / r.sw.anteil : undefined };
      const ht = r.dt ? ' Die Totzeit ' + eng(r.dt.tot, 's') + ' ist länger als die Ausschaltzeit ' + eng(r.dt.tOff, 's') + ', es gibt keinen Querstrom.' : '';
      return { ok: true, ampel: 'gruen', text: 'U_G liegt ' + eng(resv, 'V') + ' über dem Plateau (mindestens 2 V Reserve) und P_sw = ' + eng(r.sw.Psw, 'W') + ' bleibt unter 1 % von P_ab (' + fm(pct, 2) + ' %, Lehrfaustwerte).' + ht, margin: r.sw.anteil > 0 ? 0.01 / r.sw.anteil : undefined };
    }
    function diag(r) {
      const out = [];
      if (!r.ok) {
        if (r.kind === 'ug') (r.diag || []).forEach(d => out.push({ id: d.id || 'ug-zu-klein', kind: d.kind || 'error', text: d.text }));
        return out;
      }
      out.push({ id: 'gate-lehrmodell', kind: 'info', text: 'Die Verläufe sind ein Lehrmodell und nicht maßstäblich: Plateauspannung, Ladungen und Zeiten sind Übungswerte (Datenblatt maßgeblich).' });
      r.drv.diag.forEach(d => out.push({ id: d.id, kind: d.kind || 'warn', text: d.text }));
      r.sw.diag.forEach(d => { if (!out.some(o => o.id === d.id)) out.push({ id: d.id, kind: d.kind || 'warn', text: d.text, link: d.link }); });
      if (r.dt) r.dt.diag.forEach(d => out.push({ id: d.id, kind: d.kind || 'error', text: d.text }));
      return out;
    }
    function curves(r, ctl) {
      if (!r.ok) return [];
      const list = [], A = [], Tm = [], Fp = [];
      for (let k = 0; k <= 40; k++) list.push(Math.pow(100, k / 40));
      const sw = CORE.gate.sweepRg(Object.assign({}, r.g, { Vsw: ctl.uin, Uout: ctl.uin, I: ctl.i }), list);
      if (sw && sw.ok !== false) sw.rows.forEach(w => { if (w.ok) { A.push([w.Rg, w.Psw * 1000]); Tm.push([w.Rg, w.tR * 1e9]); } });
      for (let k = 0; k <= 40; k++) {
        const f = 20000 * Math.pow(25, k / 40), q = CORE.gate.switching(Object.assign({}, r.g, { f, Vsw: ctl.uin, Uout: ctl.uin, I: ctl.i }));
        if (q && q.ok !== false) Fp.push([f, q.Psw * 1000]);
      }
      const lim = r.sw.Pab * 0.01 * 1000;
      return [
        { id: 'psw-rg', title: 'Schaltverlust über dem Gate-Widerstand', xLabel: 'Gate-Widerstand R_g', xUnit: 'Ω', xScale: 'log', yLabel: 'Schaltverlust P_sw', yUnit: 'mW', series: [{ name: 'P_sw', points: A }],
          marker: { x: ctl.rg, y: r.sw.Psw * 1000, label: 'jetzt ' + eng(r.sw.Psw, 'W') }, limit: { y: lim, label: '1 % von P_ab (Lehrfaustwert)' } },
        { id: 'tsw-rg', title: 'Miller-Zeit über dem Gate-Widerstand', xLabel: 'Gate-Widerstand R_g', xUnit: 'Ω', xScale: 'log', yLabel: 'Miller-Zeit t_sw', yUnit: 'ns', series: [{ name: 't_sw', points: Tm }],
          marker: { x: ctl.rg, y: r.drv.t_sw * 1e9, label: 'jetzt ' + eng(r.drv.t_sw, 's') } },
        { id: 'psw-f', title: 'Schaltverlust über der Schaltfrequenz', xLabel: 'Schaltfrequenz f', xUnit: 'Hz', xScale: 'log', yLabel: 'Schaltverlust P_sw', yUnit: 'mW', series: [{ name: 'P_sw', points: Fp }],
          marker: { x: ctl.f, y: r.sw.Psw * 1000, label: 'jetzt ' + eng(r.sw.Psw, 'W') }, limit: { y: lim, label: '1 % von P_ab (Lehrfaustwert)' } }
      ];
    }
    /* Ein Schaltspiel (Einschalten, Durchlass, Ausschalten) als Linienzug aus den Kernzeiten; Zeit in ns. */
    function waveform(r) {
      if (!r.ok) return null;
      const d = r.drv, V = r.uin, I = r.i, UG = d.UG, Up = r.Uplat;
      const tR = d.tR * 1e9, tF = d.tF * 1e9, tOn = d.tOn * 1e9, tOff = d.tOff * 1e9;
      const tA = tOn - tR, tAo = tOff - tF, hold = Math.max(tOn, tOff), eps = Math.max(1e-6, 1e-6 * tR);
      const v1 = 0.7 * tA, v2 = v1 + tR, v3 = tOn, v4 = v3 + hold, v5 = v4 + 0.3 * tAo, v6 = v5 + tF, v7 = v6 + 0.7 * tAo, v8 = v7 + 0.2 * tOff;
      /* Eckpunkte: [t, u_gs, u_ds, i_d]; der Strom springt (Steilflanke eps) am Anfang des Plateaus bzw. an dessen Ende */
      const V0 = [[0, 0, V, 0], [v1, Up, V, 0], [v1 + eps, Up, V, I], [v2, Up, 0, I], [v3, UG, 0, I], [v4, UG, 0, I], [v5, Up, 0, I], [v6, Up, V, I], [v6 + eps, Up, V, 0], [v7, 0, V, 0], [v8, 0, V, 0]];
      const ts = new Set(); V0.forEach(p => ts.add(p[0])); for (let k = 0; k <= 240; k++) ts.add(v8 * k / 240);
      const tt = Array.from(ts).sort((a, b) => a - b);
      const at = (t, c) => { for (let k = 1; k < V0.length; k++) if (t <= V0[k][0]) { const a = V0[k - 1], b = V0[k], f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); return a[c] + (b[c] - a[c]) * f; } return V0[V0.length - 1][c]; };
      const ugs = tt.map(t => at(t, 1)), uds = tt.map(t => at(t, 2)), id = tt.map(t => at(t, 3)), p = tt.map((t, k) => uds[k] * id[k]);
      return { tUnit: 'ns', t: tt, series: [{ name: 'u_gs', y: ugs, unit: 'V' }, { name: 'u_ds', y: uds, unit: 'V' }, { name: 'i_d', y: id, unit: 'A' }, { name: 'p', y: p, unit: 'W' }],
        marks: [{ name: 't_R', value: tR, unit: 'ns' }, { name: 't_F', value: tF, unit: 'ns' }] };
    }
    function fire(r) {
      if (!r.ok) { P0.say('Schaltvorgang nicht möglich: ' + r.error, 'warn'); return false; }
      P0.say('Schaltvorgang in Zeitlupe: Miller-Plateau ' + eng(r.drv.t_sw, 's') + ' beim Einschalten, ' + eng(r.drv.tF, 's') + ' beim Ausschalten, Schaltverlust im Mittel ' + eng(r.sw.Psw, 'W') + '.', 'info');
      return true;
    }
    function bridgeDiagram(ctx, rect, r, sc) {
      const pal = sc.pal, dt = r.dt, fs = Math.max(11, sc.fs);
      if (!B.okv(rect.x, rect.y, rect.w, rect.h) || rect.w < 120 || rect.h < 60) return false;
      B.gfx.panel(ctx, rect.x, rect.y, rect.w, rect.h, pal.panel, pal.line, 6);
      B.gfx.text(ctx, 'Halbbrücke: Totzeit gegen Ausschaltzeit', rect.x + 8, rect.y + fs + 4, { size: fs, bold: true, color: pal.fg, max: rect.w - 16 });
      if (!dt) { B.gfx.text(ctx, 'Halbbrücken-Prüfung aus (Schalter oben einschalten)', rect.x + 8, rect.y + 2 * fs + 12, { size: fs, color: pal.mute, max: rect.w - 16 }); return true; }
      const x0 = rect.x + 96, wx = rect.w - 96 - 12, tmax = Math.max(dt.tot, dt.tOff) * 1.4, X = t => x0 + t / tmax * wx;
      const y1 = rect.y + fs + 22, hb = Math.max(12, Math.min(22, (rect.h - fs - 54) / 2));
      B.gfx.text(ctx, 'oben', rect.x + 8, y1 + hb * 0.5, { size: fs, color: pal.sw, base: 'middle' });
      B.gfx.text(ctx, 'unten', rect.x + 8, y1 + hb * 1.5 + 6, { size: fs, color: pal.il, base: 'middle' });
      B.gfx.panel(ctx, x0, y1, Math.max(1, X(dt.tOff) - x0), hb, pal.sw, null, 3);
      B.gfx.panel(ctx, X(dt.tot), y1 + hb + 6, Math.max(1, x0 + wx - X(dt.tot)), hb, pal.il, null, 3);
      if (dt.querstrom) {
        const xa = X(dt.tot), xb = X(dt.tOff);
        B.gfx.panel(ctx, xa, y1 - 2, Math.max(1, xb - xa), 2 * hb + 10, pal.loss, null, 2);
        B.gfx.text(ctx, '✗ Querstrom ' + eng(dt.tUeber, 's'), Math.min(xb + 4, rect.x + rect.w - 12), y1 + hb + 3, { size: fs, bold: true, color: pal.loss, bg: pal.bg, align: xb + 150 > rect.x + rect.w ? 'right' : 'left', base: 'middle', max: rect.w * 0.6 });
      }
      B.gfx.text(ctx, 'Totzeit ' + eng(dt.tot, 's') + ' · Ausschaltzeit ' + eng(dt.tOff, 's') + (dt.querstrom ? ' → Überlappung' : ' → Reserve ' + eng(dt.reserve, 's')), rect.x + 8, rect.y + rect.h - 8, { size: fs, color: dt.querstrom ? pal.loss : pal.out, bold: true, max: rect.w - 16 });
      return true;
    }
    function draw(ctx, w, h, t, view, sc) {
      const rc = sc.rect, r = view.res, pal = sc.pal;
      if (!rc || rc.w < 140 || rc.h < 100) return;
      const wide = rc.w >= 640, gap = 8;
      let a, c, b;
      if (wide) {
        const th = Math.floor(rc.h * 0.6);
        a = { x: rc.x, y: rc.y, w: Math.floor(rc.w * 0.6) - gap, h: th - gap };
        c = { x: a.x + a.w + gap, y: rc.y, w: rc.w - a.w - gap, h: th - gap };
        b = { x: rc.x, y: rc.y + th, w: rc.w, h: rc.h - th };
      } else {
        const h1 = Math.floor(rc.h * 0.42), h2 = Math.floor(rc.h * 0.22);
        a = { x: rc.x, y: rc.y, w: rc.w, h: h1 - gap };
        c = { x: rc.x, y: rc.y + h1, w: rc.w, h: h2 - gap };
        b = { x: rc.x, y: rc.y + h1 + h2, w: rc.w, h: rc.h - h1 - h2 };
      }
      const o2 = { theme: sc.theme, q: sc.quality, reduced: sc.reduced, t: sc.t, bg: false }, D = sc.D, ct = view.ctl;
      let ok = false;
      if (D && D.gateScene) {
        const dat = { ug: ct.ug, uplat: r.Uplat || L('uplat'), uds: ct.uin, id: ct.i, qgs: Math.max(0.1, ct.qg - ct.qgd), qgd: ct.qgd };
        if (r.ok) dat.psw = r.sw.Psw;
        ok = !!D.gateScene(ctx, a, dat, o2);
      }
      if (!ok) B.gfx.text(ctx, 'U_G ' + eng(ct.ug, 'V') + ' · R_g ' + eng(ct.rg, 'Ω') + (r.ok ? ' · t_sw ' + eng(r.drv.t_sw, 's') : ''), a.x, a.y + 20, { size: sc.fs, color: pal.fg, max: a.w });
      if (r.ok) { if (!bridgeDiagram(ctx, c, r, sc)) B.gfx.text(ctx, 'Halbbrücke', c.x, c.y + 20, { size: sc.fs, color: pal.mute, max: c.w }); }
      else B.gfx.text(ctx, r.error, c.x, c.y + 20, { size: sc.fs, color: pal.rot, max: c.w });
      if (r.ok) sc.block(b);
      else B.gfx.text(ctx, 'Keine Leistungsbilanz: ' + r.error, b.x, b.y + 20, { size: sc.fs, color: pal.mute, max: b.w });
    }
    return { compute, meters, bilanz, assess, diag, curves, waveform, fire, draw, phaseHz: () => 0.5 };
  }

  R.register({ id: 'gate', name: 'Gate und Schaltverluste', icon: '⚡', info: 'Gate-Strom, Miller-Plateau, Schaltzeit, Schaltverlust und Totzeit der Halbbrücke im Lehrmodell.', controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return B.makeRig({ id: 'gate', name: 'Gate und Schaltverluste', icon: '⚡', info: 'Gate-Ansteuerung eines MOSFET', world: { w: 960, h: 600 }, pfad: PFAD, controls: CONTROLS, meters: METERS, presets: PRESETS, params: {}, plant }, opts); } });
})(typeof window !== 'undefined' ? window : globalThis);
