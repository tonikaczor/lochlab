/* verbunddata-foerder.js - Verbundprojekt 5: Förder- und Sortieranlage (Projektdefinition, Paket P5)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.5. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Benötigt zur Laufzeit der Prüfungen (alle rein rechnerisch, ohne Browser): dscore.js + dslib-semi.js + dslib-ic.js, pcbcore.js,
 * sencore.js + senrig-opt.js, antcore.js (+ antrig-*.js), spscore.js + spsplant-foerderband.js (mit opts.beltMmS), verbundrun.js (Python).
 * Die Hilfen für Netzlisten (Union-Find, Schützlogik, Platinen-Gleichwertigkeit) stehen bewusst privat in dieser Datei.
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   ant.setup     { rig:'drehstrom', preset:'m055', ctl:{source:'netz', connection:'dreieck'}, gear:{type:'stirnrad', stages, z1..z4}, state:{rpm,iLine,temp}, derived:{iN, n, vBelt, ratio} }
 *   sch.circuit   (sim)  { lab:'sim', name, netlist, meas, snap }   Teile: NETZ3, LSS (3x), SCHUETZ (Spule A1/A2), MOTOR3, PB, PBC (Stopp, Not-Halt), LAMP
 *   sen.chain     { rig:'licht', preset:'', ctl:{sensor:'induktiv', material, dist, rLoad, fdelay}, state:{}, derived:{fMaxHz, tOnMs, iSupplyMa, tPulseMs} }
 *   ds.pick       { items:[{role:'regler', ds:'tf-7805', part, ref}], calc:{iTotMa, tjOhne}, vals:{rV, pRvW, finding:'heiss'|'ok'} }
 *   sch.circuit   (sch)  { lab:'sch', name, netlist, meas:{U_hi, tr, tau}, snap }    Netzliste: BAT, SPST, REG, R, ZD, C (Refs siehe buildSch)
 *   pcb.board     { board, report }
 *   mess.protocol { rows:[{id:'U_5V'|'U_hi'|'U_lo'|'tFilterMs', label, unit, soll, ist, tol, instrument, tp?}], values:{u5v, tFilterMs}, findings:[text] }
 *   sps.program   { prog, plant:'foerderband', opts:{beltMmS}, lang, notes? }   (das Anlagenprotokoll sps.log wird aus dem Programm neu gerechnet: station.dataFor)
 *   pi.script     { lang:'python', src, out:[Zeilen] }      Daten als `daten = [...]` im Kopf (Zeilen: t, band, stoerung, hell, metall_aus, hell_aus, metall_durch, verloren)
 *   pr.quiz       { answers:{q1..q6}, n:6 }
 * Werte mit (A) sind Annahmen (Lehrwerte), siehe SPEC Abschnitt 8 und 13.3. */
(function (root) {
  'use strict';

  const PID = 'foerder';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = x => (Array.isArray(x) ? x : []);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const rd = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const sameVal = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-6 : rel) * Math.max(Math.abs(a), Math.abs(b), 1e-12);
  const lc = s => String(s == null ? '' : s).toLowerCase();

  /* ---------- Hash, Zufall (gleich zum Kern: FNV-1a 32 Bit, mulberry32) ---------- */
  function hash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  /* ---------- Kerne (erst zur Laufzeit gelesen) ---------- */
  const DS = () => root.DS_CORE, LIB = () => root.DS_LIB, PCB = () => root.PCB_CORE, SEN = () => root.SEN_CORE, ANT = () => root.ANT_CORE, SPS = () => root.SPS_CORE, PLANTS = () => root.SPS_PLANTS;
  function runPy(src, data, opts) {             // Python-Läufer (verbundrun.js): Browser über window.VerbundRun, Node über require
    let R = root.VerbundRun || (root.Verbund && root.Verbund.runPython ? { runPython: root.Verbund.runPython } : null);
    if (!R && typeof require === 'function') { try { R = require('./verbundrun.js'); } catch (e) { R = null; } }
    if (!R || typeof R.runPython !== 'function') return { ok: false, error: 'Der Python-Läufer (verbundrun.js) ist nicht geladen.', lines: [], kv: {} };
    return R.runPython(src, data, opts);
  }
  function numOf(v) {                         // '4k7', '24V', '330', 4700 -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const d = DS();
    if (d && d.parseWithUnit) { const r = d.parseWithUnit(s); if (r && fin(r.value)) return r.value; }
    const m = /^(\d+(?:[.,]\d+)?)\s*([kKMmuµn]?)/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) * ({ k: 1e3, K: 1e3, M: 1e6, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9 }[m[2]] || 1) : NaN;
  }
  const E12 = (root.ENORM || (function () { try { return typeof require === 'function' ? require('./enorm.js') : null; } catch (e) { return null; } })() || {}).E12;   // eine Quelle: enorm.js
  function isE(v, series) {                   // Wert in E12/E24?
    const d = DS(); if (!d || !fin(v) || v <= 0) return false;
    const n = d.eSeries(series || 'E12', v, 'nearest');
    return fin(n) && Math.abs(n - v) <= 1e-6 * v;
  }
  const eDec = decs => { const l = []; decs.forEach(dec => E12.forEach(m => l.push(Math.round(m * dec * 1000) / 1000))); return l; };
  const rList = eDec([100, 1000, 10000]).concat([100000]);            // 100 Ω bis 100 kΩ (E12)
  const rvList = eDec([1, 10, 100]).concat([1000]);                   // 1 Ω bis 1 kΩ (Vorwiderstand)
  const cList = [1e-8, 1.5e-8, 2.2e-8, 3.3e-8, 4.7e-8, 6.8e-8, 1e-7, 1.5e-7, 2.2e-7, 3.3e-7, 4.7e-7, 6.8e-7, 1e-6, 1.5e-6, 2.2e-6]; // E6, 10 nF bis 2,2 µF

  /* ====================================================================== Lastenheft */
  const WERKSTOFF = { stahl: 'Stahl', alu: 'Aluminium', kupfer: 'Kupfer' };
  const IO = [
    { key: 'I0.0', sym: 'S1_Start', text: 'Taster Start (Schließer)' },
    { key: 'I0.1', sym: 'S2_Stopp', text: 'Taster Stopp (Öffner, Ruhe = 1)' },
    { key: 'I0.3', sym: 'B2_Metall', text: 'Induktiver Sensor (1 = Metallteil davor)' },
    { key: 'I0.5', sym: 'B4_Zyl_vorn', text: 'Ausschieber ausgefahren (vordere Endlage)' },
    { key: 'I0.7', sym: 'S3_NotHalt', text: 'Not-Halt (Öffner, Ruhe = 1)' },
    { key: 'Q0.0', sym: 'K1_Band', text: 'Schütz Bandmotor' },
    { key: 'Q0.1', sym: 'Y1_Ausschieber', text: 'Zylinder ausfahren (Ausschieber)' },
    { key: 'Q0.2', sym: 'H1_Betrieb', text: 'Lampe Betrieb' },
    { key: 'Q0.3', sym: 'H2_Stoerung', text: 'Lampe Störung' }
  ];
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x3c6ef372);
    const vSoll = level === 1 ? pick(r, [0.25, 0.30, 0.40]) : level === 2 ? rd(0.20 + 0.05 * Math.floor(r() * 7), 2) : rd(0.20 + 0.01 * Math.floor(r() * 31), 2);
    const werkstoff = level === 1 ? 'stahl' : level === 2 ? pick(r, ['stahl', 'alu']) : pick(r, ['stahl', 'alu', 'kupfer']);
    const iLogikMa = level === 1 ? pick(r, [90, 110, 130]) : level === 2 ? pick(r, [20, 50, 70, 90, 110]) : pick(r, [20, 50, 70, 90, 110, 130]);   // (A)
    const fault = level === 3 ? pick(r, ['cWrong', 'divSwap']) : null;
    const pauseStart = 40 + Math.floor(r() * 31), pauseDur = 6 + Math.floor(r() * 9);                                                                   // Stillstand im Protokolllauf (s)
    const p = {
      dRolle: 0.10, vSoll: vSoll, lWerk: 40, lLuecke: 60, fensterMm: 44, sWeg: 142, tZylMs: 100, mBand: 3, pMotorW: 550, uNetz: 400, uSteuer: 24,
      nSens: 2, iSensMa: 10, uTol: 0.10, tAmb: 40, iLogikMa: iLogikMa, cycleMs: 10, werkstoff: werkstoff, tFilterMinMs: 2, tTaktS: 4, metalRatio: 0.4,
      boardW: 100, boardH: 60, layers: 2, clearance: 0.3, uRef: 5, fault: fault, pauseStart: pauseStart, pauseDur: pauseDur
    };
    p.uMax = rd(p.uSteuer * (1 + p.uTol), 2); p.uMin = rd(p.uSteuer * (1 - p.uTol), 2);
    p.tPulsMs = rd((p.lWerk + p.fensterMm) / vSoll, 1);
    p.durchsatzSoll = rd(0.8 * 60 / p.tTaktS, 2);                    // Teile je Minute (A: 80 % des mittleren Zufuhrtakts)
    const text = [
      'Projekt Förder- und Sortieranlage, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Band: Soll-Geschwindigkeit ' + fm(vSoll, 2) + ' m/s, Antriebsrolle ' + fm(p.dRolle * 1000, 0) + ' mm (A), Lastmoment an der Rolle ' + p.mBand + ' Nm (A). Motor: Drehstrom ' + fm(p.pMotorW / 1000, 2) + ' kW, 4-polig, ' + p.uNetz + ' V Netz, Getriebe aus Stirnradpaaren (8 bis 80 Zähne).',
      'Werkstücke: Metallhülsen aus ' + WERKSTOFF[werkstoff] + ' und Kunststoffkappen, ' + p.lWerk + ' mm lang, Lücke mindestens ' + p.lLuecke + ' mm (A). Metallteile (Anteil etwa ' + Math.round(p.metalRatio * 100) + ' %) werden ausgeschoben.',
      'Sensorik: ' + p.nSens + ' Sensoren, Eigenstrom je ' + p.iSensMa + ' mA (A), 24-V-Steuerung (' + fm(p.uMin, 1) + ' bis ' + fm(p.uMax, 1) + ' V, Toleranz ' + Math.round(p.uTol * 100) + ' % (A)), Erfassungsfenster ' + p.fensterMm + ' mm (A), SPS-Zyklus ' + p.cycleMs + ' ms.',
      'Weg ab Ansprechen des Sensors bis zur Mitte des Ausschiebers: s = ' + p.sWeg + ' mm (A). Der Zylinder braucht ' + p.tZylMs + ' ms, bis er am Werkstück anliegt (A).',
      'Versorgung der Interface-Platine: 5 V aus 24 V, Logikstrom ' + p.iLogikMa + ' mA (A), Umgebung ' + p.tAmb + ' °C (A). Platine höchstens ' + p.boardW + ' x ' + p.boardH + ' mm, ' + p.layers + ' Lagen, Abstand mindestens ' + fm(p.clearance, 1) + ' mm (A).',
      'Zufuhr etwa alle ' + p.tTaktS + ' s ein Teil (A): Soll-Durchsatz mindestens ' + fm(p.durchsatzSoll, 0) + ' Teile je Minute, Ausschuss (falsch sortiert oder verloren) höchstens 2 %.'
    ];
    if (fault) text.push('Hinweis Inbetriebnahme: Der Messaufbau der Interface-Platine enthält einen eingebauten Fehler. Finde ihn.');
    return { params: p, text: text, io: IO.map(clone) };
  }

  /* ====================================================================== Netzlisten-Hilfen (privat) */
  const SRC_KINDS = { BAT: 1, AC: 1, SPST: 1, PB: 1, PBC: 1, SPDT: 1, GND: 1 };
  const isSupply = n => /^(GND|VSS|0V|MASSE)$/i.test(String(n));
  function nlIdx(nl) {
    const ix = { ok: false, net: {}, nets: {}, parts: {}, dups: [] };
    if (!isObj(nl)) return ix;
    arr(nl.parts).forEach(p => { if (isObj(p) && typeof p.ref === 'string') ix.parts[p.ref] = p; });
    arr(nl.nets).forEach(n => {
      if (!isObj(n) || typeof n.name !== 'string') return;
      if (!ix.nets[n.name]) ix.nets[n.name] = [];
      arr(n.pins).forEach(pin => { pin = String(pin); if (ix.net[pin] !== undefined && ix.net[pin] !== n.name) ix.dups.push(pin); ix.net[pin] = n.name; ix.nets[n.name].push(pin); });
    });
    Object.keys(ix.parts).forEach(ref => {
      const pp = ix.parts[ref].pins;
      if (isObj(pp)) Object.keys(pp).forEach(k => { const a = ref + '.' + k; if (ix.net[a] === undefined && typeof pp[k] === 'string' && pp[k]) { ix.net[a] = pp[k]; (ix.nets[pp[k]] = ix.nets[pp[k]] || []).push(a); } });
    });
    ix.ok = Object.keys(ix.parts).length > 0;
    return ix;
  }
  const PINS = { R: ['1', '2'], C: ['1', '2'], CE: ['1', '2'], LAMP: ['1', '2'], LSS: ['1', '2'], FUSE: ['1', '2'], PB: ['1', '2'], PBC: ['1', '2'], SPST: ['1', '2'], ZD: ['A', 'K'], D: ['A', 'K'], BAT: ['+', '-'], REG: ['IN', 'GND', 'OUT'],
    NETZ3: ['L1', 'L2', 'L3', 'N', 'PE'], MOTOR3: ['U', 'V', 'W', 'PE'], SCHUETZ: ['A1', 'A2', 'K1a', 'K1b', 'K2a', 'K2b', 'K3a', 'K3b', 'K4a', 'K4b'] };
  const pinKeys = p => (isObj(p.pins) && Object.keys(p.pins).length ? Object.keys(p.pins) : (PINS[p.kind] || []).slice());
  const netOf = (ix, ref, pin) => ix.net[ref + '.' + pin];
  const ofKind = (ix, kinds) => Object.keys(ix.parts).map(k => ix.parts[k]).filter(p => kinds.split(',').indexOf(p.kind) >= 0);
  function batPins(p) { const k = pinKeys(p); const plus = k.find(x => /^\+|^p$|^1$/i.test(x)) || k[0] || '+'; const minus = k.find(x => x !== plus) || '-'; return { plus: plus, minus: minus }; }
  function supplyOf(ix, volt, tol) {          // BAT mit passender Spannung -> { ref, plusNet, minusNet }
    const bats = ofKind(ix, 'BAT').filter(b => Math.abs(numOf(b.value) - volt) <= (tol == null ? 0.5 : tol));
    if (!bats.length) return null;
    const b = bats[0], bp = batPins(b);
    return { ref: b.ref, plusNet: netOf(ix, b.ref, bp.plus), minusNet: netOf(ix, b.ref, bp.minus) };
  }
  function fmtR(v) { v = rd(v, 6); return v >= 1e6 ? String(rd(v / 1e6, 3)) + 'M' : v >= 1000 ? String(rd(v / 1000, 3)) + 'k' : String(rd(v, 3)); }
  function fmtC(v) { return v >= 1e-6 ? String(rd(v * 1e6, 3)) + 'u' : v >= 1e-9 ? String(rd(v * 1e9, 3)) + 'n' : String(rd(v * 1e12, 3)) + 'p'; }
  const fmtRde = v => fmtR(v).replace('.', ',');
  function nlBuilder(name) {
    const parts = [], nets = {}, order = [];
    const b = {
      add(ref, kind, value, pins, props) {
        const o = { ref: ref, kind: kind, value: value == null ? '' : String(value), pins: Object.assign({}, pins) };
        if (props) o.props = props;
        parts.push(o);
        Object.keys(pins).forEach(k => { const n = pins[k]; if (!nets[n]) { nets[n] = []; order.push(n); } nets[n].push(ref + '.' + k); });
        return b;
      },
      done() { return { v: 1, name: name, parts: parts, nets: order.map(n => ({ name: n, cls: isSupply(n) ? 'power' : 'signal', pins: nets[n].slice() })) }; }
    };
    return b;
  }
  const dropPin = (nl, addr) => {
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    nl.parts.forEach(p => { if (p.ref === ref && p.pins) delete p.pins[pn]; });
    return nl;
  };
  const setPart = (nl, ref, fn) => { nl.parts.forEach(p => { if (p.ref === ref) fn(p); }); return nl; };
  const removePart = (nl, ref) => { nl.parts = nl.parts.filter(p => p.ref !== ref); nl.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf(ref + '.') !== 0); }); return nl; };
  const movePin = (nl, addr, toNet) => {
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    let t = nl.nets.find(n => n.name === toNet); if (!t) { t = { name: toNet, cls: 'signal', pins: [] }; nl.nets.push(t); }
    t.pins.push(addr);
    nl.parts.forEach(p => { if (p.ref === ref && p.pins) p.pins[pn] = toNet; });
    return nl;
  };

  /* ====================================================================== Datenblatt-Hilfen */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {                // Zahl in SI (V, A, W, Ohm) aus Zeile
    const f = field == null ? 'max' : field;
    if (!row || !fin(row[f])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[f], row.unit) : row[f];
    return fin(x) ? x : NaN;
  }
  const refOf = ds => (ds ? String(ds.ref || ds.part || ds.id) : '');
  const valueIs = (value, ds) => { const a = lc(value).replace(/[\s-]/g, ''), b = lc(refOf(ds)).replace(/[\s-]/g, ''); return !!b && (a === b || a.indexOf(b) >= 0); };

  /* ====================================================================== Gemeinsame Infrastruktur der Stationen */
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const LEVEL = ctx => (ctx && (ctx.level === 1 || ctx.level === 3) ? ctx.level : 2);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  function slotOf(ctx, slot) {
    let d = null;
    if (ctx) {
      try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; }
      if (d == null && isObj(ctx.slots)) d = ctx.slots[slot];
    }
    return d == null ? null : unwrap(d);
  }
  /* Eingang: vorhandene Daten, sonst die Musterlösung der erzeugenden Station (nur für Hub-/Testläufe ohne eigene Daten) */
  function need(ctx, slot) {
    const d = slotOf(ctx, slot);
    if (d != null) return d;
    if (!ctx) return null;
    if (!ctx._sol) { try { Object.defineProperty(ctx, '_sol', { value: {}, enumerable: false, writable: true }); } catch (e) { return null; } }
    if (ctx._sol[slot] === undefined) {
      const st = STATIONS.find(s => s.out === slot);
      ctx._sol[slot] = null;
      if (st) { try { ctx._sol[slot] = st.solution(ctx); } catch (e) { ctx._sol[slot] = null; } }
    }
    return ctx._sol[slot];
  }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  function safe(fn, label) {
    return function (data, ctx) {
      try { return { lines: fn(data, ctx || {}) }; }
      catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich (' + (e && e.message ? e.message : e) + ')', 100)] }; }
    };
  }

  /* ====================================================================== vf1: Bandantrieb (Antriebs-Lab) */
  const GEAR_MIN = 8, GEAR_MAX = 80;
  function gearOk(g) {
    if (!isObj(g)) return { ok: false, why: 'keine Getriebedaten' };
    const st = +g.stages === 1 ? 1 : 2, zs = st === 1 ? ['z1', 'z2'] : ['z1', 'z2', 'z3', 'z4'];
    const bad = zs.find(k => !(Number.isInteger(+g[k]) && +g[k] >= GEAR_MIN && +g[k] <= GEAR_MAX));
    if (bad) return { ok: false, why: 'Zähnezahl ' + bad + ' muss eine ganze Zahl von ' + GEAR_MIN + ' bis ' + GEAR_MAX + ' sein' };
    if (g.type && lc(g.type) !== 'stirnrad') return { ok: false, why: 'nur Stirnradgetriebe vorgesehen' };
    return { ok: true, stages: st };
  }
  const antCache = new Map();
  function antMotor(pre, load, conn) {         // Motor am Netz mit Last: Beharrungswerte und Erwärmung im Dauerlauf (Zeitraffer 30, A)
    const A = ANT(), key = JSON.stringify([pre.id, rd(load, 5), conn]);
    if (antCache.has(key)) return antCache.get(key);
    const m = A.induction(Object.assign({}, pre.params, { thermFactor: 30, connection: conn }));
    let st = null;
    for (let t = 0; t < 3000; t += 5) st = m.step(5, { source: 'netz', load: load, connection: conn });
    const o = { rpm: st.rpm, iLine: st.iLine, slipPct: st.slipPct, torque: st.torque, cosphi: st.cosphi, faults: st.faults };
    let tmax = st.temp;
    for (let t = 0; t < 60000; t += 100) { st = m.step(100, { source: 'netz', load: load, connection: conn }); tmax = Math.max(tmax, st.temp); }
    o.temp = tmax; o.MN = m.derived.MN; o.iN = m.derived.iN || pre.params.iN; o.nSync = st.nSync;
    if (antCache.size > 300) antCache.clear();
    antCache.set(key, o);
    return o;
  }
  function antDerive(ant, ctx) {
    const P = P_(ctx), A = ANT(), o = { ok: false, errs: [] };
    if (!isObj(ant) || !A) { o.errs.push('keine Antriebsdaten'); return o; }
    const ctl = isObj(ant.ctl) ? ant.ctl : {}, gear = isObj(ant.gear) ? ant.gear : {};
    const pre = A.acPresets.find(p => p.id === (ant.preset || 'm055'));
    if (!pre) { o.errs.push('Motor „' + ant.preset + '“ unbekannt'); return o; }
    const go = gearOk(gear); if (!go.ok) o.errs.push(go.why);
    if (o.errs.length) return o;
    const conn = lc(ctl.connection) === 'stern' ? 'stern' : 'dreieck';
    const gb = A.gearbox({ type: 'stirnrad', stages: go.stages, z1: +gear.z1, z2: +gear.z2, z3: +gear.z3, z4: +gear.z4 }), info = gb.info();
    const ap = gb.apply({ nIn: 1450, mIn: 1, mLoad: P.mBand });
    const mMotor = fin(ap.mInRequired) ? ap.mInRequired : 0;
    const mo = antMotor(pre, mMotor, conn);
    const nRoll = mo.rpm / info.ratio, v = Math.PI * P.dRolle * nRoll / 60;
    return Object.assign(o, { ok: true, errs: [], preset: pre, conn: conn, source: lc(ctl.source) || 'netz', ratio: info.ratio, eta: info.eta, mMotor: mMotor, rpm: mo.rpm, iLine: mo.iLine, slipPct: mo.slipPct, temp: mo.temp,
      MN: mo.MN, iN: mo.iN, nSync: mo.nSync, nRoll: nRoll, vMs: v, outLimit: gb.params && gb.params.mLimit });
  }
  function checkAnt(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = antDerive(data, ctx), ok = d.ok;
    const dev = ok ? Math.abs(d.vMs - P.vSoll) / P.vSoll : NaN;
    lines.push(L(ok && dev <= 0.05 * tol, 'Bandgeschwindigkeit v = π · d · n / (60 · i): ' + (ok ? fm(d.vMs, 3) + ' m/s (i = ' + fm(d.ratio, 1) + ', Motor ' + fm(d.rpm, 0) + ' 1/min)' : 'nicht berechenbar (' + (d.errs[0] || '?') + ')') + ', verlangt ' + fm(P.vSoll, 2) + ' m/s (±' + fm(5 * tol, 1) + ' %)', 30));
    lines.push(L(ok && d.mMotor <= d.MN && d.iLine <= d.iN * (1 + 1e-9) && d.temp <= 130 && P.mBand <= d.outLimit, 'Motor im Nennbereich: Last ' + (ok ? fm(d.mMotor, 2) : '?') + ' Nm (Nennmoment ' + (ok ? fm(d.MN, 2) : '?') + ' Nm), Strom ' + (ok ? fm(d.iLine, 2) : '?') + ' A (Nennstrom ' + (ok ? fm(d.iN, 2) : '?') + ' A), Wicklung im Dauerlauf höchstens ' + (ok ? fm(d.temp, 0) : '?') + ' °C (Grenze 130 °C)', 25));
    lines.push(L(ok && d.conn === 'dreieck' && d.source === 'netz' && d.preset.id === 'm055', 'Schaltung: ' + (ok ? 'Motor ' + fm(d.preset.plate.P / 1000, 2) + ' kW direkt am ' + P.uNetz + '-V-Netz in ' + (d.conn === 'dreieck' ? 'Dreieck (Typenschild 400/690 V)' : 'Stern, dann fehlt Moment') : 'keine Antriebsdaten') + (ok && d.preset.id !== 'm055' ? ' – verlangt ist der 0,55-kW-Motor' : ''), 5));
    const go = gearOk(data && data.gear);
    lines.push(L(ok && go.ok && d.ratio >= 5 && d.ratio <= 150, 'Getriebe aus ganzen Zähnezahlen (' + GEAR_MIN + ' bis ' + GEAR_MAX + '): i = ' + (ok ? fm(d.ratio, 1) : '?') + (go.ok ? ' (Verzahnungswirkungsgrad ' + (ok ? fm(d.eta * 100, 1) : '?') + ' % ist in der Last berücksichtigt)' : ' – ' + go.why), 15));
    lines.push(L(ok && d.slipPct > 0 && d.slipPct <= 6.7 && d.rpm < d.nSync && d.rpm > 0.9 * d.nSync, 'Schlupf und Drehzahl plausibel: ' + (ok ? fm(d.rpm, 0) + ' 1/min bei ' + fm(d.nSync, 0) + ' 1/min Synchrondrehzahl, Schlupf ' + fm(d.slipPct, 1) + ' % (Nennschlupf 6,7 %)' : 'nicht berechenbar'), 10));
    const sv = keys => { for (let i = 0; i < keys.length; i++) { const k = keys[i].split('.'), o = isObj(data) && isObj(data[k[0]]) ? data[k[0]] : null; if (o && fin(+o[k[1]]) && o[k[1]] !== null && o[k[1]] !== '') return +o[k[1]]; } return NaN; };
    const vi = sv(['derived.iN', 'state.iN', 'state.ratedCurrent']), vn = sv(['derived.n', 'derived.rpm', 'state.rpm']), vb = sv(['derived.vBelt', 'derived.vMs']);
    const slotOk = ok && sameVal(vi, d.iN, 0.02) && sameVal(vn, d.rpm, 0.02) && sameVal(vb, d.vMs, 0.02);
    lines.push(L(slotOk, 'Kennwerte im Slot: I_N ' + (fin(vi) ? fm(vi, 2) : 'fehlt') + ' A, n ' + (fin(vn) ? fm(vn, 0) : 'fehlt') + ' 1/min, v_Band ' + (fin(vb) ? fm(vb, 3) : 'fehlt') + ' m/s (jeweils ±2 % der Neuberechnung' + (ok ? ': ' + fm(d.iN, 2) + ' A, ' + fm(d.rpm, 0) + ' 1/min, ' + fm(d.vMs, 3) + ' m/s' : '') + ')', 15));
    return lines;
  }
  function antSolution(ctx) {
    const P = P_(ctx), A = ANT(), key = 'sol' + [P.vSoll, P.mBand, P.dRolle].join('/');
    if (!antSolution.memo) antSolution.memo = {};
    if (!antSolution.memo[key]) {
      const pre = A.acPresets.find(p => p.id === 'm055'), n0 = antMotor(pre, 0.12, 'dreieck').rpm;
      const target = Math.PI * P.dRolle * n0 / (60 * P.vSoll);
      const cand = [];
      for (let z1 = GEAR_MIN; z1 <= 40; z1++) for (let z3 = GEAR_MIN; z3 <= 40; z3++) for (let z2 = 20; z2 <= GEAR_MAX; z2++) {
        const z4t = Math.round(target * z1 * z3 / z2);
        for (let z4 = z4t - 1; z4 <= z4t + 1; z4++) {
          if (z4 < GEAR_MIN || z4 > GEAR_MAX) continue;
          const ratio = z2 / z1 * z4 / z3, e = Math.abs(ratio - target) / target;
          if (e < 0.004) cand.push({ z: [z1, z2, z3, z4], e: e, s: z1 + z2 + z3 + z4 });
        }
      }
      cand.sort((a, b) => a.s - b.s || a.e - b.e);
      let best = null;
      for (let i = 0; i < Math.min(cand.length, 8) && !best; i++) {
        const z = cand[i].z, d = antDerive({ preset: 'm055', ctl: { source: 'netz', connection: 'dreieck' }, gear: { type: 'stirnrad', stages: 2, z1: z[0], z2: z[1], z3: z[2], z4: z[3] } }, { spec: { params: P } });
        if (d.ok && Math.abs(d.vMs - P.vSoll) / P.vSoll < 0.012) best = z;
      }
      if (!best && cand.length) best = cand[0].z;
      antSolution.memo[key] = best || [20, 60, 20, 60];
    }
    const z = antSolution.memo[key];
    const data = { rig: 'drehstrom', preset: 'm055', ctl: { source: 'netz', connection: 'dreieck' }, gear: { type: 'stirnrad', stages: 2, z1: z[0], z2: z[1], z3: z[2], z4: z[3] }, state: {}, derived: {} };
    const d = antDerive(data, ctx);
    data.state = { rpm: rd(d.rpm, 1), iLine: rd(d.iLine, 3), temp: rd(d.temp, 1) };
    data.derived = { iN: rd(d.iN, 3), n: rd(d.rpm, 1), vBelt: rd(d.vMs, 4), ratio: rd(d.ratio, 3) };
    return data;
  }

  /* ====================================================================== vf2: Motorschaltung (Simulations-Lab) */
  const STD_IN = [2, 2.5, 3.2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  function ratingOf(p) {                      // Nennstrom in A aus Wert wie 'C2', 'B16', '2A', '250mA'
    const s = String(p && p.value != null ? p.value : '').replace(',', '.'), m = /(\d+(?:\.\d+)?)\s*(m?)A?/i.exec(s);
    if (!m) return NaN;
    return parseFloat(m[1]) / (m[2] === 'm' && p.kind === 'FUSE' ? 1000 : 1);
  }
  const NC_KINDS = { PBC: 1 };
  /* Leitungsnetz der Schaltung bei gegebener Schützlage und Tastendruck: find(Netzname) */
  function simFind(ix, on, pressed) {
    const par = {};
    const find = a => { if (par[a] === undefined) par[a] = a; while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const un = (a, b) => { if (a === undefined || b === undefined) return; const x = find(a), y = find(b); if (x !== y) par[x] = y; };
    Object.keys(ix.parts).forEach(ref => {
      const p = ix.parts[ref], n = pk => netOf(ix, ref, pk), pr = !!(pressed && pressed[ref]);
      if (p.kind === 'PB') { if (pr) un(n('1'), n('2')); }
      else if (p.kind === 'PBC') { if (!pr) un(n('1'), n('2')); }
      else if (p.kind === 'LSS') un(n('1'), n('2'));          // Schalterstellung ist Betriebszustand, nicht Entwurf
      else if (p.kind === 'FUSE' || p.kind === 'CABLE') un(n('1'), n('2'));
      else if (p.kind === 'SPST') { if (p.props && p.props.sw) un(n('1'), n('2')); }
      else if (p.kind === 'SCHUETZ') {
        const o = !!on[ref];
        if (o) { un(n('K1a'), n('K1b')); un(n('K3a'), n('K3b')); un(n('K4a'), n('K4b')); } else un(n('K2a'), n('K2b'));
      }
    });
    return find;
  }
  function simModel(ix) {
    const m = { ok: false, errs: [] };
    const nz = ofKind(ix, 'NETZ3')[0];
    if (!nz) { m.errs.push('kein Drehstromnetz (NETZ3)'); return m; }
    m.L = ['L1', 'L2', 'L3'].map(k => netOf(ix, nz.ref, k)); m.N = netOf(ix, nz.ref, 'N'); m.PE = netOf(ix, nz.ref, 'PE');
    m.mot = ofKind(ix, 'MOTOR3')[0] || null; m.sch = ofKind(ix, 'SCHUETZ'); m.pb = ofKind(ix, 'PB'); m.pbc = ofKind(ix, 'PBC'); m.lamp = ofKind(ix, 'LAMP'); m.prot = ofKind(ix, 'LSS,FUSE');
    if (!m.mot) m.errs.push('kein Drehstrommotor (MOTOR3)');
    if (!m.sch.length) m.errs.push('kein Schütz');
    m.ok = m.errs.length === 0 && m.L.every(x => x !== undefined) && m.N !== undefined;
    return m;
  }
  /* Schritte: [{ press:[refs] }]; Ergebnis je Schritt { motor, lamp, short, on } (Zustand der Schütze bleibt zwischen den Schritten erhalten) */
  function simRun(ix, m, steps) {
    const on = {}; m.sch.forEach(s => { on[s.ref] = false; });
    const res = [];
    steps.forEach(st => {
      const pressed = {}; arr(st.press).forEach(r => { pressed[r] = true; });
      let find = null, short = false;
      for (let it = 0; it < 24; it++) {
        find = simFind(ix, on, pressed);
        const lset = m.L.map(find), nn = find(m.N);
        const next = {}; let ch = false;
        m.sch.forEach(s => { const a = find(netOf(ix, s.ref, 'A1')), b = find(netOf(ix, s.ref, 'A2')); next[s.ref] = (a !== undefined && b !== undefined) && ((lset.indexOf(a) >= 0 && b === nn) || (lset.indexOf(b) >= 0 && a === nn)); if (next[s.ref] !== on[s.ref]) ch = true; });
        Object.keys(next).forEach(k => { on[k] = next[k]; });
        if (!ch) break;
      }
      const lset = m.L.map(find), nn = find(m.N);
      for (let i = 0; i < 3; i++) { if (lset.indexOf(lset[i]) !== i || lset[i] === nn) short = true; }
      const phases = m.mot ? ['U', 'V', 'W'].map(k => { const f = find(netOf(ix, m.mot.ref, k)); return lset.indexOf(f); }) : [-1, -1, -1];
      const motor = phases.every(x => x >= 0) && new Set(phases).size === 3;
      const lamps = m.lamp.map(l => { const a = find(netOf(ix, l.ref, '1')), b = find(netOf(ix, l.ref, '2')); return (lset.indexOf(a) >= 0 && b === nn) || (lset.indexOf(b) >= 0 && a === nn); });
      res.push({ motor: motor, lamp: lamps.some(x => x), lampOn: lamps, short: short, on: Object.assign({}, on), anyPhase: phases.some(x => x >= 0) });
    });
    return res;
  }
  function checkSim(data, ctx) {
    const P = P_(ctx), lines = [], ix = nlIdx(data && data.netlist), m = ix.ok ? simModel(ix) : { ok: false, errs: ['keine Schaltung (Netzliste leer)'] };
    const an = antDerive(need(ctx, 'foerder.ant'), ctx), iN = an.ok ? an.iN : 1.4;
    // 1: Schutzorgane
    const prot = m.ok ? m.prot : [];
    const perPhase = m.ok ? m.L.map(nl => prot.filter(p => pinKeys(p).some(k => netOf(ix, p.ref, k) === nl) && ratingOf(p) >= iN * (1 - 1e-9) && ratingOf(p) <= 2 * iN * (1 + 1e-9))) : [[], [], []];
    const okProt = m.ok && perPhase.every(x => x.length > 0);
    const rat = m.ok ? prot.map(ratingOf).filter(fin) : [];
    lines.push(L(okProt, 'Schutzorgan je Außenleiter: Nennstrom mindestens I_N = ' + fm(iN, 2) + ' A und höchstens ' + fm(2 * iN, 1) + ' A (A: das Doppelte)' + (m.ok ? (okProt ? '' : ' – für ' + ['L1', 'L2', 'L3'].filter((x, i) => !perPhase[i].length).join(', ') + ' fehlt ein passendes Schutzorgan' + (rat.length ? ' (gefunden: ' + rat.map(x => fm(x, 1) + ' A').join(', ') + ')' : '')) : ' – ' + m.errs[0]), 15));
    // Läufe
    let seq = null, S = null;
    if (m.ok) {
      const pb = m.pb.map(p => p.ref).sort()[0], pbc = m.pbc.map(p => p.ref).sort();
      S = { pb: pb, pbc: pbc };
      seq = {
        idle: simRun(ix, m, [{ press: [] }])[0],
        start: simRun(ix, m, [{ press: pb ? [pb] : [] }, { press: [] }, { press: [] }]),
        each: pbc.map(r => simRun(ix, m, [{ press: pb ? [pb] : [] }, { press: [] }, { press: [r] }, { press: [] }, { press: [] }]))
      };
    }
    const motorOk = !!seq && !seq.idle.motor && !seq.idle.anyPhase && seq.start[0].motor;
    // 2: Hauptkreis
    const anyShort = !!seq && (seq.idle.short || seq.start.some(x => x.short) || seq.each.some(r => r.some(x => x.short)));
    lines.push(L(motorOk && !anyShort, 'Hauptstromkreis: bei Start liegen U, V, W an L1, L2, L3 (drei verschiedene Außenleiter am Motor), in Ruhe ist der Motor stromlos' + (m.ok ? (anyShort ? ' – es entsteht ein Kurzschluss' : motorOk ? '' : (seq && seq.start[0].motor ? ' – der Motor ist auch ohne Start unter Spannung' : ' – der Motor bekommt nicht alle drei Außenleiter')) : ' – ' + m.errs[0]), 20));
    // 3: Steuerkreis (Bauteile und Öffner in Reihe, Meldeleuchte)
    const fall = seq ? seq.each.map(r => r[0].motor && r[1].motor && !r[2].motor) : [];
    const nDrop = fall.filter(x => x).length;
    const lampOk = !!seq && m.lamp.length > 0 && seq.start[0].motor && seq.start[0].lamp && !seq.idle.lamp && seq.each.every(r => !r[3].motor ? !r[3].lamp : true);
    const partsOk = m.ok && m.pb.length >= 1 && m.pbc.length >= 2 && m.sch.every(s => netOf(ix, s.ref, 'A1') !== undefined && netOf(ix, s.ref, 'A2') !== undefined);
    lines.push(L(partsOk && nDrop >= 2 && lampOk, 'Steuerstromkreis: Start-Taster, Stopp und Not-Halt als Öffner in Reihe (je ein Druck schaltet aus: ' + nDrop + ' von mindestens 2), Meldeleuchte nur bei laufendem Motor' + (m.ok ? (partsOk ? (nDrop < 2 ? ' – es sind zwei Öffner in Reihe zur Spule nötig' : !lampOk ? ' – Meldeleuchte fehlt oder leuchtet falsch' : '') : ' – nötig: ein Schließer-Taster, zwei Öffner-Taster, Schütz mit angeschlossener Spule') : ' – ' + m.errs[0]), 25));
    // 4: Simulation
    let simOk = false, simTxt = 'nicht auswertbar';
    if (seq && seq.each.length) {
      const st = seq.start, e0 = seq.each[0], hold = st[0].motor && st[1].motor && st[2].motor;
      const okEach = seq.each.every(r => r[0].motor && r[1].motor && !r[2].motor && !r[3].motor && !r[4].motor);
      simOk = hold && okEach && !anyShort;
      simTxt = !hold ? 'nach Loslassen von Start geht der Motor aus (Selbsthaltung fehlt)' : !okEach ? 'Stopp oder Not-Halt schaltet nicht ab oder der Motor läuft danach selbst wieder an' : anyShort ? 'Kurzschluss' : 'Start läuft, Selbsthaltung hält, Stopp und Not-Halt schalten ab, kein Wiederanlauf ohne neuen Start';
      if (e0 === undefined) simTxt = '–';
    } else if (seq) simTxt = 'es gibt keinen Öffner-Taster (Stopp, Not-Halt)';
    lines.push(L(simOk, 'Simulation: ' + simTxt, 25));
    // 5: PE
    const peOk = m.ok && m.mot && netOf(ix, m.mot.ref, 'PE') !== undefined && netOf(ix, m.mot.ref, 'PE') === m.PE;
    lines.push(L(peOk, 'Schutzleiter: Motor-PE ist mit dem PE des Drehstromnetzes verbunden' + (m.ok && !peOk ? ' – Motorgehäuse nicht geerdet' : ''), 15));
    return lines;
  }
  function buildSim(P, ctx) {
    const an = antDerive(need(ctx, 'foerder.ant'), ctx), iN = an.ok ? an.iN : 1.4;
    const inA = STD_IN.find(x => x >= iN * (1 - 1e-9)) || 6, val = 'C' + inA;
    const b = nlBuilder('Motorschaltung Förderband');
    b.add('X1', 'NETZ3', '400V', { L1: 'L1', L2: 'L2', L3: 'L3', N: 'N', PE: 'PE' });
    b.add('F1', 'LSS', val, { '1': 'L1', '2': 'F1a' }, { sw: 1 }); b.add('F2', 'LSS', val, { '1': 'L2', '2': 'F2a' }, { sw: 1 }); b.add('F3', 'LSS', val, { '1': 'L3', '2': 'F3a' }, { sw: 1 });
    b.add('K1', 'SCHUETZ', '230V', { A1: 'C1', A2: 'N', K1a: 'F1a', K1b: 'M1', K3a: 'F2a', K3b: 'M2', K4a: 'F3a', K4b: 'M3' });
    b.add('K2', 'SCHUETZ', '230V', { A1: 'C1', A2: 'N', K1a: 'CTL', K1b: 'C1' });
    b.add('M1', 'MOTOR3', '400V 0.55kW', { U: 'M1', V: 'M2', W: 'M3', PE: 'PE' });
    b.add('S3', 'PBC', '', { '1': 'L1', '2': 'S3a' }, { pressed: 0 }); b.add('S2', 'PBC', '', { '1': 'S3a', '2': 'CTL' }, { pressed: 0 });
    b.add('S1', 'PB', '', { '1': 'CTL', '2': 'C1' }, { pressed: 0 });
    b.add('H1', 'LAMP', '230V 60W', { '1': 'C1', '2': 'N' });
    return { lab: 'sim', name: 'Motorschaltung Förderband', netlist: b.done(), meas: { I_N_Schutz_A: inA, iN_A: rd(iN, 3) }, snap: {} };
  }

  /* ====================================================================== vf3: Werkstückerkennung (Sensorik-Lab) */
  /* Nennschaltfrequenz in Hz (A, wie senrig-opt.js, Paket A5): induktiv 1 kHz, kapazitiv 50 Hz, Ultraschall 10 Hz, optisch 5 kHz. Ansprechzeit des Sensors: Näherungsschalter 1 / (2 · f_nenn), Optik τ · ln 2 (ms) */
  const SEN_FMAX = { induktiv: 1000, kapazitiv: 50, ultraschall: 10, gabel: 5000, reflex: 5000, ldr: 5000, fotodiode: 5000, fototransistor: 5000 };
  const SEN_TAU = { ldr: 0.08, fotodiode: 0.0005, fototransistor: 0.005, gabel: 0.005, reflex: 0.005 };
  const senTimes = (kind, fd) => { const prox = !SEN_TAU[kind], fNom = SEN_FMAX[kind], tSens = prox ? 500 / fNom : Math.LN2 * SEN_TAU[kind] * 1000, tResp = tSens + Math.max(0, fd); return { tSens: tSens, tResp: tResp, fMax: Math.min(fNom, tResp > 0 ? 500 / tResp : fNom) }; };
  const SEN_KEYS = ['sensor', 'dist', 'material', 'rLoad', 'fdelay'];
  const senCache = new Map();
  function senRun(ctl, seq, T) {
    const c = {}; SEN_KEYS.forEach(k => { if (ctl && ctl[k] !== undefined) c[k] = ctl[k]; });
    const key = JSON.stringify([c, seq, T]);
    if (senCache.has(key)) return senCache.get(key);
    const r = SEN().runSeq('licht', seq, T, { controls: c, rigOpts: { controls: c }, dtMs: 2, sampleMs: 2 });
    if (senCache.size > 400) senCache.clear();
    senCache.set(key, r);
    return r;
  }
  const ANT_V = (ctx) => { const a = antDerive(need(ctx, 'foerder.ant'), ctx); return a.ok && fin(a.vMs) && a.vMs > 0 ? a.vMs : P_(ctx).vSoll; };
  function senDerive(sen, ctx) {
    const P = P_(ctx), o = { ok: false, errs: [] };
    const ctl = isObj(sen && sen.ctl) ? sen.ctl : {};
    const kind = lc(ctl.sensor), dist = +ctl.dist, rLoad = +ctl.rLoad, fd = fin(+ctl.fdelay) ? +ctl.fdelay : 0;
    if (!SEN_FMAX[kind]) { o.errs.push('Sensorart „' + ctl.sensor + '“ unbekannt'); return o; }
    if (!fin(dist) || dist < 0 || !fin(rLoad) || rLoad <= 0) { o.errs.push('Montageabstand oder Lastwiderstand fehlen'); return o; }
    const v = ANT_V(ctx);
    const sn = senRun({ sensor: 'induktiv', material: 'stahl', dist: 3, rLoad: 10000, fdelay: 0 }, [], 20).final, snMm = sn && sn.reduction > 0 ? sn.switchOn / sn.reduction : 8;
    const wk = senRun({ sensor: 'induktiv', material: P.werkstoff, dist: 3, rLoad: 10000, fdelay: 0 }, [], 20).final, srWork = wk ? wk.switchOn : NaN;
    const kun = senRun({ sensor: 'induktiv', material: 'kunststoff', dist: 1, rLoad: 10000, fdelay: 0 }, [], 20).final;
    const run = senRun({ sensor: kind, material: lc(ctl.material) || 'stahl', dist: 300, rLoad: rLoad, fdelay: fd }, [{ t: 100, set: { dist: dist } }], 500), fin2 = run.final || {};
    const offS = run.samples && run.samples[0] ? run.samples[0].state : {};
    const iOut = fin(fin2.iOut) ? fin2.iOut : NaN;
    const tm = senTimes(kind, fd), fMax = tm.fMax;
    Object.assign(o, { ok: true, errs: [], kind: kind, material: lc(ctl.material), dist: dist, rLoad: rLoad, fdelay: fd, vMs: v, sn: snMm, srWork: srWork, plasticSw: !!(kun && kun.state === 1) || (kun && kun.switchOn > 0),
      on: fin2.state === 1, uOn: fin2.uOut, uOff: offS.uOut, iOutMa: iOut, fMaxHz: fMax, fReq: v / ((P.lWerk + P.lLuecke) / 1000), tOnMs: tm.tResp, tSensMs: tm.tSens, tPulseMs: (P.lWerk + P.fensterMm) / v });
    o.iSupplyMa = P.iSensMa + (fin(iOut) ? iOut : 0);
    return o;
  }
  function checkSen(data, ctx) {
    const P = P_(ctx), lines = [], d = senDerive(data, ctx), ok = d.ok;
    lines.push(L(ok && d.fMaxHz >= 2 * d.fReq, 'Schaltfrequenz: f_req = v / (l + Lücke) = ' + (ok ? fm(d.vMs, 3) + ' m/s / ' + fm((P.lWerk + P.lLuecke) / 1000, 2) + ' m = ' + fm(d.fReq, 1) + ' Hz' : '?') + ', der Sensor schafft ' + (ok ? fm(d.fMaxHz, 1) : '?') + ' Hz (verlangt mindestens das Doppelte: ' + (ok ? fm(2 * d.fReq, 1) : '?') + ' Hz, A: induktiv 1 kHz, Entprellzeit begrenzt)' + (ok ? '' : ' – ' + d.errs[0]), 30));
    const margin = ok ? d.dist <= 0.8 * d.srWork + 1e-9 : false;
    const typeOk = ok && d.kind === 'induktiv' && d.material === lc(P.werkstoff);
    lines.push(L(ok && typeOk && margin && d.on && !d.plasticSw, 'Metall erkannt, Kunststoff nicht: ' + (ok ? (d.kind === 'induktiv' ? 'induktiver Sensor, Material ' + (d.material || '?') + ' (verlangt ' + WERKSTOFF[P.werkstoff] + '), Schaltabstand für ' + WERKSTOFF[P.werkstoff] + ' ' + fm(d.srWork, 2) + ' mm, Montageabstand ' + fm(d.dist, 2) + ' mm (höchstens ' + fm(0.8 * d.srWork, 2) + ' mm mit 20 % Reserve)' + (d.on ? '' : ', der Sensor schaltet im Prüfstand nicht') : 'Sensorart ' + d.kind + ' erkennt Kunststoff mit oder ist für Metall ungeeignet – verlangt ist induktiv') : 'nicht auswertbar'), 25));
    lines.push(L(ok && d.tPulseMs >= Math.max(10 * P.cycleMs, 2 * d.fdelay), 'Zeit im Erfassungsbereich t = (l + Fensterbreite) / v = (' + P.lWerk + ' + ' + P.fensterMm + ') mm / ' + (ok ? fm(d.vMs * 1000, 0) : '?') + ' mm/s = ' + (ok ? fm(d.tPulseMs, 0) : '?') + ' ms, verlangt mindestens ' + (ok ? fm(Math.max(10 * P.cycleMs, 2 * d.fdelay), 0) : '?') + ' ms (10 SPS-Zyklen, A, und das Doppelte der Entprellzeit)', 20));
    const dv = isObj(data && data.derived) ? data.derived : {};
    const lvlOk = ok && fin(d.uOn) && d.uOn >= 15 && fin(d.uOff) && d.uOff <= 5 && d.rLoad >= 1000;
    const slotOk = ok && sameVal(+dv.iSupplyMa, d.iSupplyMa, 0.05);
    lines.push(L(lvlOk && slotOk, 'Versorgung und Ausgang (24 V, PNP): Pegel EIN ' + (ok ? fm(d.uOn, 1) : '?') + ' V (mindestens 15 V), AUS ' + (ok ? fm(d.uOff, 1) : '?') + ' V (höchstens 5 V), Lastwiderstand ' + (ok ? fm(d.rLoad / 1000, 1) : '?') + ' kΩ (mindestens 1 kΩ, A); Stromaufnahme im Slot ' + (fin(+dv.iSupplyMa) ? fm(+dv.iSupplyMa, 1) : 'fehlt') + ' mA' + (ok ? ', gerechnet ' + fm(d.iSupplyMa, 1) + ' mA (Eigenstrom ' + P.iSensMa + ' mA + Ausgangsstrom)' : ''), 15));
    lines.push(L(ok && d.dist >= 0.1 * d.sn - 1e-9, 'Montageabstand mindestens 10 % des Nennschaltabstands: ' + (ok ? fm(d.dist, 2) + ' mm, Sn = ' + fm(d.sn, 1) + ' mm, also mindestens ' + fm(0.1 * d.sn, 2) + ' mm' : 'nicht auswertbar'), 10));
    return lines;
  }
  function senSolution(ctx) {
    const P = P_(ctx), prb = senDerive({ ctl: { sensor: 'induktiv', material: P.werkstoff, dist: 1, rLoad: 10000, fdelay: 5 } }, ctx);
    const d = rd(0.5 * (0.1 * prb.sn + 0.8 * prb.srWork), 1);
    const data = { rig: 'licht', preset: '', ctl: { sensor: 'induktiv', material: P.werkstoff, dist: d, rLoad: 10000, fdelay: 5 }, state: {}, derived: {} };
    const dv = senDerive(data, ctx);
    data.state = { state: dv.on ? 1 : 0, uOut: rd(dv.uOn, 2), iOut: rd(dv.iOutMa, 3) };
    data.derived = { tRespMs: rd(dv.tOnMs, 3), tSensMs: rd(dv.tSensMs, 3), fMax: rd(dv.fMaxHz, 2), mountOk: true, mountReserve: rd(1 - dv.dist / dv.srWork, 3), iSupplyMa: rd(dv.iSupplyMa, 2), tPulseMs: rd(dv.tPulseMs, 1) };
    return data;
  }

  /* ====================================================================== vf4: Regler für die Interface-Platine (Datenblatt-Lab) */
  const PRV_STD = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 25];
  function pickInfo(pk) {
    const o = { ok: false, why: '', reg: null };
    if (!isObj(pk)) { o.why = 'Auswahl fehlt'; return o; }
    const it = arr(pk.items).find(x => isObj(x) && x.role === 'regler');
    o.reg = it ? dsOf(it.ds) : null; o.vals = isObj(pk.vals) ? pk.vals : {}; o.calc = isObj(pk.calc) ? pk.calc : {};
    o.rV = o.vals.rV == null || o.vals.rV === '' ? 0 : numOf(o.vals.rV);
    o.pRv = numOf(o.vals.pRvW); o.finding = lc(o.vals.finding);
    o.ok = !!o.reg; if (!o.ok) o.why = 'Regler nicht gewählt';
    return o;
  }
  function regLoad(P, ctx) {                  // Laststrom des 5-V-Zweigs in A: Sensorkanäle (aus der Sensorik-Station) und Logik
    const sen = slotOf(ctx, 'foerder.sen') || need(ctx, 'foerder.sen'), sd = sen ? senDerive(sen, ctx) : null;
    const iSup = sd && sd.ok && fin(sd.iSupplyMa) ? sd.iSupplyMa : P.iSensMa;
    return (P.nSens * iSup + P.iLogikMa) / 1000;
  }
  function regCalc(P, reg, rV, iTot) {
    const th = reg && reg.thermal ? reg.thermal : {}, iq = dsVal(dsRow(reg, 'iq'), 'typ') || 0.005;
    const iIn = iTot + iq, vinMax = P.uMax - iIn * (rV || 0), vinMin = P.uMin - iIn * (rV || 0);
    const pv = (vinMax - P.uRef) * iTot + vinMax * iq, pvOhne = (P.uMax - P.uRef) * iTot + P.uMax * iq;
    const rth = th.rthJA || 50, tjMax = th.tjMax || 125, ptotMax = th.ptotMax || 2;
    return { iIn: iIn, iq: iq, vinMax: vinMax, vinMin: vinMin, pv: pv, tj: P.tAmb + pv * rth, pvOhne: pvOhne, tjOhne: P.tAmb + pvOhne * rth, rth: rth, tjMax: tjMax, ptotMax: ptotMax, pRv: iIn * iIn * (rV || 0),
      viMaxRec: dsVal(arr(reg && reg.rec).find(r => r.key === 'vi'), 'max') || 25, viMinRec: dsVal(arr(reg && reg.rec).find(r => r.key === 'vi'), 'min') || 7.5 };
  }
  const tjMargin = tol => Math.round(10 * (1.5 - tol));
  function checkDs(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = pickInfo(data), reg = pi.reg;
    const iTot = regLoad(P, ctx);
    const vo = reg ? dsVal(dsRow(reg, 'vo'), 'typ') : NaN, viAbs = reg ? dsVal(dsRow(reg, 'vi'), 'max') : NaN;
    const regOk = !!reg && reg.family === 'Spannungsregler' && fin(vo) && Math.abs(vo - P.uRef) <= 0.2;
    const viOk = fin(viAbs) && viAbs >= P.uMax;
    const absRow = reg ? reg.abs.find(r => r.key === 'vi' || r.key === 'vdiff') : null;
    lines.push(L(regOk && viOk, 'Regler: ' + (reg ? refOf(reg) + (regOk ? ' liefert fest ' + fm(P.uRef, 0) + ' V' : ' liefert nicht fest ' + fm(P.uRef, 0) + ' V (Festregler gesucht)') + (fin(viAbs) ? ', Eingang höchstens ' + fm(viAbs, 0) + ' V (nötig mindestens ' + fm(P.uMax, 1) + ' V = 24 V + 10 %)' : (absRow ? '' : ', keine Zeile V_I,max gefunden')) : 'kein Regler gewählt'), 20));
    const c0 = reg ? regCalc(P, reg, 0, iTot) : null;
    const hot = c0 ? (c0.tjOhne > c0.tjMax || c0.pvOhne > c0.ptotMax) : null;
    lines.push(L(c0 && ((hot && /^(heiss|heiß|zu heiss|zu heiß)$/.test(pi.finding)) || (!hot && /^ok$/.test(pi.finding))), 'Befund ohne Vorwiderstand: P = (' + fm(P.uMax, 1) + ' V − ' + fm(P.uRef, 0) + ' V) · ' + fm(iTot * 1000, 0) + ' mA ≈ ' + (c0 ? fm(c0.pvOhne, 2) : '?') + ' W, T_j = ' + (c0 ? fm(c0.tjOhne, 0) : '?') + ' °C bei ' + P.tAmb + ' °C (Grenze ' + (c0 ? fm(c0.tjMax, 0) : '?') + ' °C) ist ' + (hot === null ? '?' : hot ? 'zu heiß' : 'ok') + (pi.finding ? ', dein Befund: ' + (pi.vals.finding) : ', Befund fehlt'), 20));
    const c = reg ? regCalc(P, reg, pi.rV, iTot) : null, mk = tjMargin(tol);
    const okR = c && fin(pi.rV) && pi.rV > 0 && isE(pi.rV, 'E12') && c.tj <= c.tjMax - mk && c.pv <= c.ptotMax && c.vinMax <= c.viMaxRec;
    lines.push(L(okR, 'Vorwiderstand ' + (fin(pi.rV) && pi.rV > 0 ? fmtRde(pi.rV) + ' Ω' : 'fehlt') + ' (E12): Spannung am Regler ' + (c ? fm(c.vinMax, 1) : '?') + ' V (höchstens ' + (c ? fm(c.viMaxRec, 0) : '?') + ' V), P_Regler ' + (c ? fm(c.pv, 2) : '?') + ' W, T_j ' + (c ? fm(c.tj, 0) : '?') + ' °C (höchstens ' + (c ? fm(c.tjMax - mk, 0) : '?') + ' °C)' + (fin(pi.rV) && pi.rV > 0 && !isE(pi.rV, 'E12') ? ' – kein E12-Wert' : ''), 30));
    lines.push(L(c && fin(pi.rV) && pi.rV > 0 && fin(pi.pRv) && pi.pRv >= 2 * c.pRv, 'Leistung des Vorwiderstands: P = I² · R = ' + (c ? fm(c.pRv, 2) : '?') + ' W, Nennleistung mindestens ' + (c ? fm(2 * c.pRv, 2) : '?') + ' W (Faktor 2), angegeben ' + (fin(pi.pRv) ? fm(pi.pRv, 2) + ' W' : 'nichts'), 15));
    lines.push(L(c && fin(pi.rV) && c.vinMin >= Math.max(c.viMinRec, P.uRef + (dsVal(dsRow(reg, 'vdo'), 'max') || 2.5)), 'Dropout-Reserve bei ' + fm(P.uMin, 1) + ' V: Spannung am Regler ' + (c ? fm(c.vinMin, 1) : '?') + ' V, nötig mindestens ' + (c ? fm(Math.max(c.viMinRec, P.uRef + (dsVal(dsRow(reg, 'vdo'), 'max') || 2.5)), 1) : '?') + ' V (' + fm(P.uRef, 0) + ' V + Dropout, empfohlener Mindestwert 7,5 V)', 15));
    return lines;
  }
  function dsSolution(ctx) {
    const P = P_(ctx), reg = dsOf('tf-7805'), iTot = regLoad(P, ctx), tol = TOL(ctx), mk = tjMargin(tol), cands = [];
    rvList.forEach(rv => { const c = regCalc(P, reg, rv, iTot); if (c.tj <= c.tjMax - mk - 1 && c.pv <= c.ptotMax && c.vinMax <= c.viMaxRec - 0.1 && c.vinMin >= 8) cands.push({ rv: rv, c: c }); });
    const sel = cands.length ? cands[Math.floor(cands.length / 2)] : { rv: 68, c: regCalc(P, reg, 68, iTot) };
    const c0 = regCalc(P, reg, 0, iTot), hot = c0.tjOhne > c0.tjMax || c0.pvOhne > c0.ptotMax;
    const pRv = PRV_STD.find(x => x >= 2 * sel.c.pRv) || 25;
    return { items: [{ role: 'regler', ds: 'tf-7805', part: 'TF-7805', ref: '7805' }], calc: { iTotMa: rd(iTot * 1000, 1), tjOhne: rd(c0.tjOhne, 1) }, vals: { rV: sel.rv, pRvW: pRv, finding: hot ? 'heiss' : 'ok' } };
  }

  /* ====================================================================== vf5: Sensor-Interface (SchaltLab) */
  function riseMs(vth, vf, rth, c) {          // 10-90-%-Anstiegszeit der Knotenspannung (Ziel vth, Endwert vf <= vth) in ms
    if (!(vth > 0) || !(vf > 0) || !(rth > 0) || !(c > 0)) return NaN;
    const tau = rth * c, tt = v => -tau * Math.log(1 - v / vth);
    if (vf >= vth * (1 - 1e-12)) return tau * Math.log(9) * 1000;
    return (tt(0.9 * vf) - tt(0.1 * vf)) * 1000;
  }
  /* Kanäle der Interface-Schaltung über die Topologie (nie Netznamen) */
  function ifaceOf(ix, P) {
    const o = { ok: false, errs: [], channels: [] };
    let sup = supplyOf(ix, P.uSteuer, 0.5);
    const reg0 = ofKind(ix, 'REG')[0];
    if (sup && reg0) {                          // die Versorgung ist die Quelle, die (direkt oder über einen Widerstand) am Reglereingang liegt
      const rin = netOf(ix, reg0.ref, 'IN');
      const cand = ofKind(ix, 'BAT').filter(b => Math.abs(numOf(b.value) - P.uSteuer) <= 0.5).map(b => { const bp = batPins(b); return { ref: b.ref, plusNet: netOf(ix, b.ref, bp.plus), minusNet: netOf(ix, b.ref, bp.minus) }; });
      const hit = cand.find(c => c.plusNet === rin || ofKind(ix, 'R').some(r => (netOf(ix, r.ref, '1') === c.plusNet && netOf(ix, r.ref, '2') === rin) || (netOf(ix, r.ref, '2') === c.plusNet && netOf(ix, r.ref, '1') === rin)));
      if (hit) sup = hit;
    }
    o.sup = sup;
    if (!sup) { o.errs.push('keine ' + P.uSteuer + '-V-Quelle'); return o; }
    ofKind(ix, 'ZD').forEach(z => {
      const node = netOf(ix, z.ref, 'K'), ga = netOf(ix, z.ref, 'A'), ch = { zd: z, node: node, zdOk: ga === sup.minusNet, vz: numOf(z.value) };
      const rs = ofKind(ix, 'R').filter(r => netOf(ix, r.ref, '1') === node || netOf(ix, r.ref, '2') === node);
      rs.forEach(r => { const other = netOf(ix, r.ref, '1') === node ? netOf(ix, r.ref, '2') : netOf(ix, r.ref, '1'); if (other === sup.minusNet) ch.r2 = r; else if (!ch.r1) { ch.r1 = r; ch.sig = other; } });
      ch.c = ofKind(ix, 'C,CE').find(c => (netOf(ix, c.ref, '1') === node && netOf(ix, c.ref, '2') === sup.minusNet) || (netOf(ix, c.ref, '2') === node && netOf(ix, c.ref, '1') === sup.minusNet)) || null;
      ch.src = !!(ch.sig !== undefined && ofKind(ix, 'SPST,PB,BAT').some(p => pinKeys(p).some(k => netOf(ix, p.ref, k) === ch.sig)));
      ch.r1v = ch.r1 ? numOf(ch.r1.value) : NaN; ch.r2v = ch.r2 ? numOf(ch.r2.value) : NaN; ch.cv = ch.c ? numOf(ch.c.value) : NaN;
      ch.ok = !!(ch.r1 && ch.r2 && ch.c && ch.src && fin(ch.r1v) && fin(ch.r2v) && fin(ch.cv));
      if (ch.ok) {
        const U = P.uSteuer, vth = U * ch.r2v / (ch.r1v + ch.r2v), rth = ch.r1v * ch.r2v / (ch.r1v + ch.r2v);
        ch.vth = vth; ch.rth = rth; ch.vHi = ch.zdOk && fin(ch.vz) && vth > ch.vz ? ch.vz : vth; ch.tau = rth * ch.cv * 1000; ch.tr = riseMs(vth, ch.vHi, rth, ch.cv);
        const vm = P.uMax * ch.r2v / (ch.r1v + ch.r2v);
        ch.iz = ch.zdOk && fin(ch.vz) && vm > ch.vz ? (P.uMax - ch.vz) / ch.r1v - ch.vz / ch.r2v : 0;
      }
      o.channels.push(ch);
    });
    o.channels.sort((a, b) => (a.zd.ref < b.zd.ref ? -1 : 1));
    o.reg = ofKind(ix, 'REG')[0] || null;
    if (o.reg) { o.regIn = netOf(ix, o.reg.ref, 'IN'); o.regOut = netOf(ix, o.reg.ref, 'OUT'); o.regGnd = netOf(ix, o.reg.ref, 'GND'); o.rv = ofKind(ix, 'R').find(r => (netOf(ix, r.ref, '1') === sup.plusNet && netOf(ix, r.ref, '2') === o.regIn) || (netOf(ix, r.ref, '2') === sup.plusNet && netOf(ix, r.ref, '1') === o.regIn)) || null; }
    o.ok = true;
    return o;
  }
  function buildSch(P, pk, opts) {
    opts = opts || {};
    const pi = pickInfo(pk), b = nlBuilder('Sensor-Interface Förderanlage'), n = P.nSens;
    const rv = pi.rV > 0 ? pi.rV : 0;
    b.add('V1', 'BAT', String(P.uSteuer), { '+': 'V24', '-': 'GND' });
    if (rv > 0) b.add('RV1', 'R', fmtR(rv), { '1': 'V24', '2': 'N_REG' });
    b.add('U1', 'REG', pi.reg ? refOf(pi.reg) : '7805', { IN: rv > 0 ? 'N_REG' : 'V24', GND: 'GND', OUT: 'V5' });
    b.add('CO1', 'C', '100n', { '1': 'V5', '2': 'GND' });
    const r1 = opts.r1 || 47000, r2 = opts.r2 || 10000, cc = opts.c || 3.3e-7;
    for (let k = 1; k <= n; k++) {
      b.add('BS' + k, 'BAT', String(P.uSteuer), { '+': 'N_B' + k, '-': 'GND' });
      b.add('S' + k, 'SPST', '', { '1': 'N_B' + k, '2': 'SIG' + k }, { sw: 0 });
      b.add('R' + (2 * k - 1), 'R', fmtR(r1), { '1': 'SIG' + k, '2': 'L' + k });
      b.add('R' + (2 * k), 'R', fmtR(r2), { '1': 'L' + k, '2': 'GND' });
      b.add('D' + k, 'ZD', '5.1', { A: 'GND', K: 'L' + k });
      b.add('C' + k, 'C', fmtC(cc), { '1': 'L' + k, '2': 'GND' });
    }
    const nl = b.done(), ix = nlIdx(nl), f = ifaceOf(ix, P), ch = f.channels[0];
    return { lab: 'sch', name: 'Sensor-Interface Förderanlage', netlist: nl, meas: { U_hi: rd(ch.vHi, 3), tr: rd(ch.tr, 3), tau: rd(ch.tau, 3), U_5V: P.uRef }, snap: {} };
  }
  function checkSch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], ix = nlIdx(data && data.netlist), f = ix.ok ? ifaceOf(ix, P) : { ok: false, errs: ['keine Schaltung (Netzliste leer)'], channels: [] };
    const pk = need(ctx, 'foerder.ds'), pi = pickInfo(pk), chs = f.channels, good = chs.filter(c => c.ok);
    // 1: Regler und Vorwiderstand wie ausgewählt
    const errs1 = [];
    if (!pi.ok) errs1.push('die Auswahl der Datenblatt-Station fehlt');
    else if (!f.ok || !f.reg) errs1.push('kein Spannungsregler in der Schaltung');
    else {
      if (!valueIs(f.reg.value, pi.reg)) errs1.push('Regler „' + f.reg.value + '“ statt ' + refOf(pi.reg));
      if (pi.rV > 0) { if (!f.rv || !sameVal(numOf(f.rv.value), pi.rV, 1e-3)) errs1.push('Vorwiderstand ' + (f.rv ? fmtRde(numOf(f.rv.value)) : 'fehlt') + ' statt ' + fmtRde(pi.rV) + ' zwischen +24 V und Reglereingang'); }
      else if (f.regIn !== f.sup.plusNet) errs1.push('ohne Vorwiderstand gehört der Reglereingang direkt an +24 V');
    }
    lines.push(L(errs1.length === 0, 'Regler und Vorwiderstand entsprechen der Datenblatt-Auswahl (' + (pi.reg ? refOf(pi.reg) : '?') + ', ' + (pi.rV > 0 ? fmtRde(pi.rV) + ' Ω' : 'ohne Vorwiderstand') + ')' + (errs1.length ? ' – ' + errs1[0] : ''), 20));
    // 2: Teilerpegel
    const allHi = good.length >= P.nSens && good.every(c => c.vHi <= 5.0 + 1e-9 && c.vHi >= 3.5 - 1e-9);
    const c0 = good[0];
    lines.push(L(allHi, 'Teilerpegel bei 24 V Eingang: ' + (good.length ? good.map(c => fm(c.vHi, 2) + ' V').join(' und ') : 'kein vollständiger Kanal gefunden') + ' (verlangt höchstens 5,0 V und mindestens 3,5 V = 0,7 · 5 V, A: CMOS)' + (chs.length < P.nSens ? ' – es sind ' + P.nSens + ' Kanäle nötig, gefunden ' + chs.length : good.length < chs.length ? ' – ein Kanal ist unvollständig (R oben, R unten, C, Quelle)' : ''), 25));
    // 3: Z-Diode
    const zOk = good.length >= P.nSens && good.every(c => c.zdOk && fin(c.vz) && Math.abs(c.vz - 5.1) < 0.3 && c.iz <= 0.05 + 1e-9);
    lines.push(L(zOk, 'Z-Diode ' + (c0 ? fm(c0.vz, 1) : '?') + ' V parallel zum Logikeingang (Kathode am Signalknoten) und Strom bei ' + fm(P.uMax, 1) + ' V: ' + (c0 ? fm(c0.iz * 1000, 1) : '?') + ' mA (höchstens 50 mA laut Datenblatt)' + (c0 && !c0.zdOk ? ' – Diode verpolt' : ''), 15));
    // 4: RC-Filter
    const meas = isObj(data && data.meas) ? data.meas : {};
    const trOk = c0 && (meas.tr === undefined || meas.tr === null || (fin(+meas.tr) && sameVal(+meas.tr, c0.tr, 0.15 * tol)));
    const lim = 0.1 * P.tPulsMs;
    const rangeOk = c0 && c0.tr >= P.tFilterMinMs && c0.tr <= lim;
    lines.push(L(trOk && rangeOk, 'RC-Filter: τ = R · C = ' + (c0 ? fm(c0.rth / 1000, 2) + ' kΩ · ' + fm(c0.cv * 1e9, 0) + ' nF = ' + fm(c0.tau, 2) + ' ms' : '?') + ', Anstiegszeit (10 bis 90 %) ' + (c0 ? fm(c0.tr, 2) : '?') + ' ms, im Slot ' + (fin(+meas.tr) ? fm(+meas.tr, 2) + ' ms (±' + fm(15 * tol, 0) + ' %)' : 'nicht angegeben (freiwillig, die Prüfung rechnet selbst)') + '; erlaubt ' + fm(P.tFilterMinMs, 0) + ' bis ' + fm(lim, 1) + ' ms (Störimpulse unterdrücken, Impuls ' + fm(P.tPulsMs, 0) + ' ms nicht verschleifen, A)', 25));
    // 5: Masse und Pins
    let gndOk = !!f.sup && f.ok;
    const gnd = f.sup && f.sup.minusNet, bad = [];
    if (f.ok) {
      Object.keys(ix.parts).forEach(ref => {
        const p = ix.parts[ref]; if (['BAT', 'SPST', 'R', 'C', 'ZD', 'REG'].indexOf(p.kind) < 0) return;
        PINS[p.kind].forEach(k => { const nn = netOf(ix, ref, k); if (nn === undefined || arr(ix.nets[nn]).length < 2) bad.push(ref + '.' + k); });
      });
      if (f.reg && f.regGnd !== gnd) gndOk = false;
      good.forEach(c => { if (netOf(ix, c.zd.ref, 'A') !== gnd) gndOk = false; });
      ofKind(ix, 'BAT').forEach(bt => { if (netOf(ix, bt.ref, batPins(bt).minus) !== gnd) gndOk = false; });
    }
    lines.push(L(f.ok && gndOk && bad.length === 0 && ix.dups.length === 0, 'GND gemeinsam (24-V-Quellen, Regler, Z-Dioden, Teiler) und kein offener Pin (' + Object.keys(ix.parts).length + ' Bauteile, ' + Object.keys(ix.nets).length + ' Netze)' + (bad.length ? ' – offen: ' + bad.slice(0, 3).join(', ') : !gndOk && f.ok ? ' – nicht alles liegt an derselben Masse' : ix.dups.length ? ' – Pin in zwei Netzen: ' + ix.dups[0] : ''), 15));
    return lines;
  }
  /* Teiler und Filterkondensator der Musterlösung: Pegel 3,5 bis 5,0 V, Anstiegszeit etwa 6 ms */
  function schDesign(P) {
    let best = null;
    rList.forEach(r1 => rList.forEach(r2 => {
      if (r1 < 10000 || r1 > 100000 || r2 < 4700 || r2 > 47000) return;
      const vth = P.uSteuer * r2 / (r1 + r2); if (vth < 3.9 || vth > 4.6) return;
      const rth = r1 * r2 / (r1 + r2);
      cList.forEach(c => { const tr = riseMs(vth, vth, rth, c), lim = 0.1 * P.tPulsMs; if (tr < Math.max(P.tFilterMinMs * 2, 3) || tr > lim * 0.7) return;
        const sc = Math.abs(Math.log(tr / Math.min(6, lim * 0.5))) + 0.1 * Math.abs(vth - 4.2); if (!best || sc < best.sc) best = { r1: r1, r2: r2, c: c, sc: sc }; });
    }));
    return best || { r1: 47000, r2: 10000, c: 3.3e-7 };
  }

  /* ====================================================================== vf6: Interface-Platine (Leiterplatten-Lab) */
  const FPMAP = {
    R: { fp: ['R_AXIAL_10'], maps: [{ '1': '1', '2': '2' }] },
    C: { fp: ['C_RADIAL_2.5'], maps: [{ '1': '1', '2': '2' }, { '1': '2', '2': '1' }] },
    ZD: { fp: ['D_DO41', 'DO-41'], fallback: 'R_AXIAL_10', maps: [{ A: '2', K: '1' }] },
    REG: { fp: ['TO-220'], maps: [{ IN: '1', GND: '2', OUT: '3' }] }
  };
  const isTermFp = fp => /^(HDR_1x|TERMINAL|SCREW|SCHRAUB)/i.test(String(fp || ''));
  const isTp = p => isObj(p) && /^TP\d/i.test(String(p.ref || ''));
  const isTerm = p => isObj(p) && !isTp(p) && (/^X\d/i.test(String(p.ref || '')) || isTermFp(p.fp));
  function fpExists(id) { const c = PCB(); return !!(c && c.footprint && c.footprint(id)); }
  function fpPick(kind) { const m = FPMAP[kind]; const f = m.fp.find(fpExists); return f || m.fallback || m.fp[0]; }
  const asBoard = b => { if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return null; } } return isObj(b) ? b : null; };
  const boardCache = new Map();
  function boardStats(board) {
    const key = hash(JSON.stringify(board));
    if (boardCache.has(key)) return boardCache.get(key);
    const c = PCB(), conn = c.connectivity(board), drc = arr(c.drc(board));
    const errs = drc.filter(x => x.severity === 'error' && x.type !== 'unconnected'), warns = drc.filter(x => x.severity !== 'error');
    const unc = drc.filter(x => x.type === 'unconnected');
    let cost = NaN; try { const cc = c.cost(board); cost = cc && fin(cc.total) ? cc.total : NaN; } catch (e) { /* */ }
    const s = { conn: conn, drc: drc, errs: errs, warns: warns, unconnected: unc, unrouted: arr(conn.unrouted).length, shorts: arr(conn.shorts).length, cost: cost };
    if (boardCache.size > 200) boardCache.clear();
    boardCache.set(key, s);
    return s;
  }
  function boardReport(board) {
    const s = boardStats(board);
    return { w: board.w, h: board.h, layers: board.layers, drcErrors: s.errs.length, drcWarns: s.warns.length, unrouted: s.unrouted, shorts: s.shorts, cost: s.cost, bomCount: arr(board.parts).length };
  }
  /* Netze, die zur Außenwelt führen (Quellen, Regler-Ausgang, Logikknoten): brauchen eine Klemme */
  function extNames(ix) {
    const ext = {};
    Object.keys(ix.parts).forEach(ref => { const p = ix.parts[ref]; if (SRC_KINDS[p.kind]) pinKeys(p).forEach(k => { const n = netOf(ix, ref, k); if (n !== undefined) ext[n] = 1; }); });
    ofKind(ix, 'REG').forEach(r => { const n = netOf(ix, r.ref, 'OUT'); if (n !== undefined) ext[n] = 1; });
    ofKind(ix, 'ZD').forEach(z => { const n = netOf(ix, z.ref, 'K'); if (n !== undefined) ext[n] = 1; });
    return ext;
  }
  function expectedNets(ixs, board, variant) {
    const bparts = {}; arr(board && board.parts).forEach(p => { if (isObj(p)) bparts[p.ref] = p; });
    const missing = [], nets = [], ext = extNames(ixs);
    Object.keys(ixs.nets).forEach(name => {
      const pads = [];
      ixs.nets[name].forEach(pin => {
        const dot = pin.indexOf('.'), ref = pin.slice(0, dot), pn = pin.slice(dot + 1), part = ixs.parts[ref];
        if (!part || SRC_KINDS[part.kind]) return;
        const fm_ = FPMAP[part.kind];
        if (!fm_) return;
        if (!bparts[ref]) { if (missing.indexOf(ref) < 0) missing.push(ref); return; }
        const map = fm_.maps[Math.min(variant[part.kind] || 0, fm_.maps.length - 1)];
        if (map[pn] !== undefined) pads.push(ref + '.' + map[pn]);
      });
      if (pads.length) nets.push({ name: name, pads: pads, ext: !!ext[name] });
    });
    return { nets: nets, missing: missing };
  }
  function boardEquiv(ixs, board) {
    const kinds = {}; Object.keys(ixs.parts).forEach(r => { const k = ixs.parts[r].kind; if (FPMAP[k] && FPMAP[k].maps.length > 1) kinds[k] = FPMAP[k].maps.length; });
    let combos = [{}];
    Object.keys(kinds).forEach(k => { const nx = []; combos.forEach(c => { for (let i = 0; i < kinds[k]; i++) { const o = Object.assign({}, c); o[k] = i; nx.push(o); } }); combos = nx; });
    const bnet = {}; arr(board.nets).forEach(n => { if (isObj(n)) arr(n.pins).forEach(p => { if (bnet[String(p)] === undefined) bnet[String(p)] = n.name; }); });
    const terms = arr(board.parts).filter(isTerm), termPads = [];
    if (terms.length && PCB()) PCB().padsOf(board).forEach(p => { if (terms.some(t => t.ref === p.ref)) termPads.push(p.id); });
    let best = null;
    combos.forEach(variant => {
      const ex = expectedNets(ixs, board, variant), viol = [];
      ex.missing.forEach(r => viol.push('Bauteil ' + r + ' fehlt auf der Platine'));
      const seen = {};
      ex.nets.forEach(n => {
        const names = n.pads.map(p => bnet[p]);
        const none = n.pads.filter((p, i) => names[i] === undefined);
        if (none.length === n.pads.length && n.pads.length === 1 && !n.ext) return;
        if (none.length) { viol.push('Pad ' + none[0] + ' (Netz ' + n.name + ') ist keinem Netz zugeordnet'); return; }
        const first = names[0], diff = n.pads.find((p, i) => names[i] !== first);
        if (diff) { viol.push(n.pads[0] + ' und ' + diff + ' müssen im gleichen Netz liegen (' + n.name + ')'); return; }
        if (seen[first]) viol.push('die Netze ' + seen[first] + ' und ' + n.name + ' sind auf der Platine verbunden'); else seen[first] = n.name;
        n.bname = first;
        if (n.ext && !termPads.some(tp => bnet[tp] === first)) viol.push('Netz ' + n.name + ' hat keine Anschlussklemme');
      });
      const good = {}; ex.nets.forEach(n => { if (n.bname !== undefined) good[n.bname] = 1; });
      termPads.forEach(tp => { if (bnet[tp] === undefined) viol.push('Klemmenpin ' + tp + ' ist nirgends angeschlossen'); else if (!good[bnet[tp]]) viol.push('Klemmenpin ' + tp + ' hängt an keinem Netz der Schaltung'); });
      if (!best || viol.length < best.viol.length) best = { viol: viol, nets: ex.nets, combo: variant, bnet: bnet, termPads: termPads };
    });
    return best || { viol: ['keine Schaltung'], nets: [], bnet: bnet, termPads: termPads };
  }
  function courtyardRect(board, part) {
    const c = PCB(), fp = c.footprint(part.fp);
    if (!fp || !fp.courtyard) return null;
    const cy = fp.courtyard, xs = [], ys = [];
    [[cy.x, cy.y], [cy.x + cy.w, cy.y], [cy.x, cy.y + cy.h], [cy.x + cy.w, cy.y + cy.h]].forEach(pt => { const q = c.xform(part, pt[0], pt[1]); xs.push(q[0]); ys.push(q[1]); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }
  function checkPcb(data, ctx) {
    const P = P_(ctx), lines = [];
    const sch = need(ctx, 'foerder.sch'), ixs = nlIdx(sch && sch.netlist);
    const board = asBoard(data && data.board);
    if (!board || !ixs.ok || !PCB()) return [L(false, 'Platine oder Schaltplan fehlt, die Platine lässt sich nicht prüfen', 100)];
    const norm = PCB().normalize(board);
    const st = boardStats(norm), eq = boardEquiv(ixs, norm), nParts = arr(norm.parts).length;
    lines.push(L(nParts > 0 && eq.viol.length === 0, 'Netze der Platine identisch zur Netzliste (jeder Pin im richtigen Netz, Klemmen für 24 V, Signale, 5 V)' + (eq.viol.length ? ' – ' + eq.viol[0] + (eq.viol.length > 1 ? ' (+' + (eq.viol.length - 1) + ' weitere)' : '') : ''), 25));
    const needNets = eq.nets.filter(n => n.pads.length >= 2 || n.ext).length;
    lines.push(L(nParts > 0 && st.unrouted === 0 && arr(norm.nets).length >= needNets && needNets > 0, 'Alle Netze verlegt: offene Verbindungen ' + st.unrouted + (arr(norm.nets).length < needNets ? ', es fehlen Netze auf der Platine' : ''), 20));
    lines.push(L(nParts > 0 && st.errs.length === 0, 'DRC ohne Fehler: ' + st.errs.length + ' Fehler' + (st.errs.length ? ' (' + String(st.errs[0].msg).slice(0, 60) + ')' : '') + (nParts ? '' : ' – die Platine ist leer'), 20));
    const clr = norm.rules && fin(+norm.rules.clearance) ? +norm.rules.clearance : 0;
    lines.push(L(nParts > 0 && clr >= P.clearance - 1e-9 && st.errs.length === 0, 'Abstand 24-V-Netze zu 5-V-Logik: Regelabstand ' + fm(clr, 2) + ' mm (verlangt mindestens ' + fm(P.clearance, 1) + ' mm, A) und keine Abstandsverletzung im DRC', 10));
    lines.push(L(fin(norm.w) && fin(norm.h) && norm.w <= P.boardW + 1e-6 && norm.h <= P.boardH + 1e-6 && norm.w >= 30 && norm.h >= 20 && norm.layers >= 1 && norm.layers <= P.layers, 'Maße und Lagen: ' + fm(norm.w, 0) + ' x ' + fm(norm.h, 0) + ' mm, ' + norm.layers + ' Lagen (höchstens ' + P.boardW + ' x ' + P.boardH + ' mm, ' + P.layers + ' Lagen)', 10));
    const rep = isObj(data.report) ? data.report : null, own = boardReport(norm);
    let repOk = !!rep && fin(own.cost);
    if (repOk) repOk = sameVal(+rep.w, norm.w, 0.01) && sameVal(+rep.h, norm.h, 0.01) && +rep.layers === norm.layers && +rep.unrouted === own.unrouted && sameVal(+rep.cost, own.cost, 0.01) && (+rep.bomCount === nParts || +rep.bomCount === arr(PCB().bom(norm)).length);
    lines.push(L(repOk, 'Kosten ' + (fin(own.cost) ? fm(own.cost, 2) + ' €' : '?') + ' berechnet, Kennzahlen im Bericht (Maße, offene Netze, Stückliste) stimmen mit der Platine überein' + (rep ? '' : ' – Bericht fehlt'), 5));
    let testable = 0, nNets = 0;
    const viaNets = {}; arr(norm.vias).forEach(v => { if (v.net) viaNets[v.net] = 1; });
    const probe = {}; arr(norm.parts).forEach(p => { if (isTerm(p) || isTp(p)) PCB().padsOf(norm).forEach(pd => { if (pd.ref === p.ref) probe[pd.id] = 1; }); });
    arr(norm.nets).forEach(n => { if (arr(n.pins).length >= 2 || arr(n.pins).some(pn => probe[pn])) { nNets++; if (viaNets[n.name] || arr(n.pins).some(pn => probe[pn])) testable++; } });
    lines.push(L(nNets > 0 && testable >= 0.9 * nNets, 'Testbarkeit: ' + testable + ' von ' + nNets + ' Netzen haben eine Klemme, einen Prüfpunkt (Bauteil TP…) oder eine Durchkontaktierung (mindestens 90 %)', 10));
    return lines;
  }
  const boardCacheSol = new Map();
  function buildBoard(nlIn, P) {
    const ixs = nlIdx(nlIn), c = PCB();
    const key = hash(JSON.stringify([nlIn, P.boardW, P.boardH, P.layers, P.clearance]));
    if (boardCacheSol.has(key)) return clone(boardCacheSol.get(key));
    const f = ifaceOf(ixs, P), sup = f.sup;
    const mkBoard = () => { const b = c.newBoard({ id: 'foerder', name: 'Interface-Platine Förderanlage', w: P.boardW, h: P.boardH, layers: P.layers }); b.rules.clearance = P.clearance; return b; };
    if (!sup || !f.reg) return clone(mkBoard());
    const nCh = f.channels.length;
    const ext = [['X1', [sup.plusNet, sup.minusNet], '24V', 'TERMINAL_2'], ['X2', [f.regOut, sup.minusNet], '5V', 'TERMINAL_2']];
    f.channels.forEach((ch, i) => ext.push(['X' + (3 + i), [ch.sig, ch.node, sup.minusNet], 'SENSOR' + (i + 1), 'TERMINAL_3']));
    const bps = Object.keys(ixs.parts).map(k => ixs.parts[k]).filter(p => FPMAP[p.kind]);
    const order = ['U1', 'RV1', 'CO1']; f.channels.forEach(ch => { [ch.r1 && ch.r1.ref, ch.r2 && ch.r2.ref, ch.zd.ref, ch.c && ch.c.ref].forEach(r => { if (r) order.push(r); }); });
    bps.sort((a, b) => { const ia = order.indexOf(a.ref), ib = order.indexOf(b.ref); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const tpNets = []; const termNets = {}; ext.forEach(e => e[1].forEach(n => { termNets[n] = 1; }));
    Object.keys(ixs.nets).forEach(nm => { const hasBoardPin = ixs.nets[nm].some(pin => FPMAP[(ixs.parts[pin.split('.')[0]] || {}).kind]); if (hasBoardPin && !termNets[nm] && ixs.nets[nm].filter(pin => FPMAP[(ixs.parts[pin.split('.')[0]] || {}).kind]).length >= 2) tpNets.push(nm); });
    const variants = [{ gap: 3, rot: 0 }, { gap: 4.5, rot: 0 }, { gap: 6, rot: 0 }, { gap: 3, rot: 90 }, { gap: 5, rot: 90 }, { gap: 8, rot: 0 }];
    let last = null;
    for (let vi = 0; vi < variants.length; vi++) {
      const v = variants[vi], board = mkBoard();
      let cx = 8, cy = 8, rowH = 0, n = 0;
      bps.forEach(p => {
        const fpId = fpPick(p.kind), rot = (p.kind === 'R' || p.kind === 'ZD') ? v.rot : 0;
        const probe = { x: 0, y: 0, rot: rot, side: 'top', fp: fpId };
        const cr = courtyardRect(board, probe) || { x0: -3, x1: 3, y0: -3, y1: 3 };
        const w = cr.x1 - cr.x0, h = cr.y1 - cr.y0;
        if (cx + w > P.boardW - 4) { cx = 8; cy += rowH + v.gap; rowH = 0; }
        board.parts.push({ id: 'p' + (++n), ref: p.ref, fp: fpId, x: rd(cx - cr.x0, 2), y: rd(cy - cr.y0, 2), rot: rot, side: 'top', value: p.value });
        cx += w + v.gap; rowH = Math.max(rowH, h);
      });
      const tpY = cy + rowH + v.gap + 2;
      tpNets.forEach((nm, i) => board.parts.push({ id: 'p' + (++n), ref: 'TP' + (i + 1), fp: 'HDR_1x2', x: rd(8 + i * 6, 1), y: rd(Math.min(tpY, P.boardH - 14), 1), rot: 0, side: 'top', value: nm }));
      let tx = 4;
      ext.forEach(e => { const w = e[3] === 'TERMINAL_3' ? 16.5 : 11.5; board.parts.push({ id: 'p' + (++n), ref: e[0], fp: fpExists(e[3]) ? e[3] : 'HDR_1x2', x: rd(tx + w / 2, 1), y: rd(P.boardH - 2.8, 1), rot: 90, side: 'top', value: e[2] }); tx += w + 1.5; });
      const nets = {}, order2 = [];
      const addPad = (name, pad) => { if (name === undefined) return; if (!nets[name]) { nets[name] = []; order2.push(name); } nets[name].push(pad); };
      bps.forEach(p => { const map = FPMAP[p.kind].maps[0]; Object.keys(ixs.parts[p.ref].pins || {}).forEach(pn => { if (map[pn] !== undefined) addPad(netOf(ixs, p.ref, pn), p.ref + '.' + map[pn]); }); });
      ext.forEach(e => e[1].forEach((nm, i) => addPad(nm, e[0] + '.' + (i + 1))));
      tpNets.forEach((nm, i) => addPad(nm, 'TP' + (i + 1) + '.1'));
      board.nets = order2.filter(nm => nets[nm].length >= 2).map(nm => { const o = { name: nm, cls: (isSupply(nm) || nm === sup.plusNet) ? 'power' : 'signal', pins: nets[nm] }; if (nm === sup.plusNet || nm === f.regIn) o.width = 0.4; return o; });
      const r = c.autoroute(board, {});
      const res = r.board || board;
      last = res;
      const st = boardStats(res);
      if (!arr(r.failed).length && st.unrouted === 0 && st.errs.length === 0) break;
    }
    boardCacheSol.set(key, clone(last));
    return clone(last);
  }

  /* ====================================================================== vf7: Interface messen (MessLab) */
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
  function messTruth(ctx, withFault) {
    const P = P_(ctx), sch = need(ctx, 'foerder.sch'), ix = nlIdx(sch && sch.netlist), f = ix.ok ? ifaceOf(ix, P) : null, ch = f && f.channels.find(c => c.ok);
    if (!ch) return null;
    let r1 = ch.r1v, r2 = ch.r2v, c = ch.cv;
    if (withFault && P.fault === 'cWrong') c *= 10;
    if (withFault && P.fault === 'divSwap') { const t = r1; r1 = r2; r2 = t; }
    const vth = P.uSteuer * r2 / (r1 + r2), rth = r1 * r2 / (r1 + r2), vHi = ch.zdOk && fin(ch.vz) && vth > ch.vz ? ch.vz : vth;
    const reg = pickInfo(slotOf(ctx, 'foerder.ds')).reg, vo = reg ? dsVal(dsRow(reg, 'vo'), 'typ') : NaN;
    return { U_5V: fin(vo) ? vo : P.uRef, U_hi: vHi, U_lo: 0, tFilterMs: riseMs(vth, vHi, rth, c), node: ch.node, reg: f.regOut, sig: ch.sig };
  }
  const scaleTo = (v, unit, base) => { const u = String(unit || base); if (u === 'mV' && base === 'V') return v / 1000; if (u === 's' && base === 'ms') return v * 1000; if (u === 'µs' && base === 'ms') return v / 1000; return v; };
  function rowOf(rows, key) { return arr(rows).find(r => isObj(r) && normId(r.id || r.label) === key) || null; }
  function rowVal(r, base) { if (!r) return NaN; const v = fin(r.ist) ? r.ist : numOf(r.ist); return fin(v) ? scaleTo(v, r.unit, base) : NaN; }
  const FIND_RE = {
    cWrong: s => /(kondensator|\bc\d?\b|filter)/.test(s) && /(zu gro|zu hoch|zehn|10 ?x|10-fach|10fach|verzehnfacht|statt|falsch)/.test(s),
    divSwap: s => /(teiler|widerstand|\br\d\b|r1|r2)/.test(s) && /(vertausch|getauscht|verdreht|falsch herum|umgekehrt)/.test(s)
  };
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], rows = arr(data && data.rows), truth = messTruth(ctx, true), design = messTruth(ctx, false), faulty = !!P.fault;
    if (!truth) return [L(false, 'Der Schaltplan der Interface-Schaltung fehlt, die Messwerte lassen sich nicht nachrechnen', 100)];
    const vl = (key, label, t, extra) => { const r = rowOf(rows, key), v = rowVal(r, 'V'), tl = Math.max(0.03 * tol * Math.abs(t), 0.02 * tol); return { ok: !!r && fin(v) && Math.abs(v - t) <= tl, text: label + ': ' + (fin(v) ? 'gemessen ' + fm(v, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(t, 2) + ' V (±' + fm(tl, 2) + ' V)' + (extra || '') }; };
    const u5 = vl('u5v', 'U_5V', truth.U_5V); lines.push(L(u5.ok, u5.text, 15));
    const hiTol = key => { const r = rowOf(rows, key), v = rowVal(r, 'V'), t = key === 'ulo' ? truth.U_lo : truth.U_hi, tl = Math.max(0.05 * tol * Math.abs(t), 0.05 * tol); return { r: r, v: v, t: t, tl: tl, ok: !!r && fin(v) && Math.abs(v - t) <= tl }; };
    const lo = hiTol('ulo'); lines.push(L(lo.ok, 'Pegel Low (Eingang 0 V): ' + (fin(lo.v) ? 'gemessen ' + fm(lo.v, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(lo.t, 2) + ' V (±' + fm(lo.tl, 2) + ' V)', 10));
    if (!faulty) { const hi = hiTol('uhi'); lines.push(L(hi.ok, 'Pegel High (Eingang 24 V): ' + (fin(hi.v) ? 'gemessen ' + fm(hi.v, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(hi.t, 2) + ' V (±' + fm(hi.tl, 2) + ' V)', 10)); }
    else {
      const f = arr(data && data.findings).map(lc).join(' | '), re = FIND_RE[P.fault];
      lines.push(L(re(f), 'Fehler benannt: ' + (P.fault === 'cWrong' ? 'Filterkondensator zehnmal zu groß' : 'Teilerwiderstände vertauscht') + (f ? '' : ' – kein Befund eingetragen'), 25));
    }
    const rv = data && isObj(data.values) && fin(+data.values.tFilterMs) ? +data.values.tFilterMs : rowVal(rowOf(rows, 'tfilterms') || rowOf(rows, 'tfilter'), 'ms');
    lines.push(L(fin(rv) && Math.abs(rv - truth.tFilterMs) <= 0.2 * tol * truth.tFilterMs, 'Anstiegszeit des Eingangsfilters: ' + (fin(rv) ? 'gemessen ' + fm(rv, 2) + ' ms' : 'nicht eingetragen') + ', erwartet ' + fm(truth.tFilterMs, 2) + ' ms (aus der Simulation, ±' + fm(20 * tol, 0) + ' %)', 30));
    const want = [['u5v', 'V'], ['ulo', 'V'], ['tfilterms', 'ms']].concat(faulty ? [] : [['uhi', 'V']]);
    const unitBad = want.filter(w => { const r = rowOf(rows, w[0]) || (w[0] === 'tfilterms' ? rowOf(rows, 'tfilter') : null); return !r || !(String(r.unit || '').trim() === w[1] || (w[1] === 'V' && /^mV$/.test(String(r.unit || '').trim())) || (w[1] === 'ms' && /^(s|µs)$/.test(String(r.unit || '').trim()))); });
    lines.push(L(unitBad.length === 0, 'Einheiten: Spannungen in V (oder mV), Zeit in ms (oder s, µs)' + (unitBad.length ? ' – falsch oder fehlend bei ' + unitBad[0][0] : ''), 10));
    const sch = need(ctx, 'foerder.pcb'), pb = sch && asBoard(sch.board), bnames = {}; arr(pb && pb.nets).forEach(n => { bnames[n.name] = 1; });
    const miss = want.map(w => w[0]).filter(k => { const r = rowOf(rows, k) || (k === 'tfilterms' ? rowOf(rows, 'tfilter') : null); return !r || !fin(rowVal(r, k === 'tfilterms' ? 'ms' : 'V')) || !String(r.instrument || '').trim(); });
    const badTp = rows.filter(r => isObj(r) && r.tp && pb && !bnames[r.tp]);
    lines.push(L(miss.length === 0 && badTp.length === 0, 'Protokoll vollständig: ' + want.length + ' Messzeilen mit Wert und Messgerät, Prüfpunkte liegen auf der Platine' + (miss.length ? ' – fehlt: ' + miss[0] : badTp.length ? ' – Prüfpunkt „' + badTp[0].tp + '“ gibt es auf der Platine nicht' : ''), faulty ? 10 : 25));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), t = messTruth(ctx, true), d = messTruth(ctx, false);
    const mk = (id, label, unit, key, ins, tp) => ({ id: id, label: label, unit: unit, soll: rd(d[key], 3), ist: rd(t[key], 3), tol: 5, instrument: ins, tp: tp });
    const rows = [mk('U_5V', 'Versorgung 5 V', 'V', 'U_5V', 'Multimeter', t.reg), mk('U_hi', 'Pegel High', 'V', 'U_hi', 'Multimeter', t.node), mk('U_lo', 'Pegel Low', 'V', 'U_lo', 'Multimeter', t.node), mk('tFilterMs', 'Anstiegszeit Filter', 'ms', 'tFilterMs', 'Oszilloskop', t.node)];
    const findings = P.fault === 'cWrong' ? ['Der Filterkondensator C1 ist zehnmal zu groß, die Anstiegszeit ist viel zu lang.'] : P.fault === 'divSwap' ? ['Die Widerstände des Spannungsteilers sind vertauscht, die Z-Diode klemmt den Pegel.'] : [];
    return { rows: rows, values: { u5v: rd(t.U_5V, 3), tFilterMs: rd(t.tFilterMs, 3) }, findings: findings };
  }

  /* ====================================================================== vf8: Sortiersteuerung (SPS-Lab) */
  const v_ = a => ({ t: 'var', a: a }), nv_ = a => ({ t: 'var', a: a, neg: true });
  const AND_ = (...i) => ({ t: 'and', in: i }), OR_ = (...i) => ({ t: 'or', in: i });
  const PE_ = a => ({ t: 'edge', a: a, mode: 'P' });
  const TON_ = (id, pt, i) => ({ t: 'fb', fb: 'ton', id: id, pt: pt, in: i });
  const CTU_ = (id, pv, i) => ({ t: 'fb', fb: 'ctu', id: id, pv: pv, in: i });
  const coil_ = a => ({ t: 'coil', a: a }), set_ = a => ({ t: 'set', a: a }), rst_ = a => ({ t: 'reset', a: a });
  const net_ = (id, title, expr, outs) => ({ id: id, title: title, expr: expr, outs: outs || [] });
  const SYM = { 'I0.0': 'S1_Start', 'I0.1': 'S2_Stopp', 'I0.3': 'B2_Metall', 'I0.5': 'B4_Zyl_vorn', 'I0.7': 'S3_NotHalt', 'Q0.0': 'K1_Band', 'Q0.1': 'Y1_Ausschieber', 'Q0.2': 'H1_Betrieb', 'Q0.3': 'H2_Stoerung',
    'M0.0': 'M_Betrieb', 'M0.1': 'M_TeilErkannt', 'M0.2': 'M_Stoerung', 'M0.4': 'M_Ausfahren' };
  /* Zeitgeber T bis zum Ausfahren: T = s / v − (Filterzeit + Sensor-Einschaltzeit) − Zylinder-Vorlauf */
  const tIdeal = (P, vMs, dMs) => P.sWeg / (vMs * 1000) * 1000 - dMs - P.tZylMs;
  function buildProgram(P, T) {
    return { lang: 'kop', symbols: Object.assign({}, SYM), networks: [
      net_('N1', 'Betrieb einschalten (Start, Stopp und Not-Halt in Ruhe, keine Störung)', AND_(v_('I0.0'), v_('I0.1'), v_('I0.7'), nv_('M0.2')), [set_('M0.0')]),
      net_('N2', 'Betrieb ausschalten (Stopp, Not-Halt oder Störung)', OR_(nv_('I0.1'), nv_('I0.7'), v_('M0.2')), [rst_('M0.0'), rst_('M0.1')]),
      net_('N3', 'Bandmotor', v_('M0.0'), [coil_('Q0.0')]),
      net_('N4', 'Lampe Betrieb', AND_(v_('M0.0'), nv_('M0.2')), [coil_('Q0.2')]),
      net_('N5', 'Metallteil erkannt (steigende Flanke)', AND_(PE_('I0.3'), v_('M0.0')), [set_('M0.1')]),
      net_('N6', 'Wartezeit T bis das Teil vor dem Ausschieber ist', TON_('T1', T, v_('M0.1')), []),
      net_('N7', 'Ausschieber ausfahren', v_('T1.Q'), [set_('M0.4'), rst_('M0.1')]),
      net_('N8', 'vordere Endlage erreicht: wieder einfahren', v_('I0.5'), [rst_('M0.4')]),
      net_('N9', 'Ausschieber Y1', v_('M0.4'), [coil_('Q0.1')]),
      net_('N10', 'Zählung der ausgeschobenen Teile', CTU_('C1', 999, v_('I0.5')), []),
      net_('N11', 'Überwachung: Ausschieber kommt nicht vorn an', TON_('T2', 1500, AND_(v_('M0.4'), nv_('I0.5'))), [set_('M0.2')]),
      net_('N12', 'Störung quittieren (Stopp drücken)', nv_('I0.1'), [rst_('M0.2')]),
      net_('N13', 'bei Störung Ausschieber stoppen', v_('M0.2'), [rst_('M0.4')]),
      net_('N14', 'Lampe Störung', v_('M0.2'), [coil_('Q0.3')])
    ] };
  }
  let supportsBelt = null;
  function plantSupportsBelt() {
    if (supportsBelt !== null) return supportsBelt;
    try { const p = PLANTS().create('foerderband', { seed: 1, beltMmS: 200 }); supportsBelt = !!(p.state() && p.state().beltMmS === 200); } catch (e) { supportsBelt = false; }
    return supportsBelt;
  }
  const effBelt = mmS => (plantSupportsBelt() ? clamp(mmS, 10, 600) : 80);
  const press = (key, t0, dur, rest) => { let a = false, b = false; return (t, p) => { if (!a && t >= t0) { a = true; p.setInput(key, !rest); } if (a && !b && t >= t0 + dur) { b = true; p.setInput(key, !!rest); } }; };
  const chain = (...f) => (t, p) => f.forEach(x => x(t, p));
  /* Anlage + SPS im 10-ms-Zyklus; der Sensor-Eingang I0.3 erreicht die SPS um delayMs (Sensor + Filter) verzögert */
  function runFb(prog, o) {
    const plant = PLANTS().create('foerderband', { seed: o.seed || 1, scenario: o.scen || 'zufall', beltMmS: effBelt(o.beltMmS || 80) }), plc = SPS().create(clone(prog));
    const qk = plant.io.outputs.map(x => x.key), dly = Math.round((o.delayMs || 0) / 10), buf = [], out = {}, rec = [];
    for (let t = 0; t < o.ms; t += 10) {
      if (o.drive) o.drive(t, plant);
      const inp = plant.readInputs();
      buf.push(inp['I0.3']); inp['I0.3'] = buf.length > dly ? buf[buf.length - 1 - dly] : false;
      if (o.mask) for (const k in o.mask) inp[k] = o.mask[k];
      for (const k in inp) plc.setInput(k, inp[k]);
      plc.scan(10);
      for (let i = 0; i < qk.length; i++) out[qk[i]] = plc.getOutput(qk[i]);
      plant.writeOutputs(out);
      plant.step(10);
      rec.push([t, out['Q0.0'] ? 1 : 0, out['Q0.1'] ? 1 : 0, out['Q0.2'] ? 1 : 0, out['Q0.3'] ? 1 : 0]);
      if (o.sample && t % 1000 === 0) o.sample(t, plant.state(), out);
    }
    return { rec: rec, st: plant.state(), C: plc.state().C };
  }
  const firstT = (rec, f, from) => { const r = rec.find(x => x[0] >= (from || 0) && f(x)); return r ? r[0] : NaN; };
  function walkTons(prog) {
    const pts = [];
    const w = e => { if (!isObj(e)) return; if (e.t === 'fb' && (e.fb === 'ton' || e.fb === 'tof' || e.fb === 'tp') && fin(+e.pt)) pts.push(+e.pt); arr(e.in).forEach(w); if (isObj(e.in)) w(e.in); };
    arr(prog && prog.networks).forEach(n => w(n.expr));
    return pts;
  }
  /* Anlagenwerte aus den Vorstationen: Bandgeschwindigkeit, Sensor- und Filterverzögerung */
  function spsContext(ctx) {
    const P = P_(ctx), an = antDerive(need(ctx, 'foerder.ant'), ctx), sd = senDerive(need(ctx, 'foerder.sen'), ctx);
    let tf = NaN; const ms = slotOf(ctx, 'foerder.mess') || need(ctx, 'foerder.mess');
    if (ms) tf = isObj(ms.values) && fin(+ms.values.tFilterMs) ? +ms.values.tFilterMs : rowVal(rowOf(arr(ms.rows), 'tfilterms') || rowOf(arr(ms.rows), 'tfilter'), 'ms');
    const v = an.ok && fin(an.vMs) && an.vMs > 0.01 && an.vMs < 2 ? an.vMs : P.vSoll;
    return { vMs: v, tFilterMs: fin(tf) ? tf : 0, tOnMs: sd && sd.ok ? sd.tOnMs : 0.5, antOk: an.ok, filterOk: fin(tf) };
  }
  const spsCache = new Map();
  function spsRuns(prog, ctx) {
    const P = P_(ctx), c = spsContext(ctx), delay = c.tFilterMs + c.tOnMs, beltMmS = c.vMs * 1000;
    const key = hash(JSON.stringify([prog, rd(beltMmS, 2), rd(delay, 2), plantSupportsBelt()]));
    if (spsCache.has(key)) return spsCache.get(key);
    const base = { beltMmS: beltMmS, delayMs: delay }, R = { ctx: c, delay: delay };
    const start = () => press('I0.0', 300, 200);
    R.s1 = [1, 2].map(seed => runFb(prog, Object.assign({ seed: seed, scen: 'zufall', ms: 60000, drive: start() }, base)));
    R.nothalt = runFb(prog, Object.assign({ seed: 3, scen: 'zufall', ms: 11000, drive: chain(start(), press('I0.7', 8000, 1500, true)) }, base));
    R.ss = runFb(prog, Object.assign({ seed: 4, scen: 'leer', ms: 6000, drive: chain(press('I0.0', 1000, 200), press('I0.1', 3000, 300, true)) }, base));
    R.stoer = runFb(prog, Object.assign({ seed: 1, scen: 'nur_metall', ms: 20000, drive: start(), mask: { 'I0.5': false } }, base));
    if (spsCache.size > 200) spsCache.clear();
    spsCache.set(key, R);
    return R;
  }
  function checkSps(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], prog = data && data.prog;
    if (!isObj(prog)) return [L(false, 'Kein SPS-Programm übergeben', 100)];
    if (data.plant && data.plant !== 'foerderband') return [L(false, 'Das Programm gehört zur Anlage „' + data.plant + '“, verlangt ist das Förderband', 100)];
    let val = { ok: false, errors: ['SPS_CORE fehlt'] };
    try { val = SPS().validate(prog); } catch (e) { val = { ok: false, errors: [String(e && e.message || e)] }; }
    let plc = null; try { plc = SPS().create(clone(prog)); } catch (e) { plc = null; }
    const comp = !!(val && val.ok && plc && plc.ok);
    lines.push(L(comp, 'Programm lässt sich übersetzen (SPS_CORE.validate)' + (comp ? '' : ' – ' + String((val && val.errors && val.errors[0]) || (plc && plc.errorList && plc.errorList[0]) || 'Fehler')), 5));
    if (!comp) { lines.push(L(false, 'Szenarien nicht ausführbar, solange das Programm Fehler hat', 95)); return lines; }
    const R = spsRuns(prog, ctx), c = R.ctx;
    let sortedM = 0, doneM = 0, light = 0, lost = 0, crash = false, q3 = false;
    R.s1.forEach(r => { sortedM += r.st.sortedMetal; doneM += r.st.sortedMetal + r.st.deliveredMetal; light += r.st.sortedLight; lost += r.st.lost; crash = crash || r.st.crash; if (r.rec.some(x => x[4])) q3 = true; });
    const ratio = doneM > 0 ? sortedM / doneM : 0;
    lines.push(L(doneM >= 3 && ratio >= 0.95 && light === 0, 'Sortierung in 2 x 60 s bei ' + fm(c.vMs, 2) + ' m/s: ' + sortedM + ' von ' + doneM + ' Metallteilen ausgeschoben (' + fm(ratio * 100, 0) + ' %, verlangt mindestens 95 %), ' + light + ' helle Teile fälschlich ausgeschoben' + (doneM < 3 ? ' – es kamen zu wenige Metallteile an den Ausschieber (Band läuft nicht?)' : ''), 30));
    lines.push(L(doneM >= 3 && lost === 0 && !crash, 'Keine Verluste und kein Crash: verloren ' + lost + ', Crash ' + (crash ? 'ja (Ausschieber gegen Werkstück)' : 'nein'), 15));
    const nh = R.nothalt.rec, tOn = firstT(nh, r => r[1] === 1, 0), tOff = firstT(nh, r => r[1] === 0, 8000), tStop = fin(tOff) ? tOff - 8000 : NaN, bandAfter = nh.filter(r => r[0] >= 9600 && r[1] === 1).length;
    lines.push(L(fin(tOn) && fin(tStop) && tStop <= P.cycleMs && bandAfter === 0, 'Not-Halt: das Band steht ' + (fin(tStop) ? fm(tStop, 0) + ' ms' : 'nie') + ' nach dem Drücken (höchstens ein Zyklus, ' + P.cycleMs + ' ms), nach dem Loslassen kein Wiederanlauf ohne Start' + (bandAfter ? ' – das Band lief wieder an' : ''), 15));
    const ss = R.ss.rec, at = t => ss.find(r => r[0] === t) || [0, 0, 0, 0, 0];
    const ssOk = at(500)[1] === 0 && at(500)[3] === 0 && at(2000)[1] === 1 && at(2000)[3] === 1 && at(4000)[1] === 0 && at(4000)[3] === 0 && at(5900)[1] === 0;
    lines.push(L(ssOk, 'Start und Stopp: aus, nach Start läuft das Band mit Lampe Betrieb, nach Stopp sind Band und Lampe aus und bleiben es' + (ssOk ? '' : ' – vor Start ' + (at(500)[1] ? 'läuft das Band' : 'aus') + ', nach Start ' + (at(2000)[1] ? 'läuft es' : 'steht es') + ', nach Stopp ' + (at(4000)[1] ? 'läuft es weiter' : 'steht es')), 10));
    const st = R.stoer.rec, tq1 = firstT(st, r => r[2] === 1, 0), tq3 = firstT(st, r => r[4] === 1, 0);
    lines.push(L(fin(tq1) && fin(tq3) && tq3 - tq1 <= 3000 && !q3, 'Störlampe: Meldet der Ausschieber nicht „vorn“, leuchtet Q0.3 ' + (fin(tq3) && fin(tq1) ? fm((tq3 - tq1) / 1000, 1) + ' s nach dem Ausfahren' : 'nie') + ' (verlangt höchstens 3 s), im Normalbetrieb bleibt sie aus' + (q3 ? ' – sie leuchtete im Normalbetrieb' : ''), 10));
    const cnt = R.s1.every(r => r.st.sortedMetal > 0 && Object.keys(r.C).some(k => r.C[k].cv === r.st.sortedMetal));
    lines.push(L(cnt, 'Zählung: ein Zähler zeigt die Zahl der ausgeschobenen Metallteile (' + R.s1.map(r => r.st.sortedMetal).join(' und ') + ')' + (cnt ? '' : ' – kein Zähler stimmt mit der Zahl der ausgeschobenen Teile überein'), 5));
    const T = tIdeal(P, c.vMs, R.delay), pts = walkTons(prog), w = 0.5 * P.lWerk / c.vMs * tol;
    const gra = lc(prog.lang) === 'gra';
    lines.push(L(gra ? ratio >= 0.95 && doneM >= 3 : pts.some(x => Math.abs(x - T) <= w), 'Zeitgeber T = s / v − Filterzeit − Sensorzeit − Zylindervorlauf = ' + fm(P.sWeg / c.vMs, 0) + ' ms − ' + fm(R.delay, 1) + ' ms − ' + P.tZylMs + ' ms = ' + fm(T, 0) + ' ms (±' + fm(w, 0) + ' ms), im Programm ' + (gra ? '(GRAFCET: am Verhalten geprüft)' : pts.length ? pts.map(x => fm(x, 0)).join(', ') + ' ms' : 'kein Zeitglied'), 10));
    return lines;
  }
  /* Anlagenprotokoll sps.log: 120 s mit Stillstand (Stopp) im Lauf; je Sekunde eine Zeile */
  function makeLog(prog, ctx) {
    const P = P_(ctx), c = spsContext(ctx), rows = [], delay = c.tFilterMs + c.tOnMs;
    const key = hash(JSON.stringify(['log', prog, rd(c.vMs, 4), rd(delay, 2), P.pauseStart, P.pauseDur, plantSupportsBelt()]));
    if (makeLog.cache && makeLog.cache[key]) return makeLog.cache[key];
    let last = null;
    const r = runFb(prog, { seed: 5, scen: 'zufall', ms: 121000, beltMmS: c.vMs * 1000, delayMs: delay, drive: chain(press('I0.0', 1000, 200), press('I0.1', P.pauseStart * 1000, 300, true), press('I0.0', (P.pauseStart + P.pauseDur) * 1000, 200)),
      sample: (t, s, out) => { if (t >= 1000 && t % 1000 === 0 && t <= 120000) rows.push({ t: t / 1000, band: out['Q0.0'] ? 1 : 0, stoerung: out['Q0.3'] ? 1 : 0, hell: s.deliveredLight, metall_aus: s.sortedMetal, hell_aus: s.sortedLight, metall_durch: s.deliveredMetal, verloren: s.lost }); } });
    last = rows[rows.length - 1] || {};
    const log = { plant: 'foerderband', seed: 5, dtMs: 1000, series: rows.map(x => Object.assign({}, x, { t: x.t * 1000 })), counters: { spawned: r.st.spawned, sorted: r.st.sorted, delivered: r.st.delivered, lost: r.st.lost, crash: r.st.crash ? 1 : 0 }, rows: rows };
    if (!makeLog.cache) makeLog.cache = {};
    if (Object.keys(makeLog.cache).length > 100) makeLog.cache = {};
    makeLog.cache[key] = log;
    return log;
  }
  function logStats(rows) {
    const n = rows.length, last = n ? rows[n - 1] : { t: 0, hell: 0, metall_aus: 0, hell_aus: 0, metall_durch: 0, verloren: 0 };
    const teile = last.hell + last.metall_aus + last.hell_aus + last.metall_durch, fehler = last.hell_aus + last.metall_durch + last.verloren, minuten = last.t / 60;
    return { TEILE_GESAMT: teile, DURCHSATZ: minuten > 0 ? teile / minuten : 0, AUSSCHUSS_PROZENT: teile + last.verloren > 0 ? 100 * fehler / (teile + last.verloren) : 0, VERFUEGBARKEIT_PROZENT: n ? 100 * rows.filter(r => r.band === 1 && r.stoerung === 0).length / n : 0 };
  }

  /* ====================================================================== vf9: Produktionsstatistik (Pi-Lab) */
  const PY_SRC = [
    '# Produktionsstatistik der Sortieranlage (Pi-Lab)',
    '# Die Station setzt in der nächsten Zeile das Anlagenprotokoll ein: eine Zeile je Sekunde mit',
    "# t (s), band, stoerung (0/1), hell, metall_aus, hell_aus, metall_durch, verloren (aufsummiert)",
    'daten = []',
    'n = len(daten)',
    'laufend = 0',
    'for z in daten:',
    "    if z['band'] == 1 and z['stoerung'] == 0:",
    '        laufend = laufend + 1',
    'teile = 0',
    'fehler = 0',
    'verloren = 0',
    'minuten = 0',
    'if n > 0:',
    '    letzte = daten[n - 1]',
    "    teile = letzte['hell'] + letzte['metall_aus'] + letzte['hell_aus'] + letzte['metall_durch']",
    "    verloren = letzte['verloren']",
    "    fehler = letzte['hell_aus'] + letzte['metall_durch'] + verloren",
    "    minuten = letzte['t'] / 60",
    'durchsatz = 0',
    'if minuten > 0:',
    '    durchsatz = teile / minuten',
    'ausschuss = 0',
    'if teile + verloren > 0:',
    '    ausschuss = 100 * fehler / (teile + verloren)',
    'verfuegbar = 0',
    'if n > 0:',
    '    verfuegbar = 100 * laufend / n',
    "print('TEILE_GESAMT=' + str(teile))",
    "print('DURCHSATZ=' + str(round(durchsatz, 2)))",
    "print('AUSSCHUSS_PROZENT=' + str(round(ausschuss, 2)))",
    "print('VERFUEGBARKEIT_PROZENT=' + str(round(verfuegbar, 2)))"
  ].join('\n');
  function piRun(src, ctx) {
    const sps = need(ctx, 'foerder.sps'), log = sps && isObj(sps.prog) ? makeLog(sps.prog, ctx) : { rows: [] };
    return { run: runPy(String(src == null ? '' : src), { daten: log.rows }, { T: 30, mustFinish: true }), stats: logStats(log.rows), rows: log.rows };
  }
  function checkPi(data, ctx) {
    const lines = [], src = isObj(data) && typeof data.src === 'string' ? data.src : '';
    if (!src.trim()) return [L(false, 'Kein Python-Programm übergeben', 100)];
    const o = piRun(src, ctx), kv = o.run.kv || {}, ex = o.stats;
    const fmtOk = o.run.ok && ['TEILE_GESAMT', 'DURCHSATZ', 'AUSSCHUSS_PROZENT', 'VERFUEGBARKEIT_PROZENT'].every(k => fin(kv[k]));
    const near = (v, t, rel, abs) => fin(v) && Math.abs(v - t) <= Math.max(rel * Math.abs(t), abs);
    lines.push(L(near(kv.DURCHSATZ, ex.DURCHSATZ, 0.01, 0.01), 'DURCHSATZ (Teile je Minute): ' + (fin(kv.DURCHSATZ) ? fm(kv.DURCHSATZ, 2) : 'nicht ausgegeben') + ', erwartet ' + fm(ex.DURCHSATZ, 2), 20));
    lines.push(L(near(kv.AUSSCHUSS_PROZENT, ex.AUSSCHUSS_PROZENT, 0.01, 0.05), 'AUSSCHUSS_PROZENT: ' + (fin(kv.AUSSCHUSS_PROZENT) ? fm(kv.AUSSCHUSS_PROZENT, 2) : 'nicht ausgegeben') + ', erwartet ' + fm(ex.AUSSCHUSS_PROZENT, 2) + ' (falsch sortiert oder verloren, bezogen auf alle Teile)', 20));
    lines.push(L(near(kv.VERFUEGBARKEIT_PROZENT, ex.VERFUEGBARKEIT_PROZENT, 0.01, 0.1), 'VERFUEGBARKEIT_PROZENT: ' + (fin(kv.VERFUEGBARKEIT_PROZENT) ? fm(kv.VERFUEGBARKEIT_PROZENT, 2) : 'nicht ausgegeben') + ', erwartet ' + fm(ex.VERFUEGBARKEIT_PROZENT, 2) + ' (Anteil der Sekunden mit laufendem Band ohne Störung)', 20));
    lines.push(L(near(kv.TEILE_GESAMT, ex.TEILE_GESAMT, 0, 0), 'TEILE_GESAMT: ' + (fin(kv.TEILE_GESAMT) ? fm(kv.TEILE_GESAMT, 0) : 'nicht ausgegeben') + ', erwartet ' + fm(ex.TEILE_GESAMT, 0) + ' (ausgeschoben plus durchgelaufen)', 20));
    lines.push(L(fmtOk, 'Format: vier Zeilen SCHLÜSSEL=Zahl, das Programm läuft ohne Fehler' + (o.run.ok ? '' : ' – ' + String(o.run.error || 'Fehler').slice(0, 90)), 20));
    return lines;
  }

  /* ====================================================================== vf10: Fachgespräch (Prüfungs-Lab) */
  function regPnom(P, reg, rV, iTot) {        // Reglerverlust bei Nennspannung 24 V
    const iq = dsVal(dsRow(reg, 'iq'), 'typ') || 0.005, vin = P.uSteuer - (iTot + iq) * (rV || 0);
    return (vin - P.uRef) * iTot + vin * iq;
  }
  function quizTruth(ctx) {
    const P = P_(ctx), an = antDerive(need(ctx, 'foerder.ant'), ctx), c = spsContext(ctx), pi = pickInfo(need(ctx, 'foerder.ds')), iTot = regLoad(P, ctx);
    const sps = need(ctx, 'foerder.sps'), st = sps && isObj(sps.prog) ? logStats(makeLog(sps.prog, ctx).rows) : { DURCHSATZ: NaN };
    return { q1: an.ok ? an.vMs : NaN, q2: c.vMs / ((P.lWerk + P.lLuecke) / 1000), q3: tIdeal(P, c.vMs, c.tFilterMs + c.tOnMs), q4: pi.reg ? regPnom(P, pi.reg, pi.rV, iTot) : NaN, q5: st.DURCHSATZ, q6: an.ok ? an.iN : NaN };
  }
  const QUESTIONS = [
    ['q1', 'Bandgeschwindigkeit deines Antriebs', 'm/s', 3], ['q2', 'geforderte Schaltfrequenz f_req = v / (l + Lücke)', 'Hz', 2], ['q3', 'Wartezeit T des Ausschiebers (mit deiner Filterzeit)', 'ms', 0],
    ['q4', 'Verlustleistung deines 5-V-Reglers bei 24 V', 'W', 2], ['q5', 'Durchsatz der Anlage laut Protokoll', 'Teile/min', 2], ['q6', 'Nennstrom deines Motors', 'A', 2]
  ];
  function checkPr(data, ctx) {
    const tol = TOL(ctx), lines = [], tr = quizTruth(ctx), ans = isObj(data && data.answers) ? data.answers : {};
    QUESTIONS.forEach(q => {
      const a = numOf(ans[q[0]]), t = tr[q[0]], tl = 0.02 * tol;
      lines.push(L(fin(a) && fin(t) && Math.abs(a - t) <= tl * Math.abs(t), 'Frage ' + q[0].slice(1) + ' (' + q[1] + '): ' + (fin(a) ? 'deine Antwort ' + fm(a, q[3] + 1) + ' ' + q[2] : 'keine Antwort') + ', richtig ' + fm(t, q[3] + 1) + ' ' + q[2] + ' (±' + fm(2 * tol, 1) + ' %)', 16));
    });
    const full = QUESTIONS.every(q => fin(numOf(ans[q[0]])));
    lines.push(L(full, 'Vollständigkeit: alle sechs Fragen beantwortet', 4));
    return lines;
  }
  /* Parametrierte Fragetexte mit den eigenen Zahlen (für den Prüfungs-Adapter, station.questions); ohne Daten die allgemeinen Texte */
  function questionList(ctx) {
    const P = P_(ctx), tol = TOL(ctx);
    let tr = {}, tx = {};
    try {
      tr = quizTruth(ctx);
      const an = antDerive(need(ctx, 'foerder.ant'), ctx), c = spsContext(ctx), pi = pickInfo(need(ctx, 'foerder.ds')), iTot = regLoad(P, ctx), sps = need(ctx, 'foerder.sps'), st = sps && isObj(sps.prog) ? logStats(makeLog(sps.prog, ctx).rows) : { TEILE_GESAMT: NaN };
      const iq = pi.reg ? (dsVal(dsRow(pi.reg, 'iq'), 'typ') || 0.005) : 0.005;
      tx = {
        q1: 'Dein Getriebe hat die Übersetzung i = ' + fm(an.ratio, 1) + ', der Motor dreht mit ' + fm(an.rpm, 0) + ' 1/min, die Antriebsrolle hat ' + fm(P.dRolle * 1000, 0) + ' mm Durchmesser. Wie schnell läuft das Band?',
        q2: 'Das Band läuft mit ' + fm(c.vMs, 3) + ' m/s, die Werkstücke sind ' + P.lWerk + ' mm lang, die Lücke beträgt ' + P.lLuecke + ' mm. Welche Schaltfrequenz muss dein Sensor mindestens schaffen?',
        q3: 'Von der Erkennung am Sensor bis zur Mitte des Ausschiebers sind es ' + P.sWeg + ' mm, das Band läuft mit ' + fm(c.vMs, 3) + ' m/s, Sensor und Filter verzögern um ' + fm(c.tFilterMs + c.tOnMs, 1) + ' ms und der Zylinder braucht ' + P.tZylMs + ' ms bis zum Werkstück. Wie lang ist die Wartezeit T?',
        q4: 'Dein 5-V-Zweig nimmt ' + fm(iTot * 1000, 0) + ' mA auf, dein Vorwiderstand hat ' + (pi.rV > 0 ? fmtRde(pi.rV) + ' Ω' : '0 Ω') + ', die Versorgung liefert ' + P.uSteuer + ' V und der Regler braucht ' + fm(iq * 1000, 0) + ' mA Ruhestrom. Wie viel Leistung wandelt der Regler in Wärme um?',
        q5: 'Im Anlagenprotokoll stehen ' + fm(st.TEILE_GESAMT, 0) + ' verarbeitete Teile in 2 Minuten (120 Zeilen). Wie viele Teile sind das je Minute?',
        q6: 'Welchen Nennstrom hat dein 0,55-kW-Motor am ' + P.uNetz + '-V-Netz in Dreieckschaltung (Typenschild)?'
      };
    } catch (e) { tx = {}; }
    return QUESTIONS.map(q => ({ id: q[0], q: tx[q[0]] || (q[1] + '?'), type: 'num', unit: q[2], ans: fin(tr[q[0]]) ? sig4(tr[q[0]]) : null, tol: 0.02 * tol, w: 16 }));
  }
  const sig4 = x => (fin(x) ? +x.toPrecision(5) : x);
  function prSolution(ctx) { const t = quizTruth(ctx), a = {}; QUESTIONS.forEach(q => { a[q[0]] = sig4(t[q[0]]); }); return { answers: a, n: 6 }; }

  /* ====================================================================== vfF: Abschlusstest (Gesamtsystem) */
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = { 1: 1.5, 2: 1, 3: 0.6 }[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => slotOf(ctx, k), lines = [], kpis = [];
    const ant = g('foerder.ant'), sim = g('foerder.sim'), sen = g('foerder.sen'), pk = g('foerder.ds'), sch = g('foerder.sch'), pcb = g('foerder.pcb'), mess = g('foerder.mess'), sps = g('foerder.sps'), pyd = g('foerder.pi');
    const an = antDerive(ant, ctx), sd = sen ? senDerive(sen, ctx) : { ok: false }, c = spsContext(ctx);
    // 1: Gesamtlauf 120 s
    const progOk = isObj(sps) && isObj(sps.prog) && SPS() && (() => { try { return !!SPS().create(clone(sps.prog)).ok; } catch (e) { return false; } })();
    let durch = NaN, auss = NaN, stopMs = NaN;
    if (progOk && an.ok) {
      const delay = c.tFilterMs + c.tOnMs, r = runFb(sps.prog, { seed: 11, scen: 'zufall', ms: 120000, beltMmS: c.vMs * 1000, delayMs: delay, drive: press('I0.0', 500, 200) });
      const done = r.st.sorted + r.st.delivered, fehler = r.st.sortedLight + r.st.deliveredMetal + r.st.lost;
      durch = done / 2; auss = done + r.st.lost > 0 ? 100 * fehler / (done + r.st.lost) : 100;
      const nh = runFb(sps.prog, { seed: 12, scen: 'zufall', ms: 4000, beltMmS: c.vMs * 1000, delayMs: delay, drive: chain(press('I0.0', 300, 200), press('I0.7', 2500, 800, true)) });
      const tOff = firstT(nh.rec, r2 => r2[1] === 0, 2500); stopMs = fin(tOff) ? tOff - 2500 : NaN;
    }
    lines.push(L(progOk && an.ok && durch >= P.durchsatzSoll && auss <= 2, 'Gesamtlauf 120 s bei ' + fm(c.vMs, 2) + ' m/s: Durchsatz ' + (fin(durch) ? fm(durch, 1) : '?') + ' Teile/min (Soll mindestens ' + fm(P.durchsatzSoll, 0) + '), Ausschuss ' + (fin(auss) ? fm(auss, 1) : '?') + ' % (höchstens 2 %)' + (progOk ? '' : ' – Programm oder Antrieb nicht auswertbar'), 30));
    // 2: Sensorik
    lines.push(L(sd.ok && an.ok && sd.fMaxHz >= 2 * sd.fReq && sd.kind === 'induktiv', 'Sensorik passt zur Geschwindigkeit: f_max ' + (sd.ok ? fm(sd.fMaxHz, 1) : '?') + ' Hz, f_req ' + (sd.ok ? fm(sd.fReq, 1) : '?') + ' Hz, also Reserve ' + (sd.ok ? fm(sd.fMaxHz / sd.fReq, 0) : '?') + ' (verlangt mindestens 2)', 20));
    // 3: Not-Halt-Simulation der Elektrik
    const ix = nlIdx(sim && sim.netlist), m = ix.ok ? simModel(ix) : { ok: false };
    let nhOk = false, nhTxt = 'Elektrik nicht auswertbar';
    if (m.ok && m.pb.length && m.pbc.length >= 2) {
      const pb = m.pb.map(p => p.ref).sort()[0];
      const res = m.pbc.map(r => simRun(ix, m, [{ press: [pb] }, { press: [] }, { press: [r.ref] }, { press: [] }, { press: [] }]));
      nhOk = res.every(x => x[0].motor && x[1].motor && !x[2].motor && !x[3].motor && !x[4].motor && !x.some(y => y.short));
      nhTxt = nhOk ? 'Start läuft, Not-Halt und Stopp schalten ab, kein Wiederanlauf ohne neuen Start' : 'Motor läuft nicht an, schaltet nicht ab oder läuft ohne Start wieder an';
    }
    lines.push(L(nhOk, 'Elektrik, Not-Halt-Simulation: ' + nhTxt, 20));
    // 4: Interface-Kette (Pegel und Filter <-> SPS-Zeit)
    const tr = messTruth(ctx, true), trOk = tr && fin(c.tFilterMs) && c.filterOk && Math.abs(c.tFilterMs - tr.tFilterMs) <= 0.2 * tolMul * tr.tFilterMs;
    const ixs = nlIdx(sch && sch.netlist), fi = ixs.ok ? ifaceOf(ixs, P) : { channels: [] }, ch0 = fi.channels.find(x => x.ok);
    const levelOk = !!ch0 && ch0.vHi <= 5 && ch0.vHi >= 3.5;
    const T = tIdeal(P, c.vMs, c.tFilterMs + c.tOnMs), pts = isObj(sps) ? walkTons(sps.prog) : [], wT = 0.5 * P.lWerk / c.vMs * tolMul;
    const tOk = lc(isObj(sps) && sps.prog && sps.prog.lang) === 'gra' || pts.some(x => Math.abs(x - T) <= wT);
    lines.push(L(!!trOk && levelOk && tOk, 'Interface-Kette: gemessene Filterzeit ' + (c.filterOk ? fm(c.tFilterMs, 2) : '?') + ' ms (Schaltplan ' + (tr ? fm(tr.tFilterMs, 2) : '?') + ' ms), Pegel ' + (ch0 ? fm(ch0.vHi, 2) : '?') + ' V, Zeitgeber T in der SPS ' + (pts.length ? pts.map(x => fm(x, 0)).join(', ') : '?') + ' ms, passend wären ' + fm(T, 0) + ' ms', 15));
    // 5: Statistik
    let statOk = false, statTxt = 'Python-Programm oder Protokoll fehlt';
    if (isObj(pyd) && typeof pyd.src === 'string' && pyd.src.trim() && progOk) {
      const o = piRun(pyd.src, ctx), kv = o.run.kv || {}, ex = o.stats;
      const nr = (v, t, rel, abs) => fin(v) && Math.abs(v - t) <= Math.max(rel * Math.abs(t), abs);
      statOk = o.run.ok && nr(kv.DURCHSATZ, ex.DURCHSATZ, 0.01, 0.01) && nr(kv.AUSSCHUSS_PROZENT, ex.AUSSCHUSS_PROZENT, 0.01, 0.05) && nr(kv.VERFUEGBARKEIT_PROZENT, ex.VERFUEGBARKEIT_PROZENT, 0.01, 0.1) && nr(kv.TEILE_GESAMT, ex.TEILE_GESAMT, 0, 0);
      statTxt = statOk ? 'alle vier Kennzahlen des Protokolls stimmen (Durchsatz ' + fm(ex.DURCHSATZ, 1) + ' Teile/min, Verfügbarkeit ' + fm(ex.VERFUEGBARKEIT_PROZENT, 1) + ' %)' : 'die Auswertung weicht vom Protokoll ab';
    }
    lines.push(L(statOk, 'Statistik: ' + statTxt, 10));
    // 6: Konsistenz
    const pi = pickInfo(pk), board = asBoard(pcb && pcb.board), eq = board && ixs.ok && PCB() ? boardEquiv(ixs, PCB().normalize(board)) : null;
    const rvSch = fi.rv ? numOf(fi.rv.value) : 0, rvOk = pi.ok && (pi.rV > 0 ? sameVal(rvSch, pi.rV, 1e-3) : !fi.rv);
    const beltOk = isObj(sps) && an.ok && (!isObj(sps.opts) || sps.opts.beltMmS === undefined || sps.opts.beltMmS === null || sameVal(+sps.opts.beltMmS, an.vMs * 1000, 0.02));
    lines.push(L(!!eq && eq.viol.length === 0 && rvOk && beltOk && isObj(mess) && arr(mess.rows).length >= 3, 'Konsistenz: Datenblatt-Auswahl = Schaltplan = Platine, Programm läuft mit der Bandgeschwindigkeit des Antriebs (opts.beltMmS)' + (eq && eq.viol.length ? ' – ' + eq.viol[0] : !rvOk ? ' – Vorwiderstand im Schaltplan weicht von der Auswahl ab' : !beltOk ? ' – opts.beltMmS im Programm passt nicht zum Antrieb' : ''), 5));
    // Kennzahlen
    const tjC = pi.ok ? regCalc(P, pi.reg, pi.rV, regLoad(P, ctx)) : null;
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!ok && fin(value) });
    k('bandgeschwindigkeit', 'Bandgeschwindigkeit', an.ok ? an.vMs : NaN, 'm/s', an.ok && Math.abs(an.vMs - P.vSoll) / P.vSoll <= 0.05 * tolMul);
    k('durchsatz', 'Durchsatz', durch, 'Teile/min', fin(durch) && durch >= P.durchsatzSoll);
    k('ausschuss', 'Ausschuss', auss, '%', fin(auss) && auss <= 2);
    k('motorlast', 'Motorauslastung', an.ok ? 100 * an.iLine / an.iN : NaN, '%', an.ok && an.iLine <= an.iN);
    k('frequenzreserve', 'Schaltfrequenz-Reserve', sd.ok ? sd.fMaxHz / sd.fReq : NaN, 'fach', sd.ok && sd.fMaxHz >= 2 * sd.fReq);
    k('reglertemp', 'Reglertemperatur', tjC ? tjC.tj : NaN, '°C', !!tjC && tjC.tj <= tjC.tjMax);
    k('nothalt', 'Not-Halt-Stoppweg', an.ok && fin(stopMs) ? an.vMs * (stopMs + 30) : NaN, 'mm', fin(stopMs) && stopMs <= P.cycleMs);
    return { lines: lines, kpis: kpis };
  }

  /* ====================================================================== Stationen */
  const STATIONS = [
    { id: 'vf1', lab: 'vb', cat: 'Förderanlage', title: 'Bandantrieb auslegen', level: 3,
      on: 'ant',
      text: 'Das Förderband wird von einem Drehstrommotor am Netz getrieben, dahinter sitzt ein zweistufiges Stirnradgetriebe. Wähle die Schaltung des Motors und die Zähnezahlen so, dass das Band mit der Soll-Geschwindigkeit aus dem Lastenheft läuft. Prüfe, dass der Motor beim Lastmoment im Nennbereich bleibt, und trage Nennstrom, Drehzahl und Bandgeschwindigkeit ein.',
      in: [], out: 'foerder.ant', type: 'ant.setup', w: 100, pass: null,
      open: { ex: 'Bandantrieb', rig: 'drehstrom' },
      hint: ['Die Bandgeschwindigkeit folgt aus der Drehzahl der Antriebsrolle: v = π · d · n / 60. Die Rollendrehzahl ist die Motordrehzahl geteilt durch die Übersetzung i.',
        'Die Übersetzung ist i = z2/z1 · z4/z3. Die Motordrehzahl liegt knapp unter der Synchrondrehzahl von 1500 1/min, weil der Schlupf klein bleibt. Rechne die nötige Übersetzung aus der Soll-Geschwindigkeit aus.',
        'Das Typenschild 400/690 V heißt: am 400-V-Netz läuft der Motor in Dreieck. Suche Zähnezahlen zwischen 8 und 80, deren Übersetzung zur Soll-Geschwindigkeit passt, und lies Nennstrom und Drehzahl aus der Simulation ab.'],
      check: safe(checkAnt, 'Antrieb'),
      starter: ctx => ({ rig: 'drehstrom', preset: 'm055', ctl: { source: 'netz', connection: 'stern' }, gear: { type: 'stirnrad', stages: 2, z1: 20, z2: 20, z3: 20, z4: 20 }, state: {}, derived: {} }),
      solution: ctx => antSolution(ctx),
      mutants: [
        { name: 'Übersetzung viel zu klein', mutate: d => { d.gear.z1 = 40; d.gear.z2 = 20; d.gear.z3 = 40; d.gear.z4 = 20; return d; }, expectFail: ['Bandgeschwindigkeit'] },
        { name: 'Stern statt Dreieck', mutate: d => { d.ctl.connection = 'stern'; return d; }, expectFail: ['Schaltung'] },
        { name: 'Zähnezahl nicht ganzzahlig', mutate: d => { d.gear.z2 = d.gear.z2 + 0.5; return d; }, expectFail: ['Getriebe'] },
        { name: 'Kennwerte fehlen im Slot', mutate: d => { d.derived = {}; d.state = {}; return d; }, expectFail: ['Kennwerte im Slot'] },
        { name: 'falscher Motor (1,5 kW)', mutate: d => { d.preset = 'm15'; return d; }, expectFail: ['Schaltung'] }
      ] },

    { id: 'vf2', lab: 'vb', cat: 'Förderanlage', title: 'Motorschaltung mit Not-Halt', level: 3,
      on: 'sim',
      text: 'Schalte den Bandmotor: Im Hauptstromkreis liegen Sicherungsautomaten, Schütz und Motor, der Motor bekommt den Schutzleiter. Im Steuerstromkreis hält sich das Schütz selbst, Stopp und Not-Halt sind Öffner in Reihe, eine Meldeleuchte zeigt den Lauf. Wähle das Schutzorgan nach dem Nennstrom deines Motors aus der Antriebsstation.',
      in: ['foerder.ant'], out: 'foerder.sim', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Selbsthaltung (Start und Stopp)' },
      hint: ['Der Sicherungsautomat muss mindestens den Nennstrom des Motors tragen, darf aber nicht viel größer sein (höchstens das Doppelte, A). Je Außenleiter ein Pol.',
        'Das Schütz im Lab hat nur drei Schließer, und die braucht der Motor. Nimm für die Selbsthaltung ein zweites Schütz, dessen Spule parallel liegt. Stopp und Not-Halt sind Öffner und liegen in Reihe vor dem Start-Taster.',
        'Steuerkreis: L1, Not-Halt, Stopp, dann der Start-Taster parallel zum Hilfskontakt des zweiten Schützes, danach die Spulen nach N. Die Meldeleuchte liegt parallel zur Spule. Verbinde den PE des Motors mit dem PE des Drehstromnetzes.'],
      check: safe(checkSim, 'Motorschaltung'),
      starter: ctx => { const b = nlBuilder('neu'); b.add('X1', 'NETZ3', '400V', { L1: 'L1', L2: 'L2', L3: 'L3', N: 'N', PE: 'PE' }); return { lab: 'sim', name: 'neu', netlist: b.done(), meas: {}, snap: {} }; },
      solution: ctx => buildSim(P_(ctx), ctx),
      mutants: [
        { name: 'Selbsthaltung fehlt', mutate: d => { movePin(d.netlist, 'K2.K1a', 'N_X'); return d; }, expectFail: ['Simulation'] },
        { name: 'Stopp als Schließer', mutate: d => { setPart(d.netlist, 'S2', p => { p.kind = 'PB'; }); return d; }, expectFail: ['Steuerstromkreis', 'Simulation'] },
        { name: 'Schutzorgan viel zu groß', mutate: d => { ['F1', 'F2', 'F3'].forEach(r => setPart(d.netlist, r, p => { p.value = 'B16'; })); return d; }, expectFail: ['Schutzorgan'] },
        { name: 'Schutzleiter am Motor fehlt', mutate: d => { dropPin(d.netlist, 'M1.PE'); return d; }, expectFail: ['Schutzleiter'] },
        { name: 'zwei Motorklemmen an derselben Phase', mutate: d => { movePin(d.netlist, 'K1.K3a', 'F1a'); return d; }, expectFail: ['Hauptstromkreis'] },
        { name: 'Not-Halt überbrückt', mutate: d => { movePin(d.netlist, 'S2.1', 'L1'); return d; }, expectFail: ['Steuerstromkreis', 'Simulation'] }
      ] },

    { id: 'vf3', lab: 'vb', cat: 'Förderanlage', title: 'Werkstückerkennung einstellen', level: 2,
      on: 'sen',
      text: 'Die Metallteile sollen von einem induktiven Sensor erkannt werden, die Kunststoffkappen nicht. Wähle die Sensorart, stelle Montageabstand und Entprellzeit ein und prüfe die Schaltfrequenz bei deiner Bandgeschwindigkeit aus der Antriebsstation. Der Sensorausgang ist 24 V PNP: Wähle den Lastwiderstand so, dass der Pegel für die SPS passt, und notiere die Stromaufnahme.',
      in: ['foerder.ant'], out: 'foerder.sen', type: 'sen.chain', w: 100, pass: null,
      open: { ex: 'Induktiv: Stahl bei 5 mm', rig: 'licht', sensor: 'induktiv' },
      hint: ['Ein induktiver Sensor erkennt Metall, aber keinen Kunststoff. Der Werkstoff steht im Lastenheft: Der Reduktionsfaktor bestimmt den Schaltabstand.',
        'Stahl hat den Faktor 1, Aluminium etwa 0,4 und Kupfer etwa 0,3. Montiere mit 20 % Reserve unter dem Schaltabstand, aber mindestens 10 % des Nennschaltabstands vom Teil entfernt.',
        'Die geforderte Schaltfrequenz ist f_req = v / (l + Lücke). Eine große Entprellzeit begrenzt die Schaltfrequenz auf 1 / (2 · Entprellzeit). Nimm einen Lastwiderstand ab 1 kΩ und rechne den Strom: 10 mA Eigenstrom plus Ausgangsstrom.'],
      check: safe(checkSen, 'Sensorik'),
      starter: ctx => ({ rig: 'licht', preset: '', ctl: { sensor: 'ldr', material: 'stahl', dist: 20, rLoad: 100, fdelay: 0 }, state: {}, derived: {} }),
      solution: ctx => senSolution(ctx),
      mutants: [
        { name: 'kapazitiver Sensor', mutate: d => { d.ctl.sensor = 'kapazitiv'; return d; }, expectFail: ['Metall erkannt'] },
        { name: 'Montageabstand 7 mm (zu weit)', mutate: d => { d.ctl.dist = 7; return d; }, expectFail: ['Metall erkannt'] },
        { name: 'Entprellzeit 400 ms', mutate: d => { d.ctl.fdelay = 400; return d; }, expectFail: ['Schaltfrequenz'] },
        { name: 'Lastwiderstand 100 Ω', mutate: d => { d.ctl.rLoad = 100; return d; }, expectFail: ['Versorgung und Ausgang'] },
        { name: 'Sensor direkt am Teil (0,2 mm)', mutate: d => { d.ctl.dist = 0.2; return d; }, expectFail: ['Montageabstand mindestens'] },
        { name: 'falsches Material eingestellt', mutate: d => { d.ctl.material = d.ctl.material === 'stahl' ? 'kupfer' : 'stahl'; return d; }, expectFail: ['Metall erkannt'] }
      ] },

    { id: 'vf4', lab: 'vb', cat: 'Förderanlage', title: 'Regler für die Interface-Platine', level: 2,
      on: 'ds',
      text: 'Die Interface-Platine braucht 5 V, die Anlage liefert 24 V. Wähle in den Übungsdatenblättern einen 5-V-Regler, rechne seine Verlustleistung und seine Sperrschichttemperatur mit dem Strom deiner Sensoren und der Logik. Entscheide, ob er ohne Maßnahme zu heiß wird, und lege einen Vorwiderstand (E12) und seine Nennleistung fest.',
      in: ['foerder.sen'], out: 'foerder.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'regler', label: 'Spannungsregler', type: 'select', options: [{ value: 'tf-7805', label: '7805 (fest 5 V)' }, { value: 'tf-lm317', label: 'LM317 (einstellbar)' }, { value: 'tf-lm358', label: 'LM358 (Operationsverstärker)' }] },
        { key: 'finding', label: 'Ohne Vorwiderstand ist der Regler', type: 'select', options: [{ value: 'heiss', label: 'zu heiß' }, { value: 'ok', label: 'in Ordnung' }] },
        { key: 'rV', label: 'Vorwiderstand R_V', type: 'eseries', unit: 'Ω', hint: 'E12-Reihe' },
        { key: 'pRvW', label: 'Nennleistung des Vorwiderstands', type: 'number', unit: 'W' }
      ],
      fromForm: v => {
        const r = dsOf(v.regler), rv = numOf(v.rV), pr = numOf(v.pRvW);
        return { items: [{ role: 'regler', ds: v.regler, part: r ? r.part : '', ref: r ? r.ref : '' }], calc: {}, vals: { rV: fin(rv) ? rv : null, pRvW: fin(pr) ? pr : null, finding: v.finding || '' } };
      },
      open: { ex: 'Spannungsregler 7805' },
      hint: ['Der Regler verbrennt die Differenz zwischen Eingangs- und Ausgangsspannung: P = (U_ein − 5 V) · I plus U_ein mal Ruhestrom. Der Strom ist die Summe aus deinen Sensorströmen und dem Logikstrom.',
        'Die Sperrschichttemperatur ist T_j = T_Umgebung + P · R_th,JA. Im Datenblatt stehen R_th,JA und die höchste Temperatur. Rechne mit der Obergrenze der 24-V-Versorgung (24 V + 10 %).',
        'Der Vorwiderstand vor dem Regler nimmt einen Teil der Leistung auf. Er darf die Spannung am Regler bei der Obergrenze unter 25 V halten und muss bei der Untergrenze (24 V − 10 %) noch mindestens 7,5 V übrig lassen. Seine Nennleistung ist mindestens das Doppelte von I² · R.'],
      check: safe(checkDs, 'Auswahl'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => dsSolution(ctx),
      mutants: [
        { name: 'LM317 gewählt (kein Festregler)', mutate: d => { d.items[0] = { role: 'regler', ds: 'tf-lm317', part: 'TF-LM317', ref: 'LM317' }; return d; }, expectFail: ['Regler'] },
        { name: 'kein Vorwiderstand', mutate: d => { d.vals.rV = null; return d; }, expectFail: ['Vorwiderstand'] },
        { name: 'Vorwiderstand 1 kΩ (Regler verhungert)', mutate: d => { d.vals.rV = 1000; return d; }, expectFail: ['Dropout-Reserve'] },
        { name: 'Befund verdreht', mutate: d => { d.vals.finding = d.vals.finding === 'ok' ? 'heiss' : 'ok'; return d; }, expectFail: ['Befund'] },
        { name: 'Nennleistung nur 0,05 W', mutate: d => { d.vals.pRvW = 0.05; return d; }, expectFail: ['Leistung des Vorwiderstands'] },
        { name: 'Vorwiderstand 75 Ω (nicht E12)', mutate: d => { d.vals.rV = 75; return d; }, expectFail: ['Vorwiderstand'] }
      ] },

    { id: 'vf5', lab: 'vb', cat: 'Förderanlage', title: 'Sensor-Interface zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne die Interface-Schaltung: den 5-V-Regler mit deinem Vorwiderstand aus der Datenblatt-Station und für jeden Sensor einen Kanal. Ein Kanal macht aus dem 24-V-Signal des PNP-Sensors einen 5-V-Pegel für die Logik: Spannungsteiler, Z-Diode als Schutz und ein RC-Filter. Trage die simulierte Anstiegszeit des Filters ein.',
      in: ['foerder.ds', 'foerder.sen'], out: 'foerder.sch', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Spannungsteiler' },
      assist: { 1: { kind: 'startschaltung', parts: ['BAT 24 V', 'Masse'] } },
      hint: ['Der Teiler aus R1 (zum Sensor) und R2 (nach Masse) macht aus 24 V höchstens 5,0 V, aber mindestens 3,5 V (0,7 · 5 V). Rechne U_aus = 24 V · R2 / (R1 + R2).',
        'Die Z-Diode (5,1 V) liegt mit der Kathode am Logikeingang und der Anode an Masse. Der Filterkondensator liegt ebenfalls vom Eingang nach Masse. Die Zeitkonstante ist τ = (R1 ∥ R2) · C, die Anstiegszeit von 10 auf 90 % etwa 2,2 · τ.',
        'Beispiel: R1 = 47 kΩ, R2 = 10 kΩ, C = 330 nF. Die Anstiegszeit soll zwischen 2 ms und etwa einem Zehntel der Impulsdauer eines Werkstücks liegen. Alle Massen müssen verbunden sein, auch die des Reglers.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => buildSch(P_(ctx), need(ctx, 'foerder.ds'), schDesign(P_(ctx))),
      mutants: [
        { name: 'Z-Diode verpolt', mutate: d => { setPart(d.netlist, 'D1', p => { p.pins = { A: p.pins.K, K: p.pins.A }; }); d.netlist.nets.forEach(n => { n.pins = n.pins.map(a => a === 'D1.A' ? 'D1.K' : a === 'D1.K' ? 'D1.A' : a); }); return d; }, expectFail: ['Z-Diode'] },
        { name: 'Teiler 10k zu 10k (Pegel 12 V)', mutate: d => { setPart(d.netlist, 'R1', p => { p.value = '10k'; }); setPart(d.netlist, 'R2', p => { p.value = '10k'; }); return d; }, expectFail: ['Teilerpegel'] },
        { name: 'Filterkondensator 100 µF', mutate: d => { setPart(d.netlist, 'C1', p => { p.value = '100u'; }); return d; }, expectFail: ['RC-Filter'] },
        { name: 'Reglermasse nicht an GND', mutate: d => { movePin(d.netlist, 'U1.GND', 'N_X'); return d; }, expectFail: ['GND gemeinsam'] },
        { name: 'Vorwiderstand weicht von der Auswahl ab', mutate: d => { const r = d.netlist.parts.find(p => p.ref === 'RV1'); if (r) r.value = fmtR(numOf(r.value) * 2); else { d.netlist.parts.push({ ref: 'RV1', kind: 'R', value: '47', pins: {} }); } return d; }, expectFail: ['Regler und Vorwiderstand'] },
        { name: 'zweiter Kanal fehlt', mutate: d => { ['BS2', 'S2', 'R3', 'R4', 'D2', 'C2'].forEach(r => removePart(d.netlist, r)); return d; }, expectFail: ['Teilerpegel'] }
      ] },

    { id: 'vf6', lab: 'vb', cat: 'Förderanlage', title: 'Interface-Platine entwerfen', level: 3,
      on: 'pcb',
      text: 'Entwirf aus deinem Schaltplan die Interface-Platine für beide Sensorkanäle, den Regler und seinen Vorwiderstand. Die Quellen werden Schraubklemmen für 24 V, 5 V und die Sensoren. Verlege alle Netze, halte den Regelabstand zwischen 24-V- und Logiknetzen ein und setze für Netze ohne Klemme Prüfpunkte, damit sich die Platine messen lässt.',
      in: ['foerder.sch'], out: 'foerder.pcb', type: 'pcb.board', w: 100, pass: null,
      open: { ex: 'Interface-Platine' },
      assist: { 1: { kind: 'vorplatziert' } },
      hint: ['Lege zuerst die Klemmen an den Rand und gruppiere die Bauteile je Sensorkanal. Jeder Pin muss im gleichen Netz liegen wie im Schaltplan.',
        'Stelle den Regelabstand (Clearance) der Platine auf mindestens 0,3 mm, bevor du verlegst. Netze, die an keiner Klemme enden, brauchen einen Prüfpunkt (Bauteil TP…) für die Messung.',
        'Klemme für 24 V und Masse, Klemme für 5 V und Masse, je Sensor eine Klemme mit Signal, Logikknoten und Masse. Autorouter laufen lassen und DRC und Kosten prüfen.'],
      check: safe(checkPcb, 'Platine'),
      starter: ctx => { const P = P_(ctx); const b = PCB().newBoard({ id: 'foerder', name: 'Neue Platine', w: P.boardW, h: P.boardH, layers: P.layers }); return { board: b, report: boardReport(b) }; },
      solution: ctx => { const P = P_(ctx), sch = need(ctx, 'foerder.sch'), b = buildBoard(sch.netlist, P); return { board: b, report: boardReport(b) }; },
      mutants: [
        { name: 'keine Leiterbahnen', mutate: d => { d.board.tracks = []; d.board.vias = []; d.report = boardReport(d.board); return d; }, expectFail: ['Alle Netze verlegt'] },
        { name: 'Pads des Widerstands vertauscht', mutate: d => { d.board.nets.forEach(n => { n.pins = n.pins.map(p => p === 'R1.1' ? 'R1.2' : p === 'R1.2' ? 'R1.1' : p); }); d.report = boardReport(d.board); return d; }, expectFail: ['Netze der Platine identisch'] },
        { name: 'Regelabstand 0,1 mm', mutate: d => { d.board.rules.clearance = 0.1; d.report = boardReport(d.board); return d; }, expectFail: ['Abstand 24-V-Netze'] },
        { name: 'Platine zu groß', mutate: d => { d.board.w = 140; d.report = boardReport(d.board); return d; }, expectFail: ['Maße und Lagen'] },
        { name: 'Klemme für 5 V fehlt', mutate: d => { d.board.parts = d.board.parts.filter(p => p.ref !== 'X2'); d.board.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf('X2.') !== 0); }); d.report = boardReport(d.board); return d; }, expectFail: ['Netze der Platine identisch'] }
      ] },

    { id: 'vf7', lab: 'vb', cat: 'Förderanlage', title: 'Interface messen', level: 2,
      on: 'mess',
      text: 'Die Platine ist bestückt. Miss die 5-V-Versorgung, die Pegel am Logikeingang bei 24 V und bei 0 V am Sensoreingang und mit dem Oszilloskop die Anstiegszeit des Eingangsfilters. Trage die Werte mit Einheit und Messgerät ein. Weicht etwas auffällig vom Schaltplan ab, notiere deinen Befund.',
      in: ['foerder.pcb', 'foerder.sch'], out: 'foerder.mess', type: 'mess.protocol', w: 100, pass: null,
      form: [
        { key: 'u5v', label: 'Versorgung U_5V', type: 'number', unit: 'V' }, { key: 'uHi', label: 'Pegel High (Eingang 24 V)', type: 'number', unit: 'V' },
        { key: 'uLo', label: 'Pegel Low (Eingang 0 V)', type: 'number', unit: 'V' }, { key: 'tFilter', label: 'Anstiegszeit des Filters', type: 'number', unit: 'ms' },
        { key: 'finding', label: 'Befund', type: 'area' }
      ],
      fromForm: v => {
        const mk = (id, label, unit, val, ins, tp) => ({ id: id, label: label, unit: unit, soll: 0, ist: fin(numOf(val)) ? numOf(val) : null, tol: 5, instrument: ins, tp: tp });
        return { rows: [mk('U_5V', 'Versorgung 5 V', 'V', v.u5v, 'Multimeter', ''), mk('U_hi', 'Pegel High', 'V', v.uHi, 'Multimeter', ''), mk('U_lo', 'Pegel Low', 'V', v.uLo, 'Multimeter', ''), mk('tFilterMs', 'Anstiegszeit Filter', 'ms', v.tFilter, 'Oszilloskop', '')],
          values: { u5v: fin(numOf(v.u5v)) ? numOf(v.u5v) : 0, tFilterMs: fin(numOf(v.tFilter)) ? numOf(v.tFilter) : 0 }, findings: v.finding ? [String(v.finding)] : [] };
      },
      open: { ex: 'Spannungsteiler messen' },
      hint: ['Miss alle Spannungen gegen Masse. Der Eingangspegel liegt bei geschlossenem Sensorschalter knapp unter 5 V, bei offenem bei 0 V.',
        'Die Anstiegszeit misst du am Oszilloskop zwischen 10 % und 90 % des Endwerts am Logikeingang. Sie liegt im Bereich einiger Millisekunden.',
        'Weicht der Pegel stark vom Entwurf ab oder ist der Filter viel zu träge, ist der Aufbau fehlerhaft: Vertauschte Teilerwiderstände heben den Pegel bis an die Z-Diode, ein zu großer Filterkondensator verlängert die Anstiegszeit. Trage den gemessenen Wert trotzdem ein und notiere den Befund.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'U_5V falsch gemessen', mutate: d => { const r = d.rows.find(x => x.id === 'U_5V'); r.ist = r.ist * 1.5; return d; }, expectFail: ['U_5V'] },
        { name: 'Anstiegszeit doppelt so lang', mutate: d => { d.values.tFilterMs *= 2; d.rows.find(x => x.id === 'tFilterMs').ist *= 2; return d; }, expectFail: ['Anstiegszeit des Eingangsfilters'] },
        { name: 'Messgerät und Einheit fehlen', mutate: d => { d.rows.forEach(r => { r.instrument = ''; r.unit = ''; }); return d; }, expectFail: ['Einheiten', 'Protokoll vollständig'] },
        { name: 'Pegel Low nicht gemessen', mutate: d => { d.rows = d.rows.filter(x => x.id !== 'U_lo'); return d; }, expectFail: ['Pegel Low'] },
        { name: 'Befund fehlt', levels: [3], mutate: d => { d.findings = []; return d; }, expectFail: ['Fehler benannt'] }
      ] },

    { id: 'vf8', lab: 'vb', cat: 'Förderanlage', title: 'Sortiersteuerung programmieren', level: 3,
      on: 'sps',
      text: 'Programmiere die Sortiersteuerung: Start und Stopp mit Selbsthaltung, Not-Halt als Öffner, Lampe Betrieb. Erkennt der Sensor (I0.3) ein Metallteil, fährt der Ausschieber (Q0.1) nach der Wartezeit T aus: T = s / v − Filterzeit − Sensorzeit − Zylindervorlauf, mit deinen Werten. Zähle die ausgeschobenen Teile. Meldet der Ausschieber nicht innerhalb von 1,5 s „vorn“ (I0.5), leuchtet die Störlampe (Q0.3).',
      in: ['foerder.mess', 'foerder.sen', 'foerder.ant'], out: 'foerder.sps', type: 'sps.program', w: 100, pass: null,
      open: { ex: 'Förderband', plant: 'foerderband', opts: ctx => { try { return { beltMmS: rd(spsContext(ctx).vMs * 1000, 1) }; } catch (e) { return {}; } } },
      assist: { 1: { kind: 'rahmenprogramm', lang: 'kop', symbols: SYM } },
      hint: ['Fange mit dem Betrieb an: Start setzt einen Merker, Stopp (Öffner), Not-Halt (Öffner) und Störung setzen ihn zurück. Das Band hängt am Merker.',
        'Die steigende Flanke von I0.3 startet ein Zeitglied (TON). Wenn es abläuft, fährt der Ausschieber aus, bis I0.5 „vorn“ meldet. Rechne T aus: s / v ist die Fahrzeit des Teils bis zum Ausschieber, davon gehen die Verzögerung durch Sensor und Filter (deine Messung) und der Zylindervorlauf ab.',
        'Der Zähler zählt die steigenden Flanken von I0.5. Die Überwachung ist ein TON auf „Ausschieber fährt, I0.5 fehlt“ mit 1,5 s: Läuft er ab, wird die Störung gesetzt, die den Betrieb abschaltet. Quittiert wird mit Stopp.'],
      check: safe(checkSps, 'SPS'),
      starter: ctx => ({ prog: { lang: 'kop', symbols: Object.assign({}, SYM), networks: [] }, plant: 'foerderband', opts: {}, lang: 'kop' }),
      solution: ctx => { const P = P_(ctx), c = spsContext(ctx), T = Math.max(10, Math.round(tIdeal(P, c.vMs, c.tFilterMs + c.tOnMs) / 10) * 10); return { prog: buildProgram(P, T), plant: 'foerderband', opts: { beltMmS: rd(c.vMs * 1000, 1) }, lang: 'kop', notes: 'Musterlösung: Betrieb mit Selbsthaltung, Wartezeit T, Ausschieber, Zählung, Überwachung' }; },
      mutants: [
        { name: 'Wartezeit nur halb so lang', mutate: d => { d.prog.networks.forEach(n => { if (n.expr && n.expr.id === 'T1') n.expr.pt = Math.round(n.expr.pt / 2); }); return d; }, expectFail: ['Sortierung', 'Zeitgeber'] },
        { name: 'Not-Halt ignoriert', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N1') n.expr.in = n.expr.in.filter(e => e.a !== 'I0.7'); if (n.id === 'N2') n.expr.in = n.expr.in.filter(e => e.a !== 'I0.7'); }); return d; }, expectFail: ['Not-Halt'] },
        { name: 'keine Zählung', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N10'); return d; }, expectFail: ['Zählung'] },
        { name: 'Störlampe fehlt', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N11' && n.id !== 'N14'); return d; }, expectFail: ['Störlampe'] },
        { name: 'Wartezeit ohne Filter- und Zylinderkorrektur', mutate: d => { d.prog.networks.forEach(n => { if (n.expr && n.expr.id === 'T1') n.expr.pt = n.expr.pt + 150; }); return d; }, expectFail: ['Zeitgeber', 'Sortierung'] },
        { name: 'Band läuft nur solange Start gedrückt ist', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N2'); d.prog.networks.forEach(n => { if (n.id === 'N1') n.outs = [coil_('M0.0')]; }); return d; }, expectFail: ['Start und Stopp', 'Sortierung'] }
      ] },

    { id: 'vf9', lab: 'vb', cat: 'Förderanlage', title: 'Produktionsstatistik auswerten', level: 2,
      on: 'pi',
      text: 'Die Anlage hat 120 Sekunden gelaufen, mit einem Stillstand mittendrin. Das Protokoll liegt als Liste daten im Kopf deines Python-Programms: eine Zeile je Sekunde mit t, band, stoerung, hell, metall_aus, hell_aus, metall_durch und verloren (aufsummiert). Gib TEILE_GESAMT, DURCHSATZ (Teile je Minute), AUSSCHUSS_PROZENT und VERFUEGBARKEIT_PROZENT als Zeilen SCHLÜSSEL=Wert aus.',
      in: ['foerder.sps'], out: 'foerder.pi', type: 'pi.script', w: 100, pass: null,
      dataFor: ctx => { const sps = need(ctx, 'foerder.sps'); return { daten: sps && isObj(sps.prog) ? makeLog(sps.prog, ctx).rows : [] }; },
      open: { ex: 'Produktionsstatistik' },
      hint: ['Teile gesamt sind alle, die die Anlage verlassen haben: ausgeschoben (metall_aus, hell_aus) und durchgelaufen (hell, metall_durch). Nimm dafür die letzte Zeile der Liste.',
        'Der Durchsatz ist teile geteilt durch die Minuten, und die Minuten sind die letzte Zeit t geteilt durch 60. Ausschuss sind falsch sortierte (hell_aus, metall_durch) und verlorene Teile, bezogen auf alle Teile plus die verlorenen.',
        'Die Verfügbarkeit zählt die Zeilen, in denen band gleich 1 und stoerung gleich 0 ist, und teilt durch die Zahl aller Zeilen, mal 100. Gib alles mit print aus, zum Beispiel print(\'DURCHSATZ=\' + str(round(x, 2))).'],
      check: safe(checkPi, 'Auswertung'),
      starter: ctx => ({ lang: 'python', src: 'daten = []\nprint("TEILE_GESAMT=0")', out: [] }),
      solution: ctx => { const o = piRun(PY_SRC, ctx); return { lang: 'python', src: PY_SRC, out: arr(o.run.lines) }; },
      mutants: [
        { name: 'Durchsatz je Sekunde statt je Minute', mutate: d => { d.src = d.src.replace("minuten = letzte['t'] / 60", "minuten = letzte['t']"); return d; }, expectFail: ['DURCHSATZ'] },
        { name: 'Verfügbarkeit nicht ausgegeben', mutate: d => { d.src = d.src.replace(/print\('VERFUEGBARKEIT_PROZENT[^\n]*/, ''); return d; }, expectFail: ['VERFUEGBARKEIT_PROZENT'] },
        { name: 'Syntaxfehler', mutate: d => { d.src += '\nx = = 3\n'; return d; }, expectFail: ['Format'] },
        { name: 'durchgelaufene Teile nicht mitgezählt', mutate: d => { d.src = d.src.replace("letzte['hell'] + letzte['metall_aus'] + letzte['hell_aus'] + letzte['metall_durch']", "letzte['metall_aus'] + letzte['hell_aus']"); return d; }, expectFail: ['TEILE_GESAMT'] }
      ] },

    { id: 'vf10', lab: 'vb', cat: 'Förderanlage', title: 'Fachgespräch zur Anlage', level: 1,
      on: 'pr',
      text: 'Probeprüfung zu deiner eigenen Anlage: Sechs Fragen, die sich aus deinen Zahlen ergeben. Antworte numerisch. Alle Werte stehen in deinen bisherigen Stationen, du musst sie nur richtig verknüpfen.',
      in: ['foerder.pi', 'foerder.ant', 'foerder.sen', 'foerder.ds'], out: 'foerder.pr', type: 'pr.quiz', w: 100, pass: null,
      form: QUESTIONS.map(q => ({ key: q[0], label: 'Frage ' + q[0].slice(1) + ': ' + q[1], type: 'number', unit: q[2] })),
      fromForm: v => { const a = {}; QUESTIONS.forEach(q => { const x = numOf(v[q[0]]); if (fin(x)) a[q[0]] = x; }); return { answers: a, n: 6 }; },
      open: { ex: 'Fachgespräch' },
      hint: ['Die Fragen verlangen nur Zahlen aus deinen Stationen: Bandgeschwindigkeit, Schaltfrequenz, Wartezeit, Reglerverlust, Durchsatz und Nennstrom.',
        'Wartezeit: T = s / v − Filterzeit − Sensorzeit − Zylindervorlauf, mit der Filterzeit aus deinem Messprotokoll. Reglerverlust bei 24 V: P = (U_Regler − 5 V) · I plus U_Regler mal Ruhestrom, mit der Spannung nach deinem Vorwiderstand.',
        'Der Durchsatz steht im Ergebnis deiner Python-Auswertung. Die Schaltfrequenz ist f = v / (Werkstücklänge + Lücke). Der Nennstrom steht beim Motor in der Antriebsstation.'],
      questions: ctx => questionList(ctx),
      check: safe(checkPr, 'Fachgespräch'),
      starter: ctx => ({ answers: {}, n: 0 }),
      solution: ctx => prSolution(ctx),
      mutants: [
        { name: 'Schaltfrequenz verdoppelt', mutate: d => { d.answers.q2 = d.answers.q2 * 2; return d; }, expectFail: ['Frage 2'] },
        { name: 'Nennstrom falsch', mutate: d => { d.answers.q6 = 2.8; return d; }, expectFail: ['Frage 6'] },
        { name: 'zwei Antworten fehlen', mutate: d => { delete d.answers.q3; delete d.answers.q5; return d; }, expectFail: ['Vollständigkeit', 'Frage 3'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k] };
    const out = [];
    const ant = g('foerder.ant'), sim = g('foerder.sim'), sen = g('foerder.sen'), pk = g('foerder.ds'), sch = g('foerder.sch'), pcb = g('foerder.pcb'), mess = g('foerder.mess'), sps = g('foerder.sps'), pyd = g('foerder.pi'), pr = g('foerder.pr');
    out.push({ h: 'Lastenheft', rows: [['Bandgeschwindigkeit', fm(P.vSoll, 2) + ' m/s, Rolle ' + fm(P.dRolle * 1000, 0) + ' mm'], ['Motor', fm(P.pMotorW / 1000, 2) + ' kW Drehstrom, Last ' + P.mBand + ' Nm'], ['Werkstück', P.lWerk + ' mm ' + WERKSTOFF[P.werkstoff] + ', Lücke ' + P.lLuecke + ' mm'], ['Soll-Durchsatz', fm(P.durchsatzSoll, 0) + ' Teile/min, Ausschuss höchstens 2 %']] });
    const ad = ant ? antDerive(ant, ctx) : null; if (ad && ad.ok) out.push({ h: 'Antrieb', rows: [['Übersetzung', fm(ad.ratio, 1)], ['Motordrehzahl', fm(ad.rpm, 0) + ' 1/min'], ['Bandgeschwindigkeit', fm(ad.vMs, 3) + ' m/s'], ['Motorstrom', fm(ad.iLine, 2) + ' A von ' + fm(ad.iN, 2) + ' A'], ['Wicklungstemperatur', fm(ad.temp, 0) + ' °C']] });
    if (sim && isObj(sim.netlist)) out.push({ h: 'Motorschaltung und Stückliste', rows: sim.netlist.parts.map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    const sd = sen ? senDerive(sen, ctx) : null; if (sd && sd.ok) out.push({ h: 'Sensorik', rows: [['Sensor', sd.kind + ', Montageabstand ' + fm(sd.dist, 2) + ' mm'], ['Schaltfrequenz', fm(sd.fMaxHz, 1) + ' Hz (gefordert ' + fm(sd.fReq, 1) + ' Hz)'], ['Stromaufnahme', fm(sd.iSupplyMa, 1) + ' mA je Sensor']] });
    const pi = pickInfo(pk); if (pi.ok) { const c = regCalc(P, pi.reg, pi.rV, regLoad(P, ctx)); out.push({ h: '5-V-Regler', rows: [['Regler', refOf(pi.reg)], ['Vorwiderstand', pi.rV > 0 ? fmtRde(pi.rV) + ' Ω, ' + fm(pi.pRv, 2) + ' W' : 'keiner'], ['Reglerverlust', fm(c.pv, 2) + ' W bei ' + fm(P.uMax, 1) + ' V'], ['Sperrschichttemperatur', fm(c.tj, 0) + ' °C']] }); }
    if (sch && isObj(sch.netlist)) out.push({ h: 'Interface-Schaltung', rows: sch.netlist.parts.map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    const b = pcb && asBoard(pcb.board); if (b && PCB()) { const r = boardReport(PCB().normalize(b)); out.push({ h: 'Platine', rows: [['Maße', fm(r.w, 0) + ' x ' + fm(r.h, 0) + ' mm, ' + r.layers + ' Lagen'], ['Bauteile', r.bomCount], ['DRC-Fehler', r.drcErrors], ['Kosten', fm(r.cost, 2) + ' €']] }); }
    if (mess) out.push({ h: 'Messprotokoll', rows: arr(mess.rows).map(r => [r.label || r.id, fm(+r.ist, 2) + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) });
    if (sps && isObj(sps.prog) && SPS()) { let txt = ''; try { txt = SPS().toText(sps.prog, 'iec', { symbols: true }); } catch (e) { txt = ''; } out.push({ h: 'SPS-Programm', html: '<pre>' + String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' }); }
    if (pyd && pyd.src && sps && isObj(sps.prog)) { const st = logStats(makeLog(sps.prog, ctx).rows); out.push({ h: 'Produktionsstatistik', rows: [['Teile gesamt', st.TEILE_GESAMT], ['Durchsatz', fm(st.DURCHSATZ, 1) + ' Teile/min'], ['Ausschuss', fm(st.AUSSCHUSS_PROZENT, 1) + ' %'], ['Verfügbarkeit', fm(st.VERFUEGBARKEIT_PROZENT, 1) + ' %']] }); }
    if (pr && isObj(pr.answers)) out.push({ h: 'Fachgespräch', rows: QUESTIONS.map(q => ['Frage ' + q[0].slice(1) + ': ' + q[1], fin(+pr.answers[q[0]]) ? fm(+pr.answers[q[0]], q[3] + 1) + ' ' + q[2] : '–']) });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Förderanlage: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Förderanlage: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Förderanlage: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Förder- und Sortieranlage', icon: '📦', prefix: 'vf', order: 5,
    story: 'In der Fertigung in Ermsleben kommen Metallhülsen und Kunststoffkappen gemischt auf ein Band. Eine Sortieranlage soll die Metallteile ausschieben. Meister Funk: „Die schnellste Steuerung nützt nichts, wenn der Sensor das Teil nicht sieht. Alles hängt an der Bandgeschwindigkeit.“ Du legst den Antrieb aus, schaltest den Motor, erkennst die Teile mit der Sensorik, baust die Interface-Platine, programmierst die Sortierung und wertest die Produktion aus.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['ant', 'sim', 'sen', 'ds', 'sch', 'pcb', 'mess', 'sps', 'pi', 'pr'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    stations: STATIONS,
    final: {
      id: 'vfF', title: 'Abschlusstest: Förder- und Sortieranlage', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Sortiersteuerung leer', mutate: s => { s['foerder.sps'] = { prog: { lang: 'kop', symbols: {}, networks: [] }, plant: 'foerderband', opts: {}, lang: 'kop' }; return s; }, expectFail: ['Gesamtlauf'] },
        { name: 'kapazitiver Sensor', mutate: s => { s['foerder.sen'].ctl.sensor = 'kapazitiv'; return s; }, expectFail: ['Sensorik passt'] },
        { name: 'Not-Halt als Schließer', mutate: s => { setPart(s['foerder.sim'].netlist, 'S3', p => { p.kind = 'PB'; }); return s; }, expectFail: ['Elektrik'] },
        { name: 'Filterzeit im Protokoll falsch', mutate: s => { s['foerder.mess'].values.tFilterMs *= 4; s['foerder.mess'].rows.forEach(r => { if (r.id === 'tFilterMs') r.ist *= 4; }); return s; }, expectFail: ['Interface-Kette'] }
      ]
    },
    kpis: ['bandgeschwindigkeit', 'durchsatz', 'ausschuss', 'motorlast', 'frequenzreserve', 'reglertemp', 'nothalt'],
    report: reportParts,
    selfTest: selfTest,
    _test: { resetPlantProbe: function () { supportsBelt = null; spsCache.clear(); }, tIdeal: tIdeal, logStats: logStats, PY_SRC: PY_SRC, buildProgram: buildProgram, runFb: runFb, press: press, chain: chain, plantSupportsBelt: plantSupportsBelt, riseMs: riseMs },
    demos: [{ id: 'bis4', name: 'Förderanlage bis Station 4', upTo: 'vf4' }, { id: 'fertig', name: 'Förderanlage fertig', upTo: 'vfF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_FOERDER = def;
})(typeof window !== 'undefined' ? window : globalThis);
