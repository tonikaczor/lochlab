/* verbunddata-garage.js - Verbundprojekt 1: Garagentor mit Funköffner (Projektdefinition, Paket P1)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.1. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Benötigt zur Laufzeit der Prüfungen (alle rein rechnerisch, ohne Browser): dscore.js + dslib-semi.js, pcbcore.js, sencore.js + senrig-*.js,
 * antcore.js, spscore.js + spsplant-garagentor.js. Die Hilfen für Netzlisten (Union-Find, Logikauswertung, Platinen-Gleichwertigkeit)
 * stehen bewusst in dieser Datei (privat), damit die Projektprüfung nicht von der Pin-Konvention einer anderen Bibliothek abhängt.
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   digi.design   { netlist, inputs:[{name,ref}], outputs:[{name,ref,iMaxMa}], vdd:{min,max} }     ref = 'Teil.Pin' oder Teil (dann Pin am Signalnetz)
 *   ds.pick       { items:[{role:'transistor'|'diode', ds:'tf-bc547', part, ref}], calc:{iBistMa?}, vals:{rB, hfeKey} }
 *   sch.circuit   { lab, name, netlist, meas, snap }
 *   pcb.board     { board (Objekt oder JSON-Text), report:{w,h,layers,drcErrors,drcWarns,unrouted,shorts,cost,bomCount} }
 *   mess.protocol { rows:[{id,label,unit,soll,ist,tol,instrument,tp?}], values:{tRelaisMs}, findings:[text] }
 *   sen.chain     { rig:'licht', ctl:{sensor,target,dist,rLoad,thresh,hyst,ambient,fdelay}, ctl2:{sensor:'induktiv',material,dist}, state, derived }
 *   ant.setup     { rig:'gleichstrom', ctl:{motor,uSupply,duty}, gear:{type,stages,z1..z4}, fuseA, state, derived }
 *   sps.program   { prog, plant:'garagentor', opts, lang }
 *   app.note      { title, md, tags }
 * Werte mit (A) sind Annahmen (Lehrwerte), siehe SPEC Abschnitt 8 und 13.3. */
(function (root) {
  'use strict';

  const PID = 'garage';
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
  function numOf(v) {                         // '4k7', '12V', '330', 4700 -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const d = DS();
    if (d && d.parseWithUnit) { const r = d.parseWithUnit(s); if (r && fin(r.value)) return r.value; }
    const m = /^(\d+(?:[.,]\d+)?)\s*([kKMm]?)/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) * ({ k: 1e3, K: 1e3, M: 1e6, m: 1e-3 }[m[2]] || 1) : NaN;
  }
  const E12 = (root.ENORM || (function () { try { return typeof require === 'function' ? require('./enorm.js') : null; } catch (e) { return null; } })() || {}).E12;   // eine Quelle: enorm.js
  function isE(v, series) {                   // Wert in E12/E24?
    const d = DS(); if (!d || !fin(v) || v <= 0) return false;
    const n = d.eSeries(series || 'E12', v, 'nearest');
    return fin(n) && Math.abs(n - v) <= 1e-6 * v;
  }
  const e24List = [];                         // E24-Werte von 100 Ω bis 10 kΩ (Suchraum der Sensor-Musterlösung)
  [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1].forEach(m => [100, 1000, 10000].forEach(d => e24List.push(Math.round(m * d))));
  const eList = [];                           // alle E12-Werte von 100 Ω bis 100 kΩ
  [100, 1000, 10000].forEach(dec => E12.forEach(m => eList.push(Math.round(m * dec))));
  eList.push(100000);

  /* ====================================================================== Lastenheft */
  const IO = [
    { key: 'I0.0', sym: 'S1_Auf', text: 'Funk Auf / Taster Auf (Schließer)' },
    { key: 'I0.1', sym: 'S2_Ab', text: 'Funk Ab / Taster Ab (Schließer)' },
    { key: 'I0.2', sym: 'B1_EndeOben', text: 'Endschalter oben (induktiv, 1 = Tor oben)' },
    { key: 'I0.3', sym: 'B2_EndeUnten', text: 'Endschalter unten (1 = Tor unten)' },
    { key: 'I0.4', sym: 'B3_Lichtschranke', text: 'Lichtschranke (1 = Hindernis im Tor)' },
    { key: 'I0.5', sym: 'S3_Stopp', text: 'Taster Stopp (Öffner, Ruhe = 1)' },
    { key: 'Q0.0', sym: 'K1_MotorAuf', text: 'Schütz Motor Auf' },
    { key: 'Q0.1', sym: 'K2_MotorAb', text: 'Schütz Motor Ab' },
    { key: 'Q0.2', sym: 'H1_Blinklicht', text: 'Blinklicht' },
    { key: 'Q0.3', sym: 'H2_Beleuchtung', text: 'Beleuchtung' }
  ];

  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x6a09e667);
    const addrBits = level === 3 ? 6 : 4;
    const addr = 1 + Math.floor(r() * (Math.pow(2, addrBits) - 2));           // 1 ... 2^n - 2
    const rCoil = pick(r, [240, 300, 400]);                                    // (A)
    const uCoil = 12;
    const hub = level === 1 ? pick(r, [2.0, 2.2, 2.4]) : level === 2 ? rd(2.0 + 0.1 * Math.floor(r() * 5), 1) : rd(2.0 + 0.01 * Math.floor(r() * 41), 2);
    const fLast = level === 1 ? pick(r, [100, 120, 140, 160]) : level === 2 ? 100 + 10 * Math.floor(r() * 7) : 100 + Math.floor(r() * 61);   // (A)
    const travelS = level === 3 ? pick(r, [5, 6, 8]) : 6;
    const fremdLux = level === 1 ? pick(r, [0, 200, 400]) : level === 2 ? pick(r, [300, 500, 700, 900]) : pick(r, [800, 1000, 1100]);   // (A) Fremdlicht an der Lichtschranke
    const zielDist = level === 1 ? pick(r, [30, 40]) : level === 2 ? pick(r, [30, 35, 40, 45]) : pick(r, [30, 35, 40]);                   // (A) Abstand des dunklen Ziels in mm
    const fault = level === 3 ? pick(r, ['rb10', 'diodeRev']) : null;
    const p = {
      addrBits: addrBits, addr: addr, uCoil: uCoil, rCoil: rCoil, iCoil: rd(uCoil / rCoil * 1000, 2),   // iCoil in mA
      vOH: 5, iOutMax: 1, tAmb: 50, hub: hub, travelS: travelS, dT: 0.10, fLast: fLast, uMotor: 24,
      tReactMaxMs: 150, cycleMs: 10, sStopMaxMm: 50, boardW: 60, boardH: 40, layers: 2, tVorwarn: 2,
      fremdLux: fremdLux, zielDist: zielDist, fault: fault, mTor: 25
    };
    const bin = addr.toString(2).padStart(addrBits, '0');
    const text = [
      'Projekt Garagentor mit Funköffner, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Funkadresse: ' + addrBits + ' Bit, Torkennung ' + addr + ' (binär ' + bin + '). Der Empfänger liefert die Datenbits A0 bis A' + (addrBits - 1) + ', die DIP-Schalter S0 bis S' + (addrBits - 1) + ' stellen die Kennung ein.',
      'Logik: Ausgang MATCH mit ' + fm(p.vOH, 0) + ' V, belastbar mit höchstens ' + fm(p.iOutMax, 0) + ' mA (A).',
      'Relais: Spule ' + fm(p.uCoil, 0) + ' V, ' + p.rCoil + ' Ω, also ' + fm(p.iCoil, 0) + ' mA (A). Umgebung in der Garage ' + p.tAmb + ' °C (A).',
      'Tor: Hub ' + fm(p.hub, 2) + ' m in ' + fm(p.travelS, 0) + ' s, Seiltrommel ' + fm(p.dT * 1000, 0) + ' mm (A), Restkraft ' + p.fLast + ' N (A), Motor ' + p.uMotor + ' V.',
      'Sicherheit: Reaktionszeit höchstens ' + p.tReactMaxMs + ' ms, Anhalteweg höchstens ' + p.sStopMaxMm + ' mm (A). Blinklicht ' + fm(p.tVorwarn, 0) + ' s vor jeder Fahrt (A).',
      'Lichtschranke: dunkles Ziel in ' + p.zielDist + ' mm, Fremdlicht ' + p.fremdLux + ' lx (A). SPS-Zyklus ' + p.cycleMs + ' ms.',
      'Platine: höchstens ' + p.boardW + ' x ' + p.boardH + ' mm, ' + p.layers + ' Lagen.'
    ];
    if (fault) text.push('Hinweis Inbetriebnahme: Der Messaufbau enthält einen eingebauten Fehler. Finde ihn.');
    return { params: p, text: text, io: IO.map(clone) };
  }

  /* ====================================================================== Netzlisten-Hilfen (privat) */
  const PINNAMES = {
    R: ['1', '2'], C: ['1', '2'], CE: ['1', '2'], FUSE: ['1', '2'], MOTOR: ['1', '2'], SPK: ['1', '2'], SPST: ['1', '2'], PB: ['1', '2'], PBC: ['1', '2'],
    D: ['A', 'K'], LED: ['A', 'K'], ZD: ['A', 'K'], SCHOTTKY: ['A', 'K'], NPN: ['B', 'C', 'E'], PNP: ['B', 'C', 'E'], NMOS: ['G', 'D', 'S'], PMOS: ['G', 'D', 'S'],
    RLY: ['A1', 'A2', 'COM', 'NO', 'NC'], BAT: ['+', '-'], AND: ['A', 'B', 'Y'], NAND: ['A', 'B', 'Y'], OR: ['A', 'B', 'Y'], NOR: ['A', 'B', 'Y'], XOR: ['A', 'B', 'Y'], NOT: ['A', 'Y']
  };
  const GATE = { AND: (a, b) => a && b, NAND: (a, b) => !(a && b), OR: (a, b) => a || b, NOR: (a, b) => !(a || b), XOR: (a, b) => a !== b };
  const SRC_KINDS = { BAT: 1, AC: 1, SPST: 1, PB: 1, PBC: 1, SPDT: 1, GND: 1 };
  /* CMOS-Gehäuse nach simics.js: Abschnitte [Eingänge..., Ausgang] mit Gehäusepins */
  const QUAD = { c4: [[1, 2, 3], [5, 6, 4], [8, 9, 10], [12, 13, 11]], d4: [[2, 3, 4, 5, 1], [9, 10, 11, 12, 13]] };
  const ICX = {
    '4070': { sec: 'c4', fn: (a, b) => a !== b }, '4071': { sec: 'c4', fn: (a, b) => a || b }, '4081': { sec: 'c4', fn: (a, b) => a && b },
    '4001': { sec: 'c4', fn: (a, b) => !(a || b) }, '4011': { sec: 'c4', fn: (a, b) => !(a && b) },
    '4002': { sec: 'd4', fn: (a, b, c, d) => !(a || b || c || d) }, '4082': { sec: 'd4', fn: (a, b, c, d) => a && b && c && d }
  };
  const icKey = p => { const m = /(40\d\d)/.exec(String(p.ic || p.value || p.label || '')); return m ? m[1] : null; };
  const isSupply = n => /^(GND|VSS|0V|MASSE)$/i.test(String(n));
  const isVdd = n => /^(VCC|VDD|\+5V|\+12V|\+?\d+V)$/i.test(String(n));

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
    // Relaiskontakte ohne Netz (Einzelpin-Netze fehlen im Schaltplan aus dem Lab): Ersatznetze K1_COM, K1_NO, damit Klemmen und Prüfung dieselbe Sicht haben wie bei den Netzlisten des Projekts
    Object.keys(ix.parts).forEach(ref => { if (ix.parts[ref].kind === 'RLY') ['COM', 'NO'].forEach(pn => { const a = ref + '.' + pn; if (ix.net[a] === undefined) { ix.net[a] = ref + '_' + pn; ix.nets[ref + '_' + pn] = [a]; } }); });
    ix.ok = Object.keys(ix.parts).length > 0;
    return ix;
  }
  const pinKeys = p => (isObj(p.pins) && Object.keys(p.pins).length ? Object.keys(p.pins) : (PINNAMES[p.kind] || []).slice());
  /* Gatter: Pinnamen A,B,Y (oder 1,2,3); fehlt ein Pin in pins, bleibt er als offener Eingang erhalten */
  function gatePins(p) {
    const names = PINNAMES[p.kind] || [], keys = isObj(p.pins) ? Object.keys(p.pins) : [], num = names.map((n, i) => String(i + 1));
    if (keys.some(k => num.indexOf(k) >= 0) && !keys.some(k => names.indexOf(k) >= 0)) return num;
    return names.slice();
  }
  const netOf = (ix, ref, pin) => ix.net[ref + '.' + pin];
  const netOrPin = (ix, ref, pin) => { const n = netOf(ix, ref, pin); return n !== undefined ? n : ref + '_' + pin; };   // Einzelpin-Netze (Relaiskontakte) fehlen im Schaltplan aus dem Lab
  const same = (ix, a, b) => ix.net[a] !== undefined && ix.net[a] === ix.net[b];
  const ofKind = (ix, kinds) => Object.keys(ix.parts).map(k => ix.parts[k]).filter(p => kinds.split(',').indexOf(p.kind) >= 0);
  function batPins(p) { const k = pinKeys(p); const plus = k.find(x => /^\+|^p$|^1$/i.test(x)) || k[0] || '+'; const minus = k.find(x => x !== plus) || '-'; return { plus: plus, minus: minus }; }
  function supplyOf(ix, volt) {               // BAT mit passender Spannung -> { ref, plusNet, minusNet }
    const bats = ofKind(ix, 'BAT').filter(b => Math.abs(numOf(b.value) - volt) <= 0.5);
    if (!bats.length) return null;
    const b = bats[0], bp = batPins(b);
    return { ref: b.ref, plusNet: netOf(ix, b.ref, bp.plus), minusNet: netOf(ix, b.ref, bp.minus) };
  }

  /* Logik auswerten: prep = logicPrep(ix) einmal, dann logicRun(ix, prep, drive) je Eingangskombination; drive = { Netzname: bool } */
  function logicPrep(ix) {
    const base = {}, driven = {}, gates = [];
    Object.keys(ix.nets).forEach(n => { if (isSupply(n)) { base[n] = false; driven[n] = true; } else if (isVdd(n)) { base[n] = true; driven[n] = true; } });
    ofKind(ix, 'BAT').forEach(b => { const bp = batPins(b), pn = netOf(ix, b.ref, bp.plus), mn = netOf(ix, b.ref, bp.minus); if (pn !== undefined) { base[pn] = numOf(b.value) > 0; driven[pn] = true; } if (mn !== undefined) { base[mn] = false; driven[mn] = true; } });
    Object.keys(ix.parts).forEach(ref => {
      const p = ix.parts[ref];
      if (p.kind === 'ICX') {
        const key = icKey(p), def = key && ICX[key];
        if (!def) return;
        QUAD[def.sec].forEach((s, si) => { if (s.some(n => ix.net[ref + '.' + n] !== undefined)) gates.push({ ref: ref + '/' + (si + 1), fn: def.fn, ins: s.slice(0, -1).map(n => ref + '.' + n), out: ref + '.' + s[s.length - 1], ic: ref }); });
      } else if (p.kind === 'NOT') {
        const k = gatePins(p); gates.push({ ref: ref, fn: a => !a, ins: [ref + '.' + k[0]], out: ref + '.' + k[k.length - 1] });
      } else if (GATE[p.kind]) {
        const k = gatePins(p); gates.push({ ref: ref, fn: GATE[p.kind], ins: k.slice(0, -1).map(x => ref + '.' + x), out: ref + '.' + k[k.length - 1] });
      }
    });
    gates.forEach(g => { g.inN = g.ins.map(a => ix.net[a]); g.outN = ix.net[g.out]; if (g.outN !== undefined) driven[g.outN] = true; });
    return { base: base, driven: driven, gates: gates };
  }
  function logicRun(ix, prep, drive) {
    const val = Object.assign({}, prep.base), driven = Object.assign({}, prep.driven);
    Object.keys(drive || {}).forEach(n => { val[n] = !!drive[n]; driven[n] = true; });
    for (let pass = 0; pass < 60; pass++) {
      let ch = false;
      for (let i = 0; i < prep.gates.length; i++) {
        const g = prep.gates[i]; if (g.outN === undefined) continue;
        const r = !!g.fn.apply(null, g.inN.map(nn => (nn !== undefined ? !!val[nn] : false)));
        if (val[g.outN] !== r) { val[g.outN] = r; ch = true; }
      }
      if (!ch) break;
    }
    const open = [];
    prep.gates.forEach(g => g.ins.forEach((a, i) => { const nn = g.inN[i]; if (nn === undefined || !driven[nn]) open.push(a); }));
    return { val: val, open: open };
  }
  /* Signalnetz eines Ein-/Ausgangs: 'Teil.Pin' oder Teil (dann der Pin, der nicht an Versorgung liegt bzw. der letzte) */
  function resolveNet(ix, ref) {
    ref = String(ref == null ? '' : ref);
    if (ref.indexOf('.') >= 0) return ix.net[ref];
    const p = ix.parts[ref]; if (!p) return undefined;
    const keys = pinKeys(p);
    for (let i = keys.length - 1; i >= 0; i--) { const n = netOf(ix, ref, keys[i]); if (n !== undefined && !isSupply(n) && !isVdd(n)) return n; }
    return keys.length ? netOf(ix, ref, keys[keys.length - 1]) : undefined;
  }
  function gateCount(ix) {                    // Gatteräquivalente: 2-Eingangs-Gatter 1, NICHT 1, CMOS-Abschnitt (Eingänge - 1) wenn der Ausgang benutzt wird
    let n = 0;
    Object.keys(ix.parts).forEach(ref => {
      const p = ix.parts[ref];
      if (p.kind === 'NOT' || GATE[p.kind]) n += 1;
      else if (p.kind === 'ICX') {
        const def = ICX[icKey(p)]; if (!def) return;
        QUAD[def.sec].forEach(s => { const nets = ix.net[ref + '.' + s[s.length - 1]]; if (nets !== undefined && arr(ix.nets[nets]).length >= 2) n += s.length - 2; });
      }
    });
    return n;
  }
  const BUDGET = { 1: 12, 2: 8, 3: 11 };      // Gatteräquivalente (Abweichung von SPEC siehe ABWEICHUNGEN.md)

  /* ====================================================================== Datenblatt-Hilfen */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {                // Zahl in SI (V, A, W, Ohm) aus Zeile
    if (!row || !fin(row[field == null ? 'max' : field])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[field == null ? 'max' : field], row.unit) : row[field == null ? 'max' : field];
    return fin(x) ? x : NaN;
  }
  const isMos = ds => !!ds && ds.family === 'MOSFET';
  function pickInfo(pk) {
    const o = { ok: false, why: '', tr: null, di: null };
    if (!isObj(pk)) { o.why = 'Auswahl fehlt'; return o; }
    const items = arr(pk.items);
    const it = items.find(x => isObj(x) && x.role === 'transistor'), id = items.find(x => isObj(x) && x.role === 'diode');
    o.tr = it ? dsOf(it.ds) : null; o.di = id ? dsOf(id.ds) : null;
    o.vals = isObj(pk.vals) ? pk.vals : {}; o.calc = isObj(pk.calc) ? pk.calc : {};
    o.rB = numOf(o.vals.rB); o.hfeKey = typeof o.vals.hfeKey === 'string' ? o.vals.hfeKey : '';
    o.mos = isMos(o.tr);
    o.ok = !!(o.tr && o.di);
    if (!o.tr) o.why = 'Transistor nicht gewählt'; else if (!o.di) o.why = 'Diode nicht gewählt';
    return o;
  }
  const refOf = ds => (ds ? String(ds.ref || ds.part || ds.id) : '');
  const valueIs = (value, ds) => { const a = lc(value).replace(/[\s-]/g, ''), b = lc(refOf(ds)).replace(/[\s-]/g, ''); return !!b && (a === b || a.indexOf(b) === 0 || a.indexOf(b) >= 0); };

  /* ====================================================================== Treiberstufe: Modell (Fallback für nl.simulate, siehe ABWEICHUNGEN.md) */
  const U_BE = 0.7, U_CESAT = 0.2;           // 0,7 V sicher (SPEC Abschnitt 8); 0,2 V Sättigung aus dem Übungsdatenblatt BC547 (A)
  const RELAY_L = 1.5, RELAY_MECH_MS = 4, RELAY_PICK = 0.75;   // (A) Spuleninduktivität H, Mechanik ms, Anzug bei 75 % des Nennstroms
  function relayMs(P) { const tau = RELAY_L / P.rCoil; return RELAY_MECH_MS + tau * Math.log(1 / (1 - RELAY_PICK)) * 1000; }
  /* d = { mos, rb, hfe, rds, vgsth } ; opt = { vin, diodeRev } */
  function driverSim(d, P, opt) {
    opt = opt || {};
    const vin = opt.vin == null ? P.vOH : opt.vin, vcc = P.uCoil, rc = P.rCoil;
    const o = { iB: 0, iC: 0, iCoil: 0, uCE: vcc, uCoil: 0, uBE: 0, sat: false };
    if (d.mos) {
      if (vin > (d.vgsth || 2.1)) { const i = vcc / (rc + (d.rds || 2.6)); o.iC = i; o.iCoil = i; o.uCE = i * (d.rds || 2.6); o.uCoil = vcc - o.uCE; o.sat = true; }
      return o;
    }
    const rb = d.rb * (opt.rbMul || 1);
    o.iB = vin > U_BE && fin(rb) && rb > 0 ? (vin - U_BE) / rb : 0;
    o.uBE = o.iB > 0 ? U_BE : 0;
    const isat = (vcc - U_CESAT) / rc, ipot = (d.hfe || 200) * o.iB;
    if (opt.diodeRev) {
      if (o.iB > 0) { o.iC = ipot; o.uCE = vcc - U_BE; o.uCoil = U_BE; o.iCoil = U_BE / rc; }
      return o;
    }
    if (ipot >= isat) { o.iC = isat; o.uCE = U_CESAT; o.sat = true; } else { o.iC = ipot; o.uCE = vcc - ipot * rc; }
    o.iCoil = o.iC; o.uCoil = vcc - o.uCE;
    return o;
  }
  const hfeTyp = (pi) => { const r = dsRow(pi.tr, pi.hfeKey); return r && fin(r.typ) ? r.typ : (r && fin(r.min) ? r.min * 1.6 : 200); };
  const driverParams = pi => ({ mos: pi.mos, rb: pi.rB, hfe: pi.mos ? 0 : hfeTyp(pi), rds: pi.mos ? (dsVal(dsRow(pi.tr, 'rds45'), 'typ') || 2.6) : 0, vgsth: pi.mos ? (dsVal(dsRow(pi.tr, 'vgsth'), 'typ') || 2.1) : 0 });

  /* Aufbau der Treiberstufe aus einer Netzliste herausziehen (Topologie, nie Netznamen) */
  function findDriver(ix, P, pi) {
    const o = { ok: false, errs: [], q: null };
    const qs = ofKind(ix, 'NPN,NMOS');
    if (!qs.length) { o.errs.push('kein Transistor (NPN oder N-MOSFET) in der Schaltung'); return o; }
    const q = qs[0], mos = q.kind === 'NMOS';
    const pb = mos ? 'G' : 'B', pc = mos ? 'D' : 'C', pe = mos ? 'S' : 'E';
    o.q = q; o.mos = mos;
    const rly = ofKind(ix, 'RLY')[0];
    if (!rly) o.errs.push('kein Relais in der Schaltung');
    const sup = supplyOf(ix, P.uCoil);
    if (!sup) o.errs.push('keine ' + fm(P.uCoil, 0) + '-V-Quelle (Gleichspannung) in der Schaltung');
    const nB = netOf(ix, q.ref, pb), nC = netOf(ix, q.ref, pc), nE = netOf(ix, q.ref, pe);
    o.nB = nB; o.nC = nC; o.nE = nE;
    if (sup) { o.vcc = sup.plusNet; o.gnd = sup.minusNet; }
    if (rly && sup) {
      const a1 = netOf(ix, rly.ref, 'A1'), a2 = netOf(ix, rly.ref, 'A2');
      o.coilOk = (a1 === sup.plusNet && a2 === nC) || (a2 === sup.plusNet && a1 === nC);
      if (!o.coilOk) o.errs.push('die Relaisspule liegt nicht zwischen +' + fm(P.uCoil, 0) + ' V und dem Kollektor');
      o.rly = rly;
    }
    if (sup && nE !== sup.minusNet) o.errs.push('der Emitter liegt nicht an Masse');
    // Freilaufdiode: eine Diode (nicht LED) zwischen Kollektor und +12 V
    const ds = ofKind(ix, 'D,SCHOTTKY');
    o.dio = ds.find(x => { const a = netOf(ix, x.ref, 'A'), k = netOf(ix, x.ref, 'K'); return sup && ((a === nC && k === sup.plusNet) || (k === nC && a === sup.plusNet)); }) || null;
    if (!o.dio) o.errs.push('keine Freilaufdiode parallel zur Spule');
    else { o.diodeRev = !(netOf(ix, o.dio.ref, 'K') === (sup && sup.plusNet) && netOf(ix, o.dio.ref, 'A') === nC); if (o.diodeRev) o.errs.push('die Freilaufdiode ist verpolt (Kathode muss an +' + fm(P.uCoil, 0) + ' V)'); }
    // Basiswiderstand: der Widerstand am Basisnetz
    const rbs = ofKind(ix, 'R').filter(x => netOf(ix, x.ref, '1') === nB || netOf(ix, x.ref, '2') === nB);
    if (!rbs.length) {
      if (!mos) o.errs.push('kein Basiswiderstand an der Basis'); else o.nIn = nB;     // MOSFET: Gatewiderstand ist freiwillig
    } else {
      o.rbPart = rbs[0]; o.rb = numOf(rbs[0].value);
      o.nIn = netOf(ix, rbs[0].ref, '1') === nB ? netOf(ix, rbs[0].ref, '2') : netOf(ix, rbs[0].ref, '1');
    }
    if (o.nIn !== undefined) {
      const sw = ofKind(ix, 'SPST,PB,SPDT').find(x => pinKeys(x).some(k => netOf(ix, x.ref, k) === o.nIn));
      const v5 = ofKind(ix, 'BAT').find(b => Math.abs(numOf(b.value) - P.vOH) <= 0.3);
      o.inOk = !!(sw && v5);
      if (!o.inOk) o.errs.push('der Eingang IN ist keine ' + fm(P.vOH, 0) + '-V-Quelle mit Schalter am ' + (mos && !o.rbPart ? 'Gate' : 'Basiswiderstand'));
    }
    o.ok = o.errs.length === 0;
    return o;
  }

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
  function nlBuilder(name) {
    const parts = [], nets = {}, order = [];
    const b = {
      add(ref, kind, value, pins) {
        parts.push({ ref: ref, kind: kind, value: value == null ? '' : String(value), pins: Object.assign({}, pins) });
        Object.keys(pins).forEach(k => { const n = pins[k]; if (!nets[n]) { nets[n] = []; order.push(n); } nets[n].push(ref + '.' + k); });
        return b;
      },
      done() { return { v: 1, name: name, parts: parts, nets: order.map(n => ({ name: n, cls: (isSupply(n) || isVdd(n)) ? 'power' : 'signal', pins: nets[n].slice() })) }; }
    };
    return b;
  }
  function fmtRde(v) { return fmtR(v).replace('.', ','); }
  function fmtR(v) { v = rd(v, 6); return v >= 1e6 ? String(rd(v / 1e6, 3)) + 'M' : v >= 1000 ? String(rd(v / 1000, 3)) + 'k' : String(rd(v, 3)); }

  /* ====================================================================== vg1: Funk-Adressdecoder (DigiLab) */
  function buildDigi(P, variant) {
    const n = P.addrBits, b = nlBuilder('Funk-Adressdecoder');
    b.add('V1', 'BAT', '5', { '+': 'VCC', '-': 'GND' });
    const ins = [];
    for (let i = 0; i < n; i++) { b.add('SA' + i, 'SPST', '', { '1': 'VCC', '2': 'A' + i }); ins.push({ name: 'A' + i, ref: 'SA' + i + '.2' }); }
    for (let i = 0; i < n; i++) { b.add('SS' + i, 'SPST', '', { '1': 'VCC', '2': 'S' + i }); ins.push({ name: 'S' + i, ref: 'SS' + i + '.2' }); }
    let outRef;
    if (variant === 'ic' && n === 4) {
      b.add('U1', 'ICX', '4070', { '7': 'GND', '14': 'VCC', '1': 'A0', '2': 'S0', '3': 'x0', '5': 'A1', '6': 'S1', '4': 'x1', '8': 'A2', '9': 'S2', '10': 'x2', '12': 'A3', '13': 'S3', '11': 'x3' });
      b.add('U2', 'ICX', '4002', { '7': 'GND', '14': 'VCC', '2': 'x0', '3': 'x1', '4': 'x2', '5': 'x3', '1': 'MATCH' });
      outRef = 'U2.1';
    } else {
      let level = [];
      for (let i = 0; i < n; i++) { b.add('X' + i, 'XOR', '', { A: 'A' + i, B: 'S' + i, Y: 'x' + i }); level.push('x' + i); }
      let k = 0;
      while (level.length > 2) {
        const nx = [];
        for (let j = 0; j < level.length; j += 2) {
          if (j + 1 < level.length) { k++; b.add('G' + k, 'OR', '', { A: level[j], B: level[j + 1], Y: 'o' + k }); nx.push('o' + k); } else nx.push(level[j]);
        }
        level = nx;
      }
      b.add('GM', 'NOR', '', { A: level[0], B: level[1], Y: 'MATCH' });
      outRef = 'GM.Y';
    }
    return { netlist: b.done(), inputs: ins, outputs: [{ name: 'MATCH', ref: outRef, iMaxMa: P.iOutMax }], vdd: { min: 3, max: 15 } };
  }
  function checkDigi(data, ctx) {
    const P = P_(ctx), n = P.addrBits, lines = [];
    const ix = nlIdx(data && data.netlist);
    const inN = {}, ok0 = ix.ok && isObj(data);
    arr(data && data.inputs).forEach(i => { if (isObj(i)) inN[lc(i.name)] = resolveNet(ix, i.ref); });
    const outD = arr(data && data.outputs).find(o => isObj(o) && lc(o.name) === 'match');
    const outN = outD ? resolveNet(ix, outD.ref) : undefined;
    let miss = [];
    for (let i = 0; i < n; i++) { if (inN['a' + i] === undefined) miss.push('A' + i); if (inN['s' + i] === undefined) miss.push('S' + i); }
    const prep = ok0 ? logicPrep(ix) : null;
    const haveIO = ok0 && !miss.length && outN !== undefined && prep.gates.length > 0;
    let bad = 0, firstBad = null, hits = [];
    if (haveIO) {
      const total = Math.pow(2, 2 * n);
      for (let c = 0; c < total; c++) {
        const a = c & ((1 << n) - 1), s = c >> n, drive = {};
        for (let i = 0; i < n; i++) { drive[inN['a' + i]] = !!((a >> i) & 1); drive[inN['s' + i]] = !!((s >> i) & 1); }
        const r = logicRun(ix, prep, drive), m = !!r.val[outN];
        if (m !== (a === s)) { bad++; if (!firstBad) firstBad = { a: a, s: s, m: m }; }
      }
      const s0 = P.addr;
      for (let a = 0; a < (1 << n); a++) {
        const drive = {};
        for (let i = 0; i < n; i++) { drive[inN['a' + i]] = !!((a >> i) & 1); drive[inN['s' + i]] = !!((s0 >> i) & 1); }
        if (logicRun(ix, prep, drive).val[outN]) hits.push(a);
      }
    }
    lines.push(L(haveIO && bad === 0, 'Wahrheitstabelle: MATCH = 1 genau bei A = S (alle ' + Math.pow(2, 2 * n) + ' Kombinationen)' + (!haveIO ? ' – ' + (!ok0 ? 'keine Schaltung' : miss.length ? 'Eingänge fehlen: ' + miss.slice(0, 4).join(', ') : outN === undefined ? 'Ausgang MATCH nicht gefunden' : 'keine Gatter') : bad ? ' – ' + bad + ' falsch, z. B. A=' + firstBad.a + ', S=' + firstBad.s + ' gibt MATCH=' + (firstBad.m ? 1 : 0) : ''), 30));
    lines.push(L(haveIO && hits.length === 1 && hits[0] === P.addr, 'Torkennung ' + P.addr + ': mit Brücken passend zur Kennung genau ein Treffer' + (haveIO ? ' (gefunden: ' + (hits.length ? hits.join(', ') : 'keiner') + ')' : ''), 20));
    const gc = ok0 ? gateCount(ix) : 0, budget = BUDGET[LEVEL(ctx)];
    lines.push(L(ok0 && gc > 0 && gc <= budget, 'Gatterbudget: höchstens ' + budget + ' Gatter, gebaut ' + gc, 15));
    let supplyOk = ok0 && prep.gates.length > 0, supplyMsg = '';
    if (ok0) {
      const dr0 = {}; Object.keys(inN).forEach(k => { if (inN[k] !== undefined) dr0[inN[k]] = false; });
      const run = logicRun(ix, prep, dr0);
      if (run.open.length) { supplyOk = false; supplyMsg = 'offener Eingang ' + run.open[0]; }
      ofKind(ix, 'ICX').forEach(p => {
        const k = icKey(p), vccPin = '14', gndPin = '7';
        const nv = netOf(ix, p.ref, vccPin), ng = netOf(ix, p.ref, gndPin);
        if (nv === undefined || ng === undefined || !(isVdd(nv) || arr(ix.nets[nv]).length > 1) || !(isSupply(ng) || arr(ix.nets[ng]).length > 1)) { supplyOk = false; supplyMsg = supplyMsg || ('Versorgung (Pin 14 und 7) am IC ' + p.ref + ' fehlt'); }
        if (!k) { supplyOk = false; supplyMsg = supplyMsg || 'IC-Typ von ' + p.ref + ' unbekannt'; }
      });
      if (isObj(data.vdd) && fin(data.vdd.min) && fin(data.vdd.max) && !(data.vdd.min <= P.vOH && P.vOH <= data.vdd.max)) { supplyOk = false; supplyMsg = supplyMsg || 'Versorgungsbereich passt nicht zu ' + fm(P.vOH, 0) + ' V'; }
    }
    lines.push(L(supplyOk, 'Keine offenen Eingänge, Masse und Versorgung an allen Gattern' + (supplyMsg ? ' – ' + supplyMsg : ''), 20));
    const iOk = outD && sameVal(+outD.iMaxMa, P.iOutMax, 1e-6);
    lines.push(L(!!outD && outN !== undefined && iOk, 'Ausgang MATCH benannt, Treiberfähigkeit ' + fm(P.iOutMax, 0) + ' mA im Entwurf' + (outD ? (iOk ? '' : ' (angegeben: ' + (fin(+outD.iMaxMa) ? fm(+outD.iMaxMa, 2) : 'nichts') + ' mA)') : ' – kein Ausgang MATCH'), 15));
    return lines;
  }

  /* ====================================================================== vg2: Treiber auswählen (Datenblatt-Lab) */
  function chooseRb(P, hfeMin, iOutMax) {
    const iBreq = 2 * (P.iCoil / 1000) / hfeMin, rMax = (P.vOH - U_BE) / iBreq, rMin = (P.vOH - U_BE) / (iOutMax / 1000);
    const c = eList.filter(r => r >= rMin * 0.9999 && r <= rMax * 1.0001);
    if (!c.length) return null;
    const mid = Math.sqrt(rMin * rMax);
    c.sort((a, b) => Math.abs(Math.log(a / mid)) - Math.abs(Math.log(b / mid)));
    return c[0];
  }
  function dsSolution(ctx, variant) {
    const P = P_(ctx), dg = need(ctx, 'garage.digi');
    const o = dg && arr(dg.outputs).find(x => isObj(x) && lc(x.name) === 'match');
    const iOut = o && fin(+o.iMaxMa) ? +o.iMaxMa : P.iOutMax;
    if (variant === 'mos') {
      return { items: [{ role: 'transistor', ds: 'tf-2n7000', part: 'TF-2N7000', ref: '2N7000' }, { role: 'diode', ds: 'tf-1n4007', part: 'TF-1N4007', ref: '1N4007' }],
        calc: { iGmA: 0 }, vals: { rB: 100, hfeKey: '' } };
    }
    const hmin = dsVal(dsRow(dsOf('tf-bc547'), 'hfeB'), 'min');
    const rB = chooseRb(P, hmin, iOut) || 4700;
    return { items: [{ role: 'transistor', ds: 'tf-bc547', part: 'TF-BC547', ref: 'BC547' }, { role: 'diode', ds: 'tf-1n4007', part: 'TF-1N4007', ref: '1N4007' }],
      calc: { iBistMa: rd((P.vOH - U_BE) / rB * 1000, 3), hfeMin: hmin }, vals: { rB: rB, hfeKey: 'hfeB' } };
  }
  function checkDs(data, ctx) {
    const P = P_(ctx), lines = [], pi = pickInfo(data);
    const dg = slotOf(ctx, 'garage.digi'), od = dg && arr(dg.outputs).find(x => isObj(x) && lc(x.name) === 'match');
    const iOut = od && fin(+od.iMaxMa) ? +od.iMaxMa : NaN;
    const tr = pi.tr, di = pi.di, iC = P.iCoil / 1000;
    const vceo = tr ? dsVal(dsRow(tr, pi.mos ? 'vds' : 'vceo'), 'max') : NaN, icmax = tr ? dsVal(dsRow(tr, pi.mos ? 'id' : 'ic'), 'max') : NaN;
    lines.push(L(tr && vceo >= 2 * P.uCoil && icmax >= 2 * iC, 'Transistor-Grenzwerte: ' + (tr ? 'U_CE,max ' + fm(vceo, 0) + ' V (nötig mindestens ' + fm(2 * P.uCoil, 0) + ' V), I_C,max ' + fm(icmax * 1000, 0) + ' mA (nötig mindestens ' + fm(2 * P.iCoil, 0) + ' mA)' : 'kein Transistor gewählt'), 20));
    if (pi.mos) {
      const vth = dsVal(dsRow(tr, 'vgsth'), 'max');
      lines.push(L(vth < P.vOH - 1, 'Gate-Schwelle: V_GS(th),max ' + fm(vth, 1) + ' V muss kleiner sein als ' + fm(P.vOH - 1, 1) + ' V (Logikpegel minus 1 V)', 25));
      const rds = dsVal(dsRow(tr, 'rds45'), 'max');
      lines.push(L(fin(rds) && iC * rds <= 0.5, 'R_DS(on)-Zeile bei kleiner Gate-Spannung: ' + (fin(rds) ? fm(rds, 1) + ' Ω, Spannungsabfall ' + fm(iC * rds * 1000, 0) + ' mV (höchstens 500 mV)' : 'keine Zeile gefunden'), 10));
    } else {
      const hrow = tr ? dsRow(tr, pi.hfeKey) : null, hmin = hrow ? dsVal(hrow, 'min') : NaN;
      const iBreq = fin(hmin) ? 2 * iC / hmin : NaN, iBist = fin(pi.rB) && pi.rB > 0 ? (P.vOH - U_BE) / pi.rB : NaN;
      const okB = tr && fin(iBreq) && fin(iBist) && iBist >= iBreq * (1 - 1e-9) && fin(iOut) && iBist <= iOut / 1000 * (1 + 1e-9);
      lines.push(L(okB, 'Basisstrom: nötig mindestens ' + fm(iBreq * 1000, 2) + ' mA (Übersteuerung 2 mit h_FE,min ' + fm(hmin, 0) + '), tatsächlich ' + fm(iBist * 1000, 2) + ' mA, der Ausgang liefert höchstens ' + (fin(iOut) ? fm(iOut, 2) : '?') + ' mA' + (!hrow ? ' – h_FE-Zeile fehlt' : ''), 25));
      const calcOk = !fin(+pi.calc.iBistMa) || sameVal(+pi.calc.iBistMa / 1000, iBist, 0.05);
      lines.push(L(fin(pi.rB) && isE(pi.rB, 'E12') && calcOk, 'R_B aus der E12-Reihe (' + (fin(pi.rB) ? fmtRde(pi.rB) + ' Ω' : 'fehlt') + (calcOk ? '' : ', der angegebene Basisstrom stimmt nicht mit (U_OH - 0,7 V)/R_B überein') + ')', 10));
    }
    const vrrm = di ? dsVal(dsRow(di, 'vrrm'), 'max') : NaN;
    const ifm = di ? (dsVal(dsRow(di, 'if'), 'max') || dsVal(dsRow(di, 'ifav'), 'max')) : NaN;
    lines.push(L(di && fin(vrrm) && fin(ifm) && vrrm >= 2 * P.uCoil && ifm >= iC, 'Freilaufdiode: V_RRM ' + fm(vrrm, 0) + ' V (nötig mindestens ' + fm(2 * P.uCoil, 0) + ' V), I_F ' + fm(ifm * 1000, 0) + ' mA (nötig mindestens ' + fm(P.iCoil, 0) + ' mA)' + (di && !fin(vrrm) ? ' – das ist keine Diode mit V_RRM (Z-Diode?)' : ''), 20));
    let pw = NaN, derOk = false;
    if (tr) {
      pw = pi.mos ? iC * iC * (dsVal(dsRow(tr, 'rds45'), 'max') || 5.3) : (Math.max(dsVal(dsRow(tr, 'vcesat100'), 'max') || 0, dsVal(dsRow(tr, 'vcesat10'), 'max') || 0, dsVal(dsRow(tr, 'vcesat'), 'max') || 0, 0.3)) * iC + U_BE * (fin(pi.rB) && pi.rB > 0 ? (P.vOH - U_BE) / pi.rB : 0);
      const d = DS().derate(tr, { tAmb: P.tAmb, ptot: pw });
      derOk = !!(d && d.ok);
    }
    lines.push(L(derOk, 'Verlustleistung ' + (fin(pw) ? fm(pw * 1000, 0) + ' mW' : '?') + ' bei ' + P.tAmb + ' °C Umgebung: Derating des Datenblatts ' + (derOk ? 'eingehalten' : 'nicht eingehalten'), 15));
    const complete = !!(tr && di && (tr.family === 'Transistor' || tr.family === 'MOSFET') && di.family === 'Diode');
    lines.push(L(complete, 'Auswahl vollständig: Transistor und Freilaufdiode aus den Übungsdatenblättern' + (!tr ? ' (Transistor fehlt)' : !di ? ' (Diode fehlt)' : !complete ? ' (falsche Bauteilart)' : ''), 10));
    return lines;
  }

  /* ====================================================================== vg3: Treiberstufe zeichnen (SchaltLab) */
  function buildSch(P, pk) {
    const pi = pickInfo(pk), b = nlBuilder('Relaistreiber Garagentor');
    const rb = pi.mos ? (fin(pi.rB) ? pi.rB : 100) : pi.rB;
    const led = dsOf('tf-led-r'), vf = led && dsVal(dsRow(led, 'vf10'), 'typ') || 1.91;
    const rLed = eList.filter(r => (P.uCoil - vf) / r >= 0.0075).pop() || 1000;
    b.add('V1', 'BAT', fm(P.uCoil, 0).replace(',', '.'), { '+': 'VCC', '-': 'GND' });
    b.add('V2', 'BAT', fm(P.vOH, 0).replace(',', '.'), { '+': 'N_V2', '-': 'GND' });
    b.add('S1', 'SPST', '', { '1': 'N_V2', '2': 'IN' });
    b.add('R1', 'R', fmtR(rb), { '1': 'IN', '2': 'N_B' });
    if (pi.mos) b.add('Q1', 'NMOS', refOf(pi.tr), { G: 'N_B', D: 'N_C', S: 'GND' });
    else b.add('Q1', 'NPN', refOf(pi.tr), { B: 'N_B', C: 'N_C', E: 'GND' });
    b.add('K1', 'RLY', fm(P.uCoil, 0).replace(',', '.') + 'V', { A1: 'VCC', A2: 'N_C', COM: 'K1_COM', NO: 'K1_NO', NC: 'K1_NC' });
    b.add('D1', 'D', refOf(pi.di), { A: 'N_C', K: 'VCC' });
    b.add('R2', 'R', fmtR(rLed), { '1': 'VCC', '2': 'N_L' });
    b.add('D2', 'LED', 'rot', { A: 'N_L', K: 'GND' });
    const sim = driverSim(driverParams(Object.assign({}, pi, { rB: rb })), P);
    return {
      lab: 'sch', name: 'Relaistreiber Garagentor', netlist: b.done(),
      meas: { I_C_mA: rd(sim.iC * 1000, 3), U_CE_V: rd(sim.uCE, 3), U_BE_V: rd(sim.uBE, 3), I_coil_mA: rd(sim.iCoil * 1000, 3), I_LED_mA: rd((P.uCoil - vf) / rLed * 1000, 3) },
      snap: {}
    };
  }
  function checkSch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [];
    const pk = need(ctx, 'garage.ds'), pi = pickInfo(pk);
    const ix = nlIdx(data && data.netlist);
    const d = ix.ok ? findDriver(ix, P, pi) : { ok: false, errs: ['keine Schaltung (Netzliste leer)'] };
    // 1: Werte entsprechen der Auswahl
    const errs1 = [];
    if (!pi.ok) errs1.push('die Auswahl der Datenblatt-Station fehlt');
    else {
      if (!d.q || !valueIs(d.q.value, pi.tr)) errs1.push('Transistor ' + (d.q ? '„' + d.q.value + '“' : 'fehlt') + ' statt ' + refOf(pi.tr));
      if (!d.dio || !valueIs(d.dio.value, pi.di)) errs1.push('Diode ' + (d.dio ? '„' + d.dio.value + '“' : 'fehlt') + ' statt ' + refOf(pi.di));
      if (!pi.mos && !(d.rbPart && sameVal(d.rb, pi.rB, 1e-3))) errs1.push('R_B ' + (d.rbPart ? fmtRde(d.rb) : 'fehlt') + ' statt ' + fmtRde(pi.rB));
    }
    lines.push(L(errs1.length === 0, 'Bauteilwerte entsprechen der Auswahl (Transistor ' + (pi.tr ? refOf(pi.tr) : '?') + ', R_B ' + (fin(pi.rB) ? fmtRde(pi.rB) + ' Ω' : '?') + ', Diode ' + (pi.di ? refOf(pi.di) : '?') + ')' + (errs1.length ? ' – ' + errs1[0] : ''), 20));
    // 2: Topologie
    lines.push(L(d.ok, 'Topologie: Spule zwischen +' + fm(P.uCoil, 0) + ' V und Kollektor, Emitter an Masse, Freilaufdiode antiparallel, Basis über R_B an IN' + (d.errs.length ? ' – ' + d.errs[0] : ''), 25));
    // 3: LED mit Vorwiderstand
    const led = dsOf('tf-led-r'), vf = led && dsVal(dsRow(led, 'vf10'), 'typ') || 1.91;
    let iLed = NaN, rLed = NaN;
    if (ix.ok) {
      const lp = ofKind(ix, 'LED')[0], sup = supplyOf(ix, P.uCoil);
      if (lp && sup) {
        const na = netOf(ix, lp.ref, 'A'), nk = netOf(ix, lp.ref, 'K');
        const rr = ofKind(ix, 'R').find(x => { const a = netOf(ix, x.ref, '1'), b = netOf(ix, x.ref, '2'); return (a === na && b === sup.plusNet) || (b === na && a === sup.plusNet); });
        if (rr && nk === sup.minusNet) { rLed = numOf(rr.value); iLed = (P.uCoil - vf) / rLed * 1000; }
      }
    }
    lines.push(L(fin(iLed) && iLed >= 5 && iLed <= 15 && isE(rLed, 'E24'), 'Betriebs-LED: Vorwiderstand ' + (fin(rLed) ? fmtRde(rLed) + ' Ω, LED-Strom ' + fm(iLed, 1) + ' mA (verlangt 5 bis 15 mA, E-Reihe)' : 'fehlt oder falsch angeschlossen'), 15));
    // 4: Simulation
    const usable = !!(d.q && d.rly && d.coilOk && (d.mos || fin(d.rb)));
    let sOn = null, sOff = null;
    if (usable) {
      const dp = driverParams({ mos: d.mos, rB: d.rb, hfeKey: pi.hfeKey, tr: pi.tr });
      sOn = driverSim(dp, P, { vin: P.vOH, diodeRev: !!d.diodeRev });
      sOff = driverSim(dp, P, { vin: 0, diodeRev: !!d.diodeRev });
    }
    const dI = sOn ? Math.abs(sOn.iCoil * 1000 - P.iCoil) / P.iCoil : NaN;
    lines.push(L(sOn && dI <= 0.15 * tol, 'Simulation bei IN = ' + fm(P.vOH, 0) + ' V: Spulenstrom ' + (sOn ? fm(sOn.iCoil * 1000, 1) : '?') + ' mA, erwartet ' + fm(P.iCoil, 1) + ' mA (±' + fm(15 * tol, 0) + ' %)' + (usable ? '' : ' – Schaltung nicht auswertbar'), 15));
    lines.push(L(sOn && sOn.uCE < 0.3, 'Simulation: Sättigungsspannung U_CE ' + (sOn ? fm(sOn.uCE, 2) : '?') + ' V (unter 0,3 V, A)', 8));
    lines.push(L(sOff && sOff.iCoil < 0.001, 'Simulation bei IN = 0 V: Spulenstrom ' + (sOff ? fm(sOff.iCoil * 1000, 2) : '?') + ' mA (unter 1 mA, das Relais fällt ab)', 7));
    // 5: Pins
    const bad = [];
    if (ix.ok) {
      Object.keys(ix.parts).forEach(ref => {
        const p = ix.parts[ref];
        if (['R', 'D', 'LED', 'NPN', 'NMOS', 'BAT', 'SPST'].indexOf(p.kind) >= 0 || p.kind === 'RLY') {
          const keys = p.kind === 'RLY' ? ['A1', 'A2'] : pinKeys(p);
          keys.forEach(k => { const nn = netOf(ix, ref, k); if (nn === undefined || arr(ix.nets[nn]).length < 2) bad.push(ref + '.' + k); });
        }
      });
    }
    lines.push(L(ix.ok && bad.length === 0 && ix.dups.length === 0, 'Alle Pins zugeordnet (' + Object.keys(ix.parts).length + ' Bauteile, ' + Object.keys(ix.nets).length + ' Netze), kein offener Basisanschluss' + (bad.length ? ' – offen: ' + bad.slice(0, 3).join(', ') : ix.dups.length ? ' – Pin in zwei Netzen: ' + ix.dups[0] : ''), 10));
    return lines;
  }

  /* ====================================================================== vg4: Platine entwerfen (Leiterplatten-Lab) */
  /* Footprint- und Pin-Zuordnung (Pads je Pinname). Mehrere Zuordnungen = gleichwertig zulässig (TO-92 gibt es mit C-B-E und E-B-C). */
  const FPMAP = {
    R: { fp: ['R_AXIAL_10'], maps: [{ '1': '1', '2': '2' }] },
    LED: { fp: ['LED_5MM', 'LED5'], maps: [{ A: '2', K: '1' }] },
    D: { fp: ['D_DO41', 'DO-41', 'D_DO-41'], fallback: 'R_AXIAL_10', maps: [{ A: '2', K: '1' }] },
    NPN: { fp: ['TO-92'], maps: [{ C: '1', B: '2', E: '3' }, { E: '1', B: '2', C: '3' }] },
    NMOS: { fp: ['TO-92'], maps: [{ S: '1', G: '2', D: '3' }, { D: '1', G: '2', S: '3' }] },
    RLY: { fp: ['RELAY_SRD', 'RELAIS', 'RELAY', 'RLY'], fallback: 'HDR_2x5', maps: [{ A1: '1', A2: '2', COM: '3', NO: '4', NC: '5' }] }
  };
  const TERM_FP = ['TERMINAL_2', 'SCHRAUBKLEMME_2', 'SCREW_2', 'HDR_1x2'];
  const isTermFp = fp => /^(HDR_1x|TERMINAL|SCREW|SCHRAUB)/i.test(String(fp || ''));
  const isTerm = p => isObj(p) && (/^X\d/i.test(String(p.ref || '')) || isTermFp(p.fp));
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
  /* Erwartete Netze der Platine aus der Netzliste: { nets:[{name, pads:[ 'R1.2'...], ext:bool }], missing:[refs] } je Zuordnungsvariante */
  function expectedNets(ixs, board, variant) {
    const bparts = {}; arr(board && board.parts).forEach(p => { if (isObj(p)) bparts[p.ref] = p; });
    const missing = [], nets = [];
    Object.keys(ixs.nets).forEach(name => {
      const pads = [], flags = { ext: false };
      ixs.nets[name].forEach(pin => {
        const dot = pin.indexOf('.'), ref = pin.slice(0, dot), pn = pin.slice(dot + 1), part = ixs.parts[ref];
        if (!part) return;
        if (SRC_KINDS[part.kind]) { flags.ext = true; return; }
        const fm_ = FPMAP[part.kind];
        if (!fm_) return;
        if (part.kind === 'RLY' && (pn === 'COM' || pn === 'NO')) flags.ext = true;
        if (!bparts[ref]) { if (missing.indexOf(ref) < 0) missing.push(ref); return; }
        const map = fm_.maps[Math.min(variant[part.kind] || 0, fm_.maps.length - 1)];
        if (map[pn] !== undefined) pads.push(ref + '.' + map[pn]);
      });
      if (pads.length) nets.push({ name: name, pads: pads, ext: flags.ext });
    });
    return { nets: nets, missing: missing };
  }
  function boardEquiv(ixs, board) {
    const kinds = {}; Object.keys(ixs.parts).forEach(r => { const k = ixs.parts[r].kind; if (FPMAP[k] && FPMAP[k].maps.length > 1) kinds[k] = FPMAP[k].maps.length; });
    const ks = Object.keys(kinds);
    let combos = [{}];
    ks.forEach(k => { const nx = []; combos.forEach(c => { for (let i = 0; i < kinds[k]; i++) { const o = Object.assign({}, c); o[k] = i; nx.push(o); } }); combos = nx; });
    const bnet = {}; arr(board.nets).forEach(n => { if (isObj(n)) arr(n.pins).forEach(p => { if (bnet[String(p)] === undefined) bnet[String(p)] = n.name; }); });
    const terms = arr(board.parts).filter(isTerm);
    const termPads = [];
    if (terms.length && PCB()) { PCB().padsOf(board).forEach(p => { if (terms.some(t => t.ref === p.ref)) termPads.push(p.id); }); }
    let best = null;
    combos.forEach(variant => {
      const ex = expectedNets(ixs, board, variant), viol = [];
      ex.missing.forEach(r => viol.push('Bauteil ' + r + ' fehlt auf der Platine'));
      const seen = {};
      ex.nets.forEach(n => {
        const names = n.pads.map(p => bnet[p]);
        const none = n.pads.filter((p, i) => names[i] === undefined);
        if (none.length === n.pads.length && n.pads.length === 1 && !n.ext) return;      // einzelner freier Pad (z. B. Relais NC)
        if (none.length) { viol.push('Pad ' + none[0] + ' (Netz ' + n.name + ') ist keinem Netz zugeordnet'); return; }
        const first = names[0];
        const diff = n.pads.find((p, i) => names[i] !== first);
        if (diff) { viol.push(n.pads[0] + ' und ' + diff + ' müssen im gleichen Netz liegen (' + n.name + ')'); return; }
        if (seen[first]) viol.push('die Netze ' + seen[first] + ' und ' + n.name + ' sind auf der Platine verbunden');
        else seen[first] = n.name;
        n.bname = first;
        if (n.ext) {
          const hasT = termPads.some(tp => bnet[tp] === first);
          if (!hasT) viol.push('Netz ' + n.name + ' hat keine Anschlussklemme');
        }
      });
      const goodNames = {}; ex.nets.forEach(n => { if (n.ext && n.bname !== undefined) goodNames[n.bname] = 1; });
      termPads.forEach(tp => { if (bnet[tp] === undefined) viol.push('Klemmenpin ' + tp + ' ist nirgends angeschlossen'); else if (!goodNames[bnet[tp]]) viol.push('Klemmenpin ' + tp + ' hängt an keinem Anschlussnetz der Schaltung'); });
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
    const sch = need(ctx, 'garage.sch'), ixs = nlIdx(sch && sch.netlist);
    const board = asBoard(data && data.board);
    if (!board || !ixs.ok || !PCB()) { return [L(false, 'Platine oder Schaltplan fehlt, die Platine lässt sich nicht prüfen', 100)]; }
    const norm = PCB().normalize(board);
    const st = boardStats(norm), eq = boardEquiv(ixs, norm), nParts = arr(norm.parts).length;
    lines.push(L(nParts > 0 && eq.viol.length === 0, 'Netze der Platine identisch zur Netzliste (jeder Pin im richtigen Netz, Klemmen für 12 V, IN, Relaiskontakt)' + (eq.viol.length ? ' – ' + eq.viol[0] + (eq.viol.length > 1 ? ' (+' + (eq.viol.length - 1) + ' weitere)' : '') : ''), 25));
    const needNets = eq.nets.filter(n => n.pads.length >= 2 || n.ext).length;
    lines.push(L(nParts > 0 && st.unrouted === 0 && arr(norm.nets).length >= needNets && needNets > 0, 'Alle Netze verlegt: offene Verbindungen ' + st.unrouted + (arr(norm.nets).length < needNets ? ', es fehlen Netze auf der Platine' : ''), 20));
    lines.push(L(nParts > 0 && st.errs.length === 0, 'DRC ohne Fehler: ' + st.errs.length + ' Fehler' + (st.errs.length ? ' (' + String(st.errs[0].msg).slice(0, 60) + ')' : '') + (nParts ? '' : ' – die Platine ist leer'), 20));
    // Leistungsnetze: Netze der Relaisspule
    const coilNets = []; eq.nets.forEach(n => { if (n.pads.some(p => /^K\d+\.[12]$/.test(p)) && n.bname !== undefined) coilNets.push(n.bname); });
    const need_ = Math.max(PCB().ipcWidth(1.5 * P.iCoil / 1000, { oz: norm.copperOz || 1 }), 0.3);
    let minW = Infinity, nTr = 0;
    arr(norm.tracks).forEach(t => { const nm = st.conn.itemNet && st.conn.itemNet[t.id] || t.net; if (coilNets.indexOf(nm) >= 0) { nTr++; minW = Math.min(minW, +t.w || 0); } });
    lines.push(L(nTr > 0 && minW >= need_ - 1e-9, 'Leistungsnetze (Spule): Bahnbreite mindestens ' + fm(need_, 2) + ' mm (IPC-2221 mit 1,5 · I, mindestens 0,3 mm (A))' + (nTr ? ', schmalste ' + fm(minW, 2) + ' mm' : ' – keine Leiterbahnen'), 10));
    lines.push(L(fin(norm.w) && fin(norm.h) && norm.w <= P.boardW + 1e-6 && norm.h <= P.boardH + 1e-6 && norm.w >= 20 && norm.h >= 15 && norm.layers >= 1 && norm.layers <= P.layers, 'Maße und Lagen: ' + fm(norm.w, 0) + ' x ' + fm(norm.h, 0) + ' mm, ' + norm.layers + ' Lagen (höchstens ' + P.boardW + ' x ' + P.boardH + ' mm, ' + P.layers + ' Lagen)', 10));
    let edgeOk = false, inOk = nParts > 0, edgeTxt = '';
    if (eq.termPads.length) {
      const pads = PCB().padsOf(norm).filter(p => eq.termPads.indexOf(p.id) >= 0);
      const far = pads.filter(p => Math.min(p.x, norm.w - p.x, p.y, norm.h - p.y) > 3 + 1e-9);
      edgeOk = pads.length > 0 && far.length === 0; edgeTxt = far.length ? 'Klemme ' + far[0].id + ' ist mehr als 3 mm vom Rand entfernt' : '';
    } else edgeTxt = 'keine Klemmen';
    arr(norm.parts).forEach(p => { const r = courtyardRect(norm, p); if (!r || r.x0 < -1e-9 || r.y0 < -1e-9 || r.x1 > norm.w + 1e-9 || r.y1 > norm.h + 1e-9) { inOk = false; edgeTxt = edgeTxt || 'Bauteil ' + p.ref + ' ragt über den Platinenrand'; } });
    lines.push(L(edgeOk && inOk, 'Anschlüsse höchstens 3 mm vom Rand, alle Bauteile samt Courtyard auf der Platine' + (edgeTxt ? ' – ' + edgeTxt : ''), 5));
    const rep = isObj(data.report) ? data.report : null, own = boardReport(norm);
    let repOk = !!rep && fin(own.cost);
    if (repOk) {
      repOk = sameVal(+rep.w, norm.w, 0.01) && sameVal(+rep.h, norm.h, 0.01) && +rep.layers === norm.layers && +rep.unrouted === own.unrouted
        && (+rep.drcErrors === own.drcErrors || +rep.drcErrors === own.drcErrors + st.unconnected.length) && sameVal(+rep.cost, own.cost, 0.01)
        && (+rep.bomCount === nParts || +rep.bomCount === arr(PCB().bom(norm)).length);
    }
    lines.push(L(repOk, 'Kennzahlen (Maße, DRC, offene Netze, Kosten ' + (fin(own.cost) ? fm(own.cost, 2) + ' €' : '?') + ', Stückliste) im Bericht stimmen mit der Platine überein' + (rep ? '' : ' – Bericht fehlt'), 10));
    return lines;
  }
  const boardCacheSol = new Map();
  function buildBoard(nlIn, P) {
    const ixs = nlIdx(nlIn), c = PCB();
    const key = hash(JSON.stringify([nlIn, P.boardW, P.boardH, P.layers]));
    if (boardCacheSol.has(key)) return clone(boardCacheSol.get(key));
    const drv = findDriver(ixs, P, { mos: false });
    const sup = supplyOf(ixs, P.uCoil), rly = ofKind(ixs, 'RLY')[0];
    if (!sup || !rly) return clone(c.newBoard({ id: 'garage', name: 'Treiberplatine Garagentor', w: P.boardW, h: P.boardH, layers: P.layers }));
    const ext = [['X1', [sup && sup.plusNet, sup && sup.minusNet], '12V'], ['X2', [drv.nIn, sup && sup.minusNet], 'IN'], ['X3', [rly && netOrPin(ixs, rly.ref, 'COM'), rly && netOrPin(ixs, rly.ref, 'NO')], 'KONTAKT']];
    const bps = Object.keys(ixs.parts).map(k => ixs.parts[k]).filter(p => FPMAP[p.kind]);
    const order = ['K1', 'Q1', 'D1', 'R1', 'R2', 'D2'];
    bps.sort((a, b) => { const ia = order.indexOf(a.ref), ib = order.indexOf(b.ref); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const variants = [{ rot: 0, gap: 2.5 }, { rot: 90, gap: 2.5 }, { rot: 0, gap: 4 }, { rot: 90, gap: 4 }, { rot: 0, gap: 6 }];
    let last = null;
    for (let vi = 0; vi < variants.length; vi++) {
      const v = variants[vi], board = c.newBoard({ id: 'garage', name: 'Treiberplatine Garagentor', w: P.boardW, h: P.boardH, layers: P.layers });
      let cx = 10, cy = 4, rowH = 0, n = 0;
      bps.forEach(p => {
        const fpId = fpPick(p.kind), fp = c.footprint(fpId);
        const rot = p.kind === 'RLY' ? v.rot : 0;
        const probe = { x: 0, y: 0, rot: rot, side: 'top', fp: fpId };
        const cr = courtyardRect(board, probe) || { x0: -3, x1: 3, y0: -3, y1: 3 };
        const w = cr.x1 - cr.x0, h = cr.y1 - cr.y0;
        if (cx + w > P.boardW - 2) { cx = 10; cy += rowH + v.gap; rowH = 0; }
        board.parts.push({ id: 'p' + (++n), ref: p.ref, fp: fpId, x: rd(cx - cr.x0, 2), y: rd(cy - cr.y0, 2), rot: rot, side: 'top', value: p.value });
        cx += w + v.gap; rowH = Math.max(rowH, h);
      });
      const termFp = TERM_FP.find(fpExists) || 'HDR_1x2';
      ext.forEach((e, i) => board.parts.push({ id: 'p' + (++n), ref: e[0], fp: termFp, x: 2.8, y: rd(8 + i * 12, 1), rot: 0, side: 'top', value: e[2] }));
      // Netze
      const nets = {}, order2 = [];
      const addPad = (name, pad) => { if (name === undefined) return; if (!nets[name]) { nets[name] = []; order2.push(name); } nets[name].push(pad); };
      bps.forEach(p => { const map = FPMAP[p.kind].maps[0], pins0 = ixs.parts[p.ref].pins || {}; Object.keys(pins0).concat(p.kind === 'RLY' ? ['COM', 'NO'].filter(k => !(k in pins0)) : []).forEach(pn => { if (map[pn] !== undefined) addPad(p.kind === 'RLY' && (pn === 'COM' || pn === 'NO') ? netOrPin(ixs, p.ref, pn) : netOf(ixs, p.ref, pn), p.ref + '.' + map[pn]); }); });
      ext.forEach(e => { addPad(e[1][0], e[0] + '.1'); addPad(e[1][1], e[0] + '.2'); });
      const coilNets = [rly ? netOf(ixs, rly.ref, 'A1') : null, rly ? netOf(ixs, rly.ref, 'A2') : null];
      board.nets = order2.filter(nm => nets[nm].length >= 2).map(nm => { const o = { name: nm, cls: (isSupply(nm) || nm === sup.plusNet) ? 'power' : 'signal', pins: nets[nm] }; if (coilNets.indexOf(nm) >= 0) { o.cls = 'power'; o.width = 0.4; } return o; });
      const r = c.autoroute(board, {});
      const res = r.board || board;
      last = res;
      const st = boardStats(res);
      if (!r.failed.length && st.unrouted === 0 && st.errs.length === 0) break;
    }
    boardCacheSol.set(key, clone(last));
    return clone(last);
  }

  /* ====================================================================== vg5: Inbetriebnahme messen (MessLab) */
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
  function messTruth(ctx, withFault) {
    const P = P_(ctx), pi = pickInfo(need(ctx, 'garage.ds'));
    const dp = driverParams(pi), opt = { vin: P.vOH };
    if (withFault && P.fault === 'rb10') opt.rbMul = 10;
    if (withFault && P.fault === 'diodeRev') opt.diodeRev = true;
    const s = driverSim(dp, P, opt);
    return { U_sup: P.uCoil, U_BE: pi.mos ? P.vOH : s.uBE, U_CE: s.uCE, U_coil: s.uCoil, I_coil: s.iCoil * 1000, tRelaisMs: relayMs(P) };
  }
  const scaleTo = (v, unit, base) => { const u = String(unit || base); if (u === 'mV' && base === 'V') return v / 1000; if (u === 'A' && base === 'mA') return v * 1000; if (u === 's' && base === 'ms') return v * 1000; if (u === 'µA' && base === 'mA') return v / 1000; return v; };
  function rowOf(rows, key) { return arr(rows).find(r => isObj(r) && normId(r.id || r.label) === key) || null; }
  function rowVal(r, base) { if (!r) return NaN; const v = fin(r.ist) ? r.ist : numOf(r.ist); return fin(v) ? scaleTo(v, r.unit, base) : NaN; }
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [];
    const rows = arr(data && data.rows), truth = messTruth(ctx, true), design = messTruth(ctx, false);
    const spec = [['usup', 'U_sup', 'V', 'U_sup'], ['ube', 'U_BE', 'V', 'U_BE'], ['uce', 'U_CE', 'V', 'U_CE'], ['ucoil', 'U_coil', 'V', 'U_coil']];
    const faulty = !!P.fault;
    spec.forEach(s => {
      if (faulty && s[0] === 'ucoil') return;
      const r = rowOf(rows, s[0]), v = rowVal(r, 'V'), t = truth[s[3]], tl = Math.max(0.03 * tol * Math.abs(t), 0.02 * tol);
      lines.push(L(r && fin(v) && Math.abs(v - t) <= tl, s[1] + ': ' + (fin(v) ? 'gemessen ' + fm(v, 2) + ' V' : 'nicht eingetragen') + ', erwartet ' + fm(t, 2) + ' V (±' + fm(tl, 2) + ' V)' + (faulty && Math.abs(t - design[s[3]]) > tl ? ' – hier weicht die Anlage vom Entwurf ab' : ''), 15));
    });
    if (faulty) {
      const f = arr(data && data.findings).map(lc).join(' | ');
      const words = P.fault === 'rb10' ? ['basis', 'r_b', 'rb', 'vorwiderstand', 'widerstand'] : ['diode', 'freilauf'];
      const kind = P.fault === 'rb10' ? /(zu gro|zu hoch|zehn|10 ?x|10-fach|10fach|verzehnfacht|statt)/.test(f) : /(verpol|falsch ?herum|umgekehrt|falsch gepolt|polarit|falsch eingebaut)/.test(f);
      lines.push(L(words.some(w => f.indexOf(w) >= 0) && kind, 'Fehler benannt: ' + (P.fault === 'rb10' ? 'Basiswiderstand zehnmal zu groß' : 'Freilaufdiode verpolt') + (f ? '' : ' – kein Befund eingetragen'), 15));
    }
    const rv = data && isObj(data.values) && fin(+data.values.tRelaisMs) ? +data.values.tRelaisMs : rowVal(rowOf(rows, 'trelaisms') || rowOf(rows, 'trelais'), 'ms');
    const tr = relayMs(P);
    lines.push(L(fin(rv) && Math.abs(rv - tr) <= 0.2 * tol * tr, 'Relais-Ansprechzeit: ' + (fin(rv) ? 'gemessen ' + fm(rv, 1) + ' ms' : 'nicht eingetragen') + ', erwartet ' + fm(tr, 1) + ' ms (Relaismodell, A; ±' + fm(20 * tol, 0) + ' %)', 25));
    const pcb = slotOf(ctx, 'garage.pcb'), pb = pcb && asBoard(pcb.board), bnames = {}; arr(pb && pb.nets).forEach(n => { bnames[n.name] = 1; });
    const need6 = ['usup', 'ube', 'uce', 'ucoil', 'icoil'];
    const miss = need6.filter(k => { const r = rowOf(rows, k); return !r || !fin(rowVal(r, k === 'icoil' ? 'mA' : 'V')) || !String(r.unit || '').trim() || !String(r.instrument || '').trim(); });
    const badTp = rows.filter(r => isObj(r) && r.tp && pb && !bnames[r.tp]);
    lines.push(L(miss.length === 0 && badTp.length === 0, 'Protokoll vollständig: fünf Messzeilen mit Wert, Einheit und Messgerät, Prüfpunkte liegen auf der Platine' + (miss.length ? ' – fehlt: ' + miss[0] : badTp.length ? ' – Prüfpunkt „' + badTp[0].tp + '“ gibt es auf der Platine nicht' : ''), 15));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), t = messTruth(ctx, true), d = messTruth(ctx, false), pcb = need(ctx, 'garage.pcb'), pb = asBoard(pcb && pcb.board);
    const sch = need(ctx, 'garage.sch'), drv = sch && isObj(sch.netlist) ? findDriver(nlIdx(sch.netlist), P, { mos: false }) : null;
    const role = { vcc: drv && drv.vcc, n_b: drv && drv.nB, n_c: drv && drv.nC, in: drv && drv.nIn };      // Netznamen aus dem Schaltplan des Labs (N1, V1 ...), nicht die idealen Namen
    const nm = n => { const bn = arr(pb && pb.nets), m = bn.find(x => lc(x.name) === n) || (role[n] ? bn.find(x => x.name === role[n]) : null); return m ? m.name : n.toUpperCase(); };
    const mk = (id, label, unit, key, ins, tp) => ({ id: id, label: label, unit: unit, soll: rd(d[key], 3), ist: rd(t[key], 3), tol: 3, instrument: ins, tp: tp });
    const rows = [mk('U_sup', 'Versorgung', 'V', 'U_sup', 'Multimeter', nm('vcc')), mk('U_BE', 'Basis-Emitter-Spannung', 'V', 'U_BE', 'Multimeter', nm('n_b')),
      mk('U_CE', 'Kollektor-Emitter-Spannung', 'V', 'U_CE', 'Multimeter', nm('n_c')), mk('U_coil', 'Spulenspannung', 'V', 'U_coil', 'Multimeter', nm('n_c')),
      mk('I_coil', 'Spulenstrom', 'mA', 'I_coil', 'Multimeter', nm('vcc')), mk('tRelaisMs', 'Relais-Ansprechzeit', 'ms', 'tRelaisMs', 'Oszilloskop', nm('in'))];
    const findings = P.fault === 'rb10' ? ['Der Basiswiderstand ist zehnmal zu groß, der Transistor sättigt nicht, das Relais zieht nicht an.'] : P.fault === 'diodeRev' ? ['Die Freilaufdiode ist verpolt eingebaut, sie schließt die Spule im Betrieb kurz.'] : [];
    return { rows: rows, values: { tRelaisMs: rd(t.tRelaisMs, 2) }, findings: findings };
  }

  /* ====================================================================== vg6: Einklemmschutz-Sensorik (Sensorik-Lab) */
  const SEN_KEYS = ['sensor', 'lux', 'dist', 'material', 'target', 'rLoad', 'thresh', 'hyst', 'ambient', 'fdelay'];
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
  function senSteady(ctl, dist) {              // Ruhelauf 700 ms: Schaltzustand, Wechsel, Rauschen
    const c = Object.assign({}, ctl, { dist: dist });
    const r = senRun(c, [], 700), s = r.samples.filter(x => x.t >= 250);
    let tog = 0, prev = s.length ? s[0].state.state : 0, umin = 1e9, umax = -1e9, sum = 0;
    s.forEach(x => { if (x.state.state !== prev) { tog++; prev = x.state.state; } umin = Math.min(umin, x.state.uNoisy); umax = Math.max(umax, x.state.uNoisy); sum += x.state.uOut; });
    const last = s.length ? s[s.length - 1].state : {};
    return { on: last.state === 1, toggles: tog, umin: umin, umax: umax, pp: umax - umin, mean: s.length ? sum / s.length : NaN, sat: arr(r.faults).indexOf('saturation') >= 0, flutter: arr(r.faults).indexOf('flutter') >= 0 };
  }
  function senMeasure(sen, P) {
    const ctl = isObj(sen && sen.ctl) ? sen.ctl : {};
    const o = { pre: [], ok: false };
    if (lc(ctl.sensor) !== 'reflex') o.pre.push('Sensor ist nicht die Reflexlichtschranke');
    if (lc(ctl.target) !== 'dunkel') o.pre.push('das Ziel ist nicht dunkel');
    if (!fin(+ctl.ambient) || Math.abs(+ctl.ambient - P.fremdLux) > 1) o.pre.push('das Fremdlicht ' + (fin(+ctl.ambient) ? fm(+ctl.ambient, 0) : '?') + ' lx weicht vom Lastenheft (' + P.fremdLux + ' lx) ab');
    if (!fin(+ctl.dist) || Math.abs(+ctl.dist - P.zielDist) > 0.5) o.pre.push('der Zielabstand weicht vom Lastenheft (' + P.zielDist + ' mm) ab');
    if (!['rLoad', 'thresh', 'hyst'].every(k => fin(+ctl[k]))) o.pre.push('Lastwiderstand, Schwelle oder Hysterese fehlen');
    if (o.pre.length) return o;
    const c = { sensor: 'reflex', target: 'dunkel', ambient: +ctl.ambient, rLoad: +ctl.rLoad, thresh: +ctl.thresh, hyst: +ctl.hyst, fdelay: fin(+ctl.fdelay) ? +ctl.fdelay : 0, dist: 300 };
    const empty = senSteady(c, 300), target = senSteady(c, +ctl.dist);
    const r = senRun(c, [{ t: 300, set: { dist: +ctl.dist } }], 900);
    const on = r.samples.find(x => x.t >= 300 && x.state.state === 1);
    o.empty = empty; o.target = target; o.tOn = on ? on.t - 300 : NaN;
    const thrOn = c.thresh - c.hyst / 2, thrOff = c.thresh + c.hyst / 2;
    const noise = Math.max(empty.pp, target.pp, 0.01);
    o.margin = Math.min(thrOn - target.umax, empty.umin - thrOff) / noise;
    o.c = c; o.ok = true;
    return o;
  }
  function indMeasure(sen) {
    const c2 = isObj(sen && sen.ctl2) ? sen.ctl2 : {};
    const o = { ok: false, why: '' };
    if (lc(c2.sensor) !== 'induktiv') { o.why = 'der Endschalter ist nicht induktiv'; return o; }
    if (lc(c2.material) !== 'alu') { o.why = 'das Material ist nicht Aluminium (Lamellen)'; return o; }
    if (!fin(+c2.dist)) { o.why = 'Montageabstand fehlt'; return o; }
    const c = { sensor: 'induktiv', material: 'alu', dist: +c2.dist };
    const r = senRun(c, [], 150), st = r.final || {};
    o.sr = st.switchOn; o.red = st.reduction; o.sn = fin(st.reduction) && st.reduction > 0 ? st.switchOn / st.reduction : NaN; o.on = st.state === 1; o.d = +c2.dist; o.ok = fin(o.sr);
    return o;
  }
  function relayFromMess(ctx) {
    const m = slotOf(ctx, 'garage.mess');
    const v = m && isObj(m.values) ? +m.values.tRelaisMs : NaN;
    return fin(v) ? v : (m ? rowVal(rowOf(arr(m.rows), 'trelaisms') || rowOf(arr(m.rows), 'trelais'), 'ms') : NaN);
  }
  function senDerive(sen, ctx) {
    const P = P_(ctx), m = senMeasure(sen, P), tRel = relayFromMess(ctx);
    const o = { ok: m.ok && fin(m.tOn) && fin(tRel), tRespMs: m.tOn, tSpsMs: 2 * P.cycleMs, tRelaisMs: tRel, margin: m.margin };
    o.tReactMs = o.tRespMs + o.tSpsMs + o.tRelaisMs;
    return o;
  }
  function checkSen(data, ctx) {
    const P = P_(ctx), lines = [], d = isObj(data) ? data : {};
    const m = senMeasure(d, P), ind = indMeasure(d), tRel = relayFromMess(ctx);
    const tReact = m.ok && fin(m.tOn) && fin(tRel) ? m.tOn + 2 * P.cycleMs + tRel : NaN;
    lines.push(L(fin(tReact) && tReact <= P.tReactMaxMs, 'Reaktionszeit: Sensor ' + (m.ok && fin(m.tOn) ? fm(m.tOn, 0) : '?') + ' ms + SPS ' + 2 * P.cycleMs + ' ms (A) + Relais ' + (fin(tRel) ? fm(tRel, 1) : '? (Messprotokoll fehlt)') + ' ms = ' + (fin(tReact) ? fm(tReact, 0) : '?') + ' ms, erlaubt ' + P.tReactMaxMs + ' ms', 30));
    const fOk = m.ok && m.target.on && !m.empty.on && m.margin >= 1.5;
    lines.push(L(fOk, 'Funktion: dunkles Ziel in ' + P.zielDist + ' mm bei ' + P.fremdLux + ' lx Fremdlicht ' + (m.ok ? (m.target.on ? 'erkannt' : 'nicht erkannt') + ', ohne Ziel ' + (m.empty.on ? 'fälschlich EIN' : 'AUS') + ', Reserve ' + fm(m.margin, 1) + ' (verlangt mindestens 1,5)' : 'nicht auswertbar: ' + m.pre[0]), 25));
    lines.push(L(m.ok && m.empty.toggles + m.target.toggles === 0 && +(d.ctl && d.ctl.hyst) >= 0.05, 'Hysterese: im Rauschlauf ' + (m.ok ? m.empty.toggles + m.target.toggles : '?') + ' Fehlschaltungen, Hysterese ' + (m.ok ? fm(+(d.ctl && d.ctl.hyst), 2) + ' V (mindestens 0,05 V)' : '?'), 20));
    let iok = false, itxt = ind.why;
    if (ind.ok) {
      const lo = 0.1 * ind.sn, hi = 0.8 * ind.sr;
      iok = ind.on && ind.d >= lo - 1e-9 && ind.d <= hi + 1e-9;
      itxt = 'Montageabstand ' + fm(ind.d, 2) + ' mm, erlaubt ' + fm(lo, 2) + ' bis ' + fm(hi, 2) + ' mm (Schaltabstand Alu ' + fm(ind.sr, 1) + ' mm, 20 % Reserve, mindestens 10 % von Sn)' + (ind.on ? '' : ', der Sensor schaltet nicht');
    }
    lines.push(L(iok, 'Endlage Alu-Lamellen: ' + itxt, 25));
    return lines;
  }
  function senSolution(ctx) {
    const P = P_(ctx), key = 'sol' + [P.fremdLux, P.zielDist].join('/');
    if (!senSolution.memo) senSolution.memo = {};
    if (!senSolution.memo[key]) {
      let best = null;
      e24List.forEach(rl => {
        const base = { sensor: 'reflex', target: 'dunkel', ambient: P.fremdLux, rLoad: rl, thresh: 2.5, hyst: 0.05, fdelay: 0, dist: P.zielDist };
        const e = senSteady(base, 300), t = senSteady(base, P.zielDist);
        const hi = e.umin, lo = t.umax;
        if (!(hi > lo)) return;
        const thresh = rd((hi + lo) / 2 / 0.05, 0) * 0.05, hyst = 0.05;
        const mm = Math.min(thresh - hyst / 2 - lo, hi - thresh - hyst / 2) / Math.max(e.pp, t.pp, 0.01);
        if (!best || mm > best.mm) best = { rl: rl, thresh: rd(thresh, 2), hyst: hyst, mm: mm };
      });
      senSolution.memo[key] = best || { rl: 4700, thresh: 2.5, hyst: 0.05, mm: 0 };
    }
    const b = senSolution.memo[key];
    const ctl = { sensor: 'reflex', target: 'dunkel', dist: P.zielDist, rLoad: b.rl, thresh: b.thresh, hyst: b.hyst, ambient: P.fremdLux, fdelay: 5 };
    const ctl2 = { sensor: 'induktiv', material: 'alu', dist: 2 };
    const data = { rig: 'licht', preset: '', ctl: ctl, ctl2: ctl2, state: {}, derived: {} };
    const dv = senDerive(data, ctx);
    data.derived = { tRespMs: rd(dv.tRespMs, 1), tSpsMs: dv.tSpsMs, tRelaisMs: rd(dv.tRelaisMs, 2), tReactMs: rd(dv.tReactMs, 1), margin: rd(dv.margin, 2) };
    return data;
  }

  /* ====================================================================== vg7: Torantrieb auslegen (Antriebs-Lab) */
  const M_TOR = 25;                            // (A) bewegte Masse Tor + Trommel in kg (nur für den Bremsweg)
  const FUSES = [6.3, 8, 10, 12.5, 16, 20, 25, 32];
  const antCache = new Map();
  function gearOk(g) {
    if (!isObj(g)) return { ok: false, why: 'keine Getriebedaten' };
    const st = +g.stages === 1 ? 1 : 2, zs = st === 1 ? ['z1', 'z2'] : ['z1', 'z2', 'z3', 'z4'];
    const bad = zs.find(k => !(Number.isInteger(+g[k]) && +g[k] >= 8 && +g[k] <= 120));
    if (bad) return { ok: false, why: 'Zähnezahl ' + bad + ' muss eine ganze Zahl von 8 bis 120 sein' };
    if (g.type && lc(g.type) !== 'stirnrad') return { ok: false, why: 'nur Stirnradgetriebe vorgesehen' };
    return { ok: true, stages: st };
  }
  function antMotorTest(preset, u, load, ms, thermFactor, Jload) {
    const A = ANT(), m = A.dcMotor(Object.assign({}, preset.params, { Jload: Jload || 0, thermFactor: thermFactor || 1 }));
    let st = null; for (let t = 0; t < ms; t += 2) st = m.step(2, { u: u, load: load });
    return { m: m, st: st };
  }
  function antDerive(ant, ctx) {
    const P = P_(ctx), A = ANT(), o = { ok: false, errs: [] };
    if (!isObj(ant) || !A) { o.errs.push('keine Antriebsdaten'); return o; }
    const ctl = isObj(ant.ctl) ? ant.ctl : {}, gear = isObj(ant.gear) ? ant.gear : {};
    const motorId = ctl.motor || ant.preset, preset = A.dcPresets && A.dcPresets[motorId];
    if (!preset) { o.errs.push('Motor „' + motorId + '“ unbekannt'); return o; }
    const go = gearOk(gear); if (!go.ok) { o.errs.push(go.why); }
    const uS = +ctl.uSupply, duty = +ctl.duty;
    if (!fin(uS) || !fin(duty) || duty <= 0) { o.errs.push('Versorgungsspannung oder Tastgrad fehlen'); }
    if (o.errs.length) return o;
    const key = JSON.stringify([motorId, uS, duty, gear.stages, gear.z1, gear.z2, gear.z3, gear.z4, P.hub, P.dT, P.fLast]);
    let r = antCache.get(key);
    if (!r) {
      const gb = A.gearbox({ type: 'stirnrad', stages: go.stages, z1: +gear.z1, z2: +gear.z2, z3: +gear.z3, z4: +gear.z4 }), info = gb.info();
      const ratio = info.ratio, etaMesh = info.eta, mDrag = gb.params && fin(gb.params.mDrag) ? gb.params.mDrag : 0.01;
      const rad = P.dT / 2, mMotor = mDrag + P.fLast * rad / (ratio * etaMesh);
      const jref = M_TOR * Math.pow(rad / ratio, 2), u = A.pwmAverage(duty / 100, uS, 0.2);
      const run = antMotorTest(preset, u, mMotor, 800, 1, jref), st = run.st;
      const nDrum = st.rpm / ratio, v = Math.PI * P.dT * nDrum / 60, travel = v > 0 ? P.hub / v : Infinity;
      const nom = antMotorTest(preset, preset.nominal.u, preset.nominal.load, 800, 1, 0).st;
      const iStart = A.dcDerived(Object.assign({}, preset.params), u).iStall;
      let tempMax = st.temp;
      if (fin(travel) && travel < 60) {         // drei Fahrten mit Pausen; Erwärmung beschleunigt (A: Faktor 30)
        const hm = A.dcMotor(Object.assign({}, preset.params, { Jload: jref, thermFactor: 30 }));
        for (let k = 0; k < 3; k++) { for (let t = 0; t < travel * 1000; t += 20) tempMax = Math.max(tempMax, hm.step(20, { u: u, load: mMotor }).temp); for (let t = 0; t < 10000; t += 200) hm.step(200, { u: 0, open: true }); }
      }
      // Bremsweg: Wicklung kurzschließen (u = 0), Motor mit Drehzahl aus dem Beharrungszustand
      const th0 = st.theta; let sb = 0;
      for (let t = 0; t < 1500; t += 1) { const s2 = run.m.step(1, { u: 0, load: mMotor }); sb = (s2.theta - th0) / ratio * rad * 1000; if (s2.rpm < 0.5) break; }
      r = { ratio: ratio, eta: etaMesh, mMotor: mMotor, rpm: st.rpm, iRun: st.i, iN: nom.i, iStart: iStart, vMs: v, travelS: travel, tempMax: tempMax, sBrakeMm: sb, uMean: u, uNom: preset.uNom };
      if (antCache.size > 300) antCache.clear();
      antCache.set(key, r);
    }
    const out = Object.assign({ ok: true, errs: [] }, r);
    const sen = slotOf(ctx, 'garage.sen'), sd = sen ? senDerive(sen, ctx) : null;
    out.tReactMs = sd && sd.ok ? sd.tReactMs : NaN;
    out.sStopMm = fin(out.tReactMs) ? out.vMs * out.tReactMs + out.sBrakeMm : NaN;
    return out;
  }
  function checkAnt(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = antDerive(data, ctx);
    const ok = d.ok;
    const dev = ok ? Math.abs(d.travelS - P.travelS) / P.travelS : NaN;
    lines.push(L(ok && dev <= 0.08 * tol, 'Fahrzeit t = Hub / (π · d · n_Trommel / 60): ' + (ok ? fm(d.travelS, 2) + ' s' : 'nicht berechenbar (' + (d.errs[0] || '?') + ')') + ', verlangt ' + fm(P.travelS, 1) + ' s (±' + fm(8 * tol, 1) + ' %)', 30));
    const uOk = ok && Math.abs(+data.ctl.uSupply - P.uMotor) <= 0.01;
    lines.push(L(ok && uOk && d.iRun <= d.iN * (1 + 1e-9) && d.tempMax <= 130, 'Motor im Nennbereich: Strom ' + (ok ? fm(d.iRun, 2) : '?') + ' A (Nennstrom ' + (ok ? fm(d.iN, 2) : '?') + ' A), Wicklung höchstens ' + (ok ? fm(d.tempMax, 0) : '?') + ' °C nach 3 Fahrten (Grenze 130 °C)' + (ok && !uOk ? ' – Versorgung muss ' + P.uMotor + ' V sein' : ''), 20));
    const go = gearOk(data && data.gear);
    lines.push(L(ok && go.ok && d.ratio >= 5 && d.ratio <= 200, 'Getriebe aus ganzen Zähnezahlen: i = ' + (ok ? fm(d.ratio, 1) : '?') + ', Wirkungsgrad der Verzahnung ' + (ok ? fm(d.eta * 100, 1) : '?') + ' % ist in der Last berücksichtigt' + (go.ok ? '' : ' – ' + go.why), 15));
    lines.push(L(ok && fin(d.sStopMm) && d.sStopMm <= P.sStopMaxMm, 'Anhalteweg s = v · t_Reaktion + s_Bremse: ' + (ok && fin(d.sStopMm) ? fm(d.vMs * 1000, 0) + ' mm/s · ' + fm(d.tReactMs, 0) + ' ms + ' + fm(d.sBrakeMm, 1) + ' mm = ' + fm(d.sStopMm, 1) + ' mm' : 'nicht berechenbar (Sensorik-Station fehlt)') + ', erlaubt ' + P.sStopMaxMm + ' mm', 20));
    const fz = +(data && data.fuseA);
    lines.push(L(ok && fin(fz) && fz >= 1.25 * d.iN && fz < d.iStart, 'Absicherung ' + (fin(fz) ? fm(fz, 1) + ' A' : 'fehlt') + ': mindestens 1,25 · I_N = ' + (ok ? fm(1.25 * d.iN, 1) : '?') + ' A, kleiner als der Anlaufstrom ' + (ok ? fm(d.iStart, 0) : '?') + ' A', 15));
    return lines;
  }
  function antSolution(ctx) {
    const P = P_(ctx), A = ANT(), key = 'sol' + [P.hub, P.travelS, P.fLast].join('/');
    if (!antSolution.memo) antSolution.memo = {};
    if (!antSolution.memo[key]) {
      const pre = A.dcPresets.antrieb24, pa = pre.params, rad = P.dT / 2;
      const uMean = duty => A.pwmAverage(duty / 100, P.uMotor, 0.2);
      const travelOf = (ratio, etaM, mDrag, duty) => {
        const mM = mDrag + P.fLast * rad / (ratio * etaM);
        const w = (uMean(duty) - pa.Ra * (mM + pa.Mc) / pa.Ke) / (pa.Ke + pa.Ra * pa.B / pa.Ke);
        const n = w * 60 / (2 * Math.PI) / ratio, v = Math.PI * P.dT * n / 60;
        return v > 0 ? P.hub / v : Infinity;
      };
      let best = null;
      for (let z1 = 10; z1 <= 24; z1++) for (let z3 = 10; z3 <= 24; z3++) for (let z2 = 40; z2 <= 100; z2 += 2) for (let z4 = 30; z4 <= 90; z4 += 2) {
        const ratio = z2 / z1 * z4 / z3;
        if (0.01 + P.fLast * rad / (ratio * 0.97 * 0.97) > 0.9 * pre.nominal.load) continue;      // Moment am Motor im Nennbereich (sonst läuft die Lösung am Anschlag und kippt)
        const t = travelOf(ratio, 0.97 * 0.97, 0.01, 95);
        const e = Math.abs(t - P.travelS) / P.travelS;
        if (!best || e < best.e - 1e-12 || (Math.abs(e - best.e) <= 1e-12 && z1 + z2 + z3 + z4 < best.s)) best = { z: [z1, z2, z3, z4], e: e, s: z1 + z2 + z3 + z4 };
      }
      const z = best.z, ratio = z[1] / z[0] * z[3] / z[2];
      let lo = 20, hi = 100;
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (travelOf(ratio, 0.97 * 0.97, 0.01, mid) > P.travelS) lo = mid; else hi = mid; }
      let duty = rd(hi, 1);
      const gear = { type: 'stirnrad', stages: 2, z1: z[0], z2: z[1], z3: z[2], z4: z[3] };
      // an der Simulation nachführen (Feinabgleich)
      let bestDuty = null;                      // die Simulation ist sprunghaft (Motor kippt unter 100 %): der beste geprüfte Tastgrad zählt, nicht der letzte Schritt
      for (let k = 0; k < 6; k++) {
        const dd = antDerive({ ctl: { motor: 'antrieb24', uSupply: P.uMotor, duty: duty }, gear: gear }, { spec: { params: P } });
        if (!dd.ok) break;
        const err = (dd.travelS - P.travelS) / P.travelS;
        if (!bestDuty || Math.abs(err) < bestDuty.e) bestDuty = { d: duty, e: Math.abs(err) };
        if (Math.abs(err) < 0.002) break;
        duty = clamp(rd(duty * (1 + err), 1), 20, 100);
      }
      if (bestDuty) duty = bestDuty.d;
      antSolution.memo[key] = { gear: gear, duty: duty };
    }
    const b = antSolution.memo[key];
    const data = { rig: 'gleichstrom', preset: 'antrieb24', ctl: { motor: 'antrieb24', uSupply: P.uMotor, duty: b.duty, dir: 'vor' }, gear: clone(b.gear), fuseA: 0, state: {}, derived: {} };
    const d = antDerive(data, ctx);
    data.fuseA = FUSES.find(f => f >= 1.3 * d.iN && f < d.iStart) || 10;
    data.state = { rpm: rd(d.rpm, 0), i: rd(d.iRun, 2), temp: rd(d.tempMax, 1) };
    data.derived = { ratio: rd(d.ratio, 3), travelS: rd(d.travelS, 3), vMs: rd(d.vMs, 4), sBrakeMm: rd(d.sBrakeMm, 2), iN: rd(d.iN, 2) };
    return data;
  }

  /* ====================================================================== vg8: Torsteuerung programmieren (SPS-Lab) */
  const v_ = a => ({ t: 'var', a: a }), nv_ = a => ({ t: 'var', a: a, neg: true });
  const AND_ = (...i) => ({ t: 'and', in: i }), OR_ = (...i) => ({ t: 'or', in: i });
  const PE_ = a => ({ t: 'edge', a: a, mode: 'P' });
  const TON_ = (id, pt, i) => ({ t: 'fb', fb: 'ton', id: id, pt: pt, in: i });
  const coil_ = a => ({ t: 'coil', a: a }), set_ = a => ({ t: 'set', a: a }), rst_ = a => ({ t: 'reset', a: a });
  const net_ = (id, title, expr, outs) => ({ id: id, title: title, expr: expr, outs: outs || [] });
  const SYM = { 'I0.0': 'S1_Auf', 'I0.1': 'S2_Ab', 'I0.2': 'B1_EndeOben', 'I0.3': 'B2_EndeUnten', 'I0.4': 'B3_Lichtschranke', 'I0.5': 'S3_Stopp', 'Q0.0': 'K1_MotorAuf', 'Q0.1': 'K2_MotorAb', 'Q0.2': 'H1_Blinklicht', 'Q0.3': 'H2_Beleuchtung',
    'M0.0': 'M_AnfAuf', 'M0.1': 'M_AnfAb', 'M0.2': 'M_Stoerung', 'M0.3': 'M_Umkehr' };
  function buildProgram(P, travelS) {
    const pre = Math.round(P.tVorwarn * 1000), mon = Math.round(1.5 * travelS * 1000 / 10) * 10;
    return { lang: 'kop', symbols: Object.assign({}, SYM), networks: [
      net_('N1', 'Störung: Fahrzeit Auf überschritten', TON_('T3', mon, v_('Q0.0')), [set_('M0.2')]),
      net_('N2', 'Störung: Fahrzeit Ab überschritten', TON_('T4', mon, v_('Q0.1')), [set_('M0.2')]),
      net_('N3', 'Störung quittieren (Stopp drücken)', nv_('I0.5'), [rst_('M0.2')]),
      net_('N4', 'Anforderung Auf (Funk oder Taster)', AND_(PE_('I0.0'), nv_('M0.2'), nv_('M0.1'), v_('I0.5'), nv_('I0.2')), [set_('M0.0')]),
      net_('N5', 'Anforderung Ab (nur ohne Hindernis)', AND_(PE_('I0.1'), nv_('M0.2'), nv_('M0.0'), v_('I0.5'), nv_('I0.3'), nv_('I0.4')), [set_('M0.1')]),
      net_('N6', 'Hindernis beim Schließen: sofort umkehren', AND_(v_('Q0.1'), v_('I0.4')), [rst_('M0.1'), set_('M0.0'), set_('M0.3')]),
      net_('N7', 'Vorwarnzeit Auf', TON_('T1', pre, AND_(v_('M0.0'), nv_('M0.3'))), []),
      net_('N8', 'Vorwarnzeit Ab', TON_('T2', pre, v_('M0.1')), []),
      net_('N9', 'Motor Auf', AND_(v_('M0.0'), OR_(v_('T1.Q'), v_('M0.3')), v_('I0.5'), nv_('I0.2'), nv_('M0.1'), nv_('M0.2')), [coil_('Q0.0')]),
      net_('N10', 'Motor Ab', AND_(v_('M0.1'), v_('T2.Q'), v_('I0.5'), nv_('I0.3'), nv_('I0.4'), nv_('M0.0'), nv_('M0.2')), [coil_('Q0.1')]),
      net_('N11', 'Auf beendet: Endschalter, Stopp oder Störung', OR_(v_('I0.2'), nv_('I0.5'), v_('M0.2')), [rst_('M0.0'), rst_('M0.3')]),
      net_('N12', 'Ab beendet: Endschalter, Stopp, Störung oder Hindernis', OR_(v_('I0.3'), nv_('I0.5'), v_('M0.2'), v_('I0.4')), [rst_('M0.1')]),
      net_('N13', 'Blinklicht vor und während der Fahrt, bei Störung', OR_(v_('M0.0'), v_('M0.1'), v_('M0.2')), [coil_('Q0.2')])
    ] };
  }
  let supportsTravel = null;
  function plantSupportsTravel() {
    if (supportsTravel !== null) return supportsTravel;
    try {
      const p = PLANTS().create('garagentor', { seed: 1, travelS: 12 });
      p.scenarios('zu'); p.writeOutputs({ 'Q0.0': true });
      for (let t = 0; t < 8000; t += 10) p.step(10);
      supportsTravel = p.state().doorPos < 98;
    } catch (e) { supportsTravel = false; }
    return supportsTravel;
  }
  const effTravel = t => (plantSupportsTravel() ? t : 6);
  /* Anlage + SPS im 10-ms-Zyklus; Lichtschranke I0.4 erreicht die SPS um tResp verzögert */
  function runSps(prog, o) {
    const plant = PLANTS().create('garagentor', { seed: 1, travelS: o.travelS }), plc = SPS().create(clone(prog));
    plant.scenarios(o.scen);
    const qk = plant.io.outputs.map(x => x.key), delay = Math.round((o.delayMs || 0) / 10), buf = [];
    const rec = [], out = {};
    for (let t = 0; t < o.ms; t += 10) {
      if (o.drive) o.drive(t, plant);
      const inp = plant.readInputs();
      buf.push(inp['I0.4']); const del = buf.length > delay ? buf[buf.length - 1 - delay] : false; inp['I0.4'] = del;
      if (o.mask) for (const k in o.mask) inp[k] = o.mask[k];
      for (const k in inp) plc.setInput(k, inp[k]);
      plc.scan(10);
      for (let i = 0; i < qk.length; i++) out[qk[i]] = plc.getOutput(qk[i]);
      plant.writeOutputs(out);
      plant.step(10);
      const st = plant.state();
      rec.push({ t: t, q0: !!out['Q0.0'], q1: !!out['Q0.1'], q2: !!out['Q0.2'], pos: st.doorPos, crash: st.crash, jammed: st.jammed });
    }
    return { rec: rec, st: plant.state() };
  }
  /* Tastendruck (einmal anlegen): drückt ab t0 für dur ms, rest = Ruhezustand (Öffner: true) */
  const press = (key, t0, dur, rest) => { let a = false, b = false; return (t, p) => { if (!a && t >= t0) { a = true; p.setInput(key, !rest); } if (a && !b && t >= t0 + dur) { b = true; p.setInput(key, !!rest); } }; };
  const chain = (...f) => (t, p) => f.forEach(x => x(t, p));
  const firstT = (rec, f, from) => { const r = rec.find(x => x.t >= (from || 0) && f(x)); return r ? r.t : NaN; };
  function walkTons(prog) {
    const pts = [];
    const w = e => { if (!isObj(e)) return; if (e.t === 'fb' && (e.fb === 'ton' || e.fb === 'tof' || e.fb === 'tp') && fin(+e.pt)) pts.push(+e.pt); arr(e.in).forEach(w); if (isObj(e.in)) w(e.in); };
    arr(prog && prog.networks).forEach(n => w(n.expr));
    return pts;
  }
  const spsCache = new Map();
  function spsContext(ctx) {                   // Anlagenwerte aus den Vorstationen
    const P = P_(ctx), an = antDerive(need(ctx, 'garage.ant'), ctx), sen = need(ctx, 'garage.sen'), sd = senDerive(sen, ctx);
    return { travelS: an.ok && fin(an.travelS) && an.travelS > 1 && an.travelS < 60 ? an.travelS : P.travelS, delayMs: sd && fin(sd.tRespMs) ? sd.tRespMs : 10, antOk: an.ok };
  }
  function spsRuns(prog, ctx) {
    const P = P_(ctx), c = spsContext(ctx), T = effTravel(c.travelS), tw = Math.round(P.tVorwarn * 1000);
    const key = hash(JSON.stringify([prog, c.travelS, c.delayMs, P.tVorwarn, plantSupportsTravel()]));
    if (spsCache.has(key)) return spsCache.get(key);
    const ms = x => Math.ceil(x / 10) * 10;
    const base = { travelS: c.travelS, delayMs: c.delayMs };
    const R = {};
    R.auf = runSps(prog, Object.assign({ scen: 'zu', ms: ms(500 + tw + T * 1000 * 1.25 + 2000), drive: press('I0.0', 500, 200) }, base));
    R.ab = runSps(prog, Object.assign({ scen: 'offen', ms: ms(500 + tw + T * 1000 * 1.25 + 2000), drive: press('I0.1', 500, 200) }, base));
    let obsOn = false;
    R.hind = runSps(prog, Object.assign({ scen: 'offen', ms: ms(500 + tw + T * 1000 * 2.4 + 3000), drive: chain(press('I0.1', 500, 200), (t, p) => { if (!obsOn && p.state().doorPos <= 92) { obsOn = true; p.setObstacle(true, 'person'); } }) }, base));
    R.stopp = runSps(prog, Object.assign({ scen: 'zu', ms: ms(500 + tw + T * 1000 * 0.5 + 3500), drive: chain(press('I0.0', 500, 200), press('I0.5', 500 + tw + Math.round(T * 500), 300, true)) }, base));
    R.wechsel = runSps(prog, Object.assign({ scen: 'offen', ms: ms(500 + tw + T * 1000 * 1.25 + 2000), drive: chain(press('I0.1', 500, 200), press('I0.0', 500 + tw + Math.round(T * 300), 200)) }, base));
    R.klemm = runSps(prog, Object.assign({ scen: 'hindernis_katze', ms: ms(500 + tw + c.travelS * 1000 * 1.5 + 2500), drive: press('I0.1', 500, 200), mask: { 'I0.4': false } }, base));
    R.ctx = c; R.T = T; R.tw = tw;
    if (spsCache.size > 300) spsCache.clear();
    spsCache.set(key, R);
    return R;
  }
  const bothQ = rec => rec.some(r => r.q0 && r.q1);
  function checkSps(data, ctx) {
    const P = P_(ctx), lines = [], prog = data && data.prog;
    if (!isObj(prog)) return [L(false, 'Kein SPS-Programm übergeben', 100)];
    if (data.plant && data.plant !== 'garagentor') return [L(false, 'Das Programm gehört zur Anlage „' + data.plant + '“, verlangt ist das Garagentor', 100)];
    let val = { ok: false, errors: ['SPS_CORE fehlt'] };
    try { val = SPS().validate(prog); } catch (e) { val = { ok: false, errors: [String(e && e.message || e)] }; }
    let plc = null; try { plc = SPS().create(clone(prog)); } catch (e) { plc = null; }
    const comp = !!(val && val.ok && plc && plc.ok);
    lines.push(L(comp, 'Programm lässt sich übersetzen (SPS_CORE.validate)' + (comp ? '' : ' – ' + String((val && val.errors && val.errors[0]) || (plc && plc.errorList && plc.errorList[0]) || 'Fehler')), 10));
    if (!comp) { lines.push(L(false, 'Szenarien nicht ausführbar, solange das Programm Fehler hat', 90)); return lines; }
    const R = spsRuns(prog, ctx), T = R.T * 1000, tw = R.tw;
    const aT = firstT(R.auf.rec, r => r.pos >= 98), bT = firstT(R.ab.rec, r => r.pos <= 2);
    const il = bothQ(R.auf.rec) || bothQ(R.ab.rec) || bothQ(R.hind.rec) || bothQ(R.stopp.rec) || bothQ(R.wechsel.rec) || bothQ(R.klemm.rec) || R.auf.st.crashReason === 'interlock' || R.ab.st.crashReason === 'interlock';
    lines.push(L(fin(aT), 'Auf: das Tor erreicht oben' + (fin(aT) ? ' nach ' + fm((aT - 500) / 1000, 1) + ' s' : ' nicht') , 7));
    lines.push(L(fin(bT) && !R.ab.st.crash, 'Ab: das Tor erreicht unten' + (fin(bT) ? ' nach ' + fm((bT - 500) / 1000, 1) + ' s' : ' nicht'), 7));
    lines.push(L(!il && !R.auf.st.overrun && !R.ab.st.overrun, 'Keine Verriegelungsverletzung (nie Auf und Ab zugleich) und kein Überfahren der Endschalter' + (il ? ' – Q0.0 und Q0.1 waren gleichzeitig an' : ''), 6));
    const h = R.hind.rec, tObs = firstT(h, r => r.pos <= 92), seen = isFinite(tObs) ? tObs + R.ctx.delayMs : NaN;
    const q1off = firstT(h, r => !r.q1, fin(seen) ? seen : 1e9), topH = firstT(h, r => r.pos >= 98, fin(tObs) ? tObs : 0);
    lines.push(L(!R.hind.st.crash && fin(q1off) && q1off - seen <= 200, 'Ab mit Hindernis: Stopp ' + (fin(q1off) && fin(seen) ? fm(q1off - seen, 0) + ' ms' : 'nie') + ' nach der Lichtschranke (höchstens 200 ms), kein Aufprall', 10));
    lines.push(L(fin(topH) && !R.hind.st.crash, 'Ab mit Hindernis: Rückfahrt nach oben' + (fin(topH) ? '' : ' fehlt'), 10));
    const s = R.stopp.rec, tStop = 500 + tw + Math.round(R.T * 500), mAfter = s.filter(r => r.t >= tStop + 150 && (r.q0 || r.q1)).length;
    const p1 = (s.find(r => r.t >= tStop + 150) || {}).pos, p2 = (s[s.length - 1] || {}).pos;
    lines.push(L(mAfter === 0 && fin(p1) && fin(p2) && Math.abs(p2 - p1) < 1 && p1 > 5 && p1 < 95, 'Stopp mitten in der Fahrt: der Motor hält an und das Tor bleibt stehen' + (mAfter ? ' – Motor läuft noch' : ''), 10));
    const w = R.wechsel.rec, tW = 500 + tw + Math.round(R.T * 300), wrong = w.filter(r => r.t >= tW && r.t <= tW + 1500 && r.q0).length;
    lines.push(L(wrong === 0 && !bothQ(w), 'Richtungswechsel nur über Stopp: Auf-Taste während der Abfahrt bewirkt keine Umkehr' + (wrong ? ' – Motor Auf lief an' : ''), 10));
    const gap = (() => { const a = firstT(R.auf.rec, r => r.q2, 400), m = firstT(R.auf.rec, r => r.q0, 400); return fin(a) && fin(m) ? m - a : NaN; })();
    lines.push(L(fin(gap) && gap >= tw - 30, 'Blinklicht ' + (fin(gap) ? fm(gap / 1000, 2) + ' s' : '?') + ' vor der Anfahrt (verlangt mindestens ' + fm(P.tVorwarn, 0) + ' s)', 10));
    const k = R.klemm.rec, kStart = firstT(k, r => r.q1, 400), kStop = firstT(k, r => !r.q1, fin(kStart) ? kStart : 1e9);
    const limit = 1.5 * R.ctx.travelS * 1000;
    const jam = k.some(r => r.jammed);
    lines.push(L(jam && fin(kStart) && fin(kStop) && kStop - kStart <= limit + 100 && kStop - kStart >= 0.8 * T, 'Fahrzeitüberwachung: bei Klemmen schaltet der Motor nach ' + (fin(kStart) && fin(kStop) ? fm((kStop - kStart) / 1000, 1) + ' s' : 'nie') + ' ab (höchstens ' + fm(limit / 1000, 1) + ' s = 1,5 · Fahrzeit)', 10));
    const pts = walkTons(prog), hasPre = pts.some(x => Math.abs(x - tw) <= Math.max(100, 0.1 * tw)), hasMon = pts.some(x => Math.abs(x - limit) <= Math.max(150, 0.1 * limit * TOL(ctx)));
    const gra = lc(prog.lang) === 'gra';
    lines.push(L(gra ? (fin(gap) && gap >= tw - 30 && jam) : (hasPre && hasMon), 'Zeitwerte aus dem Lastenheft: Vorwarnzeit ' + fm(P.tVorwarn * 1000, 0) + ' ms und Fahrzeitüberwachung ' + fm(limit, 0) + ' ms im Programm' + (gra ? ' (GRAFCET: am Verhalten geprüft)' : (hasPre ? '' : ' – keine Vorwarnzeit') + (hasMon ? '' : ' – keine passende Überwachung')), 10));
    return lines;
  }

  /* ====================================================================== vg9: Bedienungsanleitung (App-Werkstatt) */
  function noteFigures(ctx) {
    const P = P_(ctx), an = antDerive(need(ctx, 'garage.ant'), ctx), ms = need(ctx, 'garage.mess'), pcb = need(ctx, 'garage.pcb'), b = asBoard(pcb && pcb.board) || {};
    const tRel = relayFromMess(ctx);
    return { fahrzeit: an.travelS, reakt: an.tReactMs, spule: P.iCoil, anhalte: an.sStopMm, relais: tRel, w: b.w, h: b.h };
  }
  function numbersIn(line) { return (String(line).match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.'))); }
  function figureHit(lines, kw, exp, scales) {
    return lines.some(l => kw.test(l) && numbersIn(l).some(n => (scales || [1]).some(sc => fin(exp) && Math.abs(n * sc - exp) <= 0.02 * Math.abs(exp) + 1e-9)));
  }
  function checkApp(data, ctx) {
    const P = P_(ctx), lines = [], md = String(isObj(data) && typeof data.md === 'string' ? data.md : ''), ls = md.split(/\r?\n/);
    const f = noteFigures(ctx);
    const hits = [
      ['Fahrzeit', figureHit(ls, /fahrzeit/i, f.fahrzeit, [1, 1000])], ['Reaktionszeit', figureHit(ls, /reaktion/i, f.reakt, [1, 1000])],
      ['Spulenstrom', figureHit(ls, /spulen/i, f.spule, [1, 1000])], ['Anhalteweg', figureHit(ls, /anhalte/i, f.anhalte, [1, 1000])],
      ['Relais-Ansprechzeit', figureHit(ls, /relais|ansprech/i, f.relais, [1, 1000])],
      ['Platinenmaße', ls.some(l => /platine/i.test(l) && (() => { const n = numbersIn(l); return n.length >= 2 && fin(f.w) && ((Math.abs(n[0] - f.w) <= 0.02 * f.w && Math.abs(n[1] - f.h) <= 0.02 * f.h) || (Math.abs(n[1] - f.w) <= 0.02 * f.w && Math.abs(n[0] - f.h) <= 0.02 * f.h)); })())]
    ];
    const nHit = hits.filter(h => h[1]).length;
    lines.push(L(nHit >= 4, 'Technische Daten: ' + nHit + ' von 6 Kennzahlen stimmen (mindestens 4 mit Zahlen innerhalb 2 %); fehlt oder falsch: ' + (hits.filter(h => !h[1]).map(h => h[0]).join(', ') || 'nichts'), 30));
    const heads = ls.filter(l => /^#{1,6}\s+\S/.test(l)), hText = heads.map(lc);
    const sec = name => { const i = ls.findIndex(l => /^#{1,6}\s/.test(l) && lc(l.replace(/^#+\s*/, '').replace(/^\d+[.)]?\s*/, '')).indexOf(name) === 0); if (i < 0) return null; let j = i + 1; while (j < ls.length && !/^#{1,6}\s/.test(ls[j])) j++; return ls.slice(i + 1, j).join('\n'); };
    const sb = sec('bedienung'), ss = sec('sicherheit');
    const secOk = sb !== null && sb.trim().length > 20 && ss !== null && /lichtschranke/i.test(ss) && /stopp|stopp-?tast/i.test(ss);
    lines.push(L(secOk, 'Abschnitte „Bedienung“ und „Sicherheit“ (mit Lichtschranke und Stopp)' + (sb === null ? ' – Abschnitt Bedienung fehlt' : ss === null ? ' – Abschnitt Sicherheit fehlt' : !secOk ? ' – im Abschnitt Sicherheit fehlen Lichtschranke und Stopp' : ''), 20));
    const words = (md.replace(/^---[\s\S]*?---/, '').match(/[A-Za-zÄÖÜäöüß0-9]+/g) || []).length;
    lines.push(L(heads.length >= 3 && words >= 150, 'Gliederung: ' + heads.length + ' Überschriften (mindestens 3), ' + words + ' Wörter (mindestens 150)', 20));
    const fm_ = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md), body = fm_ ? fm_[1] : '', tagsOk = /tags\s*:/i.test(body) && /(garage|garagentor)/i.test(body), dateOk = /date\s*:\s*\d{4}-\d{2}-\d{2}/i.test(body);
    lines.push(L(!!fm_ && tagsOk && dateOk, 'Frontmatter mit tags (Projekt Garagentor) und date (JJJJ-MM-TT)' + (!fm_ ? ' – Frontmatter fehlt' : !tagsOk ? ' – Projekt-Tag fehlt' : !dateOk ? ' – Datum fehlt' : ''), 15));
    const sw = sec('wartung') !== null ? sec('wartung') : sec('fehler');
    const items = sw ? (sw.match(/^\s*[-*]\s+\S/gm) || []).length : 0;
    lines.push(L(items >= 3, 'Fehlerliste/Wartung: ' + items + ' Einträge (mindestens 3 in einem Abschnitt „Wartung“ oder „Fehler“)', 15));
    return lines;
  }
  function noteSolution(ctx) {
    const P = P_(ctx), f = noteFigures(ctx), today = new Date().toISOString().slice(0, 10);
    const md = [
      '---', 'tags: [garagentor, projekt, uebergabe]', 'date: ' + today, '---',
      '# Garagentor mit Funköffner: Bedienung und Übergabe',
      'Das Rolltor der Fahrradgarage wird jetzt per Funk geöffnet. Diese Notiz ist für die Hausmeister gedacht.',
      '## Technische Daten',
      '- Fahrzeit des Tors: ' + fm(f.fahrzeit, 1) + ' s',
      '- Reaktionszeit der Lichtschranke bis zum Stopp: ' + fm(f.reakt, 0) + ' ms',
      '- Spulenstrom des Relais: ' + fm(f.spule, 0) + ' mA',
      '- Anhalteweg des Tors: ' + fm(f.anhalte, 0) + ' mm',
      '- Relais-Ansprechzeit: ' + fm(f.relais, 1) + ' ms',
      '- Platine: ' + fm(f.w, 0) + ' x ' + fm(f.h, 0) + ' mm',
      '## Bedienung',
      'Mit dem Funkgeber öffnet oder schließt man das Tor, wenn die Torkennung stimmt. Vor jeder Fahrt blinkt die Leuchte zwei Sekunden lang, dann fährt das Tor los. Die Taster Auf und Ab am Tor bewirken dasselbe.',
      'Zum Umkehren der Fahrtrichtung zuerst die Stopp-Taste drücken und dann die andere Richtung wählen.',
      '## Sicherheit',
      'Die Lichtschranke stoppt das schließende Tor und fährt es sofort wieder auf, wenn ein Hindernis im Tor steht. Die Stopp-Taste hält das Tor jederzeit an. Eine Fahrzeitüberwachung schaltet den Motor ab, wenn das Tor klemmt, und das Blinklicht zeigt die Störung an.',
      '## Wartung und Fehlerliste',
      '- Tor fährt nicht: Stopp-Taste prüfen, dann Funkadresse und Betriebs-LED kontrollieren.',
      '- Tor bleibt auf halber Höhe stehen: Hindernis in der Lichtschranke entfernen und Stopp drücken.',
      '- Blinklicht leuchtet dauerhaft: Fahrzeitüberwachung hat ausgelöst, Tor von Hand prüfen.',
      '- Einmal im Jahr: Lichtschranke reinigen und den Abstand des Endschalters zu den Lamellen kontrollieren.'
    ].join('\n');
    return { title: 'Garagentor mit Funköffner: Bedienung und Übergabe', md: md, tags: ['garagentor', 'projekt', 'uebergabe'] };
  }

  /* ====================================================================== vgF: Abschlusstest (Gesamtsystem) */
  function digiMatchFn(dg, P) {
    const ix = nlIdx(dg && dg.netlist), n = P.addrBits;
    const inN = {}; arr(dg && dg.inputs).forEach(i => { if (isObj(i)) inN[lc(i.name)] = resolveNet(ix, i.ref); });
    const od = arr(dg && dg.outputs).find(o => isObj(o) && lc(o.name) === 'match'), outN = od ? resolveNet(ix, od.ref) : undefined;
    if (!ix.ok || outN === undefined) return null;
    for (let i = 0; i < n; i++) if (inN['a' + i] === undefined || inN['s' + i] === undefined) return null;
    const prep = logicPrep(ix);
    return (a, s) => { const drive = {}; for (let i = 0; i < n; i++) { drive[inN['a' + i]] = !!((a >> i) & 1); drive[inN['s' + i]] = !!((s >> i) & 1); } return !!logicRun(ix, prep, drive).val[outN]; };
  }
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = { 1: 1.5, 2: 1, 3: 0.6 }[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => slotOf(ctx, k), lines = [], kpis = [];
    const dg = g('garage.digi'), sch = g('garage.sch'), pk = g('garage.ds'), pcb = g('garage.pcb'), mess = g('garage.mess'), sen = g('garage.sen'), ant = g('garage.ant'), sps = g('garage.sps'), app = g('garage.app');
    // 1: Kette MATCH -> Treiberstufe
    const match = digiMatchFn(dg, P), pi = pickInfo(pk), ixs = nlIdx(sch && sch.netlist), drv = ixs.ok ? findDriver(ixs, P, pi) : { ok: false, errs: ['keine Schaltung'] };
    const pulls = {};
    let chainOk = false, chainTxt = '';
    if (match && drv.q && drv.rly && drv.coilOk && pi.ok) {
      const dp = driverParams(Object.assign({}, pi, { rB: drv.rb })), n = P.addrBits, od = arr(dg.outputs).find(o => isObj(o) && lc(o.name) === 'match');
      const iB = dp.mos ? 0 : (P.vOH - U_BE) / dp.rb;
      const drive = fin(+od.iMaxMa) && iB * 1000 <= +od.iMaxMa * (1 + 1e-9);
      let wrongPull = 0, rightPull = false;
      for (let a = 0; a < (1 << n); a++) {
        const m = match(a, P.addr), s = driverSim(dp, P, { vin: m && drive ? P.vOH : 0, diodeRev: !!drv.diodeRev });
        pulls[a] = s.iCoil >= RELAY_PICK * (P.iCoil / 1000);
        if (a === P.addr) rightPull = pulls[a]; else if (pulls[a]) wrongPull++;
      }
      chainOk = rightPull && wrongPull === 0;
      chainTxt = rightPull ? (wrongPull ? wrongPull + ' falsche Codes ziehen das Relais an' : 'nur die Torkennung ' + P.addr + ' zieht das Relais an') : (drive ? 'auch die richtige Kennung zieht das Relais nicht an' : 'der Logikausgang kann den Basisstrom nicht liefern');
    } else chainTxt = 'Decoder, Treiberstufe oder Datenblatt-Auswahl fehlen oder sind nicht auswertbar';
    lines.push(L(chainOk, 'Kette Decoder -> Treiber: ' + chainTxt, 25));
    // 2: Systemlauf
    const an = antDerive(ant, ctx), sd = senDerive(sen, ctx);
    const T = an.ok && fin(an.travelS) && an.travelS > 1 && an.travelS < 60 ? an.travelS : NaN;
    let cyc = 0, crash = true, tSys = NaN;
    const progOk = isObj(sps) && isObj(sps.prog) && SPS() && (() => { try { const p = SPS().create(clone(sps.prog)); return !!p.ok; } catch (e) { return false; } })();
    if (progOk && fin(T)) {
      const Te = effTravel(T), tw = Math.round(P.tVorwarn * 1000), per = tw + Te * 1000 * 1.2 + 800;
      const pr = []; for (let k = 0; k < 3; k++) { const t0 = 400 + k * 2 * per; pr.push(press('I0.0', t0, 200), press('I0.1', t0 + per, 200)); }
      const drive = (t, p) => pr.forEach(f => f(t, p));
      const run = runSps(sps.prog, { scen: 'zu', ms: Math.ceil((400 + 6 * per + 500) / 10) * 10, drive: drive, travelS: T, delayMs: fin(sd.tRespMs) ? sd.tRespMs : 10 });
      cyc = run.st.trips; crash = run.st.crash || run.st.overrun;
      const a0 = firstT(run.rec, r => r.q0, 0), a1 = firstT(run.rec, r => r.pos >= 98, a0);
      tSys = plantSupportsTravel() ? (a1 - a0) / 1000 : T;
    }
    const winOk = fin(tSys) && Math.abs(tSys - P.travelS) <= 0.08 * tolMul * P.travelS;
    lines.push(L(cyc >= 5 && !crash && winOk, 'Systemlauf Garagentor: ' + (progOk && fin(T) ? Math.floor(cyc / 2) + ' von 3 Öffnen/Schließen-Zyklen' + (crash ? ' mit Aufprall oder Überfahren' : ' ohne Aufprall') + ', Fahrzeit ' + (fin(tSys) ? fm(tSys, 2) : '?') + ' s (verlangt ' + fm(P.travelS, 1) + ' s ±' + fm(8 * tolMul, 1) + ' %)' : 'Programm oder Antrieb nicht auswertbar'), 25));
    // 3: Funk-Szenario
    let funkOk = false, funkTxt = 'nicht auswertbar';
    if (progOk && fin(T) && Object.keys(pulls).length) {
      const mask = (1 << P.addrBits) - 1, wrong = (P.addr + 1) & mask, Te = effTravel(T), tw = Math.round(P.tVorwarn * 1000);
      const mk = code => runSps(sps.prog, { scen: 'zu', ms: Math.ceil((400 + tw + Te * 1000 * 1.2 + 1500) / 10) * 10, drive: pulls[code] ? press('I0.0', 400, 200) : () => {}, travelS: T, delayMs: 10 });
      const w = mk(wrong), r = mk(P.addr);
      funkOk = w.st.doorPos < 2 && r.st.doorPos >= 98;
      funkTxt = 'falsche Adresse: Tor ' + (w.st.doorPos < 2 ? 'bleibt zu' : 'öffnet sich') + ', richtige Adresse: Tor ' + (r.st.doorPos >= 98 ? 'öffnet' : 'bleibt zu');
    }
    lines.push(L(funkOk, 'Funk-Szenario: ' + funkTxt, 15));
    // 4: Sicherheit
    const safe = an.ok && fin(an.tReactMs) && an.tReactMs <= P.tReactMaxMs && fin(an.sStopMm) && an.sStopMm <= P.sStopMaxMm;
    lines.push(L(safe, 'Sicherheit: Reaktionszeit ' + (an.ok && fin(an.tReactMs) ? fm(an.tReactMs, 0) : '?') + ' ms (höchstens ' + P.tReactMaxMs + ' ms), Anhalteweg ' + (an.ok && fin(an.sStopMm) ? fm(an.sStopMm, 1) : '?') + ' mm (höchstens ' + P.sStopMaxMm + ' mm)', 20));
    // 5: Dokumentation
    const words = app && typeof app.md === 'string' ? (app.md.match(/[A-Za-zÄÖÜäöüß0-9]+/g) || []).length : 0;
    lines.push(L(words >= 100, 'Dokumentation vorhanden: Notiz mit ' + words + ' Wörtern (mindestens 100)', 5));
    // 6: Konsistenz
    const board = asBoard(pcb && pcb.board), eq = board && ixs.ok && PCB() ? boardEquiv(ixs, PCB().normalize(board)) : null;
    const same_ = pi.ok && drv.q && valueIs(drv.q.value, pi.tr) && (pi.mos || sameVal(drv.rb, pi.rB, 1e-3));
    lines.push(L(!!eq && eq.viol.length === 0 && same_ && isObj(mess) && arr(mess.rows).length >= 4, 'Konsistenz: Schaltplan, Platine und Messprotokoll gehören zusammen (Datenblatt-Auswahl = Schaltplan, Platine = Netzliste)' + (eq && eq.viol.length ? ' – ' + eq.viol[0] : !same_ ? ' – Schaltplan weicht von der Auswahl ab' : ''), 10));
    // Kennzahlen
    const rep = board && PCB() ? boardReport(PCB().normalize(board)) : null;
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!ok && fin(value) });
    k('fahrzeit', 'Fahrzeit', tSys, 's', winOk);
    k('reaktion', 'Reaktionszeit', an.ok ? an.tReactMs : NaN, 'ms', an.ok && an.tReactMs <= P.tReactMaxMs);
    k('anhalteweg', 'Anhalteweg', an.ok ? an.sStopMm : NaN, 'mm', an.ok && an.sStopMm <= P.sStopMaxMm);
    k('spulenstrom', 'Spulenstrom', P.iCoil, 'mA', true);
    k('relais', 'Relais-Ansprechzeit', relayFromMess(ctx), 'ms', fin(relayFromMess(ctx)));
    k('flaeche', 'Platinenfläche', board ? board.w * board.h / 100 : NaN, 'cm²', !!board && board.w <= P.boardW && board.h <= P.boardH);
    k('kosten', 'Platinenkosten', rep ? rep.cost : NaN, '€', !!rep && fin(rep.cost));
    k('gatter', 'Gatterzahl', dg && nlIdx(dg.netlist).ok ? gateCount(nlIdx(dg.netlist)) : NaN, '', dg && gateCount(nlIdx(dg.netlist)) <= BUDGET[lv]);
    k('zyklen', 'Fehlerfreie Zyklen', crash ? 0 : Math.floor(cyc / 2), '', !crash && cyc >= 5);
    return { lines: lines, kpis: kpis };
  }

  /* ====================================================================== Stationen */
  const dropPin = (nl, addr) => {
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    nl.parts.forEach(p => { if (p.ref === ref && p.pins) delete p.pins[pn]; });
    return nl;
  };
  const setPart = (nl, ref, fn) => { nl.parts.forEach(p => { if (p.ref === ref) fn(p); }); return nl; };
  const movePin = (nl, addr, toNet) => {
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    let t = nl.nets.find(n => n.name === toNet); if (!t) { t = { name: toNet, cls: 'signal', pins: [] }; nl.nets.push(t); }
    t.pins.push(addr);
    nl.parts.forEach(p => { if (p.ref === ref && p.pins) p.pins[pn] = toNet; });
    return nl;
  };

  const STATIONS = [
    { id: 'vg1', lab: 'vb', cat: 'Garagentor', title: 'Funk-Adressdecoder bauen', level: 2,
      on: 'digi',
      text: 'Das Funkempfängermodul liefert dir die Adressbits A0 bis An. Mit den DIP-Schaltern S0 bis Sn stellst du die Torkennung ein. Baue den Vergleicher: Der Ausgang MATCH soll nur dann 1 sein, wenn alle Bits übereinstimmen. Halte dich an das Gatterbudget aus dem Lastenheft.',
      in: [], out: 'garage.digi', type: 'digi.design', w: 100, pass: null,
      open: { ex: 'Adressvergleicher' },
      assist: { 1: { kind: 'gatterkarte', gates: ['XOR', 'OR', 'NOR'] } },
      hint: ['Zwei Bits sind gleich, wenn ihre Antivalenz (XOR) 0 ergibt. Du brauchst für jedes Bitpaar ein Gatter.',
        'Verknüpfe alle XOR-Ausgänge mit ODER-Gattern zu einem Signal. Ein NOR am Schluss liefert genau dann 1, wenn alle XOR-Ausgänge 0 sind.',
        'Je Bitpaar ein XOR (A_i, S_i). Die Ausgänge paarweise mit ODER zusammenfassen, bis zwei Signale übrig sind, und diese mit NOR zu MATCH verknüpfen. Alle Eingänge anschließen, Ausgang MATCH benennen.'],
      check: safe(checkDigi, 'Decoder'),
      starter: ctx => ({ netlist: { v: 1, name: 'leer', parts: [], nets: [] }, inputs: [], outputs: [], vdd: { min: 3, max: 15 } }),
      solution: ctx => buildDigi(P_(ctx)),
      mutants: [
        { name: 'XOR durch UND ersetzt', mutate: d => { setPart(d.netlist, 'X0', p => { p.kind = 'AND'; }); return d; }, expectFail: ['Wahrheitstabelle'] },
        { name: 'ein Gattereingang offen', mutate: d => { dropPin(d.netlist, 'X1.B'); return d; }, expectFail: ['offenen Eingänge'] },
        { name: 'Ausgang falsch benannt', mutate: d => { d.outputs[0].name = 'OUT'; return d; }, expectFail: ['Ausgang MATCH'] },
        { name: 'Treiberfähigkeit falsch', mutate: d => { d.outputs[0].iMaxMa = 25; return d; }, expectFail: ['Treiberfähigkeit'] },
        { name: 'Gatterbudget überschritten', mutate: d => { for (let i = 0; i < 6; i++) d.netlist.parts.push({ ref: 'Z' + i, kind: 'NOT', value: '', pins: { A: 'z' + i, Y: 'zz' + i } }); return d; }, expectFail: ['Gatterbudget'] }
      ] },

    { id: 'vg2', lab: 'vb', cat: 'Garagentor', title: 'Treiber aus den Datenblättern wählen', level: 2,
      on: 'ds',
      text: 'Das Relais braucht mehr Strom, als der Logikausgang MATCH liefern darf. Wähle in den Übungsdatenblättern einen Transistor und eine Freilaufdiode. Rechne den Basiswiderstand aus der E12-Reihe: Der Transistor soll mit Faktor 2 übersteuert werden, und der Ausgang darf nicht überlastet werden.',
      in: ['garage.digi'], out: 'garage.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'transistor', label: 'Transistor', type: 'select', options: [{ value: 'tf-bc547', label: 'BC547 (NPN)' }, { value: 'tf-bd139', label: 'BD139 (NPN, TO-126)' }, { value: 'tf-2n7000', label: '2N7000 (N-MOSFET)' }] },
        { key: 'hfeKey', label: 'h_FE-Zeile des Datenblatts', type: 'select', options: [{ value: 'hfeA', label: 'BC547 Gruppe A' }, { value: 'hfeB', label: 'BC547 Gruppe B' }, { value: 'hfeC', label: 'BC547 Gruppe C' }, { value: 'hfe5m', label: 'BD139 bei 5 mA' }, { value: 'hfe150', label: 'BD139 bei 150 mA' }, { value: '', label: 'keine (MOSFET)' }] },
        { key: 'rB', label: 'Basiswiderstand R_B', type: 'eseries', unit: 'Ω', hint: 'E12-Reihe' },
        { key: 'diode', label: 'Freilaufdiode', type: 'select', options: [{ value: 'tf-1n4148', label: '1N4148' }, { value: 'tf-1n4007', label: '1N4007' }, { value: 'tf-zd', label: 'Z-Diode 5,1 V' }] }
      ],
      fromForm: v => {
        const t = dsOf(v.transistor), d = dsOf(v.diode), rb = numOf(v.rB);
        return { items: [{ role: 'transistor', ds: v.transistor, part: t ? t.part : '', ref: t ? t.ref : '' }, { role: 'diode', ds: v.diode, part: d ? d.part : '', ref: d ? d.ref : '' }],
          calc: {}, vals: { rB: fin(rb) ? rb : null, hfeKey: v.hfeKey || '' } };
      },
      open: { ex: 'Transistor als Schalter' },
      hint: ['Der Transistor muss mindestens die doppelte Spulenspannung und den doppelten Spulenstrom aushalten. Schau in die Grenzwerte (Absolute Maximum Ratings).',
        'Basisstrom: I_B = 2 · I_C / h_FE,min. Nimm h_FE,min aus der Datenblattzeile und rechne den Widerstand aus (U_OH minus 0,7 V) / I_B. Der Strom darf den Ausgangsstrom aus dem Decoder nicht übersteigen.',
        'BC547 Gruppe B (h_FE,min 200) und eine 1N4007 als Freilaufdiode. R_B so wählen, dass der Basisstrom zwischen dem nötigen Wert und dem Ausgangsstrom liegt, dann den nächsten E12-Wert nehmen.'],
      check: safe(checkDs, 'Auswahl'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => dsSolution(ctx),
      mutants: [
        { name: 'BD139 gewählt (Basisstrom zu groß)', mutate: d => { d.items[0] = { role: 'transistor', ds: 'tf-bd139', part: 'TF-BD139', ref: 'BD139' }; d.vals.hfeKey = 'hfe150'; return d; }, expectFail: ['Basisstrom'] },
        { name: 'R_B nicht aus der E12-Reihe', mutate: d => { d.vals.rB = 4500; delete d.calc.iBistMa; return d; }, expectFail: ['E12'] },
        { name: 'Z-Diode als Freilaufdiode', mutate: d => { d.items[1] = { role: 'diode', ds: 'tf-zd', part: 'TF-ZD5V1', ref: 'BZX55C5V1' }; return d; }, expectFail: ['Freilaufdiode'] },
        { name: 'R_B viel zu groß', mutate: d => { d.vals.rB = 100000; delete d.calc.iBistMa; return d; }, expectFail: ['Basisstrom'] }
      ] },

    { id: 'vg3', lab: 'vb', cat: 'Garagentor', title: 'Treiberstufe im Schaltplan zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne die Treiberstufe mit den Bauteilen aus deiner Auswahl: Eine 12-V-Quelle, das Relais, der Transistor mit R_B, die Freilaufdiode parallel zur Spule und eine Betriebs-LED mit Vorwiderstand. Der Eingang IN ist eine 5-V-Quelle mit Schalter, sie steht für den Ausgang MATCH. Simuliere, dass das Relais anzieht und wieder abfällt.',
      in: ['garage.ds', 'garage.digi'], out: 'garage.sch', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Relaistreiber' },
      assist: { 1: { kind: 'startschaltung', parts: ['BAT 12 V', 'BAT 5 V', 'Masse'] } },
      hint: ['Die Spule liegt zwischen +12 V und dem Kollektor, der Emitter an Masse. Der Transistor schaltet die Spule gegen Masse.',
        'Die Freilaufdiode liegt parallel zur Spule: Kathode an +12 V, Anode am Kollektor. Sie nimmt beim Abschalten den Strom der Spule auf.',
        'Quelle 5 V über Schalter und R_B an die Basis. LED mit Vorwiderstand von +12 V nach Masse: R = (12 V minus U_F) / 10 mA, nächster E12-Wert. Dann bei geschlossenem Schalter den Spulenstrom messen.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => buildSch(P_(ctx), need(ctx, 'garage.ds')),
      mutants: [
        { name: 'Freilaufdiode fehlt', mutate: d => { d.netlist.parts = d.netlist.parts.filter(p => p.ref !== 'D1'); d.netlist.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf('D1.') !== 0); }); return d; }, expectFail: ['Topologie'] },
        { name: 'Freilaufdiode verpolt', mutate: d => { setPart(d.netlist, 'D1', p => { p.pins = { A: p.pins.K, K: p.pins.A }; }); d.netlist.nets.forEach(n => { n.pins = n.pins.map(a => a === 'D1.A' ? 'D1.K' : a === 'D1.K' ? 'D1.A' : a); }); return d; }, expectFail: ['Topologie', 'Simulation bei IN'] },
        { name: 'R_B passt nicht zur Auswahl', mutate: d => { setPart(d.netlist, 'R1', p => { p.value = fmtR(numOf(p.value) * 10); }); return d; }, expectFail: ['Bauteilwerte'] },
        { name: 'Emitter nicht an Masse', mutate: d => { movePin(d.netlist, 'Q1.E', 'N_X'); movePin(d.netlist, 'Q1.S', 'N_X'); return d; }, expectFail: ['Topologie'] },
        { name: 'LED ohne passenden Vorwiderstand', mutate: d => { setPart(d.netlist, 'R2', p => { p.value = '10'; }); return d; }, expectFail: ['Betriebs-LED'] }
      ] },

    { id: 'vg4', lab: 'vb', cat: 'Garagentor', title: 'Treiberplatine entwerfen', level: 3,
      on: 'pcb',
      text: 'Entwirf aus deinem Schaltplan die Treiberplatine, ein- oder zweilagig und höchstens 60 mal 40 Millimeter. Die Quellen werden Schraubklemmen: eine für 12 V, eine für IN und eine für den Relaiskontakt. Verlege alle Netze, die Leistungsbahnen der Spule breit genug, und bleibe ohne DRC-Fehler.',
      in: ['garage.sch'], out: 'garage.pcb', type: 'pcb.board', w: 100, pass: null,
      open: { ex: 'Treiberplatine' },
      assist: { 1: { kind: 'vorplatziert' } },
      hint: ['Lege zuerst die Bauteile samt Klemmen in Randnähe, dann ordne sie so, dass die Verbindungen kurz bleiben. Jeder Pin muss im gleichen Netz wie im Schaltplan liegen.',
        'Die Leiterbahnen der Spule führen nur wenige Milliampere. Trotzdem gilt eine Mindestbreite von 0,3 mm. Prüfe die DRC-Liste, bis sie leer ist.',
        'Klemme für 12 V und Masse, Klemme für IN und Masse, Klemme für Relaiskontakt COM und NO. Autorouter laufen lassen, Breite der Netze auf mindestens 0,3 mm stellen, dann DRC und Kosten prüfen.'],
      check: safe(checkPcb, 'Platine'),
      starter: ctx => { const P = P_(ctx); const b = PCB().newBoard({ id: 'garage', name: 'Neue Platine', w: P.boardW, h: P.boardH, layers: P.layers }); return { board: b, report: boardReport(b) }; },
      solution: ctx => { const P = P_(ctx), sch = need(ctx, 'garage.sch'), b = buildBoard(sch.netlist, P); return { board: b, report: boardReport(b) }; },
      mutants: [
        { name: 'keine Leiterbahnen', mutate: d => { d.board.tracks = []; d.board.vias = []; d.report = boardReport(d.board); return d; }, expectFail: ['Alle Netze verlegt'] },
        { name: 'Pads der Diode vertauscht', mutate: d => { d.board.nets.forEach(n => { n.pins = n.pins.map(p => p === 'D1.1' ? 'D1.2' : p === 'D1.2' ? 'D1.1' : p); }); d.report = boardReport(d.board); return d; }, expectFail: ['Netze der Platine identisch'] },
        { name: 'Leistungsbahnen zu schmal', mutate: d => { d.board.tracks.forEach(t => { t.w = 0.15; }); d.report = boardReport(d.board); return d; }, expectFail: ['Leistungsnetze', 'DRC'] },
        { name: 'Platine zu groß', mutate: d => { d.board.w = 80; d.report = boardReport(d.board); return d; }, expectFail: ['Maße und Lagen'] },
        { name: 'Klemme für IN fehlt', mutate: d => { d.board.parts = d.board.parts.filter(p => p.ref !== 'X2'); d.board.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf('X2.') !== 0); }); d.report = boardReport(d.board); return d; }, expectFail: ['Netze der Platine identisch'] }
      ] },

    { id: 'vg5', lab: 'vb', cat: 'Garagentor', title: 'Inbetriebnahme: Messprotokoll', level: 2,
      on: 'mess',
      text: 'Die Platine ist bestückt. Miss mit Multimeter und Oszilloskop die Versorgung, die Spannungen am Transistor, die Spannung und den Strom der Spule sowie die Ansprechzeit des Relais. Trage die gemessenen Werte mit Einheit und Messgerät in das Protokoll ein. Wenn etwas nicht stimmt, notiere deinen Befund.',
      in: ['garage.pcb'], out: 'garage.mess', type: 'mess.protocol', w: 100, pass: null,
      form: [
        { key: 'uSup', label: 'Versorgung U_sup', type: 'number', unit: 'V' }, { key: 'uBE', label: 'Basis-Emitter U_BE', type: 'number', unit: 'V' },
        { key: 'uCE', label: 'Kollektor-Emitter U_CE', type: 'number', unit: 'V' }, { key: 'uCoil', label: 'Spulenspannung U_coil', type: 'number', unit: 'V' },
        { key: 'iCoil', label: 'Spulenstrom I_coil', type: 'number', unit: 'mA' }, { key: 'tRelais', label: 'Relais-Ansprechzeit', type: 'number', unit: 'ms' },
        { key: 'finding', label: 'Befund', type: 'area' }
      ],
      fromForm: v => {
        const mk = (id, label, unit, val, ins, tp) => ({ id: id, label: label, unit: unit, soll: 0, ist: fin(numOf(val)) ? numOf(val) : null, tol: 3, instrument: ins, tp: tp });
        return { rows: [mk('U_sup', 'Versorgung', 'V', v.uSup, 'Multimeter', ''), mk('U_BE', 'Basis-Emitter', 'V', v.uBE, 'Multimeter', ''), mk('U_CE', 'Kollektor-Emitter', 'V', v.uCE, 'Multimeter', ''),
          mk('U_coil', 'Spule', 'V', v.uCoil, 'Multimeter', ''), mk('I_coil', 'Spulenstrom', 'mA', v.iCoil, 'Multimeter', ''), mk('tRelaisMs', 'Ansprechzeit', 'ms', v.tRelais, 'Oszilloskop', '')],
          values: fin(numOf(v.tRelais)) ? { tRelaisMs: numOf(v.tRelais) } : {}, findings: v.finding ? [String(v.finding)] : [] };
      },
      open: { ex: 'Relaistreiber messen' },
      hint: ['Miss die Spannungen gegen Masse. Bei durchgeschaltetem Transistor liegt U_CE nur knapp über 0 V und die Spule bekommt fast die ganze Versorgung.',
        'Die Ansprechzeit misst du am Oszilloskop: von der Flanke an IN bis zum Anziehen des Relais. Sie liegt im Bereich einiger Millisekunden.',
        'Weicht ein Wert stark vom Schaltplan ab, ist die Schaltung fehlerhaft: Ein zu großer Basiswiderstand verhindert die Sättigung, eine verpolte Freilaufdiode schließt die Spule kurz. Trage den gemessenen Wert trotzdem ein und notiere den Befund.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'U_CE falsch gemessen', mutate: d => { const r = d.rows.find(x => x.id === 'U_CE'); r.ist = r.ist < 6 ? r.ist + 4 : r.ist - 4; return d; }, expectFail: ['U_CE'] },
        { name: 'Ansprechzeit doppelt so lang', mutate: d => { d.values.tRelaisMs *= 2; d.rows.find(x => x.id === 'tRelaisMs').ist *= 2; return d; }, expectFail: ['Relais-Ansprechzeit'] },
        { name: 'Messgerät und Einheit fehlen', mutate: d => { d.rows.forEach(r => { r.instrument = ''; r.unit = ''; }); return d; }, expectFail: ['Protokoll vollständig'] },
        { name: 'U_BE nicht gemessen', mutate: d => { d.rows = d.rows.filter(x => x.id !== 'U_BE'); return d; }, expectFail: ['U_BE'] },
        { name: 'Befund fehlt', levels: [3], mutate: d => { d.findings = []; return d; }, expectFail: ['Fehler benannt'] }
      ] },

    { id: 'vg6', lab: 'vb', cat: 'Garagentor', title: 'Einklemmschutz: Sensorik einstellen', level: 3,
      on: 'sen',
      text: 'Die Reflexlichtschranke muss ein dunkles Ziel bei dem Fremdlicht aus dem Lastenheft sicher erkennen und ohne Ziel nicht schalten. Stelle Lastwiderstand, Schwelle, Hysterese und Entprellzeit ein. Der induktive Endschalter erkennt die Aluminium-Lamellen: Wähle den Montageabstand. Die Reaktionskette mit SPS und deiner gemessenen Relaiszeit muss unter dem Limit bleiben.',
      in: ['garage.mess'], out: 'garage.sen', type: 'sen.chain', w: 100, pass: null,
      open: { ex: 'Reflexlichtschranke', rig: 'licht' },
      hint: ['Bei viel Fremdlicht sättigt ein großer Lastwiderstand den Fototransistor. Verkleinere ihn, bis sich die Spannung mit und ohne Ziel deutlich unterscheidet.',
        'Lege die Schwelle genau zwischen beide Spannungen. Die Hysterese soll klein, aber nicht null sein, und die Entprellzeit nur so groß wie nötig, denn sie kostet Reaktionszeit.',
        'Aluminium schaltet nur mit dem Reduktionsfaktor 0,4: Der Schaltabstand ist nur 40 % des Nennschaltabstands. Montiere mit 20 % Reserve darunter und mindestens 10 % des Nennschaltabstands vom Ziel entfernt.'],
      check: safe(checkSen, 'Sensorik'),
      starter: ctx => { const P = P_(ctx); return { rig: 'licht', preset: '', ctl: { sensor: 'ldr', lux: 500, dist: 20, rLoad: 10000, thresh: 2.5, hyst: 0.2, ambient: 0, fdelay: 0 }, ctl2: { sensor: 'induktiv', material: 'stahl', dist: 12 }, state: {}, derived: {} }; },
      solution: ctx => senSolution(ctx),
      mutants: [
        { name: 'ohne Hysterese', mutate: d => { d.ctl.hyst = 0; return d; }, expectFail: ['Hysterese'] },
        { name: 'Entprellzeit 300 ms', mutate: d => { d.ctl.fdelay = 300; return d; }, expectFail: ['Reaktionszeit'] },
        { name: 'Endschalter zu weit weg (6 mm)', mutate: d => { d.ctl2.dist = 6; return d; }, expectFail: ['Endlage'] },
        { name: 'Fremdlicht weggerechnet', mutate: d => { d.ctl.ambient = 0; return d; }, expectFail: ['Funktion'] },
        { name: 'Lastwiderstand 100 kΩ (Sättigung)', mutate: d => { d.ctl.rLoad = 100000; return d; }, expectFail: ['Funktion'] }
      ] },

    { id: 'vg7', lab: 'vb', cat: 'Garagentor', title: 'Torantrieb auslegen', level: 3,
      on: 'ant',
      text: 'Der 24-V-Getriebemotor soll das Tor über die Seiltrommel in der verlangten Fahrzeit bewegen. Wähle die Zähnezahlen des zweistufigen Stirnradgetriebes und den Tastgrad der PWM so, dass die Fahrzeit stimmt. Der Motor muss im Nennbereich bleiben, der Anhalteweg mit deiner Reaktionszeit unter dem Limit liegen, und du wählst die Absicherung.',
      in: ['garage.sen'], out: 'garage.ant', type: 'ant.setup', w: 100, pass: null,
      open: { ex: 'Torantrieb', rig: 'gleichstrom' },
      hint: ['Die Fahrzeit folgt aus der Trommeldrehzahl: v = π · d · n / 60 und t = Hub / v. Aus der Fahrzeit rechnest du die Drehzahl der Trommel aus.',
        'Die Übersetzung ist n_Motor / n_Trommel, aus den Zähnezahlen: i = z2/z1 · z4/z3. Die Last am Motor ist F · r / (i · η). Mit dem Tastgrad stellst du die Drehzahl fein ein.',
        'Die Sicherung muss größer als das 1,25-fache des Nennstroms sein, aber kleiner als der Anlaufstrom. Der Anhalteweg ist v · Reaktionszeit plus der kurze Bremsweg beim Kurzschließen der Wicklung.'],
      check: safe(checkAnt, 'Antrieb'),
      starter: ctx => ({ rig: 'gleichstrom', preset: 'getriebe12', ctl: { motor: 'getriebe12', uSupply: 12, duty: 0, dir: 'vor' }, gear: { type: 'stirnrad', stages: 2, z1: 20, z2: 20, z3: 20, z4: 20 }, fuseA: 0, state: {}, derived: {} }),
      solution: ctx => antSolution(ctx),
      mutants: [
        { name: 'Übersetzung viel zu klein', mutate: d => { d.gear.z1 = 24; d.gear.z2 = 40; d.gear.z3 = 24; d.gear.z4 = 30; return d; }, expectFail: ['Fahrzeit'] },
        { name: 'Sicherung 2 A zu klein', mutate: d => { d.fuseA = 2; return d; }, expectFail: ['Absicherung'] },
        { name: 'Sicherung 80 A zu groß', mutate: d => { d.fuseA = 80; return d; }, expectFail: ['Absicherung'] },
        { name: 'Tastgrad 40 Prozent', mutate: d => { d.ctl.duty = 40; return d; }, expectFail: ['Fahrzeit'] },
        { name: 'Zähnezahl nicht ganzzahlig', mutate: d => { d.gear.z2 = d.gear.z2 + 0.5; return d; }, expectFail: ['Getriebe'] }
      ] },

    { id: 'vg8', lab: 'vb', cat: 'Garagentor', title: 'Torsteuerung programmieren', level: 3,
      on: 'sps',
      text: 'Programmiere die Torsteuerung: Funk und Taster geben Auf und Ab, der Stopp-Taster ist ein Öffner, die Endschalter beenden die Fahrt. Vor jeder Fahrt blinkt das Licht die Vorwarnzeit lang. Die Lichtschranke stoppt das schließende Tor und fährt es wieder auf. Eine Fahrzeitüberwachung mit dem Anderthalbfachen der Fahrzeit schaltet bei Klemmen ab.',
      in: ['garage.ant', 'garage.sen'], out: 'garage.sps', type: 'sps.program', w: 100, pass: null,
      open: { ex: 'Garagentor', plant: 'garagentor' },
      assist: { 1: { kind: 'rahmenprogramm' } },
      hint: ['Fange mit der Selbsthaltung an: Eine Anforderung Auf oder Ab wird gemerkt und beim Endschalter, beim Stopp-Taster oder bei einer Störung gelöscht. Auf und Ab verriegeln sich gegenseitig.',
        'Die Vorwarnzeit bekommst du mit einer Einschaltverzögerung (TON) auf die Anforderung. Das Blinklicht hängt direkt an der Anforderung, der Motor an dem Zeitglied. Die Lichtschranke beim Schließen löscht die Anforderung Ab und setzt die Anforderung Auf.',
        'Die Fahrzeitüberwachung ist ein TON auf dem Motorausgang mit 1,5 mal der Fahrzeit aus deiner Antriebsstation. Läuft er ab, wird eine Störung gesetzt, die beide Fahrtrichtungen sperrt. Quittiert wird mit dem Stopp-Taster.'],
      check: safe(checkSps, 'SPS'),
      starter: ctx => ({ prog: { lang: 'kop', symbols: Object.assign({}, SYM), networks: [] }, plant: 'garagentor', opts: {}, lang: 'kop' }),
      solution: ctx => { const P = P_(ctx), c = spsContext(ctx); return { prog: buildProgram(P, c.travelS), plant: 'garagentor', opts: { travelS: rd(c.travelS, 2) }, lang: 'kop', notes: 'Musterlösung: Anforderungsmerker, Vorwarnzeit, Lichtschranke, Fahrzeitüberwachung' }; },
      mutants: [
        { name: 'Lichtschranke nicht ausgewertet', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N6'); d.prog.networks.forEach(n => { if (n.id === 'N10') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.4')); }); return d; }, expectFail: ['Ab mit Hindernis'] },
        { name: 'Verriegelung entfernt', mutate: d => { d.prog.networks.forEach(n => { if (['N4', 'N5', 'N9', 'N10'].indexOf(n.id) >= 0) n.expr.in = n.expr.in.filter(e => !(e.t === 'var' && e.neg && (e.a === 'M0.0' || e.a === 'M0.1'))); }); return d; }, expectFail: ['Richtungswechsel', 'Verriegelungsverletzung'] },
        { name: 'keine Fahrzeitüberwachung', mutate: d => { d.prog.networks = d.prog.networks.filter(n => n.id !== 'N1' && n.id !== 'N2'); return d; }, expectFail: ['Fahrzeitüberwachung'] },
        { name: 'keine Vorwarnzeit', mutate: d => { d.prog.networks.forEach(n => { if (n.expr && n.expr.fb === 'ton' && (n.expr.id === 'T1' || n.expr.id === 'T2')) n.expr.pt = 0; }); return d; }, expectFail: ['Blinklicht'] },
        { name: 'Endschalter oben ignoriert', mutate: d => { d.prog.networks.forEach(n => { if (n.id === 'N9' || n.id === 'N11') n.expr.in = n.expr.in.filter(e => !(e.a === 'I0.2')); }); return d; }, expectFail: ['Verriegelungsverletzung'] }
      ] },

    { id: 'vg9', lab: 'vb', cat: 'Garagentor', title: 'Bedienungsanleitung und Übergabe', level: 1,
      on: 'app',
      text: 'Schreibe für die Hausmeister eine Notiz im Obsidian-Format: Bedienung, Sicherheit und die technischen Daten deines Tors, dazu eine kurze Fehlerliste zur Wartung. Nimm die Zahlen aus deinen eigenen Stationen.',
      in: ['garage.sps', 'garage.ant', 'garage.mess', 'garage.pcb'], out: 'garage.app', type: 'app.note', w: 100, pass: null,
      form: [{ key: 'md', label: 'Notiz (Markdown)', type: 'area', hint: 'mit Frontmatter, Überschriften und Listen' }],
      fromForm: v => { const md = String(v.md || ''); return { title: (/^#\s+(.+)$/m.exec(md) || [0, ''])[1], md: md, tags: [] }; },
      open: { ex: 'Notiz-Vorlage' },
      hint: ['Gliedere die Notiz mit Überschriften: Technische Daten, Bedienung, Sicherheit, Wartung. Oben gehört ein Frontmatter mit tags und date hinein.',
        'Technische Daten: Fahrzeit, Reaktionszeit, Spulenstrom, Anhalteweg, Platinenmaße und die Relais-Ansprechzeit. Schreibe sie mit Zahl und Einheit, jeweils eine Zeile.',
        'Im Abschnitt Sicherheit müssen Lichtschranke und Stopp-Taste vorkommen. Die Fehlerliste braucht mindestens drei Punkte mit Aufzählungszeichen. Insgesamt mindestens 150 Wörter.'],
      check: safe(checkApp, 'Notiz'),
      starter: ctx => ({ title: 'Neue Notiz', md: '', tags: [] }),
      solution: ctx => noteSolution(ctx),
      mutants: [
        { name: 'falsche Zahlen', mutate: d => { d.md = d.md.replace(/(\d+)([.,]\d+)?(?= ?(s|ms|mA|mm)\b)/g, '999'); return d; }, expectFail: ['Technische Daten'] },
        { name: 'keine Überschriften', mutate: d => { d.md = d.md.replace(/^#+ /gm, ''); return d; }, expectFail: ['Abschnitte'] },
        { name: 'Frontmatter fehlt', mutate: d => { d.md = d.md.replace(/^---[\s\S]*?---\r?\n/, ''); return d; }, expectFail: ['Frontmatter'] },
        { name: 'Notiz zu kurz', mutate: d => { d.md = d.md.split('\n').slice(0, 9).join('\n'); return d; }, expectFail: ['Gliederung', 'Abschnitte'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k] };
    const out = [];
    const dg = g('garage.digi'), sch = g('garage.sch'), pcb = g('garage.pcb'), mess = g('garage.mess'), sen = g('garage.sen'), ant = g('garage.ant'), sps = g('garage.sps'), app = g('garage.app');
    out.push({ h: 'Lastenheft', rows: [['Torkennung', P.addr + ' (' + P.addrBits + ' Bit)'], ['Relais', fm(P.uCoil, 0) + ' V, ' + P.rCoil + ' Ω, ' + fm(P.iCoil, 0) + ' mA'], ['Tor', fm(P.hub, 2) + ' m in ' + fm(P.travelS, 0) + ' s, Restkraft ' + P.fLast + ' N'], ['Sicherheit', 'Reaktion höchstens ' + P.tReactMaxMs + ' ms, Anhalteweg höchstens ' + P.sStopMaxMm + ' mm']] });
    if (dg) { const ix = nlIdx(dg.netlist); out.push({ h: 'Adressdecoder', rows: [['Gatter', gateCount(ix)], ['Eingänge', arr(dg.inputs).length], ['Ausgang', 'MATCH, ' + fm(P.iOutMax, 0) + ' mA']] }); }
    if (sch && isObj(sch.netlist)) out.push({ h: 'Schaltung und Stückliste', rows: sch.netlist.parts.map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    const b = pcb && asBoard(pcb.board); if (b && PCB()) { const r = boardReport(PCB().normalize(b)); out.push({ h: 'Platine', rows: [['Maße', fm(r.w, 0) + ' x ' + fm(r.h, 0) + ' mm, ' + r.layers + ' Lagen'], ['Bauteile', r.bomCount], ['DRC-Fehler', r.drcErrors], ['Kosten', fm(r.cost, 2) + ' €']] }); }
    if (mess) out.push({ h: 'Messprotokoll', rows: arr(mess.rows).map(r => [r.label || r.id, fm(+r.ist, 2) + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) });
    const sd = sen ? senDerive(sen, ctx) : null; if (sd && sd.ok) out.push({ h: 'Sensorik', rows: [['Sensorreaktion', fm(sd.tRespMs, 0) + ' ms'], ['SPS', fm(sd.tSpsMs, 0) + ' ms'], ['Relais', fm(sd.tRelaisMs, 1) + ' ms'], ['Reaktionszeit gesamt', fm(sd.tReactMs, 0) + ' ms']] });
    const ad = ant ? antDerive(ant, ctx) : null; if (ad && ad.ok) out.push({ h: 'Antrieb', rows: [['Übersetzung', fm(ad.ratio, 1)], ['Fahrzeit', fm(ad.travelS, 2) + ' s'], ['Motorstrom', fm(ad.iRun, 2) + ' A'], ['Anhalteweg', fm(ad.sStopMm, 1) + ' mm'], ['Absicherung', fm(+ant.fuseA, 1) + ' A']] });
    if (sps && isObj(sps.prog) && SPS()) { let txt = ''; try { txt = SPS().toText(sps.prog, 'iec', { symbols: true }); } catch (e) { txt = ''; } out.push({ h: 'SPS-Programm', html: '<pre>' + String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' }); }
    if (app && app.md) out.push({ h: 'Bedienungsanleitung (App-Werkstatt)', html: '<pre>' + String(app.md).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Garage: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Garage: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Garage: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Garagentor mit Funköffner', icon: '🚪', prefix: 'vg', order: 1,
    story: 'Die Hausmeister-Abteilung der Tonfunk GmbH rüstet das Rolltor der Fahrradgarage im Hof mit einem Funköffner nach. Meister Funk: „Das Tor läuft heute nur mit Schlüsselschalter. Wir bauen einen Funkempfänger mit Adresscode, eine Treiberplatine fürs Relais und eine Torsteuerung, die nichts einklemmt.“ Die Platine bekommt die Firma, die Steuerung bekommt die SPS im Hof.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['digi', 'ds', 'sch', 'pcb', 'mess', 'sen', 'ant', 'sps', 'app'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    stations: STATIONS,
    final: {
      id: 'vgF', title: 'Abschlusstest: Garagentor', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Torsteuerung leer', mutate: s => { s['garage.sps'] = { prog: { lang: 'kop', symbols: {}, networks: [] }, plant: 'garagentor' }; return s; }, expectFail: ['Systemlauf', 'Funk-Szenario'] },
        { name: 'Decoder vergleicht falsch', mutate: s => { setPart(s['garage.digi'].netlist, 'X0', p => { p.kind = 'AND'; }); return s; }, expectFail: ['Kette Decoder'] },
        { name: 'keine Notiz', mutate: s => { s['garage.app'] = { title: '', md: '', tags: [] }; return s; }, expectFail: ['Dokumentation'] }
      ]
    },
    kpis: ['fahrzeit', 'reaktion', 'anhalteweg', 'spulenstrom', 'relais', 'flaeche', 'kosten', 'gatter', 'zyklen'],
    report: reportParts,
    selfTest: selfTest,
    _test: { resetPlantProbe: function () { supportsTravel = null; spsCache.clear(); }, relayMs: relayMs },
    demos: [{ id: 'bis4', name: 'Garagentor bis Station 4', upTo: 'vg4' }, { id: 'fertig', name: 'Garagentor fertig', upTo: 'vgF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_GARAGE = def;
})(typeof window !== 'undefined' ? window : globalThis);
