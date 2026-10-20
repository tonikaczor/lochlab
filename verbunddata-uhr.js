/* verbunddata-uhr.js - Verbundprojekt 3: Digitale Uhr mit Wecker (Projektdefinition, Paket P3)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.3. Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Benötigt zur Laufzeit der Prüfungen (alle rein rechnerisch, ohne Browser): dscore.js + dslib-semi.js + dslib-ic.js, pcbcore.js, simcore.js + simics.js,
 * arduino.js, verbundnl.js (Netzlisten, Simulation, Teilerverhältnis) und verbundrun.js (mkMockIo). Die Arduino-Läufe der Uhr macht diese Datei selbst
 * (Schrittweite mit Zittern und Sprung auf den nächsten Weckzeitpunkt), weil die Gangmessung über Tage sonst an der festen Schrittweite scheitert.
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   ds.pick       { items:[{role:'diode'|'regler', ds, part, ref}], calc:{dUV?, uInMinV?, pVW?, tjC?}, vals:{cSieb (µF), uElko (V), begruendung} }
 *   digi.design   { netlist, inputs:[], outputs:[{name:'CLK1HZ', ref:'U6.14'}], vdd:{min,max} }      Quarz als Bauteil XTAL, 4060 (und 4013 oder zweiter 4060)
 *   sch.circuit   { lab, name, netlist, meas, snap }        Zähler 4518, Dekoder 4543, Anzeigen SEG8, Rücksetz-UND (ICX 4081 oder AND), Takt als Bauteil CLK
 *   loch.layout   { name, netlist, boards, bom:[{ref,kind,value}], doc, wiresRibbon?, boardOf?:{ref:Platinen-Nr} }   boardOf fehlt meist: dann aus doc.boards und den Bauteilen mit Beschriftung (l, x, y); ohne Takt-Quelle und ohne Einzelpin-Netze (LochLab)
 *   pcb.board     { board (Objekt oder JSON-Text), report:{w,h,layers,drcErrors,drcWarns,unrouted,shorts,cost,bomCount} }
 *   mess.protocol { rows:[{id:'f_ist'|'ppm'|'gangSProTag'|'U_VDD', label, unit, soll, ist, tol, instrument, tp?}], values:{fIstHz, ppm, gangSProTag, richtung:'vor'|'nach'}, findings:[text] }
 *   code.sketch   { lang:'arduino', src, run? }
 *   app.note      { title, md, tags }
 * lastenheft().params enthält Lösungswerte (ppm, fIst, gangTag, genannt in params.hidden): im Hub nicht anzeigen, nur params.text/Zeilen.
 * Werte mit (A) sind Annahmen (Lehrwerte), siehe SPEC Abschnitt 8 und 13.3. */
(function (root) {
  'use strict';

  const PID = 'uhr';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = x => (Array.isArray(x) ? x : []);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const rd = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const sameVal = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-6 : rel) * Math.max(Math.abs(a), Math.abs(b), 1e-12);
  const lc = s => String(s == null ? '' : s).toLowerCase();
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });

  /* ---------- Hash, Zufall (gleich zum Kern: FNV-1a 32 Bit, mulberry32) ---------- */
  function hash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  /* ---------- Kerne und Bibliotheken (erst zur Laufzeit gelesen) ---------- */
  function dep(glob, file) {
    if (root[glob]) return root[glob];
    try { if (typeof require === 'function') return require('./' + file); } catch (e) { /* nicht vorhanden */ }
    return null;
  }
  const DS = () => root.DS_CORE, LIB = () => root.DS_LIB, PCB = () => root.PCB_CORE;
  const NL = () => root.VerbundNL || (root.Verbund && root.Verbund.nl) || dep('VerbundNL', 'verbundnl.js');
  const RUN = () => root.VerbundRun || (root.Verbund && root.Verbund.mkMockIo ? root.Verbund : null) || dep('VerbundRun', 'verbundrun.js');
  const ARD = () => root.Arduino || dep('Arduino', 'arduino.js');
  function numOf(v) {                         // '4k7', '330u', '12V', 330 -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const n = NL(); if (n && n.num) { const x = n.num(s); if (fin(x)) return x; }
    const m = /^(\d+(?:[.,]\d+)?)/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) : NaN;
  }
  const E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
  function isE(v, series) {                   // Wert in E6/E12/E24?
    const d = DS(); if (!d || !fin(v) || v <= 0) return false;
    const n = d.eSeries(series || 'E12', v, 'nearest');
    return fin(n) && Math.abs(n - v) <= 1e-6 * v;
  }
  function e6Up(x) {                          // kleinster E6-Wert >= x
    let dec = Math.pow(10, Math.floor(Math.log10(x) - 1e-12));
    for (let k = 0; k < 40; k++) { for (const m of E6) { const v = Math.round(m * dec * 1e6) / 1e6; if (v >= x * (1 - 1e-12)) return v; } dec *= 10; }
    return x;
  }
  const VOLTS = [6.3, 10, 16, 25, 35, 50, 63, 100];
  const voltUp = x => VOLTS.find(v => v >= x - 1e-9) || 100;

  /* ====================================================================== Lastenheft */
  const IO = [
    { key: 'D8', sym: 'PIEZO', text: 'Piezo-Summer (Ton mit tone())' },
    { key: 'D2', sym: 'TASTER', text: 'Taster Wecker aus (nach Masse, INPUT_PULLUP, gedrückt = LOW)' },
    { key: 'I2C', sym: 'LCD', text: 'I²C-LCD 16 x 2, Adresse 0x27, Zeit in Zeile 1 als hh:mm:ss' },
    { key: 'TP_Q', sym: 'TP_Q', text: 'Prüfpunkt Quarz für den Frequenzzähler' }
  ];

  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x3c6ef372);
    const fQ = level === 1 ? 32768 : 4194304;
    const ppm = pick(r, [10, 20, -15, 30]);                                      // (A) Abweichung des mitgelieferten Quarzes
    const uSec = pick(r, [9, 12]);
    const weckMin = level === 1 ? pick(r, [15, 30, 60, 90]) : level === 2 ? 10 + 5 * Math.floor(r() * 22) : 10 + Math.floor(r() * 110);
    const resHz = level === 1 ? 0.01 : 0.1;
    const p = {
      fQ: fQ, ppm: ppm, uSec: uSec, iUhr: 120, tAmb: 40, weckSek: weckMin * 60, weckH: Math.floor(weckMin / 60), weckM: weckMin % 60,
      boardW: 100, boardH: 60, layers: 2, gangZiel: 0.5, fTest: 1000, vLogic: 5, resHz: resHz, tPiezo: 60,
      fIst: rd(fQ * (1 + ppm * 1e-6), 3), gangTag: rd(ppm * 0.0864, 4), hidden: ['ppm', 'fIst', 'gangTag']
    };
    const hh = String(p.weckH).padStart(2, '0') + ':' + String(p.weckM).padStart(2, '0');
    const text = [
      'Projekt Digitale Uhr mit Wecker, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Quarz: Nennfrequenz ' + fQ + ' Hz (' + (fQ === 32768 ? '2^15, Uhrenquarz' : '2^22') + '). Der mitgelieferte Quarz weicht etwas vom Nennwert ab (A). Am Prüfpunkt TP_Q liest ein Frequenzzähler die tatsächliche Frequenz mit ' + fm(resHz, 2) + ' Hz Auflösung.',
      'Netzteil: Trafo ' + uSec + ' V~ (50 Hz), Brückengleichrichter, Siebelko und Festregler 7805. Stromaufnahme der Uhr ' + p.iUhr + ' mA (A), Umgebung ' + p.tAmb + ' °C (A).',
      'Zählerstufe: Sekunden zweistellig von 00 bis 59 mit zwei 7-Segment-Anzeigen. Für die Simulation gilt ein Testtakt von ' + p.fTest + ' Hz.',
      'Software: Arduino mit I²C-LCD (16 x 2, 0x27), Piezo an D8, Weckerstopp-Taster nach Masse an D2. Die Uhr startet beim Einschalten bei 00:00:00 und zeigt hh:mm:ss. Weckzeit ' + hh + ' Uhr: Der Ton setzt höchstens 1 s nach der Weckzeit ein und endet nach ' + p.tPiezo + ' s oder mit dem Taster.',
      'Gang: Nach der Korrektur darf die Uhr höchstens ' + fm(p.gangZiel, 1) + ' s pro Tag falsch gehen.',
      'Platine: höchstens ' + p.boardW + ' x ' + p.boardH + ' mm, ' + p.layers + ' Lagen, Netzteil, Teiler und Zähler auf einer Platine.'
    ];
    return { params: p, text: text, io: IO.map(clone) };
  }

  /* ====================================================================== Datenblatt- und Netzteil-Hilfen */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {                // Zahl in SI (V, A, W) aus Zeile
    if (!row || !fin(row[field == null ? 'max' : field])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[field == null ? 'max' : field], row.unit) : row[field == null ? 'max' : field];
    return fin(x) ? x : NaN;
  }
  const refOf = ds => (ds ? String(ds.ref || ds.part || ds.id) : '');
  function psuPick(pk) {
    const o = { ok: false, di: null, rg: null, vals: {}, calc: {}, cUF: NaN, uC: NaN, why: '' };
    if (!isObj(pk)) { o.why = 'Auswahl fehlt'; return o; }
    const items = arr(pk.items), it = r => items.find(x => isObj(x) && x.role === r);
    const d = it('diode'), g = it('regler');
    o.di = d ? dsOf(d.ds) : null; o.rg = g ? dsOf(g.ds) : null;
    o.vals = isObj(pk.vals) ? pk.vals : {}; o.calc = isObj(pk.calc) ? pk.calc : {};
    o.cUF = numOf(o.vals.cSieb); o.uC = numOf(o.vals.uElko);
    o.ok = !!(o.di && o.rg && fin(o.cUF) && o.cUF > 0);
    if (!o.di) o.why = 'Gleichrichterdiode nicht gewählt'; else if (!o.rg) o.why = 'Regler nicht gewählt'; else if (!fin(o.cUF) || o.cUF <= 0) o.why = 'Siebelko fehlt';
    return o;
  }
  /* Netzteilrechnung (sicher: Û = √2·U, Brücke 2 · 0,7 V, ΔU = I · 10 ms / C bei 100 Hz Brummen, Pv = (Um - 5 V) · I) */
  function psuCalc(P, pi) {
    const I = P.iUhr / 1000, uhat = Math.SQRT2 * P.uSec, umax = uhat - 1.4, C = pi.cUF * 1e-6;
    const vdo = pi.rg ? dsVal(dsRow(pi.rg, 'vdo'), 'max') : NaN, iq = pi.rg ? dsVal(dsRow(pi.rg, 'iq'), 'typ') : NaN;
    const need = 5 + vdo, dU = I * 0.010 / C, uInMin = umax - dU, umean = umax - dU / 2;
    const p = (umean - 5) * I, ptot = p + (fin(iq) ? umean * iq : 0);
    const th = pi.rg && isObj(pi.rg.thermal) ? pi.rg.thermal : {};
    const rth = fin(th.rthJA) ? th.rthJA : NaN, tj = fin(rth) ? P.tAmb + ptot * rth : NaN;
    const rr = pi.rg ? dsRow(pi.rg, 'rr') : null, rrDb = rr && fin(rr.min) ? rr.min : NaN;
    return { I: I, uhat: uhat, umax: umax, vdo: vdo, need: need, dUmax: umax - need, cMinUF: I * 0.010 / (umax - need) * 1e6, dU: dU, uInMin: uInMin, umean: umean, p: p, ptot: ptot,
      tj: tj, rth: rth, rrDb: rrDb, rippleMv: fin(rrDb) ? dU * Math.pow(10, -rrDb / 20) * 1000 : NaN };
  }
  const regBand = rg => { const r = rg && (dsRow(rg, 'vo_full') || dsRow(rg, 'vo')); return r && fin(r.min) && fin(r.max) ? { min: r.min, max: r.max, typ: fin(r.typ) ? r.typ : (r.min + r.max) / 2 } : null; };
  const isFixed5 = rg => { const r = rg && dsRow(rg, 'vo'); return !!(r && fin(r.typ) && Math.abs(r.typ - 5) < 0.11 && fin(r.min) && r.min > 4.5 && r.max < 5.5); };

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
  function safe(fn, label) {
    return function (data, ctx) {
      try { return { lines: fn(data, ctx || {}) }; }
      catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich (' + (e && e.message ? e.message : e) + ')', 100)] }; }
    };
  }
  /* Netzliste lesen: { ok, nl, ix } (ix: net = Map Pin->Netz, byName, part) */
  function prep(nlIn) {
    const N = NL();
    if (!N || !isObj(nlIn) || !Array.isArray(nlIn.parts)) return { ok: false, nl: null, ix: null, errs: ['keine Netzliste'] };
    let r; try { r = N.normalize(nlIn, { lenient: true, warnSingle: false }); } catch (e) { return { ok: false, nl: null, ix: null, errs: [String(e && e.message)] }; }
    if (!r.ok || !r.nl) return { ok: false, nl: null, ix: null, errs: r.errs || ['ungültig'] };
    return { ok: r.nl.parts.length > 0, nl: r.nl, ix: N.index(r.nl), errs: [] };
  }
  const pnet = (p, addr) => (p && p.ix ? p.ix.net.get(addr) : undefined);
  const partsOf = (p, ...kinds) => (p && p.nl ? p.nl.parts.filter(x => kinds.indexOf(x.kind) >= 0) : []);
  const icType = part => { const m = /(?:^|\D)(4\d{3})(?!\d)/.exec(String(part && part.value)); return m ? m[1] : ''; };
  const icsOf = (p, type) => partsOf(p, 'ICX').filter(x => icType(x).indexOf(type) >= 0);
  /* Versorgungsnetze: Plus = Pluspol einer Batterie oder Netz VCC/VDD, Masse = Minuspol oder GND */
  function railNets(p) {
    const hi = new Set(), lo = new Set();
    if (!p || !p.ok) return { hi: hi, lo: lo };
    p.nl.nets.forEach(n => { if (/^(VCC|VDD|\+5V|V\+)$/i.test(n.name)) hi.add(n.name); if (/^(GND|VSS|0V|MASSE)$/i.test(n.name)) lo.add(n.name); });
    partsOf(p, 'BAT').forEach(b => { if (numOf(b.value) > 0) { const a = pnet(p, b.ref + '.+'), k = pnet(p, b.ref + '.-'); if (a) hi.add(a); if (k) lo.add(k); } });
    return { hi: hi, lo: lo };
  }
  const icNp = part => { const n = NL(); try { return n.pinCount('ICX', part); } catch (e) { return 16; } };
  function icSupplyErrs(p, kinds) {            // ICs, bei denen VDD (letzter Pin) nicht an Plus oder VSS (Pin n/2) nicht an Masse liegt
    const rails = railNets(p), bad = [];
    partsOf(p, 'ICX').forEach(ic => {
      if (kinds && !kinds.some(k => icType(ic).indexOf(k) >= 0)) return;
      const np = icNp(ic), vdd = pnet(p, ic.ref + '.' + np), vss = pnet(p, ic.ref + '.' + (np / 2));
      if (!vdd || !rails.hi.has(vdd)) bad.push(ic.ref + ' VDD (Pin ' + np + ')');
      if (!vss || !rails.lo.has(vss)) bad.push(ic.ref + ' VSS (Pin ' + (np / 2) + ')');
    });
    return bad;
  }

  /* ====================================================================== vu1: Netzteil auslegen (Datenblatt-Lab) */
  function psuSolution(ctx) {
    const P = P_(ctx), regs = dsOf('tf-7805');
    const pi0 = { rg: regs, cUF: 1 }, c0 = psuCalc(P, pi0);
    const cUF = e6Up(Math.max(c0.cMinUF * 1.15, 1)), uC = voltUp(1.3 * c0.uhat);
    const pi = { rg: regs, cUF: cUF }, c = psuCalc(P, pi);
    return { items: [{ role: 'diode', ds: 'tf-1n4007', part: 'TF-1N4007', ref: '1N4007' }, { role: 'regler', ds: 'tf-7805', part: 'TF-7805', ref: '7805' }],
      calc: { dUV: rd(c.dU, 3), uInMinV: rd(c.uInMin, 3), pVW: rd(c.p, 3), tjC: rd(c.tj, 1) },
      vals: { cSieb: cUF, uElko: uC, begruendung: 'Die 1N4007 sperrt 1000 V und trägt 1 A, die 1N4148 wäre mit 100 V zu knapp und die Z-Diode ist keine Gleichrichterdiode. Den 7805 nehme ich, weil er fest 5 V liefert, der LM317 braucht dazu noch Widerstände. Der Elko hält die Welligkeit so klein, dass der Regler auch im Tal noch seine Dropout-Spannung bekommt.' } };
  }
  function checkDs(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], pi = psuPick(data);
    const c = pi.ok ? psuCalc(P, pi) : null, I = P.iUhr / 1000;
    // 1: Brückendioden
    const vrrm = pi.di ? dsVal(dsRow(pi.di, 'vrrm'), 'max') : NaN, ifm = pi.di ? (dsVal(dsRow(pi.di, 'ifav'), 'max') || dsVal(dsRow(pi.di, 'if'), 'max')) : NaN;
    const vNeed = 1.5 * Math.SQRT2 * P.uSec;
    lines.push(L(pi.di && fin(vrrm) && fin(ifm) && vrrm >= vNeed && ifm >= I, 'Brückendioden: V_RRM ' + fm(vrrm, 0) + ' V (nötig mindestens 1,5 · √2 · ' + P.uSec + ' V = ' + fm(vNeed, 1) + ' V), I_F ' + fm(ifm * 1000, 0) + ' mA (nötig mindestens ' + P.iUhr + ' mA)' + (pi.di && !fin(vrrm) ? ' – das ist keine Gleichrichterdiode mit V_RRM' : !pi.di ? ' – keine Diode gewählt' : ''), 20));
    // 2: Siebelko
    let okC = false, txtC = pi.ok ? '' : ' – ' + pi.why;
    if (pi.ok && c) {
      const e6 = isE(pi.cUF, 'E6'), calcOk = (!fin(+pi.calc.dUV) || sameVal(+pi.calc.dUV, c.dU, 0.05 * Math.max(1, tol))) && (!fin(+pi.calc.uInMinV) || Math.abs(+pi.calc.uInMinV - c.uInMin) <= 0.05 * Math.max(1, tol) * Math.abs(c.uInMin) + 0.05);
      okC = e6 && fin(c.vdo) && c.uInMin >= c.need - 1e-9 && calcOk;
      txtC = ': ' + fm(pi.cUF, 0) + ' µF' + (e6 ? '' : ' (kein E6-Wert)') + ', Welligkeit ΔU = I · 10 ms / C = ' + fm(c.dU, 2) + ' V, kleinste Eingangsspannung ' + fm(c.uInMin, 2) + ' V, nötig mindestens 5 V + ' + fm(c.vdo, 1) + ' V Dropout = ' + fm(c.need, 1) + ' V' + (calcOk ? '' : ' – deine Rechenwerte (ΔU, U_in,min) stimmen nicht mit der Rechnung überein');
    }
    lines.push(L(okC, 'Siebelko' + txtC, 30));
    // 3: Regler
    let okR = false, txtR = '';
    if (pi.rg && c) {
      const fixed = isFixed5(pi.rg), der = DS().derate(pi.rg, { tAmb: P.tAmb, ptot: c.ptot });
      const calcOk = (!fin(+pi.calc.pVW) || sameVal(+pi.calc.pVW, c.p, 0.1 * Math.max(1, tol))) && (!fin(+pi.calc.tjC) || Math.abs(+pi.calc.tjC - c.tj) <= 0.08 * Math.max(1, tol) * c.tj);
      okR = fixed && !!(der && der.ok) && calcOk;
      txtR = fixed ? ': Verlust P = (U_mittel − 5 V) · I = ' + fm(c.p, 2) + ' W (U_mittel ' + fm(c.umean, 1) + ' V), Sperrschichttemperatur ' + fm(c.tj, 0) + ' °C bei ' + P.tAmb + ' °C Umgebung und R_thJA ' + fm(c.rth, 0) + ' K/W, erlaubt ' + (der && fin(der.tjMax) ? fm(der.tjMax, 0) : '?') + ' °C' + (calcOk ? '' : ' – deine Rechenwerte (P_V, T_j) stimmen nicht') : ': ' + refOf(pi.rg) + ' ist kein 5-V-Festspannungsregler';
    } else txtR = pi.rg ? ' – Siebelko fehlt' : ' – kein Regler gewählt';
    lines.push(L(okR, 'Regler 5 V' + txtR, 25));
    // 4: Spannungsfestigkeit
    const uNeed = c ? 1.3 * c.uhat : NaN;
    lines.push(L(pi.ok && fin(pi.uC) && pi.uC >= uNeed - 1e-9 && VOLTS.indexOf(pi.uC) >= 0, 'Elko-Spannungsfestigkeit ' + (fin(pi.uC) ? fm(pi.uC, 1) + ' V' : 'fehlt') + ' (nötig mindestens 1,3 · Û = ' + fm(uNeed, 1) + ' V, Normwert 6,3 / 10 / 16 / 25 / 35 / 50 / 63 V)', 10));
    // 5: Begründung
    const bg = String(pi.vals.begruendung == null ? '' : pi.vals.begruendung), words = (bg.match(/[A-Za-zÄÖÜäöüß0-9]+/g) || []).length;
    lines.push(L(words >= 15 && /(weil|da |denn|statt|deshalb|daher|zu knapp|reicht nicht|nicht geeignet|zu klein|braucht)/i.test(bg), 'Begründung der Auswahl: ' + words + ' Wörter (mindestens 15) mit Grund für die Wahl gegenüber den Alternativen', 15));
    return lines;
  }

  /* ====================================================================== vu2: Sekundentakt (DigiLab) */
  /* Teiler: 4060 mit Quarz (Q14 = geteilt durch 2^14), dann bei 32768 Hz ein halbes 4013 (÷2), sonst ein zweiter 4060 (Q8 = ÷2^8) */
  function addTeiler(b, P) {
    b.add('U5', 'ICX', '4060').add('Q1', 'XTAL', String(P.fQ)).add('R15', 'R', '1M').add('C1', 'C', '22p').add('C2', 'C', '22p');
    b.net('VCC', 'U5.16').gnd('U5.8', 'U5.12');
    b.net('XI', 'U5.11', 'Q1.1', 'R15.1', 'C1.1').net('XO', 'U5.10', 'Q1.2', 'R15.2', 'C2.1').gnd('C1.2', 'C2.2');
    if (P.fQ === 32768) {
      b.add('U6', 'ICX', '4013'); b.net('VCC', 'U6.14').gnd('U6.7', 'U6.4', 'U6.6', 'U6.8', 'U6.9', 'U6.10', 'U6.11');
      b.net('Q14', 'U5.3', 'U6.3').net('QN1', 'U6.2', 'U6.5').net('CLK1HZ', 'U6.1');
    } else {
      b.add('U6', 'ICX', '4060'); b.net('VCC', 'U6.16').gnd('U6.8', 'U6.12');
      b.net('Q14', 'U5.3', 'U6.11').net('CLK1HZ', 'U6.14');
    }
    return b;
  }
  function buildDigi(P) {
    const N = NL(), b = N.builder('Sekundentakt');
    b.add('V1', 'BAT', '5'); b.net('VCC', 'V1.+').gnd('V1.-');
    addTeiler(b, P);
    const nl = b.build(); if (!nl) throw new Error('Teiler: ' + b.errors.join(' | '));
    return { netlist: nl, inputs: [], outputs: [{ name: 'CLK1HZ', ref: P.fQ === 32768 ? 'U6.1' : 'U6.14' }], vdd: { min: 3, max: 15 } };
  }
  const dividerCache = new Map();
  function dividerOf(nl, outRef) {
    const key = hash(JSON.stringify([nl, outRef]));
    if (dividerCache.has(key)) return dividerCache.get(key);
    let r; try { r = NL().dividerRatio(nl, { out: outRef }); } catch (e) { r = { ok: false, msg: String(e && e.message), resets: [], stages: [] }; }
    if (dividerCache.size > 300) dividerCache.clear();
    dividerCache.set(key, r); return r;
  }
  const BUDGET = { 1: 3, 2: 2, 3: 2 };      // höchstens so viele ICs im Teiler
  function checkDigi(data, ctx) {
    const P = P_(ctx), lines = [], lv = LEVEL(ctx), d = isObj(data) ? data : {};
    const p = prep(d.netlist), od = arr(d.outputs).find(o => isObj(o) && lc(o.name) === 'clk1hz');
    const out = od && p.ok ? String(od.ref) : null;
    const ds = need(ctx, 'uhr.ds'), pi = psuPick(ds), band = regBand(pi.rg);
    const dv = p.ok && out ? dividerOf(p.nl, out) : null;
    // 1: Teilungsverhältnis
    let ok1 = false, t1;
    if (!p.ok) t1 = 'keine Schaltung'; else if (!od) t1 = 'Ausgang CLK1HZ fehlt'; else if (!dv || !dv.ok) t1 = 'nicht auswertbar: ' + (dv && dv.msg ? dv.msg : 'Teilerkette nicht erkennbar');
    else {
      const fOk = dv.source === 'xtal' && fin(dv.fIn) && Math.abs(dv.fIn - P.fQ) <= 1e-4 * P.fQ;
      ok1 = dv.ratio === P.fQ && fOk;
      t1 = 'Teilung durch ' + dv.ratio + ' (nötig: ' + P.fQ + ' Hz / 1 Hz = ' + P.fQ + ')' + (dv.source !== 'xtal' ? ', der Takt kommt nicht vom Quarz am 4060' : !fOk ? ', Quarz ' + (fin(dv.fIn) ? fm(dv.fIn, 0) : '?') + ' Hz passt nicht zu ' + P.fQ + ' Hz' : fin(dv.fOut) ? ', Ausgang ' + fm(dv.fOut, 3) + ' Hz' : '');
    }
    lines.push(L(ok1, 'Teilungsverhältnis: ' + t1, 40));
    // 2: Versorgungsbereich
    const vd = d.vdd, vOk = isObj(vd) && fin(vd.min) && fin(vd.max) && vd.min >= 3 - 1e-9 && vd.max <= 15 + 1e-9 && vd.min <= vd.max;
    const cover = !!band && vOk && vd.min <= band.min + 1e-9 && vd.max >= band.max - 1e-9;
    lines.push(L(vOk && cover, 'Versorgungsbereich ' + (isObj(vd) && fin(vd.min) ? fm(vd.min, 1) + ' bis ' + fm(vd.max, 1) + ' V' : 'fehlt') + ': CMOS-Reihe 3 bis 15 V (A) und der Regler liefert ' + (band ? fm(band.min, 2) + ' bis ' + fm(band.max, 2) + ' V' : '? (Datenblatt-Station fehlt)'), 15));
    // 3: Eingänge, Reset
    let ok3 = false, t3 = '';
    if (p.ok) {
      const bad = icSupplyErrs(p), rs = dv && dv.ok ? dv.resets.filter(r => r.state !== 'low' && r.state !== 'driven') : [];
      const noIc = partsOf(p, 'ICX').length === 0;
      ok3 = !noIc && bad.length === 0 && rs.length === 0 && !!dv && dv.ok;
      t3 = noIc ? 'kein Teiler-IC' : bad.length ? 'Versorgung fehlt: ' + bad[0] : !dv || !dv.ok ? 'Teilerkette nicht auswertbar' : rs.length ? 'Reset ' + rs[0].ref + ' (' + rs[0].pin + ') ist ' + (rs[0].state === 'high' ? 'auf High, der Zähler bleibt gelöscht' : 'offen') : (dv.resets.length + ' Reset-Eingänge liegen auf Low') + ', Versorgung an allen ICs';
    } else t3 = 'keine Schaltung';
    lines.push(L(ok3, 'Eingänge beschaltet, Reset definiert: ' + t3, 20));
    // 4: Ausgang benannt
    const outNet = p.ok && out ? pnet(p, out) : undefined;
    lines.push(L(!!od && outNet !== undefined && !!dv && dv.ok, 'Ausgang CLK1HZ benannt und angeschlossen' + (od ? (outNet === undefined ? ' – die Anschlussadresse ' + od.ref + ' hat kein Netz' : '') : ' – kein Ausgang mit dem Namen CLK1HZ'), 15));
    // 5: Budget
    const nIc = p.ok ? partsOf(p, 'ICX').length : 0;
    lines.push(L(p.ok && nIc >= 1 && nIc <= BUDGET[lv] && p.nl.parts.length <= 12, 'Bauteilbudget: ' + nIc + ' ICs (höchstens ' + BUDGET[lv] + '), ' + (p.ok ? p.nl.parts.length : 0) + ' Bauteile insgesamt (höchstens 12, mit LED und Vorwiderstand am Ausgang)', 10));
    return lines;
  }

  /* ====================================================================== vu3: Sekundenzähler mit Anzeige (SchaltLab) */
  /* Aufbau (Musterlösung): U1 = 4518 (Einer = Dekade A, Zehner = Dekade B), U2 = 4081 (UND erkennt 60), U3 / U4 = 4543, DS1 / DS2 = 7-Segment, 14 Vorwiderstände */
  function counterBuilder(P) {
    const N = NL(), b = N.builder('Sekundenzähler 00 bis 59');
    b.add('V1', 'BAT', '5').add('F1', 'CLK', '1Hz').add('U1', 'ICX', '4518').add('U2', 'ICX', '4081').add('U3', 'ICX', '4543').add('U4', 'ICX', '4543').add('DS1', 'SEG8', 'rot').add('DS2', 'SEG8', 'rot');
    b.net('VCC', 'V1.+', 'U1.2', 'U1.16', 'U2.14', 'U3.16', 'U4.16', 'U3.1', 'U4.1');
    b.gnd('V1.-', 'F1.-', 'U1.8', 'U1.9', 'U2.7', 'U3.8', 'U3.6', 'U3.7', 'U4.8', 'U4.6', 'U4.7', 'DS1.K', 'DS2.K', 'U2.5', 'U2.6', 'U2.8', 'U2.9', 'U2.12', 'U2.13');
    b.net('CLK1HZ', 'F1.+', 'U1.1');
    b.net('Q0A', 'U1.3', 'U3.5').net('Q1A', 'U1.4', 'U3.3').net('Q2A', 'U1.5', 'U3.2').net('Q3A', 'U1.6', 'U1.10', 'U3.4');
    b.net('Q0B', 'U1.11', 'U4.5').net('Q1B', 'U1.12', 'U4.3', 'U2.1').net('Q2B', 'U1.13', 'U4.2', 'U2.2').net('Q3B', 'U1.14', 'U4.4');
    b.net('RST', 'U2.3', 'U1.7', 'U1.15');
    const dpin = { a: 9, b: 10, c: 11, d: 12, e: 13, f: 15, g: 14 };
    let ri = 1;
    [['U3', 'DS2'], ['U4', 'DS1']].forEach(pair => ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(s => {
      const r = 'R' + (ri++); b.add(r, 'R', '1k'); b.net(pair[0] + '_' + s, pair[0] + '.' + dpin[s], r + '.1'); b.net(pair[1] + '_' + s, r + '.2', pair[1] + '.' + s);
    }));
    return b;
  }
  const DEC = [{ cp0: '1', cp1: '2', q: ['3', '4', '5', '6'], mr: '7' }, { cp0: '9', cp1: '10', q: ['11', '12', '13', '14'], mr: '15' }];
  const DPIN = { D0: '5', D1: '3', D2: '2', D3: '4' }, SEGPIN = { a: '9', b: '10', c: '11', d: '12', e: '13', f: '15', g: '14' };
  function clockNet(p) {
    const c = partsOf(p, 'CLK')[0];
    if (c) { const n = pnet(p, c.ref + '.+'); if (n) return n; }
    const n = p.nl.nets.find(x => /^CLK/i.test(x.name)); return n ? n.name : null;
  }
  /* Struktur des Zählers aus der Netzliste lesen (nur Topologie, nie Netznamen außer dem Takt) */
  function counterStruct(p, hint) {
    const o = { ok: false, errs: [], decs: [], ones: null, tens: null, clk: null, clkSynth: false, clkPin: null, rails: railNets(p), dec: [], disp: [], seg: [] };
    const hi = o.rails.hi, lo = o.rails.lo;
    icsOf(p, '4518').forEach(ic => DEC.forEach((d, i) => o.decs.push({ ic: ic.ref, id: ic.ref + (i ? 'B' : 'A'), cp0: pnet(p, ic.ref + '.' + d.cp0), cp1: pnet(p, ic.ref + '.' + d.cp1), cp0Pin: ic.ref + '.' + d.cp0, cp1Pin: ic.ref + '.' + d.cp1, q: d.q.map(pn => pnet(p, ic.ref + '.' + pn)), mr: pnet(p, ic.ref + '.' + d.mr) })));
    o.clk = clockNet(p);
    if (!o.clk && hint) { o.clk = pnet(p, hint) || 'CLK_IN'; o.clkSynth = !pnet(p, hint); }       // Lochraster: der Takteingang ist ein freier Pin ohne Netz
    const onClk = (net, pin) => (o.clkSynth ? pin === hint : net === o.clk);
    if (o.clk) o.ones = o.decs.find(d => onClk(d.cp0, d.cp0Pin) && hi.has(d.cp1)) || o.decs.find(d => onClk(d.cp1, d.cp1Pin) && lo.has(d.cp0)) || null;
    if (o.ones) o.clkPin = onClk(o.ones.cp0, o.ones.cp0Pin) ? o.ones.cp0Pin : o.ones.cp1Pin;
    if (!o.clk) o.errs.push('kein Takt (Bauteil CLK oder Netz CLK1HZ)'); else if (!o.ones) o.errs.push('der Takt liegt an keinem Zähler (CP0 mit CP1 auf High)');
    if (o.ones) {
      const q3 = o.ones.q[3];
      o.tens = q3 ? (o.decs.find(d => d !== o.ones && d.cp1 === q3 && lo.has(d.cp0)) || null) : null;
      if (!o.tens) o.errs.push('der Übertrag (Q3 der Einer) liegt nicht am CP1 der Zehner (CP0 auf Low)');
    }
    // Dekoder: D0..D3 an Q0..Q3
    const decOf = dc => (dc ? icsOf(p, '4543').find(ic => ['D0', 'D1', 'D2', 'D3'].every((k, i) => { const n = pnet(p, ic.ref + '.' + DPIN[k]); return !!n && n === dc.q[i]; })) || null : null);
    o.dec = [decOf(o.ones), decOf(o.tens)];
    if (o.ones && !o.dec[0]) o.errs.push('kein 4543 an den BCD-Ausgängen der Einer'); if (o.tens && !o.dec[1]) o.errs.push('kein 4543 an den BCD-Ausgängen der Zehner');
    // Segmente: Dekoderausgang (direkt oder über einen Widerstand) an gleichnamigen Segmentpin eines Anzeigebauteils
    const rs = partsOf(p, 'R'), disps = partsOf(p, 'SEG8');
    o.disp = [null, null]; o.seg = [[], []];
    [0, 1].forEach(k => {
      const dcr = o.dec[k]; if (!dcr) return;
      let best = null;
      disps.forEach(ds => {
        const hits = [];
        Object.keys(SEGPIN).forEach(s => {
          const n1 = pnet(p, dcr.ref + '.' + SEGPIN[s]); if (!n1) return;
          if (pnet(p, ds.ref + '.' + s) === n1) { hits.push({ s: s, r: null }); return; }
          const rr = rs.find(r => { const a = pnet(p, r.ref + '.1'), b = pnet(p, r.ref + '.2'); return (a === n1 && b === pnet(p, ds.ref + '.' + s)) || (b === n1 && a === pnet(p, ds.ref + '.' + s)); });
          if (rr && pnet(p, ds.ref + '.' + s)) hits.push({ s: s, r: rr });
        });
        if (!best || hits.length > best.hits.length) best = { ds: ds, hits: hits };
      });
      if (best && best.hits.length) { o.disp[k] = best.ds.ref; o.seg[k] = best.hits; }
    });
    const segOk = [0, 1].every(k => o.seg[k].length === 7) && o.disp[0] && o.disp[1] && o.disp[0] !== o.disp[1];
    o.segOk = !!segOk;
    if (o.dec[0] && o.dec[1] && !segOk) o.errs.push('nicht alle 7 Segmente der beiden Dekoder erreichen ihre eigene Anzeige (a bis g)');
    o.ok = o.errs.length === 0;
    return o;
  }
  const simCache = new Map();
  function counterSim(p, hint) {
    const key = hash(JSON.stringify([p.nl, hint || null]));
    if (simCache.has(key)) return simCache.get(key);
    const res = { ok: false, msg: '', seq: [] };
    try {
      const st = counterStruct(p, hint);
      if (!st.ones || !st.tens) { res.msg = st.errs[0] || 'Zähler nicht erkannt'; }
      else {
        const nl2 = clone(p.nl); const clkRefs = nl2.parts.filter(x => x.kind === 'CLK').map(x => x.ref);
        nl2.parts = nl2.parts.filter(x => clkRefs.indexOf(x.ref) < 0); nl2.nets.forEach(n => { n.pins = n.pins.filter(a => clkRefs.indexOf(a.slice(0, a.indexOf('.'))) < 0); });
        nl2.nets = nl2.nets.filter(n => n.pins.length);
        if (st.clkSynth) { nl2.nets.push({ name: st.clk, cls: 'signal', pins: [hint] }); nl2.parts.forEach(x => { if (x.ref === hint.slice(0, hint.indexOf('.'))) x.pins[hint.slice(hint.indexOf('.') + 1)] = st.clk; }); }
        const bat = partsOf(p, 'BAT')[0], vdd = bat && numOf(bat.value) > 0 ? numOf(bat.value) : 5;
        const gnd = [...st.rails.lo][0] || 'GND', drive = { }; drive[st.clk] = { f: 1000, hi: vdd };
        if (!bat) { const vn = pnet(p, icsOf(p, '4518')[0].ref + '.16'); if (vn) drive[vn] = vdd; }
        const probe = [...new Set(st.ones.q.concat(st.tens.q, [st.clk]).filter(Boolean))];
        const sim = NL().simulate(nl2, { drive: drive, T: 0.065, dt: 2e-5, sample: 5e-4, probe: probe, ground: gnd });
        if (!sim.ok) res.msg = 'Simulation nicht möglich: ' + (sim.err || 'Fehler');
        else {
          const s = sim.series, th = x => (x > vdd / 2 ? 1 : 0), val = (nets, i) => nets.reduce((a, n, k) => a + (n && s[n] ? th(s[n][i]) << k : 0), 0);
          let prev = -1;
          s.t.forEach((tt, i) => { if (th(s[st.clk][i])) return; const v = val(st.tens.q, i) * 10 + val(st.ones.q, i); if (v !== prev) { res.seq.push(v); prev = v; } });
          res.ok = true; res.warnings = sim.warnings.slice(0, 3);
        }
      }
    } catch (e) { res.msg = 'Simulation nicht möglich: ' + (e && e.message ? e.message : e); }
    if (simCache.size > 120) simCache.clear();
    simCache.set(key, res); return res;
  }
  const seqOk = s => { for (let i = 0; i < 60; i++) if (s[i] !== i) return false; return s.length >= 60; };
  const wrapOk = s => s.length >= 63 && s[59] === 59 && s[60] === 0 && s[61] === 1 && s[62] === 2;
  function simLines(p, ptsSeq, ptsWrap, lines) {
    const sm = p.ok ? counterSim(p) : { ok: false, msg: 'keine Schaltung', seq: [] };
    const s = sm.seq, firstBad = s.findIndex((v, i) => i < 60 && v !== i);
    lines.push(L(sm.ok && seqOk(s), 'Zählfolge 00 bis 59 (Simulation mit ' + 1000 + ' Hz Testtakt): ' + (sm.ok ? (seqOk(s) ? '60 Schritte in Folge' : firstBad >= 0 ? 'nach ' + (firstBad ? String(s[firstBad - 1]).padStart(2, '0') : 'Start') + ' kommt ' + String(s[firstBad]).padStart(2, '0') : 'zu wenige Schritte (' + s.length + ')') : sm.msg), ptsSeq));
    lines.push(L(sm.ok && wrapOk(s), 'Überlauf bei 60: ' + (sm.ok ? (wrapOk(s) ? 'nach 59 folgt 00, 01, 02' : 'nach 59 folgt ' + (s.length > 60 ? String(s[60]).padStart(2, '0') : 'nichts')) : sm.msg), ptsWrap));
  }
  const SEG_VF = () => { const l = dsOf('tf-led-r'), v = l ? dsVal(dsRow(l, 'vf10'), 'typ') : NaN; return fin(v) ? v : 2; };
  function checkSch(data, ctx) {
    const P = P_(ctx), lines = [], d = isObj(data) ? data : {};
    const p = prep(d.netlist);
    const st = p.ok ? counterStruct(p) : null;
    // 1: Bauteile
    const nDec = p.ok ? icsOf(p, '4518').length * 2 : 0, n43 = p.ok ? icsOf(p, '4543').length : 0, nSeg = p.ok ? partsOf(p, 'SEG8').length : 0, nAnd = p.ok ? partsOf(p, 'AND').length + icsOf(p, '4081').length + icsOf(p, '4082').length : 0;
    lines.push(L(nDec >= 2 && n43 >= 2 && nSeg >= 2 && nAnd >= 1, 'Bauteile: ' + nDec + ' BCD-Dekaden (4518, verlangt 2), ' + n43 + ' Dekoder 4543 (verlangt 2), ' + nSeg + ' 7-Segment-Anzeigen (verlangt 2), ' + nAnd + ' UND zum Rücksetzen (verlangt 1)', 20));
    // 2: Topologie
    let okT = false, tT = 'keine Schaltung';
    if (st) {
      const dg = need(ctx, 'uhr.digi'), dp = dg && prep(dg.netlist), od = dg && arr(dg.outputs).find(o => isObj(o) && lc(o.name) === 'clk1hz'), dv = dp && dp.ok && od ? dividerOf(dp.nl, String(od.ref)) : null;
      const fOut = dv && dv.ok && fin(dv.fOut) ? dv.fOut : 1, clkPart = partsOf(p, 'CLK')[0], fClk = clkPart ? numOf(clkPart.value) : NaN;
      const srcOk = !clkPart || (fin(fClk) && Math.abs(fClk - fOut) <= 0.01 * fOut);
      okT = st.ok && srcOk;
      tT = st.ok ? (srcOk ? 'Takt ' + fm(fOut, 0) + ' Hz in die Einer, Übertrag in die Zehner, BCD über 4543 an beide Anzeigen' : 'die Taktquelle ' + (fin(fClk) ? fm(fClk, 3) + ' Hz' : '?') + ' passt nicht zum Ausgang CLK1HZ des Teilers (' + fm(fOut, 3) + ' Hz)') : st.errs[0];
    }
    lines.push(L(okT, 'Topologie: ' + tT, 25));
    // 3, 4: Simulation
    simLines(p, 20, 10, lines);
    // 5: Segmentwiderstände
    const vf = SEG_VF(), vdd = 5;
    let rOk = false, rTxt = 'keine Anzeige erkannt';
    if (st && st.segOk) {
      const rv = [].concat(st.seg[0], st.seg[1]).map(h => (h.r ? numOf(h.r.value) : NaN)), iSeg = rv.map(r => (vdd - vf) / r * 1000);
      rOk = iSeg.every(i => fin(i) && i >= 1 - 1e-9 && i <= 5 + 1e-9);
      const bad = iSeg.find(i => !(fin(i) && i >= 1 - 1e-9 && i <= 5 + 1e-9));
      rTxt = '14 Segmentwiderstände, Segmentstrom ' + fm(Math.min.apply(null, iSeg.filter(fin)), 1) + ' bis ' + fm(Math.max.apply(null, iSeg.filter(fin)), 1) + ' mA (verlangt 1 bis 5 mA bei ' + fm(vf, 2) + ' V LED-Spannung (A))' + (rOk ? '' : bad === undefined ? '' : ' – ' + (fin(bad) ? fm(bad, 1) + ' mA ist außerhalb' : 'ein Segment hat keinen Widerstand'));
    } else if (st) rTxt = 'Segmente nicht zugeordnet';
    lines.push(L(rOk, 'Segmentwiderstände: ' + rTxt, 10));
    // 6: Versorgung
    let vOk = false, vTxt = 'keine Schaltung';
    if (st) {
      const bad = icSupplyErrs(p), rails = st.rails, ctl = [];
      icsOf(p, '4543').forEach(ic => { if (!rails.hi.has(pnet(p, ic.ref + '.1'))) ctl.push(ic.ref + ' LD (Pin 1) muss an Plus'); if (!rails.lo.has(pnet(p, ic.ref + '.7'))) ctl.push(ic.ref + ' BI (Pin 7) muss an Masse'); if (!rails.lo.has(pnet(p, ic.ref + '.6'))) ctl.push(ic.ref + ' PH (Pin 6) muss an Masse'); });
      const mrOpen = st.decs.filter(x => !x.mr || !(rails.lo.has(x.mr) || p.nl.nets.find(n => n.name === x.mr).pins.length >= 2));
      vOk = nDec >= 2 && bad.length === 0 && ctl.length === 0 && mrOpen.length === 0;
      vTxt = bad.length ? 'Versorgung fehlt: ' + bad[0] : ctl.length ? ctl[0] : mrOpen.length ? 'Rücksetzeingang ' + mrOpen[0].id + ' ist offen' : 'VDD und VSS an allen ICs, Dekodersteuerung und Rücksetzeingänge beschaltet';
    }
    lines.push(L(vOk, 'Versorgung: ' + vTxt, 15));
    return lines;
  }
  function schSolution(ctx) {
    const P = P_(ctx), b = counterBuilder(P), nl = b.build(); if (!nl) throw new Error('Zähler: ' + b.errors.join(' | '));
    const vf = SEG_VF();
    return { lab: 'sch', name: 'Sekundenzähler 00 bis 59', netlist: nl, meas: { U_VDD_V: 5, I_Seg_mA: rd((5 - vf) / 1000 * 1000, 3), f_Test_Hz: 1000, Zaehlstand_Max: 59 }, snap: {} };
  }

  /* ====================================================================== vu4: Prototyp auf Lochraster (LochLab, mehrere Platinen) */
  /* Aufteilung der Musterlösung: Platine 1 = Quelle, Takt, Zähler und UND; Platine 2 = Dekoder, Anzeigen, Widerstände */
  const BOARD2 = ['U3', 'U4', 'DS1', 'DS2'].concat(Array.from({ length: 14 }, (_, i) => 'R' + (i + 1)));
  function crossNets(nl, boardOf) {
    const bo = isObj(boardOf) ? boardOf : {}, out = [];
    nl.nets.forEach(n => { const bs = new Set(n.pins.map(a => bo[a.slice(0, a.indexOf('.'))] || 1)); if (bs.size > 1) out.push(n.name); });
    return out;
  }
  function lochSolution(ctx) {
    const sch = need(ctx, 'uhr.sch'), nl = clone(sch.netlist), boardOf = {};
    nl.parts.forEach(pt => { boardOf[pt.ref] = BOARD2.indexOf(pt.ref) >= 0 ? 2 : 1; });
    const cross = crossNets(nl, boardOf);
    return { name: 'Sekundenstufe Lochraster', netlist: nl, boards: 2, bom: nl.parts.map(pt => ({ ref: pt.ref, kind: pt.kind, value: pt.value })), doc: { note: 'Platine 1: Takt, Zähler 4518, UND 4081; Platine 2: Dekoder 4543, Anzeigen, Segmentwiderstände; Flachband mit ' + cross.length + ' Adern' }, wiresRibbon: cross.length, boardOf: boardOf };
  }
  const SRC_KINDS = ['CLK', 'BAT', 'GND'];
  /* Netze zweier Netzlisten vergleichen (nur Topologie): Quellen werden ignoriert, es zählen nur Bauteile, die in a stehen (b darf mehr haben),
     Netze mit weniger als zwei Anschlüssen auf gemeinsamen Bauteilen entfallen (das Lochraster kennt keine Einzelpin-Netze), Werte werden hier nicht verglichen. */
  function cmpNl(a, b) {
    const N = NL(), errs = [], ign = new Set(SRC_KINDS);
    const pa = a.nl.parts.filter(x => !ign.has(x.kind)), partB = new Map(b.nl.parts.map(x => [x.ref, x]));
    pa.forEach(x => { const q = partB.get(x.ref); if (!q) errs.push('Bauteil ' + x.ref + ' (' + x.kind + ') fehlt'); else if (q.kind !== x.kind) errs.push(x.ref + ': Bauteilart ' + x.kind + ' im Schaltplan, aber ' + q.kind + ' im Vergleich'); });
    const common = new Set(pa.filter(x => partB.has(x.ref) && partB.get(x.ref).kind === x.kind).map(x => x.ref));
    const flat = nl => ({ v: 1, name: nl.name, parts: nl.parts.filter(x => common.has(x.ref)).map(x => ({ ref: x.ref, kind: x.kind, value: x.value, pins: {} })),
      nets: nl.nets.map(n => ({ name: n.name, cls: n.cls, pins: n.pins.filter(y => common.has(y.slice(0, y.indexOf('.')))) })).filter(n => n.pins.length >= 2) });
    let eq; try { eq = N.equiv(flat(a.nl), flat(b.nl), { values: false }); } catch (e) { eq = { ok: false, errs: [String(e && e.message)], stats: {} }; }
    return { ok: errs.length === 0 && eq.ok, errs: errs.concat(eq.errs), stats: { common: common.size }, noteCount: 0 };
  }
  /* Platinenzuordnung: boardOf aus den Daten, sonst aus dem Lochraster-Dokument (doc.boards mit Rechtecken, Bauteile mit Beschriftung l und Lage x, y) */
  function boardOfFrom(d) {
    if (isObj(d.boardOf)) return d.boardOf;
    const doc = isObj(d.doc) ? d.doc : null;
    if (!doc || !arr(doc.boards).length || !arr(doc.items).length) return null;
    const bo = {};
    doc.items.forEach(it => {
      if (!isObj(it) || it.t !== 'part' || !it.l) return;
      const ref = String(it.l).trim().replace(/[\s.]+/g, '_'), i = doc.boards.findIndex(b => isObj(b) && it.x >= b.x && it.x < b.x + b.cols && it.y >= b.y && it.y < b.y + b.rows);
      if (i >= 0) bo[ref] = i + 1;
    });
    return Object.keys(bo).length ? bo : null;
  }
  const icNorm = nl => { nl.parts.forEach(x => { if (x.kind === 'ICX' && icType(x)) x.value = icType(x); }); return nl; };
  /* Werte, die elektrisch zählen: R, C, CE, L als Zahl; IC-Typ; alles andere (Farbe der LED, Anzeigentyp) nicht */
  function valueSame(kind, a, b) {
    if (kind === 'ICX') return icType({ value: a }) === icType({ value: b }) && icType({ value: a }) !== '';
    if (['R', 'C', 'CE', 'L'].indexOf(kind) >= 0) { const x = numOf(a), y = numOf(b); return fin(x) && fin(y) ? sameVal(x, y, 1e-6) : String(a) === String(b); }
    return true;
  }
  function checkLoch(data, ctx) {
    const P = P_(ctx), lines = [], d = isObj(data) ? data : {};
    const sch = need(ctx, 'uhr.sch'), ps = prep(sch && sch.netlist), pl = prep(d.netlist);
    if (ps.ok) icNorm(ps.nl); if (pl.ok) icNorm(pl.nl);
    const eq = ps.ok && pl.ok ? cmpNl(ps, pl) : null;
    const shorts = eq ? eq.errs.filter(e => /Kurzschluss/.test(e)) : [];
    lines.push(L(!!eq && eq.ok, 'Netze identisch mit dem Schaltplan: ' + (!ps.ok ? 'Schaltplan fehlt' : !pl.ok ? 'keine Netzliste im Lochraster' : eq.ok ? 'alle ' + eq.stats.common + ' Bauteile und ihre Netze stimmen' : eq.errs[0] + (eq.errs.length > 1 ? ' (+' + (eq.errs.length - 1) + ' weitere)' : '')), 35));
    // 2: Platinen und Flachband
    const boards = isI(d.boards) ? d.boards : NaN, rib = isI(d.wiresRibbon) ? d.wiresRibbon : 0, bo = boardOfFrom(d);
    let ribOk = false, ribTxt = '';
    if (pl.ok && fin(boards)) {
      if (boards <= 1) { ribOk = true; ribTxt = 'eine Platine, kein Flachband nötig'; }
      else if (bo) { const cr = crossNets(pl.nl, bo); ribOk = rib >= cr.length && cr.length > 0; ribTxt = boards + ' Platinen, ' + cr.length + ' Verbindungen zwischen den Platinen, Flachband mit ' + rib + ' Adern' + (rib < cr.length ? ' (es fehlen ' + (cr.length - rib) + ')' : ''); }
      else { ribOk = rib >= 2; ribTxt = boards + ' Platinen, Flachband mit ' + rib + ' Adern (Zuordnung der Bauteile zu den Platinen fehlt, nur die Mindestzahl 2 für Plus und Masse geprüft)'; }
    } else ribTxt = 'Platinenzahl fehlt';
    lines.push(L(pl.ok && fin(boards) && boards >= 1 && boards <= 3 && ribOk, 'Platinenzahl und Flachband: ' + ribTxt + ' (höchstens 3 Platinen)', 20));
    // 3: alle Bauteile
    const missing = [];
    if (ps.ok) {
      const bom = arr(d.bom).filter(isObj);
      ps.nl.parts.forEach(pt => { if (SRC_KINDS.indexOf(pt.kind) >= 0) return; const b = bom.find(x => x.ref === pt.ref); if (!b || b.kind !== pt.kind || !valueSame(pt.kind, pt.value, b.value)) missing.push(pt.ref); });
    }
    lines.push(L(ps.ok && pl.ok && missing.length === 0 && arr(d.bom).length > 0, 'Stückliste vollständig: ' + (ps.ok ? (missing.length ? missing.length + ' Bauteile fehlen oder weichen ab (Art, Widerstands- und Kondensatorwert, IC-Typ), z. B. ' + missing.slice(0, 3).join(', ') : 'alle ' + ps.nl.parts.filter(x => SRC_KINDS.indexOf(x.kind) < 0).length + ' Bauteile des Schaltplans sind platziert') : 'Schaltplan fehlt'), 15));
    // 4: Kurzschlüsse
    let vccGnd = false;
    if (pl.ok) { const a = icsOf(pl, '4518')[0]; if (a) { const v = pnet(pl, a.ref + '.16'), g = pnet(pl, a.ref + '.8'); vccGnd = !!v && v === g; } }
    lines.push(L(pl.ok && shorts.length === 0 && !vccGnd, 'Keine Kurzschlüsse: ' + (pl.ok ? (vccGnd ? 'Plus und Masse sind verbunden' : shorts.length ? shorts[0] : 'kein Netz ist mit einem anderen verbunden') : 'keine Netzliste'), 15));
    // 5: Simulation (Takteingang wie im Schaltplan, im Lochraster ohne Quelle)
    const sst = ps.ok ? counterStruct(ps) : null, hint = sst && sst.clkPin ? sst.clkPin : null;
    const sm = pl.ok ? counterSim(pl, hint) : { ok: false, msg: 'keine Netzliste', seq: [] };
    lines.push(L(sm.ok && seqOk(sm.seq) && wrapOk(sm.seq), 'Zählen am Lochraster (Simulation, ' + 1000 + ' Hz Testtakt): ' + (sm.ok ? (seqOk(sm.seq) && wrapOk(sm.seq) ? '00 bis 59 und Überlauf auf 00' : 'Zählfolge falsch, ' + sm.seq.slice(0, 6).join(', ') + ' ...') : sm.msg), 15));
    return lines;
  }
  function isI(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }

  /* ====================================================================== vu5: Serienplatine (Leiterplatten-Lab) */
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
  /* Platinenaufbau der Musterlösung: Netzliste (Zähler aus dem Lochraster, Teiler, Netzteil, Entkopplung, Prüfpunkt) und feste Bauteilplätze */
  const ICREFS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'];
  const BPOS = {
    U5: [9, 15], U6: [21, 15], U1: [34, 15], U2: [46, 15], U3: [58, 15], U4: [70, 15], DS1: [92, 13], DS2: [92, 37],
    Q1: [10, 33], R15: [10, 38.5], C1: [18, 33], C2: [18, 38.5], TP_Q: [25, 35], D1: [40, 33], D2: [40, 38], D3: [58, 33], D4: [58, 38],
    C3: [45, 50], U7: [30, 52], C4: [58, 50], X1: [5, 52]
  };
  function boardNetlist(P, locn) {
    const N = NL(), b = N.builder('Serienplatine Uhr');
    const src = prep(locn).nl;
    src.parts.forEach(pt => { if (SRC_KINDS.indexOf(pt.kind) >= 0) return; b.add(pt.ref, pt.kind, pt.value, pt.props); });
    src.nets.forEach(n => { const pins = n.pins.filter(a => { const pt = src.parts.find(x => x.ref === a.slice(0, a.indexOf('.'))); return pt && SRC_KINDS.indexOf(pt.kind) < 0; }); if (pins.length) b.net(n.name, ...pins); });
    b.add('TP_Q', 'KL', '', { n: 2 });
    addTeiler(b, P);
    b.net('XO', 'TP_Q.1').gnd('TP_Q.2');
    b.add('D1', 'D', '1N4007').add('D2', 'D', '1N4007').add('D3', 'D', '1N4007').add('D4', 'D', '1N4007').add('C3', 'CE', '470u').add('C4', 'C', '100n').add('U7', 'REG', '7805').add('X1', 'KL', '', { n: 2 });
    b.net('AC1', 'X1.1', 'D1.A', 'D2.K').net('AC2', 'X1.2', 'D3.A', 'D4.K').net('UP', 'D1.K', 'D3.K', 'C3.1', 'U7.IN').gnd('D2.A', 'D4.A', 'C3.2', 'U7.GND', 'C4.2').net('VCC', 'U7.OUT', 'C4.1');
    ICREFS.forEach((u, i) => { b.add('C' + (5 + i), 'C', '100n'); b.net('VCC', 'C' + (5 + i) + '.1'); b.gnd('C' + (5 + i) + '.2'); });
    const nl = b.build(); if (!nl) throw new Error('Platinen-Netzliste: ' + b.errors.join(' | '));
    return nl;
  }
  const solBoards = new Map();
  function buildBoard(P, locn, pk) {
    const N = NL(), c = PCB();
    let src = locn; const ref = prep(locn), refOk = ref.ok && ICREFS.slice(0, 4).every(r => ref.nl.parts.some(x => x.ref === r)) && ref.nl.parts.some(x => x.ref === 'DS1') && ref.nl.parts.some(x => x.ref === 'R14');
    if (!refOk) src = counterBuilder(P).build();
    const nl = boardNetlist(P, src), pi = psuPick(pk);
    if (pi.ok) nl.parts.forEach(pt => { if (pt.ref === 'C3') pt.value = fmtC(pi.cUF); });
    const key = hash(JSON.stringify([nl.parts.map(x => [x.ref, x.kind]), nl.nets, P.boardW, P.boardH, P.layers]));
    let board;
    if (solBoards.has(key)) board = clone(solBoards.get(key));
    else {
      const fp = {}; nl.parts.forEach(pt => { if (pt.kind === 'R') fp[pt.ref] = 'R0805'; if (pt.kind === 'C') fp[pt.ref] = 'C0805'; });
      fp.C3 = 'C_RADIAL_5'; fp.TP_Q = 'HDR_1x2';
      const at = {};
      Object.keys(BPOS).forEach(k => { at[k] = { x: BPOS[k][0], y: BPOS[k][1], rot: 0 }; });
      for (let i = 1; i <= 14; i++) at['R' + i] = { x: 82, y: (i <= 7 ? 30 : 5) + ((i - 1) % 7) * 3.2, rot: 0 };
      ICREFS.forEach((u, i) => { at['C' + (5 + i)] = { x: BPOS[u][0] + 7, y: BPOS[u][1] - 12, rot: 0 }; });
      const tb = N.toBoard(nl, { w: P.boardW, h: P.boardH, layers: P.layers, margin: 3, gap: 2, fp: fp, at: at, id: 'uhr', name: 'Digitale Uhr mit Wecker' });
      if (!tb.ok) throw new Error('toBoard: ' + (tb.errs || tb.warnings).join(' | '));
      const bd = tb.board; bd.id = 'uhr'; bd.name = 'Digitale Uhr mit Wecker';
      bd.nets.forEach(n => { if (['VCC', 'GND', 'UP'].indexOf(n.name) >= 0) { n.cls = 'power'; n.width = 0.4; } });
      const ar = c.autoroute(bd, { maxMs: 40000 });
      board = ar.board || bd; board.id = 'uhr';
      solBoards.set(key, clone(board));
    }
    board.parts.forEach(pt => { const q = nl.parts.find(x => x.ref === pt.ref); if (q) pt.value = q.value; });
    return board;
  }
  const fmtC = uF => (uF >= 1000 ? String(rd(uF / 1000, 3)) + 'm' : String(rd(uF, 3)) + 'u');
  const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  function checkPcb(data, ctx) {
    const P = P_(ctx), lines = [], d = isObj(data) ? data : {}, c = PCB(), N = NL();
    const loch = need(ctx, 'uhr.loch'), pl = prep(loch && loch.netlist), pk = psuPick(need(ctx, 'uhr.ds'));
    const board = asBoard(d.board);
    if (!board || !pl.ok || !c) return [L(false, 'Platine oder Lochraster-Netzliste fehlt, die Platine lässt sich nicht prüfen', 100)];
    const norm = c.normalize(board), st = boardStats(norm), nParts = arr(norm.parts).length;
    const pads = nParts ? c.padsOf(norm) : [], padOf = {}; pads.forEach(p => { padOf[p.id] = p; });
    const bnet = {}; arr(norm.nets).forEach(n => { if (isObj(n)) arr(n.pins).forEach(a => { if (bnet[String(a)] === undefined) bnet[String(a)] = n.name; }); });
    // 1: Netze identisch + Netzteil mit den Werten der Datenblatt-Station
    let eq = null, fb = null;
    try { fb = N.fromBoard(norm, pl.nl); } catch (e) { fb = null; }
    if (fb) eq = cmpNl(pl, { nl: fb });
    const regP = norm.parts.find(x => x.fp === 'TO-220' && /78\d\d/.test(String(x.value))), elP = norm.parts.find(x => /^C_RADIAL/.test(String(x.fp)) && numOf(x.value) >= 47e-6);
    const nDio = norm.parts.filter(x => x.fp === 'D_DO41' || /^SOD-123/.test(String(x.fp)) || /1N4\d\d\d/.test(String(x.value))).length;
    const vdd0 = icsOf(pl, '4518')[0] || icsOf(pl, '4543')[0], vddNet = vdd0 ? bnet[vdd0.ref + '.' + icNp(vdd0)] : undefined, gndNet = vdd0 ? bnet[vdd0.ref + '.' + icNp(vdd0) / 2] : undefined;
    const psuErrs = [];
    if (pk.ok) {
      if (!regP || String(regP.value).indexOf(refOf(pk.rg)) < 0) psuErrs.push('Regler ' + refOf(pk.rg) + ' fehlt auf der Platine');
      if (!elP || !(fin(pk.cUF) && sameVal(numOf(elP.value) * 1e6, pk.cUF, 0.01))) psuErrs.push('Siebelko ' + fm(pk.cUF, 0) + ' µF aus der Datenblatt-Station fehlt (gefunden: ' + (elP ? fm(numOf(elP.value) * 1e6, 0) + ' µF' : 'keiner') + ')');
      if (nDio < 4) psuErrs.push('Brückengleichrichter braucht 4 Dioden (gefunden: ' + nDio + ')');
      if (regP && vddNet !== undefined && bnet[regP.ref + '.3'] !== vddNet) psuErrs.push('der Reglerausgang liegt nicht am Versorgungsnetz der ICs');
      if (regP && elP && bnet[regP.ref + '.1'] !== bnet[elP.ref + '.1']) psuErrs.push('der Siebelko liegt nicht am Reglereingang');
    } else psuErrs.push('Datenblatt-Station fehlt');
    const eqOk = !!eq && eq.ok && nParts > 0;
    lines.push(L(eqOk && psuErrs.length === 0, 'Netze der Platine identisch zum Lochraster, Netzteil mit den Werten der Datenblatt-Station' + (nParts === 0 ? ' – die Platine ist leer' : !eq ? ' – Netzliste nicht auswertbar' : !eq.ok ? ' – ' + eq.errs[0] + (eq.errs.length > 1 ? ' (+' + (eq.errs.length - 1) + ' weitere)' : '') : psuErrs.length ? ' – ' + psuErrs[0] : ' (' + eq.stats.common + ' Bauteile, Netzteil mit ' + (elP ? fm(numOf(elP.value) * 1e6, 0) : '?') + ' µF und ' + (regP ? String(regP.value) : '?') + ')'), 20));
    // 2: offene Netze
    lines.push(L(nParts > 0 && st.unrouted === 0 && arr(norm.nets).length >= 5, 'Alle Netze verlegt: offene Verbindungen ' + st.unrouted + ', Kurzschlüsse ' + st.shorts + (arr(norm.nets).length < 5 ? ', es fehlen Netze auf der Platine' : ''), 20));
    // 3: DRC, Maße
    const sizeOk = fin(norm.w) && fin(norm.h) && norm.w <= P.boardW + 1e-6 && norm.h <= P.boardH + 1e-6 && norm.layers >= 1 && norm.layers <= P.layers;
    lines.push(L(nParts > 0 && st.errs.length === 0 && sizeOk, 'DRC ohne Fehler: ' + st.errs.length + ' Fehler' + (st.errs.length ? ' (' + String(st.errs[0].msg).slice(0, 60) + ')' : '') + ', Maße ' + fm(norm.w, 0) + ' x ' + fm(norm.h, 0) + ' mm, ' + norm.layers + ' Lagen (höchstens ' + P.boardW + ' x ' + P.boardH + ' mm, ' + P.layers + ' Lagen)', 15));
    // 4: Versorgungsbahnen
    const widthOf = net => { let m = Infinity, n = 0; arr(norm.tracks).forEach(t => { const nm = st.conn.itemNet && st.conn.itemNet[t.id] || t.net; if (nm === net) { n++; m = Math.min(m, +t.w || 0); } }); return { min: m, n: n }; };
    const vw = vddNet !== undefined ? widthOf(vddNet) : { min: 0, n: 0 }, gw = gndNet !== undefined ? widthOf(gndNet) : { min: 0, n: 0 };
    const gZone = arr(norm.zones).some(z => isObj(z) && z.net === gndNet && gndNet !== undefined);
    lines.push(L(vw.n > 0 && vw.min >= 0.4 - 1e-9 && (gZone || (gw.n > 0 && gw.min >= 0.4 - 1e-9)), 'Versorgungsbahnen: Plus ' + (vw.n ? 'mindestens ' + fm(vw.min, 2) + ' mm' : 'keine Bahnen') + ', Masse ' + (gZone ? 'als Fläche' : gw.n ? 'mindestens ' + fm(gw.min, 2) + ' mm' : 'keine Bahnen') + ' (verlangt 0,4 mm (A) oder eine Masse-Fläche)', 15));
    // 5: Entkopplung
    const ics = norm.parts.filter(x => /^DIP-\d+$/.test(String(x.fp)) && !/^(SEG|DS)/.test(String(x.ref))), caps = norm.parts.filter(x => /^(C0\d+|C_RADIAL)/.test(String(x.fp)) && numOf(x.value) <= 1e-6 + 1e-12 && numOf(x.value) >= 10e-9);
    const noCap = ics.filter(ic => {
      const n = +/DIP-(\d+)/.exec(ic.fp)[1], vp = padOf[ic.ref + '.' + n], vn = vp && vp.net, gn = (padOf[ic.ref + '.' + (n / 2)] || {}).net;
      if (!vp || !vn) return true;
      return !caps.some(cp => { const a = padOf[cp.ref + '.1'], b = padOf[cp.ref + '.2']; if (!a || !b) return false; const [pv, pg] = a.net === vn ? [a, b] : [b, a]; return pv.net === vn && pg.net === gn && dist(pv, vp) <= 10 + 1e-9; });
    });
    lines.push(L(ics.length >= 4 && noCap.length === 0, 'Entkoppelkondensator an jedem IC höchstens 10 mm vom VDD-Pin (A): ' + ics.length + ' ICs' + (noCap.length ? ', es fehlt oder ist zu weit bei ' + noCap.map(x => x.ref).slice(0, 3).join(', ') : ' alle versorgt'), 10));
    // 6: Quarz, Prüfpunkt
    const xt = norm.parts.find(x => x.fp === 'XTAL_HC49' || (/^[QXY]\d/i.test(String(x.ref)) && sameVal(numOf(x.value), P.fQ, 0.01))), tp = norm.parts.find(x => /^TP_?Q$/i.test(String(x.ref)));
    let qTxt = 'kein Quarz', qOk = false;
    if (xt) {
      const xp = [padOf[xt.ref + '.1'], padOf[xt.ref + '.2']].filter(Boolean), xn = xp.map(x => x.net).filter(Boolean);
      const ic = ics.find(x => ['10', '11'].some(k => padOf[x.ref + '.' + k] && xn.indexOf(padOf[x.ref + '.' + k].net) >= 0 && padOf[x.ref + '.' + k].net));
      let dmin = Infinity; if (ic) ['10', '11'].forEach(k => { const q = padOf[ic.ref + '.' + k]; if (q) xp.forEach(a => { dmin = Math.min(dmin, dist(a, q)); }); });
      const tpOk = !!tp && [padOf[tp.ref + '.1'], padOf[tp.ref + '.2']].some(q => q && q.net && xn.indexOf(q.net) >= 0);
      qOk = !!ic && dmin <= 15 + 1e-9 && tpOk;
      qTxt = ic ? 'Quarz ' + fm(dmin, 1) + ' mm vom Teiler-IC ' + ic.ref + ' (höchstens 15 mm (A))' + (tpOk ? ', Prüfpunkt TP_Q am Quarz' : ', Prüfpunkt TP_Q fehlt oder hängt nicht am Quarz') : 'der Quarz hängt an keinem 4060 (Pin 10 und 11)';
    }
    lines.push(L(qOk, 'Quarz nah am Teiler, Prüfpunkt TP_Q: ' + qTxt, 10));
    // 7: Referenzen
    const refs = norm.parts.map(x => String(x.ref || '')), uniq = new Set(refs).size === refs.length, hid = norm.parts.filter(x => x.hideRef).length;
    lines.push(L(nParts > 0 && uniq && refs.every(Boolean) && hid === 0, 'Referenzen im Siebdruck: ' + nParts + ' Bauteile, ' + (uniq ? 'alle Bezeichnungen eindeutig' : 'doppelte Bezeichnungen') + ', ' + hid + ' mit ausgeblendeter Bezeichnung', 10));
    return lines;
  }

  /* ====================================================================== vu6: Quarz und Gang messen (MessLab) */
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
  const rowOf = (rows, key) => arr(rows).find(r => isObj(r) && normId(r.id || r.label) === key) || null;
  const SC = { Hz: 1, kHz: 1e3, MHz: 1e6, ppm: 1, 's/Tag': 1, 's/d': 1, 's/day': 1, 'ms/Tag': 1e-3, V: 1, mV: 1e-3 };
  function rowVal(r, units) {
    if (!r) return NaN; const v = fin(r.ist) ? r.ist : numOf(r.ist); if (!fin(v)) return NaN;
    const u = String(r.unit == null ? '' : r.unit).trim();
    return units.indexOf(u) >= 0 ? v * SC[u] : NaN;
  }
  const UNITS = { f: ['Hz', 'kHz', 'MHz'], ppm: ['ppm'], gang: ['s/Tag', 's/d', 's/day', 'ms/Tag'], u: ['V', 'mV'] };
  function messTruth(P) { return { fRead: rd(rd(P.fIst / P.resHz, 0) * P.resHz, 3), ppm: P.ppm, gang: P.gangTag }; }
  function messVals(d) {
    const rows = arr(d && d.rows), v = isObj(d && d.values) ? d.values : {};
    const pick1 = (key, units, row) => (fin(+v[key]) ? +v[key] : rowVal(rowOf(rows, row), units));
    return { f: pick1('fIstHz', UNITS.f, 'fist'), ppm: pick1('ppm', UNITS.ppm, 'ppm'), gang: pick1('gangSProTag', UNITS.gang, 'gangsprotag'), u: rowVal(rowOf(rows, 'uvdd'), UNITS.u), rows: rows, fnd: arr(d && d.findings).map(lc).join(' | ') };
  }
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = isObj(data) ? data : {}, t = messTruth(P), m = messVals(d);
    lines.push(L(fin(m.f) && Math.abs(m.f - t.fRead) <= P.resHz + 1e-9, 'Quarzfrequenz f_ist: ' + (fin(m.f) ? 'gemessen ' + fm(m.f, 2) + ' Hz' : 'nicht eingetragen (Wert und Einheit Hz, kHz oder MHz)') + ', der Zähler zeigt ' + fm(t.fRead, 2) + ' Hz (±' + fm(P.resHz, 2) + ' Hz Zählerauflösung)', 25));
    const pTol = 1 * tol;
    lines.push(L(fin(m.ppm) && Math.abs(m.ppm - t.ppm) <= pTol + 1e-9, 'Abweichung (f_ist − f_Nenn) / f_Nenn: ' + (fin(m.ppm) ? fm(m.ppm, 2) + ' ppm' : 'nicht eingetragen') + ', erwartet ' + fm(t.ppm, 2) + ' ppm (±' + fm(pTol, 1) + ' ppm)', 25));
    const gTol = 0.1 * tol;
    lines.push(L(fin(m.gang) && Math.abs(m.gang - t.gang) <= gTol + 1e-9, 'Gang pro Tag = ppm · 86400 s: ' + (fin(m.gang) ? fm(m.gang, 2) + ' s/Tag' : 'nicht eingetragen') + ', erwartet ' + fm(t.gang, 2) + ' s/Tag (±' + fm(gTol, 2) + ' s)', 20));
    const richt = isObj(d.values) ? lc(d.values.richtung) : '', txt = richt + ' | ' + m.fnd, sgnOk = !fin(m.gang) || Math.sign(m.gang) === Math.sign(t.gang);
    const wantVor = t.gang > 0, said = wantVor ? /\bvor\b|geht vor|zu schnell|voreilen/.test(txt) : /\bnach\b|geht nach|zu langsam|nachgehen/.test(txt), wrong = wantVor ? /\bnach\b|geht nach|zu langsam/.test(richt) : /\bvor\b|geht vor|zu schnell/.test(richt);
    lines.push(L(said && !wrong && sgnOk, 'Richtung des Gangs benannt: Die Uhr geht ' + (wantVor ? 'vor' : 'nach') + ' (Quarz ' + (wantVor ? 'schneller' : 'langsamer') + ' als nominal, Gang ' + fm(t.gang, 2) + ' s/Tag)' + (said ? '' : ' – nicht benannt') + (sgnOk ? '' : ' – das Vorzeichen des Gangs stimmt nicht'), 10));
    const pk = psuPick(need(ctx, 'uhr.ds')), band = regBand(pk.rg);
    lines.push(L(fin(m.u) && !!band && m.u >= band.min - 1e-9 && m.u <= band.max + 1e-9, 'Versorgung U_VDD: ' + (fin(m.u) ? fm(m.u, 2) + ' V' : 'nicht eingetragen') + ', Datenblattbereich des Reglers ' + (band ? fm(band.min, 2) + ' bis ' + fm(band.max, 2) + ' V' : '?'), 10));
    const pcb = need(ctx, 'uhr.pcb'), pb = pcb && asBoard(pcb.board), nets = {}, tpNets = {};
    if (pb) { arr(pb.nets).forEach(n => { if (isObj(n)) { nets[n.name] = n; arr(n.pins).forEach(a => { if (/^TP_?Q\./i.test(String(a))) tpNets[n.name] = 1; }); } }); }
    const rf = rowOf(m.rows, 'fist'), rp = rowOf(m.rows, 'ppm'), rg = rowOf(m.rows, 'gangsprotag'), ru = rowOf(m.rows, 'uvdd');
    const unitOk = rf && UNITS.f.indexOf(String(rf.unit)) >= 0 && rp && UNITS.ppm.indexOf(String(rp.unit)) >= 0 && rg && UNITS.gang.indexOf(String(rg.unit)) >= 0 && ru && UNITS.u.indexOf(String(ru.unit)) >= 0;
    const insOk = [rf, rp, rg, ru].every(r => r && String(r.instrument || '').trim()), tpOk = !!rf && (!pb ? !!rf.tp : (/^TP_?Q$/i.test(String(rf.tp)) || !!tpNets[String(rf.tp)]));
    lines.push(L(!!unitOk && insOk && tpOk, 'Einheiten, Messgeräte und Prüfpunkt: ' + (!unitOk ? 'Einheit fehlt oder ist falsch (Hz, ppm, s/Tag, V)' : !insOk ? 'Messgerät fehlt in einer Zeile' : !tpOk ? 'der Prüfpunkt von f_ist ist nicht TP_Q der Platine' : '4 Zeilen mit Einheit und Messgerät, Prüfpunkt TP_Q'), 10));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), t = messTruth(P), pk = psuPick(need(ctx, 'uhr.ds')), band = regBand(pk.rg);
    const ppm = rd((t.fRead - P.fQ) / P.fQ * 1e6, 3), gang = rd(ppm * 0.0864, 3), uV = band ? rd(band.typ, 2) : 5;
    const mk = (id, label, unit, soll, ist, tol, ins, tp) => ({ id: id, label: label, unit: unit, soll: soll, ist: ist, tol: tol, instrument: ins, tp: tp });
    return { rows: [mk('f_ist', 'Quarzfrequenz', 'Hz', P.fQ, t.fRead, P.resHz, 'Frequenzzähler', 'TP_Q'), mk('ppm', 'Abweichung', 'ppm', 0, ppm, 1, 'Rechnung', ''), mk('gangSProTag', 'Gang pro Tag', 's/Tag', 0, gang, 0.1, 'Rechnung', ''), mk('U_VDD', 'Versorgung der Logik', 'V', 5, uV, 0.25, 'Multimeter', 'VCC')],
      values: { fIstHz: t.fRead, ppm: ppm, gangSProTag: gang, richtung: gang > 0 ? 'vor' : 'nach' }, findings: ['Der Quarz läuft ' + fm(Math.abs(ppm), 1) + ' ppm ' + (ppm > 0 ? 'zu schnell, die Uhr geht vor.' : 'zu langsam, die Uhr geht nach.')] };
  }

  /* ====================================================================== vu7: Software-Wecker mit Gangkorrektur (Arduino-Lab) */
  function sketchSource(P, korrUs) {
    return [
      '// Digitale Uhr mit Wecker: Zeit seit Mitternacht in Sekunden, Gangkorrektur aus der Messung',
      '#include <LiquidCrystal_I2C.h>',
      'LiquidCrystal_I2C lcd(0x27, 16, 2);',
      'const int PIEZO = 8;',
      'const int TASTER = 2;',
      'const long WECK_S = ' + P.weckSek + ';        // Weckzeit ' + String(P.weckH).padStart(2, '0') + ':' + String(P.weckM).padStart(2, '0') + ' in Sekunden seit Mitternacht',
      'const long KORR_US = ' + korrUs + ';        // Korrektur in Mikrosekunden je Sekunde (gemessener Gang in ppm, plus = Uhr geht vor)',
      'unsigned long last = 0;',
      'long periode = 1000;        // aktuelle Sekundenlänge in Millisekunden',
      'long frac = 0;              // Rest in Mikrosekunden',
      'long sek = 0;               // Sekunden seit Mitternacht',
      'bool weckt = false;',
      'unsigned long weckStart = 0;',
      '',
      'void zeigen() {',
      '  lcd.setCursor(0, 0);',
      '  int h = sek / 3600;',
      '  int m = (sek / 60) % 60;',
      '  int s = sek % 60;',
      '  if (h < 10) lcd.print("0");',
      '  lcd.print(h);',
      '  lcd.print(":");',
      '  if (m < 10) lcd.print("0");',
      '  lcd.print(m);',
      '  lcd.print(":");',
      '  if (s < 10) lcd.print("0");',
      '  lcd.print(s);',
      '}',
      '',
      'void setup() {',
      '  pinMode(PIEZO, OUTPUT);',
      '  pinMode(TASTER, INPUT_PULLUP);',
      '  lcd.init();',
      '  lcd.backlight();',
      '  zeigen();',
      '}',
      '',
      'void loop() {',
      '  if (millis() - last >= periode) {',
      '    last += periode;',
      '    long us = 1000000L + KORR_US + frac;',
      '    periode = us / 1000;',
      '    frac = us % 1000;',
      '    sek = (sek + 1) % 86400;',
      '    zeigen();',
      '    if (sek == WECK_S) { weckt = true; weckStart = millis(); tone(PIEZO, 2000); }',
      '  }',
      '  if (weckt && (millis() - weckStart >= 60000 || digitalRead(TASTER) == LOW)) { noTone(PIEZO); weckt = false; }',
      '}'
    ].join('\n');
  }
  function sketchSolution(ctx) {
    const P = P_(ctx), m = need(ctx, 'uhr.mess'), mv = messVals(m), gang = fin(mv.gang) ? mv.gang : P.gangTag;
    return { lang: 'arduino', src: sketchSource(P, Math.round(gang / 0.0864)) };
  }
  /* Arduino-Lauf mit zufällig gestreuter Schrittweite (sonst messen wir nur die Rasterung der Schritte), Sprung auf den nächsten delay()-Zeitpunkt,
     Schrittgrenze und Zeitlimit. o = { T, dt, ppm, fineFrom, fineTo, fineDt, press:[tOn, tOff] } */
  const runCache = new Map();
  const RUN_MAX_STEPS = 3000000, RUN_MAX_MS = 8000;
  const parseSec = rows => { for (const row of rows) { const m = /(\d{1,2}):(\d{2}):(\d{2})/.exec(row); if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]); } return null; };
  /* LCD 16 x 2 nachbilden: gültiger Anzeigestand ist der Stand am Ende eines Rechenschritts (Zwischenstände mitten im Schreiben zählen nicht) */
  function lcdModel() {
    const buf = [Array(16).fill(' '), Array(16).fill(' ')], raw = []; let r = 0, c = 0, lastT = null;
    const put = s => { for (const ch of String(s)) { if (c < 16 && r < 2) buf[r][c] = ch; c++; } };
    const flush = t => { const sec = parseSec(buf.map(x => x.join(''))); if (sec !== null && (raw.length === 0 || raw[raw.length - 1].sec !== sec)) raw.push({ t: t, sec: sec }); };
    return {
      ev(t, name, a) {
        if (lastT !== null && t !== lastT) flush(lastT);
        lastT = t; a = a || [];
        if (name === 'clear') { buf.forEach(x => x.fill(' ')); r = 0; c = 0; } else if (name === 'home') { r = 0; c = 0; } else if (name === 'setCursor') { c = Math.max(0, a[0] | 0); r = Math.max(0, a[1] | 0); }
        else if (name === 'print' || name === 'write') put(typeof a[0] === 'number' && name === 'write' ? String.fromCharCode(a[0]) : a[0]);
      },
      done() { if (lastT !== null) flush(lastT); lastT = null; return raw; },
      rows() { return buf.map(x => x.join('')); }
    };
  }
  function clockRun(src, o) {
    const key = hash(JSON.stringify([src, o]));
    if (runCache.has(key)) return runCache.get(key);
    const res = { ok: false, error: '', steps: 0, raw: [], tones: [], lcdEvents: 0 };
    try {
      const AR = ARD(), RN = RUN();
      if (!AR || !RN) throw new Error('Arduino-Kern oder Läufer nicht geladen');
      const comp = AR.compile(String(src == null ? '' : src));
      if (!comp.ok) { const e = comp.errors[0] || { line: 0, msg: 'Übersetzungsfehler' }; throw new Error('Zeile ' + e.line + ': ' + e.msg); }
      const digital = o.press ? { 2: [[0, 1], [o.press[0], 0], [o.press[1], 1]] } : {};
      const io = RN.mkMockIo(null, { digital: digital }, { kind: 'arduino' }), lcd = lcdModel();
      io.lcd = (obj, name, a) => { res.lcdEvents++; lcd.ev(io.t, name, a); return 0; };
      const runner = AR.createRunner(comp.program, io); runner.start();
      const scale = 1 + (o.ppm || 0) / 1e6, rnd = rng(0x5eed1e5), maxMs = o.maxMs || RUN_MAX_MS, maxSteps = o.maxSteps || RUN_MAX_STEPS;
      const t0 = Date.now(); let t = 0, steps = 0;
      while (t <= o.T) {
        io.setTime(t, scale); runner.step(t * scale); steps++;
        if (runner.error) throw new Error('Laufzeitfehler in Zeile ' + runner.error.line + ': ' + runner.error.msg);
        if (steps > maxSteps) throw new Error('Schrittgrenze überschritten (Endlosschleife?)');
        if (steps % 128 === 0 && Date.now() - t0 > maxMs) throw new Error('Zeitlimit von ' + rd(maxMs / 1000, 1) + ' s Rechenzeit überschritten (Endlosschleife?)');
        const dt = o.fineFrom !== undefined && t >= o.fineFrom && t < o.fineTo ? o.fineDt : o.midFrom !== undefined && t >= o.midFrom && t < o.fineFrom ? o.midDt : o.dt;
        let nt = t + dt * (0.5 + rnd());
        if (runner.wakeAt > nt * scale) nt = runner.wakeAt / scale + 1e-9;        // delay(): genau zum Weckzeitpunkt
        t = nt;
      }
      res.ok = true; res.steps = steps; res.raw = lcd.done(); res.tones = io.tones.slice();
    } catch (e) { res.error = e && e.message ? e.message : String(e); }
    if (runCache.size > 300) runCache.clear();
    runCache.set(key, res); return res;
  }
  /* raw = jeder Wechsel der angezeigten Zeit; acc = nur die lückenlos aufeinanderfolgenden Sekunden (Zwischenstände fallen heraus) */
  function timeline(run) {
    const raw = arr(run.raw), acc = []; let prev = null;
    raw.forEach(s => { if (prev === null) { acc.push(s); prev = s.sec; } else if (s.sec === (prev + 1) % 86400) { acc.push(s); prev = s.sec; } });
    return { raw: raw, acc: acc };
  }
  const shownAt = (tl, t) => { let v = null; for (const r of tl.raw) { if (r.t <= t + 1e-9) v = r.sec; else break; } return v; };
  const hms = s => (s === null ? '?' : String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'));
  /* Gang in s/Tag aus den Anzeigewechseln: Mittel der ersten und letzten 150 Wechsel, plus = Anzeige läuft vor */
  function driftOf(tl) {
    const a = tl.acc; if (a.length < 400) return NaN;
    const n = Math.min(150, Math.floor((a.length - 2) / 3)), first = a.slice(2, 2 + n), last = a.slice(a.length - n);
    const mean = (l, k) => l.reduce((s, x) => s + x[k], 0) / l.length;
    const per = (mean(last, 't') - mean(first, 't')) / (mean(last, 'sec') - mean(first, 'sec'));
    return (1 / per - 1) * 86400;
  }
  function soundSpans(tones) {
    const spans = []; let cur = null;
    tones.forEach(e => {
      if (e.f > 0) { if (!cur) { cur = { start: e.t, end: null }; spans.push(cur); } if (e.dur > 0) cur.until = e.t + e.dur / 1000; }
      else if (cur) { cur.end = e.t; cur = null; }
      if (cur && cur.until !== undefined && e.t >= cur.until) { cur.end = cur.until; cur = null; }
    });
    spans.forEach(s => { if (s.end === null && s.until !== undefined) s.end = s.until; });
    return spans;
  }
  /* A: Drift und Anzeige nach 3661 s (die Weckzeit spielt keine Rolle, deshalb wird sie für den Zwischenspeicher auf 0 gesetzt);
     B: Tagesüberlauf (ohne Quarzfehler und ohne Korrektur, damit der teure Tageslauf für alle Seeds gleich ist); D1: Weckerbeginn und Ende nach 60 s; D2: Taster. Vor dem Wecker läuft die Schrittweite grob, davor fein. */
  const normWeck = src => src.replace(/\/\/[^\n]*/g, '').replace(/(WECK\w*\s*=\s*)\d+/g, '$10');
  function runsOf(src, P) {
    const w = P.weckSek, ns = normWeck(src), stages = (T, press) => ({ ppm: P.ppm, T: T, dt: 0.8, midFrom: w - 60, midDt: 0.4, fineFrom: w - 12, fineTo: T - 3, fineDt: 0.02, press: press });
    return {
      a: clockRun(ns, { ppm: P.ppm, T: 3700, dt: 0.05 }),
      b: clockRun(ns.replace(/(KORR\w*\s*=\s*)-?\d+/g, '$10'), { ppm: 0, T: 86410, dt: 0.8 }),
      d1: clockRun(src, stages(w + 75, null)),
      d2: clockRun(src, stages(w + 25, [w + 10.5, w + 11.1]))
    };
  }
  function clockFigures(src, P) {
    const R = runsOf(src, P), o = { runs: R, ok: R.a.ok && R.b.ok && R.d1.ok && R.d2.ok, error: R.a.error || R.b.error || R.d1.error || R.d2.error };
    if (!o.ok) return o;
    const ta = timeline(R.a), tb = timeline(R.b);
    o.show3661 = shownAt(ta, 3661.5); o.drift = driftOf(ta);
    o.rollover = tb.acc.some((x, i) => x.sec === 86399 && i + 1 < tb.acc.length && tb.acc[i + 1].sec === 0);
    o.spans1 = soundSpans(R.d1.tones); o.spans2 = soundSpans(R.d2.tones);
    return o;
  }
  const NOWAIT = /delay\s*\(\s*(\d+)\s*\)/g;
  function checkCode(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = isObj(data) ? data : {}, src = typeof d.src === 'string' ? d.src : '';
    const fg = src ? clockFigures(src, P) : { ok: false, error: 'kein Programmtext' };
    const longDelay = (() => { let m, bad = null; NOWAIT.lastIndex = 0; while ((m = NOWAIT.exec(src))) { if (+m[1] > 1000) bad = +m[1]; } return bad; })();
    const lim = P.gangZiel * tol, w = P.weckSek;
    const why = fg.ok ? '' : ' – ' + fg.error;
    lines.push(L(fg.ok && fg.show3661 === 3661, 'Anzeige nach 3661 s: ' + (fg.ok ? hms(fg.show3661) + ' (verlangt 01:01:01)' : 'Lauf nicht möglich' + why), 25));
    lines.push(L(fg.ok && fg.rollover, 'Tagesüberlauf: ' + (fg.ok ? (fg.rollover ? 'nach 23:59:59 folgt 00:00:00' : 'die Anzeige läuft nach 23:59:59 nicht auf 00:00:00 über') : 'Lauf nicht möglich' + why), 15));
    lines.push(L(fg.ok && fin(fg.drift) && Math.abs(fg.drift) <= lim, 'Restabweichung nach der Korrektur: ' + (fg.ok ? (fin(fg.drift) ? fm(Math.abs(fg.drift), 2) + ' s/Tag ' + (fg.drift >= 0 ? '(Uhr geht vor)' : '(Uhr geht nach)') : 'nicht messbar, die Anzeige zählt nicht regelmäßig') : 'Lauf nicht möglich' + why) + ', erlaubt ' + fm(lim, 2) + ' s/Tag; ohne Korrektur wären es ' + fm(P.gangTag, 2) + ' s/Tag', 30));
    let sTxt = 'Lauf nicht möglich' + why, sOk = false, aTxt = sTxt, aOk = false, bTxt = sTxt, bOk = false;
    if (fg.ok) {
      const s0 = fg.spans1[0], late = s0 ? s0.start - w : NaN;
      sOk = !!s0 && late >= -0.3 && late <= 1.1; sTxt = s0 ? 'Ton setzt ' + fm(late, 2) + ' s nach der Weckzeit ein (verlangt höchstens 1 s, nicht vorher)' : 'kein Ton zur Weckzeit';
      const len = s0 && s0.end !== null ? s0.end - s0.start : NaN, other = fg.spans1.slice(1);
      aOk = !!s0 && fin(len) && len >= 57.5 && len <= 62.5 && other.length === 0; aTxt = s0 ? (s0.end === null ? 'der Ton endet nie' : 'Ton dauert ' + fm(len, 1) + ' s (verlangt 60 s)' + (other.length ? ', danach klingelt es noch einmal' : '')) : 'kein Ton zur Weckzeit';
      const d0 = fg.spans2[0], press = w + 10.5, stop = d0 && d0.end !== null ? d0.end - press : NaN;
      bOk = !!d0 && fin(stop) && stop >= -0.05 && stop <= 1.1; bTxt = d0 ? (d0.end === null || !fin(stop) ? 'der Ton läuft nach dem Tastendruck weiter' : 'Ton endet ' + fm(stop, 2) + ' s nach dem Tastendruck (verlangt höchstens 1 s)') : 'kein Ton zur Weckzeit';
    }
    lines.push(L(sOk, 'Wecker: ' + sTxt, 8));
    lines.push(L(aOk, 'Wecker ohne Taster: ' + aTxt, 6));
    lines.push(L(bOk, 'Wecker mit Taster: ' + bTxt, 6));
    lines.push(L(fg.ok && longDelay === null && /LiquidCrystal/.test(src), 'Programm kompiliert und läuft ' + (fg.ok ? 'ohne Fehler' : '– ' + (fg.error || 'Fehler')) + (longDelay !== null ? ', delay(' + longDelay + ') blockiert länger als 1 s' : '') + (/LiquidCrystal/.test(src) ? '' : ', das LCD wird nicht angesprochen'), 10));
    return lines;
  }

  /* ====================================================================== vu8: Datenblatt der Uhr (App-Werkstatt) */
  const numbersIn = s => (String(s).replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
  function figureHit(ls, kw, exp, scales) {
    return ls.some(l => kw.test(l) && numbersIn(l).some(n => (scales || [1]).some(sc => fin(exp) && Math.abs(n * sc - exp) <= 0.02 * Math.abs(exp) + 1e-9)));
  }
  function noteFigures(ctx) {
    const P = P_(ctx), m = need(ctx, 'uhr.mess'), mv = messVals(m), pk = psuPick(need(ctx, 'uhr.ds')), band = regBand(pk.rg), pc = need(ctx, 'uhr.pcb'), rep = pc && isObj(pc.report) ? pc.report : {};
    return { gang: Math.abs(fin(mv.gang) ? mv.gang : P.gangTag), ziel: P.gangZiel, uv: band ? band.typ : 5, i: P.iUhr, c: pk.cUF, w: +rep.w, h: +rep.h };
  }
  const TERMS = ['clock', 'crystal', 'oscillator', 'divider', 'counter', 'decoder', 'alarm', 'regulator', 'ripple', 'supply', 'reset', 'display', 'drift', 'buzzer', 'decoupling', 'rectifier', 'capacitor', 'resistor', 'frequency', 'tolerance'];
  function checkApp(data, ctx) {
    const P = P_(ctx), lines = [], md = String(isObj(data) && typeof data.md === 'string' ? data.md : ''), ls = md.split(/\r?\n/), f = noteFigures(ctx);
    const hits = [
      ['Gang vor Korrektur', figureHit(ls, /gang[^\n]*vor/i, f.gang, [1])], ['Gang nach Korrektur (Ziel)', figureHit(ls, /gang[^\n]*nach/i, f.ziel, [1])],
      ['Versorgung', figureHit(ls, /versorgung|spannung/i, f.uv, [1])], ['Stromaufnahme', figureHit(ls, /strom/i, f.i, [1, 1000])],
      ['Siebelko', figureHit(ls, /elko|sieb|kondensator/i, f.c, [1, 1000])],
      ['Platinenmaße', ls.some(l => /platine|leiterplatte/i.test(l) && (() => { const n = numbersIn(l); return n.length >= 2 && fin(f.w) && ((Math.abs(n[0] - f.w) <= 0.02 * f.w && Math.abs(n[1] - f.h) <= 0.02 * f.h) || (Math.abs(n[1] - f.w) <= 0.02 * f.w && Math.abs(n[0] - f.h) <= 0.02 * f.h)); })())]
    ];
    const nHit = hits.filter(h => h[1]).length;
    lines.push(L(nHit >= 4, 'Kennzahlen: ' + nHit + ' von 6 stimmen (mindestens 4 mit Zahlen innerhalb 2 %); fehlt oder falsch: ' + (hits.filter(h => !h[1]).map(h => h[0]).join(', ') || 'nichts'), 35));
    const sec = name => { const i = ls.findIndex(l => /^#{1,6}\s/.test(l) && lc(l.replace(/^#+\s*/, '').replace(/^\d+[.)]?\s*/, '')).indexOf(name) === 0); if (i < 0) return null; let j = i + 1; while (j < ls.length && !/^#{1,6}\s/.test(ls[j])) j++; return ls.slice(i + 1, j).join('\n'); };
    const sd = sec('technische daten'), sb = sec('bedienung'), sw = sec('wartung');
    lines.push(L(sd !== null && sd.trim().length > 20 && sb !== null && sb.trim().length > 20 && sw !== null && sw.trim().length > 20, 'Abschnitte „Technische Daten“, „Bedienung“ und „Wartung“ mit Inhalt' + (sd === null ? ' – Technische Daten fehlt' : sb === null ? ' – Bedienung fehlt' : sw === null ? ' – Wartung fehlt' : ''), 25));
    const heads = ls.filter(l => /^#{1,6}\s+\S/.test(l)), words = (md.replace(/^---[\s\S]*?---/, '').match(/[A-Za-zÄÖÜäöüß0-9]+/g) || []).length;
    lines.push(L(heads.length >= 4 && words >= 120, 'Länge: ' + heads.length + ' Überschriften (mindestens 4), ' + words + ' Wörter (mindestens 120)', 15));
    const fm_ = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md), body = fm_ ? fm_[1] : '', tagsOk = /tags\s*:/i.test(body) && /(uhr|wecker)/i.test(body), dateOk = /date\s*:\s*\d{4}-\d{2}-\d{2}/i.test(body);
    lines.push(L(!!fm_ && tagsOk && dateOk, 'Frontmatter mit tags (Projekt Uhr oder Wecker) und date (JJJJ-MM-TT)' + (!fm_ ? ' – Frontmatter fehlt' : !tagsOk ? ' – Projekt-Tag fehlt' : !dateOk ? ' – Datum fehlt' : ''), 10));
    const gs = sec('glossar') !== null ? sec('glossar') : sec('glossary'), got = TERMS.filter(t => gs && new RegExp('\\b' + t, 'i').test(gs));
    lines.push(L(gs !== null && got.length >= 4, 'Glossar mit englischen Fachbegriffen: ' + (gs === null ? 'Abschnitt „Glossar“ fehlt' : got.length + ' Begriffe (mindestens 4), z. B. ' + (got.slice(0, 3).join(', ') || 'keiner')), 15));
    return lines;
  }
  function noteSolution(ctx) {
    const P = P_(ctx), f = noteFigures(ctx), today = new Date().toISOString().slice(0, 10), hh = String(P.weckH).padStart(2, '0') + ':' + String(P.weckM).padStart(2, '0');
    const md = [
      '---', 'tags: [uhr, wecker, datenblatt]', 'date: ' + today, '---',
      '# Digitale Uhr mit Wecker: Datenblatt',
      'Quarzuhr mit Netzteil, Sekundenzähler und Arduino-Wecker. Dieses Datenblatt fasst die Werte der fertigen Uhr zusammen.',
      '## Technische Daten',
      '- Quarz: ' + P.fQ + ' Hz, geteilt auf genau 1 Hz',
      '- Gang vor Korrektur: ' + fm(f.gang, 2) + ' s/Tag',
      '- Gang nach Korrektur: höchstens ' + fm(f.ziel, 1) + ' s/Tag',
      '- Versorgung der Logik: ' + fm(f.uv, 1) + ' V über Festregler 7805',
      '- Stromaufnahme: ' + P.iUhr + ' mA',
      '- Siebelko: ' + fm(f.c, 0) + ' µF',
      '- Platine: ' + fm(f.w, 0) + ' x ' + fm(f.h, 0) + ' mm, zwei Lagen',
      '## Anschlüsse',
      'Trafo ' + P.uSec + ' V Wechselspannung an die Klemme X1. Der Prüfpunkt TP_Q führt das Quarzsignal für den Frequenzzähler.',
      '## Bedienung',
      'Die Uhr beginnt beim Einschalten bei 00:00:00 und zeigt Stunden, Minuten und Sekunden auf dem LCD. Die Weckzeit ' + hh + ' Uhr ist im Programm eingestellt. Zur Weckzeit ertönt der Summer, er endet nach 60 Sekunden von selbst oder mit dem Taster.',
      '## Wartung',
      '- Geht die Uhr falsch, den Quarz mit dem Frequenzzähler am Prüfpunkt TP_Q messen und die Korrektur im Programm anpassen.',
      '- Zeigt die Anzeige nichts, die Versorgung am Regler 7805 und die Brummspannung am Siebelko prüfen.',
      '- Einmal im Jahr die Steckverbindungen kontrollieren.',
      '## Glossar',
      '- crystal: Quarz',
      '- oscillator: Oszillator, schwingt mit dem Quarz',
      '- divider: Teiler, macht aus dem Quarztakt 1 Hz',
      '- counter: Zähler',
      '- regulator: Spannungsregler',
      '- ripple: Brummspannung'
    ].join('\n');
    return { title: 'Digitale Uhr mit Wecker: Datenblatt', md: md, tags: ['uhr', 'wecker', 'datenblatt'] };
  }

  /* ====================================================================== vuF: Abschlusstest (Gesamtsystem) */
  function mergedChain(pD, pS, outRef, P) {
    const N = NL(), res = { ok: false, msg: '', ratio: NaN, fOut: NaN };
    try {
      const st = counterStruct(pS); if (!st.ones) { res.msg = st.errs[0] || 'Zähler nicht erkannt'; return res; }
      const dNet = pnet(pD, outRef); if (!dNet) { res.msg = 'Ausgang CLK1HZ nicht angeschlossen'; return res; }
      const nlS = clone(pS.nl), clk = nlS.parts.filter(x => x.kind === 'CLK').map(x => x.ref);
      nlS.parts = nlS.parts.filter(x => clk.indexOf(x.ref) < 0); nlS.nets.forEach(n => { n.pins = n.pins.filter(a => clk.indexOf(a.slice(0, a.indexOf('.'))) < 0); }); nlS.nets = nlS.nets.filter(n => n.pins.length);
      const m = N.merge(pD.nl, nlS, { tie: [[dNet, st.clk]], share: ['GND', 'VCC'], name: 'Uhr im Verbund' });
      if (!m.ok) { res.msg = (m.errs && m.errs[0]) || 'Zusammenschluss nicht möglich'; return res; }
      const q3 = (m.netB && m.netB[st.ones.q[3]]) || st.ones.q[3], dv = N.dividerRatio(m.nl, { out: q3 });
      if (!dv.ok) { res.msg = dv.msg || 'Teilerkette im Verbund nicht erkennbar'; return res; }
      res.ok = true; res.ratio = dv.ratio; res.fOut = dv.fOut; res.fIn = dv.fIn;
    } catch (e) { res.msg = String(e && e.message); }
    return res;
  }
  function finalCheck(slots, spec, level, ctx0) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = { 1: 1.5, 2: 1, 3: 0.6 }[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => slotOf(ctx, k), lines = [], kpis = [];
    const dg = g('uhr.digi'), sch = g('uhr.sch'), loch = g('uhr.loch'), pcb = g('uhr.pcb'), code = g('uhr.code'), app = g('uhr.app'), pk = psuPick(g('uhr.ds'));
    const pD = prep(dg && dg.netlist), pS = prep(sch && sch.netlist), pL = prep(loch && loch.netlist);
    const od = arr(dg && dg.outputs).find(o => isObj(o) && lc(o.name) === 'clk1hz'), outRef = od ? String(od.ref) : null;
    const dvD = pD.ok && outRef ? dividerOf(pD.nl, outRef) : null;
    // 1: Teiler + Zähler im Verbund
    let mc = { ok: false, msg: 'Teiler oder Zähler fehlt' };
    if (pD.ok && pS.ok && outRef) mc = mergedChain(pD, pS, outRef, P);
    const baseOk = !!dvD && dvD.ok && dvD.ratio === P.fQ && fin(dvD.fOut) && Math.abs(dvD.fOut - 1) <= 1e-3;
    const chainOk = mc.ok && mc.ratio === 10 * P.fQ && Math.abs(mc.fOut - 0.1) <= 1e-4;
    lines.push(L(baseOk && chainOk, 'Teiler und Zähler im Verbund: ' + (mc.ok ? 'Teilung ' + (dvD && dvD.ok ? dvD.ratio : '?') + ' ergibt ' + (dvD && dvD.ok ? fm(dvD.fOut, 3) : '?') + ' Hz (nötig exakt 1 Hz), Übertrag der Einer alle ' + fm(1 / mc.fOut, 1) + ' s (nötig 10 s)' : mc.msg), 13));
    const sm = pS.ok ? counterSim(pS) : { ok: false, msg: 'keine Schaltung', seq: [] };
    lines.push(L(sm.ok && seqOk(sm.seq) && wrapOk(sm.seq), 'Zählerkette im Testtakt: ' + (sm.ok ? (seqOk(sm.seq) && wrapOk(sm.seq) ? '00 bis 59, danach wieder 00' : 'Zählfolge falsch (' + sm.seq.slice(0, 5).join(', ') + ' ...)') : sm.msg), 12));
    // 2: Netzteil
    let pc = null, derOk = false;
    if (pk.ok) { pc = psuCalc(P, pk); const der = DS().derate(pk.rg, { tAmb: P.tAmb, ptot: pc.ptot }); derOk = !!(der && der.ok); }
    const psuOk = !!pc && isFixed5(pk.rg) && fin(pc.vdo) && pc.uInMin >= pc.need - 1e-9 && derOk && isE(pk.cUF, 'E6');
    lines.push(L(psuOk, 'Netzteil: ' + (pc ? 'Welligkeit am Eingang ' + fm(pc.dU, 2) + ' V (am Ausgang etwa ' + fm(pc.rippleMv, 1) + ' mV), Tal ' + fm(pc.uInMin, 2) + ' V bei nötigen ' + fm(pc.need, 1) + ' V, Sperrschichttemperatur des Reglers ' + fm(pc.tj, 0) + ' °C' : 'Datenblatt-Station fehlt oder unvollständig'), 20));
    // 3: Gang nach der Korrektur
    const src = code && typeof code.src === 'string' ? code.src : '', fg = src ? clockFigures(src, P) : { ok: false, error: 'kein Programmtext' }, lim = P.gangZiel * tolMul;
    const gOk = fg.ok && fin(fg.drift) && Math.abs(fg.drift) <= lim;
    lines.push(L(gOk, 'Gang nach der Korrektur: ' + (fg.ok ? (fin(fg.drift) ? fm(Math.abs(fg.drift), 2) + ' s/Tag mit dem Quarz der Messung (' + fm(P.gangTag, 2) + ' s/Tag ohne Korrektur), erlaubt ' + fm(lim, 2) + ' s/Tag' : 'nicht messbar') : 'Lauf nicht möglich – ' + fg.error), 25));
    // 4: Konsistenz Schaltplan, Lochraster, Platine
    let consTxt = 'Schaltplan, Lochraster oder Platine fehlt', consOk = false;
    if (pS.ok && pL.ok && pcb) {
      const a = checkLoch(loch, ctx)[0], b = checkPcb(pcb, ctx)[0];
      consOk = a.ok && b.ok; consTxt = consOk ? 'Netze von Schaltplan (' + pS.nl.parts.length + ' Bauteile), Lochraster (' + pL.nl.parts.length + ') und Platine (' + arr((asBoard(pcb.board) || {}).parts).length + ') stimmen überein, Netzteil mit dem Siebelko aus der Datenblatt-Station' : (!a.ok ? 'Lochraster weicht vom Schaltplan ab' : 'Platine weicht vom Lochraster oder von der Datenblatt-Station ab');
    }
    lines.push(L(consOk, 'Konsistenz: ' + consTxt, 20));
    // 5: Notiz
    const words = app && typeof app.md === 'string' ? (app.md.match(/[A-Za-zÄÖÜäöüß0-9]+/g) || []).length : 0;
    lines.push(L(words >= 100, 'Notiz vorhanden: ' + words + ' Wörter (mindestens 100)', 10));
    // Kennzahlen
    const board = asBoard(pcb && pcb.board), rep = board && PCB() ? boardReport(PCB().normalize(board)) : null;
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!ok && fin(value) });
    k('gangvor', 'Gang vor Korrektur', Math.abs(P.gangTag), 's/Tag', true);
    k('gangnach', 'Gang nach Korrektur', fg.ok && fin(fg.drift) ? Math.abs(fg.drift) : NaN, 's/Tag', gOk);
    k('welligkeit', 'Welligkeit am Reglerausgang', pc ? pc.rippleMv : NaN, 'mV', psuOk);
    k('tj', 'Sperrschichttemperatur Regler', pc ? pc.tj : NaN, '°C', psuOk);
    k('flaeche', 'Platinenfläche', board ? board.w * board.h / 100 : NaN, 'cm²', !!board && board.w <= P.boardW && board.h <= P.boardH);
    k('kosten', 'Platinenkosten', rep ? rep.cost : NaN, '€', !!rep && fin(rep.cost));
    k('teiler', 'Teilerverhältnis', dvD && dvD.ok ? dvD.ratio : NaN, '', baseOk);
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
  const toUF = x => (fin(x) ? (x > 0 && x < 0.1 ? x * 1e6 : x) : null);
  const finOrNull = x => (fin(x) ? x : null);
  const rebuildBoard = d => { d.report = boardReport(PCB().normalize(d.board)); return d; };
  const drop = (arrIn, ref) => arrIn.filter(x => x.ref !== ref);
  const removePart = (b, ref) => { b.parts = b.parts.filter(p => p.ref !== ref); b.nets.forEach(n => { n.pins = n.pins.filter(a => a.indexOf(ref + '.') !== 0); }); };
  const swapKorr = (src, v) => src.replace(/KORR_US = -?\d+/, 'KORR_US = ' + v);

  const STATIONS = [
    { id: 'vu1', lab: 'vb', cat: 'Digitale Uhr', title: 'Netzteil aus den Datenblättern auslegen', level: 2,
      on: 'ds',
      text: 'Die Uhr hängt am Trafo aus dem Lastenheft. Wähle in den Übungsdatenblättern die Gleichrichterdiode und den 5-V-Regler, rechne den Siebelko aus der E6-Reihe und die Verluste im Regler. Auch im Tal der Welligkeit muss der Regler mindestens 5 V plus seine Dropout-Spannung bekommen, und seine Sperrschicht darf bei der Umgebungstemperatur nicht zu heiß werden. Begründe kurz, warum du dich gegen die anderen Bauteile entschieden hast.',
      in: [], out: 'uhr.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'diode', label: 'Gleichrichterdiode', type: 'select', options: [{ value: 'tf-1n4148', label: '1N4148' }, { value: 'tf-1n4007', label: '1N4007' }, { value: 'tf-zd', label: 'Z-Diode 5,1 V' }] },
        { key: 'regler', label: 'Regler', type: 'select', options: [{ value: 'tf-7805', label: '7805 (fest 5 V)' }, { value: 'tf-lm317', label: 'LM317 (einstellbar)' }] },
        { key: 'cSieb', label: 'Siebelko C', type: 'eseries', unit: 'µF', hint: 'E6-Reihe' },
        { key: 'uElko', label: 'Spannungsfestigkeit des Elkos', type: 'number', unit: 'V' },
        { key: 'dU', label: 'Welligkeit ΔU = I · 10 ms / C', type: 'number', unit: 'V' },
        { key: 'uInMin', label: 'kleinste Eingangsspannung U_in,min', type: 'number', unit: 'V' },
        { key: 'pV', label: 'Verlustleistung des Reglers', type: 'number', unit: 'W' },
        { key: 'tj', label: 'Sperrschichttemperatur des Reglers', type: 'number', unit: '°C' },
        { key: 'begruendung', label: 'Begründung', type: 'area', hint: 'warum diese Diode und dieser Regler' }
      ],
      fromForm: v => {
        const di = dsOf(v.diode), rg = dsOf(v.regler);
        return { items: [{ role: 'diode', ds: v.diode || '', part: di ? di.part : '', ref: di ? di.ref : '' }, { role: 'regler', ds: v.regler || '', part: rg ? rg.part : '', ref: rg ? rg.ref : '' }],
          calc: { dUV: finOrNull(numOf(v.dU)), uInMinV: finOrNull(numOf(v.uInMin)), pVW: finOrNull(numOf(v.pV)), tjC: finOrNull(numOf(v.tj)) },
          vals: { cSieb: toUF(numOf(v.cSieb)), uElko: finOrNull(numOf(v.uElko)), begruendung: String(v.begruendung || '') } };
      },
      toForm: d => { const it = r => arr(d && d.items).find(x => isObj(x) && x.role === r) || {}, c = isObj(d && d.calc) ? d.calc : {}, v = isObj(d && d.vals) ? d.vals : {}, sv = x => (x == null ? '' : String(x));
        return { diode: it('diode').ds || '', regler: it('regler').ds || '', cSieb: sv(v.cSieb), uElko: sv(v.uElko), dU: sv(c.dUV), uInMin: sv(c.uInMinV), pV: sv(c.pVW), tj: sv(c.tjC), begruendung: sv(v.begruendung) }; },
      open: { ex: 'Netzteil mit Siebelko', tab: 'Bibliothek' },
      assist: { 1: { ds: 'tf-7805', tab: 'Rechner', ex: 'Netzteil mit Siebelko' } },
      hint: ['Die Dioden der Brücke müssen die höchste Sperrspannung aushalten, das ist der Scheitelwert √2 · U mit 50 % Reserve, und den Strom der Uhr tragen. Schau in die Grenzwerte (Absolute Maximum Ratings).',
        'Der Elko wird bei jeder Netzhalbwelle nachgeladen, also alle 10 ms. Die Welligkeit ist ΔU = I · 10 ms / C. Von Û − 1,4 V (zwei Dioden) bleibt im Tal Û − 1,4 V − ΔU, und das muss mindestens 5 V plus Dropout des Reglers sein.',
        '1N4007 und 7805. C = I · 10 ms / (Û − 1,4 V − 5 V − Dropout) ist die kleinste Kapazität, nimm den nächsten E6-Wert darüber und rechne mit 15 % Reserve. Der Regler verheizt (U_mittel − 5 V) · I, die Temperatur ist T_amb + P · R_thJA.'],
      check: safe(checkDs, 'Netzteil'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => psuSolution(ctx),
      mutants: [
        { name: 'Elko mit 47 µF zu klein', mutate: d => { d.vals.cSieb = 47; d.calc = {}; return d; }, expectFail: ['Siebelko'] },
        { name: 'LM317 statt 7805', mutate: d => { d.items[1] = { role: 'regler', ds: 'tf-lm317', part: 'TF-LM317', ref: 'LM317' }; d.calc = {}; return d; }, expectFail: ['Regler 5 V'] },
        { name: 'Z-Diode als Gleichrichter', mutate: d => { d.items[0] = { role: 'diode', ds: 'tf-zd', part: 'TF-ZD5V1', ref: 'BZX55C5V1' }; return d; }, expectFail: ['Brückendioden'] },
        { name: 'Elko nicht aus der E6-Reihe', mutate: d => { d.vals.cSieb = d.vals.cSieb * 1.3; d.calc = {}; return d; }, expectFail: ['Siebelko'] },
        { name: 'Elko nur 10 V fest', mutate: d => { d.vals.uElko = 10; return d; }, expectFail: ['Elko-Spannungsfestigkeit'] },
        { name: 'Begründung fehlt', mutate: d => { d.vals.begruendung = ''; return d; }, expectFail: ['Begründung'] }
      ] },

    { id: 'vu2', lab: 'vb', cat: 'Digitale Uhr', title: 'Sekundentakt aus dem Quarz teilen', level: 2,
      on: 'digi',
      text: 'Baue den Sekundentakt: Ein 4060 schwingt mit dem Quarz aus dem Lastenheft, weitere Teilerstufen machen daraus genau 1 Hz. Der Ausgang ist eine LED mit der Beschriftung CLK1HZ (mit Vorwiderstand) am letzten Teiler. Der Teiler läuft mit der Versorgung aus deiner Datenblatt-Station, also trägst du den Versorgungsbereich der Schaltung ein. Alle Eingänge brauchen einen festen Pegel, auch der Reset.',
      in: ['uhr.ds'], out: 'uhr.digi', type: 'digi.design', w: 100, pass: null,
      open: { ex: 'Quarzteiler' },
      assist: { 1: { kind: 'gatterkarte', gates: ['4060', '4013'] } },
      hint: ['Der Teiler muss durch fQ / 1 Hz teilen. Bei 32768 Hz ist das 2^15, bei 4194304 Hz 2^22. Der 4060 hat Ausgänge Q4 bis Q14, jeder halbiert die Frequenz weiter.',
        'Der Quarz hängt mit einem Widerstand von etwa 1 MΩ und zwei kleinen Kondensatoren an Pin 10 und 11 des ersten 4060. Q14 (Pin 3) teilt durch 2^14. Dahinter brauchst du noch 2 (halbes 4013 mit D an Q̄) oder 2^8 (zweiter 4060 an Pin 11, Ausgang Q8 an Pin 14).',
        'Reset (Pin 12 beim 4060, S und R beim 4013) auf Masse, nicht benutzte Eingänge des 4013 ebenfalls. Der Versorgungsbereich der CMOS-Reihe ist 3 bis 15 V und muss den Ausgangsbereich deines Reglers umfassen.'],
      check: safe(checkDigi, 'Teiler'),
      starter: ctx => ({ netlist: { v: 1, name: 'leer', parts: [], nets: [] }, inputs: [], outputs: [], vdd: { min: 3, max: 15 } }),
      solution: ctx => buildDigi(P_(ctx)),
      mutants: [
        { name: 'Q13 statt Q14 (Teilung halbiert)', mutate: d => { setPart(d.netlist, 'U5', p => { if (p.pins) { p.pins['2'] = p.pins['3']; delete p.pins['3']; } }); d.netlist.nets.forEach(n => { n.pins = n.pins.map(a => (a === 'U5.3' ? 'U5.2' : a)); }); return d; }, expectFail: ['Teilungsverhältnis'] },
        { name: 'Reset des 4060 auf Plus', mutate: d => { movePin(d.netlist, 'U5.12', 'VCC'); return d; }, expectFail: ['Eingänge beschaltet'] },
        { name: 'Versorgung am zweiten IC fehlt', mutate: d => { dropPin(d.netlist, d.netlist.parts.find(p => p.ref === 'U6').value.indexOf('4013') >= 0 ? 'U6.14' : 'U6.16'); return d; }, expectFail: ['Eingänge beschaltet'] },
        { name: 'Ausgang falsch benannt', mutate: d => { d.outputs[0].name = 'TAKT'; return d; }, expectFail: ['Ausgang CLK1HZ'] },
        { name: 'Versorgungsbereich unzulässig', mutate: d => { d.vdd = { min: 1, max: 20 }; return d; }, expectFail: ['Versorgungsbereich'] },
        { name: 'Quarz mit falscher Frequenz', mutate: d => { setPart(d.netlist, 'Q1', p => { p.value = '4000000'; }); return d; }, expectFail: ['Teilungsverhältnis'] },
        { name: 'zu viele ICs', mutate: d => { for (let i = 0; i < 2; i++) d.netlist.parts.push({ ref: 'Z' + i, kind: 'ICX', value: '4013', pins: {} }); return d; }, expectFail: ['Bauteilbudget'] }
      ] },

    { id: 'vu3', lab: 'vb', cat: 'Digitale Uhr', title: 'Sekundenzähler mit Anzeige zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne den Sekundenzähler 00 bis 59: Der 1-Hz-Takt aus deinem Teiler läuft in zwei BCD-Dekaden eines 4518, der Übertrag der Einer in die Zehner. Zwei Dekoder 4543 steuern zwei 7-Segment-Anzeigen mit Vorwiderständen. Ein UND-Gatter erkennt die 60 und setzt beide Dekaden zurück. Simuliere mit dem schnellen Testtakt, dass die Folge 00 bis 59 stimmt.',
      in: ['uhr.digi', 'uhr.ds'], out: 'uhr.sch', type: 'sch.circuit', w: 100, pass: null,
      open: { ex: 'Sekundenzähler' },
      assist: { 1: { kind: 'startschaltung', parts: ['BAT 5 V', 'CLK 1 Hz', 'Masse'] } },
      hint: ['Der 4518 zählt an CP0 bei steigender Flanke, wenn CP1 auf High liegt. So bekommen die Einer den Takt. Die Zehner zählen an CP1 bei fallender Flanke, wenn CP0 auf Low liegt, und CP1 bekommt Q3 der Einer.',
        'Die 60 erkennst du an den Zehnern: 6 ist 0110, also sind Q1 und Q2 gleichzeitig High. Ein UND an diese beiden Ausgänge setzt über MR beide Dekaden auf 0. Die Eingänge D0 bis D3 des Dekoders kommen an Q0 bis Q3 derselben Dekade.',
        'Beim 4543: LD an Plus (durchlässig), BI und PH an Masse (Anzeige mit gemeinsamer Kathode). Jeder Segmentausgang a bis g geht über einen Widerstand an das gleichnamige Segment. Bei 5 V und etwa 2 V LED-Spannung geben 1 kΩ gut 3 mA. Unbenutzte Eingänge des 4081 auf Masse.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => schSolution(ctx),
      mutants: [
        { name: 'Übertrag von Q2 statt Q3', mutate: d => { movePin(d.netlist, 'U1.10', 'Q2A'); return d; }, expectFail: ['Topologie', 'Zählfolge'] },
        { name: 'UND an Q0 und Q2 der Zehner', mutate: d => { movePin(d.netlist, 'U2.1', 'Q0B'); return d; }, expectFail: ['Zählfolge', 'Überlauf'] },
        { name: 'Segmentwiderstand 10 Ω', mutate: d => { setPart(d.netlist, 'R3', p => { p.value = '10'; }); return d; }, expectFail: ['Segmentwiderstände'] },
        { name: 'Versorgung des Dekoders fehlt', mutate: d => { dropPin(d.netlist, 'U3.16'); return d; }, expectFail: ['Versorgung'] },
        { name: 'zweite Anzeige fehlt', mutate: d => { d.netlist.parts = d.netlist.parts.filter(p => p.ref !== 'DS1'); d.netlist.nets.forEach(n => { n.pins = n.pins.filter(a => a.indexOf('DS1.') !== 0); }); return d; }, expectFail: ['Bauteile'] },
        { name: 'BCD-Eingänge D1 und D2 vertauscht', mutate: d => { movePin(d.netlist, 'U3.3', 'Q2A'); movePin(d.netlist, 'U3.2', 'Q1A'); return d; }, expectFail: ['Topologie'] }
      ] },

    { id: 'vu4', lab: 'vb', cat: 'Digitale Uhr', title: 'Prototyp auf dem Lochraster aufbauen', level: 2,
      on: 'loch',
      text: 'Baue die Sekundenstufe auf dem Lochraster auf. Sie passt nicht auf eine Platine, nimm höchstens drei und verbinde sie mit Flachbandkabeln: Jede Leitung, die zwischen zwei Platinen läuft, braucht eine eigene Ader. Dein Lochraster muss genau die Netze deines Schaltplans haben, ohne Kurzschluss, und zählen muss es auch.',
      in: ['uhr.sch'], out: 'uhr.loch', type: 'loch.layout', w: 100, pass: null,
      open: { ex: 'Sekundenstufe', boards: 2 },
      assist: { 1: { kind: 'vorverdrahtet' } },
      solNote: 'Musterlösung nur als Beschreibung: Das Lab setzt die Bauteile und verdrahtet sie, so weit es geht, auf einer Platine. Die Platinen und das Flachbandkabel richtest du selbst ein. Die Prüfung dieser Station rechnet mit den Daten der vollständigen Musterlösung.',
      hint: ['Teile die Schaltung so auf, dass wenige Leitungen zwischen den Platinen laufen. Eine gute Schnittstelle liegt zwischen Zähler und Dekodern.',
        'Zwischen Zähler und Dekodern laufen die acht BCD-Leitungen, dazu kommen Plus und Masse. Das Flachbandkabel braucht also mindestens zehn Adern, wenn du so teilst.',
        'Prüfe mit dem Durchgangsprüfer jedes Netz gegen den Schaltplan. Die Bezeichnungen der Bauteile (U1, R5 usw.) sollen mit dem Schaltplan übereinstimmen, damit die Prüfung die Netze vergleichen kann.'],
      check: safe(checkLoch, 'Lochraster'),
      starter: ctx => ({ name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, boards: 1, bom: [], doc: {}, wiresRibbon: 0 }),
      solution: ctx => lochSolution(ctx),
      mutants: [
        { name: 'Zähler falsch verdrahtet', mutate: d => { movePin(d.netlist, 'U1.10', 'Q2A'); return d; }, expectFail: ['Netze identisch', 'Zählen am Lochraster'] },
        { name: 'vier Platinen', mutate: d => { d.boards = 4; return d; }, expectFail: ['Platinenzahl'] },
        { name: 'Flachband mit 4 Adern', mutate: d => { d.wiresRibbon = 4; return d; }, expectFail: ['Platinenzahl und Flachband'] },
        { name: 'Bauteil fehlt in der Stückliste', mutate: d => { d.bom = drop(d.bom, 'R5'); return d; }, expectFail: ['Stückliste'] },
        { name: 'Plus und Masse am Zähler verbunden', mutate: d => { movePin(d.netlist, 'U1.8', 'VCC'); return d; }, expectFail: ['Keine Kurzschlüsse', 'Netze identisch'] }
      ] },

    { id: 'vu5', lab: 'vb', cat: 'Digitale Uhr', title: 'Serienplatine mit Netzteil entwerfen', level: 3,
      on: 'pcb',
      text: 'Entwirf die Serienplatine auf höchstens 100 mal 60 Millimeter und zwei Lagen: die Zählerkette aus deinem Lochraster, der Quarzteiler und das Netzteil mit dem Elko und dem Regler aus deiner Datenblatt-Station. Jeder IC bekommt einen Entkoppelkondensator nah am VDD-Pin, der Quarz sitzt dicht am Teiler, und der Prüfpunkt TP_Q führt das Quarzsignal heraus. Verlege alle Netze ohne DRC-Fehler.',
      in: ['uhr.loch', 'uhr.ds'], out: 'uhr.pcb', type: 'pcb.board', w: 100, pass: null,
      open: { ex: 'Serienplatine' },
      assist: { 1: { kind: 'vorplatziert' } },
      hint: ['Setze zuerst die ICs in eine Reihe, die Anzeigen an den Rand und die Segmentwiderstände dazwischen. Das Netzteil gehört in eine Ecke, damit seine Brummspannung die Logik nicht stört.',
        'Plus und Masse brauchen Bahnen von mindestens 0,4 mm oder eine Masse-Fläche. Je 100 nF Kondensator gehört höchstens 10 mm neben den VDD-Pin eines ICs, der Quarz höchstens 15 mm neben Pin 10 und 11 des 4060.',
        'Der Prüfpunkt TP_Q ist ein Stiftleistenfeld am Quarznetz, sein zweiter Pin liegt an Masse. Starte den Autorouter, schau in die DRC-Liste und ziehe die Netze von Hand nach, die er nicht schafft.'],
      check: safe(checkPcb, 'Platine'),
      starter: ctx => { const P = P_(ctx); const b = PCB().newBoard({ id: 'uhr', name: 'Neue Platine', w: P.boardW, h: P.boardH, layers: P.layers }); return { board: b, report: boardReport(b) }; },
      solution: ctx => { const P = P_(ctx), loch = need(ctx, 'uhr.loch'), b = buildBoard(P, loch && loch.netlist, need(ctx, 'uhr.ds')); return { board: b, report: boardReport(b) }; },
      mutants: [
        { name: 'keine Leiterbahnen', mutate: d => { d.board.tracks = []; d.board.vias = []; return rebuildBoard(d); }, expectFail: ['Alle Netze verlegt'] },
        { name: 'Pads am 4518 vertauscht', mutate: d => { d.board.nets.forEach(n => { n.pins = n.pins.map(p => (p === 'U1.3' ? 'U1.4' : p === 'U1.4' ? 'U1.3' : p)); }); return rebuildBoard(d); }, expectFail: ['Netze der Platine identisch'] },
        { name: 'Versorgungsbahnen nur 0,15 mm', mutate: d => { d.board.tracks.forEach(t => { t.w = 0.15; }); return rebuildBoard(d); }, expectFail: ['Versorgungsbahnen', 'DRC'] },
        { name: 'Entkoppelkondensator fehlt', mutate: d => { removePart(d.board, 'C7'); return rebuildBoard(d); }, expectFail: ['Entkoppelkondensator'] },
        { name: 'Quarz weit vom Teiler', mutate: d => { const q = d.board.parts.find(p => p.ref === 'Q1'); q.x = 88; q.y = 57; return rebuildBoard(d); }, expectFail: ['Quarz nah am Teiler'] },
        { name: 'Prüfpunkt TP_Q fehlt', mutate: d => { removePart(d.board, 'TP_Q'); return rebuildBoard(d); }, expectFail: ['Quarz nah am Teiler'] },
        { name: 'falscher Siebelko', mutate: d => { d.board.parts.find(p => p.ref === 'C3').value = '10u'; return rebuildBoard(d); }, expectFail: ['Netze der Platine identisch'] }
      ] },

    { id: 'vu6', lab: 'vb', cat: 'Digitale Uhr', title: 'Quarz und Gang messen', level: 2,
      on: 'mess',
      text: 'Die Platine ist fertig. Misst du am Prüfpunkt TP_Q mit dem Frequenzzähler die Quarzfrequenz, siehst du, dass sie vom Nennwert abweicht. Rechne die Abweichung in ppm und den Gang der Uhr in Sekunden pro Tag aus, und schreibe auf, ob die Uhr vor- oder nachgeht. Miss auch die Versorgung der Logik. Trage alle Werte mit Einheit und Messgerät ein.',
      in: ['uhr.pcb'], out: 'uhr.mess', type: 'mess.protocol', w: 100, pass: null,
      form: [
        { key: 'fIst', label: 'Quarzfrequenz f_ist am TP_Q', type: 'number', unit: 'Hz' },
        { key: 'ppm', label: 'Abweichung (f_ist − f_Nenn) / f_Nenn', type: 'number', unit: 'ppm' },
        { key: 'gang', label: 'Gang pro Tag', type: 'number', unit: 's/Tag', hint: 'plus = Uhr geht vor' },
        { key: 'richtung', label: 'Die Uhr geht', type: 'select', options: [{ value: 'vor', label: 'vor' }, { value: 'nach', label: 'nach' }] },
        { key: 'uVdd', label: 'Versorgung der Logik U_VDD', type: 'number', unit: 'V' },
        { key: 'finding', label: 'Befund', type: 'area' }
      ],
      fromForm: v => {
        const mk = (id, label, unit, val, ins, tp) => ({ id: id, label: label, unit: unit, soll: 0, ist: finOrNull(numOf(val)), tol: 1, instrument: ins, tp: tp });
        const vals = {}; if (fin(numOf(v.fIst))) vals.fIstHz = numOf(v.fIst); if (fin(numOf(v.ppm))) vals.ppm = numOf(v.ppm); if (fin(numOf(v.gang))) vals.gangSProTag = numOf(v.gang); if (v.richtung) vals.richtung = String(v.richtung);
        return { rows: [mk('f_ist', 'Quarzfrequenz', 'Hz', v.fIst, 'Frequenzzähler', 'TP_Q'), mk('ppm', 'Abweichung', 'ppm', v.ppm, 'Rechnung', ''), mk('gangSProTag', 'Gang pro Tag', 's/Tag', v.gang, 'Rechnung', ''), mk('U_VDD', 'Versorgung der Logik', 'V', v.uVdd, 'Multimeter', 'VCC')], values: vals, findings: v.finding ? [String(v.finding)] : [] };
      },
      toForm: d => { const m = messVals(d), sv = x => (fin(x) ? String(x) : ''); return { fIst: sv(m.f), ppm: sv(m.ppm), gang: sv(m.gang), richtung: isObj(d && d.values) && d.values.richtung ? String(d.values.richtung) : '', uVdd: sv(m.u), finding: arr(d && d.findings).join(' ') }; },
      open: { ex: 'Quarzmessung' },
      hint: ['Der Frequenzzähler hängt am Prüfpunkt TP_Q. Lies die Frequenz mit der angegebenen Auflösung ab und notiere sie in Hz mit Nachkommastellen.',
        'Die Abweichung in ppm ist (f_ist − f_Nenn) / f_Nenn · 10^6. Ein Quarz, der zu schnell schwingt, lässt die Uhr vorgehen. Der Gang pro Tag ist die Abweichung mal 86400 s, also ppm · 0,0864 s.',
        'Plus bei f_ist über dem Nennwert (Uhr geht vor), minus darunter (Uhr geht nach). Die Versorgung der Logik misst du mit dem Multimeter am Ausgang des 7805, sie muss im Datenblattbereich liegen.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'Nennfrequenz als Messwert', mutate: (d, ctx) => { const P = P_(ctx); d.values.fIstHz = P.fQ; d.rows.find(x => x.id === 'f_ist').ist = P.fQ; return d; }, expectFail: ['Quarzfrequenz'] },
        { name: 'Vorzeichen der Abweichung falsch', mutate: d => { d.values.ppm = -d.values.ppm; d.rows.find(x => x.id === 'ppm').ist = d.values.ppm; return d; }, expectFail: ['Abweichung'] },
        { name: 'Gang doppelt so groß', mutate: d => { d.values.gangSProTag *= 2; d.rows.find(x => x.id === 'gangSProTag').ist = d.values.gangSProTag; return d; }, expectFail: ['Gang pro Tag'] },
        { name: 'Richtung nicht benannt', mutate: d => { d.values.richtung = ''; d.findings = []; return d; }, expectFail: ['Richtung'] },
        { name: 'Versorgung 7 V', mutate: d => { d.rows.find(x => x.id === 'U_VDD').ist = 7; return d; }, expectFail: ['Versorgung U_VDD'] },
        { name: 'Einheiten fehlen', mutate: d => { d.rows.forEach(r => { r.unit = ''; }); return d; }, expectFail: ['Einheiten'] }
      ] },

    { id: 'vu7', lab: 'vb', cat: 'Digitale Uhr', title: 'Software-Wecker mit Gangkorrektur programmieren', level: 3,
      on: 'code',
      text: 'Schreibe das Arduino-Programm der Uhr: Es zählt die Zeit seit Mitternacht, zeigt hh:mm:ss in der ersten Zeile des I²C-LCD und läuft um 23:59:59 auf 00:00:00 über. Zur Weckzeit aus dem Lastenheft ertönt der Piezo an D8 mit tone(), er endet nach 60 Sekunden oder mit dem Taster an D2. Dein gemessener Gang kommt als Korrektur ins Programm, damit die Uhr höchstens 0,5 Sekunden pro Tag falsch geht.',
      in: ['uhr.mess'], out: 'uhr.code', type: 'code.sketch', w: 100, pass: null,
      open: { ex: 'Uhr mit Wecker', rig: 'arduino' },
      assist: { 1: { kind: 'rahmen' } },
      hint: ['Zähle die Zeit nicht mit delay(1000), das addiert die Laufzeit des Programms. Vergleiche millis() mit dem letzten Zeitpunkt und erhöhe diesen um die Periode, dann gehen keine Bruchteile verloren. Nimm millis() und nicht micros(): micros() läuft schon nach 71 Minuten über, und der Simulator rechnet das in Vergleichen nicht wie echte Hardware.',
        'Dein Gang in s/Tag geteilt durch 0,0864 ist die Abweichung in ppm, also in Mikrosekunden je Sekunde. Die Sekunde dauert 1 000 000 µs plus diese Korrektur. Rechne die Periode in Millisekunden und merke dir den Rest in Mikrosekunden für die nächste Sekunde.',
        'Die Sekunden laufen mit (sek + 1) % 86400, das ergibt den Überlauf. Der Wecker startet einmal, wenn sek gleich der Weckzeit in Sekunden ist: tone(8, 2000). Beenden mit noTone(8) nach 60000 ms oder wenn digitalRead(2) LOW ist (INPUT_PULLUP).'],
      check: safe(checkCode, 'Programm'),
      starter: ctx => ({ lang: 'arduino', src: 'void setup() {\n}\n\nvoid loop() {\n}\n' }),
      solution: ctx => sketchSolution(ctx),
      mutants: [
        { name: 'ohne Gangkorrektur', mutate: d => { d.src = swapKorr(d.src, 0); return d; }, expectFail: ['Restabweichung'] },
        { name: 'Korrektur mit falschem Vorzeichen', mutate: d => { const m = /KORR_US = (-?\d+)/.exec(d.src); d.src = swapKorr(d.src, -(+m[1])); return d; }, expectFail: ['Restabweichung'] },
        { name: 'kein Tagesüberlauf', mutate: d => { d.src = d.src.replace('% 86400', '% 90000'); return d; }, expectFail: ['Tagesüberlauf'] },
        { name: 'Taster beendet den Wecker nicht', mutate: d => { d.src = d.src.replace(' || digitalRead(TASTER) == LOW', ''); return d; }, expectFail: ['Wecker mit Taster'] },
        { name: 'Wecker endet nie ohne Taster', mutate: d => { d.src = d.src.replace('millis() - weckStart >= 60000 || ', ''); return d; }, expectFail: ['Wecker ohne Taster'] },
        { name: 'Weckzeit eine Minute zu spät', mutate: d => { d.src = d.src.replace(/WECK_S = (\d+)/, (a, n) => 'WECK_S = ' + (+n + 60)); return d; }, expectFail: ['Wecker: '] }
      ] },

    { id: 'vu8', lab: 'vb', cat: 'Digitale Uhr', title: 'Datenblatt der Uhr schreiben', level: 1,
      on: 'app',
      text: 'Schreibe das Datenblatt deiner Uhr als Notiz im Obsidian-Format: technische Daten, Anschlüsse, Bedienung, Wartung und ein kleines Glossar mit englischen Fachbegriffen. Nimm die Zahlen aus deinen eigenen Stationen, den Gang, die Versorgung, die Stromaufnahme, den Siebelko und die Platinenmaße.',
      in: ['uhr.code', 'uhr.mess', 'uhr.ds', 'uhr.pcb'], out: 'uhr.app', type: 'app.note', w: 100, pass: null,
      form: [{ key: 'md', label: 'Notiz (Markdown)', type: 'area', hint: 'mit Frontmatter, Überschriften und Listen' }],
      fromForm: v => { const md = String(v.md || ''); return { title: (/^#\s+(.+)$/m.exec(md) || [0, ''])[1], md: md, tags: [] }; },
      template: ['Technische Daten', 'Anschlüsse', 'Bedienung', 'Wartung', 'Glossar'],
      toForm: d => ({ md: String(d && d.md || '') }),
      open: { ex: 'Notiz-Vorlage' },
      hint: ['Gliedere mit Überschriften: Technische Daten, Anschlüsse, Bedienung, Wartung, Glossar. Oben gehört ein Frontmatter mit tags und date hinein.',
        'Technische Daten als Liste mit Zahl und Einheit: Quarz, Gang vor Korrektur, Gang nach Korrektur (Ziel), Versorgung, Stromaufnahme, Siebelko, Platinenmaße. Mindestens vier davon müssen auf zwei Prozent stimmen.',
        'Im Glossar stehen mindestens vier englische Begriffe wie crystal, oscillator, divider, counter, regulator oder ripple mit der deutschen Erklärung. Die Wartungsliste braucht mehrere Punkte mit Aufzählungszeichen. Insgesamt mindestens 120 Wörter.'],
      check: safe(checkApp, 'Notiz'),
      starter: ctx => ({ title: 'Neue Notiz', md: '', tags: [] }),
      solution: ctx => noteSolution(ctx),
      mutants: [
        { name: 'falsche Zahlen', mutate: d => { d.md = d.md.replace(/(\d+)([.,]\d+)?(?= ?(Hz|s\/Tag|V |mA|µF|mm))/g, '999'); return d; }, expectFail: ['Kennzahlen'] },
        { name: 'keine Überschriften', mutate: d => { d.md = d.md.replace(/^#+ /gm, ''); return d; }, expectFail: ['Abschnitte'] },
        { name: 'Frontmatter fehlt', mutate: d => { d.md = d.md.replace(/^---[\s\S]*?---\r?\n/, ''); return d; }, expectFail: ['Frontmatter'] },
        { name: 'Glossar fehlt', mutate: d => { d.md = d.md.replace(/## Glossar[\s\S]*$/, ''); return d; }, expectFail: ['Glossar'] },
        { name: 'Notiz zu kurz', mutate: d => { d.md = d.md.split('\n').slice(0, 9).join('\n'); return d; }, expectFail: ['Länge', 'Abschnitte'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k], tol: 1, level: 2 };
    const out = [], hh = String(P.weckH).padStart(2, '0') + ':' + String(P.weckM).padStart(2, '0');
    const ds = g('uhr.ds'), dg = g('uhr.digi'), sch = g('uhr.sch'), loch = g('uhr.loch'), pcb = g('uhr.pcb'), mess = g('uhr.mess'), code = g('uhr.code'), app = g('uhr.app');
    out.push({ h: 'Lastenheft', rows: [['Quarz', P.fQ + ' Hz'], ['Trafo', P.uSec + ' V~'], ['Stromaufnahme', P.iUhr + ' mA'], ['Weckzeit', hh + ' Uhr'], ['Gangziel', 'höchstens ' + fm(P.gangZiel, 1) + ' s/Tag']] });
    const pk = ds ? psuPick(ds) : null;
    if (pk && pk.ok) { const c = psuCalc(P, pk); out.push({ h: 'Netzteil', rows: [['Diode', refOf(pk.di)], ['Regler', refOf(pk.rg)], ['Siebelko', fm(pk.cUF, 0) + ' µF, ' + fm(pk.uC, 0) + ' V'], ['Welligkeit ΔU', fm(c.dU, 2) + ' V'], ['Eingangsspannung im Tal', fm(c.uInMin, 2) + ' V'], ['Verlust im Regler', fm(c.p, 2) + ' W'], ['Sperrschichttemperatur', fm(c.tj, 0) + ' °C']] }); }
    if (dg) { const pd = prep(dg.netlist), od = arr(dg.outputs).find(o => isObj(o) && lc(o.name) === 'clk1hz'), dv = pd.ok && od ? dividerOf(pd.nl, String(od.ref)) : null; out.push({ h: 'Sekundentakt', rows: [['Teilerverhältnis', dv && dv.ok ? String(dv.ratio) : '?'], ['Ausgang', fm(dv && dv.ok ? dv.fOut : NaN, 3) + ' Hz'], ['ICs', pd.ok ? partsOf(pd, 'ICX').length : 0]] }); }
    if (sch && isObj(sch.netlist)) out.push({ h: 'Schaltung und Stückliste', rows: sch.netlist.parts.map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    if (loch) out.push({ h: 'Lochraster', rows: [['Platinen', loch.boards], ['Flachbandadern', loch.wiresRibbon == null ? '?' : loch.wiresRibbon], ['Bauteile', arr(loch.bom).length]] });
    const b = pcb && asBoard(pcb.board); if (b && PCB()) { const r = boardReport(PCB().normalize(b)); out.push({ h: 'Platine', rows: [['Maße', fm(r.w, 0) + ' x ' + fm(r.h, 0) + ' mm, ' + r.layers + ' Lagen'], ['Bauteile', r.bomCount], ['DRC-Fehler', r.drcErrors], ['Kosten', fm(r.cost, 2) + ' €']] }); }
    if (mess) { const mv = messVals(mess); out.push({ h: 'Messprotokoll', rows: arr(mess.rows).map(r => [r.label || r.id, (fin(+r.ist) ? fm(+r.ist, 3) : '?') + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) }); }
    if (code && typeof code.src === 'string') { const fg = clockFigures(code.src, P); out.push({ h: 'Software', rows: [['Zeilen', code.src.split('\n').length], ['Restabweichung', fg.ok && fin(fg.drift) ? fm(Math.abs(fg.drift), 2) + ' s/Tag' : '?'], ['Anzeige nach 3661 s', fg.ok ? hms(fg.show3661) : '?']] }); }
    if (app && app.md) out.push({ h: 'Datenblatt (App-Werkstatt)', html: '<pre>' + String(app.md).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Uhr: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Uhr: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Uhr: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Digitale Uhr mit Wecker', icon: '⏰', prefix: 'vu', order: 3,
    story: 'Die 3.-Lehrjahr-Abschlussarbeit der Lehrwerkstatt: eine Quarzuhr, die man wirklich benutzen kann, mit Netzteil, Sekundenteiler, Zählerkette, Platine und Wecker. Meister Funk: „Eine Uhr, die geht, ist langweilig. Eine, die weiß, wie falsch sie geht, ist Technik.“ Er gibt dir einen Messplatz für die Quarzabweichung, und die Software rechnet den Fehler am Ende heraus.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['ds', 'digi', 'sch', 'loch', 'pcb', 'mess', 'code', 'app'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    stations: STATIONS,
    final: {
      id: 'vuF', title: 'Abschlusstest: Digitale Uhr', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Teiler halbiert die Frequenz', mutate: s => { const d = s['uhr.digi']; d.netlist.nets.forEach(n => { n.pins = n.pins.map(a => (a === 'U5.3' ? 'U5.2' : a)); }); setPart(d.netlist, 'U5', p => { if (p.pins) { p.pins['2'] = p.pins['3']; delete p.pins['3']; } }); return s; }, expectFail: ['Teiler und Zähler im Verbund'] },
        { name: 'Programm ohne Gangkorrektur', mutate: s => { s['uhr.code'].src = swapKorr(s['uhr.code'].src, 0); return s; }, expectFail: ['Gang nach der Korrektur'] },
        { name: 'Zähler zählt falsch', mutate: s => { movePin(s['uhr.sch'].netlist, 'U1.10', 'Q2A'); return s; }, expectFail: ['Zählerkette im Testtakt', 'Teiler und Zähler im Verbund'] },
        { name: 'keine Notiz', mutate: s => { s['uhr.app'] = { title: '', md: '', tags: [] }; return s; }, expectFail: ['Notiz vorhanden'] },
        { name: 'Elko zu klein', mutate: s => { s['uhr.ds'].vals.cSieb = 47; return s; }, expectFail: ['Netzteil'] }
      ]
    },
    kpis: ['gangvor', 'gangnach', 'welligkeit', 'tj', 'flaeche', 'kosten', 'teiler'],
    report: reportParts,
    selfTest: selfTest,
    _test: { psuCalc: psuCalc, psuPick: psuPick, clockRun: clockRun, timeline: timeline, driftOf: driftOf, soundSpans: soundSpans, counterSim: counterSim, counterStruct: counterStruct, prep: prep, sketchSource: sketchSource, messTruth: messTruth, buildBoard: buildBoard, boardNetlist: boardNetlist, dividerOf: dividerOf, clockFigures: clockFigures, lcdModel: lcdModel },
    demos: [{ id: 'bis4', name: 'Digitale Uhr bis Station 4', upTo: 'vu4' }, { id: 'fertig', name: 'Digitale Uhr fertig', upTo: 'vuF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_UHR = def;
})(typeof window !== 'undefined' ? window : globalThis);
