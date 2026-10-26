/* spsdata.js - SPS-Lab: Beispiele und Aufgaben mit automatischer Prüfung (Simulation, ohne Browser lauffähig)
 * window.SPS_DATA  = { examples: [ { id, name, cat, plant, lang, desc, prog } ] }
 * window.SPS_TASKS = { tasks: [ { id, lab:'sps', cat, title, level, plant, text, hint[3], start(), sol(), check(prog) } ], run(task, prog) }
 * window.TaskTest  = async only => [ { id, pct, startPct, bad } ]
 * Die Prüfungen messen Verhalten (Simulationszeit, feste Szenarien), nicht die Struktur des Programms.
 * Benötigt: spscore.js und die vier Anlagendateien (spsplant-*.js). */
(function (root) {
  'use strict';
  const CORE = () => root.SPS_CORE, PLANTS = () => root.SPS_PLANTS;
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ====================================================================== Bausteine */
  const v = a => ({ t: 'var', a }), nv = a => ({ t: 'var', a, neg: true });
  const AND = (...i) => ({ t: 'and', in: i }), OR = (...i) => ({ t: 'or', in: i }), XOR = (...i) => ({ t: 'xor', in: i });
  const NOTE = n => Object.assign({}, n, { neg: !n.neg });
  const P = a => ({ t: 'edge', a, mode: 'P' });
  const TON = (id, pt, i) => ({ t: 'fb', fb: 'ton', id, pt, in: i }), TOF = (id, pt, i) => ({ t: 'fb', fb: 'tof', id, pt, in: i }), TP = (id, pt, i) => ({ t: 'fb', fb: 'tp', id, pt, in: i });
  const CTU = (id, pv, i, r) => ({ t: 'fb', fb: 'ctu', id, pv, in: i, r });
  const coil = a => ({ t: 'coil', a }), set = a => ({ t: 'set', a }), rst = a => ({ t: 'reset', a });
  const net = (id, title, expr, outs) => ({ id, title, expr, outs: outs || [] });
  const A = (q, a, t) => (t == null ? { q, a } : { q, a, t });
  const step = (id, title, actions, init) => (init ? { id, init: true, title, actions } : { id, title, actions });
  const tr = (id, from, to, cond) => ({ id, from: [].concat(from), to: [].concat(to), cond });

  const SYM = {
    foerderband: { 'I0.0': 'S1_Start', 'I0.1': 'S2_Stopp', 'I0.2': 'B1_Lichtschranke', 'I0.3': 'B2_Metall', 'I0.4': 'B3_Zyl_hinten', 'I0.5': 'B4_Zyl_vorn', 'I0.6': 'B5_Bandende', 'I0.7': 'S3_NotHalt', 'Q0.0': 'K1_Band', 'Q0.1': 'Y1_Ausschieber', 'Q0.2': 'H1_Betrieb', 'Q0.3': 'H2_Stoerung', 'Q0.4': 'K2_Rueckwaerts' },
    ampel: { 'I0.0': 'S1_Fussgaengertaster', 'I0.1': 'S2_Betrieb', 'I0.2': 'B1_Schleife', 'Q0.0': 'H1_Strasse_rot', 'Q0.1': 'H2_Strasse_gelb', 'Q0.2': 'H3_Strasse_gruen', 'Q0.3': 'H4_Fuss_rot', 'Q0.4': 'H5_Fuss_gruen' },
    tank: { 'I0.0': 'S1_Start', 'I0.1': 'S2_Stopp', 'I0.2': 'B1_Min', 'I0.3': 'B2_Mitte', 'I0.4': 'B3_Max', 'I0.5': 'B4_Beh2Leer', 'I0.6': 'S3_NotHalt', 'Q0.0': 'Y1_ZulaufA', 'Q0.1': 'Y2_ZulaufB', 'Q0.2': 'M1_Ruehrwerk', 'Q0.3': 'Y3_Ablauf', 'Q0.4': 'P1_Pumpe', 'Q0.5': 'H1_Stoerung' },
    garagentor: { 'I0.0': 'S1_Auf', 'I0.1': 'S2_Ab', 'I0.2': 'B1_EndeOben', 'I0.3': 'B2_EndeUnten', 'I0.4': 'B3_Lichtschranke', 'I0.5': 'S3_Stopp', 'Q0.0': 'K1_MotorAuf', 'Q0.1': 'K2_MotorAb', 'Q0.2': 'H1_Blinklicht', 'Q0.3': 'H2_Beleuchtung' }
  };
  const OEFF = { foerderband: ['I0.1', 'I0.7'], tank: ['I0.1', 'I0.6'], garagentor: ['I0.5'], ampel: [] };
  const sy = (plant, extra) => Object.assign({}, SYM[plant], extra || {});
  const L = (plant, keys) => keys.map(k => SYM[plant][k] + ' (' + k + (OEFF[plant].indexOf(k) >= 0 ? ', Öffner' : '') + ')').join(', ');
  const EIN = (plant, keys) => 'Eingänge: ' + L(plant, keys) + '. ';
  const AUS = (plant, keys) => 'Ausgänge: ' + L(plant, keys) + '. ';
  const ADR = ' (I = Eingang, Q = Ausgang, M = Merker; in der Siemens-Anzeige heißen sie E, A und M.)';

  const kop = (plant, nets, extra) => ({ lang: 'kop', symbols: sy(plant, extra), networks: nets });
  const fup = (plant, nets, extra) => ({ lang: 'fup', symbols: sy(plant, extra), networks: nets });
  const gra = (plant, steps, trans, extra) => ({ lang: 'gra', symbols: sy(plant, extra), gra: { steps, transitions: trans } });

  /* ====================================================================== Simulation und Prüfhilfen */
  function script() {
    const ev = new Map();
    const s = {
      at(t, f) { t = Math.round(t / 10) * 10; if (!ev.has(t)) ev.set(t, []); ev.get(t).push(f); return s; },
      press(key, t, dur, rest) { rest = !!rest; return s.at(t, p => p.setInput(key, !rest)).at(t + (dur == null ? 200 : dur), p => p.setInput(key, rest)); },
      set(key, t, val) { return s.at(t, p => p.setInput(key, val)); },
      drive(t, plant, ctx) { const l = ev.get(t); if (l) for (let i = 0; i < l.length; i++) l[i](plant, ctx); }
    };
    return s;
  }
  /* Anlage + SPS im 10-ms-Zyklus: Eingänge lesen, scan, Ausgänge schreiben, Anlage rechnen */
  function sim(prog, plantId, o) {
    const plant = PLANTS().create(plantId, Object.assign({ seed: 1 }, o.opts || {}));
    if (typeof o.scen === 'string') plant.scenarios(o.scen); else if (typeof o.scen === 'function') o.scen(plant);
    const plc = CORE().create(clone(prog));
    const qk = plant.io.outputs.map(x => x.key);
    const ctx = { t: 0, plant, plc, out: {}, inp: {}, rec: [] };
    for (let t = 0; t < o.ms; t += 10) {
      ctx.t = t;
      if (o.drive) o.drive(t, plant, ctx);
      const inp = plant.readInputs(); ctx.inp = inp;
      for (const k in inp) plc.setInput(k, inp[k]);
      plc.scan(10);
      for (let i = 0; i < qk.length; i++) ctx.out[qk[i]] = plc.getOutput(qk[i]);
      plant.writeOutputs(ctx.out);
      plant.step(10);
      const r = { t, o: Object.assign({}, ctx.out), i: inp };
      if (o.sample) r.s = o.sample(plant, ctx);
      ctx.rec.push(r);
      if (o.each) o.each(t, ctx, r);
    }
    ctx.st = plant.state();
    return ctx;
  }
  /* Nur die SPS: Eingänge aus Ruhezustand der Anlage plus Überschreibungen, je Schritt n Zyklen */
  function logic(prog, plantId, steps) {
    const plc = CORE().create(clone(prog));
    const plant = PLANTS().create(plantId, { seed: 1 });
    const base = plant.readInputs(), qk = plant.io.outputs.map(x => x.key);
    return steps.map(st => {
      const inp = Object.assign({}, base, st.in || {});
      for (const k in inp) plc.setInput(k, inp[k]);
      const any = {}, cycles = [];
      for (let i = 0; i < st.n; i++) {
        plc.scan(10); const o = {};
        for (let j = 0; j < qk.length; j++) { o[qk[j]] = plc.getOutput(qk[j]); if (o[qk[j]]) any[qk[j]] = true; }
        cycles.push(o);
      }
      return { inp, any, cycles, last: cycles[cycles.length - 1] || {} };
    });
  }
  const win = (rec, t0, t1) => rec.filter(r => r.t >= t0 && r.t < t1);
  const allOf = (w, f) => w.length > 0 && w.every(f);
  const someOf = (w, f) => w.some(f);
  const rises = (w, f) => { let n = 0, p = false; w.forEach(r => { const x = !!f(r); if (x && !p) n++; p = x; }); return n; };
  const duty = (w, f) => (w.length ? w.filter(f).length / w.length : 0);
  /* zusammenhängende Abschnitte, in denen f wahr ist: [{from,to}] in ms */
  const runs = (rec, f) => { const a = []; let cur = null; rec.forEach(r => { if (f(r)) { if (!cur) cur = { from: r.t, to: r.t + 10 }; else cur.to = r.t + 10; } else if (cur) { a.push(cur); cur = null; } }); if (cur) a.push(cur); return a; };
  const first = (rec, f, from) => { for (let i = 0; i < rec.length; i++) if ((from == null || rec[i].t >= from) && f(rec[i])) return rec[i]; return null; };
  const sec = x => (Math.round(x / 100) / 10).toString().replace('.', ',');
  const at = (rec, t) => rec[Math.min(rec.length - 1, Math.max(0, Math.round(t / 10)))] || {};

  /* Ein Check: Kompilierfehler als eigene Zeile, Ausnahmen werden zu einer Zeile */
  function mkCheck(fn) {
    return function (prog) {
      try {
        const plc = CORE().create(clone(prog));
        if (!plc.ok) return [{ ok: false, text: 'Das Programm lässt sich nicht übersetzen', why: (plc.errorList && plc.errorList.length ? plc.errorList : plc.errors).join(' ') }];
        const rows = [], r = (c, t, w) => { rows.push({ ok: !!c, text: t, why: c ? '' : (w || '') }); };
        fn(prog, r, rows);
        return rows;
      } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
    };
  }

  /* ====================================================================== Programme (Musterlösungen, Beispiele, Startvorlagen) */
  // --- Förderband: Selbsthaltung mit Stopp und Not-Halt
  const bandSol = lang => ({ lang: lang || 'kop', symbols: sy('foerderband'), networks: [
    net('N1', 'Selbsthaltung Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]),
    net('N2', 'Betriebslampe', v('Q0.0'), [coil('Q0.2')])] });
  const bandStart = () => kop('foerderband', [net('N1', 'Selbsthaltung Band', OR(v('I0.0'), v('Q0.0')), [coil('Q0.0')])]);
  const bandBug = () => kop('foerderband', [
    net('N1', 'Selbsthaltung Band', AND(OR(v('I0.0'), v('Q0.0')), nv('I0.1'), v('I0.7')), [coil('Q0.0')]),
    net('N2', 'Betriebslampe', v('Q0.0'), [coil('Q0.2')])]);

  // --- Garagentor: Tippbetrieb mit Verriegelung
  const torTipp = () => kop('garagentor', [
    net('N1', 'Motor Auf (Tippbetrieb)', AND(v('I0.0'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N2', 'Motor Ab (Tippbetrieb)', AND(v('I0.1'), nv('I0.3'), nv('Q0.0')), [coil('Q0.1')])]);
  const torTippStart = () => kop('garagentor', [net('N1', 'Motor Auf (Tippbetrieb)', v('I0.0'), [coil('Q0.0')]), net('N2', 'Motor Ab (Tippbetrieb)', v('I0.1'), [coil('Q0.1')])]);
  const torTippBug = () => kop('garagentor', [
    net('N1', 'Motor Auf', AND(v('I0.0'), nv('I0.2')), [coil('Q0.0')]),
    net('N2', 'Motor Ab', AND(v('I0.1'), nv('I0.2')), [coil('Q0.1')])]);

  // --- Garagentor: Selbsthaltung bis Endschalter, Einklemmschutz
  const torAuto = () => kop('garagentor', [
    net('N1', 'Motor Auf', AND(OR(v('I0.0'), v('Q0.0')), v('I0.5'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N2', 'Motor Ab', AND(OR(v('I0.1'), v('Q0.1')), v('I0.5'), nv('I0.3'), nv('Q0.0')), [coil('Q0.1')])]);
  const torAutoStart = () => kop('garagentor', [
    net('N1', 'Motor Auf', AND(OR(v('I0.0'), v('Q0.0')), v('I0.5')), [coil('Q0.0')]),
    net('N2', 'Motor Ab', AND(OR(v('I0.1'), v('Q0.1')), v('I0.5')), [coil('Q0.1')])]);
  const torSchutz = () => kop('garagentor', [
    net('N1', 'Hindernis beim Schließen erkannt, merken', AND(v('Q0.1'), v('I0.4')), [set('M0.0')]),
    net('N2', 'Oben angekommen oder Stopp: Merker löschen', OR(v('I0.2'), nv('I0.5')), [rst('M0.0')]),
    net('N3', 'Motor Auf', AND(OR(v('I0.0'), v('M0.0'), v('Q0.0')), v('I0.5'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N4', 'Motor Ab', AND(OR(v('I0.1'), v('Q0.1')), v('I0.5'), nv('I0.3'), nv('Q0.0'), nv('I0.4')), [coil('Q0.1')]),
    net('N5', 'Blinklicht', OR(v('Q0.0'), v('Q0.1')), [coil('Q0.2')])], { 'M0.0': 'M_Hindernis' });
  const torSchutzStart = () => { const p = torAuto(); p.symbols = sy('garagentor', { 'M0.0': 'M_Hindernis' }); return p; };

  // --- Garagentor: Licht
  const torLicht = () => kop('garagentor', [net('N1', 'Beleuchtung', AND(OR(nv('I0.3'), v('I0.4')), nv('I0.1')), [coil('Q0.3')])]);
  const torLichtStart = () => kop('garagentor', [net('N1', 'Beleuchtung', nv('I0.3'), [coil('Q0.3')])]);
  const torToggle = () => kop('garagentor', [net('N1', 'Stromstoßschalter', XOR(v('Q0.3'), P('I0.0')), [coil('Q0.3')])]);
  const torToggleStart = () => kop('garagentor', [net('N1', 'Stromstoßschalter', v('I0.0'), [coil('Q0.3')])]);
  const torImpuls = (lang) => ({ lang: lang || 'fup', symbols: sy('garagentor'), networks: [net('N1', 'Licht-Impuls', TP('T1', 5000, v('I0.0')), [coil('Q0.3')])] });
  const torImpulsStart = () => fup('garagentor', [net('N1', 'Licht-Impuls', v('I0.0'), [coil('Q0.3')])]);

  // --- Förderband: Zeiten und Zähler
  const bandAnlauf = (lang) => ({ lang: lang || 'kop', symbols: sy('foerderband', { 'M0.0': 'M_Anlauf' }), networks: [
    net('N1', 'Anlauf merken', AND(OR(v('I0.0'), v('M0.0')), v('I0.1'), v('I0.7')), [coil('M0.0')]),
    net('N2', 'Band nach 3 s', TON('T1', 3000, v('M0.0')), [coil('Q0.0')]),
    net('N3', 'Warnlampe', AND(v('M0.0'), nv('T1.Q')), [coil('Q0.3')])] });
  const bandAnlaufStart = () => kop('foerderband', [net('N1', 'Anlauf merken', AND(OR(v('I0.0'), v('M0.0')), v('I0.1'), v('I0.7')), [coil('M0.0')])], { 'M0.0': 'M_Anlauf' });
  const bandNachlauf = () => kop('foerderband', [
    net('N1', 'Selbsthaltung Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]),
    net('N2', 'Lampe mit Nachlauf', TOF('T1', 4000, v('Q0.0')), [coil('Q0.2')])]);
  const bandNachlaufStart = () => kop('foerderband', [net('N1', 'Selbsthaltung Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]), net('N2', 'Lampe mit Nachlauf', v('Q0.0'), [coil('Q0.2')])]);
  const bandZaehl = () => kop('foerderband', [
    net('N1', 'Werkstücke zählen', CTU('C1', 4, v('I0.6'), v('I0.0')), [coil('Q0.3')]),
    net('N2', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7'), nv('C1.Q')), [coil('Q0.0')])]);
  const bandZaehlStart = () => kop('foerderband', [net('N1', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')])]);
  const bandEnde = () => kop('foerderband', [
    net('N1', 'Band hält am Bandende', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7'), NOTE(OR(P('I0.6')))), [coil('Q0.0')]),
    net('N2', 'Betriebslampe', v('Q0.0'), [coil('Q0.2')])]);
  const bandEndeStart = () => kop('foerderband', [net('N1', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]), net('N2', 'Betriebslampe', v('Q0.0'), [coil('Q0.2')])]);
  const bandSortier = () => kop('foerderband', [
    net('N1', 'Betrieb', AND(OR(v('I0.0'), v('M0.0')), v('I0.1'), v('I0.7')), [coil('M0.0')]),
    net('N2', 'Metallteil gesehen', v('I0.3'), [set('M0.1')]),
    net('N3', 'Ausschieber fährt aus', AND(OR(AND(v('M0.1'), v('I0.2')), v('Q0.1')), v('M0.0'), nv('I0.5')), [coil('Q0.1')]),
    net('N4', 'Teil ausgeschoben, löschen', v('I0.5'), [rst('M0.1')]),
    net('N5', 'Band läuft nur bei eingefahrenem Zylinder', AND(v('M0.0'), v('I0.4'), nv('Q0.1')), [coil('Q0.0')]),
    net('N6', 'Betriebslampe', v('M0.0'), [coil('Q0.2')])], { 'M0.0': 'M_Betrieb', 'M0.1': 'M_Metall' });
  const bandSortierStart = () => kop('foerderband', [
    net('N1', 'Betrieb', AND(OR(v('I0.0'), v('M0.0')), v('I0.1'), v('I0.7')), [coil('M0.0')]),
    net('N2', 'Band', v('M0.0'), [coil('Q0.0')])], { 'M0.0': 'M_Betrieb', 'M0.1': 'M_Metall' });
  const bandFup = () => fup('foerderband', [
    net('N1', 'Selbsthaltung K1', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]),
    net('N2', 'Betriebslampe H1', v('Q0.0'), [coil('Q0.2')]),
    net('N3', 'Störmeldung H2', nv('I0.7'), [coil('Q0.3')])]);
  const bandFupStart = () => fup('foerderband', [
    net('N1', 'Selbsthaltung K1', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1')), [coil('Q0.0')]),
    net('N2', 'Betriebslampe H1', v('Q0.0'), [coil('Q0.2')]),
    net('N3', 'Störmeldung H2', { t: 'const', v: false }, [coil('Q0.3')])]);

  // --- Ampel
  const ampelNacht = () => kop('ampel', [
    net('N1', 'Blinken: Pause', TON('T1', 500, AND(nv('I0.1'), nv('T2.Q'))), [coil('Q0.1')]),
    net('N2', 'Blinken: Leuchtzeit', TON('T2', 500, v('T1.Q')), [coil('M0.0')]),
    net('N3', 'Tagbetrieb', v('I0.1'), [coil('Q0.2'), coil('Q0.3')])], { 'M0.0': 'M_Leuchtzeit_um' });
  const ampelNachtStart = () => kop('ampel', [net('N1', 'Tagbetrieb', v('I0.1'), [coil('Q0.2'), coil('Q0.3')])], { 'M0.0': 'M_Leuchtzeit_um' });
  const ampelBlink = () => kop('ampel', [
    net('N1', 'Pause', TON('T1', 500, AND(v('I0.1'), nv('T2.Q'))), [coil('Q0.1')]),
    net('N2', 'Leuchtzeit', TON('T2', 500, v('T1.Q')), [coil('M0.0')])], { 'M0.0': 'M_Leuchtzeit_um' });
  const ampelZyklus = () => kop('ampel', [
    net('N1', 'Start im Betrieb', AND(v('I0.1'), nv('M0.0'), nv('M0.1'), nv('M0.2'), nv('M0.3')), [set('M0.0')]),
    net('N2', 'Betrieb aus', nv('I0.1'), [rst('M0.0'), rst('M0.1'), rst('M0.2'), rst('M0.3')]),
    net('N3', 'Grün 5 s', TON('T1', 5000, v('M0.0')), [set('M0.1'), rst('M0.0')]),
    net('N4', 'Gelb 2 s', TON('T2', 2000, v('M0.1')), [set('M0.2'), rst('M0.1')]),
    net('N5', 'Rot 5 s', TON('T3', 5000, v('M0.2')), [set('M0.3'), rst('M0.2')]),
    net('N6', 'Rot-Gelb 1 s', TON('T4', 1000, v('M0.3')), [set('M0.0'), rst('M0.3')]),
    net('N7', 'Ampel Straße grün', v('M0.0'), [coil('Q0.2')]),
    net('N8', 'Ampel Straße gelb', OR(v('M0.1'), v('M0.3')), [coil('Q0.1')]),
    net('N9', 'Ampel Straße rot', OR(v('M0.2'), v('M0.3')), [coil('Q0.0')]),
    net('N10', 'Fußgänger rot', v('I0.1'), [coil('Q0.3')])], { 'M0.0': 'M_Gruen', 'M0.1': 'M_Gelb', 'M0.2': 'M_Rot', 'M0.3': 'M_RotGelb' });
  const GRA_AMPEL_FUSS = (placeholder) => {
    const c = (x) => (placeholder ? 'false' : x);
    return gra('ampel', [
      step('S0', 'Straße grün', [A('N', 'Q0.2'), A('N', 'Q0.3')], true),
      step('S1', 'Straße gelb', [A('N', 'Q0.1'), A('N', 'Q0.3')]),
      step('S2', 'Räumzeit, Straße rot', [A('N', 'Q0.0'), A('N', 'Q0.3')]),
      step('S3', 'Fußgänger grün', [A('N', 'Q0.0'), A('N', 'Q0.4')]),
      step('S4', 'Räumzeit Fußgänger', [A('N', 'Q0.0'), A('N', 'Q0.3')]),
      step('S5', 'Rot-Gelb', [A('N', 'Q0.0'), A('N', 'Q0.1'), A('N', 'Q0.3')])],
    [tr('T1', 'S0', 'S1', 'I0.0'), tr('T2', 'S1', 'S2', c('t/S1/2s')), tr('T3', 'S2', 'S3', c('t/S2/1s')), tr('T4', 'S3', 'S4', c('t/S3/5s')),
      tr('T5', 'S4', 'S5', c('t/S4/4s')), tr('T6', 'S5', 'S0', c('t/S5/1s'))]);
  };
  const GRA_AMPEL_ZYKLUS = (placeholder) => {
    const c = (x) => (placeholder ? 'false' : x);
    return gra('ampel', [
      step('S0', 'Grün', [A('N', 'Q0.2'), A('N', 'Q0.3')], true),
      step('S1', 'Gelb', [A('N', 'Q0.1'), A('N', 'Q0.3')]),
      step('S2', 'Rot', [A('N', 'Q0.0'), A('N', 'Q0.3')]),
      step('S3', 'Rot-Gelb', [A('N', 'Q0.0'), A('N', 'Q0.1'), A('N', 'Q0.3')])],
    [tr('T1', 'S0', 'S1', c('t/S0/5s')), tr('T2', 'S1', 'S2', c('t/S1/2s')), tr('T3', 'S2', 'S3', c('t/S2/5s')), tr('T4', 'S3', 'S0', c('t/S3/1s'))]);
  };
  // --- GRAFCET Förderband
  const GRA_SCHIEBER = (placeholder) => {
    const c = (x) => (placeholder ? 'false' : x);
    return gra('foerderband', [
      step('S0', 'Grundstellung', [], true),
      step('S1', 'Band läuft', [A('N', 'Q0.0'), A('N', 'Q0.2')]),
      step('S2', 'Ausschieber fährt aus', [A('N', 'Q0.1'), A('N', 'Q0.2')]),
      step('S3', 'Ausschieber fährt ein', [A('N', 'Q0.2')])],
    [tr('T1', 'S0', 'S1', c('I0.0 AND I0.1 AND I0.7')), tr('T2', 'S1', 'S2', c('I0.2')), tr('T3', 'S2', 'S3', c('I0.5')), tr('T4', 'S3', 'S0', c('I0.4'))]);
  };
  // --- GRAFCET Tank
  const GRA_MISCH = (placeholder) => {
    const c = (x) => (placeholder ? 'false' : x);
    const base = gra('tank', [
      step('S0', 'Grundstellung', [], true),
      step('S1', 'Zulauf A bis Mitte', [A('N', 'Q0.0')]),
      step('S2', 'Zulauf B bis Max', [A('N', 'Q0.1')]),
      step('S3', 'Rühren', [A('N', 'Q0.2')]),
      step('S4', 'Abpumpen', [A('N', 'Q0.4')])],
    [tr('T1', 'S0', 'S1', c('I0.0 AND I0.6')), tr('T2', 'S1', 'S2', c('I0.3')), tr('T3', 'S2', 'S3', c('I0.4')), tr('T4', 'S3', 'S4', c('t/S3/5s AND I0.5')), tr('T5', 'S4', 'S0', c('NOT I0.2'))]);
    if (!placeholder) ['S1', 'S2', 'S3', 'S4'].forEach((s, i) => base.gra.transitions.push(tr('T' + (6 + i), s, 'S0', 'NOT I0.6')));
    return base;
  };
  // --- GRAFCET Tor
  const GRA_TOR = (placeholder) => {
    const c = (x) => (placeholder ? 'false' : x);
    return gra('garagentor', [
      step('S0', 'Grundstellung', [], true),
      step('S1', 'Vorwarnung', [A('N', 'Q0.2')]),
      step('S2', 'Tor fährt auf', [A('N', 'Q0.0'), A('N', 'Q0.2')]),
      step('S3', 'Tor bleibt offen', [A('N', 'Q0.3')]),
      step('S4', 'Tor fährt zu', [A('N', 'Q0.1'), A('N', 'Q0.2')])],
    [tr('T1', 'S0', 'S1', c('I0.0 AND I0.5')), tr('T2', 'S1', 'S2', c('t/S1/3s')), tr('T3', 'S2', 'S3', c('I0.2')), tr('T4', 'S3', 'S4', c('t/S3/5s')), tr('T5', 'S4', 'S0', c('I0.3'))]);
  };
  // --- Tank
  const tankFuell = () => kop('tank', [
    net('N1', 'Zulauf A', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.6'), nv('I0.4')), [coil('Q0.0')]),
    net('N2', 'Störlampe bei Not-Halt', nv('I0.6'), [coil('Q0.5')])]);
  const tankFuellStart = () => kop('tank', [net('N1', 'Zulauf A', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1')), [coil('Q0.0')])]);
  const tankFuellBug = () => kop('tank', [
    net('N1', 'Zulauf A', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.6')), [coil('Q0.0')]),
    net('N2', 'Störlampe bei Not-Halt', v('I0.6'), [coil('Q0.5')])]);
  const tankFuellRuehr = () => kop('tank', [
    net('N1', 'Zulauf A bis Max', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.6'), nv('I0.4')), [coil('Q0.0')]),
    net('N2', 'Rührwerk ab Mitte', AND(v('I0.3'), v('I0.1'), v('I0.6')), [coil('Q0.2')]),
    net('N3', 'Störlampe bei Not-Halt', nv('I0.6'), [coil('Q0.5')])]);
  const tankZweipunkt = () => kop('tank', [
    net('N1', 'Zulauf A: Zweipunktregler', OR(nv('I0.3'), AND(v('Q0.0'), nv('I0.4'))), [coil('Q0.0')]),
    net('N2', 'Entnahme solange S1 gedrückt', AND(v('I0.0'), v('I0.2')), [coil('Q0.3')])]);
  const tankPumpe = () => kop('tank', [net('N1', 'Pumpe P1 (Selbsthaltung)', AND(OR(AND(v('I0.0'), v('I0.5')), v('Q0.4')), v('I0.1'), v('I0.6'), v('I0.2')), [coil('Q0.4')])]);
  const tankPumpeStart = () => kop('tank', [net('N1', 'Pumpe P1 (Selbsthaltung)', AND(OR(v('I0.0'), v('Q0.4')), v('I0.1')), [coil('Q0.4')])]);
  // --- Setzen/Rücksetzen
  const tankRuehr = () => kop('tank', [
    net('N1', 'Rührwerk einschalten (Setzen)', v('I0.0'), [set('M0.0')]),
    net('N2', 'Rührwerk ausschalten (Rücksetzen)', OR(nv('I0.1'), nv('I0.6')), [rst('M0.0')]),
    net('N3', 'Rührwerk', v('M0.0'), [coil('Q0.2')])], { 'M0.0': 'M_Ruehren' });
  const torOder = () => fup('garagentor', [
    net('N1', 'Beleuchtung: ODER', OR(v('I0.0'), v('I0.1'), v('I0.4')), [coil('Q0.3')]),
    net('N2', 'Blinklicht: genau ein Taster (XOR)', XOR(v('I0.0'), v('I0.1')), [coil('Q0.2')])]);
  const torNachlauf = () => kop('garagentor', [
    net('N1', 'Motor Auf', AND(v('I0.0'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N2', 'Motor Ab', AND(v('I0.1'), nv('I0.3'), nv('Q0.0')), [coil('Q0.1')]),
    net('N3', 'Beleuchtung mit Nachlauf', TOF('T1', 4000, OR(v('Q0.0'), v('Q0.1'))), [coil('Q0.3')])]);
  const bandZaehlBsp = () => kop('foerderband', [
    net('N1', 'Selbsthaltung Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')]),
    net('N2', 'Zähler: 3 Werkstücke', CTU('C1', 3, v('I0.6'), nv('I0.1')), [coil('Q0.3')])]);

  /* ====================================================================== Beispiele */
  const ex = (id, name, cat, plant, lang, desc, prog) => ({ id, name, cat, plant, lang, desc, prog });
  const examples = [
    ex('selbsthaltung', 'Selbsthaltung (Band Start/Stopp mit Not-Halt)', 'Grundlagen', 'foerderband', 'kop',
      'S1 Start schaltet das Band ein, es hält sich selbst. Der Öffner-Taster S2 Stopp und der Öffner Not-Halt schalten ab: Im Ruhezustand liefern sie eine 1 und wirken deshalb als Schließer-Kontakt im Programm. Die Lampe H1 zeigt, dass das Band läuft.', () => bandSol('kop')),
    ex('verknuepfung', 'ODER und XOR (Beleuchtung am Tor)', 'Grundlagen', 'garagentor', 'fup',
      'Die Beleuchtung geht an, wenn Taster Auf oder Taster Ab gedrückt ist oder ein Hindernis in der Lichtschranke steht (ODER-Gatter). Das Blinklicht leuchtet nur, wenn genau ein Taster gedrückt ist (XOR): Bei beiden oder keinem bleibt es aus. Probiere die Taster an der Anlage aus.', torOder),
    ex('setzen-ruecksetzen', 'Setzen und Rücksetzen (Rührwerk)', 'Grundlagen', 'tank', 'kop',
      'S1 setzt den Merker M0.0, Stopp oder Not-Halt setzen ihn zurück, das Rührwerk folgt dem Merker. Anders als bei der Selbsthaltung brauchst du dafür zwei Netzwerke; das letzte Netzwerk gewinnt, deshalb steht Rücksetzen unter Setzen und hat Vorrang.', tankRuehr),
    ex('blinker', 'Blinker mit zwei Einschaltverzögerungen', 'Zeit und Zählen', 'ampel', 'kop',
      'Solange S2 Betrieb eingeschaltet ist, blinkt das gelbe Licht der Straßenampel: T1 wartet 0,5 s und schaltet das Licht ein, T2 zählt 0,5 s Leuchtzeit und setzt T1 dadurch zurück. Die Periode beträgt etwa eine Sekunde.', ampelBlink),
    ex('treppenlicht', 'Treppenlicht (Impuls TP)', 'Zeit und Zählen', 'garagentor', 'fup',
      'Ein Tastendruck auf S1 startet einen Impuls von 5 Sekunden: Das Licht leuchtet genau so lange, egal wie lange du den Taster hältst. Erst ein neuer Tastendruck nach Ablauf startet wieder.', () => torImpuls('fup')),
    ex('nachlauf', 'Nachlaufzeit (Ausschaltverzögerung TOF)', 'Zeit und Zählen', 'garagentor', 'kop',
      'Das Tor fährt im Tippbetrieb, solange Auf oder Ab gedrückt ist. Die Beleuchtung geht sofort an und bleibt nach dem Loslassen noch 4 Sekunden an (TOF), damit man im Dunkeln sicher wegkommt.', torNachlauf),
    ex('zaehler', 'Aufwärtszähler (CTU) zählt Werkstücke', 'Zeit und Zählen', 'foerderband', 'kop',
      'Jedes Werkstück, das am Bandende den Sensor B5 erreicht, zählt den Zähler C1 um eins hoch. Beim dritten Teil leuchtet H2. Der Stopp-Taster setzt den Zähler zurück. Der Zähler zählt nur steigende Flanken, ein liegendes Teil zählt also nicht mehrfach.', bandZaehlBsp),
    ex('ampel-festzyklus', 'Ampel im Festzyklus (Schrittkette in KOP)', 'Ampel', 'ampel', 'kop',
      'Vier Merker bilden die Phasen Grün (5 s), Gelb (2 s), Rot (5 s) und Rot-Gelb (1 s). Jedes Zeitglied setzt die nächste Phase und löscht die aktuelle. Mit dem Schalter S2 Betrieb startet und stoppt der Zyklus.', ampelZyklus),
    ex('ampel-fussgaenger', 'Bedarfsampel für Fußgänger (GRAFCET)', 'Ampel', 'ampel', 'gra',
      'Die Straße ist grün, bis ein Fußgänger den Taster S1 drückt. Dann folgen Gelb, eine Sekunde Rot als Räumzeit, 5 Sekunden Fußgänger-Grün, 4 Sekunden Räumzeit für die Fußgänger und Rot-Gelb. Fahrzeuge und Fußgänger haben nie gleichzeitig Grün. Ein Tastendruck während des laufenden Ablaufs wird hier nicht gespeichert: Wer dann wartet, muss bei Straße-Grün noch einmal drücken.', () => GRA_AMPEL_FUSS(false)),
    ex('sortieren', 'Sortieren: Metallteile ausschieben', 'Förderband', 'foerderband', 'kop',
      'Der induktive Sensor B2 merkt sich ein Metallteil. Erreicht es die Lichtschranke B1, hält das Band, der Zylinder schiebt das Teil in die Rutsche, fährt zurück, und das Band läuft weiter. Helle Teile laufen bis zum Bandende.', bandSortier),
    ex('band-anlauf', 'Anlaufwarnung mit Einschaltverzögerung', 'Förderband', 'foerderband', 'fup',
      'Nach S1 Start leuchtet die Lampe H2 drei Sekunden lang als Warnung, erst dann läuft das Band. Stopp oder Not-Halt brechen den Anlauf ab. Der Merker M0.0 hält den Anlauf fest, das Zeitglied T1 (TON) wartet die drei Sekunden ab.', () => bandAnlauf('fup')),
    ex('tank-fuellautomat', 'Füllautomat mit Rührwerk', 'Tank', 'tank', 'kop',
      'S1 Start öffnet den Zulauf A, bei Füllstand Max (B3) schließt er wieder. Das Rührwerk läuft, sobald der Tank mindestens halb voll ist. Not-Halt und Stopp schalten ab, bei Not-Halt leuchtet die Störlampe.', tankFuellRuehr),
    ex('zweipunktregler', 'Zweipunktregler für den Füllstand', 'Tank', 'tank', 'kop',
      'Der Zulauf A öffnet, sobald der Füllstand unter die Mitte (B2) fällt, und schließt erst bei Max (B3). Die Selbsthaltung über Q0.0 erzeugt die Hysterese. Halte S1 gedrückt, um Wasser zu entnehmen, und beobachte, wie der Regler nachfüllt.', tankZweipunkt),
    ex('tor-verriegelung', 'Tippbetrieb mit Verriegelung', 'Garagentor', 'garagentor', 'kop',
      'Das Tor fährt nur, solange S1 Auf oder S2 Ab gedrückt ist. Die Endschalter schalten den jeweiligen Motor ab, und jeder Motor sperrt den anderen (Verriegelung). Das verhindert Kurzschluss und Überfahren der Endlagen.', torTipp),
    ex('tor-lichtschranke', 'Einklemmschutz mit Lichtschranke', 'Garagentor', 'garagentor', 'kop',
      'Ein Tastendruck fährt das Tor bis zum Endschalter, Stopp hält es an. Erkennt die Lichtschranke beim Schließen ein Hindernis, stoppt das Tor und fährt von selbst wieder auf. Stelle ein Hindernis ins Tor, um es auszuprobieren.', torSchutz),
    ex('gra-ausschieber', 'Ausschieber-Zyklus als GRAFCET', 'GRAFCET', 'foerderband', 'gra',
      'Nach Start läuft das Band, bis die Lichtschranke ein Teil meldet. Dann fährt der Ausschieber aus, danach wieder ein, und die Steuerung kehrt in die Grundstellung zurück. Jeder Schritt hat genau eine Aufgabe, die Transitionen warten auf die Endlagen.', () => GRA_SCHIEBER(false)),
    ex('gra-tank', 'Mischautomat als GRAFCET', 'GRAFCET', 'tank', 'gra',
      'Nach Start füllt Zulauf A bis zur Mitte, Zulauf B bis Max, das Rührwerk läuft 5 Sekunden, dann pumpt P1 ab, aber nur, wenn Behälter 2 leer ist. Not-Halt springt aus jedem Schritt in die Grundstellung.', () => GRA_MISCH(false)),
    ex('gra-tor', 'Tor-Automatik als GRAFCET', 'GRAFCET', 'garagentor', 'gra',
      'Ein Tastendruck startet 3 Sekunden Vorwarnung mit Blinklicht, dann fährt das Tor auf, bleibt 5 Sekunden offen (Beleuchtung) und fährt von selbst wieder zu. Das Blinklicht läuft bei jeder Fahrt mit.', () => GRA_TOR(false))
  ];

  /* ====================================================================== Prüfungen */
  // ---- Förderband Start/Stopp/Not-Halt (logisch) ----
  function checkBand(prog, r, o) {
    o = o || {};
    const S = logic(prog, 'foerderband', [
      { n: 20 }, { in: { 'I0.0': true }, n: 10 }, { n: 20 }, { in: { 'I0.1': false }, n: 10 }, { n: 20 },
      { in: { 'I0.0': true }, n: 10 }, { n: 5 }, { in: { 'I0.7': false }, n: 1 }, { in: { 'I0.7': false }, n: 20 },
      { in: { 'I0.7': false, 'I0.0': true }, n: 20 }, { n: 20 }, { in: { 'I0.0': true, 'I0.1': false }, n: 20 }, { n: 5 }]);
    const q = (i, k) => S[i].last[k || 'Q0.0'], never = (i) => !S[i].any['Q0.0'];
    r(never(0), 'Ohne Bedienung bleibt das Band aus', 'Im Ruhezustand darf K1 nicht eingeschaltet sein.');
    r(q(1), 'Der Start-Taster schaltet das Band ein', 'Nach einem Tastendruck auf S1 muss K1 (Q0.0) eingeschaltet sein.');
    r(q(2), 'Selbsthaltung: Das Band läuft nach dem Loslassen weiter', 'Q0.0 muss sich selbst halten, zum Beispiel mit einem Parallelkontakt Q0.0 neben S1.');
    r(!q(3), 'Der Stopp-Taster schaltet das Band aus', 'S2 ist ein Öffner: Im Ruhezustand liefert er 1. Frage ihn als Schließer-Kontakt ab, dann unterbricht er beim Drücken.');
    r(never(4), 'Nach dem Stopp bleibt das Band aus', 'Nach dem Loslassen von S2 darf das Band nicht von selbst wieder anlaufen.');
    r(q(5) && q(6) && !q(7), 'Not-Halt schaltet das Band sofort ab', 'S3 ist ebenfalls ein Öffner. Er gehört in Reihe zur Selbsthaltung.');
    r(never(8) && never(9) && never(10), 'Bei gedrücktem Not-Halt startet das Band nicht, auch nicht nach dem Loslassen', 'Start muss bei gedrücktem Not-Halt wirkungslos sein, und nach dem Loslassen von S3 darf nichts von selbst anlaufen.');
    r(never(11) && never(12), 'Stopp hat Vorrang vor Start', 'Wenn S1 und S2 gleichzeitig gedrückt sind, muss das Band aus bleiben.');
    r(S.every(s => s.cycles.every(c => c['Q0.2'] === c['Q0.0'])), 'Die Betriebslampe H1 leuchtet genau dann, wenn das Band läuft', 'Q0.2 (H1) soll dem Zustand von Q0.0 folgen.');
    if (o.stoer) r(S.every(s => s.cycles.every(c => c['Q0.3'] === (s.inp['I0.7'] === false))), 'Die Störlampe H2 leuchtet genau bei betätigtem Not-Halt', 'H2 (Q0.3) leuchtet, wenn S3 betätigt ist (Eingang I0.7 = 0), und sonst nicht.');
  }
  // ---- Garagentor Tippbetrieb ----
  function checkTipp(prog, r) {
    const s = script().press('I0.0', 500, 1500).press('I0.1', 4000, 1000).press('I0.0', 6000, 1000).press('I0.1', 6000, 1000)
      .press('I0.0', 8000, 8000).press('I0.1', 17000, 8000);
    const c = sim(prog, 'garagentor', { ms: 25500, scen: 'halboffen', drive: s.drive, sample: p => ({ pos: p.state().doorPos }) });
    const R = c.rec, pos = t => at(R, t).s.pos;
    r(pos(2500) > 70 && pos(2500) < 82, 'Auf: Das Tor fährt hoch, solange S1 gedrückt ist', 'Nach 1,5 s Auf-Taster muss das Tor um etwa 25 % gestiegen sein (von 50 % auf etwa 75 %). Motor Auf = Q0.0.');
    r(Math.abs(pos(3900) - pos(2600)) < 1, 'Beim Loslassen bleibt das Tor stehen (Tippbetrieb)', 'Der Motor darf nur laufen, solange der Taster gedrückt ist. Keine Selbsthaltung nötig.');
    r(pos(5500) < pos(4000) - 10, 'Ab: Das Tor fährt nach unten, solange S2 gedrückt ist', 'Motor Ab = Q0.1, gesteuert von S2 (I0.1).');
    r(!c.st.crash && !someOf(R, x => x.o['Q0.0'] && x.o['Q0.1']), 'Verriegelung: Auf und Ab laufen nie gleichzeitig', 'Bei gleichzeitigem Drücken beider Taster darf nie Q0.0 und Q0.1 zusammen an sein. Frage im Netzwerk für Auf den Ausgang Ab als Öffner ab und umgekehrt.');
    r(pos(16500) >= 98 && !someOf(win(R, 15000, 16500), x => x.o['Q0.0']), 'Der Endschalter oben schaltet den Motor ab', 'Bei Tor ganz oben (B1 = 1) darf Motor Auf nicht mehr laufen.');
    r(pos(25400) <= 2 && !c.st.overrun, 'Der Endschalter unten schaltet den Motor ab, ohne die Endlage zu überfahren', 'Bei Tor ganz unten (B2 = 1) darf Motor Ab nicht mehr laufen, sonst meldet die Anlage „Endschalter überfahren“.');
  }
  // ---- Garagentor Selbsthaltung bis Endschalter ----
  function checkTorAuto(prog, r) {
    const s = script().press('I0.0', 500, 200).press('I0.1', 3000, 200).press('I0.1', 8000, 200).press('I0.5', 10000, 200, true).press('I0.1', 13000, 200);
    const c = sim(prog, 'garagentor', { ms: 20000, scen: 'zu', drive: s.drive, sample: p => ({ pos: p.state().doorPos }) });
    const R = c.rec, pos = t => at(R, t).s.pos;
    r(pos(2000) > 20 && pos(2000) < 35, 'Auf: Ein kurzer Tastendruck startet die Fahrt, das Tor fährt von selbst weiter', 'Q0.0 muss sich nach dem Loslassen von S1 selbst halten.');
    r(pos(5000) > 70 && pos(5000) > pos(3200), 'Der Ab-Taster wird während der Fahrt nach oben ignoriert', 'Solange Motor Auf läuft, darf Motor Ab nicht anlaufen (Verriegelung).');
    r(pos(7500) >= 98 && !someOf(win(R, 7000, 7600), x => x.o['Q0.0']), 'Am Endschalter oben schaltet der Motor ab', 'B1 (I0.2) muss Motor Auf abschalten.');
    r(pos(10500) > 20 && pos(10500) < 90 && Math.abs(pos(12500) - pos(10500)) < 1, 'Der Stopp-Taster hält das Tor mitten in der Fahrt an', 'S3 ist ein Öffner (Ruhe = 1). Er muss beide Selbsthaltungen lösen und darf das Tor nicht von selbst wieder anfahren.');
    r(pos(19900) <= 2 && !someOf(win(R, 18000, 20000), x => x.o['Q0.1']), 'Nach neuem Ab-Tastendruck fährt das Tor bis unten und der Motor schaltet am Endschalter ab', 'B2 (I0.3) schaltet Motor Ab ab.');
    r(!c.st.crash && !c.st.overrun, 'Kein Crash und keine überfahrene Endlage', 'Auf und Ab nie gleichzeitig, Endschalter beachten.');
  }
  // ---- Tank Füllen ----
  function checkTankFuell(prog, r) {
    const a = sim(prog, 'tank', { ms: 17000, drive: script().press('I0.0', 300, 200).drive, sample: p => ({ lv: p.state().level }) });
    const lv = (c, t) => at(c.rec, t).s.lv;
    r(lv(a, 3000) > 15 && lv(a, 6000) > lv(a, 3000) + 15, 'Start öffnet den Zulauf A, der Tank füllt sich', 'Nach S1 muss Q0.0 (Y1) bleibend eingeschaltet sein (Selbsthaltung).');
    r(lv(a, 16900) >= 89.5 && lv(a, 16900) < 100 && !a.st.overflow && !someOf(win(a.rec, 14000, 17000), x => x.o['Q0.0']), 'Bei Füllstand Max schließt der Zulauf, kein Überlauf', 'B3 (I0.4) meldet 90 %. Ab dann muss der Zulauf geschlossen sein, sonst läuft der Tank über.');
    const sB = script().press('I0.0', 300, 200).press('I0.1', 3000, 200, true).press('I0.0', 5500, 200).press('I0.6', 7500, 1000, true);
    const b = sim(prog, 'tank', { ms: 10500, drive: sB.drive, sample: p => ({ lv: p.state().level }) });
    r(!at(b.rec, 3500).o['Q0.0'] && Math.abs(lv(b, 5000) - lv(b, 3500)) < 0.05, 'Stopp schließt den Zulauf sofort und er bleibt zu', 'S2 ist ein Öffner: Als Schließer-Kontakt in die Selbsthaltung in Reihe schalten.');
    r(lv(b, 7000) > lv(b, 5000) + 5, 'Nach dem Stopp füllt ein neuer Start den Tank weiter', 'Nach Stopp muss S1 den Zulauf wieder öffnen können.');
    r(!someOf(win(b.rec, 7600, 10500), x => x.o['Q0.0']) && Math.abs(lv(b, 10400) - lv(b, 7600)) < 0.05, 'Not-Halt schließt den Zulauf sofort, es gibt keinen Neustart nach dem Loslassen', 'S3 (I0.6) ist ein Öffner und gehört in Reihe zur Selbsthaltung.');
    r(at(b.rec, 8000).o['Q0.5'] && !at(b.rec, 10000).o['Q0.5'] && !at(b.rec, 2000).o['Q0.5'], 'Die Störlampe H1 leuchtet nur bei betätigtem Not-Halt', 'H1 (Q0.5) = NICHT S3 (I0.6).');
    const c = sim(prog, 'tank', { ms: 3000, scen: 'voll', drive: script().press('I0.0', 300, 200).drive });
    r(!someOf(c.rec, x => x.o['Q0.0']) && c.st.spilled === 0, 'Bei vollem Behälter öffnet der Start den Zulauf nicht', 'Der Zulauf darf nur öffnen, wenn B3 (Max) noch nicht erreicht ist.');
  }
  // ---- Tank Pumpe ----
  function checkTankPumpe(prog, r) {
    const a = sim(prog, 'tank', { ms: 12000, scen: p => p.scenarios.applyState({ level: 60, level2: 0, fracB: 0.5, mixed: 1 }), drive: script().press('I0.0', 300, 200).drive, sample: p => ({ lv: p.state().level }) });
    r(someOf(win(a.rec, 1000, 3000), x => x.o['Q0.4']) && at(a.rec, 5000).s.lv < at(a.rec, 2000).s.lv - 15, 'Start pumpt ab, wenn Behälter 2 leer ist (Selbsthaltung)', 'Pumpe P1 = Q0.4 muss nach S1 bleiben. B4 (I0.5) meldet Behälter 2 leer.');
    r(at(a.rec, 11900).s.lv < 10 && !someOf(win(a.rec, 11000, 12000), x => x.o['Q0.4']) && !a.st.dryRun, 'Bei Füllstand unter Min schaltet die Pumpe ab (kein Trockenlauf)', 'B1 (I0.2) meldet mindestens 10 %. Fällt B1 weg, muss die Pumpe aus sein.');
    const b = sim(prog, 'tank', { ms: 16000, scen: p => p.scenarios.applyState({ level: 60, level2: 50, fracB: 0.5, mixed: 1 }), drive: script().press('I0.0', 300, 200).drive });
    r(!someOf(b.rec, x => x.o['Q0.4']), 'Ist Behälter 2 nicht leer, startet die Pumpe nicht', 'Beim Start muss B4 = 1 sein. Nach dem Loslassen des Tasters darf die Pumpe später auch nicht von selbst anlaufen.');
    const sC = script().press('I0.0', 300, 200).press('I0.1', 2000, 200, true);
    const c = sim(prog, 'tank', { ms: 5000, scen: p => p.scenarios.applyState({ level: 80, level2: 0, fracB: 0.5, mixed: 1 }), drive: sC.drive });
    r(someOf(win(c.rec, 1000, 2000), x => x.o['Q0.4']) && !someOf(win(c.rec, 2100, 5000), x => x.o['Q0.4']), 'Stopp schaltet die Pumpe aus und sie bleibt aus', 'S2 ist ein Öffner und gehört in Reihe zur Selbsthaltung.');
    const sD = script().press('I0.0', 300, 200).press('I0.6', 2000, 200, true);
    const d = sim(prog, 'tank', { ms: 5000, scen: p => p.scenarios.applyState({ level: 80, level2: 0, fracB: 0.5, mixed: 1 }), drive: sD.drive });
    r(!someOf(win(d.rec, 2100, 5000), x => x.o['Q0.4']), 'Not-Halt schaltet die Pumpe sofort ab', 'S3 (I0.6) ist ein Öffner, wie S2.');
  }

  /* ---- einzelne Aufgabenprüfungen ---- */
  const checkSp1 = mkCheck((prog, r) => {
    const rows = [];
    for (let m = 0; m < 8; m++) {
      const b1 = !!(m & 1), b2 = !!(m & 2), s2 = !!(m & 4);
      [0, 1].forEach(z => {
        const S = logic(prog, 'garagentor', [{ in: { 'I0.1': s2, 'I0.3': b2, 'I0.4': b1, 'I0.0': !!z, 'I0.2': !z, 'I0.5': !z }, n: 3 }]);
        rows.push({ m, z, got: !!S[0].last['Q0.3'], want: ((!b2) || b1) && !s2 });
      });
    }
    const bad = rows.filter(x => x.got !== x.want);
    const grp = (f) => rows.filter(f).every(x => x.got === x.want);
    r(grp(x => !(x.m & 4) && !(x.m & 2) && !(x.m & 1)), 'Tor nicht ganz unten: Das Licht brennt', 'B2 (I0.3) = 0 bedeutet: Das Tor steht nicht ganz unten. Dann soll H2 leuchten, wenn S2 nicht gedrückt ist (Öffner-Kontakt für B2).');
    r(grp(x => !(x.m & 4) && (x.m & 2) && !(x.m & 1)), 'Tor ganz unten und frei: Das Licht bleibt aus', 'Ist B2 = 1 und B3 = 0, darf H2 nicht leuchten.');
    r(grp(x => !(x.m & 4) && (x.m & 2) && (x.m & 1)), 'Hindernis in der Lichtschranke: Das Licht brennt auch bei Tor unten', 'B3 (I0.4) = 1 schaltet H2 per ODER ein.');
    r(grp(x => !!(x.m & 4)), 'Solange S2 gedrückt ist, bleibt das Licht aus (UND mit NICHT S2)', 'Verknüpfe das Ergebnis aus „nicht unten ODER Hindernis“ mit UND S2-Öffner: S2 gedrückt sperrt H2.');
    r(bad.length === 0, 'Wahrheitstabelle vollständig richtig (alle 16 Fälle)', 'Prüfe H2 = ((NICHT B2) ODER B3) UND (NICHT S2).');
  });
  const checkSp2 = mkCheck((prog, r) => checkBand(prog, r));
  const checkSp3 = mkCheck((prog, r) => checkTipp(prog, r));
  const checkSp4 = mkCheck((prog, r) => {
    const S = logic(prog, 'garagentor', [{ n: 5 }, { in: { 'I0.0': true }, n: 3 }, { n: 5 }, { in: { 'I0.0': true }, n: 50 }, { n: 5 }, { in: { 'I0.0': true }, n: 3 }, { n: 3 }]);
    r(!S[0].any['Q0.3'], 'Ohne Tastendruck bleibt das Licht aus', 'H2 (Q0.3) darf im Ruhezustand nicht leuchten.');
    r(S[1].last['Q0.3'] && S[2].last['Q0.3'], 'Der erste Tastendruck schaltet das Licht ein, es bleibt nach dem Loslassen an', 'Q0.3 muss sich den Zustand merken: Verwende die Flanke (P) von S1 und den Ausgang selbst.');
    r(!S[3].any['Q0.3'] && !S[4].any['Q0.3'], 'Der zweite Tastendruck schaltet das Licht aus, auch wenn du lange drückst', 'Es darf nur beim Drücken (steigende Flanke) umgeschaltet werden, nicht mehrmals, solange S1 gehalten wird.');
    r(S[5].last['Q0.3'] && S[6].last['Q0.3'], 'Der dritte Tastendruck schaltet wieder ein', 'Jeder Tastendruck wechselt den Zustand (XOR von Q0.3 und Flanke).');
  });
  const checkSp5 = mkCheck((prog, r) => {
    const S = logic(prog, 'foerderband', [{ n: 10 }, { in: { 'I0.0': true }, n: 10 }, { n: 100 }, { n: 150 }, { n: 60 }, { n: 300 }, { in: { 'I0.1': false }, n: 10 },
      { n: 20 }, { in: { 'I0.0': true }, n: 10 }, { n: 50 }, { in: { 'I0.1': false }, n: 10 }, { n: 500 }]);
    r(!S[0].any['Q0.0'] && !S[0].any['Q0.3'], 'Ohne Start passiert nichts', 'Ruhezustand: K1 und H2 aus.');
    r(S[1].last['Q0.3'] && !S[1].any['Q0.0'], 'Nach Start leuchtet die Warnlampe H2, das Band bleibt noch aus', 'H2 (Q0.3) sofort einschalten, K1 (Q0.0) noch nicht.');
    r(S[2].last['Q0.3'] && !S[2].any['Q0.0'] && S[3].last['Q0.3'] && !S[3].any['Q0.0'], 'Während der 3 Sekunden Vorlaufzeit warnt H2 und das Band steht', 'Die Zeitverzögerung (TON) soll 3000 ms betragen. Der Anlauf muss sich bis zum Ablauf selbst halten (Merker).');
    r(S[4].last['Q0.0'] && !S[4].last['Q0.3'] && S[5].last['Q0.0'], 'Nach 3 Sekunden läuft das Band und die Warnlampe erlischt', 'Nach Ablauf von T1 gehört K1 an und H2 aus.');
    r(!S[6].last['Q0.0'] && !S[6].last['Q0.3'], 'Stopp schaltet Band und Warnlampe aus', 'S2 ist ein Öffner: Er unterbricht den Merker.');
    r(S[9].last['Q0.3'] && !S[10].last['Q0.3'] && !S[10].last['Q0.0'] && !S[11].any['Q0.0'] && !S[11].any['Q0.3'], 'Ein Stopp während der Warnzeit bricht den Anlauf ab, das Band läuft später nicht an', 'Wenn der Anlauf-Merker gelöscht wird, wird auch T1 zurückgesetzt. Das Band darf nicht nach dem Loslassen von S2 anlaufen.');
  });
  const checkSp6 = mkCheck((prog, r) => {
    const S = logic(prog, 'garagentor', [{ n: 10 }, { in: { 'I0.0': true }, n: 20 }, { n: 200 }, { n: 230 }, { n: 100 },
      { in: { 'I0.0': true }, n: 100 }, { in: { 'I0.0': true }, n: 550 }, { n: 50 }, { in: { 'I0.0': true }, n: 20 }, { n: 100 }, { n: 450 }, { n: 100 }]);
    r(!S[0].any['Q0.3'] && S[1].last['Q0.3'], 'Ein Tastendruck schaltet das Licht ein', 'H2 (Q0.3) soll nach S1 leuchten.');
    r(S[2].last['Q0.3'] && S[3].last['Q0.3'], 'Das Licht bleibt nach dem Loslassen an', 'Der Impuls (TP) läuft unabhängig vom Taster weiter. TP braucht die Zeit PT = 5000 ms.');
    r(!S[4].last['Q0.3'], 'Nach 5 Sekunden ist das Licht aus', 'Der Impuls soll genau 5 s dauern.');
    r(!S[6].last['Q0.3'], 'Bei dauernd gedrücktem Taster geht das Licht trotzdem nach 5 Sekunden aus', 'Die Zeit startet mit der steigenden Flanke und läuft ab: Das ist ein Impuls (TP), keine Ausschaltverzögerung.');
    r(S[8].last['Q0.3'] && S[9].last['Q0.3'] && !S[10].last['Q0.3'], 'Ein neuer Tastendruck startet 5 Sekunden Licht erneut', 'Nach Ablauf muss ein neuer Tastendruck wieder einen Impuls auslösen.');
  });
  const checkSp7 = mkCheck((prog, r) => {
    const S = logic(prog, 'foerderband', [{ n: 10 }, { in: { 'I0.0': true }, n: 10 }, { n: 200 }, { in: { 'I0.1': false }, n: 10 }, { n: 200 }, { n: 140 }, { n: 100 }, { n: 100 }]);
    r(!S[0].any['Q0.2'] && S[1].last['Q0.2'] && S[1].last['Q0.0'], 'Mit dem Band geht die Lampe H1 sofort an', 'H1 (Q0.2) folgt Q0.0 beim Einschalten ohne Verzögerung (TOF schaltet sofort ein).');
    r(S[2].last['Q0.2'] && S[2].last['Q0.0'], 'Die Lampe leuchtet, solange das Band läuft', 'Band läuft: H1 an.');
    r(!S[3].last['Q0.0'] && S[3].last['Q0.2'], 'Nach dem Stopp steht das Band, die Lampe leuchtet noch', 'Die Lampe soll nach dem Ausschalten des Bandes noch nachleuchten (Ausschaltverzögerung TOF).');
    r(S[4].last['Q0.2'] && S[5].last['Q0.2'], 'Die Lampe leuchtet mindestens 3,5 Sekunden nach', 'PT des TOF = 4000 ms.');
    r(!S[6].last['Q0.2'] && !S[7].last['Q0.2'], 'Nach etwa 4 Sekunden Nachlauf ist die Lampe aus', 'Nach 4 s ohne Band geht H1 aus. Nicht länger als 4,5 s.');
  });
  const checkSp8 = mkCheck((prog, r) => {
    const s = script().press('I0.0', 300, 200).press('I0.0', 14000, 300);
    s.at(0, p => [560, 460, 360, 260, 160].forEach(x => p.addPiece(false, x)));
    let edges = 0, prev = false, snap = {};
    const c = sim(prog, 'foerderband', { opts: { spawn: false }, ms: 22000, drive: s.drive, each: (t, cx) => {
      const b5 = cx.inp['I0.6']; if (b5 && !prev) edges++; prev = b5;
      if (t === 13900) snap = { q: cx.out['Q0.0'], h2: cx.out['Q0.3'], edges, del: cx.plant.state().delivered };
      if (t === 21900) snap.q2 = cx.out['Q0.0'], snap.h22 = cx.out['Q0.3'];
    } });
    r(!someOf(win(c.rec, 0, 300), x => x.o['Q0.0']) && someOf(win(c.rec, 600, 1200), x => x.o['Q0.0']), 'Start schaltet das Band ein', 'K1 (Q0.0) mit Selbsthaltung steuern.');
    r(snap.edges === 4 && snap.q === false, 'Das Band hält an, sobald das 4. Werkstück Sensor B5 erreicht', 'Zähler C1 (CTU) mit PV = 4 und dem Sensor B5 (I0.6) als Zähleingang. Bei C1.Q muss das Band ausgehen.');
    r(snap.h2 === true, 'Die Lampe H2 zeigt „Kiste voll“ (Zähler erreicht)', 'H2 (Q0.3) soll mit C1.Q leuchten.');
    r(snap.q2 === true && snap.h22 === false, 'Start setzt den Zähler zurück und das Band läuft wieder an', 'Der Reset-Eingang von C1 muss von S1 (I0.0) kommen, sonst bleibt C1.Q gesetzt.');
  });
  const checkSp9 = mkCheck((prog, r) => {
    const s = script().set('I0.1', 8000, true).set('I0.1', 10000, false);
    const c = sim(prog, 'ampel', { opts: { cars: false, peds: false }, ms: 14000, drive: s.drive });
    const R = c.rec, w1 = win(R, 1000, 7000), w2 = win(R, 8200, 9900), w3 = win(R, 10200, 14000);
    const n1 = rises(w1, x => x.o['Q0.1']), d1 = duty(w1, x => x.o['Q0.1']);
    r(allOf(w1, x => !x.o['Q0.0'] && !x.o['Q0.2'] && !x.o['Q0.4']), 'Nachts leuchten nur das Gelb der Straße, alle anderen Lampen sind aus', 'Betrieb aus (S2 = 0): Nur H2 (Q0.1) darf blinken.');
    r(n1 >= 5 && n1 <= 7, 'Das Gelb blinkt etwa einmal pro Sekunde', 'Du brauchst zwei Zeitglieder: eine Pause von 0,5 s und eine Leuchtzeit von 0,5 s. Gemessen: ' + n1 + ' Blinkimpulse in 6 s, erwartet 6.');
    r(d1 > 0.35 && d1 < 0.65, 'Leuchtzeit und Pause sind etwa gleich lang', 'Gemessener Leuchtanteil: ' + Math.round(d1 * 100) + ' %. Erwartet etwa 50 %.');
    r(allOf(w2, x => x.o['Q0.2'] && x.o['Q0.3'] && !x.o['Q0.0'] && !x.o['Q0.1'] && !x.o['Q0.4']), 'Im Betrieb steht die Straße auf Grün und die Fußgängerampel auf Rot', 'S2 = 1: H3 (Q0.2) grün und H4 (Q0.3) rot dauerhaft, alles andere aus.');
    r(rises(w3, x => x.o['Q0.1']) >= 3 && allOf(w3, x => !x.o['Q0.2'] && !x.o['Q0.3']), 'Wird der Betrieb ausgeschaltet, blinkt das Gelb sofort wieder', 'Beim Ausschalten müssen Grün und Fußgänger-Rot erlöschen und das Blinken weitergehen.');
    r(c.st.violations === 0, 'Die Anlage meldet keine Verstöße', 'Die Ampel zeigt gleichzeitig widersprüchliche Lichter.');
  });
  const checkSp10 = mkCheck((prog, r) => {
    const s = script().set('I0.1', 0, true).at(500, p => p.addPed(0, 'wait')).press('I0.0', 3000, 300);
    const c = sim(prog, 'ampel', { opts: { cars: false, peds: false }, ms: 30000, drive: s.drive });
    const R = c.rec, T = (f, from) => first(R, f, from), rot = x => x.o['Q0.0'] && !x.o['Q0.2'];
    const gelb = runs(R, x => x.o['Q0.1'] && !x.o['Q0.0'] && !x.o['Q0.2'])[0];
    const fg = runs(R, x => x.o['Q0.4'])[0];
    const rotStart = T(rot, 2000), gruenWieder = fg ? T(x => x.o['Q0.2'], fg.to) : null;
    r(allOf(win(R, 200, 2900), x => x.o['Q0.2'] && x.o['Q0.3'] && !x.o['Q0.4'] && !x.o['Q0.0']), 'Ohne Fußgängerwunsch bleibt die Straße grün', 'Grundstellung: H3 (Q0.2) grün, H4 (Q0.3) rot. Erst der Taster S1 startet die Umschaltung.');
    r(!!gelb && gelb.to - gelb.from >= 1500 && gelb.to - gelb.from <= 6000, 'Nach dem Tastendruck zeigt die Straße zuerst mindestens 1,5 s Gelb', 'Gelb allein (Q0.1) vor Rot: etwa 2 s.');
    r(!!fg && !!rotStart && fg.from - rotStart.t >= 800, 'Der Fußgänger bekommt erst nach einer Räumzeit Grün, während die Straße schon Rot hat', 'Zwischen Straße Rot und Fußgänger-Grün (H5 = Q0.4) soll mindestens etwa 1 s liegen.');
    r(!!fg && fg.to - fg.from >= 4000 && fg.to - fg.from <= 10000 && c.st.pedsCrossed === 1 && c.st.pedsCrashed === 0, 'Das Fußgänger-Grün dauert 4 bis 10 s, der Fußgänger kommt sicher über die Straße', 'Plane etwa 5 s Fußgänger-Grün (t/Sx/5s) ein.');
    r(!!gruenWieder && gruenWieder.t - fg.to >= 3000, 'Nach dem Fußgänger-Grün bleibt die Straße noch mindestens 3 s Rot (Räumzeit)', 'Die Fußgänger brauchen nach Grün-Ende noch etwa 4 s. In dieser Zeit muss die Straße Rot zeigen.');
    r(!!gruenWieder && allOf(R, x => (x.o['Q0.3'] ? 1 : 0) + (x.o['Q0.4'] ? 1 : 0) === 1), 'Die Fußgängerampel zeigt immer genau Rot oder Grün', 'H4 Rot (Q0.3) leuchtet, solange H5 Grün (Q0.4) nicht leuchtet.');
    r(!!gruenWieder && at(R, 29900).o['Q0.2'] && c.st.violations === 0, 'Danach wird die Straße wieder grün, es gab keine Verstöße (nie gleichzeitig Grün)', 'Zum Schluss Rot-Gelb (1 s), dann zurück in die Grundstellung. Die Anlage meldet: ' + (c.st.violations ? c.st.violations + ' Verstoß' : 'in Ordnung'));
    const s2 = script().set('I0.1', 0, true);
    const d = sim(prog, 'ampel', { opts: { scenario: 'viele_fussgaenger', seed: 3 }, ms: 60000, drive: s2.drive });
    r(d.st.violations === 0 && !d.st.crash && d.st.pedsCrossed >= 2, 'Im Verkehr: Fußgänger kommen herüber, keine Unfälle, keine Verstöße', 'Bei Verkehr: ' + d.st.pedsCrossed + ' Fußgänger geschafft, Unfälle: ' + d.st.carsCrashed + ', Verstöße: ' + d.st.violations + '.');
  });
  /* Einsetzen von Teilen im Abstand: die Warteschlange q liefert Werkstücke (true = dunkel), erst wenn der Platz am Anfang frei ist */
  const feeder = (queue) => (t, p) => { if (queue.length) { const x = p.state().pieceX; if (x.every(xx => xx >= 340)) p.addPiece(queue[0], 100) && queue.shift(); } };
  const checkSp11 = mkCheck((prog, r) => {
    const q = [true, false, true, false, false, true], sA = script().press('I0.0', 500, 200);
    const fd = feeder(q);
    const a = sim(prog, 'foerderband', { opts: { spawn: false }, ms: 40000, drive: (t, p, c) => { sA.drive(t, p, c); fd(t, p); } });
    r(!someOf(win(a.rec, 0, 500), x => x.o['Q0.0']), 'Ohne Start steht das Band', 'K1 darf erst nach S1 laufen.');
    r(a.st.sortedMetal === 3, 'Alle 3 dunklen Teile landen in der Rutsche', 'Gemessen: ' + a.st.sortedMetal + ' von 3. Merke dir mit B2 (I0.3), dass ein dunkles Teil kommt, und stoppe an B1 (I0.2).');
    r(a.st.sortedLight === 0 && a.st.deliveredLight === 3, 'Alle 3 hellen Teile laufen bis zum Bandende durch', 'Gemessen: ' + a.st.deliveredLight + ' von 3 am Bandende, ' + a.st.sortedLight + ' fälschlich ausgeschoben.');
    r(!someOf(a.rec, x => x.o['Q0.0'] && x.o['Q0.1']), 'Band und Ausschieber arbeiten nie gleichzeitig', 'Das Band muss stehen, solange der Zylinder ausfährt: Frage Y1 (Q0.1) im Netzwerk für das Band als Öffner ab.');
    r(!a.st.crash && a.st.lost === 0 && a.st.violations === 0, 'Kein Crash, kein Werkstück verloren', 'Der Zylinder darf nur ausfahren, wenn das Teil vor ihm steht: Band sofort stoppen, wenn B1 meldet.');
    const sB = script().press('I0.0', 300, 200).press('I0.7', 3000, 1000, true), q2 = [false, false, false], fd2 = feeder(q2);
    const b = sim(prog, 'foerderband', { opts: { spawn: false }, ms: 8000, drive: (t, p, c) => { sB.drive(t, p, c); fd2(t, p); } });
    r(someOf(win(b.rec, 1000, 3000), x => x.o['Q0.0']) && !someOf(win(b.rec, 3050, 8000), x => x.o['Q0.0'] || x.o['Q0.1']), 'Not-Halt stoppt sofort, nach dem Loslassen läuft nichts von selbst an', 'S3 (I0.7) ist Öffner und muss alle Ausgaben abschalten, das Band braucht einen neuen Start.');
  });
  const checkSp12 = mkCheck((prog, r) => {
    const s = script().press('I0.0', 300, 200).press('I0.0', 10000, 200).press('I0.0', 17000, 200).press('I0.7', 19000, 300, true);
    s.at(0, p => [300, 150].forEach(x => p.addPiece(false, x)));
    let d9 = null, d15 = null, d189 = null;
    const c = sim(prog, 'foerderband', { opts: { spawn: false }, ms: 20000, drive: s.drive, each: (t, cx) => {
      const sx = () => cx.plant.state().delivered;
      if (t === 9000) d9 = { q: cx.out['Q0.0'], del: sx(), b5: cx.inp['I0.6'] };
      if (t === 15000) d15 = { q: cx.out['Q0.0'], del: sx(), b5: cx.inp['I0.6'] };
      if (t === 18900) d189 = { q: cx.out['Q0.0'], del: sx() };
    } });
    r(someOf(win(c.rec, 600, 5000), x => x.o['Q0.0']), 'Start schaltet das Band ein', 'K1 (Q0.0) mit Selbsthaltung.');
    r(d9.q === false && d9.b5 === true && d9.del === 0, 'Das Band hält an, sobald ein Werkstück den Sensor B5 erreicht', 'Verwende die steigende Flanke (P) von B5 (I0.6), um die Selbsthaltung zu lösen.');
    r(d15.del === 1 && d15.q === false && d15.b5 === true, 'Ein neuer Start fährt das Teil ab, das Band hält beim nächsten Teil wieder an', 'Mit einem Pegel statt Flanke würde das Band mit stehendem Teil nie wieder anlaufen. Nutze die Flanke.');
    r(d189.q === true && d189.del === 2, 'Nach dem letzten Teil läuft das Band weiter', 'Ohne Werkstück am Sensor darf nichts stoppen.');
    r(!at(c.rec, 19200).o['Q0.0'] && !someOf(win(c.rec, 19400, 20000), x => x.o['Q0.0']), 'Not-Halt schaltet das Band ab', 'S3 (I0.7) ist ein Öffner in Reihe zur Selbsthaltung.');
    r(allOf(c.rec, x => x.o['Q0.2'] === x.o['Q0.0']), 'Die Lampe H1 leuchtet genau dann, wenn das Band läuft', 'Q0.2 soll Q0.0 folgen.');
  });
  const checkSp13 = mkCheck((prog, r) => checkTankFuell(prog, r));
  const checkSp14 = mkCheck((prog, r) => {
    const sm = (o) => { return { opts: o, sample: p => { const st = p.state(); return { lv: st.level, mf: st.mixTimeFullMs, l2: st.level2 }; } }; };
    const dr = x => x.o['Q0.3'] || x.o['Q0.4'];
    const aOpt = sm(); aOpt.ms = 30000; aOpt.drive = script().press('I0.0', 300, 200).drive;
    const a = sim(prog, 'tank', aOpt);
    const fa = first(a.rec, x => x.o['Q0.0']), fb = first(a.rec, x => x.o['Q0.1']), fp = first(a.rec, dr);
    r(!!fa && !!fb && fb.t > fa.t && fb.s.lv > 47 && fb.s.lv < 56, 'Zuerst läuft Zulauf A bis zur Mitte, dann Zulauf B', 'Erst Y1 (Q0.0) bis B2 (I0.3) meldet 50 %, dann Y2 (Q0.1).');
    r(a.st.fills >= 1 && !a.st.overflow && !someOf(a.rec, x => x.o['Q0.1'] && at(a.rec, x.t).s.lv > 98), 'Der Tank wird bis Füllstand Max gefüllt, ohne überzulaufen', 'Zulauf B schließt, wenn B3 (I0.4) meldet.');
    r(!!fp && fp.s.mf >= 4500 && a.st.mixTimeFullMs >= 4500, 'Das Rührwerk läuft mindestens 5 s im vollen Tank, bevor abgepumpt wird', 'Schritt „Rühren“: M1 (Q0.2) mit Transition t/S3/5s. Gemessene Rührzeit bei voll: ' + sec(a.st.mixTimeFullMs) + ' s.');
    r(a.st.batches === 1 && a.st.badBatches === 0 && !a.st.dryRun && a.st.level < 10, 'Die Charge wird vollständig abgepumpt, die Pumpe läuft nicht trocken', 'Pumpe P1 (Q0.4) läuft, bis B1 (I0.2) unter 10 % meldet.');
    const bOpt = sm(); bOpt.ms = 29000; bOpt.drive = script().press('I0.0', 300, 200).drive; bOpt.scen = p => p.scenarios.applyState({ level: 95, level2: 60, fracB: 0.5, mixed: 1 });
    const b = sim(prog, 'tank', bOpt);
    const fp2 = first(b.rec, dr);
    r(!!fp2 && fp2.i['I0.5'] === true && fp2.s.l2 < 1.5 && !b.st.overflow2 && b.st.batches === 1, 'Die Pumpe läuft erst, wenn Behälter 2 leer ist (B4)', 'Die Transition vor „Abpumpen“ braucht UND B4 (I0.5). Sonst läuft Behälter 2 über.');
    const sC = script().press('I0.0', 300, 200).press('I0.6', 4000, 500, true);
    const c = sim(prog, 'tank', { ms: 12000, drive: sC.drive });
    r(someOf(win(c.rec, 1000, 3900), x => x.o['Q0.0'] || x.o['Q0.1']) && !someOf(win(c.rec, 4100, 12000), x => Object.keys(x.o).some(k => x.o[k])), 'Not-Halt bricht den Ablauf ab: alle Ausgänge aus, kein Neustart von selbst', 'Von jedem Schritt führt eine Transition mit NICHT S3 (I0.6) zurück in die Grundstellung S0.');
  });
  const checkSp15 = mkCheck((prog, r) => checkTorAuto(prog, r));
  const checkSp16 = mkCheck((prog, r) => {
    const s = script().press('I0.1', 500, 200).at(2500, p => p.setObstacle(true, 'auto')).at(7000, p => p.setObstacle(false))
      .at(12000, p => p.setObstacle(true, 'person')).press('I0.1', 13000, 200).at(16500, p => p.setObstacle(false)).press('I0.1', 17500, 200);
    const c = sim(prog, 'garagentor', { ms: 20000, scen: 'offen', drive: s.drive, sample: p => ({ pos: p.state().doorPos }) });
    const R = c.rec, pos = t => at(R, t).s.pos;
    r(pos(2000) < 85 && someOf(win(R, 800, 2400), x => x.o['Q0.1']), 'Ohne Hindernis fährt das Tor beim Ab-Tastendruck nach unten', 'Motor Ab (Q0.1) startet nach S2 mit Selbsthaltung.');
    r(!someOf(win(R, 2600, 20000), x => x.s.pos < 46 && x.t < 12000) && !c.st.crash, 'Taucht beim Schließen ein Hindernis auf, stoppt das Tor sofort', 'B3 (I0.4) = 1: Motor Ab muss sofort abschalten, sonst fährt das Tor gegen das Hindernis (Crash).');
    r(pos(11500) >= 98, 'Danach fährt das Tor von selbst ganz auf', 'Merke dir das Hindernis mit einem Merker (M0.0), halte Motor Auf an, bis B1 (I0.2) meldet.');
    r(allOf(win(R, 13000, 16400), x => x.s.pos >= 97 && !x.o['Q0.1']), 'Solange das Hindernis im Tor steht, fährt das Tor nicht zu', 'Motor Ab darf nur laufen, wenn B3 (I0.4) = 0.');
    r(pos(19500) < 90 && !c.st.overrun, 'Ist das Hindernis weg, fährt das Tor wieder normal zu', 'Der Merker für „Hindernis“ muss gelöscht sein, sonst bleibt das Tor offen.');
    const mot = win(R, 800, 2500).concat(win(R, 2700, 4400)).filter(x => x.o['Q0.0'] || x.o['Q0.1']);
    r(mot.length > 100 && allOf(mot, x => x.o['Q0.2']), 'Das Blinklicht H1 leuchtet bei jeder Motorfahrt', 'H1 (Q0.2) = Motor Auf ODER Motor Ab.');
  });
  const checkSp17 = mkCheck((prog, r) => {
    const s = script().set('I0.1', 0, true);
    const c = sim(prog, 'ampel', { opts: { cars: false, peds: false }, ms: 30000, drive: s.drive });
    const ph = x => { const a = x.o['Q0.0'], b = x.o['Q0.1'], g = x.o['Q0.2']; return g && !a && !b ? 'G' : b && !a && !g ? 'Y' : a && !b && !g ? 'R' : a && b && !g ? 'RY' : 'X'; };
    const seq = [];
    c.rec.forEach(x => { const p = ph(x); if (!seq.length || seq[seq.length - 1].p !== p) seq.push({ p, from: x.t, to: x.t + 10 }); else seq[seq.length - 1].to = x.t + 10; });
    const want = [['G', 5000], ['Y', 2000], ['R', 5000], ['RY', 1000], ['G', 5000], ['Y', 2000], ['R', 5000], ['RY', 1000]];
    const okd = i => seq[i] && seq[i].p === want[i][0] && Math.abs((seq[i].to - seq[i].from) - want[i][1]) <= 400;
    r(!someOf(c.rec, x => ph(x) === 'X'), 'Die Straßenampel zeigt nur gültige Lichtfolgen (nie Grün mit Rot oder Gelb)', 'Gültig sind Grün, Gelb, Rot und Rot-Gelb jeweils allein.');
    r(okd(0), 'Grün dauert 5 s', 'Die Transition aus dem Schritt Grün lautet t/S0/5s.');
    r(okd(1), 'Danach folgt Gelb für 2 s', 'Gelb (Q0.1) genau 2 s.');
    r(okd(2), 'Danach folgt Rot für 5 s', 'Rot (Q0.0) genau 5 s.');
    r(okd(3), 'Danach folgt Rot-Gelb für 1 s', 'Rot und Gelb zusammen (Q0.0 und Q0.1) für 1 s.');
    r(okd(4) && okd(5) && okd(6) && okd(7), 'Der Zyklus wiederholt sich fehlerfrei', 'Der letzte Schritt (Rot-Gelb) muss in den ersten Schritt (Grün) zurückführen.');
    r(allOf(c.rec, x => x.o['Q0.3'] && !x.o['Q0.4']) && c.st.violations === 0, 'Die Fußgängerampel bleibt rot, die Anlage meldet keinen Verstoß', 'H4 (Q0.3) in jedem Schritt als Aktion ansteuern.');
  });
  const checkSp18 = mkCheck((prog, r) => {
    const s = script().press('I0.0', 300, 200).press('I0.0', 9500, 200);
    s.at(0, p => p.addPiece(true, 300)).at(9000, p => p.addPiece(false, 300));
    const c = sim(prog, 'foerderband', { opts: { spawn: false }, ms: 20000, drive: s.drive, sample: p => ({ cyl: p.state().cylinder }) });
    r(!someOf(win(c.rec, 0, 300), x => x.o['Q0.0']) && someOf(win(c.rec, 500, 1500), x => x.o['Q0.0']), 'Nach dem Start läuft das Band', 'Aus der Grundstellung schaltet S1 (mit Stopp- und Not-Halt-Öffner) in den Schritt „Band läuft“ mit Q0.0.');
    r(!someOf(c.rec, x => x.o['Q0.0'] && x.o['Q0.1']), 'Band und Ausschieber arbeiten nie gleichzeitig', 'Im Schritt „Ausschieber fährt aus“ darf Q0.0 keine Aktion sein.');
    r(c.st.sorted === 2 && c.st.lost === 0 && !c.st.crash, 'Beide Werkstücke werden ausgeschoben, ohne Crash und ohne Verlust', 'Das Band muss stehen, wenn der Zylinder ausfährt: B1 (I0.2) löst den Wechsel aus, im Schritt „Ausfahren“ ist Q0.0 nicht aktiv.');
    r(someOf(c.rec, x => x.o['Q0.1'] && x.s.cyl < 100) && someOf(c.rec, x => !x.o['Q0.1'] && x.s.cyl > 0 && x.s.cyl < 100), 'Der Zylinder fährt aus und danach wieder ein', 'Schritt „Ausfahren“ bis B4 (I0.5), dann „Einfahren“ (Q0.1 aus) bis B3 (I0.4).');
    const e = at(c.rec, 19900);
    r(!e.o['Q0.0'] && !e.o['Q0.1'] && e.s.cyl === 0, 'Am Ende steht die Anlage in Grundstellung (Band aus, Zylinder hinten)', 'Von „Einfahren“ führt B3 (I0.4) zurück nach S0.');
    r(someOf(win(c.rec, 9600, 12000), x => x.o['Q0.0']), 'Ein zweiter Start startet den nächsten Zyklus', 'Die Grundstellung muss nach jedem Zyklus wieder erreicht werden.');
  });
  const checkSp19 = mkCheck((prog, r) => {
    const s = script().press('I0.0', 300, 200);
    const c = sim(prog, 'garagentor', { ms: 26000, scen: 'zu', drive: s.drive, sample: p => ({ pos: p.state().doorPos }) });
    const R = c.rec, up = first(R, x => x.o['Q0.0']), top = up ? first(R, x => x.s.pos >= 98, up.t) : null, dn = top ? first(R, x => x.o['Q0.1'], top.t) : null;
    r(!!up && up.t - 300 >= 2700 && up.t - 300 <= 3900, 'Nach dem Tastendruck vergehen etwa 3 Sekunden Vorwarnung, bevor der Motor anläuft', 'Schritt „Vorwarnung“ mit Transition t/S1/3s.');
    r(!!up && allOf(win(R, 600, up.t - 20), x => x.o['Q0.2'] && !x.o['Q0.0'] && !x.o['Q0.1']), 'Während der Vorwarnung blinkt das Blinklicht H1 und der Motor steht', 'Q0.2 als Aktion im Schritt „Vorwarnung“.');
    r(!!top && !someOf(win(R, up.t, top.t), x => !x.o['Q0.2']) && !someOf(win(R, top.t + 20, top.t + 120), x => x.o['Q0.0']), 'Das Tor fährt mit Blinklicht auf und der Motor schaltet am Endschalter oben ab', 'Im Schritt „Tor fährt auf“ laufen Q0.0 und Q0.2, die Transition lautet I0.2.');
    r(!!top && !!dn && dn.t - top.t >= 4400 && dn.t - top.t <= 6500 && allOf(win(R, top.t + 200, dn.t - 20), x => x.o['Q0.3']), 'Das Tor bleibt 5 Sekunden offen, die Beleuchtung leuchtet', 'Schritt „Tor bleibt offen“: Q0.3, Transition t/S3/5s.');
    r(!!dn && at(R, 25900).s.pos <= 2 && !someOf(win(R, 24000, 26000), x => x.o['Q0.1'] || x.o['Q0.0'] || x.o['Q0.2']) && !c.st.overrun && !c.st.crash, 'Das Tor schließt selbstständig bis zum Endschalter, danach ist alles aus', 'Schritt „Tor fährt zu“ bis I0.3, dann zurück nach S0.');
  });
  const checkSp20 = mkCheck((prog, r) => checkBand(prog, r));
  const checkSp21 = mkCheck((prog, r) => checkTipp(prog, r));
  const checkSp22 = mkCheck((prog, r) => checkTankFuell(prog, r));
  const checkSp23 = mkCheck((prog, r) => checkBand(prog, r, { stoer: true }));
  const checkSp24 = mkCheck((prog, r) => checkTankPumpe(prog, r));

  /* ====================================================================== Aufgaben */
  const tasks = [
    { id: 'sp1', lab: 'sps', cat: 'Grundlagen', title: 'Verknüpfung: Beleuchtung am Garagentor', level: 1, plant: 'garagentor',
      text: 'Das Garagentor bekommt eine Beleuchtung. H2_Beleuchtung (Q0.3) soll leuchten, wenn das Tor nicht ganz unten steht (der Endschalter unten meldet 0) ODER ein Hindernis in der Lichtschranke ist. Solange der Taster S2_Ab gedrückt ist, soll die Beleuchtung aber immer aus bleiben (Dunkeltaster). ' + EIN('garagentor', ['I0.1', 'I0.3', 'I0.4']) + AUS('garagentor', ['Q0.3']) + 'Baue die Verknüpfung in einem Netzwerk auf.' + ADR,
      hint: ['Zerlege die Bedingung: Erst ein ODER aus „Tor nicht unten“ und „Hindernis“, danach ein UND mit „S2 nicht gedrückt“.', 'Ein Öffner-Kontakt an B2 (I0.3) liefert „nicht ganz unten“. Das Ergebnis des ODER verknüpfst du in Reihe (UND) mit einem Öffner an S2.', 'Netzwerk: (NICHT I0.3 ODER I0.4) UND NICHT I0.1 → Spule Q0.3.'],
      start: torLichtStart, sol: torLicht, check: checkSp1 },
    { id: 'sp2', lab: 'sps', cat: 'Grundlagen', title: 'Selbsthaltung: Band mit Start, Stopp und Not-Halt', level: 1, plant: 'foerderband',
      text: 'Die Bandsteuerung soll so arbeiten: S1_Start schaltet das Band K1_Band (Q0.0) ein, es läuft nach dem Loslassen weiter. S2_Stopp und S3_NotHalt sind Öffner und schalten das Band sofort ab. Nach Stopp oder Not-Halt läuft das Band nicht von selbst wieder an. H1_Betrieb (Q0.2) leuchtet genau dann, wenn das Band läuft. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2']) + 'In der Startvorlage fehlen noch Stopp, Not-Halt und die Lampe.' + ADR,
      hint: ['Öffner-Taster liefern im Ruhezustand eine 1. Im Programm brauchst du deshalb für Stopp und Not-Halt normale Schließer-Kontakte in Reihe.', 'Selbsthaltung: (S1 ODER Q0.0) UND S2 UND S3 → Spule Q0.0. Für die Lampe ein zweites Netzwerk: Kontakt Q0.0 → Spule Q0.2.', 'N1: ((I0.0 ODER Q0.0) UND I0.1 UND I0.7) → Q0.0. N2: Q0.0 → Q0.2.'],
      start: bandStart, sol: () => bandSol('kop'), check: checkSp2 },
    { id: 'sp3', lab: 'sps', cat: 'Grundlagen', title: 'Verriegelung: Tor im Tippbetrieb', level: 2, plant: 'garagentor',
      text: 'Das Rolltor soll im Tippbetrieb fahren: K1_MotorAuf (Q0.0) läuft, solange S1_Auf gedrückt ist. K2_MotorAb (Q0.1) läuft, solange S2_Ab gedrückt ist. Beide Motoren dürfen nie gleichzeitig laufen (Verriegelung, sonst Kurzschluss). Oben schaltet der Endschalter B1_EndeOben den Auf-Motor ab, unten B2_EndeUnten den Ab-Motor, sonst fährt das Tor über die Endlage hinaus. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3']) + AUS('garagentor', ['Q0.0', 'Q0.1']) + ADR,
      hint: ['Jeder Motor bekommt: seinen Taster, den Endschalter als Öffner und den anderen Motor als Öffner (Verriegelung).', 'Netzwerk 1: I0.0 UND NICHT I0.2 UND NICHT Q0.1 → Q0.0. Netzwerk 2 entsprechend mit I0.1, I0.3 und Q0.0.', 'N1: (I0.0 UND NICHT I0.2 UND NICHT Q0.1) → Q0.0. N2: (I0.1 UND NICHT I0.3 UND NICHT Q0.0) → Q0.1.'],
      start: torTippStart, sol: torTipp, check: checkSp3 },
    { id: 'sp4', lab: 'sps', cat: 'Grundlagen', title: 'Flanke: Licht mit einem Taster ein und aus', level: 2, plant: 'garagentor',
      text: 'Die Beleuchtung H2_Beleuchtung (Q0.3) wird wie ein Stromstoßschalter bedient: Jeder Tastendruck auf S1_Auf (I0.0) wechselt den Zustand, Licht an, nächster Druck Licht aus, und so weiter. Hältst du den Taster lange gedrückt, darf trotzdem nur ein einziger Wechsel passieren. ' + EIN('garagentor', ['I0.0']) + AUS('garagentor', ['Q0.3']) + 'Tipp: Die Auswertung der Taste muss auf die Flanke reagieren, nicht auf den Pegel.' + ADR,
      hint: ['Eine Flanke (P) ist nur einen Zyklus lang 1. Damit kannst du den Zustand genau einmal pro Tastendruck umkehren.', 'Umkehren heißt: neuer Zustand = alter Zustand XOR Flanke. Den alten Zustand liest du vom Ausgang Q0.3 selbst.', 'N1: (Q0.3 XOR Flanke P an I0.0) → Spule Q0.3.'],
      start: torToggleStart, sol: torToggle, check: checkSp4 },

    { id: 'sp5', lab: 'sps', cat: 'Zeit und Zählen', title: 'Anlaufwarnung mit Einschaltverzögerung', level: 2, plant: 'foerderband',
      text: 'Bevor das Band anläuft, soll gewarnt werden. Nach einem kurzen Druck auf S1_Start (I0.0) leuchtet H2_Stoerung (Q0.3) als Warnlampe 3 Sekunden lang, das Band K1_Band (Q0.0) steht in dieser Zeit noch. Danach läuft das Band, und die Warnlampe geht aus. S2_Stopp und S3_NotHalt (beide Öffner) schalten alles ab, auch während der Warnzeit; dann läuft das Band später nicht an. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.3']) + 'In der Startvorlage hält der Merker M0.0 den Anlauf fest.' + ADR,
      hint: ['Der Merker M0.0 sagt „Anlauf läuft“. Mit ihm als Eingang startet ein Zeitglied TON mit 3 s.', 'Das Band folgt dem Ausgang des TON (Q0.0 = T1.Q). Die Warnlampe leuchtet, solange M0.0 gesetzt ist und T1.Q noch nicht.', 'N2: TON T1 (PT = 3000 ms, Eingang M0.0) → Spule Q0.0. N3: M0.0 UND NICHT T1.Q → Spule Q0.3.'],
      start: bandAnlaufStart, sol: () => bandAnlauf('kop'), check: checkSp5 },
    { id: 'sp6', lab: 'sps', cat: 'Zeit und Zählen', title: 'Impuls: Licht fünf Sekunden', level: 2, plant: 'garagentor',
      text: 'Nach einem Druck auf S1_Auf (I0.0) soll die Beleuchtung H2_Beleuchtung (Q0.3) genau 5 Sekunden leuchten. Es spielt keine Rolle, wie lange der Taster gedrückt bleibt: Nach 5 Sekunden ist das Licht aus, auch wenn der Taster noch gehalten wird. Erst ein neuer Tastendruck startet wieder. ' + EIN('garagentor', ['I0.0']) + AUS('garagentor', ['Q0.3']) + ADR,
      hint: ['Es gibt drei Zeitglieder: TON (verzögert ein), TOF (verzögert aus) und TP (Impuls). Welches läuft immer genau seine Zeit ab?', 'Der Impuls TP startet mit der steigenden Flanke seines Eingangs und dauert PT lang, egal was der Eingang danach macht.', 'N1: TP T1 (PT = 5000 ms, Eingang I0.0) → Spule Q0.3.'],
      start: torImpulsStart, sol: () => torImpuls('fup'), check: checkSp6 },
    { id: 'sp7', lab: 'sps', cat: 'Zeit und Zählen', title: 'Nachlauf: Lampe leuchtet nach dem Stopp', level: 2, plant: 'foerderband',
      text: 'Die Bandsteuerung ist schon fertig (Start, Stopp, Not-Halt). Ergänze die Lampe H1_Betrieb (Q0.2): Sie geht mit dem Band an und leuchtet nach dem Abschalten des Bandes noch 4 Sekunden nach, damit das Personal sieht, dass der Auslauf noch Gefahr bedeutet. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2']) + ADR,
      hint: ['Gesucht ist eine Ausschaltverzögerung: Ausgang sofort ein, nach dem Ausschalten des Eingangs noch eine Zeit lang weiter.', 'Das Zeitglied TOF mit PT = 4000 ms und dem Band (Q0.0) als Eingang liefert genau das. Seinen Ausgang legst du an die Lampe.', 'Ersetze in N2 den Kontakt Q0.0 durch TOF T1 (PT = 4000 ms, Eingang Q0.0). Spule Q0.2 bleibt.'],
      start: bandNachlaufStart, sol: bandNachlauf, check: checkSp7 },
    { id: 'sp8', lab: 'sps', cat: 'Zeit und Zählen', title: 'Zählen: Kiste voll nach vier Werkstücken', level: 2, plant: 'foerderband',
      text: 'Am Bandende werden Werkstücke in eine Kiste abgeworfen. Die Kiste ist voll, wenn vier Werkstücke den Sensor B5_Bandende (I0.6) erreicht haben. Dann soll das Band K1_Band (Q0.0) anhalten und H2_Stoerung (Q0.3) als „Kiste voll“ leuchten. Ein neuer Druck auf S1_Start (I0.0) setzt den Zähler zurück, die Kiste ist dann wieder leer, und das Band läuft weiter. Stopp und Not-Halt (Öffner) wirken wie immer. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.3']) + ADR,
      hint: ['Ein Vorwärtszähler (CTU) zählt jede steigende Flanke seines Eingangs. Wohin kommt der Sensor B5?', 'Der Zähler C1 hat PV = 4, den Eingang I0.6 und den Reset-Eingang I0.0. C1.Q schaltet die Lampe und sperrt das Band.', 'N1: CTU C1 (PV 4, in I0.6, r I0.0) → Q0.3. N2: Selbsthaltung wie bisher, zusätzlich UND NICHT C1.Q → Q0.0.'],
      start: bandZaehlStart, sol: bandZaehl, check: checkSp8 },

    { id: 'sp9', lab: 'sps', cat: 'Ampel', title: 'Nachtschaltung: Gelb blinkt', level: 2, plant: 'ampel',
      text: 'Die Ampel bekommt eine Nachtschaltung. Der Schalter S2_Betrieb (I0.1) ist der Tag-Nacht-Schalter. Ist er eingeschaltet (Tag), zeigt die Straße dauerhaft Grün (H3, Q0.2) und die Fußgängerampel Rot (H4, Q0.3). Ist er ausgeschaltet (Nacht), erlöschen diese beiden Lichter, und nur das gelbe Licht H2_Strasse_gelb (Q0.1) blinkt: 0,5 s an, 0,5 s aus. ' + EIN('ampel', ['I0.1']) + AUS('ampel', ['Q0.1', 'Q0.2', 'Q0.3']) + 'Der Tagbetrieb ist schon vorbereitet.' + ADR,
      hint: ['Ein Blinker besteht aus zwei Einschaltverzögerungen, die sich gegenseitig zurücksetzen.', 'T1 wartet 0,5 s und schaltet das Licht ein. T2 wartet danach 0,5 s und setzt T1 zurück, indem sein Ausgang in den Eingang von T1 mit NICHT eingeht. Der Eingang von T1 enthält auch „Nacht“ (S2 nicht gesetzt).', 'N1: TON T1 (500 ms, Eingang: NICHT I0.1 UND NICHT T2.Q) → Q0.1. N2: TON T2 (500 ms, Eingang T1.Q).'],
      start: ampelNachtStart, sol: ampelNacht, check: checkSp9 },
    { id: 'sp10', lab: 'sps', cat: 'Ampel', title: 'Bedarfsampel für Fußgänger', level: 3, plant: 'ampel',
      text: 'Die Straße zeigt normalerweise Grün (H3, Q0.2), die Fußgänger Rot (H4, Q0.3). Drückt ein Fußgänger S1_Fussgaengertaster (I0.0), läuft dieser Ablauf: Straße 2 s Gelb (Q0.1), dann 1 s Rot (Q0.0, Räumzeit für Fahrzeuge), dann 5 s Fußgänger-Grün (H5, Q0.4) mit Straße Rot, dann 4 s Räumzeit für die Fußgänger (Straße Rot, Fußgänger Rot), dann 1 s Rot-Gelb und zurück zu Grün. Fahrzeuge und Fußgänger dürfen nie gleichzeitig Grün haben. ' + EIN('ampel', ['I0.0']) + AUS('ampel', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4']) + 'In der Startvorlage sind die Schritte mit ihren Lampen fertig, es fehlen die Bedingungen der Transitionen.' + ADR,
      hint: ['Jede Transition wartet entweder auf einen Taster oder auf eine Zeit im vorherigen Schritt.', 'Zeitbedingungen schreibst du so: t/S1/2s heißt: Schritt S1 ist seit mindestens 2 s aktiv.', 'T2: t/S1/2s, T3: t/S2/1s, T4: t/S3/5s, T5: t/S4/4s, T6: t/S5/1s. T1 (S0 nach S1) hängt an I0.0.'],
      start: () => GRA_AMPEL_FUSS(true), sol: () => GRA_AMPEL_FUSS(false), check: checkSp10 },

    { id: 'sp11', lab: 'sps', cat: 'Förderband', title: 'Sortieren: Metallteile ausschieben', level: 3, plant: 'foerderband',
      text: 'Auf dem Band kommen helle (Kunststoff) und dunkle (Metall) Werkstücke. Dunkle Teile sollen mit dem Zylinder Y1_Ausschieber (Q0.1) in die Rutsche geschoben werden, helle laufen bis zum Bandende. Der induktive Sensor B2_Metall (I0.3) sitzt vor dem Zylinder und meldet nur dunkle Teile. Die Lichtschranke B1 (I0.2) meldet, dass ein Teil vor dem Zylinder steht. Dann muss das Band sofort stehen, bevor der Zylinder ausfährt, sonst gibt es einen Crash. Der Zylinder fährt bis B4_Zyl_vorn (I0.5) aus und wieder ein (B3_Zyl_hinten, I0.4), erst dann läuft das Band weiter. Start, Stopp und Not-Halt wie gewohnt. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.4', 'I0.5', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.1']) + 'Die Teile kommen im Abstand von mindestens 240 Einheiten (3 s).' + ADR,
      hint: ['Dunkle Teile werden schon bei B2 erkannt, aber erst bei B1 ausgeschoben. Das Programm muss sich merken, dass ein dunkles Teil unterwegs ist.', 'Setze bei B2 einen Merker, bei B1 mit gesetztem Merker fährt der Zylinder aus (Selbsthaltung bis B4) und das Band steht. Bei B4 wird der Merker gelöscht.', 'Merker M0.1 setzen bei I0.3, löschen bei I0.5. Q0.1 = ((M0.1 UND I0.2) ODER Q0.1) UND Betrieb UND NICHT I0.5. Band Q0.0 = Betrieb UND I0.4 UND NICHT Q0.1.'],
      start: bandSortierStart, sol: bandSortier, check: checkSp11 },
    { id: 'sp12', lab: 'sps', cat: 'Förderband', title: 'Band hält am Bandende', level: 2, plant: 'foerderband',
      text: 'Am Bandende soll ein Werkstück erst entnommen werden. Das Band K1_Band (Q0.0) läuft nach S1_Start. Sobald ein Werkstück den Sensor B5_Bandende (I0.6) erreicht, hält das Band an. Ein erneuter Druck auf S1_Start fährt das Band wieder an, das Teil wird abgeworfen. Dabei ist B5 noch einen Moment belegt, das Band darf trotzdem nicht sofort wieder anhalten. Stopp und Not-Halt (Öffner) wirken wie immer, H1_Betrieb (Q0.2) zeigt das laufende Band. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2']) + ADR,
      hint: ['Würdest du B5 als Pegel (Schließer) abfragen, könntest du das Band nach dem Anhalten nie wieder starten, solange das Teil im Strahl liegt.', 'Nimm die steigende Flanke von B5. Sie ist nur einen Zyklus lang 1 und löst die Selbsthaltung genau einmal.', 'N1: ((I0.0 ODER Q0.0) UND I0.1 UND I0.7 UND NICHT Flanke P(I0.6)) → Q0.0.'],
      start: bandEndeStart, sol: bandEnde, check: checkSp12 },

    { id: 'sp13', lab: 'sps', cat: 'Tank', title: 'Füllautomat: Tank bis Max füllen', level: 2, plant: 'tank',
      text: 'Der Tank wird über Zulauf A gefüllt. Ein Druck auf S1_Start (I0.0) öffnet das Ventil Y1_ZulaufA (Q0.0), es bleibt offen und schließt, sobald der Sensor B3_Max (I0.4) 90 % meldet. S2_Stopp (I0.1) und S3_NotHalt (I0.6), beide Öffner, schließen das Ventil sofort. Nach einem Stopp oder Not-Halt öffnet es nicht von selbst wieder. Bei vollem Tank bewirkt Start nichts. H1_Stoerung (Q0.5) leuchtet nur, solange der Not-Halt betätigt ist. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.4', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.5']) + 'Der Tank läuft über, wenn du den Zulauf nicht rechtzeitig schließt.' + ADR,
      hint: ['Das ist eine Selbsthaltung mit zusätzlichen Bedingungen in Reihe: Stopp, Not-Halt und „nicht voll“.', 'B3 ist ein normaler Sensor (1 = voll): Frage ihn als Öffner-Kontakt ab, dann ist der Zulauf nur bei „nicht voll“ möglich.', 'N1: ((I0.0 ODER Q0.0) UND I0.1 UND I0.6 UND NICHT I0.4) → Q0.0. N2: NICHT I0.6 → Q0.5.'],
      start: tankFuellStart, sol: tankFuell, check: checkSp13 },
    { id: 'sp14', lab: 'sps', cat: 'Tank', title: 'Mischautomat mit Ablaufsteuerung', level: 3, plant: 'tank',
      text: 'Ein Mischbehälter soll automatisch arbeiten: Start mit S1_Start (I0.0), nur wenn der Not-Halt nicht betätigt ist. Zuerst füllt Y1_ZulaufA (Q0.0) bis zur Mitte (B2, I0.3), dann Y2_ZulaufB (Q0.1) bis Max (B3, I0.4). Danach läuft M1_Ruehrwerk (Q0.2) mindestens 5 Sekunden im vollen Tank. Dann pumpt P1_Pumpe (Q0.4) den Behälter leer, aber nur, wenn Behälter 2 leer ist (B4_Beh2Leer, I0.5 = 1). Die Pumpe läuft, bis B1_Min (I0.2) 0 meldet (unter 10 %), sonst läuft sie trocken. Der Not-Halt (S3, I0.6, Öffner) schaltet alle Ausgänge ab und bricht den Ablauf ab (zurück in die Grundstellung). ' + EIN('tank', ['I0.0', 'I0.2', 'I0.3', 'I0.4', 'I0.5', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.4']) + 'In der Startvorlage sind Schritte und Aktionen fertig, es fehlen die Bedingungen der Transitionen und die Not-Halt-Abbrüche.' + ADR,
      hint: ['Jeder Schritt hat eine Aktion und wartet auf eine Bedingung: Sensor, Zeit oder beides.', 'Die Transition vom Rühren zum Abpumpen braucht eine Zeit (t/S3/5s) UND den Sensor B4. Der Not-Halt braucht für jeden Schritt eine eigene Transition mit NICHT I0.6 zurück nach S0.', 'T1: I0.0 UND I0.6. T2: I0.3. T3: I0.4. T4: t/S3/5s UND I0.5. T5: NICHT I0.2. Zusätzlich je Schritt S1 bis S4 eine Transition nach S0 mit NICHT I0.6.'],
      start: () => GRA_MISCH(true), sol: () => GRA_MISCH(false), check: checkSp14 },

    { id: 'sp15', lab: 'sps', cat: 'Garagentor', title: 'Tor-Steuerung mit Selbsthaltung', level: 2, plant: 'garagentor',
      text: 'Das Tor soll mit einem kurzen Tastendruck bis zum Ende fahren. S1_Auf (I0.0) startet K1_MotorAuf (Q0.0) mit Selbsthaltung, S2_Ab (I0.1) startet K2_MotorAb (Q0.1). Der Endschalter B1_EndeOben (I0.2) beendet die Fahrt nach oben, B2_EndeUnten (I0.3) die Fahrt nach unten. S3_Stopp (I0.5, Öffner) hält das Tor an. Ein Tastendruck in die Gegenrichtung wird ignoriert, solange der Motor läuft: Erst muss Stopp gedrückt werden. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1']) + 'Die Startvorlage hat Selbsthaltung und Stopp, es fehlen die Endschalter und die Verriegelung.' + ADR,
      hint: ['Jeder Motor bekommt zu seiner Selbsthaltung zwei weitere Bedingungen in Reihe: seinen Endschalter und den anderen Motor als Öffner.', 'Frage B1 (I0.2) beim Auf-Motor als Öffner ab, B2 (I0.3) beim Ab-Motor, und Q0.1 beim Auf-Motor, Q0.0 beim Ab-Motor.', 'N1: ((I0.0 ODER Q0.0) UND I0.5 UND NICHT I0.2 UND NICHT Q0.1) → Q0.0. N2 entsprechend mit I0.1, Q0.1, I0.3, Q0.0.'],
      start: torAutoStart, sol: torAuto, check: checkSp15 },
    { id: 'sp16', lab: 'sps', cat: 'Garagentor', title: 'Einklemmschutz mit Lichtschranke', level: 3, plant: 'garagentor',
      text: 'Die Steuerung aus der letzten Aufgabe soll um einen Einklemmschutz erweitert werden. Meldet B3_Lichtschranke (I0.4 = 1) ein Hindernis, während das Tor schließt, muss es sofort stoppen und danach von selbst ganz aufmachen (bis B1_EndeOben). Steht ein Hindernis im Tor, darf das Tor gar nicht erst schließen. Das Blinklicht H1_Blinklicht (Q0.2) leuchtet bei jeder Motorfahrt. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.4', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1', 'Q0.2']) + 'Die Startvorlage fährt schon bis zu den Endschaltern. Fährt das Tor gegen das Hindernis, ist es ein Crash.' + ADR,
      hint: ['Du brauchst einen Merker „Hindernis beim Schließen“, der den Auf-Motor so lange hält, bis das Tor oben ist.', 'Merker M0.0 setzen, wenn Motor Ab läuft und B3 meldet. Löschen bei B1 oder Stopp. Der Auf-Motor läuft auch bei M0.0, der Ab-Motor bekommt NICHT I0.4.', 'N1: (Q0.1 UND I0.4) setzt M0.0. N2: (I0.2 ODER NICHT I0.5) löscht M0.0. N3: Auf-Motor ((I0.0 ODER M0.0 ODER Q0.0) UND …). N4: Ab-Motor mit UND NICHT I0.4. N5: H1 = Q0.0 ODER Q0.1.'],
      start: torSchutzStart, sol: torSchutz, check: checkSp16 },

    { id: 'sp17', lab: 'sps', cat: 'GRAFCET', title: 'Ampelzyklus als GRAFCET', level: 2, plant: 'ampel',
      text: 'Die Straßenampel soll dauernd im Festzyklus laufen: Grün 5 s, Gelb 2 s, Rot 5 s, Rot-Gelb 1 s, dann wieder Grün. Die Fußgängerampel zeigt immer Rot (H4, Q0.3). ' + AUS('ampel', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3']) + 'In der Startvorlage sind die vier Schritte mit ihren Lampen schon eingetragen. Trage die Transitionen mit den Zeitbedingungen ein.' + ADR,
      hint: ['Eine Zeitbedingung schreibst du als t/Sx/2s: Schritt Sx ist seit mindestens 2 Sekunden aktiv.', 'Jeder Schritt wartet auf seine eigene Zeit. Der letzte Schritt (Rot-Gelb) führt zurück nach S0.', 'T1: t/S0/5s, T2: t/S1/2s, T3: t/S2/5s, T4: t/S3/1s.'],
      start: () => GRA_AMPEL_ZYKLUS(true), sol: () => GRA_AMPEL_ZYKLUS(false), check: checkSp17 },
    { id: 'sp18', lab: 'sps', cat: 'GRAFCET', title: 'Ausschieber-Zyklus als GRAFCET', level: 2, plant: 'foerderband',
      text: 'Ein Einzelzyklus für den Ausschieber: In der Grundstellung ist alles aus. Mit S1_Start (und wenn Stopp und Not-Halt nicht betätigt sind) läuft das Band. Meldet die Lichtschranke B1 (I0.2) ein Werkstück, hält das Band an, und der Zylinder Y1 (Q0.1) fährt bis B4_Zyl_vorn (I0.5) aus. Dann fährt er wieder ein (Y1 aus), bis B3_Zyl_hinten (I0.4) meldet, und die Steuerung ist wieder in der Grundstellung. H1_Betrieb (Q0.2) leuchtet in allen Schritten außer der Grundstellung. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.2', 'I0.4', 'I0.5', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.1', 'Q0.2']) + 'Die Schritte und Aktionen sind vorbereitet, es fehlen die Transitionsbedingungen.' + ADR,
      hint: ['Jede Transition wartet auf genau ein Ereignis: Start, Werkstück vor dem Zylinder, Zylinder vorn, Zylinder hinten.', 'Das Band muss im Schritt „Ausschieber fährt aus“ stehen. Das ist schon richtig vorbereitet, weil dort Q0.0 keine Aktion ist.', 'T1: I0.0 UND I0.1 UND I0.7. T2: I0.2. T3: I0.5. T4: I0.4.'],
      start: () => GRA_SCHIEBER(true), sol: () => GRA_SCHIEBER(false), check: checkSp18 },
    { id: 'sp19', lab: 'sps', cat: 'GRAFCET', title: 'Tor-Automatik mit Vorwarnung', level: 3, plant: 'garagentor',
      text: 'Ein Tastendruck auf S1_Auf (I0.0, wenn S3_Stopp nicht gedrückt ist) startet die Tor-Automatik: Erst blinkt H1_Blinklicht (Q0.2) 3 Sekunden zur Vorwarnung, der Motor steht. Dann fährt das Tor auf (K1_MotorAuf, Q0.0, Blinklicht an) bis B1_EndeOben (I0.2). Danach bleibt es 5 Sekunden offen, dabei leuchtet H2_Beleuchtung (Q0.3). Zum Schluss fährt es von selbst zu (K2_MotorAb, Q0.1, Blinklicht an) bis B2_EndeUnten (I0.3) und die Steuerung ist wieder in der Grundstellung. ' + EIN('garagentor', ['I0.0', 'I0.2', 'I0.3', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3']) + 'Die Schritte und ihre Aktionen sind vorbereitet, es fehlen die Bedingungen der Transitionen.' + ADR,
      hint: ['Die Zeiten kommen aus den Schritten (Vorwarnung 3 s, offen 5 s), die Endlagen aus den Endschaltern.', 'Der Taster in T1 braucht noch die Stopp-Abfrage (Öffner, im Ruhezustand 1).', 'T1: I0.0 UND I0.5. T2: t/S1/3s. T3: I0.2. T4: t/S3/5s. T5: I0.3.'],
      start: () => GRA_TOR(true), sol: () => GRA_TOR(false), check: checkSp19 },

    { id: 'sp20', lab: 'sps', cat: 'Fehlersuche', title: 'Fehlersuche: Das Band läuft nicht an', level: 1, plant: 'foerderband',
      text: 'Ein Kollege hat die Bandsteuerung geschrieben, aber das Band lässt sich nicht starten. Finde den Fehler im Programm und behebe ihn. Soll-Verhalten: S1_Start (I0.0) startet das Band K1_Band (Q0.0) mit Selbsthaltung, S2_Stopp (I0.1) und S3_NotHalt (I0.7), beide Öffner, schalten es ab, H1_Betrieb (Q0.2) zeigt den Lauf. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2']) + 'Probiere es in der Simulation aus und schaue dir die Kontakte an: Welche führen im Ruhezustand keinen Strom?' + ADR,
      hint: ['Starte die Simulation und drücke S1. Im KOP siehst du, welcher Kontakt den Strom sperrt.', 'Ein Öffner-Taster liefert im Ruhezustand eine 1. Wie muss der Kontakt dafür aussehen?', 'Der Kontakt für S2 (I0.1) ist ein Öffner-Kontakt, er muss ein Schließer-Kontakt sein.'],
      start: bandBug, sol: () => bandSol('kop'), check: checkSp20 },
    { id: 'sp21', lab: 'sps', cat: 'Fehlersuche', title: 'Fehlersuche: Beide Motoren laufen, das Tor fährt über die Endlage', level: 2, plant: 'garagentor',
      text: 'Die Tippsteuerung für das Rolltor hat Fehler: Wenn man beide Taster drückt, laufen beide Motoren, und beim Schließen fährt das Tor über die untere Endlage hinaus. Soll-Verhalten: K1_MotorAuf (Q0.0) läuft, solange S1_Auf (I0.0) gedrückt ist und das Tor nicht ganz oben ist (B1, I0.2). K2_MotorAb (Q0.1) läuft, solange S2_Ab (I0.1) gedrückt ist und das Tor nicht ganz unten ist (B2, I0.3). Beide Motoren dürfen nie gleichzeitig laufen. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3']) + AUS('garagentor', ['Q0.0', 'Q0.1']) + 'Es sind zwei Fehler im Programm, behebe beide.' + ADR,
      hint: ['Vergleiche die Bedingungen beider Netzwerke: Welcher Endschalter gehört zu welcher Richtung? Und was verhindert, dass beide Motoren zusammen laufen?', 'Beim Ab-Motor steht der falsche Endschalter. Außerdem fehlt in beiden Netzwerken der jeweils andere Motor als Öffner-Kontakt.', 'N1: I0.0 UND NICHT I0.2 UND NICHT Q0.1 → Q0.0. N2: I0.1 UND NICHT I0.3 UND NICHT Q0.0 → Q0.1.'],
      start: torTippBug, sol: torTipp, check: checkSp21 },
    { id: 'sp22', lab: 'sps', cat: 'Fehlersuche', title: 'Fehlersuche: Der Tank läuft über', level: 2, plant: 'tank',
      text: 'Der Füllautomat läuft über, und die Störlampe leuchtet im Normalbetrieb. Soll-Verhalten: S1_Start (I0.0) öffnet Y1_ZulaufA (Q0.0) mit Selbsthaltung. Bei B3_Max (I0.4 = 1) schließt das Ventil. S2_Stopp (I0.1) und S3_NotHalt (I0.6) sind Öffner und schließen es sofort. H1_Stoerung (Q0.5) leuchtet nur bei betätigtem Not-Halt. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.4', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.5']) + 'Es sind zwei Fehler im Programm.' + ADR,
      hint: ['Fülle den Tank in der Simulation und achte auf die Meldungen. Welche Bedingung fehlt, die den Zulauf bei „voll“ schließt? Und wann leuchtet die Störlampe?', 'Der Zulauf wird nicht an B3 (I0.4) abgeschaltet. Bei der Störlampe steht ein Schließer-Kontakt, der Not-Halt ist aber ein Öffner (im Ruhezustand 1).', 'N1: Selbsthaltung mit UND NICHT I0.4. N2: Öffner-Kontakt I0.6 (NICHT I0.6) → Q0.5.'],
      start: tankFuellBug, sol: tankFuell, check: checkSp22 },

    { id: 'sp23', lab: 'sps', cat: 'Prüfungsstil', title: 'Funktionsplan ergänzen: Förderband', level: 2, plant: 'foerderband',
      text: 'Gegeben ist der Funktionsplan (FUP) einer Bandsteuerung. Ergänze die fehlenden Teile, sodass die Anlage so arbeitet: S1_Start (I0.0) startet das Band K1_Band (Q0.0) mit Selbsthaltung, S2_Stopp (I0.1) und S3_NotHalt (I0.7) sind Öffner und schalten es ab. H1_Betrieb (Q0.2) leuchtet bei laufendem Band. H2_Stoerung (Q0.3) leuchtet, solange der Not-Halt betätigt ist. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2', 'Q0.3']) + 'Im Funktionsplan fehlen im ersten Netzwerk ein Eingang am UND-Gatter und im dritten Netzwerk die Verknüpfung.' + ADR,
      hint: ['Das UND-Gatter des ersten Netzwerks hat einen freien Eingang: Dort fehlt eine Sicherheitsabfrage.', 'Der Not-Halt ist ein Öffner: Im Betrieb liefert er eine 1. Für die Störmeldung brauchst du das Gegenteil davon (Negation).', 'N1: zusätzlicher Eingang I0.7 am UND. N3: Negation von I0.7 → Q0.3.'],
      start: bandFupStart, sol: bandFup, check: checkSp23 },
    { id: 'sp24', lab: 'sps', cat: 'Prüfungsstil', title: 'Netzwerk ergänzen: Pumpensteuerung', level: 2, plant: 'tank',
      text: 'Die Ablaufpumpe P1_Pumpe (Q0.4) des Tanks soll so gesteuert werden: Ein Tastendruck auf S1_Start (I0.0) schaltet sie ein, aber nur, wenn Behälter 2 leer ist (B4_Beh2Leer, I0.5 = 1). Sie hält sich selbst. Sie schaltet ab bei S2_Stopp (I0.1, Öffner), bei S3_NotHalt (I0.6, Öffner) und wenn der Füllstand unter Min fällt (B1_Min, I0.2 = 0), sonst läuft sie trocken. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.5', 'I0.6']) + AUS('tank', ['Q0.4']) + 'Die Startvorlage zeigt die Selbsthaltung mit Stopp, es fehlen Not-Halt, die Min-Abschaltung und die Freigabe durch Behälter 2.' + ADR,
      hint: ['Unterscheide: Was gilt nur beim Einschalten, und was gilt dauernd, solange die Pumpe läuft?', 'Die Freigabe durch Behälter 2 wirkt nur auf den Start-Taster (UND-Verknüpfung im Start-Zweig). Not-Halt und Min gelten für die ganze Selbsthaltung.', 'N1: (((I0.0 UND I0.5) ODER Q0.4) UND I0.1 UND I0.6 UND I0.2) → Q0.4.'],
      start: tankPumpeStart, sol: tankPumpe, check: checkSp24 }
  ];

  /* ====================================================================== Ausführung, Selbsttest */
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
  const SPS_TASKS = {
    tasks,
    run(task, prog) { return new Promise(res => { try { res(task.check(prog)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); } }); }
  };
  root.SPS_DATA = { examples };
  root.SPS_TASKS = SPS_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await SPS_TASKS.run(t, t.start())), L = await SPS_TASKS.run(t, t.sol());
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };
  if (typeof module !== 'undefined') module.exports = { examples, tasks, sim, logic, script };
})(typeof window !== 'undefined' ? window : globalThis);
