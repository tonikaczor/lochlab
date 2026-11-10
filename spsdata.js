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

  /* ---- Erweiterung: Aufgaben sp25 bis sp32 (Programme und Prüfungen) ---- */
  // sp25 Tank: Rührwerk mit Trockenlaufschutz
  const tankRuehrSol = () => kop('tank', [
    net('N1', 'Rührwerk', AND(v('I0.0'), v('I0.3'), v('I0.6')), [coil('Q0.2')]),
    net('N2', 'Störlampe', nv('I0.6'), [coil('Q0.5')])]);
  const tankRuehrStart = () => kop('tank', [net('N1', 'Rührwerk', v('I0.0'), [coil('Q0.2')])]);
  // sp26 Garagentor: Zweihandbedienung
  const torZweihandSol = () => kop('garagentor', [
    net('N1', 'Wartungsfahrt Auf (Zweihandbedienung)', AND(v('I0.0'), v('I0.1'), nv('I0.2'), v('I0.5')), [coil('Q0.0')]),
    net('N2', 'Blinklicht', v('Q0.0'), [coil('Q0.2')])]);
  const torZweihandStart = () => kop('garagentor', [net('N1', 'Wartungsfahrt Auf', v('I0.0'), [coil('Q0.0')])]);
  // sp27 Ampel: Fußgänger-Grün als Impuls
  const ampelImpulsSol = () => fup('ampel', [
    net('N1', 'Fußgänger-Grün als Impuls', TP('T1', 6000, v('I0.0')), [coil('Q0.4')]),
    net('N2', 'Fußgänger Rot', nv('T1.Q'), [coil('Q0.3')]),
    net('N3', 'Straße Rot', v('T1.Q'), [coil('Q0.0')]),
    net('N4', 'Straße Grün', nv('T1.Q'), [coil('Q0.2')])]);
  const ampelImpulsStart = () => kop('ampel', [net('N1', 'Fußgänger-Grün', v('I0.0'), [coil('Q0.4')])]);
  // sp28 Förderband: Staumelder
  const bandStauSol = () => kop('foerderband', [
    net('N1', 'Stau erkennen', TON('T1', 5000, v('I0.6')), [coil('Q0.3')]),
    net('N2', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7'), nv('T1.Q')), [coil('Q0.0')])]);
  const bandStauStart = () => kop('foerderband', [net('N1', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')])]);
  // sp29 Tank: Ventil vor Pumpe
  const tankVentilSol = () => kop('tank', [
    net('N1', 'Abpumpen merken', AND(OR(AND(v('I0.0'), v('I0.2')), v('M0.0')), v('I0.1'), v('I0.6'), v('I0.2')), [coil('M0.0')]),
    net('N2', 'Ablaufventil', v('M0.0'), [coil('Q0.3')]),
    net('N3', 'Pumpe nach 2 s', TON('T1', 2000, v('M0.0')), [coil('Q0.4')])], { 'M0.0': 'M_Abpumpen' });
  const tankVentilStart = () => kop('tank', [
    net('N1', 'Abpumpen merken', AND(OR(AND(v('I0.0'), v('I0.2')), v('M0.0')), v('I0.1'), v('I0.6'), v('I0.2')), [coil('M0.0')]),
    net('N2', 'Ablaufventil', v('M0.0'), [coil('Q0.3')]),
    net('N3', 'Pumpe', v('M0.0'), [coil('Q0.4')])], { 'M0.0': 'M_Abpumpen' });
  // sp30 Tank: Min-Meldung mit Entprellzeit
  const tankEntprellSol = () => kop('tank', [
    net('N1', 'Min länger als 2 s unterschritten', TON('T1', 2000, nv('I0.2')), [coil('M0.0')]),
    net('N2', 'Pumpe P1', AND(OR(AND(v('I0.0'), v('I0.2')), v('Q0.4')), v('I0.1'), v('I0.6'), nv('M0.0')), [coil('Q0.4')])], { 'M0.0': 'M_MinLang' });
  const tankEntprellStart = () => kop('tank', [
    net('N1', 'Pumpe P1', AND(OR(AND(v('I0.0'), v('I0.2')), v('Q0.4')), v('I0.1'), v('I0.6'), v('I0.2')), [coil('Q0.4')])], { 'M0.0': 'M_MinLang' });
  // sp31 Garagentor: Zuschließautomatik
  const torZuSol = () => kop('garagentor', [
    net('N1', 'Wartezeit im offenen Zustand', TON('T1', 8000, AND(v('I0.2'), nv('I0.4'), v('I0.5'))), [coil('M0.0')]),
    net('N2', 'Motor Auf (Tippbetrieb)', AND(v('I0.0'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N3', 'Motor Ab (Zuschließautomatik)', AND(OR(v('M0.0'), v('Q0.1')), nv('I0.3'), nv('I0.4'), v('I0.5'), nv('Q0.0')), [coil('Q0.1')]),
    net('N4', 'Blinklicht', OR(v('Q0.0'), v('Q0.1')), [coil('Q0.2')])], { 'M0.0': 'M_Wartezeit' });
  const torZuStart = () => kop('garagentor', [
    net('N1', 'Motor Auf (Tippbetrieb)', AND(v('I0.0'), nv('I0.2'), nv('Q0.1')), [coil('Q0.0')]),
    net('N2', 'Blinklicht', OR(v('Q0.0'), v('Q0.1')), [coil('Q0.2')])], { 'M0.0': 'M_Wartezeit' });
  // sp32 Fehlersuche: Zähler
  const bandZaehlBug = () => kop('foerderband', [
    net('N1', 'Werkstücke zählen', CTU('C1', 4, v('I0.2')), [coil('Q0.3')]),
    net('N2', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7'), nv('C1.Q')), [coil('Q0.0')])]);

  const checkSp25 = mkCheck((prog, r) => {
    const rows = [];
    for (let m = 0; m < 8; m++) {
      const s1 = !!(m & 1), b2 = !!(m & 2), nh = !!(m & 4);
      const S = logic(prog, 'tank', [{ in: { 'I0.0': s1, 'I0.1': true, 'I0.3': b2, 'I0.6': !nh }, n: 3 }]);
      rows.push({ m, got: !!S[0].last['Q0.2'], want: s1 && b2 && !nh, h: !!S[0].last['Q0.5'], wantH: nh });
    }
    const grp = f => rows.filter(f).every(x => x.got === x.want);
    r(grp(x => (x.m & 1) && (x.m & 2) && !(x.m & 4)), 'Taster gedrückt, Tank mindestens halb voll: Das Rührwerk läuft', 'Das Rührwerk M1 (Q0.2) braucht S1 UND B2 (I0.3 = 1) UND einen nicht betätigten Not-Halt.');
    r(grp(x => (x.m & 1) && !(x.m & 2) && !(x.m & 4)), 'Tank unter der Mitte: Das Rührwerk bleibt aus', 'B2 (I0.3) = 0 heißt: unter 50 %. Dann darf M1 nicht laufen, sonst dreht das Rührwerk fast trocken. B2 gehört als Schließer in die UND-Verknüpfung.');
    r(grp(x => !(x.m & 1)), 'Ohne Tastendruck bleibt das Rührwerk aus', 'S1 (I0.0) muss Teil der UND-Verknüpfung sein.');
    r(grp(x => !!(x.m & 4)), 'Bei betätigtem Not-Halt ist das Rührwerk immer aus', 'S3 (I0.6) ist ein Öffner: Im Ruhezustand liefert er 1. Als Schließer-Kontakt in Reihe unterbricht er beim Betätigen.');
    r(rows.every(x => x.h === x.wantH), 'Die Störlampe H1 leuchtet genau bei betätigtem Not-Halt', 'H1 (Q0.5) = NICHT S3 (I0.6), also ein Öffner-Kontakt auf I0.6.');
    r(rows.every(x => x.got === x.want), 'Wahrheitstabelle vollständig richtig (alle 8 Fälle)', 'M1 = S1 UND B2 UND S3.');
  });
  const checkSp26 = mkCheck((prog, r) => {
    const rows = [];
    for (let m = 0; m < 16; m++) {
      const s1 = !!(m & 1), s2 = !!(m & 2), oben = !!(m & 4), stp = !!(m & 8);
      const S = logic(prog, 'garagentor', [{ in: { 'I0.0': s1, 'I0.1': s2, 'I0.2': oben, 'I0.3': false, 'I0.4': false, 'I0.5': !stp }, n: 3 }]);
      rows.push({ m, s1, s2, oben, stp, got: !!S[0].last['Q0.0'], ab: !!S[0].last['Q0.1'], h: !!S[0].last['Q0.2'], want: s1 && s2 && !oben && !stp });
    }
    r(rows.filter(x => x.s1 && x.s2 && !x.oben && !x.stp).every(x => x.got), 'Beide Taster gedrückt: Das Tor fährt auf', 'Motor Auf (Q0.0) läuft bei S1 UND S2 (beide gleichzeitig gedrückt).');
    r(rows.filter(x => (x.s1 !== x.s2) || (!x.s1 && !x.s2)).every(x => !x.got), 'Mit nur einem Taster (oder keinem) bleibt der Motor aus', 'Das ist der Sinn der Zweihandbedienung: Beide Hände sind an den Tastern. Verknüpfe S1 und S2 mit UND, nicht mit ODER.');
    r(rows.filter(x => x.oben).every(x => !x.got), 'Ist das Tor oben (Endschalter B1), fährt es nicht weiter', 'B1 (I0.2) = 1 muss den Auf-Motor sperren (Öffner-Kontakt).');
    r(rows.filter(x => x.stp).every(x => !x.got), 'Der Stopp-Taster sperrt den Motor', 'S3 (I0.5) ist ein Öffner: Im Ruhezustand liefert er 1. Als Schließer-Kontakt in Reihe unterbricht er beim Betätigen.');
    r(rows.every(x => !x.ab), 'Der Ab-Motor läuft in dieser Aufgabe nie', 'Nur Q0.0 wird angesteuert, Q0.1 bleibt unbenutzt.');
    r(rows.every(x => x.h === x.got), 'Das Blinklicht H1 leuchtet genau dann, wenn der Motor läuft', 'H1 (Q0.2) folgt Q0.0.');
    r(rows.every(x => x.got === x.want), 'Wahrheitstabelle vollständig richtig (alle 16 Fälle)', 'Q0.0 = S1 UND S2 UND NICHT B1 UND S3.');
  });
  const checkSp27 = mkCheck((prog, r) => {
    const S = logic(prog, 'ampel', [{ in: { 'I0.0': false }, n: 10 }, { in: { 'I0.0': true }, n: 20 }, { in: { 'I0.0': false }, n: 300 }, { in: { 'I0.0': false }, n: 250 }, { in: { 'I0.0': false }, n: 60 },
      { in: { 'I0.0': true }, n: 1500 }, { in: { 'I0.0': false }, n: 20 }, { in: { 'I0.0': true }, n: 50 }]);
    const cyc = S.reduce((a, s) => a.concat(s.cycles), []);
    r(S[0].last['Q0.2'] && S[0].last['Q0.3'] && !S[0].any['Q0.4'] && !S[0].any['Q0.0'], 'Grundstellung: Die Straße hat Grün, die Fußgänger haben Rot', 'H3 (Q0.2) grün und H4 (Q0.3) rot, solange niemand gedrückt hat.');
    r(S[1].last['Q0.4'] && !S[1].last['Q0.3'] && S[1].last['Q0.0'] && !S[1].last['Q0.2'], 'Nach dem Tastendruck bekommen die Fußgänger Grün, die Straße Rot', 'H5 (Q0.4) an, H4 (Q0.3) aus, Straße: H1 (Q0.0) an, H3 (Q0.2) aus.');
    r(S[2].last['Q0.4'] && S[3].last['Q0.4'], 'Das Fußgänger-Grün bleibt nach dem Loslassen bestehen', 'Der Impuls (TP) läuft unabhängig vom Taster weiter. TP braucht PT = 6000 ms.');
    r(!S[4].last['Q0.4'] && S[4].last['Q0.3'] && S[4].last['Q0.2'] && !S[4].last['Q0.0'], 'Nach etwa 6 Sekunden ist die Grundstellung wieder da', 'Der Impuls soll genau 6 s dauern, danach Fußgänger Rot und Straße Grün.');
    const n = S[5].cycles.filter(c => c['Q0.4']).length;
    r(n >= 560 && n <= 640 && !S[5].last['Q0.4'], 'Bei dauernd gedrücktem Taster dauert das Fußgänger-Grün trotzdem nur 6 Sekunden', 'Gemessen: ' + (Math.round(n / 10) / 10).toString().replace('.', ',') + ' s. Ein Impuls (TP) startet mit der steigenden Flanke und läuft dann seine Zeit ab, auch wenn der Taster gehalten wird.');
    r(cyc.every(c => !!c['Q0.0'] === !!c['Q0.4'] && !!c['Q0.2'] === !c['Q0.4']), 'Die Straße zeigt genau dann Rot, wenn die Fußgänger Grün haben', 'H1 (Q0.0) folgt H5 (Q0.4), H3 (Q0.2) ist deren Gegenteil.');
    r(cyc.every(c => !!c['Q0.3'] !== !!c['Q0.4']), 'Die Fußgängerampel zeigt immer genau Rot oder Grün', 'H4 (Q0.3) leuchtet, solange H5 (Q0.4) nicht leuchtet.');
    r(S[7].last['Q0.4'], 'Ein neuer Tastendruck löst das Fußgänger-Grün erneut aus', 'Nach Ablauf muss ein neuer Tastendruck wieder einen Impuls starten.');
  });
  const checkSp28 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.7': true, 'I0.6': false }, e);
    const S = logic(prog, 'foerderband', [{ in: b(), n: 10 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 50 }, { in: b({ 'I0.6': true }), n: 300 }, { in: b(), n: 50 },
      { in: b({ 'I0.6': true }), n: 480 }, { in: b({ 'I0.6': true }), n: 40 }, { in: b({ 'I0.6': true }), n: 200 }, { in: b(), n: 50 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 50 }, { in: b({ 'I0.7': false }), n: 10 }]);
    r(!S[0].any['Q0.0'] && !S[0].any['Q0.3'] && S[1].last['Q0.0'] && S[2].last['Q0.0'], 'Das Band startet mit Selbsthaltung, ohne Störmeldung', 'K1 (Q0.0) hält sich selbst, H2 (Q0.3) bleibt im Normalbetrieb aus.');
    r(S[3].last['Q0.0'] && !S[3].any['Q0.3'] && S[4].last['Q0.0'], 'Ein Werkstück, das nur 3 Sekunden am Sensor steht, löst keine Störung aus', 'Die Einschaltverzögerung (TON) soll erst nach 5 s ununterbrochener Belegung ansprechen.');
    r(S[5].last['Q0.0'] && !S[5].any['Q0.3'], 'Nach knapp 5 Sekunden Belegung läuft das Band noch', 'TON mit PT = 5000 ms und dem Sensor B5 (I0.6) als Eingang.');
    r(S[6].last['Q0.3'] && !S[6].last['Q0.0'], 'Nach 5 Sekunden Belegung leuchtet H2 und das Band steht', 'T1.Q muss H2 (Q0.3) einschalten und die Selbsthaltung des Bandes unterbrechen.');
    r(S[7].last['Q0.3'] && !S[7].any['Q0.0'], 'Solange B5 belegt ist, bleibt die Störung und das Band aus', 'Das Band darf bei Stau nicht wieder anlaufen.');
    r(!S[8].last['Q0.3'] && !S[8].any['Q0.0'], 'Ist der Stau weg, erlischt H2, das Band bleibt aber aus', 'Nach dem Beseitigen des Staus muss erst neu gestartet werden: Die Selbsthaltung ist ja gelöscht.');
    r(S[10].last['Q0.0'] && !S[10].any['Q0.3'], 'Ein neuer Start fährt das Band wieder an', 'S1 startet die Selbsthaltung, sobald T1.Q nicht mehr gesetzt ist.');
    r(!S[11].last['Q0.0'], 'Der Not-Halt schaltet das Band weiterhin ab', 'S3 (I0.7) ist ein Öffner und gehört in Reihe zur Selbsthaltung.');
  });
  const checkSp29 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.5': true, 'I0.6': true }, e);
    const S = logic(prog, 'tank', [{ in: b(), n: 10 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 100 }, { in: b(), n: 130 }, { in: b(), n: 50 },
      { in: b({ 'I0.1': false }), n: 10 }, { in: b(), n: 300 }, { in: b({ 'I0.0': true, 'I0.2': false }), n: 10 }, { in: b(), n: 300 },
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 300 }, { in: b({ 'I0.2': false }), n: 10 }, { in: b(), n: 300 },
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 250 }, { in: b({ 'I0.6': false }), n: 10 }, { in: b(), n: 100 }]);
    const cyc = S.reduce((a, s) => a.concat(s.cycles), []);
    r(!S[0].any['Q0.3'] && !S[0].any['Q0.4'], 'Ohne Start bleibt alles aus', 'Ventil Y3 (Q0.3) und Pumpe P1 (Q0.4) dürfen im Ruhezustand nicht eingeschaltet sein.');
    r(S[1].last['Q0.3'] && !S[1].any['Q0.4'] && S[2].last['Q0.3'] && !S[2].any['Q0.4'], 'Nach dem Start öffnet zuerst das Ablaufventil, die Pumpe wartet noch', 'Y3 (Q0.3) folgt dem Merker sofort, P1 (Q0.4) kommt über ein Zeitglied.');
    r(S[3].last['Q0.3'] && S[3].last['Q0.4'] && S[4].last['Q0.4'], 'Nach 2 Sekunden läuft auch die Pumpe', 'Einschaltverzögerung (TON) mit PT = 2000 ms, Eingang ist der Merker M0.0.');
    r(cyc.every(c => !c['Q0.4'] || c['Q0.3']), 'Die Pumpe läuft nie bei geschlossenem Ventil', 'Y3 muss immer an sein, wenn P1 an ist. Beide hängen am selben Merker.');
    r(!S[5].last['Q0.3'] && !S[5].last['Q0.4'] && !S[6].any['Q0.3'] && !S[6].any['Q0.4'], 'Stopp schaltet Ventil und Pumpe aus, nichts läuft von selbst wieder an', 'S2 (I0.1) ist ein Öffner und gehört in Reihe zur Selbsthaltung des Merkers.');
    r(!S[8].any['Q0.3'] && !S[8].any['Q0.4'], 'Bei leerem Behälter (B1 = 0) startet der Ablauf nicht, auch nicht später', 'Der Start gilt nur bei B1 (I0.2) = 1. Danach darf er nicht nachträglich anlaufen, wenn B1 wieder 1 wird.');
    r(S[10].last['Q0.3'] && S[10].last['Q0.4'] && !S[11].last['Q0.3'] && !S[11].last['Q0.4'] && !S[12].any['Q0.3'] && !S[12].any['Q0.4'], 'Fällt der Füllstand unter Min, schalten Ventil und Pumpe aus', 'B1 (I0.2) gehört als Schließer in die Selbsthaltung des Merkers, nicht nur zum Start-Zweig.');
    r(S[14].last['Q0.4'] && !S[15].last['Q0.3'] && !S[15].last['Q0.4'] && !S[16].any['Q0.3'], 'Der Not-Halt schaltet beides sofort ab', 'S3 (I0.6) ist ein Öffner und gehört in Reihe zur Selbsthaltung.');
  });
  const checkSp30 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.6': true }, e);
    const lo = b({ 'I0.2': false });
    const S = logic(prog, 'tank', [{ in: b(), n: 10 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 100 }, { in: lo, n: 100 }, { in: b(), n: 20 }, { in: lo, n: 180 }, { in: b(), n: 20 },
      { in: lo, n: 150 }, { in: lo, n: 100 }, { in: b(), n: 300 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 50 }, { in: b({ 'I0.1': false }), n: 10 },
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 }, { in: b({ 'I0.6': false }), n: 10 }, { in: b({ 'I0.0': true, 'I0.2': false }), n: 50 }]);
    r(!S[0].any['Q0.4'] && S[1].last['Q0.4'] && S[2].last['Q0.4'], 'Start schaltet die Pumpe ein, sie hält sich selbst', 'P1 (Q0.4) mit Selbsthaltung. Gestartet wird nur bei B1 (I0.2) = 1.');
    r(S[3].last['Q0.4'] && S[4].last['Q0.4'], 'Ein Aussetzer von B1 über 1 Sekunde schaltet die Pumpe nicht ab', 'Die Abschaltung kommt erst nach einer Verzögerung. Dafür eignet sich eine Einschaltverzögerung (TON) auf „B1 meldet 0“.');
    r(S[5].last['Q0.4'] && S[6].last['Q0.4'], 'Auch ein zweiter Aussetzer über 1,8 Sekunden schaltet nicht ab (die Zeit startet jedes Mal neu)', 'Meldet B1 zwischendurch wieder 1, wird das Zeitglied zurückgesetzt. Die Zeit muss also ununterbrochen laufen.');
    r(S[7].last['Q0.4'], 'Nach 1,5 Sekunden ohne B1 läuft die Pumpe noch', 'TON mit PT = 2000 ms.');
    r(!S[8].last['Q0.4'], 'Nach 2,5 Sekunden ohne B1 schaltet die Pumpe ab', 'Der Ausgang des TON (T1.Q) sperrt die Selbsthaltung der Pumpe. Der Eingang des TON ist die Negation von B1.');
    r(!S[9].any['Q0.4'], 'Wird B1 danach wieder 1, läuft die Pumpe nicht von selbst wieder an', 'Die Selbsthaltung wurde gelöscht. Ein neuer Start ist nötig.');
    r(S[11].last['Q0.4'] && !S[12].last['Q0.4'], 'Stopp schaltet die Pumpe sofort ab', 'S2 (I0.1) ist ein Öffner in Reihe zur Selbsthaltung, ohne Verzögerung.');
    r(S[14].last['Q0.4'] && !S[15].last['Q0.4'], 'Not-Halt schaltet die Pumpe sofort ab', 'S3 (I0.6) ist ein Öffner in Reihe zur Selbsthaltung, ohne Verzögerung.');
    r(!S[16].any['Q0.4'], 'Bei Min unterschritten (B1 = 0) lässt sich die Pumpe nicht starten', 'Der Start-Zweig braucht UND B1 (I0.2).');
  });
  const checkSp31 = mkCheck((prog, r) => {
    const sA = script();
    const a = sim(prog, 'garagentor', { ms: 24000, scen: 'offen', drive: sA.drive, sample: p => ({ pos: p.state().doorPos }) });
    const f = first(a.rec, x => x.o['Q0.1']);
    r(!someOf(win(a.rec, 0, 7500), x => x.o['Q0.1']) && !!f && f.t >= 7700 && f.t <= 8800, 'Das offene Tor wartet etwa 8 Sekunden, dann fährt es von selbst zu', 'Eine Einschaltverzögerung (TON) mit PT = 8000 ms, Eingang: B1 (I0.2) = 1. Ihr Ausgang startet den Motor Ab (Q0.1).' + (f ? ' Gemessen: Start nach ' + sec(f.t) + ' s.' : ' Gemessen: Das Tor schließt nicht.'));
    r(!!f && at(a.rec, 23900).s.pos <= 2 && !someOf(win(a.rec, 22000, 24000), x => x.o['Q0.1']) && !a.st.overrun && !a.st.crash, 'Es fährt bis zum Endschalter unten, dort schaltet der Motor ab', 'Q0.1 muss sich selbst halten, auch wenn das Tor B1 verlässt (die Wartezeit läuft dann nicht mehr). B2 (I0.3) schaltet ab.');
    r(a.st.crashes === 0 && allOf(win(a.rec, 0, 24000).filter(x => x.o['Q0.0'] || x.o['Q0.1']), x => x.o['Q0.2']), 'Das Blinklicht H1 leuchtet bei jeder Motorfahrt', 'H1 (Q0.2) = Motor Auf ODER Motor Ab.');
    const sB = script().at(10000, p => p.setObstacle(true, 'auto')).at(13000, p => p.setObstacle(false)).press('I0.0', 14000, 1500);
    const b = sim(prog, 'garagentor', { ms: 18000, scen: 'offen', drive: sB.drive, sample: p => ({ pos: p.state().doorPos }) });
    const pb = t => at(b.rec, t).s.pos;
    r(!b.st.crash && pb(10600) > 50 && !someOf(win(b.rec, 10200, 14000), x => x.o['Q0.1']), 'Taucht beim Schließen ein Hindernis auf, stoppt das Tor sofort (kein Crash)', 'B3 (I0.4) = 1 muss die Selbsthaltung von Motor Ab lösen.');
    r(Math.abs(pb(13900) - pb(10600)) < 1, 'Ist das Hindernis weg, bleibt das Tor stehen und schließt nicht von selbst weiter', 'Die Wartezeit läuft nur, wenn das Tor ganz oben steht (B1). In der Mitte darf der Motor nicht neu anlaufen.');
    r(pb(16500) > pb(13900) + 15 && !someOf(win(b.rec, 15600, 18000), x => x.o['Q0.0']), 'Mit S1 fährt das Tor im Tippbetrieb wieder auf, solange der Taster gedrückt ist', 'Motor Auf (Q0.0) läuft nur bei S1, nicht oben (B1) und nur, wenn Motor Ab nicht läuft.');
    const sC = script().set('I0.5', 0, false).set('I0.5', 9000, true);
    const c = sim(prog, 'garagentor', { ms: 19000, scen: 'offen', drive: sC.drive });
    r(!someOf(win(c.rec, 0, 16500), x => x.o['Q0.1']) && someOf(win(c.rec, 16500, 19000), x => x.o['Q0.1']), 'Solange Stopp gedrückt ist, läuft die Wartezeit nicht, sie beginnt erst nach dem Loslassen neu', 'S3 (I0.5) ist ein Öffner. Als Schließer-Kontakt am Eingang des TON setzt ein gedrückter Stopp das Zeitglied zurück.');
    const d = sim(prog, 'garagentor', { ms: 12000, scen: 'hindernis_auto' });
    r(!someOf(d.rec, x => x.o['Q0.1']) && !d.st.crash, 'Steht ein Hindernis im Tor, schließt das Tor nicht von selbst', 'Die Wartezeit läuft nur bei B3 (I0.4) = 0. Mit Hindernis kommt der Motor nie.');
  });
  const checkSp32 = checkSp8;

  /* ---- Erweiterung: Aufgaben sp33 bis sp37 (nach dem Berufsschulstoff Steuerrelais, Lernfeld E10.1: Verriegelung der Schütze, Antippen und Dauerfahrt, Störmeldung mit Quittierung, Zählschwellen, Öffner und Schließer) ---- */
  // sp33 Garagentor: Pause beim Richtungswechsel
  const torWendeSol = () => kop('garagentor', [
    net('N1', 'Motor Auf (Tippbetrieb)', AND(v('I0.0'), nv('I0.2'), nv('Q0.1'), nv('T2.Q')), [coil('Q0.0')]),
    net('N2', 'Motor Ab (Tippbetrieb)', AND(v('I0.1'), nv('I0.3'), nv('Q0.0'), nv('T1.Q')), [coil('Q0.1')]),
    net('N3', 'Auslaufzeit nach Auf', TOF('T1', 1000, v('Q0.0')), [coil('M0.0')]),
    net('N4', 'Auslaufzeit nach Ab', TOF('T2', 1000, v('Q0.1')), [coil('M0.1')])], { 'M0.0': 'M_Auslauf_Auf', 'M0.1': 'M_Auslauf_Ab' });
  const torWendeStart = () => { const p = torTipp(); p.symbols = sy('garagentor', { 'M0.0': 'M_Auslauf_Auf', 'M0.1': 'M_Auslauf_Ab' }); return p; };
  // sp34 Garagentor: kurzer Druck und Dauerfahrt ab 0,5 s
  const torLangSol = () => kop('garagentor', [
    net('N1', 'Auf lange gedrückt', TON('T1', 500, v('I0.0')), [coil('M0.0')]),
    net('N2', 'Ab lange gedrückt', TON('T2', 500, v('I0.1')), [coil('M0.1')]),
    net('N3', 'Motor Auf (Dauerfahrt)', AND(OR(v('M0.0'), v('Q0.0')), nv('I0.2'), nv('I0.1'), v('I0.5'), nv('Q0.1')), [coil('Q0.0')]),
    net('N4', 'Motor Ab (Dauerfahrt)', AND(OR(v('M0.1'), v('Q0.1')), nv('I0.3'), nv('I0.0'), v('I0.5'), nv('Q0.0')), [coil('Q0.1')])], { 'M0.0': 'M_Auf_lang', 'M0.1': 'M_Ab_lang' });
  const torLangStart = () => { const p = torTipp(); p.symbols = sy('garagentor', { 'M0.0': 'M_Auf_lang', 'M0.1': 'M_Ab_lang' }); return p; };
  // sp35 Tank: Störung speichern, mit 2 Hz blinken, quittieren
  const tankQuitSol = () => kop('tank', [
    net('N1', 'Not-Halt: Störung merken', nv('I0.6'), [set('M0.0')]),
    net('N2', 'Quittieren mit S2, wenn Not-Halt entriegelt', AND(nv('I0.1'), v('I0.6')), [rst('M0.0')]),
    net('N3', 'Rührwerk', AND(OR(v('I0.0'), v('Q0.2')), v('I0.1'), v('I0.6'), nv('M0.0')), [coil('Q0.2')]),
    net('N4', 'Blinken: Pause', TON('T1', 250, AND(v('M0.0'), nv('T2.Q'))), [coil('Q0.5')]),
    net('N5', 'Blinken: Leuchtzeit', TON('T2', 250, v('T1.Q')), [coil('M0.1')])], { 'M0.0': 'M_Stoerung', 'M0.1': 'M_Blinkpause' });
  const tankQuitStart = () => kop('tank', [
    net('N1', 'Rührwerk', AND(OR(v('I0.0'), v('Q0.2')), v('I0.1'), v('I0.6')), [coil('Q0.2')]),
    net('N2', 'Störlampe', nv('I0.6'), [coil('Q0.5')])], { 'M0.0': 'M_Stoerung', 'M0.1': 'M_Blinkpause' });
  // sp36 Förderband: Vorwarnung bei 3 und 4 Werkstücken, Band hält bei 5
  const bandFensterSol = () => kop('foerderband', [
    net('N1', 'Drei Werkstücke gezählt', CTU('C1', 3, v('I0.6'), v('I0.0')), [coil('M0.0')]),
    net('N2', 'Fünf Werkstücke gezählt', CTU('C2', 5, v('I0.6'), v('I0.0')), [coil('M0.1')]),
    net('N3', 'Vorwarnung: drei oder vier', AND(v('M0.0'), nv('M0.1')), [coil('Q0.3')]),
    net('N4', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7'), nv('M0.1')), [coil('Q0.0')])], { 'M0.0': 'M_Drei', 'M0.1': 'M_Fuenf' });
  const bandFensterStart = () => kop('foerderband', [
    net('N1', 'Drei Werkstücke gezählt', CTU('C1', 3, v('I0.6'), v('I0.0')), [coil('Q0.3')]),
    net('N2', 'Band', AND(OR(v('I0.0'), v('Q0.0')), v('I0.1'), v('I0.7')), [coil('Q0.0')])], { 'M0.0': 'M_Drei', 'M0.1': 'M_Fuenf' });
  // sp37 Fehlersuche Tank: Ablaufventil, Öffner und Schließer
  const tankAblaufSol = () => kop('tank', [
    net('N1', 'Ablaufventil Y3', AND(OR(AND(v('I0.0'), v('I0.2')), v('Q0.3')), v('I0.1'), v('I0.6'), v('I0.2')), [coil('Q0.3')])]);
  const tankAblaufBug = () => kop('tank', [
    net('N1', 'Ablaufventil Y3', AND(OR(AND(v('I0.0'), v('I0.2')), v('Q0.3')), nv('I0.1'), v('I0.2')), [coil('Q0.3')])]);

  const checkSp33 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': false, 'I0.2': false, 'I0.3': false, 'I0.4': false, 'I0.5': true }, e);
    const flat = S => S.reduce((a, s) => a.concat(s.cycles), []);
    const firstOn = (c, k, from) => { for (let i = from; i < c.length; i++) if (c[i][k]) return i; return -1; };
    const A = flat(logic(prog, 'garagentor', [{ in: m(), n: 10 }, { in: m({ 'I0.0': true }), n: 50 }, { in: m(), n: 30 }, { in: m({ 'I0.1': true }), n: 150 }]));
    const B = flat(logic(prog, 'garagentor', [{ in: m(), n: 10 }, { in: m({ 'I0.1': true }), n: 50 }, { in: m(), n: 30 }, { in: m({ 'I0.0': true }), n: 150 }]));
    const C = flat(logic(prog, 'garagentor', [{ in: m({ 'I0.0': true }), n: 30 }, { in: m(), n: 20 }, { in: m({ 'I0.0': true }), n: 30 }]));
    const D = flat(logic(prog, 'garagentor', [{ in: m({ 'I0.0': true, 'I0.1': true }), n: 100 }]));
    const E1 = flat(logic(prog, 'garagentor', [{ in: m({ 'I0.0': true, 'I0.2': true }), n: 30 }])), E2 = flat(logic(prog, 'garagentor', [{ in: m({ 'I0.1': true, 'I0.3': true }), n: 30 }]));
    const fA = firstOn(A, 'Q0.1', 60), fB = firstOn(B, 'Q0.0', 60);
    r(A.slice(10, 60).every(c => c['Q0.0'] && !c['Q0.1']) && !A[61]['Q0.0'], 'Tippbetrieb: Auf läuft nur, solange S1 gedrückt ist', 'K1 (Q0.0) folgt S1 (I0.0) so lange, bis das Tor oben ist.');
    r(!A.slice(60, 120).some(c => c['Q0.1']), 'Direkt nach einer Fahrt Auf bleibt die Gegenrichtung gesperrt, auch wenn S2 schon gedrückt ist', 'Nach dem Abschalten von Q0.0 darf Q0.1 erst nach einer Auslaufzeit anziehen. Ein Zeitglied, das den Ausgang Q0.0 abbildet und nach dem Abfallen noch eine Zeit hält, leistet das (TOF).');
    r(fA >= 140 && fA <= 190, 'Die Pause beim Wechsel von Auf nach Ab dauert etwa 1 Sekunde' + (fA > 0 ? ' (gemessen: ' + sec((fA - 60) * 10) + ' s)' : ''), 'TOF mit PT = 1000 ms auf Q0.0; sein Ausgang sperrt Q0.1.');
    r(fB >= 140 && fB <= 190, 'Auch von Ab nach Auf gibt es die Pause von etwa 1 Sekunde' + (fB > 0 ? ' (gemessen: ' + sec((fB - 60) * 10) + ' s)' : ''), 'Das zweite Zeitglied (TOF) gehört zu Q0.1 und sperrt Q0.0.');
    r(C[55]['Q0.0'] && C[51]['Q0.0'], 'In dieselbe Richtung geht es ohne Pause weiter', 'Die Auslaufzeit von Auf darf nur die Gegenrichtung (Q0.1) sperren, nicht Q0.0 selbst.');
    r(![A, B, C, D].some(L => L.some(c => c['Q0.0'] && c['Q0.1'])), 'Die Schütze ziehen nie gleichzeitig an, auch nicht bei zwei gedrückten Tastern', 'Q0.1 muss in der Auf-Zeile als Öffner stehen und umgekehrt (Verriegelung), zusätzlich zur Pause.');
    r(!E1.some(c => c['Q0.0']) && !E2.some(c => c['Q0.1']), 'Die Endschalter schalten die Motoren ab', 'B1 (I0.2) sperrt Motor Auf, B2 (I0.3) sperrt Motor Ab.');
  });
  const checkSp34 = mkCheck((prog, r) => {
    const s1 = script().press('I0.0', 500, 300).press('I0.1', 1500, 300).press('I0.0', 3000, 900).press('I0.1', 5000, 300).press('I0.0', 7000, 900).press('I0.1', 9000, 1200).press('I0.0', 13000, 900).press('I0.5', 15000, 300, true);
    const a = sim(prog, 'garagentor', { ms: 17500, scen: 'zu', drive: s1.drive, sample: p => ({ pos: p.state().doorPos }) });
    const R = a.rec, pos = t => at(R, t).s.pos, moving = (t0, t1) => someOf(win(R, t0, t1), x => x.o['Q0.0'] || x.o['Q0.1']);
    r(!moving(400, 2400) && pos(2400) < 1, 'Kurz angetippt (unter 0,5 s): Das stehende Tor bewegt sich nicht', 'Erst wenn S1 oder S2 länger als 0,5 s gedrückt bleiben, soll etwas passieren. Ein Zeitglied (TON, PT = 500 ms) am Taster liefert das Signal „lange gedrückt“.');
    r(pos(4900) > 12 && pos(4900) < 35 && !someOf(win(R, 3600, 4950), x => !x.o['Q0.0']), 'Mehr als 0,5 s gedrückt: Das Tor fährt von selbst weiter, auch nach dem Loslassen', 'Das Signal „lange gedrückt“ startet die Fahrt. Danach hält sich der Motor selbst (Selbsthaltung).');
    r(!moving(5300, 6900) && Math.abs(pos(6900) - pos(5400)) < 1, 'Kurzer Druck in die Gegenrichtung: Das Tor hält sofort an und fährt nicht in die andere Richtung', 'Die gedrückte Taste der Gegenrichtung löst die Selbsthaltung. Weil sie kürzer als 0,5 s gedrückt wird, startet keine neue Fahrt.');
    r(pos(8900) > pos(7000) + 8 && !moving(9050, 9400) && pos(10800) < pos(9000) - 10, 'Gegenrichtung länger als 0,5 s gedrückt: Das Tor hält an und fährt danach in die andere Richtung', 'Der Ab-Motor startet erst, wenn „Ab lange gedrückt“ gilt und Motor Auf schon aus ist (Verriegelung).');
    r(pos(14950) > 15 && pos(14950) < 45 && !moving(15100, 17400) && Math.abs(pos(17400) - pos(15100)) < 1, 'S3_Stopp hält das Tor mitten in der Fahrt an und es fährt nicht von selbst weiter', 'S3 (I0.5) ist ein Öffner: Im Ruhezustand liefert er 1. Er gehört als Schließer-Kontakt in beide Selbsthaltungen.');
    const s2 = script().press('I0.0', 500, 800);
    const b = sim(prog, 'garagentor', { ms: 9000, scen: 'zu', drive: s2.drive, sample: p => ({ pos: p.state().doorPos }) });
    r(at(b.rec, 8900).s.pos >= 98 && !someOf(win(b.rec, 8000, 9000), x => x.o['Q0.0']) && !b.st.overrun && !b.st.crash, 'Am Endschalter oben schaltet der Motor ab, ohne Überfahren und ohne Crash', 'B1 (I0.2) sperrt Motor Auf. Auch das Zeitglied darf den Motor danach nicht wieder einschalten, wenn S1 noch gedrückt ist.');
    const s3 = script().press('I0.0', 500, 800).press('I0.1', 3000, 800).press('I0.0', 3000, 800);
    const c = sim(prog, 'garagentor', { ms: 6000, scen: 'zu', drive: s3.drive });
    r(!someOf(c.rec, x => x.o['Q0.0'] && x.o['Q0.1']) && !c.st.crash, 'Auf und Ab laufen nie gleichzeitig', 'Verriegele die beiden Motoren gegeneinander (Öffner-Kontakt des anderen Ausgangs).');
  });
  const checkSp35 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.3': true, 'I0.4': false, 'I0.5': false, 'I0.6': true }, e);
    const S = logic(prog, 'tank', [
      { in: b(), n: 50 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 },                                          // 0 bis 2: Start, Rührwerk läuft
      { in: b({ 'I0.6': false }), n: 100 },                                                                               // 3: Not-Halt betätigt
      { in: b({ 'I0.6': false, 'I0.1': false }), n: 10 }, { in: b({ 'I0.6': false }), n: 100 },                           // 4, 5: Stopp bei gedrücktem Not-Halt quittiert noch nicht
      { in: b(), n: 300 },                                                                                                // 6: Not-Halt entriegelt, Störung bleibt
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 },                                                             // 7, 8: Start geht nicht
      { in: b({ 'I0.1': false }), n: 10 }, { in: b(), n: 60 },                                                            // 9, 10: Quittieren
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 }]);                                                           // 11, 12: Start geht wieder
    const lamp = S[3].cycles.concat(S[4].cycles, S[5].cycles, S[6].cycles).map(c => !!c['Q0.5']);
    const rise = []; lamp.forEach((x, i) => { if (x && (i === 0 || !lamp[i - 1])) rise.push(i); });
    const gaps = rise.slice(1).map((x, i) => x - rise[i]);
    const highs = []; { let n = 0; lamp.forEach((x, i) => { if (x) n++; else if (n) { highs.push(n); n = 0; } }); }
    r(!S[0].any['Q0.5'] && !S[0].any['Q0.2'] && S[1].last['Q0.2'] && S[2].last['Q0.2'] && !S[2].any['Q0.5'], 'Im Normalbetrieb läuft das Rührwerk nach dem Start (mit Selbsthaltung), die Störlampe bleibt aus', 'Q0.2 mit Selbsthaltung, Start S1, Stopp S2 und Not-Halt S3 als Öffner in Reihe. Q0.5 nur bei Störung.');
    r(!S[3].last['Q0.2'] && lamp.slice(0, 30).some(x => x), 'Not-Halt betätigt: Das Rührwerk geht aus, die Störlampe beginnt zu blinken', 'Die Störung braucht einen Merker (Setzen bei Not-Halt = 0). Das Rührwerk hängt an Not-Halt und am Merker.');
    r(rise.length >= 8 && gaps.every(g => g >= 44 && g <= 56), 'Die Lampe blinkt mit 2 Hz (alle halbe Sekunde ein Blinkimpuls)' + (gaps.length ? ' (gemessen: Periode ' + sec(gaps[0] * 10) + ' s)' : ''), 'Zwei Einschaltverzögerungen (TON) mit je PT = 250 ms: Das eine liefert die Pause, das andere die Leuchtzeit und setzt das erste zurück.');
    r(highs.length >= 4 && highs.slice(0, -1).every(h => h >= 20 && h <= 30), 'Leuchtzeit und Pause sind gleich lang (je etwa 0,25 s)', 'Beide Zeitglieder bekommen PT = 250 ms, dann ist das Verhältnis 1 : 1.');
    r(lamp.slice(150).some(x => x), 'Die Störung bleibt gespeichert und blinkt weiter, auch wenn der Not-Halt wieder entriegelt ist', 'Die Störung wird mit Setzen gespeichert und nur durch Quittieren gelöscht, nicht durch das Entriegeln.');
    r(S[5].any['Q0.5'] && lamp.slice(110, 150).some(x => x), 'Der Stopp-Taster quittiert nicht, solange der Not-Halt noch gedrückt ist', 'Das Rücksetzen der Störung braucht zusätzlich Not-Halt entriegelt (I0.6 = 1).');
    r(!S[7].any['Q0.2'] && !S[8].any['Q0.2'], 'Mit gespeicherter Störung lässt sich das Rührwerk nicht starten', 'Der Merker der Störung sperrt (Öffner-Kontakt) das Rührwerk.');
    r(!S[10].last['Q0.5'] && !S[10].any['Q0.2'] && !S[11].any['Q0.5'], 'Quittieren mit S2 löscht die Störung und die Lampe erlischt, das Rührwerk bleibt aus', 'Rücksetzen des Merkers mit „S2 gedrückt UND Not-Halt entriegelt“. Das Rührwerk startet damit noch nicht, weil dafür S1 nötig ist.');
    r(S[11].last['Q0.2'] && S[12].last['Q0.2'], 'Nach dem Quittieren startet ein neuer Druck auf S1 das Rührwerk', 'Mit gelöschter Störung muss die normale Start-Selbsthaltung wieder funktionieren.');
  });
  const checkSp36 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.6': false, 'I0.7': true }, e);
    const pulse = (hold) => [{ in: b({ 'I0.6': true }), n: hold || 3 }, { in: b(), n: 5 }];
    const st = [{ in: b(), n: 10 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 10 }];
    const seq = st.concat(pulse(40), pulse(), pulse(), pulse(), pulse(), [{ in: b({ 'I0.6': true }), n: 3 }, { in: b(), n: 5 }]);
    const S = logic(prog, 'foerderband', seq), after = k => S[3 + 2 * k + 1];
    r(S[2].last['Q0.0'] && !S[2].any['Q0.3'] && after(0).last['Q0.0'] && !after(0).any['Q0.3'] && after(1).last['Q0.0'] && !after(1).any['Q0.3'], 'Bei null bis zwei Werkstücken läuft das Band, H2 bleibt aus', 'Die Vorwarnung gilt erst ab drei Werkstücken. Ein Werkstück, das länger am Sensor liegt, zählt nur einmal.');
    r(after(2).last['Q0.3'] && after(2).last['Q0.0'] && after(3).last['Q0.3'] && after(3).last['Q0.0'], 'Beim dritten und vierten Werkstück leuchtet H2 (Vorwarnung), das Band läuft noch', 'Der Zähler C1 mit PV = 3 liefert „mindestens drei“. H2 darf aber nur leuchten, solange noch nicht fünf gezählt sind.');
    r(!after(4).last['Q0.0'] && !after(4).last['Q0.3'] && !after(4).any['Q0.0'], 'Beim fünften Werkstück hält das Band an und H2 erlischt', 'Ein zweiter Zähler C2 mit PV = 5 liefert „mindestens fünf“. Er sperrt das Band und die Vorwarnung.');
    r(!after(4).last['Q0.0'] && !S[S.length - 1].last['Q0.0'], 'Ein weiteres Werkstück am Sensor startet das Band nicht wieder', 'Das Band darf erst nach einem neuen Start durch S1 wieder laufen.');
    const T = logic(prog, 'foerderband', st.concat(pulse(), pulse(), pulse(), pulse(), pulse(), [{ in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 20 }], pulse(), pulse(), pulse()));
    r(T[T.length - 1].last['Q0.3'] && T[T.length - 1].last['Q0.0'] && !T[T.length - 4].any['Q0.3'] && T[T.length - 4].last['Q0.0'], 'Ein neuer Start durch S1 setzt beide Zähler zurück und das Band läuft wieder', 'S1 (I0.0) kommt als Reset-Eingang an beide Zähler. Danach beginnt das Zählen wieder bei null (nach drei Teilen leuchtet H2 erneut).');
    const U = logic(prog, 'foerderband', st.concat(pulse(), [{ in: b({ 'I0.1': false }), n: 10 }, { in: b(), n: 20 }], pulse()));
    r(!U[U.length - 3].last['Q0.0'] && !U[U.length - 2].any['Q0.0'] && !U[U.length - 1].any['Q0.0'], 'Stopp hält das Band an, es läuft nicht von selbst wieder an', 'S2 (I0.1) ist ein Öffner und gehört als Schließer-Kontakt in die Selbsthaltung.');
    const V = logic(prog, 'foerderband', st.concat([{ in: b({ 'I0.7': false }), n: 10 }, { in: b(), n: 20 }]));
    r(!V[V.length - 2].last['Q0.0'] && !V[V.length - 1].any['Q0.0'], 'Not-Halt hält das Band an, es läuft nicht von selbst wieder an', 'S3 (I0.7) ist ebenfalls ein Öffner in der Selbsthaltung.');
  });
  const checkSp37 = mkCheck((prog, r) => {
    const b = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.3': false, 'I0.4': false, 'I0.5': false, 'I0.6': true }, e);
    const S = logic(prog, 'tank', [{ in: b(), n: 20 }, { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 }, { in: b({ 'I0.1': false }), n: 10 }, { in: b(), n: 30 },
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 }, { in: b({ 'I0.6': false }), n: 10 }, { in: b(), n: 30 },
      { in: b({ 'I0.0': true }), n: 10 }, { in: b(), n: 30 }, { in: b({ 'I0.2': false }), n: 10 }, { in: b(), n: 30 }, { in: b({ 'I0.0': true, 'I0.2': false }), n: 10 }, { in: b(), n: 30 }]);
    r(!S[0].any['Q0.3'], 'Ohne Bedienung bleibt das Ablaufventil zu', 'Im Ruhezustand darf Y3 (Q0.3) nicht eingeschaltet sein.');
    r(S[1].last['Q0.3'] && S[2].last['Q0.3'], 'Nach dem Start öffnet das Ablaufventil und bleibt nach dem Loslassen offen', 'Y3 (Q0.3) braucht eine Selbsthaltung. Prüfe jeden Kontakt: Ein Öffner-Taster liefert im Ruhezustand eine 1 und gehört deshalb als normaler Schließer-Kontakt (nicht negiert) in die Reihenschaltung.');
    r(!S[3].last['Q0.3'] && !S[4].any['Q0.3'], 'Stopp schließt das Ventil, es öffnet nicht von selbst wieder', 'S2 (I0.1) in Reihe zur Selbsthaltung, als Schließer-Kontakt abgefragt.');
    r(S[5].last['Q0.3'] && !S[7].last['Q0.3'] && !S[8].any['Q0.3'], 'Not-Halt schließt das Ventil sofort, es öffnet nicht von selbst wieder', 'S3 (I0.6) ist ebenfalls ein Öffner. Er fehlt im Programm.');
    r(S[9].last['Q0.3'] && !S[11].last['Q0.3'] && !S[12].any['Q0.3'], 'Fällt der Füllstand unter Min, schließt das Ventil', 'B1 (I0.2) gehört als Schließer in die Reihenschaltung der Selbsthaltung.');
    r(!S[13].any['Q0.3'] && !S[14].any['Q0.3'], 'Bei leerem Tank (B1 = 0) lässt sich das Ventil nicht öffnen', 'Der Start braucht B1 (I0.2) = 1.');
  });

  /* ---- Erweiterung: Aufgaben sp38 bis sp43 (nach dem Berufsschulstoff GRAFCET, Lernfeld E10.1: Zeitaktionen D und L, speichernde Aktion S und R,
     parallele Ablaufkette, Zeitbedingung zu kurz, Fehlersuche mit verdecktem zweitem Fehler). Alle Prüfungen laufen über logic() mit festen Eingangsfolgen. ---- */
  // sp38 Garagentor: Zeitaktionen statt Warteschritt
  const GRA_TOR_D = (start) => gra('garagentor', [
    step('S0', 'Grundstellung', [], true),
    step('S1', 'Tor fährt auf', start ? [A('N', 'Q0.2'), A('N', 'Q0.0')] : [A('N', 'Q0.2'), A('D', 'Q0.0', 3000)]),
    step('S2', 'Tor offen', start ? [A('N', 'Q0.3')] : [A('L', 'Q0.3', 5000)]),
    step('S3', 'Tor fährt zu', start ? [A('N', 'Q0.2'), A('N', 'Q0.1')] : [A('N', 'Q0.2'), A('D', 'Q0.1', 3000)])],
  [tr('T1', 'S0', 'S1', 'I0.0 AND I0.5'), tr('T2', 'S1', 'S2', 'I0.2'), tr('T3', 'S2', 'S3', 'I0.1 AND I0.5'), tr('T4', 'S3', 'S0', 'I0.3')]);
  // sp39 Förderband: speichernde Aktion, Betriebsleuchte bleibt nach dem Stopp an
  const GRA_BAND_S = (start) => gra('foerderband', [
    step('S0', 'Bereit', [], true),
    step('S1', 'Band läuft', start ? [A('N', 'Q0.0'), A('N', 'Q0.2')] : [A('N', 'Q0.0'), A('S', 'Q0.2')]),
    step('S2', 'Teil entnehmen', []),
    step('S3', 'Not-Halt', start ? [] : [A('R', 'Q0.2')])],
  [tr('T1', 'S1', 'S3', 'NOT I0.7'), tr('T2', 'S2', 'S3', 'NOT I0.7'), tr('T3', 'S0', 'S3', 'NOT I0.7'), tr('T4', 'S0', 'S1', 'I0.0 AND I0.1 AND I0.7'), tr('T5', 'S1', 'S0', 'NOT I0.1'), tr('T6', 'S2', 'S0', 'NOT I0.1'),
    tr('T7', 'S1', 'S2', 'I0.6'), tr('T8', 'S2', 'S1', 'NOT I0.6'), tr('T9', 'S3', 'S0', 'I0.7')]);
  // sp40 Tank: zeitbegrenzte Aktion, Rührwerk 4 s
  const GRA_TANK_L = (start) => gra('tank', [
    step('S0', 'Grundstellung', [], true),
    step('S1', 'Füllen', [A('N', 'Q0.0')]),
    step('S2', 'Mischen', start ? [A('N', 'Q0.2')] : [A('L', 'Q0.2', 4000)]),
    step('S3', 'Ablassen', [A('N', 'Q0.3')])],
  [tr('T1', 'S0', 'S1', 'I0.0 AND I0.1 AND I0.6 AND NOT I0.4'), tr('T2', 'S1', 'S2', 'I0.4'), tr('T3', 'S2', 'S3', 't/S2/6s'), tr('T4', 'S3', 'S0', 'NOT I0.2')]);
  // sp41 Ampel: Fehlersuche, Fußgänger-Grün kommt nie (Zeitbedingung zu kurz; verdeckt: Fußgänger-Rot bleibt im Schritt dauernd an)
  const GRA_FUSS = (bug) => gra('ampel', [
    step('S0', 'Straße grün', [A('N', 'Q0.2'), A('N', 'Q0.3')], true),
    step('S1', 'Straße gelb', [A('N', 'Q0.1'), A('N', 'Q0.3')]),
    step('S2', 'Straße rot, Fußgänger grün', bug ? [A('N', 'Q0.0'), A('N', 'Q0.3'), A('D', 'Q0.4', 1000)] : [A('N', 'Q0.0'), A('L', 'Q0.3', 1000), A('D', 'Q0.4', 1000)]),
    step('S3', 'Räumzeit', [A('N', 'Q0.0'), A('N', 'Q0.3')]),
    step('S4', 'Straße rot-gelb', [A('N', 'Q0.0'), A('N', 'Q0.1'), A('N', 'Q0.3')])],
  [tr('T1', 'S0', 'S1', 'I0.0'), tr('T2', 'S1', 'S2', 't/S1/3s'), tr('T3', 'S2', 'S3', bug ? 't/S2/1s' : 't/S2/8s'), tr('T4', 'S3', 'S4', 't/S3/2s'), tr('T5', 'S4', 'S0', 't/S4/1s')]);
  // sp42 Tank: parallele Ablaufkette (Zulauf A bis Mitte und Warten auf leeren Behälter 2 gleichzeitig)
  const GRA_TANK_PAR = (start) => {
    const steps = [
      step('S0', 'Grundstellung', [], true),
      step('S1', 'Zulauf A bis Mitte', [A('N', 'Q0.0')]),
      step('S2', 'A fertig', []),
      step('S3', 'Warten auf Behälter 2', [A('N', 'Q0.5')]),
      step('S4', 'Behälter 2 bereit', []),
      step('S5', 'Zulauf B bis Max', [A('N', 'Q0.1')]),
      step('S6', 'Mischen', [A('N', 'Q0.2')]),
      step('S7', 'Ablassen', [A('N', 'Q0.3'), A('N', 'Q0.4')])];
    const tail = [tr('T5', 'S5', 'S6', 'I0.4'), tr('T6', 'S6', 'S7', 't/S6/5s'), tr('T7', 'S7', 'S0', 'NOT I0.2')];
    return gra('tank', steps, start
      ? [tr('T1', 'S0', 'S1', 'I0.0 AND I0.1 AND I0.6'), tr('T2', 'S1', 'S5', 'I0.3')].concat(tail)
      : [tr('T1', 'S0', ['S1', 'S3'], 'I0.0 AND I0.1 AND I0.6'), tr('T2', 'S1', 'S2', 'I0.3'), tr('T3', 'S3', 'S4', 'I0.5'), tr('T4', ['S2', 'S4'], 'S5', 'true')].concat(tail));
  };
  // sp43 Tank: Fehlersuche, Störlampe erlischt nie (Rücksetzen fehlt; verdeckt: Quittieren mit Öffner falsch abgefragt)
  const GRA_TANK_STOER = (bug) => gra('tank', [
    step('S0', 'Bereit', [], true),
    step('S1', 'Füllen', [A('N', 'Q0.0')]),
    step('S2', 'Störung', [A('S', 'Q0.5')]),
    step('S3', 'Quittiert', bug ? [] : [A('R', 'Q0.5')])],
  [tr('T1', 'S0', 'S1', 'I0.0 AND I0.6 AND NOT I0.4'), tr('T2', 'S1', 'S0', 'I0.4'), tr('T3', 'S1', 'S2', 't/S1/20s'), tr('T4', 'S2', 'S3', bug ? 'I0.1' : 'NOT I0.1'), tr('T5', 'S3', 'S0', 'I0.1')]);

  const flatL = S => S.reduce((a, s) => a.concat(s.cycles), []);
  const firstIdx = (c, f, from, to) => { for (let i = from || 0; i < (to == null ? c.length : to); i++) if (f(c[i])) return i; return -1; };
  const allIn = (c, a, b, f) => b > a && c.slice(a, b).every(f);
  const anyIn = (c, a, b, f) => c.slice(a, b).some(f);
  const checkSp38 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': false, 'I0.2': false, 'I0.3': true, 'I0.4': false, 'I0.5': true }, e);
    const c = flatL(logic(prog, 'garagentor', [{ in: m(), n: 20 }, { in: m({ 'I0.0': true }), n: 10 }, { in: m({ 'I0.3': false }), n: 400 }, { in: m({ 'I0.3': false, 'I0.2': true }), n: 700 },
      { in: m({ 'I0.3': false, 'I0.2': true, 'I0.1': true }), n: 10 }, { in: m({ 'I0.3': false }), n: 400 }, { in: m(), n: 50 }, { in: m({ 'I0.0': true }), n: 10 }, { in: m({ 'I0.3': false }), n: 50 }]));
    const up = firstIdx(c, x => x['Q0.0'], 20, 430), dn = firstIdx(c, x => x['Q0.1'], 1130, 1540), h2off = firstIdx(c, x => !x['Q0.3'], 431, 1130);
    r(allIn(c, 0, 20, x => !x['Q0.0'] && !x['Q0.1'] && !x['Q0.2'] && !x['Q0.3']), 'In der Grundstellung ist alles aus', 'S0 hat keine Aktion.');
    r(allIn(c, 21, 300, x => x['Q0.2'] && !x['Q0.0']), 'Nach dem Tastendruck blinkt H1 sofort, der Motor steht noch', 'Im Schritt „Tor fährt auf“ gehört H1 (Q0.2) als normale Aktion (N) hinein, der Motor als verzögerte Aktion (D).');
    r(up >= 315 && up <= 330, 'Der Motor Auf startet etwa 3 s nach dem Tastendruck' + (up > 0 ? ' (gemessen: ' + sec((up - 20) * 10) + ' s)' : ''), 'Verzögerte Aktion: Q0.0 mit Qualifier D und t = 3000 ms. Der Schritt beginnt mit dem Tastendruck, die Aktion erst 3 s später.');
    r(up > 0 && allIn(c, up, 430, x => x['Q0.0'] && x['Q0.2']), 'Danach fährt das Tor mit Blinklicht auf', 'Die verzögerte Aktion bleibt an, bis der Schritt verlassen wird.');
    r(allIn(c, 431, 900, x => !x['Q0.0'] && !x['Q0.2']) && allIn(c, 431, 900, x => x['Q0.3']) && h2off >= 925 && h2off <= 940 && allIn(c, 945, 1130, x => !x['Q0.3']), 'Oben: Motor aus, H2 leuchtet etwa 5 s und geht dann von selbst aus, das Tor bleibt offen' + (h2off > 0 ? ' (gemessen: ' + sec((h2off - 430) * 10) + ' s)' : ''), 'Zeitbegrenzte Aktion: Q0.3 mit Qualifier L und t = 5000 ms im Schritt „Tor offen“. Der Schritt selbst bleibt aktiv, bis S2 gedrückt wird.');
    r(allIn(c, 1131, 1425, x => x['Q0.2'] && !x['Q0.1']) && dn >= 1425 && dn <= 1440, 'Zufahren: H1 blinkt sofort, der Motor Ab startet erst etwa 3 s später' + (dn > 0 ? ' (gemessen: ' + sec((dn - 1130) * 10) + ' s)' : ''), 'Im Schritt „Tor fährt zu“: Q0.2 mit N, Q0.1 mit D und t = 3000 ms.');
    r(allIn(c, 1541, 1590, x => !x['Q0.1'] && !x['Q0.2']) && anyIn(c, 1601, 1650, x => x['Q0.2']), 'Unten ist alles aus, und ein neuer Druck auf S1 startet den nächsten Zyklus', 'B2 (I0.3) führt von „Tor fährt zu“ zurück in die Grundstellung.');
    r(!c.some(x => x['Q0.0'] && x['Q0.1']), 'Auf und Ab laufen nie gleichzeitig', 'Die Motoren gehören in verschiedene Schritte.');
  });
  const checkSp39 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': false, 'I0.3': false, 'I0.4': true, 'I0.5': false, 'I0.6': false, 'I0.7': true }, e);
    const S = logic(prog, 'foerderband', [
      { in: m(), n: 20 }, { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 30 },                 // 0 bis 2: Start
      { in: m({ 'I0.6': true }), n: 30 }, { in: m(), n: 30 },                                     // 3, 4: Teil am Bandende, entnommen
      { in: m({ 'I0.1': false }), n: 5 }, { in: m(), n: 50 },                                     // 5, 6: Stopp
      { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 30 },                                      // 7, 8: neuer Start
      { in: m({ 'I0.7': false }), n: 20 }, { in: m(), n: 50 },                                    // 9, 10: Not-Halt, entriegelt
      { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 30 }]);                                    // 11, 12: Start nach Not-Halt
    const all = (i, f) => S[i].cycles.every(f);
    r(all(0, x => !x['Q0.2'] && !x['Q0.0']), 'Nach dem Einschalten der Steuerung ist die Betriebsleuchte aus', 'Im Schritt „Bereit“ darf H1 nicht als normale Aktion stehen, sonst leuchtet sie schon beim Einschalten.');
    r(S[1].last['Q0.0'] && S[1].last['Q0.2'] && all(2, x => x['Q0.0'] && x['Q0.2']), 'Mit S1 läuft das Band und die Betriebsleuchte geht an', 'Im Schritt „Band läuft“: Q0.0 mit N, Q0.2 speichernd setzen (S).');
    r(all(3, x => x['Q0.2']) && !S[3].last['Q0.0'] && all(4, x => x['Q0.2']) && S[4].last['Q0.0'], 'Teil am Bandende: Das Band hält an, die Leuchte bleibt an, nach dem Entnehmen läuft das Band weiter', 'Die Leuchte darf im Schritt „Teil entnehmen“ nicht ausgehen. Mit S bleibt sie gespeichert, auch wenn der Schritt wechselt.');
    r(!S[6].last['Q0.0'] && all(6, x => x['Q0.2'] && !x['Q0.0']), 'Nach dem Stopp steht das Band, die Betriebsleuchte bleibt an', 'Stopp führt zurück in „Bereit“. Die gesetzte Leuchte bleibt an, weil in „Bereit“ nichts zurücksetzt.');
    r(S[8].last['Q0.0'] && S[8].last['Q0.2'], 'Ein neuer Start lässt das Band wieder laufen', 'Aus „Bereit“ führt S1 wieder nach „Band läuft“.');
    r(!S[9].last['Q0.0'] && !S[9].last['Q0.2'] && all(10, x => !x['Q0.2'] && !x['Q0.0']), 'Not-Halt schaltet Band und Betriebsleuchte aus, auch nach dem Entriegeln bleibt die Leuchte aus', 'Im Schritt „Not-Halt“ wird Q0.2 zurückgesetzt (R).');
    r(S[12].last['Q0.0'] && S[12].last['Q0.2'], 'Nach dem Not-Halt startet S1 Band und Leuchte wieder', 'Vom Schritt „Not-Halt“ geht es nach dem Entriegeln zurück nach „Bereit“.');
  });
  const checkSp40 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.3': true, 'I0.4': false, 'I0.5': false, 'I0.6': true }, e);
    const c = flatL(logic(prog, 'tank', [{ in: m({ 'I0.2': false, 'I0.3': false }), n: 20 }, { in: m({ 'I0.0': true, 'I0.2': false, 'I0.3': false }), n: 5 }, { in: m(), n: 200 },
      { in: m({ 'I0.4': true }), n: 650 }, { in: m(), n: 100 }, { in: m({ 'I0.2': false, 'I0.3': false }), n: 100 }]));
    const offM = firstIdx(c, x => !x['Q0.2'], 226, 875), ab = firstIdx(c, x => x['Q0.3'], 225, 875);
    r(allIn(c, 0, 20, x => !x['Q0.0'] && !x['Q0.2'] && !x['Q0.3']), 'In der Grundstellung ist alles aus', 'S0 hat keine Aktion.');
    r(allIn(c, 21, 225, x => x['Q0.0'] && !x['Q0.2'] && !x['Q0.3']), 'Nach dem Start füllt Zulauf A, bis Max meldet', 'Schritt „Füllen“ mit Q0.0, Transition I0.4.');
    r(c[226]['Q0.2'] && !c[226]['Q0.0'] && offM >= 620 && offM <= 635 && allIn(c, 640, 820, x => !x['Q0.2']), 'Das Rührwerk läuft beim Mischen sofort an und nach etwa 4 s von selbst aus' + (offM > 0 ? ' (gemessen: ' + sec((offM - 225) * 10) + ' s)' : ''), 'Zeitbegrenzte Aktion: Q0.2 mit Qualifier L und t = 4000 ms. Der Schritt „Mischen“ dauert trotzdem 6 s.');
    r(ab >= 820 && ab <= 835, 'Das Ablaufventil öffnet etwa 6 s nach Max' + (ab > 0 ? ' (gemessen: ' + sec((ab - 225) * 10) + ' s)' : ''), 'Transition aus „Mischen“: 6s/X2 bzw. t/S2/6s.');
    r(ab > 0 && allIn(c, ab, 975, x => x['Q0.3']) && allIn(c, 985, 1075, x => !x['Q0.3'] && !x['Q0.0']), 'Ablassen, bis Min frei wird, danach Grundstellung ohne neuen Start', 'Aus „Ablassen“ führt NICHT I0.2 zurück nach S0.');
    r(!c.some(x => x['Q0.0'] && x['Q0.3']), 'Zulauf und Ablauf sind nie gleichzeitig offen', 'Zulauf und Ablauf gehören in verschiedene Schritte.');
  });
  const checkSp41 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': false }, e);
    const c = flatL(logic(prog, 'ampel', [{ in: m(), n: 50 }, { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 1600 }]));
    const ph = x => (x['Q0.2'] && !x['Q0.1'] && !x['Q0.0'] ? 'G' : x['Q0.1'] && !x['Q0.0'] && !x['Q0.2'] ? 'Y' : x['Q0.0'] && !x['Q0.1'] && !x['Q0.2'] ? 'R' : x['Q0.0'] && x['Q0.1'] && !x['Q0.2'] ? 'RY' : 'X');
    const red = firstIdx(c, x => ph(x) === 'R', 50), gr = firstIdx(c, x => x['Q0.4'], 50), grOff = gr > 0 ? firstIdx(c, x => !x['Q0.4'], gr) : -1, back = red > 0 ? firstIdx(c, x => ph(x) === 'G', red) : -1;
    r(allIn(c, 0, 50, x => ph(x) === 'G' && x['Q0.3'] && !x['Q0.4']), 'Ohne Anforderung: Straße grün, Fußgänger rot', 'Schritt „Straße grün“ mit Q0.2 und Q0.3.');
    r(red >= 345 && red <= 360 && allIn(c, 51, red, x => ph(x) === 'Y'), 'Nach dem Tastendruck zeigt die Straße 3 s Gelb, dann Rot', 'Transition aus „Straße gelb“: t/S1/3s.');
    r(gr > 0 && gr - red >= 95 && gr - red <= 110, 'Fußgänger-Grün kommt etwa 1 s nach Straßen-Rot' + (gr > 0 ? ' (gemessen: ' + sec((gr - red) * 10) + ' s)' : ' (gemessen: nie)'), 'Verzögerte Aktion D mit 1000 ms für Q0.4. Prüfe, ob der Schritt lange genug aktiv bleibt, damit die Verzögerung ablaufen kann.');
    r(grOff > 0 && grOff - gr >= 690 && grOff - gr <= 710, 'Fußgänger-Grün dauert etwa 7 s' + (grOff > 0 ? ' (gemessen: ' + sec((grOff - gr) * 10) + ' s)' : ''), 'Der Schritt mit Straßen-Rot dauert 8 s: 1 s Räumen plus 7 s Grün für die Fußgänger.');
    r(gr > 0 && !c.some(x => x['Q0.3'] && x['Q0.4']), 'Fußgänger-Rot und Fußgänger-Grün leuchten nie gleichzeitig', 'Fußgänger-Rot darf im Schritt „Straße rot, Fußgänger grün“ nur die erste Sekunde leuchten (zeitbegrenzte Aktion L).');
    r(!c.some(x => x['Q0.4'] && (x['Q0.2'] || x['Q0.1'])) && !c.some(x => ph(x) === 'X') && c.every(x => x['Q0.3'] || x['Q0.4']), 'Fußgänger-Grün nur bei Straßen-Rot, gültige Lichtfolgen, die Fußgängerampel ist nie dunkel', 'Q0.4 gehört nur in den Schritt mit Straßen-Rot. Zu jedem Zeitpunkt leuchtet eine der beiden Fußgängerlampen.');
    r(back > 0 && back - red >= 1095 && back - red <= 1110 && allIn(c, back, back + 50, x => ph(x) === 'G' && x['Q0.3']), 'Nach 2 s Räumzeit und 1 s Rot-Gelb ist die Straße wieder grün', 'Räumzeit t/S3/2s, Rot-Gelb t/S4/1s, dann zurück nach S0.');
  });
  const checkSp42 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': false, 'I0.3': false, 'I0.4': false, 'I0.5': false, 'I0.6': true }, e);
    /* Fall A: Behälter 2 wird erst nach Mitte leer; Fall B: Behälter 2 ist schon vorher leer */
    const A1 = logic(prog, 'tank', [{ in: m(), n: 20 }, { in: m({ 'I0.0': true }), n: 5 }, { in: m({ 'I0.2': true }), n: 100 }, { in: m({ 'I0.2': true, 'I0.3': true }), n: 150 },
      { in: m({ 'I0.2': true, 'I0.3': true, 'I0.5': true }), n: 100 }, { in: m({ 'I0.2': true, 'I0.3': true, 'I0.4': true, 'I0.5': true }), n: 560 }, { in: m({ 'I0.3': false, 'I0.5': true }), n: 50 }]);
    const B1 = logic(prog, 'tank', [{ in: m({ 'I0.5': true }), n: 20 }, { in: m({ 'I0.0': true, 'I0.5': true }), n: 5 }, { in: m({ 'I0.2': true, 'I0.5': true }), n: 100 }, { in: m({ 'I0.2': true, 'I0.3': true, 'I0.5': true }), n: 50 }]);
    const ev = (S, i, f) => S[i].cycles.every(f);
    r(ev(A1, 0, x => !x['Q0.0'] && !x['Q0.1'] && !x['Q0.5']) && A1[1].last['Q0.0'] && ev(A1, 2, x => x['Q0.0'] && !x['Q0.1']), 'Nach dem Start öffnet Zulauf A sofort, auch wenn Behälter 2 noch nicht leer ist', 'Der Start verzweigt parallel: Zweig 1 füllt mit Zulauf A, Zweig 2 wartet auf Behälter 2. Beide Schritte werden durch dieselbe Transition aktiv.');
    r(A1[1].last['Q0.5'] && ev(A1, 2, x => x['Q0.0'] && x['Q0.5']), 'Während Zulauf A füllt, meldet H1 gleichzeitig, dass Behälter 2 noch nicht leer ist', 'Beide Zweige laufen gleichzeitig: Der Schritt „Warten auf Behälter 2“ mit Q0.5 ist schon während des Füllens aktiv, nicht erst danach.');
    r(ev(A1, 3, x => !x['Q0.0'] && !x['Q0.1']), 'Bei Mitte schließt Zulauf A, Zulauf B wartet, solange Behälter 2 nicht leer ist', 'Zulauf B darf erst starten, wenn beide Zweige fertig sind: parallele Zusammenführung von „A fertig“ und „Behälter 2 bereit“.');
    r(A1[4].last['Q0.1'] && !A1[4].last['Q0.0'] && !A1[4].last['Q0.5'], 'Sobald Behälter 2 leer meldet, erlischt H1 und Zulauf B öffnet', 'Die Zusammenführung schaltet, wenn beide Quellschritte aktiv sind.');
    r(B1[3].last['Q0.1'] && !B1[3].last['Q0.0'] && !B1[2].last['Q0.1'], 'Ist Behälter 2 schon vorher leer, öffnet Zulauf B direkt bei Mitte', 'Zweig 2 ist dann schon fertig, die Zusammenführung wartet nur noch auf Zweig 1.');
    const mi = A1[5].cycles, mOn = mi.filter(x => x['Q0.2']).length, abI = firstIdx(mi, x => x['Q0.3']);
    r(!mi[1]['Q0.1'] && mi[2]['Q0.2'] && mOn >= 490 && mOn <= 510 && abI >= 495 && abI <= 510, 'Bei Max schließt Zulauf B, das Rührwerk läuft 5 s, dann wird abgelassen', 'Nach der Zusammenführung läuft die Kette wie bisher: Zulauf B bis Max, Mischen 5 s, Ablassen mit Ventil und Pumpe.');
    r(abI > 0 && mi.slice(abI).every(x => x['Q0.3'] && x['Q0.4']) && ev(A1, 6, x => !x['Q0.3'] && !x['Q0.4']) && A1[6].cycles.slice(2).every(x => !x['Q0.0'] && !x['Q0.1']), 'Ablassen mit Ventil und Pumpe, bis Min frei wird, danach Grundstellung', 'Aus „Ablassen“ führt NICHT I0.2 zurück nach S0.');
    r(![A1, B1].some(S => flatL(S).some(x => (x['Q0.0'] && x['Q0.1']) || ((x['Q0.0'] || x['Q0.1']) && x['Q0.3']))), 'Die Zuläufe sind nie gleichzeitig offen, und nie zusammen mit dem Ablauf', 'Zulauf A, Zulauf B und Ablassen gehören in verschiedene Schritte, die nicht gleichzeitig aktiv sind.');
  });
  const checkSp43 = mkCheck((prog, r) => {
    const m = e => Object.assign({ 'I0.0': false, 'I0.1': true, 'I0.2': true, 'I0.3': true, 'I0.4': false, 'I0.5': false, 'I0.6': true }, e);
    const S = logic(prog, 'tank', [
      { in: m(), n: 20 }, { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 300 }, { in: m({ 'I0.4': true }), n: 30 }, { in: m(), n: 30 },     // 0 bis 4: normaler Füllvorgang
      { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 2050 },                                                                              // 5, 6: Max kommt nicht
      { in: m(), n: 500 }, { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 30 },                                                           // 7 bis 9: Störung steht, Start gesperrt
      { in: m({ 'I0.1': false }), n: 10 }, { in: m(), n: 30 },                                                                              // 10, 11: Quittieren
      { in: m({ 'I0.0': true }), n: 5 }, { in: m(), n: 30 }]);                                                                              // 12, 13: neuer Start
    const all = (i, f) => S[i].cycles.every(f), any = (i, f) => S[i].cycles.some(f);
    r(all(0, x => !x['Q0.5'] && !x['Q0.0']) && S[1].last['Q0.0'] && all(2, x => x['Q0.0'] && !x['Q0.5']) && !S[3].last['Q0.0'] && all(4, x => !x['Q0.0'] && !x['Q0.5']), 'Normalbetrieb: Zulauf A füllt bis Max, die Störlampe bleibt aus', 'Schritt „Füllen“ mit Q0.0, Transition I0.4 zurück nach „Bereit“.');
    const c6 = S[6].cycles, st = firstIdx(c6, x => x['Q0.5']);
    r(st >= 1990 && st <= 2010 && !c6[c6.length - 1]['Q0.0'], 'Kommt Max nicht innerhalb von 20 s, schließt Zulauf A und die Störlampe geht an', 'Transition t/S1/20s in den Schritt „Störung“ mit gespeicherter Lampe (S).');
    r(all(7, x => x['Q0.5']) && !any(8, x => x['Q0.0']) && !any(9, x => x['Q0.0']), 'Ohne Quittieren bleibt die Störung stehen: Lampe an, Start gesperrt', 'Die Kette darf den Schritt „Störung“ erst verlassen, wenn quittiert wird. Prüfe, wie der Stopp-Taster (Öffner) abgefragt wird.');
    r(!S[11].last['Q0.5'] && all(11, x => !x['Q0.0']), 'Quittieren mit S2 löscht die Störlampe', 'Eine gesetzte Aktion (S) bleibt an, bis sie in einem Schritt zurückgesetzt wird (R).');
    r(S[13].last['Q0.0'] && !S[13].last['Q0.5'], 'Nach dem Quittieren lässt sich der Füllvorgang wieder starten', 'Nach „Quittiert“ führt das Loslassen des Stopp-Tasters zurück nach „Bereit“.');
  });

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
      start: tankPumpeStart, sol: tankPumpe, check: checkSp24 },

    { id: 'sp25', lab: 'sps', cat: 'Vertiefung', title: 'Rührwerk nur bei genug Füllstand', level: 1, plant: 'tank',
      text: 'Das Rührwerk M1_Ruehrwerk (Q0.2) des Tanks darf nicht trocken laufen. Es soll nur laufen, solange der Taster S1_Start (I0.0) gedrückt ist UND der Tank mindestens halb voll ist (B2_Mitte, I0.3 = 1) UND der Not-Halt nicht betätigt ist. Die Störlampe H1_Stoerung (Q0.5) leuchtet genau dann, wenn der Not-Halt betätigt ist. ' + EIN('tank', ['I0.0', 'I0.3', 'I0.6']) + AUS('tank', ['Q0.2', 'Q0.5']) + 'In der Startvorlage hängt das Rührwerk nur am Taster.' + ADR,
      hint: ['Mehrere Bedingungen, die alle gleichzeitig erfüllt sein müssen, verknüpfst du mit UND (Reihenschaltung im KOP).', 'Der Not-Halt ist ein Öffner: Im Ruhezustand liefert er 1. Für das Rührwerk brauchst du ihn deshalb als normalen Kontakt, für die Störlampe als Gegenteil davon.', 'N1: (I0.0 UND I0.3 UND I0.6) → Q0.2. N2: NICHT I0.6 → Q0.5.'],
      start: tankRuehrStart, sol: tankRuehrSol, check: checkSp25 },
    { id: 'sp26', lab: 'sps', cat: 'Vertiefung', title: 'Zweihandbedienung für die Wartungsfahrt', level: 1, plant: 'garagentor',
      text: 'Bei der Wartung soll das Tor nur fahren, wenn der Monteur beide Hände an den Tastern hat, damit keine Hand im Gefahrenbereich ist (Zweihandbedienung). K1_MotorAuf (Q0.0) läuft nur, solange S1_Auf (I0.0) UND S2_Ab (I0.1) gleichzeitig gedrückt sind. Oben schaltet der Endschalter B1_EndeOben (I0.2) den Motor ab, und der Stopp-Taster S3_Stopp (I0.5) sperrt ihn jederzeit. H1_Blinklicht (Q0.2) leuchtet, solange der Motor läuft. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.2']) + 'Der Motor Ab (Q0.1) wird hier nicht benutzt. Hinweis zur Vereinfachung: Eine echte Zweihandschaltung (EN 574 / ISO 13851) verlangt, dass beide Taster innerhalb von 0,5 s betätigt werden, ein Neustart erst nach dem Loslassen beider Taster möglich ist und ein Sicherheitsbaustein die Auswertung übernimmt. Das Lab zeigt nur die UND-Verknüpfung.' + ADR,
      hint: ['Bei einer Zweihandbedienung müssen beide Taster gedrückt sein. Welche Verknüpfung passt, UND oder ODER?', 'Zusätzlich brauchst du den Endschalter B1 als Öffner-Kontakt (Tor oben = Sperre) und den Stopp als Schließer-Kontakt, weil S3 ein Öffner ist.', 'N1: (I0.0 UND I0.1 UND NICHT I0.2 UND I0.5) → Q0.0. N2: Q0.0 → Q0.2.'],
      start: torZweihandStart, sol: torZweihandSol, check: checkSp26 },
    { id: 'sp27', lab: 'sps', cat: 'Vertiefung', title: 'Fußgänger-Grün als Impuls', level: 2, plant: 'ampel',
      text: 'Eine einfache Fußgängerampel (vereinfacht, ohne Gelbphase) arbeitet so: Im Normalzustand hat die Straße Grün (H3, Q0.2) und die Fußgänger Rot (H4, Q0.3). Ein Druck auf S1_Fussgaengertaster (I0.0) schaltet für genau 6 Sekunden um: Fußgänger-Grün H5 (Q0.4) leuchtet, die Fußgänger-Rot-Lampe ist aus, und die Straße zeigt Rot (H1_Strasse_rot, Q0.0). Die Dauer ist unabhängig davon, wie lange der Taster gedrückt bleibt. Danach ist wieder alles im Normalzustand. ' + EIN('ampel', ['I0.0']) + AUS('ampel', ['Q0.0', 'Q0.2', 'Q0.3', 'Q0.4']) + ADR,
      hint: ['Die 6 Sekunden sollen immer gleich lang sein, auch bei gehaltenem Taster. Welches der drei Zeitglieder (TON, TOF, TP) leistet das?', 'Der Ausgang des Zeitglieds ist dein Signal „Fußgänger haben Grün“. Straße Rot folgt ihm, Straße Grün und Fußgänger Rot sind sein Gegenteil.', 'N1: TP T1 (PT = 6000 ms, Eingang I0.0) → Q0.4. N2: NICHT T1.Q → Q0.3. N3: T1.Q → Q0.0. N4: NICHT T1.Q → Q0.2.'],
      start: ampelImpulsStart, sol: ampelImpulsSol, check: checkSp27 },
    { id: 'sp28', lab: 'sps', cat: 'Vertiefung', title: 'Staumelder am Bandende', level: 2, plant: 'foerderband',
      text: 'Am Bandende kann sich Ware stauen. Die Bandsteuerung (Start, Stopp, Not-Halt mit Selbsthaltung) ist schon fertig. Ergänze einen Staumelder: Ist der Sensor B5_Bandende (I0.6) länger als 5 Sekunden ununterbrochen belegt, soll das Band K1_Band (Q0.0) abschalten und H2_Stoerung (Q0.3) leuchten. Ein Werkstück, das nur kurz vorbeiläuft, darf nichts auslösen. Ist B5 wieder frei, erlischt die Meldung, das Band bleibt aber aus, bis neu gestartet wird. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.3']) + ADR,
      hint: ['Gesucht ist ein Zeitglied, das erst nach einer Wartezeit anspricht, und nur, wenn die Belegung nicht zwischendurch endet.', 'Eine Einschaltverzögerung (TON) mit B5 als Eingang liefert die Störung. Mit ihrem Ausgang sperrst du zusätzlich die Selbsthaltung des Bandes (als Öffner-Kontakt in Reihe).', 'N1: TON T1 (PT = 5000 ms, Eingang I0.6) → Q0.3. N2: ((I0.0 ODER Q0.0) UND I0.1 UND I0.7 UND NICHT T1.Q) → Q0.0.'],
      start: bandStauStart, sol: bandStauSol, check: checkSp28 },
    { id: 'sp29', lab: 'sps', cat: 'Vertiefung', title: 'Abpumpen: erst Ventil, dann Pumpe', level: 2, plant: 'tank',
      text: 'Beim Abpumpen soll sich zuerst das Ablaufventil Y3_Ablauf (Q0.3) öffnen. Die Pumpe P1_Pumpe (Q0.4) darf erst 2 Sekunden später anlaufen, damit sie nicht gegen ein geschlossenes Ventil arbeitet. S1_Start (I0.0) startet den Vorgang, aber nur, wenn B1_Min (I0.2) meldet, dass noch Flüssigkeit im Tank ist. Beim Abschalten schließen Ventil und Pumpe gleichzeitig. Abgeschaltet wird mit S2_Stopp (I0.1, Öffner), S3_NotHalt (I0.6, Öffner) oder wenn B1_Min 0 meldet. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.6']) + AUS('tank', ['Q0.3', 'Q0.4']) + 'In der Startvorlage hält der Merker M0.0 den Vorgang fest, die Pumpe läuft aber noch ohne Verzögerung.' + ADR,
      hint: ['Der Merker M0.0 bedeutet „Abpumpen läuft“. Das Ventil kann ihm direkt folgen, die Pumpe braucht eine Verzögerung.', 'Verwende eine Einschaltverzögerung (TON) mit dem Merker als Eingang. Ihr Ausgang steuert die Pumpe. Wird der Merker gelöscht, fällt das Zeitglied zurück.', 'N2: M0.0 → Q0.3. N3: TON T1 (PT = 2000 ms, Eingang M0.0) → Q0.4.'],
      start: tankVentilStart, sol: tankVentilSol, check: checkSp29 },
    { id: 'sp30', lab: 'sps', cat: 'Vertiefung', title: 'Pumpe: Min-Meldung mit Entprellzeit', level: 3, plant: 'tank',
      text: 'Beim Abpumpen schwappt die Flüssigkeit. Der Sensor B1_Min (I0.2) meldet deshalb kurz 0, obwohl noch genug im Tank ist, und die Pumpe bleibt dauernd stehen. Die Pumpe P1_Pumpe (Q0.4) soll nur dann wegen Unterschreiten von Min abschalten, wenn B1 länger als 2 Sekunden ununterbrochen 0 meldet. Kürzere Aussetzer sind zu ignorieren. Gestartet wird mit S1_Start (I0.0) nur bei B1 = 1, die Pumpe hält sich selbst. S2_Stopp (I0.1) und S3_NotHalt (I0.6), beide Öffner, schalten sofort ab, ohne Verzögerung. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.6']) + AUS('tank', ['Q0.4']) + 'Die Startvorlage schaltet bei Min sofort ab.' + ADR,
      hint: ['Die Abschaltung bei Min soll nicht sofort gelten. Du brauchst ein Zeitglied, dessen Eingang „B1 meldet 0“ ist.', 'Mit einem TON erreichst du das: Er spricht nur an, wenn sein Eingang die ganze Zeit anliegt, und fällt bei jeder kurzen Unterbrechung zurück. Sein Ausgang sperrt die Selbsthaltung der Pumpe. Stopp und Not-Halt bleiben ohne Zeitglied.', 'N1: TON T1 (PT = 2000 ms, Eingang NICHT I0.2) → M0.0. N2: (((I0.0 UND I0.2) ODER Q0.4) UND I0.1 UND I0.6 UND NICHT M0.0) → Q0.4.'],
      start: tankEntprellStart, sol: tankEntprellSol, check: checkSp30 },
    { id: 'sp31', lab: 'sps', cat: 'Vertiefung', title: 'Tor schließt automatisch nach der Wartezeit', level: 3, plant: 'garagentor',
      text: 'Das Tor soll sich selbst schließen, wenn es vergessen wurde. Steht das Tor ganz oben (B1_EndeOben, I0.2 = 1), die Lichtschranke B3 (I0.4) ist frei und S3_Stopp (I0.5, Öffner) ist nicht gedrückt, und das 8 Sekunden lang ununterbrochen, fährt K2_MotorAb (Q0.1) selbstständig bis B2_EndeUnten (I0.3). Meldet die Lichtschranke dabei ein Hindernis, bleibt das Tor sofort stehen und fährt nicht von selbst weiter. Mit S1_Auf (I0.0) fährt das Tor im Tippbetrieb wieder auf, solange der Taster gedrückt ist (nicht über B1 hinaus). H1_Blinklicht (Q0.2) leuchtet bei jeder Motorfahrt. ' + EIN('garagentor', ['I0.0', 'I0.2', 'I0.3', 'I0.4', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1', 'Q0.2']) + 'Die Startvorlage kann das Tor schon aufmachen. Fährt das Tor gegen ein Hindernis, ist es ein Crash.' + ADR,
      hint: ['Die Wartezeit läuft nur, solange das Tor oben steht. Sobald es sich nach unten bewegt, verlässt es B1. Wie hält der Motor dann seine Fahrt?', 'Das Zeitglied (TON) startet die Fahrt, danach hält sich Motor Ab selbst (Selbsthaltung). Stopp, Hindernis und Endschalter unten lösen die Selbsthaltung. Am Eingang des TON stehen B1, die Lichtschranke als Öffner und der Stopp.', 'N1: TON T1 (PT = 8000 ms, Eingang I0.2 UND NICHT I0.4 UND I0.5) → M0.0. N3: ((M0.0 ODER Q0.1) UND NICHT I0.3 UND NICHT I0.4 UND I0.5 UND NICHT Q0.0) → Q0.1. N4: Q0.0 ODER Q0.1 → Q0.2.'],
      start: torZuStart, sol: torZuSol, check: checkSp31 },
    { id: 'sp32', lab: 'sps', cat: 'Vertiefung', title: 'Fehlersuche: Die Kiste ist nie richtig voll', level: 2, plant: 'foerderband',
      text: 'Die Kistenzählung am Band funktioniert nicht richtig: Das Band bleibt stehen, bevor die vier Werkstücke in der Kiste sind, und nach einem neuen Start bleibt die Meldung „Kiste voll“ bestehen. Soll-Verhalten: Die Kiste ist voll, wenn vier Werkstücke den Sensor B5_Bandende (I0.6) erreicht haben. Dann hält K1_Band (Q0.0) an und H2_Stoerung (Q0.3) zeigt „Kiste voll“. Ein Druck auf S1_Start (I0.0) leert die Kiste und das Band läuft wieder. S2_Stopp und S3_NotHalt sind Öffner. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.3']) + 'Es sind zwei Fehler im Programm.' + ADR,
      hint: ['Prüfe zuerst, welcher Sensor den Zähler schaltet. Das Band hält zu früh: Zählt er wirklich die Werkstücke am Bandende?', 'Fehler 1: Der Zähler bekommt den falschen Sensor. Fehler 2: Dem Zähler fehlt ein Eingang, mit dem er zurückgesetzt wird (Neustart durch S1).', 'N1: CTU C1 (PV 4, Zähleingang I0.6, Reset-Eingang I0.0) → Q0.3.'],
      start: bandZaehlBug, sol: bandZaehl, check: checkSp32 },

    /* Neue Aufgaben nach dem Berufsschulstoff Steuerrelais (Lernfeld E10.1). PRUEFEN-Marker: siehe quelle/spslab/PRUEFEN.md */
    /* PRUEFEN P1: sp33 verlangt eine Pause von 1 Sekunde beim Richtungswechsel (Auslaufen des Motors, kein Schalten unter Last, wie bei Stern-Dreieck). Der Unterricht fordert nur, dass die Schütze nie gleichzeitig anziehen. Ist die Pause als zusätzliche Anforderung in Ordnung, und ist 1 s ein passender Wert? */
    { id: 'sp33', lab: 'sps', cat: 'Vertiefung', title: 'Tor mit Pause beim Richtungswechsel', level: 2, plant: 'garagentor',
      text: 'Das Tor wird im Tippbetrieb gefahren: K1_MotorAuf (Q0.0) läuft, solange S1_Auf (I0.0) gedrückt ist, K2_MotorAb (Q0.1) solange S2_Ab (I0.1) gedrückt ist. Die beiden Motorschütze dürfen nie gleichzeitig anziehen. Außerdem soll der Motor nach einer Fahrt erst auslaufen: Nach dem Ende einer Fahrt darf die Gegenrichtung erst nach 1 Sekunde Pause starten, damit nicht unter Last umgeschaltet wird. In dieselbe Richtung gibt es keine Pause. Der Endschalter B1_EndeOben (I0.2) sperrt Auf, B2_EndeUnten (I0.3) sperrt Ab. Lichtschranke und Stopp-Taster werden hier nicht benutzt. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3']) + AUS('garagentor', ['Q0.0', 'Q0.1']) + 'Die Startvorlage hat schon die Verriegelung, aber noch keine Pause.' + ADR,
      hint: ['Die Pause muss „nachwirken“: Die Wartezeit fängt an, wenn ein Motor abfällt, und dauert dann noch eine Zeit. Welches der Zeitglieder (TON, TOF, TP) hält sein Signal nach dem Abfallen des Eingangs noch eine Zeit lang?', 'Je Richtung ein Ausschaltverzögerungs-Zeitglied (TOF) mit PT = 1000 ms: Eingang ist der Motorausgang dieser Richtung. Der Ausgang des Zeitglieds sperrt als Öffner-Kontakt den Motor der Gegenrichtung, zusätzlich zur normalen Verriegelung.', 'N1: (I0.0 UND NICHT I0.2 UND NICHT Q0.1 UND NICHT T2.Q) → Q0.0. N2: (I0.1 UND NICHT I0.3 UND NICHT Q0.0 UND NICHT T1.Q) → Q0.1. N3: TOF T1 (PT = 1000 ms, Eingang Q0.0) → M0.0. N4: TOF T2 (PT = 1000 ms, Eingang Q0.1) → M0.1.'],
      start: torWendeStart, sol: torWendeSol, check: checkSp33 },
    /* PRUEFEN P2: sp34 übernimmt die Idee der Markisen-Aufgabe (Handbetrieb länger als 0,5 s fährt in die Endlage, kurzes Antippen in die Gegenrichtung stoppt, Richtungswechsel nur bei langem Druck) für das Garagentor. Ein kurzer Druck bei stehendem Tor tut hier nichts (in der Unterlage nicht festgelegt, eigene Festlegung). Passt das? */
    { id: 'sp34', lab: 'sps', cat: 'Vertiefung', title: 'Tor: Dauerfahrt erst nach langem Tastendruck', level: 3, plant: 'garagentor',
      text: 'Das Tor soll wie eine Markise bedient werden. S1_Auf (I0.0) und S2_Ab (I0.1) wirken erst, wenn sie länger als 0,5 Sekunden gedrückt bleiben: Dann fährt das Tor von selbst bis zum Endschalter (B1_EndeOben I0.2 oder B2_EndeUnten I0.3), auch nach dem Loslassen. Ein kürzerer Tastendruck bewirkt bei stehendem Tor nichts. Fährt das Tor, hält es bei einem Druck auf die Taste der Gegenrichtung sofort an. Nur wenn diese Taste länger als 0,5 s gedrückt bleibt, fährt es danach in die Gegenrichtung. S3_Stopp (I0.5, Öffner) hält das Tor jederzeit an. Auf und Ab dürfen nie gleichzeitig laufen. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1']) + 'In der Startvorlage fährt das Tor nur im Tippbetrieb. Hinweis: In echten Anlagen kommen zusätzliche Schutzeinrichtungen dazu, zum Beispiel eine Lichtschranke und eine Kraftbegrenzung, die ein Einklemmen verhindern.' + ADR,
      hint: ['Du brauchst für jede Taste ein Signal „länger als 0,5 s gedrückt“. Welches Zeitglied sagt erst nach der Wartezeit „ja“ und fällt sofort ab, wenn der Eingang wieder weg ist?', 'Je Taste eine Einschaltverzögerung (TON, PT = 500 ms). Dieses Signal startet die Fahrt, danach hält sich der Motor selbst. In die Selbsthaltung gehören: Endschalter, Stopp, der Motor der Gegenrichtung als Öffner und die Taste der Gegenrichtung als Öffner (sie stoppt sofort).', 'N1: TON T1 (PT = 500 ms, Eingang I0.0) → M0.0. N2: TON T2 (PT = 500 ms, Eingang I0.1) → M0.1. N3: ((M0.0 ODER Q0.0) UND NICHT I0.2 UND NICHT I0.1 UND I0.5 UND NICHT Q0.1) → Q0.0. N4: ((M0.1 ODER Q0.1) UND NICHT I0.3 UND NICHT I0.0 UND I0.5 UND NICHT Q0.0) → Q0.1.'],
      start: torLangStart, sol: torLangSol, check: checkSp34 },
    /* PRUEFEN P3: sp35 übernimmt aus der Stern-Dreieck-Aufgabe die Störmeldung (Blinken mit 2 Hz) und die Fehlerquittierung. Im Tank-Modell gibt es keine eigene Quittiertaste, deshalb quittiert der Stopp-Taster S2 (nur bei entriegeltem Not-Halt). Ist das für den Unterricht in Ordnung, oder soll ein anderer Taster gelten? */
    { id: 'sp35', lab: 'sps', cat: 'Vertiefung', title: 'Störmeldung blinkt bis zur Quittierung', level: 3, plant: 'tank',
      text: 'Das Rührwerk M1_Ruehrwerk (Q0.2) wird mit S1_Start (I0.0) gestartet und hält sich selbst. S2_Stopp (I0.1, Öffner) schaltet es ab. Der Not-Halt S3_NotHalt (I0.6, Öffner) löst eine Störung aus: Das Rührwerk geht sofort aus, die Störung wird gespeichert, und H1_Stoerung (Q0.5) blinkt mit 2 Hz (0,25 s an, 0,25 s aus). Die Störung bleibt gespeichert, auch wenn der Not-Halt entriegelt wird. Solange sie gespeichert ist, lässt sich das Rührwerk nicht starten. Quittiert wird mit S2_Stopp, aber nur, wenn der Not-Halt wieder entriegelt ist: Das löscht die Störung und die Lampe erlischt. Das Rührwerk läuft danach erst nach einem neuen Druck auf S1 wieder an. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.6']) + AUS('tank', ['Q0.2', 'Q0.5']) + 'In der Startvorlage leuchtet die Lampe nur, solange der Not-Halt gedrückt ist. Hinweis: In echten Anlagen wirkt der Not-Halt über einen eigenen Sicherheitskreis, nicht über das SPS-Programm.' + ADR,
      hint: ['Die Störung muss gespeichert werden, damit sie nach dem Entriegeln bleibt. Dafür eignen sich Setzen und Rücksetzen mit einem Merker. Gesetzt wird bei Not-Halt, zurückgesetzt beim Quittieren.', 'Das Blinken baust du aus zwei Einschaltverzögerungen (wie beim Blinker aus den Beispielen) mit je 250 ms. Der Merker „Störung“ gibt das Blinken frei und sperrt (als Öffner-Kontakt) das Rührwerk. Das Quittieren braucht S2 gedrückt UND Not-Halt entriegelt.', 'N1: NICHT I0.6 → Setzen M0.0. N2: (NICHT I0.1 UND I0.6) → Rücksetzen M0.0. N3: ((I0.0 ODER Q0.2) UND I0.1 UND I0.6 UND NICHT M0.0) → Q0.2. N4: TON T1 (PT = 250 ms, Eingang M0.0 UND NICHT T2.Q) → Q0.5. N5: TON T2 (PT = 250 ms, Eingang T1.Q) → M0.1.'],
      start: tankQuitStart, sol: tankQuitSol, check: checkSp35 },
    /* PRUEFEN P4: sp36 überträgt die Parkhaus-Aufgabe (Zählerbaustein mit Einschalt- und Ausschaltwert, Ampel rot bei voll) auf das Förderband: zwei Zähler bilden ein Zählfenster (drei oder vier Werkstücke) und die Obergrenze (fünf). Im Unterricht wird ein Vor-/Rückwärtszähler mit Schwellen verwendet, den das SPS-Lab nicht kennt (nur Aufwärts- und Abwärtszähler). Ist die Zählerlogik mit zwei Aufwärtszählern als Ersatz für den Unterricht tragbar? */
    { id: 'sp36', lab: 'sps', cat: 'Vertiefung', title: 'Zählfenster: Vorwarnung und Kiste voll', level: 2, plant: 'foerderband',
      text: 'Die Kistenzählung am Band bekommt eine Vorwarnung. Jedes Werkstück, das den Sensor B5_Bandende (I0.6) erreicht, wird einmal gezählt (steigende Flanke). Sind drei oder vier Werkstücke in der Kiste, soll H2_Stoerung (Q0.3) leuchten („fast voll“). Beim fünften Werkstück hält K1_Band (Q0.0) an, und H2 erlischt wieder: Die Kiste ist voll. Ein Druck auf S1_Start (I0.0) leert die Kiste und startet das Band neu. S2_Stopp (I0.1) und S3_NotHalt (I0.7) sind Öffner und halten das Band an. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.3']) + 'In der Startvorlage leuchtet H2 schon ab drei Werkstücken dauernd, und das Band hält nie. Hinweis: In echten Anlagen wirkt der Not-Halt über einen eigenen Sicherheitskreis, nicht über das SPS-Programm.' + ADR,
      hint: ['H2 soll nur in einem Bereich leuchten (mindestens drei, aber noch nicht fünf). Ein Zähler liefert nur „Wert erreicht“. Wie kommst du mit zwei Zählern zu einem Bereich?', 'Zwei Aufwärtszähler (CTU) zählen denselben Sensor: C1 mit PV = 3, C2 mit PV = 5. Beide bekommen S1 als Reset. H2 leuchtet, wenn C1 erreicht ist UND C2 noch nicht. C2 sperrt außerdem das Band.', 'N1: CTU C1 (PV 3, Zähleingang I0.6, Reset I0.0) → M0.0. N2: CTU C2 (PV 5, Zähleingang I0.6, Reset I0.0) → M0.1. N3: (M0.0 UND NICHT M0.1) → Q0.3. N4: ((I0.0 ODER Q0.0) UND I0.1 UND I0.7 UND NICHT M0.1) → Q0.0.'],
      start: bandFensterStart, sol: bandFensterSol, check: checkSp36 },
    /* PRUEFEN P5: sp37 ist eine Fehlersuche zum Thema Öffner und Schließer (Spalte NO/NC der Zuordnungsliste). Fehler 1: Der Stopp-Taster (Öffner) ist im Programm negiert und blockiert den Start. Fehler 2: Der Not-Halt (Öffner) fehlt in der Selbsthaltung. Sind das die Fehler, die im Unterricht bei der Funktionsprobe typisch auftreten? */
    { id: 'sp37', lab: 'sps', cat: 'Vertiefung', title: 'Fehlersuche: Das Ablaufventil öffnet nie', level: 2, plant: 'tank',
      text: 'Der Tank soll sich über das Ablaufventil Y3_Ablauf (Q0.3) entleeren. Soll-Verhalten: S1_Start (I0.0) öffnet das Ventil, aber nur, wenn B1_Min (I0.2 = 1) meldet, dass noch Flüssigkeit im Tank ist. Das Ventil hält sich selbst. S2_Stopp (I0.1, Öffner), S3_NotHalt (I0.6, Öffner) oder ein Füllstand unter Min schließen es sofort, und es öffnet nicht von selbst wieder. In der Anlage öffnet das Ventil aber nie, obwohl der Tank gefüllt ist. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.6']) + AUS('tank', ['Q0.3']) + 'Es sind zwei Fehler im Programm. Hinweis: In echten Anlagen wirkt der Not-Halt über einen eigenen Sicherheitskreis, nicht über das SPS-Programm.' + ADR,
      hint: ['Beginne beim Start: Welche Bedingungen müssen erfüllt sein, damit das Ventil öffnet, und welche davon ist im Ruhezustand der Anlage wirklich 1? Öffner-Taster liefern im Ruhezustand eine 1.', 'Fehler 1: Ein Öffner-Taster wird als Öffner-Kontakt abgefragt, so dass das Ventil im Ruhezustand blockiert ist. Fehler 2: Ein Sicherheitsschalter fehlt in der Reihenschaltung. Schaue nach, ob die Aufgabe jeden der genannten Abschaltgründe im Programm hat.', 'N1: (((I0.0 UND I0.2) ODER Q0.3) UND I0.1 UND I0.6 UND I0.2) → Q0.3. Alle drei Öffner-Signale stehen als normale Schließer-Kontakte in Reihe.'],
      start: tankAblaufBug, sol: tankAblaufSol, check: checkSp37 },

    /* Neue Aufgaben nach dem Berufsschulstoff GRAFCET (Lernfeld E10.1: Zeitaktionen, speichernde Aktion, parallele Kette). PRUEFEN-Marker: siehe quelle/spslab/PRUEFEN.md */
    /* PRUEFEN P6: sp38 zeigt verzögerte (D) und zeitbegrenzte (L) Aktion als Ersatz für einen eigenen Warteschritt (Vergleich mit sp19). In DIN EN 60848 werden Zeitaktionen als zugeordnete Bedingung „3s/X1“ an der Aktion geschrieben; das Lab nutzt die IEC-Qualifier D und L. Ist diese Gleichsetzung für den Unterricht in Ordnung? */
    { id: 'sp38', lab: 'sps', cat: 'Vertiefung', title: 'GRAFCET: Zeitaktionen statt Warteschritt', level: 3, plant: 'garagentor',
      text: 'Das Tor soll mit nur drei Arbeitsschritten auskommen, die Wartezeiten stecken in den Aktionen. S1_Auf (I0.0, wenn S3_Stopp I0.5 nicht gedrückt ist) startet den Schritt „Tor fährt auf“: H1_Blinklicht (Q0.2) leuchtet sofort, K1_MotorAuf (Q0.0) läuft aber erst 3 Sekunden nach Schrittbeginn an (verzögerte Aktion). Oben (B1_EndeOben I0.2) folgt „Tor offen“: H2_Beleuchtung (Q0.3) leuchtet nur die ersten 5 Sekunden (zeitbegrenzte Aktion), das Tor bleibt offen. S2_Ab (I0.1) startet „Tor fährt zu“: Blinklicht sofort, K2_MotorAb (Q0.1) erst nach 3 Sekunden. Unten (B2_EndeUnten I0.3) geht es zurück in die Grundstellung. ' + EIN('garagentor', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.5']) + AUS('garagentor', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3']) + 'In der Startvorlage stehen Schritte und Transitionen schon richtig, alle Aktionen sind aber normale Aktionen (N).' + ADR,
      hint: ['Eine Aktion kann eine Zeit haben: Die verzögerte Aktion schaltet erst nach einer Wartezeit ab Schrittbeginn ein, die zeitbegrenzte Aktion schaltet nach einer Zeit wieder aus, obwohl der Schritt aktiv bleibt.', 'Motoren: Qualifier D (verzögert) mit t = 3000 ms. Beleuchtung: Qualifier L (zeitbegrenzt) mit t = 5000 ms. Das Blinklicht bleibt N.', 'S1: N Q0.2, D Q0.0 (3000 ms). S2: L Q0.3 (5000 ms). S3: N Q0.2, D Q0.1 (3000 ms). Transitionen: T1 I0.0 UND I0.5, T2 I0.2, T3 I0.1 UND I0.5, T4 I0.3. Die Kennbuchstaben N, S, R, D, L stammen aus der Ablaufsprache nach IEC 61131-3. In GRAFCET nach DIN EN 60848 schreibt man eine Zeit als Bedingung, z. B. 3s/X1.'],
      start: () => GRA_TOR_D(true), sol: () => GRA_TOR_D(false), check: checkSp38 },
    /* PRUEFEN P7: sp39 erzwingt die speichernde Aktion über das Verhalten: Nach dem Einschalten ist die Betriebsleuchte aus, nach einem Stopp (zurück in den Anfangsschritt) bleibt sie an, erst Not-Halt setzt sie zurück. Die Mitschrift nennt außerdem die Zuweisung bei Flanke („EA22 := 1 bei Flanke von C4“), die das Lab nicht kennt. Reicht S/R als Ersatz? */
    { id: 'sp39', lab: 'sps', cat: 'Vertiefung', title: 'GRAFCET: Betriebsleuchte speichernd setzen', level: 2, plant: 'foerderband',
      text: 'Die Ablaufkette des Bandes hat vier Schritte: „Bereit“ (Anfangsschritt), „Band läuft“, „Teil entnehmen“ und „Not-Halt“. Mit S1_Start (I0.0) läuft K1_Band (Q0.0). Erreicht ein Teil B5_Bandende (I0.6), hält das Band, bis das Teil entnommen ist. S2_Stopp (I0.1, Öffner) führt zurück nach „Bereit“, S3_NotHalt (I0.7, Öffner) in den Schritt „Not-Halt“. Die Betriebsleuchte H1_Betrieb (Q0.2) soll mit dem ersten Start angehen und an bleiben, auch beim Entnehmen und nach einem Stopp. Erst der Not-Halt schaltet sie aus. Nach dem Einschalten der Steuerung ist sie aus. ' + EIN('foerderband', ['I0.0', 'I0.1', 'I0.6', 'I0.7']) + AUS('foerderband', ['Q0.0', 'Q0.2']) + 'Schritte und Transitionen stehen schon. In der Startvorlage ist H1 eine normale Aktion im Schritt „Band läuft“.' + ADR,
      hint: ['Eine normale Aktion (N) ist nur an, solange ihr Schritt aktiv ist. Hier soll die Leuchte über mehrere Schritte und sogar im Anfangsschritt an bleiben. Dafür gibt es eine Aktion, die einen Wert speichert.', 'Setze Q0.2 im Schritt „Band läuft“ speichernd (Qualifier S) und setze es im Schritt „Not-Halt“ zurück (Qualifier R). Im Anfangsschritt steht keine Aktion für Q0.2.', 'S1 „Band läuft“: N Q0.0, S Q0.2. S2 „Teil entnehmen“: keine Aktion. S3 „Not-Halt“: R Q0.2. S0 „Bereit“: keine Aktion. Die Kennbuchstaben N, S, R, D, L stammen aus der Ablaufsprache nach IEC 61131-3. In GRAFCET nach DIN EN 60848 schreibt man eine Zeit als Bedingung, z. B. 3s/X1.'],
      start: () => GRA_BAND_S(true), sol: () => GRA_BAND_S(false), check: checkSp39 },
    /* PRUEFEN P8: sp40 lässt das Rührwerk mit einer zeitbegrenzten Aktion (L, 4 s) laufen, der Schritt „Mischen“ dauert 6 s (Zeitbedingung 6s/X2). Werte eigene Festlegung. */
    { id: 'sp40', lab: 'sps', cat: 'Vertiefung', title: 'GRAFCET: Rührwerk als zeitbegrenzte Aktion', level: 2, plant: 'tank',
      text: 'Der Tank wird in drei Schritten bearbeitet. S1_Start (I0.0, nur wenn Stopp I0.1 und Not-Halt I0.6 nicht betätigt sind und der Tank nicht voll ist) startet „Füllen“ mit Y1_ZulaufA (Q0.0) bis B3_Max (I0.4). Dann folgt „Mischen“: Der Schritt dauert 6 Sekunden (Zeitbedingung 6s/X2 nach DIN EN 60848, im Lab t/S2/6s), M1_Ruehrwerk (Q0.2) soll aber nur die ersten 4 Sekunden laufen, damit sich der Schaum setzt. Danach „Ablassen“ mit Y3_Ablauf (Q0.3), bis B1_Min (I0.2) frei wird, und zurück in die Grundstellung. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.4', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.2', 'Q0.3']) + 'In der Startvorlage läuft das Rührwerk den ganzen Schritt.' + ADR,
      hint: ['Das Rührwerk soll früher aufhören, als der Schritt endet. Welche Art von Aktion schaltet nach einer festen Zeit von selbst ab, obwohl der Schritt noch aktiv ist?', 'Zeitbegrenzte Aktion: Qualifier L mit t = 4000 ms im Schritt „Mischen“. Die Transition t/S2/6s bleibt unverändert.', 'S2 „Mischen“: L Q0.2 (4000 ms). Alles andere bleibt: S1 N Q0.0, S3 N Q0.3, T1 I0.0 UND I0.1 UND I0.6 UND NICHT I0.4, T2 I0.4, T3 t/S2/6s, T4 NICHT I0.2. Die Kennbuchstaben N, S, R, D, L stammen aus der Ablaufsprache nach IEC 61131-3. In GRAFCET nach DIN EN 60848 schreibt man eine Zeit als Bedingung, z. B. 3s/X1.'],
      start: () => GRA_TANK_L(true), sol: () => GRA_TANK_L(false), check: checkSp40 },
    /* PRUEFEN P9: sp41 nimmt den Fall aus dem Unterricht auf, dass eine verzögerte Aktion nie wirksam wird, wenn der Schritt kürzer ist als die Verzögerung („4s/X314“ bei kürzerem Schritt). Zweiter, verdeckter Fehler: Fußgänger-Rot bleibt im Grün-Schritt an. Zeiten (Gelb 3 s, Räumen 1 s, Grün 7 s, Räumzeit 2 s, Rot-Gelb 1 s) sind Übungswerte, keine Ampelnorm. */
    { id: 'sp41', lab: 'sps', cat: 'Vertiefung', title: 'Fehlersuche: Fußgänger-Grün kommt nie', level: 2, plant: 'ampel',
      text: 'Bedarfsampel als GRAFCET. Soll-Verhalten: Die Straße hat Grün, die Fußgänger Rot. Nach einem Druck auf S1_Fussgaengertaster (I0.0) zeigt die Straße 3 s Gelb, dann Rot. Im Schritt „Straße rot, Fußgänger grün“ leuchtet Fußgänger-Rot (Q0.3) noch 1 s, dann Fußgänger-Grün (Q0.4) für 7 s. Danach 2 s Räumzeit (alles Rot) und 1 s Rot-Gelb für die Straße, dann wieder Straßen-Grün. Zu jeder Zeit leuchtet genau eine Fußgängerlampe. In der Anlage zeigt die Fußgängerampel aber nie Grün. ' + EIN('ampel', ['I0.0']) + AUS('ampel', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4']) + 'Im Programm stecken zwei Fehler.' + ADR,
      hint: ['Eine verzögerte Aktion (D) wird erst wirksam, wenn ihr Schritt länger aktiv ist als die Verzögerung. Vergleiche die Verzögerung von Q0.4 mit der Zeitbedingung, die den Schritt verlässt.', 'Fehler 1 steckt in einer Transition: Der Schritt mit Straßen-Rot muss 8 s dauern (1 s Räumen plus 7 s Grün). Ist er behoben, siehst du den zweiten Fehler: Fußgänger-Rot darf in diesem Schritt nur die erste Sekunde leuchten.', 'T3: t/S2/8s statt t/S2/1s. S2: N Q0.0, L Q0.3 (1000 ms), D Q0.4 (1000 ms).'],
      start: () => GRA_FUSS(true), sol: () => GRA_FUSS(false), check: checkSp41 },
    /* PRUEFEN P10: sp42 zeigt Simultanverzweigung und Zusammenführung (Doppellinie, gemeinsame Transition erst, wenn alle Zweige am Ende sind). Der zweite Zweig wartet auf den Sensor B4 „Behälter 2 leer“ und meldet das Warten mit der Störlampe H1 (eigene Festlegung, damit parallel und nacheinander unterscheidbar sind). Passt die Störlampe als Wartehinweis, oder soll eine andere Meldung gelten? */
    { id: 'sp42', lab: 'sps', cat: 'Vertiefung', title: 'GRAFCET: Füllen und Warten parallel', level: 3, plant: 'tank',
      text: 'Nach dem Start (S1_Start I0.0, Stopp I0.1 und Not-Halt I0.6 nicht betätigt) sollen zwei Dinge gleichzeitig ablaufen: Zweig 1 füllt mit Y1_ZulaufA (Q0.0) bis B2_Mitte (I0.3). Zweig 2 wartet, bis B4_Beh2Leer (I0.5) meldet, dass Behälter 2 leer ist. Solange er wartet, leuchtet H1_Stoerung (Q0.5) als Hinweis „Behälter 2 noch nicht leer“. Erst wenn beide Zweige fertig sind, öffnet Y2_ZulaufB (Q0.1) bis B3_Max (I0.4). Dann läuft M1_Ruehrwerk (Q0.2) 5 Sekunden, danach werden Y3_Ablauf (Q0.3) und P1_Pumpe (Q0.4) eingeschaltet, bis B1_Min (I0.2) frei wird, und die Kette ist wieder in der Grundstellung. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.4', 'I0.5', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) + 'Alle Schritte sind angelegt. In der Startvorlage läuft die Kette aber gerade durch und Zulauf B wartet nicht auf Behälter 2: Die Schritte S2 bis S4 sind noch nicht eingebunden.' + ADR,
      hint: ['Zwei Abläufe, die gleichzeitig starten und aufeinander warten, sind eine parallele Verzweigung mit anschließender Zusammenführung (im GRAFCET die Doppellinie). Eine Transition kann mehrere Zielschritte und mehrere Quellschritte haben.', 'T1 aktiviert S1 und S3 gleichzeitig. S1 geht bei I0.3 nach S2 („A fertig“), S3 bei I0.5 nach S4 („Behälter 2 bereit“). Die Zusammenführung von S2 und S4 nach S5 schaltet mit der Bedingung true, sobald beide aktiv sind.', 'T1: S0 → S1 und S3 (I0.0 UND I0.1 UND I0.6). T2: S1 → S2 (I0.3). T3: S3 → S4 (I0.5). T4: S2 und S4 → S5 (true). T5: S5 → S6 (I0.4). T6: S6 → S7 (t/S6/5s). T7: S7 → S0 (NICHT I0.2).'],
      start: () => GRA_TANK_PAR(true), sol: () => GRA_TANK_PAR(false), check: checkSp42 },
    /* PRUEFEN P11: sp43 ist eine Fehlersuche zur speichernden Aktion mit verdecktem zweitem Fehler (Quittier-Taster als Öffner falsch abgefragt). Die Füllzeit-Überwachung mit 20 s ist eine eigene Festlegung. */
    { id: 'sp43', lab: 'sps', cat: 'Vertiefung', title: 'Fehlersuche: Die Störlampe erlischt nie', level: 3, plant: 'tank',
      text: 'Der Füllvorgang wird überwacht. Soll-Verhalten: S1_Start (I0.0, Not-Halt I0.6 nicht betätigt, Tank nicht voll) öffnet Y1_ZulaufA (Q0.0), bis B3_Max (I0.4) meldet. Meldet Max nicht innerhalb von 20 Sekunden, schließt der Zulauf und H1_Stoerung (Q0.5) leuchtet gespeichert. Solange die Störung steht, lässt sich nicht neu starten. Quittiert wird mit S2_Stopp (I0.1, Öffner): Die Lampe erlischt, nach dem Loslassen ist die Anlage wieder bereit. In der Anlage erlischt die Störlampe aber nie. ' + EIN('tank', ['I0.0', 'I0.1', 'I0.4', 'I0.6']) + AUS('tank', ['Q0.0', 'Q0.5']) + 'Im Programm stecken zwei Fehler.' + ADR,
      hint: ['Die Lampe wird im Schritt „Störung“ mit S gesetzt. Eine gesetzte Aktion bleibt an, bis ein anderer Schritt sie zurücksetzt. Gibt es diesen Schritt?', 'Fehler 1: Im Schritt „Quittiert“ fehlt das Rücksetzen R Q0.5. Ist er behoben, siehst du den zweiten Fehler: Die Störung verschwindet sofort, ohne dass du quittierst. Prüfe, wie der Öffner S2 in der Transition abgefragt wird.', 'S3 „Quittiert“: R Q0.5. T4: NICHT I0.1 (Taster gedrückt liefert 0). T5: I0.1. Alles andere bleibt.'],
      start: () => GRA_TANK_STOER(true), sol: () => GRA_TANK_STOER(false), check: checkSp43 }
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
